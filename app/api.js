/**
 * Entry point for the node.js based API of Sharingear.
 * @author: Chris Hjorth
 */
/*jslint node: true */
"use strict";

var ERR_AUTH = 101,
    ERR_RUN = 102,
    Config, restify, fs, fb, Sec, User, Gear, GearAvailability, GearBooking, Vans, VanAvailability, VanBooking, Roadies, RoadieAvailability, RoadieBooking, Payment, Notifications, Localization, XChangeRates, SGDashboard,

    readFileSuccess,

    healthCheck,
    readLocalizationData,
    readContentClassification,

    createGear,
    getGear,
    getGearImages,
    readGearWithID,
    addImageToGear,
    generateFileName,
    readGearSearchResults,
    createUserSession,
    logoutUserWithID,
    getUsers,
    readUserWithID,
    readPublicUserWithID,
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
    getVans,
    getVansImages,
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
    getRoadies,
    getRoadiesImages,
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
            handleError(res, next, ERR_RUN, "Error retrieving gear classification: " + error);
            return;
        }
        Vans.getClassification(function(error, vanClassification) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error retrieving van classification: " + error);
                return;
            }
            Roadies.getClassification(function(error, roadieClassification) {
                if (error) {
                    handleError(res, next, ERR_RUN, "Error retrieving roadie classification: " + error);
                    return;
                }
                User.getClassification(function(error, userClassification) {
                    if (error) {
                        handleError(res, next, ERR_RUN, "Error retrieving user classification: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        if (req.params.owner_id !== userID) {
            handleError(res, next, ERR_RUN, "Error creating gear: The owner of the gear is not the currently logged in user.");
            return;
        }
        Gear.createGear(req.params, function(error, gearID) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error creating new gear: " + error);
                return;
            }
            res.send({
                id: gearID
            });
            next();
        });
    });
};

getGear = function(req, res, next) {
    Gear.getGear(function(error, gear) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting gear: " + error);
            return;
        }
        res.send(gear);
        next();
    });
};

getGearImages = function(req, res, next) {
    Gear.getGearImages(function(error, gearImages) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting gear images: " + error);
            return;
        }
        res.send(gearImages);
        next();
    });
};

readGearWithID = function(req, res, next) {
    Gear.readGearWithID(req.params.id, function(error, gear) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error retrieving gear: " + error);
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
        handleError(res, next, ERR_RUN, "Error adding image to gear: image url is from an invalid domain.");
        return;
    }

    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }

        Gear.addImage(userID, req.params.gear_id, imageURL, function(error, images) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
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
    //We require authentication for this to avoid meddling and resource hogging
    isAuthorized(req, function(error, userID) {
        var newFileName, dot, extension, secret;
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
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
        user.token = Sec.signJWT({
            user_id: user.id,
            name: user.name,
            surname: user.surname
        });
        User.setServerAccessToken(user.fbid, longToken, function(error) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error setting Access Token: " + error);
                return;
            }
            res.send(user);
            next();
        });
    };

    fb.getServerSideToken(req.params.accesstoken, function(error, longToken) {
        if (error) {
            handleError(res, next, ERR_AUTH, "Error authenticating with facebook: " + error);
            return;
        }

        //Get user for facebook id, if not exists create user
        User.getUserFromFacebookID(req.params.fbid, function(error, user) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error retrieving user by Facebook ID: " + error);
                return;
            }

            if (user === null) {
                //Create user
                fb.getUserInfo(longToken, function(error, fbUserInfo) {
                    if (error) {
                        handleError(res, next, ERR_RUN, "Error retrieving user from Facebook: " + error);
                        return;
                    }

                    User.createUserFromFacebookInfo(fbUserInfo, function(error, user) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error creating user: " + error);
                            return;
                        }
                        user.new_user = true;
                        createSession(user, longToken);
                    });
                });
            } else {
                user.new_user = false;
                createSession(user, longToken);
            }
        });
    });
};

logoutUserWithID = function(req, res, next) {

};

