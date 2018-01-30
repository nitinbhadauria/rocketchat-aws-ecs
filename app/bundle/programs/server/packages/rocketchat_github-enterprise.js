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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:github-enterprise":{"common.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                           //
// packages/rocketchat_github-enterprise/common.js                                           //
//                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////
                                                                                             //
/* global CustomOAuth */ // GitHub Enterprise Server CallBack URL needs to be http(s)://{rocketchat.server}[:port]/_oauth/github_enterprise
// In RocketChat -> Administration the URL needs to be http(s)://{github.enterprise.server}/
const config = {
	serverURL: '',
	identityPath: '/api/v3/user',
	authorizePath: '/login/oauth/authorize',
	tokenPath: '/login/oauth/access_token',
	addAutopublishFields: {
		forLoggedInUser: ['services.github-enterprise'],
		forOtherUsers: ['services.github-enterprise.username']
	}
};
const GitHubEnterprise = new CustomOAuth('github_enterprise', config);

if (Meteor.isServer) {
	Meteor.startup(function () {
		RocketChat.settings.get('API_GitHub_Enterprise_URL', function (key, value) {
			config.serverURL = value;
			GitHubEnterprise.configure(config);
		});
	});
} else {
	Meteor.startup(function () {
		Tracker.autorun(function () {
			if (RocketChat.settings.get('API_GitHub_Enterprise_URL')) {
				config.serverURL = RocketChat.settings.get('API_GitHub_Enterprise_URL');
				GitHubEnterprise.configure(config);
			}
		});
	});
}
///////////////////////////////////////////////////////////////////////////////////////////////

},"startup.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                           //
// packages/rocketchat_github-enterprise/startup.js                                          //
//                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////
                                                                                             //
