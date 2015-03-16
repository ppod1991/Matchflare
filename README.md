# Matchflare
Matchflare Back-End and Web App. 

Matchflare is a mobile app that lets you set up your friends. This repo contains the back-end and web app for Matchflare.

The back-end was built with NodeJS and PostgreSQL.

## Components

###Instructional View Pager

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/instructions.gif)


###SMS-Based Authentication
* Uses Nexmo SMS Gateway

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/sms_auth.gif)


###Picture Upload
* Take a picture using the camera or upload a previously stored one. Uploads the image to Amazon S3.

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/pic_upload.gif)

###Main UI
* Swipe Left or Right to match (or pass) on pairs of friends. 
* Tinder-esque interface
* Uses default pictures for unregistered users
* Gender prediction based on first name
* Loads friends from Android and iOS contact API

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/choose_friend.gif)

###Search Across Friends
* Match a specific friend if you have someone in mind.

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/search_friends.gif)

###Picture Upload
* Take a picture using the camera or upload a previously stored one. Uploads the image to Amazon S3.

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/pic_upload.gif)

###Push Notifications
* Custom APNS and GCM Push notifications
* Sorted by most recent activity and date
* Collapsible menus

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/notifications.gif)

###Real-time Chat
* Real-time chat server over websockets
* Autobahn Library for Android
* ws library for nodeJS
* SocketRocket for iOS

![Instructions] (http://www.piyushpoddar.com/public/images/gifs/matchflare/android/chat.gif)
