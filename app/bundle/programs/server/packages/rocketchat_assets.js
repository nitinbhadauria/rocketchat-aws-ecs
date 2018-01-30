(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RocketChatFile = Package['rocketchat:file'].RocketChatFile;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:assets":{"server":{"assets.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_assets/server/assets.js                                                                 //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let sizeOf;
module.watch(require("image-size"), {
	default(v) {
		sizeOf = v;
	}

}, 1);
let mime;
module.watch(require("mime-type/with-db"), {
	default(v) {
		mime = v;
	}

}, 2);
let crypto;
module.watch(require("crypto"), {
	default(v) {
		crypto = v;
	}

}, 3);
mime.extensions['image/vnd.microsoft.icon'] = ['ico'];
const RocketChatAssetsInstance = new RocketChatFile.GridFS({
	name: 'assets'
});
this.RocketChatAssetsInstance = RocketChatAssetsInstance;
const assets = {
	logo: {
		label: 'logo (svg, png, jpg)',
		defaultUrl: 'images/logo/logo.svg',
		constraints: {
			type: 'image',
			extensions: ['svg', 'png', 'jpg', 'jpeg'],
			width: undefined,
			height: undefined
		}
	},
	favicon_ico: {
		label: 'favicon (ico)',
		defaultUrl: 'favicon.ico',
		constraints: {
			type: 'image',
			extensions: ['ico'],
			width: undefined,
			height: undefined
		}
	},
	favicon: {
		label: 'favicon (svg)',
		defaultUrl: 'images/logo/icon.svg',
		constraints: {
			type: 'image',
			extensions: ['svg'],
			width: undefined,
			height: undefined
		}
	},
	favicon_16: {
		label: 'favicon 16x16 (png)',
		defaultUrl: 'images/logo/favicon-16x16.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 16,
			height: 16
		}
	},
	favicon_32: {
		label: 'favicon 32x32 (png)',
		defaultUrl: 'images/logo/favicon-32x32.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 32,
			height: 32
		}
	},
	favicon_192: {
		label: 'android-chrome 192x192 (png)',
		defaultUrl: 'images/logo/android-chrome-192x192.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 192,
			height: 192
		}
	},
	favicon_512: {
		label: 'android-chrome 512x512 (png)',
		defaultUrl: 'images/logo/512x512.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 512,
			height: 512
		}
	},
	touchicon_180: {
		label: 'apple-touch-icon 180x180 (png)',
		defaultUrl: 'images/logo/apple-touch-icon.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 180,
			height: 180
		}
	},
	touchicon_180_pre: {
		label: 'apple-touch-icon-precomposed 180x180 (png)',
		defaultUrl: 'images/logo/apple-touch-icon-precomposed.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 180,
			height: 180
		}
	},
	tile_144: {
		label: 'mstile 144x144 (png)',
		defaultUrl: 'images/logo/mstile-144x144.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 144,
			height: 144
		}
	},
	tile_150: {
		label: 'mstile 150x150 (png)',
		defaultUrl: 'images/logo/mstile-150x150.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 150,
			height: 150
		}
	},
	tile_310_square: {
		label: 'mstile 310x310 (png)',
		defaultUrl: 'images/logo/mstile-310x310.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 310,
			height: 310
		}
	},
	tile_310_wide: {
		label: 'mstile 310x150 (png)',
		defaultUrl: 'images/logo/mstile-310x150.png',
		constraints: {
			type: 'image',
			extensions: ['png'],
			width: 310,
			height: 150
		}
	},
	safari_pinned: {
		label: 'safari pinned tab (svg)',
		defaultUrl: 'images/logo/safari-pinned-tab.svg',
		constraints: {
			type: 'image',
			extensions: ['svg'],
			width: undefined,
			height: undefined
		}
	}
};
RocketChat.Assets = new class {
	get mime() {
		return mime;
	}

	get assets() {
		return assets;
	}

	setAsset(binaryContent, contentType, asset) {
		if (!assets[asset]) {
			throw new Meteor.Error('error-invalid-asset', 'Invalid asset', {
				function: 'RocketChat.Assets.setAsset'
			});
		}

		const extension = mime.extension(contentType);

		if (assets[asset].constraints.extensions.includes(extension) === false) {
			throw new Meteor.Error(contentType, `Invalid file type: ${contentType}`, {
				function: 'RocketChat.Assets.setAsset',
				errorTitle: 'error-invalid-file-type'
			});
		}

		const file = new Buffer(binaryContent, 'binary');

		if (assets[asset].constraints.width || assets[asset].constraints.height) {
			const dimensions = sizeOf(file);

			if (assets[asset].constraints.width && assets[asset].constraints.width !== dimensions.width) {
				throw new Meteor.Error('error-invalid-file-width', 'Invalid file width', {
					function: 'Invalid file width'
				});
			}

			if (assets[asset].constraints.height && assets[asset].constraints.height !== dimensions.height) {
				throw new Meteor.Error('error-invalid-file-height');
			}
		}

		const rs = RocketChatFile.bufferToStream(file);
		RocketChatAssetsInstance.deleteFile(asset);
		const ws = RocketChatAssetsInstance.createWriteStream(asset, contentType);
		ws.on('end', Meteor.bindEnvironment(function () {
			return Meteor.setTimeout(function () {
				const key = `Assets_${asset}`;
				const value = {
					url: `assets/${asset}.${extension}`,
					defaultUrl: assets[asset].defaultUrl
				};
				RocketChat.settings.updateById(key, value);
				return RocketChat.Assets.processAsset(key, value);
			}, 200);
		}));
		rs.pipe(ws);
	}

	unsetAsset(asset) {
		if (!assets[asset]) {
			throw new Meteor.Error('error-invalid-asset', 'Invalid asset', {
				function: 'RocketChat.Assets.unsetAsset'
			});
		}

		RocketChatAssetsInstance.deleteFile(asset);
		const key = `Assets_${asset}`;
		const value = {
			defaultUrl: assets[asset].defaultUrl
		};
		RocketChat.settings.updateById(key, value);
		RocketChat.Assets.processAsset(key, value);
	}

	refreshClients() {
		return process.emit('message', {
			refresh: 'client'
		});
	}

	processAsset(settingKey, settingValue) {
		if (settingKey.indexOf('Assets_') !== 0) {
			return;
		}

		const assetKey = settingKey.replace(/^Assets_/, '');
		const assetValue = assets[assetKey];

		if (!assetValue) {
			return;
		}

		if (!settingValue || !settingValue.url) {
			assetValue.cache = undefined;
			return;
		}

		const file = RocketChatAssetsInstance.getFileSync(assetKey);

		if (!file) {
			assetValue.cache = undefined;
			return;
		}

		const hash = crypto.createHash('sha1').update(file.buffer).digest('hex');
		const extension = settingValue.url.split('.').pop();
		return assetValue.cache = {
			path: `assets/${assetKey}.${extension}`,
			cacheable: false,
			sourceMapUrl: undefined,
			where: 'client',
			type: 'asset',
			content: file.buffer,
			extension,
			url: `/assets/${assetKey}.${extension}?${hash}`,
			size: file.length,
			uploadDate: file.uploadDate,
			contentType: file.contentType,
			hash
		};
	}

}();
RocketChat.settings.addGroup('Assets');
RocketChat.settings.add('Assets_SvgFavicon_Enable', true, {
	type: 'boolean',
	group: 'Assets',
	i18nLabel: 'Enable_Svg_Favicon'
});

