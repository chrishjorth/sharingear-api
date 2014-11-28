/**
 * Defines Sharingear gear.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
	Moment = require("moment"),

	getClassification,
	checkTypes,
	checkType,
	checkSubtype,
	checkBrand,
	checkOwner,
	getAlwaysFlag,
	setAlwaysFlag,
	createGear,
	readGearFromUser,
	addImage,
	updateGearWithID,
	readGearWithID,
	search,
	getPrice,
	getOwner,
	setStatus,
	checkForRentals;

/**
 * @returns fx {
 *		guitar: ['electric', acoustic],
 *		amp: ['guitar amp', 'cabinet', 'combo']	
 * }
 */
getClassification = function(callback) {
	db.query("SELECT gear_types.gear_type, gear_subtypes.subtype FROM gear_types, gear_subtypes WHERE gear_subtypes.type_id=gear_types.id ORDER BY gear_types.sorting", [], function(error, rows) {
		var currentGear = "",
			gearClassification, classification, i;

		gearClassification = {
			classification: {},
			brands: []
		};
		classification = gearClassification.classification;

		if(error) {
			callback(error);
			return;
		}
		//Assertion: the query returns rows sorted
		for(i = 0; i < rows.length; i++) {
			if(rows[i].gear_type !== currentGear) {
				currentGear = rows[i].gear_type;
				//Add new gear type
				classification[rows[i].gear_type] = [rows[i].subtype];
			}
			else {
				classification[rows[i].gear_type].push(rows[i].subtype);
			}
		}

		db.query("SELECT name FROM gear_brands ORDER BY name", [], function(error, rows) {
			var i;
			if(error) {
				callback(error);
				return;
			}
			for(i = 0; i < rows.length; i++) {
				gearClassification.brands.push(rows[i].name);
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

checkType = function(gearType, callback) {
	db.query("SELECT id FROM gear_types WHERE gear_type=? LIMIT 1", [gearType], function(error, rows) {
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
 * @return true for valid subtype or empty string. Empty string counts as valid in order to allow undefined subtype.
 */
checkSubtype = function(subtype, callback) {
	if(subtype === "") {
		callback(null, true);
		return;
	}
	db.query("SELECT id FROM gear_subtypes WHERE subtype=? LIMIT 1", [subtype], function(error, rows) {
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
 * @return true for valid subtype or empty string. Empty string counts as valid in order to allow undefined brand.
 */
checkBrand = function(brand, callback) {
	if(brand === "") {
		callback(null, true);
		return;
	}
	db.query("SELECT id FROM gear_brands WHERE name=? LIMIT 1", [brand], function(error, rows) {
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
			newGear.type,
			newGear.subtype,
			newGear.brand,
			newGear.model,
			newGear.description,
			newGear.images,
			newGear.price_a,
			newGear.price_b,
			newGear.price_c,
			newGear.address,
			newGear.postal_code,
			newGear.city,
			newGear.region,
			newGear.country,
			lat,
			lng,
			newGear.owner_id
		];

		db.query("INSERT INTO gear(type, subtype, brand, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, updated, owner_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)", gear, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			callback(null, result.insertId);
			db.index();
		});
	};


	this.checkType(newGear.type, function(error, correct) {
		if(error) {
			callback(error);
			return;
		}
		if(correct === false) {
			callback("Wrong type.");
			return;
		}

		Gear.checkSubtype(newGear.subtype, function(error, correct) {
			if(error) {
				callback(error);
				return;
			}
			if(correct === false) {
				callback("Wrong subtype.");
				return;
			}

			Gear.checkBrand(newGear.brand, function(error, correct) {
				if(error) {
					callback(error);
					return;
				}
				if(correct === false) {
					callback("Wrong brand.");
					return;
				}
				create();
			});
		});
	});
};

readGearFromUser = function(userID, callback) {
	//Check if any gear is rented out
	checkForRentals(userID, function(error) {
		if(error) {
			callback("Error checking users gear for rentals: " + error);
			return;
		}
		db.query("SELECT usergear.id, usergear.type, usergear.subtype, usergear.brand, usergear.model, usergear.description, usergear.images, usergear.price_a, usergear.price_b, usergear.price_c, usergear.address, usergear.postal_code, usergear.city, usergear.region, usergear.country, usergear.latitude, usergear.longitude, usergear.gear_status, usergear.owner_id, bookings.booking_status FROM bookings RIGHT JOIN (SELECT gear.id, gear.type, gear.subtype, gear.brand, gear.model, gear.description, gear.images, gear.price_a, gear.price_b, gear.price_c, gear.address, gear.postal_code, gear.city, gear.region, gear.country, gear.latitude, gear.longitude, gear.gear_status, gear.owner_id FROM gear WHERE gear.owner_id=?) as usergear ON bookings.gear_id=usergear.id GROUP BY usergear.id;", [userID], function(error, rows) {
			var i;
			if(error) {
				callback(error);
				return;
			}
			//Convert latitudes and longitudes
			for(i = 0; i < rows.length; i++) {
				rows[i].latitude = rows[i].latitude * 180 / Math.PI;
				rows[i].longitude = rows[i].longitude * 180 / Math.PI;
			}
			callback(null, rows);
		});
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
		console.log("images selected");
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
			console.log("images updated");
			callback(null, images);
			db.index();
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
			updatedGearData.address,
			updatedGearData.postal_code,
			updatedGearData.city,
			updatedGearData.region,
			updatedGearData.country,
			lat,
			lng,
			gearID
		];

		db.query("UPDATE gear SET subtype=?, brand=?, model=?, description=?, images=?, price_a=?, price_b=?, price_c=?, address=?, postal_code=?, city=?, region=?, country=?, latitude=?, longitude=?, updated=NULL WHERE id=? LIMIT 1", inputs, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			if(result.affectedRows <= 0) {
				callback("No gear found to update.");
				return;
			}
			callback(null);
			db.index();
		});
	};

	this.checkSubtype(updatedGearData.subtype, function(error, correct) {
		if(error) {
			callback(error);
			return;
		}
		if(correct === false) {
			callback("Wrong subtype.");
			return;
		}

		Gear.checkBrand(updatedGearData.brand, function(error, correct) {
			if(error) {
				callback(error);
				return;
			}
			if(correct === false) {
				callback("Wrong brand.");
				return;
			}
			update();
		});
	});	
};

readGearWithID = function(gearID, callback) {
	db.query("SELECT id, type, subtype, brand, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, gear_status, owner_id FROM gear WHERE id=? LIMIT 1", gearID, function(error, rows) {
		var gear;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear found for the id.");
			return;
		}
		gear = rows[0];
		if(gear.model === null) {
			gear.model = "";
		}
		if(gear.description === null) {
			gear.description = "";
		}
		if(gear.images === null) {
			gear.images = "";
		}
		if(gear.address === null) {
			gear.address = "";
		}
		if(gear.postal_code === null) {
			gear.postal_code = "";
		}
		if(gear.city === null) {
			gear.city = "";
		}
		if(gear.region === null) {
			gear.region = "";
		}
		if(gear.country === null) {
			gear.country = "";
		}
		gear.latitude = gear.latitude * 180 / Math.PI;
		gear.longitude = gear.longitude * 180 / Math.PI;
		callback(null, rows[0]);
	});
};

/**
 * @param lat: Latitude in degrees
 * @param lng: Longitude in degrees
 */
search = function(lat, lng, gear, callback) {
	//Do a full text search on gear, then narrow down by location, because location search is slower.
	//console.log('Search gear');
	db.search("SELECT id FROM gear_main, gear_delta WHERE MATCH(?) LIMIT 100", [gear], function(error, rows) {
		var sql, i;
		if(error) {
			console.log("Error searching for match: " + JSON.stringify(error));
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, []);
			return;
		}
		//console.log('Found gear by full text search');
		//Convert to radians
		lat = parseFloat(lat) * Math.PI / 180;
		lng = parseFloat(lng) * Math.PI / 180;
		sql = "SELECT id, type, subtype, brand, model, images, price_a, price_b, price_c, latitude, longitude, gear_status, owner_id, GEODIST(?, ?, latitude, longitude) AS distance FROM gear_main, gear_delta WHERE id IN (";
		for(i = 0; i < rows.length - 1; i++) {
			sql += rows[i].id + ",";
		}
		sql += rows[rows.length - 1].id; //rows has at least one item
		sql += ") AND distance <= 10000.0 ORDER BY distance ASC LIMIT 100";
		//console.log('Search location');
		//console.log('SQL:');
		//console.log(sql);
		//console.log('lat: ' + lat);
		//console.log('lng: ' + lng);
		db.search(sql, [lat, lng], function(error, rows) {
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
			//console.log('Found gear by location filter');
			//console.log(JSON.stringify(rows));
			callback(null, rows);
		});
	});
};

/*function createGearBulk(ownerID, gearList, callback) {
	var create, types, typesSQL, subtypes, subtypesSQL, brands, brandsSQL, i, gearItem;

	create = function() {
		var gearArray = [],
			sql, i, gear;
		sql = "INSERT INTO gear(type, subtype, brand, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, updated, owner_id) VALUES ";
		for(i = 0; i < gearList.length; i++) {
			gear = gearList[i];
			if(!gear.type) {
				callback('Type is missing for gear.');
				return;
			}
			if(!gear.subtype) {
				gear.subtype = '';
			}
			if(!gear.brand) {
				gear.brand = '';
			}
			if(!gear.model) {
				gear.model = '';
			}
			if(!gear.description) {
				gear.description = '';
			}
			if(!gear.images) {
				gear.images = '';
			}
			if(!gear.price_a) {
				gear.price_a = '';
			}
			if(!gear.price_b) {
				gear.price_b = '';
			}
			if(!gear.price_c) {
				gear.price_c = '';
			}
			if(!gear.address) {
				gear.address = '';
			}
			if(!gear.postal_code) {
				gear.postal_code = '';
			}
			if(!gear.city) {
				gear.city = '';
			}
			if(!gear.region) {
				gear.region = '';
			}
			if(!gear.country) {
				gear.country = '';
			}
			if(!gear.latitude) {
				gear.latitude = '';
			}
			else {
				gear.latitude = parseFloat(gear.latitude) * Math.PI / 180
			}
			if(!gear.longitude) {
				gear.longitude = '';
			}
			else {
				gear.longitude = parseFloat(gear.longitude) * Math.PI / 180
			}
			gear.owner_id = ownerID;

			sql += "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)";
			gearArray.push(gear.type, gear.subtype, gear.brand, gear.model, gear.description, gear.images, gear.price_a, gear.price_b, gear.price_c, gear.address, gear.postal_code, gear.city, gear.region, gear.country, gear.latitude, gear.longitude, gear.owner_id);
			if(i < gearList.length - 1) {
				sql += ',';
			}
		}
		db.query(sql, gearArray, function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			callback(null);
			db.index();
		});
	};

	//Check that all types are valid, then the subtypes and then the brands
	types = [];
	typesSQL = "CREATE TEMPORARY TABLE IF NOT EXISTS templist (gear_type VARCHAR(45) NOT NULL);";
	typesSQL += "INSERT INTO templist(gear_type) VALUES";

	subtypes = [];
	subtypesSQL = "CREATE TEMPORARY TABLE IF NOT EXISTS templist (subtype VARCHAR(45) NOT NULL);";
	subtypesSQL += "INSERT INTO templist(subtype) VALUES";

	brands = [];
	brandsSQL = "CREATE TEMPORARY TABLE IF NOT EXISTS templist (brand VARCHAR(45) NOT NULL);";
	brandsSQL += "INSERT INTO templist(brand) VALUES";

	for(i = 0; i < gearList.length - 1; i++) {
		gearItem = gearList[i];
		types.push(gearItem.type);
		typesSQL += "(?),";
		if(gearItem.subtype && gearItem.subtype !== '' && gearItem.subtype !== null) {
			subtypes.push(gearItem.subtype);
			subtypesSQL += "(?),";
		}
		if(gearItem.brand && gearItem.brand !== '' && gearItem.brand !== null) {
			brands.push(gearItem.brand);
			brandsSQL += "(?),";
		}
	}

	gearItem = gearList[gearList.length - 1];
	types.push(gearItem.type);
	typesSQL += "(?);";
	typesSQL += "SELECT gear_type FROM templist WHERE gear_type NOT IN (SELECT gear_type FROM gear_types);";
	typesSQL += "DROP TABLE templist;";

	if(gearItem.subtype && gearItem.subtype !== '' && gearItem.subtype !== null) {
		subtypes.push(gearItem.subtype);
		subtypesSQL += "(?)";
	}
	subtypesSQL += "; SELECT subtype FROM templist WHERE subtype NOT IN (SELECT subtype FROM gear_subtypes);";
	subtypesSQL += "DROP TABLE templist;";

	if(gearItem.brand && gearItem.brand !== '' && gearItem.brand !== null) {
		brands.push(gearItem.brand);
		brandsSQL += "(?)";
	}
	brandsSQL += "; SELECT brand FROM templist WHERE brand NOT IN (SELECT brand FROM gear_brands);";
	brandsSQL += "DROP TABLE templist;";

	db.query(typesSQL, types, function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows[2].length > 0) { //2 for the third SQL statement
			callback('Found invalid type in gear list.');
			return;
		}
		if(subtypes.length <= 0) {
			create();
			return;
		}
		db.query(subtypesSQL, subtypes, function(error, rows) {
			if(error) {
				callback(error);
				return;
			}
			if(rows[2].length > 0) { //2 for the third SQL statement
				callback('Found invalid subtype in gear list.');
				return;
			}
			if(brands.length <= 0) {
				create();
				return;
			}
			db.query(brandsSQL, brands, function(error, rows) {
				if(error) {
					callback(error);
					return;
				}
				if(rows[2].length > 0) { //2 for the third SQL statement
					callback('Found invalid brand in gear list.');
					return;
				}
				create();
			});
		});
	});
}*/

getPrice = function(gearID, startTime, endTime, callback) {
	db.query("SELECT price_a, price_b, price_c FROM gear WHERE id=? LIMIT 1", [gearID], function(error, rows) {
		var startMoment, endMoment, weeks, days, hours, price;
		if(error) {
			callback("Error retrieving prices for gear: " + error);
			return;
		}
		if(rows.length <= 0) {
			callback("No gear with id " + gearID + ".");
			return;
		}
		startMoment = new Moment(startTime, "YYYY-MM-DD HH:mm:ss");
		endMoment = new Moment(endTime, "YYYY-MM-DD HH:mm:ss");
		weeks = parseInt(endMoment.diff(startMoment, "weeks"), 10);
		endMoment.subtract(weeks, "weeks");
		days = parseInt(endMoment.diff(startMoment, "days"), 10);
		endMoment.subtract(days, "days");
		hours = parseInt(endMoment.diff(startMoment, "hours"), 10);
		/*console.log('startTime: ' + startTime);
		console.log('endTime: ' + endTime);
		console.log('weeks: ' + weeks);
		console.log('days: ' + days);
		console.log('hours: ' + hours);
		console.log('price_a: ' + rows[0].price_a);
		console.log('price_b: ' + rows[0].price_b);
		console.log('price_c: ' + rows[0].price_c);*/
		price = rows[0].price_a * hours + rows[0].price_b * days + rows[0].price_c * weeks;
		//console.log('total price: ' + price);
		callback(null, price);
	});
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

setStatus = function(gearID, status, callback) {
	if(status !== "rented-out" && status !== null) {
		callback("Error: invalid gear status.");
		return;
	}
	db.query("UPDATE gear SET gear_status=? WHERE id=? LIMIT 1", [status, gearID], function(error) {
		if(error) {
			callback("Error updating gear status: " + error);
			return;
		}
		callback(null);
	});
};

/**
 * Checks status of gear owned by the user id as well as gear currently booked by the user id
 */
checkForRentals = function(userID, callback) {
	//Get bookings that are before or equal to the current day and for instruments that belong to the user
	db.query("SELECT gear.id FROM bookings INNER JOIN gear ON DATE(bookings.start_time) <= DATE(NOW()) AND bookings.gear_id=gear.id AND (gear.owner_id=? OR bookings.renter_id=?) AND bookings.booking_status='accepted'", [userID, userID], function(error, rows) {
		var sql, i, params;
		if(error) {
			callback("Error selecting gear bookings equal or prior to current day: " + error);
			return;
		}
		if(rows.length <= 0) {
			callback(null);
			return;
		}
		sql = "UPDATE gear SET gear_status='rented-out' WHERE id IN(";
		params = [];
		for(i = 0; i < rows.length - 1; i++) {
			sql += "?,";
			params.push(rows[i].id);
		}
		sql += "?)";
		params.push(rows[rows.length - 1].id);
		db.query(sql, params, function(error) {
			if(error) {
				callback("Error setting gear_status to rented-out: " + error);
				return;
			}
			callback(null);
		});
	});
};

module.exports = {
	getClassification: getClassification,
	checkTypes: checkTypes,
	checkType: checkType,
	checkSubtype: checkSubtype,
	checkBrand: checkBrand,
	checkOwner: checkOwner,
	getAlwaysFlag: getAlwaysFlag,
	setAlwaysFlag: setAlwaysFlag,
	createGear: createGear,
	readGearFromUser: readGearFromUser,
	addImage: addImage,
	updateGearWithID: updateGearWithID,
	readGearWithID: readGearWithID,
	search: search,
	//createGearBulk: createGearBulk,
	getPrice: getPrice,
	getOwner: getOwner,
	setStatus: setStatus,
	checkForRentals: checkForRentals
};