getUsers = function(req, res, next) {
    User.getUsers(function(error, users) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting users: " + error);
            return;
        }
        res.send(users);
        next();
    });
};

readUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        User.readUser(userID, function(error, user) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading user: " + error);
                return;
            }
            res.send(user);
            next();
        });
    });
};

readPublicUserWithID = function(req, res, next) {
    User.readPublicUser(req.params.id, function(error, user) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error reading user: " + error);
            return;
        }
        res.send(user);
        next();
    });
};

updateUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        User.update(userID, req.params, function(error, updatedUser) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating user: " + error);
                return;
            }
            res.send(updatedUser);
            next();
        });
    });
};

updateUserBankDetails = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        User.updateBankDetails(userID, req.params, function(error) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error adding bank details: " + error);
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
            handleError(res, next, ERR_RUN, "Error retrieving gear list: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        Gear.updateGearWithID(userID, req.params.gear_id, req.params, function(error, updatedGearData) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating gear: " + error);
                return;
            }
            res.send(updatedGearData);
            next();
        });
    });
};

readGearAvailability = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        GearAvailability.get(req.params.gear_id, function(error, availabilityArray) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error getting gear availability: " + error);
                return;
            }
            Gear.getAlwaysFlag(req.params.gear_id, function(error, result) {
                if (error) {
                    handleError(res, next, ERR_RUN, "Error getting alwaysFlag: " + error);
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
    isAuthorized(req, function(error, userID) {
        var availability;
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        availability = JSON.parse(req.params.availability);
        //Check that the user owns the gear
        Gear.checkOwner(userID, req.params.gear_id, function(error, data) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error checking gear ownership: " + error);
                return;
            }
            if (data === false) {
                handleError(res, next, ERR_RUN, "Error checking gear ownership: User " + userID + " does not own gear " + req.params.gear_id);
                return;
            }
            Gear.getAlwaysFlag(req.params.gear_id, function(error, result) {
                var setAvailability;
                if (error) {
                    handleError(res, next, ERR_RUN, "Error getting always flag: " + error);
                    return;
                }
                setAvailability = function() {
                    GearAvailability.set(req.params.gear_id, availability, function(error) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error setting gear availability: " + error);
                            return;
                        }
                        res.send({});
                        next();
                    });
                };
                if (result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
                    Gear.setAlwaysFlag(req.params.gear_id, req.params.alwaysFlag, function(error) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error setting always flag: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        GearBooking.readRentalsForUser(userID, function(error, rentals) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading reservations for user: " + error);
                return;
            }
            res.send(rentals);
            next();
        });
    });
};

readGearReservationsFromUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        GearBooking.readReservationsForUser(userID, function(error, reservations) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading reservations for user: " + error);
                return;
            }
            res.send(reservations);
            next();
        });
    });
};

createGearBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        GearBooking.create(userID, req.params, function(error, booking) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error creating booking: " + error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

readGearBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        GearBooking.read(req.params.booking_id, function(error, booking) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading booking: " + error);
                return;
            }
            if (booking.owner_id !== userID && booking.renter_id !== userID) {
                handleError(res, next, ERR_RUN, "Error reading booking: The user trying to read is neither owner nor renter.");
                return;
            }
            res.send(booking);
            next();
        });
    });
};

updateGearBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === false) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        GearBooking.update(userID, req.params, function(error) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating booking: " + error);
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
            handleError(res, next, ERR_RUN, "Error reading vans for user: " + error);
            return;
        }
        res.send(vans);
        next();
    });
};

createVansForUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === false) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        Vans.createVans(userID, req.params, function(error, van) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error creating van: " + error);
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
        handleError(res, next, ERR_RUN, "Error adding image to van: image url is from an invalid domain.");
        return;
    }

    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        Vans.addImage(userID, req.params.van_id, imageURL, function(error, images) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        Vans.updateVanWithID(userID, req.params.van_id, req.params, function(error, updatedVan) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating van: " + error);
                return;
            }
            res.send(updatedVan);
            next();
        });
    });
};

