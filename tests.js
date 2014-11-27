var request = require('request-json');
var client = request.newClient('http://localhost:5000/');

//var client = request.newClient('http://matchflare.herokuapp.com/');


//Test the creation of a new match and associated notifications
//var data = {first_contact_id:90, second_contact_id:91, match_status:"MATCHED", matcher_contact_id:90, is_anonymous:false}
//
//client.post('/postMatch', data, function(err, res, body) {
//  return console.log(res.statusCode);
//});

//Test ACCEPTING of a match
// var data = {"decision":"ACCEPT","contact_id":90,"pair_id":51};

// client.post('match/respond', data, function(err, res, body) {
//   return console.log(res.statusCode);
// });

//Test websocket connection

var WebSocket = require('ws');
var testSocket = new WebSocket("ws://localhost:5000/liveChat");

testSocket.on('open', function(event) {
  testSocket.send(JSON.stringify({type:"set_chat_id", chat_id: 1, sender_contact_id:91}));
});

testSocket.on('message',function(message) {
  console.log("Received message", message);
});


var send = function(message) {
    testSocket.send(JSON.stringify({chat_id:1, sender_contact_id: 91, content: message}));
  }


