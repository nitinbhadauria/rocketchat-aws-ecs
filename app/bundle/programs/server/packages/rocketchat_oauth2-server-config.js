(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var OAuth2Server = Package['rocketchat:oauth2-server'].OAuth2Server;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:oauth2-server-config":{"server":{"models":{"OAuthApps.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/server/models/OAuthApps.js                                       //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
RocketChat.models.OAuthApps = new class extends RocketChat.models._Base {
	constructor() {
		super('oauth_apps');
	}

}(); // FIND
// findByRole: (role, options) ->
// 	query =
// 	roles: role
// 	return @find query, options
// CREATE
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"oauth":{"server":{"oauth2-server.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/oauth/server/oauth2-server.js                                    //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
const oauth2server = new OAuth2Server({
	accessTokensCollectionName: 'rocketchat_oauth_access_tokens',
	refreshTokensCollectionName: 'rocketchat_oauth_refresh_tokens',
	authCodesCollectionName: 'rocketchat_oauth_auth_codes',
	clientsCollection: RocketChat.models.OAuthApps.model,
	debug: true
});
WebApp.connectHandlers.use(oauth2server.app);
oauth2server.routes.get('/oauth/userinfo', function (req, res) {
	if (req.headers.authorization == null) {
		return res.sendStatus(401).send('No token');
	}

	const accessToken = req.headers.authorization.replace('Bearer ', '');
	const token = oauth2server.oauth.model.AccessTokens.findOne({
		accessToken
	});

	if (token == null) {
		return res.sendStatus(401).send('Invalid Token');
	}

	const user = RocketChat.models.Users.findOneById(token.userId);

	if (user == null) {
		return res.sendStatus(401).send('Invalid Token');
	}

	return res.send({
		sub: user._id,
		name: user.name,
		email: user.emails[0].address,
		email_verified: user.emails[0].verified,
		department: '',
		birthdate: '',
		preffered_username: user.username,
		updated_at: user._updatedAt,
		picture: `${Meteor.absoluteUrl()}avatar/${user.username}`
	});
});
Meteor.publish('oauthClient', function (clientId) {
	if (!this.userId) {
		return this.ready();
	}

	return RocketChat.models.OAuthApps.find({
		clientId,
		active: true
	}, {
		fields: {
			name: 1
		}
	});
});
RocketChat.API.v1.addAuthMethod(function () {
	let headerToken = this.request.headers['authorization'];
	const getToken = this.request.query.access_token;

	if (headerToken != null) {
		const matches = headerToken.match(/Bearer\s(\S+)/);

		if (matches) {
			headerToken = matches[1];
		} else {
			headerToken = undefined;
		}
	}

	const bearerToken = headerToken || getToken;

	if (bearerToken == null) {
		return;
	}

	const getAccessToken = Meteor.wrapAsync(oauth2server.oauth.model.getAccessToken, oauth2server.oauth.model);
	const accessToken = getAccessToken(bearerToken);

	if (accessToken == null) {
		return;
	}

	if (accessToken.expires != null && accessToken.expires !== 0 && accessToken.expires < new Date()) {
		return;
	}

	const user = RocketChat.models.Users.findOne(accessToken.userId);

	if (user == null) {
		return;
	}

	return {
		user: _.omit(user, '$loki')
	};
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"default-services.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/oauth/server/default-services.js                                 //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
if (!RocketChat.models.OAuthApps.findOne('zapier')) {
	RocketChat.models.OAuthApps.insert({
		_id: 'zapier',
		name: 'Zapier',
		active: true,
		clientId: 'zapier',
		clientSecret: 'RTK6TlndaCIolhQhZ7_KHIGOKj41RnlaOq_o-7JKwLr',
		redirectUri: 'https://zapier.com/dashboard/auth/oauth/return/RocketChatDevAPI/',
		_createdAt: new Date(),
		_createdBy: {
			_id: 'system',
			username: 'system'
		}
	});
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"admin":{"server":{"publications":{"oauthApps.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/admin/server/publications/oauthApps.js                           //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
Meteor.publish('oauthApps', function () {
	if (!this.userId) {
		return this.ready();
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'manage-oauth-apps')) {
		this.error(Meteor.Error('error-not-allowed', 'Not allowed', {
			publish: 'oauthApps'
		}));
	}

	return RocketChat.models.OAuthApps.find();
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"addOAuthApp.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/admin/server/methods/addOAuthApp.js                              //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	addOAuthApp(application) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-oauth-apps')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'addOAuthApp'
			});
		}

		if (!_.isString(application.name) || application.name.trim() === '') {
			throw new Meteor.Error('error-invalid-name', 'Invalid name', {
				method: 'addOAuthApp'
			});
		}

		if (!_.isString(application.redirectUri) || application.redirectUri.trim() === '') {
			throw new Meteor.Error('error-invalid-redirectUri', 'Invalid redirectUri', {
				method: 'addOAuthApp'
			});
		}

		if (!_.isBoolean(application.active)) {
			throw new Meteor.Error('error-invalid-arguments', 'Invalid arguments', {
				method: 'addOAuthApp'
			});
		}

		application.clientId = Random.id();
		application.clientSecret = Random.secret();
		application._createdAt = new Date();
		application._createdBy = RocketChat.models.Users.findOne(this.userId, {
			fields: {
				username: 1
			}
		});
		application._id = RocketChat.models.OAuthApps.insert(application);
		return application;
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"updateOAuthApp.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/admin/server/methods/updateOAuthApp.js                           //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	updateOAuthApp(applicationId, application) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-oauth-apps')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'updateOAuthApp'
			});
		}

		if (!_.isString(application.name) || application.name.trim() === '') {
			throw new Meteor.Error('error-invalid-name', 'Invalid name', {
				method: 'updateOAuthApp'
			});
		}

		if (!_.isString(application.redirectUri) || application.redirectUri.trim() === '') {
			throw new Meteor.Error('error-invalid-redirectUri', 'Invalid redirectUri', {
				method: 'updateOAuthApp'
			});
		}

		if (!_.isBoolean(application.active)) {
			throw new Meteor.Error('error-invalid-arguments', 'Invalid arguments', {
				method: 'updateOAuthApp'
			});
		}

		const currentApplication = RocketChat.models.OAuthApps.findOne(applicationId);

		if (currentApplication == null) {
			throw new Meteor.Error('error-application-not-found', 'Application not found', {
				method: 'updateOAuthApp'
			});
		}

		RocketChat.models.OAuthApps.update(applicationId, {
			$set: {
				name: application.name,
				active: application.active,
				redirectUri: application.redirectUri,
				_updatedAt: new Date(),
				_updatedBy: RocketChat.models.Users.findOne(this.userId, {
					fields: {
						username: 1
					}
				})
			}
		});
		return RocketChat.models.OAuthApps.findOne(applicationId);
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"deleteOAuthApp.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/rocketchat_oauth2-server-config/admin/server/methods/deleteOAuthApp.js                           //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
Meteor.methods({
	deleteOAuthApp(applicationId) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-oauth-apps')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'deleteOAuthApp'
			});
		}

		const application = RocketChat.models.OAuthApps.findOne(applicationId);

		if (application == null) {
			throw new Meteor.Error('error-application-not-found', 'Application not found', {
				method: 'deleteOAuthApp'
			});
		}

		RocketChat.models.OAuthApps.remove({
			_id: applicationId
		});
		return true;
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:oauth2-server-config/server/models/OAuthApps.js");
require("./node_modules/meteor/rocketchat:oauth2-server-config/oauth/server/oauth2-server.js");
require("./node_modules/meteor/rocketchat:oauth2-server-config/oauth/server/default-services.js");
require("./node_modules/meteor/rocketchat:oauth2-server-config/admin/server/publications/oauthApps.js");
require("./node_modules/meteor/rocketchat:oauth2-server-config/admin/server/methods/addOAuthApp.js");
require("./node_modules/meteor/rocketchat:oauth2-server-config/admin/server/methods/updateOAuthApp.js");
require("./node_modules/meteor/rocketchat:oauth2-server-config/admin/server/methods/deleteOAuthApp.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:oauth2-server-config'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_oauth2-server-config.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9zZXJ2ZXIvbW9kZWxzL09BdXRoQXBwcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9vYXV0aC9zZXJ2ZXIvb2F1dGgyLXNlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9vYXV0aC9zZXJ2ZXIvZGVmYXVsdC1zZXJ2aWNlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9hZG1pbi9zZXJ2ZXIvcHVibGljYXRpb25zL29hdXRoQXBwcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9hZG1pbi9zZXJ2ZXIvbWV0aG9kcy9hZGRPQXV0aEFwcC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9hZG1pbi9zZXJ2ZXIvbWV0aG9kcy91cGRhdGVPQXV0aEFwcC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvYXV0aDItc2VydmVyLWNvbmZpZy9hZG1pbi9zZXJ2ZXIvbWV0aG9kcy9kZWxldGVPQXV0aEFwcC5qcyJdLCJuYW1lcyI6WyJSb2NrZXRDaGF0IiwibW9kZWxzIiwiT0F1dGhBcHBzIiwiX0Jhc2UiLCJjb25zdHJ1Y3RvciIsIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIm9hdXRoMnNlcnZlciIsIk9BdXRoMlNlcnZlciIsImFjY2Vzc1Rva2Vuc0NvbGxlY3Rpb25OYW1lIiwicmVmcmVzaFRva2Vuc0NvbGxlY3Rpb25OYW1lIiwiYXV0aENvZGVzQ29sbGVjdGlvbk5hbWUiLCJjbGllbnRzQ29sbGVjdGlvbiIsIm1vZGVsIiwiZGVidWciLCJXZWJBcHAiLCJjb25uZWN0SGFuZGxlcnMiLCJ1c2UiLCJhcHAiLCJyb3V0ZXMiLCJnZXQiLCJyZXEiLCJyZXMiLCJoZWFkZXJzIiwiYXV0aG9yaXphdGlvbiIsInNlbmRTdGF0dXMiLCJzZW5kIiwiYWNjZXNzVG9rZW4iLCJyZXBsYWNlIiwidG9rZW4iLCJvYXV0aCIsIkFjY2Vzc1Rva2VucyIsImZpbmRPbmUiLCJ1c2VyIiwiVXNlcnMiLCJmaW5kT25lQnlJZCIsInVzZXJJZCIsInN1YiIsIl9pZCIsIm5hbWUiLCJlbWFpbCIsImVtYWlscyIsImFkZHJlc3MiLCJlbWFpbF92ZXJpZmllZCIsInZlcmlmaWVkIiwiZGVwYXJ0bWVudCIsImJpcnRoZGF0ZSIsInByZWZmZXJlZF91c2VybmFtZSIsInVzZXJuYW1lIiwidXBkYXRlZF9hdCIsIl91cGRhdGVkQXQiLCJwaWN0dXJlIiwiTWV0ZW9yIiwiYWJzb2x1dGVVcmwiLCJwdWJsaXNoIiwiY2xpZW50SWQiLCJyZWFkeSIsImZpbmQiLCJhY3RpdmUiLCJmaWVsZHMiLCJBUEkiLCJ2MSIsImFkZEF1dGhNZXRob2QiLCJoZWFkZXJUb2tlbiIsInJlcXVlc3QiLCJnZXRUb2tlbiIsInF1ZXJ5IiwiYWNjZXNzX3Rva2VuIiwibWF0Y2hlcyIsIm1hdGNoIiwidW5kZWZpbmVkIiwiYmVhcmVyVG9rZW4iLCJnZXRBY2Nlc3NUb2tlbiIsIndyYXBBc3luYyIsImV4cGlyZXMiLCJEYXRlIiwib21pdCIsImluc2VydCIsImNsaWVudFNlY3JldCIsInJlZGlyZWN0VXJpIiwiX2NyZWF0ZWRBdCIsIl9jcmVhdGVkQnkiLCJhdXRoeiIsImhhc1Blcm1pc3Npb24iLCJlcnJvciIsIkVycm9yIiwibWV0aG9kcyIsImFkZE9BdXRoQXBwIiwiYXBwbGljYXRpb24iLCJtZXRob2QiLCJpc1N0cmluZyIsInRyaW0iLCJpc0Jvb2xlYW4iLCJSYW5kb20iLCJpZCIsInNlY3JldCIsInVwZGF0ZU9BdXRoQXBwIiwiYXBwbGljYXRpb25JZCIsImN1cnJlbnRBcHBsaWNhdGlvbiIsInVwZGF0ZSIsIiRzZXQiLCJfdXBkYXRlZEJ5IiwiZGVsZXRlT0F1dGhBcHAiLCJyZW1vdmUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsV0FBV0MsTUFBWCxDQUFrQkMsU0FBbEIsR0FBOEIsSUFBSSxjQUFjRixXQUFXQyxNQUFYLENBQWtCRSxLQUFoQyxDQUFzQztBQUN2RUMsZUFBYztBQUNiLFFBQU0sWUFBTjtBQUNBOztBQUhzRSxDQUExQyxFQUE5QixDLENBU0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUVBLFM7Ozs7Ozs7Ozs7O0FDaEJBLElBQUlDLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFHTixNQUFNQyxlQUFlLElBQUlDLFlBQUosQ0FBaUI7QUFDckNDLDZCQUE0QixnQ0FEUztBQUVyQ0MsOEJBQTZCLGlDQUZRO0FBR3JDQywwQkFBeUIsNkJBSFk7QUFJckNDLG9CQUFtQmhCLFdBQVdDLE1BQVgsQ0FBa0JDLFNBQWxCLENBQTRCZSxLQUpWO0FBS3JDQyxRQUFPO0FBTDhCLENBQWpCLENBQXJCO0FBUUFDLE9BQU9DLGVBQVAsQ0FBdUJDLEdBQXZCLENBQTJCVixhQUFhVyxHQUF4QztBQUVBWCxhQUFhWSxNQUFiLENBQW9CQyxHQUFwQixDQUF3QixpQkFBeEIsRUFBMkMsVUFBU0MsR0FBVCxFQUFjQyxHQUFkLEVBQW1CO0FBQzdELEtBQUlELElBQUlFLE9BQUosQ0FBWUMsYUFBWixJQUE2QixJQUFqQyxFQUF1QztBQUN0QyxTQUFPRixJQUFJRyxVQUFKLENBQWUsR0FBZixFQUFvQkMsSUFBcEIsQ0FBeUIsVUFBekIsQ0FBUDtBQUNBOztBQUNELE9BQU1DLGNBQWNOLElBQUlFLE9BQUosQ0FB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QUFEMkMsR0FBbEQ7QUFhQSxTQUFPcEQsV0FBV0MsTUFBWCxDQUFrQkMsU0FBbEIsQ0FBNEJrQyxPQUE1QixDQUFvQ2lFLGFBQXBDLENBQVA7QUFDQTs7QUFoQ2EsQ0FBZixFOzs7Ozs7Ozs7OztBQ0ZBN0MsT0FBT2tDLE9BQVAsQ0FBZTtBQUNkZ0IsZ0JBQWVMLGFBQWYsRUFBOEI7QUFDN0IsTUFBSSxDQUFDckcsV0FBV3NGLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCLEtBQUsvQyxNQUFwQyxFQUE0QyxtQkFBNUMsQ0FBTCxFQUF1RTtBQUN0RSxTQUFNLElBQUlnQixPQUFPaUMsS0FBWCxDQUFpQixtQkFBakIsRUFBc0MsYUFBdEMsRUFBcUQ7QUFBRUksWUFBUTtBQUFWLElBQXJELENBQU47QUFDQTs7QUFDRCxRQUFNRCxjQUFjNUYsV0FBV0MsTUFBWCxDQUFrQkMsU0FBbEIsQ0FBNEJrQyxPQUE1QixDQUFvQ2lFLGFBQXBDLENBQXBCOztBQUNBLE1BQUlULGVBQWUsSUFBbkIsRUFBeUI7QUFDeEIsU0FBTSxJQUFJcEMsT0FBT2lDLEtBQVgsQ0FBaUIsNkJBQWpCLEVBQWdELHVCQUFoRCxFQUF5RTtBQUFFSSxZQUFRO0FBQVYsSUFBekUsQ0FBTjtBQUNBOztBQUNEN0YsYUFBV0MsTUFBWCxDQUFrQkMsU0FBbEIsQ0FBNEJ5RyxNQUE1QixDQUFtQztBQUFFakUsUUFBSzJEO0FBQVAsR0FBbkM7QUFDQSxTQUFPLElBQVA7QUFDQTs7QUFYYSxDQUFmLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfb2F1dGgyLXNlcnZlci1jb25maWcuanMiLCJzb3VyY2VzQ29udGVudCI6WyJSb2NrZXRDaGF0Lm1vZGVscy5PQXV0aEFwcHMgPSBuZXcgY2xhc3MgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdvYXV0aF9hcHBzJyk7XG5cdH1cbn07XG5cblxuXG5cbi8vIEZJTkRcbi8vIGZpbmRCeVJvbGU6IChyb2xlLCBvcHRpb25zKSAtPlxuLy8gXHRxdWVyeSA9XG4vLyBcdHJvbGVzOiByb2xlXG5cbi8vIFx0cmV0dXJuIEBmaW5kIHF1ZXJ5LCBvcHRpb25zXG5cbi8vIENSRUFURVxuIiwiLypnbG9iYWwgT0F1dGgyU2VydmVyICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuY29uc3Qgb2F1dGgyc2VydmVyID0gbmV3IE9BdXRoMlNlcnZlcih7XG5cdGFjY2Vzc1Rva2Vuc0NvbGxlY3Rpb25OYW1lOiAncm9ja2V0Y2hhdF9vYXV0aF9hY2Nlc3NfdG9rZW5zJyxcblx0cmVmcmVzaFRva2Vuc0NvbGxlY3Rpb25OYW1lOiAncm9ja2V0Y2hhdF9vYXV0aF9yZWZyZXNoX3Rva2VucycsXG5cdGF1dGhDb2Rlc0NvbGxlY3Rpb25OYW1lOiAncm9ja2V0Y2hhdF9vYXV0aF9hdXRoX2NvZGVzJyxcblx0Y2xpZW50c0NvbGxlY3Rpb246IFJvY2tldENoYXQubW9kZWxzLk9BdXRoQXBwcy5tb2RlbCxcblx0ZGVidWc6IHRydWVcbn0pO1xuXG5XZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZShvYXV0aDJzZXJ2ZXIuYXBwKTtcblxub2F1dGgyc2VydmVyLnJvdXRlcy5nZXQoJy9vYXV0aC91c2VyaW5mbycsIGZ1bmN0aW9uKHJlcSwgcmVzKSB7XG5cdGlmIChyZXEuaGVhZGVycy5hdXRob3JpemF0aW9uID09IG51bGwpIHtcblx0XHRyZXR1cm4gcmVzLnNlbmRTdGF0dXMoNDAxKS5zZW5kKCdObyB0b2tlbicpO1xuXHR9XG5cdGNvbnN0IGFjY2Vzc1Rva2VuID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbi5yZXBsYWNlKCdCZWFyZXIgJywgJycpO1xuXHRjb25zdCB0b2tlbiA9IG9hdXRoMnNlcnZlci5vYXV0aC5tb2RlbC5BY2Nlc3NUb2tlbnMuZmluZE9uZSh7XG5cdFx0YWNjZXNzVG9rZW5cblx0fSk7XG5cdGlmICh0b2tlbiA9PSBudWxsKSB7XG5cdFx0cmV0dXJuIHJlcy5zZW5kU3RhdHVzKDQwMSkuc2VuZCgnSW52YWxpZCBUb2tlbicpO1xuXHR9XG5cdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh0b2tlbi51c2VySWQpO1xuXHRpZiAodXNlciA9PSBudWxsKSB7XG5cdFx0cmV0dXJuIHJlcy5zZW5kU3RhdHVzKDQwMSkuc2VuZCgnSW52YWxpZCBUb2tlbicpO1xuXHR9XG5cdHJldHVybiByZXMuc2VuZCh7XG5cdFx0c3ViOiB1c2VyLl9pZCxcblx0XHRuYW1lOiB1c2VyLm5hbWUsXG5cdFx0ZW1haWw6IHVzZXIuZW1haWxzWzBdLmFkZHJlc3MsXG5cdFx0ZW1haWxfdmVyaWZpZWQ6IHVzZXIuZW1haWxzWzBdLnZlcmlmaWVkLFxuXHRcdGRlcGFydG1lbnQ6ICcnLFxuXHRcdGJpcnRoZGF0ZTogJycsXG5cdFx0cHJlZmZlcmVkX3VzZXJuYW1lOiB1c2VyLnVzZXJuYW1lLFxuXHRcdHVwZGF0ZWRfYXQ6IHVzZXIuX3VwZGF0ZWRBdCxcblx0XHRwaWN0dXJlOiBgJHsgTWV0ZW9yLmFic29sdXRlVXJsKCkgfWF2YXRhci8keyB1c2VyLnVzZXJuYW1lIH1gXG5cdH0pO1xufSk7XG5cbk1ldGVvci5wdWJsaXNoKCdvYXV0aENsaWVudCcsIGZ1bmN0aW9uKGNsaWVudElkKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5PQXV0aEFwcHMuZmluZCh7XG5cdFx0Y2xpZW50SWQsXG5cdFx0YWN0aXZlOiB0cnVlXG5cdH0sIHtcblx0XHRmaWVsZHM6IHtcblx0XHRcdG5hbWU6IDFcblx0XHR9XG5cdH0pO1xufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZEF1dGhNZXRob2QoZnVuY3Rpb24oKSB7XG5cdGxldCBoZWFkZXJUb2tlbiA9IHRoaXMucmVxdWVzdC5oZWFkZXJzWydhdXRob3JpemF0aW9uJ107XG5cdGNvbnN0IGdldFRva2VuID0gdGhpcy5yZXF1ZXN0LnF1ZXJ5LmFjY2Vzc190b2tlbjtcblx0aWYgKGhlYWRlclRva2VuICE9IG51bGwpIHtcblx0XHRjb25zdCBtYXRjaGVzID0gaGVhZGVyVG9rZW4ubWF0Y2goL0JlYXJlclxccyhcXFMrKS8pO1xuXHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRoZWFkZXJUb2tlbiA9IG1hdGNoZXNbMV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGhlYWRlclRva2VuID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXHRjb25zdCBiZWFyZXJUb2tlbiA9IGhlYWRlclRva2VuIHx8IGdldFRva2VuO1xuXHRpZiAoYmVhcmVyVG9rZW4gPT0gbnVsbCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCBnZXRBY2Nlc3NUb2tlbiA9IE1ldGVvci53cmFwQXN5bmMob2F1dGgyc2VydmVyLm9hdXRoLm1vZGVsLmdldEFjY2Vzc1Rva2VuLCBvYXV0aDJzZXJ2ZXIub2F1dGgubW9kZWwpO1xuXHRjb25zdCBhY2Nlc3NUb2tlbiA9IGdldEFjY2Vzc1Rva2VuKGJlYXJlclRva2VuKTtcblx0aWYgKGFjY2Vzc1Rva2VuID09IG51bGwpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKChhY2Nlc3NUb2tlbi5leHBpcmVzICE9IG51bGwpICYmIGFjY2Vzc1Rva2VuLmV4cGlyZXMgIT09IDAgJiYgYWNjZXNzVG9rZW4uZXhwaXJlcyA8IG5ldyBEYXRlKCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmUoYWNjZXNzVG9rZW4udXNlcklkKTtcblx0aWYgKHVzZXIgPT0gbnVsbCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRyZXR1cm4geyB1c2VyOiBfLm9taXQodXNlciwgJyRsb2tpJykgfTtcbn0pO1xuIiwiaWYgKCFSb2NrZXRDaGF0Lm1vZGVscy5PQXV0aEFwcHMuZmluZE9uZSgnemFwaWVyJykpIHtcblx0Um9ja2V0Q2hhdC5tb2RlbHMuT0F1dGhBcHBzLmluc2VydCh7XG5cdFx0X2lkOiAnemFwaWVyJyxcblx0XHRuYW1lOiAnWmFwaWVyJyxcblx0XHRhY3RpdmU6IHRydWUsXG5cdFx0Y2xpZW50SWQ6ICd6YXBpZXInLFxuXHRcdGNsaWVudFNlY3JldDogJ1JUSzZUbG5kYUNJb2xoUWhaN19LSElHT0tqNDFSbmxhT3Ffby03Skt3THInLFxuXHRcdHJlZGlyZWN0VXJpOiAnaHR0cHM6Ly96YXBpZXIuY29tL2Rhc2hib2FyZC9hdXRoL29hdXRoL3JldHVybi9Sb2NrZXRDaGF0RGV2QVBJLycsXG5cdFx0X2NyZWF0ZWRBdDogbmV3IERhdGUsXG5cdFx0X2NyZWF0ZWRCeToge1xuXHRcdFx0X2lkOiAnc3lzdGVtJyxcblx0XHRcdHVzZXJuYW1lOiAnc3lzdGVtJ1xuXHRcdH1cblx0fSk7XG59XG4iLCJNZXRlb3IucHVibGlzaCgnb2F1dGhBcHBzJywgZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW9hdXRoLWFwcHMnKSkge1xuXHRcdHRoaXMuZXJyb3IoTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgcHVibGlzaDogJ29hdXRoQXBwcycgfSkpO1xuXHR9XG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5PQXV0aEFwcHMuZmluZCgpO1xufSk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHRhZGRPQXV0aEFwcChhcHBsaWNhdGlvbikge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW9hdXRoLWFwcHMnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2FkZE9BdXRoQXBwJyB9KTtcblx0XHR9XG5cdFx0aWYgKCFfLmlzU3RyaW5nKGFwcGxpY2F0aW9uLm5hbWUpIHx8IGFwcGxpY2F0aW9uLm5hbWUudHJpbSgpID09PSAnJykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1uYW1lJywgJ0ludmFsaWQgbmFtZScsIHsgbWV0aG9kOiAnYWRkT0F1dGhBcHAnIH0pO1xuXHRcdH1cblx0XHRpZiAoIV8uaXNTdHJpbmcoYXBwbGljYXRpb24ucmVkaXJlY3RVcmkpIHx8IGFwcGxpY2F0aW9uLnJlZGlyZWN0VXJpLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcmVkaXJlY3RVcmknLCAnSW52YWxpZCByZWRpcmVjdFVyaScsIHsgbWV0aG9kOiAnYWRkT0F1dGhBcHAnIH0pO1xuXHRcdH1cblx0XHRpZiAoIV8uaXNCb29sZWFuKGFwcGxpY2F0aW9uLmFjdGl2ZSkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtYXJndW1lbnRzJywgJ0ludmFsaWQgYXJndW1lbnRzJywgeyBtZXRob2Q6ICdhZGRPQXV0aEFwcCcgfSk7XG5cdFx0fVxuXHRcdGFwcGxpY2F0aW9uLmNsaWVudElkID0gUmFuZG9tLmlkKCk7XG5cdFx0YXBwbGljYXRpb24uY2xpZW50U2VjcmV0ID0gUmFuZG9tLnNlY3JldCgpO1xuXHRcdGFwcGxpY2F0aW9uLl9jcmVhdGVkQXQgPSBuZXcgRGF0ZTtcblx0XHRhcHBsaWNhdGlvbi5fY3JlYXRlZEJ5ID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh0aGlzLnVzZXJJZCwgeyBmaWVsZHM6IHsgdXNlcm5hbWU6IDEgfSB9KTtcblx0XHRhcHBsaWNhdGlvbi5faWQgPSBSb2NrZXRDaGF0Lm1vZGVscy5PQXV0aEFwcHMuaW5zZXJ0KGFwcGxpY2F0aW9uKTtcblx0XHRyZXR1cm4gYXBwbGljYXRpb247XG5cdH1cbn0pO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0dXBkYXRlT0F1dGhBcHAoYXBwbGljYXRpb25JZCwgYXBwbGljYXRpb24pIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1vYXV0aC1hcHBzJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICd1cGRhdGVPQXV0aEFwcCcgfSk7XG5cdFx0fVxuXHRcdGlmICghXy5pc1N0cmluZyhhcHBsaWNhdGlvbi5uYW1lKSB8fCBhcHBsaWNhdGlvbi5uYW1lLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtbmFtZScsICdJbnZhbGlkIG5hbWUnLCB7IG1ldGhvZDogJ3VwZGF0ZU9BdXRoQXBwJyB9KTtcblx0XHR9XG5cdFx0aWYgKCFfLmlzU3RyaW5nKGFwcGxpY2F0aW9uLnJlZGlyZWN0VXJpKSB8fCBhcHBsaWNhdGlvbi5yZWRpcmVjdFVyaS50cmltKCkgPT09ICcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJlZGlyZWN0VXJpJywgJ0ludmFsaWQgcmVkaXJlY3RVcmknLCB7IG1ldGhvZDogJ3VwZGF0ZU9BdXRoQXBwJyB9KTtcblx0XHR9XG5cdFx0aWYgKCFfLmlzQm9vbGVhbihhcHBsaWNhdGlvbi5hY3RpdmUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWFyZ3VtZW50cycsICdJbnZhbGlkIGFyZ3VtZW50cycsIHsgbWV0aG9kOiAndXBkYXRlT0F1dGhBcHAnIH0pO1xuXHRcdH1cblx0XHRjb25zdCBjdXJyZW50QXBwbGljYXRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5PQXV0aEFwcHMuZmluZE9uZShhcHBsaWNhdGlvbklkKTtcblx0XHRpZiAoY3VycmVudEFwcGxpY2F0aW9uID09IG51bGwpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFwcGxpY2F0aW9uLW5vdC1mb3VuZCcsICdBcHBsaWNhdGlvbiBub3QgZm91bmQnLCB7IG1ldGhvZDogJ3VwZGF0ZU9BdXRoQXBwJyB9KTtcblx0XHR9XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuT0F1dGhBcHBzLnVwZGF0ZShhcHBsaWNhdGlvbklkLCB7XG5cdFx0XHQkc2V0OiB7XG5cdFx0XHRcdG5hbWU6IGFwcGxpY2F0aW9uLm5hbWUsXG5cdFx0XHRcdGFjdGl2ZTogYXBwbGljYXRpb24uYWN0aXZlLFxuXHRcdFx0XHRyZWRpcmVjdFVyaTogYXBwbGljYXRpb24ucmVkaXJlY3RVcmksXG5cdFx0XHRcdF91cGRhdGVkQXQ6IG5ldyBEYXRlLFxuXHRcdFx0XHRfdXBkYXRlZEJ5OiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lKHRoaXMudXNlcklkLCB7XG5cdFx0XHRcdFx0ZmllbGRzOiB7XG5cdFx0XHRcdFx0XHR1c2VybmFtZTogMVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuT0F1dGhBcHBzLmZpbmRPbmUoYXBwbGljYXRpb25JZCk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRkZWxldGVPQXV0aEFwcChhcHBsaWNhdGlvbklkKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utb2F1dGgtYXBwcycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnZGVsZXRlT0F1dGhBcHAnIH0pO1xuXHRcdH1cblx0XHRjb25zdCBhcHBsaWNhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLk9BdXRoQXBwcy5maW5kT25lKGFwcGxpY2F0aW9uSWQpO1xuXHRcdGlmIChhcHBsaWNhdGlvbiA9PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hcHBsaWNhdGlvbi1ub3QtZm91bmQnLCAnQXBwbGljYXRpb24gbm90IGZvdW5kJywgeyBtZXRob2Q6ICdkZWxldGVPQXV0aEFwcCcgfSk7XG5cdFx0fVxuXHRcdFJvY2tldENoYXQubW9kZWxzLk9BdXRoQXBwcy5yZW1vdmUoeyBfaWQ6IGFwcGxpY2F0aW9uSWQgfSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn0pO1xuIl19
