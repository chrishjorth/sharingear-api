/**
 * Defines Sharingear vans.
 * Van types are handled by type IDs, but returned by their names.
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
	getTypeName,
	addAccessories,
	addImage,
	updateVanWithID;

getClassification = function(callback) {
	var sql = "SELECT van_types.van_type, van_types.price_a_suggestion, van_types.price_b_suggestion, van_types.price_c_suggestion, accessories.accessory FROM  van_types";
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
				price_a_suggestion: rows[i].price_a_suggestion,
				price_b_suggestion: rows[i].price_b_suggestion,
				price_c_suggestion: rows[i].price_c_suggestion,
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
						van_type: params.van_type,
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

getTypeName = function(vanTypeID, callback) {
	db.query("SELECT van_type FROM van_types WHERE id=? LIMIT 1;", [vanTypeID], function(error, rows) {
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback(null, null);
		}
		else {
			callback(null, rows[0].van_type);
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

addImage = function(userID, vanID, imageURL, callback) {
	db.query("SELECT images FROM vans WHERE id=? AND owner_id=? LIMIT 1", [vanID, userID], function(error, rows) {
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
		db.query("UPDATE vans SET images=? WHERE id=? AND owner_id=?", [images, vanID, userID], function(error, result) {
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
updateVanWithID = function(userID, vanID, updatedVanData, callback) {
	var vans = this;
	db.query("SELECT id, van_type, model, description, images, price_a, price_b, price_c, address, postal_code, city, region, country, latitude, longitude, always_available, owner_id FROM vans WHERE id=? LIMIT 1;", [vanID], function(error, rows) {
		var update;
		if(error) {
			callback(error);
			return;
		}
		if(rows.length <= 0) {
			callback("No van with id " + vanID + " to update.");
			return;
		}
		//Check if user is owner
		if(parseInt(userID, 10) !== rows[0].owner_id) {
			callback("User is not owner.");
			return;
		}

		update = function(vanTypeID, vanTypeName) {
			var vanInfo;
			if(updatedVanData.latitude) {
				updatedVanData.latitude = parseFloat(updatedVanData.latitude) * Math.PI / 180;
				if(isNaN(updatedVanData.latitude)) {
					updatedVanData.latitude = null;
				}
			}
			if(updatedVanData.longitude) {
				updatedVanData.longitude = parseFloat(updatedVanData.longitude) * Math.PI / 180;
				if(isNaN(updatedVanData.longitude)) {
					updatedVanData.longitude = null;
				}
			}
			vanInfo = [
				vanTypeID,
				(updatedVanData.model ? updatedVanData.model : rows[0].model),
				(updatedVanData.description ? updatedVanData.description : rows[0].description),
				(updatedVanData.price_a ? updatedVanData.price_a : rows[0].price_a),
				(updatedVanData.price_b ? updatedVanData.price_b : rows[0].price_b),
				(updatedVanData.price_c ? updatedVanData.price_c : rows[0].price_c),
				(updatedVanData.address ? updatedVanData.address : rows[0].address),
				(updatedVanData.postal_code ? updatedVanData.postal_code : rows[0].postal_code),
				(updatedVanData.city ? updatedVanData.city : rows[0].city),
				(updatedVanData.region ? updatedVanData.region : rows[0].region),
				(updatedVanData.country ? updatedVanData.country : rows[0].country),
				(updatedVanData.latitude ? updatedVanData.latitude : rows[0].latitude),
				(updatedVanData.longitude ? updatedVanData.longitude : rows[0].longitude),
				vanID
			];
			db.query("UPDATE vans SET van_type=?, model=?, description=?, price_a=?, price_b=?, price_c=?, address=?, postal_code=?, city=?, region=?, country=?, latitude=?, longitude=? WHERE id=? LIMIT 1;", vanInfo, function(error, result) {
				if(error) {
					callback(error);
					return;
				}
				if(result.affectedRows <= 0) {
					callback("Found no van to update.");
					return;
				}
				//Delete accessories and then add them
				db.query("DELETE FROM van_has_accessories WHERE van_id=?;", [vanID], function(error) {
					if(error) {
						callback(error);
						return;
					}
					updatedVanData.accessories = JSON.parse(updatedVanData.accessories);
					vans.addAccessories(vanID, vanInfo[0], updatedVanData.accessories, function(error) {
						var now = new Moment();
						if(error) {
							callback(error);
							return;
						}
						callback(null, {
							id: vanID,
							van_type: vanTypeName,
							model: vanInfo[1],
							description: vanInfo[2],
							price_a: vanInfo[3],
							price_b: vanInfo[4],
							price_c: vanInfo[5],
							address: vanInfo[6],
							postal_code: vanInfo[7],
							city: vanInfo[8],
							region: vanInfo[9],
							country: vanInfo[10],
							latitude: vanInfo[11],
							longitude: vanInfo[12],
							always_available: rows[0].always_available,
							updated: now.format("YYYY-MM-DD HH:mm:ss"),
							owner_id: userID
						});
					});
				});
			});
		};

		if(updatedVanData.van_type) {
			//Check if van type is legal
			vans.getTypeID(updatedVanData.van_type, function(error, typeID) {
				if(error) {
					callback(error);
					return;
				}
				if(typeID === null) {
					callback("Invalid van type.");
					return;
				}
				update(typeID, updatedVanData.van_type);
			});
		}
		else {
			vans.getTypeName(rows[0].van_type, function(error, typeName) {
				if(error) {
					callback(error);
					return;
				}
				if(typeName === null) {
					callback("Invalid type ID.");
					return;
				}
				update(rows[0].van_type, typeName);
			});
		}
	});
};

module.exports = {
	getClassification: getClassification,
	readVansFromUser: readVansFromUser,
	createVans: createVans,
	getTypeID: getTypeID,
	getTypeName: getTypeName,
	addAccessories: addAccessories,
	addImage: addImage,
	updateVanWithID: updateVanWithID
};
