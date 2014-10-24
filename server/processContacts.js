var PG = require('./knex');
var Phone = require('libphonenumber');
var async = require('async');
var Names = require('./nameDatabase');

// var start = new Date().getTime();

exports.processContacts = function(req, res) {
	var contacts = req.body.contacts;
	var processedContacts = []; //Stores contacts with valid phone numbers


	async.each(contacts, function(contact, callback) {

		//Extract normalized phone number
		var normalized_phone_number = Phone.e164(contact.raw_phone_number,'US', function(error, result) {
			
			//Only store contacts for which there was a normalized phone number
			if (!error && result !== null) {
				contact.normalized_phone_number = result;
				//console.log((contact.full_name.split(' ')[0]).toLowerCase());

				//Guess the gender of the contact based on their first name
				contact.guessed_gender = Names[(contact.guessed_full_name.split(' ')[0]).toLowerCase()];
				if (typeof contact.guessed_gender === "undefined") {
					contact.guessed_gender = "MALE";
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
				console.log(processedContacts);

				//UPSERT
				PG.knex.raw("WITH new_values (guessed_full_name, normalized_phone_number, guessed_gender) AS ("
								+" VALUES "
								+ JSONtoSQL(processedContacts)
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
								+" FROM new_values"
								+" WHERE NOT EXISTS (SELECT 1"
								+"				  FROM upsert up"
								+"				  WHERE up.normalized_phone_number = new_values.normalized_phone_number)")
								.then(function(response) {
									console.log("Response after upserting table:", response); 
									res.send(201,{response:"OK"});
								})
								.catch(function(err) {
										console.log("Error", err);
										res.send(500,"Error upserting contacts: " + err);
								});
			}


		});
};

var JSONtoSQL = function(contacts) {
	var stringSQL = "";
	contacts.forEach(function(contact) {
		stringSQL = stringSQL + "('" + contact.guessed_full_name + "','" + contact.normalized_phone_number + "','" + contact.guessed_gender + "'),"; 
	});
	return stringSQL.substring(0, stringSQL.length - 1);
};


// var contacts = [{guessed_full_name: "Anita George", raw_phone_number:"6098510053"},
// 				{guessed_full_name: "Anil Patrl", raw_phone_number:"609-654-0053"},
// 				{guessed_full_name: "George Smiths", raw_phone_number:"6107260826"},
// 				{guessed_full_name: "Sunny Singh", raw_phone_number:"6098asfs510053"},
// 				{guessed_full_name: "Mia sd", raw_phone_number:"7322079402"}];

// var req = {body:{}};
// req.body.contacts = contacts;


// processContacts(req,{});
// console.log("Time: " + (new Date().getTime() - start));