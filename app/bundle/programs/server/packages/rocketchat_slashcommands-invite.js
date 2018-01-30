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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-invite":{"server":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/rocketchat_slashcommands-invite/server/server.js                               //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
module.export({
	Invite: () => Invite
});

/*
* Invite is a named function that will replace /invite commands
* @param {Object} message - The message object
*/function Invite(command, params, item) {
	if (command !== 'invite' || !Match.test(params, String)) {
		return;
	}

	let usernames = params.replace(/@/g, '').split(/[\s,]/).filter(a => a !== '');

	if (usernames.length === 0) {
		return;
	}

	const users = Meteor.users.find({
		username: {
			$in: usernames
		}
	});
	const currentUser = Meteor.users.findOne(Meteor.userId());

	if (users.count() === 0) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('User_doesnt_exist', {
				postProcess: 'sprintf',
				sprintf: [usernames.join(' @')]
			}, currentUser.language)
		});
		return;
	}

	usernames = usernames.filter(function (username) {
		if (RocketChat.models.Rooms.findOneByIdContainingUsername(item.rid, username) == null) {
			return true;
		}

		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_is_already_in_here', {
				postProcess: 'sprintf',
				sprintf: [username]
			}, currentUser.language)
		});
		return false;
	});

	if (usernames.length === 0) {
		return;
	}

	users.forEach(function (user) {
		try {
			return Meteor.call('addUserToRoom', {
				rid: item.rid,
				username: user.username
			});
		} catch ({
			error
		}) {
			if (error === 'cant-invite-for-direct-room') {
				RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
					_id: Random.id(),
					rid: item.rid,
					ts: new Date(),
					msg: TAPi18n.__('Cannot_invite_users_to_direct_rooms', null, currentUser.language)
				});
			} else {
				RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
					_id: Random.id(),
					rid: item.rid,
					ts: new Date(),
					msg: TAPi18n.__(error, null, currentUser.language)
				});
			}
		}
	});
}

