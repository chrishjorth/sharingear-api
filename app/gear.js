/**
 * Defines Sharingear gear.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Moment = require("moment"),
	Config = require("./config"),

	getClassification,
	checkTypes,
	checkType,
	checkSubtype,
	checkBrand,
	checkOwner,
	getAccessoryIDs,
	addAccessories,
	getAlwaysFlag,
	setAlwaysFlag,
	getGearType,
	createGear,
	readGearFromUser,
	addImage,
	updateGearWithID,
	readGearWithID,
	search,
	getPrice,
	getOwner;

/**
 * @returns fx {
 *		guitar: ['electric', acoustic],
 *		amp: ['guitar amp', 'cabinet', 'combo']	
 * }
 */
getClassification = function(callback) {
	var sql;
	sql = "SELECT gear.gear_type, gear.subtype, gear.price_a_suggestion, gear.price_b_suggestion, gear.price_c_suggestion, accessories.accessory";
	sql += " FROM (SELECT gear_types.gear_type, gear_types.sorting, gear_subtypes.id AS gear_subtype_id, gear_subtypes.subtype, gear_subtypes.price_a_suggestion, gear_subtypes.price_b_suggestion, gear_subtypes.price_c_suggestion FROM gear_types, gear_subtypes WHERE gear_subtypes.type_id=gear_types.id) AS gear";
	sql += " LEFT JOIN (SELECT gear_accessories.accessory, gear_subtype_has_accessories.gear_subtype_id FROM gear_accessories, gear_subtype_has_accessories WHERE gear_subtype_has_accessories.gear_accessory_id=gear_accessories.id) AS accessories";
	sql += " ON accessories.gear_subtype_id=gear.gear_subtype_id ORDER BY gear.sorting, gear.subtype";
	db.query(sql, [], function(error, rows) {
		var currentType = "",
			currentSubtype = "",
			accessories = [],
			subtype, gearClassification, classification, i;

		if(error) {
			callback(error);
			return;
		}

		gearClassification = {
			classification: {},
			brands: []
		};
		classification = gearClassification.classification;

		//Merge accessories into array for each subtype
		//Assertion: the query returns rows sorted
		for(i = 0; i < rows.length; i++) {
			if(rows[i].subtype === currentSubtype) {
				if(rows[i].accessory !== null) {
					accessories.push(rows[i].accessory);
				}
			}
			else {
				//New subtype
				currentSubtype = rows[i].subtype;
				accessories = [];
				if(rows[i].accessory !== null) {
					accessories.push(rows[i].accessory);
				}
				subtype = {
					subtype:rows[i].subtype,
					accessories: accessories,
					price_a_suggestion: rows[i].price_a_suggestion,
					price_b_suggestion: rows[i].price_b_suggestion,
					price_c_suggestion: rows[i].price_c_suggestion
				};
				if(rows[i].gear_type !== currentType) {
					//Add new gear type
					currentType = rows[i].gear_type;
					classification[rows[i].gear_type] = [subtype];
				}
				else {
					classification[rows[i].gear_type].push(subtype);
				}
			}
		}

		db.query("SELECT name FROM gear_brands ORDER BY name", [], function(error, rows) {
			var i;
			if(error) {
				callback(error);
				return;
			}
			//We want Other to be at the bottom of the list
			for(i = 0; i < rows.length; i++) {
				if(rows[i].name !== "Other") {
					gearClassification.brands.push(rows[i].name);
				}
			}
			gearClassification.brands.push("Other");
			callback(null, gearClassification);
		});
	});
};

