(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:push-notifications":{"server":{"methods":{"saveNotificationSettings.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_push-notifications/server/methods/saveNotificationSettings.js                                //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
Meteor.methods({
	saveNotificationSettings(rid, field, value) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'saveNotificationSettings'
			});
		}

		check(rid, String);
		check(field, String);
		check(value, String);

		if (['audioNotifications', 'desktopNotifications', 'mobilePushNotifications', 'emailNotifications', 'unreadAlert', 'disableNotifications', 'hideUnreadStatus'].indexOf(field) === -1) {
			throw new Meteor.Error('error-invalid-settings', 'Invalid settings field', {
				method: 'saveNotificationSettings'
			});
		}

		if (field !== 'hideUnreadStatus' && field !== 'disableNotifications' && ['all', 'mentions', 'nothing', 'default'].indexOf(value) === -1) {
			throw new Meteor.Error('error-invalid-settings', 'Invalid settings value', {
				method: 'saveNotificationSettings'
			});
		}

		const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(rid, Meteor.userId());

		if (!subscription) {
			throw new Meteor.Error('error-invalid-subscription', 'Invalid subscription', {
				method: 'saveNotificationSettings'
			});
		}

		switch (field) {
			case 'audioNotifications':
				RocketChat.models.Subscriptions.updateAudioNotificationsById(subscription._id, value);
				break;

			case 'desktopNotifications':
				RocketChat.models.Subscriptions.updateDesktopNotificationsById(subscription._id, value);
				break;

			case 'mobilePushNotifications':
				RocketChat.models.Subscriptions.updateMobilePushNotificationsById(subscription._id, value);
				break;

			case 'emailNotifications':
				RocketChat.models.Subscriptions.updateEmailNotificationsById(subscription._id, value);
				break;

			case 'unreadAlert':
				RocketChat.models.Subscriptions.updateUnreadAlertById(subscription._id, value);
				break;

			case 'disableNotifications':
				RocketChat.models.Subscriptions.updateDisableNotificationsById(subscription._id, value === '1' ? true : false);
				break;

			case 'hideUnreadStatus':
				RocketChat.models.Subscriptions.updateHideUnreadStatusById(subscription._id, value === '1' ? true : false);
				break;
		}

		return true;
	},

	saveAudioNotificationValue(rid, value) {
		const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(rid, Meteor.userId());

		if (!subscription) {
			throw new Meteor.Error('error-invalid-subscription', 'Invalid subscription', {
				method: 'saveAudioNotificationValue'
			});
		}

		RocketChat.models.Subscriptions.updateAudioNotificationValueById(subscription._id, value);
		return true;
	},

	saveDesktopNotificationDuration(rid, value) {
		const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(rid, Meteor.userId());

		if (!subscription) {
			throw new Meteor.Error('error-invalid-subscription', 'Invalid subscription', {
				method: 'saveDesktopNotificationDuration'
			});
		}

		RocketChat.models.Subscriptions.updateDesktopNotificationDurationById(subscription._id, value);
		return true;
	}

});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"Subscriptions.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_push-notifications/server/models/Subscriptions.js                                            //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.models.Subscriptions.updateAudioNotificationsById = function (_id, audioNotifications) {
	const query = {
		_id
	};
	const update = {};

	if (audioNotifications === 'default') {
		update.$unset = {
			audioNotifications: 1
		};
	} else {
		update.$set = {
			audioNotifications
		};
	}

	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateAudioNotificationValueById = function (_id, audioNotificationValue) {
	const query = {
		_id
	};
	const update = {
		$set: {
			audioNotificationValue
		}
	};
	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateDesktopNotificationsById = function (_id, desktopNotifications) {
	const query = {
		_id
	};
	const update = {};

	if (desktopNotifications === 'default') {
		update.$unset = {
			desktopNotifications: 1
		};
	} else {
		update.$set = {
			desktopNotifications
		};
	}

	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateDesktopNotificationDurationById = function (_id, value) {
	const query = {
		_id
	};
	const update = {
		$set: {
			desktopNotificationDuration: value - 0
		}
	};
	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateMobilePushNotificationsById = function (_id, mobilePushNotifications) {
	const query = {
		_id
	};
	const update = {};

	if (mobilePushNotifications === 'default') {
		update.$unset = {
			mobilePushNotifications: 1
		};
	} else {
		update.$set = {
			mobilePushNotifications
		};
	}

	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateEmailNotificationsById = function (_id, emailNotifications) {
	const query = {
		_id
	};
	const update = {
		$set: {
			emailNotifications
		}
	};
	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateUnreadAlertById = function (_id, unreadAlert) {
	const query = {
		_id
	};
	const update = {
		$set: {
			unreadAlert
		}
	};
	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateDisableNotificationsById = function (_id, disableNotifications) {
	const query = {
		_id
	};
	const update = {
		$set: {
			disableNotifications
		}
	};
	return this.update(query, update);
};

RocketChat.models.Subscriptions.updateHideUnreadStatusById = function (_id, hideUnreadStatus) {
	const query = {
		_id
	};
	const update = {
		$set: {
			hideUnreadStatus
		}
	};
	return this.update(query, update);
};

RocketChat.models.Subscriptions.findAlwaysNotifyAudioUsersByRoomId = function (roomId) {
	const query = {
		rid: roomId,
		audioNotifications: 'all'
	};
	return this.find(query);
};

RocketChat.models.Subscriptions.findAlwaysNotifyDesktopUsersByRoomId = function (roomId) {
	const query = {
		rid: roomId,
		desktopNotifications: 'all'
	};
	return this.find(query);
};

RocketChat.models.Subscriptions.findDontNotifyDesktopUsersByRoomId = function (roomId) {
	const query = {
		rid: roomId,
		desktopNotifications: 'nothing'
	};
	return this.find(query);
};

RocketChat.models.Subscriptions.findAlwaysNotifyMobileUsersByRoomId = function (roomId) {
	const query = {
		rid: roomId,
		mobilePushNotifications: 'all'
	};
	return this.find(query);
};

RocketChat.models.Subscriptions.findDontNotifyMobileUsersByRoomId = function (roomId) {
	const query = {
		rid: roomId,
		mobilePushNotifications: 'nothing'
	};
	return this.find(query);
};

RocketChat.models.Subscriptions.findNotificationPreferencesByRoom = function (roomId, explicit) {
	const query = {
		rid: roomId,
		'u._id': {
			$exists: true
		}
	};

	if (explicit) {
		query.$or = [{
			audioNotifications: {
				$exists: true
			}
		}, {
			audioNotificationValue: {
				$exists: true
			}
		}, {
			desktopNotifications: {
				$exists: true
			}
		}, {
			desktopNotificationDuration: {
				$exists: true
			}
		}, {
			mobilePushNotifications: {
				$exists: true
			}
		}, {
			disableNotifications: {
				$exists: true
			}
		}];
	}

	return this.find(query, {
		fields: {
			'u._id': 1,
			audioNotifications: 1,
			audioNotificationValue: 1,
			desktopNotificationDuration: 1,
			desktopNotifications: 1,
			mobilePushNotifications: 1,
			disableNotifications: 1
		}
	});
};

RocketChat.models.Subscriptions.findWithSendEmailByRoomId = function (roomId) {
	const query = {
		rid: roomId,
		emailNotifications: {
			$exists: true
		}
	};
	return this.find(query, {
		fields: {
			emailNotifications: 1,
			u: 1
		}
	});
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:push-notifications/server/methods/saveNotificationSettings.js");
require("./node_modules/meteor/rocketchat:push-notifications/server/models/Subscriptions.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:push-notifications'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_push-notifications.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpwdXNoLW5vdGlmaWNhdGlvbnMvc2VydmVyL21ldGhvZHMvc2F2ZU5vdGlmaWNhdGlvblNldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnB1c2gtbm90aWZpY2F0aW9ucy9zZXJ2ZXIvbW9kZWxzL1N1YnNjcmlwdGlvbnMuanMiXSwibmFtZXMiOlsiTWV0ZW9yIiwibWV0aG9kcyIsInNhdmVOb3RpZmljYXRpb25TZXR0aW5ncyIsInJpZCIsImZpZWxkIiwidmFsdWUiLCJ1c2VySWQiLCJFcnJvciIsIm1ldGhvZCIsImNoZWNrIiwiU3RyaW5nIiwiaW5kZXhPZiIsInN1YnNjcmlwdGlvbiIsIlJvY2tldENoYXQiLCJtb2RlbHMiLCJTdWJzY3JpcHRpb25zIiwiZmluZE9uZUJ5Um9vbUlkQW5kVXNlcklkIiwidXBkYXRlQXVkaW9Ob3RpZmljYXRpb25zQnlJZCIsIl9pZCIsInVwZGF0ZURlc2t0b3BOb3RpZmljYXRpb25zQnlJZCIsInVwZGF0ZU1vYmlsZVB1c2hOb3RpZmljYXRpb25zQnlJZCIsInVwZGF0ZUVtYWlsTm90aWZpY2F0aW9uc0J5SWQiLCJ1cGRhdGVVbnJlYWRBbGVydEJ5SWQiLCJ1cGRhdGVEaXNhYmxlTm90aWZpY2F0aW9uc0J5SWQiLCJ1cGRhdGVIaWRlVW5yZWFkU3RhdHVzQnlJZCIsInNhdmVBdWRpb05vdGlmaWNhdGlvblZhbHVlIiwidXBkYXRlQXVkaW9Ob3RpZmljYXRpb25WYWx1ZUJ5SWQiLCJzYXZlRGVza3RvcE5vdGlmaWNhdGlvbkR1cmF0aW9uIiwidXBkYXRlRGVza3RvcE5vdGlmaWNhdGlvbkR1cmF0aW9uQnlJZCIsImF1ZGlvTm90aWZpY2F0aW9ucyIsInF1ZXJ5IiwidXBkYXRlIiwiJHVuc2V0IiwiJHNldCIsImF1ZGlvTm90aWZpY2F0aW9uVmFsdWUiLCJkZXNrdG9wTm90aWZpY2F0aW9ucyIsImRlc2t0b3BOb3RpZmljYXRpb25EdXJhdGlvbiIsIm1vYmlsZVB1c2hOb3RpZmljYXRpb25zIiwiZW1haWxOb3RpZmljYXRpb25zIiwidW5yZWFkQWxlcnQiLCJkaXNhYmxlTm90aWZpY2F0aW9ucyIsImhpZGVVbnJlYWRTdGF0dXMiLCJmaW5kQWx3YXlzTm90aWZ5QXVkaW9Vc2Vyc0J5Um9vbUlkIiwicm9vbUlkIiwiZmluZCIsImZpbmRBbHdheXNOb3RpZnlEZXNrdG9wVXNlcnNCeVJvb21JZCIsImZpbmREb250Tm90aWZ5RGVza3RvcFVzZXJzQnlSb29tSWQiLCJmaW5kQWx3YXlzTm90aWZ5TW9iaWxlVXNlcnNCeVJvb21JZCIsImZpbmREb250Tm90aWZ5TW9iaWxlVXNlcnNCeVJvb21JZCIsImZpbmROb3RpZmljYXRpb25QcmVmZXJlbmNlc0J5Um9vbSIsImV4cGxpY2l0IiwiJGV4aXN0cyIsIiRvciIsImZpZWxkcyIsImZpbmRXaXRoU2VuZEVtYWlsQnlSb29tSWQiLCJ1Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE9BQVAsQ0FBZTtBQUNkQywwQkFBeUJDLEdBQXpCLEVBQThCQyxLQUE5QixFQUFxQ0MsS0FBckMsRUFBNEM7QUFDM0MsTUFBSSxDQUFDTCxPQUFPTSxNQUFQLEVBQUwsRUFBc0I7QUFDckIsU0FBTSxJQUFJTixPQUFPTyxLQUFYLENBQWlCLG9CQUFqQixFQUF1QyxjQUF2QyxFQUF1RDtBQUFFQyxZQUFRO0FBQVYsSUFBdkQsQ0FBTjtBQUNBOztBQUVEQyxRQUFNTixHQUFOLEVBQVdPLE1BQVg7QUFDQUQsUUFBTUwsS0FBTixFQUFhTSxNQUFiO0FBQ0FELFFBQU1KLEtBQU4sRUFBYUssTUFBYjs7QUFFQSxNQUFJLENBQUMsb0JBQUQsRUFBdUIsc0JBQXZCLEVBQStDLHlCQUEvQyxFQUEwRSxvQkFBMUUsRUFBZ0csYUFBaEcsRUFBK0csc0JBQS9HLEVBQXVJLGtCQUF2SSxFQUEySkMsT0FBM0osQ0FBbUtQLEtBQW5LLE1BQThLLENBQUMsQ0FBbkwsRUFBc0w7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Z2VzL3JvY2tldGNoYXRfcHVzaC1ub3RpZmljYXRpb25zLmpzIiwic291cmNlc0NvbnRlbnQiOlsiTWV0ZW9yLm1ldGhvZHMoe1xuXHRzYXZlTm90aWZpY2F0aW9uU2V0dGluZ3MocmlkLCBmaWVsZCwgdmFsdWUpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnc2F2ZU5vdGlmaWNhdGlvblNldHRpbmdzJyB9KTtcblx0XHR9XG5cblx0XHRjaGVjayhyaWQsIFN0cmluZyk7XG5cdFx0Y2hlY2soZmllbGQsIFN0cmluZyk7XG5cdFx0Y2hlY2sodmFsdWUsIFN0cmluZyk7XG5cblx0XHRpZiAoWydhdWRpb05vdGlmaWNhdGlvbnMnLCAnZGVza3RvcE5vdGlmaWNhdGlvbnMnLCAnbW9iaWxlUHVzaE5vdGlmaWNhdGlvbnMnLCAnZW1haWxOb3RpZmljYXRpb25zJywgJ3VucmVhZEFsZXJ0JywgJ2Rpc2FibGVOb3RpZmljYXRpb25zJywgJ2hpZGVVbnJlYWRTdGF0dXMnXS5pbmRleE9mKGZpZWxkKSA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtc2V0dGluZ3MnLCAnSW52YWxpZCBzZXR0aW5ncyBmaWVsZCcsIHsgbWV0aG9kOiAnc2F2ZU5vdGlmaWNhdGlvblNldHRpbmdzJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoZmllbGQgIT09ICdoaWRlVW5yZWFkU3RhdHVzJyAmJiBmaWVsZCAhPT0gJ2Rpc2FibGVOb3RpZmljYXRpb25zJyAmJiBbJ2FsbCcsICdtZW50aW9ucycsICdub3RoaW5nJywgJ2RlZmF1bHQnXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtc2V0dGluZ3MnLCAnSW52YWxpZCBzZXR0aW5ncyB2YWx1ZScsIHsgbWV0aG9kOiAnc2F2ZU5vdGlmaWNhdGlvblNldHRpbmdzJyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRPbmVCeVJvb21JZEFuZFVzZXJJZChyaWQsIE1ldGVvci51c2VySWQoKSk7XG5cdFx0aWYgKCFzdWJzY3JpcHRpb24pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtc3Vic2NyaXB0aW9uJywgJ0ludmFsaWQgc3Vic2NyaXB0aW9uJywgeyBtZXRob2Q6ICdzYXZlTm90aWZpY2F0aW9uU2V0dGluZ3MnIH0pO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAoZmllbGQpIHtcblx0XHRcdGNhc2UgJ2F1ZGlvTm90aWZpY2F0aW9ucyc6XG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBkYXRlQXVkaW9Ob3RpZmljYXRpb25zQnlJZChzdWJzY3JpcHRpb24uX2lkLCB2YWx1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZGVza3RvcE5vdGlmaWNhdGlvbnMnOlxuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZURlc2t0b3BOb3RpZmljYXRpb25zQnlJZChzdWJzY3JpcHRpb24uX2lkLCB2YWx1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbW9iaWxlUHVzaE5vdGlmaWNhdGlvbnMnOlxuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZU1vYmlsZVB1c2hOb3RpZmljYXRpb25zQnlJZChzdWJzY3JpcHRpb24uX2lkLCB2YWx1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZW1haWxOb3RpZmljYXRpb25zJzpcblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy51cGRhdGVFbWFpbE5vdGlmaWNhdGlvbnNCeUlkKHN1YnNjcmlwdGlvbi5faWQsIHZhbHVlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd1bnJlYWRBbGVydCc6XG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBkYXRlVW5yZWFkQWxlcnRCeUlkKHN1YnNjcmlwdGlvbi5faWQsIHZhbHVlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdkaXNhYmxlTm90aWZpY2F0aW9ucyc6XG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBkYXRlRGlzYWJsZU5vdGlmaWNhdGlvbnNCeUlkKHN1YnNjcmlwdGlvbi5faWQsIHZhbHVlID09PSAnMScgPyB0cnVlIDogZmFsc2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2hpZGVVbnJlYWRTdGF0dXMnOlxuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZUhpZGVVbnJlYWRTdGF0dXNCeUlkKHN1YnNjcmlwdGlvbi5faWQsIHZhbHVlID09PSAnMScgPyB0cnVlIDogZmFsc2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSxcblxuXHRzYXZlQXVkaW9Ob3RpZmljYXRpb25WYWx1ZShyaWQsIHZhbHVlKSB7XG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kT25lQnlSb29tSWRBbmRVc2VySWQocmlkLCBNZXRlb3IudXNlcklkKCkpO1xuXHRcdGlmICghc3Vic2NyaXB0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXN1YnNjcmlwdGlvbicsICdJbnZhbGlkIHN1YnNjcmlwdGlvbicsIHsgbWV0aG9kOiAnc2F2ZUF1ZGlvTm90aWZpY2F0aW9uVmFsdWUnIH0pO1xuXHRcdH1cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZUF1ZGlvTm90aWZpY2F0aW9uVmFsdWVCeUlkKHN1YnNjcmlwdGlvbi5faWQsIHZhbHVlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSxcblxuXHRzYXZlRGVza3RvcE5vdGlmaWNhdGlvbkR1cmF0aW9uKHJpZCwgdmFsdWUpIHtcblx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRPbmVCeVJvb21JZEFuZFVzZXJJZChyaWQsIE1ldGVvci51c2VySWQoKSk7XG5cdFx0aWYgKCFzdWJzY3JpcHRpb24pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtc3Vic2NyaXB0aW9uJywgJ0ludmFsaWQgc3Vic2NyaXB0aW9uJywgeyBtZXRob2Q6ICdzYXZlRGVza3RvcE5vdGlmaWNhdGlvbkR1cmF0aW9uJyB9KTtcblx0XHR9XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy51cGRhdGVEZXNrdG9wTm90aWZpY2F0aW9uRHVyYXRpb25CeUlkKHN1YnNjcmlwdGlvbi5faWQsIHZhbHVlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZUF1ZGlvTm90aWZpY2F0aW9uc0J5SWQgPSBmdW5jdGlvbihfaWQsIGF1ZGlvTm90aWZpY2F0aW9ucykge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7fTtcblxuXHRpZiAoYXVkaW9Ob3RpZmljYXRpb25zID09PSAnZGVmYXVsdCcpIHtcblx0XHR1cGRhdGUuJHVuc2V0ID0geyBhdWRpb05vdGlmaWNhdGlvbnM6IDEgfTtcblx0fSBlbHNlIHtcblx0XHR1cGRhdGUuJHNldCA9IHsgYXVkaW9Ob3RpZmljYXRpb25zIH07XG5cdH1cblxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZUF1ZGlvTm90aWZpY2F0aW9uVmFsdWVCeUlkID0gZnVuY3Rpb24oX2lkLCBhdWRpb05vdGlmaWNhdGlvblZhbHVlKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdF9pZFxuXHR9O1xuXG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHRhdWRpb05vdGlmaWNhdGlvblZhbHVlXG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiB0aGlzLnVwZGF0ZShxdWVyeSwgdXBkYXRlKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBkYXRlRGVza3RvcE5vdGlmaWNhdGlvbnNCeUlkID0gZnVuY3Rpb24oX2lkLCBkZXNrdG9wTm90aWZpY2F0aW9ucykge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7fTtcblxuXHRpZiAoZGVza3RvcE5vdGlmaWNhdGlvbnMgPT09ICdkZWZhdWx0Jykge1xuXHRcdHVwZGF0ZS4kdW5zZXQgPSB7IGRlc2t0b3BOb3RpZmljYXRpb25zOiAxIH07XG5cdH0gZWxzZSB7XG5cdFx0dXBkYXRlLiRzZXQgPSB7IGRlc2t0b3BOb3RpZmljYXRpb25zIH07XG5cdH1cblxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZURlc2t0b3BOb3RpZmljYXRpb25EdXJhdGlvbkJ5SWQgPSBmdW5jdGlvbihfaWQsIHZhbHVlKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdF9pZFxuXHR9O1xuXG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHRkZXNrdG9wTm90aWZpY2F0aW9uRHVyYXRpb246IHZhbHVlIC0gMFxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZU1vYmlsZVB1c2hOb3RpZmljYXRpb25zQnlJZCA9IGZ1bmN0aW9uKF9pZCwgbW9iaWxlUHVzaE5vdGlmaWNhdGlvbnMpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkXG5cdH07XG5cblx0Y29uc3QgdXBkYXRlID0ge307XG5cblx0aWYgKG1vYmlsZVB1c2hOb3RpZmljYXRpb25zID09PSAnZGVmYXVsdCcpIHtcblx0XHR1cGRhdGUuJHVuc2V0ID0geyBtb2JpbGVQdXNoTm90aWZpY2F0aW9uczogMSB9O1xuXHR9IGVsc2Uge1xuXHRcdHVwZGF0ZS4kc2V0ID0geyBtb2JpbGVQdXNoTm90aWZpY2F0aW9ucyB9O1xuXHR9XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy51cGRhdGVFbWFpbE5vdGlmaWNhdGlvbnNCeUlkID0gZnVuY3Rpb24oX2lkLCBlbWFpbE5vdGlmaWNhdGlvbnMpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkXG5cdH07XG5cblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRzZXQ6IHtcblx0XHRcdGVtYWlsTm90aWZpY2F0aW9uc1xuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZVVucmVhZEFsZXJ0QnlJZCA9IGZ1bmN0aW9uKF9pZCwgdW5yZWFkQWxlcnQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkXG5cdH07XG5cblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRzZXQ6IHtcblx0XHRcdHVucmVhZEFsZXJ0XG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiB0aGlzLnVwZGF0ZShxdWVyeSwgdXBkYXRlKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBkYXRlRGlzYWJsZU5vdGlmaWNhdGlvbnNCeUlkID0gZnVuY3Rpb24oX2lkLCBkaXNhYmxlTm90aWZpY2F0aW9ucykge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0ZGlzYWJsZU5vdGlmaWNhdGlvbnNcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy51cGRhdGVIaWRlVW5yZWFkU3RhdHVzQnlJZCA9IGZ1bmN0aW9uKF9pZCwgaGlkZVVucmVhZFN0YXR1cykge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0aGlkZVVucmVhZFN0YXR1c1xuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRBbHdheXNOb3RpZnlBdWRpb1VzZXJzQnlSb29tSWQgPSBmdW5jdGlvbihyb29tSWQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0cmlkOiByb29tSWQsXG5cdFx0YXVkaW9Ob3RpZmljYXRpb25zOiAnYWxsJ1xuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnkpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kQWx3YXlzTm90aWZ5RGVza3RvcFVzZXJzQnlSb29tSWQgPSBmdW5jdGlvbihyb29tSWQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0cmlkOiByb29tSWQsXG5cdFx0ZGVza3RvcE5vdGlmaWNhdGlvbnM6ICdhbGwnXG5cdH07XG5cblx0cmV0dXJuIHRoaXMuZmluZChxdWVyeSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmREb250Tm90aWZ5RGVza3RvcFVzZXJzQnlSb29tSWQgPSBmdW5jdGlvbihyb29tSWQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0cmlkOiByb29tSWQsXG5cdFx0ZGVza3RvcE5vdGlmaWNhdGlvbnM6ICdub3RoaW5nJ1xuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnkpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kQWx3YXlzTm90aWZ5TW9iaWxlVXNlcnNCeVJvb21JZCA9IGZ1bmN0aW9uKHJvb21JZCkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRyaWQ6IHJvb21JZCxcblx0XHRtb2JpbGVQdXNoTm90aWZpY2F0aW9uczogJ2FsbCdcblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZERvbnROb3RpZnlNb2JpbGVVc2Vyc0J5Um9vbUlkID0gZnVuY3Rpb24ocm9vbUlkKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdHJpZDogcm9vbUlkLFxuXHRcdG1vYmlsZVB1c2hOb3RpZmljYXRpb25zOiAnbm90aGluZydcblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuZmluZE5vdGlmaWNhdGlvblByZWZlcmVuY2VzQnlSb29tID0gZnVuY3Rpb24ocm9vbUlkLCBleHBsaWNpdCkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRyaWQ6IHJvb21JZCxcblx0XHQndS5faWQnOiB7JGV4aXN0czogdHJ1ZX1cblx0fTtcblxuXHRpZiAoZXhwbGljaXQpIHtcblx0XHRxdWVyeS4kb3IgPSBbXG5cdFx0XHR7YXVkaW9Ob3RpZmljYXRpb25zOiB7JGV4aXN0czogdHJ1ZX19LFxuXHRcdFx0e2F1ZGlvTm90aWZpY2F0aW9uVmFsdWU6IHskZXhpc3RzOiB0cnVlfX0sXG5cdFx0XHR7ZGVza3RvcE5vdGlmaWNhdGlvbnM6IHskZXhpc3RzOiB0cnVlfX0sXG5cdFx0XHR7ZGVza3RvcE5vdGlmaWNhdGlvbkR1cmF0aW9uOiB7JGV4aXN0czogdHJ1ZX19LFxuXHRcdFx0e21vYmlsZVB1c2hOb3RpZmljYXRpb25zOiB7JGV4aXN0czogdHJ1ZX19LFxuXHRcdFx0e2Rpc2FibGVOb3RpZmljYXRpb25zOiB7JGV4aXN0czogdHJ1ZX19XG5cdFx0XTtcblx0fVxuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnksIHsgZmllbGRzOiB7ICd1Ll9pZCc6IDEsIGF1ZGlvTm90aWZpY2F0aW9uczogMSwgYXVkaW9Ob3RpZmljYXRpb25WYWx1ZTogMSwgZGVza3RvcE5vdGlmaWNhdGlvbkR1cmF0aW9uOiAxLCBkZXNrdG9wTm90aWZpY2F0aW9uczogMSwgbW9iaWxlUHVzaE5vdGlmaWNhdGlvbnM6IDEsIGRpc2FibGVOb3RpZmljYXRpb25zOiAxIH0gfSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRXaXRoU2VuZEVtYWlsQnlSb29tSWQgPSBmdW5jdGlvbihyb29tSWQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0cmlkOiByb29tSWQsXG5cdFx0ZW1haWxOb3RpZmljYXRpb25zOiB7XG5cdFx0XHQkZXhpc3RzOiB0cnVlXG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnksIHsgZmllbGRzOiB7IGVtYWlsTm90aWZpY2F0aW9uczogMSwgdTogMSB9IH0pO1xufTtcbiJdfQ==
