'use strict';

//Module to handle requests about matches include getting matches, generating matches, and responding to match results

//External dependencies
var int_encoder = require('int-encoder');
var _ = require('lodash');
var async = require('async');

//Internal dependencies
var PG = require('./knex');
var notify = require('./notify');

//Returns the match with the specified pair ID
exports.getMatch = function(req, res) {

	var encoded_pair_id = req.query.encoded_pair_id;

	var pair_id;
	if(!encoded_pair_id) {  //If not encoded...
		pair_id = req.query.pair_id;
	}
	else {
		pair_id = int_encoder.decode(encoded_pair_id);
	}
	
	PG.knex.raw("SELECT pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, \
					matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, \
					matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, matcher.guessed_gender AS matcher_gender, \
					first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id, chat_id \
					FROM pairs \
					INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id \
					INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id \
					INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id \
					WHERE pair_id = ? ;",[pair_id]).then(function(result) {
		console.log('Retrieved match with result: ', result.rows);
		var matches = exports.rowsToObjects(result.rows, function(err, results) { //Converts the pair rows to pair objects
			if(err) {
				throw err;
			}
			else {
				res.send(201,results[0]);
			}
		});
	}).catch(function(err) {
		console.error('Error retrieving match: ', err);
		res.send(500,err);
	});
};


//Get the pending matches for the specified user (Pending matches are ones where the current user must make a match or both matchees have accepted)
exports.getPendingMatches = function(req, res) {

	var contact_id = req.query.contact_id;
	PG.knex.raw("SELECT chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, \
					matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender, \
					matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, \
					first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id \
					FROM pairs \
					INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id \
					INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id \
					INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id \
					WHERE ((first.contact_id = ? AND first_contact_status = 'NOTIFIED') OR (second.contact_id = ? AND second_contact_status = 'NOTIFIED')) \
					OR ((first_contact_status = 'ACCEPT' AND second_contact_status = 'ACCEPT') AND (first.contact_id = ? OR second.contact_id = ?));",[contact_id, contact_id, contact_id, contact_id]).then(function(result) {
		console.log("Pending Matches Successfully retrieved: ", result.rows);
		var matches = exports.rowsToObjects(result.rows, function(err, results) {
			if(err) {
				throw err;
			}
			else {
				res.send(201,results);
			}
		});
	}).catch(function(err) {
		console.error("Error getting pending matches: ", err);
		res.send(501,err);
	});
};

//Generate matches for the current user
exports.makeMatches = function(contact_id, contact_ids, callback) {

	var sqlString;
	var parameterArray;

	if (!contact_id) { //If the user is not yet registered, then generate matches using only the phone contact info
		var ids = idsJSONtoSQL(contact_ids); //Format contact_ids for SQL string
		sqlString = "SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_full_name, c1.guessed_gender first_gender, c1.verified first_verified, \
						c2.contact_id second_contact_id, c2.guessed_full_name second_full_name, c2.guessed_gender second_gender, c2.verified second_verified, \
						c1.image_url first_image, c2.image_url second_image \
						FROM contacts c1, contacts c2  \
							WHERE c1.contact_id IN \
								" + ids + " \
							AND c2.contact_id IN  \
								" + ids + " \
							AND c2.guessed_gender IN  \
								(SELECT unnest(c1.gender_preferences))	 \
							AND c1.guessed_gender IN  \
								(SELECT unnest(c2.gender_preferences))	 \
							AND c1.contact_id != c2.contact_id \
							AND NOT c1.blocked_matches \
							AND NOT c2.blocked_matches \
						ORDER BY pair_score(c1,c2) DESC LIMIT 30"
		parameterArray = [];
	}
	else { //If the user is registered, then get the contacts from the database (instead of from phone)
		var ids = "(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?)";

		//SQL Query to generate matches
		sqlString = "UPDATE contacts SET matches = (SELECT ARRAY(SELECT (c1.contact_id,c2.contact_id)::match \
						FROM contacts c1, contacts c2  \
							WHERE c1.contact_id IN \
								" + ids + " \
							AND c2.contact_id IN  \
								" + ids + " \
							AND c2.guessed_gender IN  \
								(SELECT unnest(c1.gender_preferences))	 \
							AND c1.guessed_gender IN  \
								(SELECT unnest(c2.gender_preferences))	 \
							AND c1.contact_id != c2.contact_id \
							AND c1.contact_id != ? \
							AND c2.contact_id != ? \
							AND c1.contact_id NOT IN (SELECT unnest(removed_contacts) FROM contacts WHERE contact_id = ?) \
							AND c2.contact_id NOT IN (SELECT unnest(removed_contacts) FROM contacts WHERE contact_id = ?) \
							AND NOT c1.blocked_matches \
							AND NOT c2.blocked_matches \
							AND ? NOT IN  \
								(SELECT unnest(c1.blocked_contacts)) \
							AND ? NOT IN  \
								(SELECT unnest(c2.blocked_contacts)) \
						ORDER BY pair_score(c1,c2) DESC LIMIT 30)) WHERE contact_id = ? RETURNING matches"
		parameterArray = [contact_id,contact_id,contact_id,contact_id,contact_id,contact_id, contact_id, contact_id, contact_id];
	};

	//Execute SQL string
	PG.knex.raw(sqlString,parameterArray).then(function(result) {
   			
   			console.log("Result of making matches:", JSON.stringify(result.rows));
   			if (contact_id) { //If registered, don't return anything
   				callback(null,null);
   			}
   			else {

   				//Return match objects if not registered so the user can match before registering
   				var matches = exports.rowsToObjects(result.rows, function(err, results) {
   					if(err) {
   						throw err;
   					}
   					else {
   						callback(null,results);
   					}
   				});
   			}
   		}).catch(function(err) {
   			console.error("Error getting matches", err);
   			callback(err,null);
   		});
};

