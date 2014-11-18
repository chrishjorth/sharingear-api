/**
 * Contains configuration constants for the Sharingear API.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var IS_PRODUCTION = true, //This variable should be set and saved according to the git branch: true for master and false for develop
	MYSQL_URL,
	SPHINX_URL,
	VALID_IMAGE_HOST;

if(IS_PRODUCTION === true) {
	MYSQL_URL = "173.194.246.188";
	SPHINX_URL = "146.148.126.111";
	VALID_IMAGE_HOST = "prod-static.sharingear.com";
}
else {
	MYSQL_URL = "173.194.247.144";
	SPHINX_URL = "146.148.126.111";
	VALID_IMAGE_HOST = "dev.sharingear.com";
}

module.exports = {
	MYSQL_URL: MYSQL_URL,
	SPHINX_URL: SPHINX_URL,
	VALID_IMAGE_HOST: VALID_IMAGE_HOST
};
