/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */
/*jslint node: true */
"use strict";

var Config, restify, fs, fb, Sec, User, Gear, GearAvailability, GearBooking, Vans, VanAvailability, VanBooking, Roadies, RoadieAvailability, RoadieBooking, Payment, Notifications, Localization, XChangeRates, SGDashboard,

    readFileSuccess,

    healthCheck,
    readLocalizationData,
    readContentClassification,

    createGear,
    readGearWithID,
    addImageToGear,
    generateFileName,
    readGearSearchResults,
    createUserSession,
    readUserWithID,
    updateUserWithID,
    updateUserBankDetails,
    readGearFromUserWithID,
    updateGearFromUserWithID,
    readGearAvailability,
    createGearAvailability,
    readGearRentalsFromUserWithID,
    readGearReservationsFromUserWithID,
    createGearBooking,
    readGearBooking,
    updateGearBooking,

    readVansFromUserWithID,
    createVansForUserWithID,
    addImageToVan,
    updateVansForUserWithID,
    createVanAvailability,
    readVanAvailability,
    readVan,
    readVanSearchResults,
    createVanBooking,
    readVanBooking,
    updateVanBooking,
    readVanRentalsFromUserWithID,
    readVanReservationsFromUserWithID,

    readRoadiesFromUserWithID,
    createRoadieForUserWithID,
    updateRoadieForUserWithID,
    createRoadieAvailability,
    readRoadieAvailability,
    readRoadie,
    readRoadieSearchResults,
    createRoadieBooking,
    readRoadieBooking,
    updateRoadieBooking,
    readRoadieRentalsFromUserWithID,
    readRoadieReservationsFromUserWithID,

    createCardObject,
    getExchangeRate,

    readSGBalance,
    readSGTransactions,
    readSGPreauthorization,
    wipeout,

    handleError,
    isAuthorized,

    key, certificate, server, secureServer;

Config = require("./config");
if (Config.isProduction() === true) {
    require("newrelic");
}

restify = require("restify");
fs = require("fs");
fb = require("./facebook");
Sec = require("./sec");
User = require("./user");
Gear = require("./gear");
GearAvailability = require("./gear_availability");
GearBooking = require("./gear_booking");
Vans = require("./vans");
VanAvailability = require("./van_availability");
VanBooking = require("./van_booking");
Roadies = require("./roadies");
RoadieAvailability = require("./roadie_availability");
RoadieBooking = require("./roadie_booking");
Payment = require("./payment");
Notifications = require("./notifications");
Localization = require("./localization");
XChangeRates = require("./xchangerates");
SGDashboard = require("./sgdashboard");

readFileSuccess = true;
try {
    key = fs.readFileSync("/home/chrishjorth/keys/server.key");
} catch (error) {
    console.error("Could not read key file");
    readFileSuccess = false;
}

try {
    certificate = fs.readFileSync("/home/chrishjorth/keys/server.pem");
} catch (error) {
    console.error("Could not read certificate file.");
    readFileSuccess = false;
}

if (readFileSuccess === false) {
    //This is so that we do not need to have keys and certificates installed for localhost development, or if files could not be loaded.
    secureServer = restify.createServer({
        name: "Sharingear API"
    });
} else {
    //We only run with https
    secureServer = restify.createServer({
        name: "Sharingear API",
        key: key,
        certificate: certificate
    });
}

process.on("uncaughtException", function(error) {
    console.error("Process uncaught exception: ");
    console.error(error.stack);
});

secureServer.on("uncaughtException", function(req, res, route, error) {
    console.error("secureServer uncaught exception: ");
    console.error(error.stack);
    res.send(error);
});

secureServer.use(restify.CORS());
secureServer.use(restify.fullResponse());
secureServer.use(restify.bodyParser());

server = restify.createServer({
    name: "Sharingear health check"
});

server.on("uncaughtException", function(req, res, route, error) {
	console.error("server uncaught exception: ");
    console.error(error.stack);
    res.send(error);
});

