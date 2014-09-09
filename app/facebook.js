/**
 * Handles communication with the Facebook API.
 * @author: Chris Hjorth
 */

var https = require('https'),
	crypto = require('crypto'),
	appID = '522375581240221',
	appSecret = '95b95a4a2e59ddc98136ce54b8a0f8d2',
	app_token = null;

module.exports = {
	authenticate: authenticate
};

/*function getAppToken(callback) {
	var apiPath = '/oauth/access_token?client_id=' + appID + '&client_secret=' + appSecret + '&grant_type=client_credentials';
	console.log('Try to get app token!');
	graphCall(apiPath, function(error, data) {
		if(error) {
			callback(error);
		}
		else {
			console.log('getAppToken success');
			callback(null, data);
		}
	});
}*/

function getSecretProof(accessToken) {
	var hmac = crypto.createHmac('sha256', appSecret);
	hmac.update(accessToken);
	return hmac.digest('hex');
}

function authenticate(id, accessToken, callback) {
	//var apiPath = '/oauth/access_token?grant_type=fb_exchange_token&appsecret_proof=' + getSecretProof(accessToken) + '&client_id=' + appID + '&client_secret=' + appSecret + '&fb_exchange_token=' + accessToken;
	var apiPath = '/oauth/access_token?client_id=' + appID + '&client_secret=' + appSecret + '&grant_type=fb_exchange_token&fb_exchange_token=' + accessToken;
	//var apiPath = 'oauth/access_token?client_id=' + appID + '&client_secret=' + appSecret + '&grant_type=client_credentials';
	//var apiPath = '/me' + '?access_token=' + accessToken;

	graphCall(apiPath, function(data) {
		var longToken;
		
		//Store access token for user in db
		//Retrieve user info from fb and store in db
		longToken = data.substring(data.indexOf('='));
		console.log(longToken);

		callback(null, longToken);
	});
}

function graphCall(apiPath, callback) {
	var buffer = '',
	options, request;

	options = {
		host: 'graph.facebook.com',
		port: 443,
		path: apiPath,
		method: 'GET'
	};

	request = https.get(options, function(result) {
		result.setEncoding('utf8');
		result.on('data', function(chunk) {
			buffer += chunk;
		});
		result.on('end', function() {
			console.log('FB graph call ended. Buffer:');
			console.log(buffer);
			callback(buffer);
		});
		result.on('error', function(e) {
			callback(e.message);
		});
	});

	request.end();
}
