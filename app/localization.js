/**
 * Contains data useful for localization and locales.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
    localizationData = [],

    loadLocalization,
    getLocalizationData,
    isCountrySupported,
    getCurrency;

/*alpha2Countries = {
    "AD": "andorra",
    "AT": "austria",
    "BE": "belgium",
    "DK": "denmark",
    "EE": "estonia",
    "FI": "finland",
    "FR": "france",
    "DE": "germany",
    "GR": "greece",
    "IE": "ireland",
    "IT": "italy",
    "LV": "latvia",
    "LU": "luxembourg",
    "MT": "malta",
    "MC": "monaco",
    "NL": "netherlands",
    "NO": "norway",
    "PT": "portugal",
    "SM": "san marino",
    "SK": "slovakia",
    "SI": "slovenia",
    "ES": "spain",
    "SE": "sweden",
    "GB": "united kingdom",
    "US": "united states",
};*/

loadLocalization = function(callback) {
    db.query("SELECT code, name, vat, currency, EU FROM countries ORDER BY name", [], function(error, rows) {
        if(error) {
            callback("Error retrieving localization data: " + error);
            return;
        }
        localizationData = rows;
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

module.exports = {
    getLocalizationData: getLocalizationData,
    loadLocalization: loadLocalization,
    isCountrySupported: isCountrySupported,
    getCurrency: getCurrency
};