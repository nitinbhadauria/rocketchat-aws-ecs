(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:videobridge":{"lib":{"messageType.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_videobridge/lib/messageType.js                                                          //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
Meteor.startup(function () {
	RocketChat.MessageTypes.registerType({
		id: 'jitsi_call_started',
		system: true,
		message: TAPi18n.__('Started_a_video_call')
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_videobridge/server/settings.js                                                          //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
Meteor.startup(function () {
	RocketChat.settings.addGroup('Video Conference', function () {
		this.add('Jitsi_Enabled', false, {
			type: 'boolean',
			i18nLabel: 'Enabled',
			alert: 'This Feature is currently in beta! Please report bugs to github.com/RocketChat/Rocket.Chat/issues',
			public: true
		});
		this.add('Jitsi_Domain', 'meet.jit.si', {
			type: 'string',
			enableQuery: {
				_id: 'Jitsi_Enabled',
				value: true
			},
			i18nLabel: 'Domain',
			public: true
		});
		this.add('Jitsi_URL_Room_Prefix', 'RocketChat', {
			type: 'string',
			enableQuery: {
				_id: 'Jitsi_Enabled',
				value: true
			},
			i18nLabel: 'URL_room_prefix',
			public: true
		});
		this.add('Jitsi_SSL', true, {
			type: 'boolean',
			enableQuery: {
				_id: 'Jitsi_Enabled',
				value: true
			},
			i18nLabel: 'SSL',
			public: true
		});
		this.add('Jitsi_Open_New_Window', false, {
			type: 'boolean',
			enableQuery: {
				_id: 'Jitsi_Enabled',
				value: true
			},
			i18nLabel: 'Always_open_in_new_window',
			public: true
		});
		this.add('Jitsi_Enable_Channels', false, {
			type: 'boolean',
			enableQuery: {
				_id: 'Jitsi_Enabled',
				value: true
			},
			i18nLabel: 'Jitsi_Enable_Channels',
			public: true
		});
		this.add('Jitsi_Chrome_Extension', 'nocfbnnmjnndkbipkabodnheejiegccf', {
			type: 'string',
			enableQuery: {
				_id: 'Jitsi_Enabled',
				value: true
			},
			i18nLabel: 'Jitsi_Chrome_Extension',
			public: true
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"models":{"Rooms.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_videobridge/server/models/Rooms.js                                                      //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
/**
 * sets jitsiTimeout to indicate a call is in progress
 * @param {string} _id - Room id
 * @parm {number} time - time to set
 */RocketChat.models.Rooms.setJitsiTimeout = function (_id, time) {
	const query = {
		_id
	};
	const update = {
		$set: {
			jitsiTimeout: time
		}
	};
	return this.update(query, update);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"jitsiSetTimeout.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_videobridge/server/methods/jitsiSetTimeout.js                                           //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
Meteor.methods({
	'jitsi:updateTimeout': rid => {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'jitsi:updateTimeout'
			});
		}

		const room = RocketChat.models.Rooms.findOneById(rid);
		const currentTime = new Date().getTime();
		const jitsiTimeout = new Date(room && room.jitsiTimeout || currentTime).getTime();

		if (jitsiTimeout <= currentTime) {
			RocketChat.models.Rooms.setJitsiTimeout(rid, new Date(currentTime + 35 * 1000));
			const message = RocketChat.models.Messages.createWithTypeRoomIdMessageAndUser('jitsi_call_started', rid, '', Meteor.user(), {
				actionLinks: [{
					icon: 'icon-videocam',
					label: TAPi18n.__('Click_to_join'),
					method_id: 'joinJitsiCall',
					params: ''
				}]
			});
			const room = RocketChat.models.Rooms.findOneById(rid);
			message.msg = TAPi18n.__('Started_a_video_call');
			message.mentions = [{
				_id: 'here',
				username: 'here'
			}];
			RocketChat.callbacks.run('afterSaveMessage', message, room);
		} else if ((jitsiTimeout - currentTime) / 1000 <= 15) {
			RocketChat.models.Rooms.setJitsiTimeout(rid, new Date(jitsiTimeout + 25 * 1000));
		}
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"actionLink.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_videobridge/server/actionLink.js                                                        //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
RocketChat.actionLinks.register('joinJitsiCall', function () /*message, params*/{});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:videobridge/lib/messageType.js");
require("./node_modules/meteor/rocketchat:videobridge/server/settings.js");
require("./node_modules/meteor/rocketchat:videobridge/server/models/Rooms.js");
require("./node_modules/meteor/rocketchat:videobridge/server/methods/jitsiSetTimeout.js");
require("./node_modules/meteor/rocketchat:videobridge/server/actionLink.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:videobridge'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_videobridge.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp2aWRlb2JyaWRnZS9saWIvbWVzc2FnZVR5cGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6dmlkZW9icmlkZ2Uvc2VydmVyL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnZpZGVvYnJpZGdlL3NlcnZlci9tb2RlbHMvUm9vbXMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6dmlkZW9icmlkZ2Uvc2VydmVyL21ldGhvZHMvaml0c2lTZXRUaW1lb3V0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnZpZGVvYnJpZGdlL3NlcnZlci9hY3Rpb25MaW5rLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0IiwiTWVzc2FnZVR5cGVzIiwicmVnaXN0ZXJUeXBlIiwiaWQiLCJzeXN0ZW0iLCJtZXNzYWdlIiwiVEFQaTE4biIsIl9fIiwic2V0dGluZ3MiLCJhZGRHcm91cCIsImFkZCIsInR5cGUiLCJpMThuTGFiZWwiLCJhbGVydCIsInB1YmxpYyIsImVuYWJsZVF1ZXJ5IiwiX2lkIiwidmFsdWUiLCJtb2RlbHMiLCJSb29tcyIsInNldEppdHNpVGltZW91dCIsInRpbWUiLCJxdWVyeSIsInVwZGF0ZSIsIiRzZXQiLCJqaXRzaVRpbWVvdXQiLCJtZXRob2RzIiwicmlkIiwidXNlcklkIiwiRXJyb3IiLCJtZXRob2QiLCJyb29tIiwiZmluZE9uZUJ5SWQiLCJjdXJyZW50VGltZSIsIkRhdGUiLCJnZXRUaW1lIiwiTWVzc2FnZXMiLCJjcmVhdGVXaXRoVHlwZVJvb21JZE1lc3NhZ2VBbmRVc2VyIiwidXNlciIsImFjdGlvbkxpbmtzIiwiaWNvbiIsImxhYmVsIiwibWV0aG9kX2lkIiwicGFyYW1zIiwibXNnIiwibWVudGlvbnMiLCJ1c2Vy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M0MsT0FBN0MsRUFBc0QwQixJQUF0RDtBQUNBLEdBaEJELE1BZ0JPLElBQUksQ0FBQ04sZUFBZVEsV0FBaEIsSUFBK0IsSUFBL0IsSUFBdUMsRUFBM0MsRUFBK0M7QUFDckRqQyxjQUFXa0IsTUFBWCxDQUFrQkMsS0FBbEIsQ0FBd0JDLGVBQXhCLENBQXdDTyxHQUF4QyxFQUE2QyxJQUFJTyxJQUFKLENBQVNULGVBQWUsS0FBRyxJQUEzQixDQUE3QztBQUNBO0FBQ0Q7QUEvQmEsQ0FBZixFOzs7Ozs7Ozs7OztBQ0RBekIsV0FBV3VDLFdBQVgsQ0FBdUJVLFFBQXZCLENBQWdDLGVBQWhDLEVBQWlELFlBQVMsbUJBQXFCLENBRTlFLENBRkQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF92aWRlb2JyaWRnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0Lk1lc3NhZ2VUeXBlcy5yZWdpc3RlclR5cGUoe1xuXHRcdGlkOiAnaml0c2lfY2FsbF9zdGFydGVkJyxcblx0XHRzeXN0ZW06IHRydWUsXG5cdFx0bWVzc2FnZTogVEFQaTE4bi5fXygnU3RhcnRlZF9hX3ZpZGVvX2NhbGwnKVxuXHR9KTtcbn0pO1xuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ1ZpZGVvIENvbmZlcmVuY2UnLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnSml0c2lfRW5hYmxlZCcsIGZhbHNlLCB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRpMThuTGFiZWw6ICdFbmFibGVkJyxcblx0XHRcdGFsZXJ0OiAnVGhpcyBGZWF0dXJlIGlzIGN1cnJlbnRseSBpbiBiZXRhISBQbGVhc2UgcmVwb3J0IGJ1Z3MgdG8gZ2l0aHViLmNvbS9Sb2NrZXRDaGF0L1JvY2tldC5DaGF0L2lzc3VlcycsXG5cdFx0XHRwdWJsaWM6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdKaXRzaV9Eb21haW4nLCAnbWVldC5qaXQuc2knLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ppdHNpX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGkxOG5MYWJlbDogJ0RvbWFpbicsXG5cdFx0XHRwdWJsaWM6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdKaXRzaV9VUkxfUm9vbV9QcmVmaXgnLCAnUm9ja2V0Q2hhdCcsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnSml0c2lfRW5hYmxlZCcsXG5cdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0aTE4bkxhYmVsOiAnVVJMX3Jvb21fcHJlZml4Jyxcblx0XHRcdHB1YmxpYzogdHJ1ZVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoJ0ppdHNpX1NTTCcsIHRydWUsIHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ppdHNpX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGkxOG5MYWJlbDogJ1NTTCcsXG5cdFx0XHRwdWJsaWM6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdKaXRzaV9PcGVuX05ld19XaW5kb3cnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnSml0c2lfRW5hYmxlZCcsXG5cdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0aTE4bkxhYmVsOiAnQWx3YXlzX29wZW5faW5fbmV3X3dpbmRvdycsXG5cdFx0XHRwdWJsaWM6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdKaXRzaV9FbmFibGVfQ2hhbm5lbHMnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnSml0c2lfRW5hYmxlZCcsXG5cdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0aTE4bkxhYmVsOiAnSml0c2lfRW5hYmxlX0NoYW5uZWxzJyxcblx0XHRcdHB1YmxpYzogdHJ1ZVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoJ0ppdHNpX0Nocm9tZV9FeHRlbnNpb24nLCAnbm9jZmJubm1qbm5ka2JpcGthYm9kbmhlZWppZWdjY2YnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ppdHNpX0VuYWJsZWQnLFxuXHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGkxOG5MYWJlbDogJ0ppdHNpX0Nocm9tZV9FeHRlbnNpb24nLFxuXHRcdFx0cHVibGljOiB0cnVlXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iLCIvKipcbiAqIHNldHMgaml0c2lUaW1lb3V0IHRvIGluZGljYXRlIGEgY2FsbCBpcyBpbiBwcm9ncmVzc1xuICogQHBhcmFtIHtzdHJpbmd9IF9pZCAtIFJvb20gaWRcbiAqIEBwYXJtIHtudW1iZXJ9IHRpbWUgLSB0aW1lIHRvIHNldFxuICovXG5Sb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRKaXRzaVRpbWVvdXQgPSBmdW5jdGlvbihfaWQsIHRpbWUpIHtcblx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0X2lkXG5cdH07XG5cblx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdCRzZXQ6IHtcblx0XHRcdGppdHNpVGltZW91dDogdGltZVxuXHRcdH1cblx0fTtcblxuXHRyZXR1cm4gdGhpcy51cGRhdGUocXVlcnksIHVwZGF0ZSk7XG59O1xuIiwiXG5NZXRlb3IubWV0aG9kcyh7XG5cdCdqaXRzaTp1cGRhdGVUaW1lb3V0JzogKHJpZCkgPT4ge1xuXG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2ppdHNpOnVwZGF0ZVRpbWVvdXQnIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChyaWQpO1xuXHRcdGNvbnN0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cblx0XHRjb25zdCBqaXRzaVRpbWVvdXQgPSBuZXcgRGF0ZSgocm9vbSAmJiByb29tLmppdHNpVGltZW91dCkgfHwgY3VycmVudFRpbWUpLmdldFRpbWUoKTtcblxuXHRcdGlmIChqaXRzaVRpbWVvdXQgPD0gY3VycmVudFRpbWUpIHtcblx0XHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnNldEppdHNpVGltZW91dChyaWQsIG5ldyBEYXRlKGN1cnJlbnRUaW1lICsgMzUqMTAwMCkpO1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLmNyZWF0ZVdpdGhUeXBlUm9vbUlkTWVzc2FnZUFuZFVzZXIoJ2ppdHNpX2NhbGxfc3RhcnRlZCcsIHJpZCwgJycsIE1ldGVvci51c2VyKCksIHtcblx0XHRcdFx0YWN0aW9uTGlua3MgOiBbXG5cdFx0XHRcdFx0eyBpY29uOiAnaWNvbi12aWRlb2NhbScsIGxhYmVsOiBUQVBpMThuLl9fKCdDbGlja190b19qb2luJyksIG1ldGhvZF9pZDogJ2pvaW5KaXRzaUNhbGwnLCBwYXJhbXM6ICcnfVxuXHRcdFx0XHRdXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChyaWQpO1xuXHRcdFx0bWVzc2FnZS5tc2cgPSBUQVBpMThuLl9fKCdTdGFydGVkX2FfdmlkZW9fY2FsbCcpO1xuXHRcdFx0bWVzc2FnZS5tZW50aW9ucyA9IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdF9pZDonaGVyZScsXG5cdFx0XHRcdFx0dXNlcm5hbWU6J2hlcmUnXG5cdFx0XHRcdH1cblx0XHRcdF07XG5cdFx0XHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5ydW4oJ2FmdGVyU2F2ZU1lc3NhZ2UnLCBtZXNzYWdlLCByb29tKTtcblx0XHR9IGVsc2UgaWYgKChqaXRzaVRpbWVvdXQgLSBjdXJyZW50VGltZSkgLyAxMDAwIDw9IDE1KSB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5zZXRKaXRzaVRpbWVvdXQocmlkLCBuZXcgRGF0ZShqaXRzaVRpbWVvdXQgKyAyNSoxMDAwKSk7XG5cdFx0fVxuXHR9XG59KTtcbiIsIlJvY2tldENoYXQuYWN0aW9uTGlua3MucmVnaXN0ZXIoJ2pvaW5KaXRzaUNhbGwnLCBmdW5jdGlvbigvKm1lc3NhZ2UsIHBhcmFtcyovKSB7XG5cbn0pO1xuIl19
