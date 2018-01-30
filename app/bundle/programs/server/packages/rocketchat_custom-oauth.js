(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorInstall = Package.modules.meteorInstall;
var check = Package.check.check;
var Match = Package.check.Match;
var OAuth = Package.oauth.OAuth;
var Oauth = Package.oauth.Oauth;
var ECMAScript = Package.ecmascript.ECMAScript;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var HTTP = Package.http.HTTP;
var HTTPInternals = Package.http.HTTPInternals;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Accounts = Package['accounts-base'].Accounts;

/* Package-scope variables */
var CustomOAuth;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:custom-oauth":{"server":{"custom_oauth_server.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_custom-oauth/server/custom_oauth_server.js                                                 //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
	CustomOAuth: () => CustomOAuth
});

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
const logger = new Logger('CustomOAuth');
const Services = {};
const BeforeUpdateOrCreateUserFromExternalService = [];

class CustomOAuth {
	constructor(name, options) {
		logger.debug('Init CustomOAuth', name, options);
		this.name = name;

		if (!Match.test(this.name, String)) {
			throw new Meteor.Error('CustomOAuth: Name is required and must be String');
		}

		if (Services[this.name]) {
			Services[this.name].configure(options);
			return;
		}

		Services[this.name] = this;
		this.configure(options);
		this.userAgent = 'Meteor';

		if (Meteor.release) {
			this.userAgent += `/${Meteor.release}`;
		}

		Accounts.oauth.registerService(this.name);
		this.registerService();
		this.addHookToProcessUser();
	}

	configure(options) {
		if (!Match.test(options, Object)) {
			throw new Meteor.Error('CustomOAuth: Options is required and must be Object');
		}

		if (!Match.test(options.serverURL, String)) {
			throw new Meteor.Error('CustomOAuth: Options.serverURL is required and must be String');
		}

		if (!Match.test(options.tokenPath, String)) {
			options.tokenPath = '/oauth/token';
		}

		if (!Match.test(options.identityPath, String)) {
			options.identityPath = '/me';
		}

		this.serverURL = options.serverURL;
		this.tokenPath = options.tokenPath;
		this.identityPath = options.identityPath;
		this.tokenSentVia = options.tokenSentVia;
		this.identityTokenSentVia = options.identityTokenSentVia;
		this.usernameField = (options.usernameField || '').trim();
		this.mergeUsers = options.mergeUsers;

		if (this.identityTokenSentVia == null || this.identityTokenSentVia === 'default') {
			this.identityTokenSentVia = this.tokenSentVia;
		}

		if (!/^https?:\/\/.+/.test(this.tokenPath)) {
			this.tokenPath = this.serverURL + this.tokenPath;
		}

		if (!/^https?:\/\/.+/.test(this.identityPath)) {
			this.identityPath = this.serverURL + this.identityPath;
		}

		if (Match.test(options.addAutopublishFields, Object)) {
			Accounts.addAutopublishFields(options.addAutopublishFields);
		}
	}

	getAccessToken(query) {
		const config = ServiceConfiguration.configurations.findOne({
			service: this.name
		});

		if (!config) {
			throw new ServiceConfiguration.ConfigError();
		}

		let response = undefined;
		const allOptions = {
			headers: {
				'User-Agent': this.userAgent,
				// http://doc.gitlab.com/ce/api/users.html#Current-user
				Accept: 'application/json'
			},
			params: {
				code: query.code,
				redirect_uri: OAuth._redirectUri(this.name, config),
				grant_type: 'authorization_code',
				state: query.state
			}
		}; // Only send clientID / secret once on header or payload.

		if (this.tokenSentVia === 'header') {
			allOptions['auth'] = `${config.clientId}:${OAuth.openSecret(config.secret)}`;
		} else {
			allOptions['params']['client_secret'] = OAuth.openSecret(config.secret);
			allOptions['params']['client_id'] = config.clientId;
		}

		try {
			response = HTTP.post(this.tokenPath, allOptions);
		} catch (err) {
			const error = new Error(`Failed to complete OAuth handshake with ${this.name} at ${this.tokenPath}. ${err.message}`);
			throw _.extend(error, {
				response: err.response
			});
		}

		let data;

		if (response.data) {
			data = response.data;
		} else {
			data = JSON.parse(response.content);
		}

		if (data.error) {
			//if the http response was a json object with an error attribute
			throw new Error(`Failed to complete OAuth handshake with ${this.name} at ${this.tokenPath}. ${data.error}`);
		} else {
			return data.access_token;
		}
	}

	getIdentity(accessToken) {
		const params = {};
		const headers = {
			'User-Agent': this.userAgent // http://doc.gitlab.com/ce/api/users.html#Current-user

		};

		if (this.identityTokenSentVia === 'header') {
			headers['Authorization'] = `Bearer ${accessToken}`;
		} else {
			params['access_token'] = accessToken;
		}

		try {
			const response = HTTP.get(this.identityPath, {
				headers,
				params
			});
			let data;

			if (response.data) {
				data = response.data;
			} else {
				data = JSON.parse(response.content);
			}

			logger.debug('Identity response', JSON.stringify(data, null, 2));
			return data;
		} catch (err) {
			const error = new Error(`Failed to fetch identity from ${this.name} at ${this.identityPath}. ${err.message}`);
			throw _.extend(error, {
				response: err.response
			});
		}
	}

