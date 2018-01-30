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

/* Package-scope variables */
var message;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:importer-hipchat":{"info.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/rocketchat_importer-hipchat/info.js                                                         //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
module.export({
	HipChatImporterInfo: () => HipChatImporterInfo
});
let ImporterInfo;
module.watch(require("meteor/rocketchat:importer"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 0);

class HipChatImporterInfo extends ImporterInfo {
	constructor() {
		super('hipchat', 'HipChat', 'application/zip');
	}

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server":{"importer.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/rocketchat_importer-hipchat/server/importer.js                                              //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
module.export({
	HipChatImporter: () => HipChatImporter
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

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 1);
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 2);
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 3);
module.watch(require("moment-timezone"));

class HipChatImporter extends Base {
	constructor(info) {
		super(info);
		this.userTags = [];
		this.roomPrefix = 'hipchat_export/rooms/';
		this.usersPrefix = 'hipchat_export/users/';
	}

	prepare(dataURI, sentContentType, fileName) {
		super.prepare(dataURI, sentContentType, fileName);
		const image = RocketChatFile.dataURIParse(dataURI).image; // const contentType = ref.contentType;

		const zip = new this.AdmZip(new Buffer(image, 'base64'));
		const zipEntries = zip.getEntries();
		const tempRooms = [];
		let tempUsers = [];
		const tempMessages = {};
		zipEntries.forEach(entry => {
			if (entry.entryName.indexOf('__MACOSX') > -1) {
				this.logger.debug(`Ignoring the file: ${entry.entryName}`);
			}

			if (entry.isDirectory) {
				return;
			}

			if (entry.entryName.indexOf(this.roomPrefix) > -1) {
				let roomName = entry.entryName.split(this.roomPrefix)[1];

				if (roomName === 'list.json') {
					super.updateProgress(ProgressStep.PREPARING_CHANNELS);
					const tempRooms = JSON.parse(entry.getData().toString()).rooms;
					tempRooms.forEach(room => {
						room.name = s.slugify(room.name);
					});
				} else if (roomName.indexOf('/') > -1) {
					const item = roomName.split('/');
					roomName = s.slugify(item[0]);
					const msgGroupData = item[1].split('.')[0];

					if (!tempMessages[roomName]) {
						tempMessages[roomName] = {};
					}

					try {
						return tempMessages[roomName][msgGroupData] = JSON.parse(entry.getData().toString());
					} catch (error) {
						return this.logger.warn(`${entry.entryName} is not a valid JSON file! Unable to import it.`);
					}
				}
			} else if (entry.entryName.indexOf(this.usersPrefix) > -1) {
				const usersName = entry.entryName.split(this.usersPrefix)[1];

				if (usersName === 'list.json') {
					super.updateProgress(ProgressStep.PREPARING_USERS);
					return tempUsers = JSON.parse(entry.getData().toString()).users;
				} else {
					return this.logger.warn(`Unexpected file in the ${this.name} import: ${entry.entryName}`);
				}
			}
		});
		const usersId = this.collection.insert({
			'import': this.importRecord._id,
			'importer': this.name,
			'type': 'users',
			'users': tempUsers
		});
		this.users = this.collection.findOne(usersId);
		this.updateRecord({
			'count.users': tempUsers.length
		});
		this.addCountToTotal(tempUsers.length);
		const channelsId = this.collection.insert({
			'import': this.importRecord._id,
			'importer': this.name,
			'type': 'channels',
			'channels': tempRooms
		});
		this.channels = this.collection.findOne(channelsId);
		this.updateRecord({
			'count.channels': tempRooms.length
		});
		this.addCountToTotal(tempRooms.length);
		super.updateProgress(ProgressStep.PREPARING_MESSAGES);
		let messagesCount = 0;
		Object.keys(tempMessages).forEach(channel => {
			const messagesObj = tempMessages[channel];
			this.messages[channel] = this.messages[channel] || {};
			Object.keys(messagesObj).forEach(date => {
				const msgs = messagesObj[date];
				messagesCount += msgs.length;
				this.updateRecord({
					'messagesstatus': `${channel}/${date}`
				});

				if (Base.getBSONSize(msgs) > Base.getMaxBSONSize()) {
					Base.getBSONSafeArraysFromAnArray(msgs).forEach((splitMsg, i) => {
						const messagesId = this.collection.insert({
							'import': this.importRecord._id,
							'importer': this.name,
							'type': 'messages',
							'name': `${channel}/${date}.${i}`,
							'messages': splitMsg
						});
						this.messages[channel][`${date}.${i}`] = this.collection.findOne(messagesId);
					});
				} else {
					const messagesId = this.collection.insert({
						'import': this.importRecord._id,
						'importer': this.name,
						'type': 'messages',
						'name': `${channel}/${date}`,
						'messages': msgs
					});
					this.messages[channel][date] = this.collection.findOne(messagesId);
				}
			});
		});
		this.updateRecord({
			'count.messages': messagesCount,
			'messagesstatus': null
		});
		this.addCountToTotal(messagesCount);

		if (tempUsers.length === 0 || tempRooms.length === 0 || messagesCount === 0) {
			this.logger.warn(`The loaded users count ${tempUsers.length}, the loaded channels ${tempRooms.length}, and the loaded messages ${messagesCount}`);
			super.updateProgress(ProgressStep.ERROR);
			return this.getProgress();
		}

		const selectionUsers = tempUsers.map(function (user) {
			return new SelectionUser(user.user_id, user.name, user.email, user.is_deleted, false, !user.is_bot);
		});
		const selectionChannels = tempRooms.map(function (room) {
			return new SelectionChannel(room.room_id, room.name, room.is_archived, true, false);
		});
		const selectionMessages = this.importRecord.count.messages;
		super.updateProgress(ProgressStep.USER_SELECTION);
		return new Selection(this.name, selectionUsers, selectionChannels, selectionMessages);
	}

	startImport(importSelection) {
		super.startImport(importSelection);
		const start = Date.now();
		importSelection.users.forEach(user => {
			this.users.users.forEach(u => {
				if (u.user_id === user.user_id) {
					u.do_import = user.do_import;
				}
			});
		});
		this.collection.update({
			_id: this.users._id
		}, {
			$set: {
				'users': this.users.users
			}
		});
		importSelection.channels.forEach(channel => this.channels.channels.forEach(c => c.room_id === channel.channel_id && (c.do_import = channel.do_import)));
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
				this.users.users.forEach(user => {
					if (!user.do_import) {
						return;
					}

					Meteor.runAsUser(startedByUserId, () => {
						const existantUser = RocketChat.models.Users.findOneByEmailAddress(user.email);

						if (existantUser) {
							user.rocketId = existantUser._id;
							this.userTags.push({
								hipchat: `@${user.mention_name}`,
								rocket: `@${existantUser.username}`
							});
						} else {
							const userId = Accounts.createUser({
								email: user.email,
								password: Date.now() + user.name + user.email.toUpperCase()
							});
							user.rocketId = userId;
							this.userTags.push({
								hipchat: `@${user.mention_name}`,
								rocket: `@${user.mention_name}`
							});
							Meteor.runAsUser(userId, () => {
								Meteor.call('setUsername', user.mention_name, {
									joinDefaultChannelsSilenced: true
								});
								Meteor.call('setAvatarFromService', user.photo_url, undefined, 'url');
								return Meteor.call('userSetUtcOffset', parseInt(moment().tz(user.timezone).format('Z').toString().split(':')[0]));
							});

							if (user.name != null) {
								RocketChat.models.Users.setName(userId, user.name);
							}

							if (user.is_deleted) {
								Meteor.call('setUserActiveStatus', userId, false);
							}
						}

						return this.addCountCompleted(1);
					});
				});
				this.collection.update({
					_id: this.users._id
				}, {
					$set: {
						'users': this.users.users
					}
				});
				super.updateProgress(ProgressStep.IMPORTING_CHANNELS);
				this.channels.channels.forEach(channel => {
					if (!channel.do_import) {
						return;
					}

					Meteor.runAsUser(startedByUserId, () => {
						channel.name = channel.name.replace(/ /g, '');
						const existantRoom = RocketChat.models.Rooms.findOneByName(channel.name);

						if (existantRoom) {
							channel.rocketId = existantRoom._id;
						} else {
							let userId = '';
							this.users.users.forEach(user => {
								if (user.user_id === channel.owner_user_id) {
									userId = user.rocketId;
								}
							});

							if (userId === '') {
								this.logger.warn(`Failed to find the channel creator for ${channel.name}, setting it to the current running user.`);
								userId = startedByUserId;
							}

							Meteor.runAsUser(userId, () => {
								const returned = Meteor.call('createChannel', channel.name, []);
								return channel.rocketId = returned.rid;
							});
							RocketChat.models.Rooms.update({
								_id: channel.rocketId
							}, {
								$set: {
									'ts': new Date(channel.created * 1000)
								}
							});
						}

						return this.addCountCompleted(1);
					});
				});
				this.collection.update({
					_id: this.channels._id
				}, {
					$set: {
						'channels': this.channels.channels
					}
				});
				super.updateProgress(ProgressStep.IMPORTING_MESSAGES);
				const nousers = {};
				Object.keys(this.messages).forEach(channel => {
					const messagesObj = this.messages[channel];
					Meteor.runAsUser(startedByUserId, () => {
						const hipchatChannel = this.getHipChatChannelFromName(channel);

						if (hipchatChannel != null ? hipchatChannel.do_import : undefined) {
							const room = RocketChat.models.Rooms.findOneById(hipchatChannel.rocketId, {
								fields: {
									usernames: 1,
									t: 1,
									name: 1
								}
							});
							Object.keys(messagesObj).forEach(date => {
								const msgs = messagesObj[date];
								this.updateRecord({
									'messagesstatus': `${channel}/${date}.${msgs.messages.length}`
								});
								msgs.messages.forEach(message => {
									if (message.from != null) {
										const user = this.getRocketUser(message.from.user_id);

										if (user != null) {
											const msgObj = {
												msg: this.convertHipChatMessageToRocketChat(message.message),
												ts: new Date(message.date),
												u: {
													_id: user._id,
													username: user.username
												}
											};
											RocketChat.sendMessage(user, msgObj, room, true);
										} else if (!nousers[message.from.user_id]) {
											nousers[message.from.user_id] = message.from;
										}
									} else if (!_.isArray(message)) {
										console.warn('Please report the following:', message);
									}

									this.addCountCompleted(1);
								});
							});
						}
					});
				});
				this.logger.warn('The following did not have users:', nousers);
				super.updateProgress(ProgressStep.FINISHING);
				this.channels.channels.forEach(channel => {
					if (channel.do_import && channel.is_archived) {
						Meteor.runAsUser(startedByUserId, () => {
							return Meteor.call('archiveRoom', channel.rocketId);
						});
					}
				});
				super.updateProgress(ProgressStep.DONE);
			} catch (e) {
				this.logger.error(e);
				super.updateProgress(ProgressStep.ERROR);
			}

			const timeTook = Date.now() - start;
			return this.logger.log(`Import took ${timeTook} milliseconds.`);
		});
		return this.getProgress();
	}

	getHipChatChannelFromName(channelName) {
		return this.channels.channels.find(channel => channel.name === channelName);
	}

	getRocketUser(hipchatId) {
		const user = this.users.users.find(user => user.user_id === hipchatId);
		return user ? RocketChat.models.Users.findOneById(user.rocketId, {
			fields: {
				username: 1,
				name: 1
			}
		}) : undefined;
	}

	convertHipChatMessageToRocketChat(message) {
		if (message != null) {
			this.userTags.forEach(userReplace => {
				message = message.replace(userReplace.hipchat, userReplace.rocket);
			});
		} else {
			message = '';
		}

		return message;
	}

	getSelection() {
		const selectionUsers = this.users.users.map(function (user) {
			return new SelectionUser(user.user_id, user.name, user.email, user.is_deleted, false, !user.is_bot);
		});
		const selectionChannels = this.channels.channels.map(function (room) {
			return new SelectionChannel(room.room_id, room.name, room.is_archived, true, false);
		});
		return new Selection(this.name, selectionUsers, selectionChannels, this.importRecord.count.messages);
	}

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

},"adder.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/rocketchat_importer-hipchat/server/adder.js                                                 //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
  Importers(v) {
    Importers = v;
  }

}, 0);
let HipChatImporterInfo;
module.watch(require("../info"), {
  HipChatImporterInfo(v) {
    HipChatImporterInfo = v;
  }

}, 1);
let HipChatImporter;
module.watch(require("./importer"), {
  HipChatImporter(v) {
    HipChatImporter = v;
  }

}, 2);
Importers.add(new HipChatImporterInfo(), HipChatImporter);
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:importer-hipchat/info.js");
require("./node_modules/meteor/rocketchat:importer-hipchat/server/importer.js");
require("./node_modules/meteor/rocketchat:importer-hipchat/server/adder.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:importer-hipchat'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_importer-hipchat.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1oaXBjaGF0L2luZm8uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXItaGlwY2hhdC9zZXJ2ZXIvaW1wb3J0ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXItaGlwY2hhdC9zZXJ2ZXIvYWRkZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiSGlwQ2hhdEltcG9ydGVySW5mbyIsIkltcG9ydGVySW5mbyIsIndhdGNoIiwicmVxdWlyZSIsInYiLCJjb25zdHJ1Y3RvciIsIkhpcENoYXRJbXBvcnRlciIsIkJhc2UiLCJQcm9ncmVzc1N0ZXAiLCJTZWxlY3Rpb24iLCJTZWxlY3Rpb25DaGFubmVsIiwiU2VsZWN0aW9uVXNlciIsIl8iLCJkZWZhdWx0IiwicyIsIm1vbWVudCIsImluZm8iLCJ1c2VyVGFncyIsInJvb21QcmVmaXgiLCJ1c2Vyc1ByZWZpeCIsInByZXBhcmUiLCJkYXRhVVJJIiwic2VudENvbnRlbnRUeXBlIiwiZmlsZU5hbWUiLCJpbWFnZSIsIlJvY2tldENoYXRGaWxlIiwiZGF0YVVSSVBhcnNlIiwiemlwIiwiQWRtWmlwIiwiQnVmZmVyIiwiemlwRW50cmllcyIsImdldEVudHJpZXMiLCJ0ZW1wUm9vbXMiLCJ0ZW1wVXNlcnMiLCJ0ZW1wTWVzc2FnZXMiLCJmb3JFYWNoIiwiZW50cnkiLCJlbnRyeU5hbWUiLCJpbmRleE9mIiwibG9nZ2VyIiwiZGVidWciLCJpc0RpcmVjdG9yeSIsInJvb21OYW1lIiwic3BsaXQiLCJ1cGRhdGVQcm9ncmVzcyIsIlBSRVBBUklOR19DSEFOTkVMUyIsIkpTT04iLCJwYXJzZSIsImdldERhdGEiLCJ0b1N0cmluZyIsInJvb21zIiwicm9vbSIsIm5hbWUiLCJzbHVnaWZ5IiwiaXRlbSIsIm1zZ0dyb3VwRGF0YSIsImVycm9yIiwid2FybiIsInVzZXJzTmFtZSIsIlBSRVBBUklOR19VU0VSUyIsInVzZXJzIiwidXNlcnNJZCIsImNvbGxlY3Rpb24iLCJpbnNlcnQiLCJpbXBvcnRSZWNvcmQiLCJfaWQiLCJmaW5kT25lIiwidXBkYXRlUmVjb3JkIiwibGVuZ3RoIiwiYWRkQ291bnRUb1RvdGFsIiwiY2hhbm5lbHNJZCIsImNoYW5uZWxzIiwiUFJFUEFSSU5HX01FU1NBR0VTIiwibWVzc2FnZXNDb3VudCIsIk9iamVjdCIsImtleXMiLCJjaGFubmVsIiwibWVzc2FnZXNPYmoiLCJtZXNzYWdlcyIsImRhdGUiLCJtc2dzIiwiZ2V0QlNPTlNpemUiLCJnZXRNYXhCU09OU2l6ZSIsImdldEJTT05TYWZlQXJyYXlzRnJvbUFuQXJyYXkiLCJzcGxpdE1zZyIsImkiLCJtZXNzYWdlc0lkIiwiRVJST1IiLCJnZXRQcm9ncmVzcyIsInNlbGVjdGlvblVzZXJzIiwibWFwIiwidXNlciIsInVzZXJfaWQiLCJlbWFpbCIsImlzX2RlbGV0ZWQiLCJpc19ib3QiLCJzZWxlY3Rpb25DaGFubmVscyIsInJvb21faWQiLCJpc19hcmNoaXZlZCIsInNlbGVjdGlvbk1lc3NhZ2VzIiwiY291bnQiLCJVU0VSX1NFTEVDVElPTiIsInN0YXJ0SW1wb3J0IiwiaW1wb3J0U2VsZWN0aW9uIiwic3RhcnQiLCJEYXRlIiwibm93IiwidSIsImRvX2ltcG9ydCIsInVwZGF0ZSIsIiRzZXQiLCJjIiwiY2hhbm5lbF9pZCIsInN0YXJ0ZWRCeVVzZXJJZCIsIk1ldGVvciIsInVzZXJJZCIsImRlZmVyIiwiSU1QT1JUSU5HX1VTRVJTIiwicnVuQXNVc2VyIiwiZXhpc3RhbnRVc2VyIiwiUm9ja2V0Q2hhdCIsIm1vZGVscyIsIlVzZXJzIiwiZmluZE9uZUJ5RW1haWxBZGRyZXNzIiwicm9ja2V0SWQiLCJwdXNoIiwiaGlwY2hhdCIsIm1lbnRpb25fbmFtZSIsInJvY2tldCIsInVzZXJuYW1lIiwiQWNjb3VudHMiLCJjcmVhdGVVc2VyIiwicGFzc3dvcmQiLCJ0b1VwcGVyQ2FzZSIsImNhbGwiLCJqb2luRGVmYXVsdENoYW5uZWxzU2lsZW5jZWQiLCJwaG90b191cmwiLCJ1bmRlZmluZWQiLCJwYXJzZUludCIsInR6IiwidGltZXpvbmUiLCJmb3JtYXQiLCJzZXROYW1lIiwiYWRkQ291bnRDb21wbGV0ZWQiLCJJTVBPUlRJTkdfQ0hBTk5FTFMiLCJyZXBsYWNlIiwiZXhpc3RhbnRSb29tIiwiUm9vbXMiLCJmaW5kT25lQnlOYW1lIiwib3duZXJfdXNlcl9pZCIsInJldHVybmVkIiwicmlkIiwiY3JlYXRlZCIsIklNUE9SVElOR19NRVNTQUdFUyIsIm5vdXNlcnMiLCJoaXBjaGF0Q2hhbm5lbCIsImdldEhpcENoYXRDaGFubmVsRnJvbU5hbWUiLCJmaW5kT25lQnlJZCIsImZpZWxkcyIsInVzZXJuYW1lcyIsInQiLCJtZXNzYWdlIiwiZnJvbSIsImdldFJvY2tldFVzZXIiLCJtc2dPYmoiLCJtc2ciLCJjb252ZXJ0SGlwQ2hhdE1lc3NhZ2VUb1JvY2tldENoYXQiLCJ0cyIsInNlbmRNZXNzYWdlIiwiaXNBcnJheSIsImNvbnNvbGUiLCJGSU5JU0hJTkciLCJET05FIiwiZSIsInRpbWVUb29rIiwibG9nIiwiY2hhbm5lbE5hbWUiLCJmaW5kIiwiaGlwY2hhdElkIiwidXNlclJlcGxhY2UiLCJnZXRTZWxlY3Rpb24iLCJJbXBvcnRlcnMiLCJhZGQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsT0FBT0MsTUFBUCxDQUFjO0FBQUNDLHNCQUFvQixNQUFJQTtBQUF6QixDQUFkO0FBQTZELElBQUlDLFlBQUo7QUFBaUJILE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSw0QkFBUixDQUFiLEVBQW1EO0FBQUNGLGNBQWFHLENBQWIsRUFBZTtBQUFDSCxpQkFBYUcsQ0FBYjtBQUFlOztBQUFoQyxDQUFuRCxFQUFxRixDQUFyRjs7QUFFdkUsTUFBTUosbUJBQU4sU0FBa0NDLFlBQWxDLENBQStDO0FBQ3JESSxlQUFjO0FBQ2IsUUFBTSxTQUFOLEVBQWlCLFNB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S0MsSUFBeEMsRUFBOENELEtBQUsrQyxXQUFuRCxFQUFnRSxJQUFoRSxFQUFzRSxLQUF0RSxDQUFQO0FBQ0EsR0FGeUIsQ0FBMUI7QUFHQSxTQUFPLElBQUl6RixTQUFKLENBQWMsS0FBSzJDLElBQW5CLEVBQXlCcUMsY0FBekIsRUFBeUNPLGlCQUF6QyxFQUE0RCxLQUFLaEMsWUFBTCxDQUFrQm9DLEtBQWxCLENBQXdCdEIsUUFBcEYsQ0FBUDtBQUNBOztBQXhWd0MsQzs7Ozs7Ozs7Ozs7QUNkMUMsSUFBSXVHLFNBQUo7QUFBY3ZMLE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSw0QkFBUixDQUFiLEVBQW1EO0FBQUNrTCxZQUFVakwsQ0FBVixFQUFZO0FBQUNpTCxnQkFBVWpMLENBQVY7QUFBWTs7QUFBMUIsQ0FBbkQsRUFBK0UsQ0FBL0U7QUFBa0YsSUFBSUosbUJBQUo7QUFBd0JGLE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSxTQUFSLENBQWIsRUFBZ0M7QUFBQ0gsc0JBQW9CSSxDQUFwQixFQUFzQjtBQUFDSiwwQkFBb0JJLENBQXBCO0FBQXNCOztBQUE5QyxDQUFoQyxFQUFnRixDQUFoRjtBQUFtRixJQUFJRSxlQUFKO0FBQW9CUixPQUFPSSxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNHLGtCQUFnQkYsQ0FBaEIsRUFBa0I7QUFBQ0Usc0JBQWdCRixDQUFoQjtBQUFrQjs7QUFBdEMsQ0FBbkMsRUFBMkUsQ0FBM0U7QUFJL05pTCxVQUFVQyxHQUFWLENBQWMsSUFBSXRMLG1CQUFKLEVBQWQsRUFBeUNNLGVBQXpDLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfaW1wb3J0ZXItaGlwY2hhdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEltcG9ydGVySW5mbyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIEhpcENoYXRJbXBvcnRlckluZm8gZXh0ZW5kcyBJbXBvcnRlckluZm8ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignaGlwY2hhdCcsICdIaXBDaGF0JywgJ2FwcGxpY2F0aW9uL3ppcCcpO1xuXHR9XG59XG4iLCJpbXBvcnQge1xuXHRCYXNlLFxuXHRQcm9ncmVzc1N0ZXAsXG5cdFNlbGVjdGlvbixcblx0U2VsZWN0aW9uQ2hhbm5lbCxcblx0U2VsZWN0aW9uVXNlclxufSBmcm9tICdtZXRlb3Ivcm9ja2V0Y2hhdDppbXBvcnRlcic7XG5cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQnO1xuXG5pbXBvcnQgJ21vbWVudC10aW1lem9uZSc7XG5cbmV4cG9ydCBjbGFzcyBIaXBDaGF0SW1wb3J0ZXIgZXh0ZW5kcyBCYXNlIHtcblx0Y29uc3RydWN0b3IoaW5mbykge1xuXHRcdHN1cGVyKGluZm8pO1xuXG5cdFx0dGhpcy51c2VyVGFncyA9IFtdO1xuXHRcdHRoaXMucm9vbVByZWZpeCA9ICdoaXBjaGF0X2V4cG9ydC9yb29tcy8nO1xuXHRcdHRoaXMudXNlcnNQcmVmaXggPSAnaGlwY2hhdF9leHBvcnQvdXNlcnMvJztcblx0fVxuXG5cdHByZXBhcmUoZGF0YVVSSSwgc2VudENvbnRlbnRUeXBlLCBmaWxlTmFtZSkge1xuXHRcdHN1cGVyLnByZXBhcmUoZGF0YVVSSSwgc2VudENvbnRlbnRUeXBlLCBmaWxlTmFtZSk7XG5cdFx0Y29uc3QgaW1hZ2UgPSBSb2NrZXRDaGF0RmlsZS5kYXRhVVJJUGFyc2UoZGF0YVVSSSkuaW1hZ2U7XG5cdFx0Ly8gY29uc3QgY29udGVudFR5cGUgPSByZWYuY29udGVudFR5cGU7XG5cdFx0Y29uc3QgemlwID0gbmV3IHRoaXMuQWRtWmlwKG5ldyBCdWZmZXIoaW1hZ2UsICdiYXNlNjQnKSk7XG5cdFx0Y29uc3QgemlwRW50cmllcyA9IHppcC5nZXRFbnRyaWVzKCk7XG5cdFx0Y29uc3QgdGVtcFJvb21zID0gW107XG5cdFx0bGV0IHRlbXBVc2VycyA9IFtdO1xuXHRcdGNvbnN0IHRlbXBNZXNzYWdlcyA9IHt9O1xuXG5cdFx0emlwRW50cmllcy5mb3JFYWNoKGVudHJ5ID0+IHtcblx0XHRcdGlmIChlbnRyeS5lbnRyeU5hbWUuaW5kZXhPZignX19NQUNPU1gnKSA+IC0xKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBJZ25vcmluZyB0aGUgZmlsZTogJHsgZW50cnkuZW50cnlOYW1lIH1gKTtcblx0XHRcdH1cblx0XHRcdGlmIChlbnRyeS5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoZW50cnkuZW50cnlOYW1lLmluZGV4T2YodGhpcy5yb29tUHJlZml4KSA+IC0xKSB7XG5cdFx0XHRcdGxldCByb29tTmFtZSA9IGVudHJ5LmVudHJ5TmFtZS5zcGxpdCh0aGlzLnJvb21QcmVmaXgpWzFdO1xuXHRcdFx0XHRpZiAocm9vbU5hbWUgPT09ICdsaXN0Lmpzb24nKSB7XG5cdFx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLlBSRVBBUklOR19DSEFOTkVMUyk7XG5cdFx0XHRcdFx0Y29uc3QgdGVtcFJvb21zID0gSlNPTi5wYXJzZShlbnRyeS5nZXREYXRhKCkudG9TdHJpbmcoKSkucm9vbXM7XG5cdFx0XHRcdFx0dGVtcFJvb21zLmZvckVhY2gocm9vbSA9PiB7XG5cdFx0XHRcdFx0XHRyb29tLm5hbWUgPSBzLnNsdWdpZnkocm9vbS5uYW1lKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIGlmIChyb29tTmFtZS5pbmRleE9mKCcvJykgPiAtMSkge1xuXHRcdFx0XHRcdGNvbnN0IGl0ZW0gPSByb29tTmFtZS5zcGxpdCgnLycpO1xuXHRcdFx0XHRcdHJvb21OYW1lID0gcy5zbHVnaWZ5KGl0ZW1bMF0pO1xuXHRcdFx0XHRcdGNvbnN0IG1zZ0dyb3VwRGF0YSA9IGl0ZW1bMV0uc3BsaXQoJy4nKVswXTtcblx0XHRcdFx0XHRpZiAoIXRlbXBNZXNzYWdlc1tyb29tTmFtZV0pIHtcblx0XHRcdFx0XHRcdHRlbXBNZXNzYWdlc1tyb29tTmFtZV0gPSB7fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHJldHVybiB0ZW1wTWVzc2FnZXNbcm9vbU5hbWVdW21zZ0dyb3VwRGF0YV0gPSBKU09OLnBhcnNlKGVudHJ5LmdldERhdGEoKS50b1N0cmluZygpKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMubG9nZ2VyLndhcm4oYCR7IGVudHJ5LmVudHJ5TmFtZSB9IGlzIG5vdCBhIHZhbGlkIEpTT04gZmlsZSEgVW5hYmxlIHRvIGltcG9ydCBpdC5gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZW50cnkuZW50cnlOYW1lLmluZGV4T2YodGhpcy51c2Vyc1ByZWZpeCkgPiAtMSkge1xuXHRcdFx0XHRjb25zdCB1c2Vyc05hbWUgPSBlbnRyeS5lbnRyeU5hbWUuc3BsaXQodGhpcy51c2Vyc1ByZWZpeClbMV07XG5cdFx0XHRcdGlmICh1c2Vyc05hbWUgPT09ICdsaXN0Lmpzb24nKSB7XG5cdFx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLlBSRVBBUklOR19VU0VSUyk7XG5cdFx0XHRcdFx0cmV0dXJuIHRlbXBVc2VycyA9IEpTT04ucGFyc2UoZW50cnkuZ2V0RGF0YSgpLnRvU3RyaW5nKCkpLnVzZXJzO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmxvZ2dlci53YXJuKGBVbmV4cGVjdGVkIGZpbGUgaW4gdGhlICR7IHRoaXMubmFtZSB9IGltcG9ydDogJHsgZW50cnkuZW50cnlOYW1lIH1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHVzZXJzSWQgPSB0aGlzLmNvbGxlY3Rpb24uaW5zZXJ0KHtcblx0XHRcdCdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsXG5cdFx0XHQnaW1wb3J0ZXInOiB0aGlzLm5hbWUsXG5cdFx0XHQndHlwZSc6ICd1c2VycycsXG5cdFx0XHQndXNlcnMnOiB0ZW1wVXNlcnNcblx0XHR9KTtcblx0XHR0aGlzLnVzZXJzID0gdGhpcy5jb2xsZWN0aW9uLmZpbmRPbmUodXNlcnNJZCk7XG5cdFx0dGhpcy51cGRhdGVSZWNvcmQoe1xuXHRcdFx0J2NvdW50LnVzZXJzJzogdGVtcFVzZXJzLmxlbmd0aFxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkQ291bnRUb1RvdGFsKHRlbXBVc2Vycy5sZW5ndGgpO1xuXHRcdGNvbnN0IGNoYW5uZWxzSWQgPSB0aGlzLmNvbGxlY3Rpb24uaW5zZXJ0KHtcblx0XHRcdCdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsXG5cdFx0XHQnaW1wb3J0ZXInOiB0aGlzLm5hbWUsXG5cdFx0XHQndHlwZSc6ICdjaGFubmVscycsXG5cdFx0XHQnY2hhbm5lbHMnOiB0ZW1wUm9vbXNcblx0XHR9KTtcblx0XHR0aGlzLmNoYW5uZWxzID0gdGhpcy5jb2xsZWN0aW9uLmZpbmRPbmUoY2hhbm5lbHNJZCk7XG5cdFx0dGhpcy51cGRhdGVSZWNvcmQoe1xuXHRcdFx0J2NvdW50LmNoYW5uZWxzJzogdGVtcFJvb21zLmxlbmd0aFxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkQ291bnRUb1RvdGFsKHRlbXBSb29tcy5sZW5ndGgpO1xuXHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5QUkVQQVJJTkdfTUVTU0FHRVMpO1xuXHRcdGxldCBtZXNzYWdlc0NvdW50ID0gMDtcblx0XHRPYmplY3Qua2V5cyh0ZW1wTWVzc2FnZXMpLmZvckVhY2goY2hhbm5lbCA9PiB7XG5cdFx0XHRjb25zdCBtZXNzYWdlc09iaiA9IHRlbXBNZXNzYWdlc1tjaGFubmVsXTtcblx0XHRcdHRoaXMubWVzc2FnZXNbY2hhbm5lbF0gPSB0aGlzLm1lc3NhZ2VzW2NoYW5uZWxdIHx8IHt9O1xuXHRcdFx0T2JqZWN0LmtleXMobWVzc2FnZXNPYmopLmZvckVhY2goZGF0ZSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1zZ3MgPSBtZXNzYWdlc09ialtkYXRlXTtcblx0XHRcdFx0bWVzc2FnZXNDb3VudCArPSBtc2dzLmxlbmd0aDtcblx0XHRcdFx0dGhpcy51cGRhdGVSZWNvcmQoe1xuXHRcdFx0XHRcdCdtZXNzYWdlc3N0YXR1cyc6IGAkeyBjaGFubmVsIH0vJHsgZGF0ZSB9YFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKEJhc2UuZ2V0QlNPTlNpemUobXNncykgPiBCYXNlLmdldE1heEJTT05TaXplKCkpIHtcblx0XHRcdFx0XHRCYXNlLmdldEJTT05TYWZlQXJyYXlzRnJvbUFuQXJyYXkobXNncykuZm9yRWFjaCgoc3BsaXRNc2csIGkpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2VzSWQgPSB0aGlzLmNvbGxlY3Rpb24uaW5zZXJ0KHtcblx0XHRcdFx0XHRcdFx0J2ltcG9ydCc6IHRoaXMuaW1wb3J0UmVjb3JkLl9pZCxcblx0XHRcdFx0XHRcdFx0J2ltcG9ydGVyJzogdGhpcy5uYW1lLFxuXHRcdFx0XHRcdFx0XHQndHlwZSc6ICdtZXNzYWdlcycsXG5cdFx0XHRcdFx0XHRcdCduYW1lJzogYCR7IGNoYW5uZWwgfS8keyBkYXRlIH0uJHsgaSB9YCxcblx0XHRcdFx0XHRcdFx0J21lc3NhZ2VzJzogc3BsaXRNc2dcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5tZXNzYWdlc1tjaGFubmVsXVtgJHsgZGF0ZSB9LiR7IGkgfWBdID0gdGhpcy5jb2xsZWN0aW9uLmZpbmRPbmUobWVzc2FnZXNJZCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgbWVzc2FnZXNJZCA9IHRoaXMuY29sbGVjdGlvbi5pbnNlcnQoe1xuXHRcdFx0XHRcdFx0J2ltcG9ydCc6IHRoaXMuaW1wb3J0UmVjb3JkLl9pZCxcblx0XHRcdFx0XHRcdCdpbXBvcnRlcic6IHRoaXMubmFtZSxcblx0XHRcdFx0XHRcdCd0eXBlJzogJ21lc3NhZ2VzJyxcblx0XHRcdFx0XHRcdCduYW1lJzogYCR7IGNoYW5uZWwgfS8keyBkYXRlIH1gLFxuXHRcdFx0XHRcdFx0J21lc3NhZ2VzJzogbXNnc1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHRoaXMubWVzc2FnZXNbY2hhbm5lbF1bZGF0ZV0gPSB0aGlzLmNvbGxlY3Rpb24uZmluZE9uZShtZXNzYWdlc0lkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVSZWNvcmQoe1xuXHRcdFx0J2NvdW50Lm1lc3NhZ2VzJzogbWVzc2FnZXNDb3VudCxcblx0XHRcdCdtZXNzYWdlc3N0YXR1cyc6IG51bGxcblx0XHR9KTtcblx0XHR0aGlzLmFkZENvdW50VG9Ub3RhbChtZXNzYWdlc0NvdW50KTtcblx0XHRpZiAodGVtcFVzZXJzLmxlbmd0aCA9PT0gMCB8fCB0ZW1wUm9vbXMubGVuZ3RoID09PSAwIHx8IG1lc3NhZ2VzQ291bnQgPT09IDApIHtcblx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYFRoZSBsb2FkZWQgdXNlcnMgY291bnQgJHsgdGVtcFVzZXJzLmxlbmd0aCB9LCB0aGUgbG9hZGVkIGNoYW5uZWxzICR7IHRlbXBSb29tcy5sZW5ndGggfSwgYW5kIHRoZSBsb2FkZWQgbWVzc2FnZXMgJHsgbWVzc2FnZXNDb3VudCB9YCk7XG5cdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRVJST1IpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0UHJvZ3Jlc3MoKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2VsZWN0aW9uVXNlcnMgPSB0ZW1wVXNlcnMubWFwKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHRcdHJldHVybiBuZXcgU2VsZWN0aW9uVXNlcih1c2VyLnVzZXJfaWQsIHVzZXIubmFtZSwgdXNlci5lbWFpbCwgdXNlci5pc19kZWxldGVkLCBmYWxzZSwgIXVzZXIuaXNfYm90KTtcblx0XHR9KTtcblx0XHRjb25zdCBzZWxlY3Rpb25DaGFubmVscyA9IHRlbXBSb29tcy5tYXAoZnVuY3Rpb24ocm9vbSkge1xuXHRcdFx0cmV0dXJuIG5ldyBTZWxlY3Rpb25DaGFubmVsKHJvb20ucm9vbV9pZCwgcm9vbS5uYW1lLCByb29tLmlzX2FyY2hpdmVkLCB0cnVlLCBmYWxzZSk7XG5cdFx0fSk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uTWVzc2FnZXMgPSB0aGlzLmltcG9ydFJlY29yZC5jb3VudC5tZXNzYWdlcztcblx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuVVNFUl9TRUxFQ1RJT04pO1xuXHRcdHJldHVybiBuZXcgU2VsZWN0aW9uKHRoaXMubmFtZSwgc2VsZWN0aW9uVXNlcnMsIHNlbGVjdGlvbkNoYW5uZWxzLCBzZWxlY3Rpb25NZXNzYWdlcyk7XG5cdH1cblxuXHRzdGFydEltcG9ydChpbXBvcnRTZWxlY3Rpb24pIHtcblx0XHRzdXBlci5zdGFydEltcG9ydChpbXBvcnRTZWxlY3Rpb24pO1xuXHRcdGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcblxuXHRcdGltcG9ydFNlbGVjdGlvbi51c2Vycy5mb3JFYWNoKHVzZXIgPT4ge1xuXHRcdFx0dGhpcy51c2Vycy51c2Vycy5mb3JFYWNoKHUgPT4ge1xuXHRcdFx0XHRpZiAodS51c2VyX2lkID09PSB1c2VyLnVzZXJfaWQpIHtcblx0XHRcdFx0XHR1LmRvX2ltcG9ydCA9IHVzZXIuZG9faW1wb3J0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHR0aGlzLmNvbGxlY3Rpb24udXBkYXRlKHtfaWQ6IHRoaXMudXNlcnMuX2lkfSwgeyAkc2V0OiB7ICd1c2Vycyc6IHRoaXMudXNlcnMudXNlcnMgfSB9KTtcblxuXHRcdGltcG9ydFNlbGVjdGlvbi5jaGFubmVscy5mb3JFYWNoKGNoYW5uZWwgPT5cblx0XHRcdHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMuZm9yRWFjaChjID0+IGMucm9vbV9pZCA9PT0gY2hhbm5lbC5jaGFubmVsX2lkICYmIChjLmRvX2ltcG9ydCA9IGNoYW5uZWwuZG9faW1wb3J0KSlcblx0XHQpO1xuXHRcdHRoaXMuY29sbGVjdGlvbi51cGRhdGUoeyBfaWQ6IHRoaXMuY2hhbm5lbHMuX2lkIH0sIHsgJHNldDogeyAnY2hhbm5lbHMnOiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzIH19KTtcblxuXHRcdGNvbnN0IHN0YXJ0ZWRCeVVzZXJJZCA9IE1ldGVvci51c2VySWQoKTtcblx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLklNUE9SVElOR19VU0VSUyk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMudXNlcnMudXNlcnMuZm9yRWFjaCh1c2VyID0+IHtcblx0XHRcdFx0XHRpZiAoIXVzZXIuZG9faW1wb3J0KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcihzdGFydGVkQnlVc2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4aXN0YW50VXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUVtYWlsQWRkcmVzcyh1c2VyLmVtYWlsKTtcblx0XHRcdFx0XHRcdGlmIChleGlzdGFudFVzZXIpIHtcblx0XHRcdFx0XHRcdFx0dXNlci5yb2NrZXRJZCA9IGV4aXN0YW50VXNlci5faWQ7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXNlclRhZ3MucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0aGlwY2hhdDogYEAkeyB1c2VyLm1lbnRpb25fbmFtZSB9YCxcblx0XHRcdFx0XHRcdFx0XHRyb2NrZXQ6IGBAJHsgZXhpc3RhbnRVc2VyLnVzZXJuYW1lIH1gXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdXNlcklkID0gQWNjb3VudHMuY3JlYXRlVXNlcih7XG5cdFx0XHRcdFx0XHRcdFx0ZW1haWw6IHVzZXIuZW1haWwsXG5cdFx0XHRcdFx0XHRcdFx0cGFzc3dvcmQ6IERhdGUubm93KCkgKyB1c2VyLm5hbWUgKyB1c2VyLmVtYWlsLnRvVXBwZXJDYXNlKClcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdHVzZXIucm9ja2V0SWQgPSB1c2VySWQ7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXNlclRhZ3MucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0aGlwY2hhdDogYEAkeyB1c2VyLm1lbnRpb25fbmFtZSB9YCxcblx0XHRcdFx0XHRcdFx0XHRyb2NrZXQ6IGBAJHsgdXNlci5tZW50aW9uX25hbWUgfWBcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIodXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0TWV0ZW9yLmNhbGwoJ3NldFVzZXJuYW1lJywgdXNlci5tZW50aW9uX25hbWUsIHtcblx0XHRcdFx0XHRcdFx0XHRcdGpvaW5EZWZhdWx0Q2hhbm5lbHNTaWxlbmNlZDogdHJ1ZVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdE1ldGVvci5jYWxsKCdzZXRBdmF0YXJGcm9tU2VydmljZScsIHVzZXIucGhvdG9fdXJsLCB1bmRlZmluZWQsICd1cmwnKTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gTWV0ZW9yLmNhbGwoJ3VzZXJTZXRVdGNPZmZzZXQnLCBwYXJzZUludChtb21lbnQoKS50eih1c2VyLnRpbWV6b25lKS5mb3JtYXQoJ1onKS50b1N0cmluZygpLnNwbGl0KCc6JylbMF0pKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGlmICh1c2VyLm5hbWUgIT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnNldE5hbWUodXNlcklkLCB1c2VyLm5hbWUpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICh1c2VyLmlzX2RlbGV0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRNZXRlb3IuY2FsbCgnc2V0VXNlckFjdGl2ZVN0YXR1cycsIHVzZXJJZCwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5hZGRDb3VudENvbXBsZXRlZCgxKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGhpcy5jb2xsZWN0aW9uLnVwZGF0ZSh7IF9pZDogdGhpcy51c2Vycy5faWQgfSwgeyAkc2V0OiB7ICd1c2Vycyc6IHRoaXMudXNlcnMudXNlcnMgfX0pO1xuXG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5JTVBPUlRJTkdfQ0hBTk5FTFMpO1xuXHRcdFx0XHR0aGlzLmNoYW5uZWxzLmNoYW5uZWxzLmZvckVhY2goY2hhbm5lbCA9PiB7XG5cdFx0XHRcdFx0aWYgKCFjaGFubmVsLmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKHN0YXJ0ZWRCeVVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y2hhbm5lbC5uYW1lID0gY2hhbm5lbC5uYW1lLnJlcGxhY2UoLyAvZywgJycpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZXhpc3RhbnRSb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5TmFtZShjaGFubmVsLm5hbWUpO1xuXHRcdFx0XHRcdFx0aWYgKGV4aXN0YW50Um9vbSkge1xuXHRcdFx0XHRcdFx0XHRjaGFubmVsLnJvY2tldElkID0gZXhpc3RhbnRSb29tLl9pZDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGxldCB1c2VySWQgPSAnJztcblx0XHRcdFx0XHRcdFx0dGhpcy51c2Vycy51c2Vycy5mb3JFYWNoKHVzZXIgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmICh1c2VyLnVzZXJfaWQgPT09IGNoYW5uZWwub3duZXJfdXNlcl9pZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dXNlcklkID0gdXNlci5yb2NrZXRJZDtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRpZiAodXNlcklkID09PSAnJykge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYEZhaWxlZCB0byBmaW5kIHRoZSBjaGFubmVsIGNyZWF0b3IgZm9yICR7IGNoYW5uZWwubmFtZSB9LCBzZXR0aW5nIGl0IHRvIHRoZSBjdXJyZW50IHJ1bm5pbmcgdXNlci5gKTtcblx0XHRcdFx0XHRcdFx0XHR1c2VySWQgPSBzdGFydGVkQnlVc2VySWQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcih1c2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXR1cm5lZCA9IE1ldGVvci5jYWxsKCdjcmVhdGVDaGFubmVsJywgY2hhbm5lbC5uYW1lLCBbXSk7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGNoYW5uZWwucm9ja2V0SWQgPSByZXR1cm5lZC5yaWQ7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy51cGRhdGUoe1xuXHRcdFx0XHRcdFx0XHRcdF9pZDogY2hhbm5lbC5yb2NrZXRJZFxuXHRcdFx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRcdFx0JHNldDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J3RzJzogbmV3IERhdGUoY2hhbm5lbC5jcmVhdGVkICogMTAwMClcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuYWRkQ291bnRDb21wbGV0ZWQoMSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuY29sbGVjdGlvbi51cGRhdGUoeyBfaWQ6IHRoaXMuY2hhbm5lbHMuX2lkIH0sIHsgJHNldDogeyAnY2hhbm5lbHMnOiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzIH19KTtcblxuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuSU1QT1JUSU5HX01FU1NBR0VTKTtcblx0XHRcdFx0Y29uc3Qgbm91c2VycyA9IHt9O1xuXG5cdFx0XHRcdE9iamVjdC5rZXlzKHRoaXMubWVzc2FnZXMpLmZvckVhY2goY2hhbm5lbCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbWVzc2FnZXNPYmogPSB0aGlzLm1lc3NhZ2VzW2NoYW5uZWxdO1xuXHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIoc3RhcnRlZEJ5VXNlcklkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBoaXBjaGF0Q2hhbm5lbCA9IHRoaXMuZ2V0SGlwQ2hhdENoYW5uZWxGcm9tTmFtZShjaGFubmVsKTtcblx0XHRcdFx0XHRcdGlmIChoaXBjaGF0Q2hhbm5lbCAhPSBudWxsID8gaGlwY2hhdENoYW5uZWwuZG9faW1wb3J0IDogdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChoaXBjaGF0Q2hhbm5lbC5yb2NrZXRJZCwge1xuXHRcdFx0XHRcdFx0XHRcdGZpZWxkczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dXNlcm5hbWVzOiAxLFxuXHRcdFx0XHRcdFx0XHRcdFx0dDogMSxcblx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6IDFcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdE9iamVjdC5rZXlzKG1lc3NhZ2VzT2JqKS5mb3JFYWNoKGRhdGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1zZ3MgPSBtZXNzYWdlc09ialtkYXRlXTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVJlY29yZCh7XG5cdFx0XHRcdFx0XHRcdFx0XHQnbWVzc2FnZXNzdGF0dXMnOiBgJHsgY2hhbm5lbCB9LyR7IGRhdGUgfS4keyBtc2dzLm1lc3NhZ2VzLmxlbmd0aCB9YFxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdFx0bXNncy5tZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKG1lc3NhZ2UuZnJvbSAhPSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHVzZXIgPSB0aGlzLmdldFJvY2tldFVzZXIobWVzc2FnZS5mcm9tLnVzZXJfaWQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAodXNlciAhPSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgbXNnT2JqID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bXNnOiB0aGlzLmNvbnZlcnRIaXBDaGF0TWVzc2FnZVRvUm9ja2V0Q2hhdChtZXNzYWdlLm1lc3NhZ2UpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHM6IG5ldyBEYXRlKG1lc3NhZ2UuZGF0ZSksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF9pZDogdXNlci5faWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0LnNlbmRNZXNzYWdlKHVzZXIsIG1zZ09iaiwgcm9vbSwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIW5vdXNlcnNbbWVzc2FnZS5mcm9tLnVzZXJfaWRdKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm91c2Vyc1ttZXNzYWdlLmZyb20udXNlcl9pZF0gPSBtZXNzYWdlLmZyb207XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIV8uaXNBcnJheShtZXNzYWdlKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ1BsZWFzZSByZXBvcnQgdGhlIGZvbGxvd2luZzonLCBtZXNzYWdlKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuYWRkQ291bnRDb21wbGV0ZWQoMSk7XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLmxvZ2dlci53YXJuKCdUaGUgZm9sbG93aW5nIGRpZCBub3QgaGF2ZSB1c2VyczonLCBub3VzZXJzKTtcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLkZJTklTSElORyk7XG5cblx0XHRcdFx0dGhpcy5jaGFubmVscy5jaGFubmVscy5mb3JFYWNoKGNoYW5uZWwgPT4ge1xuXHRcdFx0XHRcdGlmIChjaGFubmVsLmRvX2ltcG9ydCAmJiBjaGFubmVsLmlzX2FyY2hpdmVkKSB7XG5cdFx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKHN0YXJ0ZWRCeVVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gTWV0ZW9yLmNhbGwoJ2FyY2hpdmVSb29tJywgY2hhbm5lbC5yb2NrZXRJZCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5ET05FKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoZSk7XG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5FUlJPUik7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRpbWVUb29rID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuXHRcdFx0cmV0dXJuIHRoaXMubG9nZ2VyLmxvZyhgSW1wb3J0IHRvb2sgJHsgdGltZVRvb2sgfSBtaWxsaXNlY29uZHMuYCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRQcm9ncmVzcygpO1xuXHR9XG5cblx0Z2V0SGlwQ2hhdENoYW5uZWxGcm9tTmFtZShjaGFubmVsTmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzLmZpbmQoY2hhbm5lbCA9PiBjaGFubmVsLm5hbWUgPT09IGNoYW5uZWxOYW1lKTtcblx0fVxuXG5cdGdldFJvY2tldFVzZXIoaGlwY2hhdElkKSB7XG5cdFx0Y29uc3QgdXNlciA9IHRoaXMudXNlcnMudXNlcnMuZmluZCh1c2VyID0+IHVzZXIudXNlcl9pZCA9PT0gaGlwY2hhdElkKTtcblx0XHRyZXR1cm4gdXNlciA/IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHVzZXIucm9ja2V0SWQsIHtcblx0XHRcdGZpZWxkczoge1xuXHRcdFx0XHR1c2VybmFtZTogMSxcblx0XHRcdFx0bmFtZTogMVxuXHRcdFx0fVxuXHRcdH0pIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Y29udmVydEhpcENoYXRNZXNzYWdlVG9Sb2NrZXRDaGF0KG1lc3NhZ2UpIHtcblx0XHRpZiAobWVzc2FnZSAhPSBudWxsKSB7XG5cdFx0XHR0aGlzLnVzZXJUYWdzLmZvckVhY2godXNlclJlcGxhY2UgPT4ge1xuXHRcdFx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKHVzZXJSZXBsYWNlLmhpcGNoYXQsIHVzZXJSZXBsYWNlLnJvY2tldCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWVzc2FnZSA9ICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdGdldFNlbGVjdGlvbigpIHtcblx0XHRjb25zdCBzZWxlY3Rpb25Vc2VycyA9IHRoaXMudXNlcnMudXNlcnMubWFwKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHRcdHJldHVybiBuZXcgU2VsZWN0aW9uVXNlcih1c2VyLnVzZXJfaWQsIHVzZXIubmFtZSwgdXNlci5lbWFpbCwgdXNlci5pc19kZWxldGVkLCBmYWxzZSwgIXVzZXIuaXNfYm90KTtcblx0XHR9KTtcblx0XHRjb25zdCBzZWxlY3Rpb25DaGFubmVscyA9IHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMubWFwKGZ1bmN0aW9uKHJvb20pIHtcblx0XHRcdHJldHVybiBuZXcgU2VsZWN0aW9uQ2hhbm5lbChyb29tLnJvb21faWQsIHJvb20ubmFtZSwgcm9vbS5pc19hcmNoaXZlZCwgdHJ1ZSwgZmFsc2UpO1xuXHRcdH0pO1xuXHRcdHJldHVybiBuZXcgU2VsZWN0aW9uKHRoaXMubmFtZSwgc2VsZWN0aW9uVXNlcnMsIHNlbGVjdGlvbkNoYW5uZWxzLCB0aGlzLmltcG9ydFJlY29yZC5jb3VudC5tZXNzYWdlcyk7XG5cdH1cbn1cbiIsImltcG9ydCB7IEltcG9ydGVycyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcbmltcG9ydCB7IEhpcENoYXRJbXBvcnRlckluZm8gfSBmcm9tICcuLi9pbmZvJztcbmltcG9ydCB7IEhpcENoYXRJbXBvcnRlciB9IGZyb20gJy4vaW1wb3J0ZXInO1xuXG5JbXBvcnRlcnMuYWRkKG5ldyBIaXBDaGF0SW1wb3J0ZXJJbmZvKCksIEhpcENoYXRJbXBvcnRlcik7XG4iXX0=
