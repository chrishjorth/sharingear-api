/**
 * Defines a Sharingear user.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Payment = require("./payment"),
	getUserFromFacebookID,
	createUserFromFacebookInfo,
	setServerAccessToken,
	matchToken,
	getToken,
	readUser,
	update,
	updateBankDetails;

getUserFromFacebookID = function(fbid, callback) {
	db.query("SELECT id, fbid, email, name, surname, birthdate, city, image_url, bio FROM users WHERE fbid=? LIMIT 1", [fbid], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, null);
			return;
		}
		callback(null, rows[0]);
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
		"", //birthdate
		"", //city
		"http://graph.facebook.com/" + userInfo.id + "/picture?type=large" //image_url
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

readUser = function(userID, callback) {
	db.query("SELECT id, name, surname, image_url, bio, submerchant FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
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

update = function(userID, updatedInfo, callback) {
	db.query("SELECT id, mangopay_id, email, name, surname, birthdate, address, postal_code, city, region, country, phone, image_url, bio FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		var userInfo;
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
			phone: (updatedInfo.phone ? updatedInfo.phone : rows[0].phone),
			image_url: (updatedInfo.image_url ? updatedInfo.image_url : rows[0].image_url),
			bio: (updatedInfo.bio ? updatedInfo.bio : rows[0].bio),
			id: userID
		};

		Payment.updateUser(rows[0].mangopay_id, userInfo, function(error, mangopay_id) {
			var userInfoArray;
			if(error) {
				callback(error);
				return;
			}

			userInfoArray = [mangopay_id, userInfo.email, userInfo.name, userInfo.surname, userInfo.birthdate, userInfo.address, userInfo.postal_code, userInfo.city, userInfo.region, userInfo.country, userInfo.phone, userInfo.image_url, userInfo.bio, userInfo.id];

			db.query("UPDATE users SET mangopay_id=?, email=?, name=?, surname=?, birthdate=?, address=?, postal_code=?, city=?, region=?, country=?, phone=?, image_url=?, bio=? WHERE id=? LIMIT 1", userInfoArray, function(error) {
				if(error) {
					callback(error);
					return;
				}
				callback(null, userInfo);
			});
		});
	});
};

updateBankDetails = function(userID, bankDetails, callback) {
	db.query("SELECT mangopay_id, name, surname, address FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}

		Payment.registerBankAccountForUser(rows[0], bankDetails.iban, bankDetails.swift, callback);
	});
};

module.exports = {
	getUserFromFacebookID: getUserFromFacebookID,
	createUserFromFacebookInfo: createUserFromFacebookInfo,
	setServerAccessToken: setServerAccessToken,
	matchToken: matchToken,
	getToken: getToken,
	readUser: readUser,
	update: update,
	updateBankDetails: updateBankDetails
};
