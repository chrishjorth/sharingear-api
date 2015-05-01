/**
 * Contains data useful for localization and locales.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
    XChangeRates = require("./xchangerates"),
    localizationData = [],
    supportedCurrencies = [],

    loadLocalization,
    getLocalizationData,
    isCountrySupported,
    getCurrency,
    convertPrices,
    getSupportedCurrencies;

loadLocalization = function(callback) {
    db.query("SELECT code, name, vat, currency, EU FROM countries ORDER BY name", [], function(error, rows) {
        if(error) {
            callback("Error retrieving localization data: " + error);
            return;
        }
        localizationData = rows;
        db.query("SELECT currency FROM countries GROUP BY currency", [], function(error, rows) {
            var i;
            if(error) {
                callback("Error retrieving supported currencies: " + error);
                return;
            }
            for(i = 0; i < rows.length; i++) {
                supportedCurrencies.push(rows[i].currency);
            }
            callback(null);
        });
    });
};

getLocalizationData = function() {
    return localizationData.slice();

};

isCountrySupported = function(countryCode) {
    /*var key;
    for(key in alpha2Countries) {
        if(key === countryCode.toUpperCase()) {
            return true;
        }
    }*/
    var i;
    for(i = 0; i < localizationData.length; i++) {
        if(localizationData[i].code === countryCode) {
            return true;
        }
    }
    return false;
};

getCurrency = function(countryCode) {
    var defaultCurrency = "EUR",
        i;
    if(!countryCode || countryCode === null) {
        return defaultCurrency;
    }
    for(i = 0; i < localizationData.length; i++) {
        if(localizationData[i].code === countryCode) {
            return localizationData[i].currency;
        }
    }
    return defaultCurrency;
};

convertPrices = function(prices, fromCurrency, toCurrency, callback) {
    XChangeRates.getRate(fromCurrency, toCurrency, function(error, rate) {
        var i = 0,
            convertedPrices = [];
        if(error) {
            callback("Error getting rate: " + error);
            return;
        }
        for(i = 0; i < prices.length; i++) {
            convertedPrices.push(prices[i] * rate);
        }
        callback(null, convertedPrices);
    });
};

getSupportedCurrencies = function() {
    return supportedCurrencies.slice();
};

module.exports = {
    getLocalizationData: getLocalizationData,
    loadLocalization: loadLocalization,
    isCountrySupported: isCountrySupported,
    getCurrency: getCurrency,
    convertPrices: convertPrices,
    getSupportedCurrencies: getSupportedCurrencies
};