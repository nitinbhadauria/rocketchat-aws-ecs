(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:tutum":{"startup.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_tutum/startup.js                                                                //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
/* Examples

DOCKERCLOUD_REDIS_HOST=redis://:password@host:6379
DOCKERCLOUD_CLIENT_NAME=mywebsite
DOCKERCLOUD_CLIENT_HOST=mywebsite.dotcloud.com
*/if (process.env.DOCKERCLOUD_REDIS_HOST != null) {
	const redis = Npm.require('redis');

	const client = redis.createClient(process.env.DOCKERCLOUD_REDIS_HOST);
	client.on('error', err => console.log('Redis error ->', err));
	client.del(`frontend:${process.env.DOCKERCLOUD_CLIENT_HOST}`);
	client.rpush(`frontend:${process.env.DOCKERCLOUD_CLIENT_HOST}`, process.env.DOCKERCLOUD_CLIENT_NAME);
	const port = process.env.PORT || 3000;
	client.rpush(`frontend:${process.env.DOCKERCLOUD_CLIENT_HOST}`, `http://${process.env.DOCKERCLOUD_IP_ADDRESS.split('/')[0]}:${port}`); // removes the redis entry in 90 seconds on a SIGTERM

	process.on('SIGTERM', () => client.expire(`frontend:${process.env.DOCKERCLOUD_CLIENT_HOST}`, 90));
	process.on('SIGINT', () => client.expire(`frontend:${process.env.DOCKERCLOUD_CLIENT_HOST}`, 90));
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:tutum/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:tutum'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_tutum.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0dXR1bS9zdGFydHVwLmpzIl0sIm5hbWVzIjpbInByb2Nlc3MiLCJlbnYiLCJET0NLRVJDTE9VRF9SRURJU19IT1NUIiwicmVkaXMiLCJOcG0iLCJyZXF1aXJlIiwiY2xpZW50IiwiY3JlYXRlQ2xpZW50Iiwib24iLCJlcnIiLCJjb25zb2xlIiwibG9nIiwiZGVsIiwiRE9DS0VSQ0xPVURfQ0xJRU5UX0hPU1QiLCJycHVzaCIsIkRPQ0tFUkNMT1VEX0NMSUVOVF9OQU1FIiwicG9ydCIsIlBPUlQiLCJET0NLRVJDTE9VRF9JUF9BRERSRVNTIiwic3BsaXQiLCJleHBpcmUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7RUFPQSxJQUFJQSxRQUFRQyxHQUFSLENBQVlDLHNCQUFaLElBQXNDLElBQTFDLEVBQWdEO0FBQy9DLE9BQU1DLFFBQVFDLElBQUlDLE9BQUosQ0FBWSxPQUFaLENBQWQ7O0FBRUEsT0FBTUMsU0FBU0gsTUFBTUksWUFBTixDQUFtQlAsUUFBUUMsR0FBUixDQUFZQyxzQkFBL0IsQ0FBZjtBQUVBSSxRQUFPRSxFQUFQLENBQVUsT0FBVixFQUFtQkMsT0FBT0MsUUFBUUMsR0FBUixDQUFZLGdCQUFaLEVBQThCRixHQUE5QixDQUExQjtBQUVBSCxRQUFPTSxHQUFQLENBQVksWUFBWVosUUFBUUMsR0FBUixDQUFZWSx1QkFBeUIsRUFBN0Q7QUFDQVAsUUFBT1EsS0FBUCxDQUFjLFlBQVlkLFFBQVFDLEdBQVIsQ0FBWVksdUJBQXlCLEVBQS9ELEVBQWtFYixRQUFRQyxHQUFSLENBQVljLHVCQUE5RTtBQUVBLE9BQU1DLE9BQU9oQixRQUFRQyxHQUFSLENBQVlnQixJQUFaLElBQW9CLElBQWpDO0FBQ0FYLFFBQU9RLEtBQVAsQ0FBYyxZQUFZZCxRQUFRQyxHQUFSLENBQVlZLHVCQUF5QixFQUEvRCxFQUFtRSxVQUFVYixRQUFRQyxHQUFSLENBQVlpQixzQkFBWixDQUFtQ0MsS0FBbkMsQ0FBeUMsR0FBekMsRUFBOEMsQ0FBOUMsQ0FBa0QsSUFBSUgsSUFBTSxFQUF6SSxFQVgrQyxDQWEvQzs7QUFDQWhCLFNBQVFRLEVBQVIsQ0FBVyxTQUFYLEVBQXNCLE1BQU1GLE9BQU9jLE1BQVAsQ0FBZSxZQUFZcEIsUUFBUUMsR0FBUixDQUFZWSx1QkFBeUIsRUFBaEUsRUFBbUUsRUFBbkUsQ0FBNUI7QUFFQWIsU0FBUVEsRUFBUixDQUFXLFFBQVgsRUFBcUIsTUFBTUYsT0FBT2MsTUFBUCxDQUFlLFlBQVlwQixRQUFRQyxHQUFSLENBQVlZLHVCQUF5QixFQUFoRSxFQUFtRSxFQUFuRSxDQUEzQjtBQUNBLEMiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfdHV0dW0uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBFeGFtcGxlc1xuXG5ET0NLRVJDTE9VRF9SRURJU19IT1NUPXJlZGlzOi8vOnBhc3N3b3JkQGhvc3Q6NjM3OVxuRE9DS0VSQ0xPVURfQ0xJRU5UX05BTUU9bXl3ZWJzaXRlXG5ET0NLRVJDTE9VRF9DTElFTlRfSE9TVD1teXdlYnNpdGUuZG90Y2xvdWQuY29tXG4qL1xuXG5pZiAocHJvY2Vzcy5lbnYuRE9DS0VSQ0xPVURfUkVESVNfSE9TVCAhPSBudWxsKSB7XG5cdGNvbnN0IHJlZGlzID0gTnBtLnJlcXVpcmUoJ3JlZGlzJyk7XG5cblx0Y29uc3QgY2xpZW50ID0gcmVkaXMuY3JlYXRlQ2xpZW50KHByb2Nlc3MuZW52LkRPQ0tFUkNMT1VEX1JFRElTX0hPU1QpO1xuXG5cdGNsaWVudC5vbignZXJyb3InLCBlcnIgPT4gY29uc29sZS5sb2coJ1JlZGlzIGVycm9yIC0+JywgZXJyKSk7XG5cblx0Y2xpZW50LmRlbChgZnJvbnRlbmQ6JHsgcHJvY2Vzcy5lbnYuRE9DS0VSQ0xPVURfQ0xJRU5UX0hPU1QgfWApO1xuXHRjbGllbnQucnB1c2goYGZyb250ZW5kOiR7IHByb2Nlc3MuZW52LkRPQ0tFUkNMT1VEX0NMSUVOVF9IT1NUIH1gLCBwcm9jZXNzLmVudi5ET0NLRVJDTE9VRF9DTElFTlRfTkFNRSk7XG5cblx0Y29uc3QgcG9ydCA9IHByb2Nlc3MuZW52LlBPUlQgfHwgMzAwMDtcblx0Y2xpZW50LnJwdXNoKGBmcm9udGVuZDokeyBwcm9jZXNzLmVudi5ET0NLRVJDTE9VRF9DTElFTlRfSE9TVCB9YCwgYGh0dHA6Ly8keyBwcm9jZXNzLmVudi5ET0NLRVJDTE9VRF9JUF9BRERSRVNTLnNwbGl0KCcvJylbMF0gfTokeyBwb3J0IH1gKTtcblxuXHQvLyByZW1vdmVzIHRoZSByZWRpcyBlbnRyeSBpbiA5MCBzZWNvbmRzIG9uIGEgU0lHVEVSTVxuXHRwcm9jZXNzLm9uKCdTSUdURVJNJywgKCkgPT4gY2xpZW50LmV4cGlyZShgZnJvbnRlbmQ6JHsgcHJvY2Vzcy5lbnYuRE9DS0VSQ0xPVURfQ0xJRU5UX0hPU1QgfWAsIDkwKSk7XG5cblx0cHJvY2Vzcy5vbignU0lHSU5UJywgKCkgPT4gY2xpZW50LmV4cGlyZShgZnJvbnRlbmQ6JHsgcHJvY2Vzcy5lbnYuRE9DS0VSQ0xPVURfQ0xJRU5UX0hPU1QgfWAsIDkwKSk7XG59XG4iXX0=
