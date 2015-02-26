'use strict';

//Module to handle request related to GCM (Google Cloud Messaging) i.e. Android Push Notifications

//External dependencies
var gcm = require('node-gcm');
var sender = new gcm.Sender(process.env.GCM_KEY);

//Internal dependencies
var PG = require('./knex');

//Updates the specified users GCM Registration ID
exports.updateRegistrationId = function(req, res) {
    var contact_id = req.body.contact_id;
    var registration_id = req.body.registration_id;

    PG.knex('contacts').where('contact_id',contact_id).update('gcm_registration_id',registration_id).then(function(result) {
        console.log("Successfully added registration Id", result);
        res.send(201,{response: "Successfully added registration_id"});
    }).catch(function(err) {
        console.error("Error adding GCM registration Id for User " + contact_id, "Reg_id: " + registration_id + " with error: " + err);
        res.send(500,err.toString());
    });
};

//Send push notification to the specified Google user
exports.notify = function(registration_id, data) {

    var registrationIds = [];
    var encapsulated_data = {data: JSON.stringify(data)};

    var message = new gcm.Message({
        collapseKey: 'Notifications from Matchflare!',
        delayWhileIdle: false,
        timeToLive: 4,
        data: encapsulated_data
    });

    registrationIds.push(registration_id);

    /**
     * Params: message-literal, registrationIds-array, No. of retries, callback-function
     **/
    sender.send(message, registrationIds, 4, function (err, result) {
        if(!err) {
            console.log("GCM Push sent with: ", result);
        }
        else {
            console.error("Error pushing gcm notification: ", err);
        }

    });
}

