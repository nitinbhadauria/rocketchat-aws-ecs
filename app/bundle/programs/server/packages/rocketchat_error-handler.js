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

/* Package-scope variables */
var roomName, message;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:error-handler":{"server":{"lib":{"RocketChat.ErrorHandler.js":function(){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// packages/rocketchat_error-handler/server/lib/RocketChat.ErrorHandler. //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
class ErrorHandler {
	constructor() {
		this.reporting = false;
		this.rid = null;
		this.lastError = null;
		this.registerHandlers();
		RocketChat.settings.get('Log_Exceptions_to_Channel', (key, value) => {
			if (value.trim()) {
				this.reporting = true;
				this.rid = this.getRoomId(value);
			} else {
				this.reporting = false;
				this.rid = '';
			}
		});
	}

	registerHandlers() {
		process.on('uncaughtException', Meteor.bindEnvironment(error => {
			if (!this.reporting) {
				return;
			}

			this.trackError(error.message, error.stack);
		}));
		const self = this;
		const originalMeteorDebug = Meteor._debug;

		Meteor._debug = function (message, stack) {
			if (!self.reporting) {
				return originalMeteorDebug.call(this, message, stack);
			}

			self.trackError(message, stack);
			return originalMeteorDebug.apply(this, arguments);
		};
	}

	getRoomId(roomName) {
		roomName = roomName.replace('#');
		const room = RocketChat.models.Rooms.findOneByName(roomName, {
			fields: {
				_id: 1,
				t: 1
			}
		});

		if (room && (room.t === 'c' || room.t === 'p')) {
			return room._id;
		} else {
			this.reporting = false;
		}
	}

	trackError(message, stack) {
		if (this.reporting && this.rid && this.lastError !== message) {
			this.lastError = message;
			const user = RocketChat.models.Users.findOneById('rocket.cat');

			if (stack) {
				message = `${message}\n\`\`\`\n${stack}\n\`\`\``;
			}

			RocketChat.sendMessage(user, {
				msg: message
			}, {
				_id: this.rid
			});
		}
	}

}

