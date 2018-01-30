(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChatFile = Package['rocketchat:file'].RocketChatFile;
var Slingshot = Package['edgee:slingshot'].Slingshot;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Random = Package.random.Random;
var Accounts = Package['accounts-base'].Accounts;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var FileUpload, FileUploadBase, file, options, fileUploadHandler;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:file-upload":{"globalFileRestrictions.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/globalFileRestrictions.js                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let filesize;
module.watch(require("filesize"), {
	default(v) {
		filesize = v;
	}

}, 0);
const slingShotConfig = {
	authorize(file /*, metaContext*/) {
		//Deny uploads if user is not logged in.
		if (!this.userId) {
			throw new Meteor.Error('login-required', 'Please login before posting files');
		}

		if (!RocketChat.fileUploadIsValidContentType(file.type)) {
			throw new Meteor.Error(TAPi18n.__('error-invalid-file-type'));
		}

		const maxFileSize = RocketChat.settings.get('FileUpload_MaxFileSize');

		if (maxFileSize && maxFileSize < file.size) {
			throw new Meteor.Error(TAPi18n.__('File_exceeds_allowed_size_of_bytes', {
				size: filesize(maxFileSize)
			}));
		}

		return true;
	},

	maxSize: 0,
	allowedFileTypes: null
};
Slingshot.fileRestrictions('rocketchat-uploads', slingShotConfig);
Slingshot.fileRestrictions('rocketchat-uploads-gs', slingShotConfig);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"FileUpload.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/lib/FileUpload.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let filesize;
module.watch(require("filesize"), {
	default(v) {
		filesize = v;
	}

}, 0);
let maxFileSize = 0;
FileUpload = {
	validateFileUpload(file) {
		if (!Match.test(file.rid, String)) {
			return false;
		}

		const user = Meteor.user();
		const room = RocketChat.models.Rooms.findOneById(file.rid);
		const directMessageAllow = RocketChat.settings.get('FileUpload_Enabled_Direct');
		const fileUploadAllowed = RocketChat.settings.get('FileUpload_Enabled');

		if (RocketChat.authz.canAccessRoom(room, user) !== true) {
			return false;
		}

		if (!fileUploadAllowed) {
			const reason = TAPi18n.__('FileUpload_Disabled', user.language);

			throw new Meteor.Error('error-file-upload-disabled', reason);
		}

		if (!directMessageAllow && room.t === 'd') {
			const reason = TAPi18n.__('File_not_allowed_direct_messages', user.language);

			throw new Meteor.Error('error-direct-message-file-upload-not-allowed', reason);
		}

		if (file.size > maxFileSize) {
			const reason = TAPi18n.__('File_exceeds_allowed_size_of_bytes', {
				size: filesize(maxFileSize)
			}, user.language);

			throw new Meteor.Error('error-file-too-large', reason);
		}

		if (parseInt(maxFileSize) > 0) {
			if (file.size > maxFileSize) {
				const reason = TAPi18n.__('File_exceeds_allowed_size_of_bytes', {
					size: filesize(maxFileSize)
				}, user.language);

				throw new Meteor.Error('error-file-too-large', reason);
			}
		}

		if (!RocketChat.fileUploadIsValidContentType(file.type)) {
			const reason = TAPi18n.__('File_type_is_not_accepted', user.language);

			throw new Meteor.Error('error-invalid-file-type', reason);
		}

		return true;
	}

};
RocketChat.settings.get('FileUpload_MaxFileSize', function (key, value) {
	maxFileSize = value;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"FileUploadBase.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/lib/FileUploadBase.js                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
UploadFS.config.defaultStorePermissions = new UploadFS.StorePermissions({
	insert(userId, doc) {
		return userId || doc && doc.message_id && doc.message_id.indexOf('slack-') === 0; // allow inserts from slackbridge (message_id = slack-timestamp-milli)
	},

	update(userId, doc) {
		return RocketChat.authz.hasPermission(Meteor.userId(), 'delete-message', doc.rid) || RocketChat.settings.get('Message_AllowDeleting') && userId === doc.userId;
	},

	remove(userId, doc) {
		return RocketChat.authz.hasPermission(Meteor.userId(), 'delete-message', doc.rid) || RocketChat.settings.get('Message_AllowDeleting') && userId === doc.userId;
	}

});
FileUploadBase = class FileUploadBase {
	constructor(store, meta, file) {
		this.id = Random.id();
		this.meta = meta;
		this.file = file;
		this.store = store;
	}

	getProgress() {}

	getFileName() {
		return this.meta.name;
	}

	start(callback) {
		this.handler = new UploadFS.Uploader({
			store: this.store,
			data: this.file,
			file: this.meta,
			onError: err => {
				return callback(err);
			},
			onComplete: fileData => {
				const file = _.pick(fileData, '_id', 'type', 'size', 'name', 'identify', 'description');

				file.url = fileData.url.replace(Meteor.absoluteUrl(), '/');
				return callback(null, file, this.store.options.name);
			}
		});

		this.handler.onProgress = (file, progress) => {
			this.onProgress(progress);
		};

		return this.handler.start();
	}

	onProgress() {}

	stop() {
		return this.handler.stop();
	}

};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"lib":{"FileUpload.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/lib/FileUpload.js                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	FileUploadClass: () => FileUploadClass
});
let fs;
module.watch(require("fs"), {
	default(v) {
		fs = v;
	}

}, 0);
let stream;
module.watch(require("stream"), {
	default(v) {
		stream = v;
	}

}, 1);
let mime;
module.watch(require("mime-type/with-db"), {
	default(v) {
		mime = v;
	}

}, 2);
let Future;
module.watch(require("fibers/future"), {
	default(v) {
		Future = v;
	}

}, 3);
let Cookies;
module.watch(require("meteor/ostrio:cookies"), {
	Cookies(v) {
		Cookies = v;
	}

}, 4);
const cookie = new Cookies();
Object.assign(FileUpload, {
	handlers: {},

	configureUploadsStore(store, name, options) {
		const type = name.split(':').pop();
		const stores = UploadFS.getStores();
		delete stores[name];
		return new UploadFS.store[store](Object.assign({
			name
		}, options, FileUpload[`default${type}`]()));
	},

	defaultUploads() {
		return {
			collection: RocketChat.models.Uploads.model,
			filter: new UploadFS.Filter({
				onCheck: FileUpload.validateFileUpload
			}),

			getPath(file) {
				return `${RocketChat.settings.get('uniqueID')}/uploads/${file.rid}/${file.userId}/${file._id}`;
			},

			// transformWrite: FileUpload.uploadsTransformWrite
			onValidate: FileUpload.uploadsOnValidate,

			onRead(fileId, file, req, res) {
				if (!FileUpload.requestCanAccessFiles(req)) {
					res.writeHead(403);
					return false;
				}

				res.setHeader('content-disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
				return true;
			}

		};
	},

	defaultAvatars() {
		return {
			collection: RocketChat.models.Avatars.model,

			// filter: new UploadFS.Filter({
			// 	onCheck: FileUpload.validateFileUpload
			// }),
			// transformWrite: FileUpload.avatarTransformWrite,
			getPath(file) {
				return `${RocketChat.settings.get('uniqueID')}/avatars/${file.userId}`;
			},

			onValidate: FileUpload.avatarsOnValidate,
			onFinishUpload: FileUpload.avatarsOnFinishUpload
		};
	},

	avatarTransformWrite(readStream, writeStream /*, fileId, file*/) {
		if (RocketChatFile.enabled === false || RocketChat.settings.get('Accounts_AvatarResize') !== true) {
			return readStream.pipe(writeStream);
		}

		const height = RocketChat.settings.get('Accounts_AvatarSize');
		const width = height;
		return (file => RocketChat.Info.GraphicsMagick.enabled ? file : file.alpha('remove'))(RocketChatFile.gm(readStream).background('#FFFFFF')).resize(width, `${height}^`).gravity('Center').crop(width, height).extent(width, height).stream('jpeg').pipe(writeStream);
	},

	avatarsOnValidate(file) {
		if (RocketChatFile.enabled === false || RocketChat.settings.get('Accounts_AvatarResize') !== true) {
			return;
		}

		const tempFilePath = UploadFS.getTempFilePath(file._id);
		const height = RocketChat.settings.get('Accounts_AvatarSize');
		const width = height;
		const future = new Future();
		(file => RocketChat.Info.GraphicsMagick.enabled ? file : file.alpha('remove'))(RocketChatFile.gm(tempFilePath).background('#FFFFFF')).resize(width, `${height}^`).gravity('Center').crop(width, height).extent(width, height).setFormat('jpeg').write(tempFilePath, Meteor.bindEnvironment(err => {
			if (err != null) {
				console.error(err);
			}

			const size = fs.lstatSync(tempFilePath).size;
			this.getCollection().direct.update({
				_id: file._id
			}, {
				$set: {
					size
				}
			});
			future.return();
		}));
		return future.wait();
	},

	uploadsTransformWrite(readStream, writeStream, fileId, file) {
		if (RocketChatFile.enabled === false || !/^image\/.+/.test(file.type)) {
			return readStream.pipe(writeStream);
		}

		let stream = undefined;

		const identify = function (err, data) {
			if (err) {
				return stream.pipe(writeStream);
			}

			file.identify = {
				format: data.format,
				size: data.size
			};

			if (data.Orientation && !['', 'Unknown', 'Undefined'].includes(data.Orientation)) {
				RocketChatFile.gm(stream).autoOrient().stream().pipe(writeStream);
			} else {
				stream.pipe(writeStream);
			}
		};

		stream = RocketChatFile.gm(readStream).identify(identify).stream();
	},

	uploadsOnValidate(file) {
		if (RocketChatFile.enabled === false || !/^image\/((x-windows-)?bmp|p?jpeg|png)$/.test(file.type)) {
			return;
		}

		const tmpFile = UploadFS.getTempFilePath(file._id);
		const fut = new Future();
		const identify = Meteor.bindEnvironment((err, data) => {
			if (err != null) {
				console.error(err);
				return fut.return();
			}

			file.identify = {
				format: data.format,
				size: data.size
			};

			if ([null, undefined, '', 'Unknown', 'Undefined'].includes(data.Orientation)) {
				return fut.return();
			}

			RocketChatFile.gm(tmpFile).autoOrient().write(tmpFile, Meteor.bindEnvironment(err => {
				if (err != null) {
					console.error(err);
				}

				const size = fs.lstatSync(tmpFile).size;
				this.getCollection().direct.update({
					_id: file._id
				}, {
					$set: {
						size
					}
				});
				fut.return();
			}));
		});
		RocketChatFile.gm(tmpFile).identify(identify);
		return fut.wait();
	},

	avatarsOnFinishUpload(file) {
		// update file record to match user's username
		const user = RocketChat.models.Users.findOneById(file.userId);
		const oldAvatar = RocketChat.models.Avatars.findOneByName(user.username);

		if (oldAvatar) {
			RocketChat.models.Avatars.deleteFile(oldAvatar._id);
		}

		RocketChat.models.Avatars.updateFileNameById(file._id, user.username); // console.log('upload finished ->', file);
	},

	requestCanAccessFiles({
		headers = {},
		query = {}
	}) {
		if (!RocketChat.settings.get('FileUpload_ProtectFiles')) {
			return true;
		}

		let {
			rc_uid,
			rc_token
		} = query;

		if (!rc_uid && headers.cookie) {
			rc_uid = cookie.get('rc_uid', headers.cookie);
			rc_token = cookie.get('rc_token', headers.cookie);
		}

		if (!rc_uid || !rc_token || !RocketChat.models.Users.findOneByIdAndLoginToken(rc_uid, rc_token)) {
			return false;
		}

		return true;
	},

	addExtensionTo(file) {
		if (mime.lookup(file.name) === file.type) {
			return file;
		}

		const ext = mime.extension(file.type);

		if (ext && false === new RegExp(`\.${ext}$`, 'i').test(file.name)) {
			file.name = `${file.name}.${ext}`;
		}

		return file;
	},

	getStore(modelName) {
		const storageType = RocketChat.settings.get('FileUpload_Storage_Type');
		const handlerName = `${storageType}:${modelName}`;
		return this.getStoreByName(handlerName);
	},

	getStoreByName(handlerName) {
		if (this.handlers[handlerName] == null) {
			console.error(`Upload handler "${handlerName}" does not exists`);
		}

		return this.handlers[handlerName];
	},

	get(file, req, res, next) {
		const store = this.getStoreByName(file.store);

		if (store && store.get) {
			return store.get(file, req, res, next);
		}

		res.writeHead(404);
		res.end();
	}

});

class FileUploadClass {
	constructor({
		name,
		model,
		store,
		get,
		insert,
		getStore
	}) {
		this.name = name;
		this.model = model || this.getModelFromName();
		this._store = store || UploadFS.getStore(name);
		this.get = get;

		if (insert) {
			this.insert = insert;
		}

		if (getStore) {
			this.getStore = getStore;
		}

		FileUpload.handlers[name] = this;
	}

	getStore() {
		return this._store;
	}

	get store() {
		return this.getStore();
	}

	set store(store) {
		this._store = store;
	}

	getModelFromName() {
		return RocketChat.models[this.name.split(':')[1]];
	}

	delete(fileId) {
		if (this.store && this.store.delete) {
			this.store.delete(fileId);
		}

		return this.model.deleteFile(fileId);
	}

	deleteById(fileId) {
		const file = this.model.findOneById(fileId);

		if (!file) {
			return;
		}

		const store = FileUpload.getStoreByName(file.store);
		return store.delete(file._id);
	}

	deleteByName(fileName) {
		const file = this.model.findOneByName(fileName);

		if (!file) {
			return;
		}

		const store = FileUpload.getStoreByName(file.store);
		return store.delete(file._id);
	}

	insert(fileData, streamOrBuffer, cb) {
		fileData.size = parseInt(fileData.size) || 0; // Check if the fileData matches store filter

		const filter = this.store.getFilter();

		if (filter && filter.check) {
			filter.check(fileData);
		}

		const fileId = this.store.create(fileData);
		const token = this.store.createToken(fileId);
		const tmpFile = UploadFS.getTempFilePath(fileId);

		try {
			if (streamOrBuffer instanceof stream) {
				streamOrBuffer.pipe(fs.createWriteStream(tmpFile));
			} else if (streamOrBuffer instanceof Buffer) {
				fs.writeFileSync(tmpFile, streamOrBuffer);
			} else {
				throw new Error('Invalid file type');
			}

			const file = Meteor.call('ufsComplete', fileId, this.name, token);

			if (cb) {
				cb(null, file);
			}

			return file;
		} catch (e) {
			if (cb) {
				cb(e);
			} else {
				throw e;
			}
		}
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"proxy.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/lib/proxy.js                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let http;
module.watch(require("http"), {
	default(v) {
		http = v;
	}

}, 0);
let URL;
module.watch(require("url"), {
	default(v) {
		URL = v;
	}

}, 1);
const logger = new Logger('UploadProxy');
WebApp.connectHandlers.stack.unshift({
	route: '',
	handle: Meteor.bindEnvironment(function (req, res, next) {
		// Quick check to see if request should be catch
		if (req.url.indexOf(UploadFS.config.storesPath) === -1) {
			return next();
		}

		logger.debug('Upload URL:', req.url);

		if (req.method !== 'POST') {
			return next();
		} // Remove store path


		const parsedUrl = URL.parse(req.url);
		const path = parsedUrl.pathname.substr(UploadFS.config.storesPath.length + 1); // Get store

		const regExp = new RegExp('^\/([^\/\?]+)\/([^\/\?]+)$');
		const match = regExp.exec(path); // Request is not valid

		if (match === null) {
			res.writeHead(400);
			res.end();
			return;
		} // Get store


		const store = UploadFS.getStore(match[1]);

		if (!store) {
			res.writeHead(404);
			res.end();
			return;
		} // Get file


		const fileId = match[2];
		const file = store.getCollection().findOne({
			_id: fileId
		});

		if (file === undefined) {
			res.writeHead(404);
			res.end();
			return;
		}

		if (file.instanceId === InstanceStatus.id()) {
			logger.debug('Correct instance');
			return next();
		} // Proxy to other instance


		const instance = InstanceStatus.getCollection().findOne({
			_id: file.instanceId
		});

		if (instance == null) {
			res.writeHead(404);
			res.end();
			return;
		}

		if (instance.extraInformation.host === process.env.INSTANCE_IP && RocketChat.isDocker() === false) {
			instance.extraInformation.host = 'localhost';
		}

		logger.debug('Wrong instance, proxing to:', `${instance.extraInformation.host}:${instance.extraInformation.port}`);
		const options = {
			hostname: instance.extraInformation.host,
			port: instance.extraInformation.port,
			path: req.originalUrl,
			method: 'POST'
		};
		const proxy = http.request(options, function (proxy_res) {
			proxy_res.pipe(res, {
				end: true
			});
		});
		req.pipe(proxy, {
			end: true
		});
	})
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"requests.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/lib/requests.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals FileUpload, WebApp */WebApp.connectHandlers.use(`${__meteor_runtime_config__.ROOT_URL_PATH_PREFIX}/file-upload/`, function (req, res, next) {
	const match = /^\/([^\/]+)\/(.*)/.exec(req.url);

	if (match[1]) {
		const file = RocketChat.models.Uploads.findOneById(match[1]);

		if (file) {
			if (!Meteor.settings.public.sandstorm && !FileUpload.requestCanAccessFiles(req)) {
				res.writeHead(403);
				return res.end();
			}

			res.setHeader('Content-Security-Policy', 'default-src \'none\'');
			return FileUpload.get(file, req, res, next);
		}
	}

	res.writeHead(404);
	res.end();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"config":{"_configUploadStorage.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/config/_configUploadStorage.js                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
module.watch(require("./AmazonS3.js"));
module.watch(require("./FileSystem.js"));
module.watch(require("./GoogleStorage.js"));
module.watch(require("./GridFS.js"));
module.watch(require("./Slingshot_DEPRECATED.js"));

const configStore = _.debounce(() => {
	const store = RocketChat.settings.get('FileUpload_Storage_Type');

	if (store) {
		console.log('Setting default file store to', store);
		UploadFS.getStores().Avatars = UploadFS.getStore(`${store}:Avatars`);
		UploadFS.getStores().Uploads = UploadFS.getStore(`${store}:Uploads`);
	}
}, 1000);

RocketChat.settings.get(/^FileUpload_/, configStore);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"AmazonS3.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/config/AmazonS3.js                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let FileUploadClass;
module.watch(require("../lib/FileUpload"), {
	FileUploadClass(v) {
		FileUploadClass = v;
	}

}, 1);
module.watch(require("../../ufs/AmazonS3/server.js"));

const get = function (file, req, res) {
	const fileUrl = this.store.getRedirectURL(file);

	if (fileUrl) {
		res.setHeader('Location', fileUrl);
		res.writeHead(302);
	}

	res.end();
};

const AmazonS3Uploads = new FileUploadClass({
	name: 'AmazonS3:Uploads',
	get // store setted bellow

});
const AmazonS3Avatars = new FileUploadClass({
	name: 'AmazonS3:Avatars',
	get // store setted bellow

});

const configure = _.debounce(function () {
	const Bucket = RocketChat.settings.get('FileUpload_S3_Bucket');
	const Acl = RocketChat.settings.get('FileUpload_S3_Acl');
	const AWSAccessKeyId = RocketChat.settings.get('FileUpload_S3_AWSAccessKeyId');
	const AWSSecretAccessKey = RocketChat.settings.get('FileUpload_S3_AWSSecretAccessKey');
	const URLExpiryTimeSpan = RocketChat.settings.get('FileUpload_S3_URLExpiryTimeSpan');
	const Region = RocketChat.settings.get('FileUpload_S3_Region');
	const SignatureVersion = RocketChat.settings.get('FileUpload_S3_SignatureVersion');
	const ForcePathStyle = RocketChat.settings.get('FileUpload_S3_ForcePathStyle'); // const CDN = RocketChat.settings.get('FileUpload_S3_CDN');

	const BucketURL = RocketChat.settings.get('FileUpload_S3_BucketURL');

	if (!Bucket || !AWSAccessKeyId || !AWSSecretAccessKey) {
		return;
	}

	const config = {
		connection: {
			accessKeyId: AWSAccessKeyId,
			secretAccessKey: AWSSecretAccessKey,
			signatureVersion: SignatureVersion,
			s3ForcePathStyle: ForcePathStyle,
			params: {
				Bucket,
				ACL: Acl
			},
			region: Region
		},
		URLExpiryTimeSpan
	};

	if (BucketURL) {
		config.connection.endpoint = BucketURL;
	}

	AmazonS3Uploads.store = FileUpload.configureUploadsStore('AmazonS3', AmazonS3Uploads.name, config);
	AmazonS3Avatars.store = FileUpload.configureUploadsStore('AmazonS3', AmazonS3Avatars.name, config);
}, 500);

RocketChat.settings.get(/^FileUpload_S3_/, configure);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"FileSystem.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/config/FileSystem.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let fs;
module.watch(require("fs"), {
	default(v) {
		fs = v;
	}

}, 1);
let FileUploadClass;
module.watch(require("../lib/FileUpload"), {
	FileUploadClass(v) {
		FileUploadClass = v;
	}

}, 2);
const FileSystemUploads = new FileUploadClass({
	name: 'FileSystem:Uploads',

	// store setted bellow
	get(file, req, res) {
		const filePath = this.store.getFilePath(file._id, file);

		try {
			const stat = Meteor.wrapAsync(fs.stat)(filePath);

			if (stat && stat.isFile()) {
				file = FileUpload.addExtensionTo(file);
				res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
				res.setHeader('Last-Modified', file.uploadedAt.toUTCString());
				res.setHeader('Content-Type', file.type);
				res.setHeader('Content-Length', file.size);
				this.store.getReadStream(file._id, file).pipe(res);
			}
		} catch (e) {
			res.writeHead(404);
			res.end();
			return;
		}
	}

});
const FileSystemAvatars = new FileUploadClass({
	name: 'FileSystem:Avatars',

	// store setted bellow
	get(file, req, res) {
		const reqModifiedHeader = req.headers['if-modified-since'];

		if (reqModifiedHeader) {
			if (reqModifiedHeader === (file.uploadedAt && file.uploadedAt.toUTCString())) {
				res.setHeader('Last-Modified', reqModifiedHeader);
				res.writeHead(304);
				res.end();
				return;
			}
		}

		const filePath = this.store.getFilePath(file._id, file);

		try {
			const stat = Meteor.wrapAsync(fs.stat)(filePath);

			if (stat && stat.isFile()) {
				file = FileUpload.addExtensionTo(file);
				res.setHeader('Content-Disposition', 'inline');
				res.setHeader('Last-Modified', file.uploadedAt.toUTCString());
				res.setHeader('Content-Type', file.type);
				res.setHeader('Content-Length', file.size);
				this.store.getReadStream(file._id, file).pipe(res);
			}
		} catch (e) {
			res.writeHead(404);
			res.end();
			return;
		}
	}

});

const createFileSystemStore = _.debounce(function () {
	const options = {
		path: RocketChat.settings.get('FileUpload_FileSystemPath') //'/tmp/uploads/photos',

	};
	FileSystemUploads.store = FileUpload.configureUploadsStore('Local', FileSystemUploads.name, options);
	FileSystemAvatars.store = FileUpload.configureUploadsStore('Local', FileSystemAvatars.name, options); // DEPRECATED backwards compatibililty (remove)

	UploadFS.getStores()['fileSystem'] = UploadFS.getStores()[FileSystemUploads.name];
}, 500);

RocketChat.settings.get('FileUpload_FileSystemPath', createFileSystemStore);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"GoogleStorage.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/config/GoogleStorage.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let FileUploadClass;
module.watch(require("../lib/FileUpload"), {
	FileUploadClass(v) {
		FileUploadClass = v;
	}

}, 1);
module.watch(require("../../ufs/GoogleStorage/server.js"));

const get = function (file, req, res) {
	this.store.getRedirectURL(file, (err, fileUrl) => {
		if (err) {
			console.error(err);
		}

		if (fileUrl) {
			res.setHeader('Location', fileUrl);
			res.writeHead(302);
		}

		res.end();
	});
};

const GoogleCloudStorageUploads = new FileUploadClass({
	name: 'GoogleCloudStorage:Uploads',
	get // store setted bellow

});
const GoogleCloudStorageAvatars = new FileUploadClass({
	name: 'GoogleCloudStorage:Avatars',
	get // store setted bellow

});

const configure = _.debounce(function () {
	const bucket = RocketChat.settings.get('FileUpload_GoogleStorage_Bucket');
	const accessId = RocketChat.settings.get('FileUpload_GoogleStorage_AccessId');
	const secret = RocketChat.settings.get('FileUpload_GoogleStorage_Secret');
	const URLExpiryTimeSpan = RocketChat.settings.get('FileUpload_S3_URLExpiryTimeSpan');

	if (!bucket || !accessId || !secret) {
		return;
	}

	const config = {
		connection: {
			credentials: {
				client_email: accessId,
				private_key: secret
			}
		},
		bucket,
		URLExpiryTimeSpan
	};
	GoogleCloudStorageUploads.store = FileUpload.configureUploadsStore('GoogleStorage', GoogleCloudStorageUploads.name, config);
	GoogleCloudStorageAvatars.store = FileUpload.configureUploadsStore('GoogleStorage', GoogleCloudStorageAvatars.name, config);
}, 500);

RocketChat.settings.get(/^FileUpload_GoogleStorage_/, configure);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"GridFS.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/config/GridFS.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let stream;
module.watch(require("stream"), {
	default(v) {
		stream = v;
	}

}, 0);
let zlib;
module.watch(require("zlib"), {
	default(v) {
		zlib = v;
	}

}, 1);
let util;
module.watch(require("util"), {
	default(v) {
		util = v;
	}

}, 2);
let FileUploadClass;
module.watch(require("../lib/FileUpload"), {
	FileUploadClass(v) {
		FileUploadClass = v;
	}

}, 3);
const logger = new Logger('FileUpload');

function ExtractRange(options) {
	if (!(this instanceof ExtractRange)) {
		return new ExtractRange(options);
	}

	this.start = options.start;
	this.stop = options.stop;
	this.bytes_read = 0;
	stream.Transform.call(this, options);
}

util.inherits(ExtractRange, stream.Transform);

ExtractRange.prototype._transform = function (chunk, enc, cb) {
	if (this.bytes_read > this.stop) {
		// done reading
		this.end();
	} else if (this.bytes_read + chunk.length < this.start) {// this chunk is still before the start byte
	} else {
		let start;
		let stop;

		if (this.start <= this.bytes_read) {
			start = 0;
		} else {
			start = this.start - this.bytes_read;
		}

		if (this.stop - this.bytes_read + 1 < chunk.length) {
			stop = this.stop - this.bytes_read + 1;
		} else {
			stop = chunk.length;
		}

		const newchunk = chunk.slice(start, stop);
		this.push(newchunk);
	}

	this.bytes_read += chunk.length;
	cb();
};

const getByteRange = function (header) {
	if (header) {
		const matches = header.match(/(\d+)-(\d+)/);

		if (matches) {
			return {
				start: parseInt(matches[1], 10),
				stop: parseInt(matches[2], 10)
			};
		}
	}

	return null;
}; // code from: https://github.com/jalik/jalik-ufs/blob/master/ufs-server.js#L310


const readFromGridFS = function (storeName, fileId, file, headers, req, res) {
	const store = UploadFS.getStore(storeName);
	const rs = store.getReadStream(fileId, file);
	const ws = new stream.PassThrough();
	[rs, ws].forEach(stream => stream.on('error', function (err) {
		store.onReadError.call(store, err, fileId, file);
		res.end();
	}));
	ws.on('close', function () {
		// Close output stream at the end
		ws.emit('end');
	});
	const accept = req.headers['accept-encoding'] || ''; // Transform stream

	store.transformRead(rs, ws, fileId, file, req, headers);
	const range = getByteRange(req.headers.range);
	let out_of_range = false;

	if (range) {
		out_of_range = range.start > file.size || range.stop <= range.start || range.stop > file.size;
	} // Compress data using gzip


	if (accept.match(/\bgzip\b/) && range === null) {
		headers['Content-Encoding'] = 'gzip';
		delete headers['Content-Length'];
		res.writeHead(200, headers);
		ws.pipe(zlib.createGzip()).pipe(res);
	} else if (accept.match(/\bdeflate\b/) && range === null) {
		// Compress data using deflate
		headers['Content-Encoding'] = 'deflate';
		delete headers['Content-Length'];
		res.writeHead(200, headers);
		ws.pipe(zlib.createDeflate()).pipe(res);
	} else if (range && out_of_range) {
		// out of range request, return 416
		delete headers['Content-Length'];
		delete headers['Content-Type'];
		delete headers['Content-Disposition'];
		delete headers['Last-Modified'];
		headers['Content-Range'] = `bytes */${file.size}`;
		res.writeHead(416, headers);
		res.end();
	} else if (range) {
		headers['Content-Range'] = `bytes ${range.start}-${range.stop}/${file.size}`;
		delete headers['Content-Length'];
		headers['Content-Length'] = range.stop - range.start + 1;
		res.writeHead(206, headers);
		logger.debug('File upload extracting range');
		ws.pipe(new ExtractRange({
			start: range.start,
			stop: range.stop
		})).pipe(res);
	} else {
		res.writeHead(200, headers);
		ws.pipe(res);
	}
};

FileUpload.configureUploadsStore('GridFS', 'GridFS:Uploads', {
	collectionName: 'rocketchat_uploads'
}); // DEPRECATED: backwards compatibility (remove)

UploadFS.getStores()['rocketchat_uploads'] = UploadFS.getStores()['GridFS:Uploads'];
FileUpload.configureUploadsStore('GridFS', 'GridFS:Avatars', {
	collectionName: 'rocketchat_avatars'
});
new FileUploadClass({
	name: 'GridFS:Uploads',

	get(file, req, res) {
		file = FileUpload.addExtensionTo(file);
		const headers = {
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			'Last-Modified': file.uploadedAt.toUTCString(),
			'Content-Type': file.type,
			'Content-Length': file.size
		};
		return readFromGridFS(file.store, file._id, file, headers, req, res);
	}

});
new FileUploadClass({
	name: 'GridFS:Avatars',

	get(file, req, res) {
		const reqModifiedHeader = req.headers['if-modified-since'];

		if (reqModifiedHeader && reqModifiedHeader === (file.uploadedAt && file.uploadedAt.toUTCString())) {
			res.setHeader('Last-Modified', reqModifiedHeader);
			res.writeHead(304);
			res.end();
			return;
		}

		file = FileUpload.addExtensionTo(file);
		const headers = {
			'Cache-Control': 'public, max-age=0',
			'Expires': '-1',
			'Content-Disposition': 'inline',
			'Last-Modified': file.uploadedAt.toUTCString(),
			'Content-Type': file.type,
			'Content-Length': file.size
		};
		return readFromGridFS(file.store, file._id, file, headers, req, res);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Slingshot_DEPRECATED.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/config/Slingshot_DEPRECATED.js                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

const configureSlingshot = _.debounce(() => {
	const type = RocketChat.settings.get('FileUpload_Storage_Type');
	const bucket = RocketChat.settings.get('FileUpload_S3_Bucket');
	const acl = RocketChat.settings.get('FileUpload_S3_Acl');
	const accessKey = RocketChat.settings.get('FileUpload_S3_AWSAccessKeyId');
	const secretKey = RocketChat.settings.get('FileUpload_S3_AWSSecretAccessKey');
	const cdn = RocketChat.settings.get('FileUpload_S3_CDN');
	const region = RocketChat.settings.get('FileUpload_S3_Region');
	const bucketUrl = RocketChat.settings.get('FileUpload_S3_BucketURL');
	delete Slingshot._directives['rocketchat-uploads'];

	if (type === 'AmazonS3' && !_.isEmpty(bucket) && !_.isEmpty(accessKey) && !_.isEmpty(secretKey)) {
		if (Slingshot._directives['rocketchat-uploads']) {
			delete Slingshot._directives['rocketchat-uploads'];
		}

		const config = {
			bucket,

			key(file, metaContext) {
				const id = Random.id();
				const path = `${RocketChat.settings.get('uniqueID')}/uploads/${metaContext.rid}/${this.userId}/${id}`;
				const upload = {
					_id: id,
					rid: metaContext.rid,
					AmazonS3: {
						path
					}
				};
				RocketChat.models.Uploads.insertFileInit(this.userId, 'AmazonS3:Uploads', file, upload);
				return path;
			},

			AWSAccessKeyId: accessKey,
			AWSSecretAccessKey: secretKey
		};

		if (!_.isEmpty(acl)) {
			config.acl = acl;
		}

		if (!_.isEmpty(cdn)) {
			config.cdn = cdn;
		}

		if (!_.isEmpty(region)) {
			config.region = region;
		}

		if (!_.isEmpty(bucketUrl)) {
			config.bucketUrl = bucketUrl;
		}

		try {
			Slingshot.createDirective('rocketchat-uploads', Slingshot.S3Storage, config);
		} catch (e) {
			console.error('Error configuring S3 ->', e.message);
		}
	}
}, 500);

RocketChat.settings.get('FileUpload_Storage_Type', configureSlingshot);
RocketChat.settings.get(/^FileUpload_S3_/, configureSlingshot);

const createGoogleStorageDirective = _.debounce(() => {
	const type = RocketChat.settings.get('FileUpload_Storage_Type');
	const bucket = RocketChat.settings.get('FileUpload_GoogleStorage_Bucket');
	const accessId = RocketChat.settings.get('FileUpload_GoogleStorage_AccessId');
	const secret = RocketChat.settings.get('FileUpload_GoogleStorage_Secret');
	delete Slingshot._directives['rocketchat-uploads-gs'];

	if (type === 'GoogleCloudStorage' && !_.isEmpty(secret) && !_.isEmpty(accessId) && !_.isEmpty(bucket)) {
		if (Slingshot._directives['rocketchat-uploads-gs']) {
			delete Slingshot._directives['rocketchat-uploads-gs'];
		}

		const config = {
			bucket,
			GoogleAccessId: accessId,
			GoogleSecretKey: secret,

			key(file, metaContext) {
				const id = Random.id();
				const path = `${RocketChat.settings.get('uniqueID')}/uploads/${metaContext.rid}/${this.userId}/${id}`;
				const upload = {
					_id: id,
					rid: metaContext.rid,
					GoogleStorage: {
						path
					}
				};
				RocketChat.models.Uploads.insertFileInit(this.userId, 'GoogleCloudStorage:Uploads', file, upload);
				return path;
			}

		};

		try {
			Slingshot.createDirective('rocketchat-uploads-gs', Slingshot.GoogleCloud, config);
		} catch (e) {
			console.error('Error configuring GoogleCloudStorage ->', e.message);
		}
	}
}, 500);

RocketChat.settings.get('FileUpload_Storage_Type', createGoogleStorageDirective);
RocketChat.settings.get(/^FileUpload_GoogleStorage_/, createGoogleStorageDirective);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"sendFileMessage.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/methods/sendFileMessage.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	'sendFileMessage'(roomId, store, file, msgData = {}) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'sendFileMessage'
			});
		}

		const room = Meteor.call('canAccessRoom', roomId, Meteor.userId());

		if (!room) {
			return false;
		}

		check(msgData, {
			avatar: Match.Optional(String),
			emoji: Match.Optional(String),
			alias: Match.Optional(String),
			groupable: Match.Optional(Boolean),
			msg: Match.Optional(String)
		});
		RocketChat.models.Uploads.updateFileComplete(file._id, Meteor.userId(), _.omit(file, '_id'));
		const fileUrl = `/file-upload/${file._id}/${encodeURI(file.name)}`;
		const attachment = {
			title: file.name,
			type: 'file',
			description: file.description,
			title_link: fileUrl,
			title_link_download: true
		};

		if (/^image\/.+/.test(file.type)) {
			attachment.image_url = fileUrl;
			attachment.image_type = file.type;
			attachment.image_size = file.size;

			if (file.identify && file.identify.size) {
				attachment.image_dimensions = file.identify.size;
			}
		} else if (/^audio\/.+/.test(file.type)) {
			attachment.audio_url = fileUrl;
			attachment.audio_type = file.type;
			attachment.audio_size = file.size;
		} else if (/^video\/.+/.test(file.type)) {
			attachment.video_url = fileUrl;
			attachment.video_type = file.type;
			attachment.video_size = file.size;
		}

		const user = Meteor.user();
		let msg = Object.assign({
			_id: Random.id(),
			rid: roomId,
			ts: new Date(),
			msg: '',
			file: {
				_id: file._id,
				name: file.name,
				type: file.type
			},
			groupable: false,
			attachments: [attachment]
		}, msgData);
		msg = Meteor.call('sendMessage', msg);
		Meteor.defer(() => RocketChat.callbacks.run('afterFileUpload', {
			user,
			room,
			message: msg
		}));
		return msg;
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getS3FileUrl.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/methods/getS3FileUrl.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals UploadFS */let protectedFiles;
RocketChat.settings.get('FileUpload_ProtectFiles', function (key, value) {
	protectedFiles = value;
});
Meteor.methods({
	getS3FileUrl(fileId) {
		if (protectedFiles && !Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'sendFileMessage'
			});
		}

		const file = RocketChat.models.Uploads.findOneById(fileId);
		return UploadFS.getStore('AmazonS3:Uploads').getRedirectURL(file);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup":{"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/server/startup/settings.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
RocketChat.settings.addGroup('FileUpload', function () {
	this.add('FileUpload_Enabled', true, {
		type: 'boolean',
		public: true
	});
	this.add('FileUpload_MaxFileSize', 2097152, {
		type: 'int',
		public: true
	});
	this.add('FileUpload_MediaTypeWhiteList', 'image/*,audio/*,video/*,application/zip,application/x-rar-compressed,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
		type: 'string',
		public: true,
		i18nDescription: 'FileUpload_MediaTypeWhiteListDescription'
	});
	this.add('FileUpload_ProtectFiles', true, {
		type: 'boolean',
		public: true,
		i18nDescription: 'FileUpload_ProtectFilesDescription'
	});
	this.add('FileUpload_Storage_Type', 'GridFS', {
		type: 'select',
		values: [{
			key: 'GridFS',
			i18nLabel: 'GridFS'
		}, {
			key: 'AmazonS3',
			i18nLabel: 'AmazonS3'
		}, {
			key: 'GoogleCloudStorage',
			i18nLabel: 'GoogleCloudStorage'
		}, {
			key: 'FileSystem',
			i18nLabel: 'FileSystem'
		}],
		public: true
	});
	this.section('Amazon S3', function () {
		this.add('FileUpload_S3_Bucket', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_Acl', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_AWSAccessKeyId', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_AWSSecretAccessKey', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_CDN', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_Region', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_BucketURL', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			},
			i18nDescription: 'Override_URL_to_which_files_are_uploaded_This_url_also_used_for_downloads_unless_a_CDN_is_given.'
		});
		this.add('FileUpload_S3_SignatureVersion', 'v4', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_ForcePathStyle', false, {
			type: 'boolean',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			}
		});
		this.add('FileUpload_S3_URLExpiryTimeSpan', 120, {
			type: 'int',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'AmazonS3'
			},
			i18nDescription: 'FileUpload_S3_URLExpiryTimeSpan_Description'
		});
	});
	this.section('Google Cloud Storage', function () {
		this.add('FileUpload_GoogleStorage_Bucket', '', {
			type: 'string',
			private: true,
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'GoogleCloudStorage'
			}
		});
		this.add('FileUpload_GoogleStorage_AccessId', '', {
			type: 'string',
			private: true,
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'GoogleCloudStorage'
			}
		});
		this.add('FileUpload_GoogleStorage_Secret', '', {
			type: 'string',
			multiline: true,
			private: true,
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'GoogleCloudStorage'
			}
		});
	});
	this.section('File System', function () {
		this.add('FileUpload_FileSystemPath', '', {
			type: 'string',
			enableQuery: {
				_id: 'FileUpload_Storage_Type',
				value: 'FileSystem'
			}
		});
	});
	this.add('FileUpload_Enabled_Direct', true, {
		type: 'boolean',
		public: true
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"ufs":{"AmazonS3":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/ufs/AmazonS3/server.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	AmazonS3Store: () => AmazonS3Store
});
let UploadFS;
module.watch(require("meteor/jalik:ufs"), {
	UploadFS(v) {
		UploadFS = v;
	}

}, 0);

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 1);
let S3;
module.watch(require("aws-sdk/clients/s3"), {
	default(v) {
		S3 = v;
	}

}, 2);
let stream;
module.watch(require("stream"), {
	default(v) {
		stream = v;
	}

}, 3);

class AmazonS3Store extends UploadFS.Store {
	constructor(options) {
		// Default options
		// options.secretAccessKey,
		// options.accessKeyId,
		// options.region,
		// options.sslEnabled // optional
		options = _.extend({
			httpOptions: {
				timeout: 6000,
				agent: false
			}
		}, options);
		super(options);
		const classOptions = options;
		const s3 = new S3(options.connection);

		options.getPath = options.getPath || function (file) {
			return file._id;
		};

		this.getPath = function (file) {
			if (file.AmazonS3) {
				return file.AmazonS3.path;
			} // Compatibility
			// TODO: Migration


			if (file.s3) {
				return file.s3.path + file._id;
			}
		};

		this.getRedirectURL = function (file) {
			const params = {
				Key: this.getPath(file),
				Expires: classOptions.URLExpiryTimeSpan
			};
			return s3.getSignedUrl('getObject', params);
		}; /**
      * Creates the file in the collection
      * @param file
      * @param callback
      * @return {string}
      */

		this.create = function (file, callback) {
			check(file, Object);

			if (file._id == null) {
				file._id = Random.id();
			}

			file.AmazonS3 = {
				path: this.options.getPath(file)
			};
			file.store = this.options.name; // assign store to file

			return this.getCollection().insert(file, callback);
		}; /**
      * Removes the file
      * @param fileId
      * @param callback
      */

		this.delete = function (fileId, callback) {
			const file = this.getCollection().findOne({
				_id: fileId
			});
			const params = {
				Key: this.getPath(file)
			};
			s3.deleteObject(params, (err, data) => {
				if (err) {
					console.error(err);
				}

				callback && callback(err, data);
			});
		}; /**
      * Returns the file read stream
      * @param fileId
      * @param file
      * @param options
      * @return {*}
      */

		this.getReadStream = function (fileId, file, options = {}) {
			const params = {
				Key: this.getPath(file)
			};

			if (options.start && options.end) {
				params.Range = `${options.start} - ${options.end}`;
			}

			return s3.getObject(params).createReadStream();
		}; /**
      * Returns the file write stream
      * @param fileId
      * @param file
      * @param options
      * @return {*}
      */

		this.getWriteStream = function (fileId, file /*, options*/) {
			const writeStream = new stream.PassThrough();
			writeStream.length = file.size;
			writeStream.on('newListener', (event, listener) => {
				if (event === 'finish') {
					process.nextTick(() => {
						writeStream.removeListener(event, listener);
						writeStream.on('real_finish', listener);
					});
				}
			});
			s3.putObject({
				Key: this.getPath(file),
				Body: writeStream,
				ContentType: file.type,
				ContentDisposition: `inline; filename="${encodeURI(file.name)}"`
			}, error => {
				if (error) {
					console.error(error);
				}

				writeStream.emit('real_finish');
			});
			return writeStream;
		};
	}

}

// Add store to UFS namespace
UploadFS.store.AmazonS3 = AmazonS3Store;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"GoogleStorage":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_file-upload/ufs/GoogleStorage/server.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	GoogleStorageStore: () => GoogleStorageStore
});
let UploadFS;
module.watch(require("meteor/jalik:ufs"), {
	UploadFS(v) {
		UploadFS = v;
	}

}, 0);
let gcStorage;
module.watch(require("@google-cloud/storage"), {
	default(v) {
		gcStorage = v;
	}

}, 1);

