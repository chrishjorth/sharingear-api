/**
 * Defines Sharingear vans.
 * @author: Chris Hjorth
 */
 
/*jslint node: true */
"use strict";

var db = require("./database"),
	Moment = require("moment"),
	
	getClassification,

	readVansFromUser,
	createVans,
	getTypeID,
	addAccessories;

getClassification = function(callback) {
	var sql = "SELECT van_types.van_type, accessories.accessory FROM  van_types";
	sql += " LEFT JOIN (SELECT van_accessories.accessory, van_type_has_accessories.van_type_id FROM van_accessories, van_type_has_accessories WHERE van_type_has_accessories.van_accessory_id=van_accessories.id) AS accessories";
	sql += " ON accessories.van_type_id=van_types.id ORDER BY van_types.sorting";
	db.query(sql, [], function(error, rows) {
		var vanTypes = [],
			i, currentType, vanType;
		if(error) {
			callback(error);
			return;
		}
		vanType = {};
		currentType = null;
		for(i = 0; i < rows.length; i++) {
			currentType = rows[i].van_type;
			vanType = {
				vanType: rows[i].van_type,
				accessories: []
			};
			while(i < rows.length && currentType === rows[i].van_type) {
				if(rows[i].accessory !== null) {
					vanType.accessories.push(rows[i].accessory);
				}
				i++;
			}
			i--;
			vanTypes.push(vanType);
		}
		callback(null, vanTypes);
	});
};

readVansFromUser = function(userID, callback) {
	db.query("SELECT id, van_type, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, always_available, updated, owner_id FROM vans WHERE owner_id=?", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		callback(null, rows);
	});
};

createVans = function(userID, params, callback) {
	var vans = this;
	//Check if user is owner
	if(userID !== params.owner_id) {
		callback("User creating van and owner do not match.");
		return;
	}
	//Check if owner exists
	db.query("SELECT id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("Owber does not exist.");
			return;
		}
		//Check type
		vans.getTypeID(params.van_type, function(error, typeID) {
			var newVan, now;
			if(error) {
				callback(error);
				return;
			}
			if(typeID === null) {
				callback("Illegal van type.");
				return;
			}
			now = new Moment();
			newVan = [
				typeID,
				params.model,
				params.description,
				params.images,
				params.price_a,
				params.price_b,
				params.price_c,
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
			db.query("INSERT INTO vans(van_type, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, always_available, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", newVan, function(error, result) {
				if(error) {
					callback(error);
					return;
				}
				//Insert accessories
				vans.addAccessories(result.insertId, typeID, params.accessories, function(error) {
					if(error) {
						callback(error);
						return;
					}
					//return object 
					callback(null, {
						id: result.insertId,
						van_type: typeID,
						model: params.model,
						description: params.description,
						images: params.images,
						price_a: params.price_a,
						price_b: params.price_b,
						price_c: params.price_c,
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
 * @callback arg2: the id of the van type if it is registered in the database, null otherwise.
 */
getTypeID = function(vanType, callback) {
	db.query("SELECT id FROM van_types WHERE van_type=? LIMIT 1", [vanType], function(error, rows) {
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
 * Verifies the accessories and adds them.
 * @callback arg1: error or null if no errors
 * @callback arg2: array of accessory names
 */
addAccessories = function(vanID, vanTypeID, accessories, callback) {
	var sql = "SELECT van_accessories.id, van_accessories.accessory FROM van_accessories, van_type_has_accessories WHERE van_accessories.accessory IN(",
		valueArray = [],
		i;
	if(accessories.length <= 0) {
		callback(null, []);
		return;
	}
	for(i = 0; i < accessories.length - 1; i++) {
		sql += "?, ";
		valueArray.push(accessories[i]);
	}
	sql += "?";
	valueArray.push(accessories[i], vanTypeID);
	sql += ") AND van_type_has_accessories.van_type_id=? AND van_type_has_accessories.van_accessory_id=van_accessories.id;";
	//Get accessory IDs
	db.query(sql, valueArray, function(error, rows) {
		var accessoryIDs = [];
		if(error) {
			callback(error);
			return;
		}
		//No accessories to add
		if(rows.length <= 0) {
			callback(null, []);
			return;
		}
		accessories = [];
		for(i = 0; i < rows.length; i++) {
			accessoryIDs.push(rows[i].id);
			accessories.push(rows[i].accessory);
		}
		valueArray = [];
		sql = "INSERT INTO van_has_accessories(van_id, accessory_id) VALUES ";
		for(i = 0; i < accessoryIDs.length - 1; i++) {
			sql += "(?, ?), ";
			valueArray.push(vanID, accessoryIDs[i]);
		}
		sql += "(?, ?)";
		valueArray.push(vanID, accessoryIDs[i]);
		db.query(sql, valueArray, function(error) {
			if(error) {
				callback(error);
				return;
			}
			callback(null, accessories);
		});
	});
};

module.exports = {
	getClassification: getClassification,
	readVansFromUser: readVansFromUser,
	createVans: createVans,
	getTypeID: getTypeID,
	addAccessories: addAccessories
};
