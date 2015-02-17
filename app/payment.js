/**
 * Payment handling.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var https = require("https"),
	Moment = require("moment"),
	SendGrid = require("sendgrid")("sharingear", "Shar1ng3ar_"),
	db = require("./database"),
	Config = require("./config"),
	Gear = require("./gear"),
	FROM_ADDRESS = "service@sharingear.com",
	sg_user,
	
	updateUser,
	registerBankAccountForUser,
	createWalletForUser,
	getCardObject,
	preAuthorize,
	getPreauthorizationStatus,
	chargePreAuthorization,
	payOutSeller,

	sendReceipt,
	sendInvoice,

	getSGBalance,
	getSGTransactions,
	getSGPreauthorization,

	gatewayGet,
	gatewayPost,
	gatewayPut,
	getToken,

	createSharingearUser,
	registerSharingearBankDetails;

//Check if Sharingear user exists, if not create it and store ID in database
sg_user = null;
db.query("SELECT mangopay_id, wallet_id, vat FROM sharingear LIMIT 1", [], function(error, rows) {
	var createSGWallet, vat;
	if(error) {
		console.log("Error selecting Sharingear payment details: " + error);
		return;
	}
	if(rows.length > 0) {
		vat = rows[0].vat;
		if(rows[0].mangopay_id !== null && rows[0].mangopay_id !== "" && rows[0].wallet_id !== null && rows[0].wallet_id !== "") {
			sg_user = {
				mangopay_id: rows[0].mangopay_id,
				wallet_id: rows[0].wallet_id,
				vat: vat
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
					wallet_id: wallet_id,
					vat: vat
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

preAuthorize = function(sellerMangoPayData, buyerMangoPayData, bookingData, callback) {
	//var postData, sellerFee, sellerFeeVAT, buyerFee, buyerFeeVAT, sellerVAT, amount;
	var price, buyerFee, amount, postData;

	price = parseInt(bookingData.renter_price, 10);

	//View Sharingear transaction model document for explanation
	/*sellerFee = price / 100 * parseFloat(sellerMangoPayData.seller_fee);
	sellerFeeVAT = sellerFee / 100 * sg_user.vat;
	sellerVAT = (price - sellerFee - sellerFeeVAT) / 100 * sellerMangoPayData.vat;
	buyerFee = price / 100 * parseFloat(buyerMangoPayData.buyer_fee);
	buyerFeeVAT = buyerFee / 100 * sg_user.vat;
	amount = price + sellerVAT + buyerFee + buyerFeeVAT;
	
	console.log("--- PREAUTH:");
	console.log("price: " + price);
	console.log("sellerVAT: " + sellerVAT);
	console.log("buyerFee: " + buyerFee);
	console.log("buyerFeeVAT: " + buyerFeeVAT);
	console.log("amount: " + amount);*/

	buyerFee = price / 100 * parseFloat(buyerMangoPayData.buyer_fee);
	amount = price + buyerFee;

	console.log("--- PREAUTH:");
	console.log("price: " + price);
	console.log("buyerFee: " + buyerFee);
	console.log("amount: " + amount);

	postData = {
		AuthorId: buyerMangoPayData.mangopay_id,
		CardId: bookingData.cardId,
		DebitedFunds: {
			Currency: bookingData.renter_currency,
			Amount: amount * 100
		},
		SecureMode: "FORCE",
		SecureModeReturnURL: bookingData.returnURL
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

getPreauthorizationStatus = function(preauthID, callback) {
	gatewayGet("/preauthorizations/" + preauthID, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error getting Sharingear preauthorization: " + error);
			return;
		}
		parsedData = JSON.parse(data);
		console.log("PREAUTH STATUS:");
		console.log(data);
		callback(null, parsedData.PaymentStatus);
	});
};

