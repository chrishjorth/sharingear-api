/**
 * Defines Sharingear gear.
 * @author: Chris Hjorth
 */

var db = require('./database');

module.exports = {
	getClassification: getClassification,
	checkTypes: checkTypes,
	checkType: checkType,
	checkSubtype: checkSubtype,
	checkBrand: checkBrand,
	createGear: createGear,
	readGearFromUser: readGearFromUser,
	addImage: addImage,
	updateGearWithID: updateGearWithID,
	readGearWithID: readGearWithID,
	search: search,
	createGearBulk: createGearBulk
};

/**
 * @returns fx {
 *		guitar: ['electric', acoustic],
 *		amp: ['guitar amp', 'cabinet', 'combo']	
 * }
 */
function getClassification(callback) {
	db.query("SELECT gear_types.gear_type, gear_subtypes.subtype FROM gear_types, gear_subtypes WHERE gear_subtypes.type_id=gear_types.id ORDER BY gear_types.gear_type", [], function(error, rows) {
		var currentGear = '',
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
		//Assertion: the query returns rows sorted by gear type
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
			callback(null, gearClassification);
		});
	});
}

function checkTypes(gearType, subtype, callback) {
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
}

function checkType(gearType, callback) {
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
}

/**
 * @return true for valid subtype or empty string. Empty string counts as valid in order to allow undefined subtype.
 */
function checkSubtype(subtype, callback) {
	if(subtype === '') {
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
}

/**
 * @return true for valid subtype or empty string. Empty string counts as valid in order to allow undefined brand.
 */
function checkBrand(brand, callback) {
	if(brand === '') {
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
}

function createGear(newGear, callback) {
	var Gear = this,
		create;

	create = function() {
		var lat, lng, gear;
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
		var gear;
		if(error) {
			callback(error);
			return;
		}
		if(correct === false) {
			callback('Wrong type.');
			return;
		}

		Gear.checkSubtype(newGear.subtype, function(error, correct) {
			if(error) {
				callback(error);
				return;
			}
			if(correct === false) {
				callback('Wrong subtype.');
				return;
			}

			Gear.checkBrand(newGear.brand, function(error, correct) {
				var lat, lng, gear;
				if(error) {
					callback(error);
					return;
				}
				if(correct === false) {
					callback('Wrong brand.');
					return;
				}
				create();
			});
		});
	});
}

function readGearFromUser(userID, callback) {
	db.query("SELECT id, type, subtype, brand, model, description, images, price_a, price_b, price_c FROM gear WHERE owner_id=?", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		callback(null, rows);
	});
}

function addImage(userID, gearID, imageURL, callback) {
	db.query("SELECT images FROM gear WHERE id=? AND owner_id=? LIMIT 1", [gearID, userID], function(error, rows) {
		var images = '';
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback('No gear found.');
			return;
		}
		console.log('images selected');
		images = rows[0].images + imageURL + ',';
		db.query("UPDATE gear SET images=? WHERE id=? AND owner_id=?", [images, gearID, userID], function(error, result) {
			if(error) {
				callback(error);
				return;
			}
			if(result.affectedRows <= 0) {
				callback('No gear found to update.');
				return;
			}
			console.log('images updated');
			callback(null, images);
			db.index();
		});
	});
}

function updateGearWithID(gearID, updatedGearData, callback) {
	var Gear = this;
		update;

	update = function() {
		var lat, lng, inputs;
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
				callback('No gear found to update.');
				return;
			}
			callback(null);
			db.index();
		});
	};


	this.checkSubtype(newGear.subtype, function(error, correct) {
		if(error) {
			callback(error);
			return;
		}
		if(correct === false) {
			callback('Wrong subtype.');
			return;
		}

		Gear.checkBrand(newGear.brand, function(error, correct) {
			var lat, lng, gear;
			if(error) {
				callback(error);
				return;
			}
			if(correct === false) {
				callback('Wrong brand.');
				return;
			}
			update();
		});
	});	
}

