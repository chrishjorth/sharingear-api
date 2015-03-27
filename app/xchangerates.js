/**
 * Defines a currency conversion module based on exchange rates from Yahoo.
 * YML query builder: https://developer.yahoo.com/yql/console/?q=show%20tables&env=store://datatables.org/alltableswithkeys#h=select+*+from+yahoo.finance.xchange+where+pair+in+(%22EURUSD%22)
 * Example REST call: https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.xchange%20where%20pair%20in%20(%22EURUSD%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=
 * Consider using https://openexchangerates.org/signup
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var https = require("https"),
    currencies = {},
    getRate,
    getYahooRate,
    getECBRate,
    getData;

getRate = function(fromCurrency, toCurrency, callback) {
    var code = fromCurrency + toCurrency,
        key, timeDifference;
    for (key in currencies) {
        if (key === code) {
            timeDifference = Date.now - currencies[key].timestamp;
            if (timeDifference < 3600000) { //An hour has not passed since last request
                callback(null, currencies[key]);
                return;
            }
        }
    }

    getYahooRate(fromCurrency, toCurrency, function(error, yahooRate) {
        if (error) {
            getECBRate(fromCurrency, toCurrency, function(error, ecbRate) {
                if (error) {
                    callback(error);
                    return;
                }
                currencies[code] = {
                    rate: ecbRate,
                    timestamp: Date.now
                };
                callback(null, ecbRate);
            });
        } else {
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

    query = "select * from yahoo.finance.xchange where pair in (\"";
    query += code;
    query += "\")&format=json&env=store://datatables.org/alltableswithkeys&callback=";

    path = "/v1/public/yql?q=" + encodeURI(query);

    getData("query.yahooapis.com", path, function(error, data) {
        var rate, parsedData;
        if (error) {
            callback("Error retrieving exchange rate: " + error);
            return;
        }
        try {
            parsedData = JSON.parse(data);
        } catch (error) {
            callback(error.message);
            return;
        }
        if (!parsedData.query.results || parsedData.query.results === null) {
            callback("Yahoo did not return any results.");
            return;
        }
        rate = parseFloat(parsedData.query.results.rate.Rate);
        callback(null, rate);
    });
};

getECBRate = function(fromCurrency, toCurrency, callback) {
    getData("www.ecb.europa.eu", "/stats/eurofxref/eurofxref-daily.xml", function(error, data) {
        var i = 0,
            fromRate = null,
            toRate = null,
            j, currency, line;
        if (error) {
            callback(error);
            return;
        }
        while (i < data.length) {
            j = data.indexOf("\n", i);
            if (j === -1) {
                j = data.length;
            }
            line = data.substr(i, j - i);
            currency = line.match(/ currency='([^']*)'/);
            if (currency !== null) {
                currency = currency[1];
                if (currency === fromCurrency) {
                    fromRate = line.match(/ rate='([^']*)'/);
                    if (fromRate !== null) {
                        fromRate = parseFloat(fromRate[1]);
                    }
                }
                if (currency === toCurrency) {
                    toRate = line.match(/ rate='([^']*)'/);
                    if (toRate !== null) {
                        toRate = parseFloat(toRate[1]);
                    }
                }
            }
            i = j + 1;
        }
        if (fromCurrency === "EUR" && toCurrency === "EUR") {
            callback(null, 1);
            return;
        }
        if (fromCurrency === "EUR" && toRate !== null) {
            callback(null, toRate);
            return;
        }
        if (fromRate !== null && toCurrency === "EUR") {
            callback(null, 1 / fromRate);
            return;
        }
        if (fromRate !== null && toRate !== null) {
            callback(null, 1 / fromRate * toRate);
            return;
        }
        callback("Error getting currency conversion rate.");
    });
};

getData = function(host, path, callback) {
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
            callback(null, buffer);
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
    getECBRate: getECBRate
};
