/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */
/*jslint node: true */
"use strict";

var restify = require("restify"),
	fs = require("fs"),
	Config = require("./config"),
	fb = require("./facebook"),
	Sec = require("./sec"),
	User = require("./user"),
	Gear = require("./gear"),
	Availability = require("./availability"),
	Booking = require("./booking"),
	readFileSuccess = true,

	healthCheck,
	readGearClassification,
	createGear,
	createGearFromList,
	readGearWithID,
	addImageToGear,
	generateFileName,
	readGearSearchResults,
	createUserSession,
	readUserWithID,
	updateUserWithID,
	updateUserBankDetails,
	readGearFromUserWithID,
	updateGearFromUserWithID,
	readGearAvailability,
	createGearAvailability,
	readReservationsFromUserWithID,
	createBooking,
	readBooking,
	updateBooking,
	createCardObject,
	handleError,
	isAuthorized,

	key, certificate, server, secureServer;


try {
	key = fs.readFileSync("/home/chrishjorth/keys/server.key");
}
catch(error) {
	console.log("Could not read key file");
	readFileSuccess = false;
}

try {
	certificate = fs.readFileSync("/home/chrishjorth/keys/server.pem");
}
catch(error) {
	console.log("Could not read certificate file.");
	readFileSuccess = false;
}

if(readFileSuccess === false) {
	//This is so that we do not need to have keys and certificates installed for localhost development, or if files could not be loaded.
	secureServer = restify.createServer({
		name: "Sharingear API"
	});
}
else {
	//We only run with https
	secureServer = restify.createServer({
		name: "Sharingear API",
		key: key,
		certificate: certificate
	});
}

//Tunnelblick uses 1337 apparently
secureServer.listen(1338, function() {
	console.log("%s listening at %s", secureServer.name, secureServer.url);
});

secureServer.use(restify.CORS());
secureServer.use(restify.fullResponse());
secureServer.use(restify.bodyParser());

server = restify.createServer({
	name: "Sharingear health check"
});

server.listen(1339);

//ROUTE HANDLERS

healthCheck = function (req, res, next) {
	res.send({});
	next();
};

readGearClassification = function(req, res, next) {
	Gear.getClassification(function(error, gearClassification) {
		if(error) {
			handleError(res, next, "Error retrieving gear classification: ", error);
			return;
		}
		res.send(gearClassification);
		next();
	});
};

createGear = function(req, res, next) {
	var params = req.params,
		newGear;

	isAuthorized(params.owner_id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		newGear = {
			type: params.type,
			subtype: params.subtype,
			brand: params.brand,
			model: params.model,
			description: params.description,
			images: params.images,
			price_a: params.price_a,
			price_b: params.price_b,
			price_c: params.price_c,
			address: params.address,
			postal_code: params.postalcode,
			city: params.city,
			region: params.region,
			country: params.country,
			latitude: params.latitude,
			longitude: params.longitude,
			owner_id: params.owner_id
		};

		Gear.createGear(newGear, function(error, gearID) {
			if(error) {
				handleError(res, next, "Error creating new gear: ", error);
				return;
			}
			res.send({id: gearID});
			next();
		});
	});
};

createGearFromList = function(req, res, next) {
	isAuthorized(req.params.owner_id, function(error, status) {
		var gearList;
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		gearList = JSON.parse(req.params.gear_list);
		Gear.createGearBulk(req.params.owner_id, gearList, function(error) {
			if(error) {
				handleError(res, next, "Error creating new gear from list: ", error);
				return;
			}
			res.send({});
			next();
		});
	});
};

readGearWithID = function(req, res, next) {
	Gear.readGearWithID(req.params.id, function(error, gear) {
		if(error) {
			handleError(res, next, "Error retrieving gear: ", error);
			return;
		}
		res.send(gear);
		next();
	});
};

addImageToGear = function(req, res, next) {
	//Validate the image url
	var imageURL = req.params.image_url,
		validation;

	imageURL = imageURL.split("?")[0]; //Remove eventual query string parameters inserted by meddlers
	validation = imageURL.split("/");
	if(validation[2] !== Config.VALID_IMAGE_HOST) {
		handleError(res, next, "Error adding image to gear: ", "image url is from an invalid domain.");
		return;
	}

	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		Gear.addImage(req.params.user_id, req.params.gear_id, imageURL, function(error, images) {
			if(error) {
				handleError(res, next, "Error authorizing user: ", error);
				return;
			}
			res.send({images: images});
			next();
		});
	});
};

generateFileName = function(req, res, next) {
	var params = req.params;

	isAuthorized(params.id, function(error, status) {
		var newFileName, dot, extension, secret;
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		dot = params.filename.indexOf(".");
		extension = params.filename.substring(dot + 1);
		newFileName = params.filename.substring(0, dot);
		newFileName = Sec.generateFileName(newFileName) + "." + extension;
		secret = Sec.getFileSecretProof(newFileName);
		res.send({fileName: newFileName, secretProof: secret});
		next();
	});
};

