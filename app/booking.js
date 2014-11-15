/**
 * Defines Sharingear booking.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Gear = require("./gear"),
	Availability = require("./availability"),
	User = require("./user"),
	Payment = require("./payment"),

	create,
	readClosest,
	readReservationsForUser,
	update,

	preAuthorize,
	chargePreAuthorization;

create = function(renterID, bookingData, callback) {
	//get gear prices and calculate correct price
	Gear.getPrice(bookingData.gear_id, bookingData.start_time, bookingData.end_time, function(error, price) {
		var booking;
		if(error) {
			callback(error);
			return;
		}
		booking = [
			bookingData.gear_id,
			bookingData.start_time,
			bookingData.end_time,
			renterID,
			price
		];
		Availability.removeInterval(bookingData.gear_id, bookingData.start_time, bookingData.end_time, function(error) {	
			if(error) {
				callback(error);
				return;
			}
			db.query("INSERT INTO bookings(gear_id, start_time, end_time, renter_id, price) VALUES (?, ?, ?, ?, ?)", booking, function(error, result) {
				var url;
				if(error) {
					callback("Error inserting booking: " + error);
					return;
				}
				//Assertion: only returnURLs with #route are valid
				url = bookingData.returnURL.split("#");
				bookingData.returnURL = url[0] + "?booking_id=" + result.insertId + "#" + url[1];
				preAuthorize(renterID, bookingData.cardId, price, bookingData.returnURL, function(error, preAuthData) {
					if(error) {
						callback(error);
						return;
					}
					callback(null, {
						id: result.insertId,
						gear_id: bookingData.gear_id,
						start_time: bookingData.start_time,
						end_time: bookingData.end_time,
						price: price,
						verificationURL: preAuthData.verificationURL
					});
				//Set status to pending on gear
				//console.log('Set gear status');
				/*Gear.setStatus(bookingData.gear_id, "pending", function(error) {
					if(error) {
						callback(error);
						return;
					}
						//console.log('create booking callback');
						
				});*/
				});
			});
		});
	});
};

readClosest = function(gearID, callback) {
	db.query("SELECT id, gear_id, MIN(start_time) as start_time, end_time, renter_id, price, booking_status FROM bookings WHERE gear_id=?", [gearID], function(error, rows) {
		if(error) {
			callback("Error selecting closest booking for gear " + gearID + ": " + error);
			return;
		}
		if(rows.length <= 0) {
			callback("No bookings for gear with id " + gearID + ".");
			return;
		}
		callback(null, rows[0]);
	});
};

readReservationsForUser = function(renterID, callback){
    db.query("SELECT bookings.id, bookings.gear_id, gear.type, gear.subtype, gear.brand, gear.model, gear.images, gear.city, bookings.start_time, bookings.end_time, bookings.price, bookings.booking_status FROM bookings INNER JOIN gear ON bookings.gear_id = gear.id WHERE bookings.renter_id=?", [renterID], function(error, rows) {
        if(error) {
            callback(error);
            return;
        }
        if(rows.length <= 0) {
            callback(null, []);
            return;
        }
        callback(null, rows);
    });
};

//Possible booking statuses: pending, denied, accepted, failed, cancelled
update = function(bookingData, callback) {
	var status = bookingData.booking_status,
		bookingID = bookingData.booking_id,
		gearID = bookingData.gear_id;
	if(status !== "pending" && status !== "denied" && status !== "accepted") {
		callback("Unacceptable booking status.");
		return;
	}
	
	db.query("SELECT renter_id, start_time, end_time, price, preauth_id FROM bookings WHERE id=? LIMIT 1", [bookingID], function(error, rows) {
		var completeUpdate;
		if(error) {
			callback("Error selecting booking interval: " + error);
			return;
		}
		if(rows.length <= 0) {
			callback("No booking found for id " + bookingID + ".");
			return;
		}

		completeUpdate = function (status, preAuthID) {
			db.query("UPDATE bookings SET booking_status=?, preauth_id=? WHERE id=? LIMIT 1", [status, preAuthID, bookingID], function(error) {
				if(error) {
					callback("Error updating booking status: " + error);
					return;
				}
				callback(null, rows[0]);
			});
		};

		if(status === "pending") {
			completeUpdate(status, bookingData.preauth_id);
		}
		else if(status === "denied") {
			Availability.removeInterval(gearID, rows[0].start_time, rows[0].end_time, function(error) {
				if(error) {
					callback(error);
					return;
				}
				completeUpdate(status, null);
			});
		}
		else {
			chargePreAuthorization(rows[0].renter_id, rows[0].price, rows[0].preauth_id, function(error) {
				if(error) {
					callback(error);
					return;
				}
				completeUpdate(status, rows[0].preauth_id);
			});
		}
	});
};

preAuthorize = function(renterID, cardID, price, returnURL, callback) {
	User.getMangoPayData(renterID, function(error, renterMangoPayData) {
		if(error) {
			callback("Error getting MangoPay data for gear renter: " + error);
			return;
		}
		Payment.preAuthorize(renterMangoPayData, cardID, price, returnURL, callback);
	});
};

chargePreAuthorization = function(renterID, price, preAuthId, callback) {
	User.getMangoPayData(renterID, function(error, renterMangoPayData) {
		if(error) {
			callback("Error getting MangoPay data for gear renter: " + error);
			return;
		}
		Payment.chargePreAuthorization(renterMangoPayData, price, preAuthId, callback);
	});
};

module.exports = {
	create: create,
	readClosest: readClosest,
    readReservationsForUser: readReservationsForUser,
	update: update
};
