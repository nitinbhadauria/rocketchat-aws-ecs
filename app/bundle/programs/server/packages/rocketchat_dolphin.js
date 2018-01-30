(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var CustomOAuth = Package['rocketchat:custom-oauth'].CustomOAuth;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:dolphin":{"common.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/rocketchat_dolphin/common.js                                                                //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
// Dolphin OAuth2
/* globals CustomOAuth */const config = {
	serverURL: '',
	authorizePath: '/m/oauth2/auth/',
	tokenPath: '/m/oauth2/token/',
	identityPath: '/m/oauth2/api/me/',
	scope: 'basic',
	addAutopublishFields: {
		forLoggedInUser: ['services.dolphin'],
		forOtherUsers: ['services.dolphin.name']
	}
};
const Dolphin = new CustomOAuth('dolphin', config);

function DolphinOnCreateUser(options, user) {
	if (user && user.services && user.services.dolphin && user.services.dolphin.NickName) {
		user.username = user.services.dolphin.NickName;
	}

	return user;
}

if (Meteor.isServer) {
	Meteor.startup(() => RocketChat.models.Settings.find({
		_id: 'Accounts_OAuth_Dolphin_URL'
	}).observe({
		added() {
			config.serverURL = RocketChat.settings.get('Accounts_OAuth_Dolphin_URL');
			return Dolphin.configure(config);
		},

		changed() {
			config.serverURL = RocketChat.settings.get('Accounts_OAuth_Dolphin_URL');
			return Dolphin.configure(config);
		}

	}));

	if (RocketChat.settings.get('Accounts_OAuth_Dolphin_URL')) {
		const data = {
			buttonLabelText: RocketChat.settings.get('Accounts_OAuth_Dolphin_button_label_text'),
			buttonColor: RocketChat.settings.get('Accounts_OAuth_Dolphin_button_color'),
			buttonLabelColor: RocketChat.settings.get('Accounts_OAuth_Dolphin_button_label_color'),
			clientId: RocketChat.settings.get('Accounts_OAuth_Dolphin_id'),
			secret: RocketChat.settings.get('Accounts_OAuth_Dolphin_secret'),
			serverURL: RocketChat.settings.get('Accounts_OAuth_Dolphin_URL'),
			loginStyle: RocketChat.settings.get('Accounts_OAuth_Dolphin_login_style')
		};
		ServiceConfiguration.configurations.upsert({
			service: 'dolphin'
		}, {
			$set: data
		});
	}

	RocketChat.callbacks.add('beforeCreateUser', DolphinOnCreateUser, RocketChat.callbacks.priority.HIGH);
} else {
	Meteor.startup(() => Tracker.autorun(function () {
		if (RocketChat.settings.get('Accounts_OAuth_Dolphin_URL')) {
			config.serverURL = RocketChat.settings.get('Accounts_OAuth_Dolphin_URL');
			return Dolphin.configure(config);
		}
	}));
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

},"startup.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/rocketchat_dolphin/startup.js                                                               //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
RocketChat.settings.add('Accounts_OAuth_Dolphin_URL', '', {
  type: 'string',
  group: 'OAuth',
  public: true,
  section: 'Dolphin',
  i18nLabel: 'URL'
});
RocketChat.settings.add('Accounts_OAuth_Dolphin', false, {
  type: 'boolean',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_Enable'
});
RocketChat.settings.add('Accounts_OAuth_Dolphin_id', '', {
  type: 'string',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_id'
});
RocketChat.settings.add('Accounts_OAuth_Dolphin_secret', '', {
  type: 'string',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_Secret'
});
RocketChat.settings.add('Accounts_OAuth_Dolphin_login_style', 'redirect', {
  type: 'select',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_Login_Style',
  persistent: true,
  values: [{
    key: 'redirect',
    i18nLabel: 'Redirect'
  }, {
    key: 'popup',
    i18nLabel: 'Popup'
  }, {
    key: '',
    i18nLabel: 'Default'
  }]
});
RocketChat.settings.add('Accounts_OAuth_Dolphin_button_label_text', '', {
  type: 'string',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_Button_Label_Text',
  persistent: true
});
RocketChat.settings.add('Accounts_OAuth_Dolphin_button_label_color', '#FFFFFF', {
  type: 'string',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_Button_Label_Color',
  persistent: true
});
RocketChat.settings.add('Accounts_OAuth_Dolphin_button_color', '#13679A', {
  type: 'string',
  group: 'OAuth',
  section: 'Dolphin',
  i18nLabel: 'Accounts_OAuth_Custom_Button_Color',
  persistent: true
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:dolphin/common.js");
require("./node_modules/meteor/rocketchat:dolphin/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:dolphin'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_dolphin.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpkb2xwaGluL2NvbW1vbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpkb2xwaGluL3N0YXJ0dXAuanMiXSwibmFtZXMiOlsiY29uZmlnIiwic2VydmVyVVJMIiwiYXV0aG9yaXplUGF0aCIsInRva2VuUGF0aCIsImlkZW50aXR5UGF0aCIsInNjb3BlIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwiRG9scGhpbiIsIkN1c3RvbU9BdXRoIiwiRG9scGhpbk9uQ3JlYXRlVXNlciIsIm9wdGlvbnMiLCJ1c2VyIiwic2VydmljZXMiLCJkb2xwaGluIiwiTmlja05hbWUiLCJ1c2VybmFtZSIsIk1ldGVvciIsImlzU2VydmVyIiwic3RhcnR1cCIsIlJvY2tldENoYXQiLCJtb2RlbHMiLCJTZXR0aW5ncyIsImZpbmQiLCJfaWQiLCJvYnNlcnZlIiwiYWRkZWQiLCJzZXR0aW5ncyIsImdldCIsImNvbmZpZ3VyZSIsImNoYW5nZWQiLCJkYXRhIiwiYnV0dG9uTGFiZWxUZXh0IiwiYnV0dG9uQ29sb3IiLCJidXR0b25MYWJlbENvbG9yIiwiY2xpZW50SWQiLCJzZWNyZXQiLCJsb2dpblN0eWxlIiwiU2VydmljZUNvbmZpZ3VyYXRpb24iLCJjb25maWd1cmF0aW9ucyIsInVwc2VydCIsInNlcnZpY2UiLCIkc2V0IiwiY2FsbGJhY2tzIiwiYWRkIiwicHJpb3JpdHkiLCJISUdIIiwiVHJhY2tlciIsImF1dG9ydW4iLCJ0eXBlIiwiZ3JvdXAiLCJwdWJsaWMiLCJzZWN0aW9uIiwiaTE4bkxhYmVsIiwicGVyc2lzdGVudCIsInZhbHVlcyIsImtleSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQSx5QkFFQSxNQUFNQSxTQUFTO0FBQ2RDLFlBQVcsRUFERztBQUVkQyxnQkFBZSxpQkFG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Q0FqQyxXQUFXTyxRQUFYLENBQW9CaUIsR0FBcEIsQ0FBd0IsMENBQXhCLEVBQW9FLEVBQXBFLEVBQXdFO0FBQUVLLFFBQU0sUUFBUjtBQUFrQkMsU0FBTyxPQUF6QjtBQUFrQ0UsV0FBUyxTQUEzQztBQUFzREMsYUFBVyx5Q0FBakU7QUFBNEdDLGNBQVk7QUFBeEgsQ0FBeEU7QUFDQWxDLFdBQVdPLFFBQVgsQ0FBb0JpQixHQUFwQixDQUF3QiwyQ0FBeEIsRUFBcUUsU0FBckUsRUFBZ0Y7QUFBRUssUUFBTSxRQUFSO0FBQWtCQyxTQUFPLE9BQXpCO0FBQWtDRSxXQUFTLFNBQTNDO0FBQXNEQyxhQUFXLDBDQUFqRTtBQUE2R0MsY0FBWTtBQUF6SCxDQUFoRjtBQUNBbEMsV0FBV08sUUFBWCxDQUFvQmlCLEdBQXBCLENBQXdCLHFDQUF4QixFQUErRCxTQUEvRCxFQUEwRTtBQUFFSyxRQUFNLFFBQVI7QUFBa0JDLFNBQU8sT0FBekI7QUFBa0NFLFdBQVMsU0FBM0M7QUFBc0RDLGFBQVcsb0NBQWpFO0FBQXVHQyxjQUFZO0FBQW5ILENBQTFFLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfZG9scGhpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIERvbHBoaW4gT0F1dGgyXG4vKiBnbG9iYWxzIEN1c3RvbU9BdXRoICovXG5cbmNvbnN0IGNvbmZpZyA9IHtcblx0c2VydmVyVVJMOiAnJyxcblx0YXV0aG9yaXplUGF0aDogJy9tL29hdXRoMi9hdXRoLycsXG5cdHRva2VuUGF0aDogJy9tL29hdXRoMi90b2tlbi8nLFxuXHRpZGVudGl0eVBhdGg6ICcvbS9vYXV0aDIvYXBpL21lLycsXG5cdHNjb3BlOiAnYmFzaWMnLFxuXHRhZGRBdXRvcHVibGlzaEZpZWxkczoge1xuXHRcdGZvckxvZ2dlZEluVXNlcjogWydzZXJ2aWNlcy5kb2xwaGluJ10sXG5cdFx0Zm9yT3RoZXJVc2VyczogWydzZXJ2aWNlcy5kb2xwaGluLm5hbWUnXVxuXHR9XG59O1xuXG5jb25zdCBEb2xwaGluID0gbmV3IEN1c3RvbU9BdXRoKCdkb2xwaGluJywgY29uZmlnKTtcblxuZnVuY3Rpb24gRG9scGhpbk9uQ3JlYXRlVXNlcihvcHRpb25zLCB1c2VyKSB7XG5cdGlmICh1c2VyICYmIHVzZXIuc2VydmljZXMgJiYgdXNlci5zZXJ2aWNlcy5kb2xwaGluICYmIHVzZXIuc2VydmljZXMuZG9scGhpbi5OaWNrTmFtZSkge1xuXHRcdHVzZXIudXNlcm5hbWUgPSB1c2VyLnNlcnZpY2VzLmRvbHBoaW4uTmlja05hbWU7XG5cdH1cblx0cmV0dXJuIHVzZXI7XG59XG5cbmlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcblx0TWV0ZW9yLnN0YXJ0dXAoKCkgPT5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kKHsgX2lkOiAnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9VUkwnIH0pLm9ic2VydmUoe1xuXHRcdFx0YWRkZWQoKSB7XG5cdFx0XHRcdGNvbmZpZy5zZXJ2ZXJVUkwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9VUkwnKTtcblx0XHRcdFx0cmV0dXJuIERvbHBoaW4uY29uZmlndXJlKGNvbmZpZyk7XG5cdFx0XHR9LFxuXHRcdFx0Y2hhbmdlZCgpIHtcblx0XHRcdFx0Y29uZmlnLnNlcnZlclVSTCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBY2NvdW50c19PQXV0aF9Eb2xwaGluX1VSTCcpO1xuXHRcdFx0XHRyZXR1cm4gRG9scGhpbi5jb25maWd1cmUoY29uZmlnKTtcblx0XHRcdH1cblx0XHR9KVxuXHQpO1xuXG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9VUkwnKSkge1xuXHRcdGNvbnN0IGRhdGEgPSB7XG5cdFx0XHRidXR0b25MYWJlbFRleHQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBY2NvdW50c19PQXV0aF9Eb2xwaGluX2J1dHRvbl9sYWJlbF90ZXh0JyksXG5cdFx0XHRidXR0b25Db2xvcjogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FjY291bnRzX09BdXRoX0RvbHBoaW5fYnV0dG9uX2NvbG9yJyksXG5cdFx0XHRidXR0b25MYWJlbENvbG9yOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9idXR0b25fbGFiZWxfY29sb3InKSxcblx0XHRcdGNsaWVudElkOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9pZCcpLFxuXHRcdFx0c2VjcmV0OiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9zZWNyZXQnKSxcblx0XHRcdHNlcnZlclVSTDogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FjY291bnRzX09BdXRoX0RvbHBoaW5fVVJMJyksXG5cdFx0XHRsb2dpblN0eWxlOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9sb2dpbl9zdHlsZScpXG5cdFx0fTtcblxuXHRcdFNlcnZpY2VDb25maWd1cmF0aW9uLmNvbmZpZ3VyYXRpb25zLnVwc2VydCh7c2VydmljZTogJ2RvbHBoaW4nfSwgeyRzZXQ6IGRhdGF9KTtcblx0fVxuXG5cdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYmVmb3JlQ3JlYXRlVXNlcicsIERvbHBoaW5PbkNyZWF0ZVVzZXIsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkhJR0gpO1xufSBlbHNlIHtcblx0TWV0ZW9yLnN0YXJ0dXAoKCkgPT5cblx0XHRUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FjY291bnRzX09BdXRoX0RvbHBoaW5fVVJMJykpIHtcblx0XHRcdFx0Y29uZmlnLnNlcnZlclVSTCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBY2NvdW50c19PQXV0aF9Eb2xwaGluX1VSTCcpO1xuXHRcdFx0XHRyZXR1cm4gRG9scGhpbi5jb25maWd1cmUoY29uZmlnKTtcblx0XHRcdH1cblx0XHR9KVxuXHQpO1xufVxuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0FjY291bnRzX09BdXRoX0RvbHBoaW5fVVJMJywgJycsIHsgdHlwZTogJ3N0cmluZycsIGdyb3VwOiAnT0F1dGgnLCBwdWJsaWM6IHRydWUsIHNlY3Rpb246ICdEb2xwaGluJywgaTE4bkxhYmVsOiAnVVJMJyB9KTtcblJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdBY2NvdW50c19PQXV0aF9Eb2xwaGluJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBncm91cDogJ09BdXRoJywgc2VjdGlvbjogJ0RvbHBoaW4nLCBpMThuTGFiZWw6ICdBY2NvdW50c19PQXV0aF9DdXN0b21fRW5hYmxlJyB9KTtcblJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdBY2NvdW50c19PQXV0aF9Eb2xwaGluX2lkJywgJycsIHsgdHlwZTogJ3N0cmluZycsIGdyb3VwOiAnT0F1dGgnLCBzZWN0aW9uOiAnRG9scGhpbicsIGkxOG5MYWJlbDogJ0FjY291bnRzX09BdXRoX0N1c3RvbV9pZCcgfSk7XG5Sb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9zZWNyZXQnLCAnJywgeyB0eXBlOiAnc3RyaW5nJywgZ3JvdXA6ICdPQXV0aCcsIHNlY3Rpb246ICdEb2xwaGluJywgaTE4bkxhYmVsOiAnQWNjb3VudHNfT0F1dGhfQ3VzdG9tX1NlY3JldCcgfSk7XG5Sb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9sb2dpbl9zdHlsZScsICdyZWRpcmVjdCcsIHsgdHlwZTogJ3NlbGVjdCcsIGdyb3VwOiAnT0F1dGgnLCBzZWN0aW9uOiAnRG9scGhpbicsIGkxOG5MYWJlbDogJ0FjY291bnRzX09BdXRoX0N1c3RvbV9Mb2dpbl9TdHlsZScsIHBlcnNpc3RlbnQ6IHRydWUsIHZhbHVlczogWyB7IGtleTogJ3JlZGlyZWN0JywgaTE4bkxhYmVsOiAnUmVkaXJlY3QnIH0sIHsga2V5OiAncG9wdXAnLCBpMThuTGFiZWw6ICdQb3B1cCcgfSwgeyBrZXk6ICcnLCBpMThuTGFiZWw6ICdEZWZhdWx0JyB9IF0gfSk7XG5Sb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnQWNjb3VudHNfT0F1dGhfRG9scGhpbl9idXR0b25fbGFiZWxfdGV4dCcsICcnLCB7IHR5cGU6ICdzdHJpbmcnLCBncm91cDogJ09BdXRoJywgc2VjdGlvbjogJ0RvbHBoaW4nLCBpMThuTGFiZWw6ICdBY2NvdW50c19PQXV0aF9DdXN0b21fQnV0dG9uX0xhYmVsX1RleHQnLCBwZXJzaXN0ZW50OiB0cnVlIH0pO1xuUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0FjY291bnRzX09BdXRoX0RvbHBoaW5fYnV0dG9uX2xhYmVsX2NvbG9yJywgJyNGRkZGRkYnLCB7IHR5cGU6ICdzdHJpbmcnLCBncm91cDogJ09BdXRoJywgc2VjdGlvbjogJ0RvbHBoaW4nLCBpMThuTGFiZWw6ICdBY2NvdW50c19PQXV0aF9DdXN0b21fQnV0dG9uX0xhYmVsX0NvbG9yJywgcGVyc2lzdGVudDogdHJ1ZSB9KTtcblJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdBY2NvdW50c19PQXV0aF9Eb2xwaGluX2J1dHRvbl9jb2xvcicsICcjMTM2NzlBJywgeyB0eXBlOiAnc3RyaW5nJywgZ3JvdXA6ICdPQXV0aCcsIHNlY3Rpb246ICdEb2xwaGluJywgaTE4bkxhYmVsOiAnQWNjb3VudHNfT0F1dGhfQ3VzdG9tX0J1dHRvbl9Db2xvcicsIHBlcnNpc3RlbnQ6IHRydWUgfSk7XG4iXX0=
