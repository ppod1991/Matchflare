/**
 * Created by piyushpoddar on 11/26/14.
 */
var PG = require('./knex');

exports.getChatHistory = function(chat_id, callback) {
  PG.knex.select('content','sender_contact_id','messages.created_at','guessed_full_name').from('messages').where('chat_id',chat_id).orderBy('created_at','desc').innerJoin('contacts','contacts.contact_id','messages.sender_contact_id').then(function(results) {
     console.log("Successfully retrieved chat " + chat_id);
     callback(results);
  }).catch(function(err) {
     console.error("Error retrieving chat history", err);
  });
};

exports.getName = function(contact_id, callback) {
    PG.knex.select('guessed_full_name').from('contacts').where('contact_id',contact_id).then(function(result) {
        console.log("Successfully retrieved name", result[0].guessed_full_name);
        callback(result[0].guessed_full_name);
    }).catch(function(err) {
        console.error("Error retrieving associated name", err);
    });
};

exports.addMessage = function(chatMessage, callback) {
    PG.knex('messages').insert({content: chatMessage.content, chat_id: chatMessage.chat_id, sender_contact_id: chatMessage.sender_contact_id}).then(function(result) {
        console.log("Successfully posted new chat message", chatMessage.content);
        callback();
    }).catch(function(err) {
        console.error("Error posting new chat message", err);
        callback(err);
    });
}