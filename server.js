var express = require("express");
var logfmt = require("logfmt");
var app = express();
var pg = require('pg');
var bodyParser = require('body-parser');
var cors = require('cors');
var http = require('http');
var processContacts = require('./server/processContacts');
var matches = require('./server/matches');

app.use(logfmt.requestLogger());
app.use(bodyParser.json());
app.use(express.static(__dirname + '/client'));
app.use(cors());

var port = Number(process.env.PORT || 5000);

var server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);


app.get('/', function(req, res) {
    res.sendfile('./client/index.html');
});

app.post('/processContacts',processContacts.processContacts);

app.get('/getMatches', matches.getMatches);

app.post('/postMatch', matches.addMatchResult);
//app.post('/specifiedCompetitors',companies.setSpecifiedCompetitors);