console.log("Initializing API...");
Localization.loadLocalization(function(error) {
    if (error) {
        console.error(error);
        return;
    }
    Payment.loadPayment(function(error) {
        if (error) {
            console.error(error);
            return;
        }
        //Tunnelblick uses 1337 apparently
        secureServer.listen(1338, function() {
            console.log("%s listening at %s", secureServer.name, secureServer.url);
        });
        server.listen(1339);
    });
});


//ROUTE HANDLERS

healthCheck = function(req, res, next) {
    res.send({});
    next();
};

readLocalizationData = function(req, res, next) {
    res.send(Localization.getLocalizationData());
    next();
};

readContentClassification = function(req, res, next) {
    Gear.getClassification(function(error, gearClassification) {
        var contentClassification;
        if (error) {
            handleError(res, next, "Error retrieving gear classification: ", error);
            return;
        }
        Vans.getClassification(function(error, vanClassification) {
            if (error) {
                handleError(res, next, "Error retrieving van classification: " + error);
                return;
            }
            Roadies.getClassification(function(error, roadieClassification) {
                if (error) {
                    handleError(res, next, "Error retrieving roadie classification: " + error);
                    return;
                }
                    User.getClassification(function(error, userClassification) {
                    if (error) {
                        handleError(res, next, "Error retrieving user classification: " + error);
                        return;
                    }
                    contentClassification = {
                        gearClassification: gearClassification.classification,
                        gearBrands: gearClassification.brands,
                        vanClassification: vanClassification,
                        roadieClassification: roadieClassification,
                        userClassification: userClassification
                    };
                    
                    res.send(contentClassification);
                    next();
                });
            });
        });
    });
};

createGear = function(req, res, next) {
    isAuthorized(req.params.owner_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Gear.createGear(req.params, function(error, gearID) {
            if (error) {
                handleError(res, next, "Error creating new gear: ", error);
                return;
            }
            res.send({
                id: gearID
            });
            next();
        });
    });
};

readGearWithID = function(req, res, next) {
    Gear.readGearWithID(req.params.id, function(error, gear) {
        if (error) {
            handleError(res, next, "Error retrieving gear: ", error);
            return;
        }
        res.send(gear);
        next();
    });
};

addImageToGear = function(req, res, next) {
    //Validate the image url
    var imageURL = req.params.image_url,
        validation;

    imageURL = imageURL.split("?")[0]; //Remove eventual query string parameters inserted by meddlers
    validation = imageURL.split("/");
    if (validation[2] !== Config.VALID_IMAGE_HOST) {
        handleError(res, next, "Error adding image to gear: ", "image url is from an invalid domain.");
        return;
    }

    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Gear.addImage(req.params.user_id, req.params.gear_id, imageURL, function(error, images) {
            if (error) {
                handleError(res, next, "Error authorizing user: ", error);
                return;
            }
            res.send({
                images: images
            });
            next();
        });
    });
};

generateFileName = function(req, res, next) {
    var params = req.params;

    isAuthorized(params.id, function(error, status) {
        var newFileName, dot, extension, secret;
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        dot = params.filename.lastIndexOf(".");
        extension = params.filename.substring(dot + 1);
        newFileName = params.filename.substring(0, dot);
        newFileName = Sec.generateFileName(newFileName) + "." + extension;
        secret = Sec.getFileSecretProof(newFileName);
        res.send({
            fileName: newFileName,
            secretProof: secret
        });
        next();
    });
};

readGearSearchResults = function(req, res, next) {
    Gear.search(req.params.location, req.params.gear, function(error, results) {
        if (error) {
            res.send([]);
            next();
            return;
        }
        res.send(results);
        next();
    });
};

/**
 * Switches the FB short token for a long token, if the user does not exist information is retrieved from Facebook and the user is created.
 * @param accesstoken: FB access token
 * @return The user object
 */