class GoogleStorageStore extends UploadFS.Store {
	constructor(options) {
		super(options);
		const gcs = gcStorage(options.connection);
		this.bucket = gcs.bucket(options.bucket);

		options.getPath = options.getPath || function (file) {
			return file._id;
		};

		this.getPath = function (file) {
			if (file.GoogleStorage) {
				return file.GoogleStorage.path;
			} // Compatibility
			// TODO: Migration


			if (file.googleCloudStorage) {
				return file.googleCloudStorage.path + file._id;
			}
		};

		this.getRedirectURL = function (file, callback) {
			const params = {
				action: 'read',
				responseDisposition: 'inline',
				expires: Date.now() + this.options.URLExpiryTimeSpan * 1000
			};
			this.bucket.file(this.getPath(file)).getSignedUrl(params, callback);
		}; /**
      * Creates the file in the collection
      * @param file
      * @param callback
      * @return {string}
      */

		this.create = function (file, callback) {
			check(file, Object);

			if (file._id == null) {
				file._id = Random.id();
			}

			file.GoogleStorage = {
				path: this.options.getPath(file)
			};
			file.store = this.options.name; // assign store to file

			return this.getCollection().insert(file, callback);
		}; /**
      * Removes the file
      * @param fileId
      * @param callback
      */

		this.delete = function (fileId, callback) {
			const file = this.getCollection().findOne({
				_id: fileId
			});
			this.bucket.file(this.getPath(file)).delete(function (err, data) {
				if (err) {
					console.error(err);
				}

				callback && callback(err, data);
			});
		}; /**
      * Returns the file read stream
      * @param fileId
      * @param file
      * @param options
      * @return {*}
      */

		this.getReadStream = function (fileId, file, options = {}) {
			const config = {};

			if (options.start != null) {
				config.start = options.start;
			}

			if (options.end != null) {
				config.end = options.end;
			}

			return this.bucket.file(this.getPath(file)).createReadStream(config);
		}; /**
      * Returns the file write stream
      * @param fileId
      * @param file
      * @param options
      * @return {*}
      */

		this.getWriteStream = function (fileId, file /*, options*/) {
			return this.bucket.file(this.getPath(file)).createWriteStream({
				gzip: false,
				metadata: {
					contentType: file.type,
					contentDisposition: `inline; filename=${file.name}` // metadata: {
					// 	custom: 'metadata'
					// }

				}
			});
		};
	}

}

