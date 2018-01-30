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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-mute":{"server":{"mute.js":function(){

////////////////////////////////////////////////////////////////////////////////////
//                                                                                //
// packages/rocketchat_slashcommands-mute/server/mute.js                          //
//                                                                                //
////////////////////////////////////////////////////////////////////////////////////
                                                                                  //
/*
* Mute is a named function that will replace /mute commands
*/RocketChat.slashCommands.add('mute', function Mute(command, params, item) {
	if (command !== 'mute' || !Match.test(params, String)) {
		return;
	}

	const username = params.trim().replace('@', '');

	if (username === '') {
		return;
	}

	const user = Meteor.users.findOne(Meteor.userId());
	const mutedUser = RocketChat.models.Users.findOneByUsername(username);
	const room = RocketChat.models.Rooms.findOneById(item.rid);

	if (mutedUser == null) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_doesnt_exist', {
				postProcess: 'sprintf',
				sprintf: [username]
			}, user.language)
		});
		return;
	}

	if ((room.usernames || []).includes(username) === false) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_is_not_in_this_room', {
				postProcess: 'sprintf',
				sprintf: [username]
			}, user.language)
		});
		return;
	}

	Meteor.call('muteUserInRoom', {
		rid: item.rid,
		username
	});
});
////////////////////////////////////////////////////////////////////////////////////

},"unmute.js":function(){

////////////////////////////////////////////////////////////////////////////////////
//                                                                                //
// packages/rocketchat_slashcommands-mute/server/unmute.js                        //
//                                                                                //
////////////////////////////////////////////////////////////////////////////////////
                                                                                  //
/*
* Unmute is a named function that will replace /unmute commands
*/RocketChat.slashCommands.add('unmute', function Unmute(command, params, item) {
	if (command !== 'unmute' || !Match.test(params, String)) {
		return;
	}

	const username = params.trim().replace('@', '');

	if (username === '') {
		return;
	}

	const user = Meteor.users.findOne(Meteor.userId());
	const unmutedUser = RocketChat.models.Users.findOneByUsername(username);
	const room = RocketChat.models.Rooms.findOneById(item.rid);

	if (unmutedUser == null) {
		return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_doesnt_exist', {
				postProcess: 'sprintf',
				sprintf: [username]
			}, user.language)
		});
	}

	if ((room.usernames || []).includes(username) === false) {
		return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_is_not_in_this_room', {
				postProcess: 'sprintf',
				sprintf: [username]
			}, user.language)
		});
	}

	Meteor.call('unmuteUserInRoom', {
		rid: item.rid,
		username
	});
});
////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-mute/server/mute.js");
require("./node_modules/meteor/rocketchat:slashcommands-mute/server/unmute.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-mute'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-mute.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLW11dGUvc2VydmVyL211dGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c2xhc2hjb21tYW5kcy1tdXRlL3NlcnZlci91bm11dGUuanMiXSwibmFtZXMiOlsiUm9ja2V0Q2hhdCIsInNsYXNoQ29tbWFuZHMiLCJhZGQiLCJNdXRlIiwiY29tbWFuZCIsInBhcmFtcyIsIml0ZW0iLCJNYXRjaCIsInRlc3QiLCJTdHJpbmciLCJ1c2VybmFtZSIsInRyaW0iLCJyZXBsYWNlIiwidXNlciIsIk1ldGVvciIsInVzZXJzIiwiZmluZE9uZSIsInVzZXJJZCIsIm11dGVkVXNlciIsIm1vZGVscyIsIlVzZXJzIiwiZmluZE9uZUJ5VXNlcm5hbWUiLCJyb29tIiwiUm9vbXMiLCJmaW5kT25lQnlJZCIsInJpZCIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlVc2VyIiwiX2lkIiwiUmFuZG9tIiwiaWQiLCJ0cyIsIkRhdGUiLCJtc2ciLCJUQVBpMThuIiwiX18iLCJwb3N0UHJvY2VzcyIsInNwcmludGYiLCJsYW5ndWFnZSIsInVzZXJuYW1lcyIsImluY2x1ZGVzIiwiY2FsbCIsIlVubXV0ZSIsInVubXV0ZWRVc2VyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQTs7RUFJQUEsV0FBV0MsYUFBWCxDQUF5QkMsR0FBekIsQ0FBNkIsTUFBN0IsRUFBcUMsU0FBU0MsSUFBVCxDQUFjQyxPQUFkLEVBQXVCQyxNQUF2QixFQUErQkMsSUFBL0IsRUFBcUM7QUFDekUsS0FBSUYsWUFBWSxNQUFaLElBQXNCLENBQUNHLE1BQU1DLElBQU4sQ0FBV0gsTUFBWCxFQUFtQkksTUFBbkIsQ0FBM0IsRUFBdUQ7QUFDdEQ7QUFDQTs7QUFDRCxPQUFNQyxXQUFXTCxPQUFPTSxJQUFQLEdBQWNDLE9BQWQsQ0FBc0IsR0FBdEIsRUFBMkIsRUFBM0Is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R3RFTSxPQUFJLElBQUlDLElBQUosRUFIa0U7QUFJdEVDLFFBQUtDLFFBQVFDLEVBQVIsQ0FBVyx1QkFBWCxFQUFvQztBQUN4Q0MsaUJBQWEsU0FEMkI7QUFFeENDLGFBQVMsQ0FBQzNCLFFBQUQ7QUFGK0IsSUFBcEMsRUFHRkcsS0FBS3lCLFFBSEg7QUFKaUUsR0FBaEUsQ0FBUDtBQVNBOztBQUNELEtBQUksQ0FBQ2hCLEtBQUtpQixTQUFMLElBQWtCLEVBQW5CLEVBQXVCQyxRQUF2QixDQUFnQzlCLFFBQWhDLE1BQThDLEtBQWxELEVBQXlEO0FBQ3hELFNBQU9WLFdBQVcwQixhQUFYLENBQXlCQyxVQUF6QixDQUFvQ2IsT0FBT0csTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUN0RVcsUUFBS0MsT0FBT0MsRUFBUCxFQURpRTtBQUV0RUwsUUFBS25CLEtBQUttQixHQUY0RDtBQUd0RU0sT0FBSSxJQUFJQyxJQUFKLEVBSGtFO0FBSXRFQyxRQUFLQyxRQUFRQyxFQUFSLENBQVcsOEJBQVgsRUFBMkM7QUFDL0NDLGlCQUFhLFNBRGtDO0FBRS9DQyxhQUFTLENBQUMzQixRQUFEO0FBRnNDLElBQTNDLEVBR0ZHLEtBQUt5QixRQUhIO0FBSmlFLEdBQWhFLENBQVA7QUFTQTs7QUFDRHhCLFFBQU8yQixJQUFQLENBQVksa0JBQVosRUFBZ0M7QUFDL0JoQixPQUFLbkIsS0FBS21CLEdBRHFCO0FBRS9CZjtBQUYrQixFQUFoQztBQUlBLENBdENELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfc2xhc2hjb21tYW5kcy1tdXRlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG4vKlxuKiBNdXRlIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlcGxhY2UgL211dGUgY29tbWFuZHNcbiovXG5cblJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ211dGUnLCBmdW5jdGlvbiBNdXRlKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXHRpZiAoY29tbWFuZCAhPT0gJ211dGUnIHx8ICFNYXRjaC50ZXN0KHBhcmFtcywgU3RyaW5nKSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCB1c2VybmFtZSA9IHBhcmFtcy50cmltKCkucmVwbGFjZSgnQCcsICcnKTtcblx0aWYgKHVzZXJuYW1lID09PSAnJykge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCB1c2VyID0gTWV0ZW9yLnVzZXJzLmZpbmRPbmUoTWV0ZW9yLnVzZXJJZCgpKTtcblx0Y29uc3QgbXV0ZWRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUodXNlcm5hbWUpO1xuXHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoaXRlbS5yaWQpO1xuXHRpZiAobXV0ZWRVc2VyID09IG51bGwpIHtcblx0XHRSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5VXNlcihNZXRlb3IudXNlcklkKCksICdtZXNzYWdlJywge1xuXHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHR0czogbmV3IERhdGUsXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oJ1VzZXJuYW1lX2RvZXNudF9leGlzdCcsIHtcblx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0c3ByaW50ZjogW3VzZXJuYW1lXVxuXHRcdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKChyb29tLnVzZXJuYW1lcyB8fCBbXSkuaW5jbHVkZXModXNlcm5hbWUpID09PSBmYWxzZSkge1xuXHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdHRzOiBuZXcgRGF0ZSxcblx0XHRcdG1zZzogVEFQaTE4bi5fXygnVXNlcm5hbWVfaXNfbm90X2luX3RoaXNfcm9vbScsIHtcblx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0c3ByaW50ZjogW3VzZXJuYW1lXVxuXHRcdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0XHRyZXR1cm47XG5cdH1cblx0TWV0ZW9yLmNhbGwoJ211dGVVc2VySW5Sb29tJywge1xuXHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0dXNlcm5hbWVcblx0fSk7XG59KTtcbiIsIlxuLypcbiogVW5tdXRlIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlcGxhY2UgL3VubXV0ZSBjb21tYW5kc1xuKi9cblxuUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgndW5tdXRlJywgZnVuY3Rpb24gVW5tdXRlKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXG5cdGlmIChjb21tYW5kICE9PSAndW5tdXRlJyB8fCAhTWF0Y2gudGVzdChwYXJhbXMsIFN0cmluZykpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgdXNlcm5hbWUgPSBwYXJhbXMudHJpbSgpLnJlcGxhY2UoJ0AnLCAnJyk7XG5cdGlmICh1c2VybmFtZSA9PT0gJycpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKE1ldGVvci51c2VySWQoKSk7XG5cdGNvbnN0IHVubXV0ZWRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUodXNlcm5hbWUpO1xuXHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoaXRlbS5yaWQpO1xuXHRpZiAodW5tdXRlZFVzZXIgPT0gbnVsbCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5VXNlcihNZXRlb3IudXNlcklkKCksICdtZXNzYWdlJywge1xuXHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHR0czogbmV3IERhdGUsXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oJ1VzZXJuYW1lX2RvZXNudF9leGlzdCcsIHtcblx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0c3ByaW50ZjogW3VzZXJuYW1lXVxuXHRcdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0fVxuXHRpZiAoKHJvb20udXNlcm5hbWVzIHx8IFtdKS5pbmNsdWRlcyh1c2VybmFtZSkgPT09IGZhbHNlKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdHRzOiBuZXcgRGF0ZSxcblx0XHRcdG1zZzogVEFQaTE4bi5fXygnVXNlcm5hbWVfaXNfbm90X2luX3RoaXNfcm9vbScsIHtcblx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0c3ByaW50ZjogW3VzZXJuYW1lXVxuXHRcdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0fVxuXHRNZXRlb3IuY2FsbCgndW5tdXRlVXNlckluUm9vbScsIHtcblx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdHVzZXJuYW1lXG5cdH0pO1xufSk7XG4iXX0=
