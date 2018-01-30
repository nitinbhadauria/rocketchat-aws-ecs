(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var check = Package.check.check;
var Match = Package.check.Match;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-invite-all":{"server":{"server.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/rocketchat_slashcommands-invite-all/server/server.js                                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
/*
 * Invite is a named function that will replace /invite commands
 * @param {Object} message - The message object
 */function inviteAll(type) {
	return function inviteAll(command, params, item) {
		if (!/invite\-all-(to|from)/.test(command) || !Match.test(params, String)) {
			return;
		}

		const regexp = /#?([\d-_\w]+)/g;
		const [, channel] = regexp.exec(params.trim());

		if (!channel) {
			return;
		}

		const currentUser = Meteor.users.findOne(Meteor.userId());
		const baseChannel = type === 'to' ? RocketChat.models.Rooms.findOneById(item.rid) : RocketChat.models.Rooms.findOneByName(channel);
		const targetChannel = type === 'from' ? RocketChat.models.Rooms.findOneById(item.rid) : RocketChat.models.Rooms.findOneByName(channel);

		if (!baseChannel) {
			return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
				_id: Random.id(),
				rid: item.rid,
				ts: new Date(),
				msg: TAPi18n.__('Channel_doesnt_exist', {
					postProcess: 'sprintf',
					sprintf: [channel]
				}, currentUser.language)
			});
		}

		const users = baseChannel.usernames || [];

		try {
			if (users.length > RocketChat.settings.get('API_User_Limit')) {
				throw new Meteor.Error('error-user-limit-exceeded', 'User Limit Exceeded', {
					method: 'addAllToRoom'
				});
			}

			if (!targetChannel && ['c', 'p'].indexOf(baseChannel.t) > -1) {
				Meteor.call(baseChannel.t === 'c' ? 'createChannel' : 'createPrivateGroup', channel, users);
				RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
					_id: Random.id(),
					rid: item.rid,
					ts: new Date(),
					msg: TAPi18n.__('Channel_created', {
						postProcess: 'sprintf',
						sprintf: [channel]
					}, currentUser.language)
				});
			} else {
				Meteor.call('addUsersToRoom', {
					rid: targetChannel._id,
					users
				});
			}

			return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
				_id: Random.id(),
				rid: item.rid,
				ts: new Date(),
				msg: TAPi18n.__('Users_added', null, currentUser.language)
			});
		} catch (e) {
			const msg = e.error === 'cant-invite-for-direct-room' ? 'Cannot_invite_users_to_direct_rooms' : e.error;
			RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
				_id: Random.id(),
				rid: item.rid,
				ts: new Date(),
				msg: TAPi18n.__(msg, null, currentUser.language)
			});
		}
	};
}

