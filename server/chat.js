/**
 * Created by piyushpoddar on 11/26/14.
 */
var PG = require('./knex');
var notify = require('./notify');
var _ = require('lodash');
var matches = require('./matches');

exports.getChatHistory = function(chat_id, callback) {
  PG.knex.select('content','sender_contact_id','messages.created_at','guessed_full_name').from('messages').where('chat_id',chat_id).orderBy('created_at','asc').innerJoin('contacts','contacts.contact_id','messages.sender_contact_id').then(function(results) {
     console.log("Successfully retrieved chat " + chat_id);
     callback(null,results);
  }).catch(function(err) {
     console.error("Error retrieving chat history", err);
     callback(err,null);
  });
};

exports.getName = function(contact_id, callback) {
    PG.knex.select('guessed_full_name').from('contacts').where('contact_id',contact_id).then(function(result) {
        console.log("Successfully retrieved name", result[0].guessed_full_name);
        callback(null, result[0].guessed_full_name);
    }).catch(function(err) {
        console.error("Error retrieving associated name", err);
        callback(err,null)
    });
};

exports.getPair = function(pair_id, callback) {
    PG.knex.raw("SELECT pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, \
          matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, \
          matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, matcher.guessed_gender AS matcher_gender, \
          is_anonymous, first_matcher_chat_id, second_matcher_chat_id, chat_id \
          FROM pairs \
          INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id \
          INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id \
          INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id \
          WHERE pair_id = ? ;",[pair_id]).then(function(result) {
              matches.rowsToObjects(result.rows, function(err, results) {
                  if(err) {
                    throw err;
                  }
                  else {
                    callback(null,results[0]);
                  }
              });
  }).catch(function(err) {
    console.error('Error retrieving match: ', err);
    callback(err,null);
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
      PG.knex.raw(" \
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

//Notify members of this chat who have not been notified via web socket chat that they have a new chat message
exports.notifyAway = function(sentTo, chat_id, sender_contact_id, message) {
  PG.knex.raw(" \
    SELECT  \
            firstC.guessed_full_name first_full_name, firstC.contact_id first_contact_id, \
            secondC.guessed_full_name second_full_name, secondC.contact_id second_contact_id, \
            matcherC.guessed_full_name matcher_full_name, matcherC.contact_id matcher_contact_id, \
            p.pair_id, chats.chat_id, p.is_anonymous, \
            chats.first_contact_id has_first, chats.second_contact_id has_second, chats.matcher_contact_id has_matcher   \
    FROM chats, pairs p \
    INNER JOIN contacts matcherC ON matcher_contact_id = matcherC.contact_id \
    INNER JOIN contacts firstC ON first_contact_id = firstC.contact_id \
    INNER JOIN contacts secondC ON second_contact_id = secondC.contact_id \
    WHERE   chats.chat_id = ? \
    AND (chats.chat_id = p.chat_id \
    OR  chats.chat_id = p.first_matcher_chat_id \
    OR  chats.chat_id = p.second_matcher_chat_id);",[chat_id]).then(function(result) {  
    
      matches.rowsToObjects(result.rows,function(err,matchObjects) {

        if (!err) {
          var match = matchObjects[0];
          var shortenedMessage;
          if (message.length > 22) {
                shortenedMessage = "'" + message.substring(0,25) + "...'";
          }
          else {
                shortenedMessage = "'" + message + "'";
          }

          var sender;
          if (match.first_matchee.contact_id === sender_contact_id) {
            sender = match.first_matchee;
          }
          else if (match.second_matchee.contact_id === sender_contact_id) {
            sender = match.second_matchee;
          }
          else if (match.matcher.contact_id === sender_contact_id) {
            sender = match.matcher;
          }

          var notification;
          if (result.rows[0].has_matcher && !(_.contains(sentTo,match.matcher.contact_id))) {  //If the matcher is in the chat and not already notified...
            //The notification to the matcher
            notification = {};
            notification.notification_type = "MATCHER_QUESTION_ASKED";
            notification.pair_id = match.pair_id;
            notification.chat_id = chat_id;
            notification.text_message = sender.guessed_full_name + " asked: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP.";
            notification.push_message = sender.guessed_full_name + " asked: " + shortenedMessage + ". Tap to reply.";
            notify.postNotification(match.matcher.contact_id,notification,sender.contact_id);
          }

          if (result.rows[0].has_first && !(_.contains(sentTo,match.first_matchee.contact_id))) {  //If the first matchee is in the chat and not already notified...
            //The notification to the first matchee
            notification = {};
            notification.pair_id = match.pair_id;
            notification.chat_id = chat_id;
            if (sender === match.matcher) {
                notification.notification_type = "MATCHEE_QUESTION_ANSWERED";
                if (match.is_anonymous) {
                  notification.text_message = "Your friend answered: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP."; //NEED TO IMPLEMENT -- GIVE URL to SEE REPLY ON WEBSITE
                  notification.push_message = "Your friend answered: " + shortenedMessage + ". Tap to reply.";
                }
                else {
                  notification.text_message = sender.guessed_full_name + " answered: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP.";
                  notification.push_message = sender.guessed_full_name + " answered: " + shortenedMessage + ". Tap to reply.";
                }
            }
            else {
                notification.notification_type = "MATCHEE_MESSAGE_SENT";
                notification.text_message = sender.guessed_full_name + " said: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP.";
                notification.push_message = sender.guessed_full_name + " said: " + shortenedMessage + ". Tap to reply.";
            }
            notify.postNotification(match.first_matchee.contact_id,notification,sender.contact_id);
          }

          if (result.rows[0].has_second && !(_.contains(sentTo,match.second_matchee.contact_id))) {  //If the second matchee is in the chat and not already notified...
            //The notification to the second matchee
            notification = {};
            notification.pair_id = match.pair_id;
            notification.chat_id = chat_id;
            if (sender === match.matcher) {
                notification.notification_type = "MATCHEE_QUESTION_ANSWERED";
                if (match.is_anonymous) {
                  notification.text_message = "Your friend answered: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP."; //NEED TO IMPLEMENT -- GIVE URL to SEE REPLY ON WEBSITE
                  notification.push_message = "Your friend answered: " + shortenedMessage + ". Tap to reply.";
                }
                else {
                  notification.text_message = sender.guessed_full_name + " answered: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP.";
                  notification.push_message = sender.guessed_full_name + " answered: " + shortenedMessage + ". Tap to reply.";
                }
            }
            else {
                notification.notification_type = "MATCHEE_MESSAGE_SENT";
                notification.text_message = sender.guessed_full_name + " said: " + shortenedMessage + ". Respond in the Matchflare app or reply STOP.";
                notification.push_message = sender.guessed_full_name + " said: " + shortenedMessage + ". Tap to reply.";
            }
            notify.postNotification(match.second_matchee.contact_id,notification,sender.contact_id);
          }
      }
      else {
        throw new error(err);
      }
    });
  }).catch(function(err) {
    console.error("Error retrieving participants of this chat", JSON.stringify(err));
  });


}
