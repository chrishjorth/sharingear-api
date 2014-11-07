/**
 * Payment handling.
 * @author: Chris Hjorth
 */

'use strict';

var registerBankAccountForUser;

registerBankAccountForUser = function(user, iban, swift, callback) {
	callback(null);
};

module.exports = {
	registerBankAccountForUser: registerBankAccountForUser
};