function addAssetToSetting(key, value) {
	return RocketChat.settings.add(`Assets_${key}`, {
		defaultUrl: value.defaultUrl
	}, {
		type: 'asset',
		group: 'Assets',
		fileConstraints: value.constraints,
		i18nLabel: value.label,
		asset: key,
		public: true
	});
}

for (const key of Object.keys(assets)) {
	const value = assets[key];
	addAssetToSetting(key, value);
}

RocketChat.models.Settings.find().observe({
	added(record) {
		return RocketChat.Assets.processAsset(record._id, record.value);
	},

	changed(record) {
		return RocketChat.Assets.processAsset(record._id, record.value);
	},

	removed(record) {
		return RocketChat.Assets.processAsset(record._id, undefined);
	}

});
Meteor.startup(function () {
	return Meteor.setTimeout(function () {
		return process.emit('message', {
			refresh: 'client'
		});
	}, 200);
});
const calculateClientHash = WebAppHashing.calculateClientHash;

WebAppHashing.calculateClientHash = function (manifest, includeFilter, runtimeConfigOverride) {
	for (const key of Object.keys(assets)) {
		const value = assets[key];

		if (!value.cache && !value.defaultUrl) {
			continue;
		}

		let cache = {};

		if (value.cache) {
			cache = {
				path: value.cache.path,
				cacheable: value.cache.cacheable,
				sourceMapUrl: value.cache.sourceMapUrl,
				where: value.cache.where,
				type: value.cache.type,
				url: value.cache.url,
				size: value.cache.size,
				hash: value.cache.hash
			};
			WebAppInternals.staticFiles[`/__cordova/assets/${key}`] = value.cache;
			WebAppInternals.staticFiles[`/__cordova/assets/${key}.${value.cache.extension}`] = value.cache;
		} else {
			const extension = value.defaultUrl.split('.').pop();
			cache = {
				path: `assets/${key}.${extension}`,
				cacheable: false,
				sourceMapUrl: undefined,
				where: 'client',
				type: 'asset',
				url: `/assets/${key}.${extension}?v3`,
				hash: 'v3'
			};
			WebAppInternals.staticFiles[`/__cordova/assets/${key}`] = WebAppInternals.staticFiles[`/__cordova/${value.defaultUrl}`];
			WebAppInternals.staticFiles[`/__cordova/assets/${key}.${extension}`] = WebAppInternals.staticFiles[`/__cordova/${value.defaultUrl}`];
		}

		const manifestItem = _.findWhere(manifest, {
			path: key
		});

		if (manifestItem) {
			const index = manifest.indexOf(manifestItem);
			manifest[index] = cache;
		} else {
			manifest.push(cache);
		}
	}

	return calculateClientHash.call(this, manifest, includeFilter, runtimeConfigOverride);
};

