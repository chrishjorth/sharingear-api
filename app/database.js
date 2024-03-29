/**
 * Database handling.
 * @author: Chris Hjorth
 */
/* !TODO: Handle server disconnects */

/*jslint node: true */
"use strict";

var mysql = require("mysql"),
    Config = require("./config"),
    sharingearPoolOptions,
    sharingearPool,
    sphinxPool,

    query,
    search;

sharingearPoolOptions = {
    host: Config.MYSQL_URL,
    port: 3306,
    user: "root",
    password: "20mircea14chris",
    database: "sharingear",
    supportBigNumbers: true, //Required for working with Facebook IDs stored as bigint.
    multipleStatements: true, //Required for Minus operation from dynamic data set, which requires temp table
    dateStrings: true,
    acquireTimeout: 20000 //Default is 10000, we try with double to avoid occasional PROTOCOL_SEQUENCE_TIMEOUT errors
    //connectTimeout: 60000, //Outcomment when not debugging with node inspector
};

if(Config.MYSQL_CA && Config.MYSQL_CERT && Config.MYSQL_KEY) {
    sharingearPoolOptions.ssh = {
        ca: Config.MYSQL_CA,
        cert: Config.MYSQL_CERT,
        key: Config.MYSQL_KEY
    };
}

sharingearPool = mysql.createPool(sharingearPoolOptions);

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
    sharingearPool.getConnection(function(error, connection) {
        var handleConnectionError = function(error) {
            callback(error);
        };
        if (error) {
            console.error("Error opening database connection.");
            callback(error);
            return;
        }
        connection.on("error", handleConnectionError);
        connection.query(queryString, paramArray, function(error, rows) {
            connection.release();
            connection.removeListener("error", handleConnectionError);
            if (error) {
                console.error("Error running query: " + queryString + ". " + error.code);
            }
            callback(error, rows);
        });
    });
};

search = function(searchString, paramArray, callback) {
    sphinxPool.getConnection(function(error, connection) {
        var handleConnectionError = function(error) {
            callback(error);
        };
        if (error) {
            callback("Error opening sphinx connection: " + error);
            return;
        }
        connection.on("error", handleConnectionError);
        connection.query(searchString, paramArray, function(error, rows) {
            connection.release();
            connection.removeListener("error", handleConnectionError);
            callback(error, rows);
        });
    });
};

module.exports = {
    query: query,
    search: search
};
