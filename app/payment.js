/**
 * Payment handling.
 * A user has a wallet for each currency.
 * User wallets are only used as middlemen, hence they always have balance 0 unless during a transaction.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var https = require("https"),
    Moment = require("moment"),
    _ = require("underscore"),
    db = require("./database"),
    Notifications = require("./notifications"),
    Config = require("./config"),
    Localization = require("./localization"),

    loadPayment,
    createSGWallets,
    getSGWalletForCurrency,
    updateUser,
    registerBankAccountForUser,
    createWalletsForUser,
    getWallets,
    getWalletForCurrency,
    getUserWalletsForCurrency,
    getCardObject,
    preAuthorize,
    getPreauthorizationStatus,
    chargePreAuthorization,
    payOutSeller,

    getSGBalance,
    getSGTransactions,
    getSGPreauthorization,

    gatewayGet,
    gatewayPost,
    gatewayPut,
    getToken,

    createSharingearUser,
    registerSharingearBankDetails;


loadPayment = function(callback) {
    var Payment = this;
    this.sg_user = {
        mangopay_id: null,
        wallets: [],
        vat: 0
    };
    //Check if Sharingear user exists, if not create it and store ID in database
    db.query("SELECT mangopay_id, vat FROM sharingear LIMIT 1", [], function(error, rows) {
        if (error) {
            callback("Error selecting Sharingear payment details: " + error);
            return;
        }
        if (rows[0] && rows[0].mangopay_id !== null && rows[0].mangopay_id !== "") {
            Payment.sg_user.mangopay_id = rows[0].mangopay_id;
            Payment.sg_user.vat = rows[0].vat;

            Payment.getWallets(Payment.sg_user.mangopay_id, function(error, wallets) {
                var sgCurrencies = [],
                    supportedCurrencies, i;
                if (error) {
                    callback("Error retrieving SG wallets: " + error);
                    return;
                }
                supportedCurrencies = Localization.getSupportedCurrencies();
                if (wallets.length <= 0) {
                    Payment.createSGWallets(supportedCurrencies, callback);
                } else if (wallets.length < supportedCurrencies.length) {
                    for (i = 0; i < wallets.length; i++) {
                        sgCurrencies.push(wallets[i].currency);
                    }
                    Payment.createSGWallets(_.difference(supportedCurrencies, sgCurrencies), callback);
                } else {
                    callback(null);
                }
            });
        } else {
            createSharingearUser(function(error, mangopay_id) {
                if (error) {
                    callback("Error creating Sharingear user: " + error);
                    return;
                }
                Payment.sg_user.mangopay_id = mangopay_id;
                Payment.sg_user.vat = Config.SHARINGEAR_VAT;
                registerSharingearBankDetails(mangopay_id, function(error) {
                    if (error) {
                        callback("Error registering Sharingear bank details: " + error);
                        return;
                    }
                    db.query("INSERT INTO sharingear(mangopay_id, vat) VALUES(?, ?)", [Payment.sg_user.mangopay_id, Payment.sg_user.vat], function(error) {
                        if (error) {
                            callback("Error storing Sharingear mangopay_id: " + error);
                            return;
                        }
                        Payment.createSGWallets(null, callback);
                    });
                });
            });
        }
    });
};

createSGWallets = function(currencies, callback) {
    var Payment = this;
    Payment.createWalletsForUser(Payment.sg_user.mangopay_id, currencies, function(error) {
        if (error) {
            callback("Error creating wallet for Sharingear: " + error);
            return;
        }
        Payment.getWallets(Payment.sg_user.mangopay_id, function(error, wallets) {
            if (error) {
                callback("Error retrieving newly created SG wallets: " + error);
                return;
            }
            Payment.sg_user.wallets = wallets;
            callback(null);
        });
    });
};

getSGWalletForCurrency = function(currency, callback) {
    var Payment = this,
        supportedCurrencies = Localization.getSupportedCurrencies(),
        sgCurrencies = [],
        getWallet, i;

    getWallet = function() {
        for (i = 0; i < Payment.sg_user.wallets.length; i++) {
            if (Payment.sg_user.wallets[i].currency === currency) {
                callback(null, Payment.sg_user.wallets[i]);
                return;
            }
        }
        callback("No SG wallet for currency: " + currency);
    };

    if (Payment.sg_user.wallets.length < supportedCurrencies.length) {
        //A currency got added since sg user was created
        for (i = 0; i < Payment.sg_user.wallets.length; i++) {
            sgCurrencies.push(Payment.sg_user.wallets[i].currency);
        }
        Payment.createSGWallets(_.difference(supportedCurrencies, sgCurrencies), function(error) {
            if (error) {
                callback("Error creating wallets for missing currencies");
                return;
            }
            Payment.getWallets(Payment.sg_user.mangopay_id, function(error, wallets) {
                if (error) {
                    callback("Error retrieving newly created SG wallets: " + error);
                    return;
                }
                Payment.sg_user.wallets = wallets;
                getWallet();
            });
        });
    } else {
        getWallet();
    }
};

updateUser = function(mangopay_id, user, callback) {
    var Payment = this,
        data, handleResponse;

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
        if (error) {
            callback("Payment gateway error: " + response);
            return;
        }
        responseData = JSON.parse(response);
        if (responseData.type === "param_error") {
            callback("Bad parameter in gateway request: " + response);
            return;
        }
        if (responseData.Type === "forbidden_ressource") {
            callback("Error calling gateway: " + responseData.Message);
            return;
        }
        if (responseData.Type === "other") {
            callback("Error from gateway: " + response);
            return;
        }
        if (responseData.errors) {
            callback("Gateway errors: " + response);
            return;
        }
        mangopay_id = responseData.Id;

        Payment.getWallets(mangopay_id, function(error, wallets) {
            var userCurrencies = [],
                supportedCurrencies, i;
            if (error) {
                callback("Error retrieving wallet IDs for user: " + error);
                return;
            }
            supportedCurrencies = Localization.getSupportedCurrencies();
            if (wallets.length <= 0) {
                //Create wallets for user
                Payment.createWalletsForUser(mangopay_id, null, function(error) {
                    if (error) {
                        callback(error);
                        return;
                    }
                    callback(null, mangopay_id);
                });
            } else if (supportedCurrencies.length < wallets.length) {
                //The user is missing wallets for some currencies
                for (i = 0; i < wallets.length; i++) {
                    userCurrencies.push(wallets[i].currency);
                }
                Payment.createWalletsForUser(mangopay_id, _.difference(supportedCurrencies, userCurrencies), function(error) {
                    if (error) {
                        callback(error);
                        return;
                    }
                    callback(null, mangopay_id);
                });
            } else {
                //The user already has the required wallets
                callback(null, mangopay_id);
            }
        });
    };

    if (mangopay_id === null) {
        gatewayPost("/users/natural", data, handleResponse);
    } else {
        gatewayPut("/users/natural/" + mangopay_id, data, handleResponse);
    }
};

registerBankAccountForUser = function(user, bankDetails, callback) {
    //Check if user has a bank account, if different then update
    gatewayGet("/users/" + user.mangopay_id + "/bankaccounts", function(error, data) {
        var postData, accounts, i;
        if (error) {
            callback(error);
            return;
        }
        accounts = JSON.parse(data);
        i = 0;
        while (i < accounts.length) {
            if (user.country === "US") {
                if (accounts[i].AccountNumber === bankDetails.accountNumber && accounts[i].ABA === bankDetails.aba) {
                    callback(null, accounts[i].Id); //Is already registered so we ignore the request
                    return;
                }
            } else {
                if (accounts[i].IBAN === bankDetails.iban && accounts[i].BIC === bankDetails.swift) {
                    callback(null, accounts[i].Id); //Is already registered so we ignore the request
                    return;
                }
            }
            i++;
        }

        postData = {
            OwnerName: user.name + " " + user.surname,
            UserId: user.id,
            OwnerAddress: user.address
        };

        if (user.country === "US") {
            postData.Type = "US";
            postData.AccountNumber = bankDetails.accountNumber;
            postData.ABA = bankDetails.aba;
        } else {
            postData.Type = "IBAN";
            postData.IBAN = bankDetails.iban;
            postData.BIC = bankDetails.swift;
        }

        gatewayPost("/users/" + user.mangopay_id + "/bankaccounts/" + postData.Type, postData, function(error, data) {
            var parsedData;
            if (error) {
                callback("Error registering bank details: " + error);
                return;
            }
            parsedData = JSON.parse(data);
            if (parsedData.Type === "param_error") {
                callback("Parameter error in registering bank details: " + data);
                return;
            }
            callback(null, parsedData.Id);
        });
    });
};

/**
 * Since MangoPay does not support cross currency transactions.
 */
