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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:mentions":{"server":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_mentions/server/server.js                                                               //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let MentionsServer;
module.watch(require("./Mentions"), {
	default(v) {
		MentionsServer = v;
	}

}, 1);
const mention = new MentionsServer({
	pattern: () => RocketChat.settings.get('UTF8_Names_Validation'),
	messageMaxAll: () => RocketChat.settings.get('Message_MaxAll'),
	getUsers: usernames => Meteor.users.find({
		username: {
			$in: _.unique(usernames)
		}
	}, {
		fields: {
			_id: true,
			username: true
		}
	}).fetch(),
	getChannel: rid => RocketChat.models.Rooms.findOneById(rid),
	getChannels: channels => RocketChat.models.Rooms.find({
		name: {
			$in: _.unique(channels)
		},
		t: 'c'
	}, {
		fields: {
			_id: 1,
			name: 1
		}
	}).fetch()
});
RocketChat.callbacks.add('beforeSaveMessage', message => mention.execute(message), RocketChat.callbacks.priority.HIGH, 'mentions');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Mentions.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_mentions/server/Mentions.js                                                             //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
module.export({
	default: () => MentionsServer
});
let Mentions;
module.watch(require("../Mentions"), {
	default(v) {
		Mentions = v;
	}

}, 0);

class MentionsServer extends Mentions {
	constructor(args) {
		super(args);
		this.messageMaxAll = args.messageMaxAll;
		this.getChannel = args.getChannel;
		this.getChannels = args.getChannels;
		this.getUsers = args.getUsers;
	}

	set getUsers(m) {
		this._getUsers = m;
	}

	get getUsers() {
		return typeof this._getUsers === 'function' ? this._getUsers : () => this._getUsers;
	}

	set getChannels(m) {
		this._getChannels = m;
	}

	get getChannels() {
		return typeof this._getChannels === 'function' ? this._getChannels : () => this._getChannels;
	}

	set getChannel(m) {
		this._getChannel = m;
	}

	get getChannel() {
		return typeof this._getChannel === 'function' ? this._getChannel : () => this._getChannel;
	}

	set messageMaxAll(m) {
		this._messageMaxAll = m;
	}

	get messageMaxAll() {
		return typeof this._messageMaxAll === 'function' ? this._messageMaxAll() : this._messageMaxAll;
	}

	getUsersByMentions({
		msg,
		rid
	}) {
		let mentions = this.getUserMentions(msg);
		const mentionsAll = [];
		const userMentions = [];
		mentions.forEach(m => {
			const mention = m.trim().substr(1);

			if (mention !== 'all' && mention !== 'here') {
				return userMentions.push(mention);
			}

			if (mention === 'all') {
				const messageMaxAll = this.messageMaxAll;
				const allChannel = this.getChannel(rid);

				if (messageMaxAll !== 0 && allChannel.usernames.length >= messageMaxAll) {
					return;
				}
			}

			mentionsAll.push({
				_id: mention,
				username: mention
			});
		});
		mentions = userMentions.length ? this.getUsers(userMentions) : [];
		return [...mentionsAll, ...mentions];
	}

	getChannelbyMentions({
		msg
	}) {
		const channels = this.getChannelMentions(msg);
		return this.getChannels(channels.map(c => c.trim().substr(1)));
	}

