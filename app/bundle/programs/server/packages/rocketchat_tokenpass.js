(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Accounts = Package['accounts-base'].Accounts;
var ECMAScript = Package.ecmascript.ECMAScript;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var SyncedCron = Package['percolate:synced-cron'].SyncedCron;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var CustomOAuth = Package['rocketchat:custom-oauth'].CustomOAuth;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:tokenpass":{"common.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/common.js                                                                          //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
/* global CustomOAuth */const config = {
	serverURL: '',
	identityPath: '/oauth/user',
	authorizePath: '/oauth/authorize',
	tokenPath: '/oauth/access-token',
	scope: 'user,tca,private-balances',
	tokenSentVia: 'payload',
	usernameField: 'username',
	mergeUsers: true,
	addAutopublishFields: {
		forLoggedInUser: ['services.tokenpass'],
		forOtherUsers: ['services.tokenpass.name']
	}
};
const Tokenpass = new CustomOAuth('tokenpass', config);

if (Meteor.isServer) {
	Meteor.startup(function () {
		RocketChat.settings.get('API_Tokenpass_URL', function (key, value) {
			config.serverURL = value;
			Tokenpass.configure(config);
		});
	});
} else {
	Meteor.startup(function () {
		Tracker.autorun(function () {
			if (RocketChat.settings.get('API_Tokenpass_URL')) {
				config.serverURL = RocketChat.settings.get('API_Tokenpass_URL');
				Tokenpass.configure(config);
			}
		});
	});
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server":{"startup.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/startup.js                                                                  //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.settings.addGroup('OAuth', function () {
	this.section('Tokenpass', function () {
		const enableQuery = {
			_id: 'Accounts_OAuth_Tokenpass',
			value: true
		};
		this.add('Accounts_OAuth_Tokenpass', false, {
			type: 'boolean'
		});
		this.add('API_Tokenpass_URL', '', {
			type: 'string',
			public: true,
			enableQuery,
			i18nDescription: 'API_Tokenpass_URL_Description'
		});
		this.add('Accounts_OAuth_Tokenpass_id', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Tokenpass_secret', '', {
			type: 'string',
			enableQuery
		});
		this.add('Accounts_OAuth_Tokenpass_callback_url', '_oauth/tokenpass', {
			type: 'relativeUrl',
			readonly: true,
			force: true,
			enableQuery
		});
	});
});

function validateTokenAccess(userData, roomData) {
	if (!userData || !userData.services || !userData.services.tokenpass || !userData.services.tokenpass.tcaBalances) {
		return false;
	}

	return RocketChat.Tokenpass.validateAccess(roomData.tokenpass, userData.services.tokenpass.tcaBalances);
}