RocketChat.slashCommands.add('invite-all-to', inviteAll('to'));
RocketChat.slashCommands.add('invite-all-from', inviteAll('from'));
module.exports = inviteAll;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-invite-all/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-invite-all'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-invite-all.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWludml0ZS1hbGwvc2VydmVyL3NlcnZlci5qcyJdLCJuYW1lcyI6WyJpbnZpdGVBbGwiLCJ0eXBlIiwiY29tbWFuZCIsInBhcmFtcyIsIml0ZW0iLCJ0ZXN0IiwiTWF0Y2giLCJTdHJpbmciLCJyZWdleHAiLCJjaGFubmVsIiwiZXhlYyIsInRyaW0iLCJjdXJyZW50VXNlciIsIk1ldGVvciIsInVzZXJzIiwiZmluZE9uZSIsInVzZXJJZCIsImJhc2VDaGFubmVsIiwiUm9ja2V0Q2hhdCIsIm1vZGVscyIsIlJvb21zIiwiZmluZE9uZUJ5SWQiLCJyaWQiLCJmaW5kT25lQnlOYW1lIiwidGFyZ2V0Q2hhbm5lbCIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlVc2VyIiwiX2lkIiwiUmFuZG9tIiwiaWQiLCJ0cyIsIkRhdGUiLCJtc2ciLCJUQVBpMThuIiwiX18iLCJwb3N0UHJvY2VzcyIsInNwcmludGYiLCJsYW5ndWFnZSIsInVzZXJuYW1lcyIsImxlbmd0aCIsInNldHRpbmdzIiwiZ2V0IiwiRXJyb3IiLCJtZXRob2QiLCJpbmRleE9mIiwidCIsImNhbGwiLCJlIiwiZXJyb3IiLCJzbGFzaENvbW1hbmRzIiwiYWRkIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7OztHQUtBLFNBQVNBLFNBQVQsQ0FBbUJDLElBQW5CLEVBQXlCO0FBRXhCLFFBQU8sU0FBU0QsU0FBVCxDQUFtQkUsT0FBbkIsRUFBNEJDLE1BQTVCLEVBQW9DQyxJQUFwQyxFQUEwQztBQUVoRCxNQUFJLENBQUMsd0JBQXdCQyxJQUF4QixDQUE2QkgsT0FBN0IsQ0FBRCxJQUEwQyxDQUFDSSxNQUFNRCxJQUFOLENBQVdGLE1BQVgsRUFBbUJJLE1BQW5CLENBQS9DLEVBQTJFO0FBQzFFO0FBQ0E7O0FBRUQsUUFBTUMsU0FBUyxnQkFBZjtBQUNB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LElBQUosRUFIa0U7QUFJdEVDLFNBQUtDLFFBQVFDLEVBQVIsQ0FBVyxhQUFYLEVBQTBCLElBQTFCLEVBQWdDdEIsWUFBWXlCLFFBQTVDO0FBSmlFLElBQWhFLENBQVA7QUFNQSxHQTlCRCxDQThCRSxPQUFPVSxDQUFQLEVBQVU7QUFDWCxTQUFNZixNQUFNZSxFQUFFQyxLQUFGLEtBQVksNkJBQVosR0FBNEMscUNBQTVDLEdBQW9GRCxFQUFFQyxLQUFsRztBQUNBOUIsY0FBV08sYUFBWCxDQUF5QkMsVUFBekIsQ0FBb0NiLE9BQU9HLE1BQVAsRUFBcEMsRUFBcUQsU0FBckQsRUFBZ0U7QUFDL0RXLFNBQUtDLE9BQU9DLEVBQVAsRUFEMEQ7QUFFL0RQLFNBQUtsQixLQUFLa0IsR0FGcUQ7QUFHL0RRLFFBQUksSUFBSUMsSUFBSixFQUgyRDtBQUkvREMsU0FBS0MsUUFBUUMsRUFBUixDQUFXRixHQUFYLEVBQWdCLElBQWhCLEVBQXNCcEIsWUFBWXlCLFFBQWxDO0FBSjBELElBQWhFO0FBTUE7QUFDRCxFQXJFRDtBQXNFQTs7QUFDRG5CLFdBQVcrQixhQUFYLENBQXlCQyxHQUF6QixDQUE2QixlQUE3QixFQUE4Q2xELFVBQVUsSUFBVixDQUE5QztBQUNBa0IsV0FBVytCLGFBQVgsQ0FBeUJDLEdBQXpCLENBQTZCLGlCQUE3QixFQUFnRGxELFVBQVUsTUFBVixDQUFoRDtBQUNBbUQsT0FBT0MsT0FBUCxHQUFpQnBELFNBQWpCLEMiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfc2xhc2hjb21tYW5kcy1pbnZpdGUtYWxsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEludml0ZSBpcyBhIG5hbWVkIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXBsYWNlIC9pbnZpdGUgY29tbWFuZHNcbiAqIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlIC0gVGhlIG1lc3NhZ2Ugb2JqZWN0XG4gKi9cblxuZnVuY3Rpb24gaW52aXRlQWxsKHR5cGUpIHtcblxuXHRyZXR1cm4gZnVuY3Rpb24gaW52aXRlQWxsKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXG5cdFx0aWYgKCEvaW52aXRlXFwtYWxsLSh0b3xmcm9tKS8udGVzdChjb21tYW5kKSB8fCAhTWF0Y2gudGVzdChwYXJhbXMsIFN0cmluZykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZWdleHAgPSAvIz8oW1xcZC1fXFx3XSspL2c7XG5cdFx0Y29uc3QgWywgY2hhbm5lbF0gPSByZWdleHAuZXhlYyhwYXJhbXMudHJpbSgpKTtcblxuXHRcdGlmICghY2hhbm5lbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGN1cnJlbnRVc2VyID0gTWV0ZW9yLnVzZXJzLmZpbmRPbmUoTWV0ZW9yLnVzZXJJZCgpKTtcblx0XHRjb25zdCBiYXNlQ2hhbm5lbCA9IHR5cGUgPT09ICd0bycgPyBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpdGVtLnJpZCkgOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKGNoYW5uZWwpO1xuXHRcdGNvbnN0IHRhcmdldENoYW5uZWwgPSB0eXBlID09PSAnZnJvbScgPyBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpdGVtLnJpZCkgOiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKGNoYW5uZWwpO1xuXG5cdFx0aWYgKCFiYXNlQ2hhbm5lbCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0XHRtc2c6IFRBUGkxOG4uX18oJ0NoYW5uZWxfZG9lc250X2V4aXN0Jywge1xuXHRcdFx0XHRcdHBvc3RQcm9jZXNzOiAnc3ByaW50ZicsXG5cdFx0XHRcdFx0c3ByaW50ZjogW2NoYW5uZWxdXG5cdFx0XHRcdH0sIGN1cnJlbnRVc2VyLmxhbmd1YWdlKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGNvbnN0IHVzZXJzID0gYmFzZUNoYW5uZWwudXNlcm5hbWVzIHx8IFtdO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGlmICh1c2Vycy5sZW5ndGggPiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX1VzZXJfTGltaXQnKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci11c2VyLWxpbWl0LWV4Y2VlZGVkJywgJ1VzZXIgTGltaXQgRXhjZWVkZWQnLCB7XG5cdFx0XHRcdFx0bWV0aG9kOiAnYWRkQWxsVG9Sb29tJ1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0YXJnZXRDaGFubmVsICYmIFsnYycsICdwJ10uaW5kZXhPZihiYXNlQ2hhbm5lbC50KSA+IC0xKSB7XG5cdFx0XHRcdE1ldGVvci5jYWxsKGJhc2VDaGFubmVsLnQgPT09ICdjJyA/ICdjcmVhdGVDaGFubmVsJyA6ICdjcmVhdGVQcml2YXRlR3JvdXAnLCBjaGFubmVsLCB1c2Vycyk7XG5cdFx0XHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0XHRcdG1zZzogVEFQaTE4bi5fXygnQ2hhbm5lbF9jcmVhdGVkJywge1xuXHRcdFx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0XHRcdHNwcmludGY6IFtjaGFubmVsXVxuXHRcdFx0XHRcdH0sIGN1cnJlbnRVc2VyLmxhbmd1YWdlKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdE1ldGVvci5jYWxsKCdhZGRVc2Vyc1RvUm9vbScsIHtcblx0XHRcdFx0XHRyaWQ6IHRhcmdldENoYW5uZWwuX2lkLFxuXHRcdFx0XHRcdHVzZXJzXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0XHRtc2c6IFRBUGkxOG4uX18oJ1VzZXJzX2FkZGVkJywgbnVsbCwgY3VycmVudFVzZXIubGFuZ3VhZ2UpXG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBtc2cgPSBlLmVycm9yID09PSAnY2FudC1pbnZpdGUtZm9yLWRpcmVjdC1yb29tJyA/ICdDYW5ub3RfaW52aXRlX3VzZXJzX3RvX2RpcmVjdF9yb29tcycgOiBlLmVycm9yO1xuXHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRcdG1zZzogVEFQaTE4bi5fXyhtc2csIG51bGwsIGN1cnJlbnRVc2VyLmxhbmd1YWdlKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufVxuUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgnaW52aXRlLWFsbC10bycsIGludml0ZUFsbCgndG8nKSk7XG5Sb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuYWRkKCdpbnZpdGUtYWxsLWZyb20nLCBpbnZpdGVBbGwoJ2Zyb20nKSk7XG5tb2R1bGUuZXhwb3J0cyA9IGludml0ZUFsbDtcbiJdfQ==