//Retrieves new set of matches (from cache is already generated) and generates a new one for subsequent access
exports.getMatches = function (req, res) {

	var contact_id;
	var second_call = req.second_call; //Variable to check if getMatches has been called before to protect against infinite match seeking

	if (req.query.contact_id && req.query.contact_id !== 0) { //Check if the user is registered
		contact_id = req.query.contact_id;
	}
	
	var contact_ids = req.body.contacts;

	if (contact_id) { //If registered, then get stored matches
		PG.knex.raw("SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_full_name, c1.guessed_gender first_gender, c1.verified first_verified,\
						c2.contact_id second_contact_id, c2.guessed_full_name second_full_name, c2.guessed_gender second_gender, c2.verified second_verified, \
						c1.image_url first_image, c2.image_url second_image, \
						?::integer matcher_contact_id \
						 FROM (SELECT unnest(matches) AS singleMatch FROM contacts WHERE contact_id=?) matchList \
						 INNER JOIN contacts c1 ON c1.contact_id = (matchList.singleMatch).first_matchee_contact_id \
						 INNER JOIN contacts c2 ON c2.contact_id = (matchList.singleMatch).second_matchee_contact_id;",[contact_id,contact_id])
		.then(function(result) {

			exports.rowsToObjects(result.rows, function(err, results) {  //Converts rows to Contact objects
				if(err) {
					throw err;
				}

				if (results.length > 0) { //If there are some matches, then send results before making new ones...
					res.send(201,results);
				}

				if (results.length === 0 && second_call === true) {  //IF getMatches has been called a second time...
					res.send(501,"No Matches Could be Made");
				}
				else { //Attempt to make more matches and try again!
					exports.makeMatches(contact_id,null,function(err) {
						if (err) {
							console.error("Error making new matches", err);
						}
						else {
							req.second_call = true;
							exports.getMatches(req,res);
						}
					});
				}


			});

		}).catch(function(err) {
			console.error("Error getting matches", err.toString());
		});
	}
	else { //If the user is not registerd, then make matches...
		exports.makeMatches(null,contact_ids, function(err, matches) {
			if (err) {
				res.send(501,"Error making matches: " + err.toString());
			} else {
				res.send(201,matches);
			}
		});
	}
}