createUserSession = function(req, res, next) {
    var createSession;
    createSession = function(user, longToken) {
        User.setServerAccessToken(user.fbid, longToken, function(error) {
            if (error) {
                handleError(res, next, "Error setting Access Token: ", error);
                return;
            }
            console.log("Session created.");
            res.send(user);
            next();
        });
    };

    console.log("Create user session...");

    fb.getServerSideToken(req.params.accesstoken, function(error, longToken) {
        if (error) {
            handleError(res, next, "Error authenticating with facebook: ", error);
            return;
        }

        console.log("Got server side token:");
        console.log(longToken);

        //Get user for facebook id, if not exists create user
        User.getUserFromFacebookID(req.params.fbid, function(error, user) {
            if (error) {
                handleError(res, next, "Error retrieving user by Facebook ID: ", error);
                return;
            }

            if (user === null) {
                console.log("Create new user...");
                //Create user
                fb.getUserInfo(longToken, function(error, fbUserInfo) {
                    if (error) {
                        handleError(res, next, "Error retrieving user from Facebook: ", error);
                        return;
                    }

                    console.log("Got FB user info");
                    console.log(JSON.stringify(fbUserInfo));

                    User.createUserFromFacebookInfo(fbUserInfo, function(error, user) {
                        if (error) {
                            handleError(res, next, "Error creating user: ", error);
                            return;
                        }
                        console.log("New user created.");
                        user.new_user = true;
                        createSession(user, longToken);
                    });
                });
            } else {
                console.log("Create session for existing user...");
                user.new_user = false;
                createSession(user, longToken);
            }
        });
    });
};

readUserWithID = function(req, res, next) {
    isAuthorized(req.params.id, function(error, status) {
        var handleRead;
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        handleRead = function(error, user) {
            if (error) {
                handleError(res, next, "Error reading user: ", error);
                return;
            }
            res.send(user);
            next();
        };
        if (status === true) {
            User.readUser(req.params.id, handleRead);
        } else {
            User.readPublicUser(req.params.id, handleRead);
        }
    });
};

updateUserWithID = function(req, res, next) {
    isAuthorized(req.params.id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }

        User.update(req.params.id, req.params, function(error, updatedUser) {
            if (error) {
                handleError(res, next, "Error updating user: ", error);
                return;
            }
            res.send(updatedUser);
            next();
        });
    });
};

updateUserBankDetails = function(req, res, next) {
    isAuthorized(req.params.id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        User.updateBankDetails(req.params.id, req.params, function(error) {
            if (error) {
                handleError(res, next, "Error adding bank details: ", error);
                return;
            }
            res.send({});
            next();
        });
    });
};

readGearFromUserWithID = function(req, res, next) {
    Gear.readGearFromUser(req.params.user_id, function(error, gearList) {
        if (error) {
            handleError(res, next, "Error retrieving gear list: ", error);
            return;
        }
        res.send(gearList);
        next();
    });
};

/**
 * It is not possible to update type for existing gear.
 * @return the updated gear
 */
updateGearFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Gear.updateGearWithID(req.params.gear_id, req.params, function(error, updatedGearData) {
            if (error) {
                handleError(res, next, "Error updating gear: ", error);
                return;
            }
            res.send(updatedGearData);
            next();
        });
    });
};

readGearAvailability = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        GearAvailability.get(req.params.gear_id, function(error, availabilityArray) {
            if (error) {
                handleError(res, next, "Error getting gear availability: ", error);
                return;
            }
            Gear.getAlwaysFlag(req.params.gear_id, function(error, result) {
                if (error) {
                    handleError(res, next, "Error getting alwaysFlag: ", error);
                    return;
                }
                res.send({
                    availabilityArray: availabilityArray,
                    alwaysFlag: result.always_available
                });
                next();
            });
        });
    });
};

createGearAvailability = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        var availability;
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        availability = JSON.parse(req.params.availability);
        //Check that the user owns the gear
        Gear.checkOwner(req.params.user_id, req.params.gear_id, function(error, data) {
            if (error) {
                handleError(res, next, "Error checking gear ownership: ", error);
                return;
            }
            if (data === false) {
                handleError(res, next, "Error checking gear ownership: ", "User " + req.params.user_id + " does not own gear " + req.params.gear_id);
                return;
            }
            Gear.getAlwaysFlag(req.params.gear_id, function(error, result) {
                var setAvailability;
                if (error) {
                    handleError(res, next, "Error getting always flag: ", error);
                    return;
                }
                setAvailability = function() {
                    GearAvailability.set(req.params.gear_id, availability, function(error) {
                        if (error) {
                            handleError(res, next, "Error setting gear availability: ", error);
                            return;
                        }
                        res.send({});
                        next();
                    });
                };
                if (result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
                    Gear.setAlwaysFlag(req.params.gear_id, req.params.alwaysFlag, function(error) {
                        if (error) {
                            handleError(res, next, "Error setting always flag: ", error);
                            return;
                        }
                        setAvailability();
                    });
                } else {
                    setAvailability();
                }
            });
        });
    });
};

readGearRentalsFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        GearBooking.readRentalsForUser(req.params.user_id, function(error, rentals) {
            if (error) {
                handleError(res, next, "Error reading reservations for user: ", error);
                return;
            }
            res.send(rentals);
            next();
        });
    });
};

readGearReservationsFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        GearBooking.readReservationsForUser(req.params.user_id, function(error, reservations) {
            if (error) {
                handleError(res, next, "Error reading reservations for user: ", error);
                return;
            }
            res.send(reservations);
            next();
        });
    });
};

createGearBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        GearBooking.create(req.params.user_id, req.params, function(error, booking) {
            if (error) {
                handleError(res, next, "Error creating booking: ", error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

readGearBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        GearBooking.read(req.params.booking_id, function(error, booking) {
            if (error) {
                handleError(res, next, "Error reading booking: ", error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

updateGearBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        GearBooking.update(req.params, function(error) {
            if (error) {
                handleError(res, next, "Error updating booking: ", error);
                return;
            }
            res.send({});
            next();
        });
    });
};

readVansFromUserWithID = function(req, res, next) {
    Vans.readVansFromUser(req.params.user_id, function(error, vans) {
        if (error) {
            handleError(res, next, "Error reading vans for user: " + error);
            return;
        }
        res.send(vans);
        next();
    });
};

createVansForUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Vans.createVans(req.params.user_id, req.params, function(error, van) {
            if (error) {
                handleError(res, next, "Error creating van: ", error);
                return;
            }
            res.send(van);
            next();
        });
    });
};

addImageToVan = function(req, res, next) {
    //Validate the image url
    var imageURL = req.params.image_url,
        validation;

    imageURL = imageURL.split("?")[0]; //Remove eventual query string parameters inserted by meddlers
    validation = imageURL.split("/");
    if (validation[2] !== Config.VALID_IMAGE_HOST) {
        handleError(res, next, "Error adding image to van: ", "image url is from an invalid domain.");
        return;
    }

    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Vans.addImage(req.params.user_id, req.params.van_id, imageURL, function(error, images) {
            if (error) {
                handleError(res, next, "Error authorizing user: ", error);
                return;
            }
            res.send({
                images: images
            });
            next();
        });
    });
};

updateVansForUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Vans.updateVanWithID(req.params.user_id, req.params.van_id, req.params, function(error, updatedVan) {
            if (error) {
                handleError(res, next, "Error updating van: ", error);
                return;
            }
            res.send(updatedVan);
            next();
        });
    });
};

createVanAvailability = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        var availability;
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        availability = JSON.parse(req.params.availability);
        //Check that the user owns the gear
        Vans.checkOwner(req.params.user_id, req.params.van_id, function(error, data) {
            if (error) {
                handleError(res, next, "Error checking van ownership: ", error);
                return;
            }
            if (data === false) {
                handleError(res, next, "Error checking van ownership: ", "User " + req.params.user_id + " does not own van " + req.params.van_id);
                return;
            }
            Vans.getAlwaysFlag(req.params.van_id, function(error, result) {
                var setAvailability;
                if (error) {
                    handleError(res, next, "Error getting always flag: ", error);
                    return;
                }
                setAvailability = function() {
                    VanAvailability.set(req.params.van_id, availability, function(error) {
                        if (error) {
                            handleError(res, next, "Error setting van availability: ", error);
                            return;
                        }
                        res.send({});
                        next();
                    });
                };
                if (result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
                    Vans.setAlwaysFlag(req.params.van_id, req.params.alwaysFlag, function(error) {
                        if (error) {
                            handleError(res, next, "Error setting always flag: ", error);
                            return;
                        }
                        setAvailability();
                    });
                } else {
                    setAvailability();
                }
            });
        });
    });
};

