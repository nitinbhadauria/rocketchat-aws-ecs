(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var Hubot, HubotScripts, InternalHubot, InternalHubotReceiver, RocketChatAdapter;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:internal-hubot":{"hubot.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_internal-hubot/hubot.js                                                                   //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
var _this = this;

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 1);

const CoffeeScript = Npm.require('coffee-script');

CoffeeScript.register();

const Hubot = Npm.require('hubot'); // Start a hubot, connected to our chat room.
// 'use strict'
// Log messages?


const DEBUG = false;
let InternalHubot = {};
const sendHelper = Meteor.bindEnvironment((robot, envelope, strings, map) => {
	while (strings.length > 0) {
		const string = strings.shift();

		if (typeof string === 'function') {
			string();
		} else {
			try {
				map(string);
			} catch (err) {
				if (DEBUG) {
					console.error(`Hubot error: ${err}`);
				}

				robot.logger.error(`RocketChat send error: ${err}`);
			}
		}
	}
}); // Monkey-patch Hubot to support private messages

Hubot.Response.prototype.priv = (...strings) => _this.robot.adapter.priv(_this.envelope, ...strings); // More monkey-patching


Hubot.Robot.prototype.loadAdapter = () => {}; // disable
// grrrr, Meteor.bindEnvironment doesn't preserve `this` apparently


const bind = function (f) {
	const g = Meteor.bindEnvironment((self, ...args) => f.apply(self, args));
	return function (...args) {
		return g(this, ...Array.from(args));
	};
};

class Robot extends Hubot.Robot {
	constructor(...args) {
		super(...(args || []));
		this.hear = bind(this.hear);
		this.respond = bind(this.respond);
		this.enter = bind(this.enter);
		this.leave = bind(this.leave);
		this.topic = bind(this.topic);
		this.error = bind(this.error);
		this.catchAll = bind(this.catchAll);
		this.user = Meteor.users.findOne({
			username: this.name
		}, {
			fields: {
				username: 1
			}
		});
	}

	loadAdapter() {
		return false;
	}

	hear(regex, callback) {
		return super.hear(regex, Meteor.bindEnvironment(callback));
	}

	respond(regex, callback) {
		return super.respond(regex, Meteor.bindEnvironment(callback));
	}

	enter(callback) {
		return super.enter(Meteor.bindEnvironment(callback));
	}

	leave(callback) {
		return super.leave(Meteor.bindEnvironment(callback));
	}

	topic(callback) {
		return super.topic(Meteor.bindEnvironment(callback));
	}

	error(callback) {
		return super.error(Meteor.bindEnvironment(callback));
	}

	catchAll(callback) {
		return super.catchAll(Meteor.bindEnvironment(callback));
	}

}

class RocketChatAdapter extends Hubot.Adapter {
	// Public: Raw method for sending data back to the chat source. Extend this.
	//
	// envelope - A Object with message, room and user details.
	// strings  - One or more Strings for each message to send.
	//
	// Returns nothing.
	send(envelope, ...strings) {
		if (DEBUG) {
			console.log('ROCKETCHATADAPTER -> send'.blue);
		} // console.log envelope, strings


		return sendHelper(this.robot, envelope, strings, string => {
			if (DEBUG) {
				console.log(`send ${envelope.room}: ${string} (${envelope.user.id})`);
			}

			return RocketChat.sendMessage(InternalHubot.user, {
				msg: string
			}, {
				_id: envelope.room
			});
		});
	} // Public: Raw method for sending emote data back to the chat source.
	//
	// envelope - A Object with message, room and user details.
	// strings  - One or more Strings for each message to send.
	//
	// Returns nothing.


	emote(envelope, ...strings) {
		if (DEBUG) {
			console.log('ROCKETCHATADAPTER -> emote'.blue);
		}

		return sendHelper(this.robot, envelope, strings, string => {
			if (DEBUG) {
				console.log(`emote ${envelope.rid}: ${string} (${envelope.u.username})`);
			}

			if (envelope.message.private) {
				return this.priv(envelope, `*** ${string} ***`);
			}

			return Meteor.call('sendMessage', {
				msg: string,
				rid: envelope.rid,
				action: true
			});
		});
	} // Priv: our extension -- send a PM to user


	priv(envelope, ...strings) {
		if (DEBUG) {
			console.log('ROCKETCHATADAPTER -> priv'.blue);
		}

		return sendHelper(this.robot, envelope, strings, function (string) {
			if (DEBUG) {
				console.log(`priv ${envelope.room}: ${string} (${envelope.user.id})`);
			}

			return Meteor.call('sendMessage', {
				u: {
					username: RocketChat.settings.get('InternalHubot_Username')
				},
				to: `${envelope.user.id}`,
				msg: string,
				rid: envelope.room
			});
		});
	} // Public: Raw method for building a reply and sending it back to the chat
	// source. Extend this.
	//
	// envelope - A Object with message, room and user details.
	// strings  - One or more Strings for each reply to send.
	//
	// Returns nothing.


	reply(envelope, ...strings) {
		if (DEBUG) {
			console.log('ROCKETCHATADAPTER -> reply'.blue);
		}

		if (envelope.message.private) {
			return this.priv(envelope, ...strings);
		} else {
			return this.send(envelope, ...strings.map(str => `${envelope.user.name}: ${str}`));
		}
	} // Public: Raw method for setting a topic on the chat source. Extend this.
	//
	// envelope - A Object with message, room and user details.
	// strings  - One more more Strings to set as the topic.
	//
	// Returns nothing.


