(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var ECMAScript = Package.ecmascript.ECMAScript;
var Babel = Package['babel-compiler'].Babel;
var BabelCompiler = Package['babel-compiler'].BabelCompiler;
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
var logger, integration, Api, message;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:integrations":{"lib":{"rocketchat.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/lib/rocketchat.js                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.integrations = {
	outgoingEvents: {
		sendMessage: {
			label: 'Integrations_Outgoing_Type_SendMessage',
			value: 'sendMessage',
			use: {
				channel: true,
				triggerWords: true,
				targetRoom: false
			}
		},
		fileUploaded: {
			label: 'Integrations_Outgoing_Type_FileUploaded',
			value: 'fileUploaded',
			use: {
				channel: true,
				triggerWords: false,
				targetRoom: false
			}
		},
		roomArchived: {
			label: 'Integrations_Outgoing_Type_RoomArchived',
			value: 'roomArchived',
			use: {
				channel: false,
				triggerWords: false,
				targetRoom: false
			}
		},
		roomCreated: {
			label: 'Integrations_Outgoing_Type_RoomCreated',
			value: 'roomCreated',
			use: {
				channel: false,
				triggerWords: false,
				targetRoom: false
			}
		},
		roomJoined: {
			label: 'Integrations_Outgoing_Type_RoomJoined',
			value: 'roomJoined',
			use: {
				channel: true,
				triggerWords: false,
				targetRoom: false
			}
		},
		roomLeft: {
			label: 'Integrations_Outgoing_Type_RoomLeft',
			value: 'roomLeft',
			use: {
				channel: true,
				triggerWords: false,
				targetRoom: false
			}
		},
		userCreated: {
			label: 'Integrations_Outgoing_Type_UserCreated',
			value: 'userCreated',
			use: {
				channel: false,
				triggerWords: false,
				targetRoom: true
			}
		}
	}
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"logger.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/logger.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals logger:true */ /* exported logger */logger = new Logger('Integrations', {
	sections: {
		incoming: 'Incoming WebHook',
		outgoing: 'Outgoing WebHook'
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"validation.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/lib/validation.js                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
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
const scopedChannels = ['all_public_channels', 'all_private_groups', 'all_direct_messages'];
const validChannelChars = ['@', '#'];

function _verifyRequiredFields(integration) {
	if (!integration.event || !Match.test(integration.event, String) || integration.event.trim() === '' || !RocketChat.integrations.outgoingEvents[integration.event]) {
		throw new Meteor.Error('error-invalid-event-type', 'Invalid event type', {
			function: 'validateOutgoing._verifyRequiredFields'
		});
	}

	if (!integration.username || !Match.test(integration.username, String) || integration.username.trim() === '') {
		throw new Meteor.Error('error-invalid-username', 'Invalid username', {
			function: 'validateOutgoing._verifyRequiredFields'
		});
	}

	if (RocketChat.integrations.outgoingEvents[integration.event].use.targetRoom && !integration.targetRoom) {
		throw new Meteor.Error('error-invalid-targetRoom', 'Invalid Target Room', {
			function: 'validateOutgoing._verifyRequiredFields'
		});
	}

	if (!Match.test(integration.urls, [String])) {
		throw new Meteor.Error('error-invalid-urls', 'Invalid URLs', {
			function: 'validateOutgoing._verifyRequiredFields'
		});
	}

	for (const [index, url] of integration.urls.entries()) {
		if (url.trim() === '') {
			delete integration.urls[index];
		}
	}

	integration.urls = _.without(integration.urls, [undefined]);

	if (integration.urls.length === 0) {
		throw new Meteor.Error('error-invalid-urls', 'Invalid URLs', {
			function: 'validateOutgoing._verifyRequiredFields'
		});
	}
}

function _verifyUserHasPermissionForChannels(integration, userId, channels) {
	for (let channel of channels) {
		if (scopedChannels.includes(channel)) {
			if (channel === 'all_public_channels') {// No special permissions needed to add integration to public channels
			} else if (!RocketChat.authz.hasPermission(userId, 'manage-integrations')) {
				throw new Meteor.Error('error-invalid-channel', 'Invalid Channel', {
					function: 'validateOutgoing._verifyUserHasPermissionForChannels'
				});
			}
		} else {
			let record;
			const channelType = channel[0];
			channel = channel.substr(1);

			switch (channelType) {
				case '#':
					record = RocketChat.models.Rooms.findOne({
						$or: [{
							_id: channel
						}, {
							name: channel
						}]
					});
					break;

				case '@':
					record = RocketChat.models.Users.findOne({
						$or: [{
							_id: channel
						}, {
							username: channel
						}]
					});
					break;
			}

			if (!record) {
				throw new Meteor.Error('error-invalid-room', 'Invalid room', {
					function: 'validateOutgoing._verifyUserHasPermissionForChannels'
				});
			}

			if (record.usernames && !RocketChat.authz.hasPermission(userId, 'manage-integrations') && RocketChat.authz.hasPermission(userId, 'manage-own-integrations') && !record.usernames.includes(Meteor.user().username)) {
				throw new Meteor.Error('error-invalid-channel', 'Invalid Channel', {
					function: 'validateOutgoing._verifyUserHasPermissionForChannels'
				});
			}
		}
	}
}

function _verifyRetryInformation(integration) {
	if (!integration.retryFailedCalls) {
		return;
	} // Don't allow negative retry counts


	integration.retryCount = integration.retryCount && parseInt(integration.retryCount) > 0 ? parseInt(integration.retryCount) : 4;
	integration.retryDelay = !integration.retryDelay || !integration.retryDelay.trim() ? 'powers-of-ten' : integration.retryDelay.toLowerCase();
}

RocketChat.integrations.validateOutgoing = function _validateOutgoing(integration, userId) {
	if (integration.channel && Match.test(integration.channel, String) && integration.channel.trim() === '') {
		delete integration.channel;
	} //Moved to it's own function to statisfy the complexity rule


	_verifyRequiredFields(integration);

	let channels = [];

	if (RocketChat.integrations.outgoingEvents[integration.event].use.channel) {
		if (!Match.test(integration.channel, String)) {
			throw new Meteor.Error('error-invalid-channel', 'Invalid Channel', {
				function: 'validateOutgoing'
			});
		} else {
			channels = _.map(integration.channel.split(','), channel => s.trim(channel));

			for (const channel of channels) {
				if (!validChannelChars.includes(channel[0]) && !scopedChannels.includes(channel.toLowerCase())) {
					throw new Meteor.Error('error-invalid-channel-start-with-chars', 'Invalid channel. Start with @ or #', {
						function: 'validateOutgoing'
					});
				}
			}
		}
	} else if (!RocketChat.authz.hasPermission(userId, 'manage-integrations')) {
		throw new Meteor.Error('error-invalid-permissions', 'Invalid permission for required Integration creation.', {
			function: 'validateOutgoing'
		});
	}

	if (RocketChat.integrations.outgoingEvents[integration.event].use.triggerWords && integration.triggerWords) {
		if (!Match.test(integration.triggerWords, [String])) {
			throw new Meteor.Error('error-invalid-triggerWords', 'Invalid triggerWords', {
				function: 'validateOutgoing'
			});
		}

		integration.triggerWords.forEach((word, index) => {
			if (!word || word.trim() === '') {
				delete integration.triggerWords[index];
			}
		});
		integration.triggerWords = _.without(integration.triggerWords, [undefined]);
	} else {
		delete integration.triggerWords;
	}

	if (integration.scriptEnabled === true && integration.script && integration.script.trim() !== '') {
		try {
			const babelOptions = Object.assign(Babel.getDefaultOptions({
				runtime: false
			}), {
				compact: true,
				minified: true,
				comments: false
			});
			integration.scriptCompiled = Babel.compile(integration.script, babelOptions).code;
			integration.scriptError = undefined;
		} catch (e) {
			integration.scriptCompiled = undefined;
			integration.scriptError = _.pick(e, 'name', 'message', 'stack');
		}
	}

	if (typeof integration.runOnEdits !== 'undefined') {
		// Verify this value is only true/false
		integration.runOnEdits = integration.runOnEdits === true;
	}

	_verifyUserHasPermissionForChannels(integration, userId, channels);

	_verifyRetryInformation(integration);

	const user = RocketChat.models.Users.findOne({
		username: integration.username
	});

	if (!user) {
		throw new Meteor.Error('error-invalid-user', 'Invalid user (did you delete the `rocket.cat` user?)', {
			function: 'validateOutgoing'
		});
	}

	integration.type = 'webhook-outgoing';
	integration.userId = user._id;
	integration.channel = channels;
	return integration;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"triggerHandler.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/lib/triggerHandler.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
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
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 2);
RocketChat.integrations.triggerHandler = new class RocketChatIntegrationHandler {
	constructor() {
		this.vm = Npm.require('vm');
		this.successResults = [200, 201, 202];
		this.compiledScripts = {};
		this.triggers = {};
		RocketChat.models.Integrations.find({
			type: 'webhook-outgoing'
		}).observe({
			added: record => {
				this.addIntegration(record);
			},
			changed: record => {
				this.removeIntegration(record);
				this.addIntegration(record);
			},
			removed: record => {
				this.removeIntegration(record);
			}
		});
	}

	addIntegration(record) {
		logger.outgoing.debug(`Adding the integration ${record.name} of the event ${record.event}!`);
		let channels;

		if (record.event && !RocketChat.integrations.outgoingEvents[record.event].use.channel) {
			logger.outgoing.debug('The integration doesnt rely on channels.'); //We don't use any channels, so it's special ;)

			channels = ['__any'];
		} else if (_.isEmpty(record.channel)) {
			logger.outgoing.debug('The integration had an empty channel property, so it is going on all the public channels.');
			channels = ['all_public_channels'];
		} else {
			logger.outgoing.debug('The integration is going on these channels:', record.channel);
			channels = [].concat(record.channel);
		}

		for (const channel of channels) {
			if (!this.triggers[channel]) {
				this.triggers[channel] = {};
			}

			this.triggers[channel][record._id] = record;
		}
	}

	removeIntegration(record) {
		for (const trigger of Object.values(this.triggers)) {
			delete trigger[record._id];
		}
	}

	isTriggerEnabled(trigger) {
		for (const trig of Object.values(this.triggers)) {
			if (trig[trigger._id]) {
				return trig[trigger._id].enabled;
			}
		}

		return false;
	}

	updateHistory({
		historyId,
		step,
		integration,
		event,
		data,
		triggerWord,
		ranPrepareScript,
		prepareSentMessage,
		processSentMessage,
		resultMessage,
		finished,
		url,
		httpCallData,
		httpError,
		httpResult,
		error,
		errorStack
	}) {
		const history = {
			type: 'outgoing-webhook',
			step
		}; // Usually is only added on initial insert

		if (integration) {
			history.integration = integration;
		} // Usually is only added on initial insert


		if (event) {
			history.event = event;
		}

		if (data) {
			history.data = data;

			if (data.user) {
				history.data.user = _.omit(data.user, ['meta', '$loki', 'services']);
			}

			if (data.room) {
				history.data.room = _.omit(data.room, ['meta', '$loki', 'usernames']);
				history.data.room.usernames = ['this_will_be_filled_in_with_usernames_when_replayed'];
			}
		}

		if (triggerWord) {
			history.triggerWord = triggerWord;
		}

		if (typeof ranPrepareScript !== 'undefined') {
			history.ranPrepareScript = ranPrepareScript;
		}

		if (prepareSentMessage) {
			history.prepareSentMessage = prepareSentMessage;
		}

		if (processSentMessage) {
			history.processSentMessage = processSentMessage;
		}

		if (resultMessage) {
			history.resultMessage = resultMessage;
		}

		if (typeof finished !== 'undefined') {
			history.finished = finished;
		}

		if (url) {
			history.url = url;
		}

		if (typeof httpCallData !== 'undefined') {
			history.httpCallData = httpCallData;
		}

		if (httpError) {
			history.httpError = httpError;
		}

		if (typeof httpResult !== 'undefined') {
			history.httpResult = JSON.stringify(httpResult, null, 2);
		}

		if (typeof error !== 'undefined') {
			history.error = error;
		}

		if (typeof errorStack !== 'undefined') {
			history.errorStack = errorStack;
		}

		if (historyId) {
			RocketChat.models.IntegrationHistory.update({
				_id: historyId
			}, {
				$set: history
			});
			return historyId;
		} else {
			history._createdAt = new Date();
			return RocketChat.models.IntegrationHistory.insert(Object.assign({
				_id: Random.id()
			}, history));
		}
	} //Trigger is the trigger, nameOrId is a string which is used to try and find a room, room is a room, message is a message, and data contains "user_name" if trigger.impersonateUser is truthful.


	sendMessage({
		trigger,
		nameOrId = '',
		room,
		message,
		data
	}) {
		let user; //Try to find the user who we are impersonating

		if (trigger.impersonateUser) {
			user = RocketChat.models.Users.findOneByUsername(data.user_name);
		} //If they don't exist (aka the trigger didn't contain a user) then we set the user based upon the
		//configured username for the integration since this is required at all times.


		if (!user) {
			user = RocketChat.models.Users.findOneByUsername(trigger.username);
		}

		let tmpRoom;

		if (nameOrId || trigger.targetRoom || message.channel) {
			tmpRoom = RocketChat.getRoomByNameOrIdWithOptionToJoin({
				currentUserId: user._id,
				nameOrId: nameOrId || message.channel || trigger.targetRoom,
				errorOnEmpty: false
			}) || room;
		} else {
			tmpRoom = room;
		} //If no room could be found, we won't be sending any messages but we'll warn in the logs


		if (!tmpRoom) {
			logger.outgoing.warn(`The Integration "${trigger.name}" doesn't have a room configured nor did it provide a room to send the message to.`);
			return;
		}

		logger.outgoing.debug(`Found a room for ${trigger.name} which is: ${tmpRoom.name} with a type of ${tmpRoom.t}`);
		message.bot = {
			i: trigger._id
		};
		const defaultValues = {
			alias: trigger.alias,
			avatar: trigger.avatar,
			emoji: trigger.emoji
		};

		if (tmpRoom.t === 'd') {
			message.channel = `@${tmpRoom._id}`;
		} else {
			message.channel = `#${tmpRoom._id}`;
		}

		message = processWebhookMessage(message, user, defaultValues);
		return message;
	}

	buildSandbox(store = {}) {
		const sandbox = {
			_,
			s,
			console,
			moment,
			Store: {
				set: (key, val) => store[key] = val,
				get: key => store[key]
			},
			HTTP: (method, url, options) => {
				try {
					return {
						result: HTTP.call(method, url, options)
					};
				} catch (error) {
					return {
						error
					};
				}
			}
		};
		Object.keys(RocketChat.models).filter(k => !k.startsWith('_')).forEach(k => {
			sandbox[k] = RocketChat.models[k];
		});
		return {
			store,
			sandbox
		};
	}

	getIntegrationScript(integration) {
		const compiledScript = this.compiledScripts[integration._id];

		if (compiledScript && +compiledScript._updatedAt === +integration._updatedAt) {
			return compiledScript.script;
		}

		const script = integration.scriptCompiled;
		const {
			store,
			sandbox
		} = this.buildSandbox();
		let vmScript;

		try {
			logger.outgoing.info('Will evaluate script of Trigger', integration.name);
			logger.outgoing.debug(script);
			vmScript = this.vm.createScript(script, 'script.js');
			vmScript.runInNewContext(sandbox);

			if (sandbox.Script) {
				this.compiledScripts[integration._id] = {
					script: new sandbox.Script(),
					store,
					_updatedAt: integration._updatedAt
				};
				return this.compiledScripts[integration._id].script;
			}
		} catch (e) {
			logger.outgoing.error(`Error evaluating Script in Trigger ${integration.name}:`);
			logger.outgoing.error(script.replace(/^/gm, '  '));
			logger.outgoing.error('Stack Trace:');
			logger.outgoing.error(e.stack.replace(/^/gm, '  '));
			throw new Meteor.Error('error-evaluating-script');
		}

		if (!sandbox.Script) {
			logger.outgoing.error(`Class "Script" not in Trigger ${integration.name}:`);
			throw new Meteor.Error('class-script-not-found');
		}
	}

	hasScriptAndMethod(integration, method) {
		if (integration.scriptEnabled !== true || !integration.scriptCompiled || integration.scriptCompiled.trim() === '') {
			return false;
		}

		let script;

		try {
			script = this.getIntegrationScript(integration);
		} catch (e) {
			return false;
		}

		return typeof script[method] !== 'undefined';
	}

	executeScript(integration, method, params, historyId) {
		let script;

		try {
			script = this.getIntegrationScript(integration);
		} catch (e) {
			this.updateHistory({
				historyId,
				step: 'execute-script-getting-script',
				error: true,
				errorStack: e
			});
			return;
		}

		if (!script[method]) {
			logger.outgoing.error(`Method "${method}" no found in the Integration "${integration.name}"`);
			this.updateHistory({
				historyId,
				step: `execute-script-no-method-${method}`
			});
			return;
		}

		try {
			const {
				sandbox
			} = this.buildSandbox(this.compiledScripts[integration._id].store);
			sandbox.script = script;
			sandbox.method = method;
			sandbox.params = params;
			this.updateHistory({
				historyId,
				step: `execute-script-before-running-${method}`
			});
			const result = this.vm.runInNewContext('script[method](params)', sandbox, {
				timeout: 3000
			});
			logger.outgoing.debug(`Script method "${method}" result of the Integration "${integration.name}" is:`);
			logger.outgoing.debug(result);
			return result;
		} catch (e) {
			this.updateHistory({
				historyId,
				step: `execute-script-error-running-${method}`,
				error: true,
				errorStack: e.stack.replace(/^/gm, '  ')
			});
			logger.outgoing.error(`Error running Script in the Integration ${integration.name}:`);
			logger.outgoing.debug(integration.scriptCompiled.replace(/^/gm, '  ')); // Only output the compiled script if debugging is enabled, so the logs don't get spammed.

			logger.outgoing.error('Stack:');
			logger.outgoing.error(e.stack.replace(/^/gm, '  '));
			return;
		}
	}

	eventNameArgumentsToObject() {
		const argObject = {
			event: arguments[0]
		};

		switch (argObject.event) {
			case 'sendMessage':
				if (arguments.length >= 3) {
					argObject.message = arguments[1];
					argObject.room = arguments[2];
				}

				break;

			case 'fileUploaded':
				if (arguments.length >= 2) {
					const arghhh = arguments[1];
					argObject.user = arghhh.user;
					argObject.room = arghhh.room;
					argObject.message = arghhh.message;
				}

				break;

			case 'roomArchived':
				if (arguments.length >= 3) {
					argObject.room = arguments[1];
					argObject.user = arguments[2];
				}

				break;

			case 'roomCreated':
				if (arguments.length >= 3) {
					argObject.owner = arguments[1];
					argObject.room = arguments[2];
				}

				break;

			case 'roomJoined':
			case 'roomLeft':
				if (arguments.length >= 3) {
					argObject.user = arguments[1];
					argObject.room = arguments[2];
				}

				break;

			case 'userCreated':
				if (arguments.length >= 2) {
					argObject.user = arguments[1];
				}

				break;

			default:
				logger.outgoing.warn(`An Unhandled Trigger Event was called: ${argObject.event}`);
				argObject.event = undefined;
				break;
		}

		logger.outgoing.debug(`Got the event arguments for the event: ${argObject.event}`, argObject);
		return argObject;
	}

	mapEventArgsToData(data, {
		event,
		message,
		room,
		owner,
		user
	}) {
		switch (event) {
			case 'sendMessage':
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.message_id = message._id;
				data.timestamp = message.ts;
				data.user_id = message.u._id;
				data.user_name = message.u.username;
				data.text = message.msg;

				if (message.alias) {
					data.alias = message.alias;
				}

				if (message.bot) {
					data.bot = message.bot;
				}

				if (message.editedAt) {
					data.isEdited = true;
				}

				break;

			case 'fileUploaded':
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.message_id = message._id;
				data.timestamp = message.ts;
				data.user_id = message.u._id;
				data.user_name = message.u.username;
				data.text = message.msg;
				data.user = user;
				data.room = room;
				data.message = message;

				if (message.alias) {
					data.alias = message.alias;
				}

				if (message.bot) {
					data.bot = message.bot;
				}

				break;

			case 'roomCreated':
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.timestamp = room.ts;
				data.user_id = owner._id;
				data.user_name = owner.username;
				data.owner = owner;
				data.room = room;
				break;

			case 'roomArchived':
			case 'roomJoined':
			case 'roomLeft':
				data.timestamp = new Date();
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.user_id = user._id;
				data.user_name = user.username;
				data.user = user;
				data.room = room;

				if (user.type === 'bot') {
					data.bot = true;
				}

				break;

			case 'userCreated':
				data.timestamp = user.createdAt;
				data.user_id = user._id;
				data.user_name = user.username;
				data.user = user;

				if (user.type === 'bot') {
					data.bot = true;
				}

				break;

			default:
				break;
		}
	}

	executeTriggers() {
		logger.outgoing.debug('Execute Trigger:', arguments[0]);
		const argObject = this.eventNameArgumentsToObject(...arguments);
		const {
			event,
			message,
			room
		} = argObject; //Each type of event should have an event and a room attached, otherwise we
		//wouldn't know how to handle the trigger nor would we have anywhere to send the
		//result of the integration

		if (!event) {
			return;
		}

		const triggersToExecute = [];
		logger.outgoing.debug('Starting search for triggers for the room:', room ? room._id : '__any');

		if (room) {
			switch (room.t) {
				case 'd':
					const id = room._id.replace(message.u._id, '');

					const username = _.without(room.usernames, message.u.username)[0];

					if (this.triggers[`@${id}`]) {
						for (const trigger of Object.values(this.triggers[`@${id}`])) {
							triggersToExecute.push(trigger);
						}
					}

					if (this.triggers.all_direct_messages) {
						for (const trigger of Object.values(this.triggers.all_direct_messages)) {
							triggersToExecute.push(trigger);
						}
					}

					if (id !== username && this.triggers[`@${username}`]) {
						for (const trigger of Object.values(this.triggers[`@${username}`])) {
							triggersToExecute.push(trigger);
						}
					}

					break;

				case 'c':
					if (this.triggers.all_public_channels) {
						for (const trigger of Object.values(this.triggers.all_public_channels)) {
							triggersToExecute.push(trigger);
						}
					}

					if (this.triggers[`#${room._id}`]) {
						for (const trigger of Object.values(this.triggers[`#${room._id}`])) {
							triggersToExecute.push(trigger);
						}
					}

					if (room._id !== room.name && this.triggers[`#${room.name}`]) {
						for (const trigger of Object.values(this.triggers[`#${room.name}`])) {
							triggersToExecute.push(trigger);
						}
					}

					break;

				default:
					if (this.triggers.all_private_groups) {
						for (const trigger of Object.values(this.triggers.all_private_groups)) {
							triggersToExecute.push(trigger);
						}
					}

					if (this.triggers[`#${room._id}`]) {
						for (const trigger of Object.values(this.triggers[`#${room._id}`])) {
							triggersToExecute.push(trigger);
						}
					}

					if (room._id !== room.name && this.triggers[`#${room.name}`]) {
						for (const trigger of Object.values(this.triggers[`#${room.name}`])) {
							triggersToExecute.push(trigger);
						}
					}

					break;
			}
		}

		if (this.triggers.__any) {
			//For outgoing integration which don't rely on rooms.
			for (const trigger of Object.values(this.triggers.__any)) {
				triggersToExecute.push(trigger);
			}
		}

		logger.outgoing.debug(`Found ${triggersToExecute.length} to iterate over and see if the match the event.`);

		for (const triggerToExecute of triggersToExecute) {
			logger.outgoing.debug(`Is "${triggerToExecute.name}" enabled, ${triggerToExecute.enabled}, and what is the event? ${triggerToExecute.event}`);

			if (triggerToExecute.enabled === true && triggerToExecute.event === event) {
				this.executeTrigger(triggerToExecute, argObject);
			}
		}
	}

	executeTrigger(trigger, argObject) {
		for (const url of trigger.urls) {
			this.executeTriggerUrl(url, trigger, argObject, 0);
		}
	}

	executeTriggerUrl(url, trigger, {
		event,
		message,
		room,
		owner,
		user
	}, theHistoryId, tries = 0) {
		if (!this.isTriggerEnabled(trigger)) {
			logger.outgoing.warn(`The trigger "${trigger.name}" is no longer enabled, stopping execution of it at try: ${tries}`);
			return;
		}

		logger.outgoing.debug(`Starting to execute trigger: ${trigger.name} (${trigger._id})`);
		let word; //Not all triggers/events support triggerWords

		if (RocketChat.integrations.outgoingEvents[event].use.triggerWords) {
			if (trigger.triggerWords && trigger.triggerWords.length > 0) {
				for (const triggerWord of trigger.triggerWords) {
					if (!trigger.triggerWordAnywhere && message.msg.indexOf(triggerWord) === 0) {
						word = triggerWord;
						break;
					} else if (trigger.triggerWordAnywhere && message.msg.includes(triggerWord)) {
						word = triggerWord;
						break;
					}
				} // Stop if there are triggerWords but none match


				if (!word) {
					logger.outgoing.debug(`The trigger word which "${trigger.name}" was expecting could not be found, not executing.`);
					return;
				}
			}
		}

		if (message && message.editedAt && !trigger.runOnEdits) {
			logger.outgoing.debug(`The trigger "${trigger.name}"'s run on edits is disabled and the message was edited.`);
			return;
		}

		const historyId = this.updateHistory({
			step: 'start-execute-trigger-url',
			integration: trigger,
			event
		});
		const data = {
			token: trigger.token,
			bot: false
		};

		if (word) {
			data.trigger_word = word;
		}

		this.mapEventArgsToData(data, {
			trigger,
			event,
			message,
			room,
			owner,
			user
		});
		this.updateHistory({
			historyId,
			step: 'mapped-args-to-data',
			data,
			triggerWord: word
		});
		logger.outgoing.info(`Will be executing the Integration "${trigger.name}" to the url: ${url}`);
		logger.outgoing.debug(data);
		let opts = {
			params: {},
			method: 'POST',
			url,
			data,
			auth: undefined,
			npmRequestOptions: {
				rejectUnauthorized: !RocketChat.settings.get('Allow_Invalid_SelfSigned_Certs'),
				strictSSL: !RocketChat.settings.get('Allow_Invalid_SelfSigned_Certs')
			},
			headers: {
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36'
			}
		};

		if (this.hasScriptAndMethod(trigger, 'prepare_outgoing_request')) {
			opts = this.executeScript(trigger, 'prepare_outgoing_request', {
				request: opts
			}, historyId);
		}

		this.updateHistory({
			historyId,
			step: 'after-maybe-ran-prepare',
			ranPrepareScript: true
		});

		if (!opts) {
			this.updateHistory({
				historyId,
				step: 'after-prepare-no-opts',
				finished: true
			});
			return;
		}

		if (opts.message) {
			const prepareMessage = this.sendMessage({
				trigger,
				room,
				message: opts.message,
				data
			});
			this.updateHistory({
				historyId,
				step: 'after-prepare-send-message',
				prepareSentMessage: prepareMessage
			});
		}

		if (!opts.url || !opts.method) {
			this.updateHistory({
				historyId,
				step: 'after-prepare-no-url_or_method',
				finished: true
			});
			return;
		}

		this.updateHistory({
			historyId,
			step: 'pre-http-call',
			url: opts.url,
			httpCallData: opts.data
		});
		HTTP.call(opts.method, opts.url, opts, (error, result) => {
			if (!result) {
				logger.outgoing.warn(`Result for the Integration ${trigger.name} to ${url} is empty`);
			} else {
				logger.outgoing.info(`Status code for the Integration ${trigger.name} to ${url} is ${result.statusCode}`);
			}

			this.updateHistory({
				historyId,
				step: 'after-http-call',
				httpError: error,
				httpResult: result
			});

			if (this.hasScriptAndMethod(trigger, 'process_outgoing_response')) {
				const sandbox = {
					request: opts,
					response: {
						error,
						status_code: result ? result.statusCode : undefined,
						//These values will be undefined to close issues #4175, #5762, and #5896
						content: result ? result.data : undefined,
						content_raw: result ? result.content : undefined,
						headers: result ? result.headers : {}
					}
				};
				const scriptResult = this.executeScript(trigger, 'process_outgoing_response', sandbox, historyId);

				if (scriptResult && scriptResult.content) {
					const resultMessage = this.sendMessage({
						trigger,
						room,
						message: scriptResult.content,
						data
					});
					this.updateHistory({
						historyId,
						step: 'after-process-send-message',
						processSentMessage: resultMessage,
						finished: true
					});
					return;
				}

				if (scriptResult === false) {
					this.updateHistory({
						historyId,
						step: 'after-process-false-result',
						finished: true
					});
					return;
				}
			} // if the result contained nothing or wasn't a successful statusCode


			if (!result || !this.successResults.includes(result.statusCode)) {
				if (error) {
					logger.outgoing.error(`Error for the Integration "${trigger.name}" to ${url} is:`);
					logger.outgoing.error(error);
				}

				if (result) {
					logger.outgoing.error(`Error for the Integration "${trigger.name}" to ${url} is:`);
					logger.outgoing.error(result);

					if (result.statusCode === 410) {
						this.updateHistory({
							historyId,
							step: 'after-process-http-status-410',
							error: true
						});
						logger.outgoing.error(`Disabling the Integration "${trigger.name}" because the status code was 401 (Gone).`);
						RocketChat.models.Integrations.update({
							_id: trigger._id
						}, {
							$set: {
								enabled: false
							}
						});
						return;
					}

					if (result.statusCode === 500) {
						this.updateHistory({
							historyId,
							step: 'after-process-http-status-500',
							error: true
						});
						logger.outgoing.error(`Error "500" for the Integration "${trigger.name}" to ${url}.`);
						logger.outgoing.error(result.content);
						return;
					}
				}

				if (trigger.retryFailedCalls) {
					if (tries < trigger.retryCount && trigger.retryDelay) {
						this.updateHistory({
							historyId,
							error: true,
							step: `going-to-retry-${tries + 1}`
						});
						let waitTime;

						switch (trigger.retryDelay) {
							case 'powers-of-ten':
								// Try again in 0.1s, 1s, 10s, 1m40s, 16m40s, 2h46m40s, 27h46m40s, etc
								waitTime = Math.pow(10, tries + 2);
								break;

							case 'powers-of-two':
								// 2 seconds, 4 seconds, 8 seconds
								waitTime = Math.pow(2, tries + 1) * 1000;
								break;

							case 'increments-of-two':
								// 2 second, 4 seconds, 6 seconds, etc
								waitTime = (tries + 1) * 2 * 1000;
								break;

							default:
								const er = new Error('The integration\'s retryDelay setting is invalid.');
								this.updateHistory({
									historyId,
									step: 'failed-and-retry-delay-is-invalid',
									error: true,
									errorStack: er.stack
								});
								return;
						}

						logger.outgoing.info(`Trying the Integration ${trigger.name} to ${url} again in ${waitTime} milliseconds.`);
						Meteor.setTimeout(() => {
							this.executeTriggerUrl(url, trigger, {
								event,
								message,
								room,
								owner,
								user
							}, historyId, tries + 1);
						}, waitTime);
					} else {
						this.updateHistory({
							historyId,
							step: 'too-many-retries',
							error: true
						});
					}
				} else {
					this.updateHistory({
						historyId,
						step: 'failed-and-not-configured-to-retry',
						error: true
					});
				}

				return;
			} //process outgoing webhook response as a new message


			if (result && this.successResults.includes(result.statusCode)) {
				if (result && result.data && (result.data.text || result.data.attachments)) {
					const resultMsg = this.sendMessage({
						trigger,
						room,
						message: result.data,
						data
					});
					this.updateHistory({
						historyId,
						step: 'url-response-sent-message',
						resultMessage: resultMsg,
						finished: true
					});
				}
			}
		});
	}

	replay(integration, history) {
		if (!integration || integration.type !== 'webhook-outgoing') {
			throw new Meteor.Error('integration-type-must-be-outgoing', 'The integration type to replay must be an outgoing webhook.');
		}

		if (!history || !history.data) {
			throw new Meteor.Error('history-data-must-be-defined', 'The history data must be defined to replay an integration.');
		}

		const event = history.event;
		const message = RocketChat.models.Messages.findOneById(history.data.message_id);
		const room = RocketChat.models.Rooms.findOneById(history.data.channel_id);
		const user = RocketChat.models.Users.findOneById(history.data.user_id);
		let owner;

		if (history.data.owner && history.data.owner._id) {
			owner = RocketChat.models.Users.findOneById(history.data.owner._id);
		}

		this.executeTriggerUrl(history.url, integration, {
			event,
			message,
			room,
			owner,
			user
		});
	}

}();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"Integrations.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/models/Integrations.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.models.Integrations = new class Integrations extends RocketChat.models._Base {
	constructor() {
		super('integrations');
	}

	findByType(type, options) {
		if (type !== 'webhook-incoming' && type !== 'webhook-outgoing') {
			throw new Meteor.Error('invalid-type-to-find');
		}

		return this.find({
			type
		}, options);
	}

	disableByUserId(userId) {
		return this.update({
			userId
		}, {
			$set: {
				enabled: false
			}
		}, {
			multi: true
		});
	}

}();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"IntegrationHistory.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/models/IntegrationHistory.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.models.IntegrationHistory = new class IntegrationHistory extends RocketChat.models._Base {
	constructor() {
		super('integration_history');
	}

	findByType(type, options) {
		if (type !== 'outgoing-webhook' || type !== 'incoming-webhook') {
			throw new Meteor.Error('invalid-integration-type');
		}

		return this.find({
			type
		}, options);
	}

	findByIntegrationId(id, options) {
		return this.find({
			'integration._id': id
		}, options);
	}

	findByIntegrationIdAndCreatedBy(id, creatorId, options) {
		return this.find({
			'integration._id': id,
			'integration._createdBy._id': creatorId
		}, options);
	}

	findOneByIntegrationIdAndHistoryId(integrationId, historyId) {
		return this.findOne({
			'integration._id': integrationId,
			_id: historyId
		});
	}

	findByEventName(event, options) {
		return this.find({
			event
		}, options);
	}

	findFailed(options) {
		return this.find({
			error: true
		}, options);
	}

	removeByIntegrationId(integrationId) {
		return this.remove({
			'integration._id': integrationId
		});
	}

}();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"publications":{"integrations.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/publications/integrations.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('integrations', function _integrationPublication() {
	if (!this.userId) {
		return this.ready();
	}

	if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
		return RocketChat.models.Integrations.find();
	} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations')) {
		return RocketChat.models.Integrations.find({
			'_createdBy._id': this.userId
		});
	} else {
		throw new Meteor.Error('not-authorized');
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"integrationHistory.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/publications/integrationHistory.js                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('integrationHistory', function _integrationHistoryPublication(integrationId, limit = 25) {
	if (!this.userId) {
		return this.ready();
	}

	if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
		return RocketChat.models.IntegrationHistory.findByIntegrationId(integrationId, {
			sort: {
				_updatedAt: -1
			},
			limit
		});
	} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations')) {
		return RocketChat.models.IntegrationHistory.findByIntegrationIdAndCreatedBy(integrationId, this.userId, {
			sort: {
				_updatedAt: -1
			},
			limit
		});
	} else {
		throw new Meteor.Error('not-authorized');
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"incoming":{"addIncomingIntegration.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/incoming/addIncomingIntegration.js                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
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
const validChannelChars = ['@', '#'];
Meteor.methods({
	addIncomingIntegration(integration) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-integrations') && !RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations')) {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'addIncomingIntegration'
			});
		}

		if (!_.isString(integration.channel)) {
			throw new Meteor.Error('error-invalid-channel', 'Invalid channel', {
				method: 'addIncomingIntegration'
			});
		}

		if (integration.channel.trim() === '') {
			throw new Meteor.Error('error-invalid-channel', 'Invalid channel', {
				method: 'addIncomingIntegration'
			});
		}

		const channels = _.map(integration.channel.split(','), channel => s.trim(channel));

		for (const channel of channels) {
			if (!validChannelChars.includes(channel[0])) {
				throw new Meteor.Error('error-invalid-channel-start-with-chars', 'Invalid channel. Start with @ or #', {
					method: 'updateIncomingIntegration'
				});
			}
		}

		if (!_.isString(integration.username) || integration.username.trim() === '') {
			throw new Meteor.Error('error-invalid-username', 'Invalid username', {
				method: 'addIncomingIntegration'
			});
		}

		if (integration.scriptEnabled === true && integration.script && integration.script.trim() !== '') {
			try {
				let babelOptions = Babel.getDefaultOptions({
					runtime: false
				});
				babelOptions = _.extend(babelOptions, {
					compact: true,
					minified: true,
					comments: false
				});
				integration.scriptCompiled = Babel.compile(integration.script, babelOptions).code;
				integration.scriptError = undefined;
			} catch (e) {
				integration.scriptCompiled = undefined;
				integration.scriptError = _.pick(e, 'name', 'message', 'stack');
			}
		}

		for (let channel of channels) {
			let record;
			const channelType = channel[0];
			channel = channel.substr(1);

			switch (channelType) {
				case '#':
					record = RocketChat.models.Rooms.findOne({
						$or: [{
							_id: channel
						}, {
							name: channel
						}]
					});
					break;

				case '@':
					record = RocketChat.models.Users.findOne({
						$or: [{
							_id: channel
						}, {
							username: channel
						}]
					});
					break;
			}

			if (!record) {
				throw new Meteor.Error('error-invalid-room', 'Invalid room', {
					method: 'addIncomingIntegration'
				});
			}

			if (record.usernames && !RocketChat.authz.hasPermission(this.userId, 'manage-integrations') && RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations') && !record.usernames.includes(Meteor.user().username)) {
				throw new Meteor.Error('error-invalid-channel', 'Invalid Channel', {
					method: 'addIncomingIntegration'
				});
			}
		}

		const user = RocketChat.models.Users.findOne({
			username: integration.username
		});

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'addIncomingIntegration'
			});
		}

		const token = Random.id(48);
		integration.type = 'webhook-incoming';
		integration.token = token;
		integration.channel = channels;
		integration.userId = user._id;
		integration._createdAt = new Date();
		integration._createdBy = RocketChat.models.Users.findOne(this.userId, {
			fields: {
				username: 1
			}
		});
		RocketChat.models.Roles.addUserRoles(user._id, 'bot');
		integration._id = RocketChat.models.Integrations.insert(integration);
		return integration;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"updateIncomingIntegration.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/incoming/updateIncomingIntegration.js                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
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
const validChannelChars = ['@', '#'];
Meteor.methods({
	updateIncomingIntegration(integrationId, integration) {
		if (!_.isString(integration.channel) || integration.channel.trim() === '') {
			throw new Meteor.Error('error-invalid-channel', 'Invalid channel', {
				method: 'updateIncomingIntegration'
			});
		}

		const channels = _.map(integration.channel.split(','), channel => s.trim(channel));

		for (const channel of channels) {
			if (!validChannelChars.includes(channel[0])) {
				throw new Meteor.Error('error-invalid-channel-start-with-chars', 'Invalid channel. Start with @ or #', {
					method: 'updateIncomingIntegration'
				});
			}
		}

		let currentIntegration;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			currentIntegration = RocketChat.models.Integrations.findOne(integrationId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations')) {
			currentIntegration = RocketChat.models.Integrations.findOne({
				_id: integrationId,
				'_createdBy._id': this.userId
			});
		} else {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'updateIncomingIntegration'
			});
		}

		if (!currentIntegration) {
			throw new Meteor.Error('error-invalid-integration', 'Invalid integration', {
				method: 'updateIncomingIntegration'
			});
		}

		if (integration.scriptEnabled === true && integration.script && integration.script.trim() !== '') {
			try {
				let babelOptions = Babel.getDefaultOptions({
					runtime: false
				});
				babelOptions = _.extend(babelOptions, {
					compact: true,
					minified: true,
					comments: false
				});
				integration.scriptCompiled = Babel.compile(integration.script, babelOptions).code;
				integration.scriptError = undefined;
			} catch (e) {
				integration.scriptCompiled = undefined;
				integration.scriptError = _.pick(e, 'name', 'message', 'stack');
			}
		}

		for (let channel of channels) {
			const channelType = channel[0];
			channel = channel.substr(1);
			let record;

			switch (channelType) {
				case '#':
					record = RocketChat.models.Rooms.findOne({
						$or: [{
							_id: channel
						}, {
							name: channel
						}]
					});
					break;

				case '@':
					record = RocketChat.models.Users.findOne({
						$or: [{
							_id: channel
						}, {
							username: channel
						}]
					});
					break;
			}

			if (!record) {
				throw new Meteor.Error('error-invalid-room', 'Invalid room', {
					method: 'updateIncomingIntegration'
				});
			}

			if (record.usernames && !RocketChat.authz.hasPermission(this.userId, 'manage-integrations') && RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations') && !record.usernames.includes(Meteor.user().username)) {
				throw new Meteor.Error('error-invalid-channel', 'Invalid Channel', {
					method: 'updateIncomingIntegration'
				});
			}
		}

		const user = RocketChat.models.Users.findOne({
			username: currentIntegration.username
		});

		if (!user || !user._id) {
			throw new Meteor.Error('error-invalid-post-as-user', 'Invalid Post As User', {
				method: 'updateIncomingIntegration'
			});
		}

		RocketChat.models.Roles.addUserRoles(user._id, 'bot');
		RocketChat.models.Integrations.update(integrationId, {
			$set: {
				enabled: integration.enabled,
				name: integration.name,
				avatar: integration.avatar,
				emoji: integration.emoji,
				alias: integration.alias,
				channel: channels,
				script: integration.script,
				scriptEnabled: integration.scriptEnabled,
				scriptCompiled: integration.scriptCompiled,
				scriptError: integration.scriptError,
				_updatedAt: new Date(),
				_updatedBy: RocketChat.models.Users.findOne(this.userId, {
					fields: {
						username: 1
					}
				})
			}
		});
		return RocketChat.models.Integrations.findOne(integrationId);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"deleteIncomingIntegration.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/incoming/deleteIncomingIntegration.js                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	deleteIncomingIntegration(integrationId) {
		let integration;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			integration = RocketChat.models.Integrations.findOne(integrationId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations')) {
			integration = RocketChat.models.Integrations.findOne(integrationId, {
				fields: {
					'_createdBy._id': this.userId
				}
			});
		} else {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'deleteIncomingIntegration'
			});
		}

		if (!integration) {
			throw new Meteor.Error('error-invalid-integration', 'Invalid integration', {
				method: 'deleteIncomingIntegration'
			});
		}

		RocketChat.models.Integrations.remove({
			_id: integrationId
		});
		return true;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"outgoing":{"addOutgoingIntegration.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/outgoing/addOutgoingIntegration.js                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	addOutgoingIntegration(integration) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-integrations') && !RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations') && !RocketChat.authz.hasPermission(this.userId, 'manage-integrations', 'bot') && !RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations', 'bot')) {
			throw new Meteor.Error('not_authorized');
		}

		integration = RocketChat.integrations.validateOutgoing(integration, this.userId);
		integration._createdAt = new Date();
		integration._createdBy = RocketChat.models.Users.findOne(this.userId, {
			fields: {
				username: 1
			}
		});
		integration._id = RocketChat.models.Integrations.insert(integration);
		return integration;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"updateOutgoingIntegration.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/outgoing/updateOutgoingIntegration.js                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	updateOutgoingIntegration(integrationId, integration) {
		integration = RocketChat.integrations.validateOutgoing(integration, this.userId);

		if (!integration.token || integration.token.trim() === '') {
			throw new Meteor.Error('error-invalid-token', 'Invalid token', {
				method: 'updateOutgoingIntegration'
			});
		}

		let currentIntegration;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations')) {
			currentIntegration = RocketChat.models.Integrations.findOne(integrationId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations')) {
			currentIntegration = RocketChat.models.Integrations.findOne({
				_id: integrationId,
				'_createdBy._id': this.userId
			});
		} else {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'updateOutgoingIntegration'
			});
		}

		if (!currentIntegration) {
			throw new Meteor.Error('invalid_integration', '[methods] updateOutgoingIntegration -> integration not found');
		}

		RocketChat.models.Integrations.update(integrationId, {
			$set: {
				event: integration.event,
				enabled: integration.enabled,
				name: integration.name,
				avatar: integration.avatar,
				emoji: integration.emoji,
				alias: integration.alias,
				channel: integration.channel,
				targetRoom: integration.targetRoom,
				impersonateUser: integration.impersonateUser,
				username: integration.username,
				userId: integration.userId,
				urls: integration.urls,
				token: integration.token,
				script: integration.script,
				scriptEnabled: integration.scriptEnabled,
				scriptCompiled: integration.scriptCompiled,
				scriptError: integration.scriptError,
				triggerWords: integration.triggerWords,
				retryFailedCalls: integration.retryFailedCalls,
				retryCount: integration.retryCount,
				retryDelay: integration.retryDelay,
				triggerWordAnywhere: integration.triggerWordAnywhere,
				runOnEdits: integration.runOnEdits,
				_updatedAt: new Date(),
				_updatedBy: RocketChat.models.Users.findOne(this.userId, {
					fields: {
						username: 1
					}
				})
			}
		});
		return RocketChat.models.Integrations.findOne(integrationId);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"replayOutgoingIntegration.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/outgoing/replayOutgoingIntegration.js                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	replayOutgoingIntegration({
		integrationId,
		historyId
	}) {
		let integration;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations') || RocketChat.authz.hasPermission(this.userId, 'manage-integrations', 'bot')) {
			integration = RocketChat.models.Integrations.findOne(integrationId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations') || RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations', 'bot')) {
			integration = RocketChat.models.Integrations.findOne(integrationId, {
				fields: {
					'_createdBy._id': this.userId
				}
			});
		} else {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'replayOutgoingIntegration'
			});
		}

		if (!integration) {
			throw new Meteor.Error('error-invalid-integration', 'Invalid integration', {
				method: 'replayOutgoingIntegration'
			});
		}

		const history = RocketChat.models.IntegrationHistory.findOneByIntegrationIdAndHistoryId(integration._id, historyId);

		if (!history) {
			throw new Meteor.Error('error-invalid-integration-history', 'Invalid Integration History', {
				method: 'replayOutgoingIntegration'
			});
		}

		RocketChat.integrations.triggerHandler.replay(integration, history);
		return true;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"deleteOutgoingIntegration.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/outgoing/deleteOutgoingIntegration.js                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	deleteOutgoingIntegration(integrationId) {
		let integration;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations') || RocketChat.authz.hasPermission(this.userId, 'manage-integrations', 'bot')) {
			integration = RocketChat.models.Integrations.findOne(integrationId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations') || RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations', 'bot')) {
			integration = RocketChat.models.Integrations.findOne(integrationId, {
				fields: {
					'_createdBy._id': this.userId
				}
			});
		} else {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'deleteOutgoingIntegration'
			});
		}

		if (!integration) {
			throw new Meteor.Error('error-invalid-integration', 'Invalid integration', {
				method: 'deleteOutgoingIntegration'
			});
		}

		RocketChat.models.Integrations.remove({
			_id: integrationId
		});
		RocketChat.models.IntegrationHistory.removeByIntegrationId(integrationId);
		return true;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"clearIntegrationHistory.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/methods/clearIntegrationHistory.js                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	clearIntegrationHistory(integrationId) {
		let integration;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-integrations') || RocketChat.authz.hasPermission(this.userId, 'manage-integrations', 'bot')) {
			integration = RocketChat.models.Integrations.findOne(integrationId);
		} else if (RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations') || RocketChat.authz.hasPermission(this.userId, 'manage-own-integrations', 'bot')) {
			integration = RocketChat.models.Integrations.findOne(integrationId, {
				fields: {
					'_createdBy._id': this.userId
				}
			});
		} else {
			throw new Meteor.Error('not_authorized', 'Unauthorized', {
				method: 'clearIntegrationHistory'
			});
		}

		if (!integration) {
			throw new Meteor.Error('error-invalid-integration', 'Invalid integration', {
				method: 'clearIntegrationHistory'
			});
		}

		RocketChat.models.IntegrationHistory.removeByIntegrationId(integrationId);
		return true;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"api":{"api.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/api/api.js                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
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
let vm;
module.watch(require("vm"), {
	default(v) {
		vm = v;
	}

}, 2);
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 3);
const compiledScripts = {};