RocketChat.settings.addGroup('OAuth', function () {
	this.section('GitHub Enterprise', function () {
		const enableQuery = {
			_id: 'Accounts_OAuth_GitHub_Enterprise',
			value: true
		};
		this.add('Accounts_OAuth_GitHub_Enterprise', false, {
			type: 'boolean'
		});
		this.add('API_GitHub_Enterprise_URL', '', {
			type: 'string',
			public: true,
			enableQuery,
			i18nDescription: 'API_GitHub_Enterprise_URL_Description'
		});
		this.add('Accounts_OAuth_GitHub_Enterprise_id', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_GitHub_Enterprise_secret', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_GitHub_Enterprise_callback_url', '_oauth/github_enterprise', {
			type: 'relativeUrl',
			readonly: true,
			force: true,
			enableQuery
		});
	});
});
///////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:github-enterprise/common.js");
require("./node_modules/meteor/rocketchat:github-enterprise/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:github-enterprise'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_github-enterprise.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpnaXRodWItZW50ZXJwcmlzZS9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Z2l0aHViLWVudGVycHJpc2Uvc3RhcnR1cC5qcyJdLCJuYW1lcyI6WyJjb25maWciLCJzZXJ2ZXJVUkwiLCJpZGVudGl0eVBhdGgiLCJhdXRob3JpemVQYXRoIiwidG9rZW5QYXRoIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwiR2l0SHViRW50ZXJwcmlzZSIsIkN1c3RvbU9BdXRoIiwiTWV0ZW9yIiwiaXNTZXJ2ZXIiLCJzdGFydHVwIiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiZ2V0Iiwia2V5IiwidmFsdWUiLCJjb25maWd1cmUiLCJUcmFja2VyIiwiYXV0b3J1biIsImFkZEdyb3VwIiwic2VjdGlvbiIsImVuYWJsZVF1ZXJ5IiwiX2lkIiwiYWRkIiwidHlwZSIsInB1YmxpYyIsImkxOG5EZXNjcmlwdGlvbiIsInJlYWRvbmx5IiwiZm9yY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0IsQ0FFQTtBQUNBO0FBRUEsTUFBTUEsU0FBUztBQUNkQyxZQUFXLEVBREc7QUFFZEMsZUFBYyxjQUZBO0FBR2RDLGdCQUFlLHdCQUhEO0FBSWRDLFlBQVcsMkJBSkc7QUFLZEMsdUJBQXNCO0FBQ3JCQyxtQkFBaUIsQ0FBQyw0QkFBRCxDQURJO0FBRXJCQyxpQkFBZSxDQUFDLHFDQUFEO0FBRk07QUFMUixDQUFmO0FBV0EsTUFBTUMsbUJBQW1CLElBQUlDLFdBQUosQ0FBZ0IsbUJBQWhCLEVBQXFDVCxNQUFyQyxDQUF6Qjs7QUFFQSxJQUFJVSxPQUFPQyxRQUFYLEVBQXFCO0FBQ3BCRCxRQUFPRSxPQUFQLENBQWUsWUFBVztBQUN6QkMsYUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsMkJBQXhCLEVBQXFELFVBQVNDLEdBQVQsRUFBY0MsS0FBZCxFQUFxQjtBQUN6RWpCLFVBQU9DLFNBQVAsR0FBbUJnQixLQUFuQjtBQUNBVCxvQkFBaUJVLFNBQWpCLENBQTJCbEIsTUFBM0I7QUFDQSxHQUhEO0FBSUEsRUFMRDtBQU1BLENBUEQsTUFPTztBQUNOVSxRQUFPRSxPQUFQLENBQWUsWUFBVztBQUN6Qk8sVUFBUUMsT0FBUixDQUFnQixZQUFXO0FBQzFCLE9BQUlQLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLDJCQUF4QixDQUFKLEVBQTBEO0FBQ3pEZixXQUFPQyxTQUFQLEdBQW1CWSxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QiwyQkFBeEIsQ0FBbkI7QUFDQVAscUJBQWlCVSxTQUFqQixDQUEyQmxCLE1BQTNCO0FBQ0E7QUFDRCxHQUxEO0FBTUEsRUFQRDtBQVFBLEM7Ozs7Ozs7Ozs7O0FDbENEYSxXQUFXQyxRQUFYLENBQW9CTyxRQUFwQixDQUE2QixPQUE3QixFQUFzQyxZQUFXO0FBQ2hELE1BQUtDLE9BQUwsQ0FBYSxtQkFBYixFQUFrQyxZQUFXO0FBQzVDLFFBQU1DLGNBQWM7QUFDbkJDLFFBQUssa0NBRGM7QUFFbkJQLFVBQU87QUFGWSxHQUFwQjtBQUtBLE9BQUtRLEdBQUwsQ0FBUyxrQ0FBVCxFQUE2QyxLQUE3QyxFQUFvRDtBQUFFQyxTQUFNO0FBQVIsR0FBcEQ7QUFDQSxPQUFLRCxHQUFMLENBQVMsMkJBQVQsRUFBc0MsRUFBdEMsRUFBMEM7QUFBRUMsU0FBTSxRQUFSO0FBQWtCQyxXQUFRLElBQTFCO0FBQWdDSixjQUFoQztBQUE2Q0ssb0JBQWlCO0FBQTlELEdBQTFDO0FBQ0EsT0FBS0gsR0FBTCxDQUFTLHFDQUFULEVBQWdELEVBQWhELEVBQW9EO0FBQUVDLFNBQU0sUUFBUjtBQUFrQkg7QUFBbEIsR0FBcEQ7QUFDQSxPQUFLRSxHQUFMLENBQVMseUNBQVQsRUFBb0QsRUFBcEQsRUFBd0Q7QUFBRUMsU0FBTSxRQUFSO0FBQWtCSDtBQUFsQixHQUF4RDtBQUNBLE9BQUtFLEdBQUwsQ0FBUywrQ0FBVCxFQUEwRCwwQkFBMUQsRUFBc0Y7QUFBRUMsU0FBTSxhQUFSO0FBQXVCRyxhQUFVLElBQWpDO0FBQXVDQyxVQUFPLElBQTlDO0FBQW9EUDtBQUFwRCxHQUF0RjtBQUNBLEVBWEQ7QUFZQSxDQWJELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfZ2l0aHViLWVudGVycHJpc2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWwgQ3VzdG9tT0F1dGggKi9cblxuLy8gR2l0SHViIEVudGVycHJpc2UgU2VydmVyIENhbGxCYWNrIFVSTCBuZWVkcyB0byBiZSBodHRwKHMpOi8ve3JvY2tldGNoYXQuc2VydmVyfVs6cG9ydF0vX29hdXRoL2dpdGh1Yl9lbnRlcnByaXNlXG4vLyBJbiBSb2NrZXRDaGF0IC0+IEFkbWluaXN0cmF0aW9uIHRoZSBVUkwgbmVlZHMgdG8gYmUgaHR0cChzKTovL3tnaXRodWIuZW50ZXJwcmlzZS5zZXJ2ZXJ9L1xuXG5jb25zdCBjb25maWcgPSB7XG5cdHNlcnZlclVSTDogJycsXG5cdGlkZW50aXR5UGF0aDogJy9hcGkvdjMvdXNlcicsXG5cdGF1dGhvcml6ZVBhdGg6ICcvbG9naW4vb2F1dGgvYXV0aG9yaXplJyxcblx0dG9rZW5QYXRoOiAnL2xvZ2luL29hdXRoL2FjY2Vzc190b2tlbicsXG5cdGFkZEF1dG9wdWJsaXNoRmllbGRzOiB7XG5cdFx0Zm9yTG9nZ2VkSW5Vc2VyOiBbJ3NlcnZpY2VzLmdpdGh1Yi1lbnRlcnByaXNlJ10sXG5cdFx0Zm9yT3RoZXJVc2VyczogWydzZXJ2aWNlcy5naXRodWItZW50ZXJwcmlzZS51c2VybmFtZSddXG5cdH1cbn07XG5cbmNvbnN0IEdpdEh1YkVudGVycHJpc2UgPSBuZXcgQ3VzdG9tT0F1dGgoJ2dpdGh1Yl9lbnRlcnByaXNlJywgY29uZmlnKTtcblxuaWYgKE1ldGVvci5pc1NlcnZlcikge1xuXHRNZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX0dpdEh1Yl9FbnRlcnByaXNlX1VSTCcsIGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRcdGNvbmZpZy5zZXJ2ZXJVUkwgPSB2YWx1ZTtcblx0XHRcdEdpdEh1YkVudGVycHJpc2UuY29uZmlndXJlKGNvbmZpZyk7XG5cdFx0fSk7XG5cdH0pO1xufSBlbHNlIHtcblx0TWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFx0VHJhY2tlci5hdXRvcnVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfR2l0SHViX0VudGVycHJpc2VfVVJMJykpIHtcblx0XHRcdFx0Y29uZmlnLnNlcnZlclVSTCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfR2l0SHViX0VudGVycHJpc2VfVVJMJyk7XG5cdFx0XHRcdEdpdEh1YkVudGVycHJpc2UuY29uZmlndXJlKGNvbmZpZyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufVxuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnT0F1dGgnLCBmdW5jdGlvbigpIHtcblx0dGhpcy5zZWN0aW9uKCdHaXRIdWIgRW50ZXJwcmlzZScsIGZ1bmN0aW9uKCkge1xuXHRcdGNvbnN0IGVuYWJsZVF1ZXJ5ID0ge1xuXHRcdFx0X2lkOiAnQWNjb3VudHNfT0F1dGhfR2l0SHViX0VudGVycHJpc2UnLFxuXHRcdFx0dmFsdWU6IHRydWVcblx0XHR9O1xuXG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX0dpdEh1Yl9FbnRlcnByaXNlJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfR2l0SHViX0VudGVycHJpc2VfVVJMJywgJycsIHsgdHlwZTogJ3N0cmluZycsIHB1YmxpYzogdHJ1ZSwgZW5hYmxlUXVlcnksIGkxOG5EZXNjcmlwdGlvbjogJ0FQSV9HaXRIdWJfRW50ZXJwcmlzZV9VUkxfRGVzY3JpcHRpb24nIH0pO1xuXHRcdHRoaXMuYWRkKCdBY2NvdW50c19PQXV0aF9HaXRIdWJfRW50ZXJwcmlzZV9pZCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfR2l0SHViX0VudGVycHJpc2Vfc2VjcmV0JywgJycsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdBY2NvdW50c19PQXV0aF9HaXRIdWJfRW50ZXJwcmlzZV9jYWxsYmFja191cmwnLCAnX29hdXRoL2dpdGh1Yl9lbnRlcnByaXNlJywgeyB0eXBlOiAncmVsYXRpdmVVcmwnLCByZWFkb25seTogdHJ1ZSwgZm9yY2U6IHRydWUsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR9KTtcbn0pO1xuIl19
