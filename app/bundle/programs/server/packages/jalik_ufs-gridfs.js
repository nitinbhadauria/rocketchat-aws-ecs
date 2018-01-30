(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var _ = Package.underscore._;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options;

var require = meteorInstall({"node_modules":{"meteor":{"jalik:ufs-gridfs":{"ufs-gridfs.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
// packages/jalik_ufs-gridfs/ufs-gridfs.js                                                  //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////
                                                                                            //
module.export({
    GridFSStore: () => GridFSStore
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
let UploadFS;
module.watch(require("meteor/jalik:ufs"), {
    UploadFS(v) {
        UploadFS = v;
    }

}, 3);

class GridFSStore extends UploadFS.Store {
    constructor(options) {
        // Default options
        options = _.extend({
            chunkSize: 1024 * 255,
            collectionName: 'uploadfs'
        }, options); // Check options

        if (typeof options.chunkSize !== "number") {
            throw new TypeError("GridFSStore: chunkSize is not a number");
        }

        if (typeof options.collectionName !== "string") {
            throw new TypeError("GridFSStore: collectionName is not a string");
        }

        super(options);
        this.chunkSize = options.chunkSize;
        this.collectionName = options.collectionName;

        if (Meteor.isServer) {
            let mongo = Package.mongo.MongoInternals.NpmModule;
            let db = Package.mongo.MongoInternals.defaultRemoteCollectionDriver().mongo.db;
            let mongoStore = new mongo.GridFSBucket(db, {
                bucketName: options.collectionName,
                chunkSizeBytes: options.chunkSize
            }); /**
                 * Removes the file
                 * @param fileId
                 * @param callback
                 */

            this.delete = function (fileId, callback) {
                if (typeof callback !== 'function') {
                    callback = function (err) {
                        if (err) {
                            console.error(err);
                        }
                    };
                }

                return mongoStore.delete(fileId, callback);
            }; /**
                * Returns the file read stream
                * @param fileId
                * @param file
                * @param options
                * @return {*}
                */

            this.getReadStream = function (fileId, file, options) {
                options = _.extend({}, options);
                return mongoStore.openDownloadStream(fileId, {
                    start: options.start,
                    end: options.end
                });
            }; /**
                * Returns the file write stream
                * @param fileId
                * @param file
                * @param options
                * @return {*}
                */

            this.getWriteStream = function (fileId, file, options) {
                let writeStream = mongoStore.openUploadStreamWithId(fileId, fileId, {
                    chunkSizeBytes: this.chunkSize,
                    contentType: file.type
                });
                writeStream.on('close', function () {
                    writeStream.emit('finish');
                });
                return writeStream;
            };
        }
    }

}

// Add store to UFS namespace
UploadFS.store.GridFS = GridFSStore;
//////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
var exports = require("./node_modules/meteor/jalik:ufs-gridfs/ufs-gridfs.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['jalik:ufs-gridfs'] = exports;

})();

//# sourceURL=meteor://💻app/packages/jalik_ufs-gridfs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvamFsaWs6dWZzLWdyaWRmcy91ZnMtZ3JpZGZzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkdyaWRGU1N0b3JlIiwiXyIsIndhdGNoIiwicmVxdWlyZSIsInYiLCJjaGVjayIsIk1ldGVvciIsIlVwbG9hZEZTIiwiU3RvcmUiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJleHRlbmQiLCJjaHVua1NpemUiLCJjb2xsZWN0aW9uTmFtZSIsIlR5cGVFcnJvciIsImlzU2VydmVyIiwibW9uZ28iLCJQYWNrYWdlIiwiTW9uZ29JbnRlcm5hbHMiLCJOcG1Nb2R1bGUiLCJkYiIsImRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIiwibW9uZ29TdG9yZSIsIkdyaWRGU0J1Y2tldCIsImJ1Y2tldE5hbWUiLCJjaHVua1NpemVCeXRlcyIsImRlbGV0ZSIsImZpbGVJZCIsImNhbGxiYWNrIiwiZXJyIiwiY29uc29sZSIsImVycm9yIiwiZ2V0UmVhZFN0cmVhbSIsImZpbGUiLCJvcGVuRG93bmxvYWRTdHJlYW0iLCJzdGFydCIsImVuZCIsImdldFdyaXRlU3RyZWFtIiwid3JpdGVTdHJlYW0iLCJvcGVuVXBsb2FkU3RyZWFtV2l0aElkIiwiY29udGVudFR5cGUiLCJ0eXBlIiwib24iLCJlbWl0Iiwic3RvcmUiLCJHcmlkRlMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsT0FBT0MsTUFBUCxDQUFjO0FBQUNDLGlCQUFZLE1BQUlBO0FBQWpCLENBQWQ7O0FBQTZDLElBQUlDLENBQUo7O0FBQU1ILE9BQU9JLEtBQVAsQ0FBYUMsUUFBUSxtQkFBUixDQUFiLEVBQTBDO0FBQUNGLE1BQUVHLENBQUYsRUFBSTtBQUFDSCxZQUFFRyxDQUFGO0FBQUk7O0FBQVYsQ0FBMUMsRUFBc0QsQ0FBdEQ7QUFBeUQsSUFBSUMsS0FBSjtBQUFVUCxPQUFPSSxLQUFQLENBQWFDLFFBQVEsY0FB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UCxLQUFLUTtBQUY4QyxpQkFBbEQsQ0FBbEI7QUFJQUgsNEJBQVlJLEVBQVosQ0FBZSxPQUFmLEVBQXdCLFlBQVk7QUFDaENKLGdDQUFZSyxJQUFaLENBQWlCLFFBQWpCO0FBQ0gsaUJBRkQ7QUFHQSx1QkFBT0wsV0FBUDtBQUNILGFBVEQ7QUFVSDtBQUNKOztBQS9FMkM7O0FBa0ZoRDtBQUNBL0IsU0FBU3FDLEtBQVQsQ0FBZUMsTUFBZixHQUF3QjdDLFdBQXhCLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2phbGlrX3Vmcy1ncmlkZnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICpcclxuICogQ29weXJpZ2h0IChjKSAyMDE3IEthcmwgU1RFSU5cclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFXHJcbiAqIFNPRlRXQVJFLlxyXG4gKlxyXG4gKi9cclxuaW1wb3J0IHtffSBmcm9tIFwibWV0ZW9yL3VuZGVyc2NvcmVcIjtcclxuaW1wb3J0IHtjaGVja30gZnJvbSBcIm1ldGVvci9jaGVja1wiO1xyXG5pbXBvcnQge01ldGVvcn0gZnJvbSBcIm1ldGVvci9tZXRlb3JcIjtcclxuaW1wb3J0IHtVcGxvYWRGU30gZnJvbSBcIm1ldGVvci9qYWxpazp1ZnNcIjtcclxuXHJcblxyXG4vKipcclxuICogR3JpZEZTIHN0b3JlXHJcbiAqIEBwYXJhbSBvcHRpb25zXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEdyaWRGU1N0b3JlIGV4dGVuZHMgVXBsb2FkRlMuU3RvcmUge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuICAgICAgICAvLyBEZWZhdWx0IG9wdGlvbnNcclxuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQoe1xyXG4gICAgICAgICAgICBjaHVua1NpemU6IDEwMjQgKiAyNTUsXHJcbiAgICAgICAgICAgIGNvbGxlY3Rpb25OYW1lOiAndXBsb2FkZnMnXHJcbiAgICAgICAgfSwgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIENoZWNrIG9wdGlvbnNcclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuY2h1bmtTaXplICE9PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHcmlkRlNTdG9yZTogY2h1bmtTaXplIGlzIG5vdCBhIG51bWJlclwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbGxlY3Rpb25OYW1lICE9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHcmlkRlNTdG9yZTogY29sbGVjdGlvbk5hbWUgaXMgbm90IGEgc3RyaW5nXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XHJcblxyXG4gICAgICAgIHRoaXMuY2h1bmtTaXplID0gb3B0aW9ucy5jaHVua1NpemU7XHJcbiAgICAgICAgdGhpcy5jb2xsZWN0aW9uTmFtZSA9IG9wdGlvbnMuY29sbGVjdGlvbk5hbWU7XHJcblxyXG4gICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcclxuICAgICAgICAgICAgbGV0IG1vbmdvID0gUGFja2FnZS5tb25nby5Nb25nb0ludGVybmFscy5OcG1Nb2R1bGU7XHJcbiAgICAgICAgICAgIGxldCBkYiA9IFBhY2thZ2UubW9uZ28uTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIoKS5tb25nby5kYjtcclxuICAgICAgICAgICAgbGV0IG1vbmdvU3RvcmUgPSBuZXcgbW9uZ28uR3JpZEZTQnVja2V0KGRiLCB7XHJcbiAgICAgICAgICAgICAgICBidWNrZXROYW1lOiBvcHRpb25zLmNvbGxlY3Rpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgY2h1bmtTaXplQnl0ZXM6IG9wdGlvbnMuY2h1bmtTaXplXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIFJlbW92ZXMgdGhlIGZpbGVcclxuICAgICAgICAgICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gY2FsbGJhY2tcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlID0gZnVuY3Rpb24gKGZpbGVJZCwgY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vbmdvU3RvcmUuZGVsZXRlKGZpbGVJZCwgY2FsbGJhY2spO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIFJldHVybnMgdGhlIGZpbGUgcmVhZCBzdHJlYW1cclxuICAgICAgICAgICAgICogQHBhcmFtIGZpbGVJZFxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlsZVxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gb3B0aW9uc1xyXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHsqfVxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgdGhpcy5nZXRSZWFkU3RyZWFtID0gZnVuY3Rpb24gKGZpbGVJZCwgZmlsZSwgb3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHt9LCBvcHRpb25zKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb25nb1N0b3JlLm9wZW5Eb3dubG9hZFN0cmVhbShmaWxlSWQsIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGFydDogb3B0aW9ucy5zdGFydCxcclxuICAgICAgICAgICAgICAgICAgICBlbmQ6IG9wdGlvbnMuZW5kXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBSZXR1cm5zIHRoZSBmaWxlIHdyaXRlIHN0cmVhbVxyXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlsZUlkXHJcbiAgICAgICAgICAgICAqIEBwYXJhbSBmaWxlXHJcbiAgICAgICAgICAgICAqIEBwYXJhbSBvcHRpb25zXHJcbiAgICAgICAgICAgICAqIEByZXR1cm4geyp9XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB0aGlzLmdldFdyaXRlU3RyZWFtID0gZnVuY3Rpb24gKGZpbGVJZCwgZmlsZSwgb3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgbGV0IHdyaXRlU3RyZWFtID0gbW9uZ29TdG9yZS5vcGVuVXBsb2FkU3RyZWFtV2l0aElkKGZpbGVJZCwgZmlsZUlkLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2h1bmtTaXplQnl0ZXM6IHRoaXMuY2h1bmtTaXplLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLnR5cGVcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgd3JpdGVTdHJlYW0ub24oJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdyaXRlU3RyZWFtLmVtaXQoJ2ZpbmlzaCcpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gd3JpdGVTdHJlYW07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vLyBBZGQgc3RvcmUgdG8gVUZTIG5hbWVzcGFjZVxyXG5VcGxvYWRGUy5zdG9yZS5HcmlkRlMgPSBHcmlkRlNTdG9yZTtcclxuIl19
