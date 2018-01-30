(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var CollectionHooks = Package['matb33:collection-hooks'].CollectionHooks;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var _ = Package.underscore._;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var extension, options, path;

var require = meteorInstall({"node_modules":{"meteor":{"jalik:ufs":{"ufs.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs.js                                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
const module1 = module;
module1.export({
    UploadFS: () => UploadFS
});

let _;

module1.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let Meteor;
module1.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 1);
let Mongo;
module1.watch(require("meteor/mongo"), {
    Mongo(v) {
        Mongo = v;
    }

}, 2);
let MIME;
module1.watch(require("./ufs-mime"), {
    MIME(v) {
        MIME = v;
    }

}, 3);
let Random;
module1.watch(require("meteor/random"), {
    Random(v) {
        Random = v;
    }

}, 4);
let Tokens;
module1.watch(require("./ufs-tokens"), {
    Tokens(v) {
        Tokens = v;
    }

}, 5);
let Config;
module1.watch(require("./ufs-config"), {
    Config(v) {
        Config = v;
    }

}, 6);
let Filter;
module1.watch(require("./ufs-filter"), {
    Filter(v) {
        Filter = v;
    }

}, 7);
let Store;
module1.watch(require("./ufs-store"), {
    Store(v) {
        Store = v;
    }

}, 8);
let StorePermissions;
module1.watch(require("./ufs-store-permissions"), {
    StorePermissions(v) {
        StorePermissions = v;
    }

}, 9);
let Uploader;
module1.watch(require("./ufs-uploader"), {
    Uploader(v) {
        Uploader = v;
    }

}, 10);
let stores = {};
const UploadFS = {
    /**
     * Contains all stores
     */store: {},
    /**
     * Collection of tokens
     */tokens: Tokens,

    /**
     * Adds the "etag" attribute to files
     * @param where
     */addETagAttributeToFiles(where) {
        _.each(this.getStores(), store => {
            const files = store.getCollection(); // By default update only files with no path set

            files.find(where || {
                etag: null
            }, {
                fields: {
                    _id: 1
                }
            }).forEach(file => {
                files.direct.update(file._id, {
                    $set: {
                        etag: this.generateEtag()
                    }
                });
            });
        });
    },

    /**
     * Adds the MIME type for an extension
     * @param extension
     * @param mime
     */addMimeType(extension, mime) {
        MIME[extension.toLowerCase()] = mime;
    },

    /**
     * Adds the "path" attribute to files
     * @param where
     */addPathAttributeToFiles(where) {
        _.each(this.getStores(), store => {
            const files = store.getCollection(); // By default update only files with no path set

            files.find(where || {
                path: null
            }, {
                fields: {
                    _id: 1
                }
            }).forEach(file => {
                files.direct.update(file._id, {
                    $set: {
                        path: store.getFileRelativeURL(file._id)
                    }
                });
            });
        });
    },

    /**
     * Registers the store
     * @param store
     */addStore(store) {
        if (!(store instanceof Store)) {
            throw new TypeError(`ufs: store is not an instance of UploadFS.Store.`);
        }

        stores[store.getName()] = store;
    },

    /**
     * Generates a unique ETag
     * @return {string}
     */generateEtag() {
        return Random.id();
    },

    /**
     * Returns the MIME type of the extension
     * @param extension
     * @returns {*}
     */getMimeType(extension) {
        extension = extension.toLowerCase();
        return MIME[extension];
    },

    /**
     * Returns all MIME types
     */getMimeTypes() {
        return MIME;
    },

    /**
     * Returns the store by its name
     * @param name
     * @return {UploadFS.Store}
     */getStore(name) {
        return stores[name];
    },

    /**
     * Returns all stores
     * @return {object}
     */getStores() {
        return stores;
    },

    /**
     * Returns the temporary file path
     * @param fileId
     * @return {string}
     */getTempFilePath(fileId) {
        return `${this.config.tmpDir}/${fileId}`;
    },

    /**
     * Imports a file from a URL
     * @param url
     * @param file
     * @param store
     * @param callback
     */importFromURL(url, file, store, callback) {
        if (typeof store === 'string') {
            Meteor.call('ufsImportURL', url, file, store, callback);
        } else if (typeof store === 'object') {
            store.importFromURL(url, file, callback);
        }
    },

    /**
     * Returns file and data as ArrayBuffer for each files in the event
     * @deprecated
     * @param event
     * @param callback
     */readAsArrayBuffer(event, callback) {
        console.error('UploadFS.readAsArrayBuffer is deprecated, see https://github.com/jalik/jalik-ufs#uploading-from-a-file');
    },

    /**
     * Opens a dialog to select a single file
     * @param callback
     */selectFile(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = false;

        input.onchange = ev => {
            let files = ev.target.files;
            callback.call(UploadFS, files[0]);
        }; // Fix for iOS/Safari


        const div = document.createElement('div');
        div.className = 'ufs-file-selector';
        div.style = 'display:none; height:0; width:0; overflow: hidden;';
        div.appendChild(input);
        document.body.appendChild(div); // Trigger file selection

        input.click();
    },

    /**
     * Opens a dialog to select multiple files
     * @param callback
     */selectFiles(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;

        input.onchange = ev => {
            const files = ev.target.files;

            for (let i = 0; i < files.length; i += 1) {
                callback.call(UploadFS, files[i]);
            }
        }; // Fix for iOS/Safari


        const div = document.createElement('div');
        div.className = 'ufs-file-selector';
        div.style = 'display:none; height:0; width:0; overflow: hidden;';
        div.appendChild(input);
        document.body.appendChild(div); // Trigger file selection

        input.click();
    }

};

if (Meteor.isClient) {
    require('./ufs-template-helpers');
}

if (Meteor.isServer) {
    require('./ufs-methods');

    require('./ufs-server');
} /**
   * UploadFS Configuration
   * @type {Config}
   */

UploadFS.config = new Config(); // Add classes to global namespace

UploadFS.Config = Config;
UploadFS.Filter = Filter;
UploadFS.Store = Store;
UploadFS.StorePermissions = StorePermissions;
UploadFS.Uploader = Uploader;

if (Meteor.isServer) {
    // Expose the module globally
    if (typeof global !== 'undefined') {
        global['UploadFS'] = UploadFS;
    }
} else if (Meteor.isClient) {
    // Expose the module globally
    if (typeof window !== 'undefined') {
        window.UploadFS = UploadFS;
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-config.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-config.js                                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
    Config: () => Config
});

let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let Meteor;
module.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 1);
let StorePermissions;
module.watch(require("./ufs-store-permissions"), {
    StorePermissions(v) {
        StorePermissions = v;
    }

}, 2);

class Config {
    constructor(options) {
        // Default options
        options = _.extend({
            defaultStorePermissions: null,
            https: false,
            simulateReadDelay: 0,
            simulateUploadSpeed: 0,
            simulateWriteDelay: 0,
            storesPath: 'ufs',
            tmpDir: '/tmp/ufs',
            tmpDirPermissions: '0700'
        }, options); // Check options

        if (options.defaultStorePermissions && !(options.defaultStorePermissions instanceof StorePermissions)) {
            throw new TypeError('Config: defaultStorePermissions is not an instance of StorePermissions');
        }

        if (typeof options.https !== 'boolean') {
            throw new TypeError('Config: https is not a function');
        }

        if (typeof options.simulateReadDelay !== 'number') {
            throw new TypeError('Config: simulateReadDelay is not a number');
        }

        if (typeof options.simulateUploadSpeed !== 'number') {
            throw new TypeError('Config: simulateUploadSpeed is not a number');
        }

        if (typeof options.simulateWriteDelay !== 'number') {
            throw new TypeError('Config: simulateWriteDelay is not a number');
        }

        if (typeof options.storesPath !== 'string') {
            throw new TypeError('Config: storesPath is not a string');
        }

        if (typeof options.tmpDir !== 'string') {
            throw new TypeError('Config: tmpDir is not a string');
        }

        if (typeof options.tmpDirPermissions !== 'string') {
            throw new TypeError('Config: tmpDirPermissions is not a string');
        } /**
           * Default store permissions
           * @type {UploadFS.StorePermissions}
           */

        this.defaultStorePermissions = options.defaultStorePermissions; /**
                                                                         * Use or not secured protocol in URLS
                                                                         * @type {boolean}
                                                                         */
        this.https = options.https; /**
                                     * The simulation read delay
                                     * @type {Number}
                                     */
        this.simulateReadDelay = parseInt(options.simulateReadDelay); /**
                                                                       * The simulation upload speed
                                                                       * @type {Number}
                                                                       */
        this.simulateUploadSpeed = parseInt(options.simulateUploadSpeed); /**
                                                                           * The simulation write delay
                                                                           * @type {Number}
                                                                           */
        this.simulateWriteDelay = parseInt(options.simulateWriteDelay); /**
                                                                         * The URL root path of stores
                                                                         * @type {string}
                                                                         */
        this.storesPath = options.storesPath; /**
                                               * The temporary directory of uploading files
                                               * @type {string}
                                               */
        this.tmpDir = options.tmpDir; /**
                                       * The permissions of the temporary directory
                                       * @type {string}
                                       */
        this.tmpDirPermissions = options.tmpDirPermissions;
    }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-filter.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-filter.js                                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
    Filter: () => Filter
});

let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let Meteor;
module.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 1);

class Filter {
    constructor(options) {
        const self = this; // Default options

        options = _.extend({
            contentTypes: null,
            extensions: null,
            minSize: 1,
            maxSize: 0,
            onCheck: this.onCheck
        }, options); // Check options

        if (options.contentTypes && !(options.contentTypes instanceof Array)) {
            throw new TypeError("Filter: contentTypes is not an Array");
        }

        if (options.extensions && !(options.extensions instanceof Array)) {
            throw new TypeError("Filter: extensions is not an Array");
        }

        if (typeof options.minSize !== "number") {
            throw new TypeError("Filter: minSize is not a number");
        }

        if (typeof options.maxSize !== "number") {
            throw new TypeError("Filter: maxSize is not a number");
        }

        if (options.onCheck && typeof options.onCheck !== "function") {
            throw new TypeError("Filter: onCheck is not a function");
        } // Public attributes


        self.options = options;

        _.each(['onCheck'], method => {
            if (typeof options[method] === 'function') {
                self[method] = options[method];
            }
        });
    } /**
       * Checks the file
       * @param file
       */

    check(file) {
        if (typeof file !== "object" || !file) {
            throw new Meteor.Error('invalid-file', "File is not valid");
        } // Check size


        if (file.size <= 0 || file.size < this.getMinSize()) {
            throw new Meteor.Error('file-too-small', `File size is too small (min = ${this.getMinSize()})`);
        }

        if (this.getMaxSize() > 0 && file.size > this.getMaxSize()) {
            throw new Meteor.Error('file-too-large', `File size is too large (max = ${this.getMaxSize()})`);
        } // Check extension


        if (this.getExtensions() && !_.contains(this.getExtensions(), file.extension)) {
            throw new Meteor.Error('invalid-file-extension', `File extension "${file.extension}" is not accepted`);
        } // Check content type


        if (this.getContentTypes() && !this.isContentTypeInList(file.type, this.getContentTypes())) {
            throw new Meteor.Error('invalid-file-type', `File type "${file.type}" is not accepted`);
        } // Apply custom check


        if (typeof this.onCheck === 'function' && !this.onCheck(file)) {
            throw new Meteor.Error('invalid-file', "File does not match filter");
        }
    } /**
       * Returns the allowed content types
       * @return {Array}
       */

    getContentTypes() {
        return this.options.contentTypes;
    } /**
       * Returns the allowed extensions
       * @return {Array}
       */

    getExtensions() {
        return this.options.extensions;
    } /**
       * Returns the maximum file size
       * @return {Number}
       */

    getMaxSize() {
        return this.options.maxSize;
    } /**
       * Returns the minimum file size
       * @return {Number}
       */

    getMinSize() {
        return this.options.minSize;
    } /**
       * Checks if content type is in the given list
       * @param type
       * @param list
       * @return {boolean}
       */

    isContentTypeInList(type, list) {
        if (typeof type === 'string' && list instanceof Array) {
            if (_.contains(list, type)) {
                return true;
            } else {
                let wildCardGlob = '/*';

                let wildcards = _.filter(list, item => {
                    return item.indexOf(wildCardGlob) > 0;
                });

                if (_.contains(wildcards, type.replace(/(\/.*)$/, wildCardGlob))) {
                    return true;
                }
            }
        }

        return false;
    } /**
       * Checks if the file matches filter
       * @param file
       * @return {boolean}
       */

    isValid(file) {
        let result = true;

        try {
            this.check(file);
        } catch (err) {
            result = false;
        }

        return result;
    } /**
       * Executes custom checks
       * @param file
       * @return {boolean}
       */

    onCheck(file) {
        return true;
    }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-methods.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-methods.js                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let check;
module.watch(require("meteor/check"), {
    check(v) {
        check = v;
    }

}, 1);
let Meteor;
module.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 2);
let UploadFS;
module.watch(require("./ufs"), {
    UploadFS(v) {
        UploadFS = v;
    }

}, 3);
let Filter;
module.watch(require("./ufs-filter"), {
    Filter(v) {
        Filter = v;
    }

}, 4);
let Tokens;
module.watch(require("./ufs-tokens"), {
    Tokens(v) {
        Tokens = v;
    }

}, 5);

const fs = Npm.require('fs');

const http = Npm.require('http');

const https = Npm.require('https');

const Future = Npm.require('fibers/future');

if (Meteor.isServer) {
    Meteor.methods({
        /**
         * Completes the file transfer
         * @param fileId
         * @param storeName
         * @param token
         */ufsComplete(fileId, storeName, token) {
            check(fileId, String);
            check(storeName, String);
            check(token, String); // Get store

            let store = UploadFS.getStore(storeName);

            if (!store) {
                throw new Meteor.Error('invalid-store', "Store not found");
            } // Check token


            if (!store.checkToken(token, fileId)) {
                throw new Meteor.Error('invalid-token', "Token is not valid");
            }

            let fut = new Future();
            let tmpFile = UploadFS.getTempFilePath(fileId);

            const removeTempFile = function () {
                fs.unlink(tmpFile, function (err) {
                    err && console.error(`ufs: cannot delete temp file "${tmpFile}" (${err.message})`);
                });
            };

            try {
                // todo check if temp file exists
                // Get file
                let file = store.getCollection().findOne({
                    _id: fileId
                }); // Validate file before moving to the store

                store.validate(file); // Get the temp file

                let rs = fs.createReadStream(tmpFile, {
                    flags: 'r',
                    encoding: null,
                    autoClose: true
                }); // Clean upload if error occurs

                rs.on('error', Meteor.bindEnvironment(function (err) {
                    console.error(err);
                    store.getCollection().remove({
                        _id: fileId
                    });
                    fut.throw(err);
                })); // Save file in the store

                store.write(rs, fileId, Meteor.bindEnvironment(function (err, file) {
                    removeTempFile();

                    if (err) {
                        fut.throw(err);
                    } else {
                        // File has been fully uploaded
                        // so we don't need to keep the token anymore.
                        // Also this ensure that the file cannot be modified with extra chunks later.
                        Tokens.remove({
                            fileId: fileId
                        });
                        fut.return(file);
                    }
                }));
            } catch (err) {
                // If write failed, remove the file
                store.getCollection().remove({
                    _id: fileId
                }); // removeTempFile();

                fut.throw(err);
            }

            return fut.wait();
        },

        /**
         * Creates the file and returns the file upload token
         * @param file
         * @return {{fileId: string, token: *, url: *}}
         */ufsCreate(file) {
            check(file, Object);

            if (typeof file.name !== 'string' || !file.name.length) {
                throw new Meteor.Error('invalid-file-name', "file name is not valid");
            }

            if (typeof file.store !== 'string' || !file.store.length) {
                throw new Meteor.Error('invalid-store', "store is not valid");
            } // Get store


            let store = UploadFS.getStore(file.store);

            if (!store) {
                throw new Meteor.Error('invalid-store', "Store not found");
            } // Set default info


            file.complete = false;
            file.uploading = false;
            file.extension = file.name && file.name.substr((~-file.name.lastIndexOf('.') >>> 0) + 2).toLowerCase(); // Assign file MIME type based on the extension

            if (file.extension && !file.type) {
                file.type = UploadFS.getMimeType(file.extension) || 'application/octet-stream';
            }

            file.progress = 0;
            file.size = parseInt(file.size) || 0;
            file.userId = file.userId || this.userId; // Check if the file matches store filter

            let filter = store.getFilter();

            if (filter instanceof Filter) {
                filter.check(file);
            } // Create the file


            let fileId = store.create(file);
            let token = store.createToken(fileId);
            let uploadUrl = store.getURL(`${fileId}?token=${token}`);
            return {
                fileId: fileId,
                token: token,
                url: uploadUrl
            };
        },

        /**
         * Deletes a file
         * @param fileId
         * @param storeName
         * @param token
         * @returns {*}
         */ufsDelete(fileId, storeName, token) {
            check(fileId, String);
            check(storeName, String);
            check(token, String); // Check store

            let store = UploadFS.getStore(storeName);

            if (!store) {
                throw new Meteor.Error('invalid-store', "Store not found");
            } // Ignore files that does not exist


            if (store.getCollection().find({
                _id: fileId
            }).count() === 0) {
                return 1;
            } // Check token


            if (!store.checkToken(token, fileId)) {
                throw new Meteor.Error('invalid-token', "Token is not valid");
            }

            return store.getCollection().remove({
                _id: fileId
            });
        },

        /**
         * Imports a file from the URL
         * @param url
         * @param file
         * @param storeName
         * @return {*}
         */ufsImportURL(url, file, storeName) {
            check(url, String);
            check(file, Object);
            check(storeName, String); // Check URL

            if (typeof url !== 'string' || url.length <= 0) {
                throw new Meteor.Error('invalid-url', "The url is not valid");
            } // Check file


            if (typeof file !== 'object' || file === null) {
                throw new Meteor.Error('invalid-file', "The file is not valid");
            } // Check store


            const store = UploadFS.getStore(storeName);

            if (!store) {
                throw new Meteor.Error('invalid-store', 'The store does not exist');
            } // Extract file info


            if (!file.name) {
                file.name = url.replace(/\?.*$/, '').split('/').pop();
            }

            if (file.name && !file.extension) {
                file.extension = file.name && file.name.substr((~-file.name.lastIndexOf('.') >>> 0) + 2).toLowerCase();
            }

            if (file.extension && !file.type) {
                // Assign file MIME type based on the extension
                file.type = UploadFS.getMimeType(file.extension) || 'application/octet-stream';
            } // Check if file is valid


            if (store.getFilter() instanceof Filter) {
                store.getFilter().check(file);
            }

            if (file.originalUrl) {
                console.warn(`ufs: The "originalUrl" attribute is automatically set when importing a file from a URL`);
            } // Add original URL


            file.originalUrl = url; // Create the file

            file.complete = false;
            file.uploading = true;
            file.progress = 0;
            file._id = store.create(file);
            let fut = new Future();
            let proto; // Detect protocol to use

            if (/http:\/\//i.test(url)) {
                proto = http;
            } else if (/https:\/\//i.test(url)) {
                proto = https;
            }

            this.unblock(); // Download file

            proto.get(url, Meteor.bindEnvironment(function (res) {
                // Save the file in the store
                store.write(res, file._id, function (err, file) {
                    if (err) {
                        fut.throw(err);
                    } else {
                        fut.return(file);
                    }
                });
            })).on('error', function (err) {
                fut.throw(err);
            });
            return fut.wait();
        },

        /**
         * Marks the file uploading as stopped
         * @param fileId
         * @param storeName
         * @param token
         * @returns {*}
         */ufsStop(fileId, storeName, token) {
            check(fileId, String);
            check(storeName, String);
            check(token, String); // Check store

            const store = UploadFS.getStore(storeName);

            if (!store) {
                throw new Meteor.Error('invalid-store', "Store not found");
            } // Check file


            const file = store.getCollection().find({
                _id: fileId
            }, {
                fields: {
                    userId: 1
                }
            });

            if (!file) {
                throw new Meteor.Error('invalid-file', "File not found");
            } // Check token


            if (!store.checkToken(token, fileId)) {
                throw new Meteor.Error('invalid-token', "Token is not valid");
            }

            return store.getCollection().update({
                _id: fileId
            }, {
                $set: {
                    uploading: false
                }
            });
        }

    });
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-mime.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-mime.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
    MIME: () => MIME
});
const MIME = {
    // application
    '7z': 'application/x-7z-compressed',
    'arc': 'application/octet-stream',
    'ai': 'application/postscript',
    'bin': 'application/octet-stream',
    'bz': 'application/x-bzip',
    'bz2': 'application/x-bzip2',
    'eps': 'application/postscript',
    'exe': 'application/octet-stream',
    'gz': 'application/x-gzip',
    'gzip': 'application/x-gzip',
    'js': 'application/javascript',
    'json': 'application/json',
    'ogx': 'application/ogg',
    'pdf': 'application/pdf',
    'ps': 'application/postscript',
    'psd': 'application/octet-stream',
    'rar': 'application/x-rar-compressed',
    'rev': 'application/x-rar-compressed',
    'swf': 'application/x-shockwave-flash',
    'tar': 'application/x-tar',
    'xhtml': 'application/xhtml+xml',
    'xml': 'application/xml',
    'zip': 'application/zip',
    // audio
    'aif': 'audio/aiff',
    'aifc': 'audio/aiff',
    'aiff': 'audio/aiff',
    'au': 'audio/basic',
    'flac': 'audio/flac',
    'midi': 'audio/midi',
    'mp2': 'audio/mpeg',
    'mp3': 'audio/mpeg',
    'mpa': 'audio/mpeg',
    'oga': 'audio/ogg',
    'ogg': 'audio/ogg',
    'opus': 'audio/ogg',
    'ra': 'audio/vnd.rn-realaudio',
    'spx': 'audio/ogg',
    'wav': 'audio/x-wav',
    'weba': 'audio/webm',
    'wma': 'audio/x-ms-wma',
    // image
    'avs': 'image/avs-video',
    'bmp': 'image/x-windows-bmp',
    'gif': 'image/gif',
    'ico': 'image/vnd.microsoft.icon',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpg',
    'mjpg': 'image/x-motion-jpeg',
    'pic': 'image/pic',
    'png': 'image/png',
    'svg': 'image/svg+xml',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    // text
    'css': 'text/css',
    'csv': 'text/csv',
    'html': 'text/html',
    'txt': 'text/plain',
    // video
    'avi': 'video/avi',
    'dv': 'video/x-dv',
    'flv': 'video/x-flv',
    'mov': 'video/quicktime',
    'mp4': 'video/mp4',
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpg',
    'ogv': 'video/ogg',
    'vdo': 'video/vdo',
    'webm': 'video/webm',
    'wmv': 'video/x-ms-wmv',
    // specific to vendors
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'odb': 'application/vnd.oasis.opendocument.database',
    'odc': 'application/vnd.oasis.opendocument.chart',
    'odf': 'application/vnd.oasis.opendocument.formula',
    'odg': 'application/vnd.oasis.opendocument.graphics',
    'odi': 'application/vnd.oasis.opendocument.image',
    'odm': 'application/vnd.oasis.opendocument.text-master',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odt': 'application/vnd.oasis.opendocument.text',
    'otg': 'application/vnd.oasis.opendocument.graphics-template',
    'otp': 'application/vnd.oasis.opendocument.presentation-template',
    'ots': 'application/vnd.oasis.opendocument.spreadsheet-template',
    'ott': 'application/vnd.oasis.opendocument.text-template',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-server.js                                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let Meteor;
module.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 1);
let WebApp;
module.watch(require("meteor/webapp"), {
    WebApp(v) {
        WebApp = v;
    }

}, 2);
let UploadFS;
module.watch(require("./ufs"), {
    UploadFS(v) {
        UploadFS = v;
    }

}, 3);

if (Meteor.isServer) {
    const domain = Npm.require('domain');

    const fs = Npm.require('fs');

    const http = Npm.require('http');

    const https = Npm.require('https');

    const mkdirp = Npm.require('mkdirp');

    const stream = Npm.require('stream');

    const URL = Npm.require('url');

    const zlib = Npm.require('zlib');

    Meteor.startup(() => {
        let path = UploadFS.config.tmpDir;
        let mode = UploadFS.config.tmpDirPermissions;
        fs.stat(path, err => {
            if (err) {
                // Create the temp directory
                mkdirp(path, {
                    mode: mode
                }, err => {
                    if (err) {
                        console.error(`ufs: cannot create temp directory at "${path}" (${err.message})`);
                    } else {
                        console.log(`ufs: temp directory created at "${path}"`);
                    }
                });
            } else {
                // Set directory permissions
                fs.chmod(path, mode, err => {
                    err && console.error(`ufs: cannot set temp directory permissions ${mode} (${err.message})`);
                });
            }
        });
    }); // Create domain to handle errors
    // and possibly avoid server crashes.

    let d = domain.create();
    d.on('error', err => {
        console.error('ufs: ' + err.message);
    }); // Listen HTTP requests to serve files

    WebApp.connectHandlers.use((req, res, next) => {
        // Quick check to see if request should be catch
        if (req.url.indexOf(UploadFS.config.storesPath) === -1) {
            next();
            return;
        } // Remove store path


        let parsedUrl = URL.parse(req.url);
        let path = parsedUrl.pathname.substr(UploadFS.config.storesPath.length + 1);

        let allowCORS = () => {
            // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            res.setHeader("Access-Control-Allow-Methods", "POST");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        };

        if (req.method === "OPTIONS") {
            let regExp = new RegExp('^\/([^\/\?]+)\/([^\/\?]+)$');
            let match = regExp.exec(path); // Request is not valid

            if (match === null) {
                res.writeHead(400);
                res.end();
                return;
            } // Get store


            let store = UploadFS.getStore(match[1]);

            if (!store) {
                res.writeHead(404);
                res.end();
                return;
            } // If a store is found, go ahead and allow the origin


            allowCORS();
            next();
        } else if (req.method === 'POST') {
            // Get store
            let regExp = new RegExp('^\/([^\/\?]+)\/([^\/\?]+)$');
            let match = regExp.exec(path); // Request is not valid

            if (match === null) {
                res.writeHead(400);
                res.end();
                return;
            } // Get store


            let store = UploadFS.getStore(match[1]);

            if (!store) {
                res.writeHead(404);
                res.end();
                return;
            } // If a store is found, go ahead and allow the origin


            allowCORS(); // Get file

            let fileId = match[2];

            if (store.getCollection().find({
                _id: fileId
            }).count() === 0) {
                res.writeHead(404);
                res.end();
                return;
            } // Check upload token


            if (!store.checkToken(req.query.token, fileId)) {
                res.writeHead(403);
                res.end();
                return;
            }

            let tmpFile = UploadFS.getTempFilePath(fileId);
            let ws = fs.createWriteStream(tmpFile, {
                flags: 'a'
            });
            let fields = {
                uploading: true
            };
            let progress = parseFloat(req.query.progress);

            if (!isNaN(progress) && progress > 0) {
                fields.progress = Math.min(progress, 1);
            }

            req.on('data', chunk => {
                ws.write(chunk);
            });
            req.on('error', err => {
                res.writeHead(500);
                res.end();
            });
            req.on('end', Meteor.bindEnvironment(() => {
                // Update completed state without triggering hooks
                store.getCollection().direct.update({
                    _id: fileId
                }, {
                    $set: fields
                });
                ws.end();
            }));
            ws.on('error', err => {
                console.error(`ufs: cannot write chunk of file "${fileId}" (${err.message})`);
                fs.unlink(tmpFile, err => {
                    err && console.error(`ufs: cannot delete temp file "${tmpFile}" (${err.message})`);
                });
                res.writeHead(500);
                res.end();
            });
            ws.on('finish', () => {
                res.writeHead(204, {
                    "Content-Type": 'text/plain'
                });
                res.end();
            });
        } else if (req.method == 'GET') {
            // Get store, file Id and file name
            let regExp = new RegExp('^\/([^\/\?]+)\/([^\/\?]+)(?:\/([^\/\?]+))?$');
            let match = regExp.exec(path); // Avoid 504 Gateway timeout error
            // if file is not handled by UploadFS.

            if (match === null) {
                next();
                return;
            } // Get store


            const storeName = match[1];
            const store = UploadFS.getStore(storeName);

            if (!store) {
                res.writeHead(404);
                res.end();
                return;
            }

            if (store.onRead !== null && store.onRead !== undefined && typeof store.onRead !== 'function') {
                console.error(`ufs: Store.onRead is not a function in store "${storeName}"`);
                res.writeHead(500);
                res.end();
                return;
            } // Remove file extension from file Id


            let index = match[2].indexOf('.');
            let fileId = index !== -1 ? match[2].substr(0, index) : match[2]; // Get file from database

            const file = store.getCollection().findOne({
                _id: fileId
            });

            if (!file) {
                res.writeHead(404);
                res.end();
                return;
            } // Simulate read speed


            if (UploadFS.config.simulateReadDelay) {
                Meteor._sleepForMs(UploadFS.config.simulateReadDelay);
            }

            d.run(() => {
                // Check if the file can be accessed
                if (store.onRead.call(store, fileId, file, req, res) !== false) {
                    let options = {};
                    let status = 200; // Prepare response headers

                    let headers = {
                        'Content-Type': file.type,
                        'Content-Length': file.size
                    }; // Add ETag header

                    if (typeof file.etag === 'string') {
                        headers['ETag'] = file.etag;
                    } // Add Last-Modified header


                    if (file.modifiedAt instanceof Date) {
                        headers['Last-Modified'] = file.modifiedAt.toUTCString();
                    } else if (file.uploadedAt instanceof Date) {
                        headers['Last-Modified'] = file.uploadedAt.toUTCString();
                    } // Parse request headers


                    if (typeof req.headers === 'object') {
                        // Compare ETag
                        if (req.headers['if-none-match']) {
                            if (file.etag === req.headers['if-none-match']) {
                                res.writeHead(304); // Not Modified

                                res.end();
                                return;
                            }
                        } // Compare file modification date


                        if (req.headers['if-modified-since']) {
                            const modifiedSince = new Date(req.headers['if-modified-since']);

                            if (file.modifiedAt instanceof Date && file.modifiedAt > modifiedSince || file.uploadedAt instanceof Date && file.uploadedAt > modifiedSince) {
                                res.writeHead(304); // Not Modified

                                res.end();
                                return;
                            }
                        } // Send data in range


                        if (typeof req.headers.range === 'string') {
                            let range = req.headers.range; // Range is not valid

                            if (!range) {
                                res.writeHead(416);
                                res.end();
                                return;
                            }

                            let positions = range.replace(/bytes=/, '').split('-');
                            let start = parseInt(positions[0], 10);
                            let total = file.size;
                            let end = positions[1] ? parseInt(positions[1], 10) : total - 1; // Update headers

                            headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
                            headers['Accept-Ranges'] = `bytes`;
                            headers['Content-Length'] = end - start + 1;
                            status = 206; // partial content

                            options.start = start;
                            options.end = end;
                        }
                    } // Open the file stream


                    let rs = store.getReadStream(fileId, file, options);
                    let ws = new stream.PassThrough();
                    rs.on('error', Meteor.bindEnvironment(err => {
                        store.onReadError.call(store, err, fileId, file);
                        res.end();
                    }));
                    ws.on('error', Meteor.bindEnvironment(err => {
                        store.onReadError.call(store, err, fileId, file);
                        res.end();
                    }));
                    ws.on('close', () => {
                        // Close output stream at the end
                        ws.emit('end');
                    }); // Transform stream

                    store.transformRead(rs, ws, fileId, file, req, headers); // Parse request headers

                    if (typeof req.headers === 'object') {
                        // Compress data using if needed (ignore audio/video as they are already compressed)
                        if (typeof req.headers['accept-encoding'] === 'string' && !/^(audio|video)/.test(file.type)) {
                            let accept = req.headers['accept-encoding']; // Compress with gzip

                            if (accept.match(/\bgzip\b/)) {
                                headers['Content-Encoding'] = 'gzip';
                                delete headers['Content-Length'];
                                res.writeHead(status, headers);
                                ws.pipe(zlib.createGzip()).pipe(res);
                                return;
                            } // Compress with deflate
                            else if (accept.match(/\bdeflate\b/)) {
                                    headers['Content-Encoding'] = 'deflate';
                                    delete headers['Content-Length'];
                                    res.writeHead(status, headers);
                                    ws.pipe(zlib.createDeflate()).pipe(res);
                                    return;
                                }
                        }
                    } // Send raw data


                    if (!headers['Content-Encoding']) {
                        res.writeHead(status, headers);
                        ws.pipe(res);
                    }
                } else {
                    res.end();
                }
            });
        } else {
            next();
        }
    });
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-store-permissions.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-store-permissions.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
    StorePermissions: () => StorePermissions
});

let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);

