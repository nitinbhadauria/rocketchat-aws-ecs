(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var fileUpload = Package['rocketchat:ui'].fileUpload;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:message-mark-as-unread":{"server":{"logger.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_message-mark-as-unread/server/logger.js                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
const logger = new Logger('MessageMarkAsUnread', {
	sections: {
		connection: 'Connection',
		events: 'Events'
	}
});
module.exportDefault(logger);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"unreadMessages.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_message-mark-as-unread/server/unreadMessages.js                                                //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
let logger;
module.watch(require("./logger"), {
	default(v) {
		logger = v;
	}

}, 0);
Meteor.methods({
	unreadMessages(firstUnreadMessage) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'unreadMessages'
			});
		}

		const originalMessage = RocketChat.models.Messages.findOneById(firstUnreadMessage._id, {
			fields: {
				u: 1,
				rid: 1,
				file: 1,
				ts: 1
			}
		});

		if (originalMessage == null || Meteor.userId() === originalMessage.u._id) {
			throw new Meteor.Error('error-action-not-allowed', 'Not allowed', {
				method: 'unreadMessages',
				action: 'Unread_messages'
			});
		}

		const lastSeen = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(originalMessage.rid, Meteor.userId()).ls;

		if (firstUnreadMessage.ts >= lastSeen) {
			return logger.connection.debug('Provided message is already marked as unread');
		}

		logger.connection.debug(`Updating unread  message of ${originalMessage.ts} as the first unread`);
		return RocketChat.models.Subscriptions.setAsUnreadByRoomIdAndUserId(originalMessage.rid, Meteor.userId(), originalMessage.ts);
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:message-mark-as-unread/server/logger.js");
require("./node_modules/meteor/rocketchat:message-mark-as-unread/server/unreadMessages.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:message-mark-as-unread'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_message-mark-as-unread.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZXNzYWdlLW1hcmstYXMtdW5yZWFkL3NlcnZlci9sb2dnZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1tYXJrLWFzLXVucmVhZC9zZXJ2ZXIvdW5yZWFkTWVzc2FnZXMuanMiXSwibmFtZXMiOlsibG9nZ2VyIiwiTG9nZ2VyIiwic2VjdGlvbnMiLCJjb25uZWN0aW9uIiwiZXZlbnRzIiwibW9kdWxlIiwiZXhwb3J0RGVmYXVsdCIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2IiwiTWV0ZW9yIiwibWV0aG9kcyIsInVucmVhZE1lc3NhZ2VzIiwiZmlyc3RVbnJlYWRNZXNzYWdlIiwidXNlcklkIiwiRXJyb3IiLCJtZXRob2QiLCJvcmlnaW5hbE1lc3NhZ2UiLCJSb2NrZXRDaGF0IiwibW9kZWxzIiwiTWVzc2FnZXMiLCJmaW5kT25lQnlJZCIsIl9pZCIsImZpZWxkcyIsInUiLCJyaWQiLCJmaWxlIiwidHMiLCJhY3Rpb24iLCJsYXN0U2VlbiIsIlN1YnNjcmlwdGlvbnMiLCJmaW5kT25lQnlSb29tSWRBbmRVc2VySWQiLCJscyIsImRlYnVnIiwic2V0QXNVbnJlYWRCeVJvb21JZEFuZFVzZXJJZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxNQUFNQSxTQUFTLElBQUlDLE1BQUosQ0FBVyxxQkFBWCxFQUFrQztBQUNoREMsV0FBVTtBQUNUQyxjQUFZLFlBREg7QUFFVEMsVUFBUTtBQUZDO0FBRHNDLENBQWxDLENBQWY7QUFBQUMsT0FBT0MsYUFBUCxDQU1lTixNQU5mLEU7Ozs7Ozs7Ozs7O0FDQUEsSUFBSUEsTUFBSjtBQUFXSyxPQUFPRSxLQUFQLENBQWFDLFFBQVEsVUFBUixDQUFiLEVBQWlDO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDVixXQUFPVSxDQUFQO0FBQVM7O0FBQXJCLENBQWpDLEVBQXdELENBQXhEO0FBQ1hDLE9BQU9DLE9BQVAsQ0FBZTtBQUNkQyxnQkFBZUMsa0JBQWYsRUFBbUM7QUFDbEMsTUFBSSxDQUFDSCxPQUFPSSxNQUFQLEVBQUwsRUFBc0I7QUFDckIsU0FBTSxJQUFJSixPQUFPSyxLQUFYLENBQWlCLG9CQUFqQixFQUF1QyxjQUF2QyxFQUF1RDtBQUM1REMsWUFBUTtBQURvRCxJQUF2RCxDQUFOO0FBR0E7O0FBQ0QsUUFBTUMsa0JBQWtCQyxXQUFXQyxNQUFYLENBQWtCQyxRQUFsQixDQUEyQkMsV0FBM0IsQ0FBdUNSLG1CQUFtQlMsR0FBMUQsRUFBK0Q7QUFDdEZDLFdBQVE7QUFDUEMsT0FBRyxDQURJO0FBRVBDLFNBQUssQ0FGRTtBQUdQQyxVQUFNLENBSEM7QUFJUEMsUUFBSTtBQUpHO0FBRDhFLEdBQS9ELENBQXhCOztBQVFBLE1BQUlWLG1CQUFtQixJQUFuQixJQUEyQlAsT0FBT0ksTUFBUCxPQUFvQkcsZ0JBQWdCTyxDQUFoQixDQUFrQkYsR0FBckUsRUFBMEU7QUFDekUsU0FBTSxJQUFJWixPQUFPSyxLQUFYLENBQWlCLDBCQUFqQixFQUE2QyxhQUE3QyxFQUE0RDtBQUNqRUMsWUFBUSxnQkFEeUQ7QUFFakVZLFlBQVE7QUFGeUQsSUFBNUQsQ0FBTjtBQUlBOztBQUNELFFBQU1DLFdBQVdYLFdBQVdDLE1BQVgsQ0FBa0JXLGFBQWxCLENBQWdDQyx3QkFBaEMsQ0FBeURkLGdCQUFnQlEsR0FBekUsRUFBOEVmLE9BQU9JLE1BQVAsRUFBOUUsRUFBK0ZrQixFQUFoSDs7QUFDQSxNQUFJbkIsbUJBQW1CYyxFQUFuQixJQUF5QkUsUUFBN0IsRUFBdUM7QUFDdEMsVUFBTzlCLE9BQU9HLFVBQVAsQ0FBa0IrQixLQUFsQixDQUF3Qiw4Q0FBeEIsQ0FBUDtBQUNBOztBQUNEbEMsU0FBT0csVUFBUCxDQUFrQitCLEtBQWxCLENBQXlCLCtCQUErQmhCLGdCQUFnQlUsRUFBSSxzQkFBNUU7QUFDQSxTQUFPVCxXQUFXQyxNQUFYLENBQWtCVyxhQUFsQixDQUFnQ0ksNEJBQWhDLENBQTZEakIsZ0JBQWdCUSxHQUE3RSxFQUFrRmYsT0FBT0ksTUFBUCxFQUFsRixFQUFtR0csZ0JBQWdCVSxFQUFuSCxDQUFQO0FBQ0E7O0FBM0JhLENBQWYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9tZXNzYWdlLW1hcmstYXMtdW5yZWFkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcignTWVzc2FnZU1hcmtBc1VucmVhZCcsIHtcblx0c2VjdGlvbnM6IHtcblx0XHRjb25uZWN0aW9uOiAnQ29ubmVjdGlvbicsXG5cdFx0ZXZlbnRzOiAnRXZlbnRzJ1xuXHR9XG59KTtcbmV4cG9ydCBkZWZhdWx0IGxvZ2dlcjtcbiIsImltcG9ydCBsb2dnZXIgZnJvbSAnLi9sb2dnZXInO1xuTWV0ZW9yLm1ldGhvZHMoe1xuXHR1bnJlYWRNZXNzYWdlcyhmaXJzdFVucmVhZE1lc3NhZ2UpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHtcblx0XHRcdFx0bWV0aG9kOiAndW5yZWFkTWVzc2FnZXMnXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y29uc3Qgb3JpZ2luYWxNZXNzYWdlID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQoZmlyc3RVbnJlYWRNZXNzYWdlLl9pZCwge1xuXHRcdFx0ZmllbGRzOiB7XG5cdFx0XHRcdHU6IDEsXG5cdFx0XHRcdHJpZDogMSxcblx0XHRcdFx0ZmlsZTogMSxcblx0XHRcdFx0dHM6IDFcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAob3JpZ2luYWxNZXNzYWdlID09IG51bGwgfHwgTWV0ZW9yLnVzZXJJZCgpID09PSBvcmlnaW5hbE1lc3NhZ2UudS5faWQpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAndW5yZWFkTWVzc2FnZXMnLFxuXHRcdFx0XHRhY3Rpb246ICdVbnJlYWRfbWVzc2FnZXMnXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y29uc3QgbGFzdFNlZW4gPSBSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRPbmVCeVJvb21JZEFuZFVzZXJJZChvcmlnaW5hbE1lc3NhZ2UucmlkLCBNZXRlb3IudXNlcklkKCkpLmxzO1xuXHRcdGlmIChmaXJzdFVucmVhZE1lc3NhZ2UudHMgPj0gbGFzdFNlZW4pIHtcblx0XHRcdHJldHVybiBsb2dnZXIuY29ubmVjdGlvbi5kZWJ1ZygnUHJvdmlkZWQgbWVzc2FnZSBpcyBhbHJlYWR5IG1hcmtlZCBhcyB1bnJlYWQnKTtcblx0XHR9XG5cdFx0bG9nZ2VyLmNvbm5lY3Rpb24uZGVidWcoYFVwZGF0aW5nIHVucmVhZCAgbWVzc2FnZSBvZiAkeyBvcmlnaW5hbE1lc3NhZ2UudHMgfSBhcyB0aGUgZmlyc3QgdW5yZWFkYCk7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuc2V0QXNVbnJlYWRCeVJvb21JZEFuZFVzZXJJZChvcmlnaW5hbE1lc3NhZ2UucmlkLCBNZXRlb3IudXNlcklkKCksIG9yaWdpbmFsTWVzc2FnZS50cyk7XG5cdH1cbn0pO1xuIl19
