'use strict';
 
angular.module('matchflareApp.services.match', ['ngResource'])
    .factory('matchService', ['$resource',
        function($resource) {
            return $resource("/match");               
        }]);