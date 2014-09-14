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
	readGearFromUser: readGearFromUser
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
				newGear.owner_id
			];

			db.query("INSERT INTO gear(type, subtype, brand, model, description, images, price_a, price_b, price_c, owner_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", gear, function(error, result) {
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
