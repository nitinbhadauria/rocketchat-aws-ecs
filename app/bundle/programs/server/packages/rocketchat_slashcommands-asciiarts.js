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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slashcommands-asciiarts":{"gimme.js":function(){

////////////////////////////////////////////////////////////////////////
//                                                                    //
// packages/rocketchat_slashcommands-asciiarts/gimme.js               //
//                                                                    //
////////////////////////////////////////////////////////////////////////
                                                                      //
/*
* Gimme is a named function that will replace /gimme commands
* @param {Object} message - The message object
*/function Gimme(command, params, item) {
	if (command === 'gimme') {
		const msg = item;
		msg.msg = `༼ つ ◕_◕ ༽つ ${params}`;
		Meteor.call('sendMessage', msg);
	}
}

RocketChat.slashCommands.add('gimme', Gimme, {
	description: 'Slash_Gimme_Description',
	params: 'your_message_optional'
});
////////////////////////////////////////////////////////////////////////

},"lenny.js":function(){

////////////////////////////////////////////////////////////////////////
//                                                                    //
// packages/rocketchat_slashcommands-asciiarts/lenny.js               //
//                                                                    //
////////////////////////////////////////////////////////////////////////
                                                                      //
/*
* Lenny is a named function that will replace /lenny commands
* @param {Object} message - The message object
*/function LennyFace(command, params, item) {
	if (command === 'lennyface') {
		const msg = item;
		msg.msg = `${params} ( ͡° ͜ʖ ͡°)`;
		Meteor.call('sendMessage', msg);
	}
}

RocketChat.slashCommands.add('lennyface', LennyFace, {
	description: 'Slash_LennyFace_Description',
	params: 'your_message_optional'
});
////////////////////////////////////////////////////////////////////////

},"shrug.js":function(){

////////////////////////////////////////////////////////////////////////
//                                                                    //
// packages/rocketchat_slashcommands-asciiarts/shrug.js               //
//                                                                    //
////////////////////////////////////////////////////////////////////////
                                                                      //
/*
* Shrug is a named function that will replace /shrug commands
* @param {Object} message - The message object
*/function Shrug(command, params, item) {
	if (command === 'shrug') {
		const msg = item;
		msg.msg = `${params} ¯\\_(ツ)_/¯`;
		Meteor.call('sendMessage', msg);
	}
}

RocketChat.slashCommands.add('shrug', Shrug, {
	description: 'Slash_Shrug_Description',
	params: 'your_message_optional'
});
////////////////////////////////////////////////////////////////////////

},"tableflip.js":function(){

////////////////////////////////////////////////////////////////////////
//                                                                    //
// packages/rocketchat_slashcommands-asciiarts/tableflip.js           //
//                                                                    //
////////////////////////////////////////////////////////////////////////
                                                                      //
/*
* Tableflip is a named function that will replace /Tableflip commands
* @param {Object} message - The message object
*/function Tableflip(command, params, item) {
	if (command === 'tableflip') {
		const msg = item;
		msg.msg = `${params} (╯°□°）╯︵ ┻━┻`;
		Meteor.call('sendMessage', msg);
	}
}

RocketChat.slashCommands.add('tableflip', Tableflip, {
	description: 'Slash_Tableflip_Description',
	params: 'your_message_optional'
});
////////////////////////////////////////////////////////////////////////

},"unflip.js":function(){

////////////////////////////////////////////////////////////////////////
//                                                                    //
// packages/rocketchat_slashcommands-asciiarts/unflip.js              //
//                                                                    //
////////////////////////////////////////////////////////////////////////
                                                                      //
/*
* Unflip is a named function that will replace /unflip commands
* @param {Object} message - The message object
*/function Unflip(command, params, item) {
	if (command === 'unflip') {
		const msg = item;
		msg.msg = `${params} ┬─┬ ノ( ゜-゜ノ)`;
		Meteor.call('sendMessage', msg);
	}
}

RocketChat.slashCommands.add('unflip', Unflip, {
	description: 'Slash_TableUnflip_Description',
	params: 'your_message_optional'
});
////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slashcommands-asciiarts/gimme.js");
require("./node_modules/meteor/rocketchat:slashcommands-asciiarts/lenny.js");
require("./node_modules/meteor/rocketchat:slashcommands-asciiarts/shrug.js");
require("./node_modules/meteor/rocketchat:slashcommands-asciiarts/tableflip.js");
require("./node_modules/meteor/rocketchat:slashcommands-asciiarts/unflip.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slashcommands-asciiarts'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slashcommands-asciiarts.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWFzY2lpYXJ0cy9naW1tZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWFzY2lpYXJ0cy9sZW5ueS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWFzY2lpYXJ0cy9zaHJ1Zy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFzaGNvbW1hbmRzLWFzY2lpYXJ0cy90YWJsZWZsaXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c2xhc2hjb21tYW5kcy1hc2NpaWFydHMvdW5mbGlwLmpzIl0sIm5hbWVzIjpbIkdpbW1lIiwiY29tbWFuZCIsInBhcmFtcyIsIml0ZW0iLCJtc2ciLCJNZXRlb3IiLCJjYWxsIiwiUm9ja2V0Q2hhdCIsInNsYXNoQ29tbWFuZHMiLCJhZGQiLCJkZXNjcmlwdGlvbiIsIkxlbm55RmFjZSIsIlNocnVnIiwiVGFibGVmbGlwIiwiVW5mbGlwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7OztFQU1BLFNBQVNBLEtBQVQsQ0FBZUMsT0FBZixFQUF3QkMsTUFBeEIsRUFBZ0NDLElBQWhDLEVBQXNDO0FBQ3JDLEtBQUlGLFlBQVksT0FBaEIsRUFBeUI7QUFDeEIsUUFBTUcsTUFBTUQsSUFBWjtBQUNBQyxNQUFJQSxHQUFKLEdBQVcsY0FBY0YsTUFBUSxFQUFqQztBQUNBRyxTQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQkYsR0FBM0I7QUFDQTtBQUNEOztBQUVERyxXQUFXQyxhQUFYLENBQXlCQyxHQUF6QixDQUE2QixPQUE3QixFQUFzQ1QsS0FBdEMsRUFBNkM7QUFDNUNVLGNBQWEseUJBRCtCO0FBRTVDUixTQUFRO0FBRm9DLENBQTdDLEU7Ozs7Ozs7Ozs7O0FDZEE7OztFQU1BLFNBQVNTLFNBQVQsQ0FBbUJWLE9BQW5CLEVBQTRCQyxNQUE1QixFQUFvQ0MsSUFBcEMsRUFBMEM7QUFDekMsS0FBSUYsWUFBWSxXQUFoQixFQUE2QjtBQUM1QixRQUFNRyxNQUFNRCxJQUFaO0FBQ0FDLE1BQUlBLEdBQUosR0FBVyxHQUFHRixNQUFRLGNBQXRCO0FBQ0FHLFNBQU9DLElBQVAsQ0FBWSxhQUFaLEVBQTJCRixHQUEzQjtBQUNBO0FBQ0Q7O0FBRURHLFdBQVdDLGFBQVgsQ0FBeUJDLEdBQXpCLENBQTZCLFdBQTdCLEVBQTBDRSxTQUExQyxFQUFxRDtBQUNwREQsY0FBYSw2QkFEdUM7QUFFcERSLFNBQVE7QUFGNEMsQ0FBckQsRTs7Ozs7Ozs7Ozs7QUNkQTs7O0VBTUEsU0FBU1UsS0FBVCxDQUFlWCxPQUFmLEVBQXdCQyxNQUF4QixFQUFnQ0MsSUFBaEMsRUFBc0M7QUFDckMsS0FBSUYsWUFBWSxPQUFoQixFQUF5QjtBQUN4QixRQUFNRyxNQUFNRCxJQUFaO0FBQ0FDLE1BQUlBLEdBQUosR0FBVyxHQUFHRixNQUFRLGFBQXRCO0FBQ0FHLFNBQU9DLElBQVAsQ0FBWSxhQUFaLEVBQTJCRixHQUEzQjtBQUNBO0FBQ0Q7O0FBRURHLFdBQVdDLGFBQVgsQ0FBeUJDLEdBQXpCLENBQTZCLE9BQTdCLEVBQXNDRyxLQUF0QyxFQUE2QztBQUM1Q0YsY0FBYSx5QkFEK0I7QUFFNUNSLFNBQVE7QUFGb0MsQ0FBN0MsRTs7Ozs7Ozs7Ozs7QUNkQTs7O0VBTUEsU0FBU1csU0FBVCxDQUFtQlosT0FBbkIsRUFBNEJDLE1BQTVCLEVBQW9DQyxJQUFwQyxFQUEwQztBQUN6QyxLQUFJRixZQUFZLFdBQWhCLEVBQTZCO0FBQzVCLFFBQU1HLE1BQU1ELElBQVo7QUFDQUMsTUFBSUEsR0FBSixHQUFXLEdBQUdGLE1BQVEsZUFBdEI7QUFDQUcsU0FBT0MsSUFBUCxDQUFZLGFBQVosRUFBMkJGLEdBQTNCO0FBQ0E7QUFDRDs7QUFFREcsV0FBV0MsYUFBWCxDQUF5QkMsR0FBekIsQ0FBNkIsV0FBN0IsRUFBMENJLFNBQTFDLEVBQXFEO0FBQ3BESCxjQUFhLDZCQUR1QztBQUVwRFIsU0FBUTtBQUY0QyxDQUFyRCxFOzs7Ozs7Ozs7OztBQ2RBOzs7RUFNQSxTQUFTWSxNQUFULENBQWdCYixPQUFoQixFQUF5QkMsTUFBekIsRUFBaUNDLElBQWpDLEVBQXVDO0FBQ3RDLEtBQUlGLFlBQVksUUFBaEIsRUFBMEI7QUFDekIsUUFBTUcsTUFBTUQsSUFBWjtBQUNBQyxNQUFJQSxHQUFKLEdBQVcsR0FBR0YsTUFBUSxlQUF0QjtBQUNBRyxTQUFPQyxJQUFQLENBQVksYUFBWixFQUEyQkYsR0FBM0I7QUFDQTtBQUNEOztBQUVERyxXQUFXQyxhQUFYLENBQXlCQyxHQUF6QixDQUE2QixRQUE3QixFQUF1Q0ssTUFBdkMsRUFBK0M7QUFDOUNKLGNBQWEsK0JBRGlDO0FBRTlDUixTQUFRO0FBRnNDLENBQS9DLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfc2xhc2hjb21tYW5kcy1hc2NpaWFydHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuKiBHaW1tZSBpcyBhIG5hbWVkIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXBsYWNlIC9naW1tZSBjb21tYW5kc1xuKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIG9iamVjdFxuKi9cblxuXG5mdW5jdGlvbiBHaW1tZShjb21tYW5kLCBwYXJhbXMsIGl0ZW0pIHtcblx0aWYgKGNvbW1hbmQgPT09ICdnaW1tZScpIHtcblx0XHRjb25zdCBtc2cgPSBpdGVtO1xuXHRcdG1zZy5tc2cgPSBg4Ly8IOOBpCDil5Vf4peVIOC8veOBpCAkeyBwYXJhbXMgfWA7XG5cdFx0TWV0ZW9yLmNhbGwoJ3NlbmRNZXNzYWdlJywgbXNnKTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuYWRkKCdnaW1tZScsIEdpbW1lLCB7XG5cdGRlc2NyaXB0aW9uOiAnU2xhc2hfR2ltbWVfRGVzY3JpcHRpb24nLFxuXHRwYXJhbXM6ICd5b3VyX21lc3NhZ2Vfb3B0aW9uYWwnXG59KTtcbiIsIi8qXG4qIExlbm55IGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHJlcGxhY2UgL2xlbm55IGNvbW1hbmRzXG4qIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlIC0gVGhlIG1lc3NhZ2Ugb2JqZWN0XG4qL1xuXG5cbmZ1bmN0aW9uIExlbm55RmFjZShjb21tYW5kLCBwYXJhbXMsIGl0ZW0pIHtcblx0aWYgKGNvbW1hbmQgPT09ICdsZW5ueWZhY2UnKSB7XG5cdFx0Y29uc3QgbXNnID0gaXRlbTtcblx0XHRtc2cubXNnID0gYCR7IHBhcmFtcyB9ICggzaHCsCDNnMqWIM2hwrApYDtcblx0XHRNZXRlb3IuY2FsbCgnc2VuZE1lc3NhZ2UnLCBtc2cpO1xuXHR9XG59XG5cblJvY2tldENoYXQuc2xhc2hDb21tYW5kcy5hZGQoJ2xlbm55ZmFjZScsIExlbm55RmFjZSwge1xuXHRkZXNjcmlwdGlvbjogJ1NsYXNoX0xlbm55RmFjZV9EZXNjcmlwdGlvbicsXG5cdHBhcmFtczogJ3lvdXJfbWVzc2FnZV9vcHRpb25hbCdcbn0pO1xuIiwiLypcbiogU2hydWcgaXMgYSBuYW1lZCBmdW5jdGlvbiB0aGF0IHdpbGwgcmVwbGFjZSAvc2hydWcgY29tbWFuZHNcbiogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSBvYmplY3RcbiovXG5cblxuZnVuY3Rpb24gU2hydWcoY29tbWFuZCwgcGFyYW1zLCBpdGVtKSB7XG5cdGlmIChjb21tYW5kID09PSAnc2hydWcnKSB7XG5cdFx0Y29uc3QgbXNnID0gaXRlbTtcblx0XHRtc2cubXNnID0gYCR7IHBhcmFtcyB9IMKvXFxcXF8o44OEKV8vwq9gO1xuXHRcdE1ldGVvci5jYWxsKCdzZW5kTWVzc2FnZScsIG1zZyk7XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgnc2hydWcnLCBTaHJ1Zywge1xuXHRkZXNjcmlwdGlvbjogJ1NsYXNoX1NocnVnX0Rlc2NyaXB0aW9uJyxcblx0cGFyYW1zOiAneW91cl9tZXNzYWdlX29wdGlvbmFsJ1xufSk7XG4iLCIvKlxuKiBUYWJsZWZsaXAgaXMgYSBuYW1lZCBmdW5jdGlvbiB0aGF0IHdpbGwgcmVwbGFjZSAvVGFibGVmbGlwIGNvbW1hbmRzXG4qIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlIC0gVGhlIG1lc3NhZ2Ugb2JqZWN0XG4qL1xuXG5cbmZ1bmN0aW9uIFRhYmxlZmxpcChjb21tYW5kLCBwYXJhbXMsIGl0ZW0pIHtcblx0aWYgKGNvbW1hbmQgPT09ICd0YWJsZWZsaXAnKSB7XG5cdFx0Y29uc3QgbXNnID0gaXRlbTtcblx0XHRtc2cubXNnID0gYCR7IHBhcmFtcyB9ICjila/CsOKWocKw77yJ4pWv77i1IOKUu+KUgeKUu2A7XG5cdFx0TWV0ZW9yLmNhbGwoJ3NlbmRNZXNzYWdlJywgbXNnKTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuYWRkKCd0YWJsZWZsaXAnLCBUYWJsZWZsaXAsIHtcblx0ZGVzY3JpcHRpb246ICdTbGFzaF9UYWJsZWZsaXBfRGVzY3JpcHRpb24nLFxuXHRwYXJhbXM6ICd5b3VyX21lc3NhZ2Vfb3B0aW9uYWwnXG59KTtcbiIsIi8qXG4qIFVuZmxpcCBpcyBhIG5hbWVkIGZ1bmN0aW9uIHRoYXQgd2lsbCByZXBsYWNlIC91bmZsaXAgY29tbWFuZHNcbiogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSBvYmplY3RcbiovXG5cblxuZnVuY3Rpb24gVW5mbGlwKGNvbW1hbmQsIHBhcmFtcywgaXRlbSkge1xuXHRpZiAoY29tbWFuZCA9PT0gJ3VuZmxpcCcpIHtcblx0XHRjb25zdCBtc2cgPSBpdGVtO1xuXHRcdG1zZy5tc2cgPSBgJHsgcGFyYW1zIH0g4pSs4pSA4pSsIOODjigg44KcLeOCnOODjilgO1xuXHRcdE1ldGVvci5jYWxsKCdzZW5kTWVzc2FnZScsIG1zZyk7XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5zbGFzaENvbW1hbmRzLmFkZCgndW5mbGlwJywgVW5mbGlwLCB7XG5cdGRlc2NyaXB0aW9uOiAnU2xhc2hfVGFibGVVbmZsaXBfRGVzY3JpcHRpb24nLFxuXHRwYXJhbXM6ICd5b3VyX21lc3NhZ2Vfb3B0aW9uYWwnXG59KTtcbiJdfQ==
