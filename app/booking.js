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
 * When a gear status return state is to be set, if it already was in a return state, set it to null. Then change the booking status to ended and do the payout.
 * 
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
	read,
	//readClosest,
	readRentalsForUser,
	readReservationsForUser,
	update,

	preAuthorize,
	chargePreAuthorization,
	endBooking;

create = function(renterID, bookingData, callback) {
	//get gear prices and calculate correct price
	Gear.getPriceAndOwner(bookingData.gear_id, bookingData.start_time, bookingData.end_time, function(error, result) {
		var booking, price, ownerID;
		if(error) {
			callback(error);
			return;
		}
		price = result.price;
		ownerID = result.owner_id;
		booking = [
			bookingData.gear_id,
			bookingData.start_time,
			bookingData.end_time,
			renterID,
			price
		];
		//We have to insert before the preauthorization to get the booking id
		db.query("INSERT INTO bookings(gear_id, start_time, end_time, renter_id, price) VALUES (?, ?, ?, ?, ?)", booking, function(error, result) {
			var url, queryIndex;
			if(error) {
				callback("Error inserting booking: " + error);
				return;
			}
			//Assertion: only returnURLs with #route are valid
			url = bookingData.returnURL.split("#");
			queryIndex = url[0].indexOf("?");
			if(queryIndex < 0) {
				bookingData.returnURL = url[0] + "?booking_id=" + result.insertId + "#" + url[1];
			}
			else {
				bookingData.returnURL = url[0] + "&booking_id=" + result.insertId + "#" + url[1];
			}
			preAuthorize(ownerID, renterID, bookingData.cardId, price, bookingData.returnURL, function(error, preAuthData) {
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
			});
		});
	});
};

read = function(bookingID, callback) {
	db.query("SELECT id, gear_id, start_time, end_time, renter_id, price, booking_status FROM bookings WHERE id=?", [bookingID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No booking found for id.");
			return;
		}
		callback(null, rows[0]);
	});
};

/*readClosest = function(gearID, callback) {
	db.query("SELECT id, gear_id, MIN(start_time) as start_time, end_time, renter_id, price, booking_status FROM bookings WHERE gear_id=? AND booking_status!='ended-denied' AND booking_status!='ended'", [gearID], function(error, rows) {
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
};*/

readRentalsForUser = function(userID, callback) {
	Gear.checkForRentals(userID, function(error) {
		if(error) {
			callback("Error checking gear for rentals: " + error);
			return;
		}
		db.query("SELECT bookings.id AS booking_id, bookings.gear_id AS id, gear.gear_type, gear.subtype, gear.brand, gear.model, gear.images, gear.city, gear.gear_status, gear.owner_id, bookings.start_time, bookings.end_time, bookings.price, bookings.booking_status FROM gear, bookings WHERE gear.id=bookings.gear_id AND gear.owner_id=?", [userID], function(error, rows) {
			if(error) {
				callback("Error reading user rentals: " + error);
				return;
			}
			if(rows.length <= 0) {
				callback(null, []);
			}
			else {
				callback(null, rows);
			}
		});
	});
};

readReservationsForUser = function(renterID, callback){
	Gear.checkForRentals(renterID, function(error) {
		if(error) {
			callback("Error checking gear for rentals: " + error);
			return;
		}
		db.query("SELECT bookings.id AS booking_id, bookings.gear_id AS id, gear.gear_type, gear.subtype, gear.brand, gear.model, gear.images, gear.city, gear.gear_status, gear.owner_id, bookings.start_time, bookings.end_time, bookings.price, bookings.booking_status FROM bookings INNER JOIN gear ON bookings.gear_id = gear.id WHERE bookings.renter_id=?", [renterID], function(error, rows) {
        	if(error) {
            	callback(error);
            	return;
        	}
        	if(rows.length <= 0) {
            	callback(null, []);
        	}
        	else {
        		callback(null, rows);
        	}
    	});
	});
};

