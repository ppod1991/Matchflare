//Module to handle apple push notification registration and notification delivery

var apn = require('apn');
var PG = require('./knex');

//NEED TO IMPLEMENT -- CHANGE DEVELOPMENT CERTIFICATE TO PRODUCTION CERTIFICATE

var options = {cert:__dirname + '/developmentCertificates/cert.pem',key: __dirname + '/developmentCertificates/key.pem'};
console.log("Certificate locations: ", JSON.stringify(options));

var apnConnection = new apn.Connection(options);

apnConnection.on('connected', function() {
    console.log("Connected");
});

apnConnection.on('transmitted', function(notification, device) {
    console.log("Notification transmitted to:" + device.token.toString('hex'));
});

apnConnection.on('transmissionError', function(errCode, notification, device) {
    console.error("Notification caused error: " + errCode + " for device ", device, notification);
    if (errCode == 8) {
        console.log("A error code of 8 indicates that the device token is invalid. This could be for a number of reasons - are you using the correct environment? i.e. Production vs. Sandbox");
    }
});

apnConnection.on('timeout', function () {
    console.log("Connection Timeout");
});

apnConnection.on('disconnected', function() {
    console.log("Disconnected from APNS");
});

apnConnection.on('socketError', console.error);

exports.updateRegistrationId = function(req, res) {
    var contact_id = req.body.contact_id;
    var apn_device_token = req.body.apn_device_token;

    PG.knex('contacts').where('contact_id',contact_id).update('apn_device_token',apn_device_token).then(function(result) {
        console.log("Successfully updated apn device token", result);
        res.send(201,{response: "Successfully added device token"});
    }).catch(function(err) {
        console.error("Error adding APN device token for User " + contact_id, "Device token: " + apn_device_token + " with error: " + err);
        res.send(500,err.toString());
    });
};

exports.notify = function(apn_device_token, data) {

	var myDevice = new apn.Device(apn_device_token);
    var registrationIds = [];
    var encapsulated_data = {data: JSON.stringify(data)};
    // or with object values

    var note = new apn.Notification();

    var notificationTitle = "Matchflare Notification!";
    if (encapsulated_data.notification_type) {
        if (encapsulated_data.notification_type === "USER_REMINDER") {
            notificationTitle = "What do you think of them?";
        }
        else if (encapsulated_data.notification_type === "MATCHER_ONE_MATCH_ACCEPTED") {
            notificationTitle = "Match Accepted!";
        }
        else if (encapsulated_data.notification_type === "MATCHER_MESSAGING_STARTED") {
            notificationTitle = "They started talking!";
        }
        else if (encapsulated_data.notification_type === "MATCHER_QUESTION_ASKED") {
            notificationTitle = "New Question?";
        }
        else if (encapsulated_data.notification_type === "MATCHEE_NEW_MATCH") {
            notificationTitle = "New Match!";
        }
        else if (encapsulated_data.notification_type === "MATCHEE_MATCH_ACCEPTED") {
            notificationTitle = "Match made!";
        }
        else if (encapsulated_data.notification_type === "MATCHEE_QUESTION_ANSWERED") {
            notificationTitle = "Question Answered!";
        }
        else if (encapsulated_data.notification_type === "MATCHEE_MESSAGE_SENT") {
            notificationTitle = "New Message!";
        }
    }
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    note.badge = 1;
    note.alert = notificationTitle ? notificationTitle : encapsulated_data.push_message;
    note.payload = encapsulated_data;

    apnConnection.pushNotification(note, myDevice);
}