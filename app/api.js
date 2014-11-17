/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */

var IS_LOCAL = false,
	restify = require('restify'),
	fs = require('fs'),
	_ = require('underscore'),
	config = require('./config'),
	fb = require('./facebook'),
	Sec = require('./sec'),
	User = require('./user'),
	Gear = require('./gear'),
	Availability = require('./availability'),
	Booking = require('./booking'),
	readFileSuccess = true,
	key, certificate,server;


try {
	key = fs.readFileSync('/home/chrishjorth/keys/server.key');
}
catch(error) {
	console.log('Could not read key file');
	readFileSuccess = false;
}

try {
	certificate = fs.readFileSync('/home/chrishjorth/keys/server.pem');
}
catch(error) {
	console.log('Could not read certificate file.');
	readFileSuccess = false;
}

if(IS_LOCAL === true || readFileSuccess === false) {
	//This is so that we do not need to have keys and certificates installed for localhost development, or if files could not be loaded.
	server = restify.createServer({
		name: 'Sharingear API'
	});
}
else {
	//We only run with https
	server = restify.createServer({
		name: 'Sharingear API',
		key: key,
		certificate: certificate
	});
}

//Tunnelblick uses 1337 apparently
server.listen(1338, function() {
	console.log('%s listening at %s', server.name, server.url);
});

server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());

//ROUTES
server.get('/gearclassification', readGearClassification);

server.post('/gear', createGear);
server.post('/gearlist', createGearFromList);
server.get('/gear/:id', readGearWithID);
server.post('/gear/image', addImageToGear);
server.get('/gear/search/:location/:gear/:daterange', readGearSearchResults);

//server.get('/gear/:id/bookings', readGearWithIDBookings);

server.post('/users/login', createUserSession);
server.get('/users/:id', readUserWithID);
server.put('/users/:id', updateUserWithID);
server.put('/users/:id/bankdetails', updateUserBankDetails);
server.get('/users/:user_id/gear', readGearFromUserWithID);
server.put('/users/:user_id/gear/:gear_id', updateGearFromUserWithID);
server.post('/users/:user_id/gear/:gear_id/availability', createGearAvailability);
server.get('/users/:user_id/gear/:gear_id/availability', readGearAvailability);

server.get('/users/:renter_id/reservations', readReservationsFromUserWithID);
//server.get('/users/search/:string', readUserSearchResults);

server.get('/users/:id/newfilename/:filename', generateFileName);

server.post('/users/:user_id/gear/:gear_id/bookings', createBooking);
server.get('/users/:user_id/gear/:gear_id/bookings/:booking_id', readBooking);
server.put('/users/:user_id/gear/:gear_id/bookings/:booking_id', updateBooking);
//server.del('/bookings/:id', deleteBooking);

server.get('/users/:user_id/cardobject', createCardObject);



//ROUTE HANDLERS

/**
 * @response: JSON description of the Sharingear gear classification
 */
function readGearClassification(req, res, next) {
	Gear.getClassification(function(error, gearClassification) {
		if(error) {
			handleError(res, next, 'Error retrieving gear classification: ', error);
			return;
		}
		res.send(gearClassification);
		next();
	});
}

/**
 * @params: User ID, token and gear data
 * @return: new gear id or error.
 */
function createGear(req, res, next) {
	var params = req.params,
		newGear;

	isAuthorized(params.owner_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		newGear = {
			type: params.type,
			subtype: params.subtype,
			brand: params.brand,
			model: params.model,
			decription: params.description,
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
				handleError(res, next, 'Error creating new gear: ', error);
				return;
			}
			res.send({id: gearID});
			next();
		});
	});
}

/**
 * @params: User ID, token and gear list as JSON string
 * @return: new gear id or error.
 */
function createGearFromList(req, res, next) {
	isAuthorized(req.params.owner_id, function(error, status) {
		var gearList;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		gearList = JSON.parse(req.params.gear_list);
		Gear.createGearBulk(req.params.owner_id, gearList, function(error) {
			if(error) {
				handleError(res, next, 'Error creating new gear from list: ', error);
				return;
			}
			res.send({});
			next();
		});
	});
}

function readGearWithID(req, res, next) {
	Gear.readGearWithID(req.params.id, function(error, gear) {
		if(error) {
			handleError(res, next, 'Error retrieving gear: ', error);
			return;
		}
		res.send(gear);
		next();
	});
}

/**
 * @params: ID of the gear
 * @return: JSON description of the gear
 */
/*function readGearWithID(req, res, next) {
	res.send({
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Flying V Goth',
		description: 'blah blah',
		photos: 'url,url,url',
		price: 100.5,
		seller_user_id: 0
	});
	next();
}*/

