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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-help":{"server.js":function(){

/////////////////////////////////////////////////////////////////////////////////
//                                                                             //
// packages/rocketchat_slashcommands-help/server.js                            //
//                                                                             //
/////////////////////////////////////////////////////////////////////////////////
                                                                               //
/*
* Help is a named function that will replace /join commands
* @param {Object} message - The message object
*/RocketChat.slashCommands.add('help', function Help(command, params, item) {
	if (command !== 'help') {
		return;
	}

	const user = Meteor.users.findOne(Meteor.userId());
	const keys = [{
		'Open_channel_user_search': 'Command (or Ctrl) + p OR Command (or Ctrl) + k'
	}, {
		'Edit_previous_message': 'Up Arrow'
	}, {
		'Move_beginning_message': 'Command (or Alt) + Left Arrow'
	}, {
		'Move_beginning_message': 'Command (or Alt) + Up Arrow'
	}, {
		'Move_end_message': 'Command (or Alt) + Right Arrow'
	}, {
		'Move_end_message': 'Command (or Alt) + Down Arrow'
	}, {
		'New_line_message_compose_input': 'Shift + Enter'
	}];
	keys.map(key => {
		RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
			_id: Random.id(),
			rid: item.rid,
			ts: new Date(),
			msg: TAPi18n.__(Object.keys(key)[0], {
				postProcess: 'sprintf',
				sprintf: [key[Object.keys(key)[0]]]
			}, user.language)
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-help/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-help'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-help.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWhlbHAvc2VydmVyLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJzbGFzaENvbW1hbmRzIiwiYWRkIiwiSGVscCIsImNvbW1hbmQiLCJwYXJhbXMiLCJpdGVtIiwidXNlciIsIk1ldGVvciIsInVzZXJzIiwiZmluZE9uZSIsInVzZXJJZCIsImtleXMiLCJtYXAiLCJrZXkiLCJOb3RpZmljYXRpb25zIiwibm90aWZ5VXNlciIsIl9pZCIsIlJhbmRvbSIsImlkIiwicmlkIiwidHMiLCJEYXRlIiwibXNnIiwiVEFQaTE4biIsIl9fIiwiT2JqZWN0IiwicG9zdFByb2Nlc3MiLCJzcHJpbnRmIiwibGFuZ3VhZ2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBOzs7RUFNQUEsV0FBV0MsYUFBWCxDQUF5QkMsR0FBekIsQ0FBNkIsTUFBN0IsRUFBcUMsU0FBU0MsSUFBVCxDQUFjQyxPQUFkLEVBQXVCQyxNQUF2QixFQUErQkMsSUFBL0IsRUFBcUM7QUFFekUsS0FBSUYsWUFBWSxNQUFoQixFQUF3QjtBQUN2QjtBQUNBOztBQUNELE9BQU1HLE9BQU9DLE9BQU9DLEtBQVAsQ0FBYUMsT0FBYixDQUFxQkYsT0FBT0csTUFBUCxFQUFyQixDQUFiO0FBQ0EsT0FBTUMsT0FBTyxDQUFDO0FBQ2IsOEJBQTRCO0FBRGYsRUFBRCxFQUdiO0FBQ0MsMkJBQXlCO0FBRDFCLEVBSGEsRUFNYjtBQUNDLDRCQUEwQjtBQUQzQixFQU5hLEVBU2I7QUFDQyw0QkFBMEI7QUFEM0IsRUFUYSxFQVliO0FBQ0Msc0JBQW9CO0FBRHJCLEVBWmEsRUFlYjtBQUNDLHNCQUFvQjtBQURyQixFQWZhLEVBa0JiO0FBQ0Msb0NBQWtDO0FBRG5DLEVBbEJhLENBQWI7QUFzQkFBLE1BQUtDLEdBQUwsQ0FBVUMsR0FBRCxJQUFTO0FBQ2pCZCxhQUFXZSxhQUFYLENBQXlCQyxVQUF6QixDQUFvQ1IsT0FBT0csTUFBUCxFQUFwQyxFQUFxRCxTQUFyRCxFQUFnRTtBQUMvRE0sUUFBS0MsT0FBT0MsRUFBUCxFQUQwRDtBQUUvREMsUUFBS2QsS0FBS2MsR0FGcUQ7QUFHL0RDLE9BQUksSUFBSUMsSUFBSixFQUgyRDtBQUkvREMsUUFBS0MsUUFBUUMsRUFBUixDQUFXQyxPQUFPZCxJQUFQLENBQVlFLEdBQVosRUFBaUIsQ0FBakIsQ0FBWCxFQUFnQztBQUNwQ2EsaUJBQWEsU0FEdUI7QUFFcENDLGFBQVMsQ0FBQ2QsSUFBSVksT0FBT2QsSUFBUCxDQUFZRSxHQUFaLEVBQWlCLENBQWpCLENBQUosQ0FBRDtBQUYyQixJQUFoQyxFQUdGUCxLQUFLc0IsUUFISDtBQUowRCxHQUFoRTtBQVNBLEVBVkQ7QUFZQSxDQXhDRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3NsYXNoY29tbWFuZHMtaGVscC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuLypcbiogSGVscCBpcyBhIG5hbWVkIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXBsYWNlIC9qb2luIGNvbW1hbmRzXG4qIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlIC0gVGhlIG1lc3NhZ2Ugb2JqZWN0XG4qL1xuXG5cblJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ2hlbHAnLCBmdW5jdGlvbiBIZWxwKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXG5cdGlmIChjb21tYW5kICE9PSAnaGVscCcpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKE1ldGVvci51c2VySWQoKSk7XG5cdGNvbnN0IGtleXMgPSBbe1xuXHRcdCdPcGVuX2NoYW5uZWxfdXNlcl9zZWFyY2gnOiAnQ29tbWFuZCAob3IgQ3RybCkgKyBwIE9SIENvbW1hbmQgKG9yIEN0cmwpICsgaydcblx0fSxcblx0e1xuXHRcdCdFZGl0X3ByZXZpb3VzX21lc3NhZ2UnOiAnVXAgQXJyb3cnXG5cdH0sXG5cdHtcblx0XHQnTW92ZV9iZWdpbm5pbmdfbWVzc2FnZSc6ICdDb21tYW5kIChvciBBbHQpICsgTGVmdCBBcnJvdydcblx0fSxcblx0e1xuXHRcdCdNb3ZlX2JlZ2lubmluZ19tZXNzYWdlJzogJ0NvbW1hbmQgKG9yIEFsdCkgKyBVcCBBcnJvdydcblx0fSxcblx0e1xuXHRcdCdNb3ZlX2VuZF9tZXNzYWdlJzogJ0NvbW1hbmQgKG9yIEFsdCkgKyBSaWdodCBBcnJvdydcblx0fSxcblx0e1xuXHRcdCdNb3ZlX2VuZF9tZXNzYWdlJzogJ0NvbW1hbmQgKG9yIEFsdCkgKyBEb3duIEFycm93J1xuXHR9LFxuXHR7XG5cdFx0J05ld19saW5lX21lc3NhZ2VfY29tcG9zZV9pbnB1dCc6ICdTaGlmdCArIEVudGVyJ1xuXHR9XG5cdF07XG5cdGtleXMubWFwKChrZXkpID0+IHtcblx0XHRSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5VXNlcihNZXRlb3IudXNlcklkKCksICdtZXNzYWdlJywge1xuXHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHR0czogbmV3IERhdGUsXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oT2JqZWN0LmtleXMoa2V5KVswXSwge1xuXHRcdFx0XHRwb3N0UHJvY2VzczogJ3NwcmludGYnLFxuXHRcdFx0XHRzcHJpbnRmOiBba2V5W09iamVjdC5rZXlzKGtleSlbMF1dXVxuXHRcdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0XHR9KTtcblx0fSk7XG5cbn0pO1xuIl19
