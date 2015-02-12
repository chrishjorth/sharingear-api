/**
 * Defines a Sharingear user.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Payment = require("./payment"),
	Localization = require("./localization"),

	getUserFromFacebookID,
	createUserFromFacebookInfo,
	setServerAccessToken,
	matchToken,
	getToken,
	readPublicUser,
	readUser,
	update,
	updateBankDetails,
	getCardObject,
	getUserWithMangoPayData,
	hasClosedBetaAccess,

	checkLocales;

getUserFromFacebookID = function(fbid, callback) {
	db.query("SELECT id, fbid, email, name, surname, birthdate, address, postal_code, city, region, country, nationality, phone, image_url, bio, wallet_id, bank_id, buyer_fee, seller_fee FROM users WHERE fbid=? LIMIT 1", [fbid], function(error, rows) {
		var user;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, null);
			return;
		}
		user = {
			id: rows[0].id,
			fbid: rows[0].fbid,
			email: rows[0].email,
			name: rows[0].name,
			surname: rows[0].surname,
			birthdate: rows[0].birthdate,
			address: rows[0].address,
			postal_code: rows[0].postal_code,
			city: rows[0].city,
			region: rows[0].region,
			country: rows[0].country,
			nationality: rows[0].nationality,
			phone: rows[0].phone,
			image_url: rows[0].image_url,
			bio: rows[0].bio,
			hasWallet: (rows[0].wallet_id !== null),
			hasBank: (rows[0].bank_id !== null),
			buyer_fee: rows[0].buyer_fee,
			seller_fee: rows[0].seller_fee
		};
		user.currency = Localization.getCurrency(user.country);
		callback(null, user);
	});
};

createUserFromFacebookInfo = function(userInfo, callback) {
	var User = this,
		user;

	user = [
		userInfo.id, //fbid
		userInfo.email, //email
		userInfo.first_name, //name
		userInfo.last_name, //surname
		null, //birthdate
		null, //city
		"https://graph.facebook.com/" + userInfo.id + "/picture?type=large" //image_url
	];
	if(userInfo.middle_name && userInfo.middle_name.length > 0) {
		user[2] += " " + userInfo.middle_name;
	}
	//Make sure user does not exist
	User.getUserFromFacebookID(user[0], function(error, retrievedUser) {
		if(error) {
			callback(error);
			return;
		}
		if(retrievedUser !== null) {
			callback(null, retrievedUser);
			return;
		}
		db.query("INSERT INTO users(fbid, email, name, surname, birthdate, city, image_url) VALUES(?, ?, ?, ?, ?, ?, ?)", user, function(error) {
			if(error) {
				callback(error);
				return;
			}
			User.getUserFromFacebookID(user[0], function(error, user) {
				if(error) {
					callback(error);
					return;
				}
				if(user === null) {
					callback("Error retrieving user after insertion into db.");
					return;
				}
				callback(null, user);
			});
		});
	});
};

/**
 * Stores the long term access token for a user. If the user does not exists the user is created first.
 */
setServerAccessToken = function(fbid, longToken, callback) {
	db.query("UPDATE users SET fb_token=? WHERE fbid=? LIMIT 1", [longToken, fbid], function(error, result) {
		if(result.affectedRows <= 0) {
			callback("No user updated.");
			return;
		}
		callback(error);
	});
};

matchToken = function(userID, fbLongToken, callback) {
	db.query("SELECT id FROM users WHERE id=? AND fb_token=? LIMIT 1", [userID, fbLongToken], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, false);
		}
		else {
			callback(null, true);
		}
	});
};

getToken = function(userID, callback) {
	db.query("SELECT fb_token FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}
		if(rows[0].fb_token === null) {
			callback("User has no token.");
			return;
		}
		callback(null, rows[0].fb_token);
	});
};

readPublicUser = function(userID, callback) {
	db.query("SELECT id, name, surname, image_url, bio FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id: " + userID + ".");
			return;
		}
		callback(null, rows[0]);
	});
};

readUser = function(userID, callback) {
	db.query("SELECT id, email, name, surname, birthdate, address, postal_code, city, region, country, nationality, phone, image_url, bio, wallet_id, bank_id, buyer_fee, seller_fee FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		var user;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id: " + userID + ".");
			return;
		}
		user = {
			id: rows[0].id,
			email: rows[0].email,
			name: rows[0].name,
			surname: rows[0].surname,
			birthdate: rows[0].birthdate,
			address: rows[0].address,
			postal_code: rows[0].postal_code,
			city: rows[0].city,
			region: rows[0].region,
			country: rows[0].country,
			nationality: rows[0].nationality,
			phone: rows[0].phone,
			image_url: rows[0].image_url,
			bio: rows[0].bio,
			hasWallet: (rows[0].wallet_id !== null),
			hasBank: (rows[0].bank_id !== null),
			buyer_fee: rows[0].buyer_fee,
			seller_fee: rows[0].seller_fee
		};
		user.currency = Localization.getCurrency(user.country);
		callback(null, user);
	});
};

