var PG = require('./knex');
var Phone = require('libphonenumber');
var notify = require('./notify');
var _ = require('lodash');
var Matches = require('./matches');
var sms = require('./sms');
var contact = require('./contact');
var utils = require('./utils');

exports.getPicture = function(req, res) {
    var rawPhoneNumber = req.query.phone_number;
    Phone.e164(rawPhoneNumber,'US', function(error, result) {
        if (error) {
            res.send(501,"Invalid phone number: " + error.toString());
        }
        else {
            PG.knex('contacts').select('image_url','verified').where('normalized_phone_number',result).then(function(result) {
                if (result[0].verified) {
                    res.send(201,{response:result[0].image_url});
                }
                else {
                    res.send(501,"This user does not have a verified profile picture");
                }

            }).catch(function(err) {
                console.error("Error retrieving image for phone: " + rawPhoneNumber, err.toString());
            });
        }
    });
};

exports.sendVerificationSMS = function(req, res) {

    var rawPhoneNumber = req.query.phone_number;

    Phone.e164(rawPhoneNumber,'US', function(error, result) {
        if (error) {
            res.send(501,"Invalid phone number: " + error.toString());
        }
        else {
            var insertObject = {};
            insertObject.device_id = req.query.device_id;
            insertObject.verification_code = generateRandomCode(1000,9999);
            insertObject.verification_created_at = new Date().toUTCString();
            insertObject.normalized_phone_number = result;

            PG.knex.raw("BEGIN; LOCK TABLE proposed_phone_numbers IN SHARE ROW EXCLUSIVE MODE; WITH new_values (device_id, verification_code, verification_created_at, normalized_phone_number) AS ( \
             VALUES \
             ('" + insertObject.device_id + "','" + insertObject.verification_code + "','" + insertObject.verification_created_at + "','" + insertObject.normalized_phone_number + "' \
             )), \
             upsert as \
             ( \
                UPDATE proposed_phone_numbers c \
                    SET device_id = nv.device_id \
                    , verification_code = nv.verification_code \
                    , verification_created_at = nv.verification_created_at \
            	FROM new_values nv \
            	WHERE c.normalized_phone_number = nv.normalized_phone_number \
            	RETURNING c.normalized_phone_number \
            ) \
             INSERT INTO proposed_phone_numbers (device_id, verification_code, verification_created_at, normalized_phone_number) \
             SELECT device_id, verification_code, verification_created_at, normalized_phone_number \
             FROM (SELECT * FROM new_values) groupedValues \
             WHERE NOT EXISTS (SELECT 1 \
            				  FROM upsert up \
            				  WHERE up.normalized_phone_number = groupedValues.normalized_phone_number) RETURNING proposed_phone_number_id; COMMIT;")
                .then(function(results) {
                console.log("Successfully inserted proposed phone number with verification info");
                var messageToSend = "Verification Code: " + insertObject.verification_code + ". Enter " + insertObject.verification_code + " within the Matchflare app to start playing cupid!";
                sms.sendSMS(insertObject.normalized_phone_number,messageToSend); 
                res.send(201, {response: "Successfully inserted proposed phone number"});
            }).catch(function(err) {
                console.error("Error inserting proposed phone number with verification info", err);
                res.send(501,err);
            });
        }
    });

};


var generateRandomCode = function(min, max) {

    var random_code = Math.floor(Math.random() * (max-min+1)) + min;
    return random_code;

};

exports.verifyAccessToken = function(req, res) {
    var access_token = req.query.access_token;
    PG.knex('contacts').select().where('access_token',access_token).then(function(results) {
        if (results[0]) {
            var user = results[0];
            console.log("Successfully verified access token: " + user.contact_id);
            //Retrieve the actual people objects from the list of contacts
            contact.getContacts(user.contact_id, function(err,contact_objects) {
                if (err) {
                    res.send(501,"Failed to verify access token:", JSON.stringify(err));
                }
                else {
                    user.contact_objects = contact_objects;
                    res.send(201,user);
                }
            });            
        }
        else {
            console.error("Failed to verify access token: " + access_token);
            res.send(501,"Failed to verify access token");
        }

    }).catch(function(err){
        console.error("Failed to verify access token", err.toString());
        res.send(501,"Failed to verify access token: " + err.toString());
    });
};

