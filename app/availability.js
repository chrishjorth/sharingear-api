/**
 * Defines Sharingear gear availability.
 * @author: Chris Hjorth
 */

var db = require('./database');

module.exports = {
	set: set,
	get: get
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