	topic() /*envelope, ...strings*/{
		if (DEBUG) {
			return console.log('ROCKETCHATADAPTER -> topic'.blue);
		}
	} // Public: Raw method for playing a sound in the chat source. Extend this.
	//
	// envelope - A Object with message, room and user details.
	// strings  - One or more strings for each play message to send.
	//
	// Returns nothing


	play() /*envelope, ...strings*/{
		if (DEBUG) {
			return console.log('ROCKETCHATADAPTER -> play'.blue);
		}
	} // Public: Raw method for invoking the bot to run. Extend this.
	//
	// Returns nothing.


	run() {
		if (DEBUG) {
			console.log('ROCKETCHATADAPTER -> run'.blue);
		}

		this.robot.emit('connected');
		return this.robot.brain.mergeData({});
	} // @robot.brain.emit 'loaded'
	// Public: Raw method for shutting the bot down. Extend this.
	//
	// Returns nothing.


	close() {
		if (DEBUG) {
			return console.log('ROCKETCHATADAPTER -> close'.blue);
		}
	}

}

const InternalHubotReceiver = message => {
	if (DEBUG) {
		console.log(message);
	}

	if (message.u.username !== InternalHubot.name) {
		const room = RocketChat.models.Rooms.findOneById(message.rid);

		if (room.t === 'c') {
			const InternalHubotUser = new Hubot.User(message.u.username, {
				room: message.rid
			});
			const InternalHubotTextMessage = new Hubot.TextMessage(InternalHubotUser, message.msg, message._id);
			InternalHubot.adapter.receive(InternalHubotTextMessage);
		}
	}

	return message;
};

class HubotScripts {
	constructor(robot) {
		const modulesToLoad = ['hubot-help/src/help.coffee'];
		const customPath = RocketChat.settings.get('InternalHubot_PathToLoadCustomScripts');
		HubotScripts.load(`${__meteor_bootstrap__.serverDir}/npm/node_modules/meteor/rocketchat_internal-hubot/node_modules/`, modulesToLoad, robot);
		HubotScripts.load(customPath, RocketChat.settings.get('InternalHubot_ScriptsToLoad').split(',') || [], robot);
	}

	static load(path, scriptsToLoad, robot) {
		if (!path || !scriptsToLoad) {
			return;
		}

		scriptsToLoad.forEach(scriptFile => {
			try {
				scriptFile = s.trim(scriptFile);

				if (scriptFile === '') {
					return;
				} // delete require.cache[require.resolve(path+scriptFile)];


				const fn = Npm.require(path + scriptFile);

				if (typeof fn === 'function') {
					fn(robot);
				} else {
					fn.default(robot);
				}

				robot.parseHelp(path + scriptFile);
				console.log(`Loaded ${scriptFile}`.green);
			} catch (e) {
				console.log(`Can't load ${scriptFile}`.red);
				console.log(e);
			}
		});
	}

}

const init = _.debounce(Meteor.bindEnvironment(() => {
	if (RocketChat.settings.get('InternalHubot_Enabled')) {
		InternalHubot = new Robot(null, null, false, RocketChat.settings.get('InternalHubot_Username'));
		InternalHubot.alias = 'bot';
		InternalHubot.adapter = new RocketChatAdapter(InternalHubot);
		new HubotScripts(InternalHubot);
		InternalHubot.run();
		return RocketChat.callbacks.add('afterSaveMessage', InternalHubotReceiver, RocketChat.callbacks.priority.LOW, 'InternalHubot');
	} else {
		InternalHubot = {};
		return RocketChat.callbacks.remove('afterSaveMessage', 'InternalHubot');
	}
}), 1000);

