var PG = require('./knex');
var Phone = require('libphonenumber');
var async = require('async');
var Names = require('./nameDatabase');
var Matches = require('./matches');
var _ = require('lodash');
var utils = require('./utils');

// var start = new Date().getTime();

exports.processContacts = function(req, res) {
	var contacts = req.body.contacts;
	var processedContacts = []; //Stores contacts with valid phone numbers
	var my_contact_id = req.query.contact_id;
	var allNormalizedPhoneNumbers = [];

	var isVerified = false;
	if (my_contact_id) {
		isVerified = true;
	};

	async.each(contacts, function(contact, callback) {

		//Extract normalized phone number
		var normalized_phone_number = Phone.e164(contact.raw_phone_number,'US', function(error, result) {
			
			//Only store contacts for which there was a normalized phone number
			if (!error && result !== null) {
				contact.normalized_phone_number = result;
				contact.guessed_full_name = utils.formatName(contact.guessed_full_name);
				allNormalizedPhoneNumbers.push(result);
				//console.log((contact.full_name.split(' ')[0]).toLowerCase());

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
				processedContacts.push(contact);
			}
			callback();
		});
	}, function(err) {
			if (err) {
				console.log("An error has occured while processing contacts");
				res.send(500,"Error processing contacts: " + err);
			}
			else {
				//Once all numbers have been filtered...

				//res.send(201,{contacts: processedContacts});
				// console.log("BEGIN; LOCK TABLE contacts IN SHARE ROW EXCLUSIVE MODE; WITH new_values (guessed_full_name, normalized_phone_number, guessed_gender) AS ("
				// 				+" VALUES "
				// 				+ contactsJSONtoSQL(processedContacts)
				// 				+" ),"
				// 				+" upsert as "
				// 				+" ("
				// 				+"	UPDATE contacts c"
				// 				+"		SET guessed_gender = nv.guessed_gender"
				// 				+"	FROM new_values nv"
				// 				+"	WHERE c.normalized_phone_number = nv.normalized_phone_number"
				// 				+"	RETURNING c.normalized_phone_number"
				// 				+")"
				// 				+" INSERT INTO contacts (guessed_full_name, normalized_phone_number, guessed_gender)"
				// 				+" SELECT guessed_full_name, normalized_phone_number, guessed_gender"
				// 				+" FROM (SELECT max(guessed_full_name) guessed_full_name, normalized_phone_number, max(guessed_gender) guessed_gender FROM new_values GROUP BY normalized_phone_number) groupedValues"
				// 				+" WHERE NOT EXISTS (SELECT 1"
				// 				+"				  FROM upsert up"
				// 				+"				  WHERE up.normalized_phone_number = groupedValues.normalized_phone_number); COMMIT;");

				//UPSERT
				// PG.knex.raw("BEGIN; LOCK TABLE contacts IN SHARE ROW EXCLUSIVE MODE; WITH new_values (guessed_full_name, normalized_phone_number, guessed_gender) AS ("
				// 				+" VALUES "
				// 				+ contactsJSONtoSQL(processedContacts)
				// 				+" ),"
				// 				+" upsert as "
				// 				+" ("
				// 				+"	UPDATE contacts c"
				// 				+"		SET guessed_gender = nv.guessed_gender"
				// 				+"	FROM new_values nv"
				// 				+"	WHERE c.normalized_phone_number = nv.normalized_phone_number"
				// 				+"	RETURNING c.normalized_phone_number"
				// 				+")"
				// 				+" INSERT INTO contacts (guessed_full_name, normalized_phone_number, guessed_gender)"
				// 				+" SELECT guessed_full_name, normalized_phone_number, guessed_gender"
				// 				+" FROM (SELECT max(guessed_full_name) guessed_full_name, normalized_phone_number, max(guessed_gender) guessed_gender FROM new_values GROUP BY normalized_phone_number) groupedValues"
				// 				+" WHERE NOT EXISTS (SELECT 1"
				// 				+"				  FROM upsert up"
				// 				+"				  WHERE up.normalized_phone_number = groupedValues.normalized_phone_number) RETURNING contact_id; COMMIT;")
								

			PG.knex.raw("BEGIN; LOCK TABLE contacts IN SHARE ROW EXCLUSIVE MODE; \
				WITH new_values (guessed_full_name, normalized_phone_number, guessed_gender, image_url) AS \
				(VALUES " + contactsJSONtoSQL(processedContacts) + ") \
				INSERT INTO contacts (guessed_full_name, normalized_phone_number, guessed_gender, image_url, gender_preferences \
				(SELECT * , guess_preferences(new_values.guessed_gender) FROM new_values WHERE new_values.normalized_phone_number NOT IN (SELECT contacts.normalized_phone_number FROM contacts));COMMIT;").then(function(response) {
									console.log("Response after inserting new contacts:", response); 

									if (isVerified) {
										//Updates contacts of the current user (if verifed)
										PG.knex.raw('UPDATE contacts SET contacts = contacts || (ARRAY(SELECT contact_id FROM contacts WHERE normalized_phone_number IN ' +  phoneJSONtoSQL(allNormalizedPhoneNumbers) + ' AND NOT contact_id = ANY(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?))) WHERE contact_id = ?;', [my_contact_id, my_contact_id])
											.then(function(result) {
												console.log("Successfully inserted id's of friends", result);
												Matches.makeMatches(my_contact_id,null, function(err) {
													if (err) {
														res.send(501,"Error making new matches: " + err.toString());
													} else {
														res.send(201,{matches: null, contact_objects: null});
													}
												});

										}).catch(function(err) {
											console.log("Error inserting id's of contacts:", err);
										});
									}

									if (!isVerified) {
										//Get id's of all contacts
										PG.knex.raw("SELECT contact_id, guessed_full_name, image_url FROM contacts WHERE normalized_phone_number IN " + phoneJSONtoSQL(allNormalizedPhoneNumbers) + " ORDER BY guessed_full_name").then(function(result) {
											console.log("Retrieved all contact id of the current user");
											//Get initial matches of this user
											var contact_ids = result.rows;
											Matches.makeMatches(null,contact_ids, function(err, matches) {
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
};

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


// var contacts = [{guessed_full_name: "Anit\a George", raw_phone_number:"6028510053"},
// 				{guessed_full_name: "Anil's Patrl", raw_phone_number:"6098510053"},
// 				{guessed_full_name: "George Smiths", raw_phone_number:"6107260826"},
// 				{guessed_full_name: "Blob Singh", raw_phone_number:"+15037069934"},
// 				{guessed_full_name: "TEst2", raw_phone_number:"7322079703"}];
// var res = {send:function(a) {}, status:function(a) {return {send:function(a){}};}};
// var req = {body:{}, query:{}};
// req.body.contacts = contacts;
// req.query.contact_id = 90;

// exports.processContacts(req,res);
// console.log("Time: " + (new Date().getTime() - start));