exports.verifyVerificationSMS = function(req, res) {
    var input_verification_code = req.query.input_verification_code;
    var device_id = req.query.device_id;
    var currentTime = new Date().toUTCString();
    var rawPhoneNumber = req.query.phone_number;

    Phone.e164(rawPhoneNumber,'US', function(error, normalizedPhoneNumber) {
        if (error) {
            res.send(501,"Invalid phone number: " + error.toString());
        }
        else {
            //Retrieve the proposed phone number info...
            PG.knex('proposed_phone_numbers')
                .select('contacts.contact_id','contacts.verified','contacts.contacts','proposed_phone_numbers.verification_code','proposed_phone_numbers.verification_created_at','proposed_phone_numbers.device_id')
                .leftJoin('contacts','proposed_phone_numbers.normalized_phone_number','contacts.normalized_phone_number')
                .where('proposed_phone_numbers.normalized_phone_number',normalizedPhoneNumber).then(function(result) {
                    console.log("Successfully retrieved verification info");

                    //Delete the existing proposed phone number entry
                    PG.knex('proposed_phone_numbers').delete().where('normalized_phone_number',normalizedPhoneNumber).then(function(deleteResult) {
                        console.log("Successfully deleted the proposed phone number");
                    }).catch(function(err) {
                        console.error("Error deleting the proposed phone number");
                    });

                    var maxTimeDifference = 900000; //15 min = 900000 milliseconds
                    var thisContact = result[0];

                    if (input_verification_code === thisContact.verification_code && device_id === thisContact.device_id && (new Date(currentTime) - new Date(thisContact.verification_created_at)) < maxTimeDifference) {
                        //If successfully verified, then generate access token and insert/update the contact
                        var access_token = generateRandomCode(1000000000,9999999999);

                        var update = {};

                        if (!thisContact.verified) {
                            //If not already verified, then change everything to user input values...
                            update.verified = true;
                            update.guessed_full_name = utils.formatName(req.body.guessed_full_name);
                        }

                        if (req.body.image_url) {
                            update.image_url = req.body.image_url;
                        }

                        update.image_url = req.body.image_url;
                        update.guessed_gender = req.body.guessed_gender;
                        update.gender_preferences = req.body.gender_preferences;
                        update.birth_year = (new Date()).getFullYear() - req.body.age;
                        update.zipcode = req.body.zipcode;
                        update.contacts = _.union(thisContact.contacts,_.pluck(req.body.contact_objects,'contact_id'));
                        update.device_id = device_id;
                        update.access_token = access_token;
                        update.blocked_matches = false;  //Unblock the user if they had blocked matches before, but are registering now

                        //If the contact did not exist, then insert the new contact...
                        if (!thisContact.contact_id) {
                            update.normalized_phone_number = normalizedPhoneNumber;
                            PG.knex('contacts').insert(update).returning('contact_id').then(function(results) {
                                console.log("Successfully inserted contact with verified info");
                                update.contact_id = results[0];

                                contact.getContacts(update.contact_id, function(err,contact_objects) {
                                    if (err) {
                                        res.send(501,"Failed to get contact objects:", JSON.stringify(err));
                                    }
                                    else {
                                        update.contact_objects = contact_objects;
                                        res.send(201, update); //Send current user (with contact objects)
                                    }
                                });  

                                Matches.makeMatches(update.contact_id,null, function(err) {
                                    console.log("New matches made!");
                                });

                            }).catch(function(err) {
                                console.error("Error inserted contact with verified info", err);
                                res.send(501,err);
                            });
                        }
                        else {
                            //Otherwise update the existing contact...
                            PG.knex('contacts').update(update).where('contact_id',thisContact.contact_id).then(function(results) {
                                console.log("Successfully updated contact with verified info");
                                update.contact_id = thisContact.contact_id;

                                //Get new contact objects
                                contact.getContacts(update.contact_id, function(err,contact_objects) {
                                    if (err) {
                                        res.send(501,"Failed to get contact objects:", JSON.stringify(err));
                                    }
                                    else {
                                        update.contact_objects = contact_objects;
                                        res.send(201, update); //Send current user (with contact objects)
                                    }
                                });  

                                Matches.makeMatches(update.contact_id,null, function(err) {
                                    console.log("New matches made!");

                                });

                            }).catch(function(err) {
                                console.error("Error updating contact with verified info", err);
                                res.send(501,err);
                            });
                        }

                    }
                    else {
                        //If not successfully verified...report error!
                        res.send(501,{response:"INVALID"});
                    }

                }).catch(function(err) {
                    console.error("Error verifying your phone number", err.toString());
                    res.send(501,{response:"INVALID"});
                });
        }
    });


};