/**
 * Defines Sharingear gear availability.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Moment = require("moment"),

	set,
	get;


/**
 * @param availability: List of start and end days in the format "YYYY-MM-DD HH:MM:SS".
 */
set = function(gearID, availability, callback) {
	//Remove all availability for the gear id
	//separate the wipe and call here
	db.query("DELETE FROM gear_availability WHERE gear_id=?", [gearID], function(error) {
		var sql, i, valueArray, startMoment, endMoment;
		if(error) {
			callback(error);
			return;
		}
		if (availability.length <= 0) {
			callback(null);
			return;
		}
		sql = "INSERT INTO gear_availability(start_time, end_time, gear_id) VALUES ";
		valueArray = [];
		for(i = 0; i < availability.length - 1; i++) {
			if(!availability[i].start_time || !availability[i].end_time) {
				callback("Bad parameters in availability array.");
				return;
			}
			startMoment = new Moment(availability[i].start_time);
			endMoment = new Moment(availability[i].end_time);
			if(startMoment.isValid() === false || endMoment.isValid() === false) {
				callback("Invalid date in availability array.");
				return;
			}
			sql += "(?, ?, ?), ";
			valueArray.push(availability[i].start_time, availability[i].end_time, gearID);
		}
		sql += "(?, ?, ?)";
		valueArray.push(availability[i].start_time, availability[i].end_time, gearID);
		db.query(sql, valueArray, function(error) {
			if(error) {
				callback(error);
				return;
			}
			callback(null);
		});
	});
};

get = function(gearID, callback) {
	db.query("SELECT start_time, end_time FROM gear_availability WHERE gear_id=?", [gearID], function(error, rows) {
		var availabilityArray, i;
		if(error) {
			callback(error);
			return;
		}
		availabilityArray = [];
		for(i = 0; i < rows.length; i++) {
			availabilityArray.push({
				start: rows[i].start_time,
				end: rows[i].end_time
			});
		}
		callback(null, availabilityArray);
	});
};

module.exports = {
	set: set,
	get: get
};
