/*jslint node: true */
"use strict";

var chai = require("chai"),
	config = require("../config"),

	describe = GLOBAL.describe,
	it = GLOBAL.it,
	expect = chai.expect;

describe("Config - App settings", function() {
	it("Has wipeout disabled.", function() {
		expect(config.DB_WIPEABLE).to.equal(false);
	});
});