chargePreAuthorization = function(seller, buyer, bookingData, callback) {
	//var postData, sellerFee, sellerFeeVAT, buyerFee, buyerFeeVAT, sellerVAT, amount;
	var price, buyerFee, amount, postData;

	price = parseInt(bookingData.renter_price, 10);
	
	//View Sharingear transaction model document for explanation
	/*sellerFee = price / 100 * parseFloat(seller.seller_fee);
	sellerFeeVAT = sellerFee / 100 * sg_user.vat;
	sellerVAT = (price - sellerFee - sellerFeeVAT) / 100 * seller.vat;
	buyerFee = price / 100 * parseFloat(buyer.buyer_fee);
	buyerFeeVAT = buyerFee / 100 * sg_user.vat;
	amount = price + sellerVAT + buyerFee + buyerFeeVAT;
	
	console.log("--- CHARGE:");
	console.log("price: " + price);
	console.log("sellerVAT: " + sellerVAT);
	console.log("buyerFee: " + buyerFee);
	console.log("buyerFeeVAT: " + buyerFeeVAT);
	console.log("amount: " + amount);*/

	buyerFee = price / 100 * parseFloat(buyer.buyer_fee);
	amount = price + buyerFee;

	console.log("--- CHARGE:");
	console.log("price: " + price);
	console.log("buyerFee: " + buyerFee);
	console.log("amount: " + amount);

	postData = {
		AuthorId: buyer.mangopay_id,
		DebitedFunds: {
			Currency: bookingData.renter_currency,
			Amount: amount * 100
		},
		Fees: {
			Currency: bookingData.renter_currency,
			Amount: buyerFee * 100
		},
		CreditedWalletId: sg_user.wallet_id,
		PreauthorizationId: bookingData.preauth_id
	};
	gatewayPost("/payins/PreAuthorized/direct", postData, function(error, data) {
		var parsedData, receiptParameters;
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
		console.log("charged successfully");
		callback(null);
		receiptParameters = {
			price: price,
			fee: buyerFee,
			//vat: buyerFeeVAT,
			vat: "",
			//feeVat: sellerVAT,
			feeVat: "",
			currency: bookingData.renter_currency
		};
		sendReceipt(buyer, bookingData.gear_id, receiptParameters, function(error) {
			if(error) {
				console.log("Error sending receipt: " + error);
				return;
			}
		});
	});
};

payOutSeller = function(seller, bookingData, callback) {
	//var sellerFee, sellerFeeVAT, sellerVAT, amount, postData;
	var price, sellerFee, amount, postData;

	price = parseInt(bookingData.owner_price, 10);

	/*sellerFee = price / 100 * parseFloat(seller.seller_fee);
	sellerFeeVAT = sellerFee / 100 * sg_user.vat;
	sellerVAT = (price - sellerFee - sellerFeeVAT) / 100 * seller.vat;
	amount = price + sellerVAT;

	console.log("--- PAY OWNER:");
	console.log("price: " + price);
	console.log("sellerFee: " + sellerFee);
	console.log("sellerFeeVAT: " + sellerFeeVAT);
	console.log("sellerVAT: " + sellerVAT);
	console.log("amount: " + amount);*/

	sellerFee = price / 100 * parseFloat(seller.seller_fee);
	amount = price;

	console.log("--- PAY OWNER:");
	console.log("price: " + price);
	console.log("sellerFee: " + sellerFee);
	console.log("amount: " + amount);

	postData = {
		AuthorId: sg_user.mangopay_id,
		CreditedUserId: seller.mangopay_id,
		DebitedFunds: {
			Amount: amount * 100,
			Currency: bookingData.owner_currency
		},
		Fees: {
			Amount: sellerFee * 100,
			Currency: bookingData.owner_currency
		},
		DebitedWalletID: sg_user.wallet_id,
		CreditedWalletID: seller.wallet_id
	};

	gatewayPost("/transfers", postData, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error transfering between wallets: " + error);
			return;
		}
		parsedData = JSON.parse(data);
		if(parsedData.Status !== "SUCCEEDED") {
			callback("Error transfering between wallets: " + data);
			return;
		}
		postData = {
			AuthorId: seller.mangopay_id,
			DebitedFunds: {
				Amount: parsedData.CreditedFunds.Amount,
				Currency: bookingData.owner_currency
			},
			Fees: {
				Amount: 0,
				Currency: bookingData.owner_currency
			},
			DebitedWalletID: seller.wallet_id,
			BankAccountId: seller.bank_id,
			BankWireRef: "Sharingear rental"
		};
		gatewayPost("/payouts/bankwire", postData, function(error, data) {
			var parsedData, receiptParameters;
			if(error) {
				callback("Error wiring from wallet: " + error);
				return;
			}
			parsedData = JSON.parse(data);
			if(parsedData.Status !== "SUCCEEDED" && parsedData.Status !== "CREATED") {
				callback("Error wiring from wallet: " + data);
				return;
			}
			console.log("payout successful");
			callback(null);
			receiptParameters = {
				price: price,
				fee: sellerFee,
				//vat: sellerVAT,
				vat: "",
				//feeVat: sellerFeeVAT,
				feeVat: "",
				currency: bookingData.owner_currency
			};
			sendInvoice(seller, bookingData.gear_id, receiptParameters, function(error) {
				if(error) {
					console.log("Error sending receipt: " + error);
					return;
				}
			});
		});
	});
};

