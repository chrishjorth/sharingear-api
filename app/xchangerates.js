/**
 * Defines a currency conversion module based on exchange rates from Yahoo.
 * YML query builder: https://developer.yahoo.com/yql/console/?q=show%20tables&env=store://datatables.org/alltableswithkeys#h=select+*+from+yahoo.finance.xchange+where+pair+in+(%22EURUSD%22)
 * Example REST call: https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.xchange%20where%20pair%20in%20(%22EURUSD%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var https = require("https"),
	currencies = {},
	getRate,
	getJSON;

getRate = function(fromCurrency, toCurrency, callback) {
	var key, timeDifference,  query, code;
	
	code = fromCurrency + toCurrency;
	for(key in currencies) {
		if(key === code) {
			timeDifference = Date.now - currencies[key].timestamp;
			if(timeDifference < 3600000) { //An hour has not passed since last request
				callback(null, currencies[key]);
				return;
			}			
		}
	}
	
	query = "select * from yahoo.finance.xchange where pair in (\"";
	query += code;
	query += "\")&format=json&env=store://datatables.org/alltableswithkeys&callback=";
	getJSON(query, function(error, data) {
		var rate;
		if(error) {
			callback("Error retrieving exchange rate: " + error);
			return;
		}
		rate = parseFloat(data.query.results.rate.Rate);
		currencies[code] = {
			rate: rate,
			timestamp: Date.now
		};
		callback(null, rate);
	});
};

getJSON = function(query, callback) {
	var buffer = "",
		options, request, path;

	path = "/v1/public/yql?q=" + encodeURI(query);

	options = {
		host: "query.yahooapis.com",
		port: 443,
		path: path,
		method: "GET"
	};

	request = https.request(options, function(result) {
		result.setEncoding("utf8");
		result.on("data", function(chunk) {
			buffer += chunk;
		});
		result.on("end", function() {
			callback(null, JSON.parse(buffer));
		});
		result.on("error", function(e) {
			callback(e.message);
		});
	});
	request.on("error", function(error) {
		callback("Error requesting from gateway: " + error.message);
	});
	request.end();
};

module.exports = {
	getRate: getRate
};