createWalletsForUser = function(mangopay_id, currencies, callback) {
    var wallets = [],
        createWallet, i, callbackCount, errorCount, errorMsg, addWalletsToDB, walletCreatedCallback;

    if (currencies === null) {
        currencies = Localization.getSupportedCurrencies();
    }

    createWallet = function(mangopay_id, currency, callback) {
        var postData = {
            Owners: [mangopay_id],
            Description: "Sharingear user wallet.",
            Currency: currency
        };
        gatewayPost("/wallets", postData, function(error, data) {
            var parsedData;
            if (error) {
                console.log("Error creating wallet for user: " + error);
                return;
            }
            parsedData = JSON.parse(data);
            if (parsedData.errors) {
                console.log("Error creating wallet for user: " + data);
                return;
            }
            callback(null, parsedData);
        });
    };

    addWalletsToDB = function() {
        var sql = "INSERT INTO wallets(mangopay_id, wallet_id, currency) VALUES ",
            params = [],
            i;
        for (i = 0; i < wallets.length - 1; i++) {
            sql += "(?, ?, ?),";
            params.push(mangopay_id, wallets[i].id, wallets[i].currency);
        }
        sql += "(?, ?, ?)";
        params.push(mangopay_id, wallets[wallets.length - 1].id, wallets[wallets.length - 1].currency);
        db.query(sql, params, function(error) {
            if (error) {
                callback("Error adding created wallets to db: " + error);
                return;
            }
            callback(null);
        });
    };

    callbackCount = 0;
    errorCount = 0;
    walletCreatedCallback = function(error, wallet) {
        callbackCount++;
        if (error) {
            errorCount++;
            errorMsg = error;
            return;
        }
        wallets.push({
            id: wallet.Id,
            currency: wallet.Currency
        });

        if (callbackCount === currencies.length) {
            if (errorCount > 0) {
                callback("Error creating wallets for user: " + errorMsg);
            } else {
                addWalletsToDB();
            }
        }
    };

    for (i = 0; i < currencies.length; i++) {
        createWallet(mangopay_id, currencies[i], walletCreatedCallback);
    }
};

