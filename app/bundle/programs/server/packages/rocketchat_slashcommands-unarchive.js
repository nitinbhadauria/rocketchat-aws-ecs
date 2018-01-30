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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-unarchive":{"server":{"messages.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/rocketchat_slashcommands-unarchive/server/messages.js                          //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
RocketChat.models.Messages.createRoomUnarchivedByRoomIdAndUser = function (roomId, user) {
	return this.createWithTypeRoomIdMessageAndUser('room-unarchived', roomId, '', user);
};
/////////////////////////////////////////////////////////////////////////////////////////////

},"server.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/rocketchat_slashcommands-unarchive/server/server.js                            //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
function Unarchive(command, params, item) {
	if (command !== 'unarchive' || !Match.test(params, String)) {
		return;
	}

	let channel = params.trim();
	let room;

	if (channel === '') {
		room = RocketChat.models.Rooms.findOneById(item.rid);
		channel = room.name;
	} else {
		channel = channel.replace('#', '');
		room = RocketChat.models.Rooms.findOneByName(channel);
	} // You can not archive direct messages.


	if (room.t === 'd') {
		return;
	}

	const user = Meteor.users.findOne(Meteor.userId());

	if (!room.archived) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Channel_already_Unarchived', {
				postProcess: 'sprintf',
				sprintf: [channel]
			}, user.language)
		});
		return;
	}

	Meteor.call('unarchiveRoom', room._id);
	RocketChat.models.Messages.createRoomUnarchivedByRoomIdAndUser(room._id, Meteor.user());
	RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
		_id: Random.id(),
		rid: item.rid,
		ts: new Date(),
		msg: TAPi18n.__('Channel_Unarchived', {
			postProcess: 'sprintf',
			sprintf: [channel]
		}, user.language)
	});
	return Unarchive;
}

