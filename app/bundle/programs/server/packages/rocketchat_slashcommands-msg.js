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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-msg":{"server.js":function(){

////////////////////////////////////////////////////////////////////////////////////
//                                                                                //
// packages/rocketchat_slashcommands-msg/server.js                                //
//                                                                                //
////////////////////////////////////////////////////////////////////////////////////
                                                                                  //
/*
* Msg is a named function that will replace /msg commands
*/function Msg(command, params, item) {
	if (command !== 'msg' || !Match.test(params, String)) {
		return;
	}

	const trimmedParams = params.trim();
	const separator = trimmedParams.indexOf(' ');
	const user = Meteor.users.findOne(Meteor.userId());

	if (separator === -1) {
		return RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_and_message_must_not_be_empty', null, user.language)
		});
	}

	const message = trimmedParams.slice(separator + 1);
	const targetUsernameOrig = trimmedParams.slice(0, separator);
	const targetUsername = targetUsernameOrig.replace('@', '');
	const targetUser = RocketChat.models.Users.findOneByUsername(targetUsername);

	if (targetUser == null) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Username_doesnt_exist', {
				postProcess: 'sprintf',
				sprintf: [targetUsernameOrig]
			}, user.language)
		});
		return;
	}

	const {
		rid
	} = Meteor.call('createDirectMessage', targetUsername);
	const msgObject = {
		_id: Random.id(),
		rid,
		msg: message
	};
	Meteor.call('sendMessage', msgObject);
}

