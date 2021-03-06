'use strict';

//Module to handle requests about sending SMS, GCM, and APNS notifications as well as info about existing notifications

//External dependencies
var int_encoder = require('int-encoder');
var _ = require('lodash');

//Internal dependencies
var PG = require('./knex');
var gcm = require('./gcm');
var apns = require('./apns');
var Matches = require('./matches');
var sms = require('./sms');

//Determines the best mode of communication and sends the specified notification to the specified contact
exports.sendNotification = function(contact_id, notification) {

	console.log("Notification to " + contact_id + ": " + notification);

	//Determine if the contact to notify has Android, iOS, or SMS
	PG.knex('contacts').select('verified','gcm_registration_id','apn_device_token','normalized_phone_number','did_block_sms','blocked_contacts').where('contact_id',contact_id).then(function(result) {

		var contact = result[0];
		console.log("Result from retrieving contact methods: ", contact);

		if (!contact.verified) {  //If the contact is not verified, then try SMS

			if (contact.did_block_sms) { //If the contact block SMS messages, then do not send
				console.log("User: " + contact_id + " blocked SMS. Could not send: " + notification.text_message);
			}
			else if (_.contains(contact.blocked_contacts,notification.sender_contact_id)) { //If the contact blocked this specific Matcher
				console.log("User: " + contact_id + " blocked sender " + notification.sender_contact_id + ". Could not send: " + notification.text_message);
			}
			else {

				if (notification.notification_type==="MATCHEE_NEW_MATCH") { //Send Nexmo custom Alert SMS
					//sms.sendNewMatchSMS(contact.normalized_phone_number,notification.extras); //DISABLED FOR NOW
				}
				else { //Send generic notification SMS
					console.log("MOCK Sending SMS to " + contact_id + ": " + notification.text_message);
				}
			}
		} else { //If the contact is verified...
			if(contact.gcm_registration_id) { //If they have a GCM registration ID...
				gcm.notify(contact.gcm_registration_id,notification);
				console.log("Sending Google Push Notification to " + contact_id + ": " + notification.push_message);
			}

			if(contact.apn_device_token) { //If they have a APN Device Token...
				console.log("Sending iOS Push Notification to " + contact_id + ": " + notification.push_message);
				apns.notify(contact.apn_device_token,notification); //Send iOS push notification
			}
		}	
	}).catch(function(err) {
		console.log("Error notifying the recipient via iOS, android or SMS:", err);
	});
};


//Generates and sends the notification when a new Match occurs
exports.newMatchNotification = function(toNotifyRecipient, otherRecipient, matcher, is_anonymous, pair_id, which_contact) {

	//Determine appropriate gender pronouns for the matcher and receipient
	var recipientGenderPronoun = 'him/her';
	if (otherRecipient.guessed_gender === "MALE") {
		recipientGenderPronoun = 'him';
	}
	else if (otherRecipient.guessed_gender === "FEMALE") {
		recipientGenderPronoun = 'her';
	}

	var matcherGenderPronoun = 'his/her';

	if (matcher.guessed_gender === "MALE") {
		matcherGenderPronoun = 'his';
	}
	else if (matcher.guessed_gender === "FEMALE") {
		matcherGenderPronoun = 'her';
	}

	var text_message;
	var push_message;

	var extras = {}; //For filling out NEXMO alert template

	var matchURL = "matchflare.com/m/" + int_encoder.encode(pair_id); //Matchflare Pair URL sent in SMS

	if (is_anonymous) { //If the match is anonymous...
		text_message = toNotifyRecipient.guessed_full_name.split(" ")[0] + "! Your friend thinks you’d hit it off with " + matcherGenderPronoun + " pal, " + otherRecipient.guessed_full_name + ".";
		push_message = "Your friend matched you with " + matcherGenderPronoun + " friend, " + otherRecipient.guessed_full_name  + ". Tap to message " + recipientGenderPronoun + "."; 

		extras.targetName = toNotifyRecipient.guessed_full_name.split(" ")[0];
		extras.matcherPronoun = matcherGenderPronoun;
		extras.otherRecipientName = otherRecipient.guessed_full_name;
		extras.recipientPronoun = recipientGenderPronoun;
		extras.matchURL = matchURL;
		extras.template = 1; //Anonymous NEXMO message template
	}
	else { //If the match is not anonymous...
		text_message = toNotifyRecipient.guessed_full_name.split(" ")[0] + "! " + matcher.guessed_full_name + " thinks you’d hit it off with " + matcherGenderPronoun + " pal, " + otherRecipient.guessed_full_name + ".";
		push_message = matcher.guessed_full_name + " matched you with " + matcherGenderPronoun + " friend, " + otherRecipient.guessed_full_name + ". Tap to message " + recipientGenderPronoun + "."; 
	
		extras.targetName = toNotifyRecipient.guessed_full_name.split(" ")[0];
		extras.matcherName = matcher.guessed_full_name;
		extras.matcherPronoun = matcherGenderPronoun;
		extras.otherRecipientName = otherRecipient.guessed_full_name;
		extras.recipientPronoun = recipientGenderPronoun;
		extras.matchURL = matchURL;
		extras.template = 2; //Non-anonymous NEXMO message template
	}

	text_message = text_message + " See " + recipientGenderPronoun + " and learn more at " + matchURL + ". Text SAD to stop new matches"; //Append URL to text message
	var notification = {text_message: text_message, push_message: push_message, notification_type: 'MATCHEE_NEW_MATCH', pair_id: pair_id, extras: extras};

	exports.postNotification(toNotifyRecipient.contact_id,notification,matcher.contact_id);  //Send the notification!

	//Update the status of the recipient in the pair
	var new_status_object = {};
	var new_status = 'NOTIFIED';

	new_status_object[which_contact + "_contact_status"] = new_status;
	PG.knex('pairs').update(new_status_object).where('pair_id',pair_id).then(function(result) {
		console.log("Successfully updated contact status for contact: " + toNotifyRecipient.contact_id + " as: " + new_status);
	}).catch(function(error) {
		console.error("Error updating contact status:", error);
	});
};