// Add store to UFS namespace
UploadFS.store.GoogleStorage = GoogleStorageStore;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"node_modules":{"filesize":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// ../../.meteor/local/isopacks/rocketchat_file-upload/npm/node_modules/filesize/package.json                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
exports.name = "filesize";
exports.version = "3.3.0";
exports.main = "lib/filesize";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"filesize.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/rocketchat_file-upload/node_modules/filesize/lib/filesize.js                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
"use strict";

/**
 * filesize
 *
 * @copyright 2016 Jason Mulligan <jason.mulligan@avoidwork.com>
 * @license BSD-3-Clause
 * @version 3.3.0
 */
(function (global) {
	var b = /^(b|B)$/;
	var symbol = {
		iec: {
			bits: ["b", "Kib", "Mib", "Gib", "Tib", "Pib", "Eib", "Zib", "Yib"],
			bytes: ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
		},
		jedec: {
			bits: ["b", "Kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb"],
			bytes: ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
		}
	};

	/**
  * filesize
  *
  * @method filesize
  * @param  {Mixed}   arg        String, Int or Float to transform
  * @param  {Object}  descriptor [Optional] Flags
  * @return {String}             Readable file size String
  */
	function filesize(arg) {
		var descriptor = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

		var result = [],
		    val = 0,
		    e = void 0,
		    base = void 0,
		    bits = void 0,
		    ceil = void 0,
		    neg = void 0,
		    num = void 0,
		    output = void 0,
		    round = void 0,
		    unix = void 0,
		    spacer = void 0,
		    standard = void 0,
		    symbols = void 0;

		if (isNaN(arg)) {
			throw new Error("Invalid arguments");
		}

		bits = descriptor.bits === true;
		unix = descriptor.unix === true;
		base = descriptor.base || 2;
		round = descriptor.round !== undefined ? descriptor.round : unix ? 1 : 2;
		spacer = descriptor.spacer !== undefined ? descriptor.spacer : unix ? "" : " ";
		symbols = descriptor.symbols || descriptor.suffixes || {};
		standard = base === 2 ? descriptor.standard || "jedec" : "jedec";
		output = descriptor.output || "string";
		e = descriptor.exponent !== undefined ? descriptor.exponent : -1;
		num = Number(arg);
		neg = num < 0;
		ceil = base > 2 ? 1000 : 1024;

		// Flipping a negative number to determine the size
		if (neg) {
			num = -num;
		}

		// Zero is now a special case because bytes divide by 1
		if (num === 0) {
			result[0] = 0;
			result[1] = unix ? "" : !bits ? "B" : "b";
		} else {
			// Determining the exponent
			if (e === -1 || isNaN(e)) {
				e = Math.floor(Math.log(num) / Math.log(ceil));

				if (e < 0) {
					e = 0;
				}
			}

			// Exceeding supported length, time to reduce & multiply
			if (e > 8) {
				e = 8;
			}

			val = base === 2 ? num / Math.pow(2, e * 10) : num / Math.pow(1000, e);

			if (bits) {
				val = val * 8;

				if (val > ceil && e < 8) {
					val = val / ceil;
					e++;
				}
			}

			result[0] = Number(val.toFixed(e > 0 ? round : 0));
			result[1] = base === 10 && e === 1 ? bits ? "kb" : "kB" : symbol[standard][bits ? "bits" : "bytes"][e];

			if (unix) {
				result[1] = standard === "jedec" ? result[1].charAt(0) : e > 0 ? result[1].replace(/B$/, "") : result[1];

				if (b.test(result[1])) {
					result[0] = Math.floor(result[0]);
					result[1] = "";
				}
			}
		}

		// Decorating a 'diff'
		if (neg) {
			result[0] = -result[0];
		}

		// Applying custom symbol
		result[1] = symbols[result[1]] || result[1];

		// Returning Array, Object, or String (default)
		if (output === "array") {
			return result;
		}

		if (output === "exponent") {
			return e;
		}

		if (output === "object") {
			return { value: result[0], suffix: result[1], symbol: result[1] };
		}

		return result.join(spacer);
	}

	// CommonJS, AMD, script tag
	if (typeof exports !== "undefined") {
		module.exports = filesize;
	} else if (typeof define === "function" && define.amd) {
		define(function () {
			return filesize;
		});
	} else {
		global.filesize = filesize;
	}
})(typeof window !== "undefined" ? window : global);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:file-upload/globalFileRestrictions.js");
require("./node_modules/meteor/rocketchat:file-upload/lib/FileUpload.js");
require("./node_modules/meteor/rocketchat:file-upload/lib/FileUploadBase.js");
require("./node_modules/meteor/rocketchat:file-upload/server/lib/FileUpload.js");
require("./node_modules/meteor/rocketchat:file-upload/server/lib/proxy.js");
require("./node_modules/meteor/rocketchat:file-upload/server/lib/requests.js");
require("./node_modules/meteor/rocketchat:file-upload/server/config/_configUploadStorage.js");
require("./node_modules/meteor/rocketchat:file-upload/server/methods/sendFileMessage.js");
require("./node_modules/meteor/rocketchat:file-upload/server/methods/getS3FileUrl.js");
require("./node_modules/meteor/rocketchat:file-upload/server/startup/settings.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:file-upload'] = {}, {
  fileUploadHandler: fileUploadHandler,
  FileUpload: FileUpload
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_file-upload.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlLXVwbG9hZC9nbG9iYWxGaWxlUmVzdHJpY3Rpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL2xpYi9GaWxlVXBsb2FkLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL2xpYi9GaWxlVXBsb2FkQmFzZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlLXVwbG9hZC9zZXJ2ZXIvbGliL0ZpbGVVcGxvYWQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZmlsZS11cGxvYWQvc2VydmVyL2xpYi9wcm94eS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlLXVwbG9hZC9zZXJ2ZXIvbGliL3JlcXVlc3RzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL3NlcnZlci9jb25maWcvX2NvbmZpZ1VwbG9hZFN0b3JhZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZmlsZS11cGxvYWQvc2VydmVyL2NvbmZpZy9BbWF6b25TMy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlLXVwbG9hZC9zZXJ2ZXIvY29uZmlnL0ZpbGVTeXN0ZW0uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZmlsZS11cGxvYWQvc2VydmVyL2NvbmZpZy9Hb29nbGVTdG9yYWdlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL3NlcnZlci9jb25maWcvR3JpZEZTLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL3NlcnZlci9jb25maWcvU2xpbmdzaG90X0RFUFJFQ0FURUQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6ZmlsZS11cGxvYWQvc2VydmVyL21ldGhvZHMvc2VuZEZpbGVNZXNzYWdlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL3NlcnZlci9tZXRob2RzL2dldFMzRmlsZVVybC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlLXVwbG9hZC9zZXJ2ZXIvc3RhcnR1cC9zZXR0aW5ncy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpmaWxlLXVwbG9hZC91ZnMvQW1hem9uUzMvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmZpbGUtdXBsb2FkL3Vmcy9Hb29nbGVTdG9yYWdlL3NlcnZlci5qcyJdLCJuYW1lcyI6WyJmaWxlc2l6ZSIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2Iiwic2xpbmdTaG90Q29uZmlnIiwiYXV0aG9yaXplIiwiZmlsZSIsInVzZXJJZCIsIk1ldGVvciIsIkVycm9yIiwiUm9ja2V0Q2hhdCIsImZpbGVVcGxvYWRJc1ZhbGlkQ29udGVudFR5cGUiLCJ0eXBlIiwiVEFQaTE4biIsIl9fIiwibWF4RmlsZVNpemUiLCJzZXR0aW5ncyIsImdldCIsInNpemUiLCJtYXhTaXplIiwiYWxsb3dlZEZpbGVUeXBlcyIsIlNsaW5nc2hvdCIsImZpbGVSZXN0cmljdGlvbnMiLCJGaWxlVXBsb2FkIiwidmFsaWRhdGVGaWxlVXBsb2FkIiwiTWF0Y2giLCJ0ZXN0IiwicmlkIiwiU3RyaW5nIiwidXNlciIsInJvb20iLCJtb2RlbHMiLCJSb29tcyIsImZpbmRPbmVCeUlkIiwiZGlyZWN0TWVzc2FnZUFsbG93IiwiZmlsZVVwbG9hZEFsbG93ZWQiLCJhdXRoeiIsImNhbkFjY2Vzc1Jvb20iLCJyZWFzb24iLCJsYW5ndWFnZSIsInQiLCJwYXJzZUludCIsImtleSIsInZhbHVlIiwiXyIsIlVwbG9hZEZTIiwiY29uZmlnIiwiZGVmYXVsdFN0b3JlUGVybWlzc2lvbnMiLCJTdG9yZVBlcm1pc3Npb25zIiwiaW5zZXJ0IiwiZG9jIiwibWVzc2FnZV9pZCIsImluZGV4T2YiLCJ1cGRhdGUiLCJoYXNQZXJtaXNzaW9uIiwicmVtb3ZlIiwiRmlsZVVwbG9hZEJhc2UiLCJjb25zdHJ1Y3RvciIsInN0b3JlIiwibWV0YSIsImlkIiwiUmFuZG9tIiwiZ2V0UHJvZ3Jlc3MiLCJnZXRGaWxlTmFtZSIsIm5hbWUiLCJzdGFydCIsImNhbGxiYWNrIiwiaGFuZGxlciIsIlVwbG9hZGVyIiwiZGF0YSIsIm9uRXJyb3IiLCJlcnIiLCJvbkNvbXBsZXRlIiwiZmlsZURhdGEiLCJwaWNrIiwidXJsIiwicmVwbGFjZSIsImFic29sdXRlVXJsIiwib3B0aW9ucyIsIm9uUHJvZ3Jlc3MiLCJwcm9ncmVzcyIsInN0b3AiLCJleHBvcnQiLCJGaWxlVXBsb2FkQ2xhc3MiLCJmcyIsInN0cmVhbSIsIm1pbWUiLCJGdXR1cmUiLCJDb29raWVzIiwiY29va2llIiwiT2JqZWN0IiwiYXNzaWduIiwiaGFuZGxlcnMiLCJjb25maWd1cmVVcGxvYWRzU3RvcmUiLCJzcGxpdCIsInBvcCIsInN0b3JlcyIsImdldFN0b3JlcyIsImRlZmF1bHRVcGxvYWRzIiwiY29sbGVjdGlvbiIsIlVwbG9hZHMiLCJtb2RlbCIsImZpbHRlciIsIkZpbHRlciIsIm9uQ2hlY2siLCJnZXRQYXRoIiwiX2lkIiwib25WYWxpZGF0ZSIsInVwbG9hZHNPblZhbGlkYXRlIiwib25SZWFkIiwiZmlsZUlkIiwicmVxIiwicmVzIiwicmVxdWVzdENhbkFjY2Vzc0ZpbGVzIiwid3JpdGVIZWFkIiwic2V0SGVhZGVyIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZGVmYXVsdEF2YXRhcnMiLCJBdmF0YXJzIiwiYXZhdGFyc09uVmFsaWRhdGUiLCJvbkZpbmlzaFVwbG9hZCIsImF2YXRhcnNPbkZpbmlzaFVwbG9hZCIsImF2YXRhclRyYW5zZm9ybVdyaXRlIiwicmVhZFN0cmVhbSIsIndyaXRlU3RyZWFtIiwiUm9ja2V0Q2hhdEZpbGUiLCJlbmFibGVkIiwicGlwZSIsImhlaWdodCIsIndpZHRoIiwiSW5mbyIsIkdyYXBoaWNzTWFnaWNrIiwiYWxwaGEiLCJnbSIsImJhY2tncm91bmQiLCJyZXNpemUiLCJncmF2aXR5IiwiY3JvcCIsImV4dGVudCIsInRlbXBGaWxlUGF0aCIsImdldFRlbXBGaWxlUGF0aCIsImZ1dHVyZSIsInNldEZvcm1hdCIsIndyaXRlIiwiYmluZEVudmlyb25tZW50IiwiY29uc29sZSIsImVycm9yIiwibHN0YXRTeW5jIiwiZ2V0Q29sbGVjdGlvbiIsImRpcmVjdCIsIiRzZXQiLCJyZXR1cm4iLCJ3YWl0IiwidXBsb2Fkc1RyYW5zZm9ybVdyaXRlIiwidW5kZWZpbmVkIiwiaWRlbnRpZnkiLCJmb3JtYXQiLCJPcmllbnRhdGlvbiIsImluY2x1ZGVzIiwiYXV0b09yaWVudCIsInRtcEZpbGUiLCJmdXQiLCJVc2VycyIsIm9sZEF2YXRhciIsImZpbmRPbmVCeU5hbWUiLCJ1c2VybmFtZSIsImRlbGV0ZUZpbGUiLCJ1cGRhdGVGaWxlTmFtZUJ5SWQiLCJoZWFkZXJzIiwicXVlcnkiLCJyY191aWQiLCJyY190b2tlbiIsImZpbmRPbmVCeUlkQW5kTG9naW5Ub2tlbiIsImFkZEV4dGVuc2lvblRvIiwibG9va3VwIiwiZXh0IiwiZXh0ZW5zaW9uIiwiUmVnRXhwIiwiZ2V0U3RvcmUiLCJtb2RlbE5hbWUiLCJzdG9yYWdlVHlwZSIsImhhbmRsZXJOYW1lIiwiZ2V0U3RvcmVCeU5hbWUiLCJuZXh0IiwiZW5kIiwiZ2V0TW9kZWxGcm9tTmFtZSIsIl9zdG9yZSIsImRlbGV0ZSIsImRlbGV0ZUJ5SWQiLCJkZWxldGVCeU5hbWUiLCJmaWxlTmFtZSIsInN0cmVhbU9yQnVmZmVyIiwiY2IiLCJnZXRGaWx0ZXIiLCJjaGVjayIsImNyZWF0ZSIsInRva2VuIiwiY3JlYXRlVG9rZW4iLCJjcmVhdGVXcml0ZVN0cmVhbSIsIkJ1ZmZlciIsIndyaXRlRmlsZVN5bmMiLCJjYWxsIiwiZSIsImh0dHAiLCJVUkwiLCJsb2dnZXIiLCJMb2dnZXIiLCJXZWJBcHAiLCJjb25uZWN0SGFuZGxlcnMiLCJzdGFjayIsInVuc2hpZnQiLCJyb3V0ZSIsImhhbmRsZSIsInN0b3Jlc1BhdGgiLCJkZWJ1ZyIsIm1ldGhvZCIsInBhcnNlZFVybCIsInBhcnNlIiwicGF0aCIsInBhdGhuYW1lIiwic3Vic3RyIiwibGVuZ3RoIiwicmVnRXhwIiwibWF0Y2giLCJleGVjIiwiZmluZE9uZSIsImluc3RhbmNlSWQiLCJJbnN0YW5jZVN0YXR1cyIsImluc3RhbmNlIiwiZXh0cmFJbmZvcm1hdGlvbiIsImhvc3QiLCJwcm9jZXNzIiwiZW52IiwiSU5TVEFOQ0VfSVAiLCJpc0RvY2tlciIsInBvcnQiLCJob3N0bmFtZSIsIm9yaWdpbmFsVXJsIiwicHJveHkiLCJyZXF1ZXN0IiwicHJveHlfcmVzIiwidXNlIiwiX19tZXRlb3JfcnVudGltZV9jb25maWdfXyIsIlJPT1RfVVJMX1BBVEhfUFJFRklYIiwicHVibGljIiwic2FuZHN0b3JtIiwiY29uZmlnU3RvcmUiLCJkZWJvdW5jZSIsImxvZyIsImZpbGVVcmwiLCJnZXRSZWRpcmVjdFVSTCIsIkFtYXpvblMzVXBsb2FkcyIsIkFtYXpvblMzQXZhdGFycyIsImNvbmZpZ3VyZSIsIkJ1Y2tldCIsIkFjbCIsIkFXU0FjY2Vzc0tleUlkIiwiQVdTU2VjcmV0QWNjZXNzS2V5IiwiVVJMRXhwaXJ5VGltZVNwYW4iLCJSZWdpb24iLCJTaWduYXR1cmVWZXJzaW9uIiwiRm9yY2VQYXRoU3R5bGUiLCJCdWNrZXRVUkwiLCJjb25uZWN0aW9uIiwiYWNjZXNzS2V5SWQiLCJzZWNyZXRBY2Nlc3NLZXkiLCJzaWduYXR1cmVWZXJzaW9uIiwiczNGb3JjZVBhdGhTdHlsZSIsInBhcmFtcyIsIkFDTCIsInJlZ2lvbiIsImVuZHBvaW50IiwiRmlsZVN5c3RlbVVwbG9hZHMiLCJmaWxlUGF0aCIsImdldEZpbGVQYXRoIiwic3RhdCIsIndyYXBBc3luYyIsImlzRmlsZSIsInVwbG9hZGVkQXQiLCJ0b1VUQ1N0cmluZyIsImdldFJlYWRTdHJlYW0iLCJGaWxlU3lzdGVtQXZhdGFycyIsInJlcU1vZGlmaWVkSGVhZGVyIiwiY3JlYXRlRmlsZVN5c3RlbVN0b3JlIiwiR29vZ2xlQ2xvdWRTdG9yYWdlVXBsb2FkcyIsIkdvb2dsZUNsb3VkU3RvcmFnZUF2YXRhcnMiLCJidWNrZXQiLCJhY2Nlc3NJZCIsInNlY3JldCIsImNyZWRlbnRpYWxzIiwiY2xpZW50X2VtYWlsIiwicHJpdmF0ZV9rZXkiLCJ6bGliIiwidXRpbCIsIkV4dHJhY3RSYW5nZSIsImJ5dGVzX3JlYWQiLCJUcmFuc2Zvcm0iLCJpbmhlcml0cyIsInByb3RvdHlwZSIsIl90cmFuc2Zvcm0iLCJjaHVuayIsImVuYyIsIm5ld2NodW5rIiwic2xpY2UiLCJwdXNoIiwiZ2V0Qnl0ZVJhbmdlIiwiaGVhZGVyIiwibWF0Y2hlcyIsInJlYWRGcm9tR3JpZEZTIiwic3RvcmVOYW1lIiwicnMiLCJ3cyIsIlBhc3NUaHJvdWdoIiwiZm9yRWFjaCIsIm9uIiwib25SZWFkRXJyb3IiLCJlbWl0IiwiYWNjZXB0IiwidHJhbnNmb3JtUmVhZCIsInJhbmdlIiwib3V0X29mX3JhbmdlIiwiY3JlYXRlR3ppcCIsImNyZWF0ZURlZmxhdGUiLCJjb2xsZWN0aW9uTmFtZSIsImNvbmZpZ3VyZVNsaW5nc2hvdCIsImFjbCIsImFjY2Vzc0tleSIsInNlY3JldEtleSIsImNkbiIsImJ1Y2tldFVybCIsIl9kaXJlY3RpdmVzIiwiaXNFbXB0eSIsIm1ldGFDb250ZXh0IiwidXBsb2FkIiwiQW1hem9uUzMiLCJpbnNlcnRGaWxlSW5pdCIsImNyZWF0ZURpcmVjdGl2ZSIsIlMzU3RvcmFnZSIsIm1lc3NhZ2UiLCJjcmVhdGVHb29nbGVTdG9yYWdlRGlyZWN0aXZlIiwiR29vZ2xlQWNjZXNzSWQiLCJHb29nbGVTZWNyZXRLZXkiLCJHb29nbGVTdG9yYWdlIiwiR29vZ2xlQ2xvdWQiLCJtZXRob2RzIiwicm9vbUlkIiwibXNnRGF0YSIsImF2YXRhciIsIk9wdGlvbmFsIiwiZW1vamkiLCJhbGlhcyIsImdyb3VwYWJsZSIsIkJvb2xlYW4iLCJtc2ciLCJ1cGRhdGVGaWxlQ29tcGxldGUiLCJvbWl0IiwiZW5jb2RlVVJJIiwiYXR0YWNobWVudCIsInRpdGxlIiwiZGVzY3JpcHRpb24iLCJ0aXRsZV9saW5rIiwidGl0bGVfbGlua19kb3dubG9hZCIsImltYWdlX3VybCIsImltYWdlX3R5cGUiLCJpbWFnZV9zaXplIiwiaW1hZ2VfZGltZW5zaW9ucyIsImF1ZGlvX3VybCIsImF1ZGlvX3R5cGUiLCJhdWRpb19zaXplIiwidmlkZW9fdXJsIiwidmlkZW9fdHlwZSIsInZpZGVvX3NpemUiLCJ0cyIsIkRhdGUiLCJhdHRhY2htZW50cyIsImRlZmVyIiwiY2FsbGJhY2tzIiwicnVuIiwicHJvdGVjdGVkRmlsZXMiLCJnZXRTM0ZpbGVVcmwiLCJhZGRHcm91cCIsImFkZCIsImkxOG5EZXNjcmlwdGlvbiIsInZhbHVlcyIsImkxOG5MYWJlbCIsInNlY3Rpb24iLCJlbmFibGVRdWVyeSIsInByaXZhdGUiLCJtdWx0aWxpbmUiLCJBbWF6b25TM1N0b3JlIiwiUzMiLCJTdG9yZSIsImV4dGVuZCIsImh0dHBPcHRpb25zIiwidGltZW91dCIsImFnZW50IiwiY2xhc3NPcHRpb25zIiwiczMiLCJLZXkiLCJFeHBpcmVzIiwiZ2V0U2lnbmVkVXJsIiwiZGVsZXRlT2JqZWN0IiwiUmFuZ2UiLCJnZXRPYmplY3QiLCJjcmVhdGVSZWFkU3RyZWFtIiwiZ2V0V3JpdGVTdHJlYW0iLCJldmVudCIsImxpc3RlbmVyIiwibmV4dFRpY2siLCJyZW1vdmVMaXN0ZW5lciIsInB1dE9iamVjdCIsIkJvZHkiLCJDb250ZW50VHlwZSIsIkNvbnRlbnREaXNwb3NpdGlvbiIsIkdvb2dsZVN0b3JhZ2VTdG9yZSIsImdjU3RvcmFnZSIsImdjcyIsImdvb2dsZUNsb3VkU3RvcmFnZSIsImFjdGlvbiIsInJlc3BvbnNlRGlzcG9zaXRpb24iLCJleHBpcmVzIiwibm93IiwiZ3ppcCIsIm1ldGFkYXRhIiwiY29udGVudFR5cGUiLCJjb250ZW50RGlzcG9zaXRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxRQUFKO0FBQWFDLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxVQUFSLENBQWIsRUFBaUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLGFBQVNLLENBQVQ7QUFBVzs7QUFBdkIsQ0FBakMsRUFBMEQsQ0FBMUQ7QUFJYixNQUFNQyxrQkFBa0I7QUFDdkJDLFdBQVVDLElBQVYsQ0FBYyxpQkFBZCxFQUFpQztBQUNoQztBQUNBLE1BQUksQ0FBQyxLQUFLQyxNQUFWLEVBQWtCO0FBQ2pCLFNBQU0sSUFBSUMsT0FBT0MsS0FBWCxDQUFpQixnQkFBakIsRUFBbUMsbUNBQW5DLENBQU47QUFDQTs7QUFFRCxNQUFJLENBQUNDLFdBQVdDLDRCQUFYLENBQXdDTCxLQUFLTSxJQUE3QyxDQUFMLEVBQXlEO0FBQ3hELFNBQU0sSUFBSUosT0FBT0MsS0FBWCxDQUFpQkksUUFBUUMsRUFBUixDQUFXLHlCQUFYLENBQWpCLENBQU47QUFDQTs7QUFFRCxRQUFNQyxjQUFjTCxXQUFXTSxRQUFYLENBQW9CQyxHQUFwQixDQUF3Qix3QkFBeEIsQ0FBcEI7O0FBRUEsTUFBSUYsZUFBZUEsY0FBY1QsS0FBS1ksSUFBdEMsRUFBNEM7QUFDM0MsU0FBTSxJQUFJVixPQUFPQyxLQUFYLENBQWlCSSxRQUFRQyxFQUFSLENBQVcsb0NBQVgsRUFBaUQ7QUFBRUksVUFBTXBCLFNBQVNpQixXQUFUO0FBQVIsSUFBakQsQ0FBakIsQ0FBTjtBQUNBOztBQUVELFNBQU8sSUFBUDtBQUNBLEVBbEJzQjs7QUFtQnZCSSxVQUFTLENBbkJjO0FBb0J2QkMsbUJBQWtCO0FBcEJLLENBQXhCO0FBdUJBQyxVQUFVQyxnQkFBVixDQUEyQixvQkFBM0IsRUFBaURs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NFIsYUFBZixHQUErQndFLGtCQUEvQixDIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X2ZpbGUtdXBsb2FkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBTbGluZ3Nob3QgKi9cblxuaW1wb3J0IGZpbGVzaXplIGZyb20gJ2ZpbGVzaXplJztcblxuY29uc3Qgc2xpbmdTaG90Q29uZmlnID0ge1xuXHRhdXRob3JpemUoZmlsZS8qLCBtZXRhQ29udGV4dCovKSB7XG5cdFx0Ly9EZW55IHVwbG9hZHMgaWYgdXNlciBpcyBub3QgbG9nZ2VkIGluLlxuXHRcdGlmICghdGhpcy51c2VySWQpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2xvZ2luLXJlcXVpcmVkJywgJ1BsZWFzZSBsb2dpbiBiZWZvcmUgcG9zdGluZyBmaWxlcycpO1xuXHRcdH1cblxuXHRcdGlmICghUm9ja2V0Q2hhdC5maWxlVXBsb2FkSXNWYWxpZENvbnRlbnRUeXBlKGZpbGUudHlwZSkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoVEFQaTE4bi5fXygnZXJyb3ItaW52YWxpZC1maWxlLXR5cGUnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF4RmlsZVNpemUgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9NYXhGaWxlU2l6ZScpO1xuXG5cdFx0aWYgKG1heEZpbGVTaXplICYmIG1heEZpbGVTaXplIDwgZmlsZS5zaXplKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFRBUGkxOG4uX18oJ0ZpbGVfZXhjZWVkc19hbGxvd2VkX3NpemVfb2ZfYnl0ZXMnLCB7IHNpemU6IGZpbGVzaXplKG1heEZpbGVTaXplKSB9KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cdG1heFNpemU6IDAsXG5cdGFsbG93ZWRGaWxlVHlwZXM6IG51bGxcbn07XG5cblNsaW5nc2hvdC5maWxlUmVzdHJpY3Rpb25zKCdyb2NrZXRjaGF0LXVwbG9hZHMnLCBzbGluZ1Nob3RDb25maWcpO1xuU2xpbmdzaG90LmZpbGVSZXN0cmljdGlvbnMoJ3JvY2tldGNoYXQtdXBsb2Fkcy1ncycsIHNsaW5nU2hvdENvbmZpZyk7XG4iLCIvKiBnbG9iYWxzIEZpbGVVcGxvYWQ6dHJ1ZSAqL1xuLyogZXhwb3J0ZWQgRmlsZVVwbG9hZCAqL1xuXG5pbXBvcnQgZmlsZXNpemUgZnJvbSAnZmlsZXNpemUnO1xuXG5sZXQgbWF4RmlsZVNpemUgPSAwO1xuXG5GaWxlVXBsb2FkID0ge1xuXHR2YWxpZGF0ZUZpbGVVcGxvYWQoZmlsZSkge1xuXHRcdGlmICghTWF0Y2gudGVzdChmaWxlLnJpZCwgU3RyaW5nKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcigpO1xuXHRcdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChmaWxlLnJpZCk7XG5cdFx0Y29uc3QgZGlyZWN0TWVzc2FnZUFsbG93ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfRW5hYmxlZF9EaXJlY3QnKTtcblx0XHRjb25zdCBmaWxlVXBsb2FkQWxsb3dlZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX0VuYWJsZWQnKTtcblxuXHRcdGlmIChSb2NrZXRDaGF0LmF1dGh6LmNhbkFjY2Vzc1Jvb20ocm9vbSwgdXNlcikgIT09IHRydWUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIWZpbGVVcGxvYWRBbGxvd2VkKSB7XG5cdFx0XHRjb25zdCByZWFzb24gPSBUQVBpMThuLl9fKCdGaWxlVXBsb2FkX0Rpc2FibGVkJywgdXNlci5sYW5ndWFnZSk7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1maWxlLXVwbG9hZC1kaXNhYmxlZCcsIHJlYXNvbik7XG5cdFx0fVxuXG5cdFx0aWYgKCFkaXJlY3RNZXNzYWdlQWxsb3cgJiYgcm9vbS50ID09PSAnZCcpIHtcblx0XHRcdGNvbnN0IHJlYXNvbiA9IFRBUGkxOG4uX18oJ0ZpbGVfbm90X2FsbG93ZWRfZGlyZWN0X21lc3NhZ2VzJywgdXNlci5sYW5ndWFnZSk7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1kaXJlY3QtbWVzc2FnZS1maWxlLXVwbG9hZC1ub3QtYWxsb3dlZCcsIHJlYXNvbik7XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGUuc2l6ZSA+IG1heEZpbGVTaXplKSB7XG5cdFx0XHRjb25zdCByZWFzb24gPSBUQVBpMThuLl9fKCdGaWxlX2V4Y2VlZHNfYWxsb3dlZF9zaXplX29mX2J5dGVzJywge1xuXHRcdFx0XHRzaXplOiBmaWxlc2l6ZShtYXhGaWxlU2l6ZSlcblx0XHRcdH0sIHVzZXIubGFuZ3VhZ2UpO1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItZmlsZS10b28tbGFyZ2UnLCByZWFzb24pO1xuXHRcdH1cblxuXHRcdGlmIChwYXJzZUludChtYXhGaWxlU2l6ZSkgPiAwKSB7XG5cdFx0XHRpZiAoZmlsZS5zaXplID4gbWF4RmlsZVNpemUpIHtcblx0XHRcdFx0Y29uc3QgcmVhc29uID0gVEFQaTE4bi5fXygnRmlsZV9leGNlZWRzX2FsbG93ZWRfc2l6ZV9vZl9ieXRlcycsIHtcblx0XHRcdFx0XHRzaXplOiBmaWxlc2l6ZShtYXhGaWxlU2l6ZSlcblx0XHRcdFx0fSwgdXNlci5sYW5ndWFnZSk7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWZpbGUtdG9vLWxhcmdlJywgcmVhc29uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuZmlsZVVwbG9hZElzVmFsaWRDb250ZW50VHlwZShmaWxlLnR5cGUpKSB7XG5cdFx0XHRjb25zdCByZWFzb24gPSBUQVBpMThuLl9fKCdGaWxlX3R5cGVfaXNfbm90X2FjY2VwdGVkJywgdXNlci5sYW5ndWFnZSk7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWZpbGUtdHlwZScsIHJlYXNvbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn07XG5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX01heEZpbGVTaXplJywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRtYXhGaWxlU2l6ZSA9IHZhbHVlO1xufSk7XG4iLCIvKiBnbG9iYWxzIEZpbGVVcGxvYWRCYXNlOnRydWUsIFVwbG9hZEZTICovXG4vKiBleHBvcnRlZCBGaWxlVXBsb2FkQmFzZSAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cblVwbG9hZEZTLmNvbmZpZy5kZWZhdWx0U3RvcmVQZXJtaXNzaW9ucyA9IG5ldyBVcGxvYWRGUy5TdG9yZVBlcm1pc3Npb25zKHtcblx0aW5zZXJ0KHVzZXJJZCwgZG9jKSB7XG5cdFx0cmV0dXJuIHVzZXJJZCB8fCAoZG9jICYmIGRvYy5tZXNzYWdlX2lkICYmIGRvYy5tZXNzYWdlX2lkLmluZGV4T2YoJ3NsYWNrLScpID09PSAwKTsgLy8gYWxsb3cgaW5zZXJ0cyBmcm9tIHNsYWNrYnJpZGdlIChtZXNzYWdlX2lkID0gc2xhY2stdGltZXN0YW1wLW1pbGxpKVxuXHR9LFxuXHR1cGRhdGUodXNlcklkLCBkb2MpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ2RlbGV0ZS1tZXNzYWdlJywgZG9jLnJpZCkgfHwgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXNzYWdlX0FsbG93RGVsZXRpbmcnKSAmJiB1c2VySWQgPT09IGRvYy51c2VySWQpO1xuXHR9LFxuXHRyZW1vdmUodXNlcklkLCBkb2MpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ2RlbGV0ZS1tZXNzYWdlJywgZG9jLnJpZCkgfHwgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXNzYWdlX0FsbG93RGVsZXRpbmcnKSAmJiB1c2VySWQgPT09IGRvYy51c2VySWQpO1xuXHR9XG59KTtcblxuXG5GaWxlVXBsb2FkQmFzZSA9IGNsYXNzIEZpbGVVcGxvYWRCYXNlIHtcblx0Y29uc3RydWN0b3Ioc3RvcmUsIG1ldGEsIGZpbGUpIHtcblx0XHR0aGlzLmlkID0gUmFuZG9tLmlkKCk7XG5cdFx0dGhpcy5tZXRhID0gbWV0YTtcblx0XHR0aGlzLmZpbGUgPSBmaWxlO1xuXHRcdHRoaXMuc3RvcmUgPSBzdG9yZTtcblx0fVxuXG5cdGdldFByb2dyZXNzKCkge1xuXG5cdH1cblxuXHRnZXRGaWxlTmFtZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5tZXRhLm5hbWU7XG5cdH1cblxuXHRzdGFydChjYWxsYmFjaykge1xuXHRcdHRoaXMuaGFuZGxlciA9IG5ldyBVcGxvYWRGUy5VcGxvYWRlcih7XG5cdFx0XHRzdG9yZTogdGhpcy5zdG9yZSxcblx0XHRcdGRhdGE6IHRoaXMuZmlsZSxcblx0XHRcdGZpbGU6IHRoaXMubWV0YSxcblx0XHRcdG9uRXJyb3I6IChlcnIpID0+IHtcblx0XHRcdFx0cmV0dXJuIGNhbGxiYWNrKGVycik7XG5cdFx0XHR9LFxuXHRcdFx0b25Db21wbGV0ZTogKGZpbGVEYXRhKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSBfLnBpY2soZmlsZURhdGEsICdfaWQnLCAndHlwZScsICdzaXplJywgJ25hbWUnLCAnaWRlbnRpZnknLCAnZGVzY3JpcHRpb24nKTtcblxuXHRcdFx0XHRmaWxlLnVybCA9IGZpbGVEYXRhLnVybC5yZXBsYWNlKE1ldGVvci5hYnNvbHV0ZVVybCgpLCAnLycpO1xuXHRcdFx0XHRyZXR1cm4gY2FsbGJhY2sobnVsbCwgZmlsZSwgdGhpcy5zdG9yZS5vcHRpb25zLm5hbWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5oYW5kbGVyLm9uUHJvZ3Jlc3MgPSAoZmlsZSwgcHJvZ3Jlc3MpID0+IHtcblx0XHRcdHRoaXMub25Qcm9ncmVzcyhwcm9ncmVzcyk7XG5cdFx0fTtcblxuXHRcdHJldHVybiB0aGlzLmhhbmRsZXIuc3RhcnQoKTtcblx0fVxuXG5cdG9uUHJvZ3Jlc3MoKSB7fVxuXG5cdHN0b3AoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaGFuZGxlci5zdG9wKCk7XG5cdH1cbn07XG4iLCIvKiBnbG9iYWxzIFVwbG9hZEZTICovXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgc3RyZWFtIGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGUvd2l0aC1kYic7XG5pbXBvcnQgRnV0dXJlIGZyb20gJ2ZpYmVycy9mdXR1cmUnO1xuaW1wb3J0IHsgQ29va2llcyB9IGZyb20gJ21ldGVvci9vc3RyaW86Y29va2llcyc7XG5cbmNvbnN0IGNvb2tpZSA9IG5ldyBDb29raWVzKCk7XG5cbk9iamVjdC5hc3NpZ24oRmlsZVVwbG9hZCwge1xuXHRoYW5kbGVyczoge30sXG5cblx0Y29uZmlndXJlVXBsb2Fkc1N0b3JlKHN0b3JlLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgdHlwZSA9IG5hbWUuc3BsaXQoJzonKS5wb3AoKTtcblx0XHRjb25zdCBzdG9yZXMgPSBVcGxvYWRGUy5nZXRTdG9yZXMoKTtcblx0XHRkZWxldGUgc3RvcmVzW25hbWVdO1xuXG5cdFx0cmV0dXJuIG5ldyBVcGxvYWRGUy5zdG9yZVtzdG9yZV0oT2JqZWN0LmFzc2lnbih7XG5cdFx0XHRuYW1lXG5cdFx0fSwgb3B0aW9ucywgRmlsZVVwbG9hZFtgZGVmYXVsdCR7IHR5cGUgfWBdKCkpKTtcblx0fSxcblxuXHRkZWZhdWx0VXBsb2FkcygpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29sbGVjdGlvbjogUm9ja2V0Q2hhdC5tb2RlbHMuVXBsb2Fkcy5tb2RlbCxcblx0XHRcdGZpbHRlcjogbmV3IFVwbG9hZEZTLkZpbHRlcih7XG5cdFx0XHRcdG9uQ2hlY2s6IEZpbGVVcGxvYWQudmFsaWRhdGVGaWxlVXBsb2FkXG5cdFx0XHR9KSxcblx0XHRcdGdldFBhdGgoZmlsZSkge1xuXHRcdFx0XHRyZXR1cm4gYCR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCd1bmlxdWVJRCcpIH0vdXBsb2Fkcy8keyBmaWxlLnJpZCB9LyR7IGZpbGUudXNlcklkIH0vJHsgZmlsZS5faWQgfWA7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gdHJhbnNmb3JtV3JpdGU6IEZpbGVVcGxvYWQudXBsb2Fkc1RyYW5zZm9ybVdyaXRlXG5cdFx0XHRvblZhbGlkYXRlOiBGaWxlVXBsb2FkLnVwbG9hZHNPblZhbGlkYXRlLFxuXHRcdFx0b25SZWFkKGZpbGVJZCwgZmlsZSwgcmVxLCByZXMpIHtcblx0XHRcdFx0aWYgKCFGaWxlVXBsb2FkLnJlcXVlc3RDYW5BY2Nlc3NGaWxlcyhyZXEpKSB7XG5cdFx0XHRcdFx0cmVzLndyaXRlSGVhZCg0MDMpO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ2NvbnRlbnQtZGlzcG9zaXRpb24nLCBgYXR0YWNobWVudDsgZmlsZW5hbWU9XCIkeyBlbmNvZGVVUklDb21wb25lbnQoZmlsZS5uYW1lKSB9XCJgKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSxcblxuXHRkZWZhdWx0QXZhdGFycygpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29sbGVjdGlvbjogUm9ja2V0Q2hhdC5tb2RlbHMuQXZhdGFycy5tb2RlbCxcblx0XHRcdC8vIGZpbHRlcjogbmV3IFVwbG9hZEZTLkZpbHRlcih7XG5cdFx0XHQvLyBcdG9uQ2hlY2s6IEZpbGVVcGxvYWQudmFsaWRhdGVGaWxlVXBsb2FkXG5cdFx0XHQvLyB9KSxcblx0XHRcdC8vIHRyYW5zZm9ybVdyaXRlOiBGaWxlVXBsb2FkLmF2YXRhclRyYW5zZm9ybVdyaXRlLFxuXHRcdFx0Z2V0UGF0aChmaWxlKSB7XG5cdFx0XHRcdHJldHVybiBgJHsgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ3VuaXF1ZUlEJykgfS9hdmF0YXJzLyR7IGZpbGUudXNlcklkIH1gO1xuXHRcdFx0fSxcblx0XHRcdG9uVmFsaWRhdGU6IEZpbGVVcGxvYWQuYXZhdGFyc09uVmFsaWRhdGUsXG5cdFx0XHRvbkZpbmlzaFVwbG9hZDogRmlsZVVwbG9hZC5hdmF0YXJzT25GaW5pc2hVcGxvYWRcblx0XHR9O1xuXHR9LFxuXG5cdGF2YXRhclRyYW5zZm9ybVdyaXRlKHJlYWRTdHJlYW0sIHdyaXRlU3RyZWFtLyosIGZpbGVJZCwgZmlsZSovKSB7XG5cdFx0aWYgKFJvY2tldENoYXRGaWxlLmVuYWJsZWQgPT09IGZhbHNlIHx8IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBY2NvdW50c19BdmF0YXJSZXNpemUnKSAhPT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIHJlYWRTdHJlYW0ucGlwZSh3cml0ZVN0cmVhbSk7XG5cdFx0fVxuXHRcdGNvbnN0IGhlaWdodCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBY2NvdW50c19BdmF0YXJTaXplJyk7XG5cdFx0Y29uc3Qgd2lkdGggPSBoZWlnaHQ7XG5cdFx0cmV0dXJuIChmaWxlID0+IFJvY2tldENoYXQuSW5mby5HcmFwaGljc01hZ2ljay5lbmFibGVkID8gZmlsZTogZmlsZS5hbHBoYSgncmVtb3ZlJykpKFJvY2tldENoYXRGaWxlLmdtKHJlYWRTdHJlYW0pLmJhY2tncm91bmQoJyNGRkZGRkYnKSkucmVzaXplKHdpZHRoLCBgJHsgaGVpZ2h0IH1eYCkuZ3Jhdml0eSgnQ2VudGVyJykuY3JvcCh3aWR0aCwgaGVpZ2h0KS5leHRlbnQod2lkdGgsIGhlaWdodCkuc3RyZWFtKCdqcGVnJykucGlwZSh3cml0ZVN0cmVhbSk7XG5cdH0sXG5cblx0YXZhdGFyc09uVmFsaWRhdGUoZmlsZSkge1xuXHRcdGlmIChSb2NrZXRDaGF0RmlsZS5lbmFibGVkID09PSBmYWxzZSB8fCBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQWNjb3VudHNfQXZhdGFyUmVzaXplJykgIT09IHRydWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0ZW1wRmlsZVBhdGggPSBVcGxvYWRGUy5nZXRUZW1wRmlsZVBhdGgoZmlsZS5faWQpO1xuXG5cdFx0Y29uc3QgaGVpZ2h0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FjY291bnRzX0F2YXRhclNpemUnKTtcblx0XHRjb25zdCB3aWR0aCA9IGhlaWdodDtcblx0XHRjb25zdCBmdXR1cmUgPSBuZXcgRnV0dXJlKCk7XG5cblx0XHQoZmlsZSA9PiBSb2NrZXRDaGF0LkluZm8uR3JhcGhpY3NNYWdpY2suZW5hYmxlZCA/IGZpbGU6IGZpbGUuYWxwaGEoJ3JlbW92ZScpKShSb2NrZXRDaGF0RmlsZS5nbSh0ZW1wRmlsZVBhdGgpLmJhY2tncm91bmQoJyNGRkZGRkYnKSkucmVzaXplKHdpZHRoLCBgJHsgaGVpZ2h0IH1eYCkuZ3Jhdml0eSgnQ2VudGVyJykuY3JvcCh3aWR0aCwgaGVpZ2h0KS5leHRlbnQod2lkdGgsIGhlaWdodCkuc2V0Rm9ybWF0KCdqcGVnJykud3JpdGUodGVtcEZpbGVQYXRoLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGVyciA9PiB7XG5cdFx0XHRpZiAoZXJyICE9IG51bGwpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc2l6ZSA9IGZzLmxzdGF0U3luYyh0ZW1wRmlsZVBhdGgpLnNpemU7XG5cdFx0XHR0aGlzLmdldENvbGxlY3Rpb24oKS5kaXJlY3QudXBkYXRlKHtfaWQ6IGZpbGUuX2lkfSwgeyRzZXQ6IHtzaXplfX0pO1xuXHRcdFx0ZnV0dXJlLnJldHVybigpO1xuXHRcdH0pKTtcblx0XHRyZXR1cm4gZnV0dXJlLndhaXQoKTtcblx0fSxcblxuXHR1cGxvYWRzVHJhbnNmb3JtV3JpdGUocmVhZFN0cmVhbSwgd3JpdGVTdHJlYW0sIGZpbGVJZCwgZmlsZSkge1xuXHRcdGlmIChSb2NrZXRDaGF0RmlsZS5lbmFibGVkID09PSBmYWxzZSB8fCAhL15pbWFnZVxcLy4rLy50ZXN0KGZpbGUudHlwZSkpIHtcblx0XHRcdHJldHVybiByZWFkU3RyZWFtLnBpcGUod3JpdGVTdHJlYW0pO1xuXHRcdH1cblxuXHRcdGxldCBzdHJlYW0gPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBpZGVudGlmeSA9IGZ1bmN0aW9uKGVyciwgZGF0YSkge1xuXHRcdFx0aWYgKGVycikge1xuXHRcdFx0XHRyZXR1cm4gc3RyZWFtLnBpcGUod3JpdGVTdHJlYW0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmaWxlLmlkZW50aWZ5ID0ge1xuXHRcdFx0XHRmb3JtYXQ6IGRhdGEuZm9ybWF0LFxuXHRcdFx0XHRzaXplOiBkYXRhLnNpemVcblx0XHRcdH07XG5cblx0XHRcdGlmIChkYXRhLk9yaWVudGF0aW9uICYmICFbJycsICdVbmtub3duJywgJ1VuZGVmaW5lZCddLmluY2x1ZGVzKGRhdGEuT3JpZW50YXRpb24pKSB7XG5cdFx0XHRcdFJvY2tldENoYXRGaWxlLmdtKHN0cmVhbSkuYXV0b09yaWVudCgpLnN0cmVhbSgpLnBpcGUod3JpdGVTdHJlYW0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RyZWFtLnBpcGUod3JpdGVTdHJlYW0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRzdHJlYW0gPSBSb2NrZXRDaGF0RmlsZS5nbShyZWFkU3RyZWFtKS5pZGVudGlmeShpZGVudGlmeSkuc3RyZWFtKCk7XG5cdH0sXG5cblx0dXBsb2Fkc09uVmFsaWRhdGUoZmlsZSkge1xuXHRcdGlmIChSb2NrZXRDaGF0RmlsZS5lbmFibGVkID09PSBmYWxzZSB8fCAhL15pbWFnZVxcLygoeC13aW5kb3dzLSk/Ym1wfHA/anBlZ3xwbmcpJC8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG1wRmlsZSA9IFVwbG9hZEZTLmdldFRlbXBGaWxlUGF0aChmaWxlLl9pZCk7XG5cblx0XHRjb25zdCBmdXQgPSBuZXcgRnV0dXJlKCk7XG5cblx0XHRjb25zdCBpZGVudGlmeSA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKGVyciwgZGF0YSkgPT4ge1xuXHRcdFx0aWYgKGVyciAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0XHRcdFx0cmV0dXJuIGZ1dC5yZXR1cm4oKTtcblx0XHRcdH1cblxuXHRcdFx0ZmlsZS5pZGVudGlmeSA9IHtcblx0XHRcdFx0Zm9ybWF0OiBkYXRhLmZvcm1hdCxcblx0XHRcdFx0c2l6ZTogZGF0YS5zaXplXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoW251bGwsIHVuZGVmaW5lZCwgJycsICdVbmtub3duJywgJ1VuZGVmaW5lZCddLmluY2x1ZGVzKGRhdGEuT3JpZW50YXRpb24pKSB7XG5cdFx0XHRcdHJldHVybiBmdXQucmV0dXJuKCk7XG5cdFx0XHR9XG5cblx0XHRcdFJvY2tldENoYXRGaWxlLmdtKHRtcEZpbGUpLmF1dG9PcmllbnQoKS53cml0ZSh0bXBGaWxlLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChlcnIpID0+IHtcblx0XHRcdFx0aWYgKGVyciAhPSBudWxsKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2l6ZSA9IGZzLmxzdGF0U3luYyh0bXBGaWxlKS5zaXplO1xuXHRcdFx0XHR0aGlzLmdldENvbGxlY3Rpb24oKS5kaXJlY3QudXBkYXRlKHtfaWQ6IGZpbGUuX2lkfSwgeyRzZXQ6IHtzaXplfX0pO1xuXHRcdFx0XHRmdXQucmV0dXJuKCk7XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cblx0XHRSb2NrZXRDaGF0RmlsZS5nbSh0bXBGaWxlKS5pZGVudGlmeShpZGVudGlmeSk7XG5cblx0XHRyZXR1cm4gZnV0LndhaXQoKTtcblx0fSxcblxuXHRhdmF0YXJzT25GaW5pc2hVcGxvYWQoZmlsZSkge1xuXHRcdC8vIHVwZGF0ZSBmaWxlIHJlY29yZCB0byBtYXRjaCB1c2VyJ3MgdXNlcm5hbWVcblx0XHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQoZmlsZS51c2VySWQpO1xuXHRcdGNvbnN0IG9sZEF2YXRhciA9IFJvY2tldENoYXQubW9kZWxzLkF2YXRhcnMuZmluZE9uZUJ5TmFtZSh1c2VyLnVzZXJuYW1lKTtcblx0XHRpZiAob2xkQXZhdGFyKSB7XG5cdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5BdmF0YXJzLmRlbGV0ZUZpbGUob2xkQXZhdGFyLl9pZCk7XG5cdFx0fVxuXHRcdFJvY2tldENoYXQubW9kZWxzLkF2YXRhcnMudXBkYXRlRmlsZU5hbWVCeUlkKGZpbGUuX2lkLCB1c2VyLnVzZXJuYW1lKTtcblx0XHQvLyBjb25zb2xlLmxvZygndXBsb2FkIGZpbmlzaGVkIC0+JywgZmlsZSk7XG5cdH0sXG5cblx0cmVxdWVzdENhbkFjY2Vzc0ZpbGVzKHsgaGVhZGVycyA9IHt9LCBxdWVyeSA9IHt9IH0pIHtcblx0XHRpZiAoIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1Byb3RlY3RGaWxlcycpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRsZXQgeyByY191aWQsIHJjX3Rva2VuIH0gPSBxdWVyeTtcblxuXHRcdGlmICghcmNfdWlkICYmIGhlYWRlcnMuY29va2llKSB7XG5cdFx0XHRyY191aWQgPSBjb29raWUuZ2V0KCdyY191aWQnLCBoZWFkZXJzLmNvb2tpZSkgO1xuXHRcdFx0cmNfdG9rZW4gPSBjb29raWUuZ2V0KCdyY190b2tlbicsIGhlYWRlcnMuY29va2llKTtcblx0XHR9XG5cblx0XHRpZiAoIXJjX3VpZCB8fCAhcmNfdG9rZW4gfHwgIVJvY2tldENoYXQubW9kZWxzLlVzZXJzLmZpbmRPbmVCeUlkQW5kTG9naW5Ub2tlbihyY191aWQsIHJjX3Rva2VuKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9LFxuXG5cdGFkZEV4dGVuc2lvblRvKGZpbGUpIHtcblx0XHRpZiAobWltZS5sb29rdXAoZmlsZS5uYW1lKSA9PT0gZmlsZS50eXBlKSB7XG5cdFx0XHRyZXR1cm4gZmlsZTtcblx0XHR9XG5cblx0XHRjb25zdCBleHQgPSBtaW1lLmV4dGVuc2lvbihmaWxlLnR5cGUpO1xuXHRcdGlmIChleHQgJiYgZmFsc2UgPT09IG5ldyBSZWdFeHAoYFxcLiR7IGV4dCB9JGAsICdpJykudGVzdChmaWxlLm5hbWUpKSB7XG5cdFx0XHRmaWxlLm5hbWUgPSBgJHsgZmlsZS5uYW1lIH0uJHsgZXh0IH1gO1xuXHRcdH1cblxuXHRcdHJldHVybiBmaWxlO1xuXHR9LFxuXG5cdGdldFN0b3JlKG1vZGVsTmFtZSkge1xuXHRcdGNvbnN0IHN0b3JhZ2VUeXBlID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyk7XG5cdFx0Y29uc3QgaGFuZGxlck5hbWUgPSBgJHsgc3RvcmFnZVR5cGUgfTokeyBtb2RlbE5hbWUgfWA7XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRTdG9yZUJ5TmFtZShoYW5kbGVyTmFtZSk7XG5cdH0sXG5cblx0Z2V0U3RvcmVCeU5hbWUoaGFuZGxlck5hbWUpIHtcblx0XHRpZiAodGhpcy5oYW5kbGVyc1toYW5kbGVyTmFtZV0gPT0gbnVsbCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgVXBsb2FkIGhhbmRsZXIgXCIkeyBoYW5kbGVyTmFtZSB9XCIgZG9lcyBub3QgZXhpc3RzYCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmhhbmRsZXJzW2hhbmRsZXJOYW1lXTtcblx0fSxcblxuXHRnZXQoZmlsZSwgcmVxLCByZXMsIG5leHQpIHtcblx0XHRjb25zdCBzdG9yZSA9IHRoaXMuZ2V0U3RvcmVCeU5hbWUoZmlsZS5zdG9yZSk7XG5cdFx0aWYgKHN0b3JlICYmIHN0b3JlLmdldCkge1xuXHRcdFx0cmV0dXJuIHN0b3JlLmdldChmaWxlLCByZXEsIHJlcywgbmV4dCk7XG5cdFx0fVxuXHRcdHJlcy53cml0ZUhlYWQoNDA0KTtcblx0XHRyZXMuZW5kKCk7XG5cdH1cbn0pO1xuXG5cbmV4cG9ydCBjbGFzcyBGaWxlVXBsb2FkQ2xhc3Mge1xuXHRjb25zdHJ1Y3Rvcih7IG5hbWUsIG1vZGVsLCBzdG9yZSwgZ2V0LCBpbnNlcnQsIGdldFN0b3JlIH0pIHtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMubW9kZWwgPSBtb2RlbCB8fCB0aGlzLmdldE1vZGVsRnJvbU5hbWUoKTtcblx0XHR0aGlzLl9zdG9yZSA9IHN0b3JlIHx8IFVwbG9hZEZTLmdldFN0b3JlKG5hbWUpO1xuXHRcdHRoaXMuZ2V0ID0gZ2V0O1xuXG5cdFx0aWYgKGluc2VydCkge1xuXHRcdFx0dGhpcy5pbnNlcnQgPSBpbnNlcnQ7XG5cdFx0fVxuXG5cdFx0aWYgKGdldFN0b3JlKSB7XG5cdFx0XHR0aGlzLmdldFN0b3JlID0gZ2V0U3RvcmU7XG5cdFx0fVxuXG5cdFx0RmlsZVVwbG9hZC5oYW5kbGVyc1tuYW1lXSA9IHRoaXM7XG5cdH1cblxuXHRnZXRTdG9yZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmU7XG5cdH1cblxuXHRnZXQgc3RvcmUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RvcmUoKTtcblx0fVxuXG5cdHNldCBzdG9yZShzdG9yZSkge1xuXHRcdHRoaXMuX3N0b3JlID0gc3RvcmU7XG5cdH1cblxuXHRnZXRNb2RlbEZyb21OYW1lKCkge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0Lm1vZGVsc1t0aGlzLm5hbWUuc3BsaXQoJzonKVsxXV07XG5cdH1cblxuXHRkZWxldGUoZmlsZUlkKSB7XG5cdFx0aWYgKHRoaXMuc3RvcmUgJiYgdGhpcy5zdG9yZS5kZWxldGUpIHtcblx0XHRcdHRoaXMuc3RvcmUuZGVsZXRlKGZpbGVJZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZGVsZXRlRmlsZShmaWxlSWQpO1xuXHR9XG5cblx0ZGVsZXRlQnlJZChmaWxlSWQpIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5tb2RlbC5maW5kT25lQnlJZChmaWxlSWQpO1xuXG5cdFx0aWYgKCFmaWxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RvcmUgPSBGaWxlVXBsb2FkLmdldFN0b3JlQnlOYW1lKGZpbGUuc3RvcmUpO1xuXG5cdFx0cmV0dXJuIHN0b3JlLmRlbGV0ZShmaWxlLl9pZCk7XG5cdH1cblxuXHRkZWxldGVCeU5hbWUoZmlsZU5hbWUpIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5tb2RlbC5maW5kT25lQnlOYW1lKGZpbGVOYW1lKTtcblxuXHRcdGlmICghZmlsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0b3JlID0gRmlsZVVwbG9hZC5nZXRTdG9yZUJ5TmFtZShmaWxlLnN0b3JlKTtcblxuXHRcdHJldHVybiBzdG9yZS5kZWxldGUoZmlsZS5faWQpO1xuXHR9XG5cblx0aW5zZXJ0KGZpbGVEYXRhLCBzdHJlYW1PckJ1ZmZlciwgY2IpIHtcblx0XHRmaWxlRGF0YS5zaXplID0gcGFyc2VJbnQoZmlsZURhdGEuc2l6ZSkgfHwgMDtcblxuXHRcdC8vIENoZWNrIGlmIHRoZSBmaWxlRGF0YSBtYXRjaGVzIHN0b3JlIGZpbHRlclxuXHRcdGNvbnN0IGZpbHRlciA9IHRoaXMuc3RvcmUuZ2V0RmlsdGVyKCk7XG5cdFx0aWYgKGZpbHRlciAmJiBmaWx0ZXIuY2hlY2spIHtcblx0XHRcdGZpbHRlci5jaGVjayhmaWxlRGF0YSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZUlkID0gdGhpcy5zdG9yZS5jcmVhdGUoZmlsZURhdGEpO1xuXHRcdGNvbnN0IHRva2VuID0gdGhpcy5zdG9yZS5jcmVhdGVUb2tlbihmaWxlSWQpO1xuXHRcdGNvbnN0IHRtcEZpbGUgPSBVcGxvYWRGUy5nZXRUZW1wRmlsZVBhdGgoZmlsZUlkKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoc3RyZWFtT3JCdWZmZXIgaW5zdGFuY2VvZiBzdHJlYW0pIHtcblx0XHRcdFx0c3RyZWFtT3JCdWZmZXIucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbSh0bXBGaWxlKSk7XG5cdFx0XHR9IGVsc2UgaWYgKHN0cmVhbU9yQnVmZmVyIGluc3RhbmNlb2YgQnVmZmVyKSB7XG5cdFx0XHRcdGZzLndyaXRlRmlsZVN5bmModG1wRmlsZSwgc3RyZWFtT3JCdWZmZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGZpbGUgdHlwZScpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmaWxlID0gTWV0ZW9yLmNhbGwoJ3Vmc0NvbXBsZXRlJywgZmlsZUlkLCB0aGlzLm5hbWUsIHRva2VuKTtcblxuXHRcdFx0aWYgKGNiKSB7XG5cdFx0XHRcdGNiKG51bGwsIGZpbGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmlsZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoY2IpIHtcblx0XHRcdFx0Y2IoZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIiwiLyogZ2xvYmFscyBVcGxvYWRGUywgSW5zdGFuY2VTdGF0dXMgKi9cblxuaW1wb3J0IGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgVVJMIGZyb20gJ3VybCc7XG5cbmNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoJ1VwbG9hZFByb3h5Jyk7XG5cbldlYkFwcC5jb25uZWN0SGFuZGxlcnMuc3RhY2sudW5zaGlmdCh7XG5cdHJvdXRlOiAnJyxcblx0aGFuZGxlOiBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG5cdFx0Ly8gUXVpY2sgY2hlY2sgdG8gc2VlIGlmIHJlcXVlc3Qgc2hvdWxkIGJlIGNhdGNoXG5cdFx0aWYgKHJlcS51cmwuaW5kZXhPZihVcGxvYWRGUy5jb25maWcuc3RvcmVzUGF0aCkgPT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gbmV4dCgpO1xuXHRcdH1cblxuXHRcdGxvZ2dlci5kZWJ1ZygnVXBsb2FkIFVSTDonLCByZXEudXJsKTtcblxuXHRcdGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcpIHtcblx0XHRcdHJldHVybiBuZXh0KCk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIHN0b3JlIHBhdGhcblx0XHRjb25zdCBwYXJzZWRVcmwgPSBVUkwucGFyc2UocmVxLnVybCk7XG5cdFx0Y29uc3QgcGF0aCA9IHBhcnNlZFVybC5wYXRobmFtZS5zdWJzdHIoVXBsb2FkRlMuY29uZmlnLnN0b3Jlc1BhdGgubGVuZ3RoICsgMSk7XG5cblx0XHQvLyBHZXQgc3RvcmVcblx0XHRjb25zdCByZWdFeHAgPSBuZXcgUmVnRXhwKCdeXFwvKFteXFwvXFw/XSspXFwvKFteXFwvXFw/XSspJCcpO1xuXHRcdGNvbnN0IG1hdGNoID0gcmVnRXhwLmV4ZWMocGF0aCk7XG5cblx0XHQvLyBSZXF1ZXN0IGlzIG5vdCB2YWxpZFxuXHRcdGlmIChtYXRjaCA9PT0gbnVsbCkge1xuXHRcdFx0cmVzLndyaXRlSGVhZCg0MDApO1xuXHRcdFx0cmVzLmVuZCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEdldCBzdG9yZVxuXHRcdGNvbnN0IHN0b3JlID0gVXBsb2FkRlMuZ2V0U3RvcmUobWF0Y2hbMV0pO1xuXHRcdGlmICghc3RvcmUpIHtcblx0XHRcdHJlcy53cml0ZUhlYWQoNDA0KTtcblx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBHZXQgZmlsZVxuXHRcdGNvbnN0IGZpbGVJZCA9IG1hdGNoWzJdO1xuXHRcdGNvbnN0IGZpbGUgPSBzdG9yZS5nZXRDb2xsZWN0aW9uKCkuZmluZE9uZSh7X2lkOiBmaWxlSWR9KTtcblx0XHRpZiAoZmlsZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXMud3JpdGVIZWFkKDQwNCk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGUuaW5zdGFuY2VJZCA9PT0gSW5zdGFuY2VTdGF0dXMuaWQoKSkge1xuXHRcdFx0bG9nZ2VyLmRlYnVnKCdDb3JyZWN0IGluc3RhbmNlJyk7XG5cdFx0XHRyZXR1cm4gbmV4dCgpO1xuXHRcdH1cblxuXHRcdC8vIFByb3h5IHRvIG90aGVyIGluc3RhbmNlXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSBJbnN0YW5jZVN0YXR1cy5nZXRDb2xsZWN0aW9uKCkuZmluZE9uZSh7X2lkOiBmaWxlLmluc3RhbmNlSWR9KTtcblxuXHRcdGlmIChpbnN0YW5jZSA9PSBudWxsKSB7XG5cdFx0XHRyZXMud3JpdGVIZWFkKDQwNCk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGluc3RhbmNlLmV4dHJhSW5mb3JtYXRpb24uaG9zdCA9PT0gcHJvY2Vzcy5lbnYuSU5TVEFOQ0VfSVAgJiYgUm9ja2V0Q2hhdC5pc0RvY2tlcigpID09PSBmYWxzZSkge1xuXHRcdFx0aW5zdGFuY2UuZXh0cmFJbmZvcm1hdGlvbi5ob3N0ID0gJ2xvY2FsaG9zdCc7XG5cdFx0fVxuXG5cdFx0bG9nZ2VyLmRlYnVnKCdXcm9uZyBpbnN0YW5jZSwgcHJveGluZyB0bzonLCBgJHsgaW5zdGFuY2UuZXh0cmFJbmZvcm1hdGlvbi5ob3N0IH06JHsgaW5zdGFuY2UuZXh0cmFJbmZvcm1hdGlvbi5wb3J0IH1gKTtcblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRob3N0bmFtZTogaW5zdGFuY2UuZXh0cmFJbmZvcm1hdGlvbi5ob3N0LFxuXHRcdFx0cG9ydDogaW5zdGFuY2UuZXh0cmFJbmZvcm1hdGlvbi5wb3J0LFxuXHRcdFx0cGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuXHRcdFx0bWV0aG9kOiAnUE9TVCdcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJveHkgPSBodHRwLnJlcXVlc3Qob3B0aW9ucywgZnVuY3Rpb24ocHJveHlfcmVzKSB7XG5cdFx0XHRwcm94eV9yZXMucGlwZShyZXMsIHtcblx0XHRcdFx0ZW5kOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHJlcS5waXBlKHByb3h5LCB7XG5cdFx0XHRlbmQ6IHRydWVcblx0XHR9KTtcblx0fSlcbn0pO1xuIiwiLyogZ2xvYmFscyBGaWxlVXBsb2FkLCBXZWJBcHAgKi9cblxuV2ViQXBwLmNvbm5lY3RIYW5kbGVycy51c2UoYCR7IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfS9maWxlLXVwbG9hZC9gLFx0ZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcblxuXHRjb25zdCBtYXRjaCA9IC9eXFwvKFteXFwvXSspXFwvKC4qKS8uZXhlYyhyZXEudXJsKTtcblxuXHRpZiAobWF0Y2hbMV0pIHtcblx0XHRjb25zdCBmaWxlID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXBsb2Fkcy5maW5kT25lQnlJZChtYXRjaFsxXSk7XG5cblx0XHRpZiAoZmlsZSkge1xuXHRcdFx0aWYgKCFNZXRlb3Iuc2V0dGluZ3MucHVibGljLnNhbmRzdG9ybSAmJiAhRmlsZVVwbG9hZC5yZXF1ZXN0Q2FuQWNjZXNzRmlsZXMocmVxKSkge1xuXHRcdFx0XHRyZXMud3JpdGVIZWFkKDQwMyk7XG5cdFx0XHRcdHJldHVybiByZXMuZW5kKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JywgJ2RlZmF1bHQtc3JjIFxcJ25vbmVcXCcnKTtcblx0XHRcdHJldHVybiBGaWxlVXBsb2FkLmdldChmaWxlLCByZXEsIHJlcywgbmV4dCk7XG5cdFx0fVxuXHR9XG5cblx0cmVzLndyaXRlSGVhZCg0MDQpO1xuXHRyZXMuZW5kKCk7XG59KTtcbiIsIi8qIGdsb2JhbHMgVXBsb2FkRlMgKi9cblxuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5pbXBvcnQgJy4vQW1hem9uUzMuanMnO1xuaW1wb3J0ICcuL0ZpbGVTeXN0ZW0uanMnO1xuaW1wb3J0ICcuL0dvb2dsZVN0b3JhZ2UuanMnO1xuaW1wb3J0ICcuL0dyaWRGUy5qcyc7XG5pbXBvcnQgJy4vU2xpbmdzaG90X0RFUFJFQ0FURUQuanMnO1xuXG5jb25zdCBjb25maWdTdG9yZSA9IF8uZGVib3VuY2UoKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScpO1xuXG5cdGlmIChzdG9yZSkge1xuXHRcdGNvbnNvbGUubG9nKCdTZXR0aW5nIGRlZmF1bHQgZmlsZSBzdG9yZSB0bycsIHN0b3JlKTtcblx0XHRVcGxvYWRGUy5nZXRTdG9yZXMoKS5BdmF0YXJzID0gVXBsb2FkRlMuZ2V0U3RvcmUoYCR7IHN0b3JlIH06QXZhdGFyc2ApO1xuXHRcdFVwbG9hZEZTLmdldFN0b3JlcygpLlVwbG9hZHMgPSBVcGxvYWRGUy5nZXRTdG9yZShgJHsgc3RvcmUgfTpVcGxvYWRzYCk7XG5cdH1cbn0sIDEwMDApO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgvXkZpbGVVcGxvYWRfLywgY29uZmlnU3RvcmUpO1xuIiwiLyogZ2xvYmFscyBGaWxlVXBsb2FkICovXG5cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHsgRmlsZVVwbG9hZENsYXNzIH0gZnJvbSAnLi4vbGliL0ZpbGVVcGxvYWQnO1xuaW1wb3J0ICcuLi8uLi91ZnMvQW1hem9uUzMvc2VydmVyLmpzJztcblxuY29uc3QgZ2V0ID0gZnVuY3Rpb24oZmlsZSwgcmVxLCByZXMpIHtcblx0Y29uc3QgZmlsZVVybCA9IHRoaXMuc3RvcmUuZ2V0UmVkaXJlY3RVUkwoZmlsZSk7XG5cblx0aWYgKGZpbGVVcmwpIHtcblx0XHRyZXMuc2V0SGVhZGVyKCdMb2NhdGlvbicsIGZpbGVVcmwpO1xuXHRcdHJlcy53cml0ZUhlYWQoMzAyKTtcblx0fVxuXHRyZXMuZW5kKCk7XG59O1xuXG5jb25zdCBBbWF6b25TM1VwbG9hZHMgPSBuZXcgRmlsZVVwbG9hZENsYXNzKHtcblx0bmFtZTogJ0FtYXpvblMzOlVwbG9hZHMnLFxuXHRnZXRcblx0Ly8gc3RvcmUgc2V0dGVkIGJlbGxvd1xufSk7XG5cbmNvbnN0IEFtYXpvblMzQXZhdGFycyA9IG5ldyBGaWxlVXBsb2FkQ2xhc3Moe1xuXHRuYW1lOiAnQW1hem9uUzM6QXZhdGFycycsXG5cdGdldFxuXHQvLyBzdG9yZSBzZXR0ZWQgYmVsbG93XG59KTtcblxuY29uc3QgY29uZmlndXJlID0gXy5kZWJvdW5jZShmdW5jdGlvbigpIHtcblx0Y29uc3QgQnVja2V0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfUzNfQnVja2V0Jyk7XG5cdGNvbnN0IEFjbCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX0FjbCcpO1xuXHRjb25zdCBBV1NBY2Nlc3NLZXlJZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX0FXU0FjY2Vzc0tleUlkJyk7XG5cdGNvbnN0IEFXU1NlY3JldEFjY2Vzc0tleSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX0FXU1NlY3JldEFjY2Vzc0tleScpO1xuXHRjb25zdCBVUkxFeHBpcnlUaW1lU3BhbiA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX1VSTEV4cGlyeVRpbWVTcGFuJyk7XG5cdGNvbnN0IFJlZ2lvbiA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX1JlZ2lvbicpO1xuXHRjb25zdCBTaWduYXR1cmVWZXJzaW9uID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfUzNfU2lnbmF0dXJlVmVyc2lvbicpO1xuXHRjb25zdCBGb3JjZVBhdGhTdHlsZSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX0ZvcmNlUGF0aFN0eWxlJyk7XG5cdC8vIGNvbnN0IENETiA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX0NETicpO1xuXHRjb25zdCBCdWNrZXRVUkwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9TM19CdWNrZXRVUkwnKTtcblxuXHRpZiAoIUJ1Y2tldCB8fCAhQVdTQWNjZXNzS2V5SWQgfHwgIUFXU1NlY3JldEFjY2Vzc0tleSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGNvbmZpZyA9IHtcblx0XHRjb25uZWN0aW9uOiB7XG5cdFx0XHRhY2Nlc3NLZXlJZDogQVdTQWNjZXNzS2V5SWQsXG5cdFx0XHRzZWNyZXRBY2Nlc3NLZXk6IEFXU1NlY3JldEFjY2Vzc0tleSxcblx0XHRcdHNpZ25hdHVyZVZlcnNpb246IFNpZ25hdHVyZVZlcnNpb24sXG5cdFx0XHRzM0ZvcmNlUGF0aFN0eWxlOiBGb3JjZVBhdGhTdHlsZSxcblx0XHRcdHBhcmFtczoge1xuXHRcdFx0XHRCdWNrZXQsXG5cdFx0XHRcdEFDTDogQWNsXG5cdFx0XHR9LFxuXHRcdFx0cmVnaW9uOiBSZWdpb25cblx0XHR9LFxuXHRcdFVSTEV4cGlyeVRpbWVTcGFuXG5cdH07XG5cblx0aWYgKEJ1Y2tldFVSTCkge1xuXHRcdGNvbmZpZy5jb25uZWN0aW9uLmVuZHBvaW50ID0gQnVja2V0VVJMO1xuXHR9XG5cblx0QW1hem9uUzNVcGxvYWRzLnN0b3JlID0gRmlsZVVwbG9hZC5jb25maWd1cmVVcGxvYWRzU3RvcmUoJ0FtYXpvblMzJywgQW1hem9uUzNVcGxvYWRzLm5hbWUsIGNvbmZpZyk7XG5cdEFtYXpvblMzQXZhdGFycy5zdG9yZSA9IEZpbGVVcGxvYWQuY29uZmlndXJlVXBsb2Fkc1N0b3JlKCdBbWF6b25TMycsIEFtYXpvblMzQXZhdGFycy5uYW1lLCBjb25maWcpO1xufSwgNTAwKTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoL15GaWxlVXBsb2FkX1MzXy8sIGNvbmZpZ3VyZSk7XG4iLCIvKiBnbG9iYWxzIEZpbGVVcGxvYWQsIFVwbG9hZEZTICovXG5cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IEZpbGVVcGxvYWRDbGFzcyB9IGZyb20gJy4uL2xpYi9GaWxlVXBsb2FkJztcblxuY29uc3QgRmlsZVN5c3RlbVVwbG9hZHMgPSBuZXcgRmlsZVVwbG9hZENsYXNzKHtcblx0bmFtZTogJ0ZpbGVTeXN0ZW06VXBsb2FkcycsXG5cdC8vIHN0b3JlIHNldHRlZCBiZWxsb3dcblxuXHRnZXQoZmlsZSwgcmVxLCByZXMpIHtcblx0XHRjb25zdCBmaWxlUGF0aCA9IHRoaXMuc3RvcmUuZ2V0RmlsZVBhdGgoZmlsZS5faWQsIGZpbGUpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN0YXQgPSBNZXRlb3Iud3JhcEFzeW5jKGZzLnN0YXQpKGZpbGVQYXRoKTtcblxuXHRcdFx0aWYgKHN0YXQgJiYgc3RhdC5pc0ZpbGUoKSkge1xuXHRcdFx0XHRmaWxlID0gRmlsZVVwbG9hZC5hZGRFeHRlbnNpb25UbyhmaWxlKTtcblx0XHRcdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1EaXNwb3NpdGlvbicsIGBhdHRhY2htZW50OyBmaWxlbmFtZSo9VVRGLTgnJyR7IGVuY29kZVVSSUNvbXBvbmVudChmaWxlLm5hbWUpIH1gKTtcblx0XHRcdFx0cmVzLnNldEhlYWRlcignTGFzdC1Nb2RpZmllZCcsIGZpbGUudXBsb2FkZWRBdC50b1VUQ1N0cmluZygpKTtcblx0XHRcdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgZmlsZS50eXBlKTtcblx0XHRcdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1MZW5ndGgnLCBmaWxlLnNpemUpO1xuXG5cdFx0XHRcdHRoaXMuc3RvcmUuZ2V0UmVhZFN0cmVhbShmaWxlLl9pZCwgZmlsZSkucGlwZShyZXMpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJlcy53cml0ZUhlYWQoNDA0KTtcblx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cbn0pO1xuXG5jb25zdCBGaWxlU3lzdGVtQXZhdGFycyA9IG5ldyBGaWxlVXBsb2FkQ2xhc3Moe1xuXHRuYW1lOiAnRmlsZVN5c3RlbTpBdmF0YXJzJyxcblx0Ly8gc3RvcmUgc2V0dGVkIGJlbGxvd1xuXG5cdGdldChmaWxlLCByZXEsIHJlcykge1xuXHRcdGNvbnN0IHJlcU1vZGlmaWVkSGVhZGVyID0gcmVxLmhlYWRlcnNbJ2lmLW1vZGlmaWVkLXNpbmNlJ107XG5cdFx0aWYgKHJlcU1vZGlmaWVkSGVhZGVyKSB7XG5cdFx0XHRpZiAocmVxTW9kaWZpZWRIZWFkZXIgPT09IChmaWxlLnVwbG9hZGVkQXQgJiYgZmlsZS51cGxvYWRlZEF0LnRvVVRDU3RyaW5nKCkpKSB7XG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnLCByZXFNb2RpZmllZEhlYWRlcik7XG5cdFx0XHRcdHJlcy53cml0ZUhlYWQoMzA0KTtcblx0XHRcdFx0cmVzLmVuZCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZVBhdGggPSB0aGlzLnN0b3JlLmdldEZpbGVQYXRoKGZpbGUuX2lkLCBmaWxlKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzdGF0ID0gTWV0ZW9yLndyYXBBc3luYyhmcy5zdGF0KShmaWxlUGF0aCk7XG5cblx0XHRcdGlmIChzdGF0ICYmIHN0YXQuaXNGaWxlKCkpIHtcblx0XHRcdFx0ZmlsZSA9IEZpbGVVcGxvYWQuYWRkRXh0ZW5zaW9uVG8oZmlsZSk7XG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtRGlzcG9zaXRpb24nLCAnaW5saW5lJyk7XG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnLCBmaWxlLnVwbG9hZGVkQXQudG9VVENTdHJpbmcoKSk7XG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGZpbGUudHlwZSk7XG5cdFx0XHRcdHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgZmlsZS5zaXplKTtcblxuXHRcdFx0XHR0aGlzLnN0b3JlLmdldFJlYWRTdHJlYW0oZmlsZS5faWQsIGZpbGUpLnBpcGUocmVzKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXMud3JpdGVIZWFkKDQwNCk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG59KTtcblxuXG5jb25zdCBjcmVhdGVGaWxlU3lzdGVtU3RvcmUgPSBfLmRlYm91bmNlKGZ1bmN0aW9uKCkge1xuXHRjb25zdCBvcHRpb25zID0ge1xuXHRcdHBhdGg6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX0ZpbGVTeXN0ZW1QYXRoJykgLy8nL3RtcC91cGxvYWRzL3Bob3RvcycsXG5cdH07XG5cblx0RmlsZVN5c3RlbVVwbG9hZHMuc3RvcmUgPSBGaWxlVXBsb2FkLmNvbmZpZ3VyZVVwbG9hZHNTdG9yZSgnTG9jYWwnLCBGaWxlU3lzdGVtVXBsb2Fkcy5uYW1lLCBvcHRpb25zKTtcblx0RmlsZVN5c3RlbUF2YXRhcnMuc3RvcmUgPSBGaWxlVXBsb2FkLmNvbmZpZ3VyZVVwbG9hZHNTdG9yZSgnTG9jYWwnLCBGaWxlU3lzdGVtQXZhdGFycy5uYW1lLCBvcHRpb25zKTtcblxuXHQvLyBERVBSRUNBVEVEIGJhY2t3YXJkcyBjb21wYXRpYmlsaWx0eSAocmVtb3ZlKVxuXHRVcGxvYWRGUy5nZXRTdG9yZXMoKVsnZmlsZVN5c3RlbSddID0gVXBsb2FkRlMuZ2V0U3RvcmVzKClbRmlsZVN5c3RlbVVwbG9hZHMubmFtZV07XG59LCA1MDApO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9GaWxlU3lzdGVtUGF0aCcsIGNyZWF0ZUZpbGVTeXN0ZW1TdG9yZSk7XG4iLCIvKiBnbG9iYWxzIEZpbGVVcGxvYWQgKi9cblxuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5pbXBvcnQgeyBGaWxlVXBsb2FkQ2xhc3MgfSBmcm9tICcuLi9saWIvRmlsZVVwbG9hZCc7XG5pbXBvcnQgJy4uLy4uL3Vmcy9Hb29nbGVTdG9yYWdlL3NlcnZlci5qcyc7XG5cblxuY29uc3QgZ2V0ID0gZnVuY3Rpb24oZmlsZSwgcmVxLCByZXMpIHtcblx0dGhpcy5zdG9yZS5nZXRSZWRpcmVjdFVSTChmaWxlLCAoZXJyLCBmaWxlVXJsKSA9PiB7XG5cdFx0aWYgKGVycikge1xuXHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdH1cblxuXHRcdGlmIChmaWxlVXJsKSB7XG5cdFx0XHRyZXMuc2V0SGVhZGVyKCdMb2NhdGlvbicsIGZpbGVVcmwpO1xuXHRcdFx0cmVzLndyaXRlSGVhZCgzMDIpO1xuXHRcdH1cblx0XHRyZXMuZW5kKCk7XG5cdH0pO1xufTtcblxuY29uc3QgR29vZ2xlQ2xvdWRTdG9yYWdlVXBsb2FkcyA9IG5ldyBGaWxlVXBsb2FkQ2xhc3Moe1xuXHRuYW1lOiAnR29vZ2xlQ2xvdWRTdG9yYWdlOlVwbG9hZHMnLFxuXHRnZXRcblx0Ly8gc3RvcmUgc2V0dGVkIGJlbGxvd1xufSk7XG5cbmNvbnN0IEdvb2dsZUNsb3VkU3RvcmFnZUF2YXRhcnMgPSBuZXcgRmlsZVVwbG9hZENsYXNzKHtcblx0bmFtZTogJ0dvb2dsZUNsb3VkU3RvcmFnZTpBdmF0YXJzJyxcblx0Z2V0XG5cdC8vIHN0b3JlIHNldHRlZCBiZWxsb3dcbn0pO1xuXG5jb25zdCBjb25maWd1cmUgPSBfLmRlYm91bmNlKGZ1bmN0aW9uKCkge1xuXHRjb25zdCBidWNrZXQgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9Hb29nbGVTdG9yYWdlX0J1Y2tldCcpO1xuXHRjb25zdCBhY2Nlc3NJZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX0dvb2dsZVN0b3JhZ2VfQWNjZXNzSWQnKTtcblx0Y29uc3Qgc2VjcmV0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfR29vZ2xlU3RvcmFnZV9TZWNyZXQnKTtcblx0Y29uc3QgVVJMRXhwaXJ5VGltZVNwYW4gPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9TM19VUkxFeHBpcnlUaW1lU3BhbicpO1xuXG5cdGlmICghYnVja2V0IHx8ICFhY2Nlc3NJZCB8fCAhc2VjcmV0KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgY29uZmlnID0ge1xuXHRcdGNvbm5lY3Rpb246IHtcblx0XHRcdGNyZWRlbnRpYWxzOiB7XG5cdFx0XHRcdGNsaWVudF9lbWFpbDogYWNjZXNzSWQsXG5cdFx0XHRcdHByaXZhdGVfa2V5OiBzZWNyZXRcblx0XHRcdH1cblx0XHR9LFxuXHRcdGJ1Y2tldCxcblx0XHRVUkxFeHBpcnlUaW1lU3BhblxuXHR9O1xuXG5cdEdvb2dsZUNsb3VkU3RvcmFnZVVwbG9hZHMuc3RvcmUgPSBGaWxlVXBsb2FkLmNvbmZpZ3VyZVVwbG9hZHNTdG9yZSgnR29vZ2xlU3RvcmFnZScsIEdvb2dsZUNsb3VkU3RvcmFnZVVwbG9hZHMubmFtZSwgY29uZmlnKTtcblx0R29vZ2xlQ2xvdWRTdG9yYWdlQXZhdGFycy5zdG9yZSA9IEZpbGVVcGxvYWQuY29uZmlndXJlVXBsb2Fkc1N0b3JlKCdHb29nbGVTdG9yYWdlJywgR29vZ2xlQ2xvdWRTdG9yYWdlQXZhdGFycy5uYW1lLCBjb25maWcpO1xufSwgNTAwKTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoL15GaWxlVXBsb2FkX0dvb2dsZVN0b3JhZ2VfLywgY29uZmlndXJlKTtcbiIsIi8qIGdsb2JhbHMgRmlsZVVwbG9hZCwgVXBsb2FkRlMgKi9cbmltcG9ydCBzdHJlYW0gZnJvbSAnc3RyZWFtJztcbmltcG9ydCB6bGliIGZyb20gJ3psaWInO1xuaW1wb3J0IHV0aWwgZnJvbSAndXRpbCc7XG5cbmltcG9ydCB7IEZpbGVVcGxvYWRDbGFzcyB9IGZyb20gJy4uL2xpYi9GaWxlVXBsb2FkJztcblxuY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcignRmlsZVVwbG9hZCcpO1xuXG5mdW5jdGlvbiBFeHRyYWN0UmFuZ2Uob3B0aW9ucykge1xuXHRpZiAoISh0aGlzIGluc3RhbmNlb2YgRXh0cmFjdFJhbmdlKSkge1xuXHRcdHJldHVybiBuZXcgRXh0cmFjdFJhbmdlKG9wdGlvbnMpO1xuXHR9XG5cblx0dGhpcy5zdGFydCA9IG9wdGlvbnMuc3RhcnQ7XG5cdHRoaXMuc3RvcCA9IG9wdGlvbnMuc3RvcDtcblx0dGhpcy5ieXRlc19yZWFkID0gMDtcblxuXHRzdHJlYW0uVHJhbnNmb3JtLmNhbGwodGhpcywgb3B0aW9ucyk7XG59XG51dGlsLmluaGVyaXRzKEV4dHJhY3RSYW5nZSwgc3RyZWFtLlRyYW5zZm9ybSk7XG5cblxuRXh0cmFjdFJhbmdlLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuYywgY2IpIHtcblx0aWYgKHRoaXMuYnl0ZXNfcmVhZCA+IHRoaXMuc3RvcCkge1xuXHRcdC8vIGRvbmUgcmVhZGluZ1xuXHRcdHRoaXMuZW5kKCk7XG5cdH0gZWxzZSBpZiAodGhpcy5ieXRlc19yZWFkICsgY2h1bmsubGVuZ3RoIDwgdGhpcy5zdGFydCkge1xuXHRcdC8vIHRoaXMgY2h1bmsgaXMgc3RpbGwgYmVmb3JlIHRoZSBzdGFydCBieXRlXG5cdH0gZWxzZSB7XG5cdFx0bGV0IHN0YXJ0O1xuXHRcdGxldCBzdG9wO1xuXG5cdFx0aWYgKHRoaXMuc3RhcnQgPD0gdGhpcy5ieXRlc19yZWFkKSB7XG5cdFx0XHRzdGFydCA9IDA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0YXJ0ID0gdGhpcy5zdGFydCAtIHRoaXMuYnl0ZXNfcmVhZDtcblx0XHR9XG5cdFx0aWYgKCh0aGlzLnN0b3AgLSB0aGlzLmJ5dGVzX3JlYWQgKyAxKSA8IGNodW5rLmxlbmd0aCkge1xuXHRcdFx0c3RvcCA9IHRoaXMuc3RvcCAtIHRoaXMuYnl0ZXNfcmVhZCArIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0b3AgPSBjaHVuay5sZW5ndGg7XG5cdFx0fVxuXHRcdGNvbnN0IG5ld2NodW5rID0gY2h1bmsuc2xpY2Uoc3RhcnQsIHN0b3ApO1xuXHRcdHRoaXMucHVzaChuZXdjaHVuayk7XG5cdH1cblx0dGhpcy5ieXRlc19yZWFkICs9IGNodW5rLmxlbmd0aDtcblx0Y2IoKTtcbn07XG5cblxuY29uc3QgZ2V0Qnl0ZVJhbmdlID0gZnVuY3Rpb24oaGVhZGVyKSB7XG5cdGlmIChoZWFkZXIpIHtcblx0XHRjb25zdCBtYXRjaGVzID0gaGVhZGVyLm1hdGNoKC8oXFxkKyktKFxcZCspLyk7XG5cdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN0YXJ0OiBwYXJzZUludChtYXRjaGVzWzFdLCAxMCksXG5cdFx0XHRcdHN0b3A6IHBhcnNlSW50KG1hdGNoZXNbMl0sIDEwKVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG51bGw7XG59O1xuXG5cbi8vIGNvZGUgZnJvbTogaHR0cHM6Ly9naXRodWIuY29tL2phbGlrL2phbGlrLXVmcy9ibG9iL21hc3Rlci91ZnMtc2VydmVyLmpzI0wzMTBcbmNvbnN0IHJlYWRGcm9tR3JpZEZTID0gZnVuY3Rpb24oc3RvcmVOYW1lLCBmaWxlSWQsIGZpbGUsIGhlYWRlcnMsIHJlcSwgcmVzKSB7XG5cdGNvbnN0IHN0b3JlID0gVXBsb2FkRlMuZ2V0U3RvcmUoc3RvcmVOYW1lKTtcblx0Y29uc3QgcnMgPSBzdG9yZS5nZXRSZWFkU3RyZWFtKGZpbGVJZCwgZmlsZSk7XG5cdGNvbnN0IHdzID0gbmV3IHN0cmVhbS5QYXNzVGhyb3VnaCgpO1xuXG5cdFtycywgd3NdLmZvckVhY2goc3RyZWFtID0+IHN0cmVhbS5vbignZXJyb3InLCBmdW5jdGlvbihlcnIpIHtcblx0XHRzdG9yZS5vblJlYWRFcnJvci5jYWxsKHN0b3JlLCBlcnIsIGZpbGVJZCwgZmlsZSk7XG5cdFx0cmVzLmVuZCgpO1xuXHR9KSk7XG5cblx0d3Mub24oJ2Nsb3NlJywgZnVuY3Rpb24oKSB7XG5cdFx0Ly8gQ2xvc2Ugb3V0cHV0IHN0cmVhbSBhdCB0aGUgZW5kXG5cdFx0d3MuZW1pdCgnZW5kJyk7XG5cdH0pO1xuXG5cdGNvbnN0IGFjY2VwdCA9IHJlcS5oZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXSB8fCAnJztcblxuXHQvLyBUcmFuc2Zvcm0gc3RyZWFtXG5cdHN0b3JlLnRyYW5zZm9ybVJlYWQocnMsIHdzLCBmaWxlSWQsIGZpbGUsIHJlcSwgaGVhZGVycyk7XG5cdGNvbnN0IHJhbmdlID0gZ2V0Qnl0ZVJhbmdlKHJlcS5oZWFkZXJzLnJhbmdlKTtcblx0bGV0IG91dF9vZl9yYW5nZSA9IGZhbHNlO1xuXHRpZiAocmFuZ2UpIHtcblx0XHRvdXRfb2ZfcmFuZ2UgPSAocmFuZ2Uuc3RhcnQgPiBmaWxlLnNpemUpIHx8IChyYW5nZS5zdG9wIDw9IHJhbmdlLnN0YXJ0KSB8fCAocmFuZ2Uuc3RvcCA+IGZpbGUuc2l6ZSk7XG5cdH1cblxuXHQvLyBDb21wcmVzcyBkYXRhIHVzaW5nIGd6aXBcblx0aWYgKGFjY2VwdC5tYXRjaCgvXFxiZ3ppcFxcYi8pICYmIHJhbmdlID09PSBudWxsKSB7XG5cdFx0aGVhZGVyc1snQ29udGVudC1FbmNvZGluZyddID0gJ2d6aXAnO1xuXHRcdGRlbGV0ZSBoZWFkZXJzWydDb250ZW50LUxlbmd0aCddO1xuXHRcdHJlcy53cml0ZUhlYWQoMjAwLCBoZWFkZXJzKTtcblx0XHR3cy5waXBlKHpsaWIuY3JlYXRlR3ppcCgpKS5waXBlKHJlcyk7XG5cdH0gZWxzZSBpZiAoYWNjZXB0Lm1hdGNoKC9cXGJkZWZsYXRlXFxiLykgJiYgcmFuZ2UgPT09IG51bGwpIHtcblx0XHQvLyBDb21wcmVzcyBkYXRhIHVzaW5nIGRlZmxhdGVcblx0XHRoZWFkZXJzWydDb250ZW50LUVuY29kaW5nJ10gPSAnZGVmbGF0ZSc7XG5cdFx0ZGVsZXRlIGhlYWRlcnNbJ0NvbnRlbnQtTGVuZ3RoJ107XG5cdFx0cmVzLndyaXRlSGVhZCgyMDAsIGhlYWRlcnMpO1xuXHRcdHdzLnBpcGUoemxpYi5jcmVhdGVEZWZsYXRlKCkpLnBpcGUocmVzKTtcblx0fSBlbHNlIGlmIChyYW5nZSAmJiBvdXRfb2ZfcmFuZ2UpIHtcblx0XHQvLyBvdXQgb2YgcmFuZ2UgcmVxdWVzdCwgcmV0dXJuIDQxNlxuXHRcdGRlbGV0ZSBoZWFkZXJzWydDb250ZW50LUxlbmd0aCddO1xuXHRcdGRlbGV0ZSBoZWFkZXJzWydDb250ZW50LVR5cGUnXTtcblx0XHRkZWxldGUgaGVhZGVyc1snQ29udGVudC1EaXNwb3NpdGlvbiddO1xuXHRcdGRlbGV0ZSBoZWFkZXJzWydMYXN0LU1vZGlmaWVkJ107XG5cdFx0aGVhZGVyc1snQ29udGVudC1SYW5nZSddID0gYGJ5dGVzICovJHsgZmlsZS5zaXplIH1gO1xuXHRcdHJlcy53cml0ZUhlYWQoNDE2LCBoZWFkZXJzKTtcblx0XHRyZXMuZW5kKCk7XG5cdH0gZWxzZSBpZiAocmFuZ2UpIHtcblx0XHRoZWFkZXJzWydDb250ZW50LVJhbmdlJ10gPSBgYnl0ZXMgJHsgcmFuZ2Uuc3RhcnQgfS0keyByYW5nZS5zdG9wIH0vJHsgZmlsZS5zaXplIH1gO1xuXHRcdGRlbGV0ZSBoZWFkZXJzWydDb250ZW50LUxlbmd0aCddO1xuXHRcdGhlYWRlcnNbJ0NvbnRlbnQtTGVuZ3RoJ10gPSByYW5nZS5zdG9wIC0gcmFuZ2Uuc3RhcnQgKyAxO1xuXHRcdHJlcy53cml0ZUhlYWQoMjA2LCBoZWFkZXJzKTtcblx0XHRsb2dnZXIuZGVidWcoJ0ZpbGUgdXBsb2FkIGV4dHJhY3RpbmcgcmFuZ2UnKTtcblx0XHR3cy5waXBlKG5ldyBFeHRyYWN0UmFuZ2UoeyBzdGFydDogcmFuZ2Uuc3RhcnQsIHN0b3A6IHJhbmdlLnN0b3AgfSkpLnBpcGUocmVzKTtcblx0fSBlbHNlIHtcblx0XHRyZXMud3JpdGVIZWFkKDIwMCwgaGVhZGVycyk7XG5cdFx0d3MucGlwZShyZXMpO1xuXHR9XG59O1xuXG5GaWxlVXBsb2FkLmNvbmZpZ3VyZVVwbG9hZHNTdG9yZSgnR3JpZEZTJywgJ0dyaWRGUzpVcGxvYWRzJywge1xuXHRjb2xsZWN0aW9uTmFtZTogJ3JvY2tldGNoYXRfdXBsb2Fkcydcbn0pO1xuXG4vLyBERVBSRUNBVEVEOiBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAocmVtb3ZlKVxuVXBsb2FkRlMuZ2V0U3RvcmVzKClbJ3JvY2tldGNoYXRfdXBsb2FkcyddID0gVXBsb2FkRlMuZ2V0U3RvcmVzKClbJ0dyaWRGUzpVcGxvYWRzJ107XG5cbkZpbGVVcGxvYWQuY29uZmlndXJlVXBsb2Fkc1N0b3JlKCdHcmlkRlMnLCAnR3JpZEZTOkF2YXRhcnMnLCB7XG5cdGNvbGxlY3Rpb25OYW1lOiAncm9ja2V0Y2hhdF9hdmF0YXJzJ1xufSk7XG5cblxubmV3IEZpbGVVcGxvYWRDbGFzcyh7XG5cdG5hbWU6ICdHcmlkRlM6VXBsb2FkcycsXG5cblx0Z2V0KGZpbGUsIHJlcSwgcmVzKSB7XG5cdFx0ZmlsZSA9IEZpbGVVcGxvYWQuYWRkRXh0ZW5zaW9uVG8oZmlsZSk7XG5cdFx0Y29uc3QgaGVhZGVycyA9IHtcblx0XHRcdCdDb250ZW50LURpc3Bvc2l0aW9uJzogYGF0dGFjaG1lbnQ7IGZpbGVuYW1lKj1VVEYtOCcnJHsgZW5jb2RlVVJJQ29tcG9uZW50KGZpbGUubmFtZSkgfWAsXG5cdFx0XHQnTGFzdC1Nb2RpZmllZCc6IGZpbGUudXBsb2FkZWRBdC50b1VUQ1N0cmluZygpLFxuXHRcdFx0J0NvbnRlbnQtVHlwZSc6IGZpbGUudHlwZSxcblx0XHRcdCdDb250ZW50LUxlbmd0aCc6IGZpbGUuc2l6ZVxuXHRcdH07XG5cdFx0cmV0dXJuIHJlYWRGcm9tR3JpZEZTKGZpbGUuc3RvcmUsIGZpbGUuX2lkLCBmaWxlLCBoZWFkZXJzLCByZXEsIHJlcyk7XG5cdH1cbn0pO1xuXG5uZXcgRmlsZVVwbG9hZENsYXNzKHtcblx0bmFtZTogJ0dyaWRGUzpBdmF0YXJzJyxcblxuXHRnZXQoZmlsZSwgcmVxLCByZXMpIHtcblx0XHRjb25zdCByZXFNb2RpZmllZEhlYWRlciA9IHJlcS5oZWFkZXJzWydpZi1tb2RpZmllZC1zaW5jZSddO1xuXHRcdGlmIChyZXFNb2RpZmllZEhlYWRlciAmJiByZXFNb2RpZmllZEhlYWRlciA9PT0gKGZpbGUudXBsb2FkZWRBdCAmJiBmaWxlLnVwbG9hZGVkQXQudG9VVENTdHJpbmcoKSkpIHtcblx0XHRcdHJlcy5zZXRIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnLCByZXFNb2RpZmllZEhlYWRlcik7XG5cdFx0XHRyZXMud3JpdGVIZWFkKDMwNCk7XG5cdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZpbGUgPSBGaWxlVXBsb2FkLmFkZEV4dGVuc2lvblRvKGZpbGUpO1xuXHRcdGNvbnN0IGhlYWRlcnMgPSB7XG5cdFx0XHQnQ2FjaGUtQ29udHJvbCc6ICdwdWJsaWMsIG1heC1hZ2U9MCcsXG5cdFx0XHQnRXhwaXJlcyc6ICctMScsXG5cdFx0XHQnQ29udGVudC1EaXNwb3NpdGlvbic6ICdpbmxpbmUnLFxuXHRcdFx0J0xhc3QtTW9kaWZpZWQnOiBmaWxlLnVwbG9hZGVkQXQudG9VVENTdHJpbmcoKSxcblx0XHRcdCdDb250ZW50LVR5cGUnOiBmaWxlLnR5cGUsXG5cdFx0XHQnQ29udGVudC1MZW5ndGgnOiBmaWxlLnNpemVcblx0XHR9O1xuXHRcdHJldHVybiByZWFkRnJvbUdyaWRGUyhmaWxlLnN0b3JlLCBmaWxlLl9pZCwgZmlsZSwgaGVhZGVycywgcmVxLCByZXMpO1xuXHR9XG59KTtcbiIsIi8qIGdsb2JhbHMgU2xpbmdzaG90LCBGaWxlVXBsb2FkICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuY29uc3QgY29uZmlndXJlU2xpbmdzaG90ID0gXy5kZWJvdW5jZSgoKSA9PiB7XG5cdGNvbnN0IHR5cGUgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9TdG9yYWdlX1R5cGUnKTtcblx0Y29uc3QgYnVja2V0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfUzNfQnVja2V0Jyk7XG5cdGNvbnN0IGFjbCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX0FjbCcpO1xuXHRjb25zdCBhY2Nlc3NLZXkgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9TM19BV1NBY2Nlc3NLZXlJZCcpO1xuXHRjb25zdCBzZWNyZXRLZXkgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9TM19BV1NTZWNyZXRBY2Nlc3NLZXknKTtcblx0Y29uc3QgY2RuID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfUzNfQ0ROJyk7XG5cdGNvbnN0IHJlZ2lvbiA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1MzX1JlZ2lvbicpO1xuXHRjb25zdCBidWNrZXRVcmwgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9TM19CdWNrZXRVUkwnKTtcblxuXHRkZWxldGUgU2xpbmdzaG90Ll9kaXJlY3RpdmVzWydyb2NrZXRjaGF0LXVwbG9hZHMnXTtcblxuXHRpZiAodHlwZSA9PT0gJ0FtYXpvblMzJyAmJiAhXy5pc0VtcHR5KGJ1Y2tldCkgJiYgIV8uaXNFbXB0eShhY2Nlc3NLZXkpICYmICFfLmlzRW1wdHkoc2VjcmV0S2V5KSkge1xuXHRcdGlmIChTbGluZ3Nob3QuX2RpcmVjdGl2ZXNbJ3JvY2tldGNoYXQtdXBsb2FkcyddKSB7XG5cdFx0XHRkZWxldGUgU2xpbmdzaG90Ll9kaXJlY3RpdmVzWydyb2NrZXRjaGF0LXVwbG9hZHMnXTtcblx0XHR9XG5cdFx0Y29uc3QgY29uZmlnID0ge1xuXHRcdFx0YnVja2V0LFxuXHRcdFx0a2V5KGZpbGUsIG1ldGFDb250ZXh0KSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gUmFuZG9tLmlkKCk7XG5cdFx0XHRcdGNvbnN0IHBhdGggPSBgJHsgUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ3VuaXF1ZUlEJykgfS91cGxvYWRzLyR7IG1ldGFDb250ZXh0LnJpZCB9LyR7IHRoaXMudXNlcklkIH0vJHsgaWQgfWA7XG5cblx0XHRcdFx0Y29uc3QgdXBsb2FkID0ge1xuXHRcdFx0XHRcdF9pZDogaWQsXG5cdFx0XHRcdFx0cmlkOiBtZXRhQ29udGV4dC5yaWQsXG5cdFx0XHRcdFx0QW1hem9uUzM6IHtcblx0XHRcdFx0XHRcdHBhdGhcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXBsb2Fkcy5pbnNlcnRGaWxlSW5pdCh0aGlzLnVzZXJJZCwgJ0FtYXpvblMzOlVwbG9hZHMnLCBmaWxlLCB1cGxvYWQpO1xuXG5cdFx0XHRcdHJldHVybiBwYXRoO1xuXHRcdFx0fSxcblx0XHRcdEFXU0FjY2Vzc0tleUlkOiBhY2Nlc3NLZXksXG5cdFx0XHRBV1NTZWNyZXRBY2Nlc3NLZXk6IHNlY3JldEtleVxuXHRcdH07XG5cblx0XHRpZiAoIV8uaXNFbXB0eShhY2wpKSB7XG5cdFx0XHRjb25maWcuYWNsID0gYWNsO1xuXHRcdH1cblxuXHRcdGlmICghXy5pc0VtcHR5KGNkbikpIHtcblx0XHRcdGNvbmZpZy5jZG4gPSBjZG47XG5cdFx0fVxuXG5cdFx0aWYgKCFfLmlzRW1wdHkocmVnaW9uKSkge1xuXHRcdFx0Y29uZmlnLnJlZ2lvbiA9IHJlZ2lvbjtcblx0XHR9XG5cblx0XHRpZiAoIV8uaXNFbXB0eShidWNrZXRVcmwpKSB7XG5cdFx0XHRjb25maWcuYnVja2V0VXJsID0gYnVja2V0VXJsO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRTbGluZ3Nob3QuY3JlYXRlRGlyZWN0aXZlKCdyb2NrZXRjaGF0LXVwbG9hZHMnLCBTbGluZ3Nob3QuUzNTdG9yYWdlLCBjb25maWcpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNvbmZpZ3VyaW5nIFMzIC0+JywgZS5tZXNzYWdlKTtcblx0XHR9XG5cdH1cbn0sIDUwMCk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScsIGNvbmZpZ3VyZVNsaW5nc2hvdCk7XG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgvXkZpbGVVcGxvYWRfUzNfLywgY29uZmlndXJlU2xpbmdzaG90KTtcblxuXG5cbmNvbnN0IGNyZWF0ZUdvb2dsZVN0b3JhZ2VEaXJlY3RpdmUgPSBfLmRlYm91bmNlKCgpID0+IHtcblx0Y29uc3QgdHlwZSA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScpO1xuXHRjb25zdCBidWNrZXQgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9Hb29nbGVTdG9yYWdlX0J1Y2tldCcpO1xuXHRjb25zdCBhY2Nlc3NJZCA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX0dvb2dsZVN0b3JhZ2VfQWNjZXNzSWQnKTtcblx0Y29uc3Qgc2VjcmV0ID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfR29vZ2xlU3RvcmFnZV9TZWNyZXQnKTtcblxuXHRkZWxldGUgU2xpbmdzaG90Ll9kaXJlY3RpdmVzWydyb2NrZXRjaGF0LXVwbG9hZHMtZ3MnXTtcblxuXHRpZiAodHlwZSA9PT0gJ0dvb2dsZUNsb3VkU3RvcmFnZScgJiYgIV8uaXNFbXB0eShzZWNyZXQpICYmICFfLmlzRW1wdHkoYWNjZXNzSWQpICYmICFfLmlzRW1wdHkoYnVja2V0KSkge1xuXHRcdGlmIChTbGluZ3Nob3QuX2RpcmVjdGl2ZXNbJ3JvY2tldGNoYXQtdXBsb2Fkcy1ncyddKSB7XG5cdFx0XHRkZWxldGUgU2xpbmdzaG90Ll9kaXJlY3RpdmVzWydyb2NrZXRjaGF0LXVwbG9hZHMtZ3MnXTtcblx0XHR9XG5cblx0XHRjb25zdCBjb25maWcgPSB7XG5cdFx0XHRidWNrZXQsXG5cdFx0XHRHb29nbGVBY2Nlc3NJZDogYWNjZXNzSWQsXG5cdFx0XHRHb29nbGVTZWNyZXRLZXk6IHNlY3JldCxcblx0XHRcdGtleShmaWxlLCBtZXRhQ29udGV4dCkge1xuXHRcdFx0XHRjb25zdCBpZCA9IFJhbmRvbS5pZCgpO1xuXHRcdFx0XHRjb25zdCBwYXRoID0gYCR7IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCd1bmlxdWVJRCcpIH0vdXBsb2Fkcy8keyBtZXRhQ29udGV4dC5yaWQgfS8keyB0aGlzLnVzZXJJZCB9LyR7IGlkIH1gO1xuXG5cdFx0XHRcdGNvbnN0IHVwbG9hZCA9IHtcblx0XHRcdFx0XHRfaWQ6IGlkLFxuXHRcdFx0XHRcdHJpZDogbWV0YUNvbnRleHQucmlkLFxuXHRcdFx0XHRcdEdvb2dsZVN0b3JhZ2U6IHtcblx0XHRcdFx0XHRcdHBhdGhcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuVXBsb2Fkcy5pbnNlcnRGaWxlSW5pdCh0aGlzLnVzZXJJZCwgJ0dvb2dsZUNsb3VkU3RvcmFnZTpVcGxvYWRzJywgZmlsZSwgdXBsb2FkKTtcblxuXHRcdFx0XHRyZXR1cm4gcGF0aDtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdFNsaW5nc2hvdC5jcmVhdGVEaXJlY3RpdmUoJ3JvY2tldGNoYXQtdXBsb2Fkcy1ncycsIFNsaW5nc2hvdC5Hb29nbGVDbG91ZCwgY29uZmlnKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciBjb25maWd1cmluZyBHb29nbGVDbG91ZFN0b3JhZ2UgLT4nLCBlLm1lc3NhZ2UpO1xuXHRcdH1cblx0fVxufSwgNTAwKTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJywgY3JlYXRlR29vZ2xlU3RvcmFnZURpcmVjdGl2ZSk7XG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgvXkZpbGVVcGxvYWRfR29vZ2xlU3RvcmFnZV8vLCBjcmVhdGVHb29nbGVTdG9yYWdlRGlyZWN0aXZlKTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdCdzZW5kRmlsZU1lc3NhZ2UnKHJvb21JZCwgc3RvcmUsIGZpbGUsIG1zZ0RhdGEgPSB7fSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdzZW5kRmlsZU1lc3NhZ2UnIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb20gPSBNZXRlb3IuY2FsbCgnY2FuQWNjZXNzUm9vbScsIHJvb21JZCwgTWV0ZW9yLnVzZXJJZCgpKTtcblxuXHRcdGlmICghcm9vbSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNoZWNrKG1zZ0RhdGEsIHtcblx0XHRcdGF2YXRhcjogTWF0Y2guT3B0aW9uYWwoU3RyaW5nKSxcblx0XHRcdGVtb2ppOiBNYXRjaC5PcHRpb25hbChTdHJpbmcpLFxuXHRcdFx0YWxpYXM6IE1hdGNoLk9wdGlvbmFsKFN0cmluZyksXG5cdFx0XHRncm91cGFibGU6IE1hdGNoLk9wdGlvbmFsKEJvb2xlYW4pLFxuXHRcdFx0bXNnOiBNYXRjaC5PcHRpb25hbChTdHJpbmcpXG5cdFx0fSk7XG5cblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5VcGxvYWRzLnVwZGF0ZUZpbGVDb21wbGV0ZShmaWxlLl9pZCwgTWV0ZW9yLnVzZXJJZCgpLCBfLm9taXQoZmlsZSwgJ19pZCcpKTtcblxuXHRcdGNvbnN0IGZpbGVVcmwgPSBgL2ZpbGUtdXBsb2FkLyR7IGZpbGUuX2lkIH0vJHsgZW5jb2RlVVJJKGZpbGUubmFtZSkgfWA7XG5cblx0XHRjb25zdCBhdHRhY2htZW50ID0ge1xuXHRcdFx0dGl0bGU6IGZpbGUubmFtZSxcblx0XHRcdHR5cGU6ICdmaWxlJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBmaWxlLmRlc2NyaXB0aW9uLFxuXHRcdFx0dGl0bGVfbGluazogZmlsZVVybCxcblx0XHRcdHRpdGxlX2xpbmtfZG93bmxvYWQ6IHRydWVcblx0XHR9O1xuXG5cdFx0aWYgKC9eaW1hZ2VcXC8uKy8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRhdHRhY2htZW50LmltYWdlX3VybCA9IGZpbGVVcmw7XG5cdFx0XHRhdHRhY2htZW50LmltYWdlX3R5cGUgPSBmaWxlLnR5cGU7XG5cdFx0XHRhdHRhY2htZW50LmltYWdlX3NpemUgPSBmaWxlLnNpemU7XG5cdFx0XHRpZiAoZmlsZS5pZGVudGlmeSAmJiBmaWxlLmlkZW50aWZ5LnNpemUpIHtcblx0XHRcdFx0YXR0YWNobWVudC5pbWFnZV9kaW1lbnNpb25zID0gZmlsZS5pZGVudGlmeS5zaXplO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoL15hdWRpb1xcLy4rLy50ZXN0KGZpbGUudHlwZSkpIHtcblx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fdXJsID0gZmlsZVVybDtcblx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fdHlwZSA9IGZpbGUudHlwZTtcblx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fc2l6ZSA9IGZpbGUuc2l6ZTtcblx0XHR9IGVsc2UgaWYgKC9edmlkZW9cXC8uKy8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRhdHRhY2htZW50LnZpZGVvX3VybCA9IGZpbGVVcmw7XG5cdFx0XHRhdHRhY2htZW50LnZpZGVvX3R5cGUgPSBmaWxlLnR5cGU7XG5cdFx0XHRhdHRhY2htZW50LnZpZGVvX3NpemUgPSBmaWxlLnNpemU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cdFx0bGV0IG1zZyA9IE9iamVjdC5hc3NpZ24oe1xuXHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdHJpZDogcm9vbUlkLFxuXHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRtc2c6ICcnLFxuXHRcdFx0ZmlsZToge1xuXHRcdFx0XHRfaWQ6IGZpbGUuX2lkLFxuXHRcdFx0XHRuYW1lOiBmaWxlLm5hbWUsXG5cdFx0XHRcdHR5cGU6IGZpbGUudHlwZVxuXHRcdFx0fSxcblx0XHRcdGdyb3VwYWJsZTogZmFsc2UsXG5cdFx0XHRhdHRhY2htZW50czogW2F0dGFjaG1lbnRdXG5cdFx0fSwgbXNnRGF0YSk7XG5cblx0XHRtc2cgPSBNZXRlb3IuY2FsbCgnc2VuZE1lc3NhZ2UnLCBtc2cpO1xuXG5cdFx0TWV0ZW9yLmRlZmVyKCgpID0+IFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignYWZ0ZXJGaWxlVXBsb2FkJywgeyB1c2VyLCByb29tLCBtZXNzYWdlOiBtc2cgfSkpO1xuXG5cdFx0cmV0dXJuIG1zZztcblx0fVxufSk7XG4iLCIvKiBnbG9iYWxzIFVwbG9hZEZTICovXG5cbmxldCBwcm90ZWN0ZWRGaWxlcztcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZpbGVVcGxvYWRfUHJvdGVjdEZpbGVzJywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRwcm90ZWN0ZWRGaWxlcyA9IHZhbHVlO1xufSk7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0Z2V0UzNGaWxlVXJsKGZpbGVJZCkge1xuXHRcdGlmIChwcm90ZWN0ZWRGaWxlcyAmJiAhTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdzZW5kRmlsZU1lc3NhZ2UnIH0pO1xuXHRcdH1cblx0XHRjb25zdCBmaWxlID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXBsb2Fkcy5maW5kT25lQnlJZChmaWxlSWQpO1xuXG5cdFx0cmV0dXJuIFVwbG9hZEZTLmdldFN0b3JlKCdBbWF6b25TMzpVcGxvYWRzJykuZ2V0UmVkaXJlY3RVUkwoZmlsZSk7XG5cdH1cbn0pO1xuIiwiUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnRmlsZVVwbG9hZCcsIGZ1bmN0aW9uKCkge1xuXHR0aGlzLmFkZCgnRmlsZVVwbG9hZF9FbmFibGVkJywgdHJ1ZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRwdWJsaWM6IHRydWVcblx0fSk7XG5cblx0dGhpcy5hZGQoJ0ZpbGVVcGxvYWRfTWF4RmlsZVNpemUnLCAyMDk3MTUyLCB7XG5cdFx0dHlwZTogJ2ludCcsXG5cdFx0cHVibGljOiB0cnVlXG5cdH0pO1xuXG5cdHRoaXMuYWRkKCdGaWxlVXBsb2FkX01lZGlhVHlwZVdoaXRlTGlzdCcsICdpbWFnZS8qLGF1ZGlvLyosdmlkZW8vKixhcHBsaWNhdGlvbi96aXAsYXBwbGljYXRpb24veC1yYXItY29tcHJlc3NlZCxhcHBsaWNhdGlvbi9wZGYsdGV4dC9wbGFpbixhcHBsaWNhdGlvbi9tc3dvcmQsYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQnLCB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGkxOG5EZXNjcmlwdGlvbjogJ0ZpbGVVcGxvYWRfTWVkaWFUeXBlV2hpdGVMaXN0RGVzY3JpcHRpb24nXG5cdH0pO1xuXG5cdHRoaXMuYWRkKCdGaWxlVXBsb2FkX1Byb3RlY3RGaWxlcycsIHRydWUsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGkxOG5EZXNjcmlwdGlvbjogJ0ZpbGVVcGxvYWRfUHJvdGVjdEZpbGVzRGVzY3JpcHRpb24nXG5cdH0pO1xuXG5cdHRoaXMuYWRkKCdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScsICdHcmlkRlMnLCB7XG5cdFx0dHlwZTogJ3NlbGVjdCcsXG5cdFx0dmFsdWVzOiBbe1xuXHRcdFx0a2V5OiAnR3JpZEZTJyxcblx0XHRcdGkxOG5MYWJlbDogJ0dyaWRGUydcblx0XHR9LCB7XG5cdFx0XHRrZXk6ICdBbWF6b25TMycsXG5cdFx0XHRpMThuTGFiZWw6ICdBbWF6b25TMydcblx0XHR9LCB7XG5cdFx0XHRrZXk6ICdHb29nbGVDbG91ZFN0b3JhZ2UnLFxuXHRcdFx0aTE4bkxhYmVsOiAnR29vZ2xlQ2xvdWRTdG9yYWdlJ1xuXHRcdH0sIHtcblx0XHRcdGtleTogJ0ZpbGVTeXN0ZW0nLFxuXHRcdFx0aTE4bkxhYmVsOiAnRmlsZVN5c3RlbSdcblx0XHR9XSxcblx0XHRwdWJsaWM6IHRydWVcblx0fSk7XG5cblx0dGhpcy5zZWN0aW9uKCdBbWF6b24gUzMnLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnRmlsZVVwbG9hZF9TM19CdWNrZXQnLCAnJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbmFibGVRdWVyeToge1xuXHRcdFx0XHRfaWQ6ICdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScsXG5cdFx0XHRcdHZhbHVlOiAnQW1hem9uUzMnXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0ZpbGVVcGxvYWRfUzNfQWNsJywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnRmlsZVVwbG9hZF9TdG9yYWdlX1R5cGUnLFxuXHRcdFx0XHR2YWx1ZTogJ0FtYXpvblMzJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdGaWxlVXBsb2FkX1MzX0FXU0FjY2Vzc0tleUlkJywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnRmlsZVVwbG9hZF9TdG9yYWdlX1R5cGUnLFxuXHRcdFx0XHR2YWx1ZTogJ0FtYXpvblMzJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdGaWxlVXBsb2FkX1MzX0FXU1NlY3JldEFjY2Vzc0tleScsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdFx0dmFsdWU6ICdBbWF6b25TMydcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnRmlsZVVwbG9hZF9TM19DRE4nLCAnJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbmFibGVRdWVyeToge1xuXHRcdFx0XHRfaWQ6ICdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScsXG5cdFx0XHRcdHZhbHVlOiAnQW1hem9uUzMnXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0ZpbGVVcGxvYWRfUzNfUmVnaW9uJywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnRmlsZVVwbG9hZF9TdG9yYWdlX1R5cGUnLFxuXHRcdFx0XHR2YWx1ZTogJ0FtYXpvblMzJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdGaWxlVXBsb2FkX1MzX0J1Y2tldFVSTCcsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdFx0dmFsdWU6ICdBbWF6b25TMydcblx0XHRcdH0sXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdPdmVycmlkZV9VUkxfdG9fd2hpY2hfZmlsZXNfYXJlX3VwbG9hZGVkX1RoaXNfdXJsX2Fsc29fdXNlZF9mb3JfZG93bmxvYWRzX3VubGVzc19hX0NETl9pc19naXZlbi4nXG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0ZpbGVVcGxvYWRfUzNfU2lnbmF0dXJlVmVyc2lvbicsICd2NCcsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW5hYmxlUXVlcnk6IHtcblx0XHRcdFx0X2lkOiAnRmlsZVVwbG9hZF9TdG9yYWdlX1R5cGUnLFxuXHRcdFx0XHR2YWx1ZTogJ0FtYXpvblMzJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdGaWxlVXBsb2FkX1MzX0ZvcmNlUGF0aFN0eWxlJywgZmFsc2UsIHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdFx0dmFsdWU6ICdBbWF6b25TMydcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnRmlsZVVwbG9hZF9TM19VUkxFeHBpcnlUaW1lU3BhbicsIDEyMCwge1xuXHRcdFx0dHlwZTogJ2ludCcsXG5cdFx0XHRlbmFibGVRdWVyeToge1xuXHRcdFx0XHRfaWQ6ICdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScsXG5cdFx0XHRcdHZhbHVlOiAnQW1hem9uUzMnXG5cdFx0XHR9LFxuXHRcdFx0aTE4bkRlc2NyaXB0aW9uOiAnRmlsZVVwbG9hZF9TM19VUkxFeHBpcnlUaW1lU3Bhbl9EZXNjcmlwdGlvbidcblx0XHR9KTtcblx0fSk7XG5cblx0dGhpcy5zZWN0aW9uKCdHb29nbGUgQ2xvdWQgU3RvcmFnZScsIGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuYWRkKCdGaWxlVXBsb2FkX0dvb2dsZVN0b3JhZ2VfQnVja2V0JywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0cHJpdmF0ZTogdHJ1ZSxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdFx0dmFsdWU6ICdHb29nbGVDbG91ZFN0b3JhZ2UnXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ0ZpbGVVcGxvYWRfR29vZ2xlU3RvcmFnZV9BY2Nlc3NJZCcsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdHByaXZhdGU6IHRydWUsXG5cdFx0XHRlbmFibGVRdWVyeToge1xuXHRcdFx0XHRfaWQ6ICdGaWxlVXBsb2FkX1N0b3JhZ2VfVHlwZScsXG5cdFx0XHRcdHZhbHVlOiAnR29vZ2xlQ2xvdWRTdG9yYWdlJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdGaWxlVXBsb2FkX0dvb2dsZVN0b3JhZ2VfU2VjcmV0JywgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0bXVsdGlsaW5lOiB0cnVlLFxuXHRcdFx0cHJpdmF0ZTogdHJ1ZSxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdFx0dmFsdWU6ICdHb29nbGVDbG91ZFN0b3JhZ2UnXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRoaXMuc2VjdGlvbignRmlsZSBTeXN0ZW0nLCBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFkZCgnRmlsZVVwbG9hZF9GaWxlU3lzdGVtUGF0aCcsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVuYWJsZVF1ZXJ5OiB7XG5cdFx0XHRcdF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJyxcblx0XHRcdFx0dmFsdWU6ICdGaWxlU3lzdGVtJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0aGlzLmFkZCgnRmlsZVVwbG9hZF9FbmFibGVkX0RpcmVjdCcsIHRydWUsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0cHVibGljOiB0cnVlXG5cdH0pO1xufSk7XG4iLCJpbXBvcnQge1VwbG9hZEZTfSBmcm9tICdtZXRlb3IvamFsaWs6dWZzJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IFMzIGZyb20gJ2F3cy1zZGsvY2xpZW50cy9zMyc7XG5pbXBvcnQgc3RyZWFtIGZyb20gJ3N0cmVhbSc7XG5cbi8qKlxuICogQW1hem9uUzMgc3RvcmVcbiAqIEBwYXJhbSBvcHRpb25zXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0IGNsYXNzIEFtYXpvblMzU3RvcmUgZXh0ZW5kcyBVcGxvYWRGUy5TdG9yZSB7XG5cblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xuXHRcdC8vIERlZmF1bHQgb3B0aW9uc1xuXHRcdC8vIG9wdGlvbnMuc2VjcmV0QWNjZXNzS2V5LFxuXHRcdC8vIG9wdGlvbnMuYWNjZXNzS2V5SWQsXG5cdFx0Ly8gb3B0aW9ucy5yZWdpb24sXG5cdFx0Ly8gb3B0aW9ucy5zc2xFbmFibGVkIC8vIG9wdGlvbmFsXG5cblx0XHRvcHRpb25zID0gXy5leHRlbmQoe1xuXHRcdFx0aHR0cE9wdGlvbnM6IHtcblx0XHRcdFx0dGltZW91dDogNjAwMCxcblx0XHRcdFx0YWdlbnQ6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSwgb3B0aW9ucyk7XG5cblx0XHRzdXBlcihvcHRpb25zKTtcblxuXHRcdGNvbnN0IGNsYXNzT3B0aW9ucyA9IG9wdGlvbnM7XG5cblx0XHRjb25zdCBzMyA9IG5ldyBTMyhvcHRpb25zLmNvbm5lY3Rpb24pO1xuXG5cdFx0b3B0aW9ucy5nZXRQYXRoID0gb3B0aW9ucy5nZXRQYXRoIHx8IGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdHJldHVybiBmaWxlLl9pZDtcblx0XHR9O1xuXG5cdFx0dGhpcy5nZXRQYXRoID0gZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0aWYgKGZpbGUuQW1hem9uUzMpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGUuQW1hem9uUzMucGF0aDtcblx0XHRcdH1cblx0XHRcdC8vIENvbXBhdGliaWxpdHlcblx0XHRcdC8vIFRPRE86IE1pZ3JhdGlvblxuXHRcdFx0aWYgKGZpbGUuczMpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGUuczMucGF0aCArIGZpbGUuX2lkO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLmdldFJlZGlyZWN0VVJMID0gZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0Y29uc3QgcGFyYW1zID0ge1xuXHRcdFx0XHRLZXk6IHRoaXMuZ2V0UGF0aChmaWxlKSxcblx0XHRcdFx0RXhwaXJlczogY2xhc3NPcHRpb25zLlVSTEV4cGlyeVRpbWVTcGFuXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gczMuZ2V0U2lnbmVkVXJsKCdnZXRPYmplY3QnLCBwYXJhbXMpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBDcmVhdGVzIHRoZSBmaWxlIGluIHRoZSBjb2xsZWN0aW9uXG5cdFx0ICogQHBhcmFtIGZpbGVcblx0XHQgKiBAcGFyYW0gY2FsbGJhY2tcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdFx0ICovXG5cdFx0dGhpcy5jcmVhdGUgPSBmdW5jdGlvbihmaWxlLCBjYWxsYmFjaykge1xuXHRcdFx0Y2hlY2soZmlsZSwgT2JqZWN0KTtcblxuXHRcdFx0aWYgKGZpbGUuX2lkID09IG51bGwpIHtcblx0XHRcdFx0ZmlsZS5faWQgPSBSYW5kb20uaWQoKTtcblx0XHRcdH1cblxuXHRcdFx0ZmlsZS5BbWF6b25TMyA9IHtcblx0XHRcdFx0cGF0aDogdGhpcy5vcHRpb25zLmdldFBhdGgoZmlsZSlcblx0XHRcdH07XG5cblx0XHRcdGZpbGUuc3RvcmUgPSB0aGlzLm9wdGlvbnMubmFtZTsgLy8gYXNzaWduIHN0b3JlIHRvIGZpbGVcblx0XHRcdHJldHVybiB0aGlzLmdldENvbGxlY3Rpb24oKS5pbnNlcnQoZmlsZSwgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmVzIHRoZSBmaWxlXG5cdFx0ICogQHBhcmFtIGZpbGVJZFxuXHRcdCAqIEBwYXJhbSBjYWxsYmFja1xuXHRcdCAqL1xuXHRcdHRoaXMuZGVsZXRlID0gZnVuY3Rpb24oZmlsZUlkLCBjYWxsYmFjaykge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuZ2V0Q29sbGVjdGlvbigpLmZpbmRPbmUoe19pZDogZmlsZUlkfSk7XG5cdFx0XHRjb25zdCBwYXJhbXMgPSB7XG5cdFx0XHRcdEtleTogdGhpcy5nZXRQYXRoKGZpbGUpXG5cdFx0XHR9O1xuXG5cdFx0XHRzMy5kZWxldGVPYmplY3QocGFyYW1zLCAoZXJyLCBkYXRhKSA9PiB7XG5cdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjayhlcnIsIGRhdGEpO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybnMgdGhlIGZpbGUgcmVhZCBzdHJlYW1cblx0XHQgKiBAcGFyYW0gZmlsZUlkXG5cdFx0ICogQHBhcmFtIGZpbGVcblx0XHQgKiBAcGFyYW0gb3B0aW9uc1xuXHRcdCAqIEByZXR1cm4geyp9XG5cdFx0ICovXG5cdFx0dGhpcy5nZXRSZWFkU3RyZWFtID0gZnVuY3Rpb24oZmlsZUlkLCBmaWxlLCBvcHRpb25zID0ge30pIHtcblx0XHRcdGNvbnN0IHBhcmFtcyA9IHtcblx0XHRcdFx0S2V5OiB0aGlzLmdldFBhdGgoZmlsZSlcblx0XHRcdH07XG5cblx0XHRcdGlmIChvcHRpb25zLnN0YXJ0ICYmIG9wdGlvbnMuZW5kKSB7XG5cdFx0XHRcdHBhcmFtcy5SYW5nZSA9IGAkeyBvcHRpb25zLnN0YXJ0IH0gLSAkeyBvcHRpb25zLmVuZCB9YDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHMzLmdldE9iamVjdChwYXJhbXMpLmNyZWF0ZVJlYWRTdHJlYW0oKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJucyB0aGUgZmlsZSB3cml0ZSBzdHJlYW1cblx0XHQgKiBAcGFyYW0gZmlsZUlkXG5cdFx0ICogQHBhcmFtIGZpbGVcblx0XHQgKiBAcGFyYW0gb3B0aW9uc1xuXHRcdCAqIEByZXR1cm4geyp9XG5cdFx0ICovXG5cdFx0dGhpcy5nZXRXcml0ZVN0cmVhbSA9IGZ1bmN0aW9uKGZpbGVJZCwgZmlsZS8qLCBvcHRpb25zKi8pIHtcblx0XHRcdGNvbnN0IHdyaXRlU3RyZWFtID0gbmV3IHN0cmVhbS5QYXNzVGhyb3VnaCgpO1xuXHRcdFx0d3JpdGVTdHJlYW0ubGVuZ3RoID0gZmlsZS5zaXplO1xuXG5cdFx0XHR3cml0ZVN0cmVhbS5vbignbmV3TGlzdGVuZXInLCAoZXZlbnQsIGxpc3RlbmVyKSA9PiB7XG5cdFx0XHRcdGlmIChldmVudCA9PT0gJ2ZpbmlzaCcpIHtcblx0XHRcdFx0XHRwcm9jZXNzLm5leHRUaWNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHdyaXRlU3RyZWFtLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcik7XG5cdFx0XHRcdFx0XHR3cml0ZVN0cmVhbS5vbigncmVhbF9maW5pc2gnLCBsaXN0ZW5lcik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRzMy5wdXRPYmplY3Qoe1xuXHRcdFx0XHRLZXk6IHRoaXMuZ2V0UGF0aChmaWxlKSxcblx0XHRcdFx0Qm9keTogd3JpdGVTdHJlYW0sXG5cdFx0XHRcdENvbnRlbnRUeXBlOiBmaWxlLnR5cGUsXG5cdFx0XHRcdENvbnRlbnREaXNwb3NpdGlvbjogYGlubGluZTsgZmlsZW5hbWU9XCIkeyBlbmNvZGVVUkkoZmlsZS5uYW1lKSB9XCJgXG5cblx0XHRcdH0sIChlcnJvcikgPT4ge1xuXHRcdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHdyaXRlU3RyZWFtLmVtaXQoJ3JlYWxfZmluaXNoJyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHdyaXRlU3RyZWFtO1xuXHRcdH07XG5cdH1cbn1cblxuLy8gQWRkIHN0b3JlIHRvIFVGUyBuYW1lc3BhY2VcblVwbG9hZEZTLnN0b3JlLkFtYXpvblMzID0gQW1hem9uUzNTdG9yZTtcbiIsImltcG9ydCB7VXBsb2FkRlN9IGZyb20gJ21ldGVvci9qYWxpazp1ZnMnO1xuaW1wb3J0IGdjU3RvcmFnZSBmcm9tICdAZ29vZ2xlLWNsb3VkL3N0b3JhZ2UnO1xuXG4vKipcbiAqIEdvb2dsZVN0b3JhZ2Ugc3RvcmVcbiAqIEBwYXJhbSBvcHRpb25zXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0IGNsYXNzIEdvb2dsZVN0b3JhZ2VTdG9yZSBleHRlbmRzIFVwbG9hZEZTLlN0b3JlIHtcblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG5cdFx0c3VwZXIob3B0aW9ucyk7XG5cblx0XHRjb25zdCBnY3MgPSBnY1N0b3JhZ2Uob3B0aW9ucy5jb25uZWN0aW9uKTtcblx0XHR0aGlzLmJ1Y2tldCA9IGdjcy5idWNrZXQob3B0aW9ucy5idWNrZXQpO1xuXG5cdFx0b3B0aW9ucy5nZXRQYXRoID0gb3B0aW9ucy5nZXRQYXRoIHx8IGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdHJldHVybiBmaWxlLl9pZDtcblx0XHR9O1xuXG5cdFx0dGhpcy5nZXRQYXRoID0gZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0aWYgKGZpbGUuR29vZ2xlU3RvcmFnZSkge1xuXHRcdFx0XHRyZXR1cm4gZmlsZS5Hb29nbGVTdG9yYWdlLnBhdGg7XG5cdFx0XHR9XG5cdFx0XHQvLyBDb21wYXRpYmlsaXR5XG5cdFx0XHQvLyBUT0RPOiBNaWdyYXRpb25cblx0XHRcdGlmIChmaWxlLmdvb2dsZUNsb3VkU3RvcmFnZSkge1xuXHRcdFx0XHRyZXR1cm4gZmlsZS5nb29nbGVDbG91ZFN0b3JhZ2UucGF0aCArIGZpbGUuX2lkO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLmdldFJlZGlyZWN0VVJMID0gZnVuY3Rpb24oZmlsZSwgY2FsbGJhY2spIHtcblx0XHRcdGNvbnN0IHBhcmFtcyA9IHtcblx0XHRcdFx0YWN0aW9uOiAncmVhZCcsXG5cdFx0XHRcdHJlc3BvbnNlRGlzcG9zaXRpb246ICdpbmxpbmUnLFxuXHRcdFx0XHRleHBpcmVzOiBEYXRlLm5vdygpK3RoaXMub3B0aW9ucy5VUkxFeHBpcnlUaW1lU3BhbioxMDAwXG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmJ1Y2tldC5maWxlKHRoaXMuZ2V0UGF0aChmaWxlKSkuZ2V0U2lnbmVkVXJsKHBhcmFtcywgY2FsbGJhY2spO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBDcmVhdGVzIHRoZSBmaWxlIGluIHRoZSBjb2xsZWN0aW9uXG5cdFx0ICogQHBhcmFtIGZpbGVcblx0XHQgKiBAcGFyYW0gY2FsbGJhY2tcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdFx0ICovXG5cdFx0dGhpcy5jcmVhdGUgPSBmdW5jdGlvbihmaWxlLCBjYWxsYmFjaykge1xuXHRcdFx0Y2hlY2soZmlsZSwgT2JqZWN0KTtcblxuXHRcdFx0aWYgKGZpbGUuX2lkID09IG51bGwpIHtcblx0XHRcdFx0ZmlsZS5faWQgPSBSYW5kb20uaWQoKTtcblx0XHRcdH1cblxuXHRcdFx0ZmlsZS5Hb29nbGVTdG9yYWdlID0ge1xuXHRcdFx0XHRwYXRoOiB0aGlzLm9wdGlvbnMuZ2V0UGF0aChmaWxlKVxuXHRcdFx0fTtcblxuXHRcdFx0ZmlsZS5zdG9yZSA9IHRoaXMub3B0aW9ucy5uYW1lOyAvLyBhc3NpZ24gc3RvcmUgdG8gZmlsZVxuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q29sbGVjdGlvbigpLmluc2VydChmaWxlLCBjYWxsYmFjayk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZXMgdGhlIGZpbGVcblx0XHQgKiBAcGFyYW0gZmlsZUlkXG5cdFx0ICogQHBhcmFtIGNhbGxiYWNrXG5cdFx0ICovXG5cdFx0dGhpcy5kZWxldGUgPSBmdW5jdGlvbihmaWxlSWQsIGNhbGxiYWNrKSB7XG5cdFx0XHRjb25zdCBmaWxlID0gdGhpcy5nZXRDb2xsZWN0aW9uKCkuZmluZE9uZSh7X2lkOiBmaWxlSWR9KTtcblx0XHRcdHRoaXMuYnVja2V0LmZpbGUodGhpcy5nZXRQYXRoKGZpbGUpKS5kZWxldGUoZnVuY3Rpb24oZXJyLCBkYXRhKSB7XG5cdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjayhlcnIsIGRhdGEpO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybnMgdGhlIGZpbGUgcmVhZCBzdHJlYW1cblx0XHQgKiBAcGFyYW0gZmlsZUlkXG5cdFx0ICogQHBhcmFtIGZpbGVcblx0XHQgKiBAcGFyYW0gb3B0aW9uc1xuXHRcdCAqIEByZXR1cm4geyp9XG5cdFx0ICovXG5cdFx0dGhpcy5nZXRSZWFkU3RyZWFtID0gZnVuY3Rpb24oZmlsZUlkLCBmaWxlLCBvcHRpb25zID0ge30pIHtcblx0XHRcdGNvbnN0IGNvbmZpZyA9IHt9O1xuXG5cdFx0XHRpZiAob3B0aW9ucy5zdGFydCAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbmZpZy5zdGFydCA9IG9wdGlvbnMuc3RhcnQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvcHRpb25zLmVuZCAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbmZpZy5lbmQgPSBvcHRpb25zLmVuZDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuYnVja2V0LmZpbGUodGhpcy5nZXRQYXRoKGZpbGUpKS5jcmVhdGVSZWFkU3RyZWFtKGNvbmZpZyk7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybnMgdGhlIGZpbGUgd3JpdGUgc3RyZWFtXG5cdFx0ICogQHBhcmFtIGZpbGVJZFxuXHRcdCAqIEBwYXJhbSBmaWxlXG5cdFx0ICogQHBhcmFtIG9wdGlvbnNcblx0XHQgKiBAcmV0dXJuIHsqfVxuXHRcdCAqL1xuXHRcdHRoaXMuZ2V0V3JpdGVTdHJlYW0gPSBmdW5jdGlvbihmaWxlSWQsIGZpbGUvKiwgb3B0aW9ucyovKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5idWNrZXQuZmlsZSh0aGlzLmdldFBhdGgoZmlsZSkpLmNyZWF0ZVdyaXRlU3RyZWFtKHtcblx0XHRcdFx0Z3ppcDogZmFsc2UsXG5cdFx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdFx0Y29udGVudFR5cGU6IGZpbGUudHlwZSxcblx0XHRcdFx0XHRjb250ZW50RGlzcG9zaXRpb246IGBpbmxpbmU7IGZpbGVuYW1lPSR7IGZpbGUubmFtZSB9YFxuXHRcdFx0XHRcdC8vIG1ldGFkYXRhOiB7XG5cdFx0XHRcdFx0Ly8gXHRjdXN0b206ICdtZXRhZGF0YSdcblx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH07XG5cdH1cbn1cblxuLy8gQWRkIHN0b3JlIHRvIFVGUyBuYW1lc3BhY2VcblVwbG9hZEZTLnN0b3JlLkdvb2dsZVN0b3JhZ2UgPSBHb29nbGVTdG9yYWdlU3RvcmU7XG4iXX0=
