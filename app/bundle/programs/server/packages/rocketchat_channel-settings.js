(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var name;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:channel-settings":{"server":{"functions":{"saveReactWhenReadOnly.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveReactWhenReadOnly.js                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.saveReactWhenReadOnly = function (rid, allowReact) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			function: 'RocketChat.saveReactWhenReadOnly'
		});
	}

	return RocketChat.models.Rooms.setAllowReactingWhenReadOnlyById(rid, allowReact);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomType.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomType.js                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.saveRoomType = function (rid, roomType, user, sendMessage = true) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomType'
		});
	}

	if (roomType !== 'c' && roomType !== 'p') {
		throw new Meteor.Error('error-invalid-room-type', 'error-invalid-room-type', {
			'function': 'RocketChat.saveRoomType',
			type: roomType
		});
	}

	const room = RocketChat.models.Rooms.findOneById(rid);

	if (room == null) {
		throw new Meteor.Error('error-invalid-room', 'error-invalid-room', {
			'function': 'RocketChat.saveRoomType',
			_id: rid
		});
	}

	if (room.t === 'd') {
		throw new Meteor.Error('error-direct-room', 'Can\'t change type of direct rooms', {
			'function': 'RocketChat.saveRoomType'
		});
	}

	const result = RocketChat.models.Rooms.setTypeById(rid, roomType) && RocketChat.models.Subscriptions.updateTypeByRoomId(rid, roomType);

	if (result && sendMessage) {
		let message;

		if (roomType === 'c') {
			message = TAPi18n.__('Channel', {
				lng: user && user.language || RocketChat.settings.get('language') || 'en'
			});
		} else {
			message = TAPi18n.__('Private_Group', {
				lng: user && user.language || RocketChat.settings.get('language') || 'en'
			});
		}

		RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_privacy', rid, message, user);
	}

	return result;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomTopic.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomTopic.js                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);

RocketChat.saveRoomTopic = function (rid, roomTopic, user, sendMessage = true) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomTopic'
		});
	}

	roomTopic = s.escapeHTML(roomTopic);
	const update = RocketChat.models.Rooms.setTopicById(rid, roomTopic);

	if (update && sendMessage) {
		RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_topic', rid, roomTopic, user);
	}

	return update;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomAnnouncement.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomAnnouncement.js                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);

RocketChat.saveRoomAnnouncement = function (rid, roomAnnouncement, user, sendMessage = true) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			function: 'RocketChat.saveRoomAnnouncement'
		});
	}

	roomAnnouncement = s.escapeHTML(roomAnnouncement);
	const updated = RocketChat.models.Rooms.setAnnouncementById(rid, roomAnnouncement);

	if (updated && sendMessage) {
		RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_announcement', rid, roomAnnouncement, user);
	}

	return updated;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomName.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomName.js                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.saveRoomName = function (rid, displayName, user, sendMessage = true) {
	const room = RocketChat.models.Rooms.findOneById(rid);

	if (RocketChat.roomTypes.roomTypes[room.t].preventRenaming()) {
		throw new Meteor.Error('error-not-allowed', 'Not allowed', {
			'function': 'RocketChat.saveRoomdisplayName'
		});
	}

	if (displayName === room.name) {
		return;
	}

	const slugifiedRoomName = RocketChat.getValidRoomName(displayName, rid);
	const update = RocketChat.models.Rooms.setNameById(rid, slugifiedRoomName, displayName) && RocketChat.models.Subscriptions.updateNameAndAlertByRoomId(rid, slugifiedRoomName, displayName);

	if (update && sendMessage) {
		RocketChat.models.Messages.createRoomRenamedWithRoomIdRoomNameAndUser(rid, displayName, user);
	}

	return displayName;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomReadOnly.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomReadOnly.js                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.saveRoomReadOnly = function (rid, readOnly) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomReadOnly'
		});
	}

	return RocketChat.models.Rooms.setReadOnlyById(rid, readOnly);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomDescription.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomDescription.js                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);