	registerService() {
		const self = this;
		OAuth.registerService(this.name, 2, null, query => {
			const accessToken = self.getAccessToken(query); // console.log 'at:', accessToken

			let identity = self.getIdentity(accessToken);

			if (identity) {
				// Set 'id' to '_id' for any sources that provide it
				if (identity._id && !identity.id) {
					identity.id = identity._id;
				} // Fix for Reddit


				if (identity.result) {
					identity = identity.result;
				} // Fix WordPress-like identities having 'ID' instead of 'id'


				if (identity.ID && !identity.id) {
					identity.id = identity.ID;
				} // Fix Auth0-like identities having 'user_id' instead of 'id'


				if (identity.user_id && !identity.id) {
					identity.id = identity.user_id;
				}

				if (identity.CharacterID && !identity.id) {
					identity.id = identity.CharacterID;
				} // Fix Dataporten having 'user.userid' instead of 'id'


				if (identity.user && identity.user.userid && !identity.id) {
					if (identity.user.userid_sec && identity.user.userid_sec[0]) {
						identity.id = identity.user.userid_sec[0];
					} else {
						identity.id = identity.user.userid;
					}

					identity.email = identity.user.email;
				} // Fix for Xenforo [BD]API plugin for 'user.user_id; instead of 'id'


				if (identity.user && identity.user.user_id && !identity.id) {
					identity.id = identity.user.user_id;
					identity.email = identity.user.user_email;
				} // Fix general 'phid' instead of 'id' from phabricator


				if (identity.phid && !identity.id) {
					identity.id = identity.phid;
				} // Fix Keycloak-like identities having 'sub' instead of 'id'


				if (identity.sub && !identity.id) {
					identity.id = identity.sub;
				} // Fix general 'userid' instead of 'id' from provider


				if (identity.userid && !identity.id) {
					identity.id = identity.userid;
				} // Fix when authenticating from a meteor app with 'emails' field


				if (!identity.email && identity.emails && Array.isArray(identity.emails) && identity.emails.length >= 1) {
					identity.email = identity.emails[0].address ? identity.emails[0].address : undefined;
				}
			} // console.log 'id:', JSON.stringify identity, null, '  '


			const serviceData = {
				_OAuthCustom: true,
				accessToken
			};

			_.extend(serviceData, identity);

			const data = {
				serviceData,
				options: {
					profile: {
						name: identity.name || identity.username || identity.nickname || identity.CharacterName || identity.userName || identity.preferred_username || identity.user && identity.user.name
					}
				}
			}; // console.log data

			return data;
		});
	}

	retrieveCredential(credentialToken, credentialSecret) {
		return OAuth.retrieveCredential(credentialToken, credentialSecret);
	}

	getUsername(data) {
		let username = '';
		username = this.usernameField.split('.').reduce(function (prev, curr) {
			return prev ? prev[curr] : undefined;
		}, data);

		if (!username) {
			throw new Meteor.Error('field_not_found', `Username field "${this.usernameField}" not found in data`, data);
		}

		return username;
	}

	addHookToProcessUser() {
		BeforeUpdateOrCreateUserFromExternalService.push((serviceName, serviceData /*, options*/) => {
			if (serviceName !== this.name) {
				return;
			}

			if (this.usernameField) {
				const username = this.getUsername(serviceData);
				const user = RocketChat.models.Users.findOneByUsername(username);

				if (!user) {
					return;
				} // User already created or merged


				if (user.services && user.services[serviceName] && user.services[serviceName].id === serviceData.id) {
					return;
				}

				if (this.mergeUsers !== true) {
					throw new Meteor.Error('CustomOAuth', `User with username ${user.username} already exists`);
				}

				const serviceIdKey = `services.${serviceName}.id`;
				const update = {
					$set: {
						[serviceIdKey]: serviceData.id
					}
				};
				RocketChat.models.Users.update({
					_id: user._id
				}, update);
			}
		});
		Accounts.validateNewUser(user => {
			if (!user.services || !user.services[this.name] || !user.services[this.name].id) {
				return true;
			}

			if (this.usernameField) {
				user.username = this.getUsername(user.services[this.name]);
			}

			return true;
		});
	}

}

const updateOrCreateUserFromExternalService = Accounts.updateOrCreateUserFromExternalService;