readGearSearchResults = function(req, res, next) {
	var latLngArray, lat, lng;
	latLngArray = req.params.location.split(",");
	lat = latLngArray[0];
	lng = latLngArray[1];
	Gear.search(lat, lng, req.params.gear, function(error, results) {
		if(error) {
			res.send([]);
			return;
		}
		res.send(results);
		next();
	});
};

/**
 * Switches the FB short token for a long token, if the user does not exist information is retrieved from Facebook and the user is created.
 * @param accesstoken: FB access token
 * @return The user object
 */
createUserSession = function(req, res, next) {
	var createSession;
	createSession = function(user, longToken) {
		User.setServerAccessToken(user.fbid, longToken, function(error) {
			if(error) {
				handleError(res, next, "Error setting Access Token: ", error);
				return;
			}

			res.send(user);
			next();
		});
	};

	//Remove this check once we are done with closed beta
	User.hasClosedBetaAccess(req.params.fbid, function(error, result) {
		if(error) {
			handleError(res, next, "Error checking closed beta access: ", error);
			return;
		}
		if(result === false) {
			res.send({
				id: null
			});
			next();
			return;
		}
		fb.getServerSideToken(req.params.accesstoken, function(error, longToken) {
			if(error) {
				handleError(res, next, "Error authenticating with facebook: ", error);
				return;
			}

			//Get user for facebook id, if not exists create user
			User.getUserFromFacebookID(req.params.fbid, function(error, user) {
				if(error) {
					handleError(res, next, "Error retrieving user by Facebook ID: ", error);
					return;
				}
				if(user === null) {
					//Create user
					fb.getUserInfo(longToken, function(error, fbUserInfo) {
						if(error) {
							handleError(res, next, "Error retrieving user from Facebook: ", error);
							return;
						}
						User.createUserFromFacebookInfo(fbUserInfo, function(error, user) {
							if(error) {
								handleError(res, next, "Error creating user: ", error);
								return;
							}
							createSession(user, longToken);
						});
					});
				}
				else {
					createSession(user, longToken);
				}
			});
		});
	});
};

readUserWithID = function(req, res, next) {
	isAuthorized(req.params.id, function(error, status) {
		var handleRead;
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		handleRead = function(error, user) {
			if(error) {
				handleError(res, next, "Error reading user: ", error);
				return;
			}
			res.send(user);
			next();
		};
		if(status === true) {
			User.readUser(req.params.id, handleRead);
		}
		else {
			User.readPublicUser(req.params.id, handleRead);
		}
	});
};

updateUserWithID = function(req, res, next) {
	isAuthorized(req.params.id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}

		User.update(req.params.id, req.params, function(error, updatedUser) {
			if(error) {
				handleError(res, next, "Error updating user: ", error);
				return;
			}
			res.send(updatedUser);
			next();
		});
	});
};

updateUserBankDetails = function(req, res, next) {
	isAuthorized(req.params.id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		User.updateBankDetails(req.params.id, req.params, function(error) {
			if(error) {
				handleError(res, next, "Error adding bank details: ", error);
				return;
			}
			res.send({});
			next();
		});
	});
};

readGearFromUserWithID = function(req, res, next) {
	Gear.readGearFromUser(req.params.user_id, function(error, gearList) {
		if(error) {
			handleError(res, next, "Error retrieving gear list: ", error);
			return;
		}
		res.send(gearList);
		next();
	});
};

/**
 * It is not possible to update type for existing gear.
 * @return the updated gear
 */
updateGearFromUserWithID = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		var updatedGearData;
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		updatedGearData = {
			subtype: req.params.subtype,
			brand: req.params.brand,
			model: req.params.model,
			description: req.params.description,
			images: req.params.images,
			price_a: req.params.price_a,
			price_b: req.params.price_b,
			price_c: req.params.price_c,
			address: req.params.address,
			postal_code: req.params.postal_code,
			city: req.params.city,
			region: req.params.region,
			country: req.params.country,
			latitude: req.params.latitude,
			longitude: req.params.longitude
		};

		Gear.updateGearWithID(req.params.gear_id, updatedGearData, function(error) {
			if(error) {
				handleError(res, next, "Error updating gear: ", error);
				return;
			}
			res.send(updatedGearData);
			next();
		});
	});
};

readGearAvailability = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		Availability.get(req.params.gear_id, function(error, availabilityArray) {
			if(error) {
				handleError(res, next, "Error getting gear availability: ", error);
				return;
			}
			Gear.getAlwaysFlag(req.params.gear_id, function(error, result) {
				if(error) {
					handleError(res, next, "Error getting alwaysFlag: ", error);
					return;
				}
				res.send({
					availabilityArray: availabilityArray,
					alwaysFlag: result.always_available
				});
				next();
			});
		});
	});
};

