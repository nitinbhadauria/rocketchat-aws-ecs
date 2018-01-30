(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var CustomOAuth = Package['rocketchat:custom-oauth'].CustomOAuth;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:wordpress":{"common.js":function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/rocketchat_wordpress/common.js                                       //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
/* globals CustomOAuth */const config = {
	serverURL: '',
	identityPath: '/oauth/me',
	addAutopublishFields: {
		forLoggedInUser: ['services.wordpress'],
		forOtherUsers: ['services.wordpress.user_login']
	}
};
const WordPress = new CustomOAuth('wordpress', config);

if (Meteor.isServer) {
	Meteor.startup(function () {
		return RocketChat.settings.get('API_Wordpress_URL', function (key, value) {
			config.serverURL = value;
			return WordPress.configure(config);
		});
	});
} else {
	Meteor.startup(function () {
		return Tracker.autorun(function () {
			if (RocketChat.settings.get('API_Wordpress_URL')) {
				config.serverURL = RocketChat.settings.get('API_Wordpress_URL');
				return WordPress.configure(config);
			}
		});
	});
}
///////////////////////////////////////////////////////////////////////////////////

},"startup.js":function(){

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/rocketchat_wordpress/startup.js                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
RocketChat.settings.addGroup('OAuth', function () {
	return this.section('WordPress', function () {
		const enableQuery = {
			_id: 'Accounts_OAuth_Wordpress',
			value: true
		};
		this.add('Accounts_OAuth_Wordpress', false, {
			type: 'boolean',
			'public': true
		});
		this.add('API_Wordpress_URL', '', {
			type: 'string',
			enableQuery,
			'public': true
		});
		this.add('Accounts_OAuth_Wordpress_id', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Wordpress_secret', '', {
			type: 'string',
			enableQuery
		});
		return this.add('Accounts_OAuth_Wordpress_callback_url', '_oauth/wordpress', {
			type: 'relativeUrl',
			readonly: true,
			force: true,
			enableQuery
		});
	});
});
///////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:wordpress/common.js");
require("./node_modules/meteor/rocketchat:wordpress/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:wordpress'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_wordpress.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp3b3JkcHJlc3MvY29tbW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OndvcmRwcmVzcy9zdGFydHVwLmpzIl0sIm5hbWVzIjpbImNvbmZpZyIsInNlcnZlclVSTCIsImlkZW50aXR5UGF0aCIsImFkZEF1dG9wdWJsaXNoRmllbGRzIiwiZm9yTG9nZ2VkSW5Vc2VyIiwiZm9yT3RoZXJVc2VycyIsIldvcmRQcmVzcyIsIkN1c3RvbU9BdXRoIiwiTWV0ZW9yIiwiaXNTZXJ2ZXIiLCJzdGFydHVwIiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiZ2V0Iiwia2V5IiwidmFsdWUiLCJjb25maWd1cmUiLCJUcmFja2VyIiwiYXV0b3J1biIsImFkZEdyb3VwIiwic2VjdGlvbiIsImVuYWJsZVF1ZXJ5IiwiX2lkIiwiYWRkIiwidHlwZSIsInJlYWRvbmx5IiwiZm9yY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEseUJBRUEsTUFBTUEsU0FBUztBQUNkQyxZQUFXLEVBREc7QUFFZEMsZUFBYyxXQUZBO0FBR2RDLHVCQUFzQjtBQUNyQkMsbUJBQWlCLENBQUMsb0JBQUQsQ0FESTtBQUVyQkMsaUJBQWUsQ0FBQywrQkFBRDtBQUZNO0FBSFIsQ0FBZjtBQVNBLE1BQU1DLFlBQVksSUFBSUMsV0FBSixDQUFnQixXQUFoQixFQUE2QlAsTUFBN0IsQ0FBbEI7O0FBRUEsSUFBSVEsT0FBT0MsUUFBWCxFQUFxQjtBQUNwQkQsUUFBT0UsT0FBUCxDQUFlLFlBQVc7QUFDekIsU0FBT0MsV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsbUJBQXhCLEVBQTZDLFVBQVNDLEdBQVQsRUFBY0MsS0FBZCxFQUFxQjtBQUN4RWYsVUFBT0MsU0FBUCxHQUFtQmMsS0FBbkI7QUFDQSxVQUFPVCxVQUFVVSxTQUFWLENBQW9CaEIsTUFBcEIsQ0FBUDtBQUNBLEdBSE0sQ0FBUDtBQUlBLEVBTEQ7QUFNQSxDQVBELE1BT087QUFDTlEsUUFBT0UsT0FBUCxDQUFlLFlBQVc7QUFDekIsU0FBT08sUUFBUUMsT0FBUixDQUFnQixZQUFXO0FBQ2pDLE9BQUlQLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLG1CQUF4QixDQUFKLEVBQWtEO0FBQ2pEYixXQUFPQyxTQUFQLEdBQW1CVSxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QixtQkFBeEIsQ0FBbkI7QUFDQSxXQUFPUCxVQUFVVSxTQUFWLENBQW9CaEIsTUFBcEIsQ0FBUDtBQUNBO0FBQ0QsR0FMTSxDQUFQO0FBTUEsRUFQRDtBQVFBLEM7Ozs7Ozs7Ozs7O0FDN0JEVyxXQUFXQyxRQUFYLENBQW9CTyxRQUFwQixDQUE2QixPQUE3QixFQUFzQyxZQUFXO0FBQ2hELFFBQU8sS0FBS0MsT0FBTCxDQUFhLFdBQWIsRUFBMEIsWUFBVztBQUUzQyxRQUFNQyxjQUFjO0FBQ25CQyxRQUFLLDBCQURjO0FBRW5CUCxVQUFPO0FBRlksR0FBcEI7QUFJQSxPQUFLUSxHQUFMLENBQVMsMEJBQVQsRUFBcUMsS0FBckMsRUFBNEM7QUFDM0NDLFNBQU0sU0FEcUM7QUFFM0MsYUFBVTtBQUZpQyxHQUE1QztBQUlBLE9BQUtELEdBQUwsQ0FBUyxtQkFBVCxFQUE4QixFQUE5QixFQUFrQztBQUNqQ0MsU0FBTSxRQUQyQjtBQUVqQ0gsY0FGaUM7QUFHakMsYUFBVTtBQUh1QixHQUFsQztBQUtBLE9BQUtFLEdBQUwsQ0FBUyw2QkFBVCxFQUF3QyxFQUF4QyxFQUE0QztBQUMzQ0MsU0FBTSxRQURxQztBQUUzQ0g7QUFGMkMsR0FBNUM7QUFJQSxPQUFLRSxHQUFMLENBQVMsaUNBQVQsRUFBNEMsRUFBNUMsRUFBZ0Q7QUFDL0NDLFNBQU0sUUFEeUM7QUFFL0NIO0FBRitDLEdBQWhEO0FBSUEsU0FBTyxLQUFLRSxHQUFMLENBQVMsdUNBQVQsRUFBa0Qsa0JBQWxELEVBQXNFO0FBQzVFQyxTQUFNLGFBRHNFO0FBRTVFQyxhQUFVLElBRmtFO0FBRzVFQyxVQUFPLElBSHFFO0FBSTVFTDtBQUo0RSxHQUF0RSxDQUFQO0FBTUEsRUE3Qk0sQ0FBUDtBQThCQSxDQS9CRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3dvcmRwcmVzcy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgQ3VzdG9tT0F1dGggKi9cblxuY29uc3QgY29uZmlnID0ge1xuXHRzZXJ2ZXJVUkw6ICcnLFxuXHRpZGVudGl0eVBhdGg6ICcvb2F1dGgvbWUnLFxuXHRhZGRBdXRvcHVibGlzaEZpZWxkczoge1xuXHRcdGZvckxvZ2dlZEluVXNlcjogWydzZXJ2aWNlcy53b3JkcHJlc3MnXSxcblx0XHRmb3JPdGhlclVzZXJzOiBbJ3NlcnZpY2VzLndvcmRwcmVzcy51c2VyX2xvZ2luJ11cblx0fVxufTtcblxuY29uc3QgV29yZFByZXNzID0gbmV3IEN1c3RvbU9BdXRoKCd3b3JkcHJlc3MnLCBjb25maWcpO1xuXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG5cdE1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX1dvcmRwcmVzc19VUkwnLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0XHRjb25maWcuc2VydmVyVVJMID0gdmFsdWU7XG5cdFx0XHRyZXR1cm4gV29yZFByZXNzLmNvbmZpZ3VyZShjb25maWcpO1xuXHRcdH0pO1xuXHR9KTtcbn0gZWxzZSB7XG5cdE1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9Xb3JkcHJlc3NfVVJMJykpIHtcblx0XHRcdFx0Y29uZmlnLnNlcnZlclVSTCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfV29yZHByZXNzX1VSTCcpO1xuXHRcdFx0XHRyZXR1cm4gV29yZFByZXNzLmNvbmZpZ3VyZShjb25maWcpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn1cbiIsIlJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ09BdXRoJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnNlY3Rpb24oJ1dvcmRQcmVzcycsIGZ1bmN0aW9uKCkge1xuXG5cdFx0Y29uc3QgZW5hYmxlUXVlcnkgPSB7XG5cdFx0XHRfaWQ6ICdBY2NvdW50c19PQXV0aF9Xb3JkcHJlc3MnLFxuXHRcdFx0dmFsdWU6IHRydWVcblx0XHR9O1xuXHRcdHRoaXMuYWRkKCdBY2NvdW50c19PQXV0aF9Xb3JkcHJlc3MnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0J3B1YmxpYyc6IHRydWVcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnQVBJX1dvcmRwcmVzc19VUkwnLCAnJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbmFibGVRdWVyeSxcblx0XHRcdCdwdWJsaWMnOiB0cnVlXG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX1dvcmRwcmVzc19pZCcsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX1dvcmRwcmVzc19zZWNyZXQnLCAnJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbmFibGVRdWVyeVxuXHRcdH0pO1xuXHRcdHJldHVybiB0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfV29yZHByZXNzX2NhbGxiYWNrX3VybCcsICdfb2F1dGgvd29yZHByZXNzJywge1xuXHRcdFx0dHlwZTogJ3JlbGF0aXZlVXJsJyxcblx0XHRcdHJlYWRvbmx5OiB0cnVlLFxuXHRcdFx0Zm9yY2U6IHRydWUsXG5cdFx0XHRlbmFibGVRdWVyeVxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl19
