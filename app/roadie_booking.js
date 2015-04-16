/**
 * Defines Sharingear booking.
 * When a renter books the booking status changes to waiting and then to pending once the payment preauthorization is confirmed
 * When a user's vehicle is retrieved we check if there is a booking pending and in that case we send along the booking status.
 * When a user's vehicle is retrieved we check if there is an accepted booking that is current or past and in that case change the vehicle status to rented-out.
 * When an owner denies a booking the status must be set to denied.
 * When a renter views a denied booking the status must be set to ended-denied.
 * When an owner accepts a booking the status must be set to accepted.
 * When a renter ends a booking the vehicle status must be set to renter-returned.
 * When an owner ends a booking the vehicle status must be set to owner-returned.
 * If anything goes wrong the booking status must be set to failed.
 * When a vehicle status return state is to be set, if it already was in a return state, set it to null. Then change the booking status to ended and do the payout.
 * 
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var Moment = require("moment"),
    db = require("./database"),
    Roadies = require("./roadies"),
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
    //We store vehicle data as static in the booking, so that future changes of the gear does not affect this booking
    Roadies.readRoadieWithID(bookingData.roadie_id, function(error, roadie) {
        if (error) {
            callback(error);
            return;
        }
        User.readCompleteUsers([renterID, roadie.owner_id], function(error, users) {
            var renterData, ownerData;
            if (error) {
                callback(error);
                return;
            }
            renterData = users[0];
            ownerData = users[1];

            Localization.convertPrices([roadie.price_a, roadie.price_b, roadie.price_c], roadie.currency, renterData.currency, function(error, convertedPrices) {
                var renter_price, owner_price;
                if (error) {
                    callback(error);
                    return;
                }
                renter_price = Roadies.getPrice(Math.ceil(convertedPrices[0]), Math.ceil(convertedPrices[1]), Math.ceil(convertedPrices[2]), bookingData.start_time, bookingData.end_time);
                owner_price = Roadies.getPrice(roadie.price_a, roadie.price_b, roadie.price_c, bookingData.start_time, bookingData.end_time);

                Payment.getUserWalletsForCurrency([renterData.mangopay_id, ownerData.mangopay_id], renterData.currency, function(error, wallets) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    bookingData = {
                        roadie_id: roadie.id,
                        roadie_type: roadie.roadie_type,
                        roadie_name: ownerData.name + " " + ownerData.surname,
                        price_a: roadie.price_a,
                        price_b: roadie.price_b,
                        price_c: roadie.price_c,
                        start_time: bookingData.start_time,
                        end_time: bookingData.end_time,
                        owner_id: roadie.owner_id,
                        owner_name: ownerData.name + " " + ownerData.surname,
                        owner_email: ownerData.email,
                        owner_phone: ownerData.phone,
                        owner_address: ownerData.address,
                        owner_city: ownerData.city,
                        owner_postal_code: ownerData.postal_code,
                        owner_country: ownerData.country,
                        owner_vatnum: "",
                        owner_pp_id: ownerData.mangopay_id,
                        owner_bank_id: ownerData.bank_id,
                        renter_id: renterData.id,
                        renter_name: renterData.name + " " + renterData.surname,
                        renter_email: renterData.email,
                        renter_phone: renterData.phone,
                        renter_address: renterData.address,
                        renter_city: renterData.city,
                        renter_postal_code: renterData.postal_code,
                        renter_country: renterData.country,
                        renter_vatnum: "",
                        renter_pp_id: renterData.mangopay_id,
                        owner_currency: ownerData.currency,
                        owner_wallet_id: wallets[1].wallet_id,
                        owner_price: owner_price,
                        owner_price_vat: 0, //TODO: Change this when VAT is implemented
                        owner_fee: owner_price / 100 * parseFloat(ownerData.seller_fee),
                        owner_fee_vat: 0, //TODO: Change this when VAT is implemented
                        //owner_pp_transaction_id: null,
                        renter_currency: renterData.currency,
                        renter_wallet_id: wallets[0].wallet_id,
                        renter_price: renter_price,
                        renter_price_vat: 0, //TODO: Change this when VAT is implemented
                        renter_fee: renter_price / 100 * parseFloat(renterData.buyer_fee),
                        renter_fee_vat: 0, //TODO: Change this when VAT is implemented
                        //renter_pp_transaction_id: null,
                        pickup_address: ownerData.address,
                        pickup_postal_code: ownerData.postal_code,
                        pickup_city: ownerData.city,
                        pickup_country: ownerData.country,
                        cardId: bookingData.cardId,
                        returnURL: bookingData.returnURL
                    };
                    _insertBooking(bookingData, callback);
                });
            });
        });
    });
};

_insertBooking = function(bookingData, callback) {
    var booking, sql;
    booking = [
        bookingData.roadie_id,
        bookingData.roadie_type,
        bookingData.roadie_name,
        bookingData.price_a,
        bookingData.price_b,
        bookingData.price_c,
        bookingData.start_time,
        bookingData.end_time,
        bookingData.owner_id,
        bookingData.owner_name,
        bookingData.owner_email,
        bookingData.owner_phone,
        bookingData.owner_address,
        bookingData.owner_postal_code,
        bookingData.owner_city,
        bookingData.owner_country,
        bookingData.owner_vatnum,
        bookingData.owner_pp_id,
        bookingData.owner_bank_id,
        bookingData.renter_id,
        bookingData.renter_name,
        bookingData.renter_email,
        bookingData.renter_phone,
        bookingData.renter_address,
        bookingData.renter_postal_code,
        bookingData.renter_city,
        bookingData.renter_country,
        bookingData.renter_vatnum,
        bookingData.renter_pp_id,
        bookingData.owner_currency,
        bookingData.owner_wallet_id,
        bookingData.owner_price,
        bookingData.owner_price_vat,
        bookingData.owner_fee,
        bookingData.owner_fee_vat,
        bookingData.renter_currency,
        bookingData.renter_wallet_id,
        bookingData.renter_price,
        bookingData.renter_price_vat,
        bookingData.renter_fee,
        bookingData.renter_fee_vat,
        bookingData.pickup_address,
        bookingData.pickup_postal_code,
        bookingData.pickup_city,
        bookingData.pickup_country
    ];

    sql = "INSERT INTO roadie_bookings(roadie_id, roadie_type, roadie_name, price_a, price_b, price_c, start_time, end_time, ";
    sql += "owner_id, owner_name, owner_email, owner_phone, owner_address, owner_postal_code, owner_city, owner_country, owner_vatnum, owner_pp_id, owner_bank_id, ";
    sql += "renter_id, renter_name, renter_email, renter_phone, renter_address, renter_postal_code, renter_city, renter_country, renter_vatnum, renter_pp_id, ";
    sql += "owner_currency, owner_wallet_id, owner_price, owner_price_vat, owner_fee, owner_fee_vat, renter_currency, renter_wallet_id, renter_price, renter_price_vat, renter_fee, renter_fee_vat, ";
    sql += "pickup_address, pickup_postal_code, pickup_city, pickup_country, request_time) VALUES ";
    sql += "(?, ?, ?, ?, ?, ?, ?, ?, ";
    sql += "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ";
    sql += "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ";
    sql += "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ";
    sql += "?, ?, ?, ?, NOW())";

    //We have to insert before the preauthorization to get the booking id
    db.query(sql, booking, function(error, result) {
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
                roadie_id: bookingData.roadie_id,
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
    db.query("SELECT id, roadie_id, start_time, end_time, renter_id, owner_id, renter_price, renter_currency, owner_price, owner_currency, payment_timestamp, payout_time, preauth_id, booking_status, roadie_type, pickup_address, pickup_postal_code, pickup_city, pickup_country, renter_email, owner_email FROM roadie_bookings WHERE id=?", [bookingID], function(error, rows) {
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
    db.query("SELECT roadie_bookings.id AS booking_id, roadie_bookings.roadie_id AS id, roadie_types.roadie_type, users.name, users.surname, users.image_url, roadies.city, roadies.owner_id, roadie_bookings.start_time, roadie_bookings.end_time, roadie_bookings.renter_price, roadie_bookings.renter_currency, roadie_bookings.owner_price, roadie_bookings.owner_currency, roadie_bookings.booking_status FROM roadies, users, roadie_bookings, roadie_types WHERE roadies.id=roadie_bookings.roadie_id AND roadies.owner_id=? AND roadie_types.id=roadies.roadie_type AND users.id=roadies.owner_id;", [userID], function(error, rows) {
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
};

readReservationsForUser = function(renterID, callback) {
    db.query("SELECT roadie_bookings.id AS booking_id, roadie_bookings.roadie_id AS id, roadie_types.roadie_type, users.name, users.surname, users.image_url, roadies.city, roadies.owner_id, roadie_bookings.start_time, roadie_bookings.end_time, roadie_bookings.renter_price, roadie_bookings.renter_currency, roadie_bookings.owner_price, roadie_bookings.owner_currency, roadie_bookings.booking_status FROM roadies, users, roadie_bookings, roadie_types WHERE roadie_bookings.roadie_id = roadies.id AND roadie_bookings.renter_id=? AND roadie_types.id=roadies.roadie_type AND users.id=roadies.owner_id;", [renterID], function(error, rows) {
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

/**
 * Money has been preauthorized successfully and we are waiting for the owner to accept.
 */
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
        db.query("UPDATE roadie_bookings SET booking_status='pending', preauth_id=? WHERE id=? LIMIT 1", [booking.preauth_id, booking.id], function(error) {
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
                        item_type: booking.roadie_type,
                        item_name: booking.name + " " + booking.surname,
                        price: booking.owner_price,
                        fee: "-" + (booking.owner_price * 10 / 100),
                        total_price: booking.owner_price - (booking.owner_price * 10 / 100),
                        currency: booking.owner_currency,
                        street: booking.pickup_address,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourroadierentals"
                    }, owner.email);

                    Notifications.send(Notifications.BOOKING_PENDING_RENTER, {
                        name: renter.name,
                        image_url: owner.image_url,
                        item_type: booking.roadie_type,
                        item_name: booking.name + " " + booking.surname,
                        price: booking.renter_price,
                        fee: booking.renter_price * 10 / 100,
                        total_price: booking.renter_price + (booking.renter_price * 10 / 100),
                        currency: booking.renter_currency,
                        street: booking.pickup_address,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourroadiereservations"
                    }, renter.email);
                });
            });
        });
    });
};

