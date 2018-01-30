(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var CustomOAuth = Package['rocketchat:custom-oauth'].CustomOAuth;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:drupal":{"common.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_drupal/common.js                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
/* global CustomOAuth */ // Drupal Server CallBack URL needs to be http(s)://{rocketchat.server}[:port]/_oauth/drupal
// In RocketChat -> Administration the URL needs to be http(s)://{drupal.server}/
const config = {
	serverURL: '',
	identityPath: '/oauth2/UserInfo',
	authorizePath: '/oauth2/authorize',
	tokenPath: '/oauth2/token',
	scope: 'openid email profile offline_access',
	tokenSentVia: 'payload',
	usernameField: 'preferred_username',
	mergeUsers: true,
	addAutopublishFields: {
		forLoggedInUser: ['services.drupal'],
		forOtherUsers: ['services.drupal.name']
	}
};
const Drupal = new CustomOAuth('drupal', config);

if (Meteor.isServer) {
	Meteor.startup(function () {
		RocketChat.settings.get('API_Drupal_URL', function (key, value) {
			config.serverURL = value;
			Drupal.configure(config);
		});
	});
} else {
	Meteor.startup(function () {
		Tracker.autorun(function () {
			if (RocketChat.settings.get('API_Drupal_URL')) {
				config.serverURL = RocketChat.settings.get('API_Drupal_URL');
				Drupal.configure(config);
			}
		});
	});
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"startup.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_drupal/startup.js                                                                              //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
RocketChat.settings.addGroup('OAuth', function () {
	this.section('Drupal', function () {
		const enableQuery = {
			_id: 'Accounts_OAuth_Drupal',
			value: true
		};
		this.add('Accounts_OAuth_Drupal', false, {
			type: 'boolean'
		});
		this.add('API_Drupal_URL', '', {
			type: 'string',
			public: true,
			enableQuery,
			i18nDescription: 'API_Drupal_URL_Description'
		});
		this.add('Accounts_OAuth_Drupal_id', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Drupal_secret', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Drupal_callback_url', '_oauth/drupal', {
			type: 'relativeUrl',
			readonly: true,
			force: true,
			enableQuery
		});
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:drupal/common.js");
require("./node_modules/meteor/rocketchat:drupal/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:drupal'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_drupal.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpkcnVwYWwvY29tbW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmRydXBhbC9zdGFydHVwLmpzIl0sIm5hbWVzIjpbImNvbmZpZyIsInNlcnZlclVSTCIsImlkZW50aXR5UGF0aCIsImF1dGhvcml6ZVBhdGgiLCJ0b2tlblBhdGgiLCJzY29wZSIsInRva2VuU2VudFZpYSIsInVzZXJuYW1lRmllbGQiLCJtZXJnZVVzZXJzIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwiRHJ1cGFsIiwiQ3VzdG9tT0F1dGgiLCJNZXRlb3IiLCJpc1NlcnZlciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJrZXkiLCJ2YWx1ZSIsImNvbmZpZ3VyZSIsIlRyYWNrZXIiLCJhdXRvcnVuIiwiYWRkR3JvdXAiLCJzZWN0aW9uIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJhZGQiLCJ0eXBlIiwicHVibGljIiwiaTE4bkRlc2NyaXB0aW9uIiwicmVhZG9ubHkiLCJmb3JjZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0IsQ0FFQTtBQUNBO0FBRUEsTUFBTUEsU0FBUztBQUNkQyxZQUFXLEVBREc7QUFFZEMsZUFBYyxrQkFGQTtBQUdkQyxnQkFBZSxtQkFIRDtBQUlkQyxZQUFXLGVBSkc7QUFLZEMsUUFBTyxxQ0FMTztBQU1kQyxlQUFjLFNBTkE7QUFPZEMsZ0JBQWUsb0JBUEQ7QUFRZEMsYUFBWSxJQVJFO0FBU2RDLHVCQUFzQjtBQUNyQkMsbUJBQWlCLENBQUMsaUJBQUQsQ0FESTtBQUVyQkMsaUJBQWUsQ0FBQyxzQkFBRDtBQUZNO0FBVFIsQ0FBZjtBQWVBLE1BQU1DLFNBQVMsSUFBSUMsV0FBSixDQUFnQixRQUFoQixFQUEwQmIsTUFBMUIsQ0FBZjs7QUFFQSxJQUFJYyxPQUFPQyxRQUFYLEVBQXFCO0FBQ3BCRCxRQUFPRSxPQUFQLENBQWUsWUFBVztBQUN6QkMsYUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsZ0JBQXhCLEVBQTBDLFVBQVNDLEdBQVQsRUFBY0MsS0FBZCxFQUFxQjtBQUM5RHJCLFVBQU9DLFNBQVAsR0FBbUJvQixLQUFuQjtBQUNBVCxVQUFPVSxTQUFQLENBQWlCdEIsTUFBakI7QUFDQSxHQUhEO0FBSUEsRUFMRDtBQU1BLENBUEQsTUFPTztBQUNOYyxRQUFPRSxPQUFQLENBQWUsWUFBVztBQUN6Qk8sVUFBUUMsT0FBUixDQUFnQixZQUFXO0FBQzFCLE9BQUlQLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGdCQUF4QixDQUFKLEVBQStDO0FBQzlDbkIsV0FBT0MsU0FBUCxHQUFtQmdCLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGdCQUF4QixDQUFuQjtBQUNBUCxXQUFPVSxTQUFQLENBQWlCdEIsTUFBakI7QUFDQTtBQUNELEdBTEQ7QUFNQSxFQVBEO0FBUUEsQzs7Ozs7Ozs7Ozs7QUN0Q0RpQixXQUFXQyxRQUFYLENBQW9CTyxRQUFwQixDQUE2QixPQUE3QixFQUFzQyxZQUFXO0FBQ2hELE1BQUtDLE9BQUwsQ0FBYSxRQUFiLEVBQXVCLFlBQVc7QUFDakMsUUFBTUMsY0FBYztBQUNuQkMsUUFBSyx1QkFEYztBQUVuQlAsVUFBTztBQUZZLEdBQXBCO0FBS0EsT0FBS1EsR0FBTCxDQUFTLHVCQUFULEVBQWtDLEtBQWxDLEVBQXlDO0FBQUVDLFNBQU07QUFBUixHQUF6QztBQUNBLE9BQUtELEdBQUwsQ0FBUyxnQkFBVCxFQUEyQixFQUEzQixFQUErQjtBQUFFQyxTQUFNLFFBQVI7QUFBa0JDLFdBQVEsSUFBMUI7QUFBZ0NKLGNBQWhDO0FBQTZDSyxvQkFBaUI7QUFBOUQsR0FBL0I7QUFDQSxPQUFLSCxHQUFMLENBQVMsMEJBQVQsRUFBcUMsRUFBckMsRUFBeUM7QUFBRUMsU0FBTSxRQUFSO0FBQWtCSDtBQUFsQixHQUF6QztBQUNBLE9BQUtFLEdBQUwsQ0FBUyw4QkFBVCxFQUF5QyxFQUF6QyxFQUE2QztBQUFFQyxTQUFNLFFBQVI7QUFBa0JIO0FBQWxCLEdBQTdDO0FBQ0EsT0FBS0UsR0FBTCxDQUFTLG9DQUFULEVBQStDLGVBQS9DLEVBQWdFO0FBQUVDLFNBQU0sYUFBUjtBQUF1QkcsYUFBVSxJQUFqQztBQUF1Q0MsVUFBTyxJQUE5QztBQUFvRFA7QUFBcEQsR0FBaEU7QUFDQSxFQVhEO0FBWUEsQ0FiRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2RydXBhbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBDdXN0b21PQXV0aCAqL1xuXG4vLyBEcnVwYWwgU2VydmVyIENhbGxCYWNrIFVSTCBuZWVkcyB0byBiZSBodHRwKHMpOi8ve3JvY2tldGNoYXQuc2VydmVyfVs6cG9ydF0vX29hdXRoL2RydXBhbFxuLy8gSW4gUm9ja2V0Q2hhdCAtPiBBZG1pbmlzdHJhdGlvbiB0aGUgVVJMIG5lZWRzIHRvIGJlIGh0dHAocyk6Ly97ZHJ1cGFsLnNlcnZlcn0vXG5cbmNvbnN0IGNvbmZpZyA9IHtcblx0c2VydmVyVVJMOiAnJyxcblx0aWRlbnRpdHlQYXRoOiAnL29hdXRoMi9Vc2VySW5mbycsXG5cdGF1dGhvcml6ZVBhdGg6ICcvb2F1dGgyL2F1dGhvcml6ZScsXG5cdHRva2VuUGF0aDogJy9vYXV0aDIvdG9rZW4nLFxuXHRzY29wZTogJ29wZW5pZCBlbWFpbCBwcm9maWxlIG9mZmxpbmVfYWNjZXNzJyxcblx0dG9rZW5TZW50VmlhOiAncGF5bG9hZCcsXG5cdHVzZXJuYW1lRmllbGQ6ICdwcmVmZXJyZWRfdXNlcm5hbWUnLFxuXHRtZXJnZVVzZXJzOiB0cnVlLFxuXHRhZGRBdXRvcHVibGlzaEZpZWxkczoge1xuXHRcdGZvckxvZ2dlZEluVXNlcjogWydzZXJ2aWNlcy5kcnVwYWwnXSxcblx0XHRmb3JPdGhlclVzZXJzOiBbJ3NlcnZpY2VzLmRydXBhbC5uYW1lJ11cblx0fVxufTtcblxuY29uc3QgRHJ1cGFsID0gbmV3IEN1c3RvbU9BdXRoKCdkcnVwYWwnLCBjb25maWcpO1xuXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG5cdE1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRHJ1cGFsX1VSTCcsIGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRcdGNvbmZpZy5zZXJ2ZXJVUkwgPSB2YWx1ZTtcblx0XHRcdERydXBhbC5jb25maWd1cmUoY29uZmlnKTtcblx0XHR9KTtcblx0fSk7XG59IGVsc2Uge1xuXHRNZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0XHRUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9EcnVwYWxfVVJMJykpIHtcblx0XHRcdFx0Y29uZmlnLnNlcnZlclVSTCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRHJ1cGFsX1VSTCcpO1xuXHRcdFx0XHREcnVwYWwuY29uZmlndXJlKGNvbmZpZyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufVxuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnT0F1dGgnLCBmdW5jdGlvbigpIHtcblx0dGhpcy5zZWN0aW9uKCdEcnVwYWwnLCBmdW5jdGlvbigpIHtcblx0XHRjb25zdCBlbmFibGVRdWVyeSA9IHtcblx0XHRcdF9pZDogJ0FjY291bnRzX09BdXRoX0RydXBhbCcsXG5cdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdH07XG5cblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfRHJ1cGFsJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfRHJ1cGFsX1VSTCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBwdWJsaWM6IHRydWUsIGVuYWJsZVF1ZXJ5LCBpMThuRGVzY3JpcHRpb246ICdBUElfRHJ1cGFsX1VSTF9EZXNjcmlwdGlvbicgfSk7XG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX0RydXBhbF9pZCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfRHJ1cGFsX3NlY3JldCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfRHJ1cGFsX2NhbGxiYWNrX3VybCcsICdfb2F1dGgvZHJ1cGFsJywgeyB0eXBlOiAncmVsYXRpdmVVcmwnLCByZWFkb25seTogdHJ1ZSwgZm9yY2U6IHRydWUsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR9KTtcbn0pO1xuIl19
