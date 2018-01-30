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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:message-star":{"server":{"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_message-star/server/settings.js                                                 //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
Meteor.startup(function () {
	return RocketChat.settings.add('Message_AllowStarring', true, {
		type: 'boolean',
		group: 'Message',
		'public': true
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

},"starMessage.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_message-star/server/starMessage.js                                              //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
Meteor.methods({
	starMessage(message) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'starMessage'
			});
		}

		if (!RocketChat.settings.get('Message_AllowStarring')) {
			throw new Meteor.Error('error-action-not-allowed', 'Message starring not allowed', {
				method: 'pinMessage',
				action: 'Message_starring'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(message.rid);

		if (Array.isArray(room.usernames) && room.usernames.indexOf(Meteor.user().username) === -1) {
			return false;
		}

		return RocketChat.models.Messages.updateUserStarById(message._id, Meteor.userId(), message.starred);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications":{"starredMessages.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_message-star/server/publications/starredMessages.js                             //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
Meteor.publish('starredMessages', function (rid, limit = 50) {
	if (!this.userId) {
		return this.ready();
	}

	const publication = this;
	const user = RocketChat.models.Users.findOneById(this.userId);

	if (!user) {
		return this.ready();
	}

	const cursorHandle = RocketChat.models.Messages.findStarredByUserAtRoom(this.userId, rid, {
		sort: {
			ts: -1
		},
		limit
	}).observeChanges({
		added(_id, record) {
			return publication.added('rocketchat_starred_message', _id, record);
		},

		changed(_id, record) {
			return publication.changed('rocketchat_starred_message', _id, record);
		},

		removed(_id) {
			return publication.removed('rocketchat_starred_message', _id);
		}

	});
	this.ready();
	return this.onStop(function () {
		return cursorHandle.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup":{"indexes.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_message-star/server/startup/indexes.js                                          //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
Meteor.startup(function () {
	return Meteor.defer(function () {
		return RocketChat.models.Messages.tryEnsureIndex({
			'starred._id': 1
		}, {
			sparse: 1
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:message-star/server/settings.js");
require("./node_modules/meteor/rocketchat:message-star/server/starMessage.js");
require("./node_modules/meteor/rocketchat:message-star/server/publications/starredMessages.js");
require("./node_modules/meteor/rocketchat:message-star/server/startup/indexes.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:message-star'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_message-star.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZXNzYWdlLXN0YXIvc2VydmVyL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om1lc3NhZ2Utc3Rhci9zZXJ2ZXIvc3Rhck1lc3NhZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1zdGFyL3NlcnZlci9wdWJsaWNhdGlvbnMvc3RhcnJlZE1lc3NhZ2VzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om1lc3NhZ2Utc3Rhci9zZXJ2ZXIvc3RhcnR1cC9pbmRleGVzLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJhZGQiLCJ0eXBlIiwiZ3JvdXAiLCJtZXRob2RzIiwic3Rhck1lc3NhZ2UiLCJtZXNzYWdlIiwidXNlcklkIiwiRXJyb3IiLCJtZXRob2QiLCJnZXQiLCJhY3Rpb24iLCJyb29tIiwibW9kZWxzIiwiUm9vbXMiLCJmaW5kT25lQnlJZCIsInJpZCIsIkFycmF5IiwiaXNBcnJheSIsInVzZXJuYW1lcyIsImluZGV4T2YiLCJ1c2VyIiwidXNlcm5hbWUiLCJNZXNzYWdlcyIsInVwZGF0ZVVzZXJTdGFyQnlJZCIsIl9pZCIsInN0YXJyZWQiLCJwdWJsaXNoIiwibGltaXQiLCJyZWFkeSIsInB1YmxpY2F0aW9uIiwiVXNlcnMiLCJjdXJzb3JIYW5kbGUiLCJmaW5kU3RhcnJlZEJ5VXNlckF0Um9vbSIsInNvcnQiLCJ0cyIsIm9ic2VydmVDaGFuZ2VzIiwiYWRkZWQiLCJyZWNvcmQiLCJjaGFuZ2VkIiwicmVtb3ZlZCIsIm9uU3RvcCIsInN0b3AiLCJkZWZlciIsInRyeUVuc3VyZUluZGV4Iiwic3BhcnNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsT0FBT0MsT0FBUCxDQUFl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QUNBQTdDLE9BQU9DLE9BQVAsQ0FBZSxZQUFXO0FBQ3pCLFFBQU9ELE9BQU84QyxLQUFQLENBQWEsWUFBVztBQUM5QixTQUFPNUMsV0FBV2MsTUFBWCxDQUFrQlUsUUFBbEIsQ0FBMkJxQixjQUEzQixDQUEwQztBQUNoRCxrQkFBZTtBQURpQyxHQUExQyxFQUVKO0FBQ0ZDLFdBQVE7QUFETixHQUZJLENBQVA7QUFLQSxFQU5NLENBQVA7QUFPQSxDQVJELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfbWVzc2FnZS1zdGFyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdHJldHVybiBSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTWVzc2FnZV9BbGxvd1N0YXJyaW5nJywgdHJ1ZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ01lc3NhZ2UnLFxuXHRcdCdwdWJsaWMnOiB0cnVlXG5cdH0pO1xufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdHN0YXJNZXNzYWdlKG1lc3NhZ2UpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHtcblx0XHRcdFx0bWV0aG9kOiAnc3Rhck1lc3NhZ2UnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXNzYWdlX0FsbG93U3RhcnJpbmcnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ01lc3NhZ2Ugc3RhcnJpbmcgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3Bpbk1lc3NhZ2UnLFxuXHRcdFx0XHRhY3Rpb246ICdNZXNzYWdlX3N0YXJyaW5nJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKG1lc3NhZ2UucmlkKTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShyb29tLnVzZXJuYW1lcykgJiYgcm9vbS51c2VybmFtZXMuaW5kZXhPZihNZXRlb3IudXNlcigpLnVzZXJuYW1lKSA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMudXBkYXRlVXNlclN0YXJCeUlkKG1lc3NhZ2UuX2lkLCBNZXRlb3IudXNlcklkKCksIG1lc3NhZ2Uuc3RhcnJlZCk7XG5cdH1cbn0pO1xuXG4iLCJNZXRlb3IucHVibGlzaCgnc3RhcnJlZE1lc3NhZ2VzJywgZnVuY3Rpb24ocmlkLCBsaW1pdCA9IDUwKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cdGNvbnN0IHB1YmxpY2F0aW9uID0gdGhpcztcblx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHRoaXMudXNlcklkKTtcblx0aWYgKCF1c2VyKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxuXHRjb25zdCBjdXJzb3JIYW5kbGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kU3RhcnJlZEJ5VXNlckF0Um9vbSh0aGlzLnVzZXJJZCwgcmlkLCB7XG5cdFx0c29ydDoge1xuXHRcdFx0dHM6IC0xXG5cdFx0fSxcblx0XHRsaW1pdFxuXHR9KS5vYnNlcnZlQ2hhbmdlcyh7XG5cdFx0YWRkZWQoX2lkLCByZWNvcmQpIHtcblx0XHRcdHJldHVybiBwdWJsaWNhdGlvbi5hZGRlZCgncm9ja2V0Y2hhdF9zdGFycmVkX21lc3NhZ2UnLCBfaWQsIHJlY29yZCk7XG5cdFx0fSxcblx0XHRjaGFuZ2VkKF9pZCwgcmVjb3JkKSB7XG5cdFx0XHRyZXR1cm4gcHVibGljYXRpb24uY2hhbmdlZCgncm9ja2V0Y2hhdF9zdGFycmVkX21lc3NhZ2UnLCBfaWQsIHJlY29yZCk7XG5cdFx0fSxcblx0XHRyZW1vdmVkKF9pZCkge1xuXHRcdFx0cmV0dXJuIHB1YmxpY2F0aW9uLnJlbW92ZWQoJ3JvY2tldGNoYXRfc3RhcnJlZF9tZXNzYWdlJywgX2lkKTtcblx0XHR9XG5cdH0pO1xuXHR0aGlzLnJlYWR5KCk7XG5cdHJldHVybiB0aGlzLm9uU3RvcChmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gY3Vyc29ySGFuZGxlLnN0b3AoKTtcblx0fSk7XG59KTtcbiIsIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gTWV0ZW9yLmRlZmVyKGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy50cnlFbnN1cmVJbmRleCh7XG5cdFx0XHQnc3RhcnJlZC5faWQnOiAxXG5cdFx0fSwge1xuXHRcdFx0c3BhcnNlOiAxXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXX0=
