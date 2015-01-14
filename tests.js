var request = require('request-json');
var client;
client = request.newClient('http://localhost:5000/');
client = request.newClient('http://matchflare.herokuapp.com/');


//Test GCM notifications
// var notify = require('./server/notify');
// var target_contact_id = 262;
// var notification = {push_message:"Test", notification_type:"MATCHEE_NEW_MATCH", pair_id:459, target_contact_id:262};
// notify.sendNotification(262,notification);

//Test APN notifications
var notify = require('./server/notify');
var target_contact_id = 453;
var notification = {push_message:"Test", notification_type:"MATCHEE_NEW_MATCH", pair_id:459, target_contact_id:target_contact_id};
notify.sendNotification(target_contact_id,notification);

//Test the creation of a new match and associated notifications
// var data = {first_matchee:{contact_id:262},second_matchee:{contact_id:453},matcher:{contact_id:97}, match_status:"MATCHED", matcher_contact_id:97, is_anonymous:false}

// client.post('/postMatch', data, function(err, res, body) {
//  return console.log(JSON.stringify(body));
// });

//Test ACCEPTING of a match
// var data = {"decision":"ACCEPT","contact_id":165,"pair_id":557};

// client.post('/match/respond', data, function(err, res, body) {
//   return console.log(res.statusCode);
// });

//Test second ACCEPTING of a match
// var data = {"decision":"ACCEPT","contact_id":162,"pair_id":556};
// client.post('match/respond', data, function(err, res, body) {
//    return console.log(res.statusCode);
// });

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
// client.get('/notificationLists?contact_id=90',function(err, res, body) {
//    console.log("GET NOTIFICATION LISTS", JSON.stringify(body));
// });

//Test websocket connection

// var WebSocket = require('ws');
// //var testSocket = new WebSocket("ws://localhost:5000/liveChat");
// var testSocket = new WebSocket("ws://matchflare.herokuapp.com/liveChat");

// var chat_id = 727;
// var sender_contact_id = 95;
// var pair_id = 550;
// testSocket.on('open', function(event) {
//  testSocket.send(JSON.stringify({type:"set_chat_id", chat_id: chat_id, sender_contact_id:sender_contact_id, pair_id:pair_id}));
// });

// testSocket.on('message',function(message) {
//  console.log("Received message", message);
// });

// var send = function(message) {
//    testSocket.send(JSON.stringify({chat_id:chat_id, sender_contact_id: sender_contact_id, content: message, type:'message'}));
//  }


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
	// if (err)
	// 	console.error("Error processing contacts: ", err.toString());
	// else {
	// 	console.log("Matches: ", JSON.stringify(body));
	// }
// });

//Tests string utils
// var utils = require('./server/utils');
// console.log("1. Should be true: " + (utils.contains("STop","stop")==true));
// console.log("2. Should be true: " + (utils.contains("Snop","stop")==false));
// console.log("3. Should be true: " + (utils.contains("STopppp","stop")==true));
// console.log("4. Should be true: " + (utils.contains(" STop   stop","stop")==true));
// console.log("5. Should be true: " + (utils.contains("STop","stop")==true));
// console.log("5. Should be true: " + (utils.contains("asdfasdfSTop","stop")==true));

//Test Inbound SMS/Unsubscribing

// var messageText = encodeURIComponent('   undo');
// client.get('/receiveSMS?msisdn=16098510053&to=12069396519&messageId=020000004A2C43FC&text=' + messageText + '&type=text&keyword=TEST%21&message-timestamp=2014-12-15+20%3A34%3A30',function(err, res, body) {
//    if (err)
//    	console.error("Error Unsubscribing: ", err.toString());
//    else {
//    	console.log("Response: ", JSON.stringify(body));
//    }
// });


// Test updating profile
// var data = {guessed_gender:"MALE",gender_preferences:["FEMALE"],contact_id:262,image_url:"www.test.com"};

// client.post('/updateProfile',data,function(err, res,body) {
// 	if (err)
// 		console.error("Error updating profile: ", err.toString());
// 	else {
// 		console.log("Response: ", JSON.stringify(body));
// 	}
// });
