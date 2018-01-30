(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChatFile = Package['rocketchat:file'].RocketChatFile;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var self;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:custom-sounds":{"server":{"startup":{"custom-sounds.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/startup/custom-sounds.js                                             //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.startup(function () {
	let storeType = 'GridFS';

	if (RocketChat.settings.get('CustomSounds_Storage_Type')) {
		storeType = RocketChat.settings.get('CustomSounds_Storage_Type');
	}

	const RocketChatStore = RocketChatFile[storeType];

	if (RocketChatStore == null) {
		throw new Error(`Invalid RocketChatStore type [${storeType}]`);
	}

	console.log(`Using ${storeType} for custom sounds storage`.green);
	let path = '~/uploads';

	if (RocketChat.settings.get('CustomSounds_FileSystemPath') != null) {
		if (RocketChat.settings.get('CustomSounds_FileSystemPath').trim() !== '') {
			path = RocketChat.settings.get('CustomSounds_FileSystemPath');
		}
	}

	this.RocketChatFileCustomSoundsInstance = new RocketChatStore({
		name: 'custom_sounds',
		absolutePath: path
	});
	self = this;
	return WebApp.connectHandlers.use('/custom-sounds/', Meteor.bindEnvironment(function (req, res /*, next*/) {
		const params = {
			sound: decodeURIComponent(req.url.replace(/^\//, '').replace(/\?.*$/, ''))
		};

		if (_.isEmpty(params.sound)) {
			res.writeHead(403);
			res.write('Forbidden');
			res.end();
			return;
		}

		const file = RocketChatFileCustomSoundsInstance.getFileWithReadStream(params.sound);

		if (!file) {
			return;
		}

		res.setHeader('Content-Disposition', 'inline');
		let fileUploadDate = undefined;

		if (file.uploadDate != null) {
			fileUploadDate = file.uploadDate.toUTCString();
		}

		const reqModifiedHeader = req.headers['if-modified-since'];

		if (reqModifiedHeader != null) {
			if (reqModifiedHeader === fileUploadDate) {
				res.setHeader('Last-Modified', reqModifiedHeader);
				res.writeHead(304);
				res.end();
				return;
			}
		}

		res.setHeader('Cache-Control', 'public, max-age=0');
		res.setHeader('Expires', '-1');

		if (fileUploadDate != null) {
			res.setHeader('Last-Modified', fileUploadDate);
		} else {
			res.setHeader('Last-Modified', new Date().toUTCString());
		}

		res.setHeader('Content-Type', 'audio/mpeg');
		res.setHeader('Content-Length', file.length);
		file.readStream.pipe(res);
	}));
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"permissions.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/startup/permissions.js                                               //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
Meteor.startup(() => {
	if (RocketChat.models && RocketChat.models.Permissions) {
		RocketChat.models.Permissions.createOrUpdate('manage-sounds', ['admin']);
	}
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/startup/settings.js                                                  //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
RocketChat.settings.addGroup('CustomSoundsFilesystem', function () {
	this.add('CustomSounds_Storage_Type', 'GridFS', {
		type: 'select',
		values: [{
			key: 'GridFS',
			i18nLabel: 'GridFS'
		}, {
			key: 'FileSystem',
			i18nLabel: 'FileSystem'
		}],
		i18nLabel: 'FileUpload_Storage_Type'
	});
	this.add('CustomSounds_FileSystemPath', '', {
		type: 'string',
		enableQuery: {
			_id: 'CustomSounds_Storage_Type',
			value: 'FileSystem'
		},
		i18nLabel: 'FileUpload_FileSystemPath'
	});
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"CustomSounds.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/models/CustomSounds.js                                               //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
class CustomSounds extends RocketChat.models._Base {
	constructor() {
		super('custom_sounds');
		this.tryEnsureIndex({
			'name': 1
		});
	} //find one


	findOneByID(_id, options) {
		return this.findOne(_id, options);
	} //find


	findByName(name, options) {
		const query = {
			name
		};
		return this.find(query, options);
	}

	findByNameExceptID(name, except, options) {
		const query = {
			_id: {
				$nin: [except]
			},
			name
		};
		return this.find(query, options);
	} //update


	setName(_id, name) {
		const update = {
			$set: {
				name
			}
		};
		return this.update({
			_id
		}, update);
	} // INSERT


	create(data) {
		return this.insert(data);
	} // REMOVE


	removeByID(_id) {
		return this.remove(_id);
	}

}

RocketChat.models.CustomSounds = new CustomSounds();
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"publications":{"customSounds.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/publications/customSounds.js                                         //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
Meteor.publish('customSounds', function (filter, limit) {
	if (!this.userId) {
		return this.ready();
	}

	const fields = {
		name: 1,
		extension: 1
	};
	filter = s.trim(filter);
	const options = {
		fields,
		limit,
		sort: {
			name: 1
		}
	};

	if (filter) {
		const filterReg = new RegExp(s.escapeRegExp(filter), 'i');
		return RocketChat.models.CustomSounds.findByName(filterReg, options);
	}

	return RocketChat.models.CustomSounds.find({}, options);
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"deleteCustomSound.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/methods/deleteCustomSound.js                                         //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
/* globals RocketChatFileCustomSoundsInstance */Meteor.methods({
	deleteCustomSound(_id) {
		let sound = null;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-sounds')) {
			sound = RocketChat.models.CustomSounds.findOneByID(_id);
		} else {
			throw new Meteor.Error('not_authorized');
		}

		if (sound == null) {
			throw new Meteor.Error('Custom_Sound_Error_Invalid_Sound', 'Invalid sound', {
				method: 'deleteCustomSound'
			});
		}

		RocketChatFileCustomSoundsInstance.deleteFile(`${sound._id}.${sound.extension}`);
		RocketChat.models.CustomSounds.removeByID(_id);
		RocketChat.Notifications.notifyAll('deleteCustomSound', {
			soundData: sound
		});
		return true;
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"insertOrUpdateSound.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/methods/insertOrUpdateSound.js                                       //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
Meteor.methods({
	insertOrUpdateSound(soundData) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-sounds')) {
			throw new Meteor.Error('not_authorized');
		}

		if (!s.trim(soundData.name)) {
			throw new Meteor.Error('error-the-field-is-required', 'The field Name is required', {
				method: 'insertOrUpdateSound',
				field: 'Name'
			});
		} //let nameValidation = new RegExp('^[0-9a-zA-Z-_+;.]+$');
		//allow all characters except colon, whitespace, comma, >, <, &, ", ', /, \, (, )
		//more practical than allowing specific sets of characters; also allows foreign languages


		const nameValidation = /[\s,:><&"'\/\\\(\)]/; //silently strip colon; this allows for uploading :soundname: as soundname

		soundData.name = soundData.name.replace(/:/g, '');

		if (nameValidation.test(soundData.name)) {
			throw new Meteor.Error('error-input-is-not-a-valid-field', `${soundData.name} is not a valid name`, {
				method: 'insertOrUpdateSound',
				input: soundData.name,
				field: 'Name'
			});
		}

		let matchingResults = [];

		if (soundData._id) {
			matchingResults = RocketChat.models.CustomSounds.findByNameExceptID(soundData.name, soundData._id).fetch();
		} else {
			matchingResults = RocketChat.models.CustomSounds.findByName(soundData.name).fetch();
		}

		if (matchingResults.length > 0) {
			throw new Meteor.Error('Custom_Sound_Error_Name_Already_In_Use', 'The custom sound name is already in use', {
				method: 'insertOrUpdateSound'
			});
		}

		if (!soundData._id) {
			//insert sound
			const createSound = {
				name: soundData.name,
				extension: soundData.extension
			};

			const _id = RocketChat.models.CustomSounds.create(createSound);

			createSound._id = _id;
			return _id;
		} else {
			//update sound
			if (soundData.newFile) {
				RocketChatFileCustomSoundsInstance.deleteFile(`${soundData._id}.${soundData.previousExtension}`);
			}

			if (soundData.name !== soundData.previousName) {
				RocketChat.models.CustomSounds.setName(soundData._id, soundData.name);
				RocketChat.Notifications.notifyAll('updateCustomSound', {
					soundData
				});
			}

			return soundData._id;
		}
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"listCustomSounds.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/methods/listCustomSounds.js                                          //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
Meteor.methods({
	listCustomSounds() {
		return RocketChat.models.CustomSounds.find({}).fetch();
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"uploadCustomSound.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/rocketchat_custom-sounds/server/methods/uploadCustomSound.js                                         //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
/* globals RocketChatFileCustomSoundsInstance */Meteor.methods({
	uploadCustomSound(binaryContent, contentType, soundData) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-sounds')) {
			throw new Meteor.Error('not_authorized');
		}

		const file = new Buffer(binaryContent, 'binary');
		const rs = RocketChatFile.bufferToStream(file);
		RocketChatFileCustomSoundsInstance.deleteFile(`${soundData._id}.${soundData.extension}`);
		const ws = RocketChatFileCustomSoundsInstance.createWriteStream(`${soundData._id}.${soundData.extension}`, contentType);
		ws.on('end', Meteor.bindEnvironment(() => Meteor.setTimeout(() => RocketChat.Notifications.notifyAll('updateCustomSound', {
			soundData
		}), 500)));
		rs.pipe(ws);
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:custom-sounds/server/startup/custom-sounds.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/startup/permissions.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/startup/settings.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/models/CustomSounds.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/publications/customSounds.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/methods/deleteCustomSound.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/methods/insertOrUpdateSound.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/methods/listCustomSounds.js");
require("./node_modules/meteor/rocketchat:custom-sounds/server/methods/uploadCustomSound.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:custom-sounds'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_custom-sounds.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjdXN0b20tc291bmRzL3NlcnZlci9zdGFydHVwL2N1c3RvbS1zb3VuZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y3VzdG9tLXNvdW5kcy9zZXJ2ZXIvc3RhcnR1cC9wZXJtaXNzaW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjdXN0b20tc291bmRzL3NlcnZlci9zdGFydHVwL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmN1c3RvbS1zb3VuZHMvc2VydmVyL21vZGVscy9DdXN0b21Tb3VuZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y3VzdG9tLXNvdW5kcy9zZXJ2ZXIvcHVibGljYXRpb25zL2N1c3RvbVNvdW5kcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjdXN0b20tc291bmRzL3NlcnZlci9tZXRob2RzL2RlbGV0ZUN1c3RvbVNvdW5kLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmN1c3RvbS1zb3VuZHMvc2VydmVyL21ldGhvZHMvaW5zZXJ0T3JVcGRhdGVTb3VuZC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjdXN0b20tc291bmRzL3NlcnZlci9tZXRob2RzL2xpc3RDdXN0b21Tb3VuZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y3VzdG9tLXNvdW5kcy9zZXJ2ZXIvbWV0aG9kcy91cGxvYWRDdXN0b21Tb3VuZC5qcyJdLCJuYW1lcyI6WyJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJNZXRlb3IiLCJzdGFydHVwIiwic3RvcmVUeXBlIiwiUm9ja2V0Q2hhdCIsInNldHRpbmdzIiwiZ2V0IiwiUm9ja2V0Q2hhdFN0b3JlIiwiUm9ja2V0Q2hhdEZpbGUiLCJFcnJvciIsImNvbnNvbGUiLCJsb2ciLCJncmVlbiIsInBhdGgiLCJ0cmltIiwiUm9ja2V0Q2hhdEZpbGVDdXN0b21Tb3VuZHNJbnN0YW5jZSIsIm5hbWUiLCJhYnNvbHV0ZVBhdGgiLCJzZWxmIiwiV2ViQXBwIiwiY29ubmVjdEhhbmRsZXJzIiwidXNlIiwiYmluZEVudmlyb25tZW50IiwicmVxIiwicmVzIiwicGFyYW1zIiwic291bmQiLCJkZWNvZGVVUklDb21wb25lbnQiLCJ1cmwiLCJyZXBsYWNlIiwiaXNFbXB0eSIsIndyaXRlSGVhZCIsIndyaXRlIiwiZW5kIiwiZmlsZSIsImdldEZpbGVXaXRoUmVhZFN0cmVhbSIsInNldEhlYWRlciIsImZpbGVVcGxvYWREYXRlIiwidW5kZWZpbmVkIiwidXBsb2FkRGF0ZSIsInRvVVRDU3RyaW5nIiwicmVxTW9kaWZpZWRIZWFkZXIiLCJoZWFkZXJzIiwiRGF0ZSIsImxlbmd0aCIsInJlYWRTdHJlYW0iLCJwaXBlIiwibW9kZWxzIiwiUGVybWlzc2lvbnMiLCJjcmVhdGVPclVwZGF0ZSIsImFkZEdyb3VwIiwiYWRkIiwidHlwZSIsInZhbHVlcyIsImtleSIsImkxOG5MYWJlbCIsImVuYWJsZVF1ZXJ5IiwiX2lkIiwidmFsdWUiLCJDdXN0b21Tb3VuZHMiLCJfQmFzZSIsImNvbnN0cnVjdG9yIiwidHJ5RW5zdXJlSW5kZXgiLCJmaW5kT25lQnlJRCIsIm9wdGlvbnMiLCJmaW5kT25lIiwiZmluZEJ5TmFtZSIsInF1ZXJ5IiwiZmluZCIsImZpbmRCeU5hbWVFeGNlcHRJRCIsImV4Y2VwdCIsIiRuaW4iLCJzZXROYW1lIiwidXBkYXRlIiwiJHNldCIsImNyZWF0ZSIsImRhdGEiLCJpbnNlcnQiLCJyZW1vdmVCeUlEIiwicmVtb3ZlIiwicyIsInB1Ymxpc2giLCJmaWx0ZXIiLCJsaW1pdCIsInVzZXJJZCIsInJlYWR5IiwiZmllbGRzIiwiZXh0ZW5zaW9uIiwic29ydCIsImZpbHRlclJlZyIsIlJlZ0V4cCIsImVzY2FwZVJlZ0V4cCIsIm1ldGhvZHMiLCJkZWxldGVDdXN0b21Tb3VuZCIsImF1dGh6IiwiaGFzUGVybWlzc2lvbiIsIm1ldGhvZCIsImRlbGV0ZUZpbGUiLCJOb3RpZmljYXRpb25zIiwibm90aWZ5QWxsIiwic291bmREYXRhIiwiaW5zZXJ0T3JVcGRhdGVTb3VuZCIsImZpZWxkIiwibmFtZVZhbGlkYXRpb24iLCJ0ZXN0IiwiaW5wdXQiLCJtYXRjaGluZ1Jlc3VsdHMiLCJmZXRjaCIsImNyZWF0ZVNvdW5kIiwibmV3RmlsZSIsInByZXZpb3VzRXh0ZW5zaW9uIiwicHJldmlvdXNOYW1lIiwibGlzdEN1c3RvbVNvdW5kcyIsInVwbG9hZEN1c3RvbVNvdW5kIiwiYmluYXJ5Q29udGVudCIsImNvbnRlbnRUeXBlIiwiQnVmZmVyIiwicnMiLCJidWZmZXJUb1N0cmVhbSIsIndzIiwiY3JlYXRlV3JpdGVTdHJlYW0iLCJvbiIsInNldFRpbWVvdXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFHTkMsT0FBT0MsT0FBUCxDQUFlLFlBQVc7QUFDekIsS0FBSUMsWUFBWSxRQUFoQjs7QUFFQSxLQUFJQyxXQUFXQyxRQUFYLENBQW9CQyxHQUFwQixDQUF3QiwyQkFBeEIsQ0FBSixFQUEwRDtBQUN6REgsY0FBWUMsV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsMkJBQXhCLENBQVo7QUFDQTs7QUFFRCxPQUFNQyxrQkFBa0JDLGVBQWVMLFNBQWYsQ0FBeEI7O0FBRUEsS0FBSUksbUJBQW1CLElBQXZCLEVBQTZCO0FBQzVCLFFBQU0sSUFBSUUsS0FBSixDQUFXLGlDQUFpQ04sU0FBVyxHQUF2RCxDQUFOO0FBQ0E7O0FBRURPLFNBQVFDLEdBQVIsQ0FBYSxTQUFTUixTQUFXLDRCQUFyQixDQUFpRFMsS0FBN0Q7QUFFQSxLQUFJQyxPQUFPLFdBQVg7O0FBQ0EsS0FBSVQsV0FBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsNkJBQXhCLEtBQTBELElBQTlELEVBQW9FO0FBQ25FLE1BQUlGLFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLDZCQUF4QixFQUF1RFEsSUFBdkQsT0FBa0UsRUFBdEUsRUFBMEU7QUFDekVELFVBQU9ULFdBQVdDLFFBQVgsQ0FBb0JDLEdBQXBCLENBQXdCLDZCQUF4QixDQUFQO0FBQ0E7QUFDRDs7QUFFRCxNQUFLUyxrQ0FBTCxHQUEwQyxJQUFJUixlQUFKLENBQW9CO0FBQzdEUyxRQUFNLGVBRHVEO0FBRTdEQyxnQkFBY0o7QUFGK0MsRUFBcEIsQ0FBMUM7QUFLQUssUUFBTyxJQUFQO0FBRUEsUUFBT0MsT0FBT0MsZUFBUCxDQUF1QkMsR0FBdkIsQ0FBMkIsaUJBQTNCLEVBQThDcEIsT0FBT3FCLGVBQVAsQ0FBdUIsVUFBU0MsR0FBVCxFQUFjQyxHQUFkLENBQWlCLFVBQWpCLEVBQTZCO0FBQ3hHLFFBQU1DLFNBQ0w7QUFBRUMsVUFBT0MsbUJBQW1CSixJQUFJSyxHQUFKLENBQVFDLE9BQVIsQ0FBZ0IsS0FBaEIsRUFBdUIsRUFBdkIsRUFBMkJBLE9BQTNCLENBQW1DLE9BQW5DLEVBQTRDLEVBQTVDLENBQW5CO0FBQVQsR0FERDs7QUFHQSxNQUFJbEMsRUFBRW1DLE9BQUYsQ0FBVUwsT0FBT0MsS0FBakIsQ0FBSixFQUE2QjtBQUM1QkYsT0FBSU8sU0FBSixDQUFjLEdBQWQ7QUFDQVAsT0FBSVEsS0FBSixDQUFVLFdBQVY7QUFDQVIsT0FBSVMsR0FBSjtBQUNBO0FBQ0E7O0FBRUQsUUFBTUMsT0FBT25CLG1DQUFtQ29CLHFCQUFuQyxDQUF5RFYsT0FBT0MsS0FBaEUsQ0FBYjs7QUFDQSxNQUFJLENBQUNRLElBQUwsRUFBVztBQUNWO0FBQ0E7O0FBRURWLE1BQUlZLFNBQUosQ0FBYyxxQkFBZCxFQUFxQyxRQUFyQztBQUVBLE1BQUlDLGlCQUFpQkMsU0FBckI7O0FBQ0EsTUFBSUosS0FBS0ssVUFBTCxJQUFtQixJQUF2QixFQUE2QjtBQUM1QkYsb0JBQWlCSCxLQUFLSyxVQUFMLENBQWdCQyxXQUFoQixFQUFqQjtBQUNBOztBQUVELFFBQU1DLG9CQUFvQmxCLElBQUltQixPQUFKLENBQVksbUJBQVosQ0FBMUI7O0FBQ0EsTUFBSUQscUJBQXFCLElBQXpCLEVBQStCO0FBQzlCLE9BQUlBLHNCQUFzQkosY0FBMUIsRUFBMEM7QUFDekNiLFFBQUlZLFNBQUosQ0FBYyxlQUFkLEVBQStCSyxpQkFBL0I7QUFDQWpCLFFBQUlPLFNBQUosQ0FBYyxHQUFkO0FBQ0FQLFFBQUlTLEdBQUo7QUFDQTtBQUNBO0FBQ0Q7O0FBRURULE1BQUlZLFNBQUosQ0FBYyxlQUFkLEVBQStCLG1CQUEvQjtBQUNBWixNQUFJWSxTQUFKLENBQWMsU0FBZCxFQUF5QixJQUF6Qjs7QUFDQSxNQUFJQyxrQkFBa0IsSUFBdEIsRUFBNEI7QUFDM0JiLE9BQUlZLFNBQUosQ0FBYyxlQUFkLEVBQStCQyxjQUEvQjtBQUNBLEdBRkQsTUFFTztBQUNOYixPQUFJWSxTQUFKLENBQWMsZUFBZCxFQUErQixJQUFJTyxJQUFKLEdBQVdILFdBQVgsRUFBL0I7QUFDQTs7QUFDRGhCLE1BQUlZLFNBQUosQ0FBYyxjQUFkLEVBQThCLFlBQTlCO0FBQ0FaLE1BQUlZLFNBQUosQ0FBYyxnQkFBZCxFQUFnQ0YsS0FBS1UsTUFBckM7QUFFQVYsT0FBS1csVUFBTCxDQUFnQkMsSUFBaEIsQ0FBcUJ0QixHQUFyQjtBQUNBLEVBNUNvRCxDQUE5QyxDQUFQO0FBNkNBLENBMUVELEU7Ozs7Ozs7Ozs7O0FDSEF2QixPQUFPQyxPQUFQLENBQWUsTUFBTTtBQUNwQixLQUFJRSxXQUFXMkMsTUFBWCxJQUFxQjNDLFdBQVcyQyxNQUFYLENBQWtCQyxXQUEzQyxFQUF3RDtBQUN2RDVDLGFBQVcyQyxNQUFYLENBQWtCQyxXQUFsQixDQUE4QkMsY0FBOUIsQ0FBNkMsZUFBN0MsRUFBOEQsQ0FBQyxPQUFELENBQTlEO0FBQ0E7QUFDRCxDQUpELEU7Ozs7Ozs7Ozs7O0FDQUE3QyxXQUFXQyxRQUFYLENBQW9CNkMsUUFBcEIsQ0FBNkIsd0JBQTdCLEVBQXVELFlBQVc7QUFDakUsTUFBS0MsR0FBTCxDQUFTLDJCQUFULEVBQXNDLFFBQXRDLEVBQWdEO0FBQy9DQyxRQUFNLFFBRHlDO0FBRS9DQyxVQUFRLENBQUM7QUFDUkMsUUFBSyxRQURHO0FBRVJDLGNBQVc7QUFGSCxHQUFELEVBR0w7QUFDRkQsUUFBSyxZQURIO0FBRUZDLGNBQVc7QUFGVCxHQUhLLENBRnVDO0FBUy9DQSxhQUFXO0FBVG9DLEVBQWhEO0FBWUEsTUFBS0osR0FBTCxDQUFTLDZCQUFULEVBQXdDLEVBQXhDLEVBQTRDO0FBQzNDQyxRQUFNLFFBRHFDO0FBRTNDSSxlQUFhO0FBQ1pDLFFBQUssMkJBRE87QUFFWkMsVUFBTztBQUZLLEdBRjhCO0FBTTNDSCxhQUFXO0FBTmdDLEVBQTVDO0FBUUEsQ0FyQkQsRTs7Ozs7Ozs7Ozs7QUNBQSxNQUFNSSxZQUFOLFNBQTJCdkQsV0FBVzJDLE1BQVgsQ0FBa0JhLEtBQTdDLENBQW1EO0FBQ2xEQyxlQUFjO0FBQ2IsUUFBTSxlQUFOO0FBRUEsT0FBS0MsY0FBTCxDQUFvQjtBQUFFLFdBQVE7QUFBVixHQUFwQjtBQUNBLEVBTGlELENBT2xEOzs7QUFDQUMsYUFBWU4sR0FBWixFQUFpQk8sT0FBakIsRUFBMEI7QUFDekIsU0FBTyxLQUFLQyxPQUFMLENBQWFSLEdBQWIsRUFBa0JPLE9BQWxCLENBQVA7QUFDQSxFQVZpRCxDQVlsRDs7O0FBQ0FFLFlBQVdsRCxJQUFYLEVBQWlCZ0QsT0FBakIsRUFBMEI7QUFDekIsUUFBTUcsUUFBUTtBQUNibkQ7QUFEYSxHQUFkO0FBSUEsU0FBTyxLQUFLb0QsSUFBTCxDQUFVRCxLQUFWLEVBQWlCSCxPQUFqQixDQUFQO0FBQ0E7O0FBRURLLG9CQUFtQnJELElBQW5CLEVBQXlCc0QsTUFBekIsRUFBaUNOLE9BQWpDLEVBQTBDO0FBQ3pDLFFBQU1HLFFBQVE7QUFDYlYsUUFBSztBQUFFYyxVQUFNLENBQUVELE1BQUY7QUFBUixJQURRO0FBRWJ0RDtBQUZhLEdBQWQ7QUFLQSxTQUFPLEtBQUtvRCxJQUFMLENBQVVELEtBQVYsRUFBaUJILE9BQWpCLENBQVA7QUFDQSxFQTVCaUQsQ0E4QmxEOzs7QUFDQVEsU0FBUWYsR0FBUixFQUFhekMsSUFBYixFQUFtQjtBQUNsQixRQUFNeUQsU0FBUztBQUNkQyxTQUFNO0FBQ0wxRDtBQURLO0FBRFEsR0FBZjtBQU1BLFNBQU8sS0FBS3lELE1BQUwsQ0FBWTtBQUFDaEI7QUFBRCxHQUFaLEVBQW1CZ0IsTUFBbkIsQ0FBUDtBQUNBLEVBdkNpRCxDQXlDbEQ7OztBQUNBRSxRQUFPQyxJQUFQLEVBQWE7QUFDWixTQUFPLEtBQUtDLE1BQUwsQ0FBWUQsSUFBWixDQUFQO0FBQ0EsRUE1Q2lELENBK0NsRDs7O0FBQ0FFLFlBQVdyQixHQUFYLEVBQWdCO0FBQ2YsU0FBTyxLQUFLc0IsTUFBTCxDQUFZdEIsR0FBWixDQUFQO0FBQ0E7O0FBbERpRDs7QUFxRG5EckQsV0FBVzJDLE1BQVgsQ0FBa0JZLFlBQWxCLEdBQWlDLElBQUlBLFlBQUosRUFBakMsQzs7Ozs7Ozs7Ozs7QUNyREEsSUFBSXFCLENBQUo7QUFBTXBGLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxtQkFBUixDQUFiLEVBQTBDO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDZ0YsTUFBRWhGLENBQUY7QUFBSTs7QUFBaEIsQ0FBMUMsRUFBNEQsQ0FBNUQ7QUFFTkMsT0FBT2dGLE9BQVAsQ0FBZSxjQUFmLEVBQStCLFVBQVNDLE1BQVQsRUFBaUJDLEtBQWpCLEVBQXdCO0FBQ3RELEtBQUksQ0FBQyxLQUFLQyxNQUFWLEVBQWtCO0FBQ2pCLFNBQU8sS0FBS0MsS0FBTCxFQUFQO0FBQ0E7O0FBRUQsT0FBTUMsU0FBUztBQUNkdEUsUUFBTSxDQURRO0FBRWR1RSxhQUFXO0FBRkcsRUFBZjtBQUtBTCxVQUFTRixFQUFFbEUsSUFBRixDQUFPb0UsTUFBUCxDQUFUO0FBRUEsT0FBTWxCLFVBQVU7QUFDZnNCLFFBRGU7QUFFZkgsT0FGZTtBQUdmSyxRQUFNO0FBQUV4RSxTQUFNO0FBQVI7QUFIUyxFQUFoQjs7QUFNQSxLQUFJa0UsTUFBSixFQUFZO0FBQ1gsUUFBTU8sWUFBWSxJQUFJQyxNQUFKLENBQVdWLEVBQUVXLFlBQUYsQ0FBZVQsTUFBZixDQUFYLEVBQW1DLEdBQW5DLENBQWxCO0FBQ0EsU0FBTzlFLFdBQVcyQyxNQUFYLENBQWtCWSxZQUFsQixDQUErQk8sVUFBL0IsQ0FBMEN1QixTQUExQyxFQUFxRHpCLE9BQXJELENBQVA7QUFDQTs7QUFFRCxRQUFPNUQsV0FBVzJDLE1BQVgsQ0FBa0JZLFlBQWxCLENBQStCUyxJQUEvQixDQUFvQyxFQUFwQyxFQUF3Q0osT0FBeEMsQ0FBUDtBQUNBLENBeEJELEU7Ozs7Ozs7Ozs7O0FDRkEsZ0RBQ0EvRCxPQUFPMkYsT0FBUCxDQUFlO0FBQ2RDLG1CQUFrQnBDLEdBQWxCLEVBQXVCO0FBQ3RCLE1BQUkvQixRQUFRLElBQVo7O0FBRUEsTUFBSXRCLFdBQVcwRixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLWCxNQUFwQyxFQUE0QyxlQUE1QyxDQUFKLEVBQWtFO0FBQ2pFMUQsV0FBUXRCLFdBQVcyQyxNQUFYLENBQWtCWSxZQUFsQixDQUErQkksV0FBL0IsQ0FBMkNOLEdBQTNDLENBQVI7QUFDQSxHQUZELE1BRU87QUFDTixTQUFNLElBQUl4RCxPQUFPUSxLQUFYLENBQWlCLGdCQUFqQixDQUFOO0FBQ0E7O0FBRUQsTUFBSWlCLFNBQVMsSUFBYixFQUFtQjtBQUNsQixTQUFNLElBQUl6QixPQUFPUSxLQUFYLENBQWlCLGtDQUFqQixFQUFxRCxlQUFyRCxFQUFzRTtBQUFFdUYsWUFBUTtBQUFWLElBQXRFLENBQU47QUFDQTs7QUFFRGpGLHFDQUFtQ2tGLFVBQW5DLENBQStDLEdBQUd2RSxNQUFNK0IsR0FBSyxJQUFJL0IsTUFBTTZELFNBQVcsRUFBbEY7QUFDQW5GLGFBQVcyQyxNQUFYLENBQWtCWSxZQUFsQixDQUErQm1CLFVBQS9CLENBQTBDckIsR0FBMUM7QUFDQXJELGFBQVc4RixhQUFYLENBQXlCQyxTQUF6QixDQUFtQyxtQkFBbkMsRUFBd0Q7QUFBQ0MsY0FBVzFFO0FBQVosR0FBeEQ7QUFFQSxTQUFPLElBQVA7QUFDQTs7QUFuQmEsQ0FBZixFOzs7Ozs7Ozs7OztBQ0RBLElBQUlzRCxDQUFKO0FBQU1wRixPQUFPQyxLQUFQLENBQWFDLFFBQVEsbUJBQVIsQ0FBYixFQUEwQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ2dGLE1BQUVoRixDQUFGO0FBQUk7O0FBQWhCLENBQTFDLEVBQTRELENBQTVEO0FBR05DLE9BQU8yRixPQUFQLENBQWU7QUFDZFMscUJBQW9CRCxTQUFwQixFQUErQjtBQUM5QixNQUFJLENBQUNoRyxXQUFXMEYsS0FBWCxDQUFpQkMsYUFBakIsQ0FBK0IsS0FBS1gsTUFBcEMsRUFBNEMsZUFBNUMsQ0FBTCxFQUFtRTtBQUNsRSxTQUFNLElBQUluRixPQUFPUSxLQUFYLENBQWlCLGdCQUFqQixDQUFOO0FBQ0E7O0FBRUQsTUFBSSxDQUFDdUUsRUFBRWxFLElBQUYsQ0FBT3NGLFVBQVVwRixJQUFqQixDQUFMLEVBQTZCO0FBQzVCLFNBQU0sSUFBSWYsT0FBT1EsS0FBWCxDQUFpQiw2QkFBakIsRUFBZ0QsNEJBQWhELEVBQThFO0FBQUV1RixZQUFRLHFCQUFWO0FBQWlDTSxXQUFPO0FBQXhDLElBQTlFLENBQU47QUFDQSxHQVA2QixDQVM5QjtBQUVBO0FBQ0E7OztBQUNBLFFBQU1DLGlCQUFpQixxQkFBdkIsQ0FiOEIsQ0FlOUI7O0FBQ0FILFlBQVVwRixJQUFWLEdBQWlCb0YsVUFBVXBGLElBQVYsQ0FBZWEsT0FBZixDQUF1QixJQUF2QixFQUE2QixFQUE3QixDQUFqQjs7QUFFQSxNQUFJMEUsZUFBZUMsSUFBZixDQUFvQkosVUFBVXBGLElBQTlCLENBQUosRUFBeUM7QUFDeEMsU0FBTSxJQUFJZixPQUFPUSxLQUFYLENBQWlCLGtDQUFqQixFQUFzRCxHQUFHMkYsVUFBVXBGLElBQU0sc0JBQXpFLEVBQWdHO0FBQUVnRixZQUFRLHFCQUFWO0FBQWlDUyxXQUFPTCxVQUFVcEYsSUFBbEQ7QUFBd0RzRixXQUFPO0FBQS9ELElBQWhHLENBQU47QUFDQTs7QUFFRCxNQUFJSSxrQkFBa0IsRUFBdEI7O0FBRUEsTUFBSU4sVUFBVTNDLEdBQWQsRUFBbUI7QUFDbEJpRCxxQkFBa0J0RyxXQUFXMkMsTUFBWCxDQUFrQlksWUFBbEIsQ0FBK0JVLGtCQUEvQixDQUFrRCtCLFVBQVVwRixJQUE1RCxFQUFrRW9GLFVBQVUzQyxHQUE1RSxFQUFpRmtELEtBQWpGLEVBQWxCO0FBQ0EsR0FGRCxNQUVPO0FBQ05ELHFCQUFrQnRHLFdBQVcyQyxNQUFYLENBQWtCWSxZQUFsQixDQUErQk8sVUFBL0IsQ0FBMENrQyxVQUFVcEYsSUFBcEQsRUFBMEQyRixLQUExRCxFQUFsQjtBQUNBOztBQUVELE1BQUlELGdCQUFnQjlELE1BQWhCLEdBQXlCLENBQTdCLEVBQWdDO0FBQy9CLFNBQU0sSUFBSTNDLE9BQU9RLEtBQVgsQ0FBaUIsd0NBQWpCLEVBQTJELHlDQUEzRCxFQUFzRztBQUFFdUYsWUFBUTtBQUFWLElBQXRHLENBQU47QUFDQTs7QUFFRCxNQUFJLENBQUNJLFVBQVUzQyxHQUFmLEVBQW9CO0FBQ25CO0FBQ0EsU0FBTW1ELGNBQWM7QUFDbkI1RixVQUFNb0YsVUFBVXBGLElBREc7QUFFbkJ1RSxlQUFXYSxVQUFVYjtBQUZGLElBQXBCOztBQUtBLFNBQU05QixNQUFNckQsV0FBVzJDLE1BQVgsQ0FBa0JZLFlBQWxCLENBQStCZ0IsTUFBL0IsQ0FBc0NpQyxXQUF0QyxDQUFaOztBQUNBQSxlQUFZbkQsR0FBWixHQUFrQkEsR0FBbEI7QUFFQSxVQUFPQSxHQUFQO0FBQ0EsR0FYRCxNQVdPO0FBQ047QUFDQSxPQUFJMkMsVUFBVVMsT0FBZCxFQUF1QjtBQUN0QjlGLHVDQUFtQ2tGLFVBQW5DLENBQStDLEdBQUdHLFVBQVUzQyxHQUFLLElBQUkyQyxVQUFVVSxpQkFBbUIsRUFBbEc7QUFDQTs7QUFFRCxPQUFJVixVQUFVcEYsSUFBVixLQUFtQm9GLFVBQVVXLFlBQWpDLEVBQStDO0FBQzlDM0csZUFBVzJDLE1BQVgsQ0FBa0JZLFlBQWxCLENBQStCYSxPQUEvQixDQUF1QzRCLFVBQVUzQyxHQUFqRCxFQUFzRDJDLFVBQVVwRixJQUFoRTtBQUNBWixlQUFXOEYsYUFBWCxDQUF5QkMsU0FBekIsQ0FBbUMsbUJBQW5DLEVBQXdEO0FBQUNDO0FBQUQsS0FBeEQ7QUFDQTs7QUFFRCxVQUFPQSxVQUFVM0MsR0FBakI7QUFDQTtBQUNEOztBQTNEYSxDQUFmLEU7Ozs7Ozs7Ozs7O0FDSEF4RCxPQUFPMkYsT0FBUCxDQUFlO0FBQ2RvQixvQkFBbUI7QUFDbEIsU0FBTzVHLFdBQVcyQyxNQUFYLENBQWtCWSxZQUFsQixDQUErQlMsSUFBL0IsQ0FBb0MsRUFBcEMsRUFBd0N1QyxLQUF4QyxFQUFQO0FBQ0E7O0FBSGEsQ0FBZixFOzs7Ozs7Ozs7OztBQ0FBLGdEQUNBMUcsT0FBTzJGLE9BQVAsQ0FBZTtBQUNkcUIsbUJBQWtCQyxhQUFsQixFQUFpQ0MsV0FBakMsRUFBOENmLFNBQTlDLEVBQXlEO0FBQ3hELE1BQUksQ0FBQ2hHLFdBQVcwRixLQUFYLENBQWlCQyxhQUFqQixDQUErQixLQUFLWCxNQUFwQyxFQUE0QyxlQUE1QyxDQUFMLEVBQW1FO0FBQ2xFLFNBQU0sSUFBSW5GLE9BQU9RLEtBQVgsQ0FBaUIsZ0JBQWpCLENBQU47QUFDQTs7QUFFRCxRQUFNeUIsT0FBTyxJQUFJa0YsTUFBSixDQUFXRixhQUFYLEVBQTBCLFFBQTFCLENBQWI7QUFFQSxRQUFNRyxLQUFLN0csZUFBZThHLGNBQWYsQ0FBOEJwRixJQUE5QixDQUFYO0FBQ0FuQixxQ0FBbUNrRixVQUFuQyxDQUErQyxHQUFHRyxVQUFVM0MsR0FBSyxJQUFJMkMsVUFBVWIsU0FBVyxFQUExRjtBQUNBLFFBQU1nQyxLQUFLeEcsbUNBQW1DeUcsaUJBQW5DLENBQXNELEdBQUdwQixVQUFVM0MsR0FBSyxJQUFJMkMsVUFBVWIsU0FBVyxFQUFqRyxFQUFvRzRCLFdBQXBHLENBQVg7QUFDQUksS0FBR0UsRUFBSCxDQUFNLEtBQU4sRUFBYXhILE9BQU9xQixlQUFQLENBQXVCLE1BQ25DckIsT0FBT3lILFVBQVAsQ0FBa0IsTUFBTXRILFdBQVc4RixhQUFYLENBQXlCQyxTQUF6QixDQUFtQyxtQkFBbkMsRUFBd0Q7QUFBQ0M7QUFBRCxHQUF4RCxDQUF4QixFQUE4RixHQUE5RixDQURZLENBQWI7QUFJQWlCLEtBQUd2RSxJQUFILENBQVF5RSxFQUFSO0FBQ0E7O0FBaEJhLENBQWYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9jdXN0b20tc291bmRzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBSb2NrZXRDaGF0RmlsZUN1c3RvbVNvdW5kc0luc3RhbmNlICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdGxldCBzdG9yZVR5cGUgPSAnR3JpZEZTJztcblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0N1c3RvbVNvdW5kc19TdG9yYWdlX1R5cGUnKSkge1xuXHRcdHN0b3JlVHlwZSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdDdXN0b21Tb3VuZHNfU3RvcmFnZV9UeXBlJyk7XG5cdH1cblxuXHRjb25zdCBSb2NrZXRDaGF0U3RvcmUgPSBSb2NrZXRDaGF0RmlsZVtzdG9yZVR5cGVdO1xuXG5cdGlmIChSb2NrZXRDaGF0U3RvcmUgPT0gbnVsbCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBSb2NrZXRDaGF0U3RvcmUgdHlwZSBbJHsgc3RvcmVUeXBlIH1dYCk7XG5cdH1cblxuXHRjb25zb2xlLmxvZyhgVXNpbmcgJHsgc3RvcmVUeXBlIH0gZm9yIGN1c3RvbSBzb3VuZHMgc3RvcmFnZWAuZ3JlZW4pO1xuXG5cdGxldCBwYXRoID0gJ34vdXBsb2Fkcyc7XG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQ3VzdG9tU291bmRzX0ZpbGVTeXN0ZW1QYXRoJykgIT0gbnVsbCkge1xuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQ3VzdG9tU291bmRzX0ZpbGVTeXN0ZW1QYXRoJykudHJpbSgpICE9PSAnJykge1xuXHRcdFx0cGF0aCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdDdXN0b21Tb3VuZHNfRmlsZVN5c3RlbVBhdGgnKTtcblx0XHR9XG5cdH1cblxuXHR0aGlzLlJvY2tldENoYXRGaWxlQ3VzdG9tU291bmRzSW5zdGFuY2UgPSBuZXcgUm9ja2V0Q2hhdFN0b3JlKHtcblx0XHRuYW1lOiAnY3VzdG9tX3NvdW5kcycsXG5cdFx0YWJzb2x1dGVQYXRoOiBwYXRoXG5cdH0pO1xuXG5cdHNlbGYgPSB0aGlzO1xuXG5cdHJldHVybiBXZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZSgnL2N1c3RvbS1zb3VuZHMvJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihyZXEsIHJlcy8qLCBuZXh0Ki8pIHtcblx0XHRjb25zdCBwYXJhbXMgPVxuXHRcdFx0eyBzb3VuZDogZGVjb2RlVVJJQ29tcG9uZW50KHJlcS51cmwucmVwbGFjZSgvXlxcLy8sICcnKS5yZXBsYWNlKC9cXD8uKiQvLCAnJykpIH07XG5cblx0XHRpZiAoXy5pc0VtcHR5KHBhcmFtcy5zb3VuZCkpIHtcblx0XHRcdHJlcy53cml0ZUhlYWQoNDAzKTtcblx0XHRcdHJlcy53cml0ZSgnRm9yYmlkZGVuJyk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZSA9IFJvY2tldENoYXRGaWxlQ3VzdG9tU291bmRzSW5zdGFuY2UuZ2V0RmlsZVdpdGhSZWFkU3RyZWFtKHBhcmFtcy5zb3VuZCk7XG5cdFx0aWYgKCFmaWxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1EaXNwb3NpdGlvbicsICdpbmxpbmUnKTtcblxuXHRcdGxldCBmaWxlVXBsb2FkRGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRpZiAoZmlsZS51cGxvYWREYXRlICE9IG51bGwpIHtcblx0XHRcdGZpbGVVcGxvYWREYXRlID0gZmlsZS51cGxvYWREYXRlLnRvVVRDU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVxTW9kaWZpZWRIZWFkZXIgPSByZXEuaGVhZGVyc1snaWYtbW9kaWZpZWQtc2luY2UnXTtcblx0XHRpZiAocmVxTW9kaWZpZWRIZWFkZXIgIT0gbnVsbCkge1xuXHRcdFx0aWYgKHJlcU1vZGlmaWVkSGVhZGVyID09PSBmaWxlVXBsb2FkRGF0ZSkge1xuXHRcdFx0XHRyZXMuc2V0SGVhZGVyKCdMYXN0LU1vZGlmaWVkJywgcmVxTW9kaWZpZWRIZWFkZXIpO1xuXHRcdFx0XHRyZXMud3JpdGVIZWFkKDMwNCk7XG5cdFx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAncHVibGljLCBtYXgtYWdlPTAnKTtcblx0XHRyZXMuc2V0SGVhZGVyKCdFeHBpcmVzJywgJy0xJyk7XG5cdFx0aWYgKGZpbGVVcGxvYWREYXRlICE9IG51bGwpIHtcblx0XHRcdHJlcy5zZXRIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnLCBmaWxlVXBsb2FkRGF0ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlcy5zZXRIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnLCBuZXcgRGF0ZSgpLnRvVVRDU3RyaW5nKCkpO1xuXHRcdH1cblx0XHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXVkaW8vbXBlZycpO1xuXHRcdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgZmlsZS5sZW5ndGgpO1xuXG5cdFx0ZmlsZS5yZWFkU3RyZWFtLnBpcGUocmVzKTtcblx0fSkpO1xufSk7XG4iLCJNZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XG5cdGlmIChSb2NrZXRDaGF0Lm1vZGVscyAmJiBSb2NrZXRDaGF0Lm1vZGVscy5QZXJtaXNzaW9ucykge1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLmNyZWF0ZU9yVXBkYXRlKCdtYW5hZ2Utc291bmRzJywgWydhZG1pbiddKTtcblx0fVxufSk7XG4iLCJSb2NrZXRDaGF0LnNldHRpbmdzLmFkZEdyb3VwKCdDdXN0b21Tb3VuZHNGaWxlc3lzdGVtJywgZnVuY3Rpb24oKSB7XG5cdHRoaXMuYWRkKCdDdXN0b21Tb3VuZHNfU3RvcmFnZV9UeXBlJywgJ0dyaWRGUycsIHtcblx0XHR0eXBlOiAnc2VsZWN0Jyxcblx0XHR2YWx1ZXM6IFt7XG5cdFx0XHRrZXk6ICdHcmlkRlMnLFxuXHRcdFx0aTE4bkxhYmVsOiAnR3JpZEZTJ1xuXHRcdH0sIHtcblx0XHRcdGtleTogJ0ZpbGVTeXN0ZW0nLFxuXHRcdFx0aTE4bkxhYmVsOiAnRmlsZVN5c3RlbSdcblx0XHR9XSxcblx0XHRpMThuTGFiZWw6ICdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZSdcblx0fSk7XG5cblx0dGhpcy5hZGQoJ0N1c3RvbVNvdW5kc19GaWxlU3lzdGVtUGF0aCcsICcnLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdF9pZDogJ0N1c3RvbVNvdW5kc19TdG9yYWdlX1R5cGUnLFxuXHRcdFx0dmFsdWU6ICdGaWxlU3lzdGVtJ1xuXHRcdH0sXG5cdFx0aTE4bkxhYmVsOiAnRmlsZVVwbG9hZF9GaWxlU3lzdGVtUGF0aCdcblx0fSk7XG59KTtcbiIsImNsYXNzIEN1c3RvbVNvdW5kcyBleHRlbmRzIFJvY2tldENoYXQubW9kZWxzLl9CYXNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ2N1c3RvbV9zb3VuZHMnKTtcblxuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnbmFtZSc6IDEgfSk7XG5cdH1cblxuXHQvL2ZpbmQgb25lXG5cdGZpbmRPbmVCeUlEKF9pZCwgb3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLmZpbmRPbmUoX2lkLCBvcHRpb25zKTtcblx0fVxuXG5cdC8vZmluZFxuXHRmaW5kQnlOYW1lKG5hbWUsIG9wdGlvbnMpIHtcblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdG5hbWVcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuZmluZChxdWVyeSwgb3B0aW9ucyk7XG5cdH1cblxuXHRmaW5kQnlOYW1lRXhjZXB0SUQobmFtZSwgZXhjZXB0LCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgcXVlcnkgPSB7XG5cdFx0XHRfaWQ6IHsgJG5pbjogWyBleGNlcHQgXSB9LFxuXHRcdFx0bmFtZVxuXHRcdH07XG5cblx0XHRyZXR1cm4gdGhpcy5maW5kKHF1ZXJ5LCBvcHRpb25zKTtcblx0fVxuXG5cdC8vdXBkYXRlXG5cdHNldE5hbWUoX2lkLCBuYW1lKSB7XG5cdFx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRuYW1lXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLnVwZGF0ZSh7X2lkfSwgdXBkYXRlKTtcblx0fVxuXG5cdC8vIElOU0VSVFxuXHRjcmVhdGUoZGF0YSkge1xuXHRcdHJldHVybiB0aGlzLmluc2VydChkYXRhKTtcblx0fVxuXG5cblx0Ly8gUkVNT1ZFXG5cdHJlbW92ZUJ5SUQoX2lkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlKF9pZCk7XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5tb2RlbHMuQ3VzdG9tU291bmRzID0gbmV3IEN1c3RvbVNvdW5kcygpO1xuIiwiaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuXG5NZXRlb3IucHVibGlzaCgnY3VzdG9tU291bmRzJywgZnVuY3Rpb24oZmlsdGVyLCBsaW1pdCkge1xuXHRpZiAoIXRoaXMudXNlcklkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHkoKTtcblx0fVxuXG5cdGNvbnN0IGZpZWxkcyA9IHtcblx0XHRuYW1lOiAxLFxuXHRcdGV4dGVuc2lvbjogMVxuXHR9O1xuXG5cdGZpbHRlciA9IHMudHJpbShmaWx0ZXIpO1xuXG5cdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0ZmllbGRzLFxuXHRcdGxpbWl0LFxuXHRcdHNvcnQ6IHsgbmFtZTogMSB9XG5cdH07XG5cblx0aWYgKGZpbHRlcikge1xuXHRcdGNvbnN0IGZpbHRlclJlZyA9IG5ldyBSZWdFeHAocy5lc2NhcGVSZWdFeHAoZmlsdGVyKSwgJ2knKTtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuQ3VzdG9tU291bmRzLmZpbmRCeU5hbWUoZmlsdGVyUmVnLCBvcHRpb25zKTtcblx0fVxuXG5cdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMuZmluZCh7fSwgb3B0aW9ucyk7XG59KTtcbiIsIi8qIGdsb2JhbHMgUm9ja2V0Q2hhdEZpbGVDdXN0b21Tb3VuZHNJbnN0YW5jZSAqL1xuTWV0ZW9yLm1ldGhvZHMoe1xuXHRkZWxldGVDdXN0b21Tb3VuZChfaWQpIHtcblx0XHRsZXQgc291bmQgPSBudWxsO1xuXG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1zb3VuZHMnKSkge1xuXHRcdFx0c291bmQgPSBSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMuZmluZE9uZUJ5SUQoX2lkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90X2F1dGhvcml6ZWQnKTtcblx0XHR9XG5cblx0XHRpZiAoc291bmQgPT0gbnVsbCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignQ3VzdG9tX1NvdW5kX0Vycm9yX0ludmFsaWRfU291bmQnLCAnSW52YWxpZCBzb3VuZCcsIHsgbWV0aG9kOiAnZGVsZXRlQ3VzdG9tU291bmQnIH0pO1xuXHRcdH1cblxuXHRcdFJvY2tldENoYXRGaWxlQ3VzdG9tU291bmRzSW5zdGFuY2UuZGVsZXRlRmlsZShgJHsgc291bmQuX2lkIH0uJHsgc291bmQuZXh0ZW5zaW9uIH1gKTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMucmVtb3ZlQnlJRChfaWQpO1xuXHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlBbGwoJ2RlbGV0ZUN1c3RvbVNvdW5kJywge3NvdW5kRGF0YTogc291bmR9KTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59KTtcbiIsIi8qIGdsb2JhbHMgUm9ja2V0Q2hhdEZpbGVDdXN0b21Tb3VuZHNJbnN0YW5jZSAqL1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdGluc2VydE9yVXBkYXRlU291bmQoc291bmREYXRhKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2Utc291bmRzJykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdF9hdXRob3JpemVkJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFzLnRyaW0oc291bmREYXRhLm5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci10aGUtZmllbGQtaXMtcmVxdWlyZWQnLCAnVGhlIGZpZWxkIE5hbWUgaXMgcmVxdWlyZWQnLCB7IG1ldGhvZDogJ2luc2VydE9yVXBkYXRlU291bmQnLCBmaWVsZDogJ05hbWUnIH0pO1xuXHRcdH1cblxuXHRcdC8vbGV0IG5hbWVWYWxpZGF0aW9uID0gbmV3IFJlZ0V4cCgnXlswLTlhLXpBLVotXys7Ll0rJCcpO1xuXG5cdFx0Ly9hbGxvdyBhbGwgY2hhcmFjdGVycyBleGNlcHQgY29sb24sIHdoaXRlc3BhY2UsIGNvbW1hLCA+LCA8LCAmLCBcIiwgJywgLywgXFwsICgsIClcblx0XHQvL21vcmUgcHJhY3RpY2FsIHRoYW4gYWxsb3dpbmcgc3BlY2lmaWMgc2V0cyBvZiBjaGFyYWN0ZXJzOyBhbHNvIGFsbG93cyBmb3JlaWduIGxhbmd1YWdlc1xuXHRcdGNvbnN0IG5hbWVWYWxpZGF0aW9uID0gL1tcXHMsOj48JlwiJ1xcL1xcXFxcXChcXCldLztcblxuXHRcdC8vc2lsZW50bHkgc3RyaXAgY29sb247IHRoaXMgYWxsb3dzIGZvciB1cGxvYWRpbmcgOnNvdW5kbmFtZTogYXMgc291bmRuYW1lXG5cdFx0c291bmREYXRhLm5hbWUgPSBzb3VuZERhdGEubmFtZS5yZXBsYWNlKC86L2csICcnKTtcblxuXHRcdGlmIChuYW1lVmFsaWRhdGlvbi50ZXN0KHNvdW5kRGF0YS5uYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW5wdXQtaXMtbm90LWEtdmFsaWQtZmllbGQnLCBgJHsgc291bmREYXRhLm5hbWUgfSBpcyBub3QgYSB2YWxpZCBuYW1lYCwgeyBtZXRob2Q6ICdpbnNlcnRPclVwZGF0ZVNvdW5kJywgaW5wdXQ6IHNvdW5kRGF0YS5uYW1lLCBmaWVsZDogJ05hbWUnIH0pO1xuXHRcdH1cblxuXHRcdGxldCBtYXRjaGluZ1Jlc3VsdHMgPSBbXTtcblxuXHRcdGlmIChzb3VuZERhdGEuX2lkKSB7XG5cdFx0XHRtYXRjaGluZ1Jlc3VsdHMgPSBSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMuZmluZEJ5TmFtZUV4Y2VwdElEKHNvdW5kRGF0YS5uYW1lLCBzb3VuZERhdGEuX2lkKS5mZXRjaCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtYXRjaGluZ1Jlc3VsdHMgPSBSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMuZmluZEJ5TmFtZShzb3VuZERhdGEubmFtZSkuZmV0Y2goKTtcblx0XHR9XG5cblx0XHRpZiAobWF0Y2hpbmdSZXN1bHRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ0N1c3RvbV9Tb3VuZF9FcnJvcl9OYW1lX0FscmVhZHlfSW5fVXNlJywgJ1RoZSBjdXN0b20gc291bmQgbmFtZSBpcyBhbHJlYWR5IGluIHVzZScsIHsgbWV0aG9kOiAnaW5zZXJ0T3JVcGRhdGVTb3VuZCcgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFzb3VuZERhdGEuX2lkKSB7XG5cdFx0XHQvL2luc2VydCBzb3VuZFxuXHRcdFx0Y29uc3QgY3JlYXRlU291bmQgPSB7XG5cdFx0XHRcdG5hbWU6IHNvdW5kRGF0YS5uYW1lLFxuXHRcdFx0XHRleHRlbnNpb246IHNvdW5kRGF0YS5leHRlbnNpb25cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IF9pZCA9IFJvY2tldENoYXQubW9kZWxzLkN1c3RvbVNvdW5kcy5jcmVhdGUoY3JlYXRlU291bmQpO1xuXHRcdFx0Y3JlYXRlU291bmQuX2lkID0gX2lkO1xuXG5cdFx0XHRyZXR1cm4gX2lkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvL3VwZGF0ZSBzb3VuZFxuXHRcdFx0aWYgKHNvdW5kRGF0YS5uZXdGaWxlKSB7XG5cdFx0XHRcdFJvY2tldENoYXRGaWxlQ3VzdG9tU291bmRzSW5zdGFuY2UuZGVsZXRlRmlsZShgJHsgc291bmREYXRhLl9pZCB9LiR7IHNvdW5kRGF0YS5wcmV2aW91c0V4dGVuc2lvbiB9YCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzb3VuZERhdGEubmFtZSAhPT0gc291bmREYXRhLnByZXZpb3VzTmFtZSkge1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMuc2V0TmFtZShzb3VuZERhdGEuX2lkLCBzb3VuZERhdGEubmFtZSk7XG5cdFx0XHRcdFJvY2tldENoYXQuTm90aWZpY2F0aW9ucy5ub3RpZnlBbGwoJ3VwZGF0ZUN1c3RvbVNvdW5kJywge3NvdW5kRGF0YX0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gc291bmREYXRhLl9pZDtcblx0XHR9XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHRsaXN0Q3VzdG9tU291bmRzKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5DdXN0b21Tb3VuZHMuZmluZCh7fSkuZmV0Y2goKTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIFJvY2tldENoYXRGaWxlQ3VzdG9tU291bmRzSW5zdGFuY2UgKi9cbk1ldGVvci5tZXRob2RzKHtcblx0dXBsb2FkQ3VzdG9tU291bmQoYmluYXJ5Q29udGVudCwgY29udGVudFR5cGUsIHNvdW5kRGF0YSkge1xuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKHRoaXMudXNlcklkLCAnbWFuYWdlLXNvdW5kcycpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGUgPSBuZXcgQnVmZmVyKGJpbmFyeUNvbnRlbnQsICdiaW5hcnknKTtcblxuXHRcdGNvbnN0IHJzID0gUm9ja2V0Q2hhdEZpbGUuYnVmZmVyVG9TdHJlYW0oZmlsZSk7XG5cdFx0Um9ja2V0Q2hhdEZpbGVDdXN0b21Tb3VuZHNJbnN0YW5jZS5kZWxldGVGaWxlKGAkeyBzb3VuZERhdGEuX2lkIH0uJHsgc291bmREYXRhLmV4dGVuc2lvbiB9YCk7XG5cdFx0Y29uc3Qgd3MgPSBSb2NrZXRDaGF0RmlsZUN1c3RvbVNvdW5kc0luc3RhbmNlLmNyZWF0ZVdyaXRlU3RyZWFtKGAkeyBzb3VuZERhdGEuX2lkIH0uJHsgc291bmREYXRhLmV4dGVuc2lvbiB9YCwgY29udGVudFR5cGUpO1xuXHRcdHdzLm9uKCdlbmQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+XG5cdFx0XHRNZXRlb3Iuc2V0VGltZW91dCgoKSA9PiBSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5QWxsKCd1cGRhdGVDdXN0b21Tb3VuZCcsIHtzb3VuZERhdGF9KSwgNTAwKVxuXHRcdCkpO1xuXG5cdFx0cnMucGlwZSh3cyk7XG5cdH1cbn0pO1xuIl19
