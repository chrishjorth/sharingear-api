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

var Moment = require("moment-timezone"),
    db = require("./database"),
    Vans = require("./vans"),
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
    Vans.readVanWithID(bookingData.van_id, function(error, van) {
        if (error) {
            callback(error);
            return;
        }
        User.readCompleteUsers([renterID, van.owner_id], function(error, users) {
            var renterData, ownerData;
            if (error) {
                callback(error);
                return;
            }
            renterData = users[0];
            ownerData = users[1];

            Localization.convertPrices([van.price_a, van.price_b, van.price_c], van.currency, renterData.currency, function(error, convertedPrices) {
                var renter_price, owner_price;
                if (error) {
                    callback(error);
                    return;
                }
                renter_price = Vans.getPrice(Math.ceil(convertedPrices[0]), Math.ceil(convertedPrices[1]), Math.ceil(convertedPrices[2]), bookingData.start_time, bookingData.end_time);
                owner_price = Vans.getPrice(van.price_a, van.price_b, van.price_c, bookingData.start_time, bookingData.end_time);

                Payment.getUserWalletsForCurrency([renterData.mangopay_id, ownerData.mangopay_id], renterData.currency, function(error, wallets) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    bookingData = {
                        van_id: van.id,
                        van_type: van.van_type,
                        van_model: van.model,
                        price_a: van.price_a,
                        price_b: van.price_b,
                        price_c: van.price_c,
                        start_time: bookingData.start_time,
                        end_time: bookingData.end_time,
                        owner_id: van.owner_id,
                        owner_name: ownerData.name,
                        owner_surname: ownerData.surname,
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
                        renter_name: renterData.name,
                        renter_surname: renterData.surname,
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
        bookingData.van_id,
        bookingData.van_type,
        bookingData.van_model,
        bookingData.price_a,
        bookingData.price_b,
        bookingData.price_c,
        bookingData.start_time,
        bookingData.end_time,
        bookingData.owner_id,
        bookingData.owner_name,
        bookingData.owner_surname,
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
        bookingData.renter_surname,
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
        bookingData.pickup_country,
    ];

    sql = "INSERT INTO van_bookings(van_id, van_type, van_model, price_a, price_b, price_c, start_time, end_time,";
    sql += "owner_id, owner_name, owner_surname, owner_email, owner_phone, owner_address, owner_postal_code, owner_city, owner_country, owner_vatnum, owner_pp_id, owner_bank_id,";
    sql += "renter_id, renter_name, renter_surname, renter_email, renter_phone, renter_address, renter_postal_code, renter_city, renter_country, renter_vatnum, renter_pp_id,";
    sql += "owner_currency, owner_wallet_id, owner_price, owner_price_vat, owner_fee, owner_fee_vat, renter_currency, renter_wallet_id, renter_price, renter_price_vat, renter_fee, renter_fee_vat,";
    sql += "pickup_address, pickup_postal_code, pickup_city, pickup_country, request_time) VALUES ";
    sql += "(?, ?, ?, ?, ?, ?, ?, ?, ";
    sql += "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ";
    sql += "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ";
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
                van_id: bookingData.van_id,
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
    db.query("SELECT id, van_id, van_type, van_model, price_a, price_b, price_c, start_time, end_time, owner_id, owner_name, owner_surname, owner_email, owner_phone, owner_address, owner_city, owner_postal_code, owner_country, owner_vat_num, renter_id, renter_name, renter_surname, renter_email, renter_phone, renter_address, renter_city, renter_postal_code, renter_country, renter_vat_num, owner_currency, owner_price, owner_price_vat, owner_fee, owner_fee_vat, renter_currency, renter_price, renter_price_vat, renter_fee, renter_fee_vat, pickup_address, pickup_city, pickup_postal_code, pickup_country, booking_status FROM van_bookings WHERE id=?", [bookingID], function(error, rows) {
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
    db.query("SELECT van_bookings.id AS booking_id, van_bookings.van_id AS id, van_types.van_type, vans.model, vans.images, vans.city, vans.owner_id, van_bookings.start_time, van_bookings.end_time, van_bookings.renter_price, van_bookings.renter_currency, van_bookings.owner_price, van_bookings.owner_currency, van_bookings.booking_status FROM vans, van_bookings, van_types WHERE vans.id=van_bookings.van_id AND vans.owner_id=? AND van_types.id=vans.van_type;", [userID], function(error, rows) {
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
    db.query("SELECT van_bookings.id AS booking_id, van_bookings.van_id AS id, van_types.van_type, vans.model, vans.images, vans.city, vans.owner_id, van_bookings.start_time, van_bookings.end_time, van_bookings.renter_price, van_bookings.renter_currency, van_bookings.owner_price, van_bookings.owner_currency, van_bookings.booking_status FROM vans, van_bookings, van_types WHERE van_bookings.van_id = vans.id AND van_bookings.renter_id=? AND van_types.id=vans.van_type;", [renterID], function(error, rows) {
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
        db.query("UPDATE van_bookings SET booking_status='pending', preauth_id=? WHERE id=? LIMIT 1", [booking.preauth_id, booking.id], function(error) {
            if (error) {
                callback("Error updating booking status: " + error);
                return;
            }
            booking.booking_status = "pending";
            callback(null, booking);

            User.readCompleteUsers([booking.owner_id, booking.renter_id], function(error, users) {
                var owner, renter;
                if (error) {
                    console.log("Error sending notification on booking update to pending. Unable to get owner data.");
                    return;
                }
                owner = users[0];
                renter = users[1];

                Vans.getImageURL(booking.van_id, function(error, imageURL) {
                    var ownerStartTime, ownerEndTime, renterStartTime, renterEndTime;
                    if (error) {
                        console.log("Error sending notification on booking update to pending. Unable to get renter data.");
                        return;
                    }
                    ownerStartTime = new Moment.tz(booking.start_time, "YYYY-MM-DD HH:mm:ss", owner.time_zone);
                    ownerEndTime = new Moment.tz(booking.end_time, "YYYY-MM-DD HH:mm:ss", owner.time_zone);
                    renterStartTime = new Moment.tz(booking.start_time, "YYYY-MM-DD HH:mm:ss", renter.time_zone);
                    renterEndTime = new Moment.tz(booking.end_time, "YYYY-MM-DD HH:mm:ss", renter.time_zone);

                    Notifications.send(Notifications.OWNER_1_REQUEST, {
                        name: owner.name,
                        renter_image_url: renter.image_url,
                        item_type: booking.van_type,
                        item_name: booking.van_model,
                        pickup_address: booking.pickup_address + ", " + booking.pickup_postal_code + " " + booking.pickup_city + ", " + booking.pickup_country,
                        pickup_date: ownerStartTime.format("DD/MM/YYYY"),
                        pickup_time: ownerStartTime.format("HH:mm"),
                        delivery_date: ownerEndTime.format("DD/MM/YYYY"),
                        delivery_time: ownerEndTime.format("HH:mm"),
                        item_image_url: imageURL,
                        price: booking.owner_price,
                        fee: (booking.owner_price / 100 * booking.owner_fee),
                        total: booking.owner_price - (booking.owner_price / 100 * booking.owner_fee),
                        currency: booking.owner_currency,
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourvanrentals"
                    }, owner.email);

                    Notifications.send(Notifications.RENTER_1_RESERVATION, {
                        renter_name: renter.name,
                        owner_name: owner.name,
                        owner_surname: owner.surname,
                        owner_image_url: owner.image_url,
                        pickup_date: renterStartTime.format("DD/MM/YYYY"),
                        pickup_time: renterStartTime.format("HH:mm"),
                        delivery_date: renterEndTime.format("DD/MM/YYYY"),
                        delivery_time: renterEndTime.format("HH:mm"),
                        item_type: booking.van_type,
                        item_name: booking.van_model,
                        pickup_postal_code: booking.pickup_postal_code,
                        pickup_city: booking.pickup_city,
                        pickup_country: booking.pickup_country,
                        item_image_url: imageURL,
                        price: booking.owner_price,
                        fee: (booking.owner_price / 100 * booking.renter_fee),
                        total: booking.owner_price + (booking.owner_price / 100 * booking.renter_fee),
                        currency: booking.owner_currency,
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourvanreservations"
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
    db.query("UPDATE van_bookings SET booking_status='denied', owner_response_time=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
        if (error) {
            callback("Error updating booking status: " + error);
            return;
        }
        callback(null, booking);

        User.readCompleteUsers([booking.owner_id, booking.renter_id], function(error, users) {
            var owner, renter;
            if (error) {
                console.log("Error sending notification on booking update to pending. Unable to get owner data.");
                return;
            }
            owner = users[0];
            renter = users[1];

            Vans.getImageURL(booking.van_id, function(error, imageURL) {
                var ownerStartTime, ownerEndTime, renterStartTime, renterEndTime;
                if (error) {
                    console.log("Error sending notification to renter on booking update to denied.");
                    return;
                }
                ownerStartTime = new Moment.tz(booking.start_time, "YYYY-MM-DD HH:mm:ss", owner.time_zone);
                ownerEndTime = new Moment.tz(booking.end_time, "YYYY-MM-DD HH:mm:ss", owner.time_zone);
                renterStartTime = new Moment.tz(booking.start_time, "YYYY-MM-DD HH:mm:ss", renter.time_zone);
                renterEndTime = new Moment.tz(booking.end_time, "YYYY-MM-DD HH:mm:ss", renter.time_zone);

                Notifications.send(Notifications.OWNER_DENIED, {
                    name: booking.owner_name,
                    pickup_date: ownerStartTime.format("DD/MM/YYYY"),
                    pickup_time: ownerStartTime.format("HH:mm"),
                    delivery_date: ownerEndTime.format("DD/MM/YYYY"),
                    delivery_time: ownerEndTime.format("HH:mm"),
                    item_type: booking.van_type,
                    item_name: booking.van_model,
                    pickup_address: booking.pickup_address + ", " + booking.pickup_postal_code + " " + booking.pickup_city + ", " + booking.pickup_country,
                    item_image_url: imageURL,
                    price: booking.owner_price,
                    fee: "-" + (booking.owner_price / 100 * booking.owner_fee),
                    total: booking.owner_price - (booking.owner_price / 100 * booking.owner_fee),
                    currency: booking.owner_currency
                }, booking.owner_email);

                Notifications.send(Notifications.RENTER_DENIED, {
                    renter_name: booking.renter_name,
                    owner_name: booking.owner_name,
                    owner_surname: booking.owner_surname,
                    owner_image_url: owner.image_url,
                    pickup_date: renterStartTime.format("DD/MM/YYYY"),
                    pickup_time: renterStartTime.format("HH:mm"),
                    delivery_date: renterEndTime.format("DD/MM/YYYY"),
                    delivery_time: renterEndTime.format("HH:mm"),
                    item_type: booking.van_type,
                    item_name: booking.van_model,
                    pickup_postal_code: booking.pickup_postal_code,
                    pickup_city: booking.pickup_city,
                    pickup_country: booking.pickup_country,
                    item_image_url: imageURL,
                    price: booking.owner_price,
                    fee: (booking.owner_price / 100 * booking.renter_fee),
                    total: booking.owner_price + (booking.owner_price / 100 * booking.renter_fee),
                    currency: booking.owner_currency
                }, booking.renter_email);
            });
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
        db.query("UPDATE van_bookings SET booking_status='accepted', owner_response_time=NOW(), payment_timestamp=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
            if (error) {
                callback(error);
                return;
            }
            callback(null, booking);

            User.readCompleteUsers([booking.owner_id, booking.renter_id], function(error, users) {
                var owner, renter;
                if (error) {
                    console.log("Error sending notifications on booking update to accepted. Unable to get renter data.");
                    return;
                }
                owner = users[0];
                renter = users[1];

                Vans.getImageURL(booking.van_id, function(error, imageURL) {
                    var ownerStartTime, ownerEndTime, renterStartTime, renterEndTime, paymentTime;
                    if (error) {
                        console.log("Error sending notifications on booking update to accepted. Unable to get owner data.");
                        return;
                    }
                    ownerStartTime = new Moment.tz(booking.start_time, "YYYY-MM-DD HH:mm:ss", owner.time_zone);
                    ownerEndTime = new Moment.tz(booking.end_time, "YYYY-MM-DD HH:mm:ss", owner.time_zone);
                    renterStartTime = new Moment.tz(booking.start_time, "YYYY-MM-DD HH:mm:ss", renter.time_zone);
                    renterEndTime = new Moment.tz(booking.end_time, "YYYY-MM-DD HH:mm:ss", renter.time_zone);

                    paymentTime = new Moment.tz(renter.time_zone);

                    Notifications.send(Notifications.RENTER_2_ACCEPTANCE, {
                        renter_name: booking.renter_name,
                        owner_name: booking.owner_name,
                        owner_surname: booking.owner_surname,
                        item_type: booking.van_type,
                        item_name: booking.van_model,
                        owner_image_url: owner.image_url,
                        pickup_date: renterStartTime.format("DD/MM/YYYY"),
                        pickup_time: renterStartTime.format("HH:mm"),
                        delivery_date: renterEndTime.format("DD/MM/YYYY"),
                        delivery_time: renterEndTime.format("HH:mm"),
                        pickup_address: booking.pickup_address + ", " + booking.pickup_postal_code + " " + booking.pickup_city + ", " + booking.pickup_country,
                        item_image_url: imageURL,
                        price: booking.owner_price,
                        fee: (booking.owner_price / 100 * booking.renter_fee),
                        total: booking.owner_price + (booking.owner_price / 100 * booking.renter_fee),
                        currency: booking.renter_currency,
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourvanreservations"
                    }, renter.email);

                    Notifications.send(Notifications.OWNER_2_ACCEPTANCE, {
                        name: owner.name,
                        item_type: booking.van_type,
                        item_name: booking.van_model,
                        pickup_address: booking.pickup_address + ", " + booking.pickup_postal_code + " " + booking.pickup_city + ", " + booking.pickup_country,
                        pickup_date: ownerStartTime.format("DD/MM/YYYY"),
                        pickup_time: ownerStartTime.format("HH:mm"),
                        delivery_date: ownerEndTime.format("DD/MM/YYYY"),
                        delivery_time: ownerEndTime.format("HH:mm"),
                        item_image_url: imageURL,
                        price: booking.owner_price,
                        fee: "-" + (booking.owner_price / 100 * booking.owner_fee),
                        total: booking.owner_price - (booking.owner_price / 100 * booking.owner_fee),
                        currency: booking.owner_currency,
                        dashboard_link: "https://" + Config.VALID_IMAGE_HOST + "/#dashboard/yourvanrentals"
                    }, owner.email);

                    Notifications.send(Notifications.RENTER_RECEIPT, {
                        name: booking.renter_name,
                        item_type: booking.van_type,
                        item_name: booking.van_model,
                        pickup_date: renterStartTime.format("DD/MM/YYYY"),
                        pickup_time: renterStartTime.format("HH:mm"),
                        delivery_date: renterEndTime.format("DD/MM/YYYY"),
                        delivery_time: renterEndTime.format("HH:mm"),
                        pickup_address: booking.pickup_address + ", " + booking.pickup_postal_code + " " + booking.pickup_city + ", " + booking.pickup_country,
                        price: booking.owner_price,
                        fee: (booking.owner_price / 100 * booking.renter_fee),
                        total: booking.owner_price + (booking.owner_price / 100 * booking.renter_fee),
                        currency: booking.renter_currency,
                        surname: booking.renter_surname,
                        address: booking.renter_address,
                        postal_code: booking.renter_postal_code,
                        city: booking.renter_city,
                        country: booking.renter_country,
                        payment_date: paymentTime.format("DD/MM/YYYY HH:mm"),
                    }, renter.email);
                });
            });
        });
    });
};

updateToEndedDenied = function(booking, callback) {
    db.query("UPDATE van_bookings SET booking_status='ended-denied', renter_ended_time=NOW(), owner_ended_time=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
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
        var sql = "UPDATE van_bookings SET booking_status=?, ";
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
    }
};

updateToOwnerReturned = function(booking, callback) {
    var completeUpdate;

    completeUpdate = function(status) {
        var sql = "UPDATE van_bookings SET booking_status=?, ";
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
            bookingData.item_name = bookingData.van_type + " " + bookingData.van_model;
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
        bookingData.item_name = bookingData.van_type + " " + bookingData.van_model;
        Payment.payOutSeller(owner, bookingData, function(error) {
            if (error) {
                callback(error);
                return;
            }

            db.query("UPDATE van_bookings SET payout_time=NOW() WHERE id=? LIMIT 1", [bookingData.id], function() {
                if (error) {
                    callback(error);
                    return;
                }
                callback(null);
            });
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