readVanAvailability = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        VanAvailability.get(req.params.van_id, function(error, availabilityArray) {
            if (error) {
                handleError(res, next, "Error getting van availability: ", error);
                return;
            }
            Vans.getAlwaysFlag(req.params.van_id, function(error, result) {
                if (error) {
                    handleError(res, next, "Error getting alwaysFlag: ", error);
                    return;
                }
                res.send({
                    availabilityArray: availabilityArray,
                    alwaysFlag: result.always_available
                });
                next();
            });
        });
    });
};

readVan = function(req, res, next) {
    Vans.readVanWithID(req.params.van_id, function(error, van) {
        if (error) {
            handleError(res, next, "Error retrieving van: ", error);
            return;
        }
        res.send(van);
        next();
    });
};

readVanSearchResults = function(req, res, next) {
    Vans.search(req.params.location, req.params.van, function(error, results) {
        if (error) {
            res.send([]);
            next();
            return;
        }
        res.send(results);
        next();
    });
};

createVanBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        VanBooking.create(req.params.user_id, req.params, function(error, booking) {
            if (error) {
                handleError(res, next, "Error creating booking: ", error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

readVanBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        VanBooking.read(req.params.booking_id, function(error, booking) {
            if (error) {
                handleError(res, next, "Error reading booking: ", error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

updateVanBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        VanBooking.update(req.params, function(error) {
            if (error) {
                handleError(res, next, "Error updating booking: ", error);
                return;
            }
            res.send({});
            next();
        });
    });
};

readVanRentalsFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        VanBooking.readRentalsForUser(req.params.user_id, function(error, rentals) {
            if (error) {
                handleError(res, next, "Error reading reservations for user: ", error);
                return;
            }
            res.send(rentals);
            next();
        });
    });
};

readVanReservationsFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        VanBooking.readReservationsForUser(req.params.user_id, function(error, reservations) {
            if (error) {
                handleError(res, next, "Error reading reservations for user: ", error);
                return;
            }
            res.send(reservations);
            next();
        });
    });
};

readRoadiesFromUserWithID = function(req, res, next) {
    Roadies.readRoadiesFromUser(req.params.user_id, function(error, roadies) {
        if (error) {
            handleError(res, next, "Error reading roadies for user: " + error);
            return;
        }
        res.send(roadies);
        next();
    });
};

createRoadieForUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Roadies.createRoadie(req.params.user_id, req.params, function(error, van) {
            if (error) {
                handleError(res, next, "Error creating roadie: ", error);
                return;
            }
            res.send(van);
            next();
        });
    });
};

updateRoadieForUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        Roadies.updateRoadieWithID(req.params.user_id, req.params.roadie_id, req.params, function(error, updatedVan) {
            if (error) {
                handleError(res, next, "Error updating roadie: ", error);
                return;
            }
            res.send(updatedVan);
            next();
        });
    });
};

createRoadieAvailability = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        var availability;
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        availability = JSON.parse(req.params.availability);
        //Check that the user owns the gear
        Roadies.checkOwner(req.params.user_id, req.params.roadie_id, function(error, data) {
            if (error) {
                handleError(res, next, "Error checking roadie ownership: ", error);
                return;
            }
            if (data === false) {
                handleError(res, next, "Error checking roadie ownership: ", "User " + req.params.user_id + " does not own roadie profile " + req.params.roadie_id);
                return;
            }
            Roadies.getAlwaysFlag(req.params.roadie_id, function(error, result) {
                var setAvailability;
                if (error) {
                    handleError(res, next, "Error getting always flag: ", error);
                    return;
                }
                setAvailability = function() {
                    RoadieAvailability.set(req.params.roadie_id, availability, function(error) {
                        if (error) {
                            handleError(res, next, "Error setting roadie availability: ", error);
                            return;
                        }
                        res.send({});
                        next();
                    });
                };
                if (result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
                    Roadies.setAlwaysFlag(req.params.roadie_id, req.params.alwaysFlag, function(error) {
                        if (error) {
                            handleError(res, next, "Error setting always flag: ", error);
                            return;
                        }
                        setAvailability();
                    });
                } else {
                    setAvailability();
                }
            });
        });
    });
};