class StorePermissions {
    constructor(options) {
        // Default options
        options = _.extend({
            insert: null,
            remove: null,
            update: null
        }, options); // Check options

        if (options.insert && typeof options.insert !== 'function') {
            throw new TypeError("StorePermissions: insert is not a function");
        }

        if (options.remove && typeof options.remove !== 'function') {
            throw new TypeError("StorePermissions: remove is not a function");
        }

        if (options.update && typeof options.update !== 'function') {
            throw new TypeError("StorePermissions: update is not a function");
        } // Public attributes


        this.actions = {
            insert: options.insert,
            remove: options.remove,
            update: options.update
        };
    } /**
       * Checks the permission for the action
       * @param action
       * @param userId
       * @param file
       * @param fields
       * @param modifiers
       * @return {*}
       */

    check(action, userId, file, fields, modifiers) {
        if (typeof this.actions[action] === 'function') {
            return this.actions[action](userId, file, fields, modifiers);
        }

        return true; // by default allow all
    } /**
       * Checks the insert permission
       * @param userId
       * @param file
       * @returns {*}
       */

    checkInsert(userId, file) {
        return this.check('insert', userId, file);
    } /**
       * Checks the remove permission
       * @param userId
       * @param file
       * @returns {*}
       */

    checkRemove(userId, file) {
        return this.check('remove', userId, file);
    } /**
       * Checks the update permission
       * @param userId
       * @param file
       * @param fields
       * @param modifiers
       * @returns {*}
       */

    checkUpdate(userId, file, fields, modifiers) {
        return this.check('update', userId, file, fields, modifiers);
    }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-store.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-store.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
    Store: () => Store
});

let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let check;
module.watch(require("meteor/check"), {
    check(v) {
        check = v;
    }

}, 1);
let Meteor;
module.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 2);
let Mongo;
module.watch(require("meteor/mongo"), {
    Mongo(v) {
        Mongo = v;
    }

}, 3);
let UploadFS;
module.watch(require("./ufs"), {
    UploadFS(v) {
        UploadFS = v;
    }

}, 4);
let Filter;
module.watch(require("./ufs-filter"), {
    Filter(v) {
        Filter = v;
    }

}, 5);
let StorePermissions;
module.watch(require("./ufs-store-permissions"), {
    StorePermissions(v) {
        StorePermissions = v;
    }

}, 6);
let Tokens;
module.watch(require("./ufs-tokens"), {
    Tokens(v) {
        Tokens = v;
    }

}, 7);

class Store {
    constructor(options) {
        let self = this; // Default options

        options = _.extend({
            collection: null,
            filter: null,
            name: null,
            onCopyError: this.onCopyError,
            onFinishUpload: this.onFinishUpload,
            onRead: this.onRead,
            onReadError: this.onReadError,
            onValidate: this.onValidate,
            onWriteError: this.onWriteError,
            permissions: null,
            transformRead: null,
            transformWrite: null
        }, options); // Check options

        if (!(options.collection instanceof Mongo.Collection)) {
            throw new TypeError('Store: collection is not a Mongo.Collection');
        }

        if (options.filter && !(options.filter instanceof Filter)) {
            throw new TypeError('Store: filter is not a UploadFS.Filter');
        }

        if (typeof options.name !== 'string') {
            throw new TypeError('Store: name is not a string');
        }

        if (UploadFS.getStore(options.name)) {
            throw new TypeError('Store: name already exists');
        }

        if (options.onCopyError && typeof options.onCopyError !== 'function') {
            throw new TypeError('Store: onCopyError is not a function');
        }

        if (options.onFinishUpload && typeof options.onFinishUpload !== 'function') {
            throw new TypeError('Store: onFinishUpload is not a function');
        }

        if (options.onRead && typeof options.onRead !== 'function') {
            throw new TypeError('Store: onRead is not a function');
        }

        if (options.onReadError && typeof options.onReadError !== 'function') {
            throw new TypeError('Store: onReadError is not a function');
        }

        if (options.onWriteError && typeof options.onWriteError !== 'function') {
            throw new TypeError('Store: onWriteError is not a function');
        }

        if (options.permissions && !(options.permissions instanceof StorePermissions)) {
            throw new TypeError('Store: permissions is not a UploadFS.StorePermissions');
        }

        if (options.transformRead && typeof options.transformRead !== 'function') {
            throw new TypeError('Store: transformRead is not a function');
        }

        if (options.transformWrite && typeof options.transformWrite !== 'function') {
            throw new TypeError('Store: transformWrite is not a function');
        }

        if (options.onValidate && typeof options.onValidate !== 'function') {
            throw new TypeError('Store: onValidate is not a function');
        } // Public attributes


        self.options = options;
        self.permissions = options.permissions;

        _.each(['onCopyError', 'onFinishUpload', 'onRead', 'onReadError', 'onWriteError', 'onValidate'], method => {
            if (typeof options[method] === 'function') {
                self[method] = options[method];
            }
        }); // Add the store to the list


        UploadFS.addStore(self); // Set default permissions

        if (!(self.permissions instanceof StorePermissions)) {
            // Uses custom default permissions or UFS default permissions
            if (UploadFS.config.defaultStorePermissions instanceof StorePermissions) {
                self.permissions = UploadFS.config.defaultStorePermissions;
            } else {
                self.permissions = new StorePermissions();
                console.warn(`ufs: permissions are not defined for store "${options.name}"`);
            }
        }

        if (Meteor.isServer) {
            /**
             * Checks token validity
             * @param token
             * @param fileId
             * @returns {boolean}
             */self.checkToken = function (token, fileId) {
                check(token, String);
                check(fileId, String);
                return Tokens.find({
                    value: token,
                    fileId: fileId
                }).count() === 1;
            }; /**
                * Copies the file to a store
                * @param fileId
                * @param store
                * @param callback
                */

            self.copy = function (fileId, store, callback) {
                check(fileId, String);

                if (!(store instanceof Store)) {
                    throw new TypeError('store is not an instance of UploadFS.Store');
                } // Get original file


                let file = self.getCollection().findOne({
                    _id: fileId
                });

                if (!file) {
                    throw new Meteor.Error('file-not-found', 'File not found');
                } // Silently ignore the file if it does not match filter


                const filter = store.getFilter();

                if (filter instanceof Filter && !filter.isValid(file)) {
                    return;
                } // Prepare copy


                let copy = _.omit(file, '_id', 'url');

                copy.originalStore = self.getName();
                copy.originalId = fileId; // Create the copy

                let copyId = store.create(copy); // Get original stream

                let rs = self.getReadStream(fileId, file); // Catch errors to avoid app crashing

                rs.on('error', Meteor.bindEnvironment(function (err) {
                    callback.call(self, err, null);
                })); // Copy file data

                store.write(rs, copyId, Meteor.bindEnvironment(function (err) {
                    if (err) {
                        self.getCollection().remove({
                            _id: copyId
                        });
                        self.onCopyError.call(self, err, fileId, file);
                    }

                    if (typeof callback === 'function') {
                        callback.call(self, err, copyId, copy, store);
                    }
                }));
            }; /**
                * Creates the file in the collection
                * @param file
                * @param callback
                * @return {string}
                */

            self.create = function (file, callback) {
                check(file, Object);
                file.store = self.options.name; // assign store to file

                return self.getCollection().insert(file, callback);
            }; /**
                * Creates a token for the file (only needed for client side upload)
                * @param fileId
                * @returns {*}
                */

            self.createToken = function (fileId) {
                let token = self.generateToken(); // Check if token exists

                if (Tokens.find({
                    fileId: fileId
                }).count()) {
                    Tokens.update({
                        fileId: fileId
                    }, {
                        $set: {
                            createdAt: new Date(),
                            value: token
                        }
                    });
                } else {
                    Tokens.insert({
                        createdAt: new Date(),
                        fileId: fileId,
                        value: token
                    });
                }

                return token;
            }; /**
                * Writes the file to the store
                * @param rs
                * @param fileId
                * @param callback
                */

            self.write = function (rs, fileId, callback) {
                let file = self.getCollection().findOne({
                    _id: fileId
                });
                let ws = self.getWriteStream(fileId, file);
                let errorHandler = Meteor.bindEnvironment(function (err) {
                    self.getCollection().remove({
                        _id: fileId
                    });
                    self.onWriteError.call(self, err, fileId, file);
                    callback.call(self, err);
                });
                ws.on('error', errorHandler);
                ws.on('finish', Meteor.bindEnvironment(function () {
                    let size = 0;
                    let readStream = self.getReadStream(fileId, file);
                    readStream.on('error', Meteor.bindEnvironment(function (error) {
                        callback.call(self, error, null);
                    }));
                    readStream.on('data', Meteor.bindEnvironment(function (data) {
                        size += data.length;
                    }));
                    readStream.on('end', Meteor.bindEnvironment(function () {
                        // Set file attribute
                        file.complete = true;
                        file.etag = UploadFS.generateEtag();
                        file.path = self.getFileRelativeURL(fileId);
                        file.progress = 1;
                        file.size = size;
                        file.token = self.generateToken();
                        file.uploading = false;
                        file.uploadedAt = new Date();
                        file.url = self.getFileURL(fileId); // Sets the file URL when file transfer is complete,
                        // this way, the image will loads entirely.

                        self.getCollection().direct.update({
                            _id: fileId
                        }, {
                            $set: {
                                complete: file.complete,
                                etag: file.etag,
                                path: file.path,
                                progress: file.progress,
                                size: file.size,
                                token: file.token,
                                uploading: file.uploading,
                                uploadedAt: file.uploadedAt,
                                url: file.url
                            }
                        }); // Return file info

                        callback.call(self, null, file); // Execute callback

                        if (typeof self.onFinishUpload == 'function') {
                            self.onFinishUpload.call(self, file);
                        } // Simulate write speed


                        if (UploadFS.config.simulateWriteDelay) {
                            Meteor._sleepForMs(UploadFS.config.simulateWriteDelay);
                        } // Copy file to other stores


                        if (self.options.copyTo instanceof Array) {
                            for (let i = 0; i < self.options.copyTo.length; i += 1) {
                                let store = self.options.copyTo[i];

                                if (!store.getFilter() || store.getFilter().isValid(file)) {
                                    self.copy(fileId, store);
                                }
                            }
                        }
                    }));
                })); // Execute transformation

                self.transformWrite(rs, ws, fileId, file);
            };
        }

        if (Meteor.isServer) {
            const fs = Npm.require('fs');

            const collection = self.getCollection(); // Code executed after removing file

            collection.after.remove(function (userId, file) {
                // Remove associated tokens
                Tokens.remove({
                    fileId: file._id
                });

                if (self.options.copyTo instanceof Array) {
                    for (let i = 0; i < self.options.copyTo.length; i += 1) {
                        // Remove copies in stores
                        self.options.copyTo[i].getCollection().remove({
                            originalId: file._id
                        });
                    }
                }
            }); // Code executed before inserting file

            collection.before.insert(function (userId, file) {
                if (!self.permissions.checkInsert(userId, file)) {
                    throw new Meteor.Error('forbidden', "Forbidden");
                }
            }); // Code executed before updating file

            collection.before.update(function (userId, file, fields, modifiers) {
                if (!self.permissions.checkUpdate(userId, file, fields, modifiers)) {
                    throw new Meteor.Error('forbidden', "Forbidden");
                }
            }); // Code executed before removing file

            collection.before.remove(function (userId, file) {
                if (!self.permissions.checkRemove(userId, file)) {
                    throw new Meteor.Error('forbidden', "Forbidden");
                } // Delete the physical file in the store


                self.delete(file._id);
                let tmpFile = UploadFS.getTempFilePath(file._id); // Delete the temp file

                fs.stat(tmpFile, function (err) {
                    !err && fs.unlink(tmpFile, function (err) {
                        err && console.error(`ufs: cannot delete temp file at ${tmpFile} (${err.message})`);
                    });
                });
            });
        }
    } /**
       * Deletes a file async
       * @param fileId
       * @param callback
       */

    delete(fileId, callback) {
        throw new Error('delete is not implemented');
    } /**
       * Generates a random token
       * @param pattern
       * @return {string}
       */

    generateToken(pattern) {
        return (pattern || 'xyxyxyxyxy').replace(/[xy]/g, c => {
            let r = Math.random() * 16 | 0,
                v = c == 'x' ? r : r & 0x3 | 0x8;
            let s = v.toString(16);
            return Math.round(Math.random()) ? s.toUpperCase() : s;
        });
    } /**
       * Returns the collection
       * @return {Mongo.Collection}
       */

    getCollection() {
        return this.options.collection;
    } /**
       * Returns the file URL
       * @param fileId
       * @return {string|null}
       */

    getFileRelativeURL(fileId) {
        let file = this.getCollection().findOne(fileId, {
            fields: {
                name: 1
            }
        });
        return file ? this.getRelativeURL(`${fileId}/${file.name}`) : null;
    } /**
       * Returns the file URL
       * @param fileId
       * @return {string|null}
       */

    getFileURL(fileId) {
        let file = this.getCollection().findOne(fileId, {
            fields: {
                name: 1
            }
        });
        return file ? this.getURL(`${fileId}/${file.name}`) : null;
    } /**
       * Returns the file filter
       * @return {UploadFS.Filter}
       */

    getFilter() {
        return this.options.filter;
    } /**
       * Returns the store name
       * @return {string}
       */

    getName() {
        return this.options.name;
    } /**
       * Returns the file read stream
       * @param fileId
       * @param file
       */

    getReadStream(fileId, file) {
        throw new Error('Store.getReadStream is not implemented');
    } /**
       * Returns the store relative URL
       * @param path
       * @return {string}
       */

    getRelativeURL(path) {
        const rootUrl = Meteor.absoluteUrl().replace(/\/+$/, '');
        const rootPath = rootUrl.replace(/^[a-z]+:\/\/[^/]+\/*/gi, '');
        const storeName = this.getName();
        path = String(path).replace(/\/$/, '').trim();
        return encodeURI(`${rootPath}/${UploadFS.config.storesPath}/${storeName}/${path}`);
    } /**
       * Returns the store absolute URL
       * @param path
       * @return {string}
       */

    getURL(path) {
        const rootUrl = Meteor.absoluteUrl().replace(/\/+$/, '');
        const storeName = this.getName();
        path = String(path).replace(/\/$/, '').trim();
        return encodeURI(`${rootUrl}/${UploadFS.config.storesPath}/${storeName}/${path}`);
    } /**
       * Returns the file write stream
       * @param fileId
       * @param file
       */

    getWriteStream(fileId, file) {
        throw new Error('getWriteStream is not implemented');
    } /**
       * Completes the file upload
       * @param url
       * @param file
       * @param callback
       */

    importFromURL(url, file, callback) {
        Meteor.call('ufsImportURL', url, file, this.getName(), callback);
    } /**
       * Called when a copy error happened
       * @param err
       * @param fileId
       * @param file
       */

    onCopyError(err, fileId, file) {
        console.error(`ufs: cannot copy file "${fileId}" (${err.message})`, err);
    } /**
       * Called when a file has been uploaded
       * @param file
       */

    onFinishUpload(file) {} /**
                             * Called when a file is read from the store
                             * @param fileId
                             * @param file
                             * @param request
                             * @param response
                             * @return boolean
                             */

    onRead(fileId, file, request, response) {
        return true;
    } /**
       * Called when a read error happened
       * @param err
       * @param fileId
       * @param file
       * @return boolean
       */

    onReadError(err, fileId, file) {
        console.error(`ufs: cannot read file "${fileId}" (${err.message})`, err);
    } /**
       * Called when file is being validated
       * @param file
       */

    onValidate(file) {} /**
                         * Called when a write error happened
                         * @param err
                         * @param fileId
                         * @param file
                         * @return boolean
                         */

    onWriteError(err, fileId, file) {
        console.error(`ufs: cannot write file "${fileId}" (${err.message})`, err);
    } /**
       * Sets the store permissions
       * @param permissions
       */

    setPermissions(permissions) {
        if (!(permissions instanceof StorePermissions)) {
            throw new TypeError("Permissions is not an instance of UploadFS.StorePermissions");
        }

        this.permissions = permissions;
    } /**
       * Transforms the file on reading
       * @param readStream
       * @param writeStream
       * @param fileId
       * @param file
       * @param request
       * @param headers
       */

    transformRead(readStream, writeStream, fileId, file, request, headers) {
        if (typeof this.options.transformRead === 'function') {
            this.options.transformRead.call(this, readStream, writeStream, fileId, file, request, headers);
        } else {
            readStream.pipe(writeStream);
        }
    } /**
       * Transforms the file on writing
       * @param readStream
       * @param writeStream
       * @param fileId
       * @param file
       */

    transformWrite(readStream, writeStream, fileId, file) {
        if (typeof this.options.transformWrite === 'function') {
            this.options.transformWrite.call(this, readStream, writeStream, fileId, file);
        } else {
            readStream.pipe(writeStream);
        }
    } /**
       * Validates the file
       * @param file
       */

    validate(file) {
        if (typeof this.onValidate === 'function') {
            this.onValidate(file);
        }
    }

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-template-helpers.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-template-helpers.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let Template;
module.watch(require("meteor/templating"), {
    Template(v) {
        Template = v;
    }

}, 0);

let isMIME = function (type, mime) {
    return typeof type === 'string' && typeof mime === 'string' && mime.indexOf(type + '/') === 0;
};

Template.registerHelper('isApplication', function (type) {
    return isMIME('application', this.type || type);
});
Template.registerHelper('isAudio', function (type) {
    return isMIME('audio', this.type || type);
});
Template.registerHelper('isImage', function (type) {
    return isMIME('image', this.type || type);
});
Template.registerHelper('isText', function (type) {
    return isMIME('text', this.type || type);
});
Template.registerHelper('isVideo', function (type) {
    return isMIME('video', this.type || type);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-tokens.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-tokens.js                                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Tokens: () => Tokens
});
let Mongo;
module.watch(require("meteor/mongo"), {
  Mongo(v) {
    Mongo = v;
  }

}, 0);
const Tokens = new Mongo.Collection('ufsTokens');
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"ufs-uploader.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/jalik_ufs/ufs-uploader.js                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
    Uploader: () => Uploader
});

let _;

module.watch(require("meteor/underscore"), {
    _(v) {
        _ = v;
    }

}, 0);
let Meteor;
module.watch(require("meteor/meteor"), {
    Meteor(v) {
        Meteor = v;
    }

}, 1);
let Store;
module.watch(require("./ufs-store"), {
    Store(v) {
        Store = v;
    }

}, 2);

class Uploader {
    constructor(options) {
        let self = this; // Set default options

        options = _.extend({
            adaptive: true,
            capacity: 0.9,
            chunkSize: 16 * 1024,
            data: null,
            file: null,
            maxChunkSize: 4 * 1024 * 1000,
            maxTries: 5,
            onAbort: this.onAbort,
            onComplete: this.onComplete,
            onCreate: this.onCreate,
            onError: this.onError,
            onProgress: this.onProgress,
            onStart: this.onStart,
            onStop: this.onStop,
            retryDelay: 2000,
            store: null,
            transferDelay: 100
        }, options); // Check options

        if (typeof options.adaptive !== 'boolean') {
            throw new TypeError('adaptive is not a number');
        }

        if (typeof options.capacity !== 'number') {
            throw new TypeError('capacity is not a number');
        }

        if (options.capacity <= 0 || options.capacity > 1) {
            throw new RangeError('capacity must be a float between 0.1 and 1.0');
        }

        if (typeof options.chunkSize !== 'number') {
            throw new TypeError('chunkSize is not a number');
        }

        if (!(options.data instanceof Blob) && !(options.data instanceof File)) {
            throw new TypeError('data is not an Blob or File');
        }

        if (options.file === null || typeof options.file !== 'object') {
            throw new TypeError('file is not an object');
        }

        if (typeof options.maxChunkSize !== 'number') {
            throw new TypeError('maxChunkSize is not a number');
        }

        if (typeof options.maxTries !== 'number') {
            throw new TypeError('maxTries is not a number');
        }

        if (typeof options.retryDelay !== 'number') {
            throw new TypeError('retryDelay is not a number');
        }

        if (typeof options.transferDelay !== 'number') {
            throw new TypeError('transferDelay is not a number');
        }

        if (typeof options.onAbort !== 'function') {
            throw new TypeError('onAbort is not a function');
        }

        if (typeof options.onComplete !== 'function') {
            throw new TypeError('onComplete is not a function');
        }

        if (typeof options.onCreate !== 'function') {
            throw new TypeError('onCreate is not a function');
        }

        if (typeof options.onError !== 'function') {
            throw new TypeError('onError is not a function');
        }

        if (typeof options.onProgress !== 'function') {
            throw new TypeError('onProgress is not a function');
        }

        if (typeof options.onStart !== 'function') {
            throw new TypeError('onStart is not a function');
        }

        if (typeof options.onStop !== 'function') {
            throw new TypeError('onStop is not a function');
        }

        if (typeof options.store !== 'string' && !(options.store instanceof Store)) {
            throw new TypeError('store must be the name of the store or an instance of UploadFS.Store');
        } // Public attributes


        self.adaptive = options.adaptive;
        self.capacity = parseFloat(options.capacity);
        self.chunkSize = parseInt(options.chunkSize);
        self.maxChunkSize = parseInt(options.maxChunkSize);
        self.maxTries = parseInt(options.maxTries);
        self.retryDelay = parseInt(options.retryDelay);
        self.transferDelay = parseInt(options.transferDelay);
        self.onAbort = options.onAbort;
        self.onComplete = options.onComplete;
        self.onCreate = options.onCreate;
        self.onError = options.onError;
        self.onProgress = options.onProgress;
        self.onStart = options.onStart;
        self.onStop = options.onStop; // Private attributes

        let store = options.store;
        let data = options.data;
        let capacityMargin = 0.1;
        let file = options.file;
        let fileId = null;
        let offset = 0;
        let loaded = 0;
        let total = data.size;
        let tries = 0;
        let postUrl = null;
        let token = null;
        let complete = false;
        let uploading = false;
        let timeA = null;
        let timeB = null;
        let elapsedTime = 0;
        let startTime = 0; // Keep only the name of the store

        if (store instanceof Store) {
            store = store.getName();
        } // Assign file to store


        file.store = store;

        function finish() {
            // Finish the upload by telling the store the upload is complete
            Meteor.call('ufsComplete', fileId, store, token, function (err, uploadedFile) {
                if (err) {
                    self.onError(err, file);
                    self.abort();
                } else if (uploadedFile) {
                    uploading = false;
                    complete = true;
                    file = uploadedFile;
                    self.onComplete(uploadedFile);
                }
            });
        } /**
           * Aborts the current transfer
           */

        self.abort = function () {
            // Remove the file from database
            Meteor.call('ufsDelete', fileId, store, token, function (err, result) {
                if (err) {
                    self.onError(err, file);
                }
            }); // Reset uploader status

            uploading = false;
            fileId = null;
            offset = 0;
            tries = 0;
            loaded = 0;
            complete = false;
            startTime = null;
            self.onAbort(file);
        }; /**
            * Returns the average speed in bytes per second
            * @returns {number}
            */

        self.getAverageSpeed = function () {
            let seconds = self.getElapsedTime() / 1000;
            return self.getLoaded() / seconds;
        }; /**
            * Returns the elapsed time in milliseconds
            * @returns {number}
            */

        self.getElapsedTime = function () {
            if (startTime && self.isUploading()) {
                return elapsedTime + (Date.now() - startTime);
            }

            return elapsedTime;
        }; /**
            * Returns the file
            * @return {object}
            */

        self.getFile = function () {
            return file;
        }; /**
            * Returns the loaded bytes
            * @return {number}
            */

        self.getLoaded = function () {
            return loaded;
        }; /**
            * Returns current progress
            * @return {number}
            */

        self.getProgress = function () {
            return Math.min(loaded / total * 100 / 100, 1.0);
        }; /**
            * Returns the remaining time in milliseconds
            * @returns {number}
            */

        self.getRemainingTime = function () {
            let averageSpeed = self.getAverageSpeed();
            let remainingBytes = total - self.getLoaded();
            return averageSpeed && remainingBytes ? Math.max(remainingBytes / averageSpeed, 0) : 0;
        }; /**
            * Returns the upload speed in bytes per second
            * @returns {number}
            */

        self.getSpeed = function () {
            if (timeA && timeB && self.isUploading()) {
                let seconds = (timeB - timeA) / 1000;
                return self.chunkSize / seconds;
            }

            return 0;
        }; /**
            * Returns the total bytes
            * @return {number}
            */

        self.getTotal = function () {
            return total;
        }; /**
            * Checks if the transfer is complete
            * @return {boolean}
            */

        self.isComplete = function () {
            return complete;
        }; /**
            * Checks if the transfer is active
            * @return {boolean}
            */

        self.isUploading = function () {
            return uploading;
        }; /**
            * Reads a portion of file
            * @param start
            * @param length
            * @param callback
            * @returns {Blob}
            */

        self.readChunk = function (start, length, callback) {
            if (typeof callback != 'function') {
                throw new Error('readChunk is missing callback');
            }

            try {
                let end; // Calculate the chunk size

                if (length && start + length > total) {
                    end = total;
                } else {
                    end = start + length;
                } // Get chunk


                let chunk = data.slice(start, end); // Pass chunk to callback

                callback.call(self, null, chunk);
            } catch (err) {
                console.error('read error', err); // Retry to read chunk

                Meteor.setTimeout(function () {
                    if (tries < self.maxTries) {
                        tries += 1;
                        self.readChunk(start, length, callback);
                    }
                }, self.retryDelay);
            }
        }; /**
            * Sends a file chunk to the store
            */

        self.sendChunk = function () {
            if (!complete && startTime !== null) {
                if (offset < total) {
                    let chunkSize = self.chunkSize; // Use adaptive length

                    if (self.adaptive && timeA && timeB && timeB > timeA) {
                        let duration = (timeB - timeA) / 1000;
                        let max = self.capacity * (1 + capacityMargin);
                        let min = self.capacity * (1 - capacityMargin);

                        if (duration >= max) {
                            chunkSize = Math.abs(Math.round(chunkSize * (max - duration)));
                        } else if (duration < min) {
                            chunkSize = Math.round(chunkSize * (min / duration));
                        } // Limit to max chunk size


                        if (self.maxChunkSize > 0 && chunkSize > self.maxChunkSize) {
                            chunkSize = self.maxChunkSize;
                        }
                    } // Limit to max chunk size


                    if (self.maxChunkSize > 0 && chunkSize > self.maxChunkSize) {
                        chunkSize = self.maxChunkSize;
                    } // Reduce chunk size to fit total


                    if (offset + chunkSize > total) {
                        chunkSize = total - offset;
                    } // Prepare the chunk


                    self.readChunk(offset, chunkSize, function (err, chunk) {
                        if (err) {
                            self.onError(err, file);
                            return;
                        }

                        let xhr = new XMLHttpRequest();

                        xhr.onreadystatechange = function () {
                            if (xhr.readyState === 4) {
                                if (_.contains([200, 201, 202, 204], xhr.status)) {
                                    timeB = Date.now();
                                    offset += chunkSize;
                                    loaded += chunkSize; // Send next chunk

                                    self.onProgress(file, self.getProgress()); // Finish upload

                                    if (loaded >= total) {
                                        elapsedTime = Date.now() - startTime;
                                        finish();
                                    } else {
                                        Meteor.setTimeout(self.sendChunk, self.transferDelay);
                                    }
                                } else if (!_.contains([402, 403, 404, 500], xhr.status)) {
                                    // Retry until max tries is reach
                                    // But don't retry if these errors occur
                                    if (tries <= self.maxTries) {
                                        tries += 1; // Wait before retrying

                                        Meteor.setTimeout(self.sendChunk, self.retryDelay);
                                    } else {
                                        self.abort();
                                    }
                                } else {
                                    self.abort();
                                }
                            }
                        }; // Calculate upload progress


                        let progress = (offset + chunkSize) / total; // let formData = new FormData();
                        // formData.append('progress', progress);
                        // formData.append('chunk', chunk);

                        let url = `${postUrl}&progress=${progress}`;
                        timeA = Date.now();
                        timeB = null;
                        uploading = true; // Send chunk to the store

                        xhr.open('POST', url, true);
                        xhr.send(chunk);
                    });
                }
            }
        }; /**
            * Starts or resumes the transfer
            */

        self.start = function () {
            if (!fileId) {
                // Create the file document and get the token
                // that allows the user to send chunks to the store.
                Meteor.call('ufsCreate', _.extend({}, file), function (err, result) {
                    if (err) {
                        self.onError(err, file);
                    } else if (result) {
                        token = result.token;
                        postUrl = result.url;
                        fileId = result.fileId;
                        file._id = result.fileId;
                        self.onCreate(file);
                        tries = 0;
                        startTime = Date.now();
                        self.onStart(file);
                        self.sendChunk();
                    }
                });
            } else if (!uploading && !complete) {
                // Resume uploading
                tries = 0;
                startTime = Date.now();
                self.onStart(file);
                self.sendChunk();
            }
        }; /**
            * Stops the transfer
            */

        self.stop = function () {
            if (uploading) {
                // Update elapsed time
                elapsedTime = Date.now() - startTime;
                startTime = null;
                uploading = false;
                self.onStop(file);
                Meteor.call('ufsStop', fileId, store, token, function (err, result) {
                    if (err) {
                        self.onError(err, file);
                    }
                });
            }
        };
    } /**
       * Called when the file upload is aborted
       * @param file
       */

