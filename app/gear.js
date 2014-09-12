/**
 * Defines Sharingear gear.
 * @author: Chris Hjorth
 */

var db = require('./database');

module.exports = {
	getClassification: getClassification,
	createGear: createGear
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

function createGear(newGear, callback) {
	var gear = [
		newGear.type,
		newGear.subtype,
		newGear.brand,
		newGear.model,
		newGear.description,
		newGear.price_a,
		newGear.price_b,
		newGear.price_c,
		newGear.owner_id
	];
	db.query("INSERT INTO gear(type, subtype, brand, model, description, price_a, price_b, price_c, owner_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)", gear, function(error, result) {
		if(error) {
			callback(error);
			return;
		}
		callback(null, result.insertId);
	});
}