RocketChat.ErrorHandler = new ErrorHandler();
///////////////////////////////////////////////////////////////////////////

}},"startup":{"settings.js":function(){

///////////////////////////////////////////////////////////////////////////
//                                                                       //
// packages/rocketchat_error-handler/server/startup/settings.js          //
//                                                                       //
///////////////////////////////////////////////////////////////////////////
                                                                         //
RocketChat.settings.addGroup('Logs', function () {
	this.add('Log_Exceptions_to_Channel', '', {
		type: 'string'
	});
});
///////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:error-handler/server/lib/RocketChat.ErrorHandler.js");
require("./node_modules/meteor/rocketchat:error-handler/server/startup/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:error-handler'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_error-handler.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDplcnJvci1oYW5kbGVyL3NlcnZlci9saWIvUm9ja2V0Q2hhdC5FcnJvckhhbmRsZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZXJyb3ItaGFuZGxlci9zZXJ2ZXIvc3RhcnR1cC9zZXR0aW5ncy5qcyJdLCJuYW1lcyI6WyJFcnJvckhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsInJlcG9ydGluZyIsInJpZCIsImxhc3RFcnJvciIsInJlZ2lzdGVySGFuZGxlcnMiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJrZXkiLCJ2YWx1ZSIsInRyaW0iLCJnZXRSb29tSWQiLCJwcm9jZXNzIiwib24iLCJNZXRlb3IiLCJiaW5kRW52aXJvbm1lbnQiLCJlcnJvciIsInRyYWNrRXJyb3IiLCJtZXNzYWdlIiwic3RhY2siLCJzZWxmIiwib3JpZ2luYWxNZXRlb3JEZWJ1ZyIsIl9kZWJ1ZyIsImNhbGwiLCJhcHBseSIsImFyZ3VtZW50cyIsInJvb21OYW1lIiwicmVwbGFjZSIsInJvb20iLCJtb2RlbHMiLCJSb29tcyIsImZpbmRPbmVCeU5hbWUiLCJmaWVsZHMiLCJfaWQiLCJ0IiwidXNlciIsIlVzZXJzIiwiZmluZE9uZUJ5SWQiLCJzZW5kTWVzc2FnZSIsIm1zZyIsImFkZEdyb3VwIiwiYWRkIiwidHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLE1BQU1BLFlBQU4sQ0FBbUI7QUFDbEJDLGVBQWM7QUFDYixPQUFLQyxTQUFMLEdBQWlCLEtBQWpCO0FBQ0EsT0FBS0MsR0FBTCxHQUFXLElBQVg7QUFDQSxPQUFLQyxTQUFMLEdBQWlCLElBQWpCO0FBRUEsT0FBS0MsZ0JBQUw7QUFFQUMsYUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsMkJBQXhCLEVBQXFELENBQUNDLEdBQUQsRUFBTUMsS0FBTixLQUFnQjtBQUNwRSxPQUFJQSxNQUFNQyxJQUFOLEVBQUosRUFBa0I7QUFDakIsU0FBS1QsU0FBTCxHQUFpQixJQUFqQjtBQUNBLFNBQUtDLEdBQUwsR0FBVyxLQUFLUyxTQUFMLENBQWVGLEtBQWYsQ0FBWDtBQUNBLElBSEQsTUFHTztBQUNOLFNBQUtSLFNBQUwsR0FBaUIsS0FBakI7QUFDQSxTQUFLQyxHQUFMLEdBQVcsRUFBWDtBQUNBO0FBQ0QsR0FSRDtBQVNBOztBQUVERSxvQkFBbUI7QUFDbEJRLFVBQVFDLEVBQVIsQ0FBVyxtQkFBWCxFQUFnQ0MsT0FBT0MsZUFBUCxDQUF3QkMsS0FBRCxJQUFXO0FBQ2pFLE9BQUksQ0FBQyxLQUFLZixTQUFWLEVBQXFCO0FBQ3BCO0FBQ0E7O0FBQ0QsUUFBS2dCLFVBQUwsQ0FBZ0JELE1BQU1FLE9BQXRCLEVBQStCRixNQUFNRyxLQUFyQztBQUNBLEdBTCtCLENBQWhDO0FBT0EsUUFBTUMsT0FBTyxJQUFiO0FBQ0EsUUFBTUMsc0JBQXNCUCxPQUFPUSxNQUFuQzs7QUFDQVIsU0FBT1EsTUFBUCxHQUFnQixVQUFTSixPQUFULEVBQWtCQyxLQUFsQixFQUF5QjtBQUN4QyxPQUFJLENBQUNDLEtBQUtuQixTQUFWLEVBQXFCO0FBQ3BCLFdBQU9vQixvQkFBb0JFLElBQXBCLENBQXlCLElBQXpCLEVBQStCTCxPQUEvQixFQUF3Q0MsS0FBeEMsQ0FBUDtBQUNBOztBQUNEQyxRQUFLSCxVQUFMLENBQWdCQyxPQUFoQixFQUF5QkMsS0FBekI7QUFDQSxVQUFPRSxvQkFBb0JHLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDQyxTQUFoQyxDQUFQO0FBQ0EsR0FORDtBQU9BOztBQUVEZCxXQUFVZSxRQUFWLEVBQW9CO0FBQ25CQSxhQUFXQSxTQUFTQyxPQUFULENBQWlCLEdBQWpCLENBQVg7QUFDQSxRQUFNQyxPQUFPdkIsV0FBV3dCLE1BQVgsQ0FBa0JDLEtBQWxCLENBQXdCQyxhQUF4QixDQUFzQ0wsUUFBdEMsRUFBZ0Q7QUFBRU0sV0FBUTtBQUFFQyxTQUFLLENBQVA7QUFBVUMsT0FBRztBQUFiO0FBQVYsR0FBaEQsQ0FBYjs7QUFDQSxNQUFJTixTQUFTQSxLQUFLTSxDQUFMLEtBQVcsR0FBWCxJQUFrQk4sS0FBS00sQ0FBTCxLQUFXLEdBQXRDLENBQUosRUFBZ0Q7QUFDL0MsVUFBT04sS0FBS0ssR0FBWjtBQUNBLEdBRkQsTUFFTztBQUNOLFFBQUtoQyxTQUFMLEdBQWlCLEtBQWpCO0FBQ0E7QUFDRDs7QUFFRGdCLFlBQVdDLE9BQVgsRUFBb0JDLEtBQXBCLEVBQTJCO0FBQzFCLE1BQUksS0FBS2xCLFNBQUwsSUFBa0IsS0FBS0MsR0FBdkIsSUFBOEIsS0FBS0MsU0FBTCxLQUFtQmUsT0FBckQsRUFBOEQ7QUFDN0QsUUFBS2YsU0FBTCxHQUFpQmUsT0FBakI7QUFDQSxTQUFNaUIsT0FBTzlCLFdBQVd3QixNQUFYLENBQWtCTyxLQUFsQixDQUF3QkMsV0FBeEIsQ0FBb0MsWUFBcEMsQ0FBYjs7QUFFQSxPQUFJbEIsS0FBSixFQUFXO0FBQ1ZELGNBQVcsR0FBR0EsT0FBUyxhQUFhQyxLQUFPLFVBQTNDO0FBQ0E7O0FBRURkLGNBQVdpQyxXQUFYLENBQXVCSCxJQUF2QixFQUE2QjtBQUFFSSxTQUFLckI7QUFBUCxJQUE3QixFQUErQztBQUFFZSxTQUFLLEtBQUsvQjtBQUFaLElBQS9DO0FBQ0E7QUFDRDs7QUEzRGlCOztBQThEbkJHLFdBQVdOLFlBQVgsR0FBMEIsSUFBSUEsWUFBSixFQUExQixDOzs7Ozs7Ozs7OztBQzlEQU0sV0FBV0MsUUFBWCxDQUFvQmtDLFFBQXBCLENBQTZCLE1BQTdCLEVBQXFDLFlBQVc7QUFDL0MsTUFBS0MsR0FBTCxDQUFTLDJCQUFULEVBQXNDLEVBQXRDLEVBQTBDO0FBQUVDLFFBQU07QUFBUixFQUExQztBQUNBLENBRkQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9lcnJvci1oYW5kbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY2xhc3MgRXJyb3JIYW5kbGVyIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5yZXBvcnRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnJpZCA9IG51bGw7XG5cdFx0dGhpcy5sYXN0RXJyb3IgPSBudWxsO1xuXG5cdFx0dGhpcy5yZWdpc3RlckhhbmRsZXJzKCk7XG5cblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTG9nX0V4Y2VwdGlvbnNfdG9fQ2hhbm5lbCcsIChrZXksIHZhbHVlKSA9PiB7XG5cdFx0XHRpZiAodmFsdWUudHJpbSgpKSB7XG5cdFx0XHRcdHRoaXMucmVwb3J0aW5nID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5yaWQgPSB0aGlzLmdldFJvb21JZCh2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlcG9ydGluZyA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnJpZCA9ICcnO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmVnaXN0ZXJIYW5kbGVycygpIHtcblx0XHRwcm9jZXNzLm9uKCd1bmNhdWdodEV4Y2VwdGlvbicsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKGVycm9yKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMucmVwb3J0aW5nKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMudHJhY2tFcnJvcihlcnJvci5tZXNzYWdlLCBlcnJvci5zdGFjayk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cdFx0Y29uc3Qgb3JpZ2luYWxNZXRlb3JEZWJ1ZyA9IE1ldGVvci5fZGVidWc7XG5cdFx0TWV0ZW9yLl9kZWJ1ZyA9IGZ1bmN0aW9uKG1lc3NhZ2UsIHN0YWNrKSB7XG5cdFx0XHRpZiAoIXNlbGYucmVwb3J0aW5nKSB7XG5cdFx0XHRcdHJldHVybiBvcmlnaW5hbE1ldGVvckRlYnVnLmNhbGwodGhpcywgbWVzc2FnZSwgc3RhY2spO1xuXHRcdFx0fVxuXHRcdFx0c2VsZi50cmFja0Vycm9yKG1lc3NhZ2UsIHN0YWNrKTtcblx0XHRcdHJldHVybiBvcmlnaW5hbE1ldGVvckRlYnVnLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0fTtcblx0fVxuXG5cdGdldFJvb21JZChyb29tTmFtZSkge1xuXHRcdHJvb21OYW1lID0gcm9vbU5hbWUucmVwbGFjZSgnIycpO1xuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKHJvb21OYW1lLCB7IGZpZWxkczogeyBfaWQ6IDEsIHQ6IDEgfSB9KTtcblx0XHRpZiAocm9vbSAmJiAocm9vbS50ID09PSAnYycgfHwgcm9vbS50ID09PSAncCcpKSB7XG5cdFx0XHRyZXR1cm4gcm9vbS5faWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVwb3J0aW5nID0gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0dHJhY2tFcnJvcihtZXNzYWdlLCBzdGFjaykge1xuXHRcdGlmICh0aGlzLnJlcG9ydGluZyAmJiB0aGlzLnJpZCAmJiB0aGlzLmxhc3RFcnJvciAhPT0gbWVzc2FnZSkge1xuXHRcdFx0dGhpcy5sYXN0RXJyb3IgPSBtZXNzYWdlO1xuXHRcdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKCdyb2NrZXQuY2F0Jyk7XG5cblx0XHRcdGlmIChzdGFjaykge1xuXHRcdFx0XHRtZXNzYWdlID0gYCR7IG1lc3NhZ2UgfVxcblxcYFxcYFxcYFxcbiR7IHN0YWNrIH1cXG5cXGBcXGBcXGBgO1xuXHRcdFx0fVxuXG5cdFx0XHRSb2NrZXRDaGF0LnNlbmRNZXNzYWdlKHVzZXIsIHsgbXNnOiBtZXNzYWdlIH0sIHsgX2lkOiB0aGlzLnJpZCB9KTtcblx0XHR9XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5FcnJvckhhbmRsZXIgPSBuZXcgRXJyb3JIYW5kbGVyO1xuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnTG9ncycsIGZ1bmN0aW9uKCkge1xuXHR0aGlzLmFkZCgnTG9nX0V4Y2VwdGlvbnNfdG9fQ2hhbm5lbCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnIH0pO1xufSk7XG4iXX0=