//Generates and sends notifications for when second matchee in pair accepts
exports.verifiedMatchNotification = function(pair, first, second, matcher) {

	//Determine appropriate gender pronouns for message
	var firstGenderPronoun = 'him/her';
	var secondGenderPronoun = 'him/her';

	if (first.guessed_gender === "MALE") {
		firstGenderPronoun = 'him';
	}
	else if (first.guessed_gender === "FEMALE") {
		firstGenderPronoun = 'her';
	}

	if (second.guessed_gender === 'MALE') {
		secondGenderPronoun = 'him';
	}
	else if (second.guessed_gender === 'FEMALE') {
		secondGenderPronoun = 'her';
	}

	//Generates strings for each relevant recipient
	var messageToFirst = second.guessed_full_name + " likes you too! Tap to chat with " + secondGenderPronoun + "!";
	var messageToSecond = first.guessed_full_name + " likes you too! Tap to chat with " + firstGenderPronoun + "!";
	var messageToMatcher = first.guessed_full_name + " and " + second.guessed_full_name + " just liked each other! Look at you go!";

	//Creates notifications for each recipient
	var notificationToFirst = {text_message: messageToFirst, push_message:messageToFirst, notification_type: 'MATCHEE_MATCH_ACCEPTED', pair_id: pair.pair_id, chat_id: pair.chat_id};
	var notificationToSecond = {text_message: messageToSecond, push_message:messageToSecond, notification_type: 'MATCHEE_MATCH_ACCEPTED', pair_id: pair.pair_id, chat_id: pair.chat_id};
	var notificationToMatcher = {text_message: messageToMatcher, push_message:messageToMatcher, notification_type: 'MATCHER_BOTH_ACCEPTED', pair_id: pair.pair_id};

	//Sends the notifications!
	exports.postNotification(first.contact_id, notificationToFirst,matcher.contact_id);
	exports.postNotification(second.contact_id, notificationToSecond,matcher.contact_id);
	exports.postNotification(matcher.contact_id, notificationToMatcher,matcher.contact_id);
};

//Generates matcher and second matchee notification after first matchee responds
exports.otherMatchNotification = function(pair, first, second, matcher, which_contact) {

	//Generate notification strings
	var messageToMatcher = first.guessed_full_name + " just accepted your match. Next up--" + second.guessed_full_name + ". Let's see what happens!";
	var notificationToMatcher = {text_message: messageToMatcher, push_message:messageToMatcher, notification_type: 'MATCHER_ONE_MATCH_ACCEPTED', pair_id: pair.pair_id};

	exports.postNotification(matcher.contact_id, notificationToMatcher, matcher.contact_id); //Send matcher notification

	//Determine which contact is the second recipient
	var other_contact;
	if (which_contact === 'first') {
		other_contact = 'second';
	}
	else if (which_contact === 'second') {
		other_contact = 'first';
	}

	exports.newMatchNotification(second, first, matcher, pair.is_anonymous, pair.pair_id, other_contact); //Send second matchee notification
};

