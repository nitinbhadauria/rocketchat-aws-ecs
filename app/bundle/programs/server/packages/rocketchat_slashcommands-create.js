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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-create":{"server":{"server.js":function(){

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// packages/rocketchat_slashcommands-create/server/server.js                  //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////
                                                                              //
function Create(command, params, item) {
	function getParams(str) {
		const regex = /(--(\w+))+/g;
		const result = [];
		let m;

		while ((m = regex.exec(str)) !== null) {
			if (m.index === regex.lastIndex) {
				regex.lastIndex++;
			}

			result.push(m[2]);
		}

		return result;
	}

	const regexp = new RegExp(RocketChat.settings.get('UTF8_Names_Validation'));

	if (command !== 'create' || !Match.test(params, String)) {
		return;
	}

	let channel = regexp.exec(params.trim());
	channel = channel ? channel[0] : '';

	if (channel === '') {
		return;
	}

	const user = Meteor.users.findOne(Meteor.userId());
	const room = RocketChat.models.Rooms.findOneByName(channel);

	if (room != null) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__('Channel_already_exist', {
				postProcess: 'sprintf',
				sprintf: [channel]
			}, user.language)
		});
		return;
	}

	if (getParams(params).indexOf('private') > -1) {
		return Meteor.call('createPrivateGroup', channel, []);
	}

	Meteor.call('createChannel', channel, []);
}