function readGearWithID(gearID, callback) {
	db.query("SELECT id, type, subtype, brand, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, owner_id FROM gear WHERE id=? LIMIT 1", gearID, function(error, rows) {
		var gear;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback('No gear found for the id.');
			return;
		}
		gear = rows[0];
		if(gear.model === null) {
			gear.model = '';
		}
		if(gear.description === null) {
			gear.description = '';
		}
		if(gear.images === null) {
			gear.images = '';
		}
		if(gear.address === null) {
			gear.address = '';
		}
		if(gear.postal_code === null) {
			gear.postal_code = '';
		}
		if(gear.city === null) {
			gear.city = '';
		}
		if(gear.region === null) {
			gear.region = '';
		}
		if(gear.country === null) {
			gear.country = '';
		}
		callback(null, rows[0]);
	});
}

/**
 * @param lat: Latitude in radians
 * @param lng: Longitude in radians
 */
function search(lat, lng, gear, callback) {
	//Do a full text search on gear, then narrow down by location, because location search is slower.
	//console.log('Search gear');
	db.search("SELECT id FROM gear_main, gear_delta WHERE MATCH(?) LIMIT 100", [gear], function(error, rows) {
		var sql, i;
		if(error) {
			console.log('search error: ' + JSON.stringify(error));
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, []);
			return;
		}
		//console.log('Found gear by full text search');
		lat = parseFloat(lat) * Math.PI / 180;
		lng = parseFloat(lng) * Math.PI / 180;
		//console.log('lat: ' + lat);
		//console.log('lng: ' + lng);
		sql = "SELECT id, type, subtype, brand, model, images, latitude, longitude, owner_id, GEODIST(?, ?, latitude, longitude) AS distance FROM gear_main, gear_delta WHERE id IN (";
		for(i = 0; i < rows.length - 1; i++) {
			sql += rows[i].id + ',';
		}
		sql += rows[rows.length - 1].id; //rows has at least one item
		sql += ") AND distance <= 10000.0 ORDER BY distance ASC LIMIT 100";
		/*console.log('Search location');
		console.log('SQL:');
		console.log(sql);
		console.log('lat: ' + lat);
		console.log('lng: ' + lng);*/
		db.search(sql, [lat, lng], function(error, rows) {
			if(error) {
				console.log('search error: ' + JSON.stringify(error));
				callback(error);
				return;
			}
			//console.log('Found gear by location filter');
			//console.log(JSON.stringify(rows));
			callback(null, rows);
		});
	});
}

function createGearBulk(ownerID, gearList, callback) {
	var create, types, subtypes, brands, i, gearItem;

	create = function() {
		console.log('Add gear in bulk');
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
		subtypes.push(gearItem.subtype);
		subtypesSQL += "(?),";
		brands.push(gearItem.brand);
		brandsSQL += "(?),";
	}
	gearItem = gearList[gearList - 1];
	types.push(gearItem.type);
	typesSQL += "(?);";
	typesSQL += "SELECT gear_type FROM templist WHERE gear_type NOT IN (SELECT gear_type FROM gear_types);";
	typesSQL += "DROP TABLE templist;";
	subtypes.push(gearItem.subtype);
	subtypesSQL += "(?);";
	subtypesSQL += "SELECT subtype FROM templist WHERE subtype NOT IN (SELECT subtype FROM gear_subtypes);";
	subtypesSQL += "DROP TABLE templist;";
	brands.push(gearItem.brand);
	brandsSQL += "(?);";
	brandsSQL += "SELECT brand FROM templist WHERE brand NOT IN (SELECT brand FROM gear_brands);";
	brandsSQL += "DROP TABLE templist;";

	console.log('Do the query');

	db.query(typesSQL, types, function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length > 0) {
			callback('Found invalid type in gear list.');
			return;
		}
		console.log('Types pass');
		db.query(subtypesSQL, subtypes, function(error, rows) {
			if(error) {
				callback(error);
				return;
			}
			if(rows.length > 0) {
				callback('Found invalid subtype in gear list.');
				return;
			}
			console.log('Subtypes pass');
			db.query(brandsSQL, brands, function(error, rows) {
				if(error) {
					callback(error);
					return;
				}
				if(rows.length > 0) {
					callback('Found invalid brand in gear list.');
					return;
				}
				console.log('Brands pass');
				create();
			});
		});
	});
}


