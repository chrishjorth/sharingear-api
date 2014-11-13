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

	preAuthorize;

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

		preAuthorize(renterID, bookingData.cardId, price, bookingData.returnURL, function(error) {
			if(error) {
				callback(error);
				return;
			}
			Availability.removeInterval(bookingData.gear_id, bookingData.start_time, bookingData.end_time, function(error) {
				if(error) {
					callback(error);
					return;
				}
				db.query("INSERT INTO bookings(gear_id, start_time, end_time, renter_id, price) VALUES (?, ?, ?, ?, ?)", booking, function(error, result) {
					if(error) {
						callback("Error inserting booking: " + error);
						return;
					}
					//Set status to pending on gear
					//console.log('Set gear status');
					Gear.setStatus(bookingData.gear_id, "pending", function(error) {
						if(error) {
							callback(error);
							return;
						}
						//console.log('create booking callback');
						callback(null, {
							id: result.insertId,
							gear_id: bookingData.gear_id,
							start_time: bookingData.start_time,
							end_time: bookingData.end_time,
							price: price
						});
					});
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
            callback("No reservations for this user with ID: " + renterID + ".");
            return;
        }
        callback(null, rows);
    });
};

update = function(gearID, bookingID, status, callback) {
	if(status !== "denied" && status !== "accepted") {
		callback("Unacceptable booking status.");
		return;
	}
	db.query("UPDATE bookings SET status=? WHERE id=? LIMIT 1", [status, bookingID], function(error) {
		if(error) {
			callback("Error updating booking status: " + error);
			return;
		}
		if(status === "denied") {
			db.query("SELECT start_time, end_time FROM bookings WHERE id=? LIMIT 1", [bookingID], function(error, rows) {
				if(error) {
					callback("Error selecting booking interval: " + error);
					return;
				}
				if(rows.length <= 0) {
					callback("No booking found for id " + bookingID + ".");
					return;
				}
				Availability.removeInterval(gearID, rows[0].start_time, rows[0].end_time, function(error) {
					if(error) {
						callback(error);
					}
					else {
						callback(null);
					}
				});
			});
		}
		else {
			callback(null);
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

module.exports = {
	create: create,
	readClosest: readClosest,
    readReservationsForUser: readReservationsForUser,
	update: update
};
