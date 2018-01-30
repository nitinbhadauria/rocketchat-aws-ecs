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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:sms":{"settings.js":function(){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/rocketchat_sms/settings.js                                              //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
Meteor.startup(function () {
	RocketChat.settings.addGroup('SMS', function () {
		this.add('SMS_Enabled', false, {
			type: 'boolean',
			i18nLabel: 'Enabled'
		});
		this.add('SMS_Service', 'twilio', {
			type: 'select',
			values: [{
				key: 'twilio',
				i18nLabel: 'Twilio'
			}],
			i18nLabel: 'Service'
		});
		this.section('Twilio', function () {
			this.add('SMS_Twilio_Account_SID', '', {
				type: 'string',
				enableQuery: {
					_id: 'SMS_Service',
					value: 'twilio'
				},
				i18nLabel: 'Account_SID'
			});
			this.add('SMS_Twilio_authToken', '', {
				type: 'string',
				enableQuery: {
					_id: 'SMS_Service',
					value: 'twilio'
				},
				i18nLabel: 'Auth_Token'
			});
		});
	});
});
//////////////////////////////////////////////////////////////////////////////////////

},"SMS.js":function(){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/rocketchat_sms/SMS.js                                                   //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
/* globals RocketChat */RocketChat.SMS = {
	enabled: false,
	services: {},
	accountSid: null,
	authToken: null,
	fromNumber: null,

	registerService(name, service) {
		this.services[name] = service;
	},

	getService(name) {
		if (!this.services[name]) {
			throw new Meteor.Error('error-sms-service-not-configured');
		}

		return new this.services[name](this.accountSid, this.authToken, this.fromNumber);
	}

};
RocketChat.settings.get('SMS_Enabled', function (key, value) {
	RocketChat.SMS.enabled = value;
});
//////////////////////////////////////////////////////////////////////////////////////

},"services":{"twilio.js":function(require){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/rocketchat_sms/services/twilio.js                                       //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
/* globals RocketChat */class Twilio {
	constructor() {
		this.accountSid = RocketChat.settings.get('SMS_Twilio_Account_SID');
		this.authToken = RocketChat.settings.get('SMS_Twilio_authToken');
	}

	parse(data) {
		return {
			from: data.From,
			to: data.To,
			body: data.Body,
			extra: {
				toCountry: data.ToCountry,
				toState: data.ToState,
				toCity: data.ToCity,
				toZip: data.ToZip,
				fromCountry: data.FromCountry,
				fromState: data.FromState,
				fromCity: data.FromCity,
				fromZip: data.FromZip
			}
		};
	}

	send(fromNumber, toNumber, message) {
		const client = Npm.require('twilio')(this.accountSid, this.authToken);

		client.messages.create({
			to: toNumber,
			from: fromNumber,
			body: message
		});
	}

	response() /* message */{
		return {
			headers: {
				'Content-Type': 'text/xml'
			},
			body: '<Response></Response>'
		};
	}

	error(error) {
		let message = '';

		if (error.reason) {
			message = `<Message>${error.reason}</Message>`;
		}

		return {
			headers: {
				'Content-Type': 'text/xml'
			},
			body: `<Response>${message}</Response>`
		};
	}

}

RocketChat.SMS.registerService('twilio', Twilio);
//////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:sms/settings.js");
require("./node_modules/meteor/rocketchat:sms/SMS.js");
require("./node_modules/meteor/rocketchat:sms/services/twilio.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:sms'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_sms.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbXMvc2V0dGluZ3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c21zL1NNUy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbXMvc2VydmljZXMvdHdpbGlvLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJhZGRHcm91cCIsImFkZCIsInR5cGUiLCJpMThuTGFiZWwiLCJ2YWx1ZXMiLCJrZXkiLCJzZWN0aW9uIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJ2YWx1ZSIsIlNNUyIsImVuYWJsZWQiLCJzZXJ2aWNlcyIsImFjY291bnRTaWQiLCJhdXRoVG9rZW4iLCJmcm9tTnVtYmVyIiwicmVnaXN0ZXJTZXJ2aWNlIiwibmFtZSIsInNlcnZpY2UiLCJnZXRTZXJ2aWNlIiwiRXJyb3IiLCJnZXQiLCJUd2lsaW8iLCJjb25zdHJ1Y3RvciIsInBhcnNlIiwiZGF0YSIsImZyb20iLCJGcm9tIiwidG8iLCJUbyIsImJvZHkiLCJCb2R5IiwiZXh0cmEiLCJ0b0NvdW50cnkiLCJUb0NvdW50cnkiLCJ0b1N0YXRlIiwiVG9TdGF0ZSIsInRvQ2l0eSIsIlRvQ2l0eSIsInRvWmlwIiwiVG9aaXAiLCJmcm9tQ291bnRyeSIsIkZyb21Db3VudHJ5IiwiZnJvbVN0YXRlIiwiRnJvbVN0YXRlIiwiZnJvbUNpdHkiLCJGcm9tQ2l0eSIsImZyb21aaXAiLCJGcm9tWmlwIiwic2VuZCIsInRvTnVtYmVyIiwibWVzc2FnZSIsImNsaWVudCIsIk5wbSIsInJlcXVpcmUiLCJtZXNzYWdlcyIsImNyZWF0ZSIsInJlc3BvbnNlIiwiaGVhZGVycyIsImVycm9yIiwicmVhc29uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE9BQVAsQ0FBZSxZQUFXO0FBQ3pCQyxZQUFX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QUFTQyxJQUFJQyxPQUFKLENBQVksUUFBWixFQUFzQixLQUFLekMsVUFBM0IsRUFBdUMsS0FBS0MsU0FBNUMsQ0FBZjs7QUFFQXNDLFNBQU9HLFFBQVAsQ0FBZ0JDLE1BQWhCLENBQXVCO0FBQ3RCNUIsT0FBSXNCLFFBRGtCO0FBRXRCeEIsU0FBTVgsVUFGZ0I7QUFHdEJlLFNBQU1xQjtBQUhnQixHQUF2QjtBQUtBOztBQUNETSxZQUFTLGFBQWU7QUFDdkIsU0FBTztBQUNOQyxZQUFTO0FBQ1Isb0JBQWdCO0FBRFIsSUFESDtBQUlONUIsU0FBTTtBQUpBLEdBQVA7QUFNQTs7QUFDRDZCLE9BQU1BLEtBQU4sRUFBYTtBQUNaLE1BQUlSLFVBQVUsRUFBZDs7QUFDQSxNQUFJUSxNQUFNQyxNQUFWLEVBQWtCO0FBQ2pCVCxhQUFXLFlBQVlRLE1BQU1DLE1BQVEsWUFBckM7QUFDQTs7QUFDRCxTQUFPO0FBQ05GLFlBQVM7QUFDUixvQkFBZ0I7QUFEUixJQURIO0FBSU41QixTQUFPLGFBQWFxQixPQUFTO0FBSnZCLEdBQVA7QUFNQTs7QUFuRFc7O0FBc0RickQsV0FBV1ksR0FBWCxDQUFlTSxlQUFmLENBQStCLFFBQS9CLEVBQXlDTSxNQUF6QyxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3Ntcy5qcyIsInNvdXJjZXNDb250ZW50IjpbIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdTTVMnLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnU01TX0VuYWJsZWQnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0aTE4bkxhYmVsOiAnRW5hYmxlZCdcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdTTVNfU2VydmljZScsICd0d2lsaW8nLCB7XG5cdFx0XHR0eXBlOiAnc2VsZWN0Jyxcblx0XHRcdHZhbHVlczogW3tcblx0XHRcdFx0a2V5OiAndHdpbGlvJyxcblx0XHRcdFx0aTE4bkxhYmVsOiAnVHdpbGlvJ1xuXHRcdFx0fV0sXG5cdFx0XHRpMThuTGFiZWw6ICdTZXJ2aWNlJ1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zZWN0aW9uKCdUd2lsaW8nLCBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuYWRkKCdTTVNfVHdpbGlvX0FjY291bnRfU0lEJywgJycsIHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdFx0X2lkOiAnU01TX1NlcnZpY2UnLFxuXHRcdFx0XHRcdHZhbHVlOiAndHdpbGlvJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpMThuTGFiZWw6ICdBY2NvdW50X1NJRCdcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5hZGQoJ1NNU19Ud2lsaW9fYXV0aFRva2VuJywgJycsIHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdFx0X2lkOiAnU01TX1NlcnZpY2UnLFxuXHRcdFx0XHRcdHZhbHVlOiAndHdpbGlvJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpMThuTGFiZWw6ICdBdXRoX1Rva2VuJ1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iLCIvKiBnbG9iYWxzIFJvY2tldENoYXQgKi9cblJvY2tldENoYXQuU01TID0ge1xuXHRlbmFibGVkOiBmYWxzZSxcblx0c2VydmljZXM6IHt9LFxuXHRhY2NvdW50U2lkOiBudWxsLFxuXHRhdXRoVG9rZW46IG51bGwsXG5cdGZyb21OdW1iZXI6IG51bGwsXG5cblx0cmVnaXN0ZXJTZXJ2aWNlKG5hbWUsIHNlcnZpY2UpIHtcblx0XHR0aGlzLnNlcnZpY2VzW25hbWVdID0gc2VydmljZTtcblx0fSxcblxuXHRnZXRTZXJ2aWNlKG5hbWUpIHtcblx0XHRpZiAoIXRoaXMuc2VydmljZXNbbmFtZV0pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLXNtcy1zZXJ2aWNlLW5vdC1jb25maWd1cmVkJyk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgdGhpcy5zZXJ2aWNlc1tuYW1lXSh0aGlzLmFjY291bnRTaWQsIHRoaXMuYXV0aFRva2VuLCB0aGlzLmZyb21OdW1iZXIpO1xuXHR9XG59O1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnU01TX0VuYWJsZWQnLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFJvY2tldENoYXQuU01TLmVuYWJsZWQgPSB2YWx1ZTtcbn0pO1xuIiwiLyogZ2xvYmFscyBSb2NrZXRDaGF0ICovXG5jbGFzcyBUd2lsaW8ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLmFjY291bnRTaWQgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnU01TX1R3aWxpb19BY2NvdW50X1NJRCcpO1xuXHRcdHRoaXMuYXV0aFRva2VuID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NNU19Ud2lsaW9fYXV0aFRva2VuJyk7XG5cdH1cblx0cGFyc2UoZGF0YSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRmcm9tOiBkYXRhLkZyb20sXG5cdFx0XHR0bzogZGF0YS5Ubyxcblx0XHRcdGJvZHk6IGRhdGEuQm9keSxcblxuXHRcdFx0ZXh0cmE6IHtcblx0XHRcdFx0dG9Db3VudHJ5OiBkYXRhLlRvQ291bnRyeSxcblx0XHRcdFx0dG9TdGF0ZTogZGF0YS5Ub1N0YXRlLFxuXHRcdFx0XHR0b0NpdHk6IGRhdGEuVG9DaXR5LFxuXHRcdFx0XHR0b1ppcDogZGF0YS5Ub1ppcCxcblx0XHRcdFx0ZnJvbUNvdW50cnk6IGRhdGEuRnJvbUNvdW50cnksXG5cdFx0XHRcdGZyb21TdGF0ZTogZGF0YS5Gcm9tU3RhdGUsXG5cdFx0XHRcdGZyb21DaXR5OiBkYXRhLkZyb21DaXR5LFxuXHRcdFx0XHRmcm9tWmlwOiBkYXRhLkZyb21aaXBcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cdHNlbmQoZnJvbU51bWJlciwgdG9OdW1iZXIsIG1lc3NhZ2UpIHtcblx0XHRjb25zdCBjbGllbnQgPSBOcG0ucmVxdWlyZSgndHdpbGlvJykodGhpcy5hY2NvdW50U2lkLCB0aGlzLmF1dGhUb2tlbik7XG5cblx0XHRjbGllbnQubWVzc2FnZXMuY3JlYXRlKHtcblx0XHRcdHRvOiB0b051bWJlcixcblx0XHRcdGZyb206IGZyb21OdW1iZXIsXG5cdFx0XHRib2R5OiBtZXNzYWdlXG5cdFx0fSk7XG5cdH1cblx0cmVzcG9uc2UoLyogbWVzc2FnZSAqLykge1xuXHRcdHJldHVybiB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAndGV4dC94bWwnXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogJzxSZXNwb25zZT48L1Jlc3BvbnNlPidcblx0XHR9O1xuXHR9XG5cdGVycm9yKGVycm9yKSB7XG5cdFx0bGV0IG1lc3NhZ2UgPSAnJztcblx0XHRpZiAoZXJyb3IucmVhc29uKSB7XG5cdFx0XHRtZXNzYWdlID0gYDxNZXNzYWdlPiR7IGVycm9yLnJlYXNvbiB9PC9NZXNzYWdlPmA7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAndGV4dC94bWwnXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogYDxSZXNwb25zZT4keyBtZXNzYWdlIH08L1Jlc3BvbnNlPmBcblx0XHR9O1xuXHR9XG59XG5cblJvY2tldENoYXQuU01TLnJlZ2lzdGVyU2VydmljZSgndHdpbGlvJywgVHdpbGlvKTtcbiJdfQ==
