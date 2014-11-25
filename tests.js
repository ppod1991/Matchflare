var request = require('request-json');
var client = request.newClient('http://localhost:5000/');

var data = {"decision":"ACCEPT","contact_id":90,"pair_id":36};

client.post('match/respond', data, function(err, res, body) {
  return console.log(res.statusCode);
});