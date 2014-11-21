var PG = require('./knex');
var gcm = require('./gcm');

exports.sendNotification = function(contact_id, data) {
	//Determine if the contact to notify has Android, iOS, or SMS
	PG.knex('contacts').select('verified','gcm_registration_id','apn_device_token','normalized_phone_number').where('contact_id',contact_id).then(function(result) {
		var contact = result[0];
		console.log("Result from retrieving contact methods: ", result);
		if (!contact.verified) {  //If the contact is not verified
			//Send message via SMS
			//NEED TO IMPLEMENT
		}
		else {
			if(contact.gcm_registration_id) {
				gcm.notify(contact.gcm_registration_id,data);
			}

			if(contact.apn_device_token) {
				//Send iOS push notification
			}
		}	
	}).catch(function(err) {
		console.log("Error notifying the recipient via iOS, android or SMS:", err);
	});
}