createGearAvailability = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		var availability;
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		availability = JSON.parse(req.params.availability);
		//Check that the user owns the gear
		Gear.checkOwner(req.params.user_id, req.params.gear_id, function(error, data) {
			if(error) {
				handleError(res, next, "Error checking gear ownership: ", error);
				return;
			}
			if(data === false) {
				handleError(res, next, "Error checking gear ownership: ", "User " + req.params.user_id + " does not own gear " + req.params.gear_id);
				return;
			}
			Gear.getAlwaysFlag(req.params.gear_id, function(error, result) {
				var setAvailability;
				if(error) {
					handleError(res, next, "Error getting always flag: ", error);
					return;
				}
				setAvailability = function() {
					Availability.set(req.params.gear_id, availability, function(error) {
						if(error) {
							handleError(res, next, "Error setting gear availability: ", error);
							return;
						}
						res.send({});
						next();
					});
				};
				if(result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
					Gear.setAlwaysFlag(req.params.gear_id, req.params.alwaysFlag, function(error) {
						if(error) {
							handleError(res, next, "Error setting always flag: ", error);
							return;
						}
						setAvailability();
					});
				}
				else {
					setAvailability();
				}
			});
		});
	});
};

readReservationsFromUserWithID = function(req, res, next) {
    Booking.readReservationsForUser(req.params.renter_id, function (error, reservations) {
        if (error) {
            handleError(res,next,"Error reading reservations for user: ",error);
            return;
        }
        res.send(reservations);
        next();
    });
};

createBooking = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		Booking.create(req.params.user_id, req.params, function(error, booking) {
			if(error) {
				handleError(res, next, "Error creating booking: ", error);
				return;
			}
			res.send(booking);
			next();
		});
	});
};

readBooking = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		var handleBookingResponse;
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		handleBookingResponse = function(error, booking) {
			if(error) {
				handleError(res, next, "Error reading booking: ", error);
				return;
			}
			res.send(booking);
			next();
		};
		if(req.params.booking_id === "latest") {
			Booking.readClosest(req.params.gear_id, handleBookingResponse);
		}
		else {
			Booking.read(req.params.booking_id, handleBookingResponse);
		}
	});
};

updateBooking = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		Booking.update(req.params, function(error) {
			if(error) {
				handleError(res, next, "Error updating booking: ", error);
				return;
			}
			res.send({});
			next();
		});
	});
};

createCardObject = function(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, "Error authorizing user: ", error);
			return;
		}
		if(status === false) {
			handleError(res, next, "Error authorizing user: ", "User is not authorized.");
			return;
		}
		User.getCardObject(req.params.user_id, function(error, cardObject) {
			if(error) {
				handleError(res, next, "Error getting card object: ", error);
				return;
			}
			res.send(cardObject);
			next();
		});
	});
};

/* UTILITIES */
handleError = function(res, next, message, error) {
	console.log(message + JSON.stringify(error));
	res.send({error: error});
	next();
};

isAuthorized = function(userID, callback) {
	User.getToken(userID, function(error, token) {
		if(error) {
			callback(error);
			return;
		}
		fb.checkToken(token, function(error, tokenStatus) {
			if(error) {
				callback(error);
				return;
			}
			if(tokenStatus !== "valid") {
				callback(null, false);
			}
			else {
				callback(null, true);
			}
		});
	});
	/*fb.checkToken(fbLongToken, function(error, tokenStatus) {
		if(error) {
			callback(error);
			return;
		}
		if(tokenStatus !== "valid") {
			callback("Error checking token: Token not valid.");
			return;
		}
		User.matchToken(userID, fbLongToken, function(error, didMatch) {
			if(error) {
				callback(error);
				return;
			}
			callback(null, didMatch);
		});
	});*/
};

//ROUTES
server.get("/", healthCheck);

secureServer.get("/gearclassification", readGearClassification);

secureServer.post("/gear", createGear);
secureServer.post("/gearlist", createGearFromList);
secureServer.get("/gear/:id", readGearWithID);
secureServer.post("/gear/image", addImageToGear);
secureServer.get("/gear/search/:location/:gear/:daterange", readGearSearchResults);

secureServer.post("/users/login", createUserSession);
secureServer.get("/users/:id", readUserWithID);
secureServer.put("/users/:id", updateUserWithID);
secureServer.put("/users/:id/bankdetails", updateUserBankDetails);
secureServer.get("/users/:user_id/gear", readGearFromUserWithID);
secureServer.put("/users/:user_id/gear/:gear_id", updateGearFromUserWithID);
secureServer.post("/users/:user_id/gear/:gear_id/availability", createGearAvailability);
secureServer.get("/users/:user_id/gear/:gear_id/availability", readGearAvailability);
secureServer.get("/users/:renter_id/reservations", readReservationsFromUserWithID);
secureServer.get("/users/:id/newfilename/:filename", generateFileName);
secureServer.post("/users/:user_id/gear/:gear_id/bookings", createBooking);
secureServer.get("/users/:user_id/gear/:gear_id/bookings/:booking_id", readBooking);
secureServer.put("/users/:user_id/gear/:gear_id/bookings/:booking_id", updateBooking);
secureServer.get("/users/:user_id/cardobject", createCardObject);

module.exports = {
	server: server
};
