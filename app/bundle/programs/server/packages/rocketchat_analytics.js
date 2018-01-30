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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:analytics":{"server":{"settings.js":function(){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/rocketchat_analytics/server/settings.js                                 //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
RocketChat.settings.addGroup('Analytics', function addSettings() {
	this.section('Piwik', function () {
		const enableQuery = {
			_id: 'PiwikAnalytics_enabled',
			value: true
		};
		this.add('PiwikAnalytics_enabled', false, {
			type: 'boolean',
			public: true,
			i18nLabel: 'Enable'
		});
		this.add('PiwikAnalytics_url', '', {
			type: 'string',
			public: true,
			i18nLabel: 'URL',
			enableQuery
		});
		this.add('PiwikAnalytics_siteId', '', {
			type: 'string',
			public: true,
			i18nLabel: 'Client_ID',
			enableQuery
		});
		this.add('PiwikAdditionalTrackers', '', {
			type: 'string',
			multiline: true,
			public: true,
			i18nLabel: 'PiwikAdditionalTrackers',
			enableQuery
		});
		this.add('PiwikAnalytics_prependDomain', false, {
			type: 'boolean',
			public: true,
			i18nLabel: 'PiwikAnalytics_prependDomain',
			enableQuery
		});
		this.add('PiwikAnalytics_cookieDomain', false, {
			type: 'boolean',
			public: true,
			i18nLabel: 'PiwikAnalytics_cookieDomain',
			enableQuery
		});
		this.add('PiwikAnalytics_domains', '', {
			type: 'string',
			multiline: true,
			public: true,
			i18nLabel: 'PiwikAnalytics_domains',
			enableQuery
		});
	});
	this.section('Analytics_Google', function () {
		const enableQuery = {
			_id: 'GoogleAnalytics_enabled',
			value: true
		};
		this.add('GoogleAnalytics_enabled', false, {
			type: 'boolean',
			public: true,
			i18nLabel: 'Enable'
		});
		this.add('GoogleAnalytics_ID', '', {
			type: 'string',
			public: true,
			i18nLabel: 'Analytics_Google_id',
			enableQuery
		});
	});
	this.section('Analytics_features_enabled', function addFeaturesEnabledSettings() {
		this.add('Analytics_features_messages', true, {
			type: 'boolean',
			public: true,
			i18nLabel: 'Messages',
			i18nDescription: 'Analytics_features_messages_Description'
		});
		this.add('Analytics_features_rooms', true, {
			type: 'boolean',
			public: true,
			i18nLabel: 'Rooms',
			i18nDescription: 'Analytics_features_rooms_Description'
		});
		this.add('Analytics_features_users', true, {
			type: 'boolean',
			public: true,
			i18nLabel: 'Users',
			i18nDescription: 'Analytics_features_users_Description'
		});
	});
});
//////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:analytics/server/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:analytics'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_analytics.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphbmFseXRpY3Mvc2VydmVyL3NldHRpbmdzLmpzIl0sIm5hbWVzIjpbIlJvY2tldENoYXQiLCJzZXR0aW5ncyIsImFkZEdyb3VwIiwiYWRkU2V0dGluZ3MiLCJzZWN0aW9uIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJ2YWx1ZSIsImFkZCIsInR5cGUiLCJwdWJsaWMiLCJpMThuTGFiZWwiLCJtdWx0aWxpbmUiLCJhZGRGZWF0dXJlc0VuYWJsZWRTZXR0aW5ncyIsImkxOG5EZXNjcmlwdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxXQUFXQyxRQUFYLENBQW9CQyxRQUFwQixDQUE2QixXQUE3QixFQUEwQyxTQUFTQyxXQUFULEdBQXVCO0FBQ2hFLE1BQUtDLE9BQUwsQ0FBYSxPQUFiLEVBQXNCLFlBQVc7QUFDaEMsUUFBTUMsY0FBYztBQUFDQyxRQUFLLHdCQUFOO0FBQWdDQyxVQUFPO0FBQXZDLEdBQXBCO0FBQ0EsT0FBS0MsR0FBTCxDQUFTLHdCQUFULEVBQW1DLEtBQW5DLEVBQTBDO0FBQ3pDQyxTQUFNLFNBRG1DO0FBRXpDQyxXQUFRLElBRmlDO0FBR3pDQyxjQUFXO0FBSDhCLEdBQTFDO0FBS0EsT0FBS0gsR0FBTCxDQUFTLG9CQUFULEVBQStCLEVBQS9CLEVBQW1DO0FBQ2xDQyxTQUFNLFFBRDRCO0FBRWxDQyxXQUFRLElBRjBCO0FBR2xDQyxjQUFXLEtBSHVCO0FBSWxDTjtBQUprQyxHQUFuQztBQU1BLE9BQUtHLEdBQUwsQ0FBUyx1QkFBVCxFQUFrQyxFQUFsQyxFQUFzQztBQUNyQ0MsU0FBTSxRQUQrQjtBQUVyQ0MsV0FBUSxJQUY2QjtBQUdyQ0MsY0FBVyxXQUgwQjtBQUlyQ047QUFKcUMsR0FBdEM7QUFNQSxPQUFLRyxHQUFMLENBQVMseUJBQVQsRUFBb0MsRUFBcEMsRUFBd0M7QUFDdkNDLFNBQU0sUUFEaUM7QUFFdkNHLGNBQVcsSUFGNEI7QUFHdkNGLFdBQVEsSUFIK0I7QUFJdkNDLGNBQVcseUJBSjRCO0FBS3ZDTjtBQUx1QyxHQUF4QztBQU9BLE9BQUtHLEdBQUwsQ0FBUyw4QkFBVCxFQUF5QyxLQUF6QyxFQUFnRDtBQUMvQ0MsU0FBTSxTQUR5QztBQUUvQ0MsV0FBUSxJQUZ1QztBQUcvQ0MsY0FBVyw4QkFIb0M7QUFJL0NOO0FBSitDLEdBQWhEO0FBTUEsT0FBS0csR0FBTCxDQUFTLDZCQUFULEVBQXdDLEtBQXhDLEVBQStDO0FBQzlDQyxTQUFNLFNBRHdDO0FBRTlDQyxXQUFRLElBRnNDO0FBRzlDQyxjQUFXLDZCQUhtQztBQUk5Q047QUFKOEMsR0FBL0M7QUFNQSxPQUFLRyxHQUFMLENBQVMsd0JBQVQsRUFBbUMsRUFBbkMsRUFBdUM7QUFDdENDLFNBQU0sUUFEZ0M7QUFFdENHLGNBQVcsSUFGMkI7QUFHdENGLFdBQVEsSUFIOEI7QUFJdENDLGNBQVcsd0JBSjJCO0FBS3RDTjtBQUxzQyxHQUF2QztBQU9BLEVBN0NEO0FBK0NBLE1BQUtELE9BQUwsQ0FBYSxrQkFBYixFQUFpQyxZQUFXO0FBQzNDLFFBQU1DLGNBQWM7QUFBQ0MsUUFBSyx5QkFBTjtBQUFpQ0MsVUFBTztBQUF4QyxHQUFwQjtBQUNBLE9BQUtDLEdBQUwsQ0FBUyx5QkFBVCxFQUFvQyxLQUFwQyxFQUEyQztBQUMxQ0MsU0FBTSxTQURvQztBQUUxQ0MsV0FBUSxJQUZrQztBQUcxQ0MsY0FBVztBQUgrQixHQUEzQztBQU1BLE9BQUtILEdBQUwsQ0FBUyxvQkFBVCxFQUErQixFQUEvQixFQUFtQztBQUNsQ0MsU0FBTSxRQUQ0QjtBQUVsQ0MsV0FBUSxJQUYwQjtBQUdsQ0MsY0FBVyxxQkFIdUI7QUFJbENOO0FBSmtDLEdBQW5DO0FBTUEsRUFkRDtBQWdCQSxNQUFLRCxPQUFMLENBQWEsNEJBQWIsRUFBMkMsU0FBU1MsMEJBQVQsR0FBc0M7QUFDaEYsT0FBS0wsR0FBTCxDQUFTLDZCQUFULEVBQXdDLElBQXhDLEVBQThDO0FBQzdDQyxTQUFNLFNBRHVDO0FBRTdDQyxXQUFRLElBRnFDO0FBRzdDQyxjQUFXLFVBSGtDO0FBSTdDRyxvQkFBaUI7QUFKNEIsR0FBOUM7QUFNQSxPQUFLTixHQUFMLENBQVMsMEJBQVQsRUFBcUMsSUFBckMsRUFBMkM7QUFDMUNDLFNBQU0sU0FEb0M7QUFFMUNDLFdBQVEsSUFGa0M7QUFHMUNDLGNBQVcsT0FIK0I7QUFJMUNHLG9CQUFpQjtBQUp5QixHQUEzQztBQU1BLE9BQUtOLEdBQUwsQ0FBUywwQkFBVCxFQUFxQyxJQUFyQyxFQUEyQztBQUMxQ0MsU0FBTSxTQURvQztBQUUxQ0MsV0FBUSxJQUZrQztBQUcxQ0MsY0FBVyxPQUgrQjtBQUkxQ0csb0JBQWlCO0FBSnlCLEdBQTNDO0FBTUEsRUFuQkQ7QUFvQkEsQ0FwRkQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9hbmFseXRpY3MuanMiLCJzb3VyY2VzQ29udGVudCI6WyJSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdBbmFseXRpY3MnLCBmdW5jdGlvbiBhZGRTZXR0aW5ncygpIHtcblx0dGhpcy5zZWN0aW9uKCdQaXdpaycsIGZ1bmN0aW9uKCkge1xuXHRcdGNvbnN0IGVuYWJsZVF1ZXJ5ID0ge19pZDogJ1Bpd2lrQW5hbHl0aWNzX2VuYWJsZWQnLCB2YWx1ZTogdHJ1ZX07XG5cdFx0dGhpcy5hZGQoJ1Bpd2lrQW5hbHl0aWNzX2VuYWJsZWQnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0cHVibGljOiB0cnVlLFxuXHRcdFx0aTE4bkxhYmVsOiAnRW5hYmxlJ1xuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdQaXdpa0FuYWx5dGljc191cmwnLCAnJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRwdWJsaWM6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdVUkwnLFxuXHRcdFx0ZW5hYmxlUXVlcnlcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnUGl3aWtBbmFseXRpY3Nfc2l0ZUlkJywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0cHVibGljOiB0cnVlLFxuXHRcdFx0aTE4bkxhYmVsOiAnQ2xpZW50X0lEJyxcblx0XHRcdGVuYWJsZVF1ZXJ5XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ1Bpd2lrQWRkaXRpb25hbFRyYWNrZXJzJywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0bXVsdGlsaW5lOiB0cnVlLFxuXHRcdFx0cHVibGljOiB0cnVlLFxuXHRcdFx0aTE4bkxhYmVsOiAnUGl3aWtBZGRpdGlvbmFsVHJhY2tlcnMnLFxuXHRcdFx0ZW5hYmxlUXVlcnlcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnUGl3aWtBbmFseXRpY3NfcHJlcGVuZERvbWFpbicsIGZhbHNlLCB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRwdWJsaWM6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdQaXdpa0FuYWx5dGljc19wcmVwZW5kRG9tYWluJyxcblx0XHRcdGVuYWJsZVF1ZXJ5XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ1Bpd2lrQW5hbHl0aWNzX2Nvb2tpZURvbWFpbicsIGZhbHNlLCB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRwdWJsaWM6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdQaXdpa0FuYWx5dGljc19jb29raWVEb21haW4nLFxuXHRcdFx0ZW5hYmxlUXVlcnlcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnUGl3aWtBbmFseXRpY3NfZG9tYWlucycsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdG11bHRpbGluZTogdHJ1ZSxcblx0XHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRcdGkxOG5MYWJlbDogJ1Bpd2lrQW5hbHl0aWNzX2RvbWFpbnMnLFxuXHRcdFx0ZW5hYmxlUXVlcnlcblx0XHR9KTtcblx0fSk7XG5cblx0dGhpcy5zZWN0aW9uKCdBbmFseXRpY3NfR29vZ2xlJywgZnVuY3Rpb24oKSB7XG5cdFx0Y29uc3QgZW5hYmxlUXVlcnkgPSB7X2lkOiAnR29vZ2xlQW5hbHl0aWNzX2VuYWJsZWQnLCB2YWx1ZTogdHJ1ZX07XG5cdFx0dGhpcy5hZGQoJ0dvb2dsZUFuYWx5dGljc19lbmFibGVkJywgZmFsc2UsIHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRcdGkxOG5MYWJlbDogJ0VuYWJsZSdcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkKCdHb29nbGVBbmFseXRpY3NfSUQnLCAnJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRwdWJsaWM6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdBbmFseXRpY3NfR29vZ2xlX2lkJyxcblx0XHRcdGVuYWJsZVF1ZXJ5XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRoaXMuc2VjdGlvbignQW5hbHl0aWNzX2ZlYXR1cmVzX2VuYWJsZWQnLCBmdW5jdGlvbiBhZGRGZWF0dXJlc0VuYWJsZWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLmFkZCgnQW5hbHl0aWNzX2ZlYXR1cmVzX21lc3NhZ2VzJywgdHJ1ZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0cHVibGljOiB0cnVlLFxuXHRcdFx0aTE4bkxhYmVsOiAnTWVzc2FnZXMnLFxuXHRcdFx0aTE4bkRlc2NyaXB0aW9uOiAnQW5hbHl0aWNzX2ZlYXR1cmVzX21lc3NhZ2VzX0Rlc2NyaXB0aW9uJ1xuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdBbmFseXRpY3NfZmVhdHVyZXNfcm9vbXMnLCB0cnVlLCB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRwdWJsaWM6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdSb29tcycsXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdBbmFseXRpY3NfZmVhdHVyZXNfcm9vbXNfRGVzY3JpcHRpb24nXG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0FuYWx5dGljc19mZWF0dXJlc191c2VycycsIHRydWUsIHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRcdGkxOG5MYWJlbDogJ1VzZXJzJyxcblx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0FuYWx5dGljc19mZWF0dXJlc191c2Vyc19EZXNjcmlwdGlvbidcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdfQ==
