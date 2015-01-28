var PG = require('./knex');
var utils = require('./utils');

exports.getMatchflareScore = function(req,res) {
	var contact_id = req.query.contact_id;

	PG.knex('contacts').select('matchflare_score').where('contact_id',contact_id).then(function(result) {
		console.log("Returning matchflare score: ", result[0].matchflare_score);
		res.send(201,result[0]);
	}).catch(function(err) {
		res.send(501,"Error getting matchflare score: ", err.toString());
	});

};

exports.getContacts = function(contact_id,callback) {

	PG.knex.raw("SELECT guessed_full_name, contact_id, image_url, verified FROM \
	(SELECT unnest(contacts) friends FROM contacts WHERE contact_id=?) c1 \
	INNER JOIN contacts c2 \
	ON c1.friends=c2.contact_id ORDER BY guessed_full_name;",[contact_id]).then(function(result) {
		callback(null,result.rows);
	}).catch(function(err) {
		console.error("Error retrieving contacts for this person", JSON.stringify(err));
		callback(err,null);
	});
}

exports.removeContact = function(req,res) {
	var contact_id = req.query.contact_id;
	var to_remove_contact_id = req.query.to_remove_contact_id;

	PG.knex.raw("UPDATE contacts SET removed_contacts = array_append(removed_contacts, ?) where contact_id = ?",[to_remove_contact_id,contact_id]).then(function(result) {
		console.log("Successfully added " + to_remove_contact_id + " to the removed contacts of " + contact_id);
		res.send(201,{response:"Will not show this person in future matches"});
	}).catch(function(err) {
		console.error("Error adding this contact to the removed contacts list: ", JSON.stringify(err));
		res.send(501,err);
	})
}

exports.blockContact = function(req, res) {
	var contact_id = req.query.contact_id;
	var to_block_contact_id = req.query.to_block_contact_id;

	PG.knex.raw("UPDATE contacts SET blocked_contacts = array_append(blocked_contacts, ?) where contact_id = ?",[to_block_contact_id,contact_id]).then(function(result) {
		console.log("Successfully added " + to_block_contact_id + " to the blocked contacts of " + contact_id);
		res.send(201,{response:"This person won't match you in the future"});
	}).catch(function(err) {
		console.error("Error adding this contact to the blocked contacts list: ", JSON.stringify(err));
		res.send(501,err);
	})
}

exports.updateProfile = function(req, res) {
	var this_user = req.body;
	var updateObject = {};
	if (this_user.guessed_gender) {
		updateObject.guessed_gender = this_user.guessed_gender;
	}

	if (this_user.gender_preferences) {
		updateObject.gender_preferences = this_user.gender_preferences;
	}

	if (this_user.image_url) {
		updateObject.image_url = this_user.image_url;
	}
	
	PG.knex('contacts').update(updateObject).where('contact_id',this_user.contact_id).then(function(result) {
		PG.knex('contacts').select().where('contact_id',this_user.contact_id).then(function(result) {
			console.log("Successfully updated user: " + JSON.stringify(result));
			res.send(201,result[0]);
		}).catch(function(err) {
			throw err;
		});

	}).catch(function(err) {
		console.error("Error updating this user", JSON.stringify(err));
		res.send(500,err);
	});
};

exports.preventMatches = function(req, res) {
	var toPreventMatches = parseInt(req.query.toPreventMatches);
	var contact_id = req.query.contact_id;

	PG.knex('contacts').update({'blocked_matches':toPreventMatches ? true : false}).where('contact_id',contact_id).then(function(result) {
		console.log("Successfully changed blocked matches status");
		res.send(201,{response: 'successful'});
	}).catch(function(err) {
		console.error("Error changing blocked matches status",JSON.stringify(err));
		res.send(500,err);
	});
};