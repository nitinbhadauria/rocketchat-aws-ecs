(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:statistics":{"lib":{"rocketchat.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_statistics/lib/rocketchat.js                                                                  //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
RocketChat.statistics = {};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"models":{"Statistics.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_statistics/server/models/Statistics.js                                                        //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
RocketChat.models.Statistics = new class extends RocketChat.models._Base {
	constructor() {
		super('statistics');
		this.tryEnsureIndex({
			'createdAt': 1
		});
	} // FIND ONE


	findOneById(_id, options) {
		const query = {
			_id
		};
		return this.findOne(query, options);
	}

	findLast() {
		const options = {
			sort: {
				createdAt: -1
			},
			limit: 1
		};
		const records = this.find({}, options).fetch();
		return records && records[0];
	}

}();
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"functions":{"get.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_statistics/server/functions/get.js                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.statistics.get = function _getStatistics() {
	const statistics = {}; // Version

	statistics.uniqueId = RocketChat.settings.get('uniqueID');

	if (RocketChat.models.Settings.findOne('uniqueID')) {
		statistics.installedAt = RocketChat.models.Settings.findOne('uniqueID').createdAt;
	}

	if (RocketChat.Info) {
		statistics.version = RocketChat.Info.version;
		statistics.tag = RocketChat.Info.tag;
		statistics.branch = RocketChat.Info.branch;
	} // User statistics


	statistics.totalUsers = Meteor.users.find().count();
	statistics.activeUsers = Meteor.users.find({
		active: true
	}).count();
	statistics.nonActiveUsers = statistics.totalUsers - statistics.activeUsers;
	statistics.onlineUsers = Meteor.users.find({
		statusConnection: 'online'
	}).count();
	statistics.awayUsers = Meteor.users.find({
		statusConnection: 'away'
	}).count();
	statistics.offlineUsers = statistics.totalUsers - statistics.onlineUsers - statistics.awayUsers; // Room statistics

	statistics.totalRooms = RocketChat.models.Rooms.find().count();
	statistics.totalChannels = RocketChat.models.Rooms.findByType('c').count();
	statistics.totalPrivateGroups = RocketChat.models.Rooms.findByType('p').count();
	statistics.totalDirect = RocketChat.models.Rooms.findByType('d').count();
	statistics.totlalLivechat = RocketChat.models.Rooms.findByType('l').count(); // Message statistics

	statistics.totalMessages = RocketChat.models.Messages.find().count();
	statistics.totalChannelMessages = _.reduce(RocketChat.models.Rooms.findByType('c', {
		fields: {
			'msgs': 1
		}
	}).fetch(), function _countChannelMessages(num, room) {
		return num + room.msgs;
	}, 0);
	statistics.totalPrivateGroupMessages = _.reduce(RocketChat.models.Rooms.findByType('p', {
		fields: {
			'msgs': 1
		}
	}).fetch(), function _countPrivateGroupMessages(num, room) {
		return num + room.msgs;
	}, 0);
	statistics.totalDirectMessages = _.reduce(RocketChat.models.Rooms.findByType('d', {
		fields: {
			'msgs': 1
		}
	}).fetch(), function _countDirectMessages(num, room) {
		return num + room.msgs;
	}, 0);
	statistics.totalLivechatMessages = _.reduce(RocketChat.models.Rooms.findByType('l', {
		fields: {
			'msgs': 1
		}
	}).fetch(), function _countLivechatMessages(num, room) {
		return num + room.msgs;
	}, 0);
	statistics.lastLogin = RocketChat.models.Users.getLastLogin();
	statistics.lastMessageSentAt = RocketChat.models.Messages.getLastTimestamp();
	statistics.lastSeenSubscription = RocketChat.models.Subscriptions.getLastSeen();

	const os = Npm.require('os');

	statistics.os = {
		type: os.type(),
		platform: os.platform(),
		arch: os.arch(),
		release: os.release(),
		uptime: os.uptime(),
		loadavg: os.loadavg(),
		totalmem: os.totalmem(),
		freemem: os.freemem(),
		cpus: os.cpus()
	};
	statistics.process = {
		nodeVersion: process.version,
		pid: process.pid,
		uptime: process.uptime()
	};
	statistics.deploy = {
		method: process.env.DEPLOY_METHOD || 'tar',
		platform: process.env.DEPLOY_PLATFORM || 'selfinstall'
	};
	statistics.migration = RocketChat.Migrations._getControl();
	statistics.instanceCount = InstanceStatus.getCollection().find({
		_updatedAt: {
			$gt: new Date(Date.now() - process.uptime() * 1000 - 2000)
		}
	}).count();

	if (MongoInternals.defaultRemoteCollectionDriver().mongo._oplogHandle && MongoInternals.defaultRemoteCollectionDriver().mongo._oplogHandle.onOplogEntry && RocketChat.settings.get('Force_Disable_OpLog_For_Cache') !== true) {
		statistics.oplogEnabled = true;
	}

	return statistics;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"save.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_statistics/server/functions/save.js                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
RocketChat.statistics.save = function () {
	const statistics = RocketChat.statistics.get();
	statistics.createdAt = new Date();
	RocketChat.models.Statistics.insert(statistics);
	return statistics;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"getStatistics.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_statistics/server/methods/getStatistics.js                                                    //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
Meteor.methods({
	getStatistics(refresh) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'getStatistics'
			});
		}

		if (RocketChat.authz.hasPermission(Meteor.userId(), 'view-statistics') !== true) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'getStatistics'
			});
		}

		if (refresh) {
			return RocketChat.statistics.save();
		} else {
			return RocketChat.models.Statistics.findLast();
		}
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:statistics/lib/rocketchat.js");
require("./node_modules/meteor/rocketchat:statistics/server/models/Statistics.js");
require("./node_modules/meteor/rocketchat:statistics/server/functions/get.js");
require("./node_modules/meteor/rocketchat:statistics/server/functions/save.js");
require("./node_modules/meteor/rocketchat:statistics/server/methods/getStatistics.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:statistics'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_statistics.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzdGF0aXN0aWNzL2xpYi9yb2NrZXRjaGF0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnN0YXRpc3RpY3Mvc2VydmVyL21vZGVscy9TdGF0aXN0aWNzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnN0YXRpc3RpY3Mvc2VydmVyL2Z1bmN0aW9ucy9nZXQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c3RhdGlzdGljcy9zZXJ2ZXIvZnVuY3Rpb25zL3NhdmUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c3RhdGlzdGljcy9zZXJ2ZXIvbWV0aG9kcy9nZXRTdGF0aXN0aWNzLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJzdGF0aXN0aWNzIiwibW9kZWxzIiwiU3RhdGlzdGljcyIsIl9CYXNlIiwiY29uc3RydWN0b3IiLCJ0cnlFbnN1cmVJbmRleCIsImZpbmRPbmVCeUlkIiwiX2lkIiwib3B0aW9ucyIsInF1ZXJ5IiwiZmluZE9uZSIsImZpbmRMYXN0Iiwic29ydCIsImNyZWF0ZWRBdCIsImxpbWl0IiwicmVjb3JkcyIsImZpbmQiLCJmZXRjaCIsIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsImdldCIsIl9nZXRTdGF0aXN0aWNzIiwidW5pcXVlSWQiLCJzZXR0aW5ncyIsIlNldHRpbmdzIiwiaW5zdGFsbGVkQXQiLCJJbmZvIiwidmVyc2lvbiIsInRhZyIsImJyYW5jaCIsInRvdGFsVXNlcnMiLCJNZXRlb3IiLCJ1c2VycyIsImNvdW50IiwiYWN0aXZlVXNlcnMiLCJhY3RpdmUiLCJub25BY3RpdmVVc2VycyIsIm9ubGluZVVzZXJzIiwic3RhdHVzQ29ubmVjdGlvbiIsImF3YXlVc2VycyIsIm9mZmxpbmVVc2VycyIsInRvdGFsUm9vbXMiLCJSb29tcyIsInRvdGFsQ2hhbm5lbHMiLCJmaW5kQnlUeXBlIiwidG90YWxQcml2YXRlR3JvdXBzIiwidG90YWxEaXJlY3QiLCJ0b3RsYWxMaXZlY2hhdCIsInRvdGFsTWVzc2FnZXMiLCJNZXNzYWdlcyIsInRvdGFsQ2hhbm5lbE1lc3NhZ2VzIiwicmVkdWNlIiwiZmllbGRzIiwiX2NvdW50Q2hhbm5lbE1lc3NhZ2VzIiwibnVtIiwicm9vbSIsIm1zZ3MiLCJ0b3RhbFByaXZhdGVHcm91cE1lc3NhZ2VzIiwiX2NvdW50UHJpdmF0ZUdyb3VwTWVzc2FnZXMiLCJ0b3RhbERpcmVjdE1lc3NhZ2VzIiwiX2NvdW50RGlyZWN0TWVzc2FnZXMiLCJ0b3RhbExpdmVjaGF0TWVzc2FnZXMiLCJfY291bnRMaXZlY2hhdE1lc3NhZ2VzIiwibGFzdExvZ2luIiwiVXNlcnMiLCJnZXRMYXN0TG9naW4iLCJsYXN0TWVzc2FnZVNlbnRBdCIsImdldExhc3RUaW1lc3RhbXAiLCJsYXN0U2VlblN1YnNjcmlwdGlvbiIsIlN1YnNjcmlwdGlvbnMiLCJnZXRMYXN0U2VlbiIsIm9zIiwiTnBtIiwidHlwZSIsInBsYXRmb3JtIiwiYXJjaCIsInJlbGVhc2UiLCJ1cHRpbWUiLCJsb2FkYXZnIiwidG90YWxtZW0iLCJmcmVlbWVtIiwiY3B1cyIsInByb2Nlc3MiLCJub2RlVmVyc2lvbiIsInBpZCIsImRlcGxveSIsIm1ldGhvZCIsImVudiIsIkRFUExPWV9NRVRIT0QiLCJERVBMT1lfUExBVEZPUk0iLCJtaWdyYXRpb24iLCJNaWdyYXRpb25zIiwiX2dldENvbnRyb2wiLCJpbnN0YW5jZUNvdW50IiwiSW5zdGFuY2VTdGF0dXMiLCJnZXRDb2xsZWN0aW9uIiwiX3VwZGF0ZWRBdCIsIiRndCIsIkRhdGUiLCJub3ciLCJNb25nb0ludGVybmFscyIsImRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIiwibW9uZ28iLCJfb3Bsb2dIYW5kbGUiLCJvbk9wbG9nRW50cnkiLCJvcGxvZ0VuYWJsZWQiLCJzYXZlIiwiaW5zZXJ0IiwibWV0aG9kcyIsImdldFN0YXRpc3RpY3MiLCJyZWZyZXNoIiwidXNlcklkIiwiRXJyb3IiLCJhdXRoeiIsImhhc1Blcm1pc3Npb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxXQUFXQyxVQUFYLEdBQXdCLEVBQXhCLEM7Ozs7Ozs7Ozs7O0FDQUFELFdBQVdFLE1BQVgsQ0FBa0JDLFVBQWxCLEdBQStCLElBQUksY0FBY0gsV0FBV0UsTUFBWCxDQUFrQkUsS0FBaEMsQ0FBc0M7QUFDeEVDLGVBQWM7QUFDYixRQUFNLFlBQU47QUFFQSxPQUFLQyxjQUFMLENBQW9CO0FBQUUsZ0JBQWE7QUFBZixHQUFwQjtBQUNBLEVBTHVFLENBT3hFOzs7QUFDQUMsYUFBWUMsR0FBWixFQUFpQkMsT0FBakIsRUFBMEI7QUFDekIsUUFBTUMsUUFBUTtBQUFFRjtBQUFGLEdBQWQ7QUFDQSxTQUFPLEtBQUtHLE9BQUwsQ0FBYUQsS0FBYixFQUFvQkQsT0FBcEIsQ0FBUDtBQUNBOztBQUVERyxZQUFXO0FBQ1YsUUFBTUgsVUFBVTtBQUNmSSxTQUFNO0FBQ0xDLGVBQVcsQ0FBQztBQURQLElBRFM7QUFJZkMsVUFBTztBQUpRLEdBQWhCO0FBTUEsUUFBTUMsVUFBVSxLQUFLQyxJQUFMLENBQVUsRUFBVixFQUFjUixPQUFkLEVBQXVCUyxLQUF2QixFQUFoQjtBQUNBLFNBQU9GLFdBQVdBLFFBQVEsQ0FBUixDQUFsQjtBQUNBOztBQXRCdUUsQ0FBMUMsRUFBL0IsQzs7Ozs7Ozs7Ozs7QUNBQSxJQUFJRyxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEOztBQUdOeEIsV0FBV0MsVUFBWCxDQUFzQndCLEdBQXRCLEdBQTRCLFNBQVNDLGNBQVQsR0FBMEI7QUFDckQsT0FBTXpCLGFBQWEsRUFBbkIsQ0FEcUQsQ0FHckQ7O0FBQ0FBLFlBQVcwQixRQUFYLEdBQXNCM0IsV0FBVzRCLFFBQVgsQ0FBb0JILEdBQXBCLENBQXdCLFVBQXhCLENBQXRCOztBQUNBLEtBQUl6QixXQUFXRSxNQUFYLENBQWtCMkIsUUFBbEIsQ0FBMkJsQixPQUEzQixDQUFtQyxVQUFuQyxDQUFKLEVBQW9EO0FBQ25EVixhQUFXNkIsV0FBWCxHQUF5QjlCLFdBQVdFLE1BQVgsQ0FBa0IyQixRQUFsQixDQUEyQmxCLE9BQTNCLENBQW1DLFVBQW5DLEVBQStDRyxTQUF4RTtBQUNBOztBQUVELEtBQUlkLFdBQVcrQixJQUFmLEVBQXFCO0FBQ3BCOUIsYUFBVytCLE9BQVgsR0FBcUJoQyxXQUFXK0IsSUFBWCxDQUFnQkMsT0FBckM7QUFDQS9CLGFBQVdnQyxHQUFYLEdBQWlCakMsV0FBVytCLElBQVgsQ0FBZ0JFLEdBQWpDO0FBQ0FoQyxhQUFXaUMsTUFBWCxHQUFvQmxDLFdBQVcrQixJQUFYLENBQWdCRyxNQUFwQztBQUNBLEVBYm9ELENBZXJEOzs7QUFDQWpDLFlBQVdrQyxVQUFYLEdBQXdCQyxPQUFPQyxLQUFQLENBQWFwQixJQUFiLEdBQW9CcUIsS0FBcEIsRUFBeEI7QUFDQXJDLFlBQVdzQyxXQUFYLEdBQXlCSCxPQUFPQyxLQUFQLENBQWFwQixJQUFiLENBQWtCO0FBQUV1QixVQUFRO0FBQVYsRUFBbEIsRUFBb0NGLEtBQXBDLEVBQXpCO0FBQ0FyQyxZQUFXd0MsY0FBWCxHQUE0QnhDLFdBQVdrQyxVQUFYLEdBQXdCbEMsV0FBV3NDLFdBQS9EO0FBQ0F0QyxZQUFXeUMsV0FBWCxHQUF5Qk4sT0FBT0MsS0FBUCxDQUFhcEIsSUFBYixDQUFrQjtBQUFFMEIsb0JBQWtCO0FBQXBCLEVBQWxCLEVBQWtETCxLQUFsRCxFQUF6QjtBQUNBckMsWUFBVzJDLFNBQVgsR0FBdUJSLE9BQU9DLEtBQVAsQ0FBYXBCLElBQWIsQ0FBa0I7QUFBRTBCLG9CQUFrQjtBQUFwQixFQUFsQixFQUFnREwsS0FBaEQsRUFBdkI7QUFDQXJDLFlBQVc0QyxZQUFYLEdBQTBCNUMsV0FBV2tDLFVBQVgsR0FBd0JsQyxXQUFXeUMsV0FBbkMsR0FBaUR6QyxXQUFXMkMsU0FBdEYsQ0FyQnFELENBdUJyRDs7QUFDQTNDLFlBQVc2QyxVQUFYLEdBQXdCOUMsV0FBV0UsTUFBWCxDQUFrQjZDLEtBQWxCLENBQXdCOUIsSUFBeEIsR0FBK0JxQixLQUEvQixFQUF4QjtBQUNBckMsWUFBVytDLGFBQVgsR0FBMkJoRCxXQUFXRSxNQUFYLENBQWtCNkMsS0FBbEIsQ0FBd0JFLFVBQXhCLENBQW1DLEdBQW5DLEVBQXdDWCxLQUF4QyxFQUEzQjtBQUNBckMsWUFBV2lELGtCQUFYLEdBQWdDbEQsV0FBV0UsTUFBWCxDQUFrQjZDLEtBQWxCLENBQXdCRSxVQUF4QixDQUFtQyxHQUFuQyxFQUF3Q1gsS0FBeEMsRUFBaEM7QUFDQXJDLFlBQVdrRCxXQUFYLEdBQXlCbkQsV0FBV0UsTUFBWCxDQUFrQjZDLEtBQWxCLENBQXdCRSxVQUF4QixDQUFtQyxHQUFuQyxFQUF3Q1gsS0FBeEMsRUFBekI7QUFDQXJDLFlBQVdtRCxjQUFYLEdBQTRCcEQsV0FBV0UsTUFBWCxDQUFrQjZDLEtBQWxCLENBQXdCRSxVQUF4QixDQUFtQyxHQUFuQyxFQUF3Q1gsS0FBeEMsRUFBNUIsQ0E1QnFELENBOEJyRDs7QUFDQXJDLFlBQVdvRCxhQUFYLEdBQTJCckQsV0FBV0UsTUFBWCxDQUFrQm9ELFFBQWxCLENBQTJCckMsSUFBM0IsR0FBa0NxQixLQUFsQyxFQUEzQjtBQUNBckMsWUFBV3NELG9CQUFYLEdBQWtDcEMsRUFBRXFDLE1BQUYsQ0FBU3hELFdBQVdFLE1BQVgsQ0FBa0I2QyxLQUFsQixDQUF3QkUsVUFBeEIsQ0FBbUMsR0FBbkMsRUFBd0M7QUFBRVEsVUFBUTtBQUFFLFdBQVE7QUFBVjtBQUFWLEVBQXhDLEVBQWtFdkMsS0FBbEUsRUFBVCxFQUFvRixTQUFTd0MscUJBQVQsQ0FBK0JDLEdBQS9CLEVBQW9DQyxJQUFwQyxFQUEwQztBQUFFLFNBQU9ELE1BQU1DLEtBQUtDLElBQWxCO0FBQXlCLEVBQXpKLEVBQTJKLENBQTNKLENBQWxDO0FBQ0E1RCxZQUFXNkQseUJBQVgsR0FBdUMzQyxFQUFFcUMsTUFBRixDQUFTeEQsV0FBV0UsTUFBWCxDQUFrQjZDLEtBQWxCLENBQXdCRSxVQUF4QixDQUFtQyxHQUFuQyxFQUF3QztBQUFFUSxVQUFRO0FBQUUsV0FBUTtBQUFWO0FBQVYsRUFBeEMsRUFBa0V2QyxLQUFsRSxFQUFULEVBQW9GLFNBQVM2QywwQkFBVCxDQUFvQ0osR0FBcEMsRUFBeUNDLElBQXpDLEVBQStDO0FBQUUsU0FBT0QsTUFBTUMsS0FBS0MsSUFBbEI7QUFBeUIsRUFBOUosRUFBZ0ssQ0FBaEssQ0FBdkM7QUFDQTVELFlBQVcrRCxtQkFBWCxHQUFpQzdDLEVBQUVxQyxNQUFGLENBQVN4RCxXQUFXRSxNQUFYLENBQWtCNkMsS0FBbEIsQ0FBd0JFLFVBQXhCLENBQW1DLEdBQW5DLEVBQXdDO0FBQUVRLFVBQVE7QUFBRSxXQUFRO0FBQVY7QUFBVixFQUF4QyxFQUFrRXZDLEtBQWxFLEVBQVQsRUFBb0YsU0FBUytDLG9CQUFULENBQThCTixHQUE5QixFQUFtQ0MsSUFBbkMsRUFBeUM7QUFBRSxTQUFPRCxNQUFNQyxLQUFLQyxJQUFsQjtBQUF5QixFQUF4SixFQUEwSixDQUExSixDQUFqQztBQUNBNUQsWUFBV2lFLHFCQUFYLEdBQW1DL0MsRUFBRXFDLE1BQUYsQ0FBU3hELFdBQVdFLE1BQVgsQ0FBa0I2QyxLQUFsQixDQUF3QkUsVUFBeEIsQ0FBbUMsR0FBbkMsRUFBd0M7QUFBRVEsVUFBUTtBQUFFLFdBQVE7QUFBVjtBQUFWLEVBQXhDLEVBQWtFdkMsS0FBbEUsRUFBVCxFQUFvRixTQUFTaUQsc0JBQVQsQ0FBZ0NSLEdBQWhDLEVBQXFDQyxJQUFyQyxFQUEyQztBQUFFLFNBQU9ELE1BQU1DLEtBQUtDLElBQWxCO0FBQXlCLEVBQTFKLEVBQTRKLENBQTVKLENBQW5DO0FBRUE1RCxZQUFXbUUsU0FBWCxHQUF1QnBFLFdBQVdFLE1BQVgsQ0FBa0JtRSxLQUFsQixDQUF3QkMsWUFBeEIsRUFBdkI7QUFDQXJFLFlBQVdzRSxpQkFBWCxHQUErQnZFLFdBQVdFLE1BQVgsQ0FBa0JvRCxRQUFsQixDQUEyQmtCLGdCQUEzQixFQUEvQjtBQUNBdkUsWUFBV3dFLG9CQUFYLEdBQWtDekUsV0FBV0UsTUFBWCxDQUFrQndFLGFBQWxCLENBQWdDQyxXQUFoQyxFQUFsQzs7QUFFQSxPQUFNQyxLQUFLQyxJQUFJdkQsT0FBSixDQUFZLElBQVosQ0FBWDs7QUFDQXJCLFlBQVcyRSxFQUFYLEdBQWdCO0FBQ2ZFLFFBQU1GLEdBQUdFLElBQUgsRUFEUztBQUVmQyxZQUFVSCxHQUFHRyxRQUFILEVBRks7QUFHZkMsUUFBTUosR0FBR0ksSUFBSCxFQUhTO0FBSWZDLFdBQVNMLEdBQUdLLE9BQUgsRUFKTTtBQUtmQyxVQUFRTixHQUFHTSxNQUFILEVBTE87QUFNZkMsV0FBU1AsR0FBR08sT0FBSCxFQU5NO0FBT2ZDLFlBQVVSLEdBQUdRLFFBQUgsRUFQSztBQVFmQyxXQUFTVCxHQUFHUyxPQUFILEVBUk07QUFTZkMsUUFBTVYsR0FBR1UsSUFBSDtBQVRTLEVBQWhCO0FBWUFyRixZQUFXc0YsT0FBWCxHQUFxQjtBQUNwQkMsZUFBYUQsUUFBUXZELE9BREQ7QUFFcEJ5RCxPQUFLRixRQUFRRSxHQUZPO0FBR3BCUCxVQUFRSyxRQUFRTCxNQUFSO0FBSFksRUFBckI7QUFNQWpGLFlBQVd5RixNQUFYLEdBQW9CO0FBQ25CQyxVQUFRSixRQUFRSyxHQUFSLENBQVlDLGFBQVosSUFBNkIsS0FEbEI7QUFFbkJkLFlBQVVRLFFBQVFLLEdBQVIsQ0FBWUUsZUFBWixJQUErQjtBQUZ0QixFQUFwQjtBQUtBN0YsWUFBVzhGLFNBQVgsR0FBdUIvRixXQUFXZ0csVUFBWCxDQUFzQkMsV0FBdEIsRUFBdkI7QUFDQWhHLFlBQVdpRyxhQUFYLEdBQTJCQyxlQUFlQyxhQUFmLEdBQStCbkYsSUFBL0IsQ0FBb0M7QUFBRW9GLGNBQVk7QUFBRUMsUUFBSyxJQUFJQyxJQUFKLENBQVNBLEtBQUtDLEdBQUwsS0FBYWpCLFFBQVFMLE1BQVIsS0FBbUIsSUFBaEMsR0FBdUMsSUFBaEQ7QUFBUDtBQUFkLEVBQXBDLEVBQW1INUMsS0FBbkgsRUFBM0I7O0FBRUEsS0FBSW1FLGVBQWVDLDZCQUFmLEdBQStDQyxLQUEvQyxDQUFxREMsWUFBckQsSUFBcUVILGVBQWVDLDZCQUFmLEdBQStDQyxLQUEvQyxDQUFxREMsWUFBckQsQ0FBa0VDLFlBQXZJLElBQXVKN0csV0FBVzRCLFFBQVgsQ0FBb0JILEdBQXBCLENBQXdCLCtCQUF4QixNQUE2RCxJQUF4TixFQUE4TjtBQUM3TnhCLGFBQVc2RyxZQUFYLEdBQTBCLElBQTFCO0FBQ0E7O0FBRUQsUUFBTzdHLFVBQVA7QUFDQSxDQXpFRCxDOzs7Ozs7Ozs7OztBQ0hBRCxXQUFXQyxVQUFYLENBQXNCOEcsSUFBdEIsR0FBNkIsWUFBVztBQUN2QyxPQUFNOUcsYUFBYUQsV0FBV0MsVUFBWCxDQUFzQndCLEdBQXRCLEVBQW5CO0FBQ0F4QixZQUFXYSxTQUFYLEdBQXVCLElBQUl5RixJQUFKLEVBQXZCO0FBQ0F2RyxZQUFXRSxNQUFYLENBQWtCQyxVQUFsQixDQUE2QjZHLE1BQTdCLENBQW9DL0csVUFBcEM7QUFDQSxRQUFPQSxVQUFQO0FBQ0EsQ0FMRCxDOzs7Ozs7Ozs7OztBQ0FBbUMsT0FBTzZFLE9BQVAsQ0FBZTtBQUNkQyxlQUFjQyxPQUFkLEVBQXVCO0FBQ3RCLE1BQUksQ0FBQy9FLE9BQU9nRixNQUFQLEVBQUwsRUFBc0I7QUFDckIsU0FBTSxJQUFJaEYsT0FBT2lGLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQUUxQixZQUFRO0FBQVYsSUFBdkQsQ0FBTjtBQUNBOztBQUVELE1BQUkzRixXQUFXc0gsS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0JuRixPQUFPZ0YsTUFBUCxFQUEvQixFQUFnRCxpQkFBaEQsTUFBdUUsSUFBM0UsRUFBaUY7QUFDaEYsU0FBTSxJQUFJaEYsT0FBT2lGLEtBQVgsQ0FBaUIsbUJBQWpCLEVBQXNDLGFBQXRDLEVBQXFEO0FBQUUxQixZQUFRO0FBQVYsSUFBckQsQ0FBTjtBQUNBOztBQUVELE1BQUl3QixPQUFKLEVBQWE7QUFDWixVQUFPbkgsV0FBV0MsVUFBWCxDQUFzQjhHLElBQXRCLEVBQVA7QUFDQSxHQUZELE1BRU87QUFDTixVQUFPL0csV0FBV0UsTUFBWCxDQUFrQkMsVUFBbEIsQ0FBNkJTLFFBQTdCLEVBQVA7QUFDQTtBQUNEOztBQWZhLENBQWYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zdGF0aXN0aWNzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiUm9ja2V0Q2hhdC5zdGF0aXN0aWNzID0ge307XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5TdGF0aXN0aWNzID0gbmV3IGNsYXNzIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignc3RhdGlzdGljcycpO1xuXG5cdFx0dGhpcy50cnlFbnN1cmVJbmRleCh7ICdjcmVhdGVkQXQnOiAxIH0pO1xuXHR9XG5cblx0Ly8gRklORCBPTkVcblx0ZmluZE9uZUJ5SWQoX2lkLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgcXVlcnkgPSB7IF9pZCB9O1xuXHRcdHJldHVybiB0aGlzLmZpbmRPbmUocXVlcnksIG9wdGlvbnMpO1xuXHR9XG5cblx0ZmluZExhc3QoKSB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRcdHNvcnQ6IHtcblx0XHRcdFx0Y3JlYXRlZEF0OiAtMVxuXHRcdFx0fSxcblx0XHRcdGxpbWl0OiAxXG5cdFx0fTtcblx0XHRjb25zdCByZWNvcmRzID0gdGhpcy5maW5kKHt9LCBvcHRpb25zKS5mZXRjaCgpO1xuXHRcdHJldHVybiByZWNvcmRzICYmIHJlY29yZHNbMF07XG5cdH1cbn07XG4iLCIvKiBnbG9iYWwgSW5zdGFuY2VTdGF0dXMsIE1vbmdvSW50ZXJuYWxzICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuUm9ja2V0Q2hhdC5zdGF0aXN0aWNzLmdldCA9IGZ1bmN0aW9uIF9nZXRTdGF0aXN0aWNzKCkge1xuXHRjb25zdCBzdGF0aXN0aWNzID0ge307XG5cblx0Ly8gVmVyc2lvblxuXHRzdGF0aXN0aWNzLnVuaXF1ZUlkID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ3VuaXF1ZUlEJyk7XG5cdGlmIChSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kT25lKCd1bmlxdWVJRCcpKSB7XG5cdFx0c3RhdGlzdGljcy5pbnN0YWxsZWRBdCA9IFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmRPbmUoJ3VuaXF1ZUlEJykuY3JlYXRlZEF0O1xuXHR9XG5cblx0aWYgKFJvY2tldENoYXQuSW5mbykge1xuXHRcdHN0YXRpc3RpY3MudmVyc2lvbiA9IFJvY2tldENoYXQuSW5mby52ZXJzaW9uO1xuXHRcdHN0YXRpc3RpY3MudGFnID0gUm9ja2V0Q2hhdC5JbmZvLnRhZztcblx0XHRzdGF0aXN0aWNzLmJyYW5jaCA9IFJvY2tldENoYXQuSW5mby5icmFuY2g7XG5cdH1cblxuXHQvLyBVc2VyIHN0YXRpc3RpY3Ncblx0c3RhdGlzdGljcy50b3RhbFVzZXJzID0gTWV0ZW9yLnVzZXJzLmZpbmQoKS5jb3VudCgpO1xuXHRzdGF0aXN0aWNzLmFjdGl2ZVVzZXJzID0gTWV0ZW9yLnVzZXJzLmZpbmQoeyBhY3RpdmU6IHRydWUgfSkuY291bnQoKTtcblx0c3RhdGlzdGljcy5ub25BY3RpdmVVc2VycyA9IHN0YXRpc3RpY3MudG90YWxVc2VycyAtIHN0YXRpc3RpY3MuYWN0aXZlVXNlcnM7XG5cdHN0YXRpc3RpY3Mub25saW5lVXNlcnMgPSBNZXRlb3IudXNlcnMuZmluZCh7IHN0YXR1c0Nvbm5lY3Rpb246ICdvbmxpbmUnIH0pLmNvdW50KCk7XG5cdHN0YXRpc3RpY3MuYXdheVVzZXJzID0gTWV0ZW9yLnVzZXJzLmZpbmQoeyBzdGF0dXNDb25uZWN0aW9uOiAnYXdheScgfSkuY291bnQoKTtcblx0c3RhdGlzdGljcy5vZmZsaW5lVXNlcnMgPSBzdGF0aXN0aWNzLnRvdGFsVXNlcnMgLSBzdGF0aXN0aWNzLm9ubGluZVVzZXJzIC0gc3RhdGlzdGljcy5hd2F5VXNlcnM7XG5cblx0Ly8gUm9vbSBzdGF0aXN0aWNzXG5cdHN0YXRpc3RpY3MudG90YWxSb29tcyA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmQoKS5jb3VudCgpO1xuXHRzdGF0aXN0aWNzLnRvdGFsQ2hhbm5lbHMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kQnlUeXBlKCdjJykuY291bnQoKTtcblx0c3RhdGlzdGljcy50b3RhbFByaXZhdGVHcm91cHMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kQnlUeXBlKCdwJykuY291bnQoKTtcblx0c3RhdGlzdGljcy50b3RhbERpcmVjdCA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRCeVR5cGUoJ2QnKS5jb3VudCgpO1xuXHRzdGF0aXN0aWNzLnRvdGxhbExpdmVjaGF0ID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VHlwZSgnbCcpLmNvdW50KCk7XG5cblx0Ly8gTWVzc2FnZSBzdGF0aXN0aWNzXG5cdHN0YXRpc3RpY3MudG90YWxNZXNzYWdlcyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmQoKS5jb3VudCgpO1xuXHRzdGF0aXN0aWNzLnRvdGFsQ2hhbm5lbE1lc3NhZ2VzID0gXy5yZWR1Y2UoUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VHlwZSgnYycsIHsgZmllbGRzOiB7ICdtc2dzJzogMSB9fSkuZmV0Y2goKSwgZnVuY3Rpb24gX2NvdW50Q2hhbm5lbE1lc3NhZ2VzKG51bSwgcm9vbSkgeyByZXR1cm4gbnVtICsgcm9vbS5tc2dzOyB9LCAwKTtcblx0c3RhdGlzdGljcy50b3RhbFByaXZhdGVHcm91cE1lc3NhZ2VzID0gXy5yZWR1Y2UoUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VHlwZSgncCcsIHsgZmllbGRzOiB7ICdtc2dzJzogMSB9fSkuZmV0Y2goKSwgZnVuY3Rpb24gX2NvdW50UHJpdmF0ZUdyb3VwTWVzc2FnZXMobnVtLCByb29tKSB7IHJldHVybiBudW0gKyByb29tLm1zZ3M7IH0sIDApO1xuXHRzdGF0aXN0aWNzLnRvdGFsRGlyZWN0TWVzc2FnZXMgPSBfLnJlZHVjZShSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kQnlUeXBlKCdkJywgeyBmaWVsZHM6IHsgJ21zZ3MnOiAxIH19KS5mZXRjaCgpLCBmdW5jdGlvbiBfY291bnREaXJlY3RNZXNzYWdlcyhudW0sIHJvb20pIHsgcmV0dXJuIG51bSArIHJvb20ubXNnczsgfSwgMCk7XG5cdHN0YXRpc3RpY3MudG90YWxMaXZlY2hhdE1lc3NhZ2VzID0gXy5yZWR1Y2UoUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VHlwZSgnbCcsIHsgZmllbGRzOiB7ICdtc2dzJzogMSB9fSkuZmV0Y2goKSwgZnVuY3Rpb24gX2NvdW50TGl2ZWNoYXRNZXNzYWdlcyhudW0sIHJvb20pIHsgcmV0dXJuIG51bSArIHJvb20ubXNnczsgfSwgMCk7XG5cblx0c3RhdGlzdGljcy5sYXN0TG9naW4gPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXRMYXN0TG9naW4oKTtcblx0c3RhdGlzdGljcy5sYXN0TWVzc2FnZVNlbnRBdCA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmdldExhc3RUaW1lc3RhbXAoKTtcblx0c3RhdGlzdGljcy5sYXN0U2VlblN1YnNjcmlwdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZ2V0TGFzdFNlZW4oKTtcblxuXHRjb25zdCBvcyA9IE5wbS5yZXF1aXJlKCdvcycpO1xuXHRzdGF0aXN0aWNzLm9zID0ge1xuXHRcdHR5cGU6IG9zLnR5cGUoKSxcblx0XHRwbGF0Zm9ybTogb3MucGxhdGZvcm0oKSxcblx0XHRhcmNoOiBvcy5hcmNoKCksXG5cdFx0cmVsZWFzZTogb3MucmVsZWFzZSgpLFxuXHRcdHVwdGltZTogb3MudXB0aW1lKCksXG5cdFx0bG9hZGF2Zzogb3MubG9hZGF2ZygpLFxuXHRcdHRvdGFsbWVtOiBvcy50b3RhbG1lbSgpLFxuXHRcdGZyZWVtZW06IG9zLmZyZWVtZW0oKSxcblx0XHRjcHVzOiBvcy5jcHVzKClcblx0fTtcblxuXHRzdGF0aXN0aWNzLnByb2Nlc3MgPSB7XG5cdFx0bm9kZVZlcnNpb246IHByb2Nlc3MudmVyc2lvbixcblx0XHRwaWQ6IHByb2Nlc3MucGlkLFxuXHRcdHVwdGltZTogcHJvY2Vzcy51cHRpbWUoKVxuXHR9O1xuXG5cdHN0YXRpc3RpY3MuZGVwbG95ID0ge1xuXHRcdG1ldGhvZDogcHJvY2Vzcy5lbnYuREVQTE9ZX01FVEhPRCB8fCAndGFyJyxcblx0XHRwbGF0Zm9ybTogcHJvY2Vzcy5lbnYuREVQTE9ZX1BMQVRGT1JNIHx8ICdzZWxmaW5zdGFsbCdcblx0fTtcblxuXHRzdGF0aXN0aWNzLm1pZ3JhdGlvbiA9IFJvY2tldENoYXQuTWlncmF0aW9ucy5fZ2V0Q29udHJvbCgpO1xuXHRzdGF0aXN0aWNzLmluc3RhbmNlQ291bnQgPSBJbnN0YW5jZVN0YXR1cy5nZXRDb2xsZWN0aW9uKCkuZmluZCh7IF91cGRhdGVkQXQ6IHsgJGd0OiBuZXcgRGF0ZShEYXRlLm5vdygpIC0gcHJvY2Vzcy51cHRpbWUoKSAqIDEwMDAgLSAyMDAwKSB9fSkuY291bnQoKTtcblxuXHRpZiAoTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIoKS5tb25nby5fb3Bsb2dIYW5kbGUgJiYgTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIoKS5tb25nby5fb3Bsb2dIYW5kbGUub25PcGxvZ0VudHJ5ICYmIFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGb3JjZV9EaXNhYmxlX09wTG9nX0Zvcl9DYWNoZScpICE9PSB0cnVlKSB7XG5cdFx0c3RhdGlzdGljcy5vcGxvZ0VuYWJsZWQgPSB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIHN0YXRpc3RpY3M7XG59O1xuIiwiUm9ja2V0Q2hhdC5zdGF0aXN0aWNzLnNhdmUgPSBmdW5jdGlvbigpIHtcblx0Y29uc3Qgc3RhdGlzdGljcyA9IFJvY2tldENoYXQuc3RhdGlzdGljcy5nZXQoKTtcblx0c3RhdGlzdGljcy5jcmVhdGVkQXQgPSBuZXcgRGF0ZTtcblx0Um9ja2V0Q2hhdC5tb2RlbHMuU3RhdGlzdGljcy5pbnNlcnQoc3RhdGlzdGljcyk7XG5cdHJldHVybiBzdGF0aXN0aWNzO1xufTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0Z2V0U3RhdGlzdGljcyhyZWZyZXNoKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2dldFN0YXRpc3RpY3MnIH0pO1xuXHRcdH1cblxuXHRcdGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1zdGF0aXN0aWNzJykgIT09IHRydWUpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdnZXRTdGF0aXN0aWNzJyB9KTtcblx0XHR9XG5cblx0XHRpZiAocmVmcmVzaCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuc3RhdGlzdGljcy5zYXZlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5TdGF0aXN0aWNzLmZpbmRMYXN0KCk7XG5cdFx0fVxuXHR9XG59KTtcbiJdfQ==
