/**
 * Handles communication with the Facebook API.
 * @author: Chris Hjorth
 */
//TODO: Add secret proof to graph calls

/*jslint node: true */
"use strict";

var https = require("https"),
	crypto = require("crypto"),
	appID = "522375581240221",
	appSecret = "95b95a4a2e59ddc98136ce54b8a0f8d2",

	getSecretProof,
	getServerSideToken,
	getUserInfo,
	checkToken,
	graphCall,
	getAppToken;

getSecretProof = function(accessToken) {
	var hmac = crypto.createHmac("sha256", appSecret);
	hmac.update(accessToken);
	return hmac.digest("hex");
};

getServerSideToken = function(accessToken, callback) {
	var apiPath = "/oauth/access_token?client_id=" + appID + "&client_secret=" + appSecret + "&grant_type=fb_exchange_token&fb_exchange_token=" + accessToken;
	graphCall(apiPath, function(error, data) {
		if(error) {
			callback(error);
			return;
		}
		callback(null, data.substring(data.indexOf("=") + 1));
	});
};

getUserInfo = function(longToken, callback) {
	var apiPath = "/me?scope=email&access_token=" + longToken;
	graphCall(apiPath, function(error, data) {
		var parsedData;
		if(error) {
			callback(error);
			return;
		}
		try {
			parsedData = JSON.parse(data);
		}
		catch(error) {
			callback(error);
			return;
		}
		callback(null, parsedData);
	});
};

checkToken = function(longToken, callback) {
	var apiPath = "/debug_token?input_token=" + longToken + "&access_token=" + getAppToken();
	graphCall(apiPath, function(error, data) {
		if(error) {
			callback(error);
			return;
		}
		data = JSON.parse(data);
		if(data.error) {
			callback(data.error.message);
		}
		else {
			callback(null, "valid");
		}
	});
};

graphCall = function(apiPath, callback) {
	var buffer = "",
		options, request;

	options = {
		host: "graph.facebook.com",
		port: 443,
		path: apiPath,
		method: "GET"
	};

	request = https.request(options, function(result) {
		result.setEncoding("utf8");
		result.on("data", function(chunk) {
			buffer += chunk;
		});
		result.on("end", function() {
			//console.log("FB graph call ended. Buffer:");
			//console.log(buffer);
			callback(null, buffer);
		});
		result.on("error", function(e) {
			callback(e.message);
		});
	});
	request.on("error", function(error) {
		console.log("Graph call error: " + JSON.stringify(error));
	});

	request.end();
};

getAppToken = function() {
	return appID + "|" + appSecret;
};

module.exports = {
	getServerSideToken: getServerSideToken,
	getUserInfo: getUserInfo,
	checkToken: checkToken
};

