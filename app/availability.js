/**
 * Defines Sharingear gear availability.
 * @author: Chris Hjorth
 */

var db = require('./database'),
	Moment = require('moment'),
	MomentUtilities = require('./momentutilities');

module.exports = {
	set: set,
	get: get,
	removeInterval: removeInterval,
	//isAvailable: isAvailable,
	setToUnavailableFromStartToEnd: setToUnavailableFromStartToEnd
};

/**
 * @param availability: List of start and end days in the format "YYYY-MM-DD HH:MM:SS".
 */
function set(gearID, availability, callback) {
	//Remove all availability for the gear id
	db.query("DELETE FROM availability WHERE gear_id=?", [gearID], function(error, result) {
		var sql, i, valueArray;
		if(error) {
			callback(error);
			return;
		}
		sql = 'INSERT INTO availability(start, end, gear_id) VALUES ';
		valueArray = [];
		for(i = 0; i < availability.length - 1; i++) {
			sql += '(?, ?, ?), ';
			valueArray.push(availability[i].start, availability[i].end, gearID);
		}
		sql += '(?, ?, ?)';
		valueArray.push(availability[i].start, availability[i].end, gearID);
		db.query(sql, valueArray, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			callback(null);
		});
	});
}

function get(gearID, callback) {
	db.query("SELECT start, end FROM availability WHERE gear_id=?", [gearID], function(error, rows) {
		var availabilityArray, i;
		if(error) {
			callback(error);
			return;
		}
		availabilityArray = [];
		for(i = 0; i < rows.length; i++) {
			console.log('start: ' + rows[i].start);
			availabilityArray.push({
				start: rows[i].start,
				end: rows[i].end
			});
		}
		callback(null, availabilityArray);
	});
}

function removeInterval(gearID, startTime, endTime, callback) {
	//Get availability sorted, add data and then call set
	db.query("SELECT id, start_time, end_time, gear_id FROM availability WHERE gear_id=? ORDER BY start_time DESC", [gearID], function(error, rows) {
		var i;
		if(error) {
			callback('Error selecting availability: ' + error);
			return;
		}
		if(rows.length <= 0) {
			callback(null); //This counts as correct since it is like removing something that was already not there.
			return;
		}
		startMoment = Moment(startTime, 'YYYY-MM-DD HH:mm:ss');
		endMoment = Moment(endMoment, 'YYYY-MM-DD HH:mm:ss');
		//Check if the interval fits in any of the availability intervals
		for(i = 0; i < rows.length; i++) {
			intervalStartMoment = Moment(rows[i].start_time, 'YYYY-MM-DD HH:mm:ss');
			intervalEndMoment = Moment(rows[i].endTime, 'YYYY-MM-DD HH:mm:ss');
			//Interval is the same or include -> delete

			//interval is between availability interval -> 
			/*if(MomentUtilities.isBetweenExclusive(startMoment, intervalStartMoment, intervalEndMoment) === true && MomentUtilities.isBetween(endMoment, intervalStartMoment, intervalEndMoment) === true) {
				rows.splice(i, 0, {
					start_time: endMoment.format('YYYY-MM-DD HH:mm:ss'),
					end_time: rows[i].end_time
				})
				rows[i].end_time = startMoment.format('YYYY-MM-DD HH:mm:ss');
				i++; //Beacuse we inserted an element and we do not need to loop over it
			}
			//interval is including availability interval
			else if(startMoment.isBefore(intervalStartMoment) === true && )
			//interval includes start of availability interval

			//interval includes end of availability interval*/
		}
	});

}

/*function isAvailable(gearID, startTime, endTime, callback) {
	db.query('SELECT id FROM availability WHERE start <= ? AND end >= ? AND gear_id = ? LIMIT 1', [startTime, endTime, gearID], function(error, rows) {
		if(error) {
			callback('Error checking availability: ' + error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, false);
		}
		else {
			callback(null, true);
		}
	});
}*/

/**
 * @assertion: Interval is between an availble interval.
 */
function setToUnavailableFromStartToEnd(gearID, startTime, endTime, callback) {
	console.log('Find availability: ');
	console.log('startTime: ' + startTime);
	console.log('endTime: ' + endTime);
	db.query("SELECT id, start, end FROM availability WHERE start <= ? AND end >= ? AND gear_id = ? LIMIT 1", [startTime, endTime, gearID], function(error, rows) {
		if(error) {
			callback('Error selecting availability: ' + error);
			return;
		}
		if(rows.length <= 0) {
			callback('No availability found for interval.');
			return;
		}
		availableStart = Moment(rows[0].start, 'YYYY-MM-DD HH:mm:ss');
		availableEnd = Moment(rows[0].end, 'YYYY-MM-DD HH:mm:ss');
		startTimeMoment = Moment(startTime, 'YYYY-MM-DD HH:mm:ss');
		endTimeMoment = Moment(endTime, 'YYYY-MM-DD HH:mm:ss');
		if(availableStart.isSame(startTimeMoment, 'day') === true && availableEnd.isSame(endTimeMoment, 'day') === true) {
			db.query("DELETE FROM availability WHERE id=? LIMIT 1", [rows[0].id], function(error, result) {
				if(error) {
					callback('Error deleting availability interval: ' + error);
					return;
				}
				callback(null);
			});
		}
		else if(availableStart.isSame(startTimeMoment, 'day') === true) {
			db.query("UPDATE availability SET end=? WHERE id=? LIMIT 1", [endTime, rows[0].id], function(error, result) {
				if(error) {
					callback('Error updating end value for availability interval: ' + error);
					return;
				}
				callback(null);
			});
		}
		else if(availableEnd.isSame(endTimeMoment, 'day') === true) {
			db.query("UPDATE availability SET start=? WHERE id=? LIMIT 1", [startTime, rows[0].id], function(error, result) {
				if(error) {
					callback('Error updating start value for availability interval: ' + error);
					return;
				}
				callback(null);
			});
		}
		else {
			//In this case the interval is in the middle
			db.query("UPDATE availability SET end=? WHERE id=? LIMIT 1", [startTime, rows[0].id], function(error, result) {
				if(error) {
					callback('Error setting end to start time for availability interval: ' + error);
					return;
				}
				db.query("INSERT INTO availability(start, end, gear_id) VALUES(?, ?, ?)", [endTime, rows[0].end, gearID], function(error, result) {
					if(error) {
						callback('Error inserting new availability after split: ' + error);
						return;
					}
					callback(null);
				});
			});
		}
	});
}