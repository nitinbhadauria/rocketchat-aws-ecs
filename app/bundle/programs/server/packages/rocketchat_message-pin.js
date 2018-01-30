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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:message-pin":{"server":{"settings.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_message-pin/server/settings.js                                           //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
Meteor.startup(function () {
	RocketChat.settings.add('Message_AllowPinning', true, {
		type: 'boolean',
		group: 'Message',
		'public': true
	});
	return RocketChat.models.Permissions.upsert('pin-message', {
		$setOnInsert: {
			roles: ['owner', 'moderator', 'admin']
		}
	});
});
//////////////////////////////////////////////////////////////////////////////////////////////////

},"pinMessage.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_message-pin/server/pinMessage.js                                         //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
Meteor.methods({
	pinMessage(message, pinnedAt) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'pinMessage'
			});
		}

		if (!RocketChat.settings.get('Message_AllowPinning')) {
			throw new Meteor.Error('error-action-not-allowed', 'Message pinning not allowed', {
				method: 'pinMessage',
				action: 'Message_pinning'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(message.rid);

		if (Array.isArray(room.usernames) && room.usernames.indexOf(Meteor.user().username) === -1) {
			return false;
		}

		let originalMessage = RocketChat.models.Messages.findOneById(message._id);

		if (originalMessage == null || originalMessage._id == null) {
			throw new Meteor.Error('error-invalid-message', 'Message you are pinning was not found', {
				method: 'pinMessage',
				action: 'Message_pinning'
			});
		} //If we keep history of edits, insert a new message to store history information


		if (RocketChat.settings.get('Message_KeepHistory')) {
			RocketChat.models.Messages.cloneAndSaveAsHistoryById(message._id);
		}

		const me = RocketChat.models.Users.findOneById(Meteor.userId());
		originalMessage.pinned = true;
		originalMessage.pinnedAt = pinnedAt || Date.now;
		originalMessage.pinnedBy = {
			_id: Meteor.userId(),
			username: me.username
		};
		originalMessage = RocketChat.callbacks.run('beforeSaveMessage', originalMessage);
		RocketChat.models.Messages.setPinnedByIdAndUserId(originalMessage._id, originalMessage.pinnedBy, originalMessage.pinned);
		return RocketChat.models.Messages.createWithTypeRoomIdMessageAndUser('message_pinned', originalMessage.rid, '', me, {
			attachments: [{
				'text': originalMessage.msg,
				'author_name': originalMessage.u.username,
				'author_icon': getAvatarUrlFromUsername(originalMessage.u.username),
				'ts': originalMessage.ts
			}]
		});
	},

	unpinMessage(message) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'unpinMessage'
			});
		}

		if (!RocketChat.settings.get('Message_AllowPinning')) {
			throw new Meteor.Error('error-action-not-allowed', 'Message pinning not allowed', {
				method: 'unpinMessage',
				action: 'Message_pinning'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(message.rid);

		if (Array.isArray(room.usernames) && room.usernames.indexOf(Meteor.user().username) === -1) {
			return false;
		}

		let originalMessage = RocketChat.models.Messages.findOneById(message._id);

		if (originalMessage == null || originalMessage._id == null) {
			throw new Meteor.Error('error-invalid-message', 'Message you are unpinning was not found', {
				method: 'unpinMessage',
				action: 'Message_pinning'
			});
		} //If we keep history of edits, insert a new message to store history information


		if (RocketChat.settings.get('Message_KeepHistory')) {
			RocketChat.models.Messages.cloneAndSaveAsHistoryById(originalMessage._id);
		}

		const me = RocketChat.models.Users.findOneById(Meteor.userId());
		originalMessage.pinned = false;
		originalMessage.pinnedBy = {
			_id: Meteor.userId(),
			username: me.username
		};
		originalMessage = RocketChat.callbacks.run('beforeSaveMessage', originalMessage);
		return RocketChat.models.Messages.setPinnedByIdAndUserId(originalMessage._id, originalMessage.pinnedBy, originalMessage.pinned);
	}

});
//////////////////////////////////////////////////////////////////////////////////////////////////

},"publications":{"pinnedMessages.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_message-pin/server/publications/pinnedMessages.js                        //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
Meteor.publish('pinnedMessages', function (rid, limit = 50) {
	if (!this.userId) {
		return this.ready();
	}

	const publication = this;
	const user = RocketChat.models.Users.findOneById(this.userId);

	if (!user) {
		return this.ready();
	}

	const cursorHandle = RocketChat.models.Messages.findPinnedByRoom(rid, {
		sort: {
			ts: -1
		},
		limit
	}).observeChanges({
		added(_id, record) {
			return publication.added('rocketchat_pinned_message', _id, record);
		},

		changed(_id, record) {
			return publication.changed('rocketchat_pinned_message', _id, record);
		},

		removed(_id) {
			return publication.removed('rocketchat_pinned_message', _id);
		}

	});
	this.ready();
	return this.onStop(function () {
		return cursorHandle.stop();
	});
});
//////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup":{"indexes.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_message-pin/server/startup/indexes.js                                    //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
Meteor.startup(function () {
	return Meteor.defer(function () {
		return RocketChat.models.Messages.tryEnsureIndex({
			'pinnedBy._id': 1
		}, {
			sparse: 1
		});
	});
});
//////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:message-pin/server/settings.js");
require("./node_modules/meteor/rocketchat:message-pin/server/pinMessage.js");
require("./node_modules/meteor/rocketchat:message-pin/server/publications/pinnedMessages.js");
require("./node_modules/meteor/rocketchat:message-pin/server/startup/indexes.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:message-pin'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_message-pin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZXNzYWdlLXBpbi9zZXJ2ZXIvc2V0dGluZ3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1waW4vc2VydmVyL3Bpbk1lc3NhZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1waW4vc2VydmVyL3B1YmxpY2F0aW9ucy9waW5uZWRNZXNzYWdlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZXNzYWdlLXBpbi9zZXJ2ZXIvc3RhcnR1cC9pbmRleGVzLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJhZGQiLCJ0eXBlIiwiZ3JvdXAiLCJtb2RlbHMiLCJQZXJtaXNzaW9ucyIsInVwc2VydCIsIiRzZXRPbkluc2VydCIsInJvbGVzIiwibWV0aG9kcyIsInBpbk1lc3NhZ2UiLCJtZXNzYWdlIiwicGlubmVkQXQiLCJ1c2VySWQiLCJFcnJvciIsIm1ldGhvZCIsImdldCIsImFjdGlvbiIsInJvb20iLCJSb29tcyIsImZpbmRPbmVCeUlkIiwicmlkIiwiQXJyYXkiLCJpc0FycmF5IiwidXNlcm5hbWVzIiwiaW5kZXhPZiIsInVzZXIiLCJ1c2VybmFtZSIsIm9yaWdpbmFsTWVzc2FnZSIsIk1lc3NhZ2VzIiwiX2lkIiwiY2xvbmVBbmRTYXZlQXNIaXN0b3J5QnlJZCIsIm1lIiwiVXNlcnMiLCJwaW5uZWQiLCJEYXRlIiwibm93IiwicGlubmVkQnkiLCJjYWxsYmFja3MiLCJydW4iLCJzZXRQaW5uZWRCeUlkQW5kVXNlcklkIiwiY3JlYXRlV2l0aFR5cGVSb29tSWRNZXNzYWdlQW5kVXNlciIsImF0dGFjaG1lbnRzIiwibXNnIiwidSIsImdldEF2YXRhclVybEZyb21Vc2VybmFtZSIsInRzIiwidW5waW5NZXNzYWdlIiwicHVibGlzaCIsImxpbWl0IiwicmVhZHkiLCJwdWJsaWNhdGlvbiIsImN1cnNvckhhbmRsZSIsImZpbmRQaW5uZWRCeVJvb20iLCJzb3J0Iiwib2JzZXJ2ZUNoYW5nZXMiLCJhZGRlZCIsInJlY29yZCIsImNoYW5nZWQiLCJyZW1vdmVkIiwib25TdG9wIiwic3RvcCIsImRlZmVyIiwidHJ5RW5zdXJlSW5kZXgiLCJzcGFyc2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxPQUFPQyxPQUFQLENBQWUsWUFBVztBQUN6QkMsWUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0Isc0JBQXhCLEVBQWdELElBQWhELEVBQXNEO0FBQ3JEQyxRQUFNLFNBRCtDO0FBRXJEQyxTQUFPLFNBRjhDO0FBR3JELFlBQVU7QUFIMkMsRUFBdEQ7QUFLQSxRQUFPSixXQUFXSyxNQUFYLENBQWtCQyxXQUFsQixDQUE4QkMsTUFBOUIsQ0FBcUMsYUFBckMsRUFBb0Q7QUFDMURDLGdCQUFjO0FBQ2JDLFVBQU8sQ0FBQyxPQUFELEVBQVUsV0FBVixFQUF1QixPQUF2QjtBQURNO0FBRDRDLEVBQXBELENBQVA7QUFLQSxDQVhELEU7Ozs7Ozs7Ozs7O0FDQUFYLE9BQU9ZLE9BQVAsQ0FBZTtBQUNkQyxZQUFXQyxPQUFYLEVBQW9CQyxRQUFwQixFQUE4QjtBQUM3QixNQUFJLENBQUNmLE9BQU9nQixNQUFQLEVBQUwsRUFBc0I7QUFDckIsU0FBTSxJQUFJaEIsT0FBT2lCLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQzVEQyxZQUFRO0FBRG9ELElBQXZELENBQU47QUFHQTs7QUFFRCxNQUFJLENBQUNoQixXQUFXQyxRQUFYLENBQW9CZ0IsR0FBcEIsQ0FBd0Isc0JBQXhCLENBQUwsRUFBc0Q7QUFDckQsU0FBTSxJQUFJbkIsT0FBT2lCLEtBQVgsQ0FBaUIsMEJBQWpCLEVBQTZDLDZCQUE3QyxFQUE0RTtBQUNqRkMsWUFBUSxZQUR5RTtBQUVqRkUsWUFBUTtBQUZ5RSxJQUE1RSxDQUFOO0FBSUE7O0FBRUQsUUFBTUMsT0FBT25CLFdBQVdLLE1BQVgsQ0FBa0JlLEtBQWxCLENBQXdCQyxXQUF4QixDQUFvQ1QsUUFBUVUsR0FBNUMsQ0FBYjs7QUFDQSxNQUFJQyxNQUFNQyxPQUFOLENBQWNMLEtBQUtNLFNBQW5CLEtBQWlDTixLQUFLTSxTQUFMLENBQWVDLE9BQWYsQ0FBdUI1QixPQUFPNkIsSUFBUCxHQUFjQyxRQUFyQyxNQUFtRCxDQUFDLENBQXpGLEVBQTRGO0FBQzNGLFVBQU8sS0FBUDtBQUNBOztBQUVELE1BQUlDLGtCQUFrQjdCLFdBQVdLLE1BQVgsQ0FBa0J5QixRQUFsQixDQUEyQlQsV0FBM0IsQ0FBdUNULFFBQVFtQixHQUEvQyxDQUF0Qjs7QUFDQSxNQUFJRixtQkFBbUIsSUFBbkIsSUFBMkJBLGdCQUFnQkUsR0FBaEIsSUFBdUIsSUFBdEQsRUFBNEQ7QUFDM0QsU0FBTSxJQUFJakMsT0FBT2lCLEtBQVgsQ0FBaUIsdUJBQWpCLEVBQTBDLHVDQUExQyxFQUFtRjtBQUN4RkMsWUFBUSxZQURnRjtBQUV4RkUsWUFBUTtBQUZnRixJQUFuRixDQUFOO0FBSUEsR0F6QjRCLENBMkI3Qjs7O0FBQ0EsTUFBSWxCLFdBQVdDLFFBQVgsQ0FBb0JnQixHQUFwQixDQUF3QixxQkFBeEIsQ0FBSixFQUFvRDtBQUNuRGpCLGNBQVdLLE1BQVgsQ0FBa0J5QixRQUFsQixDQUEyQkUseUJBQTNCLENBQXFEcEIsUUFBUW1CLEdBQTdEO0FBQ0E7O0FBRUQsUUFBTUUsS0FBS2pDLFdBQVdLLE1BQVgsQ0FBa0I2QixLQUFsQixDQUF3QmIsV0FBeEIsQ0FBb0N2QixPQUFPZ0IsTUFBUCxFQUFwQyxDQUFYO0FBQ0FlLGtCQUFnQk0sTUFBaEIsR0FBeUIsSUFBekI7QUFDQU4sa0JBQWdCaEIsUUFBaEIsR0FBMkJBLFlBQVl1QixLQUFLQyxHQUE1QztBQUNBUixrQkFBZ0JTLFFBQWhCLEdBQTJCO0FBQzFCUCxRQUFLakMsT0FBT2dCLE1BQVAsRUFEcUI7QUFFMUJjLGFBQVVLLEdBQUdMO0FBRmEsR0FBM0I7QUFLQUMsb0JBQWtCN0IsV0FBV3VDLFNBQVgsQ0FBcUJDLEdBQXJCLENBQXlCLG1CQUF6QixFQUE4Q1gsZUFBOUMsQ0FBbEI7QUFDQTdCLGFBQVdLLE1BQVgsQ0FBa0J5QixRQUFsQixDQUEyQlcsc0JBQTNCLENBQWtEWixnQkFBZ0JFLEdBQWxFLEVBQXVFRixnQkFBZ0JTLFFBQXZGLEVBQWlHVCxnQkFBZ0JNLE1BQWpIO0FBRUEsU0FBT25DLFdBQVdLLE1BQVgsQ0FBa0J5QixRQUFsQixDQUEyQlksa0NBQTNCLENBQThELGdCQUE5RCxFQUFnRmIsZ0JBQWdCUCxHQUFoRyxFQUFxRyxFQUFyRyxFQUF5R1csRUFBekcsRUFBNkc7QUFDbkhVLGdCQUFhLENBQ1o7QUFDQyxZQUFRZCxnQkFBZ0JlLEdBRHpCO0FBRUMsbUJBQWVmLGdCQUFnQmdCLENBQWhCLENBQWtCakIsUUFGbEM7QUFHQyxtQkFBZWtCLHlCQUF5QmpCLGdCQUFnQmdCLENBQWhCLENBQWtCakIsUUFBM0MsQ0FIaEI7QUFJQyxVQUFNQyxnQkFBZ0JrQjtBQUp2QixJQURZO0FBRHNHLEdBQTdHLENBQVA7QUFVQSxFQXREYTs7QUF1RGRDLGNBQWFwQyxPQUFiLEVBQXNCO0FBQ3JCLE1BQUksQ0FBQ2QsT0FBT2dCLE1BQVAsRUFBTCxFQUFzQjtBQUNyQixTQUFNLElBQUloQixPQUFPaUIsS0FBWCxDQUFpQixvQkFBakIsRUFBdUMsY0FBdkMsRUFBdUQ7QUFDNURDLFlBQVE7QUFEb0QsSUFBdkQsQ0FBTjtBQUdBOztBQUVELE1BQUksQ0FBQ2hCLFdBQVdDLFFBQVgsQ0FBb0JnQixHQUFwQixDQUF3QixzQkFBeEIsQ0FBTCxFQUFzRDtBQUNyRCxTQUFNLElBQUluQixPQUFPaUIsS0FBWCxDQUFpQiwwQkFBakIsRUFBNkMsNkJBQTdDLEVBQTRFO0FBQ2pGQyxZQUFRLGNBRHlFO0FBRWpGRSxZQUFRO0FBRnlFLElBQTVFLENBQU47QUFJQTs7QUFFRCxRQUFNQyxPQUFPbkIsV0FBV0ssTUFBWCxDQUFrQmUsS0FBbEIsQ0FBd0JDLFdBQXhCLENBQW9DVCxRQUFRVSxHQUE1QyxDQUFiOztBQUVBLE1BQUlDLE1BQU1DLE9BQU4sQ0FBY0wsS0FBS00sU0FBbkIsS0FBaUNOLEtBQUtNLFNBQUwsQ0FBZUMsT0FBZixDQUF1QjVCLE9BQU82QixJQUFQLEdBQWNDLFFBQXJDLE1BQW1ELENBQUMsQ0FBekYsRUFBNEY7QUFDM0YsVUFBTyxLQUFQO0FBQ0E7O0FBRUQsTUFBSUMsa0JBQWtCN0IsV0FBV0ssTUFBWCxDQUFrQnlCLFFBQWxCLENBQTJCVCxXQUEzQixDQUF1Q1QsUUFBUW1CLEdBQS9DLENBQXRCOztBQUVBLE1BQUlGLG1CQUFtQixJQUFuQixJQUEyQkEsZ0JBQWdCRSxHQUFoQixJQUF1QixJQUF0RCxFQUE0RDtBQUMzRCxTQUFNLElBQUlqQyxPQUFPaUIsS0FBWCxDQUFpQix1QkFBakIsRUFBMEMseUNBQTFDLEVBQXFGO0FBQzFGQyxZQUFRLGNBRGtGO0FBRTFGRSxZQUFRO0FBRmtGLElBQXJGLENBQU47QUFJQSxHQTNCb0IsQ0E2QnJCOzs7QUFDQSxNQUFJbEIsV0FBV0MsUUFBWCxDQUFvQmdCLEdBQXBCLENBQXdCLHFCQUF4QixDQUFKLEVBQW9EO0FBQ25EakIsY0FBV0ssTUFBWCxDQUFrQnlCLFFBQWxCLENBQTJCRSx5QkFBM0IsQ0FBcURILGdCQUFnQkUsR0FBckU7QUFDQTs7QUFFRCxRQUFNRSxLQUFLakMsV0FBV0ssTUFBWCxDQUFrQjZCLEtBQWxCLENBQXdCYixXQUF4QixDQUFvQ3ZCLE9BQU9nQixNQUFQLEVBQXBDLENBQVg7QUFDQWUsa0JBQWdCTSxNQUFoQixHQUF5QixLQUF6QjtBQUNBTixrQkFBZ0JTLFFBQWhCLEdBQTJCO0FBQzFCUCxRQUFLakMsT0FBT2dCLE1BQVAsRUFEcUI7QUFFMUJjLGFBQVVLLEdBQUdMO0FBRmEsR0FBM0I7QUFJQUMsb0JBQWtCN0IsV0FBV3VDLFNBQVgsQ0FBcUJDLEdBQXJCLENBQXlCLG1CQUF6QixFQUE4Q1gsZUFBOUMsQ0FBbEI7QUFFQSxTQUFPN0IsV0FBV0ssTUFBWCxDQUFrQnlCLFFBQWxCLENBQTJCVyxzQkFBM0IsQ0FBa0RaLGdCQUFnQkUsR0FBbEUsRUFBdUVGLGdCQUFnQlMsUUFBdkYsRUFBaUdULGdCQUFnQk0sTUFBakgsQ0FBUDtBQUNBOztBQWxHYSxDQUFmLEU7Ozs7Ozs7Ozs7O0FDQUFyQyxPQUFPbUQsT0FBUCxDQUFlLGdCQUFmLEVBQWlDLFVBQVMzQixHQUFULEVBQWM0QixRQUFRLEVBQXRCLEVBQTBCO0FBQzFELEtBQUksQ0FBQyxLQUFLcEMsTUFBVixFQUFrQjtBQUNqQixTQUFPLEtBQUtxQyxLQUFMLEVBQVA7QUFDQTs7QUFDRCxPQUFNQyxjQUFjLElBQXBCO0FBRUEsT0FBTXpCLE9BQU8zQixXQUFXSyxNQUFYLENBQWtCNkIsS0FBbEIsQ0FBd0JiLFdBQXhCLENBQW9DLEtBQUtQLE1BQXpDLENBQWI7O0FBQ0EsS0FBSSxDQUFDYSxJQUFMLEVBQVc7QUFDVixTQUFPLEtBQUt3QixLQUFMLEVBQVA7QUFDQTs7QUFDRCxPQUFNRSxlQUFlckQsV0FBV0ssTUFBWCxDQUFrQnlCLFFBQWxCLENBQTJCd0IsZ0JBQTNCLENBQTRDaEMsR0FBNUMsRUFBaUQ7QUFBRWlDLFFBQU07QUFBRVIsT0FBSSxDQUFDO0FBQVAsR0FBUjtBQUFvQkc7QUFBcEIsRUFBakQsRUFBOEVNLGNBQTlFLENBQTZGO0FBQ2pIQyxRQUFNMUIsR0FBTixFQUFXMkIsTUFBWCxFQUFtQjtBQUNsQixVQUFPTixZQUFZSyxLQUFaLENBQWtCLDJCQUFsQixFQUErQzFCLEdBQS9DLEVBQW9EMkIsTUFBcEQsQ0FBUDtBQUNBLEdBSGdIOztBQUlqSEMsVUFBUTVCLEdBQVIsRUFBYTJCLE1BQWIsRUFBcUI7QUFDcEIsVUFBT04sWUFBWU8sT0FBWixDQUFvQiwyQkFBcEIsRUFBaUQ1QixHQUFqRCxFQUFzRDJCLE1BQXRELENBQVA7QUFDQSxHQU5nSDs7QUFPakhFLFVBQVE3QixHQUFSLEVBQWE7QUFDWixVQUFPcUIsWUFBWVEsT0FBWixDQUFvQiwyQkFBcEIsRUFBaUQ3QixHQUFqRCxDQUFQO0FBQ0E7O0FBVGdILEVBQTdGLENBQXJCO0FBV0EsTUFBS29CLEtBQUw7QUFDQSxRQUFPLEtBQUtVLE1BQUwsQ0FBWSxZQUFXO0FBQzdCLFNBQU9SLGFBQWFTLElBQWIsRUFBUDtBQUNBLEVBRk0sQ0FBUDtBQUdBLENBekJELEU7Ozs7Ozs7Ozs7O0FDQUFoRSxPQUFPQyxPQUFQLENBQWUsWUFBVztBQUN6QixRQUFPRCxPQUFPaUUsS0FBUCxDQUFhLFlBQVc7QUFDOUIsU0FBTy9ELFdBQVdLLE1BQVgsQ0FBa0J5QixRQUFsQixDQUEyQmtDLGNBQTNCLENBQTBDO0FBQ2hELG1CQUFnQjtBQURnQyxHQUExQyxFQUVKO0FBQ0ZDLFdBQVE7QUFETixHQUZJLENBQVA7QUFLQSxFQU5NLENBQVA7QUFPQSxDQVJELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfbWVzc2FnZS1waW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJNZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ01lc3NhZ2VfQWxsb3dQaW5uaW5nJywgdHJ1ZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ01lc3NhZ2UnLFxuXHRcdCdwdWJsaWMnOiB0cnVlXG5cdH0pO1xuXHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMudXBzZXJ0KCdwaW4tbWVzc2FnZScsIHtcblx0XHQkc2V0T25JbnNlcnQ6IHtcblx0XHRcdHJvbGVzOiBbJ293bmVyJywgJ21vZGVyYXRvcicsICdhZG1pbiddXG5cdFx0fVxuXHR9KTtcbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRwaW5NZXNzYWdlKG1lc3NhZ2UsIHBpbm5lZEF0KSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3Bpbk1lc3NhZ2UnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXNzYWdlX0FsbG93UGlubmluZycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hY3Rpb24tbm90LWFsbG93ZWQnLCAnTWVzc2FnZSBwaW5uaW5nIG5vdCBhbGxvd2VkJywge1xuXHRcdFx0XHRtZXRob2Q6ICdwaW5NZXNzYWdlJyxcblx0XHRcdFx0YWN0aW9uOiAnTWVzc2FnZV9waW5uaW5nJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKG1lc3NhZ2UucmlkKTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShyb29tLnVzZXJuYW1lcykgJiYgcm9vbS51c2VybmFtZXMuaW5kZXhPZihNZXRlb3IudXNlcigpLnVzZXJuYW1lKSA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgb3JpZ2luYWxNZXNzYWdlID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQobWVzc2FnZS5faWQpO1xuXHRcdGlmIChvcmlnaW5hbE1lc3NhZ2UgPT0gbnVsbCB8fCBvcmlnaW5hbE1lc3NhZ2UuX2lkID09IG51bGwpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtbWVzc2FnZScsICdNZXNzYWdlIHlvdSBhcmUgcGlubmluZyB3YXMgbm90IGZvdW5kJywge1xuXHRcdFx0XHRtZXRob2Q6ICdwaW5NZXNzYWdlJyxcblx0XHRcdFx0YWN0aW9uOiAnTWVzc2FnZV9waW5uaW5nJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly9JZiB3ZSBrZWVwIGhpc3Rvcnkgb2YgZWRpdHMsIGluc2VydCBhIG5ldyBtZXNzYWdlIHRvIHN0b3JlIGhpc3RvcnkgaW5mb3JtYXRpb25cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01lc3NhZ2VfS2VlcEhpc3RvcnknKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY2xvbmVBbmRTYXZlQXNIaXN0b3J5QnlJZChtZXNzYWdlLl9pZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWUgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZChNZXRlb3IudXNlcklkKCkpO1xuXHRcdG9yaWdpbmFsTWVzc2FnZS5waW5uZWQgPSB0cnVlO1xuXHRcdG9yaWdpbmFsTWVzc2FnZS5waW5uZWRBdCA9IHBpbm5lZEF0IHx8IERhdGUubm93O1xuXHRcdG9yaWdpbmFsTWVzc2FnZS5waW5uZWRCeSA9IHtcblx0XHRcdF9pZDogTWV0ZW9yLnVzZXJJZCgpLFxuXHRcdFx0dXNlcm5hbWU6IG1lLnVzZXJuYW1lXG5cdFx0fTtcblxuXHRcdG9yaWdpbmFsTWVzc2FnZSA9IFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignYmVmb3JlU2F2ZU1lc3NhZ2UnLCBvcmlnaW5hbE1lc3NhZ2UpO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnNldFBpbm5lZEJ5SWRBbmRVc2VySWQob3JpZ2luYWxNZXNzYWdlLl9pZCwgb3JpZ2luYWxNZXNzYWdlLnBpbm5lZEJ5LCBvcmlnaW5hbE1lc3NhZ2UucGlubmVkKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyKCdtZXNzYWdlX3Bpbm5lZCcsIG9yaWdpbmFsTWVzc2FnZS5yaWQsICcnLCBtZSwge1xuXHRcdFx0YXR0YWNobWVudHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdCd0ZXh0Jzogb3JpZ2luYWxNZXNzYWdlLm1zZyxcblx0XHRcdFx0XHQnYXV0aG9yX25hbWUnOiBvcmlnaW5hbE1lc3NhZ2UudS51c2VybmFtZSxcblx0XHRcdFx0XHQnYXV0aG9yX2ljb24nOiBnZXRBdmF0YXJVcmxGcm9tVXNlcm5hbWUob3JpZ2luYWxNZXNzYWdlLnUudXNlcm5hbWUpLFxuXHRcdFx0XHRcdCd0cyc6IG9yaWdpbmFsTWVzc2FnZS50c1xuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0sXG5cdHVucGluTWVzc2FnZShtZXNzYWdlKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3VucGluTWVzc2FnZSdcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICghUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01lc3NhZ2VfQWxsb3dQaW5uaW5nJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdNZXNzYWdlIHBpbm5pbmcgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3VucGluTWVzc2FnZScsXG5cdFx0XHRcdGFjdGlvbjogJ01lc3NhZ2VfcGlubmluZydcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChtZXNzYWdlLnJpZCk7XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShyb29tLnVzZXJuYW1lcykgJiYgcm9vbS51c2VybmFtZXMuaW5kZXhPZihNZXRlb3IudXNlcigpLnVzZXJuYW1lKSA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgb3JpZ2luYWxNZXNzYWdlID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQobWVzc2FnZS5faWQpO1xuXG5cdFx0aWYgKG9yaWdpbmFsTWVzc2FnZSA9PSBudWxsIHx8IG9yaWdpbmFsTWVzc2FnZS5faWQgPT0gbnVsbCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1tZXNzYWdlJywgJ01lc3NhZ2UgeW91IGFyZSB1bnBpbm5pbmcgd2FzIG5vdCBmb3VuZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAndW5waW5NZXNzYWdlJyxcblx0XHRcdFx0YWN0aW9uOiAnTWVzc2FnZV9waW5uaW5nJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly9JZiB3ZSBrZWVwIGhpc3Rvcnkgb2YgZWRpdHMsIGluc2VydCBhIG5ldyBtZXNzYWdlIHRvIHN0b3JlIGhpc3RvcnkgaW5mb3JtYXRpb25cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01lc3NhZ2VfS2VlcEhpc3RvcnknKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY2xvbmVBbmRTYXZlQXNIaXN0b3J5QnlJZChvcmlnaW5hbE1lc3NhZ2UuX2lkKTtcblx0XHR9XG5cblx0XHRjb25zdCBtZSA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKE1ldGVvci51c2VySWQoKSk7XG5cdFx0b3JpZ2luYWxNZXNzYWdlLnBpbm5lZCA9IGZhbHNlO1xuXHRcdG9yaWdpbmFsTWVzc2FnZS5waW5uZWRCeSA9IHtcblx0XHRcdF9pZDogTWV0ZW9yLnVzZXJJZCgpLFxuXHRcdFx0dXNlcm5hbWU6IG1lLnVzZXJuYW1lXG5cdFx0fTtcblx0XHRvcmlnaW5hbE1lc3NhZ2UgPSBSb2NrZXRDaGF0LmNhbGxiYWNrcy5ydW4oJ2JlZm9yZVNhdmVNZXNzYWdlJywgb3JpZ2luYWxNZXNzYWdlKTtcblxuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRQaW5uZWRCeUlkQW5kVXNlcklkKG9yaWdpbmFsTWVzc2FnZS5faWQsIG9yaWdpbmFsTWVzc2FnZS5waW5uZWRCeSwgb3JpZ2luYWxNZXNzYWdlLnBpbm5lZCk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ3Bpbm5lZE1lc3NhZ2VzJywgZnVuY3Rpb24ocmlkLCBsaW1pdCA9IDUwKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cdGNvbnN0IHB1YmxpY2F0aW9uID0gdGhpcztcblxuXHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQodGhpcy51c2VySWQpO1xuXHRpZiAoIXVzZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cdGNvbnN0IGN1cnNvckhhbmRsZSA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRQaW5uZWRCeVJvb20ocmlkLCB7IHNvcnQ6IHsgdHM6IC0xIH0sIGxpbWl0IH0pLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRhZGRlZChfaWQsIHJlY29yZCkge1xuXHRcdFx0cmV0dXJuIHB1YmxpY2F0aW9uLmFkZGVkKCdyb2NrZXRjaGF0X3Bpbm5lZF9tZXNzYWdlJywgX2lkLCByZWNvcmQpO1xuXHRcdH0sXG5cdFx0Y2hhbmdlZChfaWQsIHJlY29yZCkge1xuXHRcdFx0cmV0dXJuIHB1YmxpY2F0aW9uLmNoYW5nZWQoJ3JvY2tldGNoYXRfcGlubmVkX21lc3NhZ2UnLCBfaWQsIHJlY29yZCk7XG5cdFx0fSxcblx0XHRyZW1vdmVkKF9pZCkge1xuXHRcdFx0cmV0dXJuIHB1YmxpY2F0aW9uLnJlbW92ZWQoJ3JvY2tldGNoYXRfcGlubmVkX21lc3NhZ2UnLCBfaWQpO1xuXHRcdH1cblx0fSk7XG5cdHRoaXMucmVhZHkoKTtcblx0cmV0dXJuIHRoaXMub25TdG9wKGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBjdXJzb3JIYW5kbGUuc3RvcCgpO1xuXHR9KTtcbn0pO1xuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdHJldHVybiBNZXRlb3IuZGVmZXIoZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnRyeUVuc3VyZUluZGV4KHtcblx0XHRcdCdwaW5uZWRCeS5faWQnOiAxXG5cdFx0fSwge1xuXHRcdFx0c3BhcnNlOiAxXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXX0=
