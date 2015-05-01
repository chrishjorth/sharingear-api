/**
 * Database handling.
 * @author: Chris Hjorth
 */
/* !TODO: Handle server disconnects */

/*jslint node: true */
"use strict";

var mysql = require("mysql"),
	Config = require("./config"),
	sharingearPool,
	sphinxPool,

	query,
	search;

sharingearPool = mysql.createPool({
	host: Config.MYSQL_URL,
	port: 3306,
	user: "root",
	password: "20mircea14chris",
	database: "sharingear",
	supportBigNumbers: true, //Required for working with Facebook IDs stored as bigint.
	multipleStatements: true, //Required for Minus operation from dynamic data set, which requires temp table
	dateStrings: true,
	acquireTimeout: 20000, //Default is 10000, we try with double to avoid occasional PROTOCOL_SEQUENCE_TIMEOUT errors
	//connectTimeout: 60000, //Outcomment when not debugging with node inspector
	ssl: {
		ca: Config.MYSQL_CA,
		cert: Config.MYSQL_CERT,
		key: Config.MYSQL_KEY
	}
});

sphinxPool = mysql.createPool({
	host: Config.SPHINX_URL,
	port: 9306
});

query = function(queryString, paramArray, callback) {
	sharingearPool.getConnection(function(error, connection) {
		if(error) {
			console.error("Error opening database connection.");
			callback(error);
			return;
		}
		connection.query(queryString, paramArray, function(error, rows) {
			if(error) {
				console.error("Error running query: " + queryString + ". " + error.code);
			}
			callback(error, rows);
			connection.destroy();
		});
	});
};

search = function(searchString, paramArray, callback) {
	sphinxPool.getConnection(function(error, connection) {
		if(error) {
			callback("Error opening sphinx connection: " + error);
			return;
		}
		connection.query(searchString, paramArray, function(error, rows) {
			callback(error, rows);
			connection.destroy();
		});
	});
};

module.exports = {
	query: query,
	search: search
};
