/**
 * Contains configuration constants for the Sharingear API.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var IS_PRODUCTION = true, //This variable should be set and saved according to the git branch: true for master and false for develop
	fs = require("fs"),
	SEARCH_RADIUS = 80000,
	SHARINGEAR_VAT = 25.0,
	DB_WIPEABLE = false,
	MYSQL_URL,
	MYSQL_CA,
	MYSQL_CERT,
	MYSQL_KEY,
	SPHINX_URL,
	VALID_IMAGE_HOST,
	MANGOPAY_SANDBOX_CLIENTID,
	MANGOPAY_SANDBOX_URL,
	MANGOPAY_USERNAME,
	MANGOPAY_SANDBOX_KEY,

	isProduction;

if(IS_PRODUCTION === true) {
	DB_WIPEABLE = false; //Failsafe
	//MYSQL_URL = "173.194.246.188";
	MYSQL_URL = "mysql-prod.c4hmgqhmacxa.eu-west-1.rds.amazonaws.com";
	//MYSQL_CA = fs.readFileSync(__dirname + "/../certificates/prod_server-ca.pem");
	//MYSQL_CERT = fs.readFileSync(__dirname + "/../certificates/prod_client-cert.pem");
	//MYSQL_KEY = fs.readFileSync(__dirname + "/../certificates/prod_client-key.pem");
	SPHINX_URL = "ec2-52-16-253-75.eu-west-1.compute.amazonaws.com";
	VALID_IMAGE_HOST = "www.sharingear.com";
	MANGOPAY_SANDBOX_CLIENTID = "sharingear";
	MANGOPAY_SANDBOX_URL = "api.mangopay.com";
	MANGOPAY_USERNAME = "sharingear";
	MANGOPAY_SANDBOX_KEY = "xfwZgeP7RZSesLLeytfk7eGfJz24hVkAansp3q8V8Uj4SL30hc";
}
else {
	//MYSQL_URL = "173.194.247.144";
	MYSQL_URL = "mysql-dev.c4hmgqhmacxa.eu-west-1.rds.amazonaws.com";
	//MYSQL_CA = fs.readFileSync(__dirname + "/../certificates/dev_server-ca.pem");
	//MYSQL_CERT = fs.readFileSync(__dirname + "/../certificates/dev_client-cert.pem");
	//MYSQL_KEY = fs.readFileSync(__dirname + "/../certificates/dev_client-key.pem");
	SPHINX_URL = "ec2-52-19-72-101.eu-west-1.compute.amazonaws.com";
	VALID_IMAGE_HOST = "dev.sharingear.com";
	MANGOPAY_SANDBOX_CLIENTID = "sharingear";
	MANGOPAY_SANDBOX_URL = "api.sandbox.mangopay.com";
	MANGOPAY_USERNAME = "sharingear";
	MANGOPAY_SANDBOX_KEY = "dX2tt67NAQyDtDWHSSHBEuHOnnYUd6pvCROsde0vTiL1Trhudg";
}

isProduction = function() {
	return (IS_PRODUCTION === true);
};

module.exports = {
	MYSQL_URL: MYSQL_URL,
	MYSQL_CA: MYSQL_CA,
	MYSQL_CERT: MYSQL_CERT,
	MYSQL_KEY: MYSQL_KEY,
	SPHINX_URL: SPHINX_URL,
	VALID_IMAGE_HOST: VALID_IMAGE_HOST,
	MANGOPAY_SANDBOX_CLIENTID: MANGOPAY_SANDBOX_CLIENTID,
	MANGOPAY_SANDBOX_URL: MANGOPAY_SANDBOX_URL,
	MANGOPAY_USERNAME: MANGOPAY_USERNAME,
	MANGOPAY_SANDBOX_KEY: MANGOPAY_SANDBOX_KEY,
	SEARCH_RADIUS: SEARCH_RADIUS,
	SHARINGEAR_VAT: SHARINGEAR_VAT,
	DB_WIPEABLE: DB_WIPEABLE,
	isProduction: isProduction
};
