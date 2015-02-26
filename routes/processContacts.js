'use strict';

//Module to process initial raw contacts sent from client apps

//External dependencies
var PG = require('./knex');
var Phone = require('libphonenumber');
var async = require('async');
var _ = require('lodash');

//Internal dependencies
var Names = require('./nameDatabase');
var Matches = require('./matches');
var utils = require('./utils');

//Receives, formats, and inserts new contacts into the database
exports.processContacts = function(req, res) {

	var contacts = req.body.contacts;
	var processedContacts = []; //Stores contacts with valid phone numbers
	var my_contact_id = req.query.contact_id;
	var allNormalizedPhoneNumbers = [];

	var isVerified = false;
	if (my_contact_id) {  //Checks if the calling user is registered
		isVerified = true;
	}

	if (contacts && contacts.length > 4) { //If there at least 5 contacts
		async.each(contacts, function(contact, callback) {  //Format each contact individually

			var normalized_phone_number = Phone.e164(contact.raw_phone_number,'US', function(error, result) { 	//Extract normalized phone number

				//Only store contacts for which there was a normalized phone number
				if (!error && result !== null) {
					contact.normalized_phone_number = result;
					contact.guessed_full_name = utils.formatName(contact.guessed_full_name);  //Format the name
					allNormalizedPhoneNumbers.push(result);

					//Guess the gender of the contact based on their first name
					contact.guessed_gender = Names[(contact.guessed_full_name.split(' ')[0]).toLowerCase()];
					if (typeof contact.guessed_gender === "undefined") {
						contact.guessed_gender = "UNKNOWN";
					}

					//Set the generic image url of the contact based on gender
					if (contact.guessed_gender === "UNKNOWN") {
						contact.image_url = 'http://s3.amazonaws.com/matchflare-profile-pictures/pair.jpg';
					}
					else if (contact.guessed_gender === "MALE") {
						if (Math.random() < 0.5) {
							contact.image_url = 'http://s3.amazonaws.com/matchflare-profile-pictures/male_silhouette_3.jpg';
						}
						else {
							contact.image_url = 'http://s3.amazonaws.com/matchflare-profile-pictures/male_silhouette_2.jpg';
						}
					}
					else if (contact.guessed_gender === "FEMALE") {
						if (Math.random() < 0.5) {
							contact.image_url = 'http://s3.amazonaws.com/matchflare-profile-pictures/female_silhouette_1.jpg';
						}
						else {
							contact.image_url = 'http://s3.amazonaws.com/matchflare-profile-pictures/female_silhouette_2.jpg';
						}
					}
					processedContacts.push(contact);  //Add the processed number to the array
				}
				callback();
			});
		}, function(err) {
				if (err) {
					console.log("An error has occured while processing contacts");
					res.send(500,"Error processing contacts: " + err);
				}
				else { //Once all numbers have been filtered...

				//Insert new contacts into the table
				PG.knex.raw("BEGIN; LOCK TABLE contacts IN SHARE ROW EXCLUSIVE MODE; \
					WITH new_values (guessed_full_name, normalized_phone_number, guessed_gender, image_url) AS \
					(VALUES " + contactsJSONtoSQL(processedContacts) + ") \
					INSERT INTO contacts (guessed_full_name, normalized_phone_number, guessed_gender, image_url, gender_preferences) \
					(SELECT * , guess_preferences(new_values.guessed_gender) FROM new_values WHERE new_values.normalized_phone_number NOT IN (SELECT contacts.normalized_phone_number FROM contacts));COMMIT;").then(function(response) {
										console.log("Response after inserting new contacts:", response); 

										if (isVerified) { //If this user is verified, update the contacts of the user
											PG.knex.raw('UPDATE contacts SET contacts = contacts || (ARRAY(SELECT contact_id FROM contacts WHERE normalized_phone_number IN ' +  phoneJSONtoSQL(allNormalizedPhoneNumbers) + ' AND NOT contact_id = ANY(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?))) WHERE contact_id = ?;', [my_contact_id, my_contact_id])
												.then(function(result) {
													console.log("Successfully inserted id's of friends", result);
													Matches.makeMatches(my_contact_id,null, function(err) { //Generate matches using the new set of contacts
														if (err) {
															res.send(501,"Error making new matches: " + err.toString());
														} else {
															res.send(201,{matches: null, contact_objects: null});
														}
													});

											}).catch(function(err) {
												console.log("Error inserting id's of contacts:", err);
											});
										} else { //If not verified, generate and return matches using the initial phone list

											//Get id's of all contacts
											PG.knex.raw("SELECT contact_id, guessed_full_name, image_url, verified FROM contacts WHERE normalized_phone_number IN " + phoneJSONtoSQL(allNormalizedPhoneNumbers) + " ORDER BY guessed_full_name").then(function(result) {
												console.log("Retrieved all contact ids of the current user");

												var contact_ids = result.rows;
												Matches.makeMatches(null,contact_ids, function(err, matches) { 												//Get initial matches of this user

													if (err) {
														res.send(501,"Error making matches: " + err.toString());
													} else {
														res.send(201,{matches: matches, contact_objects: contact_ids});
													}
												});

											}).catch(function(err){
												console.error("Error retrieving contact id's of the current user");
											});
										}

									})
									.catch(function(err) {
										console.log("Error", err);
										res.status(500).send("Error inserting new contacts: " + err);
									});
				}
			});
	}
	else {
		console.log("Not enough contacts to make matches--sending null");
		res.send(201,{matches:null,contact_objects:null});
	}
};


//Utilities to format lists of contacts and phones numbers into SQL strings
var contactsJSONtoSQL = function(contacts) {
	var stringSQL = "";
	contacts.forEach(function(contact) {
		stringSQL = stringSQL + "('" + contact.guessed_full_name.replace(/'/g, "''") + "','" + contact.normalized_phone_number + "','" + contact.guessed_gender + "','" + contact.image_url + "'),"; 
	});
	return stringSQL.substring(0, stringSQL.length - 1);
};

var phoneJSONtoSQL = function(phoneNumbers) {
	var stringSQL = "(";
	phoneNumbers.forEach(function(phoneNumber) {
		stringSQL = stringSQL + "'" + phoneNumber + "',"; 
	});
	return stringSQL.substring(0, stringSQL.length - 1) + ')';
};
