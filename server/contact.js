var PG = require('./knex');

exports.getMatchflareScore = function(req,res) {
	var contact_id = req.query.contact_id;

	PG.knex('contacts').select('matchflare_score').where('contact_id',contact_id).then(function(result) {
		console.log("Returning matchflare score: ", result[0].matchflare_score);
		res.send(201,result[0].matchflare_score);
	}).catch(function(err) {
		res.send(501,"Error getting matchflare score: ", err.toString());
	});

};

exports.getContacts = function(contact_id,callback) {

	PG.knex.raw("SELECT guessed_full_name, contact_id, image_url FROM \
	(SELECT unnest(contacts) friends FROM contacts WHERE contact_id=?) c1 \
	INNER JOIN contacts c2 \
	ON c1.friends=c2.contact_id;",[contact_id]).then(function(result) {
		callback(null,result.rows);
	}).catch(function(err) {
		console.error("Error retrieving contacts for this person", JSON.stringify(err));
		callback(err,null);
	});
}