//Called when the first user responds to a match. Updates Elo score accordingly.
exports.addMatchResult = function(req, res) {

	var match_status = req.body.match_status;
	var first_contact_id = req.body.first_matchee.contact_id;
	var second_contact_id = req.body.second_matchee.contact_id;
	var is_anonymous = req.body.is_anonymous;
	var matcher_contact_id = req.body.matcher.contact_id;

	if (match_status === "FIRST_CONTACT_WINS" || match_status === "SECOND_CONTACT_WINS") { //If the user rated a friend 'better' rather than matching the friends...
		var eloUpdateValue = 1; //Amount to increment Matchflare score by for Elo Rating
		var orderArray;

		//Determine which contact was chosen
		if (match_status === "FIRST_CONTACT_WINS") {
			orderArray = [first_contact_id, second_contact_id];
		}
		else {
			orderArray = [second_contact_id, first_contact_id];
		}

		//Update Elo scores accordingly
		PG.knex.raw("SELECT update_elo_score(?,?)",orderArray).then(function(result) {
			console.log({response:"Elo scores updated"});

			if (matcher_contact_id) { //Increment this user's matchloare score
				PG.knex.raw('UPDATE contacts SET matchflare_score = matchflare_score + ? WHERE contact_id = ? returning matchflare_score;',[eloUpdateValue,matcher_contact_id]).then(function(result) {
					res.send(201,result.rows[0]);
					console.log("Successfully updated matchflare score", JSON.stringify(result.rows));
				}).catch(function(err) {
					console.error("Error in updating the matchflare score", err);
					res.send(501,"Error updating matchflare score: " + err);
				});
			}
			else {
				res.send(201,{matchflare_score:0});
			}

		}).catch(function(err) {
			console.error("Error updating elo score");
			res.send(501,'Error updating elo score');
		});
	}
	else if (match_status === "MATCHED") { //If the user matched the friends

		var matchUpdateValue = 10; //Amount to update Matchflare score by upon match

		//Get info about the Matcher
		PG.knex('contacts').select('guessed_gender','guessed_full_name').where('contact_id',matcher_contact_id).then(function(result) {

			var matcher = result[0];
			matcher.contact_id = matcher_contact_id;

			//Get info about the two Matchees
			PG.knex('contacts').select().where('contact_id',first_contact_id).orWhere('contact_id',second_contact_id).then(function(result) {

				var contactA = result[0];
				var contactB = result[1];

				//If either contact blocked new matches or this specific matcher, then do not make the match
				if (contactA.blocked_matches || contactB.blocked_matches || _.contains(contactA.blocked_contacts,matcher.contact_id) || _.contains(contactB.blocked_contacts,matcher.contact_id))  {
					console.log("One of the contact blocked this match--cannot make the match");
					res.send(501,"One of these contacts blocked new matches. Sorry!");
				}
				else {
					var firstRecipient;
					var secondRecipient;

					if (contactA.verified && !contactB.verified) {  //Send to un-verified contact first...
						firstRecipient = contactB;
						secondRecipient = contactA;
					}
					else if (!contactA.verified && contactB.verified) {
						firstRecipient = contactA;
						secondRecipient = contactB;
					}
					else {  //If both or neither are verified, send first message to contact with higher elo score...
						if (contactA.elo_score > contactB.elo_score) {
							firstRecipient = contactA;
							secondRecipient = contactB;
						}
						else if (contactA.elo_score < contactB.elo_score) {
							firstRecipient = contactB;
							secondRecipient = contactA;
						}
						else { //If equal elo score, send to assumed male
							if (contactA.guessed_gender === "MALE") {
								firstRecipient = contactA;
								secondRecipient = contactB;
							}
							else {
								firstRecipient = contactB;
								secondRecipient = contactA;
							}
						}
					}

					//Insert the newly-made match to the database
					PG.knex('chats').insert([{first_contact_id: firstRecipient.contact_id,
												second_contact_id: secondRecipient.contact_id},
											{matcher_contact_id:matcher_contact_id,
												first_contact_id: firstRecipient.contact_id},
											{matcher_contact_id:matcher_contact_id,
												second_contact_id: secondRecipient.contact_id}],'chat_id').then(function(result) {

						var chat_id = result[0];
						var first_matcher_chat_id = result[1];
						var second_matcher_chat_id = result[2];

						//Insert the chats of the participants of the match
						PG.knex('pairs').insert({first_contact_id: firstRecipient.contact_id,
													chat_id: chat_id,
													second_contact_id: secondRecipient.contact_id,
													matcher_contact_id: matcher_contact_id,
													is_anonymous: is_anonymous,
													first_matcher_chat_id: first_matcher_chat_id,
													second_matcher_chat_id: second_matcher_chat_id},'pair_id').then(function(result) {

							var pair_id = result[0];

							console.log("Successfully inserted match with pair_id: ", result);
							notify.newMatchNotification(firstRecipient, secondRecipient, matcher, is_anonymous, pair_id, 'first'); //Notify participants of the new match

							//Update Matchflare score of the matcher
							PG.knex.raw('UPDATE contacts SET matchflare_score = matchflare_score + ? WHERE contact_id = ? returning matchflare_score;',[matchUpdateValue,matcher_contact_id]).then(function(result) {
								res.send(201,result.rows[0]);
								console.log("Successfully updated matchflare score", JSON.stringify(result.rows));
							}).catch(function(err) {
								console.error("Error in updating the matchflare score", err);
								res.send(501,"Error updating matchflare score: " + err);
							});

						}).catch(function(err) {
							console.error("Error inserting match:", err);
							res.send(501,err);
						});

					}).catch(function(err) {
						console.error("Error inserting new chat", err);
					});

				}

			}).catch(function(err) {
				console.error("Error getting matchee details", err);
				res.send(501, err);
			});

				
		}).catch(function(err) {
			console.error("Error getting gender of the matcher: ", err);
			res.send(501, err);
		});
	}
	
};

