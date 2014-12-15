var PG = require('./knex');
var notify = require('./notify');
var int_encoder = require('int-encoder');
var _ = require('lodash');
var async = require('async');

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
					is_anonymous, first_matcher_chat_id, second_matcher_chat_id \
					FROM pairs \
					INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id \
					INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id \
					INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id \
					WHERE pair_id = ? ;",[pair_id]).then(function(result) {
		console.log('Retrieved match with result: ', result.rows);
		var matches = exports.rowsToObjects(result.rows, function(err, results) {
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

exports.makeMatches = function(contact_id, contact_ids, callback) {

	var sqlString;
	var parameterArray;

	if (!contact_id) {
		var ids = idsJSONtoSQL(contact_ids);
		sqlString = "SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_full_name, c1.guessed_gender first_gender, \
						c2.contact_id second_contact_id, c2.guessed_full_name second_full_name, c2.guessed_gender second_gender, \
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
							AND c1.contact_id != ? \
							AND c2.contact_id != ? \
							AND NOT c1.blocked_matches \
							AND NOT c2.blocked_matches \
						ORDER BY pair_score(c1,c2) DESC LIMIT 30"
		parameterArray = [0,0];
	}
	else {
		var ids = "(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?)";

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
							AND NOT c1.blocked_matches \
							AND NOT c2.blocked_matches \
							AND ? NOT IN  \
								(SELECT unnest(c1.blocked_contacts)) \
							AND ? NOT IN  \
								(SELECT unnest(c2.blocked_contacts)) \
						ORDER BY pair_score(c1,c2) DESC LIMIT 30)) WHERE contact_id = ? RETURNING matches"
		parameterArray = [contact_id,contact_id,contact_id,contact_id, contact_id, contact_id, contact_id];
	};
	
	PG.knex.raw(sqlString,parameterArray).then(function(result) {
   			
   			console.log("Result of making matches:", JSON.stringify(result.rows));
   			if (contact_id) {
   				callback(null,null);

   			}
   			else {
   				//just return match types...
   				var matches = exports.rowsToObjects(result.rows, function(err, results) {
   					if(err) {
   						throw err;
   					}
   					else {
   						callback(null,results);
   					}
   				});
   			}
			// var matches = exports.rowsToObjects(result.rows, function(err, results) {
			// 	if(err) {
			// 		throw err;
			// 	}
			// 	else {
			// 		callback(err, results);
			// 	}
			// });
   		}).catch(function(err) {
   			console.error("Error getting matches", err);
   			callback(err,null);
   		});
};

