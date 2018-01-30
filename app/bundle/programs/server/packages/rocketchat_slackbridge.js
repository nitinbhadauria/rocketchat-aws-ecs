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
var logger, slackMsgTxt, rocketUser;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:slackbridge":{"server":{"logger.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_slackbridge/server/logger.js                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals logger:true */ /* exported logger */logger = new Logger('SlackBridge', {
	sections: {
		connection: 'Connection',
		events: 'Events',
		class: 'Class'
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_slackbridge/server/settings.js                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.startup(function () {
	RocketChat.settings.addGroup('SlackBridge', function () {
		this.add('SlackBridge_Enabled', false, {
			type: 'boolean',
			i18nLabel: 'Enabled',
			public: true
		});
		this.add('SlackBridge_APIToken', '', {
			type: 'string',
			enableQuery: {
				_id: 'SlackBridge_Enabled',
				value: true
			},
			i18nLabel: 'API_Token'
		});
		this.add('SlackBridge_AliasFormat', '', {
			type: 'string',
			enableQuery: {
				_id: 'SlackBridge_Enabled',
				value: true
			},
			i18nLabel: 'Alias_Format',
			i18nDescription: 'Alias_Format_Description'
		});
		this.add('SlackBridge_ExcludeBotnames', '', {
			type: 'string',
			enableQuery: {
				_id: 'SlackBridge_Enabled',
				value: true
			},
			i18nLabel: 'Exclude_Botnames',
			i18nDescription: 'Exclude_Botnames_Description'
		});
		this.add('SlackBridge_Out_Enabled', false, {
			type: 'boolean',
			enableQuery: {
				_id: 'SlackBridge_Enabled',
				value: true
			}
		});
		this.add('SlackBridge_Out_All', false, {
			type: 'boolean',
			enableQuery: [{
				_id: 'SlackBridge_Enabled',
				value: true
			}, {
				_id: 'SlackBridge_Out_Enabled',
				value: true
			}]
		});
		this.add('SlackBridge_Out_Channels', '', {
			type: 'roomPick',
			enableQuery: [{
				_id: 'SlackBridge_Enabled',
				value: true
			}, {
				_id: 'SlackBridge_Out_Enabled',
				value: true
			}, {
				_id: 'SlackBridge_Out_All',
				value: false
			}]
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"slackbridge.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_slackbridge/server/slackbridge.js                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

class SlackBridge {
	constructor() {
		this.util = Npm.require('util');
		this.slackClient = Npm.require('slack-client');
		this.apiToken = RocketChat.settings.get('SlackBridge_APIToken');
		this.aliasFormat = RocketChat.settings.get('SlackBridge_AliasFormat');
		this.excludeBotnames = RocketChat.settings.get('SlackBridge_Botnames');
		this.rtm = {};
		this.connected = false;
		this.userTags = {};
		this.slackChannelMap = {};
		this.reactionsMap = new Map();
		RocketChat.settings.get('SlackBridge_APIToken', (key, value) => {
			if (value !== this.apiToken) {
				this.apiToken = value;

				if (this.connected) {
					this.disconnect();
					this.connect();
				}
			}
		});
		RocketChat.settings.get('SlackBridge_AliasFormat', (key, value) => {
			this.aliasFormat = value;
		});
		RocketChat.settings.get('SlackBridge_ExcludeBotnames', (key, value) => {
			this.excludeBotnames = value;
		});
		RocketChat.settings.get('SlackBridge_Enabled', (key, value) => {
			if (value && this.apiToken) {
				this.connect();
			} else {
				this.disconnect();
			}
		});
	}

	connect() {
		if (this.connected === false) {
			this.connected = true;
			logger.connection.info('Connecting via token: ', this.apiToken);
			const RtmClient = this.slackClient.RtmClient;
			this.rtm = new RtmClient(this.apiToken);
			this.rtm.start();
			this.registerForSlackEvents();
			RocketChat.settings.get('SlackBridge_Out_Enabled', (key, value) => {
				if (value) {
					this.registerForRocketEvents();
				} else {
					this.unregisterForRocketEvents();
				}
			});
			Meteor.startup(() => {
				try {
					this.populateSlackChannelMap(); // If run outside of Meteor.startup, HTTP is not defined
				} catch (err) {
					logger.class.error('Error attempting to connect to Slack', err);
					this.disconnect();
				}
			});
		}
	}

	disconnect() {
		if (this.connected === true) {
			this.connected = false;
			this.rtm.disconnect && this.rtm.disconnect();
			logger.connection.info('Disconnected');
			this.unregisterForRocketEvents();
		}
	}

	convertSlackMsgTxtToRocketTxtFormat(slackMsgTxt) {
		if (!_.isEmpty(slackMsgTxt)) {
			slackMsgTxt = slackMsgTxt.replace(/<!everyone>/g, '@all');
			slackMsgTxt = slackMsgTxt.replace(/<!channel>/g, '@all');
			slackMsgTxt = slackMsgTxt.replace(/<!here>/g, '@here');
			slackMsgTxt = slackMsgTxt.replace(/&gt;/g, '>');
			slackMsgTxt = slackMsgTxt.replace(/&lt;/g, '<');
			slackMsgTxt = slackMsgTxt.replace(/&amp;/g, '&');
			slackMsgTxt = slackMsgTxt.replace(/:simple_smile:/g, ':smile:');
			slackMsgTxt = slackMsgTxt.replace(/:memo:/g, ':pencil:');
			slackMsgTxt = slackMsgTxt.replace(/:piggy:/g, ':pig:');
			slackMsgTxt = slackMsgTxt.replace(/:uk:/g, ':gb:');
			slackMsgTxt = slackMsgTxt.replace(/<(http[s]?:[^>]*)>/g, '$1');
			slackMsgTxt.replace(/(?:<@)([a-zA-Z0-9]+)(?:\|.+)?(?:>)/g, (match, userId) => {
				if (!this.userTags[userId]) {
					this.findRocketUser(userId) || this.addRocketUser(userId); // This adds userTags for the userId
				}

				const userTags = this.userTags[userId];

				if (userTags) {
					slackMsgTxt = slackMsgTxt.replace(userTags.slack, userTags.rocket);
				}
			});
		} else {
			slackMsgTxt = '';
		}

		return slackMsgTxt;
	}

	findRocketChannel(slackChannelId) {
		return RocketChat.models.Rooms.findOneByImportId(slackChannelId);
	}

	addRocketChannel(slackChannelID, hasRetried = false) {
		logger.class.debug('Adding Rocket.Chat channel from Slack', slackChannelID);
		let slackResults = null;
		let isGroup = false;

		if (slackChannelID.charAt(0) === 'C') {
			slackResults = HTTP.get('https://slack.com/api/channels.info', {
				params: {
					token: this.apiToken,
					channel: slackChannelID
				}
			});
		} else if (slackChannelID.charAt(0) === 'G') {
			slackResults = HTTP.get('https://slack.com/api/groups.info', {
				params: {
					token: this.apiToken,
					channel: slackChannelID
				}
			});
			isGroup = true;
		}

		if (slackResults && slackResults.data && slackResults.data.ok === true) {
			const rocketChannelData = isGroup ? slackResults.data.group : slackResults.data.channel;
			const existingRocketRoom = RocketChat.models.Rooms.findOneByName(rocketChannelData.name); // If the room exists, make sure we have its id in importIds

			if (existingRocketRoom || rocketChannelData.is_general) {
				rocketChannelData.rocketId = rocketChannelData.is_general ? 'GENERAL' : existingRocketRoom._id;
				RocketChat.models.Rooms.addImportIds(rocketChannelData.rocketId, rocketChannelData.id);
			} else {
				const rocketUsers = [];

				for (const member of rocketChannelData.members) {
					if (member !== rocketChannelData.creator) {
						const rocketUser = this.findRocketUser(member) || this.addRocketUser(member);

						if (rocketUser && rocketUser.username) {
							rocketUsers.push(rocketUser.username);
						}
					}
				}

				const rocketUserCreator = rocketChannelData.creator ? this.findRocketUser(rocketChannelData.creator) || this.addRocketUser(rocketChannelData.creator) : null;

				if (!rocketUserCreator) {
					logger.class.error('Could not fetch room creator information', rocketChannelData.creator);
					return;
				}

				try {
					const rocketChannel = RocketChat.createRoom(isGroup ? 'p' : 'c', rocketChannelData.name, rocketUserCreator.username, rocketUsers);
					rocketChannelData.rocketId = rocketChannel.rid;
				} catch (e) {
					if (!hasRetried) {
						logger.class.debug('Error adding channel from Slack. Will retry in 1s.', e.message); // If first time trying to create channel fails, could be because of multiple messages received at the same time. Try again once after 1s.

						Meteor._sleepForMs(1000);

						return this.findRocketChannel(slackChannelID) || this.addRocketChannel(slackChannelID, true);
					} else {
						console.log(e.message);
					}
				}

				const roomUpdate = {
					ts: new Date(rocketChannelData.created * 1000)
				};
				let lastSetTopic = 0;

				if (!_.isEmpty(rocketChannelData.topic && rocketChannelData.topic.value)) {
					roomUpdate.topic = rocketChannelData.topic.value;
					lastSetTopic = rocketChannelData.topic.last_set;
				}

				if (!_.isEmpty(rocketChannelData.purpose && rocketChannelData.purpose.value) && rocketChannelData.purpose.last_set > lastSetTopic) {
					roomUpdate.topic = rocketChannelData.purpose.value;
				}

				RocketChat.models.Rooms.addImportIds(rocketChannelData.rocketId, rocketChannelData.id);
				this.slackChannelMap[rocketChannelData.rocketId] = {
					id: slackChannelID,
					family: slackChannelID.charAt(0) === 'C' ? 'channels' : 'groups'
				};
			}

			return RocketChat.models.Rooms.findOneById(rocketChannelData.rocketId);
		}

		logger.class.debug('Channel not added');
		return;
	}

	findRocketUser(slackUserID) {
		const rocketUser = RocketChat.models.Users.findOneByImportId(slackUserID);

		if (rocketUser && !this.userTags[slackUserID]) {
			this.userTags[slackUserID] = {
				slack: `<@${slackUserID}>`,
				rocket: `@${rocketUser.username}`
			};
		}

		return rocketUser;
	}

	addRocketUser(slackUserID) {
		logger.class.debug('Adding Rocket.Chat user from Slack', slackUserID);
		const slackResults = HTTP.get('https://slack.com/api/users.info', {
			params: {
				token: this.apiToken,
				user: slackUserID
			}
		});

		if (slackResults && slackResults.data && slackResults.data.ok === true && slackResults.data.user) {
			const rocketUserData = slackResults.data.user;
			const isBot = rocketUserData.is_bot === true;
			const email = rocketUserData.profile && rocketUserData.profile.email || '';
			let existingRocketUser;

			if (!isBot) {
				existingRocketUser = RocketChat.models.Users.findOneByEmailAddress(email) || RocketChat.models.Users.findOneByUsername(rocketUserData.name);
			} else {
				existingRocketUser = RocketChat.models.Users.findOneByUsername(rocketUserData.name);
			}

			if (existingRocketUser) {
				rocketUserData.rocketId = existingRocketUser._id;
				rocketUserData.name = existingRocketUser.username;
			} else {
				const newUser = {
					password: Random.id(),
					username: rocketUserData.name
				};

				if (!isBot && email) {
					newUser.email = email;
				}

				if (isBot) {
					newUser.joinDefaultChannels = false;
				}

				rocketUserData.rocketId = Accounts.createUser(newUser);
				const userUpdate = {
					utcOffset: rocketUserData.tz_offset / 3600,
					// Slack's is -18000 which translates to Rocket.Chat's after dividing by 3600,
					roles: isBot ? ['bot'] : ['user']
				};

				if (rocketUserData.profile && rocketUserData.profile.real_name) {
					userUpdate['name'] = rocketUserData.profile.real_name;
				}

				if (rocketUserData.deleted) {
					userUpdate['active'] = false;
					userUpdate['services.resume.loginTokens'] = [];
				}

				RocketChat.models.Users.update({
					_id: rocketUserData.rocketId
				}, {
					$set: userUpdate
				});
				const user = RocketChat.models.Users.findOneById(rocketUserData.rocketId);
				let url = null;

				if (rocketUserData.profile) {
					if (rocketUserData.profile.image_original) {
						url = rocketUserData.profile.image_original;
					} else if (rocketUserData.profile.image_512) {
						url = rocketUserData.profile.image_512;
					}
				}

				if (url) {
					try {
						RocketChat.setUserAvatar(user, url, null, 'url');
					} catch (error) {
						logger.class.debug('Error setting user avatar', error.message);
					}
				}
			}

			const importIds = [rocketUserData.id];

			if (isBot && rocketUserData.profile && rocketUserData.profile.bot_id) {
				importIds.push(rocketUserData.profile.bot_id);
			}

			RocketChat.models.Users.addImportIds(rocketUserData.rocketId, importIds);

			if (!this.userTags[slackUserID]) {
				this.userTags[slackUserID] = {
					slack: `<@${slackUserID}>`,
					rocket: `@${rocketUserData.name}`
				};
			}

			return RocketChat.models.Users.findOneById(rocketUserData.rocketId);
		}

		logger.class.debug('User not added');
		return;
	}

	addAliasToRocketMsg(rocketUserName, rocketMsgObj) {
		if (this.aliasFormat) {
			const alias = this.util.format(this.aliasFormat, rocketUserName);

			if (alias !== rocketUserName) {
				rocketMsgObj.alias = alias;
			}
		}

		return rocketMsgObj;
	}

	createAndSaveRocketMessage(rocketChannel, rocketUser, slackMessage, rocketMsgDataDefaults, isImporting) {
		if (slackMessage.type === 'message') {
			let rocketMsgObj = {};

			if (!_.isEmpty(slackMessage.subtype)) {
				rocketMsgObj = this.processSlackSubtypedMessage(rocketChannel, rocketUser, slackMessage, isImporting);

				if (!rocketMsgObj) {
					return;
				}
			} else {
				rocketMsgObj = {
					msg: this.convertSlackMsgTxtToRocketTxtFormat(slackMessage.text),
					rid: rocketChannel._id,
					u: {
						_id: rocketUser._id,
						username: rocketUser.username
					}
				};
				this.addAliasToRocketMsg(rocketUser.username, rocketMsgObj);
			}

			_.extend(rocketMsgObj, rocketMsgDataDefaults);

			if (slackMessage.edited) {
				rocketMsgObj.editedAt = new Date(parseInt(slackMessage.edited.ts.split('.')[0]) * 1000);
			}

			if (slackMessage.subtype === 'bot_message') {
				rocketUser = RocketChat.models.Users.findOneById('rocket.cat', {
					fields: {
						username: 1
					}
				});
			}

			if (slackMessage.pinned_to && slackMessage.pinned_to.indexOf(slackMessage.channel) !== -1) {
				rocketMsgObj.pinned = true;
				rocketMsgObj.pinnedAt = Date.now;
				rocketMsgObj.pinnedBy = _.pick(rocketUser, '_id', 'username');
			}

			if (slackMessage.subtype === 'bot_message') {
				Meteor.setTimeout(() => {
					if (slackMessage.bot_id && slackMessage.ts && !RocketChat.models.Messages.findOneBySlackBotIdAndSlackTs(slackMessage.bot_id, slackMessage.ts)) {
						RocketChat.sendMessage(rocketUser, rocketMsgObj, rocketChannel, true);
					}
				}, 500);
			} else {
				logger.class.debug('Send message to Rocket.Chat');
				RocketChat.sendMessage(rocketUser, rocketMsgObj, rocketChannel, true);
			}
		}
	} /*
    https://api.slack.com/events/reaction_removed
    */

	onSlackReactionRemoved(slackReactionMsg) {
		if (slackReactionMsg) {
			const rocketUser = this.getRocketUser(slackReactionMsg.user); //Lets find our Rocket originated message

			let rocketMsg = RocketChat.models.Messages.findOneBySlackTs(slackReactionMsg.item.ts);

			if (!rocketMsg) {
				//Must have originated from Slack
				const rocketID = this.createRocketID(slackReactionMsg.item.channel, slackReactionMsg.item.ts);
				rocketMsg = RocketChat.models.Messages.findOneById(rocketID);
			}

			if (rocketMsg && rocketUser) {
				const rocketReaction = `:${slackReactionMsg.reaction}:`; //If the Rocket user has already been removed, then this is an echo back from slack

				if (rocketMsg.reactions) {
					const theReaction = rocketMsg.reactions[rocketReaction];

					if (theReaction) {
						if (theReaction.usernames.indexOf(rocketUser.username) === -1) {
							return; //Reaction already removed
						}
					}
				} else {
					//Reaction already removed
					return;
				} //Stash this away to key off it later so we don't send it back to Slack


				this.reactionsMap.set(`unset${rocketMsg._id}${rocketReaction}`, rocketUser);
				logger.class.debug('Removing reaction from Slack');
				Meteor.runAsUser(rocketUser._id, () => {
					Meteor.call('setReaction', rocketReaction, rocketMsg._id);
				});
			}
		}
	} /*
    https://api.slack.com/events/reaction_added
    */

	onSlackReactionAdded(slackReactionMsg) {
		if (slackReactionMsg) {
			const rocketUser = this.getRocketUser(slackReactionMsg.user);

			if (rocketUser.roles.includes('bot')) {
				return;
			} //Lets find our Rocket originated message


			let rocketMsg = RocketChat.models.Messages.findOneBySlackTs(slackReactionMsg.item.ts);

			if (!rocketMsg) {
				//Must have originated from Slack
				const rocketID = this.createRocketID(slackReactionMsg.item.channel, slackReactionMsg.item.ts);
				rocketMsg = RocketChat.models.Messages.findOneById(rocketID);
			}

			if (rocketMsg && rocketUser) {
				const rocketReaction = `:${slackReactionMsg.reaction}:`; //If the Rocket user has already reacted, then this is Slack echoing back to us

				if (rocketMsg.reactions) {
					const theReaction = rocketMsg.reactions[rocketReaction];

					if (theReaction) {
						if (theReaction.usernames.indexOf(rocketUser.username) !== -1) {
							return; //Already reacted
						}
					}
				} //Stash this away to key off it later so we don't send it back to Slack


				this.reactionsMap.set(`set${rocketMsg._id}${rocketReaction}`, rocketUser);
				logger.class.debug('Adding reaction from Slack');
				Meteor.runAsUser(rocketUser._id, () => {
					Meteor.call('setReaction', rocketReaction, rocketMsg._id);
				});
			}
		}
	} /**
    * We have received a message from slack and we need to save/delete/update it into rocket
    * https://api.slack.com/events/message
    */

	onSlackMessage(slackMessage, isImporting) {
		if (slackMessage.subtype) {
			switch (slackMessage.subtype) {
				case 'message_deleted':
					this.processSlackMessageDeleted(slackMessage);
					break;

				case 'message_changed':
					this.processSlackMessageChanged(slackMessage);
					break;

				default:
					//Keeping backwards compatability for now, refactor later
					this.processSlackNewMessage(slackMessage, isImporting);
			}
		} else {
			//Simple message
			this.processSlackNewMessage(slackMessage, isImporting);
		}
	}

	processSlackSubtypedMessage(rocketChannel, rocketUser, slackMessage, isImporting) {
		let rocketMsgObj = null;

		switch (slackMessage.subtype) {
			case 'bot_message':
				if (slackMessage.username !== undefined && this.excludeBotnames && slackMessage.username.match(this.excludeBotnames)) {
					return;
				}

				rocketMsgObj = {
					msg: this.convertSlackMsgTxtToRocketTxtFormat(slackMessage.text),
					rid: rocketChannel._id,
					bot: true,
					attachments: slackMessage.attachments,
					username: slackMessage.username || slackMessage.bot_id
				};
				this.addAliasToRocketMsg(slackMessage.username || slackMessage.bot_id, rocketMsgObj);

				if (slackMessage.icons) {
					rocketMsgObj.emoji = slackMessage.icons.emoji;
				}

				return rocketMsgObj;

			case 'me_message':
				return this.addAliasToRocketMsg(rocketUser.username, {
					msg: `_${this.convertSlackMsgTxtToRocketTxtFormat(slackMessage.text)}_`
				});

			case 'channel_join':
				if (isImporting) {
					RocketChat.models.Messages.createUserJoinWithRoomIdAndUser(rocketChannel._id, rocketUser, {
						ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000),
						imported: 'slackbridge'
					});
				} else {
					RocketChat.addUserToRoom(rocketChannel._id, rocketUser);
				}

				return;

			case 'group_join':
				if (slackMessage.inviter) {
					const inviter = slackMessage.inviter ? this.findRocketUser(slackMessage.inviter) || this.addRocketUser(slackMessage.inviter) : null;

					if (isImporting) {
						RocketChat.models.Messages.createUserAddedWithRoomIdAndUser(rocketChannel._id, rocketUser, {
							ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000),
							u: {
								_id: inviter._id,
								username: inviter.username
							},
							imported: 'slackbridge'
						});
					} else {
						RocketChat.addUserToRoom(rocketChannel._id, rocketUser, inviter);
					}
				}

				return;

			case 'channel_leave':
			case 'group_leave':
				if (isImporting) {
					RocketChat.models.Messages.createUserLeaveWithRoomIdAndUser(rocketChannel._id, rocketUser, {
						ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000),
						imported: 'slackbridge'
					});
				} else {
					RocketChat.removeUserFromRoom(rocketChannel._id, rocketUser);
				}

				return;

			case 'channel_topic':
			case 'group_topic':
				if (isImporting) {
					RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_topic', rocketChannel._id, slackMessage.topic, rocketUser, {
						ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000),
						imported: 'slackbridge'
					});
				} else {
					RocketChat.saveRoomTopic(rocketChannel._id, slackMessage.topic, rocketUser, false);
				}

				return;

			case 'channel_purpose':
			case 'group_purpose':
				if (isImporting) {
					RocketChat.models.Messages.createRoomSettingsChangedWithTypeRoomIdMessageAndUser('room_changed_topic', rocketChannel._id, slackMessage.purpose, rocketUser, {
						ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000),
						imported: 'slackbridge'
					});
				} else {
					RocketChat.saveRoomTopic(rocketChannel._id, slackMessage.purpose, rocketUser, false);
				}

				return;

			case 'channel_name':
			case 'group_name':
				if (isImporting) {
					RocketChat.models.Messages.createRoomRenamedWithRoomIdRoomNameAndUser(rocketChannel._id, slackMessage.name, rocketUser, {
						ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000),
						imported: 'slackbridge'
					});
				} else {
					RocketChat.saveRoomName(rocketChannel._id, slackMessage.name, rocketUser, false);
				}

				return;

			case 'channel_archive':
			case 'group_archive':
				if (!isImporting) {
					RocketChat.archiveRoom(rocketChannel);
				}

				return;

			case 'channel_unarchive':
			case 'group_unarchive':
				if (!isImporting) {
					RocketChat.unarchiveRoom(rocketChannel);
				}

				return;

			case 'file_share':
				if (slackMessage.file && slackMessage.file.url_private_download !== undefined) {
					const details = {
						message_id: `slack-${slackMessage.ts.replace(/\./g, '-')}`,
						name: slackMessage.file.name,
						size: slackMessage.file.size,
						type: slackMessage.file.mimetype,
						rid: rocketChannel._id
					};
					return this.uploadFileFromSlack(details, slackMessage.file.url_private_download, rocketUser, rocketChannel, new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000), isImporting);
				}

				break;

			case 'file_comment':
				logger.class.error('File comment not implemented');
				return;

			case 'file_mention':
				logger.class.error('File mentioned not implemented');
				return;

			case 'pinned_item':
				if (slackMessage.attachments && slackMessage.attachments[0] && slackMessage.attachments[0].text) {
					rocketMsgObj = {
						rid: rocketChannel._id,
						t: 'message_pinned',
						msg: '',
						u: {
							_id: rocketUser._id,
							username: rocketUser.username
						},
						attachments: [{
							'text': this.convertSlackMsgTxtToRocketTxtFormat(slackMessage.attachments[0].text),
							'author_name': slackMessage.attachments[0].author_subname,
							'author_icon': getAvatarUrlFromUsername(slackMessage.attachments[0].author_subname),
							'ts': new Date(parseInt(slackMessage.attachments[0].ts.split('.')[0]) * 1000)
						}]
					};

					if (!isImporting) {
						RocketChat.models.Messages.setPinnedByIdAndUserId(`slack-${slackMessage.attachments[0].channel_id}-${slackMessage.attachments[0].ts.replace(/\./g, '-')}`, rocketMsgObj.u, true, new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000));
					}

					return rocketMsgObj;
				} else {
					logger.class.error('Pinned item with no attachment');
				}

				return;

			case 'unpinned_item':
				logger.class.error('Unpinned item not implemented');
				return;
		}
	} /**
   Uploads the file to the storage.
   @param [Object] details an object with details about the upload. name, size, type, and rid
   @param [String] fileUrl url of the file to download/import
   @param [Object] user the Rocket.Chat user
   @param [Object] room the Rocket.Chat room
   @param [Date] timeStamp the timestamp the file was uploaded
   **/ //details, slackMessage.file.url_private_download, rocketUser, rocketChannel, new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000), isImporting);


	uploadFileFromSlack(details, slackFileURL, rocketUser, rocketChannel, timeStamp, isImporting) {
		const url = Npm.require('url');

		const requestModule = /https/i.test(slackFileURL) ? Npm.require('https') : Npm.require('http');
		const parsedUrl = url.parse(slackFileURL, true);
		parsedUrl.headers = {
			'Authorization': `Bearer ${this.apiToken}`
		};
		requestModule.get(parsedUrl, Meteor.bindEnvironment(stream => {
			const fileStore = FileUpload.getStore('Uploads');
			fileStore.insert(details, stream, (err, file) => {
				if (err) {
					throw new Error(err);
				} else {
					const url = file.url.replace(Meteor.absoluteUrl(), '/');
					const attachment = {
						title: file.name,
						title_link: url
					};

					if (/^image\/.+/.test(file.type)) {
						attachment.image_url = url;
						attachment.image_type = file.type;
						attachment.image_size = file.size;
						attachment.image_dimensions = file.identify && file.identify.size;
					}

					if (/^audio\/.+/.test(file.type)) {
						attachment.audio_url = url;
						attachment.audio_type = file.type;
						attachment.audio_size = file.size;
					}

					if (/^video\/.+/.test(file.type)) {
						attachment.video_url = url;
						attachment.video_type = file.type;
						attachment.video_size = file.size;
					}

					const msg = {
						rid: details.rid,
						ts: timeStamp,
						msg: '',
						file: {
							_id: file._id
						},
						groupable: false,
						attachments: [attachment]
					};

					if (isImporting) {
						msg.imported = 'slackbridge';
					}

					if (details.message_id && typeof details.message_id === 'string') {
						msg['_id'] = details.message_id;
					}

					return RocketChat.sendMessage(rocketUser, msg, rocketChannel, true);
				}
			});
		}));
	}

	registerForRocketEvents() {
		RocketChat.callbacks.add('afterSaveMessage', this.onRocketMessage.bind(this), RocketChat.callbacks.priority.LOW, 'SlackBridge_Out');
		RocketChat.callbacks.add('afterDeleteMessage', this.onRocketMessageDelete.bind(this), RocketChat.callbacks.priority.LOW, 'SlackBridge_Delete');
		RocketChat.callbacks.add('setReaction', this.onRocketSetReaction.bind(this), RocketChat.callbacks.priority.LOW, 'SlackBridge_SetReaction');
		RocketChat.callbacks.add('unsetReaction', this.onRocketUnSetReaction.bind(this), RocketChat.callbacks.priority.LOW, 'SlackBridge_UnSetReaction');
	}

	unregisterForRocketEvents() {
		RocketChat.callbacks.remove('afterSaveMessage', 'SlackBridge_Out');
		RocketChat.callbacks.remove('afterDeleteMessage', 'SlackBridge_Delete');
		RocketChat.callbacks.remove('setReaction', 'SlackBridge_SetReaction');
		RocketChat.callbacks.remove('unsetReaction', 'SlackBridge_UnSetReaction');
	}

	registerForSlackEvents() {
		const CLIENT_EVENTS = this.slackClient.CLIENT_EVENTS;
		this.rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, () => {
			logger.connection.info('Connected to Slack');
		});
		this.rtm.on(CLIENT_EVENTS.RTM.UNABLE_TO_RTM_START, () => {
			this.disconnect();
		});
		this.rtm.on(CLIENT_EVENTS.RTM.DISCONNECT, () => {
			this.disconnect();
		});
		const RTM_EVENTS = this.slackClient.RTM_EVENTS; /**
                                                  * Event fired when someone messages a channel the bot is in
                                                  * {
                                                  *	type: 'message',
                                                  * 	channel: [channel_id],
                                                  * 	user: [user_id],
                                                  * 	text: [message],
                                                  * 	ts: [ts.milli],
                                                  * 	team: [team_id],
                                                  * 	subtype: [message_subtype],
                                                  * 	inviter: [message_subtype = 'group_join|channel_join' -> user_id]
                                                  * }
                                                  **/
		this.rtm.on(RTM_EVENTS.MESSAGE, Meteor.bindEnvironment(slackMessage => {
			logger.events.debug('OnSlackEvent-MESSAGE: ', slackMessage);

			if (slackMessage) {
				this.onSlackMessage(slackMessage);
			}
		}));
		this.rtm.on(RTM_EVENTS.REACTION_ADDED, Meteor.bindEnvironment(reactionMsg => {
			logger.events.debug('OnSlackEvent-REACTION_ADDED: ', reactionMsg);

			if (reactionMsg) {
				this.onSlackReactionAdded(reactionMsg);
			}
		}));
		this.rtm.on(RTM_EVENTS.REACTION_REMOVED, Meteor.bindEnvironment(reactionMsg => {
			logger.events.debug('OnSlackEvent-REACTION_REMOVED: ', reactionMsg);

			if (reactionMsg) {
				this.onSlackReactionRemoved(reactionMsg);
			}
		})); /**
       * Event fired when someone creates a public channel
       * {
       *	type: 'channel_created',
       *	channel: {
       *		id: [channel_id],
       *		is_channel: true,
       *		name: [channel_name],
       *		created: [ts],
       *		creator: [user_id],
       *		is_shared: false,
       *		is_org_shared: false
       *	},
       *	event_ts: [ts.milli]
       * }
       **/
		this.rtm.on(RTM_EVENTS.CHANNEL_CREATED, Meteor.bindEnvironment(() => {})); /**
                                                                             * Event fired when the bot joins a public channel
                                                                             * {
                                                                             * 	type: 'channel_joined',
                                                                             * 	channel: {
                                                                             * 		id: [channel_id],
                                                                             * 		name: [channel_name],
                                                                             * 		is_channel: true,
                                                                             * 		created: [ts],
                                                                             * 		creator: [user_id],
                                                                             * 		is_archived: false,
                                                                             * 		is_general: false,
                                                                             * 		is_member: true,
                                                                             * 		last_read: [ts.milli],
                                                                             * 		latest: [message_obj],
                                                                             * 		unread_count: 0,
                                                                             * 		unread_count_display: 0,
                                                                             * 		members: [ user_ids ],
                                                                             * 		topic: {
                                                                             * 			value: [channel_topic],
                                                                             * 			creator: [user_id],
                                                                             * 			last_set: 0
                                                                             * 		},
                                                                             * 		purpose: {
                                                                             * 			value: [channel_purpose],
                                                                             * 			creator: [user_id],
                                                                             * 			last_set: 0
                                                                             * 		}
                                                                             * 	}
                                                                             * }
                                                                             **/
		this.rtm.on(RTM_EVENTS.CHANNEL_JOINED, Meteor.bindEnvironment(() => {})); /**
                                                                            * Event fired when the bot leaves (or is removed from) a public channel
                                                                            * {
                                                                            * 	type: 'channel_left',
                                                                            * 	channel: [channel_id]
                                                                            * }
                                                                            **/
		this.rtm.on(RTM_EVENTS.CHANNEL_LEFT, Meteor.bindEnvironment(() => {})); /**
                                                                          * Event fired when an archived channel is deleted by an admin
                                                                          * {
                                                                          * 	type: 'channel_deleted',
                                                                          * 	channel: [channel_id],
                                                                          *	event_ts: [ts.milli]
                                                                          * }
                                                                          **/
		this.rtm.on(RTM_EVENTS.CHANNEL_DELETED, Meteor.bindEnvironment(() => {})); /**
                                                                             * Event fired when the channel has its name changed
                                                                             * {
                                                                             * 	type: 'channel_rename',
                                                                             * 	channel: {
                                                                             * 		id: [channel_id],
                                                                             * 		name: [channel_name],
                                                                             * 		is_channel: true,
                                                                             * 		created: [ts]
                                                                             * 	},
                                                                             *	event_ts: [ts.milli]
                                                                             * }
                                                                             **/
		this.rtm.on(RTM_EVENTS.CHANNEL_RENAME, Meteor.bindEnvironment(() => {})); /**
                                                                            * Event fired when the bot joins a private channel
                                                                            * {
                                                                            * 	type: 'group_joined',
                                                                            * 	channel: {
                                                                            * 		id: [channel_id],
                                                                            * 		name: [channel_name],
                                                                            * 		is_group: true,
                                                                            * 		created: [ts],
                                                                            * 		creator: [user_id],
                                                                            * 		is_archived: false,
                                                                            * 		is_mpim: false,
                                                                            * 		is_open: true,
                                                                            * 		last_read: [ts.milli],
                                                                            * 		latest: [message_obj],
                                                                            * 		unread_count: 0,
                                                                            * 		unread_count_display: 0,
                                                                            * 		members: [ user_ids ],
                                                                            * 		topic: {
                                                                            * 			value: [channel_topic],
                                                                            * 			creator: [user_id],
                                                                            * 			last_set: 0
                                                                            * 		},
                                                                            * 		purpose: {
                                                                            * 			value: [channel_purpose],
                                                                            * 			creator: [user_id],
                                                                            * 			last_set: 0
                                                                            * 		}
                                                                            * 	}
                                                                            * }
                                                                            **/
		this.rtm.on(RTM_EVENTS.GROUP_JOINED, Meteor.bindEnvironment(() => {})); /**
                                                                          * Event fired when the bot leaves (or is removed from) a private channel
                                                                          * {
                                                                          * 	type: 'group_left',
                                                                          * 	channel: [channel_id]
                                                                          * }
                                                                          **/
		this.rtm.on(RTM_EVENTS.GROUP_LEFT, Meteor.bindEnvironment(() => {})); /**
                                                                        * Event fired when the private channel has its name changed
                                                                        * {
                                                                        * 	type: 'group_rename',
                                                                        * 	channel: {
                                                                        * 		id: [channel_id],
                                                                        * 		name: [channel_name],
                                                                        * 		is_group: true,
                                                                        * 		created: [ts]
                                                                        * 	},
                                                                        *	event_ts: [ts.milli]
                                                                        * }
                                                                        **/
		this.rtm.on(RTM_EVENTS.GROUP_RENAME, Meteor.bindEnvironment(() => {})); /**
                                                                          * Event fired when a new user joins the team
                                                                          * {
                                                                          * 	type: 'team_join',
                                                                          * 	user:
                                                                          * 	{
                                                                          * 		id: [user_id],
                                                                          * 		team_id: [team_id],
                                                                          * 		name: [user_name],
                                                                          * 		deleted: false,
                                                                          * 		status: null,
                                                                          * 		color: [color_code],
                                                                          * 		real_name: '',
                                                                          * 		tz: [timezone],
                                                                          * 		tz_label: [timezone_label],
                                                                          * 		tz_offset: [timezone_offset],
                                                                          * 		profile:
                                                                          * 		{
                                                                          * 			avatar_hash: '',
                                                                          * 			real_name: '',
                                                                          * 			real_name_normalized: '',
                                                                          * 			email: '',
                                                                          * 			image_24: '',
                                                                          * 			image_32: '',
                                                                          * 			image_48: '',
                                                                          * 			image_72: '',
                                                                          * 			image_192: '',
                                                                          * 			image_512: '',
                                                                          * 			fields: null
                                                                          * 		},
                                                                          * 		is_admin: false,
                                                                          * 		is_owner: false,
                                                                          * 		is_primary_owner: false,
                                                                          * 		is_restricted: false,
                                                                          * 		is_ultra_restricted: false,
                                                                          * 		is_bot: false,
                                                                          * 		presence: [user_presence]
                                                                          * 	},
                                                                          * 	cache_ts: [ts]
                                                                          * }
                                                                          **/
		this.rtm.on(RTM_EVENTS.TEAM_JOIN, Meteor.bindEnvironment(() => {}));
	}

	findSlackChannel(rocketChannelName) {
		logger.class.debug('Searching for Slack channel or group', rocketChannelName);
		let response = HTTP.get('https://slack.com/api/channels.list', {
			params: {
				token: this.apiToken
			}
		});

		if (response && response.data && _.isArray(response.data.channels) && response.data.channels.length > 0) {
			for (const channel of response.data.channels) {
				if (channel.name === rocketChannelName && channel.is_member === true) {
					return channel;
				}
			}
		}

		response = HTTP.get('https://slack.com/api/groups.list', {
			params: {
				token: this.apiToken
			}
		});

		if (response && response.data && _.isArray(response.data.groups) && response.data.groups.length > 0) {
			for (const group of response.data.groups) {
				if (group.name === rocketChannelName) {
					return group;
				}
			}
		}
	}

	importFromHistory(family, options) {
		logger.class.debug('Importing messages history');
		const response = HTTP.get(`https://slack.com/api/${family}.history`, {
			params: _.extend({
				token: this.apiToken
			}, options)
		});

		if (response && response.data && _.isArray(response.data.messages) && response.data.messages.length > 0) {
			let latest = 0;

			for (const message of response.data.messages.reverse()) {
				logger.class.debug('MESSAGE: ', message);

				if (!latest || message.ts > latest) {
					latest = message.ts;
				}

				message.channel = options.channel;
				this.onSlackMessage(message, true);
			}

			return {
				has_more: response.data.has_more,
				ts: latest
			};
		}
	}

	copySlackChannelInfo(rid, channelMap) {
		logger.class.debug('Copying users from Slack channel to Rocket.Chat', channelMap.id, rid);
		const response = HTTP.get(`https://slack.com/api/${channelMap.family}.info`, {
			params: {
				token: this.apiToken,
				channel: channelMap.id
			}
		});

		if (response && response.data) {
			const data = channelMap.family === 'channels' ? response.data.channel : response.data.group;

			if (data && _.isArray(data.members) && data.members.length > 0) {
				for (const member of data.members) {
					const user = this.findRocketUser(member) || this.addRocketUser(member);

					if (user) {
						logger.class.debug('Adding user to room', user.username, rid);
						RocketChat.addUserToRoom(rid, user, null, true);
					}
				}
			}

			let topic = '';
			let topic_last_set = 0;
			let topic_creator = null;

			if (data && data.topic && data.topic.value) {
				topic = data.topic.value;
				topic_last_set = data.topic.last_set;
				topic_creator = data.topic.creator;
			}

			if (data && data.purpose && data.purpose.value) {
				if (topic_last_set) {
					if (topic_last_set < data.purpose.last_set) {
						topic = data.purpose.topic;
						topic_creator = data.purpose.creator;
					}
				} else {
					topic = data.purpose.topic;
					topic_creator = data.purpose.creator;
				}
			}

			if (topic) {
				const creator = this.findRocketUser(topic_creator) || this.addRocketUser(topic_creator);
				logger.class.debug('Setting room topic', rid, topic, creator.username);
				RocketChat.saveRoomTopic(rid, topic, creator, false);
			}
		}
	}

	copyPins(rid, channelMap) {
		const response = HTTP.get('https://slack.com/api/pins.list', {
			params: {
				token: this.apiToken,
				channel: channelMap.id
			}
		});

		if (response && response.data && _.isArray(response.data.items) && response.data.items.length > 0) {
			for (const pin of response.data.items) {
				if (pin.message) {
					const user = this.findRocketUser(pin.message.user);
					const msgObj = {
						rid,
						t: 'message_pinned',
						msg: '',
						u: {
							_id: user._id,
							username: user.username
						},
						attachments: [{
							'text': this.convertSlackMsgTxtToRocketTxtFormat(pin.message.text),
							'author_name': user.username,
							'author_icon': getAvatarUrlFromUsername(user.username),
							'ts': new Date(parseInt(pin.message.ts.split('.')[0]) * 1000)
						}]
					};
					RocketChat.models.Messages.setPinnedByIdAndUserId(`slack-${pin.channel}-${pin.message.ts.replace(/\./g, '-')}`, msgObj.u, true, new Date(parseInt(pin.message.ts.split('.')[0]) * 1000));
				}
			}
		}
	}

	importMessages(rid, callback) {
		logger.class.info('importMessages: ', rid);
		const rocketchat_room = RocketChat.models.Rooms.findOneById(rid);

		if (rocketchat_room) {
			if (this.slackChannelMap[rid]) {
				this.copySlackChannelInfo(rid, this.slackChannelMap[rid]);
				logger.class.debug('Importing messages from Slack to Rocket.Chat', this.slackChannelMap[rid], rid);
				let results = this.importFromHistory(this.slackChannelMap[rid].family, {
					channel: this.slackChannelMap[rid].id,
					oldest: 1
				});

				while (results && results.has_more) {
					results = this.importFromHistory(this.slackChannelMap[rid].family, {
						channel: this.slackChannelMap[rid].id,
						oldest: results.ts
					});
				}

				logger.class.debug('Pinning Slack channel messages to Rocket.Chat', this.slackChannelMap[rid], rid);
				this.copyPins(rid, this.slackChannelMap[rid]);
				return callback();
			} else {
				const slack_room = this.findSlackChannel(rocketchat_room.name);

				if (slack_room) {
					this.slackChannelMap[rid] = {
						id: slack_room.id,
						family: slack_room.id.charAt(0) === 'C' ? 'channels' : 'groups'
					};
					return this.importMessages(rid, callback);
				} else {
					logger.class.error('Could not find Slack room with specified name', rocketchat_room.name);
					return callback(new Meteor.Error('error-slack-room-not-found', 'Could not find Slack room with specified name'));
				}
			}
		} else {
			logger.class.error('Could not find Rocket.Chat room with specified id', rid);
			return callback(new Meteor.Error('error-invalid-room', 'Invalid room'));
		}
	}

	populateSlackChannelMap() {
		logger.class.debug('Populating channel map');
		let response = HTTP.get('https://slack.com/api/channels.list', {
			params: {
				token: this.apiToken
			}
		});

		if (response && response.data && _.isArray(response.data.channels) && response.data.channels.length > 0) {
			for (const slackChannel of response.data.channels) {
				const rocketchat_room = RocketChat.models.Rooms.findOneByName(slackChannel.name, {
					fields: {
						_id: 1
					}
				});

				if (rocketchat_room) {
					this.slackChannelMap[rocketchat_room._id] = {
						id: slackChannel.id,
						family: slackChannel.id.charAt(0) === 'C' ? 'channels' : 'groups'
					};
				}
			}
		}

		response = HTTP.get('https://slack.com/api/groups.list', {
			params: {
				token: this.apiToken
			}
		});

		if (response && response.data && _.isArray(response.data.groups) && response.data.groups.length > 0) {
			for (const slackGroup of response.data.groups) {
				const rocketchat_room = RocketChat.models.Rooms.findOneByName(slackGroup.name, {
					fields: {
						_id: 1
					}
				});

				if (rocketchat_room) {
					this.slackChannelMap[rocketchat_room._id] = {
						id: slackGroup.id,
						family: slackGroup.id.charAt(0) === 'C' ? 'channels' : 'groups'
					};
				}
			}
		}
	}

	onRocketMessageDelete(rocketMessageDeleted) {
		logger.class.debug('onRocketMessageDelete', rocketMessageDeleted);
		this.postDeleteMessageToSlack(rocketMessageDeleted);
	}

	onRocketSetReaction(rocketMsgID, reaction) {
		logger.class.debug('onRocketSetReaction');

		if (rocketMsgID && reaction) {
			if (this.reactionsMap.delete(`set${rocketMsgID}${reaction}`)) {
				//This was a Slack reaction, we don't need to tell Slack about it
				return;
			}

			const rocketMsg = RocketChat.models.Messages.findOneById(rocketMsgID);

			if (rocketMsg) {
				const slackChannel = this.slackChannelMap[rocketMsg.rid].id;
				const slackTS = this.getSlackTS(rocketMsg);
				this.postReactionAddedToSlack(reaction.replace(/:/g, ''), slackChannel, slackTS);
			}
		}
	}

	onRocketUnSetReaction(rocketMsgID, reaction) {
		logger.class.debug('onRocketUnSetReaction');

		if (rocketMsgID && reaction) {
			if (this.reactionsMap.delete(`unset${rocketMsgID}${reaction}`)) {
				//This was a Slack unset reaction, we don't need to tell Slack about it
				return;
			}

			const rocketMsg = RocketChat.models.Messages.findOneById(rocketMsgID);

			if (rocketMsg) {
				const slackChannel = this.slackChannelMap[rocketMsg.rid].id;
				const slackTS = this.getSlackTS(rocketMsg);
				this.postReactionRemoveToSlack(reaction.replace(/:/g, ''), slackChannel, slackTS);
			}
		}
	}

	onRocketMessage(rocketMessage) {
		logger.class.debug('onRocketMessage', rocketMessage);

		if (rocketMessage.editedAt) {
			//This is an Edit Event
			this.processRocketMessageChanged(rocketMessage);
			return rocketMessage;
		} // Ignore messages originating from Slack


		if (rocketMessage._id.indexOf('slack-') === 0) {
			return rocketMessage;
		} //Probably a new message from Rocket.Chat


		const outSlackChannels = RocketChat.settings.get('SlackBridge_Out_All') ? _.keys(this.slackChannelMap) : _.pluck(RocketChat.settings.get('SlackBridge_Out_Channels'), '_id') || []; //logger.class.debug('Out SlackChannels: ', outSlackChannels);

		if (outSlackChannels.indexOf(rocketMessage.rid) !== -1) {
			this.postMessageToSlack(this.slackChannelMap[rocketMessage.rid], rocketMessage);
		}

		return rocketMessage;
	} /*
    https://api.slack.com/methods/reactions.add
    */

	postReactionAddedToSlack(reaction, slackChannel, slackTS) {
		if (reaction && slackChannel && slackTS) {
			const data = {
				token: this.apiToken,
				name: reaction,
				channel: slackChannel,
				timestamp: slackTS
			};
			logger.class.debug('Posting Add Reaction to Slack');
			const postResult = HTTP.post('https://slack.com/api/reactions.add', {
				params: data
			});

			if (postResult.statusCode === 200 && postResult.data && postResult.data.ok === true) {
				logger.class.debug('Reaction added to Slack');
			}
		}
	} /*
    https://api.slack.com/methods/reactions.remove
    */

	postReactionRemoveToSlack(reaction, slackChannel, slackTS) {
		if (reaction && slackChannel && slackTS) {
			const data = {
				token: this.apiToken,
				name: reaction,
				channel: slackChannel,
				timestamp: slackTS
			};
			logger.class.debug('Posting Remove Reaction to Slack');
			const postResult = HTTP.post('https://slack.com/api/reactions.remove', {
				params: data
			});

			if (postResult.statusCode === 200 && postResult.data && postResult.data.ok === true) {
				logger.class.debug('Reaction removed from Slack');
			}
		}
	}

	postDeleteMessageToSlack(rocketMessage) {
		if (rocketMessage) {
			const data = {
				token: this.apiToken,
				ts: this.getSlackTS(rocketMessage),
				channel: this.slackChannelMap[rocketMessage.rid].id,
				as_user: true
			};
			logger.class.debug('Post Delete Message to Slack', data);
			const postResult = HTTP.post('https://slack.com/api/chat.delete', {
				params: data
			});

			if (postResult.statusCode === 200 && postResult.data && postResult.data.ok === true) {
				logger.class.debug('Message deleted on Slack');
			}
		}
	}

	postMessageToSlack(slackChannel, rocketMessage) {
		if (slackChannel && slackChannel.id) {
			let iconUrl = getAvatarUrlFromUsername(rocketMessage.u && rocketMessage.u.username);

			if (iconUrl) {
				iconUrl = Meteor.absoluteUrl().replace(/\/$/, '') + iconUrl;
			}

			const data = {
				token: this.apiToken,
				text: rocketMessage.msg,
				channel: slackChannel.id,
				username: rocketMessage.u && rocketMessage.u.username,
				icon_url: iconUrl,
				link_names: 1
			};
			logger.class.debug('Post Message To Slack', data);
			const postResult = HTTP.post('https://slack.com/api/chat.postMessage', {
				params: data
			});

			if (postResult.statusCode === 200 && postResult.data && postResult.data.message && postResult.data.message.bot_id && postResult.data.message.ts) {
				RocketChat.models.Messages.setSlackBotIdAndSlackTs(rocketMessage._id, postResult.data.message.bot_id, postResult.data.message.ts);
				logger.class.debug(`RocketMsgID=${rocketMessage._id} SlackMsgID=${postResult.data.message.ts} SlackBotID=${postResult.data.message.bot_id}`);
			}
		}
	} /*
    https://api.slack.com/methods/chat.update
    */

	postMessageUpdateToSlack(slackChannel, rocketMessage) {
		if (slackChannel && slackChannel.id) {
			const data = {
				token: this.apiToken,
				ts: this.getSlackTS(rocketMessage),
				channel: slackChannel.id,
				text: rocketMessage.msg,
				as_user: true
			};
			logger.class.debug('Post UpdateMessage To Slack', data);
			const postResult = HTTP.post('https://slack.com/api/chat.update', {
				params: data
			});

			if (postResult.statusCode === 200 && postResult.data && postResult.data.ok === true) {
				logger.class.debug('Message updated on Slack');
			}
		}
	}

	processRocketMessageChanged(rocketMessage) {
		if (rocketMessage) {
			if (rocketMessage.updatedBySlack) {
				//We have already processed this
				delete rocketMessage.updatedBySlack;
				return;
			} //This was a change from Rocket.Chat


			const slackChannel = this.slackChannelMap[rocketMessage.rid];
			this.postMessageUpdateToSlack(slackChannel, rocketMessage);
		}
	} /*
    https://api.slack.com/events/message/message_deleted
    */

	processSlackMessageDeleted(slackMessage) {
		if (slackMessage.previous_message) {
			const rocketChannel = this.getRocketChannel(slackMessage);
			const rocketUser = RocketChat.models.Users.findOneById('rocket.cat', {
				fields: {
					username: 1
				}
			});

			if (rocketChannel && rocketUser) {
				//Find the Rocket message to delete
				let rocketMsgObj = RocketChat.models.Messages.findOneBySlackBotIdAndSlackTs(slackMessage.previous_message.bot_id, slackMessage.previous_message.ts);

				if (!rocketMsgObj) {
					//Must have been a Slack originated msg
					const _id = this.createRocketID(slackMessage.channel, slackMessage.previous_message.ts);

					rocketMsgObj = RocketChat.models.Messages.findOneById(_id);
				}

				if (rocketMsgObj) {
					RocketChat.deleteMessage(rocketMsgObj, rocketUser);
					logger.class.debug('Rocket message deleted by Slack');
				}
			}
		}
	} /*
    https://api.slack.com/events/message/message_changed
    */

	processSlackMessageChanged(slackMessage) {
		if (slackMessage.previous_message) {
			const currentMsg = RocketChat.models.Messages.findOneById(this.createRocketID(slackMessage.channel, slackMessage.message.ts)); //Only process this change, if its an actual update (not just Slack repeating back our Rocket original change)

			if (currentMsg && slackMessage.message.text !== currentMsg.msg) {
				const rocketChannel = this.getRocketChannel(slackMessage);
				const rocketUser = slackMessage.previous_message.user ? this.findRocketUser(slackMessage.previous_message.user) || this.addRocketUser(slackMessage.previous_message.user) : null;
				const rocketMsgObj = {
					//@TODO _id
					_id: this.createRocketID(slackMessage.channel, slackMessage.previous_message.ts),
					rid: rocketChannel._id,
					msg: this.convertSlackMsgTxtToRocketTxtFormat(slackMessage.message.text),
					updatedBySlack: true //We don't want to notify slack about this change since Slack initiated it

				};
				RocketChat.updateMessage(rocketMsgObj, rocketUser);
				logger.class.debug('Rocket message updated by Slack');
			}
		}
	} /*
    This method will get refactored and broken down into single responsibilities
    */

	processSlackNewMessage(slackMessage, isImporting) {
		const rocketChannel = this.getRocketChannel(slackMessage);
		let rocketUser = null;

		if (slackMessage.subtype === 'bot_message') {
			rocketUser = RocketChat.models.Users.findOneById('rocket.cat', {
				fields: {
					username: 1
				}
			});
		} else {
			rocketUser = slackMessage.user ? this.findRocketUser(slackMessage.user) || this.addRocketUser(slackMessage.user) : null;
		}

		if (rocketChannel && rocketUser) {
			const msgDataDefaults = {
				_id: this.createRocketID(slackMessage.channel, slackMessage.ts),
				ts: new Date(parseInt(slackMessage.ts.split('.')[0]) * 1000)
			};

			if (isImporting) {
				msgDataDefaults['imported'] = 'slackbridge';
			}

			try {
				this.createAndSaveRocketMessage(rocketChannel, rocketUser, slackMessage, msgDataDefaults, isImporting);
			} catch (e) {
				// http://www.mongodb.org/about/contributors/error-codes/
				// 11000 == duplicate key error
				if (e.name === 'MongoError' && e.code === 11000) {
					return;
				}

				throw e;
			}
		}
	} /**
    * Retrieves the Slack TS from a Rocket msg that originated from Slack
    * @param rocketMsg
    * @returns Slack TS or undefined if not a message that originated from slack
    * @private
    */

	getSlackTS(rocketMsg) {
		//slack-G3KJGGE15-1483081061-000169
		let slackTS;

		let index = rocketMsg._id.indexOf('slack-');

		if (index === 0) {
			//This is a msg that originated from Slack
			slackTS = rocketMsg._id.substr(6, rocketMsg._id.length);
			index = slackTS.indexOf('-');
			slackTS = slackTS.substr(index + 1, slackTS.length);
			slackTS = slackTS.replace('-', '.');
		} else {
			//This probably originated as a Rocket msg, but has been sent to Slack
			slackTS = rocketMsg.slackTs;
		}

		return slackTS;
	}

	getRocketChannel(slackMessage) {
		return slackMessage.channel ? this.findRocketChannel(slackMessage.channel) || this.addRocketChannel(slackMessage.channel) : null;
	}

	getRocketUser(slackUser) {
		return slackUser ? this.findRocketUser(slackUser) || this.addRocketUser(slackUser) : null;
	}

	createRocketID(slackChannel, ts) {
		return `slack-${slackChannel}-${ts.replace(/\./g, '-')}`;
	}

}

