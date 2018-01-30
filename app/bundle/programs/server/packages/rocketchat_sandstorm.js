(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var FlowRouter = Package['kadira:flow-router'].FlowRouter;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var getHttpBridge, waitPromise;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:sandstorm":{"server":{"lib.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_sandstorm/server/lib.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals getHttpBridge, waitPromise, UploadFS */ /* exported getHttpBridge, waitPromise */RocketChat.Sandstorm = {};

if (process.env.SANDSTORM === '1') {
	const Future = Npm.require('fibers/future');

	const Capnp = Npm.require('/node_modules/capnp.js');

	const SandstormHttpBridge = Capnp.importSystem('sandstorm/sandstorm-http-bridge.capnp').SandstormHttpBridge;
	let capnpConnection = null;
	let httpBridge = null;

	getHttpBridge = function () {
		if (!httpBridge) {
			capnpConnection = Capnp.connect('unix:/tmp/sandstorm-api');
			httpBridge = capnpConnection.restore(null, SandstormHttpBridge);
		}

		return httpBridge;
	};

	const promiseToFuture = function (promise) {
		const result = new Future();
		promise.then(result.return.bind(result), result.throw.bind(result));
		return result;
	};

	waitPromise = function (promise) {
		return promiseToFuture(promise).wait();
	}; // This usual implementation of this method returns an absolute URL that is invalid
	// under Sandstorm.


	UploadFS.Store.prototype.getURL = function (path) {
		return this.getRelativeURL(path);
	};
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"events.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_sandstorm/server/events.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.Sandstorm.notify = function () {};

if (process.env.SANDSTORM === '1') {
	const ACTIVITY_TYPES = {
		'message': 0,
		'privateMessage': 1
	};

	RocketChat.Sandstorm.notify = function (message, userIds, caption, type) {
		const sessionId = message.sandstormSessionId;

		if (!sessionId) {
			return;
		}

		const httpBridge = getHttpBridge();
		const activity = {};

		if (type) {
			activity.type = ACTIVITY_TYPES[type];
		}

		if (caption) {
			activity.notification = {
				caption: {
					defaultText: caption
				}
			};
		}

		if (userIds) {
			activity.users = _.map(userIds, function (userId) {
				const user = Meteor.users.findOne({
					_id: userId
				}, {
					fields: {
						'services.sandstorm.id': 1
					}
				});
				return {
					identity: waitPromise(httpBridge.getSavedIdentity(user.services.sandstorm.id)).identity,
					mentioned: true
				};
			});
		}

		return waitPromise(httpBridge.getSessionContext(sessionId).context.activity(activity));
	};
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"powerbox.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_sandstorm/server/powerbox.js                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals getHttpBridge, waitPromise */RocketChat.Sandstorm.offerUiView = function () {};

if (process.env.SANDSTORM === '1') {
	const Capnp = Npm.require('/node_modules/capnp.js');

	const Powerbox = Capnp.importSystem('sandstorm/powerbox.capnp');
	const Grain = Capnp.importSystem('sandstorm/grain.capnp');

	RocketChat.Sandstorm.offerUiView = function (token, serializedDescriptor, sessionId) {
		const httpBridge = getHttpBridge();
		const session = httpBridge.getSessionContext(sessionId).context;
		const api = httpBridge.getSandstormApi(sessionId).api;
		const cap = waitPromise(api.restore(new Buffer(token, 'base64'))).cap;
		return waitPromise(session.offer(cap, undefined, {
			tags: [{
				id: '15831515641881813735',
				value: new Buffer(serializedDescriptor, 'base64')
			}]
		}));
	};

	Meteor.methods({
		sandstormClaimRequest(token, serializedDescriptor) {
			const descriptor = Capnp.parsePacked(Powerbox.PowerboxDescriptor, new Buffer(serializedDescriptor, 'base64'));
			const grainTitle = Capnp.parse(Grain.UiView.PowerboxTag, descriptor.tags[0].value).title;
			const sessionId = this.connection.sandstormSessionId();
			const httpBridge = getHttpBridge();
			const session = httpBridge.getSessionContext(sessionId).context;
			const cap = waitPromise(session.claimRequest(token)).cap.castAs(Grain.UiView);
			const api = httpBridge.getSandstormApi(sessionId).api;
			const newToken = waitPromise(api.save(cap)).token.toString('base64');
			const viewInfo = waitPromise(cap.getViewInfo());
			const appTitle = viewInfo.appTitle;
			const asset = waitPromise(viewInfo.grainIcon.getUrl());
			const appIconUrl = `${asset.protocol}://${asset.hostPath}`;
			return {
				token: newToken,
				appTitle,
				appIconUrl,
				grainTitle,
				descriptor: descriptor.tags[0].value.toString('base64')
			};
		},

		sandstormOffer(token, serializedDescriptor) {
			RocketChat.Sandstorm.offerUiView(token, serializedDescriptor, this.connection.sandstormSessionId());
		}

	});
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:sandstorm/server/lib.js");
require("./node_modules/meteor/rocketchat:sandstorm/server/events.js");
require("./node_modules/meteor/rocketchat:sandstorm/server/powerbox.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:sandstorm'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_sandstorm.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzYW5kc3Rvcm0vc2VydmVyL2xpYi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzYW5kc3Rvcm0vc2VydmVyL2V2ZW50cy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzYW5kc3Rvcm0vc2VydmVyL3Bvd2VyYm94LmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJTYW5kc3Rvcm0iLCJwcm9jZXNzIiwiZW52IiwiU0FORFNUT1JNIiwiRnV0dXJlIiwiTnBtIiwicmVxdWlyZSIsIkNhcG5wIiwiU2FuZHN0b3JtSHR0cEJyaWRnZSIsImltcG9ydFN5c3RlbSIsImNhcG5wQ29ubmVjdGlvbiIsImh0dHBCcmlkZ2UiLCJnZXRIdHRwQnJpZGdlIiwiY29ubmVjdCIsInJlc3RvcmUiLCJwcm9taXNlVG9GdXR1cmUiLCJwcm9taXNlIiwicmVzdWx0IiwidGhlbiIsInJldHVybiIsImJpbmQiLCJ0aHJvdyIsIndhaXRQcm9taXNlIiwid2FpdCIsIlVwbG9hZEZTIiwiU3RvcmUiLCJwcm90b3R5cGUiLCJnZXRVUkwiLCJwYXRoIiwiZ2V0UmVsYXRpdmVVUkwiLCJfIiwibW9kdWxlIiwid2F0Y2giLCJkZWZhdWx0IiwidiIsIm5vdGlmeSIsIkFDVElWSVRZX1RZUEVTIiwibWVzc2FnZSIsInVzZXJJZHMiLCJjYXB0aW9uIiwidHlwZSIsInNlc3Npb25JZCIsInNhbmRzdG9ybVNlc3Npb25JZCIsImFjdGl2aXR5Iiwibm90aWZpY2F0aW9uIiwiZGVmYXVsdFRleHQiLCJ1c2VycyIsIm1hcCIsInVzZXJJZCIsInVzZXIiLCJNZXRlb3IiLCJmaW5kT25lIiwiX2lkIiwiZmllbGRzIiwiaWRlbnRpdHkiLCJnZXRTYXZlZElkZW50aXR5Iiwic2VydmljZXMiLCJzYW5kc3Rvcm0iLCJpZCIsIm1lbnRpb25lZCIsImdldFNlc3Npb25Db250ZXh0IiwiY29udGV4dCIsIm9mZmVyVWlWaWV3IiwiUG93ZXJib3giLCJHcmFpbiIsInRva2VuIiwic2VyaWFsaXplZERlc2NyaXB0b3IiLCJzZXNzaW9uIiwiYXBpIiwiZ2V0U2FuZHN0b3JtQXBpIiwiY2FwIiwiQnVmZmVyIiwib2ZmZXIiLCJ1bmRlZmluZWQiLCJ0YWdzIiwidmFsdWUiLCJtZXRob2RzIiwic2FuZHN0b3JtQ2xhaW1SZXF1ZXN0IiwiZGVzY3JpcHRvciIsInBhcnNlUGFja2VkIiwiUG93ZXJib3hEZXNjcmlwdG9yIiwiZ3JhaW5UaXRsZSIsInBhcnNlIiwiVWlWaWV3IiwiUG93ZXJib3hUYWciLCJ0aXRsZSIsImNvbm5lY3Rpb24iLCJjbGFpbVJlcXVlc3QiLCJjYXN0QXMiLCJuZXdUb2tlbiIsInNhdmUiLCJ0b1N0cmluZyIsInZpZXdJbmZvIiwiZ2V0Vmlld0luZm8iLCJhcHBUaXRsZSIsImFzc2V0IiwiZ3JhaW5JY29uIiwiZ2V0VXJsIiwiYXBwSWNvblVybCIsInByb3RvY29sIiwiaG9zdFBhdGgiLCJzYW5kc3Rvcm1PZmZlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxrRCxDQUNBLHlDQUVBQSxXQUFXQyxTQUFYLEdBQXVCLEVBQXZCOztBQUVBLElBQUlDLFFBQVFDLEdBQVIsQ0FBWUMsU0FBWixLQUEwQixHQUE5QixFQUFtQztBQUNsQyxPQUFNQyxTQUFTQyxJQUFJQyxPQUFKLENBQVksZUFBWixDQUFmOztBQUNBLE9BQU1DLFFBQVFGLElBQUlDLE9BQUosQ0FBWSx3QkFBWixDQUFkOztBQUNBLE9BQU1FLHNCQUFzQkQsTUFBTUUsWUFBTixDQUFtQix1Q0FBbkIsRUFBNERELG1CQUF4RjtBQUVBLEtBQUlFLGtCQUFrQixJQUF0QjtBQUNBLEtBQUlDLGFBQWEsSUFBakI7O0FBRUFDLGlCQUFnQixZQUFXO0FBQzFCLE1BQUksQ0FBQ0QsVUFBTCxFQUFpQjtBQUNoQkQscUJBQWtCSCxNQUFNTSxPQUFOLENBQWMseUJBQWQsQ0FBbEI7QUFDQUYsZ0JB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QUwsQ0FBZ0I1QyxrQkFBaEIsRUFERDtBQUVBOztBQXpCYSxFQUFmO0FBMkJBLEMiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfc2FuZHN0b3JtLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBnZXRIdHRwQnJpZGdlLCB3YWl0UHJvbWlzZSwgVXBsb2FkRlMgKi9cbi8qIGV4cG9ydGVkIGdldEh0dHBCcmlkZ2UsIHdhaXRQcm9taXNlICovXG5cblJvY2tldENoYXQuU2FuZHN0b3JtID0ge307XG5cbmlmIChwcm9jZXNzLmVudi5TQU5EU1RPUk0gPT09ICcxJykge1xuXHRjb25zdCBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xuXHRjb25zdCBDYXBucCA9IE5wbS5yZXF1aXJlKCcvbm9kZV9tb2R1bGVzL2NhcG5wLmpzJyk7XG5cdGNvbnN0IFNhbmRzdG9ybUh0dHBCcmlkZ2UgPSBDYXBucC5pbXBvcnRTeXN0ZW0oJ3NhbmRzdG9ybS9zYW5kc3Rvcm0taHR0cC1icmlkZ2UuY2FwbnAnKS5TYW5kc3Rvcm1IdHRwQnJpZGdlO1xuXG5cdGxldCBjYXBucENvbm5lY3Rpb24gPSBudWxsO1xuXHRsZXQgaHR0cEJyaWRnZSA9IG51bGw7XG5cblx0Z2V0SHR0cEJyaWRnZSA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICghaHR0cEJyaWRnZSkge1xuXHRcdFx0Y2FwbnBDb25uZWN0aW9uID0gQ2FwbnAuY29ubmVjdCgndW5peDovdG1wL3NhbmRzdG9ybS1hcGknKTtcblx0XHRcdGh0dHBCcmlkZ2UgPSBjYXBucENvbm5lY3Rpb24ucmVzdG9yZShudWxsLCBTYW5kc3Rvcm1IdHRwQnJpZGdlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGh0dHBCcmlkZ2U7XG5cdH07XG5cblx0Y29uc3QgcHJvbWlzZVRvRnV0dXJlID0gZnVuY3Rpb24ocHJvbWlzZSkge1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBGdXR1cmUoKTtcblx0XHRwcm9taXNlLnRoZW4ocmVzdWx0LnJldHVybi5iaW5kKHJlc3VsdCksIHJlc3VsdC50aHJvdy5iaW5kKHJlc3VsdCkpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cblx0d2FpdFByb21pc2UgPSBmdW5jdGlvbihwcm9taXNlKSB7XG5cdFx0cmV0dXJuIHByb21pc2VUb0Z1dHVyZShwcm9taXNlKS53YWl0KCk7XG5cdH07XG5cblx0Ly8gVGhpcyB1c3VhbCBpbXBsZW1lbnRhdGlvbiBvZiB0aGlzIG1ldGhvZCByZXR1cm5zIGFuIGFic29sdXRlIFVSTCB0aGF0IGlzIGludmFsaWRcblx0Ly8gdW5kZXIgU2FuZHN0b3JtLlxuXHRVcGxvYWRGUy5TdG9yZS5wcm90b3R5cGUuZ2V0VVJMID0gZnVuY3Rpb24ocGF0aCkge1xuXHRcdHJldHVybiB0aGlzLmdldFJlbGF0aXZlVVJMKHBhdGgpO1xuXHR9O1xufVxuIiwiLyogZ2xvYmFscyBnZXRIdHRwQnJpZGdlLCB3YWl0UHJvbWlzZSAqL1xuXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuUm9ja2V0Q2hhdC5TYW5kc3Rvcm0ubm90aWZ5ID0gZnVuY3Rpb24oKSB7fTtcblxuaWYgKHByb2Nlc3MuZW52LlNBTkRTVE9STSA9PT0gJzEnKSB7XG5cdGNvbnN0IEFDVElWSVRZX1RZUEVTID0ge1xuXHRcdCdtZXNzYWdlJzogMCxcblx0XHQncHJpdmF0ZU1lc3NhZ2UnOiAxXG5cdH07XG5cblx0Um9ja2V0Q2hhdC5TYW5kc3Rvcm0ubm90aWZ5ID0gZnVuY3Rpb24obWVzc2FnZSwgdXNlcklkcywgY2FwdGlvbiwgdHlwZSkge1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IG1lc3NhZ2Uuc2FuZHN0b3JtU2Vzc2lvbklkO1xuXHRcdGlmICghc2Vzc2lvbklkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGh0dHBCcmlkZ2UgPSBnZXRIdHRwQnJpZGdlKCk7XG5cdFx0Y29uc3QgYWN0aXZpdHkgPSB7fTtcblxuXHRcdGlmICh0eXBlKSB7XG5cdFx0XHRhY3Rpdml0eS50eXBlID0gQUNUSVZJVFlfVFlQRVNbdHlwZV07XG5cdFx0fVxuXG5cdFx0aWYgKGNhcHRpb24pIHtcblx0XHRcdGFjdGl2aXR5Lm5vdGlmaWNhdGlvbiA9IHtjYXB0aW9uOiB7ZGVmYXVsdFRleHQ6IGNhcHRpb259fTtcblx0XHR9XG5cblx0XHRpZiAodXNlcklkcykge1xuXHRcdFx0YWN0aXZpdHkudXNlcnMgPSBfLm1hcCh1c2VySWRzLCBmdW5jdGlvbih1c2VySWQpIHtcblx0XHRcdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHtfaWQ6IHVzZXJJZH0sIHtmaWVsZHM6IHsnc2VydmljZXMuc2FuZHN0b3JtLmlkJzogMX19KTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZGVudGl0eTogd2FpdFByb21pc2UoaHR0cEJyaWRnZS5nZXRTYXZlZElkZW50aXR5KHVzZXIuc2VydmljZXMuc2FuZHN0b3JtLmlkKSkuaWRlbnRpdHksXG5cdFx0XHRcdFx0bWVudGlvbmVkOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gd2FpdFByb21pc2UoaHR0cEJyaWRnZS5nZXRTZXNzaW9uQ29udGV4dChzZXNzaW9uSWQpLmNvbnRleHQuYWN0aXZpdHkoYWN0aXZpdHkpKTtcblx0fTtcbn1cbiIsIi8qIGdsb2JhbHMgZ2V0SHR0cEJyaWRnZSwgd2FpdFByb21pc2UgKi9cblxuUm9ja2V0Q2hhdC5TYW5kc3Rvcm0ub2ZmZXJVaVZpZXcgPSBmdW5jdGlvbigpIHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuU0FORFNUT1JNID09PSAnMScpIHtcblx0Y29uc3QgQ2FwbnAgPSBOcG0ucmVxdWlyZSgnL25vZGVfbW9kdWxlcy9jYXBucC5qcycpO1xuXHRjb25zdCBQb3dlcmJveCA9IENhcG5wLmltcG9ydFN5c3RlbSgnc2FuZHN0b3JtL3Bvd2VyYm94LmNhcG5wJyk7XG5cdGNvbnN0IEdyYWluID0gQ2FwbnAuaW1wb3J0U3lzdGVtKCdzYW5kc3Rvcm0vZ3JhaW4uY2FwbnAnKTtcblxuXHRSb2NrZXRDaGF0LlNhbmRzdG9ybS5vZmZlclVpVmlldyA9IGZ1bmN0aW9uKHRva2VuLCBzZXJpYWxpemVkRGVzY3JpcHRvciwgc2Vzc2lvbklkKSB7XG5cdFx0Y29uc3QgaHR0cEJyaWRnZSA9IGdldEh0dHBCcmlkZ2UoKTtcblx0XHRjb25zdCBzZXNzaW9uID0gaHR0cEJyaWRnZS5nZXRTZXNzaW9uQ29udGV4dChzZXNzaW9uSWQpLmNvbnRleHQ7XG5cdFx0Y29uc3QgYXBpID0gaHR0cEJyaWRnZS5nZXRTYW5kc3Rvcm1BcGkoc2Vzc2lvbklkKS5hcGk7XG5cdFx0Y29uc3QgY2FwID0gd2FpdFByb21pc2UoYXBpLnJlc3RvcmUobmV3IEJ1ZmZlcih0b2tlbiwgJ2Jhc2U2NCcpKSkuY2FwO1xuXHRcdHJldHVybiB3YWl0UHJvbWlzZShzZXNzaW9uLm9mZmVyKGNhcCwgdW5kZWZpbmVkLCB7dGFnczogW3tcblx0XHRcdGlkOiAnMTU4MzE1MTU2NDE4ODE4MTM3MzUnLFxuXHRcdFx0dmFsdWU6IG5ldyBCdWZmZXIoc2VyaWFsaXplZERlc2NyaXB0b3IsICdiYXNlNjQnKVxuXHRcdH1dfSkpO1xuXHR9O1xuXG5cdE1ldGVvci5tZXRob2RzKHtcblx0XHRzYW5kc3Rvcm1DbGFpbVJlcXVlc3QodG9rZW4sIHNlcmlhbGl6ZWREZXNjcmlwdG9yKSB7XG5cdFx0XHRjb25zdCBkZXNjcmlwdG9yID0gQ2FwbnAucGFyc2VQYWNrZWQoUG93ZXJib3guUG93ZXJib3hEZXNjcmlwdG9yLCBuZXcgQnVmZmVyKHNlcmlhbGl6ZWREZXNjcmlwdG9yLCAnYmFzZTY0JykpO1xuXHRcdFx0Y29uc3QgZ3JhaW5UaXRsZSA9IENhcG5wLnBhcnNlKEdyYWluLlVpVmlldy5Qb3dlcmJveFRhZywgZGVzY3JpcHRvci50YWdzWzBdLnZhbHVlKS50aXRsZTtcblx0XHRcdGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuY29ubmVjdGlvbi5zYW5kc3Rvcm1TZXNzaW9uSWQoKTtcblx0XHRcdGNvbnN0IGh0dHBCcmlkZ2UgPSBnZXRIdHRwQnJpZGdlKCk7XG5cdFx0XHRjb25zdCBzZXNzaW9uID0gaHR0cEJyaWRnZS5nZXRTZXNzaW9uQ29udGV4dChzZXNzaW9uSWQpLmNvbnRleHQ7XG5cdFx0XHRjb25zdCBjYXAgPSB3YWl0UHJvbWlzZShzZXNzaW9uLmNsYWltUmVxdWVzdCh0b2tlbikpLmNhcC5jYXN0QXMoR3JhaW4uVWlWaWV3KTtcblx0XHRcdGNvbnN0IGFwaSA9IGh0dHBCcmlkZ2UuZ2V0U2FuZHN0b3JtQXBpKHNlc3Npb25JZCkuYXBpO1xuXHRcdFx0Y29uc3QgbmV3VG9rZW4gPSB3YWl0UHJvbWlzZShhcGkuc2F2ZShjYXApKS50b2tlbi50b1N0cmluZygnYmFzZTY0Jyk7XG5cdFx0XHRjb25zdCB2aWV3SW5mbyA9IHdhaXRQcm9taXNlKGNhcC5nZXRWaWV3SW5mbygpKTtcblx0XHRcdGNvbnN0IGFwcFRpdGxlID0gdmlld0luZm8uYXBwVGl0bGU7XG5cdFx0XHRjb25zdCBhc3NldCA9IHdhaXRQcm9taXNlKHZpZXdJbmZvLmdyYWluSWNvbi5nZXRVcmwoKSk7XG5cdFx0XHRjb25zdCBhcHBJY29uVXJsID0gYCR7IGFzc2V0LnByb3RvY29sIH06Ly8keyBhc3NldC5ob3N0UGF0aCB9YDtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHRva2VuOiBuZXdUb2tlbixcblx0XHRcdFx0YXBwVGl0bGUsXG5cdFx0XHRcdGFwcEljb25VcmwsXG5cdFx0XHRcdGdyYWluVGl0bGUsXG5cdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IudGFnc1swXS52YWx1ZS50b1N0cmluZygnYmFzZTY0Jylcblx0XHRcdH07XG5cdFx0fSxcblx0XHRzYW5kc3Rvcm1PZmZlcih0b2tlbiwgc2VyaWFsaXplZERlc2NyaXB0b3IpIHtcblx0XHRcdFJvY2tldENoYXQuU2FuZHN0b3JtLm9mZmVyVWlWaWV3KHRva2VuLCBzZXJpYWxpemVkRGVzY3JpcHRvcixcblx0XHRcdFx0dGhpcy5jb25uZWN0aW9uLnNhbmRzdG9ybVNlc3Npb25JZCgpKTtcblx0XHR9XG5cdH0pO1xufVxuIl19
