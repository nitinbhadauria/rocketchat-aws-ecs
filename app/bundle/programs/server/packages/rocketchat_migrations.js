(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var ECMAScript = Package.ecmascript.ECMAScript;
var check = Package.check.check;
var Match = Package.check.Match;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Migrations, migrated;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:migrations":{"migrations.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_migrations/migrations.js                                                                //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 1);
/*
	Adds migration capabilities. Migrations are defined like:

	Migrations.add({
		up: function() {}, //*required* code to run to migrate upwards
		version: 1, //*required* number to identify migration order
		down: function() {}, //*optional* code to run to migrate downwards
		name: 'Something' //*optional* display name for the migration
	});

	The ordering of migrations is determined by the version you set.

	To run the migrations, set the MIGRATE environment variable to either
	'latest' or the version number you want to migrate to. Optionally, append
	',exit' if you want the migrations to exit the meteor process, e.g if you're
	migrating from a script (remember to pass the --once parameter).

	e.g:
	MIGRATE="latest" mrt # ensure we'll be at the latest version and run the app
	MIGRATE="latest,exit" mrt --once # ensure we'll be at the latest version and exit
	MIGRATE="2,exit" mrt --once # migrate to version 2 and exit

	Note: Migrations will lock ensuring only 1 app can be migrating at once. If
	a migration crashes, the control record in the migrations collection will
	remain locked and at the version it was at previously, however the db could
	be in an inconsistant state.
*/ // since we'll be at version 0 by default, we should have a migration set for it.
var DefaultMigration = {
	version: 0,
	up: function () {// @TODO: check if collection "migrations" exist
		// If exists, rename and rerun _migrateTo
	}
};
Migrations = {
	_list: [DefaultMigration],
	options: {
		// false disables logging
		log: true,
		// null or a function
		logger: null,
		// enable/disable info log "already at latest."
		logIfLatest: true,
		// lock will be valid for this amount of minutes
		lockExpiration: 5,
		// retry interval in seconds
		retryInterval: 10,
		// max number of attempts to retry unlock
		maxAttempts: 30,
		// migrations collection name
		collectionName: "migrations" // collectionName: "rocketchat_migrations"

	},
	config: function (opts) {
		this.options = _.extend({}, this.options, opts);
	}
};
Migrations._collection = new Mongo.Collection(Migrations.options.collectionName); /* Create a box around messages for displaying on a console.log */

function makeABox(message, color = 'red') {
	if (!_.isArray(message)) {
		message = message.split("\n");
	}

	let len = _(message).reduce(function (memo, msg) {
		return Math.max(memo, msg.length);
	}, 0) + 4;
	let text = message.map(msg => {
		return "|"[color] + s.lrpad(msg, len)[color] + "|"[color];
	}).join("\n");
	let topLine = "+"[color] + s.pad('', len, '-')[color] + "+"[color];
	let separator = "|"[color] + s.pad('', len, '') + "|"[color];
	let bottomLine = "+"[color] + s.pad('', len, '-')[color] + "+"[color];
	return `\n${topLine}\n${separator}\n${text}\n${separator}\n${bottomLine}\n`;
} /*
  	Logger factory function. Takes a prefix string and options object
  	and uses an injected `logger` if provided, else falls back to
  	Meteor's `Log` package.
  	Will send a log object to the injected logger, on the following form:
  		message: String
  		level: String (info, warn, error, debug)
  		tag: 'Migrations'
  */

function createLogger(prefix) {
	check(prefix, String); // Return noop if logging is disabled.

	if (Migrations.options.log === false) {
		return function () {};
	}

	return function (level, message) {
		check(level, Match.OneOf('info', 'error', 'warn', 'debug'));
		check(message, Match.OneOf(String, [String]));
		var logger = Migrations.options && Migrations.options.logger;

		if (logger && _.isFunction(logger)) {
			logger({
				level: level,
				message: message,
				tag: prefix
			});
		} else {
			Log[level]({
				message: prefix + ': ' + message
			});
		}
	};
}

var log;
var options = Migrations.options; // collection holding the control record

log = createLogger('Migrations');
['info', 'warn', 'error', 'debug'].forEach(function (level) {
	log[level] = _.partial(log, level);
}); // if (process.env.MIGRATE)
//   Migrations.migrateTo(process.env.MIGRATE);
// Add a new migration:
// {up: function *required
//  version: Number *required
//  down: function *optional
//  name: String *optional
// }

Migrations.add = function (migration) {
	if (typeof migration.up !== 'function') throw new Meteor.Error('Migration must supply an up function.');
	if (typeof migration.version !== 'number') throw new Meteor.Error('Migration must supply a version number.');
	if (migration.version <= 0) throw new Meteor.Error('Migration version must be greater than 0'); // Freeze the migration object to make it hereafter immutable

	Object.freeze(migration);

	this._list.push(migration);

	this._list = _.sortBy(this._list, function (m) {
		return m.version;
	});
}; // Attempts to run the migrations using command in the form of:
// e.g 'latest', 'latest,exit', 2
// use 'XX,rerun' to re-run the migration at that version


Migrations.migrateTo = function (command) {
	if (_.isUndefined(command) || command === '' || this._list.length === 0) throw new Error("Cannot migrate using invalid command: " + command);

	if (typeof command === 'number') {
		var version = command;
	} else {
		var version = command.split(',')[0];
		var subcommand = command.split(',')[1];
	}

	const maxAttempts = Migrations.options.maxAttempts;
	const retryInterval = Migrations.options.retryInterval;

	for (let attempts = 1; attempts <= maxAttempts; attempts++) {
		if (version === 'latest') {
			migrated = this._migrateTo(_.last(this._list).version);
		} else {
			migrated = this._migrateTo(parseInt(version), subcommand === 'rerun');
		}

		if (migrated) {
			break;
		} else {
			let willRetry;

			if (attempts < maxAttempts) {
				willRetry = ` Trying again in ${retryInterval} seconds.`;

				Meteor._sleepForMs(retryInterval * 1000);
			} else {
				willRetry = "";
			}

			console.log(`Not migrating, control is locked. Attempt ${attempts}/${maxAttempts}.${willRetry}`.yellow);
		}
	}

	if (!migrated) {
		let control = this._getControl(); // Side effect: upserts control document.


		console.log(makeABox(["ERROR! SERVER STOPPED", "", "Your database migration control is locked.", "Please make sure you are running the latest version and try again.", "If the problem persists, please contact support.", "", "This Rocket.Chat version: " + RocketChat.Info.version, "Database locked at version: " + control.version, "Database target version: " + (version === 'latest' ? _.last(this._list).version : version), "", "Commit: " + RocketChat.Info.commit.hash, "Date: " + RocketChat.Info.commit.date, "Branch: " + RocketChat.Info.commit.branch, "Tag: " + RocketChat.Info.commit.tag]));
		process.exit(1);
	} // remember to run meteor with --once otherwise it will restart


	if (subcommand === 'exit') process.exit(0);
}; // just returns the current version


Migrations.getVersion = function () {
	return this._getControl().version;
}; // migrates to the specific version passed in


Migrations._migrateTo = function (version, rerun) {
	var self = this;

	var control = this._getControl(); // Side effect: upserts control document.


	var currentVersion = control.version;

	if (lock() === false) {
		// log.info('Not migrating, control is locked.');
		// Warning
		return false;
	}

	if (rerun) {
		log.info('Rerunning version ' + version);
		migrate('up', this._findIndexByVersion(version));
		log.info('Finished migrating.');
		unlock();
		return true;
	}

	if (currentVersion === version) {
		if (this.options.logIfLatest) {
			log.info('Not migrating, already at version ' + version);
		}

		unlock();
		return true;
	}

	var startIdx = this._findIndexByVersion(currentVersion);

	var endIdx = this._findIndexByVersion(version); // log.info('startIdx:' + startIdx + ' endIdx:' + endIdx);


	log.info('Migrating from version ' + this._list[startIdx].version + ' -> ' + this._list[endIdx].version); // run the actual migration

	function migrate(direction, idx) {
		var migration = self._list[idx];

		if (typeof migration[direction] !== 'function') {
			unlock();
			throw new Meteor.Error('Cannot migrate ' + direction + ' on version ' + migration.version);
		}

		function maybeName() {
			return migration.name ? ' (' + migration.name + ')' : '';
		}

		log.info('Running ' + direction + '() on version ' + migration.version + maybeName());

		try {
			RocketChat.models._CacheControl.withValue(false, function () {
				migration[direction](migration);
			});
		} catch (e) {
			console.log(makeABox(["ERROR! SERVER STOPPED", "", "Your database migration failed:", e.message, "", "Please make sure you are running the latest version and try again.", "If the problem persists, please contact support.", "", "This Rocket.Chat version: " + RocketChat.Info.version, "Database locked at version: " + control.version, "Database target version: " + version, "", "Commit: " + RocketChat.Info.commit.hash, "Date: " + RocketChat.Info.commit.date, "Branch: " + RocketChat.Info.commit.branch, "Tag: " + RocketChat.Info.commit.tag]));
			process.exit(1);
		}
	} // Returns true if lock was acquired.


	function lock() {
		const date = new Date();
		const dateMinusInterval = moment(date).subtract(self.options.lockExpiration, 'minutes').toDate();
		const build = RocketChat.Info ? RocketChat.Info.build.date : date; // This is atomic. The selector ensures only one caller at a time will see
		// the unlocked control, and locking occurs in the same update's modifier.
		// All other simultaneous callers will get false back from the update.

		return self._collection.update({
			_id: 'control',
			$or: [{
				locked: false
			}, {
				lockedAt: {
					$lt: dateMinusInterval
				}
			}, {
				buildAt: {
					$ne: build
				}
			}]
		}, {
			$set: {
				locked: true,
				lockedAt: date,
				buildAt: build
			}
		}) === 1;
	} // Side effect: saves version.


	function unlock() {
		self._setControl({
			locked: false,
			version: currentVersion
		});
	}

	if (currentVersion < version) {
		for (var i = startIdx; i < endIdx; i++) {
			migrate('up', i + 1);
			currentVersion = self._list[i + 1].version;

			self._setControl({
				locked: true,
				version: currentVersion
			});
		}
	} else {
		for (var i = startIdx; i > endIdx; i--) {
			migrate('down', i);
			currentVersion = self._list[i - 1].version;

			self._setControl({
				locked: true,
				version: currentVersion
			});
		}
	}

	unlock();
	log.info('Finished migrating.');
}; // gets the current control record, optionally creating it if non-existant


Migrations._getControl = function () {
	var control = this._collection.findOne({
		_id: 'control'
	});

	return control || this._setControl({
		version: 0,
		locked: false
	});
}; // sets the control record


Migrations._setControl = function (control) {
	// be quite strict
	check(control.version, Number);
	check(control.locked, Boolean);

	this._collection.update({
		_id: 'control'
	}, {
		$set: {
			version: control.version,
			locked: control.locked
		}
	}, {
		upsert: true
	});

	return control;
}; // returns the migration index in _list or throws if not found


Migrations._findIndexByVersion = function (version) {
	for (var i = 0; i < this._list.length; i++) {
		if (this._list[i].version === version) return i;
	}

	throw new Meteor.Error('Can\'t find migration version ' + version);
}; //reset (mainly intended for tests)


Migrations._reset = function () {
	this._list = [{
		version: 0,
		up: function () {}
	}];

	this._collection.remove({});
};

RocketChat.Migrations = Migrations;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:migrations/migrations.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:migrations'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_migrations.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptaWdyYXRpb25zL21pZ3JhdGlvbnMuanMiXSwibmFtZXMiOlsiXyIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2IiwibW9tZW50IiwiRGVmYXVsdE1pZ3JhdGlvbiIsInZlcnNpb24iLCJ1cCIsIk1pZ3JhdGlvbnMiLCJfbGlzdCIsIm9wdGlvbnMiLCJsb2ciLCJsb2dnZXIiLCJsb2dJZkxhdGVzdCIsImxvY2tFeHBpcmF0aW9uIiwicmV0cnlJbnRlcnZhbCIsIm1heEF0dGVtcHRzIiwiY29sbGVjdGlvbk5hbWUiLCJjb25maWciLCJvcHRzIiwiZXh0ZW5kIiwiX2NvbGxlY3Rpb24iLCJNb25nbyIsIkNvbGxlY3Rpb24iLCJtYWtlQUJveCIsIm1lc3NhZ2UiLCJjb2xvciIsImlzQXJyYXkiLCJzcGxpdCIsImxlbiIsInJlZHVjZSIsIm1lbW8iLCJtc2ciLCJNYXRoIiwibWF4IiwibGVuZ3RoIiwidGV4dCIsIm1hcCIsInMiLCJscnBhZCIsImpvaW4iLCJ0b3BMaW5lIiwicGFkIiwic2VwYXJhdG9yIiwiYm90dG9tTGluZSIsImNyZWF0ZUxvZ2dlciIsInByZWZpeCIsImNoZWNrIiwiU3RyaW5nIiwibGV2ZWwiLCJNYXRjaCIsIk9uZU9mIiwiaXNGdW5jdGlvbiIsInRhZyIsIkxvZyIsImZvckVhY2giLCJwYXJ0aWFsIiwiYWRkIiwibWlncmF0aW9uIiwiTWV0ZW9yIiwiRXJyb3IiLCJPYmplY3QiLCJmcmVlemUiLCJwdXNoIiwic29ydEJ5IiwibSIsIm1pZ3JhdGVUbyIsImNvbW1hbmQiLCJpc1VuZGVmaW5lZCIsInN1YmNvbW1hbmQiLCJhdHRlbXB0cyIsIm1pZ3JhdGVkIiwiX21pZ3JhdGVUbyIsImxhc3QiLCJwYXJzZUludCIsIndpbGxSZXRyeSIsIl9zbGVlcEZvck1zIiwiY29uc29sZSIsInllbGxvdyIsImNvbnRyb2wiLCJfZ2V0Q29udHJvbCIsIlJvY2tldENoYXQiLCJJbmZvIiwiY29tbWl0IiwiaGFzaCIsImRhdGUiLCJicmFuY2giLCJwcm9jZXNzIiwiZXhpdCIsImdldFZlcnNpb24iLCJyZXJ1biIsInNlbGYiLCJjdXJyZW50VmVyc2lvbiIsImxvY2siLCJpbmZvIiwibWlncmF0ZSIsIl9maW5kSW5kZXhCeVZlcnNpb24iLCJ1bmxvY2siLCJzdGFydElkeCIsImVuZElkeCIsImRpcmVjdGlvbiIsImlkeCIsIm1heWJlTmFtZSIsIm5hbWUiLCJtb2RlbHMiLCJfQ2FjaGVDb250cm9sIiwid2l0aFZhbHVlIiwiZSIsIkRhdGUiLCJkYXRlTWludXNJbnRlcnZhbCIsInN1YnRyYWN0IiwidG9EYXRlIiwiYnVpbGQiLCJ1cGRhdGUiLCJfaWQiLCIkb3IiLCJsb2NrZWQiLCJsb2NrZWRBdCIsIiRsdCIsImJ1aWxkQXQiLCIkbmUiLCIkc2V0IiwiX3NldENvbnRyb2wiLCJpIiwiZmluZE9uZSIsIk51bWJlciIsIkJvb2xlYW4iLCJ1cHNlcnQiLCJfcmVzZXQiLCJyZW1vdmUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUF3RCxJQUFJQyxNQUFKO0FBQVdMLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxRQUFSLENBQWIsRUFBK0I7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNDLFdBQU9ELENBQVA7QUFBUzs7QUFBckIsQ0FBL0IsRUFBc0QsQ0FBdEQ7QUFHekU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNEJBO0FBQ0EsSUFBSUUsbUJBQW1CO0FBQ3RCQyxVQUFTLENBRGE7QUFFdEJDLEtBQUksWUFBVyxDQUNkO0FBQ0E7QUFDQTtBQUxxQixDQUF2QjtBQVFBQyxhQUFhO0FBQ1pDLFFBQU8sQ0FBQ0osZ0JBQUQsQ0FESztBQUVaSyxVQUFTO0FBQ1I7QUFDQUMsT0FBSyxJQUZHO0FBR1I7QUFDQUMsVUFBUSxJQUpBO0FBS1I7QUFDQUMsZUFBYSxJQU5MO0FBT1I7QUFDQUMsa0JBQWdCLENBUlI7QUFTUjtBQUNBQyxpQkFBZSxFQVZQO0FBV1I7QUFDQUMsZUFBYSxFQVpMO0FBYVI7QUFDQUMsa0JBQWdCLFlBZFIsQ0FlUDs7QUFmTyxFQUZHO0FBbUJaQyxTQUFRLFVBQVNDLElBQVQsRUFBZTtBQUN0QixPQUFLVCxPQUFMLEdBQWVaLEVBQUVzQixNQUFGLENBQVMsRUFBVCxFQUFhLEtBQUtWLE9BQWxCLEVBQTJCUyxJQUEzQixDQUFmO0FBQ0E7QUFyQlcsQ0FBYjtBQXdCQVgsV0FBV2EsV0FBWCxHQUF5QixJQUFJQyxNQUFNQyxVQUFWLENBQXFCZixXQUFXRSxPQUFYLENBQW1CTyxjQUF4QyxDQUF6QixDLENBRUE7O0FBQ0EsU0FBU08sUUFBVCxDQUFrQkMsT0FBbEIsRUFBMkJDLFFBQVEsS0FBbkMsRUFBMEM7QUFDekMsS0FBSSxDQUFDNUIsRUFBRTZCLE9BQUYsQ0FBVUYsT0FBVixDQUFMLEVBQXlCO0FBQ3hCQSxZQUFVQSxRQUFRRyxLQUFSLENBQWMsSUFBZCxDQUFWO0FBQ0E7O0FBQ0QsS0FBSUMsTUFBTS9CLEVBQUUyQixPQUFGLEVBQVdLLE1BQVgsQ0FBa0IsVUFBU0MsSUFBVCxFQUFlQyxHQUFmLEVBQW9CO0FBQy9DLFNBQU9DLEtBQUtDLEdBQUwsQ0FBU0gsSUFBVCxFQUFlQyxJQUFJRyxNQUFuQixDQUFQO0FBQ0EsRUFGUyxFQUVQLENBRk8sSUFFRixDQUZSO0FBR0EsS0FBSUMsT0FBT1gsUUFBUVksR0FBUixDQUFhTCxHQUFELElBQVM7QUFDL0IsU0FBTyxJQUFLTixLQUFMLElBQWNZLEVBQUVDLEtBQUYsQ0FBUVAsR0FBUixFQUFhSCxHQUFiLEVBQWtCSCxLQUFsQixDQUFkLEdBQXlDLElBQUtBLEtBQUwsQ0FBaEQ7QUFDQSxFQUZVLEVBRVJjLElBRlEsQ0FFSCxJQUZHLENBQVg7QUFHQSxLQUFJQyxVQUFVLElBQUtmLEtBQUwsSUFBY1ksRUFBRUksR0FBRixDQUFNLEVBQU4sRUFBVWIsR0FBVixFQUFlLEdBQWYsRUFBb0JILEtBQXBCLENBQWQsR0FBMkMsSUFBS0EsS0FBTCxDQUF6RDtBQUNBLEtBQUlpQixZQUFZLElBQUtqQixLQUFMLElBQWNZLEVBQUVJLEdBQUYsQ0FBTSxFQUFOLEVBQVViLEdBQVYsRUFBZSxFQUFmLENBQWQsR0FBbUMsSUFBS0gsS0FBTCxDQUFuRDtBQUNBLEtBQUlrQixhQUFhLElBQUtsQixLQUFMLElBQWNZLEVBQUVJLEdBQUYsQ0FBTSxFQUFOLEVBQVViLEdBQVYsRUFBZSxHQUFmLEVBQW9CSCxLQUFwQixDQUFkLEdBQTJDLElBQUtBLEtBQUwsQ0FBNUQ7QUFDQSxRQUFRLEtBQUllLE9BQVEsS0FBSUUsU0FBVSxLQUFJUCxJQUFLLEtBQUlPLFNBQVUsS0FBSUMsVUFBVyxJQUF4RTtBQUNBLEMsQ0FFRDs7Ozs7Ozs7OztBQVNBLFNBQVNDLFlBQVQsQ0FBc0JDLE1BQXRCLEVBQThCO0FBQzdCQyxPQUFNRCxNQUFOLEVBQWNFLE1BQWQsRUFENkIsQ0FHN0I7O0FBQ0EsS0FBSXhDLFdBQVdFLE9BQVgsQ0FBbUJDLEdBQW5CLEtBQTJCLEtBQS9CLEVBQXNDO0FBQ3JDLFNBQU8sWUFBVyxDQUFFLENBQXBCO0FBQ0E7O0FBRUQsUUFBTyxVQUFTc0MsS0FBVCxFQUFnQnhCLE9BQWhCLEVBQXlCO0FBQy9Cc0IsUUFBTUUsS0FBTixFQUFhQyxNQUFNQyxLQUFOLENBQVksTUFBWixFQUFvQixPQUFwQixFQUE2QixNQUE3QixFQUFxQyxPQUFyQyxDQUFiO0FBQ0FKLFFBQU10QixPQUFOLEVBQWV5QixNQUFNQyxLQUFOLENBQVlILE1BQVosRUFBb0IsQ0FBQ0EsTUFBRCxDQUFwQixDQUFmO0FBRUEsTUFBSXBDLFNBQVNKLFdBQVdFLE9BQVgsSUFBc0JGLFdBQVdFLE9BQVgsQ0FBbUJFLE1BQXREOztBQUVBLE1BQUlBLFVBQVVkLEVBQUVzRCxVQUFGLENBQWF4QyxNQUFiLENBQWQsRUFBb0M7QUFFbkNBLFVBQU87QUFDTnFDLFdBQU9BLEtBREQ7QUFFTnhCLGFBQVNBLE9BRkg7QUFHTjRCLFNBQUtQO0FBSEMsSUFBUDtBQU1BLEdBUkQsTUFRTztBQUNOUSxPQUFJTCxLQUFKLEVBQVc7QUFDVnhCLGFBQVNxQixTQUFTLElBQVQsR0FBZ0JyQjtBQURmLElBQVg7QUFHQTtBQUNELEVBbkJEO0FBb0JBOztBQUVELElBQUlkLEdBQUo7QUFFQSxJQUFJRCxVQUFVRixXQUFXRSxPQUF6QixDLENBRUE7O0FBRUFDLE1BQU1rQyxhQUFhLFlBQWIsQ0FBTjtBQUVBLENBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsT0FBakIsRUFBMEIsT0FBMUIsRUFBbUNVLE9BQW5DLENBQTJDLFVBQVNOLEtBQVQsRUFBZ0I7QUFDMUR0QyxLQUFJc0MsS0FBSixJQUFhbkQsRUFBRTBELE9BQUYsQ0FBVTdDLEdBQVYsRUFBZXNDLEtBQWYsQ0FBYjtBQUNBLENBRkQsRSxDQUlBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBQ0F6QyxXQUFXaUQsR0FBWCxHQUFpQixVQUFTQyxTQUFULEVBQW9CO0FBQ3BDLEtBQUksT0FBT0EsVUFBVW5ELEVBQWpCLEtBQXdCLFVBQTVCLEVBQ0MsTUFBTSxJQUFJb0QsT0FBT0MsS0FBWCxDQUFpQix1Q0FBakIsQ0FBTjtBQUVELEtBQUksT0FBT0YsVUFBVXBELE9BQWpCLEtBQTZCLFFBQWpDLEVBQ0MsTUFBTSxJQUFJcUQsT0FBT0MsS0FBWCxDQUFpQix5Q0FBakIsQ0FBTjtBQUVELEtBQUlGLFVBQVVwRCxPQUFWLElBQXFCLENBQXpCLEVBQ0MsTUFBTSxJQUFJcUQsT0FBT0MsS0FBWCxDQUFpQiwwQ0FBakIsQ0FBTixDQVJtQyxDQVVwQzs7QUFDQUMsUUFBT0MsTUFBUCxDQUFjSixTQUFkOztBQUVBLE1BQUtqRCxLQUFMLENBQVdzRCxJQUFYLENBQWdCTCxTQUFoQjs7QUFDQSxNQUFLakQsS0FBTCxHQUFhWCxFQUFFa0UsTUFBRixDQUFTLEtBQUt2RCxLQUFkLEVBQXFCLFVBQVN3RCxDQUFULEVBQVk7QUFDN0MsU0FBT0EsRUFBRTNELE9BQVQ7QUFDQSxFQUZZLENBQWI7QUFHQSxDQWpCRCxDLENBbUJBO0FBQ0E7QUFDQTs7O0FBQ0FFLFdBQVcwRCxTQUFYLEdBQXVCLFVBQVNDLE9BQVQsRUFBa0I7QUFDeEMsS0FBSXJFLEVBQUVzRSxXQUFGLENBQWNELE9BQWQsS0FBMEJBLFlBQVksRUFBdEMsSUFBNEMsS0FBSzFELEtBQUwsQ0FBVzBCLE1BQVgsS0FBc0IsQ0FBdEUsRUFDQyxNQUFNLElBQUl5QixLQUFKLENBQVUsMkNBQTJDTyxPQUFyRCxDQUFOOztBQUVELEtBQUksT0FBT0EsT0FBUCxLQUFtQixRQUF2QixFQUFpQztBQUNoQyxNQUFJN0QsVUFBVTZELE9BQWQ7QUFDQSxFQUZELE1BRU87QUFDTixNQUFJN0QsVUFBVTZELFFBQVF2QyxLQUFSLENBQWMsR0FBZCxFQUFtQixDQUFuQixDQUFkO0FBQ0EsTUFBSXlDLGFBQWFGLFFBQVF2QyxLQUFSLENBQWMsR0FBZCxFQUFtQixDQUFuQixDQUFqQjtBQUNBOztBQUVELE9BQU1aLGNBQWNSLFdBQVdFLE9BQVgsQ0FBbUJNLFdBQXZDO0FBQ0EsT0FBTUQsZ0JBQWdCUCxXQUFXRSxPQUFYLENBQW1CSyxhQUF6Qzs7QUFDQSxNQUFLLElBQUl1RCxXQUFXLENBQXBCLEVBQXVCQSxZQUFZdEQsV0FBbkMsRUFBZ0RzRCxVQUFoRCxFQUE0RDtBQUMzRCxNQUFJaEUsWUFBWSxRQUFoQixFQUEwQjtBQUN6QmlFLGNBQVcsS0FBS0MsVUFBTCxDQUFnQjFFLEVBQUUyRSxJQUFGLENBQU8sS0FBS2hFLEtBQVosRUFBbUJILE9BQW5DLENBQVg7QUFDQSxHQUZELE1BRU87QUFDTmlFLGNBQVcsS0FBS0MsVUFBTCxDQUFnQkUsU0FBU3BFLE9BQVQsQ0FBaEIsRUFBb0MrRCxlQUFlLE9BQW5ELENBQVg7QUFDQTs7QUFDRCxNQUFJRSxRQUFKLEVBQWM7QUFDYjtBQUNBLEdBRkQsTUFFTztBQUNOLE9BQUlJLFNBQUo7O0FBQ0EsT0FBSUwsV0FBV3RELFdBQWYsRUFBNEI7QUFDM0IyRCxnQkFBYSxvQkFBbUI1RCxhQUFjLFdBQTlDOztBQUNBNEMsV0FBT2lCLFdBQVAsQ0FBbUI3RCxnQkFBZ0IsSUFBbkM7QUFDQSxJQUhELE1BR087QUFDTjRELGdCQUFZLEVBQVo7QUFDQTs7QUFDREUsV0FBUWxFLEdBQVIsQ0FBYSw2Q0FBNEMyRCxRQUFTLElBQUd0RCxXQUFZLElBQUcyRCxTQUFVLEVBQWxGLENBQW9GRyxNQUFoRztBQUNBO0FBQ0Q7O0FBQ0QsS0FBSSxDQUFDUCxRQUFMLEVBQWU7QUFDZCxNQUFJUSxVQUFVLEtBQUtDLFdBQUwsRUFBZCxDQURjLENBQ29COzs7QUFDbENILFVBQVFsRSxHQUFSLENBQVlhLFNBQVMsQ0FDcEIsdUJBRG9CLEVBRXBCLEVBRm9CLEVBR3BCLDRDQUhvQixFQUlwQixvRUFKb0IsRUFLcEIsa0RBTG9CLEVBTXBCLEVBTm9CLEVBT3BCLCtCQUErQnlELFdBQVdDLElBQVgsQ0FBZ0I1RSxPQVAzQixFQVFwQixpQ0FBaUN5RSxRQUFRekUsT0FSckIsRUFTcEIsK0JBQStCQSxZQUFZLFFBQVosR0FBdUJSLEVBQUUyRSxJQUFGLENBQU8sS0FBS2hFLEtBQVosRUFBbUJILE9BQTFDLEdBQW9EQSxPQUFuRixDQVRvQixFQVVwQixFQVZvQixFQVdwQixhQUFhMkUsV0FBV0MsSUFBWCxDQUFnQkMsTUFBaEIsQ0FBdUJDLElBWGhCLEVBWXBCLFdBQVdILFdBQVdDLElBQVgsQ0FBZ0JDLE1BQWhCLENBQXVCRSxJQVpkLEVBYXBCLGFBQWFKLFdBQVdDLElBQVgsQ0FBZ0JDLE1BQWhCLENBQXVCRyxNQWJoQixFQWNwQixVQUFVTCxXQUFXQyxJQUFYLENBQWdCQyxNQUFoQixDQUF1QjlCLEdBZGIsQ0FBVCxDQUFaO0FBZ0JBa0MsVUFBUUMsSUFBUixDQUFhLENBQWI7QUFDQSxFQW5EdUMsQ0FxRHhDOzs7QUFDQSxLQUFJbkIsZUFBZSxNQUFuQixFQUNDa0IsUUFBUUMsSUFBUixDQUFhLENBQWI7QUFDRCxDQXhERCxDLENBMERBOzs7QUFDQWhGLFdBQVdpRixVQUFYLEdBQXdCLFlBQVc7QUFDbEMsUUFBTyxLQUFLVCxXQUFMLEdBQW1CMUUsT0FBMUI7QUFDQSxDQUZELEMsQ0FJQTs7O0FBQ0FFLFdBQVdnRSxVQUFYLEdBQXdCLFVBQVNsRSxPQUFULEVBQWtCb0YsS0FBbEIsRUFBeUI7QUFDaEQsS0FBSUMsT0FBTyxJQUFYOztBQUNBLEtBQUlaLFVBQVUsS0FBS0MsV0FBTCxFQUFkLENBRmdELENBRWQ7OztBQUNsQyxLQUFJWSxpQkFBaUJiLFFBQVF6RSxPQUE3Qjs7QUFFQSxLQUFJdUYsV0FBVyxLQUFmLEVBQXNCO0FBQ3JCO0FBQ0E7QUFDQSxTQUFPLEtBQVA7QUFDQTs7QUFFRCxLQUFJSCxLQUFKLEVBQVc7QUFDVi9FLE1BQUltRixJQUFKLENBQVMsdUJBQXVCeEYsT0FBaEM7QUFDQXlGLFVBQVEsSUFBUixFQUFjLEtBQUtDLG1CQUFMLENBQXlCMUYsT0FBekIsQ0FBZDtBQUNBSyxNQUFJbUYsSUFBSixDQUFTLHFCQUFUO0FBQ0FHO0FBQ0EsU0FBTyxJQUFQO0FBQ0E7O0FBRUQsS0FBSUwsbUJBQW1CdEYsT0FBdkIsRUFBZ0M7QUFDL0IsTUFBSSxLQUFLSSxPQUFMLENBQWFHLFdBQWpCLEVBQThCO0FBQzdCRixPQUFJbUYsSUFBSixDQUFTLHVDQUF1Q3hGLE9BQWhEO0FBQ0E7O0FBQ0QyRjtBQUNBLFNBQU8sSUFBUDtBQUNBOztBQUVELEtBQUlDLFdBQVcsS0FBS0YsbUJBQUwsQ0FBeUJKLGNBQXpCLENBQWY7O0FBQ0EsS0FBSU8sU0FBUyxLQUFLSCxtQkFBTCxDQUF5QjFGLE9BQXpCLENBQWIsQ0E1QmdELENBOEJoRDs7O0FBQ0FLLEtBQUltRixJQUFKLENBQVMsNEJBQTRCLEtBQUtyRixLQUFMLENBQVd5RixRQUFYLEVBQXFCNUYsT0FBakQsR0FBMkQsTUFBM0QsR0FBb0UsS0FBS0csS0FBTCxDQUFXMEYsTUFBWCxFQUFtQjdGLE9BQWhHLEVBL0JnRCxDQWlDaEQ7O0FBQ0EsVUFBU3lGLE9BQVQsQ0FBaUJLLFNBQWpCLEVBQTRCQyxHQUE1QixFQUFpQztBQUNoQyxNQUFJM0MsWUFBWWlDLEtBQUtsRixLQUFMLENBQVc0RixHQUFYLENBQWhCOztBQUVBLE1BQUksT0FBTzNDLFVBQVUwQyxTQUFWLENBQVAsS0FBZ0MsVUFBcEMsRUFBZ0Q7QUFDL0NIO0FBQ0EsU0FBTSxJQUFJdEMsT0FBT0MsS0FBWCxDQUFpQixvQkFBb0J3QyxTQUFwQixHQUFnQyxjQUFoQyxHQUFpRDFDLFVBQVVwRCxPQUE1RSxDQUFOO0FBQ0E7O0FBRUQsV0FBU2dHLFNBQVQsR0FBcUI7QUFDcEIsVUFBTzVDLFVBQVU2QyxJQUFWLEdBQWlCLE9BQU83QyxVQUFVNkMsSUFBakIsR0FBd0IsR0FBekMsR0FBK0MsRUFBdEQ7QUFDQTs7QUFFRDVGLE1BQUltRixJQUFKLENBQVMsYUFBYU0sU0FBYixHQUF5QixnQkFBekIsR0FBNEMxQyxVQUFVcEQsT0FBdEQsR0FBZ0VnRyxXQUF6RTs7QUFFQSxNQUFJO0FBQ0hyQixjQUFXdUIsTUFBWCxDQUFrQkMsYUFBbEIsQ0FBZ0NDLFNBQWhDLENBQTBDLEtBQTFDLEVBQWlELFlBQVc7QUFDM0RoRCxjQUFVMEMsU0FBVixFQUFxQjFDLFNBQXJCO0FBQ0EsSUFGRDtBQUdBLEdBSkQsQ0FJRSxPQUFPaUQsQ0FBUCxFQUFVO0FBQ1g5QixXQUFRbEUsR0FBUixDQUFZYSxTQUFTLENBQ3BCLHVCQURvQixFQUVwQixFQUZvQixFQUdwQixpQ0FIb0IsRUFJcEJtRixFQUFFbEYsT0FKa0IsRUFLcEIsRUFMb0IsRUFNcEIsb0VBTm9CLEVBT3BCLGtEQVBvQixFQVFwQixFQVJvQixFQVNwQiwrQkFBK0J3RCxXQUFXQyxJQUFYLENBQWdCNUUsT0FUM0IsRUFVcEIsaUNBQWlDeUUsUUFBUXpFLE9BVnJCLEVBV3BCLDhCQUE4QkEsT0FYVixFQVlwQixFQVpvQixFQWFwQixhQUFhMkUsV0FBV0MsSUFBWCxDQUFnQkMsTUFBaEIsQ0FBdUJDLElBYmhCLEVBY3BCLFdBQVdILFdBQVdDLElBQVgsQ0FBZ0JDLE1BQWhCLENBQXVCRSxJQWRkLEVBZXBCLGFBQWFKLFdBQVdDLElBQVgsQ0FBZ0JDLE1BQWhCLENBQXVCRyxNQWZoQixFQWdCcEIsVUFBVUwsV0FBV0MsSUFBWCxDQUFnQkMsTUFBaEIsQ0FBdUI5QixHQWhCYixDQUFULENBQVo7QUFrQkFrQyxXQUFRQyxJQUFSLENBQWEsQ0FBYjtBQUNBO0FBQ0QsRUF6RStDLENBMkVoRDs7O0FBQ0EsVUFBU0ssSUFBVCxHQUFnQjtBQUNmLFFBQU1SLE9BQU8sSUFBSXVCLElBQUosRUFBYjtBQUNBLFFBQU1DLG9CQUFvQnpHLE9BQU9pRixJQUFQLEVBQWF5QixRQUFiLENBQXNCbkIsS0FBS2pGLE9BQUwsQ0FBYUksY0FBbkMsRUFBbUQsU0FBbkQsRUFBOERpRyxNQUE5RCxFQUExQjtBQUNBLFFBQU1DLFFBQVEvQixXQUFXQyxJQUFYLEdBQWtCRCxXQUFXQyxJQUFYLENBQWdCOEIsS0FBaEIsQ0FBc0IzQixJQUF4QyxHQUErQ0EsSUFBN0QsQ0FIZSxDQUtmO0FBQ0E7QUFDQTs7QUFDQSxTQUFPTSxLQUFLdEUsV0FBTCxDQUFpQjRGLE1BQWpCLENBQXdCO0FBQzlCQyxRQUFLLFNBRHlCO0FBRTlCQyxRQUFLLENBQUM7QUFDTEMsWUFBUTtBQURILElBQUQsRUFFRjtBQUNGQyxjQUFVO0FBQ1RDLFVBQUtUO0FBREk7QUFEUixJQUZFLEVBTUY7QUFDRlUsYUFBUztBQUNSQyxVQUFLUjtBQURHO0FBRFAsSUFORTtBQUZ5QixHQUF4QixFQWFKO0FBQ0ZTLFNBQU07QUFDTEwsWUFBUSxJQURIO0FBRUxDLGNBQVVoQyxJQUZMO0FBR0xrQyxhQUFTUDtBQUhKO0FBREosR0FiSSxNQW1CQSxDQW5CUDtBQW9CQSxFQXhHK0MsQ0EyR2hEOzs7QUFDQSxVQUFTZixNQUFULEdBQWtCO0FBQ2pCTixPQUFLK0IsV0FBTCxDQUFpQjtBQUNoQk4sV0FBUSxLQURRO0FBRWhCOUcsWUFBU3NGO0FBRk8sR0FBakI7QUFJQTs7QUFFRCxLQUFJQSxpQkFBaUJ0RixPQUFyQixFQUE4QjtBQUM3QixPQUFLLElBQUlxSCxJQUFJekIsUUFBYixFQUF1QnlCLElBQUl4QixNQUEzQixFQUFtQ3dCLEdBQW5DLEVBQXdDO0FBQ3ZDNUIsV0FBUSxJQUFSLEVBQWM0QixJQUFJLENBQWxCO0FBQ0EvQixvQkFBaUJELEtBQUtsRixLQUFMLENBQVdrSCxJQUFJLENBQWYsRUFBa0JySCxPQUFuQzs7QUFDQXFGLFFBQUsrQixXQUFMLENBQWlCO0FBQ2hCTixZQUFRLElBRFE7QUFFaEI5RyxhQUFTc0Y7QUFGTyxJQUFqQjtBQUlBO0FBQ0QsRUFURCxNQVNPO0FBQ04sT0FBSyxJQUFJK0IsSUFBSXpCLFFBQWIsRUFBdUJ5QixJQUFJeEIsTUFBM0IsRUFBbUN3QixHQUFuQyxFQUF3QztBQUN2QzVCLFdBQVEsTUFBUixFQUFnQjRCLENBQWhCO0FBQ0EvQixvQkFBaUJELEtBQUtsRixLQUFMLENBQVdrSCxJQUFJLENBQWYsRUFBa0JySCxPQUFuQzs7QUFDQXFGLFFBQUsrQixXQUFMLENBQWlCO0FBQ2hCTixZQUFRLElBRFE7QUFFaEI5RyxhQUFTc0Y7QUFGTyxJQUFqQjtBQUlBO0FBQ0Q7O0FBRURLO0FBQ0F0RixLQUFJbUYsSUFBSixDQUFTLHFCQUFUO0FBQ0EsQ0F6SUQsQyxDQTJJQTs7O0FBQ0F0RixXQUFXd0UsV0FBWCxHQUF5QixZQUFXO0FBQ25DLEtBQUlELFVBQVUsS0FBSzFELFdBQUwsQ0FBaUJ1RyxPQUFqQixDQUF5QjtBQUN0Q1YsT0FBSztBQURpQyxFQUF6QixDQUFkOztBQUlBLFFBQU9uQyxXQUFXLEtBQUsyQyxXQUFMLENBQWlCO0FBQ2xDcEgsV0FBUyxDQUR5QjtBQUVsQzhHLFVBQVE7QUFGMEIsRUFBakIsQ0FBbEI7QUFJQSxDQVRELEMsQ0FXQTs7O0FBQ0E1RyxXQUFXa0gsV0FBWCxHQUF5QixVQUFTM0MsT0FBVCxFQUFrQjtBQUMxQztBQUNBaEMsT0FBTWdDLFFBQVF6RSxPQUFkLEVBQXVCdUgsTUFBdkI7QUFDQTlFLE9BQU1nQyxRQUFRcUMsTUFBZCxFQUFzQlUsT0FBdEI7O0FBRUEsTUFBS3pHLFdBQUwsQ0FBaUI0RixNQUFqQixDQUF3QjtBQUN2QkMsT0FBSztBQURrQixFQUF4QixFQUVHO0FBQ0ZPLFFBQU07QUFDTG5ILFlBQVN5RSxRQUFRekUsT0FEWjtBQUVMOEcsV0FBUXJDLFFBQVFxQztBQUZYO0FBREosRUFGSCxFQU9HO0FBQ0ZXLFVBQVE7QUFETixFQVBIOztBQVdBLFFBQU9oRCxPQUFQO0FBQ0EsQ0FqQkQsQyxDQW1CQTs7O0FBQ0F2RSxXQUFXd0YsbUJBQVgsR0FBaUMsVUFBUzFGLE9BQVQsRUFBa0I7QUFDbEQsTUFBSyxJQUFJcUgsSUFBSSxDQUFiLEVBQWdCQSxJQUFJLEtBQUtsSCxLQUFMLENBQVcwQixNQUEvQixFQUF1Q3dGLEdBQXZDLEVBQTRDO0FBQzNDLE1BQUksS0FBS2xILEtBQUwsQ0FBV2tILENBQVgsRUFBY3JILE9BQWQsS0FBMEJBLE9BQTlCLEVBQ0MsT0FBT3FILENBQVA7QUFDRDs7QUFFRCxPQUFNLElBQUloRSxPQUFPQyxLQUFYLENBQWlCLG1DQUFtQ3RELE9BQXBELENBQU47QUFDQSxDQVBELEMsQ0FTQTs7O0FBQ0FFLFdBQVd3SCxNQUFYLEdBQW9CLFlBQVc7QUFDOUIsTUFBS3ZILEtBQUwsR0FBYSxDQUFDO0FBQ2JILFdBQVMsQ0FESTtBQUViQyxNQUFJLFlBQVcsQ0FBRTtBQUZKLEVBQUQsQ0FBYjs7QUFJQSxNQUFLYyxXQUFMLENBQWlCNEcsTUFBakIsQ0FBd0IsRUFBeEI7QUFDQSxDQU5EOztBQVFBaEQsV0FBV3pFLFVBQVgsR0FBd0JBLFVBQXhCLEMiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfbWlncmF0aW9ucy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmltcG9ydCBtb21lbnQgZnJvbSAnbW9tZW50Jztcbi8qXG5cdEFkZHMgbWlncmF0aW9uIGNhcGFiaWxpdGllcy4gTWlncmF0aW9ucyBhcmUgZGVmaW5lZCBsaWtlOlxuXG5cdE1pZ3JhdGlvbnMuYWRkKHtcblx0XHR1cDogZnVuY3Rpb24oKSB7fSwgLy8qcmVxdWlyZWQqIGNvZGUgdG8gcnVuIHRvIG1pZ3JhdGUgdXB3YXJkc1xuXHRcdHZlcnNpb246IDEsIC8vKnJlcXVpcmVkKiBudW1iZXIgdG8gaWRlbnRpZnkgbWlncmF0aW9uIG9yZGVyXG5cdFx0ZG93bjogZnVuY3Rpb24oKSB7fSwgLy8qb3B0aW9uYWwqIGNvZGUgdG8gcnVuIHRvIG1pZ3JhdGUgZG93bndhcmRzXG5cdFx0bmFtZTogJ1NvbWV0aGluZycgLy8qb3B0aW9uYWwqIGRpc3BsYXkgbmFtZSBmb3IgdGhlIG1pZ3JhdGlvblxuXHR9KTtcblxuXHRUaGUgb3JkZXJpbmcgb2YgbWlncmF0aW9ucyBpcyBkZXRlcm1pbmVkIGJ5IHRoZSB2ZXJzaW9uIHlvdSBzZXQuXG5cblx0VG8gcnVuIHRoZSBtaWdyYXRpb25zLCBzZXQgdGhlIE1JR1JBVEUgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gZWl0aGVyXG5cdCdsYXRlc3QnIG9yIHRoZSB2ZXJzaW9uIG51bWJlciB5b3Ugd2FudCB0byBtaWdyYXRlIHRvLiBPcHRpb25hbGx5LCBhcHBlbmRcblx0JyxleGl0JyBpZiB5b3Ugd2FudCB0aGUgbWlncmF0aW9ucyB0byBleGl0IHRoZSBtZXRlb3IgcHJvY2VzcywgZS5nIGlmIHlvdSdyZVxuXHRtaWdyYXRpbmcgZnJvbSBhIHNjcmlwdCAocmVtZW1iZXIgdG8gcGFzcyB0aGUgLS1vbmNlIHBhcmFtZXRlcikuXG5cblx0ZS5nOlxuXHRNSUdSQVRFPVwibGF0ZXN0XCIgbXJ0ICMgZW5zdXJlIHdlJ2xsIGJlIGF0IHRoZSBsYXRlc3QgdmVyc2lvbiBhbmQgcnVuIHRoZSBhcHBcblx0TUlHUkFURT1cImxhdGVzdCxleGl0XCIgbXJ0IC0tb25jZSAjIGVuc3VyZSB3ZSdsbCBiZSBhdCB0aGUgbGF0ZXN0IHZlcnNpb24gYW5kIGV4aXRcblx0TUlHUkFURT1cIjIsZXhpdFwiIG1ydCAtLW9uY2UgIyBtaWdyYXRlIHRvIHZlcnNpb24gMiBhbmQgZXhpdFxuXG5cdE5vdGU6IE1pZ3JhdGlvbnMgd2lsbCBsb2NrIGVuc3VyaW5nIG9ubHkgMSBhcHAgY2FuIGJlIG1pZ3JhdGluZyBhdCBvbmNlLiBJZlxuXHRhIG1pZ3JhdGlvbiBjcmFzaGVzLCB0aGUgY29udHJvbCByZWNvcmQgaW4gdGhlIG1pZ3JhdGlvbnMgY29sbGVjdGlvbiB3aWxsXG5cdHJlbWFpbiBsb2NrZWQgYW5kIGF0IHRoZSB2ZXJzaW9uIGl0IHdhcyBhdCBwcmV2aW91c2x5LCBob3dldmVyIHRoZSBkYiBjb3VsZFxuXHRiZSBpbiBhbiBpbmNvbnNpc3RhbnQgc3RhdGUuXG4qL1xuXG4vLyBzaW5jZSB3ZSdsbCBiZSBhdCB2ZXJzaW9uIDAgYnkgZGVmYXVsdCwgd2Ugc2hvdWxkIGhhdmUgYSBtaWdyYXRpb24gc2V0IGZvciBpdC5cbnZhciBEZWZhdWx0TWlncmF0aW9uID0ge1xuXHR2ZXJzaW9uOiAwLFxuXHR1cDogZnVuY3Rpb24oKSB7XG5cdFx0Ly8gQFRPRE86IGNoZWNrIGlmIGNvbGxlY3Rpb24gXCJtaWdyYXRpb25zXCIgZXhpc3Rcblx0XHQvLyBJZiBleGlzdHMsIHJlbmFtZSBhbmQgcmVydW4gX21pZ3JhdGVUb1xuXHR9XG59O1xuXG5NaWdyYXRpb25zID0ge1xuXHRfbGlzdDogW0RlZmF1bHRNaWdyYXRpb25dLFxuXHRvcHRpb25zOiB7XG5cdFx0Ly8gZmFsc2UgZGlzYWJsZXMgbG9nZ2luZ1xuXHRcdGxvZzogdHJ1ZSxcblx0XHQvLyBudWxsIG9yIGEgZnVuY3Rpb25cblx0XHRsb2dnZXI6IG51bGwsXG5cdFx0Ly8gZW5hYmxlL2Rpc2FibGUgaW5mbyBsb2cgXCJhbHJlYWR5IGF0IGxhdGVzdC5cIlxuXHRcdGxvZ0lmTGF0ZXN0OiB0cnVlLFxuXHRcdC8vIGxvY2sgd2lsbCBiZSB2YWxpZCBmb3IgdGhpcyBhbW91bnQgb2YgbWludXRlc1xuXHRcdGxvY2tFeHBpcmF0aW9uOiA1LFxuXHRcdC8vIHJldHJ5IGludGVydmFsIGluIHNlY29uZHNcblx0XHRyZXRyeUludGVydmFsOiAxMCxcblx0XHQvLyBtYXggbnVtYmVyIG9mIGF0dGVtcHRzIHRvIHJldHJ5IHVubG9ja1xuXHRcdG1heEF0dGVtcHRzOiAzMCxcblx0XHQvLyBtaWdyYXRpb25zIGNvbGxlY3Rpb24gbmFtZVxuXHRcdGNvbGxlY3Rpb25OYW1lOiBcIm1pZ3JhdGlvbnNcIlxuXHRcdFx0Ly8gY29sbGVjdGlvbk5hbWU6IFwicm9ja2V0Y2hhdF9taWdyYXRpb25zXCJcblx0fSxcblx0Y29uZmlnOiBmdW5jdGlvbihvcHRzKSB7XG5cdFx0dGhpcy5vcHRpb25zID0gXy5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgb3B0cyk7XG5cdH0sXG59XG5cbk1pZ3JhdGlvbnMuX2NvbGxlY3Rpb24gPSBuZXcgTW9uZ28uQ29sbGVjdGlvbihNaWdyYXRpb25zLm9wdGlvbnMuY29sbGVjdGlvbk5hbWUpO1xuXG4vKiBDcmVhdGUgYSBib3ggYXJvdW5kIG1lc3NhZ2VzIGZvciBkaXNwbGF5aW5nIG9uIGEgY29uc29sZS5sb2cgKi9cbmZ1bmN0aW9uIG1ha2VBQm94KG1lc3NhZ2UsIGNvbG9yID0gJ3JlZCcpIHtcblx0aWYgKCFfLmlzQXJyYXkobWVzc2FnZSkpIHtcblx0XHRtZXNzYWdlID0gbWVzc2FnZS5zcGxpdChcIlxcblwiKTtcblx0fVxuXHRsZXQgbGVuID0gXyhtZXNzYWdlKS5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbXNnKSB7XG5cdFx0cmV0dXJuIE1hdGgubWF4KG1lbW8sIG1zZy5sZW5ndGgpXG5cdH0sIDApICsgNDtcblx0bGV0IHRleHQgPSBtZXNzYWdlLm1hcCgobXNnKSA9PiB7XG5cdFx0cmV0dXJuIFwifFwiIFtjb2xvcl0gKyBzLmxycGFkKG1zZywgbGVuKVtjb2xvcl0gKyBcInxcIiBbY29sb3JdXG5cdH0pLmpvaW4oXCJcXG5cIik7XG5cdGxldCB0b3BMaW5lID0gXCIrXCIgW2NvbG9yXSArIHMucGFkKCcnLCBsZW4sICctJylbY29sb3JdICsgXCIrXCIgW2NvbG9yXTtcblx0bGV0IHNlcGFyYXRvciA9IFwifFwiIFtjb2xvcl0gKyBzLnBhZCgnJywgbGVuLCAnJykgKyBcInxcIiBbY29sb3JdO1xuXHRsZXQgYm90dG9tTGluZSA9IFwiK1wiIFtjb2xvcl0gKyBzLnBhZCgnJywgbGVuLCAnLScpW2NvbG9yXSArIFwiK1wiIFtjb2xvcl07XG5cdHJldHVybiBgXFxuJHt0b3BMaW5lfVxcbiR7c2VwYXJhdG9yfVxcbiR7dGV4dH1cXG4ke3NlcGFyYXRvcn1cXG4ke2JvdHRvbUxpbmV9XFxuYDtcbn1cblxuLypcblx0TG9nZ2VyIGZhY3RvcnkgZnVuY3Rpb24uIFRha2VzIGEgcHJlZml4IHN0cmluZyBhbmQgb3B0aW9ucyBvYmplY3Rcblx0YW5kIHVzZXMgYW4gaW5qZWN0ZWQgYGxvZ2dlcmAgaWYgcHJvdmlkZWQsIGVsc2UgZmFsbHMgYmFjayB0b1xuXHRNZXRlb3IncyBgTG9nYCBwYWNrYWdlLlxuXHRXaWxsIHNlbmQgYSBsb2cgb2JqZWN0IHRvIHRoZSBpbmplY3RlZCBsb2dnZXIsIG9uIHRoZSBmb2xsb3dpbmcgZm9ybTpcblx0XHRtZXNzYWdlOiBTdHJpbmdcblx0XHRsZXZlbDogU3RyaW5nIChpbmZvLCB3YXJuLCBlcnJvciwgZGVidWcpXG5cdFx0dGFnOiAnTWlncmF0aW9ucydcbiovXG5mdW5jdGlvbiBjcmVhdGVMb2dnZXIocHJlZml4KSB7XG5cdGNoZWNrKHByZWZpeCwgU3RyaW5nKTtcblxuXHQvLyBSZXR1cm4gbm9vcCBpZiBsb2dnaW5nIGlzIGRpc2FibGVkLlxuXHRpZiAoTWlncmF0aW9ucy5vcHRpb25zLmxvZyA9PT0gZmFsc2UpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7fTtcblx0fVxuXG5cdHJldHVybiBmdW5jdGlvbihsZXZlbCwgbWVzc2FnZSkge1xuXHRcdGNoZWNrKGxldmVsLCBNYXRjaC5PbmVPZignaW5mbycsICdlcnJvcicsICd3YXJuJywgJ2RlYnVnJykpO1xuXHRcdGNoZWNrKG1lc3NhZ2UsIE1hdGNoLk9uZU9mKFN0cmluZywgW1N0cmluZ10pKTtcblxuXHRcdHZhciBsb2dnZXIgPSBNaWdyYXRpb25zLm9wdGlvbnMgJiYgTWlncmF0aW9ucy5vcHRpb25zLmxvZ2dlcjtcblxuXHRcdGlmIChsb2dnZXIgJiYgXy5pc0Z1bmN0aW9uKGxvZ2dlcikpIHtcblxuXHRcdFx0bG9nZ2VyKHtcblx0XHRcdFx0bGV2ZWw6IGxldmVsLFxuXHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlLFxuXHRcdFx0XHR0YWc6IHByZWZpeFxuXHRcdFx0fSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0TG9nW2xldmVsXSh7XG5cdFx0XHRcdG1lc3NhZ2U6IHByZWZpeCArICc6ICcgKyBtZXNzYWdlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxudmFyIGxvZztcblxudmFyIG9wdGlvbnMgPSBNaWdyYXRpb25zLm9wdGlvbnM7XG5cbi8vIGNvbGxlY3Rpb24gaG9sZGluZyB0aGUgY29udHJvbCByZWNvcmRcblxubG9nID0gY3JlYXRlTG9nZ2VyKCdNaWdyYXRpb25zJyk7XG5cblsnaW5mbycsICd3YXJuJywgJ2Vycm9yJywgJ2RlYnVnJ10uZm9yRWFjaChmdW5jdGlvbihsZXZlbCkge1xuXHRsb2dbbGV2ZWxdID0gXy5wYXJ0aWFsKGxvZywgbGV2ZWwpO1xufSk7XG5cbi8vIGlmIChwcm9jZXNzLmVudi5NSUdSQVRFKVxuLy8gICBNaWdyYXRpb25zLm1pZ3JhdGVUbyhwcm9jZXNzLmVudi5NSUdSQVRFKTtcblxuLy8gQWRkIGEgbmV3IG1pZ3JhdGlvbjpcbi8vIHt1cDogZnVuY3Rpb24gKnJlcXVpcmVkXG4vLyAgdmVyc2lvbjogTnVtYmVyICpyZXF1aXJlZFxuLy8gIGRvd246IGZ1bmN0aW9uICpvcHRpb25hbFxuLy8gIG5hbWU6IFN0cmluZyAqb3B0aW9uYWxcbi8vIH1cbk1pZ3JhdGlvbnMuYWRkID0gZnVuY3Rpb24obWlncmF0aW9uKSB7XG5cdGlmICh0eXBlb2YgbWlncmF0aW9uLnVwICE9PSAnZnVuY3Rpb24nKVxuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ01pZ3JhdGlvbiBtdXN0IHN1cHBseSBhbiB1cCBmdW5jdGlvbi4nKTtcblxuXHRpZiAodHlwZW9mIG1pZ3JhdGlvbi52ZXJzaW9uICE9PSAnbnVtYmVyJylcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdNaWdyYXRpb24gbXVzdCBzdXBwbHkgYSB2ZXJzaW9uIG51bWJlci4nKTtcblxuXHRpZiAobWlncmF0aW9uLnZlcnNpb24gPD0gMClcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdNaWdyYXRpb24gdmVyc2lvbiBtdXN0IGJlIGdyZWF0ZXIgdGhhbiAwJyk7XG5cblx0Ly8gRnJlZXplIHRoZSBtaWdyYXRpb24gb2JqZWN0IHRvIG1ha2UgaXQgaGVyZWFmdGVyIGltbXV0YWJsZVxuXHRPYmplY3QuZnJlZXplKG1pZ3JhdGlvbik7XG5cblx0dGhpcy5fbGlzdC5wdXNoKG1pZ3JhdGlvbik7XG5cdHRoaXMuX2xpc3QgPSBfLnNvcnRCeSh0aGlzLl9saXN0LCBmdW5jdGlvbihtKSB7XG5cdFx0cmV0dXJuIG0udmVyc2lvbjtcblx0fSk7XG59XG5cbi8vIEF0dGVtcHRzIHRvIHJ1biB0aGUgbWlncmF0aW9ucyB1c2luZyBjb21tYW5kIGluIHRoZSBmb3JtIG9mOlxuLy8gZS5nICdsYXRlc3QnLCAnbGF0ZXN0LGV4aXQnLCAyXG4vLyB1c2UgJ1hYLHJlcnVuJyB0byByZS1ydW4gdGhlIG1pZ3JhdGlvbiBhdCB0aGF0IHZlcnNpb25cbk1pZ3JhdGlvbnMubWlncmF0ZVRvID0gZnVuY3Rpb24oY29tbWFuZCkge1xuXHRpZiAoXy5pc1VuZGVmaW5lZChjb21tYW5kKSB8fCBjb21tYW5kID09PSAnJyB8fCB0aGlzLl9saXN0Lmxlbmd0aCA9PT0gMClcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgbWlncmF0ZSB1c2luZyBpbnZhbGlkIGNvbW1hbmQ6IFwiICsgY29tbWFuZCk7XG5cblx0aWYgKHR5cGVvZiBjb21tYW5kID09PSAnbnVtYmVyJykge1xuXHRcdHZhciB2ZXJzaW9uID0gY29tbWFuZDtcblx0fSBlbHNlIHtcblx0XHR2YXIgdmVyc2lvbiA9IGNvbW1hbmQuc3BsaXQoJywnKVswXTtcblx0XHR2YXIgc3ViY29tbWFuZCA9IGNvbW1hbmQuc3BsaXQoJywnKVsxXTtcblx0fVxuXG5cdGNvbnN0IG1heEF0dGVtcHRzID0gTWlncmF0aW9ucy5vcHRpb25zLm1heEF0dGVtcHRzO1xuXHRjb25zdCByZXRyeUludGVydmFsID0gTWlncmF0aW9ucy5vcHRpb25zLnJldHJ5SW50ZXJ2YWw7XG5cdGZvciAobGV0IGF0dGVtcHRzID0gMTsgYXR0ZW1wdHMgPD0gbWF4QXR0ZW1wdHM7IGF0dGVtcHRzKyspIHtcblx0XHRpZiAodmVyc2lvbiA9PT0gJ2xhdGVzdCcpIHtcblx0XHRcdG1pZ3JhdGVkID0gdGhpcy5fbWlncmF0ZVRvKF8ubGFzdCh0aGlzLl9saXN0KS52ZXJzaW9uKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWlncmF0ZWQgPSB0aGlzLl9taWdyYXRlVG8ocGFyc2VJbnQodmVyc2lvbiksIChzdWJjb21tYW5kID09PSAncmVydW4nKSk7XG5cdFx0fVxuXHRcdGlmIChtaWdyYXRlZCkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxldCB3aWxsUmV0cnk7XG5cdFx0XHRpZiAoYXR0ZW1wdHMgPCBtYXhBdHRlbXB0cykge1xuXHRcdFx0XHR3aWxsUmV0cnkgPSBgIFRyeWluZyBhZ2FpbiBpbiAke3JldHJ5SW50ZXJ2YWx9IHNlY29uZHMuYDtcblx0XHRcdFx0TWV0ZW9yLl9zbGVlcEZvck1zKHJldHJ5SW50ZXJ2YWwgKiAxMDAwKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdpbGxSZXRyeSA9IFwiXCI7XG5cdFx0XHR9XG5cdFx0XHRjb25zb2xlLmxvZyhgTm90IG1pZ3JhdGluZywgY29udHJvbCBpcyBsb2NrZWQuIEF0dGVtcHQgJHthdHRlbXB0c30vJHttYXhBdHRlbXB0c30uJHt3aWxsUmV0cnl9YC55ZWxsb3cpO1xuXHRcdH1cblx0fVxuXHRpZiAoIW1pZ3JhdGVkKSB7XG5cdFx0bGV0IGNvbnRyb2wgPSB0aGlzLl9nZXRDb250cm9sKCk7IC8vIFNpZGUgZWZmZWN0OiB1cHNlcnRzIGNvbnRyb2wgZG9jdW1lbnQuXG5cdFx0Y29uc29sZS5sb2cobWFrZUFCb3goW1xuXHRcdFx0XCJFUlJPUiEgU0VSVkVSIFNUT1BQRURcIixcblx0XHRcdFwiXCIsXG5cdFx0XHRcIllvdXIgZGF0YWJhc2UgbWlncmF0aW9uIGNvbnRyb2wgaXMgbG9ja2VkLlwiLFxuXHRcdFx0XCJQbGVhc2UgbWFrZSBzdXJlIHlvdSBhcmUgcnVubmluZyB0aGUgbGF0ZXN0IHZlcnNpb24gYW5kIHRyeSBhZ2Fpbi5cIixcblx0XHRcdFwiSWYgdGhlIHByb2JsZW0gcGVyc2lzdHMsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG5cdFx0XHRcIlwiLFxuXHRcdFx0XCJUaGlzIFJvY2tldC5DaGF0IHZlcnNpb246IFwiICsgUm9ja2V0Q2hhdC5JbmZvLnZlcnNpb24sXG5cdFx0XHRcIkRhdGFiYXNlIGxvY2tlZCBhdCB2ZXJzaW9uOiBcIiArIGNvbnRyb2wudmVyc2lvbixcblx0XHRcdFwiRGF0YWJhc2UgdGFyZ2V0IHZlcnNpb246IFwiICsgKHZlcnNpb24gPT09ICdsYXRlc3QnID8gXy5sYXN0KHRoaXMuX2xpc3QpLnZlcnNpb24gOiB2ZXJzaW9uKSxcblx0XHRcdFwiXCIsXG5cdFx0XHRcIkNvbW1pdDogXCIgKyBSb2NrZXRDaGF0LkluZm8uY29tbWl0Lmhhc2gsXG5cdFx0XHRcIkRhdGU6IFwiICsgUm9ja2V0Q2hhdC5JbmZvLmNvbW1pdC5kYXRlLFxuXHRcdFx0XCJCcmFuY2g6IFwiICsgUm9ja2V0Q2hhdC5JbmZvLmNvbW1pdC5icmFuY2gsXG5cdFx0XHRcIlRhZzogXCIgKyBSb2NrZXRDaGF0LkluZm8uY29tbWl0LnRhZ1xuXHRcdF0pKTtcblx0XHRwcm9jZXNzLmV4aXQoMSk7XG5cdH1cblxuXHQvLyByZW1lbWJlciB0byBydW4gbWV0ZW9yIHdpdGggLS1vbmNlIG90aGVyd2lzZSBpdCB3aWxsIHJlc3RhcnRcblx0aWYgKHN1YmNvbW1hbmQgPT09ICdleGl0Jylcblx0XHRwcm9jZXNzLmV4aXQoMCk7XG59XG5cbi8vIGp1c3QgcmV0dXJucyB0aGUgY3VycmVudCB2ZXJzaW9uXG5NaWdyYXRpb25zLmdldFZlcnNpb24gPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuX2dldENvbnRyb2woKS52ZXJzaW9uO1xufVxuXG4vLyBtaWdyYXRlcyB0byB0aGUgc3BlY2lmaWMgdmVyc2lvbiBwYXNzZWQgaW5cbk1pZ3JhdGlvbnMuX21pZ3JhdGVUbyA9IGZ1bmN0aW9uKHZlcnNpb24sIHJlcnVuKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIGNvbnRyb2wgPSB0aGlzLl9nZXRDb250cm9sKCk7IC8vIFNpZGUgZWZmZWN0OiB1cHNlcnRzIGNvbnRyb2wgZG9jdW1lbnQuXG5cdHZhciBjdXJyZW50VmVyc2lvbiA9IGNvbnRyb2wudmVyc2lvbjtcblxuXHRpZiAobG9jaygpID09PSBmYWxzZSkge1xuXHRcdC8vIGxvZy5pbmZvKCdOb3QgbWlncmF0aW5nLCBjb250cm9sIGlzIGxvY2tlZC4nKTtcblx0XHQvLyBXYXJuaW5nXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKHJlcnVuKSB7XG5cdFx0bG9nLmluZm8oJ1JlcnVubmluZyB2ZXJzaW9uICcgKyB2ZXJzaW9uKTtcblx0XHRtaWdyYXRlKCd1cCcsIHRoaXMuX2ZpbmRJbmRleEJ5VmVyc2lvbih2ZXJzaW9uKSk7XG5cdFx0bG9nLmluZm8oJ0ZpbmlzaGVkIG1pZ3JhdGluZy4nKTtcblx0XHR1bmxvY2soKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGlmIChjdXJyZW50VmVyc2lvbiA9PT0gdmVyc2lvbikge1xuXHRcdGlmICh0aGlzLm9wdGlvbnMubG9nSWZMYXRlc3QpIHtcblx0XHRcdGxvZy5pbmZvKCdOb3QgbWlncmF0aW5nLCBhbHJlYWR5IGF0IHZlcnNpb24gJyArIHZlcnNpb24pO1xuXHRcdH1cblx0XHR1bmxvY2soKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHZhciBzdGFydElkeCA9IHRoaXMuX2ZpbmRJbmRleEJ5VmVyc2lvbihjdXJyZW50VmVyc2lvbik7XG5cdHZhciBlbmRJZHggPSB0aGlzLl9maW5kSW5kZXhCeVZlcnNpb24odmVyc2lvbik7XG5cblx0Ly8gbG9nLmluZm8oJ3N0YXJ0SWR4OicgKyBzdGFydElkeCArICcgZW5kSWR4OicgKyBlbmRJZHgpO1xuXHRsb2cuaW5mbygnTWlncmF0aW5nIGZyb20gdmVyc2lvbiAnICsgdGhpcy5fbGlzdFtzdGFydElkeF0udmVyc2lvbiArICcgLT4gJyArIHRoaXMuX2xpc3RbZW5kSWR4XS52ZXJzaW9uKTtcblxuXHQvLyBydW4gdGhlIGFjdHVhbCBtaWdyYXRpb25cblx0ZnVuY3Rpb24gbWlncmF0ZShkaXJlY3Rpb24sIGlkeCkge1xuXHRcdHZhciBtaWdyYXRpb24gPSBzZWxmLl9saXN0W2lkeF07XG5cblx0XHRpZiAodHlwZW9mIG1pZ3JhdGlvbltkaXJlY3Rpb25dICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR1bmxvY2soKTtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ0Nhbm5vdCBtaWdyYXRlICcgKyBkaXJlY3Rpb24gKyAnIG9uIHZlcnNpb24gJyArIG1pZ3JhdGlvbi52ZXJzaW9uKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBtYXliZU5hbWUoKSB7XG5cdFx0XHRyZXR1cm4gbWlncmF0aW9uLm5hbWUgPyAnICgnICsgbWlncmF0aW9uLm5hbWUgKyAnKScgOiAnJztcblx0XHR9XG5cblx0XHRsb2cuaW5mbygnUnVubmluZyAnICsgZGlyZWN0aW9uICsgJygpIG9uIHZlcnNpb24gJyArIG1pZ3JhdGlvbi52ZXJzaW9uICsgbWF5YmVOYW1lKCkpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdFJvY2tldENoYXQubW9kZWxzLl9DYWNoZUNvbnRyb2wud2l0aFZhbHVlKGZhbHNlLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0bWlncmF0aW9uW2RpcmVjdGlvbl0obWlncmF0aW9uKTtcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKG1ha2VBQm94KFtcblx0XHRcdFx0XCJFUlJPUiEgU0VSVkVSIFNUT1BQRURcIixcblx0XHRcdFx0XCJcIixcblx0XHRcdFx0XCJZb3VyIGRhdGFiYXNlIG1pZ3JhdGlvbiBmYWlsZWQ6XCIsXG5cdFx0XHRcdGUubWVzc2FnZSxcblx0XHRcdFx0XCJcIixcblx0XHRcdFx0XCJQbGVhc2UgbWFrZSBzdXJlIHlvdSBhcmUgcnVubmluZyB0aGUgbGF0ZXN0IHZlcnNpb24gYW5kIHRyeSBhZ2Fpbi5cIixcblx0XHRcdFx0XCJJZiB0aGUgcHJvYmxlbSBwZXJzaXN0cywgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcblx0XHRcdFx0XCJcIixcblx0XHRcdFx0XCJUaGlzIFJvY2tldC5DaGF0IHZlcnNpb246IFwiICsgUm9ja2V0Q2hhdC5JbmZvLnZlcnNpb24sXG5cdFx0XHRcdFwiRGF0YWJhc2UgbG9ja2VkIGF0IHZlcnNpb246IFwiICsgY29udHJvbC52ZXJzaW9uLFxuXHRcdFx0XHRcIkRhdGFiYXNlIHRhcmdldCB2ZXJzaW9uOiBcIiArIHZlcnNpb24sXG5cdFx0XHRcdFwiXCIsXG5cdFx0XHRcdFwiQ29tbWl0OiBcIiArIFJvY2tldENoYXQuSW5mby5jb21taXQuaGFzaCxcblx0XHRcdFx0XCJEYXRlOiBcIiArIFJvY2tldENoYXQuSW5mby5jb21taXQuZGF0ZSxcblx0XHRcdFx0XCJCcmFuY2g6IFwiICsgUm9ja2V0Q2hhdC5JbmZvLmNvbW1pdC5icmFuY2gsXG5cdFx0XHRcdFwiVGFnOiBcIiArIFJvY2tldENoYXQuSW5mby5jb21taXQudGFnXG5cdFx0XHRdKSk7XG5cdFx0XHRwcm9jZXNzLmV4aXQoMSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmV0dXJucyB0cnVlIGlmIGxvY2sgd2FzIGFjcXVpcmVkLlxuXHRmdW5jdGlvbiBsb2NrKCkge1xuXHRcdGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpO1xuXHRcdGNvbnN0IGRhdGVNaW51c0ludGVydmFsID0gbW9tZW50KGRhdGUpLnN1YnRyYWN0KHNlbGYub3B0aW9ucy5sb2NrRXhwaXJhdGlvbiwgJ21pbnV0ZXMnKS50b0RhdGUoKTtcblx0XHRjb25zdCBidWlsZCA9IFJvY2tldENoYXQuSW5mbyA/IFJvY2tldENoYXQuSW5mby5idWlsZC5kYXRlIDogZGF0ZTtcblxuXHRcdC8vIFRoaXMgaXMgYXRvbWljLiBUaGUgc2VsZWN0b3IgZW5zdXJlcyBvbmx5IG9uZSBjYWxsZXIgYXQgYSB0aW1lIHdpbGwgc2VlXG5cdFx0Ly8gdGhlIHVubG9ja2VkIGNvbnRyb2wsIGFuZCBsb2NraW5nIG9jY3VycyBpbiB0aGUgc2FtZSB1cGRhdGUncyBtb2RpZmllci5cblx0XHQvLyBBbGwgb3RoZXIgc2ltdWx0YW5lb3VzIGNhbGxlcnMgd2lsbCBnZXQgZmFsc2UgYmFjayBmcm9tIHRoZSB1cGRhdGUuXG5cdFx0cmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlKHtcblx0XHRcdF9pZDogJ2NvbnRyb2wnLFxuXHRcdFx0JG9yOiBbe1xuXHRcdFx0XHRsb2NrZWQ6IGZhbHNlXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGxvY2tlZEF0OiB7XG5cdFx0XHRcdFx0JGx0OiBkYXRlTWludXNJbnRlcnZhbFxuXHRcdFx0XHR9XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGJ1aWxkQXQ6IHtcblx0XHRcdFx0XHQkbmU6IGJ1aWxkXG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fSwge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRsb2NrZWQ6IHRydWUsXG5cdFx0XHRcdGxvY2tlZEF0OiBkYXRlLFxuXHRcdFx0XHRidWlsZEF0OiBidWlsZFxuXHRcdFx0fVxuXHRcdH0pID09PSAxO1xuXHR9XG5cblxuXHQvLyBTaWRlIGVmZmVjdDogc2F2ZXMgdmVyc2lvbi5cblx0ZnVuY3Rpb24gdW5sb2NrKCkge1xuXHRcdHNlbGYuX3NldENvbnRyb2woe1xuXHRcdFx0bG9ja2VkOiBmYWxzZSxcblx0XHRcdHZlcnNpb246IGN1cnJlbnRWZXJzaW9uXG5cdFx0fSk7XG5cdH1cblxuXHRpZiAoY3VycmVudFZlcnNpb24gPCB2ZXJzaW9uKSB7XG5cdFx0Zm9yICh2YXIgaSA9IHN0YXJ0SWR4OyBpIDwgZW5kSWR4OyBpKyspIHtcblx0XHRcdG1pZ3JhdGUoJ3VwJywgaSArIDEpO1xuXHRcdFx0Y3VycmVudFZlcnNpb24gPSBzZWxmLl9saXN0W2kgKyAxXS52ZXJzaW9uO1xuXHRcdFx0c2VsZi5fc2V0Q29udHJvbCh7XG5cdFx0XHRcdGxvY2tlZDogdHJ1ZSxcblx0XHRcdFx0dmVyc2lvbjogY3VycmVudFZlcnNpb25cblx0XHRcdH0pO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRmb3IgKHZhciBpID0gc3RhcnRJZHg7IGkgPiBlbmRJZHg7IGktLSkge1xuXHRcdFx0bWlncmF0ZSgnZG93bicsIGkpO1xuXHRcdFx0Y3VycmVudFZlcnNpb24gPSBzZWxmLl9saXN0W2kgLSAxXS52ZXJzaW9uO1xuXHRcdFx0c2VsZi5fc2V0Q29udHJvbCh7XG5cdFx0XHRcdGxvY2tlZDogdHJ1ZSxcblx0XHRcdFx0dmVyc2lvbjogY3VycmVudFZlcnNpb25cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHVubG9jaygpO1xuXHRsb2cuaW5mbygnRmluaXNoZWQgbWlncmF0aW5nLicpO1xufVxuXG4vLyBnZXRzIHRoZSBjdXJyZW50IGNvbnRyb2wgcmVjb3JkLCBvcHRpb25hbGx5IGNyZWF0aW5nIGl0IGlmIG5vbi1leGlzdGFudFxuTWlncmF0aW9ucy5fZ2V0Q29udHJvbCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgY29udHJvbCA9IHRoaXMuX2NvbGxlY3Rpb24uZmluZE9uZSh7XG5cdFx0X2lkOiAnY29udHJvbCdcblx0fSk7XG5cblx0cmV0dXJuIGNvbnRyb2wgfHwgdGhpcy5fc2V0Q29udHJvbCh7XG5cdFx0dmVyc2lvbjogMCxcblx0XHRsb2NrZWQ6IGZhbHNlXG5cdH0pO1xufVxuXG4vLyBzZXRzIHRoZSBjb250cm9sIHJlY29yZFxuTWlncmF0aW9ucy5fc2V0Q29udHJvbCA9IGZ1bmN0aW9uKGNvbnRyb2wpIHtcblx0Ly8gYmUgcXVpdGUgc3RyaWN0XG5cdGNoZWNrKGNvbnRyb2wudmVyc2lvbiwgTnVtYmVyKTtcblx0Y2hlY2soY29udHJvbC5sb2NrZWQsIEJvb2xlYW4pO1xuXG5cdHRoaXMuX2NvbGxlY3Rpb24udXBkYXRlKHtcblx0XHRfaWQ6ICdjb250cm9sJ1xuXHR9LCB7XG5cdFx0JHNldDoge1xuXHRcdFx0dmVyc2lvbjogY29udHJvbC52ZXJzaW9uLFxuXHRcdFx0bG9ja2VkOiBjb250cm9sLmxvY2tlZFxuXHRcdH1cblx0fSwge1xuXHRcdHVwc2VydDogdHJ1ZVxuXHR9KTtcblxuXHRyZXR1cm4gY29udHJvbDtcbn1cblxuLy8gcmV0dXJucyB0aGUgbWlncmF0aW9uIGluZGV4IGluIF9saXN0IG9yIHRocm93cyBpZiBub3QgZm91bmRcbk1pZ3JhdGlvbnMuX2ZpbmRJbmRleEJ5VmVyc2lvbiA9IGZ1bmN0aW9uKHZlcnNpb24pIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9saXN0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0aWYgKHRoaXMuX2xpc3RbaV0udmVyc2lvbiA9PT0gdmVyc2lvbilcblx0XHRcdHJldHVybiBpO1xuXHR9XG5cblx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignQ2FuXFwndCBmaW5kIG1pZ3JhdGlvbiB2ZXJzaW9uICcgKyB2ZXJzaW9uKTtcbn1cblxuLy9yZXNldCAobWFpbmx5IGludGVuZGVkIGZvciB0ZXN0cylcbk1pZ3JhdGlvbnMuX3Jlc2V0ID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuX2xpc3QgPSBbe1xuXHRcdHZlcnNpb246IDAsXG5cdFx0dXA6IGZ1bmN0aW9uKCkge31cblx0fV07XG5cdHRoaXMuX2NvbGxlY3Rpb24ucmVtb3ZlKHt9KTtcbn1cblxuUm9ja2V0Q2hhdC5NaWdyYXRpb25zID0gTWlncmF0aW9ucztcbiJdfQ==
