/**
 * Defines Sharingear vans.
 * Van types are handled by type IDs, but returned by their names.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var db = require("./database"),
    Moment = require("moment"),
    Config = require("./config"),
    Localization = require("./localization"),

    getClassification,

    readVansFromUser,
    createVans,
    getTypeID,
    getTypeName,
    addAccessories,
    addImage,
    updateVanWithID,
    setAlwaysFlag,
    getAlwaysFlag,
    checkOwner,
    readVanWithID,
    search,
    getImageURL,
    getVans,
    getVansImages;

getClassification = function(callback) {
    var sql = "SELECT van_types.van_type, van_types.price_a_suggestion, van_types.price_b_suggestion, van_types.price_c_suggestion, accessories.accessory FROM  van_types";
    sql += " LEFT JOIN (SELECT van_accessories.accessory, van_type_has_accessories.van_type_id FROM van_accessories, van_type_has_accessories WHERE van_type_has_accessories.van_accessory_id=van_accessories.id) AS accessories";
    sql += " ON accessories.van_type_id=van_types.id ORDER BY van_types.sorting";
    db.query(sql, [], function(error, rows) {
        var vanTypes = [],
            i, currentType, vanType;
        if (error) {
            callback(error);
            return;
        }
        vanType = {};
        currentType = null;
        for (i = 0; i < rows.length; i++) {
            currentType = rows[i].van_type;
            vanType = {
                vanType: rows[i].van_type,
                price_a_suggestion: rows[i].price_a_suggestion,
                price_b_suggestion: rows[i].price_b_suggestion,
                price_c_suggestion: rows[i].price_c_suggestion,
                accessories: []
            };
            while (i < rows.length && currentType === rows[i].van_type) {
                if (rows[i].accessory !== null) {
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
    var sql;
    //Get users gear, with names for type, subtype and brans and accessories
    sql = "SELECT vans.id, vans.van_type, vans.model, vans.description, vans.images, vans.price_a, vans.price_b, vans.price_c, vans.currency, vans.address, vans.postal_code, vans.city, vans.region, vans.country, vans.latitude, vans.longitude, vans.owner_id, accessories.accessory";
    sql += " FROM (SELECT vans.id, van_types.van_type, vans.model, vans.description, vans.images, vans.price_a, vans.price_b, vans.price_c, vans.currency, vans.address, vans.postal_code, vans.city, vans.region, vans.country, vans.latitude, vans.longitude, vans.owner_id FROM vans, van_types WHERE vans.owner_id=? AND van_types.id=vans.van_type) AS vans";
    sql += " LEFT JOIN (SELECT van_has_accessories.van_id, van_accessories.accessory FROM van_has_accessories, van_accessories WHERE van_has_accessories.accessory_id=van_accessories.id) AS accessories ON accessories.van_id=vans.id;";
    db.query(sql, [userID], function(error, rows) {
        var vans, accessories, i, currentVanID, vanItem;
        if (error) {
            callback(error);
            return;
        }
        vans = [];
        accessories = [];
        //Convert latitudes and longitudes and merge rows of same gear because of accessories
        for (i = 0; i < rows.length; i++) {
            vanItem = rows[i];
            if (vanItem.id === currentVanID) {
                if (vanItem.accessory !== null) {
                    vans[vans.length - 1].accessories.push(vanItem.accessory);
                }
            } else {
                currentVanID = vanItem.id;
                accessories = [];
                vanItem.latitude = vanItem.latitude * 180 / Math.PI;
                vanItem.longitude = vanItem.longitude * 180 / Math.PI;
                if (vanItem.accessory !== null) {
                    accessories.push(vanItem.accessory);
                }
                vans.push({
                    id: vanItem.id,
                    van_type: vanItem.van_type,
                    model: vanItem.model,
                    description: vanItem.description,
                    images: vanItem.images,
                    price_a: vanItem.price_a,
                    price_b: vanItem.price_b,
                    price_c: vanItem.price_c,
                    currency: vanItem.currency,
                    address: vanItem.address,
                    postal_code: vanItem.postal_code,
                    city: vanItem.city,
                    region: vanItem.region,
                    country: vanItem.country,
                    latitude: vanItem.latitude,
                    longitude: vanItem.longitude,
                    owner_id: vanItem.owner_id,
                    accessories: accessories
                });
            }
        }
        callback(null, vans);
    });
};

createVans = function(userID, params, callback) {
    var vans = this;
    //Check if user is owner
    if (userID !== params.owner_id) {
        callback("User creating van and owner do not match.");
        return;
    }
    if (Localization.isCountrySupported(params.country) === false && params.country !== null && params.country !== "") {
        callback("Country not supported.");
        return;
    }
    //Check if owner exists
    db.query("SELECT id FROM users WHERE id=? LIMIT 1", [userID], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback("Owber does not exist.");
            return;
        }
        //Check type
        vans.getTypeID(params.van_type, function(error, typeID) {
            var newVan, now;
            if (error) {
                callback(error);
                return;
            }
            if (typeID === null) {
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
            db.query("INSERT INTO vans(van_type, model, description, images, price_a, price_b, price_c, currency, address, postal_code, city, region, country, latitude, longitude, always_available, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", newVan, function(error, result) {
                if (error) {
                    callback(error);
                    return;
                }
                //Insert accessories
                vans.addAccessories(result.insertId, typeID, params.accessories, function(error) {
                    if (error) {
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
 * @callback arg2: the id of the van type if it is registered in the database, null otherwise.
 */
