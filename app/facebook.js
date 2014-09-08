/**
 * Handles communication with the Facebook API.
 * @author: Chris Hjorth
 */

var https = require('https'),
	appID = '522375581240221',
	appSecret = '95b95a4a2e59ddc98136ce54b8a0f8d2';

module.exports = {
	authenticate: authenticate,
	graphCall: graphCall
};

function authenticate(accessToken, callback) {
	var apiPath = '/oauth/access_token?grant_type=fb_exchange_token&client_id=' + appID + '&client_secret=' + appSecret + '&fb_exchange_token=' + accessToken;
	console.log('API PATH: ' + apiPath);
	this.graphCall(apiPath, function(error, data) {
		if(error) {
			callback(error);
		}
		else {
			callback(null, data);
		}
	});
}

function graphCall(apiPath, callback) {
	var buffer = '',
	options, request;

	options = {
		host: 'graph.facebook.com',
		port: 443, //https
		//port: 80,
		apiPath: apiPath,
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
			var data = JSON.parse(buffer);
			if(data.error) {
				callback(data.error);
			}
			else {
				callback(null, buffer);
			}
		});
		result.on('error', function(e) {
			callback(e.message);
		});
	});

	request.end();
}