RocketChat.SlackBridge = new SlackBridge();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"slackbridge_import.server.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_slackbridge/server/slackbridge_import.server.js                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals msgStream */function SlackBridgeImport(command, params, item) {
	if (command !== 'slackbridge-import' || !Match.test(params, String)) {
		return;
	}

	const room = RocketChat.models.Rooms.findOneById(item.rid);
	const channel = room.name;
	const user = Meteor.users.findOne(Meteor.userId());
	msgStream.emit(item.rid, {
		_id: Random.id(),
		rid: item.rid,
		u: {
			username: 'rocket.cat'
		},
		ts: new Date(),
		msg: TAPi18n.__('SlackBridge_start', {
			postProcess: 'sprintf',
			sprintf: [user.username, channel]
		}, user.language)
	});

	try {
		RocketChat.SlackBridge.importMessages(item.rid, error => {
			if (error) {
				msgStream.emit(item.rid, {
					_id: Random.id(),
					rid: item.rid,
					u: {
						username: 'rocket.cat'
					},
					ts: new Date(),
					msg: TAPi18n.__('SlackBridge_error', {
						postProcess: 'sprintf',
						sprintf: [channel, error.message]
					}, user.language)
				});
			} else {
				msgStream.emit(item.rid, {
					_id: Random.id(),
					rid: item.rid,
					u: {
						username: 'rocket.cat'
					},
					ts: new Date(),
					msg: TAPi18n.__('SlackBridge_finish', {
						postProcess: 'sprintf',
						sprintf: [channel]
					}, user.language)
				});
			}
		});
	} catch (error) {
		msgStream.emit(item.rid, {
			_id: Random.id(),
			rid: item.rid,
			u: {
				username: 'rocket.cat'
			},
			ts: new Date(),
			msg: TAPi18n.__('SlackBridge_error', {
				postProcess: 'sprintf',
				sprintf: [channel, error.message]
			}, user.language)
		});
		throw error;
	}

	return SlackBridgeImport;
}