Meteor.startup(function () {
	RocketChat.authz.addRoomAccessValidator(function (room, user) {
		if (!room.tokenpass) {
			return false;
		}

		const userData = RocketChat.models.Users.getTokenBalancesByUserId(user._id);
		return validateTokenAccess(userData, room);
	});
	RocketChat.callbacks.add('beforeJoinRoom', function (user, room) {
		if (room.tokenpass && !validateTokenAccess(user, room)) {
			throw new Meteor.Error('error-not-allowed', 'Token required', {
				method: 'joinRoom'
			});
		}

		return room;
	});
});
Accounts.onLogin(function ({
	user
}) {
	if (user && user.services && user.services.tokenpass) {
		RocketChat.updateUserTokenpassBalances(user);
	}
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"functions":{"getProtectedTokenpassBalances.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/functions/getProtectedTokenpassBalances.js                                  //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
let userAgent = 'Meteor';

if (Meteor.release) {
	userAgent += `/${Meteor.release}`;
}

RocketChat.getProtectedTokenpassBalances = function (accessToken) {
	try {
		return HTTP.get(`${RocketChat.settings.get('API_Tokenpass_URL')}/api/v1/tca/protected/balances`, {
			headers: {
				Accept: 'application/json',
				'User-Agent': userAgent
			},
			params: {
				oauth_token: accessToken
			}
		}).data;
	} catch (error) {
		throw new Error(`Failed to fetch protected tokenpass balances from Tokenpass. ${error.message}`);
	}
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getPublicTokenpassBalances.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/functions/getPublicTokenpassBalances.js                                     //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
let userAgent = 'Meteor';

if (Meteor.release) {
	userAgent += `/${Meteor.release}`;
}

RocketChat.getPublicTokenpassBalances = function (accessToken) {
	try {
		return HTTP.get(`${RocketChat.settings.get('API_Tokenpass_URL')}/api/v1/tca/public/balances`, {
			headers: {
				Accept: 'application/json',
				'User-Agent': userAgent
			},
			params: {
				oauth_token: accessToken
			}
		}).data;
	} catch (error) {
		throw new Error(`Failed to fetch public tokenpass balances from Tokenpass. ${error.message}`);
	}
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomTokens.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/functions/saveRoomTokens.js                                                 //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.saveRoomTokenpass = function (rid, tokenpass) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomTokens'
		});
	}

	return RocketChat.models.Rooms.setTokenpassById(rid, tokenpass);
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomTokensMinimumBalance.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/functions/saveRoomTokensMinimumBalance.js                                   //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);

RocketChat.saveRoomTokensMinimumBalance = function (rid, roomTokensMinimumBalance) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomTokensMinimumBalance'
		});
	}

	const minimumTokenBalance = parseFloat(s.escapeHTML(roomTokensMinimumBalance));
	return RocketChat.models.Rooms.setMinimumTokenBalanceById(rid, minimumTokenBalance);
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"updateUserTokenpassBalances.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/functions/updateUserTokenpassBalances.js                                    //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.updateUserTokenpassBalances = function (user) {
	if (user && user.services && user.services.tokenpass) {
		const tcaPublicBalances = RocketChat.getPublicTokenpassBalances(user.services.tokenpass.accessToken);
		const tcaProtectedBalances = RocketChat.getProtectedTokenpassBalances(user.services.tokenpass.accessToken);

		const balances = _.uniq(_.union(tcaPublicBalances, tcaProtectedBalances), false, item => item.asset);

		RocketChat.models.Users.setTokenpassTcaBalances(user._id, balances);
		return balances;
	}
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"indexes.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/models/indexes.js                                                           //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
Meteor.startup(function () {
	RocketChat.models.Rooms.tryEnsureIndex({
		'tokenpass.tokens.token': 1
	});
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Rooms.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/models/Rooms.js                                                             //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.models.Rooms.findByTokenpass = function (tokens) {
	const query = {
		'tokenpass.tokens.token': {
			$in: tokens
		}
	};
	return this._db.find(query).fetch();
};

RocketChat.models.Rooms.setTokensById = function (_id, tokens) {
	const update = {
		$set: {
			'tokenpass.tokens.token': tokens
		}
	};
	return this.update({
		_id
	}, update);
};

RocketChat.models.Rooms.setTokenpassById = function (_id, tokenpass) {
	const update = {
		$set: {
			tokenpass
		}
	};
	return this.update({
		_id
	}, update);
};

RocketChat.models.Rooms.findAllTokenChannels = function () {
	const query = {
		tokenpass: {
			$exists: true
		}
	};
	const options = {
		fields: {
			tokenpass: 1
		}
	};
	return this._db.find(query, options);
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Subscriptions.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/models/Subscriptions.js                                                     //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.models.Subscriptions.findByRoomIds = function (roomIds) {
	const query = {
		rid: {
			$in: roomIds
		}
	};
	const options = {
		fields: {
			'u._id': 1,
			rid: 1
		}
	};
	return this._db.find(query, options);
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Users.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/models/Users.js                                                             //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.models.Users.setTokenpassTcaBalances = function (_id, tcaBalances) {
	const update = {
		$set: {
			'services.tokenpass.tcaBalances': tcaBalances
		}
	};
	return this.update(_id, update);
};

RocketChat.models.Users.getTokenBalancesByUserId = function (userId) {
	const query = {
		_id: userId
	};
	const options = {
		fields: {
			'services.tokenpass.tcaBalances': 1
		}
	};
	return this.findOne(query, options);
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"findTokenChannels.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/methods/findTokenChannels.js                                                //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
Meteor.methods({
	findTokenChannels() {
		if (!Meteor.userId()) {
			return [];
		}

		const user = Meteor.user();

		if (user.services && user.services.tokenpass && user.services.tokenpass.tcaBalances) {
			const tokens = {};
			user.services.tokenpass.tcaBalances.forEach(token => {
				tokens[token.asset] = 1;
			});
			return RocketChat.models.Rooms.findByTokenpass(Object.keys(tokens)).filter(room => RocketChat.Tokenpass.validateAccess(room.tokenpass, user.services.tokenpass.tcaBalances));
		}

		return [];
	}

});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getChannelTokenpass.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/methods/getChannelTokenpass.js                                              //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
Meteor.methods({
	getChannelTokenpass(rid) {
		check(rid, String);

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'getChannelTokenpass'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(rid);

		if (!room) {
			throw new Meteor.Error('error-invalid-room', 'Invalid room', {
				method: 'getChannelTokenpass'
			});
		}

		return room.tokenpass;
	}

});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"cronRemoveUsers.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/cronRemoveUsers.js                                                          //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
/* globals SyncedCron */function removeUsersFromTokenChannels() {
	const rooms = {};
	RocketChat.models.Rooms.findAllTokenChannels().forEach(room => {
		rooms[room._id] = room.tokenpass;
	});
	const users = {};
	RocketChat.models.Subscriptions.findByRoomIds(Object.keys(rooms)).forEach(sub => {
		if (!users[sub.u._id]) {
			users[sub.u._id] = [];
		}

		users[sub.u._id].push(sub.rid);
	});
	Object.keys(users).forEach(user => {
		const userInfo = RocketChat.models.Users.findOneById(user);

		if (userInfo && userInfo.services && userInfo.services.tokenpass) {
			const balances = RocketChat.updateUserTokenpassBalances(userInfo);
			users[user].forEach(roomId => {
				const valid = RocketChat.Tokenpass.validateAccess(rooms[roomId], balances);

				if (!valid) {
					RocketChat.removeUserFromRoom(roomId, userInfo);
				}
			});
		}
	});
}

Meteor.startup(function () {
	Meteor.defer(function () {
		removeUsersFromTokenChannels();
		SyncedCron.add({
			name: 'Remove users from Token Channels',
			schedule: parser => parser.cron('0 * * * *'),
			job: removeUsersFromTokenChannels
		});
	});
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Tokenpass.js":function(require){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_tokenpass/server/Tokenpass.js                                                                //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.Tokenpass = {
	validateAccess(tokenpass, balances) {
		const compFunc = tokenpass.require === 'any' ? 'some' : 'every';
		return tokenpass.tokens[compFunc](config => {
			return balances.some(userToken => {
				return config.token === userToken.asset && parseFloat(config.balance) <= parseFloat(userToken.balance);
			});
		});
	}

};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:tokenpass/common.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/startup.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/functions/getProtectedTokenpassBalances.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/functions/getPublicTokenpassBalances.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/functions/saveRoomTokens.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/functions/saveRoomTokensMinimumBalance.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/functions/updateUserTokenpassBalances.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/models/indexes.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/models/Rooms.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/models/Subscriptions.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/models/Users.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/methods/findTokenChannels.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/methods/getChannelTokenpass.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/cronRemoveUsers.js");
require("./node_modules/meteor/rocketchat:tokenpass/server/Tokenpass.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:tokenpass'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_tokenpass.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0b2tlbnBhc3MvY29tbW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvc3RhcnR1cC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0b2tlbnBhc3Mvc2VydmVyL2Z1bmN0aW9ucy9nZXRQcm90ZWN0ZWRUb2tlbnBhc3NCYWxhbmNlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0b2tlbnBhc3Mvc2VydmVyL2Z1bmN0aW9ucy9nZXRQdWJsaWNUb2tlbnBhc3NCYWxhbmNlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0b2tlbnBhc3Mvc2VydmVyL2Z1bmN0aW9ucy9zYXZlUm9vbVRva2Vucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0b2tlbnBhc3Mvc2VydmVyL2Z1bmN0aW9ucy9zYXZlUm9vbVRva2Vuc01pbmltdW1CYWxhbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvZnVuY3Rpb25zL3VwZGF0ZVVzZXJUb2tlbnBhc3NCYWxhbmNlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0b2tlbnBhc3Mvc2VydmVyL21vZGVscy9pbmRleGVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvbW9kZWxzL1Jvb21zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvbW9kZWxzL1N1YnNjcmlwdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6dG9rZW5wYXNzL3NlcnZlci9tb2RlbHMvVXNlcnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6dG9rZW5wYXNzL3NlcnZlci9tZXRob2RzL2ZpbmRUb2tlbkNoYW5uZWxzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvbWV0aG9kcy9nZXRDaGFubmVsVG9rZW5wYXNzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvY3JvblJlbW92ZVVzZXJzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRva2VucGFzcy9zZXJ2ZXIvVG9rZW5wYXNzLmpzIl0sIm5hbWVzIjpbImNvbmZpZyIsInNlcnZlclVSTCIsImlkZW50aXR5UGF0aCIsImF1dGhvcml6ZVBhdGgiLCJ0b2tlblBhdGgiLCJzY29wZSIsInRva2VuU2VudFZpYSIsInVzZXJuYW1lRmllbGQiLCJtZXJnZVVzZXJzIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwiVG9rZW5wYXNzIiwiQ3VzdG9tT0F1dGgiLCJNZXRlb3IiLCJpc1NlcnZlciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJrZXkiLCJ2YWx1ZSIsImNvbmZpZ3VyZSIsIlRyYWNrZXIiLCJhdXRvcnVuIiwiYWRkR3JvdXAiLCJzZWN0aW9uIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJhZGQiLCJ0eXBlIiwicHVibGljIiwiaTE4bkRlc2NyaXB0aW9uIiwicmVhZG9ubHkiLCJmb3JjZSIsInZhbGlkYXRlVG9rZW5BY2Nlc3MiLCJ1c2VyRGF0YSIsInJvb21EYXRhIiwic2VydmljZXMiLCJ0b2tlbnBhc3MiLCJ0Y2FCYWxhbmNlcyIsInZhbGlkYXRlQWNjZXNzIiwiYXV0aHoiLCJhZGRSb29tQWNjZXNzVmFsaWRhdG9yIiwicm9vbSIsInVzZXIiLCJtb2RlbHMiLCJVc2VycyIsImdldFRva2VuQmFsYW5jZXNCeVVzZXJJZCIsImNhbGxiYWNrcyIsIkVycm9yIiwibWV0aG9kIiwiQWNjb3VudHMiLCJvbkxvZ2luIiwidXBkYXRlVXNlclRva2VucGFzc0JhbGFuY2VzIiwidXNlckFnZW50IiwicmVsZWFzZSIsImdldFByb3RlY3RlZFRva2VucGFzc0JhbGFuY2VzIiwiYWNjZXNzVG9rZW4iLCJIVFRQIiwiaGVhZGVycyIsIkFjY2VwdCIsInBhcmFtcyIsIm9hdXRoX3Rva2VuIiwiZGF0YSIsImVycm9yIiwibWVzc2FnZSIsImdldFB1YmxpY1Rva2VucGFzc0JhbGFuY2VzIiwic2F2ZVJvb21Ub2tlbnBhc3MiLCJyaWQiLCJNYXRjaCIsInRlc3QiLCJTdHJpbmciLCJSb29tcyIsInNldFRva2VucGFzc0J5SWQiLCJzIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJzYXZlUm9vbVRva2Vuc01pbmltdW1CYWxhbmNlIiwicm9vbVRva2Vuc01pbmltdW1CYWxhbmNlIiwibWluaW11bVRva2VuQmFsYW5jZSIsInBhcnNlRmxvYXQiLCJlc2NhcGVIVE1MIiwic2V0TWluaW11bVRva2VuQmFsYW5jZUJ5SWQiLCJfIiwidGNhUHVibGljQmFsYW5jZXMiLCJ0Y2FQcm90ZWN0ZWRCYWxhbmNlcyIsImJhbGFuY2VzIiwidW5pcSIsInVuaW9uIiwiaXRlbSIsImFzc2V0Iiwic2V0VG9rZW5wYXNzVGNhQmFsYW5jZXMiLCJ0cnlFbnN1cmVJbmRleCIsImZpbmRCeVRva2VucGFzcyIsInRva2VucyIsInF1ZXJ5IiwiJGluIiwiX2RiIiwiZmluZCIsImZldGNoIiwic2V0VG9rZW5zQnlJZCIsInVwZGF0ZSIsIiRzZXQiLCJmaW5kQWxsVG9rZW5DaGFubmVscyIsIiRleGlzdHMiLCJvcHRpb25zIiwiZmllbGRzIiwiU3Vic2NyaXB0aW9ucyIsImZpbmRCeVJvb21JZHMiLCJyb29tSWRzIiwidXNlcklkIiwiZmluZE9uZSIsIm1ldGhvZHMiLCJmaW5kVG9rZW5DaGFubmVscyIsImZvckVhY2giLCJ0b2tlbiIsIk9iamVjdCIsImtleXMiLCJmaWx0ZXIiLCJnZXRDaGFubmVsVG9rZW5wYXNzIiwiY2hlY2siLCJmaW5kT25lQnlJZCIsInJlbW92ZVVzZXJzRnJvbVRva2VuQ2hhbm5lbHMiLCJyb29tcyIsInVzZXJzIiwic3ViIiwidSIsInB1c2giLCJ1c2VySW5mbyIsInJvb21JZCIsInZhbGlkIiwicmVtb3ZlVXNlckZyb21Sb29tIiwiZGVmZXIiLCJTeW5jZWRDcm9uIiwibmFtZSIsInNjaGVkdWxlIiwicGFyc2VyIiwiY3JvbiIsImpvYiIsImNvbXBGdW5jIiwic29tZSIsInVzZXJUb2tlbiIsImJhbGFuY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0JBRUEsTUFBTUEsU0FBUztBQUNkQyxZQUFXLEVBREc7QUFFZEMsZUFBYyxhQUZBO0FBR2RDLGdCQUFlLGtCQUhEO0FBSWRDLFlBQVcscUJBSkc7QUFLZEMsUUFBTywyQkFMTztBQU1kQyxlQUFjLFNBTkE7QUFPZEMsZ0JBQWUsVUFQRDtBQVFkQyxhQUFZLElBUkU7QUFTZEMsdUJBQXNCO0FBQ3JCQyxtQkFBaUIsQ0FBQyxvQkFBRCxDQURJO0FBRXJCQyxpQkFBZSxDQUFDLHlCQUFEO0FBRk07QUFUUixDQUFmO0FBZUEsTUFBTUMsWUFBWSxJQUFJQyxXQUFKLENBQWdCLFdBQWhCLEVBQTZCYixNQUE3QixDQUFsQjs7QUFFQSxJQUFJYyxPQUFPQyxRQUFYLEVBQXFCO0FBQ3BCRCxRQUFPRSxPQUFQLENBQWUsWUFBVztBQUN6QkMsYUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsbUJBQXhCLEVBQTZDLFVBQVNDLEdBQVQsRUFBY0MsS0FBZCxFQUFxQjtBQUNqRXJCLFVBQU9DLFNBQVAsR0FBbUJvQixLQUFuQjtBQUNBVCxhQUFVVSxTQUFWLENBQW9CdEIsTUFBcEI7QUFDQSxHQUhEO0FBSUEsRUFMRDtBQU1BLENBUEQsTUFPTztBQUNOYyxRQUFPRSxP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QUFZO0FBQ1hySCxnQkFBV3NILGtCQUFYLENBQThCRixNQUE5QixFQUFzQ0QsUUFBdEM7QUFDQTtBQUNELElBTkQ7QUFPQTtBQUNELEVBZEQ7QUFlQTs7QUFFRHRILE9BQU9FLE9BQVAsQ0FBZSxZQUFXO0FBQ3pCRixRQUFPMEgsS0FBUCxDQUFhLFlBQVc7QUFDdkJWO0FBRUFXLGFBQVc1RyxHQUFYLENBQWU7QUFDZDZHLFNBQU0sa0NBRFE7QUFFZEMsYUFBV0MsTUFBRCxJQUFZQSxPQUFPQyxJQUFQLENBQVksV0FBWixDQUZSO0FBR2RDLFFBQUtoQjtBQUhTLEdBQWY7QUFLQSxFQVJEO0FBU0EsQ0FWRCxFOzs7Ozs7Ozs7OztBQ2xDQTdHLFdBQVdMLFNBQVgsR0FBdUI7QUFDdEI2QixnQkFBZUYsU0FBZixFQUEwQm1ELFFBQTFCLEVBQW9DO0FBQ25DLFFBQU1xRCxXQUFXeEcsVUFBVXVDLE9BQVYsS0FBc0IsS0FBdEIsR0FBOEIsTUFBOUIsR0FBdUMsT0FBeEQ7QUFDQSxTQUFPdkMsVUFBVTJELE1BQVYsQ0FBaUI2QyxRQUFqQixFQUE0Qi9JLE1BQUQsSUFBWTtBQUM3QyxVQUFPMEYsU0FBU3NELElBQVQsQ0FBY0MsYUFBYTtBQUNqQyxXQUFPakosT0FBT3VILEtBQVAsS0FBaUIwQixVQUFVbkQsS0FBM0IsSUFBb0NWLFdBQVdwRixPQUFPa0osT0FBbEIsS0FBOEI5RCxXQUFXNkQsVUFBVUMsT0FBckIsQ0FBekU7QUFDQSxJQUZNLENBQVA7QUFHQSxHQUpNLENBQVA7QUFLQTs7QUFScUIsQ0FBdkIsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF90b2tlbnBhc3MuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWwgQ3VzdG9tT0F1dGggKi9cblxuY29uc3QgY29uZmlnID0ge1xuXHRzZXJ2ZXJVUkw6ICcnLFxuXHRpZGVudGl0eVBhdGg6ICcvb2F1dGgvdXNlcicsXG5cdGF1dGhvcml6ZVBhdGg6ICcvb2F1dGgvYXV0aG9yaXplJyxcblx0dG9rZW5QYXRoOiAnL29hdXRoL2FjY2Vzcy10b2tlbicsXG5cdHNjb3BlOiAndXNlcix0Y2EscHJpdmF0ZS1iYWxhbmNlcycsXG5cdHRva2VuU2VudFZpYTogJ3BheWxvYWQnLFxuXHR1c2VybmFtZUZpZWxkOiAndXNlcm5hbWUnLFxuXHRtZXJnZVVzZXJzOiB0cnVlLFxuXHRhZGRBdXRvcHVibGlzaEZpZWxkczoge1xuXHRcdGZvckxvZ2dlZEluVXNlcjogWydzZXJ2aWNlcy50b2tlbnBhc3MnXSxcblx0XHRmb3JPdGhlclVzZXJzOiBbJ3NlcnZpY2VzLnRva2VucGFzcy5uYW1lJ11cblx0fVxufTtcblxuY29uc3QgVG9rZW5wYXNzID0gbmV3IEN1c3RvbU9BdXRoKCd0b2tlbnBhc3MnLCBjb25maWcpO1xuXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG5cdE1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfVG9rZW5wYXNzX1VSTCcsIGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRcdGNvbmZpZy5zZXJ2ZXJVUkwgPSB2YWx1ZTtcblx0XHRcdFRva2VucGFzcy5jb25maWd1cmUoY29uZmlnKTtcblx0XHR9KTtcblx0fSk7XG59IGVsc2Uge1xuXHRNZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0XHRUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9Ub2tlbnBhc3NfVVJMJykpIHtcblx0XHRcdFx0Y29uZmlnLnNlcnZlclVSTCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfVG9rZW5wYXNzX1VSTCcpO1xuXHRcdFx0XHRUb2tlbnBhc3MuY29uZmlndXJlKGNvbmZpZyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufVxuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnT0F1dGgnLCBmdW5jdGlvbigpIHtcblx0dGhpcy5zZWN0aW9uKCdUb2tlbnBhc3MnLCBmdW5jdGlvbigpIHtcblx0XHRjb25zdCBlbmFibGVRdWVyeSA9IHtcblx0XHRcdF9pZDogJ0FjY291bnRzX09BdXRoX1Rva2VucGFzcycsXG5cdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdH07XG5cblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfVG9rZW5wYXNzJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfVG9rZW5wYXNzX1VSTCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBwdWJsaWM6IHRydWUsIGVuYWJsZVF1ZXJ5LCBpMThuRGVzY3JpcHRpb246ICdBUElfVG9rZW5wYXNzX1VSTF9EZXNjcmlwdGlvbicgfSk7XG5cdFx0dGhpcy5hZGQoJ0FjY291bnRzX09BdXRoX1Rva2VucGFzc19pZCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfVG9rZW5wYXNzX3NlY3JldCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnQWNjb3VudHNfT0F1dGhfVG9rZW5wYXNzX2NhbGxiYWNrX3VybCcsICdfb2F1dGgvdG9rZW5wYXNzJywgeyB0eXBlOiAncmVsYXRpdmVVcmwnLCByZWFkb25seTogdHJ1ZSwgZm9yY2U6IHRydWUsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiB2YWxpZGF0ZVRva2VuQWNjZXNzKHVzZXJEYXRhLCByb29tRGF0YSkge1xuXHRpZiAoIXVzZXJEYXRhIHx8ICF1c2VyRGF0YS5zZXJ2aWNlcyB8fCAhdXNlckRhdGEuc2VydmljZXMudG9rZW5wYXNzIHx8ICF1c2VyRGF0YS5zZXJ2aWNlcy50b2tlbnBhc3MudGNhQmFsYW5jZXMpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4gUm9ja2V0Q2hhdC5Ub2tlbnBhc3MudmFsaWRhdGVBY2Nlc3Mocm9vbURhdGEudG9rZW5wYXNzLCB1c2VyRGF0YS5zZXJ2aWNlcy50b2tlbnBhc3MudGNhQmFsYW5jZXMpO1xufVxuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0Um9ja2V0Q2hhdC5hdXRoei5hZGRSb29tQWNjZXNzVmFsaWRhdG9yKGZ1bmN0aW9uKHJvb20sIHVzZXIpIHtcblx0XHRpZiAoIXJvb20udG9rZW5wYXNzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlckRhdGEgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXRUb2tlbkJhbGFuY2VzQnlVc2VySWQodXNlci5faWQpO1xuXG5cdFx0cmV0dXJuIHZhbGlkYXRlVG9rZW5BY2Nlc3ModXNlckRhdGEsIHJvb20pO1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2JlZm9yZUpvaW5Sb29tJywgZnVuY3Rpb24odXNlciwgcm9vbSkge1xuXHRcdGlmIChyb29tLnRva2VucGFzcyAmJiAhdmFsaWRhdGVUb2tlbkFjY2Vzcyh1c2VyLCByb29tKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnVG9rZW4gcmVxdWlyZWQnLCB7IG1ldGhvZDogJ2pvaW5Sb29tJyB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcm9vbTtcblx0fSk7XG59KTtcblxuQWNjb3VudHMub25Mb2dpbihmdW5jdGlvbih7IHVzZXIgfSkge1xuXHRpZiAodXNlciAmJiB1c2VyLnNlcnZpY2VzICYmIHVzZXIuc2VydmljZXMudG9rZW5wYXNzKSB7XG5cdFx0Um9ja2V0Q2hhdC51cGRhdGVVc2VyVG9rZW5wYXNzQmFsYW5jZXModXNlcik7XG5cdH1cbn0pO1xuIiwibGV0IHVzZXJBZ2VudCA9ICdNZXRlb3InO1xuaWYgKE1ldGVvci5yZWxlYXNlKSB7IHVzZXJBZ2VudCArPSBgLyR7IE1ldGVvci5yZWxlYXNlIH1gOyB9XG5cblJvY2tldENoYXQuZ2V0UHJvdGVjdGVkVG9rZW5wYXNzQmFsYW5jZXMgPSBmdW5jdGlvbihhY2Nlc3NUb2tlbikge1xuXHR0cnkge1xuXHRcdHJldHVybiBIVFRQLmdldChcblx0XHRcdGAkeyBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX1Rva2VucGFzc19VUkwnKSB9L2FwaS92MS90Y2EvcHJvdGVjdGVkL2JhbGFuY2VzYCwge1xuXHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0QWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdFx0J1VzZXItQWdlbnQnOiB1c2VyQWdlbnRcblx0XHRcdFx0fSxcblx0XHRcdFx0cGFyYW1zOiB7XG5cdFx0XHRcdFx0b2F1dGhfdG9rZW46IGFjY2Vzc1Rva2VuXG5cdFx0XHRcdH1cblx0XHRcdH0pLmRhdGE7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggcHJvdGVjdGVkIHRva2VucGFzcyBiYWxhbmNlcyBmcm9tIFRva2VucGFzcy4gJHsgZXJyb3IubWVzc2FnZSB9YCk7XG5cdH1cbn07XG4iLCJsZXQgdXNlckFnZW50ID0gJ01ldGVvcic7XG5pZiAoTWV0ZW9yLnJlbGVhc2UpIHsgdXNlckFnZW50ICs9IGAvJHsgTWV0ZW9yLnJlbGVhc2UgfWA7IH1cblxuUm9ja2V0Q2hhdC5nZXRQdWJsaWNUb2tlbnBhc3NCYWxhbmNlcyA9IGZ1bmN0aW9uKGFjY2Vzc1Rva2VuKSB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIEhUVFAuZ2V0KFxuXHRcdFx0YCR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfVG9rZW5wYXNzX1VSTCcpIH0vYXBpL3YxL3RjYS9wdWJsaWMvYmFsYW5jZXNgLCB7XG5cdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHRBY2NlcHQ6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0XHQnVXNlci1BZ2VudCc6IHVzZXJBZ2VudFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRwYXJhbXM6IHtcblx0XHRcdFx0XHRvYXV0aF90b2tlbjogYWNjZXNzVG9rZW5cblx0XHRcdFx0fVxuXHRcdFx0fSkuZGF0YTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmZXRjaCBwdWJsaWMgdG9rZW5wYXNzIGJhbGFuY2VzIGZyb20gVG9rZW5wYXNzLiAkeyBlcnJvci5tZXNzYWdlIH1gKTtcblx0fVxufTtcbiIsIlJvY2tldENoYXQuc2F2ZVJvb21Ub2tlbnBhc3MgPSBmdW5jdGlvbihyaWQsIHRva2VucGFzcykge1xuXHRpZiAoIU1hdGNoLnRlc3QocmlkLCBTdHJpbmcpKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1yb29tJywgJ0ludmFsaWQgcm9vbScsIHtcblx0XHRcdCdmdW5jdGlvbic6ICdSb2NrZXRDaGF0LnNhdmVSb29tVG9rZW5zJ1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvb21zLnNldFRva2VucGFzc0J5SWQocmlkLCB0b2tlbnBhc3MpO1xufTtcbiIsImltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcblxuUm9ja2V0Q2hhdC5zYXZlUm9vbVRva2Vuc01pbmltdW1CYWxhbmNlID0gZnVuY3Rpb24ocmlkLCByb29tVG9rZW5zTWluaW11bUJhbGFuY2UpIHtcblx0aWYgKCFNYXRjaC50ZXN0KHJpZCwgU3RyaW5nKSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnUm9ja2V0Q2hhdC5zYXZlUm9vbVRva2Vuc01pbmltdW1CYWxhbmNlJ1xuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3QgbWluaW11bVRva2VuQmFsYW5jZSA9IHBhcnNlRmxvYXQocy5lc2NhcGVIVE1MKHJvb21Ub2tlbnNNaW5pbXVtQmFsYW5jZSkpO1xuXG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRNaW5pbXVtVG9rZW5CYWxhbmNlQnlJZChyaWQsIG1pbmltdW1Ub2tlbkJhbGFuY2UpO1xufTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5Sb2NrZXRDaGF0LnVwZGF0ZVVzZXJUb2tlbnBhc3NCYWxhbmNlcyA9IGZ1bmN0aW9uKHVzZXIpIHtcblx0aWYgKHVzZXIgJiYgdXNlci5zZXJ2aWNlcyAmJiB1c2VyLnNlcnZpY2VzLnRva2VucGFzcykge1xuXHRcdGNvbnN0IHRjYVB1YmxpY0JhbGFuY2VzID0gUm9ja2V0Q2hhdC5nZXRQdWJsaWNUb2tlbnBhc3NCYWxhbmNlcyh1c2VyLnNlcnZpY2VzLnRva2VucGFzcy5hY2Nlc3NUb2tlbik7XG5cdFx0Y29uc3QgdGNhUHJvdGVjdGVkQmFsYW5jZXMgPSBSb2NrZXRDaGF0LmdldFByb3RlY3RlZFRva2VucGFzc0JhbGFuY2VzKHVzZXIuc2VydmljZXMudG9rZW5wYXNzLmFjY2Vzc1Rva2VuKTtcblxuXHRcdGNvbnN0IGJhbGFuY2VzID0gXy51bmlxKF8udW5pb24odGNhUHVibGljQmFsYW5jZXMsIHRjYVByb3RlY3RlZEJhbGFuY2VzKSwgZmFsc2UsIGl0ZW0gPT4gaXRlbS5hc3NldCk7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5zZXRUb2tlbnBhc3NUY2FCYWxhbmNlcyh1c2VyLl9pZCwgYmFsYW5jZXMpO1xuXG5cdFx0cmV0dXJuIGJhbGFuY2VzO1xuXHR9XG59O1xuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnRyeUVuc3VyZUluZGV4KHsgJ3Rva2VucGFzcy50b2tlbnMudG9rZW4nOiAxIH0pO1xufSk7XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kQnlUb2tlbnBhc3MgPSBmdW5jdGlvbih0b2tlbnMpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0J3Rva2VucGFzcy50b2tlbnMudG9rZW4nOiB7XG5cdFx0XHQkaW46IHRva2Vuc1xuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5fZGIuZmluZChxdWVyeSkuZmV0Y2goKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlJvb21zLnNldFRva2Vuc0J5SWQgPSBmdW5jdGlvbihfaWQsIHRva2Vucykge1xuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0J3Rva2VucGFzcy50b2tlbnMudG9rZW4nOiB0b2tlbnNcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHtfaWR9LCB1cGRhdGUpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0VG9rZW5wYXNzQnlJZCA9IGZ1bmN0aW9uKF9pZCwgdG9rZW5wYXNzKSB7XG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHR0b2tlbnBhc3Ncblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHsgX2lkIH0sIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kQWxsVG9rZW5DaGFubmVscyA9IGZ1bmN0aW9uKCkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHR0b2tlbnBhc3M6IHsgJGV4aXN0czogdHJ1ZSB9XG5cdH07XG5cdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0ZmllbGRzOiB7XG5cdFx0XHR0b2tlbnBhc3M6IDFcblx0XHR9XG5cdH07XG5cdHJldHVybiB0aGlzLl9kYi5maW5kKHF1ZXJ5LCBvcHRpb25zKTtcbn07XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRCeVJvb21JZHMgPSBmdW5jdGlvbihyb29tSWRzKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdHJpZDoge1xuXHRcdFx0JGluOiByb29tSWRzXG5cdFx0fVxuXHR9O1xuXHRjb25zdCBvcHRpb25zID0ge1xuXHRcdGZpZWxkczoge1xuXHRcdFx0J3UuX2lkJzogMSxcblx0XHRcdHJpZDogMVxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5fZGIuZmluZChxdWVyeSwgb3B0aW9ucyk7XG59O1xuIiwiUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0VG9rZW5wYXNzVGNhQmFsYW5jZXMgPSBmdW5jdGlvbihfaWQsIHRjYUJhbGFuY2VzKSB7XG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHQnc2VydmljZXMudG9rZW5wYXNzLnRjYUJhbGFuY2VzJzogdGNhQmFsYW5jZXNcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKF9pZCwgdXBkYXRlKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldFRva2VuQmFsYW5jZXNCeVVzZXJJZCA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWQ6IHVzZXJJZFxuXHR9O1xuXG5cdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0ZmllbGRzOiB7XG5cdFx0XHQnc2VydmljZXMudG9rZW5wYXNzLnRjYUJhbGFuY2VzJzogMVxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kT25lKHF1ZXJ5LCBvcHRpb25zKTtcbn07XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdGZpbmRUb2tlbkNoYW5uZWxzKCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHRpZiAodXNlci5zZXJ2aWNlcyAmJiB1c2VyLnNlcnZpY2VzLnRva2VucGFzcyAmJiB1c2VyLnNlcnZpY2VzLnRva2VucGFzcy50Y2FCYWxhbmNlcykge1xuXHRcdFx0Y29uc3QgdG9rZW5zID0ge307XG5cdFx0XHR1c2VyLnNlcnZpY2VzLnRva2VucGFzcy50Y2FCYWxhbmNlcy5mb3JFYWNoKHRva2VuID0+IHtcblx0XHRcdFx0dG9rZW5zW3Rva2VuLmFzc2V0XSA9IDE7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRCeVRva2VucGFzcyhPYmplY3Qua2V5cyh0b2tlbnMpKVxuXHRcdFx0XHQuZmlsdGVyKHJvb20gPT4gUm9ja2V0Q2hhdC5Ub2tlbnBhc3MudmFsaWRhdGVBY2Nlc3Mocm9vbS50b2tlbnBhc3MsIHVzZXIuc2VydmljZXMudG9rZW5wYXNzLnRjYUJhbGFuY2VzKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0Z2V0Q2hhbm5lbFRva2VucGFzcyhyaWQpIHtcblx0XHRjaGVjayhyaWQsIFN0cmluZyk7XG5cblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnZ2V0Q2hhbm5lbFRva2VucGFzcycgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJpZCk7XG5cblx0XHRpZiAoIXJvb20pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7IG1ldGhvZDogJ2dldENoYW5uZWxUb2tlbnBhc3MnIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByb29tLnRva2VucGFzcztcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIFN5bmNlZENyb24gKi9cbmZ1bmN0aW9uIHJlbW92ZVVzZXJzRnJvbVRva2VuQ2hhbm5lbHMoKSB7XG5cdGNvbnN0IHJvb21zID0ge307XG5cblx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEFsbFRva2VuQ2hhbm5lbHMoKS5mb3JFYWNoKHJvb20gPT4ge1xuXHRcdHJvb21zW3Jvb20uX2lkXSA9IHJvb20udG9rZW5wYXNzO1xuXHR9KTtcblxuXHRjb25zdCB1c2VycyA9IHt9O1xuXG5cdFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZEJ5Um9vbUlkcyhPYmplY3Qua2V5cyhyb29tcykpLmZvckVhY2goc3ViID0+IHtcblx0XHRpZiAoIXVzZXJzW3N1Yi51Ll9pZF0pIHtcblx0XHRcdHVzZXJzW3N1Yi51Ll9pZF0gPSBbXTtcblx0XHR9XG5cdFx0dXNlcnNbc3ViLnUuX2lkXS5wdXNoKHN1Yi5yaWQpO1xuXHR9KTtcblxuXHRPYmplY3Qua2V5cyh1c2VycykuZm9yRWFjaCh1c2VyID0+IHtcblx0XHRjb25zdCB1c2VySW5mbyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHVzZXIpO1xuXG5cdFx0aWYgKHVzZXJJbmZvICYmIHVzZXJJbmZvLnNlcnZpY2VzICYmIHVzZXJJbmZvLnNlcnZpY2VzLnRva2VucGFzcykge1xuXHRcdFx0Y29uc3QgYmFsYW5jZXMgPSBSb2NrZXRDaGF0LnVwZGF0ZVVzZXJUb2tlbnBhc3NCYWxhbmNlcyh1c2VySW5mbyk7XG5cblx0XHRcdHVzZXJzW3VzZXJdLmZvckVhY2gocm9vbUlkID0+IHtcblx0XHRcdFx0Y29uc3QgdmFsaWQgPSBSb2NrZXRDaGF0LlRva2VucGFzcy52YWxpZGF0ZUFjY2Vzcyhyb29tc1tyb29tSWRdLCBiYWxhbmNlcyk7XG5cblx0XHRcdFx0aWYgKCF2YWxpZCkge1xuXHRcdFx0XHRcdFJvY2tldENoYXQucmVtb3ZlVXNlckZyb21Sb29tKHJvb21JZCwgdXNlckluZm8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xufVxuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0TWV0ZW9yLmRlZmVyKGZ1bmN0aW9uKCkge1xuXHRcdHJlbW92ZVVzZXJzRnJvbVRva2VuQ2hhbm5lbHMoKTtcblxuXHRcdFN5bmNlZENyb24uYWRkKHtcblx0XHRcdG5hbWU6ICdSZW1vdmUgdXNlcnMgZnJvbSBUb2tlbiBDaGFubmVscycsXG5cdFx0XHRzY2hlZHVsZTogKHBhcnNlcikgPT4gcGFyc2VyLmNyb24oJzAgKiAqICogKicpLFxuXHRcdFx0am9iOiByZW1vdmVVc2Vyc0Zyb21Ub2tlbkNoYW5uZWxzXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iLCJSb2NrZXRDaGF0LlRva2VucGFzcyA9IHtcblx0dmFsaWRhdGVBY2Nlc3ModG9rZW5wYXNzLCBiYWxhbmNlcykge1xuXHRcdGNvbnN0IGNvbXBGdW5jID0gdG9rZW5wYXNzLnJlcXVpcmUgPT09ICdhbnknID8gJ3NvbWUnIDogJ2V2ZXJ5Jztcblx0XHRyZXR1cm4gdG9rZW5wYXNzLnRva2Vuc1tjb21wRnVuY10oKGNvbmZpZykgPT4ge1xuXHRcdFx0cmV0dXJuIGJhbGFuY2VzLnNvbWUodXNlclRva2VuID0+IHtcblx0XHRcdFx0cmV0dXJuIGNvbmZpZy50b2tlbiA9PT0gdXNlclRva2VuLmFzc2V0ICYmIHBhcnNlRmxvYXQoY29uZmlnLmJhbGFuY2UpIDw9IHBhcnNlRmxvYXQodXNlclRva2VuLmJhbGFuY2UpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cbn07XG4iXX0=