update = function(bookingData, callback) {
	var status = bookingData.booking_status,
		bookingID = bookingData.booking_id,
		gearID = bookingData.gear_id;
	if(status !== "pending" && status !== "denied" && status !== "accepted" && status !== "ended-denied" && status !== "owner-returned" && status !== "renter-returned") {
		callback("Unacceptable booking status.");
		return;
	}
	
	db.query("SELECT bookings.gear_id, bookings.renter_id, bookings.start_time, bookings.end_time, bookings.price, bookings.preauth_id, bookings.booking_status, gear.owner_id FROM bookings, gear WHERE bookings.id=? AND bookings.gear_id=? AND gear.id=bookings.gear_id LIMIT 1", [bookingID, gearID], function(error, rows) {
		var completeUpdate;
		if(error) {
			callback("Error selecting booking interval: " + error);
			return;
		}
		if(rows.length <= 0) {
			callback("No booking found for id " + bookingID + ".");
			return;
		}

		completeUpdate = function (status, preAuthID, withTimestamp) {
			var sql = "UPDATE bookings SET booking_status=?, preauth_id=?";
			if(withTimestamp === true) {
				sql += ", payment_timestamp=NOW()";
			}
			sql += " WHERE id=? LIMIT 1";
			db.query(sql, [status, preAuthID, bookingID], function(error) {
				if(error) {
					callback("Error updating booking status: " + error);
					return;
				}
				callback(null, rows[0]);
			});
		};

		if(status === "pending") {
			completeUpdate(status, bookingData.preauth_id, false);
		}
		else if(status === "denied") {
			Availability.removeInterval(rows[0].gear_id, rows[0].start_time, rows[0].end_time, function(error) {
				if(error) {
					callback(error);
					return;
				}
				completeUpdate(status, null, false);
			});
		}
		else if (status === "accepted") {
			chargePreAuthorization(rows[0].owner_id, rows[0].renter_id, rows[0].price, rows[0].preauth_id, function(error) {
				if(error) {
					callback(error);
					return;
				}
				completeUpdate(status, rows[0].preauth_id, true);
			});
		}
		else if(status === "ended-denied") {
			completeUpdate(status, null, false);
		}
		else if(status === "renter-returned" || status === "owner-returned") {
			if((status === "owner-returned" && rows[0].booking_status === "renter-returned") || (status === "renter-returned" && rows[0].booking_status === "owner-returned")) {
				endBooking(rows[0].gear_id, rows[0].price, function(error) {
					if(error) {
						callback(error);
						return;
					}
					completeUpdate("ended", null, false);
				});
			}
			else {
				completeUpdate(status, null, false);
			}
		}
	});
};

preAuthorize = function(sellerID, buyerID, cardID, price, returnURL, callback) {
	User.getMangoPayData(sellerID, function(error, sellerMangoPayData) {
		if(error) {
			callback("Error getting MangoPay data for gear owner: " + error);
			return;
		}
		User.getMangoPayData(buyerID, function(error, buyerMangoPayData) {
			if(error) {
				callback("Error getting MangoPay data for gear renter: " + error);
				return;
			}
			Payment.preAuthorize(sellerMangoPayData, buyerMangoPayData, cardID, price, returnURL, callback);
		});
	});
};

chargePreAuthorization = function(sellerID, renterID, price, preAuthId, callback) {
	User.getMangoPayData(renterID, function(error, sellerMangoPayData) {
		if(error) {
			callback("Error getting MangoPay data for gear seller: " + error);
			return;
		}
		User.getMangoPayData(renterID, function(error, renterMangoPayData) {
			if(error) {
				callback("Error getting MangoPay data for gear renter: " + error);
				return;
			}
			Payment.chargePreAuthorization(sellerMangoPayData, renterMangoPayData, price, preAuthId, callback);
		});
	});
};

endBooking = function(gearID, price, callback) {
	Gear.getOwner(gearID, function(error, ownerID) {
		if(error) {
			callback(error);
			return;
		}
		User.getMangoPayData(ownerID, function(error, ownerMangoPayData) {
			if(error) {
				callback("Error getting MangoPay data for gear owner: " + error);
				return;
			}
			Payment.payOutSeller(ownerMangoPayData, price, function(error) {
				if(error) {
					callback(error);
					return;
				}
				Gear.setStatus(gearID, null, function(error) {
					if(error) {
						callback(error);
						return;
					}
					callback(null);
				});
			});
		});
	});
};

module.exports = {
	create: create,
	read: read,
	//readClosest: readClosest,
	readRentalsForUser: readRentalsForUser,
    readReservationsForUser: readReservationsForUser,
	update: update
};
