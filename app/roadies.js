/**
 * Defines Sharingear roadies.
 * Van types are handled by type IDs, but returned by their names.
 * @author: Chris Hjorth
 */
 
/*jslint node: true */
"use strict";

var db = require("./database"),
	Moment = require("moment"),
	Config = require("./config"),
	
	getClassification,

	readRoadiesFromUser,
	createRoadies,
	getTypeID,
	getTypeName,
	updateRoadieWithID,
	setAlwaysFlag,
	getAlwaysFlag,
	checkOwner,
	readRoadieWithID,
	search,
	getPrice;

getClassification = function(callback) {
	var sql = "SELECT roadie_type FROM roadie_types ORDER BY sorting;";
	db.query(sql, [], function(error, rows) {
		var roadieTypes = [],
			i;
		if(error) {
			callback(error);
			return;
		}
		for(i = 0; i < rows.length; i++) {
			roadieTypes.push(rows[i].roadie_type);
		}
		callback(null, roadieTypes);
	});
};

readRoadiesFromUser = function(userID, callback) {
	var sql;
	//Get users gear, with names for type, subtype and brans and accessories
	sql = "";
	db.query(sql, [userID], function(error, rows) {
		var roadies = [],
			roadieItem, i;
		if(error) {
			callback(error);
			return;
		}
		roadies = [];
		//Convert latitudes and longitudes and merge rows of same gear because of accessories
		for(i = 0; i < rows.length; i++) {
			roadieItem = rows[i];
			roadieItem.latitude = roadieItem.latitude * 180 / Math.PI;
			roadieItem.longitude = roadieItem.longitude * 180 / Math.PI;	
			roadies.push({
				id: roadieItem.id,
				roadie_type: roadieItem.van_type,
				price_a: roadieItem.price_a,
				price_b: roadieItem.price_b,
				price_c: roadieItem.price_c,
				currency: roadieItem.currency,
				address: roadieItem.address,
				postal_code: roadieItem.postal_code,
				city: roadieItem.city,
				region: roadieItem.region,
				country: roadieItem.country,
				latitude: roadieItem.latitude,
				longitude: roadieItem.longitude,
				owner_id: roadieItem.owner_id,
			});
		}
		callback(null, roadies);
	});
};

createRoadies = function(userID, params, callback) {
	var roadies = this;
	//Check if user is owner
	if(userID !== params.owner_id) {
		callback("User creating roadie and owner do not match.");
		return;
	}
	//Check if owner exists
	db.query("SELECT id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("Owner does not exist.");
			return;
		}
		//Check type
		roadies.getTypeID(params.roadie_type, function(error, typeID) {
			var newRoadie, now;
			if(error) {
				callback(error);
				return;
			}
			if(typeID === null) {
				callback("Illegal roadie type.");
				return;
			}
			now = new Moment();
			newRoadie = [
				typeID,
				params.price_a,
				params.price_b,
				params.price_c,
				params.currency,
				params.address,
				params.postal_code,
				params.city,
				params.region,
				params.country,
				params.latitude,
				params.longitude,
				0, //never available is default
				userID
			];
			//insert
			db.query("INSERT INTO roadies(roadie_type, price_a, price_b, price_c, currency, address, postal_code, city, region, country, latitude, longitude, always_available, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", newRoadie, function(error, result) {
				if(error) {
					callback(error);
					return;
				}
				//Insert accessories
				roadies.addAccessories(result.insertId, typeID, params.accessories, function(error) {
					if(error) {
						callback(error);
						return;
					}
					//return object 
					callback(null, {
						id: result.insertId,
						roadie_type: params.roadie_type,
						price_a: params.price_a,
						price_b: params.price_b,
						price_c: params.price_c,
						currency: params.currency,
						address: params.address,
						postal_code: params.postal_code,
						city: params.city,
						region: params.region,
						country: params.country,
						latitude: params.latitude,
						longitude: params.longitude,
						updated: now.format("YYYY-MM-DD HH:mm:ss"),
						owner_id: userID
					});
				});
			});
		});
	});
};

/**
 * @callback arg1: error, null if no error
 * @callback arg2: the id of the roadie type if it is registered in the database, null otherwise.
 */
getTypeID = function(roadieType, callback) {
	db.query("SELECT id FROM roadie_types WHERE roadie_type=? LIMIT 1", [roadieType], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, null);
		}
		else {
			callback(null, rows[0].id);
		}
	});
};

getTypeName = function(roadieTypeID, callback) {
	db.query("SELECT roadie_type FROM roadie_types WHERE id=? LIMIT 1;", [roadieTypeID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, null);
		}
		else {
			callback(null, rows[0].roadie_type);
		}
	});
};

/**
 * Latitude and longitude must be in degrees.
 */