    onAbort(file) {} /**
                      * Called when the file upload is complete
                      * @param file
                      */

    onComplete(file) {} /**
                         * Called when the file is created in the collection
                         * @param file
                         */

    onCreate(file) {} /**
                       * Called when an error occurs during file upload
                       * @param err
                       * @param file
                       */

    onError(err, file) {
        console.error(`ufs: ${err.message}`);
    } /**
       * Called when a file chunk has been sent
       * @param file
       * @param progress is a float from 0.0 to 1.0
       */

    onProgress(file, progress) {} /**
                                   * Called when the file upload starts
                                   * @param file
                                   */

    onStart(file) {} /**
                      * Called when the file upload stops
                      * @param file
                      */

    onStop(file) {}

}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
var exports = require("./node_modules/meteor/jalik:ufs/ufs.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['jalik:ufs'] = exports;

})();

//# sourceURL=meteor://💻app/packages/jalik_ufs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvamFsaWs6dWZzL3Vmcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvamFsaWs6dWZzL3Vmcy1jb25maWcuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2phbGlrOnVmcy91ZnMtZmlsdGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9qYWxpazp1ZnMvdWZzLW1ldGhvZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2phbGlrOnVmcy91ZnMtbWltZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvamFsaWs6dWZzL3Vmcy1zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2phbGlrOnVmcy91ZnMtc3RvcmUtcGVybWlzc2lvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2phbGlrOnVmcy91ZnMtc3RvcmUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2phbGlrOnVmcy91ZnMtdGVtcGxhdGUtaGVscGVycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvamFsaWs6dWZzL3Vmcy10b2tlbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2phbGlrOnVmcy91ZnMtdXBsb2FkZXIuanMiXSwibmFtZXMiOlsibW9kdWxlMSIsIm1vZHVsZSIsImV4cG9ydCIsIlVwbG9hZEZTIiwiXyIsIndhdGNoIiwicmVxdWlyZSIsInYiLCJNZXRlb3IiLCJNb25nbyIsIk1JTUUiLCJSYW5kb20iLCJUb2tlbnMiLCJDb25maWciLCJGaWx0ZXIiLCJTdG9yZSIsIlN0b3JlUGVybWlzc2lvbnMiLCJVcGxvYWRlciIsInN0b3JlcyIsInN0b3JlIiwidG9rZW5zIiwiYWRkRVRhZ0F0dHJpYnV0ZVRvRmlsZXMiLCJ3aGVyZSIsImVhY2giLCJnZXRTdG9yZXMiLCJmaWxlcyIsImdldENvbGxlY3Rpb24iLCJmaW5kIiwiZXRhZyIsImZpZWxkcyIsIl9pZCIsImZvckVhY2giLCJmaWxlIiwiZGlyZWN0IiwidXBkYXRlIiwiJHNldCIsImdlbmVyYXRlRXRhZyIsImFkZE1pbWVUeXBlIiwiZXh0ZW5zaW9uIiwibWltZSIsInRvTG93ZXJDYXNlIiwiYWRkUGF0aEF0dHJpYnV0ZVRvRmlsZXMiLCJwYXRoIiwiZ2V0RmlsZVJlbGF0aXZlVVJMIiwiYWRkU3RvcmUiLCJUeXBlRXJyb3IiLCJnZXROYW1lIiwiaWQiLCJnZXRNaW1lVHlwZSIsImdldE1pbWVUeXBlcyIsImdldFN0b3JlIiwibmFtZSIsImdldFRlbXBGaWxlUGF0aCIsImZpbGVJZCIsImNvbmZpZyIsInRtcERpciIsImltcG9ydEZyb21VUkwiLCJ1cmwiLCJjYWxsYmFjayIsImNhbGwiLCJyZWFkQXNBcnJheUJ1ZmZlciIsImV2ZW50IiwiY29uc29sZSIsImVycm9yIiwic2VsZWN0RmlsZSIsImlucHV0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwidHlwZSIsIm11bHRpcGxlIiwib25jaGFuZ2UiLCJldiIsInRhcmdldCIsImRpdiIsImNsYXNzTmFtZSIsInN0eWxlIiwiYXBwZW5kQ2hpbGQiLCJib2R5IiwiY2xpY2siLCJzZWxlY3RGaWxlcyIsImkiLCJsZW5ndGgiLCJpc0NsaWVudCIsImlzU2VydmVyIiwiZ2xvYmFsIiwid2luZG93IiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiZXh0ZW5kIiwiZGVmYXVsdFN0b3JlUGVybWlzc2lvbnMiLCJodHRwcyIsInNpbXVsYXRlUmVhZERlbGF5Iiwic2ltdWxhdGVVcGxvYWRTcGVlZCIsInNpbXVsYXRlV3JpdGVEZWxheSIsInN0b3Jlc1BhdGgiLCJ0bXBEaXJQZXJtaXNzaW9ucyIsInBhcnNlSW50Iiwic2VsZiIsImNvbnRlbnRUeXBlcyIsImV4dGVuc2lvbnMiLCJtaW5TaXplIiwibWF4U2l6ZSIsIm9uQ2hlY2siLCJBcnJheSIsIm1ldGhvZCIsImNoZWNrIiwiRXJyb3IiLCJzaXplIiwiZ2V0TWluU2l6ZSIsImdldE1heFNpemUiLCJnZXRFeHRlbnNpb25zIiwiY29udGFpbnMiLCJnZXRDb250ZW50VHlwZXMiLCJpc0NvbnRlbnRUeXBlSW5MaXN0IiwibGlzdCIsIndpbGRDYXJkR2xvYiIsIndpbGRjYXJkcyIsImZpbHRlciIsIml0ZW0iLCJpbmRleE9mIiwicmVwbGFjZSIsImlzVmFsaWQiLCJyZXN1bHQiLCJlcnIiLCJmcyIsIk5wbSIsImh0dHAiLCJGdXR1cmUiLCJtZXRob2RzIiwidWZzQ29tcGxldGUiLCJzdG9yZU5hbWUiLCJ0b2tlbiIsIlN0cmluZyIsImNoZWNrVG9rZW4iLCJmdXQiLCJ0bXBGaWxlIiwicmVtb3ZlVGVtcEZpbGUiLCJ1bmxpbmsiLCJtZXNzYWdlIiwiZmluZE9uZSIsInZhbGlkYXRlIiwicnMiLCJjcmVhdGVSZWFkU3RyZWFtIiwiZmxhZ3MiLCJlbmNvZGluZyIsImF1dG9DbG9zZSIsIm9uIiwiYmluZEVudmlyb25tZW50IiwicmVtb3ZlIiwidGhyb3ciLCJ3cml0ZSIsInJldHVybiIsIndhaXQiLCJ1ZnNDcmVhdGUiLCJPYmplY3QiLCJjb21wbGV0ZSIsInVwbG9hZGluZyIsInN1YnN0ciIsImxhc3RJbmRleE9mIiwicHJvZ3Jlc3MiLCJ1c2VySWQiLCJnZXRGaWx0ZXIiLCJjcmVhdGUiLCJjcmVhdGVUb2tlbiIsInVwbG9hZFVybCIsImdldFVSTCIsInVmc0RlbGV0ZSIsImNvdW50IiwidWZzSW1wb3J0VVJMIiwic3BsaXQiLCJwb3AiLCJvcmlnaW5hbFVybCIsIndhcm4iLCJwcm90byIsInRlc3QiLCJ1bmJsb2NrIiwiZ2V0IiwicmVzIiwidWZzU3RvcCIsIldlYkFwcCIsImRvbWFpbiIsIm1rZGlycCIsInN0cmVhbSIsIlVSTCIsInpsaWIiLCJzdGFydHVwIiwibW9kZSIsInN0YXQiLCJsb2ciLCJjaG1vZCIsImQiLCJjb25uZWN0SGFuZGxlcnMiLCJ1c2UiLCJyZXEiLCJuZXh0IiwicGFyc2VkVXJsIiwicGFyc2UiLCJwYXRobmFtZSIsImFsbG93Q09SUyIsInNldEhlYWRlciIsInJlZ0V4cCIsIlJlZ0V4cCIsIm1hdGNoIiwiZXhlYyIsIndyaXRlSGVhZCIsImVuZCIsInF1ZXJ5Iiwid3MiLCJjcmVhdGVXcml0ZVN0cmVhbSIsInBhcnNlRmxvYXQiLCJpc05hTiIsIk1hdGgiLCJtaW4iLCJjaHVuayIsIm9uUmVhZCIsInVuZGVmaW5lZCIsImluZGV4IiwiX3NsZWVwRm9yTXMiLCJydW4iLCJzdGF0dXMiLCJoZWFkZXJzIiwibW9kaWZpZWRBdCIsIkRhdGUiLCJ0b1VUQ1N0cmluZyIsInVwbG9hZGVkQXQiLCJtb2RpZmllZFNpbmNlIiwicmFuZ2UiLCJwb3NpdGlvbnMiLCJzdGFydCIsInRvdGFsIiwiZ2V0UmVhZFN0cmVhbSIsIlBhc3NUaHJvdWdoIiwib25SZWFkRXJyb3IiLCJlbWl0IiwidHJhbnNmb3JtUmVhZCIsImFjY2VwdCIsInBpcGUiLCJjcmVhdGVHemlwIiwiY3JlYXRlRGVmbGF0ZSIsImluc2VydCIsImFjdGlvbnMiLCJhY3Rpb24iLCJtb2RpZmllcnMiLCJjaGVja0luc2VydCIsImNoZWNrUmVtb3ZlIiwiY2hlY2tVcGRhdGUiLCJjb2xsZWN0aW9uIiwib25Db3B5RXJyb3IiLCJvbkZpbmlzaFVwbG9hZCIsIm9uVmFsaWRhdGUiLCJvbldyaXRlRXJyb3IiLCJwZXJtaXNzaW9ucyIsInRyYW5zZm9ybVdyaXRlIiwiQ29sbGVjdGlvbiIsInZhbHVlIiwiY29weSIsIm9taXQiLCJvcmlnaW5hbFN0b3JlIiwib3JpZ2luYWxJZCIsImNvcHlJZCIsImdlbmVyYXRlVG9rZW4iLCJjcmVhdGVkQXQiLCJnZXRXcml0ZVN0cmVhbSIsImVycm9ySGFuZGxlciIsInJlYWRTdHJlYW0iLCJkYXRhIiwiZ2V0RmlsZVVSTCIsImNvcHlUbyIsImFmdGVyIiwiYmVmb3JlIiwiZGVsZXRlIiwicGF0dGVybiIsImMiLCJyIiwicmFuZG9tIiwicyIsInRvU3RyaW5nIiwicm91bmQiLCJ0b1VwcGVyQ2FzZSIsImdldFJlbGF0aXZlVVJMIiwicm9vdFVybCIsImFic29sdXRlVXJsIiwicm9vdFBhdGgiLCJ0cmltIiwiZW5jb2RlVVJJIiwicmVxdWVzdCIsInJlc3BvbnNlIiwic2V0UGVybWlzc2lvbnMiLCJ3cml0ZVN0cmVhbSIsIlRlbXBsYXRlIiwiaXNNSU1FIiwicmVnaXN0ZXJIZWxwZXIiLCJhZGFwdGl2ZSIsImNhcGFjaXR5IiwiY2h1bmtTaXplIiwibWF4Q2h1bmtTaXplIiwibWF4VHJpZXMiLCJvbkFib3J0Iiwib25Db21wbGV0ZSIsIm9uQ3JlYXRlIiwib25FcnJvciIsIm9uUHJvZ3Jlc3MiLCJvblN0YXJ0Iiwib25TdG9wIiwicmV0cnlEZWxheSIsInRyYW5zZmVyRGVsYXkiLCJSYW5nZUVycm9yIiwiQmxvYiIsIkZpbGUiLCJjYXBhY2l0eU1hcmdpbiIsIm9mZnNldCIsImxvYWRlZCIsInRyaWVzIiwicG9zdFVybCIsInRpbWVBIiwidGltZUIiLCJlbGFwc2VkVGltZSIsInN0YXJ0VGltZSIsImZpbmlzaCIsInVwbG9hZGVkRmlsZSIsImFib3J0IiwiZ2V0QXZlcmFnZVNwZWVkIiwic2Vjb25kcyIsImdldEVsYXBzZWRUaW1lIiwiZ2V0TG9hZGVkIiwiaXNVcGxvYWRpbmciLCJub3ciLCJnZXRGaWxlIiwiZ2V0UHJvZ3Jlc3MiLCJnZXRSZW1haW5pbmdUaW1lIiwiYXZlcmFnZVNwZWVkIiwicmVtYWluaW5nQnl0ZXMiLCJtYXgiLCJnZXRTcGVlZCIsImdldFRvdGFsIiwiaXNDb21wbGV0ZSIsInJlYWRDaHVuayIsInNsaWNlIiwic2V0VGltZW91dCIsInNlbmRDaHVuayIsImR1cmF0aW9uIiwiYWJzIiwieGhyIiwiWE1MSHR0cFJlcXVlc3QiLCJvbnJlYWR5c3RhdGVjaGFuZ2UiLCJyZWFkeVN0YXRlIiwib3BlbiIsInNlbmQiLCJzdG9wIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTUEsVUFBUUMsTUFBZDtBQUFxQkQsUUFBUUUsTUFBUixDQUFlO0FBQUNDLGNBQVMsTUFBSUE7QUFBZCxDQUFmOztBQUF3QyxJQUFJQyxDQUFKOztB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QWIsRUFBbUI7QUFDZjhCLGdCQUFRQyxLQUFSLENBQWUsUUFBTzRELElBQUllLE9BQVEsRUFBbEM7QUFDSCxLQXJkaUIsQ0F1ZGxCOzs7Ozs7QUFLQW1LLGVBQVc3USxJQUFYLEVBQWlCK0gsUUFBakIsRUFBMkIsQ0FDMUIsQ0E3ZGlCLENBK2RsQjs7Ozs7QUFJQStJLFlBQVE5USxJQUFSLEVBQWMsQ0FDYixDQXBlaUIsQ0FzZWxCOzs7OztBQUlBK1EsV0FBTy9RLElBQVAsRUFBYSxDQUNaOztBQTNlaUIsQyIsImZpbGUiOiIvcGFja2FnZXMvamFsaWtfdWZzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuICogVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqXHJcbiAqIENvcHlyaWdodCAoYykgMjAxNyBLYXJsIFNURUlOXHJcbiAqXHJcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcclxuICogb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbFxyXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXHJcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcclxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXHJcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XHJcbiAqXHJcbiAqIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbFxyXG4gKiBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG4gKlxyXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SXHJcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxyXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcclxuICogQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxyXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxyXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRVxyXG4gKiBTT0ZUV0FSRS5cclxuICpcclxuICovXHJcbmltcG9ydCB7X30gZnJvbSBcIm1ldGVvci91bmRlcnNjb3JlXCI7XHJcbmltcG9ydCB7TWV0ZW9yfSBmcm9tIFwibWV0ZW9yL21ldGVvclwiO1xyXG5pbXBvcnQge01vbmdvfSBmcm9tIFwibWV0ZW9yL21vbmdvXCI7XHJcbmltcG9ydCB7TUlNRX0gZnJvbSBcIi4vdWZzLW1pbWVcIjtcclxuaW1wb3J0IHtSYW5kb219IGZyb20gXCJtZXRlb3IvcmFuZG9tXCI7XHJcbmltcG9ydCB7VG9rZW5zfSBmcm9tIFwiLi91ZnMtdG9rZW5zXCI7XHJcbmltcG9ydCB7Q29uZmlnfSBmcm9tIFwiLi91ZnMtY29uZmlnXCI7XHJcbmltcG9ydCB7RmlsdGVyfSBmcm9tIFwiLi91ZnMtZmlsdGVyXCI7XHJcbmltcG9ydCB7U3RvcmV9IGZyb20gXCIuL3Vmcy1zdG9yZVwiO1xyXG5pbXBvcnQge1N0b3JlUGVybWlzc2lvbnN9IGZyb20gXCIuL3Vmcy1zdG9yZS1wZXJtaXNzaW9uc1wiO1xyXG5pbXBvcnQge1VwbG9hZGVyfSBmcm9tIFwiLi91ZnMtdXBsb2FkZXJcIjtcclxuXHJcblxyXG5sZXQgc3RvcmVzID0ge307XHJcblxyXG5leHBvcnQgY29uc3QgVXBsb2FkRlMgPSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb250YWlucyBhbGwgc3RvcmVzXHJcbiAgICAgKi9cclxuICAgIHN0b3JlOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbGxlY3Rpb24gb2YgdG9rZW5zXHJcbiAgICAgKi9cclxuICAgIHRva2VuczogVG9rZW5zLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyB0aGUgXCJldGFnXCIgYXR0cmlidXRlIHRvIGZpbGVzXHJcbiAgICAgKiBAcGFyYW0gd2hlcmVcclxuICAgICAqL1xyXG4gICAgYWRkRVRhZ0F0dHJpYnV0ZVRvRmlsZXMod2hlcmUpIHtcclxuICAgICAgICBfLmVhY2godGhpcy5nZXRTdG9yZXMoKSwgKHN0b3JlKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gc3RvcmUuZ2V0Q29sbGVjdGlvbigpO1xyXG5cclxuICAgICAgICAgICAgLy8gQnkgZGVmYXVsdCB1cGRhdGUgb25seSBmaWxlcyB3aXRoIG5vIHBhdGggc2V0XHJcbiAgICAgICAgICAgIGZpbGVzLmZpbmQod2hlcmUgfHwge2V0YWc6IG51bGx9LCB7ZmllbGRzOiB7X2lkOiAxfX0pLmZvckVhY2goKGZpbGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGZpbGVzLmRpcmVjdC51cGRhdGUoZmlsZS5faWQsIHskc2V0OiB7ZXRhZzogdGhpcy5nZW5lcmF0ZUV0YWcoKX19KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyB0aGUgTUlNRSB0eXBlIGZvciBhbiBleHRlbnNpb25cclxuICAgICAqIEBwYXJhbSBleHRlbnNpb25cclxuICAgICAqIEBwYXJhbSBtaW1lXHJcbiAgICAgKi9cclxuICAgIGFkZE1pbWVUeXBlKGV4dGVuc2lvbiwgbWltZSkge1xyXG4gICAgICAgIE1JTUVbZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCldID0gbWltZTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIHRoZSBcInBhdGhcIiBhdHRyaWJ1dGUgdG8gZmlsZXNcclxuICAgICAqIEBwYXJhbSB3aGVyZVxyXG4gICAgICovXHJcbiAgICBhZGRQYXRoQXR0cmlidXRlVG9GaWxlcyh3aGVyZSkge1xyXG4gICAgICAgIF8uZWFjaCh0aGlzLmdldFN0b3JlcygpLCAoc3RvcmUpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBzdG9yZS5nZXRDb2xsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBCeSBkZWZhdWx0IHVwZGF0ZSBvbmx5IGZpbGVzIHdpdGggbm8gcGF0aCBzZXRcclxuICAgICAgICAgICAgZmlsZXMuZmluZCh3aGVyZSB8fCB7cGF0aDogbnVsbH0sIHtmaWVsZHM6IHtfaWQ6IDF9fSkuZm9yRWFjaCgoZmlsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgZmlsZXMuZGlyZWN0LnVwZGF0ZShmaWxlLl9pZCwgeyRzZXQ6IHtwYXRoOiBzdG9yZS5nZXRGaWxlUmVsYXRpdmVVUkwoZmlsZS5faWQpfX0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWdpc3RlcnMgdGhlIHN0b3JlXHJcbiAgICAgKiBAcGFyYW0gc3RvcmVcclxuICAgICAqL1xyXG4gICAgYWRkU3RvcmUoc3RvcmUpIHtcclxuICAgICAgICBpZiAoIShzdG9yZSBpbnN0YW5jZW9mIFN0b3JlKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGB1ZnM6IHN0b3JlIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBVcGxvYWRGUy5TdG9yZS5gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3RvcmVzW3N0b3JlLmdldE5hbWUoKV0gPSBzdG9yZTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZW5lcmF0ZXMgYSB1bmlxdWUgRVRhZ1xyXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICBnZW5lcmF0ZUV0YWcoKSB7XHJcbiAgICAgICAgcmV0dXJuIFJhbmRvbS5pZCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIE1JTUUgdHlwZSBvZiB0aGUgZXh0ZW5zaW9uXHJcbiAgICAgKiBAcGFyYW0gZXh0ZW5zaW9uXHJcbiAgICAgKiBAcmV0dXJucyB7Kn1cclxuICAgICAqL1xyXG4gICAgZ2V0TWltZVR5cGUoZXh0ZW5zaW9uKSB7XHJcbiAgICAgICAgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgcmV0dXJuIE1JTUVbZXh0ZW5zaW9uXTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIGFsbCBNSU1FIHR5cGVzXHJcbiAgICAgKi9cclxuICAgIGdldE1pbWVUeXBlcygpIHtcclxuICAgICAgICByZXR1cm4gTUlNRTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBzdG9yZSBieSBpdHMgbmFtZVxyXG4gICAgICogQHBhcmFtIG5hbWVcclxuICAgICAqIEByZXR1cm4ge1VwbG9hZEZTLlN0b3JlfVxyXG4gICAgICovXHJcbiAgICBnZXRTdG9yZShuYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIHN0b3Jlc1tuYW1lXTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIGFsbCBzdG9yZXNcclxuICAgICAqIEByZXR1cm4ge29iamVjdH1cclxuICAgICAqL1xyXG4gICAgZ2V0U3RvcmVzKCkge1xyXG4gICAgICAgIHJldHVybiBzdG9yZXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgdGVtcG9yYXJ5IGZpbGUgcGF0aFxyXG4gICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICBnZXRUZW1wRmlsZVBhdGgoZmlsZUlkKSB7XHJcbiAgICAgICAgcmV0dXJuIGAke3RoaXMuY29uZmlnLnRtcERpcn0vJHtmaWxlSWR9YDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJbXBvcnRzIGEgZmlsZSBmcm9tIGEgVVJMXHJcbiAgICAgKiBAcGFyYW0gdXJsXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICogQHBhcmFtIHN0b3JlXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2tcclxuICAgICAqL1xyXG4gICAgaW1wb3J0RnJvbVVSTCh1cmwsIGZpbGUsIHN0b3JlLCBjYWxsYmFjaykge1xyXG4gICAgICAgIGlmICh0eXBlb2Ygc3RvcmUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIE1ldGVvci5jYWxsKCd1ZnNJbXBvcnRVUkwnLCB1cmwsIGZpbGUsIHN0b3JlLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBzdG9yZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgc3RvcmUuaW1wb3J0RnJvbVVSTCh1cmwsIGZpbGUsIGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyBmaWxlIGFuZCBkYXRhIGFzIEFycmF5QnVmZmVyIGZvciBlYWNoIGZpbGVzIGluIHRoZSBldmVudFxyXG4gICAgICogQGRlcHJlY2F0ZWRcclxuICAgICAqIEBwYXJhbSBldmVudFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgKi9cclxuICAgIHJlYWRBc0FycmF5QnVmZmVyIChldmVudCwgY2FsbGJhY2spIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdVcGxvYWRGUy5yZWFkQXNBcnJheUJ1ZmZlciBpcyBkZXByZWNhdGVkLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbGlrL2phbGlrLXVmcyN1cGxvYWRpbmctZnJvbS1hLWZpbGUnKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPcGVucyBhIGRpYWxvZyB0byBzZWxlY3QgYSBzaW5nbGUgZmlsZVxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgKi9cclxuICAgIHNlbGVjdEZpbGUoY2FsbGJhY2spIHtcclxuICAgICAgICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgICAgICAgaW5wdXQudHlwZSA9ICdmaWxlJztcclxuICAgICAgICBpbnB1dC5tdWx0aXBsZSA9IGZhbHNlO1xyXG4gICAgICAgIGlucHV0Lm9uY2hhbmdlID0gKGV2KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBmaWxlcyA9IGV2LnRhcmdldC5maWxlcztcclxuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChVcGxvYWRGUywgZmlsZXNbMF0pO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgLy8gRml4IGZvciBpT1MvU2FmYXJpXHJcbiAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgZGl2LmNsYXNzTmFtZSA9ICd1ZnMtZmlsZS1zZWxlY3Rvcic7XHJcbiAgICAgICAgZGl2LnN0eWxlID0gJ2Rpc3BsYXk6bm9uZTsgaGVpZ2h0OjA7IHdpZHRoOjA7IG92ZXJmbG93OiBoaWRkZW47JztcclxuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoaW5wdXQpO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICAgICAgICAvLyBUcmlnZ2VyIGZpbGUgc2VsZWN0aW9uXHJcbiAgICAgICAgaW5wdXQuY2xpY2soKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPcGVucyBhIGRpYWxvZyB0byBzZWxlY3QgbXVsdGlwbGUgZmlsZXNcclxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xyXG4gICAgICovXHJcbiAgICBzZWxlY3RGaWxlcyhjYWxsYmFjaykge1xyXG4gICAgICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgICAgICBpbnB1dC50eXBlID0gJ2ZpbGUnO1xyXG4gICAgICAgIGlucHV0Lm11bHRpcGxlID0gdHJ1ZTtcclxuICAgICAgICBpbnB1dC5vbmNoYW5nZSA9IChldikgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IGV2LnRhcmdldC5maWxlcztcclxuXHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpICs9IDEpIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoVXBsb2FkRlMsIGZpbGVzW2ldKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgLy8gRml4IGZvciBpT1MvU2FmYXJpXHJcbiAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgZGl2LmNsYXNzTmFtZSA9ICd1ZnMtZmlsZS1zZWxlY3Rvcic7XHJcbiAgICAgICAgZGl2LnN0eWxlID0gJ2Rpc3BsYXk6bm9uZTsgaGVpZ2h0OjA7IHdpZHRoOjA7IG92ZXJmbG93OiBoaWRkZW47JztcclxuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoaW5wdXQpO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICAgICAgICAvLyBUcmlnZ2VyIGZpbGUgc2VsZWN0aW9uXHJcbiAgICAgICAgaW5wdXQuY2xpY2soKTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5pZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XHJcbiAgICByZXF1aXJlKCcuL3Vmcy10ZW1wbGF0ZS1oZWxwZXJzJyk7XHJcbn1cclxuaWYgKE1ldGVvci5pc1NlcnZlcikge1xyXG4gICAgcmVxdWlyZSgnLi91ZnMtbWV0aG9kcycpO1xyXG4gICAgcmVxdWlyZSgnLi91ZnMtc2VydmVyJyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVcGxvYWRGUyBDb25maWd1cmF0aW9uXHJcbiAqIEB0eXBlIHtDb25maWd9XHJcbiAqL1xyXG5VcGxvYWRGUy5jb25maWcgPSBuZXcgQ29uZmlnKCk7XHJcblxyXG4vLyBBZGQgY2xhc3NlcyB0byBnbG9iYWwgbmFtZXNwYWNlXHJcblVwbG9hZEZTLkNvbmZpZyA9IENvbmZpZztcclxuVXBsb2FkRlMuRmlsdGVyID0gRmlsdGVyO1xyXG5VcGxvYWRGUy5TdG9yZSA9IFN0b3JlO1xyXG5VcGxvYWRGUy5TdG9yZVBlcm1pc3Npb25zID0gU3RvcmVQZXJtaXNzaW9ucztcclxuVXBsb2FkRlMuVXBsb2FkZXIgPSBVcGxvYWRlcjtcclxuXHJcbmlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcclxuICAgIC8vIEV4cG9zZSB0aGUgbW9kdWxlIGdsb2JhbGx5XHJcbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICBnbG9iYWxbJ1VwbG9hZEZTJ10gPSBVcGxvYWRGUztcclxuICAgIH1cclxufVxyXG5lbHNlIGlmIChNZXRlb3IuaXNDbGllbnQpIHtcclxuICAgIC8vIEV4cG9zZSB0aGUgbW9kdWxlIGdsb2JhbGx5XHJcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICB3aW5kb3cuVXBsb2FkRlMgPSBVcGxvYWRGUztcclxuICAgIH1cclxufVxyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuXHJcbmltcG9ydCB7X30gZnJvbSAnbWV0ZW9yL3VuZGVyc2NvcmUnO1xyXG5pbXBvcnQge01ldGVvcn0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XHJcbmltcG9ydCB7U3RvcmVQZXJtaXNzaW9uc30gZnJvbSAnLi91ZnMtc3RvcmUtcGVybWlzc2lvbnMnO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBVcGxvYWRGUyBjb25maWd1cmF0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29uZmlnIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICAgICAgLy8gRGVmYXVsdCBvcHRpb25zXHJcbiAgICAgICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHtcclxuICAgICAgICAgICAgZGVmYXVsdFN0b3JlUGVybWlzc2lvbnM6IG51bGwsXHJcbiAgICAgICAgICAgIGh0dHBzOiBmYWxzZSxcclxuICAgICAgICAgICAgc2ltdWxhdGVSZWFkRGVsYXk6IDAsXHJcbiAgICAgICAgICAgIHNpbXVsYXRlVXBsb2FkU3BlZWQ6IDAsXHJcbiAgICAgICAgICAgIHNpbXVsYXRlV3JpdGVEZWxheTogMCxcclxuICAgICAgICAgICAgc3RvcmVzUGF0aDogJ3VmcycsXHJcbiAgICAgICAgICAgIHRtcERpcjogJy90bXAvdWZzJyxcclxuICAgICAgICAgICAgdG1wRGlyUGVybWlzc2lvbnM6ICcwNzAwJ1xyXG4gICAgICAgIH0sIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBDaGVjayBvcHRpb25zXHJcbiAgICAgICAgaWYgKG9wdGlvbnMuZGVmYXVsdFN0b3JlUGVybWlzc2lvbnMgJiYgIShvcHRpb25zLmRlZmF1bHRTdG9yZVBlcm1pc3Npb25zIGluc3RhbmNlb2YgU3RvcmVQZXJtaXNzaW9ucykpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ29uZmlnOiBkZWZhdWx0U3RvcmVQZXJtaXNzaW9ucyBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgU3RvcmVQZXJtaXNzaW9ucycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuaHR0cHMgIT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDb25maWc6IGh0dHBzIGlzIG5vdCBhIGZ1bmN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5zaW11bGF0ZVJlYWREZWxheSAhPT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ29uZmlnOiBzaW11bGF0ZVJlYWREZWxheSBpcyBub3QgYSBudW1iZXInKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnNpbXVsYXRlVXBsb2FkU3BlZWQgIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0NvbmZpZzogc2ltdWxhdGVVcGxvYWRTcGVlZCBpcyBub3QgYSBudW1iZXInKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnNpbXVsYXRlV3JpdGVEZWxheSAhPT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ29uZmlnOiBzaW11bGF0ZVdyaXRlRGVsYXkgaXMgbm90IGEgbnVtYmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5zdG9yZXNQYXRoICE9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDb25maWc6IHN0b3Jlc1BhdGggaXMgbm90IGEgc3RyaW5nJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy50bXBEaXIgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0NvbmZpZzogdG1wRGlyIGlzIG5vdCBhIHN0cmluZycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMudG1wRGlyUGVybWlzc2lvbnMgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0NvbmZpZzogdG1wRGlyUGVybWlzc2lvbnMgaXMgbm90IGEgc3RyaW5nJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEZWZhdWx0IHN0b3JlIHBlcm1pc3Npb25zXHJcbiAgICAgICAgICogQHR5cGUge1VwbG9hZEZTLlN0b3JlUGVybWlzc2lvbnN9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5kZWZhdWx0U3RvcmVQZXJtaXNzaW9ucyA9IG9wdGlvbnMuZGVmYXVsdFN0b3JlUGVybWlzc2lvbnM7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVXNlIG9yIG5vdCBzZWN1cmVkIHByb3RvY29sIGluIFVSTFNcclxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLmh0dHBzID0gb3B0aW9ucy5odHRwcztcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgc2ltdWxhdGlvbiByZWFkIGRlbGF5XHJcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnNpbXVsYXRlUmVhZERlbGF5ID0gcGFyc2VJbnQob3B0aW9ucy5zaW11bGF0ZVJlYWREZWxheSk7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIHNpbXVsYXRpb24gdXBsb2FkIHNwZWVkXHJcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnNpbXVsYXRlVXBsb2FkU3BlZWQgPSBwYXJzZUludChvcHRpb25zLnNpbXVsYXRlVXBsb2FkU3BlZWQpO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRoZSBzaW11bGF0aW9uIHdyaXRlIGRlbGF5XHJcbiAgICAgICAgICogQHR5cGUge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnNpbXVsYXRlV3JpdGVEZWxheSA9IHBhcnNlSW50KG9wdGlvbnMuc2ltdWxhdGVXcml0ZURlbGF5KTtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgVVJMIHJvb3QgcGF0aCBvZiBzdG9yZXNcclxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuc3RvcmVzUGF0aCA9IG9wdGlvbnMuc3RvcmVzUGF0aDtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUaGUgdGVtcG9yYXJ5IGRpcmVjdG9yeSBvZiB1cGxvYWRpbmcgZmlsZXNcclxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMudG1wRGlyID0gb3B0aW9ucy50bXBEaXI7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVGhlIHBlcm1pc3Npb25zIG9mIHRoZSB0ZW1wb3JhcnkgZGlyZWN0b3J5XHJcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnRtcERpclBlcm1pc3Npb25zID0gb3B0aW9ucy50bXBEaXJQZXJtaXNzaW9ucztcclxuICAgIH1cclxufVxyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuaW1wb3J0IHtffSBmcm9tIFwibWV0ZW9yL3VuZGVyc2NvcmVcIjtcclxuaW1wb3J0IHtNZXRlb3J9IGZyb20gXCJtZXRlb3IvbWV0ZW9yXCI7XHJcblxyXG5cclxuLyoqXHJcbiAqIEZpbGUgZmlsdGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRmlsdGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgICAgIC8vIERlZmF1bHQgb3B0aW9uc1xyXG4gICAgICAgIG9wdGlvbnMgPSBfLmV4dGVuZCh7XHJcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlczogbnVsbCxcclxuICAgICAgICAgICAgZXh0ZW5zaW9uczogbnVsbCxcclxuICAgICAgICAgICAgbWluU2l6ZTogMSxcclxuICAgICAgICAgICAgbWF4U2l6ZTogMCxcclxuICAgICAgICAgICAgb25DaGVjazogdGhpcy5vbkNoZWNrXHJcbiAgICAgICAgfSwgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIENoZWNrIG9wdGlvbnNcclxuICAgICAgICBpZiAob3B0aW9ucy5jb250ZW50VHlwZXMgJiYgIShvcHRpb25zLmNvbnRlbnRUeXBlcyBpbnN0YW5jZW9mIEFycmF5KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmlsdGVyOiBjb250ZW50VHlwZXMgaXMgbm90IGFuIEFycmF5XCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAob3B0aW9ucy5leHRlbnNpb25zICYmICEob3B0aW9ucy5leHRlbnNpb25zIGluc3RhbmNlb2YgQXJyYXkpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGaWx0ZXI6IGV4dGVuc2lvbnMgaXMgbm90IGFuIEFycmF5XCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMubWluU2l6ZSAhPT0gXCJudW1iZXJcIikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmlsdGVyOiBtaW5TaXplIGlzIG5vdCBhIG51bWJlclwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLm1heFNpemUgIT09IFwibnVtYmVyXCIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZpbHRlcjogbWF4U2l6ZSBpcyBub3QgYSBudW1iZXJcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLm9uQ2hlY2sgJiYgdHlwZW9mIG9wdGlvbnMub25DaGVjayAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGaWx0ZXI6IG9uQ2hlY2sgaXMgbm90IGEgZnVuY3Rpb25cIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQdWJsaWMgYXR0cmlidXRlc1xyXG4gICAgICAgIHNlbGYub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgICAgICAgXy5lYWNoKFtcclxuICAgICAgICAgICAgJ29uQ2hlY2snXHJcbiAgICAgICAgXSwgKG1ldGhvZCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnNbbWV0aG9kXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgc2VsZlttZXRob2RdID0gb3B0aW9uc1ttZXRob2RdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgdGhlIGZpbGVcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKi9cclxuICAgIGNoZWNrKGZpbGUpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGZpbGUgIT09IFwib2JqZWN0XCIgfHwgIWZpbGUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1maWxlJywgXCJGaWxlIGlzIG5vdCB2YWxpZFwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gQ2hlY2sgc2l6ZVxyXG4gICAgICAgIGlmIChmaWxlLnNpemUgPD0gMCB8fCBmaWxlLnNpemUgPCB0aGlzLmdldE1pblNpemUoKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdmaWxlLXRvby1zbWFsbCcsIGBGaWxlIHNpemUgaXMgdG9vIHNtYWxsIChtaW4gPSAke3RoaXMuZ2V0TWluU2l6ZSgpfSlgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuZ2V0TWF4U2l6ZSgpID4gMCAmJiBmaWxlLnNpemUgPiB0aGlzLmdldE1heFNpemUoKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdmaWxlLXRvby1sYXJnZScsIGBGaWxlIHNpemUgaXMgdG9vIGxhcmdlIChtYXggPSAke3RoaXMuZ2V0TWF4U2l6ZSgpfSlgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gQ2hlY2sgZXh0ZW5zaW9uXHJcbiAgICAgICAgaWYgKHRoaXMuZ2V0RXh0ZW5zaW9ucygpICYmICFfLmNvbnRhaW5zKHRoaXMuZ2V0RXh0ZW5zaW9ucygpLCBmaWxlLmV4dGVuc2lvbikpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1maWxlLWV4dGVuc2lvbicsIGBGaWxlIGV4dGVuc2lvbiBcIiR7ZmlsZS5leHRlbnNpb259XCIgaXMgbm90IGFjY2VwdGVkYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIENoZWNrIGNvbnRlbnQgdHlwZVxyXG4gICAgICAgIGlmICh0aGlzLmdldENvbnRlbnRUeXBlcygpICYmICF0aGlzLmlzQ29udGVudFR5cGVJbkxpc3QoZmlsZS50eXBlLCB0aGlzLmdldENvbnRlbnRUeXBlcygpKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWZpbGUtdHlwZScsIGBGaWxlIHR5cGUgXCIke2ZpbGUudHlwZX1cIiBpcyBub3QgYWNjZXB0ZWRgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gQXBwbHkgY3VzdG9tIGNoZWNrXHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uQ2hlY2sgPT09ICdmdW5jdGlvbicgJiYgIXRoaXMub25DaGVjayhmaWxlKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWZpbGUnLCBcIkZpbGUgZG9lcyBub3QgbWF0Y2ggZmlsdGVyXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIGFsbG93ZWQgY29udGVudCB0eXBlc1xyXG4gICAgICogQHJldHVybiB7QXJyYXl9XHJcbiAgICAgKi9cclxuICAgIGdldENvbnRlbnRUeXBlcygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmNvbnRlbnRUeXBlcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIGFsbG93ZWQgZXh0ZW5zaW9uc1xyXG4gICAgICogQHJldHVybiB7QXJyYXl9XHJcbiAgICAgKi9cclxuICAgIGdldEV4dGVuc2lvbnMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5leHRlbnNpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgbWF4aW11bSBmaWxlIHNpemVcclxuICAgICAqIEByZXR1cm4ge051bWJlcn1cclxuICAgICAqL1xyXG4gICAgZ2V0TWF4U2l6ZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLm1heFNpemU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBtaW5pbXVtIGZpbGUgc2l6ZVxyXG4gICAgICogQHJldHVybiB7TnVtYmVyfVxyXG4gICAgICovXHJcbiAgICBnZXRNaW5TaXplKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMubWluU2l6ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiBjb250ZW50IHR5cGUgaXMgaW4gdGhlIGdpdmVuIGxpc3RcclxuICAgICAqIEBwYXJhbSB0eXBlXHJcbiAgICAgKiBAcGFyYW0gbGlzdFxyXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgaXNDb250ZW50VHlwZUluTGlzdCh0eXBlLCBsaXN0KSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyAmJiBsaXN0IGluc3RhbmNlb2YgQXJyYXkpIHtcclxuICAgICAgICAgICAgaWYgKF8uY29udGFpbnMobGlzdCwgdHlwZSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbGV0IHdpbGRDYXJkR2xvYiA9ICcvKic7XHJcbiAgICAgICAgICAgICAgICBsZXQgd2lsZGNhcmRzID0gXy5maWx0ZXIobGlzdCwgKGl0ZW0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5pbmRleE9mKHdpbGRDYXJkR2xvYikgPiAwO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKF8uY29udGFpbnMod2lsZGNhcmRzLCB0eXBlLnJlcGxhY2UoLyhcXC8uKikkLywgd2lsZENhcmRHbG9iKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgaWYgdGhlIGZpbGUgbWF0Y2hlcyBmaWx0ZXJcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxyXG4gICAgICovXHJcbiAgICBpc1ZhbGlkKGZpbGUpIHtcclxuICAgICAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrKGZpbGUpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICByZXN1bHQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEV4ZWN1dGVzIGN1c3RvbSBjaGVja3NcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxyXG4gICAgICovXHJcbiAgICBvbkNoZWNrKGZpbGUpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxufVxyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuXHJcbmltcG9ydCB7X30gZnJvbSAnbWV0ZW9yL3VuZGVyc2NvcmUnO1xyXG5pbXBvcnQge2NoZWNrfSBmcm9tICdtZXRlb3IvY2hlY2snO1xyXG5pbXBvcnQge01ldGVvcn0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XHJcbmltcG9ydCB7VXBsb2FkRlN9IGZyb20gJy4vdWZzJztcclxuaW1wb3J0IHtGaWx0ZXJ9IGZyb20gJy4vdWZzLWZpbHRlcic7XHJcbmltcG9ydCB7VG9rZW5zfSBmcm9tICcuL3Vmcy10b2tlbnMnO1xyXG5cclxuY29uc3QgZnMgPSBOcG0ucmVxdWlyZSgnZnMnKTtcclxuY29uc3QgaHR0cCA9IE5wbS5yZXF1aXJlKCdodHRwJyk7XHJcbmNvbnN0IGh0dHBzID0gTnBtLnJlcXVpcmUoJ2h0dHBzJyk7XHJcbmNvbnN0IEZ1dHVyZSA9IE5wbS5yZXF1aXJlKCdmaWJlcnMvZnV0dXJlJyk7XHJcblxyXG5cclxuaWYgKE1ldGVvci5pc1NlcnZlcikge1xyXG4gICAgTWV0ZW9yLm1ldGhvZHMoe1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDb21wbGV0ZXMgdGhlIGZpbGUgdHJhbnNmZXJcclxuICAgICAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgICAgICogQHBhcmFtIHN0b3JlTmFtZVxyXG4gICAgICAgICAqIEBwYXJhbSB0b2tlblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVmc0NvbXBsZXRlKGZpbGVJZCwgc3RvcmVOYW1lLCB0b2tlbikge1xyXG4gICAgICAgICAgICBjaGVjayhmaWxlSWQsIFN0cmluZyk7XHJcbiAgICAgICAgICAgIGNoZWNrKHN0b3JlTmFtZSwgU3RyaW5nKTtcclxuICAgICAgICAgICAgY2hlY2sodG9rZW4sIFN0cmluZyk7XHJcblxyXG4gICAgICAgICAgICAvLyBHZXQgc3RvcmVcclxuICAgICAgICAgICAgbGV0IHN0b3JlID0gVXBsb2FkRlMuZ2V0U3RvcmUoc3RvcmVOYW1lKTtcclxuICAgICAgICAgICAgaWYgKCFzdG9yZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1zdG9yZScsIFwiU3RvcmUgbm90IGZvdW5kXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIENoZWNrIHRva2VuXHJcbiAgICAgICAgICAgIGlmICghc3RvcmUuY2hlY2tUb2tlbih0b2tlbiwgZmlsZUlkKSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC10b2tlbicsIFwiVG9rZW4gaXMgbm90IHZhbGlkXCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgZnV0ID0gbmV3IEZ1dHVyZSgpO1xyXG4gICAgICAgICAgICBsZXQgdG1wRmlsZSA9IFVwbG9hZEZTLmdldFRlbXBGaWxlUGF0aChmaWxlSWQpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVtb3ZlVGVtcEZpbGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBmcy51bmxpbmsodG1wRmlsZSwgZnVuY3Rpb24gKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIGVyciAmJiBjb25zb2xlLmVycm9yKGB1ZnM6IGNhbm5vdCBkZWxldGUgdGVtcCBmaWxlIFwiJHt0bXBGaWxlfVwiICgke2Vyci5tZXNzYWdlfSlgKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIC8vIHRvZG8gY2hlY2sgaWYgdGVtcCBmaWxlIGV4aXN0c1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEdldCBmaWxlXHJcbiAgICAgICAgICAgICAgICBsZXQgZmlsZSA9IHN0b3JlLmdldENvbGxlY3Rpb24oKS5maW5kT25lKHtfaWQ6IGZpbGVJZH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIGZpbGUgYmVmb3JlIG1vdmluZyB0byB0aGUgc3RvcmVcclxuICAgICAgICAgICAgICAgIHN0b3JlLnZhbGlkYXRlKGZpbGUpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgdGVtcCBmaWxlXHJcbiAgICAgICAgICAgICAgICBsZXQgcnMgPSBmcy5jcmVhdGVSZWFkU3RyZWFtKHRtcEZpbGUsIHtcclxuICAgICAgICAgICAgICAgICAgICBmbGFnczogJ3InLFxyXG4gICAgICAgICAgICAgICAgICAgIGVuY29kaW5nOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIGF1dG9DbG9zZTogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ2xlYW4gdXBsb2FkIGlmIGVycm9yIG9jY3Vyc1xyXG4gICAgICAgICAgICAgICAgcnMub24oJ2Vycm9yJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN0b3JlLmdldENvbGxlY3Rpb24oKS5yZW1vdmUoe19pZDogZmlsZUlkfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZnV0LnRocm93KGVycik7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gU2F2ZSBmaWxlIGluIHRoZSBzdG9yZVxyXG4gICAgICAgICAgICAgICAgc3RvcmUud3JpdGUocnMsIGZpbGVJZCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbiAoZXJyLCBmaWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlVGVtcEZpbGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmdXQudGhyb3coZXJyKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGaWxlIGhhcyBiZWVuIGZ1bGx5IHVwbG9hZGVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNvIHdlIGRvbid0IG5lZWQgdG8ga2VlcCB0aGUgdG9rZW4gYW55bW9yZS5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWxzbyB0aGlzIGVuc3VyZSB0aGF0IHRoZSBmaWxlIGNhbm5vdCBiZSBtb2RpZmllZCB3aXRoIGV4dHJhIGNodW5rcyBsYXRlci5cclxuICAgICAgICAgICAgICAgICAgICAgICAgVG9rZW5zLnJlbW92ZSh7ZmlsZUlkOiBmaWxlSWR9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnV0LnJldHVybihmaWxlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgLy8gSWYgd3JpdGUgZmFpbGVkLCByZW1vdmUgdGhlIGZpbGVcclxuICAgICAgICAgICAgICAgIHN0b3JlLmdldENvbGxlY3Rpb24oKS5yZW1vdmUoe19pZDogZmlsZUlkfSk7XHJcbiAgICAgICAgICAgICAgICAvLyByZW1vdmVUZW1wRmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgZnV0LnRocm93KGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZ1dC53YWl0KCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQ3JlYXRlcyB0aGUgZmlsZSBhbmQgcmV0dXJucyB0aGUgZmlsZSB1cGxvYWQgdG9rZW5cclxuICAgICAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICAgICAqIEByZXR1cm4ge3tmaWxlSWQ6IHN0cmluZywgdG9rZW46ICosIHVybDogKn19XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdWZzQ3JlYXRlKGZpbGUpIHtcclxuICAgICAgICAgICAgY2hlY2soZmlsZSwgT2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZS5uYW1lICE9PSAnc3RyaW5nJyB8fCAhZmlsZS5uYW1lLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1maWxlLW5hbWUnLCBcImZpbGUgbmFtZSBpcyBub3QgdmFsaWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaWxlLnN0b3JlICE9PSAnc3RyaW5nJyB8fCAhZmlsZS5zdG9yZS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtc3RvcmUnLCBcInN0b3JlIGlzIG5vdCB2YWxpZFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBHZXQgc3RvcmVcclxuICAgICAgICAgICAgbGV0IHN0b3JlID0gVXBsb2FkRlMuZ2V0U3RvcmUoZmlsZS5zdG9yZSk7XHJcbiAgICAgICAgICAgIGlmICghc3RvcmUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtc3RvcmUnLCBcIlN0b3JlIG5vdCBmb3VuZFwiKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gU2V0IGRlZmF1bHQgaW5mb1xyXG4gICAgICAgICAgICBmaWxlLmNvbXBsZXRlID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZpbGUudXBsb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZpbGUuZXh0ZW5zaW9uID0gZmlsZS5uYW1lICYmIGZpbGUubmFtZS5zdWJzdHIoKH4tZmlsZS5uYW1lLmxhc3RJbmRleE9mKCcuJykgPj4+IDApICsgMikudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgLy8gQXNzaWduIGZpbGUgTUlNRSB0eXBlIGJhc2VkIG9uIHRoZSBleHRlbnNpb25cclxuICAgICAgICAgICAgaWYgKGZpbGUuZXh0ZW5zaW9uICYmICFmaWxlLnR5cGUpIHtcclxuICAgICAgICAgICAgICAgIGZpbGUudHlwZSA9IFVwbG9hZEZTLmdldE1pbWVUeXBlKGZpbGUuZXh0ZW5zaW9uKSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmaWxlLnByb2dyZXNzID0gMDtcclxuICAgICAgICAgICAgZmlsZS5zaXplID0gcGFyc2VJbnQoZmlsZS5zaXplKSB8fCAwO1xyXG4gICAgICAgICAgICBmaWxlLnVzZXJJZCA9IGZpbGUudXNlcklkIHx8IHRoaXMudXNlcklkO1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGZpbGUgbWF0Y2hlcyBzdG9yZSBmaWx0ZXJcclxuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHN0b3JlLmdldEZpbHRlcigpO1xyXG4gICAgICAgICAgICBpZiAoZmlsdGVyIGluc3RhbmNlb2YgRmlsdGVyKSB7XHJcbiAgICAgICAgICAgICAgICBmaWx0ZXIuY2hlY2soZmlsZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgZmlsZVxyXG4gICAgICAgICAgICBsZXQgZmlsZUlkID0gc3RvcmUuY3JlYXRlKGZpbGUpO1xyXG4gICAgICAgICAgICBsZXQgdG9rZW4gPSBzdG9yZS5jcmVhdGVUb2tlbihmaWxlSWQpO1xyXG4gICAgICAgICAgICBsZXQgdXBsb2FkVXJsID0gc3RvcmUuZ2V0VVJMKGAke2ZpbGVJZH0/dG9rZW49JHt0b2tlbn1gKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBmaWxlSWQ6IGZpbGVJZCxcclxuICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbixcclxuICAgICAgICAgICAgICAgIHVybDogdXBsb2FkVXJsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRGVsZXRlcyBhIGZpbGVcclxuICAgICAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgICAgICogQHBhcmFtIHN0b3JlTmFtZVxyXG4gICAgICAgICAqIEBwYXJhbSB0b2tlblxyXG4gICAgICAgICAqIEByZXR1cm5zIHsqfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVmc0RlbGV0ZShmaWxlSWQsIHN0b3JlTmFtZSwgdG9rZW4pIHtcclxuICAgICAgICAgICAgY2hlY2soZmlsZUlkLCBTdHJpbmcpO1xyXG4gICAgICAgICAgICBjaGVjayhzdG9yZU5hbWUsIFN0cmluZyk7XHJcbiAgICAgICAgICAgIGNoZWNrKHRva2VuLCBTdHJpbmcpO1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgc3RvcmVcclxuICAgICAgICAgICAgbGV0IHN0b3JlID0gVXBsb2FkRlMuZ2V0U3RvcmUoc3RvcmVOYW1lKTtcclxuICAgICAgICAgICAgaWYgKCFzdG9yZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1zdG9yZScsIFwiU3RvcmUgbm90IGZvdW5kXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIElnbm9yZSBmaWxlcyB0aGF0IGRvZXMgbm90IGV4aXN0XHJcbiAgICAgICAgICAgIGlmIChzdG9yZS5nZXRDb2xsZWN0aW9uKCkuZmluZCh7X2lkOiBmaWxlSWR9KS5jb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBDaGVjayB0b2tlblxyXG4gICAgICAgICAgICBpZiAoIXN0b3JlLmNoZWNrVG9rZW4odG9rZW4sIGZpbGVJZCkpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtdG9rZW4nLCBcIlRva2VuIGlzIG5vdCB2YWxpZFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gc3RvcmUuZ2V0Q29sbGVjdGlvbigpLnJlbW92ZSh7X2lkOiBmaWxlSWR9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJbXBvcnRzIGEgZmlsZSBmcm9tIHRoZSBVUkxcclxuICAgICAgICAgKiBAcGFyYW0gdXJsXHJcbiAgICAgICAgICogQHBhcmFtIGZpbGVcclxuICAgICAgICAgKiBAcGFyYW0gc3RvcmVOYW1lXHJcbiAgICAgICAgICogQHJldHVybiB7Kn1cclxuICAgICAgICAgKi9cclxuICAgICAgICB1ZnNJbXBvcnRVUkwodXJsLCBmaWxlLCBzdG9yZU5hbWUpIHtcclxuICAgICAgICAgICAgY2hlY2sodXJsLCBTdHJpbmcpO1xyXG4gICAgICAgICAgICBjaGVjayhmaWxlLCBPYmplY3QpO1xyXG4gICAgICAgICAgICBjaGVjayhzdG9yZU5hbWUsIFN0cmluZyk7XHJcblxyXG4gICAgICAgICAgICAvLyBDaGVjayBVUkxcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybC5sZW5ndGggPD0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC11cmwnLCBcIlRoZSB1cmwgaXMgbm90IHZhbGlkXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIENoZWNrIGZpbGVcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaWxlICE9PSAnb2JqZWN0JyB8fCBmaWxlID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLWZpbGUnLCBcIlRoZSBmaWxlIGlzIG5vdCB2YWxpZFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBDaGVjayBzdG9yZVxyXG4gICAgICAgICAgICBjb25zdCBzdG9yZSA9IFVwbG9hZEZTLmdldFN0b3JlKHN0b3JlTmFtZSk7XHJcbiAgICAgICAgICAgIGlmICghc3RvcmUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtc3RvcmUnLCAnVGhlIHN0b3JlIGRvZXMgbm90IGV4aXN0Jyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEV4dHJhY3QgZmlsZSBpbmZvXHJcbiAgICAgICAgICAgIGlmICghZmlsZS5uYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBmaWxlLm5hbWUgPSB1cmwucmVwbGFjZSgvXFw/LiokLywgJycpLnNwbGl0KCcvJykucG9wKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGZpbGUubmFtZSAmJiAhZmlsZS5leHRlbnNpb24pIHtcclxuICAgICAgICAgICAgICAgIGZpbGUuZXh0ZW5zaW9uID0gZmlsZS5uYW1lICYmIGZpbGUubmFtZS5zdWJzdHIoKH4tZmlsZS5uYW1lLmxhc3RJbmRleE9mKCcuJykgPj4+IDApICsgMikudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZmlsZS5leHRlbnNpb24gJiYgIWZpbGUudHlwZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gQXNzaWduIGZpbGUgTUlNRSB0eXBlIGJhc2VkIG9uIHRoZSBleHRlbnNpb25cclxuICAgICAgICAgICAgICAgIGZpbGUudHlwZSA9IFVwbG9hZEZTLmdldE1pbWVUeXBlKGZpbGUuZXh0ZW5zaW9uKSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBDaGVjayBpZiBmaWxlIGlzIHZhbGlkXHJcbiAgICAgICAgICAgIGlmIChzdG9yZS5nZXRGaWx0ZXIoKSBpbnN0YW5jZW9mIEZpbHRlcikge1xyXG4gICAgICAgICAgICAgICAgc3RvcmUuZ2V0RmlsdGVyKCkuY2hlY2soZmlsZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChmaWxlLm9yaWdpbmFsVXJsKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYHVmczogVGhlIFwib3JpZ2luYWxVcmxcIiBhdHRyaWJ1dGUgaXMgYXV0b21hdGljYWxseSBzZXQgd2hlbiBpbXBvcnRpbmcgYSBmaWxlIGZyb20gYSBVUkxgKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQWRkIG9yaWdpbmFsIFVSTFxyXG4gICAgICAgICAgICBmaWxlLm9yaWdpbmFsVXJsID0gdXJsO1xyXG5cclxuICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBmaWxlXHJcbiAgICAgICAgICAgIGZpbGUuY29tcGxldGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgZmlsZS51cGxvYWRpbmcgPSB0cnVlO1xyXG4gICAgICAgICAgICBmaWxlLnByb2dyZXNzID0gMDtcclxuICAgICAgICAgICAgZmlsZS5faWQgPSBzdG9yZS5jcmVhdGUoZmlsZSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgZnV0ID0gbmV3IEZ1dHVyZSgpO1xyXG4gICAgICAgICAgICBsZXQgcHJvdG87XHJcblxyXG4gICAgICAgICAgICAvLyBEZXRlY3QgcHJvdG9jb2wgdG8gdXNlXHJcbiAgICAgICAgICAgIGlmICgvaHR0cDpcXC9cXC8vaS50ZXN0KHVybCkpIHtcclxuICAgICAgICAgICAgICAgIHByb3RvID0gaHR0cDtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICgvaHR0cHM6XFwvXFwvL2kudGVzdCh1cmwpKSB7XHJcbiAgICAgICAgICAgICAgICBwcm90byA9IGh0dHBzO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnVuYmxvY2soKTtcclxuXHJcbiAgICAgICAgICAgIC8vIERvd25sb2FkIGZpbGVcclxuICAgICAgICAgICAgcHJvdG8uZ2V0KHVybCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbiAocmVzKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTYXZlIHRoZSBmaWxlIGluIHRoZSBzdG9yZVxyXG4gICAgICAgICAgICAgICAgc3RvcmUud3JpdGUocmVzLCBmaWxlLl9pZCwgZnVuY3Rpb24gKGVyciwgZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnV0LnRocm93KGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnV0LnJldHVybihmaWxlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSkpLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHtcclxuICAgICAgICAgICAgICAgIGZ1dC50aHJvdyhlcnIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1dC53YWl0KCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogTWFya3MgdGhlIGZpbGUgdXBsb2FkaW5nIGFzIHN0b3BwZWRcclxuICAgICAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgICAgICogQHBhcmFtIHN0b3JlTmFtZVxyXG4gICAgICAgICAqIEBwYXJhbSB0b2tlblxyXG4gICAgICAgICAqIEByZXR1cm5zIHsqfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVmc1N0b3AoZmlsZUlkLCBzdG9yZU5hbWUsIHRva2VuKSB7XHJcbiAgICAgICAgICAgIGNoZWNrKGZpbGVJZCwgU3RyaW5nKTtcclxuICAgICAgICAgICAgY2hlY2soc3RvcmVOYW1lLCBTdHJpbmcpO1xyXG4gICAgICAgICAgICBjaGVjayh0b2tlbiwgU3RyaW5nKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIHN0b3JlXHJcbiAgICAgICAgICAgIGNvbnN0IHN0b3JlID0gVXBsb2FkRlMuZ2V0U3RvcmUoc3RvcmVOYW1lKTtcclxuICAgICAgICAgICAgaWYgKCFzdG9yZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1zdG9yZScsIFwiU3RvcmUgbm90IGZvdW5kXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIENoZWNrIGZpbGVcclxuICAgICAgICAgICAgY29uc3QgZmlsZSA9IHN0b3JlLmdldENvbGxlY3Rpb24oKS5maW5kKHtfaWQ6IGZpbGVJZH0sIHtmaWVsZHM6IHt1c2VySWQ6IDF9fSk7XHJcbiAgICAgICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignaW52YWxpZC1maWxlJywgXCJGaWxlIG5vdCBmb3VuZFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBDaGVjayB0b2tlblxyXG4gICAgICAgICAgICBpZiAoIXN0b3JlLmNoZWNrVG9rZW4odG9rZW4sIGZpbGVJZCkpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtdG9rZW4nLCBcIlRva2VuIGlzIG5vdCB2YWxpZFwiKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHN0b3JlLmdldENvbGxlY3Rpb24oKS51cGRhdGUoe19pZDogZmlsZUlkfSwge1xyXG4gICAgICAgICAgICAgICAgJHNldDoge3VwbG9hZGluZzogZmFsc2V9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcbiIsIi8qXHJcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTcgS2FybCBTVEVJTlxyXG4gKlxyXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XHJcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcclxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xyXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXHJcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xyXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG4gKlxyXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGxcclxuICogY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuICpcclxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxyXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcclxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXHJcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcclxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcclxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEVcclxuICogU09GVFdBUkUuXHJcbiAqXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIE1JTUUgdHlwZXMgYW5kIGV4dGVuc2lvbnNcclxuICovXHJcbmV4cG9ydCBjb25zdCBNSU1FID0ge1xyXG5cclxuICAgIC8vIGFwcGxpY2F0aW9uXHJcbiAgICAnN3onOiAnYXBwbGljYXRpb24veC03ei1jb21wcmVzc2VkJyxcclxuICAgICdhcmMnOiAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyxcclxuICAgICdhaSc6ICdhcHBsaWNhdGlvbi9wb3N0c2NyaXB0JyxcclxuICAgICdiaW4nOiAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyxcclxuICAgICdieic6ICdhcHBsaWNhdGlvbi94LWJ6aXAnLFxyXG4gICAgJ2J6Mic6ICdhcHBsaWNhdGlvbi94LWJ6aXAyJyxcclxuICAgICdlcHMnOiAnYXBwbGljYXRpb24vcG9zdHNjcmlwdCcsXHJcbiAgICAnZXhlJzogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXHJcbiAgICAnZ3onOiAnYXBwbGljYXRpb24veC1nemlwJyxcclxuICAgICdnemlwJzogJ2FwcGxpY2F0aW9uL3gtZ3ppcCcsXHJcbiAgICAnanMnOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXHJcbiAgICAnanNvbic6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICdvZ3gnOiAnYXBwbGljYXRpb24vb2dnJyxcclxuICAgICdwZGYnOiAnYXBwbGljYXRpb24vcGRmJyxcclxuICAgICdwcyc6ICdhcHBsaWNhdGlvbi9wb3N0c2NyaXB0JyxcclxuICAgICdwc2QnOiAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyxcclxuICAgICdyYXInOiAnYXBwbGljYXRpb24veC1yYXItY29tcHJlc3NlZCcsXHJcbiAgICAncmV2JzogJ2FwcGxpY2F0aW9uL3gtcmFyLWNvbXByZXNzZWQnLFxyXG4gICAgJ3N3Zic6ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCcsXHJcbiAgICAndGFyJzogJ2FwcGxpY2F0aW9uL3gtdGFyJyxcclxuICAgICd4aHRtbCc6ICdhcHBsaWNhdGlvbi94aHRtbCt4bWwnLFxyXG4gICAgJ3htbCc6ICdhcHBsaWNhdGlvbi94bWwnLFxyXG4gICAgJ3ppcCc6ICdhcHBsaWNhdGlvbi96aXAnLFxyXG5cclxuICAgIC8vIGF1ZGlvXHJcbiAgICAnYWlmJzogJ2F1ZGlvL2FpZmYnLFxyXG4gICAgJ2FpZmMnOiAnYXVkaW8vYWlmZicsXHJcbiAgICAnYWlmZic6ICdhdWRpby9haWZmJyxcclxuICAgICdhdSc6ICdhdWRpby9iYXNpYycsXHJcbiAgICAnZmxhYyc6ICdhdWRpby9mbGFjJyxcclxuICAgICdtaWRpJzogJ2F1ZGlvL21pZGknLFxyXG4gICAgJ21wMic6ICdhdWRpby9tcGVnJyxcclxuICAgICdtcDMnOiAnYXVkaW8vbXBlZycsXHJcbiAgICAnbXBhJzogJ2F1ZGlvL21wZWcnLFxyXG4gICAgJ29nYSc6ICdhdWRpby9vZ2cnLFxyXG4gICAgJ29nZyc6ICdhdWRpby9vZ2cnLFxyXG4gICAgJ29wdXMnOiAnYXVkaW8vb2dnJyxcclxuICAgICdyYSc6ICdhdWRpby92bmQucm4tcmVhbGF1ZGlvJyxcclxuICAgICdzcHgnOiAnYXVkaW8vb2dnJyxcclxuICAgICd3YXYnOiAnYXVkaW8veC13YXYnLFxyXG4gICAgJ3dlYmEnOiAnYXVkaW8vd2VibScsXHJcbiAgICAnd21hJzogJ2F1ZGlvL3gtbXMtd21hJyxcclxuXHJcbiAgICAvLyBpbWFnZVxyXG4gICAgJ2F2cyc6ICdpbWFnZS9hdnMtdmlkZW8nLFxyXG4gICAgJ2JtcCc6ICdpbWFnZS94LXdpbmRvd3MtYm1wJyxcclxuICAgICdnaWYnOiAnaW1hZ2UvZ2lmJyxcclxuICAgICdpY28nOiAnaW1hZ2Uvdm5kLm1pY3Jvc29mdC5pY29uJyxcclxuICAgICdqcGVnJzogJ2ltYWdlL2pwZWcnLFxyXG4gICAgJ2pwZyc6ICdpbWFnZS9qcGcnLFxyXG4gICAgJ21qcGcnOiAnaW1hZ2UveC1tb3Rpb24tanBlZycsXHJcbiAgICAncGljJzogJ2ltYWdlL3BpYycsXHJcbiAgICAncG5nJzogJ2ltYWdlL3BuZycsXHJcbiAgICAnc3ZnJzogJ2ltYWdlL3N2Zyt4bWwnLFxyXG4gICAgJ3RpZic6ICdpbWFnZS90aWZmJyxcclxuICAgICd0aWZmJzogJ2ltYWdlL3RpZmYnLFxyXG5cclxuICAgIC8vIHRleHRcclxuICAgICdjc3MnOiAndGV4dC9jc3MnLFxyXG4gICAgJ2Nzdic6ICd0ZXh0L2NzdicsXHJcbiAgICAnaHRtbCc6ICd0ZXh0L2h0bWwnLFxyXG4gICAgJ3R4dCc6ICd0ZXh0L3BsYWluJyxcclxuXHJcbiAgICAvLyB2aWRlb1xyXG4gICAgJ2F2aSc6ICd2aWRlby9hdmknLFxyXG4gICAgJ2R2JzogJ3ZpZGVvL3gtZHYnLFxyXG4gICAgJ2Zsdic6ICd2aWRlby94LWZsdicsXHJcbiAgICAnbW92JzogJ3ZpZGVvL3F1aWNrdGltZScsXHJcbiAgICAnbXA0JzogJ3ZpZGVvL21wNCcsXHJcbiAgICAnbXBlZyc6ICd2aWRlby9tcGVnJyxcclxuICAgICdtcGcnOiAndmlkZW8vbXBnJyxcclxuICAgICdvZ3YnOiAndmlkZW8vb2dnJyxcclxuICAgICd2ZG8nOiAndmlkZW8vdmRvJyxcclxuICAgICd3ZWJtJzogJ3ZpZGVvL3dlYm0nLFxyXG4gICAgJ3dtdic6ICd2aWRlby94LW1zLXdtdicsXHJcblxyXG4gICAgLy8gc3BlY2lmaWMgdG8gdmVuZG9yc1xyXG4gICAgJ2RvYyc6ICdhcHBsaWNhdGlvbi9tc3dvcmQnLFxyXG4gICAgJ2RvY3gnOiAnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQnLFxyXG4gICAgJ29kYic6ICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LmRhdGFiYXNlJyxcclxuICAgICdvZGMnOiAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5jaGFydCcsXHJcbiAgICAnb2RmJzogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuZm9ybXVsYScsXHJcbiAgICAnb2RnJzogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuZ3JhcGhpY3MnLFxyXG4gICAgJ29kaSc6ICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LmltYWdlJyxcclxuICAgICdvZG0nOiAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC50ZXh0LW1hc3RlcicsXHJcbiAgICAnb2RwJzogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQucHJlc2VudGF0aW9uJyxcclxuICAgICdvZHMnOiAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5zcHJlYWRzaGVldCcsXHJcbiAgICAnb2R0JzogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQudGV4dCcsXHJcbiAgICAnb3RnJzogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuZ3JhcGhpY3MtdGVtcGxhdGUnLFxyXG4gICAgJ290cCc6ICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnByZXNlbnRhdGlvbi10ZW1wbGF0ZScsXHJcbiAgICAnb3RzJzogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuc3ByZWFkc2hlZXQtdGVtcGxhdGUnLFxyXG4gICAgJ290dCc6ICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHQtdGVtcGxhdGUnLFxyXG4gICAgJ3BwdCc6ICdhcHBsaWNhdGlvbi92bmQubXMtcG93ZXJwb2ludCcsXHJcbiAgICAncHB0eCc6ICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwucHJlc2VudGF0aW9uJyxcclxuICAgICd4bHMnOiAnYXBwbGljYXRpb24vdm5kLm1zLWV4Y2VsJyxcclxuICAgICd4bHN4JzogJ2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoZWV0J1xyXG59O1xyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuaW1wb3J0IHtffSBmcm9tIFwibWV0ZW9yL3VuZGVyc2NvcmVcIjtcclxuaW1wb3J0IHtNZXRlb3J9IGZyb20gXCJtZXRlb3IvbWV0ZW9yXCI7XHJcbmltcG9ydCB7V2ViQXBwfSBmcm9tIFwibWV0ZW9yL3dlYmFwcFwiO1xyXG5pbXBvcnQge1VwbG9hZEZTfSBmcm9tIFwiLi91ZnNcIjtcclxuXHJcblxyXG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XHJcblxyXG4gICAgY29uc3QgZG9tYWluID0gTnBtLnJlcXVpcmUoJ2RvbWFpbicpO1xyXG4gICAgY29uc3QgZnMgPSBOcG0ucmVxdWlyZSgnZnMnKTtcclxuICAgIGNvbnN0IGh0dHAgPSBOcG0ucmVxdWlyZSgnaHR0cCcpO1xyXG4gICAgY29uc3QgaHR0cHMgPSBOcG0ucmVxdWlyZSgnaHR0cHMnKTtcclxuICAgIGNvbnN0IG1rZGlycCA9IE5wbS5yZXF1aXJlKCdta2RpcnAnKTtcclxuICAgIGNvbnN0IHN0cmVhbSA9IE5wbS5yZXF1aXJlKCdzdHJlYW0nKTtcclxuICAgIGNvbnN0IFVSTCA9IE5wbS5yZXF1aXJlKCd1cmwnKTtcclxuICAgIGNvbnN0IHpsaWIgPSBOcG0ucmVxdWlyZSgnemxpYicpO1xyXG5cclxuXHJcbiAgICBNZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XHJcbiAgICAgICAgbGV0IHBhdGggPSBVcGxvYWRGUy5jb25maWcudG1wRGlyO1xyXG4gICAgICAgIGxldCBtb2RlID0gVXBsb2FkRlMuY29uZmlnLnRtcERpclBlcm1pc3Npb25zO1xyXG5cclxuICAgICAgICBmcy5zdGF0KHBhdGgsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSB0ZW1wIGRpcmVjdG9yeVxyXG4gICAgICAgICAgICAgICAgbWtkaXJwKHBhdGgsIHttb2RlOiBtb2RlfSwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgdWZzOiBjYW5ub3QgY3JlYXRlIHRlbXAgZGlyZWN0b3J5IGF0IFwiJHtwYXRofVwiICgke2Vyci5tZXNzYWdlfSlgKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgdWZzOiB0ZW1wIGRpcmVjdG9yeSBjcmVhdGVkIGF0IFwiJHtwYXRofVwiYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTZXQgZGlyZWN0b3J5IHBlcm1pc3Npb25zXHJcbiAgICAgICAgICAgICAgICBmcy5jaG1vZChwYXRoLCBtb2RlLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyICYmIGNvbnNvbGUuZXJyb3IoYHVmczogY2Fubm90IHNldCB0ZW1wIGRpcmVjdG9yeSBwZXJtaXNzaW9ucyAke21vZGV9ICgke2Vyci5tZXNzYWdlfSlgKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDcmVhdGUgZG9tYWluIHRvIGhhbmRsZSBlcnJvcnNcclxuICAgIC8vIGFuZCBwb3NzaWJseSBhdm9pZCBzZXJ2ZXIgY3Jhc2hlcy5cclxuICAgIGxldCBkID0gZG9tYWluLmNyZWF0ZSgpO1xyXG5cclxuICAgIGQub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ3VmczogJyArIGVyci5tZXNzYWdlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExpc3RlbiBIVFRQIHJlcXVlc3RzIHRvIHNlcnZlIGZpbGVzXHJcbiAgICBXZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICAvLyBRdWljayBjaGVjayB0byBzZWUgaWYgcmVxdWVzdCBzaG91bGQgYmUgY2F0Y2hcclxuICAgICAgICBpZiAocmVxLnVybC5pbmRleE9mKFVwbG9hZEZTLmNvbmZpZy5zdG9yZXNQYXRoKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBSZW1vdmUgc3RvcmUgcGF0aFxyXG4gICAgICAgIGxldCBwYXJzZWRVcmwgPSBVUkwucGFyc2UocmVxLnVybCk7XHJcbiAgICAgICAgbGV0IHBhdGggPSBwYXJzZWRVcmwucGF0aG5hbWUuc3Vic3RyKFVwbG9hZEZTLmNvbmZpZy5zdG9yZXNQYXRoLmxlbmd0aCArIDEpO1xyXG5cclxuICAgICAgICBsZXQgYWxsb3dDT1JTID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAvLyByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCByZXEuaGVhZGVycy5vcmlnaW4pO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiLCBcIlBPU1RcIik7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIiwgXCIqXCIpO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiLCBcIkNvbnRlbnQtVHlwZVwiKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHtcclxuICAgICAgICAgICAgbGV0IHJlZ0V4cCA9IG5ldyBSZWdFeHAoJ15cXC8oW15cXC9cXD9dKylcXC8oW15cXC9cXD9dKykkJyk7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IHJlZ0V4cC5leGVjKHBhdGgpO1xyXG5cclxuICAgICAgICAgICAgLy8gUmVxdWVzdCBpcyBub3QgdmFsaWRcclxuICAgICAgICAgICAgaWYgKG1hdGNoID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCk7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEdldCBzdG9yZVxyXG4gICAgICAgICAgICBsZXQgc3RvcmUgPSBVcGxvYWRGUy5nZXRTdG9yZShtYXRjaFsxXSk7XHJcbiAgICAgICAgICAgIGlmICghc3RvcmUpIHtcclxuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDA0KTtcclxuICAgICAgICAgICAgICAgIHJlcy5lbmQoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSWYgYSBzdG9yZSBpcyBmb3VuZCwgZ28gYWhlYWQgYW5kIGFsbG93IHRoZSBvcmlnaW5cclxuICAgICAgICAgICAgYWxsb3dDT1JTKCk7XHJcblxyXG4gICAgICAgICAgICBuZXh0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICAvLyBHZXQgc3RvcmVcclxuICAgICAgICAgICAgbGV0IHJlZ0V4cCA9IG5ldyBSZWdFeHAoJ15cXC8oW15cXC9cXD9dKylcXC8oW15cXC9cXD9dKykkJyk7XHJcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IHJlZ0V4cC5leGVjKHBhdGgpO1xyXG5cclxuICAgICAgICAgICAgLy8gUmVxdWVzdCBpcyBub3QgdmFsaWRcclxuICAgICAgICAgICAgaWYgKG1hdGNoID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCk7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEdldCBzdG9yZVxyXG4gICAgICAgICAgICBsZXQgc3RvcmUgPSBVcGxvYWRGUy5nZXRTdG9yZShtYXRjaFsxXSk7XHJcbiAgICAgICAgICAgIGlmICghc3RvcmUpIHtcclxuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDA0KTtcclxuICAgICAgICAgICAgICAgIHJlcy5lbmQoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSWYgYSBzdG9yZSBpcyBmb3VuZCwgZ28gYWhlYWQgYW5kIGFsbG93IHRoZSBvcmlnaW5cclxuICAgICAgICAgICAgYWxsb3dDT1JTKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBHZXQgZmlsZVxyXG4gICAgICAgICAgICBsZXQgZmlsZUlkID0gbWF0Y2hbMl07XHJcbiAgICAgICAgICAgIGlmIChzdG9yZS5nZXRDb2xsZWN0aW9uKCkuZmluZCh7X2lkOiBmaWxlSWR9KS5jb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwNCk7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIHVwbG9hZCB0b2tlblxyXG4gICAgICAgICAgICBpZiAoIXN0b3JlLmNoZWNrVG9rZW4ocmVxLnF1ZXJ5LnRva2VuLCBmaWxlSWQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMyk7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCB0bXBGaWxlID0gVXBsb2FkRlMuZ2V0VGVtcEZpbGVQYXRoKGZpbGVJZCk7XHJcbiAgICAgICAgICAgIGxldCB3cyA9IGZzLmNyZWF0ZVdyaXRlU3RyZWFtKHRtcEZpbGUsIHtmbGFnczogJ2EnfSk7XHJcbiAgICAgICAgICAgIGxldCBmaWVsZHMgPSB7dXBsb2FkaW5nOiB0cnVlfTtcclxuICAgICAgICAgICAgbGV0IHByb2dyZXNzID0gcGFyc2VGbG9hdChyZXEucXVlcnkucHJvZ3Jlc3MpO1xyXG4gICAgICAgICAgICBpZiAoIWlzTmFOKHByb2dyZXNzKSAmJiBwcm9ncmVzcyA+IDApIHtcclxuICAgICAgICAgICAgICAgIGZpZWxkcy5wcm9ncmVzcyA9IE1hdGgubWluKHByb2dyZXNzLCAxKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmVxLm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB3cy53cml0ZShjaHVuayk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXEub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xyXG4gICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmVxLm9uKCdlbmQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBjb21wbGV0ZWQgc3RhdGUgd2l0aG91dCB0cmlnZ2VyaW5nIGhvb2tzXHJcbiAgICAgICAgICAgICAgICBzdG9yZS5nZXRDb2xsZWN0aW9uKCkuZGlyZWN0LnVwZGF0ZSh7X2lkOiBmaWxlSWR9LCB7JHNldDogZmllbGRzfSk7XHJcbiAgICAgICAgICAgICAgICB3cy5lbmQoKTtcclxuICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICB3cy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGB1ZnM6IGNhbm5vdCB3cml0ZSBjaHVuayBvZiBmaWxlIFwiJHtmaWxlSWR9XCIgKCR7ZXJyLm1lc3NhZ2V9KWApO1xyXG4gICAgICAgICAgICAgICAgZnMudW5saW5rKHRtcEZpbGUsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBlcnIgJiYgY29uc29sZS5lcnJvcihgdWZzOiBjYW5ub3QgZGVsZXRlIHRlbXAgZmlsZSBcIiR7dG1wRmlsZX1cIiAoJHtlcnIubWVzc2FnZX0pYCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKTtcclxuICAgICAgICAgICAgICAgIHJlcy5lbmQoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHdzLm9uKCdmaW5pc2gnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwNCwge1wiQ29udGVudC1UeXBlXCI6ICd0ZXh0L3BsYWluJ30pO1xyXG4gICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAocmVxLm1ldGhvZCA9PSAnR0VUJykge1xyXG4gICAgICAgICAgICAvLyBHZXQgc3RvcmUsIGZpbGUgSWQgYW5kIGZpbGUgbmFtZVxyXG4gICAgICAgICAgICBsZXQgcmVnRXhwID0gbmV3IFJlZ0V4cCgnXlxcLyhbXlxcL1xcP10rKVxcLyhbXlxcL1xcP10rKSg/OlxcLyhbXlxcL1xcP10rKSk/JCcpO1xyXG4gICAgICAgICAgICBsZXQgbWF0Y2ggPSByZWdFeHAuZXhlYyhwYXRoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIEF2b2lkIDUwNCBHYXRld2F5IHRpbWVvdXQgZXJyb3JcclxuICAgICAgICAgICAgLy8gaWYgZmlsZSBpcyBub3QgaGFuZGxlZCBieSBVcGxvYWRGUy5cclxuICAgICAgICAgICAgaWYgKG1hdGNoID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBuZXh0KCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEdldCBzdG9yZVxyXG4gICAgICAgICAgICBjb25zdCBzdG9yZU5hbWUgPSBtYXRjaFsxXTtcclxuICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSBVcGxvYWRGUy5nZXRTdG9yZShzdG9yZU5hbWUpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFzdG9yZSkge1xyXG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQpO1xyXG4gICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoc3RvcmUub25SZWFkICE9PSBudWxsICYmIHN0b3JlLm9uUmVhZCAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBzdG9yZS5vblJlYWQgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYHVmczogU3RvcmUub25SZWFkIGlzIG5vdCBhIGZ1bmN0aW9uIGluIHN0b3JlIFwiJHtzdG9yZU5hbWV9XCJgKTtcclxuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKTtcclxuICAgICAgICAgICAgICAgIHJlcy5lbmQoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gUmVtb3ZlIGZpbGUgZXh0ZW5zaW9uIGZyb20gZmlsZSBJZFxyXG4gICAgICAgICAgICBsZXQgaW5kZXggPSBtYXRjaFsyXS5pbmRleE9mKCcuJyk7XHJcbiAgICAgICAgICAgIGxldCBmaWxlSWQgPSBpbmRleCAhPT0gLTEgPyBtYXRjaFsyXS5zdWJzdHIoMCwgaW5kZXgpIDogbWF0Y2hbMl07XHJcblxyXG4gICAgICAgICAgICAvLyBHZXQgZmlsZSBmcm9tIGRhdGFiYXNlXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBzdG9yZS5nZXRDb2xsZWN0aW9uKCkuZmluZE9uZSh7X2lkOiBmaWxlSWR9KTtcclxuICAgICAgICAgICAgaWYgKCFmaWxlKSB7XHJcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwNCk7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIFNpbXVsYXRlIHJlYWQgc3BlZWRcclxuICAgICAgICAgICAgaWYgKFVwbG9hZEZTLmNvbmZpZy5zaW11bGF0ZVJlYWREZWxheSkge1xyXG4gICAgICAgICAgICAgICAgTWV0ZW9yLl9zbGVlcEZvck1zKFVwbG9hZEZTLmNvbmZpZy5zaW11bGF0ZVJlYWREZWxheSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGQucnVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIGNhbiBiZSBhY2Nlc3NlZFxyXG4gICAgICAgICAgICAgICAgaWYgKHN0b3JlLm9uUmVhZC5jYWxsKHN0b3JlLCBmaWxlSWQsIGZpbGUsIHJlcSwgcmVzKSAhPT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgb3B0aW9ucyA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBzdGF0dXMgPSAyMDA7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFByZXBhcmUgcmVzcG9uc2UgaGVhZGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBoZWFkZXJzID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogZmlsZS50eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBmaWxlLnNpemVcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBBZGQgRVRhZyBoZWFkZXJcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZpbGUuZXRhZyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1snRVRhZyddID0gZmlsZS5ldGFnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIExhc3QtTW9kaWZpZWQgaGVhZGVyXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUubW9kaWZpZWRBdCBpbnN0YW5jZW9mIERhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1snTGFzdC1Nb2RpZmllZCddID0gZmlsZS5tb2RpZmllZEF0LnRvVVRDU3RyaW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGZpbGUudXBsb2FkZWRBdCBpbnN0YW5jZW9mIERhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1snTGFzdC1Nb2RpZmllZCddID0gZmlsZS51cGxvYWRlZEF0LnRvVVRDU3RyaW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSByZXF1ZXN0IGhlYWRlcnNcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlcS5oZWFkZXJzID09PSAnb2JqZWN0Jykge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ29tcGFyZSBFVGFnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXEuaGVhZGVyc1snaWYtbm9uZS1tYXRjaCddKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZS5ldGFnID09PSByZXEuaGVhZGVyc1snaWYtbm9uZS1tYXRjaCddKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgzMDQpOyAvLyBOb3QgTW9kaWZpZWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDb21wYXJlIGZpbGUgbW9kaWZpY2F0aW9uIGRhdGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcS5oZWFkZXJzWydpZi1tb2RpZmllZC1zaW5jZSddKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtb2RpZmllZFNpbmNlID0gbmV3IERhdGUocmVxLmhlYWRlcnNbJ2lmLW1vZGlmaWVkLXNpbmNlJ10pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoZmlsZS5tb2RpZmllZEF0IGluc3RhbmNlb2YgRGF0ZSAmJiBmaWxlLm1vZGlmaWVkQXQgPiBtb2RpZmllZFNpbmNlKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHx8IGZpbGUudXBsb2FkZWRBdCBpbnN0YW5jZW9mIERhdGUgJiYgZmlsZS51cGxvYWRlZEF0ID4gbW9kaWZpZWRTaW5jZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMzA0KTsgLy8gTm90IE1vZGlmaWVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBkYXRhIGluIHJhbmdlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVxLmhlYWRlcnMucmFuZ2UgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmFuZ2UgPSByZXEuaGVhZGVycy5yYW5nZTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSYW5nZSBpcyBub3QgdmFsaWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmFuZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQxNik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcG9zaXRpb25zID0gcmFuZ2UucmVwbGFjZSgvYnl0ZXM9LywgJycpLnNwbGl0KCctJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgc3RhcnQgPSBwYXJzZUludChwb3NpdGlvbnNbMF0sIDEwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0b3RhbCA9IGZpbGUuc2l6ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbmQgPSBwb3NpdGlvbnNbMV0gPyBwYXJzZUludChwb3NpdGlvbnNbMV0sIDEwKSA6IHRvdGFsIC0gMTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgaGVhZGVyc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1snQ29udGVudC1SYW5nZSddID0gYGJ5dGVzICR7c3RhcnR9LSR7ZW5kfS8ke3RvdGFsfWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzWydBY2NlcHQtUmFuZ2VzJ10gPSBgYnl0ZXNgO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyc1snQ29udGVudC1MZW5ndGgnXSA9IChlbmQgLSBzdGFydCkgKyAxO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyA9IDIwNjsgLy8gcGFydGlhbCBjb250ZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnN0YXJ0ID0gc3RhcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmVuZCA9IGVuZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gT3BlbiB0aGUgZmlsZSBzdHJlYW1cclxuICAgICAgICAgICAgICAgICAgICBsZXQgcnMgPSBzdG9yZS5nZXRSZWFkU3RyZWFtKGZpbGVJZCwgZmlsZSwgb3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHdzID0gbmV3IHN0cmVhbS5QYXNzVGhyb3VnaCgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBycy5vbignZXJyb3InLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmUub25SZWFkRXJyb3IuY2FsbChzdG9yZSwgZXJyLCBmaWxlSWQsIGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHdzLm9uKCdlcnJvcicsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9yZS5vblJlYWRFcnJvci5jYWxsKHN0b3JlLCBlcnIsIGZpbGVJZCwgZmlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgd3Mub24oJ2Nsb3NlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDbG9zZSBvdXRwdXQgc3RyZWFtIGF0IHRoZSBlbmRcclxuICAgICAgICAgICAgICAgICAgICAgICAgd3MuZW1pdCgnZW5kJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRyYW5zZm9ybSBzdHJlYW1cclxuICAgICAgICAgICAgICAgICAgICBzdG9yZS50cmFuc2Zvcm1SZWFkKHJzLCB3cywgZmlsZUlkLCBmaWxlLCByZXEsIGhlYWRlcnMpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSByZXF1ZXN0IGhlYWRlcnNcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlcS5oZWFkZXJzID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDb21wcmVzcyBkYXRhIHVzaW5nIGlmIG5lZWRlZCAoaWdub3JlIGF1ZGlvL3ZpZGVvIGFzIHRoZXkgYXJlIGFscmVhZHkgY29tcHJlc3NlZClcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiByZXEuaGVhZGVyc1snYWNjZXB0LWVuY29kaW5nJ10gPT09ICdzdHJpbmcnICYmICEvXihhdWRpb3x2aWRlbykvLnRlc3QoZmlsZS50eXBlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFjY2VwdCA9IHJlcS5oZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDb21wcmVzcyB3aXRoIGd6aXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhY2NlcHQubWF0Y2goL1xcYmd6aXBcXGIvKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnNbJ0NvbnRlbnQtRW5jb2RpbmcnXSA9ICdnemlwJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgaGVhZGVyc1snQ29udGVudC1MZW5ndGgnXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKHN0YXR1cywgaGVhZGVycyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3MucGlwZSh6bGliLmNyZWF0ZUd6aXAoKSkucGlwZShyZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbXByZXNzIHdpdGggZGVmbGF0ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoYWNjZXB0Lm1hdGNoKC9cXGJkZWZsYXRlXFxiLykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzWydDb250ZW50LUVuY29kaW5nJ10gPSAnZGVmbGF0ZSc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGhlYWRlcnNbJ0NvbnRlbnQtTGVuZ3RoJ107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIGhlYWRlcnMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdzLnBpcGUoemxpYi5jcmVhdGVEZWZsYXRlKCkpLnBpcGUocmVzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgcmF3IGRhdGFcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWhlYWRlcnNbJ0NvbnRlbnQtRW5jb2RpbmcnXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKHN0YXR1cywgaGVhZGVycyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdzLnBpcGUocmVzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG5leHQoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuaW1wb3J0IHtffSBmcm9tIFwibWV0ZW9yL3VuZGVyc2NvcmVcIjtcclxuXHJcblxyXG4vKipcclxuICogU3RvcmUgcGVybWlzc2lvbnNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTdG9yZVBlcm1pc3Npb25zIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICAgICAgLy8gRGVmYXVsdCBvcHRpb25zXHJcbiAgICAgICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHtcclxuICAgICAgICAgICAgaW5zZXJ0OiBudWxsLFxyXG4gICAgICAgICAgICByZW1vdmU6IG51bGwsXHJcbiAgICAgICAgICAgIHVwZGF0ZTogbnVsbFxyXG4gICAgICAgIH0sIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBDaGVjayBvcHRpb25zXHJcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5zZXJ0ICYmIHR5cGVvZiBvcHRpb25zLmluc2VydCAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3RvcmVQZXJtaXNzaW9uczogaW5zZXJ0IGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAob3B0aW9ucy5yZW1vdmUgJiYgdHlwZW9mIG9wdGlvbnMucmVtb3ZlICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTdG9yZVBlcm1pc3Npb25zOiByZW1vdmUgaXMgbm90IGEgZnVuY3Rpb25cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLnVwZGF0ZSAmJiB0eXBlb2Ygb3B0aW9ucy51cGRhdGUgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN0b3JlUGVybWlzc2lvbnM6IHVwZGF0ZSBpcyBub3QgYSBmdW5jdGlvblwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFB1YmxpYyBhdHRyaWJ1dGVzXHJcbiAgICAgICAgdGhpcy5hY3Rpb25zID0ge1xyXG4gICAgICAgICAgICBpbnNlcnQ6IG9wdGlvbnMuaW5zZXJ0LFxyXG4gICAgICAgICAgICByZW1vdmU6IG9wdGlvbnMucmVtb3ZlLFxyXG4gICAgICAgICAgICB1cGRhdGU6IG9wdGlvbnMudXBkYXRlLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgdGhlIHBlcm1pc3Npb24gZm9yIHRoZSBhY3Rpb25cclxuICAgICAqIEBwYXJhbSBhY3Rpb25cclxuICAgICAqIEBwYXJhbSB1c2VySWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzXHJcbiAgICAgKiBAcGFyYW0gbW9kaWZpZXJzXHJcbiAgICAgKiBAcmV0dXJuIHsqfVxyXG4gICAgICovXHJcbiAgICBjaGVjayhhY3Rpb24sIHVzZXJJZCwgZmlsZSwgZmllbGRzLCBtb2RpZmllcnMpIHtcclxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuYWN0aW9uc1thY3Rpb25dID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFjdGlvbnNbYWN0aW9uXSh1c2VySWQsIGZpbGUsIGZpZWxkcywgbW9kaWZpZXJzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIGJ5IGRlZmF1bHQgYWxsb3cgYWxsXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgdGhlIGluc2VydCBwZXJtaXNzaW9uXHJcbiAgICAgKiBAcGFyYW0gdXNlcklkXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICogQHJldHVybnMgeyp9XHJcbiAgICAgKi9cclxuICAgIGNoZWNrSW5zZXJ0KHVzZXJJZCwgZmlsZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmNoZWNrKCdpbnNlcnQnLCB1c2VySWQsIGZpbGUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIHRoZSByZW1vdmUgcGVybWlzc2lvblxyXG4gICAgICogQHBhcmFtIHVzZXJJZFxyXG4gICAgICogQHBhcmFtIGZpbGVcclxuICAgICAqIEByZXR1cm5zIHsqfVxyXG4gICAgICovXHJcbiAgICBjaGVja1JlbW92ZSh1c2VySWQsIGZpbGUpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jaGVjaygncmVtb3ZlJywgdXNlcklkLCBmaWxlKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyB0aGUgdXBkYXRlIHBlcm1pc3Npb25cclxuICAgICAqIEBwYXJhbSB1c2VySWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzXHJcbiAgICAgKiBAcGFyYW0gbW9kaWZpZXJzXHJcbiAgICAgKiBAcmV0dXJucyB7Kn1cclxuICAgICAqL1xyXG4gICAgY2hlY2tVcGRhdGUodXNlcklkLCBmaWxlLCBmaWVsZHMsIG1vZGlmaWVycykge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmNoZWNrKCd1cGRhdGUnLCB1c2VySWQsIGZpbGUsIGZpZWxkcywgbW9kaWZpZXJzKTtcclxuICAgIH1cclxufVxyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuaW1wb3J0IHtffSBmcm9tIFwibWV0ZW9yL3VuZGVyc2NvcmVcIjtcclxuaW1wb3J0IHtjaGVja30gZnJvbSBcIm1ldGVvci9jaGVja1wiO1xyXG5pbXBvcnQge01ldGVvcn0gZnJvbSBcIm1ldGVvci9tZXRlb3JcIjtcclxuaW1wb3J0IHtNb25nb30gZnJvbSBcIm1ldGVvci9tb25nb1wiO1xyXG5pbXBvcnQge1VwbG9hZEZTfSBmcm9tIFwiLi91ZnNcIjtcclxuaW1wb3J0IHtGaWx0ZXJ9IGZyb20gXCIuL3Vmcy1maWx0ZXJcIjtcclxuaW1wb3J0IHtTdG9yZVBlcm1pc3Npb25zfSBmcm9tIFwiLi91ZnMtc3RvcmUtcGVybWlzc2lvbnNcIjtcclxuaW1wb3J0IHtUb2tlbnN9IGZyb20gXCIuL3Vmcy10b2tlbnNcIjtcclxuXHJcblxyXG4vKipcclxuICogRmlsZSBzdG9yZVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN0b3JlIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuICAgICAgICAvLyBEZWZhdWx0IG9wdGlvbnNcclxuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQoe1xyXG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBudWxsLFxyXG4gICAgICAgICAgICBmaWx0ZXI6IG51bGwsXHJcbiAgICAgICAgICAgIG5hbWU6IG51bGwsXHJcbiAgICAgICAgICAgIG9uQ29weUVycm9yOiB0aGlzLm9uQ29weUVycm9yLFxyXG4gICAgICAgICAgICBvbkZpbmlzaFVwbG9hZDogdGhpcy5vbkZpbmlzaFVwbG9hZCxcclxuICAgICAgICAgICAgb25SZWFkOiB0aGlzLm9uUmVhZCxcclxuICAgICAgICAgICAgb25SZWFkRXJyb3I6IHRoaXMub25SZWFkRXJyb3IsXHJcbiAgICAgICAgICAgIG9uVmFsaWRhdGU6IHRoaXMub25WYWxpZGF0ZSxcclxuICAgICAgICAgICAgb25Xcml0ZUVycm9yOiB0aGlzLm9uV3JpdGVFcnJvcixcclxuICAgICAgICAgICAgcGVybWlzc2lvbnM6IG51bGwsXHJcbiAgICAgICAgICAgIHRyYW5zZm9ybVJlYWQ6IG51bGwsXHJcbiAgICAgICAgICAgIHRyYW5zZm9ybVdyaXRlOiBudWxsXHJcbiAgICAgICAgfSwgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIENoZWNrIG9wdGlvbnNcclxuICAgICAgICBpZiAoIShvcHRpb25zLmNvbGxlY3Rpb24gaW5zdGFuY2VvZiBNb25nby5Db2xsZWN0aW9uKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdG9yZTogY29sbGVjdGlvbiBpcyBub3QgYSBNb25nby5Db2xsZWN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLmZpbHRlciAmJiAhKG9wdGlvbnMuZmlsdGVyIGluc3RhbmNlb2YgRmlsdGVyKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdG9yZTogZmlsdGVyIGlzIG5vdCBhIFVwbG9hZEZTLkZpbHRlcicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMubmFtZSAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU3RvcmU6IG5hbWUgaXMgbm90IGEgc3RyaW5nJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChVcGxvYWRGUy5nZXRTdG9yZShvcHRpb25zLm5hbWUpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0b3JlOiBuYW1lIGFscmVhZHkgZXhpc3RzJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLm9uQ29weUVycm9yICYmIHR5cGVvZiBvcHRpb25zLm9uQ29weUVycm9yICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0b3JlOiBvbkNvcHlFcnJvciBpcyBub3QgYSBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAob3B0aW9ucy5vbkZpbmlzaFVwbG9hZCAmJiB0eXBlb2Ygb3B0aW9ucy5vbkZpbmlzaFVwbG9hZCAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdG9yZTogb25GaW5pc2hVcGxvYWQgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG9wdGlvbnMub25SZWFkICYmIHR5cGVvZiBvcHRpb25zLm9uUmVhZCAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdG9yZTogb25SZWFkIGlzIG5vdCBhIGZ1bmN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLm9uUmVhZEVycm9yICYmIHR5cGVvZiBvcHRpb25zLm9uUmVhZEVycm9yICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0b3JlOiBvblJlYWRFcnJvciBpcyBub3QgYSBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAob3B0aW9ucy5vbldyaXRlRXJyb3IgJiYgdHlwZW9mIG9wdGlvbnMub25Xcml0ZUVycm9yICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0b3JlOiBvbldyaXRlRXJyb3IgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG9wdGlvbnMucGVybWlzc2lvbnMgJiYgIShvcHRpb25zLnBlcm1pc3Npb25zIGluc3RhbmNlb2YgU3RvcmVQZXJtaXNzaW9ucykpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU3RvcmU6IHBlcm1pc3Npb25zIGlzIG5vdCBhIFVwbG9hZEZTLlN0b3JlUGVybWlzc2lvbnMnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG9wdGlvbnMudHJhbnNmb3JtUmVhZCAmJiB0eXBlb2Ygb3B0aW9ucy50cmFuc2Zvcm1SZWFkICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0b3JlOiB0cmFuc2Zvcm1SZWFkIGlzIG5vdCBhIGZ1bmN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLnRyYW5zZm9ybVdyaXRlICYmIHR5cGVvZiBvcHRpb25zLnRyYW5zZm9ybVdyaXRlICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1N0b3JlOiB0cmFuc2Zvcm1Xcml0ZSBpcyBub3QgYSBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAob3B0aW9ucy5vblZhbGlkYXRlICYmIHR5cGVvZiBvcHRpb25zLm9uVmFsaWRhdGUgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU3RvcmU6IG9uVmFsaWRhdGUgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFB1YmxpYyBhdHRyaWJ1dGVzXHJcbiAgICAgICAgc2VsZi5vcHRpb25zID0gb3B0aW9ucztcclxuICAgICAgICBzZWxmLnBlcm1pc3Npb25zID0gb3B0aW9ucy5wZXJtaXNzaW9ucztcclxuICAgICAgICBfLmVhY2goW1xyXG4gICAgICAgICAgICAnb25Db3B5RXJyb3InLFxyXG4gICAgICAgICAgICAnb25GaW5pc2hVcGxvYWQnLFxyXG4gICAgICAgICAgICAnb25SZWFkJyxcclxuICAgICAgICAgICAgJ29uUmVhZEVycm9yJyxcclxuICAgICAgICAgICAgJ29uV3JpdGVFcnJvcicsXHJcbiAgICAgICAgICAgICdvblZhbGlkYXRlJ1xyXG4gICAgICAgIF0sIChtZXRob2QpID0+IHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zW21ldGhvZF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHNlbGZbbWV0aG9kXSA9IG9wdGlvbnNbbWV0aG9kXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgdGhlIHN0b3JlIHRvIHRoZSBsaXN0XHJcbiAgICAgICAgVXBsb2FkRlMuYWRkU3RvcmUoc2VsZik7XHJcblxyXG4gICAgICAgIC8vIFNldCBkZWZhdWx0IHBlcm1pc3Npb25zXHJcbiAgICAgICAgaWYgKCEoc2VsZi5wZXJtaXNzaW9ucyBpbnN0YW5jZW9mIFN0b3JlUGVybWlzc2lvbnMpKSB7XHJcbiAgICAgICAgICAgIC8vIFVzZXMgY3VzdG9tIGRlZmF1bHQgcGVybWlzc2lvbnMgb3IgVUZTIGRlZmF1bHQgcGVybWlzc2lvbnNcclxuICAgICAgICAgICAgaWYgKFVwbG9hZEZTLmNvbmZpZy5kZWZhdWx0U3RvcmVQZXJtaXNzaW9ucyBpbnN0YW5jZW9mIFN0b3JlUGVybWlzc2lvbnMpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYucGVybWlzc2lvbnMgPSBVcGxvYWRGUy5jb25maWcuZGVmYXVsdFN0b3JlUGVybWlzc2lvbnM7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLnBlcm1pc3Npb25zID0gbmV3IFN0b3JlUGVybWlzc2lvbnMoKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgdWZzOiBwZXJtaXNzaW9ucyBhcmUgbm90IGRlZmluZWQgZm9yIHN0b3JlIFwiJHtvcHRpb25zLm5hbWV9XCJgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIENoZWNrcyB0b2tlbiB2YWxpZGl0eVxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gdG9rZW5cclxuICAgICAgICAgICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICAgICAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHNlbGYuY2hlY2tUb2tlbiA9IGZ1bmN0aW9uICh0b2tlbiwgZmlsZUlkKSB7XHJcbiAgICAgICAgICAgICAgICBjaGVjayh0b2tlbiwgU3RyaW5nKTtcclxuICAgICAgICAgICAgICAgIGNoZWNrKGZpbGVJZCwgU3RyaW5nKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBUb2tlbnMuZmluZCh7dmFsdWU6IHRva2VuLCBmaWxlSWQ6IGZpbGVJZH0pLmNvdW50KCkgPT09IDE7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogQ29waWVzIHRoZSBmaWxlIHRvIGEgc3RvcmVcclxuICAgICAgICAgICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gc3RvcmVcclxuICAgICAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBzZWxmLmNvcHkgPSBmdW5jdGlvbiAoZmlsZUlkLCBzdG9yZSwgY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIGNoZWNrKGZpbGVJZCwgU3RyaW5nKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIShzdG9yZSBpbnN0YW5jZW9mIFN0b3JlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N0b3JlIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBVcGxvYWRGUy5TdG9yZScpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgLy8gR2V0IG9yaWdpbmFsIGZpbGVcclxuICAgICAgICAgICAgICAgIGxldCBmaWxlID0gc2VsZi5nZXRDb2xsZWN0aW9uKCkuZmluZE9uZSh7X2lkOiBmaWxlSWR9KTtcclxuICAgICAgICAgICAgICAgIGlmICghZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ZpbGUtbm90LWZvdW5kJywgJ0ZpbGUgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgdGhlIGZpbGUgaWYgaXQgZG9lcyBub3QgbWF0Y2ggZmlsdGVyXHJcbiAgICAgICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSBzdG9yZS5nZXRGaWx0ZXIoKTtcclxuICAgICAgICAgICAgICAgIGlmIChmaWx0ZXIgaW5zdGFuY2VvZiBGaWx0ZXIgJiYgIWZpbHRlci5pc1ZhbGlkKGZpbGUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIFByZXBhcmUgY29weVxyXG4gICAgICAgICAgICAgICAgbGV0IGNvcHkgPSBfLm9taXQoZmlsZSwgJ19pZCcsICd1cmwnKTtcclxuICAgICAgICAgICAgICAgIGNvcHkub3JpZ2luYWxTdG9yZSA9IHNlbGYuZ2V0TmFtZSgpO1xyXG4gICAgICAgICAgICAgICAgY29weS5vcmlnaW5hbElkID0gZmlsZUlkO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgY29weVxyXG4gICAgICAgICAgICAgICAgbGV0IGNvcHlJZCA9IHN0b3JlLmNyZWF0ZShjb3B5KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBHZXQgb3JpZ2luYWwgc3RyZWFtXHJcbiAgICAgICAgICAgICAgICBsZXQgcnMgPSBzZWxmLmdldFJlYWRTdHJlYW0oZmlsZUlkLCBmaWxlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDYXRjaCBlcnJvcnMgdG8gYXZvaWQgYXBwIGNyYXNoaW5nXHJcbiAgICAgICAgICAgICAgICBycy5vbignZXJyb3InLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHNlbGYsIGVyciwgbnVsbCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ29weSBmaWxlIGRhdGFcclxuICAgICAgICAgICAgICAgIHN0b3JlLndyaXRlKHJzLCBjb3B5SWQsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24gKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5nZXRDb2xsZWN0aW9uKCkucmVtb3ZlKHtfaWQ6IGNvcHlJZH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9uQ29weUVycm9yLmNhbGwoc2VsZiwgZXJyLCBmaWxlSWQsIGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoc2VsZiwgZXJyLCBjb3B5SWQsIGNvcHksIHN0b3JlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogQ3JlYXRlcyB0aGUgZmlsZSBpbiB0aGUgY29sbGVjdGlvblxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gY2FsbGJhY2tcclxuICAgICAgICAgICAgICogQHJldHVybiB7c3RyaW5nfVxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgc2VsZi5jcmVhdGUgPSBmdW5jdGlvbiAoZmlsZSwgY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIGNoZWNrKGZpbGUsIE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICBmaWxlLnN0b3JlID0gc2VsZi5vcHRpb25zLm5hbWU7IC8vIGFzc2lnbiBzdG9yZSB0byBmaWxlXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5nZXRDb2xsZWN0aW9uKCkuaW5zZXJ0KGZpbGUsIGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBDcmVhdGVzIGEgdG9rZW4gZm9yIHRoZSBmaWxlIChvbmx5IG5lZWRlZCBmb3IgY2xpZW50IHNpZGUgdXBsb2FkKVxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgICAgICAgICAqIEByZXR1cm5zIHsqfVxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgc2VsZi5jcmVhdGVUb2tlbiA9IGZ1bmN0aW9uIChmaWxlSWQpIHtcclxuICAgICAgICAgICAgICAgIGxldCB0b2tlbiA9IHNlbGYuZ2VuZXJhdGVUb2tlbigpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRva2VuIGV4aXN0c1xyXG4gICAgICAgICAgICAgICAgaWYgKFRva2Vucy5maW5kKHtmaWxlSWQ6IGZpbGVJZH0pLmNvdW50KCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBUb2tlbnMudXBkYXRlKHtmaWxlSWQ6IGZpbGVJZH0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJHNldDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHRva2VuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgVG9rZW5zLmluc2VydCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUlkOiBmaWxlSWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB0b2tlblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIFdyaXRlcyB0aGUgZmlsZSB0byB0aGUgc3RvcmVcclxuICAgICAgICAgICAgICogQHBhcmFtIHJzXHJcbiAgICAgICAgICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBzZWxmLndyaXRlID0gZnVuY3Rpb24gKHJzLCBmaWxlSWQsIGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZmlsZSA9IHNlbGYuZ2V0Q29sbGVjdGlvbigpLmZpbmRPbmUoe19pZDogZmlsZUlkfSk7XHJcbiAgICAgICAgICAgICAgICBsZXQgd3MgPSBzZWxmLmdldFdyaXRlU3RyZWFtKGZpbGVJZCwgZmlsZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgbGV0IGVycm9ySGFuZGxlciA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24gKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZ2V0Q29sbGVjdGlvbigpLnJlbW92ZSh7X2lkOiBmaWxlSWR9KTtcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLm9uV3JpdGVFcnJvci5jYWxsKHNlbGYsIGVyciwgZmlsZUlkLCBmaWxlKTtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHNlbGYsIGVycik7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICB3cy5vbignZXJyb3InLCBlcnJvckhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgICAgd3Mub24oJ2ZpbmlzaCcsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBzaXplID0gMDtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgcmVhZFN0cmVhbSA9IHNlbGYuZ2V0UmVhZFN0cmVhbShmaWxlSWQsIGZpbGUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZWFkU3RyZWFtLm9uKCdlcnJvcicsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24gKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoc2VsZiwgZXJyb3IsIG51bGwpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICByZWFkU3RyZWFtLm9uKCdkYXRhJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplICs9IGRhdGEubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICByZWFkU3RyZWFtLm9uKCdlbmQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2V0IGZpbGUgYXR0cmlidXRlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUuY29tcGxldGUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLmV0YWcgPSBVcGxvYWRGUy5nZW5lcmF0ZUV0YWcoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS5wYXRoID0gc2VsZi5nZXRGaWxlUmVsYXRpdmVVUkwoZmlsZUlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS5wcm9ncmVzcyA9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUuc2l6ZSA9IHNpemU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUudG9rZW4gPSBzZWxmLmdlbmVyYXRlVG9rZW4oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS51cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS51cGxvYWRlZEF0ID0gbmV3IERhdGUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS51cmwgPSBzZWxmLmdldEZpbGVVUkwoZmlsZUlkKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNldHMgdGhlIGZpbGUgVVJMIHdoZW4gZmlsZSB0cmFuc2ZlciBpcyBjb21wbGV0ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhpcyB3YXksIHRoZSBpbWFnZSB3aWxsIGxvYWRzIGVudGlyZWx5LlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmdldENvbGxlY3Rpb24oKS5kaXJlY3QudXBkYXRlKHtfaWQ6IGZpbGVJZH0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICRzZXQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZTogZmlsZS5jb21wbGV0ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldGFnOiBmaWxlLmV0YWcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogZmlsZS5wYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb2dyZXNzOiBmaWxlLnByb2dyZXNzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemU6IGZpbGUuc2l6ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2tlbjogZmlsZS50b2tlbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGxvYWRpbmc6IGZpbGUudXBsb2FkaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwbG9hZGVkQXQ6IGZpbGUudXBsb2FkZWRBdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmw6IGZpbGUudXJsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmV0dXJuIGZpbGUgaW5mb1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHNlbGYsIG51bGwsIGZpbGUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhlY3V0ZSBjYWxsYmFja1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHNlbGYub25GaW5pc2hVcGxvYWQgPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vbkZpbmlzaFVwbG9hZC5jYWxsKHNlbGYsIGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTaW11bGF0ZSB3cml0ZSBzcGVlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoVXBsb2FkRlMuY29uZmlnLnNpbXVsYXRlV3JpdGVEZWxheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWV0ZW9yLl9zbGVlcEZvck1zKFVwbG9hZEZTLmNvbmZpZy5zaW11bGF0ZVdyaXRlRGVsYXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDb3B5IGZpbGUgdG8gb3RoZXIgc3RvcmVzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLm9wdGlvbnMuY29weVRvIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZi5vcHRpb25zLmNvcHlUby5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzdG9yZSA9IHNlbGYub3B0aW9ucy5jb3B5VG9baV07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc3RvcmUuZ2V0RmlsdGVyKCkgfHwgc3RvcmUuZ2V0RmlsdGVyKCkuaXNWYWxpZChmaWxlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvcHkoZmlsZUlkLCBzdG9yZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEV4ZWN1dGUgdHJhbnNmb3JtYXRpb25cclxuICAgICAgICAgICAgICAgIHNlbGYudHJhbnNmb3JtV3JpdGUocnMsIHdzLCBmaWxlSWQsIGZpbGUpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xyXG4gICAgICAgICAgICBjb25zdCBmcyA9IE5wbS5yZXF1aXJlKCdmcycpO1xyXG4gICAgICAgICAgICBjb25zdCBjb2xsZWN0aW9uID0gc2VsZi5nZXRDb2xsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBDb2RlIGV4ZWN1dGVkIGFmdGVyIHJlbW92aW5nIGZpbGVcclxuICAgICAgICAgICAgY29sbGVjdGlvbi5hZnRlci5yZW1vdmUoZnVuY3Rpb24gKHVzZXJJZCwgZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGFzc29jaWF0ZWQgdG9rZW5zXHJcbiAgICAgICAgICAgICAgICBUb2tlbnMucmVtb3ZlKHtmaWxlSWQ6IGZpbGUuX2lkfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHNlbGYub3B0aW9ucy5jb3B5VG8gaW5zdGFuY2VvZiBBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZi5vcHRpb25zLmNvcHlUby5sZW5ndGg7IGkgKz0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgY29waWVzIGluIHN0b3Jlc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9wdGlvbnMuY29weVRvW2ldLmdldENvbGxlY3Rpb24oKS5yZW1vdmUoe29yaWdpbmFsSWQ6IGZpbGUuX2lkfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIENvZGUgZXhlY3V0ZWQgYmVmb3JlIGluc2VydGluZyBmaWxlXHJcbiAgICAgICAgICAgIGNvbGxlY3Rpb24uYmVmb3JlLmluc2VydChmdW5jdGlvbiAodXNlcklkLCBmaWxlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYucGVybWlzc2lvbnMuY2hlY2tJbnNlcnQodXNlcklkLCBmaWxlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ZvcmJpZGRlbicsIFwiRm9yYmlkZGVuXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIENvZGUgZXhlY3V0ZWQgYmVmb3JlIHVwZGF0aW5nIGZpbGVcclxuICAgICAgICAgICAgY29sbGVjdGlvbi5iZWZvcmUudXBkYXRlKGZ1bmN0aW9uICh1c2VySWQsIGZpbGUsIGZpZWxkcywgbW9kaWZpZXJzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYucGVybWlzc2lvbnMuY2hlY2tVcGRhdGUodXNlcklkLCBmaWxlLCBmaWVsZHMsIG1vZGlmaWVycykpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdmb3JiaWRkZW4nLCBcIkZvcmJpZGRlblwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBDb2RlIGV4ZWN1dGVkIGJlZm9yZSByZW1vdmluZyBmaWxlXHJcbiAgICAgICAgICAgIGNvbGxlY3Rpb24uYmVmb3JlLnJlbW92ZShmdW5jdGlvbiAodXNlcklkLCBmaWxlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGYucGVybWlzc2lvbnMuY2hlY2tSZW1vdmUodXNlcklkLCBmaWxlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ZvcmJpZGRlbicsIFwiRm9yYmlkZGVuXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIERlbGV0ZSB0aGUgcGh5c2ljYWwgZmlsZSBpbiB0aGUgc3RvcmVcclxuICAgICAgICAgICAgICAgIHNlbGYuZGVsZXRlKGZpbGUuX2lkKTtcclxuXHJcbiAgICAgICAgICAgICAgICBsZXQgdG1wRmlsZSA9IFVwbG9hZEZTLmdldFRlbXBGaWxlUGF0aChmaWxlLl9pZCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSB0ZW1wIGZpbGVcclxuICAgICAgICAgICAgICAgIGZzLnN0YXQodG1wRmlsZSwgZnVuY3Rpb24gKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICFlcnIgJiYgZnMudW5saW5rKHRtcEZpbGUsIGZ1bmN0aW9uIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyICYmIGNvbnNvbGUuZXJyb3IoYHVmczogY2Fubm90IGRlbGV0ZSB0ZW1wIGZpbGUgYXQgJHt0bXBGaWxlfSAoJHtlcnIubWVzc2FnZX0pYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVsZXRlcyBhIGZpbGUgYXN5bmNcclxuICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xyXG4gICAgICovXHJcbiAgICBkZWxldGUoZmlsZUlkLCBjYWxsYmFjaykge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZGVsZXRlIGlzIG5vdCBpbXBsZW1lbnRlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2VuZXJhdGVzIGEgcmFuZG9tIHRva2VuXHJcbiAgICAgKiBAcGFyYW0gcGF0dGVyblxyXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICBnZW5lcmF0ZVRva2VuKHBhdHRlcm4pIHtcclxuICAgICAgICByZXR1cm4gKHBhdHRlcm4gfHwgJ3h5eHl4eXh5eHknKS5yZXBsYWNlKC9beHldL2csIChjKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gJ3gnID8gciA6IChyICYgMHgzIHwgMHg4KTtcclxuICAgICAgICAgICAgbGV0IHMgPSB2LnRvU3RyaW5nKDE2KTtcclxuICAgICAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSkgPyBzLnRvVXBwZXJDYXNlKCkgOiBzO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgY29sbGVjdGlvblxyXG4gICAgICogQHJldHVybiB7TW9uZ28uQ29sbGVjdGlvbn1cclxuICAgICAqL1xyXG4gICAgZ2V0Q29sbGVjdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmNvbGxlY3Rpb247XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBmaWxlIFVSTFxyXG4gICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICogQHJldHVybiB7c3RyaW5nfG51bGx9XHJcbiAgICAgKi9cclxuICAgIGdldEZpbGVSZWxhdGl2ZVVSTChmaWxlSWQpIHtcclxuICAgICAgICBsZXQgZmlsZSA9IHRoaXMuZ2V0Q29sbGVjdGlvbigpLmZpbmRPbmUoZmlsZUlkLCB7ZmllbGRzOiB7bmFtZTogMX19KTtcclxuICAgICAgICByZXR1cm4gZmlsZSA/IHRoaXMuZ2V0UmVsYXRpdmVVUkwoYCR7ZmlsZUlkfS8ke2ZpbGUubmFtZX1gKSA6IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBmaWxlIFVSTFxyXG4gICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICogQHJldHVybiB7c3RyaW5nfG51bGx9XHJcbiAgICAgKi9cclxuICAgIGdldEZpbGVVUkwoZmlsZUlkKSB7XHJcbiAgICAgICAgbGV0IGZpbGUgPSB0aGlzLmdldENvbGxlY3Rpb24oKS5maW5kT25lKGZpbGVJZCwge2ZpZWxkczoge25hbWU6IDF9fSk7XHJcbiAgICAgICAgcmV0dXJuIGZpbGUgPyB0aGlzLmdldFVSTChgJHtmaWxlSWR9LyR7ZmlsZS5uYW1lfWApIDogbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIGZpbGUgZmlsdGVyXHJcbiAgICAgKiBAcmV0dXJuIHtVcGxvYWRGUy5GaWx0ZXJ9XHJcbiAgICAgKi9cclxuICAgIGdldEZpbHRlcigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmZpbHRlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIHN0b3JlIG5hbWVcclxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cclxuICAgICAqL1xyXG4gICAgZ2V0TmFtZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLm5hbWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBmaWxlIHJlYWQgc3RyZWFtXHJcbiAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICovXHJcbiAgICBnZXRSZWFkU3RyZWFtKGZpbGVJZCwgZmlsZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RvcmUuZ2V0UmVhZFN0cmVhbSBpcyBub3QgaW1wbGVtZW50ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIHN0b3JlIHJlbGF0aXZlIFVSTFxyXG4gICAgICogQHBhcmFtIHBhdGhcclxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cclxuICAgICAqL1xyXG4gICAgZ2V0UmVsYXRpdmVVUkwocGF0aCkge1xyXG4gICAgICAgIGNvbnN0IHJvb3RVcmwgPSBNZXRlb3IuYWJzb2x1dGVVcmwoKS5yZXBsYWNlKC9cXC8rJC8sICcnKTtcclxuICAgICAgICBjb25zdCByb290UGF0aCA9IHJvb3RVcmwucmVwbGFjZSgvXlthLXpdKzpcXC9cXC9bXi9dK1xcLyovZ2ksICcnKTtcclxuICAgICAgICBjb25zdCBzdG9yZU5hbWUgPSB0aGlzLmdldE5hbWUoKTtcclxuICAgICAgICBwYXRoID0gU3RyaW5nKHBhdGgpLnJlcGxhY2UoL1xcLyQvLCAnJykudHJpbSgpO1xyXG4gICAgICAgIHJldHVybiBlbmNvZGVVUkkoYCR7cm9vdFBhdGh9LyR7VXBsb2FkRlMuY29uZmlnLnN0b3Jlc1BhdGh9LyR7c3RvcmVOYW1lfS8ke3BhdGh9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBzdG9yZSBhYnNvbHV0ZSBVUkxcclxuICAgICAqIEBwYXJhbSBwYXRoXHJcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIGdldFVSTChwYXRoKSB7XHJcbiAgICAgICAgY29uc3Qgcm9vdFVybCA9IE1ldGVvci5hYnNvbHV0ZVVybCgpLnJlcGxhY2UoL1xcLyskLywgJycpO1xyXG4gICAgICAgIGNvbnN0IHN0b3JlTmFtZSA9IHRoaXMuZ2V0TmFtZSgpO1xyXG4gICAgICAgIHBhdGggPSBTdHJpbmcocGF0aCkucmVwbGFjZSgvXFwvJC8sICcnKS50cmltKCk7XHJcbiAgICAgICAgcmV0dXJuIGVuY29kZVVSSShgJHtyb290VXJsfS8ke1VwbG9hZEZTLmNvbmZpZy5zdG9yZXNQYXRofS8ke3N0b3JlTmFtZX0vJHtwYXRofWApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgZmlsZSB3cml0ZSBzdHJlYW1cclxuICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKi9cclxuICAgIGdldFdyaXRlU3RyZWFtKGZpbGVJZCwgZmlsZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZ2V0V3JpdGVTdHJlYW0gaXMgbm90IGltcGxlbWVudGVkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb21wbGV0ZXMgdGhlIGZpbGUgdXBsb2FkXHJcbiAgICAgKiBAcGFyYW0gdXJsXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXHJcbiAgICAgKi9cclxuICAgIGltcG9ydEZyb21VUkwodXJsLCBmaWxlLCBjYWxsYmFjaykge1xyXG4gICAgICAgIE1ldGVvci5jYWxsKCd1ZnNJbXBvcnRVUkwnLCB1cmwsIGZpbGUsIHRoaXMuZ2V0TmFtZSgpLCBjYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiBhIGNvcHkgZXJyb3IgaGFwcGVuZWRcclxuICAgICAqIEBwYXJhbSBlcnJcclxuICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKi9cclxuICAgIG9uQ29weUVycm9yKGVyciwgZmlsZUlkLCBmaWxlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgdWZzOiBjYW5ub3QgY29weSBmaWxlIFwiJHtmaWxlSWR9XCIgKCR7ZXJyLm1lc3NhZ2V9KWAsIGVycik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiBhIGZpbGUgaGFzIGJlZW4gdXBsb2FkZWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKi9cclxuICAgIG9uRmluaXNoVXBsb2FkKGZpbGUpIHtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxlZCB3aGVuIGEgZmlsZSBpcyByZWFkIGZyb20gdGhlIHN0b3JlXHJcbiAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICogQHBhcmFtIHJlcXVlc3RcclxuICAgICAqIEBwYXJhbSByZXNwb25zZVxyXG4gICAgICogQHJldHVybiBib29sZWFuXHJcbiAgICAgKi9cclxuICAgIG9uUmVhZChmaWxlSWQsIGZpbGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiBhIHJlYWQgZXJyb3IgaGFwcGVuZWRcclxuICAgICAqIEBwYXJhbSBlcnJcclxuICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcmV0dXJuIGJvb2xlYW5cclxuICAgICAqL1xyXG4gICAgb25SZWFkRXJyb3IoZXJyLCBmaWxlSWQsIGZpbGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGB1ZnM6IGNhbm5vdCByZWFkIGZpbGUgXCIke2ZpbGVJZH1cIiAoJHtlcnIubWVzc2FnZX0pYCwgZXJyKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxlZCB3aGVuIGZpbGUgaXMgYmVpbmcgdmFsaWRhdGVkXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICovXHJcbiAgICBvblZhbGlkYXRlKGZpbGUpIHtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxlZCB3aGVuIGEgd3JpdGUgZXJyb3IgaGFwcGVuZWRcclxuICAgICAqIEBwYXJhbSBlcnJcclxuICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcmV0dXJuIGJvb2xlYW5cclxuICAgICAqL1xyXG4gICAgb25Xcml0ZUVycm9yKGVyciwgZmlsZUlkLCBmaWxlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgdWZzOiBjYW5ub3Qgd3JpdGUgZmlsZSBcIiR7ZmlsZUlkfVwiICgke2Vyci5tZXNzYWdlfSlgLCBlcnIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgc3RvcmUgcGVybWlzc2lvbnNcclxuICAgICAqIEBwYXJhbSBwZXJtaXNzaW9uc1xyXG4gICAgICovXHJcbiAgICBzZXRQZXJtaXNzaW9ucyhwZXJtaXNzaW9ucykge1xyXG4gICAgICAgIGlmICghKHBlcm1pc3Npb25zIGluc3RhbmNlb2YgU3RvcmVQZXJtaXNzaW9ucykpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlBlcm1pc3Npb25zIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBVcGxvYWRGUy5TdG9yZVBlcm1pc3Npb25zXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnBlcm1pc3Npb25zID0gcGVybWlzc2lvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcmFuc2Zvcm1zIHRoZSBmaWxlIG9uIHJlYWRpbmdcclxuICAgICAqIEBwYXJhbSByZWFkU3RyZWFtXHJcbiAgICAgKiBAcGFyYW0gd3JpdGVTdHJlYW1cclxuICAgICAqIEBwYXJhbSBmaWxlSWRcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKiBAcGFyYW0gcmVxdWVzdFxyXG4gICAgICogQHBhcmFtIGhlYWRlcnNcclxuICAgICAqL1xyXG4gICAgdHJhbnNmb3JtUmVhZChyZWFkU3RyZWFtLCB3cml0ZVN0cmVhbSwgZmlsZUlkLCBmaWxlLCByZXF1ZXN0LCBoZWFkZXJzKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMudHJhbnNmb3JtUmVhZCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNmb3JtUmVhZC5jYWxsKHRoaXMsIHJlYWRTdHJlYW0sIHdyaXRlU3RyZWFtLCBmaWxlSWQsIGZpbGUsIHJlcXVlc3QsIGhlYWRlcnMpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlYWRTdHJlYW0ucGlwZSh3cml0ZVN0cmVhbSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVHJhbnNmb3JtcyB0aGUgZmlsZSBvbiB3cml0aW5nXHJcbiAgICAgKiBAcGFyYW0gcmVhZFN0cmVhbVxyXG4gICAgICogQHBhcmFtIHdyaXRlU3RyZWFtXHJcbiAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICovXHJcbiAgICB0cmFuc2Zvcm1Xcml0ZShyZWFkU3RyZWFtLCB3cml0ZVN0cmVhbSwgZmlsZUlkLCBmaWxlKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMudHJhbnNmb3JtV3JpdGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zZm9ybVdyaXRlLmNhbGwodGhpcywgcmVhZFN0cmVhbSwgd3JpdGVTdHJlYW0sIGZpbGVJZCwgZmlsZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVhZFN0cmVhbS5waXBlKHdyaXRlU3RyZWFtKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBWYWxpZGF0ZXMgdGhlIGZpbGVcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKi9cclxuICAgIHZhbGlkYXRlKGZpbGUpIHtcclxuICAgICAgICBpZiAodHlwZW9mIHRoaXMub25WYWxpZGF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aGlzLm9uVmFsaWRhdGUoZmlsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIi8qXHJcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTcgS2FybCBTVEVJTlxyXG4gKlxyXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XHJcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcclxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xyXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXHJcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xyXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG4gKlxyXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGxcclxuICogY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuICpcclxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxyXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcclxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXHJcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcclxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcclxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEVcclxuICogU09GVFdBUkUuXHJcbiAqXHJcbiAqL1xyXG5cclxuaW1wb3J0IHtUZW1wbGF0ZX0gZnJvbSAnbWV0ZW9yL3RlbXBsYXRpbmcnO1xyXG5cclxuXHJcbmxldCBpc01JTUUgPSBmdW5jdGlvbiAodHlwZSwgbWltZSkge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJ1xyXG4gICAgICAgICYmIHR5cGVvZiBtaW1lID09PSAnc3RyaW5nJ1xyXG4gICAgICAgICYmIG1pbWUuaW5kZXhPZih0eXBlICsgJy8nKSA9PT0gMDtcclxufTtcclxuXHJcblRlbXBsYXRlLnJlZ2lzdGVySGVscGVyKCdpc0FwcGxpY2F0aW9uJywgZnVuY3Rpb24gKHR5cGUpIHtcclxuICAgIHJldHVybiBpc01JTUUoJ2FwcGxpY2F0aW9uJywgdGhpcy50eXBlIHx8IHR5cGUpO1xyXG59KTtcclxuXHJcblRlbXBsYXRlLnJlZ2lzdGVySGVscGVyKCdpc0F1ZGlvJywgZnVuY3Rpb24gKHR5cGUpIHtcclxuICAgIHJldHVybiBpc01JTUUoJ2F1ZGlvJywgdGhpcy50eXBlIHx8IHR5cGUpO1xyXG59KTtcclxuXHJcblRlbXBsYXRlLnJlZ2lzdGVySGVscGVyKCdpc0ltYWdlJywgZnVuY3Rpb24gKHR5cGUpIHtcclxuICAgIHJldHVybiBpc01JTUUoJ2ltYWdlJywgdGhpcy50eXBlIHx8IHR5cGUpO1xyXG59KTtcclxuXHJcblRlbXBsYXRlLnJlZ2lzdGVySGVscGVyKCdpc1RleHQnLCBmdW5jdGlvbiAodHlwZSkge1xyXG4gICAgcmV0dXJuIGlzTUlNRSgndGV4dCcsIHRoaXMudHlwZSB8fCB0eXBlKTtcclxufSk7XHJcblxyXG5UZW1wbGF0ZS5yZWdpc3RlckhlbHBlcignaXNWaWRlbycsIGZ1bmN0aW9uICh0eXBlKSB7XHJcbiAgICByZXR1cm4gaXNNSU1FKCd2aWRlbycsIHRoaXMudHlwZSB8fCB0eXBlKTtcclxufSk7XHJcbiIsIi8qXHJcbiAqIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTcgS2FybCBTVEVJTlxyXG4gKlxyXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XHJcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcclxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xyXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXHJcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xyXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG4gKlxyXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGxcclxuICogY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuICpcclxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxyXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcclxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXHJcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcclxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcclxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEVcclxuICogU09GVFdBUkUuXHJcbiAqXHJcbiAqL1xyXG5cclxuaW1wb3J0IHtNb25nb30gZnJvbSAnbWV0ZW9yL21vbmdvJztcclxuXHJcbi8qKlxyXG4gKiBDb2xsZWN0aW9uIG9mIHVwbG9hZCB0b2tlbnNcclxuICogQHR5cGUge01vbmdvLkNvbGxlY3Rpb259XHJcbiAqL1xyXG5leHBvcnQgY29uc3QgVG9rZW5zID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ3Vmc1Rva2VucycpO1xyXG4iLCIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuXHJcbmltcG9ydCB7X30gZnJvbSAnbWV0ZW9yL3VuZGVyc2NvcmUnO1xyXG5pbXBvcnQge01ldGVvcn0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XHJcbmltcG9ydCB7U3RvcmV9IGZyb20gJy4vdWZzLXN0b3JlJztcclxuXHJcblxyXG4vKipcclxuICogRmlsZSB1cGxvYWRlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFVwbG9hZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuICAgICAgICAvLyBTZXQgZGVmYXVsdCBvcHRpb25zXHJcbiAgICAgICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHtcclxuICAgICAgICAgICAgYWRhcHRpdmU6IHRydWUsXHJcbiAgICAgICAgICAgIGNhcGFjaXR5OiAwLjksXHJcbiAgICAgICAgICAgIGNodW5rU2l6ZTogMTYgKiAxMDI0LFxyXG4gICAgICAgICAgICBkYXRhOiBudWxsLFxyXG4gICAgICAgICAgICBmaWxlOiBudWxsLFxyXG4gICAgICAgICAgICBtYXhDaHVua1NpemU6IDQgKiAxMDI0ICogMTAwMCxcclxuICAgICAgICAgICAgbWF4VHJpZXM6IDUsXHJcbiAgICAgICAgICAgIG9uQWJvcnQ6IHRoaXMub25BYm9ydCxcclxuICAgICAgICAgICAgb25Db21wbGV0ZTogdGhpcy5vbkNvbXBsZXRlLFxyXG4gICAgICAgICAgICBvbkNyZWF0ZTogdGhpcy5vbkNyZWF0ZSxcclxuICAgICAgICAgICAgb25FcnJvcjogdGhpcy5vbkVycm9yLFxyXG4gICAgICAgICAgICBvblByb2dyZXNzOiB0aGlzLm9uUHJvZ3Jlc3MsXHJcbiAgICAgICAgICAgIG9uU3RhcnQ6IHRoaXMub25TdGFydCxcclxuICAgICAgICAgICAgb25TdG9wOiB0aGlzLm9uU3RvcCxcclxuICAgICAgICAgICAgcmV0cnlEZWxheTogMjAwMCxcclxuICAgICAgICAgICAgc3RvcmU6IG51bGwsXHJcbiAgICAgICAgICAgIHRyYW5zZmVyRGVsYXk6IDEwMFxyXG4gICAgICAgIH0sIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBDaGVjayBvcHRpb25zXHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmFkYXB0aXZlICE9PSAnYm9vbGVhbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYWRhcHRpdmUgaXMgbm90IGEgbnVtYmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5jYXBhY2l0eSAhPT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignY2FwYWNpdHkgaXMgbm90IGEgbnVtYmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25zLmNhcGFjaXR5IDw9IDAgfHwgb3B0aW9ucy5jYXBhY2l0eSA+IDEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2NhcGFjaXR5IG11c3QgYmUgYSBmbG9hdCBiZXR3ZWVuIDAuMSBhbmQgMS4wJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5jaHVua1NpemUgIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NodW5rU2l6ZSBpcyBub3QgYSBudW1iZXInKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCEob3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQmxvYikgJiYgIShvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBGaWxlKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdkYXRhIGlzIG5vdCBhbiBCbG9iIG9yIEZpbGUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuZmlsZSA9PT0gbnVsbCB8fCB0eXBlb2Ygb3B0aW9ucy5maWxlICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdmaWxlIGlzIG5vdCBhbiBvYmplY3QnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLm1heENodW5rU2l6ZSAhPT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbWF4Q2h1bmtTaXplIGlzIG5vdCBhIG51bWJlcicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMubWF4VHJpZXMgIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ21heFRyaWVzIGlzIG5vdCBhIG51bWJlcicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMucmV0cnlEZWxheSAhPT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmV0cnlEZWxheSBpcyBub3QgYSBudW1iZXInKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnRyYW5zZmVyRGVsYXkgIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3RyYW5zZmVyRGVsYXkgaXMgbm90IGEgbnVtYmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5vbkFib3J0ICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ29uQWJvcnQgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLm9uQ29tcGxldGUgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb25Db21wbGV0ZSBpcyBub3QgYSBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMub25DcmVhdGUgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb25DcmVhdGUgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLm9uRXJyb3IgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb25FcnJvciBpcyBub3QgYSBmdW5jdGlvbicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMub25Qcm9ncmVzcyAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvblByb2dyZXNzIGlzIG5vdCBhIGZ1bmN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5vblN0YXJ0ICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ29uU3RhcnQgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLm9uU3RvcCAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvblN0b3AgaXMgbm90IGEgZnVuY3Rpb24nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnN0b3JlICE9PSAnc3RyaW5nJyAmJiAhKG9wdGlvbnMuc3RvcmUgaW5zdGFuY2VvZiBTdG9yZSkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RvcmUgbXVzdCBiZSB0aGUgbmFtZSBvZiB0aGUgc3RvcmUgb3IgYW4gaW5zdGFuY2Ugb2YgVXBsb2FkRlMuU3RvcmUnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFB1YmxpYyBhdHRyaWJ1dGVzXHJcbiAgICAgICAgc2VsZi5hZGFwdGl2ZSA9IG9wdGlvbnMuYWRhcHRpdmU7XHJcbiAgICAgICAgc2VsZi5jYXBhY2l0eSA9IHBhcnNlRmxvYXQob3B0aW9ucy5jYXBhY2l0eSk7XHJcbiAgICAgICAgc2VsZi5jaHVua1NpemUgPSBwYXJzZUludChvcHRpb25zLmNodW5rU2l6ZSk7XHJcbiAgICAgICAgc2VsZi5tYXhDaHVua1NpemUgPSBwYXJzZUludChvcHRpb25zLm1heENodW5rU2l6ZSk7XHJcbiAgICAgICAgc2VsZi5tYXhUcmllcyA9IHBhcnNlSW50KG9wdGlvbnMubWF4VHJpZXMpO1xyXG4gICAgICAgIHNlbGYucmV0cnlEZWxheSA9IHBhcnNlSW50KG9wdGlvbnMucmV0cnlEZWxheSk7XHJcbiAgICAgICAgc2VsZi50cmFuc2ZlckRlbGF5ID0gcGFyc2VJbnQob3B0aW9ucy50cmFuc2ZlckRlbGF5KTtcclxuICAgICAgICBzZWxmLm9uQWJvcnQgPSBvcHRpb25zLm9uQWJvcnQ7XHJcbiAgICAgICAgc2VsZi5vbkNvbXBsZXRlID0gb3B0aW9ucy5vbkNvbXBsZXRlO1xyXG4gICAgICAgIHNlbGYub25DcmVhdGUgPSBvcHRpb25zLm9uQ3JlYXRlO1xyXG4gICAgICAgIHNlbGYub25FcnJvciA9IG9wdGlvbnMub25FcnJvcjtcclxuICAgICAgICBzZWxmLm9uUHJvZ3Jlc3MgPSBvcHRpb25zLm9uUHJvZ3Jlc3M7XHJcbiAgICAgICAgc2VsZi5vblN0YXJ0ID0gb3B0aW9ucy5vblN0YXJ0O1xyXG4gICAgICAgIHNlbGYub25TdG9wID0gb3B0aW9ucy5vblN0b3A7XHJcblxyXG4gICAgICAgIC8vIFByaXZhdGUgYXR0cmlidXRlc1xyXG4gICAgICAgIGxldCBzdG9yZSA9IG9wdGlvbnMuc3RvcmU7XHJcbiAgICAgICAgbGV0IGRhdGEgPSBvcHRpb25zLmRhdGE7XHJcbiAgICAgICAgbGV0IGNhcGFjaXR5TWFyZ2luID0gMC4xO1xyXG4gICAgICAgIGxldCBmaWxlID0gb3B0aW9ucy5maWxlO1xyXG4gICAgICAgIGxldCBmaWxlSWQgPSBudWxsO1xyXG4gICAgICAgIGxldCBvZmZzZXQgPSAwO1xyXG4gICAgICAgIGxldCBsb2FkZWQgPSAwO1xyXG4gICAgICAgIGxldCB0b3RhbCA9IGRhdGEuc2l6ZTtcclxuICAgICAgICBsZXQgdHJpZXMgPSAwO1xyXG4gICAgICAgIGxldCBwb3N0VXJsID0gbnVsbDtcclxuICAgICAgICBsZXQgdG9rZW4gPSBudWxsO1xyXG4gICAgICAgIGxldCBjb21wbGV0ZSA9IGZhbHNlO1xyXG4gICAgICAgIGxldCB1cGxvYWRpbmcgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgbGV0IHRpbWVBID0gbnVsbDtcclxuICAgICAgICBsZXQgdGltZUIgPSBudWxsO1xyXG5cclxuICAgICAgICBsZXQgZWxhcHNlZFRpbWUgPSAwO1xyXG4gICAgICAgIGxldCBzdGFydFRpbWUgPSAwO1xyXG5cclxuICAgICAgICAvLyBLZWVwIG9ubHkgdGhlIG5hbWUgb2YgdGhlIHN0b3JlXHJcbiAgICAgICAgaWYgKHN0b3JlIGluc3RhbmNlb2YgU3RvcmUpIHtcclxuICAgICAgICAgICAgc3RvcmUgPSBzdG9yZS5nZXROYW1lKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBBc3NpZ24gZmlsZSB0byBzdG9yZVxyXG4gICAgICAgIGZpbGUuc3RvcmUgPSBzdG9yZTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gZmluaXNoKCkge1xyXG4gICAgICAgICAgICAvLyBGaW5pc2ggdGhlIHVwbG9hZCBieSB0ZWxsaW5nIHRoZSBzdG9yZSB0aGUgdXBsb2FkIGlzIGNvbXBsZXRlXHJcbiAgICAgICAgICAgIE1ldGVvci5jYWxsKCd1ZnNDb21wbGV0ZScsIGZpbGVJZCwgc3RvcmUsIHRva2VuLCBmdW5jdGlvbiAoZXJyLCB1cGxvYWRlZEZpbGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLm9uRXJyb3IoZXJyLCBmaWxlKTtcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLmFib3J0KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh1cGxvYWRlZEZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICB1cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZSA9IHVwbG9hZGVkRmlsZTtcclxuICAgICAgICAgICAgICAgICAgICBzZWxmLm9uQ29tcGxldGUodXBsb2FkZWRGaWxlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBBYm9ydHMgdGhlIGN1cnJlbnQgdHJhbnNmZXJcclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmFib3J0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAvLyBSZW1vdmUgdGhlIGZpbGUgZnJvbSBkYXRhYmFzZVxyXG4gICAgICAgICAgICBNZXRlb3IuY2FsbCgndWZzRGVsZXRlJywgZmlsZUlkLCBzdG9yZSwgdG9rZW4sIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYub25FcnJvcihlcnIsIGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIFJlc2V0IHVwbG9hZGVyIHN0YXR1c1xyXG4gICAgICAgICAgICB1cGxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgZmlsZUlkID0gbnVsbDtcclxuICAgICAgICAgICAgb2Zmc2V0ID0gMDtcclxuICAgICAgICAgICAgdHJpZXMgPSAwO1xyXG4gICAgICAgICAgICBsb2FkZWQgPSAwO1xyXG4gICAgICAgICAgICBjb21wbGV0ZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICBzdGFydFRpbWUgPSBudWxsO1xyXG4gICAgICAgICAgICBzZWxmLm9uQWJvcnQoZmlsZSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgYXZlcmFnZSBzcGVlZCBpbiBieXRlcyBwZXIgc2Vjb25kXHJcbiAgICAgICAgICogQHJldHVybnMge251bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmdldEF2ZXJhZ2VTcGVlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgbGV0IHNlY29uZHMgPSBzZWxmLmdldEVsYXBzZWRUaW1lKCkgLyAxMDAwO1xyXG4gICAgICAgICAgICByZXR1cm4gc2VsZi5nZXRMb2FkZWQoKSAvIHNlY29uZHM7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgZWxhcHNlZCB0aW1lIGluIG1pbGxpc2Vjb25kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2VsZi5nZXRFbGFwc2VkVGltZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHN0YXJ0VGltZSAmJiBzZWxmLmlzVXBsb2FkaW5nKCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBlbGFwc2VkVGltZSArIChEYXRlLm5vdygpIC0gc3RhcnRUaW1lKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZWxhcHNlZFRpbWU7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgZmlsZVxyXG4gICAgICAgICAqIEByZXR1cm4ge29iamVjdH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmdldEZpbGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWxlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgdGhlIGxvYWRlZCBieXRlc1xyXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmdldExvYWRlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGxvYWRlZDtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm5zIGN1cnJlbnQgcHJvZ3Jlc3NcclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2VsZi5nZXRQcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWluKChsb2FkZWQgLyB0b3RhbCkgKiAxMDAgLyAxMDAsIDEuMCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgcmVtYWluaW5nIHRpbWUgaW4gbWlsbGlzZWNvbmRzXHJcbiAgICAgICAgICogQHJldHVybnMge251bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmdldFJlbWFpbmluZ1RpbWUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGxldCBhdmVyYWdlU3BlZWQgPSBzZWxmLmdldEF2ZXJhZ2VTcGVlZCgpO1xyXG4gICAgICAgICAgICBsZXQgcmVtYWluaW5nQnl0ZXMgPSB0b3RhbCAtIHNlbGYuZ2V0TG9hZGVkKCk7XHJcbiAgICAgICAgICAgIHJldHVybiBhdmVyYWdlU3BlZWQgJiYgcmVtYWluaW5nQnl0ZXMgPyBNYXRoLm1heChyZW1haW5pbmdCeXRlcyAvIGF2ZXJhZ2VTcGVlZCwgMCkgOiAwO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgdGhlIHVwbG9hZCBzcGVlZCBpbiBieXRlcyBwZXIgc2Vjb25kXHJcbiAgICAgICAgICogQHJldHVybnMge251bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmdldFNwZWVkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGltZUEgJiYgdGltZUIgJiYgc2VsZi5pc1VwbG9hZGluZygpKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgc2Vjb25kcyA9ICh0aW1lQiAtIHRpbWVBKSAvIDEwMDA7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5jaHVua1NpemUgLyBzZWNvbmRzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgdGhlIHRvdGFsIGJ5dGVzXHJcbiAgICAgICAgICogQHJldHVybiB7bnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNlbGYuZ2V0VG90YWwgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0b3RhbDtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDaGVja3MgaWYgdGhlIHRyYW5zZmVyIGlzIGNvbXBsZXRlXHJcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLmlzQ29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb21wbGV0ZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDaGVja3MgaWYgdGhlIHRyYW5zZmVyIGlzIGFjdGl2ZVxyXG4gICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2VsZi5pc1VwbG9hZGluZyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVwbG9hZGluZztcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZWFkcyBhIHBvcnRpb24gb2YgZmlsZVxyXG4gICAgICAgICAqIEBwYXJhbSBzdGFydFxyXG4gICAgICAgICAqIEBwYXJhbSBsZW5ndGhcclxuICAgICAgICAgKiBAcGFyYW0gY2FsbGJhY2tcclxuICAgICAgICAgKiBAcmV0dXJucyB7QmxvYn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZWxmLnJlYWRDaHVuayA9IGZ1bmN0aW9uIChzdGFydCwgbGVuZ3RoLCBjYWxsYmFjaykge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncmVhZENodW5rIGlzIG1pc3NpbmcgY2FsbGJhY2snKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGVuZDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDYWxjdWxhdGUgdGhlIGNodW5rIHNpemVcclxuICAgICAgICAgICAgICAgIGlmIChsZW5ndGggJiYgc3RhcnQgKyBsZW5ndGggPiB0b3RhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGVuZCA9IHRvdGFsO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBlbmQgPSBzdGFydCArIGxlbmd0aDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vIEdldCBjaHVua1xyXG4gICAgICAgICAgICAgICAgbGV0IGNodW5rID0gZGF0YS5zbGljZShzdGFydCwgZW5kKTtcclxuICAgICAgICAgICAgICAgIC8vIFBhc3MgY2h1bmsgdG8gY2FsbGJhY2tcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoc2VsZiwgbnVsbCwgY2h1bmspO1xyXG5cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdyZWFkIGVycm9yJywgZXJyKTtcclxuICAgICAgICAgICAgICAgIC8vIFJldHJ5IHRvIHJlYWQgY2h1bmtcclxuICAgICAgICAgICAgICAgIE1ldGVvci5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHJpZXMgPCBzZWxmLm1heFRyaWVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyaWVzICs9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVhZENodW5rKHN0YXJ0LCBsZW5ndGgsIGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCBzZWxmLnJldHJ5RGVsYXkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2VuZHMgYSBmaWxlIGNodW5rIHRvIHRoZSBzdG9yZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNlbGYuc2VuZENodW5rID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAoIWNvbXBsZXRlICYmIHN0YXJ0VGltZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG9mZnNldCA8IHRvdGFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNodW5rU2l6ZSA9IHNlbGYuY2h1bmtTaXplO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBVc2UgYWRhcHRpdmUgbGVuZ3RoXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuYWRhcHRpdmUgJiYgdGltZUEgJiYgdGltZUIgJiYgdGltZUIgPiB0aW1lQSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZHVyYXRpb24gPSAodGltZUIgLSB0aW1lQSkgLyAxMDAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWF4ID0gc2VsZi5jYXBhY2l0eSAqICgxICsgY2FwYWNpdHlNYXJnaW4pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWluID0gc2VsZi5jYXBhY2l0eSAqICgxIC0gY2FwYWNpdHlNYXJnaW4pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGR1cmF0aW9uID49IG1heCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmtTaXplID0gTWF0aC5hYnMoTWF0aC5yb3VuZChjaHVua1NpemUgKiAobWF4IC0gZHVyYXRpb24pKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGR1cmF0aW9uIDwgbWluKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaHVua1NpemUgPSBNYXRoLnJvdW5kKGNodW5rU2l6ZSAqIChtaW4gLyBkdXJhdGlvbikpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIExpbWl0IHRvIG1heCBjaHVuayBzaXplXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLm1heENodW5rU2l6ZSA+IDAgJiYgY2h1bmtTaXplID4gc2VsZi5tYXhDaHVua1NpemUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNodW5rU2l6ZSA9IHNlbGYubWF4Q2h1bmtTaXplO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBMaW1pdCB0byBtYXggY2h1bmsgc2l6ZVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLm1heENodW5rU2l6ZSA+IDAgJiYgY2h1bmtTaXplID4gc2VsZi5tYXhDaHVua1NpemUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmtTaXplID0gc2VsZi5tYXhDaHVua1NpemU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBSZWR1Y2UgY2h1bmsgc2l6ZSB0byBmaXQgdG90YWxcclxuICAgICAgICAgICAgICAgICAgICBpZiAob2Zmc2V0ICsgY2h1bmtTaXplID4gdG90YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmtTaXplID0gdG90YWwgLSBvZmZzZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBQcmVwYXJlIHRoZSBjaHVua1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVhZENodW5rKG9mZnNldCwgY2h1bmtTaXplLCBmdW5jdGlvbiAoZXJyLCBjaHVuaykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9uRXJyb3IoZXJyLCBmaWxlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF8uY29udGFpbnMoWzIwMCwgMjAxLCAyMDIsIDIwNF0sIHhoci5zdGF0dXMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVCID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ICs9IGNodW5rU2l6ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZGVkICs9IGNodW5rU2l6ZTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbmV4dCBjaHVua1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9uUHJvZ3Jlc3MoZmlsZSwgc2VsZi5nZXRQcm9ncmVzcygpKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpbmlzaCB1cGxvYWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvYWRlZCA+PSB0b3RhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxhcHNlZFRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNZXRlb3Iuc2V0VGltZW91dChzZWxmLnNlbmRDaHVuaywgc2VsZi50cmFuc2ZlckRlbGF5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICghXy5jb250YWlucyhbNDAyLCA0MDMsIDQwNCwgNTAwXSwgeGhyLnN0YXR1cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmV0cnkgdW50aWwgbWF4IHRyaWVzIGlzIHJlYWNoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJ1dCBkb24ndCByZXRyeSBpZiB0aGVzZSBlcnJvcnMgb2NjdXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRyaWVzIDw9IHNlbGYubWF4VHJpZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyaWVzICs9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IGJlZm9yZSByZXRyeWluZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWV0ZW9yLnNldFRpbWVvdXQoc2VsZi5zZW5kQ2h1bmssIHNlbGYucmV0cnlEZWxheSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmFib3J0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuYWJvcnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDYWxjdWxhdGUgdXBsb2FkIHByb2dyZXNzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwcm9ncmVzcyA9IChvZmZzZXQgKyBjaHVua1NpemUpIC8gdG90YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxldCBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3JtRGF0YS5hcHBlbmQoJ3Byb2dyZXNzJywgcHJvZ3Jlc3MpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3JtRGF0YS5hcHBlbmQoJ2NodW5rJywgY2h1bmspO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdXJsID0gYCR7cG9zdFVybH0mcHJvZ3Jlc3M9JHtwcm9ncmVzc31gO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZUEgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lQiA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwbG9hZGluZyA9IHRydWU7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIGNodW5rIHRvIHRoZSBzdG9yZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB4aHIub3BlbignUE9TVCcsIHVybCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHhoci5zZW5kKGNodW5rKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFN0YXJ0cyBvciByZXN1bWVzIHRoZSB0cmFuc2ZlclxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNlbGYuc3RhcnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghZmlsZUlkKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGZpbGUgZG9jdW1lbnQgYW5kIGdldCB0aGUgdG9rZW5cclxuICAgICAgICAgICAgICAgIC8vIHRoYXQgYWxsb3dzIHRoZSB1c2VyIHRvIHNlbmQgY2h1bmtzIHRvIHRoZSBzdG9yZS5cclxuICAgICAgICAgICAgICAgIE1ldGVvci5jYWxsKCd1ZnNDcmVhdGUnLCBfLmV4dGVuZCh7fSwgZmlsZSksIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vbkVycm9yKGVyciwgZmlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZXN1bHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4gPSByZXN1bHQudG9rZW47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RVcmwgPSByZXN1bHQudXJsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlSWQgPSByZXN1bHQuZmlsZUlkO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLl9pZCA9IHJlc3VsdC5maWxlSWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYub25DcmVhdGUoZmlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyaWVzID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vblN0YXJ0KGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNlbmRDaHVuaygpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF1cGxvYWRpbmcgJiYgIWNvbXBsZXRlKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBSZXN1bWUgdXBsb2FkaW5nXHJcbiAgICAgICAgICAgICAgICB0cmllcyA9IDA7XHJcbiAgICAgICAgICAgICAgICBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5vblN0YXJ0KGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5zZW5kQ2h1bmsoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFN0b3BzIHRoZSB0cmFuc2ZlclxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNlbGYuc3RvcCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHVwbG9hZGluZykge1xyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGVsYXBzZWQgdGltZVxyXG4gICAgICAgICAgICAgICAgZWxhcHNlZFRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG4gICAgICAgICAgICAgICAgc3RhcnRUaW1lID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIHVwbG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5vblN0b3AoZmlsZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgTWV0ZW9yLmNhbGwoJ3Vmc1N0b3AnLCBmaWxlSWQsIHN0b3JlLCB0b2tlbiwgZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLm9uRXJyb3IoZXJyLCBmaWxlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgZmlsZSB1cGxvYWQgaXMgYWJvcnRlZFxyXG4gICAgICogQHBhcmFtIGZpbGVcclxuICAgICAqL1xyXG4gICAgb25BYm9ydChmaWxlKSB7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgZmlsZSB1cGxvYWQgaXMgY29tcGxldGVcclxuICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgKi9cclxuICAgIG9uQ29tcGxldGUoZmlsZSkge1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIGZpbGUgaXMgY3JlYXRlZCBpbiB0aGUgY29sbGVjdGlvblxyXG4gICAgICogQHBhcmFtIGZpbGVcclxuICAgICAqL1xyXG4gICAgb25DcmVhdGUoZmlsZSkge1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsbGVkIHdoZW4gYW4gZXJyb3Igb2NjdXJzIGR1cmluZyBmaWxlIHVwbG9hZFxyXG4gICAgICogQHBhcmFtIGVyclxyXG4gICAgICogQHBhcmFtIGZpbGVcclxuICAgICAqL1xyXG4gICAgb25FcnJvcihlcnIsIGZpbGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGB1ZnM6ICR7ZXJyLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiBhIGZpbGUgY2h1bmsgaGFzIGJlZW4gc2VudFxyXG4gICAgICogQHBhcmFtIGZpbGVcclxuICAgICAqIEBwYXJhbSBwcm9ncmVzcyBpcyBhIGZsb2F0IGZyb20gMC4wIHRvIDEuMFxyXG4gICAgICovXHJcbiAgICBvblByb2dyZXNzKGZpbGUsIHByb2dyZXNzKSB7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgZmlsZSB1cGxvYWQgc3RhcnRzXHJcbiAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICovXHJcbiAgICBvblN0YXJ0KGZpbGUpIHtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBmaWxlIHVwbG9hZCBzdG9wc1xyXG4gICAgICogQHBhcmFtIGZpbGVcclxuICAgICAqL1xyXG4gICAgb25TdG9wKGZpbGUpIHtcclxuICAgIH1cclxufVxyXG4iXX0=
