(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var RocketChatFile = Package['rocketchat:file'].RocketChatFile;
var Random = Package.random.Random;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var message;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:message-snippet":{"server":{"startup":{"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_message-snippet/server/startup/settings.js                                                  //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Meteor.startup(function () {
	RocketChat.settings.add('Message_AllowSnippeting', false, {
		type: 'boolean',
		public: true,
		group: 'Message'
	});
	RocketChat.models.Permissions.upsert('snippet-message', {
		$setOnInsert: {
			roles: ['owner', 'moderator', 'admin']
		}
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"snippetMessage.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_message-snippet/server/methods/snippetMessage.js                                            //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Meteor.methods({
	snippetMessage(message, filename) {
		if (typeof Meteor.userId() === 'undefined' || Meteor.userId() === null) {
			//noinspection JSUnresolvedFunction
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'snippetMessage'
			});
		}

		const room = RocketChat.models.Rooms.findOne({
			_id: message.rid
		});

		if (typeof room === 'undefined' || room === null) {
			return false;
		}

		if (Array.isArray(room.usernames) && room.usernames.indexOf(Meteor.user().username) === -1) {
			return false;
		} // If we keep history of edits, insert a new message to store history information


		if (RocketChat.settings.get('Message_KeepHistory')) {
			RocketChat.models.Messages.cloneAndSaveAsHistoryById(message._id);
		}

		const me = RocketChat.models.Users.findOneById(Meteor.userId());
		message.snippeted = true;
		message.snippetedAt = Date.now;
		message.snippetedBy = {
			_id: Meteor.userId(),
			username: me.username
		};
		message = RocketChat.callbacks.run('beforeSaveMessage', message); // Create the SnippetMessage

		RocketChat.models.Messages.setSnippetedByIdAndUserId(message, filename, message.snippetedBy, message.snippeted, Date.now, filename);
		RocketChat.models.Messages.createWithTypeRoomIdMessageAndUser('message_snippeted', message.rid, '', me, {
			'snippetId': message._id,
			'snippetName': filename
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"requests.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_message-snippet/server/requests.js                                                          //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
/* global Cookies */WebApp.connectHandlers.use('/snippet/download', function (req, res) {
	let rawCookies;
	let token;
	let uid;
	const cookie = new Cookies();

	if (req.headers && req.headers.cookie !== null) {
		rawCookies = req.headers.cookie;
	}

	if (rawCookies !== null) {
		uid = cookie.get('rc_uid', rawCookies);
	}

	if (rawCookies !== null) {
		token = cookie.get('rc_token', rawCookies);
	}

	if (uid === null) {
		uid = req.query.rc_uid;
		token = req.query.rc_token;
	}

	const user = RocketChat.models.Users.findOneByIdAndLoginToken(uid, token);

	if (!(uid && token && user)) {
		res.writeHead(403);
		res.end();
		return false;
	}

	const match = /^\/([^\/]+)\/(.*)/.exec(req.url);

	if (match[1]) {
		const snippet = RocketChat.models.Messages.findOne({
			'_id': match[1],
			'snippeted': true
		});
		const room = RocketChat.models.Rooms.findOne({
			'_id': snippet.rid,
			'usernames': {
				'$in': [user.username]
			}
		});

		if (room === undefined) {
			res.writeHead(403);
			res.end();
			return false;
		}

		res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(snippet.snippetName)}`);
		res.setHeader('Content-Type', 'application/octet-stream'); // Removing the ``` contained in the msg.

		const snippetContent = snippet.msg.substr(3, snippet.msg.length - 6);
		res.setHeader('Content-Length', snippetContent.length);
		res.write(snippetContent);
		res.end();
		return;
	}

	res.writeHead(404);
	res.end();
	return;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications":{"snippetedMessagesByRoom.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_message-snippet/server/publications/snippetedMessagesByRoom.js                              //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Meteor.publish('snippetedMessages', function (rid, limit = 50) {
	if (typeof this.userId === 'undefined' || this.userId === null) {
		return this.ready();
	}

	const publication = this;
	const user = RocketChat.models.Users.findOneById(this.userId);

	if (typeof user === 'undefined' || user === null) {
		return this.ready();
	}

	const cursorHandle = RocketChat.models.Messages.findSnippetedByRoom(rid, {
		sort: {
			ts: -1
		},
		limit
	}).observeChanges({
		added(_id, record) {
			publication.added('rocketchat_snippeted_message', _id, record);
		},

		changed(_id, record) {
			publication.changed('rocketchat_snippeted_message', _id, record);
		},

		removed(_id) {
			publication.removed('rocketchat_snippeted_message', _id);
		}

	});
	this.ready();

	this.onStop = function () {
		cursorHandle.stop();
	};
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"snippetedMessage.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_message-snippet/server/publications/snippetedMessage.js                                     //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Meteor.publish('snippetedMessage', function (_id) {
	if (typeof this.userId === 'undefined' || this.userId === null) {
		return this.ready();
	}

	const snippet = RocketChat.models.Messages.findOne({
		_id,
		snippeted: true
	});
	const user = RocketChat.models.Users.findOneById(this.userId);
	const roomSnippetQuery = {
		'_id': snippet.rid,
		'usernames': {
			'$in': [user.username]
		}
	};

	if (RocketChat.models.Rooms.findOne(roomSnippetQuery) === undefined) {
		return this.ready();
	}

	const publication = this;

	if (typeof user === 'undefined' || user === null) {
		return this.ready();
	}

	const cursor = RocketChat.models.Messages.find({
		_id
	}).observeChanges({
		added(_id, record) {
			publication.added('rocketchat_snippeted_message', _id, record);
		},

		changed(_id, record) {
			publication.changed('rocketchat_snippeted_message', _id, record);
		},

		removed(_id) {
			publication.removed('rocketchat_snippeted_message', _id);
		}

	});
	this.ready();

	this.onStop = function () {
		cursor.stop();
	};
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:message-snippet/server/startup/settings.js");
require("./node_modules/meteor/rocketchat:message-snippet/server/methods/snippetMessage.js");
require("./node_modules/meteor/rocketchat:message-snippet/server/requests.js");
require("./node_modules/meteor/rocketchat:message-snippet/server/publications/snippetedMessagesByRoom.js");
require("./node_modules/meteor/rocketchat:message-snippet/server/publications/snippetedMessage.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:message-snippet'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_message-snippet.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZXNzYWdlLXNuaXBwZXQvc2VydmVyL3N0YXJ0dXAvc2V0dGluZ3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1zbmlwcGV0L3NlcnZlci9tZXRob2RzL3NuaXBwZXRNZXNzYWdlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om1lc3NhZ2Utc25pcHBldC9zZXJ2ZXIvcmVxdWVzdHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1zbmlwcGV0L3NlcnZlci9wdWJsaWNhdGlvbnMvc25pcHBldGVkTWVzc2FnZXNCeVJvb20uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWVzc2FnZS1zbmlwcGV0L3NlcnZlci9wdWJsaWNhdGlvbnMvc25pcHBldGVkTWVzc2FnZS5qcyJdLCJuYW1lcyI6WyJNZXRlb3IiLCJzdGFydHVwIiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiYWRkIiwidHlwZSIsInB1YmxpYyIsImdyb3VwIiwibW9kZWxzIiwiUGVybWlzc2lvbnMiLCJ1cHNlcnQiLCIkc2V0T25JbnNlcnQiLCJyb2xlcyIsIm1ldGhvZHMiLCJzbmlwcGV0TWVzc2FnZSIsIm1lc3NhZ2UiLCJmaWxlbmFtZSIsInVzZXJJZCIsIkVycm9yIiwibWV0aG9kIiwicm9vbSIsIlJvb21zIiwiZmluZE9uZSIsIl9pZCIsInJpZCIsIkFycmF5IiwiaXNBcnJheSIsInVzZXJuYW1lcyIsImluZGV4T2YiLCJ1c2VyIiwidXNlcm5hbWUiLCJnZXQiLCJNZXNzYWdlcyIsImNsb25lQW5kU2F2ZUFzSGlzdG9yeUJ5SWQiLCJtZSIsIlVzZXJzIiwiZmluZE9uZUJ5SWQiLCJzbmlwcGV0ZWQiLCJzbmlwcGV0ZWRBdCIsIkRhdGUiLCJub3ciLCJzbmlwcGV0ZWRCeSIsImNhbGxiYWNrcyIsInJ1biIsInNldFNuaXBwZXRlZEJ5SWRBbmRVc2VySWQiLCJjcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyIiwiV2ViQXBwIiwiY29ubmVjdEhhbmRsZXJzIiwidXNlIiwicmVxIiwicmVzIiwicmF3Q29va2llcyIsInRva2VuIiwidWlkIiwiY29va2llIiwiQ29va2llcyIsImhlYWRlcnMiLCJxdWVyeSIsInJjX3VpZCIsInJjX3Rva2VuIiwiZmluZE9uZUJ5SWRBbmRMb2dpblRva2VuIiwid3JpdGVIZWFkIiwiZW5kIiwibWF0Y2giLCJleGVjIiwidXJsIiwic25pcHBldCIsInVuZGVmaW5lZCIsInNldEhlYWRlciIsImVuY29kZVVSSUNvbXBvbmVudCIsInNuaXBwZXROYW1lIiwic25pcHBldENvbnRlbnQiLCJtc2ciLCJzdWJzdHIiLCJsZW5ndGgiLCJ3cml0ZSIsInB1Ymxpc2giLCJsaW1pdCIsInJlYWR5IiwicHVibGljYXRpb24iLCJjdXJzb3JIYW5kbGUiLCJmaW5kU25pcHBldGVkQnlSb29tIiwic29ydCIsInRzIiwib2JzZXJ2ZUNoYW5nZXMiLCJhZGRlZCIsInJlY29yZCIsImNoYW5nZWQiLCJyZW1vdmVkIiwib25TdG9wIiwic3RvcCIsInJvb21TbmlwcGV0UXVlcnkiLCJjdXJzb3IiLCJmaW5kIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE9BQVAsQ0FBZSxZQUFXO0FBQ3pCQyxZQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3Qix5QkFBeEIsRUFBbUQsS0FBbkQsRUFBMEQ7QUFDekRDLFFBQU0sU0FEbUQ7QUFFekRDLFVBQVEsSUFGaUQ7QUFHekRDLFNBQU87QUFIa0QsRUFBMUQ7QUFLQUwsWUFBV00sTUFBWCxDQUFrQkMsV0FBbEIsQ0FBOEJDLE1BQTlCLENBQXFDLGlCQUFyQyxFQUF3RDtBQUN2REMsZ0JBQWM7QUFDYkMsVUFBTyxDQUFDLE9BQUQsRUFBVSxXQUFWLEVBQXVCLE9BQXZC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S0FBTCxFQUFQO0FBQ0E7O0FBRUQsT0FBTUMsY0FBYyxJQUFwQjs7QUFHQSxLQUFJLE9BQU9sRCxJQUFQLEtBQWdCLFdBQWhCLElBQStCQSxTQUFTLElBQTVDLEVBQWtEO0FBQ2pELFNBQU8sS0FBS2lELEtBQUwsRUFBUDtBQUNBOztBQUVELE9BQU1jLFNBQVMxRixXQUFXTSxNQUFYLENBQWtCd0IsUUFBbEIsQ0FBMkI2RCxJQUEzQixDQUNkO0FBQUV0RTtBQUFGLEVBRGMsRUFFYjZELGNBRmEsQ0FFRTtBQUNoQkMsUUFBTTlELEdBQU4sRUFBVytELE1BQVgsRUFBbUI7QUFDbEJQLGVBQVlNLEtBQVosQ0FBa0IsOEJBQWxCLEVBQWtEOUQsR0FBbEQsRUFBdUQrRCxNQUF2RDtBQUNBLEdBSGU7O0FBSWhCQyxVQUFRaEUsR0FBUixFQUFhK0QsTUFBYixFQUFxQjtBQUNwQlAsZUFBWVEsT0FBWixDQUFvQiw4QkFBcEIsRUFBb0RoRSxHQUFwRCxFQUF5RCtELE1BQXpEO0FBQ0EsR0FOZTs7QUFPaEJFLFVBQVFqRSxHQUFSLEVBQWE7QUFDWndELGVBQVlTLE9BQVosQ0FBb0IsOEJBQXBCLEVBQW9EakUsR0FBcEQ7QUFDQTs7QUFUZSxFQUZGLENBQWY7QUFjQSxNQUFLdUQsS0FBTDs7QUFFQSxNQUFLVyxNQUFMLEdBQWMsWUFBVztBQUN4QkcsU0FBT0YsSUFBUDtBQUNBLEVBRkQ7QUFHQSxDQTlDRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X21lc3NhZ2Utc25pcHBldC5qcyIsInNvdXJjZXNDb250ZW50IjpbIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTWVzc2FnZV9BbGxvd1NuaXBwZXRpbmcnLCBmYWxzZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0Z3JvdXA6ICdNZXNzYWdlJ1xuXHR9KTtcblx0Um9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMudXBzZXJ0KCdzbmlwcGV0LW1lc3NhZ2UnLCB7XG5cdFx0JHNldE9uSW5zZXJ0OiB7XG5cdFx0XHRyb2xlczogWydvd25lcicsICdtb2RlcmF0b3InLCAnYWRtaW4nXVxuXHRcdH1cblx0fSk7XG59KTtcblxuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRzbmlwcGV0TWVzc2FnZShtZXNzYWdlLCBmaWxlbmFtZSkge1xuXHRcdGlmICgodHlwZW9mIE1ldGVvci51c2VySWQoKSA9PT0gJ3VuZGVmaW5lZCcpIHx8IChNZXRlb3IudXNlcklkKCkgPT09IG51bGwpKSB7XG5cdFx0XHQvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRGdW5jdGlvblxuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsXG5cdFx0XHRcdHttZXRob2Q6ICdzbmlwcGV0TWVzc2FnZSd9KTtcblx0XHR9XG5cblx0XHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZSh7IF9pZDogbWVzc2FnZS5yaWQgfSk7XG5cblx0XHRpZiAoKHR5cGVvZiByb29tID09PSAndW5kZWZpbmVkJykgfHwgKHJvb20gPT09IG51bGwpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkocm9vbS51c2VybmFtZXMpICYmIChyb29tLnVzZXJuYW1lcy5pbmRleE9mKE1ldGVvci51c2VyKCkudXNlcm5hbWUpID09PSAtMSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJZiB3ZSBrZWVwIGhpc3Rvcnkgb2YgZWRpdHMsIGluc2VydCBhIG5ldyBtZXNzYWdlIHRvIHN0b3JlIGhpc3RvcnkgaW5mb3JtYXRpb25cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01lc3NhZ2VfS2VlcEhpc3RvcnknKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY2xvbmVBbmRTYXZlQXNIaXN0b3J5QnlJZChtZXNzYWdlLl9pZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWUgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZChNZXRlb3IudXNlcklkKCkpO1xuXG5cdFx0bWVzc2FnZS5zbmlwcGV0ZWQgPSB0cnVlO1xuXHRcdG1lc3NhZ2Uuc25pcHBldGVkQXQgPSBEYXRlLm5vdztcblx0XHRtZXNzYWdlLnNuaXBwZXRlZEJ5ID0ge1xuXHRcdFx0X2lkOiBNZXRlb3IudXNlcklkKCksXG5cdFx0XHR1c2VybmFtZTogbWUudXNlcm5hbWVcblx0XHR9O1xuXG5cdFx0bWVzc2FnZSA9IFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignYmVmb3JlU2F2ZU1lc3NhZ2UnLCBtZXNzYWdlKTtcblxuXHRcdC8vIENyZWF0ZSB0aGUgU25pcHBldE1lc3NhZ2Vcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRTbmlwcGV0ZWRCeUlkQW5kVXNlcklkKG1lc3NhZ2UsIGZpbGVuYW1lLCBtZXNzYWdlLnNuaXBwZXRlZEJ5LFxuXHRcdFx0bWVzc2FnZS5zbmlwcGV0ZWQsIERhdGUubm93LCBmaWxlbmFtZSk7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyKFxuXHRcdFx0J21lc3NhZ2Vfc25pcHBldGVkJywgbWVzc2FnZS5yaWQsICcnLCBtZSwge1x0J3NuaXBwZXRJZCc6IG1lc3NhZ2UuX2lkLCAnc25pcHBldE5hbWUnOiBmaWxlbmFtZSB9KTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWwgQ29va2llcyAqL1xuV2ViQXBwLmNvbm5lY3RIYW5kbGVycy51c2UoJy9zbmlwcGV0L2Rvd25sb2FkJywgZnVuY3Rpb24ocmVxLCByZXMpIHtcblx0bGV0IHJhd0Nvb2tpZXM7XG5cdGxldCB0b2tlbjtcblx0bGV0IHVpZDtcblx0Y29uc3QgY29va2llID0gbmV3IENvb2tpZXMoKTtcblxuXHRpZiAocmVxLmhlYWRlcnMgJiYgcmVxLmhlYWRlcnMuY29va2llICE9PSBudWxsKSB7XG5cdFx0cmF3Q29va2llcyA9IHJlcS5oZWFkZXJzLmNvb2tpZTtcblx0fVxuXG5cdGlmIChyYXdDb29raWVzICE9PSBudWxsKSB7XG5cdFx0dWlkID0gY29va2llLmdldCgncmNfdWlkJywgcmF3Q29va2llcyk7XG5cdH1cblxuXHRpZiAocmF3Q29va2llcyAhPT0gbnVsbCkge1xuXHRcdHRva2VuID0gY29va2llLmdldCgncmNfdG9rZW4nLCByYXdDb29raWVzKTtcblx0fVxuXG5cdGlmICh1aWQgPT09IG51bGwpIHtcblx0XHR1aWQgPSByZXEucXVlcnkucmNfdWlkO1xuXHRcdHRva2VuID0gcmVxLnF1ZXJ5LnJjX3Rva2VuO1xuXHR9XG5cblx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkQW5kTG9naW5Ub2tlbih1aWQsIHRva2VuKTtcblxuXHRpZiAoISh1aWQgJiYgdG9rZW4gJiYgdXNlcikpIHtcblx0XHRyZXMud3JpdGVIZWFkKDQwMyk7XG5cdFx0cmVzLmVuZCgpO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjb25zdCBtYXRjaCA9IC9eXFwvKFteXFwvXSspXFwvKC4qKS8uZXhlYyhyZXEudXJsKTtcblxuXHRpZiAobWF0Y2hbMV0pIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZShcblx0XHRcdHtcblx0XHRcdFx0J19pZCc6IG1hdGNoWzFdLFxuXHRcdFx0XHQnc25pcHBldGVkJzogdHJ1ZVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmUoeyAnX2lkJzogc25pcHBldC5yaWQsICd1c2VybmFtZXMnOiB7ICckaW4nOiBbdXNlci51c2VybmFtZV0gfX0pO1xuXHRcdGlmIChyb29tID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlcy53cml0ZUhlYWQoNDAzKTtcblx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJywgYGF0dGFjaG1lbnQ7IGZpbGVuYW1lKj1VVEYtOCcnJHsgZW5jb2RlVVJJQ29tcG9uZW50KHNuaXBwZXQuc25pcHBldE5hbWUpIH1gKTtcblx0XHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyk7XG5cblx0XHQvLyBSZW1vdmluZyB0aGUgYGBgIGNvbnRhaW5lZCBpbiB0aGUgbXNnLlxuXHRcdGNvbnN0IHNuaXBwZXRDb250ZW50ID0gc25pcHBldC5tc2cuc3Vic3RyKDMsIHNuaXBwZXQubXNnLmxlbmd0aCAtIDYpO1xuXHRcdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgc25pcHBldENvbnRlbnQubGVuZ3RoKTtcblx0XHRyZXMud3JpdGUoc25pcHBldENvbnRlbnQpO1xuXHRcdHJlcy5lbmQoKTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRyZXMud3JpdGVIZWFkKDQwNCk7XG5cdHJlcy5lbmQoKTtcblx0cmV0dXJuO1xufSk7XG4iLCJNZXRlb3IucHVibGlzaCgnc25pcHBldGVkTWVzc2FnZXMnLCBmdW5jdGlvbihyaWQsIGxpbWl0PTUwKSB7XG5cdGlmICh0eXBlb2YgdGhpcy51c2VySWQgPT09ICd1bmRlZmluZWQnIHx8IHRoaXMudXNlcklkID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxuXG5cdGNvbnN0IHB1YmxpY2F0aW9uID0gdGhpcztcblxuXHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQodGhpcy51c2VySWQpO1xuXG5cdGlmICh0eXBlb2YgdXNlciA9PT0gJ3VuZGVmaW5lZCcgfHwgdXNlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiB0aGlzLnJlYWR5KCk7XG5cdH1cblxuXHRjb25zdCBjdXJzb3JIYW5kbGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kU25pcHBldGVkQnlSb29tKFxuXHRcdHJpZCxcblx0XHR7XG5cdFx0XHRzb3J0OiB7dHM6IC0xfSxcblx0XHRcdGxpbWl0XG5cdFx0fVxuXHQpLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRhZGRlZChfaWQsIHJlY29yZCkge1xuXHRcdFx0cHVibGljYXRpb24uYWRkZWQoJ3JvY2tldGNoYXRfc25pcHBldGVkX21lc3NhZ2UnLCBfaWQsIHJlY29yZCk7XG5cdFx0fSxcblx0XHRjaGFuZ2VkKF9pZCwgcmVjb3JkKSB7XG5cdFx0XHRwdWJsaWNhdGlvbi5jaGFuZ2VkKCdyb2NrZXRjaGF0X3NuaXBwZXRlZF9tZXNzYWdlJywgX2lkLCByZWNvcmQpO1xuXHRcdH0sXG5cdFx0cmVtb3ZlZChfaWQpIHtcblx0XHRcdHB1YmxpY2F0aW9uLnJlbW92ZWQoJ3JvY2tldGNoYXRfc25pcHBldGVkX21lc3NhZ2UnLCBfaWQpO1xuXHRcdH1cblx0fSk7XG5cdHRoaXMucmVhZHkoKTtcblxuXHR0aGlzLm9uU3RvcCA9IGZ1bmN0aW9uKCkge1xuXHRcdGN1cnNvckhhbmRsZS5zdG9wKCk7XG5cdH07XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdzbmlwcGV0ZWRNZXNzYWdlJywgZnVuY3Rpb24oX2lkKSB7XG5cdGlmICh0eXBlb2YgdGhpcy51c2VySWQgPT09ICd1bmRlZmluZWQnIHx8IHRoaXMudXNlcklkID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxuXG5cdGNvbnN0IHNuaXBwZXQgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lKHtfaWQsIHNuaXBwZXRlZDogdHJ1ZX0pO1xuXHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQodGhpcy51c2VySWQpO1xuXHRjb25zdCByb29tU25pcHBldFF1ZXJ5ID0ge1xuXHRcdCdfaWQnOiBzbmlwcGV0LnJpZCxcblx0XHQndXNlcm5hbWVzJzoge1xuXHRcdFx0JyRpbic6IFtcblx0XHRcdFx0dXNlci51c2VybmFtZVxuXHRcdFx0XVxuXHRcdH1cblx0fTtcblxuXHRpZiAoUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZShyb29tU25pcHBldFF1ZXJ5KSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxuXG5cdGNvbnN0IHB1YmxpY2F0aW9uID0gdGhpcztcblxuXG5cdGlmICh0eXBlb2YgdXNlciA9PT0gJ3VuZGVmaW5lZCcgfHwgdXNlciA9PT0gbnVsbCkge1xuXHRcdHJldHVybiB0aGlzLnJlYWR5KCk7XG5cdH1cblxuXHRjb25zdCBjdXJzb3IgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kKFxuXHRcdHsgX2lkIH1cblx0KS5vYnNlcnZlQ2hhbmdlcyh7XG5cdFx0YWRkZWQoX2lkLCByZWNvcmQpIHtcblx0XHRcdHB1YmxpY2F0aW9uLmFkZGVkKCdyb2NrZXRjaGF0X3NuaXBwZXRlZF9tZXNzYWdlJywgX2lkLCByZWNvcmQpO1xuXHRcdH0sXG5cdFx0Y2hhbmdlZChfaWQsIHJlY29yZCkge1xuXHRcdFx0cHVibGljYXRpb24uY2hhbmdlZCgncm9ja2V0Y2hhdF9zbmlwcGV0ZWRfbWVzc2FnZScsIF9pZCwgcmVjb3JkKTtcblx0XHR9LFxuXHRcdHJlbW92ZWQoX2lkKSB7XG5cdFx0XHRwdWJsaWNhdGlvbi5yZW1vdmVkKCdyb2NrZXRjaGF0X3NuaXBwZXRlZF9tZXNzYWdlJywgX2lkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRoaXMucmVhZHkoKTtcblxuXHR0aGlzLm9uU3RvcCA9IGZ1bmN0aW9uKCkge1xuXHRcdGN1cnNvci5zdG9wKCk7XG5cdH07XG59KTtcbiJdfQ==
