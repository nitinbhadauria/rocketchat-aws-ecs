(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var ECMAScript = Package.ecmascript.ECMAScript;
var Random = Package.random.Random;
var Log = Package.logging.Log;
var colors = Package['nooitaf:colors'].colors;
var EventEmitter = Package['raix:eventemitter'].EventEmitter;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var LoggerManager, message, Logger, SystemLogger;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:logger":{"server":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_logger/server/server.js                                                                 //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.export({
	SystemLogger: () => SystemLogger,
	StdOut: () => StdOut,
	LoggerManager: () => LoggerManager,
	processString: () => processString,
	Logger: () => Logger
});

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
//TODO: change this global to import
module.runSetters(LoggerManager = new class extends EventEmitter {
	// eslint-disable-line no-undef
	constructor() {
		super();
		this.enabled = false;
		this.loggers = {};
		this.queue = [];
		this.showPackage = false;
		this.showFileAndLine = false;
		this.logLevel = 0;
	}

	register(logger) {
		if (!logger instanceof Logger) {
			return;
		}

		this.loggers[logger.name] = logger;
		this.emit('register', logger);
	}

	addToQueue(logger, args) {
		this.queue.push({
			logger,
			args
		});
	}

	dispatchQueue() {
		_.each(this.queue, item => item.logger._log.apply(item.logger, item.args));

		this.clearQueue();
	}

	clearQueue() {
		this.queue = [];
	}

	disable() {
		this.enabled = false;
	}

	enable(dispatchQueue = false) {
		this.enabled = true;
		return dispatchQueue === true ? this.dispatchQueue() : this.clearQueue();
	}

}());
const defaultTypes = {
	debug: {
		name: 'debug',
		color: 'blue',
		level: 2
	},
	log: {
		name: 'info',
		color: 'blue',
		level: 1
	},
	info: {
		name: 'info',
		color: 'blue',
		level: 1
	},
	success: {
		name: 'info',
		color: 'green',
		level: 1
	},
	warn: {
		name: 'warn',
		color: 'magenta',
		level: 1
	},
	error: {
		name: 'error',
		color: 'red',
		level: 0
	}
};

class _Logger {
	constructor(name, config = {}) {
		const self = this;
		this.name = name;
		this.config = Object.assign({}, config);

		if (LoggerManager.loggers && LoggerManager.loggers[this.name] != null) {
			LoggerManager.loggers[this.name].warn('Duplicated instance');
			return LoggerManager.loggers[this.name];
		}

		_.each(defaultTypes, (typeConfig, type) => {
			this[type] = function (...args) {
				return self._log.call(self, {
					section: this.__section,
					type,
					level: typeConfig.level,
					method: typeConfig.name,
					'arguments': args
				});
			};

			self[`${type}_box`] = function (...args) {
				return self._log.call(self, {
					section: this.__section,
					type,
					box: true,
					level: typeConfig.level,
					method: typeConfig.name,
					'arguments': args
				});
			};
		});

		if (this.config.methods) {
			_.each(this.config.methods, (typeConfig, method) => {
				if (this[method] != null) {
					self.warn(`Method ${method} already exists`);
				}

				if (defaultTypes[typeConfig.type] == null) {
					self.warn(`Method type ${typeConfig.type} does not exist`);
				}

				this[method] = function (...args) {
					return self._log.call(self, {
						section: this.__section,
						type: typeConfig.type,
						level: typeConfig.level != null ? typeConfig.level : defaultTypes[typeConfig.type] && defaultTypes[typeConfig.type].level,
						method,
						'arguments': args
					});
				};

				this[`${method}_box`] = function (...args) {
					return self._log.call(self, {
						section: this.__section,
						type: typeConfig.type,
						box: true,
						level: typeConfig.level != null ? typeConfig.level : defaultTypes[typeConfig.type] && defaultTypes[typeConfig.type].level,
						method,
						'arguments': args
					});
				};
			});
		}

		if (this.config.sections) {
			_.each(this.config.sections, (name, section) => {
				this[section] = {};

				_.each(defaultTypes, (typeConfig, type) => {
					self[section][type] = (...args) => this[type].apply({
						__section: name
					}, args);

					self[section][`${type}_box`] = (...args) => this[`${type}_box`].apply({
						__section: name
					}, args);
				});

				_.each(this.config.methods, (typeConfig, method) => {
					self[section][method] = (...args) => self[method].apply({
						__section: name
					}, args);

					self[section][`${method}_box`] = (...args) => self[`${method}_box`].apply({
						__section: name
					}, args);
				});
			});
		}

		LoggerManager.register(this);
	}

	getPrefix(options) {
		let prefix = `${this.name} ➔ ${options.method}`;

		if (options.section) {
			prefix = `${this.name} ➔ ${options.section}.${options.method}`;
		}

		const details = this._getCallerDetails();

		const detailParts = [];

		if (details['package'] && (LoggerManager.showPackage === true || options.type === 'error')) {
			detailParts.push(details['package']);
		}

		if (LoggerManager.showFileAndLine === true || options.type === 'error') {
			if (details.file != null && details.line != null) {
				detailParts.push(`${details.file}:${details.line}`);
			} else {
				if (details.file != null) {
					detailParts.push(details.file);
				}

				if (details.line != null) {
					detailParts.push(details.line);
				}
			}
		}

		if (defaultTypes[options.type]) {
			// format the message to a colored message
			prefix = prefix[defaultTypes[options.type].color];
		}

		if (detailParts.length > 0) {
			prefix = `${detailParts.join(' ')} ${prefix}`;
		}

		return prefix;
	}