function buildSandbox(store = {}) {
	const sandbox = {
		_,
		s,
		console,
		moment,
		Livechat: RocketChat.Livechat,
		Store: {
			set(key, val) {
				return store[key] = val;
			},

			get(key) {
				return store[key];
			}

		},

		HTTP(method, url, options) {
			try {
				return {
					result: HTTP.call(method, url, options)
				};
			} catch (error) {
				return {
					error
				};
			}
		}

	};
	Object.keys(RocketChat.models).filter(k => !k.startsWith('_')).forEach(k => sandbox[k] = RocketChat.models[k]);
	return {
		store,
		sandbox
	};
}

function getIntegrationScript(integration) {
	const compiledScript = compiledScripts[integration._id];

	if (compiledScript != null && +compiledScript._updatedAt === +integration._updatedAt) {
		return compiledScript.script;
	}

	const script = integration.scriptCompiled;
	const {
		sandbox,
		store
	} = buildSandbox();

	try {
		logger.incoming.info('Will evaluate script of Trigger', integration.name);
		logger.incoming.debug(script);
		const vmScript = vm.createScript(script, 'script.js');
		vmScript.runInNewContext(sandbox);

		if (sandbox.Script != null) {
			compiledScripts[integration._id] = {
				script: new sandbox.Script(),
				store,
				_updatedAt: integration._updatedAt
			};
			return compiledScripts[integration._id].script;
		}
	} catch ({
		stack
	}) {
		logger.incoming.error('[Error evaluating Script in Trigger', integration.name, ':]');
		logger.incoming.error(script.replace(/^/gm, '  '));
		logger.incoming.error('[Stack:]');
		logger.incoming.error(stack.replace(/^/gm, '  '));
		throw RocketChat.API.v1.failure('error-evaluating-script');
	}

	if (sandbox.Script == null) {
		logger.incoming.error('[Class "Script" not in Trigger', integration.name, ']');
		throw RocketChat.API.v1.failure('class-script-not-found');
	}
}

Api = new Restivus({
	enableCors: true,
	apiPath: 'hooks/',
	auth: {
		user() {
			const payloadKeys = Object.keys(this.bodyParams);
			const payloadIsWrapped = this.bodyParams && this.bodyParams.payload && payloadKeys.length === 1;

			if (payloadIsWrapped && this.request.headers['content-type'] === 'application/x-www-form-urlencoded') {
				try {
					this.bodyParams = JSON.parse(this.bodyParams.payload);
				} catch ({
					message
				}) {
					return {
						error: {
							statusCode: 400,
							body: {
								success: false,
								error: message
							}
						}
					};
				}
			}

			this.integration = RocketChat.models.Integrations.findOne({
				_id: this.request.params.integrationId,
				token: decodeURIComponent(this.request.params.token)
			});

			if (this.integration == null) {
				logger.incoming.info('Invalid integration id', this.request.params.integrationId, 'or token', this.request.params.token);
				return;
			}

			const user = RocketChat.models.Users.findOne({
				_id: this.integration.userId
			});
			return {
				user
			};
		}

	}
});

function createIntegration(options, user) {
	logger.incoming.info('Add integration', options.name);
	logger.incoming.debug(options);
	Meteor.runAsUser(user._id, function () {
		switch (options['event']) {
			case 'newMessageOnChannel':
				if (options.data == null) {
					options.data = {};
				}

				if (options.data.channel_name != null && options.data.channel_name.indexOf('#') === -1) {
					options.data.channel_name = `#${options.data.channel_name}`;
				}

				return Meteor.call('addOutgoingIntegration', {
					username: 'rocket.cat',
					urls: [options.target_url],
					name: options.name,
					channel: options.data.channel_name,
					triggerWords: options.data.trigger_words
				});

			case 'newMessageToUser':
				if (options.data.username.indexOf('@') === -1) {
					options.data.username = `@${options.data.username}`;
				}

				return Meteor.call('addOutgoingIntegration', {
					username: 'rocket.cat',
					urls: [options.target_url],
					name: options.name,
					channel: options.data.username,
					triggerWords: options.data.trigger_words
				});
		}
	});
	return RocketChat.API.v1.success();
}

function removeIntegration(options, user) {
	logger.incoming.info('Remove integration');
	logger.incoming.debug(options);
	const integrationToRemove = RocketChat.models.Integrations.findOne({
		urls: options.target_url
	});
	Meteor.runAsUser(user._id, () => {
		return Meteor.call('deleteOutgoingIntegration', integrationToRemove._id);
	});
	return RocketChat.API.v1.success();
}

function executeIntegrationRest() {
	logger.incoming.info('Post integration:', this.integration.name);
	logger.incoming.debug('@urlParams:', this.urlParams);
	logger.incoming.debug('@bodyParams:', this.bodyParams);

	if (this.integration.enabled !== true) {
		return {
			statusCode: 503,
			body: 'Service Unavailable'
		};
	}

	const defaultValues = {
		channel: this.integration.channel,
		alias: this.integration.alias,
		avatar: this.integration.avatar,
		emoji: this.integration.emoji
	};

	if (this.integration.scriptEnabled === true && this.integration.scriptCompiled && this.integration.scriptCompiled.trim() !== '') {
		let script;

		try {
			script = getIntegrationScript(this.integration);
		} catch (e) {
			logger.incoming.warn(e);
			return RocketChat.API.v1.failure(e.message);
		}

		const request = {
			url: {
				hash: this.request._parsedUrl.hash,
				search: this.request._parsedUrl.search,
				query: this.queryParams,
				pathname: this.request._parsedUrl.pathname,
				path: this.request._parsedUrl.path
			},
			url_raw: this.request.url,
			url_params: this.urlParams,
			content: this.bodyParams,
			content_raw: this.request._readableState && this.request._readableState.buffer && this.request._readableState.buffer.toString(),
			headers: this.request.headers,
			user: {
				_id: this.user._id,
				name: this.user.name,
				username: this.user.username
			}
		};

		try {
			const {
				sandbox
			} = buildSandbox(compiledScripts[this.integration._id].store);
			sandbox.script = script;
			sandbox.request = request;
			const result = vm.runInNewContext('script.process_incoming_request({ request: request })', sandbox, {
				timeout: 3000
			});

			if (!result) {
				logger.incoming.debug('[Process Incoming Request result of Trigger', this.integration.name, ':] No data');
				return RocketChat.API.v1.success();
			} else if (result && result.error) {
				return RocketChat.API.v1.failure(result.error);
			}

			this.bodyParams = result && result.content;
			this.scriptResponse = result.response;

			if (result.user) {
				this.user = result.user;
			}

			logger.incoming.debug('[Process Incoming Request result of Trigger', this.integration.name, ':]');
			logger.incoming.debug('result', this.bodyParams);
		} catch ({
			stack
		}) {
			logger.incoming.error('[Error running Script in Trigger', this.integration.name, ':]');
			logger.incoming.error(this.integration.scriptCompiled.replace(/^/gm, '  '));
			logger.incoming.error('[Stack:]');
			logger.incoming.error(stack.replace(/^/gm, '  '));
			return RocketChat.API.v1.failure('error-running-script');
		}
	} // TODO: Turn this into an option on the integrations - no body means a success
	// TODO: Temporary fix for https://github.com/RocketChat/Rocket.Chat/issues/7770 until the above is implemented


	if (!this.bodyParams) {
		// return RocketChat.API.v1.failure('body-empty');
		return RocketChat.API.v1.success();
	}

	this.bodyParams.bot = {
		i: this.integration._id
	};

	try {
		const message = processWebhookMessage(this.bodyParams, this.user, defaultValues);

		if (_.isEmpty(message)) {
			return RocketChat.API.v1.failure('unknown-error');
		}

		if (this.scriptResponse) {
			logger.incoming.debug('response', this.scriptResponse);
		}

		return RocketChat.API.v1.success(this.scriptResponse);
	} catch ({
		error
	}) {
		return RocketChat.API.v1.failure(error);
	}
}

function addIntegrationRest() {
	return createIntegration(this.bodyParams, this.user);
}

function removeIntegrationRest() {
	return removeIntegration(this.bodyParams, this.user);
}

function integrationSampleRest() {
	logger.incoming.info('Sample Integration');
	return {
		statusCode: 200,
		body: [{
			token: Random.id(24),
			channel_id: Random.id(),
			channel_name: 'general',
			timestamp: new Date(),
			user_id: Random.id(),
			user_name: 'rocket.cat',
			text: 'Sample text 1',
			trigger_word: 'Sample'
		}, {
			token: Random.id(24),
			channel_id: Random.id(),
			channel_name: 'general',
			timestamp: new Date(),
			user_id: Random.id(),
			user_name: 'rocket.cat',
			text: 'Sample text 2',
			trigger_word: 'Sample'
		}, {
			token: Random.id(24),
			channel_id: Random.id(),
			channel_name: 'general',
			timestamp: new Date(),
			user_id: Random.id(),
			user_name: 'rocket.cat',
			text: 'Sample text 3',
			trigger_word: 'Sample'
		}]
	};
}

function integrationInfoRest() {
	logger.incoming.info('Info integration');
	return {
		statusCode: 200,
		body: {
			success: true
		}
	};
}

