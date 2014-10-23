var express = require("express");
var logfmt = require("logfmt");
var app = express();
var pg = require('pg');
var conString = "postgres://afhgrosdezwdmv:LpFK-i6sUW6vVkAYgf1aG-5sA5@ec2-174-129-21-42.compute-1.amazonaws.com:5432/d8bi4fo1kqr1ft?ssl=true";
var bodyParser = require('body-parser');
var cors = require('cors');
var http = require('http');

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


//app.post('/specifiedCompetitors',companies.setSpecifiedCompetitors);
