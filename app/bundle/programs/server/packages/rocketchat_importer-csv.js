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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:importer-csv":{"info.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_importer-csv/info.js                                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
	CsvImporterInfo: () => CsvImporterInfo
});
let ImporterInfo;
module.watch(require("meteor/rocketchat:importer"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 0);

class CsvImporterInfo extends ImporterInfo {
	constructor() {
		super('csv', 'CSV', 'application/zip', [{
			text: 'Importer_CSV_Information',
			href: 'https://rocket.chat/docs/administrator-guides/import/csv/'
		}]);
	}

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server":{"importer.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_importer-csv/server/importer.js                                                                //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
	CsvImporter: () => CsvImporter
});
let Base, ProgressStep, Selection, SelectionChannel, SelectionUser;
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

	SelectionChannel(v) {
		SelectionChannel = v;
	},

	SelectionUser(v) {
		SelectionUser = v;
	}

}, 0);

class CsvImporter extends Base {
	constructor(info) {
		super(info);
		this.csvParser = Npm.require('csv-parse/lib/sync');
		this.messages = new Map();
	}

	prepare(dataURI, sentContentType, fileName) {
		super.prepare(dataURI, sentContentType, fileName);
		const uriResult = RocketChatFile.dataURIParse(dataURI);
		const zip = new this.AdmZip(new Buffer(uriResult.image, 'base64'));
		const zipEntries = zip.getEntries();
		let tempChannels = [];
		let tempUsers = [];
		const tempMessages = new Map();

		for (const entry of zipEntries) {
			this.logger.debug(`Entry: ${entry.entryName}`); //Ignore anything that has `__MACOSX` in it's name, as sadly these things seem to mess everything up

			if (entry.entryName.indexOf('__MACOSX') > -1) {
				this.logger.debug(`Ignoring the file: ${entry.entryName}`);
				continue;
			} //Directories are ignored, since they are "virtual" in a zip file


			if (entry.isDirectory) {
				this.logger.debug(`Ignoring the directory entry: ${entry.entryName}`);
				continue;
			} //Parse the channels


			if (entry.entryName.toLowerCase() === 'channels.csv') {
				super.updateProgress(ProgressStep.PREPARING_CHANNELS);
				const parsedChannels = this.csvParser(entry.getData().toString());
				tempChannels = parsedChannels.map(c => {
					return {
						id: c[0].trim().replace('.', '_'),
						name: c[0].trim(),
						creator: c[1].trim(),
						isPrivate: c[2].trim().toLowerCase() === 'private' ? true : false,
						members: c[3].trim().split(';').map(m => m.trim())
					};
				});
				continue;
			} //Parse the users


			if (entry.entryName.toLowerCase() === 'users.csv') {
				super.updateProgress(ProgressStep.PREPARING_USERS);
				const parsedUsers = this.csvParser(entry.getData().toString());
				tempUsers = parsedUsers.map(u => {
					return {
						id: u[0].trim().replace('.', '_'),
						username: u[0].trim(),
						email: u[1].trim(),
						name: u[2].trim()
					};
				});
				continue;
			} //Parse the messages


			if (entry.entryName.indexOf('/') > -1) {
				const item = entry.entryName.split('/'); //random/messages.csv

				const channelName = item[0]; //random

				const msgGroupData = item[1].split('.')[0]; //2015-10-04

				if (!tempMessages.get(channelName)) {
					tempMessages.set(channelName, new Map());
				}

				let msgs = [];

				try {
					msgs = this.csvParser(entry.getData().toString());
				} catch (e) {
					this.logger.warn(`The file ${entry.entryName} contains invalid syntax`, e);
					continue;
				}

				tempMessages.get(channelName).set(msgGroupData, msgs.map(m => {
					return {
						username: m[0],
						ts: m[1],
						text: m[2]
					};
				}));
				continue;
			}
		} // Insert the users record, eventually this might have to be split into several ones as well
		// if someone tries to import a several thousands users instance


		const usersId = this.collection.insert({
			'import': this.importRecord._id,
			'importer': this.name,
			'type': 'users',
			'users': tempUsers
		});
		this.users = this.collection.findOne(usersId);
		super.updateRecord({
			'count.users': tempUsers.length
		});
		super.addCountToTotal(tempUsers.length); // Insert the channels records.

		const channelsId = this.collection.insert({
			'import': this.importRecord._id,
			'importer': this.name,
			'type': 'channels',
			'channels': tempChannels
		});
		this.channels = this.collection.findOne(channelsId);
		super.updateRecord({
			'count.channels': tempChannels.length
		});
		super.addCountToTotal(tempChannels.length); // Save the messages records to the import record for `startImport` usage

		super.updateProgress(ProgressStep.PREPARING_MESSAGES);
		let messagesCount = 0;

		for (const [channel, messagesMap] of tempMessages.entries()) {
			if (!this.messages.get(channel)) {
				this.messages.set(channel, new Map());
			}

			for (const [msgGroupData, msgs] of messagesMap.entries()) {
				messagesCount += msgs.length;
				super.updateRecord({
					'messagesstatus': `${channel}/${msgGroupData}`
				});

				if (Base.getBSONSize(msgs) > Base.getMaxBSONSize()) {
					Base.getBSONSafeArraysFromAnArray(msgs).forEach((splitMsg, i) => {
						const messagesId = this.collection.insert({
							'import': this.importRecord._id,
							'importer': this.name,
							'type': 'messages',
							'name': `${channel}/${msgGroupData}.${i}`,
							'messages': splitMsg
						});
						this.messages.get(channel).set(`${msgGroupData}.${i}`, this.collection.findOne(messagesId));
					});
				} else {
					const messagesId = this.collection.insert({
						'import': this.importRecord._id,
						'importer': this.name,
						'type': 'messages',
						'name': `${channel}/${msgGroupData}`,
						'messages': msgs
					});
					this.messages.get(channel).set(msgGroupData, this.collection.findOne(messagesId));
				}
			}
		}

		super.updateRecord({
			'count.messages': messagesCount,
			'messagesstatus': null
		});
		super.addCountToTotal(messagesCount); //Ensure we have at least a single user, channel, or message

		if (tempUsers.length === 0 && tempChannels.length === 0 && messagesCount === 0) {
			this.logger.error('No users, channels, or messages found in the import file.');
			super.updateProgress(ProgressStep.ERROR);
			return super.getProgress();
		}

		const selectionUsers = tempUsers.map(u => new SelectionUser(u.id, u.username, u.email, false, false, true));
		const selectionChannels = tempChannels.map(c => new SelectionChannel(c.id, c.name, false, true, c.isPrivate));
		const selectionMessages = this.importRecord.count.messages;
		super.updateProgress(ProgressStep.USER_SELECTION);
		return new Selection(this.name, selectionUsers, selectionChannels, selectionMessages);
	}

