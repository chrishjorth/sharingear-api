/**
 * Defines a Sharingear user.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Payment = require("./payment");

module.exports = {
	getUserFromFacebookID: getUserFromFacebookID,
	createUserFromFacebookInfo: createUserFromFacebookInfo,
	setServerAccessToken: setServerAccessToken,
	matchToken: matchToken,
	getToken: getToken,
	readUser: readUser,
	update: update
};

function getUserFromFacebookID(fbid, callback) {
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
}

var createUserFromFacebookInfo = function(userInfo, callback) {
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
function setServerAccessToken(fbid, longToken, callback) {
	db.query("UPDATE users SET fb_token=? WHERE fbid=? LIMIT 1", [longToken, fbid], function(error, result) {
		if(result.affectedRows <= 0) {
			callback("No user updated.");
			return;
		}
		callback(error);
	});
}

function matchToken(userID, fbLongToken, callback) {
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
}

function getToken(userID, callback) {
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
}

function readUser(userID, callback) {
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
}

function update(userID, updatedInfo, callback) {
	var userInfo;

	db.query("SELECT id, email, name, surname, birthdate, address, postal_code, city, region, country, phone, image_url, bio FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}
		userInfo = [
			(updatedInfo.email ? updatedInfo.email : rows[0].email),
			(updatedInfo.name ? updatedInfo.name : rows[0].name),
			(updatedInfo.surname ? updatedInfo.surname : rows[0].surname),
			(updatedInfo.birthdate ? updatedInfo.birthdate : rows[0].birthdate),
			(updatedInfo.address ? updatedInfo.address : rows[0].address),
			(updatedInfo.postal_code ? updatedInfo.postal_code : rows[0].postal_code),
			(updatedInfo.city ? updatedInfo.city : rows[0].city),
			(updatedInfo.region ? updatedInfo.region : rows[0].region),
			(updatedInfo.country ? updatedInfo.country : rows[0].country),
			(updatedInfo.phone ? updatedInfo.phone : rows[0].phone),
			(updatedInfo.image_url ? updatedInfo.image_url : rows[0].image_url),
			(updatedInfo.bio ? updatedInfo.bio : rows[0].bio),
			userID
		];
		db.query("UPDATE users SET email=?, name=?, surname=?, birthdate=?, address=?, postal_code=?, city=?, region=?, country=?, phone=?, image_url=?, bio=? WHERE id=? LIMIT 1", userInfo, function(error) {
			var user;
			if(error) {
				callback(error);
				return;
			}
			if(rows.length <= 0) {
				callback("No user with id " + userID + " after successful select!");
				return;
			}
			user = {
				id: userID,
				email: userInfo[0],
				name: userInfo[1],
				surname: userInfo[2],
				birthdate: userInfo[3],
				address: userInfo[4],
				postal_code: userInfo[5],
				city: userInfo[6],
				region: userInfo[7],
				country: userInfo[8],
				phone: userInfo[9],
				image_url: userInfo[10],
				bio: userInfo[11]
			};
			Payment.registerBankAccountForUser(user, updatedInfo.iban, updatedInfo.swift, function(error) {
				callback(error, user);
			});
		});
	});
}
