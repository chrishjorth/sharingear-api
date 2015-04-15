/**
 * Defines Sharingear booking.
 * When a renter books the booking status changes to waiting and then to pending once the payment preauthorization is confirmed
 * When a user's gear is retrieved we check if there is a booking pending and in that case we send along the booking status.
 * When a user's gear is retrieved we check if there is an accepted booking that is current or past and in that case change the gear status to rented-out.
 * When an owner denies a booking the status must be set to denied.
 * When a renter views a denied booking the status must be set to ended-denied.
 * When an owner accepts a booking the status must be set to accepted.
 * When a renter ends a booking the gear status must be set to renter-returned.
 * When an owner ends a booking the gear status must be set to owner-returned.
 * If anything goes wrong the booking status must be set to failed.
 * When a gear status return state is to be set, if it already was in a return state, set it to null. Then change the booking status to ended and do the payout.
 * 
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var Moment = require("moment"),
    db = require("./database"),
    Gear = require("./gear"),
    User = require("./user"),
    Payment = require("./payment"),
    Notifications = require("./notifications"),
    Config = require("./config"),
    Localization = require("./localization"),

    create,
    _insertBooking,
    read,
    readRentalsForUser,
    readReservationsForUser,
    update,

    updateToPending,
    updateToDenied,
    updateToAccepted,
    updateToEndedDenied,
    updateToRenterReturned,
    updateToOwnerReturned,

    preAuthorize,
    chargePreAuthorization,
    endBooking;

create = function(renterID, bookingData, callback) {
    //We store gear data as static in the booking, so that future changes of the gear does not affect this booking
    Gear.readGearWithID(bookingData.gear_id, function(error, gear) {
        if (error) {
            callback(error);
            return;
        }
        User.readUser(renterID, function(error, renterData) {
            if (error) {
                callback(error);
                return;
            }
            User.readUser(gear.owner_id, function(error, ownerData) {
                var renter_currency;
                if (error) {
                    callback(error);
                    return;
                }
                renter_currency = Localization.getCurrency(renterData.country);
                Localization.convertPrices([gear.price_a, gear.price_b, gear.price_c], gear.currency, renter_currency, function(error, convertedPrices) {
                    var renter_price /*, owner_currency*/ ;
                    if (error) {
                        callback(error);
                        return;
                    }
                    renter_price = Gear.getPrice(Math.ceil(convertedPrices[0]), Math.ceil(convertedPrices[1]), Math.ceil(convertedPrices[2]), bookingData.start_time, bookingData.end_time);
                    //owner_currency = Localization.getCurrency(ownerData.country);
                    //Localization.convertPrices([gear.price_a, gear.price_b, gear.price_c], "EUR", owner_currency, function(error, convertedPrices) {
                    var owner_price;
                    /*if(error) {
							callback(error);
							return;
						}*/
                    owner_price = Gear.getPrice(gear.price_a, gear.price_b, gear.price_c, bookingData.start_time, bookingData.end_time);
                    bookingData = {
                        gear_id: gear.id,
                        start_time: bookingData.start_time,
                        end_time: bookingData.end_time,
                        renter_id: renterData.id,
                        owner_id: gear.owner_id,
                        renter_email: renterData.email,
                        owner_email: ownerData.email,
                        renter_price: renter_price,
                        renter_currency: renter_currency,
                        owner_price: owner_price,
                        owner_currency: gear.currency,
                        cardId: bookingData.cardId,
                        gear_type: gear.gear_type,
                        gear_subtype: gear.subtype,
                        gear_model: gear.model,
                        gear_brand: gear.brand,
                        pickup_street: gear.address,
                        pickup_postal_code: gear.postal_code,
                        pickup_city: gear.city,
                        pickup_country: gear.country,
                        returnURL: bookingData.returnURL
                    };
                    _insertBooking(bookingData, callback);
                    //});
                });
            });
        });
    });
};

