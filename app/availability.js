/**
 * Defines Sharingear gear availability.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Moment = require("moment"),
	MomentUtilities = require("./momentutilities"),

	set,
	get,
	removeInterval;


/**
 * @param availability: List of start and end days in the format "YYYY-MM-DD HH:MM:SS".
 */
set = function(gearID, availability, callback) {
	//Remove all availability for the gear id
	//separate the wipe and call here
	db.query("DELETE FROM availability WHERE gear_id=?", [gearID], function(error) {
		var sql, i, valueArray, startMoment, endMoment;
		if(error) {
			callback(error);
			return;
		}
		if (availability.length <= 0) {
			callback(null);
			return;
		}
		sql = "INSERT INTO availability(start_time, end_time, gear_id) VALUES ";
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
	db.query("SELECT start_time, end_time FROM availability WHERE gear_id=?", [gearID], function(error, rows) {
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

removeInterval = function(gearID, startTime, endTime, callback) {
	var Availability = this;
	//Get availability sorted, add data and then call set
	db.query("SELECT id, start_time, end_time, gear_id FROM availability WHERE gear_id=? ORDER BY start_time DESC", [gearID], function(error, rows) {
		var i, startMoment, endMoment, intervalStartMoment, intervalEndMoment, dummyMoment;
		if(error) {
			callback("Error selecting availability: " + error);
			return;
		}
		if(rows.length <= 0) {
			callback(null); //This counts as correct since it is like removing something that was already not there.
			return;
		}
		startMoment = new Moment(startTime, "YYYY-MM-DD HH:mm:ss");
		endMoment = new Moment(endTime, "YYYY-MM-DD HH:mm:ss");
		//Check if the interval fits in any of the availability intervals
		for(i = 0; i < rows.length; i++) {
			intervalStartMoment = new Moment(rows[i].start_time, "YYYY-MM-DD HH:mm:ss");
			intervalEndMoment = new Moment(rows[i].end_time, "YYYY-MM-DD HH:mm:ss");
			//Interval is the same or includes availability interval -> delete
			if(MomentUtilities.isBetween(intervalStartMoment, startMoment, endMoment) === true && MomentUtilities.isBetween(intervalEndMoment, startMoment, endMoment) === true) {
				//Delete the interval
				rows.splice(i, 1);
				i--; //We removed an element and must compensate for the for loop increment
			}
			//interval is between availability interval ->
			else if(MomentUtilities.isBetweenExclusive(startMoment, intervalStartMoment, intervalEndMoment) === true && MomentUtilities.isBetween(endMoment, intervalStartMoment, intervalEndMoment) === true) {
				dummyMoment = new Moment(endMoment);
				dummyMoment.add(1, "days");
				rows.splice(i, 0, {
					start_time: dummyMoment.format("YYYY-MM-DD HH:mm:ss"),
					end_time: intervalEndMoment.format("YYYY-MM-DD HH:mm:ss")

				});
				dummyMoment = new Moment(startMoment);
				dummyMoment.subtract(1, "days");
				//i + 1 because splice insert before i and deletes after i, hence original i just got moved forward 1
				rows[i + 1].end_time = dummyMoment.format("YYYY-MM-DD HH:mm:ss");
				i++; //Beacuse we inserted an element and we do not need to loop over it
			}
			//interval includes start of availability interval
			else if(MomentUtilities.isBetween(startMoment, intervalStartMoment, intervalEndMoment) === true) {
				dummyMoment = new Moment(startMoment);
				dummyMoment.add(1, "days");
				rows[i].start_time = dummyMoment.format("YYYY-MM-DD HH:mm:ss");
			}
			//interval includes end of availability interval
			else if(MomentUtilities.isBetween(endMoment, intervalStartMoment, intervalEndMoment) === true) {
				dummyMoment = new Moment(endMoment);
				dummyMoment.subtract(1, "days");
				rows[i].end_time = endMoment.format("YYYY-MM-DD HH:mm:ss");
			}
		}
		//At this point rows is the new availability set

		Availability.set(gearID, rows, function(error) {
			callback(error);
		});
	});
};

module.exports = {
	set: set,
	get: get,
	removeInterval: removeInterval
};
