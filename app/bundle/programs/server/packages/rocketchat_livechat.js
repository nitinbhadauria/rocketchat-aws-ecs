(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var Autoupdate = Package.autoupdate.Autoupdate;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var Streamer = Package['rocketchat:streamer'].Streamer;
var UserPresence = Package['konecty:user-presence'].UserPresence;
var UserPresenceMonitor = Package['konecty:user-presence'].UserPresenceMonitor;
var UserPresenceEvents = Package['konecty:user-presence'].UserPresenceEvents;
var fileUpload = Package['rocketchat:ui'].fileUpload;
var HTTP = Package.http.HTTP;
var HTTPInternals = Package.http.HTTPInternals;
var check = Package.check.check;
var Match = Package.check.Match;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var emailSettings, self, _id, agents, username, exports;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:livechat":{"livechat.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/livechat.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let url;
module.watch(require("url"), {
	default(v) {
		url = v;
	}

}, 1);
WebApp = Package.webapp.WebApp;
const Autoupdate = Package.autoupdate.Autoupdate;
WebApp.connectHandlers.use('/livechat', Meteor.bindEnvironment((req, res, next) => {
	const reqUrl = url.parse(req.url);

	if (reqUrl.pathname !== '/') {
		return next();
	}

	res.setHeader('content-type', 'text/html; charset=utf-8');
	let domainWhiteList = RocketChat.settings.get('Livechat_AllowedDomainsList');

	if (req.headers.referer && !_.isEmpty(domainWhiteList.trim())) {
		domainWhiteList = _.map(domainWhiteList.split(','), function (domain) {
			return domain.trim();
		});
		const referer = url.parse(req.headers.referer);

		if (!_.contains(domainWhiteList, referer.host)) {
			res.setHeader('X-FRAME-OPTIONS', 'DENY');
			return next();
		}

		res.setHeader('X-FRAME-OPTIONS', `ALLOW-FROM ${referer.protocol}//${referer.host}`);
	}

	const head = Assets.getText('public/head.html');
	const html = `<html>
		<head>
			<link rel="stylesheet" type="text/css" class="__meteor-css__" href="/livechat/livechat.css?_dc=${Autoupdate.autoupdateVersion}">
			<script type="text/javascript">
				__meteor_runtime_config__ = ${JSON.stringify(__meteor_runtime_config__)};
			</script>

			${head}
		</head>
		<body>
			<script type="text/javascript" src="/livechat/livechat.js?_dc=${Autoupdate.autoupdateVersion}"></script>
		</body>
	</html>`;
	res.write(html);
	res.end();
}));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server":{"startup.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/startup.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.startup(() => {
	RocketChat.roomTypes.setRoomFind('l', code => {
		return RocketChat.models.Rooms.findLivechatByCode(code);
	});
	RocketChat.authz.addRoomAccessValidator(function (room, user) {
		return room.t === 'l' && RocketChat.authz.hasPermission(user._id, 'view-livechat-rooms');
	});
	RocketChat.authz.addRoomAccessValidator(function (room, user) {
		return room.t === 'l' && room.v && room.v._id === user._id;
	});
	RocketChat.callbacks.add('beforeLeaveRoom', function (user, room) {
		if (room.t !== 'l') {
			return user;
		}

		throw new Meteor.Error(TAPi18n.__('You_cant_leave_a_livechat_room_Please_use_the_close_button', {
			lng: user.language || RocketChat.settings.get('language') || 'en'
		}));
	}, RocketChat.callbacks.priority.LOW, 'cant-leave-room');
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"hooks":{"externalMessage.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/hooks/externalMessage.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let knowledgeEnabled = false;
let apiaiKey = '';
let apiaiLanguage = 'en';
RocketChat.settings.get('Livechat_Knowledge_Enabled', function (key, value) {
	knowledgeEnabled = value;
});
RocketChat.settings.get('Livechat_Knowledge_Apiai_Key', function (key, value) {
	apiaiKey = value;
});
RocketChat.settings.get('Livechat_Knowledge_Apiai_Language', function (key, value) {
	apiaiLanguage = value;
});
RocketChat.callbacks.add('afterSaveMessage', function (message, room) {
	// skips this callback if the message was edited
	if (!message || message.editedAt) {
		return message;
	}

	if (!knowledgeEnabled) {
		return message;
	}

	if (!(typeof room.t !== 'undefined' && room.t === 'l' && room.v && room.v.token)) {
		return message;
	} // if the message hasn't a token, it was not sent by the visitor, so ignore it


	if (!message.token) {
		return message;
	}

	Meteor.defer(() => {
		try {
			const response = HTTP.post('https://api.api.ai/api/query?v=20150910', {
				data: {
					query: message.msg,
					lang: apiaiLanguage,
					sessionId: room._id
				},
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': `Bearer ${apiaiKey}`
				}
			});

			if (response.data && response.data.status.code === 200 && !_.isEmpty(response.data.result.fulfillment.speech)) {
				RocketChat.models.LivechatExternalMessage.insert({
					rid: message.rid,
					msg: response.data.result.fulfillment.speech,
					orig: message._id,
					ts: new Date()
				});
			}
		} catch (e) {
			SystemLogger.error('Error using Api.ai ->', e);
		}
	});
	return message;
}, RocketChat.callbacks.priority.LOW, 'externalWebHook');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"markRoomResponded.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/hooks/markRoomResponded.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.callbacks.add('afterSaveMessage', function (message, room) {
	// skips this callback if the message was edited
	if (!message || message.editedAt) {
		return message;
	} // check if room is yet awaiting for response


	if (!(typeof room.t !== 'undefined' && room.t === 'l' && room.waitingResponse)) {
		return message;
	} // if the message has a token, it was sent by the visitor, so ignore it


	if (message.token) {
		return message;
	}

	Meteor.defer(() => {
		const now = new Date();
		RocketChat.models.Rooms.setResponseByRoomId(room._id, {
			user: {
				_id: message.u._id,
				username: message.u.username
			},
			responseDate: now,
			responseTime: (now.getTime() - room.ts) / 1000
		});
	});
	return message;
}, RocketChat.callbacks.priority.LOW, 'markRoomResponded');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"offlineMessage.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/hooks/offlineMessage.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.callbacks.add('livechat.offlineMessage', data => {
	if (!RocketChat.settings.get('Livechat_webhook_on_offline_msg')) {
		return data;
	}

	const postData = {
		type: 'LivechatOfflineMessage',
		sentAt: new Date(),
		visitor: {
			name: data.name,
			email: data.email
		},
		message: data.message
	};
	RocketChat.Livechat.sendRequest(postData);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-email-offline-message');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"RDStation.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/hooks/RDStation.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
function sendToRDStation(room) {
	if (!RocketChat.settings.get('Livechat_RDStation_Token')) {
		return room;
	}

	const livechatData = RocketChat.Livechat.getLivechatRoomGuestInfo(room);

	if (!livechatData.visitor.email) {
		return room;
	}

	const options = {
		headers: {
			'Content-Type': 'application/json'
		},
		data: {
			token_rdstation: RocketChat.settings.get('Livechat_RDStation_Token'),
			identificador: 'rocketchat-livechat',
			client_id: livechatData.visitor._id,
			email: livechatData.visitor.email
		}
	};
	options.data.nome = livechatData.visitor.name || livechatData.visitor.username;

	if (livechatData.visitor.phone) {
		options.data.telefone = livechatData.visitor.phone;
	}

	if (livechatData.tags) {
		options.data.tags = livechatData.tags;
	}

	Object.keys(livechatData.customFields || {}).forEach(field => {
		options.data[field] = livechatData.customFields[field];
	});
	Object.keys(livechatData.visitor.customFields || {}).forEach(field => {
		options.data[field] = livechatData.visitor.customFields[field];
	});

	try {
		HTTP.call('POST', 'https://www.rdstation.com.br/api/1.3/conversions', options);
	} catch (e) {
		console.error('Error sending lead to RD Station ->', e);
	}

	return room;
}

RocketChat.callbacks.add('livechat.closeRoom', sendToRDStation, RocketChat.callbacks.priority.MEDIUM, 'livechat-rd-station-close-room');
RocketChat.callbacks.add('livechat.saveInfo', sendToRDStation, RocketChat.callbacks.priority.MEDIUM, 'livechat-rd-station-save-info');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sendToCRM.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/hooks/sendToCRM.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
function sendToCRM(hook, room) {
	if (!RocketChat.settings.get('Livechat_webhook_on_close')) {
		return room;
	} // Do not send to CRM if the chat is still open


	if (hook === 'saveLivechatInfo' && room.open) {
		return room;
	}

	const postData = RocketChat.Livechat.getLivechatRoomGuestInfo(room);

	if (hook === 'closeRoom') {
		postData.type = 'LivechatSession';
	} else if (hook === 'saveLivechatInfo') {
		postData.type = 'LivechatEdit';
	}

	postData.messages = [];
	RocketChat.models.Messages.findVisibleByRoomId(room._id, {
		sort: {
			ts: 1
		}
	}).forEach(message => {
		if (message.t) {
			return;
		}

		const msg = {
			username: message.u.username,
			msg: message.msg,
			ts: message.ts
		};

		if (message.u.username !== postData.visitor.username) {
			msg.agentId = message.u._id;
		}

		postData.messages.push(msg);
	});
	const response = RocketChat.Livechat.sendRequest(postData);

	if (response && response.data && response.data.data) {
		RocketChat.models.Rooms.saveCRMDataByRoomId(room._id, response.data.data);
	}

	return room;
}

RocketChat.callbacks.add('livechat.closeRoom', room => {
	return sendToCRM('closeRoom', room);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-crm-close-room');
RocketChat.callbacks.add('livechat.saveInfo', room => {
	return sendToCRM('saveLivechatInfo', room);
}, RocketChat.callbacks.priority.MEDIUM, 'livechat-send-crm-save-info');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sendToFacebook.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/hooks/sendToFacebook.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let OmniChannel;
module.watch(require("../lib/OmniChannel"), {
	default(v) {
		OmniChannel = v;
	}

}, 0);
RocketChat.callbacks.add('afterSaveMessage', function (message, room) {
	// skips this callback if the message was edited
	if (message.editedAt) {
		return message;
	}

	if (!RocketChat.settings.get('Livechat_Facebook_Enabled') || !RocketChat.settings.get('Livechat_Facebook_API_Key')) {
		return message;
	} // only send the sms by SMS if it is a livechat room with SMS set to true


	if (!(typeof room.t !== 'undefined' && room.t === 'l' && room.facebook && room.v && room.v.token)) {
		return message;
	} // if the message has a token, it was sent from the visitor, so ignore it


	if (message.token) {
		return message;
	} // if the message has a type means it is a special message (like the closing comment), so skips


	if (message.t) {
		return message;
	}

	OmniChannel.reply({
		page: room.facebook.page.id,
		token: room.v.token,
		text: message.msg
	});
	return message;
}, RocketChat.callbacks.priority.LOW, 'sendMessageToFacebook');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"addAgent.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/addAgent.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:addAgent'(username) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:addAgent'
			});
		}

		return RocketChat.Livechat.addAgent(username);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"addManager.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/addManager.js                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:addManager'(username) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:addManager'
			});
		}

		return RocketChat.Livechat.addManager(username);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"changeLivechatStatus.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/changeLivechatStatus.js                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:changeLivechatStatus'() {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:changeLivechatStatus'
			});
		}

		const user = Meteor.user();
		const newStatus = user.statusLivechat === 'available' ? 'not-available' : 'available';
		return RocketChat.models.Users.setLivechatStatus(user._id, newStatus);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"closeByVisitor.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/closeByVisitor.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:closeByVisitor'(roomId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'livechat:closeByVisitor'
			});
		}

		const room = RocketChat.models.Rooms.findOneOpenByVisitorId(Meteor.userId(), roomId);

		if (!room || !room.open) {
			return false;
		}

		const user = Meteor.user();
		const language = user && user.language || RocketChat.settings.get('language') || 'en';
		return RocketChat.Livechat.closeRoom({
			user,
			room,
			comment: TAPi18n.__('Closed_by_visitor', {
				lng: language
			})
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"closeRoom.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/closeRoom.js                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:closeRoom'(roomId, comment) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'close-livechat-room')) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'livechat:closeRoom'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(roomId);
		const user = Meteor.user();

		if (room.usernames.indexOf(user.username) === -1 && !RocketChat.authz.hasPermission(Meteor.userId(), 'close-others-livechat-room')) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'livechat:closeRoom'
			});
		}

		return RocketChat.Livechat.closeRoom({
			user,
			room,
			comment
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"facebook.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/facebook.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let OmniChannel;
module.watch(require("../lib/OmniChannel"), {
	default(v) {
		OmniChannel = v;
	}

}, 0);
Meteor.methods({
	'livechat:facebook'(options) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:addAgent'
			});
		}

		try {
			switch (options.action) {
				case 'initialState':
					{
						return {
							enabled: RocketChat.settings.get('Livechat_Facebook_Enabled'),
							hasToken: !!RocketChat.settings.get('Livechat_Facebook_API_Key')
						};
					}

				case 'enable':
					{
						const result = OmniChannel.enable();

						if (!result.success) {
							return result;
						}

						return RocketChat.settings.updateById('Livechat_Facebook_Enabled', true);
					}

				case 'disable':
					{
						OmniChannel.disable();
						return RocketChat.settings.updateById('Livechat_Facebook_Enabled', false);
					}

				case 'list-pages':
					{
						return OmniChannel.listPages();
					}

				case 'subscribe':
					{
						return OmniChannel.subscribe(options.page);
					}

				case 'unsubscribe':
					{
						return OmniChannel.unsubscribe(options.page);
					}
			}
		} catch (e) {
			if (e.response && e.response.data && e.response.data.error && e.response.data.error.response) {
				throw new Meteor.Error('integration-error', e.response.data.error.response.error.message);
			}

			if (e.response && e.response.data && e.response.data.error && e.response.data.error.message) {
				throw new Meteor.Error('integration-error', e.response.data.error.message);
			}

			console.error('Error contacting omni.rocket.chat:', e);
			throw new Meteor.Error('integration-error', e.error);
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getCustomFields.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/getCustomFields.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:getCustomFields'() {
		return RocketChat.models.LivechatCustomField.find().fetch();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getAgentData.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/getAgentData.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:getAgentData'(roomId) {
		check(roomId, String);
		const room = RocketChat.models.Rooms.findOneById(roomId);
		const user = Meteor.user(); // allow to only user to send transcripts from their own chats

		if (!room || room.t !== 'l' || !room.v || !user.profile || room.v.token !== user.profile.token) {
			throw new Meteor.Error('error-invalid-room', 'Invalid room');
		}

		if (!room.servedBy) {
			return;
		}

		return RocketChat.models.Users.getAgentInfo(room.servedBy._id);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getInitialData.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/getInitialData.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	'livechat:getInitialData'(visitorToken) {
		const info = {
			enabled: null,
			title: null,
			color: null,
			registrationForm: null,
			room: null,
			triggers: [],
			departments: [],
			allowSwitchingDepartments: null,
			online: true,
			offlineColor: null,
			offlineMessage: null,
			offlineSuccessMessage: null,
			offlineUnavailableMessage: null,
			displayOfflineForm: null,
			videoCall: null
		};
		const room = RocketChat.models.Rooms.findOpenByVisitorToken(visitorToken, {
			fields: {
				name: 1,
				t: 1,
				cl: 1,
				u: 1,
				usernames: 1,
				v: 1,
				servedBy: 1
			}
		}).fetch();

		if (room && room.length > 0) {
			info.room = room[0];
		}

		const initSettings = RocketChat.Livechat.getInitSettings();
		info.title = initSettings.Livechat_title;
		info.color = initSettings.Livechat_title_color;
		info.enabled = initSettings.Livechat_enabled;
		info.registrationForm = initSettings.Livechat_registration_form;
		info.offlineTitle = initSettings.Livechat_offline_title;
		info.offlineColor = initSettings.Livechat_offline_title_color;
		info.offlineMessage = initSettings.Livechat_offline_message;
		info.offlineSuccessMessage = initSettings.Livechat_offline_success_message;
		info.offlineUnavailableMessage = initSettings.Livechat_offline_form_unavailable;
		info.displayOfflineForm = initSettings.Livechat_display_offline_form;
		info.language = initSettings.Language;
		info.videoCall = initSettings.Livechat_videocall_enabled === true && initSettings.Jitsi_Enabled === true;
		info.transcript = initSettings.Livechat_enable_transcript;
		info.transcriptMessage = initSettings.Livechat_transcript_message;
		info.agentData = room && room[0] && room[0].servedBy && RocketChat.models.Users.getAgentInfo(room[0].servedBy._id);
		RocketChat.models.LivechatTrigger.findEnabled().forEach(trigger => {
			info.triggers.push(_.pick(trigger, '_id', 'actions', 'conditions'));
		});
		RocketChat.models.LivechatDepartment.findEnabledWithAgents().forEach(department => {
			info.departments.push(department);
		});
		info.allowSwitchingDepartments = initSettings.Livechat_allow_switching_departments;
		info.online = RocketChat.models.Users.findOnlineAgents().count() > 0;
		return info;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"loginByToken.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/loginByToken.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:loginByToken'(token) {
		const user = RocketChat.models.Users.getVisitorByToken(token, {
			fields: {
				_id: 1
			}
		});

		if (!user) {
			return;
		}

		const stampedToken = Accounts._generateStampedLoginToken();

		const hashStampedToken = Accounts._hashStampedToken(stampedToken);

		const updateUser = {
			$set: {
				services: {
					resume: {
						loginTokens: [hashStampedToken]
					}
				}
			}
		};
		Meteor.users.update(user._id, updateUser);
		return {
			token: stampedToken.token
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"pageVisited.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/pageVisited.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:pageVisited'(token, pageInfo) {
		return RocketChat.Livechat.savePageHistory(token, pageInfo);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"registerGuest.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/registerGuest.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:registerGuest'({
		token,
		name,
		email,
		department
	} = {}) {
		const stampedToken = Accounts._generateStampedLoginToken();

		const hashStampedToken = Accounts._hashStampedToken(stampedToken);

		const userId = RocketChat.Livechat.registerGuest.call(this, {
			token,
			name,
			email,
			department,
			loginToken: hashStampedToken
		}); // update visited page history to not expire

		RocketChat.models.LivechatPageVisited.keepHistoryForToken(token);
		return {
			userId,
			token: stampedToken.token
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeAgent.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/removeAgent.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:removeAgent'(username) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:removeAgent'
			});
		}

		return RocketChat.Livechat.removeAgent(username);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeCustomField.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/removeCustomField.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:removeCustomField'(_id) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:removeCustomField'
			});
		}

		check(_id, String);
		const customField = RocketChat.models.LivechatCustomField.findOneById(_id, {
			fields: {
				_id: 1
			}
		});

		if (!customField) {
			throw new Meteor.Error('error-invalid-custom-field', 'Custom field not found', {
				method: 'livechat:removeCustomField'
			});
		}

		return RocketChat.models.LivechatCustomField.removeById(_id);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeDepartment.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/removeDepartment.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:removeDepartment'(_id) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:removeDepartment'
			});
		}

		return RocketChat.Livechat.removeDepartment(_id);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeManager.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/removeManager.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:removeManager'(username) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:removeManager'
			});
		}

		return RocketChat.Livechat.removeManager(username);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"removeTrigger.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/removeTrigger.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:removeTrigger'(triggerId) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:removeTrigger'
			});
		}

		check(triggerId, String);
		return RocketChat.models.LivechatTrigger.removeById(triggerId);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveAppearance.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveAppearance.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:saveAppearance'(settings) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveAppearance'
			});
		}

		const validSettings = ['Livechat_title', 'Livechat_title_color', 'Livechat_show_agent_email', 'Livechat_display_offline_form', 'Livechat_offline_form_unavailable', 'Livechat_offline_message', 'Livechat_offline_success_message', 'Livechat_offline_title', 'Livechat_offline_title_color', 'Livechat_offline_email'];
		const valid = settings.every(setting => {
			return validSettings.indexOf(setting._id) !== -1;
		});

		if (!valid) {
			throw new Meteor.Error('invalid-setting');
		}

		settings.forEach(setting => {
			RocketChat.settings.updateById(setting._id, setting.value);
		});
		return;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveCustomField.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveCustomField.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* eslint new-cap: [2, {"capIsNewExceptions": ["Match.ObjectIncluding", "Match.Optional"]}] */Meteor.methods({
	'livechat:saveCustomField'(_id, customFieldData) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveCustomField'
			});
		}

		if (_id) {
			check(_id, String);
		}

		check(customFieldData, Match.ObjectIncluding({
			field: String,
			label: String,
			scope: String,
			visibility: String
		}));

		if (!/^[0-9a-zA-Z-_]+$/.test(customFieldData.field)) {
			throw new Meteor.Error('error-invalid-custom-field-nmae', 'Invalid custom field name. Use only letters, numbers, hyphens and underscores.', {
				method: 'livechat:saveCustomField'
			});
		}

		if (_id) {
			const customField = RocketChat.models.LivechatCustomField.findOneById(_id);

			if (!customField) {
				throw new Meteor.Error('error-invalid-custom-field', 'Custom Field Not found', {
					method: 'livechat:saveCustomField'
				});
			}
		}

		return RocketChat.models.LivechatCustomField.createOrUpdateCustomField(_id, customFieldData.field, customFieldData.label, customFieldData.scope, customFieldData.visibility);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveDepartment.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveDepartment.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:saveDepartment'(_id, departmentData, departmentAgents) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveDepartment'
			});
		}

		return RocketChat.Livechat.saveDepartment(_id, departmentData, departmentAgents);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveInfo.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveInfo.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* eslint new-cap: [2, {"capIsNewExceptions": ["Match.ObjectIncluding", "Match.Optional"]}] */Meteor.methods({
	'livechat:saveInfo'(guestData, roomData) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-l-room')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveInfo'
			});
		}

		check(guestData, Match.ObjectIncluding({
			_id: String,
			name: Match.Optional(String),
			email: Match.Optional(String),
			phone: Match.Optional(String)
		}));
		check(roomData, Match.ObjectIncluding({
			_id: String,
			topic: Match.Optional(String),
			tags: Match.Optional(String)
		}));
		const room = RocketChat.models.Rooms.findOneById(roomData._id, {
			fields: {
				t: 1,
				servedBy: 1
			}
		});

		if (room == null || room.t !== 'l') {
			throw new Meteor.Error('error-invalid-room', 'Invalid room', {
				method: 'livechat:saveInfo'
			});
		}

		if ((!room.servedBy || room.servedBy._id !== Meteor.userId()) && !RocketChat.authz.hasPermission(Meteor.userId(), 'save-others-livechat-room-info')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveInfo'
			});
		}

		const ret = RocketChat.Livechat.saveGuest(guestData) && RocketChat.Livechat.saveRoomInfo(roomData, guestData);
		Meteor.defer(() => {
			RocketChat.callbacks.run('livechat.saveInfo', RocketChat.models.Rooms.findOneById(roomData._id));
		});
		return ret;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveIntegration.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveIntegration.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
Meteor.methods({
	'livechat:saveIntegration'(values) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveIntegration'
			});
		}

		if (typeof values['Livechat_webhookUrl'] !== 'undefined') {
			RocketChat.settings.updateById('Livechat_webhookUrl', s.trim(values['Livechat_webhookUrl']));
		}

		if (typeof values['Livechat_secret_token'] !== 'undefined') {
			RocketChat.settings.updateById('Livechat_secret_token', s.trim(values['Livechat_secret_token']));
		}

		if (typeof values['Livechat_webhook_on_close'] !== 'undefined') {
			RocketChat.settings.updateById('Livechat_webhook_on_close', !!values['Livechat_webhook_on_close']);
		}

		if (typeof values['Livechat_webhook_on_offline_msg'] !== 'undefined') {
			RocketChat.settings.updateById('Livechat_webhook_on_offline_msg', !!values['Livechat_webhook_on_offline_msg']);
		}

		return;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveSurveyFeedback.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveSurveyFeedback.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	'livechat:saveSurveyFeedback'(visitorToken, visitorRoom, formData) {
		check(visitorToken, String);
		check(visitorRoom, String);
		check(formData, [Match.ObjectIncluding({
			name: String,
			value: String
		})]);
		const visitor = RocketChat.models.Users.getVisitorByToken(visitorToken);
		const room = RocketChat.models.Rooms.findOneById(visitorRoom);

		if (visitor !== undefined && room !== undefined && room.v !== undefined && visitor.profile !== undefined && room.v.token === visitor.profile.token) {
			const updateData = {};

			for (const item of formData) {
				if (_.contains(['satisfaction', 'agentKnowledge', 'agentResposiveness', 'agentFriendliness'], item.name) && _.contains(['1', '2', '3', '4', '5'], item.value)) {
					updateData[item.name] = item.value;
				} else if (item.name === 'additionalFeedback') {
					updateData[item.name] = item.value;
				}
			}

			if (!_.isEmpty(updateData)) {
				return RocketChat.models.Rooms.updateSurveyFeedbackById(room._id, updateData);
			}
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveTrigger.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveTrigger.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:saveTrigger'(trigger) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveTrigger'
			});
		}

		check(trigger, {
			_id: Match.Maybe(String),
			name: String,
			description: String,
			enabled: Boolean,
			conditions: Array,
			actions: Array
		});

		if (trigger._id) {
			return RocketChat.models.LivechatTrigger.updateById(trigger._id, trigger);
		} else {
			return RocketChat.models.LivechatTrigger.insert(trigger);
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"searchAgent.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/searchAgent.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	'livechat:searchAgent'(username) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-livechat-manager')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:searchAgent'
			});
		}

		if (!username || !_.isString(username)) {
			throw new Meteor.Error('error-invalid-arguments', 'Invalid arguments', {
				method: 'livechat:searchAgent'
			});
		}

		const user = RocketChat.models.Users.findOneByUsername(username, {
			fields: {
				_id: 1,
				username: 1
			}
		});

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'livechat:searchAgent'
			});
		}

		return user;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sendMessageLivechat.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/sendMessageLivechat.js                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	sendMessageLivechat(message) {
		check(message.rid, String);
		check(message.token, String);
		const guest = Meteor.users.findOne(Meteor.userId(), {
			fields: {
				name: 1,
				username: 1,
				department: 1
			}
		});
		return RocketChat.Livechat.sendMessage({
			guest,
			message
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sendOfflineMessage.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/sendOfflineMessage.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals DDPRateLimiter */const dns = Npm.require('dns');

Meteor.methods({
	'livechat:sendOfflineMessage'(data) {
		check(data, {
			name: String,
			email: String,
			message: String
		});

		if (!RocketChat.settings.get('Livechat_display_offline_form')) {
			return false;
		}

		const header = RocketChat.placeholders.replace(RocketChat.settings.get('Email_Header') || '');
		const footer = RocketChat.placeholders.replace(RocketChat.settings.get('Email_Footer') || '');
		const message = `${data.message}`.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2');
		const html = `
			<h1>New livechat message</h1>
			<p><strong>Visitor name:</strong> ${data.name}</p>
			<p><strong>Visitor email:</strong> ${data.email}</p>
			<p><strong>Message:</strong><br>${message}</p>`;
		let fromEmail = RocketChat.settings.get('From_Email').match(/\b[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,4}\b/i);

		if (fromEmail) {
			fromEmail = fromEmail[0];
		} else {
			fromEmail = RocketChat.settings.get('From_Email');
		}

		if (RocketChat.settings.get('Livechat_validate_offline_email')) {
			const emailDomain = data.email.substr(data.email.lastIndexOf('@') + 1);

			try {
				Meteor.wrapAsync(dns.resolveMx)(emailDomain);
			} catch (e) {
				throw new Meteor.Error('error-invalid-email-address', 'Invalid email address', {
					method: 'livechat:sendOfflineMessage'
				});
			}
		}

		Meteor.defer(() => {
			Email.send({
				to: RocketChat.settings.get('Livechat_offline_email'),
				from: `${data.name} - ${data.email} <${fromEmail}>`,
				replyTo: `${data.name} <${data.email}>`,
				subject: `Livechat offline message from ${data.name}: ${`${data.message}`.substring(0, 20)}`,
				html: header + html + footer
			});
		});
		Meteor.defer(() => {
			RocketChat.callbacks.run('livechat.offlineMessage', data);
		});
		return true;
	}

});
DDPRateLimiter.addRule({
	type: 'method',
	name: 'livechat:sendOfflineMessage',

	connectionId() {
		return true;
	}

}, 1, 5000);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"setCustomField.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/setCustomField.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:setCustomField'(token, key, value, overwrite = true) {
		const customField = RocketChat.models.LivechatCustomField.findOneById(key);

		if (customField) {
			if (customField.scope === 'room') {
				return RocketChat.models.Rooms.updateLivechatDataByToken(token, key, value, overwrite);
			} else {
				// Save in user
				return RocketChat.models.Users.updateLivechatDataByToken(token, key, value, overwrite);
			}
		}

		return true;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"setDepartmentForVisitor.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/setDepartmentForVisitor.js                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:setDepartmentForVisitor'({
		token,
		department
	} = {}) {
		RocketChat.Livechat.setDepartmentForGuest.call(this, {
			token,
			department
		}); // update visited page history to not expire

		RocketChat.models.LivechatPageVisited.keepHistoryForToken(token);
		return true;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"startVideoCall.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/startVideoCall.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* eslint new-cap: [2, {"capIsNewExceptions": ["MD5"]}] */Meteor.methods({
	'livechat:startVideoCall'(roomId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'livechat:closeByVisitor'
			});
		}

		const guest = Meteor.user();
		const message = {
			_id: Random.id(),
			rid: roomId || Random.id(),
			msg: '',
			ts: new Date()
		};
		const {
			room
		} = RocketChat.Livechat.getRoom(guest, message, {
			jitsiTimeout: new Date(Date.now() + 3600 * 1000)
		});
		message.rid = room._id;
		RocketChat.models.Messages.createWithTypeRoomIdMessageAndUser('livechat_video_call', room._id, '', guest, {
			actionLinks: [{
				icon: 'icon-videocam',
				i18nLabel: 'Accept',
				method_id: 'createLivechatCall',
				params: ''
			}, {
				icon: 'icon-cancel',
				i18nLabel: 'Decline',
				method_id: 'denyLivechatCall',
				params: ''
			}]
		});
		return {
			roomId: room._id,
			domain: RocketChat.settings.get('Jitsi_Domain'),
			jitsiRoom: RocketChat.settings.get('Jitsi_URL_Room_Prefix') + RocketChat.settings.get('uniqueID') + roomId
		};
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"transfer.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/transfer.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* eslint new-cap: [2, {"capIsNewExceptions": ["Match.Optional"]}] */Meteor.methods({
	'livechat:transfer'(transferData) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-l-room')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:transfer'
			});
		}

		check(transferData, {
			roomId: String,
			userId: Match.Optional(String),
			departmentId: Match.Optional(String)
		});
		const room = RocketChat.models.Rooms.findOneById(transferData.roomId);
		const guest = RocketChat.models.Users.findOneById(room.v._id);
		const user = Meteor.user();

		if (room.usernames.indexOf(user.username) === -1 && !RocketChat.authz.hasRole(Meteor.userId(), 'livechat-manager')) {
			throw new Meteor.Error('error-not-authorized', 'Not authorized', {
				method: 'livechat:transfer'
			});
		}

		return RocketChat.Livechat.transfer(room, guest, transferData);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"webhookTest.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/webhookTest.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals HTTP */const postCatchError = Meteor.wrapAsync(function (url, options, resolve) {
	HTTP.post(url, options, function (err, res) {
		if (err) {
			resolve(null, err.response);
		} else {
			resolve(null, res);
		}
	});
});
Meteor.methods({
	'livechat:webhookTest'() {
		this.unblock();
		const sampleData = {
			type: 'LivechatSession',
			_id: 'fasd6f5a4sd6f8a4sdf',
			label: 'title',
			topic: 'asiodojf',
			code: 123123,
			createdAt: new Date(),
			lastMessageAt: new Date(),
			tags: ['tag1', 'tag2', 'tag3'],
			customFields: {
				productId: '123456'
			},
			visitor: {
				_id: '',
				name: 'visitor name',
				username: 'visitor-username',
				department: 'department',
				email: 'email@address.com',
				phone: '192873192873',
				ip: '123.456.7.89',
				browser: 'Chrome',
				os: 'Linux',
				customFields: {
					customerId: '123456'
				}
			},
			agent: {
				_id: 'asdf89as6df8',
				username: 'agent.username',
				name: 'Agent Name',
				email: 'agent@email.com'
			},
			messages: [{
				username: 'visitor-username',
				msg: 'message content',
				ts: new Date()
			}, {
				username: 'agent.username',
				agentId: 'asdf89as6df8',
				msg: 'message content from agent',
				ts: new Date()
			}]
		};
		const options = {
			headers: {
				'X-RocketChat-Livechat-Token': RocketChat.settings.get('Livechat_secret_token')
			},
			data: sampleData
		};
		const response = postCatchError(RocketChat.settings.get('Livechat_webhookUrl'), options);
		console.log('response ->', response);

		if (response && response.statusCode && response.statusCode === 200) {
			return true;
		} else {
			throw new Meteor.Error('error-invalid-webhook-response');
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"takeInquiry.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/takeInquiry.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:takeInquiry'(inquiryId) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-l-room')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:takeInquiry'
			});
		}

		const inquiry = RocketChat.models.LivechatInquiry.findOneById(inquiryId);

		if (!inquiry || inquiry.status === 'taken') {
			throw new Meteor.Error('error-not-allowed', 'Inquiry already taken', {
				method: 'livechat:takeInquiry'
			});
		}

		const user = RocketChat.models.Users.findOneById(Meteor.userId());
		const agent = {
			agentId: user._id,
			username: user.username
		}; // add subscription

		const subscriptionData = {
			rid: inquiry.rid,
			name: inquiry.name,
			alert: true,
			open: true,
			unread: 1,
			userMentions: 1,
			groupMentions: 0,
			code: inquiry.code,
			u: {
				_id: agent.agentId,
				username: agent.username
			},
			t: 'l',
			desktopNotifications: 'all',
			mobilePushNotifications: 'all',
			emailNotifications: 'all'
		};
		RocketChat.models.Subscriptions.insert(subscriptionData); // update room

		const room = RocketChat.models.Rooms.findOneById(inquiry.rid);
		RocketChat.models.Rooms.changeAgentByRoomId(inquiry.rid, agent);
		room.servedBy = {
			_id: agent.agentId,
			username: agent.username
		}; // mark inquiry as taken

		RocketChat.models.LivechatInquiry.takeInquiry(inquiry._id); // remove sending message from guest widget
		// dont check if setting is true, because if settingwas switched off inbetween  guest entered pool,
		// and inquiry being taken, message would not be switched off.

		RocketChat.models.Messages.createCommandWithRoomIdAndUser('connected', room._id, user);
		RocketChat.Livechat.stream.emit(room._id, {
			type: 'agentData',
			data: RocketChat.models.Users.getAgentInfo(agent.agentId)
		}); // return room corresponding to inquiry (for redirecting agent to the room route)

		return room;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"returnAsInquiry.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/returnAsInquiry.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:returnAsInquiry'(rid) {
		if (!Meteor.userId() || !RocketChat.authz.hasPermission(Meteor.userId(), 'view-l-room')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'livechat:saveDepartment'
			});
		} // //delete agent and room subscription


		RocketChat.models.Subscriptions.removeByRoomId(rid); // remove user from room

		const username = Meteor.user().username;
		RocketChat.models.Rooms.removeUsernameById(rid, username); // find inquiry corresponding to room

		const inquiry = RocketChat.models.LivechatInquiry.findOne({
			rid
		}); // mark inquiry as open

		return RocketChat.models.LivechatInquiry.openInquiry(inquiry._id);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saveOfficeHours.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/saveOfficeHours.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.methods({
	'livechat:saveOfficeHours'(day, start, finish, open) {
		RocketChat.models.LivechatOfficeHour.updateHours(day, start, finish, open);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sendTranscript.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/methods/sendTranscript.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 0);
Meteor.methods({
	'livechat:sendTranscript'(rid, email) {
		check(rid, String);
		check(email, String);
		const room = RocketChat.models.Rooms.findOneById(rid);
		const user = Meteor.user();
		const userLanguage = user.language || RocketChat.settings.get('language') || 'en'; // allow to only user to send transcripts from their own chats

		if (!room || room.t !== 'l' || !room.v || !user.profile || room.v.token !== user.profile.token) {
			throw new Meteor.Error('error-invalid-room', 'Invalid room');
		}

		const messages = RocketChat.models.Messages.findVisibleByRoomId(rid, {
			sort: {
				'ts': 1
			}
		});
		const header = RocketChat.placeholders.replace(RocketChat.settings.get('Email_Header') || '');
		const footer = RocketChat.placeholders.replace(RocketChat.settings.get('Email_Footer') || '');
		let html = '<div> <hr>';
		messages.forEach(message => {
			if (message.t && ['command', 'livechat-close', 'livechat_video_call'].indexOf(message.t) !== -1) {
				return;
			}

			let author;

			if (message.u._id === Meteor.userId()) {
				author = TAPi18n.__('You', {
					lng: userLanguage
				});
			} else {
				author = message.u.username;
			}

			const datetime = moment(message.ts).locale(userLanguage).format('LLL');
			const singleMessage = `
				<p><strong>${author}</strong>  <em>${datetime}</em></p>
				<p>${message.msg}</p>
			`;
			html = html + singleMessage;
		});
		html = `${html}</div>`;
		let fromEmail = RocketChat.settings.get('From_Email').match(/\b[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,4}\b/i);

		if (fromEmail) {
			fromEmail = fromEmail[0];
		} else {
			fromEmail = RocketChat.settings.get('From_Email');
		}

		emailSettings = {
			to: email,
			from: fromEmail,
			replyTo: fromEmail,
			subject: TAPi18n.__('Transcript_of_your_livechat_conversation', {
				lng: userLanguage
			}),
			html: header + html + footer
		};
		Meteor.defer(() => {
			Email.send(emailSettings);
		});
		Meteor.defer(() => {
			RocketChat.callbacks.run('livechat.sendTranscript', messages, email);
		});
		return true;
	}

});
DDPRateLimiter.addRule({
	type: 'method',
	name: 'livechat:sendTranscript',

	connectionId() {
		return true;
	}

}, 1, 5000);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"Users.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/Users.js                                                                 //
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

/**
 * Sets an user as (non)operator
 * @param {string} _id - User's _id
 * @param {boolean} operator - Flag to set as operator or not
 */RocketChat.models.Users.setOperator = function (_id, operator) {
	const update = {
		$set: {
			operator
		}
	};
	return this.update(_id, update);
}; /**
    * Gets all online agents
    * @return
    */

RocketChat.models.Users.findOnlineAgents = function () {
	const query = {
		status: {
			$exists: true,
			$ne: 'offline'
		},
		statusLivechat: 'available',
		roles: 'livechat-agent'
	};
	return this.find(query);
}; /**
    * Gets all agents
    * @return
    */

RocketChat.models.Users.findAgents = function () {
	const query = {
		roles: 'livechat-agent'
	};
	return this.find(query);
}; /**
    * Find online users from a list
    * @param {array} userList - array of usernames
    * @return
    */

RocketChat.models.Users.findOnlineUserFromList = function (userList) {
	const query = {
		status: {
			$exists: true,
			$ne: 'offline'
		},
		statusLivechat: 'available',
		roles: 'livechat-agent',
		username: {
			$in: [].concat(userList)
		}
	};
	return this.find(query);
}; /**
    * Get next user agent in order
    * @return {object} User from db
    */

RocketChat.models.Users.getNextAgent = function () {
	const query = {
		status: {
			$exists: true,
			$ne: 'offline'
		},
		statusLivechat: 'available',
		roles: 'livechat-agent'
	};
	const collectionObj = this.model.rawCollection();
	const findAndModify = Meteor.wrapAsync(collectionObj.findAndModify, collectionObj);
	const sort = {
		livechatCount: 1,
		username: 1
	};
	const update = {
		$inc: {
			livechatCount: 1
		}
	};
	const user = findAndModify(query, sort, update);

	if (user && user.value) {
		return {
			agentId: user.value._id,
			username: user.value.username
		};
	} else {
		return null;
	}
}; /**
    * Gets visitor by token
    * @param {string} token - Visitor token
    */

RocketChat.models.Users.getVisitorByToken = function (token, options) {
	const query = {
		'profile.guest': true,
		'profile.token': token
	};
	return this.findOne(query, options);
}; /**
    * Gets visitor by token
    * @param {string} token - Visitor token
    */

RocketChat.models.Users.findVisitorByToken = function (token) {
	const query = {
		'profile.guest': true,
		'profile.token': token
	};
	return this.find(query);
}; /**
    * Change user's livechat status
    * @param {string} token - Visitor token
    */

RocketChat.models.Users.setLivechatStatus = function (userId, status) {
	const query = {
		'_id': userId
	};
	const update = {
		$set: {
			'statusLivechat': status
		}
	};
	return this.update(query, update);
}; /**
    * change all livechat agents livechat status to "not-available"
    */

RocketChat.models.Users.closeOffice = function () {
	self = this;
	self.findAgents().forEach(function (agent) {
		self.setLivechatStatus(agent._id, 'not-available');
	});
}; /**
    * change all livechat agents livechat status to "available"
    */

RocketChat.models.Users.openOffice = function () {
	self = this;
	self.findAgents().forEach(function (agent) {
		self.setLivechatStatus(agent._id, 'available');
	});
};

RocketChat.models.Users.updateLivechatDataByToken = function (token, key, value, overwrite = true) {
	const query = {
		'profile.token': token
	};

	if (!overwrite) {
		const user = this.findOne(query, {
			fields: {
				livechatData: 1
			}
		});

		if (user.livechatData && typeof user.livechatData[key] !== 'undefined') {
			return true;
		}
	}

	const update = {
		$set: {
			[`livechatData.${key}`]: value
		}
	};
	return this.update(query, update);
}; /**
    * Find a visitor by their phone number
    * @return {object} User from db
    */

RocketChat.models.Users.findOneVisitorByPhone = function (phone) {
	const query = {
		'phone.phoneNumber': phone
	};
	return this.findOne(query);
}; /**
    * Get the next visitor name
    * @return {string} The next visitor name
    */

RocketChat.models.Users.getNextVisitorUsername = function () {
	const settingsRaw = RocketChat.models.Settings.model.rawCollection();
	const findAndModify = Meteor.wrapAsync(settingsRaw.findAndModify, settingsRaw);
	const query = {
		_id: 'Livechat_guest_count'
	};
	const update = {
		$inc: {
			value: 1
		}
	};
	const livechatCount = findAndModify(query, null, update);
	return `guest-${livechatCount.value.value + 1}`;
};

RocketChat.models.Users.saveGuestById = function (_id, data) {
	const setData = {};
	const unsetData = {};

	if (data.name) {
		if (!_.isEmpty(s.trim(data.name))) {
			setData.name = s.trim(data.name);
		} else {
			unsetData.name = 1;
		}
	}

	if (data.email) {
		if (!_.isEmpty(s.trim(data.email))) {
			setData.visitorEmails = [{
				address: s.trim(data.email)
			}];
		} else {
			unsetData.visitorEmails = 1;
		}
	}

	if (data.phone) {
		if (!_.isEmpty(s.trim(data.phone))) {
			setData.phone = [{
				phoneNumber: s.trim(data.phone)
			}];
		} else {
			unsetData.phone = 1;
		}
	}

	const update = {};

	if (!_.isEmpty(setData)) {
		update.$set = setData;
	}

	if (!_.isEmpty(unsetData)) {
		update.$unset = unsetData;
	}

	if (_.isEmpty(update)) {
		return true;
	}

	return this.update({
		_id
	}, update);
};

RocketChat.models.Users.findOneGuestByEmailAddress = function (emailAddress) {
	const query = {
		'visitorEmails.address': new RegExp(`^${s.escapeRegExp(emailAddress)}$`, 'i')
	};
	return this.findOne(query);
};

RocketChat.models.Users.getAgentInfo = function (agentId) {
	const query = {
		_id: agentId
	};
	const options = {
		fields: {
			name: 1,
			username: 1,
			customFields: 1
		}
	};

	if (RocketChat.settings.get('Livechat_show_agent_email')) {
		options.fields.emails = 1;
	}

	return this.findOne(query, options);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Rooms.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/Rooms.js                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

/**
 * Gets visitor by token
 * @param {string} token - Visitor token
 */RocketChat.models.Rooms.updateSurveyFeedbackById = function (_id, surveyFeedback) {
	const query = {
		_id
	};
	const update = {
		$set: {
			surveyFeedback
		}
	};
	return this.update(query, update);
};

RocketChat.models.Rooms.updateLivechatDataByToken = function (token, key, value, overwrite = true) {
	const query = {
		'v.token': token,
		open: true
	};

	if (!overwrite) {
		const room = this.findOne(query, {
			fields: {
				livechatData: 1
			}
		});

		if (room.livechatData && typeof room.livechatData[key] !== 'undefined') {
			return true;
		}
	}

	const update = {
		$set: {
			[`livechatData.${key}`]: value
		}
	};
	return this.update(query, update);
};

RocketChat.models.Rooms.findLivechat = function (filter = {}, offset = 0, limit = 20) {
	const query = _.extend(filter, {
		t: 'l'
	});

	return this.find(query, {
		sort: {
			ts: -1
		},
		offset,
		limit
	});
};

RocketChat.models.Rooms.findLivechatByCode = function (code, fields) {
	code = parseInt(code);
	const options = {};

	if (fields) {
		options.fields = fields;
	} // if (this.useCache) {
	// 	return this.cache.findByIndex('t,code', ['l', code], options).fetch();
	// }


	const query = {
		t: 'l',
		code
	};
	return this.findOne(query, options);
}; /**
    * Get the next visitor name
    * @return {string} The next visitor name
    */

RocketChat.models.Rooms.getNextLivechatRoomCode = function () {
	const settingsRaw = RocketChat.models.Settings.model.rawCollection();
	const findAndModify = Meteor.wrapAsync(settingsRaw.findAndModify, settingsRaw);
	const query = {
		_id: 'Livechat_Room_Count'
	};
	const update = {
		$inc: {
			value: 1
		}
	};
	const livechatCount = findAndModify(query, null, update);
	return livechatCount.value.value;
};

RocketChat.models.Rooms.findOpenByVisitorToken = function (visitorToken, options) {
	const query = {
		open: true,
		'v.token': visitorToken
	};
	return this.find(query, options);
};

RocketChat.models.Rooms.findByVisitorToken = function (visitorToken) {
	const query = {
		'v.token': visitorToken
	};
	return this.find(query);
};

RocketChat.models.Rooms.findByVisitorId = function (visitorId) {
	const query = {
		'v._id': visitorId
	};
	return this.find(query);
};

RocketChat.models.Rooms.findOneOpenByVisitorId = function (visitorId, roomId) {
	const query = {
		_id: roomId,
		open: true,
		'v._id': visitorId
	};
	return this.findOne(query);
};

RocketChat.models.Rooms.setResponseByRoomId = function (roomId, response) {
	return this.update({
		_id: roomId
	}, {
		$set: {
			responseBy: {
				_id: response.user._id,
				username: response.user.username
			},
			responseDate: response.responseDate,
			responseTime: response.responseTime
		},
		$unset: {
			waitingResponse: 1
		}
	});
};

RocketChat.models.Rooms.closeByRoomId = function (roomId, closeInfo) {
	return this.update({
		_id: roomId
	}, {
		$set: {
			closedBy: {
				_id: closeInfo.user._id,
				username: closeInfo.user.username
			},
			closedAt: closeInfo.closedAt,
			chatDuration: closeInfo.chatDuration
		},
		$unset: {
			open: 1
		}
	});
};

RocketChat.models.Rooms.setLabelByRoomId = function (roomId, label) {
	return this.update({
		_id: roomId
	}, {
		$set: {
			label
		}
	});
};

RocketChat.models.Rooms.findOpenByAgent = function (userId) {
	const query = {
		open: true,
		'servedBy._id': userId
	};
	return this.find(query);
};

RocketChat.models.Rooms.changeAgentByRoomId = function (roomId, newAgent) {
	const query = {
		_id: roomId
	};
	const update = {
		$set: {
			servedBy: {
				_id: newAgent.agentId,
				username: newAgent.username
			}
		}
	};
	this.update(query, update);
};

RocketChat.models.Rooms.saveCRMDataByRoomId = function (roomId, crmData) {
	const query = {
		_id: roomId
	};
	const update = {
		$set: {
			crmData
		}
	};
	return this.update(query, update);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatExternalMessage.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatExternalMessage.js                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
class LivechatExternalMessage extends RocketChat.models._Base {
	constructor() {
		super('livechat_external_message');

		if (Meteor.isClient) {
			this._initModel('livechat_external_message');
		}
	} // FIND


	findByRoomId(roomId, sort = {
		ts: -1
	}) {
		const query = {
			rid: roomId
		};
		return this.find(query, {
			sort
		});
	}

}

RocketChat.models.LivechatExternalMessage = new LivechatExternalMessage();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatCustomField.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatCustomField.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

/**
 * Livechat Custom Fields model
 */class LivechatCustomField extends RocketChat.models._Base {
	constructor() {
		super('livechat_custom_field');
	} // FIND


	findOneById(_id, options) {
		const query = {
			_id
		};
		return this.findOne(query, options);
	}

	createOrUpdateCustomField(_id, field, label, scope, visibility, extraData) {
		const record = {
			label,
			scope,
			visibility
		};

		_.extend(record, extraData);

		if (_id) {
			this.update({
				_id
			}, {
				$set: record
			});
		} else {
			record._id = field;
			_id = this.insert(record);
		}

		return record;
	} // REMOVE


	removeById(_id) {
		const query = {
			_id
		};
		return this.remove(query);
	}

}

RocketChat.models.LivechatCustomField = new LivechatCustomField();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatDepartment.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatDepartment.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

/**
 * Livechat Department model
 */class LivechatDepartment extends RocketChat.models._Base {
	constructor() {
		super('livechat_department');
		this.tryEnsureIndex({
			numAgents: 1,
			enabled: 1
		});
	} // FIND


	findOneById(_id, options) {
		const query = {
			_id
		};
		return this.findOne(query, options);
	}

	findByDepartmentId(_id, options) {
		const query = {
			_id
		};
		return this.find(query, options);
	}

	createOrUpdateDepartment(_id, {
		enabled,
		name,
		description,
		showOnRegistration
	}, agents) {
		agents = [].concat(agents);
		const record = {
			enabled,
			name,
			description,
			numAgents: agents.length,
			showOnRegistration
		};

		if (_id) {
			this.update({
				_id
			}, {
				$set: record
			});
		} else {
			_id = this.insert(record);
		}

		const savedAgents = _.pluck(RocketChat.models.LivechatDepartmentAgents.findByDepartmentId(_id).fetch(), 'agentId');

		const agentsToSave = _.pluck(agents, 'agentId'); // remove other agents


		_.difference(savedAgents, agentsToSave).forEach(agentId => {
			RocketChat.models.LivechatDepartmentAgents.removeByDepartmentIdAndAgentId(_id, agentId);
		});

		agents.forEach(agent => {
			RocketChat.models.LivechatDepartmentAgents.saveAgent({
				agentId: agent.agentId,
				departmentId: _id,
				username: agent.username,
				count: agent.count ? parseInt(agent.count) : 0,
				order: agent.order ? parseInt(agent.order) : 0
			});
		});
		return _.extend(record, {
			_id
		});
	} // REMOVE


	removeById(_id) {
		const query = {
			_id
		};
		return this.remove(query);
	}

	findEnabledWithAgents() {
		const query = {
			numAgents: {
				$gt: 0
			},
			enabled: true
		};
		return this.find(query);
	}

}

RocketChat.models.LivechatDepartment = new LivechatDepartment();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatDepartmentAgents.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatDepartmentAgents.js                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

/**
 * Livechat Department model
 */class LivechatDepartmentAgents extends RocketChat.models._Base {
	constructor() {
		super('livechat_department_agents');
	}

	findByDepartmentId(departmentId) {
		return this.find({
			departmentId
		});
	}

	saveAgent(agent) {
		return this.upsert({
			agentId: agent.agentId,
			departmentId: agent.departmentId
		}, {
			$set: {
				username: agent.username,
				count: parseInt(agent.count),
				order: parseInt(agent.order)
			}
		});
	}

	removeByDepartmentIdAndAgentId(departmentId, agentId) {
		this.remove({
			departmentId,
			agentId
		});
	}

	getNextAgentForDepartment(departmentId) {
		const agents = this.findByDepartmentId(departmentId).fetch();

		if (agents.length === 0) {
			return;
		}

		const onlineUsers = RocketChat.models.Users.findOnlineUserFromList(_.pluck(agents, 'username'));

		const onlineUsernames = _.pluck(onlineUsers.fetch(), 'username');

		const query = {
			departmentId,
			username: {
				$in: onlineUsernames
			}
		};
		const sort = {
			count: 1,
			order: 1,
			username: 1
		};
		const update = {
			$inc: {
				count: 1
			}
		};
		const collectionObj = this.model.rawCollection();
		const findAndModify = Meteor.wrapAsync(collectionObj.findAndModify, collectionObj);
		const agent = findAndModify(query, sort, update);

		if (agent && agent.value) {
			return {
				agentId: agent.value.agentId,
				username: agent.value.username
			};
		} else {
			return null;
		}
	}

	getOnlineForDepartment(departmentId) {
		const agents = this.findByDepartmentId(departmentId).fetch();

		if (agents.length === 0) {
			return [];
		}

		const onlineUsers = RocketChat.models.Users.findOnlineUserFromList(_.pluck(agents, 'username'));

		const onlineUsernames = _.pluck(onlineUsers.fetch(), 'username');

		const query = {
			departmentId,
			username: {
				$in: onlineUsernames
			}
		};
		const depAgents = this.find(query);

		if (depAgents) {
			return depAgents;
		} else {
			return [];
		}
	}

	findUsersInQueue(usersList) {
		const query = {};

		if (!_.isEmpty(usersList)) {
			query.username = {
				$in: usersList
			};
		}

		const options = {
			sort: {
				departmentId: 1,
				count: 1,
				order: 1,
				username: 1
			}
		};
		return this.find(query, options);
	}

}

RocketChat.models.LivechatDepartmentAgents = new LivechatDepartmentAgents();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatPageVisited.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatPageVisited.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * Livechat Page Visited model
 */class LivechatPageVisited extends RocketChat.models._Base {
	constructor() {
		super('livechat_page_visited');
		this.tryEnsureIndex({
			'token': 1
		});
		this.tryEnsureIndex({
			'ts': 1
		}); // keep history for 1 month if the visitor does not register

		this.tryEnsureIndex({
			'expireAt': 1
		}, {
			sparse: 1,
			expireAfterSeconds: 0
		});
	}

	saveByToken(token, pageInfo) {
		// keep history of unregistered visitors for 1 month
		const keepHistoryMiliseconds = 2592000000;
		return this.insert({
			token,
			page: pageInfo,
			ts: new Date(),
			expireAt: new Date().getTime() + keepHistoryMiliseconds
		});
	}

	findByToken(token) {
		return this.find({
			token
		}, {
			sort: {
				ts: -1
			},
			limit: 20
		});
	}

	keepHistoryForToken(token) {
		return this.update({
			token,
			expireAt: {
				$exists: true
			}
		}, {
			$unset: {
				expireAt: 1
			}
		}, {
			multi: true
		});
	}

}

RocketChat.models.LivechatPageVisited = new LivechatPageVisited();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatTrigger.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatTrigger.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * Livechat Trigger model
 */class LivechatTrigger extends RocketChat.models._Base {
	constructor() {
		super('livechat_trigger');
	}

	updateById(_id, data) {
		return this.update({
			_id
		}, {
			$set: data
		});
	}

	removeAll() {
		return this.remove({});
	}

	findById(_id) {
		return this.find({
			_id
		});
	}

	removeById(_id) {
		return this.remove({
			_id
		});
	}

	findEnabled() {
		return this.find({
			enabled: true
		});
	}

}

RocketChat.models.LivechatTrigger = new LivechatTrigger();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"indexes.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/indexes.js                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.startup(function () {
	RocketChat.models.Rooms.tryEnsureIndex({
		code: 1
	});
	RocketChat.models.Rooms.tryEnsureIndex({
		open: 1
	}, {
		sparse: 1
	});
	RocketChat.models.Users.tryEnsureIndex({
		'visitorEmails.address': 1
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatInquiry.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatInquiry.js                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
class LivechatInquiry extends RocketChat.models._Base {
	constructor() {
		super('livechat_inquiry');
		this.tryEnsureIndex({
			'rid': 1
		}); // room id corresponding to this inquiry

		this.tryEnsureIndex({
			'name': 1
		}); // name of the inquiry (client name for now)

		this.tryEnsureIndex({
			'message': 1
		}); // message sent by the client

		this.tryEnsureIndex({
			'ts': 1
		}); // timestamp

		this.tryEnsureIndex({
			'code': 1
		}); // (for routing)

		this.tryEnsureIndex({
			'agents': 1
		}); // Id's of the agents who can see the inquiry (handle departments)

		this.tryEnsureIndex({
			'status': 1
		}); // 'open', 'taken'
	}

	findOneById(inquiryId) {
		return this.findOne({
			_id: inquiryId
		});
	} /*
    * mark the inquiry as taken
    */

	takeInquiry(inquiryId) {
		this.update({
			'_id': inquiryId
		}, {
			$set: {
				status: 'taken'
			}
		});
	} /*
    * mark inquiry as open
    */

	openInquiry(inquiryId) {
		this.update({
			'_id': inquiryId
		}, {
			$set: {
				status: 'open'
			}
		});
	} /*
    * return the status of the inquiry (open or taken)
    */

	getStatus(inquiryId) {
		return this.findOne({
			'_id': inquiryId
		}).status;
	}

}

RocketChat.models.LivechatInquiry = new LivechatInquiry();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"LivechatOfficeHour.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/models/LivechatOfficeHour.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 0);

class LivechatOfficeHour extends RocketChat.models._Base {
	constructor() {
		super('livechat_office_hour');
		this.tryEnsureIndex({
			'day': 1
		}); // the day of the week monday - sunday

		this.tryEnsureIndex({
			'start': 1
		}); // the opening hours of the office

		this.tryEnsureIndex({
			'finish': 1
		}); // the closing hours of the office

		this.tryEnsureIndex({
			'open': 1
		}); // whether or not the offices are open on this day
		// if there is nothing in the collection, add defaults

		if (this.find().count() === 0) {
			this.insert({
				'day': 'Monday',
				'start': '08:00',
				'finish': '20:00',
				'code': 1,
				'open': true
			});
			this.insert({
				'day': 'Tuesday',
				'start': '08:00',
				'finish': '20:00',
				'code': 2,
				'open': true
			});
			this.insert({
				'day': 'Wednesday',
				'start': '08:00',
				'finish': '20:00',
				'code': 3,
				'open': true
			});
			this.insert({
				'day': 'Thursday',
				'start': '08:00',
				'finish': '20:00',
				'code': 4,
				'open': true
			});
			this.insert({
				'day': 'Friday',
				'start': '08:00',
				'finish': '20:00',
				'code': 5,
				'open': true
			});
			this.insert({
				'day': 'Saturday',
				'start': '08:00',
				'finish': '20:00',
				'code': 6,
				'open': false
			});
			this.insert({
				'day': 'Sunday',
				'start': '08:00',
				'finish': '20:00',
				'code': 0,
				'open': false
			});
		}
	} /*
    * update the given days start and finish times and whether the office is open on that day
    */

	updateHours(day, newStart, newFinish, newOpen) {
		this.update({
			day
		}, {
			$set: {
				start: newStart,
				finish: newFinish,
				open: newOpen
			}
		});
	} /*
    * Check if the current server time (utc) is within the office hours of that day
    * returns true or false
    */

	isNowWithinHours() {
		// get current time on server in utc
		// var ct = moment().utc();
		const currentTime = moment.utc(moment().utc().format('dddd:HH:mm'), 'dddd:HH:mm'); // get todays office hours from db

		const todaysOfficeHours = this.findOne({
			day: currentTime.format('dddd')
		});

		if (!todaysOfficeHours) {
			return false;
		} // check if offices are open today


		if (todaysOfficeHours.open === false) {
			return false;
		}

		const start = moment.utc(`${todaysOfficeHours.day}:${todaysOfficeHours.start}`, 'dddd:HH:mm');
		const finish = moment.utc(`${todaysOfficeHours.day}:${todaysOfficeHours.finish}`, 'dddd:HH:mm'); // console.log(finish.isBefore(start));

		if (finish.isBefore(start)) {
			// finish.day(finish.day()+1);
			finish.add(1, 'days');
		}

		const result = currentTime.isBetween(start, finish); // inBetween  check

		return result;
	}

	isOpeningTime() {
		// get current time on server in utc
		const currentTime = moment.utc(moment().utc().format('dddd:HH:mm'), 'dddd:HH:mm'); // get todays office hours from db

		const todaysOfficeHours = this.findOne({
			day: currentTime.format('dddd')
		});

		if (!todaysOfficeHours) {
			return false;
		} // check if offices are open today


		if (todaysOfficeHours.open === false) {
			return false;
		}

		const start = moment.utc(`${todaysOfficeHours.day}:${todaysOfficeHours.start}`, 'dddd:HH:mm');
		return start.isSame(currentTime, 'minute');
	}

	isClosingTime() {
		// get current time on server in utc
		const currentTime = moment.utc(moment().utc().format('dddd:HH:mm'), 'dddd:HH:mm'); // get todays office hours from db

		const todaysOfficeHours = this.findOne({
			day: currentTime.format('dddd')
		});

		if (!todaysOfficeHours) {
			return false;
		}

		const finish = moment.utc(`${todaysOfficeHours.day}:${todaysOfficeHours.finish}`, 'dddd:HH:mm');
		return finish.isSame(currentTime, 'minute');
	}

}

RocketChat.models.LivechatOfficeHour = new LivechatOfficeHour();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lib":{"Livechat.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/lib/Livechat.js                                                                 //
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
let UAParser;
module.watch(require("ua-parser-js"), {
	default(v) {
		UAParser = v;
	}

}, 2);
RocketChat.Livechat = {
	historyMonitorType: 'url',
	logger: new Logger('Livechat', {
		sections: {
			webhook: 'Webhook'
		}
	}),

	getNextAgent(department) {
		if (department) {
			return RocketChat.models.LivechatDepartmentAgents.getNextAgentForDepartment(department);
		} else {
			return RocketChat.models.Users.getNextAgent();
		}
	},

	getAgents(department) {
		if (department) {
			return RocketChat.models.LivechatDepartmentAgents.findByDepartmentId(department);
		} else {
			return RocketChat.models.Users.findAgents();
		}
	},

	getOnlineAgents(department) {
		if (department) {
			return RocketChat.models.LivechatDepartmentAgents.getOnlineForDepartment(department);
		} else {
			return RocketChat.models.Users.findOnlineAgents();
		}
	},

	getRoom(guest, message, roomInfo) {
		let room = RocketChat.models.Rooms.findOneById(message.rid);
		let newRoom = false;

		if (room && !room.open) {
			message.rid = Random.id();
			room = null;
		}

		if (room == null) {
			// if no department selected verify if there is at least one active and pick the first
			if (!guest.department) {
				const departments = RocketChat.models.LivechatDepartment.findEnabledWithAgents();

				if (departments.count() > 0) {
					departments.forEach(dept => {
						if (!guest.department && dept.showOnRegistration) {
							guest.department = dept._id;
						}
					});
				}
			} // delegate room creation to QueueMethods


			const routingMethod = RocketChat.settings.get('Livechat_Routing_Method');
			room = RocketChat.QueueMethods[routingMethod](guest, message, roomInfo);
			newRoom = true;
		} else {
			room = Meteor.call('canAccessRoom', message.rid, guest._id);
		}

		if (!room) {
			throw new Meteor.Error('cannot-access-room');
		}

		return {
			room,
			newRoom
		};
	},

	sendMessage({
		guest,
		message,
		roomInfo
	}) {
		const {
			room,
			newRoom
		} = this.getRoom(guest, message, roomInfo);

		if (guest.name) {
			message.alias = guest.name;
		} // return messages;


		return _.extend(RocketChat.sendMessage(guest, message, room), {
			newRoom,
			showConnecting: this.showConnecting()
		});
	},

	registerGuest({
		token,
		name,
		email,
		department,
		phone,
		loginToken,
		username
	} = {}) {
		check(token, String);
		let userId;
		const updateUser = {
			$set: {
				profile: {
					guest: true,
					token
				}
			}
		};
		const user = RocketChat.models.Users.getVisitorByToken(token, {
			fields: {
				_id: 1
			}
		});

		if (user) {
			userId = user._id;

			if (loginToken) {
				if (!updateUser.$addToSet) {
					updateUser.$addToSet = {};
				}

				updateUser.$addToSet['services.resume.loginTokens'] = loginToken;
			}
		} else {
			if (!username) {
				username = RocketChat.models.Users.getNextVisitorUsername();
			}

			let existingUser = null;

			if (s.trim(email) !== '' && (existingUser = RocketChat.models.Users.findOneGuestByEmailAddress(email))) {
				if (loginToken) {
					if (!updateUser.$addToSet) {
						updateUser.$addToSet = {};
					}

					updateUser.$addToSet['services.resume.loginTokens'] = loginToken;
				}

				userId = existingUser._id;
			} else {
				const userData = {
					username,
					globalRoles: ['livechat-guest'],
					department,
					type: 'visitor',
					joinDefaultChannels: false
				};

				if (this.connection) {
					userData.userAgent = this.connection.httpHeaders['user-agent'];
					userData.ip = this.connection.httpHeaders['x-real-ip'] || this.connection.httpHeaders['x-forwarded-for'] || this.connection.clientAddress;
					userData.host = this.connection.httpHeaders.host;
				}

				userId = Accounts.insertUserDoc({}, userData);

				if (loginToken) {
					updateUser.$set.services = {
						resume: {
							loginTokens: [loginToken]
						}
					};
				}
			}
		}

		if (phone) {
			updateUser.$set.phone = [{
				phoneNumber: phone.number
			}];
		}

		if (email && email.trim() !== '') {
			updateUser.$set.visitorEmails = [{
				address: email
			}];
		}

		if (name) {
			RocketChat._setRealName(userId, name);
		}

		Meteor.users.update(userId, updateUser);
		return userId;
	},

	setDepartmentForGuest({
		token,
		department
	} = {}) {
		check(token, String);
		const updateUser = {
			$set: {
				department
			}
		};
		const user = RocketChat.models.Users.getVisitorByToken(token, {
			fields: {
				_id: 1
			}
		});

		if (user) {
			return Meteor.users.update(user._id, updateUser);
		}

		return false;
	},

	saveGuest({
		_id,
		name,
		email,
		phone
	}) {
		const updateData = {};

		if (name) {
			updateData.name = name;
		}

		if (email) {
			updateData.email = email;
		}

		if (phone) {
			updateData.phone = phone;
		}

		const ret = RocketChat.models.Users.saveGuestById(_id, updateData);
		Meteor.defer(() => {
			RocketChat.callbacks.run('livechat.saveGuest', updateData);
		});
		return ret;
	},

	closeRoom({
		user,
		room,
		comment
	}) {
		const now = new Date();
		RocketChat.models.Rooms.closeByRoomId(room._id, {
			user: {
				_id: user._id,
				username: user.username
			},
			closedAt: now,
			chatDuration: (now.getTime() - room.ts) / 1000
		});
		const message = {
			t: 'livechat-close',
			msg: comment,
			groupable: false
		};
		RocketChat.sendMessage(user, message, room);
		RocketChat.models.Subscriptions.hideByRoomIdAndUserId(room._id, user._id);
		RocketChat.models.Messages.createCommandWithRoomIdAndUser('promptTranscript', room._id, user);
		Meteor.defer(() => {
			RocketChat.callbacks.run('livechat.closeRoom', room);
		});
		return true;
	},

	getInitSettings() {
		const settings = {};
		RocketChat.models.Settings.findNotHiddenPublic(['Livechat_title', 'Livechat_title_color', 'Livechat_enabled', 'Livechat_registration_form', 'Livechat_allow_switching_departments', 'Livechat_offline_title', 'Livechat_offline_title_color', 'Livechat_offline_message', 'Livechat_offline_success_message', 'Livechat_offline_form_unavailable', 'Livechat_display_offline_form', 'Livechat_videocall_enabled', 'Jitsi_Enabled', 'Language', 'Livechat_enable_transcript', 'Livechat_transcript_message']).forEach(setting => {
			settings[setting._id] = setting.value;
		});
		return settings;
	},

	saveRoomInfo(roomData, guestData) {
		if ((roomData.topic != null || roomData.tags != null) && !RocketChat.models.Rooms.setTopicAndTagsById(roomData._id, roomData.topic, roomData.tags)) {
			return false;
		}

		Meteor.defer(() => {
			RocketChat.callbacks.run('livechat.saveRoom', roomData);
		});

		if (!_.isEmpty(guestData.name)) {
			return RocketChat.models.Rooms.setLabelByRoomId(roomData._id, guestData.name) && RocketChat.models.Subscriptions.updateNameByRoomId(roomData._id, guestData.name);
		}
	},

	closeOpenChats(userId, comment) {
		const user = RocketChat.models.Users.findOneById(userId);
		RocketChat.models.Rooms.findOpenByAgent(userId).forEach(room => {
			this.closeRoom({
				user,
				room,
				comment
			});
		});
	},

	forwardOpenChats(userId) {
		RocketChat.models.Rooms.findOpenByAgent(userId).forEach(room => {
			const guest = RocketChat.models.Users.findOneById(room.v._id);
			this.transfer(room, guest, {
				departmentId: guest.department
			});
		});
	},

	savePageHistory(token, pageInfo) {
		if (pageInfo.change === RocketChat.Livechat.historyMonitorType) {
			return RocketChat.models.LivechatPageVisited.saveByToken(token, pageInfo);
		}

		return;
	},

	transfer(room, guest, transferData) {
		let agent;

		if (transferData.userId) {
			const user = RocketChat.models.Users.findOneById(transferData.userId);
			agent = {
				agentId: user._id,
				username: user.username
			};
		} else {
			agent = RocketChat.Livechat.getNextAgent(transferData.departmentId);
		}

		const servedBy = room.servedBy;

		if (agent && agent.agentId !== servedBy._id) {
			room.usernames = _.without(room.usernames, servedBy.username).concat(agent.username);
			RocketChat.models.Rooms.changeAgentByRoomId(room._id, agent);
			const subscriptionData = {
				rid: room._id,
				name: guest.name || guest.username,
				alert: true,
				open: true,
				unread: 1,
				userMentions: 1,
				groupMentions: 0,
				code: room.code,
				u: {
					_id: agent.agentId,
					username: agent.username
				},
				t: 'l',
				desktopNotifications: 'all',
				mobilePushNotifications: 'all',
				emailNotifications: 'all'
			};
			RocketChat.models.Subscriptions.removeByRoomIdAndUserId(room._id, servedBy._id);
			RocketChat.models.Subscriptions.insert(subscriptionData);
			RocketChat.models.Messages.createUserLeaveWithRoomIdAndUser(room._id, {
				_id: servedBy._id,
				username: servedBy.username
			});
			RocketChat.models.Messages.createUserJoinWithRoomIdAndUser(room._id, {
				_id: agent.agentId,
				username: agent.username
			});
			RocketChat.Livechat.stream.emit(room._id, {
				type: 'agentData',
				data: RocketChat.models.Users.getAgentInfo(agent.agentId)
			});
			return true;
		}

		return false;
	},

	sendRequest(postData, callback, trying = 1) {
		try {
			const options = {
				headers: {
					'X-RocketChat-Livechat-Token': RocketChat.settings.get('Livechat_secret_token')
				},
				data: postData
			};
			return HTTP.post(RocketChat.settings.get('Livechat_webhookUrl'), options);
		} catch (e) {
			RocketChat.Livechat.logger.webhook.error(`Response error on ${trying} try ->`, e); // try 10 times after 10 seconds each

			if (trying < 10) {
				RocketChat.Livechat.logger.webhook.warn('Will try again in 10 seconds ...');
				trying++;
				setTimeout(Meteor.bindEnvironment(() => {
					RocketChat.Livechat.sendRequest(postData, callback, trying);
				}), 10000);
			}
		}
	},

	getLivechatRoomGuestInfo(room) {
		const visitor = RocketChat.models.Users.findOneById(room.v._id);
		const agent = RocketChat.models.Users.findOneById(room.servedBy._id);
		const ua = new UAParser();
		ua.setUA(visitor.userAgent);
		const postData = {
			_id: room._id,
			label: room.label,
			topic: room.topic,
			code: room.code,
			createdAt: room.ts,
			lastMessageAt: room.lm,
			tags: room.tags,
			customFields: room.livechatData,
			visitor: {
				_id: visitor._id,
				name: visitor.name,
				username: visitor.username,
				email: null,
				phone: null,
				department: visitor.department,
				ip: visitor.ip,
				os: ua.getOS().name && `${ua.getOS().name} ${ua.getOS().version}`,
				browser: ua.getBrowser().name && `${ua.getBrowser().name} ${ua.getBrowser().version}`,
				customFields: visitor.livechatData
			},
			agent: {
				_id: agent._id,
				username: agent.username,
				name: agent.name,
				email: null
			}
		};

		if (room.crmData) {
			postData.crmData = room.crmData;
		}

		if (visitor.visitorEmails && visitor.visitorEmails.length > 0) {
			postData.visitor.email = visitor.visitorEmails[0].address;
		}

		if (visitor.phone && visitor.phone.length > 0) {
			postData.visitor.phone = visitor.phone[0].phoneNumber;
		}

		if (agent.emails && agent.emails.length > 0) {
			postData.agent.email = agent.emails[0].address;
		}

		return postData;
	},

	addAgent(username) {
		check(username, String);
		const user = RocketChat.models.Users.findOneByUsername(username, {
			fields: {
				_id: 1,
				username: 1
			}
		});

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'livechat:addAgent'
			});
		}

		if (RocketChat.authz.addUserRoles(user._id, 'livechat-agent')) {
			RocketChat.models.Users.setOperator(user._id, true);
			RocketChat.models.Users.setLivechatStatus(user._id, 'available');
			return user;
		}

		return false;
	},

	addManager(username) {
		check(username, String);
		const user = RocketChat.models.Users.findOneByUsername(username, {
			fields: {
				_id: 1,
				username: 1
			}
		});

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'livechat:addManager'
			});
		}

		if (RocketChat.authz.addUserRoles(user._id, 'livechat-manager')) {
			return user;
		}

		return false;
	},

	removeAgent(username) {
		check(username, String);
		const user = RocketChat.models.Users.findOneByUsername(username, {
			fields: {
				_id: 1
			}
		});

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'livechat:removeAgent'
			});
		}

		if (RocketChat.authz.removeUserFromRoles(user._id, 'livechat-agent')) {
			RocketChat.models.Users.setOperator(user._id, false);
			RocketChat.models.Users.setLivechatStatus(user._id, 'not-available');
			return true;
		}

		return false;
	},

	removeManager(username) {
		check(username, String);
		const user = RocketChat.models.Users.findOneByUsername(username, {
			fields: {
				_id: 1
			}
		});

		if (!user) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'livechat:removeManager'
			});
		}

		return RocketChat.authz.removeUserFromRoles(user._id, 'livechat-manager');
	},

	saveDepartment(_id, departmentData, departmentAgents) {
		check(_id, Match.Maybe(String));
		check(departmentData, {
			enabled: Boolean,
			name: String,
			description: Match.Optional(String),
			showOnRegistration: Boolean
		});
		check(departmentAgents, [Match.ObjectIncluding({
			agentId: String,
			username: String
		})]);

		if (_id) {
			const department = RocketChat.models.LivechatDepartment.findOneById(_id);

			if (!department) {
				throw new Meteor.Error('error-department-not-found', 'Department not found', {
					method: 'livechat:saveDepartment'
				});
			}
		}

		return RocketChat.models.LivechatDepartment.createOrUpdateDepartment(_id, departmentData, departmentAgents);
	},

	removeDepartment(_id) {
		check(_id, String);
		const department = RocketChat.models.LivechatDepartment.findOneById(_id, {
			fields: {
				_id: 1
			}
		});

		if (!department) {
			throw new Meteor.Error('department-not-found', 'Department not found', {
				method: 'livechat:removeDepartment'
			});
		}

		return RocketChat.models.LivechatDepartment.removeById(_id);
	},

	showConnecting() {
		if (RocketChat.settings.get('Livechat_Routing_Method') === 'Guest_Pool') {
			return RocketChat.settings.get('Livechat_open_inquiery_show_connecting');
		} else {
			return false;
		}
	}

};
RocketChat.Livechat.stream = new Meteor.Streamer('livechat-room');
RocketChat.Livechat.stream.allowRead('logged');
RocketChat.settings.get('Livechat_history_monitor_type', (key, value) => {
	RocketChat.Livechat.historyMonitorType = value;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"QueueMethods.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/lib/QueueMethods.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
RocketChat.QueueMethods = {
	/* Least Amount Queuing method:
  *
  * default method where the agent with the least number
  * of open chats is paired with the incoming livechat
  */'Least_Amount'(guest, message, roomInfo) {
		const agent = RocketChat.Livechat.getNextAgent(guest.department);

		if (!agent) {
			throw new Meteor.Error('no-agent-online', 'Sorry, no online agents');
		}

		const roomCode = RocketChat.models.Rooms.getNextLivechatRoomCode();

		const room = _.extend({
			_id: message.rid,
			msgs: 1,
			lm: new Date(),
			code: roomCode,
			label: guest.name || guest.username,
			// usernames: [agent.username, guest.username],
			t: 'l',
			ts: new Date(),
			v: {
				_id: guest._id,
				username: guest.username,
				token: message.token
			},
			servedBy: {
				_id: agent.agentId,
				username: agent.username
			},
			cl: false,
			open: true,
			waitingResponse: true
		}, roomInfo);

		const subscriptionData = {
			rid: message.rid,
			name: guest.name || guest.username,
			alert: true,
			open: true,
			unread: 1,
			userMentions: 1,
			groupMentions: 0,
			code: roomCode,
			u: {
				_id: agent.agentId,
				username: agent.username
			},
			t: 'l',
			desktopNotifications: 'all',
			mobilePushNotifications: 'all',
			emailNotifications: 'all'
		};
		RocketChat.models.Rooms.insert(room);
		RocketChat.models.Subscriptions.insert(subscriptionData);
		RocketChat.Livechat.stream.emit(room._id, {
			type: 'agentData',
			data: RocketChat.models.Users.getAgentInfo(agent.agentId)
		});
		return room;
	},

	/* Guest Pool Queuing Method:
  *
  * An incomming livechat is created as an Inquiry
  * which is picked up from an agent.
  * An Inquiry is visible to all agents (TODO: in the correct department)
     *
  * A room is still created with the initial message, but it is occupied by
  * only the client until paired with an agent
  */'Guest_Pool'(guest, message, roomInfo) {
		let agents = RocketChat.Livechat.getOnlineAgents(guest.department);

		if (agents.count() === 0 && RocketChat.settings.get('Livechat_guest_pool_with_no_agents')) {
			agents = RocketChat.Livechat.getAgents(guest.department);
		}

		if (agents.count() === 0) {
			throw new Meteor.Error('no-agent-online', 'Sorry, no online agents');
		}

		const roomCode = RocketChat.models.Rooms.getNextLivechatRoomCode();
		const agentIds = [];
		agents.forEach(agent => {
			if (guest.department) {
				agentIds.push(agent.agentId);
			} else {
				agentIds.push(agent._id);
			}
		});
		const inquiry = {
			rid: message.rid,
			message: message.msg,
			name: guest.name || guest.username,
			ts: new Date(),
			code: roomCode,
			department: guest.department,
			agents: agentIds,
			status: 'open',
			v: {
				_id: guest._id,
				username: guest.username,
				token: message.token
			},
			t: 'l'
		};

		const room = _.extend({
			_id: message.rid,
			msgs: 1,
			lm: new Date(),
			code: roomCode,
			label: guest.name || guest.username,
			// usernames: [guest.username],
			t: 'l',
			ts: new Date(),
			v: {
				_id: guest._id,
				username: guest.username,
				token: message.token
			},
			cl: false,
			open: true,
			waitingResponse: true
		}, roomInfo);

		RocketChat.models.LivechatInquiry.insert(inquiry);
		RocketChat.models.Rooms.insert(room);
		return room;
	}

};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"OfficeClock.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/lib/OfficeClock.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// Every minute check if office closed
Meteor.setInterval(function () {
	if (RocketChat.settings.get('Livechat_enable_office_hours')) {
		if (RocketChat.models.LivechatOfficeHour.isOpeningTime()) {
			RocketChat.models.Users.openOffice();
		} else if (RocketChat.models.LivechatOfficeHour.isClosingTime()) {
			RocketChat.models.Users.closeOffice();
		}
	}
}, 60000);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"OmniChannel.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/lib/OmniChannel.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
const gatewayURL = 'https://omni.rocket.chat';
module.exportDefault({
	enable() {
		const result = HTTP.call('POST', `${gatewayURL}/facebook/enable`, {
			headers: {
				'authorization': `Bearer ${RocketChat.settings.get('Livechat_Facebook_API_Key')}`,
				'content-type': 'application/json'
			},
			data: {
				url: RocketChat.settings.get('Site_Url')
			}
		});
		return result.data;
	},

	disable() {
		const result = HTTP.call('DELETE', `${gatewayURL}/facebook/enable`, {
			headers: {
				'authorization': `Bearer ${RocketChat.settings.get('Livechat_Facebook_API_Key')}`,
				'content-type': 'application/json'
			}
		});
		return result.data;
	},

	listPages() {
		const result = HTTP.call('GET', `${gatewayURL}/facebook/pages`, {
			headers: {
				'authorization': `Bearer ${RocketChat.settings.get('Livechat_Facebook_API_Key')}`
			}
		});
		return result.data;
	},

	subscribe(pageId) {
		const result = HTTP.call('POST', `${gatewayURL}/facebook/page/${pageId}/subscribe`, {
			headers: {
				'authorization': `Bearer ${RocketChat.settings.get('Livechat_Facebook_API_Key')}`
			}
		});
		return result.data;
	},

	unsubscribe(pageId) {
		const result = HTTP.call('DELETE', `${gatewayURL}/facebook/page/${pageId}/subscribe`, {
			headers: {
				'authorization': `Bearer ${RocketChat.settings.get('Livechat_Facebook_API_Key')}`
			}
		});
		return result.data;
	},

	reply({
		page,
		token,
		text
	}) {
		return HTTP.call('POST', `${gatewayURL}/facebook/reply`, {
			headers: {
				'authorization': `Bearer ${RocketChat.settings.get('Livechat_Facebook_API_Key')}`
			},
			data: {
				page,
				token,
				text
			}
		});
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"sendMessageBySMS.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/sendMessageBySMS.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.callbacks.add('afterSaveMessage', function (message, room) {
	// skips this callback if the message was edited
	if (message.editedAt) {
		return message;
	}

	if (!RocketChat.SMS.enabled) {
		return message;
	} // only send the sms by SMS if it is a livechat room with SMS set to true


	if (!(typeof room.t !== 'undefined' && room.t === 'l' && room.sms && room.v && room.v.token)) {
		return message;
	} // if the message has a token, it was sent from the visitor, so ignore it


	if (message.token) {
		return message;
	} // if the message has a type means it is a special message (like the closing comment), so skips


	if (message.t) {
		return message;
	}

	const SMSService = RocketChat.SMS.getService(RocketChat.settings.get('SMS_Service'));

	if (!SMSService) {
		return message;
	}

	const visitor = RocketChat.models.Users.getVisitorByToken(room.v.token);

	if (!visitor || !visitor.profile || !visitor.phone || visitor.phone.length === 0) {
		return message;
	}

	SMSService.send(room.sms.from, visitor.phone[0].phoneNumber, message.msg);
	return message;
}, RocketChat.callbacks.priority.LOW, 'sendMessageBySms');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"unclosedLivechats.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/unclosedLivechats.js                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals UserPresenceMonitor */let agentsHandler;
let monitorAgents = false;
let actionTimeout = 60000;
const onlineAgents = {
	users: {},
	queue: {},

	add(userId) {
		if (this.queue[userId]) {
			clearTimeout(this.queue[userId]);
			delete this.queue[userId];
		}

		this.users[userId] = 1;
	},

	remove(userId, callback) {
		if (this.queue[userId]) {
			clearTimeout(this.queue[userId]);
		}

		this.queue[userId] = setTimeout(Meteor.bindEnvironment(() => {
			callback();
			delete this.users[userId];
			delete this.queue[userId];
		}), actionTimeout);
	},

	exists(userId) {
		return !!this.users[userId];
	}

};

function runAgentLeaveAction(userId) {
	const action = RocketChat.settings.get('Livechat_agent_leave_action');

	if (action === 'close') {
		return RocketChat.Livechat.closeOpenChats(userId, RocketChat.settings.get('Livechat_agent_leave_comment'));
	} else if (action === 'forward') {
		return RocketChat.Livechat.forwardOpenChats(userId);
	}
}

RocketChat.settings.get('Livechat_agent_leave_action_timeout', function (key, value) {
	actionTimeout = value * 1000;
});
RocketChat.settings.get('Livechat_agent_leave_action', function (key, value) {
	monitorAgents = value;

	if (value !== 'none') {
		if (!agentsHandler) {
			agentsHandler = RocketChat.models.Users.findOnlineAgents().observeChanges({
				added(id) {
					onlineAgents.add(id);
				},

				changed(id, fields) {
					if (fields.statusLivechat && fields.statusLivechat === 'not-available') {
						onlineAgents.remove(id, () => {
							runAgentLeaveAction(id);
						});
					} else {
						onlineAgents.add(id);
					}
				},

				removed(id) {
					onlineAgents.remove(id, () => {
						runAgentLeaveAction(id);
					});
				}

			});
		}
	} else if (agentsHandler) {
		agentsHandler.stop();
		agentsHandler = null;
	}
});
UserPresenceMonitor.onSetUserStatus((user, status /*, statusConnection*/) => {
	if (!monitorAgents) {
		return;
	}

	if (onlineAgents.exists(user._id)) {
		if (status === 'offline' || user.statusLivechat === 'not-available') {
			onlineAgents.remove(user._id, () => {
				runAgentLeaveAction(user._id);
			});
		}
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"publications":{"customFields.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/customFields.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
Meteor.publish('livechat:customFields', function (_id) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:customFields'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:customFields'
		}));
	}

	if (s.trim(_id)) {
		return RocketChat.models.LivechatCustomField.find({
			_id
		});
	}

	return RocketChat.models.LivechatCustomField.find();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"departmentAgents.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/departmentAgents.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:departmentAgents', function (departmentId) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:departmentAgents'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-rooms')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:departmentAgents'
		}));
	}

	return RocketChat.models.LivechatDepartmentAgents.find({
		departmentId
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"externalMessages.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/externalMessages.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:externalMessages', function (roomId) {
	return RocketChat.models.LivechatExternalMessage.findByRoomId(roomId);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatAgents.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatAgents.js                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:agents', function () {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:agents'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:agents'
		}));
	}

	const self = this;
	const handle = RocketChat.authz.getUsersInRole('livechat-agent').observeChanges({
		added(id, fields) {
			self.added('agentUsers', id, fields);
		},

		changed(id, fields) {
			self.changed('agentUsers', id, fields);
		},

		removed(id) {
			self.removed('agentUsers', id);
		}

	});
	self.ready();
	self.onStop(function () {
		handle.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatAppearance.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatAppearance.js                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:appearance', function () {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:appearance'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:appearance'
		}));
	}

	const query = {
		_id: {
			$in: ['Livechat_title', 'Livechat_title_color', 'Livechat_show_agent_email', 'Livechat_display_offline_form', 'Livechat_offline_form_unavailable', 'Livechat_offline_message', 'Livechat_offline_success_message', 'Livechat_offline_title', 'Livechat_offline_title_color', 'Livechat_offline_email']
		}
	};
	const self = this;
	const handle = RocketChat.models.Settings.find(query).observeChanges({
		added(id, fields) {
			self.added('livechatAppearance', id, fields);
		},

		changed(id, fields) {
			self.changed('livechatAppearance', id, fields);
		},

		removed(id) {
			self.removed('livechatAppearance', id);
		}

	});
	this.ready();
	this.onStop(() => {
		handle.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatDepartments.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatDepartments.js                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:departments', function (_id) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:agents'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:agents'
		}));
	}

	if (_id !== undefined) {
		return RocketChat.models.LivechatDepartment.findByDepartmentId(_id);
	} else {
		return RocketChat.models.LivechatDepartment.find();
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatIntegration.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatIntegration.js                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:integration', function () {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:integration'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:integration'
		}));
	}

	const self = this;
	const handle = RocketChat.models.Settings.findByIds(['Livechat_webhookUrl', 'Livechat_secret_token', 'Livechat_webhook_on_close', 'Livechat_webhook_on_offline_msg']).observeChanges({
		added(id, fields) {
			self.added('livechatIntegration', id, fields);
		},

		changed(id, fields) {
			self.changed('livechatIntegration', id, fields);
		},

		removed(id) {
			self.removed('livechatIntegration', id);
		}

	});
	self.ready();
	self.onStop(function () {
		handle.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatManagers.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatManagers.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:managers', function () {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:managers'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-rooms')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:managers'
		}));
	}

	const self = this;
	const handle = RocketChat.authz.getUsersInRole('livechat-manager').observeChanges({
		added(id, fields) {
			self.added('managerUsers', id, fields);
		},

		changed(id, fields) {
			self.changed('managerUsers', id, fields);
		},

		removed(id) {
			self.removed('managerUsers', id);
		}

	});
	self.ready();
	self.onStop(function () {
		handle.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatRooms.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatRooms.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:rooms', function (filter = {}, offset = 0, limit = 20) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:rooms'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-rooms')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:rooms'
		}));
	}

	check(filter, {
		name: Match.Maybe(String),
		// room name to filter
		agent: Match.Maybe(String),
		// agent _id who is serving
		status: Match.Maybe(String),
		// either 'opened' or 'closed'
		from: Match.Maybe(Date),
		to: Match.Maybe(Date)
	});
	const query = {};

	if (filter.name) {
		query.label = new RegExp(filter.name, 'i');
	}

	if (filter.agent) {
		query['servedBy._id'] = filter.agent;
	}

	if (filter.status) {
		if (filter.status === 'opened') {
			query.open = true;
		} else {
			query.open = {
				$exists: false
			};
		}
	}

	if (filter.from) {
		query.ts = {
			$gte: filter.from
		};
	}

	if (filter.to) {
		filter.to.setDate(filter.to.getDate() + 1);
		filter.to.setSeconds(filter.to.getSeconds() - 1);

		if (!query.ts) {
			query.ts = {};
		}

		query.ts.$lte = filter.to;
	}

	const self = this;
	const handle = RocketChat.models.Rooms.findLivechat(query, offset, limit).observeChanges({
		added(id, fields) {
			self.added('livechatRoom', id, fields);
		},

		changed(id, fields) {
			self.changed('livechatRoom', id, fields);
		},

		removed(id) {
			self.removed('livechatRoom', id);
		}

	});
	this.ready();
	this.onStop(() => {
		handle.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatQueue.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatQueue.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:queue', function () {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:queue'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:queue'
		}));
	} // let sort = { count: 1, sort: 1, username: 1 };
	// let onlineUsers = {};
	// let handleUsers = RocketChat.models.Users.findOnlineAgents().observeChanges({
	// 	added(id, fields) {
	// 		onlineUsers[fields.username] = 1;
	// 		// this.added('livechatQueueUser', id, fields);
	// 	},
	// 	changed(id, fields) {
	// 		onlineUsers[fields.username] = 1;
	// 		// this.changed('livechatQueueUser', id, fields);
	// 	},
	// 	removed(id) {
	// 		this.removed('livechatQueueUser', id);
	// 	}
	// });


	const self = this;
	const handleDepts = RocketChat.models.LivechatDepartmentAgents.findUsersInQueue().observeChanges({
		added(id, fields) {
			self.added('livechatQueueUser', id, fields);
		},

		changed(id, fields) {
			self.changed('livechatQueueUser', id, fields);
		},

		removed(id) {
			self.removed('livechatQueueUser', id);
		}

	});
	this.ready();
	this.onStop(() => {
		// handleUsers.stop();
		handleDepts.stop();
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatTriggers.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatTriggers.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:triggers', function (_id) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:triggers'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:triggers'
		}));
	}

	if (_id !== undefined) {
		return RocketChat.models.LivechatTrigger.findById(_id);
	} else {
		return RocketChat.models.LivechatTrigger.find();
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitorHistory.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/visitorHistory.js                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:visitorHistory', function ({
	rid: roomId
}) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorHistory'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorHistory'
		}));
	}

	const room = RocketChat.models.Rooms.findOneById(roomId);
	const user = RocketChat.models.Users.findOneById(this.userId);

	if (room.usernames.indexOf(user.username) === -1) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorHistory'
		}));
	}

	if (room && room.v && room.v._id) {
		// CACHE: can we stop using publications here?
		return RocketChat.models.Rooms.findByVisitorId(room.v._id);
	} else {
		return this.ready();
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitorInfo.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/visitorInfo.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:visitorInfo', function ({
	rid: roomId
}) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorInfo'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorInfo'
		}));
	}

	const room = RocketChat.models.Rooms.findOneById(roomId);

	if (room && room.v && room.v._id) {
		return RocketChat.models.Users.findById(room.v._id);
	} else {
		return this.ready();
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitorPageVisited.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/visitorPageVisited.js                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:visitorPageVisited', function ({
	rid: roomId
}) {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorPageVisited'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:visitorPageVisited'
		}));
	}

	const room = RocketChat.models.Rooms.findOneById(roomId);

	if (room && room.v && room.v.token) {
		return RocketChat.models.LivechatPageVisited.findByToken(room.v.token);
	} else {
		return this.ready();
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatInquiries.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatInquiries.js                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:inquiry', function () {
	if (!this.userId) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:inquiry'
		}));
	}

	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:inquiry'
		}));
	}

	const query = {
		agents: this.userId,
		status: 'open'
	};
	return RocketChat.models.LivechatInquiry.find(query);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livechatOfficeHours.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/publications/livechatOfficeHours.js                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.publish('livechat:officeHour', function () {
	if (!RocketChat.authz.hasPermission(this.userId, 'view-l-room')) {
		return this.error(new Meteor.Error('error-not-authorized', 'Not authorized', {
			publish: 'livechat:agents'
		}));
	}

	return RocketChat.models.LivechatOfficeHour.find();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"api.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/server/api.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.watch(require("../imports/server/rest/departments.js"));
module.watch(require("../imports/server/rest/facebook.js"));
module.watch(require("../imports/server/rest/sms.js"));
module.watch(require("../imports/server/rest/users.js"));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"permissions.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/permissions.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.startup(() => {
	const roles = _.pluck(RocketChat.models.Roles.find().fetch(), 'name');

	if (roles.indexOf('livechat-agent') === -1) {
		RocketChat.models.Roles.createOrUpdate('livechat-agent');
	}

	if (roles.indexOf('livechat-manager') === -1) {
		RocketChat.models.Roles.createOrUpdate('livechat-manager');
	}

	if (roles.indexOf('livechat-guest') === -1) {
		RocketChat.models.Roles.createOrUpdate('livechat-guest');
	}

	if (RocketChat.models && RocketChat.models.Permissions) {
		RocketChat.models.Permissions.createOrUpdate('view-l-room', ['livechat-agent', 'livechat-manager', 'admin']);
		RocketChat.models.Permissions.createOrUpdate('view-livechat-manager', ['livechat-manager', 'admin']);
		RocketChat.models.Permissions.createOrUpdate('view-livechat-rooms', ['livechat-manager', 'admin']);
		RocketChat.models.Permissions.createOrUpdate('close-livechat-room', ['livechat-agent', 'livechat-manager', 'admin']);
		RocketChat.models.Permissions.createOrUpdate('close-others-livechat-room', ['livechat-manager', 'admin']);
		RocketChat.models.Permissions.createOrUpdate('save-others-livechat-room-info', ['livechat-manager']);
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"messageTypes.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/messageTypes.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.MessageTypes.registerType({
	id: 'livechat_video_call',
	system: true,
	message: 'New_videocall_request'
});
RocketChat.actionLinks.register('createLivechatCall', function (message, params, instance) {
	if (Meteor.isClient) {
		instance.tabBar.open('video');
	}
});
RocketChat.actionLinks.register('denyLivechatCall', function (message /*, params*/) {
	if (Meteor.isServer) {
		const user = Meteor.user();
		RocketChat.models.Messages.createWithTypeRoomIdMessageAndUser('command', message.rid, 'endCall', user);
		RocketChat.Notifications.notifyRoom(message.rid, 'deleteMessage', {
			_id: message._id
		});
		const language = user.language || RocketChat.settings.get('language') || 'en';
		RocketChat.Livechat.closeRoom({
			user,
			room: RocketChat.models.Rooms.findOneById(message.rid),
			comment: TAPi18n.__('Videocall_declined', {
				lng: language
			})
		});
		Meteor.defer(() => {
			RocketChat.models.Messages.setHiddenById(message._id);
		});
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"roomType.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/roomType.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let RoomSettingsEnum, RoomTypeConfig, RoomTypeRouteConfig, UiTextContext;
module.watch(require("meteor/rocketchat:lib"), {
	RoomSettingsEnum(v) {
		RoomSettingsEnum = v;
	},

	RoomTypeConfig(v) {
		RoomTypeConfig = v;
	},

	RoomTypeRouteConfig(v) {
		RoomTypeRouteConfig = v;
	},

	UiTextContext(v) {
		UiTextContext = v;
	}

}, 0);

class LivechatRoomRoute extends RoomTypeRouteConfig {
	constructor() {
		super({
			name: 'live',
			path: '/live/:code(\\d+)'
		});
	}

	action(params) {
		openRoom('l', params.code);
	}

	link(sub) {
		return {
			code: sub.code
		};
	}

}

class LivechatRoomType extends RoomTypeConfig {
	constructor() {
		super({
			identifier: 'l',
			order: 5,
			icon: 'livechat',
			label: 'Livechat',
			route: new LivechatRoomRoute()
		});
		this.notSubscribedTpl = {
			template: 'livechatNotSubscribed'
		};
	}

	findRoom(identifier) {
		return ChatRoom.findOne({
			code: parseInt(identifier)
		});
	}

	roomName(roomData) {
		if (!roomData.name) {
			return roomData.label;
		} else {
			return roomData.name;
		}
	}

	condition() {
		return RocketChat.settings.get('Livechat_enabled') && RocketChat.authz.hasAllPermission('view-l-room');
	}

	canSendMessage(roomId) {
		const room = ChatRoom.findOne({
			_id: roomId
		}, {
			fields: {
				open: 1
			}
		});
		return room && room.open === true;
	}

	getUserStatus(roomId) {
		let guestName;
		const room = Session.get(`roomData${roomId}`);

		if (room) {
			guestName = room.v && room.v.username;
		} else {
			const inquiry = LivechatInquiry.findOne({
				rid: roomId
			});
			guestName = inquiry && inquiry.v && inquiry.v.username;
		}

		if (guestName) {
			return Session.get(`user_${guestName}_status`);
		}
	}

	allowRoomSettingChange(room, setting) {
		switch (setting) {
			case RoomSettingsEnum.JOIN_CODE:
				return false;

			default:
				return true;
		}
	}

	getUiText(context) {
		switch (context) {
			case UiTextContext.HIDE_WARNING:
				return 'Hide_Livechat_Warning';

			case UiTextContext.LEAVE_WARNING:
				return 'Hide_Livechat_Warning';

			default:
				return '';
		}
	}

}

RocketChat.roomTypes.add(new LivechatRoomType());
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"config.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/config.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.startup(function () {
	RocketChat.settings.addGroup('Livechat');
	RocketChat.settings.add('Livechat_enabled', false, {
		type: 'boolean',
		group: 'Livechat',
		public: true
	});
	RocketChat.settings.add('Livechat_title', 'Rocket.Chat', {
		type: 'string',
		group: 'Livechat',
		public: true
	});
	RocketChat.settings.add('Livechat_title_color', '#C1272D', {
		type: 'color',
		group: 'Livechat',
		public: true
	});
	RocketChat.settings.add('Livechat_display_offline_form', true, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Display_offline_form'
	});
	RocketChat.settings.add('Livechat_validate_offline_email', true, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Validate_email_address'
	});
	RocketChat.settings.add('Livechat_offline_form_unavailable', '', {
		type: 'string',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Offline_form_unavailable_message'
	});
	RocketChat.settings.add('Livechat_offline_title', 'Leave a message', {
		type: 'string',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Title'
	});
	RocketChat.settings.add('Livechat_offline_title_color', '#666666', {
		type: 'color',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Color'
	});
	RocketChat.settings.add('Livechat_offline_message', 'We are not online right now. Please leave us a message:', {
		type: 'string',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Instructions',
		i18nDescription: 'Instructions_to_your_visitor_fill_the_form_to_send_a_message'
	});
	RocketChat.settings.add('Livechat_offline_email', '', {
		type: 'string',
		group: 'Livechat',
		i18nLabel: 'Email_address_to_send_offline_messages',
		section: 'Offline'
	});
	RocketChat.settings.add('Livechat_offline_success_message', '', {
		type: 'string',
		group: 'Livechat',
		public: true,
		section: 'Offline',
		i18nLabel: 'Offline_success_message'
	});
	RocketChat.settings.add('Livechat_registration_form', true, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Show_preregistration_form'
	});
	RocketChat.settings.add('Livechat_allow_switching_departments', true, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Allow_switching_departments'
	});
	RocketChat.settings.add('Livechat_show_agent_email', true, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Show_agent_email'
	});
	RocketChat.settings.add('Livechat_guest_count', 1, {
		type: 'int',
		group: 'Livechat'
	});
	RocketChat.settings.add('Livechat_Room_Count', 1, {
		type: 'int',
		group: 'Livechat',
		i18nLabel: 'Livechat_room_count'
	});
	RocketChat.settings.add('Livechat_agent_leave_action', 'none', {
		type: 'select',
		group: 'Livechat',
		values: [{
			key: 'none',
			i18nLabel: 'None'
		}, {
			key: 'forward',
			i18nLabel: 'Forward'
		}, {
			key: 'close',
			i18nLabel: 'Close'
		}],
		i18nLabel: 'How_to_handle_open_sessions_when_agent_goes_offline'
	});
	RocketChat.settings.add('Livechat_agent_leave_action_timeout', 60, {
		type: 'int',
		group: 'Livechat',
		enableQuery: {
			_id: 'Livechat_agent_leave_action',
			value: {
				$ne: 'none'
			}
		},
		i18nLabel: 'How_long_to_wait_after_agent_goes_offline',
		i18nDescription: 'Time_in_seconds'
	});
	RocketChat.settings.add('Livechat_agent_leave_comment', '', {
		type: 'string',
		group: 'Livechat',
		enableQuery: {
			_id: 'Livechat_agent_leave_action',
			value: 'close'
		},
		i18nLabel: 'Comment_to_leave_on_closing_session'
	});
	RocketChat.settings.add('Livechat_webhookUrl', false, {
		type: 'string',
		group: 'Livechat',
		section: 'CRM_Integration',
		i18nLabel: 'Webhook_URL'
	});
	RocketChat.settings.add('Livechat_secret_token', false, {
		type: 'string',
		group: 'Livechat',
		section: 'CRM_Integration',
		i18nLabel: 'Secret_token'
	});
	RocketChat.settings.add('Livechat_webhook_on_close', false, {
		type: 'boolean',
		group: 'Livechat',
		section: 'CRM_Integration',
		i18nLabel: 'Send_request_on_chat_close'
	});
	RocketChat.settings.add('Livechat_webhook_on_offline_msg', false, {
		type: 'boolean',
		group: 'Livechat',
		section: 'CRM_Integration',
		i18nLabel: 'Send_request_on_offline_messages'
	});
	RocketChat.settings.add('Livechat_Knowledge_Enabled', false, {
		type: 'boolean',
		group: 'Livechat',
		section: 'Knowledge_Base',
		public: true,
		i18nLabel: 'Enabled'
	});
	RocketChat.settings.add('Livechat_Knowledge_Apiai_Key', '', {
		type: 'string',
		group: 'Livechat',
		section: 'Knowledge_Base',
		public: true,
		i18nLabel: 'Apiai_Key'
	});
	RocketChat.settings.add('Livechat_Knowledge_Apiai_Language', 'en', {
		type: 'string',
		group: 'Livechat',
		section: 'Knowledge_Base',
		public: true,
		i18nLabel: 'Apiai_Language'
	});
	RocketChat.settings.add('Livechat_history_monitor_type', 'url', {
		type: 'select',
		group: 'Livechat',
		i18nLabel: 'Monitor_history_for_changes_on',
		values: [{
			key: 'url',
			i18nLabel: 'Page_URL'
		}, {
			key: 'title',
			i18nLabel: 'Page_title'
		}]
	});
	RocketChat.settings.add('Livechat_Routing_Method', 'Least_Amount', {
		type: 'select',
		group: 'Livechat',
		public: true,
		values: [{
			key: 'Least_Amount',
			i18nLabel: 'Least_Amount'
		}, {
			key: 'Guest_Pool',
			i18nLabel: 'Guest_Pool'
		}]
	});
	RocketChat.settings.add('Livechat_guest_pool_with_no_agents', false, {
		type: 'boolean',
		group: 'Livechat',
		i18nLabel: 'Accept_with_no_online_agents',
		i18nDescription: 'Accept_incoming_livechat_requests_even_if_there_are_no_online_agents',
		enableQuery: {
			_id: 'Livechat_Routing_Method',
			value: 'Guest_Pool'
		}
	});
	RocketChat.settings.add('Livechat_show_queue_list_link', false, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Show_queue_list_to_all_agents'
	});
	RocketChat.settings.add('Livechat_enable_office_hours', false, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Office_hours_enabled'
	});
	RocketChat.settings.add('Livechat_videocall_enabled', false, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Videocall_enabled',
		i18nDescription: 'Beta_feature_Depends_on_Video_Conference_to_be_enabled',
		enableQuery: {
			_id: 'Jitsi_Enabled',
			value: true
		}
	});
	RocketChat.settings.add('Livechat_enable_transcript', false, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Transcript_Enabled'
	});
	RocketChat.settings.add('Livechat_transcript_message', 'Would you like a copy of this chat emailed?', {
		type: 'string',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Transcript_message',
		enableQuery: {
			_id: 'Livechat_enable_transcript',
			value: true
		}
	});
	RocketChat.settings.add('Livechat_open_inquiery_show_connecting', false, {
		type: 'boolean',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Livechat_open_inquiery_show_connecting',
		enableQuery: {
			_id: 'Livechat_Routing_Method',
			value: 'Guest_Pool'
		}
	});
	RocketChat.settings.add('Livechat_AllowedDomainsList', '', {
		type: 'string',
		group: 'Livechat',
		public: true,
		i18nLabel: 'Livechat_AllowedDomainsList',
		i18nDescription: 'Domains_allowed_to_embed_the_livechat_widget'
	});
	RocketChat.settings.add('Livechat_Facebook_Enabled', false, {
		type: 'boolean',
		group: 'Livechat',
		section: 'Facebook'
	});
	RocketChat.settings.add('Livechat_Facebook_API_Key', '', {
		type: 'string',
		group: 'Livechat',
		section: 'Facebook',
		i18nDescription: 'If_you_dont_have_one_send_an_email_to_omni_rocketchat_to_get_yours'
	});
	RocketChat.settings.add('Livechat_Facebook_API_Secret', '', {
		type: 'string',
		group: 'Livechat',
		section: 'Facebook',
		i18nDescription: 'If_you_dont_have_one_send_an_email_to_omni_rocketchat_to_get_yours'
	});
	RocketChat.settings.add('Livechat_RDStation_Token', '', {
		type: 'string',
		group: 'Livechat',
		public: false,
		section: 'RD Station',
		i18nLabel: 'RDStation_Token'
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"imports":{"server":{"rest":{"departments.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/imports/server/rest/departments.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('livechat/department', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		return RocketChat.API.v1.success({
			departments: RocketChat.models.LivechatDepartment.find().fetch()
		});
	},

	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.bodyParams, {
				department: Object,
				agents: Array
			});
			const department = RocketChat.Livechat.saveDepartment(null, this.bodyParams.department, this.bodyParams.agents);

			if (department) {
				return RocketChat.API.v1.success({
					department,
					agents: RocketChat.models.LivechatDepartmentAgents.find({
						departmentId: department._id
					}).fetch()
				});
			}

			RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e);
		}
	}

});
RocketChat.API.v1.addRoute('livechat/department/:_id', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				_id: String
			});
			return RocketChat.API.v1.success({
				department: RocketChat.models.LivechatDepartment.findOneById(this.urlParams._id),
				agents: RocketChat.models.LivechatDepartmentAgents.find({
					departmentId: this.urlParams._id
				}).fetch()
			});
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},

	put() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				_id: String
			});
			check(this.bodyParams, {
				department: Object,
				agents: Array
			});

			if (RocketChat.Livechat.saveDepartment(this.urlParams._id, this.bodyParams.department, this.bodyParams.agents)) {
				return RocketChat.API.v1.success({
					department: RocketChat.models.LivechatDepartment.findOneById(this.urlParams._id),
					agents: RocketChat.models.LivechatDepartmentAgents.find({
						departmentId: this.urlParams._id
					}).fetch()
				});
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},

	delete() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				_id: String
			});

			if (RocketChat.Livechat.removeDepartment(this.urlParams._id)) {
				return RocketChat.API.v1.success();
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"facebook.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/imports/server/rest/facebook.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let crypto;
module.watch(require("crypto"), {
	default(v) {
		crypto = v;
	}

}, 0);
/**
 * @api {post} /livechat/facebook Send Facebook message
 * @apiName Facebook
 * @apiGroup Livechat
 *
 * @apiParam {String} mid Facebook message id
 * @apiParam {String} page Facebook pages id
 * @apiParam {String} token Facebook user's token
 * @apiParam {String} first_name Facebook user's first name
 * @apiParam {String} last_name Facebook user's last name
 * @apiParam {String} [text] Facebook message text
 * @apiParam {String} [attachments] Facebook message attachments
 */RocketChat.API.v1.addRoute('livechat/facebook', {
	post() {
		if (!this.bodyParams.text && !this.bodyParams.attachments) {
			return {
				success: false
			};
		}

		if (!this.request.headers['x-hub-signature']) {
			return {
				success: false
			};
		}

		if (!RocketChat.settings.get('Livechat_Facebook_Enabled')) {
			return {
				success: false,
				error: 'Integration disabled'
			};
		} // validate if request come from omni


		const signature = crypto.createHmac('sha1', RocketChat.settings.get('Livechat_Facebook_API_Secret')).update(JSON.stringify(this.request.body)).digest('hex');

		if (this.request.headers['x-hub-signature'] !== `sha1=${signature}`) {
			return {
				success: false,
				error: 'Invalid signature'
			};
		}

		const sendMessage = {
			message: {
				_id: this.bodyParams.mid
			},
			roomInfo: {
				facebook: {
					page: this.bodyParams.page
				}
			}
		};
		let visitor = RocketChat.models.Users.getVisitorByToken(this.bodyParams.token);

		if (visitor) {
			const rooms = RocketChat.models.Rooms.findOpenByVisitorToken(visitor.profile.token).fetch();

			if (rooms && rooms.length > 0) {
				sendMessage.message.rid = rooms[0]._id;
			} else {
				sendMessage.message.rid = Random.id();
			}

			sendMessage.message.token = visitor.profile.token;
		} else {
			sendMessage.message.rid = Random.id();
			sendMessage.message.token = this.bodyParams.token;
			const userId = RocketChat.Livechat.registerGuest({
				token: sendMessage.message.token,
				name: `${this.bodyParams.first_name} ${this.bodyParams.last_name}`
			});
			visitor = RocketChat.models.Users.findOneById(userId);
		}

		sendMessage.message.msg = this.bodyParams.text;
		sendMessage.guest = visitor;

		try {
			return {
				sucess: true,
				message: RocketChat.Livechat.sendMessage(sendMessage)
			};
		} catch (e) {
			console.error('Error using Facebook ->', e);
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sms.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/imports/server/rest/sms.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.API.v1.addRoute('livechat/sms-incoming/:service', {
	post() {
		const SMSService = RocketChat.SMS.getService(this.urlParams.service);
		const sms = SMSService.parse(this.bodyParams);
		let visitor = RocketChat.models.Users.findOneVisitorByPhone(sms.from);
		const sendMessage = {
			message: {
				_id: Random.id()
			},
			roomInfo: {
				sms: {
					from: sms.to
				}
			}
		};

		if (visitor) {
			const rooms = RocketChat.models.Rooms.findOpenByVisitorToken(visitor.profile.token).fetch();

			if (rooms && rooms.length > 0) {
				sendMessage.message.rid = rooms[0]._id;
			} else {
				sendMessage.message.rid = Random.id();
			}

			sendMessage.message.token = visitor.profile.token;
		} else {
			sendMessage.message.rid = Random.id();
			sendMessage.message.token = Random.id();
			const userId = RocketChat.Livechat.registerGuest({
				username: sms.from.replace(/[^0-9]/g, ''),
				token: sendMessage.message.token,
				phone: {
					number: sms.from
				}
			});
			visitor = RocketChat.models.Users.findOneById(userId);
		}

		sendMessage.message.msg = sms.body;
		sendMessage.guest = visitor;

		try {
			const message = SMSService.response.call(this, RocketChat.Livechat.sendMessage(sendMessage));
			Meteor.defer(() => {
				if (sms.extra) {
					if (sms.extra.fromCountry) {
						Meteor.call('livechat:setCustomField', sendMessage.message.token, 'country', sms.extra.fromCountry);
					}

					if (sms.extra.fromState) {
						Meteor.call('livechat:setCustomField', sendMessage.message.token, 'state', sms.extra.fromState);
					}

					if (sms.extra.fromCity) {
						Meteor.call('livechat:setCustomField', sendMessage.message.token, 'city', sms.extra.fromCity);
					}
				}
			});
			return message;
		} catch (e) {
			return SMSService.error.call(this, e);
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"users.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_livechat/imports/server/rest/users.js                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
RocketChat.API.v1.addRoute('livechat/users/:type', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				type: String
			});
			let role;

			if (this.urlParams.type === 'agent') {
				role = 'livechat-agent';
			} else if (this.urlParams.type === 'manager') {
				role = 'livechat-manager';
			} else {
				throw 'Invalid type';
			}

			const users = RocketChat.authz.getUsersInRole(role);
			return RocketChat.API.v1.success({
				users: users.fetch().map(user => ({
					_id: user._id,
					username: user.username
				}))
			});
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},

	post() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				type: String
			});
			check(this.bodyParams, {
				username: String
			});

			if (this.urlParams.type === 'agent') {
				const user = RocketChat.Livechat.addAgent(this.bodyParams.username);

				if (user) {
					return RocketChat.API.v1.success({
						user
					});
				}
			} else if (this.urlParams.type === 'manager') {
				const user = RocketChat.Livechat.addManager(this.bodyParams.username);

				if (user) {
					return RocketChat.API.v1.success({
						user
					});
				}
			} else {
				throw 'Invalid type';
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	}

});
RocketChat.API.v1.addRoute('livechat/users/:type/:_id', {
	authRequired: true
}, {
	get() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				type: String,
				_id: String
			});
			const user = RocketChat.models.Users.findOneById(this.urlParams._id);

			if (!user) {
				return RocketChat.API.v1.failure('User not found');
			}

			let role;

			if (this.urlParams.type === 'agent') {
				role = 'livechat-agent';
			} else if (this.urlParams.type === 'manager') {
				role = 'livechat-manager';
			} else {
				throw 'Invalid type';
			}

			if (user.roles.indexOf(role) !== -1) {
				return RocketChat.API.v1.success({
					user: _.pick(user, '_id', 'username')
				});
			}

			return RocketChat.API.v1.success({
				user: null
			});
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	},

	delete() {
		if (!RocketChat.authz.hasPermission(this.userId, 'view-livechat-manager')) {
			return RocketChat.API.v1.unauthorized();
		}

		try {
			check(this.urlParams, {
				type: String,
				_id: String
			});
			const user = RocketChat.models.Users.findOneById(this.urlParams._id);

			if (!user) {
				return RocketChat.API.v1.failure();
			}

			if (this.urlParams.type === 'agent') {
				if (RocketChat.Livechat.removeAgent(user.username)) {
					return RocketChat.API.v1.success();
				}
			} else if (this.urlParams.type === 'manager') {
				if (RocketChat.Livechat.removeManager(user.username)) {
					return RocketChat.API.v1.success();
				}
			} else {
				throw 'Invalid type';
			}

			return RocketChat.API.v1.failure();
		} catch (e) {
			return RocketChat.API.v1.failure(e.error);
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}},"node_modules":{"ua-parser-js":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// ../../.meteor/local/isopacks/rocketchat_livechat/npm/node_modules/ua-parser-js/package.json                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
exports.name = "ua-parser-js";
exports.version = "0.7.10";
exports.main = "src/ua-parser.js";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"src":{"ua-parser.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/rocketchat_livechat/node_modules/ua-parser-js/src/ua-parser.js                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * UAParser.js v0.7.10
 * Lightweight JavaScript-based User-Agent string parser
 * https://github.com/faisalman/ua-parser-js
 *
 * Copyright © 2012-2015 Faisal Salman <fyzlman@gmail.com>
 * Dual licensed under GPLv2 & MIT
 */

(function (window, undefined) {

    'use strict';

    //////////////
    // Constants
    /////////////


    var LIBVERSION  = '0.7.10',
        EMPTY       = '',
        UNKNOWN     = '?',
        FUNC_TYPE   = 'function',
        UNDEF_TYPE  = 'undefined',
        OBJ_TYPE    = 'object',
        STR_TYPE    = 'string',
        MAJOR       = 'major', // deprecated
        MODEL       = 'model',
        NAME        = 'name',
        TYPE        = 'type',
        VENDOR      = 'vendor',
        VERSION     = 'version',
        ARCHITECTURE= 'architecture',
        CONSOLE     = 'console',
        MOBILE      = 'mobile',
        TABLET      = 'tablet',
        SMARTTV     = 'smarttv',
        WEARABLE    = 'wearable',
        EMBEDDED    = 'embedded';


    ///////////
    // Helper
    //////////


    var util = {
        extend : function (regexes, extensions) {
            for (var i in extensions) {
                if ("browser cpu device engine os".indexOf(i) !== -1 && extensions[i].length % 2 === 0) {
                    regexes[i] = extensions[i].concat(regexes[i]);
                }
            }
            return regexes;
        },
        has : function (str1, str2) {
          if (typeof str1 === "string") {
            return str2.toLowerCase().indexOf(str1.toLowerCase()) !== -1;
          } else {
            return false;
          }
        },
        lowerize : function (str) {
            return str.toLowerCase();
        },
        major : function (version) {
            return typeof(version) === STR_TYPE ? version.split(".")[0] : undefined;
        }
    };


    ///////////////
    // Map helper
    //////////////


    var mapper = {

        rgx : function () {

            var result, i = 0, j, k, p, q, matches, match, args = arguments;

            // loop through all regexes maps
            while (i < args.length && !matches) {

                var regex = args[i],       // even sequence (0,2,4,..)
                    props = args[i + 1];   // odd sequence (1,3,5,..)

                // construct object barebones
                if (typeof result === UNDEF_TYPE) {
                    result = {};
                    for (p in props) {
                        if (props.hasOwnProperty(p)){
                            q = props[p];
                            if (typeof q === OBJ_TYPE) {
                                result[q[0]] = undefined;
                            } else {
                                result[q] = undefined;
                            }
                        }
                    }
                }

                // try matching uastring with regexes
                j = k = 0;
                while (j < regex.length && !matches) {
                    matches = regex[j++].exec(this.getUA());
                    if (!!matches) {
                        for (p = 0; p < props.length; p++) {
                            match = matches[++k];
                            q = props[p];
                            // check if given property is actually array
                            if (typeof q === OBJ_TYPE && q.length > 0) {
                                if (q.length == 2) {
                                    if (typeof q[1] == FUNC_TYPE) {
                                        // assign modified match
                                        result[q[0]] = q[1].call(this, match);
                                    } else {
                                        // assign given value, ignore regex match
                                        result[q[0]] = q[1];
                                    }
                                } else if (q.length == 3) {
                                    // check whether function or regex
                                    if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
                                        // call function (usually string mapper)
                                        result[q[0]] = match ? q[1].call(this, match, q[2]) : undefined;
                                    } else {
                                        // sanitize match using given regex
                                        result[q[0]] = match ? match.replace(q[1], q[2]) : undefined;
                                    }
                                } else if (q.length == 4) {
                                        result[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined;
                                }
                            } else {
                                result[q] = match ? match : undefined;
                            }
                        }
                    }
                }
                i += 2;
            }
            return result;
        },

        str : function (str, map) {

            for (var i in map) {
                // check if array
                if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
                    for (var j = 0; j < map[i].length; j++) {
                        if (util.has(map[i][j], str)) {
                            return (i === UNKNOWN) ? undefined : i;
                        }
                    }
                } else if (util.has(map[i], str)) {
                    return (i === UNKNOWN) ? undefined : i;
                }
            }
            return str;
        }
    };


    ///////////////
    // String map
    //////////////


    var maps = {

        browser : {
            oldsafari : {
                version : {
                    '1.0'   : '/8',
                    '1.2'   : '/1',
                    '1.3'   : '/3',
                    '2.0'   : '/412',
                    '2.0.2' : '/416',
                    '2.0.3' : '/417',
                    '2.0.4' : '/419',
                    '?'     : '/'
                }
            }
        },

        device : {
            amazon : {
                model : {
                    'Fire Phone' : ['SD', 'KF']
                }
            },
            sprint : {
                model : {
                    'Evo Shift 4G' : '7373KT'
                },
                vendor : {
                    'HTC'       : 'APA',
                    'Sprint'    : 'Sprint'
                }
            }
        },

        os : {
            windows : {
                version : {
                    'ME'        : '4.90',
                    'NT 3.11'   : 'NT3.51',
                    'NT 4.0'    : 'NT4.0',
                    '2000'      : 'NT 5.0',
                    'XP'        : ['NT 5.1', 'NT 5.2'],
                    'Vista'     : 'NT 6.0',
                    '7'         : 'NT 6.1',
                    '8'         : 'NT 6.2',
                    '8.1'       : 'NT 6.3',
                    '10'        : ['NT 6.4', 'NT 10.0'],
                    'RT'        : 'ARM'
                }
            }
        }
    };


    //////////////
    // Regex map
    /////////////


    var regexes = {

        browser : [[

            // Presto based
            /(opera\smini)\/([\w\.-]+)/i,                                       // Opera Mini
            /(opera\s[mobiletab]+).+version\/([\w\.-]+)/i,                      // Opera Mobi/Tablet
            /(opera).+version\/([\w\.]+)/i,                                     // Opera > 9.80
            /(opera)[\/\s]+([\w\.]+)/i                                          // Opera < 9.80

            ], [NAME, VERSION], [

            /\s(opr)\/([\w\.]+)/i                                               // Opera Webkit
            ], [[NAME, 'Opera'], VERSION], [

            // Mixed
            /(kindle)\/([\w\.]+)/i,                                             // Kindle
            /(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]+)*/i,
                                                                                // Lunascape/Maxthon/Netfront/Jasmine/Blazer

            // Trident based
            /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i,
                                                                                // Avant/IEMobile/SlimBrowser/Baidu
            /(?:ms|\()(ie)\s([\w\.]+)/i,                                        // Internet Explorer

            // Webkit/KHTML based
            /(rekonq)\/([\w\.]+)*/i,                                            // Rekonq
            /(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs)\/([\w\.-]+)/i
                                                                                // Chromium/Flock/RockMelt/Midori/Epiphany/Silk/Skyfire/Bolt/Iron/Iridium/PhantomJS
            ], [NAME, VERSION], [

            /(trident).+rv[:\s]([\w\.]+).+like\sgecko/i                         // IE11
            ], [[NAME, 'IE'], VERSION], [

            /(edge)\/((\d+)?[\w\.]+)/i                                          // Microsoft Edge
            ], [NAME, VERSION], [

            /(yabrowser)\/([\w\.]+)/i                                           // Yandex
            ], [[NAME, 'Yandex'], VERSION], [

            /(comodo_dragon)\/([\w\.]+)/i                                       // Comodo Dragon
            ], [[NAME, /_/g, ' '], VERSION], [

            /(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i,
                                                                                // Chrome/OmniWeb/Arora/Tizen/Nokia
            /(qqbrowser)[\/\s]?([\w\.]+)/i
                                                                                // QQBrowser
            ], [NAME, VERSION], [

            /(uc\s?browser)[\/\s]?([\w\.]+)/i,
            /ucweb.+(ucbrowser)[\/\s]?([\w\.]+)/i,
            /JUC.+(ucweb)[\/\s]?([\w\.]+)/i
                                                                                // UCBrowser
            ], [[NAME, 'UCBrowser'], VERSION], [

            /(dolfin)\/([\w\.]+)/i                                              // Dolphin
            ], [[NAME, 'Dolphin'], VERSION], [

            /((?:android.+)crmo|crios)\/([\w\.]+)/i                             // Chrome for Android/iOS
            ], [[NAME, 'Chrome'], VERSION], [

            /XiaoMi\/MiuiBrowser\/([\w\.]+)/i                                   // MIUI Browser
            ], [VERSION, [NAME, 'MIUI Browser']], [

            /android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)/i         // Android Browser
            ], [VERSION, [NAME, 'Android Browser']], [

            /FBAV\/([\w\.]+);/i                                                 // Facebook App for iOS
            ], [VERSION, [NAME, 'Facebook']], [

            /fxios\/([\w\.-]+)/i                                                // Firefox for iOS
            ], [VERSION, [NAME, 'Firefox']], [

            /version\/([\w\.]+).+?mobile\/\w+\s(safari)/i                       // Mobile Safari
            ], [VERSION, [NAME, 'Mobile Safari']], [

            /version\/([\w\.]+).+?(mobile\s?safari|safari)/i                    // Safari & Safari Mobile
            ], [VERSION, NAME], [

            /webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i                     // Safari < 3.0
            ], [NAME, [VERSION, mapper.str, maps.browser.oldsafari.version]], [

            /(konqueror)\/([\w\.]+)/i,                                          // Konqueror
            /(webkit|khtml)\/([\w\.]+)/i
            ], [NAME, VERSION], [

            // Gecko based
            /(navigator|netscape)\/([\w\.-]+)/i                                 // Netscape
            ], [[NAME, 'Netscape'], VERSION], [
            /(swiftfox)/i,                                                      // Swiftfox
            /(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i,
                                                                                // IceDragon/Iceweasel/Camino/Chimera/Fennec/Maemo/Minimo/Conkeror
            /(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix)\/([\w\.-]+)/i,
                                                                                // Firefox/SeaMonkey/K-Meleon/IceCat/IceApe/Firebird/Phoenix
            /(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i,                          // Mozilla

            // Other
            /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir)[\/\s]?([\w\.]+)/i,
                                                                                // Polaris/Lynx/Dillo/iCab/Doris/Amaya/w3m/NetSurf/Sleipnir
            /(links)\s\(([\w\.]+)/i,                                            // Links
            /(gobrowser)\/?([\w\.]+)*/i,                                        // GoBrowser
            /(ice\s?browser)\/v?([\w\._]+)/i,                                   // ICE Browser
            /(mosaic)[\/\s]([\w\.]+)/i                                          // Mosaic
            ], [NAME, VERSION]

            /* /////////////////////
            // Media players BEGIN
            ////////////////////////

            , [

            /(apple(?:coremedia|))\/((\d+)[\w\._]+)/i,                          // Generic Apple CoreMedia
            /(coremedia) v((\d+)[\w\._]+)/i
            ], [NAME, VERSION], [

            /(aqualung|lyssna|bsplayer)\/((\d+)?[\w\.-]+)/i                     // Aqualung/Lyssna/BSPlayer
            ], [NAME, VERSION], [

            /(ares|ossproxy)\s((\d+)[\w\.-]+)/i                                 // Ares/OSSProxy
            ], [NAME, VERSION], [

            /(audacious|audimusicstream|amarok|bass|core|dalvik|gnomemplayer|music on console|nsplayer|psp-internetradioplayer|videos)\/((\d+)[\w\.-]+)/i,
                                                                                // Audacious/AudiMusicStream/Amarok/BASS/OpenCORE/Dalvik/GnomeMplayer/MoC
                                                                                // NSPlayer/PSP-InternetRadioPlayer/Videos
            /(clementine|music player daemon)\s((\d+)[\w\.-]+)/i,               // Clementine/MPD
            /(lg player|nexplayer)\s((\d+)[\d\.]+)/i,
            /player\/(nexplayer|lg player)\s((\d+)[\w\.-]+)/i                   // NexPlayer/LG Player
            ], [NAME, VERSION], [
            /(nexplayer)\s((\d+)[\w\.-]+)/i                                     // Nexplayer
            ], [NAME, VERSION], [

            /(flrp)\/((\d+)[\w\.-]+)/i                                          // Flip Player
            ], [[NAME, 'Flip Player'], VERSION], [

            /(fstream|nativehost|queryseekspider|ia-archiver|facebookexternalhit)/i
                                                                                // FStream/NativeHost/QuerySeekSpider/IA Archiver/facebookexternalhit
            ], [NAME], [

            /(gstreamer) souphttpsrc (?:\([^\)]+\)){0,1} libsoup\/((\d+)[\w\.-]+)/i
                                                                                // Gstreamer
            ], [NAME, VERSION], [

            /(htc streaming player)\s[\w_]+\s\/\s((\d+)[\d\.]+)/i,              // HTC Streaming Player
            /(java|python-urllib|python-requests|wget|libcurl)\/((\d+)[\w\.-_]+)/i,
                                                                                // Java/urllib/requests/wget/cURL
            /(lavf)((\d+)[\d\.]+)/i                                             // Lavf (FFMPEG)
            ], [NAME, VERSION], [

            /(htc_one_s)\/((\d+)[\d\.]+)/i                                      // HTC One S
            ], [[NAME, /_/g, ' '], VERSION], [

            /(mplayer)(?:\s|\/)(?:(?:sherpya-){0,1}svn)(?:-|\s)(r\d+(?:-\d+[\w\.-]+){0,1})/i
                                                                                // MPlayer SVN
            ], [NAME, VERSION], [

            /(mplayer)(?:\s|\/|[unkow-]+)((\d+)[\w\.-]+)/i                      // MPlayer
            ], [NAME, VERSION], [

            /(mplayer)/i,                                                       // MPlayer (no other info)
            /(yourmuze)/i,                                                      // YourMuze
            /(media player classic|nero showtime)/i                             // Media Player Classic/Nero ShowTime
            ], [NAME], [

            /(nero (?:home|scout))\/((\d+)[\w\.-]+)/i                           // Nero Home/Nero Scout
            ], [NAME, VERSION], [

            /(nokia\d+)\/((\d+)[\w\.-]+)/i                                      // Nokia
            ], [NAME, VERSION], [

            /\s(songbird)\/((\d+)[\w\.-]+)/i                                    // Songbird/Philips-Songbird
            ], [NAME, VERSION], [

            /(winamp)3 version ((\d+)[\w\.-]+)/i,                               // Winamp
            /(winamp)\s((\d+)[\w\.-]+)/i,
            /(winamp)mpeg\/((\d+)[\w\.-]+)/i
            ], [NAME, VERSION], [

            /(ocms-bot|tapinradio|tunein radio|unknown|winamp|inlight radio)/i  // OCMS-bot/tap in radio/tunein/unknown/winamp (no other info)
                                                                                // inlight radio
            ], [NAME], [

            /(quicktime|rma|radioapp|radioclientapplication|soundtap|totem|stagefright|streamium)\/((\d+)[\w\.-]+)/i
                                                                                // QuickTime/RealMedia/RadioApp/RadioClientApplication/
                                                                                // SoundTap/Totem/Stagefright/Streamium
            ], [NAME, VERSION], [

            /(smp)((\d+)[\d\.]+)/i                                              // SMP
            ], [NAME, VERSION], [

            /(vlc) media player - version ((\d+)[\w\.]+)/i,                     // VLC Videolan
            /(vlc)\/((\d+)[\w\.-]+)/i,
            /(xbmc|gvfs|xine|xmms|irapp)\/((\d+)[\w\.-]+)/i,                    // XBMC/gvfs/Xine/XMMS/irapp
            /(foobar2000)\/((\d+)[\d\.]+)/i,                                    // Foobar2000
            /(itunes)\/((\d+)[\d\.]+)/i                                         // iTunes
            ], [NAME, VERSION], [

            /(wmplayer)\/((\d+)[\w\.-]+)/i,                                     // Windows Media Player
            /(windows-media-player)\/((\d+)[\w\.-]+)/i
            ], [[NAME, /-/g, ' '], VERSION], [

            /windows\/((\d+)[\w\.-]+) upnp\/[\d\.]+ dlnadoc\/[\d\.]+ (home media server)/i
                                                                                // Windows Media Server
            ], [VERSION, [NAME, 'Windows']], [

            /(com\.riseupradioalarm)\/((\d+)[\d\.]*)/i                          // RiseUP Radio Alarm
            ], [NAME, VERSION], [

            /(rad.io)\s((\d+)[\d\.]+)/i,                                        // Rad.io
            /(radio.(?:de|at|fr))\s((\d+)[\d\.]+)/i
            ], [[NAME, 'rad.io'], VERSION]

            //////////////////////
            // Media players END
            ////////////////////*/

        ],

        cpu : [[

            /(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i                     // AMD64
            ], [[ARCHITECTURE, 'amd64']], [

            /(ia32(?=;))/i                                                      // IA32 (quicktime)
            ], [[ARCHITECTURE, util.lowerize]], [

            /((?:i[346]|x)86)[;\)]/i                                            // IA32
            ], [[ARCHITECTURE, 'ia32']], [

            // PocketPC mistakenly identified as PowerPC
            /windows\s(ce|mobile);\sppc;/i
            ], [[ARCHITECTURE, 'arm']], [

            /((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i                           // PowerPC
            ], [[ARCHITECTURE, /ower/, '', util.lowerize]], [

            /(sun4\w)[;\)]/i                                                    // SPARC
            ], [[ARCHITECTURE, 'sparc']], [

            /((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+;))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i
                                                                                // IA64, 68K, ARM/64, AVR/32, IRIX/64, MIPS/64, SPARC/64, PA-RISC
            ], [[ARCHITECTURE, util.lowerize]]
        ],

        device : [[

            /\((ipad|playbook);[\w\s\);-]+(rim|apple)/i                         // iPad/PlayBook
            ], [MODEL, VENDOR, [TYPE, TABLET]], [

            /applecoremedia\/[\w\.]+ \((ipad)/                                  // iPad
            ], [MODEL, [VENDOR, 'Apple'], [TYPE, TABLET]], [

            /(apple\s{0,1}tv)/i                                                 // Apple TV
            ], [[MODEL, 'Apple TV'], [VENDOR, 'Apple']], [

            /(archos)\s(gamepad2?)/i,                                           // Archos
            /(hp).+(touchpad)/i,                                                // HP TouchPad
            /(kindle)\/([\w\.]+)/i,                                             // Kindle
            /\s(nook)[\w\s]+build\/(\w+)/i,                                     // Nook
            /(dell)\s(strea[kpr\s\d]*[\dko])/i                                  // Dell Streak
            ], [VENDOR, MODEL, [TYPE, TABLET]], [

            /(kf[A-z]+)\sbuild\/[\w\.]+.*silk\//i                               // Kindle Fire HD
            ], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [
            /(sd|kf)[0349hijorstuw]+\sbuild\/[\w\.]+.*silk\//i                  // Fire Phone
            ], [[MODEL, mapper.str, maps.device.amazon.model], [VENDOR, 'Amazon'], [TYPE, MOBILE]], [

            /\((ip[honed|\s\w*]+);.+(apple)/i                                   // iPod/iPhone
            ], [MODEL, VENDOR, [TYPE, MOBILE]], [
            /\((ip[honed|\s\w*]+);/i                                            // iPod/iPhone
            ], [MODEL, [VENDOR, 'Apple'], [TYPE, MOBILE]], [

            /(blackberry)[\s-]?(\w+)/i,                                         // BlackBerry
            /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|huawei|meizu|motorola|polytron)[\s_-]?([\w-]+)*/i,
                                                                                // BenQ/Palm/Sony-Ericsson/Acer/Asus/Dell/Huawei/Meizu/Motorola/Polytron
            /(hp)\s([\w\s]+\w)/i,                                               // HP iPAQ
            /(asus)-?(\w+)/i                                                    // Asus
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [
            /\(bb10;\s(\w+)/i                                                   // BlackBerry 10
            ], [MODEL, [VENDOR, 'BlackBerry'], [TYPE, MOBILE]], [
                                                                                // Asus Tablets
            /android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7)/i
            ], [MODEL, [VENDOR, 'Asus'], [TYPE, TABLET]], [

            /(sony)\s(tablet\s[ps])\sbuild\//i,                                  // Sony
            /(sony)?(?:sgp.+)\sbuild\//i
            ], [[VENDOR, 'Sony'], [MODEL, 'Xperia Tablet'], [TYPE, TABLET]], [
            /(?:sony)?(?:(?:(?:c|d)\d{4})|(?:so[-l].+))\sbuild\//i
            ], [[VENDOR, 'Sony'], [MODEL, 'Xperia Phone'], [TYPE, MOBILE]], [

            /\s(ouya)\s/i,                                                      // Ouya
            /(nintendo)\s([wids3u]+)/i                                          // Nintendo
            ], [VENDOR, MODEL, [TYPE, CONSOLE]], [

            /android.+;\s(shield)\sbuild/i                                      // Nvidia
            ], [MODEL, [VENDOR, 'Nvidia'], [TYPE, CONSOLE]], [

            /(playstation\s[34portablevi]+)/i                                   // Playstation
            ], [MODEL, [VENDOR, 'Sony'], [TYPE, CONSOLE]], [

            /(sprint\s(\w+))/i                                                  // Sprint Phones
            ], [[VENDOR, mapper.str, maps.device.sprint.vendor], [MODEL, mapper.str, maps.device.sprint.model], [TYPE, MOBILE]], [

            /(lenovo)\s?(S(?:5000|6000)+(?:[-][\w+]))/i                         // Lenovo tablets
            ], [VENDOR, MODEL, [TYPE, TABLET]], [

            /(htc)[;_\s-]+([\w\s]+(?=\))|\w+)*/i,                               // HTC
            /(zte)-(\w+)*/i,                                                    // ZTE
            /(alcatel|geeksphone|huawei|lenovo|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]+)*/i
                                                                                // Alcatel/GeeksPhone/Huawei/Lenovo/Nexian/Panasonic/Sony
            ], [VENDOR, [MODEL, /_/g, ' '], [TYPE, MOBILE]], [
                
            /(nexus\s9)/i                                                       // HTC Nexus 9
            ], [MODEL, [VENDOR, 'HTC'], [TYPE, TABLET]], [

            /[\s\(;](xbox(?:\sone)?)[\s\);]/i                                   // Microsoft Xbox
            ], [MODEL, [VENDOR, 'Microsoft'], [TYPE, CONSOLE]], [
            /(kin\.[onetw]{3})/i                                                // Microsoft Kin
            ], [[MODEL, /\./g, ' '], [VENDOR, 'Microsoft'], [TYPE, MOBILE]], [

                                                                                // Motorola
            /\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?(:?\s4g)?)[\w\s]+build\//i,
            /mot[\s-]?(\w+)*/i,
            /(XT\d{3,4}) build\//i,
            /(nexus\s[6])/i
            ], [MODEL, [VENDOR, 'Motorola'], [TYPE, MOBILE]], [
            /android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i
            ], [MODEL, [VENDOR, 'Motorola'], [TYPE, TABLET]], [

            /android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n8000|sgh-t8[56]9|nexus 10))/i,
            /((SM-T\w+))/i
            ], [[VENDOR, 'Samsung'], MODEL, [TYPE, TABLET]], [                  // Samsung
            /((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-n900))/i,
            /(sam[sung]*)[\s-]*(\w+-?[\w-]*)*/i,
            /sec-((sgh\w+))/i
            ], [[VENDOR, 'Samsung'], MODEL, [TYPE, MOBILE]], [
            /(samsung);smarttv/i
            ], [VENDOR, MODEL, [TYPE, SMARTTV]], [

            /\(dtv[\);].+(aquos)/i                                              // Sharp
            ], [MODEL, [VENDOR, 'Sharp'], [TYPE, SMARTTV]], [
            /sie-(\w+)*/i                                                       // Siemens
            ], [MODEL, [VENDOR, 'Siemens'], [TYPE, MOBILE]], [

            /(maemo|nokia).*(n900|lumia\s\d+)/i,                                // Nokia
            /(nokia)[\s_-]?([\w-]+)*/i
            ], [[VENDOR, 'Nokia'], MODEL, [TYPE, MOBILE]], [

            /android\s3\.[\s\w;-]{10}(a\d{3})/i                                 // Acer
            ], [MODEL, [VENDOR, 'Acer'], [TYPE, TABLET]], [

            /android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i                     // LG Tablet
            ], [[VENDOR, 'LG'], MODEL, [TYPE, TABLET]], [
            /(lg) netcast\.tv/i                                                 // LG SmartTV
            ], [VENDOR, MODEL, [TYPE, SMARTTV]], [
            /(nexus\s[45])/i,                                                   // LG
            /lg[e;\s\/-]+(\w+)*/i
            ], [MODEL, [VENDOR, 'LG'], [TYPE, MOBILE]], [

            /android.+(ideatab[a-z0-9\-\s]+)/i                                  // Lenovo
            ], [MODEL, [VENDOR, 'Lenovo'], [TYPE, TABLET]], [

            /linux;.+((jolla));/i                                               // Jolla
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [

            /((pebble))app\/[\d\.]+\s/i                                         // Pebble
            ], [VENDOR, MODEL, [TYPE, WEARABLE]], [

            /android.+;\s(glass)\s\d/i                                          // Google Glass
            ], [MODEL, [VENDOR, 'Google'], [TYPE, WEARABLE]], [

            /android.+(\w+)\s+build\/hm\1/i,                                        // Xiaomi Hongmi 'numeric' models
            /android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i,                   // Xiaomi Hongmi
            /android.+(mi[\s\-_]*(?:one|one[\s_]plus)?[\s_]*(?:\d\w)?)\s+build/i    // Xiaomi Mi
            ], [[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, MOBILE]], [

            /\s(tablet)[;\/\s]/i,                                               // Unidentifiable Tablet
            /\s(mobile)[;\/\s]/i                                                // Unidentifiable Mobile
            ], [[TYPE, util.lowerize], VENDOR, MODEL]

            /*//////////////////////////
            // TODO: move to string map
            ////////////////////////////

            /(C6603)/i                                                          // Sony Xperia Z C6603
            ], [[MODEL, 'Xperia Z C6603'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [
            /(C6903)/i                                                          // Sony Xperia Z 1
            ], [[MODEL, 'Xperia Z 1'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [

            /(SM-G900[F|H])/i                                                   // Samsung Galaxy S5
            ], [[MODEL, 'Galaxy S5'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-G7102)/i                                                       // Samsung Galaxy Grand 2
            ], [[MODEL, 'Galaxy Grand 2'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-G530H)/i                                                       // Samsung Galaxy Grand Prime
            ], [[MODEL, 'Galaxy Grand Prime'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-G313HZ)/i                                                      // Samsung Galaxy V
            ], [[MODEL, 'Galaxy V'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-T805)/i                                                        // Samsung Galaxy Tab S 10.5
            ], [[MODEL, 'Galaxy Tab S 10.5'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [
            /(SM-G800F)/i                                                       // Samsung Galaxy S5 Mini
            ], [[MODEL, 'Galaxy S5 Mini'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
            /(SM-T311)/i                                                        // Samsung Galaxy Tab 3 8.0
            ], [[MODEL, 'Galaxy Tab 3 8.0'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [

            /(R1001)/i                                                          // Oppo R1001
            ], [MODEL, [VENDOR, 'OPPO'], [TYPE, MOBILE]], [
            /(X9006)/i                                                          // Oppo Find 7a
            ], [[MODEL, 'Find 7a'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
            /(R2001)/i                                                          // Oppo YOYO R2001
            ], [[MODEL, 'Yoyo R2001'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
            /(R815)/i                                                           // Oppo Clover R815
            ], [[MODEL, 'Clover R815'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
             /(U707)/i                                                          // Oppo Find Way S
            ], [[MODEL, 'Find Way S'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [

            /(T3C)/i                                                            // Advan Vandroid T3C
            ], [MODEL, [VENDOR, 'Advan'], [TYPE, TABLET]], [
            /(ADVAN T1J\+)/i                                                    // Advan Vandroid T1J+
            ], [[MODEL, 'Vandroid T1J+'], [VENDOR, 'Advan'], [TYPE, TABLET]], [
            /(ADVAN S4A)/i                                                      // Advan Vandroid S4A
            ], [[MODEL, 'Vandroid S4A'], [VENDOR, 'Advan'], [TYPE, MOBILE]], [

            /(V972M)/i                                                          // ZTE V972M
            ], [MODEL, [VENDOR, 'ZTE'], [TYPE, MOBILE]], [

            /(i-mobile)\s(IQ\s[\d\.]+)/i                                        // i-mobile IQ
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [
            /(IQ6.3)/i                                                          // i-mobile IQ IQ 6.3
            ], [[MODEL, 'IQ 6.3'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
            /(i-mobile)\s(i-style\s[\d\.]+)/i                                   // i-mobile i-STYLE
            ], [VENDOR, MODEL, [TYPE, MOBILE]], [
            /(i-STYLE2.1)/i                                                     // i-mobile i-STYLE 2.1
            ], [[MODEL, 'i-STYLE 2.1'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
            
            /(mobiistar touch LAI 512)/i                                        // mobiistar touch LAI 512
            ], [[MODEL, 'Touch LAI 512'], [VENDOR, 'mobiistar'], [TYPE, MOBILE]], [

            /////////////
            // END TODO
            ///////////*/

        ],

        engine : [[

            /windows.+\sedge\/([\w\.]+)/i                                       // EdgeHTML
            ], [VERSION, [NAME, 'EdgeHTML']], [

            /(presto)\/([\w\.]+)/i,                                             // Presto
            /(webkit|trident|netfront|netsurf|amaya|lynx|w3m)\/([\w\.]+)/i,     // WebKit/Trident/NetFront/NetSurf/Amaya/Lynx/w3m
            /(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i,                          // KHTML/Tasman/Links
            /(icab)[\/\s]([23]\.[\d\.]+)/i                                      // iCab
            ], [NAME, VERSION], [

            /rv\:([\w\.]+).*(gecko)/i                                           // Gecko
            ], [VERSION, NAME]
        ],

        os : [[

            // Windows based
            /microsoft\s(windows)\s(vista|xp)/i                                 // Windows (iTunes)
            ], [NAME, VERSION], [
            /(windows)\snt\s6\.2;\s(arm)/i,                                     // Windows RT
            /(windows\sphone(?:\sos)*|windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i
            ], [NAME, [VERSION, mapper.str, maps.os.windows.version]], [
            /(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i
            ], [[NAME, 'Windows'], [VERSION, mapper.str, maps.os.windows.version]], [

            // Mobile/Embedded OS
            /\((bb)(10);/i                                                      // BlackBerry 10
            ], [[NAME, 'BlackBerry'], VERSION], [
            /(blackberry)\w*\/?([\w\.]+)*/i,                                    // Blackberry
            /(tizen)[\/\s]([\w\.]+)/i,                                          // Tizen
            /(android|webos|palm\sos|qnx|bada|rim\stablet\sos|meego|contiki)[\/\s-]?([\w\.]+)*/i,
                                                                                // Android/WebOS/Palm/QNX/Bada/RIM/MeeGo/Contiki
            /linux;.+(sailfish);/i                                              // Sailfish OS
            ], [NAME, VERSION], [
            /(symbian\s?os|symbos|s60(?=;))[\/\s-]?([\w\.]+)*/i                 // Symbian
            ], [[NAME, 'Symbian'], VERSION], [
            /\((series40);/i                                                    // Series 40
            ], [NAME], [
            /mozilla.+\(mobile;.+gecko.+firefox/i                               // Firefox OS
            ], [[NAME, 'Firefox OS'], VERSION], [

            // Console
            /(nintendo|playstation)\s([wids34portablevu]+)/i,                   // Nintendo/Playstation

            // GNU/Linux based
            /(mint)[\/\s\(]?(\w+)*/i,                                           // Mint
            /(mageia|vectorlinux)[;\s]/i,                                       // Mageia/VectorLinux
            /(joli|[kxln]?ubuntu|debian|[open]*suse|gentoo|(?=\s)arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?([\w\.-]+)*/i,
                                                                                // Joli/Ubuntu/Debian/SUSE/Gentoo/Arch/Slackware
                                                                                // Fedora/Mandriva/CentOS/PCLinuxOS/RedHat/Zenwalk/Linpus
            /(hurd|linux)\s?([\w\.]+)*/i,                                       // Hurd/Linux
            /(gnu)\s?([\w\.]+)*/i                                               // GNU
            ], [NAME, VERSION], [

            /(cros)\s[\w]+\s([\w\.]+\w)/i                                       // Chromium OS
            ], [[NAME, 'Chromium OS'], VERSION],[

            // Solaris
            /(sunos)\s?([\w\.]+\d)*/i                                           // Solaris
            ], [[NAME, 'Solaris'], VERSION], [

            // BSD based
            /\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]+)*/i                   // FreeBSD/NetBSD/OpenBSD/PC-BSD/DragonFly
            ], [NAME, VERSION],[

            /(ip[honead]+)(?:.*os\s([\w]+)*\slike\smac|;\sopera)/i              // iOS
            ], [[NAME, 'iOS'], [VERSION, /_/g, '.']], [

            /(mac\sos\sx)\s?([\w\s\.]+\w)*/i,
            /(macintosh|mac(?=_powerpc)\s)/i                                    // Mac OS
            ], [[NAME, 'Mac OS'], [VERSION, /_/g, '.']], [

            // Other
            /((?:open)?solaris)[\/\s-]?([\w\.]+)*/i,                            // Solaris
            /(haiku)\s(\w+)/i,                                                  // Haiku
            /(aix)\s((\d)(?=\.|\)|\s)[\w\.]*)*/i,                               // AIX
            /(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms)/i,
                                                                                // Plan9/Minix/BeOS/OS2/AmigaOS/MorphOS/RISCOS/OpenVMS
            /(unix)\s?([\w\.]+)*/i                                              // UNIX
            ], [NAME, VERSION]
        ]
    };


    /////////////////
    // Constructor
    ////////////////


    var UAParser = function (uastring, extensions) {

        if (!(this instanceof UAParser)) {
            return new UAParser(uastring, extensions).getResult();
        }

        var ua = uastring || ((window && window.navigator && window.navigator.userAgent) ? window.navigator.userAgent : EMPTY);
        var rgxmap = extensions ? util.extend(regexes, extensions) : regexes;

        this.getBrowser = function () {
            var browser = mapper.rgx.apply(this, rgxmap.browser);
            browser.major = util.major(browser.version);
            return browser;
        };
        this.getCPU = function () {
            return mapper.rgx.apply(this, rgxmap.cpu);
        };
        this.getDevice = function () {
            return mapper.rgx.apply(this, rgxmap.device);
        };
        this.getEngine = function () {
            return mapper.rgx.apply(this, rgxmap.engine);
        };
        this.getOS = function () {
            return mapper.rgx.apply(this, rgxmap.os);
        };
        this.getResult = function() {
            return {
                ua      : this.getUA(),
                browser : this.getBrowser(),
                engine  : this.getEngine(),
                os      : this.getOS(),
                device  : this.getDevice(),
                cpu     : this.getCPU()
            };
        };
        this.getUA = function () {
            return ua;
        };
        this.setUA = function (uastring) {
            ua = uastring;
            return this;
        };
        this.setUA(ua);
        return this;
    };

    UAParser.VERSION = LIBVERSION;
    UAParser.BROWSER = {
        NAME    : NAME,
        MAJOR   : MAJOR, // deprecated
        VERSION : VERSION
    };
    UAParser.CPU = {
        ARCHITECTURE : ARCHITECTURE
    };
    UAParser.DEVICE = {
        MODEL   : MODEL,
        VENDOR  : VENDOR,
        TYPE    : TYPE,
        CONSOLE : CONSOLE,
        MOBILE  : MOBILE,
        SMARTTV : SMARTTV,
        TABLET  : TABLET,
        WEARABLE: WEARABLE,
        EMBEDDED: EMBEDDED
    };
    UAParser.ENGINE = {
        NAME    : NAME,
        VERSION : VERSION
    };
    UAParser.OS = {
        NAME    : NAME,
        VERSION : VERSION
    };


    ///////////
    // Export
    //////////


    // check js environment
    if (typeof(exports) !== UNDEF_TYPE) {
        // nodejs env
        if (typeof module !== UNDEF_TYPE && module.exports) {
            exports = module.exports = UAParser;
        }
        exports.UAParser = UAParser;
    } else {
        // requirejs env (optional)
        if (typeof(define) === FUNC_TYPE && define.amd) {
            define(function () {
                return UAParser;
            });
        } else {
            // browser env
            window.UAParser = UAParser;
        }
    }

    // jQuery/Zepto specific (optional)
    // Note: 
    //   In AMD env the global scope should be kept clean, but jQuery is an exception.
    //   jQuery always exports to global scope, unless jQuery.noConflict(true) is used,
    //   and we should catch that.
    var $ = window.jQuery || window.Zepto;
    if (typeof $ !== UNDEF_TYPE) {
        var parser = new UAParser();
        $.ua = parser.getResult();
        $.ua.get = function() {
            return parser.getUA();
        };
        $.ua.set = function (uastring) {
            parser.setUA(uastring);
            var result = parser.getResult();
            for (var prop in result) {
                $.ua[prop] = result[prop];
            }
        };
    }

})(typeof window === 'object' ? window : this);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:livechat/livechat.js");
require("./node_modules/meteor/rocketchat:livechat/server/startup.js");
require("./node_modules/meteor/rocketchat:livechat/permissions.js");
require("./node_modules/meteor/rocketchat:livechat/messageTypes.js");
require("./node_modules/meteor/rocketchat:livechat/roomType.js");
require("./node_modules/meteor/rocketchat:livechat/config.js");
require("./node_modules/meteor/rocketchat:livechat/server/hooks/externalMessage.js");
require("./node_modules/meteor/rocketchat:livechat/server/hooks/markRoomResponded.js");
require("./node_modules/meteor/rocketchat:livechat/server/hooks/offlineMessage.js");
require("./node_modules/meteor/rocketchat:livechat/server/hooks/RDStation.js");
require("./node_modules/meteor/rocketchat:livechat/server/hooks/sendToCRM.js");
require("./node_modules/meteor/rocketchat:livechat/server/hooks/sendToFacebook.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/addAgent.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/addManager.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/changeLivechatStatus.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/closeByVisitor.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/closeRoom.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/facebook.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/getCustomFields.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/getAgentData.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/getInitialData.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/loginByToken.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/pageVisited.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/registerGuest.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/removeAgent.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/removeCustomField.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/removeDepartment.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/removeManager.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/removeTrigger.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveAppearance.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveCustomField.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveDepartment.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveInfo.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveIntegration.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveSurveyFeedback.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveTrigger.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/searchAgent.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/sendMessageLivechat.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/sendOfflineMessage.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/setCustomField.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/setDepartmentForVisitor.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/startVideoCall.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/transfer.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/webhookTest.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/takeInquiry.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/returnAsInquiry.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/saveOfficeHours.js");
require("./node_modules/meteor/rocketchat:livechat/server/methods/sendTranscript.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/Users.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/Rooms.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatExternalMessage.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatCustomField.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatDepartment.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatDepartmentAgents.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatPageVisited.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatTrigger.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/indexes.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatInquiry.js");
require("./node_modules/meteor/rocketchat:livechat/server/models/LivechatOfficeHour.js");
require("./node_modules/meteor/rocketchat:livechat/server/lib/Livechat.js");
require("./node_modules/meteor/rocketchat:livechat/server/lib/QueueMethods.js");
require("./node_modules/meteor/rocketchat:livechat/server/lib/OfficeClock.js");
require("./node_modules/meteor/rocketchat:livechat/server/sendMessageBySMS.js");
require("./node_modules/meteor/rocketchat:livechat/server/unclosedLivechats.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/customFields.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/departmentAgents.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/externalMessages.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatAgents.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatAppearance.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatDepartments.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatIntegration.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatManagers.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatRooms.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatQueue.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatTriggers.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/visitorHistory.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/visitorInfo.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/visitorPageVisited.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatInquiries.js");
require("./node_modules/meteor/rocketchat:livechat/server/publications/livechatOfficeHours.js");
require("./node_modules/meteor/rocketchat:livechat/server/api.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:livechat'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_livechat.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9saXZlY2hhdC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvc3RhcnR1cC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvaG9va3MvZXh0ZXJuYWxNZXNzYWdlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9ob29rcy9tYXJrUm9vbVJlc3BvbmRlZC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvaG9va3Mvb2ZmbGluZU1lc3NhZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL2hvb2tzL1JEU3RhdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvaG9va3Mvc2VuZFRvQ1JNLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9ob29rcy9zZW5kVG9GYWNlYm9vay5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9hZGRBZ2VudC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9hZGRNYW5hZ2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL2NoYW5nZUxpdmVjaGF0U3RhdHVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL2Nsb3NlQnlWaXNpdG9yLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL2Nsb3NlUm9vbS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9mYWNlYm9vay5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9nZXRDdXN0b21GaWVsZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21ldGhvZHMvZ2V0QWdlbnREYXRhLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL2dldEluaXRpYWxEYXRhLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL2xvZ2luQnlUb2tlbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9wYWdlVmlzaXRlZC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9yZWdpc3Rlckd1ZXN0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3JlbW92ZUFnZW50LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3JlbW92ZUN1c3RvbUZpZWxkLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3JlbW92ZURlcGFydG1lbnQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21ldGhvZHMvcmVtb3ZlTWFuYWdlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9yZW1vdmVUcmlnZ2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NhdmVBcHBlYXJhbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NhdmVDdXN0b21GaWVsZC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9zYXZlRGVwYXJ0bWVudC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9zYXZlSW5mby5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9zYXZlSW50ZWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21ldGhvZHMvc2F2ZVN1cnZleUZlZWRiYWNrLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NhdmVUcmlnZ2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NlYXJjaEFnZW50LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NlbmRNZXNzYWdlTGl2ZWNoYXQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21ldGhvZHMvc2VuZE9mZmxpbmVNZXNzYWdlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NldEN1c3RvbUZpZWxkLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3NldERlcGFydG1lbnRGb3JWaXNpdG9yLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3N0YXJ0VmlkZW9DYWxsLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3RyYW5zZmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3dlYmhvb2tUZXN0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3Rha2VJbnF1aXJ5LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tZXRob2RzL3JldHVybkFzSW5xdWlyeS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbWV0aG9kcy9zYXZlT2ZmaWNlSG91cnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21ldGhvZHMvc2VuZFRyYW5zY3JpcHQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21vZGVscy9Vc2Vycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbW9kZWxzL1Jvb21zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tb2RlbHMvTGl2ZWNoYXRFeHRlcm5hbE1lc3NhZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21vZGVscy9MaXZlY2hhdEN1c3RvbUZpZWxkLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tb2RlbHMvTGl2ZWNoYXREZXBhcnRtZW50LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tb2RlbHMvTGl2ZWNoYXREZXBhcnRtZW50QWdlbnRzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9tb2RlbHMvTGl2ZWNoYXRQYWdlVmlzaXRlZC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbW9kZWxzL0xpdmVjaGF0VHJpZ2dlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbW9kZWxzL2luZGV4ZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21vZGVscy9MaXZlY2hhdElucXVpcnkuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL21vZGVscy9MaXZlY2hhdE9mZmljZUhvdXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL2xpYi9MaXZlY2hhdC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbGliL1F1ZXVlTWV0aG9kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvbGliL09mZmljZUNsb2NrLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9saWIvT21uaUNoYW5uZWwuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3NlbmRNZXNzYWdlQnlTTVMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3VuY2xvc2VkTGl2ZWNoYXRzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9wdWJsaWNhdGlvbnMvY3VzdG9tRmllbGRzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9wdWJsaWNhdGlvbnMvZGVwYXJ0bWVudEFnZW50cy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvcHVibGljYXRpb25zL2V4dGVybmFsTWVzc2FnZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3B1YmxpY2F0aW9ucy9saXZlY2hhdEFnZW50cy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvcHVibGljYXRpb25zL2xpdmVjaGF0QXBwZWFyYW5jZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvcHVibGljYXRpb25zL2xpdmVjaGF0RGVwYXJ0bWVudHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3B1YmxpY2F0aW9ucy9saXZlY2hhdEludGVncmF0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9wdWJsaWNhdGlvbnMvbGl2ZWNoYXRNYW5hZ2Vycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvcHVibGljYXRpb25zL2xpdmVjaGF0Um9vbXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3B1YmxpY2F0aW9ucy9saXZlY2hhdFF1ZXVlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9wdWJsaWNhdGlvbnMvbGl2ZWNoYXRUcmlnZ2Vycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvcHVibGljYXRpb25zL3Zpc2l0b3JIaXN0b3J5LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L3NlcnZlci9wdWJsaWNhdGlvbnMvdmlzaXRvckluZm8uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3B1YmxpY2F0aW9ucy92aXNpdG9yUGFnZVZpc2l0ZWQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL3B1YmxpY2F0aW9ucy9saXZlY2hhdElucXVpcmllcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9zZXJ2ZXIvcHVibGljYXRpb25zL2xpdmVjaGF0T2ZmaWNlSG91cnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvc2VydmVyL2FwaS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9wZXJtaXNzaW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9tZXNzYWdlVHlwZXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvcm9vbVR5cGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvY29uZmlnLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmxpdmVjaGF0L2ltcG9ydHMvc2VydmVyL3Jlc3QvZGVwYXJ0bWVudHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bGl2ZWNoYXQvaW1wb3J0cy9zZXJ2ZXIvcmVzdC9mYWNlYm9vay5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9pbXBvcnRzL3NlcnZlci9yZXN0L3Ntcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpsaXZlY2hhdC9pbXBvcnRzL3NlcnZlci9yZXN0L3VzZXJzLmpzIl0sIm5hbWVzIjpbIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsInVybCIsIldlYkFwcCIsIlBhY2thZ2UiLCJ3ZWJhcHAiLCJBdXRvdXBkYXRlIiwiYXV0b3VwZGF0ZSIsImNvbm5lY3RIYW5kbGVycyIsInVzZSIsIk1ldGVvciIsImJpbmRFbnZpcm9ubWVudCIsInJlcSIsInJlcyIsIm5leHQiLCJyZXFVcmwiLCJwYXJzZSIsInBhdGhuYW1lIiwic2V0SGVhZGVyIiwiZG9tYWluV2hpdGVMaXN0IiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiZ2V0IiwiaGVhZGVycyIsInJlZmVyZXIiLCJpc0VtcHR5IiwidHJpbSIsIm1hcCIsInNwbGl0IiwiZG9tYWluIiwiY29udGFpbnMiLCJob3N0IiwicHJvdG9jb2wiLCJoZWFkIiwiQXNzZXRzIiwiZ2V0VGV4dCIsImh0bWwiLCJhdXRvdXBkYXRlVmVyc2lvbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIiwid3JpdGUiLCJlbmQiLCJzdGFydHVwIiwicm9vbVR5cGVzIiwic2V0Um9vbUZpbmQiLCJjb2RlIiwibW9kZWxzIiwiUm9vbXMiLCJmaW5kTGl2ZWNoYXRCeUNvZGUiLCJhdXRoeiIsImFkZFJvb21BY2Nlc3NWYWxpZGF0b3IiLCJyb29tIiwidXNlciIsInQiLCJoYXNQZXJtaXNzaW9uIiwiX2lkIiwiY2FsbGJhY2tzIiwiYWRkIiwiRXJyb3IiLCJUQVBpMThuIiwiX18iLCJsbmciLCJsYW5ndWFnZSIsInByaW9yaXR5IiwiTE9XIiwia25vd2xlZGdlRW5hYmxlZCIsImFwaWFpS2V5IiwiYXBpYWlMYW5ndWFnZSIsImtleSIsInZhbHVlIiwibWVzc2FnZSIsImVkaXRlZEF0IiwidG9rZW4iLCJkZWZlciIsInJlc3BvbnNlIiwiSFRUUCIsInBvc3QiLCJkYXRhIiwicXVlcnkiLCJtc2ciLCJsYW5nIiwic2Vzc2lvbklkIiwic3RhdHVzIiwicmVzdWx0IiwiZnVsZmlsbG1lbnQiLCJzcGVlY2giLCJMaXZlY2hhdEV4dGVybmFsTWVzc2FnZSIsImluc2VydCIsInJpZCIsIm9yaWciLCJ0cyIsIkRhdGUiLCJlIiwiU3lzdGVtTG9nZ2VyIiwiZXJyb3IiLCJ3YWl0aW5nUmVzcG9uc2UiLCJub3ciLCJzZXRSZXNwb25zZUJ5Um9vbUlkIiwidSIsInVzZXJuYW1lIiwicmVzcG9uc2VEYXRlIiwicmVzcG9uc2VUaW1lIiwiZ2V0VGltZSIsInBvc3REYXRhIiwidHlwZSIsInNlbnRBdCIsInZpc2l0b3IiLCJuYW1lIiwiZW1haWwiLCJMaXZlY2hhdCIsInNlbmRSZXF1ZXN0IiwiTUVESVVNIiwic2VuZFRvUkRTdGF0aW9uIiwibGl2ZWNoYXREYXRhIiwiZ2V0TGl2ZWNoYXRSb29tR3Vlc3RJbmZvIiwib3B0aW9ucyIsInRva2VuX3Jkc3RhdGlvbiIsImlkZW50aWZpY2Fkb3IiLCJjbGllbnRfaWQiLCJub21lIiwicGhvbmUiLCJ0ZWxlZm9uZSIsInRhZ3MiLCJPYmplY3QiLCJrZXlzIiwiY3VzdG9tRmllbGRzIiwiZm9yRWFjaCIsImZpZWxkIiwiY2FsbCIsImNvbnNvbGUiLCJzZW5kVG9DUk0iLCJob29rIiwib3BlbiIsIm1lc3NhZ2VzIiwiTWVzc2FnZXMiLCJmaW5kVmlzaWJsZUJ5Um9vbUlkIiwic29ydCIsImFnZW50SWQiLCJwdXNoIiwic2F2ZUNSTURhdGFCeVJvb21JZCIsIk9tbmlDaGFubmVsIiwiZmFjZWJvb2siLCJyZXBseSIsInBhZ2UiLCJpZCIsInRleHQiLCJtZXRob2RzIiwidXNlcklkIiwibWV0aG9kIiwiYWRkQWdlbnQiLCJhZGRNYW5hZ2VyIiwibmV3U3RhdHVzIiwic3RhdHVzTGl2ZWNoYXQiLCJVc2VycyIsInNldExpdmVjaGF0U3RhdHVzIiwicm9vbUlkIiwiZmluZE9uZU9wZW5CeVZpc2l0b3JJZCIsImNsb3NlUm9vbSIsImNvbW1lbnQiLCJmaW5kT25lQnlJZCIsInVzZXJuYW1lcyIsImluZGV4T2YiLCJhY3Rpb24iLCJlbmFibGVkIiwiaGFzVG9rZW4iLCJlbmFibGUiLCJzdWNjZXNzIiwidXBkYXRlQnlJZCIsImRpc2FibGUiLCJsaXN0UGFnZXMiLCJzdWJzY3JpYmUiLCJ1bnN1YnNjcmliZSIsIkxpdmVjaGF0Q3VzdG9tRmllbGQiLCJmaW5kIiwiZmV0Y2giLCJjaGVjayIsIlN0cmluZyIsInByb2ZpbGUiLCJzZXJ2ZWRCeSIsImdldEFnZW50SW5mbyIsInZpc2l0b3JUb2tlbiIsImluZm8iLCJ0aXRsZSIsImNvbG9yIiwicmVnaXN0cmF0aW9uRm9ybSIsInRyaWdnZXJzIiwiZGVwYXJ0bWVudHMiLCJhbGxvd1N3aXRjaGluZ0RlcGFydG1lbnRzIiwib25saW5lIiwib2ZmbGluZUNvbG9yIiwib2ZmbGluZU1lc3NhZ2UiLCJvZmZsaW5lU3VjY2Vzc01lc3NhZ2UiLCJvZmZsaW5lVW5hdmFpbGFibGVNZXNzYWdlIiwiZGlzcGxheU9mZmxpbmVGb3JtIiwidmlkZW9DYWxsIiwiZmluZE9wZW5CeVZpc2l0b3JUb2tlbiIsImZpZWxkcyIsImNsIiwibGVuZ3RoIiwiaW5pdFNldHRpbmdzIiwiZ2V0SW5pdFNldHRpbmdzIiwiTGl2ZWNoYXRfdGl0bGUiLCJMaXZlY2hhdF90aXRsZV9jb2xvciIsIkxpdmVjaGF0X2VuYWJsZWQiLCJMaXZlY2hhdF9yZWdpc3RyYXRpb25fZm9ybSIsIm9mZmxpbmVUaXRsZSIsIkxpdmVjaGF0X29mZmxpbmVfdGl0bGUiLCJMaXZlY2hhdF9vZmZsaW5lX3RpdGxlX2NvbG9yIiwiTGl2ZWNoYXRfb2ZmbGluZV9tZXNzYWdlIiwiTGl2ZWNoYXRfb2ZmbGluZV9zdWNjZXNzX21lc3NhZ2UiLCJMaXZlY2hhdF9vZmZsaW5lX2Zvcm1fdW5hdmFpbGFibGUiLCJMaXZlY2hhdF9kaXNwbGF5X29mZmxpbmVfZm9ybSIsIkxhbmd1YWdlIiwiTGl2ZWNoYXRfdmlkZW9jYWxsX2VuYWJsZWQiLCJKaXRzaV9FbmFibGVkIiwidHJhbnNjcmlwdCIsIkxpdmVjaGF0X2VuYWJsZV90cmFuc2NyaXB0IiwidHJhbnNjcmlwdE1lc3NhZ2UiLCJMaXZlY2hhdF90cmFuc2NyaXB0X21lc3NhZ2UiLCJhZ2VudERhdGEiLCJMaXZlY2hhdFRyaWdnZXIiLCJmaW5kRW5hYmxlZCIsInRyaWdnZXIiLCJwaWNrIiwiTGl2ZWNoYXREZXBhcnRtZW50IiwiZmluZEVuYWJsZWRXaXRoQWdlbnRzIiwiZGVwYXJ0bWVudCIsIkxpdmVjaGF0X2FsbG93X3N3aXRjaGluZ19kZXBhcnRtZW50cyIsImZpbmRPbmxpbmVBZ2VudHMiLCJjb3VudCIsImdldFZpc2l0b3JCeVRva2VuIiwic3RhbXBlZFRva2VuIiwiQWNjb3VudHMiLCJfZ2VuZXJhdGVTdGFtcGVkTG9naW5Ub2tlbiIsImhhc2hTdGFtcGVkVG9rZW4iLCJfaGFzaFN0YW1wZWRUb2tlbiIsInVwZGF0ZVVzZXIiLCIkc2V0Iiwic2VydmljZXMiLCJyZXN1bWUiLCJsb2dpblRva2VucyIsInVzZXJzIiwidXBkYXRlIiwicGFnZUluZm8iLCJzYXZlUGFnZUhpc3RvcnkiLCJyZWdpc3Rlckd1ZXN0IiwibG9naW5Ub2tlbiIsIkxpdmVjaGF0UGFnZVZpc2l0ZWQiLCJrZWVwSGlzdG9yeUZvclRva2VuIiwicmVtb3ZlQWdlbnQiLCJjdXN0b21GaWVsZCIsInJlbW92ZUJ5SWQiLCJyZW1vdmVEZXBhcnRtZW50IiwicmVtb3ZlTWFuYWdlciIsInRyaWdnZXJJZCIsInZhbGlkU2V0dGluZ3MiLCJ2YWxpZCIsImV2ZXJ5Iiwic2V0dGluZyIsImN1c3RvbUZpZWxkRGF0YSIsIk1hdGNoIiwiT2JqZWN0SW5jbHVkaW5nIiwibGFiZWwiLCJzY29wZSIsInZpc2liaWxpdHkiLCJ0ZXN0IiwiY3JlYXRlT3JVcGRhdGVDdXN0b21GaWVsZCIsImRlcGFydG1lbnREYXRhIiwiZGVwYXJ0bWVudEFnZW50cyIsInNhdmVEZXBhcnRtZW50IiwiZ3Vlc3REYXRhIiwicm9vbURhdGEiLCJPcHRpb25hbCIsInRvcGljIiwicmV0Iiwic2F2ZUd1ZXN0Iiwic2F2ZVJvb21JbmZvIiwicnVuIiwicyIsInZhbHVlcyIsInZpc2l0b3JSb29tIiwiZm9ybURhdGEiLCJ1bmRlZmluZWQiLCJ1cGRhdGVEYXRhIiwiaXRlbSIsInVwZGF0ZVN1cnZleUZlZWRiYWNrQnlJZCIsIk1heWJlIiwiZGVzY3JpcHRpb24iLCJCb29sZWFuIiwiY29uZGl0aW9ucyIsIkFycmF5IiwiYWN0aW9ucyIsImlzU3RyaW5nIiwiZmluZE9uZUJ5VXNlcm5hbWUiLCJzZW5kTWVzc2FnZUxpdmVjaGF0IiwiZ3Vlc3QiLCJmaW5kT25lIiwic2VuZE1lc3NhZ2UiLCJkbnMiLCJOcG0iLCJoZWFkZXIiLCJwbGFjZWhvbGRlcnMiLCJyZXBsYWNlIiwiZm9vdGVyIiwiZnJvbUVtYWlsIiwibWF0Y2giLCJlbWFpbERvbWFpbiIsInN1YnN0ciIsImxhc3RJbmRleE9mIiwid3JhcEFzeW5jIiwicmVzb2x2ZU14IiwiRW1haWwiLCJzZW5kIiwidG8iLCJmcm9tIiwicmVwbHlUbyIsInN1YmplY3QiLCJzdWJzdHJpbmciLCJERFBSYXRlTGltaXRlciIsImFkZFJ1bGUiLCJjb25uZWN0aW9uSWQiLCJvdmVyd3JpdGUiLCJ1cGRhdGVMaXZlY2hhdERhdGFCeVRva2VuIiwic2V0RGVwYXJ0bWVudEZvckd1ZXN0IiwiUmFuZG9tIiwiZ2V0Um9vbSIsImppdHNpVGltZW91dCIsImNyZWF0ZVdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIiLCJhY3Rpb25MaW5rcyIsImljb24iLCJpMThuTGFiZWwiLCJtZXRob2RfaWQiLCJwYXJhbXMiLCJqaXRzaVJvb20iLCJ0cmFuc2ZlckRhdGEiLCJkZXBhcnRtZW50SWQiLCJoYXNSb2xlIiwidHJhbnNmZXIiLCJwb3N0Q2F0Y2hFcnJvciIsInJlc29sdmUiLCJlcnIiLCJ1bmJsb2NrIiwic2FtcGxlRGF0YSIsImNyZWF0ZWRBdCIsImxhc3RNZXNzYWdlQXQiLCJwcm9kdWN0SWQiLCJpcCIsImJyb3dzZXIiLCJvcyIsImN1c3RvbWVySWQiLCJhZ2VudCIsImxvZyIsInN0YXR1c0NvZGUiLCJpbnF1aXJ5SWQiLCJpbnF1aXJ5IiwiTGl2ZWNoYXRJbnF1aXJ5Iiwic3Vic2NyaXB0aW9uRGF0YSIsImFsZXJ0IiwidW5yZWFkIiwidXNlck1lbnRpb25zIiwiZ3JvdXBNZW50aW9ucyIsImRlc2t0b3BOb3RpZmljYXRpb25zIiwibW9iaWxlUHVzaE5vdGlmaWNhdGlvbnMiLCJlbWFpbE5vdGlmaWNhdGlvbnMiLCJTdWJzY3JpcHRpb25zIiwiY2hhbmdlQWdlbnRCeVJvb21JZCIsInRha2VJbnF1aXJ5IiwiY3JlYXRlQ29tbWFuZFdpdGhSb29tSWRBbmRVc2VyIiwic3RyZWFtIiwiZW1pdCIsInJlbW92ZUJ5Um9vbUlkIiwicmVtb3ZlVXNlcm5hbWVCeUlkIiwib3BlbklucXVpcnkiLCJkYXkiLCJzdGFydCIsImZpbmlzaCIsIkxpdmVjaGF0T2ZmaWNlSG91ciIsInVwZGF0ZUhvdXJzIiwibW9tZW50IiwidXNlckxhbmd1YWdlIiwiYXV0aG9yIiwiZGF0ZXRpbWUiLCJsb2NhbGUiLCJmb3JtYXQiLCJzaW5nbGVNZXNzYWdlIiwiZW1haWxTZXR0aW5ncyIsInNldE9wZXJhdG9yIiwib3BlcmF0b3IiLCIkZXhpc3RzIiwiJG5lIiwicm9sZXMiLCJmaW5kQWdlbnRzIiwiZmluZE9ubGluZVVzZXJGcm9tTGlzdCIsInVzZXJMaXN0IiwiJGluIiwiY29uY2F0IiwiZ2V0TmV4dEFnZW50IiwiY29sbGVjdGlvbk9iaiIsIm1vZGVsIiwicmF3Q29sbGVjdGlvbiIsImZpbmRBbmRNb2RpZnkiLCJsaXZlY2hhdENvdW50IiwiJGluYyIsImZpbmRWaXNpdG9yQnlUb2tlbiIsImNsb3NlT2ZmaWNlIiwic2VsZiIsIm9wZW5PZmZpY2UiLCJmaW5kT25lVmlzaXRvckJ5UGhvbmUiLCJnZXROZXh0VmlzaXRvclVzZXJuYW1lIiwic2V0dGluZ3NSYXciLCJTZXR0aW5ncyIsInNhdmVHdWVzdEJ5SWQiLCJzZXREYXRhIiwidW5zZXREYXRhIiwidmlzaXRvckVtYWlscyIsImFkZHJlc3MiLCJwaG9uZU51bWJlciIsIiR1bnNldCIsImZpbmRPbmVHdWVzdEJ5RW1haWxBZGRyZXNzIiwiZW1haWxBZGRyZXNzIiwiUmVnRXhwIiwiZXNjYXBlUmVnRXhwIiwiZW1haWxzIiwic3VydmV5RmVlZGJhY2siLCJmaW5kTGl2ZWNoYXQiLCJmaWx0ZXIiLCJvZmZzZXQiLCJsaW1pdCIsImV4dGVuZCIsInBhcnNlSW50IiwiZ2V0TmV4dExpdmVjaGF0Um9vbUNvZGUiLCJmaW5kQnlWaXNpdG9yVG9rZW4iLCJmaW5kQnlWaXNpdG9ySWQiLCJ2aXNpdG9ySWQiLCJyZXNwb25zZUJ5IiwiY2xvc2VCeVJvb21JZCIsImNsb3NlSW5mbyIsImNsb3NlZEJ5IiwiY2xvc2VkQXQiLCJjaGF0RHVyYXRpb24iLCJzZXRMYWJlbEJ5Um9vbUlkIiwiZmluZE9wZW5CeUFnZW50IiwibmV3QWdlbnQiLCJjcm1EYXRhIiwiX0Jhc2UiLCJjb25zdHJ1Y3RvciIsImlzQ2xpZW50IiwiX2luaXRNb2RlbCIsImZpbmRCeVJvb21JZCIsImV4dHJhRGF0YSIsInJlY29yZCIsInJlbW92ZSIsInRyeUVuc3VyZUluZGV4IiwibnVtQWdlbnRzIiwiZmluZEJ5RGVwYXJ0bWVudElkIiwiY3JlYXRlT3JVcGRhdGVEZXBhcnRtZW50Iiwic2hvd09uUmVnaXN0cmF0aW9uIiwiYWdlbnRzIiwic2F2ZWRBZ2VudHMiLCJwbHVjayIsIkxpdmVjaGF0RGVwYXJ0bWVudEFnZW50cyIsImFnZW50c1RvU2F2ZSIsImRpZmZlcmVuY2UiLCJyZW1vdmVCeURlcGFydG1lbnRJZEFuZEFnZW50SWQiLCJzYXZlQWdlbnQiLCJvcmRlciIsIiRndCIsInVwc2VydCIsImdldE5leHRBZ2VudEZvckRlcGFydG1lbnQiLCJvbmxpbmVVc2VycyIsIm9ubGluZVVzZXJuYW1lcyIsImdldE9ubGluZUZvckRlcGFydG1lbnQiLCJkZXBBZ2VudHMiLCJmaW5kVXNlcnNJblF1ZXVlIiwidXNlcnNMaXN0Iiwic3BhcnNlIiwiZXhwaXJlQWZ0ZXJTZWNvbmRzIiwic2F2ZUJ5VG9rZW4iLCJrZWVwSGlzdG9yeU1pbGlzZWNvbmRzIiwiZXhwaXJlQXQiLCJmaW5kQnlUb2tlbiIsIm11bHRpIiwicmVtb3ZlQWxsIiwiZmluZEJ5SWQiLCJnZXRTdGF0dXMiLCJuZXdTdGFydCIsIm5ld0ZpbmlzaCIsIm5ld09wZW4iLCJpc05vd1dpdGhpbkhvdXJzIiwiY3VycmVudFRpbWUiLCJ1dGMiLCJ0b2RheXNPZmZpY2VIb3VycyIsImlzQmVmb3JlIiwiaXNCZXR3ZWVuIiwiaXNPcGVuaW5nVGltZSIsImlzU2FtZSIsImlzQ2xvc2luZ1RpbWUiLCJVQVBhcnNlciIsImhpc3RvcnlNb25pdG9yVHlwZSIsImxvZ2dlciIsIkxvZ2dlciIsInNlY3Rpb25zIiwid2ViaG9vayIsImdldEFnZW50cyIsImdldE9ubGluZUFnZW50cyIsInJvb21JbmZvIiwibmV3Um9vbSIsImRlcHQiLCJyb3V0aW5nTWV0aG9kIiwiUXVldWVNZXRob2RzIiwiYWxpYXMiLCJzaG93Q29ubmVjdGluZyIsIiRhZGRUb1NldCIsImV4aXN0aW5nVXNlciIsInVzZXJEYXRhIiwiZ2xvYmFsUm9sZXMiLCJqb2luRGVmYXVsdENoYW5uZWxzIiwiY29ubmVjdGlvbiIsInVzZXJBZ2VudCIsImh0dHBIZWFkZXJzIiwiY2xpZW50QWRkcmVzcyIsImluc2VydFVzZXJEb2MiLCJudW1iZXIiLCJfc2V0UmVhbE5hbWUiLCJncm91cGFibGUiLCJoaWRlQnlSb29tSWRBbmRVc2VySWQiLCJmaW5kTm90SGlkZGVuUHVibGljIiwic2V0VG9waWNBbmRUYWdzQnlJZCIsInVwZGF0ZU5hbWVCeVJvb21JZCIsImNsb3NlT3BlbkNoYXRzIiwiZm9yd2FyZE9wZW5DaGF0cyIsImNoYW5nZSIsIndpdGhvdXQiLCJyZW1vdmVCeVJvb21JZEFuZFVzZXJJZCIsImNyZWF0ZVVzZXJMZWF2ZVdpdGhSb29tSWRBbmRVc2VyIiwiY3JlYXRlVXNlckpvaW5XaXRoUm9vbUlkQW5kVXNlciIsImNhbGxiYWNrIiwidHJ5aW5nIiwid2FybiIsInNldFRpbWVvdXQiLCJ1YSIsInNldFVBIiwibG0iLCJnZXRPUyIsInZlcnNpb24iLCJnZXRCcm93c2VyIiwiYWRkVXNlclJvbGVzIiwicmVtb3ZlVXNlckZyb21Sb2xlcyIsIlN0cmVhbWVyIiwiYWxsb3dSZWFkIiwicm9vbUNvZGUiLCJtc2dzIiwiYWdlbnRJZHMiLCJzZXRJbnRlcnZhbCIsImdhdGV3YXlVUkwiLCJleHBvcnREZWZhdWx0IiwicGFnZUlkIiwiU01TIiwic21zIiwiU01TU2VydmljZSIsImdldFNlcnZpY2UiLCJhZ2VudHNIYW5kbGVyIiwibW9uaXRvckFnZW50cyIsImFjdGlvblRpbWVvdXQiLCJvbmxpbmVBZ2VudHMiLCJxdWV1ZSIsImNsZWFyVGltZW91dCIsImV4aXN0cyIsInJ1bkFnZW50TGVhdmVBY3Rpb24iLCJvYnNlcnZlQ2hhbmdlcyIsImFkZGVkIiwiY2hhbmdlZCIsInJlbW92ZWQiLCJzdG9wIiwiVXNlclByZXNlbmNlTW9uaXRvciIsIm9uU2V0VXNlclN0YXR1cyIsInB1Ymxpc2giLCJoYW5kbGUiLCJnZXRVc2Vyc0luUm9sZSIsInJlYWR5Iiwib25TdG9wIiwiZmluZEJ5SWRzIiwiJGd0ZSIsInNldERhdGUiLCJnZXREYXRlIiwic2V0U2Vjb25kcyIsImdldFNlY29uZHMiLCIkbHRlIiwiaGFuZGxlRGVwdHMiLCJSb2xlcyIsImNyZWF0ZU9yVXBkYXRlIiwiUGVybWlzc2lvbnMiLCJNZXNzYWdlVHlwZXMiLCJyZWdpc3RlclR5cGUiLCJzeXN0ZW0iLCJyZWdpc3RlciIsImluc3RhbmNlIiwidGFiQmFyIiwiaXNTZXJ2ZXIiLCJOb3RpZmljYXRpb25zIiwibm90aWZ5Um9vbSIsInNldEhpZGRlbkJ5SWQiLCJSb29tU2V0dGluZ3NFbnVtIiwiUm9vbVR5cGVDb25maWciLCJSb29tVHlwZVJvdXRlQ29uZmlnIiwiVWlUZXh0Q29udGV4dCIsIkxpdmVjaGF0Um9vbVJvdXRlIiwicGF0aCIsIm9wZW5Sb29tIiwibGluayIsInN1YiIsIkxpdmVjaGF0Um9vbVR5cGUiLCJpZGVudGlmaWVyIiwicm91dGUiLCJub3RTdWJzY3JpYmVkVHBsIiwidGVtcGxhdGUiLCJmaW5kUm9vbSIsIkNoYXRSb29tIiwicm9vbU5hbWUiLCJjb25kaXRpb24iLCJoYXNBbGxQZXJtaXNzaW9uIiwiY2FuU2VuZE1lc3NhZ2UiLCJnZXRVc2VyU3RhdHVzIiwiZ3Vlc3ROYW1lIiwiU2Vzc2lvbiIsImFsbG93Um9vbVNldHRpbmdDaGFuZ2UiLCJKT0lOX0NPREUiLCJnZXRVaVRleHQiLCJjb250ZXh0IiwiSElERV9XQVJOSU5HIiwiTEVBVkVfV0FSTklORyIsImFkZEdyb3VwIiwiZ3JvdXAiLCJwdWJsaWMiLCJzZWN0aW9uIiwiaTE4bkRlc2NyaXB0aW9uIiwiZW5hYmxlUXVlcnkiLCJBUEkiLCJ2MSIsImFkZFJvdXRlIiwiYXV0aFJlcXVpcmVkIiwidW5hdXRob3JpemVkIiwiYm9keVBhcmFtcyIsImZhaWx1cmUiLCJ1cmxQYXJhbXMiLCJwdXQiLCJkZWxldGUiLCJjcnlwdG8iLCJhdHRhY2htZW50cyIsInJlcXVlc3QiLCJzaWduYXR1cmUiLCJjcmVhdGVIbWFjIiwiYm9keSIsImRpZ2VzdCIsIm1pZCIsInJvb21zIiwiZmlyc3RfbmFtZSIsImxhc3RfbmFtZSIsInN1Y2VzcyIsInNlcnZpY2UiLCJleHRyYSIsImZyb21Db3VudHJ5IiwiZnJvbVN0YXRlIiwiZnJvbUNpdHkiLCJyb2xlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUF3RCxJQUFJQyxHQUFKO0FBQVFMLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxLQUFSLENBQWIsRUFBNEI7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNDLFFBQUlELENBQUo7QUFBTTs7QUFBbEIsQ0FBNUIsRUFBZ0QsQ0FBaEQ7QUFJdEVFLFNBQVNDLFFBQVFDLE1BQVIsQ0FBZUYsTUFBeEI7QUFDQSxNQUFNRyxhQUFhRixRQUFRRyxVQUFSLENBQW1CRCxVQUF0QztBQUVBSCxPQUFPSyxlQUFQLENBQXVCQyxHQUF2QixDQUEyQixXQUEzQixFQUF3Q0MsT0FBT0MsZUFBUCxDQUF1QixDQUFDQyxHQUFELEVBQU1DLEdBQU4sRUFBV0MsSUFBWCxLQUFvQjtBQUNsRixPQUFNQyxTQUFTYixJQUFJYyxLQUFKLENBQVVKLElBQUlWLEdBQWQsQ0FBZjs7QUFDQSxLQUFJYSxPQUFPRSxRQUFQLEtBQW9CLEdBQXhCLEVBQTZCO0FBQzVCLFNBQU9ILE1BQVA7QUFDQTs7QUFDREQsS0FBSUssU0FBSixDQUFjLGNBQWQsRUFBOEIsMEJBQTlCO0FBRUEsS0FBSUMsa0JBQWtCQyxXQUFXQyxRQUFY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QUFmLENBQWtCSyxPQUFsQixFQUFQO0FBQ0EsR0F6QkQsQ0F5QkUsT0FBT3ZpQixDQUFQLEVBQVU7QUFDWCxVQUFPekUsV0FBVzBtQixHQUFYLENBQWVDLEVBQWYsQ0FBa0JLLE9BQWxCLENBQTBCdmlCLEVBQUVFLEtBQTVCLENBQVA7QUFDQTtBQUNEOztBQTFFOEUsQ0FBaEYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9saXZlY2hhdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgV2ViQXBwOnRydWUgKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHVybCBmcm9tICd1cmwnO1xuXG5XZWJBcHAgPSBQYWNrYWdlLndlYmFwcC5XZWJBcHA7XG5jb25zdCBBdXRvdXBkYXRlID0gUGFja2FnZS5hdXRvdXBkYXRlLkF1dG91cGRhdGU7XG5cbldlYkFwcC5jb25uZWN0SGFuZGxlcnMudXNlKCcvbGl2ZWNoYXQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChyZXEsIHJlcywgbmV4dCkgPT4ge1xuXHRjb25zdCByZXFVcmwgPSB1cmwucGFyc2UocmVxLnVybCk7XG5cdGlmIChyZXFVcmwucGF0aG5hbWUgIT09ICcvJykge1xuXHRcdHJldHVybiBuZXh0KCk7XG5cdH1cblx0cmVzLnNldEhlYWRlcignY29udGVudC10eXBlJywgJ3RleHQvaHRtbDsgY2hhcnNldD11dGYtOCcpO1xuXG5cdGxldCBkb21haW5XaGl0ZUxpc3QgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfQWxsb3dlZERvbWFpbnNMaXN0Jyk7XG5cdGlmIChyZXEuaGVhZGVycy5yZWZlcmVyICYmICFfLmlzRW1wdHkoZG9tYWluV2hpdGVMaXN0LnRyaW0oKSkpIHtcblx0XHRkb21haW5XaGl0ZUxpc3QgPSBfLm1hcChkb21haW5XaGl0ZUxpc3Quc3BsaXQoJywnKSwgZnVuY3Rpb24oZG9tYWluKSB7XG5cdFx0XHRyZXR1cm4gZG9tYWluLnRyaW0oKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlZmVyZXIgPSB1cmwucGFyc2UocmVxLmhlYWRlcnMucmVmZXJlcik7XG5cdFx0aWYgKCFfLmNvbnRhaW5zKGRvbWFpbldoaXRlTGlzdCwgcmVmZXJlci5ob3N0KSkge1xuXHRcdFx0cmVzLnNldEhlYWRlcignWC1GUkFNRS1PUFRJT05TJywgJ0RFTlknKTtcblx0XHRcdHJldHVybiBuZXh0KCk7XG5cdFx0fVxuXG5cdFx0cmVzLnNldEhlYWRlcignWC1GUkFNRS1PUFRJT05TJywgYEFMTE9XLUZST00gJHsgcmVmZXJlci5wcm90b2NvbCB9Ly8keyByZWZlcmVyLmhvc3QgfWApO1xuXHR9XG5cblx0Y29uc3QgaGVhZCA9IEFzc2V0cy5nZXRUZXh0KCdwdWJsaWMvaGVhZC5odG1sJyk7XG5cblx0Y29uc3QgaHRtbCA9IGA8aHRtbD5cblx0XHQ8aGVhZD5cblx0XHRcdDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiB0eXBlPVwidGV4dC9jc3NcIiBjbGFzcz1cIl9fbWV0ZW9yLWNzc19fXCIgaHJlZj1cIi9saXZlY2hhdC9saXZlY2hhdC5jc3M/X2RjPSR7IEF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb24gfVwiPlxuXHRcdFx0PHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCI+XG5cdFx0XHRcdF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gPSAkeyBKU09OLnN0cmluZ2lmeShfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fKSB9O1xuXHRcdFx0PC9zY3JpcHQ+XG5cblx0XHRcdCR7IGhlYWQgfVxuXHRcdDwvaGVhZD5cblx0XHQ8Ym9keT5cblx0XHRcdDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiIHNyYz1cIi9saXZlY2hhdC9saXZlY2hhdC5qcz9fZGM9JHsgQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvbiB9XCI+PC9zY3JpcHQ+XG5cdFx0PC9ib2R5PlxuXHQ8L2h0bWw+YDtcblxuXHRyZXMud3JpdGUoaHRtbCk7XG5cdHJlcy5lbmQoKTtcbn0pKTtcbiIsIk1ldGVvci5zdGFydHVwKCgpID0+IHtcblx0Um9ja2V0Q2hhdC5yb29tVHlwZXMuc2V0Um9vbUZpbmQoJ2wnLCAoY29kZSkgPT4ge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kTGl2ZWNoYXRCeUNvZGUoY29kZSk7XG5cdH0pO1xuXG5cdFJvY2tldENoYXQuYXV0aHouYWRkUm9vbUFjY2Vzc1ZhbGlkYXRvcihmdW5jdGlvbihyb29tLCB1c2VyKSB7XG5cdFx0cmV0dXJuIHJvb20udCA9PT0gJ2wnICYmIFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih1c2VyLl9pZCwgJ3ZpZXctbGl2ZWNoYXQtcm9vbXMnKTtcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5hdXRoei5hZGRSb29tQWNjZXNzVmFsaWRhdG9yKGZ1bmN0aW9uKHJvb20sIHVzZXIpIHtcblx0XHRyZXR1cm4gcm9vbS50ID09PSAnbCcgJiYgcm9vbS52ICYmIHJvb20udi5faWQgPT09IHVzZXIuX2lkO1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2JlZm9yZUxlYXZlUm9vbScsIGZ1bmN0aW9uKHVzZXIsIHJvb20pIHtcblx0XHRpZiAocm9vbS50ICE9PSAnbCcpIHtcblx0XHRcdHJldHVybiB1c2VyO1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFRBUGkxOG4uX18oJ1lvdV9jYW50X2xlYXZlX2FfbGl2ZWNoYXRfcm9vbV9QbGVhc2VfdXNlX3RoZV9jbG9zZV9idXR0b24nLCB7XG5cdFx0XHRsbmc6IHVzZXIubGFuZ3VhZ2UgfHwgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ2xhbmd1YWdlJykgfHwgJ2VuJ1xuXHRcdH0pKTtcblx0fSwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTE9XLCAnY2FudC1sZWF2ZS1yb29tJyk7XG59KTtcbiIsIi8qIGdsb2JhbHMgSFRUUCwgU3lzdGVtTG9nZ2VyICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxubGV0IGtub3dsZWRnZUVuYWJsZWQgPSBmYWxzZTtcbmxldCBhcGlhaUtleSA9ICcnO1xubGV0IGFwaWFpTGFuZ3VhZ2UgPSAnZW4nO1xuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X0tub3dsZWRnZV9FbmFibGVkJywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRrbm93bGVkZ2VFbmFibGVkID0gdmFsdWU7XG59KTtcblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9Lbm93bGVkZ2VfQXBpYWlfS2V5JywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRhcGlhaUtleSA9IHZhbHVlO1xufSk7XG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfS25vd2xlZGdlX0FwaWFpX0xhbmd1YWdlJywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRhcGlhaUxhbmd1YWdlID0gdmFsdWU7XG59KTtcblxuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlclNhdmVNZXNzYWdlJywgZnVuY3Rpb24obWVzc2FnZSwgcm9vbSkge1xuXHQvLyBza2lwcyB0aGlzIGNhbGxiYWNrIGlmIHRoZSBtZXNzYWdlIHdhcyBlZGl0ZWRcblx0aWYgKCFtZXNzYWdlIHx8IG1lc3NhZ2UuZWRpdGVkQXQpIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdGlmICgha25vd2xlZGdlRW5hYmxlZCkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0aWYgKCEodHlwZW9mIHJvb20udCAhPT0gJ3VuZGVmaW5lZCcgJiYgcm9vbS50ID09PSAnbCcgJiYgcm9vbS52ICYmIHJvb20udi50b2tlbikpIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdC8vIGlmIHRoZSBtZXNzYWdlIGhhc24ndCBhIHRva2VuLCBpdCB3YXMgbm90IHNlbnQgYnkgdGhlIHZpc2l0b3IsIHNvIGlnbm9yZSBpdFxuXHRpZiAoIW1lc3NhZ2UudG9rZW4pIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gSFRUUC5wb3N0KCdodHRwczovL2FwaS5hcGkuYWkvYXBpL3F1ZXJ5P3Y9MjAxNTA5MTAnLCB7XG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRxdWVyeTogbWVzc2FnZS5tc2csXG5cdFx0XHRcdFx0bGFuZzogYXBpYWlMYW5ndWFnZSxcblx0XHRcdFx0XHRzZXNzaW9uSWQ6IHJvb20uX2lkXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnLFxuXHRcdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYEJlYXJlciAkeyBhcGlhaUtleSB9YFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zdGF0dXMuY29kZSA9PT0gMjAwICYmICFfLmlzRW1wdHkocmVzcG9uc2UuZGF0YS5yZXN1bHQuZnVsZmlsbG1lbnQuc3BlZWNoKSkge1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdEV4dGVybmFsTWVzc2FnZS5pbnNlcnQoe1xuXHRcdFx0XHRcdHJpZDogbWVzc2FnZS5yaWQsXG5cdFx0XHRcdFx0bXNnOiByZXNwb25zZS5kYXRhLnJlc3VsdC5mdWxmaWxsbWVudC5zcGVlY2gsXG5cdFx0XHRcdFx0b3JpZzogbWVzc2FnZS5faWQsXG5cdFx0XHRcdFx0dHM6IG5ldyBEYXRlKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0U3lzdGVtTG9nZ2VyLmVycm9yKCdFcnJvciB1c2luZyBBcGkuYWkgLT4nLCBlKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiBtZXNzYWdlO1xufSwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTE9XLCAnZXh0ZXJuYWxXZWJIb29rJyk7XG4iLCJSb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2FmdGVyU2F2ZU1lc3NhZ2UnLCBmdW5jdGlvbihtZXNzYWdlLCByb29tKSB7XG5cdC8vIHNraXBzIHRoaXMgY2FsbGJhY2sgaWYgdGhlIG1lc3NhZ2Ugd2FzIGVkaXRlZFxuXHRpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS5lZGl0ZWRBdCkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gY2hlY2sgaWYgcm9vbSBpcyB5ZXQgYXdhaXRpbmcgZm9yIHJlc3BvbnNlXG5cdGlmICghKHR5cGVvZiByb29tLnQgIT09ICd1bmRlZmluZWQnICYmIHJvb20udCA9PT0gJ2wnICYmIHJvb20ud2FpdGluZ1Jlc3BvbnNlKSkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gaWYgdGhlIG1lc3NhZ2UgaGFzIGEgdG9rZW4sIGl0IHdhcyBzZW50IGJ5IHRoZSB2aXNpdG9yLCBzbyBpZ25vcmUgaXRcblx0aWYgKG1lc3NhZ2UudG9rZW4pIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRSZXNwb25zZUJ5Um9vbUlkKHJvb20uX2lkLCB7XG5cdFx0XHR1c2VyOiB7XG5cdFx0XHRcdF9pZDogbWVzc2FnZS51Ll9pZCxcblx0XHRcdFx0dXNlcm5hbWU6IG1lc3NhZ2UudS51c2VybmFtZVxuXHRcdFx0fSxcblx0XHRcdHJlc3BvbnNlRGF0ZTogbm93LFxuXHRcdFx0cmVzcG9uc2VUaW1lOiAobm93LmdldFRpbWUoKSAtIHJvb20udHMpIC8gMTAwMFxuXHRcdH0pO1xuXHR9KTtcblxuXHRyZXR1cm4gbWVzc2FnZTtcbn0sIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ21hcmtSb29tUmVzcG9uZGVkJyk7XG4iLCJSb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2xpdmVjaGF0Lm9mZmxpbmVNZXNzYWdlJywgKGRhdGEpID0+IHtcblx0aWYgKCFSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfd2ViaG9va19vbl9vZmZsaW5lX21zZycpKSB7XG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHRjb25zdCBwb3N0RGF0YSA9IHtcblx0XHR0eXBlOiAnTGl2ZWNoYXRPZmZsaW5lTWVzc2FnZScsXG5cdFx0c2VudEF0OiBuZXcgRGF0ZSgpLFxuXHRcdHZpc2l0b3I6IHtcblx0XHRcdG5hbWU6IGRhdGEubmFtZSxcblx0XHRcdGVtYWlsOiBkYXRhLmVtYWlsXG5cdFx0fSxcblx0XHRtZXNzYWdlOiBkYXRhLm1lc3NhZ2Vcblx0fTtcblxuXHRSb2NrZXRDaGF0LkxpdmVjaGF0LnNlbmRSZXF1ZXN0KHBvc3REYXRhKTtcbn0sIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5Lk1FRElVTSwgJ2xpdmVjaGF0LXNlbmQtZW1haWwtb2ZmbGluZS1tZXNzYWdlJyk7XG4iLCJmdW5jdGlvbiBzZW5kVG9SRFN0YXRpb24ocm9vbSkge1xuXHRpZiAoIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9SRFN0YXRpb25fVG9rZW4nKSkge1xuXHRcdHJldHVybiByb29tO1xuXHR9XG5cblx0Y29uc3QgbGl2ZWNoYXREYXRhID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5nZXRMaXZlY2hhdFJvb21HdWVzdEluZm8ocm9vbSk7XG5cblx0aWYgKCFsaXZlY2hhdERhdGEudmlzaXRvci5lbWFpbCkge1xuXHRcdHJldHVybiByb29tO1xuXHR9XG5cblx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRoZWFkZXJzOiB7XG5cdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0fSxcblx0XHRkYXRhOiB7XG5cdFx0XHR0b2tlbl9yZHN0YXRpb246IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9SRFN0YXRpb25fVG9rZW4nKSxcblx0XHRcdGlkZW50aWZpY2Fkb3I6ICdyb2NrZXRjaGF0LWxpdmVjaGF0Jyxcblx0XHRcdGNsaWVudF9pZDogbGl2ZWNoYXREYXRhLnZpc2l0b3IuX2lkLFxuXHRcdFx0ZW1haWw6IGxpdmVjaGF0RGF0YS52aXNpdG9yLmVtYWlsXG5cdFx0fVxuXHR9O1xuXG5cdG9wdGlvbnMuZGF0YS5ub21lID0gbGl2ZWNoYXREYXRhLnZpc2l0b3IubmFtZSB8fCBsaXZlY2hhdERhdGEudmlzaXRvci51c2VybmFtZTtcblxuXHRpZiAobGl2ZWNoYXREYXRhLnZpc2l0b3IucGhvbmUpIHtcblx0XHRvcHRpb25zLmRhdGEudGVsZWZvbmUgPSBsaXZlY2hhdERhdGEudmlzaXRvci5waG9uZTtcblx0fVxuXG5cdGlmIChsaXZlY2hhdERhdGEudGFncykge1xuXHRcdG9wdGlvbnMuZGF0YS50YWdzID0gbGl2ZWNoYXREYXRhLnRhZ3M7XG5cdH1cblxuXHRPYmplY3Qua2V5cyhsaXZlY2hhdERhdGEuY3VzdG9tRmllbGRzIHx8IHt9KS5mb3JFYWNoKGZpZWxkID0+IHtcblx0XHRvcHRpb25zLmRhdGFbZmllbGRdID0gbGl2ZWNoYXREYXRhLmN1c3RvbUZpZWxkc1tmaWVsZF07XG5cdH0pO1xuXG5cdE9iamVjdC5rZXlzKGxpdmVjaGF0RGF0YS52aXNpdG9yLmN1c3RvbUZpZWxkcyB8fCB7fSkuZm9yRWFjaChmaWVsZCA9PiB7XG5cdFx0b3B0aW9ucy5kYXRhW2ZpZWxkXSA9IGxpdmVjaGF0RGF0YS52aXNpdG9yLmN1c3RvbUZpZWxkc1tmaWVsZF07XG5cdH0pO1xuXG5cdHRyeSB7XG5cdFx0SFRUUC5jYWxsKCdQT1NUJywgJ2h0dHBzOi8vd3d3LnJkc3RhdGlvbi5jb20uYnIvYXBpLzEuMy9jb252ZXJzaW9ucycsIG9wdGlvbnMpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0Y29uc29sZS5lcnJvcignRXJyb3Igc2VuZGluZyBsZWFkIHRvIFJEIFN0YXRpb24gLT4nLCBlKTtcblx0fVxuXG5cdHJldHVybiByb29tO1xufVxuXG5Sb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2xpdmVjaGF0LmNsb3NlUm9vbScsIHNlbmRUb1JEU3RhdGlvbiwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTUVESVVNLCAnbGl2ZWNoYXQtcmQtc3RhdGlvbi1jbG9zZS1yb29tJyk7XG5cblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnbGl2ZWNoYXQuc2F2ZUluZm8nLCBzZW5kVG9SRFN0YXRpb24sIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5Lk1FRElVTSwgJ2xpdmVjaGF0LXJkLXN0YXRpb24tc2F2ZS1pbmZvJyk7XG4iLCJmdW5jdGlvbiBzZW5kVG9DUk0oaG9vaywgcm9vbSkge1xuXHRpZiAoIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF93ZWJob29rX29uX2Nsb3NlJykpIHtcblx0XHRyZXR1cm4gcm9vbTtcblx0fVxuXG5cdC8vIERvIG5vdCBzZW5kIHRvIENSTSBpZiB0aGUgY2hhdCBpcyBzdGlsbCBvcGVuXG5cdGlmIChob29rID09PSAnc2F2ZUxpdmVjaGF0SW5mbycgJiYgcm9vbS5vcGVuKSB7XG5cdFx0cmV0dXJuIHJvb207XG5cdH1cblxuXHRjb25zdCBwb3N0RGF0YSA9IFJvY2tldENoYXQuTGl2ZWNoYXQuZ2V0TGl2ZWNoYXRSb29tR3Vlc3RJbmZvKHJvb20pO1xuXHRpZiAoaG9vayA9PT0gJ2Nsb3NlUm9vbScpIHtcblx0XHRwb3N0RGF0YS50eXBlID0gJ0xpdmVjaGF0U2Vzc2lvbic7XG5cdH0gZWxzZSBpZiAoaG9vayA9PT0gJ3NhdmVMaXZlY2hhdEluZm8nKSB7XG5cdFx0cG9zdERhdGEudHlwZSA9ICdMaXZlY2hhdEVkaXQnO1xuXHR9XG5cblx0cG9zdERhdGEubWVzc2FnZXMgPSBbXTtcblxuXHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kVmlzaWJsZUJ5Um9vbUlkKHJvb20uX2lkLCB7IHNvcnQ6IHsgdHM6IDEgfSB9KS5mb3JFYWNoKChtZXNzYWdlKSA9PiB7XG5cdFx0aWYgKG1lc3NhZ2UudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBtc2cgPSB7XG5cdFx0XHR1c2VybmFtZTogbWVzc2FnZS51LnVzZXJuYW1lLFxuXHRcdFx0bXNnOiBtZXNzYWdlLm1zZyxcblx0XHRcdHRzOiBtZXNzYWdlLnRzXG5cdFx0fTtcblxuXHRcdGlmIChtZXNzYWdlLnUudXNlcm5hbWUgIT09IHBvc3REYXRhLnZpc2l0b3IudXNlcm5hbWUpIHtcblx0XHRcdG1zZy5hZ2VudElkID0gbWVzc2FnZS51Ll9pZDtcblx0XHR9XG5cdFx0cG9zdERhdGEubWVzc2FnZXMucHVzaChtc2cpO1xuXHR9KTtcblxuXHRjb25zdCByZXNwb25zZSA9IFJvY2tldENoYXQuTGl2ZWNoYXQuc2VuZFJlcXVlc3QocG9zdERhdGEpO1xuXG5cdGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuZGF0YSkge1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnNhdmVDUk1EYXRhQnlSb29tSWQocm9vbS5faWQsIHJlc3BvbnNlLmRhdGEuZGF0YSk7XG5cdH1cblxuXHRyZXR1cm4gcm9vbTtcbn1cblxuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdsaXZlY2hhdC5jbG9zZVJvb20nLCAocm9vbSkgPT4ge1xuXHRyZXR1cm4gc2VuZFRvQ1JNKCdjbG9zZVJvb20nLCByb29tKTtcbn0sIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5Lk1FRElVTSwgJ2xpdmVjaGF0LXNlbmQtY3JtLWNsb3NlLXJvb20nKTtcblxuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdsaXZlY2hhdC5zYXZlSW5mbycsIChyb29tKSA9PiB7XG5cdHJldHVybiBzZW5kVG9DUk0oJ3NhdmVMaXZlY2hhdEluZm8nLCByb29tKTtcbn0sIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5Lk1FRElVTSwgJ2xpdmVjaGF0LXNlbmQtY3JtLXNhdmUtaW5mbycpO1xuIiwiaW1wb3J0IE9tbmlDaGFubmVsIGZyb20gJy4uL2xpYi9PbW5pQ2hhbm5lbCc7XG5cblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJTYXZlTWVzc2FnZScsIGZ1bmN0aW9uKG1lc3NhZ2UsIHJvb20pIHtcblx0Ly8gc2tpcHMgdGhpcyBjYWxsYmFjayBpZiB0aGUgbWVzc2FnZSB3YXMgZWRpdGVkXG5cdGlmIChtZXNzYWdlLmVkaXRlZEF0KSB7XG5cdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9GYWNlYm9va19FbmFibGVkJykgfHwgIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9GYWNlYm9va19BUElfS2V5JykpIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdC8vIG9ubHkgc2VuZCB0aGUgc21zIGJ5IFNNUyBpZiBpdCBpcyBhIGxpdmVjaGF0IHJvb20gd2l0aCBTTVMgc2V0IHRvIHRydWVcblx0aWYgKCEodHlwZW9mIHJvb20udCAhPT0gJ3VuZGVmaW5lZCcgJiYgcm9vbS50ID09PSAnbCcgJiYgcm9vbS5mYWNlYm9vayAmJiByb29tLnYgJiYgcm9vbS52LnRva2VuKSkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gaWYgdGhlIG1lc3NhZ2UgaGFzIGEgdG9rZW4sIGl0IHdhcyBzZW50IGZyb20gdGhlIHZpc2l0b3IsIHNvIGlnbm9yZSBpdFxuXHRpZiAobWVzc2FnZS50b2tlbikge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gaWYgdGhlIG1lc3NhZ2UgaGFzIGEgdHlwZSBtZWFucyBpdCBpcyBhIHNwZWNpYWwgbWVzc2FnZSAobGlrZSB0aGUgY2xvc2luZyBjb21tZW50KSwgc28gc2tpcHNcblx0aWYgKG1lc3NhZ2UudCkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0T21uaUNoYW5uZWwucmVwbHkoe1xuXHRcdHBhZ2U6IHJvb20uZmFjZWJvb2sucGFnZS5pZCxcblx0XHR0b2tlbjogcm9vbS52LnRva2VuLFxuXHRcdHRleHQ6IG1lc3NhZ2UubXNnXG5cdH0pO1xuXG5cdHJldHVybiBtZXNzYWdlO1xuXG59LCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1csICdzZW5kTWVzc2FnZVRvRmFjZWJvb2snKTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OmFkZEFnZW50Jyh1c2VybmFtZSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDphZGRBZ2VudCcgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuTGl2ZWNoYXQuYWRkQWdlbnQodXNlcm5hbWUpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OmFkZE1hbmFnZXInKHVzZXJuYW1lKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OmFkZE1hbmFnZXInIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkxpdmVjaGF0LmFkZE1hbmFnZXIodXNlcm5hbWUpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OmNoYW5nZUxpdmVjaGF0U3RhdHVzJygpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OmNoYW5nZUxpdmVjaGF0U3RhdHVzJyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCB1c2VyID0gTWV0ZW9yLnVzZXIoKTtcblxuXHRcdGNvbnN0IG5ld1N0YXR1cyA9IHVzZXIuc3RhdHVzTGl2ZWNoYXQgPT09ICdhdmFpbGFibGUnID8gJ25vdC1hdmFpbGFibGUnIDogJ2F2YWlsYWJsZSc7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0TGl2ZWNoYXRTdGF0dXModXNlci5faWQsIG5ld1N0YXR1cyk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6Y2xvc2VCeVZpc2l0b3InKHJvb21JZCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6Y2xvc2VCeVZpc2l0b3InIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lT3BlbkJ5VmlzaXRvcklkKE1ldGVvci51c2VySWQoKSwgcm9vbUlkKTtcblxuXHRcdGlmICghcm9vbSB8fCAhcm9vbS5vcGVuKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHRjb25zdCBsYW5ndWFnZSA9ICh1c2VyICYmIHVzZXIubGFuZ3VhZ2UpIHx8IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdsYW5ndWFnZScpIHx8ICdlbic7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5MaXZlY2hhdC5jbG9zZVJvb20oe1xuXHRcdFx0dXNlcixcblx0XHRcdHJvb20sXG5cdFx0XHRjb21tZW50OiBUQVBpMThuLl9fKCdDbG9zZWRfYnlfdmlzaXRvcicsIHsgbG5nOiBsYW5ndWFnZSB9KVxuXHRcdH0pO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OmNsb3NlUm9vbScocm9vbUlkLCBjb21tZW50KSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdjbG9zZS1saXZlY2hhdC1yb29tJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpjbG9zZVJvb20nIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChyb29tSWQpO1xuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHRpZiAocm9vbS51c2VybmFtZXMuaW5kZXhPZih1c2VyLnVzZXJuYW1lKSA9PT0gLTEgJiYgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdjbG9zZS1vdGhlcnMtbGl2ZWNoYXQtcm9vbScpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6Y2xvc2VSb29tJyB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5MaXZlY2hhdC5jbG9zZVJvb20oe1xuXHRcdFx0dXNlcixcblx0XHRcdHJvb20sXG5cdFx0XHRjb21tZW50XG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiaW1wb3J0IE9tbmlDaGFubmVsIGZyb20gJy4uL2xpYi9PbW5pQ2hhbm5lbCc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OmZhY2Vib29rJyhvcHRpb25zKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OmFkZEFnZW50JyB9KTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0c3dpdGNoIChvcHRpb25zLmFjdGlvbikge1xuXHRcdFx0XHRjYXNlICdpbml0aWFsU3RhdGUnOiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGVuYWJsZWQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9GYWNlYm9va19FbmFibGVkJyksXG5cdFx0XHRcdFx0XHRoYXNUb2tlbjogISFSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfRmFjZWJvb2tfQVBJX0tleScpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNhc2UgJ2VuYWJsZSc6IHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBPbW5pQ2hhbm5lbC5lbmFibGUoKTtcblxuXHRcdFx0XHRcdGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlQnlJZCgnTGl2ZWNoYXRfRmFjZWJvb2tfRW5hYmxlZCcsIHRydWUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y2FzZSAnZGlzYWJsZSc6IHtcblx0XHRcdFx0XHRPbW5pQ2hhbm5lbC5kaXNhYmxlKCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5zZXR0aW5ncy51cGRhdGVCeUlkKCdMaXZlY2hhdF9GYWNlYm9va19FbmFibGVkJywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y2FzZSAnbGlzdC1wYWdlcyc6IHtcblx0XHRcdFx0XHRyZXR1cm4gT21uaUNoYW5uZWwubGlzdFBhZ2VzKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjYXNlICdzdWJzY3JpYmUnOiB7XG5cdFx0XHRcdFx0cmV0dXJuIE9tbmlDaGFubmVsLnN1YnNjcmliZShvcHRpb25zLnBhZ2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y2FzZSAndW5zdWJzY3JpYmUnOiB7XG5cdFx0XHRcdFx0cmV0dXJuIE9tbmlDaGFubmVsLnVuc3Vic2NyaWJlKG9wdGlvbnMucGFnZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoZS5yZXNwb25zZSAmJiBlLnJlc3BvbnNlLmRhdGEgJiYgZS5yZXNwb25zZS5kYXRhLmVycm9yICYmIGUucmVzcG9uc2UuZGF0YS5lcnJvci5yZXNwb25zZSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnRlZ3JhdGlvbi1lcnJvcicsIGUucmVzcG9uc2UuZGF0YS5lcnJvci5yZXNwb25zZS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLnJlc3BvbnNlICYmIGUucmVzcG9uc2UuZGF0YSAmJiBlLnJlc3BvbnNlLmRhdGEuZXJyb3IgJiYgZS5yZXNwb25zZS5kYXRhLmVycm9yLm1lc3NhZ2UpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW50ZWdyYXRpb24tZXJyb3InLCBlLnJlc3BvbnNlLmRhdGEuZXJyb3IubWVzc2FnZSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciBjb250YWN0aW5nIG9tbmkucm9ja2V0LmNoYXQ6JywgZSk7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnRlZ3JhdGlvbi1lcnJvcicsIGUuZXJyb3IpO1xuXHRcdH1cblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpnZXRDdXN0b21GaWVsZHMnKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdEN1c3RvbUZpZWxkLmZpbmQoKS5mZXRjaCgpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OmdldEFnZW50RGF0YScocm9vbUlkKSB7XG5cdFx0Y2hlY2socm9vbUlkLCBTdHJpbmcpO1xuXG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJvb21JZCk7XG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHQvLyBhbGxvdyB0byBvbmx5IHVzZXIgdG8gc2VuZCB0cmFuc2NyaXB0cyBmcm9tIHRoZWlyIG93biBjaGF0c1xuXHRcdGlmICghcm9vbSB8fCByb29tLnQgIT09ICdsJyB8fCAhcm9vbS52IHx8ICF1c2VyLnByb2ZpbGUgfHwgcm9vbS52LnRva2VuICE9PSB1c2VyLnByb2ZpbGUudG9rZW4pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtcm9vbScsICdJbnZhbGlkIHJvb20nKTtcblx0XHR9XG5cblx0XHRpZiAoIXJvb20uc2VydmVkQnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZ2V0QWdlbnRJbmZvKHJvb20uc2VydmVkQnkuX2lkKTtcblx0fVxufSk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6Z2V0SW5pdGlhbERhdGEnKHZpc2l0b3JUb2tlbikge1xuXHRcdGNvbnN0IGluZm8gPSB7XG5cdFx0XHRlbmFibGVkOiBudWxsLFxuXHRcdFx0dGl0bGU6IG51bGwsXG5cdFx0XHRjb2xvcjogbnVsbCxcblx0XHRcdHJlZ2lzdHJhdGlvbkZvcm06IG51bGwsXG5cdFx0XHRyb29tOiBudWxsLFxuXHRcdFx0dHJpZ2dlcnM6IFtdLFxuXHRcdFx0ZGVwYXJ0bWVudHM6IFtdLFxuXHRcdFx0YWxsb3dTd2l0Y2hpbmdEZXBhcnRtZW50czogbnVsbCxcblx0XHRcdG9ubGluZTogdHJ1ZSxcblx0XHRcdG9mZmxpbmVDb2xvcjogbnVsbCxcblx0XHRcdG9mZmxpbmVNZXNzYWdlOiBudWxsLFxuXHRcdFx0b2ZmbGluZVN1Y2Nlc3NNZXNzYWdlOiBudWxsLFxuXHRcdFx0b2ZmbGluZVVuYXZhaWxhYmxlTWVzc2FnZTogbnVsbCxcblx0XHRcdGRpc3BsYXlPZmZsaW5lRm9ybTogbnVsbCxcblx0XHRcdHZpZGVvQ2FsbDogbnVsbFxuXHRcdH07XG5cblx0XHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9wZW5CeVZpc2l0b3JUb2tlbih2aXNpdG9yVG9rZW4sIHtcblx0XHRcdGZpZWxkczoge1xuXHRcdFx0XHRuYW1lOiAxLFxuXHRcdFx0XHR0OiAxLFxuXHRcdFx0XHRjbDogMSxcblx0XHRcdFx0dTogMSxcblx0XHRcdFx0dXNlcm5hbWVzOiAxLFxuXHRcdFx0XHR2OiAxLFxuXHRcdFx0XHRzZXJ2ZWRCeTogMVxuXHRcdFx0fVxuXHRcdH0pLmZldGNoKCk7XG5cblx0XHRpZiAocm9vbSAmJiByb29tLmxlbmd0aCA+IDApIHtcblx0XHRcdGluZm8ucm9vbSA9IHJvb21bMF07XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5pdFNldHRpbmdzID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5nZXRJbml0U2V0dGluZ3MoKTtcblxuXHRcdGluZm8udGl0bGUgPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfdGl0bGU7XG5cdFx0aW5mby5jb2xvciA9IGluaXRTZXR0aW5ncy5MaXZlY2hhdF90aXRsZV9jb2xvcjtcblx0XHRpbmZvLmVuYWJsZWQgPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfZW5hYmxlZDtcblx0XHRpbmZvLnJlZ2lzdHJhdGlvbkZvcm0gPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfcmVnaXN0cmF0aW9uX2Zvcm07XG5cdFx0aW5mby5vZmZsaW5lVGl0bGUgPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfb2ZmbGluZV90aXRsZTtcblx0XHRpbmZvLm9mZmxpbmVDb2xvciA9IGluaXRTZXR0aW5ncy5MaXZlY2hhdF9vZmZsaW5lX3RpdGxlX2NvbG9yO1xuXHRcdGluZm8ub2ZmbGluZU1lc3NhZ2UgPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfb2ZmbGluZV9tZXNzYWdlO1xuXHRcdGluZm8ub2ZmbGluZVN1Y2Nlc3NNZXNzYWdlID0gaW5pdFNldHRpbmdzLkxpdmVjaGF0X29mZmxpbmVfc3VjY2Vzc19tZXNzYWdlO1xuXHRcdGluZm8ub2ZmbGluZVVuYXZhaWxhYmxlTWVzc2FnZSA9IGluaXRTZXR0aW5ncy5MaXZlY2hhdF9vZmZsaW5lX2Zvcm1fdW5hdmFpbGFibGU7XG5cdFx0aW5mby5kaXNwbGF5T2ZmbGluZUZvcm0gPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfZGlzcGxheV9vZmZsaW5lX2Zvcm07XG5cdFx0aW5mby5sYW5ndWFnZSA9IGluaXRTZXR0aW5ncy5MYW5ndWFnZTtcblx0XHRpbmZvLnZpZGVvQ2FsbCA9IGluaXRTZXR0aW5ncy5MaXZlY2hhdF92aWRlb2NhbGxfZW5hYmxlZCA9PT0gdHJ1ZSAmJiBpbml0U2V0dGluZ3MuSml0c2lfRW5hYmxlZCA9PT0gdHJ1ZTtcblx0XHRpbmZvLnRyYW5zY3JpcHQgPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfZW5hYmxlX3RyYW5zY3JpcHQ7XG5cdFx0aW5mby50cmFuc2NyaXB0TWVzc2FnZSA9IGluaXRTZXR0aW5ncy5MaXZlY2hhdF90cmFuc2NyaXB0X21lc3NhZ2U7XG5cblx0XHRpbmZvLmFnZW50RGF0YSA9IHJvb20gJiYgcm9vbVswXSAmJiByb29tWzBdLnNlcnZlZEJ5ICYmIFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldEFnZW50SW5mbyhyb29tWzBdLnNlcnZlZEJ5Ll9pZCk7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdFRyaWdnZXIuZmluZEVuYWJsZWQoKS5mb3JFYWNoKCh0cmlnZ2VyKSA9PiB7XG5cdFx0XHRpbmZvLnRyaWdnZXJzLnB1c2goXy5waWNrKHRyaWdnZXIsICdfaWQnLCAnYWN0aW9ucycsICdjb25kaXRpb25zJykpO1xuXHRcdH0pO1xuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50LmZpbmRFbmFibGVkV2l0aEFnZW50cygpLmZvckVhY2goKGRlcGFydG1lbnQpID0+IHtcblx0XHRcdGluZm8uZGVwYXJ0bWVudHMucHVzaChkZXBhcnRtZW50KTtcblx0XHR9KTtcblx0XHRpbmZvLmFsbG93U3dpdGNoaW5nRGVwYXJ0bWVudHMgPSBpbml0U2V0dGluZ3MuTGl2ZWNoYXRfYWxsb3dfc3dpdGNoaW5nX2RlcGFydG1lbnRzO1xuXG5cdFx0aW5mby5vbmxpbmUgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25saW5lQWdlbnRzKCkuY291bnQoKSA+IDA7XG5cblx0XHRyZXR1cm4gaW5mbztcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpsb2dpbkJ5VG9rZW4nKHRva2VuKSB7XG5cdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldFZpc2l0b3JCeVRva2VuKHRva2VuLCB7IGZpZWxkczogeyBfaWQ6IDEgfSB9KTtcblxuXHRcdGlmICghdXNlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YW1wZWRUb2tlbiA9IEFjY291bnRzLl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuKCk7XG5cdFx0Y29uc3QgaGFzaFN0YW1wZWRUb2tlbiA9IEFjY291bnRzLl9oYXNoU3RhbXBlZFRva2VuKHN0YW1wZWRUb2tlbik7XG5cblx0XHRjb25zdCB1cGRhdGVVc2VyID0ge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRzZXJ2aWNlczoge1xuXHRcdFx0XHRcdHJlc3VtZToge1xuXHRcdFx0XHRcdFx0bG9naW5Ub2tlbnM6IFsgaGFzaFN0YW1wZWRUb2tlbiBdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdE1ldGVvci51c2Vycy51cGRhdGUodXNlci5faWQsIHVwZGF0ZVVzZXIpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHRva2VuOiBzdGFtcGVkVG9rZW4udG9rZW5cblx0XHR9O1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnBhZ2VWaXNpdGVkJyh0b2tlbiwgcGFnZUluZm8pIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5MaXZlY2hhdC5zYXZlUGFnZUhpc3RvcnkodG9rZW4sIHBhZ2VJbmZvKTtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpyZWdpc3Rlckd1ZXN0Jyh7IHRva2VuLCBuYW1lLCBlbWFpbCwgZGVwYXJ0bWVudCB9ID0ge30pIHtcblx0XHRjb25zdCBzdGFtcGVkVG9rZW4gPSBBY2NvdW50cy5fZ2VuZXJhdGVTdGFtcGVkTG9naW5Ub2tlbigpO1xuXHRcdGNvbnN0IGhhc2hTdGFtcGVkVG9rZW4gPSBBY2NvdW50cy5faGFzaFN0YW1wZWRUb2tlbihzdGFtcGVkVG9rZW4pO1xuXG5cdFx0Y29uc3QgdXNlcklkID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5yZWdpc3Rlckd1ZXN0LmNhbGwodGhpcywge1xuXHRcdFx0dG9rZW4sXG5cdFx0XHRuYW1lLFxuXHRcdFx0ZW1haWwsXG5cdFx0XHRkZXBhcnRtZW50LFxuXHRcdFx0bG9naW5Ub2tlbjogaGFzaFN0YW1wZWRUb2tlblxuXHRcdH0pO1xuXG5cdFx0Ly8gdXBkYXRlIHZpc2l0ZWQgcGFnZSBoaXN0b3J5IHRvIG5vdCBleHBpcmVcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdFBhZ2VWaXNpdGVkLmtlZXBIaXN0b3J5Rm9yVG9rZW4odG9rZW4pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHVzZXJJZCxcblx0XHRcdHRva2VuOiBzdGFtcGVkVG9rZW4udG9rZW5cblx0XHR9O1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnJlbW92ZUFnZW50Jyh1c2VybmFtZSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpyZW1vdmVBZ2VudCcgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuTGl2ZWNoYXQucmVtb3ZlQWdlbnQodXNlcm5hbWUpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnJlbW92ZUN1c3RvbUZpZWxkJyhfaWQpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6cmVtb3ZlQ3VzdG9tRmllbGQnIH0pO1xuXHRcdH1cblxuXHRcdGNoZWNrKF9pZCwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IGN1c3RvbUZpZWxkID0gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRDdXN0b21GaWVsZC5maW5kT25lQnlJZChfaWQsIHsgZmllbGRzOiB7IF9pZDogMSB9IH0pO1xuXG5cdFx0aWYgKCFjdXN0b21GaWVsZCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1jdXN0b20tZmllbGQnLCAnQ3VzdG9tIGZpZWxkIG5vdCBmb3VuZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6cmVtb3ZlQ3VzdG9tRmllbGQnIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdEN1c3RvbUZpZWxkLnJlbW92ZUJ5SWQoX2lkKTtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpyZW1vdmVEZXBhcnRtZW50JyhfaWQpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6cmVtb3ZlRGVwYXJ0bWVudCcgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuTGl2ZWNoYXQucmVtb3ZlRGVwYXJ0bWVudChfaWQpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnJlbW92ZU1hbmFnZXInKHVzZXJuYW1lKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnJlbW92ZU1hbmFnZXInIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkxpdmVjaGF0LnJlbW92ZU1hbmFnZXIodXNlcm5hbWUpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnJlbW92ZVRyaWdnZXInKHRyaWdnZXJJZCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpyZW1vdmVUcmlnZ2VyJyB9KTtcblx0XHR9XG5cblx0XHRjaGVjayh0cmlnZ2VySWQsIFN0cmluZyk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRUcmlnZ2VyLnJlbW92ZUJ5SWQodHJpZ2dlcklkKTtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpzYXZlQXBwZWFyYW5jZScoc2V0dGluZ3MpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6c2F2ZUFwcGVhcmFuY2UnIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZhbGlkU2V0dGluZ3MgPSBbXG5cdFx0XHQnTGl2ZWNoYXRfdGl0bGUnLFxuXHRcdFx0J0xpdmVjaGF0X3RpdGxlX2NvbG9yJyxcblx0XHRcdCdMaXZlY2hhdF9zaG93X2FnZW50X2VtYWlsJyxcblx0XHRcdCdMaXZlY2hhdF9kaXNwbGF5X29mZmxpbmVfZm9ybScsXG5cdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV9mb3JtX3VuYXZhaWxhYmxlJyxcblx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX21lc3NhZ2UnLFxuXHRcdFx0J0xpdmVjaGF0X29mZmxpbmVfc3VjY2Vzc19tZXNzYWdlJyxcblx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX3RpdGxlJyxcblx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX3RpdGxlX2NvbG9yJyxcblx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX2VtYWlsJ1xuXHRcdF07XG5cblx0XHRjb25zdCB2YWxpZCA9IHNldHRpbmdzLmV2ZXJ5KChzZXR0aW5nKSA9PiB7XG5cdFx0XHRyZXR1cm4gdmFsaWRTZXR0aW5ncy5pbmRleE9mKHNldHRpbmcuX2lkKSAhPT0gLTE7XG5cdFx0fSk7XG5cblx0XHRpZiAoIXZhbGlkKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLXNldHRpbmcnKTtcblx0XHR9XG5cblx0XHRzZXR0aW5ncy5mb3JFYWNoKChzZXR0aW5nKSA9PiB7XG5cdFx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLnVwZGF0ZUJ5SWQoc2V0dGluZy5faWQsIHNldHRpbmcudmFsdWUpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuO1xuXHR9XG59KTtcbiIsIi8qIGVzbGludCBuZXctY2FwOiBbMiwge1wiY2FwSXNOZXdFeGNlcHRpb25zXCI6IFtcIk1hdGNoLk9iamVjdEluY2x1ZGluZ1wiLCBcIk1hdGNoLk9wdGlvbmFsXCJdfV0gKi9cblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2F2ZUN1c3RvbUZpZWxkJyhfaWQsIGN1c3RvbUZpZWxkRGF0YSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzYXZlQ3VzdG9tRmllbGQnIH0pO1xuXHRcdH1cblxuXHRcdGlmIChfaWQpIHtcblx0XHRcdGNoZWNrKF9pZCwgU3RyaW5nKTtcblx0XHR9XG5cblx0XHRjaGVjayhjdXN0b21GaWVsZERhdGEsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7IGZpZWxkOiBTdHJpbmcsIGxhYmVsOiBTdHJpbmcsIHNjb3BlOiBTdHJpbmcsIHZpc2liaWxpdHk6IFN0cmluZyB9KSk7XG5cblx0XHRpZiAoIS9eWzAtOWEtekEtWi1fXSskLy50ZXN0KGN1c3RvbUZpZWxkRGF0YS5maWVsZCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtY3VzdG9tLWZpZWxkLW5tYWUnLCAnSW52YWxpZCBjdXN0b20gZmllbGQgbmFtZS4gVXNlIG9ubHkgbGV0dGVycywgbnVtYmVycywgaHlwaGVucyBhbmQgdW5kZXJzY29yZXMuJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzYXZlQ3VzdG9tRmllbGQnIH0pO1xuXHRcdH1cblxuXHRcdGlmIChfaWQpIHtcblx0XHRcdGNvbnN0IGN1c3RvbUZpZWxkID0gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRDdXN0b21GaWVsZC5maW5kT25lQnlJZChfaWQpO1xuXHRcdFx0aWYgKCFjdXN0b21GaWVsZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWN1c3RvbS1maWVsZCcsICdDdXN0b20gRmllbGQgTm90IGZvdW5kJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzYXZlQ3VzdG9tRmllbGQnIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdEN1c3RvbUZpZWxkLmNyZWF0ZU9yVXBkYXRlQ3VzdG9tRmllbGQoX2lkLCBjdXN0b21GaWVsZERhdGEuZmllbGQsIGN1c3RvbUZpZWxkRGF0YS5sYWJlbCwgY3VzdG9tRmllbGREYXRhLnNjb3BlLCBjdXN0b21GaWVsZERhdGEudmlzaWJpbGl0eSk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2F2ZURlcGFydG1lbnQnKF9pZCwgZGVwYXJ0bWVudERhdGEsIGRlcGFydG1lbnRBZ2VudHMpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6c2F2ZURlcGFydG1lbnQnIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LkxpdmVjaGF0LnNhdmVEZXBhcnRtZW50KF9pZCwgZGVwYXJ0bWVudERhdGEsIGRlcGFydG1lbnRBZ2VudHMpO1xuXHR9XG59KTtcbiIsIi8qIGVzbGludCBuZXctY2FwOiBbMiwge1wiY2FwSXNOZXdFeGNlcHRpb25zXCI6IFtcIk1hdGNoLk9iamVjdEluY2x1ZGluZ1wiLCBcIk1hdGNoLk9wdGlvbmFsXCJdfV0gKi9cblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2F2ZUluZm8nKGd1ZXN0RGF0YSwgcm9vbURhdGEpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3ZpZXctbC1yb29tJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzYXZlSW5mbycgfSk7XG5cdFx0fVxuXG5cdFx0Y2hlY2soZ3Vlc3REYXRhLCBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0X2lkOiBTdHJpbmcsXG5cdFx0XHRuYW1lOiBNYXRjaC5PcHRpb25hbChTdHJpbmcpLFxuXHRcdFx0ZW1haWw6IE1hdGNoLk9wdGlvbmFsKFN0cmluZyksXG5cdFx0XHRwaG9uZTogTWF0Y2guT3B0aW9uYWwoU3RyaW5nKVxuXHRcdH0pKTtcblxuXHRcdGNoZWNrKHJvb21EYXRhLCBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0X2lkOiBTdHJpbmcsXG5cdFx0XHR0b3BpYzogTWF0Y2guT3B0aW9uYWwoU3RyaW5nKSxcblx0XHRcdHRhZ3M6IE1hdGNoLk9wdGlvbmFsKFN0cmluZylcblx0XHR9KSk7XG5cblx0XHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQocm9vbURhdGEuX2lkLCB7ZmllbGRzOiB7dDogMSwgc2VydmVkQnk6IDF9fSk7XG5cblx0XHRpZiAocm9vbSA9PSBudWxsIHx8IHJvb20udCAhPT0gJ2wnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXJvb20nLCAnSW52YWxpZCByb29tJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzYXZlSW5mbycgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCghcm9vbS5zZXJ2ZWRCeSB8fCByb29tLnNlcnZlZEJ5Ll9pZCAhPT0gTWV0ZW9yLnVzZXJJZCgpKSAmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3NhdmUtb3RoZXJzLWxpdmVjaGF0LXJvb20taW5mbycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6c2F2ZUluZm8nIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJldCA9IFJvY2tldENoYXQuTGl2ZWNoYXQuc2F2ZUd1ZXN0KGd1ZXN0RGF0YSkgJiYgUm9ja2V0Q2hhdC5MaXZlY2hhdC5zYXZlUm9vbUluZm8ocm9vbURhdGEsIGd1ZXN0RGF0YSk7XG5cblx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0Um9ja2V0Q2hhdC5jYWxsYmFja3MucnVuKCdsaXZlY2hhdC5zYXZlSW5mbycsIFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJvb21EYXRhLl9pZCkpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJldDtcblx0fVxufSk7XG4iLCJpbXBvcnQgcyBmcm9tICd1bmRlcnNjb3JlLnN0cmluZyc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnNhdmVJbnRlZ3JhdGlvbicodmFsdWVzKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnNhdmVJbnRlZ3JhdGlvbicgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB2YWx1ZXNbJ0xpdmVjaGF0X3dlYmhvb2tVcmwnXSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlQnlJZCgnTGl2ZWNoYXRfd2ViaG9va1VybCcsIHMudHJpbSh2YWx1ZXNbJ0xpdmVjaGF0X3dlYmhvb2tVcmwnXSkpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgdmFsdWVzWydMaXZlY2hhdF9zZWNyZXRfdG9rZW4nXSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlQnlJZCgnTGl2ZWNoYXRfc2VjcmV0X3Rva2VuJywgcy50cmltKHZhbHVlc1snTGl2ZWNoYXRfc2VjcmV0X3Rva2VuJ10pKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHZhbHVlc1snTGl2ZWNoYXRfd2ViaG9va19vbl9jbG9zZSddICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy51cGRhdGVCeUlkKCdMaXZlY2hhdF93ZWJob29rX29uX2Nsb3NlJywgISF2YWx1ZXNbJ0xpdmVjaGF0X3dlYmhvb2tfb25fY2xvc2UnXSk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB2YWx1ZXNbJ0xpdmVjaGF0X3dlYmhvb2tfb25fb2ZmbGluZV9tc2cnXSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlQnlJZCgnTGl2ZWNoYXRfd2ViaG9va19vbl9vZmZsaW5lX21zZycsICEhdmFsdWVzWydMaXZlY2hhdF93ZWJob29rX29uX29mZmxpbmVfbXNnJ10pO1xuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fVxufSk7XG4iLCIvKiBlc2xpbnQgbmV3LWNhcDogWzIsIHtcImNhcElzTmV3RXhjZXB0aW9uc1wiOiBbXCJNYXRjaC5PYmplY3RJbmNsdWRpbmdcIl19XSAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnNhdmVTdXJ2ZXlGZWVkYmFjaycodmlzaXRvclRva2VuLCB2aXNpdG9yUm9vbSwgZm9ybURhdGEpIHtcblx0XHRjaGVjayh2aXNpdG9yVG9rZW4sIFN0cmluZyk7XG5cdFx0Y2hlY2sodmlzaXRvclJvb20sIFN0cmluZyk7XG5cdFx0Y2hlY2soZm9ybURhdGEsIFtNYXRjaC5PYmplY3RJbmNsdWRpbmcoeyBuYW1lOiBTdHJpbmcsIHZhbHVlOiBTdHJpbmcgfSldKTtcblxuXHRcdGNvbnN0IHZpc2l0b3IgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXRWaXNpdG9yQnlUb2tlbih2aXNpdG9yVG9rZW4pO1xuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZCh2aXNpdG9yUm9vbSk7XG5cblx0XHRpZiAodmlzaXRvciAhPT0gdW5kZWZpbmVkICYmIHJvb20gIT09IHVuZGVmaW5lZCAmJiByb29tLnYgIT09IHVuZGVmaW5lZCAmJiB2aXNpdG9yLnByb2ZpbGUgIT09IHVuZGVmaW5lZCAmJiByb29tLnYudG9rZW4gPT09IHZpc2l0b3IucHJvZmlsZS50b2tlbikge1xuXHRcdFx0Y29uc3QgdXBkYXRlRGF0YSA9IHt9O1xuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIGZvcm1EYXRhKSB7XG5cdFx0XHRcdGlmIChfLmNvbnRhaW5zKFsnc2F0aXNmYWN0aW9uJywgJ2FnZW50S25vd2xlZGdlJywgJ2FnZW50UmVzcG9zaXZlbmVzcycsICdhZ2VudEZyaWVuZGxpbmVzcyddLCBpdGVtLm5hbWUpICYmIF8uY29udGFpbnMoWycxJywgJzInLCAnMycsICc0JywgJzUnXSwgaXRlbS52YWx1ZSkpIHtcblx0XHRcdFx0XHR1cGRhdGVEYXRhW2l0ZW0ubmFtZV0gPSBpdGVtLnZhbHVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGl0ZW0ubmFtZSA9PT0gJ2FkZGl0aW9uYWxGZWVkYmFjaycpIHtcblx0XHRcdFx0XHR1cGRhdGVEYXRhW2l0ZW0ubmFtZV0gPSBpdGVtLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIV8uaXNFbXB0eSh1cGRhdGVEYXRhKSkge1xuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudXBkYXRlU3VydmV5RmVlZGJhY2tCeUlkKHJvb20uX2lkLCB1cGRhdGVEYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2F2ZVRyaWdnZXInKHRyaWdnZXIpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSB8fCAhUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6c2F2ZVRyaWdnZXInIH0pO1xuXHRcdH1cblxuXHRcdGNoZWNrKHRyaWdnZXIsIHtcblx0XHRcdF9pZDogTWF0Y2guTWF5YmUoU3RyaW5nKSxcblx0XHRcdG5hbWU6IFN0cmluZyxcblx0XHRcdGRlc2NyaXB0aW9uOiBTdHJpbmcsXG5cdFx0XHRlbmFibGVkOiBCb29sZWFuLFxuXHRcdFx0Y29uZGl0aW9uczogQXJyYXksXG5cdFx0XHRhY3Rpb25zOiBBcnJheVxuXHRcdH0pO1xuXG5cdFx0aWYgKHRyaWdnZXIuX2lkKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRUcmlnZ2VyLnVwZGF0ZUJ5SWQodHJpZ2dlci5faWQsIHRyaWdnZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRUcmlnZ2VyLmluc2VydCh0cmlnZ2VyKTtcblx0XHR9XG5cdH1cbn0pO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnNlYXJjaEFnZW50Jyh1c2VybmFtZSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ05vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzZWFyY2hBZ2VudCcgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCF1c2VybmFtZSB8fCAhXy5pc1N0cmluZyh1c2VybmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtYXJndW1lbnRzJywgJ0ludmFsaWQgYXJndW1lbnRzJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpzZWFyY2hBZ2VudCcgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeVVzZXJuYW1lKHVzZXJuYW1lLCB7IGZpZWxkczogeyBfaWQ6IDEsIHVzZXJuYW1lOiAxIH0gfSk7XG5cblx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnNlYXJjaEFnZW50JyB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdXNlcjtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdHNlbmRNZXNzYWdlTGl2ZWNoYXQobWVzc2FnZSkge1xuXHRcdGNoZWNrKG1lc3NhZ2UucmlkLCBTdHJpbmcpO1xuXHRcdGNoZWNrKG1lc3NhZ2UudG9rZW4sIFN0cmluZyk7XG5cblx0XHRjb25zdCBndWVzdCA9IE1ldGVvci51c2Vycy5maW5kT25lKE1ldGVvci51c2VySWQoKSwge1xuXHRcdFx0ZmllbGRzOiB7XG5cdFx0XHRcdG5hbWU6IDEsXG5cdFx0XHRcdHVzZXJuYW1lOiAxLFxuXHRcdFx0XHRkZXBhcnRtZW50OiAxXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5MaXZlY2hhdC5zZW5kTWVzc2FnZSh7IGd1ZXN0LCBtZXNzYWdlIH0pO1xuXHR9XG59KTtcbiIsIi8qIGdsb2JhbHMgRERQUmF0ZUxpbWl0ZXIgKi9cbmNvbnN0IGRucyA9IE5wbS5yZXF1aXJlKCdkbnMnKTtcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2VuZE9mZmxpbmVNZXNzYWdlJyhkYXRhKSB7XG5cdFx0Y2hlY2soZGF0YSwge1xuXHRcdFx0bmFtZTogU3RyaW5nLFxuXHRcdFx0ZW1haWw6IFN0cmluZyxcblx0XHRcdG1lc3NhZ2U6IFN0cmluZ1xuXHRcdH0pO1xuXG5cdFx0aWYgKCFSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfZGlzcGxheV9vZmZsaW5lX2Zvcm0nKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlciA9IFJvY2tldENoYXQucGxhY2Vob2xkZXJzLnJlcGxhY2UoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0VtYWlsX0hlYWRlcicpIHx8ICcnKTtcblx0XHRjb25zdCBmb290ZXIgPSBSb2NrZXRDaGF0LnBsYWNlaG9sZGVycy5yZXBsYWNlKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdFbWFpbF9Gb290ZXInKSB8fCAnJyk7XG5cblx0XHRjb25zdCBtZXNzYWdlID0gKGAkeyBkYXRhLm1lc3NhZ2UgfWApLnJlcGxhY2UoLyhbXj5cXHJcXG5dPykoXFxyXFxufFxcblxccnxcXHJ8XFxuKS9nLCAnJDEnICsgJzxicj4nICsgJyQyJyk7XG5cblx0XHRjb25zdCBodG1sID0gYFxuXHRcdFx0PGgxPk5ldyBsaXZlY2hhdCBtZXNzYWdlPC9oMT5cblx0XHRcdDxwPjxzdHJvbmc+VmlzaXRvciBuYW1lOjwvc3Ryb25nPiAkeyBkYXRhLm5hbWUgfTwvcD5cblx0XHRcdDxwPjxzdHJvbmc+VmlzaXRvciBlbWFpbDo8L3N0cm9uZz4gJHsgZGF0YS5lbWFpbCB9PC9wPlxuXHRcdFx0PHA+PHN0cm9uZz5NZXNzYWdlOjwvc3Ryb25nPjxicj4keyBtZXNzYWdlIH08L3A+YDtcblxuXHRcdGxldCBmcm9tRW1haWwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRnJvbV9FbWFpbCcpLm1hdGNoKC9cXGJbQS1aMC05Ll8lKy1dK0AoPzpbQS1aMC05LV0rXFwuKStbQS1aXXsyLDR9XFxiL2kpO1xuXG5cdFx0aWYgKGZyb21FbWFpbCkge1xuXHRcdFx0ZnJvbUVtYWlsID0gZnJvbUVtYWlsWzBdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmcm9tRW1haWwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRnJvbV9FbWFpbCcpO1xuXHRcdH1cblxuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfdmFsaWRhdGVfb2ZmbGluZV9lbWFpbCcpKSB7XG5cdFx0XHRjb25zdCBlbWFpbERvbWFpbiA9IGRhdGEuZW1haWwuc3Vic3RyKGRhdGEuZW1haWwubGFzdEluZGV4T2YoJ0AnKSArIDEpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRNZXRlb3Iud3JhcEFzeW5jKGRucy5yZXNvbHZlTXgpKGVtYWlsRG9tYWluKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1lbWFpbC1hZGRyZXNzJywgJ0ludmFsaWQgZW1haWwgYWRkcmVzcycsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6c2VuZE9mZmxpbmVNZXNzYWdlJyB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0RW1haWwuc2VuZCh7XG5cdFx0XHRcdHRvOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfb2ZmbGluZV9lbWFpbCcpLFxuXHRcdFx0XHRmcm9tOiBgJHsgZGF0YS5uYW1lIH0gLSAkeyBkYXRhLmVtYWlsIH0gPCR7IGZyb21FbWFpbCB9PmAsXG5cdFx0XHRcdHJlcGx5VG86IGAkeyBkYXRhLm5hbWUgfSA8JHsgZGF0YS5lbWFpbCB9PmAsXG5cdFx0XHRcdHN1YmplY3Q6IGBMaXZlY2hhdCBvZmZsaW5lIG1lc3NhZ2UgZnJvbSAkeyBkYXRhLm5hbWUgfTogJHsgKGAkeyBkYXRhLm1lc3NhZ2UgfWApLnN1YnN0cmluZygwLCAyMCkgfWAsXG5cdFx0XHRcdGh0bWw6IGhlYWRlciArIGh0bWwgKyBmb290ZXJcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0TWV0ZW9yLmRlZmVyKCgpID0+IHtcblx0XHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignbGl2ZWNoYXQub2ZmbGluZU1lc3NhZ2UnLCBkYXRhKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59KTtcblxuRERQUmF0ZUxpbWl0ZXIuYWRkUnVsZSh7XG5cdHR5cGU6ICdtZXRob2QnLFxuXHRuYW1lOiAnbGl2ZWNoYXQ6c2VuZE9mZmxpbmVNZXNzYWdlJyxcblx0Y29ubmVjdGlvbklkKCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59LCAxLCA1MDAwKTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OnNldEN1c3RvbUZpZWxkJyh0b2tlbiwga2V5LCB2YWx1ZSwgb3ZlcndyaXRlID0gdHJ1ZSkge1xuXHRcdGNvbnN0IGN1c3RvbUZpZWxkID0gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRDdXN0b21GaWVsZC5maW5kT25lQnlJZChrZXkpO1xuXHRcdGlmIChjdXN0b21GaWVsZCkge1xuXHRcdFx0aWYgKGN1c3RvbUZpZWxkLnNjb3BlID09PSAncm9vbScpIHtcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlJvb21zLnVwZGF0ZUxpdmVjaGF0RGF0YUJ5VG9rZW4odG9rZW4sIGtleSwgdmFsdWUsIG92ZXJ3cml0ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBTYXZlIGluIHVzZXJcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZUxpdmVjaGF0RGF0YUJ5VG9rZW4odG9rZW4sIGtleSwgdmFsdWUsIG92ZXJ3cml0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2V0RGVwYXJ0bWVudEZvclZpc2l0b3InKHsgdG9rZW4sIGRlcGFydG1lbnQgfSA9IHt9KSB7XG5cdFx0Um9ja2V0Q2hhdC5MaXZlY2hhdC5zZXREZXBhcnRtZW50Rm9yR3Vlc3QuY2FsbCh0aGlzLCB7XG5cdFx0XHR0b2tlbixcblx0XHRcdGRlcGFydG1lbnRcblx0XHR9KTtcblxuXHRcdC8vIHVwZGF0ZSB2aXNpdGVkIHBhZ2UgaGlzdG9yeSB0byBub3QgZXhwaXJlXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRQYWdlVmlzaXRlZC5rZWVwSGlzdG9yeUZvclRva2VuKHRva2VuKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59KTtcbiIsIi8qIGVzbGludCBuZXctY2FwOiBbMiwge1wiY2FwSXNOZXdFeGNlcHRpb25zXCI6IFtcIk1ENVwiXX1dICovXG5NZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpzdGFydFZpZGVvQ2FsbCcocm9vbUlkKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBtZXRob2Q6ICdsaXZlY2hhdDpjbG9zZUJ5VmlzaXRvcicgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ3Vlc3QgPSBNZXRlb3IudXNlcigpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZSA9IHtcblx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRyaWQ6IHJvb21JZCB8fCBSYW5kb20uaWQoKSxcblx0XHRcdG1zZzogJycsXG5cdFx0XHR0czogbmV3IERhdGUoKVxuXHRcdH07XG5cblx0XHRjb25zdCB7IHJvb20gfSA9IFJvY2tldENoYXQuTGl2ZWNoYXQuZ2V0Um9vbShndWVzdCwgbWVzc2FnZSwgeyBqaXRzaVRpbWVvdXQ6IG5ldyBEYXRlKERhdGUubm93KCkgKyAzNjAwICogMTAwMCkgfSk7XG5cdFx0bWVzc2FnZS5yaWQgPSByb29tLl9pZDtcblxuXHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ2xpdmVjaGF0X3ZpZGVvX2NhbGwnLCByb29tLl9pZCwgJycsIGd1ZXN0LCB7XG5cdFx0XHRhY3Rpb25MaW5rczogW1xuXHRcdFx0XHR7IGljb246ICdpY29uLXZpZGVvY2FtJywgaTE4bkxhYmVsOiAnQWNjZXB0JywgbWV0aG9kX2lkOiAnY3JlYXRlTGl2ZWNoYXRDYWxsJywgcGFyYW1zOiAnJyB9LFxuXHRcdFx0XHR7IGljb246ICdpY29uLWNhbmNlbCcsIGkxOG5MYWJlbDogJ0RlY2xpbmUnLCBtZXRob2RfaWQ6ICdkZW55TGl2ZWNoYXRDYWxsJywgcGFyYW1zOiAnJyB9XG5cdFx0XHRdXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cm9vbUlkOiByb29tLl9pZCxcblx0XHRcdGRvbWFpbjogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ppdHNpX0RvbWFpbicpLFxuXHRcdFx0aml0c2lSb29tOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSml0c2lfVVJMX1Jvb21fUHJlZml4JykgKyBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgndW5pcXVlSUQnKSArIHJvb21JZFxuXHRcdH07XG5cdH1cbn0pO1xuXG4iLCIvKiBlc2xpbnQgbmV3LWNhcDogWzIsIHtcImNhcElzTmV3RXhjZXB0aW9uc1wiOiBbXCJNYXRjaC5PcHRpb25hbFwiXX1dICovXG5NZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDp0cmFuc2ZlcicodHJhbnNmZXJEYXRhKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkgfHwgIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICd2aWV3LWwtcm9vbScpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6dHJhbnNmZXInIH0pO1xuXHRcdH1cblxuXHRcdGNoZWNrKHRyYW5zZmVyRGF0YSwge1xuXHRcdFx0cm9vbUlkOiBTdHJpbmcsXG5cdFx0XHR1c2VySWQ6IE1hdGNoLk9wdGlvbmFsKFN0cmluZyksXG5cdFx0XHRkZXBhcnRtZW50SWQ6IE1hdGNoLk9wdGlvbmFsKFN0cmluZylcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZCh0cmFuc2ZlckRhdGEucm9vbUlkKTtcblxuXHRcdGNvbnN0IGd1ZXN0ID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQocm9vbS52Ll9pZCk7XG5cblx0XHRjb25zdCB1c2VyID0gTWV0ZW9yLnVzZXIoKTtcblxuXHRcdGlmIChyb29tLnVzZXJuYW1lcy5pbmRleE9mKHVzZXIudXNlcm5hbWUpID09PSAtMSAmJiAhUm9ja2V0Q2hhdC5hdXRoei5oYXNSb2xlKE1ldGVvci51c2VySWQoKSwgJ2xpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnRyYW5zZmVyJyB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5MaXZlY2hhdC50cmFuc2Zlcihyb29tLCBndWVzdCwgdHJhbnNmZXJEYXRhKTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIEhUVFAgKi9cbmNvbnN0IHBvc3RDYXRjaEVycm9yID0gTWV0ZW9yLndyYXBBc3luYyhmdW5jdGlvbih1cmwsIG9wdGlvbnMsIHJlc29sdmUpIHtcblx0SFRUUC5wb3N0KHVybCwgb3B0aW9ucywgZnVuY3Rpb24oZXJyLCByZXMpIHtcblx0XHRpZiAoZXJyKSB7XG5cdFx0XHRyZXNvbHZlKG51bGwsIGVyci5yZXNwb25zZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc29sdmUobnVsbCwgcmVzKTtcblx0XHR9XG5cdH0pO1xufSk7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0J2xpdmVjaGF0OndlYmhvb2tUZXN0JygpIHtcblx0XHR0aGlzLnVuYmxvY2soKTtcblxuXHRcdGNvbnN0IHNhbXBsZURhdGEgPSB7XG5cdFx0XHR0eXBlOiAnTGl2ZWNoYXRTZXNzaW9uJyxcblx0XHRcdF9pZDogJ2Zhc2Q2ZjVhNHNkNmY4YTRzZGYnLFxuXHRcdFx0bGFiZWw6ICd0aXRsZScsXG5cdFx0XHR0b3BpYzogJ2FzaW9kb2pmJyxcblx0XHRcdGNvZGU6IDEyMzEyMyxcblx0XHRcdGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcblx0XHRcdGxhc3RNZXNzYWdlQXQ6IG5ldyBEYXRlKCksXG5cdFx0XHR0YWdzOiBbXG5cdFx0XHRcdCd0YWcxJyxcblx0XHRcdFx0J3RhZzInLFxuXHRcdFx0XHQndGFnMydcblx0XHRcdF0sXG5cdFx0XHRjdXN0b21GaWVsZHM6IHtcblx0XHRcdFx0cHJvZHVjdElkOiAnMTIzNDU2J1xuXHRcdFx0fSxcblx0XHRcdHZpc2l0b3I6IHtcblx0XHRcdFx0X2lkOiAnJyxcblx0XHRcdFx0bmFtZTogJ3Zpc2l0b3IgbmFtZScsXG5cdFx0XHRcdHVzZXJuYW1lOiAndmlzaXRvci11c2VybmFtZScsXG5cdFx0XHRcdGRlcGFydG1lbnQ6ICdkZXBhcnRtZW50Jyxcblx0XHRcdFx0ZW1haWw6ICdlbWFpbEBhZGRyZXNzLmNvbScsXG5cdFx0XHRcdHBob25lOiAnMTkyODczMTkyODczJyxcblx0XHRcdFx0aXA6ICcxMjMuNDU2LjcuODknLFxuXHRcdFx0XHRicm93c2VyOiAnQ2hyb21lJyxcblx0XHRcdFx0b3M6ICdMaW51eCcsXG5cdFx0XHRcdGN1c3RvbUZpZWxkczoge1xuXHRcdFx0XHRcdGN1c3RvbWVySWQ6ICcxMjM0NTYnXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZ2VudDoge1xuXHRcdFx0XHRfaWQ6ICdhc2RmODlhczZkZjgnLFxuXHRcdFx0XHR1c2VybmFtZTogJ2FnZW50LnVzZXJuYW1lJyxcblx0XHRcdFx0bmFtZTogJ0FnZW50IE5hbWUnLFxuXHRcdFx0XHRlbWFpbDogJ2FnZW50QGVtYWlsLmNvbSdcblx0XHRcdH0sXG5cdFx0XHRtZXNzYWdlczogW3tcblx0XHRcdFx0dXNlcm5hbWU6ICd2aXNpdG9yLXVzZXJuYW1lJyxcblx0XHRcdFx0bXNnOiAnbWVzc2FnZSBjb250ZW50Jyxcblx0XHRcdFx0dHM6IG5ldyBEYXRlKClcblx0XHRcdH0sIHtcblx0XHRcdFx0dXNlcm5hbWU6ICdhZ2VudC51c2VybmFtZScsXG5cdFx0XHRcdGFnZW50SWQ6ICdhc2RmODlhczZkZjgnLFxuXHRcdFx0XHRtc2c6ICdtZXNzYWdlIGNvbnRlbnQgZnJvbSBhZ2VudCcsXG5cdFx0XHRcdHRzOiBuZXcgRGF0ZSgpXG5cdFx0XHR9XVxuXHRcdH07XG5cblx0XHRjb25zdCBvcHRpb25zID0ge1xuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnWC1Sb2NrZXRDaGF0LUxpdmVjaGF0LVRva2VuJzogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X3NlY3JldF90b2tlbicpXG5cdFx0XHR9LFxuXHRcdFx0ZGF0YTogc2FtcGxlRGF0YVxuXHRcdH07XG5cblx0XHRjb25zdCByZXNwb25zZSA9IHBvc3RDYXRjaEVycm9yKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF93ZWJob29rVXJsJyksIG9wdGlvbnMpO1xuXG5cdFx0Y29uc29sZS5sb2coJ3Jlc3BvbnNlIC0+JywgcmVzcG9uc2UpO1xuXG5cdFx0aWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLnN0YXR1c0NvZGUgJiYgcmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC13ZWJob29rLXJlc3BvbnNlJyk7XG5cdFx0fVxuXHR9XG59KTtcblxuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6dGFrZUlucXVpcnknKGlucXVpcnlJZCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1sLXJvb20nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnRha2VJbnF1aXJ5JyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnF1aXJ5ID0gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRJbnF1aXJ5LmZpbmRPbmVCeUlkKGlucXVpcnlJZCk7XG5cblx0XHRpZiAoIWlucXVpcnkgfHwgaW5xdWlyeS5zdGF0dXMgPT09ICd0YWtlbicpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ0lucXVpcnkgYWxyZWFkeSB0YWtlbicsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6dGFrZUlucXVpcnknIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZChNZXRlb3IudXNlcklkKCkpO1xuXG5cdFx0Y29uc3QgYWdlbnQgPSB7XG5cdFx0XHRhZ2VudElkOiB1c2VyLl9pZCxcblx0XHRcdHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lXG5cdFx0fTtcblxuXHRcdC8vIGFkZCBzdWJzY3JpcHRpb25cblx0XHRjb25zdCBzdWJzY3JpcHRpb25EYXRhID0ge1xuXHRcdFx0cmlkOiBpbnF1aXJ5LnJpZCxcblx0XHRcdG5hbWU6IGlucXVpcnkubmFtZSxcblx0XHRcdGFsZXJ0OiB0cnVlLFxuXHRcdFx0b3BlbjogdHJ1ZSxcblx0XHRcdHVucmVhZDogMSxcblx0XHRcdHVzZXJNZW50aW9uczogMSxcblx0XHRcdGdyb3VwTWVudGlvbnM6IDAsXG5cdFx0XHRjb2RlOiBpbnF1aXJ5LmNvZGUsXG5cdFx0XHR1OiB7XG5cdFx0XHRcdF9pZDogYWdlbnQuYWdlbnRJZCxcblx0XHRcdFx0dXNlcm5hbWU6IGFnZW50LnVzZXJuYW1lXG5cdFx0XHR9LFxuXHRcdFx0dDogJ2wnLFxuXHRcdFx0ZGVza3RvcE5vdGlmaWNhdGlvbnM6ICdhbGwnLFxuXHRcdFx0bW9iaWxlUHVzaE5vdGlmaWNhdGlvbnM6ICdhbGwnLFxuXHRcdFx0ZW1haWxOb3RpZmljYXRpb25zOiAnYWxsJ1xuXHRcdH07XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5pbnNlcnQoc3Vic2NyaXB0aW9uRGF0YSk7XG5cblx0XHQvLyB1cGRhdGUgcm9vbVxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChpbnF1aXJ5LnJpZCk7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5jaGFuZ2VBZ2VudEJ5Um9vbUlkKGlucXVpcnkucmlkLCBhZ2VudCk7XG5cblx0XHRyb29tLnNlcnZlZEJ5ID0ge1xuXHRcdFx0X2lkOiBhZ2VudC5hZ2VudElkLFxuXHRcdFx0dXNlcm5hbWU6IGFnZW50LnVzZXJuYW1lXG5cdFx0fTtcblxuXHRcdC8vIG1hcmsgaW5xdWlyeSBhcyB0YWtlblxuXHRcdFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0SW5xdWlyeS50YWtlSW5xdWlyeShpbnF1aXJ5Ll9pZCk7XG5cblx0XHQvLyByZW1vdmUgc2VuZGluZyBtZXNzYWdlIGZyb20gZ3Vlc3Qgd2lkZ2V0XG5cdFx0Ly8gZG9udCBjaGVjayBpZiBzZXR0aW5nIGlzIHRydWUsIGJlY2F1c2UgaWYgc2V0dGluZ3dhcyBzd2l0Y2hlZCBvZmYgaW5iZXR3ZWVuICBndWVzdCBlbnRlcmVkIHBvb2wsXG5cdFx0Ly8gYW5kIGlucXVpcnkgYmVpbmcgdGFrZW4sIG1lc3NhZ2Ugd291bGQgbm90IGJlIHN3aXRjaGVkIG9mZi5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVDb21tYW5kV2l0aFJvb21JZEFuZFVzZXIoJ2Nvbm5lY3RlZCcsIHJvb20uX2lkLCB1c2VyKTtcblxuXHRcdFJvY2tldENoYXQuTGl2ZWNoYXQuc3RyZWFtLmVtaXQocm9vbS5faWQsIHtcblx0XHRcdHR5cGU6ICdhZ2VudERhdGEnLFxuXHRcdFx0ZGF0YTogUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZ2V0QWdlbnRJbmZvKGFnZW50LmFnZW50SWQpXG5cdFx0fSk7XG5cblx0XHQvLyByZXR1cm4gcm9vbSBjb3JyZXNwb25kaW5nIHRvIGlucXVpcnkgKGZvciByZWRpcmVjdGluZyBhZ2VudCB0byB0aGUgcm9vbSByb3V0ZSlcblx0XHRyZXR1cm4gcm9vbTtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpyZXR1cm5Bc0lucXVpcnknKHJpZCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpIHx8ICFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAndmlldy1sLXJvb20nKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWFsbG93ZWQnLCAnTm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnNhdmVEZXBhcnRtZW50JyB9KTtcblx0XHR9XG5cblx0XHQvLyAvL2RlbGV0ZSBhZ2VudCBhbmQgcm9vbSBzdWJzY3JpcHRpb25cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnJlbW92ZUJ5Um9vbUlkKHJpZCk7XG5cblx0XHQvLyByZW1vdmUgdXNlciBmcm9tIHJvb21cblx0XHRjb25zdCB1c2VybmFtZSA9IE1ldGVvci51c2VyKCkudXNlcm5hbWU7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5yZW1vdmVVc2VybmFtZUJ5SWQocmlkLCB1c2VybmFtZSk7XG5cblx0XHQvLyBmaW5kIGlucXVpcnkgY29ycmVzcG9uZGluZyB0byByb29tXG5cdFx0Y29uc3QgaW5xdWlyeSA9IFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0SW5xdWlyeS5maW5kT25lKHtyaWR9KTtcblxuXHRcdC8vIG1hcmsgaW5xdWlyeSBhcyBvcGVuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0SW5xdWlyeS5vcGVuSW5xdWlyeShpbnF1aXJ5Ll9pZCk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnbGl2ZWNoYXQ6c2F2ZU9mZmljZUhvdXJzJyhkYXksIHN0YXJ0LCBmaW5pc2gsIG9wZW4pIHtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdE9mZmljZUhvdXIudXBkYXRlSG91cnMoZGF5LCBzdGFydCwgZmluaXNoLCBvcGVuKTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIGVtYWlsU2V0dGluZ3MsIEREUFJhdGVMaW1pdGVyICovXG4vKiBTZW5kIGEgdHJhbnNjcmlwdCBvZiB0aGUgcm9vbSBjb252ZXJzdGF0aW9uIHRvIHRoZSBnaXZlbiBlbWFpbCAqL1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQnO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdCdsaXZlY2hhdDpzZW5kVHJhbnNjcmlwdCcocmlkLCBlbWFpbCkge1xuXHRcdGNoZWNrKHJpZCwgU3RyaW5nKTtcblx0XHRjaGVjayhlbWFpbCwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChyaWQpO1xuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcigpO1xuXHRcdGNvbnN0IHVzZXJMYW5ndWFnZSA9IHVzZXIubGFuZ3VhZ2UgfHwgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ2xhbmd1YWdlJykgfHwgJ2VuJztcblxuXHRcdC8vIGFsbG93IHRvIG9ubHkgdXNlciB0byBzZW5kIHRyYW5zY3JpcHRzIGZyb20gdGhlaXIgb3duIGNoYXRzXG5cdFx0aWYgKCFyb29tIHx8IHJvb20udCAhPT0gJ2wnIHx8ICFyb29tLnYgfHwgIXVzZXIucHJvZmlsZSB8fCByb29tLnYudG9rZW4gIT09IHVzZXIucHJvZmlsZS50b2tlbikge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1yb29tJywgJ0ludmFsaWQgcm9vbScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2VzID0gUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZFZpc2libGVCeVJvb21JZChyaWQsIHsgc29ydDogeyAndHMnIDogMSB9fSk7XG5cdFx0Y29uc3QgaGVhZGVyID0gUm9ja2V0Q2hhdC5wbGFjZWhvbGRlcnMucmVwbGFjZShSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRW1haWxfSGVhZGVyJykgfHwgJycpO1xuXHRcdGNvbnN0IGZvb3RlciA9IFJvY2tldENoYXQucGxhY2Vob2xkZXJzLnJlcGxhY2UoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0VtYWlsX0Zvb3RlcicpIHx8ICcnKTtcblxuXHRcdGxldCBodG1sID0gJzxkaXY+IDxocj4nO1xuXHRcdG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB7XG5cdFx0XHRpZiAobWVzc2FnZS50ICYmIFsnY29tbWFuZCcsICdsaXZlY2hhdC1jbG9zZScsICdsaXZlY2hhdF92aWRlb19jYWxsJ10uaW5kZXhPZihtZXNzYWdlLnQpICE9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxldCBhdXRob3I7XG5cdFx0XHRpZiAobWVzc2FnZS51Ll9pZCA9PT0gTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHRcdGF1dGhvciA9IFRBUGkxOG4uX18oJ1lvdScsIHsgbG5nOiB1c2VyTGFuZ3VhZ2UgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhdXRob3IgPSBtZXNzYWdlLnUudXNlcm5hbWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRhdGV0aW1lID0gbW9tZW50KG1lc3NhZ2UudHMpLmxvY2FsZSh1c2VyTGFuZ3VhZ2UpLmZvcm1hdCgnTExMJyk7XG5cdFx0XHRjb25zdCBzaW5nbGVNZXNzYWdlID0gYFxuXHRcdFx0XHQ8cD48c3Ryb25nPiR7IGF1dGhvciB9PC9zdHJvbmc+ICA8ZW0+JHsgZGF0ZXRpbWUgfTwvZW0+PC9wPlxuXHRcdFx0XHQ8cD4keyBtZXNzYWdlLm1zZyB9PC9wPlxuXHRcdFx0YDtcblx0XHRcdGh0bWwgPSBodG1sICsgc2luZ2xlTWVzc2FnZTtcblx0XHR9KTtcblxuXHRcdGh0bWwgPSBgJHsgaHRtbCB9PC9kaXY+YDtcblxuXHRcdGxldCBmcm9tRW1haWwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRnJvbV9FbWFpbCcpLm1hdGNoKC9cXGJbQS1aMC05Ll8lKy1dK0AoPzpbQS1aMC05LV0rXFwuKStbQS1aXXsyLDR9XFxiL2kpO1xuXG5cdFx0aWYgKGZyb21FbWFpbCkge1xuXHRcdFx0ZnJvbUVtYWlsID0gZnJvbUVtYWlsWzBdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmcm9tRW1haWwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRnJvbV9FbWFpbCcpO1xuXHRcdH1cblxuXHRcdGVtYWlsU2V0dGluZ3MgPSB7XG5cdFx0XHR0bzogZW1haWwsXG5cdFx0XHRmcm9tOiBmcm9tRW1haWwsXG5cdFx0XHRyZXBseVRvOiBmcm9tRW1haWwsXG5cdFx0XHRzdWJqZWN0OiBUQVBpMThuLl9fKCdUcmFuc2NyaXB0X29mX3lvdXJfbGl2ZWNoYXRfY29udmVyc2F0aW9uJywgeyBsbmc6IHVzZXJMYW5ndWFnZSB9KSxcblx0XHRcdGh0bWw6IGhlYWRlciArIGh0bWwgKyBmb290ZXJcblx0XHR9O1xuXG5cdFx0TWV0ZW9yLmRlZmVyKCgpID0+IHtcblx0XHRcdEVtYWlsLnNlbmQoZW1haWxTZXR0aW5ncyk7XG5cdFx0fSk7XG5cblx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0Um9ja2V0Q2hhdC5jYWxsYmFja3MucnVuKCdsaXZlY2hhdC5zZW5kVHJhbnNjcmlwdCcsIG1lc3NhZ2VzLCBlbWFpbCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG5cbkREUFJhdGVMaW1pdGVyLmFkZFJ1bGUoe1xuXHR0eXBlOiAnbWV0aG9kJyxcblx0bmFtZTogJ2xpdmVjaGF0OnNlbmRUcmFuc2NyaXB0Jyxcblx0Y29ubmVjdGlvbklkKCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59LCAxLCA1MDAwKTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuLyoqXG4gKiBTZXRzIGFuIHVzZXIgYXMgKG5vbilvcGVyYXRvclxuICogQHBhcmFtIHtzdHJpbmd9IF9pZCAtIFVzZXIncyBfaWRcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gb3BlcmF0b3IgLSBGbGFnIHRvIHNldCBhcyBvcGVyYXRvciBvciBub3RcbiAqL1xuUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0T3BlcmF0b3IgPSBmdW5jdGlvbihfaWQsIG9wZXJhdG9yKSB7XG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHRvcGVyYXRvclxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy51cGRhdGUoX2lkLCB1cGRhdGUpO1xufTtcblxuLyoqXG4gKiBHZXRzIGFsbCBvbmxpbmUgYWdlbnRzXG4gKiBAcmV0dXJuXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmxpbmVBZ2VudHMgPSBmdW5jdGlvbigpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0c3RhdHVzOiB7XG5cdFx0XHQkZXhpc3RzOiB0cnVlLFxuXHRcdFx0JG5lOiAnb2ZmbGluZSdcblx0XHR9LFxuXHRcdHN0YXR1c0xpdmVjaGF0OiAnYXZhaWxhYmxlJyxcblx0XHRyb2xlczogJ2xpdmVjaGF0LWFnZW50J1xuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnkpO1xufTtcblxuLyoqXG4gKiBHZXRzIGFsbCBhZ2VudHNcbiAqIEByZXR1cm5cbiAqL1xuUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZEFnZW50cyA9IGZ1bmN0aW9uKCkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRyb2xlczogJ2xpdmVjaGF0LWFnZW50J1xuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnkpO1xufTtcblxuLyoqXG4gKiBGaW5kIG9ubGluZSB1c2VycyBmcm9tIGEgbGlzdFxuICogQHBhcmFtIHthcnJheX0gdXNlckxpc3QgLSBhcnJheSBvZiB1c2VybmFtZXNcbiAqIEByZXR1cm5cbiAqL1xuUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9ubGluZVVzZXJGcm9tTGlzdCA9IGZ1bmN0aW9uKHVzZXJMaXN0KSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdHN0YXR1czoge1xuXHRcdFx0JGV4aXN0czogdHJ1ZSxcblx0XHRcdCRuZTogJ29mZmxpbmUnXG5cdFx0fSxcblx0XHRzdGF0dXNMaXZlY2hhdDogJ2F2YWlsYWJsZScsXG5cdFx0cm9sZXM6ICdsaXZlY2hhdC1hZ2VudCcsXG5cdFx0dXNlcm5hbWU6IHtcblx0XHRcdCRpbjogW10uY29uY2F0KHVzZXJMaXN0KVxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5KTtcbn07XG5cbi8qKlxuICogR2V0IG5leHQgdXNlciBhZ2VudCBpbiBvcmRlclxuICogQHJldHVybiB7b2JqZWN0fSBVc2VyIGZyb20gZGJcbiAqL1xuUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZ2V0TmV4dEFnZW50ID0gZnVuY3Rpb24oKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdHN0YXR1czoge1xuXHRcdFx0JGV4aXN0czogdHJ1ZSxcblx0XHRcdCRuZTogJ29mZmxpbmUnXG5cdFx0fSxcblx0XHRzdGF0dXNMaXZlY2hhdDogJ2F2YWlsYWJsZScsXG5cdFx0cm9sZXM6ICdsaXZlY2hhdC1hZ2VudCdcblx0fTtcblxuXHRjb25zdCBjb2xsZWN0aW9uT2JqID0gdGhpcy5tb2RlbC5yYXdDb2xsZWN0aW9uKCk7XG5cdGNvbnN0IGZpbmRBbmRNb2RpZnkgPSBNZXRlb3Iud3JhcEFzeW5jKGNvbGxlY3Rpb25PYmouZmluZEFuZE1vZGlmeSwgY29sbGVjdGlvbk9iaik7XG5cblx0Y29uc3Qgc29ydCA9IHtcblx0XHRsaXZlY2hhdENvdW50OiAxLFxuXHRcdHVzZXJuYW1lOiAxXG5cdH07XG5cblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRpbmM6IHtcblx0XHRcdGxpdmVjaGF0Q291bnQ6IDFcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgdXNlciA9IGZpbmRBbmRNb2RpZnkocXVlcnksIHNvcnQsIHVwZGF0ZSk7XG5cdGlmICh1c2VyICYmIHVzZXIudmFsdWUpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YWdlbnRJZDogdXNlci52YWx1ZS5faWQsXG5cdFx0XHR1c2VybmFtZTogdXNlci52YWx1ZS51c2VybmFtZVxuXHRcdH07XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn07XG5cbi8qKlxuICogR2V0cyB2aXNpdG9yIGJ5IHRva2VuXG4gKiBAcGFyYW0ge3N0cmluZ30gdG9rZW4gLSBWaXNpdG9yIHRva2VuXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldFZpc2l0b3JCeVRva2VuID0gZnVuY3Rpb24odG9rZW4sIG9wdGlvbnMpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0J3Byb2ZpbGUuZ3Vlc3QnOiB0cnVlLFxuXHRcdCdwcm9maWxlLnRva2VuJzogdG9rZW5cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kT25lKHF1ZXJ5LCBvcHRpb25zKTtcbn07XG5cbi8qKlxuICogR2V0cyB2aXNpdG9yIGJ5IHRva2VuXG4gKiBAcGFyYW0ge3N0cmluZ30gdG9rZW4gLSBWaXNpdG9yIHRva2VuXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRWaXNpdG9yQnlUb2tlbiA9IGZ1bmN0aW9uKHRva2VuKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdCdwcm9maWxlLmd1ZXN0JzogdHJ1ZSxcblx0XHQncHJvZmlsZS50b2tlbic6IHRva2VuXG5cdH07XG5cblx0cmV0dXJuIHRoaXMuZmluZChxdWVyeSk7XG59O1xuXG4vKipcbiAqIENoYW5nZSB1c2VyJ3MgbGl2ZWNoYXQgc3RhdHVzXG4gKiBAcGFyYW0ge3N0cmluZ30gdG9rZW4gLSBWaXNpdG9yIHRva2VuXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLnNldExpdmVjaGF0U3RhdHVzID0gZnVuY3Rpb24odXNlcklkLCBzdGF0dXMpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0J19pZCc6IHVzZXJJZFxuXHR9O1xuXG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHQnc3RhdHVzTGl2ZWNoYXQnOiBzdGF0dXNcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuLyoqXG4gKiBjaGFuZ2UgYWxsIGxpdmVjaGF0IGFnZW50cyBsaXZlY2hhdCBzdGF0dXMgdG8gXCJub3QtYXZhaWxhYmxlXCJcbiAqL1xuUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuY2xvc2VPZmZpY2UgPSBmdW5jdGlvbigpIHtcblx0c2VsZiA9IHRoaXM7XG5cdHNlbGYuZmluZEFnZW50cygpLmZvckVhY2goZnVuY3Rpb24oYWdlbnQpIHtcblx0XHRzZWxmLnNldExpdmVjaGF0U3RhdHVzKGFnZW50Ll9pZCwgJ25vdC1hdmFpbGFibGUnKTtcblx0fSk7XG59O1xuXG4vKipcbiAqIGNoYW5nZSBhbGwgbGl2ZWNoYXQgYWdlbnRzIGxpdmVjaGF0IHN0YXR1cyB0byBcImF2YWlsYWJsZVwiXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLm9wZW5PZmZpY2UgPSBmdW5jdGlvbigpIHtcblx0c2VsZiA9IHRoaXM7XG5cdHNlbGYuZmluZEFnZW50cygpLmZvckVhY2goZnVuY3Rpb24oYWdlbnQpIHtcblx0XHRzZWxmLnNldExpdmVjaGF0U3RhdHVzKGFnZW50Ll9pZCwgJ2F2YWlsYWJsZScpO1xuXHR9KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZUxpdmVjaGF0RGF0YUJ5VG9rZW4gPSBmdW5jdGlvbih0b2tlbiwga2V5LCB2YWx1ZSwgb3ZlcndyaXRlID0gdHJ1ZSkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHQncHJvZmlsZS50b2tlbic6IHRva2VuXG5cdH07XG5cblx0aWYgKCFvdmVyd3JpdGUpIHtcblx0XHRjb25zdCB1c2VyID0gdGhpcy5maW5kT25lKHF1ZXJ5LCB7IGZpZWxkczogeyBsaXZlY2hhdERhdGE6IDEgfSB9KTtcblx0XHRpZiAodXNlci5saXZlY2hhdERhdGEgJiYgdHlwZW9mIHVzZXIubGl2ZWNoYXREYXRhW2tleV0gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0W2BsaXZlY2hhdERhdGEuJHsga2V5IH1gXTogdmFsdWVcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgdmlzaXRvciBieSB0aGVpciBwaG9uZSBudW1iZXJcbiAqIEByZXR1cm4ge29iamVjdH0gVXNlciBmcm9tIGRiXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVWaXNpdG9yQnlQaG9uZSA9IGZ1bmN0aW9uKHBob25lKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdCdwaG9uZS5waG9uZU51bWJlcic6IHBob25lXG5cdH07XG5cblx0cmV0dXJuIHRoaXMuZmluZE9uZShxdWVyeSk7XG59O1xuXG4vKipcbiAqIEdldCB0aGUgbmV4dCB2aXNpdG9yIG5hbWVcbiAqIEByZXR1cm4ge3N0cmluZ30gVGhlIG5leHQgdmlzaXRvciBuYW1lXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldE5leHRWaXNpdG9yVXNlcm5hbWUgPSBmdW5jdGlvbigpIHtcblx0Y29uc3Qgc2V0dGluZ3NSYXcgPSBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5tb2RlbC5yYXdDb2xsZWN0aW9uKCk7XG5cdGNvbnN0IGZpbmRBbmRNb2RpZnkgPSBNZXRlb3Iud3JhcEFzeW5jKHNldHRpbmdzUmF3LmZpbmRBbmRNb2RpZnksIHNldHRpbmdzUmF3KTtcblxuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWQ6ICdMaXZlY2hhdF9ndWVzdF9jb3VudCdcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JGluYzoge1xuXHRcdFx0dmFsdWU6IDFcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgbGl2ZWNoYXRDb3VudCA9IGZpbmRBbmRNb2RpZnkocXVlcnksIG51bGwsIHVwZGF0ZSk7XG5cblx0cmV0dXJuIGBndWVzdC0keyBsaXZlY2hhdENvdW50LnZhbHVlLnZhbHVlICsgMSB9YDtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLnNhdmVHdWVzdEJ5SWQgPSBmdW5jdGlvbihfaWQsIGRhdGEpIHtcblx0Y29uc3Qgc2V0RGF0YSA9IHt9O1xuXHRjb25zdCB1bnNldERhdGEgPSB7fTtcblxuXHRpZiAoZGF0YS5uYW1lKSB7XG5cdFx0aWYgKCFfLmlzRW1wdHkocy50cmltKGRhdGEubmFtZSkpKSB7XG5cdFx0XHRzZXREYXRhLm5hbWUgPSBzLnRyaW0oZGF0YS5uYW1lKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dW5zZXREYXRhLm5hbWUgPSAxO1xuXHRcdH1cblx0fVxuXG5cdGlmIChkYXRhLmVtYWlsKSB7XG5cdFx0aWYgKCFfLmlzRW1wdHkocy50cmltKGRhdGEuZW1haWwpKSkge1xuXHRcdFx0c2V0RGF0YS52aXNpdG9yRW1haWxzID0gW1xuXHRcdFx0XHR7IGFkZHJlc3M6IHMudHJpbShkYXRhLmVtYWlsKSB9XG5cdFx0XHRdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1bnNldERhdGEudmlzaXRvckVtYWlscyA9IDE7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGRhdGEucGhvbmUpIHtcblx0XHRpZiAoIV8uaXNFbXB0eShzLnRyaW0oZGF0YS5waG9uZSkpKSB7XG5cdFx0XHRzZXREYXRhLnBob25lID0gW1xuXHRcdFx0XHR7IHBob25lTnVtYmVyOiBzLnRyaW0oZGF0YS5waG9uZSkgfVxuXHRcdFx0XTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dW5zZXREYXRhLnBob25lID0gMTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCB1cGRhdGUgPSB7fTtcblxuXHRpZiAoIV8uaXNFbXB0eShzZXREYXRhKSkge1xuXHRcdHVwZGF0ZS4kc2V0ID0gc2V0RGF0YTtcblx0fVxuXG5cdGlmICghXy5pc0VtcHR5KHVuc2V0RGF0YSkpIHtcblx0XHR1cGRhdGUuJHVuc2V0ID0gdW5zZXREYXRhO1xuXHR9XG5cblx0aWYgKF8uaXNFbXB0eSh1cGRhdGUpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZXR1cm4gdGhpcy51cGRhdGUoeyBfaWQgfSwgdXBkYXRlKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVHdWVzdEJ5RW1haWxBZGRyZXNzID0gZnVuY3Rpb24oZW1haWxBZGRyZXNzKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdCd2aXNpdG9yRW1haWxzLmFkZHJlc3MnOiBuZXcgUmVnRXhwKGBeJHsgcy5lc2NhcGVSZWdFeHAoZW1haWxBZGRyZXNzKSB9JGAsICdpJylcblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kT25lKHF1ZXJ5KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldEFnZW50SW5mbyA9IGZ1bmN0aW9uKGFnZW50SWQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkOiBhZ2VudElkXG5cdH07XG5cblx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRmaWVsZHM6IHtcblx0XHRcdG5hbWU6IDEsXG5cdFx0XHR1c2VybmFtZTogMSxcblx0XHRcdGN1c3RvbUZpZWxkczogMVxuXHRcdH1cblx0fTtcblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X3Nob3dfYWdlbnRfZW1haWwnKSkge1xuXHRcdG9wdGlvbnMuZmllbGRzLmVtYWlscyA9IDE7XG5cdH1cblxuXHRyZXR1cm4gdGhpcy5maW5kT25lKHF1ZXJ5LCBvcHRpb25zKTtcbn07XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuLyoqXG4gKiBHZXRzIHZpc2l0b3IgYnkgdG9rZW5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0b2tlbiAtIFZpc2l0b3IgdG9rZW5cbiAqL1xuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudXBkYXRlU3VydmV5RmVlZGJhY2tCeUlkID0gZnVuY3Rpb24oX2lkLCBzdXJ2ZXlGZWVkYmFjaykge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWRcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0c3VydmV5RmVlZGJhY2tcblx0XHR9XG5cdH07XG5cblx0cmV0dXJuIHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudXBkYXRlTGl2ZWNoYXREYXRhQnlUb2tlbiA9IGZ1bmN0aW9uKHRva2VuLCBrZXksIHZhbHVlLCBvdmVyd3JpdGUgPSB0cnVlKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdCd2LnRva2VuJzogdG9rZW4sXG5cdFx0b3BlbjogdHJ1ZVxuXHR9O1xuXG5cdGlmICghb3ZlcndyaXRlKSB7XG5cdFx0Y29uc3Qgcm9vbSA9IHRoaXMuZmluZE9uZShxdWVyeSwgeyBmaWVsZHM6IHsgbGl2ZWNoYXREYXRhOiAxIH0gfSk7XG5cdFx0aWYgKHJvb20ubGl2ZWNoYXREYXRhICYmIHR5cGVvZiByb29tLmxpdmVjaGF0RGF0YVtrZXldICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRzZXQ6IHtcblx0XHRcdFtgbGl2ZWNoYXREYXRhLiR7IGtleSB9YF06IHZhbHVlXG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiB0aGlzLnVwZGF0ZShxdWVyeSwgdXBkYXRlKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRMaXZlY2hhdCA9IGZ1bmN0aW9uKGZpbHRlciA9IHt9LCBvZmZzZXQgPSAwLCBsaW1pdCA9IDIwKSB7XG5cdGNvbnN0IHF1ZXJ5ID0gXy5leHRlbmQoZmlsdGVyLCB7XG5cdFx0dDogJ2wnXG5cdH0pO1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnksIHsgc29ydDogeyB0czogLSAxIH0sIG9mZnNldCwgbGltaXQgfSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kTGl2ZWNoYXRCeUNvZGUgPSBmdW5jdGlvbihjb2RlLCBmaWVsZHMpIHtcblx0Y29kZSA9IHBhcnNlSW50KGNvZGUpO1xuXG5cdGNvbnN0IG9wdGlvbnMgPSB7fTtcblxuXHRpZiAoZmllbGRzKSB7XG5cdFx0b3B0aW9ucy5maWVsZHMgPSBmaWVsZHM7XG5cdH1cblxuXHQvLyBpZiAodGhpcy51c2VDYWNoZSkge1xuXHQvLyBcdHJldHVybiB0aGlzLmNhY2hlLmZpbmRCeUluZGV4KCd0LGNvZGUnLCBbJ2wnLCBjb2RlXSwgb3B0aW9ucykuZmV0Y2goKTtcblx0Ly8gfVxuXG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdHQ6ICdsJyxcblx0XHRjb2RlXG5cdH07XG5cblx0cmV0dXJuIHRoaXMuZmluZE9uZShxdWVyeSwgb3B0aW9ucyk7XG59O1xuXG4vKipcbiAqIEdldCB0aGUgbmV4dCB2aXNpdG9yIG5hbWVcbiAqIEByZXR1cm4ge3N0cmluZ30gVGhlIG5leHQgdmlzaXRvciBuYW1lXG4gKi9cblJvY2tldENoYXQubW9kZWxzLlJvb21zLmdldE5leHRMaXZlY2hhdFJvb21Db2RlID0gZnVuY3Rpb24oKSB7XG5cdGNvbnN0IHNldHRpbmdzUmF3ID0gUm9ja2V0Q2hhdC5tb2RlbHMuU2V0dGluZ3MubW9kZWwucmF3Q29sbGVjdGlvbigpO1xuXHRjb25zdCBmaW5kQW5kTW9kaWZ5ID0gTWV0ZW9yLndyYXBBc3luYyhzZXR0aW5nc1Jhdy5maW5kQW5kTW9kaWZ5LCBzZXR0aW5nc1Jhdyk7XG5cblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkOiAnTGl2ZWNoYXRfUm9vbV9Db3VudCdcblx0fTtcblxuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JGluYzoge1xuXHRcdFx0dmFsdWU6IDFcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgbGl2ZWNoYXRDb3VudCA9IGZpbmRBbmRNb2RpZnkocXVlcnksIG51bGwsIHVwZGF0ZSk7XG5cblx0cmV0dXJuIGxpdmVjaGF0Q291bnQudmFsdWUudmFsdWU7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT3BlbkJ5VmlzaXRvclRva2VuID0gZnVuY3Rpb24odmlzaXRvclRva2VuLCBvcHRpb25zKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdG9wZW46IHRydWUsXG5cdFx0J3YudG9rZW4nOiB2aXNpdG9yVG9rZW5cblx0fTtcblxuXHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5LCBvcHRpb25zKTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRCeVZpc2l0b3JUb2tlbiA9IGZ1bmN0aW9uKHZpc2l0b3JUb2tlbikge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHQndi50b2tlbic6IHZpc2l0b3JUb2tlblxuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnkpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VmlzaXRvcklkID0gZnVuY3Rpb24odmlzaXRvcklkKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdCd2Ll9pZCc6IHZpc2l0b3JJZFxuXHR9O1xuXG5cdHJldHVybiB0aGlzLmZpbmQocXVlcnkpO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZU9wZW5CeVZpc2l0b3JJZCA9IGZ1bmN0aW9uKHZpc2l0b3JJZCwgcm9vbUlkKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdF9pZDogcm9vbUlkLFxuXHRcdG9wZW46IHRydWUsXG5cdFx0J3YuX2lkJzogdmlzaXRvcklkXG5cdH07XG5cblx0cmV0dXJuIHRoaXMuZmluZE9uZShxdWVyeSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRSZXNwb25zZUJ5Um9vbUlkID0gZnVuY3Rpb24ocm9vbUlkLCByZXNwb25zZSkge1xuXHRyZXR1cm4gdGhpcy51cGRhdGUoe1xuXHRcdF9pZDogcm9vbUlkXG5cdH0sIHtcblx0XHQkc2V0OiB7XG5cdFx0XHRyZXNwb25zZUJ5OiB7XG5cdFx0XHRcdF9pZDogcmVzcG9uc2UudXNlci5faWQsXG5cdFx0XHRcdHVzZXJuYW1lOiByZXNwb25zZS51c2VyLnVzZXJuYW1lXG5cdFx0XHR9LFxuXHRcdFx0cmVzcG9uc2VEYXRlOiByZXNwb25zZS5yZXNwb25zZURhdGUsXG5cdFx0XHRyZXNwb25zZVRpbWU6IHJlc3BvbnNlLnJlc3BvbnNlVGltZVxuXHRcdH0sXG5cdFx0JHVuc2V0OiB7XG5cdFx0XHR3YWl0aW5nUmVzcG9uc2U6IDFcblx0XHR9XG5cdH0pO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuY2xvc2VCeVJvb21JZCA9IGZ1bmN0aW9uKHJvb21JZCwgY2xvc2VJbmZvKSB7XG5cdHJldHVybiB0aGlzLnVwZGF0ZSh7XG5cdFx0X2lkOiByb29tSWRcblx0fSwge1xuXHRcdCRzZXQ6IHtcblx0XHRcdGNsb3NlZEJ5OiB7XG5cdFx0XHRcdF9pZDogY2xvc2VJbmZvLnVzZXIuX2lkLFxuXHRcdFx0XHR1c2VybmFtZTogY2xvc2VJbmZvLnVzZXIudXNlcm5hbWVcblx0XHRcdH0sXG5cdFx0XHRjbG9zZWRBdDogY2xvc2VJbmZvLmNsb3NlZEF0LFxuXHRcdFx0Y2hhdER1cmF0aW9uOiBjbG9zZUluZm8uY2hhdER1cmF0aW9uXG5cdFx0fSxcblx0XHQkdW5zZXQ6IHtcblx0XHRcdG9wZW46IDFcblx0XHR9XG5cdH0pO1xufTtcblxuUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0TGFiZWxCeVJvb21JZCA9IGZ1bmN0aW9uKHJvb21JZCwgbGFiZWwpIHtcblx0cmV0dXJuIHRoaXMudXBkYXRlKHsgX2lkOiByb29tSWQgfSwgeyAkc2V0OiB7IGxhYmVsIH0gfSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT3BlbkJ5QWdlbnQgPSBmdW5jdGlvbih1c2VySWQpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0b3BlbjogdHJ1ZSxcblx0XHQnc2VydmVkQnkuX2lkJzogdXNlcklkXG5cdH07XG5cblx0cmV0dXJuIHRoaXMuZmluZChxdWVyeSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5jaGFuZ2VBZ2VudEJ5Um9vbUlkID0gZnVuY3Rpb24ocm9vbUlkLCBuZXdBZ2VudCkge1xuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWQ6IHJvb21JZFxuXHR9O1xuXHRjb25zdCB1cGRhdGUgPSB7XG5cdFx0JHNldDoge1xuXHRcdFx0c2VydmVkQnk6IHtcblx0XHRcdFx0X2lkOiBuZXdBZ2VudC5hZ2VudElkLFxuXHRcdFx0XHR1c2VybmFtZTogbmV3QWdlbnQudXNlcm5hbWVcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0dGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zYXZlQ1JNRGF0YUJ5Um9vbUlkID0gZnVuY3Rpb24ocm9vbUlkLCBjcm1EYXRhKSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdF9pZDogcm9vbUlkXG5cdH07XG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHRjcm1EYXRhXG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiB0aGlzLnVwZGF0ZShxdWVyeSwgdXBkYXRlKTtcbn07XG4iLCJjbGFzcyBMaXZlY2hhdEV4dGVybmFsTWVzc2FnZSBleHRlbmRzIFJvY2tldENoYXQubW9kZWxzLl9CYXNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ2xpdmVjaGF0X2V4dGVybmFsX21lc3NhZ2UnKTtcblxuXHRcdGlmIChNZXRlb3IuaXNDbGllbnQpIHtcblx0XHRcdHRoaXMuX2luaXRNb2RlbCgnbGl2ZWNoYXRfZXh0ZXJuYWxfbWVzc2FnZScpO1xuXHRcdH1cblx0fVxuXG5cdC8vIEZJTkRcblx0ZmluZEJ5Um9vbUlkKHJvb21JZCwgc29ydCA9IHsgdHM6IC0xIH0pIHtcblx0XHRjb25zdCBxdWVyeSA9IHsgcmlkOiByb29tSWQgfTtcblxuXHRcdHJldHVybiB0aGlzLmZpbmQocXVlcnksIHsgc29ydCB9KTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdEV4dGVybmFsTWVzc2FnZSA9IG5ldyBMaXZlY2hhdEV4dGVybmFsTWVzc2FnZSgpO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbi8qKlxuICogTGl2ZWNoYXQgQ3VzdG9tIEZpZWxkcyBtb2RlbFxuICovXG5jbGFzcyBMaXZlY2hhdEN1c3RvbUZpZWxkIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignbGl2ZWNoYXRfY3VzdG9tX2ZpZWxkJyk7XG5cdH1cblxuXHQvLyBGSU5EXG5cdGZpbmRPbmVCeUlkKF9pZCwgb3B0aW9ucykge1xuXHRcdGNvbnN0IHF1ZXJ5ID0geyBfaWQgfTtcblxuXHRcdHJldHVybiB0aGlzLmZpbmRPbmUocXVlcnksIG9wdGlvbnMpO1xuXHR9XG5cblx0Y3JlYXRlT3JVcGRhdGVDdXN0b21GaWVsZChfaWQsIGZpZWxkLCBsYWJlbCwgc2NvcGUsIHZpc2liaWxpdHksIGV4dHJhRGF0YSkge1xuXHRcdGNvbnN0IHJlY29yZCA9IHtcblx0XHRcdGxhYmVsLFxuXHRcdFx0c2NvcGUsXG5cdFx0XHR2aXNpYmlsaXR5XG5cdFx0fTtcblxuXHRcdF8uZXh0ZW5kKHJlY29yZCwgZXh0cmFEYXRhKTtcblxuXHRcdGlmIChfaWQpIHtcblx0XHRcdHRoaXMudXBkYXRlKHsgX2lkIH0sIHsgJHNldDogcmVjb3JkIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZWNvcmQuX2lkID0gZmllbGQ7XG5cdFx0XHRfaWQgPSB0aGlzLmluc2VydChyZWNvcmQpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZWNvcmQ7XG5cdH1cblxuXHQvLyBSRU1PVkVcblx0cmVtb3ZlQnlJZChfaWQpIHtcblx0XHRjb25zdCBxdWVyeSA9IHsgX2lkIH07XG5cblx0XHRyZXR1cm4gdGhpcy5yZW1vdmUocXVlcnkpO1xuXHR9XG59XG5cblJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0Q3VzdG9tRmllbGQgPSBuZXcgTGl2ZWNoYXRDdXN0b21GaWVsZCgpO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbi8qKlxuICogTGl2ZWNoYXQgRGVwYXJ0bWVudCBtb2RlbFxuICovXG5jbGFzcyBMaXZlY2hhdERlcGFydG1lbnQgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdsaXZlY2hhdF9kZXBhcnRtZW50Jyk7XG5cblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHtcblx0XHRcdG51bUFnZW50czogMSxcblx0XHRcdGVuYWJsZWQ6IDFcblx0XHR9KTtcblx0fVxuXG5cdC8vIEZJTkRcblx0ZmluZE9uZUJ5SWQoX2lkLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgcXVlcnkgPSB7IF9pZCB9O1xuXG5cdFx0cmV0dXJuIHRoaXMuZmluZE9uZShxdWVyeSwgb3B0aW9ucyk7XG5cdH1cblxuXHRmaW5kQnlEZXBhcnRtZW50SWQoX2lkLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgcXVlcnkgPSB7IF9pZCB9O1xuXG5cdFx0cmV0dXJuIHRoaXMuZmluZChxdWVyeSwgb3B0aW9ucyk7XG5cdH1cblxuXHRjcmVhdGVPclVwZGF0ZURlcGFydG1lbnQoX2lkLCB7IGVuYWJsZWQsIG5hbWUsIGRlc2NyaXB0aW9uLCBzaG93T25SZWdpc3RyYXRpb24gfSwgYWdlbnRzKSB7XG5cdFx0YWdlbnRzID0gW10uY29uY2F0KGFnZW50cyk7XG5cblx0XHRjb25zdCByZWNvcmQgPSB7XG5cdFx0XHRlbmFibGVkLFxuXHRcdFx0bmFtZSxcblx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0bnVtQWdlbnRzOiBhZ2VudHMubGVuZ3RoLFxuXHRcdFx0c2hvd09uUmVnaXN0cmF0aW9uXG5cdFx0fTtcblxuXHRcdGlmIChfaWQpIHtcblx0XHRcdHRoaXMudXBkYXRlKHsgX2lkIH0sIHsgJHNldDogcmVjb3JkIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRfaWQgPSB0aGlzLmluc2VydChyZWNvcmQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNhdmVkQWdlbnRzID0gXy5wbHVjayhSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnRBZ2VudHMuZmluZEJ5RGVwYXJ0bWVudElkKF9pZCkuZmV0Y2goKSwgJ2FnZW50SWQnKTtcblx0XHRjb25zdCBhZ2VudHNUb1NhdmUgPSBfLnBsdWNrKGFnZW50cywgJ2FnZW50SWQnKTtcblxuXHRcdC8vIHJlbW92ZSBvdGhlciBhZ2VudHNcblx0XHRfLmRpZmZlcmVuY2Uoc2F2ZWRBZ2VudHMsIGFnZW50c1RvU2F2ZSkuZm9yRWFjaCgoYWdlbnRJZCkgPT4ge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50QWdlbnRzLnJlbW92ZUJ5RGVwYXJ0bWVudElkQW5kQWdlbnRJZChfaWQsIGFnZW50SWQpO1xuXHRcdH0pO1xuXG5cdFx0YWdlbnRzLmZvckVhY2goKGFnZW50KSA9PiB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnRBZ2VudHMuc2F2ZUFnZW50KHtcblx0XHRcdFx0YWdlbnRJZDogYWdlbnQuYWdlbnRJZCxcblx0XHRcdFx0ZGVwYXJ0bWVudElkOiBfaWQsXG5cdFx0XHRcdHVzZXJuYW1lOiBhZ2VudC51c2VybmFtZSxcblx0XHRcdFx0Y291bnQ6IGFnZW50LmNvdW50ID8gcGFyc2VJbnQoYWdlbnQuY291bnQpIDogMCxcblx0XHRcdFx0b3JkZXI6IGFnZW50Lm9yZGVyID8gcGFyc2VJbnQoYWdlbnQub3JkZXIpIDogMFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gXy5leHRlbmQocmVjb3JkLCB7IF9pZCB9KTtcblx0fVxuXG5cdC8vIFJFTU9WRVxuXHRyZW1vdmVCeUlkKF9pZCkge1xuXHRcdGNvbnN0IHF1ZXJ5ID0geyBfaWQgfTtcblxuXHRcdHJldHVybiB0aGlzLnJlbW92ZShxdWVyeSk7XG5cdH1cblxuXHRmaW5kRW5hYmxlZFdpdGhBZ2VudHMoKSB7XG5cdFx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0XHRudW1BZ2VudHM6IHsgJGd0OiAwIH0sXG5cdFx0XHRlbmFibGVkOiB0cnVlXG5cdFx0fTtcblx0XHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5KTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnQgPSBuZXcgTGl2ZWNoYXREZXBhcnRtZW50KCk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbi8qKlxuICogTGl2ZWNoYXQgRGVwYXJ0bWVudCBtb2RlbFxuICovXG5jbGFzcyBMaXZlY2hhdERlcGFydG1lbnRBZ2VudHMgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdsaXZlY2hhdF9kZXBhcnRtZW50X2FnZW50cycpO1xuXHR9XG5cblx0ZmluZEJ5RGVwYXJ0bWVudElkKGRlcGFydG1lbnRJZCkge1xuXHRcdHJldHVybiB0aGlzLmZpbmQoeyBkZXBhcnRtZW50SWQgfSk7XG5cdH1cblxuXHRzYXZlQWdlbnQoYWdlbnQpIHtcblx0XHRyZXR1cm4gdGhpcy51cHNlcnQoe1xuXHRcdFx0YWdlbnRJZDogYWdlbnQuYWdlbnRJZCxcblx0XHRcdGRlcGFydG1lbnRJZDogYWdlbnQuZGVwYXJ0bWVudElkXG5cdFx0fSwge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHR1c2VybmFtZTogYWdlbnQudXNlcm5hbWUsXG5cdFx0XHRcdGNvdW50OiBwYXJzZUludChhZ2VudC5jb3VudCksXG5cdFx0XHRcdG9yZGVyOiBwYXJzZUludChhZ2VudC5vcmRlcilcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJlbW92ZUJ5RGVwYXJ0bWVudElkQW5kQWdlbnRJZChkZXBhcnRtZW50SWQsIGFnZW50SWQpIHtcblx0XHR0aGlzLnJlbW92ZSh7IGRlcGFydG1lbnRJZCwgYWdlbnRJZCB9KTtcblx0fVxuXG5cdGdldE5leHRBZ2VudEZvckRlcGFydG1lbnQoZGVwYXJ0bWVudElkKSB7XG5cdFx0Y29uc3QgYWdlbnRzID0gdGhpcy5maW5kQnlEZXBhcnRtZW50SWQoZGVwYXJ0bWVudElkKS5mZXRjaCgpO1xuXG5cdFx0aWYgKGFnZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvbmxpbmVVc2VycyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmxpbmVVc2VyRnJvbUxpc3QoXy5wbHVjayhhZ2VudHMsICd1c2VybmFtZScpKTtcblxuXHRcdGNvbnN0IG9ubGluZVVzZXJuYW1lcyA9IF8ucGx1Y2sob25saW5lVXNlcnMuZmV0Y2goKSwgJ3VzZXJuYW1lJyk7XG5cblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdGRlcGFydG1lbnRJZCxcblx0XHRcdHVzZXJuYW1lOiB7XG5cdFx0XHRcdCRpbjogb25saW5lVXNlcm5hbWVzXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHNvcnQgPSB7XG5cdFx0XHRjb3VudDogMSxcblx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0dXNlcm5hbWU6IDFcblx0XHR9O1xuXHRcdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHRcdCRpbmM6IHtcblx0XHRcdFx0Y291bnQ6IDFcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgY29sbGVjdGlvbk9iaiA9IHRoaXMubW9kZWwucmF3Q29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IGZpbmRBbmRNb2RpZnkgPSBNZXRlb3Iud3JhcEFzeW5jKGNvbGxlY3Rpb25PYmouZmluZEFuZE1vZGlmeSwgY29sbGVjdGlvbk9iaik7XG5cblx0XHRjb25zdCBhZ2VudCA9IGZpbmRBbmRNb2RpZnkocXVlcnksIHNvcnQsIHVwZGF0ZSk7XG5cdFx0aWYgKGFnZW50ICYmIGFnZW50LnZhbHVlKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRhZ2VudElkOiBhZ2VudC52YWx1ZS5hZ2VudElkLFxuXHRcdFx0XHR1c2VybmFtZTogYWdlbnQudmFsdWUudXNlcm5hbWVcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdGdldE9ubGluZUZvckRlcGFydG1lbnQoZGVwYXJ0bWVudElkKSB7XG5cdFx0Y29uc3QgYWdlbnRzID0gdGhpcy5maW5kQnlEZXBhcnRtZW50SWQoZGVwYXJ0bWVudElkKS5mZXRjaCgpO1xuXG5cdFx0aWYgKGFnZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBvbmxpbmVVc2VycyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmxpbmVVc2VyRnJvbUxpc3QoXy5wbHVjayhhZ2VudHMsICd1c2VybmFtZScpKTtcblxuXHRcdGNvbnN0IG9ubGluZVVzZXJuYW1lcyA9IF8ucGx1Y2sob25saW5lVXNlcnMuZmV0Y2goKSwgJ3VzZXJuYW1lJyk7XG5cblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdGRlcGFydG1lbnRJZCxcblx0XHRcdHVzZXJuYW1lOiB7XG5cdFx0XHRcdCRpbjogb25saW5lVXNlcm5hbWVzXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGRlcEFnZW50cyA9IHRoaXMuZmluZChxdWVyeSk7XG5cblx0XHRpZiAoZGVwQWdlbnRzKSB7XG5cdFx0XHRyZXR1cm4gZGVwQWdlbnRzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cblx0ZmluZFVzZXJzSW5RdWV1ZSh1c2Vyc0xpc3QpIHtcblx0XHRjb25zdCBxdWVyeSA9IHt9O1xuXG5cdFx0aWYgKCFfLmlzRW1wdHkodXNlcnNMaXN0KSkge1xuXHRcdFx0cXVlcnkudXNlcm5hbWUgPSB7XG5cdFx0XHRcdCRpbjogdXNlcnNMaXN0XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRzb3J0OiB7XG5cdFx0XHRcdGRlcGFydG1lbnRJZDogMSxcblx0XHRcdFx0Y291bnQ6IDEsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR1c2VybmFtZTogMVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5LCBvcHRpb25zKTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnRBZ2VudHMgPSBuZXcgTGl2ZWNoYXREZXBhcnRtZW50QWdlbnRzKCk7XG4iLCIvKipcbiAqIExpdmVjaGF0IFBhZ2UgVmlzaXRlZCBtb2RlbFxuICovXG5jbGFzcyBMaXZlY2hhdFBhZ2VWaXNpdGVkIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignbGl2ZWNoYXRfcGFnZV92aXNpdGVkJyk7XG5cblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ3Rva2VuJzogMSB9KTtcblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ3RzJzogMSB9KTtcblxuXHRcdC8vIGtlZXAgaGlzdG9yeSBmb3IgMSBtb250aCBpZiB0aGUgdmlzaXRvciBkb2VzIG5vdCByZWdpc3RlclxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnZXhwaXJlQXQnOiAxIH0sIHsgc3BhcnNlOiAxLCBleHBpcmVBZnRlclNlY29uZHM6IDAgfSk7XG5cdH1cblxuXHRzYXZlQnlUb2tlbih0b2tlbiwgcGFnZUluZm8pIHtcblx0XHQvLyBrZWVwIGhpc3Rvcnkgb2YgdW5yZWdpc3RlcmVkIHZpc2l0b3JzIGZvciAxIG1vbnRoXG5cdFx0Y29uc3Qga2VlcEhpc3RvcnlNaWxpc2Vjb25kcyA9IDI1OTIwMDAwMDA7XG5cblx0XHRyZXR1cm4gdGhpcy5pbnNlcnQoe1xuXHRcdFx0dG9rZW4sXG5cdFx0XHRwYWdlOiBwYWdlSW5mbyxcblx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0ZXhwaXJlQXQ6IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsga2VlcEhpc3RvcnlNaWxpc2Vjb25kc1xuXHRcdH0pO1xuXHR9XG5cblx0ZmluZEJ5VG9rZW4odG9rZW4pIHtcblx0XHRyZXR1cm4gdGhpcy5maW5kKHsgdG9rZW4gfSwgeyBzb3J0IDogeyB0czogLTEgfSwgbGltaXQ6IDIwIH0pO1xuXHR9XG5cblx0a2VlcEhpc3RvcnlGb3JUb2tlbih0b2tlbikge1xuXHRcdHJldHVybiB0aGlzLnVwZGF0ZSh7XG5cdFx0XHR0b2tlbixcblx0XHRcdGV4cGlyZUF0OiB7XG5cdFx0XHRcdCRleGlzdHM6IHRydWVcblx0XHRcdH1cblx0XHR9LCB7XG5cdFx0XHQkdW5zZXQ6IHtcblx0XHRcdFx0ZXhwaXJlQXQ6IDFcblx0XHRcdH1cblx0XHR9LCB7XG5cdFx0XHRtdWx0aTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG59XG5cblJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0UGFnZVZpc2l0ZWQgPSBuZXcgTGl2ZWNoYXRQYWdlVmlzaXRlZCgpO1xuIiwiLyoqXG4gKiBMaXZlY2hhdCBUcmlnZ2VyIG1vZGVsXG4gKi9cbmNsYXNzIExpdmVjaGF0VHJpZ2dlciBleHRlbmRzIFJvY2tldENoYXQubW9kZWxzLl9CYXNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ2xpdmVjaGF0X3RyaWdnZXInKTtcblx0fVxuXG5cdHVwZGF0ZUJ5SWQoX2lkLCBkYXRhKSB7XG5cdFx0cmV0dXJuIHRoaXMudXBkYXRlKHsgX2lkIH0sIHsgJHNldDogZGF0YSB9KTtcblx0fVxuXG5cdHJlbW92ZUFsbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmUoe30pO1xuXHR9XG5cblx0ZmluZEJ5SWQoX2lkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZCh7IF9pZCB9KTtcblx0fVxuXG5cdHJlbW92ZUJ5SWQoX2lkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlKHsgX2lkIH0pO1xuXHR9XG5cblx0ZmluZEVuYWJsZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZCh7IGVuYWJsZWQ6IHRydWUgfSk7XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRUcmlnZ2VyID0gbmV3IExpdmVjaGF0VHJpZ2dlcigpO1xuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnRyeUVuc3VyZUluZGV4KHsgY29kZTogMSB9KTtcblx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMudHJ5RW5zdXJlSW5kZXgoeyBvcGVuOiAxIH0sIHsgc3BhcnNlOiAxIH0pO1xuXHRSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy50cnlFbnN1cmVJbmRleCh7ICd2aXNpdG9yRW1haWxzLmFkZHJlc3MnOiAxIH0pO1xufSk7XG4iLCJjbGFzcyBMaXZlY2hhdElucXVpcnkgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdsaXZlY2hhdF9pbnF1aXJ5Jyk7XG5cblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ3JpZCc6IDEgfSk7IC8vIHJvb20gaWQgY29ycmVzcG9uZGluZyB0byB0aGlzIGlucXVpcnlcblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ25hbWUnOiAxIH0pOyAvLyBuYW1lIG9mIHRoZSBpbnF1aXJ5IChjbGllbnQgbmFtZSBmb3Igbm93KVxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnbWVzc2FnZSc6IDEgfSk7IC8vIG1lc3NhZ2Ugc2VudCBieSB0aGUgY2xpZW50XG5cdFx0dGhpcy50cnlFbnN1cmVJbmRleCh7ICd0cyc6IDEgfSk7IC8vIHRpbWVzdGFtcFxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnY29kZSc6IDEgfSk7IC8vIChmb3Igcm91dGluZylcblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ2FnZW50cyc6IDF9KTsgLy8gSWQncyBvZiB0aGUgYWdlbnRzIHdobyBjYW4gc2VlIHRoZSBpbnF1aXJ5IChoYW5kbGUgZGVwYXJ0bWVudHMpXG5cdFx0dGhpcy50cnlFbnN1cmVJbmRleCh7ICdzdGF0dXMnOiAxfSk7IC8vICdvcGVuJywgJ3Rha2VuJ1xuXHR9XG5cblx0ZmluZE9uZUJ5SWQoaW5xdWlyeUlkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZE9uZSh7IF9pZDogaW5xdWlyeUlkIH0pO1xuXHR9XG5cblx0Lypcblx0ICogbWFyayB0aGUgaW5xdWlyeSBhcyB0YWtlblxuXHQgKi9cblx0dGFrZUlucXVpcnkoaW5xdWlyeUlkKSB7XG5cdFx0dGhpcy51cGRhdGUoe1xuXHRcdFx0J19pZCc6IGlucXVpcnlJZFxuXHRcdH0sIHtcblx0XHRcdCRzZXQ6IHsgc3RhdHVzOiAndGFrZW4nIH1cblx0XHR9KTtcblx0fVxuXG5cdC8qXG5cdCAqIG1hcmsgaW5xdWlyeSBhcyBvcGVuXG5cdCAqL1xuXHRvcGVuSW5xdWlyeShpbnF1aXJ5SWQpIHtcblx0XHR0aGlzLnVwZGF0ZSh7XG5cdFx0XHQnX2lkJzogaW5xdWlyeUlkXG5cdFx0fSwge1xuXHRcdFx0JHNldDogeyBzdGF0dXM6ICdvcGVuJyB9XG5cdFx0fSk7XG5cdH1cblxuXHQvKlxuXHQgKiByZXR1cm4gdGhlIHN0YXR1cyBvZiB0aGUgaW5xdWlyeSAob3BlbiBvciB0YWtlbilcblx0ICovXG5cdGdldFN0YXR1cyhpbnF1aXJ5SWQpIHtcblx0XHRyZXR1cm4gdGhpcy5maW5kT25lKHsnX2lkJzogaW5xdWlyeUlkfSkuc3RhdHVzO1xuXHR9XG59XG5cblJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0SW5xdWlyeSA9IG5ldyBMaXZlY2hhdElucXVpcnkoKTtcbiIsImltcG9ydCBtb21lbnQgZnJvbSAnbW9tZW50JztcblxuY2xhc3MgTGl2ZWNoYXRPZmZpY2VIb3VyIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignbGl2ZWNoYXRfb2ZmaWNlX2hvdXInKTtcblxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnZGF5JzogMSB9KTsgLy8gdGhlIGRheSBvZiB0aGUgd2VlayBtb25kYXkgLSBzdW5kYXlcblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ3N0YXJ0JzogMSB9KTsgLy8gdGhlIG9wZW5pbmcgaG91cnMgb2YgdGhlIG9mZmljZVxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnZmluaXNoJzogMSB9KTsgLy8gdGhlIGNsb3NpbmcgaG91cnMgb2YgdGhlIG9mZmljZVxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnb3Blbic6IDEgfSk7IC8vIHdoZXRoZXIgb3Igbm90IHRoZSBvZmZpY2VzIGFyZSBvcGVuIG9uIHRoaXMgZGF5XG5cblx0XHQvLyBpZiB0aGVyZSBpcyBub3RoaW5nIGluIHRoZSBjb2xsZWN0aW9uLCBhZGQgZGVmYXVsdHNcblx0XHRpZiAodGhpcy5maW5kKCkuY291bnQoKSA9PT0gMCkge1xuXHRcdFx0dGhpcy5pbnNlcnQoeydkYXknIDogJ01vbmRheScsICdzdGFydCcgOiAnMDg6MDAnLCAnZmluaXNoJyA6ICcyMDowMCcsICdjb2RlJyA6IDEsICdvcGVuJyA6IHRydWUgfSk7XG5cdFx0XHR0aGlzLmluc2VydCh7J2RheScgOiAnVHVlc2RheScsICdzdGFydCcgOiAnMDg6MDAnLCAnZmluaXNoJyA6ICcyMDowMCcsICdjb2RlJyA6IDIsICdvcGVuJyA6IHRydWUgfSk7XG5cdFx0XHR0aGlzLmluc2VydCh7J2RheScgOiAnV2VkbmVzZGF5JywgJ3N0YXJ0JyA6ICcwODowMCcsICdmaW5pc2gnIDogJzIwOjAwJywgJ2NvZGUnIDogMywgJ29wZW4nIDogdHJ1ZSB9KTtcblx0XHRcdHRoaXMuaW5zZXJ0KHsnZGF5JyA6ICdUaHVyc2RheScsICdzdGFydCcgOiAnMDg6MDAnLCAnZmluaXNoJyA6ICcyMDowMCcsICdjb2RlJyA6IDQsICdvcGVuJyA6IHRydWUgfSk7XG5cdFx0XHR0aGlzLmluc2VydCh7J2RheScgOiAnRnJpZGF5JywgJ3N0YXJ0JyA6ICcwODowMCcsICdmaW5pc2gnIDogJzIwOjAwJywgJ2NvZGUnIDogNSwgJ29wZW4nIDogdHJ1ZSB9KTtcblx0XHRcdHRoaXMuaW5zZXJ0KHsnZGF5JyA6ICdTYXR1cmRheScsICdzdGFydCcgOiAnMDg6MDAnLCAnZmluaXNoJyA6ICcyMDowMCcsICdjb2RlJyA6IDYsICdvcGVuJyA6IGZhbHNlIH0pO1xuXHRcdFx0dGhpcy5pbnNlcnQoeydkYXknIDogJ1N1bmRheScsICdzdGFydCcgOiAnMDg6MDAnLCAnZmluaXNoJyA6ICcyMDowMCcsICdjb2RlJyA6IDAsICdvcGVuJyA6IGZhbHNlIH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdCAqIHVwZGF0ZSB0aGUgZ2l2ZW4gZGF5cyBzdGFydCBhbmQgZmluaXNoIHRpbWVzIGFuZCB3aGV0aGVyIHRoZSBvZmZpY2UgaXMgb3BlbiBvbiB0aGF0IGRheVxuXHQgKi9cblx0dXBkYXRlSG91cnMoZGF5LCBuZXdTdGFydCwgbmV3RmluaXNoLCBuZXdPcGVuKSB7XG5cdFx0dGhpcy51cGRhdGUoe1xuXHRcdFx0ZGF5XG5cdFx0fSwge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRzdGFydDogbmV3U3RhcnQsXG5cdFx0XHRcdGZpbmlzaDogbmV3RmluaXNoLFxuXHRcdFx0XHRvcGVuOiBuZXdPcGVuXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvKlxuXHQgKiBDaGVjayBpZiB0aGUgY3VycmVudCBzZXJ2ZXIgdGltZSAodXRjKSBpcyB3aXRoaW4gdGhlIG9mZmljZSBob3VycyBvZiB0aGF0IGRheVxuXHQgKiByZXR1cm5zIHRydWUgb3IgZmFsc2Vcblx0ICovXG5cdGlzTm93V2l0aGluSG91cnMoKSB7XG5cdFx0Ly8gZ2V0IGN1cnJlbnQgdGltZSBvbiBzZXJ2ZXIgaW4gdXRjXG5cdFx0Ly8gdmFyIGN0ID0gbW9tZW50KCkudXRjKCk7XG5cdFx0Y29uc3QgY3VycmVudFRpbWUgPSBtb21lbnQudXRjKG1vbWVudCgpLnV0YygpLmZvcm1hdCgnZGRkZDpISDptbScpLCAnZGRkZDpISDptbScpO1xuXG5cdFx0Ly8gZ2V0IHRvZGF5cyBvZmZpY2UgaG91cnMgZnJvbSBkYlxuXHRcdGNvbnN0IHRvZGF5c09mZmljZUhvdXJzID0gdGhpcy5maW5kT25lKHtkYXk6IGN1cnJlbnRUaW1lLmZvcm1hdCgnZGRkZCcpfSk7XG5cdFx0aWYgKCF0b2RheXNPZmZpY2VIb3Vycykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGNoZWNrIGlmIG9mZmljZXMgYXJlIG9wZW4gdG9kYXlcblx0XHRpZiAodG9kYXlzT2ZmaWNlSG91cnMub3BlbiA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IG1vbWVudC51dGMoYCR7IHRvZGF5c09mZmljZUhvdXJzLmRheSB9OiR7IHRvZGF5c09mZmljZUhvdXJzLnN0YXJ0IH1gLCAnZGRkZDpISDptbScpO1xuXHRcdGNvbnN0IGZpbmlzaCA9IG1vbWVudC51dGMoYCR7IHRvZGF5c09mZmljZUhvdXJzLmRheSB9OiR7IHRvZGF5c09mZmljZUhvdXJzLmZpbmlzaCB9YCwgJ2RkZGQ6SEg6bW0nKTtcblxuXHRcdC8vIGNvbnNvbGUubG9nKGZpbmlzaC5pc0JlZm9yZShzdGFydCkpO1xuXHRcdGlmIChmaW5pc2guaXNCZWZvcmUoc3RhcnQpKSB7XG5cdFx0XHQvLyBmaW5pc2guZGF5KGZpbmlzaC5kYXkoKSsxKTtcblx0XHRcdGZpbmlzaC5hZGQoMSwgJ2RheXMnKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBjdXJyZW50VGltZS5pc0JldHdlZW4oc3RhcnQsIGZpbmlzaCk7XG5cblx0XHQvLyBpbkJldHdlZW4gIGNoZWNrXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGlzT3BlbmluZ1RpbWUoKSB7XG5cdFx0Ly8gZ2V0IGN1cnJlbnQgdGltZSBvbiBzZXJ2ZXIgaW4gdXRjXG5cdFx0Y29uc3QgY3VycmVudFRpbWUgPSBtb21lbnQudXRjKG1vbWVudCgpLnV0YygpLmZvcm1hdCgnZGRkZDpISDptbScpLCAnZGRkZDpISDptbScpO1xuXG5cdFx0Ly8gZ2V0IHRvZGF5cyBvZmZpY2UgaG91cnMgZnJvbSBkYlxuXHRcdGNvbnN0IHRvZGF5c09mZmljZUhvdXJzID0gdGhpcy5maW5kT25lKHtkYXk6IGN1cnJlbnRUaW1lLmZvcm1hdCgnZGRkZCcpfSk7XG5cdFx0aWYgKCF0b2RheXNPZmZpY2VIb3Vycykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGNoZWNrIGlmIG9mZmljZXMgYXJlIG9wZW4gdG9kYXlcblx0XHRpZiAodG9kYXlzT2ZmaWNlSG91cnMub3BlbiA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IG1vbWVudC51dGMoYCR7IHRvZGF5c09mZmljZUhvdXJzLmRheSB9OiR7IHRvZGF5c09mZmljZUhvdXJzLnN0YXJ0IH1gLCAnZGRkZDpISDptbScpO1xuXG5cdFx0cmV0dXJuIHN0YXJ0LmlzU2FtZShjdXJyZW50VGltZSwgJ21pbnV0ZScpO1xuXHR9XG5cblx0aXNDbG9zaW5nVGltZSgpIHtcblx0XHQvLyBnZXQgY3VycmVudCB0aW1lIG9uIHNlcnZlciBpbiB1dGNcblx0XHRjb25zdCBjdXJyZW50VGltZSA9IG1vbWVudC51dGMobW9tZW50KCkudXRjKCkuZm9ybWF0KCdkZGRkOkhIOm1tJyksICdkZGRkOkhIOm1tJyk7XG5cblx0XHQvLyBnZXQgdG9kYXlzIG9mZmljZSBob3VycyBmcm9tIGRiXG5cdFx0Y29uc3QgdG9kYXlzT2ZmaWNlSG91cnMgPSB0aGlzLmZpbmRPbmUoe2RheTogY3VycmVudFRpbWUuZm9ybWF0KCdkZGRkJyl9KTtcblx0XHRpZiAoIXRvZGF5c09mZmljZUhvdXJzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmluaXNoID0gbW9tZW50LnV0YyhgJHsgdG9kYXlzT2ZmaWNlSG91cnMuZGF5IH06JHsgdG9kYXlzT2ZmaWNlSG91cnMuZmluaXNoIH1gLCAnZGRkZDpISDptbScpO1xuXG5cdFx0cmV0dXJuIGZpbmlzaC5pc1NhbWUoY3VycmVudFRpbWUsICdtaW51dGUnKTtcblx0fVxufVxuXG5Sb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdE9mZmljZUhvdXIgPSBuZXcgTGl2ZWNoYXRPZmZpY2VIb3VyKCk7XG4iLCIvKiBnbG9iYWxzIEhUVFAgKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuaW1wb3J0IFVBUGFyc2VyIGZyb20gJ3VhLXBhcnNlci1qcyc7XG5cblJvY2tldENoYXQuTGl2ZWNoYXQgPSB7XG5cdGhpc3RvcnlNb25pdG9yVHlwZTogJ3VybCcsXG5cblx0bG9nZ2VyOiBuZXcgTG9nZ2VyKCdMaXZlY2hhdCcsIHtcblx0XHRzZWN0aW9uczoge1xuXHRcdFx0d2ViaG9vazogJ1dlYmhvb2snXG5cdFx0fVxuXHR9KSxcblxuXHRnZXROZXh0QWdlbnQoZGVwYXJ0bWVudCkge1xuXHRcdGlmIChkZXBhcnRtZW50KSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50QWdlbnRzLmdldE5leHRBZ2VudEZvckRlcGFydG1lbnQoZGVwYXJ0bWVudCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXROZXh0QWdlbnQoKTtcblx0XHR9XG5cdH0sXG5cdGdldEFnZW50cyhkZXBhcnRtZW50KSB7XG5cdFx0aWYgKGRlcGFydG1lbnQpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnRBZ2VudHMuZmluZEJ5RGVwYXJ0bWVudElkKGRlcGFydG1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZEFnZW50cygpO1xuXHRcdH1cblx0fSxcblx0Z2V0T25saW5lQWdlbnRzKGRlcGFydG1lbnQpIHtcblx0XHRpZiAoZGVwYXJ0bWVudCkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0RGVwYXJ0bWVudEFnZW50cy5nZXRPbmxpbmVGb3JEZXBhcnRtZW50KGRlcGFydG1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9ubGluZUFnZW50cygpO1xuXHRcdH1cblx0fSxcblx0Z2V0Um9vbShndWVzdCwgbWVzc2FnZSwgcm9vbUluZm8pIHtcblx0XHRsZXQgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKG1lc3NhZ2UucmlkKTtcblx0XHRsZXQgbmV3Um9vbSA9IGZhbHNlO1xuXG5cdFx0aWYgKHJvb20gJiYgIXJvb20ub3Blbikge1xuXHRcdFx0bWVzc2FnZS5yaWQgPSBSYW5kb20uaWQoKTtcblx0XHRcdHJvb20gPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmIChyb29tID09IG51bGwpIHtcblx0XHRcdC8vIGlmIG5vIGRlcGFydG1lbnQgc2VsZWN0ZWQgdmVyaWZ5IGlmIHRoZXJlIGlzIGF0IGxlYXN0IG9uZSBhY3RpdmUgYW5kIHBpY2sgdGhlIGZpcnN0XG5cdFx0XHRpZiAoIWd1ZXN0LmRlcGFydG1lbnQpIHtcblx0XHRcdFx0Y29uc3QgZGVwYXJ0bWVudHMgPSBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnQuZmluZEVuYWJsZWRXaXRoQWdlbnRzKCk7XG5cdFx0XHRcdGlmIChkZXBhcnRtZW50cy5jb3VudCgpID4gMCkge1xuXHRcdFx0XHRcdGRlcGFydG1lbnRzLmZvckVhY2goKGRlcHQpID0+IHtcblx0XHRcdFx0XHRcdGlmICghZ3Vlc3QuZGVwYXJ0bWVudCAmJiBkZXB0LnNob3dPblJlZ2lzdHJhdGlvbikge1xuXHRcdFx0XHRcdFx0XHRndWVzdC5kZXBhcnRtZW50ID0gZGVwdC5faWQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gZGVsZWdhdGUgcm9vbSBjcmVhdGlvbiB0byBRdWV1ZU1ldGhvZHNcblx0XHRcdGNvbnN0IHJvdXRpbmdNZXRob2QgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfUm91dGluZ19NZXRob2QnKTtcblx0XHRcdHJvb20gPSBSb2NrZXRDaGF0LlF1ZXVlTWV0aG9kc1tyb3V0aW5nTWV0aG9kXShndWVzdCwgbWVzc2FnZSwgcm9vbUluZm8pO1xuXG5cdFx0XHRuZXdSb29tID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cm9vbSA9IE1ldGVvci5jYWxsKCdjYW5BY2Nlc3NSb29tJywgbWVzc2FnZS5yaWQsIGd1ZXN0Ll9pZCk7XG5cdFx0fVxuXHRcdGlmICghcm9vbSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignY2Fubm90LWFjY2Vzcy1yb29tJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgcm9vbSwgbmV3Um9vbSB9O1xuXHR9LFxuXHRzZW5kTWVzc2FnZSh7IGd1ZXN0LCBtZXNzYWdlLCByb29tSW5mbyB9KSB7XG5cdFx0Y29uc3QgeyByb29tLCBuZXdSb29tIH0gPSB0aGlzLmdldFJvb20oZ3Vlc3QsIG1lc3NhZ2UsIHJvb21JbmZvKTtcblx0XHRpZiAoZ3Vlc3QubmFtZSkge1xuXHRcdFx0bWVzc2FnZS5hbGlhcyA9IGd1ZXN0Lm5hbWU7XG5cdFx0fVxuXG5cdFx0Ly8gcmV0dXJuIG1lc3NhZ2VzO1xuXHRcdHJldHVybiBfLmV4dGVuZChSb2NrZXRDaGF0LnNlbmRNZXNzYWdlKGd1ZXN0LCBtZXNzYWdlLCByb29tKSwgeyBuZXdSb29tLCBzaG93Q29ubmVjdGluZzogdGhpcy5zaG93Q29ubmVjdGluZygpIH0pO1xuXHR9LFxuXHRyZWdpc3Rlckd1ZXN0KHsgdG9rZW4sIG5hbWUsIGVtYWlsLCBkZXBhcnRtZW50LCBwaG9uZSwgbG9naW5Ub2tlbiwgdXNlcm5hbWUgfSA9IHt9KSB7XG5cdFx0Y2hlY2sodG9rZW4sIFN0cmluZyk7XG5cblx0XHRsZXQgdXNlcklkO1xuXHRcdGNvbnN0IHVwZGF0ZVVzZXIgPSB7XG5cdFx0XHQkc2V0OiB7XG5cdFx0XHRcdHByb2ZpbGU6IHtcblx0XHRcdFx0XHRndWVzdDogdHJ1ZSxcblx0XHRcdFx0XHR0b2tlblxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXRWaXNpdG9yQnlUb2tlbih0b2tlbiwgeyBmaWVsZHM6IHsgX2lkOiAxIH0gfSk7XG5cblx0XHRpZiAodXNlcikge1xuXHRcdFx0dXNlcklkID0gdXNlci5faWQ7XG5cdFx0XHRpZiAobG9naW5Ub2tlbikge1xuXHRcdFx0XHRpZiAoIXVwZGF0ZVVzZXIuJGFkZFRvU2V0KSB7XG5cdFx0XHRcdFx0dXBkYXRlVXNlci4kYWRkVG9TZXQgPSB7fTtcblx0XHRcdFx0fVxuXHRcdFx0XHR1cGRhdGVVc2VyLiRhZGRUb1NldFsnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zJ10gPSBsb2dpblRva2VuO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIXVzZXJuYW1lKSB7XG5cdFx0XHRcdHVzZXJuYW1lID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZ2V0TmV4dFZpc2l0b3JVc2VybmFtZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZXhpc3RpbmdVc2VyID0gbnVsbDtcblxuXHRcdFx0aWYgKHMudHJpbShlbWFpbCkgIT09ICcnICYmIChleGlzdGluZ1VzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lR3Vlc3RCeUVtYWlsQWRkcmVzcyhlbWFpbCkpKSB7XG5cdFx0XHRcdGlmIChsb2dpblRva2VuKSB7XG5cdFx0XHRcdFx0aWYgKCF1cGRhdGVVc2VyLiRhZGRUb1NldCkge1xuXHRcdFx0XHRcdFx0dXBkYXRlVXNlci4kYWRkVG9TZXQgPSB7fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dXBkYXRlVXNlci4kYWRkVG9TZXRbJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2VucyddID0gbG9naW5Ub2tlbjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHVzZXJJZCA9IGV4aXN0aW5nVXNlci5faWQ7XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdGNvbnN0IHVzZXJEYXRhID0ge1xuXHRcdFx0XHRcdHVzZXJuYW1lLFxuXHRcdFx0XHRcdGdsb2JhbFJvbGVzOiBbJ2xpdmVjaGF0LWd1ZXN0J10sXG5cdFx0XHRcdFx0ZGVwYXJ0bWVudCxcblx0XHRcdFx0XHR0eXBlOiAndmlzaXRvcicsXG5cdFx0XHRcdFx0am9pbkRlZmF1bHRDaGFubmVsczogZmFsc2Vcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAodGhpcy5jb25uZWN0aW9uKSB7XG5cdFx0XHRcdFx0dXNlckRhdGEudXNlckFnZW50ID0gdGhpcy5jb25uZWN0aW9uLmh0dHBIZWFkZXJzWyd1c2VyLWFnZW50J107XG5cdFx0XHRcdFx0dXNlckRhdGEuaXAgPSB0aGlzLmNvbm5lY3Rpb24uaHR0cEhlYWRlcnNbJ3gtcmVhbC1pcCddIHx8IHRoaXMuY29ubmVjdGlvbi5odHRwSGVhZGVyc1sneC1mb3J3YXJkZWQtZm9yJ10gfHwgdGhpcy5jb25uZWN0aW9uLmNsaWVudEFkZHJlc3M7XG5cdFx0XHRcdFx0dXNlckRhdGEuaG9zdCA9IHRoaXMuY29ubmVjdGlvbi5odHRwSGVhZGVycy5ob3N0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dXNlcklkID0gQWNjb3VudHMuaW5zZXJ0VXNlckRvYyh7fSwgdXNlckRhdGEpO1xuXG5cdFx0XHRcdGlmIChsb2dpblRva2VuKSB7XG5cdFx0XHRcdFx0dXBkYXRlVXNlci4kc2V0LnNlcnZpY2VzID0ge1xuXHRcdFx0XHRcdFx0cmVzdW1lOiB7XG5cdFx0XHRcdFx0XHRcdGxvZ2luVG9rZW5zOiBbIGxvZ2luVG9rZW4gXVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocGhvbmUpIHtcblx0XHRcdHVwZGF0ZVVzZXIuJHNldC5waG9uZSA9IFtcblx0XHRcdFx0eyBwaG9uZU51bWJlcjogcGhvbmUubnVtYmVyIH1cblx0XHRcdF07XG5cdFx0fVxuXG5cdFx0aWYgKGVtYWlsICYmIGVtYWlsLnRyaW0oKSAhPT0gJycpIHtcblx0XHRcdHVwZGF0ZVVzZXIuJHNldC52aXNpdG9yRW1haWxzID0gW1xuXHRcdFx0XHR7IGFkZHJlc3M6IGVtYWlsIH1cblx0XHRcdF07XG5cdFx0fVxuXG5cdFx0aWYgKG5hbWUpIHtcblx0XHRcdFJvY2tldENoYXQuX3NldFJlYWxOYW1lKHVzZXJJZCwgbmFtZSk7XG5cdFx0fVxuXG5cdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZSh1c2VySWQsIHVwZGF0ZVVzZXIpO1xuXG5cdFx0cmV0dXJuIHVzZXJJZDtcblx0fSxcblx0c2V0RGVwYXJ0bWVudEZvckd1ZXN0KHsgdG9rZW4sIGRlcGFydG1lbnQgfSA9IHt9KSB7XG5cdFx0Y2hlY2sodG9rZW4sIFN0cmluZyk7XG5cblx0XHRjb25zdCB1cGRhdGVVc2VyID0ge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRkZXBhcnRtZW50XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXRWaXNpdG9yQnlUb2tlbih0b2tlbiwgeyBmaWVsZHM6IHsgX2lkOiAxIH0gfSk7XG5cdFx0aWYgKHVzZXIpIHtcblx0XHRcdHJldHVybiBNZXRlb3IudXNlcnMudXBkYXRlKHVzZXIuX2lkLCB1cGRhdGVVc2VyKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9LFxuXHRzYXZlR3Vlc3QoeyBfaWQsIG5hbWUsIGVtYWlsLCBwaG9uZSB9KSB7XG5cdFx0Y29uc3QgdXBkYXRlRGF0YSA9IHt9O1xuXG5cdFx0aWYgKG5hbWUpIHtcblx0XHRcdHVwZGF0ZURhdGEubmFtZSA9IG5hbWU7XG5cdFx0fVxuXHRcdGlmIChlbWFpbCkge1xuXHRcdFx0dXBkYXRlRGF0YS5lbWFpbCA9IGVtYWlsO1xuXHRcdH1cblx0XHRpZiAocGhvbmUpIHtcblx0XHRcdHVwZGF0ZURhdGEucGhvbmUgPSBwaG9uZTtcblx0XHR9XG5cdFx0Y29uc3QgcmV0ID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2F2ZUd1ZXN0QnlJZChfaWQsIHVwZGF0ZURhdGEpO1xuXG5cdFx0TWV0ZW9yLmRlZmVyKCgpID0+IHtcblx0XHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignbGl2ZWNoYXQuc2F2ZUd1ZXN0JywgdXBkYXRlRGF0YSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9LFxuXG5cdGNsb3NlUm9vbSh7IHVzZXIsIHJvb20sIGNvbW1lbnQgfSkge1xuXHRcdGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuY2xvc2VCeVJvb21JZChyb29tLl9pZCwge1xuXHRcdFx0dXNlcjoge1xuXHRcdFx0XHRfaWQ6IHVzZXIuX2lkLFxuXHRcdFx0XHR1c2VybmFtZTogdXNlci51c2VybmFtZVxuXHRcdFx0fSxcblx0XHRcdGNsb3NlZEF0OiBub3csXG5cdFx0XHRjaGF0RHVyYXRpb246IChub3cuZ2V0VGltZSgpIC0gcm9vbS50cykgLyAxMDAwXG5cdFx0fSk7XG5cblx0XHRjb25zdCBtZXNzYWdlID0ge1xuXHRcdFx0dDogJ2xpdmVjaGF0LWNsb3NlJyxcblx0XHRcdG1zZzogY29tbWVudCxcblx0XHRcdGdyb3VwYWJsZTogZmFsc2Vcblx0XHR9O1xuXG5cdFx0Um9ja2V0Q2hhdC5zZW5kTWVzc2FnZSh1c2VyLCBtZXNzYWdlLCByb29tKTtcblxuXHRcdFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMuaGlkZUJ5Um9vbUlkQW5kVXNlcklkKHJvb20uX2lkLCB1c2VyLl9pZCk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlQ29tbWFuZFdpdGhSb29tSWRBbmRVc2VyKCdwcm9tcHRUcmFuc2NyaXB0Jywgcm9vbS5faWQsIHVzZXIpO1xuXG5cdFx0TWV0ZW9yLmRlZmVyKCgpID0+IHtcblx0XHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignbGl2ZWNoYXQuY2xvc2VSb29tJywgcm9vbSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSxcblxuXHRnZXRJbml0U2V0dGluZ3MoKSB7XG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSB7fTtcblxuXHRcdFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmROb3RIaWRkZW5QdWJsaWMoW1xuXHRcdFx0J0xpdmVjaGF0X3RpdGxlJyxcblx0XHRcdCdMaXZlY2hhdF90aXRsZV9jb2xvcicsXG5cdFx0XHQnTGl2ZWNoYXRfZW5hYmxlZCcsXG5cdFx0XHQnTGl2ZWNoYXRfcmVnaXN0cmF0aW9uX2Zvcm0nLFxuXHRcdFx0J0xpdmVjaGF0X2FsbG93X3N3aXRjaGluZ19kZXBhcnRtZW50cycsXG5cdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV90aXRsZScsXG5cdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV90aXRsZV9jb2xvcicsXG5cdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV9tZXNzYWdlJyxcblx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX3N1Y2Nlc3NfbWVzc2FnZScsXG5cdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV9mb3JtX3VuYXZhaWxhYmxlJyxcblx0XHRcdCdMaXZlY2hhdF9kaXNwbGF5X29mZmxpbmVfZm9ybScsXG5cdFx0XHQnTGl2ZWNoYXRfdmlkZW9jYWxsX2VuYWJsZWQnLFxuXHRcdFx0J0ppdHNpX0VuYWJsZWQnLFxuXHRcdFx0J0xhbmd1YWdlJyxcblx0XHRcdCdMaXZlY2hhdF9lbmFibGVfdHJhbnNjcmlwdCcsXG5cdFx0XHQnTGl2ZWNoYXRfdHJhbnNjcmlwdF9tZXNzYWdlJ1xuXHRcdF0pLmZvckVhY2goKHNldHRpbmcpID0+IHtcblx0XHRcdHNldHRpbmdzW3NldHRpbmcuX2lkXSA9IHNldHRpbmcudmFsdWU7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gc2V0dGluZ3M7XG5cdH0sXG5cblx0c2F2ZVJvb21JbmZvKHJvb21EYXRhLCBndWVzdERhdGEpIHtcblx0XHRpZiAoKHJvb21EYXRhLnRvcGljICE9IG51bGwgfHwgcm9vbURhdGEudGFncyAhPSBudWxsKSAmJiAhUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0VG9waWNBbmRUYWdzQnlJZChyb29tRGF0YS5faWQsIHJvb21EYXRhLnRvcGljLCByb29tRGF0YS50YWdzKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0XHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5ydW4oJ2xpdmVjaGF0LnNhdmVSb29tJywgcm9vbURhdGEpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCFfLmlzRW1wdHkoZ3Vlc3REYXRhLm5hbWUpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuc2V0TGFiZWxCeVJvb21JZChyb29tRGF0YS5faWQsIGd1ZXN0RGF0YS5uYW1lKSAmJiBSb2NrZXRDaGF0Lm1vZGVscy5TdWJzY3JpcHRpb25zLnVwZGF0ZU5hbWVCeVJvb21JZChyb29tRGF0YS5faWQsIGd1ZXN0RGF0YS5uYW1lKTtcblx0XHR9XG5cdH0sXG5cblx0Y2xvc2VPcGVuQ2hhdHModXNlcklkLCBjb21tZW50KSB7XG5cdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHVzZXJJZCk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9wZW5CeUFnZW50KHVzZXJJZCkuZm9yRWFjaCgocm9vbSkgPT4ge1xuXHRcdFx0dGhpcy5jbG9zZVJvb20oeyB1c2VyLCByb29tLCBjb21tZW50fSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Zm9yd2FyZE9wZW5DaGF0cyh1c2VySWQpIHtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT3BlbkJ5QWdlbnQodXNlcklkKS5mb3JFYWNoKChyb29tKSA9PiB7XG5cdFx0XHRjb25zdCBndWVzdCA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHJvb20udi5faWQpO1xuXHRcdFx0dGhpcy50cmFuc2Zlcihyb29tLCBndWVzdCwgeyBkZXBhcnRtZW50SWQ6IGd1ZXN0LmRlcGFydG1lbnQgfSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0c2F2ZVBhZ2VIaXN0b3J5KHRva2VuLCBwYWdlSW5mbykge1xuXHRcdGlmIChwYWdlSW5mby5jaGFuZ2UgPT09IFJvY2tldENoYXQuTGl2ZWNoYXQuaGlzdG9yeU1vbml0b3JUeXBlKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRQYWdlVmlzaXRlZC5zYXZlQnlUb2tlbih0b2tlbiwgcGFnZUluZm8pO1xuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fSxcblxuXHR0cmFuc2Zlcihyb29tLCBndWVzdCwgdHJhbnNmZXJEYXRhKSB7XG5cdFx0bGV0IGFnZW50O1xuXG5cdFx0aWYgKHRyYW5zZmVyRGF0YS51c2VySWQpIHtcblx0XHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh0cmFuc2ZlckRhdGEudXNlcklkKTtcblx0XHRcdGFnZW50ID0ge1xuXHRcdFx0XHRhZ2VudElkOiB1c2VyLl9pZCxcblx0XHRcdFx0dXNlcm5hbWU6IHVzZXIudXNlcm5hbWVcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFnZW50ID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5nZXROZXh0QWdlbnQodHJhbnNmZXJEYXRhLmRlcGFydG1lbnRJZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VydmVkQnkgPSByb29tLnNlcnZlZEJ5O1xuXG5cdFx0aWYgKGFnZW50ICYmIGFnZW50LmFnZW50SWQgIT09IHNlcnZlZEJ5Ll9pZCkge1xuXHRcdFx0cm9vbS51c2VybmFtZXMgPSBfLndpdGhvdXQocm9vbS51c2VybmFtZXMsIHNlcnZlZEJ5LnVzZXJuYW1lKS5jb25jYXQoYWdlbnQudXNlcm5hbWUpO1xuXG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5jaGFuZ2VBZ2VudEJ5Um9vbUlkKHJvb20uX2lkLCBhZ2VudCk7XG5cblx0XHRcdGNvbnN0IHN1YnNjcmlwdGlvbkRhdGEgPSB7XG5cdFx0XHRcdHJpZDogcm9vbS5faWQsXG5cdFx0XHRcdG5hbWU6IGd1ZXN0Lm5hbWUgfHwgZ3Vlc3QudXNlcm5hbWUsXG5cdFx0XHRcdGFsZXJ0OiB0cnVlLFxuXHRcdFx0XHRvcGVuOiB0cnVlLFxuXHRcdFx0XHR1bnJlYWQ6IDEsXG5cdFx0XHRcdHVzZXJNZW50aW9uczogMSxcblx0XHRcdFx0Z3JvdXBNZW50aW9uczogMCxcblx0XHRcdFx0Y29kZTogcm9vbS5jb2RlLFxuXHRcdFx0XHR1OiB7XG5cdFx0XHRcdFx0X2lkOiBhZ2VudC5hZ2VudElkLFxuXHRcdFx0XHRcdHVzZXJuYW1lOiBhZ2VudC51c2VybmFtZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0OiAnbCcsXG5cdFx0XHRcdGRlc2t0b3BOb3RpZmljYXRpb25zOiAnYWxsJyxcblx0XHRcdFx0bW9iaWxlUHVzaE5vdGlmaWNhdGlvbnM6ICdhbGwnLFxuXHRcdFx0XHRlbWFpbE5vdGlmaWNhdGlvbnM6ICdhbGwnXG5cdFx0XHR9O1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5yZW1vdmVCeVJvb21JZEFuZFVzZXJJZChyb29tLl9pZCwgc2VydmVkQnkuX2lkKTtcblxuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5pbnNlcnQoc3Vic2NyaXB0aW9uRGF0YSk7XG5cblx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVVzZXJMZWF2ZVdpdGhSb29tSWRBbmRVc2VyKHJvb20uX2lkLCB7IF9pZDogc2VydmVkQnkuX2lkLCB1c2VybmFtZTogc2VydmVkQnkudXNlcm5hbWUgfSk7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5jcmVhdGVVc2VySm9pbldpdGhSb29tSWRBbmRVc2VyKHJvb20uX2lkLCB7IF9pZDogYWdlbnQuYWdlbnRJZCwgdXNlcm5hbWU6IGFnZW50LnVzZXJuYW1lIH0pO1xuXG5cdFx0XHRSb2NrZXRDaGF0LkxpdmVjaGF0LnN0cmVhbS5lbWl0KHJvb20uX2lkLCB7XG5cdFx0XHRcdHR5cGU6ICdhZ2VudERhdGEnLFxuXHRcdFx0XHRkYXRhOiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5nZXRBZ2VudEluZm8oYWdlbnQuYWdlbnRJZClcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0sXG5cblx0c2VuZFJlcXVlc3QocG9zdERhdGEsIGNhbGxiYWNrLCB0cnlpbmcgPSAxKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHQnWC1Sb2NrZXRDaGF0LUxpdmVjaGF0LVRva2VuJzogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X3NlY3JldF90b2tlbicpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRhdGE6IHBvc3REYXRhXG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIEhUVFAucG9zdChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfd2ViaG9va1VybCcpLCBvcHRpb25zKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRSb2NrZXRDaGF0LkxpdmVjaGF0LmxvZ2dlci53ZWJob29rLmVycm9yKGBSZXNwb25zZSBlcnJvciBvbiAkeyB0cnlpbmcgfSB0cnkgLT5gLCBlKTtcblx0XHRcdC8vIHRyeSAxMCB0aW1lcyBhZnRlciAxMCBzZWNvbmRzIGVhY2hcblx0XHRcdGlmICh0cnlpbmcgPCAxMCkge1xuXHRcdFx0XHRSb2NrZXRDaGF0LkxpdmVjaGF0LmxvZ2dlci53ZWJob29rLndhcm4oJ1dpbGwgdHJ5IGFnYWluIGluIDEwIHNlY29uZHMgLi4uJyk7XG5cdFx0XHRcdHRyeWluZysrO1xuXHRcdFx0XHRzZXRUaW1lb3V0KE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge1xuXHRcdFx0XHRcdFJvY2tldENoYXQuTGl2ZWNoYXQuc2VuZFJlcXVlc3QocG9zdERhdGEsIGNhbGxiYWNrLCB0cnlpbmcpO1xuXHRcdFx0XHR9KSwgMTAwMDApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHRnZXRMaXZlY2hhdFJvb21HdWVzdEluZm8ocm9vbSkge1xuXHRcdGNvbnN0IHZpc2l0b3IgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZChyb29tLnYuX2lkKTtcblx0XHRjb25zdCBhZ2VudCA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHJvb20uc2VydmVkQnkuX2lkKTtcblxuXHRcdGNvbnN0IHVhID0gbmV3IFVBUGFyc2VyKCk7XG5cdFx0dWEuc2V0VUEodmlzaXRvci51c2VyQWdlbnQpO1xuXG5cdFx0Y29uc3QgcG9zdERhdGEgPSB7XG5cdFx0XHRfaWQ6IHJvb20uX2lkLFxuXHRcdFx0bGFiZWw6IHJvb20ubGFiZWwsXG5cdFx0XHR0b3BpYzogcm9vbS50b3BpYyxcblx0XHRcdGNvZGU6IHJvb20uY29kZSxcblx0XHRcdGNyZWF0ZWRBdDogcm9vbS50cyxcblx0XHRcdGxhc3RNZXNzYWdlQXQ6IHJvb20ubG0sXG5cdFx0XHR0YWdzOiByb29tLnRhZ3MsXG5cdFx0XHRjdXN0b21GaWVsZHM6IHJvb20ubGl2ZWNoYXREYXRhLFxuXHRcdFx0dmlzaXRvcjoge1xuXHRcdFx0XHRfaWQ6IHZpc2l0b3IuX2lkLFxuXHRcdFx0XHRuYW1lOiB2aXNpdG9yLm5hbWUsXG5cdFx0XHRcdHVzZXJuYW1lOiB2aXNpdG9yLnVzZXJuYW1lLFxuXHRcdFx0XHRlbWFpbDogbnVsbCxcblx0XHRcdFx0cGhvbmU6IG51bGwsXG5cdFx0XHRcdGRlcGFydG1lbnQ6IHZpc2l0b3IuZGVwYXJ0bWVudCxcblx0XHRcdFx0aXA6IHZpc2l0b3IuaXAsXG5cdFx0XHRcdG9zOiB1YS5nZXRPUygpLm5hbWUgJiYgKGAkeyB1YS5nZXRPUygpLm5hbWUgfSAkeyB1YS5nZXRPUygpLnZlcnNpb24gfWApLFxuXHRcdFx0XHRicm93c2VyOiB1YS5nZXRCcm93c2VyKCkubmFtZSAmJiAoYCR7IHVhLmdldEJyb3dzZXIoKS5uYW1lIH0gJHsgdWEuZ2V0QnJvd3NlcigpLnZlcnNpb24gfWApLFxuXHRcdFx0XHRjdXN0b21GaWVsZHM6IHZpc2l0b3IubGl2ZWNoYXREYXRhXG5cdFx0XHR9LFxuXHRcdFx0YWdlbnQ6IHtcblx0XHRcdFx0X2lkOiBhZ2VudC5faWQsXG5cdFx0XHRcdHVzZXJuYW1lOiBhZ2VudC51c2VybmFtZSxcblx0XHRcdFx0bmFtZTogYWdlbnQubmFtZSxcblx0XHRcdFx0ZW1haWw6IG51bGxcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHJvb20uY3JtRGF0YSkge1xuXHRcdFx0cG9zdERhdGEuY3JtRGF0YSA9IHJvb20uY3JtRGF0YTtcblx0XHR9XG5cblx0XHRpZiAodmlzaXRvci52aXNpdG9yRW1haWxzICYmIHZpc2l0b3IudmlzaXRvckVtYWlscy5sZW5ndGggPiAwKSB7XG5cdFx0XHRwb3N0RGF0YS52aXNpdG9yLmVtYWlsID0gdmlzaXRvci52aXNpdG9yRW1haWxzWzBdLmFkZHJlc3M7XG5cdFx0fVxuXHRcdGlmICh2aXNpdG9yLnBob25lICYmIHZpc2l0b3IucGhvbmUubGVuZ3RoID4gMCkge1xuXHRcdFx0cG9zdERhdGEudmlzaXRvci5waG9uZSA9IHZpc2l0b3IucGhvbmVbMF0ucGhvbmVOdW1iZXI7XG5cdFx0fVxuXG5cdFx0aWYgKGFnZW50LmVtYWlscyAmJiBhZ2VudC5lbWFpbHMubGVuZ3RoID4gMCkge1xuXHRcdFx0cG9zdERhdGEuYWdlbnQuZW1haWwgPSBhZ2VudC5lbWFpbHNbMF0uYWRkcmVzcztcblx0XHR9XG5cblx0XHRyZXR1cm4gcG9zdERhdGE7XG5cdH0sXG5cblx0YWRkQWdlbnQodXNlcm5hbWUpIHtcblx0XHRjaGVjayh1c2VybmFtZSwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1c2VybmFtZSwgeyBmaWVsZHM6IHsgX2lkOiAxLCB1c2VybmFtZTogMSB9IH0pO1xuXG5cdFx0aWYgKCF1c2VyKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdsaXZlY2hhdDphZGRBZ2VudCcgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouYWRkVXNlclJvbGVzKHVzZXIuX2lkLCAnbGl2ZWNoYXQtYWdlbnQnKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0T3BlcmF0b3IodXNlci5faWQsIHRydWUpO1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0TGl2ZWNoYXRTdGF0dXModXNlci5faWQsICdhdmFpbGFibGUnKTtcblx0XHRcdHJldHVybiB1c2VyO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fSxcblxuXHRhZGRNYW5hZ2VyKHVzZXJuYW1lKSB7XG5cdFx0Y2hlY2sodXNlcm5hbWUsIFN0cmluZyk7XG5cblx0XHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5VXNlcm5hbWUodXNlcm5hbWUsIHsgZmllbGRzOiB7IF9pZDogMSwgdXNlcm5hbWU6IDEgfSB9KTtcblxuXHRcdGlmICghdXNlcikge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnbGl2ZWNoYXQ6YWRkTWFuYWdlcicgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouYWRkVXNlclJvbGVzKHVzZXIuX2lkLCAnbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHRyZXR1cm4gdXNlcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0sXG5cblx0cmVtb3ZlQWdlbnQodXNlcm5hbWUpIHtcblx0XHRjaGVjayh1c2VybmFtZSwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1c2VybmFtZSwgeyBmaWVsZHM6IHsgX2lkOiAxIH0gfSk7XG5cblx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnJlbW92ZUFnZW50JyB9KTtcblx0XHR9XG5cblx0XHRpZiAoUm9ja2V0Q2hhdC5hdXRoei5yZW1vdmVVc2VyRnJvbVJvbGVzKHVzZXIuX2lkLCAnbGl2ZWNoYXQtYWdlbnQnKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuc2V0T3BlcmF0b3IodXNlci5faWQsIGZhbHNlKTtcblx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnNldExpdmVjaGF0U3RhdHVzKHVzZXIuX2lkLCAnbm90LWF2YWlsYWJsZScpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9LFxuXG5cdHJlbW92ZU1hbmFnZXIodXNlcm5hbWUpIHtcblx0XHRjaGVjayh1c2VybmFtZSwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlVc2VybmFtZSh1c2VybmFtZSwgeyBmaWVsZHM6IHsgX2lkOiAxIH0gfSk7XG5cblx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnJlbW92ZU1hbmFnZXInIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0LmF1dGh6LnJlbW92ZVVzZXJGcm9tUm9sZXModXNlci5faWQsICdsaXZlY2hhdC1tYW5hZ2VyJyk7XG5cdH0sXG5cblx0c2F2ZURlcGFydG1lbnQoX2lkLCBkZXBhcnRtZW50RGF0YSwgZGVwYXJ0bWVudEFnZW50cykge1xuXHRcdGNoZWNrKF9pZCwgTWF0Y2guTWF5YmUoU3RyaW5nKSk7XG5cblx0XHRjaGVjayhkZXBhcnRtZW50RGF0YSwge1xuXHRcdFx0ZW5hYmxlZDogQm9vbGVhbixcblx0XHRcdG5hbWU6IFN0cmluZyxcblx0XHRcdGRlc2NyaXB0aW9uOiBNYXRjaC5PcHRpb25hbChTdHJpbmcpLFxuXHRcdFx0c2hvd09uUmVnaXN0cmF0aW9uOiBCb29sZWFuXG5cdFx0fSk7XG5cblx0XHRjaGVjayhkZXBhcnRtZW50QWdlbnRzLCBbXG5cdFx0XHRNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuXHRcdFx0XHRhZ2VudElkOiBTdHJpbmcsXG5cdFx0XHRcdHVzZXJuYW1lOiBTdHJpbmdcblx0XHRcdH0pXG5cdFx0XSk7XG5cblx0XHRpZiAoX2lkKSB7XG5cdFx0XHRjb25zdCBkZXBhcnRtZW50ID0gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50LmZpbmRPbmVCeUlkKF9pZCk7XG5cdFx0XHRpZiAoIWRlcGFydG1lbnQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItZGVwYXJ0bWVudC1ub3QtZm91bmQnLCAnRGVwYXJ0bWVudCBub3QgZm91bmQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnNhdmVEZXBhcnRtZW50JyB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50LmNyZWF0ZU9yVXBkYXRlRGVwYXJ0bWVudChfaWQsIGRlcGFydG1lbnREYXRhLCBkZXBhcnRtZW50QWdlbnRzKTtcblx0fSxcblxuXHRyZW1vdmVEZXBhcnRtZW50KF9pZCkge1xuXHRcdGNoZWNrKF9pZCwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IGRlcGFydG1lbnQgPSBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnQuZmluZE9uZUJ5SWQoX2lkLCB7IGZpZWxkczogeyBfaWQ6IDEgfSB9KTtcblxuXHRcdGlmICghZGVwYXJ0bWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZGVwYXJ0bWVudC1ub3QtZm91bmQnLCAnRGVwYXJ0bWVudCBub3QgZm91bmQnLCB7IG1ldGhvZDogJ2xpdmVjaGF0OnJlbW92ZURlcGFydG1lbnQnIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnQucmVtb3ZlQnlJZChfaWQpO1xuXHR9LFxuXG5cdHNob3dDb25uZWN0aW5nKCkge1xuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfUm91dGluZ19NZXRob2QnKSA9PT0gJ0d1ZXN0X1Bvb2wnKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X29wZW5faW5xdWllcnlfc2hvd19jb25uZWN0aW5nJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cbn07XG5cblJvY2tldENoYXQuTGl2ZWNoYXQuc3RyZWFtID0gbmV3IE1ldGVvci5TdHJlYW1lcignbGl2ZWNoYXQtcm9vbScpO1xuUm9ja2V0Q2hhdC5MaXZlY2hhdC5zdHJlYW0uYWxsb3dSZWFkKCdsb2dnZWQnKTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X2hpc3RvcnlfbW9uaXRvcl90eXBlJywgKGtleSwgdmFsdWUpID0+IHtcblx0Um9ja2V0Q2hhdC5MaXZlY2hhdC5oaXN0b3J5TW9uaXRvclR5cGUgPSB2YWx1ZTtcbn0pO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cblJvY2tldENoYXQuUXVldWVNZXRob2RzID0ge1xuXHQvKiBMZWFzdCBBbW91bnQgUXVldWluZyBtZXRob2Q6XG5cdCAqXG5cdCAqIGRlZmF1bHQgbWV0aG9kIHdoZXJlIHRoZSBhZ2VudCB3aXRoIHRoZSBsZWFzdCBudW1iZXJcblx0ICogb2Ygb3BlbiBjaGF0cyBpcyBwYWlyZWQgd2l0aCB0aGUgaW5jb21pbmcgbGl2ZWNoYXRcblx0ICovXG5cdCdMZWFzdF9BbW91bnQnKGd1ZXN0LCBtZXNzYWdlLCByb29tSW5mbykge1xuXHRcdGNvbnN0IGFnZW50ID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5nZXROZXh0QWdlbnQoZ3Vlc3QuZGVwYXJ0bWVudCk7XG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm8tYWdlbnQtb25saW5lJywgJ1NvcnJ5LCBubyBvbmxpbmUgYWdlbnRzJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vbUNvZGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5nZXROZXh0TGl2ZWNoYXRSb29tQ29kZSgpO1xuXG5cdFx0Y29uc3Qgcm9vbSA9IF8uZXh0ZW5kKHtcblx0XHRcdF9pZDogbWVzc2FnZS5yaWQsXG5cdFx0XHRtc2dzOiAxLFxuXHRcdFx0bG06IG5ldyBEYXRlKCksXG5cdFx0XHRjb2RlOiByb29tQ29kZSxcblx0XHRcdGxhYmVsOiBndWVzdC5uYW1lIHx8IGd1ZXN0LnVzZXJuYW1lLFxuXHRcdFx0Ly8gdXNlcm5hbWVzOiBbYWdlbnQudXNlcm5hbWUsIGd1ZXN0LnVzZXJuYW1lXSxcblx0XHRcdHQ6ICdsJyxcblx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0djoge1xuXHRcdFx0XHRfaWQ6IGd1ZXN0Ll9pZCxcblx0XHRcdFx0dXNlcm5hbWU6IGd1ZXN0LnVzZXJuYW1lLFxuXHRcdFx0XHR0b2tlbjogbWVzc2FnZS50b2tlblxuXHRcdFx0fSxcblx0XHRcdHNlcnZlZEJ5OiB7XG5cdFx0XHRcdF9pZDogYWdlbnQuYWdlbnRJZCxcblx0XHRcdFx0dXNlcm5hbWU6IGFnZW50LnVzZXJuYW1lXG5cdFx0XHR9LFxuXHRcdFx0Y2w6IGZhbHNlLFxuXHRcdFx0b3BlbjogdHJ1ZSxcblx0XHRcdHdhaXRpbmdSZXNwb25zZTogdHJ1ZVxuXHRcdH0sIHJvb21JbmZvKTtcblx0XHRjb25zdCBzdWJzY3JpcHRpb25EYXRhID0ge1xuXHRcdFx0cmlkOiBtZXNzYWdlLnJpZCxcblx0XHRcdG5hbWU6IGd1ZXN0Lm5hbWUgfHwgZ3Vlc3QudXNlcm5hbWUsXG5cdFx0XHRhbGVydDogdHJ1ZSxcblx0XHRcdG9wZW46IHRydWUsXG5cdFx0XHR1bnJlYWQ6IDEsXG5cdFx0XHR1c2VyTWVudGlvbnM6IDEsXG5cdFx0XHRncm91cE1lbnRpb25zOiAwLFxuXHRcdFx0Y29kZTogcm9vbUNvZGUsXG5cdFx0XHR1OiB7XG5cdFx0XHRcdF9pZDogYWdlbnQuYWdlbnRJZCxcblx0XHRcdFx0dXNlcm5hbWU6IGFnZW50LnVzZXJuYW1lXG5cdFx0XHR9LFxuXHRcdFx0dDogJ2wnLFxuXHRcdFx0ZGVza3RvcE5vdGlmaWNhdGlvbnM6ICdhbGwnLFxuXHRcdFx0bW9iaWxlUHVzaE5vdGlmaWNhdGlvbnM6ICdhbGwnLFxuXHRcdFx0ZW1haWxOb3RpZmljYXRpb25zOiAnYWxsJ1xuXHRcdH07XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5pbnNlcnQocm9vbSk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5pbnNlcnQoc3Vic2NyaXB0aW9uRGF0YSk7XG5cblx0XHRSb2NrZXRDaGF0LkxpdmVjaGF0LnN0cmVhbS5lbWl0KHJvb20uX2lkLCB7XG5cdFx0XHR0eXBlOiAnYWdlbnREYXRhJyxcblx0XHRcdGRhdGE6IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldEFnZW50SW5mbyhhZ2VudC5hZ2VudElkKVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJvb207XG5cdH0sXG5cdC8qIEd1ZXN0IFBvb2wgUXVldWluZyBNZXRob2Q6XG5cdCAqXG5cdCAqIEFuIGluY29tbWluZyBsaXZlY2hhdCBpcyBjcmVhdGVkIGFzIGFuIElucXVpcnlcblx0ICogd2hpY2ggaXMgcGlja2VkIHVwIGZyb20gYW4gYWdlbnQuXG5cdCAqIEFuIElucXVpcnkgaXMgdmlzaWJsZSB0byBhbGwgYWdlbnRzIChUT0RPOiBpbiB0aGUgY29ycmVjdCBkZXBhcnRtZW50KVxuICAgICAqXG5cdCAqIEEgcm9vbSBpcyBzdGlsbCBjcmVhdGVkIHdpdGggdGhlIGluaXRpYWwgbWVzc2FnZSwgYnV0IGl0IGlzIG9jY3VwaWVkIGJ5XG5cdCAqIG9ubHkgdGhlIGNsaWVudCB1bnRpbCBwYWlyZWQgd2l0aCBhbiBhZ2VudFxuXHQgKi9cblx0J0d1ZXN0X1Bvb2wnKGd1ZXN0LCBtZXNzYWdlLCByb29tSW5mbykge1xuXHRcdGxldCBhZ2VudHMgPSBSb2NrZXRDaGF0LkxpdmVjaGF0LmdldE9ubGluZUFnZW50cyhndWVzdC5kZXBhcnRtZW50KTtcblxuXHRcdGlmIChhZ2VudHMuY291bnQoKSA9PT0gMCAmJiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfZ3Vlc3RfcG9vbF93aXRoX25vX2FnZW50cycpKSB7XG5cdFx0XHRhZ2VudHMgPSBSb2NrZXRDaGF0LkxpdmVjaGF0LmdldEFnZW50cyhndWVzdC5kZXBhcnRtZW50KTtcblx0XHR9XG5cblx0XHRpZiAoYWdlbnRzLmNvdW50KCkgPT09IDApIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vLWFnZW50LW9ubGluZScsICdTb3JyeSwgbm8gb25saW5lIGFnZW50cycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb21Db2RlID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZ2V0TmV4dExpdmVjaGF0Um9vbUNvZGUoKTtcblxuXHRcdGNvbnN0IGFnZW50SWRzID0gW107XG5cblx0XHRhZ2VudHMuZm9yRWFjaCgoYWdlbnQpID0+IHtcblx0XHRcdGlmIChndWVzdC5kZXBhcnRtZW50KSB7XG5cdFx0XHRcdGFnZW50SWRzLnB1c2goYWdlbnQuYWdlbnRJZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhZ2VudElkcy5wdXNoKGFnZW50Ll9pZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBpbnF1aXJ5ID0ge1xuXHRcdFx0cmlkOiBtZXNzYWdlLnJpZCxcblx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2UubXNnLFxuXHRcdFx0bmFtZTogZ3Vlc3QubmFtZSB8fCBndWVzdC51c2VybmFtZSxcblx0XHRcdHRzOiBuZXcgRGF0ZSgpLFxuXHRcdFx0Y29kZTogcm9vbUNvZGUsXG5cdFx0XHRkZXBhcnRtZW50OiBndWVzdC5kZXBhcnRtZW50LFxuXHRcdFx0YWdlbnRzOiBhZ2VudElkcyxcblx0XHRcdHN0YXR1czogJ29wZW4nLFxuXHRcdFx0djoge1xuXHRcdFx0XHRfaWQ6IGd1ZXN0Ll9pZCxcblx0XHRcdFx0dXNlcm5hbWU6IGd1ZXN0LnVzZXJuYW1lLFxuXHRcdFx0XHR0b2tlbjogbWVzc2FnZS50b2tlblxuXHRcdFx0fSxcblx0XHRcdHQ6ICdsJ1xuXHRcdH07XG5cdFx0Y29uc3Qgcm9vbSA9IF8uZXh0ZW5kKHtcblx0XHRcdF9pZDogbWVzc2FnZS5yaWQsXG5cdFx0XHRtc2dzOiAxLFxuXHRcdFx0bG06IG5ldyBEYXRlKCksXG5cdFx0XHRjb2RlOiByb29tQ29kZSxcblx0XHRcdGxhYmVsOiBndWVzdC5uYW1lIHx8IGd1ZXN0LnVzZXJuYW1lLFxuXHRcdFx0Ly8gdXNlcm5hbWVzOiBbZ3Vlc3QudXNlcm5hbWVdLFxuXHRcdFx0dDogJ2wnLFxuXHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHR2OiB7XG5cdFx0XHRcdF9pZDogZ3Vlc3QuX2lkLFxuXHRcdFx0XHR1c2VybmFtZTogZ3Vlc3QudXNlcm5hbWUsXG5cdFx0XHRcdHRva2VuOiBtZXNzYWdlLnRva2VuXG5cdFx0XHR9LFxuXHRcdFx0Y2w6IGZhbHNlLFxuXHRcdFx0b3BlbjogdHJ1ZSxcblx0XHRcdHdhaXRpbmdSZXNwb25zZTogdHJ1ZVxuXHRcdH0sIHJvb21JbmZvKTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdElucXVpcnkuaW5zZXJ0KGlucXVpcnkpO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLmluc2VydChyb29tKTtcblxuXHRcdHJldHVybiByb29tO1xuXHR9XG59O1xuIiwiLy8gRXZlcnkgbWludXRlIGNoZWNrIGlmIG9mZmljZSBjbG9zZWRcbk1ldGVvci5zZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcblx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9lbmFibGVfb2ZmaWNlX2hvdXJzJykpIHtcblx0XHRpZiAoUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRPZmZpY2VIb3VyLmlzT3BlbmluZ1RpbWUoKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMub3Blbk9mZmljZSgpO1xuXHRcdH0gZWxzZSBpZiAoUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRPZmZpY2VIb3VyLmlzQ2xvc2luZ1RpbWUoKSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuY2xvc2VPZmZpY2UoKTtcblx0XHR9XG5cdH1cbn0sIDYwMDAwKTtcbiIsImNvbnN0IGdhdGV3YXlVUkwgPSAnaHR0cHM6Ly9vbW5pLnJvY2tldC5jaGF0JztcblxuZXhwb3J0IGRlZmF1bHQge1xuXHRlbmFibGUoKSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gSFRUUC5jYWxsKCdQT1NUJywgYCR7IGdhdGV3YXlVUkwgfS9mYWNlYm9vay9lbmFibGVgLCB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdhdXRob3JpemF0aW9uJzogYEJlYXJlciAkeyBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfRmFjZWJvb2tfQVBJX0tleScpIH1gLFxuXHRcdFx0XHQnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHR1cmw6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTaXRlX1VybCcpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdC5kYXRhO1xuXHR9LFxuXG5cdGRpc2FibGUoKSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gSFRUUC5jYWxsKCdERUxFVEUnLCBgJHsgZ2F0ZXdheVVSTCB9L2ZhY2Vib29rL2VuYWJsZWAsIHtcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J2F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9GYWNlYm9va19BUElfS2V5JykgfWAsXG5cdFx0XHRcdCdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0LmRhdGE7XG5cdH0sXG5cblx0bGlzdFBhZ2VzKCkge1xuXHRcdGNvbnN0IHJlc3VsdCA9IEhUVFAuY2FsbCgnR0VUJywgYCR7IGdhdGV3YXlVUkwgfS9mYWNlYm9vay9wYWdlc2AsIHtcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J2F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9GYWNlYm9va19BUElfS2V5JykgfWBcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0LmRhdGE7XG5cdH0sXG5cblx0c3Vic2NyaWJlKHBhZ2VJZCkge1xuXHRcdGNvbnN0IHJlc3VsdCA9IEhUVFAuY2FsbCgnUE9TVCcsIGAkeyBnYXRld2F5VVJMIH0vZmFjZWJvb2svcGFnZS8keyBwYWdlSWQgfS9zdWJzY3JpYmVgLCB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdhdXRob3JpemF0aW9uJzogYEJlYXJlciAkeyBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfRmFjZWJvb2tfQVBJX0tleScpIH1gXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdC5kYXRhO1xuXHR9LFxuXG5cdHVuc3Vic2NyaWJlKHBhZ2VJZCkge1xuXHRcdGNvbnN0IHJlc3VsdCA9IEhUVFAuY2FsbCgnREVMRVRFJywgYCR7IGdhdGV3YXlVUkwgfS9mYWNlYm9vay9wYWdlLyR7IHBhZ2VJZCB9L3N1YnNjcmliZWAsIHtcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J2F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9GYWNlYm9va19BUElfS2V5JykgfWBcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0LmRhdGE7XG5cdH0sXG5cblx0cmVwbHkoeyBwYWdlLCB0b2tlbiwgdGV4dCB9KSB7XG5cdFx0cmV0dXJuIEhUVFAuY2FsbCgnUE9TVCcsIGAkeyBnYXRld2F5VVJMIH0vZmFjZWJvb2svcmVwbHlgLCB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdhdXRob3JpemF0aW9uJzogYEJlYXJlciAkeyBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfRmFjZWJvb2tfQVBJX0tleScpIH1gXG5cdFx0XHR9LFxuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHRwYWdlLFxuXHRcdFx0XHR0b2tlbixcblx0XHRcdFx0dGV4dFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59O1xuIiwiUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlclNhdmVNZXNzYWdlJywgZnVuY3Rpb24obWVzc2FnZSwgcm9vbSkge1xuXHQvLyBza2lwcyB0aGlzIGNhbGxiYWNrIGlmIHRoZSBtZXNzYWdlIHdhcyBlZGl0ZWRcblx0aWYgKG1lc3NhZ2UuZWRpdGVkQXQpIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdGlmICghUm9ja2V0Q2hhdC5TTVMuZW5hYmxlZCkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gb25seSBzZW5kIHRoZSBzbXMgYnkgU01TIGlmIGl0IGlzIGEgbGl2ZWNoYXQgcm9vbSB3aXRoIFNNUyBzZXQgdG8gdHJ1ZVxuXHRpZiAoISh0eXBlb2Ygcm9vbS50ICE9PSAndW5kZWZpbmVkJyAmJiByb29tLnQgPT09ICdsJyAmJiByb29tLnNtcyAmJiByb29tLnYgJiYgcm9vbS52LnRva2VuKSkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gaWYgdGhlIG1lc3NhZ2UgaGFzIGEgdG9rZW4sIGl0IHdhcyBzZW50IGZyb20gdGhlIHZpc2l0b3IsIHNvIGlnbm9yZSBpdFxuXHRpZiAobWVzc2FnZS50b2tlbikge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Ly8gaWYgdGhlIG1lc3NhZ2UgaGFzIGEgdHlwZSBtZWFucyBpdCBpcyBhIHNwZWNpYWwgbWVzc2FnZSAobGlrZSB0aGUgY2xvc2luZyBjb21tZW50KSwgc28gc2tpcHNcblx0aWYgKG1lc3NhZ2UudCkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Y29uc3QgU01TU2VydmljZSA9IFJvY2tldENoYXQuU01TLmdldFNlcnZpY2UoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NNU19TZXJ2aWNlJykpO1xuXG5cdGlmICghU01TU2VydmljZSkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0Y29uc3QgdmlzaXRvciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmdldFZpc2l0b3JCeVRva2VuKHJvb20udi50b2tlbik7XG5cblx0aWYgKCF2aXNpdG9yIHx8ICF2aXNpdG9yLnByb2ZpbGUgfHwgIXZpc2l0b3IucGhvbmUgfHwgdmlzaXRvci5waG9uZS5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxuXG5cdFNNU1NlcnZpY2Uuc2VuZChyb29tLnNtcy5mcm9tLCB2aXNpdG9yLnBob25lWzBdLnBob25lTnVtYmVyLCBtZXNzYWdlLm1zZyk7XG5cblx0cmV0dXJuIG1lc3NhZ2U7XG5cbn0sIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ3NlbmRNZXNzYWdlQnlTbXMnKTtcbiIsIi8qIGdsb2JhbHMgVXNlclByZXNlbmNlTW9uaXRvciAqL1xuXG5sZXQgYWdlbnRzSGFuZGxlcjtcbmxldCBtb25pdG9yQWdlbnRzID0gZmFsc2U7XG5sZXQgYWN0aW9uVGltZW91dCA9IDYwMDAwO1xuXG5jb25zdCBvbmxpbmVBZ2VudHMgPSB7XG5cdHVzZXJzOiB7fSxcblx0cXVldWU6IHt9LFxuXG5cdGFkZCh1c2VySWQpIHtcblx0XHRpZiAodGhpcy5xdWV1ZVt1c2VySWRdKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5xdWV1ZVt1c2VySWRdKTtcblx0XHRcdGRlbGV0ZSB0aGlzLnF1ZXVlW3VzZXJJZF07XG5cdFx0fVxuXHRcdHRoaXMudXNlcnNbdXNlcklkXSA9IDE7XG5cdH0sXG5cblx0cmVtb3ZlKHVzZXJJZCwgY2FsbGJhY2spIHtcblx0XHRpZiAodGhpcy5xdWV1ZVt1c2VySWRdKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5xdWV1ZVt1c2VySWRdKTtcblx0XHR9XG5cdFx0dGhpcy5xdWV1ZVt1c2VySWRdID0gc2V0VGltZW91dChNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcblx0XHRcdGNhbGxiYWNrKCk7XG5cblx0XHRcdGRlbGV0ZSB0aGlzLnVzZXJzW3VzZXJJZF07XG5cdFx0XHRkZWxldGUgdGhpcy5xdWV1ZVt1c2VySWRdO1xuXHRcdH0pLCBhY3Rpb25UaW1lb3V0KTtcblx0fSxcblxuXHRleGlzdHModXNlcklkKSB7XG5cdFx0cmV0dXJuICEhdGhpcy51c2Vyc1t1c2VySWRdO1xuXHR9XG59O1xuXG5mdW5jdGlvbiBydW5BZ2VudExlYXZlQWN0aW9uKHVzZXJJZCkge1xuXHRjb25zdCBhY3Rpb24gPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfYWdlbnRfbGVhdmVfYWN0aW9uJyk7XG5cdGlmIChhY3Rpb24gPT09ICdjbG9zZScpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5MaXZlY2hhdC5jbG9zZU9wZW5DaGF0cyh1c2VySWQsIFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9hZ2VudF9sZWF2ZV9jb21tZW50JykpO1xuXHR9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2ZvcndhcmQnKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuTGl2ZWNoYXQuZm9yd2FyZE9wZW5DaGF0cyh1c2VySWQpO1xuXHR9XG59XG5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdMaXZlY2hhdF9hZ2VudF9sZWF2ZV9hY3Rpb25fdGltZW91dCcsIGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0YWN0aW9uVGltZW91dCA9IHZhbHVlICogMTAwMDtcbn0pO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfYWdlbnRfbGVhdmVfYWN0aW9uJywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRtb25pdG9yQWdlbnRzID0gdmFsdWU7XG5cdGlmICh2YWx1ZSAhPT0gJ25vbmUnKSB7XG5cdFx0aWYgKCFhZ2VudHNIYW5kbGVyKSB7XG5cdFx0XHRhZ2VudHNIYW5kbGVyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9ubGluZUFnZW50cygpLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRcdFx0YWRkZWQoaWQpIHtcblx0XHRcdFx0XHRvbmxpbmVBZ2VudHMuYWRkKGlkKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Y2hhbmdlZChpZCwgZmllbGRzKSB7XG5cdFx0XHRcdFx0aWYgKGZpZWxkcy5zdGF0dXNMaXZlY2hhdCAmJiBmaWVsZHMuc3RhdHVzTGl2ZWNoYXQgPT09ICdub3QtYXZhaWxhYmxlJykge1xuXHRcdFx0XHRcdFx0b25saW5lQWdlbnRzLnJlbW92ZShpZCwgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRydW5BZ2VudExlYXZlQWN0aW9uKGlkKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRvbmxpbmVBZ2VudHMuYWRkKGlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlbW92ZWQoaWQpIHtcblx0XHRcdFx0XHRvbmxpbmVBZ2VudHMucmVtb3ZlKGlkLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRydW5BZ2VudExlYXZlQWN0aW9uKGlkKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGFnZW50c0hhbmRsZXIpIHtcblx0XHRhZ2VudHNIYW5kbGVyLnN0b3AoKTtcblx0XHRhZ2VudHNIYW5kbGVyID0gbnVsbDtcblx0fVxufSk7XG5cblVzZXJQcmVzZW5jZU1vbml0b3Iub25TZXRVc2VyU3RhdHVzKCh1c2VyLCBzdGF0dXMvKiwgc3RhdHVzQ29ubmVjdGlvbiovKSA9PiB7XG5cdGlmICghbW9uaXRvckFnZW50cykge1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAob25saW5lQWdlbnRzLmV4aXN0cyh1c2VyLl9pZCkpIHtcblx0XHRpZiAoc3RhdHVzID09PSAnb2ZmbGluZScgfHwgdXNlci5zdGF0dXNMaXZlY2hhdCA9PT0gJ25vdC1hdmFpbGFibGUnKSB7XG5cdFx0XHRvbmxpbmVBZ2VudHMucmVtb3ZlKHVzZXIuX2lkLCAoKSA9PiB7XG5cdFx0XHRcdHJ1bkFnZW50TGVhdmVBY3Rpb24odXNlci5faWQpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59KTtcbiIsImltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcblxuTWV0ZW9yLnB1Ymxpc2goJ2xpdmVjaGF0OmN1c3RvbUZpZWxkcycsIGZ1bmN0aW9uKF9pZCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDpjdXN0b21GaWVsZHMnIH0pKTtcblx0fVxuXG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1sLXJvb20nKSkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBwdWJsaXNoOiAnbGl2ZWNoYXQ6Y3VzdG9tRmllbGRzJyB9KSk7XG5cdH1cblxuXHRpZiAocy50cmltKF9pZCkpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRDdXN0b21GaWVsZC5maW5kKHsgX2lkIH0pO1xuXHR9XG5cblx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0Q3VzdG9tRmllbGQuZmluZCgpO1xuXG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdsaXZlY2hhdDpkZXBhcnRtZW50QWdlbnRzJywgZnVuY3Rpb24oZGVwYXJ0bWVudElkKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OmRlcGFydG1lbnRBZ2VudHMnIH0pKTtcblx0fVxuXG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1saXZlY2hhdC1yb29tcycpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDpkZXBhcnRtZW50QWdlbnRzJyB9KSk7XG5cdH1cblxuXHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50QWdlbnRzLmZpbmQoeyBkZXBhcnRtZW50SWQgfSk7XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdsaXZlY2hhdDpleHRlcm5hbE1lc3NhZ2VzJywgZnVuY3Rpb24ocm9vbUlkKSB7XG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdEV4dGVybmFsTWVzc2FnZS5maW5kQnlSb29tSWQocm9vbUlkKTtcbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ2xpdmVjaGF0OmFnZW50cycsIGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDphZ2VudHMnIH0pKTtcblx0fVxuXG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1sLXJvb20nKSkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBwdWJsaXNoOiAnbGl2ZWNoYXQ6YWdlbnRzJyB9KSk7XG5cdH1cblxuXHRjb25zdCBzZWxmID0gdGhpcztcblxuXHRjb25zdCBoYW5kbGUgPSBSb2NrZXRDaGF0LmF1dGh6LmdldFVzZXJzSW5Sb2xlKCdsaXZlY2hhdC1hZ2VudCcpLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRhZGRlZChpZCwgZmllbGRzKSB7XG5cdFx0XHRzZWxmLmFkZGVkKCdhZ2VudFVzZXJzJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcblx0XHRcdHNlbGYuY2hhbmdlZCgnYWdlbnRVc2VycycsIGlkLCBmaWVsZHMpO1xuXHRcdH0sXG5cdFx0cmVtb3ZlZChpZCkge1xuXHRcdFx0c2VsZi5yZW1vdmVkKCdhZ2VudFVzZXJzJywgaWQpO1xuXHRcdH1cblx0fSk7XG5cblx0c2VsZi5yZWFkeSgpO1xuXG5cdHNlbGYub25TdG9wKGZ1bmN0aW9uKCkge1xuXHRcdGhhbmRsZS5zdG9wKCk7XG5cdH0pO1xufSk7XG4iLCJNZXRlb3IucHVibGlzaCgnbGl2ZWNoYXQ6YXBwZWFyYW5jZScsIGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDphcHBlYXJhbmNlJyB9KSk7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDphcHBlYXJhbmNlJyB9KSk7XG5cdH1cblxuXHRjb25zdCBxdWVyeSA9IHtcblx0XHRfaWQ6IHtcblx0XHRcdCRpbjogW1xuXHRcdFx0XHQnTGl2ZWNoYXRfdGl0bGUnLFxuXHRcdFx0XHQnTGl2ZWNoYXRfdGl0bGVfY29sb3InLFxuXHRcdFx0XHQnTGl2ZWNoYXRfc2hvd19hZ2VudF9lbWFpbCcsXG5cdFx0XHRcdCdMaXZlY2hhdF9kaXNwbGF5X29mZmxpbmVfZm9ybScsXG5cdFx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX2Zvcm1fdW5hdmFpbGFibGUnLFxuXHRcdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV9tZXNzYWdlJyxcblx0XHRcdFx0J0xpdmVjaGF0X29mZmxpbmVfc3VjY2Vzc19tZXNzYWdlJyxcblx0XHRcdFx0J0xpdmVjaGF0X29mZmxpbmVfdGl0bGUnLFxuXHRcdFx0XHQnTGl2ZWNoYXRfb2ZmbGluZV90aXRsZV9jb2xvcicsXG5cdFx0XHRcdCdMaXZlY2hhdF9vZmZsaW5lX2VtYWlsJ1xuXHRcdFx0XVxuXHRcdH1cblx0fTtcblxuXHRjb25zdCBzZWxmID0gdGhpcztcblxuXHRjb25zdCBoYW5kbGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kKHF1ZXJ5KS5vYnNlcnZlQ2hhbmdlcyh7XG5cdFx0YWRkZWQoaWQsIGZpZWxkcykge1xuXHRcdFx0c2VsZi5hZGRlZCgnbGl2ZWNoYXRBcHBlYXJhbmNlJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcblx0XHRcdHNlbGYuY2hhbmdlZCgnbGl2ZWNoYXRBcHBlYXJhbmNlJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRyZW1vdmVkKGlkKSB7XG5cdFx0XHRzZWxmLnJlbW92ZWQoJ2xpdmVjaGF0QXBwZWFyYW5jZScsIGlkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRoaXMucmVhZHkoKTtcblxuXHR0aGlzLm9uU3RvcCgoKSA9PiB7XG5cdFx0aGFuZGxlLnN0b3AoKTtcblx0fSk7XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdsaXZlY2hhdDpkZXBhcnRtZW50cycsIGZ1bmN0aW9uKF9pZCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDphZ2VudHMnIH0pKTtcblx0fVxuXG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1sLXJvb20nKSkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBwdWJsaXNoOiAnbGl2ZWNoYXQ6YWdlbnRzJyB9KSk7XG5cdH1cblxuXHRpZiAoX2lkICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50LmZpbmRCeURlcGFydG1lbnRJZChfaWQpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnQuZmluZCgpO1xuXHR9XG5cbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ2xpdmVjaGF0OmludGVncmF0aW9uJywgZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OmludGVncmF0aW9uJyB9KSk7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDppbnRlZ3JhdGlvbicgfSkpO1xuXHR9XG5cblx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cblx0Y29uc3QgaGFuZGxlID0gUm9ja2V0Q2hhdC5tb2RlbHMuU2V0dGluZ3MuZmluZEJ5SWRzKFsnTGl2ZWNoYXRfd2ViaG9va1VybCcsICdMaXZlY2hhdF9zZWNyZXRfdG9rZW4nLCAnTGl2ZWNoYXRfd2ViaG9va19vbl9jbG9zZScsICdMaXZlY2hhdF93ZWJob29rX29uX29mZmxpbmVfbXNnJ10pLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRhZGRlZChpZCwgZmllbGRzKSB7XG5cdFx0XHRzZWxmLmFkZGVkKCdsaXZlY2hhdEludGVncmF0aW9uJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcblx0XHRcdHNlbGYuY2hhbmdlZCgnbGl2ZWNoYXRJbnRlZ3JhdGlvbicsIGlkLCBmaWVsZHMpO1xuXHRcdH0sXG5cdFx0cmVtb3ZlZChpZCkge1xuXHRcdFx0c2VsZi5yZW1vdmVkKCdsaXZlY2hhdEludGVncmF0aW9uJywgaWQpO1xuXHRcdH1cblx0fSk7XG5cblx0c2VsZi5yZWFkeSgpO1xuXG5cdHNlbGYub25TdG9wKGZ1bmN0aW9uKCkge1xuXHRcdGhhbmRsZS5zdG9wKCk7XG5cdH0pO1xufSk7XG4iLCJNZXRlb3IucHVibGlzaCgnbGl2ZWNoYXQ6bWFuYWdlcnMnLCBmdW5jdGlvbigpIHtcblx0aWYgKCF0aGlzLnVzZXJJZCkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBwdWJsaXNoOiAnbGl2ZWNoYXQ6bWFuYWdlcnMnIH0pKTtcblx0fVxuXG5cdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1saXZlY2hhdC1yb29tcycpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDptYW5hZ2VycycgfSkpO1xuXHR9XG5cblx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cblx0Y29uc3QgaGFuZGxlID0gUm9ja2V0Q2hhdC5hdXRoei5nZXRVc2Vyc0luUm9sZSgnbGl2ZWNoYXQtbWFuYWdlcicpLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRhZGRlZChpZCwgZmllbGRzKSB7XG5cdFx0XHRzZWxmLmFkZGVkKCdtYW5hZ2VyVXNlcnMnLCBpZCwgZmllbGRzKTtcblx0XHR9LFxuXHRcdGNoYW5nZWQoaWQsIGZpZWxkcykge1xuXHRcdFx0c2VsZi5jaGFuZ2VkKCdtYW5hZ2VyVXNlcnMnLCBpZCwgZmllbGRzKTtcblx0XHR9LFxuXHRcdHJlbW92ZWQoaWQpIHtcblx0XHRcdHNlbGYucmVtb3ZlZCgnbWFuYWdlclVzZXJzJywgaWQpO1xuXHRcdH1cblx0fSk7XG5cblx0c2VsZi5yZWFkeSgpO1xuXG5cdHNlbGYub25TdG9wKGZ1bmN0aW9uKCkge1xuXHRcdGhhbmRsZS5zdG9wKCk7XG5cdH0pO1xufSk7XG4iLCJNZXRlb3IucHVibGlzaCgnbGl2ZWNoYXQ6cm9vbXMnLCBmdW5jdGlvbihmaWx0ZXIgPSB7fSwgb2Zmc2V0ID0gMCwgbGltaXQgPSAyMCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDpyb29tcycgfSkpO1xuXHR9XG5cblx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxpdmVjaGF0LXJvb21zJykpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OnJvb21zJyB9KSk7XG5cdH1cblxuXHRjaGVjayhmaWx0ZXIsIHtcblx0XHRuYW1lOiBNYXRjaC5NYXliZShTdHJpbmcpLCAvLyByb29tIG5hbWUgdG8gZmlsdGVyXG5cdFx0YWdlbnQ6IE1hdGNoLk1heWJlKFN0cmluZyksIC8vIGFnZW50IF9pZCB3aG8gaXMgc2VydmluZ1xuXHRcdHN0YXR1czogTWF0Y2guTWF5YmUoU3RyaW5nKSwgLy8gZWl0aGVyICdvcGVuZWQnIG9yICdjbG9zZWQnXG5cdFx0ZnJvbTogTWF0Y2guTWF5YmUoRGF0ZSksXG5cdFx0dG86IE1hdGNoLk1heWJlKERhdGUpXG5cdH0pO1xuXG5cdGNvbnN0IHF1ZXJ5ID0ge307XG5cdGlmIChmaWx0ZXIubmFtZSkge1xuXHRcdHF1ZXJ5LmxhYmVsID0gbmV3IFJlZ0V4cChmaWx0ZXIubmFtZSwgJ2knKTtcblx0fVxuXHRpZiAoZmlsdGVyLmFnZW50KSB7XG5cdFx0cXVlcnlbJ3NlcnZlZEJ5Ll9pZCddID0gZmlsdGVyLmFnZW50O1xuXHR9XG5cdGlmIChmaWx0ZXIuc3RhdHVzKSB7XG5cdFx0aWYgKGZpbHRlci5zdGF0dXMgPT09ICdvcGVuZWQnKSB7XG5cdFx0XHRxdWVyeS5vcGVuID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cXVlcnkub3BlbiA9IHsgJGV4aXN0czogZmFsc2UgfTtcblx0XHR9XG5cdH1cblx0aWYgKGZpbHRlci5mcm9tKSB7XG5cdFx0cXVlcnkudHMgPSB7XG5cdFx0XHQkZ3RlOiBmaWx0ZXIuZnJvbVxuXHRcdH07XG5cdH1cblx0aWYgKGZpbHRlci50bykge1xuXHRcdGZpbHRlci50by5zZXREYXRlKGZpbHRlci50by5nZXREYXRlKCkgKyAxKTtcblx0XHRmaWx0ZXIudG8uc2V0U2Vjb25kcyhmaWx0ZXIudG8uZ2V0U2Vjb25kcygpIC0gMSk7XG5cblx0XHRpZiAoIXF1ZXJ5LnRzKSB7XG5cdFx0XHRxdWVyeS50cyA9IHt9O1xuXHRcdH1cblx0XHRxdWVyeS50cy4kbHRlID0gZmlsdGVyLnRvO1xuXHR9XG5cblx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cblx0Y29uc3QgaGFuZGxlID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZExpdmVjaGF0KHF1ZXJ5LCBvZmZzZXQsIGxpbWl0KS5vYnNlcnZlQ2hhbmdlcyh7XG5cdFx0YWRkZWQoaWQsIGZpZWxkcykge1xuXHRcdFx0c2VsZi5hZGRlZCgnbGl2ZWNoYXRSb29tJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcblx0XHRcdHNlbGYuY2hhbmdlZCgnbGl2ZWNoYXRSb29tJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRyZW1vdmVkKGlkKSB7XG5cdFx0XHRzZWxmLnJlbW92ZWQoJ2xpdmVjaGF0Um9vbScsIGlkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRoaXMucmVhZHkoKTtcblxuXHR0aGlzLm9uU3RvcCgoKSA9PiB7XG5cdFx0aGFuZGxlLnN0b3AoKTtcblx0fSk7XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdsaXZlY2hhdDpxdWV1ZScsIGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDpxdWV1ZScgfSkpO1xuXHR9XG5cblx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWwtcm9vbScpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDpxdWV1ZScgfSkpO1xuXHR9XG5cblx0Ly8gbGV0IHNvcnQgPSB7IGNvdW50OiAxLCBzb3J0OiAxLCB1c2VybmFtZTogMSB9O1xuXHQvLyBsZXQgb25saW5lVXNlcnMgPSB7fTtcblxuXHQvLyBsZXQgaGFuZGxlVXNlcnMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25saW5lQWdlbnRzKCkub2JzZXJ2ZUNoYW5nZXMoe1xuXHQvLyBcdGFkZGVkKGlkLCBmaWVsZHMpIHtcblx0Ly8gXHRcdG9ubGluZVVzZXJzW2ZpZWxkcy51c2VybmFtZV0gPSAxO1xuXHQvLyBcdFx0Ly8gdGhpcy5hZGRlZCgnbGl2ZWNoYXRRdWV1ZVVzZXInLCBpZCwgZmllbGRzKTtcblx0Ly8gXHR9LFxuXHQvLyBcdGNoYW5nZWQoaWQsIGZpZWxkcykge1xuXHQvLyBcdFx0b25saW5lVXNlcnNbZmllbGRzLnVzZXJuYW1lXSA9IDE7XG5cdC8vIFx0XHQvLyB0aGlzLmNoYW5nZWQoJ2xpdmVjaGF0UXVldWVVc2VyJywgaWQsIGZpZWxkcyk7XG5cdC8vIFx0fSxcblx0Ly8gXHRyZW1vdmVkKGlkKSB7XG5cdC8vIFx0XHR0aGlzLnJlbW92ZWQoJ2xpdmVjaGF0UXVldWVVc2VyJywgaWQpO1xuXHQvLyBcdH1cblx0Ly8gfSk7XG5cblx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cblx0Y29uc3QgaGFuZGxlRGVwdHMgPSBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnRBZ2VudHMuZmluZFVzZXJzSW5RdWV1ZSgpLm9ic2VydmVDaGFuZ2VzKHtcblx0XHRhZGRlZChpZCwgZmllbGRzKSB7XG5cdFx0XHRzZWxmLmFkZGVkKCdsaXZlY2hhdFF1ZXVlVXNlcicsIGlkLCBmaWVsZHMpO1xuXHRcdH0sXG5cdFx0Y2hhbmdlZChpZCwgZmllbGRzKSB7XG5cdFx0XHRzZWxmLmNoYW5nZWQoJ2xpdmVjaGF0UXVldWVVc2VyJywgaWQsIGZpZWxkcyk7XG5cdFx0fSxcblx0XHRyZW1vdmVkKGlkKSB7XG5cdFx0XHRzZWxmLnJlbW92ZWQoJ2xpdmVjaGF0UXVldWVVc2VyJywgaWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGhpcy5yZWFkeSgpO1xuXG5cdHRoaXMub25TdG9wKCgpID0+IHtcblx0XHQvLyBoYW5kbGVVc2Vycy5zdG9wKCk7XG5cdFx0aGFuZGxlRGVwdHMuc3RvcCgpO1xuXHR9KTtcbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ2xpdmVjaGF0OnRyaWdnZXJzJywgZnVuY3Rpb24oX2lkKSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OnRyaWdnZXJzJyB9KSk7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDp0cmlnZ2VycycgfSkpO1xuXHR9XG5cblx0aWYgKF9pZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0VHJpZ2dlci5maW5kQnlJZChfaWQpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdFRyaWdnZXIuZmluZCgpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdsaXZlY2hhdDp2aXNpdG9ySGlzdG9yeScsIGZ1bmN0aW9uKHsgcmlkOiByb29tSWQgfSkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDp2aXNpdG9ySGlzdG9yeScgfSkpO1xuXHR9XG5cblx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWwtcm9vbScpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDp2aXNpdG9ySGlzdG9yeScgfSkpO1xuXHR9XG5cblx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJvb21JZCk7XG5cblx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHRoaXMudXNlcklkKTtcblxuXHRpZiAocm9vbS51c2VybmFtZXMuaW5kZXhPZih1c2VyLnVzZXJuYW1lKSA9PT0gLTEpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OnZpc2l0b3JIaXN0b3J5JyB9KSk7XG5cdH1cblxuXHRpZiAocm9vbSAmJiByb29tLnYgJiYgcm9vbS52Ll9pZCkge1xuXHRcdC8vIENBQ0hFOiBjYW4gd2Ugc3RvcCB1c2luZyBwdWJsaWNhdGlvbnMgaGVyZT9cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VmlzaXRvcklkKHJvb20udi5faWQpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB0aGlzLnJlYWR5KCk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2goJ2xpdmVjaGF0OnZpc2l0b3JJbmZvJywgZnVuY3Rpb24oeyByaWQ6IHJvb21JZCB9KSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OnZpc2l0b3JJbmZvJyB9KSk7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbC1yb29tJykpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OnZpc2l0b3JJbmZvJyB9KSk7XG5cdH1cblxuXHRjb25zdCByb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWQocm9vbUlkKTtcblxuXHRpZiAocm9vbSAmJiByb29tLnYgJiYgcm9vbS52Ll9pZCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kQnlJZChyb29tLnYuX2lkKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG59KTtcbiIsIk1ldGVvci5wdWJsaXNoKCdsaXZlY2hhdDp2aXNpdG9yUGFnZVZpc2l0ZWQnLCBmdW5jdGlvbih7IHJpZDogcm9vbUlkIH0pIHtcblx0aWYgKCF0aGlzLnVzZXJJZCkge1xuXHRcdHJldHVybiB0aGlzLmVycm9yKG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkJywgeyBwdWJsaXNoOiAnbGl2ZWNoYXQ6dmlzaXRvclBhZ2VWaXNpdGVkJyB9KSk7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbC1yb29tJykpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OnZpc2l0b3JQYWdlVmlzaXRlZCcgfSkpO1xuXHR9XG5cblx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJvb21JZCk7XG5cblx0aWYgKHJvb20gJiYgcm9vbS52ICYmIHJvb20udi50b2tlbikge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdFBhZ2VWaXNpdGVkLmZpbmRCeVRva2VuKHJvb20udi50b2tlbik7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxufSk7XG4iLCJNZXRlb3IucHVibGlzaCgnbGl2ZWNoYXQ6aW5xdWlyeScsIGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXJyb3IobmV3IE1ldGVvci5FcnJvcignZXJyb3Itbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQnLCB7IHB1Ymxpc2g6ICdsaXZlY2hhdDppbnF1aXJ5JyB9KSk7XG5cdH1cblxuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbC1yb29tJykpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OmlucXVpcnknIH0pKTtcblx0fVxuXG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdGFnZW50czogdGhpcy51c2VySWQsXG5cdFx0c3RhdHVzOiAnb3Blbidcblx0fTtcblxuXHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXRJbnF1aXJ5LmZpbmQocXVlcnkpO1xufSk7XG4iLCJNZXRlb3IucHVibGlzaCgnbGl2ZWNoYXQ6b2ZmaWNlSG91cicsIGZ1bmN0aW9uKCkge1xuXHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbC1yb29tJykpIHtcblx0XHRyZXR1cm4gdGhpcy5lcnJvcihuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZCcsIHsgcHVibGlzaDogJ2xpdmVjaGF0OmFnZW50cycgfSkpO1xuXHR9XG5cblx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0T2ZmaWNlSG91ci5maW5kKCk7XG59KTtcbiIsImltcG9ydCAnLi4vaW1wb3J0cy9zZXJ2ZXIvcmVzdC9kZXBhcnRtZW50cy5qcyc7XG5pbXBvcnQgJy4uL2ltcG9ydHMvc2VydmVyL3Jlc3QvZmFjZWJvb2suanMnO1xuaW1wb3J0ICcuLi9pbXBvcnRzL3NlcnZlci9yZXN0L3Ntcy5qcyc7XG5pbXBvcnQgJy4uL2ltcG9ydHMvc2VydmVyL3Jlc3QvdXNlcnMuanMnO1xuIiwiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbk1ldGVvci5zdGFydHVwKCgpID0+IHtcblx0Y29uc3Qgcm9sZXMgPSBfLnBsdWNrKFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmZpbmQoKS5mZXRjaCgpLCAnbmFtZScpO1xuXHRpZiAocm9sZXMuaW5kZXhPZignbGl2ZWNoYXQtYWdlbnQnKSA9PT0gLTEpIHtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb2xlcy5jcmVhdGVPclVwZGF0ZSgnbGl2ZWNoYXQtYWdlbnQnKTtcblx0fVxuXHRpZiAocm9sZXMuaW5kZXhPZignbGl2ZWNoYXQtbWFuYWdlcicpID09PSAtMSkge1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvbGVzLmNyZWF0ZU9yVXBkYXRlKCdsaXZlY2hhdC1tYW5hZ2VyJyk7XG5cdH1cblx0aWYgKHJvbGVzLmluZGV4T2YoJ2xpdmVjaGF0LWd1ZXN0JykgPT09IC0xKSB7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUm9sZXMuY3JlYXRlT3JVcGRhdGUoJ2xpdmVjaGF0LWd1ZXN0Jyk7XG5cdH1cblx0aWYgKFJvY2tldENoYXQubW9kZWxzICYmIFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zKSB7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMuY3JlYXRlT3JVcGRhdGUoJ3ZpZXctbC1yb29tJywgWydsaXZlY2hhdC1hZ2VudCcsICdsaXZlY2hhdC1tYW5hZ2VyJywgJ2FkbWluJ10pO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLmNyZWF0ZU9yVXBkYXRlKCd2aWV3LWxpdmVjaGF0LW1hbmFnZXInLCBbJ2xpdmVjaGF0LW1hbmFnZXInLCAnYWRtaW4nXSk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMuY3JlYXRlT3JVcGRhdGUoJ3ZpZXctbGl2ZWNoYXQtcm9vbXMnLCBbJ2xpdmVjaGF0LW1hbmFnZXInLCAnYWRtaW4nXSk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMuY3JlYXRlT3JVcGRhdGUoJ2Nsb3NlLWxpdmVjaGF0LXJvb20nLCBbJ2xpdmVjaGF0LWFnZW50JywgJ2xpdmVjaGF0LW1hbmFnZXInLCAnYWRtaW4nXSk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuUGVybWlzc2lvbnMuY3JlYXRlT3JVcGRhdGUoJ2Nsb3NlLW90aGVycy1saXZlY2hhdC1yb29tJywgWydsaXZlY2hhdC1tYW5hZ2VyJywgJ2FkbWluJ10pO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLmNyZWF0ZU9yVXBkYXRlKCdzYXZlLW90aGVycy1saXZlY2hhdC1yb29tLWluZm8nLCBbJ2xpdmVjaGF0LW1hbmFnZXInXSk7XG5cdH1cbn0pO1xuIiwiUm9ja2V0Q2hhdC5NZXNzYWdlVHlwZXMucmVnaXN0ZXJUeXBlKHtcblx0aWQ6ICdsaXZlY2hhdF92aWRlb19jYWxsJyxcblx0c3lzdGVtOiB0cnVlLFxuXHRtZXNzYWdlOiAnTmV3X3ZpZGVvY2FsbF9yZXF1ZXN0J1xufSk7XG5cblJvY2tldENoYXQuYWN0aW9uTGlua3MucmVnaXN0ZXIoJ2NyZWF0ZUxpdmVjaGF0Q2FsbCcsIGZ1bmN0aW9uKG1lc3NhZ2UsIHBhcmFtcywgaW5zdGFuY2UpIHtcblx0aWYgKE1ldGVvci5pc0NsaWVudCkge1xuXHRcdGluc3RhbmNlLnRhYkJhci5vcGVuKCd2aWRlbycpO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5hY3Rpb25MaW5rcy5yZWdpc3RlcignZGVueUxpdmVjaGF0Q2FsbCcsIGZ1bmN0aW9uKG1lc3NhZ2UvKiwgcGFyYW1zKi8pIHtcblx0aWYgKE1ldGVvci5pc1NlcnZlcikge1xuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcigpO1xuXG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuY3JlYXRlV2l0aFR5cGVSb29tSWRNZXNzYWdlQW5kVXNlcignY29tbWFuZCcsIG1lc3NhZ2UucmlkLCAnZW5kQ2FsbCcsIHVzZXIpO1xuXHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlSb29tKG1lc3NhZ2UucmlkLCAnZGVsZXRlTWVzc2FnZScsIHsgX2lkOiBtZXNzYWdlLl9pZCB9KTtcblxuXHRcdGNvbnN0IGxhbmd1YWdlID0gdXNlci5sYW5ndWFnZSB8fCBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnbGFuZ3VhZ2UnKSB8fCAnZW4nO1xuXG5cdFx0Um9ja2V0Q2hhdC5MaXZlY2hhdC5jbG9zZVJvb20oe1xuXHRcdFx0dXNlcixcblx0XHRcdHJvb206IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKG1lc3NhZ2UucmlkKSxcblx0XHRcdGNvbW1lbnQ6IFRBUGkxOG4uX18oJ1ZpZGVvY2FsbF9kZWNsaW5lZCcsIHsgbG5nOiBsYW5ndWFnZSB9KVxuXHRcdH0pO1xuXHRcdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRIaWRkZW5CeUlkKG1lc3NhZ2UuX2lkKTtcblx0XHR9KTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIG9wZW5Sb29tLCBMaXZlY2hhdElucXVpcnkgKi9cbmltcG9ydCB7Um9vbVNldHRpbmdzRW51bSwgUm9vbVR5cGVDb25maWcsIFJvb21UeXBlUm91dGVDb25maWcsIFVpVGV4dENvbnRleHR9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmxpYic7XG5cbmNsYXNzIExpdmVjaGF0Um9vbVJvdXRlIGV4dGVuZHMgUm9vbVR5cGVSb3V0ZUNvbmZpZyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG5hbWU6ICdsaXZlJyxcblx0XHRcdHBhdGg6ICcvbGl2ZS86Y29kZShcXFxcZCspJ1xuXHRcdH0pO1xuXHR9XG5cblx0YWN0aW9uKHBhcmFtcykge1xuXHRcdG9wZW5Sb29tKCdsJywgcGFyYW1zLmNvZGUpO1xuXHR9XG5cblx0bGluayhzdWIpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29kZTogc3ViLmNvZGVcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIExpdmVjaGF0Um9vbVR5cGUgZXh0ZW5kcyBSb29tVHlwZUNvbmZpZyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkZW50aWZpZXI6ICdsJyxcblx0XHRcdG9yZGVyOiA1LFxuXHRcdFx0aWNvbjogJ2xpdmVjaGF0Jyxcblx0XHRcdGxhYmVsOiAnTGl2ZWNoYXQnLFxuXHRcdFx0cm91dGU6IG5ldyBMaXZlY2hhdFJvb21Sb3V0ZSgpXG5cdFx0fSk7XG5cblx0XHR0aGlzLm5vdFN1YnNjcmliZWRUcGwgPSB7XG5cdFx0XHR0ZW1wbGF0ZTogJ2xpdmVjaGF0Tm90U3Vic2NyaWJlZCdcblx0XHR9O1xuXHR9XG5cblx0ZmluZFJvb20oaWRlbnRpZmllcikge1xuXHRcdHJldHVybiBDaGF0Um9vbS5maW5kT25lKHtjb2RlOiBwYXJzZUludChpZGVudGlmaWVyKX0pO1xuXHR9XG5cblx0cm9vbU5hbWUocm9vbURhdGEpIHtcblx0XHRpZiAoIXJvb21EYXRhLm5hbWUpIHtcblx0XHRcdHJldHVybiByb29tRGF0YS5sYWJlbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHJvb21EYXRhLm5hbWU7XG5cdFx0fVxuXHR9XG5cblx0Y29uZGl0aW9uKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfZW5hYmxlZCcpICYmIFJvY2tldENoYXQuYXV0aHouaGFzQWxsUGVybWlzc2lvbigndmlldy1sLXJvb20nKTtcblx0fVxuXG5cdGNhblNlbmRNZXNzYWdlKHJvb21JZCkge1xuXHRcdGNvbnN0IHJvb20gPSBDaGF0Um9vbS5maW5kT25lKHtfaWQ6IHJvb21JZH0sIHtmaWVsZHM6IHtvcGVuOiAxfX0pO1xuXHRcdHJldHVybiByb29tICYmIHJvb20ub3BlbiA9PT0gdHJ1ZTtcblx0fVxuXG5cdGdldFVzZXJTdGF0dXMocm9vbUlkKSB7XG5cdFx0bGV0IGd1ZXN0TmFtZTtcblx0XHRjb25zdCByb29tID0gU2Vzc2lvbi5nZXQoYHJvb21EYXRhJHsgcm9vbUlkIH1gKTtcblxuXHRcdGlmIChyb29tKSB7XG5cdFx0XHRndWVzdE5hbWUgPSByb29tLnYgJiYgcm9vbS52LnVzZXJuYW1lO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpbnF1aXJ5ID0gTGl2ZWNoYXRJbnF1aXJ5LmZpbmRPbmUoe3JpZDogcm9vbUlkfSk7XG5cdFx0XHRndWVzdE5hbWUgPSBpbnF1aXJ5ICYmIGlucXVpcnkudiAmJiBpbnF1aXJ5LnYudXNlcm5hbWU7XG5cdFx0fVxuXG5cdFx0aWYgKGd1ZXN0TmFtZSkge1xuXHRcdFx0cmV0dXJuIFNlc3Npb24uZ2V0KGB1c2VyXyR7IGd1ZXN0TmFtZSB9X3N0YXR1c2ApO1xuXHRcdH1cblx0fVxuXG5cdGFsbG93Um9vbVNldHRpbmdDaGFuZ2Uocm9vbSwgc2V0dGluZykge1xuXHRcdHN3aXRjaCAoc2V0dGluZykge1xuXHRcdFx0Y2FzZSBSb29tU2V0dGluZ3NFbnVtLkpPSU5fQ09ERTpcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Z2V0VWlUZXh0KGNvbnRleHQpIHtcblx0XHRzd2l0Y2ggKGNvbnRleHQpIHtcblx0XHRcdGNhc2UgVWlUZXh0Q29udGV4dC5ISURFX1dBUk5JTkc6XG5cdFx0XHRcdHJldHVybiAnSGlkZV9MaXZlY2hhdF9XYXJuaW5nJztcblx0XHRcdGNhc2UgVWlUZXh0Q29udGV4dC5MRUFWRV9XQVJOSU5HOlxuXHRcdFx0XHRyZXR1cm4gJ0hpZGVfTGl2ZWNoYXRfV2FybmluZyc7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHR9XG59XG5cblJvY2tldENoYXQucm9vbVR5cGVzLmFkZChuZXcgTGl2ZWNoYXRSb29tVHlwZSgpKTtcbiIsIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdMaXZlY2hhdCcpO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9lbmFibGVkJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBncm91cDogJ0xpdmVjaGF0JywgcHVibGljOiB0cnVlIH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF90aXRsZScsICdSb2NrZXQuQ2hhdCcsIHsgdHlwZTogJ3N0cmluZycsIGdyb3VwOiAnTGl2ZWNoYXQnLCBwdWJsaWM6IHRydWUgfSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF90aXRsZV9jb2xvcicsICcjQzEyNzJEJywgeyB0eXBlOiAnY29sb3InLCBncm91cDogJ0xpdmVjaGF0JywgcHVibGljOiB0cnVlIH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9kaXNwbGF5X29mZmxpbmVfZm9ybScsIHRydWUsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdHNlY3Rpb246ICdPZmZsaW5lJyxcblx0XHRpMThuTGFiZWw6ICdEaXNwbGF5X29mZmxpbmVfZm9ybSdcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X3ZhbGlkYXRlX29mZmxpbmVfZW1haWwnLCB0cnVlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRzZWN0aW9uOiAnT2ZmbGluZScsXG5cdFx0aTE4bkxhYmVsOiAnVmFsaWRhdGVfZW1haWxfYWRkcmVzcydcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X29mZmxpbmVfZm9ybV91bmF2YWlsYWJsZScsICcnLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdHNlY3Rpb246ICdPZmZsaW5lJyxcblx0XHRpMThuTGFiZWw6ICdPZmZsaW5lX2Zvcm1fdW5hdmFpbGFibGVfbWVzc2FnZSdcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X29mZmxpbmVfdGl0bGUnLCAnTGVhdmUgYSBtZXNzYWdlJywge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRzZWN0aW9uOiAnT2ZmbGluZScsXG5cdFx0aTE4bkxhYmVsOiAnVGl0bGUnXG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfb2ZmbGluZV90aXRsZV9jb2xvcicsICcjNjY2NjY2Jywge1xuXHRcdHR5cGU6ICdjb2xvcicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdHNlY3Rpb246ICdPZmZsaW5lJyxcblx0XHRpMThuTGFiZWw6ICdDb2xvcidcblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9vZmZsaW5lX21lc3NhZ2UnLCAnV2UgYXJlIG5vdCBvbmxpbmUgcmlnaHQgbm93LiBQbGVhc2UgbGVhdmUgdXMgYSBtZXNzYWdlOicsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0c2VjdGlvbjogJ09mZmxpbmUnLFxuXHRcdGkxOG5MYWJlbDogJ0luc3RydWN0aW9ucycsXG5cdFx0aTE4bkRlc2NyaXB0aW9uOiAnSW5zdHJ1Y3Rpb25zX3RvX3lvdXJfdmlzaXRvcl9maWxsX3RoZV9mb3JtX3RvX3NlbmRfYV9tZXNzYWdlJ1xuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X29mZmxpbmVfZW1haWwnLCAnJywge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdGkxOG5MYWJlbDogJ0VtYWlsX2FkZHJlc3NfdG9fc2VuZF9vZmZsaW5lX21lc3NhZ2VzJyxcblx0XHRzZWN0aW9uOiAnT2ZmbGluZSdcblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9vZmZsaW5lX3N1Y2Nlc3NfbWVzc2FnZScsICcnLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdHNlY3Rpb246ICdPZmZsaW5lJyxcblx0XHRpMThuTGFiZWw6ICdPZmZsaW5lX3N1Y2Nlc3NfbWVzc2FnZSdcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X3JlZ2lzdHJhdGlvbl9mb3JtJywgdHJ1ZSwgeyB0eXBlOiAnYm9vbGVhbicsIGdyb3VwOiAnTGl2ZWNoYXQnLCBwdWJsaWM6IHRydWUsIGkxOG5MYWJlbDogJ1Nob3dfcHJlcmVnaXN0cmF0aW9uX2Zvcm0nIH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfYWxsb3dfc3dpdGNoaW5nX2RlcGFydG1lbnRzJywgdHJ1ZSwgeyB0eXBlOiAnYm9vbGVhbicsIGdyb3VwOiAnTGl2ZWNoYXQnLCBwdWJsaWM6IHRydWUsIGkxOG5MYWJlbDogJ0FsbG93X3N3aXRjaGluZ19kZXBhcnRtZW50cycgfSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9zaG93X2FnZW50X2VtYWlsJywgdHJ1ZSwgeyB0eXBlOiAnYm9vbGVhbicsIGdyb3VwOiAnTGl2ZWNoYXQnLCBwdWJsaWM6IHRydWUsIGkxOG5MYWJlbDogJ1Nob3dfYWdlbnRfZW1haWwnIH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfZ3Vlc3RfY291bnQnLCAxLCB7IHR5cGU6ICdpbnQnLCBncm91cDogJ0xpdmVjaGF0JyB9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfUm9vbV9Db3VudCcsIDEsIHtcblx0XHR0eXBlOiAnaW50Jyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRpMThuTGFiZWw6ICdMaXZlY2hhdF9yb29tX2NvdW50J1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfYWdlbnRfbGVhdmVfYWN0aW9uJywgJ25vbmUnLCB7XG5cdFx0dHlwZTogJ3NlbGVjdCcsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0dmFsdWVzOiBbXG5cdFx0XHR7IGtleTogJ25vbmUnLCBpMThuTGFiZWw6ICdOb25lJyB9LFxuXHRcdFx0eyBrZXk6ICdmb3J3YXJkJywgaTE4bkxhYmVsOiAnRm9yd2FyZCcgfSxcblx0XHRcdHsga2V5OiAnY2xvc2UnLCBpMThuTGFiZWw6ICdDbG9zZScgfVxuXHRcdF0sXG5cdFx0aTE4bkxhYmVsOiAnSG93X3RvX2hhbmRsZV9vcGVuX3Nlc3Npb25zX3doZW5fYWdlbnRfZ29lc19vZmZsaW5lJ1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfYWdlbnRfbGVhdmVfYWN0aW9uX3RpbWVvdXQnLCA2MCwge1xuXHRcdHR5cGU6ICdpbnQnLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0xpdmVjaGF0X2FnZW50X2xlYXZlX2FjdGlvbicsIHZhbHVlOiB7ICRuZTogJ25vbmUnIH0gfSxcblx0XHRpMThuTGFiZWw6ICdIb3dfbG9uZ190b193YWl0X2FmdGVyX2FnZW50X2dvZXNfb2ZmbGluZScsXG5cdFx0aTE4bkRlc2NyaXB0aW9uOiAnVGltZV9pbl9zZWNvbmRzJ1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfYWdlbnRfbGVhdmVfY29tbWVudCcsICcnLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0ZW5hYmxlUXVlcnk6IHsgX2lkOiAnTGl2ZWNoYXRfYWdlbnRfbGVhdmVfYWN0aW9uJywgdmFsdWU6ICdjbG9zZScgfSxcblx0XHRpMThuTGFiZWw6ICdDb21tZW50X3RvX2xlYXZlX29uX2Nsb3Npbmdfc2Vzc2lvbidcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X3dlYmhvb2tVcmwnLCBmYWxzZSwge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHNlY3Rpb246ICdDUk1fSW50ZWdyYXRpb24nLFxuXHRcdGkxOG5MYWJlbDogJ1dlYmhvb2tfVVJMJ1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfc2VjcmV0X3Rva2VuJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRzZWN0aW9uOiAnQ1JNX0ludGVncmF0aW9uJyxcblx0XHRpMThuTGFiZWw6ICdTZWNyZXRfdG9rZW4nXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF93ZWJob29rX29uX2Nsb3NlJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0c2VjdGlvbjogJ0NSTV9JbnRlZ3JhdGlvbicsXG5cdFx0aTE4bkxhYmVsOiAnU2VuZF9yZXF1ZXN0X29uX2NoYXRfY2xvc2UnXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF93ZWJob29rX29uX29mZmxpbmVfbXNnJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0c2VjdGlvbjogJ0NSTV9JbnRlZ3JhdGlvbicsXG5cdFx0aTE4bkxhYmVsOiAnU2VuZF9yZXF1ZXN0X29uX29mZmxpbmVfbWVzc2FnZXMnXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9Lbm93bGVkZ2VfRW5hYmxlZCcsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHNlY3Rpb246ICdLbm93bGVkZ2VfQmFzZScsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGkxOG5MYWJlbDogJ0VuYWJsZWQnXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9Lbm93bGVkZ2VfQXBpYWlfS2V5JywgJycsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRzZWN0aW9uOiAnS25vd2xlZGdlX0Jhc2UnLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRpMThuTGFiZWw6ICdBcGlhaV9LZXknXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9Lbm93bGVkZ2VfQXBpYWlfTGFuZ3VhZ2UnLCAnZW4nLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0c2VjdGlvbjogJ0tub3dsZWRnZV9CYXNlJyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0aTE4bkxhYmVsOiAnQXBpYWlfTGFuZ3VhZ2UnXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9oaXN0b3J5X21vbml0b3JfdHlwZScsICd1cmwnLCB7XG5cdFx0dHlwZTogJ3NlbGVjdCcsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0aTE4bkxhYmVsOiAnTW9uaXRvcl9oaXN0b3J5X2Zvcl9jaGFuZ2VzX29uJyxcblx0XHR2YWx1ZXM6IFtcblx0XHRcdHsga2V5OiAndXJsJywgaTE4bkxhYmVsOiAnUGFnZV9VUkwnIH0sXG5cdFx0XHR7IGtleTogJ3RpdGxlJywgaTE4bkxhYmVsOiAnUGFnZV90aXRsZScgfVxuXHRcdF1cblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X1JvdXRpbmdfTWV0aG9kJywgJ0xlYXN0X0Ftb3VudCcsIHtcblx0XHR0eXBlOiAnc2VsZWN0Jyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0dmFsdWVzOiBbXG5cdFx0XHR7a2V5OiAnTGVhc3RfQW1vdW50JywgaTE4bkxhYmVsOiAnTGVhc3RfQW1vdW50J30sXG5cdFx0XHR7a2V5OiAnR3Vlc3RfUG9vbCcsIGkxOG5MYWJlbDogJ0d1ZXN0X1Bvb2wnfVxuXHRcdF1cblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X2d1ZXN0X3Bvb2xfd2l0aF9ub19hZ2VudHMnLCBmYWxzZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRpMThuTGFiZWw6ICdBY2NlcHRfd2l0aF9ub19vbmxpbmVfYWdlbnRzJyxcblx0XHRpMThuRGVzY3JpcHRpb246ICdBY2NlcHRfaW5jb21pbmdfbGl2ZWNoYXRfcmVxdWVzdHNfZXZlbl9pZl90aGVyZV9hcmVfbm9fb25saW5lX2FnZW50cycsXG5cdFx0ZW5hYmxlUXVlcnk6IHsgX2lkOiAnTGl2ZWNoYXRfUm91dGluZ19NZXRob2QnLCB2YWx1ZTogJ0d1ZXN0X1Bvb2wnIH1cblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X3Nob3dfcXVldWVfbGlzdF9saW5rJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGkxOG5MYWJlbDogJ1Nob3dfcXVldWVfbGlzdF90b19hbGxfYWdlbnRzJ1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfZW5hYmxlX29mZmljZV9ob3VycycsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRpMThuTGFiZWw6ICdPZmZpY2VfaG91cnNfZW5hYmxlZCdcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X3ZpZGVvY2FsbF9lbmFibGVkJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGkxOG5MYWJlbDogJ1ZpZGVvY2FsbF9lbmFibGVkJyxcblx0XHRpMThuRGVzY3JpcHRpb246ICdCZXRhX2ZlYXR1cmVfRGVwZW5kc19vbl9WaWRlb19Db25mZXJlbmNlX3RvX2JlX2VuYWJsZWQnLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0ppdHNpX0VuYWJsZWQnLCB2YWx1ZTogdHJ1ZSB9XG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9lbmFibGVfdHJhbnNjcmlwdCcsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRpMThuTGFiZWw6ICdUcmFuc2NyaXB0X0VuYWJsZWQnXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF90cmFuc2NyaXB0X21lc3NhZ2UnLCAnV291bGQgeW91IGxpa2UgYSBjb3B5IG9mIHRoaXMgY2hhdCBlbWFpbGVkPycsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0aTE4bkxhYmVsOiAnVHJhbnNjcmlwdF9tZXNzYWdlJyxcblx0XHRlbmFibGVRdWVyeTogeyBfaWQ6ICdMaXZlY2hhdF9lbmFibGVfdHJhbnNjcmlwdCcsIHZhbHVlOiB0cnVlIH1cblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X29wZW5faW5xdWllcnlfc2hvd19jb25uZWN0aW5nJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdMaXZlY2hhdCcsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGkxOG5MYWJlbDogJ0xpdmVjaGF0X29wZW5faW5xdWllcnlfc2hvd19jb25uZWN0aW5nJyxcblx0XHRlbmFibGVRdWVyeTogeyBfaWQ6ICdMaXZlY2hhdF9Sb3V0aW5nX01ldGhvZCcsIHZhbHVlOiAnR3Vlc3RfUG9vbCcgfVxuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfQWxsb3dlZERvbWFpbnNMaXN0JywgJycsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0aTE4bkxhYmVsOiAnTGl2ZWNoYXRfQWxsb3dlZERvbWFpbnNMaXN0Jyxcblx0XHRpMThuRGVzY3JpcHRpb246ICdEb21haW5zX2FsbG93ZWRfdG9fZW1iZWRfdGhlX2xpdmVjaGF0X3dpZGdldCdcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X0ZhY2Vib29rX0VuYWJsZWQnLCBmYWxzZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRzZWN0aW9uOiAnRmFjZWJvb2snXG5cdH0pO1xuXG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdMaXZlY2hhdF9GYWNlYm9va19BUElfS2V5JywgJycsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRzZWN0aW9uOiAnRmFjZWJvb2snLFxuXHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lmX3lvdV9kb250X2hhdmVfb25lX3NlbmRfYW5fZW1haWxfdG9fb21uaV9yb2NrZXRjaGF0X3RvX2dldF95b3Vycydcblx0fSk7XG5cblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0xpdmVjaGF0X0ZhY2Vib29rX0FQSV9TZWNyZXQnLCAnJywge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGdyb3VwOiAnTGl2ZWNoYXQnLFxuXHRcdHNlY3Rpb246ICdGYWNlYm9vaycsXG5cdFx0aTE4bkRlc2NyaXB0aW9uOiAnSWZfeW91X2RvbnRfaGF2ZV9vbmVfc2VuZF9hbl9lbWFpbF90b19vbW5pX3JvY2tldGNoYXRfdG9fZ2V0X3lvdXJzJ1xuXHR9KTtcblxuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTGl2ZWNoYXRfUkRTdGF0aW9uX1Rva2VuJywgJycsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRncm91cDogJ0xpdmVjaGF0Jyxcblx0XHRwdWJsaWM6IGZhbHNlLFxuXHRcdHNlY3Rpb246ICdSRCBTdGF0aW9uJyxcblx0XHRpMThuTGFiZWw6ICdSRFN0YXRpb25fVG9rZW4nXG5cdH0pO1xufSk7XG4iLCJSb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnbGl2ZWNoYXQvZGVwYXJ0bWVudCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRkZXBhcnRtZW50czogUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50LmZpbmQoKS5mZXRjaCgpXG5cdFx0fSk7XG5cdH0sXG5cdHBvc3QoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjaGVjayh0aGlzLmJvZHlQYXJhbXMsIHtcblx0XHRcdFx0ZGVwYXJ0bWVudDogT2JqZWN0LFxuXHRcdFx0XHRhZ2VudHM6IEFycmF5XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgZGVwYXJ0bWVudCA9IFJvY2tldENoYXQuTGl2ZWNoYXQuc2F2ZURlcGFydG1lbnQobnVsbCwgdGhpcy5ib2R5UGFyYW1zLmRlcGFydG1lbnQsIHRoaXMuYm9keVBhcmFtcy5hZ2VudHMpO1xuXG5cdFx0XHRpZiAoZGVwYXJ0bWVudCkge1xuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRcdFx0ZGVwYXJ0bWVudCxcblx0XHRcdFx0XHRhZ2VudHM6IFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0RGVwYXJ0bWVudEFnZW50cy5maW5kKHsgZGVwYXJ0bWVudElkOiBkZXBhcnRtZW50Ll9pZCB9KS5mZXRjaCgpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZSk7XG5cdFx0fVxuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2xpdmVjaGF0L2RlcGFydG1lbnQvOl9pZCcsIHsgYXV0aFJlcXVpcmVkOiB0cnVlIH0sIHtcblx0Z2V0KCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y2hlY2sodGhpcy51cmxQYXJhbXMsIHtcblx0XHRcdFx0X2lkOiBTdHJpbmdcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRcdGRlcGFydG1lbnQ6IFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0RGVwYXJ0bWVudC5maW5kT25lQnlJZCh0aGlzLnVybFBhcmFtcy5faWQpLFxuXHRcdFx0XHRhZ2VudHM6IFJvY2tldENoYXQubW9kZWxzLkxpdmVjaGF0RGVwYXJ0bWVudEFnZW50cy5maW5kKHsgZGVwYXJ0bWVudElkOiB0aGlzLnVybFBhcmFtcy5faWQgfSkuZmV0Y2goKVxuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZS5lcnJvcik7XG5cdFx0fVxuXHR9LFxuXHRwdXQoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjaGVjayh0aGlzLnVybFBhcmFtcywge1xuXHRcdFx0XHRfaWQ6IFN0cmluZ1xuXHRcdFx0fSk7XG5cblx0XHRcdGNoZWNrKHRoaXMuYm9keVBhcmFtcywge1xuXHRcdFx0XHRkZXBhcnRtZW50OiBPYmplY3QsXG5cdFx0XHRcdGFnZW50czogQXJyYXlcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5MaXZlY2hhdC5zYXZlRGVwYXJ0bWVudCh0aGlzLnVybFBhcmFtcy5faWQsIHRoaXMuYm9keVBhcmFtcy5kZXBhcnRtZW50LCB0aGlzLmJvZHlQYXJhbXMuYWdlbnRzKSkge1xuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRcdFx0ZGVwYXJ0bWVudDogUm9ja2V0Q2hhdC5tb2RlbHMuTGl2ZWNoYXREZXBhcnRtZW50LmZpbmRPbmVCeUlkKHRoaXMudXJsUGFyYW1zLl9pZCksXG5cdFx0XHRcdFx0YWdlbnRzOiBSb2NrZXRDaGF0Lm1vZGVscy5MaXZlY2hhdERlcGFydG1lbnRBZ2VudHMuZmluZCh7IGRlcGFydG1lbnRJZDogdGhpcy51cmxQYXJhbXMuX2lkIH0pLmZldGNoKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZS5lcnJvcik7XG5cdFx0fVxuXHR9LFxuXHRkZWxldGUoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjaGVjayh0aGlzLnVybFBhcmFtcywge1xuXHRcdFx0XHRfaWQ6IFN0cmluZ1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChSb2NrZXRDaGF0LkxpdmVjaGF0LnJlbW92ZURlcGFydG1lbnQodGhpcy51cmxQYXJhbXMuX2lkKSkge1xuXHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZSgpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKGUuZXJyb3IpO1xuXHRcdH1cblx0fVxufSk7XG4iLCJpbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG4vKipcbiAqIEBhcGkge3Bvc3R9IC9saXZlY2hhdC9mYWNlYm9vayBTZW5kIEZhY2Vib29rIG1lc3NhZ2VcbiAqIEBhcGlOYW1lIEZhY2Vib29rXG4gKiBAYXBpR3JvdXAgTGl2ZWNoYXRcbiAqXG4gKiBAYXBpUGFyYW0ge1N0cmluZ30gbWlkIEZhY2Vib29rIG1lc3NhZ2UgaWRcbiAqIEBhcGlQYXJhbSB7U3RyaW5nfSBwYWdlIEZhY2Vib29rIHBhZ2VzIGlkXG4gKiBAYXBpUGFyYW0ge1N0cmluZ30gdG9rZW4gRmFjZWJvb2sgdXNlcidzIHRva2VuXG4gKiBAYXBpUGFyYW0ge1N0cmluZ30gZmlyc3RfbmFtZSBGYWNlYm9vayB1c2VyJ3MgZmlyc3QgbmFtZVxuICogQGFwaVBhcmFtIHtTdHJpbmd9IGxhc3RfbmFtZSBGYWNlYm9vayB1c2VyJ3MgbGFzdCBuYW1lXG4gKiBAYXBpUGFyYW0ge1N0cmluZ30gW3RleHRdIEZhY2Vib29rIG1lc3NhZ2UgdGV4dFxuICogQGFwaVBhcmFtIHtTdHJpbmd9IFthdHRhY2htZW50c10gRmFjZWJvb2sgbWVzc2FnZSBhdHRhY2htZW50c1xuICovXG5Sb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnbGl2ZWNoYXQvZmFjZWJvb2snLCB7XG5cdHBvc3QoKSB7XG5cdFx0aWYgKCF0aGlzLmJvZHlQYXJhbXMudGV4dCAmJiAhdGhpcy5ib2R5UGFyYW1zLmF0dGFjaG1lbnRzKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdWNjZXNzOiBmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMucmVxdWVzdC5oZWFkZXJzWyd4LWh1Yi1zaWduYXR1cmUnXSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3VjY2VzczogZmFsc2Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKCFSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTGl2ZWNoYXRfRmFjZWJvb2tfRW5hYmxlZCcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdFx0ZXJyb3I6ICdJbnRlZ3JhdGlvbiBkaXNhYmxlZCdcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gdmFsaWRhdGUgaWYgcmVxdWVzdCBjb21lIGZyb20gb21uaVxuXHRcdGNvbnN0IHNpZ25hdHVyZSA9IGNyeXB0by5jcmVhdGVIbWFjKCdzaGExJywgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0xpdmVjaGF0X0ZhY2Vib29rX0FQSV9TZWNyZXQnKSkudXBkYXRlKEpTT04uc3RyaW5naWZ5KHRoaXMucmVxdWVzdC5ib2R5KSkuZGlnZXN0KCdoZXgnKTtcblx0XHRpZiAodGhpcy5yZXF1ZXN0LmhlYWRlcnNbJ3gtaHViLXNpZ25hdHVyZSddICE9PSBgc2hhMT0keyBzaWduYXR1cmUgfWApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0XHRlcnJvcjogJ0ludmFsaWQgc2lnbmF0dXJlJ1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBzZW5kTWVzc2FnZSA9IHtcblx0XHRcdG1lc3NhZ2U6IHtcblx0XHRcdFx0X2lkOiB0aGlzLmJvZHlQYXJhbXMubWlkXG5cdFx0XHR9LFxuXHRcdFx0cm9vbUluZm86IHtcblx0XHRcdFx0ZmFjZWJvb2s6IHtcblx0XHRcdFx0XHRwYWdlOiB0aGlzLmJvZHlQYXJhbXMucGFnZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGxldCB2aXNpdG9yID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZ2V0VmlzaXRvckJ5VG9rZW4odGhpcy5ib2R5UGFyYW1zLnRva2VuKTtcblx0XHRpZiAodmlzaXRvcikge1xuXHRcdFx0Y29uc3Qgcm9vbXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT3BlbkJ5VmlzaXRvclRva2VuKHZpc2l0b3IucHJvZmlsZS50b2tlbikuZmV0Y2goKTtcblxuXHRcdFx0aWYgKHJvb21zICYmIHJvb21zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS5yaWQgPSByb29tc1swXS5faWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZW5kTWVzc2FnZS5tZXNzYWdlLnJpZCA9IFJhbmRvbS5pZCgpO1xuXHRcdFx0fVxuXHRcdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS50b2tlbiA9IHZpc2l0b3IucHJvZmlsZS50b2tlbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS5yaWQgPSBSYW5kb20uaWQoKTtcblx0XHRcdHNlbmRNZXNzYWdlLm1lc3NhZ2UudG9rZW4gPSB0aGlzLmJvZHlQYXJhbXMudG9rZW47XG5cblx0XHRcdGNvbnN0IHVzZXJJZCA9IFJvY2tldENoYXQuTGl2ZWNoYXQucmVnaXN0ZXJHdWVzdCh7XG5cdFx0XHRcdHRva2VuOiBzZW5kTWVzc2FnZS5tZXNzYWdlLnRva2VuLFxuXHRcdFx0XHRuYW1lOiBgJHsgdGhpcy5ib2R5UGFyYW1zLmZpcnN0X25hbWUgfSAkeyB0aGlzLmJvZHlQYXJhbXMubGFzdF9uYW1lIH1gXG5cdFx0XHR9KTtcblxuXHRcdFx0dmlzaXRvciA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkKHVzZXJJZCk7XG5cdFx0fVxuXG5cdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS5tc2cgPSB0aGlzLmJvZHlQYXJhbXMudGV4dDtcblx0XHRzZW5kTWVzc2FnZS5ndWVzdCA9IHZpc2l0b3I7XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3VjZXNzOiB0cnVlLFxuXHRcdFx0XHRtZXNzYWdlOiBSb2NrZXRDaGF0LkxpdmVjaGF0LnNlbmRNZXNzYWdlKHNlbmRNZXNzYWdlKVxuXHRcdFx0fTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciB1c2luZyBGYWNlYm9vayAtPicsIGUpO1xuXHRcdH1cblx0fVxufSk7XG4iLCJSb2NrZXRDaGF0LkFQSS52MS5hZGRSb3V0ZSgnbGl2ZWNoYXQvc21zLWluY29taW5nLzpzZXJ2aWNlJywge1xuXHRwb3N0KCkge1xuXHRcdGNvbnN0IFNNU1NlcnZpY2UgPSBSb2NrZXRDaGF0LlNNUy5nZXRTZXJ2aWNlKHRoaXMudXJsUGFyYW1zLnNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgc21zID0gU01TU2VydmljZS5wYXJzZSh0aGlzLmJvZHlQYXJhbXMpO1xuXG5cdFx0bGV0IHZpc2l0b3IgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lVmlzaXRvckJ5UGhvbmUoc21zLmZyb20pO1xuXG5cdFx0Y29uc3Qgc2VuZE1lc3NhZ2UgPSB7XG5cdFx0XHRtZXNzYWdlOiB7XG5cdFx0XHRcdF9pZDogUmFuZG9tLmlkKClcblx0XHRcdH0sXG5cdFx0XHRyb29tSW5mbzoge1xuXHRcdFx0XHRzbXM6IHtcblx0XHRcdFx0XHRmcm9tOiBzbXMudG9cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpZiAodmlzaXRvcikge1xuXHRcdFx0Y29uc3Qgcm9vbXMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT3BlbkJ5VmlzaXRvclRva2VuKHZpc2l0b3IucHJvZmlsZS50b2tlbikuZmV0Y2goKTtcblxuXHRcdFx0aWYgKHJvb21zICYmIHJvb21zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS5yaWQgPSByb29tc1swXS5faWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZW5kTWVzc2FnZS5tZXNzYWdlLnJpZCA9IFJhbmRvbS5pZCgpO1xuXHRcdFx0fVxuXHRcdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS50b2tlbiA9IHZpc2l0b3IucHJvZmlsZS50b2tlbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2VuZE1lc3NhZ2UubWVzc2FnZS5yaWQgPSBSYW5kb20uaWQoKTtcblx0XHRcdHNlbmRNZXNzYWdlLm1lc3NhZ2UudG9rZW4gPSBSYW5kb20uaWQoKTtcblxuXHRcdFx0Y29uc3QgdXNlcklkID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5yZWdpc3Rlckd1ZXN0KHtcblx0XHRcdFx0dXNlcm5hbWU6IHNtcy5mcm9tLnJlcGxhY2UoL1teMC05XS9nLCAnJyksXG5cdFx0XHRcdHRva2VuOiBzZW5kTWVzc2FnZS5tZXNzYWdlLnRva2VuLFxuXHRcdFx0XHRwaG9uZToge1xuXHRcdFx0XHRcdG51bWJlcjogc21zLmZyb21cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHZpc2l0b3IgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh1c2VySWQpO1xuXHRcdH1cblxuXHRcdHNlbmRNZXNzYWdlLm1lc3NhZ2UubXNnID0gc21zLmJvZHk7XG5cdFx0c2VuZE1lc3NhZ2UuZ3Vlc3QgPSB2aXNpdG9yO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBTTVNTZXJ2aWNlLnJlc3BvbnNlLmNhbGwodGhpcywgUm9ja2V0Q2hhdC5MaXZlY2hhdC5zZW5kTWVzc2FnZShzZW5kTWVzc2FnZSkpO1xuXG5cdFx0XHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdFx0XHRpZiAoc21zLmV4dHJhKSB7XG5cdFx0XHRcdFx0aWYgKHNtcy5leHRyYS5mcm9tQ291bnRyeSkge1xuXHRcdFx0XHRcdFx0TWV0ZW9yLmNhbGwoJ2xpdmVjaGF0OnNldEN1c3RvbUZpZWxkJywgc2VuZE1lc3NhZ2UubWVzc2FnZS50b2tlbiwgJ2NvdW50cnknLCBzbXMuZXh0cmEuZnJvbUNvdW50cnkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc21zLmV4dHJhLmZyb21TdGF0ZSkge1xuXHRcdFx0XHRcdFx0TWV0ZW9yLmNhbGwoJ2xpdmVjaGF0OnNldEN1c3RvbUZpZWxkJywgc2VuZE1lc3NhZ2UubWVzc2FnZS50b2tlbiwgJ3N0YXRlJywgc21zLmV4dHJhLmZyb21TdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzbXMuZXh0cmEuZnJvbUNpdHkpIHtcblx0XHRcdFx0XHRcdE1ldGVvci5jYWxsKCdsaXZlY2hhdDpzZXRDdXN0b21GaWVsZCcsIHNlbmRNZXNzYWdlLm1lc3NhZ2UudG9rZW4sICdjaXR5Jywgc21zLmV4dHJhLmZyb21DaXR5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gbWVzc2FnZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gU01TU2VydmljZS5lcnJvci5jYWxsKHRoaXMsIGUpO1xuXHRcdH1cblx0fVxufSk7XG4iLCJpbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2xpdmVjaGF0L3VzZXJzLzp0eXBlJywgeyBhdXRoUmVxdWlyZWQ6IHRydWUgfSwge1xuXHRnZXQoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjaGVjayh0aGlzLnVybFBhcmFtcywge1xuXHRcdFx0XHR0eXBlOiBTdHJpbmdcblx0XHRcdH0pO1xuXG5cdFx0XHRsZXQgcm9sZTtcblx0XHRcdGlmICh0aGlzLnVybFBhcmFtcy50eXBlID09PSAnYWdlbnQnKSB7XG5cdFx0XHRcdHJvbGUgPSAnbGl2ZWNoYXQtYWdlbnQnO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnVybFBhcmFtcy50eXBlID09PSAnbWFuYWdlcicpIHtcblx0XHRcdFx0cm9sZSA9ICdsaXZlY2hhdC1tYW5hZ2VyJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93ICdJbnZhbGlkIHR5cGUnO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB1c2VycyA9IFJvY2tldENoYXQuYXV0aHouZ2V0VXNlcnNJblJvbGUocm9sZSk7XG5cblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdFx0dXNlcnM6IHVzZXJzLmZldGNoKCkubWFwKHVzZXIgPT4gKHsgX2lkOiB1c2VyLl9pZCwgdXNlcm5hbWU6IHVzZXIudXNlcm5hbWUgfSkpXG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuZmFpbHVyZShlLmVycm9yKTtcblx0XHR9XG5cdH0sXG5cdHBvc3QoKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICd2aWV3LWxpdmVjaGF0LW1hbmFnZXInKSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnVuYXV0aG9yaXplZCgpO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Y2hlY2sodGhpcy51cmxQYXJhbXMsIHtcblx0XHRcdFx0dHlwZTogU3RyaW5nXG5cdFx0XHR9KTtcblxuXHRcdFx0Y2hlY2sodGhpcy5ib2R5UGFyYW1zLCB7XG5cdFx0XHRcdHVzZXJuYW1lOiBTdHJpbmdcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAodGhpcy51cmxQYXJhbXMudHlwZSA9PT0gJ2FnZW50Jykge1xuXHRcdFx0XHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5MaXZlY2hhdC5hZGRBZ2VudCh0aGlzLmJvZHlQYXJhbXMudXNlcm5hbWUpO1xuXHRcdFx0XHRpZiAodXNlcikge1xuXHRcdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHsgdXNlciB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnVybFBhcmFtcy50eXBlID09PSAnbWFuYWdlcicpIHtcblx0XHRcdFx0Y29uc3QgdXNlciA9IFJvY2tldENoYXQuTGl2ZWNoYXQuYWRkTWFuYWdlcih0aGlzLmJvZHlQYXJhbXMudXNlcm5hbWUpO1xuXHRcdFx0XHRpZiAodXNlcikge1xuXHRcdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHsgdXNlciB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgJ0ludmFsaWQgdHlwZSc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZS5lcnJvcik7XG5cdFx0fVxuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5BUEkudjEuYWRkUm91dGUoJ2xpdmVjaGF0L3VzZXJzLzp0eXBlLzpfaWQnLCB7IGF1dGhSZXF1aXJlZDogdHJ1ZSB9LCB7XG5cdGdldCgpIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ3ZpZXctbGl2ZWNoYXQtbWFuYWdlcicpKSB7XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEudW5hdXRob3JpemVkKCk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNoZWNrKHRoaXMudXJsUGFyYW1zLCB7XG5cdFx0XHRcdHR5cGU6IFN0cmluZyxcblx0XHRcdFx0X2lkOiBTdHJpbmdcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQodGhpcy51cmxQYXJhbXMuX2lkKTtcblxuXHRcdFx0aWYgKCF1c2VyKSB7XG5cdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCdVc2VyIG5vdCBmb3VuZCcpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcm9sZTtcblxuXHRcdFx0aWYgKHRoaXMudXJsUGFyYW1zLnR5cGUgPT09ICdhZ2VudCcpIHtcblx0XHRcdFx0cm9sZSA9ICdsaXZlY2hhdC1hZ2VudCc7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMudXJsUGFyYW1zLnR5cGUgPT09ICdtYW5hZ2VyJykge1xuXHRcdFx0XHRyb2xlID0gJ2xpdmVjaGF0LW1hbmFnZXInO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgJ0ludmFsaWQgdHlwZSc7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh1c2VyLnJvbGVzLmluZGV4T2Yocm9sZSkgIT09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5zdWNjZXNzKHtcblx0XHRcdFx0XHR1c2VyOiBfLnBpY2sodXNlciwgJ19pZCcsICd1c2VybmFtZScpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2Vzcyh7XG5cdFx0XHRcdHVzZXI6IG51bGxcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKGUuZXJyb3IpO1xuXHRcdH1cblx0fSxcblx0ZGVsZXRlKCkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAndmlldy1saXZlY2hhdC1tYW5hZ2VyJykpIHtcblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS51bmF1dGhvcml6ZWQoKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y2hlY2sodGhpcy51cmxQYXJhbXMsIHtcblx0XHRcdFx0dHlwZTogU3RyaW5nLFxuXHRcdFx0XHRfaWQ6IFN0cmluZ1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHVzZXIgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kT25lQnlJZCh0aGlzLnVybFBhcmFtcy5faWQpO1xuXG5cdFx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMudXJsUGFyYW1zLnR5cGUgPT09ICdhZ2VudCcpIHtcblx0XHRcdFx0aWYgKFJvY2tldENoYXQuTGl2ZWNoYXQucmVtb3ZlQWdlbnQodXNlci51c2VybmFtZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5BUEkudjEuc3VjY2VzcygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMudXJsUGFyYW1zLnR5cGUgPT09ICdtYW5hZ2VyJykge1xuXHRcdFx0XHRpZiAoUm9ja2V0Q2hhdC5MaXZlY2hhdC5yZW1vdmVNYW5hZ2VyKHVzZXIudXNlcm5hbWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLnN1Y2Nlc3MoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgJ0ludmFsaWQgdHlwZSc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBSb2NrZXRDaGF0LkFQSS52MS5mYWlsdXJlKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQVBJLnYxLmZhaWx1cmUoZS5lcnJvcik7XG5cdFx0fVxuXHR9XG59KTtcbiJdfQ==