sendReceipt = function(receiver, bookedGearID, parameters, callback) {
	Gear.readGearWithID(bookedGearID, function(error, bookedGear) {
		var emailParameters, text, email;
		if(error) {
			callback(error);
			return;
		}
		text = "Sharingear BOOKING RECEIPT:\n\n";
		text += "Item\t\t\t\tPrice\n--------------------\n";
		text += bookedGear.brand + " " + bookedGear.model + " " + bookedGear.subtype + "\t\t" + parameters.price + " " + parameters.currency + "\n";
		text += "Sharingear service fee\t\t" + parameters.fee + " " + parameters.currency + "\n";
		text += "Total ex. VAT:\t\t" + (parameters.price + parameters.fee) + " " + parameters.currency + "\n";
		text += "VAT:\t\t" + parameters.vat + " " + parameters.currency + "\n";
		text += "Sharingear service fee VAT:\t\t" + parameters.feeVat + " " + parameters.currency + "\n";
		text += "Total:\t\t" + (parameters.price + parameters.fee + parameters.vat + parameters.feeVat) + " " + parameters.currency + "\n\n\n";
		text += "Sharingear, Landemærket 8, 1. 1119, København K, Denmark, DK35845186, www.sharingear.com";
		emailParameters = {
			to: receiver.email,
			from: FROM_ADDRESS,
			subject: "Sharingear - payment receipt",
			text: text
		};
		email = new SendGrid.Email(emailParameters);
		SendGrid.send(email, function(error) {
			if(error) {
				callback(error);
				return;
			}
			callback(null);
		});
	});
};

sendInvoice = function(receiver, bookedGearID, parameters, callback) {
	Gear.readGearWithID(bookedGearID, function(error, bookedGear) {
		var emailParameters, text, email;
		if(error) {
			callback(error);
			return;
		}
		text = "Sharingear PAYOUT RECEIPT\n\n";
		text += "Item\t\t\t\tPrice\n--------------------";
		text += bookedGear.brand + " " + bookedGear.model + " " + bookedGear.subtype + "\t\t" + parameters.price + " " + parameters.currency + "\n";
		text += "Sharingear service fee\t\t" + (-1 * parameters.fee) + " " + parameters.currency + "\n";
		text += "Total ex. VAT:\t\t" + (parameters.price - parameters.fee) + " " + parameters.currency + "\n";
		text += "VAT:\t\t" + parameters.vat + " " + parameters.currency + "\n";
		text += "Sharingear service fee VAT:\t\t" + parameters.feeVat + " " + parameters.currency + "\n";
		text += "Total:\t\t" + (parameters.price - parameters.fee - parameters.feeVat + parameters.vat) + " " + parameters.currency + "\n\n";
		text += "PAID TO:\n";
		text += receiver.name + " " + receiver.surname + "\n";
		text += receiver.address + ", " + receiver.postal_code + " " + receiver.city + ", " + receiver.country + "\n";
		text += (new Moment()).format("DD/MM/YYYY HH:mm") + "\n\n\n";
		text += "Sharingear, Landemærket 8, 1. 1119, København K, Denmark, DK35845186, www.sharingear.com";
		emailParameters = {
			to: receiver.email,
			from: FROM_ADDRESS,
			subject: "Sharingear - payout receipt",
			text: text
		};
		email = new SendGrid.Email(emailParameters);
		SendGrid.send(email, function(error) {
			if(error) {
				callback(error);
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

getSGPreauthorization = function(preauthID, callback) {
	gatewayGet("/preauthorizations/" + preauthID, function(error, data) {
		var parsedData;
		if(error) {
			callback("Error getting Sharingear preauthorization: " + error);
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
			callback("Error getting token: " + error);
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
		LegalRepresentativeCountryOfResidence: "DK"/*,
		Statute: "",
		ProofOfRegistration: "",
		ShareholderDeclaration: "",
		*/
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
	getPreauthorizationStatus: getPreauthorizationStatus,
	chargePreAuthorization: chargePreAuthorization,
	payOutSeller: payOutSeller,

	sendReceipt: sendReceipt,
	sendInvoice: sendInvoice,

	getSGBalance: getSGBalance,
	getSGTransactions: getSGTransactions,
	getSGPreauthorization: getSGPreauthorization
};
