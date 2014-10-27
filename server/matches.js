var PG = require('./knex');

exports.getMatches = function(req, res) {
	var contact_id = req.query.contact_id;

	PG.knex.raw("SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_contact_name, c1.guessed_gender first_contact_gender, c2.contact_id second_contact_id, c2.guessed_full_name second_contact_name, c2.guessed_gender second_contact_gender \
	FROM contacts c1, contacts c2  \
		WHERE c1.contact_id IN \
			(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?)  \
		AND c2.contact_id IN  \
			(SELECT unnest(contacts) FROM contacts WHERE contact_id = ?) \
		AND c2.guessed_gender IN  \
			(SELECT unnest(guess_preferences(c1.guessed_gender)))	 \
		AND c1.contact_id != c2.contact_id \
		AND c1.contact_id != ? \
		AND c2.contact_id != ? \
	ORDER BY (random()*0.5+1) * (matchflare_score(c1)) DESC", [contact_id,contact_id,contact_id,contact_id])
	.then(function(results) {
   			console.log(results.rows);
   			res.send(201, {matches:results.rows})
   		}).catch(function(err) {
   			console.error("Error getting matches", err);
   			res.send(500, "Error getting matches: " + err.toString());
   		})
}

// var req = {query:{contact_id: 90}}
// exports.getMatches(req);


