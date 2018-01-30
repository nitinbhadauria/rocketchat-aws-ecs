(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Autocomplete;

var require = meteorInstall({"node_modules":{"meteor":{"mizzao:autocomplete":{"server":{"autocomplete-server.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
// packages/mizzao_autocomplete/server/autocomplete-server.js                           //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////
                                                                                        //
// This also attaches an onStop callback to sub, so we don't need to worry about that.
// https://github.com/meteor/meteor/blob/devel/packages/mongo/collection.js
const Autocomplete = class {
	publishCursor(cursor, sub) {
		Mongo.Collection._publishCursor(cursor, sub, 'autocompleteRecords');
	}

};
Meteor.publish('autocomplete-recordset', function (selector, options, collName) {
	const collection = global[collName]; // This is a semi-documented Meteor feature:
	// https://github.com/meteor/meteor/blob/devel/packages/mongo-livedata/collection.js

	if (!collection) {
		throw new Error(`${collName} is not defined on the global namespace of the server.`);
	}

	if (!collection._isInsecure()) {
		Meteor._debug(`${collName} is a secure collection, therefore no data was returned because the client could compromise security by subscribing to arbitrary server collections via the browser console. Please write your own publish function.`);

		return []; // We need this for the subscription to be marked ready
	}

	if (options.limit) {
		// guard against client-side DOS: hard limit to 50
		options.limit = Math.min(50, Math.abs(options.limit));
	} // Push this into our own collection on the client so they don't interfere with other publications of the named collection.
	// This also stops the observer automatically when the subscription is stopped.


	Autocomplete.publishCursor(collection.find(selector, options), this); // Mark the subscription ready after the initial addition of documents.

	this.ready();
});
//////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/mizzao:autocomplete/server/autocomplete-server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['mizzao:autocomplete'] = {}, {
  Autocomplete: Autocomplete
});

})();

//# sourceURL=meteor://💻app/packages/mizzao_autocomplete.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWl6emFvOmF1dG9jb21wbGV0ZS9zZXJ2ZXIvYXV0b2NvbXBsZXRlLXNlcnZlci5qcyJdLCJuYW1lcyI6WyJBdXRvY29tcGxldGUiLCJwdWJsaXNoQ3Vyc29yIiwiY3Vyc29yIiwic3ViIiwiTW9uZ28iLCJDb2xsZWN0aW9uIiwiX3B1Ymxpc2hDdXJzb3IiLCJNZXRlb3IiLCJwdWJsaXNoIiwic2VsZWN0b3IiLCJvcHRpb25zIiwiY29sbE5hbWUiLCJjb2xsZWN0aW9uIiwiZ2xvYmFsIiwiRXJyb3IiLCJfaXNJbnNlY3VyZSIsIl9kZWJ1ZyIsImxpbWl0IiwiTWF0aCIsIm1pbiIsImFicyIsImZpbmQiLCJyZWFkeSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxNQUFNO0FBQzFCQyxlQUFjQyxNQUFkLEVBQXNCQyxHQUF0QixFQUEyQjtBQUMxQkMsUUFBTUMsVUFBTixDQUFpQkMsY0FBakIsQ0FBZ0NKLE1BQWhDLEVBQXdDQyxHQUF4QyxFQUE2QyxxQkFBN0M7QUFDQTs7QUFIeUIsQ0FBM0I7QUFNQUksT0FBT0MsT0FBUCxDQUFlLHdCQUFmLEVBQXlDLFVBQVNDLFFBQVQsRUFBbUJDLE9BQW5CLEVBQTRCQyxRQUE1QixFQUFzQztBQUM5RSxPQUFNQyxhQUFhQyxPQUFPRixRQUFQLENBQW5CLENBRDhFLENBRzlFO0FBQ0E7O0FBQ0EsS0FBSSxDQUFDQyxVQUFMLEVBQWlCO0FBQ2hCLFFBQU0sSUFBSUUsS0FBSixDQUFXLEdBQUdILFFBQVUsd0RBQXhCLENBQU47QUFDQTs7QUFDRCxLQUFJLENBQUNDLFdBQVdHLFdBQVgsRUFBTCxFQUErQjtBQUM5QlIsU0FBT1MsTUFBUCxDQUFlLEdBQUdMLFFBQVUsc05BQTVCOztBQUNBLFNBQU8sRUFBUCxDQUY4QixDQUVuQjtBQUNYOztBQUNELEtBQUlELFFBQVFPLEtBQVosRUFBbUI7QUFDbEI7QUFDQVAsVUFBUU8sS0FBUixHQUFnQkMsS0FBS0MsR0FBTCxDQUFTLEVBQVQsRUFBYUQsS0FBS0UsR0FBTCxDQUFTVixRQUFRTyxLQUFqQixDQUFiLENBQWhCO0FBQ0EsRUFmNkUsQ0FpQjlFO0FBQ0E7OztBQUNBakIsY0FBYUMsYUFBYixDQUEyQlcsV0FBV1MsSUFBWCxDQUFnQlosUUFBaEIsRUFBMEJDLE9BQTFCLENBQTNCLEVBQStELElBQS9ELEVBbkI4RSxDQW9COUU7O0FBQ0EsTUFBS1ksS0FBTDtBQUNBLENBdEJELEUiLCJmaWxlIjoiL3BhY2thZ2VzL21penphb19hdXRvY29tcGxldGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBUaGlzIGFsc28gYXR0YWNoZXMgYW4gb25TdG9wIGNhbGxiYWNrIHRvIHN1Yiwgc28gd2UgZG9uJ3QgbmVlZCB0byB3b3JyeSBhYm91dCB0aGF0LlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvYmxvYi9kZXZlbC9wYWNrYWdlcy9tb25nby9jb2xsZWN0aW9uLmpzXG5jb25zdCBBdXRvY29tcGxldGUgPSBjbGFzcyB7XG5cdHB1Ymxpc2hDdXJzb3IoY3Vyc29yLCBzdWIpIHtcblx0XHRNb25nby5Db2xsZWN0aW9uLl9wdWJsaXNoQ3Vyc29yKGN1cnNvciwgc3ViLCAnYXV0b2NvbXBsZXRlUmVjb3JkcycpO1xuXHR9XG59O1xuXG5NZXRlb3IucHVibGlzaCgnYXV0b2NvbXBsZXRlLXJlY29yZHNldCcsIGZ1bmN0aW9uKHNlbGVjdG9yLCBvcHRpb25zLCBjb2xsTmFtZSkge1xuXHRjb25zdCBjb2xsZWN0aW9uID0gZ2xvYmFsW2NvbGxOYW1lXTtcblxuXHQvLyBUaGlzIGlzIGEgc2VtaS1kb2N1bWVudGVkIE1ldGVvciBmZWF0dXJlOlxuXHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9ibG9iL2RldmVsL3BhY2thZ2VzL21vbmdvLWxpdmVkYXRhL2NvbGxlY3Rpb24uanNcblx0aWYgKCFjb2xsZWN0aW9uKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGAkeyBjb2xsTmFtZSB9IGlzIG5vdCBkZWZpbmVkIG9uIHRoZSBnbG9iYWwgbmFtZXNwYWNlIG9mIHRoZSBzZXJ2ZXIuYCk7XG5cdH1cblx0aWYgKCFjb2xsZWN0aW9uLl9pc0luc2VjdXJlKCkpIHtcblx0XHRNZXRlb3IuX2RlYnVnKGAkeyBjb2xsTmFtZSB9IGlzIGEgc2VjdXJlIGNvbGxlY3Rpb24sIHRoZXJlZm9yZSBubyBkYXRhIHdhcyByZXR1cm5lZCBiZWNhdXNlIHRoZSBjbGllbnQgY291bGQgY29tcHJvbWlzZSBzZWN1cml0eSBieSBzdWJzY3JpYmluZyB0byBhcmJpdHJhcnkgc2VydmVyIGNvbGxlY3Rpb25zIHZpYSB0aGUgYnJvd3NlciBjb25zb2xlLiBQbGVhc2Ugd3JpdGUgeW91ciBvd24gcHVibGlzaCBmdW5jdGlvbi5gKTtcblx0XHRyZXR1cm4gW107IC8vIFdlIG5lZWQgdGhpcyBmb3IgdGhlIHN1YnNjcmlwdGlvbiB0byBiZSBtYXJrZWQgcmVhZHlcblx0fVxuXHRpZiAob3B0aW9ucy5saW1pdCkge1xuXHRcdC8vIGd1YXJkIGFnYWluc3QgY2xpZW50LXNpZGUgRE9TOiBoYXJkIGxpbWl0IHRvIDUwXG5cdFx0b3B0aW9ucy5saW1pdCA9IE1hdGgubWluKDUwLCBNYXRoLmFicyhvcHRpb25zLmxpbWl0KSk7XG5cdH1cblxuXHQvLyBQdXNoIHRoaXMgaW50byBvdXIgb3duIGNvbGxlY3Rpb24gb24gdGhlIGNsaWVudCBzbyB0aGV5IGRvbid0IGludGVyZmVyZSB3aXRoIG90aGVyIHB1YmxpY2F0aW9ucyBvZiB0aGUgbmFtZWQgY29sbGVjdGlvbi5cblx0Ly8gVGhpcyBhbHNvIHN0b3BzIHRoZSBvYnNlcnZlciBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIHN1YnNjcmlwdGlvbiBpcyBzdG9wcGVkLlxuXHRBdXRvY29tcGxldGUucHVibGlzaEN1cnNvcihjb2xsZWN0aW9uLmZpbmQoc2VsZWN0b3IsIG9wdGlvbnMpLCB0aGlzKTtcblx0Ly8gTWFyayB0aGUgc3Vic2NyaXB0aW9uIHJlYWR5IGFmdGVyIHRoZSBpbml0aWFsIGFkZGl0aW9uIG9mIGRvY3VtZW50cy5cblx0dGhpcy5yZWFkeSgpO1xufSk7XG4iXX0=
