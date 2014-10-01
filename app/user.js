/**
 * Defines a Sharingear user.
 * @author: Chris Hjorth
 */

var db = require('./database');

module.exports = {
	getUserFromFacebookID: getUserFromFacebookID,
	createUserFromFacebookInfo: createUserFromFacebookInfo,
	setServerAccessToken: setServerAccessToken,
	matchToken: matchToken,
	getToken: getToken,
	update: update
};

function getUserFromFacebookID(fbid, callback) {
	db.query("SELECT id, fbid, email, name, surname, birthdate, city, image_url FROM users WHERE fbid=? LIMIT 1", [fbid], function(error, rows) {
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

function createUserFromFacebookInfo(userInfo, callback) {
	var User = this,
		user;

	user = [
		userInfo.id, //fbid
		userInfo.email, //email
		userInfo.first_name + ' ' + userInfo.middle_name, //name
		userInfo.last_name, //surname
		'', //birthdate
		'', //city
		'http://graph.facebook.com/' + userInfo.id + '/picture?type=large' //image_url
	];
	//Make sure user does not exist
	this.getUserFromFacebookID(user[0], function(error, retrievedUser) {
		if(error) {
			callback(error);
			return;
		}
		if(retrievedUser !== null) {
			callback(null, retrievedUser);
			return;
		}
		db.query("INSERT INTO users(fbid, email, name, surname, birthdate, city, image_url) VALUES(?, ?, ?, ?, ?, ?, ?)", user, function(error, rows) {
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
					callback('Error retrieving user after insertion into db.');
					return;
				}
				callback(null, user);
			});
		});
	});

	
}

/**
 * Stores the long term access token for a user. If the user does not exists the user is created first.
 */
function setServerAccessToken(fbid, longToken, callback) {
	db.query("UPDATE users SET fb_token=? WHERE fbid=? LIMIT 1", [longToken, fbid], function(error, result) {
		if(result.affectedRows <= 0) {
			callback('No user updated.');
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
			callback('No user with id ' + userID + '.');
			return;
		}
		if(rows[0].fb_token === null) {
			callback('User has no token.');
			return;
		}
		callback(null, rows[0].fb_token);
	});
}

function update(userID, updatedInfo, callback) {
	var userInfo;

	db.query("SELECT id, fbid, email, name, surname, birthdate, city, image_url FROM users WHERE fbid=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback('No user with id ' + userID + '.');
			return;
		}
		userInfo = [
			(updatedInfo.email ? updatedInfo.email : rows[0].email),
			(updatedInfo.name ? updatedInfo.name : rows[0].name),
			(updatedInfo.surname ? updatedInfo.surname : rows[0].surname),
			(updatedInfo.birthdate ? updatedInfo.birthdate : rows[0].birthdate),
			(updatedInfo.city ? updatedInfo.city : rows[0].city),
			(updatedInfo.image_url ? updatedInfo.image_url : rows[0].image_url),
			userID
		];
		db.query("UPDATE users SET email=?, name=?, surname=?, birthdate=?, city=?, image_url=? WHERE id=? LIMIT 1", userInfo, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			if(rows.length <= 0) {
				callback('No user with id ' + userID + ' after successful select!');
				return;
			}
			callback({
				id: userID,
				email: userInfo[0],
				name: userInfo[1],
				surname: userInfo[2],
				birthdate: userInfo[3],
				city: userInfo[4],
				image_url: userInfo[5]
			});
		});
	});
}
