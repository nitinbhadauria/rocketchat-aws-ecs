(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var ECMAScript = Package.ecmascript.ECMAScript;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var RocketChatFile, exports;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:file":{"file.server.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/rocketchat_file/file.server.js                                                      //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
let Grid;
module.watch(require("gridfs-stream"), {
	default(v) {
		Grid = v;
	}

}, 0);
let stream;
module.watch(require("stream"), {
	default(v) {
		stream = v;
	}

}, 1);
let fs;
module.watch(require("fs"), {
	default(v) {
		fs = v;
	}

}, 2);
let path;
module.watch(require("path"), {
	default(v) {
		path = v;
	}

}, 3);
let mkdirp;
module.watch(require("mkdirp"), {
	default(v) {
		mkdirp = v;
	}

}, 4);
let gm;
module.watch(require("gm"), {
	default(v) {
		gm = v;
	}

}, 5);
let exec;
module.watch(require("child_process"), {
	exec(v) {
		exec = v;
	}

}, 6);

// Fix problem with usernames being converted to object id
Grid.prototype.tryParseObjectId = function () {
	return false;
}; //TODO: REMOVE RocketChatFile from globals


RocketChatFile = {
	gm,
	enabled: undefined,

	enable() {
		RocketChatFile.enabled = true;
		return RocketChat.settings.updateOptionsById('Accounts_AvatarResize', {
			alert: undefined
		});
	},

	disable() {
		RocketChatFile.enabled = false;
		return RocketChat.settings.updateOptionsById('Accounts_AvatarResize', {
			alert: 'The_image_resize_will_not_work_because_we_can_not_detect_ImageMagick_or_GraphicsMagick_installed_in_your_server'
		});
	}

};

const detectGM = function () {
	return exec('gm version', Meteor.bindEnvironment(function (error, stdout) {
		if (error == null && stdout.indexOf('GraphicsMagick') > -1) {
			RocketChatFile.enable();
			RocketChat.Info.GraphicsMagick = {
				enabled: true,
				version: stdout
			};
		} else {
			RocketChat.Info.GraphicsMagick = {
				enabled: false
			};
		}

		return exec('convert -version', Meteor.bindEnvironment(function (error, stdout) {
			if (error == null && stdout.indexOf('ImageMagick') > -1) {
				if (RocketChatFile.enabled !== true) {
					// Enable GM to work with ImageMagick if no GraphicsMagick
					RocketChatFile.gm = RocketChatFile.gm.subClass({
						imageMagick: true
					});
					RocketChatFile.enable();
				}

				return RocketChat.Info.ImageMagick = {
					enabled: true,
					version: stdout
				};
			} else {
				if (RocketChatFile.enabled !== true) {
					RocketChatFile.disable();
				}

				return RocketChat.Info.ImageMagick = {
					enabled: false
				};
			}
		}));
	}));
};

detectGM();
Meteor.methods({
	'detectGM'() {
		detectGM();
	}

});

RocketChatFile.bufferToStream = function (buffer) {
	const bufferStream = new stream.PassThrough();
	bufferStream.end(buffer);
	return bufferStream;
};

RocketChatFile.dataURIParse = function (dataURI) {
	const imageData = dataURI.split(';base64,');
	return {
		image: imageData[1],
		contentType: imageData[0].replace('data:', '')
	};
};

RocketChatFile.addPassThrough = function (st, fn) {
	const pass = new stream.PassThrough();
	fn(pass, st);
	return pass;
};

RocketChatFile.GridFS = class {
	constructor(config = {}) {
		const {
			name = 'file',
			transformWrite
		} = config;
		this.name = name;
		this.transformWrite = transformWrite;
		const mongo = Package.mongo.MongoInternals.NpmModule;
		const db = Package.mongo.MongoInternals.defaultRemoteCollectionDriver().mongo.db;
		this.store = new Grid(db, mongo);
		this.findOneSync = Meteor.wrapAsync(this.store.collection(this.name).findOne.bind(this.store.collection(this.name)));
		this.removeSync = Meteor.wrapAsync(this.store.remove.bind(this.store));
		this.countSync = Meteor.wrapAsync(this.store._col.count.bind(this.store._col));
		this.getFileSync = Meteor.wrapAsync(this.getFile.bind(this));
	}

	findOne(fileName) {
		return this.findOneSync({
			_id: fileName
		});
	}

	remove(fileName) {
		return this.removeSync({
			_id: fileName,
			root: this.name
		});
	}

	createWriteStream(fileName, contentType) {
		const self = this;
		let ws = this.store.createWriteStream({
			_id: fileName,
			filename: fileName,
			mode: 'w',
			root: this.name,
			content_type: contentType
		});

		if (self.transformWrite != null) {
			ws = RocketChatFile.addPassThrough(ws, function (rs, ws) {
				const file = {
					name: self.name,
					fileName,
					contentType
				};
				return self.transformWrite(file, rs, ws);
			});
		}

		ws.on('close', function () {
			return ws.emit('end');
		});
		return ws;
	}

	createReadStream(fileName) {
		return this.store.createReadStream({
			_id: fileName,
			root: this.name
		});
	}

	getFileWithReadStream(fileName) {
		const file = this.findOne(fileName);

		if (file == null) {
			return null;
		}

		const rs = this.createReadStream(fileName);
		return {
			readStream: rs,
			contentType: file.contentType,
			length: file.length,
			uploadDate: file.uploadDate
		};
	}

	getFile(fileName, cb) {
		const file = this.getFileWithReadStream(fileName);

		if (!file) {
			return cb();
		}

		const data = [];
		file.readStream.on('data', Meteor.bindEnvironment(function (chunk) {
			return data.push(chunk);
		}));
		return file.readStream.on('end', Meteor.bindEnvironment(function () {
			return cb(null, {
				buffer: Buffer.concat(data),
				contentType: file.contentType,
				length: file.length,
				uploadDate: file.uploadDate
			});
		}));
	}

	deleteFile(fileName) {
		const file = this.findOne(fileName);

		if (file == null) {
			return undefined;
		}

		return this.remove(fileName);
	}

};
RocketChatFile.FileSystem = class {
	constructor(config = {}) {
		let {
			absolutePath = '~/uploads'
		} = config;
		const {
			transformWrite
		} = config;
		this.transformWrite = transformWrite;

		if (absolutePath.split(path.sep)[0] === '~') {
			const homepath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

			if (homepath != null) {
				absolutePath = absolutePath.replace('~', homepath);
			} else {
				throw new Error('Unable to resolve "~" in path');
			}
		}

		this.absolutePath = path.resolve(absolutePath);
		mkdirp.sync(this.absolutePath);
		this.statSync = Meteor.wrapAsync(fs.stat.bind(fs));
		this.unlinkSync = Meteor.wrapAsync(fs.unlink.bind(fs));
		this.getFileSync = Meteor.wrapAsync(this.getFile.bind(this));
	}

	createWriteStream(fileName, contentType) {
		const self = this;
		let ws = fs.createWriteStream(path.join(this.absolutePath, fileName));

		if (self.transformWrite != null) {
			ws = RocketChatFile.addPassThrough(ws, function (rs, ws) {
				const file = {
					fileName,
					contentType
				};
				return self.transformWrite(file, rs, ws);
			});
		}

		ws.on('close', function () {
			return ws.emit('end');
		});
		return ws;
	}

	createReadStream(fileName) {
		return fs.createReadStream(path.join(this.absolutePath, fileName));
	}

	stat(fileName) {
		return this.statSync(path.join(this.absolutePath, fileName));
	}

	remove(fileName) {
		return this.unlinkSync(path.join(this.absolutePath, fileName));
	}

	getFileWithReadStream(fileName) {
		try {
			const stat = this.stat(fileName);
			const rs = this.createReadStream(fileName);
			return {
				readStream: rs,
				// contentType: file.contentType
				length: stat.size
			};
		} catch (error1) {
			return null;
		}
	}

	getFile(fileName, cb) {
		const file = this.getFileWithReadStream(fileName);

		if (!file) {
			return cb();
		}

		const data = [];
		file.readStream.on('data', Meteor.bindEnvironment(function (chunk) {
			return data.push(chunk);
		}));
		return file.readStream.on('end', Meteor.bindEnvironment(function () {
			return {
				buffer: Buffer.concat(data)({
					contentType: file.contentType,
					length: file.length,
					uploadDate: file.uploadDate
				})
			};
		}));
	}

	deleteFile(fileName) {
		try {
			return this.remove(fileName);
		} catch (error1) {
			return null;
		}
	}

};
//////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"gridfs-stream":{"index.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// node_modules/meteor/rocketchat_file/node_modules/gridfs-stream/index.js                      //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
module.exports = exports = require('./lib');

//////////////////////////////////////////////////////////////////////////////////////////////////

}},"mkdirp":{"package.json":function(require,exports){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// ../../.meteor/local/isopacks/rocketchat_file/npm/node_modules/mkdirp/package.json            //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
exports.name = "mkdirp";
exports.version = "0.5.1";
exports.main = "index.js";

//////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// node_modules/meteor/rocketchat_file/node_modules/mkdirp/index.js                             //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
var path = require('path');
var fs = require('fs');
var _0777 = parseInt('0777', 8);

module.exports = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;

function mkdirP (p, opts, f, made) {
    if (typeof opts === 'function') {
        f = opts;
        opts = {};
    }
    else if (!opts || typeof opts !== 'object') {
        opts = { mode: opts };
    }
    
    var mode = opts.mode;
    var xfs = opts.fs || fs;
    
    if (mode === undefined) {
        mode = _0777 & (~process.umask());
    }
    if (!made) made = null;
    
    var cb = f || function () {};
    p = path.resolve(p);
    
    xfs.mkdir(p, mode, function (er) {
        if (!er) {
            made = made || p;
            return cb(null, made);
        }
        switch (er.code) {
            case 'ENOENT':
                mkdirP(path.dirname(p), opts, function (er, made) {
                    if (er) cb(er, made);
                    else mkdirP(p, opts, cb, made);
                });
                break;

            // In the case of any other error, just see if there's a dir
            // there already.  If so, then hooray!  If not, then something
            // is borked.
            default:
                xfs.stat(p, function (er2, stat) {
                    // if the stat fails, then that's super weird.
                    // let the original error be the failure reason.
                    if (er2 || !stat.isDirectory()) cb(er, made)
                    else cb(null, made);
                });
                break;
        }
    });
}

mkdirP.sync = function sync (p, opts, made) {
    if (!opts || typeof opts !== 'object') {
        opts = { mode: opts };
    }
    
    var mode = opts.mode;
    var xfs = opts.fs || fs;
    
    if (mode === undefined) {
        mode = _0777 & (~process.umask());
    }
    if (!made) made = null;

    p = path.resolve(p);

    try {
        xfs.mkdirSync(p, mode);
        made = made || p;
    }
    catch (err0) {
        switch (err0.code) {
            case 'ENOENT' :
                made = sync(path.dirname(p), opts, made);
                sync(p, opts, made);
                break;

            // In the case of any other error, just see if there's a dir
            // there already.  If so, then hooray!  If not, then something
            // is borked.
            default:
                var stat;
                try {
                    stat = xfs.statSync(p);
                }
                catch (err1) {
                    throw err0;
                }
                if (!stat.isDirectory()) throw err0;
                break;
        }
    }

    return made;
};

//////////////////////////////////////////////////////////////////////////////////////////////////

}},"gm":{"package.json":function(require,exports){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// ../../.meteor/local/isopacks/rocketchat_file/npm/node_modules/gm/package.json                //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
exports.name = "gm";
exports.version = "1.23.0";
exports.main = "./index";

//////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// node_modules/meteor/rocketchat_file/node_modules/gm/index.js                                 //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //

/**
 * Module dependencies.
 */

var Stream = require('stream').Stream;
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(gm, EventEmitter);

/**
 * Constructor.
 *
 * @param {String|Number} path - path to img source or ReadableStream or width of img to create
 * @param {Number} [height] - optional filename of ReadableStream or height of img to create
 * @param {String} [color] - optional hex background color of created img
 */

function gm (source, height, color) {
  var width;

  if (!(this instanceof gm)) {
    return new gm(source, height, color);
  }

  EventEmitter.call(this);

  this._options = {};
  this.options(this.__proto__._options);

  this.data = {};
  this._in = [];
  this._out = [];
  this._outputFormat = null;
  this._subCommand = 'convert';

  if (source instanceof Stream) {
    this.sourceStream = source;
    source = height || 'unknown.jpg';
  } else if (Buffer.isBuffer(source)) {
    this.sourceBuffer = source;
    source = height || 'unknown.jpg';
  } else if (height) {
    // new images
    width = source;
    source = "";

    this.in("-size", width + "x" + height);

    if (color) {
      this.in("xc:"+ color);
    }
  }

  if (typeof source === "string") {
    // then source is a path

    // parse out gif frame brackets from filename
    // since stream doesn't use source path
    // eg. "filename.gif[0]"
    var frames = source.match(/(\[.+\])$/);
    if (frames) {
      this.sourceFrames = source.substr(frames.index, frames[0].length);
      source = source.substr(0, frames.index);
    }
  }

  this.source = source;

  this.addSrcFormatter(function (src) {
    // must be first source formatter

    var inputFromStdin = this.sourceStream || this.sourceBuffer;
    var ret = inputFromStdin ? '-' : this.source;

    if (ret && this.sourceFrames) ret += this.sourceFrames;

    src.length = 0;
    src[0] = ret;
  });
}

/**
 * Subclasses the gm constructor with custom options.
 *
 * @param {options} options
 * @return {gm} the subclasses gm constructor
 */

var parent = gm;
gm.subClass = function subClass (options) {
  function gm (source, height, color) {
    if (!(this instanceof parent)) {
      return new gm(source, height, color);
    }

    parent.call(this, source, height, color);
  }

  gm.prototype.__proto__ = parent.prototype;
  gm.prototype._options = {};
  gm.prototype.options(options);

  return gm;
}

/**
 * Augment the prototype.
 */

require("./lib/options")(gm.prototype);
require("./lib/getters")(gm);
require("./lib/args")(gm.prototype);
require("./lib/drawing")(gm.prototype);
require("./lib/convenience")(gm.prototype);
require("./lib/command")(gm.prototype);
require("./lib/compare")(gm.prototype);
require("./lib/composite")(gm.prototype);
require("./lib/montage")(gm.prototype);

/**
 * Expose.
 */

module.exports = exports = gm;
module.exports.utils = require('./lib/utils');
module.exports.compare = require('./lib/compare')();
module.exports.version = require('./package.json').version;

//////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:file/file.server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:file'] = {}, {
  RocketChatFile: RocketChatFile
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_file.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlL2ZpbGUuc2VydmVyLmpzIl0sIm5hbWVzIjpbIkdyaWQiLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsInN0cmVhbSIsImZzIiwicGF0aCIsIm1rZGlycCIsImdtIiwiZXhlYyIsInByb3RvdHlwZSIsInRyeVBhcnNlT2JqZWN0SWQiLCJSb2NrZXRDaGF0RmlsZSIsImVuYWJsZWQiLCJ1bmRlZmluZWQiLCJlbmFibGUiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJ1cGRhdGVPcHRpb25zQnlJZCIsImFsZXJ0IiwiZGlzYWJsZSIsImRldGVjdEdNIiwiTWV0ZW9yIiwiYmluZEVudmlyb25tZW50IiwiZXJyb3IiLCJzdGRvdXQiLCJpbmRleE9mIiwiSW5mbyIsIkdyYXBoaWNzTWFnaWNrIiwidmVyc2lvbiIsInN1YkNsYXNzIiwiaW1hZ2VNYWdpY2siLCJJbWFnZU1hZ2ljayIsIm1ldGhvZHMiLCJidWZmZXJUb1N0cmVhbSIsImJ1ZmZlciIsImJ1ZmZlclN0cmVhbSIsIlBhc3NUaHJvdWdoIiwiZW5kIiwiZGF0YVVSSVBhcnNlIiwiZGF0YVVSSSIsImltYWdlRGF0YSIsInNwbGl0IiwiaW1hZ2UiLCJjb250ZW50VHlwZSIsInJlcGxhY2UiLCJhZGRQYXNzVGhyb3VnaCIsInN0IiwiZm4iLCJwYXNzIiwiR3JpZEZTIiwiY29uc3RydWN0b3IiLCJjb25maWciLCJuYW1lIiwidHJhbnNmb3JtV3JpdGUiLCJtb25nbyIsIlBhY2thZ2UiLCJNb25nb0ludGVybmFscyIsIk5wbU1vZHVsZSIsImRiIiwiZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIiLCJzdG9yZSIsImZpbmRPbmVTeW5jIiwid3JhcEFzeW5jIiwiY29sbGVjdGlvbiIsImZpbmRPbmUiLCJiaW5kIiwicmVtb3ZlU3luYyIsInJlbW92ZSIsImNvdW50U3luYyIsIl9jb2wiLCJjb3VudCIsImdldEZpbGVTeW5jIiwiZ2V0RmlsZSIsImZpbGVOYW1lIiwiX2lkIiwicm9vdCIsImNyZWF0ZVdyaXRlU3RyZWFtIiwic2VsZiIsIndzIiwiZmlsZW5hbWUiLCJtb2RlIiwiY29udGVudF90eXBlIiwicnMiLCJmaWxlIiwib24iLCJlbWl0IiwiY3JlYXRlUmVhZFN0cmVhbSIsImdldEZpbGVXaXRoUmVhZFN0cmVhbSIsInJlYWRTdHJlYW0iLCJsZW5ndGgiLCJ1cGxvYWREYXRlIiwiY2IiLCJkYXRhIiwiY2h1bmsiLCJwdXNoIiwiQnVmZmVyIiwiY29uY2F0IiwiZGVsZXRlRmlsZSIsIkZpbGVTeXN0ZW0iLCJhYnNvbHV0ZVBhdGgiLCJzZXAiLCJob21lcGF0aCIsInByb2Nlc3MiLCJlbnYiLCJIT01FIiwiSE9NRVBBVEgiLCJVU0VSUFJPRklMRSIsIkVycm9yIiwicmVzb2x2ZSIsInN5bmMiLCJzdGF0U3luYyIsInN0YXQiLCJ1bmxpbmtTeW5jIiwidW5saW5rIiwiam9pbiIsInNpemUiLCJlcnJvcjEiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxJQUFKO0FBQVNDLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxlQUFSLENBQWIsRUFBc0M7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLFNBQUtLLENBQUw7QUFBTzs7QUFBbkIsQ0FBdEMsRUFBMkQsQ0FBM0Q7QUFBOEQsSUFBSUMsTUFBSjtBQUFXTCxPQUFPQyxLQUFQLENBQWFDLFFBQVEsUUFBUixDQUFiLEVBQStCO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDQyxXQUFPRCxDQUFQO0FBQVM7O0FBQXJCLENBQS9CLEVBQXNELENBQXREO0FBQXlELElBQUlFLEVBQUo7QUFBT04sT0FBT0MsS0FBUCxDQUFhQyxRQUFRLElBQVIsQ0FBYixFQUEyQjtBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0UsT0FBR0YsQ0FBSDtBQUFLOztBQUFqQixDQUEzQixFQUE4QyxDQUE5QztBQUFpRCxJQUFJRyxJQUFKO0FBQVNQ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O0FBRUQ1QyxTQUFRQyxRQUFSLEVBQWtCa0IsRUFBbEIsRUFBc0I7QUFDckIsUUFBTVIsT0FBTyxLQUFLSSxxQkFBTCxDQUEyQmQsUUFBM0IsQ0FBYjs7QUFDQSxNQUFJLENBQUNVLElBQUwsRUFBVztBQUNWLFVBQU9RLElBQVA7QUFDQTs7QUFDRCxRQUFNQyxPQUFPLEVBQWI7QUFDQVQsT0FBS0ssVUFBTCxDQUFnQkosRUFBaEIsQ0FBbUIsTUFBbkIsRUFBMkIvRCxPQUFPQyxlQUFQLENBQXVCLFVBQVN1RSxLQUFULEVBQWdCO0FBQ2pFLFVBQU9ELEtBQUtFLElBQUwsQ0FBVUQsS0FBVixDQUFQO0FBQ0EsR0FGMEIsQ0FBM0I7QUFHQSxTQUFPVixLQUFLSyxVQUFMLENBQWdCSixFQUFoQixDQUFtQixLQUFuQixFQUEwQi9ELE9BQU9DLGVBQVAsQ0FBdUIsWUFBVztBQUNsRSxVQUFPO0FBQ05ZLFlBQVE2RCxPQUFPQyxNQUFQLENBQWNKLElBQWQsRUFBb0I7QUFDM0JqRCxrQkFBYXdDLEtBQUt4QyxXQURTO0FBRTNCOEMsYUFBUU4sS0FBS00sTUFGYztBQUczQkMsaUJBQVlQLEtBQUtPO0FBSFUsS0FBcEI7QUFERixJQUFQO0FBT0EsR0FSZ0MsQ0FBMUIsQ0FBUDtBQVNBOztBQUVETyxZQUFXeEIsUUFBWCxFQUFxQjtBQUNwQixNQUFJO0FBQ0gsVUFBTyxLQUFLTixNQUFMLENBQVlNLFFBQVosQ0FBUDtBQUNBLEdBRkQsQ0FFRSxPQUFPMkMsTUFBUCxFQUFlO0FBQ2hCLFVBQU8sSUFBUDtBQUNBO0FBQ0Q7O0FBM0ZnQyxDQUFsQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2ZpbGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgR3JpZCBmcm9tICdncmlkZnMtc3RyZWFtJztcbmltcG9ydCBzdHJlYW0gZnJvbSAnc3RyZWFtJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcbmltcG9ydCBnbSBmcm9tICdnbSc7XG5pbXBvcnQge2V4ZWN9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuXG4vLyBGaXggcHJvYmxlbSB3aXRoIHVzZXJuYW1lcyBiZWluZyBjb252ZXJ0ZWQgdG8gb2JqZWN0IGlkXG5HcmlkLnByb3RvdHlwZS50cnlQYXJzZU9iamVjdElkID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmYWxzZTtcbn07XG4vL1RPRE86IFJFTU9WRSBSb2NrZXRDaGF0RmlsZSBmcm9tIGdsb2JhbHNcblJvY2tldENoYXRGaWxlID0ge1xuXHRnbSxcblx0ZW5hYmxlZDogdW5kZWZpbmVkLFxuXHRlbmFibGUoKSB7XG5cdFx0Um9ja2V0Q2hhdEZpbGUuZW5hYmxlZCA9IHRydWU7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlT3B0aW9uc0J5SWQoJ0FjY291bnRzX0F2YXRhclJlc2l6ZScsIHtcblx0XHRcdGFsZXJ0OiB1bmRlZmluZWRcblx0XHR9KTtcblx0fSxcblx0ZGlzYWJsZSgpIHtcblx0XHRSb2NrZXRDaGF0RmlsZS5lbmFibGVkID0gZmFsc2U7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuc2V0dGluZ3MudXBkYXRlT3B0aW9uc0J5SWQoJ0FjY291bnRzX0F2YXRhclJlc2l6ZScsIHtcblx0XHRcdGFsZXJ0OiAnVGhlX2ltYWdlX3Jlc2l6ZV93aWxsX25vdF93b3JrX2JlY2F1c2Vfd2VfY2FuX25vdF9kZXRlY3RfSW1hZ2VNYWdpY2tfb3JfR3JhcGhpY3NNYWdpY2tfaW5zdGFsbGVkX2luX3lvdXJfc2VydmVyJ1xuXHRcdH0pO1xuXHR9XG59O1xuXG5jb25zdCBkZXRlY3RHTSA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZXhlYygnZ20gdmVyc2lvbicsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24oZXJyb3IsIHN0ZG91dCkge1xuXHRcdGlmICgoZXJyb3IgPT0gbnVsbCkgJiYgc3Rkb3V0LmluZGV4T2YoJ0dyYXBoaWNzTWFnaWNrJykgPiAtMSkge1xuXHRcdFx0Um9ja2V0Q2hhdEZpbGUuZW5hYmxlKCk7XG5cdFx0XHRSb2NrZXRDaGF0LkluZm8uR3JhcGhpY3NNYWdpY2sgPSB7XG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHZlcnNpb246IHN0ZG91dFxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Um9ja2V0Q2hhdC5JbmZvLkdyYXBoaWNzTWFnaWNrID0ge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIGV4ZWMoJ2NvbnZlcnQgLXZlcnNpb24nLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uKGVycm9yLCBzdGRvdXQpIHtcblx0XHRcdGlmICgoZXJyb3IgPT0gbnVsbCkgJiYgc3Rkb3V0LmluZGV4T2YoJ0ltYWdlTWFnaWNrJykgPiAtMSkge1xuXHRcdFx0XHRpZiAoUm9ja2V0Q2hhdEZpbGUuZW5hYmxlZCAhPT0gdHJ1ZSkge1xuXHRcdFx0XHRcdC8vIEVuYWJsZSBHTSB0byB3b3JrIHdpdGggSW1hZ2VNYWdpY2sgaWYgbm8gR3JhcGhpY3NNYWdpY2tcblx0XHRcdFx0XHRSb2NrZXRDaGF0RmlsZS5nbSA9IFJvY2tldENoYXRGaWxlLmdtLnN1YkNsYXNzKHtcblx0XHRcdFx0XHRcdGltYWdlTWFnaWNrOiB0cnVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Um9ja2V0Q2hhdEZpbGUuZW5hYmxlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuSW5mby5JbWFnZU1hZ2ljayA9IHtcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdHZlcnNpb246IHN0ZG91dFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKFJvY2tldENoYXRGaWxlLmVuYWJsZWQgIT09IHRydWUpIHtcblx0XHRcdFx0XHRSb2NrZXRDaGF0RmlsZS5kaXNhYmxlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFJvY2tldENoYXQuSW5mby5JbWFnZU1hZ2ljayA9IHtcblx0XHRcdFx0XHRlbmFibGVkOiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fSkpO1xufTtcblxuZGV0ZWN0R00oKTtcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnZGV0ZWN0R00nKCkge1xuXHRcdGRldGVjdEdNKCk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0RmlsZS5idWZmZXJUb1N0cmVhbSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuXHRjb25zdCBidWZmZXJTdHJlYW0gPSBuZXcgc3RyZWFtLlBhc3NUaHJvdWdoKCk7XG5cdGJ1ZmZlclN0cmVhbS5lbmQoYnVmZmVyKTtcblx0cmV0dXJuIGJ1ZmZlclN0cmVhbTtcbn07XG5cblJvY2tldENoYXRGaWxlLmRhdGFVUklQYXJzZSA9IGZ1bmN0aW9uKGRhdGFVUkkpIHtcblx0Y29uc3QgaW1hZ2VEYXRhID0gZGF0YVVSSS5zcGxpdCgnO2Jhc2U2NCwnKTtcblx0cmV0dXJuIHtcblx0XHRpbWFnZTogaW1hZ2VEYXRhWzFdLFxuXHRcdGNvbnRlbnRUeXBlOiBpbWFnZURhdGFbMF0ucmVwbGFjZSgnZGF0YTonLCAnJylcblx0fTtcbn07XG5cblJvY2tldENoYXRGaWxlLmFkZFBhc3NUaHJvdWdoID0gZnVuY3Rpb24oc3QsIGZuKSB7XG5cdGNvbnN0IHBhc3MgPSBuZXcgc3RyZWFtLlBhc3NUaHJvdWdoKCk7XG5cdGZuKHBhc3MsIHN0KTtcblx0cmV0dXJuIHBhc3M7XG59O1xuXG5Sb2NrZXRDaGF0RmlsZS5HcmlkRlMgPSBjbGFzcyB7XG5cdGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG5cdFx0Y29uc3Qge25hbWUgPSAnZmlsZScsIHRyYW5zZm9ybVdyaXRlfSA9IGNvbmZpZztcblxuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy50cmFuc2Zvcm1Xcml0ZSA9IHRyYW5zZm9ybVdyaXRlO1xuXHRcdGNvbnN0IG1vbmdvID0gUGFja2FnZS5tb25nby5Nb25nb0ludGVybmFscy5OcG1Nb2R1bGU7XG5cdFx0Y29uc3QgZGIgPSBQYWNrYWdlLm1vbmdvLk1vbmdvSW50ZXJuYWxzLmRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyKCkubW9uZ28uZGI7XG5cdFx0dGhpcy5zdG9yZSA9IG5ldyBHcmlkKGRiLCBtb25nbyk7XG5cdFx0dGhpcy5maW5kT25lU3luYyA9IE1ldGVvci53cmFwQXN5bmModGhpcy5zdG9yZS5jb2xsZWN0aW9uKHRoaXMubmFtZSkuZmluZE9uZS5iaW5kKHRoaXMuc3RvcmUuY29sbGVjdGlvbih0aGlzLm5hbWUpKSk7XG5cdFx0dGhpcy5yZW1vdmVTeW5jID0gTWV0ZW9yLndyYXBBc3luYyh0aGlzLnN0b3JlLnJlbW92ZS5iaW5kKHRoaXMuc3RvcmUpKTtcblx0XHR0aGlzLmNvdW50U3luYyA9IE1ldGVvci53cmFwQXN5bmModGhpcy5zdG9yZS5fY29sLmNvdW50LmJpbmQodGhpcy5zdG9yZS5fY29sKSk7XG5cdFx0dGhpcy5nZXRGaWxlU3luYyA9IE1ldGVvci53cmFwQXN5bmModGhpcy5nZXRGaWxlLmJpbmQodGhpcykpO1xuXHR9XG5cblx0ZmluZE9uZShmaWxlTmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmZpbmRPbmVTeW5jKHtcblx0XHRcdF9pZDogZmlsZU5hbWVcblx0XHR9KTtcblx0fVxuXG5cdHJlbW92ZShmaWxlTmFtZSkge1xuXHRcdHJldHVybiB0aGlzLnJlbW92ZVN5bmMoe1xuXHRcdFx0X2lkOiBmaWxlTmFtZSxcblx0XHRcdHJvb3Q6IHRoaXMubmFtZVxuXHRcdH0pO1xuXHR9XG5cblx0Y3JlYXRlV3JpdGVTdHJlYW0oZmlsZU5hbWUsIGNvbnRlbnRUeXBlKSB7XG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cdFx0bGV0IHdzID0gdGhpcy5zdG9yZS5jcmVhdGVXcml0ZVN0cmVhbSh7XG5cdFx0XHRfaWQ6IGZpbGVOYW1lLFxuXHRcdFx0ZmlsZW5hbWU6IGZpbGVOYW1lLFxuXHRcdFx0bW9kZTogJ3cnLFxuXHRcdFx0cm9vdDogdGhpcy5uYW1lLFxuXHRcdFx0Y29udGVudF90eXBlOiBjb250ZW50VHlwZVxuXHRcdH0pO1xuXHRcdGlmIChzZWxmLnRyYW5zZm9ybVdyaXRlICE9IG51bGwpIHtcblx0XHRcdHdzID0gUm9ja2V0Q2hhdEZpbGUuYWRkUGFzc1Rocm91Z2god3MsIGZ1bmN0aW9uKHJzLCB3cykge1xuXHRcdFx0XHRjb25zdCBmaWxlID0ge1xuXHRcdFx0XHRcdG5hbWU6IHNlbGYubmFtZSxcblx0XHRcdFx0XHRmaWxlTmFtZSxcblx0XHRcdFx0XHRjb250ZW50VHlwZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRyZXR1cm4gc2VsZi50cmFuc2Zvcm1Xcml0ZShmaWxlLCBycywgd3MpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHdzLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHdzLmVtaXQoJ2VuZCcpO1xuXHRcdH0pO1xuXHRcdHJldHVybiB3cztcblx0fVxuXG5cdGNyZWF0ZVJlYWRTdHJlYW0oZmlsZU5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yZS5jcmVhdGVSZWFkU3RyZWFtKHtcblx0XHRcdF9pZDogZmlsZU5hbWUsXG5cdFx0XHRyb290OiB0aGlzLm5hbWVcblx0XHR9KTtcblx0fVxuXG5cdGdldEZpbGVXaXRoUmVhZFN0cmVhbShmaWxlTmFtZSkge1xuXHRcdGNvbnN0IGZpbGUgPSB0aGlzLmZpbmRPbmUoZmlsZU5hbWUpO1xuXHRcdGlmIChmaWxlID09IG51bGwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBycyA9IHRoaXMuY3JlYXRlUmVhZFN0cmVhbShmaWxlTmFtZSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlYWRTdHJlYW06IHJzLFxuXHRcdFx0Y29udGVudFR5cGU6IGZpbGUuY29udGVudFR5cGUsXG5cdFx0XHRsZW5ndGg6IGZpbGUubGVuZ3RoLFxuXHRcdFx0dXBsb2FkRGF0ZTogZmlsZS51cGxvYWREYXRlXG5cdFx0fTtcblx0fVxuXG5cdGdldEZpbGUoZmlsZU5hbWUsIGNiKSB7XG5cdFx0Y29uc3QgZmlsZSA9IHRoaXMuZ2V0RmlsZVdpdGhSZWFkU3RyZWFtKGZpbGVOYW1lKTtcblx0XHRpZiAoIWZpbGUpIHtcblx0XHRcdHJldHVybiBjYigpO1xuXHRcdH1cblx0XHRjb25zdCBkYXRhID0gW107XG5cdFx0ZmlsZS5yZWFkU3RyZWFtLm9uKCdkYXRhJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihjaHVuaykge1xuXHRcdFx0cmV0dXJuIGRhdGEucHVzaChjaHVuayk7XG5cdFx0fSkpO1xuXHRcdHJldHVybiBmaWxlLnJlYWRTdHJlYW0ub24oJ2VuZCcsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gY2IobnVsbCwge1xuXHRcdFx0XHRidWZmZXI6IEJ1ZmZlci5jb25jYXQoZGF0YSksXG5cdFx0XHRcdGNvbnRlbnRUeXBlOiBmaWxlLmNvbnRlbnRUeXBlLFxuXHRcdFx0XHRsZW5ndGg6IGZpbGUubGVuZ3RoLFxuXHRcdFx0XHR1cGxvYWREYXRlOiBmaWxlLnVwbG9hZERhdGVcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdGRlbGV0ZUZpbGUoZmlsZU5hbWUpIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5maW5kT25lKGZpbGVOYW1lKTtcblx0XHRpZiAoZmlsZSA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5yZW1vdmUoZmlsZU5hbWUpO1xuXHR9XG5cblxufTtcblxuUm9ja2V0Q2hhdEZpbGUuRmlsZVN5c3RlbSA9IGNsYXNzIHtcblx0Y29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcblx0XHRsZXQge2Fic29sdXRlUGF0aCA9ICd+L3VwbG9hZHMnfSA9IGNvbmZpZztcblx0XHRjb25zdCB7dHJhbnNmb3JtV3JpdGV9ID0gY29uZmlnO1xuXG5cdFx0dGhpcy50cmFuc2Zvcm1Xcml0ZSA9IHRyYW5zZm9ybVdyaXRlO1xuXHRcdGlmIChhYnNvbHV0ZVBhdGguc3BsaXQocGF0aC5zZXApWzBdID09PSAnficpIHtcblx0XHRcdGNvbnN0IGhvbWVwYXRoID0gcHJvY2Vzcy5lbnYuSE9NRSB8fCBwcm9jZXNzLmVudi5IT01FUEFUSCB8fCBwcm9jZXNzLmVudi5VU0VSUFJPRklMRTtcblx0XHRcdGlmIChob21lcGF0aCAhPSBudWxsKSB7XG5cdFx0XHRcdGFic29sdXRlUGF0aCA9IGFic29sdXRlUGF0aC5yZXBsYWNlKCd+JywgaG9tZXBhdGgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVzb2x2ZSBcIn5cIiBpbiBwYXRoJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuYWJzb2x1dGVQYXRoID0gcGF0aC5yZXNvbHZlKGFic29sdXRlUGF0aCk7XG5cdFx0bWtkaXJwLnN5bmModGhpcy5hYnNvbHV0ZVBhdGgpO1xuXHRcdHRoaXMuc3RhdFN5bmMgPSBNZXRlb3Iud3JhcEFzeW5jKGZzLnN0YXQuYmluZChmcykpO1xuXHRcdHRoaXMudW5saW5rU3luYyA9IE1ldGVvci53cmFwQXN5bmMoZnMudW5saW5rLmJpbmQoZnMpKTtcblx0XHR0aGlzLmdldEZpbGVTeW5jID0gTWV0ZW9yLndyYXBBc3luYyh0aGlzLmdldEZpbGUuYmluZCh0aGlzKSk7XG5cdH1cblxuXHRjcmVhdGVXcml0ZVN0cmVhbShmaWxlTmFtZSwgY29udGVudFR5cGUpIHtcblx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHRsZXQgd3MgPSBmcy5jcmVhdGVXcml0ZVN0cmVhbShwYXRoLmpvaW4odGhpcy5hYnNvbHV0ZVBhdGgsIGZpbGVOYW1lKSk7XG5cdFx0aWYgKHNlbGYudHJhbnNmb3JtV3JpdGUgIT0gbnVsbCkge1xuXHRcdFx0d3MgPSBSb2NrZXRDaGF0RmlsZS5hZGRQYXNzVGhyb3VnaCh3cywgZnVuY3Rpb24ocnMsIHdzKSB7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSB7XG5cdFx0XHRcdFx0ZmlsZU5hbWUsXG5cdFx0XHRcdFx0Y29udGVudFR5cGVcblx0XHRcdFx0fTtcblx0XHRcdFx0cmV0dXJuIHNlbGYudHJhbnNmb3JtV3JpdGUoZmlsZSwgcnMsIHdzKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHR3cy5vbignY2xvc2UnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB3cy5lbWl0KCdlbmQnKTtcblx0XHR9KTtcblx0XHRyZXR1cm4gd3M7XG5cdH1cblxuXHRjcmVhdGVSZWFkU3RyZWFtKGZpbGVOYW1lKSB7XG5cdFx0cmV0dXJuIGZzLmNyZWF0ZVJlYWRTdHJlYW0ocGF0aC5qb2luKHRoaXMuYWJzb2x1dGVQYXRoLCBmaWxlTmFtZSkpO1xuXHR9XG5cblx0c3RhdChmaWxlTmFtZSkge1xuXHRcdHJldHVybiB0aGlzLnN0YXRTeW5jKHBhdGguam9pbih0aGlzLmFic29sdXRlUGF0aCwgZmlsZU5hbWUpKTtcblx0fVxuXG5cdHJlbW92ZShmaWxlTmFtZSkge1xuXHRcdHJldHVybiB0aGlzLnVubGlua1N5bmMocGF0aC5qb2luKHRoaXMuYWJzb2x1dGVQYXRoLCBmaWxlTmFtZSkpO1xuXHR9XG5cblx0Z2V0RmlsZVdpdGhSZWFkU3RyZWFtKGZpbGVOYW1lKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN0YXQgPSB0aGlzLnN0YXQoZmlsZU5hbWUpO1xuXHRcdFx0Y29uc3QgcnMgPSB0aGlzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZU5hbWUpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVhZFN0cmVhbTogcnMsXG5cdFx0XHRcdC8vIGNvbnRlbnRUeXBlOiBmaWxlLmNvbnRlbnRUeXBlXG5cdFx0XHRcdGxlbmd0aDogc3RhdC5zaXplXG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2ggKGVycm9yMSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0Z2V0RmlsZShmaWxlTmFtZSwgY2IpIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5nZXRGaWxlV2l0aFJlYWRTdHJlYW0oZmlsZU5hbWUpO1xuXHRcdGlmICghZmlsZSkge1xuXHRcdFx0cmV0dXJuIGNiKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGRhdGEgPSBbXTtcblx0XHRmaWxlLnJlYWRTdHJlYW0ub24oJ2RhdGEnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uKGNodW5rKSB7XG5cdFx0XHRyZXR1cm4gZGF0YS5wdXNoKGNodW5rKTtcblx0XHR9KSk7XG5cdFx0cmV0dXJuIGZpbGUucmVhZFN0cmVhbS5vbignZW5kJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGJ1ZmZlcjogQnVmZmVyLmNvbmNhdChkYXRhKSh7XG5cdFx0XHRcdFx0Y29udGVudFR5cGU6IGZpbGUuY29udGVudFR5cGUsXG5cdFx0XHRcdFx0bGVuZ3RoOiBmaWxlLmxlbmd0aCxcblx0XHRcdFx0XHR1cGxvYWREYXRlOiBmaWxlLnVwbG9hZERhdGVcblx0XHRcdFx0fSlcblx0XHRcdH07XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGVsZXRlRmlsZShmaWxlTmFtZSkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZW1vdmUoZmlsZU5hbWUpO1xuXHRcdH0gY2F0Y2ggKGVycm9yMSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG59O1xuIl19
