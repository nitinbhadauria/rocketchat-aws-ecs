(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var check = Package.check.check;
var Match = Package.check.Match;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:importer":{"server":{"classes":{"ImporterBase.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/classes/ImporterBase.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	Base: () => Base
});
let Progress;
module.watch(require("./ImporterProgress"), {
	Progress(v) {
		Progress = v;
	}

}, 0);
let ProgressStep;
module.watch(require("../../lib/ImporterProgressStep"), {
	ProgressStep(v) {
		ProgressStep = v;
	}

}, 1);
let Selection;
module.watch(require("./ImporterSelection"), {
	Selection(v) {
		Selection = v;
	}

}, 2);
let Imports;
module.watch(require("../models/Imports"), {
	Imports(v) {
		Imports = v;
	}

}, 3);
let ImporterInfo;
module.watch(require("../../lib/ImporterInfo"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 4);
let RawImports;
module.watch(require("../models/RawImports"), {
	RawImports(v) {
		RawImports = v;
	}

}, 5);
let ImporterWebsocket;
module.watch(require("./ImporterWebsocket"), {
	ImporterWebsocket(v) {
		ImporterWebsocket = v;
	}

}, 6);
let http;
module.watch(require("http"), {
	default(v) {
		http = v;
	}

}, 7);
let https;
module.watch(require("https"), {
	default(v) {
		https = v;
	}

}, 8);
let AdmZip;
module.watch(require("adm-zip"), {
	default(v) {
		AdmZip = v;
	}

}, 9);
let getFileType;
module.watch(require("file-type"), {
	default(v) {
		getFileType = v;
	}

}, 10);

class Base {
	/**
  * The max BSON object size we can store in MongoDB is 16777216 bytes
  * but for some reason the mongo instanace which comes with Meteor
  * errors out for anything close to that size. So, we are rounding it
  * down to 8000000 bytes.
  *
  * @param {any} item The item to calculate the BSON size of.
  * @returns {number} The size of the item passed in.
  * @static
  */static getBSONSize(item) {
		const {
			BSON
		} = require('bson').native();

		const bson = new BSON();
		return bson.calculateObjectSize(item);
	} /**
    * The max BSON object size we can store in MongoDB is 16777216 bytes
    * but for some reason the mongo instanace which comes with Meteor
    * errors out for anything close to that size. So, we are rounding it
    * down to 8000000 bytes.
    *
    * @returns {number} 8000000 bytes.
    */

	static getMaxBSONSize() {
		return 8000000;
	} /**
    * Splits the passed in array to at least one array which has a size that
    * is safe to store in the database.
    *
    * @param {any[]} theArray The array to split out
    * @returns {any[][]} The safe sized arrays
    * @static
    */

	static getBSONSafeArraysFromAnArray(theArray) {
		const BSONSize = Base.getBSONSize(theArray);
		const maxSize = Math.floor(theArray.length / Math.ceil(BSONSize / Base.getMaxBSONSize()));
		const safeArrays = [];
		let i = 0;

		while (i < theArray.length) {
			safeArrays.push(theArray.slice(i, i += maxSize));
		}

		return safeArrays;
	} /**
    * Constructs a new importer, adding an empty collection, AdmZip property, and empty users & channels
    *
    * @param {string} name The importer's name.
    * @param {string} description The i18n string which describes the importer
    * @param {string} mimeType The expected file type.
    */

	constructor(info) {
		if (!(info instanceof ImporterInfo)) {
			throw new Error('Information passed in must be a valid ImporterInfo instance.');
		}

		this.http = http;
		this.https = https;
		this.AdmZip = AdmZip;
		this.getFileType = getFileType;
		this.prepare = this.prepare.bind(this);
		this.startImport = this.startImport.bind(this);
		this.getSelection = this.getSelection.bind(this);
		this.getProgress = this.getProgress.bind(this);
		this.updateProgress = this.updateProgress.bind(this);
		this.addCountToTotal = this.addCountToTotal.bind(this);
		this.addCountCompleted = this.addCountCompleted.bind(this);
		this.updateRecord = this.updateRecord.bind(this);
		this.uploadFile = this.uploadFile.bind(this);
		this.info = info;
		this.logger = new Logger(`${this.info.name} Importer`, {});
		this.progress = new Progress(this.info.key, this.info.name);
		this.collection = RawImports;
		const importId = Imports.insert({
			'type': this.info.name,
			'ts': Date.now(),
			'status': this.progress.step,
			'valid': true,
			'user': Meteor.user()._id
		});
		this.importRecord = Imports.findOne(importId);
		this.users = {};
		this.channels = {};
		this.messages = {};
		this.oldSettings = {};
		this.logger.debug(`Constructed a new ${info.name} Importer.`);
	} /**
    * Takes the uploaded file and extracts the users, channels, and messages from it.
    *
    * @param {string} dataURI Base64 string of the uploaded file
    * @param {string} sentContentType The sent file type.
    * @param {string} fileName The name of the uploaded file.
    * @param {boolean} skipTypeCheck Optional property that says to not check the type provided.
    * @returns {Progress} The progress record of the import.
    */

	prepare(dataURI, sentContentType, fileName, skipTypeCheck) {
		if (!skipTypeCheck) {
			const fileType = this.getFileType(new Buffer(dataURI.split(',')[1], 'base64'));
			this.logger.debug('Uploaded file information is:', fileType);
			this.logger.debug('Expected file type is:', this.info.mimeType);

			if (!fileType || fileType.mime !== this.info.mimeType) {
				this.logger.warn(`Invalid file uploaded for the ${this.info.name} importer.`);
				this.updateProgress(ProgressStep.ERROR);
				throw new Meteor.Error('error-invalid-file-uploaded', `Invalid file uploaded to import ${this.info.name} data from.`, {
					step: 'prepare'
				});
			}
		}

		this.updateProgress(ProgressStep.PREPARING_STARTED);
		return this.updateRecord({
			'file': fileName
		});
	} /**
    * Starts the import process. The implementing method should defer
    * as soon as the selection is set, so the user who started the process
    * doesn't end up with a "locked" UI while Meteor waits for a response.
    * The returned object should be the progress.
    *
    * @param {Selection} importSelection The selection data.
    * @returns {Progress} The progress record of the import.
    */

	startImport(importSelection) {
		if (!(importSelection instanceof Selection)) {
			throw new Error(`Invalid Selection data provided to the ${this.info.name} importer.`);
		} else if (importSelection.users === undefined) {
			throw new Error(`Users in the selected data wasn't found, it must but at least an empty array for the ${this.info.name} importer.`);
		} else if (importSelection.channels === undefined) {
			throw new Error(`Channels in the selected data wasn't found, it must but at least an empty array for the ${this.info.name} importer.`);
		}

		return this.updateProgress(ProgressStep.IMPORTING_STARTED);
	} /**
    * Gets the Selection object for the import.
    *
    * @returns {Selection} The users and channels selection
    */

	getSelection() {
		throw new Error(`Invalid 'getSelection' called on ${this.info.name}, it must be overridden and super can not be called.`);
	} /**
    * Gets the progress of this import.
    *
    * @returns {Progress} The progress record of the import.
    */

	getProgress() {
		return this.progress;
	} /**
    * Updates the progress step of this importer.
    * It also changes some internal settings at various stages of the import.
    * This way the importer can adjust user/room information at will.
    *
    * @param {ProgressStep} step The progress step which this import is currently at.
    * @returns {Progress} The progress record of the import.
    */

	updateProgress(step) {
		this.progress.step = step;

		switch (step) {
			case ProgressStep.IMPORTING_STARTED:
				this.oldSettings.Accounts_AllowedDomainsList = RocketChat.models.Settings.findOneById('Accounts_AllowedDomainsList').value;
				RocketChat.models.Settings.updateValueById('Accounts_AllowedDomainsList', '');
				this.oldSettings.Accounts_AllowUsernameChange = RocketChat.models.Settings.findOneById('Accounts_AllowUsernameChange').value;
				RocketChat.models.Settings.updateValueById('Accounts_AllowUsernameChange', true);
				this.oldSettings.FileUpload_MaxFileSize = RocketChat.models.Settings.findOneById('FileUpload_MaxFileSize').value;
				RocketChat.models.Settings.updateValueById('FileUpload_MaxFileSize', 0);
				break;

			case ProgressStep.DONE:
			case ProgressStep.ERROR:
				RocketChat.models.Settings.updateValueById('Accounts_AllowedDomainsList', this.oldSettings.Accounts_AllowedDomainsList);
				RocketChat.models.Settings.updateValueById('Accounts_AllowUsernameChange', this.oldSettings.Accounts_AllowUsernameChange);
				RocketChat.models.Settings.updateValueById('FileUpload_MaxFileSize', this.oldSettings.FileUpload_MaxFileSize);
				break;
		}

		this.logger.debug(`${this.info.name} is now at ${step}.`);
		this.updateRecord({
			'status': this.progress.step
		});
		ImporterWebsocket.progressUpdated(this.progress);
		return this.progress;
	} /**
    * Adds the passed in value to the total amount of items needed to complete.
    *
    * @param {number} count The amount to add to the total count of items.
    * @returns {Progress} The progress record of the import.
    */

	addCountToTotal(count) {
		this.progress.count.total = this.progress.count.total + count;
		this.updateRecord({
			'count.total': this.progress.count.total
		});
		return this.progress;
	} /**
    * Adds the passed in value to the total amount of items completed.
    *
    * @param {number} count The amount to add to the total count of finished items.
    * @returns {Progress} The progress record of the import.
    */

	addCountCompleted(count) {
		this.progress.count.completed = this.progress.count.completed + count; //Only update the database every 500 records
		//Or the completed is greater than or equal to the total amount

		if (this.progress.count.completed % 500 === 0 || this.progress.count.completed >= this.progress.count.total) {
			this.updateRecord({
				'count.completed': this.progress.count.completed
			});
		}

		ImporterWebsocket.progressUpdated(this.progress);
		return this.progress;
	} /**
    * Updates the import record with the given fields being `set`.
    *
    * @param {any} fields The fields to set, it should be an object with key/values.
    * @returns {Imports} The import record.
    */

	updateRecord(fields) {
		Imports.update({
			_id: this.importRecord._id
		}, {
			$set: fields
		});
		this.importRecord = Imports.findOne(this.importRecord._id);
		return this.importRecord;
	} /**
    * Uploads the file to the storage.
    *
    * @param {any} details An object with details about the upload: `name`, `size`, `type`, and `rid`.
    * @param {string} fileUrl Url of the file to download/import.
    * @param {any} user The Rocket.Chat user.
    * @param {any} room The Rocket.Chat Room.
    * @param {Date} timeStamp The timestamp the file was uploaded
    */

	uploadFile(details, fileUrl, user, room, timeStamp) {
		this.logger.debug(`Uploading the file ${details.name} from ${fileUrl}.`);
		const requestModule = /https/i.test(fileUrl) ? this.https : this.http;
		const fileStore = FileUpload.getStore('Uploads');
		return requestModule.get(fileUrl, Meteor.bindEnvironment(function (res) {
			const rawData = [];
			res.on('data', chunk => rawData.push(chunk));
			res.on('end', Meteor.bindEnvironment(() => {
				fileStore.insert(details, Buffer.concat(rawData), function (err, file) {
					if (err) {
						throw new Error(err);
					} else {
						const url = file.url.replace(Meteor.absoluteUrl(), '/');
						const attachment = {
							title: file.name,
							title_link: url
						};

						if (/^image\/.+/.test(file.type)) {
							attachment.image_url = url;
							attachment.image_type = file.type;
							attachment.image_size = file.size;
							attachment.image_dimensions = file.identify != null ? file.identify.size : undefined;
						}

						if (/^audio\/.+/.test(file.type)) {
							attachment.audio_url = url;
							attachment.audio_type = file.type;
							attachment.audio_size = file.size;
						}

						if (/^video\/.+/.test(file.type)) {
							attachment.video_url = url;
							attachment.video_type = file.type;
							attachment.video_size = file.size;
						}

						const msg = {
							rid: details.rid,
							ts: timeStamp,
							msg: '',
							file: {
								_id: file._id
							},
							groupable: false,
							attachments: [attachment]
						};

						if (details.message_id != null && typeof details.message_id === 'string') {
							msg['_id'] = details.message_id;
						}

						return RocketChat.sendMessage(user, msg, room, true);
					}
				});
			}));
		}));
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ImporterProgress.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/classes/ImporterProgress.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	Progress: () => Progress
});
let ProgressStep;
module.watch(require("../../lib/ImporterProgressStep"), {
	ProgressStep(v) {
		ProgressStep = v;
	}

}, 0);

class Progress {
	/**
  * Creates a new progress container for the importer.
  *
  * @param {string} key The unique key of the importer.
  * @param {string} name The name of the importer.
  */constructor(key, name) {
		this.key = key;
		this.name = name;
		this.step = ProgressStep.NEW;
		this.count = {
			completed: 0,
			total: 0
		};
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ImporterSelection.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/classes/ImporterSelection.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	Selection: () => Selection
});

class Selection {
	/**
  * Constructs a new importer selection object.
  *
  * @param {string} name the name of the importer
  * @param {SelectionUser[]} users the users which can be selected
  * @param {SelectionChannel[]} channels the channels which can be selected
  * @param {number} message_count the number of messages
  */constructor(name, users, channels, message_count) {
		this.name = name;
		this.users = users;
		this.channels = channels;
		this.message_count = message_count;
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ImporterSelectionChannel.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/classes/ImporterSelectionChannel.js                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	SelectionChannel: () => SelectionChannel
});

class SelectionChannel {
	/**
  * Constructs a new selection channel.
  *
  * @param {string} channel_id the unique identifier of the channel
  * @param {string} name the name of the channel
  * @param {boolean} is_archived whether the channel was archived or not
  * @param {boolean} do_import whether we will be importing the channel or not
  * @param {boolean} is_private whether the channel is private or public
  */constructor(channel_id, name, is_archived, do_import, is_private) {
		this.channel_id = channel_id;
		this.name = name;
		this.is_archived = is_archived;
		this.do_import = do_import;
		this.is_private = is_private;
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ImporterSelectionUser.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/classes/ImporterSelectionUser.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	SelectionUser: () => SelectionUser
});

class SelectionUser {
	/**
  * Constructs a new selection user.
  *
  * @param {string} user_id the unique user identifier
  * @param {string} username the user's username
  * @param {string} email the user's email
  * @param {boolean} is_deleted whether the user was deleted or not
  * @param {boolean} is_bot whether the user is a bot or not
  * @param {boolean} do_import whether we are going to import this user or not
  */constructor(user_id, username, email, is_deleted, is_bot, do_import) {
		this.user_id = user_id;
		this.username = username;
		this.email = email;
		this.is_deleted = is_deleted;
		this.is_bot = is_bot;
		this.do_import = do_import;
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ImporterWebsocket.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/classes/ImporterWebsocket.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	ImporterWebsocket: () => ImporterWebsocket
});

class ImporterWebsocketDef {
	constructor() {
		this.streamer = new Meteor.Streamer('importers', {
			retransmit: false
		});
		this.streamer.allowRead('all');
		this.streamer.allowEmit('all');
		this.streamer.allowWrite('none');
	} /**
    * Called when the progress is updated.
    *
    * @param {Progress} progress The progress of the import.
    */

	progressUpdated(progress) {
		this.streamer.emit('progress', progress);
	}

}

const ImporterWebsocket = new ImporterWebsocketDef();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"Imports.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/models/Imports.js                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	Imports: () => Imports
});

