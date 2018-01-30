(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var ECMAScript = Package.ecmascript.ECMAScript;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:webrtc":{"server":{"settings.js":function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/rocketchat_webrtc/server/settings.js                     //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
RocketChat.settings.addGroup('WebRTC', function () {
	this.add('WebRTC_Enable_Channel', false, {
		type: 'boolean',
		group: 'WebRTC',
		'public': true
	});
	this.add('WebRTC_Enable_Private', true, {
		type: 'boolean',
		group: 'WebRTC',
		'public': true
	});
	this.add('WebRTC_Enable_Direct', true, {
		type: 'boolean',
		group: 'WebRTC',
		'public': true
	});
	return this.add('WebRTC_Servers', 'stun:stun.l.google.com:19302, stun:23.21.150.121, team%40rocket.chat:demo@turn:numb.viagenie.ca:3478', {
		type: 'string',
		group: 'WebRTC',
		'public': true
	});
});
///////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:webrtc/server/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:webrtc'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_webrtc.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp3ZWJydGMvc2VydmVyL3NldHRpbmdzLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJzZXR0aW5ncyIsImFkZEdyb3VwIiwiYWRkIiwidHlwZSIsImdyb3VwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLFdBQVdDLFFBQVgsQ0FBb0JDLFFBQXBCLENBQTZCLFFBQTdCLEVBQXVDLFlBQVc7QUFDakQsTUFBS0MsR0FBTCxDQUFTLHVCQUFULEVBQWtDLEtBQWxDLEVBQXlDO0FBQ3hDQyxRQUFNLFNBRGtDO0FBRXhDQyxTQUFPLFFBRmlDO0FBR3hDLFlBQVU7QUFIOEIsRUFBekM7QUFLQSxNQUFLRixHQUFMLENBQVMsdUJBQVQsRUFBa0MsSUFBbEMsRUFBd0M7QUFDdkNDLFFBQU0sU0FEaUM7QUFFdkNDLFNBQU8sUUFGZ0M7QUFHdkMsWUFBVTtBQUg2QixFQUF4QztBQUtBLE1BQUtGLEdBQUwsQ0FBUyxzQkFBVCxFQUFpQyxJQUFqQyxFQUF1QztBQUN0Q0MsUUFBTSxTQURnQztBQUV0Q0MsU0FBTyxRQUYrQjtBQUd0QyxZQUFVO0FBSDRCLEVBQXZDO0FBS0EsUUFBTyxLQUFLRixHQUFMLENBQVMsZ0JBQVQsRUFBMkIsc0dBQTNCLEVBQW1JO0FBQ3pJQyxRQUFNLFFBRG1JO0FBRXpJQyxTQUFPLFFBRmtJO0FBR3pJLFlBQVU7QUFIK0gsRUFBbkksQ0FBUDtBQUtBLENBckJELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfd2VicnRjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnV2ViUlRDJywgZnVuY3Rpb24oKSB7XG5cdHRoaXMuYWRkKCdXZWJSVENfRW5hYmxlX0NoYW5uZWwnLCBmYWxzZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ1dlYlJUQycsXG5cdFx0J3B1YmxpYyc6IHRydWVcblx0fSk7XG5cdHRoaXMuYWRkKCdXZWJSVENfRW5hYmxlX1ByaXZhdGUnLCB0cnVlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnV2ViUlRDJyxcblx0XHQncHVibGljJzogdHJ1ZVxuXHR9KTtcblx0dGhpcy5hZGQoJ1dlYlJUQ19FbmFibGVfRGlyZWN0JywgdHJ1ZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ1dlYlJUQycsXG5cdFx0J3B1YmxpYyc6IHRydWVcblx0fSk7XG5cdHJldHVybiB0aGlzLmFkZCgnV2ViUlRDX1NlcnZlcnMnLCAnc3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMiwgc3R1bjoyMy4yMS4xNTAuMTIxLCB0ZWFtJTQwcm9ja2V0LmNoYXQ6ZGVtb0B0dXJuOm51bWIudmlhZ2VuaWUuY2E6MzQ3OCcsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ1dlYlJUQycsXG5cdFx0J3B1YmxpYyc6IHRydWVcblx0fSk7XG59KTtcbiJdfQ==