RocketChat.slashCommands.add('invite', Invite);
/////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-invite/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-invite'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-invite.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWludml0ZS9zZXJ2ZXIvc2VydmVyLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkludml0ZSIsImNvbW1hbmQiLCJwYXJhbXMiLCJpdGVtIiwiTWF0Y2giLCJ0ZXN0IiwiU3RyaW5nIiwidXNlcm5hbWVzIiwicmVwbGFjZSIsInNwbGl0IiwiZmlsdGVyIiwiYSIsImxlbmd0aCIsInVzZXJzIiwiTWV0ZW9yIiwiZmluZCIsInVzZXJuYW1lIiwiJGluIiwiY3VycmVudFVzZXIiLCJmaW5kT25lIiwidXNlcklkIiwiY291bnQiLCJSb2NrZXRDaGF0IiwiTm90aWZpY2F0aW9ucyIsIm5vdGlmeVVzZXIiLCJfaWQiLCJSYW5kb20iLCJpZCIsInJpZCIsInRzIiwiRGF0ZSIsIm1zZyIsIlRBUGkxOG4iLCJfXyIsInBvc3RQcm9jZXNzIiwic3ByaW50ZiIsImpvaW4iLCJsYW5ndWFnZSIsIm1vZGVscyIsIlJvb21zIiwiZmluZE9uZUJ5SWRDb250YWluaW5nVXNlcm5hbWUiLCJmb3JFYWNoIiwidXNlciIsImNhbGwiLCJlcnJvciIsInNsYXNoQ29tbWFuZHMiLCJhZGQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxPQUFPQyxNQUFQLENBQWM7QUFBQ0MsU0FBTyxNQUFJQTtBQUFaLENBQWQ7O0FBQ0E7OztFQU1BLFNBQVNBLE1BQVQsQ0FBZ0JDLE9BQWhCLEVBQXlCQyxNQUF6QixFQUFpQ0MsSUFBakMsRUFBdUM7QUFFdEMsS0FBSUYsWUFBWSxRQUFaLElBQXdCLENBQUNHLE1BQU1DLElBQU4sQ0FBV0gsTUFBWCxFQUFtQkksTUFBbkIsQ0FBN0IsRUFBeUQ7QUFDeEQ7QUFDQTs7QUFDRCxLQUFJQyxZQUFZTCxPQUFPTSxPQUFQLENBQWUsSUFBZixFQUFxQixFQUFyQixFQUF5QkMsS0FBekIsQ0FBK0IsT0FBL0IsRUFBd0NDLE1B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QUtDLFFBQVFDLEVBQVIsQ0FBV1csS0FBWCxFQUFrQixJQUFsQixFQUF3QjFCLFlBQVltQixRQUFwQztBQUowRCxLQUFoRTtBQU1BO0FBQ0Q7QUFDRCxFQXhCRDtBQXlCQTs7QUFFRGYsV0FBV3VCLGFBQVgsQ0FBeUJDLEdBQXpCLENBQTZCLFFBQTdCLEVBQXVDOUMsTUFBdkMsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zbGFzaGNvbW1hbmRzLWludml0ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuLypcbiogSW52aXRlIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlcGxhY2UgL2ludml0ZSBjb21tYW5kc1xuKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIG9iamVjdFxuKi9cblxuXG5mdW5jdGlvbiBJbnZpdGUoY29tbWFuZCwgcGFyYW1zLCBpdGVtKSB7XG5cblx0aWYgKGNvbW1hbmQgIT09ICdpbnZpdGUnIHx8ICFNYXRjaC50ZXN0KHBhcmFtcywgU3RyaW5nKSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRsZXQgdXNlcm5hbWVzID0gcGFyYW1zLnJlcGxhY2UoL0AvZywgJycpLnNwbGl0KC9bXFxzLF0vKS5maWx0ZXIoKGEpID0+IGEgIT09ICcnKTtcblx0aWYgKHVzZXJuYW1lcy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgdXNlcnMgPSBNZXRlb3IudXNlcnMuZmluZCh7XG5cdFx0dXNlcm5hbWU6IHtcblx0XHRcdCRpbjogdXNlcm5hbWVzXG5cdFx0fVxuXHR9KTtcblx0Y29uc3QgY3VycmVudFVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZShNZXRlb3IudXNlcklkKCkpO1xuXHRpZiAodXNlcnMuY291bnQoKSA9PT0gMCkge1xuXHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdHRzOiBuZXcgRGF0ZSxcblx0XHRcdG1zZzogVEFQaTE4bi5fXygnVXNlcl9kb2VzbnRfZXhpc3QnLCB7XG5cdFx0XHRcdHBvc3RQcm9jZXNzOiAnc3ByaW50ZicsXG5cdFx0XHRcdHNwcmludGY6IFt1c2VybmFtZXMuam9pbignIEAnKV1cblx0XHRcdH0sIGN1cnJlbnRVc2VyLmxhbmd1YWdlKVxuXHRcdH0pO1xuXHRcdHJldHVybjtcblx0fVxuXHR1c2VybmFtZXMgPSB1c2VybmFtZXMuZmlsdGVyKGZ1bmN0aW9uKHVzZXJuYW1lKSB7XG5cdFx0aWYgKFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkQ29udGFpbmluZ1VzZXJuYW1lKGl0ZW0ucmlkLCB1c2VybmFtZSkgPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdHRzOiBuZXcgRGF0ZSxcblx0XHRcdG1zZzogVEFQaTE4bi5fXygnVXNlcm5hbWVfaXNfYWxyZWFkeV9pbl9oZXJlJywge1xuXHRcdFx0XHRwb3N0UHJvY2VzczogJ3NwcmludGYnLFxuXHRcdFx0XHRzcHJpbnRmOiBbdXNlcm5hbWVdXG5cdFx0XHR9LCBjdXJyZW50VXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0pO1xuXHRpZiAodXNlcm5hbWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybjtcblx0fVxuXHR1c2Vycy5mb3JFYWNoKGZ1bmN0aW9uKHVzZXIpIHtcblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gTWV0ZW9yLmNhbGwoJ2FkZFVzZXJUb1Jvb20nLCB7XG5cdFx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHRcdHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lXG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoICh7ZXJyb3J9KSB7XG5cdFx0XHRpZiAoZXJyb3IgPT09ICdjYW50LWludml0ZS1mb3ItZGlyZWN0LXJvb20nKSB7XG5cdFx0XHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0XHRcdHRzOiBuZXcgRGF0ZSxcblx0XHRcdFx0XHRtc2c6IFRBUGkxOG4uX18oJ0Nhbm5vdF9pbnZpdGVfdXNlcnNfdG9fZGlyZWN0X3Jvb21zJywgbnVsbCwgY3VycmVudFVzZXIubGFuZ3VhZ2UpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHRcdFx0dHM6IG5ldyBEYXRlLFxuXHRcdFx0XHRcdG1zZzogVEFQaTE4bi5fXyhlcnJvciwgbnVsbCwgY3VycmVudFVzZXIubGFuZ3VhZ2UpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59XG5cblJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ2ludml0ZScsIEludml0ZSk7XG5cbmV4cG9ydCB7SW52aXRlfTtcbiJdfQ==
