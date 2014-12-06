var express = require("express");
var logfmt = require("logfmt");
var app = express();
var pg = require('pg');
var bodyParser = require('body-parser');
var cors = require('cors');
var http = require('http');
var processContacts = require('./server/processContacts');
var matches = require('./server/matches');
var gcm = require('./server/gcm');
var notify = require('./server/notify');
var chat = require('./server/chat');
var authentication = require('./server/authentication');
var WebSocketServer = require('ws').Server;
var _ = require('lodash');

app.use(logfmt.requestLogger());
app.use(bodyParser.json());
app.use(express.static(__dirname + '/client'));
app.use(cors());

var port = Number(process.env.PORT || 5000);

var server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

app.get('/', function(req, res) {
    res.sendfile('./client/build/html/index.html');
});

app.post('/processContacts',processContacts.processContacts);

app.get('/getMatches', matches.getMatches);

app.post('/postMatch', matches.addMatchResult);

app.post('/gcm/registrationId',gcm.updateRegistrationId);

app.get('/match',matches.getMatch);

app.post('/match/respond', matches.respondToMatchRequest);

app.get('/pendingMatches', matches.getPendingMatches);

app.get('/m/:encoded_pair_id',function(req, res) {
	var encoded_pair_id = req.params.encoded_pair_id;
	res.redirect('/#/m/' + encoded_pair_id);
});

app.get('/notifications',notify.getNotifications);

app.get('/notificationLists',notify.getNotificationLists);

app.post('/seeNotification',notify.markAsSeen);

app.post('/sendSMSVerification',authentication.sendVerificationSMS);

app.post('/verifyVerificationSMS',authentication.verifyVerificationSMS);

app.get('/verifyAccessToken',authentication.verifyAccessToken);

app.post('/getMatches',matches.getMatches);

//app.post('/specifiedCompetitors',companies.setSpecifiedCompetitors);

//Chat implementation
//Create websocket server
var wss = new WebSocketServer({server: server, path:"/liveChat"});
console.log("Websocket server created");
var activeConnections = {};
var index = 1;

//Accept web-socket connections
wss.on("connection", function(ws) {

	activeConnections[index + ""]  = ws;
	ws["myIndex"] = index + "";

	console.log("websocket connection open with index: " + index);
	console.log("# of Active Connections:" + Object.keys(activeConnections).length);

	index++;

	ws.on("message", function(rawData, flags) {
		console.log("Received message: " + JSON.stringify(rawData));
		var receivedData = JSON.parse(rawData);
		console.log(receivedData);

		if(ws.hasOwnProperty("guessed_full_name")) {  //Add the name of the sender to the data if the name was set
			receivedData.guessed_full_name = ws.guessed_full_name;
		}

		//Check to see if the message is setting the chat ID
		if (receivedData.type === 'set_chat_id') {
			ws.chat_id = receivedData.chat_id;
			console.log("Chat ID Set to: " + ws.chat_id);

			//Send the current socket the chat history
			chat.getChatHistory(receivedData.chat_id,function(chatHistory) {
				chat.getName(receivedData.sender_contact_id,function(name) {
					var registrationObject = {type: 'history', history: chatHistory, guessed_full_name:name };
					ws.guessed_full_name = name;
					ws.send(JSON.stringify(registrationObject));
				});

			});

		}
		else if (ws.chat_id) {  //Else if it is a normal message, then post the message and send it to all active sockets in that chat

			if(receivedData.type==='message') {
				chat.addMessage(receivedData, function (err) {
					if (!err) {
						_(activeConnections).filter(function (socket) {
							return socket.chat_id === ws.chat_id;
						}).forEach(function (socket) {
							socket.send(JSON.stringify(receivedData));
						});
					}
					else {
						ws.send(JSON.stringify({error: err}));
					}
				});
			}


		}


	});

	ws.on("close", function() {
		console.log("Websocket connection close");
		delete activeConnections[ws.myIndex];
	});

});