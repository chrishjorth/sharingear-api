/**
 * Defines a Sharingear user.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Payment = require("./payment"),
	Localization = require("./localization"),
	XChangeRates = require("./xchangerates"),

	getClassification,
	getUserFromFacebookID,
	createUserFromFacebookInfo,
	setServerAccessToken,
	matchToken,
	getToken,
	getUserTypesForUserWithID,
	getUserTypeID,
	addUserTypes,
	readPublicUser,
	readUser,
	readCompleteUsers,
	update,
	updateBankDetails,
	getCardObject,
	getUserWithMangoPayData,
	getUsers,

	checkLocales;

getClassification = function(callback) {
    var sql = "SELECT type_name FROM user_types;";
    db.query(sql, [], function(error, rows) {
        var userTypes = [],
            i;
        if (error) {
            callback(error);
            return;
        }
        for (i = 0; i < rows.length; i++) {
            userTypes.push({
                user_type: rows[i].type_name
            });
        }
        callback(null, userTypes);
    });
};


getUserFromFacebookID = function(fbid, callback) {
	var User = this;
	db.query("SELECT id, fbid, email, name, surname, birthdate, address, postal_code, city, region, country, time_zone, nationality, phone, image_url, bio, bank_id, buyer_fee, seller_fee, vatnum, band_name, company_name FROM users WHERE fbid=? LIMIT 1", [fbid], function(error, rows) {
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
			id: rows[0].id.toString(), //We do not want number vs string issues in comparisons fx when extracting from authentication token
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
			time_zone: rows[0].time_zone,
			nationality: rows[0].nationality,
			phone: rows[0].phone,
			image_url: rows[0].image_url,
			bio: rows[0].bio,
			hasBank: (rows[0].bank_id !== null),
			buyer_fee: rows[0].buyer_fee,
			seller_fee: rows[0].seller_fee,
			vatnum: rows[0].vatnum,
			band_name: rows[0].band_name,
			company_name: rows[0].company_name
		};
		user.currency = Localization.getCurrency(user.country);

		User.getUserTypesForUserWithID(user.id,function(error,userTypes){
			user.user_types = userTypes;
			callback(null, user);			
		});

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
		if(result.affectedRows && result.affectedRows <= 0) {
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
		if(rows[0].fb_token === null || rows[0].fb_token === "") {
			callback("User has no token.");
			return;
		}
		callback(null, rows[0].fb_token);
	});
};

getUserTypesForUserWithID = function(userID, callback){
	var sql, i;
	sql = "SELECT user_types.type_name FROM user_types, has_user_types WHERE has_user_types.user_id=? AND user_types.id=has_user_types.user_type_id;";
	db.query(sql, [userID], function(error, rows) {
        var userTypes;
        if (error) {
            callback("Error getting accessory IDs: " + error);
            return;
        }
        userTypes = [];
        for (i = 0; i < rows.length; i++) {
            userTypes.push(rows[i].type_name);
        }
        callback(null, userTypes);
    });	
};

getUserTypeID = function(usertypes, callback) {
    var sql, valueArray, i;
    sql = "SELECT id FROM user_types WHERE type_name IN(";
    valueArray = [];
    
    if (!Array.isArray(usertypes) || usertypes.length <= 0) {
        callback(null, valueArray);
        return;
    }

    for (i = 0; i < usertypes.length - 1; i++) {
        sql += "?, ";
        valueArray.push(usertypes[i]);
    }

    sql += "?";
    valueArray.push(usertypes[i]);
    sql += ");";

    db.query(sql, valueArray, function(error, rows) {
        var userTypeIDs;
        if (error) {
            callback("Error getting accessory IDs: " + error);
            return;
        }
        userTypeIDs = [];
        for (i = 0; i < rows.length; i++) {
            userTypeIDs.push(rows[i].id);
        }
        callback(null, userTypeIDs);
    });
};

addUserTypes = function(userID, userTypeIDs, callback) {
    var sql, valueArray, i;
    if (userTypeIDs.length <= 0) {
        callback(null);
        return;
    }
    sql = "INSERT INTO has_user_types(user_id, user_type_id) VALUES ";
    valueArray = [];
    for (i = 0; i < userTypeIDs.length - 1; i++) {
        sql += "(?, ?), ";
        valueArray.push(userID, userTypeIDs[i]);
    }
    sql += "(?, ?)";
    valueArray.push(userID, userTypeIDs[i]);
    db.query(sql, valueArray, function(error) {
        if (error) {
            callback(error);
            return;
        }
        callback(null);
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
		rows[0].id = rows[0].id.toString(); //We need to ensure user id's are strings
		callback(null, rows[0]);
	});
};

readUser = function(userID, callback) {
	var sql;
	sql = "SELECT users.id, users.email, users.name, users.surname, users.birthdate, users.address, users.postal_code, users.city, users.region, users.country, users.time_zone, users.nationality, users.phone, users.image_url, users.bio, users.bank_id, users.buyer_fee, users.seller_fee, users.vatnum, users.band_name, users.company_name, user_types.type_name";
	sql += " FROM (SELECT users.id, users.email, users.name, users.surname, users.birthdate, users.address, users.postal_code, users.city, users.region, users.country, users.time_zone, users.nationality, users.phone, users.image_url, users.bio, users.bank_id, users.buyer_fee, users.seller_fee, users.vatnum, users.band_name, users.company_name FROM users WHERE users.id=? LIMIT 1) AS users";
	sql += " LEFT JOIN(SELECT has_user_types.user_id, user_types.type_name FROM has_user_types, user_types WHERE has_user_types.user_type_id = user_types.id) AS user_types ON user_types.user_id=users.id;";

    db.query(sql, [userID], function(error, rows) {
        var user, userTypes, i;
        if (error) {
            callback(error);
            return;
        }

        if( rows.length <= 0) {
			callback("No user with id: " + userID + ".");
			return;
		}

        userTypes = [];
        for (i = 0; i < rows.length; i++) {
            if (rows[i].type_name !== null) {
                userTypes.push(rows[i].type_name);
            }
        }

		user = {
			id: rows[0].id.toString(), //We need to ensure user id's are strings
			email: rows[0].email,
			name: rows[0].name,
			surname: rows[0].surname,
			birthdate: rows[0].birthdate,
			address: rows[0].address,
			postal_code: rows[0].postal_code,
			city: rows[0].city,
			region: rows[0].region,
			country: rows[0].country,
			time_zone: rows[0].time_zone,
			nationality: rows[0].nationality,
			phone: rows[0].phone,
			image_url: rows[0].image_url,
			bio: rows[0].bio,
			hasBank: (rows[0].bank_id !== null),
			buyer_fee: rows[0].buyer_fee,
			seller_fee: rows[0].seller_fee,
			vatnum: rows[0].vatnum,
			band_name: rows[0].band_name,
			company_name: rows[0].company_name,
			user_types: userTypes
		};
		user.currency = Localization.getCurrency(user.country);
		callback(null, user);
    });
};

/**
 * Returns full user records. Should not be passed through the API as some information must not reach the client.
 */
