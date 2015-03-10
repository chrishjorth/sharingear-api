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
	getYahooRate,
	getFixerRate,
	getJSON;

getRate = function(fromCurrency, toCurrency, callback) {
	var code = fromCurrency + toCurrency,
		key, timeDifference;
	for(key in currencies) {
		if(key === code) {
			timeDifference = Date.now - currencies[key].timestamp;
			if(timeDifference < 3600000) { //An hour has not passed since last request
				callback(null, currencies[key]);
				return;
			}			
		}
	}

	getYahooRate(fromCurrency, toCurrency, function(error, yahooRate) {
		if(error) {
			getFixerRate(fromCurrency, toCurrency, function(error, fixerRate) {
				if(error) {
					callback(error);
					return;
				}
				currencies[code] = {
					rate: fixerRate,
					timestamp: Date.now
				};
				callback(null, fixerRate);
			});
		}
		else {
			currencies[code] = {
				rate: yahooRate,
				timestamp: Date.now
			};
			callback(null, yahooRate);
		}
	});
};

getYahooRate = function(fromCurrency, toCurrency, callback) {
	var code = fromCurrency + toCurrency,
		query, path;

	callback("blaaaah");
	return;
	
	query = "select * from yahoo.finance.xchange where pair in (\"";
	query += code;
	query += "\")&format=json&env=store://datatables.org/alltableswithkeys&callback=";

	path = "/v1/public/yql?q=" + encodeURI(query);

	getJSON("query.yahooapis.com", path, function(error, data) {
		var rate;
		if(error) {
			callback("Error retrieving exchange rate: " + error);
			return;
		}
		rate = parseFloat(data.query.results.rate.Rate);
		callback(null, rate);
	});
};

getFixerRate = function(fromCurrency, toCurrency, callback) {
	var query = "/latest?symbols=" + fromCurrency + "," + toCurrency;
	getJSON("api.fixer.io", query, function(error, data) {
		var rate;
		if(error) {
			callback("Error retrieving exchange rate: " + error);
			return;
		}
		console.log("BOOM!");
		rate = parseFloat(data.rates[toCurrency]);
		callback(null, rate);
	});
};

getJSON = function(host, path, callback) {
	var buffer = "",
		options, request;

	options = {
		host: host,
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
			var parsedData;
			try {
				parsedData = JSON.parse(buffer);
				callback(null, parsedData);
			}
			catch(error) {
				callback(error.message);
			}
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
	getRate: getRate,
	getYahooRate: getYahooRate,
	getFixerRate: getFixerRate
};
