(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Accounts = Package['accounts-base'].Accounts;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var fieldsSetting;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:bot-helpers":{"server":{"index.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/rocketchat_bot-helpers/server/index.js                                                    //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

/**
 * BotHelpers helps bots
 * "private" properties use meteor collection cursors, so they stay reactive
 * "public" properties use getters to fetch and filter collections as array
 */class BotHelpers {
	constructor() {
		this.queries = {
			online: {
				'status': {
					$ne: 'offline'
				}
			},
			users: {
				'roles': {
					$not: {
						$all: ['bot']
					}
				}
			}
		};
	} // setup collection cursors with array of fields from setting


	setupCursors(fieldsSetting) {
		this.userFields = {};

		if (typeof fieldsSetting === 'string') {
			fieldsSetting = fieldsSetting.split(',');
		}

		fieldsSetting.forEach(n => {
			this.userFields[n.trim()] = 1;
		});
		this._allUsers = RocketChat.models.Users.find(this.queries.users, {
			fields: this.userFields
		});
		this._onlineUsers = RocketChat.models.Users.find({
			$and: [this.queries.users, this.queries.online]
		}, {
			fields: this.userFields
		});
	} // request methods or props as arguments to Meteor.call


	request(prop, ...params) {
		if (typeof this[prop] === 'undefined') {
			return null;
		} else if (typeof this[prop] === 'function') {
			return this[prop](...params);
		} else {
			return this[prop];
		}
	}

	addUserToRole(userName, roleName) {
		Meteor.call('authorization:addUserToRole', roleName, userName);
	}

	removeUserFromRole(userName, roleName) {
		Meteor.call('authorization:removeUserFromRole', roleName, userName);
	}

	addUserToRoom(userName, room) {
		const foundRoom = RocketChat.models.Rooms.findOneByIdOrName(room);

		if (!_.isObject(foundRoom)) {
			throw new Meteor.Error('invalid-channel');
		}

		const data = {};
		data.rid = foundRoom._id;
		data.username = userName;
		Meteor.call('addUserToRoom', data);
	}

	removeUserFromRoom(userName, room) {
		const foundRoom = RocketChat.models.Rooms.findOneByIdOrName(room);

		if (!_.isObject(foundRoom)) {
			throw new Meteor.Error('invalid-channel');
		}

		const data = {};
		data.rid = foundRoom._id;
		data.username = userName;
		Meteor.call('removeUserFromRoom', data);
	} // generic error whenever property access insufficient to fill request


	requestError() {
		throw new Meteor.Error('error-not-allowed', 'Bot request not allowed', {
			method: 'botRequest',
			action: 'bot_request'
		});
	} // "public" properties accessed by getters
	// allUsers / onlineUsers return whichever properties are enabled by settings


	get allUsers() {
		if (!Object.keys(this.userFields).length) {
			this.requestError();
			return false;
		} else {
			return this._allUsers.fetch();
		}
	}

	get onlineUsers() {
		if (!Object.keys(this.userFields).length) {
			this.requestError();
			return false;
		} else {
			return this._onlineUsers.fetch();
		}
	}

	get allUsernames() {
		if (!this.userFields.hasOwnProperty('username')) {
			this.requestError();
			return false;
		} else {
			return this._allUsers.fetch().map(user => user.username);
		}
	}

	get onlineUsernames() {
		if (!this.userFields.hasOwnProperty('username')) {
			this.requestError();
			return false;
		} else {
			return this._onlineUsers.fetch().map(user => user.username);
		}
	}

	get allNames() {
		if (!this.userFields.hasOwnProperty('name')) {
			this.requestError();
			return false;
		} else {
			return this._allUsers.fetch().map(user => user.name);
		}
	}

	get onlineNames() {
		if (!this.userFields.hasOwnProperty('name')) {
			this.requestError();
			return false;
		} else {
			return this._onlineUsers.fetch().map(user => user.name);
		}
	}

	get allIDs() {
		if (!this.userFields.hasOwnProperty('_id') || !this.userFields.hasOwnProperty('username')) {
			this.requestError();
			return false;
		} else {
			return this._allUsers.fetch().map(user => {
				return {
					'id': user._id,
					'name': user.username
				};
			});
		}
	}

	get onlineIDs() {
		if (!this.userFields.hasOwnProperty('_id') || !this.userFields.hasOwnProperty('username')) {
			this.requestError();
			return false;
		} else {
			return this._onlineUsers.fetch().map(user => {
				return {
					'id': user._id,
					'name': user.username
				};
			});
		}
	}

} // add class to meteor methods


const botHelpers = new BotHelpers(); // init cursors with fields setting and update on setting change

RocketChat.settings.get('BotHelpers_userFields', function (settingKey, settingValue) {
	botHelpers.setupCursors(settingValue);
});
Meteor.methods({
	botRequest: (...args) => {
		const userID = Meteor.userId();

		if (userID && RocketChat.authz.hasRole(userID, 'bot')) {
			return botHelpers.request(...args);
		} else {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'botRequest'
			});
		}
	}
});
////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                    //
// packages/rocketchat_bot-helpers/server/settings.js                                                 //
//                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                      //
Meteor.startup(function () {
	RocketChat.settings.addGroup('Bots', function () {
		this.add('BotHelpers_userFields', '_id, name, username, emails, language, utcOffset', {
			type: 'string',
			section: 'Helpers',
			i18nLabel: 'BotHelpers_userFields',
			i18nDescription: 'BotHelpers_userFields_Description'
		});
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:bot-helpers/server/index.js");
require("./node_modules/meteor/rocketchat:bot-helpers/server/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:bot-helpers'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_bot-helpers.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpib3QtaGVscGVycy9zZXJ2ZXIvaW5kZXguanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Ym90LWhlbHBlcnMvc2VydmVyL3NldHRpbmdzLmpzIl0sIm5hbWVzIjpbIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIkJvdEhlbHBlcnMiLCJjb25zdHJ1Y3RvciIsInF1ZXJpZXMiLCJvbmxpbmUiLCIkbmUiLCJ1c2VycyIsIiRub3QiLCIkYWxsIiwic2V0dXBDdXJzb3JzIiwiZmllbGRzU2V0dGluZyIsInVzZXJGaWVsZHMiLCJzcGxpdCIsImZvckVhY2giLCJuIiwidHJpbSIsIl9hbGxVc2VycyIsIlJvY2tldENoYXQiLCJtb2RlbHMiLCJVc2VycyIsImZpbmQiLCJmaWVsZHMiLCJfb25saW5lVXNlcnMiLCIkYW5kIiwicmVxdWVzdCIsInByb3AiLCJwYXJhbXMiLCJhZGRVc2VyVG9Sb2xlIiwidXNlck5hbWUiLCJyb2xlTmFtZSIsIk1ldGVvciIsImNhbGwiLCJyZW1vdmVVc2VyRnJvbVJvbGUiLCJhZGRVc2VyVG9Sb29tIiwicm9vbSIsImZvdW5kUm9vbSIsIlJvb21zIiwiZmluZE9uZUJ5SWRPck5hbWUiLCJpc09iamVjdCIsIkVycm9yIiwiZGF0YSIsInJpZCIsIl9pZCIsInVzZXJuYW1lIiwicmVtb3ZlVXNlckZyb21Sb29tIiwicmVxdWVzdEVycm9yIiwibWV0aG9kIiwiYWN0aW9uIiwiYWxsVXNlcnMiLCJPYmplY3QiLCJrZXlzIiwibGVuZ3RoIiwiZmV0Y2giLCJvbmxpbmVVc2VycyIsImFsbFVzZXJuYW1lcyIsImhhc093blByb3BlcnR5IiwibWFwIiwidXNlciIsIm9ubGluZVVzZXJuYW1lcyIsImFsbE5hbWVzIiwibmFtZSIsIm9ubGluZU5hbWVzIiwiYWxsSURzIiwib25saW5lSURzIiwiYm90SGVscGVycyIsInNldHRpbmdzIiwiZ2V0Iiwic2V0dGluZ0tleSIsInNldHRpbmdWYWx1ZSIsIm1ldGhvZHMiLCJib3RSZXF1ZXN0IiwiYXJncyIsInVzZXJJRCIsInVzZXJJZCIsImF1dGh6IiwiaGFzUm9sZSIsInN0YXJ0dXAiLCJhZGRHcm91cCIsImFkZCIsInR5cGUiLCJzZWN0aW9uIiwiaTE4bkxhYmVsIiwiaTE4bkRlc2NyaXB0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7O0FBRU47Ozs7R0FLQSxNQUFNQyxVQUFOLENBQWlCO0FBQ2hCQyxlQUFjO0FBQ2IsT0FBS0MsT0FBTCxHQUFlO0FBQ2RDLFdBQVE7QUFBRSxjQUFVO0FBQUVDLFVBQUs7QUFBUDtBQUFaLElBRE07QUFFZEMsVUFBTztBQUFFLGFBQVM7QUFBRUMsV0FBTTtBQUFFQyxZQUFNLENBQUMsS0FBRDtBQUFSO0FBQVI7QUFBWDtBQUZPLEdBQWY7QUFJQSxFQU5lLENBUWhCOzs7QUFDQUMsY0FBYUMsYUFBYixFQUE0QjtBQUMzQixPQUFLQyxVQUFMLEdBQWtCLEVBQWxCOztBQUNBLE1BQUksT0FBT0QsYUFBUCxLQUF5QixRQUE3QixFQUF1QztBQUN0Q0EsbUJBQWdCQSxjQUFjRSxLQUFkLENBQW9CLEdBQXBCLENBQWhCO0FBQ0E7O0FBQ0RGLGdCQUFjRyxPQUFkLENBQXVCQyxDQUFELElBQU87QUFDNUIsUUFBS0gsVUFBTCxDQUFnQkcsRUFBRUMsSUFBRixFQUFoQixJQUE0QixDQUE1QjtBQUNBLEdBRkQ7QUFHQSxPQUFLQyxTQUFMLEdBQWlCQyxXQUFXQyxNQUFYLENBQWtCQyxLQUFsQixDQUF3QkMsSUFBeEIsQ0FBNkIsS0FBS2pCLE9BQUwsQ0FBYUcsS0FBMUMsRUFBaUQ7QUFBRWUs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QXBCLENBQXdCLHVCQUF4QixFQUFpRCxVQUFTQyxVQUFULEVBQXFCQyxZQUFyQixFQUFtQztBQUNuRkosWUFBV3ZELFlBQVgsQ0FBd0IyRCxZQUF4QjtBQUNBLENBRkQ7QUFJQXRDLE9BQU91QyxPQUFQLENBQWU7QUFDZEMsYUFBWSxDQUFDLEdBQUdDLElBQUosS0FBYTtBQUN4QixRQUFNQyxTQUFTMUMsT0FBTzJDLE1BQVAsRUFBZjs7QUFDQSxNQUFJRCxVQUFVdkQsV0FBV3lELEtBQVgsQ0FBaUJDLE9BQWpCLENBQXlCSCxNQUF6QixFQUFpQyxLQUFqQyxDQUFkLEVBQXVEO0FBQ3RELFVBQU9SLFdBQVd4QyxPQUFYLENBQW1CLEdBQUcrQyxJQUF0QixDQUFQO0FBQ0EsR0FGRCxNQUVPO0FBQ04sU0FBTSxJQUFJekMsT0FBT1MsS0FBWCxDQUFpQixvQkFBakIsRUFBdUMsY0FBdkMsRUFBdUQ7QUFBRU8sWUFBUTtBQUFWLElBQXZELENBQU47QUFDQTtBQUNEO0FBUmEsQ0FBZixFOzs7Ozs7Ozs7OztBQzdKQWhCLE9BQU84QyxPQUFQLENBQWUsWUFBVztBQUN6QjNELFlBQVdnRCxRQUFYLENBQW9CWSxRQUFwQixDQUE2QixNQUE3QixFQUFxQyxZQUFXO0FBQy9DLE9BQUtDLEdBQUwsQ0FBUyx1QkFBVCxFQUFrQyxrREFBbEMsRUFBc0Y7QUFDckZDLFNBQU0sUUFEK0U7QUFFckZDLFlBQVMsU0FGNEU7QUFHckZDLGNBQVcsdUJBSDBFO0FBSXJGQyxvQkFBaUI7QUFKb0UsR0FBdEY7QUFNQSxFQVBEO0FBUUEsQ0FURCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2JvdC1oZWxwZXJzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbi8qKlxuICogQm90SGVscGVycyBoZWxwcyBib3RzXG4gKiBcInByaXZhdGVcIiBwcm9wZXJ0aWVzIHVzZSBtZXRlb3IgY29sbGVjdGlvbiBjdXJzb3JzLCBzbyB0aGV5IHN0YXkgcmVhY3RpdmVcbiAqIFwicHVibGljXCIgcHJvcGVydGllcyB1c2UgZ2V0dGVycyB0byBmZXRjaCBhbmQgZmlsdGVyIGNvbGxlY3Rpb25zIGFzIGFycmF5XG4gKi9cbmNsYXNzIEJvdEhlbHBlcnMge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLnF1ZXJpZXMgPSB7XG5cdFx0XHRvbmxpbmU6IHsgJ3N0YXR1cyc6IHsgJG5lOiAnb2ZmbGluZScgfSB9LFxuXHRcdFx0dXNlcnM6IHsgJ3JvbGVzJzogeyAkbm90OiB7ICRhbGw6IFsnYm90J10gfSB9IH1cblx0XHR9O1xuXHR9XG5cblx0Ly8gc2V0dXAgY29sbGVjdGlvbiBjdXJzb3JzIHdpdGggYXJyYXkgb2YgZmllbGRzIGZyb20gc2V0dGluZ1xuXHRzZXR1cEN1cnNvcnMoZmllbGRzU2V0dGluZykge1xuXHRcdHRoaXMudXNlckZpZWxkcyA9IHt9O1xuXHRcdGlmICh0eXBlb2YgZmllbGRzU2V0dGluZyA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGZpZWxkc1NldHRpbmcgPSBmaWVsZHNTZXR0aW5nLnNwbGl0KCcsJyk7XG5cdFx0fVxuXHRcdGZpZWxkc1NldHRpbmcuZm9yRWFjaCgobikgPT4ge1xuXHRcdFx0dGhpcy51c2VyRmllbGRzW24udHJpbSgpXSA9IDE7XG5cdFx0fSk7XG5cdFx0dGhpcy5fYWxsVXNlcnMgPSBSb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5maW5kKHRoaXMucXVlcmllcy51c2VycywgeyBmaWVsZHM6IHRoaXMudXNlckZpZWxkcyB9KTtcblx0XHR0aGlzLl9vbmxpbmVVc2VycyA9IFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmQoeyAkYW5kOiBbdGhpcy5xdWVyaWVzLnVzZXJzLCB0aGlzLnF1ZXJpZXMub25saW5lXSB9LCB7IGZpZWxkczogdGhpcy51c2VyRmllbGRzIH0pO1xuXHR9XG5cblx0Ly8gcmVxdWVzdCBtZXRob2RzIG9yIHByb3BzIGFzIGFyZ3VtZW50cyB0byBNZXRlb3IuY2FsbFxuXHRyZXF1ZXN0KHByb3AsIC4uLnBhcmFtcykge1xuXHRcdGlmICh0eXBlb2YgdGhpc1twcm9wXSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHRoaXNbcHJvcF0gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiB0aGlzW3Byb3BdKC4uLnBhcmFtcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzW3Byb3BdO1xuXHRcdH1cblx0fVxuXG5cdGFkZFVzZXJUb1JvbGUodXNlck5hbWUsIHJvbGVOYW1lKSB7XG5cdFx0TWV0ZW9yLmNhbGwoJ2F1dGhvcml6YXRpb246YWRkVXNlclRvUm9sZScsIHJvbGVOYW1lLCB1c2VyTmFtZSk7XG5cdH1cblxuXHRyZW1vdmVVc2VyRnJvbVJvbGUodXNlck5hbWUsIHJvbGVOYW1lKSB7XG5cdFx0TWV0ZW9yLmNhbGwoJ2F1dGhvcml6YXRpb246cmVtb3ZlVXNlckZyb21Sb2xlJywgcm9sZU5hbWUsIHVzZXJOYW1lKTtcblx0fVxuXG5cdGFkZFVzZXJUb1Jvb20odXNlck5hbWUsIHJvb20pIHtcblx0XHRjb25zdCBmb3VuZFJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZE9yTmFtZShyb29tKTtcblxuXHRcdGlmICghXy5pc09iamVjdChmb3VuZFJvb20pKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWNoYW5uZWwnKTtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0ge307XG5cdFx0ZGF0YS5yaWQgPSBmb3VuZFJvb20uX2lkO1xuXHRcdGRhdGEudXNlcm5hbWUgPSB1c2VyTmFtZTtcblx0XHRNZXRlb3IuY2FsbCgnYWRkVXNlclRvUm9vbScsIGRhdGEpO1xuXHR9XG5cblx0cmVtb3ZlVXNlckZyb21Sb29tKHVzZXJOYW1lLCByb29tKSB7XG5cdFx0Y29uc3QgZm91bmRSb29tID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZE9uZUJ5SWRPck5hbWUocm9vbSk7XG5cblx0XHRpZiAoIV8uaXNPYmplY3QoZm91bmRSb29tKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1jaGFubmVsJyk7XG5cdFx0fVxuXHRcdGNvbnN0IGRhdGEgPSB7fTtcblx0XHRkYXRhLnJpZCA9IGZvdW5kUm9vbS5faWQ7XG5cdFx0ZGF0YS51c2VybmFtZSA9IHVzZXJOYW1lO1xuXHRcdE1ldGVvci5jYWxsKCdyZW1vdmVVc2VyRnJvbVJvb20nLCBkYXRhKTtcblx0fVxuXG5cdC8vIGdlbmVyaWMgZXJyb3Igd2hlbmV2ZXIgcHJvcGVydHkgYWNjZXNzIGluc3VmZmljaWVudCB0byBmaWxsIHJlcXVlc3Rcblx0cmVxdWVzdEVycm9yKCkge1xuXHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLW5vdC1hbGxvd2VkJywgJ0JvdCByZXF1ZXN0IG5vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdib3RSZXF1ZXN0JywgYWN0aW9uOiAnYm90X3JlcXVlc3QnIH0pO1xuXHR9XG5cblx0Ly8gXCJwdWJsaWNcIiBwcm9wZXJ0aWVzIGFjY2Vzc2VkIGJ5IGdldHRlcnNcblx0Ly8gYWxsVXNlcnMgLyBvbmxpbmVVc2VycyByZXR1cm4gd2hpY2hldmVyIHByb3BlcnRpZXMgYXJlIGVuYWJsZWQgYnkgc2V0dGluZ3Ncblx0Z2V0IGFsbFVzZXJzKCkge1xuXHRcdGlmICghT2JqZWN0LmtleXModGhpcy51c2VyRmllbGRzKS5sZW5ndGgpIHtcblx0XHRcdHRoaXMucmVxdWVzdEVycm9yKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxVc2Vycy5mZXRjaCgpO1xuXHRcdH1cblx0fVxuXHRnZXQgb25saW5lVXNlcnMoKSB7XG5cdFx0aWYgKCFPYmplY3Qua2V5cyh0aGlzLnVzZXJGaWVsZHMpLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5yZXF1ZXN0RXJyb3IoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX29ubGluZVVzZXJzLmZldGNoKCk7XG5cdFx0fVxuXHR9XG5cdGdldCBhbGxVc2VybmFtZXMoKSB7XG5cdFx0aWYgKCF0aGlzLnVzZXJGaWVsZHMuaGFzT3duUHJvcGVydHkoJ3VzZXJuYW1lJykpIHtcblx0XHRcdHRoaXMucmVxdWVzdEVycm9yKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxVc2Vycy5mZXRjaCgpLm1hcCgodXNlcikgPT4gdXNlci51c2VybmFtZSk7XG5cdFx0fVxuXHR9XG5cdGdldCBvbmxpbmVVc2VybmFtZXMoKSB7XG5cdFx0aWYgKCF0aGlzLnVzZXJGaWVsZHMuaGFzT3duUHJvcGVydHkoJ3VzZXJuYW1lJykpIHtcblx0XHRcdHRoaXMucmVxdWVzdEVycm9yKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9vbmxpbmVVc2Vycy5mZXRjaCgpLm1hcCgodXNlcikgPT4gdXNlci51c2VybmFtZSk7XG5cdFx0fVxuXHR9XG5cdGdldCBhbGxOYW1lcygpIHtcblx0XHRpZiAoIXRoaXMudXNlckZpZWxkcy5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG5cdFx0XHR0aGlzLnJlcXVlc3RFcnJvcigpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsVXNlcnMuZmV0Y2goKS5tYXAoKHVzZXIpID0+IHVzZXIubmFtZSk7XG5cdFx0fVxuXHR9XG5cdGdldCBvbmxpbmVOYW1lcygpIHtcblx0XHRpZiAoIXRoaXMudXNlckZpZWxkcy5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG5cdFx0XHR0aGlzLnJlcXVlc3RFcnJvcigpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fb25saW5lVXNlcnMuZmV0Y2goKS5tYXAoKHVzZXIpID0+IHVzZXIubmFtZSk7XG5cdFx0fVxuXHR9XG5cdGdldCBhbGxJRHMoKSB7XG5cdFx0aWYgKCF0aGlzLnVzZXJGaWVsZHMuaGFzT3duUHJvcGVydHkoJ19pZCcpIHx8ICF0aGlzLnVzZXJGaWVsZHMuaGFzT3duUHJvcGVydHkoJ3VzZXJuYW1lJykpIHtcblx0XHRcdHRoaXMucmVxdWVzdEVycm9yKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxVc2Vycy5mZXRjaCgpLm1hcCgodXNlcikgPT4ge1xuXHRcdFx0XHRyZXR1cm4geyAnaWQnOiB1c2VyLl9pZCwgJ25hbWUnOiB1c2VyLnVzZXJuYW1lIH07XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblx0Z2V0IG9ubGluZUlEcygpIHtcblx0XHRpZiAoIXRoaXMudXNlckZpZWxkcy5oYXNPd25Qcm9wZXJ0eSgnX2lkJykgfHwgIXRoaXMudXNlckZpZWxkcy5oYXNPd25Qcm9wZXJ0eSgndXNlcm5hbWUnKSkge1xuXHRcdFx0dGhpcy5yZXF1ZXN0RXJyb3IoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX29ubGluZVVzZXJzLmZldGNoKCkubWFwKCh1c2VyKSA9PiB7XG5cdFx0XHRcdHJldHVybiB7ICdpZCc6IHVzZXIuX2lkLCAnbmFtZSc6IHVzZXIudXNlcm5hbWUgfTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG4vLyBhZGQgY2xhc3MgdG8gbWV0ZW9yIG1ldGhvZHNcbmNvbnN0IGJvdEhlbHBlcnMgPSBuZXcgQm90SGVscGVycygpO1xuXG4vLyBpbml0IGN1cnNvcnMgd2l0aCBmaWVsZHMgc2V0dGluZyBhbmQgdXBkYXRlIG9uIHNldHRpbmcgY2hhbmdlXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQm90SGVscGVyc191c2VyRmllbGRzJywgZnVuY3Rpb24oc2V0dGluZ0tleSwgc2V0dGluZ1ZhbHVlKSB7XG5cdGJvdEhlbHBlcnMuc2V0dXBDdXJzb3JzKHNldHRpbmdWYWx1ZSk7XG59KTtcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHRib3RSZXF1ZXN0OiAoLi4uYXJncykgPT4ge1xuXHRcdGNvbnN0IHVzZXJJRCA9IE1ldGVvci51c2VySWQoKTtcblx0XHRpZiAodXNlcklEICYmIFJvY2tldENoYXQuYXV0aHouaGFzUm9sZSh1c2VySUQsICdib3QnKSkge1xuXHRcdFx0cmV0dXJuIGJvdEhlbHBlcnMucmVxdWVzdCguLi5hcmdzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnYm90UmVxdWVzdCcgfSk7XG5cdFx0fVxuXHR9XG59KTtcbiIsIk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdCb3RzJywgZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5hZGQoJ0JvdEhlbHBlcnNfdXNlckZpZWxkcycsICdfaWQsIG5hbWUsIHVzZXJuYW1lLCBlbWFpbHMsIGxhbmd1YWdlLCB1dGNPZmZzZXQnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdHNlY3Rpb246ICdIZWxwZXJzJyxcblx0XHRcdGkxOG5MYWJlbDogJ0JvdEhlbHBlcnNfdXNlckZpZWxkcycsXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdCb3RIZWxwZXJzX3VzZXJGaWVsZHNfRGVzY3JpcHRpb24nXG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXX0=