/**
 * @params: User ID, token and gear data to be updated
 * @return: JSON description of the updated gear or error.
 */
/*function updateGearWithID(req, res, next) {
	res.send({
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Flying V Goth updated',
		description: 'blah blah',
		photos: 'url,url,url',
		price: 100.5,
		seller_user_id: 0
	});
	next();
}*/

/**
 * @params: User ID, token and gear id.
 * @return: {} or error.
 */
/*function deleteGearWithID(req, res, next) {
	res.send({});
	next();
}*/

function addImageToGear(req, res, next) {
	//Validate the image url
	var imageURL = req.params.image_url,
		validation;

	imageURL = imageURL.split('?')[0]; //Remove eventual query string parameters inserted by meddlers
	validation = imageURL.split('/');
	if(validation[2] !== 'dev.sharingear.com') {
		handleError(res, next, 'Error adding image to gear: ', 'image url is from an invalid domain.');
		return;
	}

	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		Gear.addImage(req.params.user_id, req.params.gear_id, imageURL, function(error, images) {
			if(error) {
				handleError(res, next, 'Error authorizing user: ', error);
				return;
			}
			res.send({images: images});
			next();
		});
	});
}

function generateFileName(req, res, next) {
	var params = req.params;

	isAuthorized(params.id, function(error, status) {
		var newFileName, dot, extension, secret;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		dot = params.filename.indexOf('.');
		extension = params.filename.substring(dot + 1);
		newFileName = params.filename.substring(0, dot);
		newFileName = Sec.generateFileName(newFileName) + '.' + extension;
		secret = Sec.getFileSecretProof(newFileName);
		res.send({fileName: newFileName, secretProof: secret});
		next();
	});
}

/**
 * @param: A search string
 * @return: {} or an array of search results
 */
function readGearSearchResults(req, res, next) {
	var latLngArray, lat, lng;
	latLngArray = req.params.location.split(',');
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
}

/**
 * @param: gear id
 * @return: a set of bookings
 */
/*function readGearWithIDBookings(req, res, next) {
	res.send([{
		id: 0,
		start_time: '2014-08-15 14:31:00',
		end_time: '2014-08-20 14:31:00',
		status: true, //false is available for booking, true is booked
		gear_id: 0,
		buyer_user_id: null
	}]);
	next();
}*/

/**
 * Switches the FB short token for a long token, if the user does not exist information is retrieved from Facebook and the user is created.
 * @param accesstoken: FB access token
 * @return The user object
 */
