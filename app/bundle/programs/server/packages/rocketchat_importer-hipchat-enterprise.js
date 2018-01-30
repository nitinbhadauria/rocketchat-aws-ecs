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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:importer-hipchat-enterprise":{"info.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer-hipchat-enterprise/info.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	HipChatEnterpriseImporterInfo: () => HipChatEnterpriseImporterInfo
});
let ImporterInfo;
module.watch(require("meteor/rocketchat:importer"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 0);

class HipChatEnterpriseImporterInfo extends ImporterInfo {
	constructor() {
		super('hipchatenterprise', 'HipChat Enterprise', 'application/gzip', [{
			text: 'Importer_HipChatEnterprise_Information',
			href: 'https://rocket.chat/docs/administrator-guides/import/hipchat/enterprise/'
		}, {
			text: 'Importer_HipChatEnterprise_BetaWarning',
			href: 'https://github.com/RocketChat/Rocket.Chat/issues/new'
		}]);
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server":{"importer.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer-hipchat-enterprise/server/importer.js                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	HipChatEnterpriseImporter: () => HipChatEnterpriseImporter
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

class HipChatEnterpriseImporter extends Base {
	constructor(info) {
		super(info);
		this.Readable = require('stream').Readable;
		this.zlib = require('zlib');
		this.tarStream = Npm.require('tar-stream');
		this.extract = this.tarStream.extract();
		this.path = require('path');
		this.messages = new Map();
		this.directMessages = new Map();
	}

	prepare(dataURI, sentContentType, fileName) {
		super.prepare(dataURI, sentContentType, fileName);
		const tempUsers = [];
		const tempRooms = [];
		const tempMessages = new Map();
		const tempDirectMessages = new Map();
		const promise = new Promise((resolve, reject) => {
			this.extract.on('entry', Meteor.bindEnvironment((header, stream, next) => {
				if (header.name.indexOf('.json') !== -1) {
					const info = this.path.parse(header.name);
					stream.on('data', Meteor.bindEnvironment(chunk => {
						this.logger.debug(`Processing the file: ${header.name}`);
						const file = JSON.parse(chunk);

						if (info.base === 'users.json') {
							super.updateProgress(ProgressStep.PREPARING_USERS);

							for (const u of file) {
								tempUsers.push({
									id: u.User.id,
									email: u.User.email,
									name: u.User.name,
									username: u.User.mention_name,
									avatar: u.User.avatar.replace(/\n/g, ''),
									timezone: u.User.timezone,
									isDeleted: u.User.is_deleted
								});
							}
						} else if (info.base === 'rooms.json') {
							super.updateProgress(ProgressStep.PREPARING_CHANNELS);

							for (const r of file) {
								tempRooms.push({
									id: r.Room.id,
									creator: r.Room.owner,
									created: new Date(r.Room.created),
									name: r.Room.name.replace(/ /g, '_').toLowerCase(),
									isPrivate: r.Room.privacy === 'private',
									isArchived: r.Room.is_archived,
									topic: r.Room.topic
								});
							}
						} else if (info.base === 'history.json') {
							const dirSplit = info.dir.split('/'); //['.', 'users', '1']

							const roomIdentifier = `${dirSplit[1]}/${dirSplit[2]}`;

							if (dirSplit[1] === 'users') {
								const msgs = [];

								for (const m of file) {
									if (m.PrivateUserMessage) {
										msgs.push({
											type: 'user',
											id: `hipchatenterprise-${m.PrivateUserMessage.id}`,
											senderId: m.PrivateUserMessage.sender.id,
											receiverId: m.PrivateUserMessage.receiver.id,
											text: m.PrivateUserMessage.message.indexOf('/me ') === -1 ? m.PrivateUserMessage.message : `${m.PrivateUserMessage.message.replace(/\/me /, '_')}_`,
											ts: new Date(m.PrivateUserMessage.timestamp.split(' ')[0])
										});
									}
								}

								tempDirectMessages.set(roomIdentifier, msgs);
							} else if (dirSplit[1] === 'rooms') {
								const roomMsgs = [];

								for (const m of file) {
									if (m.UserMessage) {
										roomMsgs.push({
											type: 'user',
											id: `hipchatenterprise-${dirSplit[2]}-${m.UserMessage.id}`,
											userId: m.UserMessage.sender.id,
											text: m.UserMessage.message.indexOf('/me ') === -1 ? m.UserMessage.message : `${m.UserMessage.message.replace(/\/me /, '_')}_`,
											ts: new Date(m.UserMessage.timestamp.split(' ')[0])
										});
									} else if (m.TopicRoomMessage) {
										roomMsgs.push({
											type: 'topic',
											id: `hipchatenterprise-${dirSplit[2]}-${m.TopicRoomMessage.id}`,
											userId: m.TopicRoomMessage.sender.id,
											ts: new Date(m.TopicRoomMessage.timestamp.split(' ')[0]),
											text: m.TopicRoomMessage.message
										});
									} else {
										this.logger.warn('HipChat Enterprise importer isn\'t configured to handle this message:', m);
									}
								}

								tempMessages.set(roomIdentifier, roomMsgs);
							} else {
								this.logger.warn(`HipChat Enterprise importer isn't configured to handle "${dirSplit[1]}" files.`);
							}
						} else {
							//What are these files!?
							this.logger.warn(`HipChat Enterprise importer doesn't know what to do with the file "${header.name}" :o`, info);
						}
					}));
					stream.on('end', () => next());
					stream.on('error', () => next());
				} else {
					next();
				}
			}));
			this.extract.on('error', err => {
				this.logger.warn('extract error:', err);
				reject();
			});
			this.extract.on('finish', Meteor.bindEnvironment(() => {
				// Insert the users record, eventually this might have to be split into several ones as well
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
					'channels': tempRooms
				});
				this.channels = this.collection.findOne(channelsId);
				super.updateRecord({
					'count.channels': tempRooms.length
				});
				super.addCountToTotal(tempRooms.length); // Save the messages records to the import record for `startImport` usage

				super.updateProgress(ProgressStep.PREPARING_MESSAGES);
				let messagesCount = 0;

				for (const [channel, msgs] of tempMessages.entries()) {
					if (!this.messages.get(channel)) {
						this.messages.set(channel, new Map());
					}

					messagesCount += msgs.length;
					super.updateRecord({
						'messagesstatus': channel
					});

					if (Base.getBSONSize(msgs) > Base.getMaxBSONSize()) {
						Base.getBSONSafeArraysFromAnArray(msgs).forEach((splitMsg, i) => {
							const messagesId = this.collection.insert({
								'import': this.importRecord._id,
								'importer': this.name,
								'type': 'messages',
								'name': `${channel}/${i}`,
								'messages': splitMsg
							});
							this.messages.get(channel).set(`${channel}.${i}`, this.collection.findOne(messagesId));
						});
					} else {
						const messagesId = this.collection.insert({
							'import': this.importRecord._id,
							'importer': this.name,
							'type': 'messages',
							'name': `${channel}`,
							'messages': msgs
						});
						this.messages.get(channel).set(channel, this.collection.findOne(messagesId));
					}
				}

				for (const [directMsgUser, msgs] of tempDirectMessages.entries()) {
					this.logger.debug(`Preparing the direct messages for: ${directMsgUser}`);

					if (!this.directMessages.get(directMsgUser)) {
						this.directMessages.set(directMsgUser, new Map());
					}

					messagesCount += msgs.length;
					super.updateRecord({
						'messagesstatus': directMsgUser
					});

					if (Base.getBSONSize(msgs) > Base.getMaxBSONSize()) {
						Base.getBSONSafeArraysFromAnArray(msgs).forEach((splitMsg, i) => {
							const messagesId = this.collection.insert({
								'import': this.importRecord._id,
								'importer': this.name,
								'type': 'directMessages',
								'name': `${directMsgUser}/${i}`,
								'messages': splitMsg
							});
							this.directMessages.get(directMsgUser).set(`${directMsgUser}.${i}`, this.collection.findOne(messagesId));
						});
					} else {
						const messagesId = this.collection.insert({
							'import': this.importRecord._id,
							'importer': this.name,
							'type': 'directMessages',
							'name': `${directMsgUser}`,
							'messages': msgs
						});
						this.directMessages.get(directMsgUser).set(directMsgUser, this.collection.findOne(messagesId));
					}
				}

				super.updateRecord({
					'count.messages': messagesCount,
					'messagesstatus': null
				});
				super.addCountToTotal(messagesCount); //Ensure we have some users, channels, and messages

				if (tempUsers.length === 0 || tempRooms.length === 0 || messagesCount === 0) {
					this.logger.warn(`The loaded users count ${tempUsers.length}, the loaded rooms ${tempRooms.length}, and the loaded messages ${messagesCount}`);
					super.updateProgress(ProgressStep.ERROR);
					reject();
					return;
				}

				const selectionUsers = tempUsers.map(u => new SelectionUser(u.id, u.username, u.email, u.isDeleted, false, true));
				const selectionChannels = tempRooms.map(r => new SelectionChannel(r.id, r.name, r.isArchived, true, r.isPrivate));
				const selectionMessages = this.importRecord.count.messages;
				super.updateProgress(ProgressStep.USER_SELECTION);
				resolve(new Selection(this.name, selectionUsers, selectionChannels, selectionMessages));
			})); //Wish I could make this cleaner :(

			const split = dataURI.split(',');
			const s = new this.Readable();
			s.push(new Buffer(split[split.length - 1], 'base64'));
			s.push(null);
			s.pipe(this.zlib.createGunzip()).pipe(this.extract);
		});
		return promise;
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
					this.logger.debug(`Starting the user import: ${u.username} and are we importing them? ${u.do_import}`);

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
								}); //TODO: Use moment timezone to calc the time offset - Meteor.call 'userSetUtcOffset', user.tz_offset / 3600

								RocketChat.models.Users.setName(userId, u.name); //TODO: Think about using a custom field for the users "title" field

								if (u.avatar) {
									Meteor.call('setAvatarFromService', `data:image/png;base64,${u.avatar}`);
								} //Deleted users are 'inactive' users in Rocket.Chat


								if (u.deleted) {
									Meteor.call('setUserActiveStatus', userId, false);
								}

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
								if (u.id === c.creator && u.do_import) {
									creatorId = u.rocketId;
								}
							} //Create the channel


							Meteor.runAsUser(creatorId, () => {
								const roomInfo = Meteor.call(c.isPrivate ? 'createPrivateGroup' : 'createChannel', c.name, []);
								c.rocketId = roomInfo.rid;
							});
							RocketChat.models.Rooms.update({
								_id: c.rocketId
							}, {
								$set: {
									ts: c.created,
									topic: c.topic
								},
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
				}); //Import the Messages

				super.updateProgress(ProgressStep.IMPORTING_MESSAGES);

				for (const [ch, messagesMap] of this.messages.entries()) {
					const hipChannel = this.getChannelFromRoomIdentifier(ch);

					if (!hipChannel.do_import) {
						continue;
					}

					const room = RocketChat.models.Rooms.findOneById(hipChannel.rocketId, {
						fields: {
							usernames: 1,
							t: 1,
							name: 1
						}
					});
					Meteor.runAsUser(startedByUserId, () => {
						for (const [msgGroupData, msgs] of messagesMap.entries()) {
							super.updateRecord({
								'messagesstatus': `${ch}/${msgGroupData}.${msgs.messages.length}`
							});

							for (const msg of msgs.messages) {
								if (isNaN(msg.ts)) {
									this.logger.warn(`Timestamp on a message in ${ch}/${msgGroupData} is invalid`);
									super.addCountCompleted(1);
									continue;
								}

								const creator = this.getRocketUserFromUserId(msg.userId);

								if (creator) {
									switch (msg.type) {
										case 'user':
											RocketChat.sendMessage(creator, {
												_id: msg.id,
												ts: msg.ts,
												msg: msg.text,
												rid: room._id,
												u: {
													_id: creator._id,
													username: creator.username
												}
											}, room, true);
											break;

										case 'topic':
											RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_topic', room._id, msg.text, creator, {
												_id: msg.id,
												ts: msg.ts
											});
											break;
									}
								}

								super.addCountCompleted(1);
							}
						}
					});
				} //Import the Direct Messages


				for (const [directMsgRoom, directMessagesMap] of this.directMessages.entries()) {
					const hipUser = this.getUserFromDirectMessageIdentifier(directMsgRoom);

					if (!hipUser.do_import) {
						continue;
					} //Verify this direct message user's room is valid (confusing but idk how else to explain it)


					if (!this.getRocketUserFromUserId(hipUser.id)) {
						continue;
					}

					for (const [msgGroupData, msgs] of directMessagesMap.entries()) {
						super.updateRecord({
							'messagesstatus': `${directMsgRoom}/${msgGroupData}.${msgs.messages.length}`
						});

						for (const msg of msgs.messages) {
							if (isNaN(msg.ts)) {
								this.logger.warn(`Timestamp on a message in ${directMsgRoom}/${msgGroupData} is invalid`);
								super.addCountCompleted(1);
								continue;
							} //make sure the message sender is a valid user inside rocket.chat


							const sender = this.getRocketUserFromUserId(msg.senderId);

							if (!sender) {
								continue;
							} //make sure the receiver of the message is a valid rocket.chat user


							const receiver = this.getRocketUserFromUserId(msg.receiverId);

							if (!receiver) {
								continue;
							}

							let room = RocketChat.models.Rooms.findOneById([receiver._id, sender._id].sort().join(''));

							if (!room) {
								Meteor.runAsUser(sender._id, () => {
									const roomInfo = Meteor.call('createDirectMessage', receiver.username);
									room = RocketChat.models.Rooms.findOneById(roomInfo.rid);
								});
							}

							Meteor.runAsUser(sender._id, () => {
								RocketChat.sendMessage(sender, {
									_id: msg.id,
									ts: msg.ts,
									msg: msg.text,
									rid: room._id,
									u: {
										_id: sender._id,
										username: sender.username
									}
								}, room, true);
							});
						}
					}
				}

				super.updateProgress(ProgressStep.FINISHING);
				super.updateProgress(ProgressStep.DONE);
			} catch (e) {
				this.logger.error(e);
				super.updateProgress(ProgressStep.ERROR);
			}

			const timeTook = Date.now() - started;
			this.logger.log(`HipChat Enterprise Import took ${timeTook} milliseconds.`);
		});
		return super.getProgress();
	}

	getSelection() {
		const selectionUsers = this.users.users.map(u => new SelectionUser(u.id, u.username, u.email, false, false, true));
		const selectionChannels = this.channels.channels.map(c => new SelectionChannel(c.id, c.name, false, true, c.isPrivate));
		const selectionMessages = this.importRecord.count.messages;
		return new Selection(this.name, selectionUsers, selectionChannels, selectionMessages);
	}

	getChannelFromRoomIdentifier(roomIdentifier) {
		for (const ch of this.channels.channels) {
			if (`rooms/${ch.id}` === roomIdentifier) {
				return ch;
			}
		}
	}

	getUserFromDirectMessageIdentifier(directIdentifier) {
		for (const u of this.users.users) {
			if (`users/${u.id}` === directIdentifier) {
				return u;
			}
		}
	}

	getRocketUserFromUserId(userId) {
		for (const u of this.users.users) {
			if (u.id === userId) {
				return RocketChat.models.Users.findOneById(u.rocketId, {
					fields: {
						username: 1
					}
				});
			}
		}
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"adder.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer-hipchat-enterprise/server/adder.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
  Importers(v) {
    Importers = v;
  }

}, 0);
let HipChatEnterpriseImporterInfo;
module.watch(require("../info"), {
  HipChatEnterpriseImporterInfo(v) {
    HipChatEnterpriseImporterInfo = v;
  }

}, 1);
let HipChatEnterpriseImporter;
module.watch(require("./importer"), {
  HipChatEnterpriseImporter(v) {
    HipChatEnterpriseImporter = v;
  }

}, 2);
Importers.add(new HipChatEnterpriseImporterInfo(), HipChatEnterpriseImporter);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:importer-hipchat-enterprise/info.js");
require("./node_modules/meteor/rocketchat:importer-hipchat-enterprise/server/importer.js");
require("./node_modules/meteor/rocketchat:importer-hipchat-enterprise/server/adder.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:importer-hipchat-enterprise'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_importer-hipchat-enterprise.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1oaXBjaGF0LWVudGVycHJpc2UvaW5mby5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci1oaXBjaGF0LWVudGVycHJpc2Uvc2VydmVyL2ltcG9ydGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyLWhpcGNoYXQtZW50ZXJwcmlzZS9zZXJ2ZXIvYWRkZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiSGlwQ2hhdEVudGVycHJpc2VJbXBvcnRlckluZm8iLCJJbXBvcnRlckluZm8iLCJ3YXRjaCIsInJlcXVpcmUiLCJ2IiwiY29uc3RydWN0b3IiLCJ0ZXh0IiwiaHJlZiIsIkhpcENoYXRFbnRlcnByaXNlSW1wb3J0ZXIiLCJCYXNlIiwiUHJvZ3Jlc3NTdGVwIiwiU2VsZWN0aW9uIiwiU2VsZWN0aW9uQ2hhbm5lbCIsIlNlbGVjdGlvblVzZXIiLCJpbmZvIiwiUmVhZGFibGUiLCJ6bGliIiwidGFyU3RyZWFtIiwiTnBtIiwiZXh0cmFjdCIsInBhdGgiLCJtZXNzYWdlcyIsIk1hcCIsImRpcmVjdE1lc3NhZ2VzIiwicHJlcGFyZSIsImRhdGFVUkkiLCJzZW50Q29udGVudFR5cGUiLCJmaWxlTmFtZSIsInRlbXBVc2VycyIsInRlbXBSb29tcyIsInRlbXBNZXNzYWdlcyIsInRlbXBEaXJlY3RNZXNzYWdlcyIsInByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIm9uIiwiTWV0ZW9yIiwiYmluZEVudmlyb25tZW50IiwiaGVhZGVyIiwic3RyZWFtIiwibmV4dCIsIm5hbWUiLCJpbmRleE9mIiwicGFyc2UiLCJjaHVuayIsImxvZ2dlciIsImRlYnVnIiwiZmlsZSIsIkpTT04iLCJiYXNlIiwidXBkYXRlUHJvZ3Jlc3MiLCJQUkVQQVJJTkdfVVNFUlMiLCJ1IiwicHVzaCIsImlkIiwiVXNlciIsImVtYWlsIiwidXNlcm5hbWUiLCJtZW50aW9uX25hbWUiLCJhdmF0YXIiLCJyZXBsYWNlIiwidGltZXpvbmUiLCJpc0RlbGV0ZWQiLCJpc19kZWxldGVkIiwiUFJFUEFSSU5HX0NIQU5ORUxTIiwiciIsIlJvb20iLCJjcmVhdG9yIiwib3duZXIiLCJjcmVhdGVkIiwiRGF0ZSIsInRvTG93ZXJDYXNlIiwiaXNQcml2YXRlIiwicHJpdmFjeSIsImlzQXJjaGl2ZWQiLCJpc19hcmNoaXZlZCIsInRvcGljIiwiZGlyU3BsaXQiLCJkaXIiLCJzcGxpdCIsInJvb21JZGVudGlmaWVyIiwibXNncyIsIm0iLCJQcml2YXRlVXNlck1lc3NhZ2UiLCJ0eXBlIiwic2VuZGVySWQiLCJzZW5kZXIiLCJyZWNlaXZlcklkIiwicmVjZWl2ZXIiLCJtZXNzYWdlIiwidHMiLCJ0aW1lc3RhbXAiLCJzZXQiLCJyb29tTXNncyIsIlVzZXJNZXNzYWdlIiwidXNlcklkIiwiVG9waWNSb29tTWVzc2FnZSIsIndhcm4iLCJlcnIiLCJ1c2Vyc0lkIiwiY29sbGVjdGlvbiIsImluc2VydCIsImltcG9ydFJlY29yZCIsIl9pZCIsInVzZXJzIiwiZmluZE9uZSIsInVwZGF0ZVJlY29yZCIsImxlbmd0aCIsImFkZENvdW50VG9Ub3RhbCIsImNoYW5uZWxzSWQiLCJjaGFubmVscyIsIlBSRVBBUklOR19NRVNTQUdFUyIsIm1lc3NhZ2VzQ291bnQiLCJjaGFubmVsIiwiZW50cmllcyIsImdldCIsImdldEJTT05TaXplIiwiZ2V0TWF4QlNPTlNpemUiLCJnZXRCU09OU2FmZUFycmF5c0Zyb21BbkFycmF5IiwiZm9yRWFjaCIsInNwbGl0TXNnIiwiaSIsIm1lc3NhZ2VzSWQiLCJkaXJlY3RNc2dVc2VyIiwiRVJST1IiLCJzZWxlY3Rpb25Vc2VycyIsIm1hcCIsInNlbGVjdGlvbkNoYW5uZWxzIiwic2VsZWN0aW9uTWVzc2FnZXMiLCJjb3VudCIsIlVTRVJfU0VMRUNUSU9OIiwicyIsIkJ1ZmZlciIsInBpcGUiLCJjcmVhdGVHdW56aXAiLCJzdGFydEltcG9ydCIsImltcG9ydFNlbGVjdGlvbiIsInN0YXJ0ZWQiLCJub3ciLCJ1c2VyIiwidXNlcl9pZCIsImRvX2ltcG9ydCIsInVwZGF0ZSIsIiRzZXQiLCJjIiwiY2hhbm5lbF9pZCIsInN0YXJ0ZWRCeVVzZXJJZCIsImRlZmVyIiwiSU1QT1JUSU5HX1VTRVJTIiwicnVuQXNVc2VyIiwiZXhpc3RhbnRVc2VyIiwiUm9ja2V0Q2hhdCIsIm1vZGVscyIsIlVzZXJzIiwiZmluZE9uZUJ5RW1haWxBZGRyZXNzIiwiZmluZE9uZUJ5VXNlcm5hbWUiLCJyb2NrZXRJZCIsIiRhZGRUb1NldCIsImltcG9ydElkcyIsIkFjY291bnRzIiwiY3JlYXRlVXNlciIsInBhc3N3b3JkIiwidG9VcHBlckNhc2UiLCJjYWxsIiwiam9pbkRlZmF1bHRDaGFubmVsc1NpbGVuY2VkIiwic2V0TmFtZSIsImRlbGV0ZWQiLCJhZGRDb3VudENvbXBsZXRlZCIsIklNUE9SVElOR19DSEFOTkVMUyIsImV4aXN0YW50Um9vbSIsIlJvb21zIiwiZmluZE9uZUJ5TmFtZSIsImNyZWF0b3JJZCIsInJvb21JbmZvIiwicmlkIiwiSU1QT1JUSU5HX01FU1NBR0VTIiwiY2giLCJtZXNzYWdlc01hcCIsImhpcENoYW5uZWwiLCJnZXRDaGFubmVsRnJvbVJvb21JZGVudGlmaWVyIiwicm9vbSIsImZpbmRPbmVCeUlkIiwiZmllbGRzIiwidXNlcm5hbWVzIiwidCIsIm1zZ0dyb3VwRGF0YSIsIm1zZyIsImlzTmFOIiwiZ2V0Um9ja2V0VXNlckZyb21Vc2VySWQiLCJzZW5kTWVzc2FnZSIsIk1lc3NhZ2VzIiwiY3JlYXRlUm9vbVNldHRpbmdzQ2hhbmdlZFdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIiLCJkaXJlY3RNc2dSb29tIiwiZGlyZWN0TWVzc2FnZXNNYXAiLCJoaXBVc2VyIiwiZ2V0VXNlckZyb21EaXJlY3RNZXNzYWdlSWRlbnRpZmllciIsInNvcnQiLCJqb2luIiwiRklOSVNISU5HIiwiRE9ORSIsImUiLCJlcnJvciIsInRpbWVUb29rIiwibG9nIiwiZ2V0UHJvZ3Jlc3MiLCJnZXRTZWxlY3Rpb24iLCJkaXJlY3RJZGVudGlmaWVyIiwiSW1wb3J0ZXJzIiwiYWRkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE1BQVAsQ0FBYztBQUFDQyxnQ0FBOEIsTUFBSUE7QUFBbkMsQ0FBZDtBQUFpRixJQUFJQyxZQUFKO0FBQWlCSCxPQUFPSSxLQUFQLENBQWFDLFFBQVEsNEJBQVIsQ0FBYixFQUFtRDtBQUFDRixjQUFhRyxDQUFiLEVBQWU7QUFBQ0gsaUJBQWFHLENBQWI7QUFBZTs7QUFBaEMsQ0FBbkQsRUFBcUYsQ0FBckY7O0FBRTNGLE1BQU1KLDZCQUFOLFNBQTRDQyxZQUE1QyxDQUF5RDtBQUMvREksZUFBYztBQUNiLFFBQU0sbUJBQU4sRUFBMkIsb0JBQTNCLEVBQWlELGtCQUFqRCxFQUFxRSxDQUNwRTtBQUNDQyxTQUFNLHdDQURQO0FBRUNDLFNBQU07QUFGUCxHQURvRSxFQUlqRTtBQUNGRCxTQUFNLHdDQURKO0FBRUZDLFNBQU07QUFGSixHQUppRSxDQUFyRTtBQVNBOztBQVg4RCxDOzs7Ozs7Ozs7OztBQ0ZoRVQsT0FBT0MsTUFBUCxDQUFjO0FBQUNTLDRCQUEwQixNQUFJQTtBQUEvQixDQUFkO0FBQXlFLElBQUlDLElBQUosRUFBU0MsWUFBVCxFQUFzQkMsU0FBdEIsRUFBZ0NDLGdCQUFoQyxFQUFpREMsYUFBakQ7QUFBK0RmLE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSw0QkFBUixDQUFiLEVBQW1EO0FBQUNNLE1BQUtMLENBQUwsRUFBTztBQUFDSyxTQUFLTCxDQUFMO0FBQU8sRUFBaEI7O0FBQWlCTSxjQUFhTixDQUFiLEVBQWU7QUFBQ00saUJBQWFOLENBQWI7QUFBZSxFQUFoRDs7QUFBaURPLFdBQVVQLENBQVYsRUFBWTtBQUFDTyxjQUFVUCxDQUFWO0FBQVksRUFBMUU7O0FBQTJFUSxrQkFBaUJSLENBQWpCLEVBQW1CO0FBQUNRLHFCQUFp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LWhpcGNoYXQtZW50ZXJwcmlzZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEltcG9ydGVySW5mbyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIEhpcENoYXRFbnRlcnByaXNlSW1wb3J0ZXJJbmZvIGV4dGVuZHMgSW1wb3J0ZXJJbmZvIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ2hpcGNoYXRlbnRlcnByaXNlJywgJ0hpcENoYXQgRW50ZXJwcmlzZScsICdhcHBsaWNhdGlvbi9nemlwJywgW1xuXHRcdFx0e1xuXHRcdFx0XHR0ZXh0OiAnSW1wb3J0ZXJfSGlwQ2hhdEVudGVycHJpc2VfSW5mb3JtYXRpb24nLFxuXHRcdFx0XHRocmVmOiAnaHR0cHM6Ly9yb2NrZXQuY2hhdC9kb2NzL2FkbWluaXN0cmF0b3ItZ3VpZGVzL2ltcG9ydC9oaXBjaGF0L2VudGVycHJpc2UvJ1xuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAnSW1wb3J0ZXJfSGlwQ2hhdEVudGVycHJpc2VfQmV0YVdhcm5pbmcnLFxuXHRcdFx0XHRocmVmOiAnaHR0cHM6Ly9naXRodWIuY29tL1JvY2tldENoYXQvUm9ja2V0LkNoYXQvaXNzdWVzL25ldydcblx0XHRcdH1cblx0XHRdKTtcblx0fVxufVxuIiwiaW1wb3J0IHtcblx0QmFzZSxcblx0UHJvZ3Jlc3NTdGVwLFxuXHRTZWxlY3Rpb24sXG5cdFNlbGVjdGlvbkNoYW5uZWwsXG5cdFNlbGVjdGlvblVzZXJcbn0gZnJvbSAnbWV0ZW9yL3JvY2tldGNoYXQ6aW1wb3J0ZXInO1xuXG5leHBvcnQgY2xhc3MgSGlwQ2hhdEVudGVycHJpc2VJbXBvcnRlciBleHRlbmRzIEJhc2Uge1xuXHRjb25zdHJ1Y3RvcihpbmZvKSB7XG5cdFx0c3VwZXIoaW5mbyk7XG5cblx0XHR0aGlzLlJlYWRhYmxlID0gcmVxdWlyZSgnc3RyZWFtJykuUmVhZGFibGU7XG5cdFx0dGhpcy56bGliID0gcmVxdWlyZSgnemxpYicpO1xuXHRcdHRoaXMudGFyU3RyZWFtID0gTnBtLnJlcXVpcmUoJ3Rhci1zdHJlYW0nKTtcblx0XHR0aGlzLmV4dHJhY3QgPSB0aGlzLnRhclN0cmVhbS5leHRyYWN0KCk7XG5cdFx0dGhpcy5wYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuXHRcdHRoaXMubWVzc2FnZXMgPSBuZXcgTWFwKCk7XG5cdFx0dGhpcy5kaXJlY3RNZXNzYWdlcyA9IG5ldyBNYXAoKTtcblx0fVxuXG5cdHByZXBhcmUoZGF0YVVSSSwgc2VudENvbnRlbnRUeXBlLCBmaWxlTmFtZSkge1xuXHRcdHN1cGVyLnByZXBhcmUoZGF0YVVSSSwgc2VudENvbnRlbnRUeXBlLCBmaWxlTmFtZSk7XG5cblx0XHRjb25zdCB0ZW1wVXNlcnMgPSBbXTtcblx0XHRjb25zdCB0ZW1wUm9vbXMgPSBbXTtcblx0XHRjb25zdCB0ZW1wTWVzc2FnZXMgPSBuZXcgTWFwKCk7XG5cdFx0Y29uc3QgdGVtcERpcmVjdE1lc3NhZ2VzID0gbmV3IE1hcCgpO1xuXHRcdGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0aGlzLmV4dHJhY3Qub24oJ2VudHJ5JywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoaGVhZGVyLCBzdHJlYW0sIG5leHQpID0+IHtcblx0XHRcdFx0aWYgKGhlYWRlci5uYW1lLmluZGV4T2YoJy5qc29uJykgIT09IC0xKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMucGF0aC5wYXJzZShoZWFkZXIubmFtZSk7XG5cblx0XHRcdFx0XHRzdHJlYW0ub24oJ2RhdGEnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChjaHVuaykgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYFByb2Nlc3NpbmcgdGhlIGZpbGU6ICR7IGhlYWRlci5uYW1lIH1gKTtcblx0XHRcdFx0XHRcdGNvbnN0IGZpbGUgPSBKU09OLnBhcnNlKGNodW5rKTtcblxuXHRcdFx0XHRcdFx0aWYgKGluZm8uYmFzZSA9PT0gJ3VzZXJzLmpzb24nKSB7XG5cdFx0XHRcdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5QUkVQQVJJTkdfVVNFUlMpO1xuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHUgb2YgZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdHRlbXBVc2Vycy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiB1LlVzZXIuaWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRlbWFpbDogdS5Vc2VyLmVtYWlsLFxuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogdS5Vc2VyLm5hbWUsXG5cdFx0XHRcdFx0XHRcdFx0XHR1c2VybmFtZTogdS5Vc2VyLm1lbnRpb25fbmFtZSxcblx0XHRcdFx0XHRcdFx0XHRcdGF2YXRhcjogdS5Vc2VyLmF2YXRhci5yZXBsYWNlKC9cXG4vZywgJycpLFxuXHRcdFx0XHRcdFx0XHRcdFx0dGltZXpvbmU6IHUuVXNlci50aW1lem9uZSxcblx0XHRcdFx0XHRcdFx0XHRcdGlzRGVsZXRlZDogdS5Vc2VyLmlzX2RlbGV0ZWRcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChpbmZvLmJhc2UgPT09ICdyb29tcy5qc29uJykge1xuXHRcdFx0XHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuUFJFUEFSSU5HX0NIQU5ORUxTKTtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCByIG9mIGZpbGUpIHtcblx0XHRcdFx0XHRcdFx0XHR0ZW1wUm9vbXMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogci5Sb29tLmlkLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRvcjogci5Sb29tLm93bmVyLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlZDogbmV3IERhdGUoci5Sb29tLmNyZWF0ZWQpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogci5Sb29tLm5hbWUucmVwbGFjZSgvIC9nLCAnXycpLnRvTG93ZXJDYXNlKCksXG5cdFx0XHRcdFx0XHRcdFx0XHRpc1ByaXZhdGU6IHIuUm9vbS5wcml2YWN5ID09PSAncHJpdmF0ZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRpc0FyY2hpdmVkOiByLlJvb20uaXNfYXJjaGl2ZWQsXG5cdFx0XHRcdFx0XHRcdFx0XHR0b3BpYzogci5Sb29tLnRvcGljXG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaW5mby5iYXNlID09PSAnaGlzdG9yeS5qc29uJykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBkaXJTcGxpdCA9IGluZm8uZGlyLnNwbGl0KCcvJyk7IC8vWycuJywgJ3VzZXJzJywgJzEnXVxuXHRcdFx0XHRcdFx0XHRjb25zdCByb29tSWRlbnRpZmllciA9IGAkeyBkaXJTcGxpdFsxXSB9LyR7IGRpclNwbGl0WzJdIH1gO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChkaXJTcGxpdFsxXSA9PT0gJ3VzZXJzJykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1zZ3MgPSBbXTtcblx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IG0gb2YgZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKG0uUHJpdmF0ZVVzZXJNZXNzYWdlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG1zZ3MucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3VzZXInLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGlkOiBgaGlwY2hhdGVudGVycHJpc2UtJHsgbS5Qcml2YXRlVXNlck1lc3NhZ2UuaWQgfWAsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0c2VuZGVySWQ6IG0uUHJpdmF0ZVVzZXJNZXNzYWdlLnNlbmRlci5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZWNlaXZlcklkOiBtLlByaXZhdGVVc2VyTWVzc2FnZS5yZWNlaXZlci5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0ZXh0OiBtLlByaXZhdGVVc2VyTWVzc2FnZS5tZXNzYWdlLmluZGV4T2YoJy9tZSAnKSA9PT0gLTEgPyBtLlByaXZhdGVVc2VyTWVzc2FnZS5tZXNzYWdlIDogYCR7IG0uUHJpdmF0ZVVzZXJNZXNzYWdlLm1lc3NhZ2UucmVwbGFjZSgvXFwvbWUgLywgJ18nKSB9X2AsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHM6IG5ldyBEYXRlKG0uUHJpdmF0ZVVzZXJNZXNzYWdlLnRpbWVzdGFtcC5zcGxpdCgnICcpWzBdKVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0dGVtcERpcmVjdE1lc3NhZ2VzLnNldChyb29tSWRlbnRpZmllciwgbXNncyk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZGlyU3BsaXRbMV0gPT09ICdyb29tcycpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCByb29tTXNncyA9IFtdO1xuXG5cdFx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBtIG9mIGZpbGUpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChtLlVzZXJNZXNzYWdlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJvb21Nc2dzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICd1c2VyJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpZDogYGhpcGNoYXRlbnRlcnByaXNlLSR7IGRpclNwbGl0WzJdIH0tJHsgbS5Vc2VyTWVzc2FnZS5pZCB9YCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1c2VySWQ6IG0uVXNlck1lc3NhZ2Uuc2VuZGVyLmlkLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRleHQ6IG0uVXNlck1lc3NhZ2UubWVzc2FnZS5pbmRleE9mKCcvbWUgJykgPT09IC0xID8gbS5Vc2VyTWVzc2FnZS5tZXNzYWdlIDogYCR7IG0uVXNlck1lc3NhZ2UubWVzc2FnZS5yZXBsYWNlKC9cXC9tZSAvLCAnXycpIH1fYCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0czogbmV3IERhdGUobS5Vc2VyTWVzc2FnZS50aW1lc3RhbXAuc3BsaXQoJyAnKVswXSlcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG0uVG9waWNSb29tTWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyb29tTXNncy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAndG9waWMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGlkOiBgaGlwY2hhdGVudGVycHJpc2UtJHsgZGlyU3BsaXRbMl0gfS0keyBtLlRvcGljUm9vbU1lc3NhZ2UuaWQgfWAsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcklkOiBtLlRvcGljUm9vbU1lc3NhZ2Uuc2VuZGVyLmlkLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRzOiBuZXcgRGF0ZShtLlRvcGljUm9vbU1lc3NhZ2UudGltZXN0YW1wLnNwbGl0KCcgJylbMF0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRleHQ6IG0uVG9waWNSb29tTWVzc2FnZS5tZXNzYWdlXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5sb2dnZXIud2FybignSGlwQ2hhdCBFbnRlcnByaXNlIGltcG9ydGVyIGlzblxcJ3QgY29uZmlndXJlZCB0byBoYW5kbGUgdGhpcyBtZXNzYWdlOicsIG0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR0ZW1wTWVzc2FnZXMuc2V0KHJvb21JZGVudGlmaWVyLCByb29tTXNncyk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5sb2dnZXIud2FybihgSGlwQ2hhdCBFbnRlcnByaXNlIGltcG9ydGVyIGlzbid0IGNvbmZpZ3VyZWQgdG8gaGFuZGxlIFwiJHsgZGlyU3BsaXRbMV0gfVwiIGZpbGVzLmApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvL1doYXQgYXJlIHRoZXNlIGZpbGVzIT9cblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dnZXIud2FybihgSGlwQ2hhdCBFbnRlcnByaXNlIGltcG9ydGVyIGRvZXNuJ3Qga25vdyB3aGF0IHRvIGRvIHdpdGggdGhlIGZpbGUgXCIkeyBoZWFkZXIubmFtZSB9XCIgOm9gLCBpbmZvKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0XHRzdHJlYW0ub24oJ2VuZCcsICgpID0+IG5leHQoKSk7XG5cdFx0XHRcdFx0c3RyZWFtLm9uKCdlcnJvcicsICgpID0+IG5leHQoKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV4dCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuZXh0cmFjdC5vbignZXJyb3InLCAoZXJyKSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oJ2V4dHJhY3QgZXJyb3I6JywgZXJyKTtcblx0XHRcdFx0cmVqZWN0KCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5leHRyYWN0Lm9uKCdmaW5pc2gnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcblx0XHRcdFx0Ly8gSW5zZXJ0IHRoZSB1c2VycyByZWNvcmQsIGV2ZW50dWFsbHkgdGhpcyBtaWdodCBoYXZlIHRvIGJlIHNwbGl0IGludG8gc2V2ZXJhbCBvbmVzIGFzIHdlbGxcblx0XHRcdFx0Ly8gaWYgc29tZW9uZSB0cmllcyB0byBpbXBvcnQgYSBzZXZlcmFsIHRob3VzYW5kcyB1c2VycyBpbnN0YW5jZVxuXHRcdFx0XHRjb25zdCB1c2Vyc0lkID0gdGhpcy5jb2xsZWN0aW9uLmluc2VydCh7ICdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsICdpbXBvcnRlcic6IHRoaXMubmFtZSwgJ3R5cGUnOiAndXNlcnMnLCAndXNlcnMnOiB0ZW1wVXNlcnMgfSk7XG5cdFx0XHRcdHRoaXMudXNlcnMgPSB0aGlzLmNvbGxlY3Rpb24uZmluZE9uZSh1c2Vyc0lkKTtcblx0XHRcdFx0c3VwZXIudXBkYXRlUmVjb3JkKHsgJ2NvdW50LnVzZXJzJzogdGVtcFVzZXJzLmxlbmd0aCB9KTtcblx0XHRcdFx0c3VwZXIuYWRkQ291bnRUb1RvdGFsKHRlbXBVc2Vycy5sZW5ndGgpO1xuXG5cdFx0XHRcdC8vIEluc2VydCB0aGUgY2hhbm5lbHMgcmVjb3Jkcy5cblx0XHRcdFx0Y29uc3QgY2hhbm5lbHNJZCA9IHRoaXMuY29sbGVjdGlvbi5pbnNlcnQoeyAnaW1wb3J0JzogdGhpcy5pbXBvcnRSZWNvcmQuX2lkLCAnaW1wb3J0ZXInOiB0aGlzLm5hbWUsICd0eXBlJzogJ2NoYW5uZWxzJywgJ2NoYW5uZWxzJzogdGVtcFJvb21zIH0pO1xuXHRcdFx0XHR0aGlzLmNoYW5uZWxzID0gdGhpcy5jb2xsZWN0aW9uLmZpbmRPbmUoY2hhbm5lbHNJZCk7XG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVJlY29yZCh7ICdjb3VudC5jaGFubmVscyc6IHRlbXBSb29tcy5sZW5ndGggfSk7XG5cdFx0XHRcdHN1cGVyLmFkZENvdW50VG9Ub3RhbCh0ZW1wUm9vbXMubGVuZ3RoKTtcblxuXHRcdFx0XHQvLyBTYXZlIHRoZSBtZXNzYWdlcyByZWNvcmRzIHRvIHRoZSBpbXBvcnQgcmVjb3JkIGZvciBgc3RhcnRJbXBvcnRgIHVzYWdlXG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5QUkVQQVJJTkdfTUVTU0FHRVMpO1xuXHRcdFx0XHRsZXQgbWVzc2FnZXNDb3VudCA9IDA7XG5cdFx0XHRcdGZvciAoY29uc3QgW2NoYW5uZWwsIG1zZ3NdIG9mIHRlbXBNZXNzYWdlcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMubWVzc2FnZXMuZ2V0KGNoYW5uZWwpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm1lc3NhZ2VzLnNldChjaGFubmVsLCBuZXcgTWFwKCkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG1lc3NhZ2VzQ291bnQgKz0gbXNncy5sZW5ndGg7XG5cdFx0XHRcdFx0c3VwZXIudXBkYXRlUmVjb3JkKHsgJ21lc3NhZ2Vzc3RhdHVzJzogY2hhbm5lbCB9KTtcblxuXHRcdFx0XHRcdGlmIChCYXNlLmdldEJTT05TaXplKG1zZ3MpID4gQmFzZS5nZXRNYXhCU09OU2l6ZSgpKSB7XG5cdFx0XHRcdFx0XHRCYXNlLmdldEJTT05TYWZlQXJyYXlzRnJvbUFuQXJyYXkobXNncykuZm9yRWFjaCgoc3BsaXRNc2csIGkpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWVzc2FnZXNJZCA9IHRoaXMuY29sbGVjdGlvbi5pbnNlcnQoeyAnaW1wb3J0JzogdGhpcy5pbXBvcnRSZWNvcmQuX2lkLCAnaW1wb3J0ZXInOiB0aGlzLm5hbWUsICd0eXBlJzogJ21lc3NhZ2VzJywgJ25hbWUnOiBgJHsgY2hhbm5lbCB9LyR7IGkgfWAsICdtZXNzYWdlcyc6IHNwbGl0TXNnIH0pO1xuXHRcdFx0XHRcdFx0XHR0aGlzLm1lc3NhZ2VzLmdldChjaGFubmVsKS5zZXQoYCR7IGNoYW5uZWwgfS4keyBpIH1gLCB0aGlzLmNvbGxlY3Rpb24uZmluZE9uZShtZXNzYWdlc0lkKSk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWVzc2FnZXNJZCA9IHRoaXMuY29sbGVjdGlvbi5pbnNlcnQoeyAnaW1wb3J0JzogdGhpcy5pbXBvcnRSZWNvcmQuX2lkLCAnaW1wb3J0ZXInOiB0aGlzLm5hbWUsICd0eXBlJzogJ21lc3NhZ2VzJywgJ25hbWUnOiBgJHsgY2hhbm5lbCB9YCwgJ21lc3NhZ2VzJzogbXNncyB9KTtcblx0XHRcdFx0XHRcdHRoaXMubWVzc2FnZXMuZ2V0KGNoYW5uZWwpLnNldChjaGFubmVsLCB0aGlzLmNvbGxlY3Rpb24uZmluZE9uZShtZXNzYWdlc0lkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChjb25zdCBbZGlyZWN0TXNnVXNlciwgbXNnc10gb2YgdGVtcERpcmVjdE1lc3NhZ2VzLmVudHJpZXMoKSkge1xuXHRcdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBQcmVwYXJpbmcgdGhlIGRpcmVjdCBtZXNzYWdlcyBmb3I6ICR7IGRpcmVjdE1zZ1VzZXIgfWApO1xuXHRcdFx0XHRcdGlmICghdGhpcy5kaXJlY3RNZXNzYWdlcy5nZXQoZGlyZWN0TXNnVXNlcikpIHtcblx0XHRcdFx0XHRcdHRoaXMuZGlyZWN0TWVzc2FnZXMuc2V0KGRpcmVjdE1zZ1VzZXIsIG5ldyBNYXAoKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bWVzc2FnZXNDb3VudCArPSBtc2dzLmxlbmd0aDtcblx0XHRcdFx0XHRzdXBlci51cGRhdGVSZWNvcmQoeyAnbWVzc2FnZXNzdGF0dXMnOiBkaXJlY3RNc2dVc2VyIH0pO1xuXG5cdFx0XHRcdFx0aWYgKEJhc2UuZ2V0QlNPTlNpemUobXNncykgPiBCYXNlLmdldE1heEJTT05TaXplKCkpIHtcblx0XHRcdFx0XHRcdEJhc2UuZ2V0QlNPTlNhZmVBcnJheXNGcm9tQW5BcnJheShtc2dzKS5mb3JFYWNoKChzcGxpdE1zZywgaSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlc0lkID0gdGhpcy5jb2xsZWN0aW9uLmluc2VydCh7ICdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsICdpbXBvcnRlcic6IHRoaXMubmFtZSwgJ3R5cGUnOiAnZGlyZWN0TWVzc2FnZXMnLCAnbmFtZSc6IGAkeyBkaXJlY3RNc2dVc2VyIH0vJHsgaSB9YCwgJ21lc3NhZ2VzJzogc3BsaXRNc2cgfSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlyZWN0TWVzc2FnZXMuZ2V0KGRpcmVjdE1zZ1VzZXIpLnNldChgJHsgZGlyZWN0TXNnVXNlciB9LiR7IGkgfWAsIHRoaXMuY29sbGVjdGlvbi5maW5kT25lKG1lc3NhZ2VzSWQpKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlc0lkID0gdGhpcy5jb2xsZWN0aW9uLmluc2VydCh7ICdpbXBvcnQnOiB0aGlzLmltcG9ydFJlY29yZC5faWQsICdpbXBvcnRlcic6IHRoaXMubmFtZSwgJ3R5cGUnOiAnZGlyZWN0TWVzc2FnZXMnLCAnbmFtZSc6IGAkeyBkaXJlY3RNc2dVc2VyIH1gLCAnbWVzc2FnZXMnOiBtc2dzIH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5kaXJlY3RNZXNzYWdlcy5nZXQoZGlyZWN0TXNnVXNlcikuc2V0KGRpcmVjdE1zZ1VzZXIsIHRoaXMuY29sbGVjdGlvbi5maW5kT25lKG1lc3NhZ2VzSWQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzdXBlci51cGRhdGVSZWNvcmQoeyAnY291bnQubWVzc2FnZXMnOiBtZXNzYWdlc0NvdW50LCAnbWVzc2FnZXNzdGF0dXMnOiBudWxsIH0pO1xuXHRcdFx0XHRzdXBlci5hZGRDb3VudFRvVG90YWwobWVzc2FnZXNDb3VudCk7XG5cblx0XHRcdFx0Ly9FbnN1cmUgd2UgaGF2ZSBzb21lIHVzZXJzLCBjaGFubmVscywgYW5kIG1lc3NhZ2VzXG5cdFx0XHRcdGlmICh0ZW1wVXNlcnMubGVuZ3RoID09PSAwIHx8IHRlbXBSb29tcy5sZW5ndGggPT09IDAgfHwgbWVzc2FnZXNDb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYFRoZSBsb2FkZWQgdXNlcnMgY291bnQgJHsgdGVtcFVzZXJzLmxlbmd0aCB9LCB0aGUgbG9hZGVkIHJvb21zICR7IHRlbXBSb29tcy5sZW5ndGggfSwgYW5kIHRoZSBsb2FkZWQgbWVzc2FnZXMgJHsgbWVzc2FnZXNDb3VudCB9YCk7XG5cdFx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLkVSUk9SKTtcblx0XHRcdFx0XHRyZWplY3QoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25Vc2VycyA9IHRlbXBVc2Vycy5tYXAoKHUpID0+IG5ldyBTZWxlY3Rpb25Vc2VyKHUuaWQsIHUudXNlcm5hbWUsIHUuZW1haWwsIHUuaXNEZWxldGVkLCBmYWxzZSwgdHJ1ZSkpO1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25DaGFubmVscyA9IHRlbXBSb29tcy5tYXAoKHIpID0+IG5ldyBTZWxlY3Rpb25DaGFubmVsKHIuaWQsIHIubmFtZSwgci5pc0FyY2hpdmVkLCB0cnVlLCByLmlzUHJpdmF0ZSkpO1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25NZXNzYWdlcyA9IHRoaXMuaW1wb3J0UmVjb3JkLmNvdW50Lm1lc3NhZ2VzO1xuXG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5VU0VSX1NFTEVDVElPTik7XG5cblx0XHRcdFx0cmVzb2x2ZShuZXcgU2VsZWN0aW9uKHRoaXMubmFtZSwgc2VsZWN0aW9uVXNlcnMsIHNlbGVjdGlvbkNoYW5uZWxzLCBzZWxlY3Rpb25NZXNzYWdlcykpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHQvL1dpc2ggSSBjb3VsZCBtYWtlIHRoaXMgY2xlYW5lciA6KFxuXHRcdFx0Y29uc3Qgc3BsaXQgPSBkYXRhVVJJLnNwbGl0KCcsJyk7XG5cdFx0XHRjb25zdCBzID0gbmV3IHRoaXMuUmVhZGFibGU7XG5cdFx0XHRzLnB1c2gobmV3IEJ1ZmZlcihzcGxpdFtzcGxpdC5sZW5ndGggLSAxXSwgJ2Jhc2U2NCcpKTtcblx0XHRcdHMucHVzaChudWxsKTtcblx0XHRcdHMucGlwZSh0aGlzLnpsaWIuY3JlYXRlR3VuemlwKCkpLnBpcGUodGhpcy5leHRyYWN0KTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwcm9taXNlO1xuXHR9XG5cblx0c3RhcnRJbXBvcnQoaW1wb3J0U2VsZWN0aW9uKSB7XG5cdFx0c3VwZXIuc3RhcnRJbXBvcnQoaW1wb3J0U2VsZWN0aW9uKTtcblx0XHRjb25zdCBzdGFydGVkID0gRGF0ZS5ub3coKTtcblxuXHRcdC8vRW5zdXJlIHdlJ3JlIG9ubHkgZ29pbmcgdG8gaW1wb3J0IHRoZSB1c2VycyB0aGF0IHRoZSB1c2VyIGhhcyBzZWxlY3RlZFxuXHRcdGZvciAoY29uc3QgdXNlciBvZiBpbXBvcnRTZWxlY3Rpb24udXNlcnMpIHtcblx0XHRcdGZvciAoY29uc3QgdSBvZiB0aGlzLnVzZXJzLnVzZXJzKSB7XG5cdFx0XHRcdGlmICh1LmlkID09PSB1c2VyLnVzZXJfaWQpIHtcblx0XHRcdFx0XHR1LmRvX2ltcG9ydCA9IHVzZXIuZG9faW1wb3J0O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuY29sbGVjdGlvbi51cGRhdGUoeyBfaWQ6IHRoaXMudXNlcnMuX2lkIH0sIHsgJHNldDogeyAndXNlcnMnOiB0aGlzLnVzZXJzLnVzZXJzIH19KTtcblxuXHRcdC8vRW5zdXJlIHdlJ3JlIG9ubHkgaW1wb3J0aW5nIHRoZSBjaGFubmVscyB0aGUgdXNlciBoYXMgc2VsZWN0ZWQuXG5cdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGltcG9ydFNlbGVjdGlvbi5jaGFubmVscykge1xuXHRcdFx0Zm9yIChjb25zdCBjIG9mIHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMpIHtcblx0XHRcdFx0aWYgKGMuaWQgPT09IGNoYW5uZWwuY2hhbm5lbF9pZCkge1xuXHRcdFx0XHRcdGMuZG9faW1wb3J0ID0gY2hhbm5lbC5kb19pbXBvcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5jb2xsZWN0aW9uLnVwZGF0ZSh7IF9pZDogdGhpcy5jaGFubmVscy5faWQgfSwgeyAkc2V0OiB7ICdjaGFubmVscyc6IHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMgfX0pO1xuXG5cdFx0Y29uc3Qgc3RhcnRlZEJ5VXNlcklkID0gTWV0ZW9yLnVzZXJJZCgpO1xuXHRcdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuSU1QT1JUSU5HX1VTRVJTKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly9JbXBvcnQgdGhlIHVzZXJzXG5cdFx0XHRcdGZvciAoY29uc3QgdSBvZiB0aGlzLnVzZXJzLnVzZXJzKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoYFN0YXJ0aW5nIHRoZSB1c2VyIGltcG9ydDogJHsgdS51c2VybmFtZSB9IGFuZCBhcmUgd2UgaW1wb3J0aW5nIHRoZW0/ICR7IHUuZG9faW1wb3J0IH1gKTtcblx0XHRcdFx0XHRpZiAoIXUuZG9faW1wb3J0KSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKHN0YXJ0ZWRCeVVzZXJJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0bGV0IGV4aXN0YW50VXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUVtYWlsQWRkcmVzcyh1LmVtYWlsKTtcblxuXHRcdFx0XHRcdFx0Ly9JZiB3ZSBjb3VsZG4ndCBmaW5kIG9uZSBieSB0aGVpciBlbWFpbCBhZGRyZXNzLCB0cnkgdG8gZmluZCBhbiBleGlzdGluZyB1c2VyIGJ5IHRoZWlyIHVzZXJuYW1lXG5cdFx0XHRcdFx0XHRpZiAoIWV4aXN0YW50VXNlcikge1xuXHRcdFx0XHRcdFx0XHRleGlzdGFudFVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1LnVzZXJuYW1lKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKGV4aXN0YW50VXNlcikge1xuXHRcdFx0XHRcdFx0XHQvL3NpbmNlIHdlIGhhdmUgYW4gZXhpc3RpbmcgdXNlciwgbGV0J3MgdHJ5IGEgZmV3IHRoaW5nc1xuXHRcdFx0XHRcdFx0XHR1LnJvY2tldElkID0gZXhpc3RhbnRVc2VyLl9pZDtcblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMudXBkYXRlKHsgX2lkOiB1LnJvY2tldElkIH0sIHsgJGFkZFRvU2V0OiB7IGltcG9ydElkczogdS5pZCB9IH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdXNlcklkID0gQWNjb3VudHMuY3JlYXRlVXNlcih7IGVtYWlsOiB1LmVtYWlsLCBwYXNzd29yZDogRGF0ZS5ub3coKSArIHUubmFtZSArIHUuZW1haWwudG9VcHBlckNhc2UoKSB9KTtcblx0XHRcdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcih1c2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRNZXRlb3IuY2FsbCgnc2V0VXNlcm5hbWUnLCB1LnVzZXJuYW1lLCB7am9pbkRlZmF1bHRDaGFubmVsc1NpbGVuY2VkOiB0cnVlfSk7XG5cdFx0XHRcdFx0XHRcdFx0Ly9UT0RPOiBVc2UgbW9tZW50IHRpbWV6b25lIHRvIGNhbGMgdGhlIHRpbWUgb2Zmc2V0IC0gTWV0ZW9yLmNhbGwgJ3VzZXJTZXRVdGNPZmZzZXQnLCB1c2VyLnR6X29mZnNldCAvIDM2MDBcblx0XHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5zZXROYW1lKHVzZXJJZCwgdS5uYW1lKTtcblx0XHRcdFx0XHRcdFx0XHQvL1RPRE86IFRoaW5rIGFib3V0IHVzaW5nIGEgY3VzdG9tIGZpZWxkIGZvciB0aGUgdXNlcnMgXCJ0aXRsZVwiIGZpZWxkXG5cblx0XHRcdFx0XHRcdFx0XHRpZiAodS5hdmF0YXIpIHtcblx0XHRcdFx0XHRcdFx0XHRcdE1ldGVvci5jYWxsKCdzZXRBdmF0YXJGcm9tU2VydmljZScsIGBkYXRhOmltYWdlL3BuZztiYXNlNjQsJHsgdS5hdmF0YXIgfWApO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdC8vRGVsZXRlZCB1c2VycyBhcmUgJ2luYWN0aXZlJyB1c2VycyBpbiBSb2NrZXQuQ2hhdFxuXHRcdFx0XHRcdFx0XHRcdGlmICh1LmRlbGV0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdE1ldGVvci5jYWxsKCdzZXRVc2VyQWN0aXZlU3RhdHVzJywgdXNlcklkLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMudXBkYXRlKHsgX2lkOiB1c2VySWQgfSwgeyAkYWRkVG9TZXQ6IHsgaW1wb3J0SWRzOiB1LmlkIH0gfSk7XG5cdFx0XHRcdFx0XHRcdFx0dS5yb2NrZXRJZCA9IHVzZXJJZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHN1cGVyLmFkZENvdW50Q29tcGxldGVkKDEpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY29sbGVjdGlvbi51cGRhdGUoeyBfaWQ6IHRoaXMudXNlcnMuX2lkIH0sIHsgJHNldDogeyAndXNlcnMnOiB0aGlzLnVzZXJzLnVzZXJzIH19KTtcblxuXHRcdFx0XHQvL0ltcG9ydCB0aGUgY2hhbm5lbHNcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLklNUE9SVElOR19DSEFOTkVMUyk7XG5cdFx0XHRcdGZvciAoY29uc3QgYyBvZiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzKSB7XG5cdFx0XHRcdFx0aWYgKCFjLmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcihzdGFydGVkQnlVc2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4aXN0YW50Um9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeU5hbWUoYy5uYW1lKTtcblx0XHRcdFx0XHRcdC8vSWYgdGhlIHJvb20gZXhpc3RzIG9yIHRoZSBuYW1lIG9mIGl0IGlzICdnZW5lcmFsJywgdGhlbiB3ZSBkb24ndCBuZWVkIHRvIGNyZWF0ZSBpdCBhZ2FpblxuXHRcdFx0XHRcdFx0aWYgKGV4aXN0YW50Um9vbSB8fCBjLm5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ0dFTkVSQUwnKSB7XG5cdFx0XHRcdFx0XHRcdGMucm9ja2V0SWQgPSBjLm5hbWUudG9VcHBlckNhc2UoKSA9PT0gJ0dFTkVSQUwnID8gJ0dFTkVSQUwnIDogZXhpc3RhbnRSb29tLl9pZDtcblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudXBkYXRlKHsgX2lkOiBjLnJvY2tldElkIH0sIHsgJGFkZFRvU2V0OiB7IGltcG9ydElkczogYy5pZCB9IH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly9GaW5kIHRoZSByb2NrZXRjaGF0SWQgb2YgdGhlIHVzZXIgd2hvIGNyZWF0ZWQgdGhpcyBjaGFubmVsXG5cdFx0XHRcdFx0XHRcdGxldCBjcmVhdG9ySWQgPSBzdGFydGVkQnlVc2VySWQ7XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgdSBvZiB0aGlzLnVzZXJzLnVzZXJzKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHUuaWQgPT09IGMuY3JlYXRvciAmJiB1LmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRvcklkID0gdS5yb2NrZXRJZDtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHQvL0NyZWF0ZSB0aGUgY2hhbm5lbFxuXHRcdFx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKGNyZWF0b3JJZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJvb21JbmZvID0gTWV0ZW9yLmNhbGwoYy5pc1ByaXZhdGUgPyAnY3JlYXRlUHJpdmF0ZUdyb3VwJyA6ICdjcmVhdGVDaGFubmVsJywgYy5uYW1lLCBbXSk7XG5cdFx0XHRcdFx0XHRcdFx0Yy5yb2NrZXRJZCA9IHJvb21JbmZvLnJpZDtcblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudXBkYXRlKHsgX2lkOiBjLnJvY2tldElkIH0sIHsgJHNldDogeyB0czogYy5jcmVhdGVkLCB0b3BpYzogYy50b3BpYyB9LCAkYWRkVG9TZXQ6IHsgaW1wb3J0SWRzOiBjLmlkIH0gfSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHN1cGVyLmFkZENvdW50Q29tcGxldGVkKDEpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuY29sbGVjdGlvbi51cGRhdGUoeyBfaWQ6IHRoaXMuY2hhbm5lbHMuX2lkIH0sIHsgJHNldDogeyAnY2hhbm5lbHMnOiB0aGlzLmNoYW5uZWxzLmNoYW5uZWxzIH19KTtcblxuXHRcdFx0XHQvL0ltcG9ydCB0aGUgTWVzc2FnZXNcblx0XHRcdFx0c3VwZXIudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLklNUE9SVElOR19NRVNTQUdFUyk7XG5cdFx0XHRcdGZvciAoY29uc3QgW2NoLCBtZXNzYWdlc01hcF0gb2YgdGhpcy5tZXNzYWdlcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0XHRjb25zdCBoaXBDaGFubmVsID0gdGhpcy5nZXRDaGFubmVsRnJvbVJvb21JZGVudGlmaWVyKGNoKTtcblx0XHRcdFx0XHRpZiAoIWhpcENoYW5uZWwuZG9faW1wb3J0KSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQoaGlwQ2hhbm5lbC5yb2NrZXRJZCwgeyBmaWVsZHM6IHsgdXNlcm5hbWVzOiAxLCB0OiAxLCBuYW1lOiAxIH0gfSk7XG5cdFx0XHRcdFx0TWV0ZW9yLnJ1bkFzVXNlcihzdGFydGVkQnlVc2VySWQsICgpID0+IHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgW21zZ0dyb3VwRGF0YSwgbXNnc10gb2YgbWVzc2FnZXNNYXAuZW50cmllcygpKSB7XG5cdFx0XHRcdFx0XHRcdHN1cGVyLnVwZGF0ZVJlY29yZCh7ICdtZXNzYWdlc3N0YXR1cyc6IGAkeyBjaCB9LyR7IG1zZ0dyb3VwRGF0YSB9LiR7IG1zZ3MubWVzc2FnZXMubGVuZ3RoIH1gIH0pO1xuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IG1zZyBvZiBtc2dzLm1lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGlzTmFOKG1zZy50cykpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYFRpbWVzdGFtcCBvbiBhIG1lc3NhZ2UgaW4gJHsgY2ggfS8keyBtc2dHcm91cERhdGEgfSBpcyBpbnZhbGlkYCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRzdXBlci5hZGRDb3VudENvbXBsZXRlZCgxKTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNyZWF0b3IgPSB0aGlzLmdldFJvY2tldFVzZXJGcm9tVXNlcklkKG1zZy51c2VySWQpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChjcmVhdG9yKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRzd2l0Y2ggKG1zZy50eXBlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNhc2UgJ3VzZXInOlxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFJvY2tldENoYXQuc2VuZE1lc3NhZ2UoY3JlYXRvciwge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0X2lkOiBtc2cuaWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0czogbXNnLnRzLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bXNnOiBtc2cudGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJpZDogcm9vbS5faWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF9pZDogY3JlYXRvci5faWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJuYW1lOiBjcmVhdG9yLnVzZXJuYW1lXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSwgcm9vbSwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNhc2UgJ3RvcGljJzpcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVSb29tU2V0dGluZ3NDaGFuZ2VkV2l0aFR5cGVSb29tSWRNZXNzYWdlQW5kVXNlcigncm9vbV9jaGFuZ2VkX3RvcGljJywgcm9vbS5faWQsIG1zZy50ZXh0LCBjcmVhdG9yLCB7IF9pZDogbXNnLmlkLCB0czogbXNnLnRzIH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdHN1cGVyLmFkZENvdW50Q29tcGxldGVkKDEpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL0ltcG9ydCB0aGUgRGlyZWN0IE1lc3NhZ2VzXG5cdFx0XHRcdGZvciAoY29uc3QgW2RpcmVjdE1zZ1Jvb20sIGRpcmVjdE1lc3NhZ2VzTWFwXSBvZiB0aGlzLmRpcmVjdE1lc3NhZ2VzLmVudHJpZXMoKSkge1xuXHRcdFx0XHRcdGNvbnN0IGhpcFVzZXIgPSB0aGlzLmdldFVzZXJGcm9tRGlyZWN0TWVzc2FnZUlkZW50aWZpZXIoZGlyZWN0TXNnUm9vbSk7XG5cdFx0XHRcdFx0aWYgKCFoaXBVc2VyLmRvX2ltcG9ydCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly9WZXJpZnkgdGhpcyBkaXJlY3QgbWVzc2FnZSB1c2VyJ3Mgcm9vbSBpcyB2YWxpZCAoY29uZnVzaW5nIGJ1dCBpZGsgaG93IGVsc2UgdG8gZXhwbGFpbiBpdClcblx0XHRcdFx0XHRpZiAoIXRoaXMuZ2V0Um9ja2V0VXNlckZyb21Vc2VySWQoaGlwVXNlci5pZCkpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGZvciAoY29uc3QgW21zZ0dyb3VwRGF0YSwgbXNnc10gb2YgZGlyZWN0TWVzc2FnZXNNYXAuZW50cmllcygpKSB7XG5cdFx0XHRcdFx0XHRzdXBlci51cGRhdGVSZWNvcmQoeyAnbWVzc2FnZXNzdGF0dXMnOiBgJHsgZGlyZWN0TXNnUm9vbSB9LyR7IG1zZ0dyb3VwRGF0YSB9LiR7IG1zZ3MubWVzc2FnZXMubGVuZ3RoIH1gIH0pO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBtc2cgb2YgbXNncy5tZXNzYWdlcykge1xuXHRcdFx0XHRcdFx0XHRpZiAoaXNOYU4obXNnLnRzKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLndhcm4oYFRpbWVzdGFtcCBvbiBhIG1lc3NhZ2UgaW4gJHsgZGlyZWN0TXNnUm9vbSB9LyR7IG1zZ0dyb3VwRGF0YSB9IGlzIGludmFsaWRgKTtcblx0XHRcdFx0XHRcdFx0XHRzdXBlci5hZGRDb3VudENvbXBsZXRlZCgxKTtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdC8vbWFrZSBzdXJlIHRoZSBtZXNzYWdlIHNlbmRlciBpcyBhIHZhbGlkIHVzZXIgaW5zaWRlIHJvY2tldC5jaGF0XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHNlbmRlciA9IHRoaXMuZ2V0Um9ja2V0VXNlckZyb21Vc2VySWQobXNnLnNlbmRlcklkKTtcblx0XHRcdFx0XHRcdFx0aWYgKCFzZW5kZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdC8vbWFrZSBzdXJlIHRoZSByZWNlaXZlciBvZiB0aGUgbWVzc2FnZSBpcyBhIHZhbGlkIHJvY2tldC5jaGF0IHVzZXJcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVjZWl2ZXIgPSB0aGlzLmdldFJvY2tldFVzZXJGcm9tVXNlcklkKG1zZy5yZWNlaXZlcklkKTtcblx0XHRcdFx0XHRcdFx0aWYgKCFyZWNlaXZlcikge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0bGV0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChbcmVjZWl2ZXIuX2lkLCBzZW5kZXIuX2lkXS5zb3J0KCkuam9pbignJykpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIXJvb20pIHtcblx0XHRcdFx0XHRcdFx0XHRNZXRlb3IucnVuQXNVc2VyKHNlbmRlci5faWQsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJvb21JbmZvID0gTWV0ZW9yLmNhbGwoJ2NyZWF0ZURpcmVjdE1lc3NhZ2UnLCByZWNlaXZlci51c2VybmFtZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRyb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQocm9vbUluZm8ucmlkKTtcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIoc2VuZGVyLl9pZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFJvY2tldENoYXQuc2VuZE1lc3NhZ2Uoc2VuZGVyLCB7XG5cdFx0XHRcdFx0XHRcdFx0XHRfaWQ6IG1zZy5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdHRzOiBtc2cudHMsXG5cdFx0XHRcdFx0XHRcdFx0XHRtc2c6IG1zZy50ZXh0LFxuXHRcdFx0XHRcdFx0XHRcdFx0cmlkOiByb29tLl9pZCxcblx0XHRcdFx0XHRcdFx0XHRcdHU6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0X2lkOiBzZW5kZXIuX2lkLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR1c2VybmFtZTogc2VuZGVyLnVzZXJuYW1lXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSwgcm9vbSwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN1cGVyLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5GSU5JU0hJTkcpO1xuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRE9ORSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGUpO1xuXHRcdFx0XHRzdXBlci51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuRVJST1IpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aW1lVG9vayA9IERhdGUubm93KCkgLSBzdGFydGVkO1xuXHRcdFx0dGhpcy5sb2dnZXIubG9nKGBIaXBDaGF0IEVudGVycHJpc2UgSW1wb3J0IHRvb2sgJHsgdGltZVRvb2sgfSBtaWxsaXNlY29uZHMuYCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gc3VwZXIuZ2V0UHJvZ3Jlc3MoKTtcblx0fVxuXG5cdGdldFNlbGVjdGlvbigpIHtcblx0XHRjb25zdCBzZWxlY3Rpb25Vc2VycyA9IHRoaXMudXNlcnMudXNlcnMubWFwKCh1KSA9PiBuZXcgU2VsZWN0aW9uVXNlcih1LmlkLCB1LnVzZXJuYW1lLCB1LmVtYWlsLCBmYWxzZSwgZmFsc2UsIHRydWUpKTtcblx0XHRjb25zdCBzZWxlY3Rpb25DaGFubmVscyA9IHRoaXMuY2hhbm5lbHMuY2hhbm5lbHMubWFwKChjKSA9PiBuZXcgU2VsZWN0aW9uQ2hhbm5lbChjLmlkLCBjLm5hbWUsIGZhbHNlLCB0cnVlLCBjLmlzUHJpdmF0ZSkpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbk1lc3NhZ2VzID0gdGhpcy5pbXBvcnRSZWNvcmQuY291bnQubWVzc2FnZXM7XG5cblx0XHRyZXR1cm4gbmV3IFNlbGVjdGlvbih0aGlzLm5hbWUsIHNlbGVjdGlvblVzZXJzLCBzZWxlY3Rpb25DaGFubmVscywgc2VsZWN0aW9uTWVzc2FnZXMpO1xuXHR9XG5cblx0Z2V0Q2hhbm5lbEZyb21Sb29tSWRlbnRpZmllcihyb29tSWRlbnRpZmllcikge1xuXHRcdGZvciAoY29uc3QgY2ggb2YgdGhpcy5jaGFubmVscy5jaGFubmVscykge1xuXHRcdFx0aWYgKGByb29tcy8keyBjaC5pZCB9YCA9PT0gcm9vbUlkZW50aWZpZXIpIHtcblx0XHRcdFx0cmV0dXJuIGNoO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldFVzZXJGcm9tRGlyZWN0TWVzc2FnZUlkZW50aWZpZXIoZGlyZWN0SWRlbnRpZmllcikge1xuXHRcdGZvciAoY29uc3QgdSBvZiB0aGlzLnVzZXJzLnVzZXJzKSB7XG5cdFx0XHRpZiAoYHVzZXJzLyR7IHUuaWQgfWAgPT09IGRpcmVjdElkZW50aWZpZXIpIHtcblx0XHRcdFx0cmV0dXJuIHU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0Um9ja2V0VXNlckZyb21Vc2VySWQodXNlcklkKSB7XG5cdFx0Zm9yIChjb25zdCB1IG9mIHRoaXMudXNlcnMudXNlcnMpIHtcblx0XHRcdGlmICh1LmlkID09PSB1c2VySWQpIHtcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHUucm9ja2V0SWQsIHsgZmllbGRzOiB7IHVzZXJuYW1lOiAxIH19KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cbiIsImltcG9ydCB7IEltcG9ydGVycyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcbmltcG9ydCB7IEhpcENoYXRFbnRlcnByaXNlSW1wb3J0ZXJJbmZvIH0gZnJvbSAnLi4vaW5mbyc7XG5pbXBvcnQgeyBIaXBDaGF0RW50ZXJwcmlzZUltcG9ydGVyIH0gZnJvbSAnLi9pbXBvcnRlcic7XG5cbkltcG9ydGVycy5hZGQobmV3IEhpcENoYXRFbnRlcnByaXNlSW1wb3J0ZXJJbmZvKCksIEhpcENoYXRFbnRlcnByaXNlSW1wb3J0ZXIpO1xuIl19