_insertBooking = function(bookingData, callback) {
    var booking;
    booking = [
        bookingData.gear_id,
        bookingData.start_time,
        bookingData.end_time,
        bookingData.renter_id,
        bookingData.owner_id,
        bookingData.renter_price,
        bookingData.renter_currency,
        bookingData.owner_price,
        bookingData.owner_currency,
        bookingData.gear_type,
        bookingData.gear_subtype,
        bookingData.gear_model,
        bookingData.gear_brand,
        bookingData.pickup_street,
        bookingData.pickup_postal_code,
        bookingData.pickup_city,
        bookingData.pickup_country,
        bookingData.renter_email,
        bookingData.owner_email
    ];

    //We have to insert before the preauthorization to get the booking id
    db.query("INSERT INTO gear_bookings(gear_id, start_time, end_time, renter_id, owner_id, renter_price, renter_currency, owner_price, owner_currency, gear_type, gear_subtype, gear_model, gear_brand, pickup_street, pickup_postal_code, pickup_city, pickup_country, renter_email, owner_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", booking, function(error, result) {
        var url, queryIndex;
        if (error) {
            callback("Error inserting booking: " + error);
            return;
        }
        //Assertion: only returnURLs with #route are valid
        url = bookingData.returnURL.split("#");
        queryIndex = url[0].indexOf("?");
        if (queryIndex < 0) {
            bookingData.returnURL = url[0] + "?booking_id=" + result.insertId + "#" + url[1];
        } else {
            bookingData.returnURL = url[0] + "&booking_id=" + result.insertId + "#" + url[1];
        }
        preAuthorize(bookingData, function(error, preAuthData) {
            if (error) {
                callback(error);
                return;
            }
            callback(null, {
                id: result.insertId,
                gear_id: bookingData.gear_id,
                start_time: bookingData.start_time,
                end_time: bookingData.end_time,
                renter_price: bookingData.renter_price,
                renter_currency: bookingData.renter_currency,
                owner_price: bookingData.owner_price,
                owner_currency: bookingData.owner_currency,
                verificationURL: preAuthData.verificationURL
            });
        });
    });
};

read = function(bookingID, callback) {
    db.query("SELECT id, gear_id, start_time, end_time, renter_id, owner_id, renter_price, renter_currency, owner_price, owner_currency, payment_timestamp, payin_time, payout_time, preauth_id, booking_status, gear_type, gear_subtype, gear_model, gear_brand, pickup_street, pickup_postal_code, pickup_city, pickup_country, renter_email, owner_email FROM gear_bookings WHERE id=?", [bookingID], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback("No booking found for id.");
            return;
        }
        callback(null, rows[0]);
    });
};

readRentalsForUser = function(userID, callback) {
    /*Gear.checkForRentals(userID, function(error) {
		if(error) {
			callback("Error checking gear for rentals: " + error);
			return;
		}*/
    db.query("SELECT gear_bookings.id AS booking_id, gear_bookings.gear_id AS id, gear_types.gear_type, gear_subtypes.subtype, gear_brands.name AS brand, gear.model, gear.images, gear.city, gear.owner_id, gear_bookings.start_time, gear_bookings.end_time, gear_bookings.renter_price, gear_bookings.renter_currency, gear_bookings.owner_price, gear_bookings.owner_currency, gear_bookings.booking_status FROM gear, gear_bookings, gear_types, gear_subtypes, gear_brands WHERE gear.id=gear_bookings.gear_id AND gear.owner_id=? AND gear_types.id=gear.gear_type AND gear_subtypes.id=gear.subtype AND gear_brands.id=gear.brand;", [userID], function(error, rows) {
        if (error) {
            callback("Error reading user rentals: " + error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, []);
        } else {
            callback(null, rows);
        }
    });
    //});
};

readReservationsForUser = function(renterID, callback) {
    /*Gear.checkForRentals(renterID, function(error) {
		if(error) {
			callback("Error checking gear for rentals: " + error);
			return;
		}*/
    db.query("SELECT gear_bookings.id AS booking_id, gear_bookings.gear_id AS id, gear_types.gear_type, gear_subtypes.subtype, gear_brands.name AS brand, gear.model, gear.images, gear.city, gear.owner_id, gear_bookings.start_time, gear_bookings.end_time, gear_bookings.renter_price, gear_bookings.renter_currency, gear_bookings.owner_price, gear_bookings.owner_currency, gear_bookings.booking_status FROM gear, gear_bookings, gear_types, gear_subtypes, gear_brands WHERE gear_bookings.gear_id = gear.id AND gear_bookings.renter_id=? AND gear_types.id=gear.gear_type AND gear_subtypes.id=gear.subtype AND gear_brands.id=gear.brand;", [renterID], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, []);
        } else {
            callback(null, rows);
        }
    });
    //});
};