createVanAvailability = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        var availability;
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        availability = JSON.parse(req.params.availability);
        //Check that the user owns the gear
        Vans.checkOwner(userID, req.params.van_id, function(error, data) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error checking van ownership: " + error);
                return;
            }
            if (data === false) {
                handleError(res, next, ERR_RUN, "Error checking van ownership: User " + userID + " does not own van " + req.params.van_id);
                return;
            }
            Vans.getAlwaysFlag(req.params.van_id, function(error, result) {
                var setAvailability;
                if (error) {
                    handleError(res, next, ERR_RUN, "Error getting always flag: " + error);
                    return;
                }
                setAvailability = function() {
                    VanAvailability.set(req.params.van_id, availability, function(error) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error setting van availability: " + error);
                            return;
                        }
                        res.send({});
                        next();
                    });
                };
                if (result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
                    Vans.setAlwaysFlag(req.params.van_id, req.params.alwaysFlag, function(error) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error setting always flag: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        VanAvailability.get(req.params.van_id, function(error, availabilityArray) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error getting van availability: " + error);
                return;
            }
            Vans.getAlwaysFlag(req.params.van_id, function(error, result) {
                if (error) {
                    handleError(res, next, ERR_RUN, "Error getting alwaysFlag: " + error);
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

getVans = function(req, res, next) {
    Vans.getVans(function(error, vans) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting vans: " + error);
            return;
        }
        res.send(vans);
        next();
    });
};

getVansImages = function(req, res, next) {
    Vans.getVansImages(function(error, vansImages) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting vans images: " + error);
            return;
        }
        res.send(vansImages);
        next();
    });
};

readVan = function(req, res, next) {
    Vans.readVanWithID(req.params.van_id, function(error, van) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error retrieving van: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        VanBooking.create(userID, req.params, function(error, booking) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error creating booking: " + error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

readVanBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        VanBooking.read(req.params.booking_id, function(error, booking) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading booking: " + error);
                return;
            }
            if (booking.owner_id !== userID && booking.renter_id !== userID) {
                handleError(res, next, ERR_RUN, "Error reading booking: User is neither owner nor renter.");
                return;
            }
            res.send(booking);
            next();
        });
    });
};

updateVanBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        VanBooking.update(userID, req.params, function(error) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating booking: " + error);
                return;
            }
            res.send({});
            next();
        });
    });
};

readVanRentalsFromUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        VanBooking.readRentalsForUser(userID, function(error, rentals) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading reservations for user: " + error);
                return;
            }
            res.send(rentals);
            next();
        });
    });
};

readVanReservationsFromUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        VanBooking.readReservationsForUser(userID, function(error, reservations) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading reservations for user: " + error);
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
            handleError(res, next, ERR_RUN, "Error reading roadies for user: " + error);
            return;
        }
        res.send(roadies);
        next();
    });
};

createRoadieForUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        Roadies.createRoadie(userID, req.params, function(error, van) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error creating roadie: " + error);
                return;
            }
            res.send(van);
            next();
        });
    });
};

updateRoadieForUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        Roadies.updateRoadieWithID(userID, req.params.roadie_id, req.params, function(error, updatedVan) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating roadie: " + error);
                return;
            }
            res.send(updatedVan);
            next();
        });
    });
};

