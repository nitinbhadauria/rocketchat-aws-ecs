(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var slugify = Package['yasaricli:slugify'].slugify;
var ECMAScript = Package.ecmascript.ECMAScript;
var SHA256 = Package.sha.SHA256;
var Accounts = Package['accounts-base'].Accounts;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:ldap":{"server":{"index.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/index.js                                                                   //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
module.watch(require("./loginHandler"));
module.watch(require("./settings"));
module.watch(require("./testConnection"));
module.watch(require("./syncUsers"));
module.watch(require("./sync"));
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ldap.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/ldap.js                                                                    //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
module.export({
	default: () => LDAP
});
let ldapjs;
module.watch(require("ldapjs"), {
	default(v) {
		ldapjs = v;
	}

}, 0);
let Bunyan;
module.watch(require("bunyan"), {
	default(v) {
		Bunyan = v;
	}

}, 1);
const logger = new Logger('LDAP', {
	sections: {
		connection: 'Connection',
		bind: 'Bind',
		search: 'Search',
		auth: 'Auth'
	}
});

class LDAP {
	constructor() {
		this.ldapjs = ldapjs;
		this.connected = false;
		this.options = {
			host: RocketChat.settings.get('LDAP_Host'),
			port: RocketChat.settings.get('LDAP_Port'),
			Reconnect: RocketChat.settings.get('LDAP_Reconnect'),
			Internal_Log_Level: RocketChat.settings.get('LDAP_Internal_Log_Level'),
			timeout: RocketChat.settings.get('LDAP_Timeout'),
			connect_timeout: RocketChat.settings.get('LDAP_Connect_Timeout'),
			idle_timeout: RocketChat.settings.get('LDAP_Idle_Timeout'),
			encryption: RocketChat.settings.get('LDAP_Encryption'),
			ca_cert: RocketChat.settings.get('LDAP_CA_Cert'),
			reject_unauthorized: RocketChat.settings.get('LDAP_Reject_Unauthorized') || false,
			Authentication: RocketChat.settings.get('LDAP_Authentication'),
			Authentication_UserDN: RocketChat.settings.get('LDAP_Authentication_UserDN'),
			Authentication_Password: RocketChat.settings.get('LDAP_Authentication_Password'),
			BaseDN: RocketChat.settings.get('LDAP_BaseDN'),
			User_Search_Filter: RocketChat.settings.get('LDAP_User_Search_Filter'),
			User_Search_Scope: RocketChat.settings.get('LDAP_User_Search_Scope'),
			User_Search_Field: RocketChat.settings.get('LDAP_User_Search_Field'),
			Search_Page_Size: RocketChat.settings.get('LDAP_Search_Page_Size'),
			Search_Size_Limit: RocketChat.settings.get('LDAP_Search_Size_Limit'),
			group_filter_enabled: RocketChat.settings.get('LDAP_Group_Filter_Enable'),
			group_filter_object_class: RocketChat.settings.get('LDAP_Group_Filter_ObjectClass'),
			group_filter_group_id_attribute: RocketChat.settings.get('LDAP_Group_Filter_Group_Id_Attribute'),
			group_filter_group_member_attribute: RocketChat.settings.get('LDAP_Group_Filter_Group_Member_Attribute'),
			group_filter_group_member_format: RocketChat.settings.get('LDAP_Group_Filter_Group_Member_Format'),
			group_filter_group_name: RocketChat.settings.get('LDAP_Group_Filter_Group_Name')
		};
	}

	connectSync(...args) {
		if (!this._connectSync) {
			this._connectSync = Meteor.wrapAsync(this.connectAsync, this);
		}

		return this._connectSync(...args);
	}

	searchAllSync(...args) {
		if (!this._searchAllSync) {
			this._searchAllSync = Meteor.wrapAsync(this.searchAllAsync, this);
		}

		return this._searchAllSync(...args);
	}

	connectAsync(callback) {
		logger.connection.info('Init setup');
		let replied = false;
		const connectionOptions = {
			url: `${this.options.host}:${this.options.port}`,
			timeout: this.options.timeout,
			connectTimeout: this.options.connect_timeout,
			idleTimeout: this.options.idle_timeout,
			reconnect: this.options.Reconnect
		};

		if (this.options.Internal_Log_Level !== 'disabled') {
			connectionOptions.log = new Bunyan({
				name: 'ldapjs',
				component: 'client',
				stream: process.stderr,
				level: this.options.Internal_Log_Level
			});
		}

		const tlsOptions = {
			rejectUnauthorized: this.options.reject_unauthorized
		};

		if (this.options.ca_cert && this.options.ca_cert !== '') {
			// Split CA cert into array of strings
			const chainLines = RocketChat.settings.get('LDAP_CA_Cert').split('\n');
			let cert = [];
			const ca = [];
			chainLines.forEach(line => {
				cert.push(line);

				if (line.match(/-END CERTIFICATE-/)) {
					ca.push(cert.join('\n'));
					cert = [];
				}
			});
			tlsOptions.ca = ca;
		}

		if (this.options.encryption === 'ssl') {
			connectionOptions.url = `ldaps://${connectionOptions.url}`;
			connectionOptions.tlsOptions = tlsOptions;
		} else {
			connectionOptions.url = `ldap://${connectionOptions.url}`;
		}

		logger.connection.info('Connecting', connectionOptions.url);
		logger.connection.debug('connectionOptions', connectionOptions);
		this.client = ldapjs.createClient(connectionOptions);
		this.bindSync = Meteor.wrapAsync(this.client.bind, this.client);
		this.client.on('error', error => {
			logger.connection.error('connection', error);

			if (replied === false) {
				replied = true;
				callback(error, null);
			}
		});
		this.client.on('idle', () => {
			logger.search.info('Idle');
			this.disconnect();
		});
		this.client.on('close', () => {
			logger.search.info('Closed');
		});

		if (this.options.encryption === 'tls') {
			// Set host parameter for tls.connect which is used by ldapjs starttls. This shouldn't be needed in newer nodejs versions (e.g v5.6.0).
			// https://github.com/RocketChat/Rocket.Chat/issues/2035
			// https://github.com/mcavage/node-ldapjs/issues/349
			tlsOptions.host = this.options.host;
			logger.connection.info('Starting TLS');
			logger.connection.debug('tlsOptions', tlsOptions);
			this.client.starttls(tlsOptions, null, (error, response) => {
				if (error) {
					logger.connection.error('TLS connection', error);

					if (replied === false) {
						replied = true;
						callback(error, null);
					}

					return;
				}

				logger.connection.info('TLS connected');
				this.connected = true;

				if (replied === false) {
					replied = true;
					callback(null, response);
				}
			});
		} else {
			this.client.on('connect', response => {
				logger.connection.info('LDAP connected');
				this.connected = true;

				if (replied === false) {
					replied = true;
					callback(null, response);
				}
			});
		}

		setTimeout(() => {
			if (replied === false) {
				logger.connection.error('connection time out', connectionOptions.connectTimeout);
				replied = true;
				callback(new Error('Timeout'));
			}
		}, connectionOptions.connectTimeout);
	}

	getUserFilter(username) {
		const filter = [];

		if (this.options.User_Search_Filter !== '') {
			if (this.options.User_Search_Filter[0] === '(') {
				filter.push(`${this.options.User_Search_Filter}`);
			} else {
				filter.push(`(${this.options.User_Search_Filter})`);
			}
		}

		const usernameFilter = this.options.User_Search_Field.split(',').map(item => `(${item}=${username})`);

		if (usernameFilter.length === 0) {
			logger.error('LDAP_LDAP_User_Search_Field not defined');
		} else if (usernameFilter.length === 1) {
			filter.push(`${usernameFilter[0]}`);
		} else {
			filter.push(`(|${usernameFilter.join('')})`);
		}

		return `(&${filter.join('')})`;
	}

	bindIfNecessary() {
		if (this.domainBinded === true) {
			return;
		}

		if (this.options.Authentication !== true) {
			return;
		}

		logger.bind.info('Binding UserDN', this.options.Authentication_UserDN);
		this.bindSync(this.options.Authentication_UserDN, this.options.Authentication_Password);
		this.domainBinded = true;
	}

	searchUsersSync(username, page) {
		this.bindIfNecessary();
		const searchOptions = {
			filter: this.getUserFilter(username),
			scope: this.options.User_Search_Scope || 'sub',
			sizeLimit: this.options.Search_Size_Limit
		};

		if (this.options.Search_Page_Size > 0) {
			searchOptions.paged = {
				pageSize: this.options.Search_Page_Size,
				pagePause: !!page
			};
		}

		logger.search.info('Searching user', username);
		logger.search.debug('searchOptions', searchOptions);
		logger.search.debug('BaseDN', this.options.BaseDN);

		if (page) {
			return this.searchAllPaged(this.options.BaseDN, searchOptions, page);
		}

		return this.searchAllSync(this.options.BaseDN, searchOptions);
	}

	getUserByIdSync(id, attribute) {
		this.bindIfNecessary();
		const Unique_Identifier_Field = RocketChat.settings.get('LDAP_Unique_Identifier_Field').split(',');
		let filter;

		if (attribute) {
			filter = new this.ldapjs.filters.EqualityFilter({
				attribute,
				value: new Buffer(id, 'hex')
			});
		} else {
			const filters = [];
			Unique_Identifier_Field.forEach(item => {
				filters.push(new this.ldapjs.filters.EqualityFilter({
					attribute: item,
					value: new Buffer(id, 'hex')
				}));
			});
			filter = new this.ldapjs.filters.OrFilter({
				filters
			});
		}

		const searchOptions = {
			filter,
			scope: 'sub'
		};
		logger.search.info('Searching by id', id);
		logger.search.debug('search filter', searchOptions.filter.toString());
		logger.search.debug('BaseDN', this.options.BaseDN);
		const result = this.searchAllSync(this.options.BaseDN, searchOptions);

		if (!Array.isArray(result) || result.length === 0) {
			return;
		}

		if (result.length > 1) {
			logger.search.error('Search by id', id, 'returned', result.length, 'records');
		}

		return result[0];
	}

	getUserByUsernameSync(username) {
		this.bindIfNecessary();
		const searchOptions = {
			filter: this.getUserFilter(username),
			scope: this.options.User_Search_Scope || 'sub'
		};
		logger.search.info('Searching user', username);
		logger.search.debug('searchOptions', searchOptions);
		logger.search.debug('BaseDN', this.options.BaseDN);
		const result = this.searchAllSync(this.options.BaseDN, searchOptions);

		if (!Array.isArray(result) || result.length === 0) {
			return;
		}

		if (result.length > 1) {
			logger.search.error('Search by username', username, 'returned', result.length, 'records');
		}

		return result[0];
	}

	isUserInGroup(username) {
		if (!this.options.group_filter_enabled) {
			return true;
		}

		const filter = ['(&'];

		if (this.options.group_filter_object_class !== '') {
			filter.push(`(objectclass=${this.options.group_filter_object_class})`);
		}

		if (this.options.group_filter_group_member_attribute !== '') {
			filter.push(`(${this.options.group_filter_group_member_attribute}=${this.options.group_filter_group_member_format})`);
		}

		if (this.options.group_filter_group_id_attribute !== '') {
			filter.push(`(${this.options.group_filter_group_id_attribute}=${this.options.group_filter_group_name})`);
		}

		filter.push(')');
		const searchOptions = {
			filter: filter.join('').replace(/#{username}/g, username),
			scope: 'sub'
		};
		logger.search.debug('Group filter LDAP:', searchOptions.filter);
		const result = this.searchAllSync(this.options.BaseDN, searchOptions);

		if (!Array.isArray(result) || result.length === 0) {
			return false;
		}

		return true;
	}

	extractLdapEntryData(entry) {
		const values = {
			_raw: entry.raw
		};
		Object.keys(values._raw).forEach(key => {
			const value = values._raw[key];

			if (!['thumbnailPhoto', 'jpegPhoto'].includes(key)) {
				if (value instanceof Buffer) {
					values[key] = value.toString();
				} else {
					values[key] = value;
				}
			}
		});
		return values;
	}

	searchAllPaged(BaseDN, options, page) {
		this.bindIfNecessary();

		const processPage = ({
			entries,
			title,
			end,
			next
		}) => {
			logger.search.info(title); // Force LDAP idle to wait the record processing

			this.client._updateIdle(true);

			page(null, entries, {
				end,
				next: () => {
					// Reset idle timer
					this.client._updateIdle();

					next && next();
				}
			});
		};

		this.client.search(BaseDN, options, (error, res) => {
			if (error) {
				logger.search.error(error);
				page(error);
				return;
			}

			res.on('error', error => {
				logger.search.error(error);
				page(error);
				return;
			});
			let entries = [];
			const internalPageSize = options.paged && options.paged.pageSize > 0 ? options.paged.pageSize * 2 : 500;
			res.on('searchEntry', entry => {
				entries.push(this.extractLdapEntryData(entry));

				if (entries.length >= internalPageSize) {
					processPage({
						entries,
						title: 'Internal Page',
						end: false
					});
					entries = [];
				}
			});
			res.on('page', (result, next) => {
				if (!next) {
					this.client._updateIdle(true);

					processPage({
						entries,
						title: 'Final Page',
						end: true
					});
				} else if (entries.length) {
					logger.search.info('Page');
					processPage({
						entries,
						title: 'Page',
						end: false,
						next
					});
					entries = [];
				}
			});
			res.on('end', () => {
				if (entries.length) {
					processPage({
						entries,
						title: 'Final Page',
						end: true
					});
					entries = [];
				}
			});
		});
	}

	searchAllAsync(BaseDN, options, callback) {
		this.bindIfNecessary();
		this.client.search(BaseDN, options, (error, res) => {
			if (error) {
				logger.search.error(error);
				callback(error);
				return;
			}

			res.on('error', error => {
				logger.search.error(error);
				callback(error);
				return;
			});
			const entries = [];
			res.on('searchEntry', entry => {
				entries.push(this.extractLdapEntryData(entry));
			});
			res.on('end', () => {
				logger.search.info('Search result count', entries.length);
				callback(null, entries);
			});
		});
	}

	authSync(dn, password) {
		logger.auth.info('Authenticating', dn);

		try {
			this.bindSync(dn, password);
			logger.auth.info('Authenticated', dn);
			return true;
		} catch (error) {
			logger.auth.info('Not authenticated', dn);
			logger.auth.debug('error', error);
			return false;
		}
	}

	disconnect() {
		this.connected = false;
		this.domainBinded = false;
		logger.connection.info('Disconecting');
		this.client.unbind();
	}

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"loginHandler.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/loginHandler.js                                                            //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let slug, getLdapUsername, getLdapUserUniqueID, syncUserData, addLdapUser;
module.watch(require("./sync"), {
	slug(v) {
		slug = v;
	},

	getLdapUsername(v) {
		getLdapUsername = v;
	},

	getLdapUserUniqueID(v) {
		getLdapUserUniqueID = v;
	},

	syncUserData(v) {
		syncUserData = v;
	},

	addLdapUser(v) {
		addLdapUser = v;
	}

}, 0);
let LDAP;
module.watch(require("./ldap"), {
	default(v) {
		LDAP = v;
	}

}, 1);
const logger = new Logger('LDAPHandler', {});

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

Accounts.registerLoginHandler('ldap', function (loginRequest) {
	if (!loginRequest.ldap || !loginRequest.ldapOptions) {
		return undefined;
	}

	logger.info('Init LDAP login', loginRequest.username);

	if (RocketChat.settings.get('LDAP_Enable') !== true) {
		return fallbackDefaultAccountSystem(this, loginRequest.username, loginRequest.ldapPass);
	}

	const self = this;
	const ldap = new LDAP();
	let ldapUser;

	try {
		ldap.connectSync();
		const users = ldap.searchUsersSync(loginRequest.username);

		if (users.length !== 1) {
			logger.info('Search returned', users.length, 'record(s) for', loginRequest.username);
			throw new Error('User not Found');
		}

		if (ldap.authSync(users[0].dn, loginRequest.ldapPass) === true) {
			if (ldap.isUserInGroup(loginRequest.username)) {
				ldapUser = users[0];
			} else {
				throw new Error('User not in a valid group');
			}
		} else {
			logger.info('Wrong password for', loginRequest.username);
		}
	} catch (error) {
		logger.error(error);
	}

	if (ldapUser === undefined) {
		if (RocketChat.settings.get('LDAP_Login_Fallback') === true) {
			return fallbackDefaultAccountSystem(self, loginRequest.username, loginRequest.ldapPass);
		}

		throw new Meteor.Error('LDAP-login-error', `LDAP Authentication failed with provided username [${loginRequest.username}]`);
	} // Look to see if user already exists


	let userQuery;
	const Unique_Identifier_Field = getLdapUserUniqueID(ldapUser);
	let user;

	if (Unique_Identifier_Field) {
		userQuery = {
			'services.ldap.id': Unique_Identifier_Field.value
		};
		logger.info('Querying user');
		logger.debug('userQuery', userQuery);
		user = Meteor.users.findOne(userQuery);
	}

	let username;

	if (RocketChat.settings.get('LDAP_Username_Field') !== '') {
		username = slug(getLdapUsername(ldapUser));
	} else {
		username = slug(loginRequest.username);
	}

	if (!user) {
		userQuery = {
			username
		};
		logger.debug('userQuery', userQuery);
		user = Meteor.users.findOne(userQuery);
	} // Login user if they exist


	if (user) {
		if (user.ldap !== true && RocketChat.settings.get('LDAP_Merge_Existing_Users') !== true) {
			logger.info('User exists without "ldap: true"');
			throw new Meteor.Error('LDAP-login-error', `LDAP Authentication succeded, but there's already an existing user with provided username [${username}] in Mongo.`);
		}

		logger.info('Logging user');

		const stampedToken = Accounts._generateStampedLoginToken();

		Meteor.users.update(user._id, {
			$push: {
				'services.resume.loginTokens': Accounts._hashStampedToken(stampedToken)
			}
		});
		syncUserData(user, ldapUser);

		if (RocketChat.settings.get('LDAP_Login_Fallback') === true) {
			Accounts.setPassword(user._id, loginRequest.ldapPass, {
				logout: false
			});
		}

		return {
			userId: user._id,
			token: stampedToken.token
		};
	}

	logger.info('User does not exist, creating', username);

	if (RocketChat.settings.get('LDAP_Username_Field') === '') {
		username = undefined;
	}

	if (RocketChat.settings.get('LDAP_Login_Fallback') !== true) {
		loginRequest.ldapPass = undefined;
	} // Create new user


	const result = addLdapUser(ldapUser, username, loginRequest.ldapPass);

	if (result instanceof Error) {
		throw result;
	}

	return result;
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/settings.js                                                                //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
RocketChat.settings.addGroup('LDAP', function () {
	const enableQuery = {
		_id: 'LDAP_Enable',
		value: true
	};
	const enableAuthentication = [enableQuery, {
		_id: 'LDAP_Authentication',
		value: true
	}];
	const enableTLSQuery = [enableQuery, {
		_id: 'LDAP_Encryption',
		value: {
			$in: ['tls', 'ssl']
		}
	}];
	const syncDataQuery = [enableQuery, {
		_id: 'LDAP_Sync_User_Data',
		value: true
	}];
	const groupFilterQuery = [enableQuery, {
		_id: 'LDAP_Group_Filter_Enable',
		value: true
	}];
	const backgroundSyncQuery = [enableQuery, {
		_id: 'LDAP_Background_Sync',
		value: true
	}];
	this.add('LDAP_Enable', false, {
		type: 'boolean',
		public: true
	});
	this.add('LDAP_Login_Fallback', true, {
		type: 'boolean',
		enableQuery
	});
	this.add('LDAP_Host', '', {
		type: 'string',
		enableQuery
	});
	this.add('LDAP_Port', '389', {
		type: 'string',
		enableQuery
	});
	this.add('LDAP_Reconnect', false, {
		type: 'boolean',
		enableQuery
	});
	this.add('LDAP_Encryption', 'plain', {
		type: 'select',
		values: [{
			key: 'plain',
			i18nLabel: 'No_Encryption'
		}, {
			key: 'tls',
			i18nLabel: 'StartTLS'
		}, {
			key: 'ssl',
			i18nLabel: 'SSL/LDAPS'
		}],
		enableQuery
	});
	this.add('LDAP_CA_Cert', '', {
		type: 'string',
		multiline: true,
		enableQuery: enableTLSQuery
	});
	this.add('LDAP_Reject_Unauthorized', true, {
		type: 'boolean',
		enableQuery: enableTLSQuery
	});
	this.add('LDAP_BaseDN', '', {
		type: 'string',
		enableQuery
	});
	this.add('LDAP_Internal_Log_Level', 'disabled', {
		type: 'select',
		values: [{
			key: 'disabled',
			i18nLabel: 'Disabled'
		}, {
			key: 'error',
			i18nLabel: 'Error'
		}, {
			key: 'warn',
			i18nLabel: 'Warn'
		}, {
			key: 'info',
			i18nLabel: 'Info'
		}, {
			key: 'debug',
			i18nLabel: 'Debug'
		}, {
			key: 'trace',
			i18nLabel: 'Trace'
		}],
		enableQuery
	});
	this.add('LDAP_Test_Connection', 'ldap_test_connection', {
		type: 'action',
		actionText: 'Test_Connection'
	});
	this.section('Authentication', function () {
		this.add('LDAP_Authentication', false, {
			type: 'boolean',
			enableQuery
		});
		this.add('LDAP_Authentication_UserDN', '', {
			type: 'string',
			enableQuery: enableAuthentication
		});
		this.add('LDAP_Authentication_Password', '', {
			type: 'password',
			enableQuery: enableAuthentication
		});
	});
	this.section('Timeouts', function () {
		this.add('LDAP_Timeout', 60000, {
			type: 'int',
			enableQuery
		});
		this.add('LDAP_Connect_Timeout', 1000, {
			type: 'int',
			enableQuery
		});
		this.add('LDAP_Idle_Timeout', 1000, {
			type: 'int',
			enableQuery
		});
	});
	this.section('User Search', function () {
		this.add('LDAP_User_Search_Filter', '(objectclass=*)', {
			type: 'string',
			enableQuery
		});
		this.add('LDAP_User_Search_Scope', 'sub', {
			type: 'string',
			enableQuery
		});
		this.add('LDAP_User_Search_Field', 'sAMAccountName', {
			type: 'string',
			enableQuery
		});
		this.add('LDAP_Search_Page_Size', 250, {
			type: 'int',
			enableQuery
		});
		this.add('LDAP_Search_Size_Limit', 1000, {
			type: 'int',
			enableQuery
		});
	});
	this.section('User Search (Group Validation)', function () {
		this.add('LDAP_Group_Filter_Enable', false, {
			type: 'boolean',
			enableQuery
		});
		this.add('LDAP_Group_Filter_ObjectClass', 'groupOfUniqueNames', {
			type: 'string',
			enableQuery: groupFilterQuery
		});
		this.add('LDAP_Group_Filter_Group_Id_Attribute', 'cn', {
			type: 'string',
			enableQuery: groupFilterQuery
		});
		this.add('LDAP_Group_Filter_Group_Member_Attribute', 'uniqueMember', {
			type: 'string',
			enableQuery: groupFilterQuery
		});
		this.add('LDAP_Group_Filter_Group_Member_Format', 'uniqueMember', {
			type: 'string',
			enableQuery: groupFilterQuery
		});
		this.add('LDAP_Group_Filter_Group_Name', 'ROCKET_CHAT', {
			type: 'string',
			enableQuery: groupFilterQuery
		});
	});
	this.section('Sync / Import', function () {
		this.add('LDAP_Username_Field', 'sAMAccountName', {
			type: 'string',
			enableQuery
		});
		this.add('LDAP_Unique_Identifier_Field', 'objectGUID,ibm-entryUUID,GUID,dominoUNID,nsuniqueId,uidNumber', {
			type: 'string',
			enableQuery
		});
		this.add('LDAP_Default_Domain', '', {
			type: 'string',
			enableQuery
		});
		this.add('LDAP_Merge_Existing_Users', false, {
			type: 'boolean',
			enableQuery
		});
		this.add('LDAP_Sync_User_Data', false, {
			type: 'boolean',
			enableQuery
		});
		this.add('LDAP_Sync_User_Data_FieldMap', '{"cn":"name", "mail":"email"}', {
			type: 'string',
			enableQuery: syncDataQuery
		});
		this.add('LDAP_Sync_User_Avatar', true, {
			type: 'boolean',
			enableQuery
		});
		this.add('LDAP_Background_Sync', false, {
			type: 'boolean',
			enableQuery
		});
		this.add('LDAP_Background_Sync_Interval', 'Every 24 hours', {
			type: 'string',
			enableQuery: backgroundSyncQuery
		});
		this.add('LDAP_Background_Sync_Import_New_Users', true, {
			type: 'boolean',
			enableQuery: backgroundSyncQuery
		});
		this.add('LDAP_Background_Sync_Keep_Existant_Users_Updated', true, {
			type: 'boolean',
			enableQuery: backgroundSyncQuery
		});
		this.add('LDAP_Sync_Now', 'ldap_sync_now', {
			type: 'action',
			actionText: 'Execute_Synchronization_Now'
		});
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sync.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/sync.js                                                                    //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
module.export({
	slug: () => slug,
	getPropertyValue: () => getPropertyValue,
	getLdapUsername: () => getLdapUsername,
	getLdapUserUniqueID: () => getLdapUserUniqueID,
	getDataToSyncUserData: () => getDataToSyncUserData,
	syncUserData: () => syncUserData,
	addLdapUser: () => addLdapUser,
	importNewUsers: () => importNewUsers
});

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let LDAP;
module.watch(require("./ldap"), {
	default(v) {
		LDAP = v;
	}

}, 1);
const logger = new Logger('LDAPSync', {});

function slug(text) {
	if (RocketChat.settings.get('UTF8_Names_Slugify') !== true) {
		return text;
	}

	text = slugify(text, '.');
	return text.replace(/[^0-9a-z-_.]/g, '');
}

function getPropertyValue(obj, key) {
	try {
		return _.reduce(key.split('.'), (acc, el) => acc[el], obj);
	} catch (err) {
		return undefined;
	}
}

function getLdapUsername(ldapUser) {
	const usernameField = RocketChat.settings.get('LDAP_Username_Field');

	if (usernameField.indexOf('#{') > -1) {
		return usernameField.replace(/#{(.+?)}/g, function (match, field) {
			return ldapUser[field];
		});
	}

	return ldapUser[usernameField];
}

function getLdapUserUniqueID(ldapUser) {
	let Unique_Identifier_Field = RocketChat.settings.get('LDAP_Unique_Identifier_Field');

	if (Unique_Identifier_Field !== '') {
		Unique_Identifier_Field = Unique_Identifier_Field.replace(/\s/g, '').split(',');
	} else {
		Unique_Identifier_Field = [];
	}

	let User_Search_Field = RocketChat.settings.get('LDAP_User_Search_Field');

	if (User_Search_Field !== '') {
		User_Search_Field = User_Search_Field.replace(/\s/g, '').split(',');
	} else {
		User_Search_Field = [];
	}

	Unique_Identifier_Field = Unique_Identifier_Field.concat(User_Search_Field);

	if (Unique_Identifier_Field.length > 0) {
		Unique_Identifier_Field = Unique_Identifier_Field.find(field => {
			return !_.isEmpty(ldapUser._raw[field]);
		});

		if (Unique_Identifier_Field) {
			Unique_Identifier_Field = {
				attribute: Unique_Identifier_Field,
				value: ldapUser._raw[Unique_Identifier_Field].toString('hex')
			};
		}

		return Unique_Identifier_Field;
	}
}

function getDataToSyncUserData(ldapUser, user) {
	const syncUserData = RocketChat.settings.get('LDAP_Sync_User_Data');
	const syncUserDataFieldMap = RocketChat.settings.get('LDAP_Sync_User_Data_FieldMap').trim();
	const userData = {};

	if (syncUserData && syncUserDataFieldMap) {
		const whitelistedUserFields = ['email', 'name', 'customFields'];
		const fieldMap = JSON.parse(syncUserDataFieldMap);
		const emailList = [];

		_.map(fieldMap, function (userField, ldapField) {
			switch (userField) {
				case 'email':
					if (!ldapUser.hasOwnProperty(ldapField)) {
						logger.debug(`user does not have attribute: ${ldapField}`);
						return;
					}

					if (_.isObject(ldapUser[ldapField])) {
						_.map(ldapUser[ldapField], function (item) {
							emailList.push({
								address: item,
								verified: true
							});
						});
					} else {
						emailList.push({
							address: ldapUser[ldapField],
							verified: true
						});
					}

					break;

				default:
					const [outerKey, innerKeys] = userField.split(/\.(.+)/);

					if (!_.find(whitelistedUserFields, el => el === outerKey)) {
						logger.debug(`user attribute not whitelisted: ${userField}`);
						return;
					}

					if (outerKey === 'customFields') {
						let customFieldsMeta;

						try {
							customFieldsMeta = JSON.parse(RocketChat.settings.get('Accounts_CustomFields'));
						} catch (e) {
							logger.debug('Invalid JSON for Custom Fields');
							return;
						}

						if (!getPropertyValue(customFieldsMeta, innerKeys)) {
							logger.debug(`user attribute does not exist: ${userField}`);
							return;
						}
					}

					const tmpUserField = getPropertyValue(user, userField);
					const tmpLdapField = RocketChat.templateVarHandler(ldapField, ldapUser);

					if (tmpLdapField && tmpUserField !== tmpLdapField) {
						// creates the object structure instead of just assigning 'tmpLdapField' to
						// 'userData[userField]' in order to avoid the "cannot use the part (...)
						// to traverse the element" (MongoDB) error that can happen. Do not handle
						// arrays.
						// TODO: Find a better solution.
						const dKeys = userField.split('.');

						const lastKey = _.last(dKeys);

						_.reduce(dKeys, (obj, currKey) => currKey === lastKey ? obj[currKey] = tmpLdapField : obj[currKey] = obj[currKey] || {}, userData);

						logger.debug(`user.${userField} changed to: ${tmpLdapField}`);
					}

			}
		});

		if (emailList.length > 0) {
			if (JSON.stringify(user.emails) !== JSON.stringify(emailList)) {
				userData.emails = emailList;
			}
		}
	}

	const uniqueId = getLdapUserUniqueID(ldapUser);

	if (uniqueId && (!user.services || !user.services.ldap || user.services.ldap.id !== uniqueId.value || user.services.ldap.idAttribute !== uniqueId.attribute)) {
		userData['services.ldap.id'] = uniqueId.value;
		userData['services.ldap.idAttribute'] = uniqueId.attribute;
	}

	if (user.ldap !== true) {
		userData.ldap = true;
	}

	if (_.size(userData)) {
		return userData;
	}
}

function syncUserData(user, ldapUser) {
	logger.info('Syncing user data');
	logger.debug('user', {
		'email': user.email,
		'_id': user._id
	});
	logger.debug('ldapUser', ldapUser);
	const userData = getDataToSyncUserData(ldapUser, user);

	if (user && user._id && userData) {
		logger.debug('setting', JSON.stringify(userData, null, 2));

		if (userData.name) {
			RocketChat._setRealName(user._id, userData.name);

			delete userData.name;
		}

		Meteor.users.update(user._id, {
			$set: userData
		});
		user = Meteor.users.findOne({
			_id: user._id
		});
	}

	if (RocketChat.settings.get('LDAP_Username_Field') !== '') {
		const username = slug(getLdapUsername(ldapUser));

		if (user && user._id && username !== user.username) {
			logger.info('Syncing user username', user.username, '->', username);

			RocketChat._setUsername(user._id, username);
		}
	}

	if (user && user._id && RocketChat.settings.get('LDAP_Sync_User_Avatar') === true) {
		const avatar = ldapUser._raw.thumbnailPhoto || ldapUser._raw.jpegPhoto;

		if (avatar) {
			logger.info('Syncing user avatar');
			const rs = RocketChatFile.bufferToStream(avatar);
			const fileStore = FileUpload.getStore('Avatars');
			fileStore.deleteByName(user.username);
			const file = {
				userId: user._id,
				type: 'image/jpeg'
			};
			Meteor.runAsUser(user._id, () => {
				fileStore.insert(file, rs, () => {
					Meteor.setTimeout(function () {
						RocketChat.models.Users.setAvatarOrigin(user._id, 'ldap');
						RocketChat.Notifications.notifyLogged('updateAvatar', {
							username: user.username
						});
					}, 500);
				});
			});
		}
	}
}

function addLdapUser(ldapUser, username, password) {
	const uniqueId = getLdapUserUniqueID(ldapUser);
	const userObject = {};

	if (username) {
		userObject.username = username;
	}

	const userData = getDataToSyncUserData(ldapUser, {});

	if (userData && userData.emails && userData.emails[0] && userData.emails[0].address) {
		if (Array.isArray(userData.emails[0].address)) {
			userObject.email = userData.emails[0].address[0];
		} else {
			userObject.email = userData.emails[0].address;
		}
	} else if (ldapUser.mail && ldapUser.mail.indexOf('@') > -1) {
		userObject.email = ldapUser.mail;
	} else if (RocketChat.settings.get('LDAP_Default_Domain') !== '') {
		userObject.email = `${username || uniqueId.value}@${RocketChat.settings.get('LDAP_Default_Domain')}`;
	} else {
		const error = new Meteor.Error('LDAP-login-error', 'LDAP Authentication succeded, there is no email to create an account. Have you tried setting your Default Domain in LDAP Settings?');
		logger.error(error);
		throw error;
	}

	logger.debug('New user data', userObject);

	if (password) {
		userObject.password = password;
	}

	try {
		userObject._id = Accounts.createUser(userObject);
	} catch (error) {
		logger.error('Error creating user', error);
		return error;
	}

	syncUserData(userObject, ldapUser);
	return {
		userId: userObject._id
	};
}

function importNewUsers(ldap) {
	if (RocketChat.settings.get('LDAP_Enable') !== true) {
		logger.error('Can\'t run LDAP Import, LDAP is disabled');
		return;
	}

	if (!ldap) {
		ldap = new LDAP();
		ldap.connectSync();
	}

	let count = 0;
	ldap.searchUsersSync('*', Meteor.bindEnvironment((error, ldapUsers, {
		next,
		end
	} = {}) => {
		if (error) {
			throw error;
		}

		ldapUsers.forEach(ldapUser => {
			count++;
			const uniqueId = getLdapUserUniqueID(ldapUser); // Look to see if user already exists

			const userQuery = {
				'services.ldap.id': uniqueId.value
			};
			logger.debug('userQuery', userQuery);
			let username;

			if (RocketChat.settings.get('LDAP_Username_Field') !== '') {
				username = slug(getLdapUsername(ldapUser));
			} // Add user if it was not added before


			let user = Meteor.users.findOne(userQuery);

			if (!user && username && RocketChat.settings.get('LDAP_Merge_Existing_Users') === true) {
				const userQuery = {
					username
				};
				logger.debug('userQuery merge', userQuery);
				user = Meteor.users.findOne(userQuery);

				if (user) {
					syncUserData(user, ldapUser);
				}
			}

			if (!user) {
				addLdapUser(ldapUser, username);
			}

			if (count % 100 === 0) {
				logger.info('Import running. Users imported until now:', count);
			}
		});

		if (end) {
			logger.info('Import finished. Users imported:', count);
		}

		next(count);
	}));
}

function sync() {
	if (RocketChat.settings.get('LDAP_Enable') !== true) {
		return;
	}

	const ldap = new LDAP();

	try {
		ldap.connectSync();
		let users;

		if (RocketChat.settings.get('LDAP_Background_Sync_Keep_Existant_Users_Updated') === true) {
			users = RocketChat.models.Users.findLDAPUsers();
		}

		if (RocketChat.settings.get('LDAP_Background_Sync_Import_New_Users') === true) {
			importNewUsers(ldap);
		}

		if (RocketChat.settings.get('LDAP_Background_Sync_Keep_Existant_Users_Updated') === true) {
			users.forEach(function (user) {
				let ldapUser;

				if (user.services && user.services.ldap && user.services.ldap.id) {
					ldapUser = ldap.getUserByIdSync(user.services.ldap.id, user.services.ldap.idAttribute);
				} else {
					ldapUser = ldap.getUserByUsernameSync(user.username);
				}

				if (ldapUser) {
					syncUserData(user, ldapUser);
				} else {
					logger.info('Can\'t sync user', user.username);
				}
			});
		}
	} catch (error) {
		logger.error(error);
		return error;
	}

	return true;
}

const jobName = 'LDAP_Sync';

const addCronJob = _.debounce(Meteor.bindEnvironment(function addCronJobDebounced() {
	if (RocketChat.settings.get('LDAP_Background_Sync') !== true) {
		logger.info('Disabling LDAP Background Sync');

		if (SyncedCron.nextScheduledAtDate(jobName)) {
			SyncedCron.remove(jobName);
		}

		return;
	}

	if (RocketChat.settings.get('LDAP_Background_Sync_Interval')) {
		logger.info('Enabling LDAP Background Sync');
		SyncedCron.add({
			name: jobName,
			schedule: parser => parser.text(RocketChat.settings.get('LDAP_Background_Sync_Interval')),

			job() {
				sync();
			}

		});
		SyncedCron.start();
	}
}), 500);

Meteor.startup(() => {
	Meteor.defer(() => {
		RocketChat.settings.get('LDAP_Background_Sync', addCronJob);
		RocketChat.settings.get('LDAP_Background_Sync_Interval', addCronJob);
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"syncUsers.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/syncUsers.js                                                               //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let importNewUsers;
module.watch(require("./sync"), {
	importNewUsers(v) {
		importNewUsers = v;
	}

}, 0);
Meteor.methods({
	ldap_sync_now() {
		const user = Meteor.user();

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'ldap_sync_users'
			});
		}

		if (!RocketChat.authz.hasRole(user._id, 'admin')) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'ldap_sync_users'
			});
		}

		if (RocketChat.settings.get('LDAP_Enable') !== true) {
			throw new Meteor.Error('LDAP_disabled');
		}

		this.unblock();
		importNewUsers();
		return {
			message: 'Sync_in_progress',
			params: []
		};
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"testConnection.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_ldap/server/testConnection.js                                                          //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let LDAP;
module.watch(require("./ldap"), {
	default(v) {
		LDAP = v;
	}

}, 0);
Meteor.methods({
	ldap_test_connection() {
		const user = Meteor.user();

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'ldap_test_connection'
			});
		}

		if (!RocketChat.authz.hasRole(user._id, 'admin')) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'ldap_test_connection'
			});
		}

		if (RocketChat.settings.get('LDAP_Enable') !== true) {
			throw new Meteor.Error('LDAP_disabled');
		}

		let ldap;

		try {
			ldap = new LDAP();
			ldap.connectSync();
		} catch (error) {
			console.log(error);
			throw new Meteor.Error(error.message);
		}

		try {
			ldap.bindIfNecessary();
		} catch (error) {
			throw new Meteor.Error(error.name || error.message);
		}

		return {
			message: 'Connection_success',
			params: []
		};
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
var exports = require("./node_modules/meteor/rocketchat:ldap/server/index.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:ldap'] = exports;

})();

//# sourceURL=meteor://💻app/packages/rocketchat_ldap.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsZGFwL3NlcnZlci9pbmRleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsZGFwL3NlcnZlci9sZGFwLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxkYXAvc2VydmVyL2xvZ2luSGFuZGxlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsZGFwL3NlcnZlci9zZXR0aW5ncy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsZGFwL3NlcnZlci9zeW5jLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxkYXAvc2VydmVyL3N5bmNVc2Vycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsZGFwL3NlcnZlci90ZXN0Q29ubmVjdGlvbi5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJleHBvcnQiLCJkZWZhdWx0IiwiTERBUCIsImxkYXBqcyIsInYiLCJCdW55YW4iLCJsb2dnZXIiLCJMb2dnZXIiLCJzZWN0aW9ucyIsImNvbm5lY3Rpb24iLCJiaW5kIiwic2VhcmNoIiwiYXV0aCIsImNvbnN0cnVjdG9yIiwiY29ubmVjdGVkIiwib3B0aW9ucyIsImhvc3QiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJwb3J0IiwiUmVjb25uZWN0IiwiSW50ZXJuYWxfTG9nX0xldmVsIiwidGltZW91dCIsImNvbm5lY3RfdGltZW91dCIsImlkbGVfdGltZW91dCIsImVuY3J5cHRpb24iLCJjYV9jZXJ0IiwicmVqZWN0X3VuYXV0aG9yaXplZCIsIkF1dGhlbnRpY2F0aW9uIiwiQXV0aGVudGljYXRpb25fVXNlckROIiwiQXV0aGVudGljYXRpb25fUGFzc3dvcmQiLCJCYXNlRE4iLCJVc2VyX1NlYXJjaF9GaWx0ZXIiLCJVc2VyX1NlYXJjaF9TY29wZSIsIlVzZXJfU2VhcmNoX0ZpZWxkIiwiU2VhcmNoX1BhZ2VfU2l6ZSIsIlNlYXJjaF9TaXplX0xpbWl0IiwiZ3JvdXBfZmlsdGVyX2VuYWJsZWQiLCJncm91cF9maWx0ZXJfb2JqZWN0X2NsYXNzIiwiZ3JvdXBfZmlsdGVyX2dyb3VwX2lkX2F0dHJpYnV0ZSIsImdyb3VwX2ZpbHRlcl9ncm91cF9tZW1iZXJfYXR0cmlidXRlIiwiZ3JvdXBfZmlsdGVyX2dyb3VwX21lbWJlcl9mb3JtYXQiLCJncm91cF9maWx0ZXJfZ3JvdXBfbmFtZSIsImNvbm5lY3RTeW5jIiwiYXJncyIsIl9jb25uZWN0U3luYyIsIk1ldGVvciIsIndyYXBBc3luYyIsImNvbm5lY3RBc3luYyIsInNlYXJjaEFsbFN5bmMiLCJfc2VhcmNoQWxsU3luYyIsInNlYXJjaEFsbEFzeW5jIiwiY2FsbGJhY2siLCJpbmZvIiwicmVwbGllZCIsImNvbm5lY3Rpb25PcHRpb25zIiwidXJsIiwiY29ubmVjdFRpbWVvdXQiLCJpZGxlVGltZW91dCIsInJlY29ubmVjdCIsImxvZyIsIm5hbWUiLCJjb21wb25lbnQiLCJzdHJlYW0iLCJwcm9jZXNzIiwic3RkZXJyIiwibGV2ZWwiLCJ0bHNPcHRpb25zIiwicmVqZWN0VW5hdXRob3JpemVkIiwiY2hhaW5MaW5lcyIsInNwbGl0IiwiY2VydCIsImNhIiwiZm9yRWFjaCIsImxpbmUiLCJwdXNoIiwibWF0Y2giLCJqb2luIiwiZGVidWciLCJjbGllbnQiLCJjcmVhdGVDbGllbnQiLCJiaW5kU3luYyIsIm9uIiwiZXJyb3IiLCJkaXNjb25uZWN0Iiwic3RhcnR0bHMiLCJyZXNwb25zZSIsInNldFRpbWVvdXQiLCJFcnJvciIsImdldFVzZXJGaWx0ZXIiLCJ1c2VybmFtZSIsImZpbHRlciIsInVzZXJuYW1lRmlsdGVyIiwibWFwIiwiaXRlbSIsImxlbmd0aCIsImJpbmRJZk5lY2Vzc2FyeSIsImRvbWFpbkJpbmRlZCIsInNlYXJjaFVzZXJzU3luYyIsInBhZ2UiLCJzZWFyY2hPcHRpb25zIiwic2NvcGUiLCJzaXplTGltaXQiLCJwYWdlZCIsInBhZ2VTaXplIiwicGFnZVBhdXNlIiwic2VhcmNoQWxsUGFnZWQiLCJnZXRVc2VyQnlJZFN5bmMiLCJpZCIsImF0dHJpYnV0ZSIsIlVuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkIiwiZmlsdGVycyIsIkVxdWFsaXR5RmlsdGVyIiwidmFsdWUiLCJCdWZmZXIiLCJPckZpbHRlciIsInRvU3RyaW5nIiwicmVzdWx0IiwiQXJyYXkiLCJpc0FycmF5IiwiZ2V0VXNlckJ5VXNlcm5hbWVTeW5jIiwiaXNVc2VySW5Hcm91cCIsInJlcGxhY2UiLCJleHRyYWN0TGRhcEVudHJ5RGF0YSIsImVudHJ5IiwidmFsdWVzIiwiX3JhdyIsInJhdyIsIk9iamVjdCIsImtleXMiLCJrZXkiLCJpbmNsdWRlcyIsInByb2Nlc3NQYWdlIiwiZW50cmllcyIsInRpdGxlIiwiZW5kIiwibmV4dCIsIl91cGRhdGVJZGxlIiwicmVzIiwiaW50ZXJuYWxQYWdlU2l6ZSIsImF1dGhTeW5jIiwiZG4iLCJwYXNzd29yZCIsInVuYmluZCIsInNsdWciLCJnZXRMZGFwVXNlcm5hbWUiLCJnZXRMZGFwVXNlclVuaXF1ZUlEIiwic3luY1VzZXJEYXRhIiwiYWRkTGRhcFVzZXIiLCJmYWxsYmFja0RlZmF1bHRBY2NvdW50U3lzdGVtIiwiaW5kZXhPZiIsImVtYWlsIiwibG9naW5SZXF1ZXN0IiwidXNlciIsImRpZ2VzdCIsIlNIQTI1NiIsImFsZ29yaXRobSIsIkFjY291bnRzIiwiX3J1bkxvZ2luSGFuZGxlcnMiLCJyZWdpc3RlckxvZ2luSGFuZGxlciIsImxkYXAiLCJsZGFwT3B0aW9ucyIsInVuZGVmaW5lZCIsImxkYXBQYXNzIiwic2VsZiIsImxkYXBVc2VyIiwidXNlcnMiLCJ1c2VyUXVlcnkiLCJmaW5kT25lIiwic3RhbXBlZFRva2VuIiwiX2dlbmVyYXRlU3RhbXBlZExvZ2luVG9rZW4iLCJ1cGRhdGUiLCJfaWQiLCIkcHVzaCIsIl9oYXNoU3RhbXBlZFRva2VuIiwic2V0UGFzc3dvcmQiLCJsb2dvdXQiLCJ1c2VySWQiLCJ0b2tlbiIsImFkZEdyb3VwIiwiZW5hYmxlUXVlcnkiLCJlbmFibGVBdXRoZW50aWNhdGlvbiIsImVuYWJsZVRMU1F1ZXJ5IiwiJGluIiwic3luY0RhdGFRdWVyeSIsImdyb3VwRmlsdGVyUXVlcnkiLCJiYWNrZ3JvdW5kU3luY1F1ZXJ5IiwiYWRkIiwidHlwZSIsInB1YmxpYyIsImkxOG5MYWJlbCIsIm11bHRpbGluZSIsImFjdGlvblRleHQiLCJzZWN0aW9uIiwiZ2V0UHJvcGVydHlWYWx1ZSIsImdldERhdGFUb1N5bmNVc2VyRGF0YSIsImltcG9ydE5ld1VzZXJzIiwiXyIsInRleHQiLCJzbHVnaWZ5Iiwib2JqIiwicmVkdWNlIiwiYWNjIiwiZWwiLCJlcnIiLCJ1c2VybmFtZUZpZWxkIiwiZmllbGQiLCJjb25jYXQiLCJmaW5kIiwiaXNFbXB0eSIsInN5bmNVc2VyRGF0YUZpZWxkTWFwIiwidHJpbSIsInVzZXJEYXRhIiwid2hpdGVsaXN0ZWRVc2VyRmllbGRzIiwiZmllbGRNYXAiLCJKU09OIiwicGFyc2UiLCJlbWFpbExpc3QiLCJ1c2VyRmllbGQiLCJsZGFwRmllbGQiLCJoYXNPd25Qcm9wZXJ0eSIsImlzT2JqZWN0IiwiYWRkcmVzcyIsInZlcmlmaWVkIiwib3V0ZXJLZXkiLCJpbm5lcktleXMiLCJjdXN0b21GaWVsZHNNZXRhIiwiZSIsInRtcFVzZXJGaWVsZCIsInRtcExkYXBGaWVsZCIsInRlbXBsYXRlVmFySGFuZGxlciIsImRLZXlzIiwibGFzdEtleSIsImxhc3QiLCJjdXJyS2V5Iiwic3RyaW5naWZ5IiwiZW1haWxzIiwidW5pcXVlSWQiLCJzZXJ2aWNlcyIsImlkQXR0cmlidXRlIiwic2l6ZSIsIl9zZXRSZWFsTmFtZSIsIiRzZXQiLCJfc2V0VXNlcm5hbWUiLCJhdmF0YXIiLCJ0aHVtYm5haWxQaG90byIsImpwZWdQaG90byIsInJzIiwiUm9ja2V0Q2hhdEZpbGUiLCJidWZmZXJUb1N0cmVhbSIsImZpbGVTdG9yZSIsIkZpbGVVcGxvYWQiLCJnZXRTdG9yZSIsImRlbGV0ZUJ5TmFtZSIsImZpbGUiLCJydW5Bc1VzZXIiLCJpbnNlcnQiLCJtb2RlbHMiLCJVc2VycyIsInNldEF2YXRhck9yaWdpbiIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlMb2dnZWQiLCJ1c2VyT2JqZWN0IiwibWFpbCIsImNyZWF0ZVVzZXIiLCJjb3VudCIsImJpbmRFbnZpcm9ubWVudCIsImxkYXBVc2VycyIsInN5bmMiLCJmaW5kTERBUFVzZXJzIiwiam9iTmFtZSIsImFkZENyb25Kb2IiLCJkZWJvdW5jZSIsImFkZENyb25Kb2JEZWJvdW5jZWQiLCJTeW5jZWRDcm9uIiwibmV4dFNjaGVkdWxlZEF0RGF0ZSIsInJlbW92ZSIsInNjaGVkdWxlIiwicGFyc2VyIiwiam9iIiwic3RhcnQiLCJzdGFydHVwIiwiZGVmZXIiLCJtZXRob2RzIiwibGRhcF9zeW5jX25vdyIsIm1ldGhvZCIsImF1dGh6IiwiaGFzUm9sZSIsInVuYmxvY2siLCJtZXNzYWdlIiwicGFyYW1zIiwibGRhcF90ZXN0X2Nvbm5lY3Rpb24iLCJjb25zb2xlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxnQkFBUixDQUFiO0FBQXdDRixPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiO0FBQW9DRixPQUFPQyxLQUFQLENBQWFDLFFBQVEsa0JBQVIsQ0FBYjtBQUEwQ0YsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLGFBQVIsQ0FBYjtBQUFxQ0YsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFFBQVIsQ0FBYixFOzs7Ozs7Ozs7OztBQ0EzSkYsT0FBT0csTUFBUCxDQUFjO0FBQUNDLFVBQVEsTUFBSUM7QUFBYixDQUFkO0FBQWtDLElBQUlDLE1BQUo7QUFBV04sT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFFBQVIsQ0FBYixFQUErQjtBQUFDRSxTQUFRRyxDQUFSLEVBQVU7QUFBQ0QsV0FBT0MsQ0FB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O0FBQ2YsU0FBTSxJQUFJckMsT0FBTzBDLEtBQVgsQ0FBaUJMLE1BQU10QixJQUFOLElBQWNzQixNQUFNOE0sT0FBckMsQ0FBTjtBQUNBOztBQUVELFNBQU87QUFDTkEsWUFBUyxvQkFESDtBQUVOQyxXQUFRO0FBRkYsR0FBUDtBQUlBOztBQWxDYSxDQUFmLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfbGRhcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAnLi9sb2dpbkhhbmRsZXInO1xuaW1wb3J0ICcuL3NldHRpbmdzJztcbmltcG9ydCAnLi90ZXN0Q29ubmVjdGlvbic7XG5pbXBvcnQgJy4vc3luY1VzZXJzJztcbmltcG9ydCAnLi9zeW5jJztcbiIsImltcG9ydCBsZGFwanMgZnJvbSAnbGRhcGpzJztcbmltcG9ydCBCdW55YW4gZnJvbSAnYnVueWFuJztcblxuY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcignTERBUCcsIHtcblx0c2VjdGlvbnM6IHtcblx0XHRjb25uZWN0aW9uOiAnQ29ubmVjdGlvbicsXG5cdFx0YmluZDogJ0JpbmQnLFxuXHRcdHNlYXJjaDogJ1NlYXJjaCcsXG5cdFx0YXV0aDogJ0F1dGgnXG5cdH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMREFQIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5sZGFwanMgPSBsZGFwanM7XG5cblx0XHR0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5vcHRpb25zID0ge1xuXHRcdFx0aG9zdDogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfSG9zdCcpLFxuXHRcdFx0cG9ydDogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfUG9ydCcpLFxuXHRcdFx0UmVjb25uZWN0OiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9SZWNvbm5lY3QnKSxcblx0XHRcdEludGVybmFsX0xvZ19MZXZlbDogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfSW50ZXJuYWxfTG9nX0xldmVsJyksXG5cdFx0XHR0aW1lb3V0OiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9UaW1lb3V0JyksXG5cdFx0XHRjb25uZWN0X3RpbWVvdXQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0Nvbm5lY3RfVGltZW91dCcpLFxuXHRcdFx0aWRsZV90aW1lb3V0OiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9JZGxlX1RpbWVvdXQnKSxcblx0XHRcdGVuY3J5cHRpb246IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0VuY3J5cHRpb24nKSxcblx0XHRcdGNhX2NlcnQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0NBX0NlcnQnKSxcblx0XHRcdHJlamVjdF91bmF1dGhvcml6ZWQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1JlamVjdF9VbmF1dGhvcml6ZWQnKSB8fCBmYWxzZSxcblx0XHRcdEF1dGhlbnRpY2F0aW9uOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9BdXRoZW50aWNhdGlvbicpLFxuXHRcdFx0QXV0aGVudGljYXRpb25fVXNlckROOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9BdXRoZW50aWNhdGlvbl9Vc2VyRE4nKSxcblx0XHRcdEF1dGhlbnRpY2F0aW9uX1Bhc3N3b3JkOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9BdXRoZW50aWNhdGlvbl9QYXNzd29yZCcpLFxuXHRcdFx0QmFzZUROOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9CYXNlRE4nKSxcblx0XHRcdFVzZXJfU2VhcmNoX0ZpbHRlcjogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfVXNlcl9TZWFyY2hfRmlsdGVyJyksXG5cdFx0XHRVc2VyX1NlYXJjaF9TY29wZTogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfVXNlcl9TZWFyY2hfU2NvcGUnKSxcblx0XHRcdFVzZXJfU2VhcmNoX0ZpZWxkOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9Vc2VyX1NlYXJjaF9GaWVsZCcpLFxuXHRcdFx0U2VhcmNoX1BhZ2VfU2l6ZTogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfU2VhcmNoX1BhZ2VfU2l6ZScpLFxuXHRcdFx0U2VhcmNoX1NpemVfTGltaXQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1NlYXJjaF9TaXplX0xpbWl0JyksXG5cdFx0XHRncm91cF9maWx0ZXJfZW5hYmxlZDogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfR3JvdXBfRmlsdGVyX0VuYWJsZScpLFxuXHRcdFx0Z3JvdXBfZmlsdGVyX29iamVjdF9jbGFzczogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfR3JvdXBfRmlsdGVyX09iamVjdENsYXNzJyksXG5cdFx0XHRncm91cF9maWx0ZXJfZ3JvdXBfaWRfYXR0cmlidXRlOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9Hcm91cF9GaWx0ZXJfR3JvdXBfSWRfQXR0cmlidXRlJyksXG5cdFx0XHRncm91cF9maWx0ZXJfZ3JvdXBfbWVtYmVyX2F0dHJpYnV0ZTogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfR3JvdXBfRmlsdGVyX0dyb3VwX01lbWJlcl9BdHRyaWJ1dGUnKSxcblx0XHRcdGdyb3VwX2ZpbHRlcl9ncm91cF9tZW1iZXJfZm9ybWF0OiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9Hcm91cF9GaWx0ZXJfR3JvdXBfTWVtYmVyX0Zvcm1hdCcpLFxuXHRcdFx0Z3JvdXBfZmlsdGVyX2dyb3VwX25hbWU6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0dyb3VwX0ZpbHRlcl9Hcm91cF9OYW1lJylcblx0XHR9O1xuXHR9XG5cblx0Y29ubmVjdFN5bmMoLi4uYXJncykge1xuXHRcdGlmICghdGhpcy5fY29ubmVjdFN5bmMpIHtcblx0XHRcdHRoaXMuX2Nvbm5lY3RTeW5jID0gTWV0ZW9yLndyYXBBc3luYyh0aGlzLmNvbm5lY3RBc3luYywgdGhpcyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9jb25uZWN0U3luYyguLi5hcmdzKTtcblx0fVxuXG5cdHNlYXJjaEFsbFN5bmMoLi4uYXJncykge1xuXHRcdGlmICghdGhpcy5fc2VhcmNoQWxsU3luYykge1xuXHRcdFx0dGhpcy5fc2VhcmNoQWxsU3luYyA9IE1ldGVvci53cmFwQXN5bmModGhpcy5zZWFyY2hBbGxBc3luYywgdGhpcyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9zZWFyY2hBbGxTeW5jKC4uLmFyZ3MpO1xuXHR9XG5cblx0Y29ubmVjdEFzeW5jKGNhbGxiYWNrKSB7XG5cdFx0bG9nZ2VyLmNvbm5lY3Rpb24uaW5mbygnSW5pdCBzZXR1cCcpO1xuXG5cdFx0bGV0IHJlcGxpZWQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IGNvbm5lY3Rpb25PcHRpb25zID0ge1xuXHRcdFx0dXJsOiBgJHsgdGhpcy5vcHRpb25zLmhvc3QgfTokeyB0aGlzLm9wdGlvbnMucG9ydCB9YCxcblx0XHRcdHRpbWVvdXQ6IHRoaXMub3B0aW9ucy50aW1lb3V0LFxuXHRcdFx0Y29ubmVjdFRpbWVvdXQ6IHRoaXMub3B0aW9ucy5jb25uZWN0X3RpbWVvdXQsXG5cdFx0XHRpZGxlVGltZW91dDogdGhpcy5vcHRpb25zLmlkbGVfdGltZW91dCxcblx0XHRcdHJlY29ubmVjdDogdGhpcy5vcHRpb25zLlJlY29ubmVjdFxuXHRcdH07XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLkludGVybmFsX0xvZ19MZXZlbCAhPT0gJ2Rpc2FibGVkJykge1xuXHRcdFx0Y29ubmVjdGlvbk9wdGlvbnMubG9nID0gbmV3IEJ1bnlhbih7XG5cdFx0XHRcdG5hbWU6ICdsZGFwanMnLFxuXHRcdFx0XHRjb21wb25lbnQ6ICdjbGllbnQnLFxuXHRcdFx0XHRzdHJlYW06IHByb2Nlc3Muc3RkZXJyLFxuXHRcdFx0XHRsZXZlbDogdGhpcy5vcHRpb25zLkludGVybmFsX0xvZ19MZXZlbFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGxzT3B0aW9ucyA9IHtcblx0XHRcdHJlamVjdFVuYXV0aG9yaXplZDogdGhpcy5vcHRpb25zLnJlamVjdF91bmF1dGhvcml6ZWRcblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jYV9jZXJ0ICYmIHRoaXMub3B0aW9ucy5jYV9jZXJ0ICE9PSAnJykge1xuXHRcdFx0Ly8gU3BsaXQgQ0EgY2VydCBpbnRvIGFycmF5IG9mIHN0cmluZ3Ncblx0XHRcdGNvbnN0IGNoYWluTGluZXMgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9DQV9DZXJ0Jykuc3BsaXQoJ1xcbicpO1xuXHRcdFx0bGV0IGNlcnQgPSBbXTtcblx0XHRcdGNvbnN0IGNhID0gW107XG5cdFx0XHRjaGFpbkxpbmVzLmZvckVhY2goKGxpbmUpID0+IHtcblx0XHRcdFx0Y2VydC5wdXNoKGxpbmUpO1xuXHRcdFx0XHRpZiAobGluZS5tYXRjaCgvLUVORCBDRVJUSUZJQ0FURS0vKSkge1xuXHRcdFx0XHRcdGNhLnB1c2goY2VydC5qb2luKCdcXG4nKSk7XG5cdFx0XHRcdFx0Y2VydCA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRsc09wdGlvbnMuY2EgPSBjYTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmVuY3J5cHRpb24gPT09ICdzc2wnKSB7XG5cdFx0XHRjb25uZWN0aW9uT3B0aW9ucy51cmwgPSBgbGRhcHM6Ly8keyBjb25uZWN0aW9uT3B0aW9ucy51cmwgfWA7XG5cdFx0XHRjb25uZWN0aW9uT3B0aW9ucy50bHNPcHRpb25zID0gdGxzT3B0aW9ucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29ubmVjdGlvbk9wdGlvbnMudXJsID0gYGxkYXA6Ly8keyBjb25uZWN0aW9uT3B0aW9ucy51cmwgfWA7XG5cdFx0fVxuXG5cdFx0bG9nZ2VyLmNvbm5lY3Rpb24uaW5mbygnQ29ubmVjdGluZycsIGNvbm5lY3Rpb25PcHRpb25zLnVybCk7XG5cdFx0bG9nZ2VyLmNvbm5lY3Rpb24uZGVidWcoJ2Nvbm5lY3Rpb25PcHRpb25zJywgY29ubmVjdGlvbk9wdGlvbnMpO1xuXG5cdFx0dGhpcy5jbGllbnQgPSBsZGFwanMuY3JlYXRlQ2xpZW50KGNvbm5lY3Rpb25PcHRpb25zKTtcblxuXHRcdHRoaXMuYmluZFN5bmMgPSBNZXRlb3Iud3JhcEFzeW5jKHRoaXMuY2xpZW50LmJpbmQsIHRoaXMuY2xpZW50KTtcblxuXHRcdHRoaXMuY2xpZW50Lm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuXHRcdFx0bG9nZ2VyLmNvbm5lY3Rpb24uZXJyb3IoJ2Nvbm5lY3Rpb24nLCBlcnJvcik7XG5cdFx0XHRpZiAocmVwbGllZCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0cmVwbGllZCA9IHRydWU7XG5cdFx0XHRcdGNhbGxiYWNrKGVycm9yLCBudWxsKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuY2xpZW50Lm9uKCdpZGxlJywgKCkgPT4ge1xuXHRcdFx0bG9nZ2VyLnNlYXJjaC5pbmZvKCdJZGxlJyk7XG5cdFx0XHR0aGlzLmRpc2Nvbm5lY3QoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuY2xpZW50Lm9uKCdjbG9zZScsICgpID0+IHtcblx0XHRcdGxvZ2dlci5zZWFyY2guaW5mbygnQ2xvc2VkJyk7XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmVuY3J5cHRpb24gPT09ICd0bHMnKSB7XG5cdFx0XHQvLyBTZXQgaG9zdCBwYXJhbWV0ZXIgZm9yIHRscy5jb25uZWN0IHdoaWNoIGlzIHVzZWQgYnkgbGRhcGpzIHN0YXJ0dGxzLiBUaGlzIHNob3VsZG4ndCBiZSBuZWVkZWQgaW4gbmV3ZXIgbm9kZWpzIHZlcnNpb25zIChlLmcgdjUuNi4wKS5cblx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9Sb2NrZXRDaGF0L1JvY2tldC5DaGF0L2lzc3Vlcy8yMDM1XG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWNhdmFnZS9ub2RlLWxkYXBqcy9pc3N1ZXMvMzQ5XG5cdFx0XHR0bHNPcHRpb25zLmhvc3QgPSB0aGlzLm9wdGlvbnMuaG9zdDtcblxuXHRcdFx0bG9nZ2VyLmNvbm5lY3Rpb24uaW5mbygnU3RhcnRpbmcgVExTJyk7XG5cdFx0XHRsb2dnZXIuY29ubmVjdGlvbi5kZWJ1ZygndGxzT3B0aW9ucycsIHRsc09wdGlvbnMpO1xuXG5cdFx0XHR0aGlzLmNsaWVudC5zdGFydHRscyh0bHNPcHRpb25zLCBudWxsLCAoZXJyb3IsIHJlc3BvbnNlKSA9PiB7XG5cdFx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRcdGxvZ2dlci5jb25uZWN0aW9uLmVycm9yKCdUTFMgY29ubmVjdGlvbicsIGVycm9yKTtcblx0XHRcdFx0XHRpZiAocmVwbGllZCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHRcdHJlcGxpZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2soZXJyb3IsIG51bGwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsb2dnZXIuY29ubmVjdGlvbi5pbmZvKCdUTFMgY29ubmVjdGVkJyk7XG5cdFx0XHRcdHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0aWYgKHJlcGxpZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0cmVwbGllZCA9IHRydWU7XG5cdFx0XHRcdFx0Y2FsbGJhY2sobnVsbCwgcmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jbGllbnQub24oJ2Nvbm5lY3QnLCAocmVzcG9uc2UpID0+IHtcblx0XHRcdFx0bG9nZ2VyLmNvbm5lY3Rpb24uaW5mbygnTERBUCBjb25uZWN0ZWQnKTtcblx0XHRcdFx0dGhpcy5jb25uZWN0ZWQgPSB0cnVlO1xuXHRcdFx0XHRpZiAocmVwbGllZCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHRyZXBsaWVkID0gdHJ1ZTtcblx0XHRcdFx0XHRjYWxsYmFjayhudWxsLCByZXNwb25zZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKHJlcGxpZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRcdGxvZ2dlci5jb25uZWN0aW9uLmVycm9yKCdjb25uZWN0aW9uIHRpbWUgb3V0JywgY29ubmVjdGlvbk9wdGlvbnMuY29ubmVjdFRpbWVvdXQpO1xuXHRcdFx0XHRyZXBsaWVkID0gdHJ1ZTtcblx0XHRcdFx0Y2FsbGJhY2sobmV3IEVycm9yKCdUaW1lb3V0JykpO1xuXHRcdFx0fVxuXHRcdH0sIGNvbm5lY3Rpb25PcHRpb25zLmNvbm5lY3RUaW1lb3V0KTtcblx0fVxuXG5cdGdldFVzZXJGaWx0ZXIodXNlcm5hbWUpIHtcblx0XHRjb25zdCBmaWx0ZXIgPSBbXTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuVXNlcl9TZWFyY2hfRmlsdGVyICE9PSAnJykge1xuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5Vc2VyX1NlYXJjaF9GaWx0ZXJbMF0gPT09ICcoJykge1xuXHRcdFx0XHRmaWx0ZXIucHVzaChgJHsgdGhpcy5vcHRpb25zLlVzZXJfU2VhcmNoX0ZpbHRlciB9YCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmaWx0ZXIucHVzaChgKCR7IHRoaXMub3B0aW9ucy5Vc2VyX1NlYXJjaF9GaWx0ZXIgfSlgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB1c2VybmFtZUZpbHRlciA9IHRoaXMub3B0aW9ucy5Vc2VyX1NlYXJjaF9GaWVsZC5zcGxpdCgnLCcpLm1hcChpdGVtID0+IGAoJHsgaXRlbSB9PSR7IHVzZXJuYW1lIH0pYCk7XG5cblx0XHRpZiAodXNlcm5hbWVGaWx0ZXIubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRsb2dnZXIuZXJyb3IoJ0xEQVBfTERBUF9Vc2VyX1NlYXJjaF9GaWVsZCBub3QgZGVmaW5lZCcpO1xuXHRcdH0gZWxzZSBpZiAodXNlcm5hbWVGaWx0ZXIubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRmaWx0ZXIucHVzaChgJHsgdXNlcm5hbWVGaWx0ZXJbMF0gfWApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaWx0ZXIucHVzaChgKHwkeyB1c2VybmFtZUZpbHRlci5qb2luKCcnKSB9KWApO1xuXHRcdH1cblxuXHRcdHJldHVybiBgKCYkeyBmaWx0ZXIuam9pbignJykgfSlgO1xuXHR9XG5cblx0YmluZElmTmVjZXNzYXJ5KCkge1xuXHRcdGlmICh0aGlzLmRvbWFpbkJpbmRlZCA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuQXV0aGVudGljYXRpb24gIT09IHRydWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsb2dnZXIuYmluZC5pbmZvKCdCaW5kaW5nIFVzZXJETicsIHRoaXMub3B0aW9ucy5BdXRoZW50aWNhdGlvbl9Vc2VyRE4pO1xuXHRcdHRoaXMuYmluZFN5bmModGhpcy5vcHRpb25zLkF1dGhlbnRpY2F0aW9uX1VzZXJETiwgdGhpcy5vcHRpb25zLkF1dGhlbnRpY2F0aW9uX1Bhc3N3b3JkKTtcblx0XHR0aGlzLmRvbWFpbkJpbmRlZCA9IHRydWU7XG5cdH1cblxuXHRzZWFyY2hVc2Vyc1N5bmModXNlcm5hbWUsIHBhZ2UpIHtcblx0XHR0aGlzLmJpbmRJZk5lY2Vzc2FyeSgpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoT3B0aW9ucyA9IHtcblx0XHRcdGZpbHRlcjogdGhpcy5nZXRVc2VyRmlsdGVyKHVzZXJuYW1lKSxcblx0XHRcdHNjb3BlOiB0aGlzLm9wdGlvbnMuVXNlcl9TZWFyY2hfU2NvcGUgfHwgJ3N1YicsXG5cdFx0XHRzaXplTGltaXQ6IHRoaXMub3B0aW9ucy5TZWFyY2hfU2l6ZV9MaW1pdFxuXHRcdH07XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLlNlYXJjaF9QYWdlX1NpemUgPiAwKSB7XG5cdFx0XHRzZWFyY2hPcHRpb25zLnBhZ2VkID0ge1xuXHRcdFx0XHRwYWdlU2l6ZTogdGhpcy5vcHRpb25zLlNlYXJjaF9QYWdlX1NpemUsXG5cdFx0XHRcdHBhZ2VQYXVzZTogISFwYWdlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGxvZ2dlci5zZWFyY2guaW5mbygnU2VhcmNoaW5nIHVzZXInLCB1c2VybmFtZSk7XG5cdFx0bG9nZ2VyLnNlYXJjaC5kZWJ1Zygnc2VhcmNoT3B0aW9ucycsIHNlYXJjaE9wdGlvbnMpO1xuXHRcdGxvZ2dlci5zZWFyY2guZGVidWcoJ0Jhc2VETicsIHRoaXMub3B0aW9ucy5CYXNlRE4pO1xuXG5cdFx0aWYgKHBhZ2UpIHtcblx0XHRcdHJldHVybiB0aGlzLnNlYXJjaEFsbFBhZ2VkKHRoaXMub3B0aW9ucy5CYXNlRE4sIHNlYXJjaE9wdGlvbnMsIHBhZ2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnNlYXJjaEFsbFN5bmModGhpcy5vcHRpb25zLkJhc2VETiwgc2VhcmNoT3B0aW9ucyk7XG5cdH1cblxuXHRnZXRVc2VyQnlJZFN5bmMoaWQsIGF0dHJpYnV0ZSkge1xuXHRcdHRoaXMuYmluZElmTmVjZXNzYXJ5KCk7XG5cblx0XHRjb25zdCBVbmlxdWVfSWRlbnRpZmllcl9GaWVsZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1VuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkJykuc3BsaXQoJywnKTtcblxuXHRcdGxldCBmaWx0ZXI7XG5cblx0XHRpZiAoYXR0cmlidXRlKSB7XG5cdFx0XHRmaWx0ZXIgPSBuZXcgdGhpcy5sZGFwanMuZmlsdGVycy5FcXVhbGl0eUZpbHRlcih7XG5cdFx0XHRcdGF0dHJpYnV0ZSxcblx0XHRcdFx0dmFsdWU6IG5ldyBCdWZmZXIoaWQsICdoZXgnKVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZpbHRlcnMgPSBbXTtcblx0XHRcdFVuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkLmZvckVhY2goKGl0ZW0pID0+IHtcblx0XHRcdFx0ZmlsdGVycy5wdXNoKG5ldyB0aGlzLmxkYXBqcy5maWx0ZXJzLkVxdWFsaXR5RmlsdGVyKHtcblx0XHRcdFx0XHRhdHRyaWJ1dGU6IGl0ZW0sXG5cdFx0XHRcdFx0dmFsdWU6IG5ldyBCdWZmZXIoaWQsICdoZXgnKVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0ZmlsdGVyID0gbmV3IHRoaXMubGRhcGpzLmZpbHRlcnMuT3JGaWx0ZXIoe2ZpbHRlcnN9KTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWFyY2hPcHRpb25zID0ge1xuXHRcdFx0ZmlsdGVyLFxuXHRcdFx0c2NvcGU6ICdzdWInXG5cdFx0fTtcblxuXHRcdGxvZ2dlci5zZWFyY2guaW5mbygnU2VhcmNoaW5nIGJ5IGlkJywgaWQpO1xuXHRcdGxvZ2dlci5zZWFyY2guZGVidWcoJ3NlYXJjaCBmaWx0ZXInLCBzZWFyY2hPcHRpb25zLmZpbHRlci50b1N0cmluZygpKTtcblx0XHRsb2dnZXIuc2VhcmNoLmRlYnVnKCdCYXNlRE4nLCB0aGlzLm9wdGlvbnMuQmFzZUROKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuc2VhcmNoQWxsU3luYyh0aGlzLm9wdGlvbnMuQmFzZUROLCBzZWFyY2hPcHRpb25zKTtcblxuXHRcdGlmICghQXJyYXkuaXNBcnJheShyZXN1bHQpIHx8IHJlc3VsdC5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAocmVzdWx0Lmxlbmd0aCA+IDEpIHtcblx0XHRcdGxvZ2dlci5zZWFyY2guZXJyb3IoJ1NlYXJjaCBieSBpZCcsIGlkLCAncmV0dXJuZWQnLCByZXN1bHQubGVuZ3RoLCAncmVjb3JkcycpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHRbMF07XG5cdH1cblxuXHRnZXRVc2VyQnlVc2VybmFtZVN5bmModXNlcm5hbWUpIHtcblx0XHR0aGlzLmJpbmRJZk5lY2Vzc2FyeSgpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoT3B0aW9ucyA9IHtcblx0XHRcdGZpbHRlcjogdGhpcy5nZXRVc2VyRmlsdGVyKHVzZXJuYW1lKSxcblx0XHRcdHNjb3BlOiB0aGlzLm9wdGlvbnMuVXNlcl9TZWFyY2hfU2NvcGUgfHwgJ3N1Yidcblx0XHR9O1xuXG5cdFx0bG9nZ2VyLnNlYXJjaC5pbmZvKCdTZWFyY2hpbmcgdXNlcicsIHVzZXJuYW1lKTtcblx0XHRsb2dnZXIuc2VhcmNoLmRlYnVnKCdzZWFyY2hPcHRpb25zJywgc2VhcmNoT3B0aW9ucyk7XG5cdFx0bG9nZ2VyLnNlYXJjaC5kZWJ1ZygnQmFzZUROJywgdGhpcy5vcHRpb25zLkJhc2VETik7XG5cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLnNlYXJjaEFsbFN5bmModGhpcy5vcHRpb25zLkJhc2VETiwgc2VhcmNoT3B0aW9ucyk7XG5cblx0XHRpZiAoIUFycmF5LmlzQXJyYXkocmVzdWx0KSB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3VsdC5sZW5ndGggPiAxKSB7XG5cdFx0XHRsb2dnZXIuc2VhcmNoLmVycm9yKCdTZWFyY2ggYnkgdXNlcm5hbWUnLCB1c2VybmFtZSwgJ3JldHVybmVkJywgcmVzdWx0Lmxlbmd0aCwgJ3JlY29yZHMnKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0WzBdO1xuXHR9XG5cblx0aXNVc2VySW5Hcm91cCh1c2VybmFtZSkge1xuXHRcdGlmICghdGhpcy5vcHRpb25zLmdyb3VwX2ZpbHRlcl9lbmFibGVkKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBmaWx0ZXIgPSBbJygmJ107XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmdyb3VwX2ZpbHRlcl9vYmplY3RfY2xhc3MgIT09ICcnKSB7XG5cdFx0XHRmaWx0ZXIucHVzaChgKG9iamVjdGNsYXNzPSR7IHRoaXMub3B0aW9ucy5ncm91cF9maWx0ZXJfb2JqZWN0X2NsYXNzIH0pYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5ncm91cF9maWx0ZXJfZ3JvdXBfbWVtYmVyX2F0dHJpYnV0ZSAhPT0gJycpIHtcblx0XHRcdGZpbHRlci5wdXNoKGAoJHsgdGhpcy5vcHRpb25zLmdyb3VwX2ZpbHRlcl9ncm91cF9tZW1iZXJfYXR0cmlidXRlIH09JHsgdGhpcy5vcHRpb25zLmdyb3VwX2ZpbHRlcl9ncm91cF9tZW1iZXJfZm9ybWF0IH0pYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5ncm91cF9maWx0ZXJfZ3JvdXBfaWRfYXR0cmlidXRlICE9PSAnJykge1xuXHRcdFx0ZmlsdGVyLnB1c2goYCgkeyB0aGlzLm9wdGlvbnMuZ3JvdXBfZmlsdGVyX2dyb3VwX2lkX2F0dHJpYnV0ZSB9PSR7IHRoaXMub3B0aW9ucy5ncm91cF9maWx0ZXJfZ3JvdXBfbmFtZSB9KWApO1xuXHRcdH1cblx0XHRmaWx0ZXIucHVzaCgnKScpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoT3B0aW9ucyA9IHtcblx0XHRcdGZpbHRlcjogZmlsdGVyLmpvaW4oJycpLnJlcGxhY2UoLyN7dXNlcm5hbWV9L2csIHVzZXJuYW1lKSxcblx0XHRcdHNjb3BlOiAnc3ViJ1xuXHRcdH07XG5cblx0XHRsb2dnZXIuc2VhcmNoLmRlYnVnKCdHcm91cCBmaWx0ZXIgTERBUDonLCBzZWFyY2hPcHRpb25zLmZpbHRlcik7XG5cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLnNlYXJjaEFsbFN5bmModGhpcy5vcHRpb25zLkJhc2VETiwgc2VhcmNoT3B0aW9ucyk7XG5cblx0XHRpZiAoIUFycmF5LmlzQXJyYXkocmVzdWx0KSB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZXh0cmFjdExkYXBFbnRyeURhdGEoZW50cnkpIHtcblx0XHRjb25zdCB2YWx1ZXMgPSB7XG5cdFx0XHRfcmF3OiBlbnRyeS5yYXdcblx0XHR9O1xuXG5cdFx0T2JqZWN0LmtleXModmFsdWVzLl9yYXcpLmZvckVhY2goKGtleSkgPT4ge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSB2YWx1ZXMuX3Jhd1trZXldO1xuXG5cdFx0XHRpZiAoIVsndGh1bWJuYWlsUGhvdG8nLCAnanBlZ1Bob3RvJ10uaW5jbHVkZXMoa2V5KSkge1xuXHRcdFx0XHRpZiAodmFsdWUgaW5zdGFuY2VvZiBCdWZmZXIpIHtcblx0XHRcdFx0XHR2YWx1ZXNba2V5XSA9IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFsdWVzW2tleV0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHZhbHVlcztcblx0fVxuXG5cdHNlYXJjaEFsbFBhZ2VkKEJhc2VETiwgb3B0aW9ucywgcGFnZSkge1xuXHRcdHRoaXMuYmluZElmTmVjZXNzYXJ5KCk7XG5cblx0XHRjb25zdCBwcm9jZXNzUGFnZSA9ICh7ZW50cmllcywgdGl0bGUsIGVuZCwgbmV4dH0pID0+IHtcblx0XHRcdGxvZ2dlci5zZWFyY2guaW5mbyh0aXRsZSk7XG5cdFx0XHQvLyBGb3JjZSBMREFQIGlkbGUgdG8gd2FpdCB0aGUgcmVjb3JkIHByb2Nlc3Npbmdcblx0XHRcdHRoaXMuY2xpZW50Ll91cGRhdGVJZGxlKHRydWUpO1xuXHRcdFx0cGFnZShudWxsLCBlbnRyaWVzLCB7ZW5kLCBuZXh0OiAoKSA9PiB7XG5cdFx0XHRcdC8vIFJlc2V0IGlkbGUgdGltZXJcblx0XHRcdFx0dGhpcy5jbGllbnQuX3VwZGF0ZUlkbGUoKTtcblx0XHRcdFx0bmV4dCAmJiBuZXh0KCk7XG5cdFx0XHR9fSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuY2xpZW50LnNlYXJjaChCYXNlRE4sIG9wdGlvbnMsIChlcnJvciwgcmVzKSA9PiB7XG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0bG9nZ2VyLnNlYXJjaC5lcnJvcihlcnJvcik7XG5cdFx0XHRcdHBhZ2UoZXJyb3IpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJlcy5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcblx0XHRcdFx0bG9nZ2VyLnNlYXJjaC5lcnJvcihlcnJvcik7XG5cdFx0XHRcdHBhZ2UoZXJyb3IpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IGVudHJpZXMgPSBbXTtcblxuXHRcdFx0Y29uc3QgaW50ZXJuYWxQYWdlU2l6ZSA9IG9wdGlvbnMucGFnZWQgJiYgb3B0aW9ucy5wYWdlZC5wYWdlU2l6ZSA+IDAgPyBvcHRpb25zLnBhZ2VkLnBhZ2VTaXplICogMiA6IDUwMDtcblxuXHRcdFx0cmVzLm9uKCdzZWFyY2hFbnRyeScsIChlbnRyeSkgPT4ge1xuXHRcdFx0XHRlbnRyaWVzLnB1c2godGhpcy5leHRyYWN0TGRhcEVudHJ5RGF0YShlbnRyeSkpO1xuXG5cdFx0XHRcdGlmIChlbnRyaWVzLmxlbmd0aCA+PSBpbnRlcm5hbFBhZ2VTaXplKSB7XG5cdFx0XHRcdFx0cHJvY2Vzc1BhZ2Uoe1xuXHRcdFx0XHRcdFx0ZW50cmllcyxcblx0XHRcdFx0XHRcdHRpdGxlOiAnSW50ZXJuYWwgUGFnZScsXG5cdFx0XHRcdFx0XHRlbmQ6IGZhbHNlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZW50cmllcyA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0cmVzLm9uKCdwYWdlJywgKHJlc3VsdCwgbmV4dCkgPT4ge1xuXHRcdFx0XHRpZiAoIW5leHQpIHtcblx0XHRcdFx0XHR0aGlzLmNsaWVudC5fdXBkYXRlSWRsZSh0cnVlKTtcblx0XHRcdFx0XHRwcm9jZXNzUGFnZSh7XG5cdFx0XHRcdFx0XHRlbnRyaWVzLFxuXHRcdFx0XHRcdFx0dGl0bGU6ICdGaW5hbCBQYWdlJyxcblx0XHRcdFx0XHRcdGVuZDogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJpZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0bG9nZ2VyLnNlYXJjaC5pbmZvKCdQYWdlJyk7XG5cdFx0XHRcdFx0cHJvY2Vzc1BhZ2Uoe1xuXHRcdFx0XHRcdFx0ZW50cmllcyxcblx0XHRcdFx0XHRcdHRpdGxlOiAnUGFnZScsXG5cdFx0XHRcdFx0XHRlbmQ6IGZhbHNlLFxuXHRcdFx0XHRcdFx0bmV4dFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGVudHJpZXMgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHJlcy5vbignZW5kJywgKCkgPT4ge1xuXHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRwcm9jZXNzUGFnZSh7XG5cdFx0XHRcdFx0XHRlbnRyaWVzLFxuXHRcdFx0XHRcdFx0dGl0bGU6ICdGaW5hbCBQYWdlJyxcblx0XHRcdFx0XHRcdGVuZDogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGVudHJpZXMgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRzZWFyY2hBbGxBc3luYyhCYXNlRE4sIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG5cdFx0dGhpcy5iaW5kSWZOZWNlc3NhcnkoKTtcblxuXHRcdHRoaXMuY2xpZW50LnNlYXJjaChCYXNlRE4sIG9wdGlvbnMsIChlcnJvciwgcmVzKSA9PiB7XG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0bG9nZ2VyLnNlYXJjaC5lcnJvcihlcnJvcik7XG5cdFx0XHRcdGNhbGxiYWNrKGVycm9yKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXMub24oJ2Vycm9yJywgKGVycm9yKSA9PiB7XG5cdFx0XHRcdGxvZ2dlci5zZWFyY2guZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRjYWxsYmFjayhlcnJvcik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBlbnRyaWVzID0gW107XG5cblx0XHRcdHJlcy5vbignc2VhcmNoRW50cnknLCAoZW50cnkpID0+IHtcblx0XHRcdFx0ZW50cmllcy5wdXNoKHRoaXMuZXh0cmFjdExkYXBFbnRyeURhdGEoZW50cnkpKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXMub24oJ2VuZCcsICgpID0+IHtcblx0XHRcdFx0bG9nZ2VyLnNlYXJjaC5pbmZvKCdTZWFyY2ggcmVzdWx0IGNvdW50JywgZW50cmllcy5sZW5ndGgpO1xuXHRcdFx0XHRjYWxsYmFjayhudWxsLCBlbnRyaWVzKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0YXV0aFN5bmMoZG4sIHBhc3N3b3JkKSB7XG5cdFx0bG9nZ2VyLmF1dGguaW5mbygnQXV0aGVudGljYXRpbmcnLCBkbik7XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5iaW5kU3luYyhkbiwgcGFzc3dvcmQpO1xuXHRcdFx0bG9nZ2VyLmF1dGguaW5mbygnQXV0aGVudGljYXRlZCcsIGRuKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRsb2dnZXIuYXV0aC5pbmZvKCdOb3QgYXV0aGVudGljYXRlZCcsIGRuKTtcblx0XHRcdGxvZ2dlci5hdXRoLmRlYnVnKCdlcnJvcicsIGVycm9yKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRkaXNjb25uZWN0KCkge1xuXHRcdHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5kb21haW5CaW5kZWQgPSBmYWxzZTtcblx0XHRsb2dnZXIuY29ubmVjdGlvbi5pbmZvKCdEaXNjb25lY3RpbmcnKTtcblx0XHR0aGlzLmNsaWVudC51bmJpbmQoKTtcblx0fVxufVxuIiwiLyogZXNsaW50IG5ldy1jYXA6IFsyLCB7XCJjYXBJc05ld0V4Y2VwdGlvbnNcIjogW1wiU0hBMjU2XCJdfV0gKi9cblxuaW1wb3J0IHtzbHVnLCBnZXRMZGFwVXNlcm5hbWUsIGdldExkYXBVc2VyVW5pcXVlSUQsIHN5bmNVc2VyRGF0YSwgYWRkTGRhcFVzZXJ9IGZyb20gJy4vc3luYyc7XG5pbXBvcnQgTERBUCBmcm9tICcuL2xkYXAnO1xuXG5jb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdMREFQSGFuZGxlcicsIHt9KTtcblxuZnVuY3Rpb24gZmFsbGJhY2tEZWZhdWx0QWNjb3VudFN5c3RlbShiaW5kLCB1c2VybmFtZSwgcGFzc3dvcmQpIHtcblx0aWYgKHR5cGVvZiB1c2VybmFtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRpZiAodXNlcm5hbWUuaW5kZXhPZignQCcpID09PSAtMSkge1xuXHRcdFx0dXNlcm5hbWUgPSB7dXNlcm5hbWV9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1c2VybmFtZSA9IHtlbWFpbDogdXNlcm5hbWV9O1xuXHRcdH1cblx0fVxuXG5cdGxvZ2dlci5pbmZvKCdGYWxsYmFjayB0byBkZWZhdWx0IGFjY291bnQgc3lzdGVtJywgdXNlcm5hbWUpO1xuXG5cdGNvbnN0IGxvZ2luUmVxdWVzdCA9IHtcblx0XHR1c2VyOiB1c2VybmFtZSxcblx0XHRwYXNzd29yZDoge1xuXHRcdFx0ZGlnZXN0OiBTSEEyNTYocGFzc3dvcmQpLFxuXHRcdFx0YWxnb3JpdGhtOiAnc2hhLTI1Nidcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIEFjY291bnRzLl9ydW5Mb2dpbkhhbmRsZXJzKGJpbmQsIGxvZ2luUmVxdWVzdCk7XG59XG5cbkFjY291bnRzLnJlZ2lzdGVyTG9naW5IYW5kbGVyKCdsZGFwJywgZnVuY3Rpb24obG9naW5SZXF1ZXN0KSB7XG5cdGlmICghbG9naW5SZXF1ZXN0LmxkYXAgfHwgIWxvZ2luUmVxdWVzdC5sZGFwT3B0aW9ucykge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRsb2dnZXIuaW5mbygnSW5pdCBMREFQIGxvZ2luJywgbG9naW5SZXF1ZXN0LnVzZXJuYW1lKTtcblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfRW5hYmxlJykgIT09IHRydWUpIHtcblx0XHRyZXR1cm4gZmFsbGJhY2tEZWZhdWx0QWNjb3VudFN5c3RlbSh0aGlzLCBsb2dpblJlcXVlc3QudXNlcm5hbWUsIGxvZ2luUmVxdWVzdC5sZGFwUGFzcyk7XG5cdH1cblxuXHRjb25zdCBzZWxmID0gdGhpcztcblx0Y29uc3QgbGRhcCA9IG5ldyBMREFQKCk7XG5cdGxldCBsZGFwVXNlcjtcblxuXHR0cnkge1xuXHRcdGxkYXAuY29ubmVjdFN5bmMoKTtcblx0XHRjb25zdCB1c2VycyA9IGxkYXAuc2VhcmNoVXNlcnNTeW5jKGxvZ2luUmVxdWVzdC51c2VybmFtZSk7XG5cblx0XHRpZiAodXNlcnMubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRsb2dnZXIuaW5mbygnU2VhcmNoIHJldHVybmVkJywgdXNlcnMubGVuZ3RoLCAncmVjb3JkKHMpIGZvcicsIGxvZ2luUmVxdWVzdC51c2VybmFtZSk7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzZXIgbm90IEZvdW5kJyk7XG5cdFx0fVxuXG5cdFx0aWYgKGxkYXAuYXV0aFN5bmModXNlcnNbMF0uZG4sIGxvZ2luUmVxdWVzdC5sZGFwUGFzcykgPT09IHRydWUpIHtcblx0XHRcdGlmIChsZGFwLmlzVXNlckluR3JvdXAgKGxvZ2luUmVxdWVzdC51c2VybmFtZSkpIHtcblx0XHRcdFx0bGRhcFVzZXIgPSB1c2Vyc1swXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVXNlciBub3QgaW4gYSB2YWxpZCBncm91cCcpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRsb2dnZXIuaW5mbygnV3JvbmcgcGFzc3dvcmQgZm9yJywgbG9naW5SZXF1ZXN0LnVzZXJuYW1lKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0bG9nZ2VyLmVycm9yKGVycm9yKTtcblx0fVxuXG5cdGlmIChsZGFwVXNlciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0xvZ2luX0ZhbGxiYWNrJykgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBmYWxsYmFja0RlZmF1bHRBY2NvdW50U3lzdGVtKHNlbGYsIGxvZ2luUmVxdWVzdC51c2VybmFtZSwgbG9naW5SZXF1ZXN0LmxkYXBQYXNzKTtcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdMREFQLWxvZ2luLWVycm9yJywgYExEQVAgQXV0aGVudGljYXRpb24gZmFpbGVkIHdpdGggcHJvdmlkZWQgdXNlcm5hbWUgWyR7IGxvZ2luUmVxdWVzdC51c2VybmFtZSB9XWApO1xuXHR9XG5cblx0Ly8gTG9vayB0byBzZWUgaWYgdXNlciBhbHJlYWR5IGV4aXN0c1xuXHRsZXQgdXNlclF1ZXJ5O1xuXG5cdGNvbnN0IFVuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkID0gZ2V0TGRhcFVzZXJVbmlxdWVJRChsZGFwVXNlcik7XG5cdGxldCB1c2VyO1xuXG5cdGlmIChVbmlxdWVfSWRlbnRpZmllcl9GaWVsZCkge1xuXHRcdHVzZXJRdWVyeSA9IHtcblx0XHRcdCdzZXJ2aWNlcy5sZGFwLmlkJzogVW5pcXVlX0lkZW50aWZpZXJfRmllbGQudmFsdWVcblx0XHR9O1xuXG5cdFx0bG9nZ2VyLmluZm8oJ1F1ZXJ5aW5nIHVzZXInKTtcblx0XHRsb2dnZXIuZGVidWcoJ3VzZXJRdWVyeScsIHVzZXJRdWVyeSk7XG5cblx0XHR1c2VyID0gTWV0ZW9yLnVzZXJzLmZpbmRPbmUodXNlclF1ZXJ5KTtcblx0fVxuXG5cdGxldCB1c2VybmFtZTtcblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfVXNlcm5hbWVfRmllbGQnKSAhPT0gJycpIHtcblx0XHR1c2VybmFtZSA9IHNsdWcoZ2V0TGRhcFVzZXJuYW1lKGxkYXBVc2VyKSk7XG5cdH0gZWxzZSB7XG5cdFx0dXNlcm5hbWUgPSBzbHVnKGxvZ2luUmVxdWVzdC51c2VybmFtZSk7XG5cdH1cblxuXHRpZiAoIXVzZXIpIHtcblx0XHR1c2VyUXVlcnkgPSB7XG5cdFx0XHR1c2VybmFtZVxuXHRcdH07XG5cblx0XHRsb2dnZXIuZGVidWcoJ3VzZXJRdWVyeScsIHVzZXJRdWVyeSk7XG5cblx0XHR1c2VyID0gTWV0ZW9yLnVzZXJzLmZpbmRPbmUodXNlclF1ZXJ5KTtcblx0fVxuXG5cdC8vIExvZ2luIHVzZXIgaWYgdGhleSBleGlzdFxuXHRpZiAodXNlcikge1xuXHRcdGlmICh1c2VyLmxkYXAgIT09IHRydWUgJiYgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfTWVyZ2VfRXhpc3RpbmdfVXNlcnMnKSAhPT0gdHJ1ZSkge1xuXHRcdFx0bG9nZ2VyLmluZm8oJ1VzZXIgZXhpc3RzIHdpdGhvdXQgXCJsZGFwOiB0cnVlXCInKTtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ0xEQVAtbG9naW4tZXJyb3InLCBgTERBUCBBdXRoZW50aWNhdGlvbiBzdWNjZWRlZCwgYnV0IHRoZXJlJ3MgYWxyZWFkeSBhbiBleGlzdGluZyB1c2VyIHdpdGggcHJvdmlkZWQgdXNlcm5hbWUgWyR7IHVzZXJuYW1lIH1dIGluIE1vbmdvLmApO1xuXHRcdH1cblxuXHRcdGxvZ2dlci5pbmZvKCdMb2dnaW5nIHVzZXInKTtcblxuXHRcdGNvbnN0IHN0YW1wZWRUb2tlbiA9IEFjY291bnRzLl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuKCk7XG5cblx0XHRNZXRlb3IudXNlcnMudXBkYXRlKHVzZXIuX2lkLCB7XG5cdFx0XHQkcHVzaDoge1xuXHRcdFx0XHQnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zJzogQWNjb3VudHMuX2hhc2hTdGFtcGVkVG9rZW4oc3RhbXBlZFRva2VuKVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0c3luY1VzZXJEYXRhKHVzZXIsIGxkYXBVc2VyKTtcblxuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9Mb2dpbl9GYWxsYmFjaycpID09PSB0cnVlKSB7XG5cdFx0XHRBY2NvdW50cy5zZXRQYXNzd29yZCh1c2VyLl9pZCwgbG9naW5SZXF1ZXN0LmxkYXBQYXNzLCB7bG9nb3V0OiBmYWxzZX0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR1c2VySWQ6IHVzZXIuX2lkLFxuXHRcdFx0dG9rZW46IHN0YW1wZWRUb2tlbi50b2tlblxuXHRcdH07XG5cdH1cblxuXHRsb2dnZXIuaW5mbygnVXNlciBkb2VzIG5vdCBleGlzdCwgY3JlYXRpbmcnLCB1c2VybmFtZSk7XG5cblx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1VzZXJuYW1lX0ZpZWxkJykgPT09ICcnKSB7XG5cdFx0dXNlcm5hbWUgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfTG9naW5fRmFsbGJhY2snKSAhPT0gdHJ1ZSkge1xuXHRcdGxvZ2luUmVxdWVzdC5sZGFwUGFzcyA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8vIENyZWF0ZSBuZXcgdXNlclxuXHRjb25zdCByZXN1bHQgPSBhZGRMZGFwVXNlcihsZGFwVXNlciwgdXNlcm5hbWUsIGxvZ2luUmVxdWVzdC5sZGFwUGFzcyk7XG5cblx0aWYgKHJlc3VsdCBpbnN0YW5jZW9mIEVycm9yKSB7XG5cdFx0dGhyb3cgcmVzdWx0O1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn0pO1xuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnTERBUCcsIGZ1bmN0aW9uKCkge1xuXHRjb25zdCBlbmFibGVRdWVyeSA9IHtfaWQ6ICdMREFQX0VuYWJsZScsIHZhbHVlOiB0cnVlfTtcblx0Y29uc3QgZW5hYmxlQXV0aGVudGljYXRpb24gPSBbXG5cdFx0ZW5hYmxlUXVlcnksXG5cdFx0e19pZDogJ0xEQVBfQXV0aGVudGljYXRpb24nLCB2YWx1ZTogdHJ1ZX1cblx0XTtcblx0Y29uc3QgZW5hYmxlVExTUXVlcnkgPSBbXG5cdFx0ZW5hYmxlUXVlcnksXG5cdFx0e19pZDogJ0xEQVBfRW5jcnlwdGlvbicsIHZhbHVlOiB7JGluOiBbJ3RscycsICdzc2wnXX19XG5cdF07XG5cdGNvbnN0IHN5bmNEYXRhUXVlcnkgPSBbXG5cdFx0ZW5hYmxlUXVlcnksXG5cdFx0e19pZDogJ0xEQVBfU3luY19Vc2VyX0RhdGEnLCB2YWx1ZTogdHJ1ZX1cblx0XTtcblx0Y29uc3QgZ3JvdXBGaWx0ZXJRdWVyeSA9IFtcblx0XHRlbmFibGVRdWVyeSxcblx0XHR7X2lkOiAnTERBUF9Hcm91cF9GaWx0ZXJfRW5hYmxlJywgdmFsdWU6IHRydWV9XG5cdF07XG5cdGNvbnN0IGJhY2tncm91bmRTeW5jUXVlcnkgPSBbXG5cdFx0ZW5hYmxlUXVlcnksXG5cdFx0e19pZDogJ0xEQVBfQmFja2dyb3VuZF9TeW5jJywgdmFsdWU6IHRydWV9XG5cdF07XG5cblx0dGhpcy5hZGQoJ0xEQVBfRW5hYmxlJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBwdWJsaWM6IHRydWUgfSk7XG5cdHRoaXMuYWRkKCdMREFQX0xvZ2luX0ZhbGxiYWNrJywgdHJ1ZSwgeyB0eXBlOiAnYm9vbGVhbicsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR0aGlzLmFkZCgnTERBUF9Ib3N0JywgJycsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR0aGlzLmFkZCgnTERBUF9Qb3J0JywgJzM4OScsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR0aGlzLmFkZCgnTERBUF9SZWNvbm5lY3QnLCBmYWxzZSwgeyB0eXBlOiAnYm9vbGVhbicsIGVuYWJsZVF1ZXJ5IH0pO1xuXHR0aGlzLmFkZCgnTERBUF9FbmNyeXB0aW9uJywgJ3BsYWluJywgeyB0eXBlOiAnc2VsZWN0JywgdmFsdWVzOiBbIHsga2V5OiAncGxhaW4nLCBpMThuTGFiZWw6ICdOb19FbmNyeXB0aW9uJyB9LCB7IGtleTogJ3RscycsIGkxOG5MYWJlbDogJ1N0YXJ0VExTJyB9LCB7IGtleTogJ3NzbCcsIGkxOG5MYWJlbDogJ1NTTC9MREFQUycgfSBdLCBlbmFibGVRdWVyeSB9KTtcblx0dGhpcy5hZGQoJ0xEQVBfQ0FfQ2VydCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBtdWx0aWxpbmU6IHRydWUsIGVuYWJsZVF1ZXJ5OiBlbmFibGVUTFNRdWVyeSB9KTtcblx0dGhpcy5hZGQoJ0xEQVBfUmVqZWN0X1VuYXV0aG9yaXplZCcsIHRydWUsIHsgdHlwZTogJ2Jvb2xlYW4nLCBlbmFibGVRdWVyeTogZW5hYmxlVExTUXVlcnkgfSk7XG5cdHRoaXMuYWRkKCdMREFQX0Jhc2VETicsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeSB9KTtcblx0dGhpcy5hZGQoJ0xEQVBfSW50ZXJuYWxfTG9nX0xldmVsJywgJ2Rpc2FibGVkJywge1xuXHRcdHR5cGU6ICdzZWxlY3QnLFxuXHRcdHZhbHVlczogW1xuXHRcdFx0eyBrZXk6ICdkaXNhYmxlZCcsIGkxOG5MYWJlbDogJ0Rpc2FibGVkJyB9LFxuXHRcdFx0eyBrZXk6ICdlcnJvcicsIGkxOG5MYWJlbDogJ0Vycm9yJyB9LFxuXHRcdFx0eyBrZXk6ICd3YXJuJywgaTE4bkxhYmVsOiAnV2FybicgfSxcblx0XHRcdHsga2V5OiAnaW5mbycsIGkxOG5MYWJlbDogJ0luZm8nIH0sXG5cdFx0XHR7IGtleTogJ2RlYnVnJywgaTE4bkxhYmVsOiAnRGVidWcnIH0sXG5cdFx0XHR7IGtleTogJ3RyYWNlJywgaTE4bkxhYmVsOiAnVHJhY2UnIH1cblx0XHRdLFxuXHRcdGVuYWJsZVF1ZXJ5XG5cdH0pO1xuXHR0aGlzLmFkZCgnTERBUF9UZXN0X0Nvbm5lY3Rpb24nLCAnbGRhcF90ZXN0X2Nvbm5lY3Rpb24nLCB7IHR5cGU6ICdhY3Rpb24nLCBhY3Rpb25UZXh0OiAnVGVzdF9Db25uZWN0aW9uJyB9KTtcblxuXHR0aGlzLnNlY3Rpb24oJ0F1dGhlbnRpY2F0aW9uJywgZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfQXV0aGVudGljYXRpb24nLCBmYWxzZSwgeyB0eXBlOiAnYm9vbGVhbicsIGVuYWJsZVF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX0F1dGhlbnRpY2F0aW9uX1VzZXJETicsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBlbmFibGVRdWVyeTogZW5hYmxlQXV0aGVudGljYXRpb24gfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfQXV0aGVudGljYXRpb25fUGFzc3dvcmQnLCAnJywgeyB0eXBlOiAncGFzc3dvcmQnLCBlbmFibGVRdWVyeTogZW5hYmxlQXV0aGVudGljYXRpb24gfSk7XG5cdH0pO1xuXG5cdHRoaXMuc2VjdGlvbignVGltZW91dHMnLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnTERBUF9UaW1lb3V0JywgNjAwMDAsIHt0eXBlOiAnaW50JywgZW5hYmxlUXVlcnl9KTtcblx0XHR0aGlzLmFkZCgnTERBUF9Db25uZWN0X1RpbWVvdXQnLCAxMDAwLCB7dHlwZTogJ2ludCcsIGVuYWJsZVF1ZXJ5fSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfSWRsZV9UaW1lb3V0JywgMTAwMCwge3R5cGU6ICdpbnQnLCBlbmFibGVRdWVyeX0pO1xuXHR9KTtcblxuXHR0aGlzLnNlY3Rpb24oJ1VzZXIgU2VhcmNoJywgZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfVXNlcl9TZWFyY2hfRmlsdGVyJywgJyhvYmplY3RjbGFzcz0qKScsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX1VzZXJfU2VhcmNoX1Njb3BlJywgJ3N1YicsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX1VzZXJfU2VhcmNoX0ZpZWxkJywgJ3NBTUFjY291bnROYW1lJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfU2VhcmNoX1BhZ2VfU2l6ZScsIDI1MCwgeyB0eXBlOiAnaW50JywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfU2VhcmNoX1NpemVfTGltaXQnLCAxMDAwLCB7IHR5cGU6ICdpbnQnLCBlbmFibGVRdWVyeSB9KTtcblx0fSk7XG5cblx0dGhpcy5zZWN0aW9uKCdVc2VyIFNlYXJjaCAoR3JvdXAgVmFsaWRhdGlvbiknLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnTERBUF9Hcm91cF9GaWx0ZXJfRW5hYmxlJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnTERBUF9Hcm91cF9GaWx0ZXJfT2JqZWN0Q2xhc3MnLCAnZ3JvdXBPZlVuaXF1ZU5hbWVzJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnk6IGdyb3VwRmlsdGVyUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfR3JvdXBfRmlsdGVyX0dyb3VwX0lkX0F0dHJpYnV0ZScsICdjbicsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5OiBncm91cEZpbHRlclF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX0dyb3VwX0ZpbHRlcl9Hcm91cF9NZW1iZXJfQXR0cmlidXRlJywgJ3VuaXF1ZU1lbWJlcicsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5OiBncm91cEZpbHRlclF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX0dyb3VwX0ZpbHRlcl9Hcm91cF9NZW1iZXJfRm9ybWF0JywgJ3VuaXF1ZU1lbWJlcicsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5OiBncm91cEZpbHRlclF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX0dyb3VwX0ZpbHRlcl9Hcm91cF9OYW1lJywgJ1JPQ0tFVF9DSEFUJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnk6IGdyb3VwRmlsdGVyUXVlcnkgfSk7XG5cdH0pO1xuXG5cdHRoaXMuc2VjdGlvbignU3luYyAvIEltcG9ydCcsIGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuYWRkKCdMREFQX1VzZXJuYW1lX0ZpZWxkJywgJ3NBTUFjY291bnROYW1lJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfVW5pcXVlX0lkZW50aWZpZXJfRmllbGQnLCAnb2JqZWN0R1VJRCxpYm0tZW50cnlVVUlELEdVSUQsZG9taW5vVU5JRCxuc3VuaXF1ZUlkLHVpZE51bWJlcicsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX0RlZmF1bHRfRG9tYWluJywgJycsIHsgdHlwZTogJ3N0cmluZycsIGVuYWJsZVF1ZXJ5IH0pO1xuXHRcdHRoaXMuYWRkKCdMREFQX01lcmdlX0V4aXN0aW5nX1VzZXJzJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBlbmFibGVRdWVyeSB9KTtcblxuXHRcdHRoaXMuYWRkKCdMREFQX1N5bmNfVXNlcl9EYXRhJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBlbmFibGVRdWVyeSB9KTtcblx0XHR0aGlzLmFkZCgnTERBUF9TeW5jX1VzZXJfRGF0YV9GaWVsZE1hcCcsICd7XCJjblwiOlwibmFtZVwiLCBcIm1haWxcIjpcImVtYWlsXCJ9JywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnk6IHN5bmNEYXRhUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfU3luY19Vc2VyX0F2YXRhcicsIHRydWUsIHsgdHlwZTogJ2Jvb2xlYW4nLCBlbmFibGVRdWVyeSB9KTtcblxuXHRcdHRoaXMuYWRkKCdMREFQX0JhY2tncm91bmRfU3luYycsIGZhbHNlLCB7IHR5cGU6ICdib29sZWFuJywgZW5hYmxlUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jX0ludGVydmFsJywgJ0V2ZXJ5IDI0IGhvdXJzJywgeyB0eXBlOiAnc3RyaW5nJywgZW5hYmxlUXVlcnk6IGJhY2tncm91bmRTeW5jUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jX0ltcG9ydF9OZXdfVXNlcnMnLCB0cnVlLCB7IHR5cGU6ICdib29sZWFuJywgZW5hYmxlUXVlcnk6IGJhY2tncm91bmRTeW5jUXVlcnkgfSk7XG5cdFx0dGhpcy5hZGQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jX0tlZXBfRXhpc3RhbnRfVXNlcnNfVXBkYXRlZCcsIHRydWUsIHsgdHlwZTogJ2Jvb2xlYW4nLCBlbmFibGVRdWVyeTogYmFja2dyb3VuZFN5bmNRdWVyeSB9KTtcblxuXHRcdHRoaXMuYWRkKCdMREFQX1N5bmNfTm93JywgJ2xkYXBfc3luY19ub3cnLCB7IHR5cGU6ICdhY3Rpb24nLCBhY3Rpb25UZXh0OiAnRXhlY3V0ZV9TeW5jaHJvbml6YXRpb25fTm93JyB9KTtcblx0fSk7XG59KTtcbiIsIi8qIGdsb2JhbHMgc2x1Z2lmeSwgU3luY2VkQ3JvbiAqL1xuXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmltcG9ydCBMREFQIGZyb20gJy4vbGRhcCc7XG5cbmNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoJ0xEQVBTeW5jJywge30pO1xuXG5leHBvcnQgZnVuY3Rpb24gc2x1Zyh0ZXh0KSB7XG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnVVRGOF9OYW1lc19TbHVnaWZ5JykgIT09IHRydWUpIHtcblx0XHRyZXR1cm4gdGV4dDtcblx0fVxuXHR0ZXh0ID0gc2x1Z2lmeSh0ZXh0LCAnLicpO1xuXHRyZXR1cm4gdGV4dC5yZXBsYWNlKC9bXjAtOWEtei1fLl0vZywgJycpO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9wZXJ0eVZhbHVlKG9iaiwga2V5KSB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIF8ucmVkdWNlKGtleS5zcGxpdCgnLicpLCAoYWNjLCBlbCkgPT4gYWNjW2VsXSwgb2JqKTtcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMZGFwVXNlcm5hbWUobGRhcFVzZXIpIHtcblx0Y29uc3QgdXNlcm5hbWVGaWVsZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1VzZXJuYW1lX0ZpZWxkJyk7XG5cblx0aWYgKHVzZXJuYW1lRmllbGQuaW5kZXhPZignI3snKSA+IC0xKSB7XG5cdFx0cmV0dXJuIHVzZXJuYW1lRmllbGQucmVwbGFjZSgvI3soLis/KX0vZywgZnVuY3Rpb24obWF0Y2gsIGZpZWxkKSB7XG5cdFx0XHRyZXR1cm4gbGRhcFVzZXJbZmllbGRdO1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGxkYXBVc2VyW3VzZXJuYW1lRmllbGRdO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMZGFwVXNlclVuaXF1ZUlEKGxkYXBVc2VyKSB7XG5cdGxldCBVbmlxdWVfSWRlbnRpZmllcl9GaWVsZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1VuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkJyk7XG5cblx0aWYgKFVuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkICE9PSAnJykge1xuXHRcdFVuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkID0gVW5pcXVlX0lkZW50aWZpZXJfRmllbGQucmVwbGFjZSgvXFxzL2csICcnKS5zcGxpdCgnLCcpO1xuXHR9IGVsc2Uge1xuXHRcdFVuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkID0gW107XG5cdH1cblxuXHRsZXQgVXNlcl9TZWFyY2hfRmllbGQgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9Vc2VyX1NlYXJjaF9GaWVsZCcpO1xuXG5cdGlmIChVc2VyX1NlYXJjaF9GaWVsZCAhPT0gJycpIHtcblx0XHRVc2VyX1NlYXJjaF9GaWVsZCA9IFVzZXJfU2VhcmNoX0ZpZWxkLnJlcGxhY2UoL1xccy9nLCAnJykuc3BsaXQoJywnKTtcblx0fSBlbHNlIHtcblx0XHRVc2VyX1NlYXJjaF9GaWVsZCA9IFtdO1xuXHR9XG5cblx0VW5pcXVlX0lkZW50aWZpZXJfRmllbGQgPSBVbmlxdWVfSWRlbnRpZmllcl9GaWVsZC5jb25jYXQoVXNlcl9TZWFyY2hfRmllbGQpO1xuXG5cdGlmIChVbmlxdWVfSWRlbnRpZmllcl9GaWVsZC5sZW5ndGggPiAwKSB7XG5cdFx0VW5pcXVlX0lkZW50aWZpZXJfRmllbGQgPSBVbmlxdWVfSWRlbnRpZmllcl9GaWVsZC5maW5kKChmaWVsZCkgPT4ge1xuXHRcdFx0cmV0dXJuICFfLmlzRW1wdHkobGRhcFVzZXIuX3Jhd1tmaWVsZF0pO1xuXHRcdH0pO1xuXHRcdGlmIChVbmlxdWVfSWRlbnRpZmllcl9GaWVsZCkge1xuXHRcdFx0VW5pcXVlX0lkZW50aWZpZXJfRmllbGQgPSB7XG5cdFx0XHRcdGF0dHJpYnV0ZTogVW5pcXVlX0lkZW50aWZpZXJfRmllbGQsXG5cdFx0XHRcdHZhbHVlOiBsZGFwVXNlci5fcmF3W1VuaXF1ZV9JZGVudGlmaWVyX0ZpZWxkXS50b1N0cmluZygnaGV4Jylcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiBVbmlxdWVfSWRlbnRpZmllcl9GaWVsZDtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGF0YVRvU3luY1VzZXJEYXRhKGxkYXBVc2VyLCB1c2VyKSB7XG5cdGNvbnN0IHN5bmNVc2VyRGF0YSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX1N5bmNfVXNlcl9EYXRhJyk7XG5cdGNvbnN0IHN5bmNVc2VyRGF0YUZpZWxkTWFwID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfU3luY19Vc2VyX0RhdGFfRmllbGRNYXAnKS50cmltKCk7XG5cblx0Y29uc3QgdXNlckRhdGEgPSB7fTtcblxuXHRpZiAoc3luY1VzZXJEYXRhICYmIHN5bmNVc2VyRGF0YUZpZWxkTWFwKSB7XG5cdFx0Y29uc3Qgd2hpdGVsaXN0ZWRVc2VyRmllbGRzID0gWydlbWFpbCcsICduYW1lJywgJ2N1c3RvbUZpZWxkcyddO1xuXHRcdGNvbnN0IGZpZWxkTWFwID0gSlNPTi5wYXJzZShzeW5jVXNlckRhdGFGaWVsZE1hcCk7XG5cdFx0Y29uc3QgZW1haWxMaXN0ID0gW107XG5cdFx0Xy5tYXAoZmllbGRNYXAsIGZ1bmN0aW9uKHVzZXJGaWVsZCwgbGRhcEZpZWxkKSB7XG5cdFx0XHRzd2l0Y2ggKHVzZXJGaWVsZCkge1xuXHRcdFx0XHRjYXNlICdlbWFpbCc6XG5cdFx0XHRcdFx0aWYgKCFsZGFwVXNlci5oYXNPd25Qcm9wZXJ0eShsZGFwRmllbGQpKSB7XG5cdFx0XHRcdFx0XHRsb2dnZXIuZGVidWcoYHVzZXIgZG9lcyBub3QgaGF2ZSBhdHRyaWJ1dGU6ICR7IGxkYXBGaWVsZCB9YCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKF8uaXNPYmplY3QobGRhcFVzZXJbbGRhcEZpZWxkXSkpIHtcblx0XHRcdFx0XHRcdF8ubWFwKGxkYXBVc2VyW2xkYXBGaWVsZF0sIGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0XHRcdFx0ZW1haWxMaXN0LnB1c2goeyBhZGRyZXNzOiBpdGVtLCB2ZXJpZmllZDogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbWFpbExpc3QucHVzaCh7IGFkZHJlc3M6IGxkYXBVc2VyW2xkYXBGaWVsZF0sIHZlcmlmaWVkOiB0cnVlIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGNvbnN0IFtvdXRlcktleSwgaW5uZXJLZXlzXSA9IHVzZXJGaWVsZC5zcGxpdCgvXFwuKC4rKS8pO1xuXG5cdFx0XHRcdFx0aWYgKCFfLmZpbmQod2hpdGVsaXN0ZWRVc2VyRmllbGRzLCAoZWwpID0+IGVsID09PSBvdXRlcktleSkpIHtcblx0XHRcdFx0XHRcdGxvZ2dlci5kZWJ1ZyhgdXNlciBhdHRyaWJ1dGUgbm90IHdoaXRlbGlzdGVkOiAkeyB1c2VyRmllbGQgfWApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChvdXRlcktleSA9PT0gJ2N1c3RvbUZpZWxkcycpIHtcblx0XHRcdFx0XHRcdGxldCBjdXN0b21GaWVsZHNNZXRhO1xuXG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjdXN0b21GaWVsZHNNZXRhID0gSlNPTi5wYXJzZShSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfQ3VzdG9tRmllbGRzJykpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0XHRsb2dnZXIuZGVidWcoJ0ludmFsaWQgSlNPTiBmb3IgQ3VzdG9tIEZpZWxkcycpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICghZ2V0UHJvcGVydHlWYWx1ZShjdXN0b21GaWVsZHNNZXRhLCBpbm5lcktleXMpKSB7XG5cdFx0XHRcdFx0XHRcdGxvZ2dlci5kZWJ1ZyhgdXNlciBhdHRyaWJ1dGUgZG9lcyBub3QgZXhpc3Q6ICR7IHVzZXJGaWVsZCB9YCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB0bXBVc2VyRmllbGQgPSBnZXRQcm9wZXJ0eVZhbHVlKHVzZXIsIHVzZXJGaWVsZCk7XG5cdFx0XHRcdFx0Y29uc3QgdG1wTGRhcEZpZWxkID0gUm9ja2V0Q2hhdC50ZW1wbGF0ZVZhckhhbmRsZXIobGRhcEZpZWxkLCBsZGFwVXNlcik7XG5cblx0XHRcdFx0XHRpZiAodG1wTGRhcEZpZWxkICYmIHRtcFVzZXJGaWVsZCAhPT0gdG1wTGRhcEZpZWxkKSB7XG5cdFx0XHRcdFx0XHQvLyBjcmVhdGVzIHRoZSBvYmplY3Qgc3RydWN0dXJlIGluc3RlYWQgb2YganVzdCBhc3NpZ25pbmcgJ3RtcExkYXBGaWVsZCcgdG9cblx0XHRcdFx0XHRcdC8vICd1c2VyRGF0YVt1c2VyRmllbGRdJyBpbiBvcmRlciB0byBhdm9pZCB0aGUgXCJjYW5ub3QgdXNlIHRoZSBwYXJ0ICguLi4pXG5cdFx0XHRcdFx0XHQvLyB0byB0cmF2ZXJzZSB0aGUgZWxlbWVudFwiIChNb25nb0RCKSBlcnJvciB0aGF0IGNhbiBoYXBwZW4uIERvIG5vdCBoYW5kbGVcblx0XHRcdFx0XHRcdC8vIGFycmF5cy5cblx0XHRcdFx0XHRcdC8vIFRPRE86IEZpbmQgYSBiZXR0ZXIgc29sdXRpb24uXG5cdFx0XHRcdFx0XHRjb25zdCBkS2V5cyA9IHVzZXJGaWVsZC5zcGxpdCgnLicpO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGFzdEtleSA9IF8ubGFzdChkS2V5cyk7XG5cdFx0XHRcdFx0XHRfLnJlZHVjZShkS2V5cywgKG9iaiwgY3VycktleSkgPT5cblx0XHRcdFx0XHRcdFx0KGN1cnJLZXkgPT09IGxhc3RLZXkpXG5cdFx0XHRcdFx0XHRcdFx0PyBvYmpbY3VycktleV0gPSB0bXBMZGFwRmllbGRcblx0XHRcdFx0XHRcdFx0XHQ6IG9ialtjdXJyS2V5XSA9IG9ialtjdXJyS2V5XSB8fCB7fVxuXHRcdFx0XHRcdFx0XHQsIHVzZXJEYXRhKTtcblx0XHRcdFx0XHRcdGxvZ2dlci5kZWJ1ZyhgdXNlci4keyB1c2VyRmllbGQgfSBjaGFuZ2VkIHRvOiAkeyB0bXBMZGFwRmllbGQgfWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChlbWFpbExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0aWYgKEpTT04uc3RyaW5naWZ5KHVzZXIuZW1haWxzKSAhPT0gSlNPTi5zdHJpbmdpZnkoZW1haWxMaXN0KSkge1xuXHRcdFx0XHR1c2VyRGF0YS5lbWFpbHMgPSBlbWFpbExpc3Q7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgdW5pcXVlSWQgPSBnZXRMZGFwVXNlclVuaXF1ZUlEKGxkYXBVc2VyKTtcblxuXHRpZiAodW5pcXVlSWQgJiYgKCF1c2VyLnNlcnZpY2VzIHx8ICF1c2VyLnNlcnZpY2VzLmxkYXAgfHwgdXNlci5zZXJ2aWNlcy5sZGFwLmlkICE9PSB1bmlxdWVJZC52YWx1ZSB8fCB1c2VyLnNlcnZpY2VzLmxkYXAuaWRBdHRyaWJ1dGUgIT09IHVuaXF1ZUlkLmF0dHJpYnV0ZSkpIHtcblx0XHR1c2VyRGF0YVsnc2VydmljZXMubGRhcC5pZCddID0gdW5pcXVlSWQudmFsdWU7XG5cdFx0dXNlckRhdGFbJ3NlcnZpY2VzLmxkYXAuaWRBdHRyaWJ1dGUnXSA9IHVuaXF1ZUlkLmF0dHJpYnV0ZTtcblx0fVxuXG5cdGlmICh1c2VyLmxkYXAgIT09IHRydWUpIHtcblx0XHR1c2VyRGF0YS5sZGFwID0gdHJ1ZTtcblx0fVxuXG5cdGlmIChfLnNpemUodXNlckRhdGEpKSB7XG5cdFx0cmV0dXJuIHVzZXJEYXRhO1xuXHR9XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHN5bmNVc2VyRGF0YSh1c2VyLCBsZGFwVXNlcikge1xuXHRsb2dnZXIuaW5mbygnU3luY2luZyB1c2VyIGRhdGEnKTtcblx0bG9nZ2VyLmRlYnVnKCd1c2VyJywgeydlbWFpbCc6IHVzZXIuZW1haWwsICdfaWQnOiB1c2VyLl9pZH0pO1xuXHRsb2dnZXIuZGVidWcoJ2xkYXBVc2VyJywgbGRhcFVzZXIpO1xuXG5cdGNvbnN0IHVzZXJEYXRhID0gZ2V0RGF0YVRvU3luY1VzZXJEYXRhKGxkYXBVc2VyLCB1c2VyKTtcblx0aWYgKHVzZXIgJiYgdXNlci5faWQgJiYgdXNlckRhdGEpIHtcblx0XHRsb2dnZXIuZGVidWcoJ3NldHRpbmcnLCBKU09OLnN0cmluZ2lmeSh1c2VyRGF0YSwgbnVsbCwgMikpO1xuXHRcdGlmICh1c2VyRGF0YS5uYW1lKSB7XG5cdFx0XHRSb2NrZXRDaGF0Ll9zZXRSZWFsTmFtZSh1c2VyLl9pZCwgdXNlckRhdGEubmFtZSk7XG5cdFx0XHRkZWxldGUgdXNlckRhdGEubmFtZTtcblx0XHR9XG5cdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZSh1c2VyLl9pZCwgeyAkc2V0OiB1c2VyRGF0YSB9KTtcblx0XHR1c2VyID0gTWV0ZW9yLnVzZXJzLmZpbmRPbmUoe19pZDogdXNlci5faWR9KTtcblx0fVxuXG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9Vc2VybmFtZV9GaWVsZCcpICE9PSAnJykge1xuXHRcdGNvbnN0IHVzZXJuYW1lID0gc2x1ZyhnZXRMZGFwVXNlcm5hbWUobGRhcFVzZXIpKTtcblx0XHRpZiAodXNlciAmJiB1c2VyLl9pZCAmJiB1c2VybmFtZSAhPT0gdXNlci51c2VybmFtZSkge1xuXHRcdFx0bG9nZ2VyLmluZm8oJ1N5bmNpbmcgdXNlciB1c2VybmFtZScsIHVzZXIudXNlcm5hbWUsICctPicsIHVzZXJuYW1lKTtcblx0XHRcdFJvY2tldENoYXQuX3NldFVzZXJuYW1lKHVzZXIuX2lkLCB1c2VybmFtZSk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHVzZXIgJiYgdXNlci5faWQgJiYgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfU3luY19Vc2VyX0F2YXRhcicpID09PSB0cnVlKSB7XG5cdFx0Y29uc3QgYXZhdGFyID0gbGRhcFVzZXIuX3Jhdy50aHVtYm5haWxQaG90byB8fCBsZGFwVXNlci5fcmF3LmpwZWdQaG90bztcblx0XHRpZiAoYXZhdGFyKSB7XG5cdFx0XHRsb2dnZXIuaW5mbygnU3luY2luZyB1c2VyIGF2YXRhcicpO1xuXG5cdFx0XHRjb25zdCBycyA9IFJvY2tldENoYXRGaWxlLmJ1ZmZlclRvU3RyZWFtKGF2YXRhcik7XG5cdFx0XHRjb25zdCBmaWxlU3RvcmUgPSBGaWxlVXBsb2FkLmdldFN0b3JlKCdBdmF0YXJzJyk7XG5cdFx0XHRmaWxlU3RvcmUuZGVsZXRlQnlOYW1lKHVzZXIudXNlcm5hbWUpO1xuXG5cdFx0XHRjb25zdCBmaWxlID0ge1xuXHRcdFx0XHR1c2VySWQ6IHVzZXIuX2lkLFxuXHRcdFx0XHR0eXBlOiAnaW1hZ2UvanBlZydcblx0XHRcdH07XG5cblx0XHRcdE1ldGVvci5ydW5Bc1VzZXIodXNlci5faWQsICgpID0+IHtcblx0XHRcdFx0ZmlsZVN0b3JlLmluc2VydChmaWxlLCBycywgKCkgPT4ge1xuXHRcdFx0XHRcdE1ldGVvci5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0QXZhdGFyT3JpZ2luKHVzZXIuX2lkLCAnbGRhcCcpO1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeUxvZ2dlZCgndXBkYXRlQXZhdGFyJywge3VzZXJuYW1lOiB1c2VyLnVzZXJuYW1lfSk7XG5cdFx0XHRcdFx0fSwgNTAwKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZExkYXBVc2VyKGxkYXBVc2VyLCB1c2VybmFtZSwgcGFzc3dvcmQpIHtcblx0Y29uc3QgdW5pcXVlSWQgPSBnZXRMZGFwVXNlclVuaXF1ZUlEKGxkYXBVc2VyKTtcblxuXHRjb25zdCB1c2VyT2JqZWN0ID0ge307XG5cblx0aWYgKHVzZXJuYW1lKSB7XG5cdFx0dXNlck9iamVjdC51c2VybmFtZSA9IHVzZXJuYW1lO1xuXHR9XG5cblx0Y29uc3QgdXNlckRhdGEgPSBnZXREYXRhVG9TeW5jVXNlckRhdGEobGRhcFVzZXIsIHt9KTtcblxuXHRpZiAodXNlckRhdGEgJiYgdXNlckRhdGEuZW1haWxzICYmIHVzZXJEYXRhLmVtYWlsc1swXSAmJiB1c2VyRGF0YS5lbWFpbHNbMF0uYWRkcmVzcykge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHVzZXJEYXRhLmVtYWlsc1swXS5hZGRyZXNzKSkge1xuXHRcdFx0dXNlck9iamVjdC5lbWFpbCA9IHVzZXJEYXRhLmVtYWlsc1swXS5hZGRyZXNzWzBdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1c2VyT2JqZWN0LmVtYWlsID0gdXNlckRhdGEuZW1haWxzWzBdLmFkZHJlc3M7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGxkYXBVc2VyLm1haWwgJiYgbGRhcFVzZXIubWFpbC5pbmRleE9mKCdAJykgPiAtMSkge1xuXHRcdHVzZXJPYmplY3QuZW1haWwgPSBsZGFwVXNlci5tYWlsO1xuXHR9IGVsc2UgaWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0RlZmF1bHRfRG9tYWluJykgIT09ICcnKSB7XG5cdFx0dXNlck9iamVjdC5lbWFpbCA9IGAkeyB1c2VybmFtZSB8fCB1bmlxdWVJZC52YWx1ZSB9QCR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0RlZmF1bHRfRG9tYWluJykgfWA7XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgZXJyb3IgPSBuZXcgTWV0ZW9yLkVycm9yKCdMREFQLWxvZ2luLWVycm9yJywgJ0xEQVAgQXV0aGVudGljYXRpb24gc3VjY2VkZWQsIHRoZXJlIGlzIG5vIGVtYWlsIHRvIGNyZWF0ZSBhbiBhY2NvdW50LiBIYXZlIHlvdSB0cmllZCBzZXR0aW5nIHlvdXIgRGVmYXVsdCBEb21haW4gaW4gTERBUCBTZXR0aW5ncz8nKTtcblx0XHRsb2dnZXIuZXJyb3IoZXJyb3IpO1xuXHRcdHRocm93IGVycm9yO1xuXHR9XG5cblx0bG9nZ2VyLmRlYnVnKCdOZXcgdXNlciBkYXRhJywgdXNlck9iamVjdCk7XG5cblx0aWYgKHBhc3N3b3JkKSB7XG5cdFx0dXNlck9iamVjdC5wYXNzd29yZCA9IHBhc3N3b3JkO1xuXHR9XG5cblx0dHJ5IHtcblx0XHR1c2VyT2JqZWN0Ll9pZCA9IEFjY291bnRzLmNyZWF0ZVVzZXIodXNlck9iamVjdCk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0bG9nZ2VyLmVycm9yKCdFcnJvciBjcmVhdGluZyB1c2VyJywgZXJyb3IpO1xuXHRcdHJldHVybiBlcnJvcjtcblx0fVxuXG5cdHN5bmNVc2VyRGF0YSh1c2VyT2JqZWN0LCBsZGFwVXNlcik7XG5cblx0cmV0dXJuIHtcblx0XHR1c2VySWQ6IHVzZXJPYmplY3QuX2lkXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnROZXdVc2VycyhsZGFwKSB7XG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9FbmFibGUnKSAhPT0gdHJ1ZSkge1xuXHRcdGxvZ2dlci5lcnJvcignQ2FuXFwndCBydW4gTERBUCBJbXBvcnQsIExEQVAgaXMgZGlzYWJsZWQnKTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRpZiAoIWxkYXApIHtcblx0XHRsZGFwID0gbmV3IExEQVAoKTtcblx0XHRsZGFwLmNvbm5lY3RTeW5jKCk7XG5cdH1cblxuXHRsZXQgY291bnQgPSAwO1xuXHRsZGFwLnNlYXJjaFVzZXJzU3luYygnKicsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKGVycm9yLCBsZGFwVXNlcnMsIHtuZXh0LCBlbmR9ID0ge30pID0+IHtcblx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblxuXHRcdGxkYXBVc2Vycy5mb3JFYWNoKChsZGFwVXNlcikgPT4ge1xuXHRcdFx0Y291bnQrKztcblxuXHRcdFx0Y29uc3QgdW5pcXVlSWQgPSBnZXRMZGFwVXNlclVuaXF1ZUlEKGxkYXBVc2VyKTtcblx0XHRcdC8vIExvb2sgdG8gc2VlIGlmIHVzZXIgYWxyZWFkeSBleGlzdHNcblx0XHRcdGNvbnN0IHVzZXJRdWVyeSA9IHtcblx0XHRcdFx0J3NlcnZpY2VzLmxkYXAuaWQnOiB1bmlxdWVJZC52YWx1ZVxuXHRcdFx0fTtcblxuXHRcdFx0bG9nZ2VyLmRlYnVnKCd1c2VyUXVlcnknLCB1c2VyUXVlcnkpO1xuXG5cdFx0XHRsZXQgdXNlcm5hbWU7XG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfVXNlcm5hbWVfRmllbGQnKSAhPT0gJycpIHtcblx0XHRcdFx0dXNlcm5hbWUgPSBzbHVnKGdldExkYXBVc2VybmFtZShsZGFwVXNlcikpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBZGQgdXNlciBpZiBpdCB3YXMgbm90IGFkZGVkIGJlZm9yZVxuXHRcdFx0bGV0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZSh1c2VyUXVlcnkpO1xuXG5cdFx0XHRpZiAoIXVzZXIgJiYgdXNlcm5hbWUgJiYgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfTWVyZ2VfRXhpc3RpbmdfVXNlcnMnKSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRjb25zdCB1c2VyUXVlcnkgPSB7XG5cdFx0XHRcdFx0dXNlcm5hbWVcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRsb2dnZXIuZGVidWcoJ3VzZXJRdWVyeSBtZXJnZScsIHVzZXJRdWVyeSk7XG5cblx0XHRcdFx0dXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHVzZXJRdWVyeSk7XG5cdFx0XHRcdGlmICh1c2VyKSB7XG5cdFx0XHRcdFx0c3luY1VzZXJEYXRhKHVzZXIsIGxkYXBVc2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdFx0YWRkTGRhcFVzZXIobGRhcFVzZXIsIHVzZXJuYW1lKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvdW50ICUgMTAwID09PSAwKSB7XG5cdFx0XHRcdGxvZ2dlci5pbmZvKCdJbXBvcnQgcnVubmluZy4gVXNlcnMgaW1wb3J0ZWQgdW50aWwgbm93OicsIGNvdW50KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChlbmQpIHtcblx0XHRcdGxvZ2dlci5pbmZvKCdJbXBvcnQgZmluaXNoZWQuIFVzZXJzIGltcG9ydGVkOicsIGNvdW50KTtcblx0XHR9XG5cblx0XHRuZXh0KGNvdW50KTtcblx0fSkpO1xufVxuXG5mdW5jdGlvbiBzeW5jKCkge1xuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfRW5hYmxlJykgIT09IHRydWUpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBsZGFwID0gbmV3IExEQVAoKTtcblxuXHR0cnkge1xuXHRcdGxkYXAuY29ubmVjdFN5bmMoKTtcblxuXHRcdGxldCB1c2Vycztcblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jX0tlZXBfRXhpc3RhbnRfVXNlcnNfVXBkYXRlZCcpID09PSB0cnVlKSB7XG5cdFx0XHR1c2VycyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRMREFQVXNlcnMoKTtcblx0XHR9XG5cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jX0ltcG9ydF9OZXdfVXNlcnMnKSA9PT0gdHJ1ZSkge1xuXHRcdFx0aW1wb3J0TmV3VXNlcnMobGRhcCk7XG5cdFx0fVxuXG5cdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0JhY2tncm91bmRfU3luY19LZWVwX0V4aXN0YW50X1VzZXJzX1VwZGF0ZWQnKSA9PT0gdHJ1ZSkge1xuXHRcdFx0dXNlcnMuZm9yRWFjaChmdW5jdGlvbih1c2VyKSB7XG5cdFx0XHRcdGxldCBsZGFwVXNlcjtcblxuXHRcdFx0XHRpZiAodXNlci5zZXJ2aWNlcyAmJiB1c2VyLnNlcnZpY2VzLmxkYXAgJiYgdXNlci5zZXJ2aWNlcy5sZGFwLmlkKSB7XG5cdFx0XHRcdFx0bGRhcFVzZXIgPSBsZGFwLmdldFVzZXJCeUlkU3luYyh1c2VyLnNlcnZpY2VzLmxkYXAuaWQsIHVzZXIuc2VydmljZXMubGRhcC5pZEF0dHJpYnV0ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGRhcFVzZXIgPSBsZGFwLmdldFVzZXJCeVVzZXJuYW1lU3luYyh1c2VyLnVzZXJuYW1lKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChsZGFwVXNlcikge1xuXHRcdFx0XHRcdHN5bmNVc2VyRGF0YSh1c2VyLCBsZGFwVXNlcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bG9nZ2VyLmluZm8oJ0NhblxcJ3Qgc3luYyB1c2VyJywgdXNlci51c2VybmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRsb2dnZXIuZXJyb3IoZXJyb3IpO1xuXHRcdHJldHVybiBlcnJvcjtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuY29uc3Qgam9iTmFtZSA9ICdMREFQX1N5bmMnO1xuXG5jb25zdCBhZGRDcm9uSm9iID0gXy5kZWJvdW5jZShNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uIGFkZENyb25Kb2JEZWJvdW5jZWQoKSB7XG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9CYWNrZ3JvdW5kX1N5bmMnKSAhPT0gdHJ1ZSkge1xuXHRcdGxvZ2dlci5pbmZvKCdEaXNhYmxpbmcgTERBUCBCYWNrZ3JvdW5kIFN5bmMnKTtcblx0XHRpZiAoU3luY2VkQ3Jvbi5uZXh0U2NoZWR1bGVkQXREYXRlKGpvYk5hbWUpKSB7XG5cdFx0XHRTeW5jZWRDcm9uLnJlbW92ZShqb2JOYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0JhY2tncm91bmRfU3luY19JbnRlcnZhbCcpKSB7XG5cdFx0bG9nZ2VyLmluZm8oJ0VuYWJsaW5nIExEQVAgQmFja2dyb3VuZCBTeW5jJyk7XG5cdFx0U3luY2VkQ3Jvbi5hZGQoe1xuXHRcdFx0bmFtZTogam9iTmFtZSxcblx0XHRcdHNjaGVkdWxlOiAocGFyc2VyKSA9PiBwYXJzZXIudGV4dChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9CYWNrZ3JvdW5kX1N5bmNfSW50ZXJ2YWwnKSksXG5cdFx0XHRqb2IoKSB7XG5cdFx0XHRcdHN5bmMoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRTeW5jZWRDcm9uLnN0YXJ0KCk7XG5cdH1cbn0pLCA1MDApO1xuXG5NZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XG5cdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jJywgYWRkQ3JvbkpvYik7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xEQVBfQmFja2dyb3VuZF9TeW5jX0ludGVydmFsJywgYWRkQ3JvbkpvYik7XG5cdH0pO1xufSk7XG4iLCJpbXBvcnQge2ltcG9ydE5ld1VzZXJzfSBmcm9tICcuL3N5bmMnO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdGxkYXBfc3luY19ub3coKSB7XG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cdFx0aWYgKCF1c2VyKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdsZGFwX3N5bmNfdXNlcnMnIH0pO1xuXHRcdH1cblxuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNSb2xlKHVzZXIuX2lkLCAnYWRtaW4nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ2xkYXBfc3luY191c2VycycgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMREFQX0VuYWJsZScpICE9PSB0cnVlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdMREFQX2Rpc2FibGVkJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy51bmJsb2NrKCk7XG5cblx0XHRpbXBvcnROZXdVc2VycygpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG1lc3NhZ2U6ICdTeW5jX2luX3Byb2dyZXNzJyxcblx0XHRcdHBhcmFtczogW11cblx0XHR9O1xuXHR9XG59KTtcbiIsImltcG9ydCBMREFQIGZyb20gJy4vbGRhcCc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0bGRhcF90ZXN0X2Nvbm5lY3Rpb24oKSB7XG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cdFx0aWYgKCF1c2VyKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdsZGFwX3Rlc3RfY29ubmVjdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1JvbGUodXNlci5faWQsICdhZG1pbicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgbWV0aG9kOiAnbGRhcF90ZXN0X2Nvbm5lY3Rpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTERBUF9FbmFibGUnKSAhPT0gdHJ1ZSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignTERBUF9kaXNhYmxlZCcpO1xuXHRcdH1cblxuXHRcdGxldCBsZGFwO1xuXHRcdHRyeSB7XG5cdFx0XHRsZGFwID0gbmV3IExEQVAoKTtcblx0XHRcdGxkYXAuY29ubmVjdFN5bmMoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyb3IpO1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcihlcnJvci5tZXNzYWdlKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0bGRhcC5iaW5kSWZOZWNlc3NhcnkoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcihlcnJvci5uYW1lIHx8IGVycm9yLm1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRtZXNzYWdlOiAnQ29ubmVjdGlvbl9zdWNjZXNzJyxcblx0XHRcdHBhcmFtczogW11cblx0XHR9O1xuXHR9XG59KTtcbiJdfQ==
