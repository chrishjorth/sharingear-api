/**
 * Security related utilities.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var crypto = require("crypto"),
	JWT = require("jsonwebtoken"),
	sharingearSecret = "95b95a4a2e59ddc98136ce54b8a0f8d2",
	generateFileName,
	getFileSecretProof,
	signJWT,
	verifyJWT,
	getTokenFromRequest;

/**
 * Generates a unique filename.
 * @return fileName in the format filenamehash_uniqueID. 
 */
generateFileName = function(originalFileName) {
	var filenameHash, id;
	filenameHash = crypto.createHash("md5").update(originalFileName).digest("hex");
	id = crypto.randomBytes(20).toString("hex");
	return filenameHash + "_" + id;
};

getFileSecretProof = function(filename) {
	var hmac = crypto.createHmac("sha256", sharingearSecret);
	hmac.update(filename);
	return hmac.digest("hex");
};

signJWT = function(payload) {
	return JWT.sign(payload, sharingearSecret);
};

verifyJWT = function(token) {
	try {
		return JWT.verify(token, sharingearSecret);
	}
	catch(error) {
		return null;
	}
};

getTokenFromRequest = function(req) {
	var bearerHeader = req.headers.authorization;
	if(!bearerHeader) {
		//No Authorization header passed
		return null;
	}
	//Authorization: Bearer token
	bearerHeader = bearerHeader.split(" ");
	return bearerHeader[1];
};

module.exports = {
	generateFileName: generateFileName,
	getFileSecretProof: getFileSecretProof,
	signJWT: signJWT,
	verifyJWT: verifyJWT,
	getTokenFromRequest: getTokenFromRequest
};