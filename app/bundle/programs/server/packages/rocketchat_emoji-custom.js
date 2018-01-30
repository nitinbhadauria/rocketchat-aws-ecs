(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var renderEmoji = Package['rocketchat:emoji'].renderEmoji;
var RocketChatFile = Package['rocketchat:file'].RocketChatFile;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var isSet, isSetNotNull;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:emoji-custom":{"function-isSet.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/function-isSet.js                                                                //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
/* globals isSet:true, isSetNotNull:true */ //http://stackoverflow.com/a/26990347 function isSet() from Gajus
isSet = function (fn) {
	let value;

	try {
		value = fn();
	} catch (e) {
		value = undefined;
	} finally {
		return value !== undefined;
	}
};

isSetNotNull = function (fn) {
	let value;

	try {
		value = fn();
	} catch (e) {
		value = null;
	} finally {
		return value !== null && value !== undefined;
	}
}; /* exported isSet, isSetNotNull */
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server":{"startup":{"emoji-custom.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/startup/emoji-custom.js                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.startup(function () {
	let storeType = 'GridFS';

	if (RocketChat.settings.get('EmojiUpload_Storage_Type')) {
		storeType = RocketChat.settings.get('EmojiUpload_Storage_Type');
	}

	const RocketChatStore = RocketChatFile[storeType];

	if (RocketChatStore == null) {
		throw new Error(`Invalid RocketChatStore type [${storeType}]`);
	}

	console.log(`Using ${storeType} for custom emoji storage`.green);
	let path = '~/uploads';

	if (RocketChat.settings.get('EmojiUpload_FileSystemPath') != null) {
		if (RocketChat.settings.get('EmojiUpload_FileSystemPath').trim() !== '') {
			path = RocketChat.settings.get('EmojiUpload_FileSystemPath');
		}
	}

	this.RocketChatFileEmojiCustomInstance = new RocketChatStore({
		name: 'custom_emoji',
		absolutePath: path
	});
	return WebApp.connectHandlers.use('/emoji-custom/', Meteor.bindEnvironment(function (req, res /*, next*/) {
		const params = {
			emoji: decodeURIComponent(req.url.replace(/^\//, '').replace(/\?.*$/, ''))
		};

		if (_.isEmpty(params.emoji)) {
			res.writeHead(403);
			res.write('Forbidden');
			res.end();
			return;
		}

		const file = RocketChatFileEmojiCustomInstance.getFileWithReadStream(encodeURIComponent(params.emoji));
		res.setHeader('Content-Disposition', 'inline');

		if (file == null) {
			//use code from username initials renderer until file upload is complete
			res.setHeader('Content-Type', 'image/svg+xml');
			res.setHeader('Cache-Control', 'public, max-age=0');
			res.setHeader('Expires', '-1');
			res.setHeader('Last-Modified', 'Thu, 01 Jan 2015 00:00:00 GMT');
			const reqModifiedHeader = req.headers['if-modified-since'];

			if (reqModifiedHeader != null) {
				if (reqModifiedHeader === 'Thu, 01 Jan 2015 00:00:00 GMT') {
					res.writeHead(304);
					res.end();
					return;
				}
			}

			const color = '#000';
			const initials = '?';
			const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" pointer-events="none" width="50" height="50" style="width: 50px; height: 50px; background-color: ${color};">
	<text text-anchor="middle" y="50%" x="50%" dy="0.36em" pointer-events="auto" fill="#ffffff" font-family="Helvetica, Arial, Lucida Grande, sans-serif" style="font-weight: 400; font-size: 28px;">
		${initials}
	</text>
</svg>`;
			res.write(svg);
			res.end();
			return;
		}

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

		if (/^svg$/i.test(params.emoji.split('.').pop())) {
			res.setHeader('Content-Type', 'image/svg+xml');
		} else {
			res.setHeader('Content-Type', 'image/jpeg');
		}

		res.setHeader('Content-Length', file.length);
		file.readStream.pipe(res);
	}));
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"settings.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/startup/settings.js                                                       //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
RocketChat.settings.addGroup('EmojiCustomFilesystem', function () {
	this.add('EmojiUpload_Storage_Type', 'GridFS', {
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
	this.add('EmojiUpload_FileSystemPath', '', {
		type: 'string',
		enableQuery: {
			_id: 'EmojiUpload_Storage_Type',
			value: 'FileSystem'
		},
		i18nLabel: 'FileUpload_FileSystemPath'
	});
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"EmojiCustom.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/models/EmojiCustom.js                                                     //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
class EmojiCustom extends RocketChat.models._Base {
	constructor() {
		super('custom_emoji');
		this.tryEnsureIndex({
			'name': 1
		});
		this.tryEnsureIndex({
			'aliases': 1
		});
		this.tryEnsureIndex({
			'extension': 1
		});
	} //find one


	findOneByID(_id, options) {
		return this.findOne(_id, options);
	} //find


	findByNameOrAlias(name, options) {
		const query = {
			$or: [{
				name
			}, {
				aliases: name
			}]
		};
		return this.find(query, options);
	}

	findByNameOrAliasExceptID(name, except, options) {
		const query = {
			_id: {
				$nin: [except]
			},
			$or: [{
				name
			}, {
				aliases: name
			}]
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
	}

	setAliases(_id, aliases) {
		const update = {
			$set: {
				aliases
			}
		};
		return this.update({
			_id
		}, update);
	}

	setExtension(_id, extension) {
		const update = {
			$set: {
				extension
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

RocketChat.models.EmojiCustom = new EmojiCustom();
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"publications":{"fullEmojiData.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/publications/fullEmojiData.js                                             //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
Meteor.publish('fullEmojiData', function (filter, limit) {
	if (!this.userId) {
		return this.ready();
	}

	const fields = {
		name: 1,
		aliases: 1,
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
		return RocketChat.models.EmojiCustom.findByNameOrAlias(filterReg, options);
	}

	return RocketChat.models.EmojiCustom.find({}, options);
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"listEmojiCustom.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/methods/listEmojiCustom.js                                                //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
Meteor.methods({
	listEmojiCustom() {
		return RocketChat.models.EmojiCustom.find({}).fetch();
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"deleteEmojiCustom.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/methods/deleteEmojiCustom.js                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
/* globals RocketChatFileEmojiCustomInstance */Meteor.methods({
	deleteEmojiCustom(emojiID) {
		let emoji = null;

		if (RocketChat.authz.hasPermission(this.userId, 'manage-emoji')) {
			emoji = RocketChat.models.EmojiCustom.findOneByID(emojiID);
		} else {
			throw new Meteor.Error('not_authorized');
		}

		if (emoji == null) {
			throw new Meteor.Error('Custom_Emoji_Error_Invalid_Emoji', 'Invalid emoji', {
				method: 'deleteEmojiCustom'
			});
		}

		RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emoji.name}.${emoji.extension}`));
		RocketChat.models.EmojiCustom.removeByID(emojiID);
		RocketChat.Notifications.notifyLogged('deleteEmojiCustom', {
			emojiData: emoji
		});
		return true;
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"insertOrUpdateEmoji.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/methods/insertOrUpdateEmoji.js                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
Meteor.methods({
	insertOrUpdateEmoji(emojiData) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-emoji')) {
			throw new Meteor.Error('not_authorized');
		}

		if (!s.trim(emojiData.name)) {
			throw new Meteor.Error('error-the-field-is-required', 'The field Name is required', {
				method: 'insertOrUpdateEmoji',
				field: 'Name'
			});
		} //allow all characters except colon, whitespace, comma, >, <, &, ", ', /, \, (, )
		//more practical than allowing specific sets of characters; also allows foreign languages


		const nameValidation = /[\s,:><&"'\/\\\(\)]/;
		const aliasValidation = /[:><&\|"'\/\\\(\)]/; //silently strip colon; this allows for uploading :emojiname: as emojiname

		emojiData.name = emojiData.name.replace(/:/g, '');
		emojiData.aliases = emojiData.aliases.replace(/:/g, '');

		if (nameValidation.test(emojiData.name)) {
			throw new Meteor.Error('error-input-is-not-a-valid-field', `${emojiData.name} is not a valid name`, {
				method: 'insertOrUpdateEmoji',
				input: emojiData.name,
				field: 'Name'
			});
		}

		if (emojiData.aliases) {
			if (aliasValidation.test(emojiData.aliases)) {
				throw new Meteor.Error('error-input-is-not-a-valid-field', `${emojiData.aliases} is not a valid alias set`, {
					method: 'insertOrUpdateEmoji',
					input: emojiData.aliases,
					field: 'Alias_Set'
				});
			}

			emojiData.aliases = emojiData.aliases.split(/[\s,]/);
			emojiData.aliases = emojiData.aliases.filter(Boolean);
			emojiData.aliases = _.without(emojiData.aliases, emojiData.name);
		} else {
			emojiData.aliases = [];
		}

		let matchingResults = [];

		if (emojiData._id) {
			matchingResults = RocketChat.models.EmojiCustom.findByNameOrAliasExceptID(emojiData.name, emojiData._id).fetch();

			for (const alias of emojiData.aliases) {
				matchingResults = matchingResults.concat(RocketChat.models.EmojiCustom.findByNameOrAliasExceptID(alias, emojiData._id).fetch());
			}
		} else {
			matchingResults = RocketChat.models.EmojiCustom.findByNameOrAlias(emojiData.name).fetch();

			for (const alias of emojiData.aliases) {
				matchingResults = matchingResults.concat(RocketChat.models.EmojiCustom.findByNameOrAlias(alias).fetch());
			}
		}

		if (matchingResults.length > 0) {
			throw new Meteor.Error('Custom_Emoji_Error_Name_Or_Alias_Already_In_Use', 'The custom emoji or one of its aliases is already in use', {
				method: 'insertOrUpdateEmoji'
			});
		}

		if (!emojiData._id) {
			//insert emoji
			const createEmoji = {
				name: emojiData.name,
				aliases: emojiData.aliases,
				extension: emojiData.extension
			};

			const _id = RocketChat.models.EmojiCustom.create(createEmoji);

			RocketChat.Notifications.notifyLogged('updateEmojiCustom', {
				emojiData: createEmoji
			});
			return _id;
		} else {
			//update emoji
			if (emojiData.newFile) {
				RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.name}.${emojiData.extension}`));
				RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.name}.${emojiData.previousExtension}`));
				RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.previousName}.${emojiData.extension}`));
				RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.previousName}.${emojiData.previousExtension}`));
				RocketChat.models.EmojiCustom.setExtension(emojiData._id, emojiData.extension);
			} else if (emojiData.name !== emojiData.previousName) {
				const rs = RocketChatFileEmojiCustomInstance.getFileWithReadStream(encodeURIComponent(`${emojiData.previousName}.${emojiData.previousExtension}`));

				if (rs !== null) {
					RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.name}.${emojiData.extension}`));
					const ws = RocketChatFileEmojiCustomInstance.createWriteStream(encodeURIComponent(`${emojiData.name}.${emojiData.previousExtension}`), rs.contentType);
					ws.on('end', Meteor.bindEnvironment(() => RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.previousName}.${emojiData.previousExtension}`))));
					rs.readStream.pipe(ws);
				}
			}

			if (emojiData.name !== emojiData.previousName) {
				RocketChat.models.EmojiCustom.setName(emojiData._id, emojiData.name);
			}

			if (emojiData.aliases) {
				RocketChat.models.EmojiCustom.setAliases(emojiData._id, emojiData.aliases);
			} else {
				RocketChat.models.EmojiCustom.setAliases(emojiData._id, []);
			}

			RocketChat.Notifications.notifyLogged('updateEmojiCustom', {
				emojiData
			});
			return true;
		}
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"uploadEmojiCustom.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/rocketchat_emoji-custom/server/methods/uploadEmojiCustom.js                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
/* globals RocketChatFileEmojiCustomInstance */Meteor.methods({
	uploadEmojiCustom(binaryContent, contentType, emojiData) {
		if (!RocketChat.authz.hasPermission(this.userId, 'manage-emoji')) {
			throw new Meteor.Error('not_authorized');
		} //delete aliases for notification purposes. here, it is a string rather than an array


		delete emojiData.aliases;
		const file = new Buffer(binaryContent, 'binary');
		const rs = RocketChatFile.bufferToStream(file);
		RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emojiData.name}.${emojiData.extension}`));
		const ws = RocketChatFileEmojiCustomInstance.createWriteStream(encodeURIComponent(`${emojiData.name}.${emojiData.extension}`), contentType);
		ws.on('end', Meteor.bindEnvironment(() => Meteor.setTimeout(() => RocketChat.Notifications.notifyLogged('updateEmojiCustom', {
			emojiData
		}), 500)));
		rs.pipe(ws);
	}

});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:emoji-custom/function-isSet.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/startup/emoji-custom.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/startup/settings.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/models/EmojiCustom.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/publications/fullEmojiData.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/methods/listEmojiCustom.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/methods/deleteEmojiCustom.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/methods/insertOrUpdateEmoji.js");
require("./node_modules/meteor/rocketchat:emoji-custom/server/methods/uploadEmojiCustom.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:emoji-custom'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_emoji-custom.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDplbW9qaS1jdXN0b20vZnVuY3Rpb24taXNTZXQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZW1vamktY3VzdG9tL3NlcnZlci9zdGFydHVwL2Vtb2ppLWN1c3RvbS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDplbW9qaS1jdXN0b20vc2VydmVyL3N0YXJ0dXAvc2V0dGluZ3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZW1vamktY3VzdG9tL3NlcnZlci9tb2RlbHMvRW1vamlDdXN0b20uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZW1vamktY3VzdG9tL3NlcnZlci9wdWJsaWNhdGlvbnMvZnVsbEVtb2ppRGF0YS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDplbW9qaS1jdXN0b20vc2VydmVyL21ldGhvZHMvbGlzdEVtb2ppQ3VzdG9tLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmVtb2ppLWN1c3RvbS9zZXJ2ZXIvbWV0aG9kcy9kZWxldGVFbW9qaUN1c3RvbS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDplbW9qaS1jdXN0b20vc2VydmVyL21ldGhvZHMvaW5zZXJ0T3JVcGRhdGVFbW9qaS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDplbW9qaS1jdXN0b20vc2VydmVyL21ldGhvZHMvdXBsb2FkRW1vamlDdXN0b20uanMiXSwibmFtZXMiOlsiaXNTZXQiLCJmbiIsInZhbHVlIiwiZSIsInVuZGVmaW5lZCIsImlzU2V0Tm90TnVsbCIsIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIk1ldGVvciIsInN0YXJ0dXAiLCJzdG9yZVR5cGUiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJnZXQiLCJSb2NrZXRDaGF0U3RvcmUiLCJSb2NrZXRDaGF0RmlsZSIsIkVycm9yIiwiY29uc29sZSIsImxvZyIsImdyZWVuIiwicGF0aCIsInRyaW0iLCJSb2NrZXRDaGF0RmlsZUVtb2ppQ3VzdG9tSW5zdGFuY2UiLCJuYW1lIiwiYWJzb2x1dGVQYXRoIiwiV2ViQXBwIiwiY29ubmVjdEhhbmRsZXJzIiwidXNlIiwiYmluZEVudmlyb25tZW50IiwicmVxIiwicmVzIiwicGFyYW1zIiwiZW1vamkiLCJkZWNvZGVVUklDb21wb25lbnQiLCJ1cmwiLCJyZXBsYWNlIiwiaXNFbXB0eSIsIndyaXRlSGVhZCIsIndyaXRlIiwiZW5kIiwiZmlsZSIsImdldEZpbGVXaXRoUmVhZFN0cmVhbSIsImVuY29kZVVSSUNvbXBvbmVudCIsInNldEhlYWRlciIsInJlcU1vZGlmaWVkSGVhZGVyIiwiaGVhZGVycyIsImNvbG9yIiwiaW5pdGlhbHMiLCJzdmciLCJmaWxlVXBsb2FkRGF0ZSIsInVwbG9hZERhdGUiLCJ0b1VUQ1N0cmluZyIsIkRhdGUiLCJ0ZXN0Iiwic3BsaXQiLCJwb3AiLCJsZW5ndGgiLCJyZWFkU3RyZWFtIiwicGlwZSIsImFkZEdyb3VwIiwiYWRkIiwidHlwZSIsInZhbHVlcyIsImtleSIsImkxOG5MYWJlbCIsImVuYWJsZVF1ZXJ5IiwiX2lkIiwiRW1vamlDdXN0b20iLCJtb2RlbHMiLCJfQmFzZSIsImNvbnN0cnVjdG9yIiwidHJ5RW5zdXJlSW5kZXgiLCJmaW5kT25lQnlJRCIsIm9wdGlvbnMiLCJmaW5kT25lIiwiZmluZEJ5TmFtZU9yQWxpYXMiLCJxdWVyeSIsIiRvciIsImFsaWFzZXMiLCJmaW5kIiwiZmluZEJ5TmFtZU9yQWxpYXNFeGNlcHRJRCIsImV4Y2VwdCIsIiRuaW4iLCJzZXROYW1lIiwidXBkYXRlIiwiJHNldCIsInNldEFsaWFzZXMiLCJzZXRFeHRlbnNpb24iLCJleHRlbnNpb24iLCJjcmVhdGUiLCJkYXRhIiwiaW5zZXJ0IiwicmVtb3ZlQnlJRCIsInJlbW92ZSIsInMiLCJwdWJsaXNoIiwiZmlsdGVyIiwibGltaXQiLCJ1c2VySWQiLCJyZWFkeSIsImZpZWxkcyIsInNvcnQiLCJmaWx0ZXJSZWciLCJSZWdFeHAiLCJlc2NhcGVSZWdFeHAiLCJtZXRob2RzIiwibGlzdEVtb2ppQ3VzdG9tIiwiZmV0Y2giLCJkZWxldGVFbW9qaUN1c3RvbSIsImVtb2ppSUQiLCJhdXRoeiIsImhhc1Blcm1pc3Npb24iLCJtZXRob2QiLCJkZWxldGVGaWxlIiwiTm90aWZpY2F0aW9ucyIsIm5vdGlmeUxvZ2dlZCIsImVtb2ppRGF0YSIsImluc2VydE9yVXBkYXRlRW1vamkiLCJmaWVsZCIsIm5hbWVWYWxpZGF0aW9uIiwiYWxpYXNWYWxpZGF0aW9uIiwiaW5wdXQiLCJCb29sZWFuIiwid2l0aG91dCIsIm1hdGNoaW5nUmVzdWx0cyIsImFsaWFzIiwiY29uY2F0IiwiY3JlYXRlRW1vamkiLCJuZXdGaWxlIiwicHJldmlvdXNFeHRlbnNpb24iLCJwcmV2aW91c05hbWUiLCJycyIsIndzIiwiY3JlYXRlV3JpdGVTdHJlYW0iLCJjb250ZW50VHlwZSIsIm9uIiwidXBsb2FkRW1vamlDdXN0b20iLCJiaW5hcnlDb250ZW50IiwiQnVmZmVyIiwiYnVmZmVyVG9TdHJlYW0iLCJzZXRUaW1lb3V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQyxDQUNBO0FBQ0FBLFFBQVEsVUFBU0MsRUFBVCxFQUFhO0FBQ3BCLEtBQUlDLEtBQUo7O0FBQ0EsS0FBSTtBQUNIQSxVQUFRRCxJQUFSO0FBQ0EsRUFGRCxDQUVFLE9BQU9FLENBQVAsRUFBVTtBQUNYRCxVQUFRRSxTQUFSO0FBQ0EsRUFKRCxTQUlVO0FBQ1QsU0FBT0YsVUFBVUUsU0FBakI7QUFDQTtBQUNELENBVEQ7O0FBV0FDLGVBQWUsVUFBU0osRUFBVCxFQUFhO0FBQzNCLEtBQUlDLEtBQUo7O0FBQ0EsS0FBSTtBQUNIQSxVQUFRRCxJQUFS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SUFBSTFGLE9BQU9RLEtBQVgsQ0FBaUIsZ0JBQWpCLENBQU47QUFDQSxHQUh1RCxDQUt4RDs7O0FBQ0EsU0FBT29HLFVBQVV0QyxPQUFqQjtBQUNBLFFBQU10QyxPQUFPLElBQUlrRyxNQUFKLENBQVdELGFBQVgsRUFBMEIsUUFBMUIsQ0FBYjtBQUVBLFFBQU1OLEtBQUtwSCxlQUFlNEgsY0FBZixDQUE4Qm5HLElBQTlCLENBQVg7QUFDQWxCLG9DQUFrQzJGLFVBQWxDLENBQTZDdkUsbUJBQW9CLEdBQUcwRSxVQUFVN0YsSUFBTSxJQUFJNkYsVUFBVTVCLFNBQVcsRUFBaEUsQ0FBN0M7QUFDQSxRQUFNNEMsS0FBSzlHLGtDQUFrQytHLGlCQUFsQyxDQUFvRDNGLG1CQUFvQixHQUFHMEUsVUFBVTdGLElBQU0sSUFBSTZGLFVBQVU1QixTQUFXLEVBQWhFLENBQXBELEVBQXdIOEMsV0FBeEgsQ0FBWDtBQUNBRixLQUFHRyxFQUFILENBQU0sS0FBTixFQUFhL0gsT0FBT29CLGVBQVAsQ0FBdUIsTUFDbkNwQixPQUFPb0ksVUFBUCxDQUFrQixNQUFNakksV0FBV3VHLGFBQVgsQ0FBeUJDLFlBQXpCLENBQXNDLG1CQUF0QyxFQUEyRDtBQUFDQztBQUFELEdBQTNELENBQXhCLEVBQWlHLEdBQWpHLENBRFksQ0FBYjtBQUlBZSxLQUFHekUsSUFBSCxDQUFRMEUsRUFBUjtBQUNBOztBQWxCYSxDQUFmLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfZW1vamktY3VzdG9tLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBpc1NldDp0cnVlLCBpc1NldE5vdE51bGw6dHJ1ZSAqL1xuLy9odHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yNjk5MDM0NyBmdW5jdGlvbiBpc1NldCgpIGZyb20gR2FqdXNcbmlzU2V0ID0gZnVuY3Rpb24oZm4pIHtcblx0bGV0IHZhbHVlO1xuXHR0cnkge1xuXHRcdHZhbHVlID0gZm4oKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHR9IGZpbmFsbHkge1xuXHRcdHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkO1xuXHR9XG59O1xuXG5pc1NldE5vdE51bGwgPSBmdW5jdGlvbihmbikge1xuXHRsZXQgdmFsdWU7XG5cdHRyeSB7XG5cdFx0dmFsdWUgPSBmbigpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0dmFsdWUgPSBudWxsO1xuXHR9IGZpbmFsbHkge1xuXHRcdHJldHVybiB2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkO1xuXHR9XG59O1xuXG4vKiBleHBvcnRlZCBpc1NldCwgaXNTZXROb3ROdWxsICovXG4iLCIvKiBnbG9iYWxzIFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZSAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbk1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRsZXQgc3RvcmVUeXBlID0gJ0dyaWRGUyc7XG5cblx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdFbW9qaVVwbG9hZF9TdG9yYWdlX1R5cGUnKSkge1xuXHRcdHN0b3JlVHlwZSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdFbW9qaVVwbG9hZF9TdG9yYWdlX1R5cGUnKTtcblx0fVxuXG5cdGNvbnN0IFJvY2tldENoYXRTdG9yZSA9IFJvY2tldENoYXRGaWxlW3N0b3JlVHlwZV07XG5cblx0aWYgKFJvY2tldENoYXRTdG9yZSA9PSBudWxsKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFJvY2tldENoYXRTdG9yZSB0eXBlIFskeyBzdG9yZVR5cGUgfV1gKTtcblx0fVxuXG5cdGNvbnNvbGUubG9nKGBVc2luZyAkeyBzdG9yZVR5cGUgfSBmb3IgY3VzdG9tIGVtb2ppIHN0b3JhZ2VgLmdyZWVuKTtcblxuXHRsZXQgcGF0aCA9ICd+L3VwbG9hZHMnO1xuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0Vtb2ppVXBsb2FkX0ZpbGVTeXN0ZW1QYXRoJykgIT0gbnVsbCkge1xuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRW1vamlVcGxvYWRfRmlsZVN5c3RlbVBhdGgnKS50cmltKCkgIT09ICcnKSB7XG5cdFx0XHRwYXRoID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0Vtb2ppVXBsb2FkX0ZpbGVTeXN0ZW1QYXRoJyk7XG5cdFx0fVxuXHR9XG5cblx0dGhpcy5Sb2NrZXRDaGF0RmlsZUVtb2ppQ3VzdG9tSW5zdGFuY2UgPSBuZXcgUm9ja2V0Q2hhdFN0b3JlKHtcblx0XHRuYW1lOiAnY3VzdG9tX2Vtb2ppJyxcblx0XHRhYnNvbHV0ZVBhdGg6IHBhdGhcblx0fSk7XG5cblx0cmV0dXJuIFdlYkFwcC5jb25uZWN0SGFuZGxlcnMudXNlKCcvZW1vamktY3VzdG9tLycsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24ocmVxLCByZXMvKiwgbmV4dCovKSB7XG5cdFx0Y29uc3QgcGFyYW1zID1cblx0XHRcdHtlbW9qaTogZGVjb2RlVVJJQ29tcG9uZW50KHJlcS51cmwucmVwbGFjZSgvXlxcLy8sICcnKS5yZXBsYWNlKC9cXD8uKiQvLCAnJykpfTtcblxuXHRcdGlmIChfLmlzRW1wdHkocGFyYW1zLmVtb2ppKSkge1xuXHRcdFx0cmVzLndyaXRlSGVhZCg0MDMpO1xuXHRcdFx0cmVzLndyaXRlKCdGb3JiaWRkZW4nKTtcblx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlID0gUm9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlLmdldEZpbGVXaXRoUmVhZFN0cmVhbShlbmNvZGVVUklDb21wb25lbnQocGFyYW1zLmVtb2ppKSk7XG5cblx0XHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJywgJ2lubGluZScpO1xuXG5cdFx0aWYgKGZpbGUgPT0gbnVsbCkge1xuXHRcdFx0Ly91c2UgY29kZSBmcm9tIHVzZXJuYW1lIGluaXRpYWxzIHJlbmRlcmVyIHVudGlsIGZpbGUgdXBsb2FkIGlzIGNvbXBsZXRlXG5cdFx0XHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnaW1hZ2Uvc3ZnK3htbCcpO1xuXHRcdFx0cmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICdwdWJsaWMsIG1heC1hZ2U9MCcpO1xuXHRcdFx0cmVzLnNldEhlYWRlcignRXhwaXJlcycsICctMScpO1xuXHRcdFx0cmVzLnNldEhlYWRlcignTGFzdC1Nb2RpZmllZCcsICdUaHUsIDAxIEphbiAyMDE1IDAwOjAwOjAwIEdNVCcpO1xuXG5cdFx0XHRjb25zdCByZXFNb2RpZmllZEhlYWRlciA9IHJlcS5oZWFkZXJzWydpZi1tb2RpZmllZC1zaW5jZSddO1xuXHRcdFx0aWYgKHJlcU1vZGlmaWVkSGVhZGVyICE9IG51bGwpIHtcblx0XHRcdFx0aWYgKHJlcU1vZGlmaWVkSGVhZGVyID09PSAnVGh1LCAwMSBKYW4gMjAxNSAwMDowMDowMCBHTVQnKSB7XG5cdFx0XHRcdFx0cmVzLndyaXRlSGVhZCgzMDQpO1xuXHRcdFx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29sb3IgPSAnIzAwMCc7XG5cdFx0XHRjb25zdCBpbml0aWFscyA9ICc/JztcblxuXHRcdFx0Y29uc3Qgc3ZnID0gYDw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCIgc3RhbmRhbG9uZT1cIm5vXCI/PlxuPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgcG9pbnRlci1ldmVudHM9XCJub25lXCIgd2lkdGg9XCI1MFwiIGhlaWdodD1cIjUwXCIgc3R5bGU9XCJ3aWR0aDogNTBweDsgaGVpZ2h0OiA1MHB4OyBiYWNrZ3JvdW5kLWNvbG9yOiAkeyBjb2xvciB9O1wiPlxuXHQ8dGV4dCB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIHk9XCI1MCVcIiB4PVwiNTAlXCIgZHk9XCIwLjM2ZW1cIiBwb2ludGVyLWV2ZW50cz1cImF1dG9cIiBmaWxsPVwiI2ZmZmZmZlwiIGZvbnQtZmFtaWx5PVwiSGVsdmV0aWNhLCBBcmlhbCwgTHVjaWRhIEdyYW5kZSwgc2Fucy1zZXJpZlwiIHN0eWxlPVwiZm9udC13ZWlnaHQ6IDQwMDsgZm9udC1zaXplOiAyOHB4O1wiPlxuXHRcdCR7IGluaXRpYWxzIH1cblx0PC90ZXh0PlxuPC9zdmc+YDtcblxuXHRcdFx0cmVzLndyaXRlKHN2Zyk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGZpbGVVcGxvYWREYXRlID0gdW5kZWZpbmVkO1xuXHRcdGlmIChmaWxlLnVwbG9hZERhdGUgIT0gbnVsbCkge1xuXHRcdFx0ZmlsZVVwbG9hZERhdGUgPSBmaWxlLnVwbG9hZERhdGUudG9VVENTdHJpbmcoKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXFNb2RpZmllZEhlYWRlciA9IHJlcS5oZWFkZXJzWydpZi1tb2RpZmllZC1zaW5jZSddO1xuXHRcdGlmIChyZXFNb2RpZmllZEhlYWRlciAhPSBudWxsKSB7XG5cdFx0XHRpZiAocmVxTW9kaWZpZWRIZWFkZXIgPT09IGZpbGVVcGxvYWREYXRlKSB7XG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnLCByZXFNb2RpZmllZEhlYWRlcik7XG5cdFx0XHRcdHJlcy53cml0ZUhlYWQoMzA0KTtcblx0XHRcdFx0cmVzLmVuZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICdwdWJsaWMsIG1heC1hZ2U9MCcpO1xuXHRcdHJlcy5zZXRIZWFkZXIoJ0V4cGlyZXMnLCAnLTEnKTtcblx0XHRpZiAoZmlsZVVwbG9hZERhdGUgIT0gbnVsbCkge1xuXHRcdFx0cmVzLnNldEhlYWRlcignTGFzdC1Nb2RpZmllZCcsIGZpbGVVcGxvYWREYXRlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzLnNldEhlYWRlcignTGFzdC1Nb2RpZmllZCcsIG5ldyBEYXRlKCkudG9VVENTdHJpbmcoKSk7XG5cdFx0fVxuXHRcdGlmICgvXnN2ZyQvaS50ZXN0KHBhcmFtcy5lbW9qaS5zcGxpdCgnLicpLnBvcCgpKSkge1xuXHRcdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2ltYWdlL3N2Zyt4bWwnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2ltYWdlL2pwZWcnKTtcblx0XHR9XG5cdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1MZW5ndGgnLCBmaWxlLmxlbmd0aCk7XG5cblx0XHRmaWxlLnJlYWRTdHJlYW0ucGlwZShyZXMpO1xuXHR9KSk7XG59KTtcbiIsIlJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ0Vtb2ppQ3VzdG9tRmlsZXN5c3RlbScsIGZ1bmN0aW9uKCkge1xuXHR0aGlzLmFkZCgnRW1vamlVcGxvYWRfU3RvcmFnZV9UeXBlJywgJ0dyaWRGUycsIHtcblx0XHR0eXBlOiAnc2VsZWN0Jyxcblx0XHR2YWx1ZXM6IFt7XG5cdFx0XHRrZXk6ICdHcmlkRlMnLFxuXHRcdFx0aTE4bkxhYmVsOiAnR3JpZEZTJ1xuXHRcdH0sIHtcblx0XHRcdGtleTogJ0ZpbGVTeXN0ZW0nLFxuXHRcdFx0aTE4bkxhYmVsOiAnRmlsZVN5c3RlbSdcblx0XHR9XSxcblx0XHRpMThuTGFiZWw6ICdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZSdcblx0fSk7XG5cblx0dGhpcy5hZGQoJ0Vtb2ppVXBsb2FkX0ZpbGVTeXN0ZW1QYXRoJywgJycsIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRlbmFibGVRdWVyeToge1xuXHRcdFx0X2lkOiAnRW1vamlVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdHZhbHVlOiAnRmlsZVN5c3RlbSdcblx0XHR9LFxuXHRcdGkxOG5MYWJlbDogJ0ZpbGVVcGxvYWRfRmlsZVN5c3RlbVBhdGgnXG5cdH0pO1xufSk7XG4iLCJjbGFzcyBFbW9qaUN1c3RvbSBleHRlbmRzIFJvY2tldENoYXQubW9kZWxzLl9CYXNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ2N1c3RvbV9lbW9qaScpO1xuXG5cdFx0dGhpcy50cnlFbnN1cmVJbmRleCh7ICduYW1lJzogMSB9KTtcblx0XHR0aGlzLnRyeUVuc3VyZUluZGV4KHsgJ2FsaWFzZXMnOiAxIH0pO1xuXHRcdHRoaXMudHJ5RW5zdXJlSW5kZXgoeyAnZXh0ZW5zaW9uJzogMX0pO1xuXHR9XG5cblx0Ly9maW5kIG9uZVxuXHRmaW5kT25lQnlJRChfaWQsIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gdGhpcy5maW5kT25lKF9pZCwgb3B0aW9ucyk7XG5cdH1cblxuXHQvL2ZpbmRcblx0ZmluZEJ5TmFtZU9yQWxpYXMobmFtZSwgb3B0aW9ucykge1xuXHRcdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdFx0JG9yOiBbXG5cdFx0XHRcdHtuYW1lfSxcblx0XHRcdFx0e2FsaWFzZXM6IG5hbWV9XG5cdFx0XHRdXG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLmZpbmQocXVlcnksIG9wdGlvbnMpO1xuXHR9XG5cblx0ZmluZEJ5TmFtZU9yQWxpYXNFeGNlcHRJRChuYW1lLCBleGNlcHQsIG9wdGlvbnMpIHtcblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdF9pZDogeyAkbmluOiBbIGV4Y2VwdCBdIH0sXG5cdFx0XHQkb3I6IFtcblx0XHRcdFx0e25hbWV9LFxuXHRcdFx0XHR7YWxpYXNlczogbmFtZX1cblx0XHRcdF1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuZmluZChxdWVyeSwgb3B0aW9ucyk7XG5cdH1cblxuXG5cdC8vdXBkYXRlXG5cdHNldE5hbWUoX2lkLCBuYW1lKSB7XG5cdFx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRuYW1lXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLnVwZGF0ZSh7X2lkfSwgdXBkYXRlKTtcblx0fVxuXG5cdHNldEFsaWFzZXMoX2lkLCBhbGlhc2VzKSB7XG5cdFx0Y29uc3QgdXBkYXRlID0ge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHRhbGlhc2VzXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLnVwZGF0ZSh7X2lkfSwgdXBkYXRlKTtcblx0fVxuXG5cdHNldEV4dGVuc2lvbihfaWQsIGV4dGVuc2lvbikge1xuXHRcdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0ZXh0ZW5zaW9uXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLnVwZGF0ZSh7X2lkfSwgdXBkYXRlKTtcblx0fVxuXG5cdC8vIElOU0VSVFxuXHRjcmVhdGUoZGF0YSkge1xuXHRcdHJldHVybiB0aGlzLmluc2VydChkYXRhKTtcblx0fVxuXG5cblx0Ly8gUkVNT1ZFXG5cdHJlbW92ZUJ5SUQoX2lkKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlKF9pZCk7XG5cdH1cbn1cblxuUm9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20gPSBuZXcgRW1vamlDdXN0b20oKTtcbiIsImltcG9ydCBzIGZyb20gJ3VuZGVyc2NvcmUuc3RyaW5nJztcblxuTWV0ZW9yLnB1Ymxpc2goJ2Z1bGxFbW9qaURhdGEnLCBmdW5jdGlvbihmaWx0ZXIsIGxpbWl0KSB7XG5cdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWFkeSgpO1xuXHR9XG5cblx0Y29uc3QgZmllbGRzID0ge1xuXHRcdG5hbWU6IDEsXG5cdFx0YWxpYXNlczogMSxcblx0XHRleHRlbnNpb246IDFcblx0fTtcblxuXHRmaWx0ZXIgPSBzLnRyaW0oZmlsdGVyKTtcblxuXHRjb25zdCBvcHRpb25zID0ge1xuXHRcdGZpZWxkcyxcblx0XHRsaW1pdCxcblx0XHRzb3J0OiB7IG5hbWU6IDEgfVxuXHR9O1xuXG5cdGlmIChmaWx0ZXIpIHtcblx0XHRjb25zdCBmaWx0ZXJSZWcgPSBuZXcgUmVnRXhwKHMuZXNjYXBlUmVnRXhwKGZpbHRlciksICdpJyk7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLkVtb2ppQ3VzdG9tLmZpbmRCeU5hbWVPckFsaWFzKGZpbHRlclJlZywgb3B0aW9ucyk7XG5cdH1cblxuXHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20uZmluZCh7fSwgb3B0aW9ucyk7XG59KTtcbiIsIk1ldGVvci5tZXRob2RzKHtcblx0bGlzdEVtb2ppQ3VzdG9tKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVscy5FbW9qaUN1c3RvbS5maW5kKHt9KS5mZXRjaCgpO1xuXHR9XG59KTtcbiIsIi8qIGdsb2JhbHMgUm9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlICovXG5NZXRlb3IubWV0aG9kcyh7XG5cdGRlbGV0ZUVtb2ppQ3VzdG9tKGVtb2ppSUQpIHtcblx0XHRsZXQgZW1vamkgPSBudWxsO1xuXG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1lbW9qaScpKSB7XG5cdFx0XHRlbW9qaSA9IFJvY2tldENoYXQubW9kZWxzLkVtb2ppQ3VzdG9tLmZpbmRPbmVCeUlEKGVtb2ppSUQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcpO1xuXHRcdH1cblxuXHRcdGlmIChlbW9qaSA9PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdDdXN0b21fRW1vamlfRXJyb3JfSW52YWxpZF9FbW9qaScsICdJbnZhbGlkIGVtb2ppJywgeyBtZXRob2Q6ICdkZWxldGVFbW9qaUN1c3RvbScgfSk7XG5cdFx0fVxuXG5cdFx0Um9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlLmRlbGV0ZUZpbGUoZW5jb2RlVVJJQ29tcG9uZW50KGAkeyBlbW9qaS5uYW1lIH0uJHsgZW1vamkuZXh0ZW5zaW9uIH1gKSk7XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20ucmVtb3ZlQnlJRChlbW9qaUlEKTtcblx0XHRSb2NrZXRDaGF0Lk5vdGlmaWNhdGlvbnMubm90aWZ5TG9nZ2VkKCdkZWxldGVFbW9qaUN1c3RvbScsIHtlbW9qaURhdGE6IGVtb2ppfSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZSAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5pbXBvcnQgcyBmcm9tICd1bmRlcnNjb3JlLnN0cmluZyc7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0aW5zZXJ0T3JVcGRhdGVFbW9qaShlbW9qaURhdGEpIHtcblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbih0aGlzLnVzZXJJZCwgJ21hbmFnZS1lbW9qaScpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3RfYXV0aG9yaXplZCcpO1xuXHRcdH1cblxuXHRcdGlmICghcy50cmltKGVtb2ppRGF0YS5uYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItdGhlLWZpZWxkLWlzLXJlcXVpcmVkJywgJ1RoZSBmaWVsZCBOYW1lIGlzIHJlcXVpcmVkJywgeyBtZXRob2Q6ICdpbnNlcnRPclVwZGF0ZUVtb2ppJywgZmllbGQ6ICdOYW1lJyB9KTtcblx0XHR9XG5cblx0XHQvL2FsbG93IGFsbCBjaGFyYWN0ZXJzIGV4Y2VwdCBjb2xvbiwgd2hpdGVzcGFjZSwgY29tbWEsID4sIDwsICYsIFwiLCAnLCAvLCBcXCwgKCwgKVxuXHRcdC8vbW9yZSBwcmFjdGljYWwgdGhhbiBhbGxvd2luZyBzcGVjaWZpYyBzZXRzIG9mIGNoYXJhY3RlcnM7IGFsc28gYWxsb3dzIGZvcmVpZ24gbGFuZ3VhZ2VzXG5cdFx0Y29uc3QgbmFtZVZhbGlkYXRpb24gPSAvW1xccyw6PjwmXCInXFwvXFxcXFxcKFxcKV0vO1xuXHRcdGNvbnN0IGFsaWFzVmFsaWRhdGlvbiA9IC9bOj48JlxcfFwiJ1xcL1xcXFxcXChcXCldLztcblxuXHRcdC8vc2lsZW50bHkgc3RyaXAgY29sb247IHRoaXMgYWxsb3dzIGZvciB1cGxvYWRpbmcgOmVtb2ppbmFtZTogYXMgZW1vamluYW1lXG5cdFx0ZW1vamlEYXRhLm5hbWUgPSBlbW9qaURhdGEubmFtZS5yZXBsYWNlKC86L2csICcnKTtcblx0XHRlbW9qaURhdGEuYWxpYXNlcyA9IGVtb2ppRGF0YS5hbGlhc2VzLnJlcGxhY2UoLzovZywgJycpO1xuXG5cdFx0aWYgKG5hbWVWYWxpZGF0aW9uLnRlc3QoZW1vamlEYXRhLm5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnB1dC1pcy1ub3QtYS12YWxpZC1maWVsZCcsIGAkeyBlbW9qaURhdGEubmFtZSB9IGlzIG5vdCBhIHZhbGlkIG5hbWVgLCB7IG1ldGhvZDogJ2luc2VydE9yVXBkYXRlRW1vamknLCBpbnB1dDogZW1vamlEYXRhLm5hbWUsIGZpZWxkOiAnTmFtZScgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKGVtb2ppRGF0YS5hbGlhc2VzKSB7XG5cdFx0XHRpZiAoYWxpYXNWYWxpZGF0aW9uLnRlc3QoZW1vamlEYXRhLmFsaWFzZXMpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWlucHV0LWlzLW5vdC1hLXZhbGlkLWZpZWxkJywgYCR7IGVtb2ppRGF0YS5hbGlhc2VzIH0gaXMgbm90IGEgdmFsaWQgYWxpYXMgc2V0YCwgeyBtZXRob2Q6ICdpbnNlcnRPclVwZGF0ZUVtb2ppJywgaW5wdXQ6IGVtb2ppRGF0YS5hbGlhc2VzLCBmaWVsZDogJ0FsaWFzX1NldCcgfSk7XG5cdFx0XHR9XG5cdFx0XHRlbW9qaURhdGEuYWxpYXNlcyA9IGVtb2ppRGF0YS5hbGlhc2VzLnNwbGl0KC9bXFxzLF0vKTtcblx0XHRcdGVtb2ppRGF0YS5hbGlhc2VzID0gZW1vamlEYXRhLmFsaWFzZXMuZmlsdGVyKEJvb2xlYW4pO1xuXHRcdFx0ZW1vamlEYXRhLmFsaWFzZXMgPSBfLndpdGhvdXQoZW1vamlEYXRhLmFsaWFzZXMsIGVtb2ppRGF0YS5uYW1lKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZW1vamlEYXRhLmFsaWFzZXMgPSBbXTtcblx0XHR9XG5cblx0XHRsZXQgbWF0Y2hpbmdSZXN1bHRzID0gW107XG5cblx0XHRpZiAoZW1vamlEYXRhLl9pZCkge1xuXHRcdFx0bWF0Y2hpbmdSZXN1bHRzID0gUm9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20uZmluZEJ5TmFtZU9yQWxpYXNFeGNlcHRJRChlbW9qaURhdGEubmFtZSwgZW1vamlEYXRhLl9pZCkuZmV0Y2goKTtcblx0XHRcdGZvciAoY29uc3QgYWxpYXMgb2YgZW1vamlEYXRhLmFsaWFzZXMpIHtcblx0XHRcdFx0bWF0Y2hpbmdSZXN1bHRzID0gbWF0Y2hpbmdSZXN1bHRzLmNvbmNhdChSb2NrZXRDaGF0Lm1vZGVscy5FbW9qaUN1c3RvbS5maW5kQnlOYW1lT3JBbGlhc0V4Y2VwdElEKGFsaWFzLCBlbW9qaURhdGEuX2lkKS5mZXRjaCgpKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0bWF0Y2hpbmdSZXN1bHRzID0gUm9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20uZmluZEJ5TmFtZU9yQWxpYXMoZW1vamlEYXRhLm5hbWUpLmZldGNoKCk7XG5cdFx0XHRmb3IgKGNvbnN0IGFsaWFzIG9mIGVtb2ppRGF0YS5hbGlhc2VzKSB7XG5cdFx0XHRcdG1hdGNoaW5nUmVzdWx0cyA9IG1hdGNoaW5nUmVzdWx0cy5jb25jYXQoUm9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20uZmluZEJ5TmFtZU9yQWxpYXMoYWxpYXMpLmZldGNoKCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChtYXRjaGluZ1Jlc3VsdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignQ3VzdG9tX0Vtb2ppX0Vycm9yX05hbWVfT3JfQWxpYXNfQWxyZWFkeV9Jbl9Vc2UnLCAnVGhlIGN1c3RvbSBlbW9qaSBvciBvbmUgb2YgaXRzIGFsaWFzZXMgaXMgYWxyZWFkeSBpbiB1c2UnLCB7IG1ldGhvZDogJ2luc2VydE9yVXBkYXRlRW1vamknIH0pO1xuXHRcdH1cblxuXHRcdGlmICghZW1vamlEYXRhLl9pZCkge1xuXHRcdFx0Ly9pbnNlcnQgZW1vamlcblx0XHRcdGNvbnN0IGNyZWF0ZUVtb2ppID0ge1xuXHRcdFx0XHRuYW1lOiBlbW9qaURhdGEubmFtZSxcblx0XHRcdFx0YWxpYXNlczogZW1vamlEYXRhLmFsaWFzZXMsXG5cdFx0XHRcdGV4dGVuc2lvbjogZW1vamlEYXRhLmV4dGVuc2lvblxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgX2lkID0gUm9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20uY3JlYXRlKGNyZWF0ZUVtb2ppKTtcblxuXHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeUxvZ2dlZCgndXBkYXRlRW1vamlDdXN0b20nLCB7ZW1vamlEYXRhOiBjcmVhdGVFbW9qaX0pO1xuXG5cdFx0XHRyZXR1cm4gX2lkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvL3VwZGF0ZSBlbW9qaVxuXHRcdFx0aWYgKGVtb2ppRGF0YS5uZXdGaWxlKSB7XG5cdFx0XHRcdFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZS5kZWxldGVGaWxlKGVuY29kZVVSSUNvbXBvbmVudChgJHsgZW1vamlEYXRhLm5hbWUgfS4keyBlbW9qaURhdGEuZXh0ZW5zaW9uIH1gKSk7XG5cdFx0XHRcdFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZS5kZWxldGVGaWxlKGVuY29kZVVSSUNvbXBvbmVudChgJHsgZW1vamlEYXRhLm5hbWUgfS4keyBlbW9qaURhdGEucHJldmlvdXNFeHRlbnNpb24gfWApKTtcblx0XHRcdFx0Um9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlLmRlbGV0ZUZpbGUoZW5jb2RlVVJJQ29tcG9uZW50KGAkeyBlbW9qaURhdGEucHJldmlvdXNOYW1lIH0uJHsgZW1vamlEYXRhLmV4dGVuc2lvbiB9YCkpO1xuXHRcdFx0XHRSb2NrZXRDaGF0RmlsZUVtb2ppQ3VzdG9tSW5zdGFuY2UuZGVsZXRlRmlsZShlbmNvZGVVUklDb21wb25lbnQoYCR7IGVtb2ppRGF0YS5wcmV2aW91c05hbWUgfS4keyBlbW9qaURhdGEucHJldmlvdXNFeHRlbnNpb24gfWApKTtcblxuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5FbW9qaUN1c3RvbS5zZXRFeHRlbnNpb24oZW1vamlEYXRhLl9pZCwgZW1vamlEYXRhLmV4dGVuc2lvbik7XG5cdFx0XHR9IGVsc2UgaWYgKGVtb2ppRGF0YS5uYW1lICE9PSBlbW9qaURhdGEucHJldmlvdXNOYW1lKSB7XG5cdFx0XHRcdGNvbnN0IHJzID0gUm9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlLmdldEZpbGVXaXRoUmVhZFN0cmVhbShlbmNvZGVVUklDb21wb25lbnQoYCR7IGVtb2ppRGF0YS5wcmV2aW91c05hbWUgfS4keyBlbW9qaURhdGEucHJldmlvdXNFeHRlbnNpb24gfWApKTtcblx0XHRcdFx0aWYgKHJzICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlLmRlbGV0ZUZpbGUoZW5jb2RlVVJJQ29tcG9uZW50KGAkeyBlbW9qaURhdGEubmFtZSB9LiR7IGVtb2ppRGF0YS5leHRlbnNpb24gfWApKTtcblx0XHRcdFx0XHRjb25zdCB3cyA9IFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZS5jcmVhdGVXcml0ZVN0cmVhbShlbmNvZGVVUklDb21wb25lbnQoYCR7IGVtb2ppRGF0YS5uYW1lIH0uJHsgZW1vamlEYXRhLnByZXZpb3VzRXh0ZW5zaW9uIH1gKSwgcnMuY29udGVudFR5cGUpO1xuXHRcdFx0XHRcdHdzLm9uKCdlbmQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+XG5cdFx0XHRcdFx0XHRSb2NrZXRDaGF0RmlsZUVtb2ppQ3VzdG9tSW5zdGFuY2UuZGVsZXRlRmlsZShlbmNvZGVVUklDb21wb25lbnQoYCR7IGVtb2ppRGF0YS5wcmV2aW91c05hbWUgfS4keyBlbW9qaURhdGEucHJldmlvdXNFeHRlbnNpb24gfWApKVxuXHRcdFx0XHRcdCkpO1xuXHRcdFx0XHRcdHJzLnJlYWRTdHJlYW0ucGlwZSh3cyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGVtb2ppRGF0YS5uYW1lICE9PSBlbW9qaURhdGEucHJldmlvdXNOYW1lKSB7XG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLkVtb2ppQ3VzdG9tLnNldE5hbWUoZW1vamlEYXRhLl9pZCwgZW1vamlEYXRhLm5hbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZW1vamlEYXRhLmFsaWFzZXMpIHtcblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuRW1vamlDdXN0b20uc2V0QWxpYXNlcyhlbW9qaURhdGEuX2lkLCBlbW9qaURhdGEuYWxpYXNlcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5FbW9qaUN1c3RvbS5zZXRBbGlhc2VzKGVtb2ppRGF0YS5faWQsIFtdKTtcblx0XHRcdH1cblxuXHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeUxvZ2dlZCgndXBkYXRlRW1vamlDdXN0b20nLCB7ZW1vamlEYXRhfSk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZSAqL1xuTWV0ZW9yLm1ldGhvZHMoe1xuXHR1cGxvYWRFbW9qaUN1c3RvbShiaW5hcnlDb250ZW50LCBjb250ZW50VHlwZSwgZW1vamlEYXRhKSB7XG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24odGhpcy51c2VySWQsICdtYW5hZ2UtZW1vamknKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90X2F1dGhvcml6ZWQnKTtcblx0XHR9XG5cblx0XHQvL2RlbGV0ZSBhbGlhc2VzIGZvciBub3RpZmljYXRpb24gcHVycG9zZXMuIGhlcmUsIGl0IGlzIGEgc3RyaW5nIHJhdGhlciB0aGFuIGFuIGFycmF5XG5cdFx0ZGVsZXRlIGVtb2ppRGF0YS5hbGlhc2VzO1xuXHRcdGNvbnN0IGZpbGUgPSBuZXcgQnVmZmVyKGJpbmFyeUNvbnRlbnQsICdiaW5hcnknKTtcblxuXHRcdGNvbnN0IHJzID0gUm9ja2V0Q2hhdEZpbGUuYnVmZmVyVG9TdHJlYW0oZmlsZSk7XG5cdFx0Um9ja2V0Q2hhdEZpbGVFbW9qaUN1c3RvbUluc3RhbmNlLmRlbGV0ZUZpbGUoZW5jb2RlVVJJQ29tcG9uZW50KGAkeyBlbW9qaURhdGEubmFtZSB9LiR7IGVtb2ppRGF0YS5leHRlbnNpb24gfWApKTtcblx0XHRjb25zdCB3cyA9IFJvY2tldENoYXRGaWxlRW1vamlDdXN0b21JbnN0YW5jZS5jcmVhdGVXcml0ZVN0cmVhbShlbmNvZGVVUklDb21wb25lbnQoYCR7IGVtb2ppRGF0YS5uYW1lIH0uJHsgZW1vamlEYXRhLmV4dGVuc2lvbiB9YCksIGNvbnRlbnRUeXBlKTtcblx0XHR3cy5vbignZW5kJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PlxuXHRcdFx0TWV0ZW9yLnNldFRpbWVvdXQoKCkgPT4gUm9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeUxvZ2dlZCgndXBkYXRlRW1vamlDdXN0b20nLCB7ZW1vamlEYXRhfSksIDUwMClcblx0XHQpKTtcblxuXHRcdHJzLnBpcGUod3MpO1xuXHR9XG59KTtcbiJdfQ==