getTypeID = function(vanType, callback) {
    db.query("SELECT id FROM van_types WHERE van_type=? LIMIT 1", [vanType], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, null);
        } else {
            callback(null, rows[0].id);
        }
    });
};

getTypeName = function(vanTypeID, callback) {
    db.query("SELECT van_type FROM van_types WHERE id=? LIMIT 1;", [vanTypeID], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, null);
        } else {
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
    if (!accessories) {
        callback(null, []);
        return;
    }
    if (accessories.length <= 0) {

    }
    for (i = 0; i < accessories.length - 1; i++) {
        sql += "?, ";
        valueArray.push(accessories[i]);
    }
    sql += "?";
    valueArray.push(accessories[i], vanTypeID);
    sql += ") AND van_type_has_accessories.van_type_id=? AND van_type_has_accessories.van_accessory_id=van_accessories.id;";
    //Get accessory IDs
    db.query(sql, valueArray, function(error, rows) {
        var accessoryIDs = [];
        if (error) {
            callback(error);
            return;
        }
        //No accessories to add
        if (rows.length <= 0) {
            callback(null, []);
            return;
        }
        accessories = [];
        for (i = 0; i < rows.length; i++) {
            accessoryIDs.push(rows[i].id);
            accessories.push(rows[i].accessory);
        }
        valueArray = [];
        sql = "INSERT INTO van_has_accessories(van_id, accessory_id) VALUES ";
        for (i = 0; i < accessoryIDs.length - 1; i++) {
            sql += "(?, ?), ";
            valueArray.push(vanID, accessoryIDs[i]);
        }
        sql += "(?, ?)";
        valueArray.push(vanID, accessoryIDs[i]);
        db.query(sql, valueArray, function(error) {
            if (error) {
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
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback("No gear found.");
            return;
        }
        images = rows[0].images + imageURL + ",";
        db.query("UPDATE vans SET images=? WHERE id=? AND owner_id=?", [images, vanID, userID], function(error, result) {
            if (error) {
                callback(error);
                return;
            }
            if (result.affectedRows <= 0) {
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
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback("No van with id " + vanID + " to update.");
            return;
        }
        //Check if user is owner
        if (parseInt(userID, 10) !== rows[0].owner_id) {
            callback("User is not owner.");
            return;
        }
        if (Localization.isCountrySupported(updatedVanData.country) === false && updatedVanData.country !== null && updatedVanData.country !== "") {
            callback("Country not supported.");
            return;
        }

        update = function(vanTypeID, vanTypeName) {
            var vanInfo;
            if (updatedVanData.latitude) {
                updatedVanData.latitude = parseFloat(updatedVanData.latitude) * Math.PI / 180;
                if (isNaN(updatedVanData.latitude)) {
                    updatedVanData.latitude = null;
                }
            }
            if (updatedVanData.longitude) {
                updatedVanData.longitude = parseFloat(updatedVanData.longitude) * Math.PI / 180;
                if (isNaN(updatedVanData.longitude)) {
                    updatedVanData.longitude = null;
                }
            }
            vanInfo = [
                vanTypeID, (updatedVanData.model ? updatedVanData.model : rows[0].model), (updatedVanData.description ? updatedVanData.description : rows[0].description), (updatedVanData.price_a ? updatedVanData.price_a : rows[0].price_a), (updatedVanData.price_b ? updatedVanData.price_b : rows[0].price_b), (updatedVanData.price_c ? updatedVanData.price_c : rows[0].price_c), (updatedVanData.currency ? updatedVanData.currency : rows[0].currency), (updatedVanData.address ? updatedVanData.address : rows[0].address), (updatedVanData.postal_code ? updatedVanData.postal_code : rows[0].postal_code), (updatedVanData.city ? updatedVanData.city : rows[0].city), (updatedVanData.region ? updatedVanData.region : rows[0].region), (updatedVanData.country ? updatedVanData.country : rows[0].country), (updatedVanData.latitude ? updatedVanData.latitude : rows[0].latitude), (updatedVanData.longitude ? updatedVanData.longitude : rows[0].longitude),
                vanID
            ];
            db.query("UPDATE vans SET van_type=?, model=?, description=?, price_a=?, price_b=?, price_c=?, currency=?, address=?, postal_code=?, city=?, region=?, country=?, latitude=?, longitude=? WHERE id=? LIMIT 1;", vanInfo, function(error, result) {
                if (error) {
                    callback(error);
                    return;
                }
                if (result.affectedRows <= 0) {
                    callback("Found no van to update.");
                    return;
                }
                //Delete accessories and then add them
                db.query("DELETE FROM van_has_accessories WHERE van_id=?;", [vanID], function(error) {
                    if (error) {
                        callback(error);
                        return;
                    }
                    updatedVanData.accessories = JSON.parse(updatedVanData.accessories);
                    vans.addAccessories(vanID, vanInfo[0], updatedVanData.accessories, function(error) {
                        var now = new Moment();
                        if (error) {
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
                            currency: vanInfo[6],
                            address: vanInfo[7],
                            postal_code: vanInfo[8],
                            city: vanInfo[9],
                            region: vanInfo[10],
                            country: vanInfo[11],
                            latitude: vanInfo[12],
                            longitude: vanInfo[13],
                            always_available: rows[0].always_available,
                            updated: now.format("YYYY-MM-DD HH:mm:ss"),
                            owner_id: userID
                        });
                    });
                });
            });
        };

        if (updatedVanData.van_type) {
            //Check if van type is legal
            vans.getTypeID(updatedVanData.van_type, function(error, typeID) {
                if (error) {
                    callback(error);
                    return;
                }
                if (typeID === null) {
                    callback("Invalid van type.");
                    return;
                }
                update(typeID, updatedVanData.van_type);
            });
        } else {
            vans.getTypeName(rows[0].van_type, function(error, typeName) {
                if (error) {
                    callback(error);
                    return;
                }
                if (typeName === null) {
                    callback("Invalid type ID.");
                    return;
                }
                update(rows[0].van_type, typeName);
            });
        }
    });
};

setAlwaysFlag = function(vanID, alwaysFlag, callback) {
    db.query("UPDATE vans SET always_available=? WHERE id=? LIMIT 1", [alwaysFlag, vanID], function(error) {
        if (error) {
            callback(error);
            return;
        }
        callback(null);
    });
};

getAlwaysFlag = function(vanID, callback) {
    db.query("SELECT always_available FROM vans WHERE id=? LIMIT 1", [vanID], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback("No van found for ID.");
            return;
        }
        callback(null, rows[0]);
    });
};

checkOwner = function(userID, vanID, callback) {
    db.query("SELECT id FROM vans WHERE id=? AND owner_id=? LIMIT 1", [vanID, userID], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, false);
        } else {
            callback(null, true);
        }
    });
};

