(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var HTTP = Package.http.HTTP;
var HTTPInternals = Package.http.HTTPInternals;
var ECMAScript = Package.ecmascript.ECMAScript;
var changeCase = Package['konecty:change-case'].changeCase;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var OEmbed;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:oembed":{"server":{"server.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_oembed/server/server.js                                                                      //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
const module1 = module;

let _;

module1.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

const URL = Npm.require('url');

const querystring = Npm.require('querystring');

const request = HTTPInternals.NpmModules.request.module;

const iconv = Npm.require('iconv-lite');

const ipRangeCheck = Npm.require('ip-range-check');

const he = Npm.require('he');

const jschardet = Npm.require('jschardet');

const OEmbed = {}; //  Detect encoding
//  Priority:
//  Detected == HTTP Header > Detected == HTML meta > HTTP Header > HTML meta > Detected > Default (utf-8)
//  See also: https://www.w3.org/International/questions/qa-html-encoding-declarations.en#quickanswer

const getCharset = function (contentType, body) {
	let detectedCharset;
	let httpHeaderCharset;
	let htmlMetaCharset;
	let result;
	contentType = contentType || '';
	const binary = body.toString('binary');
	const detected = jschardet.detect(binary);

	if (detected.confidence > 0.8) {
		detectedCharset = detected.encoding.toLowerCase();
	}

	const m1 = contentType.match(/charset=([\w\-]+)/i);

	if (m1) {
		httpHeaderCharset = m1[1].toLowerCase();
	}

	const m2 = binary.match(/<meta\b[^>]*charset=["']?([\w\-]+)/i);

	if (m2) {
		htmlMetaCharset = m2[1].toLowerCase();
	}

	if (detectedCharset) {
		if (detectedCharset === httpHeaderCharset) {
			result = httpHeaderCharset;
		} else if (detectedCharset === htmlMetaCharset) {
			result = htmlMetaCharset;
		}
	}

	if (!result) {
		result = httpHeaderCharset || htmlMetaCharset || detectedCharset;
	}

	return result || 'utf-8';
};

const toUtf8 = function (contentType, body) {
	return iconv.decode(body, getCharset(contentType, body));
};

const getUrlContent = function (urlObj, redirectCount = 5, callback) {
	if (_.isString(urlObj)) {
		urlObj = URL.parse(urlObj);
	}

	const parsedUrl = _.pick(urlObj, ['host', 'hash', 'pathname', 'protocol', 'port', 'query', 'search', 'hostname']);

	const ignoredHosts = RocketChat.settings.get('API_EmbedIgnoredHosts').replace(/\s/g, '').split(',') || [];

	if (ignoredHosts.includes(parsedUrl.hostname) || ipRangeCheck(parsedUrl.hostname, ignoredHosts)) {
		return callback();
	}

	const safePorts = RocketChat.settings.get('API_EmbedSafePorts').replace(/\s/g, '').split(',') || [];

	if (parsedUrl.port && safePorts.length > 0 && !safePorts.includes(parsedUrl.port)) {
		return callback();
	}

	const data = RocketChat.callbacks.run('oembed:beforeGetUrlContent', {
		urlObj,
		parsedUrl
	});

	if (data.attachments != null) {
		return callback(null, data);
	}

	const url = URL.format(data.urlObj);
	const opts = {
		url,
		strictSSL: !RocketChat.settings.get('Allow_Invalid_SelfSigned_Certs'),
		gzip: true,
		maxRedirects: redirectCount,
		headers: {
			'User-Agent': RocketChat.settings.get('API_Embed_UserAgent')
		}
	};
	let headers = null;
	let statusCode = null;
	let error = null;
	const chunks = [];
	let chunksTotalLength = 0;
	const stream = request(opts);
	stream.on('response', function (response) {
		statusCode = response.statusCode;
		headers = response.headers;

		if (response.statusCode !== 200) {
			return stream.abort();
		}
	});
	stream.on('data', function (chunk) {
		chunks.push(chunk);
		chunksTotalLength += chunk.length;

		if (chunksTotalLength > 250000) {
			return stream.abort();
		}
	});
	stream.on('end', Meteor.bindEnvironment(function () {
		if (error != null) {
			return callback(null, {
				error,
				parsedUrl
			});
		}

		const buffer = Buffer.concat(chunks);
		return callback(null, {
			headers,
			body: toUtf8(headers['content-type'], buffer),
			parsedUrl,
			statusCode
		});
	}));
	return stream.on('error', function (err) {
		return error = err;
	});
};

OEmbed.getUrlMeta = function (url, withFragment) {
	const getUrlContentSync = Meteor.wrapAsync(getUrlContent);
	const urlObj = URL.parse(url);

	if (withFragment != null) {
		const queryStringObj = querystring.parse(urlObj.query);
		queryStringObj._escaped_fragment_ = '';
		urlObj.query = querystring.stringify(queryStringObj);
		let path = urlObj.pathname;

		if (urlObj.query != null) {
			path += `?${urlObj.query}`;
		}

		urlObj.path = path;
	}

	const content = getUrlContentSync(urlObj, 5);

	if (!content) {
		return;
	}

	if (content.attachments != null) {
		return content;
	}

	let metas = undefined;

	if (content && content.body) {
		metas = {};
		content.body.replace(/<title[^>]*>([^<]*)<\/title>/gmi, function (meta, title) {
			return metas.pageTitle != null ? metas.pageTitle : metas.pageTitle = he.unescape(title);
		});
		content.body.replace(/<meta[^>]*(?:name|property)=[']([^']*)['][^>]*\scontent=[']([^']*)['][^>]*>/gmi, function (meta, name, value) {
			let name1;
			return metas[name1 = changeCase.camelCase(name)] != null ? metas[name1] : metas[name1] = he.unescape(value);
		});
		content.body.replace(/<meta[^>]*(?:name|property)=["]([^"]*)["][^>]*\scontent=["]([^"]*)["][^>]*>/gmi, function (meta, name, value) {
			let name1;
			return metas[name1 = changeCase.camelCase(name)] != null ? metas[name1] : metas[name1] = he.unescape(value);
		});
		content.body.replace(/<meta[^>]*\scontent=[']([^']*)['][^>]*(?:name|property)=[']([^']*)['][^>]*>/gmi, function (meta, value, name) {
			let name1;
			return metas[name1 = changeCase.camelCase(name)] != null ? metas[name1] : metas[name1] = he.unescape(value);
		});
		content.body.replace(/<meta[^>]*\scontent=["]([^"]*)["][^>]*(?:name|property)=["]([^"]*)["][^>]*>/gmi, function (meta, value, name) {
			let name1;
			return metas[name1 = changeCase.camelCase(name)] != null ? metas[name1] : metas[name1] = he.unescape(value);
		});

		if (metas.fragment === '!' && withFragment == null) {
			return OEmbed.getUrlMeta(url, true);
		}
	}

	let headers = undefined;
	let data = undefined;

	if (content && content.headers) {
		headers = {};
		const headerObj = content.headers;
		Object.keys(headerObj).forEach(header => {
			headers[changeCase.camelCase(header)] = headerObj[header];
		});
	}

	if (content && content.statusCode !== 200) {
		return data;
	}

	data = RocketChat.callbacks.run('oembed:afterParseContent', {
		meta: metas,
		headers,
		parsedUrl: content.parsedUrl,
		content
	});
	return data;
};

OEmbed.getUrlMetaWithCache = function (url, withFragment) {
	const cache = RocketChat.models.OEmbedCache.findOneById(url);

	if (cache != null) {
		return cache.data;
	}

	const data = OEmbed.getUrlMeta(url, withFragment);

	if (data != null) {
		try {
			RocketChat.models.OEmbedCache.createWithIdAndData(url, data);
		} catch (_error) {
			console.error('OEmbed duplicated record', url);
		}

		return data;
	}
};

const getRelevantHeaders = function (headersObj) {
	const headers = {};
	Object.keys(headersObj).forEach(key => {
		const value = headersObj[key];
		const lowerCaseKey = key.toLowerCase();

		if ((lowerCaseKey === 'contenttype' || lowerCaseKey === 'contentlength') && value && value.trim() !== '') {
			headers[key] = value;
		}
	});

	if (Object.keys(headers).length > 0) {
		return headers;
	}
};

const getRelevantMetaTags = function (metaObj) {
	const tags = {};
	Object.keys(metaObj).forEach(key => {
		const value = metaObj[key];

		if (/^(og|fb|twitter|oembed|msapplication).+|description|title|pageTitle$/.test(key.toLowerCase()) && value && value.trim() !== '') {
			tags[key] = value;
		}
	});

	if (Object.keys(tags).length > 0) {
		return tags;
	}
};

OEmbed.rocketUrlParser = function (message) {
	if (Array.isArray(message.urls)) {
		let attachments = [];
		let changed = false;
		message.urls.forEach(function (item) {
			if (item.ignoreParse === true) {
				return;
			}

			if (item.url.startsWith('grain://')) {
				changed = true;
				item.meta = {
					sandstorm: {
						grain: item.sandstormViewInfo
					}
				};
				return;
			}

			if (!/^https?:\/\//i.test(item.url)) {
				return;
			}

			const data = OEmbed.getUrlMetaWithCache(item.url);

			if (data != null) {
				if (data.attachments) {
					return attachments = _.union(attachments, data.attachments);
				} else {
					if (data.meta != null) {
						item.meta = getRelevantMetaTags(data.meta);
					}

					if (data.headers != null) {
						item.headers = getRelevantHeaders(data.headers);
					}

					item.parsedUrl = data.parsedUrl;
					return changed = true;
				}
			}
		});

		if (attachments.length) {
			RocketChat.models.Messages.setMessageAttachments(message._id, attachments);
		}

		if (changed === true) {
			RocketChat.models.Messages.setUrlsById(message._id, message.urls);
		}
	}

	return message;
};

RocketChat.settings.get('API_Embed', function (key, value) {
	if (value) {
		return RocketChat.callbacks.add('afterSaveMessage', OEmbed.rocketUrlParser, RocketChat.callbacks.priority.LOW, 'API_Embed');
	} else {
		return RocketChat.callbacks.remove('afterSaveMessage', 'API_Embed');
	}
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"providers.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_oembed/server/providers.js                                                                   //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

const URL = Npm.require('url');

const QueryString = Npm.require('querystring');

class Providers {
	constructor() {
		this.providers = [];
	}

	static getConsumerUrl(provider, url) {
		const urlObj = URL.parse(provider.endPoint, true);
		urlObj.query['url'] = url;
		delete urlObj.search;
		return URL.format(urlObj);
	}

	registerProvider(provider) {
		return this.providers.push(provider);
	}

	getProviders() {
		return this.providers;
	}

	getProviderForUrl(url) {
		return _.find(this.providers, function (provider) {
			const candidate = _.find(provider.urls, function (re) {
				return re.test(url);
			});

			return candidate != null;
		});
	}

}

const providers = new Providers();
providers.registerProvider({
	urls: [new RegExp('https?://soundcloud.com/\\S+')],
	endPoint: 'https://soundcloud.com/oembed?format=json&maxheight=150'
});
providers.registerProvider({
	urls: [new RegExp('https?://vimeo.com/[^/]+'), new RegExp('https?://vimeo.com/channels/[^/]+/[^/]+'), new RegExp('https://vimeo.com/groups/[^/]+/videos/[^/]+')],
	endPoint: 'https://vimeo.com/api/oembed.json?maxheight=200'
});
providers.registerProvider({
	urls: [new RegExp('https?://www.youtube.com/\\S+'), new RegExp('https?://youtu.be/\\S+')],
	endPoint: 'https://www.youtube.com/oembed?maxheight=200'
});
providers.registerProvider({
	urls: [new RegExp('https?://www.rdio.com/\\S+'), new RegExp('https?://rd.io/\\S+')],
	endPoint: 'https://www.rdio.com/api/oembed/?format=json&maxheight=150'
});
providers.registerProvider({
	urls: [new RegExp('https?://www.slideshare.net/[^/]+/[^/]+')],
	endPoint: 'https://www.slideshare.net/api/oembed/2?format=json&maxheight=200'
});
providers.registerProvider({
	urls: [new RegExp('https?://www.dailymotion.com/video/\\S+')],
	endPoint: 'https://www.dailymotion.com/services/oembed?maxheight=200'
});
RocketChat.oembed = {};
RocketChat.oembed.providers = providers;
RocketChat.callbacks.add('oembed:beforeGetUrlContent', function (data) {
	if (data.parsedUrl != null) {
		const url = URL.format(data.parsedUrl);
		const provider = providers.getProviderForUrl(url);

		if (provider != null) {
			let consumerUrl = Providers.getConsumerUrl(provider, url);
			consumerUrl = URL.parse(consumerUrl, true);

			_.extend(data.parsedUrl, consumerUrl);

			data.urlObj.port = consumerUrl.port;
			data.urlObj.hostname = consumerUrl.hostname;
			data.urlObj.pathname = consumerUrl.pathname;
			data.urlObj.query = consumerUrl.query;
			delete data.urlObj.search;
			delete data.urlObj.host;
		}
	}

	return data;
}, RocketChat.callbacks.priority.MEDIUM, 'oembed-providers-before');
RocketChat.callbacks.add('oembed:afterParseContent', function (data) {
	if (data.parsedUrl && data.parsedUrl.query) {
		let queryString = data.parsedUrl.query;

		if (_.isString(data.parsedUrl.query)) {
			queryString = QueryString.parse(data.parsedUrl.query);
		}

		if (queryString.url != null) {
			const url = queryString.url;
			const provider = providers.getProviderForUrl(url);

			if (provider != null) {
				if (data.content && data.content.body) {
					try {
						const metas = JSON.parse(data.content.body);

						_.each(metas, function (value, key) {
							if (_.isString(value)) {
								return data.meta[changeCase.camelCase(`oembed_${key}`)] = value;
							}
						});

						data.meta['oembedUrl'] = url;
					} catch (error) {
						console.log(error);
					}
				}
			}
		}
	}

	return data;
}, RocketChat.callbacks.priority.MEDIUM, 'oembed-providers-after');
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"jumpToMessage.js":function(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_oembed/server/jumpToMessage.js                                                               //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

const URL = Npm.require('url');

const QueryString = Npm.require('querystring');

const recursiveRemove = (message, deep = 1) => {
	if (message) {
		if ('attachments' in message && deep < RocketChat.settings.get('Message_QuoteChainLimit')) {
			message.attachments.map(msg => recursiveRemove(msg, deep + 1));
		} else {
			delete message.attachments;
		}
	}

	return message;
};

RocketChat.callbacks.add('beforeSaveMessage', msg => {
	if (msg && msg.urls) {
		msg.urls.forEach(item => {
			if (item.url.indexOf(Meteor.absoluteUrl()) === 0) {
				const urlObj = URL.parse(item.url);

				if (urlObj.query) {
					const queryString = QueryString.parse(urlObj.query);

					if (_.isString(queryString.msg)) {
						// Jump-to query param
						const jumpToMessage = recursiveRemove(RocketChat.models.Messages.findOneById(queryString.msg));

						if (jumpToMessage) {
							msg.attachments = msg.attachments || [];
							msg.attachments.push({
								'text': jumpToMessage.msg,
								'translations': jumpToMessage.translations,
								'author_name': jumpToMessage.alias || jumpToMessage.u.username,
								'author_icon': getAvatarUrlFromUsername(jumpToMessage.u.username),
								'message_link': item.url,
								'attachments': jumpToMessage.attachments || [],
								'ts': jumpToMessage.ts
							});
							item.ignoreParse = true;
						}
					}
				}
			}
		});
	}

	return msg;
}, RocketChat.callbacks.priority.LOW, 'jumpToMessage');
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"models":{"OEmbedCache.js":function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/rocketchat_oembed/server/models/OEmbedCache.js                                                          //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
RocketChat.models.OEmbedCache = new class extends RocketChat.models._Base {
	constructor() {
		super('oembed_cache');
		this.tryEnsureIndex({
			'updatedAt': 1
		});
	} //FIND ONE


	findOneById(_id, options) {
		const query = {
			_id
		};
		return this.findOne(query, options);
	} //INSERT


	createWithIdAndData(_id, data) {
		const record = {
			_id,
			data,
			updatedAt: new Date()
		};
		record._id = this.insert(record);
		return record;
	} //REMOVE


	removeAfterDate(date) {
		const query = {
			updatedAt: {
				$lte: date
			}
		};
		return this.remove(query);
	}

}();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:oembed/server/server.js");
require("./node_modules/meteor/rocketchat:oembed/server/providers.js");
require("./node_modules/meteor/rocketchat:oembed/server/jumpToMessage.js");
require("./node_modules/meteor/rocketchat:oembed/server/models/OEmbedCache.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:oembed'] = {}, {
  OEmbed: OEmbed
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_oembed.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvZW1iZWQvc2VydmVyL3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvZW1iZWQvc2VydmVyL3Byb3ZpZGVycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpvZW1iZWQvc2VydmVyL2p1bXBUb01lc3NhZ2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6b2VtYmVkL3NlcnZlci9tb2RlbHMvT0VtYmVkQ2FjaGUuanMiXSwibmFtZXMiOlsibW9kdWxlMSIsIm1vZHVsZSIsIl8iLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsIlVSTCIsIk5wbSIsInF1ZXJ5c3RyaW5nIiwicmVxdWVzdCIsIkhUVFBJbnRlcm5hbHMiLCJOcG1Nb2R1bGVzIiwiaWNvbnYiLCJpcFJhbmdlQ2hlY2siLCJoZSIsImpzY2hhcmRldCIsIk9FbWJlZCIsImdldENoYXJzZXQiLCJjb250ZW50VHlwZSIsImJvZHkiLCJkZXRlY3RlZENoYXJzZXQiLCJodHRwSGVhZGVyQ2hhcnNldCIsImh0bWxNZXRhQ2hhcnNldCIsInJlc3VsdCIsImJpbmFyeSIsInRvU3RyaW5nIiwiZGV0ZWN0ZWQiLCJkZXRlY3QiLCJjb25maWRlbmNlIiwiZW5jb2RpbmciLCJ0b0xvd2VyQ2FzZSIsIm0xIiwibWF0Y2giLCJtMiIsInRvVXRmOCIsImRlY29kZSIsImdldFVybENvbnRlbnQiLCJ1cmxPYmoiLCJyZWRpcmVjdENvdW50IiwiY2FsbGJhY2siLCJpc1N0cmluZyIsInBhcnNlIiwicGFyc2VkVXJsIiwicGljayIsImlnbm9yZWRIb3N0cyIsIlJvY2tldENoYXQiLCJzZXR0aW5ncyIsImdldCIsInJlcGxhY2UiLCJzcGxpdCIsImluY2x1ZGVzIiwiaG9zdG5hbWUiLCJzYWZlUG9ydHMiLCJwb3J0IiwibGVuZ3RoIiwiZGF0YSIsImNhbGxiYWNrcyIsInJ1biIsImF0dGFjaG1lbnRzIiwidXJsIiwiZm9ybWF0Iiwib3B0cyIsInN0cmljdFNTTCIsImd6aXAiLCJtYXhSZWRpcmVjdHMiLCJoZWFkZXJzIiwic3RhdHVzQ29kZSIsImVycm9yIiwiY2h1bmtzIiwiY2h1bmtzVG90YWxMZW5ndGgiLCJzdHJlYW0iLCJvbiIsInJlc3BvbnNlIiwiYWJvcnQiLCJjaHVuayIsInB1c2giLCJNZXRlb3IiLCJiaW5kRW52aXJvbm1lbnQiLCJidWZmZXIiLCJCdWZmZXIiLCJjb25jYXQiLCJlcnIiLCJnZXRVcmxNZXRhIiwid2l0aEZyYWdtZW50IiwiZ2V0VXJsQ29udGVudFN5bmMiLCJ3cmFwQXN5bmMiLCJxdWVyeVN0cmluZ09iaiIsInF1ZXJ5IiwiX2VzY2FwZWRfZnJhZ21lbnRfIiwic3RyaW5naWZ5IiwicGF0aCIsInBhdGhuYW1lIiwiY29udGVudCIsIm1ldGFzIiwidW5kZWZpbmVkIiwibWV0YSIsInRpdGxlIiwicGFnZVRpdGxlIiwidW5lc2NhcGUiLCJuYW1lIiwidmFsdWUiLCJuYW1lMSIsImNoYW5nZUNhc2UiLCJjYW1lbENhc2UiLCJmcmFnbWVudCIsImhlYWRlck9iaiIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiaGVhZGVyIiwiZ2V0VXJsTWV0YVdpdGhDYWNoZSIsImNhY2hlIiwibW9kZWxzIiwiT0VtYmVkQ2FjaGUiLCJmaW5kT25lQnlJZCIsImNyZWF0ZVdpdGhJZEFuZERhdGEiLCJfZXJyb3IiLCJjb25zb2xlIiwiZ2V0UmVsZXZhbnRIZWFkZXJzIiwiaGVhZGVyc09iaiIsImtleSIsImxvd2VyQ2FzZUtleSIsInRyaW0iLCJnZXRSZWxldmFudE1ldGFUYWdzIiwibWV0YU9iaiIsInRhZ3MiLCJ0ZXN0Iiwicm9ja2V0VXJsUGFyc2VyIiwibWVzc2FnZSIsIkFycmF5IiwiaXNBcnJheSIsInVybHMiLCJjaGFuZ2VkIiwiaXRlbSIsImlnbm9yZVBhcnNlIiwic3RhcnRzV2l0aCIsInNhbmRzdG9ybSIsImdyYWluIiwic2FuZHN0b3JtVmlld0luZm8iLCJ1bmlvbiIsIk1lc3NhZ2VzIiwic2V0TWVzc2FnZUF0dGFjaG1lbnRzIiwiX2lkIiwic2V0VXJsc0J5SWQiLCJhZGQiLCJwcmlvcml0eSIsIkxPVyIsInJlbW92ZSIsIlF1ZXJ5U3RyaW5nIiwiUHJvdmlkZXJzIiwiY29uc3RydWN0b3IiLCJwcm92aWRlcnMiLCJnZXRDb25zdW1lclVybCIsInByb3ZpZGVyIiwiZW5kUG9pbnQiLCJzZWFyY2giLCJyZWdpc3RlclByb3ZpZGVyIiwiZ2V0UHJvdmlkZXJzIiwiZ2V0UHJvdmlkZXJGb3JVcmwiLCJmaW5kIiwiY2FuZGlkYXRlIiwicmUiLCJSZWdFeHAiLCJvZW1iZWQiLCJjb25zdW1lclVybCIsImV4dGVuZCIsImhvc3QiLCJNRURJVU0iLCJxdWVyeVN0cmluZyIsIkpTT04iLCJlYWNoIiwibG9nIiwicmVjdXJzaXZlUmVtb3ZlIiwiZGVlcCIsIm1hcCIsIm1zZyIsImluZGV4T2YiLCJhYnNvbHV0ZVVybCIsImp1bXBUb01lc3NhZ2UiLCJ0cmFuc2xhdGlvbnMiLCJhbGlhcyIsInUiLCJ1c2VybmFtZSIsImdldEF2YXRhclVybEZyb21Vc2VybmFtZSIsInRzIiwiX0Jhc2UiLCJ0cnlFbnN1cmVJbmRleCIsIm9wdGlvbnMiLCJmaW5kT25lIiwicmVjb3JkIiwidXBkYXRlZEF0IiwiRGF0ZSIsImluc2VydCIsInJlbW92ZUFmdGVyRGF0ZSIsImRhdGUiLCIkbHRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTUEsVUFBUUMsTUFBZDs7QUFBcUIsSUFBSUMsQ0FBSjs7QUFBTUYsUUFBUUcsS0FBUixDQUFjQyxRQUFRLFlBQVIsQ0FBZCxFQUFvQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0osTUFBRUksQ0FBRjtBQUFJOztBQUFoQixDQUFwQyxFQUFzRCxDQUF0RDs7QUFHM0IsTUFBTUMsTUFBTUMsSUFBSUosT0FBSixDQUFZLEtBQVosQ0FBWjs7QUFFQSxNQUFNSyxjQUFj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QUFNcEcsUUFBUTtBQUNidUQ7QUFEYSxHQUFkO0FBR0EsU0FBTyxLQUFLOEMsT0FBTCxDQUFhckcsS0FBYixFQUFvQm9HLE9BQXBCLENBQVA7QUFDQSxFQVp3RSxDQWN6RTs7O0FBQ0F4RSxxQkFBb0IyQixHQUFwQixFQUF5QnZGLElBQXpCLEVBQStCO0FBQzlCLFFBQU1zSSxTQUFTO0FBQ2QvQyxNQURjO0FBRWR2RixPQUZjO0FBR2R1SSxjQUFXLElBQUlDLElBQUo7QUFIRyxHQUFmO0FBS0FGLFNBQU8vQyxHQUFQLEdBQWEsS0FBS2tELE1BQUwsQ0FBWUgsTUFBWixDQUFiO0FBQ0EsU0FBT0EsTUFBUDtBQUNBLEVBdkJ3RSxDQXlCekU7OztBQUNBSSxpQkFBZ0JDLElBQWhCLEVBQXNCO0FBQ3JCLFFBQU0zRyxRQUFRO0FBQ2J1RyxjQUFXO0FBQ1ZLLFVBQU1EO0FBREk7QUFERSxHQUFkO0FBS0EsU0FBTyxLQUFLL0MsTUFBTCxDQUFZNUQsS0FBWixDQUFQO0FBQ0E7O0FBakN3RSxDQUExQyxFQUFoQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X29lbWJlZC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qZ2xvYmFscyBIVFRQSW50ZXJuYWxzLCBjaGFuZ2VDYXNlICovXG5pbXBvcnQgXyBmcm9tICd1bmRlcnNjb3JlJztcblxuY29uc3QgVVJMID0gTnBtLnJlcXVpcmUoJ3VybCcpO1xuXG5jb25zdCBxdWVyeXN0cmluZyA9IE5wbS5yZXF1aXJlKCdxdWVyeXN0cmluZycpO1xuXG5jb25zdCByZXF1ZXN0ID0gSFRUUEludGVybmFscy5OcG1Nb2R1bGVzLnJlcXVlc3QubW9kdWxlO1xuXG5jb25zdCBpY29udiA9IE5wbS5yZXF1aXJlKCdpY29udi1saXRlJyk7XG5cbmNvbnN0IGlwUmFuZ2VDaGVjayA9IE5wbS5yZXF1aXJlKCdpcC1yYW5nZS1jaGVjaycpO1xuXG5jb25zdCBoZSA9IE5wbS5yZXF1aXJlKCdoZScpO1xuXG5jb25zdCBqc2NoYXJkZXQgPSBOcG0ucmVxdWlyZSgnanNjaGFyZGV0Jyk7XG5cbmNvbnN0IE9FbWJlZCA9IHt9O1xuXG4vLyAgRGV0ZWN0IGVuY29kaW5nXG4vLyAgUHJpb3JpdHk6XG4vLyAgRGV0ZWN0ZWQgPT0gSFRUUCBIZWFkZXIgPiBEZXRlY3RlZCA9PSBIVE1MIG1ldGEgPiBIVFRQIEhlYWRlciA+IEhUTUwgbWV0YSA+IERldGVjdGVkID4gRGVmYXVsdCAodXRmLTgpXG4vLyAgU2VlIGFsc286IGh0dHBzOi8vd3d3LnczLm9yZy9JbnRlcm5hdGlvbmFsL3F1ZXN0aW9ucy9xYS1odG1sLWVuY29kaW5nLWRlY2xhcmF0aW9ucy5lbiNxdWlja2Fuc3dlclxuY29uc3QgZ2V0Q2hhcnNldCA9IGZ1bmN0aW9uKGNvbnRlbnRUeXBlLCBib2R5KSB7XG5cdGxldCBkZXRlY3RlZENoYXJzZXQ7XG5cdGxldCBodHRwSGVhZGVyQ2hhcnNldDtcblx0bGV0IGh0bWxNZXRhQ2hhcnNldDtcblx0bGV0IHJlc3VsdDtcblxuXHRjb250ZW50VHlwZSA9IGNvbnRlbnRUeXBlIHx8ICcnO1xuXG5cdGNvbnN0IGJpbmFyeSA9IGJvZHkudG9TdHJpbmcoJ2JpbmFyeScpO1xuXHRjb25zdCBkZXRlY3RlZCA9IGpzY2hhcmRldC5kZXRlY3QoYmluYXJ5KTtcblx0aWYgKGRldGVjdGVkLmNvbmZpZGVuY2UgPiAwLjgpIHtcblx0XHRkZXRlY3RlZENoYXJzZXQgPSBkZXRlY3RlZC5lbmNvZGluZy50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cdGNvbnN0IG0xID0gY29udGVudFR5cGUubWF0Y2goL2NoYXJzZXQ9KFtcXHdcXC1dKykvaSk7XG5cdGlmIChtMSkge1xuXHRcdGh0dHBIZWFkZXJDaGFyc2V0ID0gbTFbMV0udG9Mb3dlckNhc2UoKTtcblx0fVxuXHRjb25zdCBtMiA9IGJpbmFyeS5tYXRjaCgvPG1ldGFcXGJbXj5dKmNoYXJzZXQ9W1wiJ10/KFtcXHdcXC1dKykvaSk7XG5cdGlmIChtMikge1xuXHRcdGh0bWxNZXRhQ2hhcnNldCA9IG0yWzFdLnRvTG93ZXJDYXNlKCk7XG5cdH1cblx0aWYgKGRldGVjdGVkQ2hhcnNldCkge1xuXHRcdGlmIChkZXRlY3RlZENoYXJzZXQgPT09IGh0dHBIZWFkZXJDaGFyc2V0KSB7XG5cdFx0XHRyZXN1bHQgPSBodHRwSGVhZGVyQ2hhcnNldDtcblx0XHR9IGVsc2UgaWYgKGRldGVjdGVkQ2hhcnNldCA9PT0gaHRtbE1ldGFDaGFyc2V0KSB7XG5cdFx0XHRyZXN1bHQgPSBodG1sTWV0YUNoYXJzZXQ7XG5cdFx0fVxuXHR9XG5cdGlmICghcmVzdWx0KSB7XG5cdFx0cmVzdWx0ID0gaHR0cEhlYWRlckNoYXJzZXQgfHwgaHRtbE1ldGFDaGFyc2V0IHx8IGRldGVjdGVkQ2hhcnNldDtcblx0fVxuXHRyZXR1cm4gcmVzdWx0IHx8ICd1dGYtOCc7XG59O1xuXG5jb25zdCB0b1V0ZjggPSBmdW5jdGlvbihjb250ZW50VHlwZSwgYm9keSkge1xuXHRyZXR1cm4gaWNvbnYuZGVjb2RlKGJvZHksIGdldENoYXJzZXQoY29udGVudFR5cGUsIGJvZHkpKTtcbn07XG5cbmNvbnN0IGdldFVybENvbnRlbnQgPSBmdW5jdGlvbih1cmxPYmosIHJlZGlyZWN0Q291bnQgPSA1LCBjYWxsYmFjaykge1xuXG5cdGlmIChfLmlzU3RyaW5nKHVybE9iaikpIHtcblx0XHR1cmxPYmogPSBVUkwucGFyc2UodXJsT2JqKTtcblx0fVxuXG5cdGNvbnN0IHBhcnNlZFVybCA9IF8ucGljayh1cmxPYmosIFsnaG9zdCcsICdoYXNoJywgJ3BhdGhuYW1lJywgJ3Byb3RvY29sJywgJ3BvcnQnLCAncXVlcnknLCAnc2VhcmNoJywgJ2hvc3RuYW1lJ10pO1xuXHRjb25zdCBpZ25vcmVkSG9zdHMgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnQVBJX0VtYmVkSWdub3JlZEhvc3RzJykucmVwbGFjZSgvXFxzL2csICcnKS5zcGxpdCgnLCcpIHx8IFtdO1xuXHRpZiAoaWdub3JlZEhvc3RzLmluY2x1ZGVzKHBhcnNlZFVybC5ob3N0bmFtZSkgfHwgaXBSYW5nZUNoZWNrKHBhcnNlZFVybC5ob3N0bmFtZSwgaWdub3JlZEhvc3RzKSkge1xuXHRcdHJldHVybiBjYWxsYmFjaygpO1xuXHR9XG5cblx0Y29uc3Qgc2FmZVBvcnRzID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9FbWJlZFNhZmVQb3J0cycpLnJlcGxhY2UoL1xccy9nLCAnJykuc3BsaXQoJywnKSB8fCBbXTtcblx0aWYgKHBhcnNlZFVybC5wb3J0ICYmIHNhZmVQb3J0cy5sZW5ndGggPiAwICYmICghc2FmZVBvcnRzLmluY2x1ZGVzKHBhcnNlZFVybC5wb3J0KSkpIHtcblx0XHRyZXR1cm4gY2FsbGJhY2soKTtcblx0fVxuXG5cdGNvbnN0IGRhdGEgPSBSb2NrZXRDaGF0LmNhbGxiYWNrcy5ydW4oJ29lbWJlZDpiZWZvcmVHZXRVcmxDb250ZW50Jywge1xuXHRcdHVybE9iaixcblx0XHRwYXJzZWRVcmxcblx0fSk7XG5cdGlmIChkYXRhLmF0dGFjaG1lbnRzICE9IG51bGwpIHtcblx0XHRyZXR1cm4gY2FsbGJhY2sobnVsbCwgZGF0YSk7XG5cdH1cblx0Y29uc3QgdXJsID0gVVJMLmZvcm1hdChkYXRhLnVybE9iaik7XG5cdGNvbnN0IG9wdHMgPSB7XG5cdFx0dXJsLFxuXHRcdHN0cmljdFNTTDogIVJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBbGxvd19JbnZhbGlkX1NlbGZTaWduZWRfQ2VydHMnKSxcblx0XHRnemlwOiB0cnVlLFxuXHRcdG1heFJlZGlyZWN0czogcmVkaXJlY3RDb3VudCxcblx0XHRoZWFkZXJzOiB7XG5cdFx0XHQnVXNlci1BZ2VudCc6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdBUElfRW1iZWRfVXNlckFnZW50Jylcblx0XHR9XG5cdH07XG5cdGxldCBoZWFkZXJzID0gbnVsbDtcblx0bGV0IHN0YXR1c0NvZGUgPSBudWxsO1xuXHRsZXQgZXJyb3IgPSBudWxsO1xuXHRjb25zdCBjaHVua3MgPSBbXTtcblx0bGV0IGNodW5rc1RvdGFsTGVuZ3RoID0gMDtcblx0Y29uc3Qgc3RyZWFtID0gcmVxdWVzdChvcHRzKTtcblx0c3RyZWFtLm9uKCdyZXNwb25zZScsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0c3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1c0NvZGU7XG5cdFx0aGVhZGVycyA9IHJlc3BvbnNlLmhlYWRlcnM7XG5cdFx0aWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgIT09IDIwMCkge1xuXHRcdFx0cmV0dXJuIHN0cmVhbS5hYm9ydCgpO1xuXHRcdH1cblx0fSk7XG5cdHN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGNodW5rKSB7XG5cdFx0Y2h1bmtzLnB1c2goY2h1bmspO1xuXHRcdGNodW5rc1RvdGFsTGVuZ3RoICs9IGNodW5rLmxlbmd0aDtcblx0XHRpZiAoY2h1bmtzVG90YWxMZW5ndGggPiAyNTAwMDApIHtcblx0XHRcdHJldHVybiBzdHJlYW0uYWJvcnQoKTtcblx0XHR9XG5cdH0pO1xuXHRzdHJlYW0ub24oJ2VuZCcsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGVycm9yICE9IG51bGwpIHtcblx0XHRcdHJldHVybiBjYWxsYmFjayhudWxsLCB7XG5cdFx0XHRcdGVycm9yLFxuXHRcdFx0XHRwYXJzZWRVcmxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRjb25zdCBidWZmZXIgPSBCdWZmZXIuY29uY2F0KGNodW5rcyk7XG5cdFx0cmV0dXJuIGNhbGxiYWNrKG51bGwsIHtcblx0XHRcdGhlYWRlcnMsXG5cdFx0XHRib2R5OiB0b1V0ZjgoaGVhZGVyc1snY29udGVudC10eXBlJ10sIGJ1ZmZlciksXG5cdFx0XHRwYXJzZWRVcmwsXG5cdFx0XHRzdGF0dXNDb2RlXG5cdFx0fSk7XG5cdH0pKTtcblx0cmV0dXJuIHN0cmVhbS5vbignZXJyb3InLCBmdW5jdGlvbihlcnIpIHtcblx0XHRyZXR1cm4gZXJyb3IgPSBlcnI7XG5cdH0pO1xufTtcblxuT0VtYmVkLmdldFVybE1ldGEgPSBmdW5jdGlvbih1cmwsIHdpdGhGcmFnbWVudCkge1xuXHRjb25zdCBnZXRVcmxDb250ZW50U3luYyA9IE1ldGVvci53cmFwQXN5bmMoZ2V0VXJsQ29udGVudCk7XG5cdGNvbnN0IHVybE9iaiA9IFVSTC5wYXJzZSh1cmwpO1xuXHRpZiAod2l0aEZyYWdtZW50ICE9IG51bGwpIHtcblx0XHRjb25zdCBxdWVyeVN0cmluZ09iaiA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHVybE9iai5xdWVyeSk7XG5cdFx0cXVlcnlTdHJpbmdPYmouX2VzY2FwZWRfZnJhZ21lbnRfID0gJyc7XG5cdFx0dXJsT2JqLnF1ZXJ5ID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5U3RyaW5nT2JqKTtcblx0XHRsZXQgcGF0aCA9IHVybE9iai5wYXRobmFtZTtcblx0XHRpZiAodXJsT2JqLnF1ZXJ5ICE9IG51bGwpIHtcblx0XHRcdHBhdGggKz0gYD8keyB1cmxPYmoucXVlcnkgfWA7XG5cdFx0fVxuXHRcdHVybE9iai5wYXRoID0gcGF0aDtcblx0fVxuXHRjb25zdCBjb250ZW50ID0gZ2V0VXJsQ29udGVudFN5bmModXJsT2JqLCA1KTtcblx0aWYgKCFjb250ZW50KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGlmIChjb250ZW50LmF0dGFjaG1lbnRzICE9IG51bGwpIHtcblx0XHRyZXR1cm4gY29udGVudDtcblx0fVxuXHRsZXQgbWV0YXMgPSB1bmRlZmluZWQ7XG5cdGlmIChjb250ZW50ICYmIGNvbnRlbnQuYm9keSkge1xuXHRcdG1ldGFzID0ge307XG5cdFx0Y29udGVudC5ib2R5LnJlcGxhY2UoLzx0aXRsZVtePl0qPihbXjxdKik8XFwvdGl0bGU+L2dtaSwgZnVuY3Rpb24obWV0YSwgdGl0bGUpIHtcblx0XHRcdHJldHVybiBtZXRhcy5wYWdlVGl0bGUgIT0gbnVsbCA/IG1ldGFzLnBhZ2VUaXRsZSA6IG1ldGFzLnBhZ2VUaXRsZSA9IGhlLnVuZXNjYXBlKHRpdGxlKTtcblx0XHR9KTtcblx0XHRjb250ZW50LmJvZHkucmVwbGFjZSgvPG1ldGFbXj5dKig/Om5hbWV8cHJvcGVydHkpPVsnXShbXiddKilbJ11bXj5dKlxcc2NvbnRlbnQ9WyddKFteJ10qKVsnXVtePl0qPi9nbWksIGZ1bmN0aW9uKG1ldGEsIG5hbWUsIHZhbHVlKSB7XG5cdFx0XHRsZXQgbmFtZTE7XG5cdFx0XHRyZXR1cm4gbWV0YXNbbmFtZTEgPSBjaGFuZ2VDYXNlLmNhbWVsQ2FzZShuYW1lKV0gIT0gbnVsbCA/IG1ldGFzW25hbWUxXSA6IG1ldGFzW25hbWUxXSA9IGhlLnVuZXNjYXBlKHZhbHVlKTtcblx0XHR9KTtcblx0XHRjb250ZW50LmJvZHkucmVwbGFjZSgvPG1ldGFbXj5dKig/Om5hbWV8cHJvcGVydHkpPVtcIl0oW15cIl0qKVtcIl1bXj5dKlxcc2NvbnRlbnQ9W1wiXShbXlwiXSopW1wiXVtePl0qPi9nbWksIGZ1bmN0aW9uKG1ldGEsIG5hbWUsIHZhbHVlKSB7XG5cdFx0XHRsZXQgbmFtZTE7XG5cdFx0XHRyZXR1cm4gbWV0YXNbbmFtZTEgPSBjaGFuZ2VDYXNlLmNhbWVsQ2FzZShuYW1lKV0gIT0gbnVsbCA/IG1ldGFzW25hbWUxXSA6IG1ldGFzW25hbWUxXSA9IGhlLnVuZXNjYXBlKHZhbHVlKTtcblx0XHR9KTtcblx0XHRjb250ZW50LmJvZHkucmVwbGFjZSgvPG1ldGFbXj5dKlxcc2NvbnRlbnQ9WyddKFteJ10qKVsnXVtePl0qKD86bmFtZXxwcm9wZXJ0eSk9WyddKFteJ10qKVsnXVtePl0qPi9nbWksIGZ1bmN0aW9uKG1ldGEsIHZhbHVlLCBuYW1lKSB7XG5cdFx0XHRsZXQgbmFtZTE7XG5cdFx0XHRyZXR1cm4gbWV0YXNbbmFtZTEgPSBjaGFuZ2VDYXNlLmNhbWVsQ2FzZShuYW1lKV0gIT0gbnVsbCA/IG1ldGFzW25hbWUxXSA6IG1ldGFzW25hbWUxXSA9IGhlLnVuZXNjYXBlKHZhbHVlKTtcblx0XHR9KTtcblx0XHRjb250ZW50LmJvZHkucmVwbGFjZSgvPG1ldGFbXj5dKlxcc2NvbnRlbnQ9W1wiXShbXlwiXSopW1wiXVtePl0qKD86bmFtZXxwcm9wZXJ0eSk9W1wiXShbXlwiXSopW1wiXVtePl0qPi9nbWksIGZ1bmN0aW9uKG1ldGEsIHZhbHVlLCBuYW1lKSB7XG5cdFx0XHRsZXQgbmFtZTE7XG5cdFx0XHRyZXR1cm4gbWV0YXNbbmFtZTEgPSBjaGFuZ2VDYXNlLmNhbWVsQ2FzZShuYW1lKV0gIT0gbnVsbCA/IG1ldGFzW25hbWUxXSA6IG1ldGFzW25hbWUxXSA9IGhlLnVuZXNjYXBlKHZhbHVlKTtcblx0XHR9KTtcblx0XHRpZiAobWV0YXMuZnJhZ21lbnQgPT09ICchJyAmJiAod2l0aEZyYWdtZW50ID09IG51bGwpKSB7XG5cdFx0XHRyZXR1cm4gT0VtYmVkLmdldFVybE1ldGEodXJsLCB0cnVlKTtcblx0XHR9XG5cdH1cblx0bGV0IGhlYWRlcnMgPSB1bmRlZmluZWQ7XG5cdGxldCBkYXRhID0gdW5kZWZpbmVkO1xuXG5cblx0aWYgKGNvbnRlbnQgJiYgY29udGVudC5oZWFkZXJzKSB7XG5cdFx0aGVhZGVycyA9IHt9O1xuXHRcdGNvbnN0IGhlYWRlck9iaiA9IGNvbnRlbnQuaGVhZGVycztcblx0XHRPYmplY3Qua2V5cyhoZWFkZXJPYmopLmZvckVhY2goKGhlYWRlcikgPT4ge1xuXHRcdFx0aGVhZGVyc1tjaGFuZ2VDYXNlLmNhbWVsQ2FzZShoZWFkZXIpXSA9IGhlYWRlck9ialtoZWFkZXJdO1xuXHRcdH0pO1xuXHR9XG5cdGlmIChjb250ZW50ICYmIGNvbnRlbnQuc3RhdHVzQ29kZSAhPT0gMjAwKSB7XG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblx0ZGF0YSA9IFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignb2VtYmVkOmFmdGVyUGFyc2VDb250ZW50Jywge1xuXHRcdG1ldGE6IG1ldGFzLFxuXHRcdGhlYWRlcnMsXG5cdFx0cGFyc2VkVXJsOiBjb250ZW50LnBhcnNlZFVybCxcblx0XHRjb250ZW50XG5cdH0pO1xuXHRyZXR1cm4gZGF0YTtcbn07XG5cbk9FbWJlZC5nZXRVcmxNZXRhV2l0aENhY2hlID0gZnVuY3Rpb24odXJsLCB3aXRoRnJhZ21lbnQpIHtcblx0Y29uc3QgY2FjaGUgPSBSb2NrZXRDaGF0Lm1vZGVscy5PRW1iZWRDYWNoZS5maW5kT25lQnlJZCh1cmwpO1xuXHRpZiAoY2FjaGUgIT0gbnVsbCkge1xuXHRcdHJldHVybiBjYWNoZS5kYXRhO1xuXHR9XG5cdGNvbnN0IGRhdGEgPSBPRW1iZWQuZ2V0VXJsTWV0YSh1cmwsIHdpdGhGcmFnbWVudCk7XG5cdGlmIChkYXRhICE9IG51bGwpIHtcblx0XHR0cnkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuT0VtYmVkQ2FjaGUuY3JlYXRlV2l0aElkQW5kRGF0YSh1cmwsIGRhdGEpO1xuXHRcdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdFx0Y29uc29sZS5lcnJvcignT0VtYmVkIGR1cGxpY2F0ZWQgcmVjb3JkJywgdXJsKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cbn07XG5cbmNvbnN0IGdldFJlbGV2YW50SGVhZGVycyA9IGZ1bmN0aW9uKGhlYWRlcnNPYmopIHtcblx0Y29uc3QgaGVhZGVycyA9IHt9O1xuXHRPYmplY3Qua2V5cyhoZWFkZXJzT2JqKS5mb3JFYWNoKChrZXkpID0+IHtcblx0XHRjb25zdCB2YWx1ZSA9IGhlYWRlcnNPYmpba2V5XTtcblx0XHRjb25zdCBsb3dlckNhc2VLZXkgPSBrZXkudG9Mb3dlckNhc2UoKTtcblx0XHRpZiAoKGxvd2VyQ2FzZUtleSA9PT0gJ2NvbnRlbnR0eXBlJyB8fCBsb3dlckNhc2VLZXkgPT09ICdjb250ZW50bGVuZ3RoJykgJiYgKHZhbHVlICYmIHZhbHVlLnRyaW0oKSAhPT0gJycpKSB7XG5cdFx0XHRoZWFkZXJzW2tleV0gPSB2YWx1ZTtcblx0XHR9XG5cdH0pO1xuXG5cdGlmIChPYmplY3Qua2V5cyhoZWFkZXJzKS5sZW5ndGggPiAwKSB7XG5cdFx0cmV0dXJuIGhlYWRlcnM7XG5cdH1cbn07XG5cbmNvbnN0IGdldFJlbGV2YW50TWV0YVRhZ3MgPSBmdW5jdGlvbihtZXRhT2JqKSB7XG5cdGNvbnN0IHRhZ3MgPSB7fTtcblx0T2JqZWN0LmtleXMobWV0YU9iaikuZm9yRWFjaCgoa2V5KSA9PiB7XG5cdFx0Y29uc3QgdmFsdWUgPSBtZXRhT2JqW2tleV07XG5cdFx0aWYgKC9eKG9nfGZifHR3aXR0ZXJ8b2VtYmVkfG1zYXBwbGljYXRpb24pLit8ZGVzY3JpcHRpb258dGl0bGV8cGFnZVRpdGxlJC8udGVzdChrZXkudG9Mb3dlckNhc2UoKSkgJiYgKHZhbHVlICYmIHZhbHVlLnRyaW0oKSAhPT0gJycpKSB7XG5cdFx0XHR0YWdzW2tleV0gPSB2YWx1ZTtcblx0XHR9XG5cdH0pO1xuXG5cdGlmIChPYmplY3Qua2V5cyh0YWdzKS5sZW5ndGggPiAwKSB7XG5cdFx0cmV0dXJuIHRhZ3M7XG5cdH1cbn07XG5cbk9FbWJlZC5yb2NrZXRVcmxQYXJzZXIgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UudXJscykpIHtcblx0XHRsZXQgYXR0YWNobWVudHMgPSBbXTtcblx0XHRsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXHRcdG1lc3NhZ2UudXJscy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdGlmIChpdGVtLmlnbm9yZVBhcnNlID09PSB0cnVlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChpdGVtLnVybC5zdGFydHNXaXRoKCdncmFpbjovLycpKSB7XG5cdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHRpdGVtLm1ldGEgPSB7XG5cdFx0XHRcdFx0c2FuZHN0b3JtOiB7XG5cdFx0XHRcdFx0XHRncmFpbjogaXRlbS5zYW5kc3Rvcm1WaWV3SW5mb1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCEvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KGl0ZW0udXJsKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkYXRhID0gT0VtYmVkLmdldFVybE1ldGFXaXRoQ2FjaGUoaXRlbS51cmwpO1xuXHRcdFx0aWYgKGRhdGEgIT0gbnVsbCkge1xuXHRcdFx0XHRpZiAoZGF0YS5hdHRhY2htZW50cykge1xuXHRcdFx0XHRcdHJldHVybiBhdHRhY2htZW50cyA9IF8udW5pb24oYXR0YWNobWVudHMsIGRhdGEuYXR0YWNobWVudHMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChkYXRhLm1ldGEgIT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0aXRlbS5tZXRhID0gZ2V0UmVsZXZhbnRNZXRhVGFncyhkYXRhLm1ldGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZGF0YS5oZWFkZXJzICE9IG51bGwpIHtcblx0XHRcdFx0XHRcdGl0ZW0uaGVhZGVycyA9IGdldFJlbGV2YW50SGVhZGVycyhkYXRhLmhlYWRlcnMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpdGVtLnBhcnNlZFVybCA9IGRhdGEucGFyc2VkVXJsO1xuXHRcdFx0XHRcdHJldHVybiBjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmIChhdHRhY2htZW50cy5sZW5ndGgpIHtcblx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnNldE1lc3NhZ2VBdHRhY2htZW50cyhtZXNzYWdlLl9pZCwgYXR0YWNobWVudHMpO1xuXHRcdH1cblx0XHRpZiAoY2hhbmdlZCA9PT0gdHJ1ZSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuc2V0VXJsc0J5SWQobWVzc2FnZS5faWQsIG1lc3NhZ2UudXJscyk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBtZXNzYWdlO1xufTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FQSV9FbWJlZCcsIGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0aWYgKHZhbHVlKSB7XG5cdFx0cmV0dXJuIFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJTYXZlTWVzc2FnZScsIE9FbWJlZC5yb2NrZXRVcmxQYXJzZXIsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ0FQSV9FbWJlZCcpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBSb2NrZXRDaGF0LmNhbGxiYWNrcy5yZW1vdmUoJ2FmdGVyU2F2ZU1lc3NhZ2UnLCAnQVBJX0VtYmVkJyk7XG5cdH1cbn0pO1xuIiwiLypnbG9iYWxzIGNoYW5nZUNhc2UgKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBVUkwgPSBOcG0ucmVxdWlyZSgndXJsJyk7XG5cbmNvbnN0IFF1ZXJ5U3RyaW5nID0gTnBtLnJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbmNsYXNzIFByb3ZpZGVycyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMucHJvdmlkZXJzID0gW107XG5cdH1cblxuXHRzdGF0aWMgZ2V0Q29uc3VtZXJVcmwocHJvdmlkZXIsIHVybCkge1xuXHRcdGNvbnN0IHVybE9iaiA9IFVSTC5wYXJzZShwcm92aWRlci5lbmRQb2ludCwgdHJ1ZSk7XG5cdFx0dXJsT2JqLnF1ZXJ5Wyd1cmwnXSA9IHVybDtcblx0XHRkZWxldGUgdXJsT2JqLnNlYXJjaDtcblx0XHRyZXR1cm4gVVJMLmZvcm1hdCh1cmxPYmopO1xuXHR9XG5cblx0cmVnaXN0ZXJQcm92aWRlcihwcm92aWRlcikge1xuXHRcdHJldHVybiB0aGlzLnByb3ZpZGVycy5wdXNoKHByb3ZpZGVyKTtcblx0fVxuXG5cdGdldFByb3ZpZGVycygpIHtcblx0XHRyZXR1cm4gdGhpcy5wcm92aWRlcnM7XG5cdH1cblxuXHRnZXRQcm92aWRlckZvclVybCh1cmwpIHtcblx0XHRyZXR1cm4gXy5maW5kKHRoaXMucHJvdmlkZXJzLCBmdW5jdGlvbihwcm92aWRlcikge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gXy5maW5kKHByb3ZpZGVyLnVybHMsIGZ1bmN0aW9uKHJlKSB7XG5cdFx0XHRcdHJldHVybiByZS50ZXN0KHVybCk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgIT0gbnVsbDtcblx0XHR9KTtcblx0fVxufVxuXG5jb25zdCBwcm92aWRlcnMgPSBuZXcgUHJvdmlkZXJzKCk7XG5cbnByb3ZpZGVycy5yZWdpc3RlclByb3ZpZGVyKHtcblx0dXJsczogW25ldyBSZWdFeHAoJ2h0dHBzPzovL3NvdW5kY2xvdWQuY29tL1xcXFxTKycpXSxcblx0ZW5kUG9pbnQ6ICdodHRwczovL3NvdW5kY2xvdWQuY29tL29lbWJlZD9mb3JtYXQ9anNvbiZtYXhoZWlnaHQ9MTUwJ1xufSk7XG5cbnByb3ZpZGVycy5yZWdpc3RlclByb3ZpZGVyKHtcblx0dXJsczogW25ldyBSZWdFeHAoJ2h0dHBzPzovL3ZpbWVvLmNvbS9bXi9dKycpLCBuZXcgUmVnRXhwKCdodHRwcz86Ly92aW1lby5jb20vY2hhbm5lbHMvW14vXSsvW14vXSsnKSwgbmV3IFJlZ0V4cCgnaHR0cHM6Ly92aW1lby5jb20vZ3JvdXBzL1teL10rL3ZpZGVvcy9bXi9dKycpXSxcblx0ZW5kUG9pbnQ6ICdodHRwczovL3ZpbWVvLmNvbS9hcGkvb2VtYmVkLmpzb24/bWF4aGVpZ2h0PTIwMCdcbn0pO1xuXG5wcm92aWRlcnMucmVnaXN0ZXJQcm92aWRlcih7XG5cdHVybHM6IFtuZXcgUmVnRXhwKCdodHRwcz86Ly93d3cueW91dHViZS5jb20vXFxcXFMrJyksIG5ldyBSZWdFeHAoJ2h0dHBzPzovL3lvdXR1LmJlL1xcXFxTKycpXSxcblx0ZW5kUG9pbnQ6ICdodHRwczovL3d3dy55b3V0dWJlLmNvbS9vZW1iZWQ/bWF4aGVpZ2h0PTIwMCdcbn0pO1xuXG5wcm92aWRlcnMucmVnaXN0ZXJQcm92aWRlcih7XG5cdHVybHM6IFtuZXcgUmVnRXhwKCdodHRwcz86Ly93d3cucmRpby5jb20vXFxcXFMrJyksIG5ldyBSZWdFeHAoJ2h0dHBzPzovL3JkLmlvL1xcXFxTKycpXSxcblx0ZW5kUG9pbnQ6ICdodHRwczovL3d3dy5yZGlvLmNvbS9hcGkvb2VtYmVkLz9mb3JtYXQ9anNvbiZtYXhoZWlnaHQ9MTUwJ1xufSk7XG5cbnByb3ZpZGVycy5yZWdpc3RlclByb3ZpZGVyKHtcblx0dXJsczogW25ldyBSZWdFeHAoJ2h0dHBzPzovL3d3dy5zbGlkZXNoYXJlLm5ldC9bXi9dKy9bXi9dKycpXSxcblx0ZW5kUG9pbnQ6ICdodHRwczovL3d3dy5zbGlkZXNoYXJlLm5ldC9hcGkvb2VtYmVkLzI/Zm9ybWF0PWpzb24mbWF4aGVpZ2h0PTIwMCdcbn0pO1xuXG5wcm92aWRlcnMucmVnaXN0ZXJQcm92aWRlcih7XG5cdHVybHM6IFtuZXcgUmVnRXhwKCdodHRwcz86Ly93d3cuZGFpbHltb3Rpb24uY29tL3ZpZGVvL1xcXFxTKycpXSxcblx0ZW5kUG9pbnQ6ICdodHRwczovL3d3dy5kYWlseW1vdGlvbi5jb20vc2VydmljZXMvb2VtYmVkP21heGhlaWdodD0yMDAnXG59KTtcblxuUm9ja2V0Q2hhdC5vZW1iZWQgPSB7fTtcblxuUm9ja2V0Q2hhdC5vZW1iZWQucHJvdmlkZXJzID0gcHJvdmlkZXJzO1xuXG5Sb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ29lbWJlZDpiZWZvcmVHZXRVcmxDb250ZW50JywgZnVuY3Rpb24oZGF0YSkge1xuXHRpZiAoZGF0YS5wYXJzZWRVcmwgIT0gbnVsbCkge1xuXHRcdGNvbnN0IHVybCA9IFVSTC5mb3JtYXQoZGF0YS5wYXJzZWRVcmwpO1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gcHJvdmlkZXJzLmdldFByb3ZpZGVyRm9yVXJsKHVybCk7XG5cdFx0aWYgKHByb3ZpZGVyICE9IG51bGwpIHtcblx0XHRcdGxldCBjb25zdW1lclVybCA9IFByb3ZpZGVycy5nZXRDb25zdW1lclVybChwcm92aWRlciwgdXJsKTtcblx0XHRcdGNvbnN1bWVyVXJsID0gVVJMLnBhcnNlKGNvbnN1bWVyVXJsLCB0cnVlKTtcblx0XHRcdF8uZXh0ZW5kKGRhdGEucGFyc2VkVXJsLCBjb25zdW1lclVybCk7XG5cdFx0XHRkYXRhLnVybE9iai5wb3J0ID0gY29uc3VtZXJVcmwucG9ydDtcblx0XHRcdGRhdGEudXJsT2JqLmhvc3RuYW1lID0gY29uc3VtZXJVcmwuaG9zdG5hbWU7XG5cdFx0XHRkYXRhLnVybE9iai5wYXRobmFtZSA9IGNvbnN1bWVyVXJsLnBhdGhuYW1lO1xuXHRcdFx0ZGF0YS51cmxPYmoucXVlcnkgPSBjb25zdW1lclVybC5xdWVyeTtcblx0XHRcdGRlbGV0ZSBkYXRhLnVybE9iai5zZWFyY2g7XG5cdFx0XHRkZWxldGUgZGF0YS51cmxPYmouaG9zdDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGRhdGE7XG59LCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5NRURJVU0sICdvZW1iZWQtcHJvdmlkZXJzLWJlZm9yZScpO1xuXG5Sb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ29lbWJlZDphZnRlclBhcnNlQ29udGVudCcsIGZ1bmN0aW9uKGRhdGEpIHtcblx0aWYgKGRhdGEucGFyc2VkVXJsICYmIGRhdGEucGFyc2VkVXJsLnF1ZXJ5KSB7XG5cdFx0bGV0IHF1ZXJ5U3RyaW5nID0gZGF0YS5wYXJzZWRVcmwucXVlcnk7XG5cdFx0aWYgKF8uaXNTdHJpbmcoZGF0YS5wYXJzZWRVcmwucXVlcnkpKSB7XG5cdFx0XHRxdWVyeVN0cmluZyA9IFF1ZXJ5U3RyaW5nLnBhcnNlKGRhdGEucGFyc2VkVXJsLnF1ZXJ5KTtcblx0XHR9XG5cdFx0aWYgKHF1ZXJ5U3RyaW5nLnVybCAhPSBudWxsKSB7XG5cdFx0XHRjb25zdCB1cmwgPSBxdWVyeVN0cmluZy51cmw7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IHByb3ZpZGVycy5nZXRQcm92aWRlckZvclVybCh1cmwpO1xuXHRcdFx0aWYgKHByb3ZpZGVyICE9IG51bGwpIHtcblx0XHRcdFx0aWYgKGRhdGEuY29udGVudCAmJiBkYXRhLmNvbnRlbnQuYm9keSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXRhcyA9IEpTT04ucGFyc2UoZGF0YS5jb250ZW50LmJvZHkpO1xuXHRcdFx0XHRcdFx0Xy5lYWNoKG1ldGFzLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG5cdFx0XHRcdFx0XHRcdGlmIChfLmlzU3RyaW5nKHZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBkYXRhLm1ldGFbY2hhbmdlQ2FzZS5jYW1lbENhc2UoYG9lbWJlZF8keyBrZXkgfWApXSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGRhdGEubWV0YVsnb2VtYmVkVXJsJ10gPSB1cmw7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGRhdGE7XG59LCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5NRURJVU0sICdvZW1iZWQtcHJvdmlkZXJzLWFmdGVyJyk7XG4iLCIvKiBnbG9iYWxzIGdldEF2YXRhclVybEZyb21Vc2VybmFtZSAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IFVSTCA9IE5wbS5yZXF1aXJlKCd1cmwnKTtcbmNvbnN0IFF1ZXJ5U3RyaW5nID0gTnBtLnJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5jb25zdCByZWN1cnNpdmVSZW1vdmUgPSAobWVzc2FnZSwgZGVlcCA9IDEpID0+IHtcblx0aWYgKG1lc3NhZ2UpIHtcblx0XHRpZiAoJ2F0dGFjaG1lbnRzJyBpbiBtZXNzYWdlICYmIGRlZXAgPCBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWVzc2FnZV9RdW90ZUNoYWluTGltaXQnKSkge1xuXHRcdFx0bWVzc2FnZS5hdHRhY2htZW50cy5tYXAoKG1zZykgPT4gcmVjdXJzaXZlUmVtb3ZlKG1zZywgZGVlcCArIDEpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGVsZXRlKG1lc3NhZ2UuYXR0YWNobWVudHMpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gbWVzc2FnZTtcbn07XG5cblJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYmVmb3JlU2F2ZU1lc3NhZ2UnLCAobXNnKSA9PiB7XG5cdGlmIChtc2cgJiYgbXNnLnVybHMpIHtcblx0XHRtc2cudXJscy5mb3JFYWNoKChpdGVtKSA9PiB7XG5cdFx0XHRpZiAoaXRlbS51cmwuaW5kZXhPZihNZXRlb3IuYWJzb2x1dGVVcmwoKSkgPT09IDApIHtcblx0XHRcdFx0Y29uc3QgdXJsT2JqID0gVVJMLnBhcnNlKGl0ZW0udXJsKTtcblx0XHRcdFx0aWYgKHVybE9iai5xdWVyeSkge1xuXHRcdFx0XHRcdGNvbnN0IHF1ZXJ5U3RyaW5nID0gUXVlcnlTdHJpbmcucGFyc2UodXJsT2JqLnF1ZXJ5KTtcblx0XHRcdFx0XHRpZiAoXy5pc1N0cmluZyhxdWVyeVN0cmluZy5tc2cpKSB7IC8vIEp1bXAtdG8gcXVlcnkgcGFyYW1cblx0XHRcdFx0XHRcdGNvbnN0IGp1bXBUb01lc3NhZ2UgPSByZWN1cnNpdmVSZW1vdmUoUm9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuZmluZE9uZUJ5SWQocXVlcnlTdHJpbmcubXNnKSk7XG5cdFx0XHRcdFx0XHRpZiAoanVtcFRvTWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRtc2cuYXR0YWNobWVudHMgPSBtc2cuYXR0YWNobWVudHMgfHwgW107XG5cdFx0XHRcdFx0XHRcdG1zZy5hdHRhY2htZW50cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHQndGV4dCcgOiBqdW1wVG9NZXNzYWdlLm1zZyxcblx0XHRcdFx0XHRcdFx0XHQndHJhbnNsYXRpb25zJzoganVtcFRvTWVzc2FnZS50cmFuc2xhdGlvbnMsXG5cdFx0XHRcdFx0XHRcdFx0J2F1dGhvcl9uYW1lJyA6IGp1bXBUb01lc3NhZ2UuYWxpYXMgfHwganVtcFRvTWVzc2FnZS51LnVzZXJuYW1lLFxuXHRcdFx0XHRcdFx0XHRcdCdhdXRob3JfaWNvbicgOiBnZXRBdmF0YXJVcmxGcm9tVXNlcm5hbWUoanVtcFRvTWVzc2FnZS51LnVzZXJuYW1lKSxcblx0XHRcdFx0XHRcdFx0XHQnbWVzc2FnZV9saW5rJyA6IGl0ZW0udXJsLFxuXHRcdFx0XHRcdFx0XHRcdCdhdHRhY2htZW50cycgOiBqdW1wVG9NZXNzYWdlLmF0dGFjaG1lbnRzIHx8IFtdLFxuXHRcdFx0XHRcdFx0XHRcdCd0cyc6IGp1bXBUb01lc3NhZ2UudHNcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGl0ZW0uaWdub3JlUGFyc2UgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJldHVybiBtc2c7XG59LCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1csICdqdW1wVG9NZXNzYWdlJyk7XG4iLCJcblJvY2tldENoYXQubW9kZWxzLk9FbWJlZENhY2hlID0gbmV3IGNsYXNzIGV4dGVuZHMgUm9ja2V0Q2hhdC5tb2RlbHMuX0Jhc2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignb2VtYmVkX2NhY2hlJyk7XG5cdFx0dGhpcy50cnlFbnN1cmVJbmRleCh7ICd1cGRhdGVkQXQnOiAxIH0pO1xuXHR9XG5cblx0Ly9GSU5EIE9ORVxuXHRmaW5kT25lQnlJZChfaWQsIG9wdGlvbnMpIHtcblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdF9pZFxuXHRcdH07XG5cdFx0cmV0dXJuIHRoaXMuZmluZE9uZShxdWVyeSwgb3B0aW9ucyk7XG5cdH1cblxuXHQvL0lOU0VSVFxuXHRjcmVhdGVXaXRoSWRBbmREYXRhKF9pZCwgZGF0YSkge1xuXHRcdGNvbnN0IHJlY29yZCA9IHtcblx0XHRcdF9pZCxcblx0XHRcdGRhdGEsXG5cdFx0XHR1cGRhdGVkQXQ6IG5ldyBEYXRlXG5cdFx0fTtcblx0XHRyZWNvcmQuX2lkID0gdGhpcy5pbnNlcnQocmVjb3JkKTtcblx0XHRyZXR1cm4gcmVjb3JkO1xuXHR9XG5cblx0Ly9SRU1PVkVcblx0cmVtb3ZlQWZ0ZXJEYXRlKGRhdGUpIHtcblx0XHRjb25zdCBxdWVyeSA9IHtcblx0XHRcdHVwZGF0ZWRBdDoge1xuXHRcdFx0XHQkbHRlOiBkYXRlXG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmUocXVlcnkpO1xuXHR9XG59O1xuXG5cbiJdfQ==
