var _ = require('lodash');
_.str = require('underscore.string');
_.mixin(_.str.exports());
var Phone = require('libphonenumber');

exports.trimAndLowerCase = function(rawString) {
	return _(rawString).chain().trim().value().toLowerCase();
};

exports.contains = function(originalString, containsThis) {
	return _.str.include(exports.trimAndLowerCase(originalString),exports.trimAndLowerCase(containsThis));
}

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