var knex = require('knex')({
  client: 'pg',
  connection: {
		host : 'ec2-54-243-48-204.compute-1.amazonaws.com',
		user: 'orbkauaarzwuje',
		password: '8DgvPuZfCDp_xiCTYKCE4NijJE',
		database: 'df59viok2mm9kt',
		ssl: 'true'
	}
  });

//For debugging...
// var knex = require('knex')({
//   client: 'pg',
//   debug:'true',
//   connection: {
// 		host : 'ec2-54-243-48-204.compute-1.amazonaws.com',
// 		user: 'orbkauaarzwuje',
// 		password: '8DgvPuZfCDp_xiCTYKCE4NijJE',
// 		database: 'df59viok2mm9kt',
// 		ssl: 'true'
// 	}
//   });

exports.knex = knex;
