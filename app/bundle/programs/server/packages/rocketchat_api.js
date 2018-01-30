(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Restivus = Package['nimble:restivus'].Restivus;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var result, endpoints, options, routes;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:api":{"server":{"api.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/api.js                                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

class API extends Restivus {
	constructor(properties) {
		super(properties);
		this.logger = new Logger(`API ${properties.version ? properties.version : 'default'} Logger`, {});
		this.authMethods = [];
		this.helperMethods = new Map();
		this.fieldSeparator = '.';
		this.defaultFieldsToExclude = {
			joinCode: 0,
			$loki: 0,
			meta: 0,
			members: 0,
			usernames: 0,
			// Please use the `channel/dm/group.members` endpoint. This is disabled for performance reasons
			importIds: 0
		};
		this.limitedUserFieldsToExclude = {
			avatarOrigin: 0,
			emails: 0,
			phone: 0,
			statusConnection: 0,
			createdAt: 0,
			lastLogin: 0,
			services: 0,
			requirePasswordChange: 0,
			requirePasswordChangeReason: 0,
			roles: 0,
			statusDefault: 0,
			_updatedAt: 0,
			customFields: 0
		};

		this._config.defaultOptionsEndpoint = function _defaultOptionsEndpoint() {
			if (this.request.method === 'OPTIONS' && this.request.headers['access-control-request-method']) {
				if (RocketChat.settings.get('API_Enable_CORS') === true) {
					this.response.writeHead(200, {
						'Access-Control-Allow-Origin': RocketChat.settings.get('API_CORS_Origin'),
						'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, X-User-Id, X-Auth-Token'
					});
				} else {
					this.response.writeHead(405);
					this.response.write('CORS not enabled. Go to "Admin > General > REST Api" to enable it.');
				}
			} else {
				this.response.writeHead(404);
			}

			this.done();
		};
	}

	addAuthMethod(method) {
		this.authMethods.push(method);
	}

	success(result = {}) {
		if (_.isObject(result)) {
			result.success = true;
		}

		return {
			statusCode: 200,
			body: result
		};
	}

	failure(result, errorType) {
		if (_.isObject(result)) {
			result.success = false;
		} else {
			result = {
				success: false,
				error: result
			};

			if (errorType) {
				result.errorType = errorType;
			}
		}

		return {
			statusCode: 400,
			body: result
		};
	}

	unauthorized(msg) {
		return {
			statusCode: 403,
			body: {
				success: false,
				error: msg ? msg : 'unauthorized'
			}
		};
	}

	notFound(msg) {
		return {
			statusCode: 404,
			body: {
				success: false,
				error: msg ? msg : 'Nothing was found'
			}
		};
	}

	addRoute(routes, options, endpoints) {
		//Note: required if the developer didn't provide options
		if (typeof endpoints === 'undefined') {
			endpoints = options;
			options = {};
		} //Allow for more than one route using the same option and endpoints


		if (!_.isArray(routes)) {
			routes = [routes];
		}

		routes.forEach(route => {
			//Note: This is required due to Restivus calling `addRoute` in the constructor of itself
			if (this.helperMethods) {
				Object.keys(endpoints).forEach(method => {
					if (typeof endpoints[method] === 'function') {
						endpoints[method] = {
							action: endpoints[method]
						};
					} //Add a try/catch for each endpoint


					const originalAction = endpoints[method].action;

					endpoints[method].action = function () {
						this.logger.debug(`${this.request.method.toUpperCase()}: ${this.request.url}`);
						let result;

						try {
							result = originalAction.apply(this);
						} catch (e) {
							this.logger.debug(`${method} ${route} threw an error:`, e.stack);
							return RocketChat.API.v1.failure(e.message, e.error);
						}

						result = result ? result : RocketChat.API.v1.success();

						if (/(channels|groups)\./.test(route) && result && result.body && result.body.success === true && (result.body.channel || result.body.channels || result.body.group || result.body.groups)) {
							// TODO: Remove this after three versions have been released. That means at 0.64 this should be gone. ;)
							result.body.developerWarning = '[WARNING]: The "usernames" field has been removed for performance reasons. Please use the "*.members" endpoint to get a list of members/users in a room.';
						}

						return result;
					};

					for (const [name, helperMethod] of this.helperMethods) {
						endpoints[method][name] = helperMethod;
					} //Allow the endpoints to make usage of the logger which respects the user's settings


					endpoints[method].logger = this.logger;
				});
			}

			super.addRoute(route, options, endpoints);
		});
	}

	_initAuth() {
		const loginCompatibility = bodyParams => {
			// Grab the username or email that the user is logging in with
			const {
				user,
				username,
				email,
				password,
				code
			} = bodyParams;

			if (password == null) {
				return bodyParams;
			}

			if (_.without(Object.keys(bodyParams), 'user', 'username', 'email', 'password', 'code').length > 0) {
				return bodyParams;
			}

			const auth = {
				password
			};

			if (typeof user === 'string') {
				auth.user = user.includes('@') ? {
					email: user
				} : {
					username: user
				};
			} else if (username) {
				auth.user = {
					username
				};
			} else if (email) {
				auth.user = {
					email
				};
			}

			if (auth.user == null) {
				return bodyParams;
			}

			if (auth.password.hashed) {
				auth.password = {
					digest: auth.password,
					algorithm: 'sha-256'
				};
			}

			if (code) {
				return {
					totp: {
						code,
						login: auth
					}
				};
			}

			return auth;
		};

		const self = this;
		this.addRoute('login', {
			authRequired: false
		}, {
			post() {
				const args = loginCompatibility(this.bodyParams);
				const invocation = new DDPCommon.MethodInvocation({
					connection: {
						close() {}

					}
				});
				let auth;

				try {
					auth = DDP._CurrentInvocation.withValue(invocation, () => Meteor.call('login', args));
				} catch (error) {
					let e = error;

					if (error.reason === 'User not found') {
						e = {
							error: 'Unauthorized',
							reason: 'Unauthorized'
						};
					}

					return {
						statusCode: 401,
						body: {
							status: 'error',
							error: e.error,
							message: e.reason || e.message
						}
					};
				}

				this.user = Meteor.users.findOne({
					_id: auth.id
				});
				this.userId = this.user._id; // Remove tokenExpires to keep the old behavior

				Meteor.users.update({
					_id: this.user._id,
					'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(auth.token)
				}, {
					$unset: {
						'services.resume.loginTokens.$.when': 1
					}
				});
				const response = {
					status: 'success',
					data: {
						userId: this.userId,
						authToken: auth.token
					}
				};

				const extraData = self._config.onLoggedIn && self._config.onLoggedIn.call(this);

				if (extraData != null) {
					_.extend(response.data, {
						extra: extraData
					});
				}

				return response;
			}

		});

		const logout = function () {
			// Remove the given auth token from the user's account
			const authToken = this.request.headers['x-auth-token'];

			const hashedToken = Accounts._hashLoginToken(authToken);

			const tokenLocation = self._config.auth.token;
			const index = tokenLocation.lastIndexOf('.');
			const tokenPath = tokenLocation.substring(0, index);
			const tokenFieldName = tokenLocation.substring(index + 1);
			const tokenToRemove = {};
			tokenToRemove[tokenFieldName] = hashedToken;
			const tokenRemovalQuery = {};
			tokenRemovalQuery[tokenPath] = tokenToRemove;
			Meteor.users.update(this.user._id, {
				$pull: tokenRemovalQuery
			});
			const response = {
				status: 'success',
				data: {
					message: 'You\'ve been logged out!'
				}
			}; // Call the logout hook with the authenticated user attached

			const extraData = self._config.onLoggedOut && self._config.onLoggedOut.call(this);

			if (extraData != null) {
				_.extend(response.data, {
					extra: extraData
				});
			}

			return response;
		}; /*
     Add a logout endpoint to the API
     After the user is logged out, the onLoggedOut hook is called (see Restfully.configure() for
     adding hook).
     */

		return this.addRoute('logout', {
			authRequired: true
		}, {
			get() {
				console.warn('Warning: Default logout via GET will be removed in Restivus v1.0. Use POST instead.');
				console.warn('    See https://github.com/kahmali/meteor-restivus/issues/100');
				return logout.call(this);
			},

			post: logout
		});
	}

}

RocketChat.API = {};

const getUserAuth = function _getUserAuth() {
	const invalidResults = [undefined, null, false];
	return {
		token: 'services.resume.loginTokens.hashedToken',

		user() {
			if (this.bodyParams && this.bodyParams.payload) {
				this.bodyParams = JSON.parse(this.bodyParams.payload);
			}

			for (let i = 0; i < RocketChat.API.v1.authMethods.length; i++) {
				const method = RocketChat.API.v1.authMethods[i];

				if (typeof method === 'function') {
					const result = method.apply(this, arguments);

					if (!invalidResults.includes(result)) {
						return result;
					}
				}
			}

			let token;

			if (this.request.headers['x-auth-token']) {
				token = Accounts._hashLoginToken(this.request.headers['x-auth-token']);
			}

			return {
				userId: this.request.headers['x-user-id'],
				token
			};
		}

	};
};

const createApi = function (enableCors) {
	if (!RocketChat.API.v1 || RocketChat.API.v1._config.enableCors !== enableCors) {
		RocketChat.API.v1 = new API({
			version: 'v1',
			useDefaultAuth: true,
			prettyJson: process.env.NODE_ENV === 'development',
			enableCors,
			auth: getUserAuth()
		});
	}

	if (!RocketChat.API.default || RocketChat.API.default._config.enableCors !== enableCors) {
		RocketChat.API.default = new API({
			useDefaultAuth: true,
			prettyJson: process.env.NODE_ENV === 'development',
			enableCors,
			auth: getUserAuth()
		});
	}
}; // register the API to be re-created once the CORS-setting changes.


RocketChat.settings.get('API_Enable_CORS', (key, value) => {
	createApi(value);
}); // also create the API immediately

createApi(!!RocketChat.settings.get('API_Enable_CORS'));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/settings.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.settings.addGroup('General', function () {
	this.section('REST API', function () {
		this.add('API_Upper_Count_Limit', 100, {
			type: 'int',
			public: false
		});
		this.add('API_Default_Count', 50, {
			type: 'int',
			public: false
		});
		this.add('API_Allow_Infinite_Count', true, {
			type: 'boolean',
			public: false
		});
		this.add('API_Enable_Direct_Message_History_EndPoint', false, {
			type: 'boolean',
			public: false
		});
		this.add('API_Enable_Shields', true, {
			type: 'boolean',
			public: false
		});
		this.add('API_Shield_Types', '*', {
			type: 'string',
			public: false,
			enableQuery: {
				_id: 'API_Enable_Shields',
				value: true
			}
		});
		this.add('API_Enable_CORS', false, {
			type: 'boolean',
			public: false
		});
		this.add('API_CORS_Origin', '*', {
			type: 'string',
			public: false,
			enableQuery: {
				_id: 'API_Enable_CORS',
				value: true
			}
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"v1":{"helpers":{"requestParams.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/helpers/requestParams.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.helperMethods.set('requestParams', function _requestParams() {
	return ['POST', 'PUT'].includes(this.request.method) ? this.bodyParams : this.queryParams;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getPaginationItems.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/helpers/getPaginationItems.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// If the count query param is higher than the "API_Upper_Count_Limit" setting, then we limit that
// If the count query param isn't defined, then we set it to the "API_Default_Count" setting
// If the count is zero, then that means unlimited and is only allowed if the setting "API_Allow_Infinite_Count" is true
RocketChat.API.v1.helperMethods.set('getPaginationItems', function _getPaginationItems() {
	const hardUpperLimit = RocketChat.settings.get('API_Upper_Count_Limit') <= 0 ? 100 : RocketChat.settings.get('API_Upper_Count_Limit');
	const defaultCount = RocketChat.settings.get('API_Default_Count') <= 0 ? 50 : RocketChat.settings.get('API_Default_Count');
	const offset = this.queryParams.offset ? parseInt(this.queryParams.offset) : 0;
	let count = defaultCount; // Ensure count is an appropiate amount

	if (typeof this.queryParams.count !== 'undefined') {
		count = parseInt(this.queryParams.count);
	} else {
		count = defaultCount;
	}

	if (count > hardUpperLimit) {
		count = hardUpperLimit;
	}

	if (count === 0 && !RocketChat.settings.get('API_Allow_Infinite_Count')) {
		count = defaultCount;
	}

	return {
		offset,
		count
	};
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getUserFromParams.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/helpers/getUserFromParams.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
//Convenience method, almost need to turn it into a middleware of sorts
RocketChat.API.v1.helperMethods.set('getUserFromParams', function _getUserFromParams() {
	const doesntExist = {
		_doesntExist: true
	};
	let user;
	const params = this.requestParams();

	if (params.userId && params.userId.trim()) {
		user = RocketChat.models.Users.findOneById(params.userId) || doesntExist;
	} else if (params.username && params.username.trim()) {
		user = RocketChat.models.Users.findOneByUsername(params.username) || doesntExist;
	} else if (params.user && params.user.trim()) {
		user = RocketChat.models.Users.findOneByUsername(params.user) || doesntExist;
	} else {
		throw new Meteor.Error('error-user-param-not-provided', 'The required "userId" or "username" param was not provided');
	}

	if (user._doesntExist) {
		throw new Meteor.Error('error-invalid-user', 'The required "userId" or "username" param provided does not match any users');
	}

	return user;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"isUserFromParams.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/helpers/isUserFromParams.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.helperMethods.set('isUserFromParams', function _isUserFromParams() {
	const params = this.requestParams();
	return !params.userId && !params.username && !params.user || params.userId && this.userId === params.userId || params.username && this.user.username === params.username || params.user && this.user.username === params.user;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"parseJsonQuery.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/helpers/parseJsonQuery.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.helperMethods.set('parseJsonQuery', function _parseJsonQuery() {
	let sort;

	if (this.queryParams.sort) {
		try {
			sort = JSON.parse(this.queryParams.sort);
		} catch (e) {
			this.logger.warn(`Invalid sort parameter provided "${this.queryParams.sort}":`, e);
			throw new Meteor.Error('error-invalid-sort', `Invalid sort parameter provided: "${this.queryParams.sort}"`, {
				helperMethod: 'parseJsonQuery'
			});
		}
	}

	let fields;

	if (this.queryParams.fields) {
		try {
			fields = JSON.parse(this.queryParams.fields);
		} catch (e) {
			this.logger.warn(`Invalid fields parameter provided "${this.queryParams.fields}":`, e);
			throw new Meteor.Error('error-invalid-fields', `Invalid fields parameter provided: "${this.queryParams.fields}"`, {
				helperMethod: 'parseJsonQuery'
			});
		}
	} // Verify the user's selected fields only contains ones which their role allows


	if (typeof fields === 'object') {
		let nonSelectableFields = Object.keys(RocketChat.API.v1.defaultFieldsToExclude);

		if (!RocketChat.authz.hasPermission(this.userId, 'view-full-other-user-info') && this.request.route.includes('/v1/users.')) {
			nonSelectableFields = nonSelectableFields.concat(Object.keys(RocketChat.API.v1.limitedUserFieldsToExclude));
		}

		Object.keys(fields).forEach(k => {
			if (nonSelectableFields.includes(k) || nonSelectableFields.includes(k.split(RocketChat.API.v1.fieldSeparator)[0])) {
				delete fields[k];
			}
		});
	} // Limit the fields by default


	fields = Object.assign({}, fields, RocketChat.API.v1.defaultFieldsToExclude);

	if (!RocketChat.authz.hasPermission(this.userId, 'view-full-other-user-info') && this.request.route.includes('/v1/users.')) {
		fields = Object.assign(fields, RocketChat.API.v1.limitedUserFieldsToExclude);
	}

	let query;

	if (this.queryParams.query) {
		try {
			query = JSON.parse(this.queryParams.query);
		} catch (e) {
			this.logger.warn(`Invalid query parameter provided "${this.queryParams.query}":`, e);
			throw new Meteor.Error('error-invalid-query', `Invalid query parameter provided: "${this.queryParams.query}"`, {
				helperMethod: 'parseJsonQuery'
			});
		}
	} // Verify the user has permission to query the fields they are


	if (typeof query === 'object') {
		let nonQuerableFields = Object.keys(RocketChat.API.v1.defaultFieldsToExclude);

		if (!RocketChat.authz.hasPermission(this.userId, 'view-full-other-user-info') && this.request.route.includes('/v1/users.')) {
			nonQuerableFields = nonQuerableFields.concat(Object.keys(RocketChat.API.v1.limitedUserFieldsToExclude));
		}

		Object.keys(query).forEach(k => {
			if (nonQuerableFields.includes(k) || nonQuerableFields.includes(k.split(RocketChat.API.v1.fieldSeparator)[0])) {
				delete query[k];
			}
		});
	}

	return {
		sort,
		fields,
		query
	};
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getLoggedInUser.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/helpers/getLoggedInUser.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.helperMethods.set('getLoggedInUser', function _getLoggedInUser() {
	let user;

	if (this.request.headers['x-auth-token'] && this.request.headers['x-user-id']) {
		user = RocketChat.models.Users.findOne({
			'_id': this.request.headers['x-user-id'],
			'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(this.request.headers['x-auth-token'])
		});
	}

	return user;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"channels.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/channels.js                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

//Returns the channel IF found otherwise it will return the failure of why it didn't. Check the `statusCode` property
function findChannelByIdOrName({
	params,
	checkedArchived = true,
	returnUsernames = false
}) {
	if ((!params.roomId || !params.roomId.trim()) && (!params.roomName || !params.roomName.trim())) {
		throw new Meteor.Error('error-roomid-param-not-provided', 'The parameter "roomId" or "roomName" is required');
	}

	const fields = (0, _extends3.default)({}, RocketChat.API.v1.defaultFieldsToExclude);

	if (returnUsernames) {
		delete fields.usernames;
	}

	let room;

	if (params.roomId) {
		room = RocketChat.models.Rooms.findOneById(params.roomId, {
			fields
		});
	} else if (params.roomName) {
		room = RocketChat.models.Rooms.findOneByName(params.roomName, {
			fields
		});
	}

	if (!room || room.t !== 'c') {
		throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "roomName" param provided does not match any channel');
	}

	if (checkedArchived && room.archived) {
		throw new Meteor.Error('error-room-archived', `The channel, ${room.name}, is archived`);
	}

	return room;
}

RocketChat.API.v1.addRoute('channels.addAll', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addAllUserToRoom', findResult._id, this.bodyParams.activeUsersOnly);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.addModerator', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addRoomModerator', findResult._id, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.addOwner', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addRoomOwner', findResult._id, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.archive', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('archiveRoom', findResult._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.cleanHistory', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});

		if (!this.bodyParams.latest) {
			return RocketChat.API.v1.failure('Body parameter "latest" is required.');
		}

		if (!this.bodyParams.oldest) {
			return RocketChat.API.v1.failure('Body parameter "oldest" is required.');
		}

		const latest = new Date(this.bodyParams.latest);
		const oldest = new Date(this.bodyParams.oldest);
		let inclusive = false;

		if (typeof this.bodyParams.inclusive !== 'undefined') {
			inclusive = this.bodyParams.inclusive;
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('cleanChannelHistory', {
				roomId: findResult._id,
				latest,
				oldest,
				inclusive
			});
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.close', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		const sub = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(findResult._id, this.userId);

		if (!sub) {
			return RocketChat.API.v1.failure(`The user/callee is not in the channel "${findResult.name}.`);
		}

		if (!sub.open) {
			return RocketChat.API.v1.failure(`The channel, ${findResult.name}, is already closed to the sender`);
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('hideRoom', findResult._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.create', {
	authRequired: true
}, {
	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'create-c')) {
			return RocketChat.API.v1.unauthorized();
		}

		if (!this.bodyParams.name) {
			return RocketChat.API.v1.failure('Body param "name" is required');
		}

		if (this.bodyParams.members && !_.isArray(this.bodyParams.members)) {
			return RocketChat.API.v1.failure('Body param "members" must be an array if provided');
		}

		if (this.bodyParams.customFields && !(typeof this.bodyParams.customFields === 'object')) {
			return RocketChat.API.v1.failure('Body param "customFields" must be an object if provided');
		}

		let readOnly = false;

		if (typeof this.bodyParams.readOnly !== 'undefined') {
			readOnly = this.bodyParams.readOnly;
		}

		let id;
		Meteor.runAsUser(this.userId, () => {
			id = Meteor.call('createChannel', this.bodyParams.name, this.bodyParams.members ? this.bodyParams.members : [], readOnly, this.bodyParams.customFields);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(id.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.delete', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('eraseRoom', findResult._id);
		});
		return RocketChat.API.v1.success({
			channel: findResult
		});
	}

});
RocketChat.API.v1.addRoute('channels.files', {
	authRequired: true
}, {
	get() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('canAccessRoom', findResult._id, this.userId);
		});
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			rid: findResult._id
		});
		const files = RocketChat.models.Uploads.find(ourQuery, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			files,
			count: files.length,
			offset,
			total: RocketChat.models.Uploads.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('channels.getIntegrations', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			return RocketChat.API.v1.unauthorized();
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		let includeAllPublicChannels = true;

		if (typeof this.queryParams.includeAllPublicChannels !== 'undefined') {
			includeAllPublicChannels = this.queryParams.includeAllPublicChannels === 'true';
		}

		let ourQuery = {
			channel: `#${findResult.name}`
		};

		if (includeAllPublicChannels) {
			ourQuery.channel = {
				$in: [ourQuery.channel, 'all_public_channels']
			};
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		ourQuery = Object.assign({}, query, ourQuery);
		const integrations = RocketChat.models.Integrations.find(ourQuery, {
			sort: sort ? sort : {
				_createdAt: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			integrations,
			count: integrations.length,
			offset,
			total: RocketChat.models.Integrations.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('channels.history', {
	authRequired: true
}, {
	get() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		let latestDate = new Date();

		if (this.queryParams.latest) {
			latestDate = new Date(this.queryParams.latest);
		}

		let oldestDate = undefined;

		if (this.queryParams.oldest) {
			oldestDate = new Date(this.queryParams.oldest);
		}

		let inclusive = false;

		if (this.queryParams.inclusive) {
			inclusive = this.queryParams.inclusive;
		}

		let count = 20;

		if (this.queryParams.count) {
			count = parseInt(this.queryParams.count);
		}

		let unreads = false;

		if (this.queryParams.unreads) {
			unreads = this.queryParams.unreads;
		}

		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('getChannelHistory', {
				rid: findResult._id,
				latest: latestDate,
				oldest: oldestDate,
				inclusive,
				count,
				unreads
			});
		});

		if (!result) {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success(result);
	}

});
RocketChat.API.v1.addRoute('channels.info', {
	authRequired: true
}, {
	get() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.invite', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addUserToRoom', {
				rid: findResult._id,
				username: user.username
			});
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.join', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('joinRoom', findResult._id, this.bodyParams.joinCode);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.kick', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeUserFromRoom', {
				rid: findResult._id,
				username: user.username
			});
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.leave', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('leaveRoom', findResult._id);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.list', {
	authRequired: true
}, {
	get: {
		//This is defined as such only to provide an example of how the routes can be defined :X
		action() {
			const {
				offset,
				count
			} = this.getPaginationItems();
			const {
				sort,
				fields,
				query
			} = this.parseJsonQuery();
			const ourQuery = Object.assign({}, query, {
				t: 'c'
			}); //Special check for the permissions

			if (RocketChat.authz.hasPermission(this.userId, 'view-joined-room')) {
				ourQuery.usernames = {
					$in: [this.user.username]
				};
			} else if (!RocketChat.authz.hasPermission(this.userId, 'view-c-room')) {
				return RocketChat.API.v1.unauthorized();
			}

			const rooms = RocketChat.models.Rooms.find(ourQuery, {
				sort: sort ? sort : {
					name: 1
				},
				skip: offset,
				limit: count,
				fields
			}).fetch();
			return RocketChat.API.v1.success({
				channels: rooms,
				count: rooms.length,
				offset,
				total: RocketChat.models.Rooms.find(ourQuery).count()
			});
		}

	}
});
RocketChat.API.v1.addRoute('channels.list.joined', {
	authRequired: true
}, {
	get() {
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields
		} = this.parseJsonQuery();

		let rooms = _.pluck(RocketChat.models.Subscriptions.findByTypeAndUserId('c', this.userId).fetch(), '_room');

		const totalCount = rooms.length;
		rooms = RocketChat.models.Rooms.processQueryOptionsOnResult(rooms, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		});
		return RocketChat.API.v1.success({
			channels: rooms,
			offset,
			count: rooms.length,
			total: totalCount
		});
	}

});
RocketChat.API.v1.addRoute('channels.members', {
	authRequired: true
}, {
	get() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false,
			returnUsernames: true
		});
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort
		} = this.parseJsonQuery();

		let sortFn = (a, b) => a > b;

		if (Match.test(sort, Object) && Match.test(sort.username, Number) && sort.username === -1) {
			sortFn = (a, b) => b < a;
		}

		const members = RocketChat.models.Rooms.processQueryOptionsOnResult(Array.from(findResult.usernames).sort(sortFn), {
			skip: offset,
			limit: count
		});
		const users = RocketChat.models.Users.find({
			username: {
				$in: members
			}
		}, {
			fields: {
				_id: 1,
				username: 1,
				name: 1,
				status: 1,
				utcOffset: 1
			},
			sort: sort ? sort : {
				username: 1
			}
		}).fetch();
		return RocketChat.API.v1.success({
			members: users,
			count: members.length,
			offset,
			total: findResult.usernames.length
		});
	}

});
RocketChat.API.v1.addRoute('channels.messages', {
	authRequired: true
}, {
	get() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			rid: findResult._id
		}); //Special check for the permissions

		if (RocketChat.authz.hasPermission(this.userId, 'view-joined-room') && !findResult.usernames.includes(this.user.username)) {
			return RocketChat.API.v1.unauthorized();
		} else if (!RocketChat.authz.hasPermission(this.userId, 'view-c-room')) {
			return RocketChat.API.v1.unauthorized();
		}

		const messages = RocketChat.models.Messages.find(ourQuery, {
			sort: sort ? sort : {
				ts: -1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			messages,
			count: messages.length,
			offset,
			total: RocketChat.models.Messages.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('channels.online', {
	authRequired: true
}, {
	get() {
		const {
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			t: 'c'
		});
		const room = RocketChat.models.Rooms.findOne(ourQuery);

		if (room == null) {
			return RocketChat.API.v1.failure('Channel does not exists');
		}

		const online = RocketChat.models.Users.findUsersNotOffline({
			fields: {
				username: 1
			}
		}).fetch();
		const onlineInRoom = [];
		online.forEach(user => {
			if (room.usernames.indexOf(user.username) !== -1) {
				onlineInRoom.push({
					_id: user._id,
					username: user.username
				});
			}
		});
		return RocketChat.API.v1.success({
			online: onlineInRoom
		});
	}

});
RocketChat.API.v1.addRoute('channels.open', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});
		const sub = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(findResult._id, this.userId);

		if (!sub) {
			return RocketChat.API.v1.failure(`The user/callee is not in the channel "${findResult.name}".`);
		}

		if (sub.open) {
			return RocketChat.API.v1.failure(`The channel, ${findResult.name}, is already open to the sender`);
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('openRoom', findResult._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.removeModerator', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeRoomModerator', findResult._id, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.removeOwner', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeRoomOwner', findResult._id, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('channels.rename', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.name || !this.bodyParams.name.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "name" is required');
		}

		const findResult = findChannelByIdOrName({
			params: {
				roomId: this.bodyParams.roomId
			}
		});

		if (findResult.name === this.bodyParams.name) {
			return RocketChat.API.v1.failure('The channel name is the same as what it would be renamed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'roomName', this.bodyParams.name);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.setDescription', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.description || !this.bodyParams.description.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "description" is required');
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});

		if (findResult.description === this.bodyParams.description) {
			return RocketChat.API.v1.failure('The channel description is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'roomDescription', this.bodyParams.description);
		});
		return RocketChat.API.v1.success({
			description: this.bodyParams.description
		});
	}

});
RocketChat.API.v1.addRoute('channels.setJoinCode', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.joinCode || !this.bodyParams.joinCode.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "joinCode" is required');
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'joinCode', this.bodyParams.joinCode);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.setPurpose', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.purpose || !this.bodyParams.purpose.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "purpose" is required');
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});

		if (findResult.description === this.bodyParams.purpose) {
			return RocketChat.API.v1.failure('The channel purpose (description) is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'roomDescription', this.bodyParams.purpose);
		});
		return RocketChat.API.v1.success({
			purpose: this.bodyParams.purpose
		});
	}

});
RocketChat.API.v1.addRoute('channels.setReadOnly', {
	authRequired: true
}, {
	post() {
		if (typeof this.bodyParams.readOnly === 'undefined') {
			return RocketChat.API.v1.failure('The bodyParam "readOnly" is required');
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});

		if (findResult.ro === this.bodyParams.readOnly) {
			return RocketChat.API.v1.failure('The channel read only setting is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'readOnly', this.bodyParams.readOnly);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.setTopic', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.topic || !this.bodyParams.topic.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "topic" is required');
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});

		if (findResult.topic === this.bodyParams.topic) {
			return RocketChat.API.v1.failure('The channel topic is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'roomTopic', this.bodyParams.topic);
		});
		return RocketChat.API.v1.success({
			topic: this.bodyParams.topic
		});
	}

});
RocketChat.API.v1.addRoute('channels.setType', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.type || !this.bodyParams.type.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "type" is required');
		}

		const findResult = findChannelByIdOrName({
			params: this.requestParams()
		});

		if (findResult.t === this.bodyParams.type) {
			return RocketChat.API.v1.failure('The channel type is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult._id, 'roomType', this.bodyParams.type);
		});
		return RocketChat.API.v1.success({
			channel: RocketChat.models.Rooms.findOneById(findResult._id, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('channels.unarchive', {
	authRequired: true
}, {
	post() {
		const findResult = findChannelByIdOrName({
			params: this.requestParams(),
			checkedArchived: false
		});

		if (!findResult.archived) {
			return RocketChat.API.v1.failure(`The channel, ${findResult.name}, is not archived`);
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('unarchiveRoom', findResult._id);
		});
		return RocketChat.API.v1.success();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"rooms.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/rooms.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('rooms.get', {
	authRequired: true
}, {
	get() {
		const {
			updatedSince
		} = this.queryParams;
		let updatedSinceDate;

		if (updatedSince) {
			if (isNaN(Date.parse(updatedSince))) {
				throw new Meteor.Error('error-updatedSince-param-invalid', 'The "updatedSince" query parameter must be a valid date.');
			} else {
				updatedSinceDate = new Date(updatedSince);
			}
		}

		let result;
		Meteor.runAsUser(this.userId, () => result = Meteor.call('rooms/get', updatedSinceDate));

		if (Array.isArray(result)) {
			result = {
				update: result,
				remove: []
			};
		}

		return RocketChat.API.v1.success(result);
	}

});
RocketChat.API.v1.addRoute('rooms.upload/:rid', {
	authRequired: true
}, {
	post() {
		const room = Meteor.call('canAccessRoom', this.urlParams.rid, this.userId);

		if (!room) {
			return RocketChat.API.v1.unauthorized();
		}

		const Busboy = Npm.require('busboy');

		const busboy = new Busboy({
			headers: this.request.headers
		});
		const files = [];
		const fields = {};
		Meteor.wrapAsync(callback => {
			busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
				if (fieldname !== 'file') {
					return files.push(new Meteor.Error('invalid-field'));
				}

				const fileDate = [];
				file.on('data', data => fileDate.push(data));
				file.on('end', () => {
					files.push({
						fieldname,
						file,
						filename,
						encoding,
						mimetype,
						fileBuffer: Buffer.concat(fileDate)
					});
				});
			});
			busboy.on('field', (fieldname, value) => fields[fieldname] = value);
			busboy.on('finish', Meteor.bindEnvironment(() => callback()));
			this.request.pipe(busboy);
		})();

		if (files.length === 0) {
			return RocketChat.API.v1.failure('File required');
		}

		if (files.length > 1) {
			return RocketChat.API.v1.failure('Just 1 file is allowed');
		}

		const file = files[0];
		const fileStore = FileUpload.getStore('Uploads');
		const details = {
			name: file.filename,
			size: file.fileBuffer.length,
			type: file.mimetype,
			rid: this.urlParams.rid
		};
		Meteor.runAsUser(this.userId, () => {
			const uploadedFile = Meteor.wrapAsync(fileStore.insert.bind(fileStore))(details, file.fileBuffer);
			uploadedFile.description = fields.description;
			delete fields.description;
			RocketChat.API.v1.success(Meteor.call('sendFileMessage', this.urlParams.rid, null, uploadedFile, fields));
		});
		return RocketChat.API.v1.success();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"subscriptions.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/subscriptions.js                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('subscriptions.get', {
	authRequired: true
}, {
	get() {
		const {
			updatedSince
		} = this.queryParams;
		let updatedSinceDate;

		if (updatedSince) {
			if (isNaN(Date.parse(updatedSince))) {
				throw new Meteor.Error('error-roomId-param-invalid', 'The "lastUpdate" query parameter must be a valid date.');
			} else {
				updatedSinceDate = new Date(updatedSince);
			}
		}

		let result;
		Meteor.runAsUser(this.userId, () => result = Meteor.call('subscriptions/get', updatedSinceDate));

		if (Array.isArray(result)) {
			result = {
				update: result,
				remove: []
			};
		}

		return RocketChat.API.v1.success(result);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"chat.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/chat.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* global processWebhookMessage */RocketChat.API.v1.addRoute('chat.delete', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			msgId: String,
			roomId: String,
			asUser: Match.Maybe(Boolean)
		}));
		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.msgId, {
			fields: {
				u: 1,
				rid: 1
			}
		});

		if (!msg) {
			return RocketChat.API.v1.failure(`No message found with the id of "${this.bodyParams.msgId}".`);
		}

		if (this.bodyParams.roomId !== msg.rid) {
			return RocketChat.API.v1.failure('The room id provided does not match where the message is from.');
		}

		if (this.bodyParams.asUser && msg.u._id !== this.userId && !RocketChat.authz.hasPermission(Meteor.userId(), 'force-delete-message', msg.rid)) {
			return RocketChat.API.v1.failure('Unauthorized. You must have the permission "force-delete-message" to delete other\'s message as them.');
		}

		Meteor.runAsUser(this.bodyParams.asUser ? msg.u._id : this.userId, () => {
			Meteor.call('deleteMessage', {
				_id: msg._id
			});
		});
		return RocketChat.API.v1.success({
			_id: msg._id,
			ts: Date.now(),
			message: msg
		});
	}

});
RocketChat.API.v1.addRoute('chat.syncMessages', {
	authRequired: true
}, {
	get() {
		const {
			roomId,
			lastUpdate
		} = this.queryParams;

		if (!roomId) {
			throw new Meteor.Error('error-roomId-param-not-provided', 'The required "roomId" query param is missing.');
		}

		if (!lastUpdate) {
			throw new Meteor.Error('error-lastUpdate-param-not-provided', 'The required "lastUpdate" query param is missing.');
		} else if (isNaN(Date.parse(lastUpdate))) {
			throw new Meteor.Error('error-roomId-param-invalid', 'The "lastUpdate" query parameter must be a valid date.');
		}

		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('messages/get', roomId, {
				lastUpdate: new Date(lastUpdate)
			});
		});

		if (!result) {
			return RocketChat.API.v1.failure();
		}

		return RocketChat.API.v1.success({
			result
		});
	}

});
RocketChat.API.v1.addRoute('chat.getMessage', {
	authRequired: true
}, {
	get() {
		if (!this.queryParams.msgId) {
			return RocketChat.API.v1.failure('The "msgId" query parameter must be provided.');
		}

		let msg;
		Meteor.runAsUser(this.userId, () => {
			msg = Meteor.call('getSingleMessage', this.queryParams.msgId);
		});

		if (!msg) {
			return RocketChat.API.v1.failure();
		}

		return RocketChat.API.v1.success({
			message: msg
		});
	}

});
RocketChat.API.v1.addRoute('chat.pinMessage', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is missing.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		let pinnedMessage;
		Meteor.runAsUser(this.userId, () => pinnedMessage = Meteor.call('pinMessage', msg));
		return RocketChat.API.v1.success({
			message: pinnedMessage
		});
	}

});
RocketChat.API.v1.addRoute('chat.postMessage', {
	authRequired: true
}, {
	post() {
		const messageReturn = processWebhookMessage(this.bodyParams, this.user, undefined, true)[0];

		if (!messageReturn) {
			return RocketChat.API.v1.failure('unknown-error');
		}

		return RocketChat.API.v1.success({
			ts: Date.now(),
			channel: messageReturn.channel,
			message: messageReturn.message
		});
	}

});
RocketChat.API.v1.addRoute('chat.search', {
	authRequired: true
}, {
	get() {
		const {
			roomId,
			searchText,
			limit
		} = this.queryParams;

		if (!roomId) {
			throw new Meteor.Error('error-roomId-param-not-provided', 'The required "roomId" query param is missing.');
		}

		if (!searchText) {
			throw new Meteor.Error('error-searchText-param-not-provided', 'The required "searchText" query param is missing.');
		}

		if (limit && (typeof limit !== 'number' || isNaN(limit) || limit <= 0)) {
			throw new Meteor.Error('error-limit-param-invalid', 'The "limit" query parameter must be a valid number and be greater than 0.');
		}

		let result;
		Meteor.runAsUser(this.userId, () => result = Meteor.call('messageSearch', searchText, roomId, limit));
		return RocketChat.API.v1.success({
			messages: result.messages
		});
	}

}); // The difference between `chat.postMessage` and `chat.sendMessage` is that `chat.sendMessage` allows
// for passing a value for `_id` and the other one doesn't. Also, `chat.sendMessage` only sends it to
// one channel whereas the other one allows for sending to more than one channel at a time.

RocketChat.API.v1.addRoute('chat.sendMessage', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.message) {
			throw new Meteor.Error('error-invalid-params', 'The "message" parameter must be provided.');
		}

		let message;
		Meteor.runAsUser(this.userId, () => message = Meteor.call('sendMessage', this.bodyParams.message));
		return RocketChat.API.v1.success({
			message
		});
	}

});
RocketChat.API.v1.addRoute('chat.starMessage', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is required.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('starMessage', {
			_id: msg._id,
			rid: msg.rid,
			starred: true
		}));
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('chat.unPinMessage', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is required.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('unpinMessage', msg));
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('chat.unStarMessage', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.messageId || !this.bodyParams.messageId.trim()) {
			throw new Meteor.Error('error-messageid-param-not-provided', 'The required "messageId" param is required.');
		}

		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.messageId);

		if (!msg) {
			throw new Meteor.Error('error-message-not-found', 'The provided "messageId" does not match any existing message.');
		}

		Meteor.runAsUser(this.userId, () => Meteor.call('starMessage', {
			_id: msg._id,
			rid: msg.rid,
			starred: false
		}));
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('chat.update', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			roomId: String,
			msgId: String,
			text: String //Using text to be consistant with chat.postMessage

		}));
		const msg = RocketChat.models.Messages.findOneById(this.bodyParams.msgId); //Ensure the message exists

		if (!msg) {
			return RocketChat.API.v1.failure(`No message found with the id of "${this.bodyParams.msgId}".`);
		}

		if (this.bodyParams.roomId !== msg.rid) {
			return RocketChat.API.v1.failure('The room id provided does not match where the message is from.');
		} //Permission checks are already done in the updateMessage method, so no need to duplicate them


		Meteor.runAsUser(this.userId, () => {
			Meteor.call('updateMessage', {
				_id: msg._id,
				msg: this.bodyParams.text,
				rid: msg.rid
			});
		});
		return RocketChat.API.v1.success({
			message: RocketChat.models.Messages.findOneById(msg._id)
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"commands.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/commands.js                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('commands.get', {
	authRequired: true
}, {
	get() {
		const params = this.queryParams;

		if (typeof params.command !== 'string') {
			return RocketChat.API.v1.failure('The query param "command" must be provided.');
		}

		const cmd = RocketChat.slashCommands.commands[params.command.toLowerCase()];

		if (!cmd) {
			return RocketChat.API.v1.failure(`There is no command in the system by the name of: ${params.command}`);
		}

		return RocketChat.API.v1.success({
			command: cmd
		});
	}

});
RocketChat.API.v1.addRoute('commands.list', {
	authRequired: true
}, {
	get() {
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		let commands = Object.values(RocketChat.slashCommands.commands);

		if (query && query.command) {
			commands = commands.filter(command => command.command === query.command);
		}

		const totalCount = commands.length;
		commands = RocketChat.models.Rooms.processQueryOptionsOnResult(commands, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		});
		return RocketChat.API.v1.success({
			commands,
			offset,
			count: commands.length,
			total: totalCount
		});
	}

}); // Expects a body of: { command: 'gimme', params: 'any string value', roomId: 'value' }

RocketChat.API.v1.addRoute('commands.run', {
	authRequired: true
}, {
	post() {
		const body = this.bodyParams;
		const user = this.getLoggedInUser();

		if (typeof body.command !== 'string') {
			return RocketChat.API.v1.failure('You must provide a command to run.');
		}

		if (body.params && typeof body.params !== 'string') {
			return RocketChat.API.v1.failure('The parameters for the command must be a single string.');
		}

		if (typeof body.roomId !== 'string') {
			return RocketChat.API.v1.failure('The room\'s id where to execute this command must provided and be a string.');
		}

		const cmd = body.command.toLowerCase();

		if (!RocketChat.slashCommands.commands[body.command.toLowerCase()]) {
			return RocketChat.API.v1.failure('The command provided does not exist (or is disabled).');
		} // This will throw an error if they can't or the room is invalid


		Meteor.call('canAccessRoom', body.roomId, user._id);
		const params = body.params ? body.params : '';
		let result;
		Meteor.runAsUser(user._id, () => {
			result = RocketChat.slashCommands.run(cmd, params, {
				_id: Random.id(),
				rid: body.roomId,
				msg: `/${cmd} ${params}`
			});
		});
		return RocketChat.API.v1.success({
			result
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"groups.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/groups.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

//Returns the private group subscription IF found otherwise it will return the failure of why it didn't. Check the `statusCode` property
function findPrivateGroupByIdOrName({
	params,
	userId,
	checkedArchived = true
}) {
	if ((!params.roomId || !params.roomId.trim()) && (!params.roomName || !params.roomName.trim())) {
		throw new Meteor.Error('error-room-param-not-provided', 'The parameter "roomId" or "roomName" is required');
	}

	let roomSub;

	if (params.roomId) {
		roomSub = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(params.roomId, userId);
	} else if (params.roomName) {
		roomSub = RocketChat.models.Subscriptions.findOneByRoomNameAndUserId(params.roomName, userId);
	}

	if (!roomSub || roomSub.t !== 'p') {
		throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "roomName" param provided does not match any group');
	}

	if (checkedArchived && roomSub.archived) {
		throw new Meteor.Error('error-room-archived', `The private group, ${roomSub.name}, is archived`);
	}

	return roomSub;
}

RocketChat.API.v1.addRoute('groups.addAll', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addAllUserToRoom', findResult.rid, this.bodyParams.activeUsersOnly);
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(findResult.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.addModerator', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addRoomModerator', findResult.rid, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.addOwner', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addRoomOwner', findResult.rid, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.addLeader', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addRoomLeader', findResult.rid, user._id);
		});
		return RocketChat.API.v1.success();
	}

}); //Archives a private group only if it wasn't

RocketChat.API.v1.addRoute('groups.archive', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('archiveRoom', findResult.rid);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.close', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});

		if (!findResult.open) {
			return RocketChat.API.v1.failure(`The private group, ${findResult.name}, is already closed to the sender`);
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('hideRoom', findResult.rid);
		});
		return RocketChat.API.v1.success();
	}

}); //Create Private Group

RocketChat.API.v1.addRoute('groups.create', {
	authRequired: true
}, {
	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'create-p')) {
			return RocketChat.API.v1.unauthorized();
		}

		if (!this.bodyParams.name) {
			return RocketChat.API.v1.failure('Body param "name" is required');
		}

		if (this.bodyParams.members && !_.isArray(this.bodyParams.members)) {
			return RocketChat.API.v1.failure('Body param "members" must be an array if provided');
		}

		if (this.bodyParams.customFields && !(typeof this.bodyParams.customFields === 'object')) {
			return RocketChat.API.v1.failure('Body param "customFields" must be an object if provided');
		}

		let readOnly = false;

		if (typeof this.bodyParams.readOnly !== 'undefined') {
			readOnly = this.bodyParams.readOnly;
		}

		let id;
		Meteor.runAsUser(this.userId, () => {
			id = Meteor.call('createPrivateGroup', this.bodyParams.name, this.bodyParams.members ? this.bodyParams.members : [], readOnly, this.bodyParams.customFields);
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(id.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.delete', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('eraseRoom', findResult.rid);
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.processQueryOptionsOnResult([findResult._room], {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})[0]
		});
	}

});
RocketChat.API.v1.addRoute('groups.files', {
	authRequired: true
}, {
	get() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			rid: findResult.rid
		});
		const files = RocketChat.models.Uploads.find(ourQuery, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			files,
			count: files.length,
			offset,
			total: RocketChat.models.Uploads.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('groups.getIntegrations', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			return RocketChat.API.v1.unauthorized();
		}

		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});
		let includeAllPrivateGroups = true;

		if (typeof this.queryParams.includeAllPrivateGroups !== 'undefined') {
			includeAllPrivateGroups = this.queryParams.includeAllPrivateGroups === 'true';
		}

		const channelsToSearch = [`#${findResult.name}`];

		if (includeAllPrivateGroups) {
			channelsToSearch.push('all_private_groups');
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			channel: {
				$in: channelsToSearch
			}
		});
		const integrations = RocketChat.models.Integrations.find(ourQuery, {
			sort: sort ? sort : {
				_createdAt: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			integrations,
			count: integrations.length,
			offset,
			total: RocketChat.models.Integrations.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('groups.history', {
	authRequired: true
}, {
	get() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});
		let latestDate = new Date();

		if (this.queryParams.latest) {
			latestDate = new Date(this.queryParams.latest);
		}

		let oldestDate = undefined;

		if (this.queryParams.oldest) {
			oldestDate = new Date(this.queryParams.oldest);
		}

		let inclusive = false;

		if (this.queryParams.inclusive) {
			inclusive = this.queryParams.inclusive;
		}

		let count = 20;

		if (this.queryParams.count) {
			count = parseInt(this.queryParams.count);
		}

		let unreads = false;

		if (this.queryParams.unreads) {
			unreads = this.queryParams.unreads;
		}

		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('getChannelHistory', {
				rid: findResult.rid,
				latest: latestDate,
				oldest: oldestDate,
				inclusive,
				count,
				unreads
			});
		});

		if (!result) {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success(result);
	}

});
RocketChat.API.v1.addRoute('groups.info', {
	authRequired: true
}, {
	get() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(findResult.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.invite', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('addUserToRoom', {
				rid: findResult.rid,
				username: user.username
			});
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(findResult.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.kick', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeUserFromRoom', {
				rid: findResult.rid,
				username: user.username
			});
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.leave', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('leaveRoom', findResult.rid);
		});
		return RocketChat.API.v1.success();
	}

}); //List Private Groups a user has access to

RocketChat.API.v1.addRoute('groups.list', {
	authRequired: true
}, {
	get() {
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields
		} = this.parseJsonQuery();

		let rooms = _.pluck(RocketChat.models.Subscriptions.findByTypeAndUserId('p', this.userId).fetch(), '_room');

		const totalCount = rooms.length;
		rooms = RocketChat.models.Rooms.processQueryOptionsOnResult(rooms, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		});
		return RocketChat.API.v1.success({
			groups: rooms,
			offset,
			count: rooms.length,
			total: totalCount
		});
	}

});
RocketChat.API.v1.addRoute('groups.listAll', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-room-administration')) {
			return RocketChat.API.v1.unauthorized();
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields
		} = this.parseJsonQuery();
		let rooms = RocketChat.models.Rooms.findByType('p').fetch();
		const totalCount = rooms.length;
		rooms = RocketChat.models.Rooms.processQueryOptionsOnResult(rooms, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		});
		return RocketChat.API.v1.success({
			groups: rooms,
			offset,
			count: rooms.length,
			total: totalCount
		});
	}

});
RocketChat.API.v1.addRoute('groups.members', {
	authRequired: true
}, {
	get() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort
		} = this.parseJsonQuery();

		let sortFn = (a, b) => a > b;

		if (Match.test(sort, Object) && Match.test(sort.username, Number) && sort.username === -1) {
			sortFn = (a, b) => b < a;
		}

		const members = RocketChat.models.Rooms.processQueryOptionsOnResult(Array.from(findResult._room.usernames).sort(sortFn), {
			skip: offset,
			limit: count
		});
		const users = RocketChat.models.Users.find({
			username: {
				$in: members
			}
		}, {
			fields: {
				_id: 1,
				username: 1,
				name: 1,
				status: 1,
				utcOffset: 1
			},
			sort: sort ? sort : {
				username: 1
			}
		}).fetch();
		return RocketChat.API.v1.success({
			members: users,
			count: members.length,
			offset,
			total: findResult._room.usernames.length
		});
	}

});
RocketChat.API.v1.addRoute('groups.messages', {
	authRequired: true
}, {
	get() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			rid: findResult.rid
		});
		const messages = RocketChat.models.Messages.find(ourQuery, {
			sort: sort ? sort : {
				ts: -1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			messages,
			count: messages.length,
			offset,
			total: RocketChat.models.Messages.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('groups.online', {
	authRequired: true
}, {
	get() {
		const {
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			t: 'p'
		});
		const room = RocketChat.models.Rooms.findOne(ourQuery);

		if (room == null) {
			return RocketChat.API.v1.failure('Group does not exists');
		}

		const online = RocketChat.models.Users.findUsersNotOffline({
			fields: {
				username: 1
			}
		}).fetch();
		const onlineInRoom = [];
		online.forEach(user => {
			if (room.usernames.indexOf(user.username) !== -1) {
				onlineInRoom.push({
					_id: user._id,
					username: user.username
				});
			}
		});
		return RocketChat.API.v1.success({
			online: onlineInRoom
		});
	}

});
RocketChat.API.v1.addRoute('groups.open', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});

		if (findResult.open) {
			return RocketChat.API.v1.failure(`The private group, ${findResult.name}, is already open for the sender`);
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('openRoom', findResult.rid);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.removeModerator', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeRoomModerator', findResult.rid, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.removeOwner', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeRoomOwner', findResult.rid, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.removeLeader', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('removeRoomLeader', findResult.rid, user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('groups.rename', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.name || !this.bodyParams.name.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "name" is required');
		}

		const findResult = findPrivateGroupByIdOrName({
			params: {
				roomId: this.bodyParams.roomId
			},
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.rid, 'roomName', this.bodyParams.name);
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(findResult.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.setDescription', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.description || !this.bodyParams.description.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "description" is required');
		}

		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.rid, 'roomDescription', this.bodyParams.description);
		});
		return RocketChat.API.v1.success({
			description: this.bodyParams.description
		});
	}

});
RocketChat.API.v1.addRoute('groups.setPurpose', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.purpose || !this.bodyParams.purpose.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "purpose" is required');
		}

		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.rid, 'roomDescription', this.bodyParams.purpose);
		});
		return RocketChat.API.v1.success({
			purpose: this.bodyParams.purpose
		});
	}

});
RocketChat.API.v1.addRoute('groups.setReadOnly', {
	authRequired: true
}, {
	post() {
		if (typeof this.bodyParams.readOnly === 'undefined') {
			return RocketChat.API.v1.failure('The bodyParam "readOnly" is required');
		}

		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});

		if (findResult.ro === this.bodyParams.readOnly) {
			return RocketChat.API.v1.failure('The private group read only setting is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.rid, 'readOnly', this.bodyParams.readOnly);
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(findResult.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.setTopic', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.topic || !this.bodyParams.topic.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "topic" is required');
		}

		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.rid, 'roomTopic', this.bodyParams.topic);
		});
		return RocketChat.API.v1.success({
			topic: this.bodyParams.topic
		});
	}

});
RocketChat.API.v1.addRoute('groups.setType', {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.type || !this.bodyParams.type.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "type" is required');
		}

		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId
		});

		if (findResult.t === this.bodyParams.type) {
			return RocketChat.API.v1.failure('The private group type is the same as what it would be changed to.');
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.rid, 'roomType', this.bodyParams.type);
		});
		return RocketChat.API.v1.success({
			group: RocketChat.models.Rooms.findOneById(findResult.rid, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('groups.unarchive', {
	authRequired: true
}, {
	post() {
		const findResult = findPrivateGroupByIdOrName({
			params: this.requestParams(),
			userId: this.userId,
			checkedArchived: false
		});
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('unarchiveRoom', findResult.rid);
		});
		return RocketChat.API.v1.success();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"im.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/im.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

function findDirectMessageRoom(params, user) {
	if ((!params.roomId || !params.roomId.trim()) && (!params.username || !params.username.trim())) {
		throw new Meteor.Error('error-room-param-not-provided', 'Body param "roomId" or "username" is required');
	}

	const room = RocketChat.getRoomByNameOrIdWithOptionToJoin({
		currentUserId: user._id,
		nameOrId: params.username || params.roomId,
		type: 'd'
	});

	if (!room || room.t !== 'd') {
		throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "username" param provided does not match any dirct message');
	}

	const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(room._id, user._id);
	return {
		room,
		subscription
	};
}

RocketChat.API.v1.addRoute(['dm.create', 'im.create'], {
	authRequired: true
}, {
	post() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);
		return RocketChat.API.v1.success({
			room: findResult.room
		});
	}

});
RocketChat.API.v1.addRoute(['dm.close', 'im.close'], {
	authRequired: true
}, {
	post() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);

		if (!findResult.subscription.open) {
			return RocketChat.API.v1.failure(`The direct message room, ${this.bodyParams.name}, is already closed to the sender`);
		}

		Meteor.runAsUser(this.userId, () => {
			Meteor.call('hideRoom', findResult.room._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute(['dm.files', 'im.files'], {
	authRequired: true
}, {
	get() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			rid: findResult.room._id
		});
		const files = RocketChat.models.Uploads.find(ourQuery, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			files,
			count: files.length,
			offset,
			total: RocketChat.models.Uploads.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute(['dm.history', 'im.history'], {
	authRequired: true
}, {
	get() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);
		let latestDate = new Date();

		if (this.queryParams.latest) {
			latestDate = new Date(this.queryParams.latest);
		}

		let oldestDate = undefined;

		if (this.queryParams.oldest) {
			oldestDate = new Date(this.queryParams.oldest);
		}

		let inclusive = false;

		if (this.queryParams.inclusive) {
			inclusive = this.queryParams.inclusive;
		}

		let count = 20;

		if (this.queryParams.count) {
			count = parseInt(this.queryParams.count);
		}

		let unreads = false;

		if (this.queryParams.unreads) {
			unreads = this.queryParams.unreads;
		}

		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('getChannelHistory', {
				rid: findResult.room._id,
				latest: latestDate,
				oldest: oldestDate,
				inclusive,
				count,
				unreads
			});
		});

		if (!result) {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success(result);
	}

});
RocketChat.API.v1.addRoute(['dm.members', 'im.members'], {
	authRequired: true
}, {
	get() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort
		} = this.parseJsonQuery();
		const members = RocketChat.models.Rooms.processQueryOptionsOnResult(Array.from(findResult.room.usernames), {
			sort: sort ? sort : -1,
			skip: offset,
			limit: count
		});
		const users = RocketChat.models.Users.find({
			username: {
				$in: members
			}
		}, {
			fields: {
				_id: 1,
				username: 1,
				name: 1,
				status: 1,
				utcOffset: 1
			}
		}).fetch();
		return RocketChat.API.v1.success({
			members: users,
			count: members.length,
			offset,
			total: findResult.room.usernames.length
		});
	}

});
RocketChat.API.v1.addRoute(['dm.messages', 'im.messages'], {
	authRequired: true
}, {
	get() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		console.log(findResult);
		const ourQuery = Object.assign({}, query, {
			rid: findResult.room._id
		});
		const messages = RocketChat.models.Messages.find(ourQuery, {
			sort: sort ? sort : {
				ts: -1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			messages,
			count: messages.length,
			offset,
			total: RocketChat.models.Messages.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute(['dm.messages.others', 'im.messages.others'], {
	authRequired: true
}, {
	get() {
		if (RocketChat.settings.get('API_Enable_Direct_Message_History_EndPoint') !== true) {
			throw new Meteor.Error('error-endpoint-disabled', 'This endpoint is disabled', {
				route: '/api/v1/im.messages.others'
			});
		}

		if (!RocketChat.authz.hasPermission(this.userId, 'view-room-administration')) {
			return RocketChat.API.v1.unauthorized();
		}

		const roomId = this.queryParams.roomId;

		if (!roomId || !roomId.trim()) {
			throw new Meteor.Error('error-roomid-param-not-provided', 'The parameter "roomId" is required');
		}

		const room = RocketChat.models.Rooms.findOneById(roomId);

		if (!room || room.t !== 'd') {
			throw new Meteor.Error('error-room-not-found', `No direct message room found by the id of: ${roomId}`);
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			rid: room._id
		});
		const msgs = RocketChat.models.Messages.find(ourQuery, {
			sort: sort ? sort : {
				ts: -1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			messages: msgs,
			offset,
			count: msgs.length,
			total: RocketChat.models.Messages.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute(['dm.list', 'im.list'], {
	authRequired: true
}, {
	get() {
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields
		} = this.parseJsonQuery();

		let rooms = _.pluck(RocketChat.models.Subscriptions.findByTypeAndUserId('d', this.userId).fetch(), '_room');

		const totalCount = rooms.length;
		rooms = RocketChat.models.Rooms.processQueryOptionsOnResult(rooms, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		});
		return RocketChat.API.v1.success({
			ims: rooms,
			offset,
			count: rooms.length,
			total: totalCount
		});
	}

});
RocketChat.API.v1.addRoute(['dm.list.everyone', 'im.list.everyone'], {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-room-administration')) {
			return RocketChat.API.v1.unauthorized();
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			t: 'd'
		});
		const rooms = RocketChat.models.Rooms.find(ourQuery, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			ims: rooms,
			offset,
			count: rooms.length,
			total: RocketChat.models.Rooms.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute(['dm.open', 'im.open'], {
	authRequired: true
}, {
	post() {
		const findResult = findDirectMessageRoom(this.requestParams(), this.user);

		if (!findResult.subscription.open) {
			Meteor.runAsUser(this.userId, () => {
				Meteor.call('openRoom', findResult.room._id);
			});
		}

		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute(['dm.setTopic', 'im.setTopic'], {
	authRequired: true
}, {
	post() {
		if (!this.bodyParams.topic || !this.bodyParams.topic.trim()) {
			return RocketChat.API.v1.failure('The bodyParam "topic" is required');
		}

		const findResult = findDirectMessageRoom(this.requestParams(), this.user);
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('saveRoomSettings', findResult.room._id, 'roomTopic', this.bodyParams.topic);
		});
		return RocketChat.API.v1.success({
			topic: this.bodyParams.topic
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"integrations.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/integrations.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('integrations.create', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			type: String,
			name: String,
			enabled: Boolean,
			username: String,
			urls: Match.Maybe([String]),
			channel: String,
			event: Match.Maybe(String),
			triggerWords: Match.Maybe([String]),
			alias: Match.Maybe(String),
			avatar: Match.Maybe(String),
			emoji: Match.Maybe(String),
			token: Match.Maybe(String),
			scriptEnabled: Boolean,
			script: Match.Maybe(String),
			targetChannel: Match.Maybe(String)
		}));
		let integration;

		switch (this.bodyParams.type) {
			case 'webhook-outgoing':
				Meteor.runAsUser(this.userId, () => {
					integration = Meteor.call('addOutgoingIntegration', this.bodyParams);
				});
				break;

			case 'webhook-incoming':
				Meteor.runAsUser(this.userId, () => {
					integration = Meteor.call('addIncomingIntegration', this.bodyParams);
				});
				break;

			default:
				return RocketChat.API.v1.failure('Invalid integration type.');
		}

		return RocketChat.API.v1.success({
			integration
		});
	}

});
RocketChat.API.v1.addRoute('integrations.history', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			return RocketChat.API.v1.unauthorized();
		}

		if (!this.queryParams.id || this.queryParams.id.trim() === '') {
			return RocketChat.API.v1.failure('Invalid integration id.');
		}

		const id = this.queryParams.id;
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query, {
			'integration._id': id
		});
		const history = RocketChat.models.IntegrationHistory.find(ourQuery, {
			sort: sort ? sort : {
				_updatedAt: -1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			history,
			offset,
			items: history.length,
			total: RocketChat.models.IntegrationHistory.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('integrations.list', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			return RocketChat.API.v1.unauthorized();
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const ourQuery = Object.assign({}, query);
		const integrations = RocketChat.models.Integrations.find(ourQuery, {
			sort: sort ? sort : {
				ts: -1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			integrations,
			offset,
			items: integrations.length,
			total: RocketChat.models.Integrations.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('integrations.remove', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			type: String,
			target_url: Match.Maybe(String),
			integrationId: Match.Maybe(String)
		}));

		if (!this.bodyParams.target_url && !this.bodyParams.integrationId) {
			return RocketChat.API.v1.failure('An integrationId or target_url needs to be provided.');
		}

		let integration;

		switch (this.bodyParams.type) {
			case 'webhook-outgoing':
				if (this.bodyParams.target_url) {
					integration = RocketChat.models.Integrations.findOne({
						urls: this.bodyParams.target_url
					});
				} else if (this.bodyParams.integrationId) {
					integration = RocketChat.models.Integrations.findOne({
						_id: this.bodyParams.integrationId
					});
				}

				if (!integration) {
					return RocketChat.API.v1.failure('No integration found.');
				}

				Meteor.runAsUser(this.userId, () => {
					Meteor.call('deleteOutgoingIntegration', integration._id);
				});
				return RocketChat.API.v1.success({
					integration
				});

			case 'webhook-incoming':
				integration = RocketChat.models.Integrations.findOne({
					_id: this.bodyParams.integrationId
				});

				if (!integration) {
					return RocketChat.API.v1.failure('No integration found.');
				}

				Meteor.runAsUser(this.userId, () => {
					Meteor.call('deleteIncomingIntegration', integration._id);
				});
				return RocketChat.API.v1.success({
					integration
				});

			default:
				return RocketChat.API.v1.failure('Invalid integration type.');
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"misc.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/misc.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
RocketChat.API.v1.addRoute('info', {
	authRequired: false
}, {
	get() {
		const user = this.getLoggedInUser();

		if (user && RocketChat.authz.hasRole(user._id, 'admin')) {
			return RocketChat.API.v1.success({
				info: RocketChat.Info
			});
		}

		return RocketChat.API.v1.success({
			info: {
				'version': RocketChat.Info.version
			}
		});
	}

});
RocketChat.API.v1.addRoute('me', {
	authRequired: true
}, {
	get() {
		const me = _.pick(this.user, ['_id', 'name', 'emails', 'status', 'statusConnection', 'username', 'utcOffset', 'active', 'language']);

		const verifiedEmail = me.emails.find(email => email.verified);
		me.email = verifiedEmail ? verifiedEmail.address : undefined;
		return RocketChat.API.v1.success(me);
	}

});
let onlineCache = 0;
let onlineCacheDate = 0;
const cacheInvalid = 60000; // 1 minute

RocketChat.API.v1.addRoute('shield.svg', {
	authRequired: false
}, {
	get() {
		const {
			type,
			channel,
			name,
			icon
		} = this.queryParams;

		if (!RocketChat.settings.get('API_Enable_Shields')) {
			throw new Meteor.Error('error-endpoint-disabled', 'This endpoint is disabled', {
				route: '/api/v1/shields.svg'
			});
		}

		const types = RocketChat.settings.get('API_Shield_Types');

		if (type && types !== '*' && !types.split(',').map(t => t.trim()).includes(type)) {
			throw new Meteor.Error('error-shield-disabled', 'This shield type is disabled', {
				route: '/api/v1/shields.svg'
			});
		}

		const hideIcon = icon === 'false';

		if (hideIcon && (!name || !name.trim())) {
			return RocketChat.API.v1.failure('Name cannot be empty when icon is hidden');
		}

		let text;

		switch (type) {
			case 'online':
				if (Date.now() - onlineCacheDate > cacheInvalid) {
					onlineCache = RocketChat.models.Users.findUsersNotOffline().count();
					onlineCacheDate = Date.now();
				}

				text = `${onlineCache} ${TAPi18n.__('Online')}`;
				break;

			case 'channel':
				if (!channel) {
					return RocketChat.API.v1.failure('Shield channel is required for type "channel"');
				}

				text = `#${channel}`;
				break;

			default:
				text = TAPi18n.__('Join_Chat').toUpperCase();
		}

		const iconSize = hideIcon ? 7 : 24;
		const leftSize = name ? name.length * 6 + 7 + iconSize : iconSize;
		const rightSize = text.length * 6 + 20;
		const width = leftSize + rightSize;
		const height = 20;
		return {
			headers: {
				'Content-Type': 'image/svg+xml;charset=utf-8'
			},
			body: `
				<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
				  <linearGradient id="b" x2="0" y2="100%">
				    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
				    <stop offset="1" stop-opacity=".1"/>
				  </linearGradient>
				  <mask id="a">
				    <rect width="${width}" height="${height}" rx="3" fill="#fff"/>
				  </mask>
				  <g mask="url(#a)">
				    <path fill="#555" d="M0 0h${leftSize}v${height}H0z"/>
				    <path fill="#4c1" d="M${leftSize} 0h${rightSize}v${height}H${leftSize}z"/>
				    <path fill="url(#b)" d="M0 0h${width}v${height}H0z"/>
				  </g>
				    ${hideIcon ? '' : '<image x="5" y="3" width="14" height="14" xlink:href="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSI1MTJweCIgaGVpZ2h0PSI1MTJweCIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAwIDUxMiA1MTIiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxwYXRoIGZpbGw9IiNDMTI3MkQiIGQ9Ik01MDIuNTg2LDI1NS4zMjJjMC0yNS4yMzYtNy41NS00OS40MzYtMjIuNDQ1LTcxLjkzMmMtMTMuMzczLTIwLjE5NS0zMi4xMDktMzguMDcyLTU1LjY4Ny01My4xMzJDMzc4LjkzNywxMDEuMTgyLDMxOS4xMDgsODUuMTY4LDI1Niw4NS4xNjhjLTIxLjA3OSwwLTQxLjg1NSwxLjc4MS02Mi4wMDksNS4zMWMtMTIuNTA0LTExLjcwMi0yNy4xMzktMjIuMjMyLTQyLjYyNy0zMC41NkM2OC42MTgsMTkuODE4LDAsNTguOTc1LDAsNTguOTc1czYzLjc5OCw1Mi40MDksNTMuNDI0LDk4LjM1Yy0yOC41NDIsMjguMzEzLTQ0LjAxLDYyLjQ1My00NC4wMSw5Ny45OThjMCwwLjExMywwLjAwNiwwLjIyNiwwLjAwNiwwLjM0YzAsMC4xMTMtMC4wMDYsMC4yMjYtMC4wMDYsMC4zMzljMCwzNS41NDUsMTUuNDY5LDY5LjY4NSw0NC4wMSw5Ny45OTlDNjMuNzk4LDM5OS45NCwwLDQ1Mi4zNSwwLDQ1Mi4zNXM2OC42MTgsMzkuMTU2LDE1MS4zNjMtMC45NDNjMTUuNDg4LTguMzI3LDMwLjEyNC0xOC44NTcsNDIuNjI3LTMwLjU2YzIwLjE1NCwzLjUyOCw0MC45MzEsNS4zMSw2Mi4wMDksNS4zMWM2My4xMDgsMCwxMjIuOTM3LTE2LjAxNCwxNjguNDU0LTQ1LjA5MWMyMy41NzctMTUuMDYsNDIuMzEzLTMyLjkzNyw1NS42ODctNTMuMTMyYzE0Ljg5Ni0yMi40OTYsMjIuNDQ1LTQ2LjY5NSwyMi40NDUtNzEuOTMyYzAtMC4xMTMtMC4wMDYtMC4yMjYtMC4wMDYtMC4zMzlDNTAyLjU4LDI1NS41NDgsNTAyLjU4NiwyNTUuNDM2LDUwMi41ODYsMjU1LjMyMnoiLz48cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNMjU2LDEyMC44NDdjMTE2Ljg1NCwwLDIxMS41ODYsNjAuNTA5LDIxMS41ODYsMTM1LjE1NGMwLDc0LjY0MS05NC43MzEsMTM1LjE1NS0yMTEuNTg2LDEzNS4xNTVjLTI2LjAxOSwwLTUwLjkzNy0zLjAwOS03My45NTktOC40OTVjLTIzLjM5NiwyOC4xNDctNzQuODY4LDY3LjI4LTEyNC44NjksNTQuNjI5YzE2LjI2NS0xNy40Nyw0MC4zNjEtNDYuOTg4LDM1LjIwMS05NS42MDNjLTI5Ljk2OC0yMy4zMjItNDcuOTU5LTUzLjE2My00Ny45NTktODUuNjg2QzQ0LjQxNCwxODEuMzU2LDEzOS4xNDUsMTIwLjg0NywyNTYsMTIwLjg0NyIvPjxnPjxnPjxjaXJjbGUgZmlsbD0iI0MxMjcyRCIgY3g9IjI1NiIgY3k9IjI2MC4zNTIiIHI9IjI4LjEwNSIvPjwvZz48Zz48Y2lyY2xlIGZpbGw9IiNDMTI3MkQiIGN4PSIzNTMuNzI4IiBjeT0iMjYwLjM1MiIgcj0iMjguMTA0Ii8+PC9nPjxnPjxjaXJjbGUgZmlsbD0iI0MxMjcyRCIgY3g9IjE1OC4yNzIiIGN5PSIyNjAuMzUyIiByPSIyOC4xMDUiLz48L2c+PC9nPjxnPjxwYXRoIGZpbGw9IiNDQ0NDQ0MiIGQ9Ik0yNTYsMzczLjM3M2MtMjYuMDE5LDAtNTAuOTM3LTIuNjA3LTczLjk1OS03LjM2MmMtMjAuNjU5LDIxLjU0LTYzLjIwOSw1MC40OTYtMTA3LjMwNyw0OS40M2MtNS44MDYsOC44MDUtMTIuMTIxLDE2LjAwNi0xNy41NjIsMjEuODVjNTAsMTIuNjUxLDEwMS40NzMtMjYuNDgxLDEyNC44NjktNTQuNjI5YzIzLjAyMyw1LjQ4Niw0Ny45NDEsOC40OTUsNzMuOTU5LDguNDk1YzExNS45MTcsMCwyMTAuMDQ4LTU5LjU1LDIxMS41NTEtMTMzLjM2NEM0NjYuMDQ4LDMyMS43NjUsMzcxLjkxNywzNzMuMzczLDI1NiwzNzMuMzczeiIvPjwvZz48L3N2Zz4="/>'}
				  <g fill="#fff" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
						${name ? `<text x="${iconSize}" y="15" fill="#010101" fill-opacity=".3">${name}</text>
				    <text x="${iconSize}" y="14">${name}</text>` : ''}
				    <text x="${leftSize + 7}" y="15" fill="#010101" fill-opacity=".3">${text}</text>
				    <text x="${leftSize + 7}" y="14">${text}</text>
				  </g>
				</svg>
			`.trim().replace(/\>[\s]+\</gm, '><')
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"push.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/push.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals Push */RocketChat.API.v1.addRoute('push.token', {
	authRequired: true
}, {
	post() {
		const {
			type,
			value,
			appName
		} = this.bodyParams;
		let {
			id
		} = this.bodyParams;

		if (id && typeof id !== 'string') {
			throw new Meteor.Error('error-id-param-not-valid', 'The required "id" body param is invalid.');
		} else {
			id = Random.id();
		}

		if (!type || type !== 'apn' && type !== 'gcm') {
			throw new Meteor.Error('error-type-param-not-valid', 'The required "type" body param is missing or invalid.');
		}

		if (!value || typeof value !== 'string') {
			throw new Meteor.Error('error-token-param-not-valid', 'The required "token" body param is missing or invalid.');
		}

		if (!appName || typeof appName !== 'string') {
			throw new Meteor.Error('error-appName-param-not-valid', 'The required "appName" body param is missing or invalid.');
		}

		let result;
		Meteor.runAsUser(this.userId, () => result = Meteor.call('raix:push-update', {
			id,
			token: {
				[type]: value
			},
			appName,
			userId: this.userId
		}));
		return RocketChat.API.v1.success({
			result
		});
	},

	delete() {
		const {
			token
		} = this.bodyParams;

		if (!token || typeof token !== 'string') {
			throw new Meteor.Error('error-token-param-not-valid', 'The required "token" body param is missing or invalid.');
		}

		const affectedRecords = Push.appCollection.remove({
			$or: [{
				'token.apn': token
			}, {
				'token.gcm': token
			}],
			userId: this.userId
		});

		if (affectedRecords === 0) {
			return RocketChat.API.v1.notFound();
		}

		return RocketChat.API.v1.success();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/settings.js                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
// settings endpoints
RocketChat.API.v1.addRoute('settings.public', {
	authRequired: false
}, {
	get() {
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		let ourQuery = {
			hidden: {
				$ne: true
			},
			'public': true
		};
		ourQuery = Object.assign({}, query, ourQuery);
		const settings = RocketChat.models.Settings.find(ourQuery, {
			sort: sort ? sort : {
				_id: 1
			},
			skip: offset,
			limit: count,
			fields: Object.assign({
				_id: 1,
				value: 1
			}, fields)
		}).fetch();
		return RocketChat.API.v1.success({
			settings,
			count: settings.length,
			offset,
			total: RocketChat.models.Settings.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('settings', {
	authRequired: true
}, {
	get() {
		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		let ourQuery = {
			hidden: {
				$ne: true
			}
		};

		if (!RocketChat.authz.hasPermission(this.userId, 'view-privileged-setting')) {
			ourQuery.public = true;
		}

		ourQuery = Object.assign({}, query, ourQuery);
		const settings = RocketChat.models.Settings.find(ourQuery, {
			sort: sort ? sort : {
				_id: 1
			},
			skip: offset,
			limit: count,
			fields: Object.assign({
				_id: 1,
				value: 1
			}, fields)
		}).fetch();
		return RocketChat.API.v1.success({
			settings,
			count: settings.length,
			offset,
			total: RocketChat.models.Settings.find(ourQuery).count()
		});
	}

});
RocketChat.API.v1.addRoute('settings/:_id', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-privileged-setting')) {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success(_.pick(RocketChat.models.Settings.findOneNotHiddenById(this.urlParams._id), '_id', 'value'));
	},

	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'edit-privileged-setting')) {
			return RocketChat.API.v1.unauthorized();
		}

		check(this.bodyParams, {
			value: Match.Any
		});

		if (RocketChat.models.Settings.updateValueNotHiddenById(this.urlParams._id, this.bodyParams.value)) {
			return RocketChat.API.v1.success();
		}

		return RocketChat.API.v1.failure();
	}

});
RocketChat.API.v1.addRoute('service.configurations', {
	authRequired: false
}, {
	get() {
		const ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
		return RocketChat.API.v1.success({
			configurations: ServiceConfiguration.configurations.find({}, {
				fields: {
					secret: 0
				}
			}).fetch()
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stats.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/stats.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('statistics', {
	authRequired: true
}, {
	get() {
		let refresh = false;

		if (typeof this.queryParams.refresh !== 'undefined' && this.queryParams.refresh === 'true') {
			refresh = true;
		}

		let stats;
		Meteor.runAsUser(this.userId, () => {
			stats = Meteor.call('getStatistics', refresh);
		});
		return RocketChat.API.v1.success({
			statistics: stats
		});
	}

});
RocketChat.API.v1.addRoute('statistics.list', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-statistics')) {
			return RocketChat.API.v1.unauthorized();
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const statistics = RocketChat.models.Statistics.find(query, {
			sort: sort ? sort : {
				name: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			statistics,
			count: statistics.length,
			offset,
			total: RocketChat.models.Statistics.find(query).count()
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"users.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/v1/users.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
RocketChat.API.v1.addRoute('users.create', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, {
			email: String,
			name: String,
			password: String,
			username: String,
			active: Match.Maybe(Boolean),
			roles: Match.Maybe(Array),
			joinDefaultChannels: Match.Maybe(Boolean),
			requirePasswordChange: Match.Maybe(Boolean),
			sendWelcomeEmail: Match.Maybe(Boolean),
			verified: Match.Maybe(Boolean),
			customFields: Match.Maybe(Object)
		}); //New change made by pull request #5152

		if (typeof this.bodyParams.joinDefaultChannels === 'undefined') {
			this.bodyParams.joinDefaultChannels = true;
		}

		if (this.bodyParams.customFields) {
			RocketChat.validateCustomFields(this.bodyParams.customFields);
		}

		const newUserId = RocketChat.saveUser(this.userId, this.bodyParams);

		if (this.bodyParams.customFields) {
			RocketChat.saveCustomFieldsWithoutValidation(newUserId, this.bodyParams.customFields);
		}

		if (typeof this.bodyParams.active !== 'undefined') {
			Meteor.runAsUser(this.userId, () => {
				Meteor.call('setUserActiveStatus', newUserId, this.bodyParams.active);
			});
		}

		return RocketChat.API.v1.success({
			user: RocketChat.models.Users.findOneById(newUserId, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('users.delete', {
	authRequired: true
}, {
	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'delete-user')) {
			return RocketChat.API.v1.unauthorized();
		}

		const user = this.getUserFromParams();
		Meteor.runAsUser(this.userId, () => {
			Meteor.call('deleteUser', user._id);
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('users.getAvatar', {
	authRequired: false
}, {
	get() {
		const user = this.getUserFromParams();
		const url = RocketChat.getURL(`/avatar/${user.username}`, {
			cdn: false,
			full: true
		});
		this.response.setHeader('Location', url);
		return {
			statusCode: 307,
			body: url
		};
	}

});
RocketChat.API.v1.addRoute('users.getPresence', {
	authRequired: true
}, {
	get() {
		if (this.isUserFromParams()) {
			const user = RocketChat.models.Users.findOneById(this.userId);
			return RocketChat.API.v1.success({
				presence: user.status,
				connectionStatus: user.statusConnection,
				lastLogin: user.lastLogin
			});
		}

		const user = this.getUserFromParams();
		return RocketChat.API.v1.success({
			presence: user.status
		});
	}

});
RocketChat.API.v1.addRoute('users.info', {
	authRequired: true
}, {
	get() {
		const user = this.getUserFromParams();
		let result;
		Meteor.runAsUser(this.userId, () => {
			result = Meteor.call('getFullUserData', {
				filter: user.username,
				limit: 1
			});
		});

		if (!result || result.length !== 1) {
			return RocketChat.API.v1.failure(`Failed to get the user data for the userId of "${user._id}".`);
		}

		return RocketChat.API.v1.success({
			user: result[0]
		});
	}

});
RocketChat.API.v1.addRoute('users.list', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-d-room')) {
			return RocketChat.API.v1.unauthorized();
		}

		const {
			offset,
			count
		} = this.getPaginationItems();
		const {
			sort,
			fields,
			query
		} = this.parseJsonQuery();
		const users = RocketChat.models.Users.find(query, {
			sort: sort ? sort : {
				username: 1
			},
			skip: offset,
			limit: count,
			fields
		}).fetch();
		return RocketChat.API.v1.success({
			users,
			count: users.length,
			offset,
			total: RocketChat.models.Users.find(query).count()
		});
	}

});
RocketChat.API.v1.addRoute('users.register', {
	authRequired: false
}, {
	post() {
		if (this.userId) {
			return RocketChat.API.v1.failure('Logged in users can not register again.');
		} //We set their username here, so require it
		//The `registerUser` checks for the other requirements


		check(this.bodyParams, Match.ObjectIncluding({
			username: String
		})); //Register the user

		const userId = Meteor.call('registerUser', this.bodyParams); //Now set their username

		Meteor.runAsUser(userId, () => Meteor.call('setUsername', this.bodyParams.username));
		return RocketChat.API.v1.success({
			user: RocketChat.models.Users.findOneById(userId, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('users.resetAvatar', {
	authRequired: true
}, {
	post() {
		const user = this.getUserFromParams();

		if (user._id === this.userId) {
			Meteor.runAsUser(this.userId, () => Meteor.call('resetAvatar'));
		} else if (RocketChat.authz.hasPermission(this.userId, 'edit-other-user-info')) {
			Meteor.runAsUser(user._id, () => Meteor.call('resetAvatar'));
		} else {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('users.setAvatar', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, Match.ObjectIncluding({
			avatarUrl: Match.Maybe(String),
			userId: Match.Maybe(String),
			username: Match.Maybe(String)
		}));
		let user;

		if (this.isUserFromParams()) {
			user = Meteor.users.findOne(this.userId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'edit-other-user-info')) {
			user = this.getUserFromParams();
		} else {
			return RocketChat.API.v1.unauthorized();
		}

		Meteor.runAsUser(user._id, () => {
			if (this.bodyParams.avatarUrl) {
				RocketChat.setUserAvatar(user, this.bodyParams.avatarUrl, '', 'url');
			} else {
				const Busboy = Npm.require('busboy');

				const busboy = new Busboy({
					headers: this.request.headers
				});
				Meteor.wrapAsync(callback => {
					busboy.on('file', Meteor.bindEnvironment((fieldname, file, filename, encoding, mimetype) => {
						if (fieldname !== 'image') {
							return callback(new Meteor.Error('invalid-field'));
						}

						const imageData = [];
						file.on('data', Meteor.bindEnvironment(data => {
							imageData.push(data);
						}));
						file.on('end', Meteor.bindEnvironment(() => {
							RocketChat.setUserAvatar(user, Buffer.concat(imageData), mimetype, 'rest');
							callback();
						}));
					}));
					this.request.pipe(busboy);
				})();
			}
		});
		return RocketChat.API.v1.success();
	}

});
RocketChat.API.v1.addRoute('users.update', {
	authRequired: true
}, {
	post() {
		check(this.bodyParams, {
			userId: String,
			data: Match.ObjectIncluding({
				email: Match.Maybe(String),
				name: Match.Maybe(String),
				password: Match.Maybe(String),
				username: Match.Maybe(String),
				active: Match.Maybe(Boolean),
				roles: Match.Maybe(Array),
				joinDefaultChannels: Match.Maybe(Boolean),
				requirePasswordChange: Match.Maybe(Boolean),
				sendWelcomeEmail: Match.Maybe(Boolean),
				verified: Match.Maybe(Boolean),
				customFields: Match.Maybe(Object)
			})
		});

		const userData = _.extend({
			_id: this.bodyParams.userId
		}, this.bodyParams.data);

		Meteor.runAsUser(this.userId, () => RocketChat.saveUser(this.userId, userData));

		if (this.bodyParams.data.customFields) {
			RocketChat.saveCustomFields(this.bodyParams.userId, this.bodyParams.data.customFields);
		}

		if (typeof this.bodyParams.data.active !== 'undefined') {
			Meteor.runAsUser(this.userId, () => {
				Meteor.call('setUserActiveStatus', this.bodyParams.userId, this.bodyParams.data.active);
			});
		}

		return RocketChat.API.v1.success({
			user: RocketChat.models.Users.findOneById(this.bodyParams.userId, {
				fields: RocketChat.API.v1.defaultFieldsToExclude
			})
		});
	}

});
RocketChat.API.v1.addRoute('users.createToken', {
	authRequired: true
}, {
	post() {
		const user = this.getUserFromParams();
		let data;
		Meteor.runAsUser(this.userId, () => {
			data = Meteor.call('createToken', user._id);
		});
		return data ? RocketChat.API.v1.success({
			data
		}) : RocketChat.API.v1.unauthorized();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"default":{"helpers":{"getLoggedInUser.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/default/helpers/getLoggedInUser.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.default.helperMethods.set('getLoggedInUser', function _getLoggedInUser() {
	let user;

	if (this.request.headers['x-auth-token'] && this.request.headers['x-user-id']) {
		user = RocketChat.models.Users.findOne({
			'_id': this.request.headers['x-user-id'],
			'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(this.request.headers['x-auth-token'])
		});
	}

	return user;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"info.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/default/info.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.default.addRoute('info', {
	authRequired: false
}, {
	get() {
		const user = this.getLoggedInUser();

		if (user && RocketChat.authz.hasRole(user._id, 'admin')) {
			return RocketChat.API.v1.success({
				info: RocketChat.Info
			});
		}

		return RocketChat.API.v1.success({
			version: RocketChat.Info.version
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"metrics.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_api/server/default/metrics.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.default.addRoute('metrics', {
	authRequired: false
}, {
	get() {
		return {
			headers: {
				'Content-Type': 'text/plain'
			},
			body: RocketChat.promclient.register.metrics()
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:api/server/api.js");
require("./node_modules/meteor/rocketchat:api/server/settings.js");
require("./node_modules/meteor/rocketchat:api/server/v1/helpers/requestParams.js");
require("./node_modules/meteor/rocketchat:api/server/v1/helpers/getPaginationItems.js");
require("./node_modules/meteor/rocketchat:api/server/v1/helpers/getUserFromParams.js");
require("./node_modules/meteor/rocketchat:api/server/v1/helpers/isUserFromParams.js");
require("./node_modules/meteor/rocketchat:api/server/v1/helpers/parseJsonQuery.js");
require("./node_modules/meteor/rocketchat:api/server/v1/helpers/getLoggedInUser.js");
require("./node_modules/meteor/rocketchat:api/server/default/helpers/getLoggedInUser.js");
require("./node_modules/meteor/rocketchat:api/server/default/info.js");
require("./node_modules/meteor/rocketchat:api/server/default/metrics.js");
require("./node_modules/meteor/rocketchat:api/server/v1/channels.js");
require("./node_modules/meteor/rocketchat:api/server/v1/rooms.js");
require("./node_modules/meteor/rocketchat:api/server/v1/subscriptions.js");
require("./node_modules/meteor/rocketchat:api/server/v1/chat.js");
require("./node_modules/meteor/rocketchat:api/server/v1/commands.js");
require("./node_modules/meteor/rocketchat:api/server/v1/groups.js");
require("./node_modules/meteor/rocketchat:api/server/v1/im.js");
require("./node_modules/meteor/rocketchat:api/server/v1/integrations.js");
require("./node_modules/meteor/rocketchat:api/server/v1/misc.js");
require("./node_modules/meteor/rocketchat:api/server/v1/push.js");
require("./node_modules/meteor/rocketchat:api/server/v1/settings.js");
require("./node_modules/meteor/rocketchat:api/server/v1/stats.js");
require("./node_modules/meteor/rocketchat:api/server/v1/users.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:api'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_api.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL2FwaS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvaGVscGVycy9yZXF1ZXN0UGFyYW1zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvaGVscGVycy9nZXRQYWdpbmF0aW9uSXRlbXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9oZWxwZXJzL2dldFVzZXJGcm9tUGFyYW1zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvaGVscGVycy9pc1VzZXJGcm9tUGFyYW1zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvaGVscGVycy9wYXJzZUpzb25RdWVyeS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL3YxL2hlbHBlcnMvZ2V0TG9nZ2VkSW5Vc2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvY2hhbm5lbHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9yb29tcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL3YxL3N1YnNjcmlwdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9jaGF0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvY29tbWFuZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9ncm91cHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9pbS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL3YxL2ludGVncmF0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL3YxL21pc2MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9wdXNoLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvdjEvc2V0dGluZ3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXBpL3NlcnZlci92MS9zdGF0cy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL3YxL3VzZXJzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmFwaS9zZXJ2ZXIvZGVmYXVsdC9oZWxwZXJzL2dldExvZ2dlZEluVXNlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL2RlZmF1bHQvaW5mby5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphcGkvc2VydmVyL2RlZmF1bHQvbWV0cmljcy5qcyJdLCJuYW1lcyI6WyJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJBUEkiLCJSZXN0aXZ1cyIsImNvbnN0cnVjdG9yIiwicHJvcGVydGllcyIsImxvZ2dlciIsIkxvZ2dlciIsInZlcnNpb24iLCJhdXRoTWV0aG9kcyIsImhlbHBlck1ldGhvZHMiLCJNYXAiLCJmaWVsZFNlcGFyYXRvciIsImRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUiLCJqb2luQ29kZSIsIiRsb2tpIiwibWV0YSIsIm1lbWJlcnMiLCJ1c2VybmFtZXMiLCJpbXBvcnRJZHMiLCJsaW1pdGVkVXNlckZpZWxkc1RvRXhjbHVkZSIsImF2YXRhck9yaWdpbiIsImVtYWlscyIsInBob25lIiwic3RhdHVzQ29ubmVjdGlvbiIsImNyZWF0ZWRBdCIsImxhc3RMb2dpbiIsInNlcnZpY2VzIiwicmVxdWlyZVBhc3N3b3JkQ2hhbmdlIiwicmVxdWlyZVBhc3N3b3JkQ2hhbmdlUmVhc29uIiwicm9sZXMiLCJzdGF0dXNEZWZhdWx0IiwiX3VwZGF0ZWRBdCIsImN1c3RvbUZpZWxkcyIsIl9jb25maWciLCJkZWZhdWx0T3B0aW9uc0VuZHBvaW50IiwiX2RlZmF1bHRPcHRpb25zRW5kcG9pbnQiLCJyZXF1ZXN0IiwibWV0aG9kIiwiaGVhZGVycyIsIlJvY2tldENoYXQiLCJzZXR0aW5ncyIsImdldCIsInJlc3BvbnNlIiwid3JpdGVIZWFkIiwid3JpdGUiLCJkb25lIiwiYWRkQXV0aE1ldGhvZCIsInB1c2giLCJzdWNjZXNzIiwicmVzdWx0IiwiaXNPYmplY3QiLCJzdGF0dXNDb2RlIiwiYm9keSIsImZhaWx1cmUiLCJlcnJvclR5cGUiLCJlcnJvciIsInVuYXV0aG9yaXplZCIsIm1zZyIsIm5vdEZvdW5kIiwiYWRkUm91dGUiLCJyb3V0ZXMiLCJvcHRpb25zIiwiZW5kcG9pbnRzIiwiaXNBcnJheSIsImZvckVhY2giLCJyb3V0ZSIsIk9iamVjdCIsImtleXMiLCJhY3Rpb24iLCJvcmlnaW5hbEFjdGlvbiIsImRlYnVnIiwidG9VcHBlckNhc2UiLCJ1cmwiLCJhcHBseSIsImUiLCJzdGFjayIsInYxIiwibWVzc2FnZSIsInRlc3QiLCJjaGFubmVsIiwiY2hhbm5lbHMiLCJncm91cCIsImdyb3VwcyIsImRldmVsb3Blcldhcm5pbmciLCJuYW1lIiwiaGVscGVyTWV0aG9kIiwiX2luaXRBdXRoIiwibG9naW5Db21wYXRpYmlsaXR5IiwiYm9keVBhcmFtcyIsInVzZXIiLCJ1c2VybmFtZSIsImVtYWlsIiwicGFzc3dvcmQiLCJjb2RlIiwid2l0aG91dCIsImxlbmd0aCIsImF1dGgiLCJpbmNsdWRlcyIsImhhc2hlZCIsImRpZ2VzdCIsImFsZ29yaXRobSIsInRvdHAiLCJsb2dpbiIsInNlbGYiLCJhdXRoUmVxdWlyZWQiLCJwb3N0IiwiYXJncyIsImludm9jYXRpb24iLCJERFBDb21tb24iLCJNZXRob2RJbnZvY2F0aW9uIiwiY29ubmVjdGlvbiIsImNsb3NlIiwiRERQIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwid2l0aFZhbHVlIiwiTWV0ZW9yIiwiY2FsbCIsInJlYXNvbiIsInN0YXR1cyIsInVzZXJzIiwiZmluZE9uZSIsIl9pZCIsImlkIiwidXNlcklkIiwidXBkYXRlIiwiQWNjb3VudHMiLCJfaGFzaExvZ2luVG9rZW4iLCJ0b2tlbiIsIiR1bnNldCIsImRhdGEiLCJhdXRoVG9rZW4iLCJleHRyYURhdGEiLCJvbkxvZ2dlZEluIiwiZXh0ZW5kIiwiZXh0cmEiLCJsb2dvdXQiLCJoYXNoZWRUb2tlbiIsInRva2VuTG9jYXRpb24iLCJpbmRleCIsImxhc3RJbmRleE9mIiwidG9rZW5QYXRoIiwic3Vic3RyaW5nIiwidG9rZW5GaWVsZE5hbWUiLCJ0b2tlblRvUmVtb3ZlIiwidG9rZW5SZW1vdmFsUXVlcnkiLCIkcHVsbCIsIm9uTG9nZ2VkT3V0IiwiY29uc29sZSIsIndhcm4iLCJnZXRVc2VyQXV0aCIsIl9nZXRVc2VyQXV0aCIsImludmFsaWRSZXN1bHRzIiwidW5kZWZpbmVkIiwicGF5bG9hZCIsIkpTT04iLCJwYXJzZSIsImkiLCJhcmd1bWVudHMiLCJjcmVhdGVBcGkiLCJlbmFibGVDb3JzIiwidXNlRGVmYXVsdEF1dGgiLCJwcmV0dHlKc29uIiwicHJvY2VzcyIsImVudiIsIk5PREVfRU5WIiwia2V5IiwidmFsdWUiLCJhZGRHcm91cCIsInNlY3Rpb24iLCJhZGQiLCJ0eXBlIiwicHVibGljIiwiZW5hYmxlUXVlcnkiLCJzZXQiLCJfcmVxdWVzdFBhcmFtcyIsInF1ZXJ5UGFyYW1zIiwiX2dldFBhZ2luYXRpb25JdGVtcyIsImhhcmRVcHBlckxpbWl0IiwiZGVmYXVsdENvdW50Iiwib2Zmc2V0IiwicGFyc2VJbnQiLCJjb3VudCIsIl9nZXRVc2VyRnJvbVBhcmFtcyIsImRvZXNudEV4aXN0IiwiX2RvZXNudEV4aXN0IiwicGFyYW1zIiwicmVxdWVzdFBhcmFtcyIsInRyaW0iLCJtb2RlbHMiLCJVc2VycyIsImZpbmRPbmVCeUlkIiwiZmluZE9uZUJ5VXNlcm5hbWUiLCJFcnJvciIsIl9pc1VzZXJGcm9tUGFyYW1zIiwiX3BhcnNlSnNvblF1ZXJ5Iiwic29ydCIsImZpZWxkcyIsIm5vblNlbGVjdGFibGVGaWVsZHMiLCJhdXRoeiIsImhhc1Blcm1pc3Npb24iLCJjb25jYXQiLCJrIiwic3BsaXQiLCJhc3NpZ24iLCJxdWVyeSIsIm5vblF1ZXJhYmxlRmllbGRzIiwiX2dldExvZ2dlZEluVXNlciIsImZpbmRDaGFubmVsQnlJZE9yTmFtZSIsImNoZWNrZWRBcmNoaXZlZCIsInJldHVyblVzZXJuYW1lcyIsInJvb21JZCIsInJvb21OYW1lIiwicm9vbSIsIlJvb21zIiwiZmluZE9uZUJ5TmFtZSIsInQiLCJhcmNoaXZlZCIsImZpbmRSZXN1bHQiLCJydW5Bc1VzZXIiLCJhY3RpdmVVc2Vyc09ubHkiLCJnZXRVc2VyRnJvbVBhcmFtcyIsImxhdGVzdCIsIm9sZGVzdCIsIkRhdGUiLCJpbmNsdXNpdmUiLCJzdWIiLCJTdWJzY3JpcHRpb25zIiwiZmluZE9uZUJ5Um9vbUlkQW5kVXNlcklkIiwib3BlbiIsInJlYWRPbmx5IiwicmlkIiwiZ2V0UGFnaW5hdGlvbkl0ZW1zIiwicGFyc2VKc29uUXVlcnkiLCJvdXJRdWVyeSIsImZpbGVzIiwiVXBsb2FkcyIsImZpbmQiLCJza2lwIiwibGltaXQiLCJmZXRjaCIsInRvdGFsIiwiaW5jbHVkZUFsbFB1YmxpY0NoYW5uZWxzIiwiJGluIiwiaW50ZWdyYXRpb25zIiwiSW50ZWdyYXRpb25zIiwiX2NyZWF0ZWRBdCIsImxhdGVzdERhdGUiLCJvbGRlc3REYXRlIiwidW5yZWFkcyIsInJvb21zIiwicGx1Y2siLCJmaW5kQnlUeXBlQW5kVXNlcklkIiwidG90YWxDb3VudCIsInByb2Nlc3NRdWVyeU9wdGlvbnNPblJlc3VsdCIsInNvcnRGbiIsImEiLCJiIiwiTWF0Y2giLCJOdW1iZXIiLCJBcnJheSIsImZyb20iLCJ1dGNPZmZzZXQiLCJtZXNzYWdlcyIsIk1lc3NhZ2VzIiwidHMiLCJvbmxpbmUiLCJmaW5kVXNlcnNOb3RPZmZsaW5lIiwib25saW5lSW5Sb29tIiwiaW5kZXhPZiIsImRlc2NyaXB0aW9uIiwicHVycG9zZSIsInJvIiwidG9waWMiLCJ1cGRhdGVkU2luY2UiLCJ1cGRhdGVkU2luY2VEYXRlIiwiaXNOYU4iLCJyZW1vdmUiLCJ1cmxQYXJhbXMiLCJCdXNib3kiLCJOcG0iLCJidXNib3kiLCJ3cmFwQXN5bmMiLCJjYWxsYmFjayIsIm9uIiwiZmllbGRuYW1lIiwiZmlsZSIsImZpbGVuYW1lIiwiZW5jb2RpbmciLCJtaW1ldHlwZSIsImZpbGVEYXRlIiwiZmlsZUJ1ZmZlciIsIkJ1ZmZlciIsImJpbmRFbnZpcm9ubWVudCIsInBpcGUiLCJmaWxlU3RvcmUiLCJGaWxlVXBsb2FkIiwiZ2V0U3RvcmUiLCJkZXRhaWxzIiwic2l6ZSIsInVwbG9hZGVkRmlsZSIsImluc2VydCIsImJpbmQiLCJjaGVjayIsIk9iamVjdEluY2x1ZGluZyIsIm1zZ0lkIiwiU3RyaW5nIiwiYXNVc2VyIiwiTWF5YmUiLCJCb29sZWFuIiwidSIsIm5vdyIsImxhc3RVcGRhdGUiLCJtZXNzYWdlSWQiLCJwaW5uZWRNZXNzYWdlIiwibWVzc2FnZVJldHVybiIsInByb2Nlc3NXZWJob29rTWVzc2FnZSIsInNlYXJjaFRleHQiLCJzdGFycmVkIiwidGV4dCIsImNvbW1hbmQiLCJjbWQiLCJzbGFzaENvbW1hbmRzIiwiY29tbWFuZHMiLCJ0b0xvd2VyQ2FzZSIsInZhbHVlcyIsImZpbHRlciIsImdldExvZ2dlZEluVXNlciIsInJ1biIsIlJhbmRvbSIsImZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lIiwicm9vbVN1YiIsImZpbmRPbmVCeVJvb21OYW1lQW5kVXNlcklkIiwiX3Jvb20iLCJpbmNsdWRlQWxsUHJpdmF0ZUdyb3VwcyIsImNoYW5uZWxzVG9TZWFyY2giLCJmaW5kQnlUeXBlIiwiZmluZERpcmVjdE1lc3NhZ2VSb29tIiwiZ2V0Um9vbUJ5TmFtZU9ySWRXaXRoT3B0aW9uVG9Kb2luIiwiY3VycmVudFVzZXJJZCIsIm5hbWVPcklkIiwic3Vic2NyaXB0aW9uIiwibG9nIiwibXNncyIsImltcyIsImVuYWJsZWQiLCJ1cmxzIiwiZXZlbnQiLCJ0cmlnZ2VyV29yZHMiLCJhbGlhcyIsImF2YXRhciIsImVtb2ppIiwic2NyaXB0RW5hYmxlZCIsInNjcmlwdCIsInRhcmdldENoYW5uZWwiLCJpbnRlZ3JhdGlvbiIsImhpc3RvcnkiLCJJbnRlZ3JhdGlvbkhpc3RvcnkiLCJpdGVtcyIsInRhcmdldF91cmwiLCJpbnRlZ3JhdGlvbklkIiwiaGFzUm9sZSIsImluZm8iLCJJbmZvIiwibWUiLCJwaWNrIiwidmVyaWZpZWRFbWFpbCIsInZlcmlmaWVkIiwiYWRkcmVzcyIsIm9ubGluZUNhY2hlIiwib25saW5lQ2FjaGVEYXRlIiwiY2FjaGVJbnZhbGlkIiwiaWNvbiIsInR5cGVzIiwibWFwIiwiaGlkZUljb24iLCJUQVBpMThuIiwiX18iLCJpY29uU2l6ZSIsImxlZnRTaXplIiwicmlnaHRTaXplIiwid2lkdGgiLCJoZWlnaHQiLCJyZXBsYWNlIiwiYXBwTmFtZSIsImRlbGV0ZSIsImFmZmVjdGVkUmVjb3JkcyIsIlB1c2giLCJhcHBDb2xsZWN0aW9uIiwiJG9yIiwiaGlkZGVuIiwiJG5lIiwiU2V0dGluZ3MiLCJmaW5kT25lTm90SGlkZGVuQnlJZCIsIkFueSIsInVwZGF0ZVZhbHVlTm90SGlkZGVuQnlJZCIsIlNlcnZpY2VDb25maWd1cmF0aW9uIiwiUGFja2FnZSIsImNvbmZpZ3VyYXRpb25zIiwic2VjcmV0IiwicmVmcmVzaCIsInN0YXRzIiwic3RhdGlzdGljcyIsIlN0YXRpc3RpY3MiLCJhY3RpdmUiLCJqb2luRGVmYXVsdENoYW5uZWxzIiwic2VuZFdlbGNvbWVFbWFpbCIsInZhbGlkYXRlQ3VzdG9tRmllbGRzIiwibmV3VXNlcklkIiwic2F2ZVVzZXIiLCJzYXZlQ3VzdG9tRmllbGRzV2l0aG91dFZhbGlkYXRpb24iLCJnZXRVUkwiLCJjZG4iLCJmdWxsIiwic2V0SGVhZGVyIiwiaXNVc2VyRnJvbVBhcmFtcyIsInByZXNlbmNlIiwiY29ubmVjdGlvblN0YXR1cyIsImF2YXRhclVybCIsInNldFVzZXJBdmF0YXIiLCJpbWFnZURhdGEiLCJ1c2VyRGF0YSIsInNhdmVDdXN0b21GaWVsZHMiLCJwcm9tY2xpZW50IiwicmVnaXN0ZXIiLCJtZXRyaWNzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7O0FBR04sTUFBTUMsR0FBTixTQUFrQkMsUUFBbEIsQ0FBMkI7QUFDMUJDLGFBQVlDLFVBQVosRUFBd0I7QUFDdkIsUUFBTUEsVUFBTjtBQUNBLE9BQUtDLE1BQUwsR0FBYyxJQUFJQyxNQUFKLENBQVksT0FBT0YsV0FBV0csT0FBWCxHQUFxQkgsV0FBV0csT0FBaEMsR0FBMEMsU0FBVyxTQUF4RSxFQUFrRixFQUFsRixDQUFkO0FBQ0EsT0FBS0MsV0FBTCxHQUFtQixFQUFuQjtBQUNBLE9BQUtDLGFBQUwsR0FBcUIsSUFBSUMsR0FBSixFQUFyQjtBQUNBLE9BQUtDLGNBQUwsR0FBc0IsR0FBdEI7QUFDQSxPQUFLQyxzQkFBTCxHQUE4QjtBQUM3QkMsYUFBVSxDQURtQjtBQUU3QkMsVUFBTyxDQUZzQjtBQUc3QkMsU0FBTSxDQUh1QjtBQUk3QkMsWUFBUyxDQUpvQjtBQUs3QkMsY0FBVyxDQUxrQjtBQUtmO0FBQ2RDLGNBQVc7QUFOa0IsR0FBOUI7QUFRQSxPQUFLQywwQkFBTCxHQUFrQztBQUNqQ0MsaUJBQWMsQ0FEbUI7QUFFakNDLFdBQVEsQ0FGeUI7QUFHakNDLFVBQU8sQ0FIMEI7QUFJakNDLHFCQUFrQixDQUplO0FBS2pDQyxjQUFXLENBTHNCO0FBTWpDQyxjQUFXLENBTnNCO0FBT2pDQyxhQUFVLENBUHVCO0FBUWpDQywwQkFBdUIsQ0FSVTtBQVNqQ0MsZ0NBQTZCLENBVEk7QUFVakNDLFVBQU8sQ0FWMEI7QUFXakNDLGtCQUFlLENBWGtCO0FBWWpDQyxlQUFZLENBWnFCO0FBYWpDQyxpQkFBYztBQWJtQixHQUFsQzs7QUFnQkEsT0FBS0MsT0FBTCxDQUFhQyxzQkFBYixHQUFzQyxTQUFTQyx1QkFBVCxHQUFtQztBQUN4RSxPQUFJLEtBQUtDLE9BQUwsQ0FBYUMsTUFBYixLQUF3QixTQUF4QixJQUFxQyxLQUFLRCxPQUFMLENBQWFFLE9BQWIsQ0FBcUIsK0JBQXJCLENBQXpDLEVBQWdHO0FBQy9GLFFBQUlDLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGlCQUF4QixNQUErQyxJQUFuRCxFQUF5RDtBQUN4RCxVQUFLQyxRQUFMLENBQWNDLFNBQWQsQ0FBd0IsR0FBeEIsRUFBNkI7QUFDNUIscUNBQStCSixXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QixpQkFBeEIsQ0FESDtBQUU1QixzQ0FBZ0M7QUFGSixNQUE3QjtBQUlBLEtBTEQsTUFLTztBQUNOLFVBQUtDLFFBQUwsQ0FBY0MsU0FBZCxDQUF3QixHQUF4QjtBQUNBLFVBQUtELFFBQUwsQ0FBY0UsS0FBZCxDQUFvQixvRUFBcEI7QUFDQTtBQUNELElBVkQsTUFVTztBQUNOLFNBQUtGLFFBQUwsQ0FBY0MsU0FBZCxDQUF3QixHQUF4QjtBQUNBOztBQUVELFFBQUtFLElBQUw7QUFDQSxHQWhCRDtBQWlCQTs7QUFFREMsZUFBY1QsTUFBZCxFQUFzQjtBQUNyQixPQUFLN0IsV0FBTCxDQUFpQnVDLElBQWpCLENBQXNCVixNQUF0QjtBQUNBOztBQUVEVyxTQUFRQyxTQUFTLEVBQWpCLEVBQXFCO0FBQ3BCLE1BQUl0RCxFQUFFdUQsUUFBRixDQUFXRCxNQUFYLENBQUosRUFBd0I7QUFDdkJBLFVBQU9ELE9BQVAsR0FBaUIsSUFBakI7QUFDQTs7QUFFRCxTQUFPO0FBQ05HLGVBQVksR0FETjtBQUVOQyxTQUFNSDtBQUZBLEdBQVA7QUFJQTs7QUFFREksU0FBUUosTUFBUixFQUFnQkssU0FBaEIsRUFBMkI7QUFDMUIsTUFBSTNELEVBQUV1RCxRQUFGLENBQVdELE1BQVgsQ0FBSixFQUF3QjtBQUN2QkEsVUFBT0QsT0FBUCxHQUFpQixLQUFqQjtBQUNBLEdBRkQsTUFFTztBQUNOQyxZQUFTO0FBQ1JELGFBQVMsS0FERDtBQUVSTyxXQUFPTjtBQUZDLElBQVQ7O0FBS0EsT0FBSUssU0FBSixFQUFlO0FBQ2RMLFdBQU9LLFNBQVAsR0FBbUJBLFNBQW5CO0FBQ0E7QUFDRDs7QUFFRCxTQUFPO0FBQ05ILGVBQVksR0FETjtBQUVOQyxTQUFNSDtBQUZBLEdBQVA7QUFJQTs7QUFHRE8sY0FBYUMsR0FBYixFQUFrQjtBQUNqQixTQUFPO0FBQ05OLGVBQVksR0FETjtBQUVOQyxTQUFNO0FBQ0xKLGFBQVMsS0FESjtBQUVMTyxXQUFPRSxNQUFNQSxHQUFOLEdBQVk7QUFGZDtBQUZBLEdBQVA7QUFPQTs7QUFFREMsVUFBU0QsR0FBVCxFQUFjO0FBQ2IsU0FBTztBQUNOTixlQUFZLEdBRE47QUFFTkMsU0FBTTtBQUNMSixhQUFTLEtBREo7QUFFTE8sV0FBT0UsTUFBTUEsR0FBTixHQUFZO0FBRmQ7QUFGQSxHQUFQO0FBT0E7O0FBRURFLFVBQVNDLE1BQVQsRUFBaUJDLE9BQWpCLEVBQTBCQyxTQUExQixFQUFxQztBQUNwQztBQUNBLE1BQUksT0FBT0EsU0FBUCxLQUFxQixXQUF6QixFQUFzQztBQUNyQ0EsZUFBWUQsT0FBWjtBQUNBQSxhQUFVLEVBQVY7QUFDQSxHQUxtQyxDQU9wQzs7O0FBQ0EsTUFBSSxDQUFDbEUsRUFBRW9FLE9BQUYsQ0FBVUgsTUFBVixDQUFMLEVBQXdCO0FBQ3ZCQSxZQUFTLENBQUNBLE1BQUQsQ0FBVDtBQUNBOztBQUVEQSxTQUFPSSxPQUFQLENBQWdCQyxLQUFELElBQVc7QUFDekI7QUFDQSxPQUFJLEtBQUt4RCxhQUFULEVBQXdCO0FBQ3ZCeUQsV0FBT0MsSUFBUCxDQUFZTCxTQUFaLEVBQXVCRSxPQUF2QixDQUFnQzNCLE1BQUQsSUFBWTtBQUMxQyxTQUFJLE9BQU95QixVQUFVekIsTUFBVixDQUFQLEtBQTZCLFVBQWpDLEVBQTZDO0FBQzVDeUIsZ0JBQVV6QixNQUFWLElBQW9CO0FBQUMrQixlQUFRTixVQUFVekIsTUFBVjtBQUFULE9BQXBCO0FBQ0EsTUFIeUMsQ0FLMUM7OztBQUNBLFdBQU1nQyxpQkFBaUJQLFVBQVV6QixNQUFWLEVBQWtCK0IsTUFBekM7O0FBQ0FOLGVBQVV6QixNQUFWLEVBQWtCK0IsTUFBbEIsR0FBMkIsWUFBVztBQUNyQyxXQUFLL0QsTUFBTCxDQUFZaUUsS0FBWixDQUFtQixHQUFHLEtBQUtsQyxPQUFMLENBQWFDLE1BQWIsQ0FBb0JrQyxXQUFwQixFQUFtQyxLQUFLLEtBQUtuQyxPQUFMLENBQWFvQyxHQUFLLEVBQWhGO0FBQ0EsVUFBSXZCLE1BQUo7O0FBQ0EsVUFBSTtBQUNIQSxnQkFBU29CLGVBQWVJLEtBQWYsQ0FBcUIsSUFBckIsQ0FBVDtBQUNBLE9BRkQsQ0FFRSxPQUFPQyxDQUFQLEVBQVU7QUFDWCxZQUFLckUsTUFBTCxDQUFZaUUsS0FBWixDQUFtQixHQUFHakMsTUFBUSxJQUFJNEIsS0FBTyxrQkFBekMsRUFBNERTLEVBQUVDLEtBQTlEO0FBQ0EsY0FBT3BDLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEJxQixFQUFFRyxPQUE1QixFQUFxQ0gsRUFBRW5CLEtBQXZDLENBQVA7QUFDQTs7QUFFRE4sZUFBU0EsU0FBU0EsTUFBVCxHQUFrQlYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUEzQjs7QUFFQSxVQUNDLHNCQUFzQjhCLElBQXRCLENBQTJCYixLQUEzQixLQUNHaEIsTUFESCxJQUVHQSxPQUFPRyxJQUZWLElBR0dILE9BQU9HLElBQVAsQ0FBWUosT0FBWixLQUF3QixJQUgzQixLQUlJQyxPQUFPRyxJQUFQLENBQVkyQixPQUFaLElBQXVCOUIsT0FBT0csSUFBUCxDQUFZNEIsUUFBbkMsSUFBK0MvQixPQUFPRyxJQUFQLENBQVk2QixLQUEzRCxJQUFvRWhDLE9BQU9HLElBQVAsQ0FBWThCLE1BSnBGLENBREQsRUFNRTtBQUNEO0FBQ0FqQyxjQUFPRyxJQUFQLENBQVkrQixnQkFBWixHQUErQiwwSkFBL0I7QUFDQTs7QUFFRCxhQUFPbEMsTUFBUDtBQUNBLE1BeEJEOztBQTBCQSxVQUFLLE1BQU0sQ0FBQ21DLElBQUQsRUFBT0MsWUFBUCxDQUFYLElBQW1DLEtBQUs1RSxhQUF4QyxFQUF1RDtBQUN0RHFELGdCQUFVekIsTUFBVixFQUFrQitDLElBQWxCLElBQTBCQyxZQUExQjtBQUNBLE1BbkN5QyxDQXFDMUM7OztBQUNBdkIsZUFBVXpCLE1BQVYsRUFBa0JoQyxNQUFsQixHQUEyQixLQUFLQSxNQUFoQztBQUNBLEtBdkNEO0FBd0NBOztBQUVELFNBQU1zRCxRQUFOLENBQWVNLEtBQWYsRUFBc0JKLE9BQXRCLEVBQStCQyxTQUEvQjtBQUNBLEdBOUNEO0FBK0NBOztBQUVEd0IsYUFBWTtBQUNYLFFBQU1DLHFCQUFzQkMsVUFBRCxJQUFnQjtBQUMxQztBQUNBLFNBQU07QUFBQ0MsUUFBRDtBQUFPQyxZQUFQO0FBQWlCQyxTQUFqQjtBQUF3QkMsWUFBeEI7QUFBa0NDO0FBQWxDLE9BQTBDTCxVQUFoRDs7QUFFQSxPQUFJSSxZQUFZLElBQWhCLEVBQXNCO0FBQ3JCLFdBQU9KLFVBQVA7QUFDQTs7QUFFRCxPQUFJN0YsRUFBRW1HLE9BQUYsQ0FBVTVCLE9BQU9DLElBQVAsQ0FBWXFCLFVBQVosQ0FBVixFQUFtQyxNQUFuQyxFQUEyQyxVQUEzQyxFQUF1RCxPQUF2RCxFQUFnRSxVQUFoRSxFQUE0RSxNQUE1RSxFQUFvRk8sTUFBcEYsR0FBNkYsQ0FBakcsRUFBb0c7QUFDbkcsV0FBT1AsVUFBUDtBQUNBOztBQUVELFNBQU1RLE9BQU87QUFDWko7QUFEWSxJQUFiOztBQUlBLE9BQUksT0FBT0gsSUFBUCxLQUFnQixRQUFwQixFQUE4QjtBQUM3Qk8sU0FBS1AsSUFBTCxHQUFZQSxLQUFLUSxRQUFMLENBQWMsR0FBZCxJQUFxQjtBQUFDTixZQUFPRjtBQUFSLEtBQXJCLEdBQXFDO0FBQUNDLGVBQVVEO0FBQVgsS0FBakQ7QUFDQSxJQUZELE1BRU8sSUFBSUMsUUFBSixFQUFjO0FBQ3BCTSxTQUFLUCxJQUFMLEdBQVk7QUFBQ0M7QUFBRCxLQUFaO0FBQ0EsSUFGTSxNQUVBLElBQUlDLEtBQUosRUFBVztBQUNqQkssU0FBS1AsSUFBTCxHQUFZO0FBQUNFO0FBQUQsS0FBWjtBQUNBOztBQUVELE9BQUlLLEtBQUtQLElBQUwsSUFBYSxJQUFqQixFQUF1QjtBQUN0QixXQUFPRCxVQUFQO0FBQ0E7O0FBRUQsT0FBSVEsS0FBS0osUUFBTCxDQUFjTSxNQUFsQixFQUEwQjtBQUN6QkYsU0FBS0osUUFBTCxHQUFnQjtBQUNmTyxhQUFRSCxLQUFLSixRQURFO0FBRWZRLGdCQUFXO0FBRkksS0FBaEI7QUFJQTs7QUFFRCxPQUFJUCxJQUFKLEVBQVU7QUFDVCxXQUFPO0FBQ05RLFdBQU07QUFDTFIsVUFESztBQUVMUyxhQUFPTjtBQUZGO0FBREEsS0FBUDtBQU1BOztBQUVELFVBQU9BLElBQVA7QUFDQSxHQTdDRDs7QUErQ0EsUUFBTU8sT0FBTyxJQUFiO0FBRUEsT0FBSzVDLFFBQUwsQ0FBYyxPQUFkLEVBQXVCO0FBQUM2QyxpQkFBYztBQUFmLEdBQXZCLEVBQThDO0FBQzdDQyxVQUFPO0FBQ04sVUFBTUMsT0FBT25CLG1CQUFtQixLQUFLQyxVQUF4QixDQUFiO0FBRUEsVUFBTW1CLGFBQWEsSUFBSUMsVUFBVUMsZ0JBQWQsQ0FBK0I7QUFDakRDLGlCQUFZO0FBQ1hDLGNBQVEsQ0FBRTs7QUFEQztBQURxQyxLQUEvQixDQUFuQjtBQU1BLFFBQUlmLElBQUo7O0FBQ0EsUUFBSTtBQUNIQSxZQUFPZ0IsSUFBSUMsa0JBQUosQ0FBdUJDLFNBQXZCLENBQWlDUCxVQUFqQyxFQUE2QyxNQUFNUSxPQUFPQyxJQUFQLENBQVksT0FBWixFQUFxQlYsSUFBckIsQ0FBbkQsQ0FBUDtBQUNBLEtBRkQsQ0FFRSxPQUFPbkQsS0FBUCxFQUFjO0FBQ2YsU0FBSW1CLElBQUluQixLQUFSOztBQUNBLFNBQUlBLE1BQU04RCxNQUFOLEtBQWlCLGdCQUFyQixFQUF1QztBQUN0QzNDLFVBQUk7QUFDSG5CLGNBQU8sY0FESjtBQUVIOEQsZUFBUTtBQUZMLE9BQUo7QUFJQTs7QUFFRCxZQUFPO0FBQ05sRSxrQkFBWSxHQUROO0FBRU5DLFlBQU07QUFDTGtFLGVBQVEsT0FESDtBQUVML0QsY0FBT21CLEVBQUVuQixLQUZKO0FBR0xzQixnQkFBU0gsRUFBRTJDLE1BQUYsSUFBWTNDLEVBQUVHO0FBSGxCO0FBRkEsTUFBUDtBQVFBOztBQUVELFNBQUtZLElBQUwsR0FBWTBCLE9BQU9JLEtBQVAsQ0FBYUMsT0FBYixDQUFxQjtBQUNoQ0MsVUFBS3pCLEtBQUswQjtBQURzQixLQUFyQixDQUFaO0FBSUEsU0FBS0MsTUFBTCxHQUFjLEtBQUtsQyxJQUFMLENBQVVnQyxHQUF4QixDQW5DTSxDQXFDTjs7QUFDQU4sV0FBT0ksS0FBUCxDQUFhSyxNQUFiLENBQW9CO0FBQ25CSCxVQUFLLEtBQUtoQyxJQUFMLENBQVVnQyxHQURJO0FBRW5CLGdEQUEyQ0ksU0FBU0MsZUFBVCxDQUF5QjlCLEtBQUsrQixLQUE5QjtBQUZ4QixLQUFwQixFQUdHO0FBQ0ZDLGFBQVE7QUFDUCw0Q0FBc0M7QUFEL0I7QUFETixLQUhIO0FBU0EsVUFBTXRGLFdBQVc7QUFDaEI0RSxhQUFRLFNBRFE7QUFFaEJXLFdBQU07QUFDTE4sY0FBUSxLQUFLQSxNQURSO0FBRUxPLGlCQUFXbEMsS0FBSytCO0FBRlg7QUFGVSxLQUFqQjs7QUFRQSxVQUFNSSxZQUFZNUIsS0FBS3RFLE9BQUwsQ0FBYW1HLFVBQWIsSUFBMkI3QixLQUFLdEUsT0FBTCxDQUFhbUcsVUFBYixDQUF3QmhCLElBQXhCLENBQTZCLElBQTdCLENBQTdDOztBQUVBLFFBQUllLGFBQWEsSUFBakIsRUFBdUI7QUFDdEJ4SSxPQUFFMEksTUFBRixDQUFTM0YsU0FBU3VGLElBQWxCLEVBQXdCO0FBQ3ZCSyxhQUFPSDtBQURnQixNQUF4QjtBQUdBOztBQUVELFdBQU96RixRQUFQO0FBQ0E7O0FBakU0QyxHQUE5Qzs7QUFvRUEsUUFBTTZGLFNBQVMsWUFBVztBQUN6QjtBQUNBLFNBQU1MLFlBQVksS0FBSzlGLE9BQUwsQ0FBYUUsT0FBYixDQUFxQixjQUFyQixDQUFsQjs7QUFDQSxTQUFNa0csY0FBY1gsU0FBU0MsZUFBVCxDQUF5QkksU0FBekIsQ0FBcEI7O0FBQ0EsU0FBTU8sZ0JBQWdCbEMsS0FBS3RFLE9BQUwsQ0FBYStELElBQWIsQ0FBa0IrQixLQUF4QztBQUNBLFNBQU1XLFFBQVFELGNBQWNFLFdBQWQsQ0FBMEIsR0FBMUIsQ0FBZDtBQUNBLFNBQU1DLFlBQVlILGNBQWNJLFNBQWQsQ0FBd0IsQ0FBeEIsRUFBMkJILEtBQTNCLENBQWxCO0FBQ0EsU0FBTUksaUJBQWlCTCxjQUFjSSxTQUFkLENBQXdCSCxRQUFRLENBQWhDLENBQXZCO0FBQ0EsU0FBTUssZ0JBQWdCLEVBQXRCO0FBQ0FBLGlCQUFjRCxjQUFkLElBQWdDTixXQUFoQztBQUNBLFNBQU1RLG9CQUFvQixFQUExQjtBQUNBQSxxQkFBa0JKLFNBQWxCLElBQStCRyxhQUEvQjtBQUVBNUIsVUFBT0ksS0FBUCxDQUFhSyxNQUFiLENBQW9CLEtBQUtuQyxJQUFMLENBQVVnQyxHQUE5QixFQUFtQztBQUNsQ3dCLFdBQU9EO0FBRDJCLElBQW5DO0FBSUEsU0FBTXRHLFdBQVc7QUFDaEI0RSxZQUFRLFNBRFE7QUFFaEJXLFVBQU07QUFDTHBELGNBQVM7QUFESjtBQUZVLElBQWpCLENBakJ5QixDQXdCekI7O0FBQ0EsU0FBTXNELFlBQVk1QixLQUFLdEUsT0FBTCxDQUFhaUgsV0FBYixJQUE0QjNDLEtBQUt0RSxPQUFMLENBQWFpSCxXQUFiLENBQXlCOUIsSUFBekIsQ0FBOEIsSUFBOUIsQ0FBOUM7O0FBQ0EsT0FBSWUsYUFBYSxJQUFqQixFQUF1QjtBQUN0QnhJLE1BQUUwSSxNQUFGLENBQVMzRixTQUFTdUYsSUFBbEIsRUFBd0I7QUFDdkJLLFlBQU9IO0FBRGdCLEtBQXhCO0FBR0E7O0FBQ0QsVUFBT3pGLFFBQVA7QUFDQSxHQWhDRCxDQXRIVyxDQXdKWDs7Ozs7O0FBS0EsU0FBTyxLQUFLaUIsUUFBTCxDQUFjLFFBQWQsRUFBd0I7QUFDOUI2QyxpQkFBYztBQURnQixHQUF4QixFQUVKO0FBQ0YvRCxTQUFNO0FBQ0wwRyxZQUFRQyxJQUFSLENBQWEscUZBQWI7QUFDQUQsWUFBUUMsSUFBUixDQUFhLCtEQUFiO0FBQ0EsV0FBT2IsT0FBT25CLElBQVAsQ0FBWSxJQUFaLENBQVA7QUFDQSxJQUxDOztBQU1GWCxTQUFNOEI7QUFOSixHQUZJLENBQVA7QUFVQTs7QUE5VXlCOztBQWtWM0JoRyxXQUFXdEMsR0FBWCxHQUFpQixFQUFqQjs7QUFFQSxNQUFNb0osY0FBYyxTQUFTQyxZQUFULEdBQXdCO0FBQzNDLE9BQU1DLGlCQUFpQixDQUFDQyxTQUFELEVBQVksSUFBWixFQUFrQixLQUFsQixDQUF2QjtBQUNBLFFBQU87QUFDTnpCLFNBQU8seUNBREQ7O0FBRU50QyxTQUFPO0FBQ04sT0FBSSxLQUFLRCxVQUFMLElBQW1CLEtBQUtBLFVBQUwsQ0FBZ0JpRSxPQUF2QyxFQUFnRDtBQUMvQyxTQUFLakUsVUFBTCxHQUFrQmtFLEtBQUtDLEtBQUwsQ0FBVyxLQUFLbkUsVUFBTCxDQUFnQmlFLE9BQTNCLENBQWxCO0FBQ0E7O0FBRUQsUUFBSyxJQUFJRyxJQUFJLENBQWIsRUFBZ0JBLElBQUlySCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBFLFdBQWxCLENBQThCdUYsTUFBbEQsRUFBMEQ2RCxHQUExRCxFQUErRDtBQUM5RCxVQUFNdkgsU0FBU0UsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwRSxXQUFsQixDQUE4Qm9KLENBQTlCLENBQWY7O0FBRUEsUUFBSSxPQUFPdkgsTUFBUCxLQUFrQixVQUF0QixFQUFrQztBQUNqQyxXQUFNWSxTQUFTWixPQUFPb0MsS0FBUCxDQUFhLElBQWIsRUFBbUJvRixTQUFuQixDQUFmOztBQUNBLFNBQUksQ0FBQ04sZUFBZXRELFFBQWYsQ0FBd0JoRCxNQUF4QixDQUFMLEVBQXNDO0FBQ3JDLGFBQU9BLE1BQVA7QUFDQTtBQUNEO0FBQ0Q7O0FBRUQsT0FBSThFLEtBQUo7O0FBQ0EsT0FBSSxLQUFLM0YsT0FBTCxDQUFhRSxPQUFiLENBQXFCLGNBQXJCLENBQUosRUFBMEM7QUFDekN5RixZQUFRRixTQUFTQyxlQUFULENBQXlCLEtBQUsxRixPQUFMLENBQWFFLE9BQWIsQ0FBcUIsY0FBckIsQ0FBekIsQ0FBUjtBQUNBOztBQUVELFVBQU87QUFDTnFGLFlBQVEsS0FBS3ZGLE9BQUwsQ0FBYUUsT0FBYixDQUFxQixXQUFyQixDQURGO0FBRU55RjtBQUZNLElBQVA7QUFJQTs7QUEzQkssRUFBUDtBQTZCQSxDQS9CRDs7QUFpQ0EsTUFBTStCLFlBQVksVUFBU0MsVUFBVCxFQUFxQjtBQUN0QyxLQUFJLENBQUN4SCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBaEIsSUFBc0JyQyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjNDLE9BQWxCLENBQTBCOEgsVUFBMUIsS0FBeUNBLFVBQW5FLEVBQStFO0FBQzlFeEgsYUFBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsR0FBb0IsSUFBSTNFLEdBQUosQ0FBUTtBQUMzQk0sWUFBUyxJQURrQjtBQUUzQnlKLG1CQUFnQixJQUZXO0FBRzNCQyxlQUFZQyxRQUFRQyxHQUFSLENBQVlDLFFBQVosS0FBeUIsYUFIVjtBQUkzQkwsYUFKMkI7QUFLM0IvRCxTQUFNcUQ7QUFMcUIsR0FBUixDQUFwQjtBQU9BOztBQUVELEtBQUksQ0FBQzlHLFdBQVd0QyxHQUFYLENBQWVGLE9BQWhCLElBQTJCd0MsV0FBV3RDLEdBQVgsQ0FBZUYsT0FBZixDQUF1QmtDLE9BQXZCLENBQStCOEgsVUFBL0IsS0FBOENBLFVBQTdFLEVBQXlGO0FBQ3hGeEgsYUFBV3RDLEdBQVgsQ0FBZUYsT0FBZixHQUF5QixJQUFJRSxHQUFKLENBQVE7QUFDaEMrSixtQkFBZ0IsSUFEZ0I7QUFFaENDLGVBQVlDLFFBQVFDLEdBQVIsQ0FBWUMsUUFBWixLQUF5QixhQUZMO0FBR2hDTCxhQUhnQztBQUloQy9ELFNBQU1xRDtBQUowQixHQUFSLENBQXpCO0FBTUE7QUFDRCxDQW5CRCxDLENBcUJBOzs7QUFDQTlHLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGlCQUF4QixFQUEyQyxDQUFDNEgsR0FBRCxFQUFNQyxLQUFOLEtBQWdCO0FBQzFEUixXQUFVUSxLQUFWO0FBQ0EsQ0FGRCxFLENBSUE7O0FBQ0FSLFVBQVUsQ0FBQyxDQUFDdkgsV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsaUJBQXhCLENBQVosRTs7Ozs7Ozs7Ozs7QUNuWkFGLFdBQVdDLFFBQVgsQ0FBb0IrSCxRQUFwQixDQUE2QixTQUE3QixFQUF3QyxZQUFXO0FBQ2xELE1BQUtDLE9BQUwsQ0FBYSxVQUFiLEVBQXlCLFlBQVc7QUFDbkMsT0FBS0MsR0FBTCxDQUFTLHVCQUFULEVBQWtDLEdBQWxDLEVBQXVDO0FBQUVDLFNBQU0sS0FBUjtBQUFlQyxXQUFRO0FBQXZCLEdBQXZDO0FBQ0EsT0FBS0YsR0FBTCxDQUFTLG1CQUFULEVBQThCLEVBQTlCLEVBQWtDO0FBQUVDLFNBQU0sS0FBUjtBQUFlQyxXQUFRO0FBQXZCLEdBQWxDO0FBQ0EsT0FBS0YsR0FBTCxDQUFTLDBCQUFULEVBQXFDLElBQXJDLEVBQTJDO0FBQUVDLFNBQU0sU0FBUjtBQUFtQkMsV0FBUTtBQUEzQixHQUEzQztBQUNBLE9BQUtGLEdBQUwsQ0FBUyw0Q0FBVCxFQUF1RCxLQUF2RCxFQUE4RDtBQUFFQyxTQUFNLFNBQVI7QUFBbUJDLFdBQVE7QUFBM0IsR0FBOUQ7QUFDQSxPQUFLRixHQUFMLENBQVMsb0JBQVQsRUFBK0IsSUFBL0IsRUFBcUM7QUFBRUMsU0FBTSxTQUFSO0FBQW1CQyxXQUFRO0FBQTNCLEdBQXJDO0FBQ0EsT0FBS0YsR0FBTCxDQUFTLGtCQUFULEVBQTZCLEdBQTdCLEVBQWtDO0FBQUVDLFNBQU0sUUFBUjtBQUFrQkMsV0FBUSxLQUExQjtBQUFpQ0MsZ0JBQWE7QUFBRW5ELFNBQUssb0JBQVA7QUFBNkI2QyxXQUFPO0FBQXBDO0FBQTlDLEdBQWxDO0FBQ0EsT0FBS0csR0FBTCxDQUFTLGlCQUFULEVBQTRCLEtBQTVCLEVBQW1DO0FBQUVDLFNBQU0sU0FBUjtBQUFtQkMsV0FBUTtBQUEzQixHQUFuQztBQUNBLE9BQUtGLEdBQUwsQ0FBUyxpQkFBVCxFQUE0QixHQUE1QixFQUFpQztBQUFFQyxTQUFNLFFBQVI7QUFBa0JDLFdBQVEsS0FBMUI7QUFBaUNDLGdCQUFhO0FBQUVuRCxTQUFLLGlCQUFQO0FBQTBCNkMsV0FBTztBQUFqQztBQUE5QyxHQUFqQztBQUNBLEVBVEQ7QUFVQSxDQVhELEU7Ozs7Ozs7Ozs7O0FDQUEvSCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQm5FLGFBQWxCLENBQWdDb0ssR0FBaEMsQ0FBb0MsZUFBcEMsRUFBcUQsU0FBU0MsY0FBVCxHQUEwQjtBQUM5RSxRQUFPLENBQUMsTUFBRCxFQUFTLEtBQVQsRUFBZ0I3RSxRQUFoQixDQUF5QixLQUFLN0QsT0FBTCxDQUFhQyxNQUF0QyxJQUFnRCxLQUFLbUQsVUFBckQsR0FBa0UsS0FBS3VGLFdBQTlFO0FBQ0EsQ0FGRCxFOzs7Ozs7Ozs7OztBQ0FBO0FBQ0E7QUFDQTtBQUVBeEksV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JuRSxhQUFsQixDQUFnQ29LLEdBQWhDLENBQW9DLG9CQUFwQyxFQUEwRCxTQUFTRyxtQkFBVCxHQUErQjtBQUN4RixPQUFNQyxpQkFBaUIxSSxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3Qix1QkFBeEIsS0FBb0QsQ0FBcEQsR0FBd0QsR0FBeEQsR0FBOERGLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLHVCQUF4QixDQUFyRjtBQUNBLE9BQU15SSxlQUFlM0ksV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsbUJBQXhCLEtBQWdELENBQWhELEdBQW9ELEVBQXBELEdBQXlERixXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QixtQkFBeEIsQ0FBOUU7QUFDQSxPQUFNMEksU0FBUyxLQUFLSixXQUFMLENBQWlCSSxNQUFqQixHQUEwQkMsU0FBUyxLQUFLTCxXQUFMLENBQWlCSSxNQUExQixDQUExQixHQUE4RCxDQUE3RTtBQUNBLEtBQUlFLFFBQVFILFlBQVosQ0FKd0YsQ0FNeEY7O0FBQ0EsS0FBSSxPQUFPLEtBQUtILFdBQUwsQ0FBaUJNLEtBQXhCLEtBQWtDLFdBQXRDLEVBQW1EO0FBQ2xEQSxVQUFRRCxTQUFTLEtBQUtMLFdBQUwsQ0FBaUJNLEtBQTFCLENBQVI7QUFDQSxFQUZELE1BRU87QUFDTkEsVUFBUUgsWUFBUjtBQUNBOztBQUVELEtBQUlHLFFBQVFKLGNBQVosRUFBNEI7QUFDM0JJLFVBQVFKLGNBQVI7QUFDQTs7QUFFRCxLQUFJSSxVQUFVLENBQVYsSUFBZSxDQUFDOUksV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsMEJBQXhCLENBQXBCLEVBQXlFO0FBQ3hFNEksVUFBUUgsWUFBUjtBQUNBOztBQUVELFFBQU87QUFDTkMsUUFETTtBQUVORTtBQUZNLEVBQVA7QUFJQSxDQXpCRCxFOzs7Ozs7Ozs7OztBQ0pBO0FBQ0E5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQm5FLGFBQWxCLENBQWdDb0ssR0FBaEMsQ0FBb0MsbUJBQXBDLEVBQXlELFNBQVNTLGtCQUFULEdBQThCO0FBQ3RGLE9BQU1DLGNBQWM7QUFBRUMsZ0JBQWM7QUFBaEIsRUFBcEI7QUFDQSxLQUFJL0YsSUFBSjtBQUNBLE9BQU1nRyxTQUFTLEtBQUtDLGFBQUwsRUFBZjs7QUFFQSxLQUFJRCxPQUFPOUQsTUFBUCxJQUFpQjhELE9BQU85RCxNQUFQLENBQWNnRSxJQUFkLEVBQXJCLEVBQTJDO0FBQzFDbEcsU0FBT2xELFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QkMsV0FBeEIsQ0FBb0NMLE9BQU85RCxNQUEzQyxLQUFzRDRELFdBQTdEO0FBQ0EsRUFGRCxNQUVPLElBQUlFLE9BQU8vRixRQUFQLElBQW1CK0YsT0FBTy9GLFFBQVAsQ0FBZ0JpRyxJQUFoQixFQUF2QixFQUErQztBQUNyRGxHLFNBQU9sRCxXQUFXcUosTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0JFLGlCQUF4QixDQUEwQ04sT0FBTy9GLFFBQWpELEtBQThENkYsV0FBckU7QUFDQSxFQUZNLE1BRUEsSUFBSUUsT0FBT2hHLElBQVAsSUFBZWdHLE9BQU9oRyxJQUFQLENBQVlrRyxJQUFaLEVBQW5CLEVBQXVDO0FBQzdDbEcsU0FBT2xELFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QkUsaUJBQXhCLENBQTBDTixPQUFPaEcsSUFBakQsS0FBMEQ4RixXQUFqRTtBQUNBLEVBRk0sTUFFQTtBQUNOLFFBQU0sSUFBSXBFLE9BQU82RSxLQUFYLENBQWlCLCtCQUFqQixFQUFrRCw0REFBbEQsQ0FBTjtBQUNBOztBQUVELEtBQUl2RyxLQUFLK0YsWUFBVCxFQUF1QjtBQUN0QixRQUFNLElBQUlyRSxPQUFPNkUsS0FBWCxDQUFpQixvQkFBakIsRUFBdUMsNkVBQXZDLENBQU47QUFDQTs7QUFFRCxRQUFPdkcsSUFBUDtBQUNBLENBcEJELEU7Ozs7Ozs7Ozs7O0FDREFsRCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQm5FLGFBQWxCLENBQWdDb0ssR0FBaEMsQ0FBb0Msa0JBQXBDLEVBQXdELFNBQVNvQixpQkFBVCxHQUE2QjtBQUNwRixPQUFNUixTQUFTLEtBQUtDLGFBQUwsRUFBZjtBQUVBLFFBQVEsQ0FBQ0QsT0FBTzlELE1BQVIsSUFBa0IsQ0FBQzhELE9BQU8vRixRQUExQixJQUFzQyxDQUFDK0YsT0FBT2hHLElBQS9DLElBQ0xnRyxPQUFPOUQsTUFBUCxJQUFpQixLQUFLQSxNQUFMLEtBQWdCOEQsT0FBTzlELE1BRG5DLElBRUw4RCxPQUFPL0YsUUFBUCxJQUFtQixLQUFLRCxJQUFMLENBQVVDLFFBQVYsS0FBdUIrRixPQUFPL0YsUUFGNUMsSUFHTCtGLE9BQU9oRyxJQUFQLElBQWUsS0FBS0EsSUFBTCxDQUFVQyxRQUFWLEtBQXVCK0YsT0FBT2hHLElBSC9DO0FBSUEsQ0FQRCxFOzs7Ozs7Ozs7OztBQ0FBbEQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JuRSxhQUFsQixDQUFnQ29LLEdBQWhDLENBQW9DLGdCQUFwQyxFQUFzRCxTQUFTcUIsZUFBVCxHQUEyQjtBQUNoRixLQUFJQyxJQUFKOztBQUNBLEtBQUksS0FBS3BCLFdBQUwsQ0FBaUJvQixJQUFyQixFQUEyQjtBQUMxQixNQUFJO0FBQ0hBLFVBQU96QyxLQUFLQyxLQUFMLENBQVcsS0FBS29CLFdBQUwsQ0FBaUJvQixJQUE1QixDQUFQO0FBQ0EsR0FGRCxDQUVFLE9BQU96SCxDQUFQLEVBQVU7QUFDWCxRQUFLckUsTUFBTCxDQUFZK0ksSUFBWixDQUFrQixvQ0FBb0MsS0FBSzJCLFdBQUwsQ0FBaUJvQixJQUFNLElBQTdFLEVBQWtGekgsQ0FBbEY7QUFDQSxTQUFNLElBQUl5QyxPQUFPNkUsS0FBWCxDQUFpQixvQkFBakIsRUFBd0MscUNBQXFDLEtBQUtqQixXQUFMLENBQWlCb0IsSUFBTSxHQUFwRyxFQUF3RztBQUFFOUcsa0JBQWM7QUFBaEIsSUFBeEcsQ0FBTjtBQUNBO0FBQ0Q7O0FBRUQsS0FBSStHLE1BQUo7O0FBQ0EsS0FBSSxLQUFLckIsV0FBTCxDQUFpQnFCLE1BQXJCLEVBQTZCO0FBQzVCLE1BQUk7QUFDSEEsWUFBUzFDLEtBQUtDLEtBQUwsQ0FBVyxLQUFLb0IsV0FBTCxDQUFpQnFCLE1BQTVCLENBQVQ7QUFDQSxHQUZELENBRUUsT0FBTzFILENBQVAsRUFBVTtBQUNYLFFBQUtyRSxNQUFMLENBQVkrSSxJQUFaLENBQWtCLHNDQUFzQyxLQUFLMkIsV0FBTCxDQUFpQnFCLE1BQVEsSUFBakYsRUFBc0YxSCxDQUF0RjtBQUNBLFNBQU0sSUFBSXlDLE9BQU82RSxLQUFYLENBQWlCLHNCQUFqQixFQUEwQyx1Q0FBdUMsS0FBS2pCLFdBQUwsQ0FBaUJxQixNQUFRLEdBQTFHLEVBQThHO0FBQUUvRyxrQkFBYztBQUFoQixJQUE5RyxDQUFOO0FBQ0E7QUFDRCxFQW5CK0UsQ0FxQmhGOzs7QUFDQSxLQUFJLE9BQU8rRyxNQUFQLEtBQWtCLFFBQXRCLEVBQWdDO0FBQy9CLE1BQUlDLHNCQUFzQm5JLE9BQU9DLElBQVAsQ0FBWTVCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCaEUsc0JBQTlCLENBQTFCOztBQUNBLE1BQUksQ0FBQzJCLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsMkJBQTVDLENBQUQsSUFBNkUsS0FBS3ZGLE9BQUwsQ0FBYTZCLEtBQWIsQ0FBbUJnQyxRQUFuQixDQUE0QixZQUE1QixDQUFqRixFQUE0SDtBQUMzSG9HLHlCQUFzQkEsb0JBQW9CRyxNQUFwQixDQUEyQnRJLE9BQU9DLElBQVAsQ0FBWTVCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCekQsMEJBQTlCLENBQTNCLENBQXRCO0FBQ0E7O0FBRUQrQyxTQUFPQyxJQUFQLENBQVlpSSxNQUFaLEVBQW9CcEksT0FBcEIsQ0FBNkJ5SSxDQUFELElBQU87QUFDbEMsT0FBSUosb0JBQW9CcEcsUUFBcEIsQ0FBNkJ3RyxDQUE3QixLQUFtQ0osb0JBQW9CcEcsUUFBcEIsQ0FBNkJ3RyxFQUFFQyxLQUFGLENBQVFuSyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpFLGNBQTFCLEVBQTBDLENBQTFDLENBQTdCLENBQXZDLEVBQW1IO0FBQ2xILFdBQU95TCxPQUFPSyxDQUFQLENBQVA7QUFDQTtBQUNELEdBSkQ7QUFLQSxFQWpDK0UsQ0FtQ2hGOzs7QUFDQUwsVUFBU2xJLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQlAsTUFBbEIsRUFBMEI3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFLHNCQUE1QyxDQUFUOztBQUNBLEtBQUksQ0FBQzJCLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsMkJBQTVDLENBQUQsSUFBNkUsS0FBS3ZGLE9BQUwsQ0FBYTZCLEtBQWIsQ0FBbUJnQyxRQUFuQixDQUE0QixZQUE1QixDQUFqRixFQUE0SDtBQUMzSG1HLFdBQVNsSSxPQUFPeUksTUFBUCxDQUFjUCxNQUFkLEVBQXNCN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J6RCwwQkFBeEMsQ0FBVDtBQUNBOztBQUVELEtBQUl5TCxLQUFKOztBQUNBLEtBQUksS0FBSzdCLFdBQUwsQ0FBaUI2QixLQUFyQixFQUE0QjtBQUMzQixNQUFJO0FBQ0hBLFdBQVFsRCxLQUFLQyxLQUFMLENBQVcsS0FBS29CLFdBQUwsQ0FBaUI2QixLQUE1QixDQUFSO0FBQ0EsR0FGRCxDQUVFLE9BQU9sSSxDQUFQLEVBQVU7QUFDWCxRQUFLckUsTUFBTCxDQUFZK0ksSUFBWixDQUFrQixxQ0FBcUMsS0FBSzJCLFdBQUwsQ0FBaUI2QixLQUFPLElBQS9FLEVBQW9GbEksQ0FBcEY7QUFDQSxTQUFNLElBQUl5QyxPQUFPNkUsS0FBWCxDQUFpQixxQkFBakIsRUFBeUMsc0NBQXNDLEtBQUtqQixXQUFMLENBQWlCNkIsS0FBTyxHQUF2RyxFQUEyRztBQUFFdkgsa0JBQWM7QUFBaEIsSUFBM0csQ0FBTjtBQUNBO0FBQ0QsRUFqRCtFLENBbURoRjs7O0FBQ0EsS0FBSSxPQUFPdUgsS0FBUCxLQUFpQixRQUFyQixFQUErQjtBQUM5QixNQUFJQyxvQkFBb0IzSSxPQUFPQyxJQUFQLENBQVk1QixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFLHNCQUE5QixDQUF4Qjs7QUFDQSxNQUFJLENBQUMyQixXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLDJCQUE1QyxDQUFELElBQTZFLEtBQUt2RixPQUFMLENBQWE2QixLQUFiLENBQW1CZ0MsUUFBbkIsQ0FBNEIsWUFBNUIsQ0FBakYsRUFBNEg7QUFDM0g0Ryx1QkFBb0JBLGtCQUFrQkwsTUFBbEIsQ0FBeUJ0SSxPQUFPQyxJQUFQLENBQVk1QixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnpELDBCQUE5QixDQUF6QixDQUFwQjtBQUNBOztBQUVEK0MsU0FBT0MsSUFBUCxDQUFZeUksS0FBWixFQUFtQjVJLE9BQW5CLENBQTRCeUksQ0FBRCxJQUFPO0FBQ2pDLE9BQUlJLGtCQUFrQjVHLFFBQWxCLENBQTJCd0csQ0FBM0IsS0FBaUNJLGtCQUFrQjVHLFFBQWxCLENBQTJCd0csRUFBRUMsS0FBRixDQUFRbkssV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqRSxjQUExQixFQUEwQyxDQUExQyxDQUEzQixDQUFyQyxFQUErRztBQUM5RyxXQUFPaU0sTUFBTUgsQ0FBTixDQUFQO0FBQ0E7QUFDRCxHQUpEO0FBS0E7O0FBRUQsUUFBTztBQUNOTixNQURNO0FBRU5DLFFBRk07QUFHTlE7QUFITSxFQUFQO0FBS0EsQ0F0RUQsRTs7Ozs7Ozs7Ozs7QUNBQXJLLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCbkUsYUFBbEIsQ0FBZ0NvSyxHQUFoQyxDQUFvQyxpQkFBcEMsRUFBdUQsU0FBU2lDLGdCQUFULEdBQTRCO0FBQ2xGLEtBQUlySCxJQUFKOztBQUVBLEtBQUksS0FBS3JELE9BQUwsQ0FBYUUsT0FBYixDQUFxQixjQUFyQixLQUF3QyxLQUFLRixPQUFMLENBQWFFLE9BQWIsQ0FBcUIsV0FBckIsQ0FBNUMsRUFBK0U7QUFDOUVtRCxTQUFPbEQsV0FBV3FKLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCckUsT0FBeEIsQ0FBZ0M7QUFDdEMsVUFBTyxLQUFLcEYsT0FBTCxDQUFhRSxPQUFiLENBQXFCLFdBQXJCLENBRCtCO0FBRXRDLDhDQUEyQ3VGLFNBQVNDLGVBQVQsQ0FBeUIsS0FBSzFGLE9BQUwsQ0FBYUUsT0FBYixDQUFxQixjQUFyQixDQUF6QjtBQUZMLEdBQWhDLENBQVA7QUFJQTs7QUFFRCxRQUFPbUQsSUFBUDtBQUNBLENBWEQsRTs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQSxJQUFJOUYsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDs7QUFFTjtBQUNBLFNBQVMrTSxxQkFBVCxDQUErQjtBQUFFdEIsT0FBRjtBQUFVdUIsbUJBQWtCLElBQTVCO0FBQWtDQyxtQkFBa0I7QUFBcEQsQ0FBL0IsRUFBNEY7QUFDM0YsS0FBSSxDQUFDLENBQUN4QixPQUFPeUIsTUFBUixJQUFrQixDQUFDekIsT0FBT3lCLE1BQVAsQ0FBY3ZCLElBQWQsRUFBcEIsTUFBOEMsQ0FBQ0YsT0FBTzBCLFFBQVIsSUFBb0IsQ0FBQzFCLE9BQU8wQixRQUFQLENBQWdCeEIsSUFBaEIsRUFBbkUsQ0FBSixFQUFnRztBQUMvRixRQUFNLElBQUl4RSxPQUFPNkUsS0FBWCxDQUFpQixpQ0FBakIsRUFBb0Qsa0RBQXBELENBQU47QUFDQTs7QUFFRCxPQUFNSSxvQ0FBYzdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCaEUsc0JBQWhDLENBQU47O0FBQ0EsS0FBSXFNLGVBQUosRUFBcUI7QUFDcEIsU0FBT2IsT0FBT25MLFNBQWQ7QUFDQTs7QUFFRCxLQUFJbU0sSUFBSjs7QUFDQSxLQUFJM0IsT0FBT3lCLE1BQVgsRUFBbUI7QUFDbEJFLFNBQU83SyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0NMLE9BQU95QixNQUEzQyxFQUFtRDtBQUFFZDtBQUFGLEdBQW5ELENBQVA7QUFDQSxFQUZELE1BRU8sSUFBSVgsT0FBTzBCLFFBQVgsRUFBcUI7QUFDM0JDLFNBQU83SyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCQyxhQUF4QixDQUFzQzdCLE9BQU8wQixRQUE3QyxFQUF1RDtBQUFFZjtBQUFGLEdBQXZELENBQVA7QUFDQTs7QUFFRCxLQUFJLENBQUNnQixJQUFELElBQVNBLEtBQUtHLENBQUwsS0FBVyxHQUF4QixFQUE2QjtBQUM1QixRQUFNLElBQUlwRyxPQUFPNkUsS0FBWCxDQUFpQixzQkFBakIsRUFBeUMsK0VBQXpDLENBQU47QUFDQTs7QUFFRCxLQUFJZ0IsbUJBQW1CSSxLQUFLSSxRQUE1QixFQUFzQztBQUNyQyxRQUFNLElBQUlyRyxPQUFPNkUsS0FBWCxDQUFpQixxQkFBakIsRUFBeUMsZ0JBQWdCb0IsS0FBS2hJLElBQU0sZUFBcEUsQ0FBTjtBQUNBOztBQUVELFFBQU9nSSxJQUFQO0FBQ0E7O0FBRUQ3SyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGlCQUEzQixFQUE4QztBQUFFNkMsZUFBYztBQUFoQixDQUE5QyxFQUFzRTtBQUNyRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUF2RSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELEtBQUtqQyxVQUFMLENBQWdCbUksZUFBaEU7QUFDQSxHQUZEO0FBSUEsU0FBT3BMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrQixZQUFTeEMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2hHLEdBQS9DLEVBQW9EO0FBQUUyRSxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUFwRDtBQUR1QixHQUExQixDQUFQO0FBR0E7O0FBWG9FLENBQXRFO0FBY0EyQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHVCQUEzQixFQUFvRDtBQUFFNkMsZUFBYztBQUFoQixDQUFwRCxFQUE0RTtBQUMzRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUEsUUFBTWpHLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksa0JBQVosRUFBZ0NxRyxXQUFXaEcsR0FBM0MsRUFBZ0RoQyxLQUFLZ0MsR0FBckQ7QUFDQSxHQUZEO0FBSUEsU0FBT2xGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQVgwRSxDQUE1RTtBQWNBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG1CQUEzQixFQUFnRDtBQUFFNkMsZUFBYztBQUFoQixDQUFoRCxFQUF3RTtBQUN2RUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUEsUUFBTWpHLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksY0FBWixFQUE0QnFHLFdBQVdoRyxHQUF2QyxFQUE0Q2hDLEtBQUtnQyxHQUFqRDtBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBWHNFLENBQXhFO0FBY0FULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsa0JBQTNCLEVBQStDO0FBQUU2QyxlQUFjO0FBQWhCLENBQS9DLEVBQXVFO0FBQ3RFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFWLHNCQUFzQjtBQUFFdEIsV0FBUSxLQUFLQyxhQUFMO0FBQVYsR0FBdEIsQ0FBbkI7QUFFQXZFLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQnFHLFdBQVdoRyxHQUF0QztBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBVHFFLENBQXZFO0FBWUFULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsdUJBQTNCLEVBQW9EO0FBQUU2QyxlQUFjO0FBQWhCLENBQXBELEVBQTRFO0FBQzNFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFWLHNCQUFzQjtBQUFFdEIsV0FBUSxLQUFLQyxhQUFMO0FBQVYsR0FBdEIsQ0FBbkI7O0FBRUEsTUFBSSxDQUFDLEtBQUtsRyxVQUFMLENBQWdCcUksTUFBckIsRUFBNkI7QUFDNUIsVUFBT3RMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsc0NBQTFCLENBQVA7QUFDQTs7QUFFRCxNQUFJLENBQUMsS0FBS21DLFVBQUwsQ0FBZ0JzSSxNQUFyQixFQUE2QjtBQUM1QixVQUFPdkwsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixzQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU13SyxTQUFTLElBQUlFLElBQUosQ0FBUyxLQUFLdkksVUFBTCxDQUFnQnFJLE1BQXpCLENBQWY7QUFDQSxRQUFNQyxTQUFTLElBQUlDLElBQUosQ0FBUyxLQUFLdkksVUFBTCxDQUFnQnNJLE1BQXpCLENBQWY7QUFFQSxNQUFJRSxZQUFZLEtBQWhCOztBQUNBLE1BQUksT0FBTyxLQUFLeEksVUFBTCxDQUFnQndJLFNBQXZCLEtBQXFDLFdBQXpDLEVBQXNEO0FBQ3JEQSxlQUFZLEtBQUt4SSxVQUFMLENBQWdCd0ksU0FBNUI7QUFDQTs7QUFFRDdHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVkscUJBQVosRUFBbUM7QUFBRThGLFlBQVFPLFdBQVdoRyxHQUFyQjtBQUEwQm9HLFVBQTFCO0FBQWtDQyxVQUFsQztBQUEwQ0U7QUFBMUMsSUFBbkM7QUFDQSxHQUZEO0FBSUEsU0FBT3pMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQXpCMEUsQ0FBNUU7QUE0QkFULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZ0JBQTNCLEVBQTZDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTdDLEVBQXFFO0FBQ3BFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFWLHNCQUFzQjtBQUFFdEIsV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0NzQixvQkFBaUI7QUFBakQsR0FBdEIsQ0FBbkI7QUFFQSxRQUFNaUIsTUFBTTFMLFdBQVdxSixNQUFYLENBQWtCc0MsYUFBbEIsQ0FBZ0NDLHdCQUFoQyxDQUF5RFYsV0FBV2hHLEdBQXBFLEVBQXlFLEtBQUtFLE1BQTlFLENBQVo7O0FBRUEsTUFBSSxDQUFDc0csR0FBTCxFQUFVO0FBQ1QsVUFBTzFMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMkIsMENBQTBDb0ssV0FBV3JJLElBQU0sR0FBdEYsQ0FBUDtBQUNBOztBQUVELE1BQUksQ0FBQzZJLElBQUlHLElBQVQsRUFBZTtBQUNkLFVBQU83TCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTJCLGdCQUFnQm9LLFdBQVdySSxJQUFNLG1DQUE1RCxDQUFQO0FBQ0E7O0FBRUQrQixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLFVBQVosRUFBd0JxRyxXQUFXaEcsR0FBbkM7QUFDQSxHQUZEO0FBSUEsU0FBT2xGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQW5CbUUsQ0FBckU7QUFzQkFULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsaUJBQTNCLEVBQThDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTlDLEVBQXNFO0FBQ3JFQyxRQUFPO0FBQ04sTUFBSSxDQUFDbEUsV0FBVytKLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCLEtBQUs1RSxNQUFwQyxFQUE0QyxVQUE1QyxDQUFMLEVBQThEO0FBQzdELFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxNQUFJLENBQUMsS0FBS2dDLFVBQUwsQ0FBZ0JKLElBQXJCLEVBQTJCO0FBQzFCLFVBQU83QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLCtCQUExQixDQUFQO0FBQ0E7O0FBRUQsTUFBSSxLQUFLbUMsVUFBTCxDQUFnQnhFLE9BQWhCLElBQTJCLENBQUNyQixFQUFFb0UsT0FBRixDQUFVLEtBQUt5QixVQUFMLENBQWdCeEUsT0FBMUIsQ0FBaEMsRUFBb0U7QUFDbkUsVUFBT3VCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsbURBQTFCLENBQVA7QUFDQTs7QUFFRCxNQUFJLEtBQUttQyxVQUFMLENBQWdCeEQsWUFBaEIsSUFBZ0MsRUFBRSxPQUFPLEtBQUt3RCxVQUFMLENBQWdCeEQsWUFBdkIsS0FBd0MsUUFBMUMsQ0FBcEMsRUFBeUY7QUFDeEYsVUFBT08sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix5REFBMUIsQ0FBUDtBQUNBOztBQUVELE1BQUlnTCxXQUFXLEtBQWY7O0FBQ0EsTUFBSSxPQUFPLEtBQUs3SSxVQUFMLENBQWdCNkksUUFBdkIsS0FBb0MsV0FBeEMsRUFBcUQ7QUFDcERBLGNBQVcsS0FBSzdJLFVBQUwsQ0FBZ0I2SSxRQUEzQjtBQUNBOztBQUVELE1BQUkzRyxFQUFKO0FBQ0FQLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DRCxRQUFLUCxPQUFPQyxJQUFQLENBQVksZUFBWixFQUE2QixLQUFLNUIsVUFBTCxDQUFnQkosSUFBN0MsRUFBbUQsS0FBS0ksVUFBTCxDQUFnQnhFLE9BQWhCLEdBQTBCLEtBQUt3RSxVQUFMLENBQWdCeEUsT0FBMUMsR0FBb0QsRUFBdkcsRUFBMkdxTixRQUEzRyxFQUFxSCxLQUFLN0ksVUFBTCxDQUFnQnhELFlBQXJJLENBQUw7QUFDQSxHQUZEO0FBSUEsU0FBT08sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQytCLFlBQVN4QyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0NwRSxHQUFHNEcsR0FBdkMsRUFBNEM7QUFBRWxDLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQTVDO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUEvQm9FLENBQXRFO0FBa0NBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixpQkFBM0IsRUFBOEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBOUMsRUFBc0U7QUFDckVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYVYsc0JBQXNCO0FBQUV0QixXQUFRLEtBQUtDLGFBQUwsRUFBVjtBQUFnQ3NCLG9CQUFpQjtBQUFqRCxHQUF0QixDQUFuQjtBQUVBN0YsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxXQUFaLEVBQXlCcUcsV0FBV2hHLEdBQXBDO0FBQ0EsR0FGRDtBQUlBLFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDK0IsWUFBUzBJO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFYb0UsQ0FBdEU7QUFjQWxMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZ0JBQTNCLEVBQTZDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTdDLEVBQXFFO0FBQ3BFL0QsT0FBTTtBQUNMLFFBQU1nTCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDc0Isb0JBQWlCO0FBQWpELEdBQXRCLENBQW5CO0FBRUE3RixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkJxRyxXQUFXaEcsR0FBeEMsRUFBNkMsS0FBS0UsTUFBbEQ7QUFDQSxHQUZEO0FBSUEsUUFBTTtBQUFFd0QsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxRQUFNQyxXQUFXdkssT0FBT3lJLE1BQVAsQ0FBYyxFQUFkLEVBQWtCQyxLQUFsQixFQUF5QjtBQUFFMEIsUUFBS2IsV0FBV2hHO0FBQWxCLEdBQXpCLENBQWpCO0FBRUEsUUFBTWlILFFBQVFuTSxXQUFXcUosTUFBWCxDQUFrQitDLE9BQWxCLENBQTBCQyxJQUExQixDQUErQkgsUUFBL0IsRUFBeUM7QUFDdER0QyxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRS9HLFVBQU07QUFBUixJQURrQztBQUV0RHlKLFNBQU0xRCxNQUZnRDtBQUd0RDJELFVBQU96RCxLQUgrQztBQUl0RGU7QUFKc0QsR0FBekMsRUFLWDJDLEtBTFcsRUFBZDtBQU9BLFNBQU94TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDMEwsUUFEZ0M7QUFFaENyRCxVQUFPcUQsTUFBTTNJLE1BRm1CO0FBR2hDb0YsU0FIZ0M7QUFJaEM2RCxVQUFPek0sV0FBV3FKLE1BQVgsQ0FBa0IrQyxPQUFsQixDQUEwQkMsSUFBMUIsQ0FBK0JILFFBQS9CLEVBQXlDcEQsS0FBekM7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQTFCbUUsQ0FBckU7QUE2QkE5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLDBCQUEzQixFQUF1RDtBQUFFNkMsZUFBYztBQUFoQixDQUF2RCxFQUErRTtBQUM5RS9ELE9BQU07QUFDTCxNQUFJLENBQUNGLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMscUJBQTVDLENBQUwsRUFBeUU7QUFDeEUsVUFBT3BGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUVELFFBQU1pSyxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDc0Isb0JBQWlCO0FBQWpELEdBQXRCLENBQW5CO0FBRUEsTUFBSWlDLDJCQUEyQixJQUEvQjs7QUFDQSxNQUFJLE9BQU8sS0FBS2xFLFdBQUwsQ0FBaUJrRSx3QkFBeEIsS0FBcUQsV0FBekQsRUFBc0U7QUFDckVBLDhCQUEyQixLQUFLbEUsV0FBTCxDQUFpQmtFLHdCQUFqQixLQUE4QyxNQUF6RTtBQUNBOztBQUVELE1BQUlSLFdBQVc7QUFDZDFKLFlBQVUsSUFBSTBJLFdBQVdySSxJQUFNO0FBRGpCLEdBQWY7O0FBSUEsTUFBSTZKLHdCQUFKLEVBQThCO0FBQzdCUixZQUFTMUosT0FBVCxHQUFtQjtBQUNsQm1LLFNBQUssQ0FBQ1QsU0FBUzFKLE9BQVYsRUFBbUIscUJBQW5CO0FBRGEsSUFBbkI7QUFHQTs7QUFFRCxRQUFNO0FBQUVvRyxTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQyxTQUFSO0FBQWdCUTtBQUFoQixNQUEwQixLQUFLNEIsY0FBTCxFQUFoQztBQUVBQyxhQUFXdkssT0FBT3lJLE1BQVAsQ0FBYyxFQUFkLEVBQWtCQyxLQUFsQixFQUF5QjZCLFFBQXpCLENBQVg7QUFFQSxRQUFNVSxlQUFlNU0sV0FBV3FKLE1BQVgsQ0FBa0J3RCxZQUFsQixDQUErQlIsSUFBL0IsQ0FBb0NILFFBQXBDLEVBQThDO0FBQ2xFdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUVrRCxnQkFBWTtBQUFkLElBRDhDO0FBRWxFUixTQUFNMUQsTUFGNEQ7QUFHbEUyRCxVQUFPekQsS0FIMkQ7QUFJbEVlO0FBSmtFLEdBQTlDLEVBS2xCMkMsS0FMa0IsRUFBckI7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ21NLGVBRGdDO0FBRWhDOUQsVUFBTzhELGFBQWFwSixNQUZZO0FBR2hDb0YsU0FIZ0M7QUFJaEM2RCxVQUFPek0sV0FBV3FKLE1BQVgsQ0FBa0J3RCxZQUFsQixDQUErQlIsSUFBL0IsQ0FBb0NILFFBQXBDLEVBQThDcEQsS0FBOUM7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQXpDNkUsQ0FBL0U7QUE0Q0E5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGtCQUEzQixFQUErQztBQUFFNkMsZUFBYztBQUFoQixDQUEvQyxFQUF1RTtBQUN0RS9ELE9BQU07QUFDTCxRQUFNZ0wsYUFBYVYsc0JBQXNCO0FBQUV0QixXQUFRLEtBQUtDLGFBQUwsRUFBVjtBQUFnQ3NCLG9CQUFpQjtBQUFqRCxHQUF0QixDQUFuQjtBQUVBLE1BQUlzQyxhQUFhLElBQUl2QixJQUFKLEVBQWpCOztBQUNBLE1BQUksS0FBS2hELFdBQUwsQ0FBaUI4QyxNQUFyQixFQUE2QjtBQUM1QnlCLGdCQUFhLElBQUl2QixJQUFKLENBQVMsS0FBS2hELFdBQUwsQ0FBaUI4QyxNQUExQixDQUFiO0FBQ0E7O0FBRUQsTUFBSTBCLGFBQWEvRixTQUFqQjs7QUFDQSxNQUFJLEtBQUt1QixXQUFMLENBQWlCK0MsTUFBckIsRUFBNkI7QUFDNUJ5QixnQkFBYSxJQUFJeEIsSUFBSixDQUFTLEtBQUtoRCxXQUFMLENBQWlCK0MsTUFBMUIsQ0FBYjtBQUNBOztBQUVELE1BQUlFLFlBQVksS0FBaEI7O0FBQ0EsTUFBSSxLQUFLakQsV0FBTCxDQUFpQmlELFNBQXJCLEVBQWdDO0FBQy9CQSxlQUFZLEtBQUtqRCxXQUFMLENBQWlCaUQsU0FBN0I7QUFDQTs7QUFFRCxNQUFJM0MsUUFBUSxFQUFaOztBQUNBLE1BQUksS0FBS04sV0FBTCxDQUFpQk0sS0FBckIsRUFBNEI7QUFDM0JBLFdBQVFELFNBQVMsS0FBS0wsV0FBTCxDQUFpQk0sS0FBMUIsQ0FBUjtBQUNBOztBQUVELE1BQUltRSxVQUFVLEtBQWQ7O0FBQ0EsTUFBSSxLQUFLekUsV0FBTCxDQUFpQnlFLE9BQXJCLEVBQThCO0FBQzdCQSxhQUFVLEtBQUt6RSxXQUFMLENBQWlCeUUsT0FBM0I7QUFDQTs7QUFFRCxNQUFJdk0sTUFBSjtBQUNBa0UsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkMxRSxZQUFTa0UsT0FBT0MsSUFBUCxDQUFZLG1CQUFaLEVBQWlDO0FBQUVrSCxTQUFLYixXQUFXaEcsR0FBbEI7QUFBdUJvRyxZQUFReUIsVUFBL0I7QUFBMkN4QixZQUFReUIsVUFBbkQ7QUFBK0R2QixhQUEvRDtBQUEwRTNDLFNBQTFFO0FBQWlGbUU7QUFBakYsSUFBakMsQ0FBVDtBQUNBLEdBRkQ7O0FBSUEsTUFBSSxDQUFDdk0sTUFBTCxFQUFhO0FBQ1osVUFBT1YsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0E7O0FBRUQsU0FBT2pCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEJDLE1BQTFCLENBQVA7QUFDQTs7QUF2Q3FFLENBQXZFO0FBMENBVixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGVBQTNCLEVBQTRDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTVDLEVBQW9FO0FBQ25FL0QsT0FBTTtBQUNMLFFBQU1nTCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDc0Isb0JBQWlCO0FBQWpELEdBQXRCLENBQW5CO0FBRUEsU0FBT3pLLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrQixZQUFTeEMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2hHLEdBQS9DLEVBQW9EO0FBQUUyRSxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUFwRDtBQUR1QixHQUExQixDQUFQO0FBR0E7O0FBUGtFLENBQXBFO0FBVUEyQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGlCQUEzQixFQUE4QztBQUFFNkMsZUFBYztBQUFoQixDQUE5QyxFQUFzRTtBQUNyRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUEsUUFBTWpHLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksZUFBWixFQUE2QjtBQUFFa0gsU0FBS2IsV0FBV2hHLEdBQWxCO0FBQXVCL0IsY0FBVUQsS0FBS0M7QUFBdEMsSUFBN0I7QUFDQSxHQUZEO0FBSUEsU0FBT25ELFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrQixZQUFTeEMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2hHLEdBQS9DLEVBQW9EO0FBQUUyRSxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUFwRDtBQUR1QixHQUExQixDQUFQO0FBR0E7O0FBYm9FLENBQXRFO0FBZ0JBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixlQUEzQixFQUE0QztBQUFFNkMsZUFBYztBQUFoQixDQUE1QyxFQUFvRTtBQUNuRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUF2RSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLFVBQVosRUFBd0JxRyxXQUFXaEcsR0FBbkMsRUFBd0MsS0FBS2pDLFVBQUwsQ0FBZ0IzRSxRQUF4RDtBQUNBLEdBRkQ7QUFJQSxTQUFPMEIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQytCLFlBQVN4QyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0MyQixXQUFXaEcsR0FBL0MsRUFBb0Q7QUFBRTJFLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFYa0UsQ0FBcEU7QUFjQTJCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZUFBM0IsRUFBNEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBNUMsRUFBb0U7QUFDbkVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYVYsc0JBQXNCO0FBQUV0QixXQUFRLEtBQUtDLGFBQUw7QUFBVixHQUF0QixDQUFuQjtBQUVBLFFBQU1qRyxPQUFPLEtBQUttSSxpQkFBTCxFQUFiO0FBRUF6RyxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLG9CQUFaLEVBQWtDO0FBQUVrSCxTQUFLYixXQUFXaEcsR0FBbEI7QUFBdUIvQixjQUFVRCxLQUFLQztBQUF0QyxJQUFsQztBQUNBLEdBRkQ7QUFJQSxTQUFPbkQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQytCLFlBQVN4QyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0MyQixXQUFXaEcsR0FBL0MsRUFBb0Q7QUFBRTJFLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFia0UsQ0FBcEU7QUFnQkEyQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGdCQUEzQixFQUE2QztBQUFFNkMsZUFBYztBQUFoQixDQUE3QyxFQUFxRTtBQUNwRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUF2RSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLFdBQVosRUFBeUJxRyxXQUFXaEcsR0FBcEM7QUFDQSxHQUZEO0FBSUEsU0FBT2xGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrQixZQUFTeEMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2hHLEdBQS9DLEVBQW9EO0FBQUUyRSxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUFwRDtBQUR1QixHQUExQixDQUFQO0FBR0E7O0FBWG1FLENBQXJFO0FBY0EyQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGVBQTNCLEVBQTRDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTVDLEVBQW9FO0FBQ25FL0QsTUFBSztBQUNKO0FBQ0EyQixXQUFTO0FBQ1IsU0FBTTtBQUFFK0csVUFBRjtBQUFVRTtBQUFWLE9BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFNBQU07QUFBRXBDLFFBQUY7QUFBUUMsVUFBUjtBQUFnQlE7QUFBaEIsT0FBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxTQUFNQyxXQUFXdkssT0FBT3lJLE1BQVAsQ0FBYyxFQUFkLEVBQWtCQyxLQUFsQixFQUF5QjtBQUFFVyxPQUFHO0FBQUwsSUFBekIsQ0FBakIsQ0FKUSxDQU1SOztBQUNBLE9BQUloTCxXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLGtCQUE1QyxDQUFKLEVBQXFFO0FBQ3BFOEcsYUFBU3hOLFNBQVQsR0FBcUI7QUFDcEJpTyxVQUFLLENBQUUsS0FBS3pKLElBQUwsQ0FBVUMsUUFBWjtBQURlLEtBQXJCO0FBR0EsSUFKRCxNQUlPLElBQUksQ0FBQ25ELFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsYUFBNUMsQ0FBTCxFQUFpRTtBQUN2RSxXQUFPcEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0E7O0FBRUQsU0FBTWlNLFFBQVFsTixXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdUIsSUFBeEIsQ0FBNkJILFFBQTdCLEVBQXVDO0FBQ3BEdEMsVUFBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUUvRyxXQUFNO0FBQVIsS0FEZ0M7QUFFcER5SixVQUFNMUQsTUFGOEM7QUFHcEQyRCxXQUFPekQsS0FINkM7QUFJcERlO0FBSm9ELElBQXZDLEVBS1gyQyxLQUxXLEVBQWQ7QUFPQSxVQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2dDLGNBQVV5SyxLQURzQjtBQUVoQ3BFLFdBQU9vRSxNQUFNMUosTUFGbUI7QUFHaENvRixVQUhnQztBQUloQzZELFdBQU96TSxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdUIsSUFBeEIsQ0FBNkJILFFBQTdCLEVBQXVDcEQsS0FBdkM7QUFKeUIsSUFBMUIsQ0FBUDtBQU1BOztBQTlCRztBQUQ4RCxDQUFwRTtBQW1DQTlJLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsc0JBQTNCLEVBQW1EO0FBQUU2QyxlQUFjO0FBQWhCLENBQW5ELEVBQTJFO0FBQzFFL0QsT0FBTTtBQUNMLFFBQU07QUFBRTBJLFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQyxPQUFGO0FBQVFDO0FBQVIsTUFBbUIsS0FBS29DLGNBQUwsRUFBekI7O0FBQ0EsTUFBSWlCLFFBQVE5UCxFQUFFK1AsS0FBRixDQUFRbk4sV0FBV3FKLE1BQVgsQ0FBa0JzQyxhQUFsQixDQUFnQ3lCLG1CQUFoQyxDQUFvRCxHQUFwRCxFQUF5RCxLQUFLaEksTUFBOUQsRUFBc0VvSCxLQUF0RSxFQUFSLEVBQXVGLE9BQXZGLENBQVo7O0FBQ0EsUUFBTWEsYUFBYUgsTUFBTTFKLE1BQXpCO0FBRUEwSixVQUFRbE4sV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QndDLDJCQUF4QixDQUFvREosS0FBcEQsRUFBMkQ7QUFDbEV0RCxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRS9HLFVBQU07QUFBUixJQUQ4QztBQUVsRXlKLFNBQU0xRCxNQUY0RDtBQUdsRTJELFVBQU96RCxLQUgyRDtBQUlsRWU7QUFKa0UsR0FBM0QsQ0FBUjtBQU9BLFNBQU83SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDZ0MsYUFBVXlLLEtBRHNCO0FBRWhDdEUsU0FGZ0M7QUFHaENFLFVBQU9vRSxNQUFNMUosTUFIbUI7QUFJaENpSixVQUFPWTtBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBcEJ5RSxDQUEzRTtBQXVCQXJOLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsa0JBQTNCLEVBQStDO0FBQUU2QyxlQUFjO0FBQWhCLENBQS9DLEVBQXVFO0FBQ3RFL0QsT0FBTTtBQUNMLFFBQU1nTCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDc0Isb0JBQWlCLEtBQWpEO0FBQXdEQyxvQkFBaUI7QUFBekUsR0FBdEIsQ0FBbkI7QUFFQSxRQUFNO0FBQUU5QixTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEM7QUFBRixNQUFXLEtBQUtxQyxjQUFMLEVBQWpCOztBQUVBLE1BQUlzQixTQUFTLENBQUNDLENBQUQsRUFBSUMsQ0FBSixLQUFVRCxJQUFJQyxDQUEzQjs7QUFDQSxNQUFJQyxNQUFNbkwsSUFBTixDQUFXcUgsSUFBWCxFQUFpQmpJLE1BQWpCLEtBQTRCK0wsTUFBTW5MLElBQU4sQ0FBV3FILEtBQUt6RyxRQUFoQixFQUEwQndLLE1BQTFCLENBQTVCLElBQWlFL0QsS0FBS3pHLFFBQUwsS0FBa0IsQ0FBQyxDQUF4RixFQUEyRjtBQUMxRm9LLFlBQVMsQ0FBQ0MsQ0FBRCxFQUFJQyxDQUFKLEtBQVVBLElBQUlELENBQXZCO0FBQ0E7O0FBRUQsUUFBTS9PLFVBQVV1QixXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCd0MsMkJBQXhCLENBQW9ETSxNQUFNQyxJQUFOLENBQVczQyxXQUFXeE0sU0FBdEIsRUFBaUNrTCxJQUFqQyxDQUFzQzJELE1BQXRDLENBQXBELEVBQW1HO0FBQ2xIakIsU0FBTTFELE1BRDRHO0FBRWxIMkQsVUFBT3pEO0FBRjJHLEdBQW5HLENBQWhCO0FBS0EsUUFBTTlELFFBQVFoRixXQUFXcUosTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0IrQyxJQUF4QixDQUE2QjtBQUFFbEosYUFBVTtBQUFFd0osU0FBS2xPO0FBQVA7QUFBWixHQUE3QixFQUE2RDtBQUMxRW9MLFdBQVE7QUFBRTNFLFNBQUssQ0FBUDtBQUFVL0IsY0FBVSxDQUFwQjtBQUF1Qk4sVUFBTSxDQUE3QjtBQUFnQ2tDLFlBQVEsQ0FBeEM7QUFBMkMrSSxlQUFXO0FBQXRELElBRGtFO0FBRTFFbEUsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUV6RyxjQUFVO0FBQVo7QUFGc0QsR0FBN0QsRUFHWHFKLEtBSFcsRUFBZDtBQUtBLFNBQU94TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDaEMsWUFBU3VHLEtBRHVCO0FBRWhDOEQsVUFBT3JLLFFBQVErRSxNQUZpQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3ZCLFdBQVd4TSxTQUFYLENBQXFCOEU7QUFKSSxHQUExQixDQUFQO0FBTUE7O0FBNUJxRSxDQUF2RTtBQStCQXhELFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsbUJBQTNCLEVBQWdEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWhELEVBQXdFO0FBQ3ZFL0QsT0FBTTtBQUNMLFFBQU1nTCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDc0Isb0JBQWlCO0FBQWpELEdBQXRCLENBQW5CO0FBQ0EsUUFBTTtBQUFFN0IsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxRQUFNQyxXQUFXdkssT0FBT3lJLE1BQVAsQ0FBYyxFQUFkLEVBQWtCQyxLQUFsQixFQUF5QjtBQUFFMEIsUUFBS2IsV0FBV2hHO0FBQWxCLEdBQXpCLENBQWpCLENBTEssQ0FPTDs7QUFDQSxNQUFJbEYsV0FBVytKLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCLEtBQUs1RSxNQUFwQyxFQUE0QyxrQkFBNUMsS0FBbUUsQ0FBQzhGLFdBQVd4TSxTQUFYLENBQXFCZ0YsUUFBckIsQ0FBOEIsS0FBS1IsSUFBTCxDQUFVQyxRQUF4QyxDQUF4RSxFQUEySDtBQUMxSCxVQUFPbkQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0EsR0FGRCxNQUVPLElBQUksQ0FBQ2pCLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsYUFBNUMsQ0FBTCxFQUFpRTtBQUN2RSxVQUFPcEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0E7O0FBRUQsUUFBTThNLFdBQVcvTixXQUFXcUosTUFBWCxDQUFrQjJFLFFBQWxCLENBQTJCM0IsSUFBM0IsQ0FBZ0NILFFBQWhDLEVBQTBDO0FBQzFEdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUVxRSxRQUFJLENBQUM7QUFBUCxJQURzQztBQUUxRDNCLFNBQU0xRCxNQUZvRDtBQUcxRDJELFVBQU96RCxLQUhtRDtBQUkxRGU7QUFKMEQsR0FBMUMsRUFLZDJDLEtBTGMsRUFBakI7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3NOLFdBRGdDO0FBRWhDakYsVUFBT2lGLFNBQVN2SyxNQUZnQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCMkUsUUFBbEIsQ0FBMkIzQixJQUEzQixDQUFnQ0gsUUFBaEMsRUFBMENwRCxLQUExQztBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBNUJzRSxDQUF4RTtBQStCQTlJLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsaUJBQTNCLEVBQThDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTlDLEVBQXNFO0FBQ3JFL0QsT0FBTTtBQUNMLFFBQU07QUFBRW1LO0FBQUYsTUFBWSxLQUFLNEIsY0FBTCxFQUFsQjtBQUNBLFFBQU1DLFdBQVd2SyxPQUFPeUksTUFBUCxDQUFjLEVBQWQsRUFBa0JDLEtBQWxCLEVBQXlCO0FBQUVXLE1BQUc7QUFBTCxHQUF6QixDQUFqQjtBQUVBLFFBQU1ILE9BQU83SyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCN0YsT0FBeEIsQ0FBZ0NpSCxRQUFoQyxDQUFiOztBQUVBLE1BQUlyQixRQUFRLElBQVosRUFBa0I7QUFDakIsVUFBTzdLLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIseUJBQTFCLENBQVA7QUFDQTs7QUFFRCxRQUFNb04sU0FBU2xPLFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QjZFLG1CQUF4QixDQUE0QztBQUMxRHRFLFdBQVE7QUFDUDFHLGNBQVU7QUFESDtBQURrRCxHQUE1QyxFQUlacUosS0FKWSxFQUFmO0FBTUEsUUFBTTRCLGVBQWUsRUFBckI7QUFDQUYsU0FBT3pNLE9BQVAsQ0FBZXlCLFFBQVE7QUFDdEIsT0FBSTJILEtBQUtuTSxTQUFMLENBQWUyUCxPQUFmLENBQXVCbkwsS0FBS0MsUUFBNUIsTUFBMEMsQ0FBQyxDQUEvQyxFQUFrRDtBQUNqRGlMLGlCQUFhNU4sSUFBYixDQUFrQjtBQUNqQjBFLFVBQUtoQyxLQUFLZ0MsR0FETztBQUVqQi9CLGVBQVVELEtBQUtDO0FBRkUsS0FBbEI7QUFJQTtBQUNELEdBUEQ7QUFTQSxTQUFPbkQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3lOLFdBQVFFO0FBRHdCLEdBQTFCLENBQVA7QUFHQTs7QUE5Qm9FLENBQXRFO0FBaUNBcE8sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixlQUEzQixFQUE0QztBQUFFNkMsZUFBYztBQUFoQixDQUE1QyxFQUFvRTtBQUNuRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDc0Isb0JBQWlCO0FBQWpELEdBQXRCLENBQW5CO0FBRUEsUUFBTWlCLE1BQU0xTCxXQUFXcUosTUFBWCxDQUFrQnNDLGFBQWxCLENBQWdDQyx3QkFBaEMsQ0FBeURWLFdBQVdoRyxHQUFwRSxFQUF5RSxLQUFLRSxNQUE5RSxDQUFaOztBQUVBLE1BQUksQ0FBQ3NHLEdBQUwsRUFBVTtBQUNULFVBQU8xTCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTJCLDBDQUEwQ29LLFdBQVdySSxJQUFNLElBQXRGLENBQVA7QUFDQTs7QUFFRCxNQUFJNkksSUFBSUcsSUFBUixFQUFjO0FBQ2IsVUFBTzdMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMkIsZ0JBQWdCb0ssV0FBV3JJLElBQU0saUNBQTVELENBQVA7QUFDQTs7QUFFRCtCLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksVUFBWixFQUF3QnFHLFdBQVdoRyxHQUFuQztBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBbkJrRSxDQUFwRTtBQXNCQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQiwwQkFBM0IsRUFBdUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBdkQsRUFBK0U7QUFDOUVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYVYsc0JBQXNCO0FBQUV0QixXQUFRLEtBQUtDLGFBQUw7QUFBVixHQUF0QixDQUFuQjtBQUVBLFFBQU1qRyxPQUFPLEtBQUttSSxpQkFBTCxFQUFiO0FBRUF6RyxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLHFCQUFaLEVBQW1DcUcsV0FBV2hHLEdBQTlDLEVBQW1EaEMsS0FBS2dDLEdBQXhEO0FBQ0EsR0FGRDtBQUlBLFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFYNkUsQ0FBL0U7QUFjQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixzQkFBM0IsRUFBbUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBbkQsRUFBMkU7QUFDMUVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYVYsc0JBQXNCO0FBQUV0QixXQUFRLEtBQUtDLGFBQUw7QUFBVixHQUF0QixDQUFuQjtBQUVBLFFBQU1qRyxPQUFPLEtBQUttSSxpQkFBTCxFQUFiO0FBRUF6RyxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGlCQUFaLEVBQStCcUcsV0FBV2hHLEdBQTFDLEVBQStDaEMsS0FBS2dDLEdBQXBEO0FBQ0EsR0FGRDtBQUlBLFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFYeUUsQ0FBM0U7QUFjQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixpQkFBM0IsRUFBOEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBOUMsRUFBc0U7QUFDckVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0JKLElBQWpCLElBQXlCLENBQUMsS0FBS0ksVUFBTCxDQUFnQkosSUFBaEIsQ0FBcUJ1RyxJQUFyQixFQUE5QixFQUEyRDtBQUMxRCxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixrQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVE7QUFBRXlCLFlBQVEsS0FBSzFILFVBQUwsQ0FBZ0IwSDtBQUExQjtBQUFWLEdBQXRCLENBQW5COztBQUVBLE1BQUlPLFdBQVdySSxJQUFYLEtBQW9CLEtBQUtJLFVBQUwsQ0FBZ0JKLElBQXhDLEVBQThDO0FBQzdDLFVBQU83QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLDhEQUExQixDQUFQO0FBQ0E7O0FBRUQ4RCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELFVBQWhELEVBQTRELEtBQUtqQyxVQUFMLENBQWdCSixJQUE1RTtBQUNBLEdBRkQ7QUFJQSxTQUFPN0MsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQytCLFlBQVN4QyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0MyQixXQUFXaEcsR0FBL0MsRUFBb0Q7QUFBRTJFLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFuQm9FLENBQXRFO0FBc0JBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQix5QkFBM0IsRUFBc0Q7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBdEQsRUFBOEU7QUFDN0VDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0JxTCxXQUFqQixJQUFnQyxDQUFDLEtBQUtyTCxVQUFMLENBQWdCcUwsV0FBaEIsQ0FBNEJsRixJQUE1QixFQUFyQyxFQUF5RTtBQUN4RSxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix5Q0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5COztBQUVBLE1BQUkrQixXQUFXb0QsV0FBWCxLQUEyQixLQUFLckwsVUFBTCxDQUFnQnFMLFdBQS9DLEVBQTREO0FBQzNELFVBQU90TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHFFQUExQixDQUFQO0FBQ0E7O0FBRUQ4RCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELGlCQUFoRCxFQUFtRSxLQUFLakMsVUFBTCxDQUFnQnFMLFdBQW5GO0FBQ0EsR0FGRDtBQUlBLFNBQU90TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDNk4sZ0JBQWEsS0FBS3JMLFVBQUwsQ0FBZ0JxTDtBQURHLEdBQTFCLENBQVA7QUFHQTs7QUFuQjRFLENBQTlFO0FBc0JBdE8sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixzQkFBM0IsRUFBbUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBbkQsRUFBMkU7QUFDMUVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0IzRSxRQUFqQixJQUE2QixDQUFDLEtBQUsyRSxVQUFMLENBQWdCM0UsUUFBaEIsQ0FBeUI4SyxJQUF6QixFQUFsQyxFQUFtRTtBQUNsRSxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixzQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5CO0FBRUF2RSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELFVBQWhELEVBQTRELEtBQUtqQyxVQUFMLENBQWdCM0UsUUFBNUU7QUFDQSxHQUZEO0FBSUEsU0FBTzBCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrQixZQUFTeEMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2hHLEdBQS9DLEVBQW9EO0FBQUUyRSxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUFwRDtBQUR1QixHQUExQixDQUFQO0FBR0E7O0FBZnlFLENBQTNFO0FBa0JBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixxQkFBM0IsRUFBa0Q7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBbEQsRUFBMEU7QUFDekVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0JzTCxPQUFqQixJQUE0QixDQUFDLEtBQUt0TCxVQUFMLENBQWdCc0wsT0FBaEIsQ0FBd0JuRixJQUF4QixFQUFqQyxFQUFpRTtBQUNoRSxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixxQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5COztBQUVBLE1BQUkrQixXQUFXb0QsV0FBWCxLQUEyQixLQUFLckwsVUFBTCxDQUFnQnNMLE9BQS9DLEVBQXdEO0FBQ3ZELFVBQU92TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLCtFQUExQixDQUFQO0FBQ0E7O0FBRUQ4RCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELGlCQUFoRCxFQUFtRSxLQUFLakMsVUFBTCxDQUFnQnNMLE9BQW5GO0FBQ0EsR0FGRDtBQUlBLFNBQU92TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDOE4sWUFBUyxLQUFLdEwsVUFBTCxDQUFnQnNMO0FBRE8sR0FBMUIsQ0FBUDtBQUdBOztBQW5Cd0UsQ0FBMUU7QUFzQkF2TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHNCQUEzQixFQUFtRDtBQUFFNkMsZUFBYztBQUFoQixDQUFuRCxFQUEyRTtBQUMxRUMsUUFBTztBQUNOLE1BQUksT0FBTyxLQUFLakIsVUFBTCxDQUFnQjZJLFFBQXZCLEtBQW9DLFdBQXhDLEVBQXFEO0FBQ3BELFVBQU85TCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHNDQUExQixDQUFQO0FBQ0E7O0FBRUQsUUFBTW9LLGFBQWFWLHNCQUFzQjtBQUFFdEIsV0FBUSxLQUFLQyxhQUFMO0FBQVYsR0FBdEIsQ0FBbkI7O0FBRUEsTUFBSStCLFdBQVdzRCxFQUFYLEtBQWtCLEtBQUt2TCxVQUFMLENBQWdCNkksUUFBdEMsRUFBZ0Q7QUFDL0MsVUFBTzlMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsMkVBQTFCLENBQVA7QUFDQTs7QUFFRDhELFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksa0JBQVosRUFBZ0NxRyxXQUFXaEcsR0FBM0MsRUFBZ0QsVUFBaEQsRUFBNEQsS0FBS2pDLFVBQUwsQ0FBZ0I2SSxRQUE1RTtBQUNBLEdBRkQ7QUFJQSxTQUFPOUwsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQytCLFlBQVN4QyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0MyQixXQUFXaEcsR0FBL0MsRUFBb0Q7QUFBRTJFLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFuQnlFLENBQTNFO0FBc0JBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixtQkFBM0IsRUFBZ0Q7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBaEQsRUFBd0U7QUFDdkVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0J3TCxLQUFqQixJQUEwQixDQUFDLEtBQUt4TCxVQUFMLENBQWdCd0wsS0FBaEIsQ0FBc0JyRixJQUF0QixFQUEvQixFQUE2RDtBQUM1RCxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixtQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhVixzQkFBc0I7QUFBRXRCLFdBQVEsS0FBS0MsYUFBTDtBQUFWLEdBQXRCLENBQW5COztBQUVBLE1BQUkrQixXQUFXdUQsS0FBWCxLQUFxQixLQUFLeEwsVUFBTCxDQUFnQndMLEtBQXpDLEVBQWdEO0FBQy9DLFVBQU96TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLCtEQUExQixDQUFQO0FBQ0E7O0FBRUQ4RCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELFdBQWhELEVBQTZELEtBQUtqQyxVQUFMLENBQWdCd0wsS0FBN0U7QUFDQSxHQUZEO0FBSUEsU0FBT3pPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENnTyxVQUFPLEtBQUt4TCxVQUFMLENBQWdCd0w7QUFEUyxHQUExQixDQUFQO0FBR0E7O0FBbkJzRSxDQUF4RTtBQXNCQXpPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsa0JBQTNCLEVBQStDO0FBQUU2QyxlQUFjO0FBQWhCLENBQS9DLEVBQXVFO0FBQ3RFQyxRQUFPO0FBQ04sTUFBSSxDQUFDLEtBQUtqQixVQUFMLENBQWdCa0YsSUFBakIsSUFBeUIsQ0FBQyxLQUFLbEYsVUFBTCxDQUFnQmtGLElBQWhCLENBQXFCaUIsSUFBckIsRUFBOUIsRUFBMkQ7QUFDMUQsVUFBT3BKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsa0NBQTFCLENBQVA7QUFDQTs7QUFFRCxRQUFNb0ssYUFBYVYsc0JBQXNCO0FBQUV0QixXQUFRLEtBQUtDLGFBQUw7QUFBVixHQUF0QixDQUFuQjs7QUFFQSxNQUFJK0IsV0FBV0YsQ0FBWCxLQUFpQixLQUFLL0gsVUFBTCxDQUFnQmtGLElBQXJDLEVBQTJDO0FBQzFDLFVBQU9uSSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLDhEQUExQixDQUFQO0FBQ0E7O0FBRUQ4RCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2hHLEdBQTNDLEVBQWdELFVBQWhELEVBQTRELEtBQUtqQyxVQUFMLENBQWdCa0YsSUFBNUU7QUFDQSxHQUZEO0FBSUEsU0FBT25JLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrQixZQUFTeEMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2hHLEdBQS9DLEVBQW9EO0FBQUUyRSxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUFwRDtBQUR1QixHQUExQixDQUFQO0FBR0E7O0FBbkJxRSxDQUF2RTtBQXNCQTJCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsb0JBQTNCLEVBQWlEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWpELEVBQXlFO0FBQ3hFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFWLHNCQUFzQjtBQUFFdEIsV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0NzQixvQkFBaUI7QUFBakQsR0FBdEIsQ0FBbkI7O0FBRUEsTUFBSSxDQUFDUyxXQUFXRCxRQUFoQixFQUEwQjtBQUN6QixVQUFPakwsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEyQixnQkFBZ0JvSyxXQUFXckksSUFBTSxtQkFBNUQsQ0FBUDtBQUNBOztBQUVEK0IsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxlQUFaLEVBQTZCcUcsV0FBV2hHLEdBQXhDO0FBQ0EsR0FGRDtBQUlBLFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFidUUsQ0FBekUsRTs7Ozs7Ozs7Ozs7QUNqdEJBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLFdBQTNCLEVBQXdDO0FBQUU2QyxlQUFjO0FBQWhCLENBQXhDLEVBQWdFO0FBQy9EL0QsT0FBTTtBQUNMLFFBQU07QUFBRXdPO0FBQUYsTUFBbUIsS0FBS2xHLFdBQTlCO0FBRUEsTUFBSW1HLGdCQUFKOztBQUNBLE1BQUlELFlBQUosRUFBa0I7QUFDakIsT0FBSUUsTUFBTXBELEtBQUtwRSxLQUFMLENBQVdzSCxZQUFYLENBQU4sQ0FBSixFQUFxQztBQUNwQyxVQUFNLElBQUk5SixPQUFPNkUsS0FBWCxDQUFpQixrQ0FBakIsRUFBcUQsMERBQXJELENBQU47QUFDQSxJQUZELE1BRU87QUFDTmtGLHVCQUFtQixJQUFJbkQsSUFBSixDQUFTa0QsWUFBVCxDQUFuQjtBQUNBO0FBQ0Q7O0FBRUQsTUFBSWhPLE1BQUo7QUFDQWtFLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNMUUsU0FBU2tFLE9BQU9DLElBQVAsQ0FBWSxXQUFaLEVBQXlCOEosZ0JBQXpCLENBQTdDOztBQUVBLE1BQUlmLE1BQU1wTSxPQUFOLENBQWNkLE1BQWQsQ0FBSixFQUEyQjtBQUMxQkEsWUFBUztBQUNSMkUsWUFBUTNFLE1BREE7QUFFUm1PLFlBQVE7QUFGQSxJQUFUO0FBSUE7O0FBRUQsU0FBTzdPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEJDLE1BQTFCLENBQVA7QUFDQTs7QUF4QjhELENBQWhFO0FBMkJBVixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG1CQUEzQixFQUFnRDtBQUFFNkMsZUFBYztBQUFoQixDQUFoRCxFQUF3RTtBQUN2RUMsUUFBTztBQUNOLFFBQU0yRyxPQUFPakcsT0FBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkIsS0FBS2lLLFNBQUwsQ0FBZS9DLEdBQTVDLEVBQWlELEtBQUszRyxNQUF0RCxDQUFiOztBQUVBLE1BQUksQ0FBQ3lGLElBQUwsRUFBVztBQUNWLFVBQU83SyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxRQUFNOE4sU0FBU0MsSUFBSXpSLE9BQUosQ0FBWSxRQUFaLENBQWY7O0FBQ0EsUUFBTTBSLFNBQVMsSUFBSUYsTUFBSixDQUFXO0FBQUVoUCxZQUFTLEtBQUtGLE9BQUwsQ0FBYUU7QUFBeEIsR0FBWCxDQUFmO0FBQ0EsUUFBTW9NLFFBQVEsRUFBZDtBQUNBLFFBQU10QyxTQUFTLEVBQWY7QUFFQWpGLFNBQU9zSyxTQUFQLENBQWtCQyxRQUFELElBQWM7QUFDOUJGLFVBQU9HLEVBQVAsQ0FBVSxNQUFWLEVBQWtCLENBQUNDLFNBQUQsRUFBWUMsSUFBWixFQUFrQkMsUUFBbEIsRUFBNEJDLFFBQTVCLEVBQXNDQyxRQUF0QyxLQUFtRDtBQUNwRSxRQUFJSixjQUFjLE1BQWxCLEVBQTBCO0FBQ3pCLFlBQU9sRCxNQUFNM0wsSUFBTixDQUFXLElBQUlvRSxPQUFPNkUsS0FBWCxDQUFpQixlQUFqQixDQUFYLENBQVA7QUFDQTs7QUFFRCxVQUFNaUcsV0FBVyxFQUFqQjtBQUNBSixTQUFLRixFQUFMLENBQVEsTUFBUixFQUFnQjFKLFFBQVFnSyxTQUFTbFAsSUFBVCxDQUFja0YsSUFBZCxDQUF4QjtBQUVBNEosU0FBS0YsRUFBTCxDQUFRLEtBQVIsRUFBZSxNQUFNO0FBQ3BCakQsV0FBTTNMLElBQU4sQ0FBVztBQUFFNk8sZUFBRjtBQUFhQyxVQUFiO0FBQW1CQyxjQUFuQjtBQUE2QkMsY0FBN0I7QUFBdUNDLGNBQXZDO0FBQWlERSxrQkFBWUMsT0FBTzNGLE1BQVAsQ0FBY3lGLFFBQWQ7QUFBN0QsTUFBWDtBQUNBLEtBRkQ7QUFHQSxJQVhEO0FBYUFULFVBQU9HLEVBQVAsQ0FBVSxPQUFWLEVBQW1CLENBQUNDLFNBQUQsRUFBWXRILEtBQVosS0FBc0I4QixPQUFPd0YsU0FBUCxJQUFvQnRILEtBQTdEO0FBRUFrSCxVQUFPRyxFQUFQLENBQVUsUUFBVixFQUFvQnhLLE9BQU9pTCxlQUFQLENBQXVCLE1BQU1WLFVBQTdCLENBQXBCO0FBRUEsUUFBS3RQLE9BQUwsQ0FBYWlRLElBQWIsQ0FBa0JiLE1BQWxCO0FBQ0EsR0FuQkQ7O0FBcUJBLE1BQUk5QyxNQUFNM0ksTUFBTixLQUFpQixDQUFyQixFQUF3QjtBQUN2QixVQUFPeEQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixlQUExQixDQUFQO0FBQ0E7O0FBRUQsTUFBSXFMLE1BQU0zSSxNQUFOLEdBQWUsQ0FBbkIsRUFBc0I7QUFDckIsVUFBT3hELFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsd0JBQTFCLENBQVA7QUFDQTs7QUFFRCxRQUFNd08sT0FBT25ELE1BQU0sQ0FBTixDQUFiO0FBRUEsUUFBTTRELFlBQVlDLFdBQVdDLFFBQVgsQ0FBb0IsU0FBcEIsQ0FBbEI7QUFFQSxRQUFNQyxVQUFVO0FBQ2ZyTixTQUFNeU0sS0FBS0MsUUFESTtBQUVmWSxTQUFNYixLQUFLSyxVQUFMLENBQWdCbk0sTUFGUDtBQUdmMkUsU0FBTW1ILEtBQUtHLFFBSEk7QUFJZjFELFFBQUssS0FBSytDLFNBQUwsQ0FBZS9DO0FBSkwsR0FBaEI7QUFPQW5ILFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DLFNBQU1nTCxlQUFleEwsT0FBT3NLLFNBQVAsQ0FBaUJhLFVBQVVNLE1BQVYsQ0FBaUJDLElBQWpCLENBQXNCUCxTQUF0QixDQUFqQixFQUFtREcsT0FBbkQsRUFBNERaLEtBQUtLLFVBQWpFLENBQXJCO0FBRUFTLGdCQUFhOUIsV0FBYixHQUEyQnpFLE9BQU95RSxXQUFsQztBQUVBLFVBQU96RSxPQUFPeUUsV0FBZDtBQUVBdE8sY0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQm1FLE9BQU9DLElBQVAsQ0FBWSxpQkFBWixFQUErQixLQUFLaUssU0FBTCxDQUFlL0MsR0FBOUMsRUFBbUQsSUFBbkQsRUFBeURxRSxZQUF6RCxFQUF1RXZHLE1BQXZFLENBQTFCO0FBQ0EsR0FSRDtBQVVBLFNBQU83SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFoRXNFLENBQXhFLEU7Ozs7Ozs7Ozs7O0FDM0JBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG1CQUEzQixFQUFnRDtBQUFFNkMsZUFBYztBQUFoQixDQUFoRCxFQUF3RTtBQUN2RS9ELE9BQU07QUFDTCxRQUFNO0FBQUV3TztBQUFGLE1BQW1CLEtBQUtsRyxXQUE5QjtBQUVBLE1BQUltRyxnQkFBSjs7QUFDQSxNQUFJRCxZQUFKLEVBQWtCO0FBQ2pCLE9BQUlFLE1BQU1wRCxLQUFLcEUsS0FBTCxDQUFXc0gsWUFBWCxDQUFOLENBQUosRUFBcUM7QUFDcEMsVUFBTSxJQUFJOUosT0FBTzZFLEtBQVgsQ0FBaUIsNEJBQWpCLEVBQStDLHdEQUEvQyxDQUFOO0FBQ0EsSUFGRCxNQUVPO0FBQ05rRix1QkFBbUIsSUFBSW5ELElBQUosQ0FBU2tELFlBQVQsQ0FBbkI7QUFDQTtBQUNEOztBQUVELE1BQUloTyxNQUFKO0FBQ0FrRSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTFFLFNBQVNrRSxPQUFPQyxJQUFQLENBQVksbUJBQVosRUFBaUM4SixnQkFBakMsQ0FBN0M7O0FBRUEsTUFBSWYsTUFBTXBNLE9BQU4sQ0FBY2QsTUFBZCxDQUFKLEVBQTJCO0FBQzFCQSxZQUFTO0FBQ1IyRSxZQUFRM0UsTUFEQTtBQUVSbU8sWUFBUTtBQUZBLElBQVQ7QUFJQTs7QUFFRCxTQUFPN08sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQkMsTUFBMUIsQ0FBUDtBQUNBOztBQXhCc0UsQ0FBeEUsRTs7Ozs7Ozs7Ozs7QUNBQSxrQ0FDQVYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixhQUEzQixFQUEwQztBQUFFNkMsZUFBYztBQUFoQixDQUExQyxFQUFrRTtBQUNqRUMsUUFBTztBQUNOcU0sUUFBTSxLQUFLdE4sVUFBWCxFQUF1QnlLLE1BQU04QyxlQUFOLENBQXNCO0FBQzVDQyxVQUFPQyxNQURxQztBQUU1Qy9GLFdBQVErRixNQUZvQztBQUc1Q0MsV0FBUWpELE1BQU1rRCxLQUFOLENBQVlDLE9BQVo7QUFIb0MsR0FBdEIsQ0FBdkI7QUFNQSxRQUFNM1AsTUFBTWxCLFdBQVdxSixNQUFYLENBQWtCMkUsUUFBbEIsQ0FBMkJ6RSxXQUEzQixDQUF1QyxLQUFLdEcsVUFBTCxDQUFnQndOLEtBQXZELEVBQThEO0FBQUU1RyxXQUFRO0FBQUVpSCxPQUFHLENBQUw7QUFBUS9FLFNBQUs7QUFBYjtBQUFWLEdBQTlELENBQVo7O0FBRUEsTUFBSSxDQUFDN0ssR0FBTCxFQUFVO0FBQ1QsVUFBT2xCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMkIsb0NBQW9DLEtBQUttQyxVQUFMLENBQWdCd04sS0FBTyxJQUF0RixDQUFQO0FBQ0E7O0FBRUQsTUFBSSxLQUFLeE4sVUFBTCxDQUFnQjBILE1BQWhCLEtBQTJCekosSUFBSTZLLEdBQW5DLEVBQXdDO0FBQ3ZDLFVBQU8vTCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLGdFQUExQixDQUFQO0FBQ0E7O0FBRUQsTUFBSSxLQUFLbUMsVUFBTCxDQUFnQjBOLE1BQWhCLElBQTBCelAsSUFBSTRQLENBQUosQ0FBTTVMLEdBQU4sS0FBYyxLQUFLRSxNQUE3QyxJQUF1RCxDQUFDcEYsV0FBVytKLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCcEYsT0FBT1EsTUFBUCxFQUEvQixFQUFnRCxzQkFBaEQsRUFBd0VsRSxJQUFJNkssR0FBNUUsQ0FBNUQsRUFBOEk7QUFDN0ksVUFBTy9MLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsdUdBQTFCLENBQVA7QUFDQTs7QUFFRDhELFNBQU91RyxTQUFQLENBQWlCLEtBQUtsSSxVQUFMLENBQWdCME4sTUFBaEIsR0FBeUJ6UCxJQUFJNFAsQ0FBSixDQUFNNUwsR0FBL0IsR0FBcUMsS0FBS0UsTUFBM0QsRUFBbUUsTUFBTTtBQUN4RVIsVUFBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkI7QUFBRUssU0FBS2hFLElBQUlnRTtBQUFYLElBQTdCO0FBQ0EsR0FGRDtBQUlBLFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDeUUsUUFBS2hFLElBQUlnRSxHQUR1QjtBQUVoQytJLE9BQUl6QyxLQUFLdUYsR0FBTCxFQUY0QjtBQUdoQ3pPLFlBQVNwQjtBQUh1QixHQUExQixDQUFQO0FBS0E7O0FBL0JnRSxDQUFsRTtBQWtDQWxCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsbUJBQTNCLEVBQWdEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWhELEVBQXdFO0FBQ3ZFL0QsT0FBTTtBQUNMLFFBQU07QUFBRXlLLFNBQUY7QUFBVXFHO0FBQVYsTUFBeUIsS0FBS3hJLFdBQXBDOztBQUVBLE1BQUksQ0FBQ21DLE1BQUwsRUFBYTtBQUNaLFNBQU0sSUFBSS9GLE9BQU82RSxLQUFYLENBQWlCLGlDQUFqQixFQUFvRCwrQ0FBcEQsQ0FBTjtBQUNBOztBQUVELE1BQUksQ0FBQ3VILFVBQUwsRUFBaUI7QUFDaEIsU0FBTSxJQUFJcE0sT0FBTzZFLEtBQVgsQ0FBaUIscUNBQWpCLEVBQXdELG1EQUF4RCxDQUFOO0FBQ0EsR0FGRCxNQUVPLElBQUltRixNQUFNcEQsS0FBS3BFLEtBQUwsQ0FBVzRKLFVBQVgsQ0FBTixDQUFKLEVBQW1DO0FBQ3pDLFNBQU0sSUFBSXBNLE9BQU82RSxLQUFYLENBQWlCLDRCQUFqQixFQUErQyx3REFBL0MsQ0FBTjtBQUNBOztBQUVELE1BQUkvSSxNQUFKO0FBQ0FrRSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQzFFLFlBQVNrRSxPQUFPQyxJQUFQLENBQVksY0FBWixFQUE0QjhGLE1BQTVCLEVBQW9DO0FBQUVxRyxnQkFBWSxJQUFJeEYsSUFBSixDQUFTd0YsVUFBVDtBQUFkLElBQXBDLENBQVQ7QUFDQSxHQUZEOztBQUlBLE1BQUksQ0FBQ3RRLE1BQUwsRUFBYTtBQUNaLFVBQU9WLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsRUFBUDtBQUNBOztBQUVELFNBQU9kLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENDO0FBRGdDLEdBQTFCLENBQVA7QUFHQTs7QUExQnNFLENBQXhFO0FBNkJBVixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGlCQUEzQixFQUE4QztBQUFFNkMsZUFBYztBQUFoQixDQUE5QyxFQUFzRTtBQUNyRS9ELE9BQU07QUFDTCxNQUFJLENBQUMsS0FBS3NJLFdBQUwsQ0FBaUJpSSxLQUF0QixFQUE2QjtBQUM1QixVQUFPelEsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQiwrQ0FBMUIsQ0FBUDtBQUNBOztBQUVELE1BQUlJLEdBQUo7QUFDQTBELFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DbEUsU0FBTTBELE9BQU9DLElBQVAsQ0FBWSxrQkFBWixFQUFnQyxLQUFLMkQsV0FBTCxDQUFpQmlJLEtBQWpELENBQU47QUFDQSxHQUZEOztBQUlBLE1BQUksQ0FBQ3ZQLEdBQUwsRUFBVTtBQUNULFVBQU9sQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLEVBQVA7QUFDQTs7QUFFRCxTQUFPZCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDNkIsWUFBU3BCO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFsQm9FLENBQXRFO0FBcUJBbEIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixpQkFBM0IsRUFBOEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBOUMsRUFBc0U7QUFDckVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0JnTyxTQUFqQixJQUE4QixDQUFDLEtBQUtoTyxVQUFMLENBQWdCZ08sU0FBaEIsQ0FBMEI3SCxJQUExQixFQUFuQyxFQUFxRTtBQUNwRSxTQUFNLElBQUl4RSxPQUFPNkUsS0FBWCxDQUFpQixvQ0FBakIsRUFBdUQsNENBQXZELENBQU47QUFDQTs7QUFFRCxRQUFNdkksTUFBTWxCLFdBQVdxSixNQUFYLENBQWtCMkUsUUFBbEIsQ0FBMkJ6RSxXQUEzQixDQUF1QyxLQUFLdEcsVUFBTCxDQUFnQmdPLFNBQXZELENBQVo7O0FBRUEsTUFBSSxDQUFDL1AsR0FBTCxFQUFVO0FBQ1QsU0FBTSxJQUFJMEQsT0FBTzZFLEtBQVgsQ0FBaUIseUJBQWpCLEVBQTRDLCtEQUE1QyxDQUFOO0FBQ0E7O0FBRUQsTUFBSXlILGFBQUo7QUFDQXRNLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNOEwsZ0JBQWdCdE0sT0FBT0MsSUFBUCxDQUFZLFlBQVosRUFBMEIzRCxHQUExQixDQUFwRDtBQUVBLFNBQU9sQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDNkIsWUFBUzRPO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUFsQm9FLENBQXRFO0FBcUJBbFIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixrQkFBM0IsRUFBK0M7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBL0MsRUFBdUU7QUFDdEVDLFFBQU87QUFDTixRQUFNaU4sZ0JBQWdCQyxzQkFBc0IsS0FBS25PLFVBQTNCLEVBQXVDLEtBQUtDLElBQTVDLEVBQWtEK0QsU0FBbEQsRUFBNkQsSUFBN0QsRUFBbUUsQ0FBbkUsQ0FBdEI7O0FBRUEsTUFBSSxDQUFDa0ssYUFBTCxFQUFvQjtBQUNuQixVQUFPblIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixlQUExQixDQUFQO0FBQ0E7O0FBRUQsU0FBT2QsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3dOLE9BQUl6QyxLQUFLdUYsR0FBTCxFQUQ0QjtBQUVoQ3ZPLFlBQVMyTyxjQUFjM08sT0FGUztBQUdoQ0YsWUFBUzZPLGNBQWM3TztBQUhTLEdBQTFCLENBQVA7QUFLQTs7QUFicUUsQ0FBdkU7QUFnQkF0QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGFBQTNCLEVBQTBDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTFDLEVBQWtFO0FBQ2pFL0QsT0FBTTtBQUNMLFFBQU07QUFBRXlLLFNBQUY7QUFBVTBHLGFBQVY7QUFBc0I5RTtBQUF0QixNQUFnQyxLQUFLL0QsV0FBM0M7O0FBRUEsTUFBSSxDQUFDbUMsTUFBTCxFQUFhO0FBQ1osU0FBTSxJQUFJL0YsT0FBTzZFLEtBQVgsQ0FBaUIsaUNBQWpCLEVBQW9ELCtDQUFwRCxDQUFOO0FBQ0E7O0FBRUQsTUFBSSxDQUFDNEgsVUFBTCxFQUFpQjtBQUNoQixTQUFNLElBQUl6TSxPQUFPNkUsS0FBWCxDQUFpQixxQ0FBakIsRUFBd0QsbURBQXhELENBQU47QUFDQTs7QUFFRCxNQUFJOEMsVUFBVSxPQUFPQSxLQUFQLEtBQWlCLFFBQWpCLElBQTZCcUMsTUFBTXJDLEtBQU4sQ0FBN0IsSUFBNkNBLFNBQVMsQ0FBaEUsQ0FBSixFQUF3RTtBQUN2RSxTQUFNLElBQUkzSCxPQUFPNkUsS0FBWCxDQUFpQiwyQkFBakIsRUFBOEMsMkVBQTlDLENBQU47QUFDQTs7QUFFRCxNQUFJL0ksTUFBSjtBQUNBa0UsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU0xRSxTQUFTa0UsT0FBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkJ3TSxVQUE3QixFQUF5QzFHLE1BQXpDLEVBQWlENEIsS0FBakQsQ0FBN0M7QUFFQSxTQUFPdk0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3NOLGFBQVVyTixPQUFPcU47QUFEZSxHQUExQixDQUFQO0FBR0E7O0FBdEJnRSxDQUFsRSxFLENBeUJBO0FBQ0E7QUFDQTs7QUFDQS9OLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsa0JBQTNCLEVBQStDO0FBQUU2QyxlQUFjO0FBQWhCLENBQS9DLEVBQXVFO0FBQ3RFQyxRQUFPO0FBQ04sTUFBSSxDQUFDLEtBQUtqQixVQUFMLENBQWdCWCxPQUFyQixFQUE4QjtBQUM3QixTQUFNLElBQUlzQyxPQUFPNkUsS0FBWCxDQUFpQixzQkFBakIsRUFBeUMsMkNBQXpDLENBQU47QUFDQTs7QUFFRCxNQUFJbkgsT0FBSjtBQUNBc0MsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU05QyxVQUFVc0MsT0FBT0MsSUFBUCxDQUFZLGFBQVosRUFBMkIsS0FBSzVCLFVBQUwsQ0FBZ0JYLE9BQTNDLENBQTlDO0FBRUEsU0FBT3RDLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEM2QjtBQURnQyxHQUExQixDQUFQO0FBR0E7O0FBWnFFLENBQXZFO0FBZUF0QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGtCQUEzQixFQUErQztBQUFFNkMsZUFBYztBQUFoQixDQUEvQyxFQUF1RTtBQUN0RUMsUUFBTztBQUNOLE1BQUksQ0FBQyxLQUFLakIsVUFBTCxDQUFnQmdPLFNBQWpCLElBQThCLENBQUMsS0FBS2hPLFVBQUwsQ0FBZ0JnTyxTQUFoQixDQUEwQjdILElBQTFCLEVBQW5DLEVBQXFFO0FBQ3BFLFNBQU0sSUFBSXhFLE9BQU82RSxLQUFYLENBQWlCLG9DQUFqQixFQUF1RCw2Q0FBdkQsQ0FBTjtBQUNBOztBQUVELFFBQU12SSxNQUFNbEIsV0FBV3FKLE1BQVgsQ0FBa0IyRSxRQUFsQixDQUEyQnpFLFdBQTNCLENBQXVDLEtBQUt0RyxVQUFMLENBQWdCZ08sU0FBdkQsQ0FBWjs7QUFFQSxNQUFJLENBQUMvUCxHQUFMLEVBQVU7QUFDVCxTQUFNLElBQUkwRCxPQUFPNkUsS0FBWCxDQUFpQix5QkFBakIsRUFBNEMsK0RBQTVDLENBQU47QUFDQTs7QUFFRDdFLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNUixPQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQjtBQUM5REssUUFBS2hFLElBQUlnRSxHQURxRDtBQUU5RDZHLFFBQUs3SyxJQUFJNkssR0FGcUQ7QUFHOUR1RixZQUFTO0FBSHFELEdBQTNCLENBQXBDO0FBTUEsU0FBT3RSLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQW5CcUUsQ0FBdkU7QUFzQkFULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsbUJBQTNCLEVBQWdEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWhELEVBQXdFO0FBQ3ZFQyxRQUFPO0FBQ04sTUFBSSxDQUFDLEtBQUtqQixVQUFMLENBQWdCZ08sU0FBakIsSUFBOEIsQ0FBQyxLQUFLaE8sVUFBTCxDQUFnQmdPLFNBQWhCLENBQTBCN0gsSUFBMUIsRUFBbkMsRUFBcUU7QUFDcEUsU0FBTSxJQUFJeEUsT0FBTzZFLEtBQVgsQ0FBaUIsb0NBQWpCLEVBQXVELDZDQUF2RCxDQUFOO0FBQ0E7O0FBRUQsUUFBTXZJLE1BQU1sQixXQUFXcUosTUFBWCxDQUFrQjJFLFFBQWxCLENBQTJCekUsV0FBM0IsQ0FBdUMsS0FBS3RHLFVBQUwsQ0FBZ0JnTyxTQUF2RCxDQUFaOztBQUVBLE1BQUksQ0FBQy9QLEdBQUwsRUFBVTtBQUNULFNBQU0sSUFBSTBELE9BQU82RSxLQUFYLENBQWlCLHlCQUFqQixFQUE0QywrREFBNUMsQ0FBTjtBQUNBOztBQUVEN0UsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU1SLE9BQU9DLElBQVAsQ0FBWSxjQUFaLEVBQTRCM0QsR0FBNUIsQ0FBcEM7QUFFQSxTQUFPbEIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBZnNFLENBQXhFO0FBa0JBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG9CQUEzQixFQUFpRDtBQUFFNkMsZUFBYztBQUFoQixDQUFqRCxFQUF5RTtBQUN4RUMsUUFBTztBQUNOLE1BQUksQ0FBQyxLQUFLakIsVUFBTCxDQUFnQmdPLFNBQWpCLElBQThCLENBQUMsS0FBS2hPLFVBQUwsQ0FBZ0JnTyxTQUFoQixDQUEwQjdILElBQTFCLEVBQW5DLEVBQXFFO0FBQ3BFLFNBQU0sSUFBSXhFLE9BQU82RSxLQUFYLENBQWlCLG9DQUFqQixFQUF1RCw2Q0FBdkQsQ0FBTjtBQUNBOztBQUVELFFBQU12SSxNQUFNbEIsV0FBV3FKLE1BQVgsQ0FBa0IyRSxRQUFsQixDQUEyQnpFLFdBQTNCLENBQXVDLEtBQUt0RyxVQUFMLENBQWdCZ08sU0FBdkQsQ0FBWjs7QUFFQSxNQUFJLENBQUMvUCxHQUFMLEVBQVU7QUFDVCxTQUFNLElBQUkwRCxPQUFPNkUsS0FBWCxDQUFpQix5QkFBakIsRUFBNEMsK0RBQTVDLENBQU47QUFDQTs7QUFFRDdFLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNUixPQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQjtBQUM5REssUUFBS2hFLElBQUlnRSxHQURxRDtBQUU5RDZHLFFBQUs3SyxJQUFJNkssR0FGcUQ7QUFHOUR1RixZQUFTO0FBSHFELEdBQTNCLENBQXBDO0FBTUEsU0FBT3RSLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQW5CdUUsQ0FBekU7QUFzQkFULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsYUFBM0IsRUFBMEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBMUMsRUFBa0U7QUFDakVDLFFBQU87QUFDTnFNLFFBQU0sS0FBS3ROLFVBQVgsRUFBdUJ5SyxNQUFNOEMsZUFBTixDQUFzQjtBQUM1QzdGLFdBQVErRixNQURvQztBQUU1Q0QsVUFBT0MsTUFGcUM7QUFHNUNhLFNBQU1iLE1BSHNDLENBRy9COztBQUgrQixHQUF0QixDQUF2QjtBQU1BLFFBQU14UCxNQUFNbEIsV0FBV3FKLE1BQVgsQ0FBa0IyRSxRQUFsQixDQUEyQnpFLFdBQTNCLENBQXVDLEtBQUt0RyxVQUFMLENBQWdCd04sS0FBdkQsQ0FBWixDQVBNLENBU047O0FBQ0EsTUFBSSxDQUFDdlAsR0FBTCxFQUFVO0FBQ1QsVUFBT2xCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMkIsb0NBQW9DLEtBQUttQyxVQUFMLENBQWdCd04sS0FBTyxJQUF0RixDQUFQO0FBQ0E7O0FBRUQsTUFBSSxLQUFLeE4sVUFBTCxDQUFnQjBILE1BQWhCLEtBQTJCekosSUFBSTZLLEdBQW5DLEVBQXdDO0FBQ3ZDLFVBQU8vTCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLGdFQUExQixDQUFQO0FBQ0EsR0FoQkssQ0FrQk47OztBQUNBOEQsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxlQUFaLEVBQTZCO0FBQUVLLFNBQUtoRSxJQUFJZ0UsR0FBWDtBQUFnQmhFLFNBQUssS0FBSytCLFVBQUwsQ0FBZ0JzTyxJQUFyQztBQUEyQ3hGLFNBQUs3SyxJQUFJNks7QUFBcEQsSUFBN0I7QUFFQSxHQUhEO0FBS0EsU0FBTy9MLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEM2QixZQUFTdEMsV0FBV3FKLE1BQVgsQ0FBa0IyRSxRQUFsQixDQUEyQnpFLFdBQTNCLENBQXVDckksSUFBSWdFLEdBQTNDO0FBRHVCLEdBQTFCLENBQVA7QUFHQTs7QUE1QmdFLENBQWxFLEU7Ozs7Ozs7Ozs7O0FDbk9BbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixjQUEzQixFQUEyQztBQUFFNkMsZUFBYztBQUFoQixDQUEzQyxFQUFtRTtBQUNsRS9ELE9BQU07QUFDTCxRQUFNZ0osU0FBUyxLQUFLVixXQUFwQjs7QUFFQSxNQUFJLE9BQU9VLE9BQU9zSSxPQUFkLEtBQTBCLFFBQTlCLEVBQXdDO0FBQ3ZDLFVBQU94UixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLDZDQUExQixDQUFQO0FBQ0E7O0FBRUQsUUFBTTJRLE1BQU16UixXQUFXMFIsYUFBWCxDQUF5QkMsUUFBekIsQ0FBa0N6SSxPQUFPc0ksT0FBUCxDQUFlSSxXQUFmLEVBQWxDLENBQVo7O0FBRUEsTUFBSSxDQUFDSCxHQUFMLEVBQVU7QUFDVCxVQUFPelIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEyQixxREFBcURvSSxPQUFPc0ksT0FBUyxFQUFoRyxDQUFQO0FBQ0E7O0FBRUQsU0FBT3hSLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFBRStRLFlBQVNDO0FBQVgsR0FBMUIsQ0FBUDtBQUNBOztBQWZpRSxDQUFuRTtBQWtCQXpSLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZUFBM0IsRUFBNEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBNUMsRUFBb0U7QUFDbkUvRCxPQUFNO0FBQ0wsUUFBTTtBQUFFMEksU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxNQUFJMEYsV0FBV2hRLE9BQU9rUSxNQUFQLENBQWM3UixXQUFXMFIsYUFBWCxDQUF5QkMsUUFBdkMsQ0FBZjs7QUFFQSxNQUFJdEgsU0FBU0EsTUFBTW1ILE9BQW5CLEVBQTRCO0FBQzNCRyxjQUFXQSxTQUFTRyxNQUFULENBQWlCTixPQUFELElBQWFBLFFBQVFBLE9BQVIsS0FBb0JuSCxNQUFNbUgsT0FBdkQsQ0FBWDtBQUNBOztBQUVELFFBQU1uRSxhQUFhc0UsU0FBU25PLE1BQTVCO0FBQ0FtTyxhQUFXM1IsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QndDLDJCQUF4QixDQUFvRHFFLFFBQXBELEVBQThEO0FBQ3hFL0gsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUUvRyxVQUFNO0FBQVIsSUFEb0Q7QUFFeEV5SixTQUFNMUQsTUFGa0U7QUFHeEUyRCxVQUFPekQsS0FIaUU7QUFJeEVlO0FBSndFLEdBQTlELENBQVg7QUFPQSxTQUFPN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2tSLFdBRGdDO0FBRWhDL0ksU0FGZ0M7QUFHaENFLFVBQU82SSxTQUFTbk8sTUFIZ0I7QUFJaENpSixVQUFPWTtBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBekJrRSxDQUFwRSxFLENBNEJBOztBQUNBck4sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixjQUEzQixFQUEyQztBQUFFNkMsZUFBYztBQUFoQixDQUEzQyxFQUFtRTtBQUNsRUMsUUFBTztBQUNOLFFBQU1yRCxPQUFPLEtBQUtvQyxVQUFsQjtBQUNBLFFBQU1DLE9BQU8sS0FBSzZPLGVBQUwsRUFBYjs7QUFFQSxNQUFJLE9BQU9sUixLQUFLMlEsT0FBWixLQUF3QixRQUE1QixFQUFzQztBQUNyQyxVQUFPeFIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixvQ0FBMUIsQ0FBUDtBQUNBOztBQUVELE1BQUlELEtBQUtxSSxNQUFMLElBQWUsT0FBT3JJLEtBQUtxSSxNQUFaLEtBQXVCLFFBQTFDLEVBQW9EO0FBQ25ELFVBQU9sSixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHlEQUExQixDQUFQO0FBQ0E7O0FBRUQsTUFBSSxPQUFPRCxLQUFLOEosTUFBWixLQUF1QixRQUEzQixFQUFxQztBQUNwQyxVQUFPM0ssV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQiw2RUFBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU0yUSxNQUFNNVEsS0FBSzJRLE9BQUwsQ0FBYUksV0FBYixFQUFaOztBQUNBLE1BQUksQ0FBQzVSLFdBQVcwUixhQUFYLENBQXlCQyxRQUF6QixDQUFrQzlRLEtBQUsyUSxPQUFMLENBQWFJLFdBQWIsRUFBbEMsQ0FBTCxFQUFvRTtBQUNuRSxVQUFPNVIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix1REFBMUIsQ0FBUDtBQUNBLEdBbkJLLENBcUJOOzs7QUFDQThELFNBQU9DLElBQVAsQ0FBWSxlQUFaLEVBQTZCaEUsS0FBSzhKLE1BQWxDLEVBQTBDekgsS0FBS2dDLEdBQS9DO0FBRUEsUUFBTWdFLFNBQVNySSxLQUFLcUksTUFBTCxHQUFjckksS0FBS3FJLE1BQW5CLEdBQTRCLEVBQTNDO0FBRUEsTUFBSXhJLE1BQUo7QUFDQWtFLFNBQU91RyxTQUFQLENBQWlCakksS0FBS2dDLEdBQXRCLEVBQTJCLE1BQU07QUFDaEN4RSxZQUFTVixXQUFXMFIsYUFBWCxDQUF5Qk0sR0FBekIsQ0FBNkJQLEdBQTdCLEVBQWtDdkksTUFBbEMsRUFBMEM7QUFDbERoRSxTQUFLK00sT0FBTzlNLEVBQVAsRUFENkM7QUFFbEQ0RyxTQUFLbEwsS0FBSzhKLE1BRndDO0FBR2xEekosU0FBTSxJQUFJdVEsR0FBSyxJQUFJdkksTUFBUTtBQUh1QixJQUExQyxDQUFUO0FBS0EsR0FORDtBQVFBLFNBQU9sSixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQUVDO0FBQUYsR0FBMUIsQ0FBUDtBQUNBOztBQXJDaUUsQ0FBbkUsRTs7Ozs7Ozs7Ozs7QUMvQ0EsSUFBSXRELENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7O0FBRU47QUFDQSxTQUFTeVUsMEJBQVQsQ0FBb0M7QUFBRWhKLE9BQUY7QUFBVTlELE9BQVY7QUFBa0JxRixtQkFBa0I7QUFBcEMsQ0FBcEMsRUFBZ0Y7QUFDL0UsS0FBSSxDQUFDLENBQUN2QixPQUFPeUIsTUFBUixJQUFrQixDQUFDekIsT0FBT3lCLE1BQVAsQ0FBY3ZCLElBQWQsRUFBcEIsTUFBOEMsQ0FBQ0YsT0FBTzBCLFFBQVIsSUFBb0IsQ0FBQzFCLE9BQU8wQixRQUFQLENBQWdCeEIsSUFBaEIsRUFBbkUsQ0FBSixFQUFnRztBQUMvRixRQUFNLElBQUl4RSxPQUFPNkUsS0FBWCxDQUFpQiwrQkFBakIsRUFBa0Qsa0RBQWxELENBQU47QUFDQTs7QUFFRCxLQUFJMEksT0FBSjs7QUFDQSxLQUFJakosT0FBT3lCLE1BQVgsRUFBbUI7QUFDbEJ3SCxZQUFVblMsV0FBV3FKLE1BQVgsQ0FBa0JzQyxhQUFsQixDQUFnQ0Msd0JBQWhDLENBQXlEMUMsT0FBT3lCLE1BQWhFLEVBQXdFdkYsTUFBeEUsQ0FBVjtBQUNBLEVBRkQsTUFFTyxJQUFJOEQsT0FBTzBCLFFBQVgsRUFBcUI7QUFDM0J1SCxZQUFVblMsV0FBV3FKLE1BQVgsQ0FBa0JzQyxhQUFsQixDQUFnQ3lHLDBCQUFoQyxDQUEyRGxKLE9BQU8wQixRQUFsRSxFQUE0RXhGLE1BQTVFLENBQVY7QUFDQTs7QUFFRCxLQUFJLENBQUMrTSxPQUFELElBQVlBLFFBQVFuSCxDQUFSLEtBQWMsR0FBOUIsRUFBbUM7QUFDbEMsUUFBTSxJQUFJcEcsT0FBTzZFLEtBQVgsQ0FBaUIsc0JBQWpCLEVBQXlDLDZFQUF6QyxDQUFOO0FBQ0E7O0FBRUQsS0FBSWdCLG1CQUFtQjBILFFBQVFsSCxRQUEvQixFQUF5QztBQUN4QyxRQUFNLElBQUlyRyxPQUFPNkUsS0FBWCxDQUFpQixxQkFBakIsRUFBeUMsc0JBQXNCMEksUUFBUXRQLElBQU0sZUFBN0UsQ0FBTjtBQUNBOztBQUVELFFBQU9zUCxPQUFQO0FBQ0E7O0FBRURuUyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGVBQTNCLEVBQTRDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTVDLEVBQW9FO0FBQ25FQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUVBUixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2EsR0FBM0MsRUFBZ0QsS0FBSzlJLFVBQUwsQ0FBZ0JtSSxlQUFoRTtBQUNBLEdBRkQ7QUFJQSxTQUFPcEwsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2lDLFVBQU8xQyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0MyQixXQUFXYSxHQUEvQyxFQUFvRDtBQUFFbEMsWUFBUTdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCaEU7QUFBNUIsSUFBcEQ7QUFEeUIsR0FBMUIsQ0FBUDtBQUdBOztBQVhrRSxDQUFwRTtBQWNBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixxQkFBM0IsRUFBa0Q7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBbEQsRUFBMEU7QUFDekVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBO0FBQTdDLEdBQTNCLENBQW5CO0FBRUEsUUFBTWxDLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksa0JBQVosRUFBZ0NxRyxXQUFXYSxHQUEzQyxFQUFnRDdJLEtBQUtnQyxHQUFyRDtBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBWHdFLENBQTFFO0FBY0FULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsaUJBQTNCLEVBQThDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTlDLEVBQXNFO0FBQ3JFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUVBLFFBQU1sQyxPQUFPLEtBQUttSSxpQkFBTCxFQUFiO0FBRUF6RyxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGNBQVosRUFBNEJxRyxXQUFXYSxHQUF2QyxFQUE0QzdJLEtBQUtnQyxHQUFqRDtBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBWG9FLENBQXRFO0FBY0FULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsa0JBQTNCLEVBQStDO0FBQUU2QyxlQUFjO0FBQWhCLENBQS9DLEVBQXVFO0FBQ3RFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUNBLFFBQU1sQyxPQUFPLEtBQUttSSxpQkFBTCxFQUFiO0FBQ0F6RyxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkJxRyxXQUFXYSxHQUF4QyxFQUE2QzdJLEtBQUtnQyxHQUFsRDtBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBVHFFLENBQXZFLEUsQ0FZQTs7QUFDQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixnQkFBM0IsRUFBNkM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBN0MsRUFBcUU7QUFDcEVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBO0FBQTdDLEdBQTNCLENBQW5CO0FBRUFSLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQnFHLFdBQVdhLEdBQXRDO0FBQ0EsR0FGRDtBQUlBLFNBQU8vTCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFUbUUsQ0FBckU7QUFZQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixjQUEzQixFQUEyQztBQUFFNkMsZUFBYztBQUFoQixDQUEzQyxFQUFtRTtBQUNsRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhZ0gsMkJBQTJCO0FBQUVoSixXQUFRLEtBQUtDLGFBQUwsRUFBVjtBQUFnQy9ELFdBQVEsS0FBS0EsTUFBN0M7QUFBcURxRixvQkFBaUI7QUFBdEUsR0FBM0IsQ0FBbkI7O0FBRUEsTUFBSSxDQUFDUyxXQUFXVyxJQUFoQixFQUFzQjtBQUNyQixVQUFPN0wsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEyQixzQkFBc0JvSyxXQUFXckksSUFBTSxtQ0FBbEUsQ0FBUDtBQUNBOztBQUVEK0IsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxVQUFaLEVBQXdCcUcsV0FBV2EsR0FBbkM7QUFDQSxHQUZEO0FBSUEsU0FBTy9MLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQWJpRSxDQUFuRSxFLENBZ0JBOztBQUNBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGVBQTNCLEVBQTRDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTVDLEVBQW9FO0FBQ25FQyxRQUFPO0FBQ04sTUFBSSxDQUFDbEUsV0FBVytKLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCLEtBQUs1RSxNQUFwQyxFQUE0QyxVQUE1QyxDQUFMLEVBQThEO0FBQzdELFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxNQUFJLENBQUMsS0FBS2dDLFVBQUwsQ0FBZ0JKLElBQXJCLEVBQTJCO0FBQzFCLFVBQU83QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLCtCQUExQixDQUFQO0FBQ0E7O0FBRUQsTUFBSSxLQUFLbUMsVUFBTCxDQUFnQnhFLE9BQWhCLElBQTJCLENBQUNyQixFQUFFb0UsT0FBRixDQUFVLEtBQUt5QixVQUFMLENBQWdCeEUsT0FBMUIsQ0FBaEMsRUFBb0U7QUFDbkUsVUFBT3VCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsbURBQTFCLENBQVA7QUFDQTs7QUFFRCxNQUFJLEtBQUttQyxVQUFMLENBQWdCeEQsWUFBaEIsSUFBZ0MsRUFBRSxPQUFPLEtBQUt3RCxVQUFMLENBQWdCeEQsWUFBdkIsS0FBd0MsUUFBMUMsQ0FBcEMsRUFBeUY7QUFDeEYsVUFBT08sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix5REFBMUIsQ0FBUDtBQUNBOztBQUVELE1BQUlnTCxXQUFXLEtBQWY7O0FBQ0EsTUFBSSxPQUFPLEtBQUs3SSxVQUFMLENBQWdCNkksUUFBdkIsS0FBb0MsV0FBeEMsRUFBcUQ7QUFDcERBLGNBQVcsS0FBSzdJLFVBQUwsQ0FBZ0I2SSxRQUEzQjtBQUNBOztBQUVELE1BQUkzRyxFQUFKO0FBQ0FQLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DRCxRQUFLUCxPQUFPQyxJQUFQLENBQVksb0JBQVosRUFBa0MsS0FBSzVCLFVBQUwsQ0FBZ0JKLElBQWxELEVBQXdELEtBQUtJLFVBQUwsQ0FBZ0J4RSxPQUFoQixHQUEwQixLQUFLd0UsVUFBTCxDQUFnQnhFLE9BQTFDLEdBQW9ELEVBQTVHLEVBQWdIcU4sUUFBaEgsRUFBMEgsS0FBSzdJLFVBQUwsQ0FBZ0J4RCxZQUExSSxDQUFMO0FBQ0EsR0FGRDtBQUlBLFNBQU9PLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENpQyxVQUFPMUMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DcEUsR0FBRzRHLEdBQXZDLEVBQTRDO0FBQUVsQyxZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUE1QztBQUR5QixHQUExQixDQUFQO0FBR0E7O0FBL0JrRSxDQUFwRTtBQWtDQTJCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZUFBM0IsRUFBNEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBNUMsRUFBb0U7QUFDbkVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBLE1BQTdDO0FBQXFEcUYsb0JBQWlCO0FBQXRFLEdBQTNCLENBQW5CO0FBRUE3RixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLFdBQVosRUFBeUJxRyxXQUFXYSxHQUFwQztBQUNBLEdBRkQ7QUFJQSxTQUFPL0wsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2lDLFVBQU8xQyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCd0MsMkJBQXhCLENBQW9ELENBQUNwQyxXQUFXbUgsS0FBWixDQUFwRCxFQUF3RTtBQUFFeEksWUFBUTdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCaEU7QUFBNUIsSUFBeEUsRUFBOEgsQ0FBOUg7QUFEeUIsR0FBMUIsQ0FBUDtBQUdBOztBQVhrRSxDQUFwRTtBQWNBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixjQUEzQixFQUEyQztBQUFFNkMsZUFBYztBQUFoQixDQUEzQyxFQUFtRTtBQUNsRS9ELE9BQU07QUFDTCxRQUFNZ0wsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBLE1BQTdDO0FBQXFEcUYsb0JBQWlCO0FBQXRFLEdBQTNCLENBQW5CO0FBRUEsUUFBTTtBQUFFN0IsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxRQUFNQyxXQUFXdkssT0FBT3lJLE1BQVAsQ0FBYyxFQUFkLEVBQWtCQyxLQUFsQixFQUF5QjtBQUFFMEIsUUFBS2IsV0FBV2E7QUFBbEIsR0FBekIsQ0FBakI7QUFFQSxRQUFNSSxRQUFRbk0sV0FBV3FKLE1BQVgsQ0FBa0IrQyxPQUFsQixDQUEwQkMsSUFBMUIsQ0FBK0JILFFBQS9CLEVBQXlDO0FBQ3REdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUUvRyxVQUFNO0FBQVIsSUFEa0M7QUFFdER5SixTQUFNMUQsTUFGZ0Q7QUFHdEQyRCxVQUFPekQsS0FIK0M7QUFJdERlO0FBSnNELEdBQXpDLEVBS1gyQyxLQUxXLEVBQWQ7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQzBMLFFBRGdDO0FBRWhDckQsVUFBT3FELE1BQU0zSSxNQUZtQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCK0MsT0FBbEIsQ0FBMEJDLElBQTFCLENBQStCSCxRQUEvQixFQUF5Q3BELEtBQXpDO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUF0QmlFLENBQW5FO0FBeUJBOUksV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQix3QkFBM0IsRUFBcUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBckQsRUFBNkU7QUFDNUUvRCxPQUFNO0FBQ0wsTUFBSSxDQUFDRixXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLHFCQUE1QyxDQUFMLEVBQXlFO0FBQ3hFLFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxRQUFNaUssYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBLE1BQTdDO0FBQXFEcUYsb0JBQWlCO0FBQXRFLEdBQTNCLENBQW5CO0FBRUEsTUFBSTZILDBCQUEwQixJQUE5Qjs7QUFDQSxNQUFJLE9BQU8sS0FBSzlKLFdBQUwsQ0FBaUI4Six1QkFBeEIsS0FBb0QsV0FBeEQsRUFBcUU7QUFDcEVBLDZCQUEwQixLQUFLOUosV0FBTCxDQUFpQjhKLHVCQUFqQixLQUE2QyxNQUF2RTtBQUNBOztBQUVELFFBQU1DLG1CQUFtQixDQUFFLElBQUlySCxXQUFXckksSUFBTSxFQUF2QixDQUF6Qjs7QUFDQSxNQUFJeVAsdUJBQUosRUFBNkI7QUFDNUJDLG9CQUFpQi9SLElBQWpCLENBQXNCLG9CQUF0QjtBQUNBOztBQUVELFFBQU07QUFBRW9JLFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQyxPQUFGO0FBQVFDLFNBQVI7QUFBZ0JRO0FBQWhCLE1BQTBCLEtBQUs0QixjQUFMLEVBQWhDO0FBRUEsUUFBTUMsV0FBV3ZLLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQkMsS0FBbEIsRUFBeUI7QUFBRTdILFlBQVM7QUFBRW1LLFNBQUs0RjtBQUFQO0FBQVgsR0FBekIsQ0FBakI7QUFDQSxRQUFNM0YsZUFBZTVNLFdBQVdxSixNQUFYLENBQWtCd0QsWUFBbEIsQ0FBK0JSLElBQS9CLENBQW9DSCxRQUFwQyxFQUE4QztBQUNsRXRDLFNBQU1BLE9BQU9BLElBQVAsR0FBYztBQUFFa0QsZ0JBQVk7QUFBZCxJQUQ4QztBQUVsRVIsU0FBTTFELE1BRjREO0FBR2xFMkQsVUFBT3pELEtBSDJEO0FBSWxFZTtBQUprRSxHQUE5QyxFQUtsQjJDLEtBTGtCLEVBQXJCO0FBT0EsU0FBT3hNLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENtTSxlQURnQztBQUVoQzlELFVBQU84RCxhQUFhcEosTUFGWTtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCd0QsWUFBbEIsQ0FBK0JSLElBQS9CLENBQW9DSCxRQUFwQyxFQUE4Q3BELEtBQTlDO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUFuQzJFLENBQTdFO0FBc0NBOUksV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixnQkFBM0IsRUFBNkM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBN0MsRUFBcUU7QUFDcEUvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQSxNQUE3QztBQUFxRHFGLG9CQUFpQjtBQUF0RSxHQUEzQixDQUFuQjtBQUVBLE1BQUlzQyxhQUFhLElBQUl2QixJQUFKLEVBQWpCOztBQUNBLE1BQUksS0FBS2hELFdBQUwsQ0FBaUI4QyxNQUFyQixFQUE2QjtBQUM1QnlCLGdCQUFhLElBQUl2QixJQUFKLENBQVMsS0FBS2hELFdBQUwsQ0FBaUI4QyxNQUExQixDQUFiO0FBQ0E7O0FBRUQsTUFBSTBCLGFBQWEvRixTQUFqQjs7QUFDQSxNQUFJLEtBQUt1QixXQUFMLENBQWlCK0MsTUFBckIsRUFBNkI7QUFDNUJ5QixnQkFBYSxJQUFJeEIsSUFBSixDQUFTLEtBQUtoRCxXQUFMLENBQWlCK0MsTUFBMUIsQ0FBYjtBQUNBOztBQUVELE1BQUlFLFlBQVksS0FBaEI7O0FBQ0EsTUFBSSxLQUFLakQsV0FBTCxDQUFpQmlELFNBQXJCLEVBQWdDO0FBQy9CQSxlQUFZLEtBQUtqRCxXQUFMLENBQWlCaUQsU0FBN0I7QUFDQTs7QUFFRCxNQUFJM0MsUUFBUSxFQUFaOztBQUNBLE1BQUksS0FBS04sV0FBTCxDQUFpQk0sS0FBckIsRUFBNEI7QUFDM0JBLFdBQVFELFNBQVMsS0FBS0wsV0FBTCxDQUFpQk0sS0FBMUIsQ0FBUjtBQUNBOztBQUVELE1BQUltRSxVQUFVLEtBQWQ7O0FBQ0EsTUFBSSxLQUFLekUsV0FBTCxDQUFpQnlFLE9BQXJCLEVBQThCO0FBQzdCQSxhQUFVLEtBQUt6RSxXQUFMLENBQWlCeUUsT0FBM0I7QUFDQTs7QUFFRCxNQUFJdk0sTUFBSjtBQUNBa0UsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkMxRSxZQUFTa0UsT0FBT0MsSUFBUCxDQUFZLG1CQUFaLEVBQWlDO0FBQUVrSCxTQUFLYixXQUFXYSxHQUFsQjtBQUF1QlQsWUFBUXlCLFVBQS9CO0FBQTJDeEIsWUFBUXlCLFVBQW5EO0FBQStEdkIsYUFBL0Q7QUFBMEUzQyxTQUExRTtBQUFpRm1FO0FBQWpGLElBQWpDLENBQVQ7QUFDQSxHQUZEOztBQUlBLE1BQUksQ0FBQ3ZNLE1BQUwsRUFBYTtBQUNaLFVBQU9WLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUVELFNBQU9qQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCQyxNQUExQixDQUFQO0FBQ0E7O0FBdkNtRSxDQUFyRTtBQTBDQVYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixhQUEzQixFQUEwQztBQUFFNkMsZUFBYztBQUFoQixDQUExQyxFQUFrRTtBQUNqRS9ELE9BQU07QUFDTCxRQUFNZ0wsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBLE1BQTdDO0FBQXFEcUYsb0JBQWlCO0FBQXRFLEdBQTNCLENBQW5CO0FBRUEsU0FBT3pLLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENpQyxVQUFPMUMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2EsR0FBL0MsRUFBb0Q7QUFBRWxDLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHlCLEdBQTFCLENBQVA7QUFHQTs7QUFQZ0UsQ0FBbEU7QUFVQTJCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZUFBM0IsRUFBNEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBNUMsRUFBb0U7QUFDbkVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBO0FBQTdDLEdBQTNCLENBQW5CO0FBRUEsUUFBTWxDLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksZUFBWixFQUE2QjtBQUFFa0gsU0FBS2IsV0FBV2EsR0FBbEI7QUFBdUI1SSxjQUFVRCxLQUFLQztBQUF0QyxJQUE3QjtBQUNBLEdBRkQ7QUFJQSxTQUFPbkQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2lDLFVBQU8xQyxXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdkIsV0FBeEIsQ0FBb0MyQixXQUFXYSxHQUEvQyxFQUFvRDtBQUFFbEMsWUFBUTdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCaEU7QUFBNUIsSUFBcEQ7QUFEeUIsR0FBMUIsQ0FBUDtBQUdBOztBQWJrRSxDQUFwRTtBQWdCQTJCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsYUFBM0IsRUFBMEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBMUMsRUFBa0U7QUFDakVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBO0FBQTdDLEdBQTNCLENBQW5CO0FBRUEsUUFBTWxDLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksb0JBQVosRUFBa0M7QUFBRWtILFNBQUtiLFdBQVdhLEdBQWxCO0FBQXVCNUksY0FBVUQsS0FBS0M7QUFBdEMsSUFBbEM7QUFDQSxHQUZEO0FBSUEsU0FBT25ELFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQVhnRSxDQUFsRTtBQWNBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGNBQTNCLEVBQTJDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTNDLEVBQW1FO0FBQ2xFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUVBUixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLFdBQVosRUFBeUJxRyxXQUFXYSxHQUFwQztBQUNBLEdBRkQ7QUFJQSxTQUFPL0wsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBVGlFLENBQW5FLEUsQ0FZQTs7QUFDQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixhQUEzQixFQUEwQztBQUFFNkMsZUFBYztBQUFoQixDQUExQyxFQUFrRTtBQUNqRS9ELE9BQU07QUFDTCxRQUFNO0FBQUUwSSxTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQztBQUFSLE1BQW1CLEtBQUtvQyxjQUFMLEVBQXpCOztBQUNBLE1BQUlpQixRQUFROVAsRUFBRStQLEtBQUYsQ0FBUW5OLFdBQVdxSixNQUFYLENBQWtCc0MsYUFBbEIsQ0FBZ0N5QixtQkFBaEMsQ0FBb0QsR0FBcEQsRUFBeUQsS0FBS2hJLE1BQTlELEVBQXNFb0gsS0FBdEUsRUFBUixFQUF1RixPQUF2RixDQUFaOztBQUNBLFFBQU1hLGFBQWFILE1BQU0xSixNQUF6QjtBQUVBMEosVUFBUWxOLFdBQVdxSixNQUFYLENBQWtCeUIsS0FBbEIsQ0FBd0J3QywyQkFBeEIsQ0FBb0RKLEtBQXBELEVBQTJEO0FBQ2xFdEQsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUUvRyxVQUFNO0FBQVIsSUFEOEM7QUFFbEV5SixTQUFNMUQsTUFGNEQ7QUFHbEUyRCxVQUFPekQsS0FIMkQ7QUFJbEVlO0FBSmtFLEdBQTNELENBQVI7QUFPQSxTQUFPN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2tDLFdBQVF1SyxLQUR3QjtBQUVoQ3RFLFNBRmdDO0FBR2hDRSxVQUFPb0UsTUFBTTFKLE1BSG1CO0FBSWhDaUosVUFBT1k7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQXBCZ0UsQ0FBbEU7QUF3QkFyTixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGdCQUEzQixFQUE2QztBQUFFNkMsZUFBYztBQUFoQixDQUE3QyxFQUFxRTtBQUNwRS9ELE9BQU07QUFDTCxNQUFJLENBQUNGLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsMEJBQTVDLENBQUwsRUFBOEU7QUFDN0UsVUFBT3BGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUNELFFBQU07QUFBRTJILFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQyxPQUFGO0FBQVFDO0FBQVIsTUFBbUIsS0FBS29DLGNBQUwsRUFBekI7QUFDQSxNQUFJaUIsUUFBUWxOLFdBQVdxSixNQUFYLENBQWtCeUIsS0FBbEIsQ0FBd0IwSCxVQUF4QixDQUFtQyxHQUFuQyxFQUF3Q2hHLEtBQXhDLEVBQVo7QUFDQSxRQUFNYSxhQUFhSCxNQUFNMUosTUFBekI7QUFFQTBKLFVBQVFsTixXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCd0MsMkJBQXhCLENBQW9ESixLQUFwRCxFQUEyRDtBQUNsRXRELFNBQU1BLE9BQU9BLElBQVAsR0FBYztBQUFFL0csVUFBTTtBQUFSLElBRDhDO0FBRWxFeUosU0FBTTFELE1BRjREO0FBR2xFMkQsVUFBT3pELEtBSDJEO0FBSWxFZTtBQUprRSxHQUEzRCxDQUFSO0FBT0EsU0FBTzdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENrQyxXQUFRdUssS0FEd0I7QUFFaEN0RSxTQUZnQztBQUdoQ0UsVUFBT29FLE1BQU0xSixNQUhtQjtBQUloQ2lKLFVBQU9ZO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUF2Qm1FLENBQXJFO0FBMEJBck4sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixnQkFBM0IsRUFBNkM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBN0MsRUFBcUU7QUFDcEUvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUNBLFFBQU07QUFBRXdELFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQztBQUFGLE1BQVcsS0FBS3FDLGNBQUwsRUFBakI7O0FBRUEsTUFBSXNCLFNBQVMsQ0FBQ0MsQ0FBRCxFQUFJQyxDQUFKLEtBQVVELElBQUlDLENBQTNCOztBQUNBLE1BQUlDLE1BQU1uTCxJQUFOLENBQVdxSCxJQUFYLEVBQWlCakksTUFBakIsS0FBNEIrTCxNQUFNbkwsSUFBTixDQUFXcUgsS0FBS3pHLFFBQWhCLEVBQTBCd0ssTUFBMUIsQ0FBNUIsSUFBaUUvRCxLQUFLekcsUUFBTCxLQUFrQixDQUFDLENBQXhGLEVBQTJGO0FBQzFGb0ssWUFBUyxDQUFDQyxDQUFELEVBQUlDLENBQUosS0FBVUEsSUFBSUQsQ0FBdkI7QUFDQTs7QUFFRCxRQUFNL08sVUFBVXVCLFdBQVdxSixNQUFYLENBQWtCeUIsS0FBbEIsQ0FBd0J3QywyQkFBeEIsQ0FBb0RNLE1BQU1DLElBQU4sQ0FBVzNDLFdBQVdtSCxLQUFYLENBQWlCM1QsU0FBNUIsRUFBdUNrTCxJQUF2QyxDQUE0QzJELE1BQTVDLENBQXBELEVBQXlHO0FBQ3hIakIsU0FBTTFELE1BRGtIO0FBRXhIMkQsVUFBT3pEO0FBRmlILEdBQXpHLENBQWhCO0FBS0EsUUFBTTlELFFBQVFoRixXQUFXcUosTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0IrQyxJQUF4QixDQUE2QjtBQUFFbEosYUFBVTtBQUFFd0osU0FBS2xPO0FBQVA7QUFBWixHQUE3QixFQUE2RDtBQUMxRW9MLFdBQVE7QUFBRTNFLFNBQUssQ0FBUDtBQUFVL0IsY0FBVSxDQUFwQjtBQUF1Qk4sVUFBTSxDQUE3QjtBQUFnQ2tDLFlBQVEsQ0FBeEM7QUFBMkMrSSxlQUFXO0FBQXRELElBRGtFO0FBRTFFbEUsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUV6RyxjQUFVO0FBQVo7QUFGc0QsR0FBN0QsRUFHWHFKLEtBSFcsRUFBZDtBQUtBLFNBQU94TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDaEMsWUFBU3VHLEtBRHVCO0FBRWhDOEQsVUFBT3JLLFFBQVErRSxNQUZpQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3ZCLFdBQVdtSCxLQUFYLENBQWlCM1QsU0FBakIsQ0FBMkI4RTtBQUpGLEdBQTFCLENBQVA7QUFNQTs7QUEzQm1FLENBQXJFO0FBOEJBeEQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixpQkFBM0IsRUFBOEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBOUMsRUFBc0U7QUFDckUvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUNBLFFBQU07QUFBRXdELFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQyxPQUFGO0FBQVFDLFNBQVI7QUFBZ0JRO0FBQWhCLE1BQTBCLEtBQUs0QixjQUFMLEVBQWhDO0FBRUEsUUFBTUMsV0FBV3ZLLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQkMsS0FBbEIsRUFBeUI7QUFBRTBCLFFBQUtiLFdBQVdhO0FBQWxCLEdBQXpCLENBQWpCO0FBRUEsUUFBTWdDLFdBQVcvTixXQUFXcUosTUFBWCxDQUFrQjJFLFFBQWxCLENBQTJCM0IsSUFBM0IsQ0FBZ0NILFFBQWhDLEVBQTBDO0FBQzFEdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUVxRSxRQUFJLENBQUM7QUFBUCxJQURzQztBQUUxRDNCLFNBQU0xRCxNQUZvRDtBQUcxRDJELFVBQU96RCxLQUhtRDtBQUkxRGU7QUFKMEQsR0FBMUMsRUFLZDJDLEtBTGMsRUFBakI7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3NOLFdBRGdDO0FBRWhDakYsVUFBT2lGLFNBQVN2SyxNQUZnQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCMkUsUUFBbEIsQ0FBMkIzQixJQUEzQixDQUFnQ0gsUUFBaEMsRUFBMENwRCxLQUExQztBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBckJvRSxDQUF0RTtBQXdCQTlJLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZUFBM0IsRUFBNEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBNUMsRUFBb0U7QUFDbkUvRCxPQUFNO0FBQ0wsUUFBTTtBQUFFbUs7QUFBRixNQUFZLEtBQUs0QixjQUFMLEVBQWxCO0FBQ0EsUUFBTUMsV0FBV3ZLLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQkMsS0FBbEIsRUFBeUI7QUFBRVcsTUFBRztBQUFMLEdBQXpCLENBQWpCO0FBRUEsUUFBTUgsT0FBTzdLLFdBQVdxSixNQUFYLENBQWtCeUIsS0FBbEIsQ0FBd0I3RixPQUF4QixDQUFnQ2lILFFBQWhDLENBQWI7O0FBRUEsTUFBSXJCLFFBQVEsSUFBWixFQUFrQjtBQUNqQixVQUFPN0ssV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix1QkFBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vTixTQUFTbE8sV0FBV3FKLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCNkUsbUJBQXhCLENBQTRDO0FBQzFEdEUsV0FBUTtBQUNQMUcsY0FBVTtBQURIO0FBRGtELEdBQTVDLEVBSVpxSixLQUpZLEVBQWY7QUFNQSxRQUFNNEIsZUFBZSxFQUFyQjtBQUNBRixTQUFPek0sT0FBUCxDQUFleUIsUUFBUTtBQUN0QixPQUFJMkgsS0FBS25NLFNBQUwsQ0FBZTJQLE9BQWYsQ0FBdUJuTCxLQUFLQyxRQUE1QixNQUEwQyxDQUFDLENBQS9DLEVBQWtEO0FBQ2pEaUwsaUJBQWE1TixJQUFiLENBQWtCO0FBQ2pCMEUsVUFBS2hDLEtBQUtnQyxHQURPO0FBRWpCL0IsZUFBVUQsS0FBS0M7QUFGRSxLQUFsQjtBQUlBO0FBQ0QsR0FQRDtBQVNBLFNBQU9uRCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDeU4sV0FBUUU7QUFEd0IsR0FBMUIsQ0FBUDtBQUdBOztBQTlCa0UsQ0FBcEU7QUFpQ0FwTyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGFBQTNCLEVBQTBDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTFDLEVBQWtFO0FBQ2pFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQSxNQUE3QztBQUFxRHFGLG9CQUFpQjtBQUF0RSxHQUEzQixDQUFuQjs7QUFFQSxNQUFJUyxXQUFXVyxJQUFmLEVBQXFCO0FBQ3BCLFVBQU83TCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTJCLHNCQUFzQm9LLFdBQVdySSxJQUFNLGtDQUFsRSxDQUFQO0FBQ0E7O0FBRUQrQixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLFVBQVosRUFBd0JxRyxXQUFXYSxHQUFuQztBQUNBLEdBRkQ7QUFJQSxTQUFPL0wsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBYmdFLENBQWxFO0FBZ0JBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHdCQUEzQixFQUFxRDtBQUFFNkMsZUFBYztBQUFoQixDQUFyRCxFQUE2RTtBQUM1RUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhZ0gsMkJBQTJCO0FBQUVoSixXQUFRLEtBQUtDLGFBQUwsRUFBVjtBQUFnQy9ELFdBQVEsS0FBS0E7QUFBN0MsR0FBM0IsQ0FBbkI7QUFFQSxRQUFNbEMsT0FBTyxLQUFLbUksaUJBQUwsRUFBYjtBQUVBekcsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxxQkFBWixFQUFtQ3FHLFdBQVdhLEdBQTlDLEVBQW1EN0ksS0FBS2dDLEdBQXhEO0FBQ0EsR0FGRDtBQUlBLFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFYMkUsQ0FBN0U7QUFjQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixvQkFBM0IsRUFBaUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBakQsRUFBeUU7QUFDeEVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBO0FBQTdDLEdBQTNCLENBQW5CO0FBRUEsUUFBTWxDLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksaUJBQVosRUFBK0JxRyxXQUFXYSxHQUExQyxFQUErQzdJLEtBQUtnQyxHQUFwRDtBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBWHVFLENBQXpFO0FBY0FULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIscUJBQTNCLEVBQWtEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWxELEVBQTBFO0FBQ3pFQyxRQUFPO0FBQ04sUUFBTWdILGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUVBLFFBQU1sQyxPQUFPLEtBQUttSSxpQkFBTCxFQUFiO0FBRUF6RyxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2EsR0FBM0MsRUFBZ0Q3SSxLQUFLZ0MsR0FBckQ7QUFDQSxHQUZEO0FBSUEsU0FBT2xGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQVh3RSxDQUExRTtBQWNBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGVBQTNCLEVBQTRDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTVDLEVBQW9FO0FBQ25FQyxRQUFPO0FBQ04sTUFBSSxDQUFDLEtBQUtqQixVQUFMLENBQWdCSixJQUFqQixJQUF5QixDQUFDLEtBQUtJLFVBQUwsQ0FBZ0JKLElBQWhCLENBQXFCdUcsSUFBckIsRUFBOUIsRUFBMkQ7QUFDMUQsVUFBT3BKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsa0NBQTFCLENBQVA7QUFDQTs7QUFFRCxRQUFNb0ssYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUTtBQUFFeUIsWUFBUSxLQUFLMUgsVUFBTCxDQUFnQjBIO0FBQTFCLElBQVY7QUFBNkN2RixXQUFRLEtBQUtBO0FBQTFELEdBQTNCLENBQW5CO0FBRUFSLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksa0JBQVosRUFBZ0NxRyxXQUFXYSxHQUEzQyxFQUFnRCxVQUFoRCxFQUE0RCxLQUFLOUksVUFBTCxDQUFnQkosSUFBNUU7QUFDQSxHQUZEO0FBSUEsU0FBTzdDLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENpQyxVQUFPMUMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2EsR0FBL0MsRUFBb0Q7QUFBRWxDLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHlCLEdBQTFCLENBQVA7QUFHQTs7QUFma0UsQ0FBcEU7QUFrQkEyQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHVCQUEzQixFQUFvRDtBQUFFNkMsZUFBYztBQUFoQixDQUFwRCxFQUE0RTtBQUMzRUMsUUFBTztBQUNOLE1BQUksQ0FBQyxLQUFLakIsVUFBTCxDQUFnQnFMLFdBQWpCLElBQWdDLENBQUMsS0FBS3JMLFVBQUwsQ0FBZ0JxTCxXQUFoQixDQUE0QmxGLElBQTVCLEVBQXJDLEVBQXlFO0FBQ3hFLFVBQU9wSixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHlDQUExQixDQUFQO0FBQ0E7O0FBRUQsUUFBTW9LLGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjtBQUVBUixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDcUcsV0FBV2EsR0FBM0MsRUFBZ0QsaUJBQWhELEVBQW1FLEtBQUs5SSxVQUFMLENBQWdCcUwsV0FBbkY7QUFDQSxHQUZEO0FBSUEsU0FBT3RPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEM2TixnQkFBYSxLQUFLckwsVUFBTCxDQUFnQnFMO0FBREcsR0FBMUIsQ0FBUDtBQUdBOztBQWYwRSxDQUE1RTtBQWtCQXRPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsbUJBQTNCLEVBQWdEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWhELEVBQXdFO0FBQ3ZFQyxRQUFPO0FBQ04sTUFBSSxDQUFDLEtBQUtqQixVQUFMLENBQWdCc0wsT0FBakIsSUFBNEIsQ0FBQyxLQUFLdEwsVUFBTCxDQUFnQnNMLE9BQWhCLENBQXdCbkYsSUFBeEIsRUFBakMsRUFBaUU7QUFDaEUsVUFBT3BKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIscUNBQTFCLENBQVA7QUFDQTs7QUFFRCxRQUFNb0ssYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBO0FBQTdDLEdBQTNCLENBQW5CO0FBRUFSLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksa0JBQVosRUFBZ0NxRyxXQUFXYSxHQUEzQyxFQUFnRCxpQkFBaEQsRUFBbUUsS0FBSzlJLFVBQUwsQ0FBZ0JzTCxPQUFuRjtBQUNBLEdBRkQ7QUFJQSxTQUFPdk8sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQzhOLFlBQVMsS0FBS3RMLFVBQUwsQ0FBZ0JzTDtBQURPLEdBQTFCLENBQVA7QUFHQTs7QUFmc0UsQ0FBeEU7QUFrQkF2TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG9CQUEzQixFQUFpRDtBQUFFNkMsZUFBYztBQUFoQixDQUFqRCxFQUF5RTtBQUN4RUMsUUFBTztBQUNOLE1BQUksT0FBTyxLQUFLakIsVUFBTCxDQUFnQjZJLFFBQXZCLEtBQW9DLFdBQXhDLEVBQXFEO0FBQ3BELFVBQU85TCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHNDQUExQixDQUFQO0FBQ0E7O0FBRUQsUUFBTW9LLGFBQWFnSCwyQkFBMkI7QUFBRWhKLFdBQVEsS0FBS0MsYUFBTCxFQUFWO0FBQWdDL0QsV0FBUSxLQUFLQTtBQUE3QyxHQUEzQixDQUFuQjs7QUFFQSxNQUFJOEYsV0FBV3NELEVBQVgsS0FBa0IsS0FBS3ZMLFVBQUwsQ0FBZ0I2SSxRQUF0QyxFQUFnRDtBQUMvQyxVQUFPOUwsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixpRkFBMUIsQ0FBUDtBQUNBOztBQUVEOEQsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxrQkFBWixFQUFnQ3FHLFdBQVdhLEdBQTNDLEVBQWdELFVBQWhELEVBQTRELEtBQUs5SSxVQUFMLENBQWdCNkksUUFBNUU7QUFDQSxHQUZEO0FBSUEsU0FBTzlMLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENpQyxVQUFPMUMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2EsR0FBL0MsRUFBb0Q7QUFBRWxDLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHlCLEdBQTFCLENBQVA7QUFHQTs7QUFuQnVFLENBQXpFO0FBc0JBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixpQkFBM0IsRUFBOEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBOUMsRUFBc0U7QUFDckVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0J3TCxLQUFqQixJQUEwQixDQUFDLEtBQUt4TCxVQUFMLENBQWdCd0wsS0FBaEIsQ0FBc0JyRixJQUF0QixFQUEvQixFQUE2RDtBQUM1RCxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixtQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhZ0gsMkJBQTJCO0FBQUVoSixXQUFRLEtBQUtDLGFBQUwsRUFBVjtBQUFnQy9ELFdBQVEsS0FBS0E7QUFBN0MsR0FBM0IsQ0FBbkI7QUFFQVIsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxrQkFBWixFQUFnQ3FHLFdBQVdhLEdBQTNDLEVBQWdELFdBQWhELEVBQTZELEtBQUs5SSxVQUFMLENBQWdCd0wsS0FBN0U7QUFDQSxHQUZEO0FBSUEsU0FBT3pPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENnTyxVQUFPLEtBQUt4TCxVQUFMLENBQWdCd0w7QUFEUyxHQUExQixDQUFQO0FBR0E7O0FBZm9FLENBQXRFO0FBa0JBek8sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixnQkFBM0IsRUFBNkM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBN0MsRUFBcUU7QUFDcEVDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0JrRixJQUFqQixJQUF5QixDQUFDLEtBQUtsRixVQUFMLENBQWdCa0YsSUFBaEIsQ0FBcUJpQixJQUFyQixFQUE5QixFQUEyRDtBQUMxRCxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixrQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhZ0gsMkJBQTJCO0FBQUVoSixXQUFRLEtBQUtDLGFBQUwsRUFBVjtBQUFnQy9ELFdBQVEsS0FBS0E7QUFBN0MsR0FBM0IsQ0FBbkI7O0FBRUEsTUFBSThGLFdBQVdGLENBQVgsS0FBaUIsS0FBSy9ILFVBQUwsQ0FBZ0JrRixJQUFyQyxFQUEyQztBQUMxQyxVQUFPbkksV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixvRUFBMUIsQ0FBUDtBQUNBOztBQUVEOEQsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxrQkFBWixFQUFnQ3FHLFdBQVdhLEdBQTNDLEVBQWdELFVBQWhELEVBQTRELEtBQUs5SSxVQUFMLENBQWdCa0YsSUFBNUU7QUFDQSxHQUZEO0FBSUEsU0FBT25JLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENpQyxVQUFPMUMsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9DMkIsV0FBV2EsR0FBL0MsRUFBb0Q7QUFBRWxDLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQXBEO0FBRHlCLEdBQTFCLENBQVA7QUFHQTs7QUFuQm1FLENBQXJFO0FBc0JBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixrQkFBM0IsRUFBK0M7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBL0MsRUFBdUU7QUFDdEVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYWdILDJCQUEyQjtBQUFFaEosV0FBUSxLQUFLQyxhQUFMLEVBQVY7QUFBZ0MvRCxXQUFRLEtBQUtBLE1BQTdDO0FBQXFEcUYsb0JBQWlCO0FBQXRFLEdBQTNCLENBQW5CO0FBRUE3RixTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsVUFBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkJxRyxXQUFXYSxHQUF4QztBQUNBLEdBRkQ7QUFJQSxTQUFPL0wsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBVHFFLENBQXZFLEU7Ozs7Ozs7Ozs7O0FDbm5CQSxJQUFJckQsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDs7QUFFTixTQUFTZ1YscUJBQVQsQ0FBK0J2SixNQUEvQixFQUF1Q2hHLElBQXZDLEVBQTZDO0FBQzVDLEtBQUksQ0FBQyxDQUFDZ0csT0FBT3lCLE1BQVIsSUFBa0IsQ0FBQ3pCLE9BQU95QixNQUFQLENBQWN2QixJQUFkLEVBQXBCLE1BQThDLENBQUNGLE9BQU8vRixRQUFSLElBQW9CLENBQUMrRixPQUFPL0YsUUFBUCxDQUFnQmlHLElBQWhCLEVBQW5FLENBQUosRUFBZ0c7QUFDL0YsUUFBTSxJQUFJeEUsT0FBTzZFLEtBQVgsQ0FBaUIsK0JBQWpCLEVBQWtELCtDQUFsRCxDQUFOO0FBQ0E7O0FBRUQsT0FBTW9CLE9BQU83SyxXQUFXMFMsaUNBQVgsQ0FBNkM7QUFDekRDLGlCQUFlelAsS0FBS2dDLEdBRHFDO0FBRXpEME4sWUFBVTFKLE9BQU8vRixRQUFQLElBQW1CK0YsT0FBT3lCLE1BRnFCO0FBR3pEeEMsUUFBTTtBQUhtRCxFQUE3QyxDQUFiOztBQU1BLEtBQUksQ0FBQzBDLElBQUQsSUFBU0EsS0FBS0csQ0FBTCxLQUFXLEdBQXhCLEVBQTZCO0FBQzVCLFFBQU0sSUFBSXBHLE9BQU82RSxLQUFYLENBQWlCLHNCQUFqQixFQUF5QyxxRkFBekMsQ0FBTjtBQUNBOztBQUVELE9BQU1vSixlQUFlN1MsV0FBV3FKLE1BQVgsQ0FBa0JzQyxhQUFsQixDQUFnQ0Msd0JBQWhDLENBQXlEZixLQUFLM0YsR0FBOUQsRUFBbUVoQyxLQUFLZ0MsR0FBeEUsQ0FBckI7QUFFQSxRQUFPO0FBQ04yRixNQURNO0FBRU5nSTtBQUZNLEVBQVA7QUFJQTs7QUFFRDdTLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsQ0FBQyxXQUFELEVBQWMsV0FBZCxDQUEzQixFQUF1RDtBQUFFNkMsZUFBYztBQUFoQixDQUF2RCxFQUErRTtBQUM5RUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhdUgsc0JBQXNCLEtBQUt0SixhQUFMLEVBQXRCLEVBQTRDLEtBQUtqRyxJQUFqRCxDQUFuQjtBQUVBLFNBQU9sRCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDb0ssU0FBTUssV0FBV0w7QUFEZSxHQUExQixDQUFQO0FBR0E7O0FBUDZFLENBQS9FO0FBVUE3SyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLENBQUMsVUFBRCxFQUFhLFVBQWIsQ0FBM0IsRUFBcUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBckQsRUFBNkU7QUFDNUVDLFFBQU87QUFDTixRQUFNZ0gsYUFBYXVILHNCQUFzQixLQUFLdEosYUFBTCxFQUF0QixFQUE0QyxLQUFLakcsSUFBakQsQ0FBbkI7O0FBRUEsTUFBSSxDQUFDZ0ksV0FBVzJILFlBQVgsQ0FBd0JoSCxJQUE3QixFQUFtQztBQUNsQyxVQUFPN0wsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEyQiw0QkFBNEIsS0FBS21DLFVBQUwsQ0FBZ0JKLElBQU0sbUNBQTdFLENBQVA7QUFDQTs7QUFFRCtCLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksVUFBWixFQUF3QnFHLFdBQVdMLElBQVgsQ0FBZ0IzRixHQUF4QztBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBYjJFLENBQTdFO0FBZ0JBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLENBQUMsVUFBRCxFQUFhLFVBQWIsQ0FBM0IsRUFBcUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBckQsRUFBNkU7QUFDNUUvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWF1SCxzQkFBc0IsS0FBS3RKLGFBQUwsRUFBdEIsRUFBNEMsS0FBS2pHLElBQWpELENBQW5CO0FBRUEsUUFBTTtBQUFFMEYsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxRQUFNQyxXQUFXdkssT0FBT3lJLE1BQVAsQ0FBYyxFQUFkLEVBQWtCQyxLQUFsQixFQUF5QjtBQUFFMEIsUUFBS2IsV0FBV0wsSUFBWCxDQUFnQjNGO0FBQXZCLEdBQXpCLENBQWpCO0FBRUEsUUFBTWlILFFBQVFuTSxXQUFXcUosTUFBWCxDQUFrQitDLE9BQWxCLENBQTBCQyxJQUExQixDQUErQkgsUUFBL0IsRUFBeUM7QUFDdER0QyxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRS9HLFVBQU07QUFBUixJQURrQztBQUV0RHlKLFNBQU0xRCxNQUZnRDtBQUd0RDJELFVBQU96RCxLQUgrQztBQUl0RGU7QUFKc0QsR0FBekMsRUFLWDJDLEtBTFcsRUFBZDtBQU9BLFNBQU94TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDMEwsUUFEZ0M7QUFFaENyRCxVQUFPcUQsTUFBTTNJLE1BRm1CO0FBR2hDb0YsU0FIZ0M7QUFJaEM2RCxVQUFPek0sV0FBV3FKLE1BQVgsQ0FBa0IrQyxPQUFsQixDQUEwQkMsSUFBMUIsQ0FBK0JILFFBQS9CLEVBQXlDcEQsS0FBekM7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQXRCMkUsQ0FBN0U7QUF5QkE5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLENBQUMsWUFBRCxFQUFlLFlBQWYsQ0FBM0IsRUFBeUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBekQsRUFBaUY7QUFDaEYvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWF1SCxzQkFBc0IsS0FBS3RKLGFBQUwsRUFBdEIsRUFBNEMsS0FBS2pHLElBQWpELENBQW5CO0FBRUEsTUFBSTZKLGFBQWEsSUFBSXZCLElBQUosRUFBakI7O0FBQ0EsTUFBSSxLQUFLaEQsV0FBTCxDQUFpQjhDLE1BQXJCLEVBQTZCO0FBQzVCeUIsZ0JBQWEsSUFBSXZCLElBQUosQ0FBUyxLQUFLaEQsV0FBTCxDQUFpQjhDLE1BQTFCLENBQWI7QUFDQTs7QUFFRCxNQUFJMEIsYUFBYS9GLFNBQWpCOztBQUNBLE1BQUksS0FBS3VCLFdBQUwsQ0FBaUIrQyxNQUFyQixFQUE2QjtBQUM1QnlCLGdCQUFhLElBQUl4QixJQUFKLENBQVMsS0FBS2hELFdBQUwsQ0FBaUIrQyxNQUExQixDQUFiO0FBQ0E7O0FBRUQsTUFBSUUsWUFBWSxLQUFoQjs7QUFDQSxNQUFJLEtBQUtqRCxXQUFMLENBQWlCaUQsU0FBckIsRUFBZ0M7QUFDL0JBLGVBQVksS0FBS2pELFdBQUwsQ0FBaUJpRCxTQUE3QjtBQUNBOztBQUVELE1BQUkzQyxRQUFRLEVBQVo7O0FBQ0EsTUFBSSxLQUFLTixXQUFMLENBQWlCTSxLQUFyQixFQUE0QjtBQUMzQkEsV0FBUUQsU0FBUyxLQUFLTCxXQUFMLENBQWlCTSxLQUExQixDQUFSO0FBQ0E7O0FBRUQsTUFBSW1FLFVBQVUsS0FBZDs7QUFDQSxNQUFJLEtBQUt6RSxXQUFMLENBQWlCeUUsT0FBckIsRUFBOEI7QUFDN0JBLGFBQVUsS0FBS3pFLFdBQUwsQ0FBaUJ5RSxPQUEzQjtBQUNBOztBQUVELE1BQUl2TSxNQUFKO0FBQ0FrRSxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQzFFLFlBQVNrRSxPQUFPQyxJQUFQLENBQVksbUJBQVosRUFBaUM7QUFDekNrSCxTQUFLYixXQUFXTCxJQUFYLENBQWdCM0YsR0FEb0I7QUFFekNvRyxZQUFReUIsVUFGaUM7QUFHekN4QixZQUFReUIsVUFIaUM7QUFJekN2QixhQUp5QztBQUt6QzNDLFNBTHlDO0FBTXpDbUU7QUFOeUMsSUFBakMsQ0FBVDtBQVFBLEdBVEQ7O0FBV0EsTUFBSSxDQUFDdk0sTUFBTCxFQUFhO0FBQ1osVUFBT1YsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0E7O0FBRUQsU0FBT2pCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEJDLE1BQTFCLENBQVA7QUFDQTs7QUE5QytFLENBQWpGO0FBaURBVixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLENBQUMsWUFBRCxFQUFlLFlBQWYsQ0FBM0IsRUFBeUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBekQsRUFBaUY7QUFDaEYvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWF1SCxzQkFBc0IsS0FBS3RKLGFBQUwsRUFBdEIsRUFBNEMsS0FBS2pHLElBQWpELENBQW5CO0FBRUEsUUFBTTtBQUFFMEYsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDO0FBQUYsTUFBVyxLQUFLcUMsY0FBTCxFQUFqQjtBQUVBLFFBQU14TixVQUFVdUIsV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QndDLDJCQUF4QixDQUFvRE0sTUFBTUMsSUFBTixDQUFXM0MsV0FBV0wsSUFBWCxDQUFnQm5NLFNBQTNCLENBQXBELEVBQTJGO0FBQzFHa0wsU0FBTUEsT0FBT0EsSUFBUCxHQUFjLENBQUMsQ0FEcUY7QUFFMUcwQyxTQUFNMUQsTUFGb0c7QUFHMUcyRCxVQUFPekQ7QUFIbUcsR0FBM0YsQ0FBaEI7QUFNQSxRQUFNOUQsUUFBUWhGLFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QitDLElBQXhCLENBQTZCO0FBQUVsSixhQUFVO0FBQUV3SixTQUFLbE87QUFBUDtBQUFaLEdBQTdCLEVBQ2I7QUFBRW9MLFdBQVE7QUFBRTNFLFNBQUssQ0FBUDtBQUFVL0IsY0FBVSxDQUFwQjtBQUF1Qk4sVUFBTSxDQUE3QjtBQUFnQ2tDLFlBQVEsQ0FBeEM7QUFBMkMrSSxlQUFXO0FBQXREO0FBQVYsR0FEYSxFQUMwRHRCLEtBRDFELEVBQWQ7QUFHQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ2hDLFlBQVN1RyxLQUR1QjtBQUVoQzhELFVBQU9ySyxRQUFRK0UsTUFGaUI7QUFHaENvRixTQUhnQztBQUloQzZELFVBQU92QixXQUFXTCxJQUFYLENBQWdCbk0sU0FBaEIsQ0FBMEI4RTtBQUpELEdBQTFCLENBQVA7QUFNQTs7QUF0QitFLENBQWpGO0FBeUJBeEQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixDQUFDLGFBQUQsRUFBZ0IsYUFBaEIsQ0FBM0IsRUFBMkQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBM0QsRUFBbUY7QUFDbEYvRCxPQUFNO0FBQ0wsUUFBTWdMLGFBQWF1SCxzQkFBc0IsS0FBS3RKLGFBQUwsRUFBdEIsRUFBNEMsS0FBS2pHLElBQWpELENBQW5CO0FBRUEsUUFBTTtBQUFFMEYsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQXJGLFVBQVFrTSxHQUFSLENBQVk1SCxVQUFaO0FBQ0EsUUFBTWdCLFdBQVd2SyxPQUFPeUksTUFBUCxDQUFjLEVBQWQsRUFBa0JDLEtBQWxCLEVBQXlCO0FBQUUwQixRQUFLYixXQUFXTCxJQUFYLENBQWdCM0Y7QUFBdkIsR0FBekIsQ0FBakI7QUFFQSxRQUFNNkksV0FBVy9OLFdBQVdxSixNQUFYLENBQWtCMkUsUUFBbEIsQ0FBMkIzQixJQUEzQixDQUFnQ0gsUUFBaEMsRUFBMEM7QUFDMUR0QyxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRXFFLFFBQUksQ0FBQztBQUFQLElBRHNDO0FBRTFEM0IsU0FBTTFELE1BRm9EO0FBRzFEMkQsVUFBT3pELEtBSG1EO0FBSTFEZTtBQUowRCxHQUExQyxFQUtkMkMsS0FMYyxFQUFqQjtBQU9BLFNBQU94TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDc04sV0FEZ0M7QUFFaENqRixVQUFPaUYsU0FBU3ZLLE1BRmdCO0FBR2hDb0YsU0FIZ0M7QUFJaEM2RCxVQUFPek0sV0FBV3FKLE1BQVgsQ0FBa0IyRSxRQUFsQixDQUEyQjNCLElBQTNCLENBQWdDSCxRQUFoQyxFQUEwQ3BELEtBQTFDO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUF2QmlGLENBQW5GO0FBMEJBOUksV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixDQUFDLG9CQUFELEVBQXVCLG9CQUF2QixDQUEzQixFQUF5RTtBQUFFNkMsZUFBYztBQUFoQixDQUF6RSxFQUFpRztBQUNoRy9ELE9BQU07QUFDTCxNQUFJRixXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3Qiw0Q0FBeEIsTUFBMEUsSUFBOUUsRUFBb0Y7QUFDbkYsU0FBTSxJQUFJMEUsT0FBTzZFLEtBQVgsQ0FBaUIseUJBQWpCLEVBQTRDLDJCQUE1QyxFQUF5RTtBQUFFL0gsV0FBTztBQUFULElBQXpFLENBQU47QUFDQTs7QUFFRCxNQUFJLENBQUMxQixXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLDBCQUE1QyxDQUFMLEVBQThFO0FBQzdFLFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxRQUFNMEosU0FBUyxLQUFLbkMsV0FBTCxDQUFpQm1DLE1BQWhDOztBQUNBLE1BQUksQ0FBQ0EsTUFBRCxJQUFXLENBQUNBLE9BQU92QixJQUFQLEVBQWhCLEVBQStCO0FBQzlCLFNBQU0sSUFBSXhFLE9BQU82RSxLQUFYLENBQWlCLGlDQUFqQixFQUFvRCxvQ0FBcEQsQ0FBTjtBQUNBOztBQUVELFFBQU1vQixPQUFPN0ssV0FBV3FKLE1BQVgsQ0FBa0J5QixLQUFsQixDQUF3QnZCLFdBQXhCLENBQW9Db0IsTUFBcEMsQ0FBYjs7QUFDQSxNQUFJLENBQUNFLElBQUQsSUFBU0EsS0FBS0csQ0FBTCxLQUFXLEdBQXhCLEVBQTZCO0FBQzVCLFNBQU0sSUFBSXBHLE9BQU82RSxLQUFYLENBQWlCLHNCQUFqQixFQUEwQyw4Q0FBOENrQixNQUFRLEVBQWhHLENBQU47QUFDQTs7QUFFRCxRQUFNO0FBQUUvQixTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQyxTQUFSO0FBQWdCUTtBQUFoQixNQUEwQixLQUFLNEIsY0FBTCxFQUFoQztBQUNBLFFBQU1DLFdBQVd2SyxPQUFPeUksTUFBUCxDQUFjLEVBQWQsRUFBa0JDLEtBQWxCLEVBQXlCO0FBQUUwQixRQUFLbEIsS0FBSzNGO0FBQVosR0FBekIsQ0FBakI7QUFFQSxRQUFNNk4sT0FBTy9TLFdBQVdxSixNQUFYLENBQWtCMkUsUUFBbEIsQ0FBMkIzQixJQUEzQixDQUFnQ0gsUUFBaEMsRUFBMEM7QUFDdER0QyxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRXFFLFFBQUksQ0FBQztBQUFQLElBRGtDO0FBRXREM0IsU0FBTTFELE1BRmdEO0FBR3REMkQsVUFBT3pELEtBSCtDO0FBSXREZTtBQUpzRCxHQUExQyxFQUtWMkMsS0FMVSxFQUFiO0FBT0EsU0FBT3hNLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENzTixhQUFVZ0YsSUFEc0I7QUFFaENuSyxTQUZnQztBQUdoQ0UsVUFBT2lLLEtBQUt2UCxNQUhvQjtBQUloQ2lKLFVBQU96TSxXQUFXcUosTUFBWCxDQUFrQjJFLFFBQWxCLENBQTJCM0IsSUFBM0IsQ0FBZ0NILFFBQWhDLEVBQTBDcEQsS0FBMUM7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQXJDK0YsQ0FBakc7QUF3Q0E5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLENBQUMsU0FBRCxFQUFZLFNBQVosQ0FBM0IsRUFBbUQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBbkQsRUFBMkU7QUFDMUUvRCxPQUFNO0FBQ0wsUUFBTTtBQUFFMEksU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUM7QUFBUixNQUFtQixLQUFLb0MsY0FBTCxFQUF6Qjs7QUFDQSxNQUFJaUIsUUFBUTlQLEVBQUUrUCxLQUFGLENBQVFuTixXQUFXcUosTUFBWCxDQUFrQnNDLGFBQWxCLENBQWdDeUIsbUJBQWhDLENBQW9ELEdBQXBELEVBQXlELEtBQUtoSSxNQUE5RCxFQUFzRW9ILEtBQXRFLEVBQVIsRUFBdUYsT0FBdkYsQ0FBWjs7QUFDQSxRQUFNYSxhQUFhSCxNQUFNMUosTUFBekI7QUFFQTBKLFVBQVFsTixXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCd0MsMkJBQXhCLENBQW9ESixLQUFwRCxFQUEyRDtBQUNsRXRELFNBQU1BLE9BQU9BLElBQVAsR0FBYztBQUFFL0csVUFBTTtBQUFSLElBRDhDO0FBRWxFeUosU0FBTTFELE1BRjREO0FBR2xFMkQsVUFBT3pELEtBSDJEO0FBSWxFZTtBQUprRSxHQUEzRCxDQUFSO0FBT0EsU0FBTzdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEN1UyxRQUFLOUYsS0FEMkI7QUFFaEN0RSxTQUZnQztBQUdoQ0UsVUFBT29FLE1BQU0xSixNQUhtQjtBQUloQ2lKLFVBQU9ZO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUFwQnlFLENBQTNFO0FBdUJBck4sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixDQUFDLGtCQUFELEVBQXFCLGtCQUFyQixDQUEzQixFQUFxRTtBQUFFNkMsZUFBYztBQUFoQixDQUFyRSxFQUE2RjtBQUM1Ri9ELE9BQU07QUFDTCxNQUFJLENBQUNGLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsMEJBQTVDLENBQUwsRUFBOEU7QUFDN0UsVUFBT3BGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUVELFFBQU07QUFBRTJILFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQyxPQUFGO0FBQVFDLFNBQVI7QUFBZ0JRO0FBQWhCLE1BQTBCLEtBQUs0QixjQUFMLEVBQWhDO0FBRUEsUUFBTUMsV0FBV3ZLLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQkMsS0FBbEIsRUFBeUI7QUFBRVcsTUFBRztBQUFMLEdBQXpCLENBQWpCO0FBRUEsUUFBTWtDLFFBQVFsTixXQUFXcUosTUFBWCxDQUFrQnlCLEtBQWxCLENBQXdCdUIsSUFBeEIsQ0FBNkJILFFBQTdCLEVBQXVDO0FBQ3BEdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUUvRyxVQUFNO0FBQVIsSUFEZ0M7QUFFcER5SixTQUFNMUQsTUFGOEM7QUFHcEQyRCxVQUFPekQsS0FINkM7QUFJcERlO0FBSm9ELEdBQXZDLEVBS1gyQyxLQUxXLEVBQWQ7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3VTLFFBQUs5RixLQUQyQjtBQUVoQ3RFLFNBRmdDO0FBR2hDRSxVQUFPb0UsTUFBTTFKLE1BSG1CO0FBSWhDaUosVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCeUIsS0FBbEIsQ0FBd0J1QixJQUF4QixDQUE2QkgsUUFBN0IsRUFBdUNwRCxLQUF2QztBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBeEIyRixDQUE3RjtBQTJCQTlJLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsQ0FBQyxTQUFELEVBQVksU0FBWixDQUEzQixFQUFtRDtBQUFFNkMsZUFBYztBQUFoQixDQUFuRCxFQUEyRTtBQUMxRUMsUUFBTztBQUNOLFFBQU1nSCxhQUFhdUgsc0JBQXNCLEtBQUt0SixhQUFMLEVBQXRCLEVBQTRDLEtBQUtqRyxJQUFqRCxDQUFuQjs7QUFFQSxNQUFJLENBQUNnSSxXQUFXMkgsWUFBWCxDQUF3QmhILElBQTdCLEVBQW1DO0FBQ2xDakgsVUFBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFdBQU9DLElBQVAsQ0FBWSxVQUFaLEVBQXdCcUcsV0FBV0wsSUFBWCxDQUFnQjNGLEdBQXhDO0FBQ0EsSUFGRDtBQUdBOztBQUVELFNBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFYeUUsQ0FBM0U7QUFjQVQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixDQUFDLGFBQUQsRUFBZ0IsYUFBaEIsQ0FBM0IsRUFBMkQ7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBM0QsRUFBbUY7QUFDbEZDLFFBQU87QUFDTixNQUFJLENBQUMsS0FBS2pCLFVBQUwsQ0FBZ0J3TCxLQUFqQixJQUEwQixDQUFDLEtBQUt4TCxVQUFMLENBQWdCd0wsS0FBaEIsQ0FBc0JyRixJQUF0QixFQUEvQixFQUE2RDtBQUM1RCxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQixtQ0FBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1vSyxhQUFhdUgsc0JBQXNCLEtBQUt0SixhQUFMLEVBQXRCLEVBQTRDLEtBQUtqRyxJQUFqRCxDQUFuQjtBQUVBMEIsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFVBQU9DLElBQVAsQ0FBWSxrQkFBWixFQUFnQ3FHLFdBQVdMLElBQVgsQ0FBZ0IzRixHQUFoRCxFQUFxRCxXQUFyRCxFQUFrRSxLQUFLakMsVUFBTCxDQUFnQndMLEtBQWxGO0FBQ0EsR0FGRDtBQUlBLFNBQU96TyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDZ08sVUFBTyxLQUFLeEwsVUFBTCxDQUFnQndMO0FBRFMsR0FBMUIsQ0FBUDtBQUdBOztBQWZpRixDQUFuRixFOzs7Ozs7Ozs7OztBQ3hSQXpPLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIscUJBQTNCLEVBQWtEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWxELEVBQTBFO0FBQ3pFQyxRQUFPO0FBQ05xTSxRQUFNLEtBQUt0TixVQUFYLEVBQXVCeUssTUFBTThDLGVBQU4sQ0FBc0I7QUFDNUNySSxTQUFNdUksTUFEc0M7QUFFNUM3TixTQUFNNk4sTUFGc0M7QUFHNUN1QyxZQUFTcEMsT0FIbUM7QUFJNUMxTixhQUFVdU4sTUFKa0M7QUFLNUN3QyxTQUFNeEYsTUFBTWtELEtBQU4sQ0FBWSxDQUFDRixNQUFELENBQVosQ0FMc0M7QUFNNUNsTyxZQUFTa08sTUFObUM7QUFPNUN5QyxVQUFPekYsTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQVBxQztBQVE1QzBDLGlCQUFjMUYsTUFBTWtELEtBQU4sQ0FBWSxDQUFDRixNQUFELENBQVosQ0FSOEI7QUFTNUMyQyxVQUFPM0YsTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQVRxQztBQVU1QzRDLFdBQVE1RixNQUFNa0QsS0FBTixDQUFZRixNQUFaLENBVm9DO0FBVzVDNkMsVUFBTzdGLE1BQU1rRCxLQUFOLENBQVlGLE1BQVosQ0FYcUM7QUFZNUNsTCxVQUFPa0ksTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQVpxQztBQWE1QzhDLGtCQUFlM0MsT0FiNkI7QUFjNUM0QyxXQUFRL0YsTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQWRvQztBQWU1Q2dELGtCQUFlaEcsTUFBTWtELEtBQU4sQ0FBWUYsTUFBWjtBQWY2QixHQUF0QixDQUF2QjtBQWtCQSxNQUFJaUQsV0FBSjs7QUFFQSxVQUFRLEtBQUsxUSxVQUFMLENBQWdCa0YsSUFBeEI7QUFDQyxRQUFLLGtCQUFMO0FBQ0N2RCxXQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ3VPLG1CQUFjL08sT0FBT0MsSUFBUCxDQUFZLHdCQUFaLEVBQXNDLEtBQUs1QixVQUEzQyxDQUFkO0FBQ0EsS0FGRDtBQUdBOztBQUNELFFBQUssa0JBQUw7QUFDQzJCLFdBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DdU8sbUJBQWMvTyxPQUFPQyxJQUFQLENBQVksd0JBQVosRUFBc0MsS0FBSzVCLFVBQTNDLENBQWQ7QUFDQSxLQUZEO0FBR0E7O0FBQ0Q7QUFDQyxXQUFPakQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQiwyQkFBMUIsQ0FBUDtBQVpGOztBQWVBLFNBQU9kLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFBRWtUO0FBQUYsR0FBMUIsQ0FBUDtBQUNBOztBQXRDd0UsQ0FBMUU7QUF5Q0EzVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHNCQUEzQixFQUFtRDtBQUFFNkMsZUFBYztBQUFoQixDQUFuRCxFQUEyRTtBQUMxRS9ELE9BQU07QUFDTCxNQUFJLENBQUNGLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMscUJBQTVDLENBQUwsRUFBeUU7QUFDeEUsVUFBT3BGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUVELE1BQUksQ0FBQyxLQUFLdUgsV0FBTCxDQUFpQnJELEVBQWxCLElBQXdCLEtBQUtxRCxXQUFMLENBQWlCckQsRUFBakIsQ0FBb0JpRSxJQUFwQixPQUErQixFQUEzRCxFQUErRDtBQUM5RCxVQUFPcEosV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix5QkFBMUIsQ0FBUDtBQUNBOztBQUVELFFBQU1xRSxLQUFLLEtBQUtxRCxXQUFMLENBQWlCckQsRUFBNUI7QUFDQSxRQUFNO0FBQUV5RCxTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQyxTQUFSO0FBQWdCUTtBQUFoQixNQUEwQixLQUFLNEIsY0FBTCxFQUFoQztBQUVBLFFBQU1DLFdBQVd2SyxPQUFPeUksTUFBUCxDQUFjLEVBQWQsRUFBa0JDLEtBQWxCLEVBQXlCO0FBQUUsc0JBQW1CbEY7QUFBckIsR0FBekIsQ0FBakI7QUFDQSxRQUFNeU8sVUFBVTVULFdBQVdxSixNQUFYLENBQWtCd0ssa0JBQWxCLENBQXFDeEgsSUFBckMsQ0FBMENILFFBQTFDLEVBQW9EO0FBQ25FdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUVwSyxnQkFBWSxDQUFDO0FBQWYsSUFEK0M7QUFFbkU4TSxTQUFNMUQsTUFGNkQ7QUFHbkUyRCxVQUFPekQsS0FINEQ7QUFJbkVlO0FBSm1FLEdBQXBELEVBS2IyQyxLQUxhLEVBQWhCO0FBT0EsU0FBT3hNLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENtVCxVQURnQztBQUVoQ2hMLFNBRmdDO0FBR2hDa0wsVUFBT0YsUUFBUXBRLE1BSGlCO0FBSWhDaUosVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCd0ssa0JBQWxCLENBQXFDeEgsSUFBckMsQ0FBMENILFFBQTFDLEVBQW9EcEQsS0FBcEQ7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQTVCeUUsQ0FBM0U7QUErQkE5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG1CQUEzQixFQUFnRDtBQUFFNkMsZUFBYztBQUFoQixDQUFoRCxFQUF3RTtBQUN2RS9ELE9BQU07QUFDTCxNQUFJLENBQUNGLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMscUJBQTVDLENBQUwsRUFBeUU7QUFDeEUsVUFBT3BGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUVELFFBQU07QUFBRTJILFNBQUY7QUFBVUU7QUFBVixNQUFvQixLQUFLa0Qsa0JBQUwsRUFBMUI7QUFDQSxRQUFNO0FBQUVwQyxPQUFGO0FBQVFDLFNBQVI7QUFBZ0JRO0FBQWhCLE1BQTBCLEtBQUs0QixjQUFMLEVBQWhDO0FBRUEsUUFBTUMsV0FBV3ZLLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQkMsS0FBbEIsQ0FBakI7QUFDQSxRQUFNdUMsZUFBZTVNLFdBQVdxSixNQUFYLENBQWtCd0QsWUFBbEIsQ0FBK0JSLElBQS9CLENBQW9DSCxRQUFwQyxFQUE4QztBQUNsRXRDLFNBQU1BLE9BQU9BLElBQVAsR0FBYztBQUFFcUUsUUFBSSxDQUFDO0FBQVAsSUFEOEM7QUFFbEUzQixTQUFNMUQsTUFGNEQ7QUFHbEUyRCxVQUFPekQsS0FIMkQ7QUFJbEVlO0FBSmtFLEdBQTlDLEVBS2xCMkMsS0FMa0IsRUFBckI7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ21NLGVBRGdDO0FBRWhDaEUsU0FGZ0M7QUFHaENrTCxVQUFPbEgsYUFBYXBKLE1BSFk7QUFJaENpSixVQUFPek0sV0FBV3FKLE1BQVgsQ0FBa0J3RCxZQUFsQixDQUErQlIsSUFBL0IsQ0FBb0NILFFBQXBDLEVBQThDcEQsS0FBOUM7QUFKeUIsR0FBMUIsQ0FBUDtBQU1BOztBQXZCc0UsQ0FBeEU7QUEwQkE5SSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHFCQUEzQixFQUFrRDtBQUFFNkMsZUFBYztBQUFoQixDQUFsRCxFQUEwRTtBQUN6RUMsUUFBTztBQUNOcU0sUUFBTSxLQUFLdE4sVUFBWCxFQUF1QnlLLE1BQU04QyxlQUFOLENBQXNCO0FBQzVDckksU0FBTXVJLE1BRHNDO0FBRTVDcUQsZUFBWXJHLE1BQU1rRCxLQUFOLENBQVlGLE1BQVosQ0FGZ0M7QUFHNUNzRCxrQkFBZXRHLE1BQU1rRCxLQUFOLENBQVlGLE1BQVo7QUFINkIsR0FBdEIsQ0FBdkI7O0FBTUEsTUFBSSxDQUFDLEtBQUt6TixVQUFMLENBQWdCOFEsVUFBakIsSUFBK0IsQ0FBQyxLQUFLOVEsVUFBTCxDQUFnQitRLGFBQXBELEVBQW1FO0FBQ2xFLFVBQU9oVSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHNEQUExQixDQUFQO0FBQ0E7O0FBRUQsTUFBSTZTLFdBQUo7O0FBQ0EsVUFBUSxLQUFLMVEsVUFBTCxDQUFnQmtGLElBQXhCO0FBQ0MsUUFBSyxrQkFBTDtBQUNDLFFBQUksS0FBS2xGLFVBQUwsQ0FBZ0I4USxVQUFwQixFQUFnQztBQUMvQkosbUJBQWMzVCxXQUFXcUosTUFBWCxDQUFrQndELFlBQWxCLENBQStCNUgsT0FBL0IsQ0FBdUM7QUFBRWlPLFlBQU0sS0FBS2pRLFVBQUwsQ0FBZ0I4UTtBQUF4QixNQUF2QyxDQUFkO0FBQ0EsS0FGRCxNQUVPLElBQUksS0FBSzlRLFVBQUwsQ0FBZ0IrUSxhQUFwQixFQUFtQztBQUN6Q0wsbUJBQWMzVCxXQUFXcUosTUFBWCxDQUFrQndELFlBQWxCLENBQStCNUgsT0FBL0IsQ0FBdUM7QUFBRUMsV0FBSyxLQUFLakMsVUFBTCxDQUFnQitRO0FBQXZCLE1BQXZDLENBQWQ7QUFDQTs7QUFFRCxRQUFJLENBQUNMLFdBQUwsRUFBa0I7QUFDakIsWUFBTzNULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsdUJBQTFCLENBQVA7QUFDQTs7QUFFRDhELFdBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixZQUFPQyxJQUFQLENBQVksMkJBQVosRUFBeUM4TyxZQUFZek8sR0FBckQ7QUFDQSxLQUZEO0FBSUEsV0FBT2xGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENrVDtBQURnQyxLQUExQixDQUFQOztBQUdELFFBQUssa0JBQUw7QUFDQ0Esa0JBQWMzVCxXQUFXcUosTUFBWCxDQUFrQndELFlBQWxCLENBQStCNUgsT0FBL0IsQ0FBdUM7QUFBRUMsVUFBSyxLQUFLakMsVUFBTCxDQUFnQitRO0FBQXZCLEtBQXZDLENBQWQ7O0FBRUEsUUFBSSxDQUFDTCxXQUFMLEVBQWtCO0FBQ2pCLFlBQU8zVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLHVCQUExQixDQUFQO0FBQ0E7O0FBRUQ4RCxXQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ1IsWUFBT0MsSUFBUCxDQUFZLDJCQUFaLEVBQXlDOE8sWUFBWXpPLEdBQXJEO0FBQ0EsS0FGRDtBQUlBLFdBQU9sRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDa1Q7QUFEZ0MsS0FBMUIsQ0FBUDs7QUFHRDtBQUNDLFdBQU8zVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLDJCQUExQixDQUFQO0FBbENGO0FBb0NBOztBQWpEd0UsQ0FBMUUsRTs7Ozs7Ozs7Ozs7QUNsR0EsSUFBSTFELENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFFTnVDLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsTUFBM0IsRUFBbUM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBbkMsRUFBNEQ7QUFDM0QvRCxPQUFNO0FBQ0wsUUFBTWdELE9BQU8sS0FBSzZPLGVBQUwsRUFBYjs7QUFFQSxNQUFJN08sUUFBUWxELFdBQVcrSixLQUFYLENBQWlCa0ssT0FBakIsQ0FBeUIvUSxLQUFLZ0MsR0FBOUIsRUFBbUMsT0FBbkMsQ0FBWixFQUF5RDtBQUN4RCxVQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3lULFVBQU1sVSxXQUFXbVU7QUFEZSxJQUExQixDQUFQO0FBR0E7O0FBRUQsU0FBT25VLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEN5VCxTQUFNO0FBQ0wsZUFBV2xVLFdBQVdtVSxJQUFYLENBQWdCblc7QUFEdEI7QUFEMEIsR0FBMUIsQ0FBUDtBQUtBOztBQWYwRCxDQUE1RDtBQWtCQWdDLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsSUFBM0IsRUFBaUM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBakMsRUFBeUQ7QUFDeEQvRCxPQUFNO0FBQ0wsUUFBTWtVLEtBQUtoWCxFQUFFaVgsSUFBRixDQUFPLEtBQUtuUixJQUFaLEVBQWtCLENBQzVCLEtBRDRCLEVBRTVCLE1BRjRCLEVBRzVCLFFBSDRCLEVBSTVCLFFBSjRCLEVBSzVCLGtCQUw0QixFQU01QixVQU40QixFQU81QixXQVA0QixFQVE1QixRQVI0QixFQVM1QixVQVQ0QixDQUFsQixDQUFYOztBQVlBLFFBQU1vUixnQkFBZ0JGLEdBQUd0VixNQUFILENBQVV1TixJQUFWLENBQWdCakosS0FBRCxJQUFXQSxNQUFNbVIsUUFBaEMsQ0FBdEI7QUFFQUgsS0FBR2hSLEtBQUgsR0FBV2tSLGdCQUFnQkEsY0FBY0UsT0FBOUIsR0FBd0N2TixTQUFuRDtBQUVBLFNBQU9qSCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCMlQsRUFBMUIsQ0FBUDtBQUNBOztBQW5CdUQsQ0FBekQ7QUFzQkEsSUFBSUssY0FBYyxDQUFsQjtBQUNBLElBQUlDLGtCQUFrQixDQUF0QjtBQUNBLE1BQU1DLGVBQWUsS0FBckIsQyxDQUE0Qjs7QUFDNUIzVSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLFlBQTNCLEVBQXlDO0FBQUU2QyxlQUFjO0FBQWhCLENBQXpDLEVBQWtFO0FBQ2pFL0QsT0FBTTtBQUNMLFFBQU07QUFBRWlJLE9BQUY7QUFBUTNGLFVBQVI7QUFBaUJLLE9BQWpCO0FBQXVCK1I7QUFBdkIsTUFBZ0MsS0FBS3BNLFdBQTNDOztBQUNBLE1BQUksQ0FBQ3hJLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLG9CQUF4QixDQUFMLEVBQW9EO0FBQ25ELFNBQU0sSUFBSTBFLE9BQU82RSxLQUFYLENBQWlCLHlCQUFqQixFQUE0QywyQkFBNUMsRUFBeUU7QUFBRS9ILFdBQU87QUFBVCxJQUF6RSxDQUFOO0FBQ0E7O0FBQ0QsUUFBTW1ULFFBQVE3VSxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QixrQkFBeEIsQ0FBZDs7QUFDQSxNQUFJaUksUUFBUzBNLFVBQVUsR0FBVixJQUFpQixDQUFDQSxNQUFNMUssS0FBTixDQUFZLEdBQVosRUFBaUIySyxHQUFqQixDQUFzQjlKLENBQUQsSUFBT0EsRUFBRTVCLElBQUYsRUFBNUIsRUFBc0MxRixRQUF0QyxDQUErQ3lFLElBQS9DLENBQS9CLEVBQXNGO0FBQ3JGLFNBQU0sSUFBSXZELE9BQU82RSxLQUFYLENBQWlCLHVCQUFqQixFQUEwQyw4QkFBMUMsRUFBMEU7QUFBRS9ILFdBQU87QUFBVCxJQUExRSxDQUFOO0FBQ0E7O0FBQ0QsUUFBTXFULFdBQVdILFNBQVMsT0FBMUI7O0FBQ0EsTUFBSUcsYUFBYSxDQUFDbFMsSUFBRCxJQUFTLENBQUNBLEtBQUt1RyxJQUFMLEVBQXZCLENBQUosRUFBeUM7QUFDeEMsVUFBT3BKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCdkIsT0FBbEIsQ0FBMEIsMENBQTFCLENBQVA7QUFDQTs7QUFDRCxNQUFJeVEsSUFBSjs7QUFDQSxVQUFRcEosSUFBUjtBQUNDLFFBQUssUUFBTDtBQUNDLFFBQUlxRCxLQUFLdUYsR0FBTCxLQUFhMkQsZUFBYixHQUErQkMsWUFBbkMsRUFBaUQ7QUFDaERGLG1CQUFjelUsV0FBV3FKLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCNkUsbUJBQXhCLEdBQThDckYsS0FBOUMsRUFBZDtBQUNBNEwsdUJBQWtCbEosS0FBS3VGLEdBQUwsRUFBbEI7QUFDQTs7QUFDRFEsV0FBUSxHQUFHa0QsV0FBYSxJQUFJTyxRQUFRQyxFQUFSLENBQVcsUUFBWCxDQUFzQixFQUFsRDtBQUNBOztBQUNELFFBQUssU0FBTDtBQUNDLFFBQUksQ0FBQ3pTLE9BQUwsRUFBYztBQUNiLFlBQU94QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLENBQTBCLCtDQUExQixDQUFQO0FBQ0E7O0FBQ0R5USxXQUFRLElBQUkvTyxPQUFTLEVBQXJCO0FBQ0E7O0FBQ0Q7QUFDQytPLFdBQU95RCxRQUFRQyxFQUFSLENBQVcsV0FBWCxFQUF3QmpULFdBQXhCLEVBQVA7QUFmRjs7QUFpQkEsUUFBTWtULFdBQVdILFdBQVcsQ0FBWCxHQUFlLEVBQWhDO0FBQ0EsUUFBTUksV0FBV3RTLE9BQU9BLEtBQUtXLE1BQUwsR0FBYyxDQUFkLEdBQWtCLENBQWxCLEdBQXNCMFIsUUFBN0IsR0FBd0NBLFFBQXpEO0FBQ0EsUUFBTUUsWUFBWTdELEtBQUsvTixNQUFMLEdBQWMsQ0FBZCxHQUFrQixFQUFwQztBQUNBLFFBQU02UixRQUFRRixXQUFXQyxTQUF6QjtBQUNBLFFBQU1FLFNBQVMsRUFBZjtBQUNBLFNBQU87QUFDTnZWLFlBQVM7QUFBRSxvQkFBZ0I7QUFBbEIsSUFESDtBQUVOYyxTQUFPO2dHQUN1RndVLEtBQU8sYUFBYUMsTUFBUTs7Ozs7O3VCQU1yR0QsS0FBTyxhQUFhQyxNQUFROzs7b0NBR2ZILFFBQVUsSUFBSUcsTUFBUTtnQ0FDMUJILFFBQVUsTUFBTUMsU0FBVyxJQUFJRSxNQUFRLElBQUlILFFBQVU7dUNBQzlDRSxLQUFPLElBQUlDLE1BQVE7O1VBRWhEUCxXQUFXLEVBQVgsR0FBZ0IscXRGQUF1dEY7O1FBRXp1RmxTLE9BQVEsWUFBWXFTLFFBQVUsNkNBQTZDclMsSUFBTTttQkFDdEVxUyxRQUFVLFlBQVlyUyxJQUFNLFNBRHZDLEdBQ2tELEVBQUk7bUJBQzNDc1MsV0FBVyxDQUFHLDZDQUE2QzVELElBQU07bUJBQ2pFNEQsV0FBVyxDQUFHLFlBQVk1RCxJQUFNOzs7SUFuQjNDLENBc0JKbkksSUF0QkksR0FzQkdtTSxPQXRCSCxDQXNCVyxhQXRCWCxFQXNCMEIsSUF0QjFCO0FBRkEsR0FBUDtBQTBCQTs7QUEvRGdFLENBQWxFLEU7Ozs7Ozs7Ozs7O0FDN0NBLGtCQUVBdlYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixZQUEzQixFQUF5QztBQUFFNkMsZUFBYztBQUFoQixDQUF6QyxFQUFpRTtBQUNoRUMsUUFBTztBQUNOLFFBQU07QUFBRWlFLE9BQUY7QUFBUUosUUFBUjtBQUFleU47QUFBZixNQUEyQixLQUFLdlMsVUFBdEM7QUFDQSxNQUFJO0FBQUVrQztBQUFGLE1BQVMsS0FBS2xDLFVBQWxCOztBQUVBLE1BQUlrQyxNQUFNLE9BQU9BLEVBQVAsS0FBYyxRQUF4QixFQUFrQztBQUNqQyxTQUFNLElBQUlQLE9BQU82RSxLQUFYLENBQWlCLDBCQUFqQixFQUE2QywwQ0FBN0MsQ0FBTjtBQUNBLEdBRkQsTUFFTztBQUNOdEUsUUFBSzhNLE9BQU85TSxFQUFQLEVBQUw7QUFDQTs7QUFFRCxNQUFJLENBQUNnRCxJQUFELElBQVVBLFNBQVMsS0FBVCxJQUFrQkEsU0FBUyxLQUF6QyxFQUFpRDtBQUNoRCxTQUFNLElBQUl2RCxPQUFPNkUsS0FBWCxDQUFpQiw0QkFBakIsRUFBK0MsdURBQS9DLENBQU47QUFDQTs7QUFFRCxNQUFJLENBQUMxQixLQUFELElBQVUsT0FBT0EsS0FBUCxLQUFpQixRQUEvQixFQUF5QztBQUN4QyxTQUFNLElBQUluRCxPQUFPNkUsS0FBWCxDQUFpQiw2QkFBakIsRUFBZ0Qsd0RBQWhELENBQU47QUFDQTs7QUFFRCxNQUFJLENBQUMrTCxPQUFELElBQVksT0FBT0EsT0FBUCxLQUFtQixRQUFuQyxFQUE2QztBQUM1QyxTQUFNLElBQUk1USxPQUFPNkUsS0FBWCxDQUFpQiwrQkFBakIsRUFBa0QsMERBQWxELENBQU47QUFDQTs7QUFHRCxNQUFJL0ksTUFBSjtBQUNBa0UsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU0xRSxTQUFTa0UsT0FBT0MsSUFBUCxDQUFZLGtCQUFaLEVBQWdDO0FBQzVFTSxLQUQ0RTtBQUU1RUssVUFBTztBQUFFLEtBQUMyQyxJQUFELEdBQVFKO0FBQVYsSUFGcUU7QUFHNUV5TixVQUg0RTtBQUk1RXBRLFdBQVEsS0FBS0E7QUFKK0QsR0FBaEMsQ0FBN0M7QUFPQSxTQUFPcEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUFFQztBQUFGLEdBQTFCLENBQVA7QUFDQSxFQWpDK0Q7O0FBa0NoRStVLFVBQVM7QUFDUixRQUFNO0FBQUVqUTtBQUFGLE1BQVksS0FBS3ZDLFVBQXZCOztBQUVBLE1BQUksQ0FBQ3VDLEtBQUQsSUFBVSxPQUFPQSxLQUFQLEtBQWlCLFFBQS9CLEVBQXlDO0FBQ3hDLFNBQU0sSUFBSVosT0FBTzZFLEtBQVgsQ0FBaUIsNkJBQWpCLEVBQWdELHdEQUFoRCxDQUFOO0FBQ0E7O0FBRUQsUUFBTWlNLGtCQUFrQkMsS0FBS0MsYUFBTCxDQUFtQi9HLE1BQW5CLENBQTBCO0FBQ2pEZ0gsUUFBSyxDQUFDO0FBQ0wsaUJBQWFyUTtBQURSLElBQUQsRUFFRjtBQUNGLGlCQUFhQTtBQURYLElBRkUsQ0FENEM7QUFNakRKLFdBQVEsS0FBS0E7QUFOb0MsR0FBMUIsQ0FBeEI7O0FBU0EsTUFBSXNRLG9CQUFvQixDQUF4QixFQUEyQjtBQUMxQixVQUFPMVYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JsQixRQUFsQixFQUFQO0FBQ0E7O0FBRUQsU0FBT25CLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsRUFBUDtBQUNBOztBQXZEK0QsQ0FBakUsRTs7Ozs7Ozs7Ozs7QUNGQSxJQUFJckQsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUVOO0FBQ0F1QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGlCQUEzQixFQUE4QztBQUFFNkMsZUFBYztBQUFoQixDQUE5QyxFQUF1RTtBQUN0RS9ELE9BQU07QUFDTCxRQUFNO0FBQUUwSSxTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQyxTQUFSO0FBQWdCUTtBQUFoQixNQUEwQixLQUFLNEIsY0FBTCxFQUFoQztBQUVBLE1BQUlDLFdBQVc7QUFDZDRKLFdBQVE7QUFBRUMsU0FBSztBQUFQLElBRE07QUFFZCxhQUFVO0FBRkksR0FBZjtBQUtBN0osYUFBV3ZLLE9BQU95SSxNQUFQLENBQWMsRUFBZCxFQUFrQkMsS0FBbEIsRUFBeUI2QixRQUF6QixDQUFYO0FBRUEsUUFBTWpNLFdBQVdELFdBQVdxSixNQUFYLENBQWtCMk0sUUFBbEIsQ0FBMkIzSixJQUEzQixDQUFnQ0gsUUFBaEMsRUFBMEM7QUFDMUR0QyxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRTFFLFNBQUs7QUFBUCxJQURzQztBQUUxRG9ILFNBQU0xRCxNQUZvRDtBQUcxRDJELFVBQU96RCxLQUhtRDtBQUkxRGUsV0FBUWxJLE9BQU95SSxNQUFQLENBQWM7QUFBRWxGLFNBQUssQ0FBUDtBQUFVNkMsV0FBTztBQUFqQixJQUFkLEVBQW9DOEIsTUFBcEM7QUFKa0QsR0FBMUMsRUFLZDJDLEtBTGMsRUFBakI7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ1IsV0FEZ0M7QUFFaEM2SSxVQUFPN0ksU0FBU3VELE1BRmdCO0FBR2hDb0YsU0FIZ0M7QUFJaEM2RCxVQUFPek0sV0FBV3FKLE1BQVgsQ0FBa0IyTSxRQUFsQixDQUEyQjNKLElBQTNCLENBQWdDSCxRQUFoQyxFQUEwQ3BELEtBQTFDO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUF6QnFFLENBQXZFO0FBNEJBOUksV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixVQUEzQixFQUF1QztBQUFFNkMsZUFBYztBQUFoQixDQUF2QyxFQUErRDtBQUM5RC9ELE9BQU07QUFDTCxRQUFNO0FBQUUwSSxTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQyxTQUFSO0FBQWdCUTtBQUFoQixNQUEwQixLQUFLNEIsY0FBTCxFQUFoQztBQUVBLE1BQUlDLFdBQVc7QUFDZDRKLFdBQVE7QUFBRUMsU0FBSztBQUFQO0FBRE0sR0FBZjs7QUFJQSxNQUFJLENBQUMvVixXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLHlCQUE1QyxDQUFMLEVBQTZFO0FBQzVFOEcsWUFBUzlELE1BQVQsR0FBa0IsSUFBbEI7QUFDQTs7QUFFRDhELGFBQVd2SyxPQUFPeUksTUFBUCxDQUFjLEVBQWQsRUFBa0JDLEtBQWxCLEVBQXlCNkIsUUFBekIsQ0FBWDtBQUVBLFFBQU1qTSxXQUFXRCxXQUFXcUosTUFBWCxDQUFrQjJNLFFBQWxCLENBQTJCM0osSUFBM0IsQ0FBZ0NILFFBQWhDLEVBQTBDO0FBQzFEdEMsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUUxRSxTQUFLO0FBQVAsSUFEc0M7QUFFMURvSCxTQUFNMUQsTUFGb0Q7QUFHMUQyRCxVQUFPekQsS0FIbUQ7QUFJMURlLFdBQVFsSSxPQUFPeUksTUFBUCxDQUFjO0FBQUVsRixTQUFLLENBQVA7QUFBVTZDLFdBQU87QUFBakIsSUFBZCxFQUFvQzhCLE1BQXBDO0FBSmtELEdBQTFDLEVBS2QyQyxLQUxjLEVBQWpCO0FBT0EsU0FBT3hNLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaENSLFdBRGdDO0FBRWhDNkksVUFBTzdJLFNBQVN1RCxNQUZnQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCMk0sUUFBbEIsQ0FBMkIzSixJQUEzQixDQUFnQ0gsUUFBaEMsRUFBMENwRCxLQUExQztBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBNUI2RCxDQUEvRDtBQStCQTlJLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZUFBM0IsRUFBNEM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBNUMsRUFBb0U7QUFDbkUvRCxPQUFNO0FBQ0wsTUFBSSxDQUFDRixXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLHlCQUE1QyxDQUFMLEVBQTZFO0FBQzVFLFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxTQUFPakIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQnJELEVBQUVpWCxJQUFGLENBQU9yVSxXQUFXcUosTUFBWCxDQUFrQjJNLFFBQWxCLENBQTJCQyxvQkFBM0IsQ0FBZ0QsS0FBS25ILFNBQUwsQ0FBZTVKLEdBQS9ELENBQVAsRUFBNEUsS0FBNUUsRUFBbUYsT0FBbkYsQ0FBMUIsQ0FBUDtBQUNBLEVBUGtFOztBQVFuRWhCLFFBQU87QUFDTixNQUFJLENBQUNsRSxXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLHlCQUE1QyxDQUFMLEVBQTZFO0FBQzVFLFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRHNQLFFBQU0sS0FBS3ROLFVBQVgsRUFBdUI7QUFDdEI4RSxVQUFPMkYsTUFBTXdJO0FBRFMsR0FBdkI7O0FBSUEsTUFBSWxXLFdBQVdxSixNQUFYLENBQWtCMk0sUUFBbEIsQ0FBMkJHLHdCQUEzQixDQUFvRCxLQUFLckgsU0FBTCxDQUFlNUosR0FBbkUsRUFBd0UsS0FBS2pDLFVBQUwsQ0FBZ0I4RSxLQUF4RixDQUFKLEVBQW9HO0FBQ25HLFVBQU8vSCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFFRCxTQUFPVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnZCLE9BQWxCLEVBQVA7QUFDQTs7QUF0QmtFLENBQXBFO0FBeUJBZCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLHdCQUEzQixFQUFxRDtBQUFFNkMsZUFBYztBQUFoQixDQUFyRCxFQUE4RTtBQUM3RS9ELE9BQU07QUFDTCxRQUFNa1csdUJBQXVCQyxRQUFRLHVCQUFSLEVBQWlDRCxvQkFBOUQ7QUFFQSxTQUFPcFcsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQzZWLG1CQUFnQkYscUJBQXFCRSxjQUFyQixDQUFvQ2pLLElBQXBDLENBQXlDLEVBQXpDLEVBQTZDO0FBQUN4QyxZQUFRO0FBQUMwTSxhQUFRO0FBQVQ7QUFBVCxJQUE3QyxFQUFvRS9KLEtBQXBFO0FBRGdCLEdBQTFCLENBQVA7QUFHQTs7QUFQNEUsQ0FBOUUsRTs7Ozs7Ozs7Ozs7QUN2RkF4TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLFlBQTNCLEVBQXlDO0FBQUU2QyxlQUFjO0FBQWhCLENBQXpDLEVBQWlFO0FBQ2hFL0QsT0FBTTtBQUNMLE1BQUlzVyxVQUFVLEtBQWQ7O0FBQ0EsTUFBSSxPQUFPLEtBQUtoTyxXQUFMLENBQWlCZ08sT0FBeEIsS0FBb0MsV0FBcEMsSUFBbUQsS0FBS2hPLFdBQUwsQ0FBaUJnTyxPQUFqQixLQUE2QixNQUFwRixFQUE0RjtBQUMzRkEsYUFBVSxJQUFWO0FBQ0E7O0FBRUQsTUFBSUMsS0FBSjtBQUNBN1IsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNxUixXQUFRN1IsT0FBT0MsSUFBUCxDQUFZLGVBQVosRUFBNkIyUixPQUE3QixDQUFSO0FBQ0EsR0FGRDtBQUlBLFNBQU94VyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDaVcsZUFBWUQ7QUFEb0IsR0FBMUIsQ0FBUDtBQUdBOztBQWYrRCxDQUFqRTtBQWtCQXpXLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsaUJBQTNCLEVBQThDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTlDLEVBQXNFO0FBQ3JFL0QsT0FBTTtBQUNMLE1BQUksQ0FBQ0YsV0FBVytKLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCLEtBQUs1RSxNQUFwQyxFQUE0QyxpQkFBNUMsQ0FBTCxFQUFxRTtBQUNwRSxVQUFPcEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0E7O0FBRUQsUUFBTTtBQUFFMkgsU0FBRjtBQUFVRTtBQUFWLE1BQW9CLEtBQUtrRCxrQkFBTCxFQUExQjtBQUNBLFFBQU07QUFBRXBDLE9BQUY7QUFBUUMsU0FBUjtBQUFnQlE7QUFBaEIsTUFBMEIsS0FBSzRCLGNBQUwsRUFBaEM7QUFFQSxRQUFNeUssYUFBYTFXLFdBQVdxSixNQUFYLENBQWtCc04sVUFBbEIsQ0FBNkJ0SyxJQUE3QixDQUFrQ2hDLEtBQWxDLEVBQXlDO0FBQzNEVCxTQUFNQSxPQUFPQSxJQUFQLEdBQWM7QUFBRS9HLFVBQU07QUFBUixJQUR1QztBQUUzRHlKLFNBQU0xRCxNQUZxRDtBQUczRDJELFVBQU96RCxLQUhvRDtBQUkzRGU7QUFKMkQsR0FBekMsRUFLaEIyQyxLQUxnQixFQUFuQjtBQU9BLFNBQU94TSxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDaVcsYUFEZ0M7QUFFaEM1TixVQUFPNE4sV0FBV2xULE1BRmM7QUFHaENvRixTQUhnQztBQUloQzZELFVBQU96TSxXQUFXcUosTUFBWCxDQUFrQnNOLFVBQWxCLENBQTZCdEssSUFBN0IsQ0FBa0NoQyxLQUFsQyxFQUF5Q3ZCLEtBQXpDO0FBSnlCLEdBQTFCLENBQVA7QUFNQTs7QUF0Qm9FLENBQXRFLEU7Ozs7Ozs7Ozs7O0FDbEJBLElBQUkxTCxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEO0FBRU51QyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGNBQTNCLEVBQTJDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTNDLEVBQW1FO0FBQ2xFQyxRQUFPO0FBQ05xTSxRQUFNLEtBQUt0TixVQUFYLEVBQXVCO0FBQ3RCRyxVQUFPc04sTUFEZTtBQUV0QjdOLFNBQU02TixNQUZnQjtBQUd0QnJOLGFBQVVxTixNQUhZO0FBSXRCdk4sYUFBVXVOLE1BSlk7QUFLdEJrRyxXQUFRbEosTUFBTWtELEtBQU4sQ0FBWUMsT0FBWixDQUxjO0FBTXRCdlIsVUFBT29PLE1BQU1rRCxLQUFOLENBQVloRCxLQUFaLENBTmU7QUFPdEJpSix3QkFBcUJuSixNQUFNa0QsS0FBTixDQUFZQyxPQUFaLENBUEM7QUFRdEJ6UiwwQkFBdUJzTyxNQUFNa0QsS0FBTixDQUFZQyxPQUFaLENBUkQ7QUFTdEJpRyxxQkFBa0JwSixNQUFNa0QsS0FBTixDQUFZQyxPQUFaLENBVEk7QUFVdEIwRCxhQUFVN0csTUFBTWtELEtBQU4sQ0FBWUMsT0FBWixDQVZZO0FBV3RCcFIsaUJBQWNpTyxNQUFNa0QsS0FBTixDQUFZalAsTUFBWjtBQVhRLEdBQXZCLEVBRE0sQ0FlTjs7QUFDQSxNQUFJLE9BQU8sS0FBS3NCLFVBQUwsQ0FBZ0I0VCxtQkFBdkIsS0FBK0MsV0FBbkQsRUFBZ0U7QUFDL0QsUUFBSzVULFVBQUwsQ0FBZ0I0VCxtQkFBaEIsR0FBc0MsSUFBdEM7QUFDQTs7QUFFRCxNQUFJLEtBQUs1VCxVQUFMLENBQWdCeEQsWUFBcEIsRUFBa0M7QUFDakNPLGNBQVcrVyxvQkFBWCxDQUFnQyxLQUFLOVQsVUFBTCxDQUFnQnhELFlBQWhEO0FBQ0E7O0FBRUQsUUFBTXVYLFlBQVloWCxXQUFXaVgsUUFBWCxDQUFvQixLQUFLN1IsTUFBekIsRUFBaUMsS0FBS25DLFVBQXRDLENBQWxCOztBQUVBLE1BQUksS0FBS0EsVUFBTCxDQUFnQnhELFlBQXBCLEVBQWtDO0FBQ2pDTyxjQUFXa1gsaUNBQVgsQ0FBNkNGLFNBQTdDLEVBQXdELEtBQUsvVCxVQUFMLENBQWdCeEQsWUFBeEU7QUFDQTs7QUFHRCxNQUFJLE9BQU8sS0FBS3dELFVBQUwsQ0FBZ0IyVCxNQUF2QixLQUFrQyxXQUF0QyxFQUFtRDtBQUNsRGhTLFVBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixXQUFPQyxJQUFQLENBQVkscUJBQVosRUFBbUNtUyxTQUFuQyxFQUE4QyxLQUFLL1QsVUFBTCxDQUFnQjJULE1BQTlEO0FBQ0EsSUFGRDtBQUdBOztBQUVELFNBQU81VyxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQUV5QyxTQUFNbEQsV0FBV3FKLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCQyxXQUF4QixDQUFvQ3lOLFNBQXBDLEVBQStDO0FBQUVuTixZQUFRN0osV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JoRTtBQUE1QixJQUEvQztBQUFSLEdBQTFCLENBQVA7QUFDQTs7QUF2Q2lFLENBQW5FO0FBMENBMkIsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JqQixRQUFsQixDQUEyQixjQUEzQixFQUEyQztBQUFFNkMsZUFBYztBQUFoQixDQUEzQyxFQUFtRTtBQUNsRUMsUUFBTztBQUNOLE1BQUksQ0FBQ2xFLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsYUFBNUMsQ0FBTCxFQUFpRTtBQUNoRSxVQUFPcEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFQO0FBQ0E7O0FBRUQsUUFBTWlDLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQXpHLFNBQU91RyxTQUFQLENBQWlCLEtBQUsvRixNQUF0QixFQUE4QixNQUFNO0FBQ25DUixVQUFPQyxJQUFQLENBQVksWUFBWixFQUEwQjNCLEtBQUtnQyxHQUEvQjtBQUNBLEdBRkQ7QUFJQSxTQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixFQUFQO0FBQ0E7O0FBYmlFLENBQW5FO0FBZ0JBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGlCQUEzQixFQUE4QztBQUFFNkMsZUFBYztBQUFoQixDQUE5QyxFQUF1RTtBQUN0RS9ELE9BQU07QUFDTCxRQUFNZ0QsT0FBTyxLQUFLbUksaUJBQUwsRUFBYjtBQUVBLFFBQU1wSixNQUFNakMsV0FBV21YLE1BQVgsQ0FBbUIsV0FBV2pVLEtBQUtDLFFBQVUsRUFBN0MsRUFBZ0Q7QUFBRWlVLFFBQUssS0FBUDtBQUFjQyxTQUFNO0FBQXBCLEdBQWhELENBQVo7QUFDQSxPQUFLbFgsUUFBTCxDQUFjbVgsU0FBZCxDQUF3QixVQUF4QixFQUFvQ3JWLEdBQXBDO0FBRUEsU0FBTztBQUNOckIsZUFBWSxHQUROO0FBRU5DLFNBQU1vQjtBQUZBLEdBQVA7QUFJQTs7QUFYcUUsQ0FBdkU7QUFjQWpDLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsbUJBQTNCLEVBQWdEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWhELEVBQXdFO0FBQ3ZFL0QsT0FBTTtBQUNMLE1BQUksS0FBS3FYLGdCQUFMLEVBQUosRUFBNkI7QUFDNUIsU0FBTXJVLE9BQU9sRCxXQUFXcUosTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0JDLFdBQXhCLENBQW9DLEtBQUtuRSxNQUF6QyxDQUFiO0FBQ0EsVUFBT3BGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEMrVyxjQUFVdFUsS0FBSzZCLE1BRGlCO0FBRWhDMFMsc0JBQWtCdlUsS0FBS2xFLGdCQUZTO0FBR2hDRSxlQUFXZ0UsS0FBS2hFO0FBSGdCLElBQTFCLENBQVA7QUFLQTs7QUFFRCxRQUFNZ0UsT0FBTyxLQUFLbUksaUJBQUwsRUFBYjtBQUVBLFNBQU9yTCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLENBQTBCO0FBQ2hDK1csYUFBVXRVLEtBQUs2QjtBQURpQixHQUExQixDQUFQO0FBR0E7O0FBaEJzRSxDQUF4RTtBQW1CQS9FLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsWUFBM0IsRUFBeUM7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBekMsRUFBaUU7QUFDaEUvRCxPQUFNO0FBQ0wsUUFBTWdELE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFFQSxNQUFJM0ssTUFBSjtBQUNBa0UsU0FBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkMxRSxZQUFTa0UsT0FBT0MsSUFBUCxDQUFZLGlCQUFaLEVBQStCO0FBQUVpTixZQUFRNU8sS0FBS0MsUUFBZjtBQUF5Qm9KLFdBQU87QUFBaEMsSUFBL0IsQ0FBVDtBQUNBLEdBRkQ7O0FBSUEsTUFBSSxDQUFDN0wsTUFBRCxJQUFXQSxPQUFPOEMsTUFBUCxLQUFrQixDQUFqQyxFQUFvQztBQUNuQyxVQUFPeEQsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEyQixrREFBa0RvQyxLQUFLZ0MsR0FBSyxJQUF2RixDQUFQO0FBQ0E7O0FBRUQsU0FBT2xGLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEN5QyxTQUFNeEMsT0FBTyxDQUFQO0FBRDBCLEdBQTFCLENBQVA7QUFHQTs7QUFoQitELENBQWpFO0FBbUJBVixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLFlBQTNCLEVBQXlDO0FBQUU2QyxlQUFjO0FBQWhCLENBQXpDLEVBQWlFO0FBQ2hFL0QsT0FBTTtBQUNMLE1BQUksQ0FBQ0YsV0FBVytKLEtBQVgsQ0FBaUJDLGFBQWpCLENBQStCLEtBQUs1RSxNQUFwQyxFQUE0QyxhQUE1QyxDQUFMLEVBQWlFO0FBQ2hFLFVBQU9wRixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRCxRQUFNO0FBQUUySCxTQUFGO0FBQVVFO0FBQVYsTUFBb0IsS0FBS2tELGtCQUFMLEVBQTFCO0FBQ0EsUUFBTTtBQUFFcEMsT0FBRjtBQUFRQyxTQUFSO0FBQWdCUTtBQUFoQixNQUEwQixLQUFLNEIsY0FBTCxFQUFoQztBQUVBLFFBQU1qSCxRQUFRaEYsV0FBV3FKLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCK0MsSUFBeEIsQ0FBNkJoQyxLQUE3QixFQUFvQztBQUNqRFQsU0FBTUEsT0FBT0EsSUFBUCxHQUFjO0FBQUV6RyxjQUFVO0FBQVosSUFENkI7QUFFakRtSixTQUFNMUQsTUFGMkM7QUFHakQyRCxVQUFPekQsS0FIMEM7QUFJakRlO0FBSmlELEdBQXBDLEVBS1gyQyxLQUxXLEVBQWQ7QUFPQSxTQUFPeE0sV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3VFLFFBRGdDO0FBRWhDOEQsVUFBTzlELE1BQU14QixNQUZtQjtBQUdoQ29GLFNBSGdDO0FBSWhDNkQsVUFBT3pNLFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QitDLElBQXhCLENBQTZCaEMsS0FBN0IsRUFBb0N2QixLQUFwQztBQUp5QixHQUExQixDQUFQO0FBTUE7O0FBdEIrRCxDQUFqRTtBQXlCQTlJLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsZ0JBQTNCLEVBQTZDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTdDLEVBQXNFO0FBQ3JFQyxRQUFPO0FBQ04sTUFBSSxLQUFLa0IsTUFBVCxFQUFpQjtBQUNoQixVQUFPcEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0J2QixPQUFsQixDQUEwQix5Q0FBMUIsQ0FBUDtBQUNBLEdBSEssQ0FLTjtBQUNBOzs7QUFDQXlQLFFBQU0sS0FBS3ROLFVBQVgsRUFBdUJ5SyxNQUFNOEMsZUFBTixDQUFzQjtBQUM1Q3JOLGFBQVV1TjtBQURrQyxHQUF0QixDQUF2QixFQVBNLENBV047O0FBQ0EsUUFBTXRMLFNBQVNSLE9BQU9DLElBQVAsQ0FBWSxjQUFaLEVBQTRCLEtBQUs1QixVQUFqQyxDQUFmLENBWk0sQ0FjTjs7QUFDQTJCLFNBQU91RyxTQUFQLENBQWlCL0YsTUFBakIsRUFBeUIsTUFBTVIsT0FBT0MsSUFBUCxDQUFZLGFBQVosRUFBMkIsS0FBSzVCLFVBQUwsQ0FBZ0JFLFFBQTNDLENBQS9CO0FBRUEsU0FBT25ELFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFBRXlDLFNBQU1sRCxXQUFXcUosTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0JDLFdBQXhCLENBQW9DbkUsTUFBcEMsRUFBNEM7QUFBRXlFLFlBQVE3SixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmhFO0FBQTVCLElBQTVDO0FBQVIsR0FBMUIsQ0FBUDtBQUNBOztBQW5Cb0UsQ0FBdEU7QUFzQkEyQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLG1CQUEzQixFQUFnRDtBQUFFNkMsZUFBYztBQUFoQixDQUFoRCxFQUF3RTtBQUN2RUMsUUFBTztBQUNOLFFBQU1oQixPQUFPLEtBQUttSSxpQkFBTCxFQUFiOztBQUVBLE1BQUluSSxLQUFLZ0MsR0FBTCxLQUFhLEtBQUtFLE1BQXRCLEVBQThCO0FBQzdCUixVQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTVIsT0FBT0MsSUFBUCxDQUFZLGFBQVosQ0FBcEM7QUFDQSxHQUZELE1BRU8sSUFBSTdFLFdBQVcrSixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLNUUsTUFBcEMsRUFBNEMsc0JBQTVDLENBQUosRUFBeUU7QUFDL0VSLFVBQU91RyxTQUFQLENBQWlCakksS0FBS2dDLEdBQXRCLEVBQTJCLE1BQU1OLE9BQU9DLElBQVAsQ0FBWSxhQUFaLENBQWpDO0FBQ0EsR0FGTSxNQUVBO0FBQ04sVUFBTzdFLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCcEIsWUFBbEIsRUFBUDtBQUNBOztBQUVELFNBQU9qQixXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUFic0UsQ0FBeEU7QUFnQkFULFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsaUJBQTNCLEVBQThDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTlDLEVBQXNFO0FBQ3JFQyxRQUFPO0FBQ05xTSxRQUFNLEtBQUt0TixVQUFYLEVBQXVCeUssTUFBTThDLGVBQU4sQ0FBc0I7QUFDNUNrSCxjQUFXaEssTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQURpQztBQUU1Q3RMLFdBQVFzSSxNQUFNa0QsS0FBTixDQUFZRixNQUFaLENBRm9DO0FBRzVDdk4sYUFBVXVLLE1BQU1rRCxLQUFOLENBQVlGLE1BQVo7QUFIa0MsR0FBdEIsQ0FBdkI7QUFNQSxNQUFJeE4sSUFBSjs7QUFDQSxNQUFJLEtBQUtxVSxnQkFBTCxFQUFKLEVBQTZCO0FBQzVCclUsVUFBTzBCLE9BQU9JLEtBQVAsQ0FBYUMsT0FBYixDQUFxQixLQUFLRyxNQUExQixDQUFQO0FBQ0EsR0FGRCxNQUVPLElBQUlwRixXQUFXK0osS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBSzVFLE1BQXBDLEVBQTRDLHNCQUE1QyxDQUFKLEVBQXlFO0FBQy9FbEMsVUFBTyxLQUFLbUksaUJBQUwsRUFBUDtBQUNBLEdBRk0sTUFFQTtBQUNOLFVBQU9yTCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQnBCLFlBQWxCLEVBQVA7QUFDQTs7QUFFRDJELFNBQU91RyxTQUFQLENBQWlCakksS0FBS2dDLEdBQXRCLEVBQTJCLE1BQU07QUFDaEMsT0FBSSxLQUFLakMsVUFBTCxDQUFnQnlVLFNBQXBCLEVBQStCO0FBQzlCMVgsZUFBVzJYLGFBQVgsQ0FBeUJ6VSxJQUF6QixFQUErQixLQUFLRCxVQUFMLENBQWdCeVUsU0FBL0MsRUFBMEQsRUFBMUQsRUFBOEQsS0FBOUQ7QUFDQSxJQUZELE1BRU87QUFDTixVQUFNM0ksU0FBU0MsSUFBSXpSLE9BQUosQ0FBWSxRQUFaLENBQWY7O0FBQ0EsVUFBTTBSLFNBQVMsSUFBSUYsTUFBSixDQUFXO0FBQUVoUCxjQUFTLEtBQUtGLE9BQUwsQ0FBYUU7QUFBeEIsS0FBWCxDQUFmO0FBRUE2RSxXQUFPc0ssU0FBUCxDQUFrQkMsUUFBRCxJQUFjO0FBQzlCRixZQUFPRyxFQUFQLENBQVUsTUFBVixFQUFrQnhLLE9BQU9pTCxlQUFQLENBQXVCLENBQUNSLFNBQUQsRUFBWUMsSUFBWixFQUFrQkMsUUFBbEIsRUFBNEJDLFFBQTVCLEVBQXNDQyxRQUF0QyxLQUFtRDtBQUMzRixVQUFJSixjQUFjLE9BQWxCLEVBQTJCO0FBQzFCLGNBQU9GLFNBQVMsSUFBSXZLLE9BQU82RSxLQUFYLENBQWlCLGVBQWpCLENBQVQsQ0FBUDtBQUNBOztBQUVELFlBQU1tTyxZQUFZLEVBQWxCO0FBQ0F0SSxXQUFLRixFQUFMLENBQVEsTUFBUixFQUFnQnhLLE9BQU9pTCxlQUFQLENBQXdCbkssSUFBRCxJQUFVO0FBQ2hEa1MsaUJBQVVwWCxJQUFWLENBQWVrRixJQUFmO0FBQ0EsT0FGZSxDQUFoQjtBQUlBNEosV0FBS0YsRUFBTCxDQUFRLEtBQVIsRUFBZXhLLE9BQU9pTCxlQUFQLENBQXVCLE1BQU07QUFDM0M3UCxrQkFBVzJYLGFBQVgsQ0FBeUJ6VSxJQUF6QixFQUErQjBNLE9BQU8zRixNQUFQLENBQWMyTixTQUFkLENBQS9CLEVBQXlEbkksUUFBekQsRUFBbUUsTUFBbkU7QUFDQU47QUFDQSxPQUhjLENBQWY7QUFLQSxNQWZpQixDQUFsQjtBQWdCQSxVQUFLdFAsT0FBTCxDQUFhaVEsSUFBYixDQUFrQmIsTUFBbEI7QUFDQSxLQWxCRDtBQW1CQTtBQUNELEdBM0JEO0FBNkJBLFNBQU9qUCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQjVCLE9BQWxCLEVBQVA7QUFDQTs7QUEvQ29FLENBQXRFO0FBa0RBVCxXQUFXdEMsR0FBWCxDQUFlMkUsRUFBZixDQUFrQmpCLFFBQWxCLENBQTJCLGNBQTNCLEVBQTJDO0FBQUU2QyxlQUFjO0FBQWhCLENBQTNDLEVBQW1FO0FBQ2xFQyxRQUFPO0FBQ05xTSxRQUFNLEtBQUt0TixVQUFYLEVBQXVCO0FBQ3RCbUMsV0FBUXNMLE1BRGM7QUFFdEJoTCxTQUFNZ0ksTUFBTThDLGVBQU4sQ0FBc0I7QUFDM0JwTixXQUFPc0ssTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQURvQjtBQUUzQjdOLFVBQU02SyxNQUFNa0QsS0FBTixDQUFZRixNQUFaLENBRnFCO0FBRzNCck4sY0FBVXFLLE1BQU1rRCxLQUFOLENBQVlGLE1BQVosQ0FIaUI7QUFJM0J2TixjQUFVdUssTUFBTWtELEtBQU4sQ0FBWUYsTUFBWixDQUppQjtBQUszQmtHLFlBQVFsSixNQUFNa0QsS0FBTixDQUFZQyxPQUFaLENBTG1CO0FBTTNCdlIsV0FBT29PLE1BQU1rRCxLQUFOLENBQVloRCxLQUFaLENBTm9CO0FBTzNCaUoseUJBQXFCbkosTUFBTWtELEtBQU4sQ0FBWUMsT0FBWixDQVBNO0FBUTNCelIsMkJBQXVCc08sTUFBTWtELEtBQU4sQ0FBWUMsT0FBWixDQVJJO0FBUzNCaUcsc0JBQWtCcEosTUFBTWtELEtBQU4sQ0FBWUMsT0FBWixDQVRTO0FBVTNCMEQsY0FBVTdHLE1BQU1rRCxLQUFOLENBQVlDLE9BQVosQ0FWaUI7QUFXM0JwUixrQkFBY2lPLE1BQU1rRCxLQUFOLENBQVlqUCxNQUFaO0FBWGEsSUFBdEI7QUFGZ0IsR0FBdkI7O0FBaUJBLFFBQU1rVyxXQUFXemEsRUFBRTBJLE1BQUYsQ0FBUztBQUFFWixRQUFLLEtBQUtqQyxVQUFMLENBQWdCbUM7QUFBdkIsR0FBVCxFQUEwQyxLQUFLbkMsVUFBTCxDQUFnQnlDLElBQTFELENBQWpCOztBQUVBZCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTXBGLFdBQVdpWCxRQUFYLENBQW9CLEtBQUs3UixNQUF6QixFQUFpQ3lTLFFBQWpDLENBQXBDOztBQUVBLE1BQUksS0FBSzVVLFVBQUwsQ0FBZ0J5QyxJQUFoQixDQUFxQmpHLFlBQXpCLEVBQXVDO0FBQ3RDTyxjQUFXOFgsZ0JBQVgsQ0FBNEIsS0FBSzdVLFVBQUwsQ0FBZ0JtQyxNQUE1QyxFQUFvRCxLQUFLbkMsVUFBTCxDQUFnQnlDLElBQWhCLENBQXFCakcsWUFBekU7QUFDQTs7QUFFRCxNQUFJLE9BQU8sS0FBS3dELFVBQUwsQ0FBZ0J5QyxJQUFoQixDQUFxQmtSLE1BQTVCLEtBQXVDLFdBQTNDLEVBQXdEO0FBQ3ZEaFMsVUFBT3VHLFNBQVAsQ0FBaUIsS0FBSy9GLE1BQXRCLEVBQThCLE1BQU07QUFDbkNSLFdBQU9DLElBQVAsQ0FBWSxxQkFBWixFQUFtQyxLQUFLNUIsVUFBTCxDQUFnQm1DLE1BQW5ELEVBQTJELEtBQUtuQyxVQUFMLENBQWdCeUMsSUFBaEIsQ0FBcUJrUixNQUFoRjtBQUNBLElBRkQ7QUFHQTs7QUFFRCxTQUFPNVcsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUFFeUMsU0FBTWxELFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QkMsV0FBeEIsQ0FBb0MsS0FBS3RHLFVBQUwsQ0FBZ0JtQyxNQUFwRCxFQUE0RDtBQUFFeUUsWUFBUTdKLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCaEU7QUFBNUIsSUFBNUQ7QUFBUixHQUExQixDQUFQO0FBQ0E7O0FBbENpRSxDQUFuRTtBQXFDQTJCLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCakIsUUFBbEIsQ0FBMkIsbUJBQTNCLEVBQWdEO0FBQUU2QyxlQUFjO0FBQWhCLENBQWhELEVBQXdFO0FBQ3ZFQyxRQUFPO0FBQ04sUUFBTWhCLE9BQU8sS0FBS21JLGlCQUFMLEVBQWI7QUFDQSxNQUFJM0YsSUFBSjtBQUNBZCxTQUFPdUcsU0FBUCxDQUFpQixLQUFLL0YsTUFBdEIsRUFBOEIsTUFBTTtBQUNuQ00sVUFBT2QsT0FBT0MsSUFBUCxDQUFZLGFBQVosRUFBMkIzQixLQUFLZ0MsR0FBaEMsQ0FBUDtBQUNBLEdBRkQ7QUFHQSxTQUFPUSxPQUFPMUYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUFDaUY7QUFBRCxHQUExQixDQUFQLEdBQTJDMUYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0JwQixZQUFsQixFQUFsRDtBQUNBOztBQVJzRSxDQUF4RSxFOzs7Ozs7Ozs7OztBQ3RRQWpCLFdBQVd0QyxHQUFYLENBQWVGLE9BQWYsQ0FBdUJVLGFBQXZCLENBQXFDb0ssR0FBckMsQ0FBeUMsaUJBQXpDLEVBQTRELFNBQVNpQyxnQkFBVCxHQUE0QjtBQUN2RixLQUFJckgsSUFBSjs7QUFFQSxLQUFJLEtBQUtyRCxPQUFMLENBQWFFLE9BQWIsQ0FBcUIsY0FBckIsS0FBd0MsS0FBS0YsT0FBTCxDQUFhRSxPQUFiLENBQXFCLFdBQXJCLENBQTVDLEVBQStFO0FBQzlFbUQsU0FBT2xELFdBQVdxSixNQUFYLENBQWtCQyxLQUFsQixDQUF3QnJFLE9BQXhCLENBQWdDO0FBQ3RDLFVBQU8sS0FBS3BGLE9BQUwsQ0FBYUUsT0FBYixDQUFxQixXQUFyQixDQUQrQjtBQUV0Qyw4Q0FBMkN1RixTQUFTQyxlQUFULENBQXlCLEtBQUsxRixPQUFMLENBQWFFLE9BQWIsQ0FBcUIsY0FBckIsQ0FBekI7QUFGTCxHQUFoQyxDQUFQO0FBSUE7O0FBRUQsUUFBT21ELElBQVA7QUFDQSxDQVhELEU7Ozs7Ozs7Ozs7O0FDQUFsRCxXQUFXdEMsR0FBWCxDQUFlRixPQUFmLENBQXVCNEQsUUFBdkIsQ0FBZ0MsTUFBaEMsRUFBd0M7QUFBRTZDLGVBQWM7QUFBaEIsQ0FBeEMsRUFBaUU7QUFDaEUvRCxPQUFNO0FBQ0wsUUFBTWdELE9BQU8sS0FBSzZPLGVBQUwsRUFBYjs7QUFFQSxNQUFJN08sUUFBUWxELFdBQVcrSixLQUFYLENBQWlCa0ssT0FBakIsQ0FBeUIvUSxLQUFLZ0MsR0FBOUIsRUFBbUMsT0FBbkMsQ0FBWixFQUF5RDtBQUN4RCxVQUFPbEYsV0FBV3RDLEdBQVgsQ0FBZTJFLEVBQWYsQ0FBa0I1QixPQUFsQixDQUEwQjtBQUNoQ3lULFVBQU1sVSxXQUFXbVU7QUFEZSxJQUExQixDQUFQO0FBR0E7O0FBRUQsU0FBT25VLFdBQVd0QyxHQUFYLENBQWUyRSxFQUFmLENBQWtCNUIsT0FBbEIsQ0FBMEI7QUFDaEN6QyxZQUFTZ0MsV0FBV21VLElBQVgsQ0FBZ0JuVztBQURPLEdBQTFCLENBQVA7QUFHQTs7QUFiK0QsQ0FBakUsRTs7Ozs7Ozs7Ozs7QUNBQWdDLFdBQVd0QyxHQUFYLENBQWVGLE9BQWYsQ0FBdUI0RCxRQUF2QixDQUFnQyxTQUFoQyxFQUEyQztBQUFFNkMsZUFBYztBQUFoQixDQUEzQyxFQUFvRTtBQUNuRS9ELE9BQU07QUFDTCxTQUFPO0FBQ05ILFlBQVM7QUFBRSxvQkFBZ0I7QUFBbEIsSUFESDtBQUVOYyxTQUFNYixXQUFXK1gsVUFBWCxDQUFzQkMsUUFBdEIsQ0FBK0JDLE9BQS9CO0FBRkEsR0FBUDtBQUlBOztBQU5rRSxDQUFwRSxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2FwaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBSZXN0aXZ1cywgRERQLCBERFBDb21tb24gKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jbGFzcyBBUEkgZXh0ZW5kcyBSZXN0aXZ1cyB7XG5cdGNvbnN0cnVjdG9yKHByb3BlcnRpZXMpIHtcblx0XHRzdXBlcihwcm9wZXJ0aWVzKTtcblx0XHR0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIoYEFQSSAkeyBwcm9wZXJ0aWVzLnZlcnNpb24gPyBwcm9wZXJ0aWVzLnZlcnNpb24gOiAnZGVmYXVsdCcgfSBMb2dnZXJgLCB7fSk7XG5cdFx0dGhpcy5hdXRoTWV0aG9kcyA9IFtdO1xuXHRcdHRoaXMuaGVscGVyTWV0aG9kcyA9IG5ldyBNYXAoKTtcblx0XHR0aGlzLmZpZWxkU2VwYXJhdG9yID0gJy4nO1xuXHRcdHRoaXMuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSA9IHtcblx0XHRcdGpvaW5Db2RlOiAwLFxuXHRcdFx0JGxva2k6IDAsXG5cdFx0XHRtZXRhOiAwLFxuXHRcdFx0bWVtYmVyczogMCxcblx0XHRcdHVzZXJuYW1lczogMCwgLy8gUGxlYXNlIHVzZSB0aGUgYGNoYW5uZWwvZG0vZ3JvdXAubWVtYmVyc2AgZW5kcG9pbnQuIFRoaXMgaXMgZGlzYWJsZWQgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnNcblx0XHRcdGltcG9ydElkczogMFxuXHRcdH07XG5cdFx0dGhpcy5saW1pdGVkVXNlckZpZWxkc1RvRXhjbHVkZSA9IHtcblx0XHRcdGF2YXRhck9yaWdpbjogMCxcblx0XHRcdGVtYWlsczogMCxcblx0XHRcdHBob25lOiAwLFxuXHRcdFx0c3RhdHVzQ29ubmVjdGlvbjogMCxcblx0XHRcdGNyZWF0ZWRBdDogMCxcblx0XHRcdGxhc3RMb2dpbjogMCxcblx0XHRcdHNlcnZpY2VzOiAwLFxuXHRcdFx0cmVxdWlyZVBhc3N3b3JkQ2hhbmdlOiAwLFxuXHRcdFx0cmVxdWlyZVBhc3N3b3JkQ2hhbmdlUmVhc29uOiAwLFxuXHRcdFx0cm9sZXM6IDAsXG5cdFx0XHRzdGF0dXNEZWZhdWx0OiAwLFxuXHRcdFx0X3VwZGF0ZWRBdDogMCxcblx0XHRcdGN1c3RvbUZpZWxkczogMFxuXHRcdH07XG5cblx0XHR0aGlzLl9jb25maWcuZGVmYXVsdE9wdGlvbnNFbmRwb2ludCA9IGZ1bmN0aW9uIF9kZWZhdWx0T3B0aW9uc0VuZHBvaW50KCkge1xuXHRcdFx0aWYgKHRoaXMucmVxdWVzdC5tZXRob2QgPT09ICdPUFRJT05TJyAmJiB0aGlzLnJlcXVlc3QuaGVhZGVyc1snYWNjZXNzLWNvbnRyb2wtcmVxdWVzdC1tZXRob2QnXSkge1xuXHRcdFx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9FbmFibGVfQ09SUycpID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0dGhpcy5yZXNwb25zZS53cml0ZUhlYWQoMjAwLCB7XG5cdFx0XHRcdFx0XHQnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9DT1JTX09yaWdpbicpLFxuXHRcdFx0XHRcdFx0J0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnT3JpZ2luLCBYLVJlcXVlc3RlZC1XaXRoLCBDb250ZW50LVR5cGUsIEFjY2VwdCwgWC1Vc2VyLUlkLCBYLUF1dGgtVG9rZW4nXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5yZXNwb25zZS53cml0ZUhlYWQoNDA1KTtcblx0XHRcdFx0XHR0aGlzLnJlc3BvbnNlLndyaXRlKCdDT1JTIG5vdCBlbmFibGVkLiBHbyB0byBcIkFkbWluID4gR2VuZXJhbCA+IFJFU1QgQXBpXCIgdG8gZW5hYmxlIGl0LicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlc3BvbnNlLndyaXRlSGVhZCg0MDQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmRvbmUoKTtcblx0XHR9O1xuXHR9XG5cblx0YWRkQXV0aE1ldGhvZChtZXRob2QpIHtcblx0XHR0aGlzLmF1dGhNZXRob2RzLnB1c2gobWV0aG9kKTtcblx0fVxuXG5cdHN1Y2Nlc3MocmVzdWx0ID0ge30pIHtcblx0XHRpZiAoXy5pc09iamVjdChyZXN1bHQpKSB7XG5cdFx0XHRyZXN1bHQuc3VjY2VzcyA9IHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXR1c0NvZGU6IDIwMCxcblx0XHRcdGJvZHk6IHJlc3VsdFxuXHRcdH07XG5cdH1cblxuXHRmYWlsdXJlKHJlc3VsdCwgZXJyb3JUeXBlKSB7XG5cdFx0aWYgKF8uaXNPYmplY3QocmVzdWx0KSkge1xuXHRcdFx0cmVzdWx0LnN1Y2Nlc3MgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0ge1xuXHRcdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdFx0ZXJyb3I6IHJlc3VsdFxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKGVycm9yVHlwZSkge1xuXHRcdFx0XHRyZXN1bHQuZXJyb3JUeXBlID0gZXJyb3JUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzdGF0dXNDb2RlOiA0MDAsXG5cdFx0XHRib2R5OiByZXN1bHRcblx0XHR9O1xuXHR9XG5cblxuXHR1bmF1dGhvcml6ZWQobXNnKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXR1c0NvZGU6IDQwMyxcblx0XHRcdGJvZHk6IHtcblx0XHRcdFx0c3VjY2VzczogZmFsc2UsXG5cdFx0XHRcdGVycm9yOiBtc2cgPyBtc2cgOiAndW5hdXRob3JpemVkJ1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRub3RGb3VuZChtc2cpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhdHVzQ29kZTogNDA0LFxuXHRcdFx0Ym9keToge1xuXHRcdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdFx0ZXJyb3I6IG1zZyA/IG1zZyA6ICdOb3RoaW5nIHdhcyBmb3VuZCdcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0YWRkUm91dGUocm91dGVzLCBvcHRpb25zLCBlbmRwb2ludHMpIHtcblx0XHQvL05vdGU6IHJlcXVpcmVkIGlmIHRoZSBkZXZlbG9wZXIgZGlkbid0IHByb3ZpZGUgb3B0aW9uc1xuXHRcdGlmICh0eXBlb2YgZW5kcG9pbnRzID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0ZW5kcG9pbnRzID0gb3B0aW9ucztcblx0XHRcdG9wdGlvbnMgPSB7fTtcblx0XHR9XG5cblx0XHQvL0FsbG93IGZvciBtb3JlIHRoYW4gb25lIHJvdXRlIHVzaW5nIHRoZSBzYW1lIG9wdGlvbiBhbmQgZW5kcG9pbnRzXG5cdFx0aWYgKCFfLmlzQXJyYXkocm91dGVzKSkge1xuXHRcdFx0cm91dGVzID0gW3JvdXRlc107XG5cdFx0fVxuXG5cdFx0cm91dGVzLmZvckVhY2goKHJvdXRlKSA9PiB7XG5cdFx0XHQvL05vdGU6IFRoaXMgaXMgcmVxdWlyZWQgZHVlIHRvIFJlc3RpdnVzIGNhbGxpbmcgYGFkZFJvdXRlYCBpbiB0aGUgY29uc3RydWN0b3Igb2YgaXRzZWxmXG5cdFx0XHRpZiAodGhpcy5oZWxwZXJNZXRob2RzKSB7XG5cdFx0XHRcdE9iamVjdC5rZXlzKGVuZHBvaW50cykuZm9yRWFjaCgobWV0aG9kKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBlbmRwb2ludHNbbWV0aG9kXSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0ZW5kcG9pbnRzW21ldGhvZF0gPSB7YWN0aW9uOiBlbmRwb2ludHNbbWV0aG9kXX07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9BZGQgYSB0cnkvY2F0Y2ggZm9yIGVhY2ggZW5kcG9pbnRcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbEFjdGlvbiA9IGVuZHBvaW50c1ttZXRob2RdLmFjdGlvbjtcblx0XHRcdFx0XHRlbmRwb2ludHNbbWV0aG9kXS5hY3Rpb24gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGAkeyB0aGlzLnJlcXVlc3QubWV0aG9kLnRvVXBwZXJDYXNlKCkgfTogJHsgdGhpcy5yZXF1ZXN0LnVybCB9YCk7XG5cdFx0XHRcdFx0XHRsZXQgcmVzdWx0O1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0ID0gb3JpZ2luYWxBY3Rpb24uYXBwbHkodGhpcyk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGAkeyBtZXRob2QgfSAkeyByb3V0ZSB9IHRocmV3IGFuIGVycm9yOmAsIGUuc3RhY2spO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShlLm1lc3NhZ2UsIGUuZXJyb3IpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgPyByZXN1bHQgOiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cblx0XHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdFx0LyhjaGFubmVsc3xncm91cHMpXFwuLy50ZXN0KHJvdXRlKVxuXHRcdFx0XHRcdFx0XHQmJiByZXN1bHRcblx0XHRcdFx0XHRcdFx0JiYgcmVzdWx0LmJvZHlcblx0XHRcdFx0XHRcdFx0JiYgcmVzdWx0LmJvZHkuc3VjY2VzcyA9PT0gdHJ1ZVxuXHRcdFx0XHRcdFx0XHQmJiAocmVzdWx0LmJvZHkuY2hhbm5lbCB8fCByZXN1bHQuYm9keS5jaGFubmVscyB8fCByZXN1bHQuYm9keS5ncm91cCB8fCByZXN1bHQuYm9keS5ncm91cHMpXG5cdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogUmVtb3ZlIHRoaXMgYWZ0ZXIgdGhyZWUgdmVyc2lvbnMgaGF2ZSBiZWVuIHJlbGVhc2VkLiBUaGF0IG1lYW5zIGF0IDAuNjQgdGhpcyBzaG91bGQgYmUgZ29uZS4gOylcblx0XHRcdFx0XHRcdFx0cmVzdWx0LmJvZHkuZGV2ZWxvcGVyV2FybmluZyA9ICdbV0FSTklOR106IFRoZSBcInVzZXJuYW1lc1wiIGZpZWxkIGhhcyBiZWVuIHJlbW92ZWQgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMuIFBsZWFzZSB1c2UgdGhlIFwiKi5tZW1iZXJzXCIgZW5kcG9pbnQgdG8gZ2V0IGEgbGlzdCBvZiBtZW1iZXJzL3VzZXJzIGluIGEgcm9vbS4nO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRmb3IgKGNvbnN0IFtuYW1lLCBoZWxwZXJNZXRob2RdIG9mIHRoaXMuaGVscGVyTWV0aG9kcykge1xuXHRcdFx0XHRcdFx0ZW5kcG9pbnRzW21ldGhvZF1bbmFtZV0gPSBoZWxwZXJNZXRob2Q7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9BbGxvdyB0aGUgZW5kcG9pbnRzIHRvIG1ha2UgdXNhZ2Ugb2YgdGhlIGxvZ2dlciB3aGljaCByZXNwZWN0cyB0aGUgdXNlcidzIHNldHRpbmdzXG5cdFx0XHRcdFx0ZW5kcG9pbnRzW21ldGhvZF0ubG9nZ2VyID0gdGhpcy5sb2dnZXI7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzdXBlci5hZGRSb3V0ZShyb3V0ZSwgb3B0aW9ucywgZW5kcG9pbnRzKTtcblx0XHR9KTtcblx0fVxuXG5cdF9pbml0QXV0aCgpIHtcblx0XHRjb25zdCBsb2dpbkNvbXBhdGliaWxpdHkgPSAoYm9keVBhcmFtcykgPT4ge1xuXHRcdFx0Ly8gR3JhYiB0aGUgdXNlcm5hbWUgb3IgZW1haWwgdGhhdCB0aGUgdXNlciBpcyBsb2dnaW5nIGluIHdpdGhcblx0XHRcdGNvbnN0IHt1c2VyLCB1c2VybmFtZSwgZW1haWwsIHBhc3N3b3JkLCBjb2RlfSA9IGJvZHlQYXJhbXM7XG5cblx0XHRcdGlmIChwYXNzd29yZCA9PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiBib2R5UGFyYW1zO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoXy53aXRob3V0KE9iamVjdC5rZXlzKGJvZHlQYXJhbXMpLCAndXNlcicsICd1c2VybmFtZScsICdlbWFpbCcsICdwYXNzd29yZCcsICdjb2RlJykubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXR1cm4gYm9keVBhcmFtcztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYXV0aCA9IHtcblx0XHRcdFx0cGFzc3dvcmRcblx0XHRcdH07XG5cblx0XHRcdGlmICh0eXBlb2YgdXNlciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0YXV0aC51c2VyID0gdXNlci5pbmNsdWRlcygnQCcpID8ge2VtYWlsOiB1c2VyfSA6IHt1c2VybmFtZTogdXNlcn07XG5cdFx0XHR9IGVsc2UgaWYgKHVzZXJuYW1lKSB7XG5cdFx0XHRcdGF1dGgudXNlciA9IHt1c2VybmFtZX07XG5cdFx0XHR9IGVsc2UgaWYgKGVtYWlsKSB7XG5cdFx0XHRcdGF1dGgudXNlciA9IHtlbWFpbH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhdXRoLnVzZXIgPT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gYm9keVBhcmFtcztcblx0XHRcdH1cblxuXHRcdFx0aWYgKGF1dGgucGFzc3dvcmQuaGFzaGVkKSB7XG5cdFx0XHRcdGF1dGgucGFzc3dvcmQgPSB7XG5cdFx0XHRcdFx0ZGlnZXN0OiBhdXRoLnBhc3N3b3JkLFxuXHRcdFx0XHRcdGFsZ29yaXRobTogJ3NoYS0yNTYnXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjb2RlKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dG90cDoge1xuXHRcdFx0XHRcdFx0Y29kZSxcblx0XHRcdFx0XHRcdGxvZ2luOiBhdXRoXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gYXV0aDtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cblx0XHR0aGlzLmFkZFJvdXRlKCdsb2dpbicsIHthdXRoUmVxdWlyZWQ6IGZhbHNlfSwge1xuXHRcdFx0cG9zdCgpIHtcblx0XHRcdFx0Y29uc3QgYXJncyA9IGxvZ2luQ29tcGF0aWJpbGl0eSh0aGlzLmJvZHlQYXJhbXMpO1xuXG5cdFx0XHRcdGNvbnN0IGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuXHRcdFx0XHRcdGNvbm5lY3Rpb246IHtcblx0XHRcdFx0XHRcdGNsb3NlKCkge31cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGxldCBhdXRoO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF1dGggPSBERFAuX0N1cnJlbnRJbnZvY2F0aW9uLndpdGhWYWx1ZShpbnZvY2F0aW9uLCAoKSA9PiBNZXRlb3IuY2FsbCgnbG9naW4nLCBhcmdzKSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0bGV0IGUgPSBlcnJvcjtcblx0XHRcdFx0XHRpZiAoZXJyb3IucmVhc29uID09PSAnVXNlciBub3QgZm91bmQnKSB7XG5cdFx0XHRcdFx0XHRlID0ge1xuXHRcdFx0XHRcdFx0XHRlcnJvcjogJ1VuYXV0aG9yaXplZCcsXG5cdFx0XHRcdFx0XHRcdHJlYXNvbjogJ1VuYXV0aG9yaXplZCdcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHN0YXR1c0NvZGU6IDQwMSxcblx0XHRcdFx0XHRcdGJvZHk6IHtcblx0XHRcdFx0XHRcdFx0c3RhdHVzOiAnZXJyb3InLFxuXHRcdFx0XHRcdFx0XHRlcnJvcjogZS5lcnJvcixcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogZS5yZWFzb24gfHwgZS5tZXNzYWdlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMudXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHtcblx0XHRcdFx0XHRfaWQ6IGF1dGguaWRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy51c2VySWQgPSB0aGlzLnVzZXIuX2lkO1xuXG5cdFx0XHRcdC8vIFJlbW92ZSB0b2tlbkV4cGlyZXMgdG8ga2VlcCB0aGUgb2xkIGJlaGF2aW9yXG5cdFx0XHRcdE1ldGVvci51c2Vycy51cGRhdGUoe1xuXHRcdFx0XHRcdF9pZDogdGhpcy51c2VyLl9pZCxcblx0XHRcdFx0XHQnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLmhhc2hlZFRva2VuJzogQWNjb3VudHMuX2hhc2hMb2dpblRva2VuKGF1dGgudG9rZW4pXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHQkdW5zZXQ6IHtcblx0XHRcdFx0XHRcdCdzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuJC53aGVuJzogMVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgcmVzcG9uc2UgPSB7XG5cdFx0XHRcdFx0c3RhdHVzOiAnc3VjY2VzcycsXG5cdFx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdFx0dXNlcklkOiB0aGlzLnVzZXJJZCxcblx0XHRcdFx0XHRcdGF1dGhUb2tlbjogYXV0aC50b2tlblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHRjb25zdCBleHRyYURhdGEgPSBzZWxmLl9jb25maWcub25Mb2dnZWRJbiAmJiBzZWxmLl9jb25maWcub25Mb2dnZWRJbi5jYWxsKHRoaXMpO1xuXG5cdFx0XHRcdGlmIChleHRyYURhdGEgIT0gbnVsbCkge1xuXHRcdFx0XHRcdF8uZXh0ZW5kKHJlc3BvbnNlLmRhdGEsIHtcblx0XHRcdFx0XHRcdGV4dHJhOiBleHRyYURhdGFcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiByZXNwb25zZTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGxvZ291dCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBnaXZlbiBhdXRoIHRva2VuIGZyb20gdGhlIHVzZXIncyBhY2NvdW50XG5cdFx0XHRjb25zdCBhdXRoVG9rZW4gPSB0aGlzLnJlcXVlc3QuaGVhZGVyc1sneC1hdXRoLXRva2VuJ107XG5cdFx0XHRjb25zdCBoYXNoZWRUb2tlbiA9IEFjY291bnRzLl9oYXNoTG9naW5Ub2tlbihhdXRoVG9rZW4pO1xuXHRcdFx0Y29uc3QgdG9rZW5Mb2NhdGlvbiA9IHNlbGYuX2NvbmZpZy5hdXRoLnRva2VuO1xuXHRcdFx0Y29uc3QgaW5kZXggPSB0b2tlbkxvY2F0aW9uLmxhc3RJbmRleE9mKCcuJyk7XG5cdFx0XHRjb25zdCB0b2tlblBhdGggPSB0b2tlbkxvY2F0aW9uLnN1YnN0cmluZygwLCBpbmRleCk7XG5cdFx0XHRjb25zdCB0b2tlbkZpZWxkTmFtZSA9IHRva2VuTG9jYXRpb24uc3Vic3RyaW5nKGluZGV4ICsgMSk7XG5cdFx0XHRjb25zdCB0b2tlblRvUmVtb3ZlID0ge307XG5cdFx0XHR0b2tlblRvUmVtb3ZlW3Rva2VuRmllbGROYW1lXSA9IGhhc2hlZFRva2VuO1xuXHRcdFx0Y29uc3QgdG9rZW5SZW1vdmFsUXVlcnkgPSB7fTtcblx0XHRcdHRva2VuUmVtb3ZhbFF1ZXJ5W3Rva2VuUGF0aF0gPSB0b2tlblRvUmVtb3ZlO1xuXG5cdFx0XHRNZXRlb3IudXNlcnMudXBkYXRlKHRoaXMudXNlci5faWQsIHtcblx0XHRcdFx0JHB1bGw6IHRva2VuUmVtb3ZhbFF1ZXJ5XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSB7XG5cdFx0XHRcdHN0YXR1czogJ3N1Y2Nlc3MnLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0bWVzc2FnZTogJ1lvdVxcJ3ZlIGJlZW4gbG9nZ2VkIG91dCEnXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdC8vIENhbGwgdGhlIGxvZ291dCBob29rIHdpdGggdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciBhdHRhY2hlZFxuXHRcdFx0Y29uc3QgZXh0cmFEYXRhID0gc2VsZi5fY29uZmlnLm9uTG9nZ2VkT3V0ICYmIHNlbGYuX2NvbmZpZy5vbkxvZ2dlZE91dC5jYWxsKHRoaXMpO1xuXHRcdFx0aWYgKGV4dHJhRGF0YSAhPSBudWxsKSB7XG5cdFx0XHRcdF8uZXh0ZW5kKHJlc3BvbnNlLmRhdGEsIHtcblx0XHRcdFx0XHRleHRyYTogZXh0cmFEYXRhXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3BvbnNlO1xuXHRcdH07XG5cblx0XHQvKlxuXHRcdEFkZCBhIGxvZ291dCBlbmRwb2ludCB0byB0aGUgQVBJXG5cdFx0QWZ0ZXIgdGhlIHVzZXIgaXMgbG9nZ2VkIG91dCwgdGhlIG9uTG9nZ2VkT3V0IGhvb2sgaXMgY2FsbGVkIChzZWUgUmVzdGZ1bGx5LmNvbmZpZ3VyZSgpIGZvclxuXHRcdGFkZGluZyBob29rKS5cblx0XHQqL1xuXHRcdHJldHVybiB0aGlzLmFkZFJvdXRlKCdsb2dvdXQnLCB7XG5cdFx0XHRhdXRoUmVxdWlyZWQ6IHRydWVcblx0XHR9LCB7XG5cdFx0XHRnZXQoKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignV2FybmluZzogRGVmYXVsdCBsb2dvdXQgdmlhIEdFVCB3aWxsIGJlIHJlbW92ZWQgaW4gUmVzdGl2dXMgdjEuMC4gVXNlIFBPU1QgaW5zdGVhZC4nKTtcblx0XHRcdFx0Y29uc29sZS53YXJuKCcgICAgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9rYWhtYWxpL21ldGVvci1yZXN0aXZ1cy9pc3N1ZXMvMTAwJyk7XG5cdFx0XHRcdHJldHVybiBsb2dvdXQuY2FsbCh0aGlzKTtcblx0XHRcdH0sXG5cdFx0XHRwb3N0OiBsb2dvdXRcblx0XHR9KTtcblx0fVxufVxuXG5cblJvY2tldENoYXQuQVBJID0ge307XG5cbmNvbnN0IGdldFVzZXJBdXRoID0gZnVuY3Rpb24gX2dldFVzZXJBdXRoKCkge1xuXHRjb25zdCBpbnZhbGlkUmVzdWx0cyA9IFt1bmRlZmluZWQsIG51bGwsIGZhbHNlXTtcblx0cmV0dXJuIHtcblx0XHR0b2tlbjogJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlbicsXG5cdFx0dXNlcigpIHtcblx0XHRcdGlmICh0aGlzLmJvZHlQYXJhbXMgJiYgdGhpcy5ib2R5UGFyYW1zLnBheWxvYWQpIHtcblx0XHRcdFx0dGhpcy5ib2R5UGFyYW1zID0gSlNPTi5wYXJzZSh0aGlzLmJvZHlQYXJhbXMucGF5bG9hZCk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgUm9ja2V0Q2hhdC5BUEkudjEuYXV0aE1ldGhvZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbWV0aG9kID0gUm9ja2V0Q2hhdC5BUEkudjEuYXV0aE1ldGhvZHNbaV07XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBtZXRob2QgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBtZXRob2QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHRcdFx0XHRpZiAoIWludmFsaWRSZXN1bHRzLmluY2x1ZGVzKHJlc3VsdCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGxldCB0b2tlbjtcblx0XHRcdGlmICh0aGlzLnJlcXVlc3QuaGVhZGVyc1sneC1hdXRoLXRva2VuJ10pIHtcblx0XHRcdFx0dG9rZW4gPSBBY2NvdW50cy5faGFzaExvZ2luVG9rZW4odGhpcy5yZXF1ZXN0LmhlYWRlcnNbJ3gtYXV0aC10b2tlbiddKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dXNlcklkOiB0aGlzLnJlcXVlc3QuaGVhZGVyc1sneC11c2VyLWlkJ10sXG5cdFx0XHRcdHRva2VuXG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcbn07XG5cbmNvbnN0IGNyZWF0ZUFwaSA9IGZ1bmN0aW9uKGVuYWJsZUNvcnMpIHtcblx0aWYgKCFSb2NrZXRDaGF0LkFQSS52MSB8fCBSb2NrZXRDaGF0LkFQSS52MS5fY29uZmlnLmVuYWJsZUNvcnMgIT09IGVuYWJsZUNvcnMpIHtcblx0XHRSb2NrZXRDaGF0LkFQSS52MSA9IG5ldyBBUEkoe1xuXHRcdFx0dmVyc2lvbjogJ3YxJyxcblx0XHRcdHVzZURlZmF1bHRBdXRoOiB0cnVlLFxuXHRcdFx0cHJldHR5SnNvbjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcsXG5cdFx0XHRlbmFibGVDb3JzLFxuXHRcdFx0YXV0aDogZ2V0VXNlckF1dGgoKVxuXHRcdH0pO1xuXHR9XG5cblx0aWYgKCFSb2NrZXRDaGF0LkFQSS5kZWZhdWx0IHx8IFJvY2tldENoYXQuQVBJLmRlZmF1bHQuX2NvbmZpZy5lbmFibGVDb3JzICE9PSBlbmFibGVDb3JzKSB7XG5cdFx0Um9ja2V0Q2hhdC5BUEkuZGVmYXVsdCA9IG5ldyBBUEkoe1xuXHRcdFx0dXNlRGVmYXVsdEF1dGg6IHRydWUsXG5cdFx0XHRwcmV0dHlKc29uOiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jyxcblx0XHRcdGVuYWJsZUNvcnMsXG5cdFx0XHRhdXRoOiBnZXRVc2VyQXV0aCgpXG5cdFx0fSk7XG5cdH1cbn07XG5cbi8vIHJlZ2lzdGVyIHRoZSBBUEkgdG8gYmUgcmUtY3JlYXRlZCBvbmNlIHRoZSBDT1JTLXNldHRpbmcgY2hhbmdlcy5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRW5hYmxlX0NPUlMnLCAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRjcmVhdGVBcGkodmFsdWUpO1xufSk7XG5cbi8vIGFsc28gY3JlYXRlIHRoZSBBUEkgaW1tZWRpYXRlbHlcbmNyZWF0ZUFwaSghIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRW5hYmxlX0NPUlMnKSk7XG4iLCJSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdHZW5lcmFsJywgZnVuY3Rpb24oKSB7XG5cdHRoaXMuc2VjdGlvbignUkVTVCBBUEknLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnQVBJX1VwcGVyX0NvdW50X0xpbWl0JywgMTAwLCB7IHR5cGU6ICdpbnQnLCBwdWJsaWM6IGZhbHNlIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfRGVmYXVsdF9Db3VudCcsIDUwLCB7IHR5cGU6ICdpbnQnLCBwdWJsaWM6IGZhbHNlIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfQWxsb3dfSW5maW5pdGVfQ291bnQnLCB0cnVlLCB7IHR5cGU6ICdib29sZWFuJywgcHVibGljOiBmYWxzZSB9KTtcblx0XHR0aGlzLmFkZCgnQVBJX0VuYWJsZV9EaXJlY3RfTWVzc2FnZV9IaXN0b3J5X0VuZFBvaW50JywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBwdWJsaWM6IGZhbHNlIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfRW5hYmxlX1NoaWVsZHMnLCB0cnVlLCB7IHR5cGU6ICdib29sZWFuJywgcHVibGljOiBmYWxzZSB9KTtcblx0XHR0aGlzLmFkZCgnQVBJX1NoaWVsZF9UeXBlcycsICcqJywgeyB0eXBlOiAnc3RyaW5nJywgcHVibGljOiBmYWxzZSwgZW5hYmxlUXVlcnk6IHsgX2lkOiAnQVBJX0VuYWJsZV9TaGllbGRzJywgdmFsdWU6IHRydWUgfSB9KTtcblx0XHR0aGlzLmFkZCgnQVBJX0VuYWJsZV9DT1JTJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBwdWJsaWM6IGZhbHNlIH0pO1xuXHRcdHRoaXMuYWRkKCdBUElfQ09SU19PcmlnaW4nLCAnKicsIHsgdHlwZTogJ3N0cmluZycsIHB1YmxpYzogZmFsc2UsIGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0FQSV9FbmFibGVfQ09SUycsIHZhbHVlOiB0cnVlIH0gfSk7XG5cdH0pO1xufSk7XG4iLCJSb2NrZXRDaGF0LkFQSS52MS5oZWxwZXJNZXRob2RzLnNldCgncmVxdWVzdFBhcmFtcycsIGZ1bmN0aW9uIF9yZXF1ZXN0UGFyYW1zKCkge1xuXHRyZXR1cm4gWydQT1NUJywgJ1BVVCddLmluY2x1ZGVzKHRoaXMucmVxdWVzdC5tZXRob2QpID8gdGhpcy5ib2R5UGFyYW1zIDogdGhpcy5xdWVyeVBhcmFtcztcbn0pO1xuIiwiLy8gSWYgdGhlIGNvdW50IHF1ZXJ5IHBhcmFtIGlzIGhpZ2hlciB0aGFuIHRoZSBcIkFQSV9VcHBlcl9Db3VudF9MaW1pdFwiIHNldHRpbmcsIHRoZW4gd2UgbGltaXQgdGhhdFxuLy8gSWYgdGhlIGNvdW50IHF1ZXJ5IHBhcmFtIGlzbid0IGRlZmluZWQsIHRoZW4gd2Ugc2V0IGl0IHRvIHRoZSBcIkFQSV9EZWZhdWx0X0NvdW50XCIgc2V0dGluZ1xuLy8gSWYgdGhlIGNvdW50IGlzIHplcm8sIHRoZW4gdGhhdCBtZWFucyB1bmxpbWl0ZWQgYW5kIGlzIG9ubHkgYWxsb3dlZCBpZiB0aGUgc2V0dGluZyBcIkFQSV9BbGxvd19JbmZpbml0ZV9Db3VudFwiIGlzIHRydWVcblxuUm9ja2V0Q2hhdC5BUEkudjEuaGVscGVyTWV0aG9kcy5zZXQoJ2dldFBhZ2luYXRpb25JdGVtcycsIGZ1bmN0aW9uIF9nZXRQYWdpbmF0aW9uSXRlbXMoKSB7XG5cdGNvbnN0IGhhcmRVcHBlckxpbWl0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9VcHBlcl9Db3VudF9MaW1pdCcpIDw9IDAgPyAxMDAgOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX1VwcGVyX0NvdW50X0xpbWl0Jyk7XG5cdGNvbnN0IGRlZmF1bHRDb3VudCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRGVmYXVsdF9Db3VudCcpIDw9IDAgPyA1MCA6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRGVmYXVsdF9Db3VudCcpO1xuXHRjb25zdCBvZmZzZXQgPSB0aGlzLnF1ZXJ5UGFyYW1zLm9mZnNldCA/IHBhcnNlSW50KHRoaXMucXVlcnlQYXJhbXMub2Zmc2V0KSA6IDA7XG5cdGxldCBjb3VudCA9IGRlZmF1bHRDb3VudDtcblxuXHQvLyBFbnN1cmUgY291bnQgaXMgYW4gYXBwcm9waWF0ZSBhbW91bnRcblx0aWYgKHR5cGVvZiB0aGlzLnF1ZXJ5UGFyYW1zLmNvdW50ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdGNvdW50ID0gcGFyc2VJbnQodGhpcy5xdWVyeVBhcmFtcy5jb3VudCk7XG5cdH0gZWxzZSB7XG5cdFx0Y291bnQgPSBkZWZhdWx0Q291bnQ7XG5cdH1cblxuXHRpZiAoY291bnQgPiBoYXJkVXBwZXJMaW1pdCkge1xuXHRcdGNvdW50ID0gaGFyZFVwcGVyTGltaXQ7XG5cdH1cblxuXHRpZiAoY291bnQgPT09IDAgJiYgIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfQWxsb3dfSW5maW5pdGVfQ291bnQnKSkge1xuXHRcdGNvdW50ID0gZGVmYXVsdENvdW50O1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRvZmZzZXQsXG5cdFx0Y291bnRcblx0fTtcbn0pO1xuIiwiLy9Db252ZW5pZW5jZSBtZXRob2QsIGFsbW9zdCBuZWVkIHRvIHR1cm4gaXQgaW50byBhIG1pZGRsZXdhcmUgb2Ygc29ydHNcblJvY2tldENoYXQuQVBJLnYxLmhlbHBlck1ldGhvZHMuc2V0KCdnZXRVc2VyRnJvbVBhcmFtcycsIGZ1bmN0aW9uIF9nZXRVc2VyRnJvbVBhcmFtcygpIHtcblx0Y29uc3QgZG9lc250RXhpc3QgPSB7IF9kb2VzbnRFeGlzdDogdHJ1ZSB9O1xuXHRsZXQgdXNlcjtcblx0Y29uc3QgcGFyYW1zID0gdGhpcy5yZXF1ZXN0UGFyYW1zKCk7XG5cblx0aWYgKHBhcmFtcy51c2VySWQgJiYgcGFyYW1zLnVzZXJJZC50cmltKCkpIHtcblx0XHR1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQocGFyYW1zLnVzZXJJZCkgfHwgZG9lc250RXhpc3Q7XG5cdH0gZWxzZSBpZiAocGFyYW1zLnVzZXJuYW1lICYmIHBhcmFtcy51c2VybmFtZS50cmltKCkpIHtcblx0XHR1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUocGFyYW1zLnVzZXJuYW1lKSB8fCBkb2VzbnRFeGlzdDtcblx0fSBlbHNlIGlmIChwYXJhbXMudXNlciAmJiBwYXJhbXMudXNlci50cmltKCkpIHtcblx0XHR1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUocGFyYW1zLnVzZXIpIHx8IGRvZXNudEV4aXN0O1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXVzZXItcGFyYW0tbm90LXByb3ZpZGVkJywgJ1RoZSByZXF1aXJlZCBcInVzZXJJZFwiIG9yIFwidXNlcm5hbWVcIiBwYXJhbSB3YXMgbm90IHByb3ZpZGVkJyk7XG5cdH1cblxuXHRpZiAodXNlci5fZG9lc250RXhpc3QpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnVGhlIHJlcXVpcmVkIFwidXNlcklkXCIgb3IgXCJ1c2VybmFtZVwiIHBhcmFtIHByb3ZpZGVkIGRvZXMgbm90IG1hdGNoIGFueSB1c2VycycpO1xuXHR9XG5cblx0cmV0dXJuIHVzZXI7XG59KTtcbiIsIlJvY2tldENoYXQuQVBJLnYxLmhlbHBlck1ldGhvZHMuc2V0KCdpc1VzZXJGcm9tUGFyYW1zJywgZnVuY3Rpb24gX2lzVXNlckZyb21QYXJhbXMoKSB7XG5cdGNvbnN0IHBhcmFtcyA9IHRoaXMucmVxdWVzdFBhcmFtcygpO1xuXG5cdHJldHVybiAoIXBhcmFtcy51c2VySWQgJiYgIXBhcmFtcy51c2VybmFtZSAmJiAhcGFyYW1zLnVzZXIpIHx8XG5cdFx0KHBhcmFtcy51c2VySWQgJiYgdGhpcy51c2VySWQgPT09IHBhcmFtcy51c2VySWQpIHx8XG5cdFx0KHBhcmFtcy51c2VybmFtZSAmJiB0aGlzLnVzZXIudXNlcm5hbWUgPT09IHBhcmFtcy51c2VybmFtZSkgfHxcblx0XHQocGFyYW1zLnVzZXIgJiYgdGhpcy51c2VyLnVzZXJuYW1lID09PSBwYXJhbXMudXNlcik7XG59KTtcbiIsIlJvY2tldENoYXQuQVBJLnYxLmhlbHBlck1ldGhvZHMuc2V0KCdwYXJzZUpzb25RdWVyeScsIGZ1bmN0aW9uIF9wYXJzZUpzb25RdWVyeSgpIHtcblx0bGV0IHNvcnQ7XG5cdGlmICh0aGlzLnF1ZXJ5UGFyYW1zLnNvcnQpIHtcblx0XHR0cnkge1xuXHRcdFx0c29ydCA9IEpTT04ucGFyc2UodGhpcy5xdWVyeVBhcmFtcy5zb3J0KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci53YXJuKGBJbnZhbGlkIHNvcnQgcGFyYW1ldGVyIHByb3ZpZGVkIFwiJHsgdGhpcy5xdWVyeVBhcmFtcy5zb3J0IH1cIjpgLCBlKTtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtc29ydCcsIGBJbnZhbGlkIHNvcnQgcGFyYW1ldGVyIHByb3ZpZGVkOiBcIiR7IHRoaXMucXVlcnlQYXJhbXMuc29ydCB9XCJgLCB7IGhlbHBlck1ldGhvZDogJ3BhcnNlSnNvblF1ZXJ5JyB9KTtcblx0XHR9XG5cdH1cblxuXHRsZXQgZmllbGRzO1xuXHRpZiAodGhpcy5xdWVyeVBhcmFtcy5maWVsZHMpIHtcblx0XHR0cnkge1xuXHRcdFx0ZmllbGRzID0gSlNPTi5wYXJzZSh0aGlzLnF1ZXJ5UGFyYW1zLmZpZWxkcyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dnZXIud2FybihgSW52YWxpZCBmaWVsZHMgcGFyYW1ldGVyIHByb3ZpZGVkIFwiJHsgdGhpcy5xdWVyeVBhcmFtcy5maWVsZHMgfVwiOmAsIGUpO1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1maWVsZHMnLCBgSW52YWxpZCBmaWVsZHMgcGFyYW1ldGVyIHByb3ZpZGVkOiBcIiR7IHRoaXMucXVlcnlQYXJhbXMuZmllbGRzIH1cImAsIHsgaGVscGVyTWV0aG9kOiAncGFyc2VKc29uUXVlcnknIH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vIFZlcmlmeSB0aGUgdXNlcidzIHNlbGVjdGVkIGZpZWxkcyBvbmx5IGNvbnRhaW5zIG9uZXMgd2hpY2ggdGhlaXIgcm9sZSBhbGxvd3Ncblx0aWYgKHR5cGVvZiBmaWVsZHMgPT09ICdvYmplY3QnKSB7XG5cdFx0bGV0IG5vblNlbGVjdGFibGVGaWVsZHMgPSBPYmplY3Qua2V5cyhSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlKTtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctZnVsbC1vdGhlci11c2VyLWluZm8nKSAmJiB0aGlzLnJlcXVlc3Qucm91dGUuaW5jbHVkZXMoJy92MS91c2Vycy4nKSkge1xuXHRcdFx0bm9uU2VsZWN0YWJsZUZpZWxkcyA9IG5vblNlbGVjdGFibGVGaWVsZHMuY29uY2F0KE9iamVjdC5rZXlzKFJvY2tldENoYXQuQVBJLnYxLmxpbWl0ZWRVc2VyRmllbGRzVG9FeGNsdWRlKSk7XG5cdFx0fVxuXG5cdFx0T2JqZWN0LmtleXMoZmllbGRzKS5mb3JFYWNoKChrKSA9PiB7XG5cdFx0XHRpZiAobm9uU2VsZWN0YWJsZUZpZWxkcy5pbmNsdWRlcyhrKSB8fCBub25TZWxlY3RhYmxlRmllbGRzLmluY2x1ZGVzKGsuc3BsaXQoUm9ja2V0Q2hhdC5BUEkudjEuZmllbGRTZXBhcmF0b3IpWzBdKSkge1xuXHRcdFx0XHRkZWxldGUgZmllbGRzW2tdO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Ly8gTGltaXQgdGhlIGZpZWxkcyBieSBkZWZhdWx0XG5cdGZpZWxkcyA9IE9iamVjdC5hc3NpZ24oe30sIGZpZWxkcywgUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSk7XG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1mdWxsLW90aGVyLXVzZXItaW5mbycpICYmIHRoaXMucmVxdWVzdC5yb3V0ZS5pbmNsdWRlcygnL3YxL3VzZXJzLicpKSB7XG5cdFx0ZmllbGRzID0gT2JqZWN0LmFzc2lnbihmaWVsZHMsIFJvY2tldENoYXQuQVBJLnYxLmxpbWl0ZWRVc2VyRmllbGRzVG9FeGNsdWRlKTtcblx0fVxuXG5cdGxldCBxdWVyeTtcblx0aWYgKHRoaXMucXVlcnlQYXJhbXMucXVlcnkpIHtcblx0XHR0cnkge1xuXHRcdFx0cXVlcnkgPSBKU09OLnBhcnNlKHRoaXMucXVlcnlQYXJhbXMucXVlcnkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYEludmFsaWQgcXVlcnkgcGFyYW1ldGVyIHByb3ZpZGVkIFwiJHsgdGhpcy5xdWVyeVBhcmFtcy5xdWVyeSB9XCI6YCwgZSk7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXF1ZXJ5JywgYEludmFsaWQgcXVlcnkgcGFyYW1ldGVyIHByb3ZpZGVkOiBcIiR7IHRoaXMucXVlcnlQYXJhbXMucXVlcnkgfVwiYCwgeyBoZWxwZXJNZXRob2Q6ICdwYXJzZUpzb25RdWVyeScgfSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gVmVyaWZ5IHRoZSB1c2VyIGhhcyBwZXJtaXNzaW9uIHRvIHF1ZXJ5IHRoZSBmaWVsZHMgdGhleSBhcmVcblx0aWYgKHR5cGVvZiBxdWVyeSA9PT0gJ29iamVjdCcpIHtcblx0XHRsZXQgbm9uUXVlcmFibGVGaWVsZHMgPSBPYmplY3Qua2V5cyhSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlKTtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctZnVsbC1vdGhlci11c2VyLWluZm8nKSAmJiB0aGlzLnJlcXVlc3Qucm91dGUuaW5jbHVkZXMoJy92MS91c2Vycy4nKSkge1xuXHRcdFx0bm9uUXVlcmFibGVGaWVsZHMgPSBub25RdWVyYWJsZUZpZWxkcy5jb25jYXQoT2JqZWN0LmtleXMoUm9ja2V0Q2hhdC5BUEkudjEubGltaXRlZFVzZXJGaWVsZHNUb0V4Y2x1ZGUpKTtcblx0XHR9XG5cblx0XHRPYmplY3Qua2V5cyhxdWVyeSkuZm9yRWFjaCgoaykgPT4ge1xuXHRcdFx0aWYgKG5vblF1ZXJhYmxlRmllbGRzLmluY2x1ZGVzKGspIHx8IG5vblF1ZXJhYmxlRmllbGRzLmluY2x1ZGVzKGsuc3BsaXQoUm9ja2V0Q2hhdC5BUEkudjEuZmllbGRTZXBhcmF0b3IpWzBdKSkge1xuXHRcdFx0XHRkZWxldGUgcXVlcnlba107XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHNvcnQsXG5cdFx0ZmllbGRzLFxuXHRcdHF1ZXJ5XG5cdH07XG59KTtcbiIsIlJvY2tldENoYXQuQVBJLnYxLmhlbHBlck1ldGhvZHMuc2V0KCdnZXRMb2dnZWRJblVzZXInLCBmdW5jdGlvbiBfZ2V0TG9nZ2VkSW5Vc2VyKCkge1xuXHRsZXQgdXNlcjtcblxuXHRpZiAodGhpcy5yZXF1ZXN0LmhlYWRlcnNbJ3gtYXV0aC10b2tlbiddICYmIHRoaXMucmVxdWVzdC5oZWFkZXJzWyd4LXVzZXItaWQnXSkge1xuXHRcdHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lKHtcblx0XHRcdCdfaWQnOiB0aGlzLnJlcXVlc3QuaGVhZGVyc1sneC11c2VyLWlkJ10sXG5cdFx0XHQnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLmhhc2hlZFRva2VuJzogQWNjb3VudHMuX2hhc2hMb2dpblRva2VuKHRoaXMucmVxdWVzdC5oZWFkZXJzWyd4LWF1dGgtdG9rZW4nXSlcblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiB1c2VyO1xufSk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuLy9SZXR1cm5zIHRoZSBjaGFubmVsIElGIGZvdW5kIG90aGVyd2lzZSBpdCB3aWxsIHJldHVybiB0aGUgZmFpbHVyZSBvZiB3aHkgaXQgZGlkbid0LiBDaGVjayB0aGUgYHN0YXR1c0NvZGVgIHByb3BlcnR5XG5mdW5jdGlvbiBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXMsIGNoZWNrZWRBcmNoaXZlZCA9IHRydWUsIHJldHVyblVzZXJuYW1lcyA9IGZhbHNlIH0pIHtcblx0aWYgKCghcGFyYW1zLnJvb21JZCB8fCAhcGFyYW1zLnJvb21JZC50cmltKCkpICYmICghcGFyYW1zLnJvb21OYW1lIHx8ICFwYXJhbXMucm9vbU5hbWUudHJpbSgpKSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXJvb21pZC1wYXJhbS1ub3QtcHJvdmlkZWQnLCAnVGhlIHBhcmFtZXRlciBcInJvb21JZFwiIG9yIFwicm9vbU5hbWVcIiBpcyByZXF1aXJlZCcpO1xuXHR9XG5cblx0Y29uc3QgZmllbGRzID0geyAuLi5Sb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH07XG5cdGlmIChyZXR1cm5Vc2VybmFtZXMpIHtcblx0XHRkZWxldGUgZmllbGRzLnVzZXJuYW1lcztcblx0fVxuXG5cdGxldCByb29tO1xuXHRpZiAocGFyYW1zLnJvb21JZCkge1xuXHRcdHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChwYXJhbXMucm9vbUlkLCB7IGZpZWxkcyB9KTtcblx0fSBlbHNlIGlmIChwYXJhbXMucm9vbU5hbWUpIHtcblx0XHRyb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5TmFtZShwYXJhbXMucm9vbU5hbWUsIHsgZmllbGRzIH0pO1xuXHR9XG5cblx0aWYgKCFyb29tIHx8IHJvb20udCAhPT0gJ2MnKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itcm9vbS1ub3QtZm91bmQnLCAnVGhlIHJlcXVpcmVkIFwicm9vbUlkXCIgb3IgXCJyb29tTmFtZVwiIHBhcmFtIHByb3ZpZGVkIGRvZXMgbm90IG1hdGNoIGFueSBjaGFubmVsJyk7XG5cdH1cblxuXHRpZiAoY2hlY2tlZEFyY2hpdmVkICYmIHJvb20uYXJjaGl2ZWQpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb29tLWFyY2hpdmVkJywgYFRoZSBjaGFubmVsLCAkeyByb29tLm5hbWUgfSwgaXMgYXJjaGl2ZWRgKTtcblx0fVxuXG5cdHJldHVybiByb29tO1xufVxuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuYWRkQWxsJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpIH0pO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2FkZEFsbFVzZXJUb1Jvb20nLCBmaW5kUmVzdWx0Ll9pZCwgdGhpcy5ib2R5UGFyYW1zLmFjdGl2ZVVzZXJzT25seSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRjaGFubmVsOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0Ll9pZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5hZGRNb2RlcmF0b3InLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCkgfSk7XG5cblx0XHRjb25zdCB1c2VyID0gdGhpcy5nZXRVc2VyRnJvbVBhcmFtcygpO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2FkZFJvb21Nb2RlcmF0b3InLCBmaW5kUmVzdWx0Ll9pZCwgdXNlci5faWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5hZGRPd25lcicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnYWRkUm9vbU93bmVyJywgZmluZFJlc3VsdC5faWQsIHVzZXIuX2lkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuYXJjaGl2ZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdhcmNoaXZlUm9vbScsIGZpbmRSZXN1bHQuX2lkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuY2xlYW5IaXN0b3J5JywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpIH0pO1xuXG5cdFx0aWYgKCF0aGlzLmJvZHlQYXJhbXMubGF0ZXN0KSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnQm9keSBwYXJhbWV0ZXIgXCJsYXRlc3RcIiBpcyByZXF1aXJlZC4nKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy5vbGRlc3QpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdCb2R5IHBhcmFtZXRlciBcIm9sZGVzdFwiIGlzIHJlcXVpcmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhdGVzdCA9IG5ldyBEYXRlKHRoaXMuYm9keVBhcmFtcy5sYXRlc3QpO1xuXHRcdGNvbnN0IG9sZGVzdCA9IG5ldyBEYXRlKHRoaXMuYm9keVBhcmFtcy5vbGRlc3QpO1xuXG5cdFx0bGV0IGluY2x1c2l2ZSA9IGZhbHNlO1xuXHRcdGlmICh0eXBlb2YgdGhpcy5ib2R5UGFyYW1zLmluY2x1c2l2ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGluY2x1c2l2ZSA9IHRoaXMuYm9keVBhcmFtcy5pbmNsdXNpdmU7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2NsZWFuQ2hhbm5lbEhpc3RvcnknLCB7IHJvb21JZDogZmluZFJlc3VsdC5faWQsIGxhdGVzdCwgb2xkZXN0LCBpbmNsdXNpdmUgfSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLmNsb3NlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0Y29uc3Qgc3ViID0gUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kT25lQnlSb29tSWRBbmRVc2VySWQoZmluZFJlc3VsdC5faWQsIHRoaXMudXNlcklkKTtcblxuXHRcdGlmICghc3ViKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgVGhlIHVzZXIvY2FsbGVlIGlzIG5vdCBpbiB0aGUgY2hhbm5lbCBcIiR7IGZpbmRSZXN1bHQubmFtZSB9LmApO1xuXHRcdH1cblxuXHRcdGlmICghc3ViLm9wZW4pIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKGBUaGUgY2hhbm5lbCwgJHsgZmluZFJlc3VsdC5uYW1lIH0sIGlzIGFscmVhZHkgY2xvc2VkIHRvIHRoZSBzZW5kZXJgKTtcblx0XHR9XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnaGlkZVJvb20nLCBmaW5kUmVzdWx0Ll9pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLmNyZWF0ZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ2NyZWF0ZS1jJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy5uYW1lKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnQm9keSBwYXJhbSBcIm5hbWVcIiBpcyByZXF1aXJlZCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmJvZHlQYXJhbXMubWVtYmVycyAmJiAhXy5pc0FycmF5KHRoaXMuYm9keVBhcmFtcy5tZW1iZXJzKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ0JvZHkgcGFyYW0gXCJtZW1iZXJzXCIgbXVzdCBiZSBhbiBhcnJheSBpZiBwcm92aWRlZCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmJvZHlQYXJhbXMuY3VzdG9tRmllbGRzICYmICEodHlwZW9mIHRoaXMuYm9keVBhcmFtcy5jdXN0b21GaWVsZHMgPT09ICdvYmplY3QnKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ0JvZHkgcGFyYW0gXCJjdXN0b21GaWVsZHNcIiBtdXN0IGJlIGFuIG9iamVjdCBpZiBwcm92aWRlZCcpO1xuXHRcdH1cblxuXHRcdGxldCByZWFkT25seSA9IGZhbHNlO1xuXHRcdGlmICh0eXBlb2YgdGhpcy5ib2R5UGFyYW1zLnJlYWRPbmx5ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmVhZE9ubHkgPSB0aGlzLmJvZHlQYXJhbXMucmVhZE9ubHk7XG5cdFx0fVxuXG5cdFx0bGV0IGlkO1xuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdGlkID0gTWV0ZW9yLmNhbGwoJ2NyZWF0ZUNoYW5uZWwnLCB0aGlzLmJvZHlQYXJhbXMubmFtZSwgdGhpcy5ib2R5UGFyYW1zLm1lbWJlcnMgPyB0aGlzLmJvZHlQYXJhbXMubWVtYmVycyA6IFtdLCByZWFkT25seSwgdGhpcy5ib2R5UGFyYW1zLmN1c3RvbUZpZWxkcyk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRjaGFubmVsOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpZC5yaWQsIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuZGVsZXRlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2VyYXNlUm9vbScsIGZpbmRSZXN1bHQuX2lkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGNoYW5uZWw6IGZpbmRSZXN1bHRcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5maWxlcycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2NhbkFjY2Vzc1Jvb20nLCBmaW5kUmVzdWx0Ll9pZCwgdGhpcy51c2VySWQpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCwgZmllbGRzLCBxdWVyeSB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0Y29uc3Qgb3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgeyByaWQ6IGZpbmRSZXN1bHQuX2lkIH0pO1xuXG5cdFx0Y29uc3QgZmlsZXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5VcGxvYWRzLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyBuYW1lOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHNcblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0ZmlsZXMsXG5cdFx0XHRjb3VudDogZmlsZXMubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLlVwbG9hZHMuZmluZChvdXJRdWVyeSkuY291bnQoKVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLmdldEludGVncmF0aW9ucycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIGNoZWNrZWRBcmNoaXZlZDogZmFsc2UgfSk7XG5cblx0XHRsZXQgaW5jbHVkZUFsbFB1YmxpY0NoYW5uZWxzID0gdHJ1ZTtcblx0XHRpZiAodHlwZW9mIHRoaXMucXVlcnlQYXJhbXMuaW5jbHVkZUFsbFB1YmxpY0NoYW5uZWxzICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0aW5jbHVkZUFsbFB1YmxpY0NoYW5uZWxzID0gdGhpcy5xdWVyeVBhcmFtcy5pbmNsdWRlQWxsUHVibGljQ2hhbm5lbHMgPT09ICd0cnVlJztcblx0XHR9XG5cblx0XHRsZXQgb3VyUXVlcnkgPSB7XG5cdFx0XHRjaGFubmVsOiBgIyR7IGZpbmRSZXN1bHQubmFtZSB9YFxuXHRcdH07XG5cblx0XHRpZiAoaW5jbHVkZUFsbFB1YmxpY0NoYW5uZWxzKSB7XG5cdFx0XHRvdXJRdWVyeS5jaGFubmVsID0ge1xuXHRcdFx0XHQkaW46IFtvdXJRdWVyeS5jaGFubmVsLCAnYWxsX3B1YmxpY19jaGFubmVscyddXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdG91clF1ZXJ5ID0gT2JqZWN0LmFzc2lnbih7fSwgcXVlcnksIG91clF1ZXJ5KTtcblxuXHRcdGNvbnN0IGludGVncmF0aW9ucyA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kKG91clF1ZXJ5LCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgX2NyZWF0ZWRBdDogMSB9LFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50LFxuXHRcdFx0ZmllbGRzXG5cdFx0fSkuZmV0Y2goKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGludGVncmF0aW9ucyxcblx0XHRcdGNvdW50OiBpbnRlZ3JhdGlvbnMubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kKG91clF1ZXJ5KS5jb3VudCgpXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuaGlzdG9yeScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0bGV0IGxhdGVzdERhdGUgPSBuZXcgRGF0ZSgpO1xuXHRcdGlmICh0aGlzLnF1ZXJ5UGFyYW1zLmxhdGVzdCkge1xuXHRcdFx0bGF0ZXN0RGF0ZSA9IG5ldyBEYXRlKHRoaXMucXVlcnlQYXJhbXMubGF0ZXN0KTtcblx0XHR9XG5cblx0XHRsZXQgb2xkZXN0RGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5xdWVyeVBhcmFtcy5vbGRlc3QpIHtcblx0XHRcdG9sZGVzdERhdGUgPSBuZXcgRGF0ZSh0aGlzLnF1ZXJ5UGFyYW1zLm9sZGVzdCk7XG5cdFx0fVxuXG5cdFx0bGV0IGluY2x1c2l2ZSA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLnF1ZXJ5UGFyYW1zLmluY2x1c2l2ZSkge1xuXHRcdFx0aW5jbHVzaXZlID0gdGhpcy5xdWVyeVBhcmFtcy5pbmNsdXNpdmU7XG5cdFx0fVxuXG5cdFx0bGV0IGNvdW50ID0gMjA7XG5cdFx0aWYgKHRoaXMucXVlcnlQYXJhbXMuY291bnQpIHtcblx0XHRcdGNvdW50ID0gcGFyc2VJbnQodGhpcy5xdWVyeVBhcmFtcy5jb3VudCk7XG5cdFx0fVxuXG5cdFx0bGV0IHVucmVhZHMgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5xdWVyeVBhcmFtcy51bnJlYWRzKSB7XG5cdFx0XHR1bnJlYWRzID0gdGhpcy5xdWVyeVBhcmFtcy51bnJlYWRzO1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0cmVzdWx0ID0gTWV0ZW9yLmNhbGwoJ2dldENoYW5uZWxIaXN0b3J5JywgeyByaWQ6IGZpbmRSZXN1bHQuX2lkLCBsYXRlc3Q6IGxhdGVzdERhdGUsIG9sZGVzdDogb2xkZXN0RGF0ZSwgaW5jbHVzaXZlLCBjb3VudCwgdW5yZWFkcyB9KTtcblx0XHR9KTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MocmVzdWx0KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5pbmZvJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIGNoZWNrZWRBcmNoaXZlZDogZmFsc2UgfSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRjaGFubmVsOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0Ll9pZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5pbnZpdGUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCkgfSk7XG5cblx0XHRjb25zdCB1c2VyID0gdGhpcy5nZXRVc2VyRnJvbVBhcmFtcygpO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2FkZFVzZXJUb1Jvb20nLCB7IHJpZDogZmluZFJlc3VsdC5faWQsIHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lIH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0Y2hhbm5lbDogUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoZmluZFJlc3VsdC5faWQsIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuam9pbicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdqb2luUm9vbScsIGZpbmRSZXN1bHQuX2lkLCB0aGlzLmJvZHlQYXJhbXMuam9pbkNvZGUpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0Y2hhbm5lbDogUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoZmluZFJlc3VsdC5faWQsIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMua2ljaycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgncmVtb3ZlVXNlckZyb21Sb29tJywgeyByaWQ6IGZpbmRSZXN1bHQuX2lkLCB1c2VybmFtZTogdXNlci51c2VybmFtZSB9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGNoYW5uZWw6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGZpbmRSZXN1bHQuX2lkLCB7IGZpZWxkczogUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSB9KVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLmxlYXZlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpIH0pO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2xlYXZlUm9vbScsIGZpbmRSZXN1bHQuX2lkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGNoYW5uZWw6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGZpbmRSZXN1bHQuX2lkLCB7IGZpZWxkczogUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSB9KVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLmxpc3QnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldDoge1xuXHRcdC8vVGhpcyBpcyBkZWZpbmVkIGFzIHN1Y2ggb25seSB0byBwcm92aWRlIGFuIGV4YW1wbGUgb2YgaG93IHRoZSByb3V0ZXMgY2FuIGJlIGRlZmluZWQgOlhcblx0XHRhY3Rpb24oKSB7XG5cdFx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdFx0Y29uc3Qgb3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgeyB0OiAnYycgfSk7XG5cblx0XHRcdC8vU3BlY2lhbCBjaGVjayBmb3IgdGhlIHBlcm1pc3Npb25zXG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1qb2luZWQtcm9vbScpKSB7XG5cdFx0XHRcdG91clF1ZXJ5LnVzZXJuYW1lcyA9IHtcblx0XHRcdFx0XHQkaW46IFsgdGhpcy51c2VyLnVzZXJuYW1lIF1cblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctYy1yb29tJykpIHtcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByb29tcyA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdFx0c29ydDogc29ydCA/IHNvcnQgOiB7IG5hbWU6IDEgfSxcblx0XHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRcdGZpZWxkc1xuXHRcdFx0fSkuZmV0Y2goKTtcblxuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0XHRjaGFubmVsczogcm9vbXMsXG5cdFx0XHRcdGNvdW50OiByb29tcy5sZW5ndGgsXG5cdFx0XHRcdG9mZnNldCxcblx0XHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmQob3VyUXVlcnkpLmNvdW50KClcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5saXN0LmpvaW5lZCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcyB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXHRcdGxldCByb29tcyA9IF8ucGx1Y2soUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kQnlUeXBlQW5kVXNlcklkKCdjJywgdGhpcy51c2VySWQpLmZldGNoKCksICdfcm9vbScpO1xuXHRcdGNvbnN0IHRvdGFsQ291bnQgPSByb29tcy5sZW5ndGg7XG5cblx0XHRyb29tcyA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLnByb2Nlc3NRdWVyeU9wdGlvbnNPblJlc3VsdChyb29tcywge1xuXHRcdFx0c29ydDogc29ydCA/IHNvcnQgOiB7IG5hbWU6IDEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0Y2hhbm5lbHM6IHJvb21zLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0Y291bnQ6IHJvb21zLmxlbmd0aCxcblx0XHRcdHRvdGFsOiB0b3RhbENvdW50XG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMubWVtYmVycycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlLCByZXR1cm5Vc2VybmFtZXM6IHRydWUgfSk7XG5cblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cblx0XHRsZXQgc29ydEZuID0gKGEsIGIpID0+IGEgPiBiO1xuXHRcdGlmIChNYXRjaC50ZXN0KHNvcnQsIE9iamVjdCkgJiYgTWF0Y2gudGVzdChzb3J0LnVzZXJuYW1lLCBOdW1iZXIpICYmIHNvcnQudXNlcm5hbWUgPT09IC0xKSB7XG5cdFx0XHRzb3J0Rm4gPSAoYSwgYikgPT4gYiA8IGE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVtYmVycyA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLnByb2Nlc3NRdWVyeU9wdGlvbnNPblJlc3VsdChBcnJheS5mcm9tKGZpbmRSZXN1bHQudXNlcm5hbWVzKS5zb3J0KHNvcnRGbiksIHtcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXNlcnMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kKHsgdXNlcm5hbWU6IHsgJGluOiBtZW1iZXJzIH0gfSwge1xuXHRcdFx0ZmllbGRzOiB7IF9pZDogMSwgdXNlcm5hbWU6IDEsIG5hbWU6IDEsIHN0YXR1czogMSwgdXRjT2Zmc2V0OiAxIH0sXG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgdXNlcm5hbWU6IDEgfVxuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRtZW1iZXJzOiB1c2Vycyxcblx0XHRcdGNvdW50OiBtZW1iZXJzLmxlbmd0aCxcblx0XHRcdG9mZnNldCxcblx0XHRcdHRvdGFsOiBmaW5kUmVzdWx0LnVzZXJuYW1lcy5sZW5ndGhcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5tZXNzYWdlcycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdGNvbnN0IG91clF1ZXJ5ID0gT2JqZWN0LmFzc2lnbih7fSwgcXVlcnksIHsgcmlkOiBmaW5kUmVzdWx0Ll9pZCB9KTtcblxuXHRcdC8vU3BlY2lhbCBjaGVjayBmb3IgdGhlIHBlcm1pc3Npb25zXG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctam9pbmVkLXJvb20nKSAmJiAhZmluZFJlc3VsdC51c2VybmFtZXMuaW5jbHVkZXModGhpcy51c2VyLnVzZXJuYW1lKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH0gZWxzZSBpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctYy1yb29tJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlcyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyB0czogLTEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRtZXNzYWdlcyxcblx0XHRcdGNvdW50OiBtZXNzYWdlcy5sZW5ndGgsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHR0b3RhbDogUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZChvdXJRdWVyeSkuY291bnQoKVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLm9ubGluZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHsgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblx0XHRjb25zdCBvdXJRdWVyeSA9IE9iamVjdC5hc3NpZ24oe30sIHF1ZXJ5LCB7IHQ6ICdjJyB9KTtcblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lKG91clF1ZXJ5KTtcblxuXHRcdGlmIChyb29tID09IG51bGwpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdDaGFubmVsIGRvZXMgbm90IGV4aXN0cycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9ubGluZSA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRVc2Vyc05vdE9mZmxpbmUoe1xuXHRcdFx0ZmllbGRzOiB7XG5cdFx0XHRcdHVzZXJuYW1lOiAxXG5cdFx0XHR9XG5cdFx0fSkuZmV0Y2goKTtcblxuXHRcdGNvbnN0IG9ubGluZUluUm9vbSA9IFtdO1xuXHRcdG9ubGluZS5mb3JFYWNoKHVzZXIgPT4ge1xuXHRcdFx0aWYgKHJvb20udXNlcm5hbWVzLmluZGV4T2YodXNlci51c2VybmFtZSkgIT09IC0xKSB7XG5cdFx0XHRcdG9ubGluZUluUm9vbS5wdXNoKHtcblx0XHRcdFx0XHRfaWQ6IHVzZXIuX2lkLFxuXHRcdFx0XHRcdHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0b25saW5lOiBvbmxpbmVJblJvb21cblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5vcGVuJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0Y29uc3Qgc3ViID0gUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kT25lQnlSb29tSWRBbmRVc2VySWQoZmluZFJlc3VsdC5faWQsIHRoaXMudXNlcklkKTtcblxuXHRcdGlmICghc3ViKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgVGhlIHVzZXIvY2FsbGVlIGlzIG5vdCBpbiB0aGUgY2hhbm5lbCBcIiR7IGZpbmRSZXN1bHQubmFtZSB9XCIuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN1Yi5vcGVuKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgVGhlIGNoYW5uZWwsICR7IGZpbmRSZXN1bHQubmFtZSB9LCBpcyBhbHJlYWR5IG9wZW4gdG8gdGhlIHNlbmRlcmApO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdvcGVuUm9vbScsIGZpbmRSZXN1bHQuX2lkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMucmVtb3ZlTW9kZXJhdG9yJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kQ2hhbm5lbEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpIH0pO1xuXG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdyZW1vdmVSb29tTW9kZXJhdG9yJywgZmluZFJlc3VsdC5faWQsIHVzZXIuX2lkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMucmVtb3ZlT3duZXInLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCkgfSk7XG5cblx0XHRjb25zdCB1c2VyID0gdGhpcy5nZXRVc2VyRnJvbVBhcmFtcygpO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3JlbW92ZVJvb21Pd25lcicsIGZpbmRSZXN1bHQuX2lkLCB1c2VyLl9pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLnJlbmFtZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy5uYW1lIHx8ICF0aGlzLmJvZHlQYXJhbXMubmFtZS50cmltKCkpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgYm9keVBhcmFtIFwibmFtZVwiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogeyByb29tSWQ6IHRoaXMuYm9keVBhcmFtcy5yb29tSWR9IH0pO1xuXG5cdFx0aWYgKGZpbmRSZXN1bHQubmFtZSA9PT0gdGhpcy5ib2R5UGFyYW1zLm5hbWUpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgY2hhbm5lbCBuYW1lIGlzIHRoZSBzYW1lIGFzIHdoYXQgaXQgd291bGQgYmUgcmVuYW1lZCB0by4nKTtcblx0XHR9XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnc2F2ZVJvb21TZXR0aW5ncycsIGZpbmRSZXN1bHQuX2lkLCAncm9vbU5hbWUnLCB0aGlzLmJvZHlQYXJhbXMubmFtZSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRjaGFubmVsOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0Ll9pZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5zZXREZXNjcmlwdGlvbicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy5kZXNjcmlwdGlvbiB8fCAhdGhpcy5ib2R5UGFyYW1zLmRlc2NyaXB0aW9uLnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBib2R5UGFyYW0gXCJkZXNjcmlwdGlvblwiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCkgfSk7XG5cblx0XHRpZiAoZmluZFJlc3VsdC5kZXNjcmlwdGlvbiA9PT0gdGhpcy5ib2R5UGFyYW1zLmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGNoYW5uZWwgZGVzY3JpcHRpb24gaXMgdGhlIHNhbWUgYXMgd2hhdCBpdCB3b3VsZCBiZSBjaGFuZ2VkIHRvLicpO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5faWQsICdyb29tRGVzY3JpcHRpb24nLCB0aGlzLmJvZHlQYXJhbXMuZGVzY3JpcHRpb24pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0ZGVzY3JpcHRpb246IHRoaXMuYm9keVBhcmFtcy5kZXNjcmlwdGlvblxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLnNldEpvaW5Db2RlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLmpvaW5Db2RlIHx8ICF0aGlzLmJvZHlQYXJhbXMuam9pbkNvZGUudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGJvZHlQYXJhbSBcImpvaW5Db2RlXCIgaXMgcmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5faWQsICdqb2luQ29kZScsIHRoaXMuYm9keVBhcmFtcy5qb2luQ29kZSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRjaGFubmVsOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0Ll9pZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGFubmVscy5zZXRQdXJwb3NlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLnB1cnBvc2UgfHwgIXRoaXMuYm9keVBhcmFtcy5wdXJwb3NlLnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBib2R5UGFyYW0gXCJwdXJwb3NlXCIgaXMgcmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdGlmIChmaW5kUmVzdWx0LmRlc2NyaXB0aW9uID09PSB0aGlzLmJvZHlQYXJhbXMucHVycG9zZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBjaGFubmVsIHB1cnBvc2UgKGRlc2NyaXB0aW9uKSBpcyB0aGUgc2FtZSBhcyB3aGF0IGl0IHdvdWxkIGJlIGNoYW5nZWQgdG8uJyk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3NhdmVSb29tU2V0dGluZ3MnLCBmaW5kUmVzdWx0Ll9pZCwgJ3Jvb21EZXNjcmlwdGlvbicsIHRoaXMuYm9keVBhcmFtcy5wdXJwb3NlKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdHB1cnBvc2U6IHRoaXMuYm9keVBhcmFtcy5wdXJwb3NlXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuc2V0UmVhZE9ubHknLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmJvZHlQYXJhbXMucmVhZE9ubHkgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGJvZHlQYXJhbSBcInJlYWRPbmx5XCIgaXMgcmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdGlmIChmaW5kUmVzdWx0LnJvID09PSB0aGlzLmJvZHlQYXJhbXMucmVhZE9ubHkpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgY2hhbm5lbCByZWFkIG9ubHkgc2V0dGluZyBpcyB0aGUgc2FtZSBhcyB3aGF0IGl0IHdvdWxkIGJlIGNoYW5nZWQgdG8uJyk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3NhdmVSb29tU2V0dGluZ3MnLCBmaW5kUmVzdWx0Ll9pZCwgJ3JlYWRPbmx5JywgdGhpcy5ib2R5UGFyYW1zLnJlYWRPbmx5KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGNoYW5uZWw6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGZpbmRSZXN1bHQuX2lkLCB7IGZpZWxkczogUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSB9KVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLnNldFRvcGljJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLnRvcGljIHx8ICF0aGlzLmJvZHlQYXJhbXMudG9waWMudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGJvZHlQYXJhbSBcInRvcGljXCIgaXMgcmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSB9KTtcblxuXHRcdGlmIChmaW5kUmVzdWx0LnRvcGljID09PSB0aGlzLmJvZHlQYXJhbXMudG9waWMpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgY2hhbm5lbCB0b3BpYyBpcyB0aGUgc2FtZSBhcyB3aGF0IGl0IHdvdWxkIGJlIGNoYW5nZWQgdG8uJyk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3NhdmVSb29tU2V0dGluZ3MnLCBmaW5kUmVzdWx0Ll9pZCwgJ3Jvb21Ub3BpYycsIHRoaXMuYm9keVBhcmFtcy50b3BpYyk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHR0b3BpYzogdGhpcy5ib2R5UGFyYW1zLnRvcGljXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhbm5lbHMuc2V0VHlwZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy50eXBlIHx8ICF0aGlzLmJvZHlQYXJhbXMudHlwZS50cmltKCkpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgYm9keVBhcmFtIFwidHlwZVwiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRDaGFubmVsQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCkgfSk7XG5cblx0XHRpZiAoZmluZFJlc3VsdC50ID09PSB0aGlzLmJvZHlQYXJhbXMudHlwZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBjaGFubmVsIHR5cGUgaXMgdGhlIHNhbWUgYXMgd2hhdCBpdCB3b3VsZCBiZSBjaGFuZ2VkIHRvLicpO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5faWQsICdyb29tVHlwZScsIHRoaXMuYm9keVBhcmFtcy50eXBlKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGNoYW5uZWw6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGZpbmRSZXN1bHQuX2lkLCB7IGZpZWxkczogUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSB9KVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYW5uZWxzLnVuYXJjaGl2ZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZENoYW5uZWxCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgY2hlY2tlZEFyY2hpdmVkOiBmYWxzZSB9KTtcblxuXHRcdGlmICghZmluZFJlc3VsdC5hcmNoaXZlZCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoYFRoZSBjaGFubmVsLCAkeyBmaW5kUmVzdWx0Lm5hbWUgfSwgaXMgbm90IGFyY2hpdmVkYCk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3VuYXJjaGl2ZVJvb20nLCBmaW5kUmVzdWx0Ll9pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcbiIsIlJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdyb29tcy5nZXQnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB7IHVwZGF0ZWRTaW5jZSB9ID0gdGhpcy5xdWVyeVBhcmFtcztcblxuXHRcdGxldCB1cGRhdGVkU2luY2VEYXRlO1xuXHRcdGlmICh1cGRhdGVkU2luY2UpIHtcblx0XHRcdGlmIChpc05hTihEYXRlLnBhcnNlKHVwZGF0ZWRTaW5jZSkpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXVwZGF0ZWRTaW5jZS1wYXJhbS1pbnZhbGlkJywgJ1RoZSBcInVwZGF0ZWRTaW5jZVwiIHF1ZXJ5IHBhcmFtZXRlciBtdXN0IGJlIGEgdmFsaWQgZGF0ZS4nKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVwZGF0ZWRTaW5jZURhdGUgPSBuZXcgRGF0ZSh1cGRhdGVkU2luY2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4gcmVzdWx0ID0gTWV0ZW9yLmNhbGwoJ3Jvb21zL2dldCcsIHVwZGF0ZWRTaW5jZURhdGUpKTtcblxuXHRcdGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcblx0XHRcdHJlc3VsdCA9IHtcblx0XHRcdFx0dXBkYXRlOiByZXN1bHQsXG5cdFx0XHRcdHJlbW92ZTogW11cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MocmVzdWx0KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdyb29tcy51cGxvYWQvOnJpZCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCByb29tID0gTWV0ZW9yLmNhbGwoJ2NhbkFjY2Vzc1Jvb20nLCB0aGlzLnVybFBhcmFtcy5yaWQsIHRoaXMudXNlcklkKTtcblxuXHRcdGlmICghcm9vbSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IEJ1c2JveSA9IE5wbS5yZXF1aXJlKCdidXNib3knKTtcblx0XHRjb25zdCBidXNib3kgPSBuZXcgQnVzYm95KHsgaGVhZGVyczogdGhpcy5yZXF1ZXN0LmhlYWRlcnMgfSk7XG5cdFx0Y29uc3QgZmlsZXMgPSBbXTtcblx0XHRjb25zdCBmaWVsZHMgPSB7fTtcblxuXHRcdE1ldGVvci53cmFwQXN5bmMoKGNhbGxiYWNrKSA9PiB7XG5cdFx0XHRidXNib3kub24oJ2ZpbGUnLCAoZmllbGRuYW1lLCBmaWxlLCBmaWxlbmFtZSwgZW5jb2RpbmcsIG1pbWV0eXBlKSA9PiB7XG5cdFx0XHRcdGlmIChmaWVsZG5hbWUgIT09ICdmaWxlJykge1xuXHRcdFx0XHRcdHJldHVybiBmaWxlcy5wdXNoKG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtZmllbGQnKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBmaWxlRGF0ZSA9IFtdO1xuXHRcdFx0XHRmaWxlLm9uKCdkYXRhJywgZGF0YSA9PiBmaWxlRGF0ZS5wdXNoKGRhdGEpKTtcblxuXHRcdFx0XHRmaWxlLm9uKCdlbmQnLCAoKSA9PiB7XG5cdFx0XHRcdFx0ZmlsZXMucHVzaCh7IGZpZWxkbmFtZSwgZmlsZSwgZmlsZW5hbWUsIGVuY29kaW5nLCBtaW1ldHlwZSwgZmlsZUJ1ZmZlcjogQnVmZmVyLmNvbmNhdChmaWxlRGF0ZSkgfSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdGJ1c2JveS5vbignZmllbGQnLCAoZmllbGRuYW1lLCB2YWx1ZSkgPT4gZmllbGRzW2ZpZWxkbmFtZV0gPSB2YWx1ZSk7XG5cblx0XHRcdGJ1c2JveS5vbignZmluaXNoJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiBjYWxsYmFjaygpKSk7XG5cblx0XHRcdHRoaXMucmVxdWVzdC5waXBlKGJ1c2JveSk7XG5cdFx0fSkoKTtcblxuXHRcdGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdGaWxlIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGVzLmxlbmd0aCA+IDEpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdKdXN0IDEgZmlsZSBpcyBhbGxvd2VkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZSA9IGZpbGVzWzBdO1xuXG5cdFx0Y29uc3QgZmlsZVN0b3JlID0gRmlsZVVwbG9hZC5nZXRTdG9yZSgnVXBsb2FkcycpO1xuXG5cdFx0Y29uc3QgZGV0YWlscyA9IHtcblx0XHRcdG5hbWU6IGZpbGUuZmlsZW5hbWUsXG5cdFx0XHRzaXplOiBmaWxlLmZpbGVCdWZmZXIubGVuZ3RoLFxuXHRcdFx0dHlwZTogZmlsZS5taW1ldHlwZSxcblx0XHRcdHJpZDogdGhpcy51cmxQYXJhbXMucmlkXG5cdFx0fTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdGNvbnN0IHVwbG9hZGVkRmlsZSA9IE1ldGVvci53cmFwQXN5bmMoZmlsZVN0b3JlLmluc2VydC5iaW5kKGZpbGVTdG9yZSkpKGRldGFpbHMsIGZpbGUuZmlsZUJ1ZmZlcik7XG5cblx0XHRcdHVwbG9hZGVkRmlsZS5kZXNjcmlwdGlvbiA9IGZpZWxkcy5kZXNjcmlwdGlvbjtcblxuXHRcdFx0ZGVsZXRlIGZpZWxkcy5kZXNjcmlwdGlvbjtcblxuXHRcdFx0Um9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcyhNZXRlb3IuY2FsbCgnc2VuZEZpbGVNZXNzYWdlJywgdGhpcy51cmxQYXJhbXMucmlkLCBudWxsLCB1cGxvYWRlZEZpbGUsIGZpZWxkcykpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG4iLCJSb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnc3Vic2NyaXB0aW9ucy5nZXQnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB7IHVwZGF0ZWRTaW5jZSB9ID0gdGhpcy5xdWVyeVBhcmFtcztcblxuXHRcdGxldCB1cGRhdGVkU2luY2VEYXRlO1xuXHRcdGlmICh1cGRhdGVkU2luY2UpIHtcblx0XHRcdGlmIChpc05hTihEYXRlLnBhcnNlKHVwZGF0ZWRTaW5jZSkpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXJvb21JZC1wYXJhbS1pbnZhbGlkJywgJ1RoZSBcImxhc3RVcGRhdGVcIiBxdWVyeSBwYXJhbWV0ZXIgbXVzdCBiZSBhIHZhbGlkIGRhdGUuJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR1cGRhdGVkU2luY2VEYXRlID0gbmV3IERhdGUodXBkYXRlZFNpbmNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0O1xuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHJlc3VsdCA9IE1ldGVvci5jYWxsKCdzdWJzY3JpcHRpb25zL2dldCcsIHVwZGF0ZWRTaW5jZURhdGUpKTtcblxuXHRcdGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcblx0XHRcdHJlc3VsdCA9IHtcblx0XHRcdFx0dXBkYXRlOiByZXN1bHQsXG5cdFx0XHRcdHJlbW92ZTogW11cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MocmVzdWx0KTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWwgcHJvY2Vzc1dlYmhvb2tNZXNzYWdlICovXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhdC5kZWxldGUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y2hlY2sodGhpcy5ib2R5UGFyYW1zLCBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0bXNnSWQ6IFN0cmluZyxcblx0XHRcdHJvb21JZDogU3RyaW5nLFxuXHRcdFx0YXNVc2VyOiBNYXRjaC5NYXliZShCb29sZWFuKVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1zZyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRPbmVCeUlkKHRoaXMuYm9keVBhcmFtcy5tc2dJZCwgeyBmaWVsZHM6IHsgdTogMSwgcmlkOiAxIH19KTtcblxuXHRcdGlmICghbXNnKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgTm8gbWVzc2FnZSBmb3VuZCB3aXRoIHRoZSBpZCBvZiBcIiR7IHRoaXMuYm9keVBhcmFtcy5tc2dJZCB9XCIuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYm9keVBhcmFtcy5yb29tSWQgIT09IG1zZy5yaWQpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgcm9vbSBpZCBwcm92aWRlZCBkb2VzIG5vdCBtYXRjaCB3aGVyZSB0aGUgbWVzc2FnZSBpcyBmcm9tLicpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmJvZHlQYXJhbXMuYXNVc2VyICYmIG1zZy51Ll9pZCAhPT0gdGhpcy51c2VySWQgJiYgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdmb3JjZS1kZWxldGUtbWVzc2FnZScsIG1zZy5yaWQpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVW5hdXRob3JpemVkLiBZb3UgbXVzdCBoYXZlIHRoZSBwZXJtaXNzaW9uIFwiZm9yY2UtZGVsZXRlLW1lc3NhZ2VcIiB0byBkZWxldGUgb3RoZXJcXCdzIG1lc3NhZ2UgYXMgdGhlbS4nKTtcblx0XHR9XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMuYm9keVBhcmFtcy5hc1VzZXIgPyBtc2cudS5faWQgOiB0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2RlbGV0ZU1lc3NhZ2UnLCB7IF9pZDogbXNnLl9pZCB9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdF9pZDogbXNnLl9pZCxcblx0XHRcdHRzOiBEYXRlLm5vdygpLFxuXHRcdFx0bWVzc2FnZTogbXNnXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhdC5zeW5jTWVzc2FnZXMnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB7IHJvb21JZCwgbGFzdFVwZGF0ZSB9ID0gdGhpcy5xdWVyeVBhcmFtcztcblxuXHRcdGlmICghcm9vbUlkKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb29tSWQtcGFyYW0tbm90LXByb3ZpZGVkJywgJ1RoZSByZXF1aXJlZCBcInJvb21JZFwiIHF1ZXJ5IHBhcmFtIGlzIG1pc3NpbmcuJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFsYXN0VXBkYXRlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1sYXN0VXBkYXRlLXBhcmFtLW5vdC1wcm92aWRlZCcsICdUaGUgcmVxdWlyZWQgXCJsYXN0VXBkYXRlXCIgcXVlcnkgcGFyYW0gaXMgbWlzc2luZy4nKTtcblx0XHR9IGVsc2UgaWYgKGlzTmFOKERhdGUucGFyc2UobGFzdFVwZGF0ZSkpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb29tSWQtcGFyYW0taW52YWxpZCcsICdUaGUgXCJsYXN0VXBkYXRlXCIgcXVlcnkgcGFyYW1ldGVyIG11c3QgYmUgYSB2YWxpZCBkYXRlLicpO1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0cmVzdWx0ID0gTWV0ZW9yLmNhbGwoJ21lc3NhZ2VzL2dldCcsIHJvb21JZCwgeyBsYXN0VXBkYXRlOiBuZXcgRGF0ZShsYXN0VXBkYXRlKSB9KTtcblx0XHR9KTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdHJlc3VsdFxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYXQuZ2V0TWVzc2FnZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGlmICghdGhpcy5xdWVyeVBhcmFtcy5tc2dJZCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBcIm1zZ0lkXCIgcXVlcnkgcGFyYW1ldGVyIG11c3QgYmUgcHJvdmlkZWQuJyk7XG5cdFx0fVxuXG5cdFx0bGV0IG1zZztcblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRtc2cgPSBNZXRlb3IuY2FsbCgnZ2V0U2luZ2xlTWVzc2FnZScsIHRoaXMucXVlcnlQYXJhbXMubXNnSWQpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCFtc2cpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0bWVzc2FnZTogbXNnXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhdC5waW5NZXNzYWdlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2VJZCB8fCAhdGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2VJZC50cmltKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW1lc3NhZ2VpZC1wYXJhbS1ub3QtcHJvdmlkZWQnLCAnVGhlIHJlcXVpcmVkIFwibWVzc2FnZUlkXCIgcGFyYW0gaXMgbWlzc2luZy4nKTtcblx0XHR9XG5cblx0XHRjb25zdCBtc2cgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlJZCh0aGlzLmJvZHlQYXJhbXMubWVzc2FnZUlkKTtcblxuXHRcdGlmICghbXNnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1tZXNzYWdlLW5vdC1mb3VuZCcsICdUaGUgcHJvdmlkZWQgXCJtZXNzYWdlSWRcIiBkb2VzIG5vdCBtYXRjaCBhbnkgZXhpc3RpbmcgbWVzc2FnZS4nKTtcblx0XHR9XG5cblx0XHRsZXQgcGlubmVkTWVzc2FnZTtcblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiBwaW5uZWRNZXNzYWdlID0gTWV0ZW9yLmNhbGwoJ3Bpbk1lc3NhZ2UnLCBtc2cpKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdG1lc3NhZ2U6IHBpbm5lZE1lc3NhZ2Vcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGF0LnBvc3RNZXNzYWdlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IG1lc3NhZ2VSZXR1cm4gPSBwcm9jZXNzV2ViaG9va01lc3NhZ2UodGhpcy5ib2R5UGFyYW1zLCB0aGlzLnVzZXIsIHVuZGVmaW5lZCwgdHJ1ZSlbMF07XG5cblx0XHRpZiAoIW1lc3NhZ2VSZXR1cm4pIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCd1bmtub3duLWVycm9yJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0dHM6IERhdGUubm93KCksXG5cdFx0XHRjaGFubmVsOiBtZXNzYWdlUmV0dXJuLmNoYW5uZWwsXG5cdFx0XHRtZXNzYWdlOiBtZXNzYWdlUmV0dXJuLm1lc3NhZ2Vcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGF0LnNlYXJjaCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHsgcm9vbUlkLCBzZWFyY2hUZXh0LCBsaW1pdCB9ID0gdGhpcy5xdWVyeVBhcmFtcztcblxuXHRcdGlmICghcm9vbUlkKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb29tSWQtcGFyYW0tbm90LXByb3ZpZGVkJywgJ1RoZSByZXF1aXJlZCBcInJvb21JZFwiIHF1ZXJ5IHBhcmFtIGlzIG1pc3NpbmcuJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFzZWFyY2hUZXh0KSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1zZWFyY2hUZXh0LXBhcmFtLW5vdC1wcm92aWRlZCcsICdUaGUgcmVxdWlyZWQgXCJzZWFyY2hUZXh0XCIgcXVlcnkgcGFyYW0gaXMgbWlzc2luZy4nKTtcblx0XHR9XG5cblx0XHRpZiAobGltaXQgJiYgKHR5cGVvZiBsaW1pdCAhPT0gJ251bWJlcicgfHwgaXNOYU4obGltaXQpIHx8IGxpbWl0IDw9IDApKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1saW1pdC1wYXJhbS1pbnZhbGlkJywgJ1RoZSBcImxpbWl0XCIgcXVlcnkgcGFyYW1ldGVyIG11c3QgYmUgYSB2YWxpZCBudW1iZXIgYW5kIGJlIGdyZWF0ZXIgdGhhbiAwLicpO1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4gcmVzdWx0ID0gTWV0ZW9yLmNhbGwoJ21lc3NhZ2VTZWFyY2gnLCBzZWFyY2hUZXh0LCByb29tSWQsIGxpbWl0KSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRtZXNzYWdlczogcmVzdWx0Lm1lc3NhZ2VzXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG4vLyBUaGUgZGlmZmVyZW5jZSBiZXR3ZWVuIGBjaGF0LnBvc3RNZXNzYWdlYCBhbmQgYGNoYXQuc2VuZE1lc3NhZ2VgIGlzIHRoYXQgYGNoYXQuc2VuZE1lc3NhZ2VgIGFsbG93c1xuLy8gZm9yIHBhc3NpbmcgYSB2YWx1ZSBmb3IgYF9pZGAgYW5kIHRoZSBvdGhlciBvbmUgZG9lc24ndC4gQWxzbywgYGNoYXQuc2VuZE1lc3NhZ2VgIG9ubHkgc2VuZHMgaXQgdG9cbi8vIG9uZSBjaGFubmVsIHdoZXJlYXMgdGhlIG90aGVyIG9uZSBhbGxvd3MgZm9yIHNlbmRpbmcgdG8gbW9yZSB0aGFuIG9uZSBjaGFubmVsIGF0IGEgdGltZS5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGF0LnNlbmRNZXNzYWdlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2UpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcGFyYW1zJywgJ1RoZSBcIm1lc3NhZ2VcIiBwYXJhbWV0ZXIgbXVzdCBiZSBwcm92aWRlZC4nKTtcblx0XHR9XG5cblx0XHRsZXQgbWVzc2FnZTtcblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiBtZXNzYWdlID0gTWV0ZW9yLmNhbGwoJ3NlbmRNZXNzYWdlJywgdGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2UpKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdG1lc3NhZ2Vcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGF0LnN0YXJNZXNzYWdlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2VJZCB8fCAhdGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2VJZC50cmltKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW1lc3NhZ2VpZC1wYXJhbS1ub3QtcHJvdmlkZWQnLCAnVGhlIHJlcXVpcmVkIFwibWVzc2FnZUlkXCIgcGFyYW0gaXMgcmVxdWlyZWQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbXNnID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQodGhpcy5ib2R5UGFyYW1zLm1lc3NhZ2VJZCk7XG5cblx0XHRpZiAoIW1zZykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItbWVzc2FnZS1ub3QtZm91bmQnLCAnVGhlIHByb3ZpZGVkIFwibWVzc2FnZUlkXCIgZG9lcyBub3QgbWF0Y2ggYW55IGV4aXN0aW5nIG1lc3NhZ2UuJyk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4gTWV0ZW9yLmNhbGwoJ3N0YXJNZXNzYWdlJywge1xuXHRcdFx0X2lkOiBtc2cuX2lkLFxuXHRcdFx0cmlkOiBtc2cucmlkLFxuXHRcdFx0c3RhcnJlZDogdHJ1ZVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY2hhdC51blBpbk1lc3NhZ2UnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0aWYgKCF0aGlzLmJvZHlQYXJhbXMubWVzc2FnZUlkIHx8ICF0aGlzLmJvZHlQYXJhbXMubWVzc2FnZUlkLnRyaW0oKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItbWVzc2FnZWlkLXBhcmFtLW5vdC1wcm92aWRlZCcsICdUaGUgcmVxdWlyZWQgXCJtZXNzYWdlSWRcIiBwYXJhbSBpcyByZXF1aXJlZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCBtc2cgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlJZCh0aGlzLmJvZHlQYXJhbXMubWVzc2FnZUlkKTtcblxuXHRcdGlmICghbXNnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1tZXNzYWdlLW5vdC1mb3VuZCcsICdUaGUgcHJvdmlkZWQgXCJtZXNzYWdlSWRcIiBkb2VzIG5vdCBtYXRjaCBhbnkgZXhpc3RpbmcgbWVzc2FnZS4nKTtcblx0XHR9XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiBNZXRlb3IuY2FsbCgndW5waW5NZXNzYWdlJywgbXNnKSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NoYXQudW5TdGFyTWVzc2FnZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy5tZXNzYWdlSWQgfHwgIXRoaXMuYm9keVBhcmFtcy5tZXNzYWdlSWQudHJpbSgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1tZXNzYWdlaWQtcGFyYW0tbm90LXByb3ZpZGVkJywgJ1RoZSByZXF1aXJlZCBcIm1lc3NhZ2VJZFwiIHBhcmFtIGlzIHJlcXVpcmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1zZyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRPbmVCeUlkKHRoaXMuYm9keVBhcmFtcy5tZXNzYWdlSWQpO1xuXG5cdFx0aWYgKCFtc2cpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW1lc3NhZ2Utbm90LWZvdW5kJywgJ1RoZSBwcm92aWRlZCBcIm1lc3NhZ2VJZFwiIGRvZXMgbm90IG1hdGNoIGFueSBleGlzdGluZyBtZXNzYWdlLicpO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IE1ldGVvci5jYWxsKCdzdGFyTWVzc2FnZScsIHtcblx0XHRcdF9pZDogbXNnLl9pZCxcblx0XHRcdHJpZDogbXNnLnJpZCxcblx0XHRcdHN0YXJyZWQ6IGZhbHNlXG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdjaGF0LnVwZGF0ZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjaGVjayh0aGlzLmJvZHlQYXJhbXMsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7XG5cdFx0XHRyb29tSWQ6IFN0cmluZyxcblx0XHRcdG1zZ0lkOiBTdHJpbmcsXG5cdFx0XHR0ZXh0OiBTdHJpbmcgLy9Vc2luZyB0ZXh0IHRvIGJlIGNvbnNpc3RhbnQgd2l0aCBjaGF0LnBvc3RNZXNzYWdlXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbXNnID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQodGhpcy5ib2R5UGFyYW1zLm1zZ0lkKTtcblxuXHRcdC8vRW5zdXJlIHRoZSBtZXNzYWdlIGV4aXN0c1xuXHRcdGlmICghbXNnKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgTm8gbWVzc2FnZSBmb3VuZCB3aXRoIHRoZSBpZCBvZiBcIiR7IHRoaXMuYm9keVBhcmFtcy5tc2dJZCB9XCIuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYm9keVBhcmFtcy5yb29tSWQgIT09IG1zZy5yaWQpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgcm9vbSBpZCBwcm92aWRlZCBkb2VzIG5vdCBtYXRjaCB3aGVyZSB0aGUgbWVzc2FnZSBpcyBmcm9tLicpO1xuXHRcdH1cblxuXHRcdC8vUGVybWlzc2lvbiBjaGVja3MgYXJlIGFscmVhZHkgZG9uZSBpbiB0aGUgdXBkYXRlTWVzc2FnZSBtZXRob2QsIHNvIG5vIG5lZWQgdG8gZHVwbGljYXRlIHRoZW1cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgndXBkYXRlTWVzc2FnZScsIHsgX2lkOiBtc2cuX2lkLCBtc2c6IHRoaXMuYm9keVBhcmFtcy50ZXh0LCByaWQ6IG1zZy5yaWQgfSk7XG5cblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdG1lc3NhZ2U6IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRPbmVCeUlkKG1zZy5faWQpXG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2NvbW1hbmRzLmdldCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHBhcmFtcyA9IHRoaXMucXVlcnlQYXJhbXM7XG5cblx0XHRpZiAodHlwZW9mIHBhcmFtcy5jb21tYW5kICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBxdWVyeSBwYXJhbSBcImNvbW1hbmRcIiBtdXN0IGJlIHByb3ZpZGVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNtZCA9IFJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5jb21tYW5kc1twYXJhbXMuY29tbWFuZC50b0xvd2VyQ2FzZSgpXTtcblxuXHRcdGlmICghY21kKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgVGhlcmUgaXMgbm8gY29tbWFuZCBpbiB0aGUgc3lzdGVtIGJ5IHRoZSBuYW1lIG9mOiAkeyBwYXJhbXMuY29tbWFuZCB9YCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoeyBjb21tYW5kOiBjbWQgfSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY29tbWFuZHMubGlzdCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdGxldCBjb21tYW5kcyA9IE9iamVjdC52YWx1ZXMoUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmNvbW1hbmRzKTtcblxuXHRcdGlmIChxdWVyeSAmJiBxdWVyeS5jb21tYW5kKSB7XG5cdFx0XHRjb21tYW5kcyA9IGNvbW1hbmRzLmZpbHRlcigoY29tbWFuZCkgPT4gY29tbWFuZC5jb21tYW5kID09PSBxdWVyeS5jb21tYW5kKTtcblx0XHR9XG5cblx0XHRjb25zdCB0b3RhbENvdW50ID0gY29tbWFuZHMubGVuZ3RoO1xuXHRcdGNvbW1hbmRzID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMucHJvY2Vzc1F1ZXJ5T3B0aW9uc09uUmVzdWx0KGNvbW1hbmRzLCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgbmFtZTogMSB9LFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50LFxuXHRcdFx0ZmllbGRzXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRjb21tYW5kcyxcblx0XHRcdG9mZnNldCxcblx0XHRcdGNvdW50OiBjb21tYW5kcy5sZW5ndGgsXG5cdFx0XHR0b3RhbDogdG90YWxDb3VudFxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8gRXhwZWN0cyBhIGJvZHkgb2Y6IHsgY29tbWFuZDogJ2dpbW1lJywgcGFyYW1zOiAnYW55IHN0cmluZyB2YWx1ZScsIHJvb21JZDogJ3ZhbHVlJyB9XG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnY29tbWFuZHMucnVuJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGJvZHkgPSB0aGlzLmJvZHlQYXJhbXM7XG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyKCk7XG5cblx0XHRpZiAodHlwZW9mIGJvZHkuY29tbWFuZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdZb3UgbXVzdCBwcm92aWRlIGEgY29tbWFuZCB0byBydW4uJyk7XG5cdFx0fVxuXG5cdFx0aWYgKGJvZHkucGFyYW1zICYmIHR5cGVvZiBib2R5LnBhcmFtcyAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgcGFyYW1ldGVycyBmb3IgdGhlIGNvbW1hbmQgbXVzdCBiZSBhIHNpbmdsZSBzdHJpbmcuJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBib2R5LnJvb21JZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgcm9vbVxcJ3MgaWQgd2hlcmUgdG8gZXhlY3V0ZSB0aGlzIGNvbW1hbmQgbXVzdCBwcm92aWRlZCBhbmQgYmUgYSBzdHJpbmcuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY21kID0gYm9keS5jb21tYW5kLnRvTG93ZXJDYXNlKCk7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuY29tbWFuZHNbYm9keS5jb21tYW5kLnRvTG93ZXJDYXNlKCldKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGNvbW1hbmQgcHJvdmlkZWQgZG9lcyBub3QgZXhpc3QgKG9yIGlzIGRpc2FibGVkKS4nKTtcblx0XHR9XG5cblx0XHQvLyBUaGlzIHdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgdGhleSBjYW4ndCBvciB0aGUgcm9vbSBpcyBpbnZhbGlkXG5cdFx0TWV0ZW9yLmNhbGwoJ2NhbkFjY2Vzc1Jvb20nLCBib2R5LnJvb21JZCwgdXNlci5faWQpO1xuXG5cdFx0Y29uc3QgcGFyYW1zID0gYm9keS5wYXJhbXMgPyBib2R5LnBhcmFtcyA6ICcnO1xuXG5cdFx0bGV0IHJlc3VsdDtcblx0XHRNZXRlb3IucnVuQXNVc2VyKHVzZXIuX2lkLCAoKSA9PiB7XG5cdFx0XHRyZXN1bHQgPSBSb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMucnVuKGNtZCwgcGFyYW1zLCB7XG5cdFx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdHJpZDogYm9keS5yb29tSWQsXG5cdFx0XHRcdG1zZzogYC8keyBjbWQgfSAkeyBwYXJhbXMgfWBcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoeyByZXN1bHQgfSk7XG5cdH1cbn0pO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbi8vUmV0dXJucyB0aGUgcHJpdmF0ZSBncm91cCBzdWJzY3JpcHRpb24gSUYgZm91bmQgb3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIHRoZSBmYWlsdXJlIG9mIHdoeSBpdCBkaWRuJ3QuIENoZWNrIHRoZSBgc3RhdHVzQ29kZWAgcHJvcGVydHlcbmZ1bmN0aW9uIGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zLCB1c2VySWQsIGNoZWNrZWRBcmNoaXZlZCA9IHRydWUgfSkge1xuXHRpZiAoKCFwYXJhbXMucm9vbUlkIHx8ICFwYXJhbXMucm9vbUlkLnRyaW0oKSkgJiYgKCFwYXJhbXMucm9vbU5hbWUgfHwgIXBhcmFtcy5yb29tTmFtZS50cmltKCkpKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itcm9vbS1wYXJhbS1ub3QtcHJvdmlkZWQnLCAnVGhlIHBhcmFtZXRlciBcInJvb21JZFwiIG9yIFwicm9vbU5hbWVcIiBpcyByZXF1aXJlZCcpO1xuXHR9XG5cblx0bGV0IHJvb21TdWI7XG5cdGlmIChwYXJhbXMucm9vbUlkKSB7XG5cdFx0cm9vbVN1YiA9IFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZE9uZUJ5Um9vbUlkQW5kVXNlcklkKHBhcmFtcy5yb29tSWQsIHVzZXJJZCk7XG5cdH0gZWxzZSBpZiAocGFyYW1zLnJvb21OYW1lKSB7XG5cdFx0cm9vbVN1YiA9IFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZE9uZUJ5Um9vbU5hbWVBbmRVc2VySWQocGFyYW1zLnJvb21OYW1lLCB1c2VySWQpO1xuXHR9XG5cblx0aWYgKCFyb29tU3ViIHx8IHJvb21TdWIudCAhPT0gJ3AnKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itcm9vbS1ub3QtZm91bmQnLCAnVGhlIHJlcXVpcmVkIFwicm9vbUlkXCIgb3IgXCJyb29tTmFtZVwiIHBhcmFtIHByb3ZpZGVkIGRvZXMgbm90IG1hdGNoIGFueSBncm91cCcpO1xuXHR9XG5cblx0aWYgKGNoZWNrZWRBcmNoaXZlZCAmJiByb29tU3ViLmFyY2hpdmVkKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itcm9vbS1hcmNoaXZlZCcsIGBUaGUgcHJpdmF0ZSBncm91cCwgJHsgcm9vbVN1Yi5uYW1lIH0sIGlzIGFyY2hpdmVkYCk7XG5cdH1cblxuXHRyZXR1cm4gcm9vbVN1Yjtcbn1cblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5hZGRBbGwnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdhZGRBbGxVc2VyVG9Sb29tJywgZmluZFJlc3VsdC5yaWQsIHRoaXMuYm9keVBhcmFtcy5hY3RpdmVVc2Vyc09ubHkpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0Z3JvdXA6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGZpbmRSZXN1bHQucmlkLCB7IGZpZWxkczogUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSB9KVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5hZGRNb2RlcmF0b3InLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblxuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnYWRkUm9vbU1vZGVyYXRvcicsIGZpbmRSZXN1bHQucmlkLCB1c2VyLl9pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5hZGRPd25lcicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkIH0pO1xuXG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdhZGRSb29tT3duZXInLCBmaW5kUmVzdWx0LnJpZCwgdXNlci5faWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuYWRkTGVhZGVyJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQgfSk7XG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnYWRkUm9vbUxlYWRlcicsIGZpbmRSZXN1bHQucmlkLCB1c2VyLl9pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuLy9BcmNoaXZlcyBhIHByaXZhdGUgZ3JvdXAgb25seSBpZiBpdCB3YXNuJ3RcblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuYXJjaGl2ZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkIH0pO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2FyY2hpdmVSb29tJywgZmluZFJlc3VsdC5yaWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuY2xvc2UnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCwgY2hlY2tlZEFyY2hpdmVkOiBmYWxzZSB9KTtcblxuXHRcdGlmICghZmluZFJlc3VsdC5vcGVuKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgVGhlIHByaXZhdGUgZ3JvdXAsICR7IGZpbmRSZXN1bHQubmFtZSB9LCBpcyBhbHJlYWR5IGNsb3NlZCB0byB0aGUgc2VuZGVyYCk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ2hpZGVSb29tJywgZmluZFJlc3VsdC5yaWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cbi8vQ3JlYXRlIFByaXZhdGUgR3JvdXBcblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuY3JlYXRlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnY3JlYXRlLXAnKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLm5hbWUpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdCb2R5IHBhcmFtIFwibmFtZVwiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYm9keVBhcmFtcy5tZW1iZXJzICYmICFfLmlzQXJyYXkodGhpcy5ib2R5UGFyYW1zLm1lbWJlcnMpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnQm9keSBwYXJhbSBcIm1lbWJlcnNcIiBtdXN0IGJlIGFuIGFycmF5IGlmIHByb3ZpZGVkJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYm9keVBhcmFtcy5jdXN0b21GaWVsZHMgJiYgISh0eXBlb2YgdGhpcy5ib2R5UGFyYW1zLmN1c3RvbUZpZWxkcyA9PT0gJ29iamVjdCcpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnQm9keSBwYXJhbSBcImN1c3RvbUZpZWxkc1wiIG11c3QgYmUgYW4gb2JqZWN0IGlmIHByb3ZpZGVkJyk7XG5cdFx0fVxuXG5cdFx0bGV0IHJlYWRPbmx5ID0gZmFsc2U7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmJvZHlQYXJhbXMucmVhZE9ubHkgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZWFkT25seSA9IHRoaXMuYm9keVBhcmFtcy5yZWFkT25seTtcblx0XHR9XG5cblx0XHRsZXQgaWQ7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0aWQgPSBNZXRlb3IuY2FsbCgnY3JlYXRlUHJpdmF0ZUdyb3VwJywgdGhpcy5ib2R5UGFyYW1zLm5hbWUsIHRoaXMuYm9keVBhcmFtcy5tZW1iZXJzID8gdGhpcy5ib2R5UGFyYW1zLm1lbWJlcnMgOiBbXSwgcmVhZE9ubHksIHRoaXMuYm9keVBhcmFtcy5jdXN0b21GaWVsZHMpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0Z3JvdXA6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGlkLnJpZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuZGVsZXRlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQsIGNoZWNrZWRBcmNoaXZlZDogZmFsc2UgfSk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnZXJhc2VSb29tJywgZmluZFJlc3VsdC5yaWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0Z3JvdXA6IFJvY2tldENoYXQubW9kZWxzLlJvb21zLnByb2Nlc3NRdWVyeU9wdGlvbnNPblJlc3VsdChbZmluZFJlc3VsdC5fcm9vbV0sIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pWzBdXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLmZpbGVzJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCwgY2hlY2tlZEFyY2hpdmVkOiBmYWxzZSB9KTtcblxuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdGNvbnN0IG91clF1ZXJ5ID0gT2JqZWN0LmFzc2lnbih7fSwgcXVlcnksIHsgcmlkOiBmaW5kUmVzdWx0LnJpZCB9KTtcblxuXHRcdGNvbnN0IGZpbGVzID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXBsb2Fkcy5maW5kKG91clF1ZXJ5LCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgbmFtZTogMSB9LFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50LFxuXHRcdFx0ZmllbGRzXG5cdFx0fSkuZmV0Y2goKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGZpbGVzLFxuXHRcdFx0Y291bnQ6IGZpbGVzLmxlbmd0aCxcblx0XHRcdG9mZnNldCxcblx0XHRcdHRvdGFsOiBSb2NrZXRDaGF0Lm1vZGVscy5VcGxvYWRzLmZpbmQob3VyUXVlcnkpLmNvdW50KClcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuZ2V0SW50ZWdyYXRpb25zJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0bGV0IGluY2x1ZGVBbGxQcml2YXRlR3JvdXBzID0gdHJ1ZTtcblx0XHRpZiAodHlwZW9mIHRoaXMucXVlcnlQYXJhbXMuaW5jbHVkZUFsbFByaXZhdGVHcm91cHMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRpbmNsdWRlQWxsUHJpdmF0ZUdyb3VwcyA9IHRoaXMucXVlcnlQYXJhbXMuaW5jbHVkZUFsbFByaXZhdGVHcm91cHMgPT09ICd0cnVlJztcblx0XHR9XG5cblx0XHRjb25zdCBjaGFubmVsc1RvU2VhcmNoID0gW2AjJHsgZmluZFJlc3VsdC5uYW1lIH1gXTtcblx0XHRpZiAoaW5jbHVkZUFsbFByaXZhdGVHcm91cHMpIHtcblx0XHRcdGNoYW5uZWxzVG9TZWFyY2gucHVzaCgnYWxsX3ByaXZhdGVfZ3JvdXBzJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCwgZmllbGRzLCBxdWVyeSB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0Y29uc3Qgb3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgeyBjaGFubmVsOiB7ICRpbjogY2hhbm5lbHNUb1NlYXJjaCB9IH0pO1xuXHRcdGNvbnN0IGludGVncmF0aW9ucyA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kKG91clF1ZXJ5LCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgX2NyZWF0ZWRBdDogMSB9LFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50LFxuXHRcdFx0ZmllbGRzXG5cdFx0fSkuZmV0Y2goKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGludGVncmF0aW9ucyxcblx0XHRcdGNvdW50OiBpbnRlZ3JhdGlvbnMubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kKG91clF1ZXJ5KS5jb3VudCgpXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLmhpc3RvcnknLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkLCBjaGVja2VkQXJjaGl2ZWQ6IGZhbHNlIH0pO1xuXG5cdFx0bGV0IGxhdGVzdERhdGUgPSBuZXcgRGF0ZSgpO1xuXHRcdGlmICh0aGlzLnF1ZXJ5UGFyYW1zLmxhdGVzdCkge1xuXHRcdFx0bGF0ZXN0RGF0ZSA9IG5ldyBEYXRlKHRoaXMucXVlcnlQYXJhbXMubGF0ZXN0KTtcblx0XHR9XG5cblx0XHRsZXQgb2xkZXN0RGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5xdWVyeVBhcmFtcy5vbGRlc3QpIHtcblx0XHRcdG9sZGVzdERhdGUgPSBuZXcgRGF0ZSh0aGlzLnF1ZXJ5UGFyYW1zLm9sZGVzdCk7XG5cdFx0fVxuXG5cdFx0bGV0IGluY2x1c2l2ZSA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLnF1ZXJ5UGFyYW1zLmluY2x1c2l2ZSkge1xuXHRcdFx0aW5jbHVzaXZlID0gdGhpcy5xdWVyeVBhcmFtcy5pbmNsdXNpdmU7XG5cdFx0fVxuXG5cdFx0bGV0IGNvdW50ID0gMjA7XG5cdFx0aWYgKHRoaXMucXVlcnlQYXJhbXMuY291bnQpIHtcblx0XHRcdGNvdW50ID0gcGFyc2VJbnQodGhpcy5xdWVyeVBhcmFtcy5jb3VudCk7XG5cdFx0fVxuXG5cdFx0bGV0IHVucmVhZHMgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5xdWVyeVBhcmFtcy51bnJlYWRzKSB7XG5cdFx0XHR1bnJlYWRzID0gdGhpcy5xdWVyeVBhcmFtcy51bnJlYWRzO1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0cmVzdWx0ID0gTWV0ZW9yLmNhbGwoJ2dldENoYW5uZWxIaXN0b3J5JywgeyByaWQ6IGZpbmRSZXN1bHQucmlkLCBsYXRlc3Q6IGxhdGVzdERhdGUsIG9sZGVzdDogb2xkZXN0RGF0ZSwgaW5jbHVzaXZlLCBjb3VudCwgdW5yZWFkcyB9KTtcblx0XHR9KTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MocmVzdWx0KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuaW5mbycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQsIGNoZWNrZWRBcmNoaXZlZDogZmFsc2UgfSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRncm91cDogUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoZmluZFJlc3VsdC5yaWQsIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLmludml0ZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkIH0pO1xuXG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdhZGRVc2VyVG9Sb29tJywgeyByaWQ6IGZpbmRSZXN1bHQucmlkLCB1c2VybmFtZTogdXNlci51c2VybmFtZSB9KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGdyb3VwOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0LnJpZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMua2ljaycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkIH0pO1xuXG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdyZW1vdmVVc2VyRnJvbVJvb20nLCB7IHJpZDogZmluZFJlc3VsdC5yaWQsIHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lIH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMubGVhdmUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdsZWF2ZVJvb20nLCBmaW5kUmVzdWx0LnJpZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuLy9MaXN0IFByaXZhdGUgR3JvdXBzIGEgdXNlciBoYXMgYWNjZXNzIHRvXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLmxpc3QnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblx0XHRsZXQgcm9vbXMgPSBfLnBsdWNrKFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZEJ5VHlwZUFuZFVzZXJJZCgncCcsIHRoaXMudXNlcklkKS5mZXRjaCgpLCAnX3Jvb20nKTtcblx0XHRjb25zdCB0b3RhbENvdW50ID0gcm9vbXMubGVuZ3RoO1xuXG5cdFx0cm9vbXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5wcm9jZXNzUXVlcnlPcHRpb25zT25SZXN1bHQocm9vbXMsIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyBuYW1lOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHNcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGdyb3Vwczogcm9vbXMsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHRjb3VudDogcm9vbXMubGVuZ3RoLFxuXHRcdFx0dG90YWw6IHRvdGFsQ291bnRcblx0XHR9KTtcblx0fVxufSk7XG5cblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5saXN0QWxsJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LXJvb20tYWRtaW5pc3RyYXRpb24nKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblx0XHRsZXQgcm9vbXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kQnlUeXBlKCdwJykuZmV0Y2goKTtcblx0XHRjb25zdCB0b3RhbENvdW50ID0gcm9vbXMubGVuZ3RoO1xuXG5cdFx0cm9vbXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5wcm9jZXNzUXVlcnlPcHRpb25zT25SZXN1bHQocm9vbXMsIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyBuYW1lOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHNcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGdyb3Vwczogcm9vbXMsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHRjb3VudDogcm9vbXMubGVuZ3RoLFxuXHRcdFx0dG90YWw6IHRvdGFsQ291bnRcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMubWVtYmVycycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQgfSk7XG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0bGV0IHNvcnRGbiA9IChhLCBiKSA9PiBhID4gYjtcblx0XHRpZiAoTWF0Y2gudGVzdChzb3J0LCBPYmplY3QpICYmIE1hdGNoLnRlc3Qoc29ydC51c2VybmFtZSwgTnVtYmVyKSAmJiBzb3J0LnVzZXJuYW1lID09PSAtMSkge1xuXHRcdFx0c29ydEZuID0gKGEsIGIpID0+IGIgPCBhO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lbWJlcnMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5wcm9jZXNzUXVlcnlPcHRpb25zT25SZXN1bHQoQXJyYXkuZnJvbShmaW5kUmVzdWx0Ll9yb29tLnVzZXJuYW1lcykuc29ydChzb3J0Rm4pLCB7XG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnRcblx0XHR9KTtcblxuXHRcdGNvbnN0IHVzZXJzID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZCh7IHVzZXJuYW1lOiB7ICRpbjogbWVtYmVycyB9IH0sIHtcblx0XHRcdGZpZWxkczogeyBfaWQ6IDEsIHVzZXJuYW1lOiAxLCBuYW1lOiAxLCBzdGF0dXM6IDEsIHV0Y09mZnNldDogMSB9LFxuXHRcdFx0c29ydDogc29ydCA/IHNvcnQgOiB7IHVzZXJuYW1lOiAxIH1cblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0bWVtYmVyczogdXNlcnMsXG5cdFx0XHRjb3VudDogbWVtYmVycy5sZW5ndGgsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHR0b3RhbDogZmluZFJlc3VsdC5fcm9vbS51c2VybmFtZXMubGVuZ3RoXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLm1lc3NhZ2VzJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMsIHF1ZXJ5IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cblx0XHRjb25zdCBvdXJRdWVyeSA9IE9iamVjdC5hc3NpZ24oe30sIHF1ZXJ5LCB7IHJpZDogZmluZFJlc3VsdC5yaWQgfSk7XG5cblx0XHRjb25zdCBtZXNzYWdlcyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyB0czogLTEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRtZXNzYWdlcyxcblx0XHRcdGNvdW50OiBtZXNzYWdlcy5sZW5ndGgsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHR0b3RhbDogUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZChvdXJRdWVyeSkuY291bnQoKVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5vbmxpbmUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB7IHF1ZXJ5IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cdFx0Y29uc3Qgb3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgeyB0OiAncCcgfSk7XG5cblx0XHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZShvdXJRdWVyeSk7XG5cblx0XHRpZiAocm9vbSA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnR3JvdXAgZG9lcyBub3QgZXhpc3RzJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb25saW5lID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZFVzZXJzTm90T2ZmbGluZSh7XG5cdFx0XHRmaWVsZHM6IHtcblx0XHRcdFx0dXNlcm5hbWU6IDFcblx0XHRcdH1cblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0Y29uc3Qgb25saW5lSW5Sb29tID0gW107XG5cdFx0b25saW5lLmZvckVhY2godXNlciA9PiB7XG5cdFx0XHRpZiAocm9vbS51c2VybmFtZXMuaW5kZXhPZih1c2VyLnVzZXJuYW1lKSAhPT0gLTEpIHtcblx0XHRcdFx0b25saW5lSW5Sb29tLnB1c2goe1xuXHRcdFx0XHRcdF9pZDogdXNlci5faWQsXG5cdFx0XHRcdFx0dXNlcm5hbWU6IHVzZXIudXNlcm5hbWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRvbmxpbmU6IG9ubGluZUluUm9vbVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5vcGVuJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQsIGNoZWNrZWRBcmNoaXZlZDogZmFsc2UgfSk7XG5cblx0XHRpZiAoZmluZFJlc3VsdC5vcGVuKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgVGhlIHByaXZhdGUgZ3JvdXAsICR7IGZpbmRSZXN1bHQubmFtZSB9LCBpcyBhbHJlYWR5IG9wZW4gZm9yIHRoZSBzZW5kZXJgKTtcblx0XHR9XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnb3BlblJvb20nLCBmaW5kUmVzdWx0LnJpZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5yZW1vdmVNb2RlcmF0b3InLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblxuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgncmVtb3ZlUm9vbU1vZGVyYXRvcicsIGZpbmRSZXN1bHQucmlkLCB1c2VyLl9pZCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5yZW1vdmVPd25lcicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkIH0pO1xuXG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdyZW1vdmVSb29tT3duZXInLCBmaW5kUmVzdWx0LnJpZCwgdXNlci5faWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMucmVtb3ZlTGVhZGVyJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQgfSk7XG5cblx0XHRjb25zdCB1c2VyID0gdGhpcy5nZXRVc2VyRnJvbVBhcmFtcygpO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3JlbW92ZVJvb21MZWFkZXInLCBmaW5kUmVzdWx0LnJpZCwgdXNlci5faWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMucmVuYW1lJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLm5hbWUgfHwgIXRoaXMuYm9keVBhcmFtcy5uYW1lLnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBib2R5UGFyYW0gXCJuYW1lXCIgaXMgcmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHsgcm9vbUlkOiB0aGlzLmJvZHlQYXJhbXMucm9vbUlkfSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5yaWQsICdyb29tTmFtZScsIHRoaXMuYm9keVBhcmFtcy5uYW1lKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGdyb3VwOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0LnJpZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuc2V0RGVzY3JpcHRpb24nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0aWYgKCF0aGlzLmJvZHlQYXJhbXMuZGVzY3JpcHRpb24gfHwgIXRoaXMuYm9keVBhcmFtcy5kZXNjcmlwdGlvbi50cmltKCkpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgYm9keVBhcmFtIFwiZGVzY3JpcHRpb25cIiBpcyByZXF1aXJlZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQgfSk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgnc2F2ZVJvb21TZXR0aW5ncycsIGZpbmRSZXN1bHQucmlkLCAncm9vbURlc2NyaXB0aW9uJywgdGhpcy5ib2R5UGFyYW1zLmRlc2NyaXB0aW9uKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGRlc2NyaXB0aW9uOiB0aGlzLmJvZHlQYXJhbXMuZGVzY3JpcHRpb25cblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMuc2V0UHVycG9zZScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy5wdXJwb3NlIHx8ICF0aGlzLmJvZHlQYXJhbXMucHVycG9zZS50cmltKCkpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgYm9keVBhcmFtIFwicHVycG9zZVwiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmRQcml2YXRlR3JvdXBCeUlkT3JOYW1lKHsgcGFyYW1zOiB0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdXNlcklkOiB0aGlzLnVzZXJJZCB9KTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5yaWQsICdyb29tRGVzY3JpcHRpb24nLCB0aGlzLmJvZHlQYXJhbXMucHVycG9zZSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRwdXJwb3NlOiB0aGlzLmJvZHlQYXJhbXMucHVycG9zZVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2dyb3Vwcy5zZXRSZWFkT25seScsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuYm9keVBhcmFtcy5yZWFkT25seSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdUaGUgYm9keVBhcmFtIFwicmVhZE9ubHlcIiBpcyByZXF1aXJlZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQgfSk7XG5cblx0XHRpZiAoZmluZFJlc3VsdC5ybyA9PT0gdGhpcy5ib2R5UGFyYW1zLnJlYWRPbmx5KSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIHByaXZhdGUgZ3JvdXAgcmVhZCBvbmx5IHNldHRpbmcgaXMgdGhlIHNhbWUgYXMgd2hhdCBpdCB3b3VsZCBiZSBjaGFuZ2VkIHRvLicpO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5yaWQsICdyZWFkT25seScsIHRoaXMuYm9keVBhcmFtcy5yZWFkT25seSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRncm91cDogUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoZmluZFJlc3VsdC5yaWQsIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLnNldFRvcGljJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICghdGhpcy5ib2R5UGFyYW1zLnRvcGljIHx8ICF0aGlzLmJvZHlQYXJhbXMudG9waWMudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGJvZHlQYXJhbSBcInRvcGljXCIgaXMgcmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZFByaXZhdGVHcm91cEJ5SWRPck5hbWUoeyBwYXJhbXM6IHRoaXMucmVxdWVzdFBhcmFtcygpLCB1c2VySWQ6IHRoaXMudXNlcklkIH0pO1xuXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0TWV0ZW9yLmNhbGwoJ3NhdmVSb29tU2V0dGluZ3MnLCBmaW5kUmVzdWx0LnJpZCwgJ3Jvb21Ub3BpYycsIHRoaXMuYm9keVBhcmFtcy50b3BpYyk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHR0b3BpYzogdGhpcy5ib2R5UGFyYW1zLnRvcGljXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnZ3JvdXBzLnNldFR5cGUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0aWYgKCF0aGlzLmJvZHlQYXJhbXMudHlwZSB8fCAhdGhpcy5ib2R5UGFyYW1zLnR5cGUudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnVGhlIGJvZHlQYXJhbSBcInR5cGVcIiBpcyByZXF1aXJlZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQgfSk7XG5cblx0XHRpZiAoZmluZFJlc3VsdC50ID09PSB0aGlzLmJvZHlQYXJhbXMudHlwZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBwcml2YXRlIGdyb3VwIHR5cGUgaXMgdGhlIHNhbWUgYXMgd2hhdCBpdCB3b3VsZCBiZSBjaGFuZ2VkIHRvLicpO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5yaWQsICdyb29tVHlwZScsIHRoaXMuYm9keVBhcmFtcy50eXBlKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGdyb3VwOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaW5kUmVzdWx0LnJpZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSlcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdncm91cHMudW5hcmNoaXZlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kUHJpdmF0ZUdyb3VwQnlJZE9yTmFtZSh7IHBhcmFtczogdGhpcy5yZXF1ZXN0UGFyYW1zKCksIHVzZXJJZDogdGhpcy51c2VySWQsIGNoZWNrZWRBcmNoaXZlZDogZmFsc2UgfSk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRNZXRlb3IuY2FsbCgndW5hcmNoaXZlUm9vbScsIGZpbmRSZXN1bHQucmlkKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmZ1bmN0aW9uIGZpbmREaXJlY3RNZXNzYWdlUm9vbShwYXJhbXMsIHVzZXIpIHtcblx0aWYgKCghcGFyYW1zLnJvb21JZCB8fCAhcGFyYW1zLnJvb21JZC50cmltKCkpICYmICghcGFyYW1zLnVzZXJuYW1lIHx8ICFwYXJhbXMudXNlcm5hbWUudHJpbSgpKSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXJvb20tcGFyYW0tbm90LXByb3ZpZGVkJywgJ0JvZHkgcGFyYW0gXCJyb29tSWRcIiBvciBcInVzZXJuYW1lXCIgaXMgcmVxdWlyZWQnKTtcblx0fVxuXG5cdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0LmdldFJvb21CeU5hbWVPcklkV2l0aE9wdGlvblRvSm9pbih7XG5cdFx0Y3VycmVudFVzZXJJZDogdXNlci5faWQsXG5cdFx0bmFtZU9ySWQ6IHBhcmFtcy51c2VybmFtZSB8fCBwYXJhbXMucm9vbUlkLFxuXHRcdHR5cGU6ICdkJ1xuXHR9KTtcblxuXHRpZiAoIXJvb20gfHwgcm9vbS50ICE9PSAnZCcpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb29tLW5vdC1mb3VuZCcsICdUaGUgcmVxdWlyZWQgXCJyb29tSWRcIiBvciBcInVzZXJuYW1lXCIgcGFyYW0gcHJvdmlkZWQgZG9lcyBub3QgbWF0Y2ggYW55IGRpcmN0IG1lc3NhZ2UnKTtcblx0fVxuXG5cdGNvbnN0IHN1YnNjcmlwdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZE9uZUJ5Um9vbUlkQW5kVXNlcklkKHJvb20uX2lkLCB1c2VyLl9pZCk7XG5cblx0cmV0dXJuIHtcblx0XHRyb29tLFxuXHRcdHN1YnNjcmlwdGlvblxuXHR9O1xufVxuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZShbJ2RtLmNyZWF0ZScsICdpbS5jcmVhdGUnXSwgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kRGlyZWN0TWVzc2FnZVJvb20odGhpcy5yZXF1ZXN0UGFyYW1zKCksIHRoaXMudXNlcik7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRyb29tOiBmaW5kUmVzdWx0LnJvb21cblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKFsnZG0uY2xvc2UnLCAnaW0uY2xvc2UnXSwgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IGZpbmRSZXN1bHQgPSBmaW5kRGlyZWN0TWVzc2FnZVJvb20odGhpcy5yZXF1ZXN0UGFyYW1zKCksIHRoaXMudXNlcik7XG5cblx0XHRpZiAoIWZpbmRSZXN1bHQuc3Vic2NyaXB0aW9uLm9wZW4pIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKGBUaGUgZGlyZWN0IG1lc3NhZ2Ugcm9vbSwgJHsgdGhpcy5ib2R5UGFyYW1zLm5hbWUgfSwgaXMgYWxyZWFkeSBjbG9zZWQgdG8gdGhlIHNlbmRlcmApO1xuXHRcdH1cblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdoaWRlUm9vbScsIGZpbmRSZXN1bHQucm9vbS5faWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKFsnZG0uZmlsZXMnLCAnaW0uZmlsZXMnXSwgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmREaXJlY3RNZXNzYWdlUm9vbSh0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdGhpcy51c2VyKTtcblxuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdGNvbnN0IG91clF1ZXJ5ID0gT2JqZWN0LmFzc2lnbih7fSwgcXVlcnksIHsgcmlkOiBmaW5kUmVzdWx0LnJvb20uX2lkIH0pO1xuXG5cdFx0Y29uc3QgZmlsZXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5VcGxvYWRzLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyBuYW1lOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHNcblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0ZmlsZXMsXG5cdFx0XHRjb3VudDogZmlsZXMubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLlVwbG9hZHMuZmluZChvdXJRdWVyeSkuY291bnQoKVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoWydkbS5oaXN0b3J5JywgJ2ltLmhpc3RvcnknXSwgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmREaXJlY3RNZXNzYWdlUm9vbSh0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdGhpcy51c2VyKTtcblxuXHRcdGxldCBsYXRlc3REYXRlID0gbmV3IERhdGUoKTtcblx0XHRpZiAodGhpcy5xdWVyeVBhcmFtcy5sYXRlc3QpIHtcblx0XHRcdGxhdGVzdERhdGUgPSBuZXcgRGF0ZSh0aGlzLnF1ZXJ5UGFyYW1zLmxhdGVzdCk7XG5cdFx0fVxuXG5cdFx0bGV0IG9sZGVzdERhdGUgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMucXVlcnlQYXJhbXMub2xkZXN0KSB7XG5cdFx0XHRvbGRlc3REYXRlID0gbmV3IERhdGUodGhpcy5xdWVyeVBhcmFtcy5vbGRlc3QpO1xuXHRcdH1cblxuXHRcdGxldCBpbmNsdXNpdmUgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5xdWVyeVBhcmFtcy5pbmNsdXNpdmUpIHtcblx0XHRcdGluY2x1c2l2ZSA9IHRoaXMucXVlcnlQYXJhbXMuaW5jbHVzaXZlO1xuXHRcdH1cblxuXHRcdGxldCBjb3VudCA9IDIwO1xuXHRcdGlmICh0aGlzLnF1ZXJ5UGFyYW1zLmNvdW50KSB7XG5cdFx0XHRjb3VudCA9IHBhcnNlSW50KHRoaXMucXVlcnlQYXJhbXMuY291bnQpO1xuXHRcdH1cblxuXHRcdGxldCB1bnJlYWRzID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMucXVlcnlQYXJhbXMudW5yZWFkcykge1xuXHRcdFx0dW5yZWFkcyA9IHRoaXMucXVlcnlQYXJhbXMudW5yZWFkcztcblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0O1xuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdHJlc3VsdCA9IE1ldGVvci5jYWxsKCdnZXRDaGFubmVsSGlzdG9yeScsIHtcblx0XHRcdFx0cmlkOiBmaW5kUmVzdWx0LnJvb20uX2lkLFxuXHRcdFx0XHRsYXRlc3Q6IGxhdGVzdERhdGUsXG5cdFx0XHRcdG9sZGVzdDogb2xkZXN0RGF0ZSxcblx0XHRcdFx0aW5jbHVzaXZlLFxuXHRcdFx0XHRjb3VudCxcblx0XHRcdFx0dW5yZWFkc1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHJlc3VsdCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZShbJ2RtLm1lbWJlcnMnLCAnaW0ubWVtYmVycyddLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCBmaW5kUmVzdWx0ID0gZmluZERpcmVjdE1lc3NhZ2VSb29tKHRoaXMucmVxdWVzdFBhcmFtcygpLCB0aGlzLnVzZXIpO1xuXG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0Y29uc3QgbWVtYmVycyA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLnByb2Nlc3NRdWVyeU9wdGlvbnNPblJlc3VsdChBcnJheS5mcm9tKGZpbmRSZXN1bHQucm9vbS51c2VybmFtZXMpLCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IC0xLFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50XG5cdFx0fSk7XG5cblx0XHRjb25zdCB1c2VycyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmQoeyB1c2VybmFtZTogeyAkaW46IG1lbWJlcnMgfSB9LFxuXHRcdFx0eyBmaWVsZHM6IHsgX2lkOiAxLCB1c2VybmFtZTogMSwgbmFtZTogMSwgc3RhdHVzOiAxLCB1dGNPZmZzZXQ6IDEgfSB9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0bWVtYmVyczogdXNlcnMsXG5cdFx0XHRjb3VudDogbWVtYmVycy5sZW5ndGgsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHR0b3RhbDogZmluZFJlc3VsdC5yb29tLnVzZXJuYW1lcy5sZW5ndGhcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKFsnZG0ubWVzc2FnZXMnLCAnaW0ubWVzc2FnZXMnXSwgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmREaXJlY3RNZXNzYWdlUm9vbSh0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdGhpcy51c2VyKTtcblxuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdGNvbnNvbGUubG9nKGZpbmRSZXN1bHQpO1xuXHRcdGNvbnN0IG91clF1ZXJ5ID0gT2JqZWN0LmFzc2lnbih7fSwgcXVlcnksIHsgcmlkOiBmaW5kUmVzdWx0LnJvb20uX2lkIH0pO1xuXG5cdFx0Y29uc3QgbWVzc2FnZXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kKG91clF1ZXJ5LCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgdHM6IC0xIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHNcblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0bWVzc2FnZXMsXG5cdFx0XHRjb3VudDogbWVzc2FnZXMubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmQob3VyUXVlcnkpLmNvdW50KClcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKFsnZG0ubWVzc2FnZXMub3RoZXJzJywgJ2ltLm1lc3NhZ2VzLm90aGVycyddLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9FbmFibGVfRGlyZWN0X01lc3NhZ2VfSGlzdG9yeV9FbmRQb2ludCcpICE9PSB0cnVlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1lbmRwb2ludC1kaXNhYmxlZCcsICdUaGlzIGVuZHBvaW50IGlzIGRpc2FibGVkJywgeyByb3V0ZTogJy9hcGkvdjEvaW0ubWVzc2FnZXMub3RoZXJzJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctcm9vbS1hZG1pbmlzdHJhdGlvbicpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vbUlkID0gdGhpcy5xdWVyeVBhcmFtcy5yb29tSWQ7XG5cdFx0aWYgKCFyb29tSWQgfHwgIXJvb21JZC50cmltKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXJvb21pZC1wYXJhbS1ub3QtcHJvdmlkZWQnLCAnVGhlIHBhcmFtZXRlciBcInJvb21JZFwiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJvb21JZCk7XG5cdFx0aWYgKCFyb29tIHx8IHJvb20udCAhPT0gJ2QnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb29tLW5vdC1mb3VuZCcsIGBObyBkaXJlY3QgbWVzc2FnZSByb29tIGZvdW5kIGJ5IHRoZSBpZCBvZjogJHsgcm9vbUlkIH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMsIHF1ZXJ5IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cdFx0Y29uc3Qgb3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgeyByaWQ6IHJvb20uX2lkIH0pO1xuXG5cdFx0Y29uc3QgbXNncyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyB0czogLTEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRtZXNzYWdlczogbXNncyxcblx0XHRcdG9mZnNldCxcblx0XHRcdGNvdW50OiBtc2dzLmxlbmd0aCxcblx0XHRcdHRvdGFsOiBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kKG91clF1ZXJ5KS5jb3VudCgpXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZShbJ2RtLmxpc3QnLCAnaW0ubGlzdCddLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblx0XHRsZXQgcm9vbXMgPSBfLnBsdWNrKFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZEJ5VHlwZUFuZFVzZXJJZCgnZCcsIHRoaXMudXNlcklkKS5mZXRjaCgpLCAnX3Jvb20nKTtcblx0XHRjb25zdCB0b3RhbENvdW50ID0gcm9vbXMubGVuZ3RoO1xuXG5cdFx0cm9vbXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5wcm9jZXNzUXVlcnlPcHRpb25zT25SZXN1bHQocm9vbXMsIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyBuYW1lOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHNcblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGltczogcm9vbXMsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHRjb3VudDogcm9vbXMubGVuZ3RoLFxuXHRcdFx0dG90YWw6IHRvdGFsQ291bnRcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKFsnZG0ubGlzdC5ldmVyeW9uZScsICdpbS5saXN0LmV2ZXJ5b25lJ10sIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1yb29tLWFkbWluaXN0cmF0aW9uJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMsIHF1ZXJ5IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cblx0XHRjb25zdCBvdXJRdWVyeSA9IE9iamVjdC5hc3NpZ24oe30sIHF1ZXJ5LCB7IHQ6ICdkJyB9KTtcblxuXHRcdGNvbnN0IHJvb21zID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZChvdXJRdWVyeSwge1xuXHRcdFx0c29ydDogc29ydCA/IHNvcnQgOiB7IG5hbWU6IDEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRpbXM6IHJvb21zLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0Y291bnQ6IHJvb21zLmxlbmd0aCxcblx0XHRcdHRvdGFsOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kKG91clF1ZXJ5KS5jb3VudCgpXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZShbJ2RtLm9wZW4nLCAnaW0ub3BlbiddLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmREaXJlY3RNZXNzYWdlUm9vbSh0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdGhpcy51c2VyKTtcblxuXHRcdGlmICghZmluZFJlc3VsdC5zdWJzY3JpcHRpb24ub3Blbikge1xuXHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRNZXRlb3IuY2FsbCgnb3BlblJvb20nLCBmaW5kUmVzdWx0LnJvb20uX2lkKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZShbJ2RtLnNldFRvcGljJywgJ2ltLnNldFRvcGljJ10sIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy50b3BpYyB8fCAhdGhpcy5ib2R5UGFyYW1zLnRvcGljLnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ1RoZSBib2R5UGFyYW0gXCJ0b3BpY1wiIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluZFJlc3VsdCA9IGZpbmREaXJlY3RNZXNzYWdlUm9vbSh0aGlzLnJlcXVlc3RQYXJhbXMoKSwgdGhpcy51c2VyKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdzYXZlUm9vbVNldHRpbmdzJywgZmluZFJlc3VsdC5yb29tLl9pZCwgJ3Jvb21Ub3BpYycsIHRoaXMuYm9keVBhcmFtcy50b3BpYyk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHR0b3BpYzogdGhpcy5ib2R5UGFyYW1zLnRvcGljXG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2ludGVncmF0aW9ucy5jcmVhdGUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y2hlY2sodGhpcy5ib2R5UGFyYW1zLCBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0dHlwZTogU3RyaW5nLFxuXHRcdFx0bmFtZTogU3RyaW5nLFxuXHRcdFx0ZW5hYmxlZDogQm9vbGVhbixcblx0XHRcdHVzZXJuYW1lOiBTdHJpbmcsXG5cdFx0XHR1cmxzOiBNYXRjaC5NYXliZShbU3RyaW5nXSksXG5cdFx0XHRjaGFubmVsOiBTdHJpbmcsXG5cdFx0XHRldmVudDogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdHRyaWdnZXJXb3JkczogTWF0Y2guTWF5YmUoW1N0cmluZ10pLFxuXHRcdFx0YWxpYXM6IE1hdGNoLk1heWJlKFN0cmluZyksXG5cdFx0XHRhdmF0YXI6IE1hdGNoLk1heWJlKFN0cmluZyksXG5cdFx0XHRlbW9qaTogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdHRva2VuOiBNYXRjaC5NYXliZShTdHJpbmcpLFxuXHRcdFx0c2NyaXB0RW5hYmxlZDogQm9vbGVhbixcblx0XHRcdHNjcmlwdDogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdHRhcmdldENoYW5uZWw6IE1hdGNoLk1heWJlKFN0cmluZylcblx0XHR9KSk7XG5cblx0XHRsZXQgaW50ZWdyYXRpb247XG5cblx0XHRzd2l0Y2ggKHRoaXMuYm9keVBhcmFtcy50eXBlKSB7XG5cdFx0XHRjYXNlICd3ZWJob29rLW91dGdvaW5nJzpcblx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdGludGVncmF0aW9uID0gTWV0ZW9yLmNhbGwoJ2FkZE91dGdvaW5nSW50ZWdyYXRpb24nLCB0aGlzLmJvZHlQYXJhbXMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd3ZWJob29rLWluY29taW5nJzpcblx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdGludGVncmF0aW9uID0gTWV0ZW9yLmNhbGwoJ2FkZEluY29taW5nSW50ZWdyYXRpb24nLCB0aGlzLmJvZHlQYXJhbXMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgnSW52YWxpZCBpbnRlZ3JhdGlvbiB0eXBlLicpO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHsgaW50ZWdyYXRpb24gfSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnaW50ZWdyYXRpb25zLmhpc3RvcnknLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5xdWVyeVBhcmFtcy5pZCB8fCB0aGlzLnF1ZXJ5UGFyYW1zLmlkLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdJbnZhbGlkIGludGVncmF0aW9uIGlkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlkID0gdGhpcy5xdWVyeVBhcmFtcy5pZDtcblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMsIHF1ZXJ5IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cblx0XHRjb25zdCBvdXJRdWVyeSA9IE9iamVjdC5hc3NpZ24oe30sIHF1ZXJ5LCB7ICdpbnRlZ3JhdGlvbi5faWQnOiBpZCB9KTtcblx0XHRjb25zdCBoaXN0b3J5ID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25IaXN0b3J5LmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyBfdXBkYXRlZEF0OiAtMSB9LFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50LFxuXHRcdFx0ZmllbGRzXG5cdFx0fSkuZmV0Y2goKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGhpc3RvcnksXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHRpdGVtczogaGlzdG9yeS5sZW5ndGgsXG5cdFx0XHR0b3RhbDogUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25IaXN0b3J5LmZpbmQob3VyUXVlcnkpLmNvdW50KClcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdpbnRlZ3JhdGlvbnMubGlzdCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCwgZmllbGRzLCBxdWVyeSB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0Y29uc3Qgb3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSk7XG5cdFx0Y29uc3QgaW50ZWdyYXRpb25zID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmQob3VyUXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyB0czogLTEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRpbnRlZ3JhdGlvbnMsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHRpdGVtczogaW50ZWdyYXRpb25zLmxlbmd0aCxcblx0XHRcdHRvdGFsOiBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbnMuZmluZChvdXJRdWVyeSkuY291bnQoKVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2ludGVncmF0aW9ucy5yZW1vdmUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y2hlY2sodGhpcy5ib2R5UGFyYW1zLCBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0dHlwZTogU3RyaW5nLFxuXHRcdFx0dGFyZ2V0X3VybDogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdGludGVncmF0aW9uSWQ6IE1hdGNoLk1heWJlKFN0cmluZylcblx0XHR9KSk7XG5cblx0XHRpZiAoIXRoaXMuYm9keVBhcmFtcy50YXJnZXRfdXJsICYmICF0aGlzLmJvZHlQYXJhbXMuaW50ZWdyYXRpb25JZCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ0FuIGludGVncmF0aW9uSWQgb3IgdGFyZ2V0X3VybCBuZWVkcyB0byBiZSBwcm92aWRlZC4nKTtcblx0XHR9XG5cblx0XHRsZXQgaW50ZWdyYXRpb247XG5cdFx0c3dpdGNoICh0aGlzLmJvZHlQYXJhbXMudHlwZSkge1xuXHRcdFx0Y2FzZSAnd2ViaG9vay1vdXRnb2luZyc6XG5cdFx0XHRcdGlmICh0aGlzLmJvZHlQYXJhbXMudGFyZ2V0X3VybCkge1xuXHRcdFx0XHRcdGludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoeyB1cmxzOiB0aGlzLmJvZHlQYXJhbXMudGFyZ2V0X3VybCB9KTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLmJvZHlQYXJhbXMuaW50ZWdyYXRpb25JZCkge1xuXHRcdFx0XHRcdGludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoeyBfaWQ6IHRoaXMuYm9keVBhcmFtcy5pbnRlZ3JhdGlvbklkIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFpbnRlZ3JhdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdObyBpbnRlZ3JhdGlvbiBmb3VuZC4nKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRNZXRlb3IuY2FsbCgnZGVsZXRlT3V0Z29pbmdJbnRlZ3JhdGlvbicsIGludGVncmF0aW9uLl9pZCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdFx0XHRpbnRlZ3JhdGlvblxuXHRcdFx0XHR9KTtcblx0XHRcdGNhc2UgJ3dlYmhvb2staW5jb21pbmcnOlxuXHRcdFx0XHRpbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kT25lKHsgX2lkOiB0aGlzLmJvZHlQYXJhbXMuaW50ZWdyYXRpb25JZCB9KTtcblxuXHRcdFx0XHRpZiAoIWludGVncmF0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ05vIGludGVncmF0aW9uIGZvdW5kLicpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdE1ldGVvci5jYWxsKCdkZWxldGVJbmNvbWluZ0ludGVncmF0aW9uJywgaW50ZWdyYXRpb24uX2lkKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0XHRcdGludGVncmF0aW9uXG5cdFx0XHRcdH0pO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ0ludmFsaWQgaW50ZWdyYXRpb24gdHlwZS4nKTtcblx0XHR9XG5cdH1cbn0pO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdpbmZvJywgeyBhdXRoUmVxdWlyZWQ6IGZhbHNlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldExvZ2dlZEluVXNlcigpO1xuXG5cdFx0aWYgKHVzZXIgJiYgUm9ja2V0Q2hhdC5hdXRoei5oYXNSb2xlKHVzZXIuX2lkLCAnYWRtaW4nKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0XHRpbmZvOiBSb2NrZXRDaGF0LkluZm9cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGluZm86IHtcblx0XHRcdFx0J3ZlcnNpb24nOiBSb2NrZXRDaGF0LkluZm8udmVyc2lvblxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ21lJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgbWUgPSBfLnBpY2sodGhpcy51c2VyLCBbXG5cdFx0XHQnX2lkJyxcblx0XHRcdCduYW1lJyxcblx0XHRcdCdlbWFpbHMnLFxuXHRcdFx0J3N0YXR1cycsXG5cdFx0XHQnc3RhdHVzQ29ubmVjdGlvbicsXG5cdFx0XHQndXNlcm5hbWUnLFxuXHRcdFx0J3V0Y09mZnNldCcsXG5cdFx0XHQnYWN0aXZlJyxcblx0XHRcdCdsYW5ndWFnZSdcblx0XHRdKTtcblxuXHRcdGNvbnN0IHZlcmlmaWVkRW1haWwgPSBtZS5lbWFpbHMuZmluZCgoZW1haWwpID0+IGVtYWlsLnZlcmlmaWVkKTtcblxuXHRcdG1lLmVtYWlsID0gdmVyaWZpZWRFbWFpbCA/IHZlcmlmaWVkRW1haWwuYWRkcmVzcyA6IHVuZGVmaW5lZDtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKG1lKTtcblx0fVxufSk7XG5cbmxldCBvbmxpbmVDYWNoZSA9IDA7XG5sZXQgb25saW5lQ2FjaGVEYXRlID0gMDtcbmNvbnN0IGNhY2hlSW52YWxpZCA9IDYwMDAwOyAvLyAxIG1pbnV0ZVxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ3NoaWVsZC5zdmcnLCB7IGF1dGhSZXF1aXJlZDogZmFsc2UgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgeyB0eXBlLCBjaGFubmVsLCBuYW1lLCBpY29uIH0gPSB0aGlzLnF1ZXJ5UGFyYW1zO1xuXHRcdGlmICghUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9FbmFibGVfU2hpZWxkcycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1lbmRwb2ludC1kaXNhYmxlZCcsICdUaGlzIGVuZHBvaW50IGlzIGRpc2FibGVkJywgeyByb3V0ZTogJy9hcGkvdjEvc2hpZWxkcy5zdmcnIH0pO1xuXHRcdH1cblx0XHRjb25zdCB0eXBlcyA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfU2hpZWxkX1R5cGVzJyk7XG5cdFx0aWYgKHR5cGUgJiYgKHR5cGVzICE9PSAnKicgJiYgIXR5cGVzLnNwbGl0KCcsJykubWFwKCh0KSA9PiB0LnRyaW0oKSkuaW5jbHVkZXModHlwZSkpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1zaGllbGQtZGlzYWJsZWQnLCAnVGhpcyBzaGllbGQgdHlwZSBpcyBkaXNhYmxlZCcsIHsgcm91dGU6ICcvYXBpL3YxL3NoaWVsZHMuc3ZnJyB9KTtcblx0XHR9XG5cdFx0Y29uc3QgaGlkZUljb24gPSBpY29uID09PSAnZmFsc2UnO1xuXHRcdGlmIChoaWRlSWNvbiAmJiAoIW5hbWUgfHwgIW5hbWUudHJpbSgpKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ05hbWUgY2Fubm90IGJlIGVtcHR5IHdoZW4gaWNvbiBpcyBoaWRkZW4nKTtcblx0XHR9XG5cdFx0bGV0IHRleHQ7XG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlICdvbmxpbmUnOlxuXHRcdFx0XHRpZiAoRGF0ZS5ub3coKSAtIG9ubGluZUNhY2hlRGF0ZSA+IGNhY2hlSW52YWxpZCkge1xuXHRcdFx0XHRcdG9ubGluZUNhY2hlID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZFVzZXJzTm90T2ZmbGluZSgpLmNvdW50KCk7XG5cdFx0XHRcdFx0b25saW5lQ2FjaGVEYXRlID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZXh0ID0gYCR7IG9ubGluZUNhY2hlIH0gJHsgVEFQaTE4bi5fXygnT25saW5lJykgfWA7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnY2hhbm5lbCc6XG5cdFx0XHRcdGlmICghY2hhbm5lbCkge1xuXHRcdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdTaGllbGQgY2hhbm5lbCBpcyByZXF1aXJlZCBmb3IgdHlwZSBcImNoYW5uZWxcIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRleHQgPSBgIyR7IGNoYW5uZWwgfWA7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGV4dCA9IFRBUGkxOG4uX18oJ0pvaW5fQ2hhdCcpLnRvVXBwZXJDYXNlKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGljb25TaXplID0gaGlkZUljb24gPyA3IDogMjQ7XG5cdFx0Y29uc3QgbGVmdFNpemUgPSBuYW1lID8gbmFtZS5sZW5ndGggKiA2ICsgNyArIGljb25TaXplIDogaWNvblNpemU7XG5cdFx0Y29uc3QgcmlnaHRTaXplID0gdGV4dC5sZW5ndGggKiA2ICsgMjA7XG5cdFx0Y29uc3Qgd2lkdGggPSBsZWZ0U2l6ZSArIHJpZ2h0U2l6ZTtcblx0XHRjb25zdCBoZWlnaHQgPSAyMDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2ltYWdlL3N2Zyt4bWw7Y2hhcnNldD11dGYtOCcgfSxcblx0XHRcdGJvZHk6IGBcblx0XHRcdFx0PHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIgd2lkdGg9XCIkeyB3aWR0aCB9XCIgaGVpZ2h0PVwiJHsgaGVpZ2h0IH1cIj5cblx0XHRcdFx0ICA8bGluZWFyR3JhZGllbnQgaWQ9XCJiXCIgeDI9XCIwXCIgeTI9XCIxMDAlXCI+XG5cdFx0XHRcdCAgICA8c3RvcCBvZmZzZXQ9XCIwXCIgc3RvcC1jb2xvcj1cIiNiYmJcIiBzdG9wLW9wYWNpdHk9XCIuMVwiLz5cblx0XHRcdFx0ICAgIDxzdG9wIG9mZnNldD1cIjFcIiBzdG9wLW9wYWNpdHk9XCIuMVwiLz5cblx0XHRcdFx0ICA8L2xpbmVhckdyYWRpZW50PlxuXHRcdFx0XHQgIDxtYXNrIGlkPVwiYVwiPlxuXHRcdFx0XHQgICAgPHJlY3Qgd2lkdGg9XCIkeyB3aWR0aCB9XCIgaGVpZ2h0PVwiJHsgaGVpZ2h0IH1cIiByeD1cIjNcIiBmaWxsPVwiI2ZmZlwiLz5cblx0XHRcdFx0ICA8L21hc2s+XG5cdFx0XHRcdCAgPGcgbWFzaz1cInVybCgjYSlcIj5cblx0XHRcdFx0ICAgIDxwYXRoIGZpbGw9XCIjNTU1XCIgZD1cIk0wIDBoJHsgbGVmdFNpemUgfXYkeyBoZWlnaHQgfUgwelwiLz5cblx0XHRcdFx0ICAgIDxwYXRoIGZpbGw9XCIjNGMxXCIgZD1cIk0keyBsZWZ0U2l6ZSB9IDBoJHsgcmlnaHRTaXplIH12JHsgaGVpZ2h0IH1IJHsgbGVmdFNpemUgfXpcIi8+XG5cdFx0XHRcdCAgICA8cGF0aCBmaWxsPVwidXJsKCNiKVwiIGQ9XCJNMCAwaCR7IHdpZHRoIH12JHsgaGVpZ2h0IH1IMHpcIi8+XG5cdFx0XHRcdCAgPC9nPlxuXHRcdFx0XHQgICAgJHsgaGlkZUljb24gPyAnJyA6ICc8aW1hZ2UgeD1cIjVcIiB5PVwiM1wiIHdpZHRoPVwiMTRcIiBoZWlnaHQ9XCIxNFwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlkWFJtTFRnaVB6NDhJVVJQUTFSWlVFVWdjM1puSUZCVlFreEpReUFpTFM4dlZ6TkRMeTlFVkVRZ1UxWkhJREV1TVM4dlJVNGlJQ0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTlIY21Gd2FHbGpjeTlUVmtjdk1TNHhMMFJVUkM5emRtY3hNUzVrZEdRaVBqeHpkbWNnZG1WeWMybHZiajBpTVM0eElpQnBaRDBpVEdGNVpYSmZOU0lnZUcxc2JuTTlJbWgwZEhBNkx5OTNkM2N1ZHpNdWIzSm5Mekl3TURBdmMzWm5JaUI0Yld4dWN6cDRiR2x1YXowaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzk0YkdsdWF5SWdlRDBpTUhCNElpQjVQU0l3Y0hnaUlIZHBaSFJvUFNJMU1USndlQ0lnYUdWcFoyaDBQU0kxTVRKd2VDSWdkbWxsZDBKdmVEMGlNQ0F3SURVeE1pQTFNVElpSUdWdVlXSnNaUzFpWVdOclozSnZkVzVrUFNKdVpYY2dNQ0F3SURVeE1pQTFNVElpSUhodGJEcHpjR0ZqWlQwaWNISmxjMlZ5ZG1VaVBqeHdZWFJvSUdacGJHdzlJaU5ETVRJM01rUWlJR1E5SWswMU1ESXVOVGcyTERJMU5TNHpNakpqTUMweU5TNHlNell0Tnk0MU5TMDBPUzQwTXpZdE1qSXVORFExTFRjeExqa3pNbU10TVRNdU16Y3pMVEl3TGpFNU5TMHpNaTR4TURrdE16Z3VNRGN5TFRVMUxqWTROeTAxTXk0eE16SkRNemM0TGprek55d3hNREV1TVRneUxETXhPUzR4TURnc09EVXVNVFk0TERJMU5pdzROUzR4TmpoakxUSXhMakEzT1N3d0xUUXhMamcxTlN3eExqYzRNUzAyTWk0d01Ea3NOUzR6TVdNdE1USXVOVEEwTFRFeExqY3dNaTB5Tnk0eE16a3RNakl1TWpNeUxUUXlMall5Tnkwek1DNDFOa00yT0M0Mk1UZ3NNVGt1T0RFNExEQXNOVGd1T1RjMUxEQXNOVGd1T1RjMWN6WXpMamM1T0N3MU1pNDBNRGtzTlRNdU5ESTBMRGs0TGpNMVl5MHlPQzQxTkRJc01qZ3VNekV6TFRRMExqQXhMRFl5TGpRMU15MDBOQzR3TVN3NU55NDVPVGhqTUN3d0xqRXhNeXd3TGpBd05pd3dMakl5Tml3d0xqQXdOaXd3TGpNMFl6QXNNQzR4TVRNdE1DNHdNRFlzTUM0eU1qWXRNQzR3TURZc01DNHpNemxqTUN3ek5TNDFORFVzTVRVdU5EWTVMRFk1TGpZNE5TdzBOQzR3TVN3NU55NDVPVGxETmpNdU56azRMRE01T1M0NU5Dd3dMRFExTWk0ek5Td3dMRFExTWk0ek5YTTJPQzQyTVRnc016a3VNVFUyTERFMU1TNHpOak10TUM0NU5ETmpNVFV1TkRnNExUZ3VNekkzTERNd0xqRXlOQzB4T0M0NE5UY3NOREl1TmpJM0xUTXdMalUyWXpJd0xqRTFOQ3d6TGpVeU9DdzBNQzQ1TXpFc05TNHpNU3cyTWk0d01Ea3NOUzR6TVdNMk15NHhNRGdzTUN3eE1qSXVPVE0zTFRFMkxqQXhOQ3d4TmpndU5EVTBMVFExTGpBNU1XTXlNeTQxTnpjdE1UVXVNRFlzTkRJdU16RXpMVE15TGprek55dzFOUzQyT0RjdE5UTXVNVE15WXpFMExqZzVOaTB5TWk0ME9UWXNNakl1TkRRMUxUUTJMalk1TlN3eU1pNDBORFV0TnpFdU9UTXlZekF0TUM0eE1UTXRNQzR3TURZdE1DNHlNall0TUM0d01EWXRNQzR6TXpsRE5UQXlMalU0TERJMU5TNDFORGdzTlRBeUxqVTROaXd5TlRVdU5ETTJMRFV3TWk0MU9EWXNNalUxTGpNeU1ub2lMejQ4Y0dGMGFDQm1hV3hzUFNJalJrWkdSa1pHSWlCa1BTSk5NalUyTERFeU1DNDRORGRqTVRFMkxqZzFOQ3d3TERJeE1TNDFPRFlzTmpBdU5UQTVMREl4TVM0MU9EWXNNVE0xTGpFMU5HTXdMRGMwTGpZME1TMDVOQzQzTXpFc01UTTFMakUxTlMweU1URXVOVGcyTERFek5TNHhOVFZqTFRJMkxqQXhPU3d3TFRVd0xqa3pOeTB6TGpBd09TMDNNeTQ1TlRrdE9DNDBPVFZqTFRJekxqTTVOaXd5T0M0eE5EY3ROelF1T0RZNExEWTNMakk0TFRFeU5DNDROamtzTlRRdU5qSTVZekUyTGpJMk5TMHhOeTQwTnl3ME1DNHpOakV0TkRZdU9UZzRMRE0xTGpJd01TMDVOUzQyTUROakxUSTVMamsyT0MweU15NHpNakl0TkRjdU9UVTVMVFV6TGpFMk15MDBOeTQ1TlRrdE9EVXVOamcyUXpRMExqUXhOQ3d4T0RFdU16VTJMREV6T1M0eE5EVXNNVEl3TGpnME55d3lOVFlzTVRJd0xqZzBOeUl2UGp4blBqeG5QanhqYVhKamJHVWdabWxzYkQwaUkwTXhNamN5UkNJZ1kzZzlJakkxTmlJZ1kzazlJakkyTUM0ek5USWlJSEk5SWpJNExqRXdOU0l2UGp3dlp6NDhaejQ4WTJseVkyeGxJR1pwYkd3OUlpTkRNVEkzTWtRaUlHTjRQU0l6TlRNdU56STRJaUJqZVQwaU1qWXdMak0xTWlJZ2NqMGlNamd1TVRBMElpOCtQQzluUGp4blBqeGphWEpqYkdVZ1ptbHNiRDBpSTBNeE1qY3lSQ0lnWTNnOUlqRTFPQzR5TnpJaUlHTjVQU0l5TmpBdU16VXlJaUJ5UFNJeU9DNHhNRFVpTHo0OEwyYytQQzluUGp4blBqeHdZWFJvSUdacGJHdzlJaU5EUTBORFEwTWlJR1E5SWsweU5UWXNNemN6TGpNM00yTXRNall1TURFNUxEQXROVEF1T1RNM0xUSXVOakEzTFRjekxqazFPUzAzTGpNMk1tTXRNakF1TmpVNUxESXhMalUwTFRZekxqSXdPU3cxTUM0ME9UWXRNVEEzTGpNd055dzBPUzQwTTJNdE5TNDRNRFlzT0M0NE1EVXRNVEl1TVRJeExERTJMakF3TmkweE55NDFOaklzTWpFdU9EVmpOVEFzTVRJdU5qVXhMREV3TVM0ME56TXRNall1TkRneExERXlOQzQ0TmprdE5UUXVOakk1WXpJekxqQXlNeXcxTGpRNE5pdzBOeTQ1TkRFc09DNDBPVFVzTnpNdU9UVTVMRGd1TkRrMVl6RXhOUzQ1TVRjc01Dd3lNVEF1TURRNExUVTVMalUxTERJeE1TNDFOVEV0TVRNekxqTTJORU0wTmpZdU1EUTRMRE15TVM0M05qVXNNemN4TGpreE55d3pOek11TXpjekxESTFOaXd6TnpNdU16Y3plaUl2UGp3dlp6NDhMM04yWno0PVwiLz4nIH1cblx0XHRcdFx0ICA8ZyBmaWxsPVwiI2ZmZlwiIGZvbnQtZmFtaWx5PVwiRGVqYVZ1IFNhbnMsVmVyZGFuYSxHZW5ldmEsc2Fucy1zZXJpZlwiIGZvbnQtc2l6ZT1cIjExXCI+XG5cdFx0XHRcdFx0XHQkeyBuYW1lID8gYDx0ZXh0IHg9XCIkeyBpY29uU2l6ZSB9XCIgeT1cIjE1XCIgZmlsbD1cIiMwMTAxMDFcIiBmaWxsLW9wYWNpdHk9XCIuM1wiPiR7IG5hbWUgfTwvdGV4dD5cblx0XHRcdFx0ICAgIDx0ZXh0IHg9XCIkeyBpY29uU2l6ZSB9XCIgeT1cIjE0XCI+JHsgbmFtZSB9PC90ZXh0PmAgOiAnJyB9XG5cdFx0XHRcdCAgICA8dGV4dCB4PVwiJHsgbGVmdFNpemUgKyA3IH1cIiB5PVwiMTVcIiBmaWxsPVwiIzAxMDEwMVwiIGZpbGwtb3BhY2l0eT1cIi4zXCI+JHsgdGV4dCB9PC90ZXh0PlxuXHRcdFx0XHQgICAgPHRleHQgeD1cIiR7IGxlZnRTaXplICsgNyB9XCIgeT1cIjE0XCI+JHsgdGV4dCB9PC90ZXh0PlxuXHRcdFx0XHQgIDwvZz5cblx0XHRcdFx0PC9zdmc+XG5cdFx0XHRgLnRyaW0oKS5yZXBsYWNlKC9cXD5bXFxzXStcXDwvZ20sICc+PCcpXG5cdFx0fTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIFB1c2ggKi9cblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ3B1c2gudG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgeyB0eXBlLCB2YWx1ZSwgYXBwTmFtZSB9ID0gdGhpcy5ib2R5UGFyYW1zO1xuXHRcdGxldCB7IGlkIH0gPSB0aGlzLmJvZHlQYXJhbXM7XG5cblx0XHRpZiAoaWQgJiYgdHlwZW9mIGlkICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaWQtcGFyYW0tbm90LXZhbGlkJywgJ1RoZSByZXF1aXJlZCBcImlkXCIgYm9keSBwYXJhbSBpcyBpbnZhbGlkLicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZCA9IFJhbmRvbS5pZCgpO1xuXHRcdH1cblxuXHRcdGlmICghdHlwZSB8fCAodHlwZSAhPT0gJ2FwbicgJiYgdHlwZSAhPT0gJ2djbScpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci10eXBlLXBhcmFtLW5vdC12YWxpZCcsICdUaGUgcmVxdWlyZWQgXCJ0eXBlXCIgYm9keSBwYXJhbSBpcyBtaXNzaW5nIG9yIGludmFsaWQuJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci10b2tlbi1wYXJhbS1ub3QtdmFsaWQnLCAnVGhlIHJlcXVpcmVkIFwidG9rZW5cIiBib2R5IHBhcmFtIGlzIG1pc3Npbmcgb3IgaW52YWxpZC4nKTtcblx0XHR9XG5cblx0XHRpZiAoIWFwcE5hbWUgfHwgdHlwZW9mIGFwcE5hbWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hcHBOYW1lLXBhcmFtLW5vdC12YWxpZCcsICdUaGUgcmVxdWlyZWQgXCJhcHBOYW1lXCIgYm9keSBwYXJhbSBpcyBtaXNzaW5nIG9yIGludmFsaWQuJyk7XG5cdFx0fVxuXG5cblx0XHRsZXQgcmVzdWx0O1xuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHJlc3VsdCA9IE1ldGVvci5jYWxsKCdyYWl4OnB1c2gtdXBkYXRlJywge1xuXHRcdFx0aWQsXG5cdFx0XHR0b2tlbjogeyBbdHlwZV06IHZhbHVlIH0sXG5cdFx0XHRhcHBOYW1lLFxuXHRcdFx0dXNlcklkOiB0aGlzLnVzZXJJZFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHsgcmVzdWx0IH0pO1xuXHR9LFxuXHRkZWxldGUoKSB7XG5cdFx0Y29uc3QgeyB0b2tlbiB9ID0gdGhpcy5ib2R5UGFyYW1zO1xuXG5cdFx0aWYgKCF0b2tlbiB8fCB0eXBlb2YgdG9rZW4gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci10b2tlbi1wYXJhbS1ub3QtdmFsaWQnLCAnVGhlIHJlcXVpcmVkIFwidG9rZW5cIiBib2R5IHBhcmFtIGlzIG1pc3Npbmcgb3IgaW52YWxpZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCBhZmZlY3RlZFJlY29yZHMgPSBQdXNoLmFwcENvbGxlY3Rpb24ucmVtb3ZlKHtcblx0XHRcdCRvcjogW3tcblx0XHRcdFx0J3Rva2VuLmFwbic6IHRva2VuXG5cdFx0XHR9LCB7XG5cdFx0XHRcdCd0b2tlbi5nY20nOiB0b2tlblxuXHRcdFx0fV0sXG5cdFx0XHR1c2VySWQ6IHRoaXMudXNlcklkXG5cdFx0fSk7XG5cblx0XHRpZiAoYWZmZWN0ZWRSZWNvcmRzID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEubm90Rm91bmQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG4vLyBzZXR0aW5ncyBlbmRwb2ludHNcblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdzZXR0aW5ncy5wdWJsaWMnLCB7IGF1dGhSZXF1aXJlZDogZmFsc2UgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCwgZmllbGRzLCBxdWVyeSB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0bGV0IG91clF1ZXJ5ID0ge1xuXHRcdFx0aGlkZGVuOiB7ICRuZTogdHJ1ZSB9LFxuXHRcdFx0J3B1YmxpYyc6IHRydWVcblx0XHR9O1xuXG5cdFx0b3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgb3VyUXVlcnkpO1xuXG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kKG91clF1ZXJ5LCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgX2lkOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHM6IE9iamVjdC5hc3NpZ24oeyBfaWQ6IDEsIHZhbHVlOiAxIH0sIGZpZWxkcylcblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0c2V0dGluZ3MsXG5cdFx0XHRjb3VudDogc2V0dGluZ3MubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmQob3VyUXVlcnkpLmNvdW50KClcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdzZXR0aW5ncycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHsgb2Zmc2V0LCBjb3VudCB9ID0gdGhpcy5nZXRQYWdpbmF0aW9uSXRlbXMoKTtcblx0XHRjb25zdCB7IHNvcnQsIGZpZWxkcywgcXVlcnkgfSA9IHRoaXMucGFyc2VKc29uUXVlcnkoKTtcblxuXHRcdGxldCBvdXJRdWVyeSA9IHtcblx0XHRcdGhpZGRlbjogeyAkbmU6IHRydWUgfVxuXHRcdH07XG5cblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctcHJpdmlsZWdlZC1zZXR0aW5nJykpIHtcblx0XHRcdG91clF1ZXJ5LnB1YmxpYyA9IHRydWU7XG5cdFx0fVxuXG5cdFx0b3VyUXVlcnkgPSBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgb3VyUXVlcnkpO1xuXG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kKG91clF1ZXJ5LCB7XG5cdFx0XHRzb3J0OiBzb3J0ID8gc29ydCA6IHsgX2lkOiAxIH0sXG5cdFx0XHRza2lwOiBvZmZzZXQsXG5cdFx0XHRsaW1pdDogY291bnQsXG5cdFx0XHRmaWVsZHM6IE9iamVjdC5hc3NpZ24oeyBfaWQ6IDEsIHZhbHVlOiAxIH0sIGZpZWxkcylcblx0XHR9KS5mZXRjaCgpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0c2V0dGluZ3MsXG5cdFx0XHRjb3VudDogc2V0dGluZ3MubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmQob3VyUXVlcnkpLmNvdW50KClcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdzZXR0aW5ncy86X2lkJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LXByaXZpbGVnZWQtc2V0dGluZycpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoXy5waWNrKFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmRPbmVOb3RIaWRkZW5CeUlkKHRoaXMudXJsUGFyYW1zLl9pZCksICdfaWQnLCAndmFsdWUnKSk7XG5cdH0sXG5cdHBvc3QoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdlZGl0LXByaXZpbGVnZWQtc2V0dGluZycpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0Y2hlY2sodGhpcy5ib2R5UGFyYW1zLCB7XG5cdFx0XHR2YWx1ZTogTWF0Y2guQW55XG5cdFx0fSk7XG5cblx0XHRpZiAoUm9ja2V0Q2hhdC5tb2RlbHMuU2V0dGluZ3MudXBkYXRlVmFsdWVOb3RIaWRkZW5CeUlkKHRoaXMudXJsUGFyYW1zLl9pZCwgdGhpcy5ib2R5UGFyYW1zLnZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ3NlcnZpY2UuY29uZmlndXJhdGlvbnMnLCB7IGF1dGhSZXF1aXJlZDogZmFsc2UgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgU2VydmljZUNvbmZpZ3VyYXRpb24gPSBQYWNrYWdlWydzZXJ2aWNlLWNvbmZpZ3VyYXRpb24nXS5TZXJ2aWNlQ29uZmlndXJhdGlvbjtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdGNvbmZpZ3VyYXRpb25zOiBTZXJ2aWNlQ29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9ucy5maW5kKHt9LCB7ZmllbGRzOiB7c2VjcmV0OiAwfX0pLmZldGNoKClcblx0XHR9KTtcblx0fVxufSk7XG4iLCJSb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnc3RhdGlzdGljcycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGxldCByZWZyZXNoID0gZmFsc2U7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLnF1ZXJ5UGFyYW1zLnJlZnJlc2ggIT09ICd1bmRlZmluZWQnICYmIHRoaXMucXVlcnlQYXJhbXMucmVmcmVzaCA9PT0gJ3RydWUnKSB7XG5cdFx0XHRyZWZyZXNoID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRsZXQgc3RhdHM7XG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih0aGlzLnVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0c3RhdHMgPSBNZXRlb3IuY2FsbCgnZ2V0U3RhdGlzdGljcycsIHJlZnJlc2gpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0c3RhdGlzdGljczogc3RhdHNcblx0XHR9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCdzdGF0aXN0aWNzLmxpc3QnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctc3RhdGlzdGljcycpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBvZmZzZXQsIGNvdW50IH0gPSB0aGlzLmdldFBhZ2luYXRpb25JdGVtcygpO1xuXHRcdGNvbnN0IHsgc29ydCwgZmllbGRzLCBxdWVyeSB9ID0gdGhpcy5wYXJzZUpzb25RdWVyeSgpO1xuXG5cdFx0Y29uc3Qgc3RhdGlzdGljcyA9IFJvY2tldENoYXQubW9kZWxzLlN0YXRpc3RpY3MuZmluZChxdWVyeSwge1xuXHRcdFx0c29ydDogc29ydCA/IHNvcnQgOiB7IG5hbWU6IDEgfSxcblx0XHRcdHNraXA6IG9mZnNldCxcblx0XHRcdGxpbWl0OiBjb3VudCxcblx0XHRcdGZpZWxkc1xuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRzdGF0aXN0aWNzLFxuXHRcdFx0Y291bnQ6IHN0YXRpc3RpY3MubGVuZ3RoLFxuXHRcdFx0b2Zmc2V0LFxuXHRcdFx0dG90YWw6IFJvY2tldENoYXQubW9kZWxzLlN0YXRpc3RpY3MuZmluZChxdWVyeSkuY291bnQoKVxuXHRcdH0pO1xuXHR9XG59KTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgndXNlcnMuY3JlYXRlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNoZWNrKHRoaXMuYm9keVBhcmFtcywge1xuXHRcdFx0ZW1haWw6IFN0cmluZyxcblx0XHRcdG5hbWU6IFN0cmluZyxcblx0XHRcdHBhc3N3b3JkOiBTdHJpbmcsXG5cdFx0XHR1c2VybmFtZTogU3RyaW5nLFxuXHRcdFx0YWN0aXZlOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdHJvbGVzOiBNYXRjaC5NYXliZShBcnJheSksXG5cdFx0XHRqb2luRGVmYXVsdENoYW5uZWxzOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdHJlcXVpcmVQYXNzd29yZENoYW5nZTogTWF0Y2guTWF5YmUoQm9vbGVhbiksXG5cdFx0XHRzZW5kV2VsY29tZUVtYWlsOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdHZlcmlmaWVkOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdGN1c3RvbUZpZWxkczogTWF0Y2guTWF5YmUoT2JqZWN0KVxuXHRcdH0pO1xuXG5cdFx0Ly9OZXcgY2hhbmdlIG1hZGUgYnkgcHVsbCByZXF1ZXN0ICM1MTUyXG5cdFx0aWYgKHR5cGVvZiB0aGlzLmJvZHlQYXJhbXMuam9pbkRlZmF1bHRDaGFubmVscyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRoaXMuYm9keVBhcmFtcy5qb2luRGVmYXVsdENoYW5uZWxzID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5ib2R5UGFyYW1zLmN1c3RvbUZpZWxkcykge1xuXHRcdFx0Um9ja2V0Q2hhdC52YWxpZGF0ZUN1c3RvbUZpZWxkcyh0aGlzLmJvZHlQYXJhbXMuY3VzdG9tRmllbGRzKTtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdVc2VySWQgPSBSb2NrZXRDaGF0LnNhdmVVc2VyKHRoaXMudXNlcklkLCB0aGlzLmJvZHlQYXJhbXMpO1xuXG5cdFx0aWYgKHRoaXMuYm9keVBhcmFtcy5jdXN0b21GaWVsZHMpIHtcblx0XHRcdFJvY2tldENoYXQuc2F2ZUN1c3RvbUZpZWxkc1dpdGhvdXRWYWxpZGF0aW9uKG5ld1VzZXJJZCwgdGhpcy5ib2R5UGFyYW1zLmN1c3RvbUZpZWxkcyk7XG5cdFx0fVxuXG5cblx0XHRpZiAodHlwZW9mIHRoaXMuYm9keVBhcmFtcy5hY3RpdmUgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdE1ldGVvci5jYWxsKCdzZXRVc2VyQWN0aXZlU3RhdHVzJywgbmV3VXNlcklkLCB0aGlzLmJvZHlQYXJhbXMuYWN0aXZlKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHsgdXNlcjogUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQobmV3VXNlcklkLCB7IGZpZWxkczogUm9ja2V0Q2hhdC5BUEkudjEuZGVmYXVsdEZpZWxkc1RvRXhjbHVkZSB9KSB9KTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCd1c2Vycy5kZWxldGUnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdkZWxldGUtdXNlcicpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdE1ldGVvci5jYWxsKCdkZWxldGVVc2VyJywgdXNlci5faWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0fVxufSk7XG5cblJvY2tldENoYXQuQVBJLnYxLmFkZFJvdXRlKCd1c2Vycy5nZXRBdmF0YXInLCB7IGF1dGhSZXF1aXJlZDogZmFsc2UgfSwge1xuXHRnZXQoKSB7XG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblxuXHRcdGNvbnN0IHVybCA9IFJvY2tldENoYXQuZ2V0VVJMKGAvYXZhdGFyLyR7IHVzZXIudXNlcm5hbWUgfWAsIHsgY2RuOiBmYWxzZSwgZnVsbDogdHJ1ZSB9KTtcblx0XHR0aGlzLnJlc3BvbnNlLnNldEhlYWRlcignTG9jYXRpb24nLCB1cmwpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXR1c0NvZGU6IDMwNyxcblx0XHRcdGJvZHk6IHVybFxuXHRcdH07XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgndXNlcnMuZ2V0UHJlc2VuY2UnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRpZiAodGhpcy5pc1VzZXJGcm9tUGFyYW1zKCkpIHtcblx0XHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh0aGlzLnVzZXJJZCk7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRcdHByZXNlbmNlOiB1c2VyLnN0YXR1cyxcblx0XHRcdFx0Y29ubmVjdGlvblN0YXR1czogdXNlci5zdGF0dXNDb25uZWN0aW9uLFxuXHRcdFx0XHRsYXN0TG9naW46IHVzZXIubGFzdExvZ2luXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCB1c2VyID0gdGhpcy5nZXRVc2VyRnJvbVBhcmFtcygpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3Moe1xuXHRcdFx0cHJlc2VuY2U6IHVzZXIuc3RhdHVzXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgndXNlcnMuaW5mbycsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cblx0XHRsZXQgcmVzdWx0O1xuXHRcdE1ldGVvci5ydW5Bc1VzZXIodGhpcy51c2VySWQsICgpID0+IHtcblx0XHRcdHJlc3VsdCA9IE1ldGVvci5jYWxsKCdnZXRGdWxsVXNlckRhdGEnLCB7IGZpbHRlcjogdXNlci51c2VybmFtZSwgbGltaXQ6IDEgfSk7XG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShgRmFpbGVkIHRvIGdldCB0aGUgdXNlciBkYXRhIGZvciB0aGUgdXNlcklkIG9mIFwiJHsgdXNlci5faWQgfVwiLmApO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdHVzZXI6IHJlc3VsdFswXVxuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ3VzZXJzLmxpc3QnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctZC1yb29tJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRjb25zdCB7IG9mZnNldCwgY291bnQgfSA9IHRoaXMuZ2V0UGFnaW5hdGlvbkl0ZW1zKCk7XG5cdFx0Y29uc3QgeyBzb3J0LCBmaWVsZHMsIHF1ZXJ5IH0gPSB0aGlzLnBhcnNlSnNvblF1ZXJ5KCk7XG5cblx0XHRjb25zdCB1c2VycyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmQocXVlcnksIHtcblx0XHRcdHNvcnQ6IHNvcnQgPyBzb3J0IDogeyB1c2VybmFtZTogMSB9LFxuXHRcdFx0c2tpcDogb2Zmc2V0LFxuXHRcdFx0bGltaXQ6IGNvdW50LFxuXHRcdFx0ZmllbGRzXG5cdFx0fSkuZmV0Y2goKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdHVzZXJzLFxuXHRcdFx0Y291bnQ6IHVzZXJzLmxlbmd0aCxcblx0XHRcdG9mZnNldCxcblx0XHRcdHRvdGFsOiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kKHF1ZXJ5KS5jb3VudCgpXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgndXNlcnMucmVnaXN0ZXInLCB7IGF1dGhSZXF1aXJlZDogZmFsc2UgfSwge1xuXHRwb3N0KCkge1xuXHRcdGlmICh0aGlzLnVzZXJJZCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ0xvZ2dlZCBpbiB1c2VycyBjYW4gbm90IHJlZ2lzdGVyIGFnYWluLicpO1xuXHRcdH1cblxuXHRcdC8vV2Ugc2V0IHRoZWlyIHVzZXJuYW1lIGhlcmUsIHNvIHJlcXVpcmUgaXRcblx0XHQvL1RoZSBgcmVnaXN0ZXJVc2VyYCBjaGVja3MgZm9yIHRoZSBvdGhlciByZXF1aXJlbWVudHNcblx0XHRjaGVjayh0aGlzLmJvZHlQYXJhbXMsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7XG5cdFx0XHR1c2VybmFtZTogU3RyaW5nXG5cdFx0fSkpO1xuXG5cdFx0Ly9SZWdpc3RlciB0aGUgdXNlclxuXHRcdGNvbnN0IHVzZXJJZCA9IE1ldGVvci5jYWxsKCdyZWdpc3RlclVzZXInLCB0aGlzLmJvZHlQYXJhbXMpO1xuXG5cdFx0Ly9Ob3cgc2V0IHRoZWlyIHVzZXJuYW1lXG5cdFx0TWV0ZW9yLnJ1bkFzVXNlcih1c2VySWQsICgpID0+IE1ldGVvci5jYWxsKCdzZXRVc2VybmFtZScsIHRoaXMuYm9keVBhcmFtcy51c2VybmFtZSkpO1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoeyB1c2VyOiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh1c2VySWQsIHsgZmllbGRzOiBSb2NrZXRDaGF0LkFQSS52MS5kZWZhdWx0RmllbGRzVG9FeGNsdWRlIH0pIH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ3VzZXJzLnJlc2V0QXZhdGFyJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cblx0XHRpZiAodXNlci5faWQgPT09IHRoaXMudXNlcklkKSB7XG5cdFx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiBNZXRlb3IuY2FsbCgncmVzZXRBdmF0YXInKSk7XG5cdFx0fSBlbHNlIGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdlZGl0LW90aGVyLXVzZXItaW5mbycpKSB7XG5cdFx0XHRNZXRlb3IucnVuQXNVc2VyKHVzZXIuX2lkLCAoKSA9PiBNZXRlb3IuY2FsbCgncmVzZXRBdmF0YXInKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ3VzZXJzLnNldEF2YXRhcicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdCgpIHtcblx0XHRjaGVjayh0aGlzLmJvZHlQYXJhbXMsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7XG5cdFx0XHRhdmF0YXJVcmw6IE1hdGNoLk1heWJlKFN0cmluZyksXG5cdFx0XHR1c2VySWQ6IE1hdGNoLk1heWJlKFN0cmluZyksXG5cdFx0XHR1c2VybmFtZTogTWF0Y2guTWF5YmUoU3RyaW5nKVxuXHRcdH0pKTtcblxuXHRcdGxldCB1c2VyO1xuXHRcdGlmICh0aGlzLmlzVXNlckZyb21QYXJhbXMoKSkge1xuXHRcdFx0dXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHRoaXMudXNlcklkKTtcblx0XHR9IGVsc2UgaWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ2VkaXQtb3RoZXItdXNlci1pbmZvJykpIHtcblx0XHRcdHVzZXIgPSB0aGlzLmdldFVzZXJGcm9tUGFyYW1zKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHVzZXIuX2lkLCAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5ib2R5UGFyYW1zLmF2YXRhclVybCkge1xuXHRcdFx0XHRSb2NrZXRDaGF0LnNldFVzZXJBdmF0YXIodXNlciwgdGhpcy5ib2R5UGFyYW1zLmF2YXRhclVybCwgJycsICd1cmwnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IEJ1c2JveSA9IE5wbS5yZXF1aXJlKCdidXNib3knKTtcblx0XHRcdFx0Y29uc3QgYnVzYm95ID0gbmV3IEJ1c2JveSh7IGhlYWRlcnM6IHRoaXMucmVxdWVzdC5oZWFkZXJzIH0pO1xuXG5cdFx0XHRcdE1ldGVvci53cmFwQXN5bmMoKGNhbGxiYWNrKSA9PiB7XG5cdFx0XHRcdFx0YnVzYm95Lm9uKCdmaWxlJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoZmllbGRuYW1lLCBmaWxlLCBmaWxlbmFtZSwgZW5jb2RpbmcsIG1pbWV0eXBlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZmllbGRuYW1lICE9PSAnaW1hZ2UnKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBjYWxsYmFjayhuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWZpZWxkJykpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb25zdCBpbWFnZURhdGEgPSBbXTtcblx0XHRcdFx0XHRcdGZpbGUub24oJ2RhdGEnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChkYXRhKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGltYWdlRGF0YS5wdXNoKGRhdGEpO1xuXHRcdFx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdFx0XHRmaWxlLm9uKCdlbmQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zZXRVc2VyQXZhdGFyKHVzZXIsIEJ1ZmZlci5jb25jYXQoaW1hZ2VEYXRhKSwgbWltZXR5cGUsICdyZXN0Jyk7XG5cdFx0XHRcdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0dGhpcy5yZXF1ZXN0LnBpcGUoYnVzYm95KTtcblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgndXNlcnMudXBkYXRlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0KCkge1xuXHRcdGNoZWNrKHRoaXMuYm9keVBhcmFtcywge1xuXHRcdFx0dXNlcklkOiBTdHJpbmcsXG5cdFx0XHRkYXRhOiBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0XHRlbWFpbDogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdFx0bmFtZTogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdFx0cGFzc3dvcmQ6IE1hdGNoLk1heWJlKFN0cmluZyksXG5cdFx0XHRcdHVzZXJuYW1lOiBNYXRjaC5NYXliZShTdHJpbmcpLFxuXHRcdFx0XHRhY3RpdmU6IE1hdGNoLk1heWJlKEJvb2xlYW4pLFxuXHRcdFx0XHRyb2xlczogTWF0Y2guTWF5YmUoQXJyYXkpLFxuXHRcdFx0XHRqb2luRGVmYXVsdENoYW5uZWxzOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdFx0cmVxdWlyZVBhc3N3b3JkQ2hhbmdlOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdFx0c2VuZFdlbGNvbWVFbWFpbDogTWF0Y2guTWF5YmUoQm9vbGVhbiksXG5cdFx0XHRcdHZlcmlmaWVkOiBNYXRjaC5NYXliZShCb29sZWFuKSxcblx0XHRcdFx0Y3VzdG9tRmllbGRzOiBNYXRjaC5NYXliZShPYmplY3QpXG5cdFx0XHR9KVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXNlckRhdGEgPSBfLmV4dGVuZCh7IF9pZDogdGhpcy5ib2R5UGFyYW1zLnVzZXJJZCB9LCB0aGlzLmJvZHlQYXJhbXMuZGF0YSk7XG5cblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiBSb2NrZXRDaGF0LnNhdmVVc2VyKHRoaXMudXNlcklkLCB1c2VyRGF0YSkpO1xuXG5cdFx0aWYgKHRoaXMuYm9keVBhcmFtcy5kYXRhLmN1c3RvbUZpZWxkcykge1xuXHRcdFx0Um9ja2V0Q2hhdC5zYXZlQ3VzdG9tRmllbGRzKHRoaXMuYm9keVBhcmFtcy51c2VySWQsIHRoaXMuYm9keVBhcmFtcy5kYXRhLmN1c3RvbUZpZWxkcyk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB0aGlzLmJvZHlQYXJhbXMuZGF0YS5hY3RpdmUgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdE1ldGVvci5jYWxsKCdzZXRVc2VyQWN0aXZlU3RhdHVzJywgdGhpcy5ib2R5UGFyYW1zLnVzZXJJZCwgdGhpcy5ib2R5UGFyYW1zLmRhdGEuYWN0aXZlKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHsgdXNlcjogUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQodGhpcy5ib2R5UGFyYW1zLnVzZXJJZCwgeyBmaWVsZHM6IFJvY2tldENoYXQuQVBJLnYxLmRlZmF1bHRGaWVsZHNUb0V4Y2x1ZGUgfSkgfSk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgndXNlcnMuY3JlYXRlVG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3QoKSB7XG5cdFx0Y29uc3QgdXNlciA9IHRoaXMuZ2V0VXNlckZyb21QYXJhbXMoKTtcblx0XHRsZXQgZGF0YTtcblx0XHRNZXRlb3IucnVuQXNVc2VyKHRoaXMudXNlcklkLCAoKSA9PiB7XG5cdFx0XHRkYXRhID0gTWV0ZW9yLmNhbGwoJ2NyZWF0ZVRva2VuJywgdXNlci5faWQpO1xuXHRcdH0pO1xuXHRcdHJldHVybiBkYXRhID8gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7ZGF0YX0pIDogUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdH1cbn0pO1xuIiwiUm9ja2V0Q2hhdC5BUEkuZGVmYXVsdC5oZWxwZXJNZXRob2RzLnNldCgnZ2V0TG9nZ2VkSW5Vc2VyJywgZnVuY3Rpb24gX2dldExvZ2dlZEluVXNlcigpIHtcblx0bGV0IHVzZXI7XG5cblx0aWYgKHRoaXMucmVxdWVzdC5oZWFkZXJzWyd4LWF1dGgtdG9rZW4nXSAmJiB0aGlzLnJlcXVlc3QuaGVhZGVyc1sneC11c2VyLWlkJ10pIHtcblx0XHR1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh7XG5cdFx0XHQnX2lkJzogdGhpcy5yZXF1ZXN0LmhlYWRlcnNbJ3gtdXNlci1pZCddLFxuXHRcdFx0J3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlbic6IEFjY291bnRzLl9oYXNoTG9naW5Ub2tlbih0aGlzLnJlcXVlc3QuaGVhZGVyc1sneC1hdXRoLXRva2VuJ10pXG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gdXNlcjtcbn0pO1xuIiwiUm9ja2V0Q2hhdC5BUEkuZGVmYXVsdC5hZGRSb3V0ZSgnaW5mbycsIHsgYXV0aFJlcXVpcmVkOiBmYWxzZSB9LCB7XG5cdGdldCgpIHtcblx0XHRjb25zdCB1c2VyID0gdGhpcy5nZXRMb2dnZWRJblVzZXIoKTtcblxuXHRcdGlmICh1c2VyICYmIFJvY2tldENoYXQuYXV0aHouaGFzUm9sZSh1c2VyLl9pZCwgJ2FkbWluJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdFx0aW5mbzogUm9ja2V0Q2hhdC5JbmZvXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHR2ZXJzaW9uOiBSb2NrZXRDaGF0LkluZm8udmVyc2lvblxuXHRcdH0pO1xuXHR9XG59KTtcbiIsIlJvY2tldENoYXQuQVBJLmRlZmF1bHQuYWRkUm91dGUoJ21ldHJpY3MnLCB7IGF1dGhSZXF1aXJlZDogZmFsc2UgfSwge1xuXHRnZXQoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9LFxuXHRcdFx0Ym9keTogUm9ja2V0Q2hhdC5wcm9tY2xpZW50LnJlZ2lzdGVyLm1ldHJpY3MoKVxuXHRcdH07XG5cdH1cbn0pO1xuIl19