update = function(userID, updatedInfo, callback) {
	db.query("SELECT id, mangopay_id, email, name, surname, birthdate, address, postal_code, city, region, country, nationality, phone, image_url, bio, wallet_id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		var userInfo, updateUser;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}

		userInfo = {
			email: (updatedInfo.email ? updatedInfo.email : rows[0].email),
			name: (updatedInfo.name ? updatedInfo.name : rows[0].name),
			surname: (updatedInfo.surname ? updatedInfo.surname : rows[0].surname),
			birthdate: (updatedInfo.birthdate ? updatedInfo.birthdate : rows[0].birthdate),
			address: (updatedInfo.address ? updatedInfo.address : rows[0].address),
			postal_code: (updatedInfo.postal_code ? updatedInfo.postal_code : rows[0].postal_code),
			city: (updatedInfo.city ? updatedInfo.city : rows[0].city),
			region: (updatedInfo.region ? updatedInfo.region : rows[0].region),
			country: (updatedInfo.country ? updatedInfo.country : rows[0].country),
			nationality: (updatedInfo.nationality ? updatedInfo.nationality : rows[0].nationality),
			phone: (updatedInfo.phone ? updatedInfo.phone : rows[0].phone),
			image_url: (updatedInfo.image_url ? updatedInfo.image_url : rows[0].image_url),
			bio: (updatedInfo.bio ? updatedInfo.bio : rows[0].bio),
			hasWallet: (rows[0].wallet_id !== null),
			hasBank: (rows[0].bank_id !== null),
			id: userID
		};

		if(checkLocales(userInfo) === false) {
			callback("Locale not supported.");
			return;
		}

		updateUser = function(mangopay_id, wallet_id) {
			var userInfoArray;
			userInfoArray = [mangopay_id, userInfo.email, userInfo.name, userInfo.surname, userInfo.birthdate, userInfo.address, userInfo.postal_code, userInfo.city, userInfo.region, userInfo.country, userInfo.nationality, userInfo.phone, userInfo.image_url, userInfo.bio, wallet_id, userInfo.id];
			db.query("UPDATE users SET mangopay_id=?, email=?, name=?, surname=?, birthdate=?, address=?, postal_code=?, city=?, region=?, country=?, nationality=?, phone=?, image_url=?, bio=?, wallet_id=? WHERE id=? LIMIT 1", userInfoArray, function(error) {
				if(error) {
					callback(error);
					return;
				}
				userInfo.hasWallet = true;
				callback(null, userInfo);
			});
		};

		if(userInfo.birthdate === null || userInfo.address === null || userInfo.country === null || userInfo.nationality === null) {
			//We do not have enough data to create a Payment user
			updateUser(rows[0].mangopay_id, rows[0].wallet_id);
		}
		else {
			Payment.updateUser(rows[0].mangopay_id, rows[0].wallet_id, userInfo, function(error, mangopay_id, wallet_id) {
				if(error) {
					callback(error);
					return;
				}
				updateUser(mangopay_id, wallet_id);
			});
		}
	});
};

updateBankDetails = function(userID, bankDetails, callback) {
	db.query("SELECT id, mangopay_id, name, surname, address, bank_id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}

		if(rows[0].bank_id !== null) {
			//By assertion the user already has a bank registered and an assigned wallet
			callback(null);
			return;
		}

		Payment.registerBankAccountForUser(rows[0], bankDetails.iban, bankDetails.swift, function(error, bank_id) {
			if(error) {
				callback(error);
				return;
			}

			db.query("UPDATE users SET bank_id=? WHERE id=? LIMIT 1", [bank_id, rows[0].id], function(error) {
				if(error) {
					callback("Error setting bank_id: " + error);
					return;
				}
				callback(null);
			});
		});
	});
};

getCardObject = function(userID, callback) {
	db.query("SELECT mangopay_id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}
		Payment.getCardObject(rows[0].mangopay_id, function(error, cardObject) {
			if(error) {
				callback(error);
				return;
			}
			callback(null, cardObject);
		});
	});
};

getUserWithMangoPayData = function(userID, callback) {
	db.query("SELECT users.id, users.email, users.name, users.surname, users.birthdate, users.address, users.postal_code, users.city, users.region, users.country, users.nationality, users.phone, users.image_url, users.bio, users.mangopay_id, users.wallet_id, users.bank_id, users.buyer_fee, users.seller_fee, countries.vat FROM users, countries WHERE id=? AND countries.code=users.country LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}
		callback(null, rows[0]);
	});
};

hasClosedBetaAccess = function(user, callback) {
	
	db.query("SELECT id FROM closedbeta WHERE fbid=? OR email=? LIMIT 1", [user.fbid, user.email], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, false);
			return;
		}
		callback(null, true);
	});
};

checkLocales = function(user) {
	if(user.country !== null) {
		user.country = user.country.toUpperCase();
		if(Localization.isCountrySupported(user.country) === false) {
			return false;
		}
	}

	if(user.nationality !== null) {
		user.nationality = user.nationality.toUpperCase();
		if(Localization.isCountrySupported(user.nationality) === false) {
			return false;
		}
	}

	return true;
};

module.exports = {
	getUserFromFacebookID: getUserFromFacebookID,
	createUserFromFacebookInfo: createUserFromFacebookInfo,
	setServerAccessToken: setServerAccessToken,
	matchToken: matchToken,
	getToken: getToken,
	readPublicUser: readPublicUser,
	readUser: readUser,
	update: update,
	updateBankDetails: updateBankDetails,
	getCardObject: getCardObject,
	getUserWithMangoPayData: getUserWithMangoPayData,
	hasClosedBetaAccess: hasClosedBetaAccess
};
