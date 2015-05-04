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

sharingearPool.on("error", function(error) {
    console.error("Sharingear MySQL pool error: " + error.code);
});

sphinxPool = mysql.createPool({
    host: Config.SPHINX_URL,
    port: 9306
});

sphinxPool.on("error", function(error) {
    console.error("Sphinx SQL pool error: " + error.code);
});

query = function(queryString, paramArray, callback) {
    var handleConnectionError = function(error) {
        callback(error);
    };

    console.log("Getting connection from pool...");

    sharingearPool.getConnection(function(error, connection) {
        if (error) {
            console.error("Error opening database connection.");
            callback(error);
            return;
        }
        connection.on("error", handleConnectionError);
        connection.query(queryString, paramArray, function(error, rows) {
            console.log("Returned from query and closing connection...");
            connection.release();
            if (error) {
                console.error("Error running query: " + queryString + ". " + error.code);
            }
            callback(error, rows);
        });
    });
};

search = function(searchString, paramArray, callback) {
    var handleConnectionError = function(error) {
        callback(error);
    };

    console.log("Getting connection from sphinx pool...");

    sphinxPool.getConnection(function(error, connection) {
        if (error) {
            callback("Error opening sphinx connection: " + error);
            return;
        }
        connection.on("error", handleConnectionError);
        connection.query(searchString, paramArray, function(error, rows) {
            console.log("Returned from sphinx query and closing connection...");
            connection.release();
            callback(error, rows);
        });
    });
};

module.exports = {
    query: query,
    search: search
};