Api.addRoute(':integrationId/:userId/:token', {
	authRequired: true
}, {
	post: executeIntegrationRest,
	get: executeIntegrationRest
});
Api.addRoute(':integrationId/:token', {
	authRequired: true
}, {
	post: executeIntegrationRest,
	get: executeIntegrationRest
});
Api.addRoute('sample/:integrationId/:userId/:token', {
	authRequired: true
}, {
	get: integrationSampleRest
});
Api.addRoute('sample/:integrationId/:token', {
	authRequired: true
}, {
	get: integrationSampleRest
});
Api.addRoute('info/:integrationId/:userId/:token', {
	authRequired: true
}, {
	get: integrationInfoRest
});
Api.addRoute('info/:integrationId/:token', {
	authRequired: true
}, {
	get: integrationInfoRest
});
Api.addRoute('add/:integrationId/:userId/:token', {
	authRequired: true
}, {
	post: addIntegrationRest
});
Api.addRoute('add/:integrationId/:token', {
	authRequired: true
}, {
	post: addIntegrationRest
});
Api.addRoute('remove/:integrationId/:userId/:token', {
	authRequired: true
}, {
	post: removeIntegrationRest
});
Api.addRoute('remove/:integrationId/:token', {
	authRequired: true
}, {
	post: removeIntegrationRest
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"triggers.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/triggers.js                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
const callbackHandler = function _callbackHandler(eventType) {
	return function _wrapperFunction() {
		return RocketChat.integrations.triggerHandler.executeTriggers(eventType, ...arguments);
	};
};

RocketChat.callbacks.add('afterSaveMessage', callbackHandler('sendMessage'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterCreateChannel', callbackHandler('roomCreated'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterCreatePrivateGroup', callbackHandler('roomCreated'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterCreateUser', callbackHandler('userCreated'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterJoinRoom', callbackHandler('roomJoined'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterLeaveRoom', callbackHandler('roomLeft'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterRoomArchived', callbackHandler('roomArchived'), RocketChat.callbacks.priority.LOW);
RocketChat.callbacks.add('afterFileUpload', callbackHandler('fileUploaded'), RocketChat.callbacks.priority.LOW);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"processWebhookMessage.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_integrations/server/processWebhookMessage.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
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

this.processWebhookMessage = function (messageObj, user, defaultValues = {
	channel: '',
	alias: '',
	avatar: '',
	emoji: ''
}, mustBeJoined = false) {
	const sentData = [];
	const channels = [].concat(messageObj.channel || messageObj.roomId || defaultValues.channel);

	for (const channel of channels) {
		const channelType = channel[0];
		let channelValue = channel.substr(1);
		let room;

		switch (channelType) {
			case '#':
				room = RocketChat.getRoomByNameOrIdWithOptionToJoin({
					currentUserId: user._id,
					nameOrId: channelValue,
					joinChannel: true
				});
				break;

			case '@':
				room = RocketChat.getRoomByNameOrIdWithOptionToJoin({
					currentUserId: user._id,
					nameOrId: channelValue,
					type: 'd'
				});
				break;

			default:
				channelValue = channelType + channelValue; //Try to find the room by id or name if they didn't include the prefix.

				room = RocketChat.getRoomByNameOrIdWithOptionToJoin({
					currentUserId: user._id,
					nameOrId: channelValue,
					joinChannel: true,
					errorOnEmpty: false
				});

				if (room) {
					break;
				} //We didn't get a room, let's try finding direct messages


				room = RocketChat.getRoomByNameOrIdWithOptionToJoin({
					currentUserId: user._id,
					nameOrId: channelValue,
					type: 'd',
					tryDirectByUserIdOnly: true
				});

				if (room) {
					break;
				} //No room, so throw an error


				throw new Meteor.Error('invalid-channel');
		}

		if (mustBeJoined && !room.usernames.includes(user.username)) {
			// throw new Meteor.Error('invalid-room', 'Invalid room provided to send a message to, must be joined.');
			throw new Meteor.Error('invalid-channel'); // Throwing the generic one so people can't "brute force" find rooms
		}

		if (messageObj.attachments && !_.isArray(messageObj.attachments)) {
			console.log('Attachments should be Array, ignoring value'.red, messageObj.attachments);
			messageObj.attachments = undefined;
		}

		const message = {
			alias: messageObj.username || messageObj.alias || defaultValues.alias,
			msg: s.trim(messageObj.text || messageObj.msg || ''),
			attachments: messageObj.attachments,
			parseUrls: messageObj.parseUrls !== undefined ? messageObj.parseUrls : !messageObj.attachments,
			bot: messageObj.bot,
			groupable: messageObj.groupable !== undefined ? messageObj.groupable : false
		};

		if (!_.isEmpty(messageObj.icon_url) || !_.isEmpty(messageObj.avatar)) {
			message.avatar = messageObj.icon_url || messageObj.avatar;
		} else if (!_.isEmpty(messageObj.icon_emoji) || !_.isEmpty(messageObj.emoji)) {
			message.emoji = messageObj.icon_emoji || messageObj.emoji;
		} else if (!_.isEmpty(defaultValues.avatar)) {
			message.avatar = defaultValues.avatar;
		} else if (!_.isEmpty(defaultValues.emoji)) {
			message.emoji = defaultValues.emoji;
		}

		if (_.isArray(message.attachments)) {
			for (let i = 0; i < message.attachments.length; i++) {
				const attachment = message.attachments[i];

				if (attachment.msg) {
					attachment.text = s.trim(attachment.msg);
					delete attachment.msg;
				}
			}
		}

		const messageReturn = RocketChat.sendMessage(user, message, room);
		sentData.push({
			channel,
			message: messageReturn
		});
	}

	return sentData;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:integrations/lib/rocketchat.js");
require("./node_modules/meteor/rocketchat:integrations/server/logger.js");
require("./node_modules/meteor/rocketchat:integrations/server/lib/validation.js");
require("./node_modules/meteor/rocketchat:integrations/server/models/Integrations.js");
require("./node_modules/meteor/rocketchat:integrations/server/models/IntegrationHistory.js");
require("./node_modules/meteor/rocketchat:integrations/server/publications/integrations.js");
require("./node_modules/meteor/rocketchat:integrations/server/publications/integrationHistory.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/incoming/addIncomingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/incoming/updateIncomingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/incoming/deleteIncomingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/outgoing/addOutgoingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/outgoing/updateOutgoingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/outgoing/replayOutgoingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/outgoing/deleteOutgoingIntegration.js");
require("./node_modules/meteor/rocketchat:integrations/server/methods/clearIntegrationHistory.js");
require("./node_modules/meteor/rocketchat:integrations/server/api/api.js");
require("./node_modules/meteor/rocketchat:integrations/server/lib/triggerHandler.js");
require("./node_modules/meteor/rocketchat:integrations/server/triggers.js");
require("./node_modules/meteor/rocketchat:integrations/server/processWebhookMessage.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:integrations'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_integrations.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlZ3JhdGlvbnMvbGliL3JvY2tldGNoYXQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9sb2dnZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9saWIvdmFsaWRhdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlZ3JhdGlvbnMvc2VydmVyL2xpYi90cmlnZ2VySGFuZGxlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlZ3JhdGlvbnMvc2VydmVyL21vZGVscy9JbnRlZ3JhdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tb2RlbHMvSW50ZWdyYXRpb25IaXN0b3J5LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmludGVncmF0aW9ucy9zZXJ2ZXIvcHVibGljYXRpb25zL2ludGVncmF0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlZ3JhdGlvbnMvc2VydmVyL3B1YmxpY2F0aW9ucy9pbnRlZ3JhdGlvbkhpc3RvcnkuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL2luY29taW5nL2FkZEluY29taW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL2luY29taW5nL3VwZGF0ZUluY29taW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL2luY29taW5nL2RlbGV0ZUluY29taW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL291dGdvaW5nL2FkZE91dGdvaW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL291dGdvaW5nL3VwZGF0ZU91dGdvaW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL291dGdvaW5nL3JlcGxheU91dGdvaW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL291dGdvaW5nL2RlbGV0ZU91dGdvaW5nSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW50ZWdyYXRpb25zL3NlcnZlci9tZXRob2RzL2NsZWFySW50ZWdyYXRpb25IaXN0b3J5LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmludGVncmF0aW9ucy9zZXJ2ZXIvYXBpL2FwaS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbnRlZ3JhdGlvbnMvc2VydmVyL3RyaWdnZXJzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmludGVncmF0aW9ucy9zZXJ2ZXIvcHJvY2Vzc1dlYmhvb2tNZXNzYWdlLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJpbnRlZ3JhdGlvbnMiLCJvdXRnb2luZ0V2ZW50cyIsInNlbmRNZXNzYWdlIiwibGFiZWwiLCJ2YWx1ZSIsInVzZSIsImNoYW5uZWwiLCJ0cmlnZ2VyV29yZHMiLCJ0YXJnZXRSb29tIiwiZmlsZVVwbG9hZGVkIiwicm9vbUFyY2hpdmVkIiwicm9vbUNyZWF0ZWQiLCJyb29tSm9pbmVkIiwicm9vbUxlZnQiLCJ1c2VyQ3JlYXRlZCIsImxvZ2dlciIsIkxvZ2dlciIsInNlY3Rpb25zIiwiaW5jb21pbmciLCJvdXRnb2luZyIsIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsInMiLCJzY29wZWRDaGFubmVscyIsInZhbGlkQ2hhbm5lbENoYXJzIiwiX3ZlcmlmeVJlcXVpcmVkRmllbGRzIiwiaW50ZWdyYXRpb24iLCJldmVudCIsIk1hdGNoIiwidGVzdCIsIlN0cmluZyIsInRyaW0iLCJNZXRlb3IiLCJFcnJvciIsImZ1bmN0aW9uIiwidXNlcm5hbWUiLCJ1cmxzIiwiaW5kZXgiLCJ1cmwiLCJlbnRyaWVzIiwid2l0aG91dCIsInVuZGVmaW5lZCIsImxlbmd0aCIsIl92ZXJpZnlVc2VySGFzUGVybWlzc2lvbkZvckNoYW5uZWxzIiwidXNlcklkIiwiY2hhbm5lbHMiLCJpbmNsdWRlcyIsImF1dGh6IiwiaGFzUGVybWlzc2lvbiIsInJlY29yZCIsImNoYW5uZWxUeXBlIiwic3Vic3RyIiwibW9kZWxzIiwiUm9vbXMiLCJmaW5kT25lIiwiJG9yIiwiX2lkIiwibmFtZSIsIlVzZXJzIiwidXNlcm5hbWVzIiwidXNlciIsIl92ZXJpZnlSZXRyeUluZm9ybWF0aW9uIiwicmV0cnlGYWlsZWRDYWxscyIsInJldHJ5Q291bnQiLCJwYXJzZUludCIsInJldHJ5RGVsYXkiLCJ0b0xvd2VyQ2FzZSIsInZhbGlkYXRlT3V0Z29pbmciLCJfdmFsaWRhdGVPdXRnb2luZyIsIm1hcCIsInNwbGl0IiwiZm9yRWFjaCIsIndvcmQiLCJzY3JpcHRFbmFibGVkIiwic2NyaXB0IiwiYmFiZWxPcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwiQmFiZWwiLCJnZXREZWZhdWx0T3B0aW9ucyIsInJ1bnRpbWUiLCJjb21wYWN0IiwibWluaWZpZWQiLCJjb21tZW50cyIsInNjcmlwdENvbXBpbGVkIiwiY29tcGlsZSIsImNvZGUiLCJzY3JpcHRFcnJvciIsImUiLCJwaWNrIiwicnVuT25FZGl0cyIsInR5cGUiLCJtb21lbnQiLCJ0cmlnZ2VySGFuZGxlciIsIlJvY2tldENoYXRJbnRlZ3JhdGlvbkhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsInZtIiwiTnBtIiwic3VjY2Vzc1Jlc3VsdHMiLCJjb21waWxlZFNjcmlwdHMiLCJ0cmlnZ2VycyIsIkludGVncmF0aW9ucyIsImZpbmQiLCJvYnNlcnZlIiwiYWRkZWQiLCJhZGRJbnRlZ3JhdGlvbiIsImNoYW5nZWQiLCJyZW1vdmVJbnRlZ3JhdGlvbiIsInJlbW92ZWQiLCJkZWJ1ZyIsImlzRW1wdHkiLCJjb25jYXQiLCJ0cmlnZ2VyIiwidmFsdWVzIiwiaXNUcmlnZ2VyRW5hYmxlZCIsInRyaWciLCJlbmFibGVkIiwidXBkYXRlSGlzdG9yeSIsImhpc3RvcnlJZCIsInN0ZXAiLCJkYXRhIiwidHJpZ2dlcldvcmQiLCJyYW5QcmVwYXJlU2NyaXB0IiwicHJlcGFyZVNlbnRNZXNzYWdlIiwicHJvY2Vzc1NlbnRNZXNzYWdlIiwicmVzdWx0TWVzc2FnZSIsImZpbmlzaGVkIiwiaHR0cENhbGxEYXRhIiwiaHR0cEVycm9yIiwiaHR0cFJlc3VsdCIsImVycm9yIiwiZXJyb3JTdGFjayIsImhpc3RvcnkiLCJvbWl0Iiwicm9vbSIsIkpTT04iLCJzdHJpbmdpZnkiLCJJbnRlZ3JhdGlvbkhpc3RvcnkiLCJ1cGRhdGUiLCIkc2V0IiwiX2NyZWF0ZWRBdCIsIkRhdGUiLCJpbnNlcnQiLCJSYW5kb20iLCJpZCIsIm5hbWVPcklkIiwibWVzc2FnZSIsImltcGVyc29uYXRlVXNlciIsImZpbmRPbmVCeVVzZXJuYW1lIiwidXNlcl9uYW1lIiwidG1wUm9vbSIsImdldFJvb21CeU5hbWVPcklkV2l0aE9wdGlvblRvSm9pbiIsImN1cnJlbnRVc2VySWQiLCJlcnJvck9uRW1wdHkiLCJ3YXJuIiwidCIsImJvdCIsImkiLCJkZWZhdWx0VmFsdWVzIiwiYWxpYXMiLCJhdmF0YXIiLCJlbW9qaSIsInByb2Nlc3NXZWJob29rTWVzc2FnZSIsImJ1aWxkU2FuZGJveCIsInN0b3JlIiwic2FuZGJveCIsImNvbnNvbGUiLCJTdG9yZSIsInNldCIsImtleSIsInZhbCIsImdldCIsIkhUVFAiLCJtZXRob2QiLCJvcHRpb25zIiwicmVzdWx0IiwiY2FsbCIsImtleXMiLCJmaWx0ZXIiLCJrIiwic3RhcnRzV2l0aCIsImdldEludGVncmF0aW9uU2NyaXB0IiwiY29tcGlsZWRTY3JpcHQiLCJfdXBkYXRlZEF0Iiwidm1TY3JpcHQiLCJpbmZvIiwiY3JlYXRlU2NyaXB0IiwicnVuSW5OZXdDb250ZXh0IiwiU2NyaXB0IiwicmVwbGFjZSIsInN0YWNrIiwiaGFzU2NyaXB0QW5kTWV0aG9kIiwiZXhlY3V0ZVNjcmlwdCIsInBhcmFtcyIsInRpbWVvdXQiLCJldmVudE5hbWVBcmd1bWVudHNUb09iamVjdCIsImFyZ09iamVjdCIsImFyZ3VtZW50cyIsImFyZ2hoaCIsIm93bmVyIiwibWFwRXZlbnRBcmdzVG9EYXRhIiwiY2hhbm5lbF9pZCIsImNoYW5uZWxfbmFtZSIsIm1lc3NhZ2VfaWQiLCJ0aW1lc3RhbXAiLCJ0cyIsInVzZXJfaWQiLCJ1IiwidGV4dCIsIm1zZyIsImVkaXRlZEF0IiwiaXNFZGl0ZWQiLCJjcmVhdGVkQXQiLCJleGVjdXRlVHJpZ2dlcnMiLCJ0cmlnZ2Vyc1RvRXhlY3V0ZSIsInB1c2giLCJhbGxfZGlyZWN0X21lc3NhZ2VzIiwiYWxsX3B1YmxpY19jaGFubmVscyIsImFsbF9wcml2YXRlX2dyb3VwcyIsIl9fYW55IiwidHJpZ2dlclRvRXhlY3V0ZSIsImV4ZWN1dGVUcmlnZ2VyIiwiZXhlY3V0ZVRyaWdnZXJVcmwiLCJ0aGVIaXN0b3J5SWQiLCJ0cmllcyIsInRyaWdnZXJXb3JkQW55d2hlcmUiLCJpbmRleE9mIiwidG9rZW4iLCJ0cmlnZ2VyX3dvcmQiLCJvcHRzIiwiYXV0aCIsIm5wbVJlcXVlc3RPcHRpb25zIiwicmVqZWN0VW5hdXRob3JpemVkIiwic2V0dGluZ3MiLCJzdHJpY3RTU0wiLCJoZWFkZXJzIiwicmVxdWVzdCIsInByZXBhcmVNZXNzYWdlIiwic3RhdHVzQ29kZSIsInJlc3BvbnNlIiwic3RhdHVzX2NvZGUiLCJjb250ZW50IiwiY29udGVudF9yYXciLCJzY3JpcHRSZXN1bHQiLCJ3YWl0VGltZSIsIk1hdGgiLCJwb3ciLCJlciIsInNldFRpbWVvdXQiLCJhdHRhY2htZW50cyIsInJlc3VsdE1zZyIsInJlcGxheSIsIk1lc3NhZ2VzIiwiZmluZE9uZUJ5SWQiLCJfQmFzZSIsImZpbmRCeVR5cGUiLCJkaXNhYmxlQnlVc2VySWQiLCJtdWx0aSIsImZpbmRCeUludGVncmF0aW9uSWQiLCJmaW5kQnlJbnRlZ3JhdGlvbklkQW5kQ3JlYXRlZEJ5IiwiY3JlYXRvcklkIiwiZmluZE9uZUJ5SW50ZWdyYXRpb25JZEFuZEhpc3RvcnlJZCIsImludGVncmF0aW9uSWQiLCJmaW5kQnlFdmVudE5hbWUiLCJmaW5kRmFpbGVkIiwicmVtb3ZlQnlJbnRlZ3JhdGlvbklkIiwicmVtb3ZlIiwicHVibGlzaCIsIl9pbnRlZ3JhdGlvblB1YmxpY2F0aW9uIiwicmVhZHkiLCJfaW50ZWdyYXRpb25IaXN0b3J5UHVibGljYXRpb24iLCJsaW1pdCIsInNvcnQiLCJtZXRob2RzIiwiYWRkSW5jb21pbmdJbnRlZ3JhdGlvbiIsImlzU3RyaW5nIiwiZXh0ZW5kIiwiX2NyZWF0ZWRCeSIsImZpZWxkcyIsIlJvbGVzIiwiYWRkVXNlclJvbGVzIiwidXBkYXRlSW5jb21pbmdJbnRlZ3JhdGlvbiIsImN1cnJlbnRJbnRlZ3JhdGlvbiIsIl91cGRhdGVkQnkiLCJkZWxldGVJbmNvbWluZ0ludGVncmF0aW9uIiwiYWRkT3V0Z29pbmdJbnRlZ3JhdGlvbiIsInVwZGF0ZU91dGdvaW5nSW50ZWdyYXRpb24iLCJyZXBsYXlPdXRnb2luZ0ludGVncmF0aW9uIiwiZGVsZXRlT3V0Z29pbmdJbnRlZ3JhdGlvbiIsImNsZWFySW50ZWdyYXRpb25IaXN0b3J5IiwiTGl2ZWNoYXQiLCJBUEkiLCJ2MSIsImZhaWx1cmUiLCJBcGkiLCJSZXN0aXZ1cyIsImVuYWJsZUNvcnMiLCJhcGlQYXRoIiwicGF5bG9hZEtleXMiLCJib2R5UGFyYW1zIiwicGF5bG9hZElzV3JhcHBlZCIsInBheWxvYWQiLCJwYXJzZSIsImJvZHkiLCJzdWNjZXNzIiwiZGVjb2RlVVJJQ29tcG9uZW50IiwiY3JlYXRlSW50ZWdyYXRpb24iLCJydW5Bc1VzZXIiLCJ0YXJnZXRfdXJsIiwidHJpZ2dlcl93b3JkcyIsImludGVncmF0aW9uVG9SZW1vdmUiLCJleGVjdXRlSW50ZWdyYXRpb25SZXN0IiwidXJsUGFyYW1zIiwiaGFzaCIsIl9wYXJzZWRVcmwiLCJzZWFyY2giLCJxdWVyeSIsInF1ZXJ5UGFyYW1zIiwicGF0aG5hbWUiLCJwYXRoIiwidXJsX3JhdyIsInVybF9wYXJhbXMiLCJfcmVhZGFibGVTdGF0ZSIsImJ1ZmZlciIsInRvU3RyaW5nIiwic2NyaXB0UmVzcG9uc2UiLCJhZGRJbnRlZ3JhdGlvblJlc3QiLCJyZW1vdmVJbnRlZ3JhdGlvblJlc3QiLCJpbnRlZ3JhdGlvblNhbXBsZVJlc3QiLCJpbnRlZ3JhdGlvbkluZm9SZXN0IiwiYWRkUm91dGUiLCJhdXRoUmVxdWlyZWQiLCJwb3N0IiwiY2FsbGJhY2tIYW5kbGVyIiwiX2NhbGxiYWNrSGFuZGxlciIsImV2ZW50VHlwZSIsIl93cmFwcGVyRnVuY3Rpb24iLCJjYWxsYmFja3MiLCJhZGQiLCJwcmlvcml0eSIsIkxPVyIsIm1lc3NhZ2VPYmoiLCJtdXN0QmVKb2luZWQiLCJzZW50RGF0YSIsInJvb21JZCIsImNoYW5uZWxWYWx1ZSIsImpvaW5DaGFubmVsIiwidHJ5RGlyZWN0QnlVc2VySWRPbmx5IiwiaXNBcnJheSIsImxvZyIsInJlZCIsInBhcnNlVXJscyIsImdyb3VwYWJsZSIsImljb25fdXJsIiwiaWNvbl9lbW9qaSIsImF0dGFjaG1lbnQiLCJtZXNzYWdlUmV0dXJuIl0sIm1h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RCxFQUFxRDtBQUNwRCxVQUFNc00sYUFBYWpOLFFBQVF1RyxXQUFSLENBQW9CNUYsQ0FBcEIsQ0FBbkI7O0FBQ0EsUUFBSXNNLFdBQVdsSixHQUFmLEVBQW9CO0FBQ25Ca0osZ0JBQVduSixJQUFYLEdBQWtCMUwsRUFBRVMsSUFBRixDQUFPb1UsV0FBV2xKLEdBQWxCLENBQWxCO0FBQ0EsWUFBT2tKLFdBQVdsSixHQUFsQjtBQUNBO0FBQ0Q7QUFDRDs7QUFFRCxRQUFNbUosZ0JBQWdCelcsV0FBV0csV0FBWCxDQUF1QjhELElBQXZCLEVBQTZCc0YsT0FBN0IsRUFBc0NaLElBQXRDLENBQXRCO0FBQ0FpTixXQUFTaEksSUFBVCxDQUFjO0FBQUVyTixVQUFGO0FBQVdnSixZQUFTa047QUFBcEIsR0FBZDtBQUNBOztBQUVELFFBQU9iLFFBQVA7QUFDQSxDQWhGRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2ludGVncmF0aW9ucy5qcyIsInNvdXJjZXNDb250ZW50IjpbIlJvY2tldENoYXQuaW50ZWdyYXRpb25zID0ge1xuXHRvdXRnb2luZ0V2ZW50czoge1xuXHRcdHNlbmRNZXNzYWdlOiB7XG5cdFx0XHRsYWJlbDogJ0ludGVncmF0aW9uc19PdXRnb2luZ19UeXBlX1NlbmRNZXNzYWdlJyxcblx0XHRcdHZhbHVlOiAnc2VuZE1lc3NhZ2UnLFxuXHRcdFx0dXNlOiB7XG5cdFx0XHRcdGNoYW5uZWw6IHRydWUsXG5cdFx0XHRcdHRyaWdnZXJXb3JkczogdHJ1ZSxcblx0XHRcdFx0dGFyZ2V0Um9vbTogZmFsc2Vcblx0XHRcdH1cblx0XHR9LFxuXHRcdGZpbGVVcGxvYWRlZDoge1xuXHRcdFx0bGFiZWw6ICdJbnRlZ3JhdGlvbnNfT3V0Z29pbmdfVHlwZV9GaWxlVXBsb2FkZWQnLFxuXHRcdFx0dmFsdWU6ICdmaWxlVXBsb2FkZWQnLFxuXHRcdFx0dXNlOiB7XG5cdFx0XHRcdGNoYW5uZWw6IHRydWUsXG5cdFx0XHRcdHRyaWdnZXJXb3JkczogZmFsc2UsXG5cdFx0XHRcdHRhcmdldFJvb206IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRyb29tQXJjaGl2ZWQ6IHtcblx0XHRcdGxhYmVsOiAnSW50ZWdyYXRpb25zX091dGdvaW5nX1R5cGVfUm9vbUFyY2hpdmVkJyxcblx0XHRcdHZhbHVlOiAncm9vbUFyY2hpdmVkJyxcblx0XHRcdHVzZToge1xuXHRcdFx0XHRjaGFubmVsOiBmYWxzZSxcblx0XHRcdFx0dHJpZ2dlcldvcmRzOiBmYWxzZSxcblx0XHRcdFx0dGFyZ2V0Um9vbTogZmFsc2Vcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJvb21DcmVhdGVkOiB7XG5cdFx0XHRsYWJlbDogJ0ludGVncmF0aW9uc19PdXRnb2luZ19UeXBlX1Jvb21DcmVhdGVkJyxcblx0XHRcdHZhbHVlOiAncm9vbUNyZWF0ZWQnLFxuXHRcdFx0dXNlOiB7XG5cdFx0XHRcdGNoYW5uZWw6IGZhbHNlLFxuXHRcdFx0XHR0cmlnZ2VyV29yZHM6IGZhbHNlLFxuXHRcdFx0XHR0YXJnZXRSb29tOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cm9vbUpvaW5lZDoge1xuXHRcdFx0bGFiZWw6ICdJbnRlZ3JhdGlvbnNfT3V0Z29pbmdfVHlwZV9Sb29tSm9pbmVkJyxcblx0XHRcdHZhbHVlOiAncm9vbUpvaW5lZCcsXG5cdFx0XHR1c2U6IHtcblx0XHRcdFx0Y2hhbm5lbDogdHJ1ZSxcblx0XHRcdFx0dHJpZ2dlcldvcmRzOiBmYWxzZSxcblx0XHRcdFx0dGFyZ2V0Um9vbTogZmFsc2Vcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJvb21MZWZ0OiB7XG5cdFx0XHRsYWJlbDogJ0ludGVncmF0aW9uc19PdXRnb2luZ19UeXBlX1Jvb21MZWZ0Jyxcblx0XHRcdHZhbHVlOiAncm9vbUxlZnQnLFxuXHRcdFx0dXNlOiB7XG5cdFx0XHRcdGNoYW5uZWw6IHRydWUsXG5cdFx0XHRcdHRyaWdnZXJXb3JkczogZmFsc2UsXG5cdFx0XHRcdHRhcmdldFJvb206IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSxcblx0XHR1c2VyQ3JlYXRlZDoge1xuXHRcdFx0bGFiZWw6ICdJbnRlZ3JhdGlvbnNfT3V0Z29pbmdfVHlwZV9Vc2VyQ3JlYXRlZCcsXG5cdFx0XHR2YWx1ZTogJ3VzZXJDcmVhdGVkJyxcblx0XHRcdHVzZToge1xuXHRcdFx0XHRjaGFubmVsOiBmYWxzZSxcblx0XHRcdFx0dHJpZ2dlcldvcmRzOiBmYWxzZSxcblx0XHRcdFx0dGFyZ2V0Um9vbTogdHJ1ZVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTtcbiIsIi8qIGdsb2JhbHMgbG9nZ2VyOnRydWUgKi9cbi8qIGV4cG9ydGVkIGxvZ2dlciAqL1xuXG5sb2dnZXIgPSBuZXcgTG9nZ2VyKCdJbnRlZ3JhdGlvbnMnLCB7XG5cdHNlY3Rpb25zOiB7XG5cdFx0aW5jb21pbmc6ICdJbmNvbWluZyBXZWJIb29rJyxcblx0XHRvdXRnb2luZzogJ091dGdvaW5nIFdlYkhvb2snXG5cdH1cbn0pO1xuIiwiLyogZ2xvYmFsIEJhYmVsICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcbmNvbnN0IHNjb3BlZENoYW5uZWxzID0gWydhbGxfcHVibGljX2NoYW5uZWxzJywgJ2FsbF9wcml2YXRlX2dyb3VwcycsICdhbGxfZGlyZWN0X21lc3NhZ2VzJ107XG5jb25zdCB2YWxpZENoYW5uZWxDaGFycyA9IFsnQCcsICcjJ107XG5cbmZ1bmN0aW9uIF92ZXJpZnlSZXF1aXJlZEZpZWxkcyhpbnRlZ3JhdGlvbikge1xuXHRpZiAoIWludGVncmF0aW9uLmV2ZW50IHx8ICFNYXRjaC50ZXN0KGludGVncmF0aW9uLmV2ZW50LCBTdHJpbmcpIHx8IGludGVncmF0aW9uLmV2ZW50LnRyaW0oKSA9PT0gJycgfHwgIVJvY2tldENoYXQuaW50ZWdyYXRpb25zLm91dGdvaW5nRXZlbnRzW2ludGVncmF0aW9uLmV2ZW50XSkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtZXZlbnQtdHlwZScsICdJbnZhbGlkIGV2ZW50IHR5cGUnLCB7IGZ1bmN0aW9uOiAndmFsaWRhdGVPdXRnb2luZy5fdmVyaWZ5UmVxdWlyZWRGaWVsZHMnIH0pO1xuXHR9XG5cblx0aWYgKCFpbnRlZ3JhdGlvbi51c2VybmFtZSB8fCAhTWF0Y2gudGVzdChpbnRlZ3JhdGlvbi51c2VybmFtZSwgU3RyaW5nKSB8fCBpbnRlZ3JhdGlvbi51c2VybmFtZS50cmltKCkgPT09ICcnKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VybmFtZScsICdJbnZhbGlkIHVzZXJuYW1lJywgeyBmdW5jdGlvbjogJ3ZhbGlkYXRlT3V0Z29pbmcuX3ZlcmlmeVJlcXVpcmVkRmllbGRzJyB9KTtcblx0fVxuXG5cdGlmIChSb2NrZXRDaGF0LmludGVncmF0aW9ucy5vdXRnb2luZ0V2ZW50c1tpbnRlZ3JhdGlvbi5ldmVudF0udXNlLnRhcmdldFJvb20gJiYgIWludGVncmF0aW9uLnRhcmdldFJvb20pIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXRhcmdldFJvb20nLCAnSW52YWxpZCBUYXJnZXQgUm9vbScsIHsgZnVuY3Rpb246ICd2YWxpZGF0ZU91dGdvaW5nLl92ZXJpZnlSZXF1aXJlZEZpZWxkcycgfSk7XG5cdH1cblxuXHRpZiAoIU1hdGNoLnRlc3QoaW50ZWdyYXRpb24udXJscywgW1N0cmluZ10pKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11cmxzJywgJ0ludmFsaWQgVVJMcycsIHsgZnVuY3Rpb246ICd2YWxpZGF0ZU91dGdvaW5nLl92ZXJpZnlSZXF1aXJlZEZpZWxkcycgfSk7XG5cdH1cblxuXHRmb3IgKGNvbnN0IFtpbmRleCwgdXJsXSBvZiBpbnRlZ3JhdGlvbi51cmxzLmVudHJpZXMoKSkge1xuXHRcdGlmICh1cmwudHJpbSgpID09PSAnJykge1xuXHRcdFx0ZGVsZXRlIGludGVncmF0aW9uLnVybHNbaW5kZXhdO1xuXHRcdH1cblx0fVxuXG5cdGludGVncmF0aW9uLnVybHMgPSBfLndpdGhvdXQoaW50ZWdyYXRpb24udXJscywgW3VuZGVmaW5lZF0pO1xuXG5cdGlmIChpbnRlZ3JhdGlvbi51cmxzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXJscycsICdJbnZhbGlkIFVSTHMnLCB7IGZ1bmN0aW9uOiAndmFsaWRhdGVPdXRnb2luZy5fdmVyaWZ5UmVxdWlyZWRGaWVsZHMnIH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIF92ZXJpZnlVc2VySGFzUGVybWlzc2lvbkZvckNoYW5uZWxzKGludGVncmF0aW9uLCB1c2VySWQsIGNoYW5uZWxzKSB7XG5cdGZvciAobGV0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcblx0XHRpZiAoc2NvcGVkQ2hhbm5lbHMuaW5jbHVkZXMoY2hhbm5lbCkpIHtcblx0XHRcdGlmIChjaGFubmVsID09PSAnYWxsX3B1YmxpY19jaGFubmVscycpIHtcblx0XHRcdFx0Ly8gTm8gc3BlY2lhbCBwZXJtaXNzaW9ucyBuZWVkZWQgdG8gYWRkIGludGVncmF0aW9uIHRvIHB1YmxpYyBjaGFubmVsc1xuXHRcdFx0fSBlbHNlIGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWNoYW5uZWwnLCAnSW52YWxpZCBDaGFubmVsJywgeyBmdW5jdGlvbjogJ3ZhbGlkYXRlT3V0Z29pbmcuX3ZlcmlmeVVzZXJIYXNQZXJtaXNzaW9uRm9yQ2hhbm5lbHMnIH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZXQgcmVjb3JkO1xuXHRcdFx0Y29uc3QgY2hhbm5lbFR5cGUgPSBjaGFubmVsWzBdO1xuXHRcdFx0Y2hhbm5lbCA9IGNoYW5uZWwuc3Vic3RyKDEpO1xuXG5cdFx0XHRzd2l0Y2ggKGNoYW5uZWxUeXBlKSB7XG5cdFx0XHRcdGNhc2UgJyMnOlxuXHRcdFx0XHRcdHJlY29yZCA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmUoe1xuXHRcdFx0XHRcdFx0JG9yOiBbXG5cdFx0XHRcdFx0XHRcdHtfaWQ6IGNoYW5uZWx9LFxuXHRcdFx0XHRcdFx0XHR7bmFtZTogY2hhbm5lbH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnQCc6XG5cdFx0XHRcdFx0cmVjb3JkID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh7XG5cdFx0XHRcdFx0XHQkb3I6IFtcblx0XHRcdFx0XHRcdFx0e19pZDogY2hhbm5lbH0sXG5cdFx0XHRcdFx0XHRcdHt1c2VybmFtZTogY2hhbm5lbH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFyZWNvcmQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1yb29tJywgJ0ludmFsaWQgcm9vbScsIHsgZnVuY3Rpb246ICd2YWxpZGF0ZU91dGdvaW5nLl92ZXJpZnlVc2VySGFzUGVybWlzc2lvbkZvckNoYW5uZWxzJyB9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlY29yZC51c2VybmFtZXMgJiYgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih1c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykgJiYgUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHVzZXJJZCwgJ21hbmFnZS1vd24taW50ZWdyYXRpb25zJykgJiYgIXJlY29yZC51c2VybmFtZXMuaW5jbHVkZXMoTWV0ZW9yLnVzZXIoKS51c2VybmFtZSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jaGFubmVsJywgJ0ludmFsaWQgQ2hhbm5lbCcsIHsgZnVuY3Rpb246ICd2YWxpZGF0ZU91dGdvaW5nLl92ZXJpZnlVc2VySGFzUGVybWlzc2lvbkZvckNoYW5uZWxzJyB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gX3ZlcmlmeVJldHJ5SW5mb3JtYXRpb24oaW50ZWdyYXRpb24pIHtcblx0aWYgKCFpbnRlZ3JhdGlvbi5yZXRyeUZhaWxlZENhbGxzKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Ly8gRG9uJ3QgYWxsb3cgbmVnYXRpdmUgcmV0cnkgY291bnRzXG5cdGludGVncmF0aW9uLnJldHJ5Q291bnQgPSBpbnRlZ3JhdGlvbi5yZXRyeUNvdW50ICYmIHBhcnNlSW50KGludGVncmF0aW9uLnJldHJ5Q291bnQpID4gMCA/IHBhcnNlSW50KGludGVncmF0aW9uLnJldHJ5Q291bnQpIDogNDtcblx0aW50ZWdyYXRpb24ucmV0cnlEZWxheSA9ICFpbnRlZ3JhdGlvbi5yZXRyeURlbGF5IHx8ICFpbnRlZ3JhdGlvbi5yZXRyeURlbGF5LnRyaW0oKSA/ICdwb3dlcnMtb2YtdGVuJyA6IGludGVncmF0aW9uLnJldHJ5RGVsYXkudG9Mb3dlckNhc2UoKTtcbn1cblxuUm9ja2V0Q2hhdC5pbnRlZ3JhdGlvbnMudmFsaWRhdGVPdXRnb2luZyA9IGZ1bmN0aW9uIF92YWxpZGF0ZU91dGdvaW5nKGludGVncmF0aW9uLCB1c2VySWQpIHtcblx0aWYgKGludGVncmF0aW9uLmNoYW5uZWwgJiYgTWF0Y2gudGVzdChpbnRlZ3JhdGlvbi5jaGFubmVsLCBTdHJpbmcpICYmIGludGVncmF0aW9uLmNoYW5uZWwudHJpbSgpID09PSAnJykge1xuXHRcdGRlbGV0ZSBpbnRlZ3JhdGlvbi5jaGFubmVsO1xuXHR9XG5cblx0Ly9Nb3ZlZCB0byBpdCdzIG93biBmdW5jdGlvbiB0byBzdGF0aXNmeSB0aGUgY29tcGxleGl0eSBydWxlXG5cdF92ZXJpZnlSZXF1aXJlZEZpZWxkcyhpbnRlZ3JhdGlvbik7XG5cblx0bGV0IGNoYW5uZWxzID0gW107XG5cdGlmIChSb2NrZXRDaGF0LmludGVncmF0aW9ucy5vdXRnb2luZ0V2ZW50c1tpbnRlZ3JhdGlvbi5ldmVudF0udXNlLmNoYW5uZWwpIHtcblx0XHRpZiAoIU1hdGNoLnRlc3QoaW50ZWdyYXRpb24uY2hhbm5lbCwgU3RyaW5nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jaGFubmVsJywgJ0ludmFsaWQgQ2hhbm5lbCcsIHsgZnVuY3Rpb246ICd2YWxpZGF0ZU91dGdvaW5nJyB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2hhbm5lbHMgPSBfLm1hcChpbnRlZ3JhdGlvbi5jaGFubmVsLnNwbGl0KCcsJyksIChjaGFubmVsKSA9PiBzLnRyaW0oY2hhbm5lbCkpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcblx0XHRcdFx0aWYgKCF2YWxpZENoYW5uZWxDaGFycy5pbmNsdWRlcyhjaGFubmVsWzBdKSAmJiAhc2NvcGVkQ2hhbm5lbHMuaW5jbHVkZXMoY2hhbm5lbC50b0xvd2VyQ2FzZSgpKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtY2hhbm5lbC1zdGFydC13aXRoLWNoYXJzJywgJ0ludmFsaWQgY2hhbm5lbC4gU3RhcnQgd2l0aCBAIG9yICMnLCB7IGZ1bmN0aW9uOiAndmFsaWRhdGVPdXRnb2luZycgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSBpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih1c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXBlcm1pc3Npb25zJywgJ0ludmFsaWQgcGVybWlzc2lvbiBmb3IgcmVxdWlyZWQgSW50ZWdyYXRpb24gY3JlYXRpb24uJywgeyBmdW5jdGlvbjogJ3ZhbGlkYXRlT3V0Z29pbmcnIH0pO1xuXHR9XG5cblx0aWYgKFJvY2tldENoYXQuaW50ZWdyYXRpb25zLm91dGdvaW5nRXZlbnRzW2ludGVncmF0aW9uLmV2ZW50XS51c2UudHJpZ2dlcldvcmRzICYmIGludGVncmF0aW9uLnRyaWdnZXJXb3Jkcykge1xuXHRcdGlmICghTWF0Y2gudGVzdChpbnRlZ3JhdGlvbi50cmlnZ2VyV29yZHMsIFtTdHJpbmddKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC10cmlnZ2VyV29yZHMnLCAnSW52YWxpZCB0cmlnZ2VyV29yZHMnLCB7IGZ1bmN0aW9uOiAndmFsaWRhdGVPdXRnb2luZycgfSk7XG5cdFx0fVxuXG5cdFx0aW50ZWdyYXRpb24udHJpZ2dlcldvcmRzLmZvckVhY2goKHdvcmQsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAoIXdvcmQgfHwgd29yZC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRcdGRlbGV0ZSBpbnRlZ3JhdGlvbi50cmlnZ2VyV29yZHNbaW5kZXhdO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aW50ZWdyYXRpb24udHJpZ2dlcldvcmRzID0gXy53aXRob3V0KGludGVncmF0aW9uLnRyaWdnZXJXb3JkcywgW3VuZGVmaW5lZF0pO1xuXHR9IGVsc2Uge1xuXHRcdGRlbGV0ZSBpbnRlZ3JhdGlvbi50cmlnZ2VyV29yZHM7XG5cdH1cblxuXHRpZiAoaW50ZWdyYXRpb24uc2NyaXB0RW5hYmxlZCA9PT0gdHJ1ZSAmJiBpbnRlZ3JhdGlvbi5zY3JpcHQgJiYgaW50ZWdyYXRpb24uc2NyaXB0LnRyaW0oKSAhPT0gJycpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYmFiZWxPcHRpb25zID0gT2JqZWN0LmFzc2lnbihCYWJlbC5nZXREZWZhdWx0T3B0aW9ucyh7IHJ1bnRpbWU6IGZhbHNlIH0pLCB7IGNvbXBhY3Q6IHRydWUsIG1pbmlmaWVkOiB0cnVlLCBjb21tZW50czogZmFsc2UgfSk7XG5cblx0XHRcdGludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkID0gQmFiZWwuY29tcGlsZShpbnRlZ3JhdGlvbi5zY3JpcHQsIGJhYmVsT3B0aW9ucykuY29kZTtcblx0XHRcdGludGVncmF0aW9uLnNjcmlwdEVycm9yID0gdW5kZWZpbmVkO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aW50ZWdyYXRpb24uc2NyaXB0RXJyb3IgPSBfLnBpY2soZSwgJ25hbWUnLCAnbWVzc2FnZScsICdzdGFjaycpO1xuXHRcdH1cblx0fVxuXG5cdGlmICh0eXBlb2YgaW50ZWdyYXRpb24ucnVuT25FZGl0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHQvLyBWZXJpZnkgdGhpcyB2YWx1ZSBpcyBvbmx5IHRydWUvZmFsc2Vcblx0XHRpbnRlZ3JhdGlvbi5ydW5PbkVkaXRzID0gaW50ZWdyYXRpb24ucnVuT25FZGl0cyA9PT0gdHJ1ZTtcblx0fVxuXG5cdF92ZXJpZnlVc2VySGFzUGVybWlzc2lvbkZvckNoYW5uZWxzKGludGVncmF0aW9uLCB1c2VySWQsIGNoYW5uZWxzKTtcblx0X3ZlcmlmeVJldHJ5SW5mb3JtYXRpb24oaW50ZWdyYXRpb24pO1xuXG5cdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lKHsgdXNlcm5hbWU6IGludGVncmF0aW9uLnVzZXJuYW1lIH0pO1xuXG5cdGlmICghdXNlcikge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXIgKGRpZCB5b3UgZGVsZXRlIHRoZSBgcm9ja2V0LmNhdGAgdXNlcj8pJywgeyBmdW5jdGlvbjogJ3ZhbGlkYXRlT3V0Z29pbmcnIH0pO1xuXHR9XG5cblx0aW50ZWdyYXRpb24udHlwZSA9ICd3ZWJob29rLW91dGdvaW5nJztcblx0aW50ZWdyYXRpb24udXNlcklkID0gdXNlci5faWQ7XG5cdGludGVncmF0aW9uLmNoYW5uZWwgPSBjaGFubmVscztcblxuXHRyZXR1cm4gaW50ZWdyYXRpb247XG59O1xuIiwiLyogZ2xvYmFsIGxvZ2dlciwgcHJvY2Vzc1dlYmhvb2tNZXNzYWdlICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcbmltcG9ydCBtb21lbnQgZnJvbSAnbW9tZW50JztcblxuUm9ja2V0Q2hhdC5pbnRlZ3JhdGlvbnMudHJpZ2dlckhhbmRsZXIgPSBuZXcgY2xhc3MgUm9ja2V0Q2hhdEludGVncmF0aW9uSGFuZGxlciB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMudm0gPSBOcG0ucmVxdWlyZSgndm0nKTtcblx0XHR0aGlzLnN1Y2Nlc3NSZXN1bHRzID0gWzIwMCwgMjAxLCAyMDJdO1xuXHRcdHRoaXMuY29tcGlsZWRTY3JpcHRzID0ge307XG5cdFx0dGhpcy50cmlnZ2VycyA9IHt9O1xuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmQoe3R5cGU6ICd3ZWJob29rLW91dGdvaW5nJ30pLm9ic2VydmUoe1xuXHRcdFx0YWRkZWQ6IChyZWNvcmQpID0+IHtcblx0XHRcdFx0dGhpcy5hZGRJbnRlZ3JhdGlvbihyZWNvcmQpO1xuXHRcdFx0fSxcblxuXHRcdFx0Y2hhbmdlZDogKHJlY29yZCkgPT4ge1xuXHRcdFx0XHR0aGlzLnJlbW92ZUludGVncmF0aW9uKHJlY29yZCk7XG5cdFx0XHRcdHRoaXMuYWRkSW50ZWdyYXRpb24ocmVjb3JkKTtcblx0XHRcdH0sXG5cblx0XHRcdHJlbW92ZWQ6IChyZWNvcmQpID0+IHtcblx0XHRcdFx0dGhpcy5yZW1vdmVJbnRlZ3JhdGlvbihyZWNvcmQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YWRkSW50ZWdyYXRpb24ocmVjb3JkKSB7XG5cdFx0bG9nZ2VyLm91dGdvaW5nLmRlYnVnKGBBZGRpbmcgdGhlIGludGVncmF0aW9uICR7IHJlY29yZC5uYW1lIH0gb2YgdGhlIGV2ZW50ICR7IHJlY29yZC5ldmVudCB9IWApO1xuXHRcdGxldCBjaGFubmVscztcblx0XHRpZiAocmVjb3JkLmV2ZW50ICYmICFSb2NrZXRDaGF0LmludGVncmF0aW9ucy5vdXRnb2luZ0V2ZW50c1tyZWNvcmQuZXZlbnRdLnVzZS5jaGFubmVsKSB7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZGVidWcoJ1RoZSBpbnRlZ3JhdGlvbiBkb2VzbnQgcmVseSBvbiBjaGFubmVscy4nKTtcblx0XHRcdC8vV2UgZG9uJ3QgdXNlIGFueSBjaGFubmVscywgc28gaXQncyBzcGVjaWFsIDspXG5cdFx0XHRjaGFubmVscyA9IFsnX19hbnknXTtcblx0XHR9IGVsc2UgaWYgKF8uaXNFbXB0eShyZWNvcmQuY2hhbm5lbCkpIHtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZygnVGhlIGludGVncmF0aW9uIGhhZCBhbiBlbXB0eSBjaGFubmVsIHByb3BlcnR5LCBzbyBpdCBpcyBnb2luZyBvbiBhbGwgdGhlIHB1YmxpYyBjaGFubmVscy4nKTtcblx0XHRcdGNoYW5uZWxzID0gWydhbGxfcHVibGljX2NoYW5uZWxzJ107XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZygnVGhlIGludGVncmF0aW9uIGlzIGdvaW5nIG9uIHRoZXNlIGNoYW5uZWxzOicsIHJlY29yZC5jaGFubmVsKTtcblx0XHRcdGNoYW5uZWxzID0gW10uY29uY2F0KHJlY29yZC5jaGFubmVsKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcblx0XHRcdGlmICghdGhpcy50cmlnZ2Vyc1tjaGFubmVsXSkge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXJzW2NoYW5uZWxdID0ge307XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudHJpZ2dlcnNbY2hhbm5lbF1bcmVjb3JkLl9pZF0gPSByZWNvcmQ7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlSW50ZWdyYXRpb24ocmVjb3JkKSB7XG5cdFx0Zm9yIChjb25zdCB0cmlnZ2VyIG9mIE9iamVjdC52YWx1ZXModGhpcy50cmlnZ2VycykpIHtcblx0XHRcdGRlbGV0ZSB0cmlnZ2VyW3JlY29yZC5faWRdO1xuXHRcdH1cblx0fVxuXG5cdGlzVHJpZ2dlckVuYWJsZWQodHJpZ2dlcikge1xuXHRcdGZvciAoY29uc3QgdHJpZyBvZiBPYmplY3QudmFsdWVzKHRoaXMudHJpZ2dlcnMpKSB7XG5cdFx0XHRpZiAodHJpZ1t0cmlnZ2VyLl9pZF0pIHtcblx0XHRcdFx0cmV0dXJuIHRyaWdbdHJpZ2dlci5faWRdLmVuYWJsZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcCwgaW50ZWdyYXRpb24sIGV2ZW50LCBkYXRhLCB0cmlnZ2VyV29yZCwgcmFuUHJlcGFyZVNjcmlwdCwgcHJlcGFyZVNlbnRNZXNzYWdlLCBwcm9jZXNzU2VudE1lc3NhZ2UsIHJlc3VsdE1lc3NhZ2UsIGZpbmlzaGVkLCB1cmwsIGh0dHBDYWxsRGF0YSwgaHR0cEVycm9yLCBodHRwUmVzdWx0LCBlcnJvciwgZXJyb3JTdGFjayB9KSB7XG5cdFx0Y29uc3QgaGlzdG9yeSA9IHtcblx0XHRcdHR5cGU6ICdvdXRnb2luZy13ZWJob29rJyxcblx0XHRcdHN0ZXBcblx0XHR9O1xuXG5cdFx0Ly8gVXN1YWxseSBpcyBvbmx5IGFkZGVkIG9uIGluaXRpYWwgaW5zZXJ0XG5cdFx0aWYgKGludGVncmF0aW9uKSB7XG5cdFx0XHRoaXN0b3J5LmludGVncmF0aW9uID0gaW50ZWdyYXRpb247XG5cdFx0fVxuXG5cdFx0Ly8gVXN1YWxseSBpcyBvbmx5IGFkZGVkIG9uIGluaXRpYWwgaW5zZXJ0XG5cdFx0aWYgKGV2ZW50KSB7XG5cdFx0XHRoaXN0b3J5LmV2ZW50ID0gZXZlbnQ7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGhpc3RvcnkuZGF0YSA9IGRhdGE7XG5cblx0XHRcdGlmIChkYXRhLnVzZXIpIHtcblx0XHRcdFx0aGlzdG9yeS5kYXRhLnVzZXIgPSBfLm9taXQoZGF0YS51c2VyLCBbJ21ldGEnLCAnJGxva2knLCAnc2VydmljZXMnXSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkYXRhLnJvb20pIHtcblx0XHRcdFx0aGlzdG9yeS5kYXRhLnJvb20gPSBfLm9taXQoZGF0YS5yb29tLCBbJ21ldGEnLCAnJGxva2knLCAndXNlcm5hbWVzJ10pO1xuXHRcdFx0XHRoaXN0b3J5LmRhdGEucm9vbS51c2VybmFtZXMgPSBbJ3RoaXNfd2lsbF9iZV9maWxsZWRfaW5fd2l0aF91c2VybmFtZXNfd2hlbl9yZXBsYXllZCddO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0cmlnZ2VyV29yZCkge1xuXHRcdFx0aGlzdG9yeS50cmlnZ2VyV29yZCA9IHRyaWdnZXJXb3JkO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgcmFuUHJlcGFyZVNjcmlwdCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGhpc3RvcnkucmFuUHJlcGFyZVNjcmlwdCA9IHJhblByZXBhcmVTY3JpcHQ7XG5cdFx0fVxuXG5cdFx0aWYgKHByZXBhcmVTZW50TWVzc2FnZSkge1xuXHRcdFx0aGlzdG9yeS5wcmVwYXJlU2VudE1lc3NhZ2UgPSBwcmVwYXJlU2VudE1lc3NhZ2U7XG5cdFx0fVxuXG5cdFx0aWYgKHByb2Nlc3NTZW50TWVzc2FnZSkge1xuXHRcdFx0aGlzdG9yeS5wcm9jZXNzU2VudE1lc3NhZ2UgPSBwcm9jZXNzU2VudE1lc3NhZ2U7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3VsdE1lc3NhZ2UpIHtcblx0XHRcdGhpc3RvcnkucmVzdWx0TWVzc2FnZSA9IHJlc3VsdE1lc3NhZ2U7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmaW5pc2hlZCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGhpc3RvcnkuZmluaXNoZWQgPSBmaW5pc2hlZDtcblx0XHR9XG5cblx0XHRpZiAodXJsKSB7XG5cdFx0XHRoaXN0b3J5LnVybCA9IHVybDtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGh0dHBDYWxsRGF0YSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGhpc3RvcnkuaHR0cENhbGxEYXRhID0gaHR0cENhbGxEYXRhO1xuXHRcdH1cblxuXHRcdGlmIChodHRwRXJyb3IpIHtcblx0XHRcdGhpc3RvcnkuaHR0cEVycm9yID0gaHR0cEVycm9yO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgaHR0cFJlc3VsdCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGhpc3RvcnkuaHR0cFJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KGh0dHBSZXN1bHQsIG51bGwsIDIpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgZXJyb3IgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRoaXN0b3J5LmVycm9yID0gZXJyb3I7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBlcnJvclN0YWNrICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0aGlzdG9yeS5lcnJvclN0YWNrID0gZXJyb3JTdGFjaztcblx0XHR9XG5cblx0XHRpZiAoaGlzdG9yeUlkKSB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbkhpc3RvcnkudXBkYXRlKHsgX2lkOiBoaXN0b3J5SWQgfSwgeyAkc2V0OiBoaXN0b3J5IH0pO1xuXHRcdFx0cmV0dXJuIGhpc3RvcnlJZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGlzdG9yeS5fY3JlYXRlZEF0ID0gbmV3IERhdGUoKTtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbkhpc3RvcnkuaW5zZXJ0KE9iamVjdC5hc3NpZ24oeyBfaWQ6IFJhbmRvbS5pZCgpIH0sIGhpc3RvcnkpKTtcblx0XHR9XG5cdH1cblxuXHQvL1RyaWdnZXIgaXMgdGhlIHRyaWdnZXIsIG5hbWVPcklkIGlzIGEgc3RyaW5nIHdoaWNoIGlzIHVzZWQgdG8gdHJ5IGFuZCBmaW5kIGEgcm9vbSwgcm9vbSBpcyBhIHJvb20sIG1lc3NhZ2UgaXMgYSBtZXNzYWdlLCBhbmQgZGF0YSBjb250YWlucyBcInVzZXJfbmFtZVwiIGlmIHRyaWdnZXIuaW1wZXJzb25hdGVVc2VyIGlzIHRydXRoZnVsLlxuXHRzZW5kTWVzc2FnZSh7IHRyaWdnZXIsIG5hbWVPcklkID0gJycsIHJvb20sIG1lc3NhZ2UsIGRhdGEgfSkge1xuXHRcdGxldCB1c2VyO1xuXHRcdC8vVHJ5IHRvIGZpbmQgdGhlIHVzZXIgd2hvIHdlIGFyZSBpbXBlcnNvbmF0aW5nXG5cdFx0aWYgKHRyaWdnZXIuaW1wZXJzb25hdGVVc2VyKSB7XG5cdFx0XHR1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUoZGF0YS51c2VyX25hbWUpO1xuXHRcdH1cblxuXHRcdC8vSWYgdGhleSBkb24ndCBleGlzdCAoYWthIHRoZSB0cmlnZ2VyIGRpZG4ndCBjb250YWluIGEgdXNlcikgdGhlbiB3ZSBzZXQgdGhlIHVzZXIgYmFzZWQgdXBvbiB0aGVcblx0XHQvL2NvbmZpZ3VyZWQgdXNlcm5hbWUgZm9yIHRoZSBpbnRlZ3JhdGlvbiBzaW5jZSB0aGlzIGlzIHJlcXVpcmVkIGF0IGFsbCB0aW1lcy5cblx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh0cmlnZ2VyLnVzZXJuYW1lKTtcblx0XHR9XG5cblx0XHRsZXQgdG1wUm9vbTtcblx0XHRpZiAobmFtZU9ySWQgfHwgdHJpZ2dlci50YXJnZXRSb29tIHx8IG1lc3NhZ2UuY2hhbm5lbCkge1xuXHRcdFx0dG1wUm9vbSA9IFJvY2tldENoYXQuZ2V0Um9vbUJ5TmFtZU9ySWRXaXRoT3B0aW9uVG9Kb2luKHsgY3VycmVudFVzZXJJZDogdXNlci5faWQsIG5hbWVPcklkOiBuYW1lT3JJZCB8fCBtZXNzYWdlLmNoYW5uZWwgfHwgdHJpZ2dlci50YXJnZXRSb29tLCBlcnJvck9uRW1wdHk6IGZhbHNlIH0pIHx8IHJvb207XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRtcFJvb20gPSByb29tO1xuXHRcdH1cblxuXHRcdC8vSWYgbm8gcm9vbSBjb3VsZCBiZSBmb3VuZCwgd2Ugd29uJ3QgYmUgc2VuZGluZyBhbnkgbWVzc2FnZXMgYnV0IHdlJ2xsIHdhcm4gaW4gdGhlIGxvZ3Ncblx0XHRpZiAoIXRtcFJvb20pIHtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy53YXJuKGBUaGUgSW50ZWdyYXRpb24gXCIkeyB0cmlnZ2VyLm5hbWUgfVwiIGRvZXNuJ3QgaGF2ZSBhIHJvb20gY29uZmlndXJlZCBub3IgZGlkIGl0IHByb3ZpZGUgYSByb29tIHRvIHNlbmQgdGhlIG1lc3NhZ2UgdG8uYCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bG9nZ2VyLm91dGdvaW5nLmRlYnVnKGBGb3VuZCBhIHJvb20gZm9yICR7IHRyaWdnZXIubmFtZSB9IHdoaWNoIGlzOiAkeyB0bXBSb29tLm5hbWUgfSB3aXRoIGEgdHlwZSBvZiAkeyB0bXBSb29tLnQgfWApO1xuXG5cdFx0bWVzc2FnZS5ib3QgPSB7IGk6IHRyaWdnZXIuX2lkIH07XG5cblx0XHRjb25zdCBkZWZhdWx0VmFsdWVzID0ge1xuXHRcdFx0YWxpYXM6IHRyaWdnZXIuYWxpYXMsXG5cdFx0XHRhdmF0YXI6IHRyaWdnZXIuYXZhdGFyLFxuXHRcdFx0ZW1vamk6IHRyaWdnZXIuZW1vamlcblx0XHR9O1xuXG5cdFx0aWYgKHRtcFJvb20udCA9PT0gJ2QnKSB7XG5cdFx0XHRtZXNzYWdlLmNoYW5uZWwgPSBgQCR7IHRtcFJvb20uX2lkIH1gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlLmNoYW5uZWwgPSBgIyR7IHRtcFJvb20uX2lkIH1gO1xuXHRcdH1cblxuXHRcdG1lc3NhZ2UgPSBwcm9jZXNzV2ViaG9va01lc3NhZ2UobWVzc2FnZSwgdXNlciwgZGVmYXVsdFZhbHVlcyk7XG5cdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdH1cblxuXHRidWlsZFNhbmRib3goc3RvcmUgPSB7fSkge1xuXHRcdGNvbnN0IHNhbmRib3ggPSB7XG5cdFx0XHRfLCBzLCBjb25zb2xlLCBtb21lbnQsXG5cdFx0XHRTdG9yZToge1xuXHRcdFx0XHRzZXQ6IChrZXksIHZhbCkgPT4gc3RvcmVba2V5XSA9IHZhbCxcblx0XHRcdFx0Z2V0OiAoa2V5KSA9PiBzdG9yZVtrZXldXG5cdFx0XHR9LFxuXHRcdFx0SFRUUDogKG1ldGhvZCwgdXJsLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHJlc3VsdDogSFRUUC5jYWxsKG1ldGhvZCwgdXJsLCBvcHRpb25zKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZXJyb3IgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRPYmplY3Qua2V5cyhSb2NrZXRDaGF0Lm1vZGVscykuZmlsdGVyKGsgPT4gIWsuc3RhcnRzV2l0aCgnXycpKS5mb3JFYWNoKGsgPT4ge1xuXHRcdFx0c2FuZGJveFtrXSA9IFJvY2tldENoYXQubW9kZWxzW2tdO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHsgc3RvcmUsIHNhbmRib3ggfTtcblx0fVxuXG5cdGdldEludGVncmF0aW9uU2NyaXB0KGludGVncmF0aW9uKSB7XG5cdFx0Y29uc3QgY29tcGlsZWRTY3JpcHQgPSB0aGlzLmNvbXBpbGVkU2NyaXB0c1tpbnRlZ3JhdGlvbi5faWRdO1xuXHRcdGlmIChjb21waWxlZFNjcmlwdCAmJiArY29tcGlsZWRTY3JpcHQuX3VwZGF0ZWRBdCA9PT0gK2ludGVncmF0aW9uLl91cGRhdGVkQXQpIHtcblx0XHRcdHJldHVybiBjb21waWxlZFNjcmlwdC5zY3JpcHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2NyaXB0ID0gaW50ZWdyYXRpb24uc2NyaXB0Q29tcGlsZWQ7XG5cdFx0Y29uc3QgeyBzdG9yZSwgc2FuZGJveCB9ID0gdGhpcy5idWlsZFNhbmRib3goKTtcblxuXHRcdGxldCB2bVNjcmlwdDtcblx0XHR0cnkge1xuXHRcdFx0bG9nZ2VyLm91dGdvaW5nLmluZm8oJ1dpbGwgZXZhbHVhdGUgc2NyaXB0IG9mIFRyaWdnZXInLCBpbnRlZ3JhdGlvbi5uYW1lKTtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZyhzY3JpcHQpO1xuXG5cdFx0XHR2bVNjcmlwdCA9IHRoaXMudm0uY3JlYXRlU2NyaXB0KHNjcmlwdCwgJ3NjcmlwdC5qcycpO1xuXG5cdFx0XHR2bVNjcmlwdC5ydW5Jbk5ld0NvbnRleHQoc2FuZGJveCk7XG5cblx0XHRcdGlmIChzYW5kYm94LlNjcmlwdCkge1xuXHRcdFx0XHR0aGlzLmNvbXBpbGVkU2NyaXB0c1tpbnRlZ3JhdGlvbi5faWRdID0ge1xuXHRcdFx0XHRcdHNjcmlwdDogbmV3IHNhbmRib3guU2NyaXB0KCksXG5cdFx0XHRcdFx0c3RvcmUsXG5cdFx0XHRcdFx0X3VwZGF0ZWRBdDogaW50ZWdyYXRpb24uX3VwZGF0ZWRBdFxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHJldHVybiB0aGlzLmNvbXBpbGVkU2NyaXB0c1tpbnRlZ3JhdGlvbi5faWRdLnNjcmlwdDtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZXJyb3IoYEVycm9yIGV2YWx1YXRpbmcgU2NyaXB0IGluIFRyaWdnZXIgJHsgaW50ZWdyYXRpb24ubmFtZSB9OmApO1xuXHRcdFx0bG9nZ2VyLm91dGdvaW5nLmVycm9yKHNjcmlwdC5yZXBsYWNlKC9eL2dtLCAnICAnKSk7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZXJyb3IoJ1N0YWNrIFRyYWNlOicpO1xuXHRcdFx0bG9nZ2VyLm91dGdvaW5nLmVycm9yKGUuc3RhY2sucmVwbGFjZSgvXi9nbSwgJyAgJykpO1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItZXZhbHVhdGluZy1zY3JpcHQnKTtcblx0XHR9XG5cblx0XHRpZiAoIXNhbmRib3guU2NyaXB0KSB7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZXJyb3IoYENsYXNzIFwiU2NyaXB0XCIgbm90IGluIFRyaWdnZXIgJHsgaW50ZWdyYXRpb24ubmFtZSB9OmApO1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignY2xhc3Mtc2NyaXB0LW5vdC1mb3VuZCcpO1xuXHRcdH1cblx0fVxuXG5cdGhhc1NjcmlwdEFuZE1ldGhvZChpbnRlZ3JhdGlvbiwgbWV0aG9kKSB7XG5cdFx0aWYgKGludGVncmF0aW9uLnNjcmlwdEVuYWJsZWQgIT09IHRydWUgfHwgIWludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkIHx8IGludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgc2NyaXB0O1xuXHRcdHRyeSB7XG5cdFx0XHRzY3JpcHQgPSB0aGlzLmdldEludGVncmF0aW9uU2NyaXB0KGludGVncmF0aW9uKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHR5cGVvZiBzY3JpcHRbbWV0aG9kXSAhPT0gJ3VuZGVmaW5lZCc7XG5cdH1cblxuXHRleGVjdXRlU2NyaXB0KGludGVncmF0aW9uLCBtZXRob2QsIHBhcmFtcywgaGlzdG9yeUlkKSB7XG5cdFx0bGV0IHNjcmlwdDtcblx0XHR0cnkge1xuXHRcdFx0c2NyaXB0ID0gdGhpcy5nZXRJbnRlZ3JhdGlvblNjcmlwdChpbnRlZ3JhdGlvbik7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy51cGRhdGVIaXN0b3J5KHsgaGlzdG9yeUlkLCBzdGVwOiAnZXhlY3V0ZS1zY3JpcHQtZ2V0dGluZy1zY3JpcHQnLCBlcnJvcjogdHJ1ZSwgZXJyb3JTdGFjazogZSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXNjcmlwdFttZXRob2RdKSB7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZXJyb3IoYE1ldGhvZCBcIiR7IG1ldGhvZCB9XCIgbm8gZm91bmQgaW4gdGhlIEludGVncmF0aW9uIFwiJHsgaW50ZWdyYXRpb24ubmFtZSB9XCJgKTtcblx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogYGV4ZWN1dGUtc2NyaXB0LW5vLW1ldGhvZC0keyBtZXRob2QgfWAgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHsgc2FuZGJveCB9ID0gdGhpcy5idWlsZFNhbmRib3godGhpcy5jb21waWxlZFNjcmlwdHNbaW50ZWdyYXRpb24uX2lkXS5zdG9yZSk7XG5cdFx0XHRzYW5kYm94LnNjcmlwdCA9IHNjcmlwdDtcblx0XHRcdHNhbmRib3gubWV0aG9kID0gbWV0aG9kO1xuXHRcdFx0c2FuZGJveC5wYXJhbXMgPSBwYXJhbXM7XG5cblx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogYGV4ZWN1dGUtc2NyaXB0LWJlZm9yZS1ydW5uaW5nLSR7IG1ldGhvZCB9YCB9KTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMudm0ucnVuSW5OZXdDb250ZXh0KCdzY3JpcHRbbWV0aG9kXShwYXJhbXMpJywgc2FuZGJveCwgeyB0aW1lb3V0OiAzMDAwIH0pO1xuXG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZGVidWcoYFNjcmlwdCBtZXRob2QgXCIkeyBtZXRob2QgfVwiIHJlc3VsdCBvZiB0aGUgSW50ZWdyYXRpb24gXCIkeyBpbnRlZ3JhdGlvbi5uYW1lIH1cIiBpczpgKTtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZyhyZXN1bHQpO1xuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogYGV4ZWN1dGUtc2NyaXB0LWVycm9yLXJ1bm5pbmctJHsgbWV0aG9kIH1gLCBlcnJvcjogdHJ1ZSwgZXJyb3JTdGFjazogZS5zdGFjay5yZXBsYWNlKC9eL2dtLCAnICAnKSB9KTtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5lcnJvcihgRXJyb3IgcnVubmluZyBTY3JpcHQgaW4gdGhlIEludGVncmF0aW9uICR7IGludGVncmF0aW9uLm5hbWUgfTpgKTtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZyhpbnRlZ3JhdGlvbi5zY3JpcHRDb21waWxlZC5yZXBsYWNlKC9eL2dtLCAnICAnKSk7IC8vIE9ubHkgb3V0cHV0IHRoZSBjb21waWxlZCBzY3JpcHQgaWYgZGVidWdnaW5nIGlzIGVuYWJsZWQsIHNvIHRoZSBsb2dzIGRvbid0IGdldCBzcGFtbWVkLlxuXHRcdFx0bG9nZ2VyLm91dGdvaW5nLmVycm9yKCdTdGFjazonKTtcblx0XHRcdGxvZ2dlci5vdXRnb2luZy5lcnJvcihlLnN0YWNrLnJlcGxhY2UoL14vZ20sICcgICcpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRldmVudE5hbWVBcmd1bWVudHNUb09iamVjdCgpIHtcblx0XHRjb25zdCBhcmdPYmplY3QgPSB7XG5cdFx0XHRldmVudDogYXJndW1lbnRzWzBdXG5cdFx0fTtcblxuXHRcdHN3aXRjaCAoYXJnT2JqZWN0LmV2ZW50KSB7XG5cdFx0XHRjYXNlICdzZW5kTWVzc2FnZSc6XG5cdFx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIHtcblx0XHRcdFx0XHRhcmdPYmplY3QubWVzc2FnZSA9IGFyZ3VtZW50c1sxXTtcblx0XHRcdFx0XHRhcmdPYmplY3Qucm9vbSA9IGFyZ3VtZW50c1syXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2ZpbGVVcGxvYWRlZCc6XG5cdFx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID49IDIpIHtcblx0XHRcdFx0XHRjb25zdCBhcmdoaGggPSBhcmd1bWVudHNbMV07XG5cdFx0XHRcdFx0YXJnT2JqZWN0LnVzZXIgPSBhcmdoaGgudXNlcjtcblx0XHRcdFx0XHRhcmdPYmplY3Qucm9vbSA9IGFyZ2hoaC5yb29tO1xuXHRcdFx0XHRcdGFyZ09iamVjdC5tZXNzYWdlID0gYXJnaGhoLm1lc3NhZ2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyb29tQXJjaGl2ZWQnOlxuXHRcdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHRcdFx0YXJnT2JqZWN0LnJvb20gPSBhcmd1bWVudHNbMV07XG5cdFx0XHRcdFx0YXJnT2JqZWN0LnVzZXIgPSBhcmd1bWVudHNbMl07XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyb29tQ3JlYXRlZCc6XG5cdFx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIHtcblx0XHRcdFx0XHRhcmdPYmplY3Qub3duZXIgPSBhcmd1bWVudHNbMV07XG5cdFx0XHRcdFx0YXJnT2JqZWN0LnJvb20gPSBhcmd1bWVudHNbMl07XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyb29tSm9pbmVkJzpcblx0XHRcdGNhc2UgJ3Jvb21MZWZ0Jzpcblx0XHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykge1xuXHRcdFx0XHRcdGFyZ09iamVjdC51c2VyID0gYXJndW1lbnRzWzFdO1xuXHRcdFx0XHRcdGFyZ09iamVjdC5yb29tID0gYXJndW1lbnRzWzJdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAndXNlckNyZWF0ZWQnOlxuXHRcdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAyKSB7XG5cdFx0XHRcdFx0YXJnT2JqZWN0LnVzZXIgPSBhcmd1bWVudHNbMV07XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRsb2dnZXIub3V0Z29pbmcud2FybihgQW4gVW5oYW5kbGVkIFRyaWdnZXIgRXZlbnQgd2FzIGNhbGxlZDogJHsgYXJnT2JqZWN0LmV2ZW50IH1gKTtcblx0XHRcdFx0YXJnT2JqZWN0LmV2ZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRsb2dnZXIub3V0Z29pbmcuZGVidWcoYEdvdCB0aGUgZXZlbnQgYXJndW1lbnRzIGZvciB0aGUgZXZlbnQ6ICR7IGFyZ09iamVjdC5ldmVudCB9YCwgYXJnT2JqZWN0KTtcblxuXHRcdHJldHVybiBhcmdPYmplY3Q7XG5cdH1cblxuXHRtYXBFdmVudEFyZ3NUb0RhdGEoZGF0YSwgeyBldmVudCwgbWVzc2FnZSwgcm9vbSwgb3duZXIsIHVzZXIgfSkge1xuXHRcdHN3aXRjaCAoZXZlbnQpIHtcblx0XHRcdGNhc2UgJ3NlbmRNZXNzYWdlJzpcblx0XHRcdFx0ZGF0YS5jaGFubmVsX2lkID0gcm9vbS5faWQ7XG5cdFx0XHRcdGRhdGEuY2hhbm5lbF9uYW1lID0gcm9vbS5uYW1lO1xuXHRcdFx0XHRkYXRhLm1lc3NhZ2VfaWQgPSBtZXNzYWdlLl9pZDtcblx0XHRcdFx0ZGF0YS50aW1lc3RhbXAgPSBtZXNzYWdlLnRzO1xuXHRcdFx0XHRkYXRhLnVzZXJfaWQgPSBtZXNzYWdlLnUuX2lkO1xuXHRcdFx0XHRkYXRhLnVzZXJfbmFtZSA9IG1lc3NhZ2UudS51c2VybmFtZTtcblx0XHRcdFx0ZGF0YS50ZXh0ID0gbWVzc2FnZS5tc2c7XG5cblx0XHRcdFx0aWYgKG1lc3NhZ2UuYWxpYXMpIHtcblx0XHRcdFx0XHRkYXRhLmFsaWFzID0gbWVzc2FnZS5hbGlhcztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtZXNzYWdlLmJvdCkge1xuXHRcdFx0XHRcdGRhdGEuYm90ID0gbWVzc2FnZS5ib3Q7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobWVzc2FnZS5lZGl0ZWRBdCkge1xuXHRcdFx0XHRcdGRhdGEuaXNFZGl0ZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZmlsZVVwbG9hZGVkJzpcblx0XHRcdFx0ZGF0YS5jaGFubmVsX2lkID0gcm9vbS5faWQ7XG5cdFx0XHRcdGRhdGEuY2hhbm5lbF9uYW1lID0gcm9vbS5uYW1lO1xuXHRcdFx0XHRkYXRhLm1lc3NhZ2VfaWQgPSBtZXNzYWdlLl9pZDtcblx0XHRcdFx0ZGF0YS50aW1lc3RhbXAgPSBtZXNzYWdlLnRzO1xuXHRcdFx0XHRkYXRhLnVzZXJfaWQgPSBtZXNzYWdlLnUuX2lkO1xuXHRcdFx0XHRkYXRhLnVzZXJfbmFtZSA9IG1lc3NhZ2UudS51c2VybmFtZTtcblx0XHRcdFx0ZGF0YS50ZXh0ID0gbWVzc2FnZS5tc2c7XG5cdFx0XHRcdGRhdGEudXNlciA9IHVzZXI7XG5cdFx0XHRcdGRhdGEucm9vbSA9IHJvb207XG5cdFx0XHRcdGRhdGEubWVzc2FnZSA9IG1lc3NhZ2U7XG5cblx0XHRcdFx0aWYgKG1lc3NhZ2UuYWxpYXMpIHtcblx0XHRcdFx0XHRkYXRhLmFsaWFzID0gbWVzc2FnZS5hbGlhcztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtZXNzYWdlLmJvdCkge1xuXHRcdFx0XHRcdGRhdGEuYm90ID0gbWVzc2FnZS5ib3Q7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyb29tQ3JlYXRlZCc6XG5cdFx0XHRcdGRhdGEuY2hhbm5lbF9pZCA9IHJvb20uX2lkO1xuXHRcdFx0XHRkYXRhLmNoYW5uZWxfbmFtZSA9IHJvb20ubmFtZTtcblx0XHRcdFx0ZGF0YS50aW1lc3RhbXAgPSByb29tLnRzO1xuXHRcdFx0XHRkYXRhLnVzZXJfaWQgPSBvd25lci5faWQ7XG5cdFx0XHRcdGRhdGEudXNlcl9uYW1lID0gb3duZXIudXNlcm5hbWU7XG5cdFx0XHRcdGRhdGEub3duZXIgPSBvd25lcjtcblx0XHRcdFx0ZGF0YS5yb29tID0gcm9vbTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdyb29tQXJjaGl2ZWQnOlxuXHRcdFx0Y2FzZSAncm9vbUpvaW5lZCc6XG5cdFx0XHRjYXNlICdyb29tTGVmdCc6XG5cdFx0XHRcdGRhdGEudGltZXN0YW1wID0gbmV3IERhdGUoKTtcblx0XHRcdFx0ZGF0YS5jaGFubmVsX2lkID0gcm9vbS5faWQ7XG5cdFx0XHRcdGRhdGEuY2hhbm5lbF9uYW1lID0gcm9vbS5uYW1lO1xuXHRcdFx0XHRkYXRhLnVzZXJfaWQgPSB1c2VyLl9pZDtcblx0XHRcdFx0ZGF0YS51c2VyX25hbWUgPSB1c2VyLnVzZXJuYW1lO1xuXHRcdFx0XHRkYXRhLnVzZXIgPSB1c2VyO1xuXHRcdFx0XHRkYXRhLnJvb20gPSByb29tO1xuXG5cdFx0XHRcdGlmICh1c2VyLnR5cGUgPT09ICdib3QnKSB7XG5cdFx0XHRcdFx0ZGF0YS5ib3QgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAndXNlckNyZWF0ZWQnOlxuXHRcdFx0XHRkYXRhLnRpbWVzdGFtcCA9IHVzZXIuY3JlYXRlZEF0O1xuXHRcdFx0XHRkYXRhLnVzZXJfaWQgPSB1c2VyLl9pZDtcblx0XHRcdFx0ZGF0YS51c2VyX25hbWUgPSB1c2VyLnVzZXJuYW1lO1xuXHRcdFx0XHRkYXRhLnVzZXIgPSB1c2VyO1xuXG5cdFx0XHRcdGlmICh1c2VyLnR5cGUgPT09ICdib3QnKSB7XG5cdFx0XHRcdFx0ZGF0YS5ib3QgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0ZXhlY3V0ZVRyaWdnZXJzKCkge1xuXHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZygnRXhlY3V0ZSBUcmlnZ2VyOicsIGFyZ3VtZW50c1swXSk7XG5cblx0XHRjb25zdCBhcmdPYmplY3QgPSB0aGlzLmV2ZW50TmFtZUFyZ3VtZW50c1RvT2JqZWN0KC4uLmFyZ3VtZW50cyk7XG5cdFx0Y29uc3QgeyBldmVudCwgbWVzc2FnZSwgcm9vbSB9ID0gYXJnT2JqZWN0O1xuXG5cdFx0Ly9FYWNoIHR5cGUgb2YgZXZlbnQgc2hvdWxkIGhhdmUgYW4gZXZlbnQgYW5kIGEgcm9vbSBhdHRhY2hlZCwgb3RoZXJ3aXNlIHdlXG5cdFx0Ly93b3VsZG4ndCBrbm93IGhvdyB0byBoYW5kbGUgdGhlIHRyaWdnZXIgbm9yIHdvdWxkIHdlIGhhdmUgYW55d2hlcmUgdG8gc2VuZCB0aGVcblx0XHQvL3Jlc3VsdCBvZiB0aGUgaW50ZWdyYXRpb25cblx0XHRpZiAoIWV2ZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHJpZ2dlcnNUb0V4ZWN1dGUgPSBbXTtcblxuXHRcdGxvZ2dlci5vdXRnb2luZy5kZWJ1ZygnU3RhcnRpbmcgc2VhcmNoIGZvciB0cmlnZ2VycyBmb3IgdGhlIHJvb206Jywgcm9vbSA/IHJvb20uX2lkIDogJ19fYW55Jyk7XG5cdFx0aWYgKHJvb20pIHtcblx0XHRcdHN3aXRjaCAocm9vbS50KSB7XG5cdFx0XHRcdGNhc2UgJ2QnOlxuXHRcdFx0XHRcdGNvbnN0IGlkID0gcm9vbS5faWQucmVwbGFjZShtZXNzYWdlLnUuX2lkLCAnJyk7XG5cdFx0XHRcdFx0Y29uc3QgdXNlcm5hbWUgPSBfLndpdGhvdXQocm9vbS51c2VybmFtZXMsIG1lc3NhZ2UudS51c2VybmFtZSlbMF07XG5cblx0XHRcdFx0XHRpZiAodGhpcy50cmlnZ2Vyc1tgQCR7IGlkIH1gXSkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCB0cmlnZ2VyIG9mIE9iamVjdC52YWx1ZXModGhpcy50cmlnZ2Vyc1tgQCR7IGlkIH1gXSkpIHtcblx0XHRcdFx0XHRcdFx0dHJpZ2dlcnNUb0V4ZWN1dGUucHVzaCh0cmlnZ2VyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAodGhpcy50cmlnZ2Vycy5hbGxfZGlyZWN0X21lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHRyaWdnZXIgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRyaWdnZXJzLmFsbF9kaXJlY3RfbWVzc2FnZXMpKSB7XG5cdFx0XHRcdFx0XHRcdHRyaWdnZXJzVG9FeGVjdXRlLnB1c2godHJpZ2dlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGlkICE9PSB1c2VybmFtZSAmJiB0aGlzLnRyaWdnZXJzW2BAJHsgdXNlcm5hbWUgfWBdKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHRyaWdnZXIgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRyaWdnZXJzW2BAJHsgdXNlcm5hbWUgfWBdKSkge1xuXHRcdFx0XHRcdFx0XHR0cmlnZ2Vyc1RvRXhlY3V0ZS5wdXNoKHRyaWdnZXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlICdjJzpcblx0XHRcdFx0XHRpZiAodGhpcy50cmlnZ2Vycy5hbGxfcHVibGljX2NoYW5uZWxzKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHRyaWdnZXIgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRyaWdnZXJzLmFsbF9wdWJsaWNfY2hhbm5lbHMpKSB7XG5cdFx0XHRcdFx0XHRcdHRyaWdnZXJzVG9FeGVjdXRlLnB1c2godHJpZ2dlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRoaXMudHJpZ2dlcnNbYCMkeyByb29tLl9pZCB9YF0pIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgdHJpZ2dlciBvZiBPYmplY3QudmFsdWVzKHRoaXMudHJpZ2dlcnNbYCMkeyByb29tLl9pZCB9YF0pKSB7XG5cdFx0XHRcdFx0XHRcdHRyaWdnZXJzVG9FeGVjdXRlLnB1c2godHJpZ2dlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHJvb20uX2lkICE9PSByb29tLm5hbWUgJiYgdGhpcy50cmlnZ2Vyc1tgIyR7IHJvb20ubmFtZSB9YF0pIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgdHJpZ2dlciBvZiBPYmplY3QudmFsdWVzKHRoaXMudHJpZ2dlcnNbYCMkeyByb29tLm5hbWUgfWBdKSkge1xuXHRcdFx0XHRcdFx0XHR0cmlnZ2Vyc1RvRXhlY3V0ZS5wdXNoKHRyaWdnZXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGlmICh0aGlzLnRyaWdnZXJzLmFsbF9wcml2YXRlX2dyb3Vwcykge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCB0cmlnZ2VyIG9mIE9iamVjdC52YWx1ZXModGhpcy50cmlnZ2Vycy5hbGxfcHJpdmF0ZV9ncm91cHMpKSB7XG5cdFx0XHRcdFx0XHRcdHRyaWdnZXJzVG9FeGVjdXRlLnB1c2godHJpZ2dlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRoaXMudHJpZ2dlcnNbYCMkeyByb29tLl9pZCB9YF0pIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgdHJpZ2dlciBvZiBPYmplY3QudmFsdWVzKHRoaXMudHJpZ2dlcnNbYCMkeyByb29tLl9pZCB9YF0pKSB7XG5cdFx0XHRcdFx0XHRcdHRyaWdnZXJzVG9FeGVjdXRlLnB1c2godHJpZ2dlcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHJvb20uX2lkICE9PSByb29tLm5hbWUgJiYgdGhpcy50cmlnZ2Vyc1tgIyR7IHJvb20ubmFtZSB9YF0pIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgdHJpZ2dlciBvZiBPYmplY3QudmFsdWVzKHRoaXMudHJpZ2dlcnNbYCMkeyByb29tLm5hbWUgfWBdKSkge1xuXHRcdFx0XHRcdFx0XHR0cmlnZ2Vyc1RvRXhlY3V0ZS5wdXNoKHRyaWdnZXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy50cmlnZ2Vycy5fX2FueSkge1xuXHRcdFx0Ly9Gb3Igb3V0Z29pbmcgaW50ZWdyYXRpb24gd2hpY2ggZG9uJ3QgcmVseSBvbiByb29tcy5cblx0XHRcdGZvciAoY29uc3QgdHJpZ2dlciBvZiBPYmplY3QudmFsdWVzKHRoaXMudHJpZ2dlcnMuX19hbnkpKSB7XG5cdFx0XHRcdHRyaWdnZXJzVG9FeGVjdXRlLnB1c2godHJpZ2dlcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bG9nZ2VyLm91dGdvaW5nLmRlYnVnKGBGb3VuZCAkeyB0cmlnZ2Vyc1RvRXhlY3V0ZS5sZW5ndGggfSB0byBpdGVyYXRlIG92ZXIgYW5kIHNlZSBpZiB0aGUgbWF0Y2ggdGhlIGV2ZW50LmApO1xuXG5cdFx0Zm9yIChjb25zdCB0cmlnZ2VyVG9FeGVjdXRlIG9mIHRyaWdnZXJzVG9FeGVjdXRlKSB7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcuZGVidWcoYElzIFwiJHsgdHJpZ2dlclRvRXhlY3V0ZS5uYW1lIH1cIiBlbmFibGVkLCAkeyB0cmlnZ2VyVG9FeGVjdXRlLmVuYWJsZWQgfSwgYW5kIHdoYXQgaXMgdGhlIGV2ZW50PyAkeyB0cmlnZ2VyVG9FeGVjdXRlLmV2ZW50IH1gKTtcblx0XHRcdGlmICh0cmlnZ2VyVG9FeGVjdXRlLmVuYWJsZWQgPT09IHRydWUgJiYgdHJpZ2dlclRvRXhlY3V0ZS5ldmVudCA9PT0gZXZlbnQpIHtcblx0XHRcdFx0dGhpcy5leGVjdXRlVHJpZ2dlcih0cmlnZ2VyVG9FeGVjdXRlLCBhcmdPYmplY3QpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGV4ZWN1dGVUcmlnZ2VyKHRyaWdnZXIsIGFyZ09iamVjdCkge1xuXHRcdGZvciAoY29uc3QgdXJsIG9mIHRyaWdnZXIudXJscykge1xuXHRcdFx0dGhpcy5leGVjdXRlVHJpZ2dlclVybCh1cmwsIHRyaWdnZXIsIGFyZ09iamVjdCwgMCk7XG5cdFx0fVxuXHR9XG5cblx0ZXhlY3V0ZVRyaWdnZXJVcmwodXJsLCB0cmlnZ2VyLCB7IGV2ZW50LCBtZXNzYWdlLCByb29tLCBvd25lciwgdXNlciB9LCB0aGVIaXN0b3J5SWQsIHRyaWVzID0gMCkge1xuXHRcdGlmICghdGhpcy5pc1RyaWdnZXJFbmFibGVkKHRyaWdnZXIpKSB7XG5cdFx0XHRsb2dnZXIub3V0Z29pbmcud2FybihgVGhlIHRyaWdnZXIgXCIkeyB0cmlnZ2VyLm5hbWUgfVwiIGlzIG5vIGxvbmdlciBlbmFibGVkLCBzdG9wcGluZyBleGVjdXRpb24gb2YgaXQgYXQgdHJ5OiAkeyB0cmllcyB9YCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bG9nZ2VyLm91dGdvaW5nLmRlYnVnKGBTdGFydGluZyB0byBleGVjdXRlIHRyaWdnZXI6ICR7IHRyaWdnZXIubmFtZSB9ICgkeyB0cmlnZ2VyLl9pZCB9KWApO1xuXG5cdFx0bGV0IHdvcmQ7XG5cdFx0Ly9Ob3QgYWxsIHRyaWdnZXJzL2V2ZW50cyBzdXBwb3J0IHRyaWdnZXJXb3Jkc1xuXHRcdGlmIChSb2NrZXRDaGF0LmludGVncmF0aW9ucy5vdXRnb2luZ0V2ZW50c1tldmVudF0udXNlLnRyaWdnZXJXb3Jkcykge1xuXHRcdFx0aWYgKHRyaWdnZXIudHJpZ2dlcldvcmRzICYmIHRyaWdnZXIudHJpZ2dlcldvcmRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Zm9yIChjb25zdCB0cmlnZ2VyV29yZCBvZiB0cmlnZ2VyLnRyaWdnZXJXb3Jkcykge1xuXHRcdFx0XHRcdGlmICghdHJpZ2dlci50cmlnZ2VyV29yZEFueXdoZXJlICYmIG1lc3NhZ2UubXNnLmluZGV4T2YodHJpZ2dlcldvcmQpID09PSAwKSB7XG5cdFx0XHRcdFx0XHR3b3JkID0gdHJpZ2dlcldvcmQ7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHRyaWdnZXIudHJpZ2dlcldvcmRBbnl3aGVyZSAmJiBtZXNzYWdlLm1zZy5pbmNsdWRlcyh0cmlnZ2VyV29yZCkpIHtcblx0XHRcdFx0XHRcdHdvcmQgPSB0cmlnZ2VyV29yZDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFN0b3AgaWYgdGhlcmUgYXJlIHRyaWdnZXJXb3JkcyBidXQgbm9uZSBtYXRjaFxuXHRcdFx0XHRpZiAoIXdvcmQpIHtcblx0XHRcdFx0XHRsb2dnZXIub3V0Z29pbmcuZGVidWcoYFRoZSB0cmlnZ2VyIHdvcmQgd2hpY2ggXCIkeyB0cmlnZ2VyLm5hbWUgfVwiIHdhcyBleHBlY3RpbmcgY291bGQgbm90IGJlIGZvdW5kLCBub3QgZXhlY3V0aW5nLmApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChtZXNzYWdlICYmIG1lc3NhZ2UuZWRpdGVkQXQgJiYgIXRyaWdnZXIucnVuT25FZGl0cykge1xuXHRcdFx0bG9nZ2VyLm91dGdvaW5nLmRlYnVnKGBUaGUgdHJpZ2dlciBcIiR7IHRyaWdnZXIubmFtZSB9XCIncyBydW4gb24gZWRpdHMgaXMgZGlzYWJsZWQgYW5kIHRoZSBtZXNzYWdlIHdhcyBlZGl0ZWQuYCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGlzdG9yeUlkID0gdGhpcy51cGRhdGVIaXN0b3J5KHsgc3RlcDogJ3N0YXJ0LWV4ZWN1dGUtdHJpZ2dlci11cmwnLCBpbnRlZ3JhdGlvbjogdHJpZ2dlciwgZXZlbnQgfSk7XG5cblx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0dG9rZW46IHRyaWdnZXIudG9rZW4sXG5cdFx0XHRib3Q6IGZhbHNlXG5cdFx0fTtcblxuXHRcdGlmICh3b3JkKSB7XG5cdFx0XHRkYXRhLnRyaWdnZXJfd29yZCA9IHdvcmQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5tYXBFdmVudEFyZ3NUb0RhdGEoZGF0YSwgeyB0cmlnZ2VyLCBldmVudCwgbWVzc2FnZSwgcm9vbSwgb3duZXIsIHVzZXIgfSk7XG5cdFx0dGhpcy51cGRhdGVIaXN0b3J5KHsgaGlzdG9yeUlkLCBzdGVwOiAnbWFwcGVkLWFyZ3MtdG8tZGF0YScsIGRhdGEsIHRyaWdnZXJXb3JkOiB3b3JkIH0pO1xuXG5cdFx0bG9nZ2VyLm91dGdvaW5nLmluZm8oYFdpbGwgYmUgZXhlY3V0aW5nIHRoZSBJbnRlZ3JhdGlvbiBcIiR7IHRyaWdnZXIubmFtZSB9XCIgdG8gdGhlIHVybDogJHsgdXJsIH1gKTtcblx0XHRsb2dnZXIub3V0Z29pbmcuZGVidWcoZGF0YSk7XG5cblx0XHRsZXQgb3B0cyA9IHtcblx0XHRcdHBhcmFtczoge30sXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdHVybCxcblx0XHRcdGRhdGEsXG5cdFx0XHRhdXRoOiB1bmRlZmluZWQsXG5cdFx0XHRucG1SZXF1ZXN0T3B0aW9uczoge1xuXHRcdFx0XHRyZWplY3RVbmF1dGhvcml6ZWQ6ICFSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWxsb3dfSW52YWxpZF9TZWxmU2lnbmVkX0NlcnRzJyksXG5cdFx0XHRcdHN0cmljdFNTTDogIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBbGxvd19JbnZhbGlkX1NlbGZTaWduZWRfQ2VydHMnKVxuXHRcdFx0fSxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J1VzZXItQWdlbnQnOiAnTW96aWxsYS81LjAgKFgxMTsgTGludXggeDg2XzY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvNDEuMC4yMjI3LjAgU2FmYXJpLzUzNy4zNidcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMuaGFzU2NyaXB0QW5kTWV0aG9kKHRyaWdnZXIsICdwcmVwYXJlX291dGdvaW5nX3JlcXVlc3QnKSkge1xuXHRcdFx0b3B0cyA9IHRoaXMuZXhlY3V0ZVNjcmlwdCh0cmlnZ2VyLCAncHJlcGFyZV9vdXRnb2luZ19yZXF1ZXN0JywgeyByZXF1ZXN0OiBvcHRzIH0sIGhpc3RvcnlJZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVIaXN0b3J5KHsgaGlzdG9yeUlkLCBzdGVwOiAnYWZ0ZXItbWF5YmUtcmFuLXByZXBhcmUnLCByYW5QcmVwYXJlU2NyaXB0OiB0cnVlIH0pO1xuXG5cdFx0aWYgKCFvcHRzKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUhpc3RvcnkoeyBoaXN0b3J5SWQsIHN0ZXA6ICdhZnRlci1wcmVwYXJlLW5vLW9wdHMnLCBmaW5pc2hlZDogdHJ1ZSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAob3B0cy5tZXNzYWdlKSB7XG5cdFx0XHRjb25zdCBwcmVwYXJlTWVzc2FnZSA9IHRoaXMuc2VuZE1lc3NhZ2UoeyB0cmlnZ2VyLCByb29tLCBtZXNzYWdlOiBvcHRzLm1lc3NhZ2UsIGRhdGEgfSk7XG5cdFx0XHR0aGlzLnVwZGF0ZUhpc3RvcnkoeyBoaXN0b3J5SWQsIHN0ZXA6ICdhZnRlci1wcmVwYXJlLXNlbmQtbWVzc2FnZScsIHByZXBhcmVTZW50TWVzc2FnZTogcHJlcGFyZU1lc3NhZ2UgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFvcHRzLnVybCB8fCAhb3B0cy5tZXRob2QpIHtcblx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogJ2FmdGVyLXByZXBhcmUtbm8tdXJsX29yX21ldGhvZCcsIGZpbmlzaGVkOiB0cnVlIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogJ3ByZS1odHRwLWNhbGwnLCB1cmw6IG9wdHMudXJsLCBodHRwQ2FsbERhdGE6IG9wdHMuZGF0YSB9KTtcblx0XHRIVFRQLmNhbGwob3B0cy5tZXRob2QsIG9wdHMudXJsLCBvcHRzLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0bG9nZ2VyLm91dGdvaW5nLndhcm4oYFJlc3VsdCBmb3IgdGhlIEludGVncmF0aW9uICR7IHRyaWdnZXIubmFtZSB9IHRvICR7IHVybCB9IGlzIGVtcHR5YCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb2dnZXIub3V0Z29pbmcuaW5mbyhgU3RhdHVzIGNvZGUgZm9yIHRoZSBJbnRlZ3JhdGlvbiAkeyB0cmlnZ2VyLm5hbWUgfSB0byAkeyB1cmwgfSBpcyAkeyByZXN1bHQuc3RhdHVzQ29kZSB9YCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogJ2FmdGVyLWh0dHAtY2FsbCcsIGh0dHBFcnJvcjogZXJyb3IsIGh0dHBSZXN1bHQ6IHJlc3VsdCB9KTtcblxuXHRcdFx0aWYgKHRoaXMuaGFzU2NyaXB0QW5kTWV0aG9kKHRyaWdnZXIsICdwcm9jZXNzX291dGdvaW5nX3Jlc3BvbnNlJykpIHtcblx0XHRcdFx0Y29uc3Qgc2FuZGJveCA9IHtcblx0XHRcdFx0XHRyZXF1ZXN0OiBvcHRzLFxuXHRcdFx0XHRcdHJlc3BvbnNlOiB7XG5cdFx0XHRcdFx0XHRlcnJvcixcblx0XHRcdFx0XHRcdHN0YXR1c19jb2RlOiByZXN1bHQgPyByZXN1bHQuc3RhdHVzQ29kZSA6IHVuZGVmaW5lZCwgLy9UaGVzZSB2YWx1ZXMgd2lsbCBiZSB1bmRlZmluZWQgdG8gY2xvc2UgaXNzdWVzICM0MTc1LCAjNTc2MiwgYW5kICM1ODk2XG5cdFx0XHRcdFx0XHRjb250ZW50OiByZXN1bHQgPyByZXN1bHQuZGF0YSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGNvbnRlbnRfcmF3OiByZXN1bHQgPyByZXN1bHQuY29udGVudCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGhlYWRlcnM6IHJlc3VsdCA/IHJlc3VsdC5oZWFkZXJzIDoge31cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Y29uc3Qgc2NyaXB0UmVzdWx0ID0gdGhpcy5leGVjdXRlU2NyaXB0KHRyaWdnZXIsICdwcm9jZXNzX291dGdvaW5nX3Jlc3BvbnNlJywgc2FuZGJveCwgaGlzdG9yeUlkKTtcblxuXHRcdFx0XHRpZiAoc2NyaXB0UmVzdWx0ICYmIHNjcmlwdFJlc3VsdC5jb250ZW50KSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0TWVzc2FnZSA9IHRoaXMuc2VuZE1lc3NhZ2UoeyB0cmlnZ2VyLCByb29tLCBtZXNzYWdlOiBzY3JpcHRSZXN1bHQuY29udGVudCwgZGF0YSB9KTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUhpc3RvcnkoeyBoaXN0b3J5SWQsIHN0ZXA6ICdhZnRlci1wcm9jZXNzLXNlbmQtbWVzc2FnZScsIHByb2Nlc3NTZW50TWVzc2FnZTogcmVzdWx0TWVzc2FnZSwgZmluaXNoZWQ6IHRydWUgfSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHNjcmlwdFJlc3VsdCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUhpc3RvcnkoeyBoaXN0b3J5SWQsIHN0ZXA6ICdhZnRlci1wcm9jZXNzLWZhbHNlLXJlc3VsdCcsIGZpbmlzaGVkOiB0cnVlIH0pO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBpZiB0aGUgcmVzdWx0IGNvbnRhaW5lZCBub3RoaW5nIG9yIHdhc24ndCBhIHN1Y2Nlc3NmdWwgc3RhdHVzQ29kZVxuXHRcdFx0aWYgKCFyZXN1bHQgfHwgIXRoaXMuc3VjY2Vzc1Jlc3VsdHMuaW5jbHVkZXMocmVzdWx0LnN0YXR1c0NvZGUpKSB7XG5cdFx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRcdGxvZ2dlci5vdXRnb2luZy5lcnJvcihgRXJyb3IgZm9yIHRoZSBJbnRlZ3JhdGlvbiBcIiR7IHRyaWdnZXIubmFtZSB9XCIgdG8gJHsgdXJsIH0gaXM6YCk7XG5cdFx0XHRcdFx0bG9nZ2VyLm91dGdvaW5nLmVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRsb2dnZXIub3V0Z29pbmcuZXJyb3IoYEVycm9yIGZvciB0aGUgSW50ZWdyYXRpb24gXCIkeyB0cmlnZ2VyLm5hbWUgfVwiIHRvICR7IHVybCB9IGlzOmApO1xuXHRcdFx0XHRcdGxvZ2dlci5vdXRnb2luZy5lcnJvcihyZXN1bHQpO1xuXG5cdFx0XHRcdFx0aWYgKHJlc3VsdC5zdGF0dXNDb2RlID09PSA0MTApIHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogJ2FmdGVyLXByb2Nlc3MtaHR0cC1zdGF0dXMtNDEwJywgZXJyb3I6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHRsb2dnZXIub3V0Z29pbmcuZXJyb3IoYERpc2FibGluZyB0aGUgSW50ZWdyYXRpb24gXCIkeyB0cmlnZ2VyLm5hbWUgfVwiIGJlY2F1c2UgdGhlIHN0YXR1cyBjb2RlIHdhcyA0MDEgKEdvbmUpLmApO1xuXHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLnVwZGF0ZSh7IF9pZDogdHJpZ2dlci5faWQgfSwgeyAkc2V0OiB7IGVuYWJsZWQ6IGZhbHNlIH19KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocmVzdWx0LnN0YXR1c0NvZGUgPT09IDUwMCkge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVIaXN0b3J5KHsgaGlzdG9yeUlkLCBzdGVwOiAnYWZ0ZXItcHJvY2Vzcy1odHRwLXN0YXR1cy01MDAnLCBlcnJvcjogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdGxvZ2dlci5vdXRnb2luZy5lcnJvcihgRXJyb3IgXCI1MDBcIiBmb3IgdGhlIEludGVncmF0aW9uIFwiJHsgdHJpZ2dlci5uYW1lIH1cIiB0byAkeyB1cmwgfS5gKTtcblx0XHRcdFx0XHRcdGxvZ2dlci5vdXRnb2luZy5lcnJvcihyZXN1bHQuY29udGVudCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRyaWdnZXIucmV0cnlGYWlsZWRDYWxscykge1xuXHRcdFx0XHRcdGlmICh0cmllcyA8IHRyaWdnZXIucmV0cnlDb3VudCAmJiB0cmlnZ2VyLnJldHJ5RGVsYXkpIHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgZXJyb3I6IHRydWUsIHN0ZXA6IGBnb2luZy10by1yZXRyeS0keyB0cmllcyArIDEgfWAgfSk7XG5cblx0XHRcdFx0XHRcdGxldCB3YWl0VGltZTtcblxuXHRcdFx0XHRcdFx0c3dpdGNoICh0cmlnZ2VyLnJldHJ5RGVsYXkpIHtcblx0XHRcdFx0XHRcdFx0Y2FzZSAncG93ZXJzLW9mLXRlbic6XG5cdFx0XHRcdFx0XHRcdFx0Ly8gVHJ5IGFnYWluIGluIDAuMXMsIDFzLCAxMHMsIDFtNDBzLCAxNm00MHMsIDJoNDZtNDBzLCAyN2g0Nm00MHMsIGV0Y1xuXHRcdFx0XHRcdFx0XHRcdHdhaXRUaW1lID0gTWF0aC5wb3coMTAsIHRyaWVzICsgMik7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ3Bvd2Vycy1vZi10d28nOlxuXHRcdFx0XHRcdFx0XHRcdC8vIDIgc2Vjb25kcywgNCBzZWNvbmRzLCA4IHNlY29uZHNcblx0XHRcdFx0XHRcdFx0XHR3YWl0VGltZSA9IE1hdGgucG93KDIsIHRyaWVzICsgMSkgKiAxMDAwO1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRjYXNlICdpbmNyZW1lbnRzLW9mLXR3byc6XG5cdFx0XHRcdFx0XHRcdFx0Ly8gMiBzZWNvbmQsIDQgc2Vjb25kcywgNiBzZWNvbmRzLCBldGNcblx0XHRcdFx0XHRcdFx0XHR3YWl0VGltZSA9ICh0cmllcyArIDEpICogMiAqIDEwMDA7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZXIgPSBuZXcgRXJyb3IoJ1RoZSBpbnRlZ3JhdGlvblxcJ3MgcmV0cnlEZWxheSBzZXR0aW5nIGlzIGludmFsaWQuJyk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVIaXN0b3J5KHsgaGlzdG9yeUlkLCBzdGVwOiAnZmFpbGVkLWFuZC1yZXRyeS1kZWxheS1pcy1pbnZhbGlkJywgZXJyb3I6IHRydWUsIGVycm9yU3RhY2s6IGVyLnN0YWNrIH0pO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bG9nZ2VyLm91dGdvaW5nLmluZm8oYFRyeWluZyB0aGUgSW50ZWdyYXRpb24gJHsgdHJpZ2dlci5uYW1lIH0gdG8gJHsgdXJsIH0gYWdhaW4gaW4gJHsgd2FpdFRpbWUgfSBtaWxsaXNlY29uZHMuYCk7XG5cdFx0XHRcdFx0XHRNZXRlb3Iuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZXhlY3V0ZVRyaWdnZXJVcmwodXJsLCB0cmlnZ2VyLCB7IGV2ZW50LCBtZXNzYWdlLCByb29tLCBvd25lciwgdXNlciB9LCBoaXN0b3J5SWQsIHRyaWVzICsgMSk7XG5cdFx0XHRcdFx0XHR9LCB3YWl0VGltZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogJ3Rvby1tYW55LXJldHJpZXMnLCBlcnJvcjogdHJ1ZSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVIaXN0b3J5KHsgaGlzdG9yeUlkLCBzdGVwOiAnZmFpbGVkLWFuZC1ub3QtY29uZmlndXJlZC10by1yZXRyeScsIGVycm9yOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3Byb2Nlc3Mgb3V0Z29pbmcgd2ViaG9vayByZXNwb25zZSBhcyBhIG5ldyBtZXNzYWdlXG5cdFx0XHRpZiAocmVzdWx0ICYmIHRoaXMuc3VjY2Vzc1Jlc3VsdHMuaW5jbHVkZXMocmVzdWx0LnN0YXR1c0NvZGUpKSB7XG5cdFx0XHRcdGlmIChyZXN1bHQgJiYgcmVzdWx0LmRhdGEgJiYgKHJlc3VsdC5kYXRhLnRleHQgfHwgcmVzdWx0LmRhdGEuYXR0YWNobWVudHMpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0TXNnID0gdGhpcy5zZW5kTWVzc2FnZSh7IHRyaWdnZXIsIHJvb20sIG1lc3NhZ2U6IHJlc3VsdC5kYXRhLCBkYXRhIH0pO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlSGlzdG9yeSh7IGhpc3RvcnlJZCwgc3RlcDogJ3VybC1yZXNwb25zZS1zZW50LW1lc3NhZ2UnLCByZXN1bHRNZXNzYWdlOiByZXN1bHRNc2csIGZpbmlzaGVkOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXBsYXkoaW50ZWdyYXRpb24sIGhpc3RvcnkpIHtcblx0XHRpZiAoIWludGVncmF0aW9uIHx8IGludGVncmF0aW9uLnR5cGUgIT09ICd3ZWJob29rLW91dGdvaW5nJykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW50ZWdyYXRpb24tdHlwZS1tdXN0LWJlLW91dGdvaW5nJywgJ1RoZSBpbnRlZ3JhdGlvbiB0eXBlIHRvIHJlcGxheSBtdXN0IGJlIGFuIG91dGdvaW5nIHdlYmhvb2suJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFoaXN0b3J5IHx8ICFoaXN0b3J5LmRhdGEpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2hpc3RvcnktZGF0YS1tdXN0LWJlLWRlZmluZWQnLCAnVGhlIGhpc3RvcnkgZGF0YSBtdXN0IGJlIGRlZmluZWQgdG8gcmVwbGF5IGFuIGludGVncmF0aW9uLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV2ZW50ID0gaGlzdG9yeS5ldmVudDtcblx0XHRjb25zdCBtZXNzYWdlID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQoaGlzdG9yeS5kYXRhLm1lc3NhZ2VfaWQpO1xuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChoaXN0b3J5LmRhdGEuY2hhbm5lbF9pZCk7XG5cdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKGhpc3RvcnkuZGF0YS51c2VyX2lkKTtcblx0XHRsZXQgb3duZXI7XG5cblx0XHRpZiAoaGlzdG9yeS5kYXRhLm93bmVyICYmIGhpc3RvcnkuZGF0YS5vd25lci5faWQpIHtcblx0XHRcdG93bmVyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQoaGlzdG9yeS5kYXRhLm93bmVyLl9pZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5leGVjdXRlVHJpZ2dlclVybChoaXN0b3J5LnVybCwgaW50ZWdyYXRpb24sIHsgZXZlbnQsIG1lc3NhZ2UsIHJvb20sIG93bmVyLCB1c2VyIH0pO1xuXHR9XG59O1xuIiwiUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zID0gbmV3IGNsYXNzIEludGVncmF0aW9ucyBleHRlbmRzIFJvY2tldENoYXQubW9kZWxzLl9CYXNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ2ludGVncmF0aW9ucycpO1xuXHR9XG5cblx0ZmluZEJ5VHlwZSh0eXBlLCBvcHRpb25zKSB7XG5cdFx0aWYgKHR5cGUgIT09ICd3ZWJob29rLWluY29taW5nJyAmJiB0eXBlICE9PSAnd2ViaG9vay1vdXRnb2luZycpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtdHlwZS10by1maW5kJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZmluZCh7IHR5cGUgfSwgb3B0aW9ucyk7XG5cdH1cblxuXHRkaXNhYmxlQnlVc2VySWQodXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMudXBkYXRlKHsgdXNlcklkIH0sIHsgJHNldDogeyBlbmFibGVkOiBmYWxzZSB9fSwgeyBtdWx0aTogdHJ1ZSB9KTtcblx0fVxufTtcbiIsIlJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9uSGlzdG9yeSA9IG5ldyBjbGFzcyBJbnRlZ3JhdGlvbkhpc3RvcnkgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdpbnRlZ3JhdGlvbl9oaXN0b3J5Jyk7XG5cdH1cblxuXHRmaW5kQnlUeXBlKHR5cGUsIG9wdGlvbnMpIHtcblx0XHRpZiAodHlwZSAhPT0gJ291dGdvaW5nLXdlYmhvb2snIHx8IHR5cGUgIT09ICdpbmNvbWluZy13ZWJob29rJykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1pbnRlZ3JhdGlvbi10eXBlJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZmluZCh7IHR5cGUgfSwgb3B0aW9ucyk7XG5cdH1cblxuXHRmaW5kQnlJbnRlZ3JhdGlvbklkKGlkLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZCh7ICdpbnRlZ3JhdGlvbi5faWQnOiBpZCB9LCBvcHRpb25zKTtcblx0fVxuXG5cdGZpbmRCeUludGVncmF0aW9uSWRBbmRDcmVhdGVkQnkoaWQsIGNyZWF0b3JJZCwgb3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLmZpbmQoeyAnaW50ZWdyYXRpb24uX2lkJzogaWQsICdpbnRlZ3JhdGlvbi5fY3JlYXRlZEJ5Ll9pZCc6IGNyZWF0b3JJZCB9LCBvcHRpb25zKTtcblx0fVxuXG5cdGZpbmRPbmVCeUludGVncmF0aW9uSWRBbmRIaXN0b3J5SWQoaW50ZWdyYXRpb25JZCwgaGlzdG9yeUlkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZE9uZSh7ICdpbnRlZ3JhdGlvbi5faWQnOiBpbnRlZ3JhdGlvbklkLCBfaWQ6IGhpc3RvcnlJZCB9KTtcblx0fVxuXG5cdGZpbmRCeUV2ZW50TmFtZShldmVudCwgb3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLmZpbmQoeyBldmVudCB9LCBvcHRpb25zKTtcblx0fVxuXG5cdGZpbmRGYWlsZWQob3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLmZpbmQoeyBlcnJvcjogdHJ1ZSB9LCBvcHRpb25zKTtcblx0fVxuXG5cdHJlbW92ZUJ5SW50ZWdyYXRpb25JZChpbnRlZ3JhdGlvbklkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlKHsgJ2ludGVncmF0aW9uLl9pZCc6IGludGVncmF0aW9uSWQgfSk7XG5cdH1cbn07XG4iLCJNZXRlb3IucHVibGlzaCgnaW50ZWdyYXRpb25zJywgZnVuY3Rpb24gX2ludGVncmF0aW9uUHVibGljYXRpb24oKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cblx0aWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnKSkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbnMuZmluZCgpO1xuXHR9IGVsc2UgaWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1vd24taW50ZWdyYXRpb25zJykpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmQoeyAnX2NyZWF0ZWRCeS5faWQnOiB0aGlzLnVzZXJJZCB9KTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3QtYXV0aG9yaXplZCcpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdpbnRlZ3JhdGlvbkhpc3RvcnknLCBmdW5jdGlvbiBfaW50ZWdyYXRpb25IaXN0b3J5UHVibGljYXRpb24oaW50ZWdyYXRpb25JZCwgbGltaXQgPSAyNSkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxuXG5cdGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25IaXN0b3J5LmZpbmRCeUludGVncmF0aW9uSWQoaW50ZWdyYXRpb25JZCwgeyBzb3J0OiB7IF91cGRhdGVkQXQ6IC0xIH0sIGxpbWl0IH0pO1xuXHR9IGVsc2UgaWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1vd24taW50ZWdyYXRpb25zJykpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25IaXN0b3J5LmZpbmRCeUludGVncmF0aW9uSWRBbmRDcmVhdGVkQnkoaW50ZWdyYXRpb25JZCwgdGhpcy51c2VySWQsIHsgc29ydDogeyBfdXBkYXRlZEF0OiAtMSB9LCBsaW1pdCB9KTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3QtYXV0aG9yaXplZCcpO1xuXHR9XG59KTtcbiIsIi8qIGdsb2JhbCBCYWJlbCAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5pbXBvcnQgcyBmcm9tICd1bmRlcnNjb3JlLnN0cmluZyc7XG5jb25zdCB2YWxpZENoYW5uZWxDaGFycyA9IFsnQCcsICcjJ107XG5cbk1ldGVvci5tZXRob2RzKHtcblx0YWRkSW5jb21pbmdJbnRlZ3JhdGlvbihpbnRlZ3JhdGlvbikge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpICYmICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utb3duLWludGVncmF0aW9ucycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcsICdVbmF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ2FkZEluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmICghXy5pc1N0cmluZyhpbnRlZ3JhdGlvbi5jaGFubmVsKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jaGFubmVsJywgJ0ludmFsaWQgY2hhbm5lbCcsIHsgbWV0aG9kOiAnYWRkSW5jb21pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKGludGVncmF0aW9uLmNoYW5uZWwudHJpbSgpID09PSAnJykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jaGFubmVsJywgJ0ludmFsaWQgY2hhbm5lbCcsIHsgbWV0aG9kOiAnYWRkSW5jb21pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2hhbm5lbHMgPSBfLm1hcChpbnRlZ3JhdGlvbi5jaGFubmVsLnNwbGl0KCcsJyksIChjaGFubmVsKSA9PiBzLnRyaW0oY2hhbm5lbCkpO1xuXG5cdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGNoYW5uZWxzKSB7XG5cdFx0XHRpZiAoIXZhbGlkQ2hhbm5lbENoYXJzLmluY2x1ZGVzKGNoYW5uZWxbMF0pKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtY2hhbm5lbC1zdGFydC13aXRoLWNoYXJzJywgJ0ludmFsaWQgY2hhbm5lbC4gU3RhcnQgd2l0aCBAIG9yICMnLCB7IG1ldGhvZDogJ3VwZGF0ZUluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghXy5pc1N0cmluZyhpbnRlZ3JhdGlvbi51c2VybmFtZSkgfHwgaW50ZWdyYXRpb24udXNlcm5hbWUudHJpbSgpID09PSAnJykge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VybmFtZScsICdJbnZhbGlkIHVzZXJuYW1lJywgeyBtZXRob2Q6ICdhZGRJbmNvbWluZ0ludGVncmF0aW9uJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoaW50ZWdyYXRpb24uc2NyaXB0RW5hYmxlZCA9PT0gdHJ1ZSAmJiBpbnRlZ3JhdGlvbi5zY3JpcHQgJiYgaW50ZWdyYXRpb24uc2NyaXB0LnRyaW0oKSAhPT0gJycpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGxldCBiYWJlbE9wdGlvbnMgPSBCYWJlbC5nZXREZWZhdWx0T3B0aW9ucyh7IHJ1bnRpbWU6IGZhbHNlIH0pO1xuXHRcdFx0XHRiYWJlbE9wdGlvbnMgPSBfLmV4dGVuZChiYWJlbE9wdGlvbnMsIHsgY29tcGFjdDogdHJ1ZSwgbWluaWZpZWQ6IHRydWUsIGNvbW1lbnRzOiBmYWxzZSB9KTtcblxuXHRcdFx0XHRpbnRlZ3JhdGlvbi5zY3JpcHRDb21waWxlZCA9IEJhYmVsLmNvbXBpbGUoaW50ZWdyYXRpb24uc2NyaXB0LCBiYWJlbE9wdGlvbnMpLmNvZGU7XG5cdFx0XHRcdGludGVncmF0aW9uLnNjcmlwdEVycm9yID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRpbnRlZ3JhdGlvbi5zY3JpcHRDb21waWxlZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aW50ZWdyYXRpb24uc2NyaXB0RXJyb3IgPSBfLnBpY2soZSwgJ25hbWUnLCAnbWVzc2FnZScsICdzdGFjaycpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAobGV0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcblx0XHRcdGxldCByZWNvcmQ7XG5cdFx0XHRjb25zdCBjaGFubmVsVHlwZSA9IGNoYW5uZWxbMF07XG5cdFx0XHRjaGFubmVsID0gY2hhbm5lbC5zdWJzdHIoMSk7XG5cblx0XHRcdHN3aXRjaCAoY2hhbm5lbFR5cGUpIHtcblx0XHRcdFx0Y2FzZSAnIyc6XG5cdFx0XHRcdFx0cmVjb3JkID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZSh7XG5cdFx0XHRcdFx0XHQkb3I6IFtcblx0XHRcdFx0XHRcdFx0e19pZDogY2hhbm5lbH0sXG5cdFx0XHRcdFx0XHRcdHtuYW1lOiBjaGFubmVsfVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdAJzpcblx0XHRcdFx0XHRyZWNvcmQgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lKHtcblx0XHRcdFx0XHRcdCRvcjogW1xuXHRcdFx0XHRcdFx0XHR7X2lkOiBjaGFubmVsfSxcblx0XHRcdFx0XHRcdFx0e3VzZXJuYW1lOiBjaGFubmVsfVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXJlY29yZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJywgeyBtZXRob2Q6ICdhZGRJbmNvbWluZ0ludGVncmF0aW9uJyB9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlY29yZC51c2VybmFtZXMgJiYgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnKSAmJiBSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utb3duLWludGVncmF0aW9ucycpICYmICFyZWNvcmQudXNlcm5hbWVzLmluY2x1ZGVzKE1ldGVvci51c2VyKCkudXNlcm5hbWUpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtY2hhbm5lbCcsICdJbnZhbGlkIENoYW5uZWwnLCB7IG1ldGhvZDogJ2FkZEluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lKHt1c2VybmFtZTogaW50ZWdyYXRpb24udXNlcm5hbWV9KTtcblxuXHRcdGlmICghdXNlcikge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnYWRkSW5jb21pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9rZW4gPSBSYW5kb20uaWQoNDgpO1xuXG5cdFx0aW50ZWdyYXRpb24udHlwZSA9ICd3ZWJob29rLWluY29taW5nJztcblx0XHRpbnRlZ3JhdGlvbi50b2tlbiA9IHRva2VuO1xuXHRcdGludGVncmF0aW9uLmNoYW5uZWwgPSBjaGFubmVscztcblx0XHRpbnRlZ3JhdGlvbi51c2VySWQgPSB1c2VyLl9pZDtcblx0XHRpbnRlZ3JhdGlvbi5fY3JlYXRlZEF0ID0gbmV3IERhdGUoKTtcblx0XHRpbnRlZ3JhdGlvbi5fY3JlYXRlZEJ5ID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh0aGlzLnVzZXJJZCwge2ZpZWxkczoge3VzZXJuYW1lOiAxfX0pO1xuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuYWRkVXNlclJvbGVzKHVzZXIuX2lkLCAnYm90Jyk7XG5cblx0XHRpbnRlZ3JhdGlvbi5faWQgPSBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbnMuaW5zZXJ0KGludGVncmF0aW9uKTtcblxuXHRcdHJldHVybiBpbnRlZ3JhdGlvbjtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWwgQmFiZWwgKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuY29uc3QgdmFsaWRDaGFubmVsQ2hhcnMgPSBbJ0AnLCAnIyddO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdHVwZGF0ZUluY29taW5nSW50ZWdyYXRpb24oaW50ZWdyYXRpb25JZCwgaW50ZWdyYXRpb24pIHtcblx0XHRpZiAoIV8uaXNTdHJpbmcoaW50ZWdyYXRpb24uY2hhbm5lbCkgfHwgaW50ZWdyYXRpb24uY2hhbm5lbC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWNoYW5uZWwnLCAnSW52YWxpZCBjaGFubmVsJywgeyBtZXRob2Q6ICd1cGRhdGVJbmNvbWluZ0ludGVncmF0aW9uJyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGFubmVscyA9IF8ubWFwKGludGVncmF0aW9uLmNoYW5uZWwuc3BsaXQoJywnKSwgKGNoYW5uZWwpID0+IHMudHJpbShjaGFubmVsKSk7XG5cblx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcblx0XHRcdGlmICghdmFsaWRDaGFubmVsQ2hhcnMuaW5jbHVkZXMoY2hhbm5lbFswXSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jaGFubmVsLXN0YXJ0LXdpdGgtY2hhcnMnLCAnSW52YWxpZCBjaGFubmVsLiBTdGFydCB3aXRoIEAgb3IgIycsIHsgbWV0aG9kOiAndXBkYXRlSW5jb21pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGN1cnJlbnRJbnRlZ3JhdGlvbjtcblxuXHRcdGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykpIHtcblx0XHRcdGN1cnJlbnRJbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kT25lKGludGVncmF0aW9uSWQpO1xuXHRcdH0gZWxzZSBpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnKSkge1xuXHRcdFx0Y3VycmVudEludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoeyBfaWQ6IGludGVncmF0aW9uSWQsICdfY3JlYXRlZEJ5Ll9pZCc6IHRoaXMudXNlcklkIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcsICdVbmF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ3VwZGF0ZUluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmICghY3VycmVudEludGVncmF0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWludGVncmF0aW9uJywgJ0ludmFsaWQgaW50ZWdyYXRpb24nLCB7IG1ldGhvZDogJ3VwZGF0ZUluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmIChpbnRlZ3JhdGlvbi5zY3JpcHRFbmFibGVkID09PSB0cnVlICYmIGludGVncmF0aW9uLnNjcmlwdCAmJiBpbnRlZ3JhdGlvbi5zY3JpcHQudHJpbSgpICE9PSAnJykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IGJhYmVsT3B0aW9ucyA9IEJhYmVsLmdldERlZmF1bHRPcHRpb25zKHsgcnVudGltZTogZmFsc2UgfSk7XG5cdFx0XHRcdGJhYmVsT3B0aW9ucyA9IF8uZXh0ZW5kKGJhYmVsT3B0aW9ucywgeyBjb21wYWN0OiB0cnVlLCBtaW5pZmllZDogdHJ1ZSwgY29tbWVudHM6IGZhbHNlIH0pO1xuXG5cdFx0XHRcdGludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkID0gQmFiZWwuY29tcGlsZShpbnRlZ3JhdGlvbi5zY3JpcHQsIGJhYmVsT3B0aW9ucykuY29kZTtcblx0XHRcdFx0aW50ZWdyYXRpb24uc2NyaXB0RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpbnRlZ3JhdGlvbi5zY3JpcHRFcnJvciA9IF8ucGljayhlLCAnbmFtZScsICdtZXNzYWdlJywgJ3N0YWNrJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgY2hhbm5lbCBvZiBjaGFubmVscykge1xuXHRcdFx0Y29uc3QgY2hhbm5lbFR5cGUgPSBjaGFubmVsWzBdO1xuXHRcdFx0Y2hhbm5lbCA9IGNoYW5uZWwuc3Vic3RyKDEpO1xuXHRcdFx0bGV0IHJlY29yZDtcblxuXHRcdFx0c3dpdGNoIChjaGFubmVsVHlwZSkge1xuXHRcdFx0XHRjYXNlICcjJzpcblx0XHRcdFx0XHRyZWNvcmQgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lKHtcblx0XHRcdFx0XHRcdCRvcjogW1xuXHRcdFx0XHRcdFx0XHR7X2lkOiBjaGFubmVsfSxcblx0XHRcdFx0XHRcdFx0e25hbWU6IGNoYW5uZWx9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ0AnOlxuXHRcdFx0XHRcdHJlY29yZCA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmUoe1xuXHRcdFx0XHRcdFx0JG9yOiBbXG5cdFx0XHRcdFx0XHRcdHtfaWQ6IGNoYW5uZWx9LFxuXHRcdFx0XHRcdFx0XHR7dXNlcm5hbWU6IGNoYW5uZWx9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghcmVjb3JkKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nLCB7IG1ldGhvZDogJ3VwZGF0ZUluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVjb3JkLnVzZXJuYW1lcyAmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpICYmIFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1vd24taW50ZWdyYXRpb25zJykgJiYgIXJlY29yZC51c2VybmFtZXMuaW5jbHVkZXMoTWV0ZW9yLnVzZXIoKS51c2VybmFtZSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jaGFubmVsJywgJ0ludmFsaWQgQ2hhbm5lbCcsIHsgbWV0aG9kOiAndXBkYXRlSW5jb21pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmUoeyB1c2VybmFtZTogY3VycmVudEludGVncmF0aW9uLnVzZXJuYW1lIH0pO1xuXG5cdFx0aWYgKCF1c2VyIHx8ICF1c2VyLl9pZCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1wb3N0LWFzLXVzZXInLCAnSW52YWxpZCBQb3N0IEFzIFVzZXInLCB7IG1ldGhvZDogJ3VwZGF0ZUluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmFkZFVzZXJSb2xlcyh1c2VyLl9pZCwgJ2JvdCcpO1xuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLnVwZGF0ZShpbnRlZ3JhdGlvbklkLCB7XG5cdFx0XHQkc2V0OiB7XG5cdFx0XHRcdGVuYWJsZWQ6IGludGVncmF0aW9uLmVuYWJsZWQsXG5cdFx0XHRcdG5hbWU6IGludGVncmF0aW9uLm5hbWUsXG5cdFx0XHRcdGF2YXRhcjogaW50ZWdyYXRpb24uYXZhdGFyLFxuXHRcdFx0XHRlbW9qaTogaW50ZWdyYXRpb24uZW1vamksXG5cdFx0XHRcdGFsaWFzOiBpbnRlZ3JhdGlvbi5hbGlhcyxcblx0XHRcdFx0Y2hhbm5lbDogY2hhbm5lbHMsXG5cdFx0XHRcdHNjcmlwdDogaW50ZWdyYXRpb24uc2NyaXB0LFxuXHRcdFx0XHRzY3JpcHRFbmFibGVkOiBpbnRlZ3JhdGlvbi5zY3JpcHRFbmFibGVkLFxuXHRcdFx0XHRzY3JpcHRDb21waWxlZDogaW50ZWdyYXRpb24uc2NyaXB0Q29tcGlsZWQsXG5cdFx0XHRcdHNjcmlwdEVycm9yOiBpbnRlZ3JhdGlvbi5zY3JpcHRFcnJvcixcblx0XHRcdFx0X3VwZGF0ZWRBdDogbmV3IERhdGUoKSxcblx0XHRcdFx0X3VwZGF0ZWRCeTogUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh0aGlzLnVzZXJJZCwge2ZpZWxkczoge3VzZXJuYW1lOiAxfX0pXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoaW50ZWdyYXRpb25JZCk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRkZWxldGVJbmNvbWluZ0ludGVncmF0aW9uKGludGVncmF0aW9uSWQpIHtcblx0XHRsZXQgaW50ZWdyYXRpb247XG5cblx0XHRpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpKSB7XG5cdFx0XHRpbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kT25lKGludGVncmF0aW9uSWQpO1xuXHRcdH0gZWxzZSBpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnKSkge1xuXHRcdFx0aW50ZWdyYXRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbnMuZmluZE9uZShpbnRlZ3JhdGlvbklkLCB7IGZpZWxkcyA6IHsgJ19jcmVhdGVkQnkuX2lkJzogdGhpcy51c2VySWQgfX0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcsICdVbmF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ2RlbGV0ZUluY29taW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmICghaW50ZWdyYXRpb24pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtaW50ZWdyYXRpb24nLCAnSW52YWxpZCBpbnRlZ3JhdGlvbicsIHsgbWV0aG9kOiAnZGVsZXRlSW5jb21pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLnJlbW92ZSh7IF9pZDogaW50ZWdyYXRpb25JZCB9KTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0YWRkT3V0Z29pbmdJbnRlZ3JhdGlvbihpbnRlZ3JhdGlvbikge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpXG5cdFx0XHQmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnKVxuXHRcdFx0JiYgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnLCAnYm90Jylcblx0XHRcdCYmICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utb3duLWludGVncmF0aW9ucycsICdib3QnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90X2F1dGhvcml6ZWQnKTtcblx0XHR9XG5cblx0XHRpbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQuaW50ZWdyYXRpb25zLnZhbGlkYXRlT3V0Z29pbmcoaW50ZWdyYXRpb24sIHRoaXMudXNlcklkKTtcblxuXHRcdGludGVncmF0aW9uLl9jcmVhdGVkQXQgPSBuZXcgRGF0ZSgpO1xuXHRcdGludGVncmF0aW9uLl9jcmVhdGVkQnkgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lKHRoaXMudXNlcklkLCB7ZmllbGRzOiB7dXNlcm5hbWU6IDF9fSk7XG5cdFx0aW50ZWdyYXRpb24uX2lkID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmluc2VydChpbnRlZ3JhdGlvbik7XG5cblx0XHRyZXR1cm4gaW50ZWdyYXRpb247XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHR1cGRhdGVPdXRnb2luZ0ludGVncmF0aW9uKGludGVncmF0aW9uSWQsIGludGVncmF0aW9uKSB7XG5cdFx0aW50ZWdyYXRpb24gPSBSb2NrZXRDaGF0LmludGVncmF0aW9ucy52YWxpZGF0ZU91dGdvaW5nKGludGVncmF0aW9uLCB0aGlzLnVzZXJJZCk7XG5cblx0XHRpZiAoIWludGVncmF0aW9uLnRva2VuIHx8IGludGVncmF0aW9uLnRva2VuLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdG9rZW4nLCAnSW52YWxpZCB0b2tlbicsIHsgbWV0aG9kOiAndXBkYXRlT3V0Z29pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0bGV0IGN1cnJlbnRJbnRlZ3JhdGlvbjtcblxuXHRcdGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykpIHtcblx0XHRcdGN1cnJlbnRJbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kT25lKGludGVncmF0aW9uSWQpO1xuXHRcdH0gZWxzZSBpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnKSkge1xuXHRcdFx0Y3VycmVudEludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoeyBfaWQ6IGludGVncmF0aW9uSWQsICdfY3JlYXRlZEJ5Ll9pZCc6IHRoaXMudXNlcklkIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcsICdVbmF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ3VwZGF0ZU91dGdvaW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmICghY3VycmVudEludGVncmF0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkX2ludGVncmF0aW9uJywgJ1ttZXRob2RzXSB1cGRhdGVPdXRnb2luZ0ludGVncmF0aW9uIC0+IGludGVncmF0aW9uIG5vdCBmb3VuZCcpO1xuXHRcdH1cblxuXHRcdFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy51cGRhdGUoaW50ZWdyYXRpb25JZCwge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRldmVudDogaW50ZWdyYXRpb24uZXZlbnQsXG5cdFx0XHRcdGVuYWJsZWQ6IGludGVncmF0aW9uLmVuYWJsZWQsXG5cdFx0XHRcdG5hbWU6IGludGVncmF0aW9uLm5hbWUsXG5cdFx0XHRcdGF2YXRhcjogaW50ZWdyYXRpb24uYXZhdGFyLFxuXHRcdFx0XHRlbW9qaTogaW50ZWdyYXRpb24uZW1vamksXG5cdFx0XHRcdGFsaWFzOiBpbnRlZ3JhdGlvbi5hbGlhcyxcblx0XHRcdFx0Y2hhbm5lbDogaW50ZWdyYXRpb24uY2hhbm5lbCxcblx0XHRcdFx0dGFyZ2V0Um9vbTogaW50ZWdyYXRpb24udGFyZ2V0Um9vbSxcblx0XHRcdFx0aW1wZXJzb25hdGVVc2VyOiBpbnRlZ3JhdGlvbi5pbXBlcnNvbmF0ZVVzZXIsXG5cdFx0XHRcdHVzZXJuYW1lOiBpbnRlZ3JhdGlvbi51c2VybmFtZSxcblx0XHRcdFx0dXNlcklkOiBpbnRlZ3JhdGlvbi51c2VySWQsXG5cdFx0XHRcdHVybHM6IGludGVncmF0aW9uLnVybHMsXG5cdFx0XHRcdHRva2VuOiBpbnRlZ3JhdGlvbi50b2tlbixcblx0XHRcdFx0c2NyaXB0OiBpbnRlZ3JhdGlvbi5zY3JpcHQsXG5cdFx0XHRcdHNjcmlwdEVuYWJsZWQ6IGludGVncmF0aW9uLnNjcmlwdEVuYWJsZWQsXG5cdFx0XHRcdHNjcmlwdENvbXBpbGVkOiBpbnRlZ3JhdGlvbi5zY3JpcHRDb21waWxlZCxcblx0XHRcdFx0c2NyaXB0RXJyb3I6IGludGVncmF0aW9uLnNjcmlwdEVycm9yLFxuXHRcdFx0XHR0cmlnZ2VyV29yZHM6IGludGVncmF0aW9uLnRyaWdnZXJXb3Jkcyxcblx0XHRcdFx0cmV0cnlGYWlsZWRDYWxsczogaW50ZWdyYXRpb24ucmV0cnlGYWlsZWRDYWxscyxcblx0XHRcdFx0cmV0cnlDb3VudDogaW50ZWdyYXRpb24ucmV0cnlDb3VudCxcblx0XHRcdFx0cmV0cnlEZWxheTogaW50ZWdyYXRpb24ucmV0cnlEZWxheSxcblx0XHRcdFx0dHJpZ2dlcldvcmRBbnl3aGVyZTogaW50ZWdyYXRpb24udHJpZ2dlcldvcmRBbnl3aGVyZSxcblx0XHRcdFx0cnVuT25FZGl0czogaW50ZWdyYXRpb24ucnVuT25FZGl0cyxcblx0XHRcdFx0X3VwZGF0ZWRBdDogbmV3IERhdGUoKSxcblx0XHRcdFx0X3VwZGF0ZWRCeTogUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh0aGlzLnVzZXJJZCwge2ZpZWxkczoge3VzZXJuYW1lOiAxfX0pXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoaW50ZWdyYXRpb25JZCk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRyZXBsYXlPdXRnb2luZ0ludGVncmF0aW9uKHsgaW50ZWdyYXRpb25JZCwgaGlzdG9yeUlkIH0pIHtcblx0XHRsZXQgaW50ZWdyYXRpb247XG5cblx0XHRpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycpIHx8IFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnLCAnYm90JykpIHtcblx0XHRcdGludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoaW50ZWdyYXRpb25JZCk7XG5cdFx0fSBlbHNlIGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utb3duLWludGVncmF0aW9ucycpIHx8IFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1vd24taW50ZWdyYXRpb25zJywgJ2JvdCcpKSB7XG5cdFx0XHRpbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kT25lKGludGVncmF0aW9uSWQsIHsgZmllbGRzOiB7ICdfY3JlYXRlZEJ5Ll9pZCc6IHRoaXMudXNlcklkIH19KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90X2F1dGhvcml6ZWQnLCAnVW5hdXRob3JpemVkJywgeyBtZXRob2Q6ICdyZXBsYXlPdXRnb2luZ0ludGVncmF0aW9uJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoIWludGVncmF0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWludGVncmF0aW9uJywgJ0ludmFsaWQgaW50ZWdyYXRpb24nLCB7IG1ldGhvZDogJ3JlcGxheU91dGdvaW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhpc3RvcnkgPSBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbkhpc3RvcnkuZmluZE9uZUJ5SW50ZWdyYXRpb25JZEFuZEhpc3RvcnlJZChpbnRlZ3JhdGlvbi5faWQsIGhpc3RvcnlJZCk7XG5cblx0XHRpZiAoIWhpc3RvcnkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtaW50ZWdyYXRpb24taGlzdG9yeScsICdJbnZhbGlkIEludGVncmF0aW9uIEhpc3RvcnknLCB7IG1ldGhvZDogJ3JlcGxheU91dGdvaW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdFJvY2tldENoYXQuaW50ZWdyYXRpb25zLnRyaWdnZXJIYW5kbGVyLnJlcGxheShpbnRlZ3JhdGlvbiwgaGlzdG9yeSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdGRlbGV0ZU91dGdvaW5nSW50ZWdyYXRpb24oaW50ZWdyYXRpb25JZCkge1xuXHRcdGxldCBpbnRlZ3JhdGlvbjtcblxuXHRcdGlmIChSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJykgfHwgUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLWludGVncmF0aW9ucycsICdib3QnKSkge1xuXHRcdFx0aW50ZWdyYXRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbnMuZmluZE9uZShpbnRlZ3JhdGlvbklkKTtcblx0XHR9IGVsc2UgaWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1vd24taW50ZWdyYXRpb25zJykgfHwgUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnLCAnYm90JykpIHtcblx0XHRcdGludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoaW50ZWdyYXRpb25JZCwgeyBmaWVsZHM6IHsgJ19jcmVhdGVkQnkuX2lkJzogdGhpcy51c2VySWQgfX0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcsICdVbmF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ2RlbGV0ZU91dGdvaW5nSW50ZWdyYXRpb24nIH0pO1xuXHRcdH1cblxuXHRcdGlmICghaW50ZWdyYXRpb24pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtaW50ZWdyYXRpb24nLCAnSW52YWxpZCBpbnRlZ3JhdGlvbicsIHsgbWV0aG9kOiAnZGVsZXRlT3V0Z29pbmdJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLnJlbW92ZSh7IF9pZDogaW50ZWdyYXRpb25JZCB9KTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbkhpc3RvcnkucmVtb3ZlQnlJbnRlZ3JhdGlvbklkKGludGVncmF0aW9uSWQpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRjbGVhckludGVncmF0aW9uSGlzdG9yeShpbnRlZ3JhdGlvbklkKSB7XG5cdFx0bGV0IGludGVncmF0aW9uO1xuXG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1pbnRlZ3JhdGlvbnMnKSB8fCBSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtaW50ZWdyYXRpb25zJywgJ2JvdCcpKSB7XG5cdFx0XHRpbnRlZ3JhdGlvbiA9IFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9ucy5maW5kT25lKGludGVncmF0aW9uSWQpO1xuXHRcdH0gZWxzZSBpZiAoUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLW93bi1pbnRlZ3JhdGlvbnMnKSB8fCBSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utb3duLWludGVncmF0aW9ucycsICdib3QnKSkge1xuXHRcdFx0aW50ZWdyYXRpb24gPSBSb2NrZXRDaGF0Lm1vZGVscy5JbnRlZ3JhdGlvbnMuZmluZE9uZShpbnRlZ3JhdGlvbklkLCB7IGZpZWxkczogeyAnX2NyZWF0ZWRCeS5faWQnOiB0aGlzLnVzZXJJZCB9fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdF9hdXRob3JpemVkJywgJ1VuYXV0aG9yaXplZCcsIHsgbWV0aG9kOiAnY2xlYXJJbnRlZ3JhdGlvbkhpc3RvcnknIH0pO1xuXHRcdH1cblxuXHRcdGlmICghaW50ZWdyYXRpb24pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtaW50ZWdyYXRpb24nLCAnSW52YWxpZCBpbnRlZ3JhdGlvbicsIHsgbWV0aG9kOiAnY2xlYXJJbnRlZ3JhdGlvbkhpc3RvcnknIH0pO1xuXHRcdH1cblxuXHRcdFJvY2tldENoYXQubW9kZWxzLkludGVncmF0aW9uSGlzdG9yeS5yZW1vdmVCeUludGVncmF0aW9uSWQoaW50ZWdyYXRpb25JZCk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIEFwaSBNZXRlb3IgUmVzdGl2dXMgbG9nZ2VyIHByb2Nlc3NXZWJob29rTWVzc2FnZSovXG4vLyBUT0RPOiByZW1vdmUgZ2xvYmFsc1xuXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcbmltcG9ydCB2bSBmcm9tICd2bSc7XG5pbXBvcnQgbW9tZW50IGZyb20gJ21vbWVudCc7XG5cbmNvbnN0IGNvbXBpbGVkU2NyaXB0cyA9IHt9O1xuZnVuY3Rpb24gYnVpbGRTYW5kYm94KHN0b3JlID0ge30pIHtcblx0Y29uc3Qgc2FuZGJveCA9IHtcblx0XHRfLFxuXHRcdHMsXG5cdFx0Y29uc29sZSxcblx0XHRtb21lbnQsXG5cdFx0TGl2ZWNoYXQ6IFJvY2tldENoYXQuTGl2ZWNoYXQsXG5cdFx0U3RvcmU6IHtcblx0XHRcdHNldChrZXksIHZhbCkge1xuXHRcdFx0XHRyZXR1cm4gc3RvcmVba2V5XSA9IHZhbDtcblx0XHRcdH0sXG5cdFx0XHRnZXQoa2V5KSB7XG5cdFx0XHRcdHJldHVybiBzdG9yZVtrZXldO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0SFRUUChtZXRob2QsIHVybCwgb3B0aW9ucykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyZXN1bHQ6IEhUVFAuY2FsbChtZXRob2QsIHVybCwgb3B0aW9ucylcblx0XHRcdFx0fTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXJyb3Jcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0T2JqZWN0LmtleXMoUm9ja2V0Q2hhdC5tb2RlbHMpLmZpbHRlcigoaykgPT4gIWsuc3RhcnRzV2l0aCgnXycpKS5mb3JFYWNoKChrKSA9PiBzYW5kYm94W2tdID0gUm9ja2V0Q2hhdC5tb2RlbHNba10pO1xuXHRyZXR1cm4geyBzdG9yZSwgc2FuZGJveFx0fTtcbn1cblxuZnVuY3Rpb24gZ2V0SW50ZWdyYXRpb25TY3JpcHQoaW50ZWdyYXRpb24pIHtcblx0Y29uc3QgY29tcGlsZWRTY3JpcHQgPSBjb21waWxlZFNjcmlwdHNbaW50ZWdyYXRpb24uX2lkXTtcblx0aWYgKChjb21waWxlZFNjcmlwdCAhPSBudWxsKSAmJiArY29tcGlsZWRTY3JpcHQuX3VwZGF0ZWRBdCA9PT0gK2ludGVncmF0aW9uLl91cGRhdGVkQXQpIHtcblx0XHRyZXR1cm4gY29tcGlsZWRTY3JpcHQuc2NyaXB0O1xuXHR9XG5cdGNvbnN0IHNjcmlwdCA9IGludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkO1xuXHRjb25zdCB7c2FuZGJveCwgc3RvcmV9ID0gYnVpbGRTYW5kYm94KCk7XG5cdHRyeSB7XG5cdFx0bG9nZ2VyLmluY29taW5nLmluZm8oJ1dpbGwgZXZhbHVhdGUgc2NyaXB0IG9mIFRyaWdnZXInLCBpbnRlZ3JhdGlvbi5uYW1lKTtcblx0XHRsb2dnZXIuaW5jb21pbmcuZGVidWcoc2NyaXB0KTtcblx0XHRjb25zdCB2bVNjcmlwdCA9IHZtLmNyZWF0ZVNjcmlwdChzY3JpcHQsICdzY3JpcHQuanMnKTtcblx0XHR2bVNjcmlwdC5ydW5Jbk5ld0NvbnRleHQoc2FuZGJveCk7XG5cdFx0aWYgKHNhbmRib3guU2NyaXB0ICE9IG51bGwpIHtcblx0XHRcdGNvbXBpbGVkU2NyaXB0c1tpbnRlZ3JhdGlvbi5faWRdID0ge1xuXHRcdFx0XHRzY3JpcHQ6IG5ldyBzYW5kYm94LlNjcmlwdCgpLFxuXHRcdFx0XHRzdG9yZSxcblx0XHRcdFx0X3VwZGF0ZWRBdDogaW50ZWdyYXRpb24uX3VwZGF0ZWRBdFxuXHRcdFx0fTtcblx0XHRcdHJldHVybiBjb21waWxlZFNjcmlwdHNbaW50ZWdyYXRpb24uX2lkXS5zY3JpcHQ7XG5cdFx0fVxuXHR9IGNhdGNoICh7c3RhY2t9KSB7XG5cdFx0bG9nZ2VyLmluY29taW5nLmVycm9yKCdbRXJyb3IgZXZhbHVhdGluZyBTY3JpcHQgaW4gVHJpZ2dlcicsIGludGVncmF0aW9uLm5hbWUsICc6XScpO1xuXHRcdGxvZ2dlci5pbmNvbWluZy5lcnJvcihzY3JpcHQucmVwbGFjZSgvXi9nbSwgJyAgJykpO1xuXHRcdGxvZ2dlci5pbmNvbWluZy5lcnJvcignW1N0YWNrOl0nKTtcblx0XHRsb2dnZXIuaW5jb21pbmcuZXJyb3Ioc3RhY2sucmVwbGFjZSgvXi9nbSwgJyAgJykpO1xuXHRcdHRocm93IFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ2Vycm9yLWV2YWx1YXRpbmctc2NyaXB0Jyk7XG5cdH1cblx0aWYgKHNhbmRib3guU2NyaXB0ID09IG51bGwpIHtcblx0XHRsb2dnZXIuaW5jb21pbmcuZXJyb3IoJ1tDbGFzcyBcIlNjcmlwdFwiIG5vdCBpbiBUcmlnZ2VyJywgaW50ZWdyYXRpb24ubmFtZSwgJ10nKTtcblx0XHR0aHJvdyBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdjbGFzcy1zY3JpcHQtbm90LWZvdW5kJyk7XG5cdH1cbn1cblxuQXBpID0gbmV3IFJlc3RpdnVzKHtcblx0ZW5hYmxlQ29yczogdHJ1ZSxcblx0YXBpUGF0aDogJ2hvb2tzLycsXG5cdGF1dGg6IHtcblx0XHR1c2VyKCkge1xuXHRcdFx0Y29uc3QgcGF5bG9hZEtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmJvZHlQYXJhbXMpO1xuXHRcdFx0Y29uc3QgcGF5bG9hZElzV3JhcHBlZCA9ICh0aGlzLmJvZHlQYXJhbXMgJiYgdGhpcy5ib2R5UGFyYW1zLnBheWxvYWQpICYmIHBheWxvYWRLZXlzLmxlbmd0aCA9PT0gMTtcblx0XHRcdGlmIChwYXlsb2FkSXNXcmFwcGVkICYmIHRoaXMucmVxdWVzdC5oZWFkZXJzWydjb250ZW50LXR5cGUnXSA9PT0gJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR0aGlzLmJvZHlQYXJhbXMgPSBKU09OLnBhcnNlKHRoaXMuYm9keVBhcmFtcy5wYXlsb2FkKTtcblx0XHRcdFx0fSBjYXRjaCAoe21lc3NhZ2V9KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGVycm9yOiB7XG5cdFx0XHRcdFx0XHRcdHN0YXR1c0NvZGU6IDQwMCxcblx0XHRcdFx0XHRcdFx0Ym9keToge1xuXHRcdFx0XHRcdFx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdGVycm9yOiBtZXNzYWdlXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmludGVncmF0aW9uID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoe1xuXHRcdFx0XHRfaWQ6IHRoaXMucmVxdWVzdC5wYXJhbXMuaW50ZWdyYXRpb25JZCxcblx0XHRcdFx0dG9rZW46IGRlY29kZVVSSUNvbXBvbmVudCh0aGlzLnJlcXVlc3QucGFyYW1zLnRva2VuKVxuXHRcdFx0fSk7XG5cdFx0XHRpZiAodGhpcy5pbnRlZ3JhdGlvbiA9PSBudWxsKSB7XG5cdFx0XHRcdGxvZ2dlci5pbmNvbWluZy5pbmZvKCdJbnZhbGlkIGludGVncmF0aW9uIGlkJywgdGhpcy5yZXF1ZXN0LnBhcmFtcy5pbnRlZ3JhdGlvbklkLCAnb3IgdG9rZW4nLCB0aGlzLnJlcXVlc3QucGFyYW1zLnRva2VuKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmUoe1xuXHRcdFx0XHRfaWQ6IHRoaXMuaW50ZWdyYXRpb24udXNlcklkXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB7dXNlcn07XG5cdFx0fVxuXHR9XG59KTtcblxuZnVuY3Rpb24gY3JlYXRlSW50ZWdyYXRpb24ob3B0aW9ucywgdXNlcikge1xuXHRsb2dnZXIuaW5jb21pbmcuaW5mbygnQWRkIGludGVncmF0aW9uJywgb3B0aW9ucy5uYW1lKTtcblx0bG9nZ2VyLmluY29taW5nLmRlYnVnKG9wdGlvbnMpO1xuXHRNZXRlb3IucnVuQXNVc2VyKHVzZXIuX2lkLCBmdW5jdGlvbigpIHtcblx0XHRzd2l0Y2ggKG9wdGlvbnNbJ2V2ZW50J10pIHtcblx0XHRcdGNhc2UgJ25ld01lc3NhZ2VPbkNoYW5uZWwnOlxuXHRcdFx0XHRpZiAob3B0aW9ucy5kYXRhID09IG51bGwpIHtcblx0XHRcdFx0XHRvcHRpb25zLmRhdGEgPSB7fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoKG9wdGlvbnMuZGF0YS5jaGFubmVsX25hbWUgIT0gbnVsbCkgJiYgb3B0aW9ucy5kYXRhLmNoYW5uZWxfbmFtZS5pbmRleE9mKCcjJykgPT09IC0xKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5kYXRhLmNoYW5uZWxfbmFtZSA9IGAjJHsgb3B0aW9ucy5kYXRhLmNoYW5uZWxfbmFtZSB9YDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gTWV0ZW9yLmNhbGwoJ2FkZE91dGdvaW5nSW50ZWdyYXRpb24nLCB7XG5cdFx0XHRcdFx0dXNlcm5hbWU6ICdyb2NrZXQuY2F0Jyxcblx0XHRcdFx0XHR1cmxzOiBbb3B0aW9ucy50YXJnZXRfdXJsXSxcblx0XHRcdFx0XHRuYW1lOiBvcHRpb25zLm5hbWUsXG5cdFx0XHRcdFx0Y2hhbm5lbDogb3B0aW9ucy5kYXRhLmNoYW5uZWxfbmFtZSxcblx0XHRcdFx0XHR0cmlnZ2VyV29yZHM6IG9wdGlvbnMuZGF0YS50cmlnZ2VyX3dvcmRzXG5cdFx0XHRcdH0pO1xuXHRcdFx0Y2FzZSAnbmV3TWVzc2FnZVRvVXNlcic6XG5cdFx0XHRcdGlmIChvcHRpb25zLmRhdGEudXNlcm5hbWUuaW5kZXhPZignQCcpID09PSAtMSkge1xuXHRcdFx0XHRcdG9wdGlvbnMuZGF0YS51c2VybmFtZSA9IGBAJHsgb3B0aW9ucy5kYXRhLnVzZXJuYW1lIH1gO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBNZXRlb3IuY2FsbCgnYWRkT3V0Z29pbmdJbnRlZ3JhdGlvbicsIHtcblx0XHRcdFx0XHR1c2VybmFtZTogJ3JvY2tldC5jYXQnLFxuXHRcdFx0XHRcdHVybHM6IFtvcHRpb25zLnRhcmdldF91cmxdLFxuXHRcdFx0XHRcdG5hbWU6IG9wdGlvbnMubmFtZSxcblx0XHRcdFx0XHRjaGFubmVsOiBvcHRpb25zLmRhdGEudXNlcm5hbWUsXG5cdFx0XHRcdFx0dHJpZ2dlcldvcmRzOiBvcHRpb25zLmRhdGEudHJpZ2dlcl93b3Jkc1xuXHRcdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVJbnRlZ3JhdGlvbihvcHRpb25zLCB1c2VyKSB7XG5cdGxvZ2dlci5pbmNvbWluZy5pbmZvKCdSZW1vdmUgaW50ZWdyYXRpb24nKTtcblx0bG9nZ2VyLmluY29taW5nLmRlYnVnKG9wdGlvbnMpO1xuXHRjb25zdCBpbnRlZ3JhdGlvblRvUmVtb3ZlID0gUm9ja2V0Q2hhdC5tb2RlbHMuSW50ZWdyYXRpb25zLmZpbmRPbmUoe1xuXHRcdHVybHM6IG9wdGlvbnMudGFyZ2V0X3VybFxuXHR9KTtcblx0TWV0ZW9yLnJ1bkFzVXNlcih1c2VyLl9pZCwgKCkgPT4ge1xuXHRcdHJldHVybiBNZXRlb3IuY2FsbCgnZGVsZXRlT3V0Z29pbmdJbnRlZ3JhdGlvbicsIGludGVncmF0aW9uVG9SZW1vdmUuX2lkKTtcblx0fSk7XG5cdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKCk7XG59XG5cbmZ1bmN0aW9uIGV4ZWN1dGVJbnRlZ3JhdGlvblJlc3QoKSB7XG5cdGxvZ2dlci5pbmNvbWluZy5pbmZvKCdQb3N0IGludGVncmF0aW9uOicsIHRoaXMuaW50ZWdyYXRpb24ubmFtZSk7XG5cdGxvZ2dlci5pbmNvbWluZy5kZWJ1ZygnQHVybFBhcmFtczonLCB0aGlzLnVybFBhcmFtcyk7XG5cdGxvZ2dlci5pbmNvbWluZy5kZWJ1ZygnQGJvZHlQYXJhbXM6JywgdGhpcy5ib2R5UGFyYW1zKTtcblxuXHRpZiAodGhpcy5pbnRlZ3JhdGlvbi5lbmFibGVkICE9PSB0cnVlKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXR1c0NvZGU6IDUwMyxcblx0XHRcdGJvZHk6ICdTZXJ2aWNlIFVuYXZhaWxhYmxlJ1xuXHRcdH07XG5cdH1cblxuXHRjb25zdCBkZWZhdWx0VmFsdWVzID0ge1xuXHRcdGNoYW5uZWw6IHRoaXMuaW50ZWdyYXRpb24uY2hhbm5lbCxcblx0XHRhbGlhczogdGhpcy5pbnRlZ3JhdGlvbi5hbGlhcyxcblx0XHRhdmF0YXI6IHRoaXMuaW50ZWdyYXRpb24uYXZhdGFyLFxuXHRcdGVtb2ppOiB0aGlzLmludGVncmF0aW9uLmVtb2ppXG5cdH07XG5cblx0aWYgKHRoaXMuaW50ZWdyYXRpb24uc2NyaXB0RW5hYmxlZCA9PT0gdHJ1ZSAmJiB0aGlzLmludGVncmF0aW9uLnNjcmlwdENvbXBpbGVkICYmIHRoaXMuaW50ZWdyYXRpb24uc2NyaXB0Q29tcGlsZWQudHJpbSgpICE9PSAnJykge1xuXHRcdGxldCBzY3JpcHQ7XG5cdFx0dHJ5IHtcblx0XHRcdHNjcmlwdCA9IGdldEludGVncmF0aW9uU2NyaXB0KHRoaXMuaW50ZWdyYXRpb24pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGxvZ2dlci5pbmNvbWluZy53YXJuKGUpO1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZS5tZXNzYWdlKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXF1ZXN0ID0ge1xuXHRcdFx0dXJsOiB7XG5cdFx0XHRcdGhhc2g6IHRoaXMucmVxdWVzdC5fcGFyc2VkVXJsLmhhc2gsXG5cdFx0XHRcdHNlYXJjaDogdGhpcy5yZXF1ZXN0Ll9wYXJzZWRVcmwuc2VhcmNoLFxuXHRcdFx0XHRxdWVyeTogdGhpcy5xdWVyeVBhcmFtcyxcblx0XHRcdFx0cGF0aG5hbWU6IHRoaXMucmVxdWVzdC5fcGFyc2VkVXJsLnBhdGhuYW1lLFxuXHRcdFx0XHRwYXRoOiB0aGlzLnJlcXVlc3QuX3BhcnNlZFVybC5wYXRoXG5cdFx0XHR9LFxuXHRcdFx0dXJsX3JhdzogdGhpcy5yZXF1ZXN0LnVybCxcblx0XHRcdHVybF9wYXJhbXM6IHRoaXMudXJsUGFyYW1zLFxuXHRcdFx0Y29udGVudDogdGhpcy5ib2R5UGFyYW1zLFxuXHRcdFx0Y29udGVudF9yYXc6IHRoaXMucmVxdWVzdC5fcmVhZGFibGVTdGF0ZSAmJiB0aGlzLnJlcXVlc3QuX3JlYWRhYmxlU3RhdGUuYnVmZmVyICYmIHRoaXMucmVxdWVzdC5fcmVhZGFibGVTdGF0ZS5idWZmZXIudG9TdHJpbmcoKSxcblx0XHRcdGhlYWRlcnM6IHRoaXMucmVxdWVzdC5oZWFkZXJzLFxuXHRcdFx0dXNlcjoge1xuXHRcdFx0XHRfaWQ6IHRoaXMudXNlci5faWQsXG5cdFx0XHRcdG5hbWU6IHRoaXMudXNlci5uYW1lLFxuXHRcdFx0XHR1c2VybmFtZTogdGhpcy51c2VyLnVzZXJuYW1lXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB7IHNhbmRib3ggfSA9IGJ1aWxkU2FuZGJveChjb21waWxlZFNjcmlwdHNbdGhpcy5pbnRlZ3JhdGlvbi5faWRdLnN0b3JlKTtcblx0XHRcdHNhbmRib3guc2NyaXB0ID0gc2NyaXB0O1xuXHRcdFx0c2FuZGJveC5yZXF1ZXN0ID0gcmVxdWVzdDtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdm0ucnVuSW5OZXdDb250ZXh0KCdzY3JpcHQucHJvY2Vzc19pbmNvbWluZ19yZXF1ZXN0KHsgcmVxdWVzdDogcmVxdWVzdCB9KScsIHNhbmRib3gsIHtcblx0XHRcdFx0dGltZW91dDogMzAwMFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdGxvZ2dlci5pbmNvbWluZy5kZWJ1ZygnW1Byb2Nlc3MgSW5jb21pbmcgUmVxdWVzdCByZXN1bHQgb2YgVHJpZ2dlcicsIHRoaXMuaW50ZWdyYXRpb24ubmFtZSwgJzpdIE5vIGRhdGEnKTtcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0ICYmIHJlc3VsdC5lcnJvcikge1xuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShyZXN1bHQuZXJyb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmJvZHlQYXJhbXMgPSByZXN1bHQgJiYgcmVzdWx0LmNvbnRlbnQ7XG5cdFx0XHR0aGlzLnNjcmlwdFJlc3BvbnNlID0gcmVzdWx0LnJlc3BvbnNlO1xuXHRcdFx0aWYgKHJlc3VsdC51c2VyKSB7XG5cdFx0XHRcdHRoaXMudXNlciA9IHJlc3VsdC51c2VyO1xuXHRcdFx0fVxuXG5cdFx0XHRsb2dnZXIuaW5jb21pbmcuZGVidWcoJ1tQcm9jZXNzIEluY29taW5nIFJlcXVlc3QgcmVzdWx0IG9mIFRyaWdnZXInLCB0aGlzLmludGVncmF0aW9uLm5hbWUsICc6XScpO1xuXHRcdFx0bG9nZ2VyLmluY29taW5nLmRlYnVnKCdyZXN1bHQnLCB0aGlzLmJvZHlQYXJhbXMpO1xuXHRcdH0gY2F0Y2ggKHtzdGFja30pIHtcblx0XHRcdGxvZ2dlci5pbmNvbWluZy5lcnJvcignW0Vycm9yIHJ1bm5pbmcgU2NyaXB0IGluIFRyaWdnZXInLCB0aGlzLmludGVncmF0aW9uLm5hbWUsICc6XScpO1xuXHRcdFx0bG9nZ2VyLmluY29taW5nLmVycm9yKHRoaXMuaW50ZWdyYXRpb24uc2NyaXB0Q29tcGlsZWQucmVwbGFjZSgvXi9nbSwgJyAgJykpO1xuXHRcdFx0bG9nZ2VyLmluY29taW5nLmVycm9yKCdbU3RhY2s6XScpO1xuXHRcdFx0bG9nZ2VyLmluY29taW5nLmVycm9yKHN0YWNrLnJlcGxhY2UoL14vZ20sICcgICcpKTtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdlcnJvci1ydW5uaW5nLXNjcmlwdCcpO1xuXHRcdH1cblx0fVxuXG5cdC8vIFRPRE86IFR1cm4gdGhpcyBpbnRvIGFuIG9wdGlvbiBvbiB0aGUgaW50ZWdyYXRpb25zIC0gbm8gYm9keSBtZWFucyBhIHN1Y2Nlc3Ncblx0Ly8gVE9ETzogVGVtcG9yYXJ5IGZpeCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL1JvY2tldENoYXQvUm9ja2V0LkNoYXQvaXNzdWVzLzc3NzAgdW50aWwgdGhlIGFib3ZlIGlzIGltcGxlbWVudGVkXG5cdGlmICghdGhpcy5ib2R5UGFyYW1zKSB7XG5cdFx0Ly8gcmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoJ2JvZHktZW1wdHknKTtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHR9XG5cblx0dGhpcy5ib2R5UGFyYW1zLmJvdCA9IHsgaTogdGhpcy5pbnRlZ3JhdGlvbi5faWQgfTtcblxuXHR0cnkge1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSBwcm9jZXNzV2ViaG9va01lc3NhZ2UodGhpcy5ib2R5UGFyYW1zLCB0aGlzLnVzZXIsIGRlZmF1bHRWYWx1ZXMpO1xuXHRcdGlmIChfLmlzRW1wdHkobWVzc2FnZSkpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCd1bmtub3duLWVycm9yJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2NyaXB0UmVzcG9uc2UpIHtcblx0XHRcdGxvZ2dlci5pbmNvbWluZy5kZWJ1ZygncmVzcG9uc2UnLCB0aGlzLnNjcmlwdFJlc3BvbnNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh0aGlzLnNjcmlwdFJlc3BvbnNlKTtcblx0fSBjYXRjaCAoeyBlcnJvciB9KSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZXJyb3IpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFkZEludGVncmF0aW9uUmVzdCgpIHtcblx0cmV0dXJuIGNyZWF0ZUludGVncmF0aW9uKHRoaXMuYm9keVBhcmFtcywgdGhpcy51c2VyKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlSW50ZWdyYXRpb25SZXN0KCkge1xuXHRyZXR1cm4gcmVtb3ZlSW50ZWdyYXRpb24odGhpcy5ib2R5UGFyYW1zLCB0aGlzLnVzZXIpO1xufVxuXG5mdW5jdGlvbiBpbnRlZ3JhdGlvblNhbXBsZVJlc3QoKSB7XG5cdGxvZ2dlci5pbmNvbWluZy5pbmZvKCdTYW1wbGUgSW50ZWdyYXRpb24nKTtcblx0cmV0dXJuIHtcblx0XHRzdGF0dXNDb2RlOiAyMDAsXG5cdFx0Ym9keTogW1xuXHRcdFx0e1xuXHRcdFx0XHR0b2tlbjogUmFuZG9tLmlkKDI0KSxcblx0XHRcdFx0Y2hhbm5lbF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdGNoYW5uZWxfbmFtZTogJ2dlbmVyYWwnLFxuXHRcdFx0XHR0aW1lc3RhbXA6IG5ldyBEYXRlLFxuXHRcdFx0XHR1c2VyX2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0dXNlcl9uYW1lOiAncm9ja2V0LmNhdCcsXG5cdFx0XHRcdHRleHQ6ICdTYW1wbGUgdGV4dCAxJyxcblx0XHRcdFx0dHJpZ2dlcl93b3JkOiAnU2FtcGxlJ1xuXHRcdFx0fSwge1xuXHRcdFx0XHR0b2tlbjogUmFuZG9tLmlkKDI0KSxcblx0XHRcdFx0Y2hhbm5lbF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdGNoYW5uZWxfbmFtZTogJ2dlbmVyYWwnLFxuXHRcdFx0XHR0aW1lc3RhbXA6IG5ldyBEYXRlLFxuXHRcdFx0XHR1c2VyX2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0dXNlcl9uYW1lOiAncm9ja2V0LmNhdCcsXG5cdFx0XHRcdHRleHQ6ICdTYW1wbGUgdGV4dCAyJyxcblx0XHRcdFx0dHJpZ2dlcl93b3JkOiAnU2FtcGxlJ1xuXHRcdFx0fSwge1xuXHRcdFx0XHR0b2tlbjogUmFuZG9tLmlkKDI0KSxcblx0XHRcdFx0Y2hhbm5lbF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdGNoYW5uZWxfbmFtZTogJ2dlbmVyYWwnLFxuXHRcdFx0XHR0aW1lc3RhbXA6IG5ldyBEYXRlLFxuXHRcdFx0XHR1c2VyX2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0dXNlcl9uYW1lOiAncm9ja2V0LmNhdCcsXG5cdFx0XHRcdHRleHQ6ICdTYW1wbGUgdGV4dCAzJyxcblx0XHRcdFx0dHJpZ2dlcl93b3JkOiAnU2FtcGxlJ1xuXHRcdFx0fVxuXHRcdF1cblx0fTtcbn1cblxuZnVuY3Rpb24gaW50ZWdyYXRpb25JbmZvUmVzdCgpIHtcblx0bG9nZ2VyLmluY29taW5nLmluZm8oJ0luZm8gaW50ZWdyYXRpb24nKTtcblx0cmV0dXJuIHtcblx0XHRzdGF0dXNDb2RlOiAyMDAsXG5cdFx0Ym9keToge1xuXHRcdFx0c3VjY2VzczogdHJ1ZVxuXHRcdH1cblx0fTtcbn1cblxuQXBpLmFkZFJvdXRlKCc6aW50ZWdyYXRpb25JZC86dXNlcklkLzp0b2tlbicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0cG9zdDogZXhlY3V0ZUludGVncmF0aW9uUmVzdCxcblx0Z2V0OiBleGVjdXRlSW50ZWdyYXRpb25SZXN0XG59KTtcblxuQXBpLmFkZFJvdXRlKCc6aW50ZWdyYXRpb25JZC86dG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3Q6IGV4ZWN1dGVJbnRlZ3JhdGlvblJlc3QsXG5cdGdldDogZXhlY3V0ZUludGVncmF0aW9uUmVzdFxufSk7XG5cbkFwaS5hZGRSb3V0ZSgnc2FtcGxlLzppbnRlZ3JhdGlvbklkLzp1c2VySWQvOnRva2VuJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQ6IGludGVncmF0aW9uU2FtcGxlUmVzdFxufSk7XG5cbkFwaS5hZGRSb3V0ZSgnc2FtcGxlLzppbnRlZ3JhdGlvbklkLzp0b2tlbicsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0OiBpbnRlZ3JhdGlvblNhbXBsZVJlc3Rcbn0pO1xuXG5BcGkuYWRkUm91dGUoJ2luZm8vOmludGVncmF0aW9uSWQvOnVzZXJJZC86dG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldDogaW50ZWdyYXRpb25JbmZvUmVzdFxufSk7XG5cbkFwaS5hZGRSb3V0ZSgnaW5mby86aW50ZWdyYXRpb25JZC86dG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldDogaW50ZWdyYXRpb25JbmZvUmVzdFxufSk7XG5cbkFwaS5hZGRSb3V0ZSgnYWRkLzppbnRlZ3JhdGlvbklkLzp1c2VySWQvOnRva2VuJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0OiBhZGRJbnRlZ3JhdGlvblJlc3Rcbn0pO1xuXG5BcGkuYWRkUm91dGUoJ2FkZC86aW50ZWdyYXRpb25JZC86dG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3Q6IGFkZEludGVncmF0aW9uUmVzdFxufSk7XG5cbkFwaS5hZGRSb3V0ZSgncmVtb3ZlLzppbnRlZ3JhdGlvbklkLzp1c2VySWQvOnRva2VuJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRwb3N0OiByZW1vdmVJbnRlZ3JhdGlvblJlc3Rcbn0pO1xuXG5BcGkuYWRkUm91dGUoJ3JlbW92ZS86aW50ZWdyYXRpb25JZC86dG9rZW4nLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdHBvc3Q6IHJlbW92ZUludGVncmF0aW9uUmVzdFxufSk7XG4iLCJjb25zdCBjYWxsYmFja0hhbmRsZXIgPSBmdW5jdGlvbiBfY2FsbGJhY2tIYW5kbGVyKGV2ZW50VHlwZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gX3dyYXBwZXJGdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5pbnRlZ3JhdGlvbnMudHJpZ2dlckhhbmRsZXIuZXhlY3V0ZVRyaWdnZXJzKGV2ZW50VHlwZSwgLi4uYXJndW1lbnRzKTtcblx0fTtcbn07XG5cblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJTYXZlTWVzc2FnZScsIGNhbGxiYWNrSGFuZGxlcignc2VuZE1lc3NhZ2UnKSwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTE9XKTtcblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJDcmVhdGVDaGFubmVsJywgY2FsbGJhY2tIYW5kbGVyKCdyb29tQ3JlYXRlZCcpLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1cpO1xuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlckNyZWF0ZVByaXZhdGVHcm91cCcsIGNhbGxiYWNrSGFuZGxlcigncm9vbUNyZWF0ZWQnKSwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTE9XKTtcblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJDcmVhdGVVc2VyJywgY2FsbGJhY2tIYW5kbGVyKCd1c2VyQ3JlYXRlZCcpLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1cpO1xuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlckpvaW5Sb29tJywgY2FsbGJhY2tIYW5kbGVyKCdyb29tSm9pbmVkJyksIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVyk7XG5Sb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2FmdGVyTGVhdmVSb29tJywgY2FsbGJhY2tIYW5kbGVyKCdyb29tTGVmdCcpLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1cpO1xuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlclJvb21BcmNoaXZlZCcsIGNhbGxiYWNrSGFuZGxlcigncm9vbUFyY2hpdmVkJyksIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVyk7XG5Sb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2FmdGVyRmlsZVVwbG9hZCcsIGNhbGxiYWNrSGFuZGxlcignZmlsZVVwbG9hZGVkJyksIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVyk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcblxudGhpcy5wcm9jZXNzV2ViaG9va01lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlT2JqLCB1c2VyLCBkZWZhdWx0VmFsdWVzID0geyBjaGFubmVsOiAnJywgYWxpYXM6ICcnLCBhdmF0YXI6ICcnLCBlbW9qaTogJycgfSwgbXVzdEJlSm9pbmVkID0gZmFsc2UpIHtcblx0Y29uc3Qgc2VudERhdGEgPSBbXTtcblx0Y29uc3QgY2hhbm5lbHMgPSBbXS5jb25jYXQobWVzc2FnZU9iai5jaGFubmVsIHx8IG1lc3NhZ2VPYmoucm9vbUlkIHx8IGRlZmF1bHRWYWx1ZXMuY2hhbm5lbCk7XG5cblx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGNoYW5uZWxzKSB7XG5cdFx0Y29uc3QgY2hhbm5lbFR5cGUgPSBjaGFubmVsWzBdO1xuXG5cdFx0bGV0IGNoYW5uZWxWYWx1ZSA9IGNoYW5uZWwuc3Vic3RyKDEpO1xuXHRcdGxldCByb29tO1xuXG5cdFx0c3dpdGNoIChjaGFubmVsVHlwZSkge1xuXHRcdFx0Y2FzZSAnIyc6XG5cdFx0XHRcdHJvb20gPSBSb2NrZXRDaGF0LmdldFJvb21CeU5hbWVPcklkV2l0aE9wdGlvblRvSm9pbih7IGN1cnJlbnRVc2VySWQ6IHVzZXIuX2lkLCBuYW1lT3JJZDogY2hhbm5lbFZhbHVlLCBqb2luQ2hhbm5lbDogdHJ1ZSB9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdAJzpcblx0XHRcdFx0cm9vbSA9IFJvY2tldENoYXQuZ2V0Um9vbUJ5TmFtZU9ySWRXaXRoT3B0aW9uVG9Kb2luKHsgY3VycmVudFVzZXJJZDogdXNlci5faWQsIG5hbWVPcklkOiBjaGFubmVsVmFsdWUsIHR5cGU6ICdkJyB9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRjaGFubmVsVmFsdWUgPSBjaGFubmVsVHlwZSArIGNoYW5uZWxWYWx1ZTtcblxuXHRcdFx0XHQvL1RyeSB0byBmaW5kIHRoZSByb29tIGJ5IGlkIG9yIG5hbWUgaWYgdGhleSBkaWRuJ3QgaW5jbHVkZSB0aGUgcHJlZml4LlxuXHRcdFx0XHRyb29tID0gUm9ja2V0Q2hhdC5nZXRSb29tQnlOYW1lT3JJZFdpdGhPcHRpb25Ub0pvaW4oeyBjdXJyZW50VXNlcklkOiB1c2VyLl9pZCwgbmFtZU9ySWQ6IGNoYW5uZWxWYWx1ZSwgam9pbkNoYW5uZWw6IHRydWUsIGVycm9yT25FbXB0eTogZmFsc2UgfSk7XG5cdFx0XHRcdGlmIChyb29tKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL1dlIGRpZG4ndCBnZXQgYSByb29tLCBsZXQncyB0cnkgZmluZGluZyBkaXJlY3QgbWVzc2FnZXNcblx0XHRcdFx0cm9vbSA9IFJvY2tldENoYXQuZ2V0Um9vbUJ5TmFtZU9ySWRXaXRoT3B0aW9uVG9Kb2luKHsgY3VycmVudFVzZXJJZDogdXNlci5faWQsIG5hbWVPcklkOiBjaGFubmVsVmFsdWUsIHR5cGU6ICdkJywgdHJ5RGlyZWN0QnlVc2VySWRPbmx5OiB0cnVlIH0pO1xuXHRcdFx0XHRpZiAocm9vbSkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9ObyByb29tLCBzbyB0aHJvdyBhbiBlcnJvclxuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWNoYW5uZWwnKTtcblx0XHR9XG5cblx0XHRpZiAobXVzdEJlSm9pbmVkICYmICFyb29tLnVzZXJuYW1lcy5pbmNsdWRlcyh1c2VyLnVzZXJuYW1lKSkge1xuXHRcdFx0Ly8gdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1yb29tJywgJ0ludmFsaWQgcm9vbSBwcm92aWRlZCB0byBzZW5kIGEgbWVzc2FnZSB0bywgbXVzdCBiZSBqb2luZWQuJyk7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWNoYW5uZWwnKTsgLy8gVGhyb3dpbmcgdGhlIGdlbmVyaWMgb25lIHNvIHBlb3BsZSBjYW4ndCBcImJydXRlIGZvcmNlXCIgZmluZCByb29tc1xuXHRcdH1cblxuXHRcdGlmIChtZXNzYWdlT2JqLmF0dGFjaG1lbnRzICYmICFfLmlzQXJyYXkobWVzc2FnZU9iai5hdHRhY2htZW50cykpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdBdHRhY2htZW50cyBzaG91bGQgYmUgQXJyYXksIGlnbm9yaW5nIHZhbHVlJy5yZWQsIG1lc3NhZ2VPYmouYXR0YWNobWVudHMpO1xuXHRcdFx0bWVzc2FnZU9iai5hdHRhY2htZW50cyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0ge1xuXHRcdFx0YWxpYXM6IG1lc3NhZ2VPYmoudXNlcm5hbWUgfHwgbWVzc2FnZU9iai5hbGlhcyB8fCBkZWZhdWx0VmFsdWVzLmFsaWFzLFxuXHRcdFx0bXNnOiBzLnRyaW0obWVzc2FnZU9iai50ZXh0IHx8IG1lc3NhZ2VPYmoubXNnIHx8ICcnKSxcblx0XHRcdGF0dGFjaG1lbnRzOiBtZXNzYWdlT2JqLmF0dGFjaG1lbnRzLFxuXHRcdFx0cGFyc2VVcmxzOiBtZXNzYWdlT2JqLnBhcnNlVXJscyAhPT0gdW5kZWZpbmVkID8gbWVzc2FnZU9iai5wYXJzZVVybHMgOiAhbWVzc2FnZU9iai5hdHRhY2htZW50cyxcblx0XHRcdGJvdDogbWVzc2FnZU9iai5ib3QsXG5cdFx0XHRncm91cGFibGU6IChtZXNzYWdlT2JqLmdyb3VwYWJsZSAhPT0gdW5kZWZpbmVkKSA/IG1lc3NhZ2VPYmouZ3JvdXBhYmxlIDogZmFsc2Vcblx0XHR9O1xuXG5cdFx0aWYgKCFfLmlzRW1wdHkobWVzc2FnZU9iai5pY29uX3VybCkgfHwgIV8uaXNFbXB0eShtZXNzYWdlT2JqLmF2YXRhcikpIHtcblx0XHRcdG1lc3NhZ2UuYXZhdGFyID0gbWVzc2FnZU9iai5pY29uX3VybCB8fCBtZXNzYWdlT2JqLmF2YXRhcjtcblx0XHR9IGVsc2UgaWYgKCFfLmlzRW1wdHkobWVzc2FnZU9iai5pY29uX2Vtb2ppKSB8fCAhXy5pc0VtcHR5KG1lc3NhZ2VPYmouZW1vamkpKSB7XG5cdFx0XHRtZXNzYWdlLmVtb2ppID0gbWVzc2FnZU9iai5pY29uX2Vtb2ppIHx8IG1lc3NhZ2VPYmouZW1vamk7XG5cdFx0fSBlbHNlIGlmICghXy5pc0VtcHR5KGRlZmF1bHRWYWx1ZXMuYXZhdGFyKSkge1xuXHRcdFx0bWVzc2FnZS5hdmF0YXIgPSBkZWZhdWx0VmFsdWVzLmF2YXRhcjtcblx0XHR9IGVsc2UgaWYgKCFfLmlzRW1wdHkoZGVmYXVsdFZhbHVlcy5lbW9qaSkpIHtcblx0XHRcdG1lc3NhZ2UuZW1vamkgPSBkZWZhdWx0VmFsdWVzLmVtb2ppO1xuXHRcdH1cblxuXHRcdGlmIChfLmlzQXJyYXkobWVzc2FnZS5hdHRhY2htZW50cykpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbWVzc2FnZS5hdHRhY2htZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBhdHRhY2htZW50ID0gbWVzc2FnZS5hdHRhY2htZW50c1tpXTtcblx0XHRcdFx0aWYgKGF0dGFjaG1lbnQubXNnKSB7XG5cdFx0XHRcdFx0YXR0YWNobWVudC50ZXh0ID0gcy50cmltKGF0dGFjaG1lbnQubXNnKTtcblx0XHRcdFx0XHRkZWxldGUgYXR0YWNobWVudC5tc2c7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlUmV0dXJuID0gUm9ja2V0Q2hhdC5zZW5kTWVzc2FnZSh1c2VyLCBtZXNzYWdlLCByb29tKTtcblx0XHRzZW50RGF0YS5wdXNoKHsgY2hhbm5lbCwgbWVzc2FnZTogbWVzc2FnZVJldHVybiB9KTtcblx0fVxuXG5cdHJldHVybiBzZW50RGF0YTtcbn07XG4iXX0=