/**
 * The owner denied the rental request.
 */
updateToDenied = function(booking, callback) {
    db.query("UPDATE roadie_bookings SET booking_status='denied', owner_response_time=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
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

/**
 * The owner accepted the rental request.
 */
updateToAccepted = function(booking, callback) {
    chargePreAuthorization(booking, function(error) {
        if (error) {
            callback(error);
            return;
        }
        console.log("preauth charged");
        db.query("UPDATE roadie_bookings SET booking_status='accepted', owner_response_time=NOW(), payment_timestamp=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
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
                        item_type: booking.roadie_type,
                        item_name: booking.name + " " + booking.surname,
                        price: booking.renter_price,
                        fee: booking.renter_price * 10 / 100,
                        total_price: booking.renter_price + (booking.renter_price * 10 / 100),
                        currency: booking.renter_currency,
                        street: booking.pickup_address,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        username_owner: owner.name,
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourroadiereservations"
                    }, renter.email);

                    Notifications.send(Notifications.BOOKING_ACCEPTED_OWNER, {
                        name: owner.name,
                        image_url: renter.image_url,
                        item_type: booking.roadie_type,
                        item_name: booking.name + " " + booking.surname,
                        price: booking.owner_price,
                        fee: "-" + (booking.owner_price * 10 / 100),
                        total_price: booking.owner_price - (booking.owner_price * 10 / 100),
                        currency: booking.owner_currency,
                        street: booking.pickup_address,
                        postal_code: booking.pickup_postal_code,
                        city: booking.pickup_city,
                        country: booking.pickup_country,
                        pickup_date: startTime.format("DD/MM/YYYY"),
                        pickup_time: startTime.format("HH:mm"),
                        dropoff_date: endTime.format("DD/MM/YYYY"),
                        dropoff_time: endTime.format("HH:mm"),
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourroadierentals"
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
    db.query("UPDATE roadie_bookings SET booking_status='ended-denied', renter_ended_time=NOW(), owner_ended_time=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
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
        var sql = "UPDATE roadie_bookings SET booking_status=?, ";
        if (status === "ended") {
            sql += "renter_ended_time=NOW(), owner_ended_time=NOW() ";
        } else {
            sql += "renter_ended_time=NOW() ";
        }
        sql += "WHERE id=? LIMIT 1";
        db.query(sql, [status, booking.id], function(error) {
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
                    dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourroadierentals"
                }, owner.email);
            });
        });
    }
};

updateToOwnerReturned = function(booking, callback) {
    var completeUpdate;

    completeUpdate = function(status) {
        var sql = "UPDATE roadie_bookings SET booking_status=?, ";
        if (status === "ended") {
            sql += "renter_ended_time=NOW(), owner_ended_time=NOW() ";
        } else {
            sql += "owner_ended_time=NOW() ";
        }
        sql += "WHERE id=? LIMIT 1";
        db.query(sql, [status, booking.id], function(error) {
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
                    dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourroadiereservations"
                }, renter.email);
            });
        });
    }
};

