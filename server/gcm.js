var gcm = require('node-gcm');
var PG = require('./knex');




var sender = new gcm.Sender('AIzaSyDDKjUl2v-V4ehHZba9OxVmQx6_3FYFJjg');



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

exports.notify = function(data, registration_id) {

    var registrationIds = [];
    // or with object values
    var message = new gcm.Message({
        collapseKey: 'Notifications from Matchflare!',
        delayWhileIdle: false,
        timeToLive: 4,
        data: data
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