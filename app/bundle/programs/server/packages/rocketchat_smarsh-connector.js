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

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:smarsh-connector":{"lib":{"rocketchat.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_smarsh-connector/lib/rocketchat.js                                                         //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
RocketChat.smarsh = {};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"settings.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_smarsh-connector/server/settings.js                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 0);
module.watch(require("moment-timezone"));
RocketChat.settings.addGroup('Smarsh', function addSettings() {
	this.add('Smarsh_Enabled', false, {
		type: 'boolean',
		i18nLabel: 'Smarsh_Enabled',
		enableQuery: {
			_id: 'From_Email',
			value: {
				$exists: 1,
				$ne: ''
			}
		}
	});
	this.add('Smarsh_Email', '', {
		type: 'string',
		i18nLabel: 'Smarsh_Email',
		placeholder: 'email@domain.com'
	});
	this.add('Smarsh_MissingEmail_Email', 'no-email@example.com', {
		type: 'string',
		i18nLabel: 'Smarsh_MissingEmail_Email',
		placeholder: 'no-email@example.com'
	});
	const zoneValues = moment.tz.names().map(function _timeZonesToSettings(name) {
		return {
			key: name,
			i18nLabel: name
		};
	});
	this.add('Smarsh_Timezone', 'America/Los_Angeles', {
		type: 'select',
		values: zoneValues
	});
	this.add('Smarsh_Interval', 'every_30_minutes', {
		type: 'select',
		values: [{
			key: 'every_30_seconds',
			i18nLabel: 'every_30_seconds'
		}, {
			key: 'every_30_minutes',
			i18nLabel: 'every_30_minutes'
		}, {
			key: 'every_1_hours',
			i18nLabel: 'every_hour'
		}, {
			key: 'every_6_hours',
			i18nLabel: 'every_six_hours'
		}],
		enableQuery: {
			_id: 'From_Email',
			value: {
				$exists: 1,
				$ne: ''
			}
		}
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"models":{"SmarshHistory.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_smarsh-connector/server/models/SmarshHistory.js                                            //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
RocketChat.smarsh.History = new class extends RocketChat.models._Base {
	constructor() {
		super('smarsh_history');
	}

}();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"functions":{"sendEmail.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_smarsh-connector/server/functions/sendEmail.js                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

RocketChat.smarsh.sendEmail = data => {
	const attachments = [];

	if (data.files.length > 0) {
		_.each(data.files, fileId => {
			const file = RocketChat.models.Uploads.findOneById(fileId);

			if (file.store === 'rocketchat_uploads' || file.store === 'fileSystem') {
				const rs = UploadFS.getStore(file.store).getReadStream(fileId, file);
				attachments.push({
					filename: file.name,
					streamSource: rs
				});
			}
		});
	}

	Email.send({
		to: RocketChat.settings.get('Smarsh_Email'),
		from: RocketChat.settings.get('From_Email'),
		subject: data.subject,
		html: data.body,
		attachments
	});
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"generateEml.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_smarsh-connector/server/functions/generateEml.js                                           //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let moment;
module.watch(require("moment"), {
	default(v) {
		moment = v;
	}

}, 1);
module.watch(require("moment-timezone"));
const start = '<table style="width: 100%; border: 1px solid; border-collapse: collapse; table-layout: fixed; margin-top: 10px; font-size: 12px; word-break: break-word;"><tbody>';
const end = '</tbody></table>';
const opentr = '<tr style="border: 1px solid;">';
const closetr = '</tr>';
const open20td = '<td style="border: 1px solid; text-align: center; width: 20%;">';
const open60td = '<td style="border: 1px solid; text-align: left; width: 60%; padding: 0 5px;">';
const closetd = '</td>';

function _getLink(attachment) {
	const url = attachment.title_link.replace(/ /g, '%20');

	if (Meteor.settings.public.sandstorm || url.match(/^(https?:)?\/\//i)) {
		return url;
	} else {
		return Meteor.absoluteUrl().replace(/\/$/, '') + __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + url;
	}
}

RocketChat.smarsh.generateEml = () => {
	Meteor.defer(() => {
		const smarshMissingEmail = RocketChat.settings.get('Smarsh_MissingEmail_Email');
		const timeZone = RocketChat.settings.get('Smarsh_Timezone');
		RocketChat.models.Rooms.find().forEach(room => {
			const smarshHistory = RocketChat.smarsh.History.findOne({
				_id: room._id
			});
			const query = {
				rid: room._id
			};

			if (smarshHistory) {
				query.ts = {
					$gt: smarshHistory.lastRan
				};
			}

			const date = new Date();
			const rows = [];
			const data = {
				users: [],
				msgs: 0,
				files: [],
				time: smarshHistory ? moment(date).diff(moment(smarshHistory.lastRan), 'minutes') : moment(date).diff(moment(room.ts), 'minutes'),
				room: room.name ? `#${room.name}` : `Direct Message Between: ${room.usernames.join(' & ')}`
			};
			RocketChat.models.Messages.find(query).forEach(message => {
				rows.push(opentr); //The timestamp

				rows.push(open20td);
				rows.push(moment(message.ts).tz(timeZone).format('YYYY-MM-DD HH-mm-ss z'));
				rows.push(closetd); //The sender

				rows.push(open20td);
				const sender = RocketChat.models.Users.findOne({
					_id: message.u._id
				});

				if (data.users.indexOf(sender._id) === -1) {
					data.users.push(sender._id);
				} //Get the user's email, can be nothing if it is an unconfigured bot account (like rocket.cat)


				if (sender.emails && sender.emails[0] && sender.emails[0].address) {
					rows.push(`${sender.name} &lt;${sender.emails[0].address}&gt;`);
				} else {
					rows.push(`${sender.name} &lt;${smarshMissingEmail}&gt;`);
				}

				rows.push(closetd); //The message

				rows.push(open60td);
				data.msgs++;

				if (message.t) {
					const messageType = RocketChat.MessageTypes.getType(message);

					if (messageType) {
						rows.push(TAPi18n.__(messageType.message, messageType.data ? messageType.data(message) : '', 'en'));
					} else {
						rows.push(`${message.msg} (${message.t})`);
					}
				} else if (message.file) {
					data.files.push(message.file._id);
					rows.push(`${message.attachments[0].title} (${_getLink(message.attachments[0])})`);
				} else if (message.attachments) {
					const attaches = [];

					_.each(message.attachments, function _loopThroughMessageAttachments(a) {
						if (a.image_url) {
							attaches.push(a.image_url);
						} //TODO: Verify other type of attachments which need to be handled that aren't file uploads and image urls
						// } else {
						// 	console.log(a);
						// }

					});

					rows.push(`${message.msg} (${attaches.join(', ')})`);
				} else {
					rows.push(message.msg);
				}

				rows.push(closetd);
				rows.push(closetr);
			});

			if (rows.length !== 0) {
				const result = start + rows.join('') + end;
				RocketChat.smarsh.History.upsert({
					_id: room._id
				}, {
					_id: room._id,
					lastRan: date,
					lastResult: result
				});
				RocketChat.smarsh.sendEmail({
					body: result,
					subject: `Rocket.Chat, ${data.users.length} Users, ${data.msgs} Messages, ${data.files.length} Files, ${data.time} Minutes, in ${data.room}`,
					files: data.files
				});
			}
		});
	});
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_smarsh-connector/server/startup.js                                                         //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
const smarshJobName = 'Smarsh EML Connector';

const _addSmarshSyncedCronJob = _.debounce(Meteor.bindEnvironment(function __addSmarshSyncedCronJobDebounced() {
	if (SyncedCron.nextScheduledAtDate(smarshJobName)) {
		SyncedCron.remove(smarshJobName);
	}

	if (RocketChat.settings.get('Smarsh_Enabled') && RocketChat.settings.get('Smarsh_Email') !== '' && RocketChat.settings.get('From_Email') !== '') {
		SyncedCron.add({
			name: smarshJobName,
			schedule: parser => parser.text(RocketChat.settings.get('Smarsh_Interval').replace(/_/g, ' ')),
			job: RocketChat.smarsh.generateEml
		});
	}
}), 500);

Meteor.startup(() => {
	Meteor.defer(() => {
		_addSmarshSyncedCronJob();

		RocketChat.settings.get('Smarsh_Interval', _addSmarshSyncedCronJob);
		RocketChat.settings.get('Smarsh_Enabled', _addSmarshSyncedCronJob);
		RocketChat.settings.get('Smarsh_Email', _addSmarshSyncedCronJob);
		RocketChat.settings.get('From_Email', _addSmarshSyncedCronJob);
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:smarsh-connector/lib/rocketchat.js");
require("./node_modules/meteor/rocketchat:smarsh-connector/server/settings.js");
require("./node_modules/meteor/rocketchat:smarsh-connector/server/models/SmarshHistory.js");
require("./node_modules/meteor/rocketchat:smarsh-connector/server/functions/sendEmail.js");
require("./node_modules/meteor/rocketchat:smarsh-connector/server/functions/generateEml.js");
require("./node_modules/meteor/rocketchat:smarsh-connector/server/startup.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:smarsh-connector'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_smarsh-connector.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzbWFyc2gtY29ubmVjdG9yL2xpYi9yb2NrZXRjaGF0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnNtYXJzaC1jb25uZWN0b3Ivc2VydmVyL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnNtYXJzaC1jb25uZWN0b3Ivc2VydmVyL21vZGVscy9TbWFyc2hIaXN0b3J5LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnNtYXJzaC1jb25uZWN0b3Ivc2VydmVyL2Z1bmN0aW9ucy9zZW5kRW1haWwuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c21hcnNoLWNvbm5lY3Rvci9zZXJ2ZXIvZnVuY3Rpb25zL2dlbmVyYXRlRW1sLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnNtYXJzaC1jb25uZWN0b3Ivc2VydmVyL3N0YXJ0dXAuanMiXSwibmFtZXMiOlsiUm9ja2V0Q2hhdCIsInNtYXJzaCIsIm1vbWVudCIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2Iiwic2V0dGluZ3MiLCJhZGRHcm91cCIsImFkZFNldHRpbmdzIiwiYWRkIiwidHlwZSIsImkxOG5MYWJlbCIsImVuYWJsZVF1ZXJ5IiwiX2lkIiwidmFsdWUiLCIkZXhpc3RzIiwiJG5lIiwicGxhY2Vob2xkZXIiLCJ6b25lVmFsdWVzIiwidHoiLCJuYW1lcyIsIm1hcCIsIl90aW1lWm9uZXNUb1NldHRpbmdzIiwibmFtZSIsImtleSIsInZhbHVlcyIsIkhpc3RvcnkiLCJtb2RlbHMiLCJfQmFzZSIsImNvbnN0cnVjdG9yIiwiXyIsInNlbmRFbWFpbCIsImRhdGEiLCJhdHRhY2htZW50cyIsImZpbGVzIiwibGVuZ3RoIiwiZWFjaCIsImZpbGVJZCIsImZpbGUiLCJVcGxvYWRzIiwiZmluZE9uZUJ5SWQiLCJzdG9yZSIsInJzIiwiVXBsb2FkRlMiLCJnZXRTdG9yZSIsImdldFJlYWRTdHJlYW0iLCJwdXNoIiwiZmlsZW5hbWUiLCJzdHJlYW1Tb3VyY2UiLCJFbWFpbCIsInNlbmQiLCJ0byIsImdldCIsImZyb20iLCJzdWJqZWN0IiwiaHRtbCIsImJvZHkiLCJzdGFydCIsImVuZCIsIm9wZW50ciIsImNsb3NldHIiLCJvcGVuMjB0ZCIsIm9wZW42MHRkIiwiY2xvc2V0ZCIsIl9nZXRMaW5rIiwiYXR0YWNobWVudCIsInVybCIsInRpdGxlX2xpbmsiLCJyZXBsYWNlIiwiTWV0ZW9yIiwicHVibGljIiwic2FuZHN0b3JtIiwibWF0Y2giLCJhYnNvbHV0ZVVybCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsImdlbmVyYXRlRW1sIiwiZGVmZXIiLCJzbWFyc2hNaXNzaW5nRW1haWwiLCJ0aW1lWm9uZSIsIlJvb21zIiwiZmluZCIsImZvckVhY2giLCJyb29tIiwic21hcnNoSGlzdG9yeSIsImZpbmRPbmUiLCJxdWVyeSIsInJpZCIsInRzIiwiJGd0IiwibGFzdFJhbiIsImRhdGUiLCJEYXRlIiwicm93cyIsInVzZXJzIiwibXNncyIsInRpbWUiLCJkaWZmIiwidXNlcm5hbWVzIiwiam9pbiIsIk1lc3NhZ2VzIiwibWVzc2FnZSIsImZvcm1hdCIsInNlbmRlciIsIlVzZXJzIiwidSIsImluZGV4T2YiLCJlbWFpbHMiLCJhZGRyZXNzIiwidCIsIm1lc3NhZ2VUeXBlIiwiTWVzc2FnZVR5cGVzIiwiZ2V0VHlwZSIsIlRBUGkxOG4iLCJfXyIsIm1zZyIsInRpdGxlIiwiYXR0YWNoZXMiLCJfbG9vcFRocm91Z2hNZXNzYWdlQXR0YWNobWVudHMiLCJhIiwiaW1hZ2VfdXJsIiwicmVzdWx0IiwidXBzZXJ0IiwibGFzdFJlc3VsdCIsInNtYXJzaEpvYk5hbWUiLCJfYWRkU21hcnNoU3luY2VkQ3JvbkpvYiIsImRlYm91bmNlIiwiYmluZEVudmlyb25tZW50IiwiX19hZGRTbWFyc2hTeW5jZWRDcm9uSm9iRGVib3VuY2VkIiwiU3luY2VkQ3JvbiIsIm5leHRTY2hlZHVsZWRBdERhdGUiLCJyZW1vdmUiLCJzY2hlZHVsZSIsInBhcnNlciIsInRleHQiLCJqb2IiLCJzdGFydHVwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLFdBQVdDLE1BQVgsR0FBb0IsRUFBcEIsQzs7Ozs7Ozs7Ozs7QUNBQSxJQUFJQyxNQUFKO0FBQVdDLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxRQUFSLENBQWIsRUFBK0I7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLFdBQU9LLENBQVA7QUFBUzs7QUFBckIsQ0FBL0IsRUFBc0QsQ0FBdEQ7QUFBeURKLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxpQkFBUixDQUFiO0FBR3BFTCxXQUFXUSxRQUFYLENBQW9CQyxRQUFwQixDQUE2QixRQUE3QixFQUF1QyxTQUFTQyxXQUFULEdBQXVCO0FBQzdELE1BQUtDLEdBQUwsQ0FBUyxnQkFBVCxFQUEyQixLQUEzQixFQUFrQztBQUNqQ0MsUUFBTSxTQUQyQjtBQUVqQ0MsYUFBVyxnQkFGc0I7QUFHakNDLGVBQWE7QUFDWkMsUUFBSyxZQURPO0FBRVpDLFVBQU87QUFDTkMsYUFBUyxDQURIO0FBRU5DLFNBQUs7QUFGQztBQUZLO0FBSG9CLEVBQWxDO0FBV0EsTUFBS1AsR0FBTCxDQUFTLGNBQVQsRUFBeUIsRUFBekIsRUFBNkI7QUFDNUJDLFFBQU0sUUFEc0I7QUFFNUJDLGFBQVcsY0FGaUI7QUFHNUJNLGVBQWE7QUFIZSxFQUE3QjtBQUtBLE1BQUtSLEdBQUwsQ0FBUywyQkFBVCxFQUFzQyxzQkFBdEMsRUFBOEQ7QUFDN0RDLFFBQU0sUUFEdUQ7QUFFN0RDLGFBQVcsMkJBRmtEO0FBRzdETSxlQUFhO0FBSGdELEVBQTlEO0FBTUEsT0FBTUMsYUFBYWxCLE9BQU9tQixFQUFQLENBQVVDLEtBQVYsR0FBa0JDLEdBQWxCLENBQXNCLFNBQVNDLG9CQUFULENBQThCQyxJQUE5QixFQUFvQztBQUM1RSxTQUFPO0FBQ05DLFFBQUtELElBREM7QUFFTlosY0FBV1k7QUFGTCxHQUFQO0FBSUEsRUFMa0IsQ0FBbkI7QUFNQSxNQUFLZCxHQUFMLENBQVMsaUJBQVQsRUFBNEIscUJBQTVCLEVBQW1EO0FBQ2xEQyxRQUFNLFFBRDRDO0FBRWxEZSxVQUFRUDtBQUYwQyxFQUFuRDtBQUtBLE1BQUtULEdBQUwsQ0FBUyxpQkFBVCxFQUE0QixrQkFBNUIsRUFBZ0Q7QUFDL0NDLFFBQU0sUUFEeUM7QUFFL0NlLFVBQVEsQ0FBQztBQUNSRCxRQUFLLGtCQURHO0FBRVJiLGNBQVc7QUFGSCxHQUFELEVBR0w7QUFDRmEsUUFBSyxrQkFESDtBQUVGYixjQUFXO0FBRlQsR0FISyxFQU1MO0FBQ0ZhLFFBQUssZUFESDtBQUVGYixjQUFXO0FBRlQsR0FOSyxFQVNMO0FBQ0ZhLFFBQUssZUFESDtBQUVGYixjQUFXO0FBRlQsR0FUSyxDQUZ1QztBQWUvQ0MsZUFBYTtBQUNaQyxRQUFLLFlBRE87QUFFWkMsVUFBTztBQUNOQyxhQUFTLENBREg7QUFFTkMsU0FBSztBQUZDO0FBRks7QUFma0MsRUFBaEQ7QUF1QkEsQ0F6REQsRTs7Ozs7Ozs7Ozs7QUNIQWxCLFdBQVdDLE1BQVgsQ0FBa0IyQixPQUFsQixHQUE0QixJQUFJLGNBQWM1QixXQUFXNkIsTUFBWCxDQUFrQkMsS0FBaEMsQ0FBc0M7QUFDckVDLGVBQWM7QUFDYixRQUFNLGdCQUFOO0FBQ0E7O0FBSG9FLENBQTFDLEVBQTVCLEM7Ozs7Ozs7Ozs7O0FDQUEsSUFBSUMsQ0FBSjs7QUFBTTdCLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUN5QixNQUFFekIsQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDs7QUFVTlAsV0FBV0MsTUFBWCxDQUFrQmdDLFNBQWxCLEdBQStCQyxJQUFELElBQVU7QUFDdkMsT0FBTUMsY0FBYyxFQUFwQjs7QUFFQSxLQUFJRCxLQUFLRSxLQUFMLENBQVdDLE1BQVgsR0FBb0IsQ0FBeEIsRUFBMkI7QUFDMUJMLElBQUVNLElBQUYsQ0FBT0osS0FBS0UsS0FBWixFQUFvQkcsTUFBRCxJQUFZO0FBQzlCLFNBQU1DLE9BQU94QyxXQUFXNkIsTUFBWCxDQUFrQlksT0FBbEIsQ0FBMEJDLFdBQTFCLENBQXNDSCxNQUF0QyxDQUFiOztBQUNBLE9BQUlDLEtBQUtHLEtBQUwsS0FBZSxvQkFBZixJQUF1Q0gsS0FBS0csS0FBTCxLQUFlLFlBQTFELEVBQXdFO0FBQ3ZFLFVBQU1DLEtBQUtDLFNBQVNDLFFBQVQsQ0FBa0JOLEtBQUtHLEtBQXZCLEVBQThCSSxhQUE5QixDQUE0Q1IsTUFBNUMsRUFBb0RDLElBQXBELENBQVg7QUFDQUwsZ0JBQVlhLElBQVosQ0FBaUI7QUFDaEJDLGVBQVVULEtBQUtmLElBREM7QUFFaEJ5QixtQkFBY047QUFGRSxLQUFqQjtBQUlBO0FBQ0QsR0FURDtBQVVBOztBQUVETyxPQUFNQyxJQUFOLENBQVc7QUFDVkMsTUFBSXJELFdBQVdRLFFBQVgsQ0FBb0I4QyxHQUFwQixDQUF3QixjQUF4QixDQURNO0FBRVZDLFFBQU12RCxXQUFXUSxRQUFYLENBQW9COEMsR0FBcEIsQ0FBd0IsWUFBeEIsQ0FGSTtBQUdWRSxXQUFTdEIsS0FBS3NCLE9BSEo7QUFJVkMsUUFBTXZCLEtBQUt3QixJQUpEO0FBS1Z2QjtBQUxVLEVBQVg7QUFPQSxDQXZCRCxDOzs7Ozs7Ozs7OztBQ1ZBLElBQUlILENBQUo7O0FBQU03QixPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDeUIsTUFBRXpCLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFBd0QsSUFBSUwsTUFBSjtBQUFXQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsUUFBUixDQUFiLEVBQStCO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxXQUFPSyxDQUFQO0FBQVM7O0FBQXJCLENBQS9CLEVBQXNELENBQXREO0FBQXlESixPQUFPQyxLQUFQLENBQWFDLFFBQVEsaUJBQVIsQ0FBYjtBQUlsSSxNQUFNc0QsUUFBUSxtS0FBZDtBQUNBLE1BQU1DLE1BQU0sa0JBQVo7QUFDQSxNQUFNQyxTQUFTLGlDQUFmO0FBQ0EsTUFBTUMsVUFBVSxPQUFoQjtBQUNBLE1BQU1DLFdBQVcsaUVBQWpCO0FBQ0EsTUFBTUMsV0FBVywrRUFBakI7QUFDQSxNQUFNQyxVQUFVLE9BQWhCOztBQUVBLFNBQVNDLFFBQVQsQ0FBa0JDLFVBQWxCLEVBQThCO0FBQzdCLE9BQU1DLE1BQU1ELFdBQVdFLFVBQVgsQ0FBc0JDLE9BQXRCLENBQThCLElBQTlCLEVBQW9DLEtBQXBDLENBQVo7O0FBRUEsS0FBSUMsT0FBTy9ELFFBQVAsQ0FBZ0JnRSxNQUFoQixDQUF1QkMsU0FBdkIsSUFBb0NMLElBQUlNLEtBQUosQ0FBVSxrQkFBVixDQUF4QyxFQUF1RTtBQUN0RSxTQUFPTixHQUFQO0FBQ0EsRUFGRCxNQUVPO0FBQ04sU0FBT0csT0FBT0ksV0FBUCxHQUFxQkwsT0FBckIsQ0FBNkIsS0FBN0IsRUFBb0MsRUFBcEMsSUFBMENNLDBCQUEwQkMsb0JBQXBFLEdBQTJGVCxHQUFsRztBQUNBO0FBQ0Q7O0FBRURwRSxXQUFXQyxNQUFYLENBQWtCNkUsV0FBbEIsR0FBZ0MsTUFBTTtBQUNyQ1AsUUFBT1EsS0FBUCxDQUFhLE1BQU07QUFDbEIsUUFBTUMscUJBQXFCaEYsV0FBV1EsUUFBWCxDQUFvQjhDLEdBQXBCLENBQXdCLDJCQUF4QixDQUEzQjtBQUNBLFFBQU0yQixXQUFXakYsV0FBV1EsUUFBWCxDQUFvQjhDLEdBQXBCLENBQXdCLGlCQUF4QixDQUFqQjtBQUVBdEQsYUFBVzZCLE1BQVgsQ0FBa0JxRCxLQUFsQixDQUF3QkMsSUFBeEIsR0FBK0JDLE9BQS9CLENBQXdDQyxJQUFELElBQVU7QUFDaEQsU0FBTUMsZ0JBQWdCdEYsV0FBV0MsTUFBWCxDQUFrQjJCLE9BQWxCLENBQTBCMkQsT0FBMUIsQ0FBa0M7QUFBRXhFLFNBQUtzRSxLQUFLdEU7QUFBWixJQUFsQyxDQUF0QjtBQUNBLFNBQU15RSxRQUFRO0FBQUVDLFNBQUtKLEtBQUt0RTtBQUFaLElBQWQ7O0FBRUEsT0FBSXVFLGFBQUosRUFBbUI7QUFDbEJFLFVBQU1FLEVBQU4sR0FBVztBQUFFQyxVQUFLTCxjQUFjTTtBQUFyQixLQUFYO0FBQ0E7O0FBRUQsU0FBTUMsT0FBTyxJQUFJQyxJQUFKLEVBQWI7QUFDQSxTQUFNQyxPQUFPLEVBQWI7QUFDQSxTQUFNN0QsT0FBTztBQUNaOEQsV0FBTyxFQURLO0FBRVpDLFVBQU0sQ0FGTTtBQUdaN0QsV0FBTyxFQUhLO0FBSVo4RCxVQUFNWixnQkFBZ0JwRixPQUFPMkYsSUFBUCxFQUFhTSxJQUFiLENBQWtCakcsT0FBT29GLGNBQWNNLE9BQXJCLENBQWxCLEVBQWlELFNBQWpELENBQWhCLEdBQThFMUYsT0FBTzJGLElBQVAsRUFBYU0sSUFBYixDQUFrQmpHLE9BQU9tRixLQUFLSyxFQUFaLENBQWxCLEVBQW1DLFNBQW5DLENBSnhFO0FBS1pMLFVBQU1BLEtBQUs1RCxJQUFMLEdBQWEsSUFBSTRELEtBQUs1RCxJQUFNLEVBQTVCLEdBQWlDLDJCQUEyQjRELEtBQUtlLFNBQUwsQ0FBZUMsSUFBZixDQUFvQixLQUFwQixDQUE0QjtBQUxsRixJQUFiO0FBUUFyRyxjQUFXNkIsTUFBWCxDQUFrQnlFLFFBQWxCLENBQTJCbkIsSUFBM0IsQ0FBZ0NLLEtBQWhDLEVBQXVDSixPQUF2QyxDQUFnRG1CLE9BQUQsSUFBYTtBQUMzRFIsU0FBSy9DLElBQUwsQ0FBVWEsTUFBVixFQUQyRCxDQUczRDs7QUFDQWtDLFNBQUsvQyxJQUFMLENBQVVlLFFBQVY7QUFDQWdDLFNBQUsvQyxJQUFMLENBQVU5QyxPQUFPcUcsUUFBUWIsRUFBZixFQUFtQnJFLEVBQW5CLENBQXNCNEQsUUFBdEIsRUFBZ0N1QixNQUFoQyxDQUF1Qyx1QkFBdkMsQ0FBVjtBQUNBVCxTQUFLL0MsSUFBTCxDQUFVaUIsT0FBVixFQU4yRCxDQVEzRDs7QUFDQThCLFNBQUsvQyxJQUFMLENBQVVlLFFBQVY7QUFDQSxVQUFNMEMsU0FBU3pHLFdBQVc2QixNQUFYLENBQWtCNkUsS0FBbEIsQ0FBd0JuQixPQUF4QixDQUFnQztBQUFFeEUsVUFBS3dGLFFBQVFJLENBQVIsQ0FBVTVGO0FBQWpCLEtBQWhDLENBQWY7O0FBQ0EsUUFBSW1CLEtBQUs4RCxLQUFMLENBQVdZLE9BQVgsQ0FBbUJILE9BQU8xRixHQUExQixNQUFtQyxDQUFDLENBQXhDLEVBQTJDO0FBQzFDbUIsVUFBSzhELEtBQUwsQ0FBV2hELElBQVgsQ0FBZ0J5RCxPQUFPMUYsR0FBdkI7QUFDQSxLQWIwRCxDQWUzRDs7O0FBQ0EsUUFBSTBGLE9BQU9JLE1BQVAsSUFBaUJKLE9BQU9JLE1BQVAsQ0FBYyxDQUFkLENBQWpCLElBQXFDSixPQUFPSSxNQUFQLENBQWMsQ0FBZCxFQUFpQkMsT0FBMUQsRUFBbUU7QUFDbEVmLFVBQUsvQyxJQUFMLENBQVcsR0FBR3lELE9BQU9oRixJQUFNLFFBQVFnRixPQUFPSSxNQUFQLENBQWMsQ0FBZCxFQUFpQkMsT0FBUyxNQUE3RDtBQUNBLEtBRkQsTUFFTztBQUNOZixVQUFLL0MsSUFBTCxDQUFXLEdBQUd5RCxPQUFPaEYsSUFBTSxRQUFRdUQsa0JBQW9CLE1BQXZEO0FBQ0E7O0FBQ0RlLFNBQUsvQyxJQUFMLENBQVVpQixPQUFWLEVBckIyRCxDQXVCM0Q7O0FBQ0E4QixTQUFLL0MsSUFBTCxDQUFVZ0IsUUFBVjtBQUNBOUIsU0FBSytELElBQUw7O0FBQ0EsUUFBSU0sUUFBUVEsQ0FBWixFQUFlO0FBQ2QsV0FBTUMsY0FBY2hILFdBQVdpSCxZQUFYLENBQXdCQyxPQUF4QixDQUFnQ1gsT0FBaEMsQ0FBcEI7O0FBQ0EsU0FBSVMsV0FBSixFQUFpQjtBQUNoQmpCLFdBQUsvQyxJQUFMLENBQVVtRSxRQUFRQyxFQUFSLENBQVdKLFlBQVlULE9BQXZCLEVBQWdDUyxZQUFZOUUsSUFBWixHQUFtQjhFLFlBQVk5RSxJQUFaLENBQWlCcUUsT0FBakIsQ0FBbkIsR0FBK0MsRUFBL0UsRUFBbUYsSUFBbkYsQ0FBVjtBQUNBLE1BRkQsTUFFTztBQUNOUixXQUFLL0MsSUFBTCxDQUFXLEdBQUd1RCxRQUFRYyxHQUFLLEtBQUtkLFFBQVFRLENBQUcsR0FBM0M7QUFDQTtBQUNELEtBUEQsTUFPTyxJQUFJUixRQUFRL0QsSUFBWixFQUFrQjtBQUN4Qk4sVUFBS0UsS0FBTCxDQUFXWSxJQUFYLENBQWdCdUQsUUFBUS9ELElBQVIsQ0FBYXpCLEdBQTdCO0FBQ0FnRixVQUFLL0MsSUFBTCxDQUFXLEdBQUd1RCxRQUFRcEUsV0FBUixDQUFvQixDQUFwQixFQUF1Qm1GLEtBQU8sS0FBS3BELFNBQVNxQyxRQUFRcEUsV0FBUixDQUFvQixDQUFwQixDQUFULENBQWtDLEdBQW5GO0FBQ0EsS0FITSxNQUdBLElBQUlvRSxRQUFRcEUsV0FBWixFQUF5QjtBQUMvQixXQUFNb0YsV0FBVyxFQUFqQjs7QUFDQXZGLE9BQUVNLElBQUYsQ0FBT2lFLFFBQVFwRSxXQUFmLEVBQTRCLFNBQVNxRiw4QkFBVCxDQUF3Q0MsQ0FBeEMsRUFBMkM7QUFDdEUsVUFBSUEsRUFBRUMsU0FBTixFQUFpQjtBQUNoQkgsZ0JBQVN2RSxJQUFULENBQWN5RSxFQUFFQyxTQUFoQjtBQUNBLE9BSHFFLENBSXRFO0FBQ0E7QUFDQTtBQUNBOztBQUNBLE1BUkQ7O0FBVUEzQixVQUFLL0MsSUFBTCxDQUFXLEdBQUd1RCxRQUFRYyxHQUFLLEtBQUtFLFNBQVNsQixJQUFULENBQWMsSUFBZCxDQUFxQixHQUFyRDtBQUNBLEtBYk0sTUFhQTtBQUNOTixVQUFLL0MsSUFBTCxDQUFVdUQsUUFBUWMsR0FBbEI7QUFDQTs7QUFDRHRCLFNBQUsvQyxJQUFMLENBQVVpQixPQUFWO0FBRUE4QixTQUFLL0MsSUFBTCxDQUFVYyxPQUFWO0FBQ0EsSUF2REQ7O0FBeURBLE9BQUlpQyxLQUFLMUQsTUFBTCxLQUFnQixDQUFwQixFQUF1QjtBQUN0QixVQUFNc0YsU0FBU2hFLFFBQVFvQyxLQUFLTSxJQUFMLENBQVUsRUFBVixDQUFSLEdBQXdCekMsR0FBdkM7QUFFQTVELGVBQVdDLE1BQVgsQ0FBa0IyQixPQUFsQixDQUEwQmdHLE1BQTFCLENBQWlDO0FBQUU3RyxVQUFLc0UsS0FBS3RFO0FBQVosS0FBakMsRUFBb0Q7QUFDbkRBLFVBQUtzRSxLQUFLdEUsR0FEeUM7QUFFbkQ2RSxjQUFTQyxJQUYwQztBQUduRGdDLGlCQUFZRjtBQUh1QyxLQUFwRDtBQU1BM0gsZUFBV0MsTUFBWCxDQUFrQmdDLFNBQWxCLENBQTRCO0FBQzNCeUIsV0FBTWlFLE1BRHFCO0FBRTNCbkUsY0FBVSxnQkFBZ0J0QixLQUFLOEQsS0FBTCxDQUFXM0QsTUFBUSxXQUFXSCxLQUFLK0QsSUFBTSxjQUFjL0QsS0FBS0UsS0FBTCxDQUFXQyxNQUFRLFdBQVdILEtBQUtnRSxJQUFNLGdCQUFnQmhFLEtBQUttRCxJQUFNLEVBRjFIO0FBRzNCakQsWUFBT0YsS0FBS0U7QUFIZSxLQUE1QjtBQUtBO0FBQ0QsR0ExRkQ7QUEyRkEsRUEvRkQ7QUFnR0EsQ0FqR0QsQzs7Ozs7Ozs7Ozs7QUN0QkEsSUFBSUosQ0FBSjs7QUFBTTdCLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUN5QixNQUFFekIsQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUdOLE1BQU11SCxnQkFBZ0Isc0JBQXRCOztBQUVBLE1BQU1DLDBCQUEwQi9GLEVBQUVnRyxRQUFGLENBQVd6RCxPQUFPMEQsZUFBUCxDQUF1QixTQUFTQyxpQ0FBVCxHQUE2QztBQUM5RyxLQUFJQyxXQUFXQyxtQkFBWCxDQUErQk4sYUFBL0IsQ0FBSixFQUFtRDtBQUNsREssYUFBV0UsTUFBWCxDQUFrQlAsYUFBbEI7QUFDQTs7QUFFRCxLQUFJOUgsV0FBV1EsUUFBWCxDQUFvQjhDLEdBQXBCLENBQXdCLGdCQUF4QixLQUE2Q3RELFdBQVdRLFFBQVgsQ0FBb0I4QyxHQUFwQixDQUF3QixjQUF4QixNQUE0QyxFQUF6RixJQUErRnRELFdBQVdRLFFBQVgsQ0FBb0I4QyxHQUFwQixDQUF3QixZQUF4QixNQUEwQyxFQUE3SSxFQUFpSjtBQUNoSjZFLGFBQVd4SCxHQUFYLENBQWU7QUFDZGMsU0FBTXFHLGFBRFE7QUFFZFEsYUFBV0MsTUFBRCxJQUFZQSxPQUFPQyxJQUFQLENBQVl4SSxXQUFXUSxRQUFYLENBQW9COEMsR0FBcEIsQ0FBd0IsaUJBQXhCLEVBQTJDZ0IsT0FBM0MsQ0FBbUQsSUFBbkQsRUFBeUQsR0FBekQsQ0FBWixDQUZSO0FBR2RtRSxRQUFLekksV0FBV0MsTUFBWCxDQUFrQjZFO0FBSFQsR0FBZjtBQUtBO0FBQ0QsQ0FaMEMsQ0FBWCxFQVk1QixHQVo0QixDQUFoQzs7QUFjQVAsT0FBT21FLE9BQVAsQ0FBZSxNQUFNO0FBQ3BCbkUsUUFBT1EsS0FBUCxDQUFhLE1BQU07QUFDbEJnRDs7QUFFQS9ILGFBQVdRLFFBQVgsQ0FBb0I4QyxHQUFwQixDQUF3QixpQkFBeEIsRUFBMkN5RSx1QkFBM0M7QUFDQS9ILGFBQVdRLFFBQVgsQ0FBb0I4QyxHQUFwQixDQUF3QixnQkFBeEIsRUFBMEN5RSx1QkFBMUM7QUFDQS9ILGFBQVdRLFFBQVgsQ0FBb0I4QyxHQUFwQixDQUF3QixjQUF4QixFQUF3Q3lFLHVCQUF4QztBQUNBL0gsYUFBV1EsUUFBWCxDQUFvQjhDLEdBQXBCLENBQXdCLFlBQXhCLEVBQXNDeUUsdUJBQXRDO0FBQ0EsRUFQRDtBQVFBLENBVEQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zbWFyc2gtY29ubmVjdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiUm9ja2V0Q2hhdC5zbWFyc2ggPSB7fTtcbiIsImltcG9ydCBtb21lbnQgZnJvbSAnbW9tZW50JztcbmltcG9ydCAnbW9tZW50LXRpbWV6b25lJztcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnU21hcnNoJywgZnVuY3Rpb24gYWRkU2V0dGluZ3MoKSB7XG5cdHRoaXMuYWRkKCdTbWFyc2hfRW5hYmxlZCcsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGkxOG5MYWJlbDogJ1NtYXJzaF9FbmFibGVkJyxcblx0XHRlbmFibGVRdWVyeToge1xuXHRcdFx0X2lkOiAnRnJvbV9FbWFpbCcsXG5cdFx0XHR2YWx1ZToge1xuXHRcdFx0XHQkZXhpc3RzOiAxLFxuXHRcdFx0XHQkbmU6ICcnXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblx0dGhpcy5hZGQoJ1NtYXJzaF9FbWFpbCcsICcnLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0aTE4bkxhYmVsOiAnU21hcnNoX0VtYWlsJyxcblx0XHRwbGFjZWhvbGRlcjogJ2VtYWlsQGRvbWFpbi5jb20nXG5cdH0pO1xuXHR0aGlzLmFkZCgnU21hcnNoX01pc3NpbmdFbWFpbF9FbWFpbCcsICduby1lbWFpbEBleGFtcGxlLmNvbScsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRpMThuTGFiZWw6ICdTbWFyc2hfTWlzc2luZ0VtYWlsX0VtYWlsJyxcblx0XHRwbGFjZWhvbGRlcjogJ25vLWVtYWlsQGV4YW1wbGUuY29tJ1xuXHR9KTtcblxuXHRjb25zdCB6b25lVmFsdWVzID0gbW9tZW50LnR6Lm5hbWVzKCkubWFwKGZ1bmN0aW9uIF90aW1lWm9uZXNUb1NldHRpbmdzKG5hbWUpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2V5OiBuYW1lLFxuXHRcdFx0aTE4bkxhYmVsOiBuYW1lXG5cdFx0fTtcblx0fSk7XG5cdHRoaXMuYWRkKCdTbWFyc2hfVGltZXpvbmUnLCAnQW1lcmljYS9Mb3NfQW5nZWxlcycsIHtcblx0XHR0eXBlOiAnc2VsZWN0Jyxcblx0XHR2YWx1ZXM6IHpvbmVWYWx1ZXNcblx0fSk7XG5cblx0dGhpcy5hZGQoJ1NtYXJzaF9JbnRlcnZhbCcsICdldmVyeV8zMF9taW51dGVzJywge1xuXHRcdHR5cGU6ICdzZWxlY3QnLFxuXHRcdHZhbHVlczogW3tcblx0XHRcdGtleTogJ2V2ZXJ5XzMwX3NlY29uZHMnLFxuXHRcdFx0aTE4bkxhYmVsOiAnZXZlcnlfMzBfc2Vjb25kcydcblx0XHR9LCB7XG5cdFx0XHRrZXk6ICdldmVyeV8zMF9taW51dGVzJyxcblx0XHRcdGkxOG5MYWJlbDogJ2V2ZXJ5XzMwX21pbnV0ZXMnXG5cdFx0fSwge1xuXHRcdFx0a2V5OiAnZXZlcnlfMV9ob3VycycsXG5cdFx0XHRpMThuTGFiZWw6ICdldmVyeV9ob3VyJ1xuXHRcdH0sIHtcblx0XHRcdGtleTogJ2V2ZXJ5XzZfaG91cnMnLFxuXHRcdFx0aTE4bkxhYmVsOiAnZXZlcnlfc2l4X2hvdXJzJ1xuXHRcdH1dLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRfaWQ6ICdGcm9tX0VtYWlsJyxcblx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdCRleGlzdHM6IDEsXG5cdFx0XHRcdCRuZTogJydcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufSk7XG4iLCJSb2NrZXRDaGF0LnNtYXJzaC5IaXN0b3J5ID0gbmV3IGNsYXNzIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignc21hcnNoX2hpc3RvcnknKTtcblx0fVxufTtcbiIsIi8qIGdsb2JhbHMgVXBsb2FkRlMgKi9cbi8vRXhwZWN0cyB0aGUgZm9sbG93aW5nIGRldGFpbHM6XG4vLyB7XG4vLyBcdGJvZHk6ICc8dGFibGU+Jyxcbi8vIFx0c3ViamVjdDogJ1JvY2tldC5DaGF0LCAxNyBVc2VycywgMjQgTWVzc2FnZXMsIDEgRmlsZSwgNzk5NTA0IE1pbnV0ZXMsIGluICNyYW5kb20nLFxuLy8gIGZpbGVzOiBbJ2kzbmM5bDNtbiddXG4vLyB9XG5cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5Sb2NrZXRDaGF0LnNtYXJzaC5zZW5kRW1haWwgPSAoZGF0YSkgPT4ge1xuXHRjb25zdCBhdHRhY2htZW50cyA9IFtdO1xuXG5cdGlmIChkYXRhLmZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRfLmVhY2goZGF0YS5maWxlcywgKGZpbGVJZCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IFJvY2tldENoYXQubW9kZWxzLlVwbG9hZHMuZmluZE9uZUJ5SWQoZmlsZUlkKTtcblx0XHRcdGlmIChmaWxlLnN0b3JlID09PSAncm9ja2V0Y2hhdF91cGxvYWRzJyB8fCBmaWxlLnN0b3JlID09PSAnZmlsZVN5c3RlbScpIHtcblx0XHRcdFx0Y29uc3QgcnMgPSBVcGxvYWRGUy5nZXRTdG9yZShmaWxlLnN0b3JlKS5nZXRSZWFkU3RyZWFtKGZpbGVJZCwgZmlsZSk7XG5cdFx0XHRcdGF0dGFjaG1lbnRzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGVuYW1lOiBmaWxlLm5hbWUsXG5cdFx0XHRcdFx0c3RyZWFtU291cmNlOiByc1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdEVtYWlsLnNlbmQoe1xuXHRcdHRvOiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnU21hcnNoX0VtYWlsJyksXG5cdFx0ZnJvbTogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0Zyb21fRW1haWwnKSxcblx0XHRzdWJqZWN0OiBkYXRhLnN1YmplY3QsXG5cdFx0aHRtbDogZGF0YS5ib2R5LFxuXHRcdGF0dGFjaG1lbnRzXG5cdH0pO1xufTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IG1vbWVudCBmcm9tICdtb21lbnQnO1xuaW1wb3J0ICdtb21lbnQtdGltZXpvbmUnO1xuXG5jb25zdCBzdGFydCA9ICc8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyOiAxcHggc29saWQ7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IHRhYmxlLWxheW91dDogZml4ZWQ7IG1hcmdpbi10b3A6IDEwcHg7IGZvbnQtc2l6ZTogMTJweDsgd29yZC1icmVhazogYnJlYWstd29yZDtcIj48dGJvZHk+JztcbmNvbnN0IGVuZCA9ICc8L3Rib2R5PjwvdGFibGU+JztcbmNvbnN0IG9wZW50ciA9ICc8dHIgc3R5bGU9XCJib3JkZXI6IDFweCBzb2xpZDtcIj4nO1xuY29uc3QgY2xvc2V0ciA9ICc8L3RyPic7XG5jb25zdCBvcGVuMjB0ZCA9ICc8dGQgc3R5bGU9XCJib3JkZXI6IDFweCBzb2xpZDsgdGV4dC1hbGlnbjogY2VudGVyOyB3aWR0aDogMjAlO1wiPic7XG5jb25zdCBvcGVuNjB0ZCA9ICc8dGQgc3R5bGU9XCJib3JkZXI6IDFweCBzb2xpZDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDYwJTsgcGFkZGluZzogMCA1cHg7XCI+JztcbmNvbnN0IGNsb3NldGQgPSAnPC90ZD4nO1xuXG5mdW5jdGlvbiBfZ2V0TGluayhhdHRhY2htZW50KSB7XG5cdGNvbnN0IHVybCA9IGF0dGFjaG1lbnQudGl0bGVfbGluay5yZXBsYWNlKC8gL2csICclMjAnKTtcblxuXHRpZiAoTWV0ZW9yLnNldHRpbmdzLnB1YmxpYy5zYW5kc3Rvcm0gfHwgdXJsLm1hdGNoKC9eKGh0dHBzPzopP1xcL1xcLy9pKSkge1xuXHRcdHJldHVybiB1cmw7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIE1ldGVvci5hYnNvbHV0ZVVybCgpLnJlcGxhY2UoL1xcLyQvLCAnJykgKyBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYICsgdXJsO1xuXHR9XG59XG5cblJvY2tldENoYXQuc21hcnNoLmdlbmVyYXRlRW1sID0gKCkgPT4ge1xuXHRNZXRlb3IuZGVmZXIoKCkgPT4ge1xuXHRcdGNvbnN0IHNtYXJzaE1pc3NpbmdFbWFpbCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbWFyc2hfTWlzc2luZ0VtYWlsX0VtYWlsJyk7XG5cdFx0Y29uc3QgdGltZVpvbmUgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnU21hcnNoX1RpbWV6b25lJyk7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kKCkuZm9yRWFjaCgocm9vbSkgPT4ge1xuXHRcdFx0Y29uc3Qgc21hcnNoSGlzdG9yeSA9IFJvY2tldENoYXQuc21hcnNoLkhpc3RvcnkuZmluZE9uZSh7IF9pZDogcm9vbS5faWQgfSk7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHsgcmlkOiByb29tLl9pZCB9O1xuXG5cdFx0XHRpZiAoc21hcnNoSGlzdG9yeSkge1xuXHRcdFx0XHRxdWVyeS50cyA9IHsgJGd0OiBzbWFyc2hIaXN0b3J5Lmxhc3RSYW4gfTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7XG5cdFx0XHRjb25zdCByb3dzID0gW107XG5cdFx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0XHR1c2VyczogW10sXG5cdFx0XHRcdG1zZ3M6IDAsXG5cdFx0XHRcdGZpbGVzOiBbXSxcblx0XHRcdFx0dGltZTogc21hcnNoSGlzdG9yeSA/IG1vbWVudChkYXRlKS5kaWZmKG1vbWVudChzbWFyc2hIaXN0b3J5Lmxhc3RSYW4pLCAnbWludXRlcycpIDogbW9tZW50KGRhdGUpLmRpZmYobW9tZW50KHJvb20udHMpLCAnbWludXRlcycpLFxuXHRcdFx0XHRyb29tOiByb29tLm5hbWUgPyBgIyR7IHJvb20ubmFtZSB9YCA6IGBEaXJlY3QgTWVzc2FnZSBCZXR3ZWVuOiAkeyByb29tLnVzZXJuYW1lcy5qb2luKCcgJiAnKSB9YFxuXHRcdFx0fTtcblxuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZChxdWVyeSkuZm9yRWFjaCgobWVzc2FnZSkgPT4ge1xuXHRcdFx0XHRyb3dzLnB1c2gob3BlbnRyKTtcblxuXHRcdFx0XHQvL1RoZSB0aW1lc3RhbXBcblx0XHRcdFx0cm93cy5wdXNoKG9wZW4yMHRkKTtcblx0XHRcdFx0cm93cy5wdXNoKG1vbWVudChtZXNzYWdlLnRzKS50eih0aW1lWm9uZSkuZm9ybWF0KCdZWVlZLU1NLUREIEhILW1tLXNzIHonKSk7XG5cdFx0XHRcdHJvd3MucHVzaChjbG9zZXRkKTtcblxuXHRcdFx0XHQvL1RoZSBzZW5kZXJcblx0XHRcdFx0cm93cy5wdXNoKG9wZW4yMHRkKTtcblx0XHRcdFx0Y29uc3Qgc2VuZGVyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZSh7IF9pZDogbWVzc2FnZS51Ll9pZCB9KTtcblx0XHRcdFx0aWYgKGRhdGEudXNlcnMuaW5kZXhPZihzZW5kZXIuX2lkKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRkYXRhLnVzZXJzLnB1c2goc2VuZGVyLl9pZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL0dldCB0aGUgdXNlcidzIGVtYWlsLCBjYW4gYmUgbm90aGluZyBpZiBpdCBpcyBhbiB1bmNvbmZpZ3VyZWQgYm90IGFjY291bnQgKGxpa2Ugcm9ja2V0LmNhdClcblx0XHRcdFx0aWYgKHNlbmRlci5lbWFpbHMgJiYgc2VuZGVyLmVtYWlsc1swXSAmJiBzZW5kZXIuZW1haWxzWzBdLmFkZHJlc3MpIHtcblx0XHRcdFx0XHRyb3dzLnB1c2goYCR7IHNlbmRlci5uYW1lIH0gJmx0OyR7IHNlbmRlci5lbWFpbHNbMF0uYWRkcmVzcyB9Jmd0O2ApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJvd3MucHVzaChgJHsgc2VuZGVyLm5hbWUgfSAmbHQ7JHsgc21hcnNoTWlzc2luZ0VtYWlsIH0mZ3Q7YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cm93cy5wdXNoKGNsb3NldGQpO1xuXG5cdFx0XHRcdC8vVGhlIG1lc3NhZ2Vcblx0XHRcdFx0cm93cy5wdXNoKG9wZW42MHRkKTtcblx0XHRcdFx0ZGF0YS5tc2dzKys7XG5cdFx0XHRcdGlmIChtZXNzYWdlLnQpIHtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlVHlwZSA9IFJvY2tldENoYXQuTWVzc2FnZVR5cGVzLmdldFR5cGUobWVzc2FnZSk7XG5cdFx0XHRcdFx0aWYgKG1lc3NhZ2VUeXBlKSB7XG5cdFx0XHRcdFx0XHRyb3dzLnB1c2goVEFQaTE4bi5fXyhtZXNzYWdlVHlwZS5tZXNzYWdlLCBtZXNzYWdlVHlwZS5kYXRhID8gbWVzc2FnZVR5cGUuZGF0YShtZXNzYWdlKSA6ICcnLCAnZW4nKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJvd3MucHVzaChgJHsgbWVzc2FnZS5tc2cgfSAoJHsgbWVzc2FnZS50IH0pYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKG1lc3NhZ2UuZmlsZSkge1xuXHRcdFx0XHRcdGRhdGEuZmlsZXMucHVzaChtZXNzYWdlLmZpbGUuX2lkKTtcblx0XHRcdFx0XHRyb3dzLnB1c2goYCR7IG1lc3NhZ2UuYXR0YWNobWVudHNbMF0udGl0bGUgfSAoJHsgX2dldExpbmsobWVzc2FnZS5hdHRhY2htZW50c1swXSkgfSlgKTtcblx0XHRcdFx0fSBlbHNlIGlmIChtZXNzYWdlLmF0dGFjaG1lbnRzKSB7XG5cdFx0XHRcdFx0Y29uc3QgYXR0YWNoZXMgPSBbXTtcblx0XHRcdFx0XHRfLmVhY2gobWVzc2FnZS5hdHRhY2htZW50cywgZnVuY3Rpb24gX2xvb3BUaHJvdWdoTWVzc2FnZUF0dGFjaG1lbnRzKGEpIHtcblx0XHRcdFx0XHRcdGlmIChhLmltYWdlX3VybCkge1xuXHRcdFx0XHRcdFx0XHRhdHRhY2hlcy5wdXNoKGEuaW1hZ2VfdXJsKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vVE9ETzogVmVyaWZ5IG90aGVyIHR5cGUgb2YgYXR0YWNobWVudHMgd2hpY2ggbmVlZCB0byBiZSBoYW5kbGVkIHRoYXQgYXJlbid0IGZpbGUgdXBsb2FkcyBhbmQgaW1hZ2UgdXJsc1xuXHRcdFx0XHRcdFx0Ly8gfSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFx0Y29uc29sZS5sb2coYSk7XG5cdFx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRyb3dzLnB1c2goYCR7IG1lc3NhZ2UubXNnIH0gKCR7IGF0dGFjaGVzLmpvaW4oJywgJykgfSlgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyb3dzLnB1c2gobWVzc2FnZS5tc2cpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJvd3MucHVzaChjbG9zZXRkKTtcblxuXHRcdFx0XHRyb3dzLnB1c2goY2xvc2V0cik7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHJvd3MubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHN0YXJ0ICsgcm93cy5qb2luKCcnKSArIGVuZDtcblxuXHRcdFx0XHRSb2NrZXRDaGF0LnNtYXJzaC5IaXN0b3J5LnVwc2VydCh7IF9pZDogcm9vbS5faWQgfSwge1xuXHRcdFx0XHRcdF9pZDogcm9vbS5faWQsXG5cdFx0XHRcdFx0bGFzdFJhbjogZGF0ZSxcblx0XHRcdFx0XHRsYXN0UmVzdWx0OiByZXN1bHRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Um9ja2V0Q2hhdC5zbWFyc2guc2VuZEVtYWlsKHtcblx0XHRcdFx0XHRib2R5OiByZXN1bHQsXG5cdFx0XHRcdFx0c3ViamVjdDogYFJvY2tldC5DaGF0LCAkeyBkYXRhLnVzZXJzLmxlbmd0aCB9IFVzZXJzLCAkeyBkYXRhLm1zZ3MgfSBNZXNzYWdlcywgJHsgZGF0YS5maWxlcy5sZW5ndGggfSBGaWxlcywgJHsgZGF0YS50aW1lIH0gTWludXRlcywgaW4gJHsgZGF0YS5yb29tIH1gLFxuXHRcdFx0XHRcdGZpbGVzOiBkYXRhLmZpbGVzXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG4iLCIvKiBnbG9iYWxzIFN5bmNlZENyb24gKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBzbWFyc2hKb2JOYW1lID0gJ1NtYXJzaCBFTUwgQ29ubmVjdG9yJztcblxuY29uc3QgX2FkZFNtYXJzaFN5bmNlZENyb25Kb2IgPSBfLmRlYm91bmNlKE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24gX19hZGRTbWFyc2hTeW5jZWRDcm9uSm9iRGVib3VuY2VkKCkge1xuXHRpZiAoU3luY2VkQ3Jvbi5uZXh0U2NoZWR1bGVkQXREYXRlKHNtYXJzaEpvYk5hbWUpKSB7XG5cdFx0U3luY2VkQ3Jvbi5yZW1vdmUoc21hcnNoSm9iTmFtZSk7XG5cdH1cblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NtYXJzaF9FbmFibGVkJykgJiYgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NtYXJzaF9FbWFpbCcpICE9PSAnJyAmJiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRnJvbV9FbWFpbCcpICE9PSAnJykge1xuXHRcdFN5bmNlZENyb24uYWRkKHtcblx0XHRcdG5hbWU6IHNtYXJzaEpvYk5hbWUsXG5cdFx0XHRzY2hlZHVsZTogKHBhcnNlcikgPT4gcGFyc2VyLnRleHQoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NtYXJzaF9JbnRlcnZhbCcpLnJlcGxhY2UoL18vZywgJyAnKSksXG5cdFx0XHRqb2I6IFJvY2tldENoYXQuc21hcnNoLmdlbmVyYXRlRW1sXG5cdFx0fSk7XG5cdH1cbn0pLCA1MDApO1xuXG5NZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XG5cdE1ldGVvci5kZWZlcigoKSA9PiB7XG5cdFx0X2FkZFNtYXJzaFN5bmNlZENyb25Kb2IoKTtcblxuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbWFyc2hfSW50ZXJ2YWwnLCBfYWRkU21hcnNoU3luY2VkQ3JvbkpvYik7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NtYXJzaF9FbmFibGVkJywgX2FkZFNtYXJzaFN5bmNlZENyb25Kb2IpO1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdTbWFyc2hfRW1haWwnLCBfYWRkU21hcnNoU3luY2VkQ3JvbkpvYik7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0Zyb21fRW1haWwnLCBfYWRkU21hcnNoU3luY2VkQ3JvbkpvYik7XG5cdH0pO1xufSk7XG4iXX0=
