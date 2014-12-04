/**
 * Payment handling.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var https = require("https"),
	Moment = require("moment"),
	db = require("./database"),
	Config = require("./config"),
	sg_user,
	
	updateUser,
	registerBankAccountForUser,
	createWalletForUser,
	getCardObject,
	preAuthorize,
	chargePreAuthorization,
	payOutSeller,

	getSGBalance,
	getSGTransactions,

	gatewayGet,
	gatewayPost,
	gatewayPut,
	getToken,

	createSharingearUser,
	registerSharingearBankDetails;

//Check if Sharingear user exists, if not create it and store ID in database
sg_user = null;
db.query("SELECT mangopay_id, wallet_id FROM sharingear LIMIT 1", [], function(error, rows) {
	var createSGWallet;
	if(error) {
		console.log("Error selecting Sharingear payment details: " + error);
		return;
	}
	if(rows.length > 0) {
		if(rows[0].mangopay_id !== null && rows[0].mangopay_id !== "" && rows[0].wallet_id !== null && rows[0].wallet_id !== "") {
			sg_user = {
				mangopay_id: rows[0].mangopay_id,
				wallet_id: rows[0].wallet_id
			};
			return;
		}
	}

	createSGWallet = function(mangopay_id) {
		createWalletForUser(mangopay_id, function(error, wallet_id) {
			if(error) {
				console.log("Error creating wallet for Sharingear: " + error);
				return;
			}
			db.query("UPDATE sharingear SET wallet_id=? LIMIT 1", [wallet_id], function(error) {
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
	};

	if(rows[0] && rows[0].mangopay_id !== null && rows[0].mangopay_id !== "") {
		createSGWallet(rows[0].mangopay_id);
	}
	else {
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
				db.query("INSERT INTO sharingear(mangopay_id) VALUES(?)", [mangopay_id], function(error) {
					if(error) {
						console.log("Error storing Sharingear mangopay_id: " + error);
						return;
					}
					createSGWallet(mangopay_id);
				});
			});
		});
	}
});

updateUser = function(mangopay_id, wallet_id, user, callback) {
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
		var responseData, mangopay_id;
		if(error) {
			callback("Payment gateway error: " + response);
			return;
		}
		//console.log("Update response: " + response);
		responseData = JSON.parse(response);
		if(responseData.type === "param_error") {
			callback("Bad parameter in gateway request: " + response);
			return;
		}
		if(responseData.Type === "forbidden_ressource") {
			callback("Error calling gateway: " + responseData.Message);
			return;
		}
		if(responseData.Type === "other") {
			callback("Error from gateway: " + response);
			return;	
		}
		if(responseData.errors) {
			callback("Gateway errors: " + response);
			return;
		}
		mangopay_id = responseData.Id;
		if(wallet_id !== null) {
			callback(null, mangopay_id, wallet_id);
		}
		else {
			createWalletForUser(mangopay_id, function(error, wallet_id) {
				if(error) {
					callback("Error creating wallet for updated user: " + error);
					return;
				}
				callback(null, mangopay_id, wallet_id);
			});
		}
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
			var parsedData;
			if(error) {
				callback("Error registering bank details: " + error);
				return;
			}
			parsedData = JSON.parse(data);
			if(parsedData.Type === "param_error") {
				callback("Parameter error in registering bank details: " + data);
				return;
			}
			callback(null, parsedData.Id);
		});
	});
};

createWalletForUser = function(mangopay_id, callback) {
	var postData = {
		Owners: [mangopay_id],
		Description: "Sharingear user wallet.",
		Currency: "DKK"
	};
	gatewayPost("/wallets", postData, function(error, data) {
		if(error) {
			console.log("Error creating wallet for user: " + error);
			return;
		}
		callback(null, JSON.parse(data).Id);
	});
};

getCardObject = function(mangopay_id, callback) {
	var postData = {
		UserId: mangopay_id,
		Currency: "DKK",
	};
	gatewayPost("/cardregistrations", postData, function(error, data) {
		var parsedData, cardObject;
		if(error) {
			callback("Error getting card registration object: " + error);
			return;
		}
		parsedData = JSON.parse(data);
		if(!parsedData.CardRegistrationURL || !parsedData.PreregistrationData || !parsedData.AccessKey) {
			callback("Error getting card registration object: " + data);
			return;
		}
		cardObject = {
			id: parsedData.Id,
			cardRegistrationURL: parsedData.CardRegistrationURL,
			preregistrationData: parsedData.PreregistrationData,
			accessKey: parsedData.AccessKey
		};
		callback(null, cardObject);
	});
};

preAuthorize = function(sellerMangoPayData, cardID, price, returnURL, callback) {
	var postData = {
		AuthorId: sellerMangoPayData.mangopay_id,
		CardId: cardID,
		DebitedFunds: {
			Currency: "DKK",
			Amount: parseInt(price, 10) * 100
		},
		SecureMode: "FORCE",
		SecureModeReturnURL: returnURL
	};
	gatewayPost("/preauthorizations/card/direct", postData, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error preauthorizing debit: " + error);
			return;
		}
		console.log(data);
		parsedData = JSON.parse(data);
		if(parsedData.Status === "FAILED") {
			callback("Error preauthorizing debit: " + parsedData.ResultMessage);
			return;
		}
		callback(null, {
			preAuthID: parsedData.Id,
			verificationURL: parsedData.SecureModeRedirectURL
		});
	});
};

chargePreAuthorization = function(buyerMangoPayData, price, preAuthID, callback) {
	var postData,
		fee;

	fee = parseInt(price, 10) / 100.0 * buyerMangoPayData.buyer_fee;

	postData = {
		AuthorId: buyerMangoPayData.mangopay_id,
		DebitedFunds: {
			Currency: "DKK",
			Amount: parseInt(price, 10) * 100
		},
		Fees: {
			Currency: "DKK",
			Amount: fee * 100
		},
		CreditedWalletId: sg_user.wallet_id,
		PreauthorizationId: preAuthID
	};
	gatewayPost("/payins/PreAuthorized/direct", postData, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error charging preauthorized booking: " + error);
			return;
		}
		parsedData = JSON.parse(data);
		if(parsedData.Status !== "SUCCEEDED") {
			console.log("chargePreAuthorization response: ");
			console.log(data);
			callback("Charging preauthorized booking failed.");
			return;
		}
		callback(null);
	});
};

payOutSeller = function(sellerMangoPayData, price, callback) {
	//Transfer from SG wallet to seller wallet
	//Payout seller from his wallet
	var fee, postData;

	fee = parseInt(price, 10) / 100.0 * sellerMangoPayData.seller_fee;

	postData = {
		AuthorId: sg_user.mangopay_id,
		CreditedUserId: sellerMangoPayData.mangopay_id,
		DebitedFunds: {
			Amount: parseInt(price, 10) * 100,
			Currency: "DKK"
		},
		Fees: {
			Amount: fee * 100,
			Currency: "DKK"
		},
		DebitedWalletID: sg_user.wallet_id,
		CreditedWalletID: sellerMangoPayData.wallet_id
	};

	gatewayPost("/transfers", postData, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error transfering between wallets: " + error);
			return;
		}
		console.log("transfer data:");
		console.log(data);
		parsedData = JSON.parse(data);
		if(parsedData.Status !== "SUCCEEDED") {
			callback("Error transfering between wallets: " + data);
			return;
		}
		postData = {
			AuthorId: sellerMangoPayData.mangopay_id,
			DebitedFunds: {
				Amount: parsedData.CreditedFunds.Amount,
				Currency: "DKK"
			},
			Fees: {
				Amount: 0,
				Currency: "DKK"
			},
			DebitedWalletID: sellerMangoPayData.wallet_id,
			BankAccountId: sellerMangoPayData.bank_id,
			BankWireRef: "Sharingear rental"
		};
		gatewayPost("/payouts/bankwire", postData, function(error, data) {
			var parsedData;
			if(error) {
				callback("Error wiring from wallet: " + error);
				return;
			}
			console.log("wire data:");
			console.log(data);
			parsedData = JSON.parse(data);
			if(parsedData.Status !== "SUCCEEDED" && parsedData.Status !== "CREATED") {
				callback("Error wiring from wallet: " + data);
				return;
			}
			callback(null);
		});
	});
};

getSGBalance = function(callback) {
	gatewayGet("/wallets/" + sg_user.wallet_id, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error getting Sharingear wallet: " + error);
			return;
		}
		parsedData = JSON.parse(data);
		callback(null, parsedData.Balance);
	});
};

getSGTransactions = function(callback) {
	gatewayGet("/wallets/" + sg_user.wallet_id + "/transactions", function(error, data) {
		var parsedData;
		if(error) {
			callback("Error getting Sharingear transactions: " + error);
			return;
		}
		parsedData = JSON.parse(data);
		callback(null, parsedData);
	});
};

gatewayGet = function(apiPath, callback) {
	getToken(function(error, token) {
		var buffer = "",
			options, request;
		if(error) {
			callback(error);
			return;
		}

		options = {
			host: Config.MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + Config.MANGOPAY_SANDBOX_CLIENTID + apiPath,
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
			callback(error);
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
			host: Config.MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + Config.MANGOPAY_SANDBOX_CLIENTID + apiPath,
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
			callback(error);
			return;
		}

		postData = JSON.stringify(data);

		options = {
			host: Config.MANGOPAY_SANDBOX_URL,
			port: 443,
			path: "/v2/" + Config.MANGOPAY_SANDBOX_CLIENTID + apiPath,
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

	auth = new Buffer(Config.MANGOPAY_USERNAME + ":" + Config.MANGOPAY_SANDBOX_KEY).toString("base64");
	
	postData = "grant_type=client_credentials";

	options = {
		host: Config.MANGOPAY_SANDBOX_URL,
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
			try {
				data = JSON.parse(buffer);
			}
			catch(error) {
				callback("Error parsing token response: " + error);
				return;
			}
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
		callback("Error requesting mangopay token: " + error.message);
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
	getCardObject: getCardObject,
	preAuthorize: preAuthorize,
	chargePreAuthorization: chargePreAuthorization,
	payOutSeller: payOutSeller,

	getSGBalance: getSGBalance,
	getSGTransactions: getSGTransactions
};