createRoadieAvailability = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        var availability;
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        availability = JSON.parse(req.params.availability);
        //Check that the user owns the gear
        Roadies.checkOwner(userID, req.params.roadie_id, function(error, data) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error checking roadie ownership: " + error);
                return;
            }
            if (data === false) {
                handleError(res, next, ERR_RUN, "Error checking roadie ownership: User " + userID + " does not own roadie profile " + req.params.roadie_id);
                return;
            }
            Roadies.getAlwaysFlag(req.params.roadie_id, function(error, result) {
                var setAvailability;
                if (error) {
                    handleError(res, next, ERR_RUN, "Error getting always flag: " + error);
                    return;
                }
                setAvailability = function() {
                    RoadieAvailability.set(req.params.roadie_id, availability, function(error) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error setting roadie availability: " + error);
                            return;
                        }
                        res.send({});
                        next();
                    });
                };
                if (result.always_available != req.params.alwaysFlag) { //if flag changed and availability is empty, set it
                    Roadies.setAlwaysFlag(req.params.roadie_id, req.params.alwaysFlag, function(error) {
                        if (error) {
                            handleError(res, next, ERR_RUN, "Error setting always flag: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        RoadieAvailability.get(req.params.roadie_id, function(error, availabilityArray) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error getting roadie availability: " + error);
                return;
            }
            Roadies.getAlwaysFlag(req.params.roadie_id, function(error, result) {
                if (error) {
                    handleError(res, next, ERR_RUN, "Error getting alwaysFlag: " + error);
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

getRoadies = function(req, res, next) {
    Roadies.getRoadies(function(error, roadies) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting roadies: " + error);
            return;
        }
        res.send(roadies);
        next();
    });
};

getRoadiesImages = function(req, res, next) {
    Roadies.getRoadiesImages(function(error, roadiesImages) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error getting roadies images: " + error);
            return;
        }
        res.send(roadiesImages);
        next();
    });
};

readRoadie = function(req, res, next) {
    Roadies.readRoadieWithID(req.params.roadie_id, function(error, roadie) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error retrieving roadie: " + error);
            return;
        }

        Roadies.readRoadiesFromUser(roadie.owner_id, function(error, roadies) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error retrieving roadies: " + error);
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
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        RoadieBooking.create(userID, req.params, function(error, booking) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error creating booking: " + error);
                return;
            }
            res.send(booking);
            next();
        });
    });
};

readRoadieBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        RoadieBooking.read(req.params.booking_id, function(error, booking) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading booking: " + error);
                return;
            }
            if (userID !== booking.owner_id && userID !== booking.renter_id) {
                handleError(res, next, ERR_RUN, "Error reading booking: User is neither owner nor renter.");
                return;
            }
            res.send(booking);
            next();
        });
    });
};

updateRoadieBooking = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        RoadieBooking.update(userID, req.params, function(error) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error updating booking: " + error);
                return;
            }
            res.send({});
            next();
        });
    });
};

readRoadieRentalsFromUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        RoadieBooking.readRentalsForUser(userID, function(error, rentals) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading rentals for user: " + error);
                return;
            }
            res.send(rentals);
            next();
        });
    });
};

readRoadieReservationsFromUserWithID = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        RoadieBooking.readReservationsForUser(userID, function(error, reservations) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error reading reservations for user: " + error);
                return;
            }
            res.send(reservations);
            next();
        });
    });
};

createCardObject = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        User.getCardObject(userID, function(error, cardObject) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error getting card object: " + error);
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
            handleError(res, next, ERR_RUN, "Error getting exchange rate: " + error);
            return;
        }
        res.send({
            rate: rate
        });
        next();
    });
};

readSGBalance = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        if (userID !== "1") {
            handleError(res, next, ERR_RUN, "Error authorizing user: User id is not authorized.");
            return;
        }
        Payment.getSGBalance(function(error, balance) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error retrieving Sharingear balance: " + error);
                return;
            }
            res.send({
                balance: balance
            });
            next();
        });
    });
};

readSGTransactions = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        if (userID !== "1") {
            handleError(res, next, ERR_RUN, "Error authorizing user: User id is not authorized.");
            return;
        }
        Payment.getSGTransactions(function(error, transactions) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error retrieving Sharingear transactions: " + error);
                return;
            }
            res.send(transactions);
            next();
        });
    });
};

readSGPreauthorization = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        if (userID !== "1") {
            handleError(res, next, ERR_RUN, "Error authorizing user: User id is not authorized.");
            return;
        }
        Payment.getSGPreauthorization(req.params.preauth_id, function(error, preauthorization) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error retrieving Sharingear preauthorization: " + error);
                return;
            }
            res.send(preauthorization);
            next();
        });
    });
};