exports.getMatches = function (req, res) {
	var contact_id;
	var second_call = req.second_call; //Variable to check if getMatches has been called before...
	if (req.query.contact_id && req.query.contact_id !== 0) {
		contact_id = req.query.contact_id;
	}
	
	var contact_ids = req.body.contacts;

	if (contact_id) {
		PG.knex.raw("SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_full_name, c1.guessed_gender first_gender, \
						c2.contact_id second_contact_id, c2.guessed_full_name second_full_name, c2.guessed_gender second_gender, \
						c1.image_url first_image, c2.image_url second_image, \
						?::integer matcher_contact_id \
						 FROM (SELECT unnest(matches) AS singleMatch FROM contacts WHERE contact_id=?) matchList \
						 INNER JOIN contacts c1 ON c1.contact_id = (matchList.singleMatch).first_matchee_contact_id \
						 INNER JOIN contacts c2 ON c2.contact_id = (matchList.singleMatch).second_matchee_contact_id;",[contact_id,contact_id])
		.then(function(result) {


			var matches = exports.rowsToObjects(result.rows, function(err, results) {
				if(err) {
					throw err;
				}
				else {
					if (results.length > 0) { //If there are some matches, then send results before making new ones...
						res.send(201,results);
					}
					
					if (results.length === 0 && second_call === true) {  //IF getMatches has been called a second time...
						res.send(501,"No Matches Could be Made");
					}
					else {
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

				}
			});

		}).catch(function(err) {
			console.error("Error getting matches", err.toString());
		});
	}
	else {
		exports.makeMatches(null,contact_ids, function(err, matches) {
			if (err) {
				res.send(501,"Error making matches: " + err.toString());
			} else {
				res.send(201,matches);
			}
		});
	}
}

// exports.getMatches = function(req, res) {
// 	var contact_id = Number(req.query.contact_id);
// 	var contact_ids = req.
// 	PG.knex.raw("SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_full_name, c1.guessed_gender first_gender, c2.contact_id second_contact_id, c2.guessed_full_name second_full_name, c2.guessed_gender second_gender, ?::integer matcher_contact_id \
// 	FROM contacts c1, contacts c2  \
// 		WHERE c1.contact_id IN \
// 			" + sqlString + " \
// 		AND c2.contact_id IN  \
// 			" + sqlString + " \
// 		AND c2.guessed_gender IN  \
// 			(SELECT unnest(c1.gender_preferences))	 \
// 		AND c1.guessed_gender IN  \
// 			(SELECT unnest(c2.gender_preferences))	 \
// 		AND c1.contact_id != c2.contact_id \
// 		AND c1.contact_id != ? \
// 		AND c2.contact_id != ? \
// 	ORDER BY (random()*0.5+1) * (matchflare_score(c1)) DESC LIMIT 30", [contact_id,contact_id,contact_id,contact_id, contact_id])
// 	.then(function(result) {
//    			console.log(result.rows);
// 			var matches = exports.rowsToObjects(result.rows, function(err, results) {
// 				if(err) {
// 					throw err;
// 				}
// 				else {
// 					res.send(201,results);
// 				}
// 			});
//    		}).catch(function(err) {
//    			console.error("Error getting matches", err);
//    			res.send(500, "Error getting matches: " + err.toString());
//    		});
// };

exports.addMatchResult = function(req, res) {

	var match_status = req.body.match_status;
	var first_contact_id = req.body.first_matchee.contact_id;
	var second_contact_id = req.body.second_matchee.contact_id;
	var is_anonymous = req.body.is_anonymous;
	var matcher_contact_id = req.body.matcher.contact_id;

	if (match_status === "FIRST_CONTACT_WINS" || match_status === "SECOND_CONTACT_WINS") { //If one of the contacts chosen rather than matched...
		var eloUpdateValue = 1;
		var orderArray;

		if (match_status === "FIRST_CONTACT_WINS") {
			orderArray = [first_contact_id, second_contact_id];
		}
		else {
			orderArray = [second_contact_id, first_contact_id];
		}
		

		PG.knex.raw("SELECT update_elo_score(?,?)",orderArray).then(function(result) {
			console.log({response:"Elo scores updated"});

			if (matcher_contact_id) {
				PG.knex.raw('UPDATE contacts SET matchflare_score = matchflare_score + ? WHERE contact_id = ? returning matchflare_score;',[eloUpdateValue,matcher_contact_id]).then(function(result) {
					
					res.send(201,result.rows[0].matchflare_score);
					console.log("Successfully updated matchflare score", JSON.stringify(result.rows));
				}).catch(function(err) {
					console.error("Error in updating the matchflare score", err);
					res.send(501,"Error updating matchflare score: " + err);
				});
			}
			else {
				res.send(201,0);
			}

		}).catch(function(err) {
			console.error("Error updating elo score");
			res.send(501,'Error updating elo score');
		});


		//notify.sendNotification(90,{text_message:"ELO SCORES WOOT"});
		
	}
	else if (match_status === "MATCHED") {
		//If matched...

		var matchUpdateValue = 10;
		//Determine who to send first text to...
		PG.knex('contacts').select('guessed_gender','guessed_full_name').where('contact_id',matcher_contact_id).then(function(result) {
				var matcher = result[0];
				matcher.contact_id = matcher_contact_id;
				// var matcher_full_name = result[0].guessed_full_name;
				// var matcherGenderPronoun = 'her';

				// if (result[0].guessed_gender === "MALE") {
				// 	matcherGenderPronoun = 'his';
				// }

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

						//Insert new match

						PG.knex('chats').insert([{first_contact_id: firstRecipient.contact_id, second_contact_id: secondRecipient.contact_id},{matcher_contact_id:matcher_contact_id, first_contact_id: firstRecipient.contact_id},{matcher_contact_id:matcher_contact_id, second_contact_id: secondRecipient.contact_id}],'chat_id').then(function(result) {

							var chat_id = result[0];
							var first_matcher_chat_id = result[1];
							var second_matcher_chat_id = result[2];

							PG.knex('pairs').insert({first_contact_id: firstRecipient.contact_id, chat_id: chat_id, second_contact_id: secondRecipient.contact_id, matcher_contact_id: matcher_contact_id, is_anonymous: is_anonymous, first_matcher_chat_id: first_matcher_chat_id, second_matcher_chat_id: second_matcher_chat_id},'pair_id').then(function(result) {
								var pair_id = result[0];

								// var recipientGenderPronoun = 'UNKNOWN';
								// if (secondRecipient.guessed_gender === "MALE") {
								// 	recipientGenderPronoun = 'him';
								// }
								// else if (secondRecipient.guessed_gender === "FEMALE") {
								// 	recipientGenderPronoun = 'her';
								// }

								// var text_message;
								// var push_message;
								// if (is_anonymous) {
								// 	text_message = firstRecipient.guessed_full_name.split(" ")[0] + "! Your friend thinks you’d hit it off with " + matcherGenderPronoun + " pal, " + secondRecipient.guessed_full_name + ".";
								// 	push_message = "Your friend matched you with " + matcherGenderPronoun + " friend, " + secondRecipient.guessed_full_name  + ". Tap to message " + recipientGenderPronoun + ".";
								// }
								// else {
								// 	text_message = firstRecipient.guessed_full_name.split(" ")[0] + "! " + matcher_full_name + " thinks you’d hit it off with " + matcherGenderPronoun + " pal, " + secondRecipient.guessed_full_name + ".";
								// 	push_message = matcher_full_name + " matched you with " + matcherGenderPronoun + " friend, " + secondRecipient.guessed_full_name + ". Tap to message " + recipientGenderPronoun + ".";

								// }

								// var matchURL = "matchflare.herokuapp.com/m/" + int_encoder.encode(pair_id);
								// text_message = text_message + " See " + recipientGenderPronoun + " and learn more at " + matchURL + ". Text SAD to stop new matches";
								console.log("Successfully inserted match with pair_id: ", result);
								notify.newMatchNotification(firstRecipient, secondRecipient, matcher, is_anonymous, pair_id, 'first');

								PG.knex.raw('UPDATE contacts SET matchflare_score = matchflare_score + ? WHERE contact_id = ? returning matchflare_score;',[matchUpdateValue,matcher_contact_id]).then(function(result) {
									res.send(201,result.rows[0].matchflare_score);
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

		


		// var first_elo_score = req.body.first_elo_score;
		// var second_elo_score = req.body.second_elo_score;
		// var first_elo_count = req.body.first_elo_count;
		// var second_elo_count = req.body.second_elo_count;

		// var tenFactor = 400;
		// var Q_first = Math.pow(10,first_elo_score/tenFactor);
		// var Q_second = Math.pow(10,second_elo_score/tenFactor);
		// var E_first = Q_first/(Q_first + Q_second);
		// var E_second = Q_second/(Q_first + Q_second);
		// var k_first = 16 + (16*Math.exp(-1*first_elo_count/4));
		// var k_second = 16 + (16*Math.exp(-1*second_elo_count/4));

		// var S_first, S_second;
		// if (match_status === "first_contact") {
		// 	S_first = 1;
		// 	S_second = 0;
		// }
		// else {
		// 	S_first = 0;
		// 	S_second = 1;
		// }

		// var new_first_elo_score = first_elo_score + k_first * (S_first - E_first);
		// var new_second_elo_score = second_elo_score + k_second * (S_second - E_second);
	}
	
};

//The function called when someone accepts/rejects a potential match
exports.respondToMatchRequest = function(req, res) {
	//console.log("Request:", req);
	var decision = req.body.decision;
	var contact_id = req.body.contact_id;
	var pair_id = req.body.pair_id;

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
		//If the match was accepted
		if (decision === 'ACCEPT') {
			new_status = 'ACCEPT';
			if (other_contact.contact_status === 'ACCEPT') { //If the other matchee also accepted, then create a new chat and notify all parties
				//New verified match!
				notify.verifiedMatchNotification(pair, this_contact, other_contact, pair.matcher);
			}
			else { //If the other matchee has not yet been notified, then notify the other matchee and the matcher
				notify.otherMatchNotification(pair, this_contact, other_contact, pair.matcher, which_contact_is_this);
			}
		}
		else if (decision === 'REJECT') { //If the match was rejected, then change status
			new_status = 'REJECT';
		}

		if (new_status) {  //Update the status of this matchee
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

exports.rowsToObjects = function(rows, callback) {

	async.map(rows,rowToObject,callback);
};

var rowToObject = function(match, callback) {

	try {
		var matchObject = conversion(match);
		callback(null,matchObject);
	}
	catch (e) {
		callback(e,null);
	}

};

var idsJSONtoSQL = function(contact_ids) {
	var stringSQL = "(";
	contact_ids.forEach(function(contact) {
		stringSQL = stringSQL + "'" + contact.contact_id + "',"; 
	});
	return stringSQL.substring(0, stringSQL.length - 1) + ')';
};

var conversion = function(match) {
	return {first_matchee:{guessed_full_name: match.first_full_name,image_url:match.first_image, contact_id:match.first_contact_id, guessed_gender: match.first_gender, contact_status:match.first_contact_status, matcher_chat_id: match.first_matcher_chat_id},
		second_matchee: {guessed_full_name: match.second_full_name,image_url:match.second_image, contact_id:match.second_contact_id, guessed_gender: match.second_gender, contact_status: match.second_contact_status,matcher_chat_id: match.second_matcher_chat_id},
		matcher:{guessed_full_name: match.matcher_full_name,image_url:match.matcher_image, contact_id:match.matcher_contact_id, guessed_gender: match.matcher_gender},
		pair_id: match.pair_id,
		chat_id: match.chat_id,
		has_unseen: match.has_unseen,
		is_anonymous: match.is_anonymous,
		created_at: match.created_at
	};
}
// var req = {query:{contact_id: 90}}
// exports.getMatches(req);

// var req = {body:{first_contact_id:93, second_contact_id:92, match_status:"FIRST_CONTACT_WINS", matcher_contact_id:90, is_anonymous:false}};
// var res = {send:function(a){}};

// exports.addMatchResult(req,res);

//exports.addMatchResult()