RocketChat.slashCommands.add('slackbridge-import', SlackBridgeImport);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:slackbridge/server/logger.js");
require("./node_modules/meteor/rocketchat:slackbridge/server/settings.js");
require("./node_modules/meteor/rocketchat:slackbridge/server/slackbridge.js");
require("./node_modules/meteor/rocketchat:slackbridge/server/slackbridge_import.server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:slackbridge'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_slackbridge.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFja2JyaWRnZS9zZXJ2ZXIvbG9nZ2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnNsYWNrYnJpZGdlL3NlcnZlci9zZXR0aW5ncy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbGFja2JyaWRnZS9zZXJ2ZXIvc2xhY2ticmlkZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c2xhY2ticmlkZ2Uvc2VydmVyL3NsYWNrYnJpZGdlX2ltcG9ydC5zZXJ2ZXIuanMiXSwibmFtZXMiOlsibG9nZ2VyIiwiTG9nZ2VyIiwic2VjdGlvbnMiLCJjb25uZWN0aW9uIiwiZXZlbnRzIiwiY2xhc3MiLCJNZXRlb3IiLCJzdGFydHVwIiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiYWRkR3JvdXAiLCJhZGQiLCJ0eXBlIiwiaTE4bkxhYmVsIiwicHVibGljIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJ2YWx1ZSIsImkxOG5EZXNjcmlwdGlvbiIsIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIlNsYWNrQnJpZGdlIiwiY29uc3RydWN0b3IiLCJ1dGlsIiwiTnBtIiwic2xhY2tDbGllbnQiLCJhcGlUb2tlbiIsImdldCIsImFsaWFzRm9ybWF0IiwiZXhjbHVkZUJvdG5hbWVzIiwicnRtIiwiY29ubmVjdGVkIiwidXNlclRhZ3MiLCJzbGFja0NoYW5uZWxNYXAiLCJyZWFjdGlvbnNNYXAiLCJNYXAiLCJrZXkiLCJkaXNjb25uZWN0IiwiY29ubmVjdCIsImluZm8iLCJSdG1DbGllbnQiLCJzdGFydCIsInJlZ2lzdGVyRm9yU2xhY2tFdmVudHMiLCJyZWdpc3RlckZvclJvY2tldEV2ZW50cyIsInVucmVnaXN0ZXJGb3JSb2NrZXRFdmVudHMiLCJwb3B1bGF0ZVNsYWNrQ2hhbm5lbE1hcCIsImVyciIsImVycm9yIiwiY29udmVydFNsYWNrTXNnVHh0VG9Sb2NrZXRUeHRGb3JtYXQiLCJzbGFja01zZ1R4dCIsImlzRW1wdHkiLCJyZXBsYWNlIiwibWF0Y2giLCJ1c2VySWQiLCJmaW5kUm9ja2V0VXNlciIsImFkZFJvY2tldFVzZXIiLCJzbGFjayIsInJvY2tldCIsImZpbmRSb2NrZXRDaGFubmVsIiwic2xhY2tDaGFubmVsSWQiLCJtb2RlbHMiLCJSb29tcyIsImZpbmRPbmVCeUltcG9ydElkIiwiYWRkUm9ja2V0Q2hhbm5lbCIsInNsYWNrQ2hhbm5lbElEIiwiaGFzUmV0cmllZCIsImRlYnVnIiwic2xhY2tSZXN1bHRzIiwiaXNHcm91cCIsImNoYXJBdCIsIkhUVFAiLCJwYXJhbXMiLCJ0b2tlbiIsImNoYW5uZWwiLCJkYXRhIiwib2siLCJyb2NrZXRDaGFubmVsRGF0YSIsImdyb3VwIiwiZXhpc3RpbmdSb2NrZXRSb29tIiwiZmluZE9uZUJ5TmFtZSIsIm5hbWUiLCJpc19nZW5lcmFsIiwicm9ja2V0SWQiLCJhZGRJbXBvcnRJZHMiLCJpZCIsInJvY2tldFVzZXJzIiwibWVtYmVyIiwibWVtYmVycyIsImNyZWF0b3IiLCJyb2NrZXRVc2VyIiwidXNlcm5hbWUiLCJwdXNoIiwicm9ja2V0VXNlckNyZWF0b3IiLCJyb2NrZXRDaGFubmVsIiwiY3JlYXRlUm9vbSIsInJpZCIsImUiLCJtZXNzYWdlIiwiX3NsZWVwRm9yTXMiLCJjb25zb2xlIiwibG9nIiwicm9vbVVwZGF0ZSIsInRzIiwiRGF0ZSIsImNyZWF0ZWQiLCJsYXN0U2V0VG9waWMiLCJ0b3BpYyIsImxhc3Rfc2V0IiwicHVycG9zZSIsImZhbWlseSIsImZpbmRPbmVCeUlkIiwic2xhY2tVc2VySUQiLCJVc2VycyIsInVzZXIiLCJyb2NrZXRVc2VyRGF0YSIsImlzQm90IiwiaXNfYm90IiwiZW1haWwiLCJwcm9maWxlIiwiZXhpc3RpbmdSb2NrZXRVc2VyIiwiZmluZE9uZUJ5RW1haWxBZGRyZXNzIiwiZmluZE9uZUJ5VXNlcm5hbWUiLCJuZXdVc2VyIiwicGFzc3dvcmQiLCJSYW5kb20iLCJqb2luRGVmYXVsdENoYW5uZWxzIiwiQWNjb3VudHMiLCJjcmVhdGVVc2VyIiwidXNlclVwZGF0ZSIsInV0Y09mZnNldCIsInR6X29mZnNldCIsInJvbGVzIiwicmVhbF9uYW1lIiwiZGVsZXRlZCIsInVwZGF0ZSIsIiRzZXQiLCJ1cmwiLCJpbWFnZV9vcmlnaW5hbCIsImltYWdlXzUxMiIsInNldFVzZXJBdmF0YXIiLCJpbXBvcnRJZHMiLCJib3RfaWQiLCJhZGRBbGlhc1RvUm9ja2V0TXNnIiwicm9ja2V0VXNlck5hbWUiLCJyb2NrZXRNc2dPYmoiLCJhbGlhcyIsImZvcm1hdCIsImNyZWF0ZUFuZFNhdmVSb2NrZXRNZXNzYWdlIiwic2xhY2tNZXNzYWdlIiwicm9ja2V0TXNnRGF0YURlZmF1bHRzIiwiaXNJbXBvcnRpbmciLCJzdWJ0eXBlIiwicHJvY2Vzc1NsYWNrU3VidHlwZWRNZXNzYWdlIiwibXNnIiwidGV4dCIsInUiLCJleHRlbmQiLCJlZGl0ZWQiLCJlZGl0ZWRBdCIsInBhcnNlSW50Iiwic3BsaXQiLCJmaWVsZHMiLCJwaW5uZWRfdG8iLCJpbmRleE9mIiwicGlubmVkIiwicGlubmVkQXQiLCJub3ciLCJwaW5uZWRCeSIsInBpY2siLCJzZXRUaW1lb3V0IiwiTWVzc2FnZXMiLCJmaW5kT25lQnlTbGFja0JvdElkQW5kU2xhY2tUcyIsInNlbmRNZXNzYWdlIiwib25TbGFja1JlYWN0aW9uUmVtb3ZlZCIsInNsYWNrUmVhY3Rpb25Nc2ciLCJnZXRSb2NrZXRVc2VyIiwicm9ja2V0TXNnIiwiZmluZE9uZUJ5U2xhY2tUcyIsIml0ZW0iLCJyb2NrZXRJRCIsImNyZWF0ZVJvY2tldElEIiwicm9ja2V0UmVhY3Rpb24iLCJyZWFjdGlvbiIsInJlYWN0aW9ucyIsInRoZVJlYWN0aW9uIiwidXNlcm5hbWVzIiwic2V0IiwicnVuQXNVc2VyIiwiY2FsbCIsIm9uU2xhY2tSZWFjdGlvbkFkZGVkIiwiaW5jbHVkZXMiLCJvblNsYWNrTWVzc2FnZSIsInByb2Nlc3NTbGFja01lc3NhZ2VEZWxldGVkIiwicHJvY2Vzc1NsYWNrTWVzc2FnZUNoYW5nZWQiLCJwcm9jZXNzU2xhY2tOZXdNZXNzYWdlIiwidW5kZWZpbmVkIiwiYm90IiwiYXR0YWNobWVudHMiLCJpY29ucyIsImVtb2ppIiwiY3JlYXRlVXNlckpvaW5XaXRoUm9vbUlkQW5kVXNlciIsImltcG9ydGVkIiwiYWRkVXNlclRvUm9vbSIsImludml0ZXIiLCJjcmVhdGVVc2VyQWRkZWRXaXRoUm9vbUlkQW5kVXNlciIsImNyZWF0ZVVzZXJMZWF2ZVdpdGhSb29tSWRBbmRVc2VyIiwicmVtb3ZlVXNlckZyb21Sb29tIiwiY3JlYXRlUm9vbVNldHRpbmdzQ2hhbmdlZFdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIiLCJzYXZlUm9vbVRvcGljIiwiY3JlYXRlUm9vbVJlbmFtZWRXaXRoUm9vbUlkUm9vbU5hbWVBbmRVc2VyIiwic2F2ZVJvb21OYW1lIiwiYXJjaGl2ZVJvb20iLCJ1bmFyY2hpdmVSb29tIiwiZmlsZSIsInVybF9wcml2YXRlX2Rvd25sb2FkIiwiZGV0YWlscyIsIm1lc3NhZ2VfaWQiLCJzaXplIiwibWltZXR5cGUiLCJ1cGxvYWRGaWxlRnJvbVNsYWNrIiwidCIsImF1dGhvcl9zdWJuYW1lIiwiZ2V0QXZhdGFyVXJsRnJvbVVzZXJuYW1lIiwic2V0UGlubmVkQnlJZEFuZFVzZXJJZCIsImNoYW5uZWxfaWQiLCJzbGFja0ZpbGVVUkwiLCJ0aW1lU3RhbXAiLCJyZXF1ZXN0TW9kdWxlIiwidGVzdCIsInBhcnNlZFVybCIsInBhcnNlIiwiaGVhZGVycyIsImJpbmRFbnZpcm9ubWVudCIsInN0cmVhbSIsImZpbGVTdG9yZSIsIkZpbGVVcGxvYWQiLCJnZXRTdG9yZSIsImluc2VydCIsIkVycm9yIiwiYWJzb2x1dGVVcmwiLCJhdHRhY2htZW50IiwidGl0bGUiLCJ0aXRsZV9saW5rIiwiaW1hZ2VfdXJsIiwiaW1hZ2VfdHlwZSIsImltYWdlX3NpemUiLCJpbWFnZV9kaW1lbnNpb25zIiwiaWRlbnRpZnkiLCJhdWRpb191cmwiLCJhdWRpb190eXBlIiwiYXVkaW9fc2l6ZSIsInZpZGVvX3VybCIsInZpZGVvX3R5cGUiLCJ2aWRlb19zaXplIiwiZ3JvdXBhYmxlIiwiY2FsbGJhY2tzIiwib25Sb2NrZXRNZXNzYWdlIiwiYmluZCIsInByaW9yaXR5IiwiTE9XIiwib25Sb2NrZXRNZXNzYWdlRGVsZXRlIiwib25Sb2NrZXRTZXRSZWFjdGlvbiIsIm9uUm9ja2V0VW5TZXRSZWFjdGlvbiIsInJlbW92ZSIsIkNMSUVOVF9FVkVOVFMiLCJvbiIsIlJUTSIsIkFVVEhFTlRJQ0FURUQiLCJVTkFCTEVfVE9fUlRNX1NUQVJUIiwiRElTQ09OTkVDVCIsIlJUTV9FVkVOVFMiLCJNRVNTQUdFIiwiUkVBQ1RJT05fQURERUQiLCJyZWFjdGlvbk1zZyIsIlJFQUNUSU9OX1JFTU9WRUQiLCJDSEFOTkVMX0NSRUFURUQiLCJDSEFOTkVMX0pPSU5FRCIsIkNIQU5ORUxfTEVGVCIsIkNIQU5ORUxfREVMRVRFRCIsIkNIQU5ORUxfUkVOQU1FIiwiR1JPVVBfSk9JTkVEIiwiR1JPVVBfTEVGVCIsIkdST1VQX1JFTkFNRSIsIlRFQU1fSk9JTiIsImZpbmRTbGFja0NoYW5uZWwiLCJyb2NrZXRDaGFubmVsTmFtZSIsInJlc3BvbnNlIiwiaXNBcnJheSIsImNoYW5uZWxzIiwibGVuZ3RoIiwiaXNfbWVtYmVyIiwiZ3JvdXBzIiwiaW1wb3J0RnJvbUhpc3RvcnkiLCJvcHRpb25zIiwibWVzc2FnZXMiLCJsYXRlc3QiLCJyZXZlcnNlIiwiaGFzX21vcmUiLCJjb3B5U2xhY2tDaGFubmVsSW5mbyIsImNoYW5uZWxNYXAiLCJ0b3BpY19sYXN0X3NldCIsInRvcGljX2NyZWF0b3IiLCJjb3B5UGlucyIsIml0ZW1zIiwicGluIiwibXNnT2JqIiwiaW1wb3J0TWVzc2FnZXMiLCJjYWxsYmFjayIsInJvY2tldGNoYXRfcm9vbSIsInJlc3VsdHMiLCJvbGRlc3QiLCJzbGFja19yb29tIiwic2xhY2tDaGFubmVsIiwic2xhY2tHcm91cCIsInJvY2tldE1lc3NhZ2VEZWxldGVkIiwicG9zdERlbGV0ZU1lc3NhZ2VUb1NsYWNrIiwicm9ja2V0TXNnSUQiLCJkZWxldGUiLCJzbGFja1RTIiwiZ2V0U2xhY2tUUyIsInBvc3RSZWFjdGlvbkFkZGVkVG9TbGFjayIsInBvc3RSZWFjdGlvblJlbW92ZVRvU2xhY2siLCJyb2NrZXRNZXNzYWdlIiwicHJvY2Vzc1JvY2tldE1lc3NhZ2VDaGFuZ2VkIiwib3V0U2xhY2tDaGFubmVscyIsImtleXMiLCJwbHVjayIsInBvc3RNZXNzYWdlVG9TbGFjayIsInRpbWVzdGFtcCIsInBvc3RSZXN1bHQiLCJwb3N0Iiwic3RhdHVzQ29kZSIsImFzX3VzZXIiLCJpY29uVXJsIiwiaWNvbl91cmwiLCJsaW5rX25hbWVzIiwic2V0U2xhY2tCb3RJZEFuZFNsYWNrVHMiLCJwb3N0TWVzc2FnZVVwZGF0ZVRvU2xhY2siLCJ1cGRhdGVkQnlTbGFjayIsInByZXZpb3VzX21lc3NhZ2UiLCJnZXRSb2NrZXRDaGFubmVsIiwiZGVsZXRlTWVzc2FnZSIsImN1cnJlbnRNc2ciLCJ1cGRhdGVNZXNzYWdlIiwibXNnRGF0YURlZmF1bHRzIiwiY29kZSIsImluZGV4Iiwic3Vic3RyIiwic2xhY2tUcyIsInNsYWNrVXNlciIsIlNsYWNrQnJpZGdlSW1wb3J0IiwiY29tbWFuZCIsIk1hdGNoIiwiU3RyaW5nIiwicm9vbSIsInVzZXJzIiwiZmluZE9uZSIsIm1zZ1N0cmVhbSIsImVtaXQiLCJUQVBpMThuIiwiX18iLCJwb3N0UHJvY2VzcyIsInNwcmludGYiLCJsYW5ndWFnZSIsInNsYXNoQ29tbWFuZHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5QixDQUNBLHFCQUVBQSxTQUFTLElBQUlDLE1BQUosQ0FBVyxhQUFYLEVBQTBCO0FBQ2xDQyxXQUFVO0FBQ1RDLGNBQVksWUFESDtBQUVUQyxVQUFRLFFBRkM7QUFHVEMsU0FBTztBQUhFO0FBRHdCLENBQTFCLENBQVQsQzs7Ozs7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eUJBLEVBMUJELENBMEJFLE9BQU81VCxLQUFQLEVBQWM7QUFDZnNULFlBQVVDLElBQVYsQ0FBZXBMLEtBQUtuRixHQUFwQixFQUF5QjtBQUN4Qm5GLFFBQUtnSCxPQUFPeEMsRUFBUCxFQURtQjtBQUV4QlcsUUFBS21GLEtBQUtuRixHQUZjO0FBR3hCNEQsTUFBRztBQUFFakUsY0FBVTtBQUFaLElBSHFCO0FBSXhCWSxPQUFJLElBQUlDLElBQUosRUFKb0I7QUFLeEJrRCxRQUFLOE0sUUFBUUMsRUFBUixDQUFXLG1CQUFYLEVBQWdDO0FBQ3BDQyxpQkFBYSxTQUR1QjtBQUVwQ0MsYUFBUyxDQUFDalMsT0FBRCxFQUFVMUIsTUFBTWtELE9BQWhCO0FBRjJCLElBQWhDLEVBR0ZnQixLQUFLMFAsUUFISDtBQUxtQixHQUF6QjtBQVVBLFFBQU01VCxLQUFOO0FBQ0E7O0FBQ0QsUUFBTytTLGlCQUFQO0FBQ0E7O0FBRUQxVixXQUFXd1csYUFBWCxDQUF5QnJXLEdBQXpCLENBQTZCLG9CQUE3QixFQUFtRHVWLGlCQUFuRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3NsYWNrYnJpZGdlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBsb2dnZXI6dHJ1ZSAqL1xuLyogZXhwb3J0ZWQgbG9nZ2VyICovXG5cbmxvZ2dlciA9IG5ldyBMb2dnZXIoJ1NsYWNrQnJpZGdlJywge1xuXHRzZWN0aW9uczoge1xuXHRcdGNvbm5lY3Rpb246ICdDb25uZWN0aW9uJyxcblx0XHRldmVudHM6ICdFdmVudHMnLFxuXHRcdGNsYXNzOiAnQ2xhc3MnXG5cdH1cbn0pO1xuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ1NsYWNrQnJpZGdlJywgZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5hZGQoJ1NsYWNrQnJpZGdlX0VuYWJsZWQnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0aTE4bkxhYmVsOiAnRW5hYmxlZCcsXG5cdFx0XHRwdWJsaWM6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdTbGFja0JyaWRnZV9BUElUb2tlbicsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ1NsYWNrQnJpZGdlX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGkxOG5MYWJlbDogJ0FQSV9Ub2tlbidcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdTbGFja0JyaWRnZV9BbGlhc0Zvcm1hdCcsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ1NsYWNrQnJpZGdlX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGkxOG5MYWJlbDogJ0FsaWFzX0Zvcm1hdCcsXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdBbGlhc19Gb3JtYXRfRGVzY3JpcHRpb24nXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZCgnU2xhY2tCcmlkZ2VfRXhjbHVkZUJvdG5hbWVzJywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnU2xhY2tCcmlkZ2VfRW5hYmxlZCcsXG5cdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0aTE4bkxhYmVsOiAnRXhjbHVkZV9Cb3RuYW1lcycsXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdFeGNsdWRlX0JvdG5hbWVzX0Rlc2NyaXB0aW9uJ1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoJ1NsYWNrQnJpZGdlX091dF9FbmFibGVkJywgZmFsc2UsIHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ1NsYWNrQnJpZGdlX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoJ1NsYWNrQnJpZGdlX091dF9BbGwnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IFt7XG5cdFx0XHRcdF9pZDogJ1NsYWNrQnJpZGdlX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSwge1xuXHRcdFx0XHRfaWQ6ICdTbGFja0JyaWRnZV9PdXRfRW5hYmxlZCcsXG5cdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHR9XVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoJ1NsYWNrQnJpZGdlX091dF9DaGFubmVscycsICcnLCB7XG5cdFx0XHR0eXBlOiAncm9vbVBpY2snLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IFt7XG5cdFx0XHRcdF9pZDogJ1NsYWNrQnJpZGdlX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSwge1xuXHRcdFx0XHRfaWQ6ICdTbGFja0JyaWRnZV9PdXRfRW5hYmxlZCcsXG5cdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHR9LCB7XG5cdFx0XHRcdF9pZDogJ1NsYWNrQnJpZGdlX091dF9BbGwnLFxuXHRcdFx0XHR2YWx1ZTogZmFsc2Vcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iLCIvKiBnbG9iYWxzIGxvZ2dlciAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNsYXNzIFNsYWNrQnJpZGdlIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLnV0aWwgPSBOcG0ucmVxdWlyZSgndXRpbCcpO1xuXHRcdHRoaXMuc2xhY2tDbGllbnQgPSBOcG0ucmVxdWlyZSgnc2xhY2stY2xpZW50Jyk7XG5cdFx0dGhpcy5hcGlUb2tlbiA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbGFja0JyaWRnZV9BUElUb2tlbicpO1xuXHRcdHRoaXMuYWxpYXNGb3JtYXQgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnU2xhY2tCcmlkZ2VfQWxpYXNGb3JtYXQnKTtcblx0XHR0aGlzLmV4Y2x1ZGVCb3RuYW1lcyA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbGFja0JyaWRnZV9Cb3RuYW1lcycpO1xuXHRcdHRoaXMucnRtID0ge307XG5cdFx0dGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLnVzZXJUYWdzID0ge307XG5cdFx0dGhpcy5zbGFja0NoYW5uZWxNYXAgPSB7fTtcblx0XHR0aGlzLnJlYWN0aW9uc01hcCA9IG5ldyBNYXAoKTtcblxuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbGFja0JyaWRnZV9BUElUb2tlbicsIChrZXksIHZhbHVlKSA9PiB7XG5cdFx0XHRpZiAodmFsdWUgIT09IHRoaXMuYXBpVG9rZW4pIHtcblx0XHRcdFx0dGhpcy5hcGlUb2tlbiA9IHZhbHVlO1xuXHRcdFx0XHRpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0XHRcdFx0XHR0aGlzLmRpc2Nvbm5lY3QoKTtcblx0XHRcdFx0XHR0aGlzLmNvbm5lY3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NsYWNrQnJpZGdlX0FsaWFzRm9ybWF0JywgKGtleSwgdmFsdWUpID0+IHtcblx0XHRcdHRoaXMuYWxpYXNGb3JtYXQgPSB2YWx1ZTtcblx0XHR9KTtcblxuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbGFja0JyaWRnZV9FeGNsdWRlQm90bmFtZXMnLCAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdFx0dGhpcy5leGNsdWRlQm90bmFtZXMgPSB2YWx1ZTtcblx0XHR9KTtcblxuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbGFja0JyaWRnZV9FbmFibGVkJywgKGtleSwgdmFsdWUpID0+IHtcblx0XHRcdGlmICh2YWx1ZSAmJiB0aGlzLmFwaVRva2VuKSB7XG5cdFx0XHRcdHRoaXMuY29ubmVjdCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5kaXNjb25uZWN0KCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRjb25uZWN0KCkge1xuXHRcdGlmICh0aGlzLmNvbm5lY3RlZCA9PT0gZmFsc2UpIHtcblx0XHRcdHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcblx0XHRcdGxvZ2dlci5jb25uZWN0aW9uLmluZm8oJ0Nvbm5lY3RpbmcgdmlhIHRva2VuOiAnLCB0aGlzLmFwaVRva2VuKTtcblx0XHRcdGNvbnN0IFJ0bUNsaWVudCA9IHRoaXMuc2xhY2tDbGllbnQuUnRtQ2xpZW50O1xuXHRcdFx0dGhpcy5ydG0gPSBuZXcgUnRtQ2xpZW50KHRoaXMuYXBpVG9rZW4pO1xuXHRcdFx0dGhpcy5ydG0uc3RhcnQoKTtcblx0XHRcdHRoaXMucmVnaXN0ZXJGb3JTbGFja0V2ZW50cygpO1xuXHRcdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NsYWNrQnJpZGdlX091dF9FbmFibGVkJywgKGtleSwgdmFsdWUpID0+IHtcblx0XHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5yZWdpc3RlckZvclJvY2tldEV2ZW50cygpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudW5yZWdpc3RlckZvclJvY2tldEV2ZW50cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdE1ldGVvci5zdGFydHVwKCgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR0aGlzLnBvcHVsYXRlU2xhY2tDaGFubmVsTWFwKCk7IC8vIElmIHJ1biBvdXRzaWRlIG9mIE1ldGVvci5zdGFydHVwLCBIVFRQIGlzIG5vdCBkZWZpbmVkXG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdGxvZ2dlci5jbGFzcy5lcnJvcignRXJyb3IgYXR0ZW1wdGluZyB0byBjb25uZWN0IHRvIFNsYWNrJywgZXJyKTtcblx0XHRcdFx0XHR0aGlzLmRpc2Nvbm5lY3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzY29ubmVjdCgpIHtcblx0XHRpZiAodGhpcy5jb25uZWN0ZWQgPT09IHRydWUpIHtcblx0XHRcdHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLnJ0bS5kaXNjb25uZWN0ICYmIHRoaXMucnRtLmRpc2Nvbm5lY3QoKTtcblx0XHRcdGxvZ2dlci5jb25uZWN0aW9uLmluZm8oJ0Rpc2Nvbm5lY3RlZCcpO1xuXHRcdFx0dGhpcy51bnJlZ2lzdGVyRm9yUm9ja2V0RXZlbnRzKCk7XG5cdFx0fVxuXHR9XG5cblx0Y29udmVydFNsYWNrTXNnVHh0VG9Sb2NrZXRUeHRGb3JtYXQoc2xhY2tNc2dUeHQpIHtcblx0XHRpZiAoIV8uaXNFbXB0eShzbGFja01zZ1R4dCkpIHtcblx0XHRcdHNsYWNrTXNnVHh0ID0gc2xhY2tNc2dUeHQucmVwbGFjZSgvPCFldmVyeW9uZT4vZywgJ0BhbGwnKTtcblx0XHRcdHNsYWNrTXNnVHh0ID0gc2xhY2tNc2dUeHQucmVwbGFjZSgvPCFjaGFubmVsPi9nLCAnQGFsbCcpO1xuXHRcdFx0c2xhY2tNc2dUeHQgPSBzbGFja01zZ1R4dC5yZXBsYWNlKC88IWhlcmU+L2csICdAaGVyZScpO1xuXHRcdFx0c2xhY2tNc2dUeHQgPSBzbGFja01zZ1R4dC5yZXBsYWNlKC8mZ3Q7L2csICc+Jyk7XG5cdFx0XHRzbGFja01zZ1R4dCA9IHNsYWNrTXNnVHh0LnJlcGxhY2UoLyZsdDsvZywgJzwnKTtcblx0XHRcdHNsYWNrTXNnVHh0ID0gc2xhY2tNc2dUeHQucmVwbGFjZSgvJmFtcDsvZywgJyYnKTtcblx0XHRcdHNsYWNrTXNnVHh0ID0gc2xhY2tNc2dUeHQucmVwbGFjZSgvOnNpbXBsZV9zbWlsZTovZywgJzpzbWlsZTonKTtcblx0XHRcdHNsYWNrTXNnVHh0ID0gc2xhY2tNc2dUeHQucmVwbGFjZSgvOm1lbW86L2csICc6cGVuY2lsOicpO1xuXHRcdFx0c2xhY2tNc2dUeHQgPSBzbGFja01zZ1R4dC5yZXBsYWNlKC86cGlnZ3k6L2csICc6cGlnOicpO1xuXHRcdFx0c2xhY2tNc2dUeHQgPSBzbGFja01zZ1R4dC5yZXBsYWNlKC86dWs6L2csICc6Z2I6Jyk7XG5cdFx0XHRzbGFja01zZ1R4dCA9IHNsYWNrTXNnVHh0LnJlcGxhY2UoLzwoaHR0cFtzXT86W14+XSopPi9nLCAnJDEnKTtcblxuXHRcdFx0c2xhY2tNc2dUeHQucmVwbGFjZSgvKD86PEApKFthLXpBLVowLTldKykoPzpcXHwuKyk/KD86PikvZywgKG1hdGNoLCB1c2VySWQpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLnVzZXJUYWdzW3VzZXJJZF0pIHtcblx0XHRcdFx0XHR0aGlzLmZpbmRSb2NrZXRVc2VyKHVzZXJJZCkgfHwgdGhpcy5hZGRSb2NrZXRVc2VyKHVzZXJJZCk7IC8vIFRoaXMgYWRkcyB1c2VyVGFncyBmb3IgdGhlIHVzZXJJZFxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHVzZXJUYWdzID0gdGhpcy51c2VyVGFnc1t1c2VySWRdO1xuXHRcdFx0XHRpZiAodXNlclRhZ3MpIHtcblx0XHRcdFx0XHRzbGFja01zZ1R4dCA9IHNsYWNrTXNnVHh0LnJlcGxhY2UodXNlclRhZ3Muc2xhY2ssIHVzZXJUYWdzLnJvY2tldCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzbGFja01zZ1R4dCA9ICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gc2xhY2tNc2dUeHQ7XG5cdH1cblxuXHRmaW5kUm9ja2V0Q2hhbm5lbChzbGFja0NoYW5uZWxJZCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJbXBvcnRJZChzbGFja0NoYW5uZWxJZCk7XG5cdH1cblxuXHRhZGRSb2NrZXRDaGFubmVsKHNsYWNrQ2hhbm5lbElELCBoYXNSZXRyaWVkID0gZmFsc2UpIHtcblx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ0FkZGluZyBSb2NrZXQuQ2hhdCBjaGFubmVsIGZyb20gU2xhY2snLCBzbGFja0NoYW5uZWxJRCk7XG5cdFx0bGV0IHNsYWNrUmVzdWx0cyA9IG51bGw7XG5cdFx0bGV0IGlzR3JvdXAgPSBmYWxzZTtcblx0XHRpZiAoc2xhY2tDaGFubmVsSUQuY2hhckF0KDApID09PSAnQycpIHtcblx0XHRcdHNsYWNrUmVzdWx0cyA9IEhUVFAuZ2V0KCdodHRwczovL3NsYWNrLmNvbS9hcGkvY2hhbm5lbHMuaW5mbycsIHsgcGFyYW1zOiB7IHRva2VuOiB0aGlzLmFwaVRva2VuLCBjaGFubmVsOiBzbGFja0NoYW5uZWxJRCB9IH0pO1xuXHRcdH0gZWxzZSBpZiAoc2xhY2tDaGFubmVsSUQuY2hhckF0KDApID09PSAnRycpIHtcblx0XHRcdHNsYWNrUmVzdWx0cyA9IEhUVFAuZ2V0KCdodHRwczovL3NsYWNrLmNvbS9hcGkvZ3JvdXBzLmluZm8nLCB7IHBhcmFtczogeyB0b2tlbjogdGhpcy5hcGlUb2tlbiwgY2hhbm5lbDogc2xhY2tDaGFubmVsSUQgfSB9KTtcblx0XHRcdGlzR3JvdXAgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoc2xhY2tSZXN1bHRzICYmIHNsYWNrUmVzdWx0cy5kYXRhICYmIHNsYWNrUmVzdWx0cy5kYXRhLm9rID09PSB0cnVlKSB7XG5cdFx0XHRjb25zdCByb2NrZXRDaGFubmVsRGF0YSA9IGlzR3JvdXAgPyBzbGFja1Jlc3VsdHMuZGF0YS5ncm91cCA6IHNsYWNrUmVzdWx0cy5kYXRhLmNoYW5uZWw7XG5cdFx0XHRjb25zdCBleGlzdGluZ1JvY2tldFJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKHJvY2tldENoYW5uZWxEYXRhLm5hbWUpO1xuXG5cdFx0XHQvLyBJZiB0aGUgcm9vbSBleGlzdHMsIG1ha2Ugc3VyZSB3ZSBoYXZlIGl0cyBpZCBpbiBpbXBvcnRJZHNcblx0XHRcdGlmIChleGlzdGluZ1JvY2tldFJvb20gfHwgcm9ja2V0Q2hhbm5lbERhdGEuaXNfZ2VuZXJhbCkge1xuXHRcdFx0XHRyb2NrZXRDaGFubmVsRGF0YS5yb2NrZXRJZCA9IHJvY2tldENoYW5uZWxEYXRhLmlzX2dlbmVyYWwgPyAnR0VORVJBTCcgOiBleGlzdGluZ1JvY2tldFJvb20uX2lkO1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5hZGRJbXBvcnRJZHMocm9ja2V0Q2hhbm5lbERhdGEucm9ja2V0SWQsIHJvY2tldENoYW5uZWxEYXRhLmlkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJvY2tldFVzZXJzID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgbWVtYmVyIG9mIHJvY2tldENoYW5uZWxEYXRhLm1lbWJlcnMpIHtcblx0XHRcdFx0XHRpZiAobWVtYmVyICE9PSByb2NrZXRDaGFubmVsRGF0YS5jcmVhdG9yKSB7XG5cdFx0XHRcdFx0XHRjb25zdCByb2NrZXRVc2VyID0gdGhpcy5maW5kUm9ja2V0VXNlcihtZW1iZXIpIHx8IHRoaXMuYWRkUm9ja2V0VXNlcihtZW1iZXIpO1xuXHRcdFx0XHRcdFx0aWYgKHJvY2tldFVzZXIgJiYgcm9ja2V0VXNlci51c2VybmFtZSkge1xuXHRcdFx0XHRcdFx0XHRyb2NrZXRVc2Vycy5wdXNoKHJvY2tldFVzZXIudXNlcm5hbWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCByb2NrZXRVc2VyQ3JlYXRvciA9IHJvY2tldENoYW5uZWxEYXRhLmNyZWF0b3IgPyB0aGlzLmZpbmRSb2NrZXRVc2VyKHJvY2tldENoYW5uZWxEYXRhLmNyZWF0b3IpIHx8IHRoaXMuYWRkUm9ja2V0VXNlcihyb2NrZXRDaGFubmVsRGF0YS5jcmVhdG9yKSA6IG51bGw7XG5cdFx0XHRcdGlmICghcm9ja2V0VXNlckNyZWF0b3IpIHtcblx0XHRcdFx0XHRsb2dnZXIuY2xhc3MuZXJyb3IoJ0NvdWxkIG5vdCBmZXRjaCByb29tIGNyZWF0b3IgaW5mb3JtYXRpb24nLCByb2NrZXRDaGFubmVsRGF0YS5jcmVhdG9yKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHJvY2tldENoYW5uZWwgPSBSb2NrZXRDaGF0LmNyZWF0ZVJvb20oaXNHcm91cCA/ICdwJyA6ICdjJywgcm9ja2V0Q2hhbm5lbERhdGEubmFtZSwgcm9ja2V0VXNlckNyZWF0b3IudXNlcm5hbWUsIHJvY2tldFVzZXJzKTtcblx0XHRcdFx0XHRyb2NrZXRDaGFubmVsRGF0YS5yb2NrZXRJZCA9IHJvY2tldENoYW5uZWwucmlkO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0aWYgKCFoYXNSZXRyaWVkKSB7XG5cdFx0XHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ0Vycm9yIGFkZGluZyBjaGFubmVsIGZyb20gU2xhY2suIFdpbGwgcmV0cnkgaW4gMXMuJywgZS5tZXNzYWdlKTtcblx0XHRcdFx0XHRcdC8vIElmIGZpcnN0IHRpbWUgdHJ5aW5nIHRvIGNyZWF0ZSBjaGFubmVsIGZhaWxzLCBjb3VsZCBiZSBiZWNhdXNlIG9mIG11bHRpcGxlIG1lc3NhZ2VzIHJlY2VpdmVkIGF0IHRoZSBzYW1lIHRpbWUuIFRyeSBhZ2FpbiBvbmNlIGFmdGVyIDFzLlxuXHRcdFx0XHRcdFx0TWV0ZW9yLl9zbGVlcEZvck1zKDEwMDApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuZmluZFJvY2tldENoYW5uZWwoc2xhY2tDaGFubmVsSUQpIHx8IHRoaXMuYWRkUm9ja2V0Q2hhbm5lbChzbGFja0NoYW5uZWxJRCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGUubWVzc2FnZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgcm9vbVVwZGF0ZSA9IHtcblx0XHRcdFx0XHR0czogbmV3IERhdGUocm9ja2V0Q2hhbm5lbERhdGEuY3JlYXRlZCAqIDEwMDApXG5cdFx0XHRcdH07XG5cdFx0XHRcdGxldCBsYXN0U2V0VG9waWMgPSAwO1xuXHRcdFx0XHRpZiAoIV8uaXNFbXB0eShyb2NrZXRDaGFubmVsRGF0YS50b3BpYyAmJiByb2NrZXRDaGFubmVsRGF0YS50b3BpYy52YWx1ZSkpIHtcblx0XHRcdFx0XHRyb29tVXBkYXRlLnRvcGljID0gcm9ja2V0Q2hhbm5lbERhdGEudG9waWMudmFsdWU7XG5cdFx0XHRcdFx0bGFzdFNldFRvcGljID0gcm9ja2V0Q2hhbm5lbERhdGEudG9waWMubGFzdF9zZXQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFfLmlzRW1wdHkocm9ja2V0Q2hhbm5lbERhdGEucHVycG9zZSAmJiByb2NrZXRDaGFubmVsRGF0YS5wdXJwb3NlLnZhbHVlKSAmJiByb2NrZXRDaGFubmVsRGF0YS5wdXJwb3NlLmxhc3Rfc2V0ID4gbGFzdFNldFRvcGljKSB7XG5cdFx0XHRcdFx0cm9vbVVwZGF0ZS50b3BpYyA9IHJvY2tldENoYW5uZWxEYXRhLnB1cnBvc2UudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuYWRkSW1wb3J0SWRzKHJvY2tldENoYW5uZWxEYXRhLnJvY2tldElkLCByb2NrZXRDaGFubmVsRGF0YS5pZCk7XG5cdFx0XHRcdHRoaXMuc2xhY2tDaGFubmVsTWFwW3JvY2tldENoYW5uZWxEYXRhLnJvY2tldElkXSA9IHsgaWQ6IHNsYWNrQ2hhbm5lbElELCBmYW1pbHk6IHNsYWNrQ2hhbm5lbElELmNoYXJBdCgwKSA9PT0gJ0MnID8gJ2NoYW5uZWxzJyA6ICdncm91cHMnIH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQocm9ja2V0Q2hhbm5lbERhdGEucm9ja2V0SWQpO1xuXHRcdH1cblx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ0NoYW5uZWwgbm90IGFkZGVkJyk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0ZmluZFJvY2tldFVzZXIoc2xhY2tVc2VySUQpIHtcblx0XHRjb25zdCByb2NrZXRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SW1wb3J0SWQoc2xhY2tVc2VySUQpO1xuXHRcdGlmIChyb2NrZXRVc2VyICYmICF0aGlzLnVzZXJUYWdzW3NsYWNrVXNlcklEXSkge1xuXHRcdFx0dGhpcy51c2VyVGFnc1tzbGFja1VzZXJJRF0gPSB7IHNsYWNrOiBgPEAkeyBzbGFja1VzZXJJRCB9PmAsIHJvY2tldDogYEAkeyByb2NrZXRVc2VyLnVzZXJuYW1lIH1gIH07XG5cdFx0fVxuXHRcdHJldHVybiByb2NrZXRVc2VyO1xuXHR9XG5cblx0YWRkUm9ja2V0VXNlcihzbGFja1VzZXJJRCkge1xuXHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnQWRkaW5nIFJvY2tldC5DaGF0IHVzZXIgZnJvbSBTbGFjaycsIHNsYWNrVXNlcklEKTtcblx0XHRjb25zdCBzbGFja1Jlc3VsdHMgPSBIVFRQLmdldCgnaHR0cHM6Ly9zbGFjay5jb20vYXBpL3VzZXJzLmluZm8nLCB7IHBhcmFtczogeyB0b2tlbjogdGhpcy5hcGlUb2tlbiwgdXNlcjogc2xhY2tVc2VySUQgfSB9KTtcblx0XHRpZiAoc2xhY2tSZXN1bHRzICYmIHNsYWNrUmVzdWx0cy5kYXRhICYmIHNsYWNrUmVzdWx0cy5kYXRhLm9rID09PSB0cnVlICYmIHNsYWNrUmVzdWx0cy5kYXRhLnVzZXIpIHtcblx0XHRcdGNvbnN0IHJvY2tldFVzZXJEYXRhID0gc2xhY2tSZXN1bHRzLmRhdGEudXNlcjtcblx0XHRcdGNvbnN0IGlzQm90ID0gcm9ja2V0VXNlckRhdGEuaXNfYm90ID09PSB0cnVlO1xuXHRcdFx0Y29uc3QgZW1haWwgPSByb2NrZXRVc2VyRGF0YS5wcm9maWxlICYmIHJvY2tldFVzZXJEYXRhLnByb2ZpbGUuZW1haWwgfHwgJyc7XG5cdFx0XHRsZXQgZXhpc3RpbmdSb2NrZXRVc2VyO1xuXHRcdFx0aWYgKCFpc0JvdCkge1xuXHRcdFx0XHRleGlzdGluZ1JvY2tldFVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlFbWFpbEFkZHJlc3MoZW1haWwpIHx8IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeVVzZXJuYW1lKHJvY2tldFVzZXJEYXRhLm5hbWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXhpc3RpbmdSb2NrZXRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUocm9ja2V0VXNlckRhdGEubmFtZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChleGlzdGluZ1JvY2tldFVzZXIpIHtcblx0XHRcdFx0cm9ja2V0VXNlckRhdGEucm9ja2V0SWQgPSBleGlzdGluZ1JvY2tldFVzZXIuX2lkO1xuXHRcdFx0XHRyb2NrZXRVc2VyRGF0YS5uYW1lID0gZXhpc3RpbmdSb2NrZXRVc2VyLnVzZXJuYW1lO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgbmV3VXNlciA9IHtcblx0XHRcdFx0XHRwYXNzd29yZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdFx0dXNlcm5hbWU6IHJvY2tldFVzZXJEYXRhLm5hbWVcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAoIWlzQm90ICYmIGVtYWlsKSB7XG5cdFx0XHRcdFx0bmV3VXNlci5lbWFpbCA9IGVtYWlsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzQm90KSB7XG5cdFx0XHRcdFx0bmV3VXNlci5qb2luRGVmYXVsdENoYW5uZWxzID0gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyb2NrZXRVc2VyRGF0YS5yb2NrZXRJZCA9IEFjY291bnRzLmNyZWF0ZVVzZXIobmV3VXNlcik7XG5cdFx0XHRcdGNvbnN0IHVzZXJVcGRhdGUgPSB7XG5cdFx0XHRcdFx0dXRjT2Zmc2V0OiByb2NrZXRVc2VyRGF0YS50el9vZmZzZXQgLyAzNjAwLCAvLyBTbGFjaydzIGlzIC0xODAwMCB3aGljaCB0cmFuc2xhdGVzIHRvIFJvY2tldC5DaGF0J3MgYWZ0ZXIgZGl2aWRpbmcgYnkgMzYwMCxcblx0XHRcdFx0XHRyb2xlczogaXNCb3QgPyBbICdib3QnIF0gOiBbICd1c2VyJyBdXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0aWYgKHJvY2tldFVzZXJEYXRhLnByb2ZpbGUgJiYgcm9ja2V0VXNlckRhdGEucHJvZmlsZS5yZWFsX25hbWUpIHtcblx0XHRcdFx0XHR1c2VyVXBkYXRlWyduYW1lJ10gPSByb2NrZXRVc2VyRGF0YS5wcm9maWxlLnJlYWxfbmFtZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChyb2NrZXRVc2VyRGF0YS5kZWxldGVkKSB7XG5cdFx0XHRcdFx0dXNlclVwZGF0ZVsnYWN0aXZlJ10gPSBmYWxzZTtcblx0XHRcdFx0XHR1c2VyVXBkYXRlWydzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMnXSA9IFtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMudXBkYXRlKHsgX2lkOiByb2NrZXRVc2VyRGF0YS5yb2NrZXRJZCB9LCB7ICRzZXQ6IHVzZXJVcGRhdGUgfSk7XG5cblx0XHRcdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHJvY2tldFVzZXJEYXRhLnJvY2tldElkKTtcblxuXHRcdFx0XHRsZXQgdXJsID0gbnVsbDtcblx0XHRcdFx0aWYgKHJvY2tldFVzZXJEYXRhLnByb2ZpbGUpIHtcblx0XHRcdFx0XHRpZiAocm9ja2V0VXNlckRhdGEucHJvZmlsZS5pbWFnZV9vcmlnaW5hbCkge1xuXHRcdFx0XHRcdFx0dXJsID0gcm9ja2V0VXNlckRhdGEucHJvZmlsZS5pbWFnZV9vcmlnaW5hbDtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHJvY2tldFVzZXJEYXRhLnByb2ZpbGUuaW1hZ2VfNTEyKSB7XG5cdFx0XHRcdFx0XHR1cmwgPSByb2NrZXRVc2VyRGF0YS5wcm9maWxlLmltYWdlXzUxMjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHVybCkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRSb2NrZXRDaGF0LnNldFVzZXJBdmF0YXIodXNlciwgdXJsLCBudWxsLCAndXJsJyk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnRXJyb3Igc2V0dGluZyB1c2VyIGF2YXRhcicsIGVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbXBvcnRJZHMgPSBbIHJvY2tldFVzZXJEYXRhLmlkIF07XG5cdFx0XHRpZiAoaXNCb3QgJiYgcm9ja2V0VXNlckRhdGEucHJvZmlsZSAmJiByb2NrZXRVc2VyRGF0YS5wcm9maWxlLmJvdF9pZCkge1xuXHRcdFx0XHRpbXBvcnRJZHMucHVzaChyb2NrZXRVc2VyRGF0YS5wcm9maWxlLmJvdF9pZCk7XG5cdFx0XHR9XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5hZGRJbXBvcnRJZHMocm9ja2V0VXNlckRhdGEucm9ja2V0SWQsIGltcG9ydElkcyk7XG5cdFx0XHRpZiAoIXRoaXMudXNlclRhZ3Nbc2xhY2tVc2VySURdKSB7XG5cdFx0XHRcdHRoaXMudXNlclRhZ3Nbc2xhY2tVc2VySURdID0geyBzbGFjazogYDxAJHsgc2xhY2tVc2VySUQgfT5gLCByb2NrZXQ6IGBAJHsgcm9ja2V0VXNlckRhdGEubmFtZSB9YCB9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHJvY2tldFVzZXJEYXRhLnJvY2tldElkKTtcblx0XHR9XG5cdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdVc2VyIG5vdCBhZGRlZCcpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGFkZEFsaWFzVG9Sb2NrZXRNc2cocm9ja2V0VXNlck5hbWUsIHJvY2tldE1zZ09iaikge1xuXHRcdGlmICh0aGlzLmFsaWFzRm9ybWF0KSB7XG5cdFx0XHRjb25zdCBhbGlhcyA9IHRoaXMudXRpbC5mb3JtYXQodGhpcy5hbGlhc0Zvcm1hdCwgcm9ja2V0VXNlck5hbWUpO1xuXG5cdFx0XHRpZiAoYWxpYXMgIT09IHJvY2tldFVzZXJOYW1lKSB7XG5cdFx0XHRcdHJvY2tldE1zZ09iai5hbGlhcyA9IGFsaWFzO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByb2NrZXRNc2dPYmo7XG5cdH1cblxuXHRjcmVhdGVBbmRTYXZlUm9ja2V0TWVzc2FnZShyb2NrZXRDaGFubmVsLCByb2NrZXRVc2VyLCBzbGFja01lc3NhZ2UsIHJvY2tldE1zZ0RhdGFEZWZhdWx0cywgaXNJbXBvcnRpbmcpIHtcblx0XHRpZiAoc2xhY2tNZXNzYWdlLnR5cGUgPT09ICdtZXNzYWdlJykge1xuXHRcdFx0bGV0IHJvY2tldE1zZ09iaiA9IHt9O1xuXHRcdFx0aWYgKCFfLmlzRW1wdHkoc2xhY2tNZXNzYWdlLnN1YnR5cGUpKSB7XG5cdFx0XHRcdHJvY2tldE1zZ09iaiA9IHRoaXMucHJvY2Vzc1NsYWNrU3VidHlwZWRNZXNzYWdlKHJvY2tldENoYW5uZWwsIHJvY2tldFVzZXIsIHNsYWNrTWVzc2FnZSwgaXNJbXBvcnRpbmcpO1xuXHRcdFx0XHRpZiAoIXJvY2tldE1zZ09iaikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cm9ja2V0TXNnT2JqID0ge1xuXHRcdFx0XHRcdG1zZzogdGhpcy5jb252ZXJ0U2xhY2tNc2dUeHRUb1JvY2tldFR4dEZvcm1hdChzbGFja01lc3NhZ2UudGV4dCksXG5cdFx0XHRcdFx0cmlkOiByb2NrZXRDaGFubmVsLl9pZCxcblx0XHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0XHRfaWQ6IHJvY2tldFVzZXIuX2lkLFxuXHRcdFx0XHRcdFx0dXNlcm5hbWU6IHJvY2tldFVzZXIudXNlcm5hbWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5hZGRBbGlhc1RvUm9ja2V0TXNnKHJvY2tldFVzZXIudXNlcm5hbWUsIHJvY2tldE1zZ09iaik7XG5cdFx0XHR9XG5cdFx0XHRfLmV4dGVuZChyb2NrZXRNc2dPYmosIHJvY2tldE1zZ0RhdGFEZWZhdWx0cyk7XG5cdFx0XHRpZiAoc2xhY2tNZXNzYWdlLmVkaXRlZCkge1xuXHRcdFx0XHRyb2NrZXRNc2dPYmouZWRpdGVkQXQgPSBuZXcgRGF0ZShwYXJzZUludChzbGFja01lc3NhZ2UuZWRpdGVkLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2xhY2tNZXNzYWdlLnN1YnR5cGUgPT09ICdib3RfbWVzc2FnZScpIHtcblx0XHRcdFx0cm9ja2V0VXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKCdyb2NrZXQuY2F0JywgeyBmaWVsZHM6IHsgdXNlcm5hbWU6IDEgfSB9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNsYWNrTWVzc2FnZS5waW5uZWRfdG8gJiYgc2xhY2tNZXNzYWdlLnBpbm5lZF90by5pbmRleE9mKHNsYWNrTWVzc2FnZS5jaGFubmVsKSAhPT0gLTEpIHtcblx0XHRcdFx0cm9ja2V0TXNnT2JqLnBpbm5lZCA9IHRydWU7XG5cdFx0XHRcdHJvY2tldE1zZ09iai5waW5uZWRBdCA9IERhdGUubm93O1xuXHRcdFx0XHRyb2NrZXRNc2dPYmoucGlubmVkQnkgPSBfLnBpY2socm9ja2V0VXNlciwgJ19pZCcsICd1c2VybmFtZScpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHNsYWNrTWVzc2FnZS5zdWJ0eXBlID09PSAnYm90X21lc3NhZ2UnKSB7XG5cdFx0XHRcdE1ldGVvci5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRpZiAoc2xhY2tNZXNzYWdlLmJvdF9pZCAmJiBzbGFja01lc3NhZ2UudHMgJiYgIVJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRPbmVCeVNsYWNrQm90SWRBbmRTbGFja1RzKHNsYWNrTWVzc2FnZS5ib3RfaWQsIHNsYWNrTWVzc2FnZS50cykpIHtcblx0XHRcdFx0XHRcdFJvY2tldENoYXQuc2VuZE1lc3NhZ2Uocm9ja2V0VXNlciwgcm9ja2V0TXNnT2JqLCByb2NrZXRDaGFubmVsLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDUwMCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ1NlbmQgbWVzc2FnZSB0byBSb2NrZXQuQ2hhdCcpO1xuXHRcdFx0XHRSb2NrZXRDaGF0LnNlbmRNZXNzYWdlKHJvY2tldFVzZXIsIHJvY2tldE1zZ09iaiwgcm9ja2V0Q2hhbm5lbCwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0IGh0dHBzOi8vYXBpLnNsYWNrLmNvbS9ldmVudHMvcmVhY3Rpb25fcmVtb3ZlZFxuXHQgKi9cblx0b25TbGFja1JlYWN0aW9uUmVtb3ZlZChzbGFja1JlYWN0aW9uTXNnKSB7XG5cdFx0aWYgKHNsYWNrUmVhY3Rpb25Nc2cpIHtcblx0XHRcdGNvbnN0IHJvY2tldFVzZXIgPSB0aGlzLmdldFJvY2tldFVzZXIoc2xhY2tSZWFjdGlvbk1zZy51c2VyKTtcblx0XHRcdC8vTGV0cyBmaW5kIG91ciBSb2NrZXQgb3JpZ2luYXRlZCBtZXNzYWdlXG5cdFx0XHRsZXQgcm9ja2V0TXNnID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5U2xhY2tUcyhzbGFja1JlYWN0aW9uTXNnLml0ZW0udHMpO1xuXG5cdFx0XHRpZiAoIXJvY2tldE1zZykge1xuXHRcdFx0XHQvL011c3QgaGF2ZSBvcmlnaW5hdGVkIGZyb20gU2xhY2tcblx0XHRcdFx0Y29uc3Qgcm9ja2V0SUQgPSB0aGlzLmNyZWF0ZVJvY2tldElEKHNsYWNrUmVhY3Rpb25Nc2cuaXRlbS5jaGFubmVsLCBzbGFja1JlYWN0aW9uTXNnLml0ZW0udHMpO1xuXHRcdFx0XHRyb2NrZXRNc2cgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlJZChyb2NrZXRJRCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyb2NrZXRNc2cgJiYgcm9ja2V0VXNlcikge1xuXHRcdFx0XHRjb25zdCByb2NrZXRSZWFjdGlvbiA9IGA6JHsgc2xhY2tSZWFjdGlvbk1zZy5yZWFjdGlvbiB9OmA7XG5cblx0XHRcdFx0Ly9JZiB0aGUgUm9ja2V0IHVzZXIgaGFzIGFscmVhZHkgYmVlbiByZW1vdmVkLCB0aGVuIHRoaXMgaXMgYW4gZWNobyBiYWNrIGZyb20gc2xhY2tcblx0XHRcdFx0aWYgKHJvY2tldE1zZy5yZWFjdGlvbnMpIHtcblx0XHRcdFx0XHRjb25zdCB0aGVSZWFjdGlvbiA9IHJvY2tldE1zZy5yZWFjdGlvbnNbcm9ja2V0UmVhY3Rpb25dO1xuXHRcdFx0XHRcdGlmICh0aGVSZWFjdGlvbikge1xuXHRcdFx0XHRcdFx0aWYgKHRoZVJlYWN0aW9uLnVzZXJuYW1lcy5pbmRleE9mKHJvY2tldFVzZXIudXNlcm5hbWUpID09PSAtMSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47IC8vUmVhY3Rpb24gYWxyZWFkeSByZW1vdmVkXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vUmVhY3Rpb24gYWxyZWFkeSByZW1vdmVkXG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9TdGFzaCB0aGlzIGF3YXkgdG8ga2V5IG9mZiBpdCBsYXRlciBzbyB3ZSBkb24ndCBzZW5kIGl0IGJhY2sgdG8gU2xhY2tcblx0XHRcdFx0dGhpcy5yZWFjdGlvbnNNYXAuc2V0KGB1bnNldCR7IHJvY2tldE1zZy5faWQgfSR7IHJvY2tldFJlYWN0aW9uIH1gLCByb2NrZXRVc2VyKTtcblx0XHRcdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdSZW1vdmluZyByZWFjdGlvbiBmcm9tIFNsYWNrJyk7XG5cdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIocm9ja2V0VXNlci5faWQsICgpID0+IHtcblx0XHRcdFx0XHRNZXRlb3IuY2FsbCgnc2V0UmVhY3Rpb24nLCByb2NrZXRSZWFjdGlvbiwgcm9ja2V0TXNnLl9pZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdCBodHRwczovL2FwaS5zbGFjay5jb20vZXZlbnRzL3JlYWN0aW9uX2FkZGVkXG5cdCAqL1xuXHRvblNsYWNrUmVhY3Rpb25BZGRlZChzbGFja1JlYWN0aW9uTXNnKSB7XG5cdFx0aWYgKHNsYWNrUmVhY3Rpb25Nc2cpIHtcblx0XHRcdGNvbnN0IHJvY2tldFVzZXIgPSB0aGlzLmdldFJvY2tldFVzZXIoc2xhY2tSZWFjdGlvbk1zZy51c2VyKTtcblxuXHRcdFx0aWYgKHJvY2tldFVzZXIucm9sZXMuaW5jbHVkZXMoJ2JvdCcpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly9MZXRzIGZpbmQgb3VyIFJvY2tldCBvcmlnaW5hdGVkIG1lc3NhZ2Vcblx0XHRcdGxldCByb2NrZXRNc2cgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlTbGFja1RzKHNsYWNrUmVhY3Rpb25Nc2cuaXRlbS50cyk7XG5cblx0XHRcdGlmICghcm9ja2V0TXNnKSB7XG5cdFx0XHRcdC8vTXVzdCBoYXZlIG9yaWdpbmF0ZWQgZnJvbSBTbGFja1xuXHRcdFx0XHRjb25zdCByb2NrZXRJRCA9IHRoaXMuY3JlYXRlUm9ja2V0SUQoc2xhY2tSZWFjdGlvbk1zZy5pdGVtLmNoYW5uZWwsIHNsYWNrUmVhY3Rpb25Nc2cuaXRlbS50cyk7XG5cdFx0XHRcdHJvY2tldE1zZyA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRPbmVCeUlkKHJvY2tldElEKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJvY2tldE1zZyAmJiByb2NrZXRVc2VyKSB7XG5cdFx0XHRcdGNvbnN0IHJvY2tldFJlYWN0aW9uID0gYDokeyBzbGFja1JlYWN0aW9uTXNnLnJlYWN0aW9uIH06YDtcblxuXHRcdFx0XHQvL0lmIHRoZSBSb2NrZXQgdXNlciBoYXMgYWxyZWFkeSByZWFjdGVkLCB0aGVuIHRoaXMgaXMgU2xhY2sgZWNob2luZyBiYWNrIHRvIHVzXG5cdFx0XHRcdGlmIChyb2NrZXRNc2cucmVhY3Rpb25zKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGhlUmVhY3Rpb24gPSByb2NrZXRNc2cucmVhY3Rpb25zW3JvY2tldFJlYWN0aW9uXTtcblx0XHRcdFx0XHRpZiAodGhlUmVhY3Rpb24pIHtcblx0XHRcdFx0XHRcdGlmICh0aGVSZWFjdGlvbi51c2VybmFtZXMuaW5kZXhPZihyb2NrZXRVc2VyLnVzZXJuYW1lKSAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuOyAvL0FscmVhZHkgcmVhY3RlZFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vU3Rhc2ggdGhpcyBhd2F5IHRvIGtleSBvZmYgaXQgbGF0ZXIgc28gd2UgZG9uJ3Qgc2VuZCBpdCBiYWNrIHRvIFNsYWNrXG5cdFx0XHRcdHRoaXMucmVhY3Rpb25zTWFwLnNldChgc2V0JHsgcm9ja2V0TXNnLl9pZCB9JHsgcm9ja2V0UmVhY3Rpb24gfWAsIHJvY2tldFVzZXIpO1xuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ0FkZGluZyByZWFjdGlvbiBmcm9tIFNsYWNrJyk7XG5cdFx0XHRcdE1ldGVvci5ydW5Bc1VzZXIocm9ja2V0VXNlci5faWQsICgpID0+IHtcblx0XHRcdFx0XHRNZXRlb3IuY2FsbCgnc2V0UmVhY3Rpb24nLCByb2NrZXRSZWFjdGlvbiwgcm9ja2V0TXNnLl9pZCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBXZSBoYXZlIHJlY2VpdmVkIGEgbWVzc2FnZSBmcm9tIHNsYWNrIGFuZCB3ZSBuZWVkIHRvIHNhdmUvZGVsZXRlL3VwZGF0ZSBpdCBpbnRvIHJvY2tldFxuXHQgKiBodHRwczovL2FwaS5zbGFjay5jb20vZXZlbnRzL21lc3NhZ2Vcblx0ICovXG5cdG9uU2xhY2tNZXNzYWdlKHNsYWNrTWVzc2FnZSwgaXNJbXBvcnRpbmcpIHtcblx0XHRpZiAoc2xhY2tNZXNzYWdlLnN1YnR5cGUpIHtcblx0XHRcdHN3aXRjaCAoc2xhY2tNZXNzYWdlLnN1YnR5cGUpIHtcblx0XHRcdFx0Y2FzZSAnbWVzc2FnZV9kZWxldGVkJzpcblx0XHRcdFx0XHR0aGlzLnByb2Nlc3NTbGFja01lc3NhZ2VEZWxldGVkKHNsYWNrTWVzc2FnZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ21lc3NhZ2VfY2hhbmdlZCc6XG5cdFx0XHRcdFx0dGhpcy5wcm9jZXNzU2xhY2tNZXNzYWdlQ2hhbmdlZChzbGFja01lc3NhZ2UpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdC8vS2VlcGluZyBiYWNrd2FyZHMgY29tcGF0YWJpbGl0eSBmb3Igbm93LCByZWZhY3RvciBsYXRlclxuXHRcdFx0XHRcdHRoaXMucHJvY2Vzc1NsYWNrTmV3TWVzc2FnZShzbGFja01lc3NhZ2UsIGlzSW1wb3J0aW5nKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly9TaW1wbGUgbWVzc2FnZVxuXHRcdFx0dGhpcy5wcm9jZXNzU2xhY2tOZXdNZXNzYWdlKHNsYWNrTWVzc2FnZSwgaXNJbXBvcnRpbmcpO1xuXHRcdH1cblx0fVxuXG5cdHByb2Nlc3NTbGFja1N1YnR5cGVkTWVzc2FnZShyb2NrZXRDaGFubmVsLCByb2NrZXRVc2VyLCBzbGFja01lc3NhZ2UsIGlzSW1wb3J0aW5nKSB7XG5cdFx0bGV0IHJvY2tldE1zZ09iaiA9IG51bGw7XG5cdFx0c3dpdGNoIChzbGFja01lc3NhZ2Uuc3VidHlwZSkge1xuXHRcdFx0Y2FzZSAnYm90X21lc3NhZ2UnOlxuXHRcdFx0XHRpZiAoc2xhY2tNZXNzYWdlLnVzZXJuYW1lICE9PSB1bmRlZmluZWQgJiYgdGhpcy5leGNsdWRlQm90bmFtZXMgJiYgc2xhY2tNZXNzYWdlLnVzZXJuYW1lLm1hdGNoKHRoaXMuZXhjbHVkZUJvdG5hbWVzKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJvY2tldE1zZ09iaiA9IHtcblx0XHRcdFx0XHRtc2c6IHRoaXMuY29udmVydFNsYWNrTXNnVHh0VG9Sb2NrZXRUeHRGb3JtYXQoc2xhY2tNZXNzYWdlLnRleHQpLFxuXHRcdFx0XHRcdHJpZDogcm9ja2V0Q2hhbm5lbC5faWQsXG5cdFx0XHRcdFx0Ym90OiB0cnVlLFxuXHRcdFx0XHRcdGF0dGFjaG1lbnRzOiBzbGFja01lc3NhZ2UuYXR0YWNobWVudHMsXG5cdFx0XHRcdFx0dXNlcm5hbWU6IHNsYWNrTWVzc2FnZS51c2VybmFtZSB8fCBzbGFja01lc3NhZ2UuYm90X2lkXG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMuYWRkQWxpYXNUb1JvY2tldE1zZyhzbGFja01lc3NhZ2UudXNlcm5hbWUgfHwgc2xhY2tNZXNzYWdlLmJvdF9pZCwgcm9ja2V0TXNnT2JqKTtcblx0XHRcdFx0aWYgKHNsYWNrTWVzc2FnZS5pY29ucykge1xuXHRcdFx0XHRcdHJvY2tldE1zZ09iai5lbW9qaSA9IHNsYWNrTWVzc2FnZS5pY29ucy5lbW9qaTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcm9ja2V0TXNnT2JqO1xuXHRcdFx0Y2FzZSAnbWVfbWVzc2FnZSc6XG5cdFx0XHRcdHJldHVybiB0aGlzLmFkZEFsaWFzVG9Sb2NrZXRNc2cocm9ja2V0VXNlci51c2VybmFtZSwge1xuXHRcdFx0XHRcdG1zZzogYF8keyB0aGlzLmNvbnZlcnRTbGFja01zZ1R4dFRvUm9ja2V0VHh0Rm9ybWF0KHNsYWNrTWVzc2FnZS50ZXh0KSB9X2Bcblx0XHRcdFx0fSk7XG5cdFx0XHRjYXNlICdjaGFubmVsX2pvaW4nOlxuXHRcdFx0XHRpZiAoaXNJbXBvcnRpbmcpIHtcblx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVVc2VySm9pbldpdGhSb29tSWRBbmRVc2VyKHJvY2tldENoYW5uZWwuX2lkLCByb2NrZXRVc2VyLCB7IHRzOiBuZXcgRGF0ZShwYXJzZUludChzbGFja01lc3NhZ2UudHMuc3BsaXQoJy4nKVswXSkgKiAxMDAwKSwgaW1wb3J0ZWQ6ICdzbGFja2JyaWRnZScgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdC5hZGRVc2VyVG9Sb29tKHJvY2tldENoYW5uZWwuX2lkLCByb2NrZXRVc2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdncm91cF9qb2luJzpcblx0XHRcdFx0aWYgKHNsYWNrTWVzc2FnZS5pbnZpdGVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW52aXRlciA9IHNsYWNrTWVzc2FnZS5pbnZpdGVyID8gdGhpcy5maW5kUm9ja2V0VXNlcihzbGFja01lc3NhZ2UuaW52aXRlcikgfHwgdGhpcy5hZGRSb2NrZXRVc2VyKHNsYWNrTWVzc2FnZS5pbnZpdGVyKSA6IG51bGw7XG5cdFx0XHRcdFx0aWYgKGlzSW1wb3J0aW5nKSB7XG5cdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVVc2VyQWRkZWRXaXRoUm9vbUlkQW5kVXNlcihyb2NrZXRDaGFubmVsLl9pZCwgcm9ja2V0VXNlciwge1xuXHRcdFx0XHRcdFx0XHR0czogbmV3IERhdGUocGFyc2VJbnQoc2xhY2tNZXNzYWdlLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCksXG5cdFx0XHRcdFx0XHRcdHU6IHtcblx0XHRcdFx0XHRcdFx0XHRfaWQ6IGludml0ZXIuX2lkLFxuXHRcdFx0XHRcdFx0XHRcdHVzZXJuYW1lOiBpbnZpdGVyLnVzZXJuYW1lXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGltcG9ydGVkOiAnc2xhY2ticmlkZ2UnXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5hZGRVc2VyVG9Sb29tKHJvY2tldENoYW5uZWwuX2lkLCByb2NrZXRVc2VyLCBpbnZpdGVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0Y2FzZSAnY2hhbm5lbF9sZWF2ZSc6XG5cdFx0XHRjYXNlICdncm91cF9sZWF2ZSc6XG5cdFx0XHRcdGlmIChpc0ltcG9ydGluZykge1xuXHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVVzZXJMZWF2ZVdpdGhSb29tSWRBbmRVc2VyKHJvY2tldENoYW5uZWwuX2lkLCByb2NrZXRVc2VyLCB7XG5cdFx0XHRcdFx0XHR0czogbmV3IERhdGUocGFyc2VJbnQoc2xhY2tNZXNzYWdlLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCksXG5cdFx0XHRcdFx0XHRpbXBvcnRlZDogJ3NsYWNrYnJpZGdlJ1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFJvY2tldENoYXQucmVtb3ZlVXNlckZyb21Sb29tKHJvY2tldENoYW5uZWwuX2lkLCByb2NrZXRVc2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdjaGFubmVsX3RvcGljJzpcblx0XHRcdGNhc2UgJ2dyb3VwX3RvcGljJzpcblx0XHRcdFx0aWYgKGlzSW1wb3J0aW5nKSB7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlUm9vbVNldHRpbmdzQ2hhbmdlZFdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ3Jvb21fY2hhbmdlZF90b3BpYycsIHJvY2tldENoYW5uZWwuX2lkLCBzbGFja01lc3NhZ2UudG9waWMsIHJvY2tldFVzZXIsIHsgdHM6IG5ldyBEYXRlKHBhcnNlSW50KHNsYWNrTWVzc2FnZS50cy5zcGxpdCgnLicpWzBdKSAqIDEwMDApLCBpbXBvcnRlZDogJ3NsYWNrYnJpZGdlJyB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRSb2NrZXRDaGF0LnNhdmVSb29tVG9waWMocm9ja2V0Q2hhbm5lbC5faWQsIHNsYWNrTWVzc2FnZS50b3BpYywgcm9ja2V0VXNlciwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgJ2NoYW5uZWxfcHVycG9zZSc6XG5cdFx0XHRjYXNlICdncm91cF9wdXJwb3NlJzpcblx0XHRcdFx0aWYgKGlzSW1wb3J0aW5nKSB7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlUm9vbVNldHRpbmdzQ2hhbmdlZFdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ3Jvb21fY2hhbmdlZF90b3BpYycsIHJvY2tldENoYW5uZWwuX2lkLCBzbGFja01lc3NhZ2UucHVycG9zZSwgcm9ja2V0VXNlciwgeyB0czogbmV3IERhdGUocGFyc2VJbnQoc2xhY2tNZXNzYWdlLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCksIGltcG9ydGVkOiAnc2xhY2ticmlkZ2UnIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFJvY2tldENoYXQuc2F2ZVJvb21Ub3BpYyhyb2NrZXRDaGFubmVsLl9pZCwgc2xhY2tNZXNzYWdlLnB1cnBvc2UsIHJvY2tldFVzZXIsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdjaGFubmVsX25hbWUnOlxuXHRcdFx0Y2FzZSAnZ3JvdXBfbmFtZSc6XG5cdFx0XHRcdGlmIChpc0ltcG9ydGluZykge1xuXHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVJvb21SZW5hbWVkV2l0aFJvb21JZFJvb21OYW1lQW5kVXNlcihyb2NrZXRDaGFubmVsLl9pZCwgc2xhY2tNZXNzYWdlLm5hbWUsIHJvY2tldFVzZXIsIHsgdHM6IG5ldyBEYXRlKHBhcnNlSW50KHNsYWNrTWVzc2FnZS50cy5zcGxpdCgnLicpWzBdKSAqIDEwMDApLCBpbXBvcnRlZDogJ3NsYWNrYnJpZGdlJyB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRSb2NrZXRDaGF0LnNhdmVSb29tTmFtZShyb2NrZXRDaGFubmVsLl9pZCwgc2xhY2tNZXNzYWdlLm5hbWUsIHJvY2tldFVzZXIsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdjaGFubmVsX2FyY2hpdmUnOlxuXHRcdFx0Y2FzZSAnZ3JvdXBfYXJjaGl2ZSc6XG5cdFx0XHRcdGlmICghaXNJbXBvcnRpbmcpIHtcblx0XHRcdFx0XHRSb2NrZXRDaGF0LmFyY2hpdmVSb29tKHJvY2tldENoYW5uZWwpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgJ2NoYW5uZWxfdW5hcmNoaXZlJzpcblx0XHRcdGNhc2UgJ2dyb3VwX3VuYXJjaGl2ZSc6XG5cdFx0XHRcdGlmICghaXNJbXBvcnRpbmcpIHtcblx0XHRcdFx0XHRSb2NrZXRDaGF0LnVuYXJjaGl2ZVJvb20ocm9ja2V0Q2hhbm5lbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0Y2FzZSAnZmlsZV9zaGFyZSc6XG5cdFx0XHRcdGlmIChzbGFja01lc3NhZ2UuZmlsZSAmJiBzbGFja01lc3NhZ2UuZmlsZS51cmxfcHJpdmF0ZV9kb3dubG9hZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGV0YWlscyA9IHtcblx0XHRcdFx0XHRcdG1lc3NhZ2VfaWQ6IGBzbGFjay0keyBzbGFja01lc3NhZ2UudHMucmVwbGFjZSgvXFwuL2csICctJykgfWAsXG5cdFx0XHRcdFx0XHRuYW1lOiBzbGFja01lc3NhZ2UuZmlsZS5uYW1lLFxuXHRcdFx0XHRcdFx0c2l6ZTogc2xhY2tNZXNzYWdlLmZpbGUuc2l6ZSxcblx0XHRcdFx0XHRcdHR5cGU6IHNsYWNrTWVzc2FnZS5maWxlLm1pbWV0eXBlLFxuXHRcdFx0XHRcdFx0cmlkOiByb2NrZXRDaGFubmVsLl9pZFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMudXBsb2FkRmlsZUZyb21TbGFjayhkZXRhaWxzLCBzbGFja01lc3NhZ2UuZmlsZS51cmxfcHJpdmF0ZV9kb3dubG9hZCwgcm9ja2V0VXNlciwgcm9ja2V0Q2hhbm5lbCwgbmV3IERhdGUocGFyc2VJbnQoc2xhY2tNZXNzYWdlLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCksIGlzSW1wb3J0aW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2ZpbGVfY29tbWVudCc6XG5cdFx0XHRcdGxvZ2dlci5jbGFzcy5lcnJvcignRmlsZSBjb21tZW50IG5vdCBpbXBsZW1lbnRlZCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdmaWxlX21lbnRpb24nOlxuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZXJyb3IoJ0ZpbGUgbWVudGlvbmVkIG5vdCBpbXBsZW1lbnRlZCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdwaW5uZWRfaXRlbSc6XG5cdFx0XHRcdGlmIChzbGFja01lc3NhZ2UuYXR0YWNobWVudHMgJiYgc2xhY2tNZXNzYWdlLmF0dGFjaG1lbnRzWzBdICYmIHNsYWNrTWVzc2FnZS5hdHRhY2htZW50c1swXS50ZXh0KSB7XG5cdFx0XHRcdFx0cm9ja2V0TXNnT2JqID0ge1xuXHRcdFx0XHRcdFx0cmlkOiByb2NrZXRDaGFubmVsLl9pZCxcblx0XHRcdFx0XHRcdHQ6ICdtZXNzYWdlX3Bpbm5lZCcsXG5cdFx0XHRcdFx0XHRtc2c6ICcnLFxuXHRcdFx0XHRcdFx0dToge1xuXHRcdFx0XHRcdFx0XHRfaWQ6IHJvY2tldFVzZXIuX2lkLFxuXHRcdFx0XHRcdFx0XHR1c2VybmFtZTogcm9ja2V0VXNlci51c2VybmFtZVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnRzOiBbe1xuXHRcdFx0XHRcdFx0XHQndGV4dCcgOiB0aGlzLmNvbnZlcnRTbGFja01zZ1R4dFRvUm9ja2V0VHh0Rm9ybWF0KHNsYWNrTWVzc2FnZS5hdHRhY2htZW50c1swXS50ZXh0KSxcblx0XHRcdFx0XHRcdFx0J2F1dGhvcl9uYW1lJyA6IHNsYWNrTWVzc2FnZS5hdHRhY2htZW50c1swXS5hdXRob3Jfc3VibmFtZSxcblx0XHRcdFx0XHRcdFx0J2F1dGhvcl9pY29uJyA6IGdldEF2YXRhclVybEZyb21Vc2VybmFtZShzbGFja01lc3NhZ2UuYXR0YWNobWVudHNbMF0uYXV0aG9yX3N1Ym5hbWUpLFxuXHRcdFx0XHRcdFx0XHQndHMnIDogbmV3IERhdGUocGFyc2VJbnQoc2xhY2tNZXNzYWdlLmF0dGFjaG1lbnRzWzBdLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMClcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdGlmICghaXNJbXBvcnRpbmcpIHtcblx0XHRcdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnNldFBpbm5lZEJ5SWRBbmRVc2VySWQoYHNsYWNrLSR7IHNsYWNrTWVzc2FnZS5hdHRhY2htZW50c1swXS5jaGFubmVsX2lkIH0tJHsgc2xhY2tNZXNzYWdlLmF0dGFjaG1lbnRzWzBdLnRzLnJlcGxhY2UoL1xcLi9nLCAnLScpIH1gLCByb2NrZXRNc2dPYmoudSwgdHJ1ZSwgbmV3IERhdGUocGFyc2VJbnQoc2xhY2tNZXNzYWdlLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiByb2NrZXRNc2dPYmo7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bG9nZ2VyLmNsYXNzLmVycm9yKCdQaW5uZWQgaXRlbSB3aXRoIG5vIGF0dGFjaG1lbnQnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICd1bnBpbm5lZF9pdGVtJzpcblx0XHRcdFx0bG9nZ2VyLmNsYXNzLmVycm9yKCdVbnBpbm5lZCBpdGVtIG5vdCBpbXBsZW1lbnRlZCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdFVwbG9hZHMgdGhlIGZpbGUgdG8gdGhlIHN0b3JhZ2UuXG5cdEBwYXJhbSBbT2JqZWN0XSBkZXRhaWxzIGFuIG9iamVjdCB3aXRoIGRldGFpbHMgYWJvdXQgdGhlIHVwbG9hZC4gbmFtZSwgc2l6ZSwgdHlwZSwgYW5kIHJpZFxuXHRAcGFyYW0gW1N0cmluZ10gZmlsZVVybCB1cmwgb2YgdGhlIGZpbGUgdG8gZG93bmxvYWQvaW1wb3J0XG5cdEBwYXJhbSBbT2JqZWN0XSB1c2VyIHRoZSBSb2NrZXQuQ2hhdCB1c2VyXG5cdEBwYXJhbSBbT2JqZWN0XSByb29tIHRoZSBSb2NrZXQuQ2hhdCByb29tXG5cdEBwYXJhbSBbRGF0ZV0gdGltZVN0YW1wIHRoZSB0aW1lc3RhbXAgdGhlIGZpbGUgd2FzIHVwbG9hZGVkXG5cdCoqL1xuXHQvL2RldGFpbHMsIHNsYWNrTWVzc2FnZS5maWxlLnVybF9wcml2YXRlX2Rvd25sb2FkLCByb2NrZXRVc2VyLCByb2NrZXRDaGFubmVsLCBuZXcgRGF0ZShwYXJzZUludChzbGFja01lc3NhZ2UudHMuc3BsaXQoJy4nKVswXSkgKiAxMDAwKSwgaXNJbXBvcnRpbmcpO1xuXHR1cGxvYWRGaWxlRnJvbVNsYWNrKGRldGFpbHMsIHNsYWNrRmlsZVVSTCwgcm9ja2V0VXNlciwgcm9ja2V0Q2hhbm5lbCwgdGltZVN0YW1wLCBpc0ltcG9ydGluZykge1xuXHRcdGNvbnN0IHVybCA9IE5wbS5yZXF1aXJlKCd1cmwnKTtcblx0XHRjb25zdCByZXF1ZXN0TW9kdWxlID0gL2h0dHBzL2kudGVzdChzbGFja0ZpbGVVUkwpID8gTnBtLnJlcXVpcmUoJ2h0dHBzJykgOiBOcG0ucmVxdWlyZSgnaHR0cCcpO1xuXHRcdGNvbnN0IHBhcnNlZFVybCA9IHVybC5wYXJzZShzbGFja0ZpbGVVUkwsIHRydWUpO1xuXHRcdHBhcnNlZFVybC5oZWFkZXJzID0geyAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHsgdGhpcy5hcGlUb2tlbiB9YCB9O1xuXHRcdHJlcXVlc3RNb2R1bGUuZ2V0KHBhcnNlZFVybCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoc3RyZWFtKSA9PiB7XG5cdFx0XHRjb25zdCBmaWxlU3RvcmUgPSBGaWxlVXBsb2FkLmdldFN0b3JlKCdVcGxvYWRzJyk7XG5cblx0XHRcdGZpbGVTdG9yZS5pbnNlcnQoZGV0YWlscywgc3RyZWFtLCAoZXJyLCBmaWxlKSA9PiB7XG5cdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCB1cmwgPSBmaWxlLnVybC5yZXBsYWNlKE1ldGVvci5hYnNvbHV0ZVVybCgpLCAnLycpO1xuXHRcdFx0XHRcdGNvbnN0IGF0dGFjaG1lbnQgPSB7XG5cdFx0XHRcdFx0XHR0aXRsZTogZmlsZS5uYW1lLFxuXHRcdFx0XHRcdFx0dGl0bGVfbGluazogdXJsXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdGlmICgvXmltYWdlXFwvLisvLnRlc3QoZmlsZS50eXBlKSkge1xuXHRcdFx0XHRcdFx0YXR0YWNobWVudC5pbWFnZV91cmwgPSB1cmw7XG5cdFx0XHRcdFx0XHRhdHRhY2htZW50LmltYWdlX3R5cGUgPSBmaWxlLnR5cGU7XG5cdFx0XHRcdFx0XHRhdHRhY2htZW50LmltYWdlX3NpemUgPSBmaWxlLnNpemU7XG5cdFx0XHRcdFx0XHRhdHRhY2htZW50LmltYWdlX2RpbWVuc2lvbnMgPSBmaWxlLmlkZW50aWZ5ICYmIGZpbGUuaWRlbnRpZnkuc2l6ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKC9eYXVkaW9cXC8uKy8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRcdFx0XHRhdHRhY2htZW50LmF1ZGlvX3VybCA9IHVybDtcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fdHlwZSA9IGZpbGUudHlwZTtcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fc2l6ZSA9IGZpbGUuc2l6ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKC9edmlkZW9cXC8uKy8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRcdFx0XHRhdHRhY2htZW50LnZpZGVvX3VybCA9IHVybDtcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnQudmlkZW9fdHlwZSA9IGZpbGUudHlwZTtcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnQudmlkZW9fc2l6ZSA9IGZpbGUuc2l6ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBtc2cgPSB7XG5cdFx0XHRcdFx0XHRyaWQ6IGRldGFpbHMucmlkLFxuXHRcdFx0XHRcdFx0dHM6IHRpbWVTdGFtcCxcblx0XHRcdFx0XHRcdG1zZzogJycsXG5cdFx0XHRcdFx0XHRmaWxlOiB7XG5cdFx0XHRcdFx0XHRcdF9pZDogZmlsZS5faWRcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRncm91cGFibGU6IGZhbHNlLFxuXHRcdFx0XHRcdFx0YXR0YWNobWVudHM6IFthdHRhY2htZW50XVxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRpZiAoaXNJbXBvcnRpbmcpIHtcblx0XHRcdFx0XHRcdG1zZy5pbXBvcnRlZCA9ICdzbGFja2JyaWRnZSc7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGRldGFpbHMubWVzc2FnZV9pZCAmJiAodHlwZW9mIGRldGFpbHMubWVzc2FnZV9pZCA9PT0gJ3N0cmluZycpKSB7XG5cdFx0XHRcdFx0XHRtc2dbJ19pZCddID0gZGV0YWlscy5tZXNzYWdlX2lkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LnNlbmRNZXNzYWdlKHJvY2tldFVzZXIsIG1zZywgcm9ja2V0Q2hhbm5lbCwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHJlZ2lzdGVyRm9yUm9ja2V0RXZlbnRzKCkge1xuXHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJTYXZlTWVzc2FnZScsIHRoaXMub25Sb2NrZXRNZXNzYWdlLmJpbmQodGhpcyksIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ1NsYWNrQnJpZGdlX091dCcpO1xuXHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJEZWxldGVNZXNzYWdlJywgdGhpcy5vblJvY2tldE1lc3NhZ2VEZWxldGUuYmluZCh0aGlzKSwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTE9XLCAnU2xhY2tCcmlkZ2VfRGVsZXRlJyk7XG5cdFx0Um9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdzZXRSZWFjdGlvbicsIHRoaXMub25Sb2NrZXRTZXRSZWFjdGlvbi5iaW5kKHRoaXMpLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1csICdTbGFja0JyaWRnZV9TZXRSZWFjdGlvbicpO1xuXHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgndW5zZXRSZWFjdGlvbicsIHRoaXMub25Sb2NrZXRVblNldFJlYWN0aW9uLmJpbmQodGhpcyksIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ1NsYWNrQnJpZGdlX1VuU2V0UmVhY3Rpb24nKTtcblx0fVxuXG5cdHVucmVnaXN0ZXJGb3JSb2NrZXRFdmVudHMoKSB7XG5cdFx0Um9ja2V0Q2hhdC5jYWxsYmFja3MucmVtb3ZlKCdhZnRlclNhdmVNZXNzYWdlJywgJ1NsYWNrQnJpZGdlX091dCcpO1xuXHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJlbW92ZSgnYWZ0ZXJEZWxldGVNZXNzYWdlJywgJ1NsYWNrQnJpZGdlX0RlbGV0ZScpO1xuXHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJlbW92ZSgnc2V0UmVhY3Rpb24nLCAnU2xhY2tCcmlkZ2VfU2V0UmVhY3Rpb24nKTtcblx0XHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5yZW1vdmUoJ3Vuc2V0UmVhY3Rpb24nLCAnU2xhY2tCcmlkZ2VfVW5TZXRSZWFjdGlvbicpO1xuXHR9XG5cblx0cmVnaXN0ZXJGb3JTbGFja0V2ZW50cygpIHtcblx0XHRjb25zdCBDTElFTlRfRVZFTlRTID0gdGhpcy5zbGFja0NsaWVudC5DTElFTlRfRVZFTlRTO1xuXHRcdHRoaXMucnRtLm9uKENMSUVOVF9FVkVOVFMuUlRNLkFVVEhFTlRJQ0FURUQsICgpID0+IHtcblx0XHRcdGxvZ2dlci5jb25uZWN0aW9uLmluZm8oJ0Nvbm5lY3RlZCB0byBTbGFjaycpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5ydG0ub24oQ0xJRU5UX0VWRU5UUy5SVE0uVU5BQkxFX1RPX1JUTV9TVEFSVCwgKCkgPT4ge1xuXHRcdFx0dGhpcy5kaXNjb25uZWN0KCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJ0bS5vbihDTElFTlRfRVZFTlRTLlJUTS5ESVNDT05ORUNULCAoKSA9PiB7XG5cdFx0XHR0aGlzLmRpc2Nvbm5lY3QoKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IFJUTV9FVkVOVFMgPSB0aGlzLnNsYWNrQ2xpZW50LlJUTV9FVkVOVFM7XG5cblx0XHQvKipcblx0XHQqIEV2ZW50IGZpcmVkIHdoZW4gc29tZW9uZSBtZXNzYWdlcyBhIGNoYW5uZWwgdGhlIGJvdCBpcyBpblxuXHRcdCoge1xuXHRcdCpcdHR5cGU6ICdtZXNzYWdlJyxcblx0XHQqIFx0Y2hhbm5lbDogW2NoYW5uZWxfaWRdLFxuXHRcdCogXHR1c2VyOiBbdXNlcl9pZF0sXG5cdFx0KiBcdHRleHQ6IFttZXNzYWdlXSxcblx0XHQqIFx0dHM6IFt0cy5taWxsaV0sXG5cdFx0KiBcdHRlYW06IFt0ZWFtX2lkXSxcblx0XHQqIFx0c3VidHlwZTogW21lc3NhZ2Vfc3VidHlwZV0sXG5cdFx0KiBcdGludml0ZXI6IFttZXNzYWdlX3N1YnR5cGUgPSAnZ3JvdXBfam9pbnxjaGFubmVsX2pvaW4nIC0+IHVzZXJfaWRdXG5cdFx0KiB9XG5cdFx0KiovXG5cdFx0dGhpcy5ydG0ub24oUlRNX0VWRU5UUy5NRVNTQUdFLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChzbGFja01lc3NhZ2UpID0+IHtcblx0XHRcdGxvZ2dlci5ldmVudHMuZGVidWcoJ09uU2xhY2tFdmVudC1NRVNTQUdFOiAnLCBzbGFja01lc3NhZ2UpO1xuXHRcdFx0aWYgKHNsYWNrTWVzc2FnZSkge1xuXHRcdFx0XHR0aGlzLm9uU2xhY2tNZXNzYWdlKHNsYWNrTWVzc2FnZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5ydG0ub24oUlRNX0VWRU5UUy5SRUFDVElPTl9BRERFRCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgocmVhY3Rpb25Nc2cpID0+IHtcblx0XHRcdGxvZ2dlci5ldmVudHMuZGVidWcoJ09uU2xhY2tFdmVudC1SRUFDVElPTl9BRERFRDogJywgcmVhY3Rpb25Nc2cpO1xuXHRcdFx0aWYgKHJlYWN0aW9uTXNnKSB7XG5cdFx0XHRcdHRoaXMub25TbGFja1JlYWN0aW9uQWRkZWQocmVhY3Rpb25Nc2cpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMucnRtLm9uKFJUTV9FVkVOVFMuUkVBQ1RJT05fUkVNT1ZFRCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgocmVhY3Rpb25Nc2cpID0+IHtcblx0XHRcdGxvZ2dlci5ldmVudHMuZGVidWcoJ09uU2xhY2tFdmVudC1SRUFDVElPTl9SRU1PVkVEOiAnLCByZWFjdGlvbk1zZyk7XG5cdFx0XHRpZiAocmVhY3Rpb25Nc2cpIHtcblx0XHRcdFx0dGhpcy5vblNsYWNrUmVhY3Rpb25SZW1vdmVkKHJlYWN0aW9uTXNnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvKipcblx0XHQqIEV2ZW50IGZpcmVkIHdoZW4gc29tZW9uZSBjcmVhdGVzIGEgcHVibGljIGNoYW5uZWxcblx0XHQqIHtcblx0XHQqXHR0eXBlOiAnY2hhbm5lbF9jcmVhdGVkJyxcblx0XHQqXHRjaGFubmVsOiB7XG5cdFx0Klx0XHRpZDogW2NoYW5uZWxfaWRdLFxuXHRcdCpcdFx0aXNfY2hhbm5lbDogdHJ1ZSxcblx0XHQqXHRcdG5hbWU6IFtjaGFubmVsX25hbWVdLFxuXHRcdCpcdFx0Y3JlYXRlZDogW3RzXSxcblx0XHQqXHRcdGNyZWF0b3I6IFt1c2VyX2lkXSxcblx0XHQqXHRcdGlzX3NoYXJlZDogZmFsc2UsXG5cdFx0Klx0XHRpc19vcmdfc2hhcmVkOiBmYWxzZVxuXHRcdCpcdH0sXG5cdFx0Klx0ZXZlbnRfdHM6IFt0cy5taWxsaV1cblx0XHQqIH1cblx0XHQqKi9cblx0XHR0aGlzLnJ0bS5vbihSVE1fRVZFTlRTLkNIQU5ORUxfQ1JFQVRFRCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7fSkpO1xuXG5cdFx0LyoqXG5cdFx0KiBFdmVudCBmaXJlZCB3aGVuIHRoZSBib3Qgam9pbnMgYSBwdWJsaWMgY2hhbm5lbFxuXHRcdCoge1xuXHRcdCogXHR0eXBlOiAnY2hhbm5lbF9qb2luZWQnLFxuXHRcdCogXHRjaGFubmVsOiB7XG5cdFx0KiBcdFx0aWQ6IFtjaGFubmVsX2lkXSxcblx0XHQqIFx0XHRuYW1lOiBbY2hhbm5lbF9uYW1lXSxcblx0XHQqIFx0XHRpc19jaGFubmVsOiB0cnVlLFxuXHRcdCogXHRcdGNyZWF0ZWQ6IFt0c10sXG5cdFx0KiBcdFx0Y3JlYXRvcjogW3VzZXJfaWRdLFxuXHRcdCogXHRcdGlzX2FyY2hpdmVkOiBmYWxzZSxcblx0XHQqIFx0XHRpc19nZW5lcmFsOiBmYWxzZSxcblx0XHQqIFx0XHRpc19tZW1iZXI6IHRydWUsXG5cdFx0KiBcdFx0bGFzdF9yZWFkOiBbdHMubWlsbGldLFxuXHRcdCogXHRcdGxhdGVzdDogW21lc3NhZ2Vfb2JqXSxcblx0XHQqIFx0XHR1bnJlYWRfY291bnQ6IDAsXG5cdFx0KiBcdFx0dW5yZWFkX2NvdW50X2Rpc3BsYXk6IDAsXG5cdFx0KiBcdFx0bWVtYmVyczogWyB1c2VyX2lkcyBdLFxuXHRcdCogXHRcdHRvcGljOiB7XG5cdFx0KiBcdFx0XHR2YWx1ZTogW2NoYW5uZWxfdG9waWNdLFxuXHRcdCogXHRcdFx0Y3JlYXRvcjogW3VzZXJfaWRdLFxuXHRcdCogXHRcdFx0bGFzdF9zZXQ6IDBcblx0XHQqIFx0XHR9LFxuXHRcdCogXHRcdHB1cnBvc2U6IHtcblx0XHQqIFx0XHRcdHZhbHVlOiBbY2hhbm5lbF9wdXJwb3NlXSxcblx0XHQqIFx0XHRcdGNyZWF0b3I6IFt1c2VyX2lkXSxcblx0XHQqIFx0XHRcdGxhc3Rfc2V0OiAwXG5cdFx0KiBcdFx0fVxuXHRcdCogXHR9XG5cdFx0KiB9XG5cdFx0KiovXG5cdFx0dGhpcy5ydG0ub24oUlRNX0VWRU5UUy5DSEFOTkVMX0pPSU5FRCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7fSkpO1xuXG5cdFx0LyoqXG5cdFx0KiBFdmVudCBmaXJlZCB3aGVuIHRoZSBib3QgbGVhdmVzIChvciBpcyByZW1vdmVkIGZyb20pIGEgcHVibGljIGNoYW5uZWxcblx0XHQqIHtcblx0XHQqIFx0dHlwZTogJ2NoYW5uZWxfbGVmdCcsXG5cdFx0KiBcdGNoYW5uZWw6IFtjaGFubmVsX2lkXVxuXHRcdCogfVxuXHRcdCoqL1xuXHRcdHRoaXMucnRtLm9uKFJUTV9FVkVOVFMuQ0hBTk5FTF9MRUZULCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHt9KSk7XG5cblx0XHQvKipcblx0XHQqIEV2ZW50IGZpcmVkIHdoZW4gYW4gYXJjaGl2ZWQgY2hhbm5lbCBpcyBkZWxldGVkIGJ5IGFuIGFkbWluXG5cdFx0KiB7XG5cdFx0KiBcdHR5cGU6ICdjaGFubmVsX2RlbGV0ZWQnLFxuXHRcdCogXHRjaGFubmVsOiBbY2hhbm5lbF9pZF0sXG5cdFx0Klx0ZXZlbnRfdHM6IFt0cy5taWxsaV1cblx0XHQqIH1cblx0XHQqKi9cblx0XHR0aGlzLnJ0bS5vbihSVE1fRVZFTlRTLkNIQU5ORUxfREVMRVRFRCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7fSkpO1xuXG5cdFx0LyoqXG5cdFx0KiBFdmVudCBmaXJlZCB3aGVuIHRoZSBjaGFubmVsIGhhcyBpdHMgbmFtZSBjaGFuZ2VkXG5cdFx0KiB7XG5cdFx0KiBcdHR5cGU6ICdjaGFubmVsX3JlbmFtZScsXG5cdFx0KiBcdGNoYW5uZWw6IHtcblx0XHQqIFx0XHRpZDogW2NoYW5uZWxfaWRdLFxuXHRcdCogXHRcdG5hbWU6IFtjaGFubmVsX25hbWVdLFxuXHRcdCogXHRcdGlzX2NoYW5uZWw6IHRydWUsXG5cdFx0KiBcdFx0Y3JlYXRlZDogW3RzXVxuXHRcdCogXHR9LFxuXHRcdCpcdGV2ZW50X3RzOiBbdHMubWlsbGldXG5cdFx0KiB9XG5cdFx0KiovXG5cdFx0dGhpcy5ydG0ub24oUlRNX0VWRU5UUy5DSEFOTkVMX1JFTkFNRSwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7fSkpO1xuXG5cdFx0LyoqXG5cdFx0KiBFdmVudCBmaXJlZCB3aGVuIHRoZSBib3Qgam9pbnMgYSBwcml2YXRlIGNoYW5uZWxcblx0XHQqIHtcblx0XHQqIFx0dHlwZTogJ2dyb3VwX2pvaW5lZCcsXG5cdFx0KiBcdGNoYW5uZWw6IHtcblx0XHQqIFx0XHRpZDogW2NoYW5uZWxfaWRdLFxuXHRcdCogXHRcdG5hbWU6IFtjaGFubmVsX25hbWVdLFxuXHRcdCogXHRcdGlzX2dyb3VwOiB0cnVlLFxuXHRcdCogXHRcdGNyZWF0ZWQ6IFt0c10sXG5cdFx0KiBcdFx0Y3JlYXRvcjogW3VzZXJfaWRdLFxuXHRcdCogXHRcdGlzX2FyY2hpdmVkOiBmYWxzZSxcblx0XHQqIFx0XHRpc19tcGltOiBmYWxzZSxcblx0XHQqIFx0XHRpc19vcGVuOiB0cnVlLFxuXHRcdCogXHRcdGxhc3RfcmVhZDogW3RzLm1pbGxpXSxcblx0XHQqIFx0XHRsYXRlc3Q6IFttZXNzYWdlX29ial0sXG5cdFx0KiBcdFx0dW5yZWFkX2NvdW50OiAwLFxuXHRcdCogXHRcdHVucmVhZF9jb3VudF9kaXNwbGF5OiAwLFxuXHRcdCogXHRcdG1lbWJlcnM6IFsgdXNlcl9pZHMgXSxcblx0XHQqIFx0XHR0b3BpYzoge1xuXHRcdCogXHRcdFx0dmFsdWU6IFtjaGFubmVsX3RvcGljXSxcblx0XHQqIFx0XHRcdGNyZWF0b3I6IFt1c2VyX2lkXSxcblx0XHQqIFx0XHRcdGxhc3Rfc2V0OiAwXG5cdFx0KiBcdFx0fSxcblx0XHQqIFx0XHRwdXJwb3NlOiB7XG5cdFx0KiBcdFx0XHR2YWx1ZTogW2NoYW5uZWxfcHVycG9zZV0sXG5cdFx0KiBcdFx0XHRjcmVhdG9yOiBbdXNlcl9pZF0sXG5cdFx0KiBcdFx0XHRsYXN0X3NldDogMFxuXHRcdCogXHRcdH1cblx0XHQqIFx0fVxuXHRcdCogfVxuXHRcdCoqL1xuXHRcdHRoaXMucnRtLm9uKFJUTV9FVkVOVFMuR1JPVVBfSk9JTkVELCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHt9KSk7XG5cblx0XHQvKipcblx0XHQqIEV2ZW50IGZpcmVkIHdoZW4gdGhlIGJvdCBsZWF2ZXMgKG9yIGlzIHJlbW92ZWQgZnJvbSkgYSBwcml2YXRlIGNoYW5uZWxcblx0XHQqIHtcblx0XHQqIFx0dHlwZTogJ2dyb3VwX2xlZnQnLFxuXHRcdCogXHRjaGFubmVsOiBbY2hhbm5lbF9pZF1cblx0XHQqIH1cblx0XHQqKi9cblx0XHR0aGlzLnJ0bS5vbihSVE1fRVZFTlRTLkdST1VQX0xFRlQsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge30pKTtcblxuXHRcdC8qKlxuXHRcdCogRXZlbnQgZmlyZWQgd2hlbiB0aGUgcHJpdmF0ZSBjaGFubmVsIGhhcyBpdHMgbmFtZSBjaGFuZ2VkXG5cdFx0KiB7XG5cdFx0KiBcdHR5cGU6ICdncm91cF9yZW5hbWUnLFxuXHRcdCogXHRjaGFubmVsOiB7XG5cdFx0KiBcdFx0aWQ6IFtjaGFubmVsX2lkXSxcblx0XHQqIFx0XHRuYW1lOiBbY2hhbm5lbF9uYW1lXSxcblx0XHQqIFx0XHRpc19ncm91cDogdHJ1ZSxcblx0XHQqIFx0XHRjcmVhdGVkOiBbdHNdXG5cdFx0KiBcdH0sXG5cdFx0Klx0ZXZlbnRfdHM6IFt0cy5taWxsaV1cblx0XHQqIH1cblx0XHQqKi9cblx0XHR0aGlzLnJ0bS5vbihSVE1fRVZFTlRTLkdST1VQX1JFTkFNRSwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7fSkpO1xuXG5cdFx0LyoqXG5cdFx0KiBFdmVudCBmaXJlZCB3aGVuIGEgbmV3IHVzZXIgam9pbnMgdGhlIHRlYW1cblx0XHQqIHtcblx0XHQqIFx0dHlwZTogJ3RlYW1fam9pbicsXG5cdFx0KiBcdHVzZXI6XG5cdFx0KiBcdHtcblx0XHQqIFx0XHRpZDogW3VzZXJfaWRdLFxuXHRcdCogXHRcdHRlYW1faWQ6IFt0ZWFtX2lkXSxcblx0XHQqIFx0XHRuYW1lOiBbdXNlcl9uYW1lXSxcblx0XHQqIFx0XHRkZWxldGVkOiBmYWxzZSxcblx0XHQqIFx0XHRzdGF0dXM6IG51bGwsXG5cdFx0KiBcdFx0Y29sb3I6IFtjb2xvcl9jb2RlXSxcblx0XHQqIFx0XHRyZWFsX25hbWU6ICcnLFxuXHRcdCogXHRcdHR6OiBbdGltZXpvbmVdLFxuXHRcdCogXHRcdHR6X2xhYmVsOiBbdGltZXpvbmVfbGFiZWxdLFxuXHRcdCogXHRcdHR6X29mZnNldDogW3RpbWV6b25lX29mZnNldF0sXG5cdFx0KiBcdFx0cHJvZmlsZTpcblx0XHQqIFx0XHR7XG5cdFx0KiBcdFx0XHRhdmF0YXJfaGFzaDogJycsXG5cdFx0KiBcdFx0XHRyZWFsX25hbWU6ICcnLFxuXHRcdCogXHRcdFx0cmVhbF9uYW1lX25vcm1hbGl6ZWQ6ICcnLFxuXHRcdCogXHRcdFx0ZW1haWw6ICcnLFxuXHRcdCogXHRcdFx0aW1hZ2VfMjQ6ICcnLFxuXHRcdCogXHRcdFx0aW1hZ2VfMzI6ICcnLFxuXHRcdCogXHRcdFx0aW1hZ2VfNDg6ICcnLFxuXHRcdCogXHRcdFx0aW1hZ2VfNzI6ICcnLFxuXHRcdCogXHRcdFx0aW1hZ2VfMTkyOiAnJyxcblx0XHQqIFx0XHRcdGltYWdlXzUxMjogJycsXG5cdFx0KiBcdFx0XHRmaWVsZHM6IG51bGxcblx0XHQqIFx0XHR9LFxuXHRcdCogXHRcdGlzX2FkbWluOiBmYWxzZSxcblx0XHQqIFx0XHRpc19vd25lcjogZmFsc2UsXG5cdFx0KiBcdFx0aXNfcHJpbWFyeV9vd25lcjogZmFsc2UsXG5cdFx0KiBcdFx0aXNfcmVzdHJpY3RlZDogZmFsc2UsXG5cdFx0KiBcdFx0aXNfdWx0cmFfcmVzdHJpY3RlZDogZmFsc2UsXG5cdFx0KiBcdFx0aXNfYm90OiBmYWxzZSxcblx0XHQqIFx0XHRwcmVzZW5jZTogW3VzZXJfcHJlc2VuY2VdXG5cdFx0KiBcdH0sXG5cdFx0KiBcdGNhY2hlX3RzOiBbdHNdXG5cdFx0KiB9XG5cdFx0KiovXG5cdFx0dGhpcy5ydG0ub24oUlRNX0VWRU5UUy5URUFNX0pPSU4sIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge30pKTtcblx0fVxuXG5cdGZpbmRTbGFja0NoYW5uZWwocm9ja2V0Q2hhbm5lbE5hbWUpIHtcblx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ1NlYXJjaGluZyBmb3IgU2xhY2sgY2hhbm5lbCBvciBncm91cCcsIHJvY2tldENoYW5uZWxOYW1lKTtcblx0XHRsZXQgcmVzcG9uc2UgPSBIVFRQLmdldCgnaHR0cHM6Ly9zbGFjay5jb20vYXBpL2NoYW5uZWxzLmxpc3QnLCB7IHBhcmFtczogeyB0b2tlbjogdGhpcy5hcGlUb2tlbiB9IH0pO1xuXHRcdGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIF8uaXNBcnJheShyZXNwb25zZS5kYXRhLmNoYW5uZWxzKSAmJiByZXNwb25zZS5kYXRhLmNoYW5uZWxzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgY2hhbm5lbCBvZiByZXNwb25zZS5kYXRhLmNoYW5uZWxzKSB7XG5cdFx0XHRcdGlmIChjaGFubmVsLm5hbWUgPT09IHJvY2tldENoYW5uZWxOYW1lICYmIGNoYW5uZWwuaXNfbWVtYmVyID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNoYW5uZWw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmVzcG9uc2UgPSBIVFRQLmdldCgnaHR0cHM6Ly9zbGFjay5jb20vYXBpL2dyb3Vwcy5saXN0JywgeyBwYXJhbXM6IHsgdG9rZW46IHRoaXMuYXBpVG9rZW4gfSB9KTtcblx0XHRpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiBfLmlzQXJyYXkocmVzcG9uc2UuZGF0YS5ncm91cHMpICYmIHJlc3BvbnNlLmRhdGEuZ3JvdXBzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgcmVzcG9uc2UuZGF0YS5ncm91cHMpIHtcblx0XHRcdFx0aWYgKGdyb3VwLm5hbWUgPT09IHJvY2tldENoYW5uZWxOYW1lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGdyb3VwO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aW1wb3J0RnJvbUhpc3RvcnkoZmFtaWx5LCBvcHRpb25zKSB7XG5cdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdJbXBvcnRpbmcgbWVzc2FnZXMgaGlzdG9yeScpO1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gSFRUUC5nZXQoYGh0dHBzOi8vc2xhY2suY29tL2FwaS8keyBmYW1pbHkgfS5oaXN0b3J5YCwgeyBwYXJhbXM6IF8uZXh0ZW5kKHsgdG9rZW46IHRoaXMuYXBpVG9rZW4gfSwgb3B0aW9ucykgfSk7XG5cdFx0aWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgXy5pc0FycmF5KHJlc3BvbnNlLmRhdGEubWVzc2FnZXMpICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0bGV0IGxhdGVzdCA9IDA7XG5cdFx0XHRmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgcmVzcG9uc2UuZGF0YS5tZXNzYWdlcy5yZXZlcnNlKCkpIHtcblx0XHRcdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdNRVNTQUdFOiAnLCBtZXNzYWdlKTtcblx0XHRcdFx0aWYgKCFsYXRlc3QgfHwgbWVzc2FnZS50cyA+IGxhdGVzdCkge1xuXHRcdFx0XHRcdGxhdGVzdCA9IG1lc3NhZ2UudHM7XG5cdFx0XHRcdH1cblx0XHRcdFx0bWVzc2FnZS5jaGFubmVsID0gb3B0aW9ucy5jaGFubmVsO1xuXHRcdFx0XHR0aGlzLm9uU2xhY2tNZXNzYWdlKG1lc3NhZ2UsIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgaGFzX21vcmU6IHJlc3BvbnNlLmRhdGEuaGFzX21vcmUsIHRzOiBsYXRlc3QgfTtcblx0XHR9XG5cdH1cblxuXHRjb3B5U2xhY2tDaGFubmVsSW5mbyhyaWQsIGNoYW5uZWxNYXApIHtcblx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ0NvcHlpbmcgdXNlcnMgZnJvbSBTbGFjayBjaGFubmVsIHRvIFJvY2tldC5DaGF0JywgY2hhbm5lbE1hcC5pZCwgcmlkKTtcblx0XHRjb25zdCByZXNwb25zZSA9IEhUVFAuZ2V0KGBodHRwczovL3NsYWNrLmNvbS9hcGkvJHsgY2hhbm5lbE1hcC5mYW1pbHkgfS5pbmZvYCwgeyBwYXJhbXM6IHsgdG9rZW46IHRoaXMuYXBpVG9rZW4sIGNoYW5uZWw6IGNoYW5uZWxNYXAuaWQgfSB9KTtcblx0XHRpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGNoYW5uZWxNYXAuZmFtaWx5ID09PSAnY2hhbm5lbHMnID8gcmVzcG9uc2UuZGF0YS5jaGFubmVsIDogcmVzcG9uc2UuZGF0YS5ncm91cDtcblx0XHRcdGlmIChkYXRhICYmIF8uaXNBcnJheShkYXRhLm1lbWJlcnMpICYmIGRhdGEubWVtYmVycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbWVtYmVyIG9mIGRhdGEubWVtYmVycykge1xuXHRcdFx0XHRcdGNvbnN0IHVzZXIgPSB0aGlzLmZpbmRSb2NrZXRVc2VyKG1lbWJlcikgfHwgdGhpcy5hZGRSb2NrZXRVc2VyKG1lbWJlcik7XG5cdFx0XHRcdFx0aWYgKHVzZXIpIHtcblx0XHRcdFx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnQWRkaW5nIHVzZXIgdG8gcm9vbScsIHVzZXIudXNlcm5hbWUsIHJpZCk7XG5cdFx0XHRcdFx0XHRSb2NrZXRDaGF0LmFkZFVzZXJUb1Jvb20ocmlkLCB1c2VyLCBudWxsLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bGV0IHRvcGljID0gJyc7XG5cdFx0XHRsZXQgdG9waWNfbGFzdF9zZXQgPSAwO1xuXHRcdFx0bGV0IHRvcGljX2NyZWF0b3IgPSBudWxsO1xuXHRcdFx0aWYgKGRhdGEgJiYgZGF0YS50b3BpYyAmJiBkYXRhLnRvcGljLnZhbHVlKSB7XG5cdFx0XHRcdHRvcGljID0gZGF0YS50b3BpYy52YWx1ZTtcblx0XHRcdFx0dG9waWNfbGFzdF9zZXQgPSBkYXRhLnRvcGljLmxhc3Rfc2V0O1xuXHRcdFx0XHR0b3BpY19jcmVhdG9yID0gZGF0YS50b3BpYy5jcmVhdG9yO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZGF0YSAmJiBkYXRhLnB1cnBvc2UgJiYgZGF0YS5wdXJwb3NlLnZhbHVlKSB7XG5cdFx0XHRcdGlmICh0b3BpY19sYXN0X3NldCkge1xuXHRcdFx0XHRcdGlmICh0b3BpY19sYXN0X3NldCA8IGRhdGEucHVycG9zZS5sYXN0X3NldCkge1xuXHRcdFx0XHRcdFx0dG9waWMgPSBkYXRhLnB1cnBvc2UudG9waWM7XG5cdFx0XHRcdFx0XHR0b3BpY19jcmVhdG9yID0gZGF0YS5wdXJwb3NlLmNyZWF0b3I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRvcGljID0gZGF0YS5wdXJwb3NlLnRvcGljO1xuXHRcdFx0XHRcdHRvcGljX2NyZWF0b3IgPSBkYXRhLnB1cnBvc2UuY3JlYXRvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodG9waWMpIHtcblx0XHRcdFx0Y29uc3QgY3JlYXRvciA9IHRoaXMuZmluZFJvY2tldFVzZXIodG9waWNfY3JlYXRvcikgfHwgdGhpcy5hZGRSb2NrZXRVc2VyKHRvcGljX2NyZWF0b3IpO1xuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ1NldHRpbmcgcm9vbSB0b3BpYycsIHJpZCwgdG9waWMsIGNyZWF0b3IudXNlcm5hbWUpO1xuXHRcdFx0XHRSb2NrZXRDaGF0LnNhdmVSb29tVG9waWMocmlkLCB0b3BpYywgY3JlYXRvciwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGNvcHlQaW5zKHJpZCwgY2hhbm5lbE1hcCkge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gSFRUUC5nZXQoJ2h0dHBzOi8vc2xhY2suY29tL2FwaS9waW5zLmxpc3QnLCB7IHBhcmFtczogeyB0b2tlbjogdGhpcy5hcGlUb2tlbiwgY2hhbm5lbDogY2hhbm5lbE1hcC5pZCB9IH0pO1xuXHRcdGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIF8uaXNBcnJheShyZXNwb25zZS5kYXRhLml0ZW1zKSAmJiByZXNwb25zZS5kYXRhLml0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgcGluIG9mIHJlc3BvbnNlLmRhdGEuaXRlbXMpIHtcblx0XHRcdFx0aWYgKHBpbi5tZXNzYWdlKSB7XG5cdFx0XHRcdFx0Y29uc3QgdXNlciA9IHRoaXMuZmluZFJvY2tldFVzZXIocGluLm1lc3NhZ2UudXNlcik7XG5cdFx0XHRcdFx0Y29uc3QgbXNnT2JqID0ge1xuXHRcdFx0XHRcdFx0cmlkLFxuXHRcdFx0XHRcdFx0dDogJ21lc3NhZ2VfcGlubmVkJyxcblx0XHRcdFx0XHRcdG1zZzogJycsXG5cdFx0XHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0XHRcdF9pZDogdXNlci5faWQsXG5cdFx0XHRcdFx0XHRcdHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0YXR0YWNobWVudHM6IFt7XG5cdFx0XHRcdFx0XHRcdCd0ZXh0JyA6IHRoaXMuY29udmVydFNsYWNrTXNnVHh0VG9Sb2NrZXRUeHRGb3JtYXQocGluLm1lc3NhZ2UudGV4dCksXG5cdFx0XHRcdFx0XHRcdCdhdXRob3JfbmFtZScgOiB1c2VyLnVzZXJuYW1lLFxuXHRcdFx0XHRcdFx0XHQnYXV0aG9yX2ljb24nIDogZ2V0QXZhdGFyVXJsRnJvbVVzZXJuYW1lKHVzZXIudXNlcm5hbWUpLFxuXHRcdFx0XHRcdFx0XHQndHMnIDogbmV3IERhdGUocGFyc2VJbnQocGluLm1lc3NhZ2UudHMuc3BsaXQoJy4nKVswXSkgKiAxMDAwKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuc2V0UGlubmVkQnlJZEFuZFVzZXJJZChgc2xhY2stJHsgcGluLmNoYW5uZWwgfS0keyBwaW4ubWVzc2FnZS50cy5yZXBsYWNlKC9cXC4vZywgJy0nKSB9YCwgbXNnT2JqLnUsIHRydWUsIG5ldyBEYXRlKHBhcnNlSW50KHBpbi5tZXNzYWdlLnRzLnNwbGl0KCcuJylbMF0pICogMTAwMCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aW1wb3J0TWVzc2FnZXMocmlkLCBjYWxsYmFjaykge1xuXHRcdGxvZ2dlci5jbGFzcy5pbmZvKCdpbXBvcnRNZXNzYWdlczogJywgcmlkKTtcblx0XHRjb25zdCByb2NrZXRjaGF0X3Jvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChyaWQpO1xuXHRcdGlmIChyb2NrZXRjaGF0X3Jvb20pIHtcblx0XHRcdGlmICh0aGlzLnNsYWNrQ2hhbm5lbE1hcFtyaWRdKSB7XG5cdFx0XHRcdHRoaXMuY29weVNsYWNrQ2hhbm5lbEluZm8ocmlkLCB0aGlzLnNsYWNrQ2hhbm5lbE1hcFtyaWRdKTtcblxuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ0ltcG9ydGluZyBtZXNzYWdlcyBmcm9tIFNsYWNrIHRvIFJvY2tldC5DaGF0JywgdGhpcy5zbGFja0NoYW5uZWxNYXBbcmlkXSwgcmlkKTtcblx0XHRcdFx0bGV0IHJlc3VsdHMgPSB0aGlzLmltcG9ydEZyb21IaXN0b3J5KHRoaXMuc2xhY2tDaGFubmVsTWFwW3JpZF0uZmFtaWx5LCB7IGNoYW5uZWw6IHRoaXMuc2xhY2tDaGFubmVsTWFwW3JpZF0uaWQsIG9sZGVzdDogMSB9KTtcblx0XHRcdFx0d2hpbGUgKHJlc3VsdHMgJiYgcmVzdWx0cy5oYXNfbW9yZSkge1xuXHRcdFx0XHRcdHJlc3VsdHMgPSB0aGlzLmltcG9ydEZyb21IaXN0b3J5KHRoaXMuc2xhY2tDaGFubmVsTWFwW3JpZF0uZmFtaWx5LCB7IGNoYW5uZWw6IHRoaXMuc2xhY2tDaGFubmVsTWFwW3JpZF0uaWQsIG9sZGVzdDogcmVzdWx0cy50cyB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnUGlubmluZyBTbGFjayBjaGFubmVsIG1lc3NhZ2VzIHRvIFJvY2tldC5DaGF0JywgdGhpcy5zbGFja0NoYW5uZWxNYXBbcmlkXSwgcmlkKTtcblx0XHRcdFx0dGhpcy5jb3B5UGlucyhyaWQsIHRoaXMuc2xhY2tDaGFubmVsTWFwW3JpZF0pO1xuXG5cdFx0XHRcdHJldHVybiBjYWxsYmFjaygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc2xhY2tfcm9vbSA9IHRoaXMuZmluZFNsYWNrQ2hhbm5lbChyb2NrZXRjaGF0X3Jvb20ubmFtZSk7XG5cdFx0XHRcdGlmIChzbGFja19yb29tKSB7XG5cdFx0XHRcdFx0dGhpcy5zbGFja0NoYW5uZWxNYXBbcmlkXSA9IHsgaWQ6IHNsYWNrX3Jvb20uaWQsIGZhbWlseTogc2xhY2tfcm9vbS5pZC5jaGFyQXQoMCkgPT09ICdDJyA/ICdjaGFubmVscycgOiAnZ3JvdXBzJyB9O1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmltcG9ydE1lc3NhZ2VzKHJpZCwgY2FsbGJhY2spO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxvZ2dlci5jbGFzcy5lcnJvcignQ291bGQgbm90IGZpbmQgU2xhY2sgcm9vbSB3aXRoIHNwZWNpZmllZCBuYW1lJywgcm9ja2V0Y2hhdF9yb29tLm5hbWUpO1xuXHRcdFx0XHRcdHJldHVybiBjYWxsYmFjayhuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1zbGFjay1yb29tLW5vdC1mb3VuZCcsICdDb3VsZCBub3QgZmluZCBTbGFjayByb29tIHdpdGggc3BlY2lmaWVkIG5hbWUnKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0bG9nZ2VyLmNsYXNzLmVycm9yKCdDb3VsZCBub3QgZmluZCBSb2NrZXQuQ2hhdCByb29tIHdpdGggc3BlY2lmaWVkIGlkJywgcmlkKTtcblx0XHRcdHJldHVybiBjYWxsYmFjayhuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJykpO1xuXHRcdH1cblx0fVxuXG5cdHBvcHVsYXRlU2xhY2tDaGFubmVsTWFwKCkge1xuXHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnUG9wdWxhdGluZyBjaGFubmVsIG1hcCcpO1xuXHRcdGxldCByZXNwb25zZSA9IEhUVFAuZ2V0KCdodHRwczovL3NsYWNrLmNvbS9hcGkvY2hhbm5lbHMubGlzdCcsIHsgcGFyYW1zOiB7IHRva2VuOiB0aGlzLmFwaVRva2VuIH0gfSk7XG5cdFx0aWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgXy5pc0FycmF5KHJlc3BvbnNlLmRhdGEuY2hhbm5lbHMpICYmIHJlc3BvbnNlLmRhdGEuY2hhbm5lbHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yIChjb25zdCBzbGFja0NoYW5uZWwgb2YgcmVzcG9uc2UuZGF0YS5jaGFubmVscykge1xuXHRcdFx0XHRjb25zdCByb2NrZXRjaGF0X3Jvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKHNsYWNrQ2hhbm5lbC5uYW1lLCB7IGZpZWxkczogeyBfaWQ6IDEgfSB9KTtcblx0XHRcdFx0aWYgKHJvY2tldGNoYXRfcm9vbSkge1xuXHRcdFx0XHRcdHRoaXMuc2xhY2tDaGFubmVsTWFwW3JvY2tldGNoYXRfcm9vbS5faWRdID0geyBpZDogc2xhY2tDaGFubmVsLmlkLCBmYW1pbHk6IHNsYWNrQ2hhbm5lbC5pZC5jaGFyQXQoMCkgPT09ICdDJyA/ICdjaGFubmVscycgOiAnZ3JvdXBzJyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJlc3BvbnNlID0gSFRUUC5nZXQoJ2h0dHBzOi8vc2xhY2suY29tL2FwaS9ncm91cHMubGlzdCcsIHsgcGFyYW1zOiB7IHRva2VuOiB0aGlzLmFwaVRva2VuIH0gfSk7XG5cdFx0aWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgXy5pc0FycmF5KHJlc3BvbnNlLmRhdGEuZ3JvdXBzKSAmJiByZXNwb25zZS5kYXRhLmdyb3Vwcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHNsYWNrR3JvdXAgb2YgcmVzcG9uc2UuZGF0YS5ncm91cHMpIHtcblx0XHRcdFx0Y29uc3Qgcm9ja2V0Y2hhdF9yb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5TmFtZShzbGFja0dyb3VwLm5hbWUsIHsgZmllbGRzOiB7IF9pZDogMSB9IH0pO1xuXHRcdFx0XHRpZiAocm9ja2V0Y2hhdF9yb29tKSB7XG5cdFx0XHRcdFx0dGhpcy5zbGFja0NoYW5uZWxNYXBbcm9ja2V0Y2hhdF9yb29tLl9pZF0gPSB7IGlkOiBzbGFja0dyb3VwLmlkLCBmYW1pbHk6IHNsYWNrR3JvdXAuaWQuY2hhckF0KDApID09PSAnQycgPyAnY2hhbm5lbHMnIDogJ2dyb3VwcycgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG9uUm9ja2V0TWVzc2FnZURlbGV0ZShyb2NrZXRNZXNzYWdlRGVsZXRlZCkge1xuXHRcdGxvZ2dlci5jbGFzcy5kZWJ1Zygnb25Sb2NrZXRNZXNzYWdlRGVsZXRlJywgcm9ja2V0TWVzc2FnZURlbGV0ZWQpO1xuXG5cdFx0dGhpcy5wb3N0RGVsZXRlTWVzc2FnZVRvU2xhY2socm9ja2V0TWVzc2FnZURlbGV0ZWQpO1xuXHR9XG5cblx0b25Sb2NrZXRTZXRSZWFjdGlvbihyb2NrZXRNc2dJRCwgcmVhY3Rpb24pIHtcblx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ29uUm9ja2V0U2V0UmVhY3Rpb24nKTtcblxuXHRcdGlmIChyb2NrZXRNc2dJRCAmJiByZWFjdGlvbikge1xuXHRcdFx0aWYgKHRoaXMucmVhY3Rpb25zTWFwLmRlbGV0ZShgc2V0JHsgcm9ja2V0TXNnSUQgfSR7IHJlYWN0aW9uIH1gKSkge1xuXHRcdFx0XHQvL1RoaXMgd2FzIGEgU2xhY2sgcmVhY3Rpb24sIHdlIGRvbid0IG5lZWQgdG8gdGVsbCBTbGFjayBhYm91dCBpdFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByb2NrZXRNc2cgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlJZChyb2NrZXRNc2dJRCk7XG5cdFx0XHRpZiAocm9ja2V0TXNnKSB7XG5cdFx0XHRcdGNvbnN0IHNsYWNrQ2hhbm5lbCA9IHRoaXMuc2xhY2tDaGFubmVsTWFwW3JvY2tldE1zZy5yaWRdLmlkO1xuXHRcdFx0XHRjb25zdCBzbGFja1RTID0gdGhpcy5nZXRTbGFja1RTKHJvY2tldE1zZyk7XG5cdFx0XHRcdHRoaXMucG9zdFJlYWN0aW9uQWRkZWRUb1NsYWNrKHJlYWN0aW9uLnJlcGxhY2UoLzovZywgJycpLCBzbGFja0NoYW5uZWwsIHNsYWNrVFMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG9uUm9ja2V0VW5TZXRSZWFjdGlvbihyb2NrZXRNc2dJRCwgcmVhY3Rpb24pIHtcblx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ29uUm9ja2V0VW5TZXRSZWFjdGlvbicpO1xuXG5cdFx0aWYgKHJvY2tldE1zZ0lEICYmIHJlYWN0aW9uKSB7XG5cdFx0XHRpZiAodGhpcy5yZWFjdGlvbnNNYXAuZGVsZXRlKGB1bnNldCR7IHJvY2tldE1zZ0lEIH0keyByZWFjdGlvbiB9YCkpIHtcblx0XHRcdFx0Ly9UaGlzIHdhcyBhIFNsYWNrIHVuc2V0IHJlYWN0aW9uLCB3ZSBkb24ndCBuZWVkIHRvIHRlbGwgU2xhY2sgYWJvdXQgaXRcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByb2NrZXRNc2cgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlJZChyb2NrZXRNc2dJRCk7XG5cdFx0XHRpZiAocm9ja2V0TXNnKSB7XG5cdFx0XHRcdGNvbnN0IHNsYWNrQ2hhbm5lbCA9IHRoaXMuc2xhY2tDaGFubmVsTWFwW3JvY2tldE1zZy5yaWRdLmlkO1xuXHRcdFx0XHRjb25zdCBzbGFja1RTID0gdGhpcy5nZXRTbGFja1RTKHJvY2tldE1zZyk7XG5cdFx0XHRcdHRoaXMucG9zdFJlYWN0aW9uUmVtb3ZlVG9TbGFjayhyZWFjdGlvbi5yZXBsYWNlKC86L2csICcnKSwgc2xhY2tDaGFubmVsLCBzbGFja1RTKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvblJvY2tldE1lc3NhZ2Uocm9ja2V0TWVzc2FnZSkge1xuXHRcdGxvZ2dlci5jbGFzcy5kZWJ1Zygnb25Sb2NrZXRNZXNzYWdlJywgcm9ja2V0TWVzc2FnZSk7XG5cblx0XHRpZiAocm9ja2V0TWVzc2FnZS5lZGl0ZWRBdCkge1xuXHRcdFx0Ly9UaGlzIGlzIGFuIEVkaXQgRXZlbnRcblx0XHRcdHRoaXMucHJvY2Vzc1JvY2tldE1lc3NhZ2VDaGFuZ2VkKHJvY2tldE1lc3NhZ2UpO1xuXHRcdFx0cmV0dXJuIHJvY2tldE1lc3NhZ2U7XG5cdFx0fVxuXHRcdC8vIElnbm9yZSBtZXNzYWdlcyBvcmlnaW5hdGluZyBmcm9tIFNsYWNrXG5cdFx0aWYgKHJvY2tldE1lc3NhZ2UuX2lkLmluZGV4T2YoJ3NsYWNrLScpID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gcm9ja2V0TWVzc2FnZTtcblx0XHR9XG5cblx0XHQvL1Byb2JhYmx5IGEgbmV3IG1lc3NhZ2UgZnJvbSBSb2NrZXQuQ2hhdFxuXHRcdGNvbnN0IG91dFNsYWNrQ2hhbm5lbHMgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnU2xhY2tCcmlkZ2VfT3V0X0FsbCcpID8gXy5rZXlzKHRoaXMuc2xhY2tDaGFubmVsTWFwKSA6IF8ucGx1Y2soUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NsYWNrQnJpZGdlX091dF9DaGFubmVscycpLCAnX2lkJykgfHwgW107XG5cdFx0Ly9sb2dnZXIuY2xhc3MuZGVidWcoJ091dCBTbGFja0NoYW5uZWxzOiAnLCBvdXRTbGFja0NoYW5uZWxzKTtcblx0XHRpZiAob3V0U2xhY2tDaGFubmVscy5pbmRleE9mKHJvY2tldE1lc3NhZ2UucmlkKSAhPT0gLTEpIHtcblx0XHRcdHRoaXMucG9zdE1lc3NhZ2VUb1NsYWNrKHRoaXMuc2xhY2tDaGFubmVsTWFwW3JvY2tldE1lc3NhZ2UucmlkXSwgcm9ja2V0TWVzc2FnZSk7XG5cdFx0fVxuXHRcdHJldHVybiByb2NrZXRNZXNzYWdlO1xuXHR9XG5cblx0Lypcblx0IGh0dHBzOi8vYXBpLnNsYWNrLmNvbS9tZXRob2RzL3JlYWN0aW9ucy5hZGRcblx0ICovXG5cdHBvc3RSZWFjdGlvbkFkZGVkVG9TbGFjayhyZWFjdGlvbiwgc2xhY2tDaGFubmVsLCBzbGFja1RTKSB7XG5cdFx0aWYgKHJlYWN0aW9uICYmIHNsYWNrQ2hhbm5lbCAmJiBzbGFja1RTKSB7XG5cdFx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0XHR0b2tlbjogdGhpcy5hcGlUb2tlbixcblx0XHRcdFx0bmFtZTogcmVhY3Rpb24sXG5cdFx0XHRcdGNoYW5uZWw6IHNsYWNrQ2hhbm5lbCxcblx0XHRcdFx0dGltZXN0YW1wOiBzbGFja1RTXG5cdFx0XHR9O1xuXG5cdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ1Bvc3RpbmcgQWRkIFJlYWN0aW9uIHRvIFNsYWNrJyk7XG5cdFx0XHRjb25zdCBwb3N0UmVzdWx0ID0gSFRUUC5wb3N0KCdodHRwczovL3NsYWNrLmNvbS9hcGkvcmVhY3Rpb25zLmFkZCcsIHsgcGFyYW1zOiBkYXRhIH0pO1xuXHRcdFx0aWYgKHBvc3RSZXN1bHQuc3RhdHVzQ29kZSA9PT0gMjAwICYmIHBvc3RSZXN1bHQuZGF0YSAmJiBwb3N0UmVzdWx0LmRhdGEub2sgPT09IHRydWUpIHtcblx0XHRcdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdSZWFjdGlvbiBhZGRlZCB0byBTbGFjaycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdCBodHRwczovL2FwaS5zbGFjay5jb20vbWV0aG9kcy9yZWFjdGlvbnMucmVtb3ZlXG5cdCAqL1xuXHRwb3N0UmVhY3Rpb25SZW1vdmVUb1NsYWNrKHJlYWN0aW9uLCBzbGFja0NoYW5uZWwsIHNsYWNrVFMpIHtcblx0XHRpZiAocmVhY3Rpb24gJiYgc2xhY2tDaGFubmVsICYmIHNsYWNrVFMpIHtcblx0XHRcdGNvbnN0IGRhdGEgPSB7XG5cdFx0XHRcdHRva2VuOiB0aGlzLmFwaVRva2VuLFxuXHRcdFx0XHRuYW1lOiByZWFjdGlvbixcblx0XHRcdFx0Y2hhbm5lbDogc2xhY2tDaGFubmVsLFxuXHRcdFx0XHR0aW1lc3RhbXA6IHNsYWNrVFNcblx0XHRcdH07XG5cblx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnUG9zdGluZyBSZW1vdmUgUmVhY3Rpb24gdG8gU2xhY2snKTtcblx0XHRcdGNvbnN0IHBvc3RSZXN1bHQgPSBIVFRQLnBvc3QoJ2h0dHBzOi8vc2xhY2suY29tL2FwaS9yZWFjdGlvbnMucmVtb3ZlJywgeyBwYXJhbXM6IGRhdGEgfSk7XG5cdFx0XHRpZiAocG9zdFJlc3VsdC5zdGF0dXNDb2RlID09PSAyMDAgJiYgcG9zdFJlc3VsdC5kYXRhICYmIHBvc3RSZXN1bHQuZGF0YS5vayA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ1JlYWN0aW9uIHJlbW92ZWQgZnJvbSBTbGFjaycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHBvc3REZWxldGVNZXNzYWdlVG9TbGFjayhyb2NrZXRNZXNzYWdlKSB7XG5cdFx0aWYgKHJvY2tldE1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IGRhdGEgPSB7XG5cdFx0XHRcdHRva2VuOiB0aGlzLmFwaVRva2VuLFxuXHRcdFx0XHR0czogdGhpcy5nZXRTbGFja1RTKHJvY2tldE1lc3NhZ2UpLFxuXHRcdFx0XHRjaGFubmVsOiB0aGlzLnNsYWNrQ2hhbm5lbE1hcFtyb2NrZXRNZXNzYWdlLnJpZF0uaWQsXG5cdFx0XHRcdGFzX3VzZXI6IHRydWVcblx0XHRcdH07XG5cblx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnUG9zdCBEZWxldGUgTWVzc2FnZSB0byBTbGFjaycsIGRhdGEpO1xuXHRcdFx0Y29uc3QgcG9zdFJlc3VsdCA9IEhUVFAucG9zdCgnaHR0cHM6Ly9zbGFjay5jb20vYXBpL2NoYXQuZGVsZXRlJywgeyBwYXJhbXM6IGRhdGEgfSk7XG5cdFx0XHRpZiAocG9zdFJlc3VsdC5zdGF0dXNDb2RlID09PSAyMDAgJiYgcG9zdFJlc3VsdC5kYXRhICYmIHBvc3RSZXN1bHQuZGF0YS5vayA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRsb2dnZXIuY2xhc3MuZGVidWcoJ01lc3NhZ2UgZGVsZXRlZCBvbiBTbGFjaycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHBvc3RNZXNzYWdlVG9TbGFjayhzbGFja0NoYW5uZWwsIHJvY2tldE1lc3NhZ2UpIHtcblx0XHRpZiAoc2xhY2tDaGFubmVsICYmIHNsYWNrQ2hhbm5lbC5pZCkge1xuXHRcdFx0bGV0IGljb25VcmwgPSBnZXRBdmF0YXJVcmxGcm9tVXNlcm5hbWUocm9ja2V0TWVzc2FnZS51ICYmIHJvY2tldE1lc3NhZ2UudS51c2VybmFtZSk7XG5cdFx0XHRpZiAoaWNvblVybCkge1xuXHRcdFx0XHRpY29uVXJsID0gTWV0ZW9yLmFic29sdXRlVXJsKCkucmVwbGFjZSgvXFwvJC8sICcnKSArIGljb25Vcmw7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0XHR0b2tlbjogdGhpcy5hcGlUb2tlbixcblx0XHRcdFx0dGV4dDogcm9ja2V0TWVzc2FnZS5tc2csXG5cdFx0XHRcdGNoYW5uZWw6IHNsYWNrQ2hhbm5lbC5pZCxcblx0XHRcdFx0dXNlcm5hbWU6IHJvY2tldE1lc3NhZ2UudSAmJiByb2NrZXRNZXNzYWdlLnUudXNlcm5hbWUsXG5cdFx0XHRcdGljb25fdXJsOiBpY29uVXJsLFxuXHRcdFx0XHRsaW5rX25hbWVzOiAxXG5cdFx0XHR9O1xuXHRcdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdQb3N0IE1lc3NhZ2UgVG8gU2xhY2snLCBkYXRhKTtcblx0XHRcdGNvbnN0IHBvc3RSZXN1bHQgPSBIVFRQLnBvc3QoJ2h0dHBzOi8vc2xhY2suY29tL2FwaS9jaGF0LnBvc3RNZXNzYWdlJywgeyBwYXJhbXM6IGRhdGEgfSk7XG5cdFx0XHRpZiAocG9zdFJlc3VsdC5zdGF0dXNDb2RlID09PSAyMDAgJiYgcG9zdFJlc3VsdC5kYXRhICYmIHBvc3RSZXN1bHQuZGF0YS5tZXNzYWdlICYmIHBvc3RSZXN1bHQuZGF0YS5tZXNzYWdlLmJvdF9pZCAmJiBwb3N0UmVzdWx0LmRhdGEubWVzc2FnZS50cykge1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRTbGFja0JvdElkQW5kU2xhY2tUcyhyb2NrZXRNZXNzYWdlLl9pZCwgcG9zdFJlc3VsdC5kYXRhLm1lc3NhZ2UuYm90X2lkLCBwb3N0UmVzdWx0LmRhdGEubWVzc2FnZS50cyk7XG5cdFx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZyhgUm9ja2V0TXNnSUQ9JHsgcm9ja2V0TWVzc2FnZS5faWQgfSBTbGFja01zZ0lEPSR7IHBvc3RSZXN1bHQuZGF0YS5tZXNzYWdlLnRzIH0gU2xhY2tCb3RJRD0keyBwb3N0UmVzdWx0LmRhdGEubWVzc2FnZS5ib3RfaWQgfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdCBodHRwczovL2FwaS5zbGFjay5jb20vbWV0aG9kcy9jaGF0LnVwZGF0ZVxuXHQgKi9cblx0cG9zdE1lc3NhZ2VVcGRhdGVUb1NsYWNrKHNsYWNrQ2hhbm5lbCwgcm9ja2V0TWVzc2FnZSkge1xuXHRcdGlmIChzbGFja0NoYW5uZWwgJiYgc2xhY2tDaGFubmVsLmlkKSB7XG5cdFx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0XHR0b2tlbjogdGhpcy5hcGlUb2tlbixcblx0XHRcdFx0dHM6IHRoaXMuZ2V0U2xhY2tUUyhyb2NrZXRNZXNzYWdlKSxcblx0XHRcdFx0Y2hhbm5lbDogc2xhY2tDaGFubmVsLmlkLFxuXHRcdFx0XHR0ZXh0OiByb2NrZXRNZXNzYWdlLm1zZyxcblx0XHRcdFx0YXNfdXNlcjogdHJ1ZVxuXHRcdFx0fTtcblx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnUG9zdCBVcGRhdGVNZXNzYWdlIFRvIFNsYWNrJywgZGF0YSk7XG5cdFx0XHRjb25zdCBwb3N0UmVzdWx0ID0gSFRUUC5wb3N0KCdodHRwczovL3NsYWNrLmNvbS9hcGkvY2hhdC51cGRhdGUnLCB7IHBhcmFtczogZGF0YSB9KTtcblx0XHRcdGlmIChwb3N0UmVzdWx0LnN0YXR1c0NvZGUgPT09IDIwMCAmJiBwb3N0UmVzdWx0LmRhdGEgJiYgcG9zdFJlc3VsdC5kYXRhLm9rID09PSB0cnVlKSB7XG5cdFx0XHRcdGxvZ2dlci5jbGFzcy5kZWJ1ZygnTWVzc2FnZSB1cGRhdGVkIG9uIFNsYWNrJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvY2Vzc1JvY2tldE1lc3NhZ2VDaGFuZ2VkKHJvY2tldE1lc3NhZ2UpIHtcblx0XHRpZiAocm9ja2V0TWVzc2FnZSkge1xuXHRcdFx0aWYgKHJvY2tldE1lc3NhZ2UudXBkYXRlZEJ5U2xhY2spIHtcblx0XHRcdFx0Ly9XZSBoYXZlIGFscmVhZHkgcHJvY2Vzc2VkIHRoaXNcblx0XHRcdFx0ZGVsZXRlIHJvY2tldE1lc3NhZ2UudXBkYXRlZEJ5U2xhY2s7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly9UaGlzIHdhcyBhIGNoYW5nZSBmcm9tIFJvY2tldC5DaGF0XG5cdFx0XHRjb25zdCBzbGFja0NoYW5uZWwgPSB0aGlzLnNsYWNrQ2hhbm5lbE1hcFtyb2NrZXRNZXNzYWdlLnJpZF07XG5cdFx0XHR0aGlzLnBvc3RNZXNzYWdlVXBkYXRlVG9TbGFjayhzbGFja0NoYW5uZWwsIHJvY2tldE1lc3NhZ2UpO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdCBodHRwczovL2FwaS5zbGFjay5jb20vZXZlbnRzL21lc3NhZ2UvbWVzc2FnZV9kZWxldGVkXG5cdCAqL1xuXHRwcm9jZXNzU2xhY2tNZXNzYWdlRGVsZXRlZChzbGFja01lc3NhZ2UpIHtcblx0XHRpZiAoc2xhY2tNZXNzYWdlLnByZXZpb3VzX21lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IHJvY2tldENoYW5uZWwgPSB0aGlzLmdldFJvY2tldENoYW5uZWwoc2xhY2tNZXNzYWdlKTtcblx0XHRcdGNvbnN0IHJvY2tldFVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCgncm9ja2V0LmNhdCcsIHsgZmllbGRzOiB7IHVzZXJuYW1lOiAxIH0gfSk7XG5cblx0XHRcdGlmIChyb2NrZXRDaGFubmVsICYmIHJvY2tldFVzZXIpIHtcblx0XHRcdFx0Ly9GaW5kIHRoZSBSb2NrZXQgbWVzc2FnZSB0byBkZWxldGVcblx0XHRcdFx0bGV0IHJvY2tldE1zZ09iaiA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzXG5cdFx0XHRcdFx0LmZpbmRPbmVCeVNsYWNrQm90SWRBbmRTbGFja1RzKHNsYWNrTWVzc2FnZS5wcmV2aW91c19tZXNzYWdlLmJvdF9pZCwgc2xhY2tNZXNzYWdlLnByZXZpb3VzX21lc3NhZ2UudHMpO1xuXG5cdFx0XHRcdGlmICghcm9ja2V0TXNnT2JqKSB7XG5cdFx0XHRcdFx0Ly9NdXN0IGhhdmUgYmVlbiBhIFNsYWNrIG9yaWdpbmF0ZWQgbXNnXG5cdFx0XHRcdFx0Y29uc3QgX2lkID0gdGhpcy5jcmVhdGVSb2NrZXRJRChzbGFja01lc3NhZ2UuY2hhbm5lbCwgc2xhY2tNZXNzYWdlLnByZXZpb3VzX21lc3NhZ2UudHMpO1xuXHRcdFx0XHRcdHJvY2tldE1zZ09iaiA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmZpbmRPbmVCeUlkKF9pZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocm9ja2V0TXNnT2JqKSB7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdC5kZWxldGVNZXNzYWdlKHJvY2tldE1zZ09iaiwgcm9ja2V0VXNlcik7XG5cdFx0XHRcdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdSb2NrZXQgbWVzc2FnZSBkZWxldGVkIGJ5IFNsYWNrJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKlxuXHQgaHR0cHM6Ly9hcGkuc2xhY2suY29tL2V2ZW50cy9tZXNzYWdlL21lc3NhZ2VfY2hhbmdlZFxuXHQgKi9cblx0cHJvY2Vzc1NsYWNrTWVzc2FnZUNoYW5nZWQoc2xhY2tNZXNzYWdlKSB7XG5cdFx0aWYgKHNsYWNrTWVzc2FnZS5wcmV2aW91c19tZXNzYWdlKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50TXNnID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQodGhpcy5jcmVhdGVSb2NrZXRJRChzbGFja01lc3NhZ2UuY2hhbm5lbCwgc2xhY2tNZXNzYWdlLm1lc3NhZ2UudHMpKTtcblxuXHRcdFx0Ly9Pbmx5IHByb2Nlc3MgdGhpcyBjaGFuZ2UsIGlmIGl0cyBhbiBhY3R1YWwgdXBkYXRlIChub3QganVzdCBTbGFjayByZXBlYXRpbmcgYmFjayBvdXIgUm9ja2V0IG9yaWdpbmFsIGNoYW5nZSlcblx0XHRcdGlmIChjdXJyZW50TXNnICYmIChzbGFja01lc3NhZ2UubWVzc2FnZS50ZXh0ICE9PSBjdXJyZW50TXNnLm1zZykpIHtcblx0XHRcdFx0Y29uc3Qgcm9ja2V0Q2hhbm5lbCA9IHRoaXMuZ2V0Um9ja2V0Q2hhbm5lbChzbGFja01lc3NhZ2UpO1xuXHRcdFx0XHRjb25zdCByb2NrZXRVc2VyID0gc2xhY2tNZXNzYWdlLnByZXZpb3VzX21lc3NhZ2UudXNlciA/IHRoaXMuZmluZFJvY2tldFVzZXIoc2xhY2tNZXNzYWdlLnByZXZpb3VzX21lc3NhZ2UudXNlcikgfHwgdGhpcy5hZGRSb2NrZXRVc2VyKHNsYWNrTWVzc2FnZS5wcmV2aW91c19tZXNzYWdlLnVzZXIpIDogbnVsbDtcblxuXHRcdFx0XHRjb25zdCByb2NrZXRNc2dPYmogPSB7XG5cdFx0XHRcdFx0Ly9AVE9ETyBfaWRcblx0XHRcdFx0XHRfaWQ6IHRoaXMuY3JlYXRlUm9ja2V0SUQoc2xhY2tNZXNzYWdlLmNoYW5uZWwsIHNsYWNrTWVzc2FnZS5wcmV2aW91c19tZXNzYWdlLnRzKSxcblx0XHRcdFx0XHRyaWQ6IHJvY2tldENoYW5uZWwuX2lkLFxuXHRcdFx0XHRcdG1zZzogdGhpcy5jb252ZXJ0U2xhY2tNc2dUeHRUb1JvY2tldFR4dEZvcm1hdChzbGFja01lc3NhZ2UubWVzc2FnZS50ZXh0KSxcblx0XHRcdFx0XHR1cGRhdGVkQnlTbGFjazogdHJ1ZVx0Ly9XZSBkb24ndCB3YW50IHRvIG5vdGlmeSBzbGFjayBhYm91dCB0aGlzIGNoYW5nZSBzaW5jZSBTbGFjayBpbml0aWF0ZWQgaXRcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRSb2NrZXRDaGF0LnVwZGF0ZU1lc3NhZ2Uocm9ja2V0TXNnT2JqLCByb2NrZXRVc2VyKTtcblx0XHRcdFx0bG9nZ2VyLmNsYXNzLmRlYnVnKCdSb2NrZXQgbWVzc2FnZSB1cGRhdGVkIGJ5IFNsYWNrJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0IFRoaXMgbWV0aG9kIHdpbGwgZ2V0IHJlZmFjdG9yZWQgYW5kIGJyb2tlbiBkb3duIGludG8gc2luZ2xlIHJlc3BvbnNpYmlsaXRpZXNcblx0ICovXG5cdHByb2Nlc3NTbGFja05ld01lc3NhZ2Uoc2xhY2tNZXNzYWdlLCBpc0ltcG9ydGluZykge1xuXHRcdGNvbnN0IHJvY2tldENoYW5uZWwgPSB0aGlzLmdldFJvY2tldENoYW5uZWwoc2xhY2tNZXNzYWdlKTtcblx0XHRsZXQgcm9ja2V0VXNlciA9IG51bGw7XG5cdFx0aWYgKHNsYWNrTWVzc2FnZS5zdWJ0eXBlID09PSAnYm90X21lc3NhZ2UnKSB7XG5cdFx0XHRyb2NrZXRVc2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQoJ3JvY2tldC5jYXQnLCB7IGZpZWxkczogeyB1c2VybmFtZTogMSB9IH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyb2NrZXRVc2VyID0gc2xhY2tNZXNzYWdlLnVzZXIgPyB0aGlzLmZpbmRSb2NrZXRVc2VyKHNsYWNrTWVzc2FnZS51c2VyKSB8fCB0aGlzLmFkZFJvY2tldFVzZXIoc2xhY2tNZXNzYWdlLnVzZXIpIDogbnVsbDtcblx0XHR9XG5cdFx0aWYgKHJvY2tldENoYW5uZWwgJiYgcm9ja2V0VXNlcikge1xuXHRcdFx0Y29uc3QgbXNnRGF0YURlZmF1bHRzID0ge1xuXHRcdFx0XHRfaWQ6IHRoaXMuY3JlYXRlUm9ja2V0SUQoc2xhY2tNZXNzYWdlLmNoYW5uZWwsIHNsYWNrTWVzc2FnZS50cyksXG5cdFx0XHRcdHRzOiBuZXcgRGF0ZShwYXJzZUludChzbGFja01lc3NhZ2UudHMuc3BsaXQoJy4nKVswXSkgKiAxMDAwKVxuXHRcdFx0fTtcblx0XHRcdGlmIChpc0ltcG9ydGluZykge1xuXHRcdFx0XHRtc2dEYXRhRGVmYXVsdHNbJ2ltcG9ydGVkJ10gPSAnc2xhY2ticmlkZ2UnO1xuXHRcdFx0fVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5jcmVhdGVBbmRTYXZlUm9ja2V0TWVzc2FnZShyb2NrZXRDaGFubmVsLCByb2NrZXRVc2VyLCBzbGFja01lc3NhZ2UsIG1zZ0RhdGFEZWZhdWx0cywgaXNJbXBvcnRpbmcpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBodHRwOi8vd3d3Lm1vbmdvZGIub3JnL2Fib3V0L2NvbnRyaWJ1dG9ycy9lcnJvci1jb2Rlcy9cblx0XHRcdFx0Ly8gMTEwMDAgPT0gZHVwbGljYXRlIGtleSBlcnJvclxuXHRcdFx0XHRpZiAoZS5uYW1lID09PSAnTW9uZ29FcnJvcicgJiYgZS5jb2RlID09PSAxMTAwMCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IGU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHJpZXZlcyB0aGUgU2xhY2sgVFMgZnJvbSBhIFJvY2tldCBtc2cgdGhhdCBvcmlnaW5hdGVkIGZyb20gU2xhY2tcblx0ICogQHBhcmFtIHJvY2tldE1zZ1xuXHQgKiBAcmV0dXJucyBTbGFjayBUUyBvciB1bmRlZmluZWQgaWYgbm90IGEgbWVzc2FnZSB0aGF0IG9yaWdpbmF0ZWQgZnJvbSBzbGFja1xuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0Z2V0U2xhY2tUUyhyb2NrZXRNc2cpIHtcblx0XHQvL3NsYWNrLUczS0pHR0UxNS0xNDgzMDgxMDYxLTAwMDE2OVxuXHRcdGxldCBzbGFja1RTO1xuXHRcdGxldCBpbmRleCA9IHJvY2tldE1zZy5faWQuaW5kZXhPZignc2xhY2stJyk7XG5cdFx0aWYgKGluZGV4ID09PSAwKSB7XG5cdFx0XHQvL1RoaXMgaXMgYSBtc2cgdGhhdCBvcmlnaW5hdGVkIGZyb20gU2xhY2tcblx0XHRcdHNsYWNrVFMgPSByb2NrZXRNc2cuX2lkLnN1YnN0cig2LCByb2NrZXRNc2cuX2lkLmxlbmd0aCk7XG5cdFx0XHRpbmRleCA9IHNsYWNrVFMuaW5kZXhPZignLScpO1xuXHRcdFx0c2xhY2tUUyA9IHNsYWNrVFMuc3Vic3RyKGluZGV4KzEsIHNsYWNrVFMubGVuZ3RoKTtcblx0XHRcdHNsYWNrVFMgPSBzbGFja1RTLnJlcGxhY2UoJy0nLCAnLicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvL1RoaXMgcHJvYmFibHkgb3JpZ2luYXRlZCBhcyBhIFJvY2tldCBtc2csIGJ1dCBoYXMgYmVlbiBzZW50IHRvIFNsYWNrXG5cdFx0XHRzbGFja1RTID0gcm9ja2V0TXNnLnNsYWNrVHM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNsYWNrVFM7XG5cdH1cblxuXHRnZXRSb2NrZXRDaGFubmVsKHNsYWNrTWVzc2FnZSkge1xuXHRcdHJldHVybiBzbGFja01lc3NhZ2UuY2hhbm5lbCA/IHRoaXMuZmluZFJvY2tldENoYW5uZWwoc2xhY2tNZXNzYWdlLmNoYW5uZWwpIHx8IHRoaXMuYWRkUm9ja2V0Q2hhbm5lbChzbGFja01lc3NhZ2UuY2hhbm5lbCkgOiBudWxsO1xuXHR9XG5cblx0Z2V0Um9ja2V0VXNlcihzbGFja1VzZXIpIHtcblx0XHRyZXR1cm4gc2xhY2tVc2VyID8gdGhpcy5maW5kUm9ja2V0VXNlcihzbGFja1VzZXIpIHx8IHRoaXMuYWRkUm9ja2V0VXNlcihzbGFja1VzZXIpIDogbnVsbDtcblx0fVxuXG5cdGNyZWF0ZVJvY2tldElEKHNsYWNrQ2hhbm5lbCwgdHMpIHtcblx0XHRyZXR1cm4gYHNsYWNrLSR7IHNsYWNrQ2hhbm5lbCB9LSR7IHRzLnJlcGxhY2UoL1xcLi9nLCAnLScpIH1gO1xuXHR9XG5cbn1cblxuUm9ja2V0Q2hhdC5TbGFja0JyaWRnZSA9IG5ldyBTbGFja0JyaWRnZTtcbiIsIi8qIGdsb2JhbHMgbXNnU3RyZWFtICovXG5mdW5jdGlvbiBTbGFja0JyaWRnZUltcG9ydChjb21tYW5kLCBwYXJhbXMsIGl0ZW0pIHtcblx0aWYgKGNvbW1hbmQgIT09ICdzbGFja2JyaWRnZS1pbXBvcnQnIHx8ICFNYXRjaC50ZXN0KHBhcmFtcywgU3RyaW5nKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpdGVtLnJpZCk7XG5cdGNvbnN0IGNoYW5uZWwgPSByb29tLm5hbWU7XG5cdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZShNZXRlb3IudXNlcklkKCkpO1xuXG5cdG1zZ1N0cmVhbS5lbWl0KGl0ZW0ucmlkLCB7XG5cdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdHU6IHsgdXNlcm5hbWU6ICdyb2NrZXQuY2F0JyB9LFxuXHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdG1zZzogVEFQaTE4bi5fXygnU2xhY2tCcmlkZ2Vfc3RhcnQnLCB7XG5cdFx0XHRwb3N0UHJvY2VzczogJ3NwcmludGYnLFxuXHRcdFx0c3ByaW50ZjogW3VzZXIudXNlcm5hbWUsIGNoYW5uZWxdXG5cdFx0fSwgdXNlci5sYW5ndWFnZSlcblx0fSk7XG5cblx0dHJ5IHtcblx0XHRSb2NrZXRDaGF0LlNsYWNrQnJpZGdlLmltcG9ydE1lc3NhZ2VzKGl0ZW0ucmlkLCBlcnJvciA9PiB7XG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0bXNnU3RyZWFtLmVtaXQoaXRlbS5yaWQsIHtcblx0XHRcdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0XHRcdHJpZDogaXRlbS5yaWQsXG5cdFx0XHRcdFx0dTogeyB1c2VybmFtZTogJ3JvY2tldC5jYXQnIH0sXG5cdFx0XHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRcdFx0bXNnOiBUQVBpMThuLl9fKCdTbGFja0JyaWRnZV9lcnJvcicsIHtcblx0XHRcdFx0XHRcdHBvc3RQcm9jZXNzOiAnc3ByaW50ZicsXG5cdFx0XHRcdFx0XHRzcHJpbnRmOiBbY2hhbm5lbCwgZXJyb3IubWVzc2FnZV1cblx0XHRcdFx0XHR9LCB1c2VyLmxhbmd1YWdlKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1zZ1N0cmVhbS5lbWl0KGl0ZW0ucmlkLCB7XG5cdFx0XHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0XHRyaWQ6IGl0ZW0ucmlkLFxuXHRcdFx0XHRcdHU6IHsgdXNlcm5hbWU6ICdyb2NrZXQuY2F0JyB9LFxuXHRcdFx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0XHRcdG1zZzogVEFQaTE4bi5fXygnU2xhY2tCcmlkZ2VfZmluaXNoJywge1xuXHRcdFx0XHRcdFx0cG9zdFByb2Nlc3M6ICdzcHJpbnRmJyxcblx0XHRcdFx0XHRcdHNwcmludGY6IFtjaGFubmVsXVxuXHRcdFx0XHRcdH0sIHVzZXIubGFuZ3VhZ2UpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdG1zZ1N0cmVhbS5lbWl0KGl0ZW0ucmlkLCB7XG5cdFx0XHRfaWQ6IFJhbmRvbS5pZCgpLFxuXHRcdFx0cmlkOiBpdGVtLnJpZCxcblx0XHRcdHU6IHsgdXNlcm5hbWU6ICdyb2NrZXQuY2F0JyB9LFxuXHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRtc2c6IFRBUGkxOG4uX18oJ1NsYWNrQnJpZGdlX2Vycm9yJywge1xuXHRcdFx0XHRwb3N0UHJvY2VzczogJ3NwcmludGYnLFxuXHRcdFx0XHRzcHJpbnRmOiBbY2hhbm5lbCwgZXJyb3IubWVzc2FnZV1cblx0XHRcdH0sIHVzZXIubGFuZ3VhZ2UpXG5cdFx0fSk7XG5cdFx0dGhyb3cgZXJyb3I7XG5cdH1cblx0cmV0dXJuIFNsYWNrQnJpZGdlSW1wb3J0O1xufVxuXG5Sb2NrZXRDaGF0LnNsYXNoQ29tbWFuZHMuYWRkKCdzbGFja2JyaWRnZS1pbXBvcnQnLCBTbGFja0JyaWRnZUltcG9ydCk7XG4iXX0=