readCompleteUsers = function(userIDs, callback) {
	var queryParameters = [],
		sql, i;
	if(userIDs.length <= 0) {
		callback(null, []);
		return;
	}
	sql = "SELECT id, fbid, mangopay_id, email, name, surname, birthdate, address, postal_code, city, region, country, time_zone, nationality, phone, image_url, bio, bank_id, buyer_fee, seller_fee, fb_token FROM users WHERE id IN(";
	for(i = 0; i < userIDs.length - 1; i++) {
		 sql += "?, ";
		 queryParameters.push(userIDs[i]);
	}
	sql += "?) ORDER BY FIELD(id, ";
	queryParameters.push(userIDs[userIDs.length - 1]);
	for(i = 0; i < userIDs.length - 1; i++) {
		sql += "?, ";
		queryParameters.push(userIDs[i]);
	}
	sql += "?) LIMIT " + userIDs.length + ";";
	queryParameters.push(userIDs[userIDs.length - 1]);
	
	db.query(sql, queryParameters, function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length < userIDs.length) {
			callback("No users found for all provided IDs.");
			return;
		}
		for(i = 0; i < rows.length; i++) {
			rows[i].id = rows[i].id.toString();
			rows[i].currency = Localization.getCurrency(rows[i].country);
		}
		callback(null, rows);
	});
};

