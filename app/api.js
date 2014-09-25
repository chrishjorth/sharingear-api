/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */

var restify = require('restify'),
	_ = require('underscore'),
	config = require('./config'),
	fb = require('./facebook'),
	Sec = require('./sec'),
	User = require('./user'),
	Gear = require('./gear'),
	server;

server = restify.createServer({
	name: 'Sharingear API'
});

server.listen(1337, function() {
	console.log('%s listening at %s', server.name, server.url);
});

server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());

//ROUTES
server.get('/gearclassification', readGearClassification);

server.post('/gear', createGear);
server.get('/gear/:id', readGearWithID);
//server.put('/gear/:id', updateGearWithID);
//server.del('/gear/:id', deleteGearWithID);
server.post('/gear/image', addImageToGear);

server.get('/gear/search/:location/:gear/:daterange', readGearSearchResults);

//server.get('/gear/:id/bookings', readGearWithIDBookings);

server.post('/users/login', createUserSession);
//server.get('/users/:id', readUserWithID);
//server.put('/users/:id', updateUserWithID);
server.get('/users/:user_id/gear', readGearFromUserWithID);
server.put('/users/:user_id/gear/:gear_id', updateGearFromUserWithID);
server.get('/users/:id/reservations', readReservationsFromUserWithID);
//server.get('/users/search/:string', readUserSearchResults);

server.get('/users/:id/newfilename/:filename', generateFileName);

//server.post('/bookings', createBooking);
//server.put('/bookings/:id', updateBooking);
//server.del('/bookings/:id', deleteBooking);

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

	console.log('Valid image url');
	
	isAuthorized(req.params.user_id, function(error, status) {
		if(error) {
			handleError(res, next, 'Error authorizing user: ', error);
			return;
		}
		if(status === false) {
			handleError(res, next, 'Error authorizing user: ', 'User is not authorized.');
			return;
		}
		console.log('User is authorized');
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
	console.log(req.params.location);
	latLngArray = req.params.location.split(',');
	lat = latLngArray[0];
	lng = latLngArray[1];
	console.log('So far so good. gear: ' + req.params.gear);
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
				handleError(res, next, 'Error retrieving user by Facebook id: ', error);
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
/*function readUserWithID(req, res, next) {
	res.send({
		id: 0,
		type: 0,
		name: 'Chris',
		surname: 'Hjorth',
		birthdate: '1984-09-17',
		address: 'Anders Nielsens Vej 21A, 1. tv',
		postcode: 9400,
		state: 'Nordjylland',
		country: 'DNK'
	});
	next();
}*/

/**
 * @param: A search string
 * @return: {} or an array of search results
 */
/*function readUserSearchResults(req, res, next) {
	res.send([{
		id: 0,
		type: 0,
		name: 'Chris',
		surname: 'Hjorth',
		birthdate: '1984-09-17',
		address: 'Anders Nielsens Vej 21A, 1. tv',
		postcode: 9400,
		state: 'Nordjylland',
		country: 'DNK'
	}]);
	next();
}*/

/**
 * @param: A user id and token
 * @return: The updated user description
 */
/*function updateUserWithID(req, res, next) {
	res.send({
		id: 0,
		type: 0,
		name: 'Chris',
		surname: 'Hjorth',
		birthdate: '1984-09-17',
		address: 'somewhere',
		postcode: 1000,
		state: 'Hovedstaden',
		country: 'DNK'
	});
	next();
}*/

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
			brand: req.params.brand,
			model: req.params.model,
			description: req.params.description,
			images: req.params.images,
			price_a: req.params.price_a,
			price_b: req.params.price_b,
			price_c: req.params.price_c,
			address: req.params.address,
			postal_code: req.params.postalcode,
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

function readReservationsFromUserWithID(req, res, next) {
	res.send([{
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Gibson Guitar',
		description: 'blah blah',
		photos: 'url,url,url',
		price: 100.5,
		seller_user_id: 0,
		city: 'Copenhagen',
		address: '',
		price1: 4,
		price2: 15,
		price3: 75
	}, {
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Gibson Guitar',
		description: 'blah blah',
		photos: 'url,url,url',
		price: 100.5,
		seller_user_id: 0,
		city: 'Copenhagen',
		address: '',
		price1: 4,
		price2: 15,
		price3: 75
	}, {
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Gibson Guitar',
		description: 'blah blah',
		photos: 'url,url,url',
		price: 100.5,
		seller_user_id: 0,
		city: 'Copenhagen',
		address: '',
		price1: 4,
		price2: 15,
		price3: 75
	}]);
	next();
}

/**
 * @param: a user id, token and booking parameters
 * @return: The booking with id.
 */
/*function createBooking(req, res, next) {
	res.send({
		id: 0,
		start_time: '2014-08-15 14:31:00',
		end_time: '2014-08-20 14:31:00',
		status: true, //false is available for booking, true is booked
		gear_id: 0,
		buyer_user_id: null
	});
	next();
}*/

/**
 * @param: a booking id, user id and token
 * @return: the new booking data
 */
/*function updateBooking(req, res, next) {
	res.send({
		id: 0,
		start_time: '2014-08-15 14:31:00',
		end_time: '2014-08-20 14:31:00',
		status: true, //false is available for booking, true is booked
		gear_id: 0,
		buyer_user_id: null
	});
	next();
}*/

/**
 * @param: a booking id, user id and token
 * @return: {} or error 
 */
/*function deleteBooking(req, res, next) {
	res.send({});
	next();
}*/

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
	server: server
};
