var gcm = require('node-gcm');
var PG = require('./knex');

// create a message with default values
var message = new gcm.Message();

// or with object values
var message = new gcm.Message({
    collapseKey: 'demo',
    delayWhileIdle: true,
    timeToLive: 3,
    data: {
        key1: 'message1',
        key2: 'message2'
    }
});

var sender = new gcm.Sender('AIzaSyDDKjUl2v-V4ehHZba9OxVmQx6_3FYFJjg');
var registrationIds = [];

// At least one required
registrationIds.push('APA91bH7-HUkana7mIYQnmURUzEiGzrpYcxmc5nTPEsXmbP7J4C3zqHNqaOqrlvc25tXOxRWhanI-mARS5ci56Qhkc3A6Xg2ejHvFwqsAEFDeAnzPHwP-tTpG0UMK_XOX4UIfcu_73zvYqM35zz3jCqJu5AD0WWhcg');

/**
 * Params: message-literal, registrationIds-array, No. of retries, callback-function
 **/
sender.send(message, registrationIds, 4, function (err, result) {
    console.log(result);
});

exports.updateRegistrationId = function(req, res) {
    var contact_id = req.body.contact_id;
    var registration_id = req.body.registration_id;

    PG.knex('contacts').where('contact_id',contact_id).update('gcm_registration_id',registration_id).then(function(result) {
        console.log("Successfully added registration Id", result);
    }).catch(function(err) {
        console.error("Error adding GCM registration Id for User " + contact_id, "Reg_id: " + registration_id + " with error: " + err);
    });
};