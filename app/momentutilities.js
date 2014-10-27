/**
 * Contains utility functions to work with Moments from Moment.js.
 * @author: Chris Hjorth
 */

var Moment = require('moment');

module.exports = {
	isBetween: isBetween, //inclusive
	isBetweenExclusive: isBetweenExclusive
};

function isBetween(moment, intervalStartMoment, intervalEndMoment) {
	var result = false;
	result = (intervalStartMoment.isSame(moment, 'day') === true || intervalStartMoment.isBefore(moment, 'day') === true) && (intervalEndMoment.isSame(moment, 'day') === true || intervalEndMoment.isAfter(moment, 'day') === true);
	return result;
}

function isBetweenExclusive(moment, intervalStartMoment, intervalEndMoment) {
	var result = false;
	result = intervalStartMoment.isBefore(moment, 'day') === true && intervalEndMoment.isAfter(moment, 'day') === true;
	return result;
}
