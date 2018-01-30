(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:importer-slack-users":{"info.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/rocketchat_importer-slack-users/info.js                                      //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
module.export({
	SlackUsersImporterInfo: () => SlackUsersImporterInfo
});
let ImporterInfo;
module.watch(require("meteor/rocketchat:importer"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 0);

class SlackUsersImporterInfo extends ImporterInfo {
	constructor() {
		super('slack-users', 'Slack_Users', 'text/csv', [{
			text: 'Importer_Slack_Users_CSV_Information',
			href: 'https://rocket.chat/docs/administrator-guides/import/slack/users'
		}]);
	}

}
///////////////////////////////////////////////////////////////////////////////////////////

},"server":{"importer.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/rocketchat_importer-slack-users/server/importer.js                           //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
module.export({
	SlackUsersImporter: () => SlackUsersImporter
});
let Base, ProgressStep, Selection, SelectionUser;
module.watch(require("meteor/rocketchat:importer"), {
	Base(v) {
		Base = v;
	},

	ProgressStep(v) {
		ProgressStep = v;
	},

	Selection(v) {
		Selection = v;
	},

	SelectionUser(v) {
		SelectionUser = v;
	}

}, 0);

class SlackUsersImporter extends Base {
	constructor(info) {
		super(info);
		this.csvParser = Npm.require('csv-parse/lib/sync');
		this.userMap = new Map();
		this.admins = []; //Array of ids of the users which are admins
	}

	prepare(dataURI, sentContentType, fileName) {
		super.prepare(dataURI, sentContentType, fileName, true);
		super.updateProgress(ProgressStep.PREPARING_USERS);
		const uriResult = RocketChatFile.dataURIParse(dataURI);
		const buf = new Buffer(uriResult.image, 'base64');
		const parsed = this.csvParser(buf.toString());
		parsed.forEach((user, index) => {
			// Ignore the first column
			if (index === 0) {
				return;
			}

			const id = Random.id();
			const username = user[0];
			const email = user[1];
			let isBot = false;
			let isDeleted = false;

			switch (user[2]) {
				case 'Admin':
					this.admins.push(id);
					break;

				case 'Bot':
					isBot = true;
					break;

				case 'Deactivated':
					isDeleted = true;
					break;
			}

			this.userMap.set(id, new SelectionUser(id, username, email, isDeleted, isBot, true));
		});
		const userArray = Array.from(this.userMap.values());
		const usersId = this.collection.insert({
			'import': this.importRecord._id,
			'importer': this.name,
			'type': 'users',
			'users': userArray
		});
		this.users = this.collection.findOne(usersId);
		super.updateRecord({
			'count.users': this.userMap.size
		});
		super.addCountToTotal(this.userMap.size);

		if (this.userMap.size === 0) {
			this.logger.error('No users found in the import file.');
			super.updateProgress(ProgressStep.ERROR);
			return super.getProgress();
		}

		super.updateProgress(ProgressStep.USER_SELECTION);
		return new Selection(this.name, userArray, [], 0);
	}

	startImport(importSelection) {
		super.startImport(importSelection);
		const started = Date.now();

		for (const user of importSelection.users) {
			const u = this.userMap.get(user.user_id);
			u.do_import = user.do_import;
			this.userMap.set(user.user_id, u);
		}

		this.collection.update({
			_id: this.users._id
		}, {
			$set: {
				'users': Array.from(this.userMap.values())
			}
		});
		const startedByUserId = Meteor.userId();
		Meteor.defer(() => {
			super.updateProgress(ProgressStep.IMPORTING_USERS);

			try {
				for (const u of this.users.users) {
					if (!u.do_import) {
						continue;
					}

					Meteor.runAsUser(startedByUserId, () => {
						const existantUser = RocketChat.models.Users.findOneByEmailAddress(u.email) || RocketChat.models.Users.findOneByUsername(u.username);
						let userId;

						if (existantUser) {
							//since we have an existing user, let's try a few things
							userId = existantUser._id;
							u.rocketId = existantUser._id;
							RocketChat.models.Users.update({
								_id: u.rocketId
							}, {
								$addToSet: {
									importIds: u.id
								}
							});
							RocketChat.models.Users.setEmail(existantUser._id, u.email);
							RocketChat.models.Users.setEmailVerified(existantUser._id, u.email);
						} else {
							userId = Accounts.createUser({
								username: u.username + Random.id(),
								password: Date.now() + u.name + u.email.toUpperCase()
							});

							if (!userId) {
								console.warn('An error happened while creating a user.');
								return;
							}

							Meteor.runAsUser(userId, () => {
								Meteor.call('setUsername', u.username, {
									joinDefaultChannelsSilenced: true
								});
								RocketChat.models.Users.setName(userId, u.name);
								RocketChat.models.Users.update({
									_id: userId
								}, {
									$addToSet: {
										importIds: u.id
									}
								});
								RocketChat.models.Users.setEmail(userId, u.email);
								RocketChat.models.Users.setEmailVerified(userId, u.email);
								u.rocketId = userId;
							});
						}

						if (this.admins.includes(u.user_id)) {
							Meteor.call('setAdminStatus', userId, true);
						}

						super.addCountCompleted(1);
					});
				}

				super.updateProgress(ProgressStep.FINISHING);
				super.updateProgress(ProgressStep.DONE);
			} catch (e) {
				this.logger.error(e);
				super.updateProgress(ProgressStep.ERROR);
			}

			const timeTook = Date.now() - started;
			this.logger.log(`Slack Users Import took ${timeTook} milliseconds.`);
		});
		return super.getProgress();
	}

}
///////////////////////////////////////////////////////////////////////////////////////////

},"adder.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/rocketchat_importer-slack-users/server/adder.js                              //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
  Importers(v) {
    Importers = v;
  }

}, 0);
let SlackUsersImporterInfo;
module.watch(require("../info"), {
  SlackUsersImporterInfo(v) {
    SlackUsersImporterInfo = v;
  }

}, 1);
let SlackUsersImporter;
module.watch(require("./importer"), {
  SlackUsersImporter(v) {
    SlackUsersImporter = v;
  }

}, 2);
Importers.add(new SlackUsersImporterInfo(), SlackUsersImporter);
///////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:importer-slack-users/info.js");
require("./node_modules/meteor/rocketchat:importer-slack-users/server/importer.js");
require("./node_modules/meteor/rocketchat:importer-slack-users/server/adder.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:importer-slack-users'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_importer-slack-users.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1zbGFjay11c2Vycy9pbmZvLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyLXNsYWNrLXVzZXJzL3NlcnZlci9pbXBvcnRlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1zbGFjay11c2Vycy9zZXJ2ZXIvYWRkZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiU2xhY2tVc2Vyc0ltcG9ydGVySW5mbyIsIkltcG9ydGVySW5mbyIsIndhdGNoIiwicmVxdWlyZSIsInYiLCJjb25zdHJ1Y3RvciIsInRleHQiLCJocmVmIiwiU2xhY2tVc2Vyc0ltcG9ydGVyIiwiQmFzZSIsIlByb2dyZXNzU3RlcCIsIlNlbGVjdGlvbiIsIlNlbGVjdGlvblVzZXIiLCJpbmZvIiwiY3N2UGFyc2VyIiwiTnBtIiwidXNlck1hcCIsIk1hcCIsImFkbWlucyIsInByZXBhcmUiLCJkYXRhVVJJIiwic2VudENvbnRlbnRUeXBlIiwiZmlsZU5hbWUiLCJ1cGRhdGVQcm9ncmVzcyIsIlBSRVBBUklOR19VU0VSUyIsInVyaVJlc3VsdCIsIlJvY2tldENoYXRGaWxlIiwiZGF0YVVSSVBhcnNlIiwiYnVmIiwiQnVmZmVyIiwiaW1hZ2UiLCJwYXJzZWQiLCJ0b1N0cmluZyIsImZvckVhY2giLCJ1c2VyIiwiaW5kZXgiLCJpZCIsIlJhbmRvbSIsInVzZXJuYW1lIiwiZW1haWwiLCJpc0JvdCIsImlzRGVsZXRlZCIsInB1c2giLCJzZXQiLCJ1c2VyQXJyYXkiLCJBcnJheSIsImZyb20iLCJ2YWx1ZXMiLCJ1c2Vyc0lkIiwiY29sbGVjdGlvbiIsImluc2VydCIsImltcG9ydFJlY29yZCIsIl9pZCIsIm5hbWUiLCJ1c2VycyIsImZpbmRPbmUiLCJ1cGRhdGVSZWNvcmQiLCJzaXplIiwiYWRkQ291bnRUb1RvdGFsIiwibG9nZ2VyIiwiZXJyb3IiLCJFUlJPUiIsImdldFByb2dyZXNzIiwiVVNFUl9TRUxFQ1RJT04iLCJzdGFydEltcG9ydCIsImltcG9ydFNlbGVjdGlvbiIsInN0YXJ0ZWQiLCJEYXRlIiwibm93IiwidSIsImdldCIsInVzZXJfaWQiLCJkb19pbXBvcnQiLCJ1cGRhdGUiLCIkc2V0Iiwic3RhcnRlZEJ5VXNlcklkIiwiTWV0ZW9yIiwidXNlcklkIiwiZGVmZXIiLCJJTVBPUlRJTkdfVVNFUlMiLCJydW5Bc1VzZXIiLCJleGlzdGFudFVzZXIiLCJSb2NrZXRDaGF0IiwibW9kZWxzIiwiVXNlcnMiLCJmaW5kT25lQnlFbWFpbEFkZHJlc3MiLCJmaW5kT25lQnlVc2VybmFtZSIsInJvY2tldElkIiwiJGFkZFRvU2V0IiwiaW1wb3J0SWRzIiwic2V0RW1haWwiLCJzZXRFbWFpbFZlcmlmaWVkIiwiQWNjb3VudHMiLCJjcmVhdGVVc2VyIiwicGFzc3dvcmQiLCJ0b1VwcGVyQ2FzZSIsImNvbnNvbGUiLCJ3YXJuIiwiY2FsbCIsImpvaW5EZWZhdWx0Q2hhbm5lbHNTaWxlbmNlZCIsInNldE5hbWUiLCJpbmNsdWRlcyIsImFkZENvdW50Q29tcGxldGVkIiwiRklOSVNISU5HIiwiRE9ORSIsImUiLCJ0aW1lVG9vayIsImxvZyIsIkltcG9ydGVycyIsImFkZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxPQUFPQyxNQUFQLENBQWM7QUFBQ0MseUJBQXVCLE1BQUlBO0FBQTVCLENBQWQ7QUFBbUUsSUFBSUMsWUFBSjtBQUFpQkgsT0FBT0ksS0FBUCxDQUFhQyxRQUFRLDRCQUFSLENBQWIsRUFBbUQ7QUFBQ0YsY0FBYUcsQ0FBYixFQUFlO0FBQUNILGlCQUFhRyxDQUFiO0FBQWU7O0FBQWhDLENBQW5ELEVBQXFGLENBQXJGOztBQUU3RSxNQUFNSixzQkFBTixTQUFxQ0MsWUFBckMsQ0FBa0Q7QUFDeERJLGVBQWM7QUFDYixRQUFNLGFBQU4sRUFBcUIsYUFBckIsRUFBb0MsVUFB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dXJjZXNDb250ZW50IjpbImltcG9ydCB7IEltcG9ydGVySW5mbyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIFNsYWNrVXNlcnNJbXBvcnRlckluZm8gZXh0ZW5kcyBJbXBvcnRlckluZm8ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignc2xhY2stdXNlcnMnLCAnU2xhY2tfVXNlcnMnLCAndGV4dC9jc3YnLCBbe1xuXHRcdFx0dGV4dDogJ0ltcG9ydGVyX1NsYWNrX1VzZXJzX0NTVl9JbmZvcm1hdGlvbicsXG5cdFx0XHRocmVmOiAnaHR0cHM6Ly9yb2NrZXQuY2hhdC9kb2NzL2FkbWluaXN0cmF0b3ItZ3VpZGVzL2ltcG9ydC9zbGFjay91c2Vycydcblx0XHR9XSk7XG5cdH1cbn1cbiIsImltcG9ydCB7XG5cdEJhc2UsXG5cdFByb2dyZXNzU3RlcCxcblx0U2VsZWN0aW9uLFxuXHRTZWxlY3Rpb25Vc2VyXG59IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIFNsYWNrVXNlcnNJbXBvcnRlciBleHRlbmRzIEJhc2Uge1xuXHRjb25zdHJ1Y3RvcihpbmZvKSB7XG5cdFx0c3VwZXIoaW5mbyk7XG5cblx0XHR0aGlzLmNzdlBhcnNlciA9IE5wbS5yZXF1aXJlKCdjc3YtcGFyc2UvbGliL3N5bmMnKTtcblx0XHR0aGlzLnVzZXJNYXAgPSBuZXcgTWFwKCk7XG5cdFx0dGhpcy5hZG1pbnMgPSBbXTsgLy9BcnJheSBvZiBpZHMgb2YgdGhlIHVzZXJzIHdoaWNoIGFyZSBhZG1pbnNcblx0fVxuXG5cdHByZXBhcmUoZGF0YVVSSSwgc2VudENvbnRlbnRUeXBlLCBmaWxlTmFtZSkge1xuXHRcdHN1cGVyLnByZXBhcmUoZGF0YVVSSSwgc2VudENvbnRlbnRUeXBlLCBmaWxlTmFtZSwgdHJ1ZSk7XG5cblx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuUFJFUEFSSU5HX1VTRVJTKTtcblx0XHRjb25zdCB1cmlSZXN1bHQgPSBSb2NrZXRDaGF0RmlsZS5kYXRhVVJJUGFyc2UoZGF0YVVSSSk7XG5cdFx0Y29uc3QgYnVmID0gbmV3IEJ1ZmZlcih1cmlSZXN1bHQuaW1hZ2UsICdiYXNlNjQnKTtcblx0XHRjb25zdCBwYXJzZWQgPSB0aGlzLmNzdlBhcnNlcihidWYudG9TdHJpbmcoKSk7XG5cblx0XHRwYXJzZWQuZm9yRWFjaCgodXNlciwgaW5kZXgpID0+IHtcblx0XHRcdC8vIElnbm9yZSB0aGUgZmlyc3QgY29sdW1uXG5cdFx0XHRpZiAoaW5kZXggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpZCA9IFJhbmRvbS5pZCgpO1xuXHRcdFx0Y29uc3QgdXNlcm5hbWUgPSB1c2VyWzBdO1xuXHRcdFx0Y29uc3QgZW1haWwgPSB1c2VyWzFdO1xuXHRcdFx0bGV0IGlzQm90ID0gZmFsc2U7XG5cdFx0XHRsZXQgaXNEZWxldGVkID0gZmFsc2U7XG5cblx0XHRcdHN3aXRjaCAodXNlclsyXSkge1xuXHRcdFx0XHRjYXNlICdBZG1pbic6XG5cdFx0XHRcdFx0dGhpcy5hZG1pbnMucHVzaChpZCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ0JvdCc6XG5cdFx0XHRcdFx0aXNCb3QgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdEZWFjdGl2YXRlZCc6XG5cdFx0XHRcdFx0aXNEZWxldGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy51c2VyTWFwLnNldChpZCwgbmV3IFNlbGVjdGlvblVzZXIoaWQsIHVzZXJuYW1lLCBlbWFpbCwgaXNEZWxldGVkLCBpc0JvdCwgdHJ1ZSkpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXNlckFycmF5ID0gQXJyYXkuZnJvbSh0aGlzLnVzZXJNYXAudmFsdWVzKCkpO1xuXG5cdFx0Y29uc3QgdXNlcnNJZCA9IHRoaXMuY29sbGVjdGlvbi5pbnNlcnQoeyAnaW1wb3J0JzogdGhpcy5pbXBvcnRSZWNvcmQuX2lkLCAnaW1wb3J0ZXInOiB0aGlzLm5hbWUsICd0eXBlJzogJ3VzZXJzJywgJ3VzZXJzJzogdXNlckFycmF5IH0pO1xuXHRcdHRoaXMudXNlcnMgPSB0aGlzLmNvbGxlY3Rpb24uZmluZE9uZSh1c2Vyc0lkKTtcblx0XHRzdXBlci51cGRhdGVSZWNvcmQoeyAnY291bnQudXNlcnMnOiB0aGlzLnVzZXJNYXAuc2l6ZSB9KTtcblx0XHRzdXBlci5hZGRDb3VudFRvVG90YWwodGhpcy51c2VyTWFwLnNpemUpO1xuXG5cdFx0aWYgKHRoaXMudXNlck1hcC5zaXplID09PSAwKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5lcnJvcignTm8gdXNlcnMgZm91bmQgaW4gdGhlIGltcG9ydCBmaWxlLicpO1xuXHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLkVSUk9SKTtcblx0XHRcdHJldHVybiBzdXBlci5nZXRQcm9ncmVzcygpO1xuXHRcdH1cblxuXHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5VU0VSX1NFTEVDVElPTik7XG5cdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24odGhpcy5uYW1lLCB1c2VyQXJyYXksIFtdLCAwKTtcblx0fVxuXG5cdHN0YXJ0SW1wb3J0KGltcG9ydFNlbGVjdGlvbikge1xuXHRcdHN1cGVyLnN0YXJ0SW1wb3J0KGltcG9ydFNlbGVjdGlvbik7XG5cdFx0Y29uc3Qgc3RhcnRlZCA9IERhdGUubm93KCk7XG5cblx0XHRmb3IgKGNvbnN0IHVzZXIgb2YgaW1wb3J0U2VsZWN0aW9uLnVzZXJzKSB7XG5cdFx0XHRjb25zdCB1ID0gdGhpcy51c2VyTWFwLmdldCh1c2VyLnVzZXJfaWQpO1xuXHRcdFx0dS5kb19pbXBvcnQgPSB1c2VyLmRvX2ltcG9ydDtcblxuXHRcdFx0dGhpcy51c2VyTWFwLnNldCh1c2VyLnVzZXJfaWQsIHUpO1xuXHRcdH1cblx0XHR0aGlzLmNvbGxlY3Rpb24udXBkYXRlKHsgX2lkOiB0aGlzLnVzZXJzLl9pZCB9LCB7ICRzZXQ6IHsgJ3VzZXJzJzogQXJyYXkuZnJvbSh0aGlzLnVzZXJNYXAudmFsdWVzKCkpIH19KTtcblxuXHRcdGNvbnN0IHN0YXJ0ZWRCeVVzZXJJZCA9IE1ldGVvci51c2VySWQoKTtcblx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLklNUE9SVElOR19VU0VSUyk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdSBvZiB0aGlzLnVzZXJzLnVzZXJzKSB7XG5cdFx0XHRcdFx0aWYgKCF1LmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcihzdGFydGVkQnlVc2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4aXN0YW50VXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUVtYWlsQWRkcmVzcyh1LmVtYWlsKSB8fCBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1LnVzZXJuYW1lKTtcblxuXHRcdFx0XHRcdFx0bGV0IHVzZXJJZDtcblx0XHRcdFx0XHRcdGlmIChleGlzdGFudFVzZXIpIHtcblx0XHRcdFx0XHRcdFx0Ly9zaW5jZSB3ZSBoYXZlIGFuIGV4aXN0aW5nIHVzZXIsIGxldCdzIHRyeSBhIGZldyB0aGluZ3Ncblx0XHRcdFx0XHRcdFx0dXNlcklkID0gZXhpc3RhbnRVc2VyLl9pZDtcblx0XHRcdFx0XHRcdFx0dS5yb2NrZXRJZCA9IGV4aXN0YW50VXNlci5faWQ7XG5cdFx0XHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZSh7IF9pZDogdS5yb2NrZXRJZCB9LCB7ICRhZGRUb1NldDogeyBpbXBvcnRJZHM6IHUuaWQgfSB9KTtcblxuXHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5zZXRFbWFpbChleGlzdGFudFVzZXIuX2lkLCB1LmVtYWlsKTtcblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0RW1haWxWZXJpZmllZChleGlzdGFudFVzZXIuX2lkLCB1LmVtYWlsKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHVzZXJJZCA9IEFjY291bnRzLmNyZWF0ZVVzZXIoeyB1c2VybmFtZTogdS51c2VybmFtZSArIFJhbmRvbS5pZCgpLCBwYXNzd29yZDogRGF0ZS5ub3coKSArIHUubmFtZSArIHUuZW1haWwudG9VcHBlckNhc2UoKSB9KTtcblxuXHRcdFx0XHRcdFx0XHRpZiAoIXVzZXJJZCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybignQW4gZXJyb3IgaGFwcGVuZWQgd2hpbGUgY3JlYXRpbmcgYSB1c2VyLicpO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIodXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0TWV0ZW9yLmNhbGwoJ3NldFVzZXJuYW1lJywgdS51c2VybmFtZSwge2pvaW5EZWZhdWx0Q2hhbm5lbHNTaWxlbmNlZDogdHJ1ZX0pO1xuXHRcdFx0XHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnNldE5hbWUodXNlcklkLCB1Lm5hbWUpO1xuXHRcdFx0XHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZSh7IF9pZDogdXNlcklkIH0sIHsgJGFkZFRvU2V0OiB7IGltcG9ydElkczogdS5pZCB9IH0pO1xuXHRcdFx0XHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnNldEVtYWlsKHVzZXJJZCwgdS5lbWFpbCk7XG5cdFx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0RW1haWxWZXJpZmllZCh1c2VySWQsIHUuZW1haWwpO1xuXHRcdFx0XHRcdFx0XHRcdHUucm9ja2V0SWQgPSB1c2VySWQ7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5hZG1pbnMuaW5jbHVkZXModS51c2VyX2lkKSkge1xuXHRcdFx0XHRcdFx0XHRNZXRlb3IuY2FsbCgnc2V0QWRtaW5TdGF0dXMnLCB1c2VySWQsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRzdXBlci5hZGRDb3VudENvbXBsZXRlZCgxKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5GSU5JU0hJTkcpO1xuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRE9ORSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGUpO1xuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRVJST1IpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aW1lVG9vayA9IERhdGUubm93KCkgLSBzdGFydGVkO1xuXHRcdFx0dGhpcy5sb2dnZXIubG9nKGBTbGFjayBVc2VycyBJbXBvcnQgdG9vayAkeyB0aW1lVG9vayB9IG1pbGxpc2Vjb25kcy5gKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBzdXBlci5nZXRQcm9ncmVzcygpO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBJbXBvcnRlcnMgfSBmcm9tICdtZXRlb3Ivcm9ja2V0Y2hhdDppbXBvcnRlcic7XG5pbXBvcnQgeyBTbGFja1VzZXJzSW1wb3J0ZXJJbmZvIH0gZnJvbSAnLi4vaW5mbyc7XG5pbXBvcnQgeyBTbGFja1VzZXJzSW1wb3J0ZXIgfSBmcm9tICcuL2ltcG9ydGVyJztcblxuSW1wb3J0ZXJzLmFkZChuZXcgU2xhY2tVc2Vyc0ltcG9ydGVySW5mbygpLCBTbGFja1VzZXJzSW1wb3J0ZXIpO1xuIl19