readRoadieAvailability = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        RoadieAvailability.get(req.params.roadie_id, function(error, availabilityArray) {
            if (error) {
                handleError(res, next, "Error getting roadie availability: ", error);
                return;
            }
            Roadies.getAlwaysFlag(req.params.roadie_id, function(error, result) {
                if (error) {
                    handleError(res, next, "Error getting alwaysFlag: ", error);
                    return;
                }
                res.send({
                    availabilityArray: availabilityArray,
                    alwaysFlag: result.always_available
                });
                next();
            });
        });
    });
};

readRoadie = function(req, res, next) {
    Roadies.readRoadieWithID(req.params.roadie_id, function(error, roadie) {
        if (error) {
            handleError(res, next, "Error retrieving roadie: ", error);
            return;
        }

        Roadies.readRoadiesFromUser(roadie.owner_id, function(error, roadies) {
            if (error) {
                handleError(res, next, "Error retrieving roadies: ", error);
                return;
            }

            //We are excluding the current roadie from the list here, so that it's not shown on the same page
            roadie.techprofilelist = [];
            roadies.forEach(function(entry) {
                if (entry.id !== roadie.id) {
                    roadie.techprofilelist.push({
                        id: entry.id,
                        roadie_type: entry.roadie_type
                    });
                }
            });
            res.send(roadie);
            next();
        });

    });
};

readRoadieSearchResults = function(req, res, next) {
    Roadies.search(req.params.location, req.params.roadie, function(error, results) {
        if (error) {
            res.send([]);
            next();
            return;
        }
        res.send(results);
        next();
    });
};

createRoadieBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        RoadieBooking.create(req.params.user_id, req.params, function(error, booking) {
            if (error) {
                handleError(res, next, "Error creating booking: ", error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

readRoadieBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        RoadieBooking.read(req.params.booking_id, function(error, booking) {
            if (error) {
                handleError(res, next, "Error reading booking: ", error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

updateRoadieBooking = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        RoadieBooking.update(req.params, function(error) {
            if (error) {
                handleError(res, next, "Error updating booking: ", error);
                return;
            }
            res.send({});
            next();
        });
    });
};

readRoadieRentalsFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        RoadieBooking.readRentalsForUser(req.params.user_id, function(error, rentals) {
            if (error) {
                handleError(res, next, "Error reading rentals for user: ", error);
                return;
            }
            res.send(rentals);
            next();
        });
    });
};

readRoadieReservationsFromUserWithID = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        RoadieBooking.readReservationsForUser(req.params.user_id, function(error, reservations) {
            if (error) {
                handleError(res, next, "Error reading reservations for user: ", error);
                return;
            }
            res.send(reservations);
            next();
        });
    });
};

createCardObject = function(req, res, next) {
    isAuthorized(req.params.user_id, function(error, status) {
        if (error) {
            handleError(res, next, "Error authorizing user: ", error);
            return;
        }
        if (status === false) {
            handleError(res, next, "Error authorizing user: ", "User is not authorized.");
            return;
        }
        User.getCardObject(req.params.user_id, function(error, cardObject) {
            if (error) {
                handleError(res, next, "Error getting card object: ", error);
                return;
            }
            res.send(cardObject);
            next();
        });
    });
};

getExchangeRate = function(req, res, next) {
    XChangeRates.getRate(req.params.from_currency, req.params.to_currency, function(error, rate) {
        if (error) {
            handleError(res, next, "Error getting exchange rate: ", error);
            return;
        }
        res.send({
            rate: rate
        });
        next();
    });
};

readSGBalance = function(req, res, next) {
    if (req.params.user_id === "1" || req.params.user_id === "2") {
        isAuthorized(req.params.user_id, function(error, status) {
            if (error) {
                handleError(res, next, "Error authorizing user: ", error);
                return;
            }
            if (status === false) {
                handleError(res, next, "Error authorizing user: ", "User is not authorized.");
                return;
            }
            Payment.getSGBalance(function(error, balance) {
                if (error) {
                    handleError(res, next, "Error retrieving Sharingear balance: ", error);
                    return;
                }
                res.send({
                    balance: balance
                });
                next();
            });
        });
    } else {
        handleError(res, next, "Error authorizing user: ", "User id is not authorized.");
    }
};

