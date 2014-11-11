/**
 * Payment handling.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var MANGOPAY_SANDBOX_CLIENTID = "sharingear",
	MANGOPAY_SANDBOX_URL = "api.sandbox.mangopay.com",
	MANGOPAY_USERNAME = "sharingear",
	MANGOPAY_SANDBOX_KEY = "dX2tt67NAQyDtDWHSSHBEuHOnnYUd6pvCROsde0vTiL1Trhudg",
	https = require("https"),
	Moment = require("moment"),
	updateUser,
	registerBankAccountForUser,
	gatewayGet,
	gatewayPost,
	gatewayPut,
	getToken;

updateUser = function(mangopay_id, user, callback) {
	var data, handleResponse;

	data = {
		Email: user.email,
		FirstName: user.name,
		LastName: user.surname,
		Address: user.address,
		Birthday: parseInt((new Moment(user.birthdate, 'YYYY-MM-DD')).format('X'), 10), //MangoPay requires a unix timestamp
		Nationality: user.nationality,
		CountryOfResidence: user.country
	};

	handleResponse = function(error, response) {
		var responseData;
		if(error) {
			callback("Payment gateway error: " + response);
			return;
		}
		//console.log("Update response: " + response);
		responseData = JSON.parse(response);
		if(responseData.Type === "forbidden_ressource") {
			callback("Error calling gateway: " + responseData.Message);
			return;
		}
		if(responseData.errors) {
			callback("Gateway errors: " + response);
			return;
		}
		callback(null, responseData.Id);
	};

	if(mangopay_id === null) {
		gatewayPost("/users/natural", data, handleResponse);
	}
	else {
		gatewayPut("/users/natural/" + mangopay_id, data, handleResponse);
	}
};

registerBankAccountForUser = function(user, iban, swift, callback) {
	//Check if user has a bank account, if different then update
	gatewayGet("/users/" + user.mangopay_id + "/bankaccounts", function(error, data) {
		var postData, accounts, i;
		if(error) {
			callback(error);
			return;
		}

		accounts = JSON.parse(data);
		i = 0;
		while(i < accounts.length) {
			if(accounts[i].IBAN === iban && accounts[i].BIC === swift) {
				callback(null); //Is already registered so we ignore the request
				return;
			}
			i++;
		}

		postData = {
			OwnerName: user.name + " " + user.surname,
			UserId: user.id,
			Type: "IBAN",
			OwnerAddress: user.address,
			IBAN: iban,
			BIC: swift
		};
		
		gatewayPost("/users/" + user.mangopay_id + "/bankaccounts/IBAN", postData, function(error, data) {
			if(error) {
				console.log("Error registering bank details: " + error);
				callback("Error registering bank details: " + error);
				return;
			}
			callback(null);
		});
	});
};

gatewayGet = function(apiPath, callback) {
	getToken(function(error, token) {
		var buffer = "",
			options, request;
		if(error) {
			console.log(error);
			return;
		}

		options = {
			host: MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + MANGOPAY_SANDBOX_CLIENTID + apiPath,
			method: "GET",
			headers: {
				"Authorization": "Bearer " + token
			}
		};

		request = https.request(options, function(result) {
			result.setEncoding("utf8");
			result.on("data", function(chunk) {
				buffer += chunk;
			});
			result.on("end", function() {
				callback(null, buffer);
			});
			result.on("error", function(e) {
				callback(e.message);
			});
		});
		request.on("error", function(error) {
			callback("Error requesting from gateway: " + error.message);
		});
		request.end();
	});
};

gatewayPost = function(apiPath, data, callback) {
	getToken(function(error, token) {
		var buffer = "",
			options, postData, request;
		if(error) {
			console.log(error);
			return;
		}

		postData = JSON.stringify(data);

		options = {
			host: MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + MANGOPAY_SANDBOX_CLIENTID + apiPath,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": postData.length,
				"Authorization": "Bearer " + token
			}
		};

		request = https.request(options, function(result) {
			result.setEncoding("utf8");
			result.on("data", function(chunk) {
				buffer += chunk;
			});
			result.on("end", function() {
				callback(null, buffer);
			});
			result.on("error", function(e) {
				callback(e.message);
			});
		});
		request.on("error", function(error) {
			callback("Error requesting from gateway: " + error.message);
		});
		request.write(postData);
		request.end();
	});
};

gatewayPut = function(apiPath, data, callback) {
	getToken(function(error, token) {
		var buffer = "",
			options, postData, request;
		if(error) {
			console.log(error);
			return;
		}

		postData = JSON.stringify(data);

		options = {
			host: MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + MANGOPAY_SANDBOX_CLIENTID + apiPath,
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": postData.length,
				"Authorization": "Bearer " + token
			}
		};

		request = https.request(options, function(result) {
			result.setEncoding("utf8");
			result.on("data", function(chunk) {
				buffer += chunk;
			});
			result.on("end", function() {
				callback(null, buffer);
			});
			result.on("error", function(e) {
				callback(e.message);
			});
		});
		request.on("error", function(error) {
			callback("Error requesting from gateway: " + error.message);
		});
		request.write(postData);
		request.end();
	});
};

getToken = function(callback) {
	var buffer = "",
		request, options, postData, auth;

	auth = new Buffer(MANGOPAY_USERNAME + ":" + MANGOPAY_SANDBOX_KEY).toString("base64");
	
	postData = "grant_type=client_credentials";

	options = {
		host: MANGOPAY_SANDBOX_URL,
		port: 443,
		path: "/v2/oauth/token",
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Content-Length": postData.length,
			"Authorization": "Basic " + auth
		}
	};

	request = https.request(options, function(result) {
		result.setEncoding("utf8");
		result.on("data", function(chunk) {
			buffer += chunk;
		});
		result.on("end", function() {
			var data;
			data = JSON.parse(buffer);
			if(data.access_token) {
				callback(null, data.access_token);
			}
			else {
				callback("Token request failed: " + buffer);
			}
		});
		result.on("error", function(error) {
			callback("Error retrieving token: " + error.message);
		});
	});

	request.on("error", function(error) {
		callback("Error requesting token: " + error.message);
	});

	request.write(postData);

	request.end();
};

module.exports = {
	updateUser: updateUser,
	registerBankAccountForUser: registerBankAccountForUser
};
