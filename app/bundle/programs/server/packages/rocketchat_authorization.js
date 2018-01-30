(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var roles;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:authorization":{"lib":{"rocketchat.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/lib/rocketchat.js                                                        //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
RocketChat.authz = {};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"models":{"Permissions.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/models/Permissions.js                                             //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
class ModelPermissions extends RocketChat.models._Base {
	constructor() {
		super(...arguments);
	} // FIND


	findByRole(role, options) {
		const query = {
			roles: role
		};
		return this.find(query, options);
	}

	findOneById(_id) {
		return this.findOne(_id);
	}

	createOrUpdate(name, roles) {
		this.upsert({
			_id: name
		}, {
			$set: {
				roles
			}
		});
	}

	addRole(permission, role) {
		this.update({
			_id: permission
		}, {
			$addToSet: {
				roles: role
			}
		});
	}

	removeRole(permission, role) {
		this.update({
			_id: permission
		}, {
			$pull: {
				roles: role
			}
		});
	}

}

RocketChat.models.Permissions = new ModelPermissions('permissions', true);
RocketChat.models.Permissions.cache.load();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Roles.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/models/Roles.js                                                   //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
class ModelRoles extends RocketChat.models._Base {
	constructor() {
		super(...arguments);
		this.tryEnsureIndex({
			'name': 1
		});
		this.tryEnsureIndex({
			'scope': 1
		});
	}

	findUsersInRole(name, scope, options) {
		const role = this.findOne(name);
		const roleScope = role && role.scope || 'Users';
		const model = RocketChat.models[roleScope];
		return model && model.findUsersInRoles && model.findUsersInRoles(name, scope, options);
	}

	isUserInRoles(userId, roles, scope) {
		roles = [].concat(roles);
		return roles.some(roleName => {
			const role = this.findOne(roleName);
			const roleScope = role && role.scope || 'Users';
			const model = RocketChat.models[roleScope];
			return model && model.isUserInRole && model.isUserInRole(userId, roleName, scope);
		});
	}

	createOrUpdate(name, scope = 'Users', description, protectedRole) {
		const updateData = {};
		updateData.name = name;
		updateData.scope = scope;

		if (description != null) {
			updateData.description = description;
		}

		if (protectedRole) {
			updateData.protected = protectedRole;
		}

		this.upsert({
			_id: name
		}, {
			$set: updateData
		});
	}

	addUserRoles(userId, roles, scope) {
		roles = [].concat(roles);

		for (const roleName of roles) {
			const role = this.findOne(roleName);
			const roleScope = role && role.scope || 'Users';
			const model = RocketChat.models[roleScope];
			model && model.addRolesByUserId && model.addRolesByUserId(userId, roleName, scope);
		}

		return true;
	}

	removeUserRoles(userId, roles, scope) {
		roles = [].concat(roles);

		for (const roleName of roles) {
			const role = this.findOne(roleName);
			const roleScope = role && role.scope || 'Users';
			const model = RocketChat.models[roleScope];
			model && model.removeRolesByUserId && model.removeRolesByUserId(userId, roleName, scope);
		}

		return true;
	}

}

RocketChat.models.Roles = new ModelRoles('roles', true);
RocketChat.models.Roles.cache.load();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Base.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/models/Base.js                                                    //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.models._Base.prototype.roleBaseQuery = function () /*userId, scope*/{
	return;
};

RocketChat.models._Base.prototype.findRolesByUserId = function (userId /*, options*/) {
	const query = this.roleBaseQuery(userId);
	return this.find(query, {
		fields: {
			roles: 1
		}
	});
};

RocketChat.models._Base.prototype.isUserInRole = function (userId, roleName, scope) {
	const query = this.roleBaseQuery(userId, scope);

	if (query == null) {
		return false;
	}

	query.roles = roleName;
	return !_.isUndefined(this.findOne(query));
};

RocketChat.models._Base.prototype.addRolesByUserId = function (userId, roles, scope) {
	roles = [].concat(roles);
	const query = this.roleBaseQuery(userId, scope);
	const update = {
		$addToSet: {
			roles: {
				$each: roles
			}
		}
	};
	return this.update(query, update);
};

RocketChat.models._Base.prototype.removeRolesByUserId = function (userId, roles, scope) {
	roles = [].concat(roles);
	const query = this.roleBaseQuery(userId, scope);
	const update = {
		$pullAll: {
			roles
		}
	};
	return this.update(query, update);
};

RocketChat.models._Base.prototype.findUsersInRoles = function () {
	throw new Meteor.Error('overwrite-function', 'You must overwrite this function in the extended classes');
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Users.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/models/Users.js                                                   //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
RocketChat.models.Users.roleBaseQuery = function (userId) {
	return {
		_id: userId
	};
};

RocketChat.models.Users.findUsersInRoles = function (roles, scope, options) {
	roles = [].concat(roles);
	const query = {
		roles: {
			$in: roles
		}
	};
	return this.find(query, options);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Subscriptions.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/models/Subscriptions.js                                           //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.models.Subscriptions.roleBaseQuery = function (userId, scope) {
	if (scope == null) {
		return;
	}

	const query = {
		'u._id': userId
	};

	if (!_.isUndefined(scope)) {
		query.rid = scope;
	}

	return query;
};

RocketChat.models.Subscriptions.findUsersInRoles = function (roles, scope, options) {
	roles = [].concat(roles);
	const query = {
		roles: {
			$in: roles
		}
	};

	if (scope) {
		query.rid = scope;
	}

	const subscriptions = this.find(query).fetch();

	const users = _.compact(_.map(subscriptions, function (subscription) {
		if ('undefined' !== typeof subscription.u && 'undefined' !== typeof subscription.u._id) {
			return subscription.u._id;
		}
	}));

	return RocketChat.models.Users.find({
		_id: {
			$in: users
		}
	}, options);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"functions":{"addUserRoles.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/addUserRoles.js                                         //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.authz.addUserRoles = function (userId, roleNames, scope) {
	if (!userId || !roleNames) {
		return false;
	}

	const user = RocketChat.models.Users.db.findOneById(userId);

	if (!user) {
		throw new Meteor.Error('error-invalid-user', 'Invalid user', {
			function: 'RocketChat.authz.addUserRoles'
		});
	}

	roleNames = [].concat(roleNames);

	const existingRoleNames = _.pluck(RocketChat.authz.getRoles(), '_id');

	const invalidRoleNames = _.difference(roleNames, existingRoleNames);

	if (!_.isEmpty(invalidRoleNames)) {
		for (const role of invalidRoleNames) {
			RocketChat.models.Roles.createOrUpdate(role);
		}
	}

	RocketChat.models.Roles.addUserRoles(userId, roleNames, scope);
	return true;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"canAccessRoom.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/canAccessRoom.js                                        //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
/* globals RocketChat */RocketChat.authz.roomAccessValidators = [function (room, user = {}) {
	if (room.t === 'c') {
		if (!user._id && RocketChat.settings.get('Accounts_AllowAnonymousRead') === true) {
			return true;
		}

		return RocketChat.authz.hasPermission(user._id, 'view-c-room');
	}
}, function (room, user = {}) {
	const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(room._id, user._id);

	if (subscription) {
		return subscription._room;
	}
}];

RocketChat.authz.canAccessRoom = function (room, user) {
	return RocketChat.authz.roomAccessValidators.some(validator => {
		return validator.call(this, room, user);
	});
};

RocketChat.authz.addRoomAccessValidator = function (validator) {
	RocketChat.authz.roomAccessValidators.push(validator);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getRoles.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/getRoles.js                                             //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
RocketChat.authz.getRoles = function () {
	return RocketChat.models.Roles.find().fetch();
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getUsersInRole.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/getUsersInRole.js                                       //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
RocketChat.authz.getUsersInRole = function (roleName, scope, options) {
	return RocketChat.models.Roles.findUsersInRole(roleName, scope, options);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"hasPermission.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/hasPermission.js                                        //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
function atLeastOne(userId, permissions = [], scope) {
	return permissions.some(permissionId => {
		const permission = RocketChat.models.Permissions.findOne(permissionId);
		return RocketChat.models.Roles.isUserInRoles(userId, permission.roles, scope);
	});
}

function all(userId, permissions = [], scope) {
	return permissions.every(permissionId => {
		const permission = RocketChat.models.Permissions.findOne(permissionId);
		return RocketChat.models.Roles.isUserInRoles(userId, permission.roles, scope);
	});
}

function hasPermission(userId, permissions, scope, strategy) {
	if (!userId) {
		return false;
	}

	permissions = [].concat(permissions);
	return strategy(userId, permissions, scope);
}

RocketChat.authz.hasAllPermission = function (userId, permissions, scope) {
	return hasPermission(userId, permissions, scope, all);
};

RocketChat.authz.hasPermission = RocketChat.authz.hasAllPermission;

RocketChat.authz.hasAtLeastOnePermission = function (userId, permissions, scope) {
	return hasPermission(userId, permissions, scope, atLeastOne);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"hasRole.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/hasRole.js                                              //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
RocketChat.authz.hasRole = function (userId, roleNames, scope) {
	roleNames = [].concat(roleNames);
	return RocketChat.models.Roles.isUserInRoles(userId, roleNames, scope);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeUserFromRoles.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/functions/removeUserFromRoles.js                                  //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.authz.removeUserFromRoles = function (userId, roleNames, scope) {
	if (!userId || !roleNames) {
		return false;
	}

	const user = RocketChat.models.Users.findOneById(userId);

	if (!user) {
		throw new Meteor.Error('error-invalid-user', 'Invalid user', {
			function: 'RocketChat.authz.removeUserFromRoles'
		});
	}

	roleNames = [].concat(roleNames);

	const existingRoleNames = _.pluck(RocketChat.authz.getRoles(), '_id');

	const invalidRoleNames = _.difference(roleNames, existingRoleNames);

	if (!_.isEmpty(invalidRoleNames)) {
		throw new Meteor.Error('error-invalid-role', 'Invalid role', {
			function: 'RocketChat.authz.removeUserFromRoles'
		});
	}

	RocketChat.models.Roles.removeUserRoles(userId, roleNames, scope);
	return true;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"publications":{"permissions.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/publications/permissions.js                                       //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.methods({
	'permissions/get'(updatedAt) {
		this.unblock();
		const records = RocketChat.models.Permissions.find().fetch();

		if (updatedAt instanceof Date) {
			return {
				update: records.filter(record => {
					return record._updatedAt > updatedAt;
				}),
				remove: RocketChat.models.Permissions.trashFindDeletedAfter(updatedAt, {}, {
					fields: {
						_id: 1,
						_deletedAt: 1
					}
				}).fetch()
			};
		}

		return records;
	}

});
RocketChat.models.Permissions.on('changed', (type, permission) => {
	RocketChat.Notifications.notifyLoggedInThisInstance('permissions-changed', type, permission);
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"roles.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/publications/roles.js                                             //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.publish('roles', function () {
	if (!this.userId) {
		return this.ready();
	}

	return RocketChat.models.Roles.find();
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"usersInRole.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/publications/usersInRole.js                                       //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.publish('usersInRole', function (roleName, scope, limit = 50) {
	if (!this.userId) {
		return this.ready();
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'access-permissions')) {
		return this.error(new Meteor.Error('error-not-allowed', 'Not allowed', {
			publish: 'usersInRole'
		}));
	}

	const options = {
		limit,
		sort: {
			name: 1
		}
	};
	return RocketChat.authz.getUsersInRole(roleName, scope, options);
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"addUserToRole.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/methods/addUserToRole.js                                          //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	'authorization:addUserToRole'(roleName, username, scope) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'access-permissions')) {
			throw new Meteor.Error('error-action-not-allowed', 'Accessing permissions is not allowed', {
				method: 'authorization:addUserToRole',
				action: 'Accessing_permissions'
			});
		}

		if (!roleName || !_.isString(roleName) || !username || !_.isString(username)) {
			throw new Meteor.Error('error-invalid-arguments', 'Invalid arguments', {
				method: 'authorization:addUserToRole'
			});
		}

		if (roleName === 'admin' && !RocketChat.authz.hasPermission(Meteor.userId(), 'assign-admin-role')) {
			throw new Meteor.Error('error-action-not-allowed', 'Assigning admin is not allowed', {
				method: 'authorization:addUserToRole',
				action: 'Assign_admin'
			});
		}

		const user = RocketChat.models.Users.findOneByUsername(username, {
			fields: {
				_id: 1
			}
		});

		if (!user || !user._id) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'authorization:addUserToRole'
			});
		}

		const add = RocketChat.models.Roles.addUserRoles(user._id, roleName, scope);

		if (RocketChat.settings.get('UI_DisplayRoles')) {
			RocketChat.Notifications.notifyLogged('roles-change', {
				type: 'added',
				_id: roleName,
				u: {
					_id: user._id,
					username
				},
				scope
			});
		}

		return add;
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"deleteRole.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/methods/deleteRole.js                                             //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.methods({
	'authorization:deleteRole'(roleName) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'access-permissions')) {
			throw new Meteor.Error('error-action-not-allowed', 'Accessing permissions is not allowed', {
				method: 'authorization:deleteRole',
				action: 'Accessing_permissions'
			});
		}

		const role = RocketChat.models.Roles.findOne(roleName);

		if (!role) {
			throw new Meteor.Error('error-invalid-role', 'Invalid role', {
				method: 'authorization:deleteRole'
			});
		}

		if (role.protected) {
			throw new Meteor.Error('error-delete-protected-role', 'Cannot delete a protected role', {
				method: 'authorization:deleteRole'
			});
		}

		const roleScope = role.scope || 'Users';
		const model = RocketChat.models[roleScope];
		const existingUsers = model && model.findUsersInRoles && model.findUsersInRoles(roleName);

		if (existingUsers && existingUsers.count() > 0) {
			throw new Meteor.Error('error-role-in-use', 'Cannot delete role because it\'s in use', {
				method: 'authorization:deleteRole'
			});
		}

		return RocketChat.models.Roles.remove(role.name);
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeUserFromRole.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/methods/removeUserFromRole.js                                     //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	'authorization:removeUserFromRole'(roleName, username, scope) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'access-permissions')) {
			throw new Meteor.Error('error-action-not-allowed', 'Access permissions is not allowed', {
				method: 'authorization:removeUserFromRole',
				action: 'Accessing_permissions'
			});
		}

		if (!roleName || !_.isString(roleName) || !username || !_.isString(username)) {
			throw new Meteor.Error('error-invalid-arguments', 'Invalid arguments', {
				method: 'authorization:removeUserFromRole'
			});
		}

		const user = Meteor.users.findOne({
			username
		}, {
			fields: {
				_id: 1,
				roles: 1
			}
		});

		if (!user || !user._id) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'authorization:removeUserFromRole'
			});
		} // prevent removing last user from admin role


		if (roleName === 'admin') {
			const adminCount = Meteor.users.find({
				roles: {
					$in: ['admin']
				}
			}).count();
			const userIsAdmin = user.roles.indexOf('admin') > -1;

			if (adminCount === 1 && userIsAdmin) {
				throw new Meteor.Error('error-action-not-allowed', 'Leaving the app without admins is not allowed', {
					method: 'removeUserFromRole',
					action: 'Remove_last_admin'
				});
			}
		}

		const remove = RocketChat.models.Roles.removeUserRoles(user._id, roleName, scope);

		if (RocketChat.settings.get('UI_DisplayRoles')) {
			RocketChat.Notifications.notifyLogged('roles-change', {
				type: 'removed',
				_id: roleName,
				u: {
					_id: user._id,
					username
				},
				scope
			});
		}

		return remove;
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRole.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/methods/saveRole.js                                               //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.methods({
	'authorization:saveRole'(roleData) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'access-permissions')) {
			throw new Meteor.Error('error-action-not-allowed', 'Accessing permissions is not allowed', {
				method: 'authorization:saveRole',
				action: 'Accessing_permissions'
			});
		}

		if (!roleData.name) {
			throw new Meteor.Error('error-role-name-required', 'Role name is required', {
				method: 'authorization:saveRole'
			});
		}

		if (['Users', 'Subscriptions'].includes(roleData.scope) === false) {
			roleData.scope = 'Users';
		}

		const update = RocketChat.models.Roles.createOrUpdate(roleData.name, roleData.scope, roleData.description);

		if (RocketChat.settings.get('UI_DisplayRoles')) {
			RocketChat.Notifications.notifyLogged('roles-change', {
				type: 'changed',
				_id: roleData.name
			});
		}

		return update;
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"addPermissionToRole.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/methods/addPermissionToRole.js                                    //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.methods({
	'authorization:addPermissionToRole'(permission, role) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'access-permissions')) {
			throw new Meteor.Error('error-action-not-allowed', 'Adding permission is not allowed', {
				method: 'authorization:addPermissionToRole',
				action: 'Adding_permission'
			});
		}

		return RocketChat.models.Permissions.addRole(permission, role);
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeRoleFromPermission.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/methods/removeRoleFromPermission.js                               //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
Meteor.methods({
	'authorization:removeRoleFromPermission'(permission, role) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'access-permissions')) {
			throw new Meteor.Error('error-action-not-allowed', 'Accessing permissions is not allowed', {
				method: 'authorization:removeRoleFromPermission',
				action: 'Accessing_permissions'
			});
		}

		return RocketChat.models.Permissions.removeRole(permission, role);
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                            //
// packages/rocketchat_authorization/server/startup.js                                                        //
//                                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                              //
/* eslint no-multi-spaces: 0 */Meteor.startup(function () {
	// Note:
	// 1.if we need to create a role that can only edit channel message, but not edit group message
	// then we can define edit-<type>-message instead of edit-message
	// 2. admin, moderator, and user roles should not be deleted as they are referened in the code.
	const permissions = [{
		_id: 'access-permissions',
		roles: ['admin']
	}, {
		_id: 'add-oauth-service',
		roles: ['admin']
	}, {
		_id: 'add-user-to-joined-room',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'add-user-to-any-c-room',
		roles: ['admin']
	}, {
		_id: 'add-user-to-any-p-room',
		roles: []
	}, {
		_id: 'archive-room',
		roles: ['admin', 'owner']
	}, {
		_id: 'assign-admin-role',
		roles: ['admin']
	}, {
		_id: 'ban-user',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'bulk-create-c',
		roles: ['admin']
	}, {
		_id: 'bulk-register-user',
		roles: ['admin']
	}, {
		_id: 'create-c',
		roles: ['admin', 'user', 'bot']
	}, {
		_id: 'create-d',
		roles: ['admin', 'user', 'bot']
	}, {
		_id: 'create-p',
		roles: ['admin', 'user', 'bot']
	}, {
		_id: 'create-user',
		roles: ['admin']
	}, {
		_id: 'clean-channel-history',
		roles: ['admin']
	}, // special permission to bulk delete a channel's mesages
	{
		_id: 'delete-c',
		roles: ['admin']
	}, {
		_id: 'delete-d',
		roles: ['admin']
	}, {
		_id: 'delete-message',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'delete-p',
		roles: ['admin']
	}, {
		_id: 'delete-user',
		roles: ['admin']
	}, {
		_id: 'edit-message',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'edit-other-user-active-status',
		roles: ['admin']
	}, {
		_id: 'edit-other-user-info',
		roles: ['admin']
	}, {
		_id: 'edit-other-user-password',
		roles: ['admin']
	}, {
		_id: 'edit-privileged-setting',
		roles: ['admin']
	}, {
		_id: 'edit-room',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'force-delete-message',
		roles: ['admin', 'owner']
	}, {
		_id: 'join-without-join-code',
		roles: ['admin', 'bot']
	}, {
		_id: 'manage-assets',
		roles: ['admin']
	}, {
		_id: 'manage-emoji',
		roles: ['admin']
	}, {
		_id: 'manage-integrations',
		roles: ['admin']
	}, {
		_id: 'manage-own-integrations',
		roles: ['admin', 'bot']
	}, {
		_id: 'manage-oauth-apps',
		roles: ['admin']
	}, {
		_id: 'mention-all',
		roles: ['admin', 'owner', 'moderator', 'user']
	}, {
		_id: 'mute-user',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'remove-user',
		roles: ['admin', 'owner', 'moderator']
	}, {
		_id: 'run-import',
		roles: ['admin']
	}, {
		_id: 'run-migration',
		roles: ['admin']
	}, {
		_id: 'set-moderator',
		roles: ['admin', 'owner']
	}, {
		_id: 'set-owner',
		roles: ['admin', 'owner']
	}, {
		_id: 'send-many-messages',
		roles: ['admin', 'bot']
	}, {
		_id: 'set-leader',
		roles: ['admin', 'owner']
	}, {
		_id: 'unarchive-room',
		roles: ['admin']
	}, {
		_id: 'view-c-room',
		roles: ['admin', 'user', 'bot', 'anonymous']
	}, {
		_id: 'user-generate-access-token',
		roles: ['admin']
	}, {
		_id: 'view-d-room',
		roles: ['admin', 'user', 'bot']
	}, {
		_id: 'view-full-other-user-info',
		roles: ['admin']
	}, {
		_id: 'view-history',
		roles: ['admin', 'user', 'anonymous']
	}, {
		_id: 'view-joined-room',
		roles: ['guest', 'bot', 'anonymous']
	}, {
		_id: 'view-join-code',
		roles: ['admin']
	}, {
		_id: 'view-logs',
		roles: ['admin']
	}, {
		_id: 'view-other-user-channels',
		roles: ['admin']
	}, {
		_id: 'view-p-room',
		roles: ['admin', 'user', 'anonymous']
	}, {
		_id: 'view-privileged-setting',
		roles: ['admin']
	}, {
		_id: 'view-room-administration',
		roles: ['admin']
	}, {
		_id: 'view-statistics',
		roles: ['admin']
	}, {
		_id: 'view-user-administration',
		roles: ['admin']
	}, {
		_id: 'preview-c-room',
		roles: ['admin', 'user', 'anonymous']
	}, {
		_id: 'view-outside-room',
		roles: ['admin', 'owner', 'moderator', 'user']
	}];

	for (const permission of permissions) {
		if (!RocketChat.models.Permissions.findOneById(permission._id)) {
			RocketChat.models.Permissions.upsert(permission._id, {
				$set: permission
			});
		}
	}

	const defaultRoles = [{
		name: 'admin',
		scope: 'Users',
		description: 'Admin'
	}, {
		name: 'moderator',
		scope: 'Subscriptions',
		description: 'Moderator'
	}, {
		name: 'leader',
		scope: 'Subscriptions',
		description: 'Leader'
	}, {
		name: 'owner',
		scope: 'Subscriptions',
		description: 'Owner'
	}, {
		name: 'user',
		scope: 'Users',
		description: ''
	}, {
		name: 'bot',
		scope: 'Users',
		description: ''
	}, {
		name: 'guest',
		scope: 'Users',
		description: ''
	}, {
		name: 'anonymous',
		scope: 'Users',
		description: ''
	}];

	for (const role of defaultRoles) {
		RocketChat.models.Roles.upsert({
			_id: role.name
		}, {
			$setOnInsert: {
				scope: role.scope,
				description: role.description || '',
				protected: true
			}
		});
	}
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:authorization/lib/rocketchat.js");
require("./node_modules/meteor/rocketchat:authorization/server/models/Permissions.js");
require("./node_modules/meteor/rocketchat:authorization/server/models/Roles.js");
require("./node_modules/meteor/rocketchat:authorization/server/models/Base.js");
require("./node_modules/meteor/rocketchat:authorization/server/models/Users.js");
require("./node_modules/meteor/rocketchat:authorization/server/models/Subscriptions.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/addUserRoles.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/canAccessRoom.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/getRoles.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/getUsersInRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/hasPermission.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/hasRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/functions/removeUserFromRoles.js");
require("./node_modules/meteor/rocketchat:authorization/server/publications/permissions.js");
require("./node_modules/meteor/rocketchat:authorization/server/publications/roles.js");
require("./node_modules/meteor/rocketchat:authorization/server/publications/usersInRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/methods/addUserToRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/methods/deleteRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/methods/removeUserFromRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/methods/saveRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/methods/addPermissionToRole.js");
require("./node_modules/meteor/rocketchat:authorization/server/methods/removeRoleFromPermission.js");
require("./node_modules/meteor/rocketchat:authorization/server/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:authorization'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_authorization.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL2xpYi9yb2NrZXRjaGF0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL21vZGVscy9QZXJtaXNzaW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL3NlcnZlci9tb2RlbHMvUm9sZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvbW9kZWxzL0Jhc2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvbW9kZWxzL1VzZXJzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL21vZGVscy9TdWJzY3JpcHRpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL2Z1bmN0aW9ucy9hZGRVc2VyUm9sZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvZnVuY3Rpb25zL2NhbkFjY2Vzc1Jvb20uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvZnVuY3Rpb25zL2dldFJvbGVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL2Z1bmN0aW9ucy9nZXRVc2Vyc0luUm9sZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL3NlcnZlci9mdW5jdGlvbnMvaGFzUGVybWlzc2lvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL3NlcnZlci9mdW5jdGlvbnMvaGFzUm9sZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL3NlcnZlci9mdW5jdGlvbnMvcmVtb3ZlVXNlckZyb21Sb2xlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL3NlcnZlci9wdWJsaWNhdGlvbnMvcGVybWlzc2lvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvcHVibGljYXRpb25zL3JvbGVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL3B1YmxpY2F0aW9ucy91c2Vyc0luUm9sZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphdXRob3JpemF0aW9uL3NlcnZlci9tZXRob2RzL2FkZFVzZXJUb1JvbGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvbWV0aG9kcy9kZWxldGVSb2xlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL21ldGhvZHMvcmVtb3ZlVXNlckZyb21Sb2xlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL21ldGhvZHMvc2F2ZVJvbGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YXV0aG9yaXphdGlvbi9zZXJ2ZXIvbWV0aG9kcy9hZGRQZXJtaXNzaW9uVG9Sb2xlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL21ldGhvZHMvcmVtb3ZlUm9sZUZyb21QZXJtaXNzaW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmF1dGhvcml6YXRpb24vc2VydmVyL3N0YXJ0dXAuanMiXSwibmFtZXMiOlsiUm9ja2V0Q2hhdCIsImF1dGh6IiwiTW9kZWxQZXJtaXNzaW9ucyIsIm1vZGVscyIsIl9CYXNlIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJmaW5kQnlSb2xlIiwicm9sZSIsIm9wdGlvbnMiLCJxdWVyeSIsInJvbGVzIiwiZmluZCIsImZpbmRPbmVCeUlkIiwiX2lkIiwiZmluZE9uZSIsImNyZWF0ZU9yVXBkYXRlIiwibmFtZSIsInVwc2VydCIsIiRzZXQiLCJhZGRSb2xlIiwicGVybWlzc2lvbiIsInVwZGF0ZSIsIiRhZGRUb1NldCIsInJlbW92ZVJvbGUiLCIkcHVsbCIsIlBlcm1pc3Npb25zIiwiY2FjaGUiLCJsb2FkIiwiTW9kZWxSb2xlcyIsInRyeUVuc3VyZUluZGV4IiwiZmluZFVzZXJzSW5Sb2xlIiwic2NvcGUiLCJyb2xlU2NvcGUiLCJtb2RlbCIsImZpbmRVc2Vyc0luUm9sZXMiLCJpc1VzZXJJblJvbGVzIiwidXNlcklkIiwiY29uY2F0Iiwic29tZSIsInJvbGVOYW1lIiwiaXNVc2VySW5Sb2xlIiwiZGVzY3JpcHRpb24iLCJwcm90ZWN0ZWRSb2xlIiwidXBkYXRlRGF0YSIsInByb3RlY3RlZCIsImFkZFVzZXJSb2xlcyIsImFkZFJvbGVzQnlVc2VySWQiLCJyZW1vdmVVc2VyUm9sZXMiLCJyZW1vdmVSb2xlc0J5VXNlcklkIiwiUm9sZXMiLCJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJwcm90b3R5cGUiLCJyb2xlQmFzZVF1ZXJ5IiwiZmluZFJvbGVzQnlVc2VySWQiLCJmaWVsZHMiLCJpc1VuZGVmaW5lZCIsIiRlYWNoIiwiJHB1bGxBbGwiLCJNZXRlb3IiLCJFcnJvciIsIlVzZXJzIiwiJGluIiwiU3Vic2NyaXB0aW9ucyIsInJpZCIsInN1YnNjcmlwdGlvbnMiLCJmZXRjaCIsInVzZXJzIiwiY29tcGFjdCIsIm1hcCIsInN1YnNjcmlwdGlvbiIsInUiLCJyb2xlTmFtZXMiLCJ1c2VyIiwiZGIiLCJmdW5jdGlvbiIsImV4aXN0aW5nUm9sZU5hbWVzIiwicGx1Y2siLCJnZXRSb2xlcyIsImludmFsaWRSb2xlTmFtZXMiLCJkaWZmZXJlbmNlIiwiaXNFbXB0eSIsInJvb21BY2Nlc3NWYWxpZGF0b3JzIiwicm9vbSIsInQiLCJzZXR0aW5ncyIsImdldCIsImhhc1Blcm1pc3Npb24iLCJmaW5kT25lQnlSb29tSWRBbmRVc2VySWQiLCJfcm9vbSIsImNhbkFjY2Vzc1Jvb20iLCJ2YWxpZGF0b3IiLCJjYWxsIiwiYWRkUm9vbUFjY2Vzc1ZhbGlkYXRvciIsInB1c2giLCJnZXRVc2Vyc0luUm9sZSIsImF0TGVhc3RPbmUiLCJwZXJtaXNzaW9ucyIsInBlcm1pc3Npb25JZCIsImFsbCIsImV2ZXJ5Iiwic3RyYXRlZ3kiLCJoYXNBbGxQZXJtaXNzaW9uIiwiaGFzQXRMZWFzdE9uZVBlcm1pc3Npb24iLCJoYXNSb2xlIiwicmVtb3ZlVXNlckZyb21Sb2xlcyIsIm1ldGhvZHMiLCJ1cGRhdGVkQXQiLCJ1bmJsb2NrIiwicmVjb3JkcyIsIkRhdGUiLCJmaWx0ZXIiLCJyZWNvcmQiLCJfdXBkYXRlZEF0IiwicmVtb3ZlIiwidHJhc2hGaW5kRGVsZXRlZEFmdGVyIiwiX2RlbGV0ZWRBdCIsIm9uIiwidHlwZSIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlMb2dnZWRJblRoaXNJbnN0YW5jZSIsInB1Ymxpc2giLCJyZWFkeSIsImxpbWl0IiwiZXJyb3IiLCJzb3J0IiwidXNlcm5hbWUiLCJtZXRob2QiLCJhY3Rpb24iLCJpc1N0cmluZyIsImZpbmRPbmVCeVVzZXJuYW1lIiwiYWRkIiwibm90aWZ5TG9nZ2VkIiwiZXhpc3RpbmdVc2VycyIsImNvdW50IiwiYWRtaW5Db3VudCIsInVzZXJJc0FkbWluIiwiaW5kZXhPZiIsInJvbGVEYXRhIiwiaW5jbHVkZXMiLCJzdGFydHVwIiwiZGVmYXVsdFJvbGVzIiwiJHNldE9uSW5zZXJ0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsV0FBV0MsS0FBWCxHQUFtQixFQUFuQixDOzs7Ozs7Ozs7OztBQ0FBLE1BQU1DLGdCQUFOLFNBQStCRixXQUFXRyxNQUFYLENBQWtCQyxLQUFqRCxDQUF1RDtBQUN0REMsZUFBYztBQUNiLFFBQU0sR0FBR0MsU0FBVDtBQUNBLEVBSHFELENBS3REOzs7QUFDQUMsWUFBV0MsSUFBWCxFQUFpQkMsT0FBakIsRUFBMEI7QUFDekIsUUFBTUMsUUFBUTtBQUNiQyxVQUFPSDtBQURNLEdBQWQ7QUFJQSxTQUFPLEtBQUtJLElBQUwsQ0FBVUYsS0FBVixFQUFpQkQsT0FBakIsQ0FBUDtBQUNBOztBQUVESSxhQUFZQyxHQUFaLEVBQWlCO0FBQ2hCLFNBQU8sS0FBS0MsT0FBTCxDQUFhRCxHQUFiLENBQVA7QUFDQTs7QUFFREUsZ0JBQWVDLElBQWYsRUFBcUJOLEtBQXJCLEVBQTRCO0FBQzNCLE9BQUtPLE1BQUwsQ0FBWTtBQUFFSixRQUFLRztBQUFQLEdBQVosRUFBMkI7QUFBRUUsU0FBTTtBQUFFUjtBQUFGO0FBQVIsR0FBM0I7QUFDQTs7QUFFRFMsU0FBUUMsVUFBUixFQUFvQmIsSUFBcEIsRUFBMEI7QUFDekIsT0FBS2MsTUFBTCxDQUFZO0FBQUVSLFFBQUtPO0FBQVAsR0FBWixFQUFpQztBQUFFRSxjQUFXO0FBQUVaLFdBQU9IO0FBQVQ7QUFBYixHQUFqQztBQUNBOztBQUVEZ0IsWUFBV0gsVUFBWCxFQUF1QmIsSUFBdkIsRUFBNkI7QUFDNUIsT0FBS2MsTUFBTCxDQUFZO0FBQUVSLFFBQUtPO0FBQVAsR0FBWixFQUFpQztBQUFFSSxVQUFPO0FBQUVkLFdBQU9IO0FBQVQ7QUFBVCxHQUFqQztBQUNBOztBQTVCcUQ7O0FBK0J2RFIsV0FBV0csTUFBWCxDQUFrQnVCLFdBQWxCLEdBQWdDLElBQUl4QixnQkFBSixDQUFxQixhQUFyQixFQUFvQyxJQUFwQyxDQUFoQztBQUNBRixXQUFXRyxNQUFYLENBQWtCdUIsV0FBbEIsQ0FBOEJDLEtBQTlCLENBQW9DQyxJQUFwQyxHOzs7Ozs7Ozs7OztBQ2hDQSxNQUFNQyxVQUFOLFNBQXlCN0IsV0FBV0csTUFBWCxDQUFrQkMsS0FBM0MsQ0FBaUQ7QUFDaERDLGVBQWM7QUFDYixRQUFNLEdBQUdDLFNBQVQ7QUFDQSxPQUFLd0IsY0FBTCxDQUFvQjtBQUFFLFdBQVE7QUFBVixHQUFwQjtBQUNBLE9BQUtBLGNBQUwsQ0FBb0I7QUFBRSxZQUFTO0FBQVgsR0FBcEI7QUFDQTs7QUFFREMsaUJBQWdCZCxJQUFoQixFQUFzQmUsS0FBdEIsRUFBNkJ2QixPQUE3QixFQUFzQztBQUNyQyxRQUFNRCxPQUFPLEtBQUtPLE9BQUwsQ0FBYUUsSUFBYixDQUFiO0FBQ0EsUUFBTWdCLFlBQWF6QixRQUFRQSxLQUFLd0IsS0FBZCxJQUF3QixPQUExQztBQUNBLFFBQU1FLFFBQVFsQyxXQUFXRyxNQUFYLENBQWtCOEIsU0FBbEIsQ0FBZDtBQUVBLFNBQU9DLFNBQVNBLE1BQU1DLGdCQUFmLElBQW1DRCxNQUFNQyxnQkFBTixDQUF1QmxCLElBQXZCLEVBQTZCZSxLQUE3QixFQUFvQ3ZCLE9BQXBDLENBQTFDO0FBQ0E7O0FBRUQyQixlQUFjQyxNQUFkLEVBQXNCMUIsS0FBdEIsRUFBNkJxQixLQUE3QixFQUFvQztBQUNuQ3JCLFVBQVEsR0FBRzJCLE1BQUgsQ0FBVTNCLEtBQVYsQ0FBUjtBQUNBLFNBQU9BLE1BQU00QixJQUFOLENBQVlDLFFBQUQsSUFBYztBQUMvQixTQUFNaEMsT0FBTyxLQUFLTyxPQUFMLENBQWF5QixRQUFiLENBQWI7QUFDQSxTQUFNUCxZQUFhekIsUUFBUUEsS0FBS3dCLEtBQWQsSUFBd0IsT0FBMUM7QUFDQSxTQUFNRSxRQUFRbEMsV0FBV0csTUFBWCxDQUFrQjhCLFNBQWxCLENBQWQ7QUFFQSxVQUFPQyxTQUFTQSxNQUFNTyxZQUFmLElBQStCUCxNQUFNTyxZQUFOLENBQW1CSixNQUFuQixFQUEyQkcsUUFBM0IsRUFBcUNSLEtBQXJDLENBQXRDO0FBQ0EsR0FOTSxDQUFQO0FBT0E7O0FBRURoQixnQkFBZUMsSUFBZixFQUFxQmUsUUFBUSxPQUE3QixFQUFzQ1UsV0FBdEMsRUFBbURDLGFBQW5ELEVBQWtFO0FBQ2pFLFFBQU1DLGFBQWEsRUFBbkI7QUFDQUEsYUFBVzNCLElBQVgsR0FBa0JBLElBQWxCO0FBQ0EyQixhQUFXWixLQUFYLEdBQW1CQSxLQUFuQjs7QUFFQSxNQUFJVSxlQUFlLElBQW5CLEVBQXlCO0FBQ3hCRSxjQUFXRixXQUFYLEdBQXlCQSxXQUF6QjtBQUNBOztBQUVELE1BQUlDLGFBQUosRUFBbUI7QUFDbEJDLGNBQVdDLFNBQVgsR0FBdUJGLGFBQXZCO0FBQ0E7O0FBRUQsT0FBS3pCLE1BQUwsQ0FBWTtBQUFFSixRQUFLRztBQUFQLEdBQVosRUFBMkI7QUFBRUUsU0FBTXlCO0FBQVIsR0FBM0I7QUFDQTs7QUFFREUsY0FBYVQsTUFBYixFQUFxQjFCLEtBQXJCLEVBQTRCcUIsS0FBNUIsRUFBbUM7QUFDbENyQixVQUFRLEdBQUcyQixNQUFILENBQVUzQixLQUFWLENBQVI7O0FBQ0EsT0FBSyxNQUFNNkIsUUFBWCxJQUF1QjdCLEtBQXZCLEVBQThCO0FBQzdCLFNBQU1ILE9BQU8sS0FBS08sT0FBTCxDQUFheUIsUUFBYixDQUFiO0FBQ0EsU0FBTVAsWUFBYXpCLFFBQVFBLEtBQUt3QixLQUFkLElBQXdCLE9BQTFDO0FBQ0EsU0FBTUUsUUFBUWxDLFdBQVdHLE1BQVgsQ0FBa0I4QixTQUFsQixDQUFkO0FBRUFDLFlBQVNBLE1BQU1hLGdCQUFmLElBQW1DYixNQUFNYSxnQkFBTixDQUF1QlYsTUFBdkIsRUFBK0JHLFFBQS9CLEVBQXlDUixLQUF6QyxDQUFuQztBQUNBOztBQUNELFNBQU8sSUFBUDtBQUNBOztBQUVEZ0IsaUJBQWdCWCxNQUFoQixFQUF3QjFCLEtBQXhCLEVBQStCcUIsS0FBL0IsRUFBc0M7QUFDckNyQixVQUFRLEdBQUcyQixNQUFILENBQVUzQixLQUFWLENBQVI7O0FBQ0EsT0FBSyxNQUFNNkIsUUFBWCxJQUF1QjdCLEtBQXZCLEVBQThCO0FBQzdCLFNBQU1ILE9BQU8sS0FBS08sT0FBTCxDQUFheUIsUUFBYixDQUFiO0FBQ0EsU0FBTVAsWUFBYXpCLFFBQVFBLEtBQUt3QixLQUFkLElBQXdCLE9BQTFDO0FBQ0EsU0FBTUUsUUFBUWxDLFdBQVdHLE1BQVgsQ0FBa0I4QixTQUFsQixDQUFkO0FBRUFDLFlBQVNBLE1BQU1lLG1CQUFmLElBQXNDZixNQUFNZSxtQkFBTixDQUEwQlosTUFBMUIsRUFBa0NHLFFBQWxDLEVBQTRDUixLQUE1QyxDQUF0QztBQUNBOztBQUNELFNBQU8sSUFBUDtBQUNBOztBQWhFK0M7O0FBbUVqRGhDLFdBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixHQUEwQixJQUFJckIsVUFBSixDQUFlLE9BQWYsRUFBd0IsSUFBeEIsQ0FBMUI7QUFDQTdCLFdBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixDQUF3QnZCLEtBQXhCLENBQThCQyxJQUE5QixHOzs7Ozs7Ozs7OztBQ3BFQSxJQUFJdUIsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDs7QUFFTnhELFdBQVdHLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCcUQsU0FBeEIsQ0FBa0NDLGFBQWxDLEdBQWtELFlBQVMsaUJBQW1CO0FBQzdFO0FBQ0EsQ0FGRDs7QUFJQTFELFdBQVdHLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCcUQsU0FBeEIsQ0FBa0NFLGlCQUFsQyxHQUFzRCxVQUFTdEIsTUFBVCxDQUFlLGFBQWYsRUFBOEI7QUFDbkYsT0FBTTNCLFFBQVEsS0FBS2dELGFBQUwsQ0FBbUJyQixNQUFuQixDQUFkO0FBQ0EsUUFBTyxLQUFLekIsSUFBTCxDQUFVRixLQUFWLEVBQWlCO0FBQUVrRCxVQUFRO0FBQUVqRCxVQUFPO0FBQVQ7QUFBVixFQUFqQixDQUFQO0FBQ0EsQ0FIRDs7QUFLQVgsV0FBV0csTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0JxRCxTQUF4QixDQUFrQ2hCLFlBQWxDLEdBQWlELFVBQVNKLE1BQVQsRUFBaUJHLFFBQWpCLEVBQTJCUixLQUEzQixFQUFrQztBQUNsRixPQUFNdEIsUUFBUSxLQUFLZ0QsYUFBTCxDQUFtQnJCLE1BQW5CLEVBQTJCTCxLQUEzQixDQUFkOztBQUVBLEtBQUl0QixTQUFTLElBQWIsRUFBbUI7QUFDbEIsU0FBTyxLQUFQO0FBQ0E7O0FBRURBLE9BQU1DLEtBQU4sR0FBYzZCLFFBQWQ7QUFDQSxRQUFPLENBQUNXLEVBQUVVLFdBQUYsQ0FBYyxLQUFLOUMsT0FBTCxDQUFhTCxLQUFiLENBQWQsQ0FBUjtBQUNBLENBVEQ7O0FBV0FWLFdBQVdHLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCcUQsU0FBeEIsQ0FBa0NWLGdCQUFsQyxHQUFxRCxVQUFTVixNQUFULEVBQWlCMUIsS0FBakIsRUFBd0JxQixLQUF4QixFQUErQjtBQUNuRnJCLFNBQVEsR0FBRzJCLE1BQUgsQ0FBVTNCLEtBQVYsQ0FBUjtBQUNBLE9BQU1ELFFBQVEsS0FBS2dELGFBQUwsQ0FBbUJyQixNQUFuQixFQUEyQkwsS0FBM0IsQ0FBZDtBQUNBLE9BQU1WLFNBQVM7QUFDZEMsYUFBVztBQUNWWixVQUFPO0FBQUVtRCxXQUFPbkQ7QUFBVDtBQURHO0FBREcsRUFBZjtBQUtBLFFBQU8sS0FBS1csTUFBTCxDQUFZWixLQUFaLEVBQW1CWSxNQUFuQixDQUFQO0FBQ0EsQ0FURDs7QUFXQXRCLFdBQVdHLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCcUQsU0FBeEIsQ0FBa0NSLG1CQUFsQyxHQUF3RCxVQUFTWixNQUFULEVBQWlCMUIsS0FBakIsRUFBd0JxQixLQUF4QixFQUErQjtBQUN0RnJCLFNBQVEsR0FBRzJCLE1BQUgsQ0FBVTNCLEtBQVYsQ0FBUjtBQUNBLE9BQU1ELFFBQVEsS0FBS2dELGFBQUwsQ0FBbUJyQixNQUFuQixFQUEyQkwsS0FBM0IsQ0FBZDtBQUNBLE9BQU1WLFNBQVM7QUFDZHlDLFlBQVU7QUFDVHBEO0FBRFM7QUFESSxFQUFmO0FBS0EsUUFBTyxLQUFLVyxNQUFMLENBQVlaLEtBQVosRUFBbUJZLE1BQW5CLENBQVA7QUFDQSxDQVREOztBQVdBdEIsV0FBV0csTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0JxRCxTQUF4QixDQUFrQ3RCLGdCQUFsQyxHQUFxRCxZQUFXO0FBQy9ELE9BQU0sSUFBSTZCLE9BQU9DLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLDBEQUF2QyxDQUFOO0FBQ0EsQ0FGRCxDOzs7Ozs7Ozs7OztBQzVDQWpFLFdBQVdHLE1BQVgsQ0FBa0IrRCxLQUFsQixDQUF3QlIsYUFBeEIsR0FBd0MsVUFBU3JCLE1BQVQsRUFBaUI7QUFDeEQsUUFBTztBQUFFdkIsT0FBS3VCO0FBQVAsRUFBUDtBQUNBLENBRkQ7O0FBSUFyQyxXQUFXRyxNQUFYLENBQWtCK0QsS0FBbEIsQ0FBd0IvQixnQkFBeEIsR0FBMkMsVUFBU3hCLEtBQVQsRUFBZ0JxQixLQUFoQixFQUF1QnZCLE9BQXZCLEVBQWdDO0FBQzFFRSxTQUFRLEdBQUcyQixNQUFILENBQVUzQixLQUFWLENBQVI7QUFFQSxPQUFNRCxRQUFRO0FBQ2JDLFNBQU87QUFBRXdELFFBQUt4RDtBQUFQO0FBRE0sRUFBZDtBQUlBLFFBQU8sS0FBS0MsSUFBTCxDQUFVRixLQUFWLEVBQWlCRCxPQUFqQixDQUFQO0FBQ0EsQ0FSRCxDOzs7Ozs7Ozs7OztBQ0pBLElBQUkwQyxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEOztBQUVOeEQsV0FBV0csTUFBWCxDQUFrQmlFLGFBQWxCLENBQWdDVixhQUFoQyxHQUFnRCxVQUFTckIsTUFBVCxFQUFpQkwsS0FBakIsRUFBd0I7QUFDdkUsS0FBSUEsU0FBUyxJQUFiLEVBQW1CO0FBQ2xCO0FBQ0E7O0FBRUQsT0FBTXRCLFFBQVE7QUFBRSxXQUFTMkI7QUFBWCxFQUFkOztBQUNBLEtBQUksQ0FBQ2MsRUFBRVUsV0FBRixDQUFjN0IsS0FBZCxDQUFMLEVBQTJCO0FBQzFCdEIsUUFBTTJELEdBQU4sR0FBWXJDLEtBQVo7QUFDQTs7QUFDRCxRQUFPdEIsS0FBUDtBQUNBLENBVkQ7O0FBWUFWLFdBQVdHLE1BQVgsQ0FBa0JpRSxhQUFsQixDQUFnQ2pDLGdCQUFoQyxHQUFtRCxVQUFTeEIsS0FBVCxFQUFnQnFCLEtBQWhCLEVBQXVCdkIsT0FBdkIsRUFBZ0M7QUFDbEZFLFNBQVEsR0FBRzJCLE1BQUgsQ0FBVTNCLEtBQVYsQ0FBUjtBQUVBLE9BQU1ELFFBQVE7QUFDYkMsU0FBTztBQUFFd0QsUUFBS3hEO0FBQVA7QUFETSxFQUFkOztBQUlBLEtBQUlxQixLQUFKLEVBQVc7QUFDVnRCLFFBQU0yRCxHQUFOLEdBQVlyQyxLQUFaO0FBQ0E7O0FBRUQsT0FBTXNDLGdCQUFnQixLQUFLMUQsSUFBTCxDQUFVRixLQUFWLEVBQWlCNkQsS0FBakIsRUFBdEI7O0FBRUEsT0FBTUMsUUFBUXJCLEVBQUVzQixPQUFGLENBQVV0QixFQUFFdUIsR0FBRixDQUFNSixhQUFOLEVBQXFCLFVBQVNLLFlBQVQsRUFBdUI7QUFDbkUsTUFBSSxnQkFBZ0IsT0FBT0EsYUFBYUMsQ0FBcEMsSUFBeUMsZ0JBQWdCLE9BQU9ELGFBQWFDLENBQWIsQ0FBZTlELEdBQW5GLEVBQXdGO0FBQ3ZGLFVBQU82RCxhQUFhQyxDQUFiLENBQWU5RCxHQUF0QjtBQUNBO0FBQ0QsRUFKdUIsQ0FBVixDQUFkOztBQU1BLFFBQU9kLFdBQVdHLE1BQVgsQ0FBa0IrRCxLQUFsQixDQUF3QnRELElBQXhCLENBQTZCO0FBQUVFLE9BQUs7QUFBRXFELFFBQUtLO0FBQVA7QUFBUCxFQUE3QixFQUFzRC9ELE9BQXRELENBQVA7QUFDQSxDQXBCRCxDOzs7Ozs7Ozs7OztBQ2RBLElBQUkwQyxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEOztBQUVOeEQsV0FBV0MsS0FBWCxDQUFpQjZDLFlBQWpCLEdBQWdDLFVBQVNULE1BQVQsRUFBaUJ3QyxTQUFqQixFQUE0QjdDLEtBQTVCLEVBQW1DO0FBQ2xFLEtBQUksQ0FBQ0ssTUFBRCxJQUFXLENBQUN3QyxTQUFoQixFQUEyQjtBQUMxQixTQUFPLEtBQVA7QUFDQTs7QUFFRCxPQUFNQyxPQUFPOUUsV0FBV0csTUFBWCxDQUFrQitELEtBQWxCLENBQXdCYSxFQUF4QixDQUEyQmxFLFdBQTNCLENBQXVDd0IsTUFBdkMsQ0FBYjs7QUFDQSxLQUFJLENBQUN5QyxJQUFMLEVBQVc7QUFDVixRQUFNLElBQUlkLE9BQU9DLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQzVEZSxhQUFVO0FBRGtELEdBQXZELENBQU47QUFHQTs7QUFFREgsYUFBWSxHQUFHdkMsTUFBSCxDQUFVdUMsU0FBVixDQUFaOztBQUNBLE9BQU1JLG9CQUFvQjlCLEVBQUUrQixLQUFGLENBQVFsRixXQUFXQyxLQUFYLENBQWlCa0YsUUFBakIsRUFBUixFQUFxQyxLQUFyQyxDQUExQjs7QUFDQSxPQUFNQyxtQkFBbUJqQyxFQUFFa0MsVUFBRixDQUFhUixTQUFiLEVBQXdCSSxpQkFBeEIsQ0FBekI7O0FBRUEsS0FBSSxDQUFDOUIsRUFBRW1DLE9BQUYsQ0FBVUYsZ0JBQVYsQ0FBTCxFQUFrQztBQUNqQyxPQUFLLE1BQU01RSxJQUFYLElBQW1CNEUsZ0JBQW5CLEVBQXFDO0FBQ3BDcEYsY0FBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCbEMsY0FBeEIsQ0FBdUNSLElBQXZDO0FBQ0E7QUFDRDs7QUFFRFIsWUFBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCSixZQUF4QixDQUFxQ1QsTUFBckMsRUFBNkN3QyxTQUE3QyxFQUF3RDdDLEtBQXhEO0FBRUEsUUFBTyxJQUFQO0FBQ0EsQ0F6QkQsQzs7Ozs7Ozs7Ozs7QUNGQSx3QkFDQWhDLFdBQVdDLEtBQVgsQ0FBaUJzRixvQkFBakIsR0FBd0MsQ0FDdkMsVUFBU0MsSUFBVCxFQUFlVixPQUFPLEVBQXRCLEVBQTBCO0FBQ3pCLEtBQUlVLEtBQUtDLENBQUwsS0FBVyxHQUFmLEVBQW9CO0FBQ25CLE1BQUksQ0FBQ1gsS0FBS2hFLEdBQU4sSUFBYWQsV0FBVzBGLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLDZCQUF4QixNQUEyRCxJQUE1RSxFQUFrRjtBQUNqRixVQUFPLElBQVA7QUFDQTs7QUFFRCxTQUFPM0YsV0FBV0MsS0FBWCxDQUFpQjJGLGFBQWpCLENBQStCZCxLQUFLaEUsR0FBcEMsRUFBeUMsYUFBekMsQ0FBUDtBQUNBO0FBQ0QsQ0FUc0MsRUFVdkMsVUFBUzBFLElBQVQsRUFBZVYsT0FBTyxFQUF0QixFQUEwQjtBQUN6QixPQUFNSCxlQUFlM0UsV0FBV0csTUFBWCxDQUFrQmlFLGFBQWxCLENBQWdDeUIsd0JBQWhDLENBQXlETCxLQUFLMUUsR0FBOUQsRUFBbUVnRSxLQUFLaEUsR0FBeEUsQ0FBckI7O0FBQ0EsS0FBSTZELFlBQUosRUFBa0I7QUFDakIsU0FBT0EsYUFBYW1CLEtBQXBCO0FBQ0E7QUFDRCxDQWZzQyxDQUF4Qzs7QUFrQkE5RixXQUFXQyxLQUFYLENBQWlCOEYsYUFBakIsR0FBaUMsVUFBU1AsSUFBVCxFQUFlVixJQUFmLEVBQXFCO0FBQ3JELFFBQU85RSxXQUFXQyxLQUFYLENBQWlCc0Ysb0JBQWpCLENBQXNDaEQsSUFBdEMsQ0FBNEN5RCxTQUFELElBQWU7QUFDaEUsU0FBT0EsVUFBVUMsSUFBVixDQUFlLElBQWYsRUFBcUJULElBQXJCLEVBQTJCVixJQUEzQixDQUFQO0FBQ0EsRUFGTSxDQUFQO0FBR0EsQ0FKRDs7QUFNQTlFLFdBQVdDLEtBQVgsQ0FBaUJpRyxzQkFBakIsR0FBMEMsVUFBU0YsU0FBVCxFQUFvQjtBQUM3RGhHLFlBQVdDLEtBQVgsQ0FBaUJzRixvQkFBakIsQ0FBc0NZLElBQXRDLENBQTJDSCxTQUEzQztBQUNBLENBRkQsQzs7Ozs7Ozs7Ozs7QUN6QkFoRyxXQUFXQyxLQUFYLENBQWlCa0YsUUFBakIsR0FBNEIsWUFBVztBQUN0QyxRQUFPbkYsV0FBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCdEMsSUFBeEIsR0FBK0IyRCxLQUEvQixFQUFQO0FBQ0EsQ0FGRCxDOzs7Ozs7Ozs7OztBQ0FBdkUsV0FBV0MsS0FBWCxDQUFpQm1HLGNBQWpCLEdBQWtDLFVBQVM1RCxRQUFULEVBQW1CUixLQUFuQixFQUEwQnZCLE9BQTFCLEVBQW1DO0FBQ3BFLFFBQU9ULFdBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixDQUF3Qm5CLGVBQXhCLENBQXdDUyxRQUF4QyxFQUFrRFIsS0FBbEQsRUFBeUR2QixPQUF6RCxDQUFQO0FBQ0EsQ0FGRCxDOzs7Ozs7Ozs7OztBQ0FBLFNBQVM0RixVQUFULENBQW9CaEUsTUFBcEIsRUFBNEJpRSxjQUFjLEVBQTFDLEVBQThDdEUsS0FBOUMsRUFBcUQ7QUFDcEQsUUFBT3NFLFlBQVkvRCxJQUFaLENBQWtCZ0UsWUFBRCxJQUFrQjtBQUN6QyxRQUFNbEYsYUFBYXJCLFdBQVdHLE1BQVgsQ0FBa0J1QixXQUFsQixDQUE4QlgsT0FBOUIsQ0FBc0N3RixZQUF0QyxDQUFuQjtBQUNBLFNBQU92RyxXQUFXRyxNQUFYLENBQWtCK0MsS0FBbEIsQ0FBd0JkLGFBQXhCLENBQXNDQyxNQUF0QyxFQUE4Q2hCLFdBQVdWLEtBQXpELEVBQWdFcUIsS0FBaEUsQ0FBUDtBQUNBLEVBSE0sQ0FBUDtBQUlBOztBQUVELFNBQVN3RSxHQUFULENBQWFuRSxNQUFiLEVBQXFCaUUsY0FBYyxFQUFuQyxFQUF1Q3RFLEtBQXZDLEVBQThDO0FBQzdDLFFBQU9zRSxZQUFZRyxLQUFaLENBQW1CRixZQUFELElBQWtCO0FBQzFDLFFBQU1sRixhQUFhckIsV0FBV0csTUFBWCxDQUFrQnVCLFdBQWxCLENBQThCWCxPQUE5QixDQUFzQ3dGLFlBQXRDLENBQW5CO0FBQ0EsU0FBT3ZHLFdBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixDQUF3QmQsYUFBeEIsQ0FBc0NDLE1BQXRDLEVBQThDaEIsV0FBV1YsS0FBekQsRUFBZ0VxQixLQUFoRSxDQUFQO0FBQ0EsRUFITSxDQUFQO0FBSUE7O0FBRUQsU0FBUzRELGFBQVQsQ0FBdUJ2RCxNQUF2QixFQUErQmlFLFdBQS9CLEVBQTRDdEUsS0FBNUMsRUFBbUQwRSxRQUFuRCxFQUE2RDtBQUM1RCxLQUFJLENBQUNyRSxNQUFMLEVBQWE7QUFDWixTQUFPLEtBQVA7QUFDQTs7QUFFRGlFLGVBQWMsR0FBR2hFLE1BQUgsQ0FBVWdFLFdBQVYsQ0FBZDtBQUNBLFFBQU9JLFNBQVNyRSxNQUFULEVBQWlCaUUsV0FBakIsRUFBOEJ0RSxLQUE5QixDQUFQO0FBQ0E7O0FBRURoQyxXQUFXQyxLQUFYLENBQWlCMEcsZ0JBQWpCLEdBQW9DLFVBQVN0RSxNQUFULEVBQWlCaUUsV0FBakIsRUFBOEJ0RSxLQUE5QixFQUFxQztBQUN4RSxRQUFPNEQsY0FBY3ZELE1BQWQsRUFBc0JpRSxXQUF0QixFQUFtQ3RFLEtBQW5DLEVBQTBDd0UsR0FBMUMsQ0FBUDtBQUNBLENBRkQ7O0FBSUF4RyxXQUFXQyxLQUFYLENBQWlCMkYsYUFBakIsR0FBaUM1RixXQUFXQyxLQUFYLENBQWlCMEcsZ0JBQWxEOztBQUVBM0csV0FBV0MsS0FBWCxDQUFpQjJHLHVCQUFqQixHQUEyQyxVQUFTdkUsTUFBVCxFQUFpQmlFLFdBQWpCLEVBQThCdEUsS0FBOUIsRUFBcUM7QUFDL0UsUUFBTzRELGNBQWN2RCxNQUFkLEVBQXNCaUUsV0FBdEIsRUFBbUN0RSxLQUFuQyxFQUEwQ3FFLFVBQTFDLENBQVA7QUFDQSxDQUZELEM7Ozs7Ozs7Ozs7O0FDN0JBckcsV0FBV0MsS0FBWCxDQUFpQjRHLE9BQWpCLEdBQTJCLFVBQVN4RSxNQUFULEVBQWlCd0MsU0FBakIsRUFBNEI3QyxLQUE1QixFQUFtQztBQUM3RDZDLGFBQVksR0FBR3ZDLE1BQUgsQ0FBVXVDLFNBQVYsQ0FBWjtBQUNBLFFBQU83RSxXQUFXRyxNQUFYLENBQWtCK0MsS0FBbEIsQ0FBd0JkLGFBQXhCLENBQXNDQyxNQUF0QyxFQUE4Q3dDLFNBQTlDLEVBQXlEN0MsS0FBekQsQ0FBUDtBQUNBLENBSEQsQzs7Ozs7Ozs7Ozs7QUNBQSxJQUFJbUIsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDs7QUFFTnhELFdBQVdDLEtBQVgsQ0FBaUI2RyxtQkFBakIsR0FBdUMsVUFBU3pFLE1BQVQsRUFBaUJ3QyxTQUFqQixFQUE0QjdDLEtBQTVCLEVBQW1DO0FBQ3pFLEtBQUksQ0FBQ0ssTUFBRCxJQUFXLENBQUN3QyxTQUFoQixFQUEyQjtBQUMxQixTQUFPLEtBQVA7QUFDQTs7QUFFRCxPQUFNQyxPQUFPOUUsV0FBV0csTUFBWCxDQUFrQitELEtBQWxCLENBQXdCckQsV0FBeEIsQ0FBb0N3QixNQUFwQyxDQUFiOztBQUVBLEtBQUksQ0FBQ3lDLElBQUwsRUFBVztBQUNWLFFBQU0sSUFBSWQsT0FBT0MsS0FBWCxDQUFpQixvQkFBakIsRUFBdUMsY0FBdkMsRUFBdUQ7QUFDNURlLGFBQVU7QUFEa0QsR0FBdkQsQ0FBTjtBQUdBOztBQUVESCxhQUFZLEdBQUd2QyxNQUFILENBQVV1QyxTQUFWLENBQVo7O0FBQ0EsT0FBTUksb0JBQW9COUIsRUFBRStCLEtBQUYsQ0FBUWxGLFdBQVdDLEtBQVgsQ0FBaUJrRixRQUFqQixFQUFSLEVBQXFDLEtBQXJDLENBQTFCOztBQUNBLE9BQU1DLG1CQUFtQmpDLEVBQUVrQyxVQUFGLENBQWFSLFNBQWIsRUFBd0JJLGlCQUF4QixDQUF6Qjs7QUFFQSxLQUFJLENBQUM5QixFQUFFbUMsT0FBRixDQUFVRixnQkFBVixDQUFMLEVBQWtDO0FBQ2pDLFFBQU0sSUFBSXBCLE9BQU9DLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQzVEZSxhQUFVO0FBRGtELEdBQXZELENBQU47QUFHQTs7QUFFRGhGLFlBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixDQUF3QkYsZUFBeEIsQ0FBd0NYLE1BQXhDLEVBQWdEd0MsU0FBaEQsRUFBMkQ3QyxLQUEzRDtBQUVBLFFBQU8sSUFBUDtBQUNBLENBMUJELEM7Ozs7Ozs7Ozs7O0FDRkFnQyxPQUFPK0MsT0FBUCxDQUFlO0FBQ2QsbUJBQWtCQyxTQUFsQixFQUE2QjtBQUM1QixPQUFLQyxPQUFMO0FBRUEsUUFBTUMsVUFBVWxILFdBQVdHLE1BQVgsQ0FBa0J1QixXQUFsQixDQUE4QmQsSUFBOUIsR0FBcUMyRCxLQUFyQyxFQUFoQjs7QUFFQSxNQUFJeUMscUJBQXFCRyxJQUF6QixFQUErQjtBQUM5QixVQUFPO0FBQ043RixZQUFRNEYsUUFBUUUsTUFBUixDQUFnQkMsTUFBRCxJQUFZO0FBQ2xDLFlBQU9BLE9BQU9DLFVBQVAsR0FBb0JOLFNBQTNCO0FBQ0EsS0FGTyxDQURGO0FBSU5PLFlBQVF2SCxXQUFXRyxNQUFYLENBQWtCdUIsV0FBbEIsQ0FBOEI4RixxQkFBOUIsQ0FBb0RSLFNBQXBELEVBQStELEVBQS9ELEVBQW1FO0FBQUNwRCxhQUFRO0FBQUM5QyxXQUFLLENBQU47QUFBUzJHLGtCQUFZO0FBQXJCO0FBQVQsS0FBbkUsRUFBc0dsRCxLQUF0RztBQUpGLElBQVA7QUFNQTs7QUFFRCxTQUFPMkMsT0FBUDtBQUNBOztBQWhCYSxDQUFmO0FBb0JBbEgsV0FBV0csTUFBWCxDQUFrQnVCLFdBQWxCLENBQThCZ0csRUFBOUIsQ0FBaUMsU0FBakMsRUFBNEMsQ0FBQ0MsSUFBRCxFQUFPdEcsVUFBUCxLQUFzQjtBQUNqRXJCLFlBQVc0SCxhQUFYLENBQXlCQywwQkFBekIsQ0FBb0QscUJBQXBELEVBQTJFRixJQUEzRSxFQUFpRnRHLFVBQWpGO0FBQ0EsQ0FGRCxFOzs7Ozs7Ozs7OztBQ3BCQTJDLE9BQU84RCxPQUFQLENBQWUsT0FBZixFQUF3QixZQUFXO0FBQ2xDLEtBQUksQ0FBQyxLQUFLekYsTUFBVixFQUFrQjtBQUNqQixTQUFPLEtBQUswRixLQUFMLEVBQVA7QUFDQTs7QUFFRCxRQUFPL0gsV0FBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCdEMsSUFBeEIsRUFBUDtBQUNBLENBTkQsRTs7Ozs7Ozs7Ozs7QUNBQW9ELE9BQU84RCxPQUFQLENBQWUsYUFBZixFQUE4QixVQUFTdEYsUUFBVCxFQUFtQlIsS0FBbkIsRUFBMEJnRyxRQUFRLEVBQWxDLEVBQXNDO0FBQ25FLEtBQUksQ0FBQyxLQUFLM0YsTUFBVixFQUFrQjtBQUNqQixTQUFPLEtBQUswRixLQUFMLEVBQVA7QUFDQTs7QUFFRCxLQUFJLENBQUMvSCxXQUFXQyxLQUFYLENBQWlCMkYsYUFBakIsQ0FBK0IsS0FBS3ZELE1BQXBDLEVBQTRDLG9CQUE1QyxDQUFMLEVBQXdFO0FBQ3ZFLFNBQU8sS0FBSzRGLEtBQUwsQ0FBVyxJQUFJakUsT0FBT0MsS0FBWCxDQUFpQixtQkFBakIsRUFBc0MsYUFBdEMsRUFBcUQ7QUFDdEU2RCxZQUFTO0FBRDZELEdBQXJELENBQVgsQ0FBUDtBQUdBOztBQUVELE9BQU1ySCxVQUFVO0FBQ2Z1SCxPQURlO0FBRWZFLFFBQU07QUFDTGpILFNBQU07QUFERDtBQUZTLEVBQWhCO0FBT0EsUUFBT2pCLFdBQVdDLEtBQVgsQ0FBaUJtRyxjQUFqQixDQUFnQzVELFFBQWhDLEVBQTBDUixLQUExQyxFQUFpRHZCLE9BQWpELENBQVA7QUFDQSxDQW5CRCxFOzs7Ozs7Ozs7OztBQ0FBLElBQUkwQyxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEO0FBRU5RLE9BQU8rQyxPQUFQLENBQWU7QUFDZCwrQkFBOEJ2RSxRQUE5QixFQUF3QzJGLFFBQXhDLEVBQWtEbkcsS0FBbEQsRUFBeUQ7QUFDeEQsTUFBSSxDQUFDZ0MsT0FBTzNCLE1BQVAsRUFBRCxJQUFvQixDQUFDckMsV0FBV0MsS0FBWCxDQUFpQjJGLGFBQWpCLENBQStCNUIsT0FBTzNCLE1BQVAsRUFBL0IsRUFBZ0Qsb0JBQWhELENBQXpCLEVBQWdHO0FBQy9GLFNBQU0sSUFBSTJCLE9BQU9DLEtBQVgsQ0FBaUIsMEJBQWpCLEVBQTZDLHNDQUE3QyxFQUFxRjtBQUMxRm1FLFlBQVEsNkJBRGtGO0FBRTFGQyxZQUFRO0FBRmtGLElBQXJGLENBQU47QUFJQTs7QUFFRCxNQUFJLENBQUM3RixRQUFELElBQWEsQ0FBQ1csRUFBRW1GLFFBQUYsQ0FBVzlGLFFBQVgsQ0FBZCxJQUFzQyxDQUFDMkYsUUFBdkMsSUFBbUQsQ0FBQ2hGLEVBQUVtRixRQUFGLENBQVdILFFBQVgsQ0FBeEQsRUFBOEU7QUFDN0UsU0FBTSxJQUFJbkUsT0FBT0MsS0FBWCxDQUFpQix5QkFBakIsRUFBNEMsbUJBQTVDLEVBQWlFO0FBQ3RFbUUsWUFBUTtBQUQ4RCxJQUFqRSxDQUFOO0FBR0E7O0FBRUQsTUFBSTVGLGFBQWEsT0FBYixJQUF3QixDQUFDeEMsV0FBV0MsS0FBWCxDQUFpQjJGLGFBQWpCLENBQStCNUIsT0FBTzNCLE1BQVAsRUFBL0IsRUFBZ0QsbUJBQWhELENBQTdCLEVBQW1HO0FBQ2xHLFNBQU0sSUFBSTJCLE9BQU9DLEtBQVgsQ0FBaUIsMEJBQWpCLEVBQTZDLGdDQUE3QyxFQUErRTtBQUNwRm1FLFlBQVEsNkJBRDRFO0FBRXBGQyxZQUFRO0FBRjRFLElBQS9FLENBQU47QUFJQTs7QUFFRCxRQUFNdkQsT0FBTzlFLFdBQVdHLE1BQVgsQ0FBa0IrRCxLQUFsQixDQUF3QnFFLGlCQUF4QixDQUEwQ0osUUFBMUMsRUFBb0Q7QUFDaEV2RSxXQUFRO0FBQ1A5QyxTQUFLO0FBREU7QUFEd0QsR0FBcEQsQ0FBYjs7QUFNQSxNQUFJLENBQUNnRSxJQUFELElBQVMsQ0FBQ0EsS0FBS2hFLEdBQW5CLEVBQXdCO0FBQ3ZCLFNBQU0sSUFBSWtELE9BQU9DLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQzVEbUUsWUFBUTtBQURvRCxJQUF2RCxDQUFOO0FBR0E7O0FBRUQsUUFBTUksTUFBTXhJLFdBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixDQUF3QkosWUFBeEIsQ0FBcUNnQyxLQUFLaEUsR0FBMUMsRUFBK0MwQixRQUEvQyxFQUF5RFIsS0FBekQsQ0FBWjs7QUFFQSxNQUFJaEMsV0FBVzBGLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGlCQUF4QixDQUFKLEVBQWdEO0FBQy9DM0YsY0FBVzRILGFBQVgsQ0FBeUJhLFlBQXpCLENBQXNDLGNBQXRDLEVBQXNEO0FBQ3JEZCxVQUFNLE9BRCtDO0FBRXJEN0csU0FBSzBCLFFBRmdEO0FBR3JEb0MsT0FBRztBQUNGOUQsVUFBS2dFLEtBQUtoRSxHQURSO0FBRUZxSDtBQUZFLEtBSGtEO0FBT3JEbkc7QUFQcUQsSUFBdEQ7QUFTQTs7QUFFRCxTQUFPd0csR0FBUDtBQUNBOztBQWpEYSxDQUFmLEU7Ozs7Ozs7Ozs7O0FDRkF4RSxPQUFPK0MsT0FBUCxDQUFlO0FBQ2QsNEJBQTJCdkUsUUFBM0IsRUFBcUM7QUFDcEMsTUFBSSxDQUFDd0IsT0FBTzNCLE1BQVAsRUFBRCxJQUFvQixDQUFDckMsV0FBV0MsS0FBWCxDQUFpQjJGLGFBQWpCLENBQStCNUIsT0FBTzNCLE1BQVAsRUFBL0IsRUFBZ0Qsb0JBQWhELENBQXpCLEVBQWdHO0FBQy9GLFNBQU0sSUFBSTJCLE9BQU9DLEtBQVgsQ0FBaUIsMEJBQWpCLEVBQTZDLHNDQUE3QyxFQUFxRjtBQUMxRm1FLFlBQVEsMEJBRGtGO0FBRTFGQyxZQUFRO0FBRmtGLElBQXJGLENBQU47QUFJQTs7QUFFRCxRQUFNN0gsT0FBT1IsV0FBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCbkMsT0FBeEIsQ0FBZ0N5QixRQUFoQyxDQUFiOztBQUNBLE1BQUksQ0FBQ2hDLElBQUwsRUFBVztBQUNWLFNBQU0sSUFBSXdELE9BQU9DLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQzVEbUUsWUFBUTtBQURvRCxJQUF2RCxDQUFOO0FBR0E7O0FBRUQsTUFBSTVILEtBQUtxQyxTQUFULEVBQW9CO0FBQ25CLFNBQU0sSUFBSW1CLE9BQU9DLEtBQVgsQ0FBaUIsNkJBQWpCLEVBQWdELGdDQUFoRCxFQUFrRjtBQUN2Rm1FLFlBQVE7QUFEK0UsSUFBbEYsQ0FBTjtBQUdBOztBQUVELFFBQU1uRyxZQUFZekIsS0FBS3dCLEtBQUwsSUFBYyxPQUFoQztBQUNBLFFBQU1FLFFBQVFsQyxXQUFXRyxNQUFYLENBQWtCOEIsU0FBbEIsQ0FBZDtBQUNBLFFBQU15RyxnQkFBZ0J4RyxTQUFTQSxNQUFNQyxnQkFBZixJQUFtQ0QsTUFBTUMsZ0JBQU4sQ0FBdUJLLFFBQXZCLENBQXpEOztBQUVBLE1BQUlrRyxpQkFBaUJBLGNBQWNDLEtBQWQsS0FBd0IsQ0FBN0MsRUFBZ0Q7QUFDL0MsU0FBTSxJQUFJM0UsT0FBT0MsS0FBWCxDQUFpQixtQkFBakIsRUFBc0MseUNBQXRDLEVBQWlGO0FBQ3RGbUUsWUFBUTtBQUQ4RSxJQUFqRixDQUFOO0FBR0E7O0FBRUQsU0FBT3BJLFdBQVdHLE1BQVgsQ0FBa0IrQyxLQUFsQixDQUF3QnFFLE1BQXhCLENBQStCL0csS0FBS1MsSUFBcEMsQ0FBUDtBQUNBOztBQWpDYSxDQUFmLEU7Ozs7Ozs7Ozs7O0FDQUEsSUFBSWtDLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFFTlEsT0FBTytDLE9BQVAsQ0FBZTtBQUNkLG9DQUFtQ3ZFLFFBQW5DLEVBQTZDMkYsUUFBN0MsRUFBdURuRyxLQUF2RCxFQUE4RDtBQUM3RCxNQUFJLENBQUNnQyxPQUFPM0IsTUFBUCxFQUFELElBQW9CLENBQUNyQyxXQUFXQyxLQUFYLENBQWlCMkYsYUFBakIsQ0FBK0I1QixPQUFPM0IsTUFBUCxFQUEvQixFQUFnRCxvQkFBaEQsQ0FBekIsRUFBZ0c7QUFDL0YsU0FBTSxJQUFJMkIsT0FBT0MsS0FBWCxDQUFpQiwwQkFBakIsRUFBNkMsbUNBQTdDLEVBQWtGO0FBQ3ZGbUUsWUFBUSxrQ0FEK0U7QUFFdkZDLFlBQVE7QUFGK0UsSUFBbEYsQ0FBTjtBQUlBOztBQUVELE1BQUksQ0FBQzdGLFFBQUQsSUFBYSxDQUFDVyxFQUFFbUYsUUFBRixDQUFXOUYsUUFBWCxDQUFkLElBQXNDLENBQUMyRixRQUF2QyxJQUFtRCxDQUFDaEYsRUFBRW1GLFFBQUYsQ0FBV0gsUUFBWCxDQUF4RCxFQUE4RTtBQUM3RSxTQUFNLElBQUluRSxPQUFPQyxLQUFYLENBQWlCLHlCQUFqQixFQUE0QyxtQkFBNUMsRUFBaUU7QUFDdEVtRSxZQUFRO0FBRDhELElBQWpFLENBQU47QUFHQTs7QUFFRCxRQUFNdEQsT0FBT2QsT0FBT1EsS0FBUCxDQUFhekQsT0FBYixDQUFxQjtBQUNqQ29IO0FBRGlDLEdBQXJCLEVBRVY7QUFDRnZFLFdBQVE7QUFDUDlDLFNBQUssQ0FERTtBQUVQSCxXQUFPO0FBRkE7QUFETixHQUZVLENBQWI7O0FBU0EsTUFBSSxDQUFDbUUsSUFBRCxJQUFTLENBQUNBLEtBQUtoRSxHQUFuQixFQUF3QjtBQUN2QixTQUFNLElBQUlrRCxPQUFPQyxLQUFYLENBQWlCLG9CQUFqQixFQUF1QyxjQUF2QyxFQUF1RDtBQUM1RG1FLFlBQVE7QUFEb0QsSUFBdkQsQ0FBTjtBQUdBLEdBM0I0RCxDQTZCN0Q7OztBQUNBLE1BQUk1RixhQUFhLE9BQWpCLEVBQTBCO0FBQ3pCLFNBQU1vRyxhQUFhNUUsT0FBT1EsS0FBUCxDQUFhNUQsSUFBYixDQUFrQjtBQUNwQ0QsV0FBTztBQUNOd0QsVUFBSyxDQUFDLE9BQUQ7QUFEQztBQUQ2QixJQUFsQixFQUloQndFLEtBSmdCLEVBQW5CO0FBTUEsU0FBTUUsY0FBYy9ELEtBQUtuRSxLQUFMLENBQVdtSSxPQUFYLENBQW1CLE9BQW5CLElBQThCLENBQUMsQ0FBbkQ7O0FBQ0EsT0FBSUYsZUFBZSxDQUFmLElBQW9CQyxXQUF4QixFQUFxQztBQUNwQyxVQUFNLElBQUk3RSxPQUFPQyxLQUFYLENBQWlCLDBCQUFqQixFQUE2QywrQ0FBN0MsRUFBOEY7QUFDbkdtRSxhQUFRLG9CQUQyRjtBQUVuR0MsYUFBUTtBQUYyRixLQUE5RixDQUFOO0FBSUE7QUFDRDs7QUFFRCxRQUFNZCxTQUFTdkgsV0FBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCRixlQUF4QixDQUF3QzhCLEtBQUtoRSxHQUE3QyxFQUFrRDBCLFFBQWxELEVBQTREUixLQUE1RCxDQUFmOztBQUNBLE1BQUloQyxXQUFXMEYsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsaUJBQXhCLENBQUosRUFBZ0Q7QUFDL0MzRixjQUFXNEgsYUFBWCxDQUF5QmEsWUFBekIsQ0FBc0MsY0FBdEMsRUFBc0Q7QUFDckRkLFVBQU0sU0FEK0M7QUFFckQ3RyxTQUFLMEIsUUFGZ0Q7QUFHckRvQyxPQUFHO0FBQ0Y5RCxVQUFLZ0UsS0FBS2hFLEdBRFI7QUFFRnFIO0FBRkUsS0FIa0Q7QUFPckRuRztBQVBxRCxJQUF0RDtBQVNBOztBQUVELFNBQU91RixNQUFQO0FBQ0E7O0FBN0RhLENBQWYsRTs7Ozs7Ozs7Ozs7QUNGQXZELE9BQU8rQyxPQUFQLENBQWU7QUFDZCwwQkFBeUJnQyxRQUF6QixFQUFtQztBQUNsQyxNQUFJLENBQUMvRSxPQUFPM0IsTUFBUCxFQUFELElBQW9CLENBQUNyQyxXQUFXQyxLQUFYLENBQWlCMkYsYUFBakIsQ0FBK0I1QixPQUFPM0IsTUFBUCxFQUEvQixFQUFnRCxvQkFBaEQsQ0FBekIsRUFBZ0c7QUFDL0YsU0FBTSxJQUFJMkIsT0FBT0MsS0FBWCxDQUFpQiwwQkFBakIsRUFBNkMsc0NBQTdDLEVBQXFGO0FBQzFGbUUsWUFBUSx3QkFEa0Y7QUFFMUZDLFlBQVE7QUFGa0YsSUFBckYsQ0FBTjtBQUlBOztBQUVELE1BQUksQ0FBQ1UsU0FBUzlILElBQWQsRUFBb0I7QUFDbkIsU0FBTSxJQUFJK0MsT0FBT0MsS0FBWCxDQUFpQiwwQkFBakIsRUFBNkMsdUJBQTdDLEVBQXNFO0FBQzNFbUUsWUFBUTtBQURtRSxJQUF0RSxDQUFOO0FBR0E7O0FBRUQsTUFBSSxDQUFDLE9BQUQsRUFBVSxlQUFWLEVBQTJCWSxRQUEzQixDQUFvQ0QsU0FBUy9HLEtBQTdDLE1BQXdELEtBQTVELEVBQW1FO0FBQ2xFK0csWUFBUy9HLEtBQVQsR0FBaUIsT0FBakI7QUFDQTs7QUFFRCxRQUFNVixTQUFTdEIsV0FBV0csTUFBWCxDQUFrQitDLEtBQWxCLENBQXdCbEMsY0FBeEIsQ0FBdUMrSCxTQUFTOUgsSUFBaEQsRUFBc0Q4SCxTQUFTL0csS0FBL0QsRUFBc0UrRyxTQUFTckcsV0FBL0UsQ0FBZjs7QUFDQSxNQUFJMUMsV0FBVzBGLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGlCQUF4QixDQUFKLEVBQWdEO0FBQy9DM0YsY0FBVzRILGFBQVgsQ0FBeUJhLFlBQXpCLENBQXNDLGNBQXRDLEVBQXNEO0FBQ3JEZCxVQUFNLFNBRCtDO0FBRXJEN0csU0FBS2lJLFNBQVM5SDtBQUZ1QyxJQUF0RDtBQUlBOztBQUVELFNBQU9LLE1BQVA7QUFDQTs7QUE1QmEsQ0FBZixFOzs7Ozs7Ozs7OztBQ0FBMEMsT0FBTytDLE9BQVAsQ0FBZTtBQUNkLHFDQUFvQzFGLFVBQXBDLEVBQWdEYixJQUFoRCxFQUFzRDtBQUNyRCxNQUFJLENBQUN3RCxPQUFPM0IsTUFBUCxFQUFELElBQW9CLENBQUNyQyxXQUFXQyxLQUFYLENBQWlCMkYsYUFBakIsQ0FBK0I1QixPQUFPM0IsTUFBUCxFQUEvQixFQUFnRCxvQkFBaEQsQ0FBekIsRUFBZ0c7QUFDL0YsU0FBTSxJQUFJMkIsT0FBT0MsS0FBWCxDQUFpQiwwQkFBakIsRUFBNkMsa0NBQTdDLEVBQWlGO0FBQ3RGbUUsWUFBUSxtQ0FEOEU7QUFFdEZDLFlBQVE7QUFGOEUsSUFBakYsQ0FBTjtBQUlBOztBQUVELFNBQU9ySSxXQUFXRyxNQUFYLENBQWtCdUIsV0FBbEIsQ0FBOEJOLE9BQTlCLENBQXNDQyxVQUF0QyxFQUFrRGIsSUFBbEQsQ0FBUDtBQUNBOztBQVZhLENBQWYsRTs7Ozs7Ozs7Ozs7QUNBQXdELE9BQU8rQyxPQUFQLENBQWU7QUFDZCwwQ0FBeUMxRixVQUF6QyxFQUFxRGIsSUFBckQsRUFBMkQ7QUFDMUQsTUFBSSxDQUFDd0QsT0FBTzNCLE1BQVAsRUFBRCxJQUFvQixDQUFDckMsV0FBV0MsS0FBWCxDQUFpQjJGLGFBQWpCLENBQStCNUIsT0FBTzNCLE1BQVAsRUFBL0IsRUFBZ0Qsb0JBQWhELENBQXpCLEVBQWdHO0FBQy9GLFNBQU0sSUFBSTJCLE9BQU9DLEtBQVgsQ0FBaUIsMEJBQWpCLEVBQTZDLHNDQUE3QyxFQUFxRjtBQUMxRm1FLFlBQVEsd0NBRGtGO0FBRTFGQyxZQUFRO0FBRmtGLElBQXJGLENBQU47QUFJQTs7QUFFRCxTQUFPckksV0FBV0csTUFBWCxDQUFrQnVCLFdBQWxCLENBQThCRixVQUE5QixDQUF5Q0gsVUFBekMsRUFBcURiLElBQXJELENBQVA7QUFDQTs7QUFWYSxDQUFmLEU7Ozs7Ozs7Ozs7O0FDQUEsK0JBRUF3RCxPQUFPaUYsT0FBUCxDQUFlLFlBQVc7QUFDekI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFNM0MsY0FBYyxDQUNuQjtBQUFFeEYsT0FBSyxvQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUFEbUIsRUFFbkI7QUFBRUcsT0FBSyxtQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUFGbUIsRUFHbkI7QUFBRUcsT0FBSyx5QkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQsRUFBVSxPQUFWLEVBQW1CLFdBQW5CO0FBQWhELEVBSG1CLEVBSW5CO0FBQUVHLE9BQUssd0JBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBSm1CLEVBS25CO0FBQUVHLE9BQUssd0JBQVA7QUFBd0NILFNBQVE7QUFBaEQsRUFMbUIsRUFNbkI7QUFBRUcsT0FBSyxjQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE9BQVY7QUFBaEQsRUFObUIsRUFPbkI7QUFBRUcsT0FBSyxtQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUFQbUIsRUFRbkI7QUFBRUcsT0FBSyxVQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE9BQVYsRUFBbUIsV0FBbkI7QUFBaEQsRUFSbUIsRUFTbkI7QUFBRUcsT0FBSyxlQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQVRtQixFQVVuQjtBQUFFRyxPQUFLLG9CQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQVZtQixFQVduQjtBQUFFRyxPQUFLLFVBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsTUFBVixFQUFrQixLQUFsQjtBQUFoRCxFQVhtQixFQVluQjtBQUFFRyxPQUFLLFVBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsTUFBVixFQUFrQixLQUFsQjtBQUFoRCxFQVptQixFQWFuQjtBQUFFRyxPQUFLLFVBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsTUFBVixFQUFrQixLQUFsQjtBQUFoRCxFQWJtQixFQWNuQjtBQUFFRyxPQUFLLGFBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBZG1CLEVBZW5CO0FBQUVHLE9BQUssdUJBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBZm1CLEVBZTBDO0FBQzdEO0FBQUVHLE9BQUssVUFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUFoQm1CLEVBaUJuQjtBQUFFRyxPQUFLLFVBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBakJtQixFQWtCbkI7QUFBRUcsT0FBSyxnQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQsRUFBVSxPQUFWLEVBQW1CLFdBQW5CO0FBQWhELEVBbEJtQixFQW1CbkI7QUFBRUcsT0FBSyxVQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQW5CbUIsRUFvQm5CO0FBQUVHLE9BQUssYUFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUFwQm1CLEVBcUJuQjtBQUFFRyxPQUFLLGNBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsT0FBVixFQUFtQixXQUFuQjtBQUFoRCxFQXJCbUIsRUFzQm5CO0FBQUVHLE9BQUssK0JBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBdEJtQixFQXVCbkI7QUFBRUcsT0FBSyxzQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUF2Qm1CLEVBd0JuQjtBQUFFRyxPQUFLLDBCQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQXhCbUIsRUF5Qm5CO0FBQUVHLE9BQUsseUJBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBekJtQixFQTBCbkI7QUFBRUcsT0FBSyxXQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE9BQVYsRUFBbUIsV0FBbkI7QUFBaEQsRUExQm1CLEVBMkJuQjtBQUFFRyxPQUFLLHNCQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE9BQVY7QUFBaEQsRUEzQm1CLEVBNEJuQjtBQUFFRyxPQUFLLHdCQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLEtBQVY7QUFBaEQsRUE1Qm1CLEVBNkJuQjtBQUFFRyxPQUFLLGVBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBN0JtQixFQThCbkI7QUFBRUcsT0FBSyxjQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQTlCbUIsRUErQm5CO0FBQUVHLE9BQUsscUJBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBL0JtQixFQWdDbkI7QUFBRUcsT0FBSyx5QkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQsRUFBVSxLQUFWO0FBQWhELEVBaENtQixFQWlDbkI7QUFBRUcsT0FBSyxtQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUFqQ21CLEVBa0NuQjtBQUFFRyxPQUFLLGFBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsT0FBVixFQUFtQixXQUFuQixFQUFnQyxNQUFoQztBQUFoRCxFQWxDbUIsRUFtQ25CO0FBQUVHLE9BQUssV0FBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQsRUFBVSxPQUFWLEVBQW1CLFdBQW5CO0FBQWhELEVBbkNtQixFQW9DbkI7QUFBRUcsT0FBSyxhQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE9BQVYsRUFBbUIsV0FBbkI7QUFBaEQsRUFwQ21CLEVBcUNuQjtBQUFFRyxPQUFLLFlBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBckNtQixFQXNDbkI7QUFBRUcsT0FBSyxlQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQXRDbUIsRUF1Q25CO0FBQUVHLE9BQUssZUFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQsRUFBVSxPQUFWO0FBQWhELEVBdkNtQixFQXdDbkI7QUFBRUcsT0FBSyxXQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE9BQVY7QUFBaEQsRUF4Q21CLEVBeUNuQjtBQUFFRyxPQUFLLG9CQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLEtBQVY7QUFBaEQsRUF6Q21CLEVBMENuQjtBQUFFRyxPQUFLLFlBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsT0FBVjtBQUFoRCxFQTFDbUIsRUEyQ25CO0FBQUVHLE9BQUssZ0JBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBM0NtQixFQTRDbkI7QUFBRUcsT0FBSyxhQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE1BQVYsRUFBa0IsS0FBbEIsRUFBeUIsV0FBekI7QUFBaEQsRUE1Q21CLEVBNkNuQjtBQUFFRyxPQUFLLDRCQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQTdDbUIsRUE4Q25CO0FBQUVHLE9BQUssYUFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQsRUFBVSxNQUFWLEVBQWtCLEtBQWxCO0FBQWhELEVBOUNtQixFQStDbkI7QUFBRUcsT0FBSywyQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUEvQ21CLEVBZ0RuQjtBQUFFRyxPQUFLLGNBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsTUFBVixFQUFrQixXQUFsQjtBQUFoRCxFQWhEbUIsRUFpRG5CO0FBQUVHLE9BQUssa0JBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsS0FBVixFQUFpQixXQUFqQjtBQUFoRCxFQWpEbUIsRUFrRG5CO0FBQUVHLE9BQUssZ0JBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBbERtQixFQW1EbkI7QUFBRUcsT0FBSyxXQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQW5EbUIsRUFvRG5CO0FBQUVHLE9BQUssMEJBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBcERtQixFQXFEbkI7QUFBRUcsT0FBSyxhQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRCxFQUFVLE1BQVYsRUFBa0IsV0FBbEI7QUFBaEQsRUFyRG1CLEVBc0RuQjtBQUFFRyxPQUFLLHlCQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQXREbUIsRUF1RG5CO0FBQUVHLE9BQUssMEJBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFEO0FBQWhELEVBdkRtQixFQXdEbkI7QUFBRUcsT0FBSyxpQkFBUDtBQUF3Q0gsU0FBUSxDQUFDLE9BQUQ7QUFBaEQsRUF4RG1CLEVBeURuQjtBQUFFRyxPQUFLLDBCQUFQO0FBQXdDSCxTQUFRLENBQUMsT0FBRDtBQUFoRCxFQXpEbUIsRUEwRG5CO0FBQUVHLE9BQUssZ0JBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsTUFBVixFQUFrQixXQUFsQjtBQUFoRCxFQTFEbUIsRUEyRG5CO0FBQUVHLE9BQUssbUJBQVA7QUFBd0NILFNBQVEsQ0FBQyxPQUFELEVBQVUsT0FBVixFQUFtQixXQUFuQixFQUFnQyxNQUFoQztBQUFoRCxFQTNEbUIsQ0FBcEI7O0FBOERBLE1BQUssTUFBTVUsVUFBWCxJQUF5QmlGLFdBQXpCLEVBQXNDO0FBQ3JDLE1BQUksQ0FBQ3RHLFdBQVdHLE1BQVgsQ0FBa0J1QixXQUFsQixDQUE4QmIsV0FBOUIsQ0FBMENRLFdBQVdQLEdBQXJELENBQUwsRUFBZ0U7QUFDL0RkLGNBQVdHLE1BQVgsQ0FBa0J1QixXQUFsQixDQUE4QlIsTUFBOUIsQ0FBcUNHLFdBQVdQLEdBQWhELEVBQXFEO0FBQUNLLFVBQU1FO0FBQVAsSUFBckQ7QUFDQTtBQUNEOztBQUVELE9BQU02SCxlQUFlLENBQ3BCO0FBQUVqSSxRQUFNLE9BQVI7QUFBcUJlLFNBQU8sT0FBNUI7QUFBNkNVLGVBQWE7QUFBMUQsRUFEb0IsRUFFcEI7QUFBRXpCLFFBQU0sV0FBUjtBQUFxQmUsU0FBTyxlQUE1QjtBQUE2Q1UsZUFBYTtBQUExRCxFQUZvQixFQUdwQjtBQUFFekIsUUFBTSxRQUFSO0FBQXFCZSxTQUFPLGVBQTVCO0FBQTZDVSxlQUFhO0FBQTFELEVBSG9CLEVBSXBCO0FBQUV6QixRQUFNLE9BQVI7QUFBcUJlLFNBQU8sZUFBNUI7QUFBNkNVLGVBQWE7QUFBMUQsRUFKb0IsRUFLcEI7QUFBRXpCLFFBQU0sTUFBUjtBQUFxQmUsU0FBTyxPQUE1QjtBQUE2Q1UsZUFBYTtBQUExRCxFQUxvQixFQU1wQjtBQUFFekIsUUFBTSxLQUFSO0FBQXFCZSxTQUFPLE9BQTVCO0FBQTZDVSxlQUFhO0FBQTFELEVBTm9CLEVBT3BCO0FBQUV6QixRQUFNLE9BQVI7QUFBcUJlLFNBQU8sT0FBNUI7QUFBNkNVLGVBQWE7QUFBMUQsRUFQb0IsRUFRcEI7QUFBRXpCLFFBQU0sV0FBUjtBQUFxQmUsU0FBTyxPQUE1QjtBQUE2Q1UsZUFBYTtBQUExRCxFQVJvQixDQUFyQjs7QUFXQSxNQUFLLE1BQU1sQyxJQUFYLElBQW1CMEksWUFBbkIsRUFBaUM7QUFDaENsSixhQUFXRyxNQUFYLENBQWtCK0MsS0FBbEIsQ0FBd0JoQyxNQUF4QixDQUErQjtBQUFFSixRQUFLTixLQUFLUztBQUFaLEdBQS9CLEVBQW1EO0FBQUVrSSxpQkFBYztBQUFFbkgsV0FBT3hCLEtBQUt3QixLQUFkO0FBQXFCVSxpQkFBYWxDLEtBQUtrQyxXQUFMLElBQW9CLEVBQXREO0FBQTBERyxlQUFXO0FBQXJFO0FBQWhCLEdBQW5EO0FBQ0E7QUFDRCxDQXZGRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2F1dGhvcml6YXRpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJSb2NrZXRDaGF0LmF1dGh6ID0ge307XG4iLCJjbGFzcyBNb2RlbFBlcm1pc3Npb25zIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlciguLi5hcmd1bWVudHMpO1xuXHR9XG5cblx0Ly8gRklORFxuXHRmaW5kQnlSb2xlKHJvbGUsIG9wdGlvbnMpIHtcblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdHJvbGVzOiByb2xlXG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLmZpbmQocXVlcnksIG9wdGlvbnMpO1xuXHR9XG5cblx0ZmluZE9uZUJ5SWQoX2lkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZE9uZShfaWQpO1xuXHR9XG5cblx0Y3JlYXRlT3JVcGRhdGUobmFtZSwgcm9sZXMpIHtcblx0XHR0aGlzLnVwc2VydCh7IF9pZDogbmFtZSB9LCB7ICRzZXQ6IHsgcm9sZXMgfSB9KTtcblx0fVxuXG5cdGFkZFJvbGUocGVybWlzc2lvbiwgcm9sZSkge1xuXHRcdHRoaXMudXBkYXRlKHsgX2lkOiBwZXJtaXNzaW9uIH0sIHsgJGFkZFRvU2V0OiB7IHJvbGVzOiByb2xlIH0gfSk7XG5cdH1cblxuXHRyZW1vdmVSb2xlKHBlcm1pc3Npb24sIHJvbGUpIHtcblx0XHR0aGlzLnVwZGF0ZSh7IF9pZDogcGVybWlzc2lvbiB9LCB7ICRwdWxsOiB7IHJvbGVzOiByb2xlIH0gfSk7XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMgPSBuZXcgTW9kZWxQZXJtaXNzaW9ucygncGVybWlzc2lvbnMnLCB0cnVlKTtcblJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLmNhY2hlLmxvYWQoKTtcbiIsImNsYXNzIE1vZGVsUm9sZXMgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKC4uLmFyZ3VtZW50cyk7XG5cdFx0dGhpcy50cnlFbnN1cmVJbmRleCh7ICduYW1lJzogMSB9KTtcblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ3Njb3BlJzogMSB9KTtcblx0fVxuXG5cdGZpbmRVc2Vyc0luUm9sZShuYW1lLCBzY29wZSwgb3B0aW9ucykge1xuXHRcdGNvbnN0IHJvbGUgPSB0aGlzLmZpbmRPbmUobmFtZSk7XG5cdFx0Y29uc3Qgcm9sZVNjb3BlID0gKHJvbGUgJiYgcm9sZS5zY29wZSkgfHwgJ1VzZXJzJztcblx0XHRjb25zdCBtb2RlbCA9IFJvY2tldENoYXQubW9kZWxzW3JvbGVTY29wZV07XG5cblx0XHRyZXR1cm4gbW9kZWwgJiYgbW9kZWwuZmluZFVzZXJzSW5Sb2xlcyAmJiBtb2RlbC5maW5kVXNlcnNJblJvbGVzKG5hbWUsIHNjb3BlLCBvcHRpb25zKTtcblx0fVxuXG5cdGlzVXNlckluUm9sZXModXNlcklkLCByb2xlcywgc2NvcGUpIHtcblx0XHRyb2xlcyA9IFtdLmNvbmNhdChyb2xlcyk7XG5cdFx0cmV0dXJuIHJvbGVzLnNvbWUoKHJvbGVOYW1lKSA9PiB7XG5cdFx0XHRjb25zdCByb2xlID0gdGhpcy5maW5kT25lKHJvbGVOYW1lKTtcblx0XHRcdGNvbnN0IHJvbGVTY29wZSA9IChyb2xlICYmIHJvbGUuc2NvcGUpIHx8ICdVc2Vycyc7XG5cdFx0XHRjb25zdCBtb2RlbCA9IFJvY2tldENoYXQubW9kZWxzW3JvbGVTY29wZV07XG5cblx0XHRcdHJldHVybiBtb2RlbCAmJiBtb2RlbC5pc1VzZXJJblJvbGUgJiYgbW9kZWwuaXNVc2VySW5Sb2xlKHVzZXJJZCwgcm9sZU5hbWUsIHNjb3BlKTtcblx0XHR9KTtcblx0fVxuXG5cdGNyZWF0ZU9yVXBkYXRlKG5hbWUsIHNjb3BlID0gJ1VzZXJzJywgZGVzY3JpcHRpb24sIHByb3RlY3RlZFJvbGUpIHtcblx0XHRjb25zdCB1cGRhdGVEYXRhID0ge307XG5cdFx0dXBkYXRlRGF0YS5uYW1lID0gbmFtZTtcblx0XHR1cGRhdGVEYXRhLnNjb3BlID0gc2NvcGU7XG5cblx0XHRpZiAoZGVzY3JpcHRpb24gIT0gbnVsbCkge1xuXHRcdFx0dXBkYXRlRGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuXHRcdH1cblxuXHRcdGlmIChwcm90ZWN0ZWRSb2xlKSB7XG5cdFx0XHR1cGRhdGVEYXRhLnByb3RlY3RlZCA9IHByb3RlY3RlZFJvbGU7XG5cdFx0fVxuXG5cdFx0dGhpcy51cHNlcnQoeyBfaWQ6IG5hbWUgfSwgeyAkc2V0OiB1cGRhdGVEYXRhIH0pO1xuXHR9XG5cblx0YWRkVXNlclJvbGVzKHVzZXJJZCwgcm9sZXMsIHNjb3BlKSB7XG5cdFx0cm9sZXMgPSBbXS5jb25jYXQocm9sZXMpO1xuXHRcdGZvciAoY29uc3Qgcm9sZU5hbWUgb2Ygcm9sZXMpIHtcblx0XHRcdGNvbnN0IHJvbGUgPSB0aGlzLmZpbmRPbmUocm9sZU5hbWUpO1xuXHRcdFx0Y29uc3Qgcm9sZVNjb3BlID0gKHJvbGUgJiYgcm9sZS5zY29wZSkgfHwgJ1VzZXJzJztcblx0XHRcdGNvbnN0IG1vZGVsID0gUm9ja2V0Q2hhdC5tb2RlbHNbcm9sZVNjb3BlXTtcblxuXHRcdFx0bW9kZWwgJiYgbW9kZWwuYWRkUm9sZXNCeVVzZXJJZCAmJiBtb2RlbC5hZGRSb2xlc0J5VXNlcklkKHVzZXJJZCwgcm9sZU5hbWUsIHNjb3BlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZW1vdmVVc2VyUm9sZXModXNlcklkLCByb2xlcywgc2NvcGUpIHtcblx0XHRyb2xlcyA9IFtdLmNvbmNhdChyb2xlcyk7XG5cdFx0Zm9yIChjb25zdCByb2xlTmFtZSBvZiByb2xlcykge1xuXHRcdFx0Y29uc3Qgcm9sZSA9IHRoaXMuZmluZE9uZShyb2xlTmFtZSk7XG5cdFx0XHRjb25zdCByb2xlU2NvcGUgPSAocm9sZSAmJiByb2xlLnNjb3BlKSB8fCAnVXNlcnMnO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBSb2NrZXRDaGF0Lm1vZGVsc1tyb2xlU2NvcGVdO1xuXG5cdFx0XHRtb2RlbCAmJiBtb2RlbC5yZW1vdmVSb2xlc0J5VXNlcklkICYmIG1vZGVsLnJlbW92ZVJvbGVzQnlVc2VySWQodXNlcklkLCByb2xlTmFtZSwgc2NvcGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb2xlcyA9IG5ldyBNb2RlbFJvbGVzKCdyb2xlcycsIHRydWUpO1xuUm9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuY2FjaGUubG9hZCgpO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cblJvY2tldENoYXQubW9kZWxzLl9CYXNlLnByb3RvdHlwZS5yb2xlQmFzZVF1ZXJ5ID0gZnVuY3Rpb24oLyp1c2VySWQsIHNjb3BlKi8pIHtcblx0cmV0dXJuO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2UucHJvdG90eXBlLmZpbmRSb2xlc0J5VXNlcklkID0gZnVuY3Rpb24odXNlcklkLyosIG9wdGlvbnMqLykge1xuXHRjb25zdCBxdWVyeSA9IHRoaXMucm9sZUJhc2VRdWVyeSh1c2VySWQpO1xuXHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5LCB7IGZpZWxkczogeyByb2xlczogMSB9IH0pO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2UucHJvdG90eXBlLmlzVXNlckluUm9sZSA9IGZ1bmN0aW9uKHVzZXJJZCwgcm9sZU5hbWUsIHNjb3BlKSB7XG5cdGNvbnN0IHF1ZXJ5ID0gdGhpcy5yb2xlQmFzZVF1ZXJ5KHVzZXJJZCwgc2NvcGUpO1xuXG5cdGlmIChxdWVyeSA9PSBudWxsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cXVlcnkucm9sZXMgPSByb2xlTmFtZTtcblx0cmV0dXJuICFfLmlzVW5kZWZpbmVkKHRoaXMuZmluZE9uZShxdWVyeSkpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2UucHJvdG90eXBlLmFkZFJvbGVzQnlVc2VySWQgPSBmdW5jdGlvbih1c2VySWQsIHJvbGVzLCBzY29wZSkge1xuXHRyb2xlcyA9IFtdLmNvbmNhdChyb2xlcyk7XG5cdGNvbnN0IHF1ZXJ5ID0gdGhpcy5yb2xlQmFzZVF1ZXJ5KHVzZXJJZCwgc2NvcGUpO1xuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JGFkZFRvU2V0OiB7XG5cdFx0XHRyb2xlczogeyAkZWFjaDogcm9sZXMgfVxuXHRcdH1cblx0fTtcblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2UucHJvdG90eXBlLnJlbW92ZVJvbGVzQnlVc2VySWQgPSBmdW5jdGlvbih1c2VySWQsIHJvbGVzLCBzY29wZSkge1xuXHRyb2xlcyA9IFtdLmNvbmNhdChyb2xlcyk7XG5cdGNvbnN0IHF1ZXJ5ID0gdGhpcy5yb2xlQmFzZVF1ZXJ5KHVzZXJJZCwgc2NvcGUpO1xuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHB1bGxBbGw6IHtcblx0XHRcdHJvbGVzXG5cdFx0fVxuXHR9O1xuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5fQmFzZS5wcm90b3R5cGUuZmluZFVzZXJzSW5Sb2xlcyA9IGZ1bmN0aW9uKCkge1xuXHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdvdmVyd3JpdGUtZnVuY3Rpb24nLCAnWW91IG11c3Qgb3ZlcndyaXRlIHRoaXMgZnVuY3Rpb24gaW4gdGhlIGV4dGVuZGVkIGNsYXNzZXMnKTtcbn07XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5yb2xlQmFzZVF1ZXJ5ID0gZnVuY3Rpb24odXNlcklkKSB7XG5cdHJldHVybiB7IF9pZDogdXNlcklkIH07XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kVXNlcnNJblJvbGVzID0gZnVuY3Rpb24ocm9sZXMsIHNjb3BlLCBvcHRpb25zKSB7XG5cdHJvbGVzID0gW10uY29uY2F0KHJvbGVzKTtcblxuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRyb2xlczogeyAkaW46IHJvbGVzIH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5LCBvcHRpb25zKTtcbn07XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5yb2xlQmFzZVF1ZXJ5ID0gZnVuY3Rpb24odXNlcklkLCBzY29wZSkge1xuXHRpZiAoc2NvcGUgPT0gbnVsbCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHF1ZXJ5ID0geyAndS5faWQnOiB1c2VySWQgfTtcblx0aWYgKCFfLmlzVW5kZWZpbmVkKHNjb3BlKSkge1xuXHRcdHF1ZXJ5LnJpZCA9IHNjb3BlO1xuXHR9XG5cdHJldHVybiBxdWVyeTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZFVzZXJzSW5Sb2xlcyA9IGZ1bmN0aW9uKHJvbGVzLCBzY29wZSwgb3B0aW9ucykge1xuXHRyb2xlcyA9IFtdLmNvbmNhdChyb2xlcyk7XG5cblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0cm9sZXM6IHsgJGluOiByb2xlcyB9XG5cdH07XG5cblx0aWYgKHNjb3BlKSB7XG5cdFx0cXVlcnkucmlkID0gc2NvcGU7XG5cdH1cblxuXHRjb25zdCBzdWJzY3JpcHRpb25zID0gdGhpcy5maW5kKHF1ZXJ5KS5mZXRjaCgpO1xuXG5cdGNvbnN0IHVzZXJzID0gXy5jb21wYWN0KF8ubWFwKHN1YnNjcmlwdGlvbnMsIGZ1bmN0aW9uKHN1YnNjcmlwdGlvbikge1xuXHRcdGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHN1YnNjcmlwdGlvbi51ICYmICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygc3Vic2NyaXB0aW9uLnUuX2lkKSB7XG5cdFx0XHRyZXR1cm4gc3Vic2NyaXB0aW9uLnUuX2lkO1xuXHRcdH1cblx0fSkpO1xuXG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kKHsgX2lkOiB7ICRpbjogdXNlcnMgfSB9LCBvcHRpb25zKTtcbn07XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuUm9ja2V0Q2hhdC5hdXRoei5hZGRVc2VyUm9sZXMgPSBmdW5jdGlvbih1c2VySWQsIHJvbGVOYW1lcywgc2NvcGUpIHtcblx0aWYgKCF1c2VySWQgfHwgIXJvbGVOYW1lcykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5kYi5maW5kT25lQnlJZCh1c2VySWQpO1xuXHRpZiAoIXVzZXIpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywge1xuXHRcdFx0ZnVuY3Rpb246ICdSb2NrZXRDaGF0LmF1dGh6LmFkZFVzZXJSb2xlcydcblx0XHR9KTtcblx0fVxuXG5cdHJvbGVOYW1lcyA9IFtdLmNvbmNhdChyb2xlTmFtZXMpO1xuXHRjb25zdCBleGlzdGluZ1JvbGVOYW1lcyA9IF8ucGx1Y2soUm9ja2V0Q2hhdC5hdXRoei5nZXRSb2xlcygpLCAnX2lkJyk7XG5cdGNvbnN0IGludmFsaWRSb2xlTmFtZXMgPSBfLmRpZmZlcmVuY2Uocm9sZU5hbWVzLCBleGlzdGluZ1JvbGVOYW1lcyk7XG5cblx0aWYgKCFfLmlzRW1wdHkoaW52YWxpZFJvbGVOYW1lcykpIHtcblx0XHRmb3IgKGNvbnN0IHJvbGUgb2YgaW52YWxpZFJvbGVOYW1lcykge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuY3JlYXRlT3JVcGRhdGUocm9sZSk7XG5cdFx0fVxuXHR9XG5cblx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuYWRkVXNlclJvbGVzKHVzZXJJZCwgcm9sZU5hbWVzLCBzY29wZSk7XG5cblx0cmV0dXJuIHRydWU7XG59O1xuIiwiLyogZ2xvYmFscyBSb2NrZXRDaGF0ICovXG5Sb2NrZXRDaGF0LmF1dGh6LnJvb21BY2Nlc3NWYWxpZGF0b3JzID0gW1xuXHRmdW5jdGlvbihyb29tLCB1c2VyID0ge30pIHtcblx0XHRpZiAocm9vbS50ID09PSAnYycpIHtcblx0XHRcdGlmICghdXNlci5faWQgJiYgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FjY291bnRzX0FsbG93QW5vbnltb3VzUmVhZCcpID09PSB0cnVlKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHVzZXIuX2lkLCAndmlldy1jLXJvb20nKTtcblx0XHR9XG5cdH0sXG5cdGZ1bmN0aW9uKHJvb20sIHVzZXIgPSB7fSkge1xuXHRcdGNvbnN0IHN1YnNjcmlwdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZE9uZUJ5Um9vbUlkQW5kVXNlcklkKHJvb20uX2lkLCB1c2VyLl9pZCk7XG5cdFx0aWYgKHN1YnNjcmlwdGlvbikge1xuXHRcdFx0cmV0dXJuIHN1YnNjcmlwdGlvbi5fcm9vbTtcblx0XHR9XG5cdH1cbl07XG5cblJvY2tldENoYXQuYXV0aHouY2FuQWNjZXNzUm9vbSA9IGZ1bmN0aW9uKHJvb20sIHVzZXIpIHtcblx0cmV0dXJuIFJvY2tldENoYXQuYXV0aHoucm9vbUFjY2Vzc1ZhbGlkYXRvcnMuc29tZSgodmFsaWRhdG9yKSA9PiB7XG5cdFx0cmV0dXJuIHZhbGlkYXRvci5jYWxsKHRoaXMsIHJvb20sIHVzZXIpO1xuXHR9KTtcbn07XG5cblJvY2tldENoYXQuYXV0aHouYWRkUm9vbUFjY2Vzc1ZhbGlkYXRvciA9IGZ1bmN0aW9uKHZhbGlkYXRvcikge1xuXHRSb2NrZXRDaGF0LmF1dGh6LnJvb21BY2Nlc3NWYWxpZGF0b3JzLnB1c2godmFsaWRhdG9yKTtcbn07XG4iLCJSb2NrZXRDaGF0LmF1dGh6LmdldFJvbGVzID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb2xlcy5maW5kKCkuZmV0Y2goKTtcbn07XG4iLCJSb2NrZXRDaGF0LmF1dGh6LmdldFVzZXJzSW5Sb2xlID0gZnVuY3Rpb24ocm9sZU5hbWUsIHNjb3BlLCBvcHRpb25zKSB7XG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb2xlcy5maW5kVXNlcnNJblJvbGUocm9sZU5hbWUsIHNjb3BlLCBvcHRpb25zKTtcbn07XG4iLCJmdW5jdGlvbiBhdExlYXN0T25lKHVzZXJJZCwgcGVybWlzc2lvbnMgPSBbXSwgc2NvcGUpIHtcblx0cmV0dXJuIHBlcm1pc3Npb25zLnNvbWUoKHBlcm1pc3Npb25JZCkgPT4ge1xuXHRcdGNvbnN0IHBlcm1pc3Npb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5QZXJtaXNzaW9ucy5maW5kT25lKHBlcm1pc3Npb25JZCk7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmlzVXNlckluUm9sZXModXNlcklkLCBwZXJtaXNzaW9uLnJvbGVzLCBzY29wZSk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBhbGwodXNlcklkLCBwZXJtaXNzaW9ucyA9IFtdLCBzY29wZSkge1xuXHRyZXR1cm4gcGVybWlzc2lvbnMuZXZlcnkoKHBlcm1pc3Npb25JZCkgPT4ge1xuXHRcdGNvbnN0IHBlcm1pc3Npb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5QZXJtaXNzaW9ucy5maW5kT25lKHBlcm1pc3Npb25JZCk7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmlzVXNlckluUm9sZXModXNlcklkLCBwZXJtaXNzaW9uLnJvbGVzLCBzY29wZSk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBoYXNQZXJtaXNzaW9uKHVzZXJJZCwgcGVybWlzc2lvbnMsIHNjb3BlLCBzdHJhdGVneSkge1xuXHRpZiAoIXVzZXJJZCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHBlcm1pc3Npb25zID0gW10uY29uY2F0KHBlcm1pc3Npb25zKTtcblx0cmV0dXJuIHN0cmF0ZWd5KHVzZXJJZCwgcGVybWlzc2lvbnMsIHNjb3BlKTtcbn1cblxuUm9ja2V0Q2hhdC5hdXRoei5oYXNBbGxQZXJtaXNzaW9uID0gZnVuY3Rpb24odXNlcklkLCBwZXJtaXNzaW9ucywgc2NvcGUpIHtcblx0cmV0dXJuIGhhc1Blcm1pc3Npb24odXNlcklkLCBwZXJtaXNzaW9ucywgc2NvcGUsIGFsbCk7XG59O1xuXG5Sb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24gPSBSb2NrZXRDaGF0LmF1dGh6Lmhhc0FsbFBlcm1pc3Npb247XG5cblJvY2tldENoYXQuYXV0aHouaGFzQXRMZWFzdE9uZVBlcm1pc3Npb24gPSBmdW5jdGlvbih1c2VySWQsIHBlcm1pc3Npb25zLCBzY29wZSkge1xuXHRyZXR1cm4gaGFzUGVybWlzc2lvbih1c2VySWQsIHBlcm1pc3Npb25zLCBzY29wZSwgYXRMZWFzdE9uZSk7XG59O1xuIiwiUm9ja2V0Q2hhdC5hdXRoei5oYXNSb2xlID0gZnVuY3Rpb24odXNlcklkLCByb2xlTmFtZXMsIHNjb3BlKSB7XG5cdHJvbGVOYW1lcyA9IFtdLmNvbmNhdChyb2xlTmFtZXMpO1xuXHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuaXNVc2VySW5Sb2xlcyh1c2VySWQsIHJvbGVOYW1lcywgc2NvcGUpO1xufTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5Sb2NrZXRDaGF0LmF1dGh6LnJlbW92ZVVzZXJGcm9tUm9sZXMgPSBmdW5jdGlvbih1c2VySWQsIHJvbGVOYW1lcywgc2NvcGUpIHtcblx0aWYgKCF1c2VySWQgfHwgIXJvbGVOYW1lcykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh1c2VySWQpO1xuXG5cdGlmICghdXNlcikge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7XG5cdFx0XHRmdW5jdGlvbjogJ1JvY2tldENoYXQuYXV0aHoucmVtb3ZlVXNlckZyb21Sb2xlcydcblx0XHR9KTtcblx0fVxuXG5cdHJvbGVOYW1lcyA9IFtdLmNvbmNhdChyb2xlTmFtZXMpO1xuXHRjb25zdCBleGlzdGluZ1JvbGVOYW1lcyA9IF8ucGx1Y2soUm9ja2V0Q2hhdC5hdXRoei5nZXRSb2xlcygpLCAnX2lkJyk7XG5cdGNvbnN0IGludmFsaWRSb2xlTmFtZXMgPSBfLmRpZmZlcmVuY2Uocm9sZU5hbWVzLCBleGlzdGluZ1JvbGVOYW1lcyk7XG5cblx0aWYgKCFfLmlzRW1wdHkoaW52YWxpZFJvbGVOYW1lcykpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJvbGUnLCAnSW52YWxpZCByb2xlJywge1xuXHRcdFx0ZnVuY3Rpb246ICdSb2NrZXRDaGF0LmF1dGh6LnJlbW92ZVVzZXJGcm9tUm9sZXMnXG5cdFx0fSk7XG5cdH1cblxuXHRSb2NrZXRDaGF0Lm1vZGVscy5Sb2xlcy5yZW1vdmVVc2VyUm9sZXModXNlcklkLCByb2xlTmFtZXMsIHNjb3BlKTtcblxuXHRyZXR1cm4gdHJ1ZTtcbn07XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdwZXJtaXNzaW9ucy9nZXQnKHVwZGF0ZWRBdCkge1xuXHRcdHRoaXMudW5ibG9jaygpO1xuXG5cdFx0Y29uc3QgcmVjb3JkcyA9IFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLmZpbmQoKS5mZXRjaCgpO1xuXG5cdFx0aWYgKHVwZGF0ZWRBdCBpbnN0YW5jZW9mIERhdGUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHVwZGF0ZTogcmVjb3Jkcy5maWx0ZXIoKHJlY29yZCkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiByZWNvcmQuX3VwZGF0ZWRBdCA+IHVwZGF0ZWRBdDtcblx0XHRcdFx0fSksXG5cdFx0XHRcdHJlbW92ZTogUm9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMudHJhc2hGaW5kRGVsZXRlZEFmdGVyKHVwZGF0ZWRBdCwge30sIHtmaWVsZHM6IHtfaWQ6IDEsIF9kZWxldGVkQXQ6IDF9fSkuZmV0Y2goKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVjb3Jkcztcblx0fVxufSk7XG5cblxuUm9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMub24oJ2NoYW5nZWQnLCAodHlwZSwgcGVybWlzc2lvbikgPT4ge1xuXHRSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5TG9nZ2VkSW5UaGlzSW5zdGFuY2UoJ3Blcm1pc3Npb25zLWNoYW5nZWQnLCB0eXBlLCBwZXJtaXNzaW9uKTtcbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ3JvbGVzJywgZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cblx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmZpbmQoKTtcbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ3VzZXJzSW5Sb2xlJywgZnVuY3Rpb24ocm9sZU5hbWUsIHNjb3BlLCBsaW1pdCA9IDUwKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cblx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdhY2Nlc3MtcGVybWlzc2lvbnMnKSkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywge1xuXHRcdFx0cHVibGlzaDogJ3VzZXJzSW5Sb2xlJ1xuXHRcdH0pKTtcblx0fVxuXG5cdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0bGltaXQsXG5cdFx0c29ydDoge1xuXHRcdFx0bmFtZTogMVxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gUm9ja2V0Q2hhdC5hdXRoei5nZXRVc2Vyc0luUm9sZShyb2xlTmFtZSwgc2NvcGUsIG9wdGlvbnMpO1xufSk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnYXV0aG9yaXphdGlvbjphZGRVc2VyVG9Sb2xlJyhyb2xlTmFtZSwgdXNlcm5hbWUsIHNjb3BlKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdhY2Nlc3MtcGVybWlzc2lvbnMnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ0FjY2Vzc2luZyBwZXJtaXNzaW9ucyBpcyBub3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAnYXV0aG9yaXphdGlvbjphZGRVc2VyVG9Sb2xlJyxcblx0XHRcdFx0YWN0aW9uOiAnQWNjZXNzaW5nX3Blcm1pc3Npb25zJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFyb2xlTmFtZSB8fCAhXy5pc1N0cmluZyhyb2xlTmFtZSkgfHwgIXVzZXJuYW1lIHx8ICFfLmlzU3RyaW5nKHVzZXJuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1hcmd1bWVudHMnLCAnSW52YWxpZCBhcmd1bWVudHMnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ2F1dGhvcml6YXRpb246YWRkVXNlclRvUm9sZSdcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChyb2xlTmFtZSA9PT0gJ2FkbWluJyAmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ2Fzc2lnbi1hZG1pbi1yb2xlJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdBc3NpZ25pbmcgYWRtaW4gaXMgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ2F1dGhvcml6YXRpb246YWRkVXNlclRvUm9sZScsXG5cdFx0XHRcdGFjdGlvbjogJ0Fzc2lnbl9hZG1pbidcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1c2VybmFtZSwge1xuXHRcdFx0ZmllbGRzOiB7XG5cdFx0XHRcdF9pZDogMVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKCF1c2VyIHx8ICF1c2VyLl9pZCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHtcblx0XHRcdFx0bWV0aG9kOiAnYXV0aG9yaXphdGlvbjphZGRVc2VyVG9Sb2xlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWRkID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuYWRkVXNlclJvbGVzKHVzZXIuX2lkLCByb2xlTmFtZSwgc2NvcGUpO1xuXG5cdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdVSV9EaXNwbGF5Um9sZXMnKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeUxvZ2dlZCgncm9sZXMtY2hhbmdlJywge1xuXHRcdFx0XHR0eXBlOiAnYWRkZWQnLFxuXHRcdFx0XHRfaWQ6IHJvbGVOYW1lLFxuXHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0X2lkOiB1c2VyLl9pZCxcblx0XHRcdFx0XHR1c2VybmFtZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzY29wZVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFkZDtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdhdXRob3JpemF0aW9uOmRlbGV0ZVJvbGUnKHJvbGVOYW1lKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdhY2Nlc3MtcGVybWlzc2lvbnMnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ0FjY2Vzc2luZyBwZXJtaXNzaW9ucyBpcyBub3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAnYXV0aG9yaXphdGlvbjpkZWxldGVSb2xlJyxcblx0XHRcdFx0YWN0aW9uOiAnQWNjZXNzaW5nX3Blcm1pc3Npb25zJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9sZSA9IFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmZpbmRPbmUocm9sZU5hbWUpO1xuXHRcdGlmICghcm9sZSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1yb2xlJywgJ0ludmFsaWQgcm9sZScsIHtcblx0XHRcdFx0bWV0aG9kOiAnYXV0aG9yaXphdGlvbjpkZWxldGVSb2xlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKHJvbGUucHJvdGVjdGVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1kZWxldGUtcHJvdGVjdGVkLXJvbGUnLCAnQ2Fubm90IGRlbGV0ZSBhIHByb3RlY3RlZCByb2xlJywge1xuXHRcdFx0XHRtZXRob2Q6ICdhdXRob3JpemF0aW9uOmRlbGV0ZVJvbGUnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCByb2xlU2NvcGUgPSByb2xlLnNjb3BlIHx8ICdVc2Vycyc7XG5cdFx0Y29uc3QgbW9kZWwgPSBSb2NrZXRDaGF0Lm1vZGVsc1tyb2xlU2NvcGVdO1xuXHRcdGNvbnN0IGV4aXN0aW5nVXNlcnMgPSBtb2RlbCAmJiBtb2RlbC5maW5kVXNlcnNJblJvbGVzICYmIG1vZGVsLmZpbmRVc2Vyc0luUm9sZXMocm9sZU5hbWUpO1xuXG5cdFx0aWYgKGV4aXN0aW5nVXNlcnMgJiYgZXhpc3RpbmdVc2Vycy5jb3VudCgpID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itcm9sZS1pbi11c2UnLCAnQ2Fubm90IGRlbGV0ZSByb2xlIGJlY2F1c2UgaXRcXCdzIGluIHVzZScsIHtcblx0XHRcdFx0bWV0aG9kOiAnYXV0aG9yaXphdGlvbjpkZWxldGVSb2xlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvbGVzLnJlbW92ZShyb2xlLm5hbWUpO1xuXHR9XG59KTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdCdhdXRob3JpemF0aW9uOnJlbW92ZVVzZXJGcm9tUm9sZScocm9sZU5hbWUsIHVzZXJuYW1lLCBzY29wZSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAnYWNjZXNzLXBlcm1pc3Npb25zJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdBY2Nlc3MgcGVybWlzc2lvbnMgaXMgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ2F1dGhvcml6YXRpb246cmVtb3ZlVXNlckZyb21Sb2xlJyxcblx0XHRcdFx0YWN0aW9uOiAnQWNjZXNzaW5nX3Blcm1pc3Npb25zJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFyb2xlTmFtZSB8fCAhXy5pc1N0cmluZyhyb2xlTmFtZSkgfHwgIXVzZXJuYW1lIHx8ICFfLmlzU3RyaW5nKHVzZXJuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1hcmd1bWVudHMnLCAnSW52YWxpZCBhcmd1bWVudHMnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ2F1dGhvcml6YXRpb246cmVtb3ZlVXNlckZyb21Sb2xlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHtcblx0XHRcdHVzZXJuYW1lXG5cdFx0fSwge1xuXHRcdFx0ZmllbGRzOiB7XG5cdFx0XHRcdF9pZDogMSxcblx0XHRcdFx0cm9sZXM6IDFcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmICghdXNlciB8fCAhdXNlci5faWQpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7XG5cdFx0XHRcdG1ldGhvZDogJ2F1dGhvcml6YXRpb246cmVtb3ZlVXNlckZyb21Sb2xlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gcHJldmVudCByZW1vdmluZyBsYXN0IHVzZXIgZnJvbSBhZG1pbiByb2xlXG5cdFx0aWYgKHJvbGVOYW1lID09PSAnYWRtaW4nKSB7XG5cdFx0XHRjb25zdCBhZG1pbkNvdW50ID0gTWV0ZW9yLnVzZXJzLmZpbmQoe1xuXHRcdFx0XHRyb2xlczoge1xuXHRcdFx0XHRcdCRpbjogWydhZG1pbiddXG5cdFx0XHRcdH1cblx0XHRcdH0pLmNvdW50KCk7XG5cblx0XHRcdGNvbnN0IHVzZXJJc0FkbWluID0gdXNlci5yb2xlcy5pbmRleE9mKCdhZG1pbicpID4gLTE7XG5cdFx0XHRpZiAoYWRtaW5Db3VudCA9PT0gMSAmJiB1c2VySXNBZG1pbikge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hY3Rpb24tbm90LWFsbG93ZWQnLCAnTGVhdmluZyB0aGUgYXBwIHdpdGhvdXQgYWRtaW5zIGlzIG5vdCBhbGxvd2VkJywge1xuXHRcdFx0XHRcdG1ldGhvZDogJ3JlbW92ZVVzZXJGcm9tUm9sZScsXG5cdFx0XHRcdFx0YWN0aW9uOiAnUmVtb3ZlX2xhc3RfYWRtaW4nXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlbW92ZSA9IFJvY2tldENoYXQubW9kZWxzLlJvbGVzLnJlbW92ZVVzZXJSb2xlcyh1c2VyLl9pZCwgcm9sZU5hbWUsIHNjb3BlKTtcblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1VJX0Rpc3BsYXlSb2xlcycpKSB7XG5cdFx0XHRSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5TG9nZ2VkKCdyb2xlcy1jaGFuZ2UnLCB7XG5cdFx0XHRcdHR5cGU6ICdyZW1vdmVkJyxcblx0XHRcdFx0X2lkOiByb2xlTmFtZSxcblx0XHRcdFx0dToge1xuXHRcdFx0XHRcdF9pZDogdXNlci5faWQsXG5cdFx0XHRcdFx0dXNlcm5hbWVcblx0XHRcdFx0fSxcblx0XHRcdFx0c2NvcGVcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZW1vdmU7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnYXV0aG9yaXphdGlvbjpzYXZlUm9sZScocm9sZURhdGEpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ2FjY2Vzcy1wZXJtaXNzaW9ucycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hY3Rpb24tbm90LWFsbG93ZWQnLCAnQWNjZXNzaW5nIHBlcm1pc3Npb25zIGlzIG5vdCBhbGxvd2VkJywge1xuXHRcdFx0XHRtZXRob2Q6ICdhdXRob3JpemF0aW9uOnNhdmVSb2xlJyxcblx0XHRcdFx0YWN0aW9uOiAnQWNjZXNzaW5nX3Blcm1pc3Npb25zJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFyb2xlRGF0YS5uYW1lKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1yb2xlLW5hbWUtcmVxdWlyZWQnLCAnUm9sZSBuYW1lIGlzIHJlcXVpcmVkJywge1xuXHRcdFx0XHRtZXRob2Q6ICdhdXRob3JpemF0aW9uOnNhdmVSb2xlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKFsnVXNlcnMnLCAnU3Vic2NyaXB0aW9ucyddLmluY2x1ZGVzKHJvbGVEYXRhLnNjb3BlKSA9PT0gZmFsc2UpIHtcblx0XHRcdHJvbGVEYXRhLnNjb3BlID0gJ1VzZXJzJztcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb2xlcy5jcmVhdGVPclVwZGF0ZShyb2xlRGF0YS5uYW1lLCByb2xlRGF0YS5zY29wZSwgcm9sZURhdGEuZGVzY3JpcHRpb24pO1xuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnVUlfRGlzcGxheVJvbGVzJykpIHtcblx0XHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlMb2dnZWQoJ3JvbGVzLWNoYW5nZScsIHtcblx0XHRcdFx0dHlwZTogJ2NoYW5nZWQnLFxuXHRcdFx0XHRfaWQ6IHJvbGVEYXRhLm5hbWVcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB1cGRhdGU7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnYXV0aG9yaXphdGlvbjphZGRQZXJtaXNzaW9uVG9Sb2xlJyhwZXJtaXNzaW9uLCByb2xlKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdhY2Nlc3MtcGVybWlzc2lvbnMnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ0FkZGluZyBwZXJtaXNzaW9uIGlzIG5vdCBhbGxvd2VkJywge1xuXHRcdFx0XHRtZXRob2Q6ICdhdXRob3JpemF0aW9uOmFkZFBlcm1pc3Npb25Ub1JvbGUnLFxuXHRcdFx0XHRhY3Rpb246ICdBZGRpbmdfcGVybWlzc2lvbidcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5QZXJtaXNzaW9ucy5hZGRSb2xlKHBlcm1pc3Npb24sIHJvbGUpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2F1dGhvcml6YXRpb246cmVtb3ZlUm9sZUZyb21QZXJtaXNzaW9uJyhwZXJtaXNzaW9uLCByb2xlKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdhY2Nlc3MtcGVybWlzc2lvbnMnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ0FjY2Vzc2luZyBwZXJtaXNzaW9ucyBpcyBub3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAnYXV0aG9yaXphdGlvbjpyZW1vdmVSb2xlRnJvbVBlcm1pc3Npb24nLFxuXHRcdFx0XHRhY3Rpb246ICdBY2Nlc3NpbmdfcGVybWlzc2lvbnMnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMucmVtb3ZlUm9sZShwZXJtaXNzaW9uLCByb2xlKTtcblx0fVxufSk7XG4iLCIvKiBlc2xpbnQgbm8tbXVsdGktc3BhY2VzOiAwICovXG5cbk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHQvLyBOb3RlOlxuXHQvLyAxLmlmIHdlIG5lZWQgdG8gY3JlYXRlIGEgcm9sZSB0aGF0IGNhbiBvbmx5IGVkaXQgY2hhbm5lbCBtZXNzYWdlLCBidXQgbm90IGVkaXQgZ3JvdXAgbWVzc2FnZVxuXHQvLyB0aGVuIHdlIGNhbiBkZWZpbmUgZWRpdC08dHlwZT4tbWVzc2FnZSBpbnN0ZWFkIG9mIGVkaXQtbWVzc2FnZVxuXHQvLyAyLiBhZG1pbiwgbW9kZXJhdG9yLCBhbmQgdXNlciByb2xlcyBzaG91bGQgbm90IGJlIGRlbGV0ZWQgYXMgdGhleSBhcmUgcmVmZXJlbmVkIGluIHRoZSBjb2RlLlxuXHRjb25zdCBwZXJtaXNzaW9ucyA9IFtcblx0XHR7IF9pZDogJ2FjY2Vzcy1wZXJtaXNzaW9ucycsICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2FkZC1vYXV0aC1zZXJ2aWNlJywgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2FkZC11c2VyLXRvLWpvaW5lZC1yb29tJywgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvciddIH0sXG5cdFx0eyBfaWQ6ICdhZGQtdXNlci10by1hbnktYy1yb29tJywgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICdhZGQtdXNlci10by1hbnktcC1yb29tJywgICAgICAgIHJvbGVzIDogW10gfSxcblx0XHR7IF9pZDogJ2FyY2hpdmUtcm9vbScsICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJ10gfSxcblx0XHR7IF9pZDogJ2Fzc2lnbi1hZG1pbi1yb2xlJywgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2Jhbi11c2VyJywgICAgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvciddIH0sXG5cdFx0eyBfaWQ6ICdidWxrLWNyZWF0ZS1jJywgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICdidWxrLXJlZ2lzdGVyLXVzZXInLCAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICdjcmVhdGUtYycsICAgICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICd1c2VyJywgJ2JvdCddIH0sXG5cdFx0eyBfaWQ6ICdjcmVhdGUtZCcsICAgICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICd1c2VyJywgJ2JvdCddIH0sXG5cdFx0eyBfaWQ6ICdjcmVhdGUtcCcsICAgICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICd1c2VyJywgJ2JvdCddIH0sXG5cdFx0eyBfaWQ6ICdjcmVhdGUtdXNlcicsICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICdjbGVhbi1jaGFubmVsLWhpc3RvcnknLCAgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sIC8vIHNwZWNpYWwgcGVybWlzc2lvbiB0byBidWxrIGRlbGV0ZSBhIGNoYW5uZWwncyBtZXNhZ2VzXG5cdFx0eyBfaWQ6ICdkZWxldGUtYycsICAgICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICdkZWxldGUtZCcsICAgICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICdkZWxldGUtbWVzc2FnZScsICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICdvd25lcicsICdtb2RlcmF0b3InXSB9LFxuXHRcdHsgX2lkOiAnZGVsZXRlLXAnLCAgICAgICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAnZGVsZXRlLXVzZXInLCAgICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAnZWRpdC1tZXNzYWdlJywgICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nLCAnb3duZXInLCAnbW9kZXJhdG9yJ10gfSxcblx0XHR7IF9pZDogJ2VkaXQtb3RoZXItdXNlci1hY3RpdmUtc3RhdHVzJywgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2VkaXQtb3RoZXItdXNlci1pbmZvJywgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2VkaXQtb3RoZXItdXNlci1wYXNzd29yZCcsICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2VkaXQtcHJpdmlsZWdlZC1zZXR0aW5nJywgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ2VkaXQtcm9vbScsICAgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvciddIH0sXG5cdFx0eyBfaWQ6ICdmb3JjZS1kZWxldGUtbWVzc2FnZScsICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICdvd25lciddIH0sXG5cdFx0eyBfaWQ6ICdqb2luLXdpdGhvdXQtam9pbi1jb2RlJywgICAgICAgIHJvbGVzIDogWydhZG1pbicsICdib3QnXSB9LFxuXHRcdHsgX2lkOiAnbWFuYWdlLWFzc2V0cycsICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAnbWFuYWdlLWVtb2ppJywgICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAnbWFuYWdlLWludGVncmF0aW9ucycsICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnLCAgICAgICByb2xlcyA6IFsnYWRtaW4nLCAnYm90J10gfSxcblx0XHR7IF9pZDogJ21hbmFnZS1vYXV0aC1hcHBzJywgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ21lbnRpb24tYWxsJywgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvcicsICd1c2VyJ10gfSxcblx0XHR7IF9pZDogJ211dGUtdXNlcicsICAgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvciddIH0sXG5cdFx0eyBfaWQ6ICdyZW1vdmUtdXNlcicsICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICdvd25lcicsICdtb2RlcmF0b3InXSB9LFxuXHRcdHsgX2lkOiAncnVuLWltcG9ydCcsICAgICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAncnVuLW1pZ3JhdGlvbicsICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nXSB9LFxuXHRcdHsgX2lkOiAnc2V0LW1vZGVyYXRvcicsICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nLCAnb3duZXInXSB9LFxuXHRcdHsgX2lkOiAnc2V0LW93bmVyJywgICAgICAgICAgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nLCAnb3duZXInXSB9LFxuXHRcdHsgX2lkOiAnc2VuZC1tYW55LW1lc3NhZ2VzJywgICAgICAgICAgICByb2xlcyA6IFsnYWRtaW4nLCAnYm90J10gfSxcblx0XHR7IF9pZDogJ3NldC1sZWFkZXInLCAgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJ10gfSxcblx0XHR7IF9pZDogJ3VuYXJjaGl2ZS1yb29tJywgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctYy1yb29tJywgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ3VzZXInLCAnYm90JywgJ2Fub255bW91cyddIH0sXG5cdFx0eyBfaWQ6ICd1c2VyLWdlbmVyYXRlLWFjY2Vzcy10b2tlbicsICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICd2aWV3LWQtcm9vbScsICAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICd1c2VyJywgJ2JvdCddIH0sXG5cdFx0eyBfaWQ6ICd2aWV3LWZ1bGwtb3RoZXItdXNlci1pbmZvJywgICAgIHJvbGVzIDogWydhZG1pbiddIH0sXG5cdFx0eyBfaWQ6ICd2aWV3LWhpc3RvcnknLCAgICAgICAgICAgICAgICAgIHJvbGVzIDogWydhZG1pbicsICd1c2VyJywgJ2Fub255bW91cyddIH0sXG5cdFx0eyBfaWQ6ICd2aWV3LWpvaW5lZC1yb29tJywgICAgICAgICAgICAgIHJvbGVzIDogWydndWVzdCcsICdib3QnLCAnYW5vbnltb3VzJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctam9pbi1jb2RlJywgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctbG9ncycsICAgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctb3RoZXItdXNlci1jaGFubmVscycsICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctcC1yb29tJywgICAgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ3VzZXInLCAnYW5vbnltb3VzJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctcHJpdmlsZWdlZC1zZXR0aW5nJywgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctcm9vbS1hZG1pbmlzdHJhdGlvbicsICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctc3RhdGlzdGljcycsICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctdXNlci1hZG1pbmlzdHJhdGlvbicsICAgICAgcm9sZXMgOiBbJ2FkbWluJ10gfSxcblx0XHR7IF9pZDogJ3ByZXZpZXctYy1yb29tJywgICAgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ3VzZXInLCAnYW5vbnltb3VzJ10gfSxcblx0XHR7IF9pZDogJ3ZpZXctb3V0c2lkZS1yb29tJywgICAgICAgICAgICAgcm9sZXMgOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvcicsICd1c2VyJ10gfVxuXHRdO1xuXG5cdGZvciAoY29uc3QgcGVybWlzc2lvbiBvZiBwZXJtaXNzaW9ucykge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMuZmluZE9uZUJ5SWQocGVybWlzc2lvbi5faWQpKSB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5QZXJtaXNzaW9ucy51cHNlcnQocGVybWlzc2lvbi5faWQsIHskc2V0OiBwZXJtaXNzaW9uIH0pO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGRlZmF1bHRSb2xlcyA9IFtcblx0XHR7IG5hbWU6ICdhZG1pbicsICAgICBzY29wZTogJ1VzZXJzJywgICAgICAgICBkZXNjcmlwdGlvbjogJ0FkbWluJyB9LFxuXHRcdHsgbmFtZTogJ21vZGVyYXRvcicsIHNjb3BlOiAnU3Vic2NyaXB0aW9ucycsIGRlc2NyaXB0aW9uOiAnTW9kZXJhdG9yJyB9LFxuXHRcdHsgbmFtZTogJ2xlYWRlcicsICAgIHNjb3BlOiAnU3Vic2NyaXB0aW9ucycsIGRlc2NyaXB0aW9uOiAnTGVhZGVyJyB9LFxuXHRcdHsgbmFtZTogJ293bmVyJywgICAgIHNjb3BlOiAnU3Vic2NyaXB0aW9ucycsIGRlc2NyaXB0aW9uOiAnT3duZXInIH0sXG5cdFx0eyBuYW1lOiAndXNlcicsICAgICAgc2NvcGU6ICdVc2VycycsICAgICAgICAgZGVzY3JpcHRpb246ICcnIH0sXG5cdFx0eyBuYW1lOiAnYm90JywgICAgICAgc2NvcGU6ICdVc2VycycsICAgICAgICAgZGVzY3JpcHRpb246ICcnIH0sXG5cdFx0eyBuYW1lOiAnZ3Vlc3QnLCAgICAgc2NvcGU6ICdVc2VycycsICAgICAgICAgZGVzY3JpcHRpb246ICcnIH0sXG5cdFx0eyBuYW1lOiAnYW5vbnltb3VzJywgc2NvcGU6ICdVc2VycycsICAgICAgICAgZGVzY3JpcHRpb246ICcnIH1cblx0XTtcblxuXHRmb3IgKGNvbnN0IHJvbGUgb2YgZGVmYXVsdFJvbGVzKSB7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMudXBzZXJ0KHsgX2lkOiByb2xlLm5hbWUgfSwgeyAkc2V0T25JbnNlcnQ6IHsgc2NvcGU6IHJvbGUuc2NvcGUsIGRlc2NyaXB0aW9uOiByb2xlLmRlc2NyaXB0aW9uIHx8ICcnLCBwcm90ZWN0ZWQ6IHRydWUgfSB9KTtcblx0fVxufSk7XG4iXX0=