readSGTransactions = function(req, res, next) {
    if (req.params.user_id === "1" || req.params.user_id === "2") {
        isAuthorized(req.params.user_id, function(error, status) {
            if (error) {
                handleError(res, next, "Error authorizing user: ", error);
                return;
            }
            if (status === false) {
                handleError(res, next, "Error authorizing user: ", "User is not authorized.");
                return;
            }
            Payment.getSGTransactions(function(error, transactions) {
                if (error) {
                    handleError(res, next, "Error retrieving Sharingear transactions: ", error);
                    return;
                }
                res.send(transactions);
                next();
            });
        });
    } else {
        handleError(res, next, "Error authorizing user: ", "User id is not authorized.");
    }
};

readSGPreauthorization = function(req, res, next) {
    if (req.params.user_id === "1" || req.params.user_id === "2") {
        isAuthorized(req.params.user_id, function(error, status) {
            if (error) {
                handleError(res, next, "Error authorizing user: ", error);
                return;
            }
            if (status === false) {
                handleError(res, next, "Error authorizing user: ", "User is not authorized.");
                return;
            }
            Payment.getSGPreauthorization(req.params.preauth_id, function(error, preauthorization) {
                if (error) {
                    handleError(res, next, "Error retrieving Sharingear preauthorization: ", error);
                    return;
                }
                res.send(preauthorization);
                next();
            });
        });
    } else {
        handleError(res, next, "Error authorizing user: ", "User id is not authorized.");
    }
};

wipeout = function(req, res, next) {
    if (req.params.user_id === "1") {
        isAuthorized(req.params.user_id, function(error, status) {
            if (error) {
                handleError(res, next, "Error authorizing user: ", error);
                return;
            }
            if (status === false) {
                handleError(res, next, "Error authorizing user: ", "User is not authorized.");
                return;
            }
            SGDashboard.wipeout(function(error) {
                if (error) {
                    handleError(res, next, "Error performing wipeout: ", error);
                    return;
                }
                console.log("Database wiped out successfully.");
                res.send({});
                next();
            });
        });
    } else {
        handleError(res, next, "Error authorizing user: ", "User id is not allowed in SG dashboard.");
    }
};

/* UTILITIES */
handleError = function(res, next, message, error) {
    console.error(message + JSON.stringify(error));
    res.send({
        error: error
    });
    next();
};

isAuthorized = function(userID, callback) {
    User.getToken(userID, function(error, token) {
        if (error) {
            callback(error);
            return;
        }
        fb.checkToken(token, function(error, tokenStatus) {
            if (error) {
                callback(error);
                return;
            }
            if (tokenStatus !== "valid") {
                callback(null, false);
            } else {
                callback(null, true);
            }
        });
    });
    /*fb.checkToken(fbLongToken, function(error, tokenStatus) {
		if(error) {
			callback(error);
			return;
		}
		if(tokenStatus !== "valid") {
			callback("Error checking token: Token not valid.");
			return;
		}
		User.matchToken(userID, fbLongToken, function(error, didMatch) {
			if(error) {
				callback(error);
				return;
			}
			callback(null, didMatch);
		});
	});*/
};

//ROUTES
server.get("/", healthCheck);

//405 debug
server.on("MethodNotAllowed", function(req, res) {
    console.error("---- Method " + req.method + " on URI " + req.url + " not allowed in standard server");
    return res.send(new restify.MethodNotAllowedError());
});

secureServer.on("MethodNotAllowed", function(req, res) {
    console.error("---- Method " + req.method + " on URI " + req.url + " not allowed in secure server");
    return res.send(new restify.MethodNotAllowedError());
});

secureServer.get("/localization", readLocalizationData);
secureServer.get("/contentclassification", readContentClassification);

secureServer.post("/gear", createGear);
secureServer.get("/gear/:id", readGearWithID);
secureServer.post("/gear/image", addImageToGear);
secureServer.get("/gear/search/:location/:gear/:daterange", readGearSearchResults);