//Inserts the notification to the database and sends it
exports.postNotification = function(target_contact_id, notification, sender_contact_id) {

	PG.knex('notifications').insert({sender_contact_id: sender_contact_id, target_contact_id: target_contact_id, text_message: notification.text_message, push_message: notification.push_message, notification_type: notification.notification_type, pair_id: notification.pair_id, chat_id: notification.chat_id},'notification_id').then(function(result) {
		console.log("Successfully posted notification");
		notification.notification_id = result[0];
		notification.sender_contact_id = sender_contact_id;
		notification.target_contact_id = target_contact_id;
		exports.sendNotification(target_contact_id, notification);
	}).catch(function(err) {
		console.error("Error posting new notification: ", err);
	});
};

//Retrieves the unseen notifications for the target user
exports.getNotifications = function(req, res) {
	var target_contact_id = req.query.target_contact_id;
	PG.knex('notifications').where('target_contact_id',target_contact_id).where('seen',false).orderBy('created_at','desc').then(function(result) {
		console.log("Notifications retrieved with result: ", result);
		res.send(201,{notifications: result});
	}).catch(function(err) {
		console.error("Error retrieving notifications for user: " + contact_id, err);
		res.send(501,err);
	});
};

//Gets the notifications, pending matches, and active matcher matches for the current user
exports.getNotificationLists = function(req, res) {
	var contact_id = req.query.contact_id;
	var objectToReturn = {}; //Object that contains the notification lists

	//Get the unseen notifications (sorted by date)
	PG.knex('notifications').where('target_contact_id',contact_id).where('seen',false).orderBy('created_at','desc').then(function(result) {

		console.log("Unseen Notifications retrieved with result: ", result);
		objectToReturn.notifications = result;

		//Get matches where this user needs to respond or where this user and the other matchee both accepted. Sort by the most recent activity in the match--with pairs with unseen messages first
		PG.knex.raw("SELECT * FROM \
				( \
				(SELECT c1.first_seen_at matcher_seen_at, c2.first_seen_at main_seen_at, c2.chat_id main_chat_id, c1.chat_id matcher_chat_id, pairs.updated_at, \
					pairs.chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name,  \
					matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender,  \
					matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id,  \
					first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id  \
				FROM pairs \
				LEFT OUTER JOIN chats c1 ON pairs.first_matcher_chat_id = c1.chat_id \
				LEFT OUTER JOIN chats c2 ON pairs.chat_id = c2.chat_id \
				INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id  \
				INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id  \
				INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id  \
				WHERE first.contact_id = ? AND ( \
					(first_contact_status = 'NOTIFIED') OR \
					(first_contact_status = 'ACCEPT' AND second_contact_status = 'ACCEPT'))) \
				UNION \
				(SELECT c1.second_seen_at matcher_seen_at, c2.second_seen_at main_seen_at, c2.chat_id main_chat_id, c1.chat_id matcher_chat_id, pairs.updated_at, \
					pairs.chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name,  \
					matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender,  \
					matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id,  \
					first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id  \
				FROM pairs \
				LEFT OUTER JOIN chats c1 ON pairs.second_matcher_chat_id = c1.chat_id \
				LEFT OUTER JOIN chats c2 ON pairs.chat_id = c2.chat_id \
				INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id  \
				INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id  \
				INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id  \
				WHERE second.contact_id = ? AND ( \
					(second_contact_status = 'NOTIFIED') OR \
					(first_contact_status = 'ACCEPT' AND second_contact_status = 'ACCEPT')))) pending_matches \
				LEFT JOIN LATERAL  \
					(SELECT (min(time_diff) < interval '0 seconds' AND NOT min(time_diff) ISNULL) has_unseen FROM  \
						((SELECT pending_matches.matcher_seen_at - max(m1.created_at) time_diff FROM messages m1 \
							WHERE m1.chat_id = pending_matches.matcher_chat_id GROUP BY m1.chat_id) \
						UNION  \
						(SELECT pending_matches.main_seen_at - max(m2.created_at) time_diff FROM messages m2 \
							WHERE m2.chat_id = pending_matches.main_chat_id GROUP BY m2.chat_id)) s \
						) p2 ON true \
				ORDER BY has_unseen DESC, pending_matches.updated_at DESC;",[contact_id, contact_id]).then(function(result) {

			console.log("Pending Matches Successfully retrieved: ", result.rows);

			Matches.rowsToObjects(result.rows, function (err, pending_matches) { //Convert these pairs to objects
				if (err) {
					throw err;
				}
				objectToReturn.pending_matches = pending_matches;

				//Get matches where this user is the matcher and neither of the recipient have rejected it yet. Sort it by most recently updated pair (included pairs with unseen chats)
				PG.knex.raw(" \
					SELECT * FROM  \
						(SELECT c1.matcher_seen_at first_seen_at, c2.matcher_seen_at second_seen_at, pairs.updated_at, \
							pairs.chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name,  \
							matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender,  \
							matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id,  \
							first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id  \
						FROM pairs \
						LEFT OUTER JOIN chats c1 ON pairs.first_matcher_chat_id = c1.chat_id \
						LEFT OUTER JOIN chats c2 ON pairs.second_matcher_chat_id = c2.chat_id \
						INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id  \
						INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id  \
						INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id  \
						WHERE pairs.matcher_contact_id = ? \
							AND ((pairs.first_contact_status = 'NOTIFIED' AND pairs.second_contact_status = 'ACCEPT')  \
							OR (pairs.first_contact_status = 'NOTIFIED' AND pairs.second_contact_status = 'NOT_SENT')  \
							OR (pairs.first_contact_status = 'NOT_SENT' AND pairs.second_contact_status = 'NOTIFIED')  \
							OR (pairs.first_contact_status = 'ACCEPT' AND pairs.second_contact_status = 'NOTIFIED')  \
							OR (pairs.first_contact_status = 'ACCEPT' AND pairs.second_contact_status = 'ACCEPT')) \
						) pending_matches \
					LEFT JOIN LATERAL  \
						(SELECT (min(time_diff) < interval '0 seconds' AND NOT min(time_diff) ISNULL) has_unseen FROM  \
							((SELECT pending_matches.first_seen_at - max(m1.created_at) time_diff FROM messages m1 \
								WHERE m1.chat_id = pending_matches.first_matcher_chat_id GROUP BY m1.chat_id) \
							UNION  \
							(SELECT pending_matches.second_seen_at - max(m2.created_at) time_diff FROM messages m2 \
								WHERE m2.chat_id = pending_matches.second_matcher_chat_id GROUP BY m2.chat_id)) s \
							) p2 ON true \
					ORDER BY has_unseen DESC, pending_matches.updated_at DESC; \
					", [contact_id]).then(function (result) {

						Matches.rowsToObjects(result.rows, function (err, active_matcher_matches) { //Convert these pairs to objects
							if (err) {
								throw err;
							}
							objectToReturn.active_matcher_matches = active_matcher_matches;
							console.log("Object To Return", JSON.stringify(objectToReturn));
							res.send(201, objectToReturn);
						});
				}).catch(function (err) {
					console.error("Error getting active matcher matches: ", err);
					res.send(501, err);
				});
			});
		}).catch(function(err) {
			console.error("Error getting pending matches: ", err);
			res.send(501,err);
		});
	}).catch(function(err) {
		console.error("Error retrieiving notifications for user: " + contact_id, err);
		res.send(501,err);
	});
};