updateRoadieWithID = function(userID, roadieID, updatedRoadieData, callback) {
	var roadies = this;
	db.query("SELECT id, roadie_type, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, always_available, owner_id FROM roadies WHERE id=? LIMIT 1;", [roadieID], function(error, rows) {
		var update;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No roadie with id " + roadieID + " to update.");
			return;
		}
		//Check if user is owner
		if(parseInt(userID, 10) !== rows[0].owner_id) {
			callback("User is not owner.");
			return;
		}

		update = function(roadieTypeID, roadieTypeName) {
			var roadieInfo;
			if(updatedRoadieData.latitude) {
				updatedRoadieData.latitude = parseFloat(updatedRoadieData.latitude) * Math.PI / 180;
				if(isNaN(updatedRoadieData.latitude)) {
					updatedRoadieData.latitude = null;
				}
			}
			if(updatedRoadieData.longitude) {
				updatedRoadieData.longitude = parseFloat(updatedRoadieData.longitude) * Math.PI / 180;
				if(isNaN(updatedRoadieData.longitude)) {
					updatedRoadieData.longitude = null;
				}
			}
			roadieInfo = [
				roadieTypeID,
				(updatedRoadieData.description ? updatedRoadieData.description : rows[0].description),
				(updatedRoadieData.price_a ? updatedRoadieData.price_a : rows[0].price_a),
				(updatedRoadieData.price_b ? updatedRoadieData.price_b : rows[0].price_b),
				(updatedRoadieData.price_c ? updatedRoadieData.price_c : rows[0].price_c),
				(updatedRoadieData.currency ? updatedRoadieData.currency : rows[0].currency),
				(updatedRoadieData.address ? updatedRoadieData.address : rows[0].address),
				(updatedRoadieData.postal_code ? updatedRoadieData.postal_code : rows[0].postal_code),
				(updatedRoadieData.city ? updatedRoadieData.city : rows[0].city),
				(updatedRoadieData.region ? updatedRoadieData.region : rows[0].region),
				(updatedRoadieData.country ? updatedRoadieData.country : rows[0].country),
				(updatedRoadieData.latitude ? updatedRoadieData.latitude : rows[0].latitude),
				(updatedRoadieData.longitude ? updatedRoadieData.longitude : rows[0].longitude),
				roadieID
			];
			db.query("UPDATE roadies SET roadie_type=?, model=?, description=?, price_a=?, price_b=?, price_c=?, currency=?, address=?, postal_code=?, city=?, region=?, country=?, latitude=?, longitude=? WHERE id=? LIMIT 1;", roadieInfo, function(error, result) {
				if(error) {
					callback(error);
					return;
				}
				if(result.affectedRows <= 0) {
					callback("Found no van to update.");
					return;
				}
				//Delete accessories and then add them
				db.query("DELETE FROM roadie_has_accessories WHERE roadie_id=?;", [roadieID], function(error) {
					if(error) {
						callback(error);
						return;
					}
					updatedRoadieData.accessories = JSON.parse(updatedRoadieData.accessories);
					roadies.addAccessories(roadieID, roadieInfo[0], updatedRoadieData.accessories, function(error) {
						var now = new Moment();
						if(error) {
							callback(error);
							return;
						}
						callback(null, {
							id: roadieID,
							roadie_type: roadieTypeName,
							description: roadieInfo[2],
							price_a: roadieInfo[3],
							price_b: roadieInfo[4],
							price_c: roadieInfo[5],
							currency: roadieInfo[6],
							address: roadieInfo[7],
							postal_code: roadieInfo[8],
							city: roadieInfo[9],
							region: roadieInfo[10],
							country: roadieInfo[11],
							latitude: roadieInfo[12],
							longitude: roadieInfo[13],
							always_available: rows[0].always_available,
							updated: now.format("YYYY-MM-DD HH:mm:ss"),
							owner_id: userID
						});
					});
				});
			});
		};

		if(updatedRoadieData.roadie_type) {
			//Check if van type is legal
			roadies.getTypeID(updatedRoadieData.roadie_type, function(error, typeID) {
				if(error) {
					callback(error);
					return;
				}
				if(typeID === null) {
					callback("Invalid roadie type.");
					return;
				}
				update(typeID, updatedRoadieData.roadie_type);
			});
		}
		else {
			roadies.getTypeName(rows[0].roadie_type, function(error, typeName) {
				if(error) {
					callback(error);
					return;
				}
				if(typeName === null) {
					callback("Invalid type ID.");
					return;
				}
				update(rows[0].roadie_type, typeName);
			});
		}
	});
};

setAlwaysFlag = function(roadieID, alwaysFlag, callback) {
	db.query("UPDATE roadies SET always_available=? WHERE id=? LIMIT 1", [alwaysFlag, roadieID], function(error) {
		if(error) {
			callback(error);
			return;
		}
		callback(null);
	});
};

