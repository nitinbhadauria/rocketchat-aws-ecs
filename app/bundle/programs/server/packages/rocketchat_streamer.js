(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var DDPCommon = Package['ddp-common'].DDPCommon;
var ECMAScript = Package.ecmascript.ECMAScript;
var check = Package.check.check;
var Match = Package.check.Match;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var EV, self, fn, eventName, args, Streamer;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:streamer":{"lib":{"ev.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_streamer/lib/ev.js                                                              //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
/* globals EV:true */ /* exported EV */EV = class EV {
	constructor() {
		this.handlers = {};
	}

	emit(event, ...args) {
		if (this.handlers[event]) {
			this.handlers[event].forEach(handler => handler.apply(this, args));
		}
	}

	emitWithScope(event, scope, ...args) {
		if (this.handlers[event]) {
			this.handlers[event].forEach(handler => handler.apply(scope, args));
		}
	}

	on(event, callback) {
		if (!this.handlers[event]) {
			this.handlers[event] = [];
		}

		this.handlers[event].push(callback);
	}

	once(event, callback) {
		self = this;
		self.on(event, function onetimeCallback() {
			callback.apply(this, arguments);
			self.removeListener(event, onetimeCallback);
		});
	}

	removeListener(event, callback) {
		if (this.handlers[event]) {
			const index = this.handlers[event].indexOf(callback);

			if (index > -1) {
				this.handlers[event].splice(index, 1);
			}
		}
	}

	removeAllListeners(event) {
		this.handlers[event] = undefined;
	}

};
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"server.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_streamer/server/server.js                                                       //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
/* globals EV */ /* eslint new-cap: false */class StreamerCentral extends EV {
	constructor() {
		super();
		this.instances = {};
	}

}

Meteor.StreamerCentral = new StreamerCentral();
Meteor.Streamer = class Streamer extends EV {
	constructor(name, {
		retransmit = true,
		retransmitToSelf = false
	} = {}) {
		if (Meteor.StreamerCentral.instances[name]) {
			console.warn('Streamer instance already exists:', name);
			return Meteor.StreamerCentral.instances[name];
		}

		super();
		Meteor.StreamerCentral.instances[name] = this;
		this.name = name;
		this.retransmit = retransmit;
		this.retransmitToSelf = retransmitToSelf;
		this.subscriptions = [];
		this.subscriptionsByEventName = {};
		this.transformers = {};
		this.iniPublication();
		this.initMethod();
		this._allowRead = {};
		this._allowEmit = {};
		this._allowWrite = {};
		this.allowRead('none');
		this.allowEmit('all');
		this.allowWrite('none');
	}

	get name() {
		return this._name;
	}

	set name(name) {
		check(name, String);
		this._name = name;
	}

	get subscriptionName() {
		return `stream-${this.name}`;
	}

	get retransmit() {
		return this._retransmit;
	}

	set retransmit(retransmit) {
		check(retransmit, Boolean);
		this._retransmit = retransmit;
	}

	get retransmitToSelf() {
		return this._retransmitToSelf;
	}

	set retransmitToSelf(retransmitToSelf) {
		check(retransmitToSelf, Boolean);
		this._retransmitToSelf = retransmitToSelf;
	}

	allowRead(eventName, fn) {
		if (fn === undefined) {
			fn = eventName;
			eventName = '__all__';
		}

		if (typeof fn === 'function') {
			return this._allowRead[eventName] = fn;
		}

		if (typeof fn === 'string' && ['all', 'none', 'logged'].indexOf(fn) === -1) {
			console.error(`allowRead shortcut '${fn}' is invalid`);
		}

		if (fn === 'all' || fn === true) {
			return this._allowRead[eventName] = function () {
				return true;
			};
		}

		if (fn === 'none' || fn === false) {
			return this._allowRead[eventName] = function () {
				return false;
			};
		}

		if (fn === 'logged') {
			return this._allowRead[eventName] = function () {
				return Boolean(this.userId);
			};
		}
	}

	allowEmit(eventName, fn) {
		if (fn === undefined) {
			fn = eventName;
			eventName = '__all__';
		}

		if (typeof fn === 'function') {
			return this._allowEmit[eventName] = fn;
		}

		if (typeof fn === 'string' && ['all', 'none', 'logged'].indexOf(fn) === -1) {
			console.error(`allowRead shortcut '${fn}' is invalid`);
		}

		if (fn === 'all' || fn === true) {
			return this._allowEmit[eventName] = function () {
				return true;
			};
		}

		if (fn === 'none' || fn === false) {
			return this._allowEmit[eventName] = function () {
				return false;
			};
		}

		if (fn === 'logged') {
			return this._allowEmit[eventName] = function () {
				return Boolean(this.userId);
			};
		}
	}

	allowWrite(eventName, fn) {
		if (fn === undefined) {
			fn = eventName;
			eventName = '__all__';
		}

		if (typeof fn === 'function') {
			return this._allowWrite[eventName] = fn;
		}

		if (typeof fn === 'string' && ['all', 'none', 'logged'].indexOf(fn) === -1) {
			console.error(`allowWrite shortcut '${fn}' is invalid`);
		}

		if (fn === 'all' || fn === true) {
			return this._allowWrite[eventName] = function () {
				return true;
			};
		}

		if (fn === 'none' || fn === false) {
			return this._allowWrite[eventName] = function () {
				return false;
			};
		}

		if (fn === 'logged') {
			return this._allowWrite[eventName] = function () {
				return Boolean(this.userId);
			};
		}
	}

	isReadAllowed(scope, eventName, args) {
		if (this._allowRead[eventName]) {
			return this._allowRead[eventName].call(scope, eventName, ...args);
		}

		return this._allowRead['__all__'].call(scope, eventName, ...args);
	}

	isEmitAllowed(scope, eventName, ...args) {
		if (this._allowEmit[eventName]) {
			return this._allowEmit[eventName].call(scope, eventName, ...args);
		}

		return this._allowEmit['__all__'].call(scope, eventName, ...args);
	}

	isWriteAllowed(scope, eventName, args) {
		if (this._allowWrite[eventName]) {
			return this._allowWrite[eventName].call(scope, eventName, ...args);
		}

		return this._allowWrite['__all__'].call(scope, eventName, ...args);
	}

	addSubscription(subscription, eventName) {
		this.subscriptions.push(subscription);

		if (!this.subscriptionsByEventName[eventName]) {
			this.subscriptionsByEventName[eventName] = [];
		}

		this.subscriptionsByEventName[eventName].push(subscription);
	}

	removeSubscription(subscription, eventName) {
		const index = this.subscriptions.indexOf(subscription);

		if (index > -1) {
			this.subscriptions.splice(index, 1);
		}

		if (this.subscriptionsByEventName[eventName]) {
			const index = this.subscriptionsByEventName[eventName].indexOf(subscription);

			if (index > -1) {
				this.subscriptionsByEventName[eventName].splice(index, 1);
			}
		}
	}

	transform(eventName, fn) {
		if (typeof eventName === 'function') {
			fn = eventName;
			eventName = '__all__';
		}

		if (!this.transformers[eventName]) {
			this.transformers[eventName] = [];
		}

		this.transformers[eventName].push(fn);
	}

	applyTransformers(methodScope, eventName, args) {
		if (this.transformers['__all__']) {
			this.transformers['__all__'].forEach(transform => {
				args = transform.call(methodScope, eventName, args);
				methodScope.tranformed = true;

				if (!Array.isArray(args)) {
					args = [args];
				}
			});
		}

		if (this.transformers[eventName]) {
			this.transformers[eventName].forEach(transform => {
				args = transform.call(methodScope, ...args);
				methodScope.tranformed = true;

				if (!Array.isArray(args)) {
					args = [args];
				}
			});
		}

		return args;
	}

	iniPublication() {
		const stream = this;
		Meteor.publish(this.subscriptionName, function (eventName, options) {
			check(eventName, String);
			let useCollection,
			    args = [];

			if (typeof options === 'boolean') {
				useCollection = options;
			} else {
				if (options.useCollection) {
					useCollection = options.useCollection;
				}

				if (options.args) {
					args = options.args;
				}
			}

			if (eventName.length === 0) {
				this.stop();
				return;
			}

			if (stream.isReadAllowed(this, eventName, args) !== true) {
				this.stop();
				return;
			}

			const subscription = {
				subscription: this,
				eventName: eventName
			};
			stream.addSubscription(subscription, eventName);
			this.onStop(() => {
				stream.removeSubscription(subscription, eventName);
			});

			if (useCollection === true) {
				// Collection compatibility
				this._session.sendAdded(stream.subscriptionName, 'id', {
					eventName: eventName
				});
			}

			this.ready();
		});
	}

	initMethod() {
		const stream = this;
		const method = {};

		method[this.subscriptionName] = function (eventName, ...args) {
			check(eventName, String);
			check(args, Array);
			this.unblock();

			if (stream.isWriteAllowed(this, eventName, args) !== true) {
				return;
			}

			const methodScope = {
				userId: this.userId,
				connection: this.connection,
				originalParams: args,
				tranformed: false
			};
			args = stream.applyTransformers(methodScope, eventName, args);
			stream.emitWithScope(eventName, methodScope, ...args);

			if (stream.retransmit === true) {
				stream._emit(eventName, args, this.connection, true);
			}
		};

		try {
			Meteor.methods(method);
		} catch (e) {
			console.error(e);
		}
	}

	_emit(eventName, args, origin, broadcast) {
		if (broadcast === true) {
			Meteor.StreamerCentral.emit('broadcast', this.name, eventName, args);
		}

		const subscriptions = this.subscriptionsByEventName[eventName];

		if (!Array.isArray(subscriptions)) {
			return;
		}

		subscriptions.forEach(subscription => {
			if (this.retransmitToSelf === false && origin && origin === subscription.subscription.connection) {
				return;
			}

			if (this.isEmitAllowed(subscription.subscription, eventName, ...args)) {
				subscription.subscription._session.sendChanged(this.subscriptionName, 'id', {
					eventName: eventName,
					args: args
				});
			}
		});
	}

	emit(eventName, ...args) {
		this._emit(eventName, args, undefined, true);
	}

	emitWithoutBroadcast(eventName, ...args) {
		this._emit(eventName, args, undefined, false);
	}

};
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:streamer/lib/ev.js");
require("./node_modules/meteor/rocketchat:streamer/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:streamer'] = {}, {
  Streamer: Streamer
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_streamer.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzdHJlYW1lci9saWIvZXYuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c3RyZWFtZXIvc2VydmVyL3NlcnZlci5qcyJdLCJuYW1lcyI6WyJFViIsImNvbnN0cnVjdG9yIiwiaGFuZGxlcnMiLCJlbWl0IiwiZXZlbnQiLCJhcmdzIiwiZm9yRWFjaCIsImhhbmRsZXIiLCJhcHBseSIsImVtaXRXaXRoU2NvcGUiLCJzY29wZSIsIm9uIiwiY2FsbGJhY2siLCJwdXNoIiwib25jZSIsInNlbGYiLCJvbmV0aW1lQ2FsbGJhY2siLCJhcmd1bWVudHMiLCJyZW1vdmVMaXN0ZW5lciIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInJlbW92ZUFsbExpc3RlbmVycyIsInVuZGVmaW5lZCIsIlN0cmVhbWVyQ2VudHJhbCIsImluc3RhbmNlcyIsIk1ldGVvciIsIlN0cmVhbWVyIiwibmFtZSIsInJldHJhbnNtaXQiLCJyZXRyYW5zbWl0VG9TZWxmIiwiY29uc29sZSIsIndhcm4iLCJzdWJzY3JpcHRpb25zIiwic3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lIiwidHJhbnNmb3JtZXJzIiwiaW5pUHVibGljYXRpb24iLCJpbml0TWV0aG9kIiwiX2FsbG93UmVhZCIsIl9hbGxvd0VtaXQiLCJfYWxsb3dXcml0ZSIsImFsbG93UmVhZCIsImFsbG93RW1pdCIsImFsbG93V3JpdGUiLCJfbmFtZSIsImNoZWNrIiwiU3RyaW5nIiwic3Vic2NyaXB0aW9uTmFtZSIsIl9yZXRyYW5zbWl0IiwiQm9vbGVhbiIsIl9yZXRyYW5zbWl0VG9TZWxmIiwiZXZlbnROYW1lIiwiZm4iLCJlcnJvciIsInVzZXJJZCIsImlzUmVhZEFsbG93ZWQiLCJjYWxsIiwiaXNFbWl0QWxsb3dlZCIsImlzV3JpdGVBbGxvd2VkIiwiYWRkU3Vic2NyaXB0aW9uIiwic3Vic2NyaXB0aW9uIiwicmVtb3ZlU3Vic2NyaXB0aW9uIiwidHJhbnNmb3JtIiwiYXBwbHlUcmFuc2Zvcm1lcnMiLCJtZXRob2RTY29wZSIsInRyYW5mb3JtZWQiLCJBcnJheSIsImlzQXJyYXkiLCJzdHJlYW0iLCJwdWJsaXNoIiwib3B0aW9ucyIsInVzZUNvbGxlY3Rpb24iLCJsZW5ndGgiLCJzdG9wIiwib25TdG9wIiwiX3Nlc3Npb24iLCJzZW5kQWRkZWQiLCJyZWFkeSIsIm1ldGhvZCIsInVuYmxvY2siLCJjb25uZWN0aW9uIiwib3JpZ2luYWxQYXJhbXMiLCJfZW1pdCIsIm1ldGhvZHMiLCJlIiwib3JpZ2luIiwiYnJvYWRjYXN0Iiwic2VuZENoYW5nZWQiLCJlbWl0V2l0aG91dEJyb2FkY2FzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEscUIsQ0FDQSxpQkFFQUEsS0FBSyxNQUFNQSxFQUFOLENBQVM7QUFDYkMsZUFBYztBQUNiLE9BQUtDLFFBQUwsR0FBZ0IsRUFBaEI7QUFDQTs7QUFFREMsTUFBS0MsS0FBTCxFQUFZLEdBQUdDLElBQWYsRUFBcUI7QUFDcEIsTUFBSSxLQUFLSCxRQUFMLENBQWNFLEtBQWQsQ0FBSixFQUEwQjtBQUN6QixRQUFLRixRQUFMLENBQWNFLEtBQWQsRUFBcUJFLE9BQXJCLENBQThCQyxPQUFELElBQWFBLFFBQVFDLEtBQVIsQ0FBYyxJQUFkLEVBQW9CSCxJQUFwQixDQUExQztBQUNBO0FBQ0Q7O0FBRURJLGVBQWNMLEtBQWQsRUFBcUJNLEtBQXJCLEVBQTRCLEdBQUdMLElBQS9CLEVBQXFDO0FBQ3BDLE1BQUksS0FBS0gsUUFBTCxDQUFjRSxLQUFkLENBQUosRUFBMEI7QUFDekIsUUFBS0YsUUFBTCxDQUFjRSxLQUFkLEVBQXFCRSxPQUFyQixDQUE4QkMsT0FBRCxJQUFhQSxRQUFRQyxLQUFSLENBQWNFLEtBQWQsRUFBcUJMLElBQXJCLENBQTFDO0FBQ0E7QUFDRDs7QUFFRE0sSUFBR1AsS0FBSCxFQUFVUSxRQUFWLEVBQW9CO0FBQ25CLE1BQUksQ0FBQyxLQUFLVixR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SSxLQUFLOUIsZ0JBQUwsS0FBMEIsS0FBMUIsSUFBbUN1RCxNQUFuQyxJQUE2Q0EsV0FBV3pCLGFBQWFBLFlBQWIsQ0FBMEJvQixVQUF0RixFQUFrRztBQUNqRztBQUNBOztBQUVELE9BQUksS0FBS3ZCLGFBQUwsQ0FBbUJHLGFBQWFBLFlBQWhDLEVBQThDVCxTQUE5QyxFQUF5RCxHQUFHOUMsSUFBNUQsQ0FBSixFQUF1RTtBQUN0RXVELGlCQUFhQSxZQUFiLENBQTBCZSxRQUExQixDQUFtQ1ksV0FBbkMsQ0FBK0MsS0FBS3hDLGdCQUFwRCxFQUFzRSxJQUF0RSxFQUE0RTtBQUMzRUksZ0JBQVdBLFNBRGdFO0FBRTNFOUMsV0FBTUE7QUFGcUUsS0FBNUU7QUFJQTtBQUNELEdBWEQ7QUFZQTs7QUFFREYsTUFBS2dELFNBQUwsRUFBZ0IsR0FBRzlDLElBQW5CLEVBQXlCO0FBQ3hCLE9BQUs2RSxLQUFMLENBQVcvQixTQUFYLEVBQXNCOUMsSUFBdEIsRUFBNEJrQixTQUE1QixFQUF1QyxJQUF2QztBQUNBOztBQUVEaUUsc0JBQXFCckMsU0FBckIsRUFBZ0MsR0FBRzlDLElBQW5DLEVBQXlDO0FBQ3hDLE9BQUs2RSxLQUFMLENBQVcvQixTQUFYLEVBQXNCOUMsSUFBdEIsRUFBNEJrQixTQUE1QixFQUF1QyxLQUF2QztBQUNBOztBQTVXMEMsQ0FBNUMsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zdHJlYW1lci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgRVY6dHJ1ZSAqL1xuLyogZXhwb3J0ZWQgRVYgKi9cblxuRVYgPSBjbGFzcyBFViB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuaGFuZGxlcnMgPSB7fTtcblx0fVxuXG5cdGVtaXQoZXZlbnQsIC4uLmFyZ3MpIHtcblx0XHRpZiAodGhpcy5oYW5kbGVyc1tldmVudF0pIHtcblx0XHRcdHRoaXMuaGFuZGxlcnNbZXZlbnRdLmZvckVhY2goKGhhbmRsZXIpID0+IGhhbmRsZXIuYXBwbHkodGhpcywgYXJncykpO1xuXHRcdH1cblx0fVxuXG5cdGVtaXRXaXRoU2NvcGUoZXZlbnQsIHNjb3BlLCAuLi5hcmdzKSB7XG5cdFx0aWYgKHRoaXMuaGFuZGxlcnNbZXZlbnRdKSB7XG5cdFx0XHR0aGlzLmhhbmRsZXJzW2V2ZW50XS5mb3JFYWNoKChoYW5kbGVyKSA9PiBoYW5kbGVyLmFwcGx5KHNjb3BlLCBhcmdzKSk7XG5cdFx0fVxuXHR9XG5cblx0b24oZXZlbnQsIGNhbGxiYWNrKSB7XG5cdFx0aWYgKCF0aGlzLmhhbmRsZXJzW2V2ZW50XSkge1xuXHRcdFx0dGhpcy5oYW5kbGVyc1tldmVudF0gPSBbXTtcblx0XHR9XG5cdFx0dGhpcy5oYW5kbGVyc1tldmVudF0ucHVzaChjYWxsYmFjayk7XG5cdH1cblxuXHRvbmNlKGV2ZW50LCBjYWxsYmFjaykge1xuXHRcdHNlbGYgPSB0aGlzO1xuXHRcdHNlbGYub24oZXZlbnQsIGZ1bmN0aW9uIG9uZXRpbWVDYWxsYmFjaygpIHtcblx0XHRcdGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHRzZWxmLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBvbmV0aW1lQ2FsbGJhY2spO1xuXHRcdH0pO1xuXHR9XG5cblx0cmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGNhbGxiYWNrKSB7XG5cdFx0aWYodGhpcy5oYW5kbGVyc1tldmVudF0pIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5oYW5kbGVyc1tldmVudF0uaW5kZXhPZihjYWxsYmFjayk7XG5cdFx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0XHR0aGlzLmhhbmRsZXJzW2V2ZW50XS5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJlbW92ZUFsbExpc3RlbmVycyhldmVudCkge1xuXHRcdHRoaXMuaGFuZGxlcnNbZXZlbnRdID0gdW5kZWZpbmVkO1xuXHR9XG59O1xuIiwiLyogZ2xvYmFscyBFViAqL1xuLyogZXNsaW50IG5ldy1jYXA6IGZhbHNlICovXG5cbmNsYXNzIFN0cmVhbWVyQ2VudHJhbCBleHRlbmRzIEVWIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuaW5zdGFuY2VzID0ge307XG5cdH1cbn1cblxuTWV0ZW9yLlN0cmVhbWVyQ2VudHJhbCA9IG5ldyBTdHJlYW1lckNlbnRyYWw7XG5cblxuTWV0ZW9yLlN0cmVhbWVyID0gY2xhc3MgU3RyZWFtZXIgZXh0ZW5kcyBFViB7XG5cdGNvbnN0cnVjdG9yKG5hbWUsIHtyZXRyYW5zbWl0ID0gdHJ1ZSwgcmV0cmFuc21pdFRvU2VsZiA9IGZhbHNlfSA9IHt9KSB7XG5cdFx0aWYgKE1ldGVvci5TdHJlYW1lckNlbnRyYWwuaW5zdGFuY2VzW25hbWVdKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ1N0cmVhbWVyIGluc3RhbmNlIGFscmVhZHkgZXhpc3RzOicsIG5hbWUpO1xuXHRcdFx0cmV0dXJuIE1ldGVvci5TdHJlYW1lckNlbnRyYWwuaW5zdGFuY2VzW25hbWVdO1xuXHRcdH1cblxuXHRcdHN1cGVyKCk7XG5cblx0XHRNZXRlb3IuU3RyZWFtZXJDZW50cmFsLmluc3RhbmNlc1tuYW1lXSA9IHRoaXM7XG5cblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMucmV0cmFuc21pdCA9IHJldHJhbnNtaXQ7XG5cdFx0dGhpcy5yZXRyYW5zbWl0VG9TZWxmID0gcmV0cmFuc21pdFRvU2VsZjtcblxuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lID0ge307XG5cdFx0dGhpcy50cmFuc2Zvcm1lcnMgPSB7fTtcblxuXHRcdHRoaXMuaW5pUHVibGljYXRpb24oKTtcblx0XHR0aGlzLmluaXRNZXRob2QoKTtcblxuXHRcdHRoaXMuX2FsbG93UmVhZCA9IHt9O1xuXHRcdHRoaXMuX2FsbG93RW1pdCA9IHt9O1xuXHRcdHRoaXMuX2FsbG93V3JpdGUgPSB7fTtcblxuXHRcdHRoaXMuYWxsb3dSZWFkKCdub25lJyk7XG5cdFx0dGhpcy5hbGxvd0VtaXQoJ2FsbCcpO1xuXHRcdHRoaXMuYWxsb3dXcml0ZSgnbm9uZScpO1xuXHR9XG5cblx0Z2V0IG5hbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWU7XG5cdH1cblxuXHRzZXQgbmFtZShuYW1lKSB7XG5cdFx0Y2hlY2sobmFtZSwgU3RyaW5nKTtcblx0XHR0aGlzLl9uYW1lID0gbmFtZTtcblx0fVxuXG5cdGdldCBzdWJzY3JpcHRpb25OYW1lKCkge1xuXHRcdHJldHVybiBgc3RyZWFtLSR7dGhpcy5uYW1lfWA7XG5cdH1cblxuXHRnZXQgcmV0cmFuc21pdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcmV0cmFuc21pdDtcblx0fVxuXG5cdHNldCByZXRyYW5zbWl0KHJldHJhbnNtaXQpIHtcblx0XHRjaGVjayhyZXRyYW5zbWl0LCBCb29sZWFuKTtcblx0XHR0aGlzLl9yZXRyYW5zbWl0ID0gcmV0cmFuc21pdDtcblx0fVxuXG5cdGdldCByZXRyYW5zbWl0VG9TZWxmKCkge1xuXHRcdHJldHVybiB0aGlzLl9yZXRyYW5zbWl0VG9TZWxmO1xuXHR9XG5cblx0c2V0IHJldHJhbnNtaXRUb1NlbGYocmV0cmFuc21pdFRvU2VsZikge1xuXHRcdGNoZWNrKHJldHJhbnNtaXRUb1NlbGYsIEJvb2xlYW4pO1xuXHRcdHRoaXMuX3JldHJhbnNtaXRUb1NlbGYgPSByZXRyYW5zbWl0VG9TZWxmO1xuXHR9XG5cblx0YWxsb3dSZWFkKGV2ZW50TmFtZSwgZm4pIHtcblx0XHRpZiAoZm4gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm4gPSBldmVudE5hbWU7XG5cdFx0XHRldmVudE5hbWUgPSAnX19hbGxfXyc7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycgJiYgWydhbGwnLCAnbm9uZScsICdsb2dnZWQnXS5pbmRleE9mKGZuKSA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYGFsbG93UmVhZCBzaG9ydGN1dCAnJHtmbn0nIGlzIGludmFsaWRgKTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdhbGwnIHx8IGZuID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dSZWFkW2V2ZW50TmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChmbiA9PT0gJ25vbmUnIHx8IGZuID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGZuID09PSAnbG9nZ2VkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKHRoaXMudXNlcklkKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0YWxsb3dFbWl0KGV2ZW50TmFtZSwgZm4pIHtcblx0XHRpZiAoZm4gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm4gPSBldmVudE5hbWU7XG5cdFx0XHRldmVudE5hbWUgPSAnX19hbGxfXyc7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycgJiYgWydhbGwnLCAnbm9uZScsICdsb2dnZWQnXS5pbmRleE9mKGZuKSA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYGFsbG93UmVhZCBzaG9ydGN1dCAnJHtmbn0nIGlzIGludmFsaWRgKTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdhbGwnIHx8IGZuID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dFbWl0W2V2ZW50TmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChmbiA9PT0gJ25vbmUnIHx8IGZuID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGZuID09PSAnbG9nZ2VkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKHRoaXMudXNlcklkKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0YWxsb3dXcml0ZShldmVudE5hbWUsIGZuKSB7XG5cdFx0aWYgKGZuID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGZuID0gZXZlbnROYW1lO1xuXHRcdFx0ZXZlbnROYW1lID0gJ19fYWxsX18nO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxvd1dyaXRlW2V2ZW50TmFtZV0gPSBmbjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGZuID09PSAnc3RyaW5nJyAmJiBbJ2FsbCcsICdub25lJywgJ2xvZ2dlZCddLmluZGV4T2YoZm4pID09PSAtMSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgYWxsb3dXcml0ZSBzaG9ydGN1dCAnJHtmbn0nIGlzIGludmFsaWRgKTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdhbGwnIHx8IGZuID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dXcml0ZVtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdub25lJyB8fCBmbiA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxvd1dyaXRlW2V2ZW50TmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdsb2dnZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dXcml0ZVtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKHRoaXMudXNlcklkKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0aXNSZWFkQWxsb3dlZChzY29wZSwgZXZlbnROYW1lLCBhcmdzKSB7XG5cdFx0aWYgKHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dSZWFkW2V2ZW50TmFtZV0uY2FsbChzY29wZSwgZXZlbnROYW1lLCAuLi5hcmdzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fYWxsb3dSZWFkWydfX2FsbF9fJ10uY2FsbChzY29wZSwgZXZlbnROYW1lLCAuLi5hcmdzKTtcblx0fVxuXG5cdGlzRW1pdEFsbG93ZWQoc2NvcGUsIGV2ZW50TmFtZSwgLi4uYXJncykge1xuXHRcdGlmICh0aGlzLl9hbGxvd0VtaXRbZXZlbnROYW1lXSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdLmNhbGwoc2NvcGUsIGV2ZW50TmFtZSwgLi4uYXJncyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFsnX19hbGxfXyddLmNhbGwoc2NvcGUsIGV2ZW50TmFtZSwgLi4uYXJncyk7XG5cdH1cblxuXHRpc1dyaXRlQWxsb3dlZChzY29wZSwgZXZlbnROYW1lLCBhcmdzKSB7XG5cdFx0aWYgKHRoaXMuX2FsbG93V3JpdGVbZXZlbnROYW1lXSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93V3JpdGVbZXZlbnROYW1lXS5jYWxsKHNjb3BlLCBldmVudE5hbWUsIC4uLmFyZ3MpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9hbGxvd1dyaXRlWydfX2FsbF9fJ10uY2FsbChzY29wZSwgZXZlbnROYW1lLCAuLi5hcmdzKTtcblx0fVxuXG5cdGFkZFN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSkge1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1YnNjcmlwdGlvbik7XG5cblx0XHRpZiAoIXRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV0pIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV0gPSBbXTtcblx0XHR9XG5cblx0XHR0aGlzLnN1YnNjcmlwdGlvbnNCeUV2ZW50TmFtZVtldmVudE5hbWVdLnB1c2goc3Vic2NyaXB0aW9uKTtcblx0fVxuXG5cdHJlbW92ZVN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSkge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3Vic2NyaXB0aW9uKTtcblx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpbmRleCwgMSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV0pIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5zdWJzY3JpcHRpb25zQnlFdmVudE5hbWVbZXZlbnROYW1lXS5pbmRleE9mKHN1YnNjcmlwdGlvbik7XG5cdFx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnNCeUV2ZW50TmFtZVtldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dHJhbnNmb3JtKGV2ZW50TmFtZSwgZm4pIHtcblx0XHRpZiAodHlwZW9mIGV2ZW50TmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Zm4gPSBldmVudE5hbWU7XG5cdFx0XHRldmVudE5hbWUgPSAnX19hbGxfXyc7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnRyYW5zZm9ybWVyc1tldmVudE5hbWVdKSB7XG5cdFx0XHR0aGlzLnRyYW5zZm9ybWVyc1tldmVudE5hbWVdID0gW107XG5cdFx0fVxuXG5cdFx0dGhpcy50cmFuc2Zvcm1lcnNbZXZlbnROYW1lXS5wdXNoKGZuKTtcblx0fVxuXG5cdGFwcGx5VHJhbnNmb3JtZXJzKG1ldGhvZFNjb3BlLCBldmVudE5hbWUsIGFyZ3MpIHtcblx0XHRpZiAodGhpcy50cmFuc2Zvcm1lcnNbJ19fYWxsX18nXSkge1xuXHRcdFx0dGhpcy50cmFuc2Zvcm1lcnNbJ19fYWxsX18nXS5mb3JFYWNoKCh0cmFuc2Zvcm0pID0+IHtcblx0XHRcdFx0YXJncyA9IHRyYW5zZm9ybS5jYWxsKG1ldGhvZFNjb3BlLCBldmVudE5hbWUsIGFyZ3MpO1xuXHRcdFx0XHRtZXRob2RTY29wZS50cmFuZm9ybWVkID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGFyZ3MpKSB7XG5cdFx0XHRcdFx0YXJncyA9IFthcmdzXTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudHJhbnNmb3JtZXJzW2V2ZW50TmFtZV0pIHtcblx0XHRcdHRoaXMudHJhbnNmb3JtZXJzW2V2ZW50TmFtZV0uZm9yRWFjaCgodHJhbnNmb3JtKSA9PiB7XG5cdFx0XHRcdGFyZ3MgPSB0cmFuc2Zvcm0uY2FsbChtZXRob2RTY29wZSwgLi4uYXJncyk7XG5cdFx0XHRcdG1ldGhvZFNjb3BlLnRyYW5mb3JtZWQgPSB0cnVlO1xuXHRcdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkoYXJncykpIHtcblx0XHRcdFx0XHRhcmdzID0gW2FyZ3NdO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJncztcblx0fVxuXG5cdGluaVB1YmxpY2F0aW9uKCkge1xuXHRcdGNvbnN0IHN0cmVhbSA9IHRoaXM7XG5cdFx0TWV0ZW9yLnB1Ymxpc2godGhpcy5zdWJzY3JpcHRpb25OYW1lLCBmdW5jdGlvbihldmVudE5hbWUsIG9wdGlvbnMpIHtcblx0XHRcdGNoZWNrKGV2ZW50TmFtZSwgU3RyaW5nKTtcblxuXHRcdFx0bGV0IHVzZUNvbGxlY3Rpb24sIGFyZ3MgPSBbXTtcblxuXHRcdFx0aWYgKHR5cGVvZiBvcHRpb25zID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0dXNlQ29sbGVjdGlvbiA9IG9wdGlvbnM7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAob3B0aW9ucy51c2VDb2xsZWN0aW9uKSB7XG5cdFx0XHRcdFx0dXNlQ29sbGVjdGlvbiA9IG9wdGlvbnMudXNlQ29sbGVjdGlvbjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChvcHRpb25zLmFyZ3MpIHtcblx0XHRcdFx0XHRhcmdzID0gb3B0aW9ucy5hcmdzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChldmVudE5hbWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuc3RvcCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdHJlYW0uaXNSZWFkQWxsb3dlZCh0aGlzLCBldmVudE5hbWUsIGFyZ3MpICE9PSB0cnVlKSB7XG5cdFx0XHRcdHRoaXMuc3RvcCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN1YnNjcmlwdGlvbiA9IHtcblx0XHRcdFx0c3Vic2NyaXB0aW9uOiB0aGlzLFxuXHRcdFx0XHRldmVudE5hbWU6IGV2ZW50TmFtZVxuXHRcdFx0fTtcblxuXHRcdFx0c3RyZWFtLmFkZFN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSk7XG5cblx0XHRcdHRoaXMub25TdG9wKCgpID0+IHtcblx0XHRcdFx0c3RyZWFtLnJlbW92ZVN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHVzZUNvbGxlY3Rpb24gPT09IHRydWUpIHtcblx0XHRcdFx0Ly8gQ29sbGVjdGlvbiBjb21wYXRpYmlsaXR5XG5cdFx0XHRcdHRoaXMuX3Nlc3Npb24uc2VuZEFkZGVkKHN0cmVhbS5zdWJzY3JpcHRpb25OYW1lLCAnaWQnLCB7XG5cdFx0XHRcdFx0ZXZlbnROYW1lOiBldmVudE5hbWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVhZHkoKTtcblx0XHR9KTtcblx0fVxuXG5cdGluaXRNZXRob2QoKSB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gdGhpcztcblx0XHRjb25zdCBtZXRob2QgPSB7fTtcblxuXHRcdG1ldGhvZFt0aGlzLnN1YnNjcmlwdGlvbk5hbWVdID0gZnVuY3Rpb24oZXZlbnROYW1lLCAuLi5hcmdzKSB7XG5cdFx0XHRjaGVjayhldmVudE5hbWUsIFN0cmluZyk7XG5cdFx0XHRjaGVjayhhcmdzLCBBcnJheSk7XG5cblx0XHRcdHRoaXMudW5ibG9jaygpO1xuXG5cdFx0XHRpZiAoc3RyZWFtLmlzV3JpdGVBbGxvd2VkKHRoaXMsIGV2ZW50TmFtZSwgYXJncykgIT09IHRydWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZXRob2RTY29wZSA9IHtcblx0XHRcdFx0dXNlcklkOiB0aGlzLnVzZXJJZCxcblx0XHRcdFx0Y29ubmVjdGlvbjogdGhpcy5jb25uZWN0aW9uLFxuXHRcdFx0XHRvcmlnaW5hbFBhcmFtczogYXJncyxcblx0XHRcdFx0dHJhbmZvcm1lZDogZmFsc2Vcblx0XHRcdH07XG5cblx0XHRcdGFyZ3MgPSBzdHJlYW0uYXBwbHlUcmFuc2Zvcm1lcnMobWV0aG9kU2NvcGUsIGV2ZW50TmFtZSwgYXJncyk7XG5cblx0XHRcdHN0cmVhbS5lbWl0V2l0aFNjb3BlKGV2ZW50TmFtZSwgbWV0aG9kU2NvcGUsIC4uLmFyZ3MpO1xuXG5cdFx0XHRpZiAoc3RyZWFtLnJldHJhbnNtaXQgPT09IHRydWUpIHtcblx0XHRcdFx0c3RyZWFtLl9lbWl0KGV2ZW50TmFtZSwgYXJncywgdGhpcy5jb25uZWN0aW9uLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdE1ldGVvci5tZXRob2RzKG1ldGhvZCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihlKTtcblx0XHR9XG5cdH1cblxuXHRfZW1pdChldmVudE5hbWUsIGFyZ3MsIG9yaWdpbiwgYnJvYWRjYXN0KSB7XG5cdFx0aWYgKGJyb2FkY2FzdCA9PT0gdHJ1ZSkge1xuXHRcdFx0TWV0ZW9yLlN0cmVhbWVyQ2VudHJhbC5lbWl0KCdicm9hZGNhc3QnLCB0aGlzLm5hbWUsIGV2ZW50TmFtZSwgYXJncyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9ucyA9IHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV07XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHN1YnNjcmlwdGlvbnMpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3Vic2NyaXB0aW9ucy5mb3JFYWNoKChzdWJzY3JpcHRpb24pID0+IHtcblx0XHRcdGlmICh0aGlzLnJldHJhbnNtaXRUb1NlbGYgPT09IGZhbHNlICYmIG9yaWdpbiAmJiBvcmlnaW4gPT09IHN1YnNjcmlwdGlvbi5zdWJzY3JpcHRpb24uY29ubmVjdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmlzRW1pdEFsbG93ZWQoc3Vic2NyaXB0aW9uLnN1YnNjcmlwdGlvbiwgZXZlbnROYW1lLCAuLi5hcmdzKSkge1xuXHRcdFx0XHRzdWJzY3JpcHRpb24uc3Vic2NyaXB0aW9uLl9zZXNzaW9uLnNlbmRDaGFuZ2VkKHRoaXMuc3Vic2NyaXB0aW9uTmFtZSwgJ2lkJywge1xuXHRcdFx0XHRcdGV2ZW50TmFtZTogZXZlbnROYW1lLFxuXHRcdFx0XHRcdGFyZ3M6IGFyZ3Ncblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRlbWl0KGV2ZW50TmFtZSwgLi4uYXJncykge1xuXHRcdHRoaXMuX2VtaXQoZXZlbnROYW1lLCBhcmdzLCB1bmRlZmluZWQsIHRydWUpO1xuXHR9XG5cblx0ZW1pdFdpdGhvdXRCcm9hZGNhc3QoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG5cdFx0dGhpcy5fZW1pdChldmVudE5hbWUsIGFyZ3MsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHR9XG59O1xuIl19
