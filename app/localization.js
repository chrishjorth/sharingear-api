/**
 * Contains data useful for localization and locales.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var alpha2Countries,
    getCountryNameFromAlpha2,
    isCountrySupported;

alpha2Countries = {
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
};

getCountryNameFromAlpha2 = function(countryCode) {
    return alpha2Countries[countryCode];
};

isCountrySupported = function(countryCode) {
    var key;
    for(key in alpha2Countries) {
        if(key === countryCode.toUpperCase()) {
            return true;
        }
    }
    return false;
};

module.exports = {
    getCountryNameFromAlpha2: getCountryNameFromAlpha2,
    isCountrySupported: isCountrySupported
};