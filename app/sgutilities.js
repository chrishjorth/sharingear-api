/**
 * Defines general Sharingear utilities.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var Moment = require("moment"),

	getPriceForPeriod;

getPriceForPeriod = function(priceA, priceB, priceC, startTime, endTime) {
	var startMoment, endMoment, months, weeks, days, hours, price;
    startMoment = new Moment(startTime, "YYYY-MM-DD HH:mm:ss");
    endMoment = new Moment(endTime, "YYYY-MM-DD HH:mm:ss");
    months = parseInt(endMoment.diff(startMoment, "months"), 10);
    endMoment.subtract(months, "months");
    weeks = parseInt(endMoment.diff(startMoment, "weeks"), 10);
    endMoment.subtract(weeks, "weeks");
    days = parseInt(endMoment.diff(startMoment, "days"), 10);
    endMoment.subtract(days, "days");
    hours = parseInt(endMoment.diff(startMoment, "hours"), 10);

    //In case <24 hours are selected the user should pay for one day
    //In case 25 hours are selected, the user should pay for two days and so on
    //In case 6 days and 1 hour is selected, the user should pay for 1 week and so on
    if (hours !== 0 && hours % 24 !== 0) {
        days++;
        if (days === 7) {
            weeks++;
            days = 0;
        }
        if (weeks === 4) {
            months++;
            weeks = 0;
        }
    }

    price = priceA * days + priceB * weeks + priceC * months;
    return price;
};

module.exports = {
	getPriceForPeriod: getPriceForPeriod
};