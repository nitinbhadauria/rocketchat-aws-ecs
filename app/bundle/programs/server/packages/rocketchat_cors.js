(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:cors":{"cors.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_cors/cors.js                                                                    //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let url;
module.watch(require("url"), {
	default(v) {
		url = v;
	}

}, 1);
let tls;
module.watch(require("tls"), {
	default(v) {
		tls = v;
	}

}, 2);
// FIX For TLS error see more here https://github.com/RocketChat/Rocket.Chat/issues/9316
// TODO: Remove after NodeJS fix it, more information https://github.com/nodejs/node/issues/16196 https://github.com/nodejs/node/pull/16853
tls.DEFAULT_ECDH_CURVE = 'auto';
WebApp.rawConnectHandlers.use(Meteor.bindEnvironment(function (req, res, next) {
	if (req._body) {
		return next();
	}

	if (req.headers['transfer-encoding'] === undefined && isNaN(req.headers['content-length'])) {
		return next();
	}

	if (req.headers['content-type'] !== '' && req.headers['content-type'] !== undefined) {
		return next();
	}

	if (req.url.indexOf(`${__meteor_runtime_config__.ROOT_URL_PATH_PREFIX}/ufs/`) === 0) {
		return next();
	}

	let buf = '';
	req.setEncoding('utf8');
	req.on('data', function (chunk) {
		return buf += chunk;
	});
	req.on('end', function () {
		if (RocketChat && RocketChat.debugLevel === 'debug') {
			console.log('[request]'.green, req.method, req.url, '\nheaders ->', req.headers, '\nbody ->', buf);
		}

		try {
			req.body = JSON.parse(buf);
		} catch (error) {
			req.body = buf;
		}

		req._body = true;
		return next();
	});
}));
WebApp.rawConnectHandlers.use(function (req, res, next) {
	if (/^\/(api|_timesync|sockjs|tap-i18n|__cordova)(\/|$)/.test(req.url)) {
		res.setHeader('Access-Control-Allow-Origin', '*');
	}

	const setHeader = res.setHeader;

	res.setHeader = function (key, val) {
		if (key.toLowerCase() === 'access-control-allow-origin' && val === 'http://meteor.local') {
			return;
		}

		return setHeader.apply(this, arguments);
	};

	return next();
});
const _staticFilesMiddleware = WebAppInternals.staticFilesMiddleware;

WebAppInternals._staticFilesMiddleware = function (staticFiles, req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	return _staticFilesMiddleware(staticFiles, req, res, next);
};

const oldHttpServerListeners = WebApp.httpServer.listeners('request').slice(0);
WebApp.httpServer.removeAllListeners('request');
WebApp.httpServer.addListener('request', function (req, res) {
	const next = () => {
		for (const oldListener of oldHttpServerListeners) {
			oldListener.apply(WebApp.httpServer, arguments);
		}
	};

	if (RocketChat.settings.get('Force_SSL') !== true) {
		next();
		return;
	}

	const remoteAddress = req.connection.remoteAddress || req.socket.remoteAddress;
	const localhostRegexp = /^\s*(127\.0\.0\.1|::1)\s*$/;

	const localhostTest = function (x) {
		return localhostRegexp.test(x);
	};

	const isLocal = localhostRegexp.test(remoteAddress) && (!req.headers['x-forwarded-for'] || _.all(req.headers['x-forwarded-for'].split(','), localhostTest));

	const isSsl = req.connection.pair || req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'].indexOf('https') !== -1;

	if (RocketChat && RocketChat.debugLevel === 'debug') {
		console.log('req.url', req.url);
		console.log('remoteAddress', remoteAddress);
		console.log('isLocal', isLocal);
		console.log('isSsl', isSsl);
		console.log('req.headers', req.headers);
	}

	if (!isLocal && !isSsl) {
		let host = req.headers['host'] || url.parse(Meteor.absoluteUrl()).hostname;
		host = host.replace(/:\d+$/, '');
		res.writeHead(302, {
			'Location': `https://${host}${req.url}`
		});
		res.end();
		return;
	}

	return next();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

},"common.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/rocketchat_cors/common.js                                                                  //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
Meteor.startup(function () {
	RocketChat.settings.onload('Force_SSL', function (key, value) {
		Meteor.absoluteUrl.defaultOptions.secure = value;
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:cors/cors.js");
require("./node_modules/meteor/rocketchat:cors/common.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:cors'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_cors.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpjb3JzL2NvcnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Y29ycy9jb21tb24uanMiXSwibmFtZXMiOlsiXyIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2IiwidXJsIiwidGxzIiwiREVGQVVMVF9FQ0RIX0NVUlZFIiwiV2ViQXBwIiwicmF3Q29ubmVjdEhhbmRsZXJzIiwidXNlIiwiTWV0ZW9yIiwiYmluZEVudmlyb25tZW50IiwicmVxIiwicmVzIiwibmV4dCIsIl9ib2R5IiwiaGVhZGVycyIsInVuZGVmaW5lZCIsImlzTmFOIiwiaW5kZXhPZiIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsImJ1ZiIsInNldEVuY29kaW5nIiwib24iLCJjaHVuayIsIlJvY2tldENoYXQiLCJkZWJ1Z0xldmVsIiwiY29uc29sZSIsImxvZyIsImdyZWVuIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJwYXJzZSIsImVycm9yIiwidGVzdCIsInNldEhlYWRlciIsImtleSIsInZhbCIsInRvTG93ZXJDYXNlIiwiYXBwbHkiLCJhcmd1bWVudHMiLCJfc3RhdGljRmlsZXNNaWRkbGV3YXJlIiwiV2ViQXBwSW50ZXJuYWxzIiwic3RhdGljRmlsZXNNaWRkbGV3YXJlIiwic3RhdGljRmlsZXMiLCJvbGRIdHRwU2VydmVyTGlzdGVuZXJzIiwiaHR0cFNlcnZlciIsImxpc3RlbmVycyIsInNsaWNlIiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwiYWRkTGlzdGVuZXIiLCJvbGRMaXN0ZW5lciIsInNldHRpbmdzIiwiZ2V0IiwicmVtb3RlQWRkcmVzcyIsImNvbm5lY3Rpb24iLCJzb2NrZXQiLCJsb2NhbGhvc3RSZWdleHAiLCJsb2NhbGhvc3RUZXN0IiwieCIsImlzTG9jYWwiLCJhbGwiLCJzcGxpdCIsImlzU3NsIiwicGFpciIsImhvc3QiLCJhYnNvbHV0ZVVybCIsImhvc3RuYW1lIiwicmVwbGFjZSIsIndyaXRlSGVhZCIsImVuZCIsInN0YXJ0dXAiLCJvbmxvYWQiLCJ2YWx1ZSIsImRlZmF1bHRPcHRpb25zIiwic2VjdXJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUF3RCxJQUFJQyxHQUFKO0FBQVFMLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxLQUFSLENBQWIsRUFBNEI7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNDLFFBQUlELENBQUo7QUFBTTs7QUFBbEIsQ0FBNUIsRUFBZ0QsQ0FBaEQ7QUFBbUQsSUFBSUUsR0FBSjtBQUFRTixPQUFPQyxLQUFQLENBQWFDLFFBQVEsS0FBUixDQUFiLEVBQTRCO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDRSxRQUFJRixDQUFKO0FBQU07O0FBQWxCLENBQTVCLEVBQWdELENBQWhEO0FBTWpJO0FBQ0E7QUFDQUUsSUFBSUMsa0JBQUosR0FBeUIsTUFBekI7QUFFQUMsT0FBT0Msa0JBQVAsQ0FBMEJDLEdBQTFCLENBQThCQyxPQUFPQyxlQUFQLENBQXVCLFVBQVNDLEdBQVQsRUFBY0MsR0FBZCxFQUFtQkMsSUFBbkIsRUFBeUI7QUFDN0UsS0FBSUYsSUFBSUcsS0FBUixFQUFlO0FBQ2QsU0FBT0QsTUFBUDtBQUNBOztBQUNELEtBQUlGLElBQUlJLE9BQUosQ0FBWSxtQkFBWixNQUFxQ0MsU0FBckMsSUFBa0RDLE1BQU1OLElBQUlJLE9BQUosQ0FBWSxnQkFBWixDQUFOLENBQXRELEVBQTRGO0FBQzNGLFNBQU9GLE1BQVA7QUFDQTs7QUFDRCxLQUFJRixJQUFJSSxPQUFKLENBQVksY0FBWixNQUFnQyxFQUFoQyxJQUFzQ0osSUFBSUksT0FBSixDQUFZLGNBQVosTUFBZ0NDLFNBQTFFLEVBQXFGO0FBQ3BGLFNBQU9ILE1BQVA7QUFDQTs7QUFDRCxLQUFJRixJQUFJUixHQUFKLENBQVFlLE9BQVIsQ0FBaUIsR0FBR0MsMEJBQTBCQyxvQkFBc0IsT0FBcEUsTUFBZ0YsQ0FBcEYsRUFBdUY7QUFDdEYsU0FBT1AsTUFBUDtBQUNBOztBQUVELEtBQUlRLE1BQU0sRUFBVjtBQUNBVixLQUFJVyxXQUFKLENBQWdCLE1BQWhCO0FBQ0FYLEtBQUlZLEVBQUosQ0FBTyxNQUFQLEVBQWUsVUFBU0MsS0FBVCxFQUFnQjtBQUM5QixTQUFPSCxPQUFPRyxLQUFkO0FBQ0EsRUFGRDtBQUlBYixLQUFJWSxFQUFKLENBQU8sS0FBUCxFQUFjLFlBQVc7QUFDeEIsTUFBSUUsY0FBY0EsV0FBV0MsVUFBWCxLQUEwQixPQUE1QyxFQUFxRDtBQUNwREMsV0FBUUMsR0FBUixDQUFZLFlBQVlDLEtBQXhCLEVBQStCbEIsSUFBSW1CLE1BQW5DLEVBQTJDbkIsSUFBSVIsR0FBL0MsRUFBb0QsY0FBcEQsRUFBb0VRLElBQUlJLE9BQXhFLEVBQWlGLFdBQWpGLEVBQThGTSxHQUE5RjtBQUNBOztBQUVELE1BQUk7QUFDSFYsT0FBSW9CLElBQUosR0FBV0MsS0FBS0MsS0FBTCxDQUFXWixHQUFYLENBQVg7QUFDQSxHQUZELENBRUUsT0FBT2EsS0FBUCxFQUFjO0FBQ2Z2QixPQUFJb0IsSUFBSixHQUFXVixHQUFYO0FBQ0E7O0FBQ0RWLE1BQUlHLEtBQUosR0FBWSxJQUFaO0FBRUEsU0FBT0QsTUFBUDtBQUNBLEVBYkQ7QUFjQSxDQWxDNkIsQ0FBOUI7QUFvQ0FQLE9BQU9DLGtCQUFQLENBQTBCQyxHQUExQixDQUE4QixVQUFTRyxHQUFULEVBQWNDLEdBQWQsRUFBbUJDLElBQW5CLEVBQXlCO0FBQ3RELEtBQUkscURBQXFEc0IsSUFBckQsQ0FBMER4QixJQUFJUixHQUE5RCxDQUFKLEVBQXdFO0FBQ3ZFUyxNQUFJd0IsU0FBSixDQUFjLDZCQUFkLEVBQTZDLEdBQTdDO0FBQ0E7O0FBRUQsT0FBTUEsWUFBWXhCLElBQUl3QixTQUF0Qjs7QUFDQXhCLEtBQUl3QixTQUFKLEdBQWdCLFVBQVNDLEdBQVQsRUFBY0MsR0FBZCxFQUFtQjtBQUNsQyxNQUFJRCxJQUFJRSxXQUFKLE9BQXNCLDZCQUF0QixJQUF1REQsUUFBUSxxQkFBbkUsRUFBMEY7QUFDekY7QUFDQTs7QUFDRCxTQUFPRixVQUFVSSxLQUFWLENBQWdCLElBQWhCLEVBQXNCQyxTQUF0QixDQUFQO0FBQ0EsRUFMRDs7QUFNQSxRQUFPNUIsTUFBUDtBQUNBLENBYkQ7QUFlQSxNQUFNNkIseUJBQXlCQyxnQkFBZ0JDLHFCQUEvQzs7QUFFQUQsZ0JBQWdCRCxzQkFBaEIsR0FBeUMsVUFBU0csV0FBVCxFQUFzQmxDLEdBQXRCLEVBQTJCQyxHQUEzQixFQUFnQ0MsSUFBaEMsRUFBc0M7QUFDOUVELEtBQUl3QixTQUFKLENBQWMsNkJBQWQsRUFBNkMsR0FBN0M7QUFDQSxRQUFPTSx1QkFBdUJHLFdBQXZCLEVBQW9DbEMsR0FBcEMsRUFBeUNDLEdBQXpDLEVBQThDQyxJQUE5QyxDQUFQO0FBQ0EsQ0FIRDs7QUFLQSxNQUFNaUMseUJBQXlCeEMsT0FBT3lDLFVBQVAsQ0FBa0JDLFNBQWxCLENBQTRCLFNBQTVCLEVBQXVDQyxLQUF2QyxDQUE2QyxDQUE3QyxDQUEvQjtBQUVBM0MsT0FBT3lDLFVBQVAsQ0FBa0JHLGtCQUFsQixDQUFxQyxTQUFyQztBQUVBNUMsT0FBT3lDLFVBQVAsQ0FBa0JJLFdBQWxCLENBQThCLFNBQTlCLEVBQXlDLFVBQVN4QyxHQUFULEVBQWNDLEdBQWQsRUFBbUI7QUFDM0QsT0FBTUMsT0FBTyxNQUFNO0FBQ2xCLE9BQUssTUFBTXVDLFdBQVgsSUFBMEJOLHNCQUExQixFQUFrRDtBQUNqRE0sZUFBWVosS0FBWixDQUFrQmxDLE9BQU95QyxVQUF6QixFQUFxQ04sU0FBckM7QUFDQTtBQUNELEVBSkQ7O0FBTUEsS0FBSWhCLFdBQVc0QixRQUFYLENBQW9CQyxHQUFwQixDQUF3QixXQUF4QixNQUF5QyxJQUE3QyxFQUFtRDtBQUNsRHpDO0FBQ0E7QUFDQTs7QUFFRCxPQUFNMEMsZ0JBQWdCNUMsSUFBSTZDLFVBQUosQ0FBZUQsYUFBZixJQUFnQzVDLElBQUk4QyxNQUFKLENBQVdGLGFBQWpFO0FBQ0EsT0FBTUcsa0JBQWtCLDRCQUF4Qjs7QUFDQSxPQUFNQyxnQkFBZ0IsVUFBU0MsQ0FBVCxFQUFZO0FBQ2pDLFNBQU9GLGdCQUFnQnZCLElBQWhCLENBQXFCeUIsQ0FBckIsQ0FBUDtBQUNBLEVBRkQ7O0FBSUEsT0FBTUMsVUFBVUgsZ0JBQWdCdkIsSUFBaEIsQ0FBcUJvQixhQUFyQixNQUF3QyxDQUFDNUMsSUFBSUksT0FBSixDQUFZLGlCQUFaLENBQUQsSUFBbUNsQixFQUFFaUUsR0FBRixDQUFNbkQsSUFBSUksT0FBSixDQUFZLGlCQUFaLEVBQStCZ0QsS0FBL0IsQ0FBcUMsR0FBckMsQ0FBTixFQUFpREosYUFBakQsQ0FBM0UsQ0FBaEI7O0FBQ0EsT0FBTUssUUFBUXJELElBQUk2QyxVQUFKLENBQWVTLElBQWYsSUFBd0J0RCxJQUFJSSxPQUFKLENBQVksbUJBQVosS0FBb0NKLElBQUlJLE9BQUosQ0FBWSxtQkFBWixFQUFpQ0csT0FBakMsQ0FBeUMsT0FBekMsTUFBc0QsQ0FBQyxDQUFqSTs7QUFFQSxLQUFJTyxjQUFjQSxXQUFXQyxVQUFYLEtBQTBCLE9BQTVDLEVBQXFEO0FBQ3BEQyxVQUFRQyxHQUFSLENBQVksU0FBWixFQUF1QmpCLElBQUlSLEdBQTNCO0FBQ0F3QixVQUFRQyxHQUFSLENBQVksZUFBWixFQUE2QjJCLGFBQTdCO0FBQ0E1QixVQUFRQyxHQUFSLENBQVksU0FBWixFQUF1QmlDLE9BQXZCO0FBQ0FsQyxVQUFRQyxHQUFSLENBQVksT0FBWixFQUFxQm9DLEtBQXJCO0FBQ0FyQyxVQUFRQyxHQUFSLENBQVksYUFBWixFQUEyQmpCLElBQUlJLE9BQS9CO0FBQ0E7O0FBRUQsS0FBSSxDQUFDOEMsT0FBRCxJQUFZLENBQUNHLEtBQWpCLEVBQXdCO0FBQ3ZCLE1BQUlFLE9BQU92RCxJQUFJSSxPQUFKLENBQVksTUFBWixLQUF1QlosSUFBSThCLEtBQUosQ0FBVXhCLE9BQU8wRCxXQUFQLEVBQVYsRUFBZ0NDLFFBQWxFO0FBQ0FGLFNBQU9BLEtBQUtHLE9BQUwsQ0FBYSxPQUFiLEVBQXNCLEVBQXRCLENBQVA7QUFDQXpELE1BQUkwRCxTQUFKLENBQWMsR0FBZCxFQUFtQjtBQUNsQixlQUFhLFdBQVdKLElBQU0sR0FBR3ZELElBQUlSLEdBQUs7QUFEeEIsR0FBbkI7QUFHQVMsTUFBSTJELEdBQUo7QUFDQTtBQUNBOztBQUVELFFBQU8xRCxNQUFQO0FBQ0EsQ0F4Q0QsRTs7Ozs7Ozs7Ozs7QUN4RUFKLE9BQU8rRCxPQUFQLENBQWUsWUFBVztBQUN6Qi9DLFlBQVc0QixRQUFYLENBQW9Cb0IsTUFBcEIsQ0FBMkIsV0FBM0IsRUFBd0MsVUFBU3BDLEdBQVQsRUFBY3FDLEtBQWQsRUFBcUI7QUFDNURqRSxTQUFPMEQsV0FBUCxDQUFtQlEsY0FBbkIsQ0FBa0NDLE1BQWxDLEdBQTJDRixLQUEzQztBQUNBLEVBRkQ7QUFHQSxDQUpELEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfY29ycy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgV2ViQXBwSW50ZXJuYWxzICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuaW1wb3J0IHVybCBmcm9tICd1cmwnO1xuXG5pbXBvcnQgdGxzIGZyb20gJ3Rscyc7XG4vLyBGSVggRm9yIFRMUyBlcnJvciBzZWUgbW9yZSBoZXJlIGh0dHBzOi8vZ2l0aHViLmNvbS9Sb2NrZXRDaGF0L1JvY2tldC5DaGF0L2lzc3Vlcy85MzE2XG4vLyBUT0RPOiBSZW1vdmUgYWZ0ZXIgTm9kZUpTIGZpeCBpdCwgbW9yZSBpbmZvcm1hdGlvbiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzLzE2MTk2IGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzE2ODUzXG50bHMuREVGQVVMVF9FQ0RIX0NVUlZFID0gJ2F1dG8nO1xuXG5XZWJBcHAucmF3Q29ubmVjdEhhbmRsZXJzLnVzZShNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG5cdGlmIChyZXEuX2JvZHkpIHtcblx0XHRyZXR1cm4gbmV4dCgpO1xuXHR9XG5cdGlmIChyZXEuaGVhZGVyc1sndHJhbnNmZXItZW5jb2RpbmcnXSA9PT0gdW5kZWZpbmVkICYmIGlzTmFOKHJlcS5oZWFkZXJzWydjb250ZW50LWxlbmd0aCddKSkge1xuXHRcdHJldHVybiBuZXh0KCk7XG5cdH1cblx0aWYgKHJlcS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSAhPT0gJycgJiYgcmVxLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gbmV4dCgpO1xuXHR9XG5cdGlmIChyZXEudXJsLmluZGV4T2YoYCR7IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfS91ZnMvYCkgPT09IDApIHtcblx0XHRyZXR1cm4gbmV4dCgpO1xuXHR9XG5cblx0bGV0IGJ1ZiA9ICcnO1xuXHRyZXEuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcblx0cmVxLm9uKCdkYXRhJywgZnVuY3Rpb24oY2h1bmspIHtcblx0XHRyZXR1cm4gYnVmICs9IGNodW5rO1xuXHR9KTtcblxuXHRyZXEub24oJ2VuZCcsIGZ1bmN0aW9uKCkge1xuXHRcdGlmIChSb2NrZXRDaGF0ICYmIFJvY2tldENoYXQuZGVidWdMZXZlbCA9PT0gJ2RlYnVnJykge1xuXHRcdFx0Y29uc29sZS5sb2coJ1tyZXF1ZXN0XScuZ3JlZW4sIHJlcS5tZXRob2QsIHJlcS51cmwsICdcXG5oZWFkZXJzIC0+JywgcmVxLmhlYWRlcnMsICdcXG5ib2R5IC0+JywgYnVmKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0cmVxLmJvZHkgPSBKU09OLnBhcnNlKGJ1Zik7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHJlcS5ib2R5ID0gYnVmO1xuXHRcdH1cblx0XHRyZXEuX2JvZHkgPSB0cnVlO1xuXG5cdFx0cmV0dXJuIG5leHQoKTtcblx0fSk7XG59KSk7XG5cbldlYkFwcC5yYXdDb25uZWN0SGFuZGxlcnMudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG5cdGlmICgvXlxcLyhhcGl8X3RpbWVzeW5jfHNvY2tqc3x0YXAtaTE4bnxfX2NvcmRvdmEpKFxcL3wkKS8udGVzdChyZXEudXJsKSkge1xuXHRcdHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG5cdH1cblxuXHRjb25zdCBzZXRIZWFkZXIgPSByZXMuc2V0SGVhZGVyO1xuXHRyZXMuc2V0SGVhZGVyID0gZnVuY3Rpb24oa2V5LCB2YWwpIHtcblx0XHRpZiAoa2V5LnRvTG93ZXJDYXNlKCkgPT09ICdhY2Nlc3MtY29udHJvbC1hbGxvdy1vcmlnaW4nICYmIHZhbCA9PT0gJ2h0dHA6Ly9tZXRlb3IubG9jYWwnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiBzZXRIZWFkZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0fTtcblx0cmV0dXJuIG5leHQoKTtcbn0pO1xuXG5jb25zdCBfc3RhdGljRmlsZXNNaWRkbGV3YXJlID0gV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzTWlkZGxld2FyZTtcblxuV2ViQXBwSW50ZXJuYWxzLl9zdGF0aWNGaWxlc01pZGRsZXdhcmUgPSBmdW5jdGlvbihzdGF0aWNGaWxlcywgcmVxLCByZXMsIG5leHQpIHtcblx0cmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKTtcblx0cmV0dXJuIF9zdGF0aWNGaWxlc01pZGRsZXdhcmUoc3RhdGljRmlsZXMsIHJlcSwgcmVzLCBuZXh0KTtcbn07XG5cbmNvbnN0IG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMgPSBXZWJBcHAuaHR0cFNlcnZlci5saXN0ZW5lcnMoJ3JlcXVlc3QnKS5zbGljZSgwKTtcblxuV2ViQXBwLmh0dHBTZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZXF1ZXN0Jyk7XG5cbldlYkFwcC5odHRwU2VydmVyLmFkZExpc3RlbmVyKCdyZXF1ZXN0JywgZnVuY3Rpb24ocmVxLCByZXMpIHtcblx0Y29uc3QgbmV4dCA9ICgpID0+IHtcblx0XHRmb3IgKGNvbnN0IG9sZExpc3RlbmVyIG9mIG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMpIHtcblx0XHRcdG9sZExpc3RlbmVyLmFwcGx5KFdlYkFwcC5odHRwU2VydmVyLCBhcmd1bWVudHMpO1xuXHRcdH1cblx0fTtcblxuXHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0ZvcmNlX1NTTCcpICE9PSB0cnVlKSB7XG5cdFx0bmV4dCgpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHJlbW90ZUFkZHJlc3MgPSByZXEuY29ubmVjdGlvbi5yZW1vdGVBZGRyZXNzIHx8IHJlcS5zb2NrZXQucmVtb3RlQWRkcmVzcztcblx0Y29uc3QgbG9jYWxob3N0UmVnZXhwID0gL15cXHMqKDEyN1xcLjBcXC4wXFwuMXw6OjEpXFxzKiQvO1xuXHRjb25zdCBsb2NhbGhvc3RUZXN0ID0gZnVuY3Rpb24oeCkge1xuXHRcdHJldHVybiBsb2NhbGhvc3RSZWdleHAudGVzdCh4KTtcblx0fTtcblxuXHRjb25zdCBpc0xvY2FsID0gbG9jYWxob3N0UmVnZXhwLnRlc3QocmVtb3RlQWRkcmVzcykgJiYgKCFyZXEuaGVhZGVyc1sneC1mb3J3YXJkZWQtZm9yJ10gfHwgXy5hbGwocmVxLmhlYWRlcnNbJ3gtZm9yd2FyZGVkLWZvciddLnNwbGl0KCcsJyksIGxvY2FsaG9zdFRlc3QpKTtcblx0Y29uc3QgaXNTc2wgPSByZXEuY29ubmVjdGlvbi5wYWlyIHx8IChyZXEuaGVhZGVyc1sneC1mb3J3YXJkZWQtcHJvdG8nXSAmJiByZXEuaGVhZGVyc1sneC1mb3J3YXJkZWQtcHJvdG8nXS5pbmRleE9mKCdodHRwcycpICE9PSAtMSk7XG5cblx0aWYgKFJvY2tldENoYXQgJiYgUm9ja2V0Q2hhdC5kZWJ1Z0xldmVsID09PSAnZGVidWcnKSB7XG5cdFx0Y29uc29sZS5sb2coJ3JlcS51cmwnLCByZXEudXJsKTtcblx0XHRjb25zb2xlLmxvZygncmVtb3RlQWRkcmVzcycsIHJlbW90ZUFkZHJlc3MpO1xuXHRcdGNvbnNvbGUubG9nKCdpc0xvY2FsJywgaXNMb2NhbCk7XG5cdFx0Y29uc29sZS5sb2coJ2lzU3NsJywgaXNTc2wpO1xuXHRcdGNvbnNvbGUubG9nKCdyZXEuaGVhZGVycycsIHJlcS5oZWFkZXJzKTtcblx0fVxuXG5cdGlmICghaXNMb2NhbCAmJiAhaXNTc2wpIHtcblx0XHRsZXQgaG9zdCA9IHJlcS5oZWFkZXJzWydob3N0J10gfHwgdXJsLnBhcnNlKE1ldGVvci5hYnNvbHV0ZVVybCgpKS5ob3N0bmFtZTtcblx0XHRob3N0ID0gaG9zdC5yZXBsYWNlKC86XFxkKyQvLCAnJyk7XG5cdFx0cmVzLndyaXRlSGVhZCgzMDIsIHtcblx0XHRcdCdMb2NhdGlvbic6IGBodHRwczovLyR7IGhvc3QgfSR7IHJlcS51cmwgfWBcblx0XHR9KTtcblx0XHRyZXMuZW5kKCk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIG5leHQoKTtcbn0pO1xuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQuc2V0dGluZ3Mub25sb2FkKCdGb3JjZV9TU0wnLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0TWV0ZW9yLmFic29sdXRlVXJsLmRlZmF1bHRPcHRpb25zLnNlY3VyZSA9IHZhbHVlO1xuXHR9KTtcbn0pO1xuIl19
