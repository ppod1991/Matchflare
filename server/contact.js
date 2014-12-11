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