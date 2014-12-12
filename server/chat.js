/**
 * Created by piyushpoddar on 11/26/14.
 */
var PG = require('./knex');

exports.getChatHistory = function(chat_id, callback) {
  PG.knex.select('content','sender_contact_id','messages.created_at','guessed_full_name').from('messages').where('chat_id',chat_id).orderBy('created_at','asc').innerJoin('contacts','contacts.contact_id','messages.sender_contact_id').then(function(results) {
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
    PG.knex('messages').insert({content: chatMessage.content, chat_id: chatMessage.chat_id, sender_contact_id: chatMessage.sender_contact_id},'created_at').then(function(result) {
        console.log("Successfully posted new chat message", chatMessage.content);
        callback(result[0],null);
    }).catch(function(err) {
        console.error("Error posting new chat message", err);
        callback(null,err);
    });
}

exports.setLastSeenAt = function(chat_id,contact_id) {

  if (chat_id > 0 && contact_id > 0) {  //If valid contact id and chat id was set
      //Update the 'seen at' column for the correct participant in the chat
      PG.knex.raw("
        UPDATE chats \
        SET     first_seen_at = CASE WHEN first_contact_id = ? THEN timezone('utc'::text, now()) ELSE first_seen_at END, \
          second_seen_at = CASE WHEN second_contact_id = ? THEN timezone('utc'::text, now()) ELSE second_seen_at END, \
          matcher_seen_at = CASE WHEN matcher_contact_id = ? THEN timezone('utc'::text, now()) ELSE matcher_seen_at END \
        WHERE chat_id = ?;",[contact_id,contact_id,contact_id,chat_id]).then(function(result) {
          
            console.log("Successfully updated seen at column");
        }).catch(function(err) {
            console.error("Error updating seen at column", JSON.stringify(err));
        })

  }

};

