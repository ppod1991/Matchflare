'use strict';

//Module to configure connection to postgreSQL database
var knex = require('knex')({
  client: 'pg',
  connection: {
		host : 'ec2-54-243-48-204.compute-1.amazonaws.com',
		user: 'orbkauaarzwuje',
		password: process.env.DATABASE_PASSWORD,
		database: 'df59viok2mm9kt',
		ssl: 'true'
	}
  });

exports.knex = knex;
