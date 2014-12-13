var request = require('request-json');
var client;
client = request.newClient('http://localhost:5000/');
//client = request.newClient('http://matchflare.herokuapp.com/');


//Test the creation of a new match and associated notifications
//var data = {first_contact_id:90, second_contact_id:92, match_status:"MATCHED", matcher_contact_id:90, is_anonymous:false}

//client.post('/postMatch', data, function(err, res, body) {
//  return console.log(res.statusCode);
//});

//Test ACCEPTING of a match
//var data = {"decision":"ACCEPT","contact_id":90,"pair_id":90};

//client.post('match/respond', data, function(err, res, body) {
//   return console.log(res.statusCode);
//});

//Test second ACCEPTING of a match
//var data = {"decision":"ACCEPT","contact_id":91,"pair_id":90};
//client.post('match/respond', data, function(err, res, body) {
//    return console.log(res.statusCode);
//});

//Test the various 'GETS' of matches
//client.get('/match?pair_id=86',function(err, res, body) {
//    console.log("GET MATCH", body);
//});

//client.get('/getMatches?contact_id=90',function(err, res, body) {
//    console.log("GET MATCHES", JSON.stringify(body));
//});

// client.get('/pendingMatches?contact_id=262',function(err, res, body) {
//    console.log("GET PENDING MATCHES", JSON.stringify(body));
// });


//Test getNotificationLists
client.get('/notificationLists?contact_id=90',function(err, res, body) {
   console.log("GET NOTIFICATION LISTS", JSON.stringify(body));
});

//Test websocket connection

var WebSocket = require('ws');
//var testSocket = new WebSocket("ws://localhost:5000/liveChat");
var testSocket = new WebSocket("ws://matchflare.herokuapp.com/liveChat");

var chat_id = 450;
var sender_contact_id = 173;
testSocket.on('open', function(event) {
 testSocket.send(JSON.stringify({type:"set_chat_id", chat_id: chat_id, sender_contact_id:sender_contact_id}));
});

testSocket.on('message',function(message) {
 console.log("Received message", message);
});


var send = function(message) {
   testSocket.send(JSON.stringify({chat_id:chat_id, sender_contact_id: sender_contact_id, content: message, type:'message'}));
 }


//Test authentication and SMS verification

// var data = {};
// client.post('/sendSMSVerification?phone_number=6098510053&device_id=MOCK_DEVICE_ID_1991',data,function(err,res,body) {
//    console.log("Result of sending SMS verification:",JSON.stringify(body));
// });

// var data = {guessed_full_name:"Dr. Piyush Poddar", guessed_gender:"MALE","age":23,zipcode:"08550", gender_preferences:["FEMALE"]};
// client.post('/verifyVerificationSMS?phone_number=6098510054&device_id=MOCK_DEVICE_ID_1991&input_verification_code=3989', data, function(err, res, body) {
//     return console.log("Result of verifying the Verification SMS:", JSON.stringify(body));
// });

//Test the processing of contacts
// var data = {contacts:[{raw_phone_number:'6098510053',guessed_full_name:'John'},{raw_phone_number:'7328510053',guessed_full_name:'Jenny'},{raw_phone_number:'9078510053',guessed_full_name:'Patrick'}]};

// // client.post('/processContacts?contact_id=90',data, function(err,res,body) {
// // 	if (err)
// // 		console.error("Error processing contacts: ", err.toString());
// // 	else {
// // 		console.log("Processing contacts returned: ", JSON.stringify(body));
// // 	}
// // });

// var data = {contacts:[{contact_id: 90},{contact_id: 91},{contact_id: 92},{contact_id: 93}]};

// client.post('/getMatches',data,function(err, res,body) {
// 	if (err)
// 		console.error("Error processing contacts: ", err.toString());
// 	else {
// 		console.log("Matches: ", JSON.stringify(body));
// 	}
// });