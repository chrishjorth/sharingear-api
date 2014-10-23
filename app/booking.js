/**
 * Defines Sharingear booking.
 * @author: Chris Hjorth
 */

var db = require('./database'),
	Gear = require('./gear'),
	Availability = require('./availability');

module.exports = {
	create: create,
	read: read
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

function read(gearID, bookingID, callback) {
	//Fetch earliest pending booking
}