Accounts.updateOrCreateUserFromExternalService = function () /*serviceName, serviceData, options*/{
	for (const hook of BeforeUpdateOrCreateUserFromExternalService) {
		hook.apply(this, arguments);
	}

	return updateOrCreateUserFromExternalService.apply(this, arguments);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
var exports = require("./node_modules/meteor/rocketchat:custom-oauth/server/custom_oauth_server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:custom-oauth'] = exports, {
  CustomOAuth: CustomOAuth
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_custom-oauth.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjdXN0b20tb2F1dGgvc2VydmVyL2N1c3RvbV9vYXV0aF9zZXJ2ZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiQ3VzdG9tT0F1dGgiLCJfIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJsb2dnZXIiLCJMb2dnZXIiLCJTZXJ2aWNlcyIsIkJlZm9yZVVwZGF0ZU9yQ3JlYXRlVXNlckZyb21FeHRlcm5hbFNlcnZpY2UiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJvcHRpb25zIiwiZGVidWciLCJNYXRjaCIsInRlc3QiLCJTdHJpbmciLCJNZXRlb3IiLCJFcnJvciIsImNvbmZpZ3VyZSIsInVzZXJBZ2VudCIsInJlbGVhc2UiLCJBY2NvdW50cyIsIm9hdXRoIiwicmVnaXN0ZXJTZXJ2aWNlIiwiYWRkSG9va1RvUHJvY2Vzc1VzZXIiLCJPYmplY3QiLCJzZXJ2ZXJVUkwiLCJ0b2tlblBhdGgiLCJpZGVudGl0eVBhdGgiLCJ0b2tlblNlbnRWaWEiLCJpZGVudGl0eVRva2VuU2VudFZpYSIsInVzZXJuYW1lRmllbGQiLCJ0cmltIiwibWVyZ2VVc2VycyIsImFkZEF1dG9wdWJsaXNoRmllbGRzIiwiZ2V0QWNjZXNzVG9rZW4iLCJxdWVyeSIsImNvbmZpZyIsIlNlcnZpY2VDb25maWd1cmF0aW9uIiwiY29uZmlndXJhdGlvbnMiLCJmaW5kT25lIiwic2VydmljZSIsIkNvbmZpZ0Vycm9yIiwicmVzcG9uc2UiLCJ1bmRlZmluZWQiLCJhbGxPcHRpb25zIiwiaGVhZGVycyIsIkFjY2VwdCIsInBhcmFtcyIsImNvZGUiLCJyZWRpcmVjdF91cmkiLCJPQXV0aCIsIl9yZWRpcmVjdFVyaSIsImdyYW50X3R5cGUiLCJzdGF0ZSIsImNsaWVudElkIiwib3BlblNlY3JldCIsInNlY3JldCIsIkhUVFAiLCJwb3N0IiwiZXJyIiwiZXJyb3IiLCJtZXNzYWdlIiwiZXh0ZW5kIiwiZGF0YSIsIkpTT04iLCJwYXJzZSIsImNvbnRlbnQiLCJhY2Nlc3NfdG9rZW4iLCJnZXRJZGVudGl0eSIsImFjY2Vzc1Rva2VuIiwiZ2V0Iiwic3RyaW5naWZ5Iiwic2VsZiIsImlkZW50aXR5IiwiX2lkIiwiaWQiLCJyZXN1bHQiLCJJRCIsInVzZXJfaWQiLCJDaGFyYWN0ZXJJRCIsInVzZXIiLCJ1c2VyaWQiLCJ1c2VyaWRfc2VjIiwiZW1haWwiLCJ1c2VyX2VtYWlsIiwicGhpZCIsInN1YiIsImVtYWlscyIsIkFycmF5IiwiaXNBcnJheSIsImxlbmd0aCIsImFkZHJlc3MiLCJzZXJ2aWNlRGF0YSIsIl9PQXV0aEN1c3RvbSIsInByb2ZpbGUiLCJ1c2VybmFtZSIsIm5pY2tuYW1lIiwiQ2hhcmFjdGVyTmFtZSIsInVzZXJOYW1lIiwicHJlZmVycmVkX3VzZXJuYW1lIiwicmV0cmlldmVDcmVkZW50aWFsIiwiY3JlZGVudGlhbFRva2VuIiwiY3JlZGVudGlhbFNlY3JldCIsImdldFVzZXJuYW1lIiwic3BsaXQiLCJyZWR1Y2UiLCJwcmV2IiwiY3VyciIsInB1c2giLCJzZXJ2aWNlTmFtZSIsIlJvY2tldENoYXQiLCJtb2RlbHMiLCJVc2VycyIsImZpbmRPbmVCeVVzZXJuYW1lIiwic2VydmljZXMiLCJzZXJ2aWNlSWRLZXkiLCJ1cGRhdGUiLCIkc2V0IiwidmFsaWRhdGVOZXdVc2VyIiwidXBkYXRlT3JDcmVhdGVVc2VyRnJvbUV4dGVybmFsU2VydmljZSIsImhvb2siLCJhcHBseSIsImFyZ3VtZW50cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE1BQVAsQ0FBYztBQUFDQyxjQUFZLE1BQUlBO0FBQWpCLENBQWQ7O0FBQTZDLElBQUlDLENBQUo7O0FBQU1ILE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNKLE1BQUVJLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7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SyxNQUFNQyxJQUFYLElBQW1CakgsMkNBQW5CLEVBQWdFO0FBQy9EaUgsT0FBS0MsS0FBTCxDQUFXLElBQVgsRUFBaUJDLFNBQWpCO0FBQ0E7O0FBRUQsUUFBT0gsc0NBQXNDRSxLQUF0QyxDQUE0QyxJQUE1QyxFQUFrREMsU0FBbEQsQ0FBUDtBQUNBLENBTkQsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9jdXN0b20tb2F1dGguanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKmdsb2JhbHMgT0F1dGgqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0N1c3RvbU9BdXRoJyk7XG5cbmNvbnN0IFNlcnZpY2VzID0ge307XG5jb25zdCBCZWZvcmVVcGRhdGVPckNyZWF0ZVVzZXJGcm9tRXh0ZXJuYWxTZXJ2aWNlID0gW107XG5cbmV4cG9ydCBjbGFzcyBDdXN0b21PQXV0aCB7XG5cdGNvbnN0cnVjdG9yKG5hbWUsIG9wdGlvbnMpIHtcblx0XHRsb2dnZXIuZGVidWcoJ0luaXQgQ3VzdG9tT0F1dGgnLCBuYW1lLCBvcHRpb25zKTtcblxuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0aWYgKCFNYXRjaC50ZXN0KHRoaXMubmFtZSwgU3RyaW5nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignQ3VzdG9tT0F1dGg6IE5hbWUgaXMgcmVxdWlyZWQgYW5kIG11c3QgYmUgU3RyaW5nJyk7XG5cdFx0fVxuXG5cdFx0aWYgKFNlcnZpY2VzW3RoaXMubmFtZV0pIHtcblx0XHRcdFNlcnZpY2VzW3RoaXMubmFtZV0uY29uZmlndXJlKG9wdGlvbnMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdFNlcnZpY2VzW3RoaXMubmFtZV0gPSB0aGlzO1xuXG5cdFx0dGhpcy5jb25maWd1cmUob3B0aW9ucyk7XG5cblx0XHR0aGlzLnVzZXJBZ2VudCA9ICdNZXRlb3InO1xuXHRcdGlmIChNZXRlb3IucmVsZWFzZSkge1xuXHRcdFx0dGhpcy51c2VyQWdlbnQgKz0gYC8keyBNZXRlb3IucmVsZWFzZSB9YDtcblx0XHR9XG5cblx0XHRBY2NvdW50cy5vYXV0aC5yZWdpc3RlclNlcnZpY2UodGhpcy5uYW1lKTtcblx0XHR0aGlzLnJlZ2lzdGVyU2VydmljZSgpO1xuXHRcdHRoaXMuYWRkSG9va1RvUHJvY2Vzc1VzZXIoKTtcblx0fVxuXG5cdGNvbmZpZ3VyZShvcHRpb25zKSB7XG5cdFx0aWYgKCFNYXRjaC50ZXN0KG9wdGlvbnMsIE9iamVjdCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ0N1c3RvbU9BdXRoOiBPcHRpb25zIGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIE9iamVjdCcpO1xuXHRcdH1cblxuXHRcdGlmICghTWF0Y2gudGVzdChvcHRpb25zLnNlcnZlclVSTCwgU3RyaW5nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignQ3VzdG9tT0F1dGg6IE9wdGlvbnMuc2VydmVyVVJMIGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIFN0cmluZycpO1xuXHRcdH1cblxuXHRcdGlmICghTWF0Y2gudGVzdChvcHRpb25zLnRva2VuUGF0aCwgU3RyaW5nKSkge1xuXHRcdFx0b3B0aW9ucy50b2tlblBhdGggPSAnL29hdXRoL3Rva2VuJztcblx0XHR9XG5cblx0XHRpZiAoIU1hdGNoLnRlc3Qob3B0aW9ucy5pZGVudGl0eVBhdGgsIFN0cmluZykpIHtcblx0XHRcdG9wdGlvbnMuaWRlbnRpdHlQYXRoID0gJy9tZSc7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXJ2ZXJVUkwgPSBvcHRpb25zLnNlcnZlclVSTDtcblx0XHR0aGlzLnRva2VuUGF0aCA9IG9wdGlvbnMudG9rZW5QYXRoO1xuXHRcdHRoaXMuaWRlbnRpdHlQYXRoID0gb3B0aW9ucy5pZGVudGl0eVBhdGg7XG5cdFx0dGhpcy50b2tlblNlbnRWaWEgPSBvcHRpb25zLnRva2VuU2VudFZpYTtcblx0XHR0aGlzLmlkZW50aXR5VG9rZW5TZW50VmlhID0gb3B0aW9ucy5pZGVudGl0eVRva2VuU2VudFZpYTtcblx0XHR0aGlzLnVzZXJuYW1lRmllbGQgPSAob3B0aW9ucy51c2VybmFtZUZpZWxkIHx8ICcnKS50cmltKCk7XG5cdFx0dGhpcy5tZXJnZVVzZXJzID0gb3B0aW9ucy5tZXJnZVVzZXJzO1xuXG5cdFx0aWYgKHRoaXMuaWRlbnRpdHlUb2tlblNlbnRWaWEgPT0gbnVsbCB8fCB0aGlzLmlkZW50aXR5VG9rZW5TZW50VmlhID09PSAnZGVmYXVsdCcpIHtcblx0XHRcdHRoaXMuaWRlbnRpdHlUb2tlblNlbnRWaWEgPSB0aGlzLnRva2VuU2VudFZpYTtcblx0XHR9XG5cblx0XHRpZiAoIS9eaHR0cHM/OlxcL1xcLy4rLy50ZXN0KHRoaXMudG9rZW5QYXRoKSkge1xuXHRcdFx0dGhpcy50b2tlblBhdGggPSB0aGlzLnNlcnZlclVSTCArIHRoaXMudG9rZW5QYXRoO1xuXHRcdH1cblxuXHRcdGlmICghL15odHRwcz86XFwvXFwvLisvLnRlc3QodGhpcy5pZGVudGl0eVBhdGgpKSB7XG5cdFx0XHR0aGlzLmlkZW50aXR5UGF0aCA9IHRoaXMuc2VydmVyVVJMICsgdGhpcy5pZGVudGl0eVBhdGg7XG5cdFx0fVxuXG5cdFx0aWYgKE1hdGNoLnRlc3Qob3B0aW9ucy5hZGRBdXRvcHVibGlzaEZpZWxkcywgT2JqZWN0KSkge1xuXHRcdFx0QWNjb3VudHMuYWRkQXV0b3B1Ymxpc2hGaWVsZHMob3B0aW9ucy5hZGRBdXRvcHVibGlzaEZpZWxkcyk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0QWNjZXNzVG9rZW4ocXVlcnkpIHtcblx0XHRjb25zdCBjb25maWcgPSBTZXJ2aWNlQ29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9ucy5maW5kT25lKHtzZXJ2aWNlOiB0aGlzLm5hbWV9KTtcblx0XHRpZiAoIWNvbmZpZykge1xuXHRcdFx0dGhyb3cgbmV3IFNlcnZpY2VDb25maWd1cmF0aW9uLkNvbmZpZ0Vycm9yKCk7XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3BvbnNlID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgYWxsT3B0aW9ucyA9IHtcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J1VzZXItQWdlbnQnOiB0aGlzLnVzZXJBZ2VudCwgLy8gaHR0cDovL2RvYy5naXRsYWIuY29tL2NlL2FwaS91c2Vycy5odG1sI0N1cnJlbnQtdXNlclxuXHRcdFx0XHRBY2NlcHQ6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdHBhcmFtczoge1xuXHRcdFx0XHRjb2RlOiBxdWVyeS5jb2RlLFxuXHRcdFx0XHRyZWRpcmVjdF91cmk6IE9BdXRoLl9yZWRpcmVjdFVyaSh0aGlzLm5hbWUsIGNvbmZpZyksXG5cdFx0XHRcdGdyYW50X3R5cGU6ICdhdXRob3JpemF0aW9uX2NvZGUnLFxuXHRcdFx0XHRzdGF0ZTogcXVlcnkuc3RhdGVcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gT25seSBzZW5kIGNsaWVudElEIC8gc2VjcmV0IG9uY2Ugb24gaGVhZGVyIG9yIHBheWxvYWQuXG5cdFx0aWYgKHRoaXMudG9rZW5TZW50VmlhID09PSAnaGVhZGVyJykge1xuXHRcdFx0YWxsT3B0aW9uc1snYXV0aCddID0gYCR7IGNvbmZpZy5jbGllbnRJZCB9OiR7IE9BdXRoLm9wZW5TZWNyZXQoY29uZmlnLnNlY3JldCkgfWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFsbE9wdGlvbnNbJ3BhcmFtcyddWydjbGllbnRfc2VjcmV0J10gPSBPQXV0aC5vcGVuU2VjcmV0KGNvbmZpZy5zZWNyZXQpO1xuXHRcdFx0YWxsT3B0aW9uc1sncGFyYW1zJ11bJ2NsaWVudF9pZCddID0gY29uZmlnLmNsaWVudElkO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZXNwb25zZSA9IEhUVFAucG9zdCh0aGlzLnRva2VuUGF0aCwgYWxsT3B0aW9ucyk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IG5ldyBFcnJvcihgRmFpbGVkIHRvIGNvbXBsZXRlIE9BdXRoIGhhbmRzaGFrZSB3aXRoICR7IHRoaXMubmFtZSB9IGF0ICR7IHRoaXMudG9rZW5QYXRoIH0uICR7IGVyci5tZXNzYWdlIH1gKTtcblx0XHRcdHRocm93IF8uZXh0ZW5kKGVycm9yLCB7cmVzcG9uc2U6IGVyci5yZXNwb25zZX0pO1xuXHRcdH1cblxuXHRcdGxldCBkYXRhO1xuXHRcdGlmIChyZXNwb25zZS5kYXRhKSB7XG5cdFx0XHRkYXRhID0gcmVzcG9uc2UuZGF0YTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YSA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEuZXJyb3IpIHsgLy9pZiB0aGUgaHR0cCByZXNwb25zZSB3YXMgYSBqc29uIG9iamVjdCB3aXRoIGFuIGVycm9yIGF0dHJpYnV0ZVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY29tcGxldGUgT0F1dGggaGFuZHNoYWtlIHdpdGggJHsgdGhpcy5uYW1lIH0gYXQgJHsgdGhpcy50b2tlblBhdGggfS4gJHsgZGF0YS5lcnJvciB9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBkYXRhLmFjY2Vzc190b2tlbjtcblx0XHR9XG5cdH1cblxuXHRnZXRJZGVudGl0eShhY2Nlc3NUb2tlbikge1xuXHRcdGNvbnN0IHBhcmFtcyA9IHt9O1xuXHRcdGNvbnN0IGhlYWRlcnMgPSB7XG5cdFx0XHQnVXNlci1BZ2VudCc6IHRoaXMudXNlckFnZW50IC8vIGh0dHA6Ly9kb2MuZ2l0bGFiLmNvbS9jZS9hcGkvdXNlcnMuaHRtbCNDdXJyZW50LXVzZXJcblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMuaWRlbnRpdHlUb2tlblNlbnRWaWEgPT09ICdoZWFkZXInKSB7XG5cdFx0XHRoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmVhcmVyICR7IGFjY2Vzc1Rva2VuIH1gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwYXJhbXNbJ2FjY2Vzc190b2tlbiddID0gYWNjZXNzVG9rZW47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gSFRUUC5nZXQodGhpcy5pZGVudGl0eVBhdGgsIHtcblx0XHRcdFx0aGVhZGVycyxcblx0XHRcdFx0cGFyYW1zXG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IGRhdGE7XG5cblx0XHRcdGlmIChyZXNwb25zZS5kYXRhKSB7XG5cdFx0XHRcdGRhdGEgPSByZXNwb25zZS5kYXRhO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGF0YSA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG5cdFx0XHR9XG5cblx0XHRcdGxvZ2dlci5kZWJ1ZygnSWRlbnRpdHkgcmVzcG9uc2UnLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XG5cblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Y29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoYEZhaWxlZCB0byBmZXRjaCBpZGVudGl0eSBmcm9tICR7IHRoaXMubmFtZSB9IGF0ICR7IHRoaXMuaWRlbnRpdHlQYXRoIH0uICR7IGVyci5tZXNzYWdlIH1gKTtcblx0XHRcdHRocm93IF8uZXh0ZW5kKGVycm9yLCB7cmVzcG9uc2U6IGVyci5yZXNwb25zZX0pO1xuXHRcdH1cblx0fVxuXG5cdHJlZ2lzdGVyU2VydmljZSgpIHtcblx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHRPQXV0aC5yZWdpc3RlclNlcnZpY2UodGhpcy5uYW1lLCAyLCBudWxsLCAocXVlcnkpID0+IHtcblx0XHRcdGNvbnN0IGFjY2Vzc1Rva2VuID0gc2VsZi5nZXRBY2Nlc3NUb2tlbihxdWVyeSk7XG5cdFx0XHQvLyBjb25zb2xlLmxvZyAnYXQ6JywgYWNjZXNzVG9rZW5cblxuXHRcdFx0bGV0IGlkZW50aXR5ID0gc2VsZi5nZXRJZGVudGl0eShhY2Nlc3NUb2tlbik7XG5cblx0XHRcdGlmIChpZGVudGl0eSkge1xuXHRcdFx0XHQvLyBTZXQgJ2lkJyB0byAnX2lkJyBmb3IgYW55IHNvdXJjZXMgdGhhdCBwcm92aWRlIGl0XG5cdFx0XHRcdGlmIChpZGVudGl0eS5faWQgJiYgIWlkZW50aXR5LmlkKSB7XG5cdFx0XHRcdFx0aWRlbnRpdHkuaWQgPSBpZGVudGl0eS5faWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaXggZm9yIFJlZGRpdFxuXHRcdFx0XHRpZiAoaWRlbnRpdHkucmVzdWx0KSB7XG5cdFx0XHRcdFx0aWRlbnRpdHkgPSBpZGVudGl0eS5yZXN1bHQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaXggV29yZFByZXNzLWxpa2UgaWRlbnRpdGllcyBoYXZpbmcgJ0lEJyBpbnN0ZWFkIG9mICdpZCdcblx0XHRcdFx0aWYgKGlkZW50aXR5LklEICYmICFpZGVudGl0eS5pZCkge1xuXHRcdFx0XHRcdGlkZW50aXR5LmlkID0gaWRlbnRpdHkuSUQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaXggQXV0aDAtbGlrZSBpZGVudGl0aWVzIGhhdmluZyAndXNlcl9pZCcgaW5zdGVhZCBvZiAnaWQnXG5cdFx0XHRcdGlmIChpZGVudGl0eS51c2VyX2lkICYmICFpZGVudGl0eS5pZCkge1xuXHRcdFx0XHRcdGlkZW50aXR5LmlkID0gaWRlbnRpdHkudXNlcl9pZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpZGVudGl0eS5DaGFyYWN0ZXJJRCAmJiAhaWRlbnRpdHkuaWQpIHtcblx0XHRcdFx0XHRpZGVudGl0eS5pZCA9IGlkZW50aXR5LkNoYXJhY3RlcklEO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRml4IERhdGFwb3J0ZW4gaGF2aW5nICd1c2VyLnVzZXJpZCcgaW5zdGVhZCBvZiAnaWQnXG5cdFx0XHRcdGlmIChpZGVudGl0eS51c2VyICYmIGlkZW50aXR5LnVzZXIudXNlcmlkICYmICFpZGVudGl0eS5pZCkge1xuXHRcdFx0XHRcdGlmIChpZGVudGl0eS51c2VyLnVzZXJpZF9zZWMgJiYgaWRlbnRpdHkudXNlci51c2VyaWRfc2VjWzBdKSB7XG5cdFx0XHRcdFx0XHRpZGVudGl0eS5pZCA9IGlkZW50aXR5LnVzZXIudXNlcmlkX3NlY1swXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWRlbnRpdHkuaWQgPSBpZGVudGl0eS51c2VyLnVzZXJpZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWRlbnRpdHkuZW1haWwgPSBpZGVudGl0eS51c2VyLmVtYWlsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIEZpeCBmb3IgWGVuZm9ybyBbQkRdQVBJIHBsdWdpbiBmb3IgJ3VzZXIudXNlcl9pZDsgaW5zdGVhZCBvZiAnaWQnXG5cdFx0XHRcdGlmIChpZGVudGl0eS51c2VyICYmIGlkZW50aXR5LnVzZXIudXNlcl9pZCAmJiAhaWRlbnRpdHkuaWQpIHtcblx0XHRcdFx0XHRpZGVudGl0eS5pZCA9IGlkZW50aXR5LnVzZXIudXNlcl9pZDtcblx0XHRcdFx0XHRpZGVudGl0eS5lbWFpbCA9IGlkZW50aXR5LnVzZXIudXNlcl9lbWFpbDtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBGaXggZ2VuZXJhbCAncGhpZCcgaW5zdGVhZCBvZiAnaWQnIGZyb20gcGhhYnJpY2F0b3Jcblx0XHRcdFx0aWYgKGlkZW50aXR5LnBoaWQgJiYgIWlkZW50aXR5LmlkKSB7XG5cdFx0XHRcdFx0aWRlbnRpdHkuaWQgPSBpZGVudGl0eS5waGlkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRml4IEtleWNsb2FrLWxpa2UgaWRlbnRpdGllcyBoYXZpbmcgJ3N1YicgaW5zdGVhZCBvZiAnaWQnXG5cdFx0XHRcdGlmIChpZGVudGl0eS5zdWIgJiYgIWlkZW50aXR5LmlkKSB7XG5cdFx0XHRcdFx0aWRlbnRpdHkuaWQgPSBpZGVudGl0eS5zdWI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaXggZ2VuZXJhbCAndXNlcmlkJyBpbnN0ZWFkIG9mICdpZCcgZnJvbSBwcm92aWRlclxuXHRcdFx0XHRpZiAoaWRlbnRpdHkudXNlcmlkICYmICFpZGVudGl0eS5pZCkge1xuXHRcdFx0XHRcdGlkZW50aXR5LmlkID0gaWRlbnRpdHkudXNlcmlkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRml4IHdoZW4gYXV0aGVudGljYXRpbmcgZnJvbSBhIG1ldGVvciBhcHAgd2l0aCAnZW1haWxzJyBmaWVsZFxuXHRcdFx0XHRpZiAoIWlkZW50aXR5LmVtYWlsICYmIChpZGVudGl0eS5lbWFpbHMgJiYgQXJyYXkuaXNBcnJheShpZGVudGl0eS5lbWFpbHMpICYmIGlkZW50aXR5LmVtYWlscy5sZW5ndGggPj0gMSkpIHtcblx0XHRcdFx0XHRpZGVudGl0eS5lbWFpbCA9IGlkZW50aXR5LmVtYWlsc1swXS5hZGRyZXNzID8gaWRlbnRpdHkuZW1haWxzWzBdLmFkZHJlc3MgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gY29uc29sZS5sb2cgJ2lkOicsIEpTT04uc3RyaW5naWZ5IGlkZW50aXR5LCBudWxsLCAnICAnXG5cblx0XHRcdGNvbnN0IHNlcnZpY2VEYXRhID0ge1xuXHRcdFx0XHRfT0F1dGhDdXN0b206IHRydWUsXG5cdFx0XHRcdGFjY2Vzc1Rva2VuXG5cdFx0XHR9O1xuXG5cdFx0XHRfLmV4dGVuZChzZXJ2aWNlRGF0YSwgaWRlbnRpdHkpO1xuXG5cdFx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0XHRzZXJ2aWNlRGF0YSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHByb2ZpbGU6IHtcblx0XHRcdFx0XHRcdG5hbWU6IGlkZW50aXR5Lm5hbWUgfHwgaWRlbnRpdHkudXNlcm5hbWUgfHwgaWRlbnRpdHkubmlja25hbWUgfHwgaWRlbnRpdHkuQ2hhcmFjdGVyTmFtZSB8fCBpZGVudGl0eS51c2VyTmFtZSB8fCBpZGVudGl0eS5wcmVmZXJyZWRfdXNlcm5hbWUgfHwgKGlkZW50aXR5LnVzZXIgJiYgaWRlbnRpdHkudXNlci5uYW1lKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Ly8gY29uc29sZS5sb2cgZGF0YVxuXG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9KTtcblx0fVxuXG5cdHJldHJpZXZlQ3JlZGVudGlhbChjcmVkZW50aWFsVG9rZW4sIGNyZWRlbnRpYWxTZWNyZXQpIHtcblx0XHRyZXR1cm4gT0F1dGgucmV0cmlldmVDcmVkZW50aWFsKGNyZWRlbnRpYWxUb2tlbiwgY3JlZGVudGlhbFNlY3JldCk7XG5cdH1cblxuXHRnZXRVc2VybmFtZShkYXRhKSB7XG5cdFx0bGV0IHVzZXJuYW1lID0gJyc7XG5cblx0XHR1c2VybmFtZSA9IHRoaXMudXNlcm5hbWVGaWVsZC5zcGxpdCgnLicpLnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXJyKSB7XG5cdFx0XHRyZXR1cm4gcHJldiA/IHByZXZbY3Vycl0gOiB1bmRlZmluZWQ7XG5cdFx0fSwgZGF0YSk7XG5cdFx0aWYgKCF1c2VybmFtZSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZmllbGRfbm90X2ZvdW5kJywgYFVzZXJuYW1lIGZpZWxkIFwiJHsgdGhpcy51c2VybmFtZUZpZWxkIH1cIiBub3QgZm91bmQgaW4gZGF0YWAsIGRhdGEpO1xuXHRcdH1cblx0XHRyZXR1cm4gdXNlcm5hbWU7XG5cdH1cblxuXHRhZGRIb29rVG9Qcm9jZXNzVXNlcigpIHtcblx0XHRCZWZvcmVVcGRhdGVPckNyZWF0ZVVzZXJGcm9tRXh0ZXJuYWxTZXJ2aWNlLnB1c2goKHNlcnZpY2VOYW1lLCBzZXJ2aWNlRGF0YS8qLCBvcHRpb25zKi8pID0+IHtcblx0XHRcdGlmIChzZXJ2aWNlTmFtZSAhPT0gdGhpcy5uYW1lKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMudXNlcm5hbWVGaWVsZCkge1xuXHRcdFx0XHRjb25zdCB1c2VybmFtZSA9IHRoaXMuZ2V0VXNlcm5hbWUoc2VydmljZURhdGEpO1xuXG5cdFx0XHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1c2VybmFtZSk7XG5cdFx0XHRcdGlmICghdXNlcikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFVzZXIgYWxyZWFkeSBjcmVhdGVkIG9yIG1lcmdlZFxuXHRcdFx0XHRpZiAodXNlci5zZXJ2aWNlcyAmJiB1c2VyLnNlcnZpY2VzW3NlcnZpY2VOYW1lXSAmJiB1c2VyLnNlcnZpY2VzW3NlcnZpY2VOYW1lXS5pZCA9PT0gc2VydmljZURhdGEuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5tZXJnZVVzZXJzICE9PSB0cnVlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignQ3VzdG9tT0F1dGgnLCBgVXNlciB3aXRoIHVzZXJuYW1lICR7IHVzZXIudXNlcm5hbWUgfSBhbHJlYWR5IGV4aXN0c2ApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2VydmljZUlkS2V5ID0gYHNlcnZpY2VzLiR7IHNlcnZpY2VOYW1lIH0uaWRgO1xuXHRcdFx0XHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0XHRcdFx0JHNldDoge1xuXHRcdFx0XHRcdFx0W3NlcnZpY2VJZEtleV06IHNlcnZpY2VEYXRhLmlkXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZSh7X2lkOiB1c2VyLl9pZH0sIHVwZGF0ZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRBY2NvdW50cy52YWxpZGF0ZU5ld1VzZXIoKHVzZXIpID0+IHtcblx0XHRcdGlmICghdXNlci5zZXJ2aWNlcyB8fCAhdXNlci5zZXJ2aWNlc1t0aGlzLm5hbWVdIHx8ICF1c2VyLnNlcnZpY2VzW3RoaXMubmFtZV0uaWQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnVzZXJuYW1lRmllbGQpIHtcblx0XHRcdFx0dXNlci51c2VybmFtZSA9IHRoaXMuZ2V0VXNlcm5hbWUodXNlci5zZXJ2aWNlc1t0aGlzLm5hbWVdKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0fVxufVxuXG5cbmNvbnN0IHVwZGF0ZU9yQ3JlYXRlVXNlckZyb21FeHRlcm5hbFNlcnZpY2UgPSBBY2NvdW50cy51cGRhdGVPckNyZWF0ZVVzZXJGcm9tRXh0ZXJuYWxTZXJ2aWNlO1xuQWNjb3VudHMudXBkYXRlT3JDcmVhdGVVc2VyRnJvbUV4dGVybmFsU2VydmljZSA9IGZ1bmN0aW9uKC8qc2VydmljZU5hbWUsIHNlcnZpY2VEYXRhLCBvcHRpb25zKi8pIHtcblx0Zm9yIChjb25zdCBob29rIG9mIEJlZm9yZVVwZGF0ZU9yQ3JlYXRlVXNlckZyb21FeHRlcm5hbFNlcnZpY2UpIHtcblx0XHRob29rLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRyZXR1cm4gdXBkYXRlT3JDcmVhdGVVc2VyRnJvbUV4dGVybmFsU2VydmljZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcbiJdfQ==
