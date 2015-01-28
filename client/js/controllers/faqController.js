'use strict';

angular.module('matchflareApp.controllers.faq', [])
  .controller('faqController', ['$scope',
    function($scope) {
      $scope.questions = [];
      $scope.answers = [];

      $scope.questions.push("What is Matchflare?");
      $scope.answers.push("Matchflare is a free app for Android and iOS that lets you play Matchmaker with your friends!");

      $scope.questions.push("What happens when I swipe right (or press 'Match') on a pair of friends?");
      $scope.answers.push("Matchflare randomly chooses ONE friend in the pair and sends him/her a notification (text message if not registered, push notification if they have) saying something like\n\n 'Lucia! Elizabeth Berry thinks you’d hit it off with her pal, Aidan George.'\n followed by a description on what to do next.")
    
      $scope.questions.push("What happens after the first friend is notified?");
      $scope.answers.push("If the first friend downloads the app and accepts the match, the other friend is notified with the equivalent message. This second friend DOESN'T see the response of the first friend. If, however, the first friend rejects the match, the second friend is never notified and the match 'disappears'");

      $scope.questions.push("What happens after the second friend is notified?");
      $scope.answers.push("If the second friend downloads the app and accepts the match, both friends (and the matcher!) get a new notification saying they both like each other. They are then able to chat and see where things go ;) If, however, the second friend rejects the match, it simply disappears.");

      $scope.questions.push("Can I match anonymously?");
      $scope.answers.push("On the Android version, you can match anonymously--but there a better chance of your friends accepting if they know who you are! On the iOS verison, you can only match anonymously if both friends in the match have registered.");

      $scope.questions.push("Do I get charged for the text messages that are sent?");
      $scope.answers.push("No, sending the text messages are free for our users. However, the friends who receive the messages can still get charged their normal inbound text message rate, if they have one.");

      $scope.questions.push("I don't want to get any texts from you!");
      $scope.answers.push("We get it. Just reply back 'STOP' (no quotes) to the same phone number that sent you a text. If you don't have that phone number or if it doesn't seem to be working email us at support@matchflare.com");

    }]);