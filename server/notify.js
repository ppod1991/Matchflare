var PG = require('./knex');
var gcm = require('./gcm');
var int_encoder = require('int-encoder');

exports.sendNotification = function(contact_id, notification) {

	//Determine if the contact to notify has Android, iOS, or SMS
	PG.knex('contacts').select('verified','gcm_registration_id','apn_device_token','normalized_phone_number').where('contact_id',contact_id).then(function(result) {
		var contact = result[0];
		console.log("Result from retrieving contact methods: ", contact);
		if (!contact.verified) {  //If the contact is not verified...
			//Send message via SMS
			//NEED TO IMPLEMENT
			console.log("Contact not verified, sending SMS");
		}
		else {
			if(contact.gcm_registration_id) {
				gcm.notify(contact.gcm_registration_id,notification);
			}

			if(contact.apn_device_token) {
				//Send iOS push notification
			}
		}	
	}).catch(function(err) {
		console.log("Error notifying the recipient via iOS, android or SMS:", err);
	});
}

exports.newMatchNotification = function(target_contact_id, baseMessage, pair_id) {
	
	var matchURL = "matchflare.com/m/" + int_encoder.encode(pair_id);
	var text_message = baseMessage + " See " + recipientGenderPronoun + " and learn more at " + matchURL + ". Text SAD to stop new matches";
	var notification = {text_message: text_message, push_message: baseMessage, notification_type: 'MATCHEE_NEW_MATCH', pair_id: pair_id};

	exports.postNotification(target_contact_id,notification);
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