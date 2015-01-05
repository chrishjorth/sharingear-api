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

	create,
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
		var booking, price;
		if(error) {
			callback(error);
			return;
		}
		price = Gear.getPrice(gear.price_a, gear.price_b, gear.price_c, bookingData.start_time, bookingData.end_time);
		booking = [
			bookingData.gear_id,
			bookingData.start_time,
			bookingData.end_time,
			renterID,
			gear.owner_id,
			price,
			"DKK",
			gear.gear_type,
			gear.subtype,
			gear.model,
			gear.brand,
			gear.address,
			gear.postal_code,
			gear.pickup_city,
			gear.pickup_country
		];
		//We have to insert before the preauthorization to get the booking id
		db.query("INSERT INTO bookings(gear_id, start_time, end_time, renter_id, owner_id, price, currency, gear_type, gear_subtype, gear_model, gear_brand, pickup_street, pickup_postal_code, pickup_city, pickup_country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", booking, function(error, result) {
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
			preAuthorize(gear.owner_id, renterID, bookingData.cardId, price, bookingData.returnURL, function(error, preAuthData) {
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
	db.query("SELECT id, gear_id, start_time, end_time, renter_id, owner_id, price, currency, payment_timestamp, payin_time, payout_time, booking_status, gear_type, gear_subtype, gear_model, gear_brand, pickup_street, pickup_postal_code, pickup_city, pickup_country FROM bookings WHERE id=?", [bookingID], function(error, rows) {
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

readRentalsForUser = function(userID, callback) {
	Gear.checkForRentals(userID, function(error) {
		if(error) {
			callback("Error checking gear for rentals: " + error);
			return;
		}
		db.query("SELECT bookings.id AS booking_id, bookings.gear_id AS id, gear_types.gear_type, gear_subtypes.subtype, gear_brands.name AS brand, gear.model, gear.images, gear.city, gear.gear_status, gear.owner_id, bookings.start_time, bookings.end_time, bookings.price, bookings.booking_status FROM gear, bookings, gear_types, gear_subtypes, gear_brands WHERE gear.id=bookings.gear_id AND gear.owner_id=? AND gear_types.id=gear.gear_type AND gear_subtypes.id=gear.subtype AND gear_brands.id=gear.brand;", [userID], function(error, rows) {
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
		db.query("SELECT bookings.id AS booking_id, bookings.gear_id AS id, gear_types.gear_type, gear_subtypes.subtype, gear_brands.name AS brand, gear.model, gear.images, gear.city, gear.gear_status, gear.owner_id, bookings.start_time, bookings.end_time, bookings.price, bookings.booking_status FROM gear, bookings, gear_types, gear_subtypes, gear_brands WHERE bookings.gear_id = gear.id AND bookings.renter_id=? AND gear_types.id=gear.gear_type AND gear_subtypes.id=gear.subtype AND gear_brands.id=gear.brand;", [renterID], function(error, rows) {
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
		bookingID = bookingData.booking_id;
	if(status !== "pending" && status !== "denied" && status !== "accepted" && status !== "ended-denied" && status !== "owner-returned" && status !== "renter-returned") {
		callback("Unacceptable booking status.");
		return;
	}

	this.read(bookingID, function(error, booking) {
		if(error) {
			callback("Error selecting booking interval: " + error);
			return;
		}

		switch(status) {
			case "pending":
				updateToPending(booking, bookingData.preauth_id, callback);
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

updateToPending = function(booking, preAuthID, callback) {
	//Check that the preauthorization status is waiting
	Payment.getPreauthorizationStatus(preAuthID, function(error, preauthStatus) {
		if(error) {
			callback("Error checking preauthorization status: " + error);
			return;
		}
		console.log("preauthStatus: " + preauthStatus);
		if(preauthStatus !== "WAITING") {
			callback("Error preauthorizing payment.");
			return;
		}
		db.query("UPDATE bookings SET booking_status='pending', preauth_id=? WHERE id=? LIMIT 1", [preAuthID, booking.id], function(error) {
			if(error) {
				callback("Error updating booking status: " + error);
				return;
			}
			booking.booking_status = "pending";
			callback(null, booking);

			User.readUser(booking.owner_id, function(error, owner) {
				var startTime, endTime;
				if(error) {
					console.log("Error sending notification to owner on booking update to pending.");
					return;
				}
				startTime = new Moment(booking.start_time, "YYYY-MM-DD HH:mm:ss");
				endTime = new Moment(booking.end_time, "YYYY-MM-DD HH:mm:ss");
				Notifications.send(Notifications.BOOKING_PENDING_OWNER, {
					name: owner.name,
					image_url: owner.image_url,
					gear_type: booking.gear_type,
					brand: booking.gear_brand,
					model: booking.gear_model,
					subtype: booking.gear_subtype,
					price: booking.price,
					currency: booking.currency,
					street: booking.pickup_street,
					postal_code: booking.pickup_postal_code,
					city: booking.pickup_city,
					country: booking.pickup_country,
					pickup_date: startTime.format("DD/MM/YYYY"),
					pickup_time: startTime.format("HH:mm"),
					dropoff_date: endTime.format("DD/MM/YYYY"),
					dropoff_time: endTime.format("HH:mm")
				}, owner.id);
			});

			User.readUser(booking.renter_id, function(error, renter) {
				var startTime, endTime;
				if(error) {
					console.log("Error sending notification to renter on booking update to pending.");
					return;
				}
				startTime = new Moment(booking.start_time, "YYYY-MM-DD HH:mm:ss");
				endTime = new Moment(booking.end_time, "YYYY-MM-DD HH:mm:ss");
				Notifications.send(Notifications.BOOKING_PENDING_OWNER, {
					name: renter.name,
					image_url: renter.image_url,
					gear_type: booking.gear_type,
					brand: booking.gear_brand,
					model: booking.gear_model,
					subtype: booking.gear_subtype,
					price: booking.price,
					currency: booking.currency,
					street: booking.pickup_street,
					postal_code: booking.pickup_postal_code,
					city: booking.pickup_city,
					country: booking.pickup_country,
					pickup_date: startTime.format("DD/MM/YYYY"),
					pickup_time: startTime.format("HH:mm"),
					dropoff_date: endTime.format("DD/MM/YYYY"),
					dropoff_time: endTime.format("HH:mm")
				}, renter.id);
			});
		});
	});
};

updateToDenied = function(booking, callback) {
	db.query("UPDATE bookings SET booking_status='denied' WHERE id=? LIMIT 1", [booking.id], function(error) {
		if(error) {
			callback("Error updating booking status: " + error);
			return;
		}
		callback(null, booking);

		User.readUser(booking.renter_id, function(error, renter) {
			if(error) {
				console.log("Error sending notification to renter on booking update to denied.");
				return;
			}
			Notifications.send(Notifications.BOOKING_DENIED, {

			}, renter.id);
		});
	});
};

updateToAccepted = function(booking, callback) {
	chargePreAuthorization(booking.owner_id, booking.renter_id, booking.gear_id, booking.price, booking.preauth_id, function(error) {
		if(error) {
			callback(error);
			return;
		}
		db.query("UPDATE bookings SET booking_status='accepted', payment_timestamp=NOW() WHERE id=? LIMIT 1", [booking.id], function(error) {
			if(error) {
				callback(error);
				return;
			}
			callback(null, booking);

			User.readUser(booking.renter_id, function(error, renter) {
				var startTime, endTime;
				if(error) {
					console.log("Error sending notification to renter on booking update to accepted.");
					return;
				}
				startTime = new Moment(booking.start_time, "YYYY-MM-DD HH:mm:ss");
				endTime = new Moment(booking.end_time, "YYYY-MM-DD HH:mm:ss");
				Notifications.send(Notifications.BOOKING_ACCEPTED_RENTER, {
					name: renter.name,
					image_url: renter.image_url,
					gear_type: booking.gear_type,
					brand: booking.gear_brand,
					model: booking.gear_model,
					subtype: booking.gear_subtype,
					price: booking.price,
					currency: booking.currency,
					street: booking.pickup_street,
					postal_code: booking.pickup_postal_code,
					city: booking.pickup_city,
					country: booking.pickup_country,
					pickup_date: startTime.format("DD/MM/YYYY"),
					pickup_time: startTime.format("HH:mm"),
					dropoff_date: endTime.format("DD/MM/YYYY"),
					dropoff_time: endTime.format("HH:mm")
				}, renter.id);
			});

			User.readUser(booking.owner_id, function(error, owner) {
				var startTime, endTime;
				if(error) {
					console.log("Error sending notification to owner on booking update to accepted.");
					return;
				}
				startTime = new Moment(booking.start_time, "YYYY-MM-DD HH:mm:ss");
				endTime = new Moment(booking.end_time, "YYYY-MM-DD HH:mm:ss");
				Notifications.send(Notifications.BOOKING_ACCEPTED_OWNER, {
					name: owner.name,
					image_url: owner.image_url,
					gear_type: booking.gear_type,
					brand: booking.gear_brand,
					model: booking.gear_model,
					subtype: booking.gear_subtype,
					price: booking.price,
					currency: booking.currency,
					street: booking.pickup_street,
					postal_code: booking.pickup_postal_code,
					city: booking.pickup_city,
					country: booking.pickup_country,
					pickup_date: startTime.format("DD/MM/YYYY"),
					pickup_time: startTime.format("HH:mm"),
					dropoff_date: endTime.format("DD/MM/YYYY"),
					dropoff_time: endTime.format("HH:mm")
				}, owner.id);
			});
		});
	});
};

updateToEndedDenied = function(booking, callback) {
	db.query("UPDATE bookings SET booking_status='ended-denied' WHERE id=? LIMIT 1", [booking.id], function(error) {
		if(error) {
			callback("Error updating booking status: " + error);
			return;
		}
		callback(null, booking);
	});
};

updateToRenterReturned = function(booking, callback) {
	var completeUpdate;

	completeUpdate = function(status) {
		db.query("UPDATE bookings SET booking_status=? WHERE id=? LIMIT 1", [status, booking.id], function(error) {
			if(error) {
				callback("Error updating booking status: " + error);
				return;
			}
			callback(null, booking);
		});
	};

	if(booking.booking_status === "owner-returned") {
		endBooking(booking, function(error) {
			if(error) {
				callback(error);
				return;
			}
			completeUpdate("ended");
		});
	}
	else {
		completeUpdate("renter-returned");

		User.readUser(booking.owner_id, function(error, owner) {
			if(error) {
				console.log("Error getting owner for notification to renter on booking update to renter-returned: " + error);
				return;
			}
			User.readUser(booking.renter_id, function(error, renter) {
				if(error) {
					console.log("Error getting renter for notification to renter on booking update to renter-returned: " + error);
					return;
				}
				Notifications.send(Notifications.BOOKING_RENTER_RETURNED, {
					name: renter.name,
					username: owner.name + " " + owner.surname
				}, renter.id);
			});
		});
	}
};

updateToOwnerReturned = function(booking, callback) {
	var completeUpdate;

	completeUpdate = function(status) {
		db.query("UPDATE bookings SET booking_status=? WHERE id=? LIMIT 1", [status, booking.id], function(error) {
			if(error) {
				callback("Error updating booking status: " + error);
				return;
			}
			callback(null, booking);
		});
	};

	if(booking.booking_status === "renter-returned") {
		endBooking(booking, function(error) {
			if(error) {
				callback(error);
				return;
			}
			completeUpdate("ended");
		});
	}
	else {
		completeUpdate("owner-returned");

		User.readUser(booking.renter_id, function(error, renter) {
			if(error) {
				console.log("Error getting renter for notification to owner on booking update to owner-returned: " + error);
				return;
			}
			User.readUser(booking.owner_id, function(error, owner) {
				if(error) {
					console.log("Error getting owner for notification to owner on booking update to owner-returned: " + error);
					return;
				}
				Notifications.send(Notifications.BOOKING_OWNER_RETURNED, {
					name: owner.name,
					username: renter.name + " " + renter.surname
				}, owner.id);
			});
		});
	}
};

preAuthorize = function(sellerID, buyerID, cardID, price, returnURL, callback) {
	User.getUserWithMangoPayData(sellerID, function(error, seller) {
		if(error) {
			callback("Error getting MangoPay data for gear owner: " + error);
			return;
		}
		User.getUserWithMangoPayData(buyerID, function(error, buyer) {
			if(error) {
				callback("Error getting MangoPay data for gear renter: " + error);
				return;
			}
			Payment.preAuthorize(seller, buyer, cardID, price, returnURL, callback);
		});
	});
};

chargePreAuthorization = function(sellerID, renterID, gearID, price, preAuthId, callback) {
	User.getUserWithMangoPayData(renterID, function(error, seller) {
		if(error) {
			callback("Error getting MangoPay data for gear seller: " + error);
			return;
		}
		User.getUserWithMangoPayData(renterID, function(error, renter) {
			if(error) {
				callback("Error getting MangoPay data for gear renter: " + error);
				return;
			}
			Payment.chargePreAuthorization(seller, renter, gearID, price, preAuthId, callback);
		});
	});
};

endBooking = function(booking, callback) {
	User.getUserWithMangoPayData(booking.owner_id, function(error, owner) {
		if(error) {
			callback("Error getting MangoPay data for gear owner: " + error);
			return;
		}
		Payment.payOutSeller(owner, booking.gear_id, booking.price, function(error) {
			if(error) {
				callback(error);
				return;
			}
			Gear.setStatus(booking.gear_id, null, function(error) {
				if(error) {
					callback(error);
					return;
				}
				callback(null);

				Notifications.send(Notifications.BOOKING_ENDED_OWNER, {}, bookingData.owner_id);
				Notifications.send(Notifications.BOOKING_ENDED_RENTER, {}, bookingData.renter_id);
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