wipeout = function(req, res, next) {
    isAuthorized(req, function(error, userID) {
        if (error) {
            handleError(res, next, ERR_RUN, "Error authorizing user: " + error);
            return;
        }
        if (userID === null) {
            handleError(res, next, ERR_AUTH, "Error authorizing user: User is not authorized.");
            return;
        }
        if (userID !== "1") {
            handleError(res, next, ERR_RUN, "Error authorizing user: User id is not authorized.");
            return;
        }
        SGDashboard.wipeout(function(error) {
            if (error) {
                handleError(res, next, ERR_RUN, "Error performing wipeout: " + error);
                return;
            }
            console.log("Database wiped out successfully.");
            res.send({});
            next();
        });
    });
};

/* UTILITIES */
/**
 * @return: Error codes
 *  ERR_AUTH = 001: Authorization error
 *  ERR_RUN = 002: Runtime error
 */
handleError = function(res, next, code, message) {
    console.error("Error " + code + ": " + message);
    res.send({
        code: code,
        error: message
    });
    next();
};

/**
 * @callback(error, user_id): in case of no errors but invalid token user_id null is returned.
 */
isAuthorized = function(req, callback) {
    //Check if request is authorized
    var token = Sec.getTokenFromRequest(req),
        tokenData;
    if (token === null) {
        callback("No token in header.");
        return;
    }
    tokenData = Sec.verifyJWT(token);
    if (tokenData === null) {
        callback(null, null);
        return;
    }

    //Check that the user still has a valid Facebook token
    User.getToken(tokenData.user_id, function(error, token) {
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
                callback(null, null);
            } else {
                callback(null, tokenData.user_id);
            }
        });
    });
};

//ROUTES
server.get("/", healthCheck);

//405 debug
server.on("MethodNotAllowed", function(req, res) {
    console.error("---- Method " + req.method + " on URI " + req.url + " not allowed in standard server");
    return res.send(new restify.MethodNotAllowedError());
});

secureServer.on("MethodNotAllowed", function(req, res) {
    var allowedHeaders;
    //jQuery forces preflight requests when adding additional headers such as an authorization header
    //https://github.com/mcavage/node-restify/issues/284
    if (req.method.toLowerCase() === "options") {
        allowedHeaders = ["Accept", "Accept-Version", "Content-Type", "Api-Version", "Origin", "X-Requested-With", "Authorization"];
        if (res.methods.indexOf("OPTIONS") === -1) {
            res.methods.push("OPTIONS");
        }
        res.header("Access-Control-Allow-Credentials", true);
        res.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
        res.header("Access-Control-Allow-Methods", res.methods.join(", "));
        res.header("Access-Control-Allow-Origin", req.headers.origin);

        return res.send(200);
    } else {
        console.error("---- Method " + req.method + " on URI " + req.url + " not allowed in secure server");
        return res.send(new restify.MethodNotAllowedError());
    }
});

secureServer.get("/localization", readLocalizationData);
secureServer.get("/contentclassification", readContentClassification);

secureServer.post("/gear", createGear);
secureServer.get("/gear", getGear);
secureServer.get("/gear/images", getGearImages);
secureServer.get("/gear/:id", readGearWithID);
secureServer.post("/gear/image", addImageToGear);
secureServer.get("/gear/search/:location/:gear/:daterange", readGearSearchResults);

secureServer.post("/users/login", createUserSession);
secureServer.get("/users/:id/logout", logoutUserWithID);
secureServer.get("/users", getUsers);
secureServer.get("/users/:id", readUserWithID);
secureServer.get("/users/:id/public", readPublicUserWithID);
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
secureServer.get("/vans", getVans);
secureServer.get("/vans/images", getVansImages);
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
secureServer.get("/roadies", getRoadies);
secureServer.get("/roadies/images", getRoadiesImages);
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