update = function(bookingData, callback) {
    var status = bookingData.booking_status,
        bookingID = bookingData.booking_id;
    if (status !== "pending" && status !== "denied" && status !== "accepted" && status !== "ended-denied" && status !== "owner-returned" && status !== "renter-returned") {
        callback("Unacceptable booking status.");
        return;
    }
    this.read(bookingID, function(error, booking) {
        if (error) {
            callback("Error selecting booking interval: " + error);
            return;
        }
        booking.preauth_id = bookingData.preauth_id;
        console.log("Update to status: " + status);
        switch (status) {
            case "pending":
                updateToPending(booking, callback);
                break;
            case "denied":
                updateToDenied(booking, callback);
                break;
            case "accepted":
                updateToAccepted(booking, callback);
                break;
            case "ended-denied":
                updateToEndedDenied(booking, callback);
                break;
            case "renter-returned":
                updateToRenterReturned(booking, callback);
                break;
            case "owner-returned":
                updateToOwnerReturned(booking, callback);
                break;
            default:
                callback("Invalid booking status.");
        }
    });
};

updateToPending = function(booking, callback) {
    console.log(JSON.stringify(booking));
    //Check that the preauthorization status is waiting
    Payment.getPreauthorizationStatus(booking.preauth_id, function(error, preauthStatus) {
        if (error) {
            callback("Error checking preauthorization status: " + error);
            return;
        }
        if (preauthStatus !== "WAITING") {
            callback("Error preauthorizing payment.");
            return;
        }
        db.query("UPDATE gear_bookings SET booking_status='pending', preauth_id=? WHERE id=? LIMIT 1", [booking.preauth_id, booking.id], function(error) {
            if (error) {
                callback("Error updating booking status: " + error);
                return;
            }
            booking.booking_status = "pending";
            callback(null, booking);

            User.readUser(booking.owner_id, function(error, owner) {
                if (error) {
                    console.log("Error sending notification on booking update to pending. Unable to get owner data.");
                    return;
                }
                User.readUser(booking.renter_id, function(error, renter) {
                    var startTime, endTime;
                    if (error) {
                        console.log("Error sending notification on booking update to pending. Unable to get renter data.");
                        return;
                    }
                    startTime = new Moment(booking.start_time, "YYYY-MM-DD HH:mm:ss");
                    endTime = new Moment(booking.end_time, "YYYY-MM-DD HH:mm:ss");
                    Notifications.send(Notifications.BOOKING_PENDING_OWNER, {
                        name: owner.name,
                        image_url: renter.image_url,
                        item_type: booking.gear_type,
                        item_name: booking.gear_brand + " " + booking.gear_model + " " + booking.gear_subtype,
                        price: booking.owner_price,
                        fee: "-" + (booking.owner_price * 10 / 100),
                        total_price: booking.owner_price - (booking.owner_price * 10 / 100),
                        currency: booking.owner_currency,
                        street: booking.pickup_street,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourgearrentals"
                    }, owner.email);

                    Notifications.send(Notifications.BOOKING_PENDING_RENTER, {
                        name: renter.name,
                        image_url: owner.image_url,
                        item_type: booking.gear_type,
                        item_name: booking.gear_brand + " " + booking.gear_model + " " + booking.gear_subtype,
                        price: booking.renter_price,
                        fee: booking.renter_price * 10 / 100,
                        total_price: booking.renter_price + (booking.renter_price * 10 / 100),
                        currency: booking.renter_currency,
                        street: booking.pickup_street,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourgearreservations"
                    }, renter.email);
                });
            });
        });
    });
};

