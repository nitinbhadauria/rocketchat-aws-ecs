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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:gitlab":{"common.js":function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/rocketchat_gitlab/common.js                              //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
/* global CustomOAuth */const config = {
	serverURL: 'https://gitlab.com',
	identityPath: '/api/v3/user',
	scope: 'api',
	addAutopublishFields: {
		forLoggedInUser: ['services.gitlab'],
		forOtherUsers: ['services.gitlab.username']
	}
};
const Gitlab = new CustomOAuth('gitlab', config);

if (Meteor.isServer) {
	Meteor.startup(function () {
		RocketChat.settings.get('API_Gitlab_URL', function (key, value) {
			config.serverURL = value;
			Gitlab.configure(config);
		});
	});
} else {
	Meteor.startup(function () {
		Tracker.autorun(function () {
			if (RocketChat.settings.get('API_Gitlab_URL')) {
				config.serverURL = RocketChat.settings.get('API_Gitlab_URL');
				Gitlab.configure(config);
			}
		});
	});
}
///////////////////////////////////////////////////////////////////////

},"startup.js":function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/rocketchat_gitlab/startup.js                             //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
RocketChat.settings.addGroup('OAuth', function () {
	this.section('GitLab', function () {
		const enableQuery = {
			_id: 'Accounts_OAuth_Gitlab',
			value: true
		};
		this.add('Accounts_OAuth_Gitlab', false, {
			type: 'boolean',
			public: true
		});
		this.add('API_Gitlab_URL', '', {
			type: 'string',
			enableQuery,
			public: true
		});
		this.add('Accounts_OAuth_Gitlab_id', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Gitlab_secret', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Gitlab_callback_url', '_oauth/gitlab', {
			type: 'relativeUrl',
			readonly: true,
			force: true,
			enableQuery
		});
	});
});
///////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:gitlab/common.js");
require("./node_modules/meteor/rocketchat:gitlab/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:gitlab'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_gitlab.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpnaXRsYWIvY29tbW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmdpdGxhYi9zdGFydHVwLmpzIl0sIm5hbWVzIjpbImNvbmZpZyIsInNlcnZlclVSTCIsImlkZW50aXR5UGF0aCIsInNjb3BlIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwiR2l0bGFiIiwiQ3VzdG9tT0F1dGgiLCJNZXRlb3IiLCJpc1NlcnZlciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJrZXkiLCJ2YWx1ZSIsImNvbmZpZ3VyZSIsIlRyYWNrZXIiLCJhdXRvcnVuIiwiYWRkR3JvdXAiLCJzZWN0aW9uIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJhZGQiLCJ0eXBlIiwicHVibGljIiwicmVhZG9ubHkiLCJmb3JjZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3QkFDQSxNQUFNQSxTQUFTO0FBQ2RDLFlBQVcsb0JBREc7QUFFZEMsZUFBYyxjQUZBO0FBR2RDLFFBQU8sS0FITztBQUlkQyx1QkFBc0I7QUFDckJDLG1CQUFpQixDQUFDLGlCQUFELENBREk7QUFFckJDLGlCQUFlLENBQUMsMEJBQUQ7QUFGTTtBQUpSLENBQWY7QUFVQSxNQUFNQyxTQUFTLElBQUlDLFdBQUosQ0FBZ0IsUUFBaEIsRUFBMEJSLE1BQTFCLENBQWY7O0FBRUEsSUFBSVMsT0FBT0MsUUFBWCxFQUFxQjtBQUNwQkQsUUFBT0UsT0FBUCxDQUFlLFlBQVc7QUFDekJDLGFBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGdCQUF4QixFQUEwQyxVQUFTQyxHQUFULEVBQWNDLEtBQWQsRUFBcUI7QUFDOURoQixVQUFPQyxTQUFQLEdBQW1CZSxLQUFuQjtBQUNBVCxVQUFPVSxTQUFQLENBQWlCakIsTUFBakI7QUFDQSxHQUhEO0FBSUEsRUFMRDtBQU1BLENBUEQsTUFPTztBQUNOUyxRQUFPRSxPQUFQLENBQWUsWUFBVztBQUN6Qk8sVUFBUUMsT0FBUixDQUFnQixZQUFXO0FBQzFCLE9BQUlQLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGdCQUF4QixDQUFKLEVBQStDO0FBQzlDZCxXQUFPQyxTQUFQLEdBQW1CVyxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QixnQkFBeEIsQ0FBbkI7QUFDQVAsV0FBT1UsU0FBUCxDQUFpQmpCLE1BQWpCO0FBQ0E7QUFDRCxHQUxEO0FBTUEsRUFQRDtBQVFBLEM7Ozs7Ozs7Ozs7O0FDN0JEWSxXQUFXQyxRQUFYLENBQW9CTyxRQUFwQixDQUE2QixPQUE3QixFQUFzQyxZQUFXO0FBQ2hELE1BQUtDLE9BQUwsQ0FBYSxRQUFiLEVBQXVCLFlBQVc7QUFDakMsUUFBTUMsY0FBYztBQUNuQkMsUUFBSyx1QkFEYztBQUVuQlAsVUFBTztBQUZZLEdBQXBCO0FBS0EsT0FBS1EsR0FBTCxDQUFTLHVCQUFULEVBQWtDLEtBQWxDLEVBQXlDO0FBQUVDLFNBQU0sU0FBUjtBQUFtQkMsV0FBUTtBQUEzQixHQUF6QztBQUNBLE9BQUtGLEdBQUwsQ0FBUyxnQkFBVCxFQUEyQixFQUEzQixFQUErQjtBQUFFQyxTQUFNLFFBQVI7QUFBa0JILGNBQWxCO0FBQStCSSxXQUFRO0FBQXZDLEdBQS9CO0FBQ0EsT0FBS0YsR0FBTCxDQUFTLDBCQUFULEVBQXFDLEVBQXJDLEVBQXlDO0FBQUVDLFNBQU0sUUFBUjtBQUFrQkg7QUFBbEIsR0FBekM7QUFDQSxPQUFLRSxHQUFMLENBQVMsOEJBQVQsRUFBeUMsRUFBekMsRUFBNkM7QUFBRUMsU0FBTSxRQUFSO0FBQWtCSDtBQUFsQixHQUE3QztBQUNBLE9BQUtFLEdBQUwsQ0FBUyxvQ0FBVCxFQUErQyxlQUEvQyxFQUFnRTtBQUFFQyxTQUFNLGFBQVI7QUFBdUJFLGFBQVUsSUFBakM7QUFBdUNDLFVBQU8sSUFBOUM7QUFBb0ROO0FBQXBELEdBQWhFO0FBQ0EsRUFYRDtBQVlBLENBYkQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9naXRsYWIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWwgQ3VzdG9tT0F1dGggKi9cbmNvbnN0IGNvbmZpZyA9IHtcblx0c2VydmVyVVJMOiAnaHR0cHM6Ly9naXRsYWIuY29tJyxcblx0aWRlbnRpdHlQYXRoOiAnL2FwaS92My91c2VyJyxcblx0c2NvcGU6ICdhcGknLFxuXHRhZGRBdXRvcHVibGlzaEZpZWxkczoge1xuXHRcdGZvckxvZ2dlZEluVXNlcjogWydzZXJ2aWNlcy5naXRsYWInXSxcblx0XHRmb3JPdGhlclVzZXJzOiBbJ3NlcnZpY2VzLmdpdGxhYi51c2VybmFtZSddXG5cdH1cbn07XG5cbmNvbnN0IEdpdGxhYiA9IG5ldyBDdXN0b21PQXV0aCgnZ2l0bGFiJywgY29uZmlnKTtcblxuaWYgKE1ldGVvci5pc1NlcnZlcikge1xuXHRNZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX0dpdGxhYl9VUkwnLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0XHRjb25maWcuc2VydmVyVVJMID0gdmFsdWU7XG5cdFx0XHRHaXRsYWIuY29uZmlndXJlKGNvbmZpZyk7XG5cdFx0fSk7XG5cdH0pO1xufSBlbHNlIHtcblx0TWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFx0VHJhY2tlci5hdXRvcnVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfR2l0bGFiX1VSTCcpKSB7XG5cdFx0XHRcdGNvbmZpZy5zZXJ2ZXJVUkwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX0dpdGxhYl9VUkwnKTtcblx0XHRcdFx0R2l0bGFiLmNvbmZpZ3VyZShjb25maWcpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn1cbiIsIlJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ09BdXRoJywgZnVuY3Rpb24oKSB7XG5cdHRoaXMuc2VjdGlvbignR2l0TGFiJywgZnVuY3Rpb24oKSB7XG5cdFx0Y29uc3QgZW5hYmxlUXVlcnkgPSB7XG5cdFx0XHRfaWQ6ICdBY2NvdW50c19PQXV0aF9HaXRsYWInLFxuXHRcdFx0dmFsdWU6IHRydWVcblx0XHR9O1xuXG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX0dpdGxhYicsIGZhbHNlLCB7IHR5cGU6ICdib29sZWFuJywgcHVibGljOiB0cnVlIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfR2l0bGFiX1VSTCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSwgcHVibGljOiB0cnVlIH0pO1xuXHRcdHRoaXMuYWRkKCdBY2NvdW50c19PQXV0aF9HaXRsYWJfaWQnLCAnJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX0dpdGxhYl9zZWNyZXQnLCAnJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX0dpdGxhYl9jYWxsYmFja191cmwnLCAnX29hdXRoL2dpdGxhYicsIHsgdHlwZTogJ3JlbGF0aXZlVXJsJywgcmVhZG9ubHk6IHRydWUsIGZvcmNlOiB0cnVlLCBlbmFibGVRdWVyeSB9KTtcblx0fSk7XG59KTtcbiJdfQ==
