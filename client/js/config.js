'use strict';

// Declare app level module which depends on filters, and services
angular.module('matchflareApp.config',['ngRoute'])

app.config(['$routeProvider',
    function($routeProvider) {

      $routeProvider
      .when('/',{templateUrl:'build/html/landing/landing.html'})
      .when('/m/:encoded_pair_id',  { templateUrl: 'build/html/match/match.html' })
      .when('/privacy',{templateUrl:'build/html/privacy/privacy.html'})
      .when('/contact',{templateUrl:'build/html/contact/contact.html'})
      .otherwise(       { redirectTo: '/' });
    }]);