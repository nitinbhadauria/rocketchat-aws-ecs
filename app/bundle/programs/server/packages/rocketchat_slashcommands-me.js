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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-me":{"me.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// packages/rocketchat_slashcommands-me/me.js                              //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////
                                                                           //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
/*
 * Me is a named function that will replace /me commands
 * @param {Object} message - The message object
 */RocketChat.slashCommands.add('me', function Me(command, params, item) {
	if (command !== 'me') {
		return;
	}

	if (s.trim(params)) {
		const msg = item;
		msg.msg = `_${params}_`;
		Meteor.call('sendMessage', msg);
	}
}, {
	description: 'Displays_action_text',
	params: 'your_message'
});
/////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-me/me.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-me'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-me.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLW1lL21lLmpzIl0sIm5hbWVzIjpbInMiLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIlJvY2tldENoYXQiLCJzbGFzaENvbW1hbmRzIiwiYWRkIiwiTWUiLCJjb21tYW5kIiwicGFyYW1zIiwiaXRlbSIsInRyaW0iLCJtc2ciLCJNZXRlb3IiLCJjYWxsIiwiZGVzY3JpcHRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxDQUFKO0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxtQkFBUixDQUFiLEVBQTBDO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQTFDLEVBQTRELENBQTVEO0FBRU47OztHQUlBQyxXQUFXQyxhQUFYLENBQXlCQyxHQUF6QixDQUE2QixJQUE3QixFQUFtQyxTQUFTQyxFQUFULENBQVlDLE9BQVosRUFBcUJDLE1BQXJCLEVBQTZCQyxJQUE3QixFQUFtQztBQUNyRSxLQUFJRixZQUFZLElBQWhCLEVBQXNCO0FBQ3JCO0FBQ0E7O0FBQ0QsS0FBSVYsRUFBRWEsSUFBRixDQUFPRixNQUFQLENBQUosRUFBb0I7QUFDbkIsUUFBTUcsTUFBTUYsSUFBWjtBQUNBRSxNQUFJQSxHQUFKLEdBQVcsSUFBSUgsTUFBUSxHQUF2QjtBQUNBSSxTQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQkYsR0FBM0I7QUFDQTtBQUNELENBVEQsRUFTRztBQUNGRyxjQUFhLHNCQURYO0FBRUZOLFNBQVE7QUFGTixDQVRILEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfc2xhc2hjb21tYW5kcy1tZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcblxuLypcbiAqIE1lIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlcGxhY2UgL21lIGNvbW1hbmRzXG4gKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIG9iamVjdFxuICovXG5Sb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuYWRkKCdtZScsIGZ1bmN0aW9uIE1lKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXHRpZiAoY29tbWFuZCAhPT0gJ21lJykge1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAocy50cmltKHBhcmFtcykpIHtcblx0XHRjb25zdCBtc2cgPSBpdGVtO1xuXHRcdG1zZy5tc2cgPSBgXyR7IHBhcmFtcyB9X2A7XG5cdFx0TWV0ZW9yLmNhbGwoJ3NlbmRNZXNzYWdlJywgbXNnKTtcblx0fVxufSwge1xuXHRkZXNjcmlwdGlvbjogJ0Rpc3BsYXlzX2FjdGlvbl90ZXh0Jyxcblx0cGFyYW1zOiAneW91cl9tZXNzYWdlJ1xufSk7XG4iXX0=
