/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */

var restify = require('restify'),
	config = require('./config'),
	fb = require('./facebook'),
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
//server.get('/gearclassification', readGearClassification);

//server.post('/gear', createGear);
//server.get('/gear/:id', readGearWithID);
//server.put('/gear/:id', updateGearWithID);
//server.del('/gear/:id', deleteGearWithID);

server.get('/gear/search/:location/:gear/:daterange', readGearSearchResults);

//server.get('/gear/:id/bookings', readGearWithIDBookings);

server.post('/users/login', createUserSession);
//server.get('/users/:id', readUserWithID);
//server.put('/users/:id', updateUserWithID);
server.get('/users/:id/gear', readGearFromUserWithID);
server.get('/users/:id/reservations', readReservationsFromUserWithID);
//server.get('/users/search/:string', readUserSearchResults);

//server.post('/bookings', createBooking);
//server.put('/bookings/:id', updateBooking);
//server.del('/bookings/:id', deleteBooking);

//ROUTE HANDLERS

/**
 * @response: JSON description of the Sharingear gear classification
 */
/*function readGearClassification(req, res, next) {
	res.send({
		guitars: ['Electric Guitar', 'Acoustic Guitar', 'Ukulele'],
		basses: ['Electric Bass', 'Left-handed bass'],
		cabinet: []
	});
	next();
}*/

/**
 * @params: User ID, token and gear data
 * @return: new gear id or error.
 */
/*function createGear(req, res, next) {
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

/**
 * @param: A search string
 * @return: {} or an array of search results
 */
function readGearSearchResults(req, res, next) {
	res.send([{
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Flying V Goth',
		description: 'blah blah',
		photos: 'url,url,url',
		price1: 4,
		price2: 15,
		price3: 75,
		city: 'Copenhagen',
		address: '',
		seller_user_id: 0
	}, {
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Flying V Goth',
		description: 'blah blah',
		photos: 'url,url,url',
		price1: 4,
		price2: 15,
		price3: 75,
		city: 'Copenhagen',
		address: '',
		seller_user_id: 0
	}, {
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Flying V Goth',
		description: 'blah blah',
		photos: 'url,url,url',
		price1: 4,
		price2: 15,
		price3: 75,
		city: 'Copenhagen',
		address: '',
		seller_user_id: 0
	}]);

	next();
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
 * @param accesstoken: FB access token
 */
function createUserSession(req, res, next) {
	fb.authenticate(req.params.accesstoken, function(error, newAccessToken) {
		if(error) {
			console.log('Error authenticating with facebook: ' + JSON.stringify(error));
			res.send({error: error});
			next();
			return;
		}

		console.log('Got new access token: ' + newAccessToken);
		res.send({});
		next();
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
	res.send([{
		id: 0,
		type: 0,
		subtype: 0,
		brand: 0,
		model: 'Flying V Goth found in search',
		description: 'blah blah',
		photos: 'url,url,url',
		price: 100.5,
		seller_user_id: 0
	}]);
	next();
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

module.exports = {
	server: server
};
