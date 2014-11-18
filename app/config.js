/**
 * Contains configuration constants for the Sharingear API.
 * @author: Chris Hjorth
 */

/*jslint node: true */
"use strict";

var IS_PRODUCTION = true, //This variable should be set and saved according to the git branch: true for master and false for develop
	MYSQL_URL,
	SPHINX_URL;

if(IS_PRODUCTION === true) {
	MYSQL_URL = "173.194.246.188";
	SPHINX_URL = "146.148.126.111";
}
else {
	MYSQL_URL = "173.194.247.144";
	SPHINX_URL = "146.148.126.111";
}

module.exports = {
	MYSQL_URL: MYSQL_URL,
	SPHINX_URL: SPHINX_URL
};
