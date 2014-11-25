'use strict';

angular.module('matchflareApp.controllers.match', ['matchflareApp.services.match'])
  .controller('matchController', ['$scope','$routeParams','matchService',
    function($scope, $routeParams, matchService) {
      //var encoded_pair_id = $routeParams.params.encoded_pair_id;

      $scope.match = {};
      $scope.getMatch = function(encoded_pair_id) {
        matchService.get({encoded_pair_id: encoded_pair_id},function(response) {
            console.log("Response from getting match:");
            console.log(response);
            $scope.match = response;

        },function(errorResponse) {
            console.log("Error getting match:");
            console.error(errorResponse);
        } );
      };

      $scope.$on('$routeChangeSuccess', function(event, next, current) {
        console.log("Route changed:");
        console.log($routeParams.encoded_pair_id);
        $scope.getMatch($routeParams.encoded_pair_id);
      });

    }]);