class ImportsModel extends RocketChat.models._Base {
	constructor() {
		super('import');
	}

}

const Imports = new ImportsModel();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"RawImports.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/models/RawImports.js                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	RawImports: () => RawImports
});

class RawImportsModel extends RocketChat.models._Base {
	constructor() {
		super('raw_imports');
	}

}

const RawImports = new RawImportsModel();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"getImportProgress.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/methods/getImportProgress.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
	Importers(v) {
		Importers = v;
	}

}, 0);
Meteor.methods({
	getImportProgress(key) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'getImportProgress'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'run-import')) {
			throw new Meteor.Error('error-action-not-allowed', 'Importing is not allowed', {
				method: 'setupImporter'
			});
		}

		const importer = Importers.get(key);

		if (!importer) {
			throw new Meteor.Error('error-importer-not-defined', `The importer (${key}) has no import class defined.`, {
				method: 'getImportProgress'
			});
		}

		if (!importer.instance) {
			return undefined;
		}

		return importer.instance.getProgress();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"getSelectionData.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/methods/getSelectionData.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers, ProgressStep;
module.watch(require("meteor/rocketchat:importer"), {
	Importers(v) {
		Importers = v;
	},

	ProgressStep(v) {
		ProgressStep = v;
	}

}, 0);
Meteor.methods({
	getSelectionData(key) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'getSelectionData'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'run-import')) {
			throw new Meteor.Error('error-action-not-allowed', 'Importing is not allowed', {
				method: 'setupImporter'
			});
		}

		const importer = Importers.get(key);

		if (!importer || !importer.instance) {
			throw new Meteor.Error('error-importer-not-defined', `The importer (${key}) has no import class defined.`, {
				method: 'getSelectionData'
			});
		}

		const progress = importer.instance.getProgress();

		switch (progress.step) {
			case ProgressStep.USER_SELECTION:
				return importer.instance.getSelection();

			default:
				return undefined;
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"prepareImport.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/methods/prepareImport.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
	Importers(v) {
		Importers = v;
	}

}, 0);
Meteor.methods({
	prepareImport(key, dataURI, contentType, fileName) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'prepareImport'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'run-import')) {
			throw new Meteor.Error('error-action-not-allowed', 'Importing is not allowed', {
				method: 'setupImporter'
			});
		}

		check(key, String);
		check(dataURI, String);
		check(fileName, String);
		const importer = Importers.get(key);

		if (!importer) {
			throw new Meteor.Error('error-importer-not-defined', `The importer (${key}) has no import class defined.`, {
				method: 'prepareImport'
			});
		}

		const results = importer.instance.prepare(dataURI, contentType, fileName);

		if (results instanceof Promise) {
			return results.catch(e => {
				throw new Meteor.Error(e);
			});
		} else {
			return results;
		}
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"restartImport.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/methods/restartImport.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers, ProgressStep;
module.watch(require("meteor/rocketchat:importer"), {
	Importers(v) {
		Importers = v;
	},

	ProgressStep(v) {
		ProgressStep = v;
	}

}, 0);
Meteor.methods({
	restartImport(key) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'restartImport'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'run-import')) {
			throw new Meteor.Error('error-action-not-allowed', 'Importing is not allowed', {
				method: 'setupImporter'
			});
		}

		const importer = Importers.get(key);

		if (!importer) {
			throw new Meteor.Error('error-importer-not-defined', `The importer (${key}) has no import class defined.`, {
				method: 'restartImport'
			});
		}

		if (importer.instance) {
			importer.instance.updateProgress(ProgressStep.CANCELLED);
			importer.instance.updateRecord({
				valid: false
			});
			importer.instance = undefined;
		}

		importer.instance = new importer.importer(importer); // eslint-disable-line new-cap

		return importer.instance.getProgress();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"setupImporter.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/methods/setupImporter.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers;
module.watch(require("meteor/rocketchat:importer"), {
	Importers(v) {
		Importers = v;
	}

}, 0);
Meteor.methods({
	setupImporter(key) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'setupImporter'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'run-import')) {
			throw new Meteor.Error('error-action-not-allowed', 'Importing is not allowed', {
				method: 'setupImporter'
			});
		}

		const importer = Importers.get(key);

		if (!importer) {
			console.warn(`Tried to setup ${name} as an importer.`);
			throw new Meteor.Error('error-importer-not-defined', 'The importer was not defined correctly, it is missing the Import class.', {
				method: 'setupImporter'
			});
		}

		if (importer.instance) {
			return importer.instance.getProgress();
		}

		importer.instance = new importer.importer(importer); //eslint-disable-line new-cap

		return importer.instance.getProgress();
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"startImport.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/methods/startImport.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Importers, Selection, SelectionChannel, SelectionUser;
module.watch(require("meteor/rocketchat:importer"), {
	Importers(v) {
		Importers = v;
	},

	Selection(v) {
		Selection = v;
	},

	SelectionChannel(v) {
		SelectionChannel = v;
	},

	SelectionUser(v) {
		SelectionUser = v;
	}

}, 0);
Meteor.methods({
	startImport(key, input) {
		// Takes name and object with users / channels selected to import
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'startImport'
			});
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'run-import')) {
			throw new Meteor.Error('error-action-not-allowed', 'Importing is not allowed', {
				method: 'startImport'
			});
		}

		if (!key) {
			throw new Meteor.Error('error-invalid-importer', `No defined importer by: "${key}"`, {
				method: 'startImport'
			});
		}

		const importer = Importers.get(key);

		if (!importer || !importer.instance) {
			throw new Meteor.Error('error-importer-not-defined', `The importer (${key}) has no import class defined.`, {
				method: 'startImport'
			});
		}

		const usersSelection = input.users.map(user => new SelectionUser(user.user_id, user.username, user.email, user.is_deleted, user.is_bot, user.do_import));
		const channelsSelection = input.channels.map(channel => new SelectionChannel(channel.channel_id, channel.name, channel.is_archived, channel.do_import));
		const selection = new Selection(importer.name, usersSelection, channelsSelection);
		return importer.instance.startImport(selection);
	}

});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"startup":{"setImportsToInvalid.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/startup/setImportsToInvalid.js                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Imports;
module.watch(require("../models/Imports"), {
	Imports(v) {
		Imports = v;
	}

}, 0);
let RawImports;
module.watch(require("../models/RawImports"), {
	RawImports(v) {
		RawImports = v;
	}

}, 1);
Meteor.startup(function () {
	// Make sure all imports are marked as invalid, data clean up since you can't
	// restart an import at the moment.
	Imports.update({
		valid: {
			$ne: false
		}
	}, {
		$set: {
			valid: false
		}
	}, {
		multi: true
	}); // Clean up all the raw import data, since you can't restart an import at the moment

	try {
		RawImports.model.rawCollection().drop();
	} catch (e) {
		console.log('errror', e); //TODO: Remove
		// ignored
	}
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"index.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/server/index.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	Base: () => Base,
	Imports: () => Imports,
	Importers: () => Importers,
	ImporterInfo: () => ImporterInfo,
	ImporterWebsocket: () => ImporterWebsocket,
	Progress: () => Progress,
	ProgressStep: () => ProgressStep,
	RawImports: () => RawImports,
	Selection: () => Selection,
	SelectionChannel: () => SelectionChannel,
	SelectionUser: () => SelectionUser
});
let Base;
module.watch(require("./classes/ImporterBase"), {
	Base(v) {
		Base = v;
	}

}, 0);
let Imports;
module.watch(require("./models/Imports"), {
	Imports(v) {
		Imports = v;
	}

}, 1);
let Importers;
module.watch(require("../lib/Importers"), {
	Importers(v) {
		Importers = v;
	}

}, 2);
let ImporterInfo;
module.watch(require("../lib/ImporterInfo"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 3);
let ImporterWebsocket;
module.watch(require("./classes/ImporterWebsocket"), {
	ImporterWebsocket(v) {
		ImporterWebsocket = v;
	}

}, 4);
let Progress;
module.watch(require("./classes/ImporterProgress"), {
	Progress(v) {
		Progress = v;
	}

}, 5);
let ProgressStep;
module.watch(require("../lib/ImporterProgressStep"), {
	ProgressStep(v) {
		ProgressStep = v;
	}

}, 6);
let RawImports;
module.watch(require("./models/RawImports"), {
	RawImports(v) {
		RawImports = v;
	}

}, 7);
let Selection;
module.watch(require("./classes/ImporterSelection"), {
	Selection(v) {
		Selection = v;
	}

}, 8);
let SelectionChannel;
module.watch(require("./classes/ImporterSelectionChannel"), {
	SelectionChannel(v) {
		SelectionChannel = v;
	}

}, 9);
let SelectionUser;
module.watch(require("./classes/ImporterSelectionUser"), {
	SelectionUser(v) {
		SelectionUser = v;
	}

}, 10);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lib":{"ImporterInfo.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/lib/ImporterInfo.js                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	ImporterInfo: () => ImporterInfo
});

class ImporterInfo {
	/**
  * Creates a new class which contains information about the importer.
  *
  * @param {string} key The unique key of this importer.
  * @param {string} name The i18n name.
  * @param {string} mimeType The type of file it expects.
  * @param {{ href: string, text: string }[]} warnings An array of warning objects. `{ href, text }`
  */constructor(key, name = '', mimeType = '', warnings = []) {
		this.key = key;
		this.name = name;
		this.mimeType = mimeType;
		this.warnings = warnings;
		this.importer = undefined;
		this.instance = undefined;
	}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ImporterProgressStep.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/lib/ImporterProgressStep.js                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	ProgressStep: () => ProgressStep
});
const ProgressStep = Object.freeze({
	NEW: 'importer_new',
	PREPARING_STARTED: 'importer_preparing_started',
	PREPARING_USERS: 'importer_preparing_users',
	PREPARING_CHANNELS: 'importer_preparing_channels',
	PREPARING_MESSAGES: 'importer_preparing_messages',
	USER_SELECTION: 'importer_user_selection',
	IMPORTING_STARTED: 'importer_importing_started',
	IMPORTING_USERS: 'importer_importing_users',
	IMPORTING_CHANNELS: 'importer_importing_channels',
	IMPORTING_MESSAGES: 'importer_importing_messages',
	FINISHING: 'importer_finishing',
	DONE: 'importer_done',
	ERROR: 'importer_import_failed',
	CANCELLED: 'importer_import_cancelled'
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Importers.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_importer/lib/Importers.js                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	Importers: () => Importers
});
let ImporterInfo;
module.watch(require("./ImporterInfo"), {
	ImporterInfo(v) {
		ImporterInfo = v;
	}

}, 0);

/** Container class which holds all of the importer details. */class ImportersContainer {
	constructor() {
		this.importers = new Map();
	} /**
    * Adds an importer to the import collection. Adding it more than once will
    * overwrite the previous one.
    *
    * @param {ImporterInfo} info The information related to the importer.
    * @param {*} importer The class for the importer, will be undefined on the client.
    */

	add(info, importer) {
		if (!(info instanceof ImporterInfo)) {
			throw new Error('The importer must be a valid ImporterInfo instance.');
		}

		info.importer = importer;
		this.importers.set(info.key, info);
		return this.importers.get(info.key);
	} /**
    * Gets the importer information that is stored.
    *
    * @param {string} key The key of the importer.
    */

	get(key) {
		return this.importers.get(key);
	} /**
    * Gets all of the importers in array format.
    *
    * @returns {ImporterInfo[]} The array of importer information.
    */

	getAll() {
		return Array.from(this.importers.values());
	}

}

const Importers = new ImportersContainer();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"adm-zip":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// ../../.meteor/local/isopacks/rocketchat_importer/npm/node_modules/adm-zip/package.json                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
exports.name = "adm-zip";
exports.version = "0.4.7";
exports.main = "adm-zip.js";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"adm-zip.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/rocketchat_importer/node_modules/adm-zip/adm-zip.js                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var fs = require("fs"),
    pth = require("path");

fs.existsSync = fs.existsSync || pth.existsSync;

var ZipEntry = require("./zipEntry"),
    ZipFile =  require("./zipFile"),
    Utils = require("./util");

