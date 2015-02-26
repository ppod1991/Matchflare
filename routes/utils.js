'use strict';

//Module that contains various utilities to handle common tasks

//External dependencies
var _ = require('lodash');
_.str = require('underscore.string');
_.mixin(_.str.exports());
var Phone = require('libphonenumber');


//Trims leading and lagging spaces and converts the string to lower-case
exports.trimAndLowerCase = function(rawString) {
	return _(rawString).chain().trim().value().toLowerCase();
};

//Checks if a given string contains a substring
exports.contains = function(originalString, containsThis) {
	return _.str.include(exports.trimAndLowerCase(originalString),exports.trimAndLowerCase(containsThis));
};

//Converts a given phone number to 'US' e164 compliant phone number
exports.normalizedPhoneNumber = function(rawPhoneNumber, callback) {
	Phone.e164(rawPhoneNumber,'US', function(error,result) {
		if (error) {
			callback(error,null);
		}
		else {
			callback(null,result);
		}
	});
};

//Format a string to match a name by trimming and capitalizing first letter of each word
exports.formatName = function(rawNameString) {
	return _(rawNameString).chain().trim().titleize().value();
};

//Test function
exports.test = function(req, res) {
	console.log("Test query: " + JSON.stringify(req.query));
	console.log("Name: " + JSON.stringify(req.body));
	res.send(201,{woo: "yay"});
};