readVanWithID = function(vanID, callback) {
    var sql;
    sql = "SELECT van.id, van.van_type, van.model, van.description, van.images, van.price_a, van.price_b, van.price_c, van.currency, van.address, van.postal_code, van.city, van.region, van.country, van.latitude, van.longitude, van.owner_id, accessories.accessory";
    sql += " FROM (SELECT vans.id, van_types.van_type, vans.model, vans.description, vans.images, vans.price_a, vans.price_b, vans.price_c, vans.currency, vans.address, vans.postal_code, vans.city, vans.region, vans.country, vans.latitude, vans.longitude, vans.owner_id FROM vans, van_types WHERE vans.id=? AND van_types.id=vans.van_type LIMIT 1) AS van";
    sql += " LEFT JOIN (SELECT van_has_accessories.van_id, van_accessories.accessory FROM van_has_accessories, van_accessories WHERE van_has_accessories.accessory_id=van_accessories.id) AS accessories ON accessories.van_id=van.id;";
    db.query(sql, [vanID], function(error, rows) {
        var van, vanItem, accessories, i;
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback("No van found for the id.");
            return;
        }
        accessories = [];
        for (i = 0; i < rows.length; i++) {
            if (rows[i].accessory !== null) {
                accessories.push(rows[i].accessory);
            }
        }
        vanItem = rows[0];
        van = {
            id: vanItem.id,
            van_type: vanItem.van_type,
            model: vanItem.model,
            description: vanItem.description,
            images: vanItem.images,
            price_a: vanItem.price_a,
            price_b: vanItem.price_b,
            price_c: vanItem.price_c,
            currency: vanItem.currency,
            address: vanItem.address,
            postal_code: vanItem.postal_code,
            city: vanItem.city,
            region: vanItem.region,
            country: vanItem.country,
            latitude: vanItem.latitude * 180 / Math.PI,
            longitude: vanItem.longitude * 180 / Math.PI,
            owner_id: vanItem.owner_id,
            accessories: accessories
        };
        callback(null, van);
    });
};