secureServer.post("/users/login", createUserSession);
secureServer.get("/users/:id", readUserWithID);
secureServer.put("/users/:id", updateUserWithID);
secureServer.put("/users/:id/bankdetails", updateUserBankDetails);
secureServer.get("/users/:id/newfilename/:filename", generateFileName);

secureServer.get("/users/:user_id/gear", readGearFromUserWithID);
secureServer.put("/users/:user_id/gear/:gear_id", updateGearFromUserWithID);
secureServer.post("/users/:user_id/gear/:gear_id/availability", createGearAvailability);
secureServer.get("/users/:user_id/gear/:gear_id/availability", readGearAvailability);
secureServer.get("/users/:user_id/gearrentals", readGearRentalsFromUserWithID);
secureServer.get("/users/:user_id/gearreservations", readGearReservationsFromUserWithID);
secureServer.post("/users/:user_id/gear/:gear_id/bookings", createGearBooking);
secureServer.get("/users/:user_id/gear/:gear_id/bookings/:booking_id", readGearBooking);
secureServer.put("/users/:user_id/gear/:gear_id/bookings/:booking_id", updateGearBooking);

secureServer.get("/users/:user_id/vans", readVansFromUserWithID);
secureServer.post("/users/:user_id/vans", createVansForUserWithID);
secureServer.post("/users/:user_id/vans/:van_id/image", addImageToVan);
secureServer.put("/users/:user_id/vans/:van_id", updateVansForUserWithID);
secureServer.post("/users/:user_id/vans/:van_id/availability", createVanAvailability);
secureServer.get("/users/:user_id/vans/:van_id/availability", readVanAvailability);
secureServer.get("/vans/:van_id", readVan);
secureServer.get("/vans/search/:location/:van/:daterange", readVanSearchResults);
secureServer.post("/users/:user_id/vans/:van_id/bookings", createVanBooking);
secureServer.get("/users/:user_id/vans/:van_id/bookings/:booking_id", readVanBooking);
secureServer.put("/users/:user_id/vans/:van_id/bookings/:booking_id", updateVanBooking);
secureServer.get("/users/:user_id/vanrentals", readVanRentalsFromUserWithID);
secureServer.get("/users/:user_id/vanreservations", readVanReservationsFromUserWithID);

secureServer.get("/users/:user_id/roadies", readRoadiesFromUserWithID);
secureServer.post("/users/:user_id/roadies", createRoadieForUserWithID);
secureServer.put("/users/:user_id/roadies/:roadie_id", updateRoadieForUserWithID);
secureServer.post("/users/:user_id/roadies/:roadie_id/availability", createRoadieAvailability);
secureServer.get("/users/:user_id/roadies/:roadie_id/availability", readRoadieAvailability);
secureServer.get("/roadies/:roadie_id", readRoadie);
secureServer.get("/roadies/search/:location/:roadie/:daterange", readRoadieSearchResults);
secureServer.post("/users/:user_id/roadies/:roadie_id/bookings", createRoadieBooking);
secureServer.get("/users/:user_id/roadies/:roadie_id/bookings/:booking_id", readRoadieBooking);
secureServer.put("/users/:user_id/roadies/:roadie_id/bookings/:booking_id", updateRoadieBooking);
secureServer.get("/users/:user_id/roadierentals", readRoadieRentalsFromUserWithID);
secureServer.get("/users/:user_id/roadiereservations", readRoadieReservationsFromUserWithID);

secureServer.get("/users/:user_id/cardobject", createCardObject);

secureServer.get("/exchangerates/:from_currency/:to_currency", getExchangeRate);

secureServer.get("/users/:user_id/dashboard/balance", readSGBalance);
secureServer.get("/users/:user_id/dashboard/transactions", readSGTransactions);
secureServer.get("/users/:user_id/dashboard/payments/preauthorization/:preauth_id", readSGPreauthorization);
secureServer.get("/users/:user_id/dashboard/wipeout", wipeout);


module.exports = {
    server: server,
    secureServer: secureServer,

    wipeout: wipeout
};
