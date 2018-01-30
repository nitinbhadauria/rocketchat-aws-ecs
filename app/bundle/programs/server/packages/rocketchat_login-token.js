(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Accounts = Package['accounts-base'].Accounts;
var ECMAScript = Package.ecmascript.ECMAScript;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:login-token":{"server":{"login_token_server.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
// packages/rocketchat_login-token/server/login_token_server.js                        //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////
                                                                                       //
/* globals Accounts */Accounts.registerLoginHandler('login-token', function (result) {
	if (!result.loginToken) {
		return;
	}

	const user = Meteor.users.findOne({
		'services.loginToken.token': result.loginToken
	});

	if (user) {
		Meteor.users.update({
			_id: user._id
		}, {
			$unset: {
				'services.loginToken': 1
			}
		});
		return {
			userId: user._id
		};
	}
});
/////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:login-token/server/login_token_server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:login-token'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_login-token.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsb2dpbi10b2tlbi9zZXJ2ZXIvbG9naW5fdG9rZW5fc2VydmVyLmpzIl0sIm5hbWVzIjpbIkFjY291bnRzIiwicmVnaXN0ZXJMb2dpbkhhbmRsZXIiLCJyZXN1bHQiLCJsb2dpblRva2VuIiwidXNlciIsIk1ldGVvciIsInVzZXJzIiwiZmluZE9uZSIsInVwZGF0ZSIsIl9pZCIsIiR1bnNldCIsInVzZXJJZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxzQkFFQUEsU0FBU0Msb0JBQVQsQ0FBOEIsYUFBOUIsRUFBNkMsVUFBU0MsTUFBVCxFQUFpQjtBQUM3RCxLQUFJLENBQUNBLE9BQU9DLFVBQVosRUFBd0I7QUFDdkI7QUFDQTs7QUFFRCxPQUFNQyxPQUFPQyxPQUFPQyxLQUFQLENBQWFDLE9BQWIsQ0FBcUI7QUFDakMsK0JBQTZCTCxPQUFPQztBQURILEVBQXJCLENBQWI7O0FBSUEsS0FBSUMsSUFBSixFQUFVO0FBQ1RDLFNBQU9DLEtBQVAsQ0FBYUUsTUFBYixDQUFvQjtBQUFDQyxRQUFLTCxLQUFLSztBQUFYLEdBQXBCLEVBQXFDO0FBQUNDLFdBQVE7QUFBQywyQkFBdUI7QUFBeEI7QUFBVCxHQUFyQztBQUVBLFNBQU87QUFDTkMsV0FBUVAsS0FBS0s7QUFEUCxHQUFQO0FBR0E7QUFDRCxDQWhCRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2xvZ2luLXRva2VuLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBBY2NvdW50cyAqL1xuXG5BY2NvdW50cy5yZWdpc3RlckxvZ2luSGFuZGxlcignbG9naW4tdG9rZW4nLCBmdW5jdGlvbihyZXN1bHQpIHtcblx0aWYgKCFyZXN1bHQubG9naW5Ub2tlbikge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZSh7XG5cdFx0J3NlcnZpY2VzLmxvZ2luVG9rZW4udG9rZW4nOiByZXN1bHQubG9naW5Ub2tlblxuXHR9KTtcblxuXHRpZiAodXNlcikge1xuXHRcdE1ldGVvci51c2Vycy51cGRhdGUoe19pZDogdXNlci5faWR9LCB7JHVuc2V0OiB7J3NlcnZpY2VzLmxvZ2luVG9rZW4nOiAxfX0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHVzZXJJZDogdXNlci5faWRcblx0XHR9O1xuXHR9XG59KTtcbiJdfQ==
