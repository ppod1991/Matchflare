var PG = require('./knex');
var gcm = require('./gcm');
var int_encoder = require('int-encoder');

exports.sendNotification = function(contact_id, notification) {
	console.log("Notification to " + contact_id + ": " + notification);
	//Determine if the contact to notify has Android, iOS, or SMS
	PG.knex('contacts').select('verified','gcm_registration_id','apn_device_token','normalized_phone_number').where('contact_id',contact_id).then(function(result) {
		var contact = result[0];
		console.log("Result from retrieving contact methods: ", contact);
		if (!contact.verified) {  //If the contact is not verified...
			//Send message via SMS
			//NEED TO IMPLEMENT
			console.log("MOCK Sending SMS to " + contact_id + ": " + notification.text_message);
		}
		else {
			if(contact.gcm_registration_id) {
				gcm.notify(contact.gcm_registration_id,notification);
				console.log("Sending Google Push Notification to " + contact_id + ": " + notification.push_message);
			}

			if(contact.apn_device_token) {
				console.log("MOCK Sending iOS Push Notification to " + contact_id + ": " + notification.push_message);

				//Send iOS push notification
			}
		}	
	}).catch(function(err) {
		console.log("Error notifying the recipient via iOS, android or SMS:", err);
	});
}

exports.newMatchNotification = function(target_contact_id, text_message, push_message, pair_id) {
	
	var notification = {text_message: text_message, push_message: push_message, notification_type: 'MATCHEE_NEW_MATCH', pair_id: pair_id};

	exports.postNotification(target_contact_id,notification);
};

exports.verifiedMatchNotification = function(pair) {

	var firstGenderPronoun = 'her';
	var secondGenderPronoun = 'her';

	if (pair.first_gender === "MALE") {
		firstGenderPronoun = 'him';
	}
	if (pair.second_gender === 'MALE') {
		secondGenderPronoun = 'him';
	}

	var messageToFirst = pair.second_full_name + " likes you too! Tap to chat with " + secondGenderPronoun + "!";
	var messageToSecond = pair.first_full_name + " likes you too! Tap to chat with " + firstGenderPronoun + "!";
	var messageToMatcher = pair.first_full_name + " and " + pair.second_full_name + " liked each other! Look at you go!";

	var notificationToFirst = {text_message: messageToFirst, push_message:messageToFirst, notification_type: 'MATCHEE_MATCH_ACCEPTED', pair_id: pair.pair_id};
	var notificationToSecond = {text_message: messageToSecond, push_message:messageToSecond, notification_type: 'MATCHEE_MATCH_ACCEPTED', pair_id: pair.pair_id};
	var notificationToMatcher = {text_message: messageToMatcher, push_message:messageToMatcher, notification_type: 'MATCHER_BOTH_ACCEPTED', pair_id: pair.paid_id};

	exports.postNotification(pair.first_contact_id, notificationToFirst);
	exports.postNotification(pair.second_contact_id, notificationToSecond);
	exports.postNotification(pair.matcher_contact_id, notificationToMatcher);
};

exports.otherMatchNotification = function(pair) {

};

exports.postNotification = function(target_contact_id, notification) {

	PG.knex('notifications').insert({target_contact_id: target_contact_id, text_message: notification.text_message, push_message: notification.push_message, notification_type: notification.notification_type, pair_id: notification.pair_id},'notification_id').then(function(result) {
		console.log("Successfully posted notification");
		notification.notification_id = result[0];
		exports.sendNotification(target_contact_id, notification);
	}).catch(function(err) {
		console.error("Error posting new notification: ", err);
	});
}

exports.getNotifications = function(req, res) {
	var target_contact_id = req.query.target_contact_id;
	PG.knex('notifications').where('target_contact_id',target_contact_id).where('seen',false).orderBy('created_at','desc').then(function(result) {
		console.log("Notifications retrieved with result: ", result);
		res.send(201,{notifications: result});
	}).catch(function(err) {
		console.error("Error retrieiving notifications for user: " + contact_id, err);
		res.send(501,err);
	});
};

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