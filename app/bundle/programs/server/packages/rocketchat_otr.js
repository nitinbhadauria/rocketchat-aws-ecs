(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:otr":{"server":{"settings.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/rocketchat_otr/server/settings.js                                                             //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
RocketChat.settings.addGroup('OTR', function () {
	this.add('OTR_Enable', true, {
		type: 'boolean',
		i18nLabel: 'Enabled',
		public: true
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"models":{"Messages.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/rocketchat_otr/server/models/Messages.js                                                      //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
RocketChat.models.Messages.deleteOldOTRMessages = function (roomId, ts) {
	const query = {
		rid: roomId,
		t: 'otr',
		ts: {
			$lte: ts
		}
	};
	return this.remove(query);
};

RocketChat.models.Messages.updateOTRAck = function (_id, otrAck) {
	const query = {
		_id
	};
	const update = {
		$set: {
			otrAck
		}
	};
	return this.update(query, update);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"deleteOldOTRMessages.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/rocketchat_otr/server/methods/deleteOldOTRMessages.js                                         //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
Meteor.methods({
	deleteOldOTRMessages(roomId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'deleteOldOTRMessages'
			});
		}

		const now = new Date();
		const subscription = RocketChat.models.Subscriptions.findOneByRoomIdAndUserId(roomId, Meteor.userId());

		if (subscription && subscription.t === 'd') {
			RocketChat.models.Messages.deleteOldOTRMessages(roomId, now);
		} else {
			throw new Meteor.Error('error-invalid-room', 'Invalid room', {
				method: 'deleteOldOTRMessages'
			});
		}
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"updateOTRAck.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/rocketchat_otr/server/methods/updateOTRAck.js                                                 //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
Meteor.methods({
	updateOTRAck(_id, ack) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'updateOTRAck'
			});
		}

		RocketChat.models.Messages.updateOTRAck(_id, ack);
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:otr/server/settings.js");
require("./node_modules/meteor/rocketchat:otr/server/models/Messages.js");
require("./node_modules/meteor/rocketchat:otr/server/methods/deleteOldOTRMessages.js");
require("./node_modules/meteor/rocketchat:otr/server/methods/updateOTRAck.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:otr'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_otr.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvdHIvc2VydmVyL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om90ci9zZXJ2ZXIvbW9kZWxzL01lc3NhZ2VzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om90ci9zZXJ2ZXIvbWV0aG9kcy9kZWxldGVPbGRPVFJNZXNzYWdlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvdHIvc2VydmVyL21ldGhvZHMvdXBkYXRlT1RSQWNrLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJzZXR0aW5ncyIsImFkZEdyb3VwIiwiYWRkIiwidHlwZSIsImkxOG5MYWJlbCIsInB1YmxpYyIsIm1vZGVscyIsIk1lc3NhZ2VzIiwiZGVsZXRlT2xkT1RSTWVzc2FnZXMiLCJyb29tSWQiLCJ0cyIsInF1ZXJ5IiwicmlkIiwidCIsIiRsdGUiLCJyZW1vdmUiLCJ1cGRhdGVPVFJBY2siLCJfaWQiLCJvdHJBY2siLCJ1cGRhdGUiLCIkc2V0IiwiTWV0ZW9yIiwibWV0aG9kcyIsInVzZXJJZCIsIkVycm9yIiwibWV0aG9kIiwibm93IiwiRGF0ZSIsInN1YnNjcmlwdGlvbiIsIlN1YnNjcmlwdGlvbnMiLCJmaW5kT25lQnlSb29tSWRBbmRVc2VySWQiLCJhY2siXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsV0FBV0MsUUFBWCxDQUFvQkMsUUFBcEIsQ0FBNkIsS0FBN0IsRUFBb0MsWUFBVztBQUM5QyxNQUFLQyxHQUFMLENBQVMsWUFBVCxFQUF1QixJQUF2QixFQUE2QjtBQUM1QkMsUUFBTSxTQURzQjtBQUU1QkMsYUFBVyxTQUZpQjtBQUc1QkMsVUFBUTtBQUhvQixFQUE3QjtBQUtBLENBTkQsRTs7Ozs7Ozs7Ozs7QUNBQU4sV0FBV08sTUFBWCxDQUFrQkMsUUFBbEIsQ0FBMkJDLG9CQUEzQixHQUFrRCxVQUFTQyxNQUFULEVBQWlCQyxFQUFqQixFQUFxQjtBQUN0RSxPQUFNQyxRQUFRO0FBQUVDLE9BQUtILE1BQVA7QUFBZUksS0FBRyxLQUFsQjtBQUF5QkgsTUFBSTtBQUFFSSxTQUFNSjtBQUFSO0FBQTdCLEVBQWQ7QUFDQSxRQUFPLEtBQUtLLE1BQUwsQ0FBWUosS0FBWixDQUFQO0FBQ0EsQ0FIRDs7QUFLQVosV0FBV08sTUFBWCxDQUFrQkMsUUFBbEIsQ0FBMkJTLFlBQTNCLEdBQTBDLFVBQVNDLEdBQVQsRUFBY0MsTUFBZCxFQUFzQjtBQUMvRCxPQUFNUCxRQUFRO0FBQUVNO0FBQUYsRUFBZDtBQUNBLE9BQU1FLFNBQVM7QUFBRUMsUUFBTTtBQUFFRjtBQUFGO0FBQVIsRUFBZjtBQUNBLFFBQU8sS0FBS0MsTUFBTCxDQUFZUixLQUFaLEVBQW1CUSxNQUFuQixDQUFQO0FBQ0EsQ0FKRCxDOzs7Ozs7Ozs7OztBQ0xBRSxPQUFPQyxPQUFQLENBQWU7QUFDZGQsc0JBQXFCQyxNQUFyQixFQUE2QjtBQUM1QixNQUFJLENBQUNZLE9BQU9FLE1BQVAsRUFBTCxFQUFzQjtBQUNyQixTQUFNLElBQUlGLE9BQU9HLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQUVDLFlBQVE7QUFBVixJQUF2RCxDQUFOO0FBQ0E7O0FBRUQsUUFBTUMsTUFBTSxJQUFJQyxJQUFKLEVBQVo7QUFDQSxRQUFNQyxlQUFlN0IsV0FBV08sTUFBWCxDQUFrQnVCLGFBQWxCLENBQWdDQyx3QkFBaEMsQ0FBeURyQixNQUF6RCxFQUFpRVksT0FBT0UsTUFBUCxFQUFqRSxDQUFyQjs7QUFDQSxNQUFJSyxnQkFBZ0JBLGFBQWFmLENBQWIsS0FBbUIsR0FBdkMsRUFBNEM7QUFDM0NkLGNBQVdPLE1BQVgsQ0FBa0JDLFFBQWxCLENBQTJCQyxvQkFBM0IsQ0FBZ0RDLE1BQWhELEVBQXdEaUIsR0FBeEQ7QUFDQSxHQUZELE1BRU87QUFDTixTQUFNLElBQUlMLE9BQU9HLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQUVDLFlBQVE7QUFBVixJQUF2RCxDQUFOO0FBQ0E7QUFDRDs7QUFiYSxDQUFmLEU7Ozs7Ozs7Ozs7O0FDQUFKLE9BQU9DLE9BQVAsQ0FBZTtBQUNkTixjQUFhQyxHQUFiLEVBQWtCYyxHQUFsQixFQUF1QjtBQUN0QixNQUFJLENBQUNWLE9BQU9FLE1BQVAsRUFBTCxFQUFzQjtBQUNyQixTQUFNLElBQUlGLE9BQU9HLEtBQVgsQ0FBaUIsb0JBQWpCLEVBQXVDLGNBQXZDLEVBQXVEO0FBQUVDLFlBQVE7QUFBVixJQUF2RCxDQUFOO0FBQ0E7O0FBQ0QxQixhQUFXTyxNQUFYLENBQWtCQyxRQUFsQixDQUEyQlMsWUFBM0IsQ0FBd0NDLEdBQXhDLEVBQTZDYyxHQUE3QztBQUNBOztBQU5hLENBQWYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9vdHIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdPVFInLCBmdW5jdGlvbigpIHtcblx0dGhpcy5hZGQoJ09UUl9FbmFibGUnLCB0cnVlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGkxOG5MYWJlbDogJ0VuYWJsZWQnLFxuXHRcdHB1YmxpYzogdHJ1ZVxuXHR9KTtcbn0pO1xuIiwiUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZGVsZXRlT2xkT1RSTWVzc2FnZXMgPSBmdW5jdGlvbihyb29tSWQsIHRzKSB7XG5cdGNvbnN0IHF1ZXJ5ID0geyByaWQ6IHJvb21JZCwgdDogJ290cicsIHRzOiB7ICRsdGU6IHRzIH0gfTtcblx0cmV0dXJuIHRoaXMucmVtb3ZlKHF1ZXJ5KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnVwZGF0ZU9UUkFjayA9IGZ1bmN0aW9uKF9pZCwgb3RyQWNrKSB7XG5cdGNvbnN0IHF1ZXJ5ID0geyBfaWQgfTtcblx0Y29uc3QgdXBkYXRlID0geyAkc2V0OiB7IG90ckFjayB9IH07XG5cdHJldHVybiB0aGlzLnVwZGF0ZShxdWVyeSwgdXBkYXRlKTtcbn07XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdGRlbGV0ZU9sZE9UUk1lc3NhZ2VzKHJvb21JZCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdkZWxldGVPbGRPVFJNZXNzYWdlcycgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLmZpbmRPbmVCeVJvb21JZEFuZFVzZXJJZChyb29tSWQsIE1ldGVvci51c2VySWQoKSk7XG5cdFx0aWYgKHN1YnNjcmlwdGlvbiAmJiBzdWJzY3JpcHRpb24udCA9PT0gJ2QnKSB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5kZWxldGVPbGRPVFJNZXNzYWdlcyhyb29tSWQsIG5vdyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7IG1ldGhvZDogJ2RlbGV0ZU9sZE9UUk1lc3NhZ2VzJyB9KTtcblx0XHR9XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHR1cGRhdGVPVFJBY2soX2lkLCBhY2spIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAndXBkYXRlT1RSQWNrJyB9KTtcblx0XHR9XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMudXBkYXRlT1RSQWNrKF9pZCwgYWNrKTtcblx0fVxufSk7XG4iXX0=