preAuthorize = function(bookingData, callback) {
    User.getUserWithMangoPayData(bookingData.owner_id, function(error, seller) {
        if (error) {
            callback("Error getting MangoPay data for vehicle owner: " + error);
            return;
        }
        User.getUserWithMangoPayData(bookingData.renter_id, function(error, buyer) {
            if (error) {
                callback("Error getting MangoPay data for vehicle renter: " + error);
                return;
            }
            Payment.preAuthorize(seller, buyer, bookingData, callback);
        });
    });
};

chargePreAuthorization = function(bookingData, callback) {
    User.getUserWithMangoPayData(bookingData.owner_id, function(error, seller) {
        if (error) {
            callback("Error getting MangoPay data for vehicle seller: " + error);
            return;
        }
        User.getUserWithMangoPayData(bookingData.renter_id, function(error, renter) {
            if (error) {
                callback("Error getting MangoPay data for vehicle renter: " + error);
                return;
            }
            bookingData.item_name = bookingData.name + " " + bookingData.surname + ", " + bookingData.roadie_type;
            Payment.chargePreAuthorization(seller, renter, bookingData, callback);
        });
    });
};

endBooking = function(bookingData, callback) {
    User.getUserWithMangoPayData(bookingData.owner_id, function(error, owner) {
        if (error) {
            callback("Error getting MangoPay data for vehicle owner: " + error);
            return;
        }
        bookingData.item_name = bookingData.name + " " + bookingData.surname + " " + bookingData.roadie_type;
        Payment.payOutSeller(owner, bookingData, function(error) {
            if (error) {
                callback(error);
                return;
            }

            db.query("UPDATE roadie_bookings SET payout_time=NOW() WHERE id=? LIMIT 1", [bookingData.id], function() {
                if (error) {
                    callback(error);
                    return;
                }
                callback(null);
            });

            Notifications.send(Notifications.BOOKING_ENDED_OWNER, {}, bookingData.owner_email);
            Notifications.send(Notifications.BOOKING_ENDED_RENTER, {}, bookingData.renter_email);
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
