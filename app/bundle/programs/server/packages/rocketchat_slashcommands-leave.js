(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-leave":{"leave.js":function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/rocketchat_slashcommands-leave/leave.js                  //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
/*
* Leave is a named function that will replace /leave commands
* @param {Object} message - The message object
*/function Leave(command, params, item) {
	if (command !== 'leave' && command !== 'part') {
		return;
	}

	try {
		Meteor.call('leaveRoom', item.rid);
	} catch ({
		error
	}) {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__(error, null, Meteor.user().language)
		});
	}
}

if (Meteor.isClient) {
	RocketChat.slashCommands.add('leave', undefined, {
		description: 'Leave_the_current_channel'
	});
	RocketChat.slashCommands.add('part', undefined, {
		description: 'Leave_the_current_channel'
	});
} else {
	RocketChat.slashCommands.add('leave', Leave);
	RocketChat.slashCommands.add('part', Leave);
}
///////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-leave/leave.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-leave'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-leave.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWxlYXZlL2xlYXZlLmpzIl0sIm5hbWVzIjpbIkxlYXZlIiwiY29tbWFuZCIsInBhcmFtcyIsIml0ZW0iLCJNZXRlb3IiLCJjYWxsIiwicmlkIiwiZXJyb3IiLCJSb2NrZXRDaGF0IiwiTm90aWZpY2F0aW9ucyIsIm5vdGlmeVVzZXIiLCJ1c2VySWQiLCJfaWQiLCJSYW5kb20iLCJpZCIsInRzIiwiRGF0ZSIsIm1zZyIsIlRBUGkxOG4iLCJfXyIsInVzZXIiLCJsYW5ndWFnZSIsImlzQ2xpZW50Iiwic2xhc2hDb21tYW5kcyIsImFkZCIsInVuZGVmaW5lZCIsImRlc2NyaXB0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0E7OztFQUlBLFNBQVNBLEtBQVQsQ0FBZUMsT0FBZixFQUF3QkMsTUFBeEIsRUFBZ0NDLElBQWhDLEVBQXNDO0FBQ3JDLEtBQUlGLFlBQVksT0FBWixJQUF1QkEsWUFBWSxNQUF2QyxFQUErQztBQUM5QztBQUNBOztBQUNELEtBQUk7QUFDSEcsU0FBT0MsSUFBUCxDQUFZLFdBQVosRUFBeUJGLEtBQUtHLEdBQTlCO0FBQ0EsRUFGRCxDQUVFLE9BQU87QUFBQ0M7QUFBRCxFQUFQLEVBQWdCO0FBQ2pCQyxhQUFXQyxhQUFYLENBQXlCQyxVQUF6QixDQUFvQ04sT0FBT08sTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUMvREMsUUFBS0MsT0FBT0MsRUFBUCxFQUQwRDtBQUUvRFIsUUFBS0gsS0FBS0csR0FGcUQ7QUFHL0RTLE9BQUksSUFBSUMsSUFBSixFQUgyRDtBQUkvREMsUUFBS0MsUUFBUUMsRUFBUixDQUFXWixLQUFYLEVBQWtCLElBQWxCLEVBQXdCSCxPQUFPZ0IsSUFBUCxHQUFjQyxRQUF0QztBQUowRCxHQUFoRTtBQU1BO0FBQ0Q7O0FBQ0QsSUFBSWpCLE9BQU9rQixRQUFYLEVBQXFCO0FBQ3BCZCxZQUFXZSxhQUFYLENBQXlCQyxHQUF6QixDQUE2QixPQUE3QixFQUFzQ0MsU0FBdEMsRUFBaUQ7QUFDaERDLGVBQWE7QUFEbUMsRUFBakQ7QUFHQWxCLFlBQVdlLGFBQVgsQ0FBeUJDLEdBQXpCLENBQTZCLE1BQTdCLEVBQXFDQyxTQUFyQyxFQUFnRDtBQUMvQ0MsZUFBYTtBQURrQyxFQUFoRDtBQUdBLENBUEQsTUFPTztBQUNObEIsWUFBV2UsYUFBWCxDQUF5QkMsR0FBekIsQ0FBNkIsT0FBN0IsRUFBc0N4QixLQUF0QztBQUNBUSxZQUFXZSxhQUFYLENBQXlCQyxHQUF6QixDQUE2QixNQUE3QixFQUFxQ3hCLEtBQXJDO0FBQ0EsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zbGFzaGNvbW1hbmRzLWxlYXZlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG4vKlxuKiBMZWF2ZSBpcyBhIG5hbWVkIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXBsYWNlIC9sZWF2ZSBjb21tYW5kc1xuKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIG9iamVjdFxuKi9cbmZ1bmN0aW9uIExlYXZlKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXHRpZiAoY29tbWFuZCAhPT0gJ2xlYXZlJyAmJiBjb21tYW5kICE9PSAncGFydCcpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0dHJ5IHtcblx0XHRNZXRlb3IuY2FsbCgnbGVhdmVSb29tJywgaXRlbS5yaWQpO1xuXHR9IGNhdGNoICh7ZXJyb3J9KSB7XG5cdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0dHM6IG5ldyBEYXRlLFxuXHRcdFx0bXNnOiBUQVBpMThuLl9fKGVycm9yLCBudWxsLCBNZXRlb3IudXNlcigpLmxhbmd1YWdlKVxuXHRcdH0pO1xuXHR9XG59XG5pZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG5cdFJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ2xlYXZlJywgdW5kZWZpbmVkLCB7XG5cdFx0ZGVzY3JpcHRpb246ICdMZWF2ZV90aGVfY3VycmVudF9jaGFubmVsJ1xuXHR9KTtcblx0Um9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgncGFydCcsIHVuZGVmaW5lZCwge1xuXHRcdGRlc2NyaXB0aW9uOiAnTGVhdmVfdGhlX2N1cnJlbnRfY2hhbm5lbCdcblx0fSk7XG59IGVsc2Uge1xuXHRSb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuYWRkKCdsZWF2ZScsIExlYXZlKTtcblx0Um9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgncGFydCcsIExlYXZlKTtcbn1cbiJdfQ==
