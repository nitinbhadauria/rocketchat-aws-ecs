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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-archive":{"server":{"messages.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/rocketchat_slashcommands-archive/server/messages.js                          //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
RocketChat.models.Messages.createRoomArchivedByRoomIdAndUser = function (roomId, user) {
	return this.createWithTypeRoomIdMessageAndUser('room-archived', roomId, '', user);
};
///////////////////////////////////////////////////////////////////////////////////////////

},"server.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/rocketchat_slashcommands-archive/server/server.js                            //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
function Archive(command, params, item) {
	if (command !== 'archive' || !Match.test(params, String)) {
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

	if (room.archived) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Duplicate_archived_channel_name', {
				postProcess: 'sprintf',
				sprintf: [channel]
			}, user.language)
		});
		return;
	}

	Meteor.call('archiveRoom', room._id);
	RocketChat.models.Messages.createRoomArchivedByRoomIdAndUser(room._id, Meteor.user());
	RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
		_id: Random.id(),
		rid: item.rid,
		ts: new Date(),
		msg: TAPi18n.__('Channel_Archived', {
			postProcess: 'sprintf',
			sprintf: [channel]
		}, user.language)
	});
	return Archive;
}

RocketChat.slashCommands.add('archive', Archive);
///////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-archive/server/messages.js");
require("./node_modules/meteor/rocketchat:slashcommands-archive/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-archive'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-archive.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWFyY2hpdmUvc2VydmVyL21lc3NhZ2VzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnNsYXNoY29tbWFuZHMtYXJjaGl2ZS9zZXJ2ZXIvc2VydmVyLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJtb2RlbHMiLCJNZXNzYWdlcyIsImNyZWF0ZVJvb21BcmNoaXZlZEJ5Um9vbUlkQW5kVXNlciIsInJvb21JZCIsInVzZXIiLCJjcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyIiwiQXJjaGl2ZSIsImNvbW1hbmQiLCJwYXJhbXMiLCJpdGVtIiwiTWF0Y2giLCJ0ZXN0IiwiU3RyaW5nIiwiY2hhbm5lbCIsInRyaW0iLCJyb29tIiwiUm9vbXMiLCJmaW5kT25lQnlJZCIsInJpZCIsIm5hbWUiLCJyZXBsYWNlIiwiZmluZE9uZUJ5TmFtZSIsInQiLCJNZXRlb3IiLCJ1c2VycyIsImZpbmRPbmUiLCJ1c2VySWQiLCJhcmNoaXZlZCIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlVc2VyIiwiX2lkIiwiUmFuZG9tIiwiaWQiLCJ0cyIsIkRhdGUiLCJtc2ciLCJUQVBpMThuIiwiX18iLCJwb3N0UHJvY2VzcyIsInNwcmludGYiLCJsYW5ndWFnZSIsImNhbGwiLCJzbGFzaENvbW1hbmRzIiwiYWRkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsV0FBV0MsTUFBWCxDQUFrQkMsUUFBbEIsQ0FBMkJDLGlDQUEzQixHQUErRCxVQUFTQyxNQUFULEVBQWlCQyxJQUFqQixFQUF1QjtBQUNyRixRQUFPLEtBQUtDLGtDQUFMLENBQXdDLGVBQXhDLEVBQXlERixNQUF6RCxFQUFpRSxFQUFqRSxFQUFxRUMsSUFBckUsQ0FBUDtBQUNBLENBRkQsQzs7Ozs7Ozs7Ozs7QUNBQSxTQUFTRSxPQUFULENBQWlCQyxPQUFqQixFQUEwQkMsTUFBMUIsRUFBa0NDLElBQWxDLEVBQXdDO0FBQ3ZDLEtBQUlGLFlBQVksU0FBWixJQUF5QixDQUFDRyxNQUFNQyxJQUFOLENBQVdILE1BQVgsRUFBbUJJLE1BQW5CLENBQTlCLEVBQTBEO0FBQ3pEO0FBQ0E7O0FBRUQsS0FBSUMsVUFBVUwsT0FBT00sSUFBUCxFQUFkO0FBQ0EsS0FBSUMsSUFBSjs7QUFFQSxLQUFJRixZQUFZLEVBQWhCLEVBQW9CO0FBQ25CRSxTQUFPaEIsV0FBV0MsTUFBWCxDQUFrQmdCLEtBQWxCLENBQXdCQyxXQUF4QixDQUFvQ1IsS0FBS1MsR0FBekMsQ0FBUDtBQUNBTCxZQUFVRSxLQUFLSSxJQUFmO0FBQ0EsRUFIRCxNQUdPO0FBQ05OLFlBQVVBLFFBQVFPLE9BQVIsQ0FBZ0IsR0FBaEIsRUFBcUIsRUFBckIsQ0FBVjtBQUNBTCxTQUFPaEIsV0FBV0MsTUFBWCxDQUFrQmdCLEtBQWxCLENBQXdCSyxhQUF4QixDQUFzQ1IsT0FBdEMsQ0FBUDtBQUNBLEVBZHNDLENBZ0J2Qzs7O0FBQ0EsS0FBSUUsS0FBS08sQ0FBTCxLQUFXLEdBQWYsRUFBb0I7QUFDbkI7QUFDQTs7QUFFRCxPQUFNbEIsT0FBT21CLE9BQU9DLEtBQVAsQ0FBYUMsT0FBYixDQUFxQkYsT0FBT0csTUFBUCxFQUFyQixDQUFiOztBQUVBLEtBQUlYLEtBQUtZLFFBQVQsRUFBbUI7QUFDbEI1QixhQUFXNkIsYUFBWCxDQUF5QkMsVUFBekIsQ0FBb0NOLE9BQU9HLE1BQVAsRUFBcEMsRUFBcUQsU0FBckQsRUFBZ0U7QUFDL0RJLFFBQUtDLE9BQU9DLEVBQVAsRUFEMEQ7QUFFL0RkLFFBQUtULEtBQUtTLEdBRnFEO0FBRy9EZSxPQUFJLElBQUlDLElBQUosRUFIMkQ7QUFJL0RDLFFBQUtDLFFBQVFDLEVBQVIsQ0FBVyxpQ0FBWCxFQUE4QztBQUNsREMsaUJBQWEsU0FEcUM7QUFFbERDLGFBQVMsQ0FBQzFCLE9BQUQ7QUFGeUMsSUFBOUMsRUFHRlQsS0FBS29DLFFBSEg7QUFKMEQsR0FBaEU7QUFTQTtBQUNBOztBQUNEakIsUUFBT2tCLElBQVAsQ0FBWSxhQUFaLEVBQTJCMUIsS0FBS2UsR0FBaEM7QUFFQS9CLFlBQVdDLE1BQVgsQ0FBa0JDLFFBQWxCLENBQTJCQyxpQ0FBM0IsQ0FBNkRhLEtBQUtlLEdBQWxFLEVBQXVFUCxPQUFPbkIsSUFBUCxFQUF2RTtBQUNBTCxZQUFXNkIsYUFBWCxDQUF5QkMsVUFBekIsQ0FBb0NOLE9BQU9HLE1BQVAsRUFBcEMsRUFBcUQsU0FBckQsRUFBZ0U7QUFDL0RJLE9BQUtDLE9BQU9DLEVBQVAsRUFEMEQ7QUFFL0RkLE9BQUtULEtBQUtTLEdBRnFEO0FBRy9EZSxNQUFJLElBQUlDLElBQUosRUFIMkQ7QUFJL0RDLE9BQUtDLFFBQVFDLEVBQVIsQ0FBVyxrQkFBWCxFQUErQjtBQUNuQ0MsZ0JBQWEsU0FEc0I7QUFFbkNDLFlBQVMsQ0FBQzFCLE9BQUQ7QUFGMEIsR0FBL0IsRUFHRlQsS0FBS29DLFFBSEg7QUFKMEQsRUFBaEU7QUFVQSxRQUFPbEMsT0FBUDtBQUNBOztBQUVEUCxXQUFXMkMsYUFBWCxDQUF5QkMsR0FBekIsQ0FBNkIsU0FBN0IsRUFBd0NyQyxPQUF4QyxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3NsYXNoY29tbWFuZHMtYXJjaGl2ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIlJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVJvb21BcmNoaXZlZEJ5Um9vbUlkQW5kVXNlciA9IGZ1bmN0aW9uKHJvb21JZCwgdXNlcikge1xuXHRyZXR1cm4gdGhpcy5jcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyKCdyb29tLWFyY2hpdmVkJywgcm9vbUlkLCAnJywgdXNlcik7XG59O1xuIiwiZnVuY3Rpb24gQXJjaGl2ZShjb21tYW5kLCBwYXJhbXMsIGl0ZW0pIHtcblx0aWYgKGNvbW1hbmQgIT09ICdhcmNoaXZlJyB8fCAhTWF0Y2gudGVzdChwYXJhbXMsIFN0cmluZykpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRsZXQgY2hhbm5lbCA9IHBhcmFtcy50cmltKCk7XG5cdGxldCByb29tO1xuXG5cdGlmIChjaGFubmVsID09PSAnJykge1xuXHRcdHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpdGVtLnJpZCk7XG5cdFx0Y2hhbm5lbCA9IHJvb20ubmFtZTtcblx0fSBlbHNlIHtcblx0XHRjaGFubmVsID0gY2hhbm5lbC5yZXBsYWNlKCcjJywgJycpO1xuXHRcdHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKGNoYW5uZWwpO1xuXHR9XG5cblx0Ly8gWW91IGNhbiBub3QgYXJjaGl2ZSBkaXJlY3QgbWVzc2FnZXMuXG5cdGlmIChyb29tLnQgPT09ICdkJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZShNZXRlb3IudXNlcklkKCkpO1xuXG5cdGlmIChyb29tLmFyY2hpdmVkKSB7XG5cdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oJ0R1cGxpY2F0ZV9hcmNoaXZlZF9jaGFubmVsX25hbWUnLCB7XG5cdFx0XHRcdHBvc3RQcm9jZXNzOiAnc3ByaW50ZicsXG5cdFx0XHRcdHNwcmludGY6IFtjaGFubmVsXVxuXHRcdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0XHRyZXR1cm47XG5cdH1cblx0TWV0ZW9yLmNhbGwoJ2FyY2hpdmVSb29tJywgcm9vbS5faWQpO1xuXG5cdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVJvb21BcmNoaXZlZEJ5Um9vbUlkQW5kVXNlcihyb29tLl9pZCwgTWV0ZW9yLnVzZXIoKSk7XG5cdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlVc2VyKE1ldGVvci51c2VySWQoKSwgJ21lc3NhZ2UnLCB7XG5cdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdG1zZzogVEFQaTE4bi5fXygnQ2hhbm5lbF9BcmNoaXZlZCcsIHtcblx0XHRcdHBvc3RQcm9jZXNzOiAnc3ByaW50ZicsXG5cdFx0XHRzcHJpbnRmOiBbY2hhbm5lbF1cblx0XHR9LCB1c2VyLmxhbmd1YWdlKVxuXHR9KTtcblxuXHRyZXR1cm4gQXJjaGl2ZTtcbn1cblxuUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgnYXJjaGl2ZScsIEFyY2hpdmUpO1xuIl19
