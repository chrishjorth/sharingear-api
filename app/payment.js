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
	db = require("./database"),
	sg_user,
	
	updateUser,
	registerBankAccountForUser,
	createWalletForUser,

	gatewayGet,
	gatewayPost,
	gatewayPut,
	getToken,

	createSharingearUser,
	registerSharingearBankDetails;

//Check if Sharingear user exists, if not create it and store ID in database
sg_user = null;
db.query("SELECT mangopay_id, wallet_id FROM sharingear LIMIT 1", [], function(error, rows) {
	if(error) {
		console.log("Error selecting Sharingear payment details: " + error);
		return;
	}
	if(rows.length > 0) {
		sg_user = {
			mangopay_id: rows[0].mangopay_id,
			wallet_id: rows[0].wallet_id
		};
		return;
	}
	createSharingearUser(function(error, mangopay_id) {
		if(error) {
			console.log("Error creating Sharingear user: " + error);
			return;
		}
		registerSharingearBankDetails(mangopay_id, function(error) {
			if(error) {
				console.log("Error registering Sharingear bank details: " + error);
				return;
			}
			createWalletForUser(mangopay_id, function(error, wallet_id) {
				if(error) {
					console.log("Error creating wallet for Sharingear: " + error);
					return;
				}
				db.query("INSERT INTO sharingear(mangopay_id, wallet_id) VALUES(?,?)", [mangopay_id, wallet_id], function(error) {
					if(error) {
						console.log("Error storing Sharingear payment IDs: " + error);
						return;
					}
					sg_user = {
						mangopay_id: mangopay_id,
						wallet_id: wallet_id
					};
				});
			});
		});
	});
});

updateUser = function(mangopay_id, user, callback) {
	var data, handleResponse;

	data = {
		Email: user.email,
		FirstName: user.name,
		LastName: user.surname,
		Address: user.address,
		Birthday: parseInt((new Moment(user.birthdate, "YYYY-MM-DD")).format("X"), 10), //MangoPay requires a unix timestamp
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
	//console.log('mangopay id: ' + user.mangopay_id);
	gatewayGet("/users/" + user.mangopay_id + "/bankaccounts", function(error, data) {
		var postData, accounts, i;
		if(error) {
			callback(error);
			return;
		}
		//console.log(data);
		accounts = JSON.parse(data);
		i = 0;
		while(i < accounts.length) {
			if(accounts[i].IBAN === iban && accounts[i].BIC === swift) {
				callback(null, accounts[i].Id); //Is already registered so we ignore the request
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
			//console.log(data);
			callback(null, JSON.parse(data).Id);
		});
	});
};

createWalletForUser = function(mangopay_id, callback) {
	var postData = {
		Owners: [mangopay_id],
		Description: "Sharingear user wallet.",
		Currency: "EUR"
	};
	gatewayPost("/wallets", postData, function(error, data) {
		if(error) {
			console.log("Error creating wallet for user: " + error);
			return;
		}
		callback(null, JSON.parse(data).Id);
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
			options, postData, request, utf8overLoad;
		if(error) {
			console.log(error);
			return;
		}

		postData = JSON.stringify(data);

		//This is to send correct content length when dealing with unicode characters
		utf8overLoad = encodeURIComponent(postData).match(/%[89ABab]/g);
		if(utf8overLoad === null) {
			utf8overLoad = 0;
		}
		else {
			utf8overLoad = utf8overLoad.length;
		}

		options = {
			host: MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + MANGOPAY_SANDBOX_CLIENTID + apiPath,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": postData.length + utf8overLoad,
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
		request.write(postData, "utf8");
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

createSharingearUser = function(callback) {
	var postData = {
		Email: "chris@sharingear.com",
		Name: "Sharingear",
		LegalPersonType: "BUSINESS",
		HeadquartersAddress: "Landemaerket 8, 1. 1119 København K, Denmark",
		LegalRepresentativeFirstName: "Mircea Gabriel",
		LegalRepresentativeLastName: "Eftemie",
		LegalRepresentativeAdress: "Sigbrits Alle 5, st. th. 2300 Koebenhavn S, Denmark",
		LegalRepresentativeEmail: "mircea@sharingear.com",
		LegalRepresentativeBirthday: parseInt((new Moment("1980-06-03", "YYYY-MM-DD")).format("X"), 10), //MangoPay requires a unix timestamp
		LegalRepresentativeNationality: "DK",
		LegalRepresentativeCountryOfResidence: "DK"
	};
	gatewayPost("/users/legal", postData, function(error, data) {
		var parsedData;
		if(error) {
			callback(error);
			return;
		}
		parsedData = JSON.parse(data);
		if(parsedData.Type === "param_error") {
			console.log(data);
			callback("Parameter error.");
			return;
		}
		callback(null, JSON.parse(data).Id);
	});
};

registerSharingearBankDetails = function(mangopay_id, callback) {
	var iban = "DK1073120001003930",
		swift = "JYBADKKK",
		user;
	user = {
		mangopay_id: mangopay_id,
		name: "Mircea Gabriel",
		surname: "Eftemie",
		id: "sharingear",
		address: "Landemærket 8, 1. 1119 København K, Denmark"
	};
	registerBankAccountForUser(user, iban, swift, function(error) {
		callback(error);
	});
};

module.exports = {
	updateUser: updateUser,
	registerBankAccountForUser: registerBankAccountForUser,
	createWalletForUser: createWalletForUser
};