getWallets = function(mangopay_id, callback) {
    db.query("SELECT wallet_id, currency FROM wallets WHERE mangopay_id=?", [mangopay_id], function(error, rows) {
        if (error) {
            callback("Error selecting wallets: " + error);
            return;
        }
        callback(null, rows);
    });
};

getWalletForCurrency = function(mangopay_id, currency, callback) {
    console.log("mangopay_id: " + mangopay_id);
    console.log("currency: " + currency);
    db.query("SELECT wallet_id FROM wallets WHERE mangopay_id=? AND currency=? LIMIT 1", [mangopay_id, currency], function(error, rows) {
        if (error) {
            callback("Error selecting wallet: " + error);
            return;
        }
        if (rows.length <= 0) {
            callback("No wallets found for id " + mangopay_id + " and currency " + currency);
            return;
        }
        callback(null, rows[0].wallet_id);
    });
};

getUserWalletsForCurrency = function(mangoPayIDs, currency, callback) {
    var sql, i;
    if (mangoPayIDs.length <= 0) {
        callback(null, []);
        return;
    }
    sql = "SELECT wallet_id FROM wallets WHERE mangopay_id IN(";
    for (i = 0; i < mangoPayIDs.length - 1; i++) {
        sql += "?, ";
    }
    sql += "?) LIMIT " + mangoPayIDs.length + ";";
    db.query(sql, mangoPayIDs, function(error, rows) {
        if (error) {
            callback(error);
            return;
        }
        if (rows.length < mangoPayIDs.length) {
            callback("No wallets found for all provided mangopay IDs.");
            return;
        }
        callback(null, rows);
    });
};