RocketChat.slashCommands.add('create', Create);
////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-create/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-create'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-create.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWNyZWF0ZS9zZXJ2ZXIvc2VydmVyLmpzIl0sIm5hbWVzIjpbIkNyZWF0ZSIsImNvbW1hbmQiLCJwYXJhbXMiLCJpdGVtIiwiZ2V0UGFyYW1zIiwic3RyIiwicmVnZXgiLCJyZXN1bHQiLCJtIiwiZXhlYyIsImluZGV4IiwibGFzdEluZGV4IiwicHVzaCIsInJlZ2V4cCIsIlJlZ0V4cCIsIlJvY2tldENoYXQiLCJzZXR0aW5ncyIsImdldCIsIk1hdGNoIiwidGVzdCIsIlN0cmluZyIsImNoYW5uZWwiLCJ0cmltIiwidXNlciIsIk1ldGVvciIsInVzZXJzIiwiZmluZE9uZSIsInVzZXJJZCIsInJvb20iLCJtb2RlbHMiLCJSb29tcyIsImZpbmRPbmVCeU5hbWUiLCJOb3RpZmljYXRpb25zIiwibm90aWZ5VXNlciIsIl9pZCIsIlJhbmRvbSIsImlkIiwicmlkIiwidHMiLCJEYXRlIiwibXNnIiwiVEFQaTE4biIsIl9fIiwicG9zdFByb2Nlc3MiLCJzcHJpbnRmIiwibGFuZ3VhZ2UiLCJpbmRleE9mIiwiY2FsbCIsInNsYXNoQ29tbWFuZHMiLCJhZGQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLFNBQVNBLE1BQVQsQ0FBZ0JDLE9BQWhCLEVBQXlCQyxNQUF6QixFQUFpQ0MsSUFBakMsRUFBdUM7QUFDdEMsVUFBU0MsU0FBVCxDQUFtQkMsR0FBbkIsRUFBd0I7QUFDdkIsUUFBTUMsUUFBUSxhQUFkO0FBQ0EsUUFBTUMsU0FBUyxFQUFmO0FBQ0EsTUFBSUMsQ0FBSjs7QUFDQSxTQUFPLENBQUNBLElBQUlGLE1BQU1HLElBQU4sQ0FBV0osR0FBWCxDQUFMLE1BQTBCLElBQWpDLEVBQXVDO0FBQ3RDLE9BQUlHLEVBQUVFLEtBQUYsS0FBWUosTUFBTUssU0FBdEIsRUFBaUM7QUFDaENMLFVBQU1LLFNBQU47QUFDQTs7QUFDREosVUFBT0ssSUFBUCxDQUFZSixFQUFFLENBQUYsQ0FBWjtBQUNBOztBQUNELFNBQU9ELE1BQVA7QUFDQTs7QUFFRCxPQUFNTSxTQUFTLElBQUlDLE1BQUosQ0FBV0MsV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsdUJBQXhCLENBQVgsQ0FBZjs7QUFFQSxLQUFJaEIsWUFBWSxRQUFaLElBQXdCLENBQUNpQixNQUFNQyxJQUFOLENBQVdqQixNQUFYLEVBQW1Ca0IsTUFBbkIsQ0FBN0IsRUFBeUQ7QUFDeEQ7QUFDQTs7QUFDRCxLQUFJQyxVQUFVUixPQUFPSixJQUFQLENBQVlQLE9BQU9vQixJQUFQLEVBQVosQ0FBZDtBQUNBRCxXQUFVQSxVQUFVQSxRQUFRLENBQVIsQ0FBVixHQUF1QixFQUFqQzs7QUFDQSxLQUFJQSxZQUFZLEVBQWhCLEVBQW9CO0FBQ25CO0FBQ0E7O0FBRUQsT0FBTUUsT0FBT0MsT0FBT0MsS0FBUCxDQUFhQyxPQUFiLENBQXFCRixPQUFPRyxNQUFQLEVBQXJCLENBQWI7QUFDQSxPQUFNQyxPQUFPYixXQUFXYyxNQUFYLENBQWtCQyxLQUFsQixDQUF3QkMsYUFBeEIsQ0FBc0NWLE9BQXRDLENBQWI7O0FBQ0EsS0FBSU8sUUFBUSxJQUFaLEVBQWtCO0FBQ2pCYixhQUFXaUIsYUFBWCxDQUF5QkMsVUFBekIsQ0FBb0NULE9BQU9HLE1BQVAsRUFBcEMsRUFBcUQsU0FBckQsRUFBZ0U7QUFDL0RPLFFBQUtDLE9BQU9DLEVBQVAsRUFEMEQ7QUFFL0RDLFFBQUtsQyxLQUFLa0MsR0FGcUQ7QUFHL0RDLE9BQUksSUFBSUMsSUFBSixFQUgyRDtBQUkvREMsUUFBS0MsUUFBUUMsRUFBUixDQUFXLHVCQUFYLEVBQW9DO0FBQ3hDQyxpQkFBYSxTQUQyQjtBQUV4Q0MsYUFBUyxDQUFDdkIsT0FBRDtBQUYrQixJQUFwQyxFQUdGRSxLQUFLc0IsUUFISDtBQUowRCxHQUFoRTtBQVNBO0FBQ0E7O0FBRUQsS0FBSXpDLFVBQVVGLE1BQVYsRUFBa0I0QyxPQUFsQixDQUEwQixTQUExQixJQUF1QyxDQUFDLENBQTVDLEVBQStDO0FBQzlDLFNBQU90QixPQUFPdUIsSUFBUCxDQUFZLG9CQUFaLEVBQWtDMUIsT0FBbEMsRUFBMkMsRUFBM0MsQ0FBUDtBQUNBOztBQUVERyxRQUFPdUIsSUFBUCxDQUFZLGVBQVosRUFBNkIxQixPQUE3QixFQUFzQyxFQUF0QztBQUNBOztBQUVETixXQUFXaUMsYUFBWCxDQUF5QkMsR0FBekIsQ0FBNkIsUUFBN0IsRUFBdUNqRCxNQUF2QyxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3NsYXNoY29tbWFuZHMtY3JlYXRlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZnVuY3Rpb24gQ3JlYXRlKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXHRmdW5jdGlvbiBnZXRQYXJhbXMoc3RyKSB7XG5cdFx0Y29uc3QgcmVnZXggPSAvKC0tKFxcdyspKSsvZztcblx0XHRjb25zdCByZXN1bHQgPSBbXTtcblx0XHRsZXQgbTtcblx0XHR3aGlsZSAoKG0gPSByZWdleC5leGVjKHN0cikpICE9PSBudWxsKSB7XG5cdFx0XHRpZiAobS5pbmRleCA9PT0gcmVnZXgubGFzdEluZGV4KSB7XG5cdFx0XHRcdHJlZ2V4Lmxhc3RJbmRleCsrO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2gobVsyXSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRjb25zdCByZWdleHAgPSBuZXcgUmVnRXhwKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdVVEY4X05hbWVzX1ZhbGlkYXRpb24nKSk7XG5cblx0aWYgKGNvbW1hbmQgIT09ICdjcmVhdGUnIHx8ICFNYXRjaC50ZXN0KHBhcmFtcywgU3RyaW5nKSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRsZXQgY2hhbm5lbCA9IHJlZ2V4cC5leGVjKHBhcmFtcy50cmltKCkpO1xuXHRjaGFubmVsID0gY2hhbm5lbCA/IGNoYW5uZWxbMF0gOiAnJztcblx0aWYgKGNoYW5uZWwgPT09ICcnKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKE1ldGVvci51c2VySWQoKSk7XG5cdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKGNoYW5uZWwpO1xuXHRpZiAocm9vbSAhPSBudWxsKSB7XG5cdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oJ0NoYW5uZWxfYWxyZWFkeV9leGlzdCcsIHtcblx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0c3ByaW50ZjogW2NoYW5uZWxdXG5cdFx0XHR9LCB1c2VyLmxhbmd1YWdlKVxuXHRcdH0pO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmIChnZXRQYXJhbXMocGFyYW1zKS5pbmRleE9mKCdwcml2YXRlJykgPiAtMSkge1xuXHRcdHJldHVybiBNZXRlb3IuY2FsbCgnY3JlYXRlUHJpdmF0ZUdyb3VwJywgY2hhbm5lbCwgW10pO1xuXHR9XG5cblx0TWV0ZW9yLmNhbGwoJ2NyZWF0ZUNoYW5uZWwnLCBjaGFubmVsLCBbXSk7XG59XG5cblJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ2NyZWF0ZScsIENyZWF0ZSk7XG4iXX0=