getAlwaysFlag = function(roadieID, callback) {
	db.query("SELECT always_available FROM roadies WHERE id=? LIMIT 1", [roadieID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No roadies found for ID.");
			return;
		}
		callback(null, rows[0]);
	});
};

checkOwner = function(userID, roadieID, callback) {
	db.query("SELECT id FROM roadies WHERE id=? AND owner_id=? LIMIT 1", [roadieID, userID], function(error, rows) {
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

readRoadieWithID = function(roadieID, callback) {
	var sql;
	sql = ";";
	db.query(sql, [roadieID], function(error, rows) {
		var roadie, roadieItem;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No roadies found for the id.");
			return;
		}
		roadieItem = rows[0];
		roadie = {
			id: roadieItem.id,
			roadie_type: roadieItem.roadie_type,
			price_a: roadieItem.price_a,
			price_b: roadieItem.price_b,
			price_c: roadieItem.price_c,
			currency: roadieItem.currency,
			address: roadieItem.address,
			postal_code: roadieItem.postal_code,
			city: roadieItem.city,
			region: roadieItem.region,
			country: roadieItem.country,
			latitude: roadieItem.latitude * 180 / Math.PI,
			longitude: roadieItem.longitude * 180 / Math.PI,
			owner_id: roadieItem.owner_id
		};
		callback(null, roadie);
	});
};

search = function(location, roadie, callback) {
	//Do a full text search on roadies, then narrow down by location, because location search is slower.
	db.search("SELECT id, roadie_type, model, city, country, price_a, price_b, price_c, currency, latitude, longitude, owner_id FROM roadies_main, roadies_delta WHERE MATCH(?) LIMIT 100", [roadie], function(error, rows) {
		var latLngArray, lat, lng, sql, i;
		if(error) {
			console.log("Error searching for match: " + JSON.stringify(error));
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, []);
			return;
		}
		if(location === "all") {
			for(i = 0; i < rows.length; i++) {
				rows[i].latitude = rows[i].latitude * 180 / Math.PI;
				rows[i].longitude = rows[i].longitude * 180 / Math.PI;
			}
			callback(null, rows);
			return;
		}
		latLngArray = location.split(",");
		lat = latLngArray[0];
		lng = latLngArray[1];
		//Convert to radians
		lat = parseFloat(lat) * Math.PI / 180;
		lng = parseFloat(lng) * Math.PI / 180;
		sql = "SELECT id, roadie_type, model, city, country, price_a, price_b, price_c, currency, latitude, longitude, owner_id, GEODIST(?, ?, latitude, longitude) AS distance FROM roadies_main, roadies_delta WHERE id IN (";
		for(i = 0; i < rows.length - 1; i++) {
			sql += rows[i].id + ",";
		}
		sql += rows[rows.length - 1].id; //rows has at least one item
		sql += ") AND distance <= ?.0  ORDER BY distance ASC LIMIT 100";
		db.search(sql, [lat, lng, Config.SEARCH_RADIUS], function(error, rows) {
			var i;
			if(error) {
				console.log("Error filtering by location: " + JSON.stringify(error));
				callback(error);
				return;
			}
			for(i = 0; i < rows.length; i++) {
				rows[i].latitude = rows[i].latitude * 180 / Math.PI;
				rows[i].longitude = rows[i].longitude * 180 / Math.PI;
			}
			callback(null, rows);
		});
	});
};

//TODO: Move this to a general utility or into payment, depending of circular reference risk
getPrice = function(priceA, priceB, priceC, startTime, endTime) {
	var startMoment, endMoment, months, weeks, days, price;
	startMoment = new Moment(startTime, "YYYY-MM-DD HH:mm:ss");
	endMoment = new Moment(endTime, "YYYY-MM-DD HH:mm:ss");
	months = parseInt(endMoment.diff(startMoment, "months"), 10);
	endMoment.subtract(months, "months");
	weeks = parseInt(endMoment.diff(startMoment, "weeks"), 10);
	endMoment.subtract(weeks, "weeks");
	days = parseInt(endMoment.diff(startMoment, "days"), 10);
	price = priceA * days + priceB * weeks + priceC * months;
	return price;
};

module.exports = {
	getClassification: getClassification,
	readRoadiesFromUser: readRoadiesFromUser,
	createRoadies: createRoadies,
	getTypeID: getTypeID,
	getTypeName: getTypeName,
	updateRoadieWithID: updateRoadieWithID,
	setAlwaysFlag: setAlwaysFlag,
	getAlwaysFlag: getAlwaysFlag,
	checkOwner: checkOwner,
	readRoadieWithID: readRoadieWithID,
	search: search,
	getPrice: getPrice
};
