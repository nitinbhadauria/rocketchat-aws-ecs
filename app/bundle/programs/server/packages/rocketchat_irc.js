(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var data, source, roomName, Irc;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:irc":{"server":{"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_irc/server/settings.js                                                                      //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Meteor.startup(function () {
	RocketChat.settings.addGroup('IRC', function () {
		// Is this thing on?
		this.add('IRC_Enabled', false, {
			type: 'boolean',
			i18nLabel: 'Enabled',
			i18nDescription: 'IRC_Enabled',
			alert: 'IRC Support is a work in progress. Use on a production system is not recommended at this time.'
		}); // The IRC host server to talk to

		this.add('IRC_Host', 'irc.freenode.net', {
			type: 'string',
			i18nLabel: 'Host',
			i18nDescription: 'IRC_Hostname'
		}); // The port to connect on the remote server

		this.add('IRC_Port', 6667, {
			type: 'int',
			i18nLabel: 'Port',
			i18nDescription: 'IRC_Port'
		}); // Cache size of the messages we send the host IRC server

		this.add('IRC_Message_Cache_Size', 200, {
			type: 'int',
			i18nLabel: 'Message Cache Size',
			i18nDescription: 'IRC_Message_Cache_Size'
		}); // Expandable box for modifying regular expressions for IRC interaction

		this.section('Regular_Expressions', function () {
			this.add('IRC_RegEx_successLogin', 'Welcome to the freenode Internet Relay Chat Network', {
				type: 'string',
				i18nLabel: 'Login Successful',
				i18nDescription: 'IRC_Login_Success'
			});
			this.add('IRC_RegEx_failedLogin', 'You have not registered', {
				type: 'string',
				i18nLabel: 'Login Failed',
				i18nDescription: 'IRC_Login_Fail'
			});
			this.add('IRC_RegEx_receiveMessage', '^:(\S+)!~\S+ PRIVMSG (\S+) :(.+)$', {
				type: 'string',
				i18nLabel: 'Private Message',
				i18nDescription: 'IRC_Private_Message'
			});
			this.add('IRC_RegEx_receiveMemberList', '^:\S+ \d+ \S+ = #(\S+) :(.*)$', {
				type: 'string',
				i18nLabel: 'Channel User List Start',
				i18nDescription: 'IRC_Channel_Users'
			});
			this.add('IRC_RegEx_endMemberList', '^.+#(\S+) :End of \/NAMES list.$', {
				type: 'string',
				i18nLabel: 'Channel User List End',
				i18nDescription: 'IRC_Channel_Users_End'
			});
			this.add('IRC_RegEx_addMemberToRoom', '^:(\S+)!~\S+ JOIN #(\S+)$', {
				type: 'string',
				i18nLabel: 'Join Channel',
				i18nDescription: 'IRC_Channel_Join'
			});
			this.add('IRC_RegEx_removeMemberFromRoom', '^:(\S+)!~\S+ PART #(\S+)$', {
				type: 'string',
				i18nLabel: 'Leave Channel',
				i18nDescription: 'IRC_Channel_Leave'
			});
			this.add('IRC_RegEx_quitMember', '^:(\S+)!~\S+ QUIT .*$', {
				type: 'string',
				i18nLabel: 'Quit IRC Session',
				i18nDescription: 'IRC_Quit'
			});
		});
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/rocketchat_irc/server/server.js                                                                        //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let net;
module.watch(require("net"), {
	default(v) {
		net = v;
	}

}, 1);
let Lru;
module.watch(require("lru-cache"), {
	default(v) {
		Lru = v;
	}

}, 2);
///////
// Assign values
//Package availability
const IRC_AVAILABILITY = RocketChat.settings.get('IRC_Enabled'); // Cache prep

const MESSAGE_CACHE_SIZE = RocketChat.settings.get('IRC_Message_Cache_Size');
const ircReceiveMessageCache = Lru(MESSAGE_CACHE_SIZE); //eslint-disable-line

const ircSendMessageCache = Lru(MESSAGE_CACHE_SIZE); //eslint-disable-line
// IRC server

const IRC_PORT = RocketChat.settings.get('IRC_Port');
const IRC_HOST = RocketChat.settings.get('IRC_Host');
const ircClientMap = {}; //////
// Core functionality

const bind = function (f) {
	const g = Meteor.bindEnvironment((self, ...args) => f.apply(self, args));
	return function (...args) {
		g(this, ...args);
	};
};

const async = (f, ...args) => Meteor.wrapAsync(f)(...args);

class IrcClient {
	constructor(loginReq) {
		this.loginReq = loginReq;
		this.user = this.loginReq.user;
		ircClientMap[this.user._id] = this;
		this.ircPort = IRC_PORT;
		this.ircHost = IRC_HOST;
		this.msgBuf = [];
		this.isConnected = false;
		this.isDistroyed = false;
		this.socket = new net.Socket();
		this.socket.setNoDelay;
		this.socket.setEncoding('utf-8');
		this.socket.setKeepAlive(true);
		this.connect = this.connect.bind(this);
		this.onConnect = this.onConnect.bind(this);
		this.onConnect = bind(this.onConnect);
		this.onClose = bind(this.onClose);
		this.onTimeout = bind(this.onTimeout);
		this.onError = bind(this.onError);
		this.onReceiveRawMessage = this.onReceiveRawMessage.bind(this);
		this.onReceiveRawMessage = bind(this.onReceiveRawMessage);
		this.socket.on('data', this.onReceiveRawMessage);
		this.socket.on('close', this.onClose);
		this.socket.on('timeout', this.onTimeout);
		this.socket.on('error', this.onError);
		this.isJoiningRoom = false;
		this.receiveMemberListBuf = {};
		this.pendingJoinRoomBuf = [];
		this.successLoginMessageRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_successLogin'));
		this.failedLoginMessageRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_failedLogin'));
		this.receiveMessageRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_receiveMessage'));
		this.receiveMemberListRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_receiveMemberList'));
		this.endMemberListRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_endMemberList'));
		this.addMemberToRoomRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_addMemberToRoom'));
		this.removeMemberFromRoomRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_removeMemberFromRoom'));
		this.quitMemberRegex = new RegExp(RocketChat.settings.get('IRC_RegEx_quitMember'));
	}

	connect(loginCb) {
		this.loginCb = loginCb;
		this.socket.connect(this.ircPort, this.ircHost, this.onConnect);
		this.initRoomList();
	}

	disconnect() {
		this.isDistroyed = true;
		this.socket.destroy();
	}

	onConnect() {
		console.log('[irc] onConnect -> '.yellow, this.user.username, 'connect success.');
		this.socket.write(`NICK ${this.user.username}\r\n`);
		this.socket.write(`USER ${this.user.username} 0 * :${this.user.name}\r\n`); // message order could not make sure here

		this.isConnected = true;
		const messageBuf = this.msgBuf;
		messageBuf.forEach(msg => this.socket.write(msg));
	}

	onClose() {
		console.log('[irc] onClose -> '.yellow, this.user.username, 'connection close.');
		this.isConnected = false;

		if (this.isDistroyed) {
			delete ircClientMap[this.user._id];
		} else {
			this.connect();
		}
	}

	onTimeout() {
		console.log('[irc] onTimeout -> '.yellow, this.user.username, 'connection timeout.', arguments);
	}

	onError() {
		console.log('[irc] onError -> '.yellow, this.user.username, 'connection error.', arguments);
	}

	onReceiveRawMessage(data) {
		data = data.toString().split('\n');
		data.forEach(line => {
			line = line.trim();
			console.log(`[${this.ircHost}:${this.ircPort}]:`, line); // Send heartbeat package to irc server

			if (line.indexOf('PING') === 0) {
				this.socket.write(line.replace('PING :', 'PONG '));
				return;
			}

			let matchResult = this.receiveMessageRegex.exec(line);

			if (matchResult) {
				this.onReceiveMessage(matchResult[1], matchResult[2], matchResult[3]);
				return;
			}

			matchResult = this.receiveMemberListRegex.exec(line);

			if (matchResult) {
				this.onReceiveMemberList(matchResult[1], matchResult[2].split(' '));
				return;
			}

			matchResult = this.endMemberListRegex.exec(line);

			if (matchResult) {
				this.onEndMemberList(matchResult[1]);
				return;
			}

			matchResult = this.addMemberToRoomRegex.exec(line);

			if (matchResult) {
				this.onAddMemberToRoom(matchResult[1], matchResult[2]);
				return;
			}

			matchResult = this.removeMemberFromRoomRegex.exec(line);

			if (matchResult) {
				this.onRemoveMemberFromRoom(matchResult[1], matchResult[2]);
				return;
			}

			matchResult = this.quitMemberRegex.exec(line);

			if (matchResult) {
				this.onQuitMember(matchResult[1]);
				return;
			}

			matchResult = this.successLoginMessageRegex.exec(line);

			if (matchResult) {
				this.onSuccessLoginMessage();
				return;
			}

			matchResult = this.failedLoginMessageRegex.exec(line);

			if (matchResult) {
				this.onFailedLoginMessage();
				return;
			}
		});
	}

	onSuccessLoginMessage() {
		console.log('[irc] onSuccessLoginMessage -> '.yellow);

		if (this.loginCb) {
			this.loginCb(null, this.loginReq);
		}
	}

	onFailedLoginMessage() {
		console.log('[irc] onFailedLoginMessage -> '.yellow);
		this.loginReq.allowed = false;
		this.disconnect();

		if (this.loginCb) {
			this.loginCb(null, this.loginReq);
		}
	}

	onReceiveMessage(source, target, content) {
		const now = new Date();
		const timestamp = now.getTime();
		let cacheKey = [source, target, content].join(',');
		console.log('[irc] ircSendMessageCache.get -> '.yellow, 'key:', cacheKey, 'value:', ircSendMessageCache.get(cacheKey), 'ts:', timestamp - 1000);

		if (ircSendMessageCache.get(cacheKey) > timestamp - 1000) {
			return;
		} else {
			ircSendMessageCache.set(cacheKey, timestamp);
		}

		console.log('[irc] onReceiveMessage -> '.yellow, 'source:', source, 'target:', target, 'content:', content);
		source = this.createUserWhenNotExist(source);
		let room;

		if (target[0] === '#') {
			room = RocketChat.models.Rooms.findOneByName(target.substring(1));
		} else {
			room = this.createDirectRoomWhenNotExist(source, this.user);
		}

		const message = {
			msg: content,
			ts: now
		};
		cacheKey = `${source.username}${timestamp}`;
		ircReceiveMessageCache.set(cacheKey, true);
		console.log('[irc] ircReceiveMessageCache.set -> '.yellow, 'key:', cacheKey);
		RocketChat.sendMessage(source, message, room);
	}

	onReceiveMemberList(roomName, members) {
		this.receiveMemberListBuf[roomName] = this.receiveMemberListBuf[roomName].concat(members);
	}

	onEndMemberList(roomName) {
		const newMembers = this.receiveMemberListBuf[roomName];
		console.log('[irc] onEndMemberList -> '.yellow, 'room:', roomName, 'members:', newMembers.join(','));
		const room = RocketChat.models.Rooms.findOneByNameAndType(roomName, 'c');

		if (!room) {
			return;
		}

		const oldMembers = room.usernames;

		const appendMembers = _.difference(newMembers, oldMembers);

		const removeMembers = _.difference(oldMembers, newMembers);

		appendMembers.forEach(member => this.createUserWhenNotExist(member));
		RocketChat.models.Rooms.removeUsernamesById(room._id, removeMembers);
		RocketChat.models.Rooms.addUsernamesById(room._id, appendMembers);
		this.isJoiningRoom = false;
		roomName = this.pendingJoinRoomBuf.shift();

		if (roomName) {
			this.joinRoom({
				t: 'c',
				name: roomName
			});
		}
	}

	sendRawMessage(msg) {
		console.log('[irc] sendRawMessage -> '.yellow, msg.slice(0, -2));

		if (this.isConnected) {
			this.socket.write(msg);
		} else {
			this.msgBuf.push(msg);
		}
	}

	sendMessage(room, message) {
		console.log('[irc] sendMessage -> '.yellow, 'userName:', message.u.username);
		let target = '';

		if (room.t === 'c') {
			target = `#${room.name}`;
		} else if (room.t === 'd') {
			const usernames = room.usernames;
			usernames.forEach(name => {
				if (message.u.username !== name) {
					target = name;
					return;
				}
			});
		}

		const cacheKey = [this.user.username, target, message.msg].join(',');
		console.log('[irc] ircSendMessageCache.set -> '.yellow, 'key:', cacheKey, 'ts:', message.ts.getTime());
		ircSendMessageCache.set(cacheKey, message.ts.getTime());
		const msg = `PRIVMSG ${target} :${message.msg}\r\n`;
		this.sendRawMessage(msg);
	}

	initRoomList() {
		const roomsCursor = RocketChat.models.Rooms.findByTypeContainingUsername('c', this.user.username, {
			fields: {
				name: 1,
				t: 1
			}
		});
		const rooms = roomsCursor.fetch();
		rooms.forEach(room => this.joinRoom(room));
	}

	joinRoom(room) {
		if (room.t !== 'c' || room.name === 'general') {
			return;
		}

		if (this.isJoiningRoom) {
			return this.pendingJoinRoomBuf.push(room.name);
		}

		console.log('[irc] joinRoom -> '.yellow, 'roomName:', room.name, 'pendingJoinRoomBuf:', this.pendingJoinRoomBuf.join(','));
		const msg = `JOIN #${room.name}\r\n`;
		this.receiveMemberListBuf[room.name] = [];
		this.sendRawMessage(msg);
		this.isJoiningRoom = true;
	}

	leaveRoom(room) {
		if (room.t !== 'c') {
			return;
		}

		const msg = `PART #${room.name}\r\n`;
		this.sendRawMessage(msg);
	}

	getMemberList(room) {
		if (room.t !== 'c') {
			return;
		}

		const msg = `NAMES #${room.name}\r\n`;
		this.receiveMemberListBuf[room.name] = [];
		this.sendRawMessage(msg);
	}

	onAddMemberToRoom(member, roomName) {
		if (this.user.username === member) {
			return;
		}

		console.log('[irc] onAddMemberToRoom -> '.yellow, 'roomName:', roomName, 'member:', member);
		this.createUserWhenNotExist(member);
		RocketChat.models.Rooms.addUsernameByName(roomName, member);
	}

	onRemoveMemberFromRoom(member, roomName) {
		console.log('[irc] onRemoveMemberFromRoom -> '.yellow, 'roomName:', roomName, 'member:', member);
		RocketChat.models.Rooms.removeUsernameByName(roomName, member);
	}

	onQuitMember(member) {
		console.log('[irc] onQuitMember ->'.yellow, 'username:', member);
		RocketChat.models.Rooms.removeUsernameFromAll(member);
		Meteor.users.update({
			name: member
		}, {
			$set: {
				status: 'offline'
			}
		});
	}

	createUserWhenNotExist(name) {
		const user = Meteor.users.findOne({
			name
		});

		if (user) {
			return user;
		}

		console.log('[irc] createNotExistUser ->'.yellow, 'userName:', name);
		Meteor.call('registerUser', {
			email: `${name}@rocketchat.org`,
			pass: 'rocketchat',
			name
		});
		Meteor.users.update({
			name
		}, {
			$set: {
				status: 'online',
				username: name
			}
		});
		return Meteor.users.findOne({
			name
		});
	}

	createDirectRoomWhenNotExist(source, target) {
		console.log('[irc] createDirectRoomWhenNotExist -> '.yellow, 'source:', source, 'target:', target);
		const rid = [source._id, target._id].sort().join('');
		const now = new Date();
		RocketChat.models.Rooms.upsert({
			_id: rid
		}, {
			$set: {
				usernames: [source.username, target.username]
			},
			$setOnInsert: {
				t: 'd',
				msgs: 0,
				ts: now
			}
		});
		RocketChat.models.Subscriptions.upsert({
			rid,
			$and: [{
				'u._id': target._id
			}]
		}, {
			$setOnInsert: {
				name: source.username,
				t: 'd',
				open: false,
				alert: false,
				unread: 0,
				userMentions: 0,
				groupMentions: 0,
				u: {
					_id: target._id,
					username: target.username
				}
			}
		});
		return {
			t: 'd',
			_id: rid
		};
	}

}

IrcClient.getByUid = function (uid) {
	return ircClientMap[uid];
};

IrcClient.create = function (login) {
	if (login.user == null) {
		return login;
	}

	if (!(login.user._id in ircClientMap)) {
		const ircClient = new IrcClient(login);
		return async(ircClient.connect);
	}

	return login;
};

function IrcLoginer(login) {
	console.log('[irc] validateLogin -> '.yellow, login);
	return IrcClient.create(login);
}

function IrcSender(message) {
	const name = message.u.username;
	const timestamp = message.ts.getTime();
	const cacheKey = `${name}${timestamp}`;

	if (ircReceiveMessageCache.get(cacheKey)) {
		return message;
	}

	const room = RocketChat.models.Rooms.findOneById(message.rid, {
		fields: {
			name: 1,
			usernames: 1,
			t: 1
		}
	});
	const ircClient = IrcClient.getByUid(message.u._id);
	ircClient.sendMessage(room, message);
	return message;
}

function IrcRoomJoiner(user, room) {
	const ircClient = IrcClient.getByUid(user._id);
	ircClient.joinRoom(room);
	return room;
}

function IrcRoomLeaver(user, room) {
	const ircClient = IrcClient.getByUid(user._id);
	ircClient.leaveRoom(room);
	return room;
}

function IrcLogoutCleanUper(user) {
	const ircClient = IrcClient.getByUid(user._id);
	ircClient.disconnect();
	return user;
} //////
// Make magic happen
// Only proceed if the package has been enabled


if (IRC_AVAILABILITY === true) {
	RocketChat.callbacks.add('beforeValidateLogin', IrcLoginer, RocketChat.callbacks.priority.LOW, 'irc-loginer');
	RocketChat.callbacks.add('beforeSaveMessage', IrcSender, RocketChat.callbacks.priority.LOW, 'irc-sender');
	RocketChat.callbacks.add('beforeJoinRoom', IrcRoomJoiner, RocketChat.callbacks.priority.LOW, 'irc-room-joiner');
	RocketChat.callbacks.add('beforeCreateChannel', IrcRoomJoiner, RocketChat.callbacks.priority.LOW, 'irc-room-joiner-create-channel');
	RocketChat.callbacks.add('beforeLeaveRoom', IrcRoomLeaver, RocketChat.callbacks.priority.LOW, 'irc-room-leaver');
	RocketChat.callbacks.add('afterLogoutCleanUp', IrcLogoutCleanUper, RocketChat.callbacks.priority.LOW, 'irc-clean-up');
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"lru-cache":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// ../../.meteor/local/isopacks/rocketchat_irc/npm/node_modules/lru-cache/package.json                             //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
exports.name = "lru-cache";
exports.version = "2.6.5";
exports.main = "lib/lru-cache.js";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"lru-cache.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/rocketchat_irc/node_modules/lru-cache/lib/lru-cache.js                                      //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
;(function () { // closure for web browsers

if (typeof module === 'object' && module.exports) {
  module.exports = LRUCache
} else {
  // just set the global for non-node platforms.
  this.LRUCache = LRUCache
}

function hOP (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function naiveLength () { return 1 }

function LRUCache (options) {
  if (!(this instanceof LRUCache))
    return new LRUCache(options)

  if (typeof options === 'number')
    options = { max: options }

  if (!options)
    options = {}

  this._max = options.max
  // Kind of weird to have a default max of Infinity, but oh well.
  if (!this._max || !(typeof this._max === "number") || this._max <= 0 )
    this._max = Infinity

  this._lengthCalculator = options.length || naiveLength
  if (typeof this._lengthCalculator !== "function")
    this._lengthCalculator = naiveLength

  this._allowStale = options.stale || false
  this._maxAge = options.maxAge || null
  this._dispose = options.dispose
  this.reset()
}

// resize the cache when the max changes.
Object.defineProperty(LRUCache.prototype, "max",
  { set : function (mL) {
      if (!mL || !(typeof mL === "number") || mL <= 0 ) mL = Infinity
      this._max = mL
      if (this._length > this._max) trim(this)
    }
  , get : function () { return this._max }
  , enumerable : true
  })

// resize the cache when the lengthCalculator changes.
Object.defineProperty(LRUCache.prototype, "lengthCalculator",
  { set : function (lC) {
      if (typeof lC !== "function") {
        this._lengthCalculator = naiveLength
        this._length = this._itemCount
        for (var key in this._cache) {
          this._cache[key].length = 1
        }
      } else {
        this._lengthCalculator = lC
        this._length = 0
        for (var key in this._cache) {
          this._cache[key].length = this._lengthCalculator(this._cache[key].value)
          this._length += this._cache[key].length
        }
      }

      if (this._length > this._max) trim(this)
    }
  , get : function () { return this._lengthCalculator }
  , enumerable : true
  })

Object.defineProperty(LRUCache.prototype, "length",
  { get : function () { return this._length }
  , enumerable : true
  })


Object.defineProperty(LRUCache.prototype, "itemCount",
  { get : function () { return this._itemCount }
  , enumerable : true
  })

LRUCache.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this
  var i = 0
  var itemCount = this._itemCount

  for (var k = this._mru - 1; k >= 0 && i < itemCount; k--) if (this._lruList[k]) {
    i++
    var hit = this._lruList[k]
    if (isStale(this, hit)) {
      del(this, hit)
      if (!this._allowStale) hit = undefined
    }
    if (hit) {
      fn.call(thisp, hit.value, hit.key, this)
    }
  }
}

LRUCache.prototype.keys = function () {
  var keys = new Array(this._itemCount)
  var i = 0
  for (var k = this._mru - 1; k >= 0 && i < this._itemCount; k--) if (this._lruList[k]) {
    var hit = this._lruList[k]
    keys[i++] = hit.key
  }
  return keys
}

LRUCache.prototype.values = function () {
  var values = new Array(this._itemCount)
  var i = 0
  for (var k = this._mru - 1; k >= 0 && i < this._itemCount; k--) if (this._lruList[k]) {
    var hit = this._lruList[k]
    values[i++] = hit.value
  }
  return values
}

LRUCache.prototype.reset = function () {
  if (this._dispose && this._cache) {
    for (var k in this._cache) {
      this._dispose(k, this._cache[k].value)
    }
  }

  this._cache = Object.create(null) // hash of items by key
  this._lruList = Object.create(null) // list of items in order of use recency
  this._mru = 0 // most recently used
  this._lru = 0 // least recently used
  this._length = 0 // number of items in the list
  this._itemCount = 0
}

// Provided for debugging/dev purposes only. No promises whatsoever that
// this API stays stable.
LRUCache.prototype.dump = function () {
  return this._cache
}

LRUCache.prototype.dumpLru = function () {
  return this._lruList
}

LRUCache.prototype.set = function (key, value, maxAge) {
  maxAge = maxAge || this._maxAge
  var now = maxAge ? Date.now() : 0

  if (hOP(this._cache, key)) {
    // dispose of the old one before overwriting
    if (this._dispose)
      this._dispose(key, this._cache[key].value)

    this._cache[key].now = now
    this._cache[key].maxAge = maxAge
    this._cache[key].value = value
    this.get(key)
    return true
  }

  var len = this._lengthCalculator(value)
  var hit = new Entry(key, value, this._mru++, len, now, maxAge)

  // oversized objects fall out of cache automatically.
  if (hit.length > this._max) {
    if (this._dispose) this._dispose(key, value)
    return false
  }

  this._length += hit.length
  this._lruList[hit.lu] = this._cache[key] = hit
  this._itemCount ++

  if (this._length > this._max)
    trim(this)

  return true
}

LRUCache.prototype.has = function (key) {
  if (!hOP(this._cache, key)) return false
  var hit = this._cache[key]
  if (isStale(this, hit)) {
    return false
  }
  return true
}

LRUCache.prototype.get = function (key) {
  return get(this, key, true)
}

LRUCache.prototype.peek = function (key) {
  return get(this, key, false)
}

LRUCache.prototype.pop = function () {
  var hit = this._lruList[this._lru]
  del(this, hit)
  return hit || null
}

LRUCache.prototype.del = function (key) {
  del(this, this._cache[key])
}

function get (self, key, doUse) {
  var hit = self._cache[key]
  if (hit) {
    if (isStale(self, hit)) {
      del(self, hit)
      if (!self._allowStale) hit = undefined
    } else {
      if (doUse) use(self, hit)
    }
    if (hit) hit = hit.value
  }
  return hit
}

function isStale(self, hit) {
  if (!hit || (!hit.maxAge && !self._maxAge)) return false
  var stale = false;
  var diff = Date.now() - hit.now
  if (hit.maxAge) {
    stale = diff > hit.maxAge
  } else {
    stale = self._maxAge && (diff > self._maxAge)
  }
  return stale;
}

function use (self, hit) {
  shiftLU(self, hit)
  hit.lu = self._mru ++
  self._lruList[hit.lu] = hit
}

function trim (self) {
  while (self._lru < self._mru && self._length > self._max)
    del(self, self._lruList[self._lru])
}

function shiftLU (self, hit) {
  delete self._lruList[ hit.lu ]
  while (self._lru < self._mru && !self._lruList[self._lru]) self._lru ++
}

function del (self, hit) {
  if (hit) {
    if (self._dispose) self._dispose(hit.key, hit.value)
    self._length -= hit.length
    self._itemCount --
    delete self._cache[ hit.key ]
    shiftLU(self, hit)
  }
}

// classy, since V8 prefers predictable objects.
function Entry (key, value, lu, length, now, maxAge) {
  this.key = key
  this.value = value
  this.lu = lu
  this.length = length
  this.now = now
  if (maxAge) this.maxAge = maxAge
}

})()

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:irc/server/settings.js");
require("./node_modules/meteor/rocketchat:irc/server/server.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:irc'] = {}, {
  Irc: Irc
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_irc.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDppcmMvc2VydmVyL3NldHRpbmdzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OmlyYy9zZXJ2ZXIvc2VydmVyLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJhZGRHcm91cCIsImFkZCIsInR5cGUiLCJpMThuTGFiZWwiLCJpMThuRGVzY3JpcHRpb24iLCJhbGVydCIsInNlY3Rpb24iLCJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJuZXQiLCJMcnUiLCJJUkNfQVZBSUxBQklMSVRZIiwiZ2V0IiwiTUVTU0FHRV9DQUNIRV9TSVpFIiwiaXJjUmVjZWl2ZU1lc3NhZ2VDYWNoZSIsImlyY1NlbmRNZXNzYWdlQ2FjaGUiLCJJUkNfUE9SVCIsIklSQ19IT1NUIiwiaXJjQ2xpZW50TWFwIiwiYmluZCIsImYiLCJnIiwiYmluZEVudmlyb25tZW50Iiwic2VsZiIsImFyZ3MiLCJhcHBseSIsImFzeW5jIiwid3JhcEFzeW5jIiwiSXJjQ2xpZW50IiwiY29uc3RydWN0b3IiLCJsb2dpblJlcSIsInVzZXIiLCJfaWQiLCJpcmNQb3J0IiwiaXJjSG9zdCIsIm1zZ0J1ZiIsImlzQ29ubmVjdGVkIiwiaXNEaXN0cm95ZWQiLCJzb2NrZXQiLCJTb2NrZXQiLCJzZXROb0RlbGF5Iiwic2V0RW5jb2RpbmciLCJzZXRLZWVwQWxpdmUiLCJjb25uZWN0Iiwib25Db25uZWN0Iiwib25DbG9zZSIsIm9uVGltZW91dCIsIm9uRXJyb3IiLCJvblJlY2VpdmVSYXdNZXNzYWdlIiwib24iLCJpc0pvaW5pbmdSb29tIiwicmVjZWl2ZU1lbWJlckxpc3RCdWYiLCJwZW5kaW5nSm9pblJvb21CdWYiLCJzdWNjZXNzTG9naW5NZXNzYWdlUmVnZXgiLCJSZWdFeHAiLCJmYWlsZWRMb2dpbk1lc3NhZ2VSZWdleCIsInJlY2VpdmVNZXNzYWdlUmVnZXgiLCJyZWNlaXZlTWVtYmVyTGlzdFJlZ2V4IiwiZW5kTWVtYmVyTGlzdFJlZ2V4IiwiYWRkTWVtYmVyVG9Sb29tUmVnZXgiLCJyZW1vdmVNZW1iZXJGcm9tUm9vbVJlZ2V4IiwicXVpdE1lbWJlclJlZ2V4IiwibG9naW5DYiIsImluaXRSb29tTGlzdCIsImRpc2Nvbm5lY3QiLCJkZXN0cm95IiwiY29uc29sZSIsImxvZyIsInllbGxvdyIsInVzZXJuYW1lIiwid3JpdGUiLCJuYW1lIiwibWVzc2FnZUJ1ZiIsImZvckVhY2giLCJtc2ciLCJhcmd1bWVudHMiLCJkYXRhIiwidG9TdHJpbmciLCJzcGxpdCIsImxpbmUiLCJ0cmltIiwiaW5kZXhPZiIsInJlcGxhY2UiLCJtYXRjaFJlc3VsdCIsImV4ZWMiLCJvblJlY2VpdmVNZXNzYWdlIiwib25SZWNlaXZlTWVtYmVyTGlzdCIsIm9uRW5kTWVtYmVyTGlzdCIsIm9uQWRkTWVtYmVyVG9Sb29tIiwib25SZW1vdmVNZW1iZXJGcm9tUm9vbSIsIm9uUXVpdE1lbWJlciIsIm9uU3VjY2Vzc0xvZ2luTWVzc2FnZSIsIm9uRmFpbGVkTG9naW5NZXNzYWdlIiwiYWxsb3dlZCIsInNvdXJjZSIsInRhcmdldCIsImNvbnRlbnQiLCJub3ciLCJEYXRlIiwidGltZXN0YW1wIiwiZ2V0VGltZSIsImNhY2hlS2V5Iiwiam9pbiIsInNldCIsImNyZWF0ZVVzZXJXaGVuTm90RXhpc3QiLCJyb29tIiwibW9kZWxzIiwiUm9vbXMiLCJmaW5kT25lQnlOYW1lIiwic3Vic3RyaW5nIiwiY3JlYXRlRGlyZWN0Um9vbVdoZW5Ob3RFeGlzdCIsIm1lc3NhZ2UiLCJ0cyIsInNlbmRNZXNzYWdlIiwicm9vbU5hbWUiLCJtZW1iZXJzIiwiY29uY2F0IiwibmV3TWVtYmVycyIsImZpbmRPbmVCeU5hbWVBbmRUeXBlIiwib2xkTWVtYmVycyIsInVzZXJuYW1lcyIsImFwcGVuZE1lbWJlcnMiLCJkaWZmZXJlbmNlIiwicmVtb3ZlTWVtYmVycyIsIm1lbWJlciIsInJlbW92ZVVzZXJuYW1lc0J5SWQiLCJhZGRVc2VybmFtZXNCeUlkIiwic2hpZnQiLCJqb2luUm9vbSIsInQiLCJzZW5kUmF3TWVzc2FnZSIsInNsaWNlIiwicHVzaCIsInUiLCJyb29tc0N1cnNvciIsImZpbmRCeVR5cGVDb250YWluaW5nVXNlcm5hbWUiLCJmaWVsZHMiLCJyb29tcyIsImZldGNoIiwibGVhdmVSb29tIiwiZ2V0TWVtYmVyTGlzdCIsImFkZFVzZXJuYW1lQnlOYW1lIiwicmVtb3ZlVXNlcm5hbWVCeU5hbWUiLCJyZW1vdmVVc2VybmFtZUZyb21BbGwiLCJ1c2VycyIsInVwZGF0ZSIsIiRzZXQiLCJzdGF0dXMiLCJmaW5kT25lIiwiY2FsbCIsImVtYWlsIiwicGFzcyIsInJpZCIsInNvcnQiLCJ1cHNlcnQiLCIkc2V0T25JbnNlcnQiLCJtc2dzIiwiU3Vic2NyaXB0aW9ucyIsIiRhbmQiLCJvcGVuIiwidW5yZWFkIiwidXNlck1lbnRpb25zIiwiZ3JvdXBNZW50aW9ucyIsImdldEJ5VWlkIiwidWlkIiwiY3JlYXRlIiwibG9naW4iLCJpcmNDbGllbnQiLCJJcmNMb2dpbmVyIiwiSXJjU2VuZGVyIiwiZmluZE9uZUJ5SWQiLCJJcmNSb29tSm9pbmVyIiwiSXJjUm9vbUxlYXZlciIsIklyY0xvZ291dENsZWFuVXBlciIsImNhbGxiYWNrcyIsInByaW9yaXR5IiwiTE9XIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE9BQU9DLE9BQVAsQ0FBZSxZQUFXO0FBQ3pCQyxZQUFXQyxRQUFYLENBQW9CQyxRQUFwQixDQUE2QixLQUE3QixFQUFvQyxZQUFXO0FBRTlDO0FBQ0EsT0FBS0MsR0FBTCxDQUFTLGFBQVQsRUFBd0IsS0FBeEIsRUFBK0I7QUFDOUJDLFNBQU0sU0FEd0I7QUFFOUJDLGNBQVcsU0FGbUI7QUFHOUJDLG9CQUFpQixhQUhhO0FBSTlCQyxVQUFPO0FBSnVCLEdBQS9CLEVBSDhDLENBVTlDOztBQUNBLE9BQUtKLEdBQUwsQ0FBUyxV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dGNoYXRfaXJjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ0lSQycsIGZ1bmN0aW9uKCkge1xuXG5cdFx0Ly8gSXMgdGhpcyB0aGluZyBvbj9cblx0XHR0aGlzLmFkZCgnSVJDX0VuYWJsZWQnLCBmYWxzZSwge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0aTE4bkxhYmVsOiAnRW5hYmxlZCcsXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdJUkNfRW5hYmxlZCcsXG5cdFx0XHRhbGVydDogJ0lSQyBTdXBwb3J0IGlzIGEgd29yayBpbiBwcm9ncmVzcy4gVXNlIG9uIGEgcHJvZHVjdGlvbiBzeXN0ZW0gaXMgbm90IHJlY29tbWVuZGVkIGF0IHRoaXMgdGltZS4nXG5cdFx0fSk7XG5cblx0XHQvLyBUaGUgSVJDIGhvc3Qgc2VydmVyIHRvIHRhbGsgdG9cblx0XHR0aGlzLmFkZCgnSVJDX0hvc3QnLCAnaXJjLmZyZWVub2RlLm5ldCcsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0aTE4bkxhYmVsOiAnSG9zdCcsXG5cdFx0XHRpMThuRGVzY3JpcHRpb246ICdJUkNfSG9zdG5hbWUnXG5cdFx0fSk7XG5cblx0XHQvLyBUaGUgcG9ydCB0byBjb25uZWN0IG9uIHRoZSByZW1vdGUgc2VydmVyXG5cdFx0dGhpcy5hZGQoJ0lSQ19Qb3J0JywgNjY2Nywge1xuXHRcdFx0dHlwZTogJ2ludCcsXG5cdFx0XHRpMThuTGFiZWw6ICdQb3J0Jyxcblx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19Qb3J0J1xuXHRcdH0pO1xuXG5cdFx0Ly8gQ2FjaGUgc2l6ZSBvZiB0aGUgbWVzc2FnZXMgd2Ugc2VuZCB0aGUgaG9zdCBJUkMgc2VydmVyXG5cdFx0dGhpcy5hZGQoJ0lSQ19NZXNzYWdlX0NhY2hlX1NpemUnLCAyMDAsIHtcblx0XHRcdHR5cGU6ICdpbnQnLFxuXHRcdFx0aTE4bkxhYmVsOiAnTWVzc2FnZSBDYWNoZSBTaXplJyxcblx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19NZXNzYWdlX0NhY2hlX1NpemUnXG5cdFx0fSk7XG5cblx0XHQvLyBFeHBhbmRhYmxlIGJveCBmb3IgbW9kaWZ5aW5nIHJlZ3VsYXIgZXhwcmVzc2lvbnMgZm9yIElSQyBpbnRlcmFjdGlvblxuXHRcdHRoaXMuc2VjdGlvbignUmVndWxhcl9FeHByZXNzaW9ucycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5hZGQoJ0lSQ19SZWdFeF9zdWNjZXNzTG9naW4nLCAnV2VsY29tZSB0byB0aGUgZnJlZW5vZGUgSW50ZXJuZXQgUmVsYXkgQ2hhdCBOZXR3b3JrJywge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0aTE4bkxhYmVsOiAnTG9naW4gU3VjY2Vzc2Z1bCcsXG5cdFx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19Mb2dpbl9TdWNjZXNzJ1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmFkZCgnSVJDX1JlZ0V4X2ZhaWxlZExvZ2luJywgJ1lvdSBoYXZlIG5vdCByZWdpc3RlcmVkJywge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0aTE4bkxhYmVsOiAnTG9naW4gRmFpbGVkJyxcblx0XHRcdFx0aTE4bkRlc2NyaXB0aW9uOiAnSVJDX0xvZ2luX0ZhaWwnXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuYWRkKCdJUkNfUmVnRXhfcmVjZWl2ZU1lc3NhZ2UnLCAnXjooXFxTKykhflxcUysgUFJJVk1TRyAoXFxTKykgOiguKykkJywge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0aTE4bkxhYmVsOiAnUHJpdmF0ZSBNZXNzYWdlJyxcblx0XHRcdFx0aTE4bkRlc2NyaXB0aW9uOiAnSVJDX1ByaXZhdGVfTWVzc2FnZSdcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5hZGQoJ0lSQ19SZWdFeF9yZWNlaXZlTWVtYmVyTGlzdCcsICdeOlxcUysgXFxkKyBcXFMrID0gIyhcXFMrKSA6KC4qKSQnLCB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRpMThuTGFiZWw6ICdDaGFubmVsIFVzZXIgTGlzdCBTdGFydCcsXG5cdFx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19DaGFubmVsX1VzZXJzJ1xuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmFkZCgnSVJDX1JlZ0V4X2VuZE1lbWJlckxpc3QnLCAnXi4rIyhcXFMrKSA6RW5kIG9mIFxcL05BTUVTIGxpc3QuJCcsIHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGkxOG5MYWJlbDogJ0NoYW5uZWwgVXNlciBMaXN0IEVuZCcsXG5cdFx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19DaGFubmVsX1VzZXJzX0VuZCdcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5hZGQoJ0lSQ19SZWdFeF9hZGRNZW1iZXJUb1Jvb20nLCAnXjooXFxTKykhflxcUysgSk9JTiAjKFxcUyspJCcsIHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGkxOG5MYWJlbDogJ0pvaW4gQ2hhbm5lbCcsXG5cdFx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19DaGFubmVsX0pvaW4nXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuYWRkKCdJUkNfUmVnRXhfcmVtb3ZlTWVtYmVyRnJvbVJvb20nLCAnXjooXFxTKykhflxcUysgUEFSVCAjKFxcUyspJCcsIHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGkxOG5MYWJlbDogJ0xlYXZlIENoYW5uZWwnLFxuXHRcdFx0XHRpMThuRGVzY3JpcHRpb246ICdJUkNfQ2hhbm5lbF9MZWF2ZSdcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5hZGQoJ0lSQ19SZWdFeF9xdWl0TWVtYmVyJywgJ146KFxcUyspIX5cXFMrIFFVSVQgLiokJywge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0aTE4bkxhYmVsOiAnUXVpdCBJUkMgU2Vzc2lvbicsXG5cdFx0XHRcdGkxOG5EZXNjcmlwdGlvbjogJ0lSQ19RdWl0J1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0fSk7XG59KTtcbiIsImltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IG5ldCBmcm9tICduZXQnO1xuaW1wb3J0IExydSBmcm9tICdscnUtY2FjaGUnO1xuXG4vLy8vLy8vXG4vLyBBc3NpZ24gdmFsdWVzXG5cbi8vUGFja2FnZSBhdmFpbGFiaWxpdHlcbmNvbnN0IElSQ19BVkFJTEFCSUxJVFkgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSVJDX0VuYWJsZWQnKTtcblxuLy8gQ2FjaGUgcHJlcFxuY29uc3QgTUVTU0FHRV9DQUNIRV9TSVpFID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0lSQ19NZXNzYWdlX0NhY2hlX1NpemUnKTtcbmNvbnN0IGlyY1JlY2VpdmVNZXNzYWdlQ2FjaGUgPSBMcnUoTUVTU0FHRV9DQUNIRV9TSVpFKTsvL2VzbGludC1kaXNhYmxlLWxpbmVcbmNvbnN0IGlyY1NlbmRNZXNzYWdlQ2FjaGUgPSBMcnUoTUVTU0FHRV9DQUNIRV9TSVpFKTsvL2VzbGludC1kaXNhYmxlLWxpbmVcblxuLy8gSVJDIHNlcnZlclxuY29uc3QgSVJDX1BPUlQgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSVJDX1BvcnQnKTtcbmNvbnN0IElSQ19IT1NUID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0lSQ19Ib3N0Jyk7XG5cbmNvbnN0IGlyY0NsaWVudE1hcCA9IHt9O1xuXG4vLy8vLy9cbi8vIENvcmUgZnVuY3Rpb25hbGl0eVxuXG5jb25zdCBiaW5kID0gZnVuY3Rpb24oZikge1xuXHRjb25zdCBnID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoc2VsZiwgLi4uYXJncykgPT4gZi5hcHBseShzZWxmLCBhcmdzKSk7XG5cdHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7IGcodGhpcywgLi4uYXJncyk7IH07XG59O1xuXG5jb25zdCBhc3luYyA9IChmLCAuLi5hcmdzKSA9PiBNZXRlb3Iud3JhcEFzeW5jKGYpKC4uLmFyZ3MpO1xuXG5jbGFzcyBJcmNDbGllbnQge1xuXHRjb25zdHJ1Y3Rvcihsb2dpblJlcSkge1xuXHRcdHRoaXMubG9naW5SZXEgPSBsb2dpblJlcTtcblxuXHRcdHRoaXMudXNlciA9IHRoaXMubG9naW5SZXEudXNlcjtcblx0XHRpcmNDbGllbnRNYXBbdGhpcy51c2VyLl9pZF0gPSB0aGlzO1xuXHRcdHRoaXMuaXJjUG9ydCA9IElSQ19QT1JUO1xuXHRcdHRoaXMuaXJjSG9zdCA9IElSQ19IT1NUO1xuXHRcdHRoaXMubXNnQnVmID0gW107XG5cblx0XHR0aGlzLmlzQ29ubmVjdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5pc0Rpc3Ryb3llZCA9IGZhbHNlO1xuXHRcdHRoaXMuc29ja2V0ID0gbmV3IG5ldC5Tb2NrZXQ7XG5cdFx0dGhpcy5zb2NrZXQuc2V0Tm9EZWxheTtcblx0XHR0aGlzLnNvY2tldC5zZXRFbmNvZGluZygndXRmLTgnKTtcblx0XHR0aGlzLnNvY2tldC5zZXRLZWVwQWxpdmUodHJ1ZSk7XG5cdFx0dGhpcy5jb25uZWN0ID0gdGhpcy5jb25uZWN0LmJpbmQodGhpcyk7XG5cdFx0dGhpcy5vbkNvbm5lY3QgPSB0aGlzLm9uQ29ubmVjdC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25Db25uZWN0ID0gYmluZCh0aGlzLm9uQ29ubmVjdCk7XG5cdFx0dGhpcy5vbkNsb3NlID0gYmluZCh0aGlzLm9uQ2xvc2UpO1xuXHRcdHRoaXMub25UaW1lb3V0ID0gYmluZCh0aGlzLm9uVGltZW91dCk7XG5cdFx0dGhpcy5vbkVycm9yID0gYmluZCh0aGlzLm9uRXJyb3IpO1xuXHRcdHRoaXMub25SZWNlaXZlUmF3TWVzc2FnZSA9IHRoaXMub25SZWNlaXZlUmF3TWVzc2FnZS5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25SZWNlaXZlUmF3TWVzc2FnZSA9IGJpbmQodGhpcy5vblJlY2VpdmVSYXdNZXNzYWdlKTtcblx0XHR0aGlzLnNvY2tldC5vbignZGF0YScsIHRoaXMub25SZWNlaXZlUmF3TWVzc2FnZSk7XG5cdFx0dGhpcy5zb2NrZXQub24oJ2Nsb3NlJywgdGhpcy5vbkNsb3NlKTtcblx0XHR0aGlzLnNvY2tldC5vbigndGltZW91dCcsIHRoaXMub25UaW1lb3V0KTtcblx0XHR0aGlzLnNvY2tldC5vbignZXJyb3InLCB0aGlzLm9uRXJyb3IpO1xuXG5cdFx0dGhpcy5pc0pvaW5pbmdSb29tID0gZmFsc2U7XG5cdFx0dGhpcy5yZWNlaXZlTWVtYmVyTGlzdEJ1ZiA9IHt9O1xuXHRcdHRoaXMucGVuZGluZ0pvaW5Sb29tQnVmID0gW107XG5cblx0XHR0aGlzLnN1Y2Nlc3NMb2dpbk1lc3NhZ2VSZWdleCA9IG5ldyBSZWdFeHAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0lSQ19SZWdFeF9zdWNjZXNzTG9naW4nKSk7XG5cdFx0dGhpcy5mYWlsZWRMb2dpbk1lc3NhZ2VSZWdleCA9IG5ldyBSZWdFeHAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0lSQ19SZWdFeF9mYWlsZWRMb2dpbicpKTtcblx0XHR0aGlzLnJlY2VpdmVNZXNzYWdlUmVnZXggPSBuZXcgUmVnRXhwKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdJUkNfUmVnRXhfcmVjZWl2ZU1lc3NhZ2UnKSk7XG5cdFx0dGhpcy5yZWNlaXZlTWVtYmVyTGlzdFJlZ2V4ID0gbmV3IFJlZ0V4cChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSVJDX1JlZ0V4X3JlY2VpdmVNZW1iZXJMaXN0JykpO1xuXHRcdHRoaXMuZW5kTWVtYmVyTGlzdFJlZ2V4ID0gbmV3IFJlZ0V4cChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSVJDX1JlZ0V4X2VuZE1lbWJlckxpc3QnKSk7XG5cdFx0dGhpcy5hZGRNZW1iZXJUb1Jvb21SZWdleCA9IG5ldyBSZWdFeHAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0lSQ19SZWdFeF9hZGRNZW1iZXJUb1Jvb20nKSk7XG5cdFx0dGhpcy5yZW1vdmVNZW1iZXJGcm9tUm9vbVJlZ2V4ID0gbmV3IFJlZ0V4cChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSVJDX1JlZ0V4X3JlbW92ZU1lbWJlckZyb21Sb29tJykpO1xuXHRcdHRoaXMucXVpdE1lbWJlclJlZ2V4ID0gbmV3IFJlZ0V4cChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnSVJDX1JlZ0V4X3F1aXRNZW1iZXInKSk7XG5cdH1cblxuXHRjb25uZWN0KGxvZ2luQ2IpIHtcblx0XHR0aGlzLmxvZ2luQ2IgPSBsb2dpbkNiO1xuXHRcdHRoaXMuc29ja2V0LmNvbm5lY3QodGhpcy5pcmNQb3J0LCB0aGlzLmlyY0hvc3QsIHRoaXMub25Db25uZWN0KTtcblx0XHR0aGlzLmluaXRSb29tTGlzdCgpO1xuXHR9XG5cblx0ZGlzY29ubmVjdCgpIHtcblx0XHR0aGlzLmlzRGlzdHJveWVkID0gdHJ1ZTtcblx0XHR0aGlzLnNvY2tldC5kZXN0cm95KCk7XG5cdH1cblxuXHRvbkNvbm5lY3QoKSB7XG5cdFx0Y29uc29sZS5sb2coJ1tpcmNdIG9uQ29ubmVjdCAtPiAnLnllbGxvdywgdGhpcy51c2VyLnVzZXJuYW1lLCAnY29ubmVjdCBzdWNjZXNzLicpO1xuXHRcdHRoaXMuc29ja2V0LndyaXRlKGBOSUNLICR7IHRoaXMudXNlci51c2VybmFtZSB9XFxyXFxuYCk7XG5cdFx0dGhpcy5zb2NrZXQud3JpdGUoYFVTRVIgJHsgdGhpcy51c2VyLnVzZXJuYW1lIH0gMCAqIDokeyB0aGlzLnVzZXIubmFtZSB9XFxyXFxuYCk7XG5cdFx0Ly8gbWVzc2FnZSBvcmRlciBjb3VsZCBub3QgbWFrZSBzdXJlIGhlcmVcblx0XHR0aGlzLmlzQ29ubmVjdGVkID0gdHJ1ZTtcblx0XHRjb25zdCBtZXNzYWdlQnVmID0gdGhpcy5tc2dCdWY7XG5cdFx0bWVzc2FnZUJ1Zi5mb3JFYWNoKG1zZyA9PiB0aGlzLnNvY2tldC53cml0ZShtc2cpKTtcblx0fVxuXG5cdG9uQ2xvc2UoKSB7XG5cdFx0Y29uc29sZS5sb2coJ1tpcmNdIG9uQ2xvc2UgLT4gJy55ZWxsb3csIHRoaXMudXNlci51c2VybmFtZSwgJ2Nvbm5lY3Rpb24gY2xvc2UuJyk7XG5cdFx0dGhpcy5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLmlzRGlzdHJveWVkKSB7XG5cdFx0XHRkZWxldGUgaXJjQ2xpZW50TWFwW3RoaXMudXNlci5faWRdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNvbm5lY3QoKTtcblx0XHR9XG5cdH1cblxuXHRvblRpbWVvdXQoKSB7XG5cdFx0Y29uc29sZS5sb2coJ1tpcmNdIG9uVGltZW91dCAtPiAnLnllbGxvdywgdGhpcy51c2VyLnVzZXJuYW1lLCAnY29ubmVjdGlvbiB0aW1lb3V0LicsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRvbkVycm9yKCkge1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBvbkVycm9yIC0+ICcueWVsbG93LCB0aGlzLnVzZXIudXNlcm5hbWUsICdjb25uZWN0aW9uIGVycm9yLicsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRvblJlY2VpdmVSYXdNZXNzYWdlKGRhdGEpIHtcblx0XHRkYXRhID0gZGF0YS50b1N0cmluZygpLnNwbGl0KCdcXG4nKTtcblxuXHRcdGRhdGEuZm9yRWFjaChsaW5lID0+IHtcblx0XHRcdGxpbmUgPSBsaW5lLnRyaW0oKTtcblx0XHRcdGNvbnNvbGUubG9nKGBbJHsgdGhpcy5pcmNIb3N0IH06JHsgdGhpcy5pcmNQb3J0IH1dOmAsIGxpbmUpO1xuXG5cdFx0XHQvLyBTZW5kIGhlYXJ0YmVhdCBwYWNrYWdlIHRvIGlyYyBzZXJ2ZXJcblx0XHRcdGlmIChsaW5lLmluZGV4T2YoJ1BJTkcnKSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnNvY2tldC53cml0ZShsaW5lLnJlcGxhY2UoJ1BJTkcgOicsICdQT05HICcpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGV0IG1hdGNoUmVzdWx0ID0gdGhpcy5yZWNlaXZlTWVzc2FnZVJlZ2V4LmV4ZWMobGluZSk7XG5cdFx0XHRpZiAobWF0Y2hSZXN1bHQpIHtcblx0XHRcdFx0dGhpcy5vblJlY2VpdmVNZXNzYWdlKG1hdGNoUmVzdWx0WzFdLCBtYXRjaFJlc3VsdFsyXSwgbWF0Y2hSZXN1bHRbM10pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRtYXRjaFJlc3VsdCA9IHRoaXMucmVjZWl2ZU1lbWJlckxpc3RSZWdleC5leGVjKGxpbmUpO1xuXHRcdFx0aWYgKG1hdGNoUmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMub25SZWNlaXZlTWVtYmVyTGlzdChtYXRjaFJlc3VsdFsxXSwgbWF0Y2hSZXN1bHRbMl0uc3BsaXQoJyAnKSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1hdGNoUmVzdWx0ID0gdGhpcy5lbmRNZW1iZXJMaXN0UmVnZXguZXhlYyhsaW5lKTtcblx0XHRcdGlmIChtYXRjaFJlc3VsdCkge1xuXHRcdFx0XHR0aGlzLm9uRW5kTWVtYmVyTGlzdChtYXRjaFJlc3VsdFsxXSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1hdGNoUmVzdWx0ID0gdGhpcy5hZGRNZW1iZXJUb1Jvb21SZWdleC5leGVjKGxpbmUpO1xuXHRcdFx0aWYgKG1hdGNoUmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMub25BZGRNZW1iZXJUb1Jvb20obWF0Y2hSZXN1bHRbMV0sIG1hdGNoUmVzdWx0WzJdKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bWF0Y2hSZXN1bHQgPSB0aGlzLnJlbW92ZU1lbWJlckZyb21Sb29tUmVnZXguZXhlYyhsaW5lKTtcblx0XHRcdGlmIChtYXRjaFJlc3VsdCkge1xuXHRcdFx0XHR0aGlzLm9uUmVtb3ZlTWVtYmVyRnJvbVJvb20obWF0Y2hSZXN1bHRbMV0sIG1hdGNoUmVzdWx0WzJdKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bWF0Y2hSZXN1bHQgPSB0aGlzLnF1aXRNZW1iZXJSZWdleC5leGVjKGxpbmUpO1xuXHRcdFx0aWYgKG1hdGNoUmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMub25RdWl0TWVtYmVyKG1hdGNoUmVzdWx0WzFdKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bWF0Y2hSZXN1bHQgPSB0aGlzLnN1Y2Nlc3NMb2dpbk1lc3NhZ2VSZWdleC5leGVjKGxpbmUpO1xuXHRcdFx0aWYgKG1hdGNoUmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMub25TdWNjZXNzTG9naW5NZXNzYWdlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1hdGNoUmVzdWx0ID0gdGhpcy5mYWlsZWRMb2dpbk1lc3NhZ2VSZWdleC5leGVjKGxpbmUpO1xuXHRcdFx0aWYgKG1hdGNoUmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMub25GYWlsZWRMb2dpbk1lc3NhZ2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b25TdWNjZXNzTG9naW5NZXNzYWdlKCkge1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBvblN1Y2Nlc3NMb2dpbk1lc3NhZ2UgLT4gJy55ZWxsb3cpO1xuXHRcdGlmICh0aGlzLmxvZ2luQ2IpIHtcblx0XHRcdHRoaXMubG9naW5DYihudWxsLCB0aGlzLmxvZ2luUmVxKTtcblx0XHR9XG5cdH1cblxuXHRvbkZhaWxlZExvZ2luTWVzc2FnZSgpIHtcblx0XHRjb25zb2xlLmxvZygnW2lyY10gb25GYWlsZWRMb2dpbk1lc3NhZ2UgLT4gJy55ZWxsb3cpO1xuXHRcdHRoaXMubG9naW5SZXEuYWxsb3dlZCA9IGZhbHNlO1xuXHRcdHRoaXMuZGlzY29ubmVjdCgpO1xuXHRcdGlmICh0aGlzLmxvZ2luQ2IpIHtcblx0XHRcdHRoaXMubG9naW5DYihudWxsLCB0aGlzLmxvZ2luUmVxKTtcblx0XHR9XG5cdH1cblxuXHRvblJlY2VpdmVNZXNzYWdlKHNvdXJjZSwgdGFyZ2V0LCBjb250ZW50KSB7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGU7XG5cdFx0Y29uc3QgdGltZXN0YW1wID0gbm93LmdldFRpbWUoKTtcblx0XHRsZXQgY2FjaGVLZXkgPSBbc291cmNlLCB0YXJnZXQsIGNvbnRlbnRdLmpvaW4oJywnKTtcblx0XHRjb25zb2xlLmxvZygnW2lyY10gaXJjU2VuZE1lc3NhZ2VDYWNoZS5nZXQgLT4gJy55ZWxsb3csICdrZXk6JywgY2FjaGVLZXksICd2YWx1ZTonLCBpcmNTZW5kTWVzc2FnZUNhY2hlLmdldChjYWNoZUtleSksICd0czonLCB0aW1lc3RhbXAgLSAxMDAwKTtcblx0XHRpZiAoaXJjU2VuZE1lc3NhZ2VDYWNoZS5nZXQoY2FjaGVLZXkpID4gKHRpbWVzdGFtcCAtIDEwMDApKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlyY1NlbmRNZXNzYWdlQ2FjaGUuc2V0KGNhY2hlS2V5LCB0aW1lc3RhbXApO1xuXHRcdH1cblx0XHRjb25zb2xlLmxvZygnW2lyY10gb25SZWNlaXZlTWVzc2FnZSAtPiAnLnllbGxvdywgJ3NvdXJjZTonLCBzb3VyY2UsICd0YXJnZXQ6JywgdGFyZ2V0LCAnY29udGVudDonLCBjb250ZW50KTtcblx0XHRzb3VyY2UgPSB0aGlzLmNyZWF0ZVVzZXJXaGVuTm90RXhpc3Qoc291cmNlKTtcblx0XHRsZXQgcm9vbTtcblx0XHRpZiAodGFyZ2V0WzBdID09PSAnIycpIHtcblx0XHRcdHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlOYW1lKHRhcmdldC5zdWJzdHJpbmcoMSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyb29tID0gdGhpcy5jcmVhdGVEaXJlY3RSb29tV2hlbk5vdEV4aXN0KHNvdXJjZSwgdGhpcy51c2VyKTtcblx0XHR9XG5cdFx0Y29uc3QgbWVzc2FnZSA9IHsgbXNnOiBjb250ZW50LCB0czogbm93IH07XG5cdFx0Y2FjaGVLZXkgPSBgJHsgc291cmNlLnVzZXJuYW1lIH0keyB0aW1lc3RhbXAgfWA7XG5cdFx0aXJjUmVjZWl2ZU1lc3NhZ2VDYWNoZS5zZXQoY2FjaGVLZXksIHRydWUpO1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBpcmNSZWNlaXZlTWVzc2FnZUNhY2hlLnNldCAtPiAnLnllbGxvdywgJ2tleTonLCBjYWNoZUtleSk7XG5cdFx0Um9ja2V0Q2hhdC5zZW5kTWVzc2FnZShzb3VyY2UsIG1lc3NhZ2UsIHJvb20pO1xuXHR9XG5cblx0b25SZWNlaXZlTWVtYmVyTGlzdChyb29tTmFtZSwgbWVtYmVycykge1xuXHRcdHRoaXMucmVjZWl2ZU1lbWJlckxpc3RCdWZbcm9vbU5hbWVdID0gdGhpcy5yZWNlaXZlTWVtYmVyTGlzdEJ1Zltyb29tTmFtZV0uY29uY2F0KG1lbWJlcnMpO1xuXHR9XG5cblx0b25FbmRNZW1iZXJMaXN0KHJvb21OYW1lKSB7XG5cdFx0Y29uc3QgbmV3TWVtYmVycyA9IHRoaXMucmVjZWl2ZU1lbWJlckxpc3RCdWZbcm9vbU5hbWVdO1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBvbkVuZE1lbWJlckxpc3QgLT4gJy55ZWxsb3csICdyb29tOicsIHJvb21OYW1lLCAnbWVtYmVyczonLCBuZXdNZW1iZXJzLmpvaW4oJywnKSk7XG5cdFx0Y29uc3Qgcm9vbSA9IFJvY2tldENoYXQubW9kZWxzLlJvb21zLmZpbmRPbmVCeU5hbWVBbmRUeXBlKHJvb21OYW1lLCAnYycpO1xuXHRcdGlmICghcm9vbSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBvbGRNZW1iZXJzID0gcm9vbS51c2VybmFtZXM7XG5cdFx0Y29uc3QgYXBwZW5kTWVtYmVycyA9IF8uZGlmZmVyZW5jZShuZXdNZW1iZXJzLCBvbGRNZW1iZXJzKTtcblx0XHRjb25zdCByZW1vdmVNZW1iZXJzID0gXy5kaWZmZXJlbmNlKG9sZE1lbWJlcnMsIG5ld01lbWJlcnMpO1xuXHRcdGFwcGVuZE1lbWJlcnMuZm9yRWFjaChtZW1iZXIgPT4gdGhpcy5jcmVhdGVVc2VyV2hlbk5vdEV4aXN0KG1lbWJlcikpO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnJlbW92ZVVzZXJuYW1lc0J5SWQocm9vbS5faWQsIHJlbW92ZU1lbWJlcnMpO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLmFkZFVzZXJuYW1lc0J5SWQocm9vbS5faWQsIGFwcGVuZE1lbWJlcnMpO1xuXG5cdFx0dGhpcy5pc0pvaW5pbmdSb29tID0gZmFsc2U7XG5cdFx0cm9vbU5hbWUgPSB0aGlzLnBlbmRpbmdKb2luUm9vbUJ1Zi5zaGlmdCgpO1xuXHRcdGlmIChyb29tTmFtZSkge1xuXHRcdFx0dGhpcy5qb2luUm9vbSh7XG5cdFx0XHRcdHQ6ICdjJyxcblx0XHRcdFx0bmFtZTogcm9vbU5hbWVcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHNlbmRSYXdNZXNzYWdlKG1zZykge1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBzZW5kUmF3TWVzc2FnZSAtPiAnLnllbGxvdywgbXNnLnNsaWNlKDAsIC0yKSk7XG5cdFx0aWYgKHRoaXMuaXNDb25uZWN0ZWQpIHtcblx0XHRcdHRoaXMuc29ja2V0LndyaXRlKG1zZyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubXNnQnVmLnB1c2gobXNnKTtcblx0XHR9XG5cdH1cblxuXHRzZW5kTWVzc2FnZShyb29tLCBtZXNzYWdlKSB7XG5cdFx0Y29uc29sZS5sb2coJ1tpcmNdIHNlbmRNZXNzYWdlIC0+ICcueWVsbG93LCAndXNlck5hbWU6JywgbWVzc2FnZS51LnVzZXJuYW1lKTtcblx0XHRsZXQgdGFyZ2V0ID0gJyc7XG5cdFx0aWYgKHJvb20udCA9PT0gJ2MnKSB7XG5cdFx0XHR0YXJnZXQgPSBgIyR7IHJvb20ubmFtZSB9YDtcblx0XHR9IGVsc2UgaWYgKHJvb20udCA9PT0gJ2QnKSB7XG5cdFx0XHRjb25zdCB1c2VybmFtZXMgPSByb29tLnVzZXJuYW1lcztcblx0XHRcdHVzZXJuYW1lcy5mb3JFYWNoKG5hbWUgPT4ge1xuXHRcdFx0XHRpZiAobWVzc2FnZS51LnVzZXJuYW1lICE9PSBuYW1lKSB7XG5cdFx0XHRcdFx0dGFyZ2V0ID0gbmFtZTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRjb25zdCBjYWNoZUtleSA9IFt0aGlzLnVzZXIudXNlcm5hbWUsIHRhcmdldCwgbWVzc2FnZS5tc2ddLmpvaW4oJywnKTtcblx0XHRjb25zb2xlLmxvZygnW2lyY10gaXJjU2VuZE1lc3NhZ2VDYWNoZS5zZXQgLT4gJy55ZWxsb3csICdrZXk6JywgY2FjaGVLZXksICd0czonLCBtZXNzYWdlLnRzLmdldFRpbWUoKSk7XG5cdFx0aXJjU2VuZE1lc3NhZ2VDYWNoZS5zZXQoY2FjaGVLZXksIG1lc3NhZ2UudHMuZ2V0VGltZSgpKTtcblx0XHRjb25zdCBtc2cgPSBgUFJJVk1TRyAkeyB0YXJnZXQgfSA6JHsgbWVzc2FnZS5tc2cgfVxcclxcbmA7XG5cdFx0dGhpcy5zZW5kUmF3TWVzc2FnZShtc2cpO1xuXHR9XG5cblx0aW5pdFJvb21MaXN0KCkge1xuXHRcdGNvbnN0IHJvb21zQ3Vyc29yID0gUm9ja2V0Q2hhdC5tb2RlbHMuUm9vbXMuZmluZEJ5VHlwZUNvbnRhaW5pbmdVc2VybmFtZSgnYycsIHRoaXMudXNlci51c2VybmFtZSwgeyBmaWVsZHM6IHsgbmFtZTogMSwgdDogMSB9fSk7XG5cdFx0Y29uc3Qgcm9vbXMgPSByb29tc0N1cnNvci5mZXRjaCgpO1xuXHRcdHJvb21zLmZvckVhY2gocm9vbSA9PiB0aGlzLmpvaW5Sb29tKHJvb20pKTtcblx0fVxuXG5cdGpvaW5Sb29tKHJvb20pIHtcblx0XHRpZiAocm9vbS50ICE9PSAnYycgfHwgcm9vbS5uYW1lID09PSAnZ2VuZXJhbCcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuaXNKb2luaW5nUm9vbSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucGVuZGluZ0pvaW5Sb29tQnVmLnB1c2gocm9vbS5uYW1lKTtcblx0XHR9XG5cdFx0Y29uc29sZS5sb2coJ1tpcmNdIGpvaW5Sb29tIC0+ICcueWVsbG93LCAncm9vbU5hbWU6Jywgcm9vbS5uYW1lLCAncGVuZGluZ0pvaW5Sb29tQnVmOicsIHRoaXMucGVuZGluZ0pvaW5Sb29tQnVmLmpvaW4oJywnKSk7XG5cdFx0Y29uc3QgbXNnID0gYEpPSU4gIyR7IHJvb20ubmFtZSB9XFxyXFxuYDtcblx0XHR0aGlzLnJlY2VpdmVNZW1iZXJMaXN0QnVmW3Jvb20ubmFtZV0gPSBbXTtcblx0XHR0aGlzLnNlbmRSYXdNZXNzYWdlKG1zZyk7XG5cdFx0dGhpcy5pc0pvaW5pbmdSb29tID0gdHJ1ZTtcblx0fVxuXG5cdGxlYXZlUm9vbShyb29tKSB7XG5cdFx0aWYgKHJvb20udCAhPT0gJ2MnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG1zZyA9IGBQQVJUICMkeyByb29tLm5hbWUgfVxcclxcbmA7XG5cdFx0dGhpcy5zZW5kUmF3TWVzc2FnZShtc2cpO1xuXHR9XG5cblx0Z2V0TWVtYmVyTGlzdChyb29tKSB7XG5cdFx0aWYgKHJvb20udCAhPT0gJ2MnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG1zZyA9IGBOQU1FUyAjJHsgcm9vbS5uYW1lIH1cXHJcXG5gO1xuXHRcdHRoaXMucmVjZWl2ZU1lbWJlckxpc3RCdWZbcm9vbS5uYW1lXSA9IFtdO1xuXHRcdHRoaXMuc2VuZFJhd01lc3NhZ2UobXNnKTtcblx0fVxuXG5cdG9uQWRkTWVtYmVyVG9Sb29tKG1lbWJlciwgcm9vbU5hbWUpIHtcblx0XHRpZiAodGhpcy51c2VyLnVzZXJuYW1lID09PSBtZW1iZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc29sZS5sb2coJ1tpcmNdIG9uQWRkTWVtYmVyVG9Sb29tIC0+ICcueWVsbG93LCAncm9vbU5hbWU6Jywgcm9vbU5hbWUsICdtZW1iZXI6JywgbWVtYmVyKTtcblx0XHR0aGlzLmNyZWF0ZVVzZXJXaGVuTm90RXhpc3QobWVtYmVyKTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5hZGRVc2VybmFtZUJ5TmFtZShyb29tTmFtZSwgbWVtYmVyKTtcblx0fVxuXG5cdG9uUmVtb3ZlTWVtYmVyRnJvbVJvb20obWVtYmVyLCByb29tTmFtZSkge1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBvblJlbW92ZU1lbWJlckZyb21Sb29tIC0+ICcueWVsbG93LCAncm9vbU5hbWU6Jywgcm9vbU5hbWUsICdtZW1iZXI6JywgbWVtYmVyKTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5yZW1vdmVVc2VybmFtZUJ5TmFtZShyb29tTmFtZSwgbWVtYmVyKTtcblx0fVxuXG5cdG9uUXVpdE1lbWJlcihtZW1iZXIpIHtcblx0XHRjb25zb2xlLmxvZygnW2lyY10gb25RdWl0TWVtYmVyIC0+Jy55ZWxsb3csICd1c2VybmFtZTonLCBtZW1iZXIpO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlJvb21zLnJlbW92ZVVzZXJuYW1lRnJvbUFsbChtZW1iZXIpO1xuXHRcdE1ldGVvci51c2Vycy51cGRhdGUoeyBuYW1lOiBtZW1iZXIgfSwgeyAkc2V0OiB7IHN0YXR1czogJ29mZmxpbmUnIH19KTtcblx0fVxuXG5cdGNyZWF0ZVVzZXJXaGVuTm90RXhpc3QobmFtZSkge1xuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZSh7IG5hbWUgfSk7XG5cdFx0aWYgKHVzZXIpIHtcblx0XHRcdHJldHVybiB1c2VyO1xuXHRcdH1cblx0XHRjb25zb2xlLmxvZygnW2lyY10gY3JlYXRlTm90RXhpc3RVc2VyIC0+Jy55ZWxsb3csICd1c2VyTmFtZTonLCBuYW1lKTtcblx0XHRNZXRlb3IuY2FsbCgncmVnaXN0ZXJVc2VyJywge1xuXHRcdFx0ZW1haWw6IGAkeyBuYW1lIH1Acm9ja2V0Y2hhdC5vcmdgLFxuXHRcdFx0cGFzczogJ3JvY2tldGNoYXQnLFxuXHRcdFx0bmFtZVxuXHRcdH0pO1xuXHRcdE1ldGVvci51c2Vycy51cGRhdGUoeyBuYW1lIH0sIHtcblx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0c3RhdHVzOiAnb25saW5lJyxcblx0XHRcdFx0dXNlcm5hbWU6IG5hbWVcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gTWV0ZW9yLnVzZXJzLmZpbmRPbmUoeyBuYW1lIH0pO1xuXHR9XG5cblx0Y3JlYXRlRGlyZWN0Um9vbVdoZW5Ob3RFeGlzdChzb3VyY2UsIHRhcmdldCkge1xuXHRcdGNvbnNvbGUubG9nKCdbaXJjXSBjcmVhdGVEaXJlY3RSb29tV2hlbk5vdEV4aXN0IC0+ICcueWVsbG93LCAnc291cmNlOicsIHNvdXJjZSwgJ3RhcmdldDonLCB0YXJnZXQpO1xuXHRcdGNvbnN0IHJpZCA9IFtzb3VyY2UuX2lkLCB0YXJnZXQuX2lkXS5zb3J0KCkuam9pbignJyk7XG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHRSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy51cHNlcnQoeyBfaWQ6IHJpZH0sIHtcblx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0dXNlcm5hbWVzOiBbc291cmNlLnVzZXJuYW1lLCB0YXJnZXQudXNlcm5hbWVdXG5cdFx0XHR9LFxuXHRcdFx0JHNldE9uSW5zZXJ0OiB7XG5cdFx0XHRcdHQ6ICdkJyxcblx0XHRcdFx0bXNnczogMCxcblx0XHRcdFx0dHM6IG5vd1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdFJvY2tldENoYXQubW9kZWxzLlN1YnNjcmlwdGlvbnMudXBzZXJ0KHsgcmlkLCAkYW5kOiBbeyAndS5faWQnOiB0YXJnZXQuX2lkfV19LCB7XG5cdFx0XHQkc2V0T25JbnNlcnQ6IHtcblx0XHRcdFx0bmFtZTogc291cmNlLnVzZXJuYW1lLFxuXHRcdFx0XHR0OiAnZCcsXG5cdFx0XHRcdG9wZW46IGZhbHNlLFxuXHRcdFx0XHRhbGVydDogZmFsc2UsXG5cdFx0XHRcdHVucmVhZDogMCxcblx0XHRcdFx0dXNlck1lbnRpb25zOiAwLFxuXHRcdFx0XHRncm91cE1lbnRpb25zOiAwLFxuXHRcdFx0XHR1OiB7IF9pZDogdGFyZ2V0Ll9pZCwgdXNlcm5hbWU6IHRhcmdldC51c2VybmFtZSB9fVxuXHRcdH0pO1xuXHRcdHJldHVybiB7IHQ6ICdkJywgX2lkOiByaWQgfTtcblx0fVxufVxuXG5JcmNDbGllbnQuZ2V0QnlVaWQgPSBmdW5jdGlvbih1aWQpIHtcblx0cmV0dXJuIGlyY0NsaWVudE1hcFt1aWRdO1xufTtcblxuSXJjQ2xpZW50LmNyZWF0ZSA9IGZ1bmN0aW9uKGxvZ2luKSB7XG5cdGlmIChsb2dpbi51c2VyID09IG51bGwpIHtcblx0XHRyZXR1cm4gbG9naW47XG5cdH1cblx0aWYgKCEobG9naW4udXNlci5faWQgaW4gaXJjQ2xpZW50TWFwKSkge1xuXHRcdGNvbnN0IGlyY0NsaWVudCA9IG5ldyBJcmNDbGllbnQobG9naW4pO1xuXHRcdHJldHVybiBhc3luYyhpcmNDbGllbnQuY29ubmVjdCk7XG5cdH1cblx0cmV0dXJuIGxvZ2luO1xufTtcblxuZnVuY3Rpb24gSXJjTG9naW5lcihsb2dpbikge1xuXHRjb25zb2xlLmxvZygnW2lyY10gdmFsaWRhdGVMb2dpbiAtPiAnLnllbGxvdywgbG9naW4pO1xuXHRyZXR1cm4gSXJjQ2xpZW50LmNyZWF0ZShsb2dpbik7XG59XG5cblxuZnVuY3Rpb24gSXJjU2VuZGVyKG1lc3NhZ2UpIHtcblx0Y29uc3QgbmFtZSA9IG1lc3NhZ2UudS51c2VybmFtZTtcblx0Y29uc3QgdGltZXN0YW1wID0gbWVzc2FnZS50cy5nZXRUaW1lKCk7XG5cdGNvbnN0IGNhY2hlS2V5ID0gYCR7IG5hbWUgfSR7IHRpbWVzdGFtcCB9YDtcblx0aWYgKGlyY1JlY2VpdmVNZXNzYWdlQ2FjaGUuZ2V0KGNhY2hlS2V5KSkge1xuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cdGNvbnN0IHJvb20gPSBSb2NrZXRDaGF0Lm1vZGVscy5Sb29tcy5maW5kT25lQnlJZChtZXNzYWdlLnJpZCwgeyBmaWVsZHM6IHsgbmFtZTogMSwgdXNlcm5hbWVzOiAxLCB0OiAxIH19KTtcblx0Y29uc3QgaXJjQ2xpZW50ID0gSXJjQ2xpZW50LmdldEJ5VWlkKG1lc3NhZ2UudS5faWQpO1xuXHRpcmNDbGllbnQuc2VuZE1lc3NhZ2Uocm9vbSwgbWVzc2FnZSk7XG5cdHJldHVybiBtZXNzYWdlO1xufVxuXG5cbmZ1bmN0aW9uIElyY1Jvb21Kb2luZXIodXNlciwgcm9vbSkge1xuXHRjb25zdCBpcmNDbGllbnQgPSBJcmNDbGllbnQuZ2V0QnlVaWQodXNlci5faWQpO1xuXHRpcmNDbGllbnQuam9pblJvb20ocm9vbSk7XG5cdHJldHVybiByb29tO1xufVxuXG5cbmZ1bmN0aW9uIElyY1Jvb21MZWF2ZXIodXNlciwgcm9vbSkge1xuXHRjb25zdCBpcmNDbGllbnQgPSBJcmNDbGllbnQuZ2V0QnlVaWQodXNlci5faWQpO1xuXHRpcmNDbGllbnQubGVhdmVSb29tKHJvb20pO1xuXHRyZXR1cm4gcm9vbTtcbn1cblxuZnVuY3Rpb24gSXJjTG9nb3V0Q2xlYW5VcGVyKHVzZXIpIHtcblx0Y29uc3QgaXJjQ2xpZW50ID0gSXJjQ2xpZW50LmdldEJ5VWlkKHVzZXIuX2lkKTtcblx0aXJjQ2xpZW50LmRpc2Nvbm5lY3QoKTtcblx0cmV0dXJuIHVzZXI7XG59XG5cbi8vLy8vL1xuLy8gTWFrZSBtYWdpYyBoYXBwZW5cblxuLy8gT25seSBwcm9jZWVkIGlmIHRoZSBwYWNrYWdlIGhhcyBiZWVuIGVuYWJsZWRcbmlmIChJUkNfQVZBSUxBQklMSVRZID09PSB0cnVlKSB7XG5cdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYmVmb3JlVmFsaWRhdGVMb2dpbicsIElyY0xvZ2luZXIsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ2lyYy1sb2dpbmVyJyk7XG5cdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYmVmb3JlU2F2ZU1lc3NhZ2UnLCBJcmNTZW5kZXIsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ2lyYy1zZW5kZXInKTtcblx0Um9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdiZWZvcmVKb2luUm9vbScsIElyY1Jvb21Kb2luZXIsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ2lyYy1yb29tLWpvaW5lcicpO1xuXHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ2JlZm9yZUNyZWF0ZUNoYW5uZWwnLCBJcmNSb29tSm9pbmVyLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1csICdpcmMtcm9vbS1qb2luZXItY3JlYXRlLWNoYW5uZWwnKTtcblx0Um9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdiZWZvcmVMZWF2ZVJvb20nLCBJcmNSb29tTGVhdmVyLCBSb2NrZXRDaGF0LmNhbGxiYWNrcy5wcmlvcml0eS5MT1csICdpcmMtcm9vbS1sZWF2ZXInKTtcblx0Um9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdhZnRlckxvZ291dENsZWFuVXAnLCBJcmNMb2dvdXRDbGVhblVwZXIsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkxPVywgJ2lyYy1jbGVhbi11cCcpO1xufVxuIl19