//Check if a given chat has unread messages for the given user
exports.hasUnreadMessages = function(req, res) {
	var chat_id = req.query.chat_id;
	var contact_id = req.query.contact_id;

	PG.knex.raw("SELECT \
		CASE 	 \
			WHEN c.matcher_contact_id = ? THEN c.matcher_seen_at - last_time < interval '0 seconds' \
			WHEN c.first_contact_id = ? THEN c.first_seen_at - last_time < interval '0 seconds' \
			WHEN c.second_contact_id = ? THEN c.second_seen_at - last_time < interval '0 seconds' \
	 	END has_unseen \
	 FROM (SELECT *,(SELECT max(messages.created_at) AS last_time FROM messages WHERE messages.chat_id = ?) FROM chats WHERE chat_id = ?) c",[contact_id,contact_id,contact_id,chat_id,chat_id]).then(function(result) {
	 	var hasUnseen = (result.rows[0].has_unseen === true);
	 	var responseObject = {has_unseen:hasUnseen};
	 	console.log("Successfully checked if unread: ",JSON.stringify(responseObject));
	 	res.send(201,responseObject);
	 }).catch(function(err) {
	 	console.error("Error checking unread status of this chat",JSON.stringify(err));
	 	res.send(501,err.toString());
	 });
};

//Marks a notification as seen
exports.markAsSeen = function(req, res) {
	var notification_id = req.query.notification_id;
	PG.knex.raw("UPDATE notifications SET seen=TRUE, seen_at=timezone('utc'::text, now()) WHERE notification_id = ?", notification_id).then(function(result) {
		console.log("Successfully marked as seen");
		res.send(201,{response: "Successfully marked as seen"});
	}).catch(function(err) {
		console.log("Error marking notification as seen", err);
		res.send(501,err);
	});
}