RocketChat.saveRoomDescription = function (rid, roomDescription, user) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomDescription'
		});
	}

	const escapedRoomDescription = s.escapeHTML(roomDescription);
	const update = RocketChat.models.Rooms.setDescriptionById(rid, escapedRoomDescription);
	RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_description', rid, escapedRoomDescription, user);
	return update;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveRoomSystemMessages.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/functions/saveRoomSystemMessages.js                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.saveRoomSystemMessages = function (rid, systemMessages) {
	if (!Match.test(rid, String)) {
		throw new Meteor.Error('invalid-room', 'Invalid room', {
			'function': 'RocketChat.saveRoomSystemMessages'
		});
	}

	return RocketChat.models.Rooms.setSystemMessagesById(rid, systemMessages);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"saveRoomSettings.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/methods/saveRoomSettings.js                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	saveRoomSettings(rid, setting, value) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				'function': 'RocketChat.saveRoomName'
			});
		}

		if (!Match.test(rid, String)) {
			throw new Meteor.Error('error-invalid-room', 'Invalid room', {
				method: 'saveRoomSettings'
			});
		}

		if (!['roomName', 'roomTopic', 'roomAnnouncement', 'roomDescription', 'roomType', 'readOnly', 'reactWhenReadOnly', 'systemMessages', 'default', 'joinCode', 'tokenpass'].some(s => s === setting)) {
			throw new Meteor.Error('error-invalid-settings', 'Invalid settings provided', {
				method: 'saveRoomSettings'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'edit-room', rid)) {
			throw new Meteor.Error('error-action-not-allowed', 'Editing room is not allowed', {
				method: 'saveRoomSettings',
				action: 'Editing_room'
			});
		}

		if (setting === 'default' && !RocketChat.authz.hasPermission(this.userId, 'view-room-administration')) {
			throw new Meteor.Error('error-action-not-allowed', 'Viewing room administration is not allowed', {
				method: 'saveRoomSettings',
				action: 'Viewing_room_administration'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(rid);

		if (room != null) {
			if (setting === 'roomType' && value !== room.t && value === 'c' && !RocketChat.authz.hasPermission(this.userId, 'create-c')) {
				throw new Meteor.Error('error-action-not-allowed', 'Changing a private group to a public channel is not allowed', {
					method: 'saveRoomSettings',
					action: 'Change_Room_Type'
				});
			}

			if (setting === 'roomType' && value !== room.t && value === 'p' && !RocketChat.authz.hasPermission(this.userId, 'create-p')) {
				throw new Meteor.Error('error-action-not-allowed', 'Changing a public channel to a private room is not allowed', {
					method: 'saveRoomSettings',
					action: 'Change_Room_Type'
				});
			}

			switch (setting) {
				case 'roomName':
					name = RocketChat.saveRoomName(rid, value, Meteor.user());
					break;

				case 'roomTopic':
					if (value !== room.topic) {
						RocketChat.saveRoomTopic(rid, value, Meteor.user());
					}

					break;

				case 'roomAnnouncement':
					if (value !== room.announcement) {
						RocketChat.saveRoomAnnouncement(rid, value, Meteor.user());
					}

					break;

				case 'roomDescription':
					if (value !== room.description) {
						RocketChat.saveRoomDescription(rid, value, Meteor.user());
					}

					break;

				case 'roomType':
					if (value !== room.t) {
						RocketChat.saveRoomType(rid, value, Meteor.user());
					}

					break;

				case 'tokenpass':
					check(value, {
						require: String,
						tokens: [{
							token: String,
							balance: String
						}]
					});
					RocketChat.saveRoomTokenpass(rid, value);
					break;

				case 'readOnly':
					if (value !== room.ro) {
						RocketChat.saveRoomReadOnly(rid, value, Meteor.user());
					}

					break;

				case 'reactWhenReadOnly':
					if (value !== room.reactWhenReadOnly) {
						RocketChat.saveReactWhenReadOnly(rid, value, Meteor.user());
					}

					break;

				case 'systemMessages':
					if (value !== room.sysMes) {
						RocketChat.saveRoomSystemMessages(rid, value, Meteor.user());
					}

					break;

				case 'joinCode':
					RocketChat.models.Rooms.setJoinCodeById(rid, String(value));
					break;

				case 'default':
					RocketChat.models.Rooms.saveDefaultById(rid, value);
			}
		}

		return {
			result: true,
			rid: room._id
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"Messages.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/models/Messages.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser = function (type, roomId, message, user, extraData) {
	return this.createWithTypeRoomIdMessageAndUser(type, roomId, message, user, extraData);
};

RocketChat.models.Messages.createRoomRenamedWithRoomIdRoomNameAndUser = function (roomId, roomName, user, extraData) {
	return this.createWithTypeRoomIdMessageAndUser('r', roomId, roomName, user, extraData);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Rooms.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/models/Rooms.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.models.Rooms.setDescriptionById = function (_id, description) {
	const query = {
		_id
	};
	const update = {
		$set: {
			description
		}
	};
	return this.update(query, update);
};

RocketChat.models.Rooms.setReadOnlyById = function (_id, readOnly) {
	const query = {
		_id
	};
	const update = {
		$set: {
			ro: readOnly
		}
	};

	if (readOnly) {
		RocketChat.models.Subscriptions.findByRoomId(_id).forEach(function (subscription) {
			if (subscription._user == null) {
				return;
			}

			const user = subscription._user;

			if (RocketChat.authz.hasPermission(user._id, 'post-readonly') === false) {
				if (!update.$set.muted) {
					update.$set.muted = [];
				}

				return update.$set.muted.push(user.username);
			}
		});
	} else {
		update.$unset = {
			muted: ''
		};
	}

	return this.update(query, update);
};

RocketChat.models.Rooms.setAllowReactingWhenReadOnlyById = function (_id, allowReacting) {
	const query = {
		_id
	};
	const update = {
		$set: {
			reactWhenReadOnly: allowReacting
		}
	};
	return this.update(query, update);
};

RocketChat.models.Rooms.setSystemMessagesById = function (_id, systemMessages) {
	const query = {
		_id
	};
	const update = {
		$set: {
			sysMes: systemMessages
		}
	};
	return this.update(query, update);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_channel-settings/server/startup.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.startup(function () {
	RocketChat.models.Permissions.upsert('post-readonly', {
		$setOnInsert: {
			roles: ['admin', 'owner', 'moderator']
		}
	});
	RocketChat.models.Permissions.upsert('set-readonly', {
		$setOnInsert: {
			roles: ['admin', 'owner']
		}
	});
	RocketChat.models.Permissions.upsert('set-react-when-readonly', {
		$setOnInsert: {
			roles: ['admin', 'owner']
		}
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveReactWhenReadOnly.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomType.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomTopic.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomAnnouncement.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomName.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomReadOnly.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomDescription.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/functions/saveRoomSystemMessages.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/methods/saveRoomSettings.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/models/Messages.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/models/Rooms.js");
require("./node_modules/meteor/rocketchat:channel-settings/server/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:channel-settings'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_channel-settings.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjaGFubmVsLXNldHRpbmdzL3NlcnZlci9mdW5jdGlvbnMvc2F2ZVJlYWN0V2hlblJlYWRPbmx5LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmNoYW5uZWwtc2V0dGluZ3Mvc2VydmVyL2Z1bmN0aW9ucy9zYXZlUm9vbVR5cGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvZnVuY3Rpb25zL3NhdmVSb29tVG9waWMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvZnVuY3Rpb25zL3NhdmVSb29tQW5ub3VuY2VtZW50LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmNoYW5uZWwtc2V0dGluZ3Mvc2VydmVyL2Z1bmN0aW9ucy9zYXZlUm9vbU5hbWUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvZnVuY3Rpb25zL3NhdmVSb29tUmVhZE9ubHkuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvZnVuY3Rpb25zL3NhdmVSb29tRGVzY3JpcHRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvZnVuY3Rpb25zL3NhdmVSb29tU3lzdGVtTWVzc2FnZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvbWV0aG9kcy9zYXZlUm9vbVNldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmNoYW5uZWwtc2V0dGluZ3Mvc2VydmVyL21vZGVscy9NZXNzYWdlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjaGFubmVsLXNldHRpbmdzL3NlcnZlci9tb2RlbHMvUm9vbXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y2hhbm5lbC1zZXR0aW5ncy9zZXJ2ZXIvc3RhcnR1cC5qcyJdLCJuYW1lcyI6WyJSb2NrZXRDaGF0Iiwic2F2ZVJlYWN0V2hlblJlYWRPbmx5IiwicmlkIiwiYWxsb3dSZWFjdCIsIk1hdGNoIiwidGVzdCIsIlN0cmluZyIsIk1ldGVvciIsIkVycm9yIiwiZnVuY3Rpb24iLCJtb2RlbHMiLCJSb29tcyIsInNldEFsbG93UmVhY3RpbmdXaGVuUmVhZE9ubHlCeUlkIiwic2F2ZVJvb21UeXBlIiwicm9vbVR5cGUiLCJ1c2VyIiwic2VuZE1lc3NhZ2UiLCJ0eXBlIiwicm9vbSIsImZpbmRPbmVCeUlkIiwiX2lkIiwidCIsInJlc3VsdCIsInNldFR5cGVCeUlkIiwiU3Vic2NyaXB0aW9ucyIsInVwZGF0ZVR5cGVCeVJvb21JZCIsIm1lc3NhZ2UiLCJUQVBpMThuIiwiX18iLCJsbmciLCJsYW5ndWFnZSIsInNldHRpbmdzIiwiZ2V0IiwiTWVzc2FnZXMiLCJjcmVhdGVSb29tU2V0dGluZ3NDaGFuZ2VkV2l0aFR5cGVSb29tSWRNZXNzYWdlQW5kVXNlciIsInMiLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsInNhdmVSb29tVG9waWMiLCJyb29tVG9waWMiLCJlc2NhcGVIVE1MIiwidXBkYXRlIiwic2V0VG9waWNCeUlkIiwic2F2ZVJvb21Bbm5vdW5jZW1lbnQiLCJyb29tQW5ub3VuY2VtZW50IiwidXBkYXRlZCIsInNldEFubm91bmNlbWVudEJ5SWQiLCJzYXZlUm9vbU5hbWUiLCJkaXNwbGF5TmFtZSIsInJvb21UeXBlcyIsInByZXZlbnRSZW5hbWluZyIsIm5hbWUiLCJzbHVnaWZpZWRSb29tTmFtZSIsImdldFZhbGlkUm9vbU5hbWUiLCJzZXROYW1lQnlJZCIsInVwZGF0ZU5hbWVBbmRBbGVydEJ5Um9vbUlkIiwiY3JlYXRlUm9vbVJlbmFtZWRXaXRoUm9vbUlkUm9vbU5hbWVBbmRVc2VyIiwic2F2ZVJvb21SZWFkT25seSIsInJlYWRPbmx5Iiwic2V0UmVhZE9ubHlCeUlkIiwic2F2ZVJvb21EZXNjcmlwdGlvbiIsInJvb21EZXNjcmlwdGlvbiIsImVzY2FwZWRSb29tRGVzY3JpcHRpb24iLCJzZXREZXNjcmlwdGlvbkJ5SWQiLCJzYXZlUm9vbVN5c3RlbU1lc3NhZ2VzIiwic3lzdGVtTWVzc2FnZXMiLCJzZXRTeXN0ZW1NZXNzYWdlc0J5SWQiLCJtZXRob2RzIiwic2F2ZVJvb21TZXR0aW5ncyIsInNldHRpbmciLCJ2YWx1ZSIsInVzZXJJZCIsIm1ldGhvZCIsInNvbWUiLCJhdXRoeiIsImhhc1Blcm1pc3Npb24iLCJhY3Rpb24iLCJ0b3BpYyIsImFubm91bmNlbWVudCIsImRlc2NyaXB0aW9uIiwiY2hlY2siLCJ0b2tlbnMiLCJ0b2tlbiIsImJhbGFuY2UiLCJzYXZlUm9vbVRva2VucGFzcyIsInJvIiwicmVhY3RXaGVuUmVhZE9ubHkiLCJzeXNNZXMiLCJzZXRKb2luQ29kZUJ5SWQiLCJzYXZlRGVmYXVsdEJ5SWQiLCJyb29tSWQiLCJleHRyYURhdGEiLCJjcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyIiwicm9vbU5hbWUiLCJxdWVyeSIsIiRzZXQiLCJmaW5kQnlSb29tSWQiLCJmb3JFYWNoIiwic3Vic2NyaXB0aW9uIiwiX3VzZXIiLCJtdXRlZCIsInB1c2giLCJ1c2VybmFtZSIsIiR1bnNldCIsImFsbG93UmVhY3RpbmciLCJzdGFydHVwIiwiUGVybWlzc2lvbnMiLCJ1cHNlcnQiLCIkc2V0T25JbnNlcnQiLCJyb2xlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxXQUFXQyxxQkFBWCxHQUFtQyxVQUFTQyxHQUFU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QUVDLFVBQU8sQ0FBQyxPQUFELEVBQVUsT0FBVjtBQUFUO0FBQWYsRUFBaEU7QUFDQSxDQUpELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfY2hhbm5lbC1zZXR0aW5ncy5qcyIsInNvdXJjZXNDb250ZW50IjpbIlJvY2tldENoYXQuc2F2ZVJlYWN0V2hlblJlYWRPbmx5ID0gZnVuY3Rpb24ocmlkLCBhbGxvd1JlYWN0KSB7XG5cdGlmICghTWF0Y2gudGVzdChyaWQsIFN0cmluZykpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJywgeyBmdW5jdGlvbjogJ1JvY2tldENoYXQuc2F2ZVJlYWN0V2hlblJlYWRPbmx5JyB9KTtcblx0fVxuXG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRBbGxvd1JlYWN0aW5nV2hlblJlYWRPbmx5QnlJZChyaWQsIGFsbG93UmVhY3QpO1xufTtcbiIsIlxuUm9ja2V0Q2hhdC5zYXZlUm9vbVR5cGUgPSBmdW5jdGlvbihyaWQsIHJvb21UeXBlLCB1c2VyLCBzZW5kTWVzc2FnZSA9IHRydWUpIHtcblx0aWYgKCFNYXRjaC50ZXN0KHJpZCwgU3RyaW5nKSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnUm9ja2V0Q2hhdC5zYXZlUm9vbVR5cGUnXG5cdFx0fSk7XG5cdH1cblx0aWYgKHJvb21UeXBlICE9PSAnYycgJiYgcm9vbVR5cGUgIT09ICdwJykge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcm9vbS10eXBlJywgJ2Vycm9yLWludmFsaWQtcm9vbS10eXBlJywge1xuXHRcdFx0J2Z1bmN0aW9uJzogJ1JvY2tldENoYXQuc2F2ZVJvb21UeXBlJyxcblx0XHRcdHR5cGU6IHJvb21UeXBlXG5cdFx0fSk7XG5cdH1cblx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJpZCk7XG5cdGlmIChyb29tID09IG51bGwpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJvb20nLCAnZXJyb3ItaW52YWxpZC1yb29tJywge1xuXHRcdFx0J2Z1bmN0aW9uJzogJ1JvY2tldENoYXQuc2F2ZVJvb21UeXBlJyxcblx0XHRcdF9pZDogcmlkXG5cdFx0fSk7XG5cdH1cblx0aWYgKHJvb20udCA9PT0gJ2QnKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItZGlyZWN0LXJvb20nLCAnQ2FuXFwndCBjaGFuZ2UgdHlwZSBvZiBkaXJlY3Qgcm9vbXMnLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnUm9ja2V0Q2hhdC5zYXZlUm9vbVR5cGUnXG5cdFx0fSk7XG5cdH1cblx0Y29uc3QgcmVzdWx0ID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0VHlwZUJ5SWQocmlkLCByb29tVHlwZSkgJiYgUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy51cGRhdGVUeXBlQnlSb29tSWQocmlkLCByb29tVHlwZSk7XG5cdGlmIChyZXN1bHQgJiYgc2VuZE1lc3NhZ2UpIHtcblx0XHRsZXQgbWVzc2FnZTtcblx0XHRpZiAocm9vbVR5cGUgPT09ICdjJykge1xuXHRcdFx0bWVzc2FnZSA9IFRBUGkxOG4uX18oJ0NoYW5uZWwnLCB7XG5cdFx0XHRcdGxuZzogdXNlciAmJiB1c2VyLmxhbmd1YWdlIHx8IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdsYW5ndWFnZScpIHx8ICdlbidcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlID0gVEFQaTE4bi5fXygnUHJpdmF0ZV9Hcm91cCcsIHtcblx0XHRcdFx0bG5nOiB1c2VyICYmIHVzZXIubGFuZ3VhZ2UgfHwgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ2xhbmd1YWdlJykgfHwgJ2VuJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVJvb21TZXR0aW5nc0NoYW5nZWRXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyKCdyb29tX2NoYW5nZWRfcHJpdmFjeScsIHJpZCwgbWVzc2FnZSwgdXNlcik7XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn07XG4iLCJpbXBvcnQgcyBmcm9tICd1bmRlcnNjb3JlLnN0cmluZyc7XG5cblJvY2tldENoYXQuc2F2ZVJvb21Ub3BpYyA9IGZ1bmN0aW9uKHJpZCwgcm9vbVRvcGljLCB1c2VyLCBzZW5kTWVzc2FnZSA9IHRydWUpIHtcblx0aWYgKCFNYXRjaC50ZXN0KHJpZCwgU3RyaW5nKSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnUm9ja2V0Q2hhdC5zYXZlUm9vbVRvcGljJ1xuXHRcdH0pO1xuXHR9XG5cdHJvb21Ub3BpYyA9IHMuZXNjYXBlSFRNTChyb29tVG9waWMpO1xuXHRjb25zdCB1cGRhdGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRUb3BpY0J5SWQocmlkLCByb29tVG9waWMpO1xuXHRpZiAodXBkYXRlICYmIHNlbmRNZXNzYWdlKSB7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlUm9vbVNldHRpbmdzQ2hhbmdlZFdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ3Jvb21fY2hhbmdlZF90b3BpYycsIHJpZCwgcm9vbVRvcGljLCB1c2VyKTtcblx0fVxuXHRyZXR1cm4gdXBkYXRlO1xufTtcbiIsImltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcblxuUm9ja2V0Q2hhdC5zYXZlUm9vbUFubm91bmNlbWVudCA9IGZ1bmN0aW9uKHJpZCwgcm9vbUFubm91bmNlbWVudCwgdXNlciwgc2VuZE1lc3NhZ2U9dHJ1ZSkge1xuXHRpZiAoIU1hdGNoLnRlc3QocmlkLCBTdHJpbmcpKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1yb29tJywgJ0ludmFsaWQgcm9vbScsIHsgZnVuY3Rpb246ICdSb2NrZXRDaGF0LnNhdmVSb29tQW5ub3VuY2VtZW50JyB9KTtcblx0fVxuXG5cdHJvb21Bbm5vdW5jZW1lbnQgPSBzLmVzY2FwZUhUTUwocm9vbUFubm91bmNlbWVudCk7XG5cdGNvbnN0IHVwZGF0ZWQgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRBbm5vdW5jZW1lbnRCeUlkKHJpZCwgcm9vbUFubm91bmNlbWVudCk7XG5cdGlmICh1cGRhdGVkICYmIHNlbmRNZXNzYWdlKSB7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlUm9vbVNldHRpbmdzQ2hhbmdlZFdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ3Jvb21fY2hhbmdlZF9hbm5vdW5jZW1lbnQnLCByaWQsIHJvb21Bbm5vdW5jZW1lbnQsIHVzZXIpO1xuXHR9XG5cblx0cmV0dXJuIHVwZGF0ZWQ7XG59O1xuIiwiXG5Sb2NrZXRDaGF0LnNhdmVSb29tTmFtZSA9IGZ1bmN0aW9uKHJpZCwgZGlzcGxheU5hbWUsIHVzZXIsIHNlbmRNZXNzYWdlID0gdHJ1ZSkge1xuXHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQocmlkKTtcblx0aWYgKFJvY2tldENoYXQucm9vbVR5cGVzLnJvb21UeXBlc1tyb29tLnRdLnByZXZlbnRSZW5hbWluZygpKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnUm9ja2V0Q2hhdC5zYXZlUm9vbWRpc3BsYXlOYW1lJ1xuXHRcdH0pO1xuXHR9XG5cdGlmIChkaXNwbGF5TmFtZSA9PT0gcm9vbS5uYW1lKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qgc2x1Z2lmaWVkUm9vbU5hbWUgPSBSb2NrZXRDaGF0LmdldFZhbGlkUm9vbU5hbWUoZGlzcGxheU5hbWUsIHJpZCk7XG5cblx0Y29uc3QgdXBkYXRlID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0TmFtZUJ5SWQocmlkLCBzbHVnaWZpZWRSb29tTmFtZSwgZGlzcGxheU5hbWUpICYmIFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBkYXRlTmFtZUFuZEFsZXJ0QnlSb29tSWQocmlkLCBzbHVnaWZpZWRSb29tTmFtZSwgZGlzcGxheU5hbWUpO1xuXG5cdGlmICh1cGRhdGUgJiYgc2VuZE1lc3NhZ2UpIHtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVSb29tUmVuYW1lZFdpdGhSb29tSWRSb29tTmFtZUFuZFVzZXIocmlkLCBkaXNwbGF5TmFtZSwgdXNlcik7XG5cdH1cblx0cmV0dXJuIGRpc3BsYXlOYW1lO1xufTtcbiIsIlJvY2tldENoYXQuc2F2ZVJvb21SZWFkT25seSA9IGZ1bmN0aW9uKHJpZCwgcmVhZE9ubHkpIHtcblx0aWYgKCFNYXRjaC50ZXN0KHJpZCwgU3RyaW5nKSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnUm9ja2V0Q2hhdC5zYXZlUm9vbVJlYWRPbmx5J1xuXHRcdH0pO1xuXHR9XG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRSZWFkT25seUJ5SWQocmlkLCByZWFkT25seSk7XG59O1xuIiwiaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuXG5Sb2NrZXRDaGF0LnNhdmVSb29tRGVzY3JpcHRpb24gPSBmdW5jdGlvbihyaWQsIHJvb21EZXNjcmlwdGlvbiwgdXNlcikge1xuXG5cdGlmICghTWF0Y2gudGVzdChyaWQsIFN0cmluZykpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJywge1xuXHRcdFx0J2Z1bmN0aW9uJzogJ1JvY2tldENoYXQuc2F2ZVJvb21EZXNjcmlwdGlvbidcblx0XHR9KTtcblx0fVxuXHRjb25zdCBlc2NhcGVkUm9vbURlc2NyaXB0aW9uID0gcy5lc2NhcGVIVE1MKHJvb21EZXNjcmlwdGlvbik7XG5cdGNvbnN0IHVwZGF0ZSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLnNldERlc2NyaXB0aW9uQnlJZChyaWQsIGVzY2FwZWRSb29tRGVzY3JpcHRpb24pO1xuXHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVSb29tU2V0dGluZ3NDaGFuZ2VkV2l0aFR5cGVSb29tSWRNZXNzYWdlQW5kVXNlcigncm9vbV9jaGFuZ2VkX2Rlc2NyaXB0aW9uJywgcmlkLCBlc2NhcGVkUm9vbURlc2NyaXB0aW9uLCB1c2VyKTtcblx0cmV0dXJuIHVwZGF0ZTtcbn07XG4iLCJSb2NrZXRDaGF0LnNhdmVSb29tU3lzdGVtTWVzc2FnZXMgPSBmdW5jdGlvbihyaWQsIHN5c3RlbU1lc3NhZ2VzKSB7XG5cdGlmICghTWF0Y2gudGVzdChyaWQsIFN0cmluZykpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJywge1xuXHRcdFx0J2Z1bmN0aW9uJzogJ1JvY2tldENoYXQuc2F2ZVJvb21TeXN0ZW1NZXNzYWdlcydcblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0U3lzdGVtTWVzc2FnZXNCeUlkKHJpZCwgc3lzdGVtTWVzc2FnZXMpO1xufTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0c2F2ZVJvb21TZXR0aW5ncyhyaWQsIHNldHRpbmcsIHZhbHVlKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7XG5cdFx0XHRcdCdmdW5jdGlvbic6ICdSb2NrZXRDaGF0LnNhdmVSb29tTmFtZSdcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRpZiAoIU1hdGNoLnRlc3QocmlkLCBTdHJpbmcpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJywge1xuXHRcdFx0XHRtZXRob2Q6ICdzYXZlUm9vbVNldHRpbmdzJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGlmICghWydyb29tTmFtZScsICdyb29tVG9waWMnLCAncm9vbUFubm91bmNlbWVudCcsICdyb29tRGVzY3JpcHRpb24nLCAncm9vbVR5cGUnLCAncmVhZE9ubHknLCAncmVhY3RXaGVuUmVhZE9ubHknLCAnc3lzdGVtTWVzc2FnZXMnLCAnZGVmYXVsdCcsICdqb2luQ29kZScsICd0b2tlbnBhc3MnXS5zb21lKChzKSA9PiBzID09PSBzZXR0aW5nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1zZXR0aW5ncycsICdJbnZhbGlkIHNldHRpbmdzIHByb3ZpZGVkJywge1xuXHRcdFx0XHRtZXRob2Q6ICdzYXZlUm9vbVNldHRpbmdzJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ2VkaXQtcm9vbScsIHJpZCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdFZGl0aW5nIHJvb20gaXMgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3NhdmVSb29tU2V0dGluZ3MnLFxuXHRcdFx0XHRhY3Rpb246ICdFZGl0aW5nX3Jvb20nXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKHNldHRpbmcgPT09ICdkZWZhdWx0JyAmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1yb29tLWFkbWluaXN0cmF0aW9uJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdWaWV3aW5nIHJvb20gYWRtaW5pc3RyYXRpb24gaXMgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3NhdmVSb29tU2V0dGluZ3MnLFxuXHRcdFx0XHRhY3Rpb246ICdWaWV3aW5nX3Jvb21fYWRtaW5pc3RyYXRpb24nXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJpZCk7XG5cdFx0aWYgKHJvb20gIT0gbnVsbCkge1xuXHRcdFx0aWYgKHNldHRpbmcgPT09ICdyb29tVHlwZScgJiYgdmFsdWUgIT09IHJvb20udCAmJiB2YWx1ZSA9PT0gJ2MnICYmICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdjcmVhdGUtYycpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdDaGFuZ2luZyBhIHByaXZhdGUgZ3JvdXAgdG8gYSBwdWJsaWMgY2hhbm5lbCBpcyBub3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0XHRtZXRob2Q6ICdzYXZlUm9vbVNldHRpbmdzJyxcblx0XHRcdFx0XHRhY3Rpb246ICdDaGFuZ2VfUm9vbV9UeXBlJ1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGlmIChzZXR0aW5nID09PSAncm9vbVR5cGUnICYmIHZhbHVlICE9PSByb29tLnQgJiYgdmFsdWUgPT09ICdwJyAmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnY3JlYXRlLXAnKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hY3Rpb24tbm90LWFsbG93ZWQnLCAnQ2hhbmdpbmcgYSBwdWJsaWMgY2hhbm5lbCB0byBhIHByaXZhdGUgcm9vbSBpcyBub3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0XHRtZXRob2Q6ICdzYXZlUm9vbVNldHRpbmdzJyxcblx0XHRcdFx0XHRhY3Rpb246ICdDaGFuZ2VfUm9vbV9UeXBlJ1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHN3aXRjaCAoc2V0dGluZykge1xuXHRcdFx0XHRjYXNlICdyb29tTmFtZSc6XG5cdFx0XHRcdFx0bmFtZSA9IFJvY2tldENoYXQuc2F2ZVJvb21OYW1lKHJpZCwgdmFsdWUsIE1ldGVvci51c2VyKCkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdyb29tVG9waWMnOlxuXHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gcm9vbS50b3BpYykge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zYXZlUm9vbVRvcGljKHJpZCwgdmFsdWUsIE1ldGVvci51c2VyKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncm9vbUFubm91bmNlbWVudCc6XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSByb29tLmFubm91bmNlbWVudCkge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zYXZlUm9vbUFubm91bmNlbWVudChyaWQsIHZhbHVlLCBNZXRlb3IudXNlcigpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3Jvb21EZXNjcmlwdGlvbic6XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSByb29tLmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0XHRSb2NrZXRDaGF0LnNhdmVSb29tRGVzY3JpcHRpb24ocmlkLCB2YWx1ZSwgTWV0ZW9yLnVzZXIoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdyb29tVHlwZSc6XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSByb29tLnQpIHtcblx0XHRcdFx0XHRcdFJvY2tldENoYXQuc2F2ZVJvb21UeXBlKHJpZCwgdmFsdWUsIE1ldGVvci51c2VyKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAndG9rZW5wYXNzJzpcblx0XHRcdFx0XHRjaGVjayh2YWx1ZSwge1xuXHRcdFx0XHRcdFx0cmVxdWlyZTogU3RyaW5nLFxuXHRcdFx0XHRcdFx0dG9rZW5zOiBbe1xuXHRcdFx0XHRcdFx0XHR0b2tlbjogU3RyaW5nLFxuXHRcdFx0XHRcdFx0XHRiYWxhbmNlOiBTdHJpbmdcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdC5zYXZlUm9vbVRva2VucGFzcyhyaWQsIHZhbHVlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncmVhZE9ubHknOlxuXHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gcm9vbS5ybykge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zYXZlUm9vbVJlYWRPbmx5KHJpZCwgdmFsdWUsIE1ldGVvci51c2VyKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncmVhY3RXaGVuUmVhZE9ubHknOlxuXHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gcm9vbS5yZWFjdFdoZW5SZWFkT25seSkge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zYXZlUmVhY3RXaGVuUmVhZE9ubHkocmlkLCB2YWx1ZSwgTWV0ZW9yLnVzZXIoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdzeXN0ZW1NZXNzYWdlcyc6XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSByb29tLnN5c01lcykge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zYXZlUm9vbVN5c3RlbU1lc3NhZ2VzKHJpZCwgdmFsdWUsIE1ldGVvci51c2VyKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnam9pbkNvZGUnOlxuXHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnNldEpvaW5Db2RlQnlJZChyaWQsIFN0cmluZyh2YWx1ZSkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdkZWZhdWx0Jzpcblx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zYXZlRGVmYXVsdEJ5SWQocmlkLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN1bHQ6IHRydWUsXG5cdFx0XHRyaWQ6IHJvb20uX2lkXG5cdFx0fTtcblx0fVxufSk7XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVSb29tU2V0dGluZ3NDaGFuZ2VkV2l0aFR5cGVSb29tSWRNZXNzYWdlQW5kVXNlciA9IGZ1bmN0aW9uKHR5cGUsIHJvb21JZCwgbWVzc2FnZSwgdXNlciwgZXh0cmFEYXRhKSB7XG5cdHJldHVybiB0aGlzLmNyZWF0ZVdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIodHlwZSwgcm9vbUlkLCBtZXNzYWdlLCB1c2VyLCBleHRyYURhdGEpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlUm9vbVJlbmFtZWRXaXRoUm9vbUlkUm9vbU5hbWVBbmRVc2VyID0gZnVuY3Rpb24ocm9vbUlkLCByb29tTmFtZSwgdXNlciwgZXh0cmFEYXRhKSB7XG5cdHJldHVybiB0aGlzLmNyZWF0ZVdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ3InLCByb29tSWQsIHJvb21OYW1lLCB1c2VyLCBleHRyYURhdGEpO1xufTtcbiIsIlJvY2tldENoYXQubW9kZWxzLlJvb21zLnNldERlc2NyaXB0aW9uQnlJZCA9IGZ1bmN0aW9uKF9pZCwgZGVzY3JpcHRpb24pIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkXG5cdH07XG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHRkZXNjcmlwdGlvblxuXHRcdH1cblx0fTtcblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0UmVhZE9ubHlCeUlkID0gZnVuY3Rpb24oX2lkLCByZWFkT25seSkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRzZXQ6IHtcblx0XHRcdHJvOiByZWFkT25seVxuXHRcdH1cblx0fTtcblx0aWYgKHJlYWRPbmx5KSB7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kQnlSb29tSWQoX2lkKS5mb3JFYWNoKGZ1bmN0aW9uKHN1YnNjcmlwdGlvbikge1xuXHRcdFx0aWYgKHN1YnNjcmlwdGlvbi5fdXNlciA9PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHVzZXIgPSBzdWJzY3JpcHRpb24uX3VzZXI7XG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHVzZXIuX2lkLCAncG9zdC1yZWFkb25seScpID09PSBmYWxzZSkge1xuXHRcdFx0XHRpZiAoIXVwZGF0ZS4kc2V0Lm11dGVkKSB7XG5cdFx0XHRcdFx0dXBkYXRlLiRzZXQubXV0ZWQgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdXBkYXRlLiRzZXQubXV0ZWQucHVzaCh1c2VyLnVzZXJuYW1lKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHR1cGRhdGUuJHVuc2V0ID0ge1xuXHRcdFx0bXV0ZWQ6ICcnXG5cdFx0fTtcblx0fVxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRBbGxvd1JlYWN0aW5nV2hlblJlYWRPbmx5QnlJZCA9IGZ1bmN0aW9uKF9pZCwgYWxsb3dSZWFjdGluZykge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRzZXQ6IHtcblx0XHRcdHJlYWN0V2hlblJlYWRPbmx5OiBhbGxvd1JlYWN0aW5nXG5cdFx0fVxuXHR9O1xuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRTeXN0ZW1NZXNzYWdlc0J5SWQgPSBmdW5jdGlvbihfaWQsIHN5c3RlbU1lc3NhZ2VzKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdF9pZFxuXHR9O1xuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0c3lzTWVzOiBzeXN0ZW1NZXNzYWdlc1xuXHRcdH1cblx0fTtcblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcbiIsIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0Lm1vZGVscy5QZXJtaXNzaW9ucy51cHNlcnQoJ3Bvc3QtcmVhZG9ubHknLCB7JHNldE9uSW5zZXJ0OiB7IHJvbGVzOiBbJ2FkbWluJywgJ293bmVyJywgJ21vZGVyYXRvciddIH0gfSk7XG5cdFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLnVwc2VydCgnc2V0LXJlYWRvbmx5JywgeyRzZXRPbkluc2VydDogeyByb2xlczogWydhZG1pbicsICdvd25lciddIH0gfSk7XG5cdFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLnVwc2VydCgnc2V0LXJlYWN0LXdoZW4tcmVhZG9ubHknLCB7JHNldE9uSW5zZXJ0OiB7IHJvbGVzOiBbJ2FkbWluJywgJ293bmVyJ10gfX0pO1xufSk7XG4iXX0=
