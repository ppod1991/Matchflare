var request = require('request-json');
var nexmo = request.newClient('https://rest.nexmo.com');
var utils = require('./utils');
var PG = require('./knex');

exports.sendSMS = function(phone_number, message, ignoreBlock) {
	
	utils.normalizedPhoneNumber(phone_number,function(err,normalized_phone_number) {

		if (err) {
			console.log("Invalid phone number. Can not send SMS");
		}
		else {
			PG.knex('blocked_phone_numbers').count('blocked_phone_number_id').where('normalized_phone_number',normalized_phone_number).then(function(result) {
				console.log("Count:", result[0].count);
				if (ignoreBlock || result[0].count < 1) {
					//Phone number not found in 'blocked phone number list'...
					var data = {text: message, api_key: '54de0318', api_secret: 'd21d277d', from: '12069396519', to: normalized_phone_number.replace(/\+/g, '')};
					console.log("Sending SMS with data:", JSON.stringify(data));
					nexmo.post('/sms/json', data, function(err, res, body) {
					 	console.log("Sent text message", JSON.stringify(body));
					});
				}
				else {
					console.log("Phone number found in blocked phone numbers list. Can not contact");
				}
			});
		}
	});
	
};

exports.receiveSMS = function(req, res) {
	var phone_number = req.query.msisdn;
	var to = req.query.to;
	var message_id = req.query.messageId;
	var message_timestamp = req.query.message_timestamp;
	var type = req.query.type;
	if (type === 'text') {
		var text = req.query.text;
			console.log("Received SMS from: " + phone_number + " at " + message_timestamp + " saying: " + text);

		var keyword = req.query.keyword;
		if (utils.contains(text,'stop') || utils.contains(text,'sad')) {
			//Stop incoming text messages
			var phone_number = utils.normalizedPhoneNumber(phone_number,function(err,normalized_phone_number) {
				if (err) {
					console.log("Could not parse phone number because: " + JSON.stringify(err));
				}
				else {
					PG.knex('contacts').update({'did_block_sms':true}).where('normalized_phone_number',normalized_phone_number).returning('contact_id').then(function(result) {
						if (result.length < 1) {
							//If no users were found with this phone number, then add to global block list
							PG.knex('blocked_phone_numbers').insert({normalized_phone_number:normalized_phone_number}).then(function(result) {
								console.log("Could not find your phone number, but successfully added number to blocked phone numbers");
								exports.sendSMS(normalized_phone_number,"Thanks! You will no longer receive messages from Matchflare. Reply UNDO to undo or contact help@matchflare.com for help.", true);
							}).catch(function(err) {
								console.error("Could not insert phone number to block phone number list",JSON.stringify(err));
								exports.sendSMS(normalized_phone_number,"We had some trouble removing your phone number. Contact help@matchflare.com if you continue to get texts",true);
							});
						}
						else {
							console.log("Successfully unsubscribed.");
							exports.sendSMS(normalized_phone_number,"Got it. You won't get more matches. You can still set-up your own friends at matchflare.com/app. Text UNDO to undo...you never know who you'll meet.",false);
						}	
					}).catch(function(err) {
						console.error("Error unsubscribing the user",JSON.stringify(err));
						PG.knex('blocked_phone_numbers').insert({normalized_phone_number:normalized_phone_number}).then(function(result) {
							console.log("2 Could not find your phone number, but successfully added number to blocked phone numbers");
							exports.sendSMS(normalized_phone_number,"Thanks! You will no longer receive messages from Matchflare. Reply UNDO to undo or contact help@matchflare.com for help.", true);
						}).catch(function(err) {
							console.error("2 Could not insert phone number to block phone number list",JSON.stringify(err));
							exports.sendSMS(normalized_phone_number,"We had some trouble removing your phone number. Contact help@matchflare.com if you continue to get texts",true);
						});
					});
				}
			});
		}
		else if (utils.contains(text,'back') || utils.contains(text,'undo')) {
			//Rejoin the user
			var phone_number = utils.normalizedPhoneNumber(phone_number,function(err,normalized_phone_number) {
				if (err) {
					console.log("Could not parse phone number because: " + JSON.stringify(err));
				}
				else {
					PG.knex('contacts').update({'did_block_sms':false}).where('normalized_phone_number',normalized_phone_number).returning('contact_id').then(function(result) {
						if (result.length < 1) {
							//Did not find anyone with this number
							PG.knex('blocked_phone_numbers').delete().where('normalized_phone_number',normalized_phone_number).then(function(result) {
								console.log("Successfully removed your number from our blocked phone numbers");
								exports.sendSMS(normalized_phone_number,"Thanks! You'll start receiving matches from Matchflare. Reply STOP to stop matches or contact help@matchflare.com for help", true);
							}).catch(function(err) {
								console.error("Could not remove phone number from blocked phone number list",JSON.stringify(err));
								exports.sendSMS(normalized_phone_number,"We had some trouble resubscribing you. Download the app at matchflare.com/app or contact help@matchflare.com",true);
							});
						}
						else {
							console.log("Successfully resubscribed.");
							exports.sendSMS(normalized_phone_number,"You're back! You'll continue to receive matches! Get more matches and match your own friends using the app at matchflare.com/app",false);
						}
						
					}).catch(function(err) {
						console.log("Could not resubscribe. Please download the matchflare app at matchflare.com",JSON.stringify(err));
						exports.sendSMS(normalized_phone_number,"We couldn't resubscribe you. Please download the app at matchflare.com/app to join or contact help@matchflare.com",false);
					});
				}
			})
		}
		else {
			//If the message did not have 'STOP' or 'UNDO' (or variants), then check if we have the number registered. If not, then block it. 
			var phone_number = utils.normalizedPhoneNumber(phone_number,function(err,normalized_phone_number) {
				if (err) {
					console.log("Could not parse phone number because: " + JSON.stringify(err));
				}
				else {
					PG.knex('contacts').count('contact_id').where('normalized_phone_number',normalized_phone_number).then(function(result) {
						var count = result[0].count;
						if (count < 1) {
							//Phone number not registered, add to do not contact list!
							PG.knex('blocked_phone_numbers').insert({normalized_phone_number:normalized_phone_number}).then(function(result) {
								console.log("Could not find your phone number, we added this number to blocked phone numbers");
							}).catch(function(err) {
								console.error("Could not insert the unknown phone number to block phone number list",JSON.stringify(err));
							});
						}
						else {
							console.log("We don't do anything to this incoming message from an existing user");
						}
					}).catch(function(err) {
						console.log("Could not check if this phone number was in our contacts list.",JSON.stringify(err));
					});
				}
			})
		};
	}

	res.send(200,{});
}