updateToDenied = function(booking, callback) {
    db.query("UPDATE gear_bookings SET booking_status='denied' WHERE id=? LIMIT 1", [booking.id], function(error) {
        if (error) {
            callback("Error updating booking status: " + error);
            return;
        }
        callback(null, booking);

        User.readUser(booking.renter_id, function(error, renter) {
            if (error) {
                console.log("Error sending notification to renter on booking update to denied.");
                return;
            }
            Notifications.send(Notifications.BOOKING_DENIED, {

            }, renter.email);
        });
    });
};

updateToAccepted = function(booking, callback) {
    chargePreAuthorization(booking, function(error) {
        if (error) {
            callback(error);
            return;
        }
        console.log("preauth charged");
        db.query("UPDATE gear_bookings SET booking_status='accepted', payment_timestamp=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
            if (error) {
                callback(error);
                return;
            }
            callback(null, booking);

            User.readUser(booking.renter_id, function(error, renter) {
                if (error) {
                    console.log("Error sending notifications on booking update to accepted. Unable to get renter data.");
                    return;
                }
                User.readUser(booking.owner_id, function(error, owner) {
                    var startTime, endTime, renterTotalPrice, renterFee, paymentTime;
                    if (error) {
                        console.log("Error sending notifications on booking update to accepted. Unable to get owner data.");
                        return;
                    }
                    startTime = new Moment(booking.start_time, "YYYY-MM-DD HH:mm:ss");
                    endTime = new Moment(booking.end_time, "YYYY-MM-DD HH:mm:ss");

                    renterTotalPrice = booking.renter_price + (booking.renter_price * 10 / 100);
                    renterFee = booking.renter_price * 10 / 100;
                    paymentTime = new Moment();

                    Notifications.send(Notifications.BOOKING_ACCEPTED_RENTER, {
                        name: renter.name,
                        image_url: owner.image_url,
                        item_type: booking.gear_type,
                        item_name: booking.gear_brand + " " + booking.gear_model + " " + booking.gear_subtype,
                        price: booking.renter_price,
                        fee: renterFee,
                        total_price: renterTotalPrice,
                        currency: booking.renter_currency,
                        street: booking.pickup_street,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        username_owner: owner.name,
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourgearreservations"
                    }, renter.email);

                    Notifications.send(Notifications.BOOKING_ACCEPTED_OWNER, {
                        name: owner.name,
                        image_url: renter.image_url,
                        item_type: booking.gear_type,
                        item_name: booking.gear_brand + " " + booking.gear_model + " " + booking.gear_subtype,
                        price: booking.owner_price,
                        fee: "-" + (booking.owner_price * 10 / 100),
                        total_price: booking.owner_price - (booking.owner_price * 10 / 100),
                        currency: booking.owner_currency,
                        street: booking.pickup_street,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourgearrentals"
                    }, owner.email);

                    Notifications.send(Notifications.RECEIPT_RENTER, {
                        name: renter.name,
                        item_name: booking.item_name,
                        price: booking.renter_price,
                        fee: renterFee,
                        total_price: renterTotalPrice,
                        currency: booking.renter_currency,
                        payment_date: paymentTime.format("DD/MM/YYYY"),
                        payment_time: paymentTime.format("HH:mm"),
                        date_from: startTime.format("DD/MM/YYYY"),
                        time_from: startTime.format("HH:mm"),
                        date_to: endTime.format("DD/MM/YYYY"),
                        time_to: endTime.format("HH:mm")
                    }, renter.email);
                });
            });
        });
    });
};

updateToEndedDenied = function(booking, callback) {
    db.query("UPDATE gear_bookings SET booking_status='ended-denied' WHERE id=? LIMIT 1", [booking.id], function(error) {
        if (error) {
            callback("Error updating booking status: " + error);
            return;
        }
        callback(null, booking);
    });
};

