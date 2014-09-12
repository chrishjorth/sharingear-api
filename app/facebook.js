/**
 * Handles communication with the Facebook API.
 * @author: Chris Hjorth
 */
//TODO: Add secret proof to graph calls

var https = require('https'),
	crypto = require('crypto'),
	appID = '522375581240221',
	appSecret = '95b95a4a2e59ddc98136ce54b8a0f8d2';

module.exports = {
	getServerSideToken: getServerSideToken,
	getUserInfo: getUserInfo,
	checkToken: checkToken
};

function getSecretProof(accessToken) {
	var hmac = crypto.createHmac('sha256', appSecret);
	hmac.update(accessToken);
	return hmac.digest('hex');
}

function getServerSideToken(accessToken, callback) {
	var apiPath = '/oauth/access_token?client_id=' + appID + '&client_secret=' + appSecret + '&grant_type=fb_exchange_token&fb_exchange_token=' + accessToken;
	graphCall(apiPath, function(data) {
		callback(null, data.substring(data.indexOf('=') + 1));
	});
}

function getUserInfo(longToken, callback) {
	var apiPath = '/me?scope=email&access_token=' + longToken;
	graphCall(apiPath, function(data) {
		callback(null, JSON.parse(data));
	});
}

function checkToken(longToken, callback) {
	var apiPath = '/debug_token?input_token=' + longToken + '&access_token=' + getAppToken();
	graphCall(apiPath, function(data) {
		data = JSON.parse(data);
		if(data.error) {
			callback(data.error.message);
		}
		else {
			callback(null, 'valid');
		}
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
			//console.log('FB graph call ended. Buffer:');
			//console.log(buffer);
			callback(buffer);
		});
		result.on('error', function(e) {
			callback(e.message);
		});
	});

	request.end();
}

function getAppToken() {
	return appID + '|' + appSecret;
}

