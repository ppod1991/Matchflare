var PG = require('./knex');
var Phone = require('libphonenumber');
var async = require('async');
var Names = require('./nameDatabase');

// var start = new Date().getTime();

exports.processContacts = function(req, res) {
	var contacts = req.body.contacts;
	var processedContacts = []; //Stores contacts with valid phone numbers
	var my_contact_id = req.query.contact_id;
	var allNormalizedPhoneNumbers = [];

	async.each(contacts, function(contact, callback) {

		//Extract normalized phone number
		var normalized_phone_number = Phone.e164(contact.raw_phone_number,'US', function(error, result) {
			
			//Only store contacts for which there was a normalized phone number
			if (!error && result !== null) {
				contact.normalized_phone_number = result;
				allNormalizedPhoneNumbers.push(result);
				//console.log((contact.full_name.split(' ')[0]).toLowerCase());

				//Guess the gender of the contact based on their first name
				contact.guessed_gender = Names[(contact.guessed_full_name.split(' ')[0]).toLowerCase()];
				if (typeof contact.guessed_gender === "undefined") {
					contact.guessed_gender = "UNKNOWN";
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
				PG.knex.raw("BEGIN; LOCK TABLE contacts IN SHARE ROW EXCLUSIVE MODE; WITH new_values (guessed_full_name, normalized_phone_number, guessed_gender) AS ("
								+" VALUES "
								+ contactsJSONtoSQL(processedContacts)
								+" ),"
								+" upsert as "
								+" ("
								+"	UPDATE contacts c"
								+"		SET guessed_gender = nv.guessed_gender"
								+"	FROM new_values nv"
								+"	WHERE c.normalized_phone_number = nv.normalized_phone_number"
								+"	RETURNING c.normalized_phone_number"
								+")"
								+" INSERT INTO contacts (guessed_full_name, normalized_phone_number, guessed_gender)"
								+" SELECT guessed_full_name, normalized_phone_number, guessed_gender"
								+" FROM (SELECT max(guessed_full_name) guessed_full_name, normalized_phone_number, max(guessed_gender) guessed_gender FROM new_values GROUP BY normalized_phone_number) groupedValues"
								+" WHERE NOT EXISTS (SELECT 1"
								+"				  FROM upsert up"
								+"				  WHERE up.normalized_phone_number = groupedValues.normalized_phone_number) RETURNING contact_id; COMMIT;")
								//+" AND WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.normalized_phone_number = new_values.normalized_phone_number)")
								.then(function(response) {
									console.log("Response after upserting table:", response); 

									//Updates contacts of the current user
									PG.knex.raw('UPDATE contacts SET contacts = contacts || (ARRAY(SELECT contact_id FROM contacts WHERE normalized_phone_number IN ' +  phoneJSONtoSQL(allNormalizedPhoneNumbers) + ' AND NOT contact_id = ANY(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?))) WHERE contact_id = ?;', [my_contact_id, my_contact_id])
										.then(function(result) {
											console.log("Successfully inserted id's of friends", result);
									}).catch(function(err) {
										console.log("Error inserting id's of contacts:", err);
									});

									res.send(201,{response:"OK"});
								})
								.catch(function(err) {
									console.log("Error", err);
									res.status(500).send("Error upserting contacts: " + err);
								});


			}


		});
};

var contactsJSONtoSQL = function(contacts) {
	var stringSQL = "";
	contacts.forEach(function(contact) {
		stringSQL = stringSQL + "('" + contact.guessed_full_name.replace(/'/g, "''") + "','" + contact.normalized_phone_number + "','" + contact.guessed_gender + "'),"; 
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