search = function(location, van, callback) {
    //Do a full text search on vans, then narrow down by location, because location search is slower.
    db.search("SELECT id, van_type, model, city, country, images, price_a, price_b, price_c, currency, latitude, longitude, owner_id FROM vans_main, vans_delta WHERE MATCH(?) ORDER BY id DESC LIMIT 100", [van], function(error, rows) {
        var latLngArray, lat, lng, sql, i;
        if (error) {
            console.error("Error searching for match: " + JSON.stringify(error));
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, []);
            return;
        }
        if (location === "all") {
            for (i = 0; i < rows.length; i++) {
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
        sql = "SELECT id, van_type, model, city, country, images, price_a, price_b, price_c, currency, latitude, longitude, owner_id, GEODIST(?, ?, latitude, longitude) AS distance FROM vans_main, vans_delta WHERE id IN (";
        for (i = 0; i < rows.length - 1; i++) {
            sql += rows[i].id + ",";
        }
        sql += rows[rows.length - 1].id; //rows has at least one item
        sql += ") AND distance <= ?.0  ORDER BY distance ASC, id DESC LIMIT 100";
        db.search(sql, [lat, lng, Config.SEARCH_RADIUS], function(error, rows) {
            var i;
            if (error) {
                console.error("Error filtering by location: " + JSON.stringify(error));
                callback(error);
                return;
            }
            for (i = 0; i < rows.length; i++) {
                rows[i].latitude = rows[i].latitude * 180 / Math.PI;
                rows[i].longitude = rows[i].longitude * 180 / Math.PI;
            }
            callback(null, rows);
        });
    });
};

/**
 * @return: the URL for the main image of a specific gear item. If the gear has no images an empty string is returned.
 */
getImageURL = function(vanID, callback) {
    db.query("SELECT images FROM vans WHERE id=? LIMIT 1", [vanID], function(error, rows) {
        var images;
        if (error) {
            callback(error);
            return;
        }
        if (rows.length <= 0) {
            callback(null, "");
            return;
        }
        images = rows[0].images.split(",");
        callback(null, images[0]);
    });
};

getVans = function(callback) {
    db.query("SELECT vans.id, van_types.van_type, vans.model FROM vans, van_types WHERE van_types.id=vans.van_type;", [], function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        callback(null, rows);
    });
};

getVansImages = function(callback) {
    db.query("SELECT vans.id, van_types.van_type, vans.model, vans.images FROM vans, van_types WHERE van_types.id=vans.van_type;", [], function(error, rows) {
        var vansImages = [],
            i;
        if (error) {
            callback(error);
            return;
        }
        for (i = 0; i < rows.length; i++) {
            if (rows[i].images.length > 0) {
                rows[i].images = rows[i].images.split(",");
                vansImages.push(rows[i]);
            }
        }
        callback(null, vansImages);
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
    updateVanWithID: updateVanWithID,
    setAlwaysFlag: setAlwaysFlag,
    getAlwaysFlag: getAlwaysFlag,
    checkOwner: checkOwner,
    readVanWithID: readVanWithID,
    search: search,
    getImageURL: getImageURL,
    getVans: getVans,
    getVansImages: getVansImages
};
