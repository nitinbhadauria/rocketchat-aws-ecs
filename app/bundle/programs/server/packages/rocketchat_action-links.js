(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var fileUpload = Package['rocketchat:ui'].fileUpload;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:action-links":{"both":{"lib":{"actionLinks.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_action-links/both/lib/actionLinks.js                                     //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
//Action Links namespace creation.
RocketChat.actionLinks = {
	actions: {},

	register(name, funct) {
		RocketChat.actionLinks.actions[name] = funct;
	},

	getMessage(name, messageId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				function: 'actionLinks.getMessage'
			});
		}

		const message = RocketChat.models.Messages.findOne({
			_id: messageId
		});

		if (!message) {
			throw new Meteor.Error('error-invalid-message', 'Invalid message', {
				function: 'actionLinks.getMessage'
			});
		}

		const room = RocketChat.models.Rooms.findOne({
			_id: message.rid
		});

		if (Array.isArray(room.usernames) && room.usernames.indexOf(Meteor.user().username) === -1) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				function: 'actionLinks.getMessage'
			});
		}

		if (!message.actionLinks || !message.actionLinks[name]) {
			throw new Meteor.Error('error-invalid-actionlink', 'Invalid action link', {
				function: 'actionLinks.getMessage'
			});
		}

		return message;
	}

};
//////////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"actionLinkHandler.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_action-links/server/actionLinkHandler.js                                 //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
//Action Links Handler. This method will be called off the client.
Meteor.methods({
	actionLinkHandler(name, messageId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'actionLinkHandler'
			});
		}

		const message = RocketChat.actionLinks.getMessage(name, messageId);
		const actionLink = message.actionLinks[name];
		RocketChat.actionLinks.actions[actionLink.method_id](message, actionLink.params);
	}

});
//////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:action-links/both/lib/actionLinks.js");
require("./node_modules/meteor/rocketchat:action-links/server/actionLinkHandler.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:action-links'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_action-links.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphY3Rpb24tbGlua3MvYm90aC9saWIvYWN0aW9uTGlua3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6YWN0aW9uLWxpbmtzL3NlcnZlci9hY3Rpb25MaW5rSGFuZGxlci5qcyJdLCJuYW1lcyI6WyJSb2NrZXRDaGF0IiwiYWN0aW9uTGlua3MiLCJhY3Rpb25zIiwicmVnaXN0ZXIiLCJuYW1lIiwiZnVuY3QiLCJnZXRNZXNzYWdlIiwibWVzc2FnZUlkIiwiTWV0ZW9yIiwidXNlcklkIiwiRXJyb3IiLCJmdW5jdGlvbiIsIm1lc3NhZ2UiLCJtb2RlbHMiLCJNZXNzYWdlcyIsImZpbmRPbmUiLCJfaWQiLCJyb29tIiwiUm9vbXMiLCJyaWQiLCJBcnJheSIsImlzQXJyYXkiLCJ1c2VybmFtZXMiLCJpbmRleE9mIiwidXNlciIsInVzZXJuYW1lIiwibWV0aG9kcyIsImFjdGlvbkxpbmtIYW5kbGVyIiwibWV0aG9kIiwiYWN0aW9uTGluayIsIm1ldGhvZF9pZCIsInBhcmFtcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBQSxXQUFXQyxXQUFYLEdBQXlCO0FBQ3hCQyxVQUFTLEVBRGU7O0FBRXhCQyxVQUFTQyxJQUFULEVBQWVDLEtBQWYsRUFBc0I7QUFDckJMLGFBQVdDLFdBQVgsQ0FBdUJDLE9BQXZCLENBQStCRSxJQUEvQixJQUF1Q0MsS0FBdkM7QUFDQSxFQUp1Qjs7QUFLeEJDLFlBQVdGLElBQVgsRUFBaUJHLFNBQWpCLEVBQTRCO0FBQzNCLE1BQUksQ0FBQ0MsT0FBT0MsTUFBUCxFQUFMLEVBQXNCO0FBQ3JCLFNBQU0sSUFBSUQsT0FBT0UsS0FBWCxDQUFpQixvQkFBakIsRUFBdUMsY0FBdkMsRUFBdUQ7QUFBRUMsY0FBVTtBQUFaLElBQXZELENBQU47QUFDQTs7QUFFRCxRQUFNQyxVQUFVWixXQUFXYSxNQUFYLENBQWtCQyxRQUFsQixDQUEyQkMsT0FBM0IsQ0FBbUM7QUFBRUMsUUFBS1Q7QUFBUCxHQUFuQyxDQUFoQjs7QUFDQSxNQUFJLENBQUNLLE9BQUwsRUFBYztBQUNiLFNBQU0sSUFBSUosT0FBT0UsS0FBWCxDQUFpQix1QkFBakIsRUFBMEMsaUJBQTFDLEVBQTZEO0FBQUVDLGNBQVU7QUFBWixJQUE3RCxDQUFOO0FBQ0E7O0FBRUQsUUFBTU0sT0FBT2pCLFdBQVdhLE1BQVgsQ0FBa0JLLEtBQWxCLENBQXdCSCxPQUF4QixDQUFnQztBQUFFQyxRQUFLSixRQUFRTztBQUFmLEdBQWhDLENBQWI7O0FBQ0EsTUFBSUMsTUFBTUMsT0FBTixDQUFjSixLQUFLSyxTQUFuQixLQUFpQ0wsS0FBS0ssU0FBTCxDQUFlQyxPQUFmLENBQXVCZixPQUFPZ0IsSUFBUCxHQUFjQyxRQUFyQyxNQUFtRCxDQUFDLENBQXpGLEVBQTRGO0FBQzNGLFNBQU0sSUFBSWpCLE9BQU9FLEtBQVgsQ0FBaUIsbUJBQWpCLEVBQXNDLGFBQXRDLEVBQXFEO0FBQUVDLGNBQVU7QUFBWixJQUFyRCxDQUFOO0FBQ0E7O0FBRUQsTUFBSSxDQUFDQyxRQUFRWCxXQUFULElBQXdCLENBQUNXLFFBQVFYLFdBQVIsQ0FBb0JHLElBQXBCLENBQTdCLEVBQXdEO0FBQ3ZELFNBQU0sSUFBSUksT0FBT0UsS0FBWCxDQUFpQiwwQkFBakIsRUFBNkMscUJBQTdDLEVBQW9FO0FBQUVDLGNBQVU7QUFBWixJQUFwRSxDQUFOO0FBQ0E7O0FBRUQsU0FBT0MsT0FBUDtBQUNBOztBQXpCdUIsQ0FBekIsQzs7Ozs7Ozs7Ozs7QUNEQTtBQUVBSixPQUFPa0IsT0FBUCxDQUFlO0FBQ2RDLG1CQUFrQnZCLElBQWxCLEVBQXdCRyxTQUF4QixFQUFtQztBQUNsQyxNQUFJLENBQUNDLE9BQU9DLE1BQVAsRUFBTCxFQUFzQjtBQUNyQixTQUFNLElBQUlELE9BQU9FLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQUVrQixZQUFRO0FBQVYsSUFBdkQsQ0FBTjtBQUNBOztBQUVELFFBQU1oQixVQUFVWixXQUFXQyxXQUFYLENBQXVCSyxVQUF2QixDQUFrQ0YsSUFBbEMsRUFBd0NHLFNBQXhDLENBQWhCO0FBRUEsUUFBTXNCLGFBQWFqQixRQUFRWCxXQUFSLENBQW9CRyxJQUFwQixDQUFuQjtBQUVBSixhQUFXQyxXQUFYLENBQXVCQyxPQUF2QixDQUErQjJCLFdBQVdDLFNBQTFDLEVBQXFEbEIsT0FBckQsRUFBOERpQixXQUFXRSxNQUF6RTtBQUNBOztBQVhhLENBQWYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9hY3Rpb24tbGlua3MuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvL0FjdGlvbiBMaW5rcyBuYW1lc3BhY2UgY3JlYXRpb24uXG5Sb2NrZXRDaGF0LmFjdGlvbkxpbmtzID0ge1xuXHRhY3Rpb25zOiB7fSxcblx0cmVnaXN0ZXIobmFtZSwgZnVuY3QpIHtcblx0XHRSb2NrZXRDaGF0LmFjdGlvbkxpbmtzLmFjdGlvbnNbbmFtZV0gPSBmdW5jdDtcblx0fSxcblx0Z2V0TWVzc2FnZShuYW1lLCBtZXNzYWdlSWQpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgZnVuY3Rpb246ICdhY3Rpb25MaW5rcy5nZXRNZXNzYWdlJyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZSh7IF9pZDogbWVzc2FnZUlkIH0pO1xuXHRcdGlmICghbWVzc2FnZSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1tZXNzYWdlJywgJ0ludmFsaWQgbWVzc2FnZScsIHsgZnVuY3Rpb246ICdhY3Rpb25MaW5rcy5nZXRNZXNzYWdlJyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZSh7IF9pZDogbWVzc2FnZS5yaWQgfSk7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkocm9vbS51c2VybmFtZXMpICYmIHJvb20udXNlcm5hbWVzLmluZGV4T2YoTWV0ZW9yLnVzZXIoKS51c2VybmFtZSkgPT09IC0xKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgZnVuY3Rpb246ICdhY3Rpb25MaW5rcy5nZXRNZXNzYWdlJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoIW1lc3NhZ2UuYWN0aW9uTGlua3MgfHwgIW1lc3NhZ2UuYWN0aW9uTGlua3NbbmFtZV0pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtYWN0aW9ubGluaycsICdJbnZhbGlkIGFjdGlvbiBsaW5rJywgeyBmdW5jdGlvbjogJ2FjdGlvbkxpbmtzLmdldE1lc3NhZ2UnIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG59O1xuIiwiLy9BY3Rpb24gTGlua3MgSGFuZGxlci4gVGhpcyBtZXRob2Qgd2lsbCBiZSBjYWxsZWQgb2ZmIHRoZSBjbGllbnQuXG5cbk1ldGVvci5tZXRob2RzKHtcblx0YWN0aW9uTGlua0hhbmRsZXIobmFtZSwgbWVzc2FnZUlkKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2FjdGlvbkxpbmtIYW5kbGVyJyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gUm9ja2V0Q2hhdC5hY3Rpb25MaW5rcy5nZXRNZXNzYWdlKG5hbWUsIG1lc3NhZ2VJZCk7XG5cblx0XHRjb25zdCBhY3Rpb25MaW5rID0gbWVzc2FnZS5hY3Rpb25MaW5rc1tuYW1lXTtcblxuXHRcdFJvY2tldENoYXQuYWN0aW9uTGlua3MuYWN0aW9uc1thY3Rpb25MaW5rLm1ldGhvZF9pZF0obWVzc2FnZSwgYWN0aW9uTGluay5wYXJhbXMpO1xuXHR9XG59KTtcbiJdfQ==
