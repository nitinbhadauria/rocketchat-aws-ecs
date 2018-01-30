(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var ECMAScript = Package.ecmascript.ECMAScript;
var SHA256 = Package.sha.SHA256;
var Accounts = Package['accounts-base'].Accounts;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var CROWD;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:crowd":{"server":{"crowd.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_crowd/server/crowd.js                                                           //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
/* globals:CROWD:true */ /* eslint new-cap: [2, {"capIsNewExceptions": ["SHA256"]}] */const logger = new Logger('CROWD', {});

function fallbackDefaultAccountSystem(bind, username, password) {
	if (typeof username === 'string') {
		if (username.indexOf('@') === -1) {
			username = {
				username
			};
		} else {
			username = {
				email: username
			};
		}
	}

	logger.info('Fallback to default account system', username);
	const loginRequest = {
		user: username,
		password: {
			digest: SHA256(password),
			algorithm: 'sha-256'
		}
	};
	return Accounts._runLoginHandlers(bind, loginRequest);
}

const CROWD = class CROWD {
	constructor() {
		const AtlassianCrowd = Npm.require('atlassian-crowd');

		let url = RocketChat.settings.get('CROWD_URL');
		const urlLastChar = url.slice(-1);

		if (urlLastChar !== '/') {
			url += '/';
		}

		this.options = {
			crowd: {
				base: url
			},
			application: {
				name: RocketChat.settings.get('CROWD_APP_USERNAME'),
				password: RocketChat.settings.get('CROWD_APP_PASSWORD')
			},
			rejectUnauthorized: RocketChat.settings.get('CROWD_Reject_Unauthorized')
		};
		this.crowdClient = new AtlassianCrowd(this.options);
		this.crowdClient.user.authenticateSync = Meteor.wrapAsync(this.crowdClient.user.authenticate, this);
		this.crowdClient.user.findSync = Meteor.wrapAsync(this.crowdClient.user.find, this);
		this.crowdClient.pingSync = Meteor.wrapAsync(this.crowdClient.ping, this);
	}

	checkConnection() {
		this.crowdClient.pingSync();
	}

	authenticate(username, password) {
		if (!username || !password) {
			logger.error('No username or password');
			return;
		}

		logger.info('Going to crowd:', username);
		const auth = this.crowdClient.user.authenticateSync(username, password);

		if (!auth) {
			return;
		}

		const userResponse = this.crowdClient.user.findSync(username);
		const user = {
			displayname: userResponse['display-name'],
			username: userResponse.name,
			email: userResponse.email,
			password,
			active: userResponse.active
		};
		return user;
	}

	syncDataToUser(crowdUser, id) {
		const user = {
			username: crowdUser.username,
			emails: [{
				address: crowdUser.email,
				verified: true
			}],
			password: crowdUser.password,
			active: crowdUser.active
		};

		if (crowdUser.displayname) {
			RocketChat._setRealName(id, crowdUser.displayname);
		}

		Meteor.users.update(id, {
			$set: user
		});
	}

	sync() {
		if (RocketChat.settings.get('CROWD_Enable') !== true) {
			return;
		}

		const self = this;
		logger.info('Sync started');
		const users = RocketChat.models.Users.findCrowdUsers();

		if (users) {
			users.forEach(function (user) {
				logger.info('Syncing user', user.username);
				const userResponse = self.crowdClient.user.findSync(user.username);

				if (userResponse) {
					const crowdUser = {
						displayname: userResponse['display-name'],
						username: userResponse.name,
						email: userResponse.email,
						password: userResponse.password,
						active: userResponse.active
					};
					self.syncDataToUser(crowdUser, user._id);
				}
			});
		}
	}

	addNewUser(crowdUser) {
		const userQuery = {
			crowd: true,
			username: crowdUser.username
		}; // find our existinmg user if they exist

		const user = Meteor.users.findOne(userQuery);

		if (user) {
			const stampedToken = Accounts._generateStampedLoginToken();

			Meteor.users.update(user._id, {
				$push: {
					'services.resume.loginTokens': Accounts._hashStampedToken(stampedToken)
				}
			});
			this.syncDataToUser(crowdUser, user._id);
			return {
				userId: user._id,
				token: stampedToken.token
			};
		} else {
			try {
				crowdUser._id = Accounts.createUser(crowdUser);
			} catch (error) {
				logger.info('Error creating new user for crowd user', error);
			}

			const updateUser = {
				name: crowdUser.displayname,
				crowd: true,
				active: crowdUser.active
			};
			Meteor.users.update(crowdUser._id, {
				$set: updateUser
			});
		}

		return {
			userId: crowdUser._id
		};
	}

};
Accounts.registerLoginHandler('crowd', function (loginRequest) {
	if (!loginRequest.crowd) {
		return undefined;
	}

	logger.info('Init CROWD login', loginRequest.username);

	if (RocketChat.settings.get('CROWD_Enable') !== true) {
		return fallbackDefaultAccountSystem(this, loginRequest.username, loginRequest.crowdPassword);
	}

	const crowd = new CROWD();
	let user;

	try {
		user = crowd.authenticate(loginRequest.username, loginRequest.crowdPassword);
	} catch (error) {
		logger.error('Crowd user not authenticated due to an error, falling back');
	}

	if (!user) {
		return fallbackDefaultAccountSystem(this, loginRequest.username, loginRequest.crowdPassword);
	}

	return crowd.addNewUser(user);
});
let interval;
let timeout;
RocketChat.settings.get('CROWD_Sync_User_Data', function (key, value) {
	Meteor.clearInterval(interval);
	Meteor.clearTimeout(timeout);

	if (value === true) {
		const crowd = new CROWD();
		logger.info('Enabling CROWD user sync');
		Meteor.setInterval(crowd.sync, 1000 * 60 * 60);
		Meteor.setTimeout(function () {
			crowd.sync();
		}, 1000 * 30);
	} else {
		logger.info('Disabling CROWD user sync');
	}
});
Meteor.methods({
	crowd_test_connection() {
		const user = Meteor.user();

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'crowd_test_connection'
			});
		}

		if (!RocketChat.authz.hasRole(user._id, 'admin')) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'crowd_test_connection'
			});
		}

		if (RocketChat.settings.get('CROWD_Enable') !== true) {
			throw new Meteor.Error('crowd_disabled');
		}

		const crowd = new CROWD();

		try {
			crowd.checkConnection();
		} catch (error) {
			logger.error('Invalid crowd connection details, check the url and application username/password and make sure this server is allowed to speak to crowd');
			throw new Meteor.Error('Invalid connection details', '', {
				method: 'crowd_test_connection'
			});
		}

		return {
			message: 'Connection success',
			params: []
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_crowd/server/settings.js                                                        //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
Meteor.startup(function () {
	RocketChat.settings.addGroup('AtlassianCrowd', function () {
		const enableQuery = {
			_id: 'CROWD_Enable',
			value: true
		};
		this.add('CROWD_Enable', false, {
			type: 'boolean',
			public: true,
			i18nLabel: 'Enabled'
		});
		this.add('CROWD_URL', '', {
			type: 'string',
			enableQuery,
			i18nLabel: 'URL'
		});
		this.add('CROWD_Reject_Unauthorized', true, {
			type: 'boolean',
			enableQuery
		});
		this.add('CROWD_APP_USERNAME', '', {
			type: 'string',
			enableQuery,
			i18nLabel: 'Username'
		});
		this.add('CROWD_APP_PASSWORD', '', {
			type: 'password',
			enableQuery,
			i18nLabel: 'Password'
		});
		this.add('CROWD_Sync_User_Data', false, {
			type: 'boolean',
			enableQuery,
			i18nLabel: 'Sync_Users'
		});
		this.add('CROWD_Test_Connection', 'crowd_test_connection', {
			type: 'action',
			actionText: 'Test_Connection',
			i18nLabel: 'Test_Connection'
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:crowd/server/crowd.js");
require("./node_modules/meteor/rocketchat:crowd/server/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:crowd'] = {}, {
  CROWD: CROWD
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_crowd.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjcm93ZC9zZXJ2ZXIvY3Jvd2QuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y3Jvd2Qvc2VydmVyL3NldHRpbmdzLmpzIl0sIm5hbWVzIjpbImxvZ2dlciIsIkxvZ2dlciIsImZhbGxiYWNrRGVmYXVsdEFjY291bnRTeXN0ZW0iLCJiaW5kIiwidXNlcm5hbWUiLCJwYXNzd29yZCIsImluZGV4T2YiLCJlbWFpbCIsImluZm8iLCJsb2dpblJlcXVlc3QiLCJ1c2VyIiwiZGlnZXN0IiwiU0hBMjU2IiwiYWxnb3JpdGhtIiwiQWNjb3VudHMiLCJfcnVuTG9naW5IYW5kbGVycyIsIkNST1dEIiwiY29uc3RydWN0b3IiLCJBdGxhc3NpYW5Dcm93ZCIsIk5wbSIsInJlcXVpcmUiLCJ1cmwiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJ1cmxMYXN0Q2hhciIsInNsaWNlIiwib3B0aW9ucyIsImNyb3dkIiwiYmFzZSIsImFwcGxpY2F0aW9uIiwibmFtZSIsInJlamVjdFVuYXV0aG9yaXplZCIsImNyb3dkQ2xpZW50IiwiYXV0aGVudGljYXRlU3luYyIsIk1ldGVvciIsIndyYXBBc3luYyIsImF1dGhlbnRpY2F0ZSIsImZpbmRTeW5jIiwiZmluZCIsInBpbmdTeW5jIiwicGluZyIsImNoZWNrQ29ubmVjdGlvbiIsImVycm9yIiwiYXV0aCIsInVzZXJSZXNwb25zZSIsImRpc3BsYXluYW1lIiwiYWN0aXZlIiwic3luY0RhdGFUb1VzZXIiLCJjcm93ZFVzZXIiLCJpZCIsImVtYWlscyIsImFkZHJlc3MiLCJ2ZXJpZmllZCIsIl9zZXRSZWFsTmFtZSIsInVzZXJzIiwidXBkYXRlIiwiJHNldCIsInN5bmMiLCJzZWxmIiwibW9kZWxzIiwiVXNlcnMiLCJmaW5kQ3Jvd2RVc2VycyIsImZvckVhY2giLCJfaWQiLCJhZGROZXdVc2VyIiwidXNlclF1ZXJ5IiwiZmluZE9uZSIsInN0YW1wZWRUb2tlbiIsIl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuIiwiJHB1c2giLCJfaGFzaFN0YW1wZWRUb2tlbiIsInVzZXJJZCIsInRva2VuIiwiY3JlYXRlVXNlciIsInVwZGF0ZVVzZXIiLCJyZWdpc3RlckxvZ2luSGFuZGxlciIsInVuZGVmaW5lZCIsImNyb3dkUGFzc3dvcmQiLCJpbnRlcnZhbCIsInRpbWVvdXQiLCJrZXkiLCJ2YWx1ZSIsImNsZWFySW50ZXJ2YWwiLCJjbGVhclRpbWVvdXQiLCJzZXRJbnRlcnZhbCIsInNldFRpbWVvdXQiLCJtZXRob2RzIiwiY3Jvd2RfdGVzdF9jb25uZWN0aW9uIiwiRXJyb3IiLCJtZXRob2QiLCJhdXRoeiIsImhhc1JvbGUiLCJtZXNzYWdlIiwicGFyYW1zIiwic3RhcnR1cCIsImFkZEdyb3VwIiwiZW5hYmxlUXVlcnkiLCJhZGQiLCJ0eXBlIiwicHVibGljIiwiaTE4bkxhYmVsIiwiYWN0aW9uVGV4dCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0IsQ0FDQSw2REFDQSxNQUFNQSxTQUFTLElBQUlDLE1BQUosQ0FBVyxPQUFYLEVBQW9CLEVBQXBCLENBQWY7O0FBRUEsU0FBU0MsNEJBQVQsQ0FBc0NDLElBQXRDLEVBQTRDQyxRQUE1QyxFQUFzREMsUUFBdEQsRUFBZ0U7QUFDL0QsS0FBSSxPQUFPRCxRQUFQLEtBQW9CLFFBQXhCLEVBQWtDO0FBQ2pDLE1BQUlBLFNBQVNFLE9BQVQsQ0FBaUIsR0FBakIsTUFBMEIsQ0FBQyxDQUEvQixFQUFrQztBQUNqQ0YsY0FBVztBQUFDQTtBQUFELElBQVg7QUFDQSxHQUZELE1BRU87QUFDTkEsY0FBVztBQUFDRyxXQUFPSDtBQUFSLElBQVg7QUFDQTtBQUNEOztBQUVESixRQUFPUSxJQUFQLENBQVksb0NBQVosRUFBa0RKLFFBQWxEO0FBRUEsT0FBTUssZUFBZTtBQUNwQkMsUUFBTU4sUUFEYztBQUVwQkMsWUFBVTtBQUNUTSxXQUFRQyxPQUFPUCxRQUFQ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V0Q6dHJ1ZSAqL1xuLyogZXNsaW50IG5ldy1jYXA6IFsyLCB7XCJjYXBJc05ld0V4Y2VwdGlvbnNcIjogW1wiU0hBMjU2XCJdfV0gKi9cbmNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0NST1dEJywge30pO1xuXG5mdW5jdGlvbiBmYWxsYmFja0RlZmF1bHRBY2NvdW50U3lzdGVtKGJpbmQsIHVzZXJuYW1lLCBwYXNzd29yZCkge1xuXHRpZiAodHlwZW9mIHVzZXJuYW1lID09PSAnc3RyaW5nJykge1xuXHRcdGlmICh1c2VybmFtZS5pbmRleE9mKCdAJykgPT09IC0xKSB7XG5cdFx0XHR1c2VybmFtZSA9IHt1c2VybmFtZX07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHVzZXJuYW1lID0ge2VtYWlsOiB1c2VybmFtZX07XG5cdFx0fVxuXHR9XG5cblx0bG9nZ2VyLmluZm8oJ0ZhbGxiYWNrIHRvIGRlZmF1bHQgYWNjb3VudCBzeXN0ZW0nLCB1c2VybmFtZSk7XG5cblx0Y29uc3QgbG9naW5SZXF1ZXN0ID0ge1xuXHRcdHVzZXI6IHVzZXJuYW1lLFxuXHRcdHBhc3N3b3JkOiB7XG5cdFx0XHRkaWdlc3Q6IFNIQTI1NihwYXNzd29yZCksXG5cdFx0XHRhbGdvcml0aG06ICdzaGEtMjU2J1xuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gQWNjb3VudHMuX3J1bkxvZ2luSGFuZGxlcnMoYmluZCwgbG9naW5SZXF1ZXN0KTtcbn1cblxuY29uc3QgQ1JPV0QgPSBjbGFzcyBDUk9XRCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IEF0bGFzc2lhbkNyb3dkID0gTnBtLnJlcXVpcmUoJ2F0bGFzc2lhbi1jcm93ZCcpO1xuXG5cdFx0bGV0IHVybCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdDUk9XRF9VUkwnKTtcblx0XHRjb25zdCB1cmxMYXN0Q2hhciA9IHVybC5zbGljZSgtMSk7XG5cblx0XHRpZiAodXJsTGFzdENoYXIgIT09ICcvJykge1xuXHRcdFx0dXJsICs9ICcvJztcblx0XHR9XG5cblx0XHR0aGlzLm9wdGlvbnMgPSB7XG5cdFx0XHRjcm93ZDoge1xuXHRcdFx0XHRiYXNlOiB1cmxcblx0XHRcdH0sXG5cdFx0XHRhcHBsaWNhdGlvbjoge1xuXHRcdFx0XHRuYW1lOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQ1JPV0RfQVBQX1VTRVJOQU1FJyksXG5cdFx0XHRcdHBhc3N3b3JkOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQ1JPV0RfQVBQX1BBU1NXT1JEJylcblx0XHRcdH0sXG5cdFx0XHRyZWplY3RVbmF1dGhvcml6ZWQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdDUk9XRF9SZWplY3RfVW5hdXRob3JpemVkJylcblx0XHR9O1xuXG5cdFx0dGhpcy5jcm93ZENsaWVudCA9IG5ldyBBdGxhc3NpYW5Dcm93ZCh0aGlzLm9wdGlvbnMpO1xuXG5cdFx0dGhpcy5jcm93ZENsaWVudC51c2VyLmF1dGhlbnRpY2F0ZVN5bmMgPSBNZXRlb3Iud3JhcEFzeW5jKHRoaXMuY3Jvd2RDbGllbnQudXNlci5hdXRoZW50aWNhdGUsIHRoaXMpO1xuXHRcdHRoaXMuY3Jvd2RDbGllbnQudXNlci5maW5kU3luYyA9IE1ldGVvci53cmFwQXN5bmModGhpcy5jcm93ZENsaWVudC51c2VyLmZpbmQsIHRoaXMpO1xuXHRcdHRoaXMuY3Jvd2RDbGllbnQucGluZ1N5bmMgPSBNZXRlb3Iud3JhcEFzeW5jKHRoaXMuY3Jvd2RDbGllbnQucGluZywgdGhpcyk7XG5cdH1cblxuXHRjaGVja0Nvbm5lY3Rpb24oKSB7XG5cdFx0dGhpcy5jcm93ZENsaWVudC5waW5nU3luYygpO1xuXHR9XG5cblx0YXV0aGVudGljYXRlKHVzZXJuYW1lLCBwYXNzd29yZCkge1xuXHRcdGlmICghdXNlcm5hbWUgfHwgIXBhc3N3b3JkKSB7XG5cdFx0XHRsb2dnZXIuZXJyb3IoJ05vIHVzZXJuYW1lIG9yIHBhc3N3b3JkJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bG9nZ2VyLmluZm8oJ0dvaW5nIHRvIGNyb3dkOicsIHVzZXJuYW1lKTtcblx0XHRjb25zdCBhdXRoID0gdGhpcy5jcm93ZENsaWVudC51c2VyLmF1dGhlbnRpY2F0ZVN5bmModXNlcm5hbWUsIHBhc3N3b3JkKTtcblxuXHRcdGlmICghYXV0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXJSZXNwb25zZSA9IHRoaXMuY3Jvd2RDbGllbnQudXNlci5maW5kU3luYyh1c2VybmFtZSk7XG5cblx0XHRjb25zdCB1c2VyID0ge1xuXHRcdFx0ZGlzcGxheW5hbWU6IHVzZXJSZXNwb25zZVsnZGlzcGxheS1uYW1lJ10sXG5cdFx0XHR1c2VybmFtZTogdXNlclJlc3BvbnNlLm5hbWUsXG5cdFx0XHRlbWFpbDogdXNlclJlc3BvbnNlLmVtYWlsLFxuXHRcdFx0cGFzc3dvcmQsXG5cdFx0XHRhY3RpdmU6IHVzZXJSZXNwb25zZS5hY3RpdmVcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHVzZXI7XG5cdH1cblxuXHRzeW5jRGF0YVRvVXNlcihjcm93ZFVzZXIsIGlkKSB7XG5cdFx0Y29uc3QgdXNlciA9IHtcblx0XHRcdHVzZXJuYW1lOiBjcm93ZFVzZXIudXNlcm5hbWUsXG5cdFx0XHRlbWFpbHM6IFt7XG5cdFx0XHRcdGFkZHJlc3MgOiBjcm93ZFVzZXIuZW1haWwsXG5cdFx0XHRcdHZlcmlmaWVkOiB0cnVlXG5cdFx0XHR9XSxcblx0XHRcdHBhc3N3b3JkOiBjcm93ZFVzZXIucGFzc3dvcmQsXG5cdFx0XHRhY3RpdmU6IGNyb3dkVXNlci5hY3RpdmVcblx0XHR9O1xuXG5cdFx0aWYgKGNyb3dkVXNlci5kaXNwbGF5bmFtZSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5fc2V0UmVhbE5hbWUoaWQsIGNyb3dkVXNlci5kaXNwbGF5bmFtZSk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZShpZCwge1xuXHRcdFx0JHNldDogdXNlclxuXHRcdH0pO1xuXHR9XG5cblx0c3luYygpIHtcblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0NST1dEX0VuYWJsZScpICE9PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cdFx0bG9nZ2VyLmluZm8oJ1N5bmMgc3RhcnRlZCcpO1xuXG5cdFx0Y29uc3QgdXNlcnMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kQ3Jvd2RVc2VycygpO1xuXHRcdGlmICh1c2Vycykge1xuXHRcdFx0dXNlcnMuZm9yRWFjaChmdW5jdGlvbih1c2VyKSB7XG5cdFx0XHRcdGxvZ2dlci5pbmZvKCdTeW5jaW5nIHVzZXInLCB1c2VyLnVzZXJuYW1lKTtcblx0XHRcdFx0Y29uc3QgdXNlclJlc3BvbnNlID0gc2VsZi5jcm93ZENsaWVudC51c2VyLmZpbmRTeW5jKHVzZXIudXNlcm5hbWUpO1xuXHRcdFx0XHRpZiAodXNlclJlc3BvbnNlKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3Jvd2RVc2VyID0ge1xuXHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IHVzZXJSZXNwb25zZVsnZGlzcGxheS1uYW1lJ10sXG5cdFx0XHRcdFx0XHR1c2VybmFtZTogdXNlclJlc3BvbnNlLm5hbWUsXG5cdFx0XHRcdFx0XHRlbWFpbDogdXNlclJlc3BvbnNlLmVtYWlsLFxuXHRcdFx0XHRcdFx0cGFzc3dvcmQ6IHVzZXJSZXNwb25zZS5wYXNzd29yZCxcblx0XHRcdFx0XHRcdGFjdGl2ZTogdXNlclJlc3BvbnNlLmFjdGl2ZVxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRzZWxmLnN5bmNEYXRhVG9Vc2VyKGNyb3dkVXNlciwgdXNlci5faWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRhZGROZXdVc2VyKGNyb3dkVXNlcikge1xuXHRcdGNvbnN0IHVzZXJRdWVyeSA9IHtcblx0XHRcdGNyb3dkOiB0cnVlLFxuXHRcdFx0dXNlcm5hbWU6IGNyb3dkVXNlci51c2VybmFtZVxuXHRcdH07XG5cblx0XHQvLyBmaW5kIG91ciBleGlzdGlubWcgdXNlciBpZiB0aGV5IGV4aXN0XG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHVzZXJRdWVyeSk7XG5cblx0XHRpZiAodXNlcikge1xuXHRcdFx0Y29uc3Qgc3RhbXBlZFRva2VuID0gQWNjb3VudHMuX2dlbmVyYXRlU3RhbXBlZExvZ2luVG9rZW4oKTtcblxuXHRcdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZSh1c2VyLl9pZCwge1xuXHRcdFx0XHQkcHVzaDoge1xuXHRcdFx0XHRcdCdzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMnOiBBY2NvdW50cy5faGFzaFN0YW1wZWRUb2tlbihzdGFtcGVkVG9rZW4pXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnN5bmNEYXRhVG9Vc2VyKGNyb3dkVXNlciwgdXNlci5faWQpO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR1c2VySWQ6IHVzZXIuX2lkLFxuXHRcdFx0XHR0b2tlbjogc3RhbXBlZFRva2VuLnRva2VuXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjcm93ZFVzZXIuX2lkID0gQWNjb3VudHMuY3JlYXRlVXNlcihjcm93ZFVzZXIpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0bG9nZ2VyLmluZm8oJ0Vycm9yIGNyZWF0aW5nIG5ldyB1c2VyIGZvciBjcm93ZCB1c2VyJywgZXJyb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB1cGRhdGVVc2VyID0ge1xuXHRcdFx0XHRuYW1lOiBjcm93ZFVzZXIuZGlzcGxheW5hbWUsXG5cdFx0XHRcdGNyb3dkOiB0cnVlLFxuXHRcdFx0XHRhY3RpdmU6IGNyb3dkVXNlci5hY3RpdmVcblx0XHRcdH07XG5cblx0XHRcdE1ldGVvci51c2Vycy51cGRhdGUoY3Jvd2RVc2VyLl9pZCwge1xuXHRcdFx0XHQkc2V0OiB1cGRhdGVVc2VyXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dXNlcklkOiBjcm93ZFVzZXIuX2lkXG5cdFx0fTtcblx0fVxufTtcblxuQWNjb3VudHMucmVnaXN0ZXJMb2dpbkhhbmRsZXIoJ2Nyb3dkJywgZnVuY3Rpb24obG9naW5SZXF1ZXN0KSB7XG5cdGlmICghbG9naW5SZXF1ZXN0LmNyb3dkKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGxvZ2dlci5pbmZvKCdJbml0IENST1dEIGxvZ2luJywgbG9naW5SZXF1ZXN0LnVzZXJuYW1lKTtcblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0NST1dEX0VuYWJsZScpICE9PSB0cnVlKSB7XG5cdFx0cmV0dXJuIGZhbGxiYWNrRGVmYXVsdEFjY291bnRTeXN0ZW0odGhpcywgbG9naW5SZXF1ZXN0LnVzZXJuYW1lLCBsb2dpblJlcXVlc3QuY3Jvd2RQYXNzd29yZCk7XG5cdH1cblxuXHRjb25zdCBjcm93ZCA9IG5ldyBDUk9XRCgpO1xuXHRsZXQgdXNlcjtcblx0dHJ5IHtcblx0XHR1c2VyID0gY3Jvd2QuYXV0aGVudGljYXRlKGxvZ2luUmVxdWVzdC51c2VybmFtZSwgbG9naW5SZXF1ZXN0LmNyb3dkUGFzc3dvcmQpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdGxvZ2dlci5lcnJvcignQ3Jvd2QgdXNlciBub3QgYXV0aGVudGljYXRlZCBkdWUgdG8gYW4gZXJyb3IsIGZhbGxpbmcgYmFjaycpO1xuXHR9XG5cblx0aWYgKCF1c2VyKSB7XG5cdFx0cmV0dXJuIGZhbGxiYWNrRGVmYXVsdEFjY291bnRTeXN0ZW0odGhpcywgbG9naW5SZXF1ZXN0LnVzZXJuYW1lLCBsb2dpblJlcXVlc3QuY3Jvd2RQYXNzd29yZCk7XG5cdH1cblxuXHRyZXR1cm4gY3Jvd2QuYWRkTmV3VXNlcih1c2VyKTtcbn0pO1xuXG5sZXQgaW50ZXJ2YWw7XG5sZXQgdGltZW91dDtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0NST1dEX1N5bmNfVXNlcl9EYXRhJywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRNZXRlb3IuY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG5cdE1ldGVvci5jbGVhclRpbWVvdXQodGltZW91dCk7XG5cblx0aWYgKHZhbHVlID09PSB0cnVlKSB7XG5cdFx0Y29uc3QgY3Jvd2QgPSBuZXcgQ1JPV0QoKTtcblx0XHRsb2dnZXIuaW5mbygnRW5hYmxpbmcgQ1JPV0QgdXNlciBzeW5jJyk7XG5cdFx0TWV0ZW9yLnNldEludGVydmFsKGNyb3dkLnN5bmMsIDEwMDAgKiA2MCAqIDYwKTtcblx0XHRNZXRlb3Iuc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdGNyb3dkLnN5bmMoKTtcblx0XHR9LCAxMDAwICogMzApO1xuXHR9IGVsc2Uge1xuXHRcdGxvZ2dlci5pbmZvKCdEaXNhYmxpbmcgQ1JPV0QgdXNlciBzeW5jJyk7XG5cdH1cbn0pO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdGNyb3dkX3Rlc3RfY29ubmVjdGlvbigpIHtcblx0XHRjb25zdCB1c2VyID0gTWV0ZW9yLnVzZXIoKTtcblx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2Nyb3dkX3Rlc3RfY29ubmVjdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1JvbGUodXNlci5faWQsICdhZG1pbicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgbWV0aG9kOiAnY3Jvd2RfdGVzdF9jb25uZWN0aW9uJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0NST1dEX0VuYWJsZScpICE9PSB0cnVlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdjcm93ZF9kaXNhYmxlZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNyb3dkID0gbmV3IENST1dEKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y3Jvd2QuY2hlY2tDb25uZWN0aW9uKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGxvZ2dlci5lcnJvcignSW52YWxpZCBjcm93ZCBjb25uZWN0aW9uIGRldGFpbHMsIGNoZWNrIHRoZSB1cmwgYW5kIGFwcGxpY2F0aW9uIHVzZXJuYW1lL3Bhc3N3b3JkIGFuZCBtYWtlIHN1cmUgdGhpcyBzZXJ2ZXIgaXMgYWxsb3dlZCB0byBzcGVhayB0byBjcm93ZCcpO1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignSW52YWxpZCBjb25uZWN0aW9uIGRldGFpbHMnLCAnJywgeyBtZXRob2Q6ICdjcm93ZF90ZXN0X2Nvbm5lY3Rpb24nIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRtZXNzYWdlOiAnQ29ubmVjdGlvbiBzdWNjZXNzJyxcblx0XHRcdHBhcmFtczogW11cblx0XHR9O1xuXHR9XG59KTtcbiIsIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdBdGxhc3NpYW5Dcm93ZCcsIGZ1bmN0aW9uKCkge1xuXHRcdGNvbnN0IGVuYWJsZVF1ZXJ5ID0ge19pZDogJ0NST1dEX0VuYWJsZScsIHZhbHVlOiB0cnVlfTtcblx0XHR0aGlzLmFkZCgnQ1JPV0RfRW5hYmxlJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBwdWJsaWM6IHRydWUsIGkxOG5MYWJlbDogJ0VuYWJsZWQnIH0pO1xuXHRcdHRoaXMuYWRkKCdDUk9XRF9VUkwnLCAnJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnksIGkxOG5MYWJlbDogJ1VSTCcgfSk7XG5cdFx0dGhpcy5hZGQoJ0NST1dEX1JlamVjdF9VbmF1dGhvcml6ZWQnLCB0cnVlLCB7IHR5cGU6ICdib29sZWFuJywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0NST1dEX0FQUF9VU0VSTkFNRScsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSwgaTE4bkxhYmVsOiAnVXNlcm5hbWUnIH0pO1xuXHRcdHRoaXMuYWRkKCdDUk9XRF9BUFBfUEFTU1dPUkQnLCAnJywgeyB0eXBlOiAncGFzc3dvcmQnLCBlbmFibGVRdWVyeSwgaTE4bkxhYmVsOiAnUGFzc3dvcmQnIH0pO1xuXHRcdHRoaXMuYWRkKCdDUk9XRF9TeW5jX1VzZXJfRGF0YScsIGZhbHNlLCB7IHR5cGU6ICdib29sZWFuJywgZW5hYmxlUXVlcnksIGkxOG5MYWJlbDogJ1N5bmNfVXNlcnMnIH0pO1xuXHRcdHRoaXMuYWRkKCdDUk9XRF9UZXN0X0Nvbm5lY3Rpb24nLCAnY3Jvd2RfdGVzdF9jb25uZWN0aW9uJywgeyB0eXBlOiAnYWN0aW9uJywgYWN0aW9uVGV4dDogJ1Rlc3RfQ29ubmVjdGlvbicsIGkxOG5MYWJlbDogJ1Rlc3RfQ29ubmVjdGlvbicgfSk7XG5cdH0pO1xufSk7XG4iXX0=
