/**
 * Defines Sharingear gear.
 * @author: Chris Hjorth
 */

var db = require('./database');

module.exports = {
	getClassification: getClassification,
	checkTypes: checkTypes,
	checkBrand: checkBrand,
	createGear: createGear,
	readGearFromUser: readGearFromUser,
	addImage: addImage,
	updateGearWithID: updateGearWithID,
	readGearWithID: readGearWithID,
	search: search
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

function checkBrand(brand, callback) {
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
	var Gear = this;
	this.checkTypes(newGear.type, newGear.subtype, function(error, correct) {
		var gear;
		if(error) {
			callback(error);
			return;
		}
		if(correct === false) {
			callback('Wrong type or subtype.');
			return;
		}

		Gear.checkBrand(newGear.brand, function(error, correct) {
			if(error) {
				callback(error);
				return;
			}
			if(correct === false) {
				callback('Wrong brand.');
				return;
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
				newGear.latitude,
				newGear.longitude,
				newGear.owner_id
			];

			db.query("INSERT INTO gear(type, subtype, brand, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, owner_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", gear, function(error, result) {
				if(error) {
					callback(error);
					return;
				}
				callback(null, result.insertId);
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
		});
	});
}

function updateGearWithID(gearID, updatedGearData, callback) {
	var inputs = [
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
		updatedGearData.latitude,
		updatedGearData.longitude,
		gearID
	];
	db.query("UPDATE gear SET brand=?, model=?, description=?, images=?, price_a=?, price_b=?, price_c=?, address=?, postal_code=?, city=?, region=?, country=?, latitude=?, longitude=? WHERE id=? LIMIT 1", inputs, function(error, result) {
		if(error) {
			callback(error);
			return;
		}
		if(result.affectedRows <= 0) {
			callback('No gear found to update.');
			return;
		}
		callback(null);
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

function search(lat, lng, gear, callback) {
	//Get all gear at location, then narrow down based on gear description, then filter by date range
	console.log('Call search with: ' + gear);
	db.search("SELECT id FROM gear WHERE MATCH('?') LIMIT 100", [gear], function(error, rows) {
		if(error) {
			console.log('search error: ' + JSON.stringify(error));
			callback(error);
			return;
		}
		console.log(JSON.stringify(rows));
		callback(null);
	});
}