function createUserSession(req, res, next) {
	var createSession;
	createSession = function(user, longToken) {
		User.setServerAccessToken(user.fbid, longToken, function(error) {
			if(error) {
				handleError(res, next, 'Error setting Access Token: ', error);
				return;
			}

			/*_.extend(user, {
				fb_token: longToken
			});*/

			res.send(user);
			next();
		});
	};

	fb.getServerSideToken(req.params.accesstoken, function(error, longToken) {
		if(error) {
			handleError(res, next, 'Error authenticating with facebook: ', error);
			return;
		}

		//Get user for facebook id, if not exists create user
		User.getUserFromFacebookID(req.params.fbid, function(error, user) {
			if(error) {
				handleError(res, next, 'Error retrieving user by Facebook ID: ', error);
				return;
			}
			if(user === null) {
				//Create user
				fb.getUserInfo(longToken, function(error, fbUserInfo) {
					if(error) {
						handleError(res, next, 'Error retrieving user from Facebook: ', error);
						return;
					}
					User.createUserFromFacebookInfo(fbUserInfo, function(error, user) {
						if(error) {
							handleError(res, next, 'Error creating user: ', error);
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
}

/**
 * @param: user id
 * @return: A JSON description of a user
 */
function readUserWithID(req, res, next) {
	isAuthorized(req.params.id, function(error, status) {
		var updatedGearData, handleRead;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		handleRead = function(error, user) {
			if(error) {
				handleError(res, next, 'Error reading user: ', error);
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
}

/**
 * @param: A user id and token
 * @return: The updated user description
 */
function updateUserWithID(req, res, next) {
	isAuthorized(req.params.id, function(error, status) {
		var updatedGearData;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}

		User.update(req.params.id, req.params, function(error, updatedUser) {
			if(error) {
				handleError(res, next, 'Error updating user: ', error);
				return;
			}
			res.send(updatedUser);
			next();
		});
	});
}

function updateUserBankDetails(req, res, next) {
	isAuthorized(req.params.id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		User.updateBankDetails(req.params.id, req.params, function(error) {
			if(error) {
				handleError(res, next, 'Error adding bank details: ', error);
				return;
			}
			User.createWallet(req.params.id, function(error) {
				if(error) {
					handleError(res, next, 'Error creating wallet: ', error);
					return;
				}
				res.send({});
				next();
			});
		});
	});
}

/**
 * @param: A user id.
 * @return: A list of gear
 */
function readGearFromUserWithID(req, res, next) {
	Gear.readGearFromUser(req.params.user_id, function(error, gearList) {
		if(error) {
			handleError(res, next, 'Error retrieving gear list: ', error);
			return;
		}
		res.send(gearList);
		next();
	});
}

/**
 * It is not possible to update type and subtype for existing gear.
 * @return the updated gear
 */
function updateGearFromUserWithID(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		var updatedGearData;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
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
				handleError(res, next, 'Error updating gear: ', error);
				return;
			}
			res.send(updatedGearData);
			next();
		});
	});
}

function readGearAvailability(req, res, next) {
	var responseObject = {};
	var avArray;
	var alwaysFlag;

	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}

		Availability.get(req.params.gear_id, function(error, availabilityArray) {
			if(error) {
				handleError(res, next, 'Error getting gear availability: ', error);
				return;
			}

			avArray = availabilityArray;

			Gear.getAlwaysFlag(req.params.user_id, req.params.gear_id, function(error, result) {

				if(error) {
					return;
				}

				alwaysFlag = result[0].always_available;

				responseObject = {availabilityArray: avArray, alwaysFlag: alwaysFlag};
				console.log("\nresObject: ");
				console.log(responseObject);
				res.send(responseObject);
				next();

			});
		});
	});
}

function createGearAvailability(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		var availability;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		availability = JSON.parse(req.params.availability);
		//Check that the user owns the gear
		Gear.checkOwner(req.params.user_id, req.params.gear_id, function(error, data) {
			if(error) {
				handleError(res, next, 'Error checking gear ownership: ', error);
				return;
			}
			if(data === false) {
				handleError(res, next, 'Error checking gear ownership: ', 'User ' + req.params.user_id + ' does not own gear ' + req.params.gear_id);
				return;
			}

			Gear.getAlwaysFlag(req.params.user_id, req.params.gear_id, function(error, result) {

				if(error) {
					return;
				}

				if(result[0].always_available != req.params.alwaysFlag) { //if flag changed, set it
					Gear.setAlwaysFlag(req.params.user_id, req.params.gear_id, req.params.alwaysFlag, function(error, result) {
						if(error) {
							return;
						}
					});
				};

				Availability.set(req.params.gear_id, availability, req.params.alwaysFlag, function(error) {
					if(error) {
						handleError(res, next, 'Error setting gear availability: ', error);
						return;
					}
					res.send({});
					next();
				});

			});
		});
	});
}

/**
 * @param: The user_id of the renter
 * @return: All bookings of the renter
 */
function readReservationsFromUserWithID(req, res, next) {
    Booking.readReservationsForUser(req.params.renter_id, function (error, reservations) {
        if (error) {
            handleError(res,next,'Error reading reservations for user: ',error);
            return;
        }
        res.send(reservations);
        next();
    });
}

/**
 * @param: a user id, token and booking parameters
 * @return: The booking with id.
 */
function createBooking(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		Booking.create(req.params.user_id, req.params, function(error, booking) {
			if(error) {
				handleError(res, next, 'Error creating booking: ', error);
				return;
			}
			res.send(booking);
			next();
		});
	});
}

function readBooking(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		var handleBookingResponse;
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		handleBookingResponse = function(error, booking) {
			if(error) {
				handleError(res, next, 'Error reading booking: ', error);
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
}

/**
 * @param: a booking id, user id and token
 * @return: the new booking data
 */
function updateBooking(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		Booking.update(req.params, function(error) {
			if(error) {
				handleError(res, next, 'Error updating booking: ', error);
				return;
			}
			res.send({});
			next();
		});
	});
}

/**
 * @param: a booking id, user id and token
 * @return: {} or error
 */
/*function deleteBooking(req, res, next) {
	res.send({});
	next();
}*/

function createCardObject(req, res, next) {
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		User.getCardObject(req.params.user_id, function(error, cardObject) {
			if(error) {
				handleError(res, next, 'Error getting card object: ', error);
				return;
			}
			res.send(cardObject);
			next();
		});
	});
}

/* UTILITIES */
function handleError(res, next, message, error) {
	console.log(message + JSON.stringify(error));
	res.send({error: error});
	next();
}

function isAuthorized(userID, callback) {
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
			if(tokenStatus !== 'valid') {
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
		if(tokenStatus !== 'valid') {
			callback('Error checking token: Token not valid.');
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
}

module.exports = {
	IS_LOCAL: IS_LOCAL,
	server: server
};
