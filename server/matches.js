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
	ORDER BY (random()*0.5+1) * (matchflare_score(c1)) DESC LIMIT 30", [contact_id,contact_id,contact_id,contact_id])
	.then(function(results) {
   			console.log(results.rows);
   			res.send(201, {matches:results.rows})
   		}).catch(function(err) {
   			console.error("Error getting matches", err);
   			res.send(500, "Error getting matches: " + err.toString());
   		})
}

exports.addMatchResult = function(req, res) {
	var match_status = req.body.match_status;
	var first_contact_id = req.body.first_contact_id;
	var second_contact_id = req.body.second_contact_id;


	if (match_status === "FIRST_CONTACT_WINS" || match_status === "SECOND_CONTACT_WINS") {
		
		var orderArray;

		if (match_status === "FIRST_CONTACT_WINS") {
			orderArray = [first_contact_id, second_contact_id];
		}
		else {
			orderArray = [second_contact_id, first_contact_id];
		}
			
		PG.knex.raw("SELECT update_elo_score(?,?)",orderArray).then(function(result) {
			res.send(201,"Elo scores updated");
			console.log({response:"Elo scores updated"});
		}).catch(function(err) {
			console.error("Error updating elo score");
			res.send(501,"Error updating elo score: " + err);
		});
		
	}
	else {
		//If an matched or passed...
		res.send(201);
	}


		// var first_elo_score = req.body.first_elo_score;
		// var second_elo_score = req.body.second_elo_score;
		// var first_elo_count = req.body.first_elo_count;
		// var second_elo_count = req.body.second_elo_count;

		// var tenFactor = 400;
		// var Q_first = Math.pow(10,first_elo_score/tenFactor);
		// var Q_second = Math.pow(10,second_elo_score/tenFactor);
		// var E_first = Q_first/(Q_first + Q_second);
		// var E_second = Q_second/(Q_first + Q_second);
		// var k_first = 16 + (16*Math.exp(-1*first_elo_count/4));
		// var k_second = 16 + (16*Math.exp(-1*second_elo_count/4));

		// var S_first, S_second;
		// if (match_status === "first_contact") {
		// 	S_first = 1;
		// 	S_second = 0;
		// }
		// else {
		// 	S_first = 0;
		// 	S_second = 1;
		// }

		// var new_first_elo_score = first_elo_score + k_first * (S_first - E_first);
		// var new_second_elo_score = second_elo_score + k_second * (S_second - E_second);

	
}

// var req = {query:{contact_id: 90}}
// exports.getMatches(req);

// var req = {body:{first_contact_id:90, second_contact_id:91, match_status:"FIRST_CONTACT_WINS"}};
// var res = {send:function(a){}};

// exports.addMatchResult(req,res);

