/**
 * Contains configuration constants for the Sharingear API.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var IS_PRODUCTION = false, //This variable should be set and saved according to the git branch: true for master and false for develop
	MYSQL_URL,
	SPHINX_URL,
	VALID_IMAGE_HOST,
	MANGOPAY_SANDBOX_CLIENTID,
	MANGOPAY_SANDBOX_URL,
	MANGOPAY_USERNAME,
	MANGOPAY_SANDBOX_KEY;

if(IS_PRODUCTION === true) {
	MYSQL_URL = "173.194.246.188";
	SPHINX_URL = "130.211.79.103";
	VALID_IMAGE_HOST = "prod-static.sharingear.com";
	MANGOPAY_SANDBOX_CLIENTID = "sharingear";
	MANGOPAY_SANDBOX_URL = "api.mangopay.com";
	MANGOPAY_USERNAME = "sharingear";
	MANGOPAY_SANDBOX_KEY = "xfwZgeP7RZSesLLeytfk7eGfJz24hVkAansp3q8V8Uj4SL30hc";
}
else {
	MYSQL_URL = "173.194.247.144";
	SPHINX_URL = "130.211.86.240";
	VALID_IMAGE_HOST = "dev.sharingear.com";
	MANGOPAY_SANDBOX_CLIENTID = "sharingear";
	MANGOPAY_SANDBOX_URL = "api.sandbox.mangopay.com";
	MANGOPAY_USERNAME = "sharingear";
	MANGOPAY_SANDBOX_KEY = "dX2tt67NAQyDtDWHSSHBEuHOnnYUd6pvCROsde0vTiL1Trhudg";
}

module.exports = {
	MYSQL_URL: MYSQL_URL,
	SPHINX_URL: SPHINX_URL,
	VALID_IMAGE_HOST: VALID_IMAGE_HOST,
	MANGOPAY_SANDBOX_CLIENTID: MANGOPAY_SANDBOX_CLIENTID,
	MANGOPAY_SANDBOX_URL: MANGOPAY_SANDBOX_URL,
	MANGOPAY_USERNAME: MANGOPAY_USERNAME,
	MANGOPAY_SANDBOX_KEY: MANGOPAY_SANDBOX_KEY
};