RocketChat.slashCommands.add('unarchive', Unarchive);
/////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-unarchive/server/messages.js");
require("./node_modules/meteor/rocketchat:slashcommands-unarchive/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-unarchive'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-unarchive.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLXVuYXJjaGl2ZS9zZXJ2ZXIvbWVzc2FnZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c2xhc2hjb21tYW5kcy11bmFyY2hpdmUvc2VydmVyL3NlcnZlci5qcyJdLCJuYW1lcyI6WyJSb2NrZXRDaGF0IiwibW9kZWxzIiwiTWVzc2FnZXMiLCJjcmVhdGVSb29tVW5hcmNoaXZlZEJ5Um9vbUlkQW5kVXNlciIsInJvb21JZCIsInVzZXIiLCJjcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyIiwiVW5hcmNoaXZlIiwiY29tbWFuZCIsInBhcmFtcyIsIml0ZW0iLCJNYXRjaCIsInRlc3QiLCJTdHJpbmciLCJjaGFubmVsIiwidHJpbSIsInJvb20iLCJSb29tcyIsImZpbmRPbmVCeUlkIiwicmlkIiwibmFtZSIsInJlcGxhY2UiLCJmaW5kT25lQnlOYW1lIiwidCIsIk1ldGVvciIsInVzZXJzIiwiZmluZE9uZSIsInVzZXJJZCIsImFyY2hpdmVkIiwiTm90aWZpY2F0aW9ucyIsIm5vdGlmeVVzZXIiLCJfaWQiLCJSYW5kb20iLCJpZCIsInRzIiwiRGF0ZSIsIm1zZyIsIlRBUGkxOG4iLCJfXyIsInBvc3RQcm9jZXNzIiwic3ByaW50ZiIsImxhbmd1YWdlIiwiY2FsbCIsInNsYXNoQ29tbWFuZHMiLCJhZGQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxXQUFXQyxNQUFYLENBQWtCQyxRQUFsQixDQUEyQkMsbUNBQTNCLEdBQWlFLFVBQVNDLE1BQVQsRUFBaUJDLElBQWpCLEVBQXVCO0FBQ3ZGLFFBQU8sS0FBS0Msa0NBQUwsQ0FBd0MsaUJBQXhDLEVBQTJERixNQUEzRCxFQUFtRSxFQUFuRSxFQUF1RUMsSUFBdkUsQ0FBUDtBQUNBLENBRkQsQzs7Ozs7Ozs7Ozs7QUNBQSxTQUFTRSxTQUFULENBQW1CQyxPQUFuQixFQUE0QkMsTUFBNUIsRUFBb0NDLElBQXBDLEVBQTBDO0FBQ3pDLEtBQUlGLFlBQVksV0FBWixJQUEyQixDQUFDRyxNQUFNQyxJQUFOLENBQVdILE1BQVgsRUFBbUJJLE1BQW5CLENBQWhDLEVBQTREO0FBQzNEO0FBQ0E7O0FBRUQsS0FBSUMsVUFBVUwsT0FBT00sSUFBUCxFQUFkO0FBQ0EsS0FBSUMsSUFBSjs7QUFFQSxLQUFJRixZQUFZLEVBQWhCLEVBQW9CO0FBQ25CRSxTQUFPaEIsV0FBV0MsTUFBWCxDQUFrQmdCLEtBQWxCLENBQXdCQyxXQUF4QixDQUFvQ1IsS0FBS1MsR0FBekMsQ0FBUDtBQUNBTCxZQUFVRSxLQUFLSSxJQUFmO0FBQ0EsRUFIRCxNQUdPO0FBQ05OLFlBQVVBLFFBQVFPLE9BQVIsQ0FBZ0IsR0FBaEIsRUFBcUIsRUFBckIsQ0FBVjtBQUNBTCxTQUFPaEIsV0FBV0MsTUFBWCxDQUFrQmdCLEtBQWxCLENBQXdCSyxhQUF4QixDQUFzQ1IsT0FBdEMsQ0FBUDtBQUNBLEVBZHdDLENBZ0J6Qzs7O0FBQ0EsS0FBSUUsS0FBS08sQ0FBTCxLQUFXLEdBQWYsRUFBb0I7QUFDbkI7QUFDQTs7QUFFRCxPQUFNbEIsT0FBT21CLE9BQU9DLEtBQVAsQ0FBYUMsT0FBYixDQUFxQkYsT0FBT0csTUFBUCxFQUFyQixDQUFiOztBQUVBLEtBQUksQ0FBQ1gsS0FBS1ksUUFBVixFQUFvQjtBQUNuQjVCLGFBQVc2QixhQUFYLENBQXlCQyxVQUF6QixDQUFvQ04sT0FBT0csTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUMvREksUUFBS0MsT0FBT0MsRUFBUCxFQUQwRDtBQUUvRGQsUUFBS1QsS0FBS1MsR0FGcUQ7QUFHL0RlLE9BQUksSUFBSUMsSUFBSixFQUgyRDtBQUkvREMsUUFBS0MsUUFBUUMsRUFBUixDQUFXLDRCQUFYLEVBQXlDO0FBQzdDQyxpQkFBYSxTQURnQztBQUU3Q0MsYUFBUyxDQUFDMUIsT0FBRDtBQUZvQyxJQUF6QyxFQUdGVCxLQUFLb0MsUUFISDtBQUowRCxHQUFoRTtBQVNBO0FBQ0E7O0FBRURqQixRQUFPa0IsSUFBUCxDQUFZLGVBQVosRUFBNkIxQixLQUFLZSxHQUFsQztBQUVBL0IsWUFBV0MsTUFBWCxDQUFrQkMsUUFBbEIsQ0FBMkJDLG1DQUEzQixDQUErRGEsS0FBS2UsR0FBcEUsRUFBeUVQLE9BQU9uQixJQUFQLEVBQXpFO0FBQ0FMLFlBQVc2QixhQUFYLENBQXlCQyxVQUF6QixDQUFvQ04sT0FBT0csTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUMvREksT0FBS0MsT0FBT0MsRUFBUCxFQUQwRDtBQUUvRGQsT0FBS1QsS0FBS1MsR0FGcUQ7QUFHL0RlLE1BQUksSUFBSUMsSUFBSixFQUgyRDtBQUkvREMsT0FBS0MsUUFBUUMsRUFBUixDQUFXLG9CQUFYLEVBQWlDO0FBQ3JDQyxnQkFBYSxTQUR3QjtBQUVyQ0MsWUFBUyxDQUFDMUIsT0FBRDtBQUY0QixHQUFqQyxFQUdGVCxLQUFLb0MsUUFISDtBQUowRCxFQUFoRTtBQVVBLFFBQU9sQyxTQUFQO0FBQ0E7O0FBRURQLFdBQVcyQyxhQUFYLENBQXlCQyxHQUF6QixDQUE2QixXQUE3QixFQUEwQ3JDLFNBQTFDLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfc2xhc2hjb21tYW5kcy11bmFyY2hpdmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVSb29tVW5hcmNoaXZlZEJ5Um9vbUlkQW5kVXNlciA9IGZ1bmN0aW9uKHJvb21JZCwgdXNlcikge1xuXHRyZXR1cm4gdGhpcy5jcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyKCdyb29tLXVuYXJjaGl2ZWQnLCByb29tSWQsICcnLCB1c2VyKTtcbn07XG4iLCJmdW5jdGlvbiBVbmFyY2hpdmUoY29tbWFuZCwgcGFyYW1zLCBpdGVtKSB7XG5cdGlmIChjb21tYW5kICE9PSAndW5hcmNoaXZlJyB8fCAhTWF0Y2gudGVzdChwYXJhbXMsIFN0cmluZykpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRsZXQgY2hhbm5lbCA9IHBhcmFtcy50cmltKCk7XG5cdGxldCByb29tO1xuXG5cdGlmIChjaGFubmVsID09PSAnJykge1xuXHRcdHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpdGVtLnJpZCk7XG5cdFx0Y2hhbm5lbCA9IHJvb20ubmFtZTtcblx0fSBlbHNlIHtcblx0XHRjaGFubmVsID0gY2hhbm5lbC5yZXBsYWNlKCcjJywgJycpO1xuXHRcdHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKGNoYW5uZWwpO1xuXHR9XG5cblx0Ly8gWW91IGNhbiBub3QgYXJjaGl2ZSBkaXJlY3QgbWVzc2FnZXMuXG5cdGlmIChyb29tLnQgPT09ICdkJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZShNZXRlb3IudXNlcklkKCkpO1xuXG5cdGlmICghcm9vbS5hcmNoaXZlZCkge1xuXHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0bXNnOiBUQVBpMThuLl9fKCdDaGFubmVsX2FscmVhZHlfVW5hcmNoaXZlZCcsIHtcblx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0c3ByaW50ZjogW2NoYW5uZWxdXG5cdFx0XHR9LCB1c2VyLmxhbmd1YWdlKVxuXHRcdH0pO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdE1ldGVvci5jYWxsKCd1bmFyY2hpdmVSb29tJywgcm9vbS5faWQpO1xuXG5cdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVJvb21VbmFyY2hpdmVkQnlSb29tSWRBbmRVc2VyKHJvb20uX2lkLCBNZXRlb3IudXNlcigpKTtcblx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0bXNnOiBUQVBpMThuLl9fKCdDaGFubmVsX1VuYXJjaGl2ZWQnLCB7XG5cdFx0XHRwb3N0UHJvY2VzczogJ3NwcmludGYnLFxuXHRcdFx0c3ByaW50ZjogW2NoYW5uZWxdXG5cdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0fSk7XG5cblx0cmV0dXJuIFVuYXJjaGl2ZTtcbn1cblxuUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgndW5hcmNoaXZlJywgVW5hcmNoaXZlKTtcbiJdfQ==
