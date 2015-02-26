'use strict';

//Import external Node dependencies
var express = require("express");
var logfmt = require("logfmt");
var app = express();
var pg = require('pg');
var bodyParser = require('body-parser');
var cors = require('cors');
var http = require('http');
var _ = require('lodash');
var WebSocketServer = require('ws').Server;

//Import internal dependencies
var processContacts = require('./routes/processContacts');
var matches = require('./routes/matches');
var gcm = require('./routes/gcm');
var apns = require('./routes/apns');
var notify = require('./routes/notify');
var chat = require('./routes/chat');
var contact = require('./routes/contact');
var authentication = require('./routes/authentication');
var sms = require('./routes/sms');
var utils = require('./routes/utils');

//Set up express server settings
app.use(logfmt.requestLogger());
app.use(bodyParser.json({limit: '50mb'}));  //Required for large post message bodies
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(express.static(__dirname + '/client'));
app.use(cors()); //Allow cross-origin requests

//Initialize express server
var port = Number(process.env.PORT || 5000);
var server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);


//Client-Side Request Routing

//Home page
app.get('/', function(req, res) {
    res.sendfile('./client/build/html/index.html');
});

//Match-specific web page
app.get('/m/:encoded_pair_id',function(req, res) {
	var encoded_pair_id = req.params.encoded_pair_id;
	res.redirect('/#/m/' + encoded_pair_id);
});


//API Request Routing

//Match related requests
app.get('/getMatches', matches.getMatches);
app.post('/postMatch', matches.addMatchResult);
app.post('/match/respond', matches.respondToMatchRequest);
app.get('/pendingMatches', matches.getPendingMatches);
app.post('/getMatches',matches.getMatches);
app.post('/processContacts',processContacts.processContacts);
app.get('/match',matches.getMatch);

//Push Notification Related requests
app.post('/gcm/registrationId',gcm.updateRegistrationId);
app.post('/apns/registrationId',apns.updateRegistrationId);
app.get('/receiveSMS',sms.receiveSMS);

//Notification Related requests
app.get('/notifications',notify.getNotifications);
app.get('/notificationLists',notify.getNotificationLists);
app.post('/seeNotification',notify.markAsSeen);
app.get('/hasUnread',notify.hasUnreadMessages);

//SMS Authentication Related requests
app.post('/sendSMSVerification',authentication.sendVerificationSMS);
app.post('/verifyVerificationSMS',authentication.verifyVerificationSMS);
app.get('/verifyAccessToken',authentication.verifyAccessToken);
app.get('/pictureURL',authentication.getPicture);

//User Related requests
app.get('/getScore',contact.getMatchflareScore);
app.post('/removeContact',contact.removeContact);
app.post('/blockContact',contact.blockContact);
app.post('/updateProfile',contact.updateProfile);
app.post('/preventMatches',contact.preventMatches);

//Test Related requests
app.post('/test',utils.test);



//Websocket Chat Server

var wss = new WebSocketServer({server: server, path:"/liveChat"});
console.log("Websocket server created");
var activeConnections = {}; //Maintains list of active connections
var index = 1; //Connection index counter

//Accept web-socket connections
wss.on("connection", function(ws) {

	activeConnections[index + ""]  = ws;  //Store current connection
	ws["myIndex"] = index + ""; //Store connection index

	console.log("websocket connection open with index: " + index);
	console.log("# of Active Connections:" + Object.keys(activeConnections).length);

	index++; //Increment index

	//On received message...
	ws.on("message", function(rawData, flags) {
		console.log("Received message: " + JSON.stringify(rawData));
		var receivedData = JSON.parse(rawData);
		console.log(receivedData);

		if(ws.hasOwnProperty("guessed_full_name")) {  //Add the name of the sender to the data if the name was set
			receivedData.guessed_full_name = ws.guessed_full_name;
		}

		//Check to see if the message is setting the chat ID
		if (receivedData.type === 'set_chat_id') {

			//Assign properties of chat to this connection
			ws.chat_id = receivedData.chat_id;
			ws.pair_id = receivedData.pair_id;
			ws.contact_id = receivedData.sender_contact_id;
			console.log("Chat ID Set to: " + ws.chat_id);

			//Send the current socket connection the chat history
			try {
				chat.getChatHistory(receivedData.chat_id,function(err, chatHistory) {

					if (err) { throw err; }
					chat.getName(receivedData.sender_contact_id,function(err,name) {
						if (err) { throw err; }

						chat.getPair(receivedData.pair_id,function(err,pair) {
							if (err) { throw err; }

							var registrationObject = {type: 'history', history: chatHistory, guessed_full_name:name, pair:pair };
							ws.guessed_full_name = name;
							ws.send(JSON.stringify(registrationObject));
						});
					});
				});
			}
			catch (err) { //Error in sending chat history--respond by sending error message to connection
				err.type = "error";
				ws.send(JSON.stringify(err));
			}

		}
		else if (ws.chat_id && receivedData.type === 'message') {  //Else if it is a normal user message, then post the message and send it to all active sockets in that chat

			chat.addMessage(receivedData, function (created_at, err) { //Persist the message to database
				if (!err) {

					receivedData.created_at = created_at;
					var sentTo = [];
					_(activeConnections).filter(function (socket) {  //Find active connections in the same chat and send message to each of them
						return socket.chat_id === ws.chat_id;
					}).forEach(function (socket) {
						socket.send(JSON.stringify(receivedData));
						sentTo.push(socket.contact_id);
					});

					chat.notifyAway(sentTo, ws.chat_id, ws.contact_id, receivedData.content); //Alert 'Away' users via Push Notification of a new message
				}
				else {
					ws.send(JSON.stringify({error: err}));  //Send error message to connection
				}
			});
		}
	});

	//On websocket connection close
	ws.on("close", function() {
		console.log("Websocket connection close -- updating last seen at");
		chat.setLastSeenAt(ws.chat_id,ws.contact_id); //Update the 'last seen at' column for the current user for the current chat
		delete activeConnections[ws.myIndex]; //Remove connection from the active connections
	});

	//On websocket error
	ws.on("error", function(err) {
		console.log("Error in websocket!", JSON.stringify(err));
	});

});