getCardObject = function(mangopay_id, callback) {
    var postData = {
        UserId: mangopay_id,
        Currency: "DKK",
    };
    gatewayPost("/cardregistrations", postData, function(error, data) {
        var parsedData, cardObject;
        if (error) {
            callback("Error getting card registration object: " + error);
            return;
        }
        parsedData = JSON.parse(data);
        if (!parsedData.CardRegistrationURL || !parsedData.PreregistrationData || !parsedData.AccessKey) {
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

    price = parseInt(bookingData.owner_price, 10); //The transactions happen in the owner currency

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
            Currency: bookingData.owner_currency,
            Amount: amount * 100
        },
        SecureMode: "FORCE",
        SecureModeReturnURL: bookingData.returnURL
    };
    gatewayPost("/preauthorizations/card/direct", postData, function(error, data) {
        var parsedData;
        if (error) {
            callback("Error preauthorizing debit: " + error);
            return;
        }
        console.log(data);
        parsedData = JSON.parse(data);
        if (parsedData.Status === "FAILED") {
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
        if (error) {
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
    this.getWalletForCurrency(this.sg_user.mangopay_id, bookingData.owner_currency, function(error, wallet_id) {
        if (error) {
            callback("Error getting SG wallet: " + error);
            return;
        }

        //var postData, sellerFee, sellerFeeVAT, buyerFee, buyerFeeVAT, sellerVAT, amount;
        var price, buyerFee, amount, postData;

        price = parseInt(bookingData.owner_price, 10); //Transactions happen in owner currency

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
                Currency: bookingData.owner_currency,
                Amount: amount * 100
            },
            Fees: {
                Currency: bookingData.owner_currency,
                Amount: buyerFee * 100
            },
            CreditedWalletId: wallet_id,
            PreauthorizationId: bookingData.preauth_id
        };
        gatewayPost("/payins/PreAuthorized/direct", postData, function(error, data) {
            var parsedData;
            if (error) {
                callback("Error charging preauthorized booking: " + error);
                return;
            }
            parsedData = JSON.parse(data);
            if (parsedData.Status !== "SUCCEEDED") {
                console.log("chargePreAuthorization response: ");
                console.log(data);
                callback("Charging preauthorized booking failed.");
                return;
            }
            console.log("charged successfully");
            callback(null);
        });
    });
};

payOutSeller = function(seller, bookingData, callback) {
    var Payment = this;
    Payment.getWalletForCurrency(seller.mangopay_id, bookingData.owner_currency, function(error, seller_wallet_id) {
        if (error) {
            callback("Error selecting owner wallet: " + error);
            return;
        }

        Payment.getWalletForCurrency(Payment.sg_user.mangopay_id, bookingData.owner_currency, function(error, sg_wallet_id) {
            if (error) {
                callback("Error selecting SG wallet: " + error);
                return;
            }

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
                AuthorId: Payment.sg_user.mangopay_id,
                CreditedUserId: seller.mangopay_id,
                DebitedFunds: {
                    Amount: amount * 100,
                    Currency: bookingData.owner_currency
                },
                Fees: {
                    Amount: sellerFee * 100,
                    Currency: bookingData.owner_currency
                },
                DebitedWalletID: sg_wallet_id,
                CreditedWalletID: seller_wallet_id
            };

            gatewayPost("/transfers", postData, function(error, data) {
                var parsedData;
                if (error) {
                    callback("Error transfering between wallets: " + error);
                    return;
                }
                parsedData = JSON.parse(data);
                if (parsedData.Status !== "SUCCEEDED") {
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
                    DebitedWalletID: seller_wallet_id,
                    BankAccountId: seller.bank_id,
                    BankWireRef: "Sharingear rental"
                };
                gatewayPost("/payouts/bankwire", postData, function(error, data) {
                    var parsedData, startTime, endTime, paymentTime;
                    if (error) {
                        callback("Error wiring from wallet: " + error);
                        return;
                    }
                    parsedData = JSON.parse(data);
                    if (parsedData.Status !== "SUCCEEDED" && parsedData.Status !== "CREATED") {
                        callback("Error wiring from wallet: " + data);
                        return;
                    }
                    console.log("payout successful");
                    callback(null);

                    startTime = new Moment(bookingData.start_time, "YYYY-MM-DD HH:mm:ss");
                    endTime = new Moment(bookingData.end_time, "YYYY-MM-DD HH:mm:ss");
                    paymentTime = new Moment();

                    Notifications.send(Notifications.RECEIPT_OWNER, {
                        name: seller.name,
                        surname: seller.surname,
                        street: seller.street,
                        postal_code: seller.postal_code,
                        city: seller.city,
                        country: seller.country,
                        item_name: bookingData.item_name,
                        price: price,
                        fee: "-" + sellerFee,
                        total_price: price - sellerFee,
                        currency: bookingData.owner_currency,

                        //These are for later use       
                        payment_date: paymentTime.format("DD/MM/YYYY"),
                        payment_time: paymentTime.format("HH:mm"),

                        date_from: startTime.format("DD/MM/YYYY"),
                        time_from: startTime.format("HH:mm"),
                        date_to: endTime.format("DD/MM/YYYY"),
                        time_to: endTime.format("HH:mm")
                    }, seller.email);
                });
            });
        });
    });
};

getSGBalance = function(callback) {
    gatewayGet("/wallets/" + this.sg_user.wallet_id, function(error, data) {
        var parsedData;
        if (error) {
            callback("Error getting Sharingear wallet: " + error);
            return;
        }
        parsedData = JSON.parse(data);
        callback(null, parsedData.Balance);
    });
};

getSGTransactions = function(callback) {
    gatewayGet("/wallets/" + this.sg_user.wallet_id + "/transactions", function(error, data) {
        var parsedData;
        if (error) {
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
        if (error) {
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
        if (error) {
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
        if (error) {
            callback("Error getting token: " + error);
            return;
        }

        postData = JSON.stringify(data);

        //This is to send correct content length when dealing with unicode characters
        utf8overLoad = encodeURIComponent(postData).match(/%[89ABab]/g);
        if (utf8overLoad === null) {
            utf8overLoad = 0;
        } else {
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
            options, postData, request, utf8overLoad;
        if (error) {
            callback(error);
            return;
        }

        postData = JSON.stringify(data);

        //This is to send correct content length when dealing with unicode characters
        utf8overLoad = encodeURIComponent(postData).match(/%[89ABab]/g);
        if (utf8overLoad === null) {
            utf8overLoad = 0;
        } else {
            utf8overLoad = utf8overLoad.length;
        }

        options = {
            host: Config.MANGOPAY_SANDBOX_URL,
            port: 443,
            path: "/v2/" + Config.MANGOPAY_SANDBOX_CLIENTID + apiPath,
            method: "PUT",
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
            } catch (error) {
                callback("Error parsing token response: " + error);
                return;
            }
            if (data.access_token) {
                callback(null, data.access_token);
            } else {
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
            /*,
                    Statute: "",
                    ProofOfRegistration: "",
                    ShareholderDeclaration: "",
                    */
    };
    gatewayPost("/users/legal", postData, function(error, data) {
        var parsedData;
        if (error) {
            callback(error);
            return;
        }
        parsedData = JSON.parse(data);
        if (parsedData.Type === "param_error") {
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
        user, bankDetails;
    user = {
        mangopay_id: mangopay_id,
        name: "Mircea Gabriel",
        surname: "Eftemie",
        id: "sharingear",
        address: "Danneskiold-Samsøes Allé 41, 1, 1434 København K, Denmark"
    };
    bankDetails = {
        iban: iban,
        swift: swift
    };
    registerBankAccountForUser(user, bankDetails, function(error) {
        callback(error);
    });
};

module.exports = {
    loadPayment: loadPayment,
    createSGWallets: createSGWallets,
    getSGWalletForCurrency: getSGWalletForCurrency,

    updateUser: updateUser,
    registerBankAccountForUser: registerBankAccountForUser,
    createWalletsForUser: createWalletsForUser,
    getWallets: getWallets,
    getWalletForCurrency: getWalletForCurrency,
    getUserWalletsForCurrency: getUserWalletsForCurrency,
    getCardObject: getCardObject,

    preAuthorize: preAuthorize,
    getPreauthorizationStatus: getPreauthorizationStatus,
    chargePreAuthorization: chargePreAuthorization,
    payOutSeller: payOutSeller,

    getSGBalance: getSGBalance,
    getSGTransactions: getSGTransactions,
    getSGPreauthorization: getSGPreauthorization
};
