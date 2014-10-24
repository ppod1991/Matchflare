var knex = require('knex')({
  client: 'pg',
  connection: {
		host : 'ec2-174-129-21-42.compute-1.amazonaws.com',
		user: 'afhgrosdezwdmv',
		password: 'LpFK-i6sUW6vVkAYgf1aG-5sA5',
		database: 'd8bi4fo1kqr1ft',
		ssl: 'true'
	}
  });

exports.knex = knex;