updateToRenterReturned = function(booking, callback) {
    var completeUpdate;

    completeUpdate = function(status) {
        db.query("UPDATE gear_bookings SET booking_status=? WHERE id=? LIMIT 1", [status, booking.id], function(error) {
            if (error) {
                callback("Error updating booking status: " + error);
                return;
            }
            callback(null, booking);
        });
    };

    if (booking.booking_status === "owner-returned") {
        endBooking(booking, function(error) {
            if (error) {
                callback(error);
                return;
            }
            completeUpdate("ended");
        });
    } else {
        completeUpdate("renter-returned");

        User.readUser(booking.owner_id, function(error, owner) {
            if (error) {
                console.log("Error getting owner for notification to renter on booking update to renter-returned: " + error);
                return;
            }
            User.readUser(booking.renter_id, function(error, renter) {
                if (error) {
                    console.log("Error getting renter for notification to renter on booking update to renter-returned: " + error);
                    return;
                }
                Notifications.send(Notifications.BOOKING_OWNER_RETURNED, {
                    name: owner.name,
                    username_renter: renter.name + " " + renter.surname,
                    dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourgearrentals"
                }, owner.email);
            });
        });
    }
};

updateToOwnerReturned = function(booking, callback) {
    var completeUpdate;

    completeUpdate = function(status) {
        db.query("UPDATE gear_bookings SET booking_status=? WHERE id=? LIMIT 1", [status, booking.id], function(error) {
            if (error) {
                callback("Error updating booking status: " + error);
                return;
            }
            callback(null, booking);
        });
    };

    if (booking.booking_status === "renter-returned") {
        endBooking(booking, function(error) {
            if (error) {
                callback(error);
                return;
            }
            completeUpdate("ended");
        });
    } else {
        completeUpdate("owner-returned");

        User.readUser(booking.renter_id, function(error, renter) {
            if (error) {
                console.log("Error getting renter for notification to owner on booking update to owner-returned: " + error);
                return;
            }
            User.readUser(booking.owner_id, function(error, owner) {
                if (error) {
                    console.log("Error getting owner for notification to owner on booking update to owner-returned: " + error);
                    return;
                }

                Notifications.send(Notifications.BOOKING_RENTER_RETURNED, {
                    name: renter.name,
                    username_owner: owner.name + " " + owner.surname,
                    dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourgearreservations"
                }, renter.email);
            });
        });
    }
};

preAuthorize = function(bookingData, callback) {
    User.getUserWithMangoPayData(bookingData.owner_id, function(error, seller) {
        if (error) {
            callback("Error getting MangoPay data for gear owner: " + error);
            return;
        }
        User.getUserWithMangoPayData(bookingData.renter_id, function(error, buyer) {
            if (error) {
                callback("Error getting MangoPay data for gear renter: " + error);
                return;
            }
            Payment.preAuthorize(seller, buyer, bookingData, callback);
        });
    });
};

chargePreAuthorization = function(bookingData, callback) {
    User.getUserWithMangoPayData(bookingData.owner_id, function(error, seller) {
        if (error) {
            callback("Error getting MangoPay data for gear seller: " + error);
            return;
        }
        User.getUserWithMangoPayData(bookingData.renter_id, function(error, renter) {
            if (error) {
                callback("Error getting MangoPay data for gear renter: " + error);
                return;
            }
            bookingData.item_name = bookingData.gear_brand + " " + bookingData.gear_model + " " + bookingData.gear_subtype;
            Payment.chargePreAuthorization(seller, renter, bookingData, callback);
        });
    });
};

endBooking = function(bookingData, callback) {
    User.getUserWithMangoPayData(bookingData.owner_id, function(error, owner) {
        if (error) {
            callback("Error getting MangoPay data for gear owner: " + error);
            return;
        }
        bookingData.item_name = bookingData.gear_brand + " " + bookingData.gear_model + " " + bookingData.gear_subtype;
        Payment.payOutSeller(owner, bookingData, function(error) {
            if (error) {
                callback(error);
                return;
            }
            /*Gear.setStatus(bookingData.gear_id, null, function(error) {
				if(error) {
					callback(error);
					return;
				}*/
            callback(null);

            Notifications.send(Notifications.BOOKING_ENDED_OWNER, {}, bookingData.owner_email);
            Notifications.send(Notifications.BOOKING_ENDED_RENTER, {}, bookingData.renter_email);
            //});
        });
    });
};

module.exports = {
    create: create,
    read: read,
    readRentalsForUser: readRentalsForUser,
    readReservationsForUser: readReservationsForUser,
    update: update
};