Meteor.methods({
	refreshClients() {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'refreshClients'
			});
		}

		const hasPermission = RocketChat.authz.hasPermission(Meteor.userId(), 'manage-assets');

		if (!hasPermission) {
			throw new Meteor.Error('error-action-now-allowed', 'Managing assets not allowed', {
				method: 'refreshClients',
				action: 'Managing_assets'
			});
		}

		return RocketChat.Assets.refreshClients();
	},

	unsetAsset(asset) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'unsetAsset'
			});
		}

		const hasPermission = RocketChat.authz.hasPermission(Meteor.userId(), 'manage-assets');

		if (!hasPermission) {
			throw new Meteor.Error('error-action-now-allowed', 'Managing assets not allowed', {
				method: 'unsetAsset',
				action: 'Managing_assets'
			});
		}

		return RocketChat.Assets.unsetAsset(asset);
	},

	setAsset(binaryContent, contentType, asset) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'setAsset'
			});
		}

		const hasPermission = RocketChat.authz.hasPermission(Meteor.userId(), 'manage-assets');

		if (!hasPermission) {
			throw new Meteor.Error('error-action-now-allowed', 'Managing assets not allowed', {
				method: 'setAsset',
				action: 'Managing_assets'
			});
		}

		RocketChat.Assets.setAsset(binaryContent, contentType, asset);
	}

});
WebApp.connectHandlers.use('/assets/', Meteor.bindEnvironment(function (req, res, next) {
	const params = {
		asset: decodeURIComponent(req.url.replace(/^\//, '').replace(/\?.*$/, '')).replace(/\.[^.]*$/, '')
	};
	const file = assets[params.asset] && assets[params.asset].cache;

	if (!file) {
		if (assets[params.asset] && assets[params.asset].defaultUrl) {
			req.url = `/${assets[params.asset].defaultUrl}`;
			WebAppInternals.staticFilesMiddleware(WebAppInternals.staticFiles, req, res, next);
		} else {
			res.writeHead(404);
			res.end();
		}

		return;
	}

	const reqModifiedHeader = req.headers['if-modified-since'];

	if (reqModifiedHeader) {
		if (reqModifiedHeader === (file.uploadDate && file.uploadDate.toUTCString())) {
			res.setHeader('Last-Modified', reqModifiedHeader);
			res.writeHead(304);
			res.end();
			return;
		}
	}

	res.setHeader('Cache-Control', 'public, max-age=0');
	res.setHeader('Expires', '-1');
	res.setHeader('Last-Modified', file.uploadDate && file.uploadDate.toUTCString() || new Date().toUTCString());
	res.setHeader('Content-Type', file.contentType);
	res.setHeader('Content-Length', file.size);
	res.writeHead(200);
	res.end(file.content);
}));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"image-size":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// ../../.meteor/local/isopacks/rocketchat_assets/npm/node_modules/image-size/package.json                     //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
exports.name = "image-size";
exports.version = "0.4.0";
exports.main = "lib/index.js";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// node_modules/meteor/rocketchat_assets/node_modules/image-size/lib/index.js                                  //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
'use strict';

var fs = require('fs');
var path = require('path');

var detector = require('./detector');

var handlers = {};
var types = require('./types');

// load all available handlers
types.forEach(function (type) {
  handlers[type] = require('./types/' + type);
});

// Maximum buffer size, with a default of 128 kilobytes.
// TO-DO: make this adaptive based on the initial signature of the image
var MaxBufferSize = 128*1024;

function lookup (buffer, filepath) {
  // detect the file type.. don't rely on the extension
  var type = detector(buffer, filepath);

  // find an appropriate handler for this file type
  if (type in handlers) {
    var size = handlers[type].calculate(buffer, filepath);
    if (size !== false) {
      size.type = type;
      return size;
    }
  }

  // throw up, if we don't understand the file
  throw new TypeError('unsupported file type');
}

function asyncFileToBuffer (filepath, callback) {
  // open the file in read only mode
  fs.open(filepath, 'r', function (err, descriptor) {
    if (err) { return callback(err); }
    var size = fs.fstatSync(descriptor).size;
    var bufferSize = Math.min(size, MaxBufferSize);
    var buffer = new Buffer(bufferSize);
    // read first buffer block from the file, asynchronously
    fs.read(descriptor, buffer, 0, bufferSize, 0, function (err) {
      if (err) { return callback(err); }
      // close the file, we are done
      fs.close(descriptor, function (err) {
        callback(err, buffer);
      });
    });
  });
}

function syncFileToBuffer (filepath) {
  // read from the file, synchronously
  var descriptor = fs.openSync(filepath, 'r');
  var size = fs.fstatSync(descriptor).size;
  var bufferSize = Math.min(size, MaxBufferSize);
  var buffer = new Buffer(bufferSize);
  fs.readSync(descriptor, buffer, 0, bufferSize, 0);
  fs.closeSync(descriptor);
  return buffer;
}

/**
 * @params input - buffer or relative/absolute path of the image file
 * @params callback - optional function for async detection
 */
module.exports = function (input, callback) {

  // Handle buffer input
  if (Buffer.isBuffer(input)) {
    return lookup(input);
  }

  // input should be a string at this point
  if (typeof input !== 'string') {
    throw new TypeError('invalid invocation');
  }

  // resolve the file path
  var filepath = path.resolve(input);

  if (typeof callback === 'function') {
    asyncFileToBuffer(filepath, function (err, buffer) {
      if (err) { return callback(err); }

      // return the dimensions
      var dimensions;
      try {
        dimensions = lookup(buffer, filepath);
      } catch (e) {
        err = e;
      }
      callback(err, dimensions);
    });
  } else {
    var buffer = syncFileToBuffer(filepath);
    return lookup(buffer, filepath);
  }
};

module.exports.types = types;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:assets/server/assets.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:assets'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_assets.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDphc3NldHMvc2VydmVyL2Fzc2V0cy5qcyJdLCJuYW1lcyI6WyJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJzaXplT2YiLCJtaW1lIiwiY3J5cHRvIiwiZXh0ZW5zaW9ucyIsIlJvY2tldENoYXRBc3NldHNJbnN0YW5jZSIsIlJvY2tldENoYXRGaWxlIiwiR3JpZEZTIiwibmFtZSIsImFzc2V0cyIsImxvZ28iLCJsYWJlbCIsImRlZmF1bHRVcmwiLCJjb25zdHJhaW50cyIsInR5cGUiLCJ3aWR0aCIsInVuZGVmaW5lZCIsImhlaWdodCIsImZhdmljb25faWNvIiwiZmF2aWNvbiIsImZhdmljb25fMTYiLCJmYXZpY29uXzMyIiwiZmF2aWNvbl8xOTIiLCJmYXZpY29uXzUxMiIsInRvdWNoaWNvbl8xODAiLCJ0b3VjaGljb25fMTgwX3ByZSIsInRpbGVfMTQ0IiwidGlsZV8xNTAiLCJ0aWxlXzMxMF9zcXVhcmUiLCJ0aWxlXzMxMF93aWRlIiwic2FmYXJpX3Bpbm5lZCIsIlJvY2tldENoYXQiLCJBc3NldHMiLCJzZXRBc3NldCIsImJpbmFyeUNvbnRlbnQiLCJjb250ZW50VHlwZSIsImFzc2V0IiwiTWV0ZW9yIiwiRXJyb3IiLCJmdW5jdGlvbiIsImV4dGVuc2lvbiIsImluY2x1ZGVzIiwiZXJyb3JUaXRsZSIsImZpbGUiLCJCdWZmZXIiLCJkaW1lbnNpb25zIiwicnMiLCJidWZmZXJUb1N0cmVhbSIsImRlbGV0ZUZpbGUiLCJ3cyIsImNyZWF0ZVdyaXRlU3RyZWFtIiwib24iLCJiaW5kRW52aXJvbm1lbnQiLCJzZXRUaW1lb3V0Iiwia2V5IiwidmFsdWUiLCJ1cmwiLCJzZXR0aW5ncyIsInVwZGF0ZUJ5SWQiLCJwcm9jZXNzQXNzZXQiLCJwaXBlIiwidW5zZXRBc3NldCIsInJlZnJlc2hDbGllbnRzIiwicHJvY2VzcyIsImVtaXQiLCJyZWZyZXNoIiwic2V0dGluZ0tleSIsInNldHRpbmdWYWx1ZSIsImluZGV4T2YiLCJhc3NldEtleSIsInJlcGxhY2UiLCJhc3NldFZhbHVlIiwiY2FjaGUiLCJnZXRGaWxlU3luYyIsImhhc2giLCJjcmVhdGVIYXNoIiwidXBkYXRlIiwiYnVmZmVyIiwiZGlnZXN0Iiwic3BsaXQiLCJwb3AiLCJwYXRoIiwiY2FjaGVhYmxlIiwic291cmNlTWFwVXJsIiwid2hlcmUiLCJjb250ZW50Iiwic2l6ZSIsImxlbmd0aCIsInVwbG9hZERhdGUiLCJhZGRHcm91cCIsImFkZCIsImdyb3VwIiwiaTE4bkxhYmVsIiwiYWRkQXNzZXRUb1NldHRpbmciLCJmaWxlQ29uc3RyYWludHMiLCJwdWJsaWMiLCJPYmplY3QiLCJrZXlzIiwibW9kZWxzIiwiU2V0dGluZ3MiLCJmaW5kIiwib2JzZXJ2ZSIsImFkZGVkIiwicmVjb3JkIiwiX2lkIiwiY2hhbmdlZCIsInJlbW92ZWQiLCJzdGFydHVwIiwiY2FsY3VsYXRlQ2xpZW50SGFzaCIsIldlYkFwcEhhc2hpbmciLCJtYW5pZmVzdCIsImluY2x1ZGVGaWx0ZXIiLCJydW50aW1lQ29uZmlnT3ZlcnJpZGUiLCJXZWJBcHBJbnRlcm5hbHMiLCJzdGF0aWNGaWxlcyIsIm1hbmlmZXN0SXRlbSIsImZpbmRXaGVyZSIsImluZGV4IiwicHVzaCIsImNhbGwiLCJtZXRob2RzIiwidXNlcklkIiwibWV0aG9kIiwiaGFzUGVybWlzc2lvbiIsImF1dGh6IiwiYWN0aW9uIiwiV2ViQXBwIiwiY29ubmVjdEhhbmRsZXJzIiwidXNlIiwicmVxIiwicmVzIiwibmV4dCIsInBhcmFtcyIsImRlY29kZVVSSUNvbXBvbmVudCIsInN0YXRpY0ZpbGVzTWlkZGxld2FyZSIsIndyaXRlSGVhZCIsImVuZCIsInJlcU1vZGlmaWVkSGVhZGVyIiwiaGVhZGVycyIsInRvVVRDU3RyaW5nIiwic2V0SGVhZGVyIiwiRGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsQ0FBSjs7QUFB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LFdBQXRELEVBQW1FZSxHQUFuRSxFQUF3RUMsR0FBeEUsRUFBNkVDLElBQTdFO0FBQ0EsR0FIRCxNQUdPO0FBQ05ELE9BQUlLLFNBQUosQ0FBYyxHQUFkO0FBQ0FMLE9BQUlNLEdBQUo7QUFDQTs7QUFFRDtBQUNBOztBQUVELE9BQU1DLG9CQUFvQlIsSUFBSVMsT0FBSixDQUFZLG1CQUFaLENBQTFCOztBQUNBLEtBQUlELGlCQUFKLEVBQXVCO0FBQ3RCLE1BQUlBLHVCQUF1QjlGLEtBQUs2QyxVQUFMLElBQW1CN0MsS0FBSzZDLFVBQUwsQ0FBZ0JtRCxXQUFoQixFQUExQyxDQUFKLEVBQThFO0FBQzdFVCxPQUFJVSxTQUFKLENBQWMsZUFBZCxFQUErQkgsaUJBQS9CO0FBQ0FQLE9BQUlLLFNBQUosQ0FBYyxHQUFkO0FBQ0FMLE9BQUlNLEdBQUo7QUFDQTtBQUNBO0FBQ0Q7O0FBRUROLEtBQUlVLFNBQUosQ0FBYyxlQUFkLEVBQStCLG1CQUEvQjtBQUNBVixLQUFJVSxTQUFKLENBQWMsU0FBZCxFQUF5QixJQUF6QjtBQUNBVixLQUFJVSxTQUFKLENBQWMsZUFBZCxFQUFnQ2pHLEtBQUs2QyxVQUFMLElBQW1CN0MsS0FBSzZDLFVBQUwsQ0FBZ0JtRCxXQUFoQixFQUFwQixJQUFzRCxJQUFJRSxJQUFKLEdBQVdGLFdBQVgsRUFBckY7QUFDQVQsS0FBSVUsU0FBSixDQUFjLGNBQWQsRUFBOEJqRyxLQUFLUixXQUFuQztBQUNBK0YsS0FBSVUsU0FBSixDQUFjLGdCQUFkLEVBQWdDakcsS0FBSzJDLElBQXJDO0FBQ0E0QyxLQUFJSyxTQUFKLENBQWMsR0FBZDtBQUNBTCxLQUFJTSxHQUFKLENBQVE3RixLQUFLMEMsT0FBYjtBQUNBLENBcENzQyxDQUF2QyxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2Fzc2V0cy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBXZWJBcHBIYXNoaW5nLCBXZWJBcHBJbnRlcm5hbHMgKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5pbXBvcnQgc2l6ZU9mIGZyb20gJ2ltYWdlLXNpemUnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlL3dpdGgtZGInO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuXG5taW1lLmV4dGVuc2lvbnNbJ2ltYWdlL3ZuZC5taWNyb3NvZnQuaWNvbiddID0gWydpY28nXTtcblxuY29uc3QgUm9ja2V0Q2hhdEFzc2V0c0luc3RhbmNlID0gbmV3IFJvY2tldENoYXRGaWxlLkdyaWRGUyh7XG5cdG5hbWU6ICdhc3NldHMnXG59KTtcblxudGhpcy5Sb2NrZXRDaGF0QXNzZXRzSW5zdGFuY2UgPSBSb2NrZXRDaGF0QXNzZXRzSW5zdGFuY2U7XG5cbmNvbnN0IGFzc2V0cyA9IHtcblx0bG9nbzoge1xuXHRcdGxhYmVsOiAnbG9nbyAoc3ZnLCBwbmcsIGpwZyknLFxuXHRcdGRlZmF1bHRVcmw6ICdpbWFnZXMvbG9nby9sb2dvLnN2ZycsXG5cdFx0Y29uc3RyYWludHM6IHtcblx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRleHRlbnNpb25zOiBbJ3N2ZycsICdwbmcnLCAnanBnJywgJ2pwZWcnXSxcblx0XHRcdHdpZHRoOiB1bmRlZmluZWQsXG5cdFx0XHRoZWlnaHQ6IHVuZGVmaW5lZFxuXHRcdH1cblx0fSxcblx0ZmF2aWNvbl9pY286IHtcblx0XHRsYWJlbDogJ2Zhdmljb24gKGljbyknLFxuXHRcdGRlZmF1bHRVcmw6ICdmYXZpY29uLmljbycsXG5cdFx0Y29uc3RyYWludHM6IHtcblx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRleHRlbnNpb25zOiBbJ2ljbyddLFxuXHRcdFx0d2lkdGg6IHVuZGVmaW5lZCxcblx0XHRcdGhlaWdodDogdW5kZWZpbmVkXG5cdFx0fVxuXHR9LFxuXHRmYXZpY29uOiB7XG5cdFx0bGFiZWw6ICdmYXZpY29uIChzdmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vaWNvbi5zdmcnLFxuXHRcdGNvbnN0cmFpbnRzOiB7XG5cdFx0XHR0eXBlOiAnaW1hZ2UnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWydzdmcnXSxcblx0XHRcdHdpZHRoOiB1bmRlZmluZWQsXG5cdFx0XHRoZWlnaHQ6IHVuZGVmaW5lZFxuXHRcdH1cblx0fSxcblx0ZmF2aWNvbl8xNjoge1xuXHRcdGxhYmVsOiAnZmF2aWNvbiAxNngxNiAocG5nKScsXG5cdFx0ZGVmYXVsdFVybDogJ2ltYWdlcy9sb2dvL2Zhdmljb24tMTZ4MTYucG5nJyxcblx0XHRjb25zdHJhaW50czoge1xuXHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsncG5nJ10sXG5cdFx0XHR3aWR0aDogMTYsXG5cdFx0XHRoZWlnaHQ6IDE2XG5cdFx0fVxuXHR9LFxuXHRmYXZpY29uXzMyOiB7XG5cdFx0bGFiZWw6ICdmYXZpY29uIDMyeDMyIChwbmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vZmF2aWNvbi0zMngzMi5wbmcnLFxuXHRcdGNvbnN0cmFpbnRzOiB7XG5cdFx0XHR0eXBlOiAnaW1hZ2UnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWydwbmcnXSxcblx0XHRcdHdpZHRoOiAzMixcblx0XHRcdGhlaWdodDogMzJcblx0XHR9XG5cdH0sXG5cdGZhdmljb25fMTkyOiB7XG5cdFx0bGFiZWw6ICdhbmRyb2lkLWNocm9tZSAxOTJ4MTkyIChwbmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vYW5kcm9pZC1jaHJvbWUtMTkyeDE5Mi5wbmcnLFxuXHRcdGNvbnN0cmFpbnRzOiB7XG5cdFx0XHR0eXBlOiAnaW1hZ2UnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWydwbmcnXSxcblx0XHRcdHdpZHRoOiAxOTIsXG5cdFx0XHRoZWlnaHQ6IDE5MlxuXHRcdH1cblx0fSxcblx0ZmF2aWNvbl81MTI6IHtcblx0XHRsYWJlbDogJ2FuZHJvaWQtY2hyb21lIDUxMng1MTIgKHBuZyknLFxuXHRcdGRlZmF1bHRVcmw6ICdpbWFnZXMvbG9nby81MTJ4NTEyLnBuZycsXG5cdFx0Y29uc3RyYWludHM6IHtcblx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRleHRlbnNpb25zOiBbJ3BuZyddLFxuXHRcdFx0d2lkdGg6IDUxMixcblx0XHRcdGhlaWdodDogNTEyXG5cdFx0fVxuXHR9LFxuXHR0b3VjaGljb25fMTgwOiB7XG5cdFx0bGFiZWw6ICdhcHBsZS10b3VjaC1pY29uIDE4MHgxODAgKHBuZyknLFxuXHRcdGRlZmF1bHRVcmw6ICdpbWFnZXMvbG9nby9hcHBsZS10b3VjaC1pY29uLnBuZycsXG5cdFx0Y29uc3RyYWludHM6IHtcblx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRleHRlbnNpb25zOiBbJ3BuZyddLFxuXHRcdFx0d2lkdGg6IDE4MCxcblx0XHRcdGhlaWdodDogMTgwXG5cdFx0fVxuXHR9LFxuXHR0b3VjaGljb25fMTgwX3ByZToge1xuXHRcdGxhYmVsOiAnYXBwbGUtdG91Y2gtaWNvbi1wcmVjb21wb3NlZCAxODB4MTgwIChwbmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vYXBwbGUtdG91Y2gtaWNvbi1wcmVjb21wb3NlZC5wbmcnLFxuXHRcdGNvbnN0cmFpbnRzOiB7XG5cdFx0XHR0eXBlOiAnaW1hZ2UnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWydwbmcnXSxcblx0XHRcdHdpZHRoOiAxODAsXG5cdFx0XHRoZWlnaHQ6IDE4MFxuXHRcdH1cblx0fSxcblx0dGlsZV8xNDQ6IHtcblx0XHRsYWJlbDogJ21zdGlsZSAxNDR4MTQ0IChwbmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vbXN0aWxlLTE0NHgxNDQucG5nJyxcblx0XHRjb25zdHJhaW50czoge1xuXHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsncG5nJ10sXG5cdFx0XHR3aWR0aDogMTQ0LFxuXHRcdFx0aGVpZ2h0OiAxNDRcblx0XHR9XG5cdH0sXG5cdHRpbGVfMTUwOiB7XG5cdFx0bGFiZWw6ICdtc3RpbGUgMTUweDE1MCAocG5nKScsXG5cdFx0ZGVmYXVsdFVybDogJ2ltYWdlcy9sb2dvL21zdGlsZS0xNTB4MTUwLnBuZycsXG5cdFx0Y29uc3RyYWludHM6IHtcblx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRleHRlbnNpb25zOiBbJ3BuZyddLFxuXHRcdFx0d2lkdGg6IDE1MCxcblx0XHRcdGhlaWdodDogMTUwXG5cdFx0fVxuXHR9LFxuXHR0aWxlXzMxMF9zcXVhcmU6IHtcblx0XHRsYWJlbDogJ21zdGlsZSAzMTB4MzEwIChwbmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vbXN0aWxlLTMxMHgzMTAucG5nJyxcblx0XHRjb25zdHJhaW50czoge1xuXHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsncG5nJ10sXG5cdFx0XHR3aWR0aDogMzEwLFxuXHRcdFx0aGVpZ2h0OiAzMTBcblx0XHR9XG5cdH0sXG5cdHRpbGVfMzEwX3dpZGU6IHtcblx0XHRsYWJlbDogJ21zdGlsZSAzMTB4MTUwIChwbmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vbXN0aWxlLTMxMHgxNTAucG5nJyxcblx0XHRjb25zdHJhaW50czoge1xuXHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsncG5nJ10sXG5cdFx0XHR3aWR0aDogMzEwLFxuXHRcdFx0aGVpZ2h0OiAxNTBcblx0XHR9XG5cdH0sXG5cdHNhZmFyaV9waW5uZWQ6IHtcblx0XHRsYWJlbDogJ3NhZmFyaSBwaW5uZWQgdGFiIChzdmcpJyxcblx0XHRkZWZhdWx0VXJsOiAnaW1hZ2VzL2xvZ28vc2FmYXJpLXBpbm5lZC10YWIuc3ZnJyxcblx0XHRjb25zdHJhaW50czoge1xuXHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsnc3ZnJ10sXG5cdFx0XHR3aWR0aDogdW5kZWZpbmVkLFxuXHRcdFx0aGVpZ2h0OiB1bmRlZmluZWRcblx0XHR9XG5cdH1cbn07XG5cblJvY2tldENoYXQuQXNzZXRzID0gbmV3IChjbGFzcyB7XG5cdGdldCBtaW1lKCkge1xuXHRcdHJldHVybiBtaW1lO1xuXHR9XG5cblx0Z2V0IGFzc2V0cygpIHtcblx0XHRyZXR1cm4gYXNzZXRzO1xuXHR9XG5cblx0c2V0QXNzZXQoYmluYXJ5Q29udGVudCwgY29udGVudFR5cGUsIGFzc2V0KSB7XG5cdFx0aWYgKCFhc3NldHNbYXNzZXRdKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWFzc2V0JywgJ0ludmFsaWQgYXNzZXQnLCB7XG5cdFx0XHRcdGZ1bmN0aW9uOiAnUm9ja2V0Q2hhdC5Bc3NldHMuc2V0QXNzZXQnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihjb250ZW50VHlwZSk7XG5cdFx0aWYgKGFzc2V0c1thc3NldF0uY29uc3RyYWludHMuZXh0ZW5zaW9ucy5pbmNsdWRlcyhleHRlbnNpb24pID09PSBmYWxzZSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcihjb250ZW50VHlwZSwgYEludmFsaWQgZmlsZSB0eXBlOiAkeyBjb250ZW50VHlwZSB9YCwge1xuXHRcdFx0XHRmdW5jdGlvbjogJ1JvY2tldENoYXQuQXNzZXRzLnNldEFzc2V0Jyxcblx0XHRcdFx0ZXJyb3JUaXRsZTogJ2Vycm9yLWludmFsaWQtZmlsZS10eXBlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZSA9IG5ldyBCdWZmZXIoYmluYXJ5Q29udGVudCwgJ2JpbmFyeScpO1xuXHRcdGlmIChhc3NldHNbYXNzZXRdLmNvbnN0cmFpbnRzLndpZHRoIHx8IGFzc2V0c1thc3NldF0uY29uc3RyYWludHMuaGVpZ2h0KSB7XG5cdFx0XHRjb25zdCBkaW1lbnNpb25zID0gc2l6ZU9mKGZpbGUpO1xuXHRcdFx0aWYgKGFzc2V0c1thc3NldF0uY29uc3RyYWludHMud2lkdGggJiYgYXNzZXRzW2Fzc2V0XS5jb25zdHJhaW50cy53aWR0aCAhPT0gZGltZW5zaW9ucy53aWR0aCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWZpbGUtd2lkdGgnLCAnSW52YWxpZCBmaWxlIHdpZHRoJywge1xuXHRcdFx0XHRcdGZ1bmN0aW9uOiAnSW52YWxpZCBmaWxlIHdpZHRoJ1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGlmIChhc3NldHNbYXNzZXRdLmNvbnN0cmFpbnRzLmhlaWdodCAmJiBhc3NldHNbYXNzZXRdLmNvbnN0cmFpbnRzLmhlaWdodCAhPT0gZGltZW5zaW9ucy5oZWlnaHQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1maWxlLWhlaWdodCcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJzID0gUm9ja2V0Q2hhdEZpbGUuYnVmZmVyVG9TdHJlYW0oZmlsZSk7XG5cdFx0Um9ja2V0Q2hhdEFzc2V0c0luc3RhbmNlLmRlbGV0ZUZpbGUoYXNzZXQpO1xuXG5cdFx0Y29uc3Qgd3MgPSBSb2NrZXRDaGF0QXNzZXRzSW5zdGFuY2UuY3JlYXRlV3JpdGVTdHJlYW0oYXNzZXQsIGNvbnRlbnRUeXBlKTtcblx0XHR3cy5vbignZW5kJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBNZXRlb3Iuc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gYEFzc2V0c18keyBhc3NldCB9YDtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSB7XG5cdFx0XHRcdFx0dXJsOiBgYXNzZXRzLyR7IGFzc2V0IH0uJHsgZXh0ZW5zaW9uIH1gLFxuXHRcdFx0XHRcdGRlZmF1bHRVcmw6IGFzc2V0c1thc3NldF0uZGVmYXVsdFVybFxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlQnlJZChrZXksIHZhbHVlKTtcblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuQXNzZXRzLnByb2Nlc3NBc3NldChrZXksIHZhbHVlKTtcblx0XHRcdH0sIDIwMCk7XG5cdFx0fSkpO1xuXG5cdFx0cnMucGlwZSh3cyk7XG5cdH1cblxuXHR1bnNldEFzc2V0KGFzc2V0KSB7XG5cdFx0aWYgKCFhc3NldHNbYXNzZXRdKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWFzc2V0JywgJ0ludmFsaWQgYXNzZXQnLCB7XG5cdFx0XHRcdGZ1bmN0aW9uOiAnUm9ja2V0Q2hhdC5Bc3NldHMudW5zZXRBc3NldCdcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdFJvY2tldENoYXRBc3NldHNJbnN0YW5jZS5kZWxldGVGaWxlKGFzc2V0KTtcblx0XHRjb25zdCBrZXkgPSBgQXNzZXRzXyR7IGFzc2V0IH1gO1xuXHRcdGNvbnN0IHZhbHVlID0ge1xuXHRcdFx0ZGVmYXVsdFVybDogYXNzZXRzW2Fzc2V0XS5kZWZhdWx0VXJsXG5cdFx0fTtcblxuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlQnlJZChrZXksIHZhbHVlKTtcblx0XHRSb2NrZXRDaGF0LkFzc2V0cy5wcm9jZXNzQXNzZXQoa2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRyZWZyZXNoQ2xpZW50cygpIHtcblx0XHRyZXR1cm4gcHJvY2Vzcy5lbWl0KCdtZXNzYWdlJywge1xuXHRcdFx0cmVmcmVzaDogJ2NsaWVudCdcblx0XHR9KTtcblx0fVxuXG5cdHByb2Nlc3NBc3NldChzZXR0aW5nS2V5LCBzZXR0aW5nVmFsdWUpIHtcblx0XHRpZiAoc2V0dGluZ0tleS5pbmRleE9mKCdBc3NldHNfJykgIT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhc3NldEtleSA9IHNldHRpbmdLZXkucmVwbGFjZSgvXkFzc2V0c18vLCAnJyk7XG5cdFx0Y29uc3QgYXNzZXRWYWx1ZSA9IGFzc2V0c1thc3NldEtleV07XG5cblx0XHRpZiAoIWFzc2V0VmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXNldHRpbmdWYWx1ZSB8fCAhc2V0dGluZ1ZhbHVlLnVybCkge1xuXHRcdFx0YXNzZXRWYWx1ZS5jYWNoZSA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlID0gUm9ja2V0Q2hhdEFzc2V0c0luc3RhbmNlLmdldEZpbGVTeW5jKGFzc2V0S2V5KTtcblx0XHRpZiAoIWZpbGUpIHtcblx0XHRcdGFzc2V0VmFsdWUuY2FjaGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGExJykudXBkYXRlKGZpbGUuYnVmZmVyKS5kaWdlc3QoJ2hleCcpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbiA9IHNldHRpbmdWYWx1ZS51cmwuc3BsaXQoJy4nKS5wb3AoKTtcblxuXHRcdHJldHVybiBhc3NldFZhbHVlLmNhY2hlID0ge1xuXHRcdFx0cGF0aDogYGFzc2V0cy8keyBhc3NldEtleSB9LiR7IGV4dGVuc2lvbiB9YCxcblx0XHRcdGNhY2hlYWJsZTogZmFsc2UsXG5cdFx0XHRzb3VyY2VNYXBVcmw6IHVuZGVmaW5lZCxcblx0XHRcdHdoZXJlOiAnY2xpZW50Jyxcblx0XHRcdHR5cGU6ICdhc3NldCcsXG5cdFx0XHRjb250ZW50OiBmaWxlLmJ1ZmZlcixcblx0XHRcdGV4dGVuc2lvbixcblx0XHRcdHVybDogYC9hc3NldHMvJHsgYXNzZXRLZXkgfS4keyBleHRlbnNpb24gfT8keyBoYXNoIH1gLFxuXHRcdFx0c2l6ZTogZmlsZS5sZW5ndGgsXG5cdFx0XHR1cGxvYWREYXRlOiBmaWxlLnVwbG9hZERhdGUsXG5cdFx0XHRjb250ZW50VHlwZTogZmlsZS5jb250ZW50VHlwZSxcblx0XHRcdGhhc2hcblx0XHR9O1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnQXNzZXRzJyk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdBc3NldHNfU3ZnRmF2aWNvbl9FbmFibGUnLCB0cnVlLCB7XG5cdHR5cGU6ICdib29sZWFuJyxcblx0Z3JvdXA6ICdBc3NldHMnLFxuXHRpMThuTGFiZWw6ICdFbmFibGVfU3ZnX0Zhdmljb24nXG59KTtcblxuZnVuY3Rpb24gYWRkQXNzZXRUb1NldHRpbmcoa2V5LCB2YWx1ZSkge1xuXHRyZXR1cm4gUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoYEFzc2V0c18keyBrZXkgfWAsIHtcblx0XHRkZWZhdWx0VXJsOiB2YWx1ZS5kZWZhdWx0VXJsXG5cdH0sIHtcblx0XHR0eXBlOiAnYXNzZXQnLFxuXHRcdGdyb3VwOiAnQXNzZXRzJyxcblx0XHRmaWxlQ29uc3RyYWludHM6IHZhbHVlLmNvbnN0cmFpbnRzLFxuXHRcdGkxOG5MYWJlbDogdmFsdWUubGFiZWwsXG5cdFx0YXNzZXQ6IGtleSxcblx0XHRwdWJsaWM6IHRydWVcblx0fSk7XG59XG5cbmZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGFzc2V0cykpIHtcblx0Y29uc3QgdmFsdWUgPSBhc3NldHNba2V5XTtcblx0YWRkQXNzZXRUb1NldHRpbmcoa2V5LCB2YWx1ZSk7XG59XG5cblJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmQoKS5vYnNlcnZlKHtcblx0YWRkZWQocmVjb3JkKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQXNzZXRzLnByb2Nlc3NBc3NldChyZWNvcmQuX2lkLCByZWNvcmQudmFsdWUpO1xuXHR9LFxuXG5cdGNoYW5nZWQocmVjb3JkKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQXNzZXRzLnByb2Nlc3NBc3NldChyZWNvcmQuX2lkLCByZWNvcmQudmFsdWUpO1xuXHR9LFxuXG5cdHJlbW92ZWQocmVjb3JkKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQXNzZXRzLnByb2Nlc3NBc3NldChyZWNvcmQuX2lkLCB1bmRlZmluZWQpO1xuXHR9XG59KTtcblxuTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdHJldHVybiBNZXRlb3Iuc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gcHJvY2Vzcy5lbWl0KCdtZXNzYWdlJywge1xuXHRcdFx0cmVmcmVzaDogJ2NsaWVudCdcblx0XHR9KTtcblx0fSwgMjAwKTtcbn0pO1xuXG5jb25zdCBjYWxjdWxhdGVDbGllbnRIYXNoID0gV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoO1xuXG5XZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2ggPSBmdW5jdGlvbihtYW5pZmVzdCwgaW5jbHVkZUZpbHRlciwgcnVudGltZUNvbmZpZ092ZXJyaWRlKSB7XG5cdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGFzc2V0cykpIHtcblx0XHRjb25zdCB2YWx1ZSA9IGFzc2V0c1trZXldO1xuXHRcdGlmICghdmFsdWUuY2FjaGUgJiYgIXZhbHVlLmRlZmF1bHRVcmwpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGxldCBjYWNoZSA9IHt9O1xuXHRcdGlmICh2YWx1ZS5jYWNoZSkge1xuXHRcdFx0Y2FjaGUgPSB7XG5cdFx0XHRcdHBhdGg6IHZhbHVlLmNhY2hlLnBhdGgsXG5cdFx0XHRcdGNhY2hlYWJsZTogdmFsdWUuY2FjaGUuY2FjaGVhYmxlLFxuXHRcdFx0XHRzb3VyY2VNYXBVcmw6IHZhbHVlLmNhY2hlLnNvdXJjZU1hcFVybCxcblx0XHRcdFx0d2hlcmU6IHZhbHVlLmNhY2hlLndoZXJlLFxuXHRcdFx0XHR0eXBlOiB2YWx1ZS5jYWNoZS50eXBlLFxuXHRcdFx0XHR1cmw6IHZhbHVlLmNhY2hlLnVybCxcblx0XHRcdFx0c2l6ZTogdmFsdWUuY2FjaGUuc2l6ZSxcblx0XHRcdFx0aGFzaDogdmFsdWUuY2FjaGUuaGFzaFxuXHRcdFx0fTtcblx0XHRcdFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc1tgL19fY29yZG92YS9hc3NldHMvJHsga2V5IH1gXSA9IHZhbHVlLmNhY2hlO1xuXHRcdFx0V2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzW2AvX19jb3Jkb3ZhL2Fzc2V0cy8keyBrZXkgfS4keyB2YWx1ZS5jYWNoZS5leHRlbnNpb24gfWBdID0gdmFsdWUuY2FjaGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHZhbHVlLmRlZmF1bHRVcmwuc3BsaXQoJy4nKS5wb3AoKTtcblx0XHRcdGNhY2hlID0ge1xuXHRcdFx0XHRwYXRoOiBgYXNzZXRzLyR7IGtleSB9LiR7IGV4dGVuc2lvbiB9YCxcblx0XHRcdFx0Y2FjaGVhYmxlOiBmYWxzZSxcblx0XHRcdFx0c291cmNlTWFwVXJsOiB1bmRlZmluZWQsXG5cdFx0XHRcdHdoZXJlOiAnY2xpZW50Jyxcblx0XHRcdFx0dHlwZTogJ2Fzc2V0Jyxcblx0XHRcdFx0dXJsOiBgL2Fzc2V0cy8keyBrZXkgfS4keyBleHRlbnNpb24gfT92M2AsXG5cdFx0XHRcdGhhc2g6ICd2Mydcblx0XHRcdH07XG5cblx0XHRcdFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc1tgL19fY29yZG92YS9hc3NldHMvJHsga2V5IH1gXSA9IFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc1tgL19fY29yZG92YS8keyB2YWx1ZS5kZWZhdWx0VXJsIH1gXTtcblx0XHRcdFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc1tgL19fY29yZG92YS9hc3NldHMvJHsga2V5IH0uJHsgZXh0ZW5zaW9uIH1gXSA9IFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc1tgL19fY29yZG92YS8keyB2YWx1ZS5kZWZhdWx0VXJsIH1gXTtcblx0XHR9XG5cblx0XHRjb25zdCBtYW5pZmVzdEl0ZW0gPSBfLmZpbmRXaGVyZShtYW5pZmVzdCwge1xuXHRcdFx0cGF0aDoga2V5XG5cdFx0fSk7XG5cblx0XHRpZiAobWFuaWZlc3RJdGVtKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IG1hbmlmZXN0LmluZGV4T2YobWFuaWZlc3RJdGVtKTtcblx0XHRcdG1hbmlmZXN0W2luZGV4XSA9IGNhY2hlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtYW5pZmVzdC5wdXNoKGNhY2hlKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gY2FsY3VsYXRlQ2xpZW50SGFzaC5jYWxsKHRoaXMsIG1hbmlmZXN0LCBpbmNsdWRlRmlsdGVyLCBydW50aW1lQ29uZmlnT3ZlcnJpZGUpO1xufTtcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHRyZWZyZXNoQ2xpZW50cygpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHtcblx0XHRcdFx0bWV0aG9kOiAncmVmcmVzaENsaWVudHMnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNQZXJtaXNzaW9uID0gUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ21hbmFnZS1hc3NldHMnKTtcblx0XHRpZiAoIWhhc1Blcm1pc3Npb24pIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3ctYWxsb3dlZCcsICdNYW5hZ2luZyBhc3NldHMgbm90IGFsbG93ZWQnLCB7XG5cdFx0XHRcdG1ldGhvZDogJ3JlZnJlc2hDbGllbnRzJyxcblx0XHRcdFx0YWN0aW9uOiAnTWFuYWdpbmdfYXNzZXRzJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQXNzZXRzLnJlZnJlc2hDbGllbnRzKCk7XG5cdH0sXG5cblx0dW5zZXRBc3NldChhc3NldCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywge1xuXHRcdFx0XHRtZXRob2Q6ICd1bnNldEFzc2V0J1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzUGVybWlzc2lvbiA9IFJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdtYW5hZ2UtYXNzZXRzJyk7XG5cdFx0aWYgKCFoYXNQZXJtaXNzaW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hY3Rpb24tbm93LWFsbG93ZWQnLCAnTWFuYWdpbmcgYXNzZXRzIG5vdCBhbGxvd2VkJywge1xuXHRcdFx0XHRtZXRob2Q6ICd1bnNldEFzc2V0Jyxcblx0XHRcdFx0YWN0aW9uOiAnTWFuYWdpbmdfYXNzZXRzJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuQXNzZXRzLnVuc2V0QXNzZXQoYXNzZXQpO1xuXHR9LFxuXG5cdHNldEFzc2V0KGJpbmFyeUNvbnRlbnQsIGNvbnRlbnRUeXBlLCBhc3NldCkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywge1xuXHRcdFx0XHRtZXRob2Q6ICdzZXRBc3NldCdcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhhc1Blcm1pc3Npb24gPSBSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAnbWFuYWdlLWFzc2V0cycpO1xuXHRcdGlmICghaGFzUGVybWlzc2lvbikge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdy1hbGxvd2VkJywgJ01hbmFnaW5nIGFzc2V0cyBub3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAnc2V0QXNzZXQnLFxuXHRcdFx0XHRhY3Rpb246ICdNYW5hZ2luZ19hc3NldHMnXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRSb2NrZXRDaGF0LkFzc2V0cy5zZXRBc3NldChiaW5hcnlDb250ZW50LCBjb250ZW50VHlwZSwgYXNzZXQpO1xuXHR9XG59KTtcblxuV2ViQXBwLmNvbm5lY3RIYW5kbGVycy51c2UoJy9hc3NldHMvJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihyZXEsIHJlcywgbmV4dCkge1xuXHRjb25zdCBwYXJhbXMgPSB7XG5cdFx0YXNzZXQ6IGRlY29kZVVSSUNvbXBvbmVudChyZXEudXJsLnJlcGxhY2UoL15cXC8vLCAnJykucmVwbGFjZSgvXFw/LiokLywgJycpKS5yZXBsYWNlKC9cXC5bXi5dKiQvLCAnJylcblx0fTtcblxuXHRjb25zdCBmaWxlID0gYXNzZXRzW3BhcmFtcy5hc3NldF0gJiYgYXNzZXRzW3BhcmFtcy5hc3NldF0uY2FjaGU7XG5cblx0aWYgKCFmaWxlKSB7XG5cdFx0aWYgKGFzc2V0c1twYXJhbXMuYXNzZXRdICYmIGFzc2V0c1twYXJhbXMuYXNzZXRdLmRlZmF1bHRVcmwpIHtcblx0XHRcdHJlcS51cmwgPSBgLyR7IGFzc2V0c1twYXJhbXMuYXNzZXRdLmRlZmF1bHRVcmwgfWA7XG5cdFx0XHRXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNNaWRkbGV3YXJlKFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlcywgcmVxLCByZXMsIG5leHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXMud3JpdGVIZWFkKDQwNCk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgcmVxTW9kaWZpZWRIZWFkZXIgPSByZXEuaGVhZGVyc1snaWYtbW9kaWZpZWQtc2luY2UnXTtcblx0aWYgKHJlcU1vZGlmaWVkSGVhZGVyKSB7XG5cdFx0aWYgKHJlcU1vZGlmaWVkSGVhZGVyID09PSAoZmlsZS51cGxvYWREYXRlICYmIGZpbGUudXBsb2FkRGF0ZS50b1VUQ1N0cmluZygpKSkge1xuXHRcdFx0cmVzLnNldEhlYWRlcignTGFzdC1Nb2RpZmllZCcsIHJlcU1vZGlmaWVkSGVhZGVyKTtcblx0XHRcdHJlcy53cml0ZUhlYWQoMzA0KTtcblx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRyZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ3B1YmxpYywgbWF4LWFnZT0wJyk7XG5cdHJlcy5zZXRIZWFkZXIoJ0V4cGlyZXMnLCAnLTEnKTtcblx0cmVzLnNldEhlYWRlcignTGFzdC1Nb2RpZmllZCcsIChmaWxlLnVwbG9hZERhdGUgJiYgZmlsZS51cGxvYWREYXRlLnRvVVRDU3RyaW5nKCkpIHx8IG5ldyBEYXRlKCkudG9VVENTdHJpbmcoKSk7XG5cdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGZpbGUuY29udGVudFR5cGUpO1xuXHRyZXMuc2V0SGVhZGVyKCdDb250ZW50LUxlbmd0aCcsIGZpbGUuc2l6ZSk7XG5cdHJlcy53cml0ZUhlYWQoMjAwKTtcblx0cmVzLmVuZChmaWxlLmNvbnRlbnQpO1xufSkpO1xuIl19