	execute(message) {
		const mentionsAll = this.getUsersByMentions(message);
		const channels = this.getChannelbyMentions(message);
		message.mentions = mentionsAll;
		message.channels = channels;
		return message;
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"Mentions.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_mentions/Mentions.js                                                                    //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
module.exportDefault(class {
	constructor({
		pattern,
		useRealName,
		me
	}) {
		this.pattern = pattern;
		this.useRealName = useRealName;
		this.me = me;
	}

	set me(m) {
		this._me = m;
	}

	get me() {
		return typeof this._me === 'function' ? this._me() : this._me;
	}

	set pattern(p) {
		this._pattern = p;
	}

	get pattern() {
		return typeof this._pattern === 'function' ? this._pattern() : this._pattern;
	}

	set useRealName(s) {
		this._useRealName = s;
	}

	get useRealName() {
		return typeof this._useRealName === 'function' ? this._useRealName() : this._useRealName;
	}

	get userMentionRegex() {
		return new RegExp(`@(${this.pattern})`, 'gm');
	}

	get channelMentionRegex() {
		return new RegExp(`^#(${this.pattern})| #(${this.pattern})`, 'gm');
	}

	replaceUsers(str, message, me) {
		return str.replace(this.userMentionRegex, (match, username) => {
			if (['all', 'here'].includes(username)) {
				return `<a class="mention-link mention-link-me mention-link-all background-attention-color">${match}</a>`;
			}

			const mentionObj = _.findWhere(message.mentions, {
				username
			});

			if (message.temp == null && mentionObj == null) {
				return match;
			}

			const name = this.useRealName && mentionObj && mentionObj.name;
			return `<a class="mention-link ${username === me ? 'mention-link-me background-primary-action-color' : ''}" data-username="${username}" title="${name ? username : ''}">${name || match}</a>`;
		});
	}

	replaceChannels(str, message) {
		//since apostrophe escaped contains # we need to unescape it
		return str.replace(/&#39;/g, '\'').replace(this.channelMentionRegex, (match, n1, n2) => {
			const name = n1 || n2;

			if (message.temp == null && _.findWhere(message.channels, {
				name
			}) == null) {
				return match;
			} // remove the link from inside the link and put before


			if (/^\s/.test(match)) {
				return ` <a class="mention-link" data-channel="${name}">${match.trim()}</a>`;
			}

			return `<a class="mention-link" data-channel="${name}">${match}</a>`;
		});
	}

	getUserMentions(str) {
		return str.match(this.userMentionRegex) || [];
	}

	getChannelMentions(str) {
		return (str.match(this.channelMentionRegex) || []).map(match => match.trim());
	}

	parse(message) {
		let msg = message && message.html || '';

		if (!msg.trim()) {
			return message;
		}

		msg = this.replaceUsers(msg, message, this.me);
		msg = this.replaceChannels(msg, message, this.me);
		message.html = msg;
		return message;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:mentions/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:mentions'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_mentions.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZW50aW9ucy9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om1lbnRpb25zL3NlcnZlci9NZW50aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptZW50aW9ucy9NZW50aW9ucy5qcyJdLCJuYW1lcyI6WyJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJNZW50aW9uc1NlcnZlciIsIm1lbnRpb24iLCJwYXR0ZXJuIiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiZ2V0IiwibWVzc2FnZU1heEFsbCIsImdldFVzZXJzIiwidXNlcm5hbWVzIiwiTWV0ZW9yIiwidXNlcnMiLCJmaW5kIiwidXNlcm5hbWUiLCIkaW4iLCJ1bmlxdWUiLCJmaWVsZHMiLCJfaWQiLCJmZXRjaCIsImdldENoYW5uZWwiLCJyaWQiLCJtb2RlbHMiLCJSb29tcyIsImZpbmRPbmVCeUlkIiwiZ2V0Q2hhbm5lbHMiLCJjaGFubmVscyIsIm5hbWUiLCJ0IiwiY2FsbGJhY2tzIiwiYWRkIiwibWVzc2FnZSIsImV4ZWN1dGUiLCJwcmlvcml0eSIsIkhJR0giLCJleHBvcnQiLCJNZW50aW9ucyIsImNvbnN0cnVjdG9yIiwiYXJncyIsIm0iLCJfZ2V0VXNlcnMiLCJfZ2V0Q2hhbm5lbHMiLCJfZ2V0Q2hhbm5lbCIsIl9tZXNzYWdlTWF4QWxsIiwiZ2V0VXNlcnNCeU1lbnRpb25zIiwibXNnIiwibWVudGlvbnMiLCJnZXRVc2VyTWVudGlvbnMiLCJtZW50aW9uc0FsbCIsInVzZXJNZW50aW9ucyIsImZvckVhY2giLCJ0cmltIiwic3Vic3RyIiwicHVzaCIsImFsbENoYW5uZWwiLCJsZW5ndGgiLCJnZXRDaGFubmVsYnlNZW50aW9ucyIsImdldENoYW5uZWxNZW50aW9ucyIsIm1hcCIsImMiLCJleHBvcnREZWZhdWx0IiwidXNlUmVhbE5hbWUiLCJtZSIsIl9tZSIsInAiLCJfcGF0dGVybiIsInMiLCJfdXNlUmVhbE5hbWUiLCJ1c2VyTWVudGlvblJlZ2V4IiwiUmVnRXhwIiwiY2hhbm5lbE1lbnRpb25SZWdleCIsInJlcGxhY2VVc2VycyIsInN0ciIsInJlcGxhY2UiLCJtYXRjaCIsImluY2x1ZGVzIiwibWVudGlvbk9iaiIsImZpbmRXaGVyZSIsInRlbXAiLCJyZXBsYWNlQ2hhbm5lbHMiLCJuMSIsIm4yIiwidGVzdCIsInBhcnNlIiwiaHRtbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFBd0QsSUFBSUMsY0FBSjtBQUFtQkwsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0MsbUJBQWVELENBQWY7QUFBaUI7O0FBQTdCLENBQW5DLEVBQWtFLENBQWxFO0FBR2pGLE1BQU1FLFVBQVUsSUFBSUQsY0FBSixDQUFtQjtBQUNsQ0UsVUFBUyxNQUFNQyxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3Qix1QkFBeEIsQ0FEbUI7QUFFbENDLGdCQUFlLE1BQU1ILFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLGdCQUF4QixDQUZhO0FBR2xDRSxXQUFXQyxTQUFELElBQWVDLE9BQU9DLEtBQVAsQ0FBYUMsSUFBYixDQUFrQjtBQUFFQyxZQUFVO0FBQUNDLFFBQUtuQixFQUFFb0IsTUFBRixDQUFTTixTQUFUO0FBQU47QUFBWixFQUFsQixFQUEyRDtBQUFFTyxVQUFRO0FBQUNDLFFBQUssSUFBTjtBQUFZSixhQUFVO0FBQXRCO0FBQVYsRUFBM0QsRUFBb0dLLEtBQXBHLEVBSFM7QUFJbEND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QUFLa0MsZUFBTCxDQUFxQmxDLEdBQXJCLEVBQTBCZCxPQUExQixFQUFtQyxLQUFLK0IsRUFBeEMsQ0FBTjtBQUNBL0IsVUFBUXFELElBQVIsR0FBZXZDLEdBQWY7QUFDQSxTQUFPZCxPQUFQO0FBQ0E7O0FBNUVtQixDQUxyQixFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X21lbnRpb25zLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5pbXBvcnQgTWVudGlvbnNTZXJ2ZXIgZnJvbSAnLi9NZW50aW9ucyc7XG5cbmNvbnN0IG1lbnRpb24gPSBuZXcgTWVudGlvbnNTZXJ2ZXIoe1xuXHRwYXR0ZXJuOiAoKSA9PiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnVVRGOF9OYW1lc19WYWxpZGF0aW9uJyksXG5cdG1lc3NhZ2VNYXhBbGw6ICgpID0+IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXNzYWdlX01heEFsbCcpLFxuXHRnZXRVc2VyczogKHVzZXJuYW1lcykgPT4gTWV0ZW9yLnVzZXJzLmZpbmQoeyB1c2VybmFtZTogeyRpbjogXy51bmlxdWUodXNlcm5hbWVzKX19LCB7IGZpZWxkczoge19pZDogdHJ1ZSwgdXNlcm5hbWU6IHRydWUgfX0pLmZldGNoKCksXG5cdGdldENoYW5uZWw6IChyaWQpID0+IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeUlkKHJpZCksXG5cdGdldENoYW5uZWxzOiAoY2hhbm5lbHMpID0+IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmQoeyBuYW1lOiB7JGluOiBfLnVuaXF1ZShjaGFubmVscyl9LCB0OiAnYydcdH0sIHsgZmllbGRzOiB7X2lkOiAxLCBuYW1lOiAxIH19KS5mZXRjaCgpXG59KTtcblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYmVmb3JlU2F2ZU1lc3NhZ2UnLCAobWVzc2FnZSkgPT4gbWVudGlvbi5leGVjdXRlKG1lc3NhZ2UpLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5ISUdILCAnbWVudGlvbnMnKTtcbiIsIi8qXG4qIE1lbnRpb25zIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHByb2Nlc3MgTWVudGlvbnNcbiogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSBvYmplY3RcbiovXG5pbXBvcnQgTWVudGlvbnMgZnJvbSAnLi4vTWVudGlvbnMnO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWVudGlvbnNTZXJ2ZXIgZXh0ZW5kcyBNZW50aW9ucyB7XG5cdGNvbnN0cnVjdG9yKGFyZ3MpIHtcblx0XHRzdXBlcihhcmdzKTtcblx0XHR0aGlzLm1lc3NhZ2VNYXhBbGwgPSBhcmdzLm1lc3NhZ2VNYXhBbGw7XG5cdFx0dGhpcy5nZXRDaGFubmVsID0gYXJncy5nZXRDaGFubmVsO1xuXHRcdHRoaXMuZ2V0Q2hhbm5lbHMgPSBhcmdzLmdldENoYW5uZWxzO1xuXHRcdHRoaXMuZ2V0VXNlcnMgPSBhcmdzLmdldFVzZXJzO1xuXHR9XG5cdHNldCBnZXRVc2VycyhtKSB7XG5cdFx0dGhpcy5fZ2V0VXNlcnMgPSBtO1xuXHR9XG5cdGdldCBnZXRVc2VycygpIHtcblx0XHRyZXR1cm4gdHlwZW9mIHRoaXMuX2dldFVzZXJzID09PSAnZnVuY3Rpb24nID8gdGhpcy5fZ2V0VXNlcnMgOiAoKSA9PiB0aGlzLl9nZXRVc2Vycztcblx0fVxuXHRzZXQgZ2V0Q2hhbm5lbHMobSkge1xuXHRcdHRoaXMuX2dldENoYW5uZWxzID0gbTtcblx0fVxuXHRnZXQgZ2V0Q2hhbm5lbHMoKSB7XG5cdFx0cmV0dXJuIHR5cGVvZiB0aGlzLl9nZXRDaGFubmVscyA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX2dldENoYW5uZWxzIDogKCkgPT4gdGhpcy5fZ2V0Q2hhbm5lbHM7XG5cdH1cblx0c2V0IGdldENoYW5uZWwobSkge1xuXHRcdHRoaXMuX2dldENoYW5uZWwgPSBtO1xuXHR9XG5cdGdldCBnZXRDaGFubmVsKCkge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy5fZ2V0Q2hhbm5lbCA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX2dldENoYW5uZWwgOiAoKSA9PiB0aGlzLl9nZXRDaGFubmVsO1xuXHR9XG5cdHNldCBtZXNzYWdlTWF4QWxsKG0pIHtcblx0XHR0aGlzLl9tZXNzYWdlTWF4QWxsID0gbTtcblx0fVxuXHRnZXQgbWVzc2FnZU1heEFsbCgpIHtcblx0XHRyZXR1cm4gdHlwZW9mIHRoaXMuX21lc3NhZ2VNYXhBbGwgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9tZXNzYWdlTWF4QWxsKCkgOiB0aGlzLl9tZXNzYWdlTWF4QWxsO1xuXHR9XG5cdGdldFVzZXJzQnlNZW50aW9ucyh7bXNnLCByaWR9KSB7XG5cdFx0bGV0IG1lbnRpb25zID0gdGhpcy5nZXRVc2VyTWVudGlvbnMobXNnKTtcblx0XHRjb25zdCBtZW50aW9uc0FsbCA9IFtdO1xuXHRcdGNvbnN0IHVzZXJNZW50aW9ucyA9IFtdO1xuXG5cdFx0bWVudGlvbnMuZm9yRWFjaCgobSkgPT4ge1xuXHRcdFx0Y29uc3QgbWVudGlvbiA9IG0udHJpbSgpLnN1YnN0cigxKTtcblx0XHRcdGlmIChtZW50aW9uICE9PSAnYWxsJyAmJiBtZW50aW9uICE9PSAnaGVyZScpIHtcblx0XHRcdFx0cmV0dXJuIHVzZXJNZW50aW9ucy5wdXNoKG1lbnRpb24pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG1lbnRpb24gPT09ICdhbGwnKSB7XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2VNYXhBbGwgPSB0aGlzLm1lc3NhZ2VNYXhBbGw7XG5cdFx0XHRcdGNvbnN0IGFsbENoYW5uZWwgPSB0aGlzLmdldENoYW5uZWwocmlkKTtcblx0XHRcdFx0aWYgKG1lc3NhZ2VNYXhBbGwgIT09IDAgJiYgYWxsQ2hhbm5lbC51c2VybmFtZXMubGVuZ3RoID49IG1lc3NhZ2VNYXhBbGwpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG1lbnRpb25zQWxsLnB1c2goe1xuXHRcdFx0XHRfaWQ6IG1lbnRpb24sXG5cdFx0XHRcdHVzZXJuYW1lOiBtZW50aW9uXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRtZW50aW9ucyA9IHVzZXJNZW50aW9ucy5sZW5ndGggPyB0aGlzLmdldFVzZXJzKHVzZXJNZW50aW9ucykgOiBbXTtcblx0XHRyZXR1cm4gWy4uLm1lbnRpb25zQWxsLCAuLi5tZW50aW9uc107XG5cdH1cblx0Z2V0Q2hhbm5lbGJ5TWVudGlvbnMoe21zZ30pIHtcblx0XHRjb25zdCBjaGFubmVscyA9IHRoaXMuZ2V0Q2hhbm5lbE1lbnRpb25zKG1zZyk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Q2hhbm5lbHMoY2hhbm5lbHMubWFwKGMgPT4gYy50cmltKCkuc3Vic3RyKDEpKSk7XG5cdH1cblx0ZXhlY3V0ZShtZXNzYWdlKSB7XG5cdFx0Y29uc3QgbWVudGlvbnNBbGwgPSB0aGlzLmdldFVzZXJzQnlNZW50aW9ucyhtZXNzYWdlKTtcblx0XHRjb25zdCBjaGFubmVscyA9IHRoaXMuZ2V0Q2hhbm5lbGJ5TWVudGlvbnMobWVzc2FnZSk7XG5cblx0XHRtZXNzYWdlLm1lbnRpb25zID0gbWVudGlvbnNBbGw7XG5cblx0XHRtZXNzYWdlLmNoYW5uZWxzID0gY2hhbm5lbHM7XG5cdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdH1cbn1cbiIsIi8qXG4qIE1lbnRpb25zIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHByb2Nlc3MgTWVudGlvbnNcbiogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSBvYmplY3RcbiovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcblx0Y29uc3RydWN0b3Ioe3BhdHRlcm4sIHVzZVJlYWxOYW1lLCBtZX0pIHtcblx0XHR0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuXHRcdHRoaXMudXNlUmVhbE5hbWUgPSB1c2VSZWFsTmFtZTtcblx0XHR0aGlzLm1lID0gbWU7XG5cdH1cblx0c2V0IG1lKG0pIHtcblx0XHR0aGlzLl9tZSA9IG07XG5cdH1cblx0Z2V0IG1lKCkge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy5fbWUgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9tZSgpIDogdGhpcy5fbWU7XG5cdH1cblx0c2V0IHBhdHRlcm4ocCkge1xuXHRcdHRoaXMuX3BhdHRlcm4gPSBwO1xuXHR9XG5cdGdldCBwYXR0ZXJuKCkge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy5fcGF0dGVybiA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX3BhdHRlcm4oKSA6IHRoaXMuX3BhdHRlcm47XG5cdH1cblx0c2V0IHVzZVJlYWxOYW1lKHMpIHtcblx0XHR0aGlzLl91c2VSZWFsTmFtZSA9IHM7XG5cdH1cblx0Z2V0IHVzZVJlYWxOYW1lKCkge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy5fdXNlUmVhbE5hbWUgPT09ICdmdW5jdGlvbicgPyB0aGlzLl91c2VSZWFsTmFtZSgpIDogdGhpcy5fdXNlUmVhbE5hbWU7XG5cdH1cblx0Z2V0IHVzZXJNZW50aW9uUmVnZXgoKSB7XG5cdFx0cmV0dXJuIG5ldyBSZWdFeHAoYEAoJHsgdGhpcy5wYXR0ZXJuIH0pYCwgJ2dtJyk7XG5cdH1cblx0Z2V0IGNoYW5uZWxNZW50aW9uUmVnZXgoKSB7XG5cdFx0cmV0dXJuIG5ldyBSZWdFeHAoYF4jKCR7IHRoaXMucGF0dGVybiB9KXwgIygkeyB0aGlzLnBhdHRlcm4gfSlgLCAnZ20nKTtcblx0fVxuXHRyZXBsYWNlVXNlcnMoc3RyLCBtZXNzYWdlLCBtZSkge1xuXHRcdHJldHVybiBzdHIucmVwbGFjZSh0aGlzLnVzZXJNZW50aW9uUmVnZXgsIChtYXRjaCwgdXNlcm5hbWUpID0+IHtcblx0XHRcdGlmIChbJ2FsbCcsICdoZXJlJ10uaW5jbHVkZXModXNlcm5hbWUpKSB7XG5cdFx0XHRcdHJldHVybiBgPGEgY2xhc3M9XCJtZW50aW9uLWxpbmsgbWVudGlvbi1saW5rLW1lIG1lbnRpb24tbGluay1hbGwgYmFja2dyb3VuZC1hdHRlbnRpb24tY29sb3JcIj4keyBtYXRjaCB9PC9hPmA7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1lbnRpb25PYmogPSBfLmZpbmRXaGVyZShtZXNzYWdlLm1lbnRpb25zLCB7dXNlcm5hbWV9KTtcblx0XHRcdGlmIChtZXNzYWdlLnRlbXAgPT0gbnVsbCAmJiBtZW50aW9uT2JqID09IG51bGwpIHtcblx0XHRcdFx0cmV0dXJuIG1hdGNoO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbmFtZSA9IHRoaXMudXNlUmVhbE5hbWUgJiYgbWVudGlvbk9iaiAmJiBtZW50aW9uT2JqLm5hbWU7XG5cblx0XHRcdHJldHVybiBgPGEgY2xhc3M9XCJtZW50aW9uLWxpbmsgJHsgdXNlcm5hbWUgPT09IG1lID8gJ21lbnRpb24tbGluay1tZSBiYWNrZ3JvdW5kLXByaW1hcnktYWN0aW9uLWNvbG9yJzonJyB9XCIgZGF0YS11c2VybmFtZT1cIiR7IHVzZXJuYW1lIH1cIiB0aXRsZT1cIiR7IG5hbWUgPyB1c2VybmFtZSA6ICcnIH1cIj4keyBuYW1lIHx8IG1hdGNoIH08L2E+YDtcblx0XHR9KTtcblx0fVxuXHRyZXBsYWNlQ2hhbm5lbHMoc3RyLCBtZXNzYWdlKSB7XG5cdFx0Ly9zaW5jZSBhcG9zdHJvcGhlIGVzY2FwZWQgY29udGFpbnMgIyB3ZSBuZWVkIHRvIHVuZXNjYXBlIGl0XG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlKC8mIzM5Oy9nLCAnXFwnJykucmVwbGFjZSh0aGlzLmNoYW5uZWxNZW50aW9uUmVnZXgsIChtYXRjaCwgbjEsIG4yKSA9PiB7XG5cdFx0XHRjb25zdCBuYW1lID0gbjEgfHwgbjI7XG5cdFx0XHRpZiAobWVzc2FnZS50ZW1wID09IG51bGwgJiYgXy5maW5kV2hlcmUobWVzc2FnZS5jaGFubmVscywge25hbWV9KSA9PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiBtYXRjaDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gcmVtb3ZlIHRoZSBsaW5rIGZyb20gaW5zaWRlIHRoZSBsaW5rIGFuZCBwdXQgYmVmb3JlXG5cdFx0XHRpZiAoL15cXHMvLnRlc3QobWF0Y2gpKSB7XG5cdFx0XHRcdHJldHVybiBgIDxhIGNsYXNzPVwibWVudGlvbi1saW5rXCIgZGF0YS1jaGFubmVsPVwiJHsgbmFtZSB9XCI+JHsgbWF0Y2gudHJpbSgpIH08L2E+YDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGA8YSBjbGFzcz1cIm1lbnRpb24tbGlua1wiIGRhdGEtY2hhbm5lbD1cIiR7IG5hbWUgfVwiPiR7IG1hdGNoIH08L2E+YDtcblx0XHR9KTtcblx0fVxuXHRnZXRVc2VyTWVudGlvbnMoc3RyKSB7XG5cdFx0cmV0dXJuIHN0ci5tYXRjaCh0aGlzLnVzZXJNZW50aW9uUmVnZXgpIHx8IFtdO1xuXHR9XG5cdGdldENoYW5uZWxNZW50aW9ucyhzdHIpIHtcblx0XHRyZXR1cm4gKHN0ci5tYXRjaCh0aGlzLmNoYW5uZWxNZW50aW9uUmVnZXgpIHx8IFtdKS5tYXAobWF0Y2ggPT4gbWF0Y2gudHJpbSgpKTtcblx0fVxuXHRwYXJzZShtZXNzYWdlKSB7XG5cdFx0bGV0IG1zZyA9IChtZXNzYWdlICYmIG1lc3NhZ2UuaHRtbCkgfHwgJyc7XG5cdFx0aWYgKCFtc2cudHJpbSgpKSB7XG5cdFx0XHRyZXR1cm4gbWVzc2FnZTtcblx0XHR9XG5cdFx0bXNnID0gdGhpcy5yZXBsYWNlVXNlcnMobXNnLCBtZXNzYWdlLCB0aGlzLm1lKTtcblx0XHRtc2cgPSB0aGlzLnJlcGxhY2VDaGFubmVscyhtc2csIG1lc3NhZ2UsIHRoaXMubWUpO1xuXHRcdG1lc3NhZ2UuaHRtbCA9IG1zZztcblx0XHRyZXR1cm4gbWVzc2FnZTtcblx0fVxufVxuIl19