module.exports = function(/*String*/input) {
    var _zip = undefined,
        _filename = "";

    if (input && typeof input === "string") { // load zip file
        if (fs.existsSync(input)) {
            _filename = input;
            _zip = new ZipFile(input, Utils.Constants.FILE);
        } else {
           throw Utils.Errors.INVALID_FILENAME;
        }
    } else if(input && Buffer.isBuffer(input)) { // load buffer
        _zip = new ZipFile(input, Utils.Constants.BUFFER);
    } else { // create new zip file
        _zip = new ZipFile(null, Utils.Constants.NONE);
    }

    function getEntry(/*Object*/entry) {
        if (entry && _zip) {
            var item;
            // If entry was given as a file name
            if (typeof entry === "string")
                item = _zip.getEntry(entry);
            // if entry was given as a ZipEntry object
            if (typeof entry === "object" && entry.entryName != undefined && entry.header != undefined)
                item =  _zip.getEntry(entry.entryName);

            if (item) {
                return item;
            }
        }
        return null;
    }

    return {
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param entry ZipEntry object or String with the full path of the entry
         *
         * @return Buffer or Null in case of error
         */
        readFile : function(/*Object*/entry) {
            var item = getEntry(entry);
            return item && item.getData() || null;
        },

        /**
         * Asynchronous readFile
         * @param entry ZipEntry object or String with the full path of the entry
         * @param callback
         *
         * @return Buffer or Null in case of error
         */
        readFileAsync : function(/*Object*/entry, /*Function*/callback) {
            var item = getEntry(entry);
            if (item) {
                item.getDataAsync(callback);
            } else {
                callback(null,"getEntry failed for:" + entry)
            }
        },

        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param entry ZipEntry object or String with the full path of the entry
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText : function(/*Object*/entry, /*String - Optional*/encoding) {
            var item = getEntry(entry);
            if (item) {
                var data = item.getData();
                if (data && data.length) {
                    return data.toString(encoding || "utf8");
                }
            }
            return "";
        },

        /**
         * Asynchronous readAsText
         * @param entry ZipEntry object or String with the full path of the entry
         * @param callback
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsTextAsync : function(/*Object*/entry, /*Function*/callback, /*String - Optional*/encoding) {
            var item = getEntry(entry);
            if (item) {
                item.getDataAsync(function(data) {
                    if (data && data.length) {
                        callback(data.toString(encoding || "utf8"));
                    } else {
                        callback("");
                    }
                })
            } else {
                callback("");
            }
        },

        /**
         * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
         *
         * @param entry
         */
        deleteFile : function(/*Object*/entry) { // @TODO: test deleteFile
            var item = getEntry(entry);
            if (item) {
                _zip.deleteEntry(item.entryName);
            }
        },

        /**
         * Adds a comment to the zip. The zip must be rewritten after adding the comment.
         *
         * @param comment
         */
        addZipComment : function(/*String*/comment) { // @TODO: test addZipComment
            _zip.comment = comment;
        },

        /**
         * Returns the zip comment
         *
         * @return String
         */
        getZipComment : function() {
            return _zip.comment || '';
        },

        /**
         * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
         * The comment cannot exceed 65535 characters in length
         *
         * @param entry
         * @param comment
         */
        addZipEntryComment : function(/*Object*/entry,/*String*/comment) {
            var item = getEntry(entry);
            if (item) {
                item.comment = comment;
            }
        },

        /**
         * Returns the comment of the specified entry
         *
         * @param entry
         * @return String
         */
        getZipEntryComment : function(/*Object*/entry) {
            var item = getEntry(entry);
            if (item) {
                return item.comment || '';
            }
            return ''
        },

        /**
         * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
         *
         * @param entry
         * @param content
         */
        updateFile : function(/*Object*/entry, /*Buffer*/content) {
            var item = getEntry(entry);
            if (item) {
                item.setData(content);
            }
        },

        /**
         * Adds a file from the disk to the archive
         *
         * @param localPath
         */
        addLocalFile : function(/*String*/localPath, /*String*/zipPath, /*String*/zipName) {
             if (fs.existsSync(localPath)) {
                if(zipPath){
                    zipPath=zipPath.split("\\").join("/");
                    if(zipPath.charAt(zipPath.length - 1) != "/"){
                        zipPath += "/";
                    }
                }else{
                    zipPath="";
                }
                 var p = localPath.split("\\").join("/").split("/").pop();
                
                 if(zipName){
                    this.addFile(zipPath+zipName, fs.readFileSync(localPath), "", 0)
                 }else{
                    this.addFile(zipPath+p, fs.readFileSync(localPath), "", 0)
                 }
             } else {
                 throw Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath);
             }
        },

        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param localPath
         * @param zipPath optional path inside zip
         * @param filter optional RegExp or Function if files match will
         *               be included.
         */
        addLocalFolder : function(/*String*/localPath, /*String*/zipPath, /*RegExp|Function*/filter) {
            if (filter === undefined) {
              filter = function() { return true; };
            } else if (filter instanceof RegExp) {
              filter = function(filter) {
                return function(filename) {
                  return filter.test(filename);
                }
              }(filter);
            }

            if(zipPath){
                zipPath=zipPath.split("\\").join("/");
                if(zipPath.charAt(zipPath.length - 1) != "/"){
                    zipPath += "/";
                }
            }else{
                zipPath="";
            }
			localPath = localPath.split("\\").join("/"); //windows fix
            localPath = pth.normalize(localPath);
            if (localPath.charAt(localPath.length - 1) != "/")
                localPath += "/";

            if (fs.existsSync(localPath)) {

                var items = Utils.findFiles(localPath),
                    self = this;

                if (items.length) {
                    items.forEach(function(path) {
						var p = path.split("\\").join("/").replace( new RegExp(localPath, 'i'), ""); //windows fix
                        if (filter(p)) {
                            if (p.charAt(p.length - 1) !== "/") {
                                self.addFile(zipPath+p, fs.readFileSync(path), "", 0)
                            } else {
                                self.addFile(zipPath+p, new Buffer(0), "", 0)
                            }
                        }
                    });
                }
            } else {
                throw Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath);
            }
        },

        /**
         * Allows you to create a entry (file or directory) in the zip file.
         * If you want to create a directory the entryName must end in / and a null buffer should be provided.
         * Comment and attributes are optional
         *
         * @param entryName
         * @param content
         * @param comment
         * @param attr
         */
        addFile : function(/*String*/entryName, /*Buffer*/content, /*String*/comment, /*Number*/attr) {
            var entry = new ZipEntry();
            entry.entryName = entryName;
            entry.comment = comment || "";
            entry.attr = attr || 438; //0666;
            if (entry.isDirectory && content.length) {
               // throw Utils.Errors.DIRECTORY_CONTENT_ERROR;
            }
            entry.setData(content);
            _zip.setEntry(entry);
        },

        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @return Array
         */
        getEntries : function() {
            if (_zip) {
               return _zip.entries;
            } else {
                return [];
            }
        },

        /**
         * Returns a ZipEntry object representing the file or folder specified by ``name``.
         *
         * @param name
         * @return ZipEntry
         */
        getEntry : function(/*String*/name) {
            return getEntry(name);
        },

        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param entry ZipEntry object or String with the full path of the entry
         * @param targetPath Target folder where to write the file
         * @param maintainEntryPath If maintainEntryPath is true and the entry is inside a folder, the entry folder
         *                          will be created in targetPath as well. Default is TRUE
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         *
         * @return Boolean
         */
        extractEntryTo : function(/*Object*/entry, /*String*/targetPath, /*Boolean*/maintainEntryPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            maintainEntryPath = typeof maintainEntryPath == "undefined" ? true : maintainEntryPath;

            var item = getEntry(entry);
            if (!item) {
                throw Utils.Errors.NO_ENTRY;
            }

            var target = pth.resolve(targetPath, maintainEntryPath ? item.entryName : pth.basename(item.entryName));

            if (item.isDirectory) {
                target = pth.resolve(target, "..");
                var children = _zip.getEntryChildren(item);
                children.forEach(function(child) {
                    if (child.isDirectory) return;
                    var content = child.getData();
                    if (!content) {
                        throw Utils.Errors.CANT_EXTRACT_FILE;
                    }
                    Utils.writeFileTo(pth.resolve(targetPath, maintainEntryPath ? child.entryName : child.entryName.substr(item.entryName.length)), content, overwrite);
                });
                return true;
            }

            var content = item.getData();
            if (!content) throw Utils.Errors.CANT_EXTRACT_FILE;

            if (fs.existsSync(target) && !overwrite) {
                throw Utils.Errors.CANT_OVERRIDE;
            }
            Utils.writeFileTo(target, content, overwrite);

            return true;
        },

        /**
         * Extracts the entire archive to the given location
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         */
        extractAllTo : function(/*String*/targetPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            if (!_zip) {
                throw Utils.Errors.NO_ZIP;
            }

            _zip.entries.forEach(function(entry) {
                if (entry.isDirectory) {
                    Utils.makeDir(pth.resolve(targetPath, entry.entryName.toString()));
                    return;
                }
                var content = entry.getData();
                if (!content) {
                    throw Utils.Errors.CANT_EXTRACT_FILE + "2";
                }
                Utils.writeFileTo(pth.resolve(targetPath, entry.entryName.toString()), content, overwrite);
            })
        },

        /**
         * Asynchronous extractAllTo
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param callback
         */
        extractAllToAsync : function(/*String*/targetPath, /*Boolean*/overwrite, /*Function*/callback) {
            overwrite = overwrite || false;
            if (!_zip) {
                callback(new Error(Utils.Errors.NO_ZIP));
                return;
            }

            var entries = _zip.entries;
            var i = entries.length; 
            entries.forEach(function(entry) {
                if(i <= 0) return; // Had an error already

                if (entry.isDirectory) {
                    Utils.makeDir(pth.resolve(targetPath, entry.entryName.toString()));
                    if(--i == 0)
                        callback(undefined);
                    return;
                }
                entry.getDataAsync(function(content) {
                    if(i <= 0) return;
                    if (!content) {
                        i = 0;
                        callback(new Error(Utils.Errors.CANT_EXTRACT_FILE + "2"));
                        return;
                    }
                    Utils.writeFileToAsync(pth.resolve(targetPath, entry.entryName.toString()), content, overwrite, function(succ) {
                        if(i <= 0) return;

                        if(!succ) {
                            i = 0;
                            callback(new Error('Unable to write'));
                            return;
                        }

                        if(--i == 0)
                            callback(undefined);
                    });
                    
                });
            })
        },

        /**
         * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
         *
         * @param targetFileName
         * @param callback
         */
        writeZip : function(/*String*/targetFileName, /*Function*/callback) {
            if (arguments.length == 1) {
                if (typeof targetFileName == "function") {
                    callback = targetFileName;
                    targetFileName = "";
                }
            }

            if (!targetFileName && _filename) {
                targetFileName = _filename;
            }
            if (!targetFileName) return;

            var zipData = _zip.compressToBuffer();
            if (zipData) {
                var ok = Utils.writeFileTo(targetFileName, zipData, true);
                if (typeof callback == 'function') callback(!ok? new Error("failed"): null, "");
            }
        },

        /**
         * Returns the content of the entire zip file as a Buffer object
         *
         * @return Buffer
         */
        toBuffer : function(/*Function*/onSuccess,/*Function*/onFail,/*Function*/onItemStart,/*Function*/onItemEnd) {
            this.valueOf = 2;
            if (typeof onSuccess == "function") {
                _zip.toAsyncBuffer(onSuccess,onFail,onItemStart,onItemEnd);
                return null;
            }
            return _zip.compressToBuffer()
        }
    }
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"bson":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// ../../.meteor/local/isopacks/rocketchat_importer/npm/node_modules/bson/package.json                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
exports.name = "bson";
exports.version = "0.5.5";
exports.main = "./lib/bson/index";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"bson":{"index.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/rocketchat_importer/node_modules/bson/lib/bson/index.js                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
try {
  exports.BSONPure = require('./bson');
  exports.BSONNative = require('./bson');
} catch(err) {
}

[ './binary'
  , './code'
  , './map'
  , './db_ref'
  , './double'
  , './int_32'
  , './max_key'
  , './min_key'
  , './objectid'
  , './regexp'
  , './symbol'
  , './decimal128'
  , './timestamp'
  , './long'].forEach(function (path) {
  	var module = require(path);
  	for (var i in module) {
  		exports[i] = module[i];
    }
});

// Exports all the classes for the PURE JS BSON Parser
exports.pure = function() {
  var classes = {};
  // Map all the classes
  [ './binary'
    , './code'
    , './map'
    , './db_ref'
    , './double'
    , './int_32'
    , './max_key'
    , './min_key'
    , './objectid'
    , './regexp'
    , './symbol'
    , './decimal128'
    , './timestamp'
    , './long'
    , './bson'].forEach(function (path) {
    	var module = require(path);
    	for (var i in module) {
    		classes[i] = module[i];
      }
  });
  // Return classes list
  return classes;
}

// Exports all the classes for the NATIVE JS BSON Parser
exports.native = function() {
  var classes = {};
  // Map all the classes
  [ './binary'
    , './code'
    , './map'
    , './db_ref'
    , './double'
    , './int_32'
    , './max_key'
    , './min_key'
    , './objectid'
    , './regexp'
    , './symbol'
    , './decimal128'
    , './timestamp'
    , './long'
  ].forEach(function (path) {
      var module = require(path);
      for (var i in module) {
        classes[i] = module[i];
      }
  });

  // Catch error and return no classes found
  try {
    classes['BSON'] = require('./bson');
  } catch(err) {
    return exports.pure();
  }

  // Return classes list
  return classes;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:importer/server/classes/ImporterBase.js");
require("./node_modules/meteor/rocketchat:importer/server/classes/ImporterProgress.js");
require("./node_modules/meteor/rocketchat:importer/server/classes/ImporterSelection.js");
require("./node_modules/meteor/rocketchat:importer/server/classes/ImporterSelectionChannel.js");
require("./node_modules/meteor/rocketchat:importer/server/classes/ImporterSelectionUser.js");
require("./node_modules/meteor/rocketchat:importer/server/classes/ImporterWebsocket.js");
require("./node_modules/meteor/rocketchat:importer/lib/ImporterInfo.js");
require("./node_modules/meteor/rocketchat:importer/lib/ImporterProgressStep.js");
require("./node_modules/meteor/rocketchat:importer/lib/Importers.js");
require("./node_modules/meteor/rocketchat:importer/server/models/Imports.js");
require("./node_modules/meteor/rocketchat:importer/server/models/RawImports.js");
require("./node_modules/meteor/rocketchat:importer/server/methods/getImportProgress.js");
require("./node_modules/meteor/rocketchat:importer/server/methods/getSelectionData.js");
require("./node_modules/meteor/rocketchat:importer/server/methods/prepareImport.js");
require("./node_modules/meteor/rocketchat:importer/server/methods/restartImport.js");
require("./node_modules/meteor/rocketchat:importer/server/methods/setupImporter.js");
require("./node_modules/meteor/rocketchat:importer/server/methods/startImport.js");
require("./node_modules/meteor/rocketchat:importer/server/startup/setImportsToInvalid.js");
var exports = require("./node_modules/meteor/rocketchat:importer/server/index.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:importer'] = exports;

})();

//# sourceURL=meteor://💻app/packages/rocketchat_importer.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvY2xhc3Nlcy9JbXBvcnRlckJhc2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXIvc2VydmVyL2NsYXNzZXMvSW1wb3J0ZXJQcm9ncmVzcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvY2xhc3Nlcy9JbXBvcnRlclNlbGVjdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvY2xhc3Nlcy9JbXBvcnRlclNlbGVjdGlvbkNoYW5uZWwuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXIvc2VydmVyL2NsYXNzZXMvSW1wb3J0ZXJTZWxlY3Rpb25Vc2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyL3NlcnZlci9jbGFzc2VzL0ltcG9ydGVyV2Vic29ja2V0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyL3NlcnZlci9tb2RlbHMvSW1wb3J0cy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvbW9kZWxzL1Jhd0ltcG9ydHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXIvc2VydmVyL21ldGhvZHMvZ2V0SW1wb3J0UHJvZ3Jlc3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXIvc2VydmVyL21ldGhvZHMvZ2V0U2VsZWN0aW9uRGF0YS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvbWV0aG9kcy9wcmVwYXJlSW1wb3J0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyL3NlcnZlci9tZXRob2RzL3Jlc3RhcnRJbXBvcnQuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6aW1wb3J0ZXIvc2VydmVyL21ldGhvZHMvc2V0dXBJbXBvcnRlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvbWV0aG9kcy9zdGFydEltcG9ydC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9zZXJ2ZXIvc3RhcnR1cC9zZXRJbXBvcnRzVG9JbnZhbGlkLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyL3NlcnZlci9pbmRleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9saWIvSW1wb3J0ZXJJbmZvLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmltcG9ydGVyL2xpYi9JbXBvcnRlclByb2dyZXNzU3RlcC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppbXBvcnRlci9saWIvSW1wb3J0ZXJzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkJhc2UiLCJQcm9ncmVzcyIsIndhdGNoIiwicmVxdWlyZSIsInYiLCJQcm9ncmVzc1N0ZXAiLCJTZWxlY3Rpb24iLCJJbXBvcnRzIiwiSW1wb3J0ZXJJbmZvIiwiUmF3SW1wb3J0cyIsIkltcG9ydGVyV2Vic29ja2V0IiwiaHR0cCIsImRlZmF1bHQiLCJodHRwcyIsIkFkbVppcCIsImdldEZpbGVUeXBlIiwiZ2V0QlNPTlNpemUiLCJpdGVtIiwiQlNPTiIsIm5hdGl2ZSIsImJzb24iLCJjYWxjdWxhdGVPYmplY3RTaXplIiwiZ2V0TWF4QlNPTlNpemUiLCJnZXRCU09OU2FmZUFycmF5c0Zyb21BbkFycmF5IiwidGhlQXJyYXkiLCJCU09OU2l6ZSIsIm1heFNpemUiLCJNYXRoIiwiZmxvb3IiLCJsZW5ndGgiLCJjZWlsIiwic2FmZUFycmF5cyIsImkiLCJwdXNoIiwic2xpY2UiLCJjb25zdHJ1Y3RvciIsImluZm8iLCJFcnJvciIsInByZXBhcmUiLCJiaW5kIiwic3RhcnRJbXBvcnQiLCJnZXRTZWxlY3Rpb24iLCJnZXRQcm9ncmVzcyIsInVwZGF0ZVByb2dyZXNzIiwiYWRkQ291bnRUb1RvdGFsIiwiYWRkQ291bnRDb21wbGV0ZWQiLCJ1cGRhdGVSZWNvcmQiLCJ1cGxvYWRGaWxlIiwibG9nZ2VyIiwiTG9nZ2VyIiwibmFtZSIsInByb2dyZXNzIiwia2V5IiwiY29sbGVjdGlvbiIsImltcG9ydElkIiwiaW5zZXJ0IiwiRGF0ZSIsIm5vdyIsInN0ZXAiLCJNZXRlb3IiLCJ1c2VyIiwiX2lkIiwiaW1wb3J0UmVjb3JkIiwiZmluZE9uZSIsInVzZXJzIiwiY2hhbm5lbHMiLCJtZXNzYWdlcyIsIm9sZFNldHRpbmdzIiwiZGVidWciLCJkYXRhVVJJIiwic2VudENvbnRlbnRUeXBlIiwiZmlsZU5hbWUiLCJza2lwVHlwZUNoZWNrIiwiZmlsZVR5cGUiLCJCdWZmZXIiLCJzcGxpdCIsIm1pbWVUeXBlIiwibWltZSIsIndhcm4iLCJFUlJPUiIsIlBSRVBBUklOR19TVEFSVEVEIiwiaW1wb3J0U2VsZWN0aW9uIiwidW5kZWZpbmVkIiwiSU1QT1JUSU5HX1NUQVJURUQiLCJBY2NvdW50c19BbGxvd2VkRG9tYWluc0xpc3QiLCJSb2NrZXRDaGF0IiwibW9kZWxzIiwiU2V0dGluZ3MiLCJmaW5kT25lQnlJZCIsInZhbHVlIiwidXBkYXRlVmFsdWVCeUlkIiwiQWNjb3VudHNfQWxsb3dVc2VybmFtZUNoYW5nZSIsIkZpbGVVcGxvYWRfTWF4RmlsZVNpemUiLCJET05FIiwicHJvZ3Jlc3NVcGRhdGVkIiwiY291bnQiLCJ0b3RhbCIsImNvbXBsZXRlZCIsImZpZWxkcyIsInVwZGF0ZSIsIiRzZXQiLCJkZXRhaWxzIiwiZmlsZVVybCIsInJvb20iLCJ0aW1lU3RhbXAiLCJyZXF1ZXN0TW9kdWxlIiwidGVzdCIsImZpbGVTdG9yZSIsIkZpbGVVcGxvYWQiLCJnZXRTdG9yZSIsImdldCIsImJpbmRFbnZpcm9ubWVudCIsInJlcyIsInJhd0RhdGEiLCJvbiIsImNodW5rIiwiY29uY2F0IiwiZXJyIiwiZmlsZSIsInVybCIsInJlcGxhY2UiLCJhYnNvbHV0ZVVybCIsImF0dGFjaG1lbnQiLCJ0aXRsZSIsInRpdGxlX2xpbmsiLCJ0eXBlIiwiaW1hZ2VfdXJsIiwiaW1hZ2VfdHlwZSIsImltYWdlX3NpemUiLCJzaXplIiwiaW1hZ2VfZGltZW5zaW9ucyIsImlkZW50aWZ5IiwiYXVkaW9fdXJsIiwiYXVkaW9fdHlwZSIsImF1ZGlvX3NpemUiLCJ2aWRlb191cmwiLCJ2aWRlb190eXBlIiwidmlkZW9fc2l6ZSIsIm1zZyIsInJpZCIsInRzIiwiZ3JvdXBhYmxlIiwiYXR0YWNobWVudHMiLCJtZXNzYWdlX2lkIiwic2VuZE1lc3NhZ2UiLCJORVciLCJtZXNzYWdlX2NvdW50IiwiU2VsZWN0aW9uQ2hhbm5lbCIsImNoYW5uZWxfaWQiLCJpc19hcmNoaXZlZCIsImRvX2ltcG9ydCIsImlzX3ByaXZhdGUiLCJTZWxlY3Rpb25Vc2VyIiwidXNlcl9pZCIsInVzZXJuYW1lIiwiZW1haWwiLCJpc19kZWxldGVkIiwiaXNfYm90IiwiSW1wb3J0ZXJXZWJzb2NrZXREZWYiLCJzdHJlYW1lciIsIlN0cmVhbWVyIiwicmV0cmFuc21pdCIsImFsbG93UmVhZCIsImFsbG93RW1pdCIsImFsbG93V3JpdGUiLCJlbWl0IiwiSW1wb3J0c01vZGVsIiwiX0Jhc2UiLCJSYXdJbXBvcnRzTW9kZWwiLCJJbXBvcnRlcnMiLCJtZXRob2RzIiwiZ2V0SW1wb3J0UHJvZ3Jlc3MiLCJ1c2VySWQiLCJtZXRob2QiLCJhdXRoeiIsImhhc1Blcm1pc3Npb24iLCJpbXBvcnRlciIsImluc3RhbmNlIiwiZ2V0U2VsZWN0aW9uRGF0YSIsIlVTRVJfU0VMRUNUSU9OIiwicHJlcGFyZUltcG9ydCIsImNvbnRlbnRUeXBlIiwiY2hlY2siLCJTdHJpbmciLCJyZXN1bHRzIiwiUHJvbWlzZSIsImNhdGNoIiwiZSIsInJlc3RhcnRJbXBvcnQiLCJDQU5DRUxMRUQiLCJ2YWxpZCIsInNldHVwSW1wb3J0ZXIiLCJjb25zb2xlIiwiaW5wdXQiLCJ1c2Vyc1NlbGVjdGlvbiIsIm1hcCIsImNoYW5uZWxzU2VsZWN0aW9uIiwiY2hhbm5lbCIsInNlbGVjdGlvbiIsInN0YXJ0dXAiLCIkbmUiLCJtdWx0aSIsIm1vZGVsIiwicmF3Q29sbGVjdGlvbiIsImRyb3AiLCJsb2ciLCJ3YXJuaW5ncyIsIk9iamVjdCIsImZyZWV6ZSIsIlBSRVBBUklOR19VU0VSUyIsIlBSRVBBUklOR19DSEFOTkVMUyIsIlBSRVBBUklOR19NRVNTQUdFUyIsIklNUE9SVElOR19VU0VSUyIsIklNUE9SVElOR19DSEFOTkVMUyIsIklNUE9SVElOR19NRVNTQUdFUyIsIkZJTklTSElORyIsIkltcG9ydGVyc0NvbnRhaW5lciIsImltcG9ydGVycyIsIk1hcCIsImFkZCIsInNldCIsImdldEFsbCIsIkFycmF5IiwiZnJvbSIsInZhbHVlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE1BQVAsQ0FBYztBQUFDQyxPQUFLLE1BQUlBO0FBQVYsQ0FBZDtBQUErQixJQUFJQyxRQUFKO0FBQWFILE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSxvQkFBUixDQUFiLEVBQTJDO0FBQUNGLFVBQVNHLENBQVQsRUFBVztBQUFDSCxhQUFTRyxDQUFUO0FBQVc7O0FBQXhCLENBQTNDLEVBQXFFLENBQXJFO0FBQXdFLElBQUlDLFlBQUo7QUFBaUJQLE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSxnQ0FBUixDQUFiLEVBQXVEO0FBQUNFLGNBQWFELENBQWIsRUFBZTtBQUFDQyxpQkFBYUQsQ0FBYjtBQUFlOztBQUFoQyxDQUF2RCxFQUF5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QUFlTyxNQUFmLEVBQVgsQ0FBUDtBQUNBOztBQXhDdUI7O0FBMkNsQixNQUFNdkQsWUFBWSxJQUFJK0Msa0JBQUosRUFBbEIsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9pbXBvcnRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByb2dyZXNzIH0gZnJvbSAnLi9JbXBvcnRlclByb2dyZXNzJztcbmltcG9ydCB7IFByb2dyZXNzU3RlcCB9IGZyb20gJy4uLy4uL2xpYi9JbXBvcnRlclByb2dyZXNzU3RlcCc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuL0ltcG9ydGVyU2VsZWN0aW9uJztcbmltcG9ydCB7IEltcG9ydHMgfSBmcm9tICcuLi9tb2RlbHMvSW1wb3J0cyc7XG5pbXBvcnQgeyBJbXBvcnRlckluZm8gfSBmcm9tICcuLi8uLi9saWIvSW1wb3J0ZXJJbmZvJztcbmltcG9ydCB7IFJhd0ltcG9ydHMgfSBmcm9tICcuLi9tb2RlbHMvUmF3SW1wb3J0cyc7XG5pbXBvcnQgeyBJbXBvcnRlcldlYnNvY2tldCB9IGZyb20gJy4vSW1wb3J0ZXJXZWJzb2NrZXQnO1xuXG5pbXBvcnQgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCBodHRwcyBmcm9tICdodHRwcyc7XG5pbXBvcnQgQWRtWmlwIGZyb20gJ2FkbS16aXAnO1xuaW1wb3J0IGdldEZpbGVUeXBlIGZyb20gJ2ZpbGUtdHlwZSc7XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgYWxsIG9mIHRoZSBpbXBvcnRlcnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXNlIHtcblx0LyoqXG5cdCAqIFRoZSBtYXggQlNPTiBvYmplY3Qgc2l6ZSB3ZSBjYW4gc3RvcmUgaW4gTW9uZ29EQiBpcyAxNjc3NzIxNiBieXRlc1xuXHQgKiBidXQgZm9yIHNvbWUgcmVhc29uIHRoZSBtb25nbyBpbnN0YW5hY2Ugd2hpY2ggY29tZXMgd2l0aCBNZXRlb3Jcblx0ICogZXJyb3JzIG91dCBmb3IgYW55dGhpbmcgY2xvc2UgdG8gdGhhdCBzaXplLiBTbywgd2UgYXJlIHJvdW5kaW5nIGl0XG5cdCAqIGRvd24gdG8gODAwMDAwMCBieXRlcy5cblx0ICpcblx0ICogQHBhcmFtIHthbnl9IGl0ZW0gVGhlIGl0ZW0gdG8gY2FsY3VsYXRlIHRoZSBCU09OIHNpemUgb2YuXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzaXplIG9mIHRoZSBpdGVtIHBhc3NlZCBpbi5cblx0ICogQHN0YXRpY1xuXHQgKi9cblx0c3RhdGljIGdldEJTT05TaXplKGl0ZW0pIHtcblx0XHRjb25zdCB7IEJTT04gfSA9IHJlcXVpcmUoJ2Jzb24nKS5uYXRpdmUoKTtcblx0XHRjb25zdCBic29uID0gbmV3IEJTT04oKTtcblx0XHRyZXR1cm4gYnNvbi5jYWxjdWxhdGVPYmplY3RTaXplKGl0ZW0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBtYXggQlNPTiBvYmplY3Qgc2l6ZSB3ZSBjYW4gc3RvcmUgaW4gTW9uZ29EQiBpcyAxNjc3NzIxNiBieXRlc1xuXHQgKiBidXQgZm9yIHNvbWUgcmVhc29uIHRoZSBtb25nbyBpbnN0YW5hY2Ugd2hpY2ggY29tZXMgd2l0aCBNZXRlb3Jcblx0ICogZXJyb3JzIG91dCBmb3IgYW55dGhpbmcgY2xvc2UgdG8gdGhhdCBzaXplLiBTbywgd2UgYXJlIHJvdW5kaW5nIGl0XG5cdCAqIGRvd24gdG8gODAwMDAwMCBieXRlcy5cblx0ICpcblx0ICogQHJldHVybnMge251bWJlcn0gODAwMDAwMCBieXRlcy5cblx0ICovXG5cdHN0YXRpYyBnZXRNYXhCU09OU2l6ZSgpIHtcblx0XHRyZXR1cm4gODAwMDAwMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBTcGxpdHMgdGhlIHBhc3NlZCBpbiBhcnJheSB0byBhdCBsZWFzdCBvbmUgYXJyYXkgd2hpY2ggaGFzIGEgc2l6ZSB0aGF0XG5cdCAqIGlzIHNhZmUgdG8gc3RvcmUgaW4gdGhlIGRhdGFiYXNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2FueVtdfSB0aGVBcnJheSBUaGUgYXJyYXkgdG8gc3BsaXQgb3V0XG5cdCAqIEByZXR1cm5zIHthbnlbXVtdfSBUaGUgc2FmZSBzaXplZCBhcnJheXNcblx0ICogQHN0YXRpY1xuXHQgKi9cblx0c3RhdGljIGdldEJTT05TYWZlQXJyYXlzRnJvbUFuQXJyYXkodGhlQXJyYXkpIHtcblx0XHRjb25zdCBCU09OU2l6ZSA9IEJhc2UuZ2V0QlNPTlNpemUodGhlQXJyYXkpO1xuXHRcdGNvbnN0IG1heFNpemUgPSBNYXRoLmZsb29yKHRoZUFycmF5Lmxlbmd0aCAvIChNYXRoLmNlaWwoQlNPTlNpemUgLyBCYXNlLmdldE1heEJTT05TaXplKCkpKSk7XG5cdFx0Y29uc3Qgc2FmZUFycmF5cyA9IFtdO1xuXHRcdGxldCBpID0gMDtcblx0XHR3aGlsZSAoaSA8IHRoZUFycmF5Lmxlbmd0aCkge1xuXHRcdFx0c2FmZUFycmF5cy5wdXNoKHRoZUFycmF5LnNsaWNlKGksIChpICs9IG1heFNpemUpKSk7XG5cdFx0fVxuXHRcdHJldHVybiBzYWZlQXJyYXlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnN0cnVjdHMgYSBuZXcgaW1wb3J0ZXIsIGFkZGluZyBhbiBlbXB0eSBjb2xsZWN0aW9uLCBBZG1aaXAgcHJvcGVydHksIGFuZCBlbXB0eSB1c2VycyAmIGNoYW5uZWxzXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBpbXBvcnRlcidzIG5hbWUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkZXNjcmlwdGlvbiBUaGUgaTE4biBzdHJpbmcgd2hpY2ggZGVzY3JpYmVzIHRoZSBpbXBvcnRlclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWltZVR5cGUgVGhlIGV4cGVjdGVkIGZpbGUgdHlwZS5cblx0ICovXG5cdGNvbnN0cnVjdG9yKGluZm8pIHtcblx0XHRpZiAoIShpbmZvIGluc3RhbmNlb2YgSW1wb3J0ZXJJbmZvKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbmZvcm1hdGlvbiBwYXNzZWQgaW4gbXVzdCBiZSBhIHZhbGlkIEltcG9ydGVySW5mbyBpbnN0YW5jZS4nKTtcblx0XHR9XG5cblx0XHR0aGlzLmh0dHAgPSBodHRwO1xuXHRcdHRoaXMuaHR0cHMgPSBodHRwcztcblx0XHR0aGlzLkFkbVppcCA9IEFkbVppcDtcblx0XHR0aGlzLmdldEZpbGVUeXBlID0gZ2V0RmlsZVR5cGU7XG5cblx0XHR0aGlzLnByZXBhcmUgPSB0aGlzLnByZXBhcmUuYmluZCh0aGlzKTtcblx0XHR0aGlzLnN0YXJ0SW1wb3J0ID0gdGhpcy5zdGFydEltcG9ydC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMuZ2V0U2VsZWN0aW9uID0gdGhpcy5nZXRTZWxlY3Rpb24uYmluZCh0aGlzKTtcblx0XHR0aGlzLmdldFByb2dyZXNzID0gdGhpcy5nZXRQcm9ncmVzcy5iaW5kKHRoaXMpO1xuXHRcdHRoaXMudXBkYXRlUHJvZ3Jlc3MgPSB0aGlzLnVwZGF0ZVByb2dyZXNzLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5hZGRDb3VudFRvVG90YWwgPSB0aGlzLmFkZENvdW50VG9Ub3RhbC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMuYWRkQ291bnRDb21wbGV0ZWQgPSB0aGlzLmFkZENvdW50Q29tcGxldGVkLmJpbmQodGhpcyk7XG5cdFx0dGhpcy51cGRhdGVSZWNvcmQgPSB0aGlzLnVwZGF0ZVJlY29yZC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMudXBsb2FkRmlsZSA9IHRoaXMudXBsb2FkRmlsZS5iaW5kKHRoaXMpO1xuXG5cdFx0dGhpcy5pbmZvID0gaW5mbztcblxuXHRcdHRoaXMubG9nZ2VyID0gbmV3IExvZ2dlcihgJHsgdGhpcy5pbmZvLm5hbWUgfSBJbXBvcnRlcmAsIHt9KTtcblx0XHR0aGlzLnByb2dyZXNzID0gbmV3IFByb2dyZXNzKHRoaXMuaW5mby5rZXksIHRoaXMuaW5mby5uYW1lKTtcblx0XHR0aGlzLmNvbGxlY3Rpb24gPSBSYXdJbXBvcnRzO1xuXG5cdFx0Y29uc3QgaW1wb3J0SWQgPSBJbXBvcnRzLmluc2VydCh7ICd0eXBlJzogdGhpcy5pbmZvLm5hbWUsICd0cyc6IERhdGUubm93KCksICdzdGF0dXMnOiB0aGlzLnByb2dyZXNzLnN0ZXAsICd2YWxpZCc6IHRydWUsICd1c2VyJzogTWV0ZW9yLnVzZXIoKS5faWQgfSk7XG5cdFx0dGhpcy5pbXBvcnRSZWNvcmQgPSBJbXBvcnRzLmZpbmRPbmUoaW1wb3J0SWQpO1xuXG5cdFx0dGhpcy51c2VycyA9IHt9O1xuXHRcdHRoaXMuY2hhbm5lbHMgPSB7fTtcblx0XHR0aGlzLm1lc3NhZ2VzID0ge307XG5cdFx0dGhpcy5vbGRTZXR0aW5ncyA9IHt9O1xuXG5cdFx0dGhpcy5sb2dnZXIuZGVidWcoYENvbnN0cnVjdGVkIGEgbmV3ICR7IGluZm8ubmFtZSB9IEltcG9ydGVyLmApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRha2VzIHRoZSB1cGxvYWRlZCBmaWxlIGFuZCBleHRyYWN0cyB0aGUgdXNlcnMsIGNoYW5uZWxzLCBhbmQgbWVzc2FnZXMgZnJvbSBpdC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGFVUkkgQmFzZTY0IHN0cmluZyBvZiB0aGUgdXBsb2FkZWQgZmlsZVxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2VudENvbnRlbnRUeXBlIFRoZSBzZW50IGZpbGUgdHlwZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpbGVOYW1lIFRoZSBuYW1lIG9mIHRoZSB1cGxvYWRlZCBmaWxlLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNraXBUeXBlQ2hlY2sgT3B0aW9uYWwgcHJvcGVydHkgdGhhdCBzYXlzIHRvIG5vdCBjaGVjayB0aGUgdHlwZSBwcm92aWRlZC5cblx0ICogQHJldHVybnMge1Byb2dyZXNzfSBUaGUgcHJvZ3Jlc3MgcmVjb3JkIG9mIHRoZSBpbXBvcnQuXG5cdCAqL1xuXHRwcmVwYXJlKGRhdGFVUkksIHNlbnRDb250ZW50VHlwZSwgZmlsZU5hbWUsIHNraXBUeXBlQ2hlY2spIHtcblx0XHRpZiAoIXNraXBUeXBlQ2hlY2spIHtcblx0XHRcdGNvbnN0IGZpbGVUeXBlID0gdGhpcy5nZXRGaWxlVHlwZShuZXcgQnVmZmVyKGRhdGFVUkkuc3BsaXQoJywnKVsxXSwgJ2Jhc2U2NCcpKTtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKCdVcGxvYWRlZCBmaWxlIGluZm9ybWF0aW9uIGlzOicsIGZpbGVUeXBlKTtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKCdFeHBlY3RlZCBmaWxlIHR5cGUgaXM6JywgdGhpcy5pbmZvLm1pbWVUeXBlKTtcblxuXHRcdFx0aWYgKCFmaWxlVHlwZSB8fCAoZmlsZVR5cGUubWltZSAhPT0gdGhpcy5pbmZvLm1pbWVUeXBlKSkge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci53YXJuKGBJbnZhbGlkIGZpbGUgdXBsb2FkZWQgZm9yIHRoZSAkeyB0aGlzLmluZm8ubmFtZSB9IGltcG9ydGVyLmApO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVByb2dyZXNzKFByb2dyZXNzU3RlcC5FUlJPUik7XG5cdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtZmlsZS11cGxvYWRlZCcsIGBJbnZhbGlkIGZpbGUgdXBsb2FkZWQgdG8gaW1wb3J0ICR7IHRoaXMuaW5mby5uYW1lIH0gZGF0YSBmcm9tLmAsIHsgc3RlcDogJ3ByZXBhcmUnIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLlBSRVBBUklOR19TVEFSVEVEKTtcblx0XHRyZXR1cm4gdGhpcy51cGRhdGVSZWNvcmQoeyAnZmlsZSc6IGZpbGVOYW1lIH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyB0aGUgaW1wb3J0IHByb2Nlc3MuIFRoZSBpbXBsZW1lbnRpbmcgbWV0aG9kIHNob3VsZCBkZWZlclxuXHQgKiBhcyBzb29uIGFzIHRoZSBzZWxlY3Rpb24gaXMgc2V0LCBzbyB0aGUgdXNlciB3aG8gc3RhcnRlZCB0aGUgcHJvY2Vzc1xuXHQgKiBkb2Vzbid0IGVuZCB1cCB3aXRoIGEgXCJsb2NrZWRcIiBVSSB3aGlsZSBNZXRlb3Igd2FpdHMgZm9yIGEgcmVzcG9uc2UuXG5cdCAqIFRoZSByZXR1cm5lZCBvYmplY3Qgc2hvdWxkIGJlIHRoZSBwcm9ncmVzcy5cblx0ICpcblx0ICogQHBhcmFtIHtTZWxlY3Rpb259IGltcG9ydFNlbGVjdGlvbiBUaGUgc2VsZWN0aW9uIGRhdGEuXG5cdCAqIEByZXR1cm5zIHtQcm9ncmVzc30gVGhlIHByb2dyZXNzIHJlY29yZCBvZiB0aGUgaW1wb3J0LlxuXHQgKi9cblx0c3RhcnRJbXBvcnQoaW1wb3J0U2VsZWN0aW9uKSB7XG5cdFx0aWYgKCEoaW1wb3J0U2VsZWN0aW9uIGluc3RhbmNlb2YgU2VsZWN0aW9uKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFNlbGVjdGlvbiBkYXRhIHByb3ZpZGVkIHRvIHRoZSAkeyB0aGlzLmluZm8ubmFtZSB9IGltcG9ydGVyLmApO1xuXHRcdH0gZWxzZSBpZiAoaW1wb3J0U2VsZWN0aW9uLnVzZXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVXNlcnMgaW4gdGhlIHNlbGVjdGVkIGRhdGEgd2Fzbid0IGZvdW5kLCBpdCBtdXN0IGJ1dCBhdCBsZWFzdCBhbiBlbXB0eSBhcnJheSBmb3IgdGhlICR7IHRoaXMuaW5mby5uYW1lIH0gaW1wb3J0ZXIuYCk7XG5cdFx0fSBlbHNlIGlmIChpbXBvcnRTZWxlY3Rpb24uY2hhbm5lbHMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDaGFubmVscyBpbiB0aGUgc2VsZWN0ZWQgZGF0YSB3YXNuJ3QgZm91bmQsIGl0IG11c3QgYnV0IGF0IGxlYXN0IGFuIGVtcHR5IGFycmF5IGZvciB0aGUgJHsgdGhpcy5pbmZvLm5hbWUgfSBpbXBvcnRlci5gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy51cGRhdGVQcm9ncmVzcyhQcm9ncmVzc1N0ZXAuSU1QT1JUSU5HX1NUQVJURUQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIFNlbGVjdGlvbiBvYmplY3QgZm9yIHRoZSBpbXBvcnQuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtTZWxlY3Rpb259IFRoZSB1c2VycyBhbmQgY2hhbm5lbHMgc2VsZWN0aW9uXG5cdCAqL1xuXHRnZXRTZWxlY3Rpb24oKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkICdnZXRTZWxlY3Rpb24nIGNhbGxlZCBvbiAkeyB0aGlzLmluZm8ubmFtZSB9LCBpdCBtdXN0IGJlIG92ZXJyaWRkZW4gYW5kIHN1cGVyIGNhbiBub3QgYmUgY2FsbGVkLmApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHByb2dyZXNzIG9mIHRoaXMgaW1wb3J0LlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvZ3Jlc3N9IFRoZSBwcm9ncmVzcyByZWNvcmQgb2YgdGhlIGltcG9ydC5cblx0ICovXG5cdGdldFByb2dyZXNzKCkge1xuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhlIHByb2dyZXNzIHN0ZXAgb2YgdGhpcyBpbXBvcnRlci5cblx0ICogSXQgYWxzbyBjaGFuZ2VzIHNvbWUgaW50ZXJuYWwgc2V0dGluZ3MgYXQgdmFyaW91cyBzdGFnZXMgb2YgdGhlIGltcG9ydC5cblx0ICogVGhpcyB3YXkgdGhlIGltcG9ydGVyIGNhbiBhZGp1c3QgdXNlci9yb29tIGluZm9ybWF0aW9uIGF0IHdpbGwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7UHJvZ3Jlc3NTdGVwfSBzdGVwIFRoZSBwcm9ncmVzcyBzdGVwIHdoaWNoIHRoaXMgaW1wb3J0IGlzIGN1cnJlbnRseSBhdC5cblx0ICogQHJldHVybnMge1Byb2dyZXNzfSBUaGUgcHJvZ3Jlc3MgcmVjb3JkIG9mIHRoZSBpbXBvcnQuXG5cdCAqL1xuXHR1cGRhdGVQcm9ncmVzcyhzdGVwKSB7XG5cdFx0dGhpcy5wcm9ncmVzcy5zdGVwID0gc3RlcDtcblxuXHRcdHN3aXRjaCAoc3RlcCkge1xuXHRcdFx0Y2FzZSBQcm9ncmVzc1N0ZXAuSU1QT1JUSU5HX1NUQVJURUQ6XG5cdFx0XHRcdHRoaXMub2xkU2V0dGluZ3MuQWNjb3VudHNfQWxsb3dlZERvbWFpbnNMaXN0ID0gUm9ja2V0Q2hhdC5tb2RlbHMuU2V0dGluZ3MuZmluZE9uZUJ5SWQoJ0FjY291bnRzX0FsbG93ZWREb21haW5zTGlzdCcpLnZhbHVlO1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy51cGRhdGVWYWx1ZUJ5SWQoJ0FjY291bnRzX0FsbG93ZWREb21haW5zTGlzdCcsICcnKTtcblxuXHRcdFx0XHR0aGlzLm9sZFNldHRpbmdzLkFjY291bnRzX0FsbG93VXNlcm5hbWVDaGFuZ2UgPSBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kT25lQnlJZCgnQWNjb3VudHNfQWxsb3dVc2VybmFtZUNoYW5nZScpLnZhbHVlO1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy51cGRhdGVWYWx1ZUJ5SWQoJ0FjY291bnRzX0FsbG93VXNlcm5hbWVDaGFuZ2UnLCB0cnVlKTtcblxuXHRcdFx0XHR0aGlzLm9sZFNldHRpbmdzLkZpbGVVcGxvYWRfTWF4RmlsZVNpemUgPSBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kT25lQnlJZCgnRmlsZVVwbG9hZF9NYXhGaWxlU2l6ZScpLnZhbHVlO1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy51cGRhdGVWYWx1ZUJ5SWQoJ0ZpbGVVcGxvYWRfTWF4RmlsZVNpemUnLCAwKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFByb2dyZXNzU3RlcC5ET05FOlxuXHRcdFx0Y2FzZSBQcm9ncmVzc1N0ZXAuRVJST1I6XG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLnVwZGF0ZVZhbHVlQnlJZCgnQWNjb3VudHNfQWxsb3dlZERvbWFpbnNMaXN0JywgdGhpcy5vbGRTZXR0aW5ncy5BY2NvdW50c19BbGxvd2VkRG9tYWluc0xpc3QpO1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy51cGRhdGVWYWx1ZUJ5SWQoJ0FjY291bnRzX0FsbG93VXNlcm5hbWVDaGFuZ2UnLCB0aGlzLm9sZFNldHRpbmdzLkFjY291bnRzX0FsbG93VXNlcm5hbWVDaGFuZ2UpO1xuXHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy51cGRhdGVWYWx1ZUJ5SWQoJ0ZpbGVVcGxvYWRfTWF4RmlsZVNpemUnLCB0aGlzLm9sZFNldHRpbmdzLkZpbGVVcGxvYWRfTWF4RmlsZVNpemUpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgJHsgdGhpcy5pbmZvLm5hbWUgfSBpcyBub3cgYXQgJHsgc3RlcCB9LmApO1xuXHRcdHRoaXMudXBkYXRlUmVjb3JkKHsgJ3N0YXR1cyc6IHRoaXMucHJvZ3Jlc3Muc3RlcCB9KTtcblxuXHRcdEltcG9ydGVyV2Vic29ja2V0LnByb2dyZXNzVXBkYXRlZCh0aGlzLnByb2dyZXNzKTtcblxuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgdGhlIHBhc3NlZCBpbiB2YWx1ZSB0byB0aGUgdG90YWwgYW1vdW50IG9mIGl0ZW1zIG5lZWRlZCB0byBjb21wbGV0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGNvdW50IFRoZSBhbW91bnQgdG8gYWRkIHRvIHRoZSB0b3RhbCBjb3VudCBvZiBpdGVtcy5cblx0ICogQHJldHVybnMge1Byb2dyZXNzfSBUaGUgcHJvZ3Jlc3MgcmVjb3JkIG9mIHRoZSBpbXBvcnQuXG5cdCAqL1xuXHRhZGRDb3VudFRvVG90YWwoY291bnQpIHtcblx0XHR0aGlzLnByb2dyZXNzLmNvdW50LnRvdGFsID0gdGhpcy5wcm9ncmVzcy5jb3VudC50b3RhbCArIGNvdW50O1xuXHRcdHRoaXMudXBkYXRlUmVjb3JkKHsgJ2NvdW50LnRvdGFsJzogdGhpcy5wcm9ncmVzcy5jb3VudC50b3RhbCB9KTtcblxuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgdGhlIHBhc3NlZCBpbiB2YWx1ZSB0byB0aGUgdG90YWwgYW1vdW50IG9mIGl0ZW1zIGNvbXBsZXRlZC5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGNvdW50IFRoZSBhbW91bnQgdG8gYWRkIHRvIHRoZSB0b3RhbCBjb3VudCBvZiBmaW5pc2hlZCBpdGVtcy5cblx0ICogQHJldHVybnMge1Byb2dyZXNzfSBUaGUgcHJvZ3Jlc3MgcmVjb3JkIG9mIHRoZSBpbXBvcnQuXG5cdCAqL1xuXHRhZGRDb3VudENvbXBsZXRlZChjb3VudCkge1xuXHRcdHRoaXMucHJvZ3Jlc3MuY291bnQuY29tcGxldGVkID0gdGhpcy5wcm9ncmVzcy5jb3VudC5jb21wbGV0ZWQgKyBjb3VudDtcblxuXHRcdC8vT25seSB1cGRhdGUgdGhlIGRhdGFiYXNlIGV2ZXJ5IDUwMCByZWNvcmRzXG5cdFx0Ly9PciB0aGUgY29tcGxldGVkIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byB0aGUgdG90YWwgYW1vdW50XG5cdFx0aWYgKCgodGhpcy5wcm9ncmVzcy5jb3VudC5jb21wbGV0ZWQgJSA1MDApID09PSAwKSB8fCAodGhpcy5wcm9ncmVzcy5jb3VudC5jb21wbGV0ZWQgPj0gdGhpcy5wcm9ncmVzcy5jb3VudC50b3RhbCkpIHtcblx0XHRcdHRoaXMudXBkYXRlUmVjb3JkKHsgJ2NvdW50LmNvbXBsZXRlZCc6IHRoaXMucHJvZ3Jlc3MuY291bnQuY29tcGxldGVkIH0pO1xuXHRcdH1cblxuXHRcdEltcG9ydGVyV2Vic29ja2V0LnByb2dyZXNzVXBkYXRlZCh0aGlzLnByb2dyZXNzKTtcblxuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhlIGltcG9ydCByZWNvcmQgd2l0aCB0aGUgZ2l2ZW4gZmllbGRzIGJlaW5nIGBzZXRgLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2FueX0gZmllbGRzIFRoZSBmaWVsZHMgdG8gc2V0LCBpdCBzaG91bGQgYmUgYW4gb2JqZWN0IHdpdGgga2V5L3ZhbHVlcy5cblx0ICogQHJldHVybnMge0ltcG9ydHN9IFRoZSBpbXBvcnQgcmVjb3JkLlxuXHQgKi9cblx0dXBkYXRlUmVjb3JkKGZpZWxkcykge1xuXHRcdEltcG9ydHMudXBkYXRlKHsgX2lkOiB0aGlzLmltcG9ydFJlY29yZC5faWQgfSwgeyAkc2V0OiBmaWVsZHMgfSk7XG5cdFx0dGhpcy5pbXBvcnRSZWNvcmQgPSBJbXBvcnRzLmZpbmRPbmUodGhpcy5pbXBvcnRSZWNvcmQuX2lkKTtcblxuXHRcdHJldHVybiB0aGlzLmltcG9ydFJlY29yZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGxvYWRzIHRoZSBmaWxlIHRvIHRoZSBzdG9yYWdlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2FueX0gZGV0YWlscyBBbiBvYmplY3Qgd2l0aCBkZXRhaWxzIGFib3V0IHRoZSB1cGxvYWQ6IGBuYW1lYCwgYHNpemVgLCBgdHlwZWAsIGFuZCBgcmlkYC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpbGVVcmwgVXJsIG9mIHRoZSBmaWxlIHRvIGRvd25sb2FkL2ltcG9ydC5cblx0ICogQHBhcmFtIHthbnl9IHVzZXIgVGhlIFJvY2tldC5DaGF0IHVzZXIuXG5cdCAqIEBwYXJhbSB7YW55fSByb29tIFRoZSBSb2NrZXQuQ2hhdCBSb29tLlxuXHQgKiBAcGFyYW0ge0RhdGV9IHRpbWVTdGFtcCBUaGUgdGltZXN0YW1wIHRoZSBmaWxlIHdhcyB1cGxvYWRlZFxuXHQgKi9cblx0dXBsb2FkRmlsZShkZXRhaWxzLCBmaWxlVXJsLCB1c2VyLCByb29tLCB0aW1lU3RhbXApIHtcblx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgVXBsb2FkaW5nIHRoZSBmaWxlICR7IGRldGFpbHMubmFtZSB9IGZyb20gJHsgZmlsZVVybCB9LmApO1xuXHRcdGNvbnN0IHJlcXVlc3RNb2R1bGUgPSAvaHR0cHMvaS50ZXN0KGZpbGVVcmwpID8gdGhpcy5odHRwcyA6IHRoaXMuaHR0cDtcblxuXHRcdGNvbnN0IGZpbGVTdG9yZSA9IEZpbGVVcGxvYWQuZ2V0U3RvcmUoJ1VwbG9hZHMnKTtcblxuXHRcdHJldHVybiByZXF1ZXN0TW9kdWxlLmdldChmaWxlVXJsLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uKHJlcykge1xuXHRcdFx0Y29uc3QgcmF3RGF0YSA9IFtdO1xuXHRcdFx0cmVzLm9uKCdkYXRhJywgY2h1bmsgPT4gcmF3RGF0YS5wdXNoKGNodW5rKSk7XG5cdFx0XHRyZXMub24oJ2VuZCcsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge1xuXHRcdFx0XHRmaWxlU3RvcmUuaW5zZXJ0KGRldGFpbHMsIEJ1ZmZlci5jb25jYXQocmF3RGF0YSksIGZ1bmN0aW9uKGVyciwgZmlsZSkge1xuXHRcdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cmwgPSBmaWxlLnVybC5yZXBsYWNlKE1ldGVvci5hYnNvbHV0ZVVybCgpLCAnLycpO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBhdHRhY2htZW50ID0ge1xuXHRcdFx0XHRcdFx0XHR0aXRsZTogZmlsZS5uYW1lLFxuXHRcdFx0XHRcdFx0XHR0aXRsZV9saW5rOiB1cmxcblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdGlmICgvXmltYWdlXFwvLisvLnRlc3QoZmlsZS50eXBlKSkge1xuXHRcdFx0XHRcdFx0XHRhdHRhY2htZW50LmltYWdlX3VybCA9IHVybDtcblx0XHRcdFx0XHRcdFx0YXR0YWNobWVudC5pbWFnZV90eXBlID0gZmlsZS50eXBlO1xuXHRcdFx0XHRcdFx0XHRhdHRhY2htZW50LmltYWdlX3NpemUgPSBmaWxlLnNpemU7XG5cdFx0XHRcdFx0XHRcdGF0dGFjaG1lbnQuaW1hZ2VfZGltZW5zaW9ucyA9IGZpbGUuaWRlbnRpZnkgIT0gbnVsbCA/IGZpbGUuaWRlbnRpZnkuc2l6ZSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKC9eYXVkaW9cXC8uKy8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRcdFx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fdXJsID0gdXJsO1xuXHRcdFx0XHRcdFx0XHRhdHRhY2htZW50LmF1ZGlvX3R5cGUgPSBmaWxlLnR5cGU7XG5cdFx0XHRcdFx0XHRcdGF0dGFjaG1lbnQuYXVkaW9fc2l6ZSA9IGZpbGUuc2l6ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKC9edmlkZW9cXC8uKy8udGVzdChmaWxlLnR5cGUpKSB7XG5cdFx0XHRcdFx0XHRcdGF0dGFjaG1lbnQudmlkZW9fdXJsID0gdXJsO1xuXHRcdFx0XHRcdFx0XHRhdHRhY2htZW50LnZpZGVvX3R5cGUgPSBmaWxlLnR5cGU7XG5cdFx0XHRcdFx0XHRcdGF0dGFjaG1lbnQudmlkZW9fc2l6ZSA9IGZpbGUuc2l6ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3QgbXNnID0ge1xuXHRcdFx0XHRcdFx0XHRyaWQ6IGRldGFpbHMucmlkLFxuXHRcdFx0XHRcdFx0XHR0czogdGltZVN0YW1wLFxuXHRcdFx0XHRcdFx0XHRtc2c6ICcnLFxuXHRcdFx0XHRcdFx0XHRmaWxlOiB7XG5cdFx0XHRcdFx0XHRcdFx0X2lkOiBmaWxlLl9pZFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRncm91cGFibGU6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRhdHRhY2htZW50czogW2F0dGFjaG1lbnRdXG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRpZiAoKGRldGFpbHMubWVzc2FnZV9pZCAhPSBudWxsKSAmJiAodHlwZW9mIGRldGFpbHMubWVzc2FnZV9pZCA9PT0gJ3N0cmluZycpKSB7XG5cdFx0XHRcdFx0XHRcdG1zZ1snX2lkJ10gPSBkZXRhaWxzLm1lc3NhZ2VfaWQ7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiBSb2NrZXRDaGF0LnNlbmRNZXNzYWdlKHVzZXIsIG1zZywgcm9vbSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pKTtcblx0XHR9KSk7XG5cdH1cbn1cbiIsImltcG9ydCB7IFByb2dyZXNzU3RlcCB9IGZyb20gJy4uLy4uL2xpYi9JbXBvcnRlclByb2dyZXNzU3RlcCc7XG5cbmV4cG9ydCBjbGFzcyBQcm9ncmVzcyB7XG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHByb2dyZXNzIGNvbnRhaW5lciBmb3IgdGhlIGltcG9ydGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSB1bmlxdWUga2V5IG9mIHRoZSBpbXBvcnRlci5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGltcG9ydGVyLlxuXHQgKi9cblx0Y29uc3RydWN0b3Ioa2V5LCBuYW1lKSB7XG5cdFx0dGhpcy5rZXkgPSBrZXk7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLnN0ZXAgPSBQcm9ncmVzc1N0ZXAuTkVXO1xuXHRcdHRoaXMuY291bnQgPSB7IGNvbXBsZXRlZDogMCwgdG90YWw6IDAgfTtcblx0fVxufVxuIiwiZXhwb3J0IGNsYXNzIFNlbGVjdGlvbiB7XG5cdC8qKlxuXHQgKiBDb25zdHJ1Y3RzIGEgbmV3IGltcG9ydGVyIHNlbGVjdGlvbiBvYmplY3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIHRoZSBuYW1lIG9mIHRoZSBpbXBvcnRlclxuXHQgKiBAcGFyYW0ge1NlbGVjdGlvblVzZXJbXX0gdXNlcnMgdGhlIHVzZXJzIHdoaWNoIGNhbiBiZSBzZWxlY3RlZFxuXHQgKiBAcGFyYW0ge1NlbGVjdGlvbkNoYW5uZWxbXX0gY2hhbm5lbHMgdGhlIGNoYW5uZWxzIHdoaWNoIGNhbiBiZSBzZWxlY3RlZFxuXHQgKiBAcGFyYW0ge251bWJlcn0gbWVzc2FnZV9jb3VudCB0aGUgbnVtYmVyIG9mIG1lc3NhZ2VzXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihuYW1lLCB1c2VycywgY2hhbm5lbHMsIG1lc3NhZ2VfY291bnQpIHtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMudXNlcnMgPSB1c2Vycztcblx0XHR0aGlzLmNoYW5uZWxzID0gY2hhbm5lbHM7XG5cdFx0dGhpcy5tZXNzYWdlX2NvdW50ID0gbWVzc2FnZV9jb3VudDtcblx0fVxufVxuIiwiZXhwb3J0IGNsYXNzIFNlbGVjdGlvbkNoYW5uZWwge1xuXHQvKipcblx0ICogQ29uc3RydWN0cyBhIG5ldyBzZWxlY3Rpb24gY2hhbm5lbC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGNoYW5uZWxfaWQgdGhlIHVuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBjaGFubmVsXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIHRoZSBuYW1lIG9mIHRoZSBjaGFubmVsXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfYXJjaGl2ZWQgd2hldGhlciB0aGUgY2hhbm5lbCB3YXMgYXJjaGl2ZWQgb3Igbm90XG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZG9faW1wb3J0IHdoZXRoZXIgd2Ugd2lsbCBiZSBpbXBvcnRpbmcgdGhlIGNoYW5uZWwgb3Igbm90XG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfcHJpdmF0ZSB3aGV0aGVyIHRoZSBjaGFubmVsIGlzIHByaXZhdGUgb3IgcHVibGljXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihjaGFubmVsX2lkLCBuYW1lLCBpc19hcmNoaXZlZCwgZG9faW1wb3J0LCBpc19wcml2YXRlKSB7XG5cdFx0dGhpcy5jaGFubmVsX2lkID0gY2hhbm5lbF9pZDtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaXNfYXJjaGl2ZWQgPSBpc19hcmNoaXZlZDtcblx0XHR0aGlzLmRvX2ltcG9ydCA9IGRvX2ltcG9ydDtcblx0XHR0aGlzLmlzX3ByaXZhdGUgPSBpc19wcml2YXRlO1xuXHR9XG59XG4iLCJleHBvcnQgY2xhc3MgU2VsZWN0aW9uVXNlciB7XG5cdC8qKlxuXHQgKiBDb25zdHJ1Y3RzIGEgbmV3IHNlbGVjdGlvbiB1c2VyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdXNlcl9pZCB0aGUgdW5pcXVlIHVzZXIgaWRlbnRpZmllclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdXNlcm5hbWUgdGhlIHVzZXIncyB1c2VybmFtZVxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZW1haWwgdGhlIHVzZXIncyBlbWFpbFxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2RlbGV0ZWQgd2hldGhlciB0aGUgdXNlciB3YXMgZGVsZXRlZCBvciBub3Rcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19ib3Qgd2hldGhlciB0aGUgdXNlciBpcyBhIGJvdCBvciBub3Rcblx0ICogQHBhcmFtIHtib29sZWFufSBkb19pbXBvcnQgd2hldGhlciB3ZSBhcmUgZ29pbmcgdG8gaW1wb3J0IHRoaXMgdXNlciBvciBub3Rcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVzZXJfaWQsIHVzZXJuYW1lLCBlbWFpbCwgaXNfZGVsZXRlZCwgaXNfYm90LCBkb19pbXBvcnQpIHtcblx0XHR0aGlzLnVzZXJfaWQgPSB1c2VyX2lkO1xuXHRcdHRoaXMudXNlcm5hbWUgPSB1c2VybmFtZTtcblx0XHR0aGlzLmVtYWlsID0gZW1haWw7XG5cdFx0dGhpcy5pc19kZWxldGVkID0gaXNfZGVsZXRlZDtcblx0XHR0aGlzLmlzX2JvdCA9IGlzX2JvdDtcblx0XHR0aGlzLmRvX2ltcG9ydCA9IGRvX2ltcG9ydDtcblx0fVxufVxuIiwiY2xhc3MgSW1wb3J0ZXJXZWJzb2NrZXREZWYge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLnN0cmVhbWVyID0gbmV3IE1ldGVvci5TdHJlYW1lcignaW1wb3J0ZXJzJywgeyByZXRyYW5zbWl0OiBmYWxzZSB9KTtcblx0XHR0aGlzLnN0cmVhbWVyLmFsbG93UmVhZCgnYWxsJyk7XG5cdFx0dGhpcy5zdHJlYW1lci5hbGxvd0VtaXQoJ2FsbCcpO1xuXHRcdHRoaXMuc3RyZWFtZXIuYWxsb3dXcml0ZSgnbm9uZScpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuIHRoZSBwcm9ncmVzcyBpcyB1cGRhdGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1Byb2dyZXNzfSBwcm9ncmVzcyBUaGUgcHJvZ3Jlc3Mgb2YgdGhlIGltcG9ydC5cblx0ICovXG5cdHByb2dyZXNzVXBkYXRlZChwcm9ncmVzcykge1xuXHRcdHRoaXMuc3RyZWFtZXIuZW1pdCgncHJvZ3Jlc3MnLCBwcm9ncmVzcyk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IEltcG9ydGVyV2Vic29ja2V0ID0gbmV3IEltcG9ydGVyV2Vic29ja2V0RGVmKCk7XG4iLCJjbGFzcyBJbXBvcnRzTW9kZWwgZXh0ZW5kcyBSb2NrZXRDaGF0Lm1vZGVscy5fQmFzZSB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCdpbXBvcnQnKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgSW1wb3J0cyA9IG5ldyBJbXBvcnRzTW9kZWwoKTtcbiIsImNsYXNzIFJhd0ltcG9ydHNNb2RlbCBleHRlbmRzIFJvY2tldENoYXQubW9kZWxzLl9CYXNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ3Jhd19pbXBvcnRzJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFJhd0ltcG9ydHMgPSBuZXcgUmF3SW1wb3J0c01vZGVsKCk7XG4iLCJpbXBvcnQgeyBJbXBvcnRlcnMgfSBmcm9tICdtZXRlb3Ivcm9ja2V0Y2hhdDppbXBvcnRlcic7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0Z2V0SW1wb3J0UHJvZ3Jlc3Moa2V5KSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ2dldEltcG9ydFByb2dyZXNzJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdydW4taW1wb3J0JykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdJbXBvcnRpbmcgaXMgbm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ3NldHVwSW1wb3J0ZXInfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW1wb3J0ZXIgPSBJbXBvcnRlcnMuZ2V0KGtleSk7XG5cblx0XHRpZiAoIWltcG9ydGVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbXBvcnRlci1ub3QtZGVmaW5lZCcsIGBUaGUgaW1wb3J0ZXIgKCR7IGtleSB9KSBoYXMgbm8gaW1wb3J0IGNsYXNzIGRlZmluZWQuYCwgeyBtZXRob2Q6ICdnZXRJbXBvcnRQcm9ncmVzcycgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFpbXBvcnRlci5pbnN0YW5jZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gaW1wb3J0ZXIuaW5zdGFuY2UuZ2V0UHJvZ3Jlc3MoKTtcblx0fVxufSk7XG4iLCJpbXBvcnQge1xuXHRJbXBvcnRlcnMsXG5cdFByb2dyZXNzU3RlcFxufSBmcm9tICdtZXRlb3Ivcm9ja2V0Y2hhdDppbXBvcnRlcic7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0Z2V0U2VsZWN0aW9uRGF0YShrZXkpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnZ2V0U2VsZWN0aW9uRGF0YScgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFSb2NrZXRDaGF0LmF1dGh6Lmhhc1Blcm1pc3Npb24oTWV0ZW9yLnVzZXJJZCgpLCAncnVuLWltcG9ydCcpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1hY3Rpb24tbm90LWFsbG93ZWQnLCAnSW1wb3J0aW5nIGlzIG5vdCBhbGxvd2VkJywgeyBtZXRob2Q6ICdzZXR1cEltcG9ydGVyJ30pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGltcG9ydGVyID0gSW1wb3J0ZXJzLmdldChrZXkpO1xuXG5cdFx0aWYgKCFpbXBvcnRlciB8fCAhaW1wb3J0ZXIuaW5zdGFuY2UpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWltcG9ydGVyLW5vdC1kZWZpbmVkJywgYFRoZSBpbXBvcnRlciAoJHsga2V5IH0pIGhhcyBubyBpbXBvcnQgY2xhc3MgZGVmaW5lZC5gLCB7IG1ldGhvZDogJ2dldFNlbGVjdGlvbkRhdGEnIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb2dyZXNzID0gaW1wb3J0ZXIuaW5zdGFuY2UuZ2V0UHJvZ3Jlc3MoKTtcblxuXHRcdHN3aXRjaCAocHJvZ3Jlc3Muc3RlcCkge1xuXHRcdFx0Y2FzZSBQcm9ncmVzc1N0ZXAuVVNFUl9TRUxFQ1RJT046XG5cdFx0XHRcdHJldHVybiBpbXBvcnRlci5pbnN0YW5jZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59KTtcbiIsImltcG9ydCB7IEltcG9ydGVycyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHRwcmVwYXJlSW1wb3J0KGtleSwgZGF0YVVSSSwgY29udGVudFR5cGUsIGZpbGVOYW1lKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ3ByZXBhcmVJbXBvcnQnIH0pO1xuXHRcdH1cblxuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3J1bi1pbXBvcnQnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ0ltcG9ydGluZyBpcyBub3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnc2V0dXBJbXBvcnRlcid9KTtcblx0XHR9XG5cblx0XHRjaGVjayhrZXksIFN0cmluZyk7XG5cdFx0Y2hlY2soZGF0YVVSSSwgU3RyaW5nKTtcblx0XHRjaGVjayhmaWxlTmFtZSwgU3RyaW5nKTtcblxuXHRcdGNvbnN0IGltcG9ydGVyID0gSW1wb3J0ZXJzLmdldChrZXkpO1xuXG5cdFx0aWYgKCFpbXBvcnRlcikge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW1wb3J0ZXItbm90LWRlZmluZWQnLCBgVGhlIGltcG9ydGVyICgkeyBrZXkgfSkgaGFzIG5vIGltcG9ydCBjbGFzcyBkZWZpbmVkLmAsIHsgbWV0aG9kOiAncHJlcGFyZUltcG9ydCcgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0cyA9IGltcG9ydGVyLmluc3RhbmNlLnByZXBhcmUoZGF0YVVSSSwgY29udGVudFR5cGUsIGZpbGVOYW1lKTtcblxuXHRcdGlmIChyZXN1bHRzIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdHMuY2F0Y2goZSA9PiB7IHRocm93IG5ldyBNZXRlb3IuRXJyb3IoZSk7IH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0cztcblx0XHR9XG5cdH1cbn0pO1xuIiwiaW1wb3J0IHtcblx0SW1wb3J0ZXJzLFxuXHRQcm9ncmVzc1N0ZXBcbn0gZnJvbSAnbWV0ZW9yL3JvY2tldGNoYXQ6aW1wb3J0ZXInO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdHJlc3RhcnRJbXBvcnQoa2V5KSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ3Jlc3RhcnRJbXBvcnQnIH0pO1xuXHRcdH1cblxuXHRcdGlmICghUm9ja2V0Q2hhdC5hdXRoei5oYXNQZXJtaXNzaW9uKE1ldGVvci51c2VySWQoKSwgJ3J1bi1pbXBvcnQnKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItYWN0aW9uLW5vdC1hbGxvd2VkJywgJ0ltcG9ydGluZyBpcyBub3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnc2V0dXBJbXBvcnRlcid9KTtcblx0XHR9XG5cblx0XHRjb25zdCBpbXBvcnRlciA9IEltcG9ydGVycy5nZXQoa2V5KTtcblxuXHRcdGlmICghaW1wb3J0ZXIpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWltcG9ydGVyLW5vdC1kZWZpbmVkJywgYFRoZSBpbXBvcnRlciAoJHsga2V5IH0pIGhhcyBubyBpbXBvcnQgY2xhc3MgZGVmaW5lZC5gLCB7IG1ldGhvZDogJ3Jlc3RhcnRJbXBvcnQnIH0pO1xuXHRcdH1cblxuXHRcdGlmIChpbXBvcnRlci5pbnN0YW5jZSkge1xuXHRcdFx0aW1wb3J0ZXIuaW5zdGFuY2UudXBkYXRlUHJvZ3Jlc3MoUHJvZ3Jlc3NTdGVwLkNBTkNFTExFRCk7XG5cdFx0XHRpbXBvcnRlci5pbnN0YW5jZS51cGRhdGVSZWNvcmQoeyB2YWxpZDogZmFsc2UgfSk7XG5cdFx0XHRpbXBvcnRlci5pbnN0YW5jZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpbXBvcnRlci5pbnN0YW5jZSA9IG5ldyBpbXBvcnRlci5pbXBvcnRlcihpbXBvcnRlcik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbmV3LWNhcFxuXHRcdHJldHVybiBpbXBvcnRlci5pbnN0YW5jZS5nZXRQcm9ncmVzcygpO1xuXHR9XG59KTtcbiIsImltcG9ydCB7IEltcG9ydGVycyB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmltcG9ydGVyJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHRzZXR1cEltcG9ydGVyKGtleSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywgeyBtZXRob2Q6ICdzZXR1cEltcG9ydGVyJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdydW4taW1wb3J0JykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdJbXBvcnRpbmcgaXMgbm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ3NldHVwSW1wb3J0ZXInfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW1wb3J0ZXIgPSBJbXBvcnRlcnMuZ2V0KGtleSk7XG5cblx0XHRpZiAoIWltcG9ydGVyKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oYFRyaWVkIHRvIHNldHVwICR7IG5hbWUgfSBhcyBhbiBpbXBvcnRlci5gKTtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWltcG9ydGVyLW5vdC1kZWZpbmVkJywgJ1RoZSBpbXBvcnRlciB3YXMgbm90IGRlZmluZWQgY29ycmVjdGx5LCBpdCBpcyBtaXNzaW5nIHRoZSBJbXBvcnQgY2xhc3MuJywgeyBtZXRob2Q6ICdzZXR1cEltcG9ydGVyJyB9KTtcblx0XHR9XG5cblx0XHRpZiAoaW1wb3J0ZXIuaW5zdGFuY2UpIHtcblx0XHRcdHJldHVybiBpbXBvcnRlci5pbnN0YW5jZS5nZXRQcm9ncmVzcygpO1xuXHRcdH1cblxuXHRcdGltcG9ydGVyLmluc3RhbmNlID0gbmV3IGltcG9ydGVyLmltcG9ydGVyKGltcG9ydGVyKTsgLy9lc2xpbnQtZGlzYWJsZS1saW5lIG5ldy1jYXBcblx0XHRyZXR1cm4gaW1wb3J0ZXIuaW5zdGFuY2UuZ2V0UHJvZ3Jlc3MoKTtcblx0fVxufSk7XG4iLCJpbXBvcnQge1xuXHRJbXBvcnRlcnMsXG5cdFNlbGVjdGlvbixcblx0U2VsZWN0aW9uQ2hhbm5lbCxcblx0U2VsZWN0aW9uVXNlclxufSBmcm9tICdtZXRlb3Ivcm9ja2V0Y2hhdDppbXBvcnRlcic7XG5cbk1ldGVvci5tZXRob2RzKHtcblx0c3RhcnRJbXBvcnQoa2V5LCBpbnB1dCkge1xuXHRcdC8vIFRha2VzIG5hbWUgYW5kIG9iamVjdCB3aXRoIHVzZXJzIC8gY2hhbm5lbHMgc2VsZWN0ZWQgdG8gaW1wb3J0XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ3N0YXJ0SW1wb3J0JyB9KTtcblx0XHR9XG5cblx0XHRpZiAoIVJvY2tldENoYXQuYXV0aHouaGFzUGVybWlzc2lvbihNZXRlb3IudXNlcklkKCksICdydW4taW1wb3J0JykpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWFjdGlvbi1ub3QtYWxsb3dlZCcsICdJbXBvcnRpbmcgaXMgbm90IGFsbG93ZWQnLCB7IG1ldGhvZDogJ3N0YXJ0SW1wb3J0J30pO1xuXHRcdH1cblxuXHRcdGlmICgha2V5KSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLWltcG9ydGVyJywgYE5vIGRlZmluZWQgaW1wb3J0ZXIgYnk6IFwiJHsga2V5IH1cImAsIHsgbWV0aG9kOiAnc3RhcnRJbXBvcnQnIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGltcG9ydGVyID0gSW1wb3J0ZXJzLmdldChrZXkpO1xuXG5cdFx0aWYgKCFpbXBvcnRlciB8fCAhaW1wb3J0ZXIuaW5zdGFuY2UpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWltcG9ydGVyLW5vdC1kZWZpbmVkJywgYFRoZSBpbXBvcnRlciAoJHsga2V5IH0pIGhhcyBubyBpbXBvcnQgY2xhc3MgZGVmaW5lZC5gLCB7IG1ldGhvZDogJ3N0YXJ0SW1wb3J0JyB9KTtcblx0XHR9XG5cblx0XHRjb25zdCB1c2Vyc1NlbGVjdGlvbiA9IGlucHV0LnVzZXJzLm1hcCh1c2VyID0+IG5ldyBTZWxlY3Rpb25Vc2VyKHVzZXIudXNlcl9pZCwgdXNlci51c2VybmFtZSwgdXNlci5lbWFpbCwgdXNlci5pc19kZWxldGVkLCB1c2VyLmlzX2JvdCwgdXNlci5kb19pbXBvcnQpKTtcblx0XHRjb25zdCBjaGFubmVsc1NlbGVjdGlvbiA9IGlucHV0LmNoYW5uZWxzLm1hcChjaGFubmVsID0+IG5ldyBTZWxlY3Rpb25DaGFubmVsKGNoYW5uZWwuY2hhbm5lbF9pZCwgY2hhbm5lbC5uYW1lLCBjaGFubmVsLmlzX2FyY2hpdmVkLCBjaGFubmVsLmRvX2ltcG9ydCkpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbihpbXBvcnRlci5uYW1lLCB1c2Vyc1NlbGVjdGlvbiwgY2hhbm5lbHNTZWxlY3Rpb24pO1xuXHRcdHJldHVybiBpbXBvcnRlci5pbnN0YW5jZS5zdGFydEltcG9ydChzZWxlY3Rpb24pO1xuXHR9XG59KTtcbiIsImltcG9ydCB7IEltcG9ydHMgfSBmcm9tICcuLi9tb2RlbHMvSW1wb3J0cyc7XG5pbXBvcnQgeyBSYXdJbXBvcnRzIH0gZnJvbSAnLi4vbW9kZWxzL1Jhd0ltcG9ydHMnO1xuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0Ly8gTWFrZSBzdXJlIGFsbCBpbXBvcnRzIGFyZSBtYXJrZWQgYXMgaW52YWxpZCwgZGF0YSBjbGVhbiB1cCBzaW5jZSB5b3UgY2FuJ3Rcblx0Ly8gcmVzdGFydCBhbiBpbXBvcnQgYXQgdGhlIG1vbWVudC5cblx0SW1wb3J0cy51cGRhdGUoeyB2YWxpZDogeyAkbmU6IGZhbHNlIH0gfSwgeyAkc2V0OiB7IHZhbGlkOiBmYWxzZSB9IH0sIHsgbXVsdGk6IHRydWUgfSk7XG5cblx0Ly8gQ2xlYW4gdXAgYWxsIHRoZSByYXcgaW1wb3J0IGRhdGEsIHNpbmNlIHlvdSBjYW4ndCByZXN0YXJ0IGFuIGltcG9ydCBhdCB0aGUgbW9tZW50XG5cdHRyeSB7XG5cdFx0UmF3SW1wb3J0cy5tb2RlbC5yYXdDb2xsZWN0aW9uKCkuZHJvcCgpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0Y29uc29sZS5sb2coJ2VycnJvcicsIGUpOyAvL1RPRE86IFJlbW92ZVxuXHRcdC8vIGlnbm9yZWRcblx0fVxufSk7XG4iLCJpbXBvcnQgeyBCYXNlIH0gZnJvbSAnLi9jbGFzc2VzL0ltcG9ydGVyQmFzZSc7XG5pbXBvcnQgeyBJbXBvcnRzIH0gZnJvbSAnLi9tb2RlbHMvSW1wb3J0cyc7XG5pbXBvcnQgeyBJbXBvcnRlcnMgfSBmcm9tICcuLi9saWIvSW1wb3J0ZXJzJztcbmltcG9ydCB7IEltcG9ydGVySW5mbyB9IGZyb20gJy4uL2xpYi9JbXBvcnRlckluZm8nO1xuaW1wb3J0IHsgSW1wb3J0ZXJXZWJzb2NrZXQgfSBmcm9tICcuL2NsYXNzZXMvSW1wb3J0ZXJXZWJzb2NrZXQnO1xuaW1wb3J0IHsgUHJvZ3Jlc3MgfSBmcm9tICcuL2NsYXNzZXMvSW1wb3J0ZXJQcm9ncmVzcyc7XG5pbXBvcnQgeyBQcm9ncmVzc1N0ZXAgfSBmcm9tICcuLi9saWIvSW1wb3J0ZXJQcm9ncmVzc1N0ZXAnO1xuaW1wb3J0IHsgUmF3SW1wb3J0cyB9IGZyb20gJy4vbW9kZWxzL1Jhd0ltcG9ydHMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi9jbGFzc2VzL0ltcG9ydGVyU2VsZWN0aW9uJztcbmltcG9ydCB7IFNlbGVjdGlvbkNoYW5uZWwgfSBmcm9tICcuL2NsYXNzZXMvSW1wb3J0ZXJTZWxlY3Rpb25DaGFubmVsJztcbmltcG9ydCB7IFNlbGVjdGlvblVzZXIgfSBmcm9tICcuL2NsYXNzZXMvSW1wb3J0ZXJTZWxlY3Rpb25Vc2VyJztcblxuZXhwb3J0IHtcblx0QmFzZSxcblx0SW1wb3J0cyxcblx0SW1wb3J0ZXJzLFxuXHRJbXBvcnRlckluZm8sXG5cdEltcG9ydGVyV2Vic29ja2V0LFxuXHRQcm9ncmVzcyxcblx0UHJvZ3Jlc3NTdGVwLFxuXHRSYXdJbXBvcnRzLFxuXHRTZWxlY3Rpb24sXG5cdFNlbGVjdGlvbkNoYW5uZWwsXG5cdFNlbGVjdGlvblVzZXJcbn07XG4iLCJleHBvcnQgY2xhc3MgSW1wb3J0ZXJJbmZvIHtcblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgY2xhc3Mgd2hpY2ggY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGltcG9ydGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSB1bmlxdWUga2V5IG9mIHRoaXMgaW1wb3J0ZXIuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBpMThuIG5hbWUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtaW1lVHlwZSBUaGUgdHlwZSBvZiBmaWxlIGl0IGV4cGVjdHMuXG5cdCAqIEBwYXJhbSB7eyBocmVmOiBzdHJpbmcsIHRleHQ6IHN0cmluZyB9W119IHdhcm5pbmdzIEFuIGFycmF5IG9mIHdhcm5pbmcgb2JqZWN0cy4gYHsgaHJlZiwgdGV4dCB9YFxuXHQgKi9cblx0Y29uc3RydWN0b3Ioa2V5LCBuYW1lID0gJycsIG1pbWVUeXBlID0gJycsIHdhcm5pbmdzID0gW10pIHtcblx0XHR0aGlzLmtleSA9IGtleTtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMubWltZVR5cGUgPSBtaW1lVHlwZTtcblx0XHR0aGlzLndhcm5pbmdzID0gd2FybmluZ3M7XG5cblx0XHR0aGlzLmltcG9ydGVyID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuaW5zdGFuY2UgPSB1bmRlZmluZWQ7XG5cdH1cbn1cbiIsIi8qKiBUaGUgcHJvZ3Jlc3Mgc3RlcCB0aGF0IGFuIGltcG9ydGVyIGlzIGF0LiAqL1xuZXhwb3J0IGNvbnN0IFByb2dyZXNzU3RlcCA9IE9iamVjdC5mcmVlemUoe1xuXHRORVc6ICdpbXBvcnRlcl9uZXcnLFxuXHRQUkVQQVJJTkdfU1RBUlRFRDogJ2ltcG9ydGVyX3ByZXBhcmluZ19zdGFydGVkJyxcblx0UFJFUEFSSU5HX1VTRVJTOiAnaW1wb3J0ZXJfcHJlcGFyaW5nX3VzZXJzJyxcblx0UFJFUEFSSU5HX0NIQU5ORUxTOiAnaW1wb3J0ZXJfcHJlcGFyaW5nX2NoYW5uZWxzJyxcblx0UFJFUEFSSU5HX01FU1NBR0VTOiAnaW1wb3J0ZXJfcHJlcGFyaW5nX21lc3NhZ2VzJyxcblx0VVNFUl9TRUxFQ1RJT046ICdpbXBvcnRlcl91c2VyX3NlbGVjdGlvbicsXG5cdElNUE9SVElOR19TVEFSVEVEOiAnaW1wb3J0ZXJfaW1wb3J0aW5nX3N0YXJ0ZWQnLFxuXHRJTVBPUlRJTkdfVVNFUlM6ICdpbXBvcnRlcl9pbXBvcnRpbmdfdXNlcnMnLFxuXHRJTVBPUlRJTkdfQ0hBTk5FTFM6ICdpbXBvcnRlcl9pbXBvcnRpbmdfY2hhbm5lbHMnLFxuXHRJTVBPUlRJTkdfTUVTU0FHRVM6ICdpbXBvcnRlcl9pbXBvcnRpbmdfbWVzc2FnZXMnLFxuXHRGSU5JU0hJTkc6ICdpbXBvcnRlcl9maW5pc2hpbmcnLFxuXHRET05FOiAnaW1wb3J0ZXJfZG9uZScsXG5cdEVSUk9SOiAnaW1wb3J0ZXJfaW1wb3J0X2ZhaWxlZCcsXG5cdENBTkNFTExFRDogJ2ltcG9ydGVyX2ltcG9ydF9jYW5jZWxsZWQnXG59KTtcbiIsImltcG9ydCB7IEltcG9ydGVySW5mbyB9IGZyb20gJy4vSW1wb3J0ZXJJbmZvJztcblxuLyoqIENvbnRhaW5lciBjbGFzcyB3aGljaCBob2xkcyBhbGwgb2YgdGhlIGltcG9ydGVyIGRldGFpbHMuICovXG5jbGFzcyBJbXBvcnRlcnNDb250YWluZXIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLmltcG9ydGVycyA9IG5ldyBNYXAoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIGFuIGltcG9ydGVyIHRvIHRoZSBpbXBvcnQgY29sbGVjdGlvbi4gQWRkaW5nIGl0IG1vcmUgdGhhbiBvbmNlIHdpbGxcblx0ICogb3ZlcndyaXRlIHRoZSBwcmV2aW91cyBvbmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SW1wb3J0ZXJJbmZvfSBpbmZvIFRoZSBpbmZvcm1hdGlvbiByZWxhdGVkIHRvIHRoZSBpbXBvcnRlci5cblx0ICogQHBhcmFtIHsqfSBpbXBvcnRlciBUaGUgY2xhc3MgZm9yIHRoZSBpbXBvcnRlciwgd2lsbCBiZSB1bmRlZmluZWQgb24gdGhlIGNsaWVudC5cblx0ICovXG5cdGFkZChpbmZvLCBpbXBvcnRlcikge1xuXHRcdGlmICghKGluZm8gaW5zdGFuY2VvZiBJbXBvcnRlckluZm8pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBpbXBvcnRlciBtdXN0IGJlIGEgdmFsaWQgSW1wb3J0ZXJJbmZvIGluc3RhbmNlLicpO1xuXHRcdH1cblxuXHRcdGluZm8uaW1wb3J0ZXIgPSBpbXBvcnRlcjtcblxuXHRcdHRoaXMuaW1wb3J0ZXJzLnNldChpbmZvLmtleSwgaW5mbyk7XG5cblx0XHRyZXR1cm4gdGhpcy5pbXBvcnRlcnMuZ2V0KGluZm8ua2V5KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBpbXBvcnRlciBpbmZvcm1hdGlvbiB0aGF0IGlzIHN0b3JlZC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBpbXBvcnRlci5cblx0ICovXG5cdGdldChrZXkpIHtcblx0XHRyZXR1cm4gdGhpcy5pbXBvcnRlcnMuZ2V0KGtleSk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0cyBhbGwgb2YgdGhlIGltcG9ydGVycyBpbiBhcnJheSBmb3JtYXQuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtJbXBvcnRlckluZm9bXX0gVGhlIGFycmF5IG9mIGltcG9ydGVyIGluZm9ybWF0aW9uLlxuXHQgKi9cblx0Z2V0QWxsKCkge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuaW1wb3J0ZXJzLnZhbHVlcygpKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgSW1wb3J0ZXJzID0gbmV3IEltcG9ydGVyc0NvbnRhaW5lcigpO1xuIl19