	_getCallerDetails() {
		const getStack = () => {
			// We do NOT use Error.prepareStackTrace here (a V8 extension that gets us a
			// core-parsed stack) since it's impossible to compose it with the use of
			// Error.prepareStackTrace used on the server for source maps.
			const {
				stack
			} = new Error();
			return stack;
		};

		const stack = getStack();

		if (!stack) {
			return {};
		}

		const lines = stack.split('\n').splice(1); // looking for the first line outside the logging package (or an
		// eval if we find that first)

		let line = lines[0];

		for (let index = 0, len = lines.length; index < len, index++; line = lines[index]) {
			if (line.match(/^\s*at eval \(eval/)) {
				return {
					file: 'eval'
				};
			}

			if (!line.match(/packages\/rocketchat_logger(?:\/|\.js)/)) {
				break;
			}
		}

		const details = {}; // The format for FF is 'functionName@filePath:lineNumber'
		// The format for V8 is 'functionName (packages/logging/logging.js:81)' or
		//                      'packages/logging/logging.js:81'

		const match = /(?:[@(]| at )([^(]+?):([0-9:]+)(?:\)|$)/.exec(line);

		if (!match) {
			return details;
		}

		details.line = match[2].split(':')[0]; // Possible format: https://foo.bar.com/scripts/file.js?random=foobar
		// XXX: if you can write the following in better way, please do it
		// XXX: what about evals?

		details.file = match[1].split('/').slice(-1)[0].split('?')[0];
		const packageMatch = match[1].match(/packages\/([^\.\/]+)(?:\/|\.)/);

		if (packageMatch) {
			details['package'] = packageMatch[1];
		}

		return details;
	}

	makeABox(message, title) {
		if (!_.isArray(message)) {
			message = message.split('\n');
		}

		let len = 0;
		len = Math.max.apply(null, message.map(line => line.length));
		const topLine = `+--${s.pad('', len, '-')}--+`;
		const separator = `|  ${s.pad('', len, '')}  |`;
		let lines = [];
		lines.push(topLine);

		if (title) {
			lines.push(`|  ${s.lrpad(title, len)}  |`);
			lines.push(topLine);
		}

		lines.push(separator);
		lines = [...lines, ...message.map(line => `|  ${s.rpad(line, len)}  |`)];
		lines.push(separator);
		lines.push(topLine);
		return lines;
	}

	_log(options) {
		if (LoggerManager.enabled === false) {
			LoggerManager.addToQueue(this, arguments);
			return;
		}

		if (options.level == null) {
			options.level = 1;
		}

		if (LoggerManager.logLevel < options.level) {
			return;
		}

		const prefix = this.getPrefix(options);

		if (options.box === true && _.isString(options.arguments[0])) {
			let color = undefined;

			if (defaultTypes[options.type]) {
				color = defaultTypes[options.type].color;
			}

			const box = this.makeABox(options.arguments[0], options.arguments[1]);
			let subPrefix = '➔';

			if (color) {
				subPrefix = subPrefix[color];
			}

			console.log(subPrefix, prefix);
			box.forEach(line => {
				console.log(subPrefix, color ? line[color] : line);
			});
		} else {
			options.arguments.unshift(prefix);
			console.log.apply(console, options.arguments);
		}
	}

} // TODO: change this global to import


module.runSetters(Logger = global.Logger = _Logger);

const processString = function (string, date) {
	let obj;

	try {
		if (string[0] === '{') {
			obj = EJSON.parse(string);
		} else {
			obj = {
				message: string,
				time: date,
				level: 'info'
			};
		}

		return Log.format(obj, {
			color: true
		});
	} catch (error) {
		return string;
	}
}; // TODO: change this global to import


module.runSetters(SystemLogger = new Logger('System', {
	// eslint-disable-line no-undef
	methods: {
		startup: {
			type: 'success',
			level: 0
		}
	}
}));
const StdOut = new class extends EventEmitter {
	constructor() {
		super();
		const write = process.stdout.write;
		this.queue = [];

		process.stdout.write = (...args) => {
			write.apply(process.stdout, args);
			const date = new Date();
			const string = processString(args[0], date);
			const item = {
				id: Random.id(),
				string,
				ts: date
			};
			this.queue.push(item);

			if (typeof RocketChat !== 'undefined') {
				const limit = RocketChat.settings.get('Log_View_Limit');

				if (limit && this.queue.length > limit) {
					this.queue.shift();
				}
			}

			this.emit('write', string, item);
		};
	}

}();
Meteor.publish('stdout', function () {
	if (!this.userId || RocketChat.authz.hasPermission(this.userId, 'view-logs') !== true) {
		return this.ready();
	}

	StdOut.queue.forEach(item => {
		this.added('stdout', item.id, {
			string: item.string,
			ts: item.ts
		});
	});
	this.ready();
	StdOut.on('write', (string, item) => {
		this.added('stdout', item.id, {
			string: item.string,
			ts: item.ts
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:logger/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:logger'] = {}, {
  Logger: Logger,
  SystemLogger: SystemLogger,
  LoggerManager: LoggerManager
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_logger.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsb2dnZXIvc2VydmVyL3NlcnZlci5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnQiLCJTeXN0ZW1Mb2dnZXIiLCJTdGRPdXQiLCJMb2dnZXJNYW5hZ2VyIiwicHJvY2Vzc1N0cmluZyIsIkxvZ2dlciIsIl8iLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsInMiLCJFdmVudEVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsImVuYWJsZWQiLCJsb2dnZXJzIiwicXVldWUiLCJzaG93UGFja2FnZSIsInNob3dGaWxlQW5kTGluZSIsImxvZ0xldmVsIiwicmVnaXN0ZXIiLCJsb2dnZXIiLCJuYW1lIiwiZW1pdCIsImFkZFRvUXVldWUiLCJhcmdzIiwicHVzaCIsImRpc3BhdGNoUXVldWUiLCJlYWNoIiwiaXRlbSIsIl9sb2ciLCJhcHBseSIsImNsZWFyUXVldWUiLCJkaXNhYmxlIiwiZW5hYmxlIiwiZGVmYXVsdFR5cGVzIiwiZGVidWciLCJjb2xvciIsImxldmVsIiwibG9nIiwiaW5mbyIsInN1Y2Nlc3MiLCJ3YXJuIiwiZXJyb3IiLCJfTG9nZ2VyIiwiY29uZmlnIiwic2VsZiIsIk9iamVjdCIsImFzc2lnbiIsInR5cGVDb25maWciLCJ0eXBlIiwiY2FsbCIsInNlY3Rpb24iLCJfX3NlY3Rpb24iLCJtZXRob2QiLCJib3giLCJtZXRob2RzIiwic2VjdGlvbnMiLCJnZXRQcmVmaXgiLCJvcHRpb25zIiwicHJlZml4IiwiZGV0YWlscyIsIl9nZXRDYWxsZXJEZXRhaWxzIiwiZGV0YWlsUGFydHMiLCJmaWxlIiwibGluZSIsImxlbmd0aCIsImpvaW4iLCJnZXRTdGFjayIsInN0YWNrIiwiRXJyb3IiLCJsaW5lcyIsInNwbGl0Iiwic3BsaWNlIiwiaW5kZXgiLCJsZW4iLCJtYXRjaCIsImV4ZWMiLCJzbGljZSIsInBhY2thZ2VNYXRjaCIsIm1ha2VBQm94IiwibWVzc2FnZSIsInRpdGxlIiwiaXNBcnJheSIsIk1hdGgiLCJtYXgiLCJtYXAiLCJ0b3BMaW5lIiwicGFkIiwic2VwYXJhdG9yIiwibHJwYWQiLCJycGFkIiwiYXJndW1lbnRzIiwiaXNTdHJpbmciLCJ1bmRlZmluZWQiLCJzdWJQcmVmaXgiLCJjb25zb2xlIiwiZm9yRWFjaCIsInVuc2hpZnQiLCJnbG9iYWwiLCJzdHJpbmciLCJkYXRlIiwib2JqIiwiRUpTT04iLCJwYXJzZSIsInRpbWUiLCJMb2ciLCJmb3JtYXQiLCJzdGFydHVwIiwid3JpdGUiLCJwcm9jZXNzIiwic3Rkb3V0IiwiRGF0ZSIsImlkIiwiUmFuZG9tIiwidHMiLCJSb2NrZXRDaGF0IiwibGltaXQiLCJzZXR0aW5ncyIsImdldCIsInNoaWZ0IiwiTWV0ZW9yIiwicHVibGlzaCIsInVzZXJJZCIsImF1dGh6IiwiaGFzUGVybWlzc2lvbiIsInJlYWR5IiwiYWRkZWQiLCJvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxPQUFPQyxNQUFQLENBQWM7QUFBQ0MsZUFBYSxNQUFJQSxZQUFsQjtBQUErQkMsU0FBTyxNQUFJQSxNQUExQztBQUFpREMsZ0JBQWMsTUFBSUEsYUFBbkU7QUFBaUZDLGdCQUFjLE1BQUlBLGFBQW5HO0FBQWlIQyxTQUFPLE1BQUlBO0FBQTVILENBQWQ7O0FBQW1KLElBQUlDLENBQUo7O0FBQU1QLE9BQU9RLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNKLE1BQUVJLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFBd0QsSUFBSUMsQ0FBSjtBQUFNWixPQUFPUSxLQUFQLENBQWFDLFFBQVEsbUJBQVIsQ0FBYixFQUEwQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0MsTUFBRUQsQ0FBRjtBQUFJOztBQUFoQixDQUExQyxFQUE0RCxDQUE1RDtBQUl2TjtBQUNBLGtDQUFnQixJQUFJLGNBQWNFLFlBQWQsQ0FBMkI7QUFBRTtB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VCxLQUFrQjtBQUNwQyxPQUFLa0csS0FBTCxDQUFXLFFBQVgsRUFBcUJsRyxLQUFLb0YsRUFBMUIsRUFBOEI7QUFDN0JiLFdBQVF2RSxLQUFLdUUsTUFEZ0I7QUFFN0JlLE9BQUl0RixLQUFLc0Y7QUFGb0IsR0FBOUI7QUFJQSxFQUxEO0FBTUEsQ0FuQkQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9sb2dnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWxzIEV2ZW50RW1pdHRlciBMb2dnZXJNYW5hZ2VyIFN5c3RlbUxvZ2dlciBMb2cqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5pbXBvcnQgcyBmcm9tICd1bmRlcnNjb3JlLnN0cmluZyc7XG5cbi8vVE9ETzogY2hhbmdlIHRoaXMgZ2xvYmFsIHRvIGltcG9ydFxuTG9nZ2VyTWFuYWdlciA9IG5ldyBjbGFzcyBleHRlbmRzIEV2ZW50RW1pdHRlciB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHR0aGlzLmxvZ2dlcnMgPSB7fTtcblx0XHR0aGlzLnF1ZXVlID0gW107XG5cdFx0dGhpcy5zaG93UGFja2FnZSA9IGZhbHNlO1xuXHRcdHRoaXMuc2hvd0ZpbGVBbmRMaW5lID0gZmFsc2U7XG5cdFx0dGhpcy5sb2dMZXZlbCA9IDA7XG5cdH1cblx0cmVnaXN0ZXIobG9nZ2VyKSB7XG5cdFx0aWYgKCFsb2dnZXIgaW5zdGFuY2VvZiBMb2dnZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5sb2dnZXJzW2xvZ2dlci5uYW1lXSA9IGxvZ2dlcjtcblx0XHR0aGlzLmVtaXQoJ3JlZ2lzdGVyJywgbG9nZ2VyKTtcblx0fVxuXHRhZGRUb1F1ZXVlKGxvZ2dlciwgYXJncykge1xuXHRcdHRoaXMucXVldWUucHVzaCh7XG5cdFx0XHRsb2dnZXIsIGFyZ3Ncblx0XHR9KTtcblx0fVxuXHRkaXNwYXRjaFF1ZXVlKCkge1xuXHRcdF8uZWFjaCh0aGlzLnF1ZXVlLCAoaXRlbSkgPT4gaXRlbS5sb2dnZXIuX2xvZy5hcHBseShpdGVtLmxvZ2dlciwgaXRlbS5hcmdzKSk7XG5cdFx0dGhpcy5jbGVhclF1ZXVlKCk7XG5cdH1cblx0Y2xlYXJRdWV1ZSgpIHtcblx0XHR0aGlzLnF1ZXVlID0gW107XG5cdH1cblxuXHRkaXNhYmxlKCkge1xuXHRcdHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXHR9XG5cblx0ZW5hYmxlKGRpc3BhdGNoUXVldWUgPSBmYWxzZSkge1xuXHRcdHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cdFx0cmV0dXJuIChkaXNwYXRjaFF1ZXVlID09PSB0cnVlKSA/IHRoaXMuZGlzcGF0Y2hRdWV1ZSgpIDogdGhpcy5jbGVhclF1ZXVlKCk7XG5cdH1cbn07XG5cblxuXG5jb25zdCBkZWZhdWx0VHlwZXMgPSB7XG5cdGRlYnVnOiB7XG5cdFx0bmFtZTogJ2RlYnVnJyxcblx0XHRjb2xvcjogJ2JsdWUnLFxuXHRcdGxldmVsOiAyXG5cdH0sXG5cdGxvZzoge1xuXHRcdG5hbWU6ICdpbmZvJyxcblx0XHRjb2xvcjogJ2JsdWUnLFxuXHRcdGxldmVsOiAxXG5cdH0sXG5cdGluZm86IHtcblx0XHRuYW1lOiAnaW5mbycsXG5cdFx0Y29sb3I6ICdibHVlJyxcblx0XHRsZXZlbDogMVxuXHR9LFxuXHRzdWNjZXNzOiB7XG5cdFx0bmFtZTogJ2luZm8nLFxuXHRcdGNvbG9yOiAnZ3JlZW4nLFxuXHRcdGxldmVsOiAxXG5cdH0sXG5cdHdhcm46IHtcblx0XHRuYW1lOiAnd2FybicsXG5cdFx0Y29sb3I6ICdtYWdlbnRhJyxcblx0XHRsZXZlbDogMVxuXHR9LFxuXHRlcnJvcjoge1xuXHRcdG5hbWU6ICdlcnJvcicsXG5cdFx0Y29sb3I6ICdyZWQnLFxuXHRcdGxldmVsOiAwXG5cdH1cbn07XG5cbmNsYXNzIF9Mb2dnZXIge1xuXHRjb25zdHJ1Y3RvcihuYW1lLCBjb25maWcgPSB7fSkge1xuXHRcdGNvbnN0IHNlbGYgPSB0aGlzO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cblx0XHR0aGlzLmNvbmZpZyA9IE9iamVjdC5hc3NpZ24oe30sIGNvbmZpZyk7XG5cdFx0aWYgKExvZ2dlck1hbmFnZXIubG9nZ2VycyAmJiBMb2dnZXJNYW5hZ2VyLmxvZ2dlcnNbdGhpcy5uYW1lXSAhPSBudWxsKSB7XG5cdFx0XHRMb2dnZXJNYW5hZ2VyLmxvZ2dlcnNbdGhpcy5uYW1lXS53YXJuKCdEdXBsaWNhdGVkIGluc3RhbmNlJyk7XG5cdFx0XHRyZXR1cm4gTG9nZ2VyTWFuYWdlci5sb2dnZXJzW3RoaXMubmFtZV07XG5cdFx0fVxuXHRcdF8uZWFjaChkZWZhdWx0VHlwZXMsICh0eXBlQ29uZmlnLCB0eXBlKSA9PiB7XG5cdFx0XHR0aGlzW3R5cGVdID0gZnVuY3Rpb24oLi4uYXJncykge1xuXHRcdFx0XHRyZXR1cm4gc2VsZi5fbG9nLmNhbGwoc2VsZiwge1xuXHRcdFx0XHRcdHNlY3Rpb246IHRoaXMuX19zZWN0aW9uLFxuXHRcdFx0XHRcdHR5cGUsXG5cdFx0XHRcdFx0bGV2ZWw6IHR5cGVDb25maWcubGV2ZWwsXG5cdFx0XHRcdFx0bWV0aG9kOiB0eXBlQ29uZmlnLm5hbWUsXG5cdFx0XHRcdFx0J2FyZ3VtZW50cyc6IGFyZ3Ncblx0XHRcdFx0fSk7XG5cdFx0XHR9O1xuXG5cdFx0XHRzZWxmW2AkeyB0eXBlIH1fYm94YF0gPSBmdW5jdGlvbiguLi5hcmdzKSB7XG5cdFx0XHRcdHJldHVybiBzZWxmLl9sb2cuY2FsbChzZWxmLCB7XG5cdFx0XHRcdFx0c2VjdGlvbjogdGhpcy5fX3NlY3Rpb24sXG5cdFx0XHRcdFx0dHlwZSxcblx0XHRcdFx0XHRib3g6IHRydWUsXG5cdFx0XHRcdFx0bGV2ZWw6IHR5cGVDb25maWcubGV2ZWwsXG5cdFx0XHRcdFx0bWV0aG9kOiB0eXBlQ29uZmlnLm5hbWUsXG5cdFx0XHRcdFx0J2FyZ3VtZW50cyc6IGFyZ3Ncblx0XHRcdFx0fSk7XG5cdFx0XHR9O1xuXHRcdH0pO1xuXHRcdGlmICh0aGlzLmNvbmZpZy5tZXRob2RzKSB7XG5cdFx0XHRfLmVhY2godGhpcy5jb25maWcubWV0aG9kcywgKHR5cGVDb25maWcsIG1ldGhvZCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpc1ttZXRob2RdICE9IG51bGwpIHtcblx0XHRcdFx0XHRzZWxmLndhcm4oYE1ldGhvZCAkeyBtZXRob2QgfSBhbHJlYWR5IGV4aXN0c2ApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChkZWZhdWx0VHlwZXNbdHlwZUNvbmZpZy50eXBlXSA9PSBudWxsKSB7XG5cdFx0XHRcdFx0c2VsZi53YXJuKGBNZXRob2QgdHlwZSAkeyB0eXBlQ29uZmlnLnR5cGUgfSBkb2VzIG5vdCBleGlzdGApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXNbbWV0aG9kXSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcblx0XHRcdFx0XHRyZXR1cm4gc2VsZi5fbG9nLmNhbGwoc2VsZiwge1xuXHRcdFx0XHRcdFx0c2VjdGlvbjogdGhpcy5fX3NlY3Rpb24sXG5cdFx0XHRcdFx0XHR0eXBlOiB0eXBlQ29uZmlnLnR5cGUsXG5cdFx0XHRcdFx0XHRsZXZlbDogdHlwZUNvbmZpZy5sZXZlbCAhPSBudWxsID8gdHlwZUNvbmZpZy5sZXZlbCA6IGRlZmF1bHRUeXBlc1t0eXBlQ29uZmlnLnR5cGVdICYmIGRlZmF1bHRUeXBlc1t0eXBlQ29uZmlnLnR5cGVdLmxldmVsLFxuXHRcdFx0XHRcdFx0bWV0aG9kLFxuXHRcdFx0XHRcdFx0J2FyZ3VtZW50cyc6IGFyZ3Ncblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpc1tgJHsgbWV0aG9kIH1fYm94YF0gPSBmdW5jdGlvbiguLi5hcmdzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNlbGYuX2xvZy5jYWxsKHNlbGYsIHtcblx0XHRcdFx0XHRcdHNlY3Rpb246IHRoaXMuX19zZWN0aW9uLFxuXHRcdFx0XHRcdFx0dHlwZTogdHlwZUNvbmZpZy50eXBlLFxuXHRcdFx0XHRcdFx0Ym94OiB0cnVlLFxuXHRcdFx0XHRcdFx0bGV2ZWw6IHR5cGVDb25maWcubGV2ZWwgIT0gbnVsbCA/IHR5cGVDb25maWcubGV2ZWwgOiBkZWZhdWx0VHlwZXNbdHlwZUNvbmZpZy50eXBlXSAmJiBkZWZhdWx0VHlwZXNbdHlwZUNvbmZpZy50eXBlXS5sZXZlbCxcblx0XHRcdFx0XHRcdG1ldGhvZCxcblx0XHRcdFx0XHRcdCdhcmd1bWVudHMnOiBhcmdzXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY29uZmlnLnNlY3Rpb25zKSB7XG5cdFx0XHRfLmVhY2godGhpcy5jb25maWcuc2VjdGlvbnMsIChuYW1lLCBzZWN0aW9uKSA9PiB7XG5cdFx0XHRcdHRoaXNbc2VjdGlvbl0gPSB7fTtcblx0XHRcdFx0Xy5lYWNoKGRlZmF1bHRUeXBlcywgKHR5cGVDb25maWcsIHR5cGUpID0+IHtcblx0XHRcdFx0XHRzZWxmW3NlY3Rpb25dW3R5cGVdID0gKC4uLmFyZ3MpID0+IHRoaXNbdHlwZV0uYXBwbHkoe19fc2VjdGlvbjogbmFtZX0sIGFyZ3MpO1xuXHRcdFx0XHRcdHNlbGZbc2VjdGlvbl1bYCR7IHR5cGUgfV9ib3hgXSA9ICguLi5hcmdzKSA9PiB0aGlzW2AkeyB0eXBlIH1fYm94YF0uYXBwbHkoe19fc2VjdGlvbjogbmFtZX0sIGFyZ3MpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Xy5lYWNoKHRoaXMuY29uZmlnLm1ldGhvZHMsICh0eXBlQ29uZmlnLCBtZXRob2QpID0+IHtcblx0XHRcdFx0XHRzZWxmW3NlY3Rpb25dW21ldGhvZF0gPSAoLi4uYXJncykgPT4gc2VsZlttZXRob2RdLmFwcGx5KHtfX3NlY3Rpb246IG5hbWV9LCBhcmdzKTtcblx0XHRcdFx0XHRzZWxmW3NlY3Rpb25dW2AkeyBtZXRob2QgfV9ib3hgXSA9ICguLi5hcmdzKSA9PiBzZWxmW2AkeyBtZXRob2QgfV9ib3hgXS5hcHBseSh7X19zZWN0aW9uOiBuYW1lfSwgYXJncyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0TG9nZ2VyTWFuYWdlci5yZWdpc3Rlcih0aGlzKTtcblx0fVxuXHRnZXRQcmVmaXgob3B0aW9ucykge1xuXHRcdGxldCBwcmVmaXggPSBgJHsgdGhpcy5uYW1lIH0g4p6UICR7IG9wdGlvbnMubWV0aG9kIH1gO1xuXHRcdGlmIChvcHRpb25zLnNlY3Rpb24pIHtcblx0XHRcdHByZWZpeCA9IGAkeyB0aGlzLm5hbWUgfSDinpQgJHsgb3B0aW9ucy5zZWN0aW9uIH0uJHsgb3B0aW9ucy5tZXRob2QgfWA7XG5cdFx0fVxuXHRcdGNvbnN0IGRldGFpbHMgPSB0aGlzLl9nZXRDYWxsZXJEZXRhaWxzKCk7XG5cdFx0Y29uc3QgZGV0YWlsUGFydHMgPSBbXTtcblx0XHRpZiAoZGV0YWlsc1sncGFja2FnZSddICYmIChMb2dnZXJNYW5hZ2VyLnNob3dQYWNrYWdlID09PSB0cnVlIHx8IG9wdGlvbnMudHlwZSA9PT0gJ2Vycm9yJykpIHtcblx0XHRcdGRldGFpbFBhcnRzLnB1c2goZGV0YWlsc1sncGFja2FnZSddKTtcblx0XHR9XG5cdFx0aWYgKExvZ2dlck1hbmFnZXIuc2hvd0ZpbGVBbmRMaW5lID09PSB0cnVlIHx8IG9wdGlvbnMudHlwZSA9PT0gJ2Vycm9yJykge1xuXHRcdFx0aWYgKChkZXRhaWxzLmZpbGUgIT0gbnVsbCkgJiYgKGRldGFpbHMubGluZSAhPSBudWxsKSkge1xuXHRcdFx0XHRkZXRhaWxQYXJ0cy5wdXNoKGAkeyBkZXRhaWxzLmZpbGUgfTokeyBkZXRhaWxzLmxpbmUgfWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGRldGFpbHMuZmlsZSAhPSBudWxsKSB7XG5cdFx0XHRcdFx0ZGV0YWlsUGFydHMucHVzaChkZXRhaWxzLmZpbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChkZXRhaWxzLmxpbmUgIT0gbnVsbCkge1xuXHRcdFx0XHRcdGRldGFpbFBhcnRzLnB1c2goZGV0YWlscy5saW5lKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoZGVmYXVsdFR5cGVzW29wdGlvbnMudHlwZV0pIHtcblx0XHRcdC8vIGZvcm1hdCB0aGUgbWVzc2FnZSB0byBhIGNvbG9yZWQgbWVzc2FnZVxuXHRcdFx0cHJlZml4ID0gcHJlZml4W2RlZmF1bHRUeXBlc1tvcHRpb25zLnR5cGVdLmNvbG9yXTtcblx0XHR9XG5cdFx0aWYgKGRldGFpbFBhcnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHByZWZpeCA9IGAkeyBkZXRhaWxQYXJ0cy5qb2luKCcgJykgfSAkeyBwcmVmaXggfWA7XG5cdFx0fVxuXHRcdHJldHVybiBwcmVmaXg7XG5cdH1cblx0X2dldENhbGxlckRldGFpbHMoKSB7XG5cdFx0Y29uc3QgZ2V0U3RhY2sgPSAoKSA9PiB7XG5cdFx0XHQvLyBXZSBkbyBOT1QgdXNlIEVycm9yLnByZXBhcmVTdGFja1RyYWNlIGhlcmUgKGEgVjggZXh0ZW5zaW9uIHRoYXQgZ2V0cyB1cyBhXG5cdFx0XHQvLyBjb3JlLXBhcnNlZCBzdGFjaykgc2luY2UgaXQncyBpbXBvc3NpYmxlIHRvIGNvbXBvc2UgaXQgd2l0aCB0aGUgdXNlIG9mXG5cdFx0XHQvLyBFcnJvci5wcmVwYXJlU3RhY2tUcmFjZSB1c2VkIG9uIHRoZSBzZXJ2ZXIgZm9yIHNvdXJjZSBtYXBzLlxuXHRcdFx0Y29uc3Qge3N0YWNrfSA9IG5ldyBFcnJvcigpO1xuXHRcdFx0cmV0dXJuIHN0YWNrO1xuXHRcdH07XG5cdFx0Y29uc3Qgc3RhY2sgPSBnZXRTdGFjaygpO1xuXHRcdGlmICghc3RhY2spIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cdFx0Y29uc3QgbGluZXMgPSBzdGFjay5zcGxpdCgnXFxuJykuc3BsaWNlKDEpO1xuXHRcdC8vIGxvb2tpbmcgZm9yIHRoZSBmaXJzdCBsaW5lIG91dHNpZGUgdGhlIGxvZ2dpbmcgcGFja2FnZSAob3IgYW5cblx0XHQvLyBldmFsIGlmIHdlIGZpbmQgdGhhdCBmaXJzdClcblx0XHRsZXQgbGluZSA9IGxpbmVzWzBdO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpbmRleCA8IGxlbiwgaW5kZXgrKzsgbGluZSA9IGxpbmVzW2luZGV4XSkge1xuXHRcdFx0aWYgKGxpbmUubWF0Y2goL15cXHMqYXQgZXZhbCBcXChldmFsLykpIHtcblx0XHRcdFx0cmV0dXJuIHtmaWxlOiAnZXZhbCd9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWxpbmUubWF0Y2goL3BhY2thZ2VzXFwvcm9ja2V0Y2hhdF9sb2dnZXIoPzpcXC98XFwuanMpLykpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGV0YWlscyA9IHt9O1xuXHRcdC8vIFRoZSBmb3JtYXQgZm9yIEZGIGlzICdmdW5jdGlvbk5hbWVAZmlsZVBhdGg6bGluZU51bWJlcidcblx0XHQvLyBUaGUgZm9ybWF0IGZvciBWOCBpcyAnZnVuY3Rpb25OYW1lIChwYWNrYWdlcy9sb2dnaW5nL2xvZ2dpbmcuanM6ODEpJyBvclxuXHRcdC8vICAgICAgICAgICAgICAgICAgICAgICdwYWNrYWdlcy9sb2dnaW5nL2xvZ2dpbmcuanM6ODEnXG5cdFx0Y29uc3QgbWF0Y2ggPSAvKD86W0AoXXwgYXQgKShbXihdKz8pOihbMC05Ol0rKSg/OlxcKXwkKS8uZXhlYyhsaW5lKTtcblx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRyZXR1cm4gZGV0YWlscztcblx0XHR9XG5cdFx0ZGV0YWlscy5saW5lID0gbWF0Y2hbMl0uc3BsaXQoJzonKVswXTtcblx0XHQvLyBQb3NzaWJsZSBmb3JtYXQ6IGh0dHBzOi8vZm9vLmJhci5jb20vc2NyaXB0cy9maWxlLmpzP3JhbmRvbT1mb29iYXJcblx0XHQvLyBYWFg6IGlmIHlvdSBjYW4gd3JpdGUgdGhlIGZvbGxvd2luZyBpbiBiZXR0ZXIgd2F5LCBwbGVhc2UgZG8gaXRcblx0XHQvLyBYWFg6IHdoYXQgYWJvdXQgZXZhbHM/XG5cdFx0ZGV0YWlscy5maWxlID0gbWF0Y2hbMV0uc3BsaXQoJy8nKS5zbGljZSgtMSlbMF0uc3BsaXQoJz8nKVswXTtcblx0XHRjb25zdCBwYWNrYWdlTWF0Y2ggPSBtYXRjaFsxXS5tYXRjaCgvcGFja2FnZXNcXC8oW15cXC5cXC9dKykoPzpcXC98XFwuKS8pO1xuXHRcdGlmIChwYWNrYWdlTWF0Y2gpIHtcblx0XHRcdGRldGFpbHNbJ3BhY2thZ2UnXSA9IHBhY2thZ2VNYXRjaFsxXTtcblx0XHR9XG5cdFx0cmV0dXJuIGRldGFpbHM7XG5cdH1cblx0bWFrZUFCb3gobWVzc2FnZSwgdGl0bGUpIHtcblx0XHRpZiAoIV8uaXNBcnJheShtZXNzYWdlKSkge1xuXHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpO1xuXHRcdH1cblx0XHRsZXQgbGVuID0gMDtcblxuXHRcdGxlbiA9IE1hdGgubWF4LmFwcGx5KG51bGwsIG1lc3NhZ2UubWFwKGxpbmUgPT4gbGluZS5sZW5ndGgpKTtcblxuXHRcdGNvbnN0IHRvcExpbmUgPSBgKy0tJHsgcy5wYWQoJycsIGxlbiwgJy0nKSB9LS0rYDtcblx0XHRjb25zdCBzZXBhcmF0b3IgPSBgfCAgJHsgcy5wYWQoJycsIGxlbiwgJycpIH0gIHxgO1xuXHRcdGxldCBsaW5lcyA9IFtdO1xuXG5cdFx0bGluZXMucHVzaCh0b3BMaW5lKTtcblx0XHRpZiAodGl0bGUpIHtcblx0XHRcdGxpbmVzLnB1c2goYHwgICR7IHMubHJwYWQodGl0bGUsIGxlbikgfSAgfGApO1xuXHRcdFx0bGluZXMucHVzaCh0b3BMaW5lKTtcblx0XHR9XG5cdFx0bGluZXMucHVzaChzZXBhcmF0b3IpO1xuXG5cdFx0bGluZXMgPSBbLi4ubGluZXMsIC4uLm1lc3NhZ2UubWFwKGxpbmUgPT4gYHwgICR7IHMucnBhZChsaW5lLCBsZW4pIH0gIHxgKV07XG5cblx0XHRsaW5lcy5wdXNoKHNlcGFyYXRvcik7XG5cdFx0bGluZXMucHVzaCh0b3BMaW5lKTtcblx0XHRyZXR1cm4gbGluZXM7XG5cdH1cblxuXHRfbG9nKG9wdGlvbnMpIHtcblx0XHRpZiAoTG9nZ2VyTWFuYWdlci5lbmFibGVkID09PSBmYWxzZSkge1xuXHRcdFx0TG9nZ2VyTWFuYWdlci5hZGRUb1F1ZXVlKHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmxldmVsID09IG51bGwpIHtcblx0XHRcdG9wdGlvbnMubGV2ZWwgPSAxO1xuXHRcdH1cblxuXHRcdGlmIChMb2dnZXJNYW5hZ2VyLmxvZ0xldmVsIDwgb3B0aW9ucy5sZXZlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZWZpeCA9IHRoaXMuZ2V0UHJlZml4KG9wdGlvbnMpO1xuXG5cdFx0aWYgKG9wdGlvbnMuYm94ID09PSB0cnVlICYmIF8uaXNTdHJpbmcob3B0aW9ucy5hcmd1bWVudHNbMF0pKSB7XG5cdFx0XHRsZXQgY29sb3IgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZGVmYXVsdFR5cGVzW29wdGlvbnMudHlwZV0pIHtcblx0XHRcdFx0Y29sb3IgPSBkZWZhdWx0VHlwZXNbb3B0aW9ucy50eXBlXS5jb2xvcjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYm94ID0gdGhpcy5tYWtlQUJveChvcHRpb25zLmFyZ3VtZW50c1swXSwgb3B0aW9ucy5hcmd1bWVudHNbMV0pO1xuXHRcdFx0bGV0IHN1YlByZWZpeCA9ICfinpQnO1xuXHRcdFx0aWYgKGNvbG9yKSB7XG5cdFx0XHRcdHN1YlByZWZpeCA9IHN1YlByZWZpeFtjb2xvcl07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnNvbGUubG9nKHN1YlByZWZpeCwgcHJlZml4KTtcblx0XHRcdGJveC5mb3JFYWNoKGxpbmUgPT4ge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhzdWJQcmVmaXgsIGNvbG9yID8gbGluZVtjb2xvcl06IGxpbmUpO1xuXHRcdFx0fSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0b3B0aW9ucy5hcmd1bWVudHMudW5zaGlmdChwcmVmaXgpO1xuXHRcdFx0Y29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgb3B0aW9ucy5hcmd1bWVudHMpO1xuXHRcdH1cblx0fVxufVxuLy8gVE9ETzogY2hhbmdlIHRoaXMgZ2xvYmFsIHRvIGltcG9ydFxuTG9nZ2VyID0gZ2xvYmFsLkxvZ2dlciA9IF9Mb2dnZXI7XG5jb25zdCBwcm9jZXNzU3RyaW5nID0gZnVuY3Rpb24oc3RyaW5nLCBkYXRlKSB7XG5cdGxldCBvYmo7XG5cdHRyeSB7XG5cdFx0aWYgKHN0cmluZ1swXSA9PT0gJ3snKSB7XG5cdFx0XHRvYmogPSBFSlNPTi5wYXJzZShzdHJpbmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvYmogPSB7XG5cdFx0XHRcdG1lc3NhZ2U6IHN0cmluZyxcblx0XHRcdFx0dGltZTogZGF0ZSxcblx0XHRcdFx0bGV2ZWw6ICdpbmZvJ1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIExvZy5mb3JtYXQob2JqLCB7Y29sb3I6IHRydWV9KTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRyZXR1cm4gc3RyaW5nO1xuXHR9XG59O1xuLy8gVE9ETzogY2hhbmdlIHRoaXMgZ2xvYmFsIHRvIGltcG9ydFxuU3lzdGVtTG9nZ2VyID0gbmV3IExvZ2dlcignU3lzdGVtJywgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG5cdG1ldGhvZHM6IHtcblx0XHRzdGFydHVwOiB7XG5cdFx0XHR0eXBlOiAnc3VjY2VzcycsXG5cdFx0XHRsZXZlbDogMFxuXHRcdH1cblx0fVxufSk7XG5cblxuY29uc3QgU3RkT3V0ID0gbmV3IGNsYXNzIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCB3cml0ZSA9IHByb2Nlc3Muc3Rkb3V0LndyaXRlO1xuXHRcdHRoaXMucXVldWUgPSBbXTtcblx0XHRwcm9jZXNzLnN0ZG91dC53cml0ZSA9ICguLi5hcmdzKSA9PiB7XG5cdFx0XHR3cml0ZS5hcHBseShwcm9jZXNzLnN0ZG91dCwgYXJncyk7XG5cdFx0XHRjb25zdCBkYXRlID0gbmV3IERhdGU7XG5cdFx0XHRjb25zdCBzdHJpbmcgPSBwcm9jZXNzU3RyaW5nKGFyZ3NbMF0sIGRhdGUpO1xuXHRcdFx0Y29uc3QgaXRlbSA9IHtcblx0XHRcdFx0aWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0XHRzdHJpbmcsXG5cdFx0XHRcdHRzOiBkYXRlXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5xdWV1ZS5wdXNoKGl0ZW0pO1xuXG5cdFx0XHRpZiAodHlwZW9mIFJvY2tldENoYXQgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdGNvbnN0IGxpbWl0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xvZ19WaWV3X0xpbWl0Jyk7XG5cdFx0XHRcdGlmIChsaW1pdCAmJiB0aGlzLnF1ZXVlLmxlbmd0aCA+IGxpbWl0KSB7XG5cdFx0XHRcdFx0dGhpcy5xdWV1ZS5zaGlmdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVtaXQoJ3dyaXRlJywgc3RyaW5nLCBpdGVtKTtcblx0XHR9O1xuXHR9XG59O1xuXG5cbk1ldGVvci5wdWJsaXNoKCdzdGRvdXQnLCBmdW5jdGlvbigpIHtcblx0aWYgKCF0aGlzLnVzZXJJZCB8fCBSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxvZ3MnKSAhPT0gdHJ1ZSkge1xuXHRcdHJldHVybiB0aGlzLnJlYWR5KCk7XG5cdH1cblxuXHRTdGRPdXQucXVldWUuZm9yRWFjaChpdGVtID0+IHtcblx0XHR0aGlzLmFkZGVkKCdzdGRvdXQnLCBpdGVtLmlkLCB7XG5cdFx0XHRzdHJpbmc6IGl0ZW0uc3RyaW5nLFxuXHRcdFx0dHM6IGl0ZW0udHNcblx0XHR9KTtcblx0fSk7XG5cblx0dGhpcy5yZWFkeSgpO1xuXHRTdGRPdXQub24oJ3dyaXRlJywgKHN0cmluZywgaXRlbSkgPT4ge1xuXHRcdHRoaXMuYWRkZWQoJ3N0ZG91dCcsIGl0ZW0uaWQsIHtcblx0XHRcdHN0cmluZzogaXRlbS5zdHJpbmcsXG5cdFx0XHR0czogaXRlbS50c1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5cbmV4cG9ydCB7IFN5c3RlbUxvZ2dlciwgU3RkT3V0LCBMb2dnZXJNYW5hZ2VyLCBwcm9jZXNzU3RyaW5nLCBMb2dnZXIgfTtcbiJdfQ==