	startImport(importSelection) {
		super.startImport(importSelection);
		const started = Date.now(); //Ensure we're only going to import the users that the user has selected

		for (const user of importSelection.users) {
			for (const u of this.users.users) {
				if (u.id === user.user_id) {
					u.do_import = user.do_import;
				}
			}
		}

		this.collection.update({
			_id: this.users._id
		}, {
			$set: {
				'users': this.users.users
			}
		}); //Ensure we're only importing the channels the user has selected.

		for (const channel of importSelection.channels) {
			for (const c of this.channels.channels) {
				if (c.id === channel.channel_id) {
					c.do_import = channel.do_import;
				}
			}
		}

		this.collection.update({
			_id: this.channels._id
		}, {
			$set: {
				'channels': this.channels.channels
			}
		});
		const startedByUserId = Meteor.userId();
		Meteor.defer(() => {
			super.updateProgress(ProgressStep.IMPORTING_USERS);

			try {
				//Import the users
				for (const u of this.users.users) {
					if (!u.do_import) {
						continue;
					}

					Meteor.runAsUser(startedByUserId, () => {
						let existantUser = RocketChat.models.Users.findOneByEmailAddress(u.email); //If we couldn't find one by their email address, try to find an existing user by their username

						if (!existantUser) {
							existantUser = RocketChat.models.Users.findOneByUsername(u.username);
						}

						if (existantUser) {
							//since we have an existing user, let's try a few things
							u.rocketId = existantUser._id;
							RocketChat.models.Users.update({
								_id: u.rocketId
							}, {
								$addToSet: {
									importIds: u.id
								}
							});
						} else {
							const userId = Accounts.createUser({
								email: u.email,
								password: Date.now() + u.name + u.email.toUpperCase()
							});
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
								u.rocketId = userId;
							});
						}

						super.addCountCompleted(1);
					});
				}

				this.collection.update({
					_id: this.users._id
				}, {
					$set: {
						'users': this.users.users
					}
				}); //Import the channels

				super.updateProgress(ProgressStep.IMPORTING_CHANNELS);

				for (const c of this.channels.channels) {
					if (!c.do_import) {
						continue;
					}

					Meteor.runAsUser(startedByUserId, () => {
						const existantRoom = RocketChat.models.Rooms.findOneByName(c.name); //If the room exists or the name of it is 'general', then we don't need to create it again

						if (existantRoom || c.name.toUpperCase() === 'GENERAL') {
							c.rocketId = c.name.toUpperCase() === 'GENERAL' ? 'GENERAL' : existantRoom._id;
							RocketChat.models.Rooms.update({
								_id: c.rocketId
							}, {
								$addToSet: {
									importIds: c.id
								}
							});
						} else {
							//Find the rocketchatId of the user who created this channel
							let creatorId = startedByUserId;

							for (const u of this.users.users) {
								if (u.username === c.creator && u.do_import) {
									creatorId = u.rocketId;
								}
							} //Create the channel


							Meteor.runAsUser(creatorId, () => {
								const roomInfo = Meteor.call(c.isPrivate ? 'createPrivateGroup' : 'createChannel', c.name, c.members);
								c.rocketId = roomInfo.rid;
							});
							RocketChat.models.Rooms.update({
								_id: c.rocketId
							}, {
								$addToSet: {
									importIds: c.id
								}
							});
						}

						super.addCountCompleted(1);
					});
				}

				this.collection.update({
					_id: this.channels._id
				}, {
					$set: {
						'channels': this.channels.channels
					}
				}); //If no channels file, collect channel map from DB for message-only import

				if (this.channels.channels.length === 0) {
					for (const cname of this.messages.keys()) {
						Meteor.runAsUser(startedByUserId, () => {
							const existantRoom = RocketChat.models.Rooms.findOneByName(cname);

							if (existantRoom || cname.toUpperCase() === 'GENERAL') {
								this.channels.channels.push({
									id: cname.replace('.', '_'),
									name: cname,
									rocketId: cname.toUpperCase() === 'GENERAL' ? 'GENERAL' : existantRoom._id,
									do_import: true
								});
							}
						});
					}
				} //If no users file, collect user map from DB for message-only import


				if (this.users.users.length === 0) {
					for (const [ch, messagesMap] of this.messages.entries()) {
						const csvChannel = this.getChannelFromName(ch);

						if (!csvChannel || !csvChannel.do_import) {
							continue;
						}

						Meteor.runAsUser(startedByUserId, () => {
							for (const msgs of messagesMap.values()) {
								for (const msg of msgs.messages) {
									if (!this.getUserFromUsername(msg.username)) {
										const user = RocketChat.models.Users.findOneByUsername(msg.username);

										if (user) {
											this.users.users.push({
												rocketId: user._id,
												username: user.username
											});
										}
									}
								}
							}
						});
					}
				} //Import the Messages


				super.updateProgress(ProgressStep.IMPORTING_MESSAGES);

				for (const [ch, messagesMap] of this.messages.entries()) {
					const csvChannel = this.getChannelFromName(ch);

					if (!csvChannel || !csvChannel.do_import) {
						continue;
					}

					const room = RocketChat.models.Rooms.findOneById(csvChannel.rocketId, {
						fields: {
							usernames: 1,
							t: 1,
							name: 1
						}
					});
					Meteor.runAsUser(startedByUserId, () => {
						const timestamps = {};

						for (const [msgGroupData, msgs] of messagesMap.entries()) {
							super.updateRecord({
								'messagesstatus': `${ch}/${msgGroupData}.${msgs.messages.length}`
							});

							for (const msg of msgs.messages) {
								if (isNaN(new Date(parseInt(msg.ts)))) {
									this.logger.warn(`Timestamp on a message in ${ch}/${msgGroupData} is invalid`);
									super.addCountCompleted(1);
									continue;
								}

								const creator = this.getUserFromUsername(msg.username);

								if (creator) {
									let suffix = '';

									if (timestamps[msg.ts] === undefined) {
										timestamps[msg.ts] = 1;
									} else {
										suffix = `-${timestamps[msg.ts]}`;
										timestamps[msg.ts] += 1;
									}

									const msgObj = {
										_id: `csv-${csvChannel.id}-${msg.ts}${suffix}`,
										ts: new Date(parseInt(msg.ts)),
										msg: msg.text,
										rid: room._id,
										u: {
											_id: creator._id,
											username: creator.username
										}
									};
									RocketChat.sendMessage(creator, msgObj, room, true);
								}

								super.addCountCompleted(1);
							}
						}
					});
				}

				super.updateProgress(ProgressStep.FINISHING);
				super.updateProgress(ProgressStep.DONE);
			} catch (e) {
				this.logger.error(e);
				super.updateProgress(ProgressStep.ERROR);
			}

			const timeTook = Date.now() - started;
			this.logger.log(`CSV Import took ${timeTook} milliseconds.`);
		});
		return super.getProgress();
	}

	getSelection() {
		const selectionUsers = this.users.users.map(u => new SelectionUser(u.id, u.username, u.email, false, false, true));
		const selectionChannels = this.channels.channels.map(c => new SelectionChannel(c.id, c.name, false, true, c.isPrivate));
		const selectionMessages = this.importRecord.count.messages;
		return new Selection(this.name, selectionUsers, selectionChannels, selectionMessages);
	}

	getChannelFromName(channelName) {
		for (const ch of this.channels.channels) {
			if (ch.name === channelName) {
				return ch;
			}
		}
	}

	getUserFromUsername(username) {
		for (const u of this.users.users) {
			if (u.username === username) {
				return RocketChat.models.Users.findOneById(u.rocketId, {
					fields: {
						username: 1
					}
				});
			}
		}
	}

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"adder.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_importer-csv/server/adder.js                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
  Importers(v) {
    Importers = v;
  }

}, 0);
let CsvImporterInfo;
module.watch(require("../info"), {
  CsvImporterInfo(v) {
    CsvImporterInfo = v;
  }

}, 1);
let CsvImporter;
module.watch(require("./importer"), {
  CsvImporter(v) {
    CsvImporter = v;
  }

}, 2);
Importers.add(new CsvImporterInfo(), CsvImporter);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:importer-csv/info.js");
require("./node_modules/meteor/rocketchat:importer-csv/server/importer.js");
require("./node_modules/meteor/rocketchat:importer-csv/server/adder.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:importer-csv'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_importer-csv.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1jc3YvaW5mby5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1jc3Yvc2VydmVyL2ltcG9ydGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyLWNzdi9zZXJ2ZXIvYWRkZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiQ3N2SW1wb3J0ZXJJbmZvIiwiSW1wb3J0ZXJJbmZvIiwid2F0Y2giLCJyZXF1aXJlIiwidiIsImNvbnN0cnVjdG9yIiwidGV4dCIsImhyZWYiLCJDc3ZJbXBvcnRlciIsIkJhc2UiLCJQcm9ncmVzc1N0ZXAiLCJTZWxlY3Rpb24iLCJTZWxlY3Rpb25DaGFubmVsIiwiU2VsZWN0aW9uVXNlciIsImluZm8iLCJjc3ZQYXJzZXIiLCJOcG0iLCJtZXNzYWdlcyIsIk1hcCIsInByZXBhcmUiLCJkYXRhVVJJIiwic2VudENvbnRlbnRUeXBlIiwiZmlsZU5hbWUiLCJ1cmlSZXN1bHQiLCJSb2NrZXRDaGF0RmlsZSIsImRhdGFVUklQYXJzZSIsInppcCIsIkFkbVppcCIsIkJ1ZmZlciIsImltYWdlIiwiemlwRW50cmllcyIsImdldEVudHJpZXMiLCJ0ZW1wQ2hhbm5lbHMiLCJ0ZW1wVXNlcnMiLCJ0ZW1wTWVzc2FnZXMiLCJlbnRyeSIsImxvZ2dlciIsImRlYnVnIiwiZW50cnlOYW1lIiwiaW5kZXhPZiIsImlzRGlyZWN0b3J5IiwidG9Mb3dlckNhc2UiLCJ1cGRhdGVQcm9ncmVzcyIsIlBSRVBBUklOR19DSEFOTkVMUyIsInBhcnNlZENoYW5uZWxzIiwiZ2V0RGF0YSIsInRvU3RyaW5nIiwibWFwIiwiYyIsImlkIiwidHJpbSIsInJlcGxhY2UiLCJuYW1lIiwiY3JlYXRvciIsImlzUHJpdmF0ZSIsIm1lbWJlcnMiLCJzcGxpdCIsIm0iLCJQUkVQQVJJTkdfVVNFUlMiLCJwYXJzZWRVc2VycyIsInUiLCJ1c2VybmFtZSIsImVtYWlsIiwiaXRlbSIsImNoYW5uZWxOYW1lIiwibXNnR3JvdXBEYXRhIiwiZ2V0Iiwic2V0IiwibXNncyIsImUiLCJ3YXJuIiwidHMiLCJ1c2Vyc0lkIiwiY29sbGVjdGlvbiIsImluc2VydCIsImltcG9ydFJlY29yZCIsIl9pZCIsInVzZXJzIiwiZmluZE9uZSIsInVwZGF0ZVJlY29yZCIsImxlbmd0aCIsImFkZENvdW50VG9Ub3RhbCIsImNoYW5uZWxzSWQiLCJjaGFubmVscyIsIlBSRVBBUklOR19NRVNTQUdFUyIsIm1lc3NhZ2VzQ291bnQiLCJjaGFubmVsIiwibWVzc2FnZXNNYXAiLCJlbnRyaWVzIiwiZ2V0QlNPTlNpemUiLCJnZXRNYXhCU09OU2l6ZSIsImdldEJTT05TYWZlQXJyYXlzRnJvbUFuQXJyYXkiLCJmb3JFYWNoIiwic3BsaXRNc2ciLCJpIiwibWVzc2FnZXNJZCIsImVycm9yIiwiRVJST1IiLCJnZXRQcm9ncmVzcyIsInNlbGVjdGlvblVzZXJzIiwic2VsZWN0aW9uQ2hhbm5lbHMiLCJzZWxlY3Rpb25NZXNzYWdlcyIsImNvdW50IiwiVVNFUl9TRUxFQ1RJT04iLCJzdGFydEltcG9ydCIsImltcG9ydFNlbGVjdGlvbiIsInN0YXJ0ZWQiLCJEYXRlIiwibm93IiwidXNlciIsInVzZXJfaWQiLCJkb19pbXBvcnQiLCJ1cGRhdGUiLCIkc2V0IiwiY2hhbm5lbF9pZCIsInN0YXJ0ZWRCeVVzZXJJZCIsIk1ldGVvciIsInVzZXJJZCIsImRlZmVyIiwiSU1QT1JUSU5HX1VTRVJTIiwicnVuQXNVc2VyIiwiZXhpc3RhbnRVc2VyIiwiUm9ja2V0Q2hhdCIsIm1vZGVscyIsIlVzZXJzIiwiZmluZE9uZUJ5RW1haWxBZGRyZXNzIiwiZmluZE9uZUJ5VXNlcm5hbWUiLCJyb2NrZXRJZCIsIiRhZGRUb1NldCIsImltcG9ydElkcyIsIkFjY291bnRzIiwiY3JlYXRlVXNlciIsInBhc3N3b3JkIiwidG9VcHBlckNhc2UiLCJjYWxsIiwiam9pbkRlZmF1bHRDaGFubmVsc1NpbGVuY2VkIiwic2V0TmFtZSIsImFkZENvdW50Q29tcGxldGVkIiwiSU1QT1JUSU5HX0NIQU5ORUxTIiwiZXhpc3RhbnRSb29tIiwiUm9vbXMiLCJmaW5kT25lQnlOYW1lIiwiY3JlYXRvcklkIiwicm9vbUluZm8iLCJyaWQiLCJjbmFtZSIsImtleXMiLCJwdXNoIiwiY2giLCJjc3ZDaGFubmVsIiwiZ2V0Q2hhbm5lbEZyb21OYW1lIiwidmFsdWVzIiwibXNnIiwiZ2V0VXNlckZyb21Vc2VybmFtZSIsIklNUE9SVElOR19NRVNTQUdFUyIsInJvb20iLCJmaW5kT25lQnlJZCIsImZpZWxkcyIsInVzZXJuYW1lcyIsInQiLCJ0aW1lc3RhbXBzIiwiaXNOYU4iLCJwYXJzZUludCIsInN1ZmZpeCIsInVuZGVmaW5lZCIsIm1zZ09iaiIsInNlbmRNZXNzYWdlIiwiRklOSVNISU5HIiwiRE9ORSIsInRpbWVUb29rIiwibG9nIiwiZ2V0U2VsZWN0aW9uIiwiSW1wb3J0ZXJzIiwiYWRkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE1BQVAsQ0FBYztBQUFDQyxrQkFBZ0IsTUFBSUE7QUFBckIsQ0FBZDtBQUFxRCxJQUFJQyxZQUFKO0FBQWlCSCxPQUFPSSxLQUFQLENBQWFDLFFBQVEsNEJBQVIsQ0FBYixFQUFtRDtBQUFDRixjQUFhRyxDQUFiLEVBQWU7QUFBQ0gsaUJBQWFHLENBQWI7QUFBZTs7QUFBaEMsQ0FBbkQsRUFBcUYsQ0FBckY7O0FBRS9ELE1BQU1KLGVBQU4sU0FBOEJDLFlBQTlCLENBQTJDO0FBQ2pESSxlQUFjO0FBQ2IsUUFBTSxLQUFOLEVBQWEsS0FBYixFQUFvQixpQkFBcEIsRUFBdUMsQ0FBQztBQUN2Q0MsU0FBTSwwQkFEaUM7QUFFdkNDLFNBQU07QUFGaUMsR0FBRCxDQUF2QztBQUlBOztBQU5nRCxDOzs7Ozs7Ozs7OztBQ0ZsRFQsT0FBT0MsTUFBUCxDQUFjO0FBQUNTLGNBQVksTUFBSUE7QUFBakIsQ0FB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QUNBO0FBQ0Q7QUFDRDs7QUFFREsscUJBQW9CNUYsUUFBcEIsRUFBOEI7QUFDN0IsT0FBSyxNQUFNRCxDQUFYLElBQWdCLEtBQUtpQixLQUFMLENBQVdBLEtBQTNCLEVBQWtDO0FBQ2pDLE9BQUlqQixFQUFFQyxRQUFGLEtBQWVBLFFBQW5CLEVBQTZCO0FBQzVCLFdBQU82RCxXQUFXQyxNQUFYLENBQWtCQyxLQUFsQixDQUF3QmdDLFdBQXhCLENBQW9DaEcsRUFBRW1FLFFBQXRDLEVBQWdEO0FBQUU4QixhQUFRO0FBQUVoRyxnQkFBVTtBQUFaO0FBQVYsS0FBaEQsQ0FBUDtBQUNBO0FBQ0Q7QUFDRDs7QUF6V29DLEM7Ozs7Ozs7Ozs7O0FDUnRDLElBQUkrRyxTQUFKO0FBQWM5SyxPQUFPSSxLQUFQLENBQWFDLFFBQVEsNEJBQVIsQ0FBYixFQUFtRDtBQUFDeUssWUFBVXhLLENBQVYsRUFBWTtBQUFDd0ssZ0JBQVV4SyxDQUFWO0FBQVk7O0FBQTFCLENBQW5ELEVBQStFLENBQS9FO0FBQWtGLElBQUlKLGVBQUo7QUFBb0JGLE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSxTQUFSLENBQWIsRUFBZ0M7QUFBQ0gsa0JBQWdCSSxDQUFoQixFQUFrQjtBQUFDSixzQkFBZ0JJLENBQWhCO0FBQWtCOztBQUF0QyxDQUFoQyxFQUF3RSxDQUF4RTtBQUEyRSxJQUFJSSxXQUFKO0FBQWdCVixPQUFPSSxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNLLGNBQVlKLENBQVosRUFBYztBQUFDSSxrQkFBWUosQ0FBWjtBQUFjOztBQUE5QixDQUFuQyxFQUFtRSxDQUFuRTtBQUkvTXdLLFVBQVVDLEdBQVYsQ0FBYyxJQUFJN0ssZUFBSixFQUFkLEVBQXFDUSxXQUFyQyxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2ltcG9ydGVyLWNzdi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEltcG9ydGVySW5mbyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIENzdkltcG9ydGVySW5mbyBleHRlbmRzIEltcG9ydGVySW5mbyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdjc3YnLCAnQ1NWJywgJ2FwcGxpY2F0aW9uL3ppcCcsIFt7XG5cdFx0XHR0ZXh0OiAnSW1wb3J0ZXJfQ1NWX0luZm9ybWF0aW9uJyxcblx0XHRcdGhyZWY6ICdodHRwczovL3JvY2tldC5jaGF0L2RvY3MvYWRtaW5pc3RyYXRvci1ndWlkZXMvaW1wb3J0L2Nzdi8nXG5cdFx0fV0pO1xuXHR9XG59XG4iLCJpbXBvcnQge1xuXHRCYXNlLFxuXHRQcm9ncmVzc1N0ZXAsXG5cdFNlbGVjdGlvbixcblx0U2VsZWN0aW9uQ2hhbm5lbCxcblx0U2VsZWN0aW9uVXNlclxufSBmcm9tICdtZXRlb3Ivcm9ja2V0Y2hhdDppbXBvcnRlcic7XG5cbmV4cG9ydCBjbGFzcyBDc3ZJbXBvcnRlciBleHRlbmRzIEJhc2Uge1xuXHRjb25zdHJ1Y3RvcihpbmZvKSB7XG5cdFx0c3VwZXIoaW5mbyk7XG5cblx0XHR0aGlzLmNzdlBhcnNlciA9IE5wbS5yZXF1aXJlKCdjc3YtcGFyc2UvbGliL3N5bmMnKTtcblx0XHR0aGlzLm1lc3NhZ2VzID0gbmV3IE1hcCgpO1xuXHR9XG5cblx0cHJlcGFyZShkYXRhVVJJLCBzZW50Q29udGVudFR5cGUsIGZpbGVOYW1lKSB7XG5cdFx0c3VwZXIucHJlcGFyZShkYXRhVVJJLCBzZW50Q29udGVudFR5cGUsIGZpbGVOYW1lKTtcblxuXHRcdGNvbnN0IHVyaVJlc3VsdCA9IFJvY2tldENoYXRGaWxlLmRhdGFVUklQYXJzZShkYXRhVVJJKTtcblx0XHRjb25zdCB6aXAgPSBuZXcgdGhpcy5BZG1aaXAobmV3IEJ1ZmZlcih1cmlSZXN1bHQuaW1hZ2UsICdiYXNlNjQnKSk7XG5cdFx0Y29uc3QgemlwRW50cmllcyA9IHppcC5nZXRFbnRyaWVzKCk7XG5cblx0XHRsZXQgdGVtcENoYW5uZWxzID0gW107XG5cdFx0bGV0IHRlbXBVc2VycyA9IFtdO1xuXHRcdGNvbnN0IHRlbXBNZXNzYWdlcyA9IG5ldyBNYXAoKTtcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHppcEVudHJpZXMpIHtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBFbnRyeTogJHsgZW50cnkuZW50cnlOYW1lIH1gKTtcblxuXHRcdFx0Ly9JZ25vcmUgYW55dGhpbmcgdGhhdCBoYXMgYF9fTUFDT1NYYCBpbiBpdCdzIG5hbWUsIGFzIHNhZGx5IHRoZXNlIHRoaW5ncyBzZWVtIHRvIG1lc3MgZXZlcnl0aGluZyB1cFxuXHRcdFx0aWYgKGVudHJ5LmVudHJ5TmFtZS5pbmRleE9mKCdfX01BQ09TWCcpID4gLTEpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYElnbm9yaW5nIHRoZSBmaWxlOiAkeyBlbnRyeS5lbnRyeU5hbWUgfWApO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly9EaXJlY3RvcmllcyBhcmUgaWdub3JlZCwgc2luY2UgdGhleSBhcmUgXCJ2aXJ0dWFsXCIgaW4gYSB6aXAgZmlsZVxuXHRcdFx0aWYgKGVudHJ5LmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBJZ25vcmluZyB0aGUgZGlyZWN0b3J5IGVudHJ5OiAkeyBlbnRyeS5lbnRyeU5hbWUgfWApO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly9QYXJzZSB0aGUgY2hhbm5lbHNcblx0XHRcdGlmIChlbnRyeS5lbnRyeU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NoYW5uZWxzLmNzdicpIHtcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLlBSRVBBUklOR19DSEFOTkVMUyk7XG5cdFx0XHRcdGNvbnN0IHBhcnNlZENoYW5uZWxzID0gdGhpcy5jc3ZQYXJzZXIoZW50cnkuZ2V0RGF0YSgpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR0ZW1wQ2hhbm5lbHMgPSBwYXJzZWRDaGFubmVscy5tYXAoKGMpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0aWQ6IGNbMF0udHJpbSgpLnJlcGxhY2UoJy4nLCAnXycpLFxuXHRcdFx0XHRcdFx0bmFtZTogY1swXS50cmltKCksXG5cdFx0XHRcdFx0XHRjcmVhdG9yOiBjWzFdLnRyaW0oKSxcblx0XHRcdFx0XHRcdGlzUHJpdmF0ZTogY1syXS50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gJ3ByaXZhdGUnID8gdHJ1ZSA6IGZhbHNlLFxuXHRcdFx0XHRcdFx0bWVtYmVyczogY1szXS50cmltKCkuc3BsaXQoJzsnKS5tYXAoKG0pID0+IG0udHJpbSgpKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly9QYXJzZSB0aGUgdXNlcnNcblx0XHRcdGlmIChlbnRyeS5lbnRyeU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3VzZXJzLmNzdicpIHtcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLlBSRVBBUklOR19VU0VSUyk7XG5cdFx0XHRcdGNvbnN0IHBhcnNlZFVzZXJzID0gdGhpcy5jc3ZQYXJzZXIoZW50cnkuZ2V0RGF0YSgpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR0ZW1wVXNlcnMgPSBwYXJzZWRVc2Vycy5tYXAoKHUpID0+IHsgcmV0dXJuIHsgaWQ6IHVbMF0udHJpbSgpLnJlcGxhY2UoJy4nLCAnXycpLCB1c2VybmFtZTogdVswXS50cmltKCksIGVtYWlsOiB1WzFdLnRyaW0oKSwgbmFtZTogdVsyXS50cmltKCkgfTsgfSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvL1BhcnNlIHRoZSBtZXNzYWdlc1xuXHRcdFx0aWYgKGVudHJ5LmVudHJ5TmFtZS5pbmRleE9mKCcvJykgPiAtMSkge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gZW50cnkuZW50cnlOYW1lLnNwbGl0KCcvJyk7IC8vcmFuZG9tL21lc3NhZ2VzLmNzdlxuXHRcdFx0XHRjb25zdCBjaGFubmVsTmFtZSA9IGl0ZW1bMF07IC8vcmFuZG9tXG5cdFx0XHRcdGNvbnN0IG1zZ0dyb3VwRGF0YSA9IGl0ZW1bMV0uc3BsaXQoJy4nKVswXTsgLy8yMDE1LTEwLTA0XG5cblx0XHRcdFx0aWYgKCF0ZW1wTWVzc2FnZXMuZ2V0KGNoYW5uZWxOYW1lKSkge1xuXHRcdFx0XHRcdHRlbXBNZXNzYWdlcy5zZXQoY2hhbm5lbE5hbWUsIG5ldyBNYXAoKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgbXNncyA9IFtdO1xuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0bXNncyA9IHRoaXMuY3N2UGFyc2VyKGVudHJ5LmdldERhdGEoKS50b1N0cmluZygpKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYFRoZSBmaWxlICR7IGVudHJ5LmVudHJ5TmFtZSB9IGNvbnRhaW5zIGludmFsaWQgc3ludGF4YCwgZSk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0ZW1wTWVzc2FnZXMuZ2V0KGNoYW5uZWxOYW1lKS5zZXQobXNnR3JvdXBEYXRhLCBtc2dzLm1hcCgobSkgPT4geyByZXR1cm4geyB1c2VybmFtZTogbVswXSwgdHM6IG1bMV0sIHRleHQ6IG1bMl0gfTsgfSkpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJbnNlcnQgdGhlIHVzZXJzIHJlY29yZCwgZXZlbnR1YWxseSB0aGlzIG1pZ2h0IGhhdmUgdG8gYmUgc3BsaXQgaW50byBzZXZlcmFsIG9uZXMgYXMgd2VsbFxuXHRcdC8vIGlmIHNvbWVvbmUgdHJpZXMgdG8gaW1wb3J0IGEgc2V2ZXJhbCB0aG91c2FuZHMgdXNlcnMgaW5zdGFuY2Vcblx0XHRjb25zdCB1c2Vyc0lkID0gdGhpcy5jb2xsZWN0aW9uLmluc2VydCh7ICdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsICdpbXBvcnRlcic6IHRoaXMubmFtZSwgJ3R5cGUnOiAndXNlcnMnLCAndXNlcnMnOiB0ZW1wVXNlcnMgfSk7XG5cdFx0dGhpcy51c2VycyA9IHRoaXMuY29sbGVjdGlvbi5maW5kT25lKHVzZXJzSWQpO1xuXHRcdHN1cGVyLnVwZGF0ZVJlY29yZCh7ICdjb3VudC51c2Vycyc6IHRlbXBVc2Vycy5sZW5ndGggfSk7XG5cdFx0c3VwZXIuYWRkQ291bnRUb1RvdGFsKHRlbXBVc2Vycy5sZW5ndGgpO1xuXG5cdFx0Ly8gSW5zZXJ0IHRoZSBjaGFubmVscyByZWNvcmRzLlxuXHRcdGNvbnN0IGNoYW5uZWxzSWQgPSB0aGlzLmNvbGxlY3Rpb24uaW5zZXJ0KHsgJ2ltcG9ydCc6IHRoaXMuaW1wb3J0UmVjb3JkLl9pZCwgJ2ltcG9ydGVyJzogdGhpcy5uYW1lLCAndHlwZSc6ICdjaGFubmVscycsICdjaGFubmVscyc6IHRlbXBDaGFubmVscyB9KTtcblx0XHR0aGlzLmNoYW5uZWxzID0gdGhpcy5jb2xsZWN0aW9uLmZpbmRPbmUoY2hhbm5lbHNJZCk7XG5cdFx0c3VwZXIudXBkYXRlUmVjb3JkKHsgJ2NvdW50LmNoYW5uZWxzJzogdGVtcENoYW5uZWxzLmxlbmd0aCB9KTtcblx0XHRzdXBlci5hZGRDb3VudFRvVG90YWwodGVtcENoYW5uZWxzLmxlbmd0aCk7XG5cblx0XHQvLyBTYXZlIHRoZSBtZXNzYWdlcyByZWNvcmRzIHRvIHRoZSBpbXBvcnQgcmVjb3JkIGZvciBgc3RhcnRJbXBvcnRgIHVzYWdlXG5cdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLlBSRVBBUklOR19NRVNTQUdFUyk7XG5cdFx0bGV0IG1lc3NhZ2VzQ291bnQgPSAwO1xuXHRcdGZvciAoY29uc3QgW2NoYW5uZWwsIG1lc3NhZ2VzTWFwXSBvZiB0ZW1wTWVzc2FnZXMuZW50cmllcygpKSB7XG5cdFx0XHRpZiAoIXRoaXMubWVzc2FnZXMuZ2V0KGNoYW5uZWwpKSB7XG5cdFx0XHRcdHRoaXMubWVzc2FnZXMuc2V0KGNoYW5uZWwsIG5ldyBNYXAoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgW21zZ0dyb3VwRGF0YSwgbXNnc10gb2YgbWVzc2FnZXNNYXAuZW50cmllcygpKSB7XG5cdFx0XHRcdG1lc3NhZ2VzQ291bnQgKz0gbXNncy5sZW5ndGg7XG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVJlY29yZCh7ICdtZXNzYWdlc3N0YXR1cyc6IGAkeyBjaGFubmVsIH0vJHsgbXNnR3JvdXBEYXRhIH1gIH0pO1xuXG5cdFx0XHRcdGlmIChCYXNlLmdldEJTT05TaXplKG1zZ3MpID4gQmFzZS5nZXRNYXhCU09OU2l6ZSgpKSB7XG5cdFx0XHRcdFx0QmFzZS5nZXRCU09OU2FmZUFycmF5c0Zyb21BbkFycmF5KG1zZ3MpLmZvckVhY2goKHNwbGl0TXNnLCBpKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlc0lkID0gdGhpcy5jb2xsZWN0aW9uLmluc2VydCh7ICdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsICdpbXBvcnRlcic6IHRoaXMubmFtZSwgJ3R5cGUnOiAnbWVzc2FnZXMnLCAnbmFtZSc6IGAkeyBjaGFubmVsIH0vJHsgbXNnR3JvdXBEYXRhIH0uJHsgaSB9YCwgJ21lc3NhZ2VzJzogc3BsaXRNc2cgfSk7XG5cdFx0XHRcdFx0XHR0aGlzLm1lc3NhZ2VzLmdldChjaGFubmVsKS5zZXQoYCR7IG1zZ0dyb3VwRGF0YSB9LiR7IGkgfWAsIHRoaXMuY29sbGVjdGlvbi5maW5kT25lKG1lc3NhZ2VzSWQpKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlc0lkID0gdGhpcy5jb2xsZWN0aW9uLmluc2VydCh7ICdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsICdpbXBvcnRlcic6IHRoaXMubmFtZSwgJ3R5cGUnOiAnbWVzc2FnZXMnLCAnbmFtZSc6IGAkeyBjaGFubmVsIH0vJHsgbXNnR3JvdXBEYXRhIH1gLCAnbWVzc2FnZXMnOiBtc2dzIH0pO1xuXHRcdFx0XHRcdHRoaXMubWVzc2FnZXMuZ2V0KGNoYW5uZWwpLnNldChtc2dHcm91cERhdGEsIHRoaXMuY29sbGVjdGlvbi5maW5kT25lKG1lc3NhZ2VzSWQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHN1cGVyLnVwZGF0ZVJlY29yZCh7ICdjb3VudC5tZXNzYWdlcyc6IG1lc3NhZ2VzQ291bnQsICdtZXNzYWdlc3N0YXR1cyc6IG51bGwgfSk7XG5cdFx0c3VwZXIuYWRkQ291bnRUb1RvdGFsKG1lc3NhZ2VzQ291bnQpO1xuXG5cdFx0Ly9FbnN1cmUgd2UgaGF2ZSBhdCBsZWFzdCBhIHNpbmdsZSB1c2VyLCBjaGFubmVsLCBvciBtZXNzYWdlXG5cdFx0aWYgKHRlbXBVc2Vycy5sZW5ndGggPT09IDAgJiYgdGVtcENoYW5uZWxzLmxlbmd0aCA9PT0gMCAmJiBtZXNzYWdlc0NvdW50ID09PSAwKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5lcnJvcignTm8gdXNlcnMsIGNoYW5uZWxzLCBvciBtZXNzYWdlcyBmb3VuZCBpbiB0aGUgaW1wb3J0IGZpbGUuJyk7XG5cdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRVJST1IpO1xuXHRcdFx0cmV0dXJuIHN1cGVyLmdldFByb2dyZXNzKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uVXNlcnMgPSB0ZW1wVXNlcnMubWFwKCh1KSA9PiBuZXcgU2VsZWN0aW9uVXNlcih1LmlkLCB1LnVzZXJuYW1lLCB1LmVtYWlsLCBmYWxzZSwgZmFsc2UsIHRydWUpKTtcblx0XHRjb25zdCBzZWxlY3Rpb25DaGFubmVscyA9IHRlbXBDaGFubmVscy5tYXAoKGMpID0+IG5ldyBTZWxlY3Rpb25DaGFubmVsKGMuaWQsIGMubmFtZSwgZmFsc2UsIHRydWUsIGMuaXNQcml2YXRlKSk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uTWVzc2FnZXMgPSB0aGlzLmltcG9ydFJlY29yZC5jb3VudC5tZXNzYWdlcztcblxuXHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5VU0VSX1NFTEVDVElPTik7XG5cdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24odGhpcy5uYW1lLCBzZWxlY3Rpb25Vc2Vycywgc2VsZWN0aW9uQ2hhbm5lbHMsIHNlbGVjdGlvbk1lc3NhZ2VzKTtcblx0fVxuXG5cdHN0YXJ0SW1wb3J0KGltcG9ydFNlbGVjdGlvbikge1xuXHRcdHN1cGVyLnN0YXJ0SW1wb3J0KGltcG9ydFNlbGVjdGlvbik7XG5cdFx0Y29uc3Qgc3RhcnRlZCA9IERhdGUubm93KCk7XG5cblx0XHQvL0Vuc3VyZSB3ZSdyZSBvbmx5IGdvaW5nIHRvIGltcG9ydCB0aGUgdXNlcnMgdGhhdCB0aGUgdXNlciBoYXMgc2VsZWN0ZWRcblx0XHRmb3IgKGNvbnN0IHVzZXIgb2YgaW1wb3J0U2VsZWN0aW9uLnVzZXJzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHUgb2YgdGhpcy51c2Vycy51c2Vycykge1xuXHRcdFx0XHRpZiAodS5pZCA9PT0gdXNlci51c2VyX2lkKSB7XG5cdFx0XHRcdFx0dS5kb19pbXBvcnQgPSB1c2VyLmRvX2ltcG9ydDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLmNvbGxlY3Rpb24udXBkYXRlKHsgX2lkOiB0aGlzLnVzZXJzLl9pZCB9LCB7ICRzZXQ6IHsgJ3VzZXJzJzogdGhpcy51c2Vycy51c2VycyB9fSk7XG5cblx0XHQvL0Vuc3VyZSB3ZSdyZSBvbmx5IGltcG9ydGluZyB0aGUgY2hhbm5lbHMgdGhlIHVzZXIgaGFzIHNlbGVjdGVkLlxuXHRcdGZvciAoY29uc3QgY2hhbm5lbCBvZiBpbXBvcnRTZWxlY3Rpb24uY2hhbm5lbHMpIHtcblx0XHRcdGZvciAoY29uc3QgYyBvZiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzKSB7XG5cdFx0XHRcdGlmIChjLmlkID09PSBjaGFubmVsLmNoYW5uZWxfaWQpIHtcblx0XHRcdFx0XHRjLmRvX2ltcG9ydCA9IGNoYW5uZWwuZG9faW1wb3J0O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuY29sbGVjdGlvbi51cGRhdGUoeyBfaWQ6IHRoaXMuY2hhbm5lbHMuX2lkIH0sIHsgJHNldDogeyAnY2hhbm5lbHMnOiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzIH19KTtcblxuXHRcdGNvbnN0IHN0YXJ0ZWRCeVVzZXJJZCA9IE1ldGVvci51c2VySWQoKTtcblx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLklNUE9SVElOR19VU0VSUyk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vSW1wb3J0IHRoZSB1c2Vyc1xuXHRcdFx0XHRmb3IgKGNvbnN0IHUgb2YgdGhpcy51c2Vycy51c2Vycykge1xuXHRcdFx0XHRcdGlmICghdS5kb19pbXBvcnQpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIoc3RhcnRlZEJ5VXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRsZXQgZXhpc3RhbnRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5RW1haWxBZGRyZXNzKHUuZW1haWwpO1xuXG5cdFx0XHRcdFx0XHQvL0lmIHdlIGNvdWxkbid0IGZpbmQgb25lIGJ5IHRoZWlyIGVtYWlsIGFkZHJlc3MsIHRyeSB0byBmaW5kIGFuIGV4aXN0aW5nIHVzZXIgYnkgdGhlaXIgdXNlcm5hbWVcblx0XHRcdFx0XHRcdGlmICghZXhpc3RhbnRVc2VyKSB7XG5cdFx0XHRcdFx0XHRcdGV4aXN0YW50VXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeVVzZXJuYW1lKHUudXNlcm5hbWUpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAoZXhpc3RhbnRVc2VyKSB7XG5cdFx0XHRcdFx0XHRcdC8vc2luY2Ugd2UgaGF2ZSBhbiBleGlzdGluZyB1c2VyLCBsZXQncyB0cnkgYSBmZXcgdGhpbmdzXG5cdFx0XHRcdFx0XHRcdHUucm9ja2V0SWQgPSBleGlzdGFudFVzZXIuX2lkO1xuXHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy51cGRhdGUoeyBfaWQ6IHUucm9ja2V0SWQgfSwgeyAkYWRkVG9TZXQ6IHsgaW1wb3J0SWRzOiB1LmlkIH0gfSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB1c2VySWQgPSBBY2NvdW50cy5jcmVhdGVVc2VyKHsgZW1haWw6IHUuZW1haWwsIHBhc3N3b3JkOiBEYXRlLm5vdygpICsgdS5uYW1lICsgdS5lbWFpbC50b1VwcGVyQ2FzZSgpIH0pO1xuXHRcdFx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKHVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdE1ldGVvci5jYWxsKCdzZXRVc2VybmFtZScsIHUudXNlcm5hbWUsIHtqb2luRGVmYXVsdENoYW5uZWxzU2lsZW5jZWQ6IHRydWV9KTtcblx0XHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5zZXROYW1lKHVzZXJJZCwgdS5uYW1lKTtcblx0XHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy51cGRhdGUoeyBfaWQ6IHVzZXJJZCB9LCB7ICRhZGRUb1NldDogeyBpbXBvcnRJZHM6IHUuaWQgfSB9KTtcblx0XHRcdFx0XHRcdFx0XHR1LnJvY2tldElkID0gdXNlcklkO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0c3VwZXIuYWRkQ291bnRDb21wbGV0ZWQoMSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5jb2xsZWN0aW9uLnVwZGF0ZSh7IF9pZDogdGhpcy51c2Vycy5faWQgfSwgeyAkc2V0OiB7ICd1c2Vycyc6IHRoaXMudXNlcnMudXNlcnMgfX0pO1xuXG5cdFx0XHRcdC8vSW1wb3J0IHRoZSBjaGFubmVsc1xuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuSU1QT1JUSU5HX0NIQU5ORUxTKTtcblx0XHRcdFx0Zm9yIChjb25zdCBjIG9mIHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMpIHtcblx0XHRcdFx0XHRpZiAoIWMuZG9faW1wb3J0KSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKHN0YXJ0ZWRCeVVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgZXhpc3RhbnRSb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5TmFtZShjLm5hbWUpO1xuXHRcdFx0XHRcdFx0Ly9JZiB0aGUgcm9vbSBleGlzdHMgb3IgdGhlIG5hbWUgb2YgaXQgaXMgJ2dlbmVyYWwnLCB0aGVuIHdlIGRvbid0IG5lZWQgdG8gY3JlYXRlIGl0IGFnYWluXG5cdFx0XHRcdFx0XHRpZiAoZXhpc3RhbnRSb29tIHx8IGMubmFtZS50b1VwcGVyQ2FzZSgpID09PSAnR0VORVJBTCcpIHtcblx0XHRcdFx0XHRcdFx0Yy5yb2NrZXRJZCA9IGMubmFtZS50b1VwcGVyQ2FzZSgpID09PSAnR0VORVJBTCcgPyAnR0VORVJBTCcgOiBleGlzdGFudFJvb20uX2lkO1xuXHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy51cGRhdGUoeyBfaWQ6IGMucm9ja2V0SWQgfSwgeyAkYWRkVG9TZXQ6IHsgaW1wb3J0SWRzOiBjLmlkIH0gfSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL0ZpbmQgdGhlIHJvY2tldGNoYXRJZCBvZiB0aGUgdXNlciB3aG8gY3JlYXRlZCB0aGlzIGNoYW5uZWxcblx0XHRcdFx0XHRcdFx0bGV0IGNyZWF0b3JJZCA9IHN0YXJ0ZWRCeVVzZXJJZDtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCB1IG9mIHRoaXMudXNlcnMudXNlcnMpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAodS51c2VybmFtZSA9PT0gYy5jcmVhdG9yICYmIHUuZG9faW1wb3J0KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjcmVhdG9ySWQgPSB1LnJvY2tldElkO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdC8vQ3JlYXRlIHRoZSBjaGFubmVsXG5cdFx0XHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIoY3JlYXRvcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgcm9vbUluZm8gPSBNZXRlb3IuY2FsbChjLmlzUHJpdmF0ZSA/ICdjcmVhdGVQcml2YXRlR3JvdXAnIDogJ2NyZWF0ZUNoYW5uZWwnLCBjLm5hbWUsIGMubWVtYmVycyk7XG5cdFx0XHRcdFx0XHRcdFx0Yy5yb2NrZXRJZCA9IHJvb21JbmZvLnJpZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudXBkYXRlKHsgX2lkOiBjLnJvY2tldElkIH0sIHsgJGFkZFRvU2V0OiB7IGltcG9ydElkczogYy5pZCB9IH0pO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRzdXBlci5hZGRDb3VudENvbXBsZXRlZCgxKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmNvbGxlY3Rpb24udXBkYXRlKHsgX2lkOiB0aGlzLmNoYW5uZWxzLl9pZCB9LCB7ICRzZXQ6IHsgJ2NoYW5uZWxzJzogdGhpcy5jaGFubmVscy5jaGFubmVscyB9fSk7XG5cblx0XHRcdFx0Ly9JZiBubyBjaGFubmVscyBmaWxlLCBjb2xsZWN0IGNoYW5uZWwgbWFwIGZyb20gREIgZm9yIG1lc3NhZ2Utb25seSBpbXBvcnRcblx0XHRcdFx0aWYgKHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjbmFtZSBvZiB0aGlzLm1lc3NhZ2VzLmtleXMoKSkge1xuXHRcdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcihzdGFydGVkQnlVc2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZXhpc3RhbnRSb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5TmFtZShjbmFtZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChleGlzdGFudFJvb20gfHwgY25hbWUudG9VcHBlckNhc2UoKSA9PT0gJ0dFTkVSQUwnKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5jaGFubmVscy5jaGFubmVscy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiBjbmFtZS5yZXBsYWNlKCcuJywgJ18nKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6IGNuYW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0cm9ja2V0SWQ6IChjbmFtZS50b1VwcGVyQ2FzZSgpID09PSAnR0VORVJBTCcgPyAnR0VORVJBTCcgOiBleGlzdGFudFJvb20uX2lkKSxcblx0XHRcdFx0XHRcdFx0XHRcdGRvX2ltcG9ydDogdHJ1ZVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL0lmIG5vIHVzZXJzIGZpbGUsIGNvbGxlY3QgdXNlciBtYXAgZnJvbSBEQiBmb3IgbWVzc2FnZS1vbmx5IGltcG9ydFxuXHRcdFx0XHRpZiAodGhpcy51c2Vycy51c2Vycy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IFtjaCwgbWVzc2FnZXNNYXBdIG9mIHRoaXMubWVzc2FnZXMuZW50cmllcygpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjc3ZDaGFubmVsID0gdGhpcy5nZXRDaGFubmVsRnJvbU5hbWUoY2gpO1xuXHRcdFx0XHRcdFx0aWYgKCFjc3ZDaGFubmVsIHx8ICFjc3ZDaGFubmVsLmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIoc3RhcnRlZEJ5VXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgbXNncyBvZiBtZXNzYWdlc01hcC52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgbXNnIG9mIG1zZ3MubWVzc2FnZXMpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmICghdGhpcy5nZXRVc2VyRnJvbVVzZXJuYW1lKG1zZy51c2VybmFtZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeVVzZXJuYW1lKG1zZy51c2VybmFtZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICh1c2VyKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy51c2Vycy51c2Vycy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJvY2tldElkOiB1c2VyLl9pZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vSW1wb3J0IHRoZSBNZXNzYWdlc1xuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuSU1QT1JUSU5HX01FU1NBR0VTKTtcblx0XHRcdFx0Zm9yIChjb25zdCBbY2gsIG1lc3NhZ2VzTWFwXSBvZiB0aGlzLm1lc3NhZ2VzLmVudHJpZXMoKSkge1xuXHRcdFx0XHRcdGNvbnN0IGNzdkNoYW5uZWwgPSB0aGlzLmdldENoYW5uZWxGcm9tTmFtZShjaCk7XG5cdFx0XHRcdFx0aWYgKCFjc3ZDaGFubmVsIHx8ICFjc3ZDaGFubmVsLmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKGNzdkNoYW5uZWwucm9ja2V0SWQsIHsgZmllbGRzOiB7IHVzZXJuYW1lczogMSwgdDogMSwgbmFtZTogMSB9IH0pO1xuXHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIoc3RhcnRlZEJ5VXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB0aW1lc3RhbXBzID0ge307XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IFttc2dHcm91cERhdGEsIG1zZ3NdIG9mIG1lc3NhZ2VzTWFwLmVudHJpZXMoKSkge1xuXHRcdFx0XHRcdFx0XHRzdXBlci51cGRhdGVSZWNvcmQoeyAnbWVzc2FnZXNzdGF0dXMnOiBgJHsgY2ggfS8keyBtc2dHcm91cERhdGEgfS4keyBtc2dzLm1lc3NhZ2VzLmxlbmd0aCB9YCB9KTtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBtc2cgb2YgbXNncy5tZXNzYWdlcykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpc05hTihuZXcgRGF0ZShwYXJzZUludChtc2cudHMpKSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYFRpbWVzdGFtcCBvbiBhIG1lc3NhZ2UgaW4gJHsgY2ggfS8keyBtc2dHcm91cERhdGEgfSBpcyBpbnZhbGlkYCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRzdXBlci5hZGRDb3VudENvbXBsZXRlZCgxKTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNyZWF0b3IgPSB0aGlzLmdldFVzZXJGcm9tVXNlcm5hbWUobXNnLnVzZXJuYW1lKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoY3JlYXRvcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0bGV0IHN1ZmZpeCA9ICcnO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHRpbWVzdGFtcHNbbXNnLnRzXSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRpbWVzdGFtcHNbbXNnLnRzXSA9IDE7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRzdWZmaXggPSBgLSR7IHRpbWVzdGFtcHNbbXNnLnRzXSB9YDtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dGltZXN0YW1wc1ttc2cudHNdICs9IDE7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBtc2dPYmogPSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdF9pZDogYGNzdi0keyBjc3ZDaGFubmVsLmlkIH0tJHsgbXNnLnRzIH0keyBzdWZmaXggfWAsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRzOiBuZXcgRGF0ZShwYXJzZUludChtc2cudHMpKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0bXNnOiBtc2cudGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmlkOiByb29tLl9pZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0dToge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdF9pZDogY3JlYXRvci5faWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcm5hbWU6IGNyZWF0b3IudXNlcm5hbWVcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5zZW5kTWVzc2FnZShjcmVhdG9yLCBtc2dPYmosIHJvb20sIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdHN1cGVyLmFkZENvdW50Q29tcGxldGVkKDEpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRklOSVNISU5HKTtcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLkRPTkUpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihlKTtcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLkVSUk9SKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdGltZVRvb2sgPSBEYXRlLm5vdygpIC0gc3RhcnRlZDtcblx0XHRcdHRoaXMubG9nZ2VyLmxvZyhgQ1NWIEltcG9ydCB0b29rICR7IHRpbWVUb29rIH0gbWlsbGlzZWNvbmRzLmApO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHN1cGVyLmdldFByb2dyZXNzKCk7XG5cdH1cblxuXHRnZXRTZWxlY3Rpb24oKSB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uVXNlcnMgPSB0aGlzLnVzZXJzLnVzZXJzLm1hcCgodSkgPT4gbmV3IFNlbGVjdGlvblVzZXIodS5pZCwgdS51c2VybmFtZSwgdS5lbWFpbCwgZmFsc2UsIGZhbHNlLCB0cnVlKSk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uQ2hhbm5lbHMgPSB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzLm1hcCgoYykgPT4gbmV3IFNlbGVjdGlvbkNoYW5uZWwoYy5pZCwgYy5uYW1lLCBmYWxzZSwgdHJ1ZSwgYy5pc1ByaXZhdGUpKTtcblx0XHRjb25zdCBzZWxlY3Rpb25NZXNzYWdlcyA9IHRoaXMuaW1wb3J0UmVjb3JkLmNvdW50Lm1lc3NhZ2VzO1xuXG5cdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb24odGhpcy5uYW1lLCBzZWxlY3Rpb25Vc2Vycywgc2VsZWN0aW9uQ2hhbm5lbHMsIHNlbGVjdGlvbk1lc3NhZ2VzKTtcblx0fVxuXG5cdGdldENoYW5uZWxGcm9tTmFtZShjaGFubmVsTmFtZSkge1xuXHRcdGZvciAoY29uc3QgY2ggb2YgdGhpcy5jaGFubmVscy5jaGFubmVscykge1xuXHRcdFx0aWYgKGNoLm5hbWUgPT09IGNoYW5uZWxOYW1lKSB7XG5cdFx0XHRcdHJldHVybiBjaDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRVc2VyRnJvbVVzZXJuYW1lKHVzZXJuYW1lKSB7XG5cdFx0Zm9yIChjb25zdCB1IG9mIHRoaXMudXNlcnMudXNlcnMpIHtcblx0XHRcdGlmICh1LnVzZXJuYW1lID09PSB1c2VybmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQodS5yb2NrZXRJZCwgeyBmaWVsZHM6IHsgdXNlcm5hbWU6IDEgfX0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgSW1wb3J0ZXJzIH0gZnJvbSAnbWV0ZW9yL3JvY2tldGNoYXQ6aW1wb3J0ZXInO1xuaW1wb3J0IHsgQ3N2SW1wb3J0ZXJJbmZvIH0gZnJvbSAnLi4vaW5mbyc7XG5pbXBvcnQgeyBDc3ZJbXBvcnRlciB9IGZyb20gJy4vaW1wb3J0ZXInO1xuXG5JbXBvcnRlcnMuYWRkKG5ldyBDc3ZJbXBvcnRlckluZm8oKSwgQ3N2SW1wb3J0ZXIpO1xuIl19
