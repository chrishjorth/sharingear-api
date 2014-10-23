/**
 * Defines Sharingear booking.
 * @author: Chris Hjorth
 */

var db = require('./database'),
	Gear = require('./gear'),
	Availability = require('./availability');

module.exports = {
	create: create,
	readClosest: readClosest
};

function create(renterID, bookingData, callback) {
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
		Availability.setToUnavailableFromStartToEnd(bookingData.gear_id, bookingData.start_time, bookingData.end_time, function(error) {
			if(error) {
				callback(error);
				return;
			}
			db.query("INSERT INTO bookings(gear_id, start_time, end_time, renter_id, price) VALUES (?, ?, ?, ?, ?)", booking, function(error, result) {
				if(error) {
					callback('Error inserting booking: ' + error);
					return;
				}
				//Set status to pending on gear
				Gear.setStatus(bookingData.gear_id, 'pending', function(error) {
					if(error) {
						callback(error);
						return;
					}
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
}

function readClosest(gearID, callback) {
	db.query("SELECT id, gear_id, MIN(start_time) as start_time, end_time, renter_id, price, booking_status FROM bookings WHERE gear_id=?", [gearID], function(error, rows) {
		if(error) {
			callback('Error selecting closest booking for gear ' + gearID + ': ' + error);
			return;
		}
		if(rows.length <= 0) {
			callback('No bookings for gear with id ' + gearID + '.');
			return;
		}
		callback(null, rows[0]);
	});
}