Meteor.startup(function () {
	init();
	RocketChat.models.Settings.findByIds(['InternalHubot_Username', 'InternalHubot_Enabled', 'InternalHubot_ScriptsToLoad', 'InternalHubot_PathToLoadCustomScripts']).observe({
		changed() {
			return init();
		}

	}); // TODO useful when we have the ability to invalidate `require` cache
	// RocketChat.RateLimiter.limitMethod('reloadInternalHubot', 1, 5000, {
	// 	userId(/*userId*/) { return true; }
	// });
	// Meteor.methods({
	// 	reloadInternalHubot: () => init()
	// });
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_internal-hubot/settings.js                                                                //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
RocketChat.settings.addGroup('InternalHubot', function () {
	this.add('InternalHubot_Enabled', false, {
		type: 'boolean',
		i18nLabel: 'Enabled'
	});
	this.add('InternalHubot_Username', 'rocket.cat', {
		type: 'string',
		i18nLabel: 'Username',
		i18nDescription: 'InternalHubot_Username_Description',
		'public': true
	});
	this.add('InternalHubot_ScriptsToLoad', '', {
		type: 'string'
	});
	this.add('InternalHubot_PathToLoadCustomScripts', '', {
		type: 'string'
	}); // this.add('InternalHubot_reload', 'reloadInternalHubot', {
	// 	type: 'action',
	// 	actionText: 'reload'
	// });
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:internal-hubot/hubot.js");
require("./node_modules/meteor/rocketchat:internal-hubot/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:internal-hubot'] = {}, {
  Hubot: Hubot,
  HubotScripts: HubotScripts,
  InternalHubot: InternalHubot,
  InternalHubotReceiver: InternalHubotReceiver,
  RocketChatAdapter: RocketChatAdapter
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_internal-hubot.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlcm5hbC1odWJvdC9odWJvdC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlcm5hbC1odWJvdC9zZXR0aW5ncy5qcyJdLCJuYW1lcyI6WyJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJzIiwiQ29mZmVlU2NyaXB0IiwiTnBtIiwicmVnaXN0ZXIiLCJIdWJvdCIsIkRFQlVHIiwiSW50ZXJuYWxIdWJvdCIsInNlbmRIZWxwZXIiLCJNZXRlb3IiLCJiaW5kRW52aXJvbm1lbnQiLCJyb2JvdCIsImVudmVsb3BlIiwic3RyaW5ncyIsIm1hcCIsImxlbmd0aCIsInN0cmluZyIsInNoaWZ0IiwiZXJyIiwiY29uc29sZSIsImVycm9yIiwibG9nZ2VyIiwiUmVzcG9uc2UiLCJwcm90b3R5cGUiLCJwcml2IiwiYWRhcHRlciIsIlJvYm90IiwibG9hZEFkYXB0ZXIiLCJiaW5kIiwiZiIsImciLCJzZWxmIiwiYXJncyIsImFwcGx5IiwiQXJyYXkiLCJmcm9tIiwiY29uc3RydWN0b3IiLCJoZWFyIiwicmVzcG9uZCIsImVudGVyIiwibGVhdmUiLCJ0b3BpYyIsImNhdGNoQWxsIiwidXNlciIsInVzZXJzIiwiZmluZE9uZSIsInVzZXJuYW1lIiwibmFtZSIsImZpZWxkcyIsInJlZ2V4IiwiY2FsbGJhY2siLCJSb2NrZXRDaGF0QWRhcHRlciIsIkFkYXB0ZXIiLCJzZW5kIiwibG9nIiwiYmx1ZSIsInJvb20iLCJpZCIsIlJvY2tldENoYXQiLCJzZW5kTWVzc2FnZSIsIm1zZyIsIl9pZCIsImVtb3RlIiwicmlkIiwidSIsIm1lc3NhZ2UiLCJwcml2YXRlIiwiY2FsbCIsImFjdGlvbiIsInNldHRpbmdzIiwiZ2V0IiwidG8iLCJyZXBseSIsInN0ciIsInBsYXkiLCJydW4iLCJlbWl0IiwiYnJhaW4iLCJtZXJnZURhdGEiLCJjbG9zZSIsIkludGVybmFsSHVib3RSZWNlaXZlciIsIm1vZGVscyIsIlJvb21zIiwiZmluZE9uZUJ5SWQiLCJ0IiwiSW50ZXJuYWxIdWJvdFVzZXIiLCJVc2VyIiwiSW50ZXJuYWxIdWJvdFRleHRNZXNzYWdlIiwiVGV4dE1lc3NhZ2UiLCJyZWNlaXZlIiwiSHVib3RTY3JpcHRzIiwibW9kdWxlc1RvTG9hZCIsImN1c3RvbVBhdGgiLCJsb2FkIiwiX19tZXRlb3JfYm9vdHN0cmFwX18iLCJzZXJ2ZXJEaXIiLCJzcGxpdCIsInBhdGgiLCJzY3JpcHRzVG9Mb2FkIiwiZm9yRWFjaCIsInNjcmlwdEZpbGUiLCJ0cmltIiwiZm4iLCJwYXJzZUhlbHAiLCJncmVlbiIsImUiLCJyZWQiLCJpbml0IiwiZGVib3VuY2UiLCJhbGlhcyIsImNhbGxiYWNrcyIsImFkZCIsInByaW9yaXR5IiwiTE9XIiwicmVtb3ZlIiwic3RhcnR1cCIsIlNldHRpbmdzIiwiZmluZEJ5SWRzIiwib2JzZXJ2ZSIsImNoYW5nZWQiLCJhZGRHcm91cCIsInR5cGUiLCJpMThuTGFiZWwiLCJpMThuRGVzY3JpcHRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUF3RCxJQUFJQyxDQUFKO0FBQU1MLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxtQkFBUixDQUFiLEVBQTBDO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDQyxNQUFFRCxDQUFGO0FBQUk7O0FBQWhCLENBQTFDLEVBQTRELENBQTVEOztBQUlwRSxNQUFNRSxlQUFlQyxJQUFJTCxPQUFKLENBQVksZUFBWixDQUFyQjs7QUFDQUksYUFBYUUsUUFBYjs7QUFDQSxNQUFNQyxRQUFRRixJQUFJTCxPQUFKLENBQVksT0FBWixDQUFk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RCxDQUFQO0FBQ0E7QUFDRCxDQVp1QixDQUFYLEVBWVQsSUFaUyxDQUFiOztBQWNBekcsT0FBTzBHLE9BQVAsQ0FBZSxZQUFXO0FBQ3pCUjtBQUNBakQsWUFBV3VCLE1BQVgsQ0FBa0JtQyxRQUFsQixDQUEyQkMsU0FBM0IsQ0FBcUMsQ0FBRSx3QkFBRixFQUE0Qix1QkFBNUIsRUFBcUQsNkJBQXJELEVBQW9GLHVDQUFwRixDQUFyQyxFQUFtS0MsT0FBbkssQ0FBMks7QUFDMUtDLFlBQVU7QUFDVCxVQUFPWixNQUFQO0FBQ0E7O0FBSHlLLEVBQTNLLEVBRnlCLENBT3pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FkRCxFOzs7Ozs7Ozs7OztBQzNPQWpELFdBQVdXLFFBQVgsQ0FBb0JtRCxRQUFwQixDQUE2QixlQUE3QixFQUE4QyxZQUFXO0FBQ3hELE1BQUtULEdBQUwsQ0FBUyx1QkFBVCxFQUFrQyxLQUFsQyxFQUF5QztBQUFFVSxRQUFNLFNBQVI7QUFBbUJDLGFBQVc7QUFBOUIsRUFBekM7QUFDQSxNQUFLWCxHQUFMLENBQVMsd0JBQVQsRUFBbUMsWUFBbkMsRUFBaUQ7QUFBRVUsUUFBTSxRQUFSO0FBQWtCQyxhQUFXLFVBQTdCO0FBQXlDQyxtQkFBaUIsb0NBQTFEO0FBQWdHLFlBQVU7QUFBMUcsRUFBakQ7QUFDQSxNQUFLWixHQUFMLENBQVMsNkJBQVQsRUFBd0MsRUFBeEMsRUFBNEM7QUFBRVUsUUFBTTtBQUFSLEVBQTVDO0FBQ0EsTUFBS1YsR0FBTCxDQUFTLHVDQUFULEVBQWtELEVBQWxELEVBQXNEO0FBQUVVLFFBQU07QUFBUixFQUF0RCxFQUp3RCxDQUt4RDtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBVEQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9pbnRlcm5hbC1odWJvdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgX19tZXRlb3JfYm9vdHN0cmFwX18gKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuXG5jb25zdCBDb2ZmZWVTY3JpcHQgPSBOcG0ucmVxdWlyZSgnY29mZmVlLXNjcmlwdCcpO1xuQ29mZmVlU2NyaXB0LnJlZ2lzdGVyKCk7XG5jb25zdCBIdWJvdCA9IE5wbS5yZXF1aXJlKCdodWJvdCcpO1xuLy8gU3RhcnQgYSBodWJvdCwgY29ubmVjdGVkIHRvIG91ciBjaGF0IHJvb20uXG4vLyAndXNlIHN0cmljdCdcbi8vIExvZyBtZXNzYWdlcz9cbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmxldCBJbnRlcm5hbEh1Ym90ID0ge307XG5cbmNvbnN0IHNlbmRIZWxwZXIgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KChyb2JvdCwgZW52ZWxvcGUsIHN0cmluZ3MsIG1hcCkgPT57XG5cdHdoaWxlIChzdHJpbmdzLmxlbmd0aCA+IDApIHtcblx0XHRjb25zdCBzdHJpbmcgPSBzdHJpbmdzLnNoaWZ0KCk7XG5cdFx0aWYgKHR5cGVvZihzdHJpbmcpID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRzdHJpbmcoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bWFwKHN0cmluZyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0aWYgKERFQlVHKSB7IGNvbnNvbGUuZXJyb3IoYEh1Ym90IGVycm9yOiAkeyBlcnIgfWApOyB9XG5cdFx0XHRcdHJvYm90LmxvZ2dlci5lcnJvcihgUm9ja2V0Q2hhdCBzZW5kIGVycm9yOiAkeyBlcnIgfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbi8vIE1vbmtleS1wYXRjaCBIdWJvdCB0byBzdXBwb3J0IHByaXZhdGUgbWVzc2FnZXNcbkh1Ym90LlJlc3BvbnNlLnByb3RvdHlwZS5wcml2ID0gKC4uLnN0cmluZ3MpID0+IHRoaXMucm9ib3QuYWRhcHRlci5wcml2KHRoaXMuZW52ZWxvcGUsIC4uLnN0cmluZ3MpO1xuXG4vLyBNb3JlIG1vbmtleS1wYXRjaGluZ1xuSHVib3QuUm9ib3QucHJvdG90eXBlLmxvYWRBZGFwdGVyID0gKCkgPT4ge307IC8vIGRpc2FibGVcblxuLy8gZ3JycnIsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQgZG9lc24ndCBwcmVzZXJ2ZSBgdGhpc2AgYXBwYXJlbnRseVxuY29uc3QgYmluZCA9IGZ1bmN0aW9uKGYpIHtcblx0Y29uc3QgZyA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKHNlbGYsIC4uLmFyZ3MpID0+IGYuYXBwbHkoc2VsZiwgYXJncykpO1xuXHRyZXR1cm4gZnVuY3Rpb24oLi4uYXJncykgeyByZXR1cm4gZyh0aGlzLCAuLi5BcnJheS5mcm9tKGFyZ3MpKTsgfTtcbn07XG5cbmNsYXNzIFJvYm90IGV4dGVuZHMgSHVib3QuUm9ib3Qge1xuXHRjb25zdHJ1Y3RvciguLi5hcmdzKSB7XG5cdFx0c3VwZXIoLi4uKGFyZ3MgfHwgW10pKTtcblx0XHR0aGlzLmhlYXIgPSBiaW5kKHRoaXMuaGVhcik7XG5cdFx0dGhpcy5yZXNwb25kID0gYmluZCh0aGlzLnJlc3BvbmQpO1xuXHRcdHRoaXMuZW50ZXIgPSBiaW5kKHRoaXMuZW50ZXIpO1xuXHRcdHRoaXMubGVhdmUgPSBiaW5kKHRoaXMubGVhdmUpO1xuXHRcdHRoaXMudG9waWMgPSBiaW5kKHRoaXMudG9waWMpO1xuXHRcdHRoaXMuZXJyb3IgPSBiaW5kKHRoaXMuZXJyb3IpO1xuXHRcdHRoaXMuY2F0Y2hBbGwgPSBiaW5kKHRoaXMuY2F0Y2hBbGwpO1xuXHRcdHRoaXMudXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHt1c2VybmFtZTogdGhpcy5uYW1lfSwge2ZpZWxkczoge3VzZXJuYW1lOiAxfX0pO1xuXHR9XG5cdGxvYWRBZGFwdGVyKCkgeyByZXR1cm4gZmFsc2U7IH1cblx0aGVhcihyZWdleCwgY2FsbGJhY2spIHsgcmV0dXJuIHN1cGVyLmhlYXIocmVnZXgsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2spKTsgfVxuXHRyZXNwb25kKHJlZ2V4LCBjYWxsYmFjaykgeyByZXR1cm4gc3VwZXIucmVzcG9uZChyZWdleCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFjaykpOyB9XG5cdGVudGVyKGNhbGxiYWNrKSB7IHJldHVybiBzdXBlci5lbnRlcihNZXRlb3IuYmluZEVudmlyb25tZW50KGNhbGxiYWNrKSk7IH1cblx0bGVhdmUoY2FsbGJhY2spIHsgcmV0dXJuIHN1cGVyLmxlYXZlKE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2spKTsgfVxuXHR0b3BpYyhjYWxsYmFjaykgeyByZXR1cm4gc3VwZXIudG9waWMoTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFjaykpOyB9XG5cdGVycm9yKGNhbGxiYWNrKSB7IHJldHVybiBzdXBlci5lcnJvcihNZXRlb3IuYmluZEVudmlyb25tZW50KGNhbGxiYWNrKSk7IH1cblx0Y2F0Y2hBbGwoY2FsbGJhY2spIHsgcmV0dXJuIHN1cGVyLmNhdGNoQWxsKE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2spKTsgfVxufVxuXG5jbGFzcyBSb2NrZXRDaGF0QWRhcHRlciBleHRlbmRzIEh1Ym90LkFkYXB0ZXIge1xuXHQvLyBQdWJsaWM6IFJhdyBtZXRob2QgZm9yIHNlbmRpbmcgZGF0YSBiYWNrIHRvIHRoZSBjaGF0IHNvdXJjZS4gRXh0ZW5kIHRoaXMuXG5cdC8vXG5cdC8vIGVudmVsb3BlIC0gQSBPYmplY3Qgd2l0aCBtZXNzYWdlLCByb29tIGFuZCB1c2VyIGRldGFpbHMuXG5cdC8vIHN0cmluZ3MgIC0gT25lIG9yIG1vcmUgU3RyaW5ncyBmb3IgZWFjaCBtZXNzYWdlIHRvIHNlbmQuXG5cdC8vXG5cdC8vIFJldHVybnMgbm90aGluZy5cblx0c2VuZChlbnZlbG9wZSwgLi4uc3RyaW5ncykge1xuXHRcdGlmIChERUJVRykgeyBjb25zb2xlLmxvZygnUk9DS0VUQ0hBVEFEQVBURVIgLT4gc2VuZCcuYmx1ZSk7IH1cblx0XHQvLyBjb25zb2xlLmxvZyBlbnZlbG9wZSwgc3RyaW5nc1xuXHRcdHJldHVybiBzZW5kSGVscGVyKHRoaXMucm9ib3QsIGVudmVsb3BlLCBzdHJpbmdzLCBzdHJpbmcgPT4ge1xuXHRcdFx0aWYgKERFQlVHKSB7IGNvbnNvbGUubG9nKGBzZW5kICR7IGVudmVsb3BlLnJvb20gfTogJHsgc3RyaW5nIH0gKCR7IGVudmVsb3BlLnVzZXIuaWQgfSlgKTsgfVxuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuc2VuZE1lc3NhZ2UoSW50ZXJuYWxIdWJvdC51c2VyLCB7IG1zZzogc3RyaW5nIH0sIHsgX2lkOiBlbnZlbG9wZS5yb29tIH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gUHVibGljOiBSYXcgbWV0aG9kIGZvciBzZW5kaW5nIGVtb3RlIGRhdGEgYmFjayB0byB0aGUgY2hhdCBzb3VyY2UuXG5cdC8vXG5cdC8vIGVudmVsb3BlIC0gQSBPYmplY3Qgd2l0aCBtZXNzYWdlLCByb29tIGFuZCB1c2VyIGRldGFpbHMuXG5cdC8vIHN0cmluZ3MgIC0gT25lIG9yIG1vcmUgU3RyaW5ncyBmb3IgZWFjaCBtZXNzYWdlIHRvIHNlbmQuXG5cdC8vXG5cdC8vIFJldHVybnMgbm90aGluZy5cblx0ZW1vdGUoZW52ZWxvcGUsIC4uLnN0cmluZ3MpIHtcblx0XHRpZiAoREVCVUcpIHsgY29uc29sZS5sb2coJ1JPQ0tFVENIQVRBREFQVEVSIC0+IGVtb3RlJy5ibHVlKTsgfVxuXHRcdHJldHVybiBzZW5kSGVscGVyKHRoaXMucm9ib3QsIGVudmVsb3BlLCBzdHJpbmdzLCBzdHJpbmcgPT4ge1xuXHRcdFx0aWYgKERFQlVHKSB7IGNvbnNvbGUubG9nKGBlbW90ZSAkeyBlbnZlbG9wZS5yaWQgfTogJHsgc3RyaW5nIH0gKCR7IGVudmVsb3BlLnUudXNlcm5hbWUgfSlgKTsgfVxuXHRcdFx0aWYgKGVudmVsb3BlLm1lc3NhZ2UucHJpdmF0ZSkgeyByZXR1cm4gdGhpcy5wcml2KGVudmVsb3BlLCBgKioqICR7IHN0cmluZyB9ICoqKmApOyB9XG5cdFx0XHRyZXR1cm4gTWV0ZW9yLmNhbGwoJ3NlbmRNZXNzYWdlJywge1xuXHRcdFx0XHRtc2c6IHN0cmluZyxcblx0XHRcdFx0cmlkOiBlbnZlbG9wZS5yaWQsXG5cdFx0XHRcdGFjdGlvbjogdHJ1ZVxuXHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdC8vIFByaXY6IG91ciBleHRlbnNpb24gLS0gc2VuZCBhIFBNIHRvIHVzZXJcblx0cHJpdihlbnZlbG9wZSwgLi4uc3RyaW5ncykge1xuXHRcdGlmIChERUJVRykgeyBjb25zb2xlLmxvZygnUk9DS0VUQ0hBVEFEQVBURVIgLT4gcHJpdicuYmx1ZSk7IH1cblx0XHRyZXR1cm4gc2VuZEhlbHBlcih0aGlzLnJvYm90LCBlbnZlbG9wZSwgc3RyaW5ncywgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRpZiAoREVCVUcpIHsgY29uc29sZS5sb2coYHByaXYgJHsgZW52ZWxvcGUucm9vbSB9OiAkeyBzdHJpbmcgfSAoJHsgZW52ZWxvcGUudXNlci5pZCB9KWApOyB9XG5cdFx0XHRyZXR1cm4gTWV0ZW9yLmNhbGwoJ3NlbmRNZXNzYWdlJywge1xuXHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0dXNlcm5hbWU6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdJbnRlcm5hbEh1Ym90X1VzZXJuYW1lJylcblx0XHRcdFx0fSxcblx0XHRcdFx0dG86IGAkeyBlbnZlbG9wZS51c2VyLmlkIH1gLFxuXHRcdFx0XHRtc2c6IHN0cmluZyxcblx0XHRcdFx0cmlkOiBlbnZlbG9wZS5yb29tXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdC8vIFB1YmxpYzogUmF3IG1ldGhvZCBmb3IgYnVpbGRpbmcgYSByZXBseSBhbmQgc2VuZGluZyBpdCBiYWNrIHRvIHRoZSBjaGF0XG5cdC8vIHNvdXJjZS4gRXh0ZW5kIHRoaXMuXG5cdC8vXG5cdC8vIGVudmVsb3BlIC0gQSBPYmplY3Qgd2l0aCBtZXNzYWdlLCByb29tIGFuZCB1c2VyIGRldGFpbHMuXG5cdC8vIHN0cmluZ3MgIC0gT25lIG9yIG1vcmUgU3RyaW5ncyBmb3IgZWFjaCByZXBseSB0byBzZW5kLlxuXHQvL1xuXHQvLyBSZXR1cm5zIG5vdGhpbmcuXG5cdHJlcGx5KGVudmVsb3BlLCAuLi5zdHJpbmdzKSB7XG5cdFx0aWYgKERFQlVHKSB7IGNvbnNvbGUubG9nKCdST0NLRVRDSEFUQURBUFRFUiAtPiByZXBseScuYmx1ZSk7IH1cblx0XHRpZiAoZW52ZWxvcGUubWVzc2FnZS5wcml2YXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wcml2KGVudmVsb3BlLCAuLi5zdHJpbmdzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2VuZChlbnZlbG9wZSwgLi4uc3RyaW5ncy5tYXAoc3RyID0+IGAkeyBlbnZlbG9wZS51c2VyLm5hbWUgfTogJHsgc3RyIH1gKSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gUHVibGljOiBSYXcgbWV0aG9kIGZvciBzZXR0aW5nIGEgdG9waWMgb24gdGhlIGNoYXQgc291cmNlLiBFeHRlbmQgdGhpcy5cblx0Ly9cblx0Ly8gZW52ZWxvcGUgLSBBIE9iamVjdCB3aXRoIG1lc3NhZ2UsIHJvb20gYW5kIHVzZXIgZGV0YWlscy5cblx0Ly8gc3RyaW5ncyAgLSBPbmUgbW9yZSBtb3JlIFN0cmluZ3MgdG8gc2V0IGFzIHRoZSB0b3BpYy5cblx0Ly9cblx0Ly8gUmV0dXJucyBub3RoaW5nLlxuXHR0b3BpYygvKmVudmVsb3BlLCAuLi5zdHJpbmdzKi8pIHtcblx0XHRpZiAoREVCVUcpIHsgcmV0dXJuIGNvbnNvbGUubG9nKCdST0NLRVRDSEFUQURBUFRFUiAtPiB0b3BpYycuYmx1ZSk7IH1cblx0fVxuXG5cdC8vIFB1YmxpYzogUmF3IG1ldGhvZCBmb3IgcGxheWluZyBhIHNvdW5kIGluIHRoZSBjaGF0IHNvdXJjZS4gRXh0ZW5kIHRoaXMuXG5cdC8vXG5cdC8vIGVudmVsb3BlIC0gQSBPYmplY3Qgd2l0aCBtZXNzYWdlLCByb29tIGFuZCB1c2VyIGRldGFpbHMuXG5cdC8vIHN0cmluZ3MgIC0gT25lIG9yIG1vcmUgc3RyaW5ncyBmb3IgZWFjaCBwbGF5IG1lc3NhZ2UgdG8gc2VuZC5cblx0Ly9cblx0Ly8gUmV0dXJucyBub3RoaW5nXG5cdHBsYXkoLyplbnZlbG9wZSwgLi4uc3RyaW5ncyovKSB7XG5cdFx0aWYgKERFQlVHKSB7IHJldHVybiBjb25zb2xlLmxvZygnUk9DS0VUQ0hBVEFEQVBURVIgLT4gcGxheScuYmx1ZSk7IH1cblx0fVxuXG5cdC8vIFB1YmxpYzogUmF3IG1ldGhvZCBmb3IgaW52b2tpbmcgdGhlIGJvdCB0byBydW4uIEV4dGVuZCB0aGlzLlxuXHQvL1xuXHQvLyBSZXR1cm5zIG5vdGhpbmcuXG5cdHJ1bigpIHtcblx0XHRpZiAoREVCVUcpIHsgY29uc29sZS5sb2coJ1JPQ0tFVENIQVRBREFQVEVSIC0+IHJ1bicuYmx1ZSk7IH1cblx0XHR0aGlzLnJvYm90LmVtaXQoJ2Nvbm5lY3RlZCcpO1xuXHRcdHJldHVybiB0aGlzLnJvYm90LmJyYWluLm1lcmdlRGF0YSh7fSk7XG5cdH1cblx0Ly8gQHJvYm90LmJyYWluLmVtaXQgJ2xvYWRlZCdcblxuXHQvLyBQdWJsaWM6IFJhdyBtZXRob2QgZm9yIHNodXR0aW5nIHRoZSBib3QgZG93bi4gRXh0ZW5kIHRoaXMuXG5cdC8vXG5cdC8vIFJldHVybnMgbm90aGluZy5cblx0Y2xvc2UoKSB7XG5cdFx0aWYgKERFQlVHKSB7IHJldHVybiBjb25zb2xlLmxvZygnUk9DS0VUQ0hBVEFEQVBURVIgLT4gY2xvc2UnLmJsdWUpOyB9XG5cdH1cbn1cblxuY29uc3QgSW50ZXJuYWxIdWJvdFJlY2VpdmVyID0gKG1lc3NhZ2UpID0+IHtcblx0aWYgKERFQlVHKSB7IGNvbnNvbGUubG9nKG1lc3NhZ2UpOyB9XG5cdGlmIChtZXNzYWdlLnUudXNlcm5hbWUgIT09IEludGVybmFsSHVib3QubmFtZSkge1xuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChtZXNzYWdlLnJpZCk7XG5cblx0XHRpZiAocm9vbS50ID09PSAnYycpIHtcblx0XHRcdGNvbnN0IEludGVybmFsSHVib3RVc2VyID0gbmV3IEh1Ym90LlVzZXIobWVzc2FnZS51LnVzZXJuYW1lLCB7cm9vbTogbWVzc2FnZS5yaWR9KTtcblx0XHRcdGNvbnN0IEludGVybmFsSHVib3RUZXh0TWVzc2FnZSA9IG5ldyBIdWJvdC5UZXh0TWVzc2FnZShJbnRlcm5hbEh1Ym90VXNlciwgbWVzc2FnZS5tc2csIG1lc3NhZ2UuX2lkKTtcblx0XHRcdEludGVybmFsSHVib3QuYWRhcHRlci5yZWNlaXZlKEludGVybmFsSHVib3RUZXh0TWVzc2FnZSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBtZXNzYWdlO1xufTtcblxuY2xhc3MgSHVib3RTY3JpcHRzIHtcblx0Y29uc3RydWN0b3Iocm9ib3QpIHtcblx0XHRjb25zdCBtb2R1bGVzVG9Mb2FkID0gW1xuXHRcdFx0J2h1Ym90LWhlbHAvc3JjL2hlbHAuY29mZmVlJ1xuXHRcdF07XG5cdFx0Y29uc3QgY3VzdG9tUGF0aCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdJbnRlcm5hbEh1Ym90X1BhdGhUb0xvYWRDdXN0b21TY3JpcHRzJyk7XG5cdFx0SHVib3RTY3JpcHRzLmxvYWQoYCR7IF9fbWV0ZW9yX2Jvb3RzdHJhcF9fLnNlcnZlckRpciB9L25wbS9ub2RlX21vZHVsZXMvbWV0ZW9yL3JvY2tldGNoYXRfaW50ZXJuYWwtaHVib3Qvbm9kZV9tb2R1bGVzL2AsIG1vZHVsZXNUb0xvYWQsIHJvYm90KTtcblx0XHRIdWJvdFNjcmlwdHMubG9hZChjdXN0b21QYXRoLCBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSW50ZXJuYWxIdWJvdF9TY3JpcHRzVG9Mb2FkJykuc3BsaXQoJywnKSB8fCBbXSwgcm9ib3QpO1xuXHR9XG5cblx0c3RhdGljIGxvYWQocGF0aCwgc2NyaXB0c1RvTG9hZCwgcm9ib3QpIHtcblx0XHRpZiAoIXBhdGggfHwgIXNjcmlwdHNUb0xvYWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c2NyaXB0c1RvTG9hZC5mb3JFYWNoKHNjcmlwdEZpbGUgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c2NyaXB0RmlsZSA9IHMudHJpbShzY3JpcHRGaWxlKTtcblx0XHRcdFx0aWYgKHNjcmlwdEZpbGUgPT09ICcnKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGRlbGV0ZSByZXF1aXJlLmNhY2hlW3JlcXVpcmUucmVzb2x2ZShwYXRoK3NjcmlwdEZpbGUpXTtcblx0XHRcdFx0Y29uc3QgZm4gPSBOcG0ucmVxdWlyZShwYXRoICsgc2NyaXB0RmlsZSk7XG5cdFx0XHRcdGlmICh0eXBlb2YoZm4pID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0Zm4ocm9ib3QpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZuLmRlZmF1bHQocm9ib3QpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJvYm90LnBhcnNlSGVscChwYXRoICsgc2NyaXB0RmlsZSk7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBMb2FkZWQgJHsgc2NyaXB0RmlsZSB9YC5ncmVlbik7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBDYW4ndCBsb2FkICR7IHNjcmlwdEZpbGUgfWAucmVkKTtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY29uc3QgaW5pdCA9IF8uZGVib3VuY2UoTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7XG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSW50ZXJuYWxIdWJvdF9FbmFibGVkJykpIHtcblx0XHRJbnRlcm5hbEh1Ym90ID0gbmV3IFJvYm90KG51bGwsIG51bGwsIGZhbHNlLCBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSW50ZXJuYWxIdWJvdF9Vc2VybmFtZScpKTtcblx0XHRJbnRlcm5hbEh1Ym90LmFsaWFzID0gJ2JvdCc7XG5cdFx0SW50ZXJuYWxIdWJvdC5hZGFwdGVyID0gbmV3IFJvY2tldENoYXRBZGFwdGVyKEludGVybmFsSHVib3QpO1xuXHRcdG5ldyBIdWJvdFNjcmlwdHMoSW50ZXJuYWxIdWJvdCk7XG5cdFx0SW50ZXJuYWxIdWJvdC5ydW4oKTtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlclNhdmVNZXNzYWdlJywgSW50ZXJuYWxIdWJvdFJlY2VpdmVyLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1csICdJbnRlcm5hbEh1Ym90Jyk7XG5cdH0gZWxzZSB7XG5cdFx0SW50ZXJuYWxIdWJvdCA9IHt9O1xuXHRcdHJldHVybiBSb2NrZXRDaGF0LmNhbGxiYWNrcy5yZW1vdmUoJ2FmdGVyU2F2ZU1lc3NhZ2UnLCAnSW50ZXJuYWxIdWJvdCcpO1xuXHR9XG59KSwgMTAwMCk7XG5cbk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRpbml0KCk7XG5cdFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmRCeUlkcyhbICdJbnRlcm5hbEh1Ym90X1VzZXJuYW1lJywgJ0ludGVybmFsSHVib3RfRW5hYmxlZCcsICdJbnRlcm5hbEh1Ym90X1NjcmlwdHNUb0xvYWQnLCAnSW50ZXJuYWxIdWJvdF9QYXRoVG9Mb2FkQ3VzdG9tU2NyaXB0cyddKS5vYnNlcnZlKHtcblx0XHRjaGFuZ2VkKCkge1xuXHRcdFx0cmV0dXJuIGluaXQoKTtcblx0XHR9XG5cdH0pO1xuXHQvLyBUT0RPIHVzZWZ1bCB3aGVuIHdlIGhhdmUgdGhlIGFiaWxpdHkgdG8gaW52YWxpZGF0ZSBgcmVxdWlyZWAgY2FjaGVcblx0Ly8gUm9ja2V0Q2hhdC5SYXRlTGltaXRlci5saW1pdE1ldGhvZCgncmVsb2FkSW50ZXJuYWxIdWJvdCcsIDEsIDUwMDAsIHtcblx0Ly8gXHR1c2VySWQoLyp1c2VySWQqLykgeyByZXR1cm4gdHJ1ZTsgfVxuXHQvLyB9KTtcblx0Ly8gTWV0ZW9yLm1ldGhvZHMoe1xuXHQvLyBcdHJlbG9hZEludGVybmFsSHVib3Q6ICgpID0+IGluaXQoKVxuXHQvLyB9KTtcbn0pO1xuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnSW50ZXJuYWxIdWJvdCcsIGZ1bmN0aW9uKCkge1xuXHR0aGlzLmFkZCgnSW50ZXJuYWxIdWJvdF9FbmFibGVkJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBpMThuTGFiZWw6ICdFbmFibGVkJyB9KTtcblx0dGhpcy5hZGQoJ0ludGVybmFsSHVib3RfVXNlcm5hbWUnLCAncm9ja2V0LmNhdCcsIHsgdHlwZTogJ3N0cmluZycsIGkxOG5MYWJlbDogJ1VzZXJuYW1lJywgaTE4bkRlc2NyaXB0aW9uOiAnSW50ZXJuYWxIdWJvdF9Vc2VybmFtZV9EZXNjcmlwdGlvbicsICdwdWJsaWMnOiB0cnVlIH0pO1xuXHR0aGlzLmFkZCgnSW50ZXJuYWxIdWJvdF9TY3JpcHRzVG9Mb2FkJywgJycsIHsgdHlwZTogJ3N0cmluZyd9KTtcblx0dGhpcy5hZGQoJ0ludGVybmFsSHVib3RfUGF0aFRvTG9hZEN1c3RvbVNjcmlwdHMnLCAnJywgeyB0eXBlOiAnc3RyaW5nJyB9KTtcblx0Ly8gdGhpcy5hZGQoJ0ludGVybmFsSHVib3RfcmVsb2FkJywgJ3JlbG9hZEludGVybmFsSHVib3QnLCB7XG5cdC8vIFx0dHlwZTogJ2FjdGlvbicsXG5cdC8vIFx0YWN0aW9uVGV4dDogJ3JlbG9hZCdcblx0Ly8gfSk7XG59KTtcbiJdfQ==