RocketChat.slashCommands.add('msg', Msg);
////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-msg/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-msg'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-msg.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLW1zZy9zZXJ2ZXIuanMiXSwibmFtZXMiOlsiTXNnIiwiY29tbWFuZCIsInBhcmFtcyIsIml0ZW0iLCJNYXRjaCIsInRlc3QiLCJTdHJpbmciLCJ0cmltbWVkUGFyYW1zIiwidHJpbSIsInNlcGFyYXRvciIsImluZGV4T2YiLCJ1c2VyIiwiTWV0ZW9yIiwidXNlcnMiLCJmaW5kT25lIiwidXNlcklkIiwiUm9ja2V0Q2hhdCIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlVc2VyIiwiX2lkIiwiUmFuZG9tIiwiaWQiLCJyaWQiLCJ0cyIsIkRhdGUiLCJtc2ciLCJUQVBpMThuIiwiX18iLCJsYW5ndWFnZSIsIm1lc3NhZ2UiLCJzbGljZSIsInRhcmdldFVzZXJuYW1lT3JpZyIsInRhcmdldFVzZXJuYW1lIiwicmVwbGFjZSIsInRhcmdldFVzZXIiLCJtb2RlbHMiLCJVc2VycyIsImZpbmRPbmVCeVVzZXJuYW1lIiwicG9zdFByb2Nlc3MiLCJzcHJpbnRmIiwiY2FsbCIsIm1zZ09iamVjdCIsInNsYXNoQ29tbWFuZHMiLCJhZGQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBOztFQUlBLFNBQVNBLEdBQVQsQ0FBYUMsT0FBYixFQUFzQkMsTUFBdEIsRUFBOEJDLElBQTlCLEVBQW9DO0FBQ25DLEtBQUlGLFlBQVksS0FBWixJQUFxQixDQUFDRyxNQUFNQyxJQUFOLENBQVdILE1BQVgsRUFBbUJJLE1BQW5CLENBQTFCLEVBQXNEO0FBQ3JEO0FBQ0E7O0FBQ0QsT0FBTUMsZ0JBQWdCTCxPQUFPTSxJQUFQLEVBQXRCO0FBQ0EsT0FBTUMsWUFBWUYsY0FBY0csT0FBZCxDQUFzQixHQUF0QixDQUFsQjtBQUNBLE9BQU1DLE9BQU9DLE9BQU9DLEtBQVAsQ0FBYUMsT0FBYixDQUFxQkYsT0FBT0csTUFBUCxFQUFyQixDQUFiOztBQUNBLEtBQUlOLGNBQWMsQ0FBQyxDQUFuQixFQUFzQjtBQUNyQixTQUFPTyxXQUFXQyxhQUFYLENBQXlCQyxVQUF6QixDQUFvQ04sT0FBT0csTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUN0RUksUUFBS0MsT0FBT0MsRUFBUCxFQURpRTtBQUV0RUMsUUFBS25CLEtBQUttQixHQUY0RDtBQUd0RUMsT0FBSSxJQUFJQyxJQUFKLEVBSGtFO0FBSXRFQyxRQUFLQyxRQUFRQyxFQUFSLENBQVcsd0NBQVgsRUFBcUQsSUFBckQsRUFBMkRoQixLQUFLaUIsUUFBaEU7QUFKaUUsR0FBaEUsQ0FBUDtBQU1BOztBQUNELE9BQU1DLFVBQVV0QixjQUFjdUIsS0FBZCxDQUFvQnJCLFlBQVksQ0FBaEMsQ0FBaEI7QUFDQSxPQUFNc0IscUJBQXFCeEIsY0FBY3VCLEtBQWQsQ0FBb0IsQ0FBcEIsRUFBdUJyQixTQUF2QixDQUEzQjtBQUNBLE9BQU11QixpQkFBaUJELG1CQUFtQkUsT0FBbkIsQ0FBMkIsR0FBM0IsRUFBZ0MsRUFBaEMsQ0FBdkI7QUFDQSxPQUFNQyxhQUFhbEIsV0FBV21CLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCQyxpQkFBeEIsQ0FBMENMLGNBQTFDLENBQW5COztBQUNBLEtBQUlFLGNBQWMsSUFBbEIsRUFBd0I7QUFDdkJsQixhQUFXQyxhQUFYLENBQXlCQyxVQUF6QixDQUFvQ04sT0FBT0csTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUMvREksUUFBS0MsT0FBT0MsRUFBUCxFQUQwRDtBQUUvREMsUUFBS25CLEtBQUttQixHQUZxRDtBQUcvREMsT0FBSSxJQUFJQyxJQUFKLEVBSDJEO0FBSS9EQyxRQUFLQyxRQUFRQyxFQUFSLENBQVcsdUJBQVgsRUFBb0M7QUFDeENXLGlCQUFhLFNBRDJCO0FBRXhDQyxhQUFTLENBQUNSLGtCQUFEO0FBRitCLElBQXBDLEVBR0ZwQixLQUFLaUIsUUFISDtBQUowRCxHQUFoRTtBQVNBO0FBQ0E7O0FBQ0QsT0FBTTtBQUFDTjtBQUFELEtBQVFWLE9BQU80QixJQUFQLENBQVkscUJBQVosRUFBbUNSLGNBQW5DLENBQWQ7QUFDQSxPQUFNUyxZQUFZO0FBQ2pCdEIsT0FBS0MsT0FBT0MsRUFBUCxFQURZO0FBRWpCQyxLQUZpQjtBQUdqQkcsT0FBS0k7QUFIWSxFQUFsQjtBQUtBakIsUUFBTzRCLElBQVAsQ0FBWSxhQUFaLEVBQTJCQyxTQUEzQjtBQUNBOztBQUVEekIsV0FBVzBCLGFBQVgsQ0FBeUJDLEdBQXpCLENBQTZCLEtBQTdCLEVBQW9DM0MsR0FBcEMsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zbGFzaGNvbW1hbmRzLW1zZy5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuLypcbiogTXNnIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlcGxhY2UgL21zZyBjb21tYW5kc1xuKi9cblxuZnVuY3Rpb24gTXNnKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXHRpZiAoY29tbWFuZCAhPT0gJ21zZycgfHwgIU1hdGNoLnRlc3QocGFyYW1zLCBTdHJpbmcpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGNvbnN0IHRyaW1tZWRQYXJhbXMgPSBwYXJhbXMudHJpbSgpO1xuXHRjb25zdCBzZXBhcmF0b3IgPSB0cmltbWVkUGFyYW1zLmluZGV4T2YoJyAnKTtcblx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKE1ldGVvci51c2VySWQoKSk7XG5cdGlmIChzZXBhcmF0b3IgPT09IC0xKSB7XG5cdFx0cmV0dXJuXHRSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5VXNlcihNZXRlb3IudXNlcklkKCksICdtZXNzYWdlJywge1xuXHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHR0czogbmV3IERhdGUsXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oJ1VzZXJuYW1lX2FuZF9tZXNzYWdlX211c3Rfbm90X2JlX2VtcHR5JywgbnVsbCwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0fVxuXHRjb25zdCBtZXNzYWdlID0gdHJpbW1lZFBhcmFtcy5zbGljZShzZXBhcmF0b3IgKyAxKTtcblx0Y29uc3QgdGFyZ2V0VXNlcm5hbWVPcmlnID0gdHJpbW1lZFBhcmFtcy5zbGljZSgwLCBzZXBhcmF0b3IpO1xuXHRjb25zdCB0YXJnZXRVc2VybmFtZSA9IHRhcmdldFVzZXJuYW1lT3JpZy5yZXBsYWNlKCdAJywgJycpO1xuXHRjb25zdCB0YXJnZXRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUodGFyZ2V0VXNlcm5hbWUpO1xuXHRpZiAodGFyZ2V0VXNlciA9PSBudWxsKSB7XG5cdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0dHM6IG5ldyBEYXRlLFxuXHRcdFx0bXNnOiBUQVBpMThuLl9fKCdVc2VybmFtZV9kb2VzbnRfZXhpc3QnLCB7XG5cdFx0XHRcdHBvc3RQcm9jZXNzOiAnc3ByaW50ZicsXG5cdFx0XHRcdHNwcmludGY6IFt0YXJnZXRVc2VybmFtZU9yaWddXG5cdFx0XHR9LCB1c2VyLmxhbmd1YWdlKVxuXHRcdH0pO1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCB7cmlkfSA9IE1ldGVvci5jYWxsKCdjcmVhdGVEaXJlY3RNZXNzYWdlJywgdGFyZ2V0VXNlcm5hbWUpO1xuXHRjb25zdCBtc2dPYmplY3QgPSB7XG5cdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRyaWQsXG5cdFx0bXNnOiBtZXNzYWdlXG5cdH07XG5cdE1ldGVvci5jYWxsKCdzZW5kTWVzc2FnZScsIG1zZ09iamVjdCk7XG59XG5cblJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ21zZycsIE1zZyk7XG4iXX0=
