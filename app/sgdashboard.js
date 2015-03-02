/**
 * Dashboard, platform management and analytics methods.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	config = require("./config"),
	wipeout;

wipeout = function(callback) {
	if(config.isProduction() === true) {
		callback("Seriously!? Wipeout is not allowed in production environment.");
		return;
	}
	if(config.DB_WIPEABLE === false) {
		callback("Wipeout is not allowed.");
		return;
	}
	var sql = "TRUNCATE gear_has_accessories;";
	sql += " TRUNCATE gear_availability;";
	sql += " TRUNCATE gear_bookings;";
	sql += " TRUNCATE gear;";
	sql += " TRUNCATE van_has_accessories;";
	sql += " TRUNCATE van_availability;";
	sql += " TRUNCATE vans;";
	sql += " TRUNCATE wallets;";
	sql += " TRUNCATE users;";
	db.query(sql, [], function(error, result) {
		if(error) {
			callback(error);
			return;
		}
		callback(null);
	});
};

module.exports = {
	wipeout: wipeout
};