checkTypes = function(gearType, subtype, callback) {
	db.query("SELECT gear_types.id, gear_subtypes.id FROM gear_types, gear_subtypes WHERE gear_types.gear_type=? AND gear_subtypes.subtype=? AND gear_subtypes.type_id=gear_types.id LIMIT 1", [gearType, subtype], function(error, rows) {
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

/**
 * Checks that the type exists and returns the id
 */
checkType = function(gearType, callback) {
	db.query("SELECT id FROM gear_types WHERE gear_type=? LIMIT 1", [gearType], function(error, rows) {
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

/**
 * Checks that the subtype exists and belongs to the passed typeID.
 */
checkSubtype = function(subtype, typeID, callback) {
	db.query("SELECT gear_subtypes.id FROM gear_subtypes, gear_types WHERE gear_subtypes.subtype=? AND gear_subtypes.type_id=? LIMIT 1", [subtype, typeID], function(error, rows) {
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

/**
 * Checks that the brand exists and returns the id.
 */
checkBrand = function(brand, callback) {
	db.query("SELECT id FROM gear_brands WHERE name=? LIMIT 1", [brand], function(error, rows) {
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

checkOwner = function(userID, gearID, callback) {
	db.query("SELECT id FROM gear WHERE id=? AND owner_id=? LIMIT 1", [gearID, userID], function(error, rows) {
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

/**
 * Checks if the accessories are valid for the gear subtype. If not they will be stripped.
 * @param accessories: ["accessory1", "accessory2", ..., "accessoryN"]
 * @return array of accessory IDs for the valid passed accessories
 */
getAccessoryIDs = function(subtypeID, accessories, callback) {
	var sql, valueArray, i;
	sql = "SELECT gear_accessories.id FROM gear_accessories, gear_subtype_has_accessories WHERE gear_accessories.accessory IN (";
	valueArray = [];
	if(accessories.length <= 0) {
		callback(null, valueArray);
		return;
	}
	for(i = 0; i < accessories.length - 1; i++) {
		sql += "?, ";
		valueArray.push(accessories[i]);
	}
	sql += "?";
	valueArray.push(accessories[i], subtypeID);
	sql += ") AND gear_subtype_has_accessories.gear_subtype_id=? AND gear_subtype_has_accessories.gear_accessory_id=gear_accessories.id;";
	db.query(sql, valueArray, function(error, rows) {
		var accessoryIDs;
		if(error) {
			callback("Error getting accessory IDs: " + error);
			return;
		}
		accessoryIDs = [];
		for(i = 0; i < rows.length; i++) {
			accessoryIDs.push(rows[i].id);
		}
		callback(null, accessoryIDs);
	});
};

addAccessories = function(gearID, accessoryIDs, callback) {
	var sql, valueArray, i;
	if(accessoryIDs.length <= 0) {
		callback(null);
		return;
	}
	sql = "INSERT INTO gear_has_accessories(gear_id, accessory_id) VALUES ";
	valueArray = [];
	for(i = 0; i < accessoryIDs.length - 1; i++) {
		sql += "(?, ?), ";
		valueArray.push(gearID, accessoryIDs[i]);
	}
	sql += "(?, ?)";
	valueArray.push(gearID, accessoryIDs[i]);
	db.query(sql, valueArray, function(error) {
		if(error) {
			callback(error);
			return;
		}
		callback(null);
	});
};

getAlwaysFlag = function(gearID, callback) {
	db.query("SELECT always_available FROM gear WHERE id=? LIMIT 1", [gearID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear found for ID.");
			return;
		}
		callback(null, rows[0]);
	});
};

setAlwaysFlag = function(gearID, alwaysFlag, callback) {
	db.query("UPDATE gear SET always_available=? WHERE id=? LIMIT 1", [alwaysFlag, gearID], function(error) {
		if(error) {
			callback(error);
			return;
		}
		callback(null);
	});
};

getGearType = function(gearID, callback) {
	db.query("SELECT gear_type FROM gear WHERE id=? LIMIT 1;", [gearID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear for id.");
			return;
		}
		callback(null, rows[0].gear_type);
	});
};

/**
 * Latitude and longitude must be in degrees.
 */
createGear = function(newGear, callback) {
	var Gear = this,
		create;

	create = function() {
		var lat, lng, gear;
		//Convert to radians
		lat = parseFloat(newGear.latitude) * Math.PI / 180;
		if(isNaN(lat)) {
			lat = null;
		}
		lng = parseFloat(newGear.longitude) * Math.PI / 180;
		if(isNaN(lng)) {
			lng = null;
		}
		gear = [
			newGear.gear_type,
			newGear.subtype,
			newGear.brand,
			newGear.model,
			newGear.description,
			newGear.images,
			newGear.price_a,
			newGear.price_b,
			newGear.price_c,
			newGear.currency,
			newGear.address,
			newGear.postal_code,
			newGear.city,
			newGear.region,
			newGear.country,
			lat,
			lng,
			newGear.owner_id
		];

		db.query("INSERT INTO gear(gear_type, subtype, brand, model, description, images, price_a, price_b, price_c, currency, address, postal_code, city, region, country, latitude, longitude, updated, owner_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)", gear, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			if(!newGear.accessories || newGear.accessories === null) {
				newGear.accessories = [];
			}
			Gear.getAccessoryIDs(newGear.subtype, newGear.accessories, function(error, accessoryIDs) {
				if(error) {
					callback(error);
					return;
				}
				if(accessoryIDs.length <= 0) {
					callback(null, result.insertId);
					return;
				}
				Gear.addAccessories(result.insertId, accessoryIDs, function(error) {
					if(error) {
						callback(error);
						return;
					}
					callback(null, result.insertId);
				});
			});
		});
	};


	this.checkType(newGear.gear_type, function(error, typeID) {
		if(error) {
			callback(error);
			return;
		}
		if(typeID === null) {
			callback("Wrong type.");
			return;
		}
		newGear.gear_type = typeID;
		Gear.checkSubtype(newGear.subtype, typeID, function(error, subtypeID) {
			if(error) {
				callback(error);
				return;
			}
			if(subtypeID === null) {
				callback("Wrong subtype.");
				return;
			}
			newGear.subtype = subtypeID;
			Gear.checkBrand(newGear.brand, function(error, brandID) {
				if(error) {
					callback(error);
					return;
				}
				if(brandID === null) {
					callback("Wrong brand.");
					return;
				}
				newGear.brand = brandID;
				create();
			});
		});
	});
};

readGearFromUser = function(userID, callback) {
	var sql;
	//Get users gear, with names for type, subtype and brans and accessories
	sql = "SELECT gear.id, gear.gear_type, gear.subtype, gear.brand, gear.model, gear.description, gear.images, gear.price_a, gear.price_b, gear.price_c, gear.currency, gear.address, gear.postal_code, gear.city, gear.region, gear.country, gear.latitude, gear.longitude, gear.owner_id, accessories.accessory";
	sql += " FROM (SELECT gear.id, gear_types.gear_type, gear_subtypes.subtype, gear_brands.name AS brand, gear.model, gear.description, gear.images, gear.price_a, gear.price_b, gear.price_c, gear.currency, gear.address, gear.postal_code, gear.city, gear.region, gear.country, gear.latitude, gear.longitude, gear.owner_id FROM gear, gear_types, gear_subtypes, gear_brands WHERE gear.owner_id=? AND gear_types.id=gear.gear_type AND gear_subtypes.id=gear.subtype AND gear_brands.id=gear.brand) AS gear";
	sql += " LEFT JOIN (SELECT gear_has_accessories.gear_id, gear_accessories.accessory FROM gear_has_accessories, gear_accessories WHERE gear_has_accessories.accessory_id=gear_accessories.id) AS accessories ON accessories.gear_id=gear.id;";
	db.query(sql, [userID], function(error, rows) {
		var gear, accessories, i, currentGearID, gearItem;
		if(error) {
			callback(error);
			return;
		}
		gear = [];
		accessories = [];
		//Convert latitudes and longitudes and merge rows of same gear because of accessories
		for(i = 0; i < rows.length; i++) {
			gearItem = rows[i];
			if(gearItem.id === currentGearID) {
				if(gearItem.accessory !== null) {
					gear[gear.length - 1].accessories.push(gearItem.accessory);
				}
			}
			else {
				currentGearID = gearItem.id;
				accessories = [];
				gearItem.latitude = gearItem.latitude * 180 / Math.PI;
				gearItem.longitude = gearItem.longitude * 180 / Math.PI;
				if(gearItem.accessory !== null) {
					accessories.push(gearItem.accessory);
				}
				gear.push({
					id: gearItem.id,
					gear_type: gearItem.gear_type,
					subtype: gearItem.subtype,
					brand: gearItem.brand,
					model: gearItem.model,
					description: gearItem.description,
					images: gearItem.images,
					price_a: gearItem.price_a,
					price_b: gearItem.price_b,
					price_c: gearItem.price_c,
					currency: gearItem.currency,
					address: gearItem.address,
					postal_code: gearItem.postal_code,
					city: gearItem.city,
					region: gearItem.region,
					country: gearItem.country,
					latitude: gearItem.latitude,
					longitude: gearItem.longitude,
					owner_id: gearItem.owner_id,
					accessories: accessories
				});
			}
		}
		callback(null, gear);
	});
};

addImage = function(userID, gearID, imageURL, callback) {
	db.query("SELECT images FROM gear WHERE id=? AND owner_id=? LIMIT 1", [gearID, userID], function(error, rows) {
		var images = "";
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear found.");
			return;
		}
		images = rows[0].images + imageURL + ",";
		db.query("UPDATE gear SET images=? WHERE id=? AND owner_id=?", [images, gearID, userID], function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			if(result.affectedRows <= 0) {
				callback("No gear found to update.");
				return;
			}
			callback(null, images);
		});
	});
};

/**
 * Latitude and longitude must be in degrees.
 */
updateGearWithID = function(gearID, updatedGearData, callback) {
	var Gear = this,
		update;

	update = function() {
		var lat, lng, inputs;
		//convert to radians
		lat = parseFloat(updatedGearData.latitude) * Math.PI / 180;
		if(isNaN(lat)) {
			lat = null;
		}
		lng = parseFloat(updatedGearData.longitude) * Math.PI / 180;
		if(isNaN(lng)) {
			lng = null;
		}
		inputs = [
			updatedGearData.subtype,
			updatedGearData.brand,
			updatedGearData.model,
			updatedGearData.description,
			updatedGearData.images,
			updatedGearData.price_a,
			updatedGearData.price_b,
			updatedGearData.price_c,
			updatedGearData.currency,
			updatedGearData.address,
			updatedGearData.postal_code,
			updatedGearData.city,
			updatedGearData.region,
			updatedGearData.country,
			lat,
			lng,
			gearID
		];

		db.query("UPDATE gear SET subtype=?, brand=?, model=?, description=?, images=?, price_a=?, price_b=?, price_c=?, currency=?, address=?, postal_code=?, city=?, region=?, country=?, latitude=?, longitude=?, updated=NULL WHERE id=? LIMIT 1", inputs, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			if(result.affectedRows <= 0) {
				callback("No gear found to update.");
				return;
			}
			//Delete accessories and then add them
			db.query("DELETE FROM gear_has_accessories WHERE gear_id=?;", [gearID], function(error) {
				if(error) {
					callback(error);
					return;
				}
				updatedGearData.accessories = JSON.parse(updatedGearData.accessories);
				Gear.getAccessoryIDs(updatedGearData.subtype, updatedGearData.accessories, function(error, accessoryIDs) {
					if(error) {
						callback(error);
						return;
					}
					if(accessoryIDs.length <= 0) {
						callback(null, gearID);
						return;
					}
					Gear.addAccessories(gearID, accessoryIDs, function(error) {
						if(error) {
							console.log("Error adding accessories: " + error);
							return;
						}
						callback(null, updatedGearData);
					});
				});
			});
		});
	};

	this.getGearType(gearID, function(error, typeID) {
		if(error) {
			console.log("Error retrieving gear type: " + error);
			return;
		}
		Gear.checkSubtype(updatedGearData.subtype, typeID, function(error, subtypeID) {
			if(error) {
				callback(error);
				return;
			}
			if(subtypeID === null) {
				callback("Wrong subtype.");
				return;
			}
			updatedGearData.subtype = subtypeID;
			Gear.checkBrand(updatedGearData.brand, function(error, brandID) {
				if(error) {
					callback(error);
					return;
				}
				updatedGearData.brand = brandID;
				if(brandID === null) {
					callback("Wrong brand.");
					return;
				}
				update();
			});
		});	
	});
};

readGearWithID = function(gearID, callback) {
	var sql;
	sql = "SELECT gear.id, gear.gear_type, gear.subtype, gear.brand, gear.model, gear.description, gear.images, gear.price_a, gear.price_b, gear.price_c, gear.currency, gear.address, gear.postal_code, gear.city, gear.region, gear.country, gear.latitude, gear.longitude, gear.owner_id, accessories.accessory";
	sql += " FROM (SELECT gear.id, gear_types.gear_type, gear_subtypes.subtype, gear_brands.name AS brand, gear.model, gear.description, gear.images, gear.price_a, gear.price_b, gear.price_c, gear.currency, gear.address, gear.postal_code, gear.city, gear.region, gear.country, gear.latitude, gear.longitude, gear.owner_id FROM gear, gear_types, gear_subtypes, gear_brands WHERE gear.id=? AND gear_types.id=gear.gear_type AND gear_subtypes.id=gear.subtype AND gear_brands.id=gear.brand LIMIT 1) AS gear";
	sql += " LEFT JOIN (SELECT gear_has_accessories.gear_id, gear_accessories.accessory FROM gear_has_accessories, gear_accessories WHERE gear_has_accessories.accessory_id=gear_accessories.id) AS accessories ON accessories.gear_id=gear.id;";
	db.query(sql, [gearID], function(error, rows) {
		var gear, gearItem, accessories, i;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear found for the id.");
			return;
		}
		accessories = [];
		for(i = 0; i < rows.length; i++) {
			if(rows[i].accessory !== null) {
				accessories.push(rows[i].accessory);
			}
		}
		gearItem = rows[0];
		gear = {
			id: gearItem.id,
			gear_type: gearItem.gear_type,
			subtype: gearItem.subtype,
			brand: gearItem.brand,
			model: gearItem.model,
			description: gearItem.description,
			images: gearItem.images,
			price_a: gearItem.price_a,
			price_b: gearItem.price_b,
			price_c: gearItem.price_c,
			currency: gearItem.currency,
			address: gearItem.address,
			postal_code: gearItem.postal_code,
			city: gearItem.city,
			region: gearItem.region,
			country: gearItem.country,
			latitude: gearItem.latitude * 180 / Math.PI,
			longitude: gearItem.longitude * 180 / Math.PI,
			owner_id: gearItem.owner_id,
			accessories: accessories
		};
		callback(null, gear);
	});
};

/**
 * @param lat: Latitude in degrees
 * @param lng: Longitude in degrees
 */
search = function(location, gear, callback) {
	//Do a full text search on gear, then narrow down by location, because location search is slower.
	db.search("SELECT id, gear_type, subtype, brand, model, city, country, images, price_a, price_b, price_c, currency, latitude, longitude, owner_id FROM gear_main, gear_delta WHERE MATCH(?) ORDER BY id DESC LIMIT 100", [gear], function(error, rows) {
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
		sql = "SELECT id, gear_type, subtype, brand, model, city, country, images, price_a, price_b, price_c, currency, latitude, longitude, owner_id, GEODIST(?, ?, latitude, longitude) AS distance FROM gear_main, gear_delta WHERE id IN (";
		for(i = 0; i < rows.length - 1; i++) {
			sql += rows[i].id + ",";
		}
		sql += rows[rows.length - 1].id; //rows has at least one item
		sql += ") AND distance <= ?.0  ORDER BY distance ASC, id DESC LIMIT 100";
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

getOwner = function(gearID, callback) {
	db.query("SELECT owner_id FROM gear WHERE id=? LIMIT 1", [gearID], function(error, rows) {
		if(error) {
			callback("Error retrieving owner of gear: " + error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear found for id.");
			return;
		}
		callback(null, rows[0].owner_id);
	});
};

module.exports = {
	getClassification: getClassification,
	checkTypes: checkTypes,
	checkType: checkType,
	checkSubtype: checkSubtype,
	checkBrand: checkBrand,
	checkOwner: checkOwner,
	getAccessoryIDs: getAccessoryIDs,
	addAccessories: addAccessories,
	getAlwaysFlag: getAlwaysFlag,
	setAlwaysFlag: setAlwaysFlag,
	getGearType: getGearType,
	createGear: createGear,
	readGearFromUser: readGearFromUser,
	addImage: addImage,
	updateGearWithID: updateGearWithID,
	readGearWithID: readGearWithID,
	search: search,
	getPrice: getPrice,
	getOwner: getOwner
};