//The function called when someone accepts/rejects a potential match
exports.respondToMatchRequest = function(req, res) {

	var decision = req.body.decision;
	var contact_id = req.body.contact_id;
	var pair_id = req.body.pair_id;

	//Get match/user information for this pair
	PG.knex.raw('SELECT chat_id, is_anonymous, pair_id, matcher.guessed_full_name AS matcher_full_name, \
					matcher.contact_id AS matcher_contact_id, matcher.guessed_gender AS matcher_gender, \
					first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, \
					first.guessed_gender AS first_gender, second.guessed_gender AS second_gender, \
					first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, \
					first_contact_status, second_contact_status \
					FROM pairs \
					INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id \
					INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id \
					INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id \
					WHERE pair_id = ?',[pair_id]).then(function(result) {

		console.log('Received pair', result.rows[0]);
		var pair = conversion(result.rows[0]);

		var this_contact;
		var other_contact;
		var which_contact_is_this;

		//Determine which matchee the caller is...
		if (pair.first_matchee.contact_id === contact_id) {
			this_contact = pair.first_matchee;
			other_contact = pair.second_matchee;
			which_contact_is_this = 'first';
		}
		else if (pair.second_matchee.contact_id === contact_id) {
			this_contact = pair.second_matchee;
			other_contact = pair.first_matchee;
			which_contact_is_this = 'second';
		}

		var new_status;

		//If the match was accepted by this user...
		if (decision === 'ACCEPT') {

			new_status = 'ACCEPT';
			if (other_contact.contact_status === 'ACCEPT') { //If the other matchee also accepted, then create a new chat and notify all parties
				notify.verifiedMatchNotification(pair, this_contact, other_contact, pair.matcher); //Notify participants that a match has been completed
			}
			else { //If the other matchee has not yet been notified, then notify the other matchee and the matcher
				notify.otherMatchNotification(pair, this_contact, other_contact, pair.matcher, which_contact_is_this);
			}
		}
		else if (decision === 'REJECT') { //If the match was rejected, then change status
			new_status = 'REJECT';
		}

		if (new_status) {  //Update the status of this matchee in this pair
			var new_status_object = {};
			new_status_object[which_contact_is_this + "_contact_status"] = new_status;
			PG.knex('pairs').update(new_status_object).where(which_contact_is_this + '_contact_id',this_contact.contact_id).then(function(result) {
				console.log("Successfully updated contact status for contact: " + this_contact.contact_id + " as: " + new_status);
				res.send(201,{response: "Successfully updated contact_status to:" + new_status});
			}).catch(function(error) {
				console.error("Error updating contact status:", error);
				res.send(501, error);
			});
		}

	}).catch(function(err) {
		console.error("Error handling match response", err);
	});

};

//Utilities to convert database rows of pairs to rows containing person objects
exports.rowsToObjects = function(rows, callback) {
	async.map(rows,rowToObject,callback);
};

//Converts a single row to a person object
var rowToObject = function(match, callback) {
	try {
		var matchObject = conversion(match);
		callback(null,matchObject);
	}
	catch (e) {
		callback(e,null);
	}
};

//Performs the actual conversion...
var conversion = function(match) {
	return {first_matchee:{guessed_full_name: match.first_full_name,image_url:match.first_image, contact_id:match.first_contact_id, guessed_gender: match.first_gender, contact_status:match.first_contact_status, matcher_chat_id: match.first_matcher_chat_id, verified:match.first_verified},
		second_matchee: {guessed_full_name: match.second_full_name,image_url:match.second_image, contact_id:match.second_contact_id, guessed_gender: match.second_gender, contact_status: match.second_contact_status,matcher_chat_id: match.second_matcher_chat_id, verified:match.second_verified},
		matcher:{guessed_full_name: match.matcher_full_name,image_url:match.matcher_image, contact_id:match.matcher_contact_id, guessed_gender: match.matcher_gender},
		pair_id: match.pair_id,
		chat_id: match.chat_id,
		has_unseen: match.has_unseen,
		is_anonymous: match.is_anonymous,
		created_at: match.created_at
	};
}

//Converts a list of IDs to proper format for a SQL string
var idsJSONtoSQL = function(contact_ids) {
	var stringSQL = "(";
	contact_ids.forEach(function(contact) {
		stringSQL = stringSQL + "'" + contact.contact_id + "',";
	});
	return stringSQL.substring(0, stringSQL.length - 1) + ')';
};