update = function(userID, updatedInfo, callback) {
	var User = this;
	db.query("SELECT id, mangopay_id, email, name, surname, birthdate, address, postal_code, city, region, country, time_zone, nationality, phone, image_url, bio, vatnum FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		var userInfo, updateUser, updatePaymentUser, newCurrency;
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
			time_zone: (updatedInfo.time_zone ? updatedInfo.time_zone : rows[0].time_zone),
			nationality: (updatedInfo.nationality ? updatedInfo.nationality : rows[0].nationality),
			phone: (updatedInfo.phone ? updatedInfo.phone : rows[0].phone),
			image_url: (updatedInfo.image_url ? updatedInfo.image_url : rows[0].image_url),
			bio: (updatedInfo.bio ? updatedInfo.bio : rows[0].bio),
			vatnum: (updatedInfo.vatnum ? updatedInfo.vatnum : rows[0].vatnum),
			band_name: (updatedInfo.band_name ? updatedInfo.band_name : rows[0].band_name),
			company_name: (updatedInfo.company_name ? updatedInfo.company_name : rows[0].company_name),
			user_types: (updatedInfo.user_types ? updatedInfo.user_types : []),
			hasBank: (rows[0].bank_id !== null),
			id: userID
		};
		
		if(checkLocales(userInfo) === false) {
			callback("Locale not supported.");
			return;
		}

		updateUser = function(mangopay_id) {
			var userInfoArray;
			userInfoArray = [mangopay_id, userInfo.email, userInfo.name, userInfo.surname, userInfo.birthdate, userInfo.address, userInfo.postal_code, userInfo.city, userInfo.region, userInfo.country, userInfo.time_zone, userInfo.nationality, userInfo.phone, userInfo.image_url, userInfo.bio, userInfo.vatnum, userInfo.band_name, userInfo.company_name, userInfo.id];
			db.query("UPDATE users SET mangopay_id=?, email=?, name=?, surname=?, birthdate=?, address=?, postal_code=?, city=?, region=?, country=?, time_zone=?, nationality=?, phone=?, image_url=?, bio=?, vatnum=?, band_name=?, company_name=? WHERE id=? LIMIT 1", userInfoArray, function(error) {
				if(error) {
					callback(error);
					return;
				}
				userInfo.hasWallet = true;
				userInfo.currency = Localization.getCurrency(userInfo.country);
		
				//Delete accessories and then add them
	            db.query("DELETE FROM has_user_types WHERE user_id=?;", [userID], function(error) {
	                if (error) {
	                    callback(error);
	                    return;
	                }
	                
	                User.getUserTypeID(updatedInfo.user_types, function(error, usertypesIDs) {
	                    if (error) {
	                        callback(error);
	                        return;
	                    }
	                    if (usertypesIDs.length <= 0) {
	                        callback(null, userInfo);
	                        return;
	                    }
	                    User.addUserTypes(userID, usertypesIDs, function(error) {
	                        if (error) {
	                            console.error("Error adding accessories: " + error);
	                            return;
	                        }
	                        callback(null, userInfo);
	                    });
	                });
	            });
			});
		};

		updatePaymentUser = function() {
			if(userInfo.birthdate === null || userInfo.address === null || userInfo.country === null || userInfo.nationality === null) {
				//We do not have enough data to create a Payment user
				updateUser(rows[0].mangopay_id);
			}
			else {
				Payment.updateUser(rows[0].mangopay_id, userInfo, function(error, mangopay_id) {
					if(error) {
						callback(error);
						return;
					}
					updateUser(mangopay_id);
				});
			}
		};

		//TODO: We need to separate pricing into it's own table and module
		if(userInfo.country !== rows[0].country) {
			//We need to update gear currencies
			newCurrency = Localization.getCurrency(userInfo.country);
			XChangeRates.getRate(Localization.getCurrency(rows[0].country), newCurrency, function(error, rate) {
				if(error) {
					callback(error);
					return;
				}
				db.query("UPDATE gear SET price_a=price_a*?, price_b=price_b*?, price_c=price_c*?, currency=? WHERE owner_id=?", [rate, rate, rate, newCurrency, userID], function(error) {
					if(error) {
						callback(error);
						return;
					}
					db.query("UPDATE vans SET price_a=price_a*?, price_b=price_b*?, price_c=price_c*?, currency=? WHERE owner_id=?", [rate, rate, rate, newCurrency, userID], function(error) {
						if(error) {
							callback(error);
							return;
						}
						updatePaymentUser();
					});
				});
			});
		}
		else {
			updatePaymentUser();
		}
	});
};

updateBankDetails = function(userID, bankDetails, callback) {
	db.query("SELECT id, mangopay_id, name, surname, address, country, bank_id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
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

		Payment.registerBankAccountForUser(rows[0], bankDetails, function(error, bank_id) {
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
	db.query("SELECT users.id, users.email, users.name, users.surname, users.birthdate, users.address, users.postal_code, users.city, users.region, users.country, users.nationality, users.phone, users.image_url, users.bio, users.mangopay_id, users.bank_id, users.buyer_fee, users.seller_fee, countries.vat, users.time_zone FROM users, countries WHERE id=? AND countries.code=users.country LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No user with id " + userID + ".");
			return;
		}
		rows[0].id = rows[0].id.toString();
		callback(null, rows[0]);
	});
};

getUsers = function(callback) {
	db.query("SELECT id, name, surname FROM users;", [], function(error, rows) {
		var i;
		if(error) {
			callback(error);
			return;
		}
		for(i = 0; i < rows.length; i++) {
			rows[i].id = rows[i].id.toString();
			rows[i].surname = rows[i].surname.substr(0, 1);
		}
		callback(null, rows);
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
	getClassification: getClassification,
	getUserFromFacebookID: getUserFromFacebookID,
	createUserFromFacebookInfo: createUserFromFacebookInfo,
	setServerAccessToken: setServerAccessToken,
	matchToken: matchToken,
	getToken: getToken,
	getUserTypesForUserWithID: getUserTypesForUserWithID,
	getUserTypeID: getUserTypeID,
	addUserTypes: addUserTypes,
	readPublicUser: readPublicUser,
	readUser: readUser,
	readCompleteUsers: readCompleteUsers,
	update: update,
	updateBankDetails: updateBankDetails,
	getCardObject: getCardObject,
	getUserWithMangoPayData: getUserWithMangoPayData,
	getUsers: getUsers
};
