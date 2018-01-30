(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Accounts = Package['accounts-base'].Accounts;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var SHA256 = Package.sha.SHA256;
var Random = Package.random.Random;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:2fa":{"server":{"lib":{"totp.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/lib/totp.js                                                                     //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let speakeasy;
module.watch(require("speakeasy"), {
	default(v) {
		speakeasy = v;
	}

}, 0);
RocketChat.TOTP = {
	generateSecret() {
		return speakeasy.generateSecret();
	},

	generateOtpauthURL(secret, username) {
		return speakeasy.otpauthURL({
			secret: secret.ascii,
			label: `Rocket.Chat:${username}`
		});
	},

	verify({
		secret,
		token,
		backupTokens,
		userId
	}) {
		let verified; // validates a backup code

		if (token.length === 8 && backupTokens) {
			const hashedCode = SHA256(token);
			const usedCode = backupTokens.indexOf(hashedCode);

			if (usedCode !== -1) {
				verified = true;
				backupTokens.splice(usedCode, 1); // mark the code as used (remove it from the list)

				RocketChat.models.Users.update2FABackupCodesByUserId(userId, backupTokens);
			}
		} else {
			verified = speakeasy.totp.verify({
				secret,
				encoding: 'base32',
				token
			});
		}

		return verified;
	},

	generateCodes() {
		// generate 12 backup codes
		const codes = [];
		const hashedCodes = [];

		for (let i = 0; i < 12; i++) {
			const code = Random.id(8);
			codes.push(code);
			hashedCodes.push(SHA256(code));
		}

		return {
			codes,
			hashedCodes
		};
	}

};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"checkCodesRemaining.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/methods/checkCodesRemaining.js                                                  //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Meteor.methods({
	'2fa:checkCodesRemaining'() {
		if (!Meteor.userId()) {
			throw new Meteor.Error('not-authorized');
		}

		const user = Meteor.user();

		if (!user.services || !user.services.totp || !user.services.totp.enabled) {
			throw new Meteor.Error('invalid-totp');
		}

		return {
			remaining: user.services.totp.hashedBackup.length
		};
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"disable.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/methods/disable.js                                                              //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Meteor.methods({
	'2fa:disable'(code) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('not-authorized');
		}

		const user = Meteor.user();
		const verified = RocketChat.TOTP.verify({
			secret: user.services.totp.secret,
			token: code,
			userId: Meteor.userId(),
			backupTokens: user.services.totp.hashedBackup
		});

		if (!verified) {
			return false;
		}

		return RocketChat.models.Users.disable2FAByUserId(Meteor.userId());
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"enable.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/methods/enable.js                                                               //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Meteor.methods({
	'2fa:enable'() {
		if (!Meteor.userId()) {
			throw new Meteor.Error('not-authorized');
		}

		const user = Meteor.user();
		const secret = RocketChat.TOTP.generateSecret();
		RocketChat.models.Users.disable2FAAndSetTempSecretByUserId(Meteor.userId(), secret.base32);
		return {
			secret: secret.base32,
			url: RocketChat.TOTP.generateOtpauthURL(secret, user.username)
		};
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"regenerateCodes.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/methods/regenerateCodes.js                                                      //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Meteor.methods({
	'2fa:regenerateCodes'(userToken) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('not-authorized');
		}

		const user = Meteor.user();

		if (!user.services || !user.services.totp || !user.services.totp.enabled) {
			throw new Meteor.Error('invalid-totp');
		}

		const verified = RocketChat.TOTP.verify({
			secret: user.services.totp.secret,
			token: userToken,
			userId: Meteor.userId(),
			backupTokens: user.services.totp.hashedBackup
		});

		if (verified) {
			const {
				codes,
				hashedCodes
			} = RocketChat.TOTP.generateCodes();
			RocketChat.models.Users.update2FABackupCodesByUserId(Meteor.userId(), hashedCodes);
			return {
				codes
			};
		}
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"validateTempToken.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/methods/validateTempToken.js                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Meteor.methods({
	'2fa:validateTempToken'(userToken) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('not-authorized');
		}

		const user = Meteor.user();

		if (!user.services || !user.services.totp || !user.services.totp.tempSecret) {
			throw new Meteor.Error('invalid-totp');
		}

		const verified = RocketChat.TOTP.verify({
			secret: user.services.totp.tempSecret,
			token: userToken
		});

		if (verified) {
			const {
				codes,
				hashedCodes
			} = RocketChat.TOTP.generateCodes();
			RocketChat.models.Users.enable2FAAndSetSecretAndCodesByUserId(Meteor.userId(), user.services.totp.tempSecret, hashedCodes);
			return {
				codes
			};
		}
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"models":{"users.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/models/users.js                                                                 //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
RocketChat.models.Users.disable2FAAndSetTempSecretByUserId = function (userId, tempToken) {
	return this.update({
		_id: userId
	}, {
		$set: {
			'services.totp': {
				enabled: false,
				tempSecret: tempToken
			}
		}
	});
};

RocketChat.models.Users.enable2FAAndSetSecretAndCodesByUserId = function (userId, secret, backupCodes) {
	return this.update({
		_id: userId
	}, {
		$set: {
			'services.totp.enabled': true,
			'services.totp.secret': secret,
			'services.totp.hashedBackup': backupCodes
		},
		$unset: {
			'services.totp.tempSecret': 1
		}
	});
};

RocketChat.models.Users.disable2FAByUserId = function (userId) {
	return this.update({
		_id: userId
	}, {
		$set: {
			'services.totp': {
				enabled: false
			}
		}
	});
};

RocketChat.models.Users.update2FABackupCodesByUserId = function (userId, backupCodes) {
	return this.update({
		_id: userId
	}, {
		$set: {
			'services.totp.hashedBackup': backupCodes
		}
	});
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"loginHandler.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_2fa/server/loginHandler.js                                                                 //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Accounts.registerLoginHandler('totp', function (options) {
	if (!options.totp || !options.totp.code) {
		return;
	}

	return Accounts._runLoginHandlers(this, options.totp.login);
});
RocketChat.callbacks.add('onValidateLogin', login => {
	if (login.type === 'password' && login.user.services && login.user.services.totp && login.user.services.totp.enabled === true) {
		const {
			totp
		} = login.methodArguments[0];

		if (!totp || !totp.code) {
			throw new Meteor.Error('totp-required', 'TOTP Required');
		}

		const verified = RocketChat.TOTP.verify({
			secret: login.user.services.totp.secret,
			token: totp.code,
			userId: login.user._id,
			backupTokens: login.user.services.totp.hashedBackup
		});

		if (verified !== true) {
			throw new Meteor.Error('totp-invalid', 'TOTP Invalid');
		}
	}
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"speakeasy":{"package.json":function(require,exports){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// ../../.meteor/local/isopacks/rocketchat_2fa/npm/node_modules/speakeasy/package.json                            //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
exports.name = "speakeasy";
exports.version = "2.0.0";
exports.main = "index.js";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// node_modules/meteor/rocketchat_2fa/node_modules/speakeasy/index.js                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
'use strict';

var base32 = require('base32.js');
var crypto = require('crypto');
var url = require('url');
var util = require('util');

/**
 * Digest the one-time passcode options.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {Integer} options.counter Counter value
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @param {String} [options.key] (DEPRECATED. Use `secret` instead.)
 *   Shared secret key
 * @return {Buffer} The one-time passcode as a buffer.
 */

exports.digest = function digest (options) {
  var i;

  // unpack options
  var secret = options.secret;
  var counter = options.counter;
  var encoding = options.encoding || 'ascii';
  var algorithm = (options.algorithm || 'sha1').toLowerCase();

  // Backwards compatibility - deprecated
  if (options.key != null) {
    console.warn('Speakeasy - Deprecation Notice - Specifying the secret using `key` is no longer supported. Use `secret` instead.');
    secret = options.key;
  }

  // convert secret to buffer
  if (!Buffer.isBuffer(secret)) {
    secret = encoding === 'base32' ? base32.decode(secret)
      : new Buffer(secret, encoding);
  }

  // create an buffer from the counter
  var buf = new Buffer(8);
  var tmp = counter;
  for (i = 0; i < 8; i++) {
    // mask 0xff over number to get last 8
    buf[7 - i] = tmp & 0xff;

    // shift 8 and get ready to loop over the next batch of 8
    tmp = tmp >> 8;
  }

  // init hmac with the key
  var hmac = crypto.createHmac(algorithm, secret);

  // update hmac with the counter
  hmac.update(buf);

  // return the digest
  return hmac.digest();
};

/**
 * Generate a counter-based one-time token. Specify the key and counter, and
 * receive the one-time password for that counter position as a string. You can
 * also specify a token length, as well as the encoding (ASCII, hexadecimal, or
 * base32) and the hashing algorithm to use (SHA1, SHA256, SHA512).
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {Integer} options.counter Counter value
 * @param {Buffer} [options.digest] Digest, automatically generated by default
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode.
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @param {String} [options.key] (DEPRECATED. Use `secret` instead.)
 *   Shared secret key
 * @param {Integer} [options.length=6] (DEPRECATED. Use `digits` instead.) The
 *   number of digits for the one-time passcode.
 * @return {String} The one-time passcode.
 */

exports.hotp = function hotpGenerate (options) {
  // unpack digits
  // backward compatibility: `length` is also accepted here, but deprecated
  var digits = (options.digits != null ? options.digits : options.length) || 6;
  if (options.length != null) console.warn('Speakeasy - Deprecation Notice - Specifying token digits using `length` is no longer supported. Use `digits` instead.');

  // digest the options
  var digest = options.digest || exports.digest(options);

  // compute HOTP offset
  var offset = digest[digest.length - 1] & 0xf;

  // calculate binary code (RFC4226 5.4)
  var code = (digest[offset] & 0x7f) << 24 |
    (digest[offset + 1] & 0xff) << 16 |
    (digest[offset + 2] & 0xff) << 8 |
    (digest[offset + 3] & 0xff);

  // left-pad code
  code = new Array(digits + 1).join('0') + code.toString(10);

  // return length number off digits
  return code.substr(-digits);
};

// Alias counter() for hotp()
exports.counter = exports.hotp;

/**
 * Verify a counter-based one-time token against the secret and return the delta.
 * By default, it verifies the token at the given counter value, with no leeway
 * (no look-ahead or look-behind). A token validated at the current counter value
 * will have a delta of 0.
 *
 * You can specify a window to add more leeway to the verification process.
 * Setting the window param will check for the token at the given counter value
 * as well as `window` tokens ahead (one-sided window). See param for more info.
 *
 * `verifyDelta()` will return the delta between the counter value of the token
 * and the given counter value. For example, if given a counter 5 and a window
 * 10, `verifyDelta()` will look at tokens from 5 to 15, inclusive. If it finds
 * it at counter position 7, it will return `{ delta: 2 }`.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {String} options.token Passcode to validate
 * @param {Integer} options.counter Counter value. This should be stored by
 *   the application and must be incremented for each request.
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode.
 * @param {Integer} [options.window=0] The allowable margin for the counter.
 *   The function will check "W" codes in the future against the provided
 *   passcode, e.g. if W = 10, and C = 5, this function will check the
 *   passcode against all One Time Passcodes between 5 and 15, inclusive.
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @return {Object} On success, returns an object with the counter
 *   difference between the client and the server as the `delta` property (i.e.
 *   `{ delta: 0 }`).
 * @method hotp․verifyDelta
 * @global
 */

exports.hotp.verifyDelta = function hotpVerifyDelta (options) {
  var i;

  // shadow options
  options = Object.create(options);

  // unpack options
  var token = String(options.token);
  var digits = parseInt(options.digits, 10) || 6;
  var window = parseInt(options.window, 10) || 0;
  var counter = parseInt(options.counter, 10) || 0;

  // fail if token is not of correct length
  if (token.length !== digits) {
    return;
  }

  // parse token to integer
  token = parseInt(token, 10);

  // fail if token is NA
  if (isNaN(token)) {
    return;
  }

  // loop from C to C + W inclusive
  for (i = counter; i <= counter + window; ++i) {
    options.counter = i;
    // domain-specific constant-time comparison for integer codes
    if (parseInt(exports.hotp(options), 10) === token) {
      // found a matching code, return delta
      return {delta: i - counter};
    }
  }

  // no codes have matched
};

/**
 * Verify a counter-based one-time token against the secret and return true if
 * it verifies. Helper function for `hotp.verifyDelta()`` that returns a boolean
 * instead of an object. For more on how to use a window with this, see
 * {@link hotp.verifyDelta}.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {String} options.token Passcode to validate
 * @param {Integer} options.counter Counter value. This should be stored by
 *   the application and must be incremented for each request.
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode.
 * @param {Integer} [options.window=0] The allowable margin for the counter.
 *   The function will check "W" codes in the future against the provided
 *   passcode, e.g. if W = 10, and C = 5, this function will check the
 *   passcode against all One Time Passcodes between 5 and 15, inclusive.
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @return {Boolean} Returns true if the token matches within the given
 *   window, false otherwise.
 * @method hotp․verify
 * @global
 */
exports.hotp.verify = function hotpVerify (options) {
  return exports.hotp.verifyDelta(options) != null;
};

/**
 * Calculate counter value based on given options. A counter value converts a
 * TOTP time into a counter value by finding the number of time steps that have
 * passed since the epoch to the current time.
 *
 * @param {Object} options
 * @param {Integer} [options.time] Time in seconds with which to calculate
 *   counter value. Defaults to `Date.now()`.
 * @param {Integer} [options.step=30] Time step in seconds
 * @param {Integer} [options.epoch=0] Initial time since the UNIX epoch from
 *   which to calculate the counter value. Defaults to 0 (no offset).
 * @param {Integer} [options.initial_time=0] (DEPRECATED. Use `epoch` instead.)
 *   Initial time in seconds since the UNIX epoch from which to calculate the
 *   counter value. Defaults to 0 (no offset).
 * @return {Integer} The calculated counter value.
 * @private
 */

exports._counter = function _counter (options) {
  var step = options.step || 30;
  var time = options.time != null ? (options.time * 1000) : Date.now();

  // also accepts 'initial_time', but deprecated
  var epoch = (options.epoch != null ? (options.epoch * 1000) : (options.initial_time * 1000)) || 0;
  if (options.initial_time != null) console.warn('Speakeasy - Deprecation Notice - Specifying the epoch using `initial_time` is no longer supported. Use `epoch` instead.');

  return Math.floor((time - epoch) / step / 1000);
};

/**
 * Generate a time-based one-time token. Specify the key, and receive the
 * one-time password for that time as a string. By default, it uses the current
 * time and a time step of 30 seconds, so there is a new token every 30 seconds.
 * You may override the time step and epoch for custom timing. You can also
 * specify a token length, as well as the encoding (ASCII, hexadecimal, or
 * base32) and the hashing algorithm to use (SHA1, SHA256, SHA512).
 *
 * Under the hood, TOTP calculates the counter value by finding how many time
 * steps have passed since the epoch, and calls HOTP with that counter value.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {Integer} [options.time] Time in seconds with which to calculate
 *   counter value. Defaults to `Date.now()`.
 * @param {Integer} [options.step=30] Time step in seconds
 * @param {Integer} [options.epoch=0] Initial time in seconds since the UNIX
 *   epoch from which to calculate the counter value. Defaults to 0 (no offset).
 * @param {Integer} [options.counter] Counter value, calculated by default.
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode.
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @param {String} [options.key] (DEPRECATED. Use `secret` instead.)
 *   Shared secret key
 * @param {Integer} [options.initial_time=0] (DEPRECATED. Use `epoch` instead.)
 *   Initial time in seconds since the UNIX epoch from which to calculate the
 *   counter value. Defaults to 0 (no offset).
 * @param {Integer} [options.length=6] (DEPRECATED. Use `digits` instead.) The
 *   number of digits for the one-time passcode.
 * @return {String} The one-time passcode.
 */

exports.totp = function totpGenerate (options) {
  // shadow options
  options = Object.create(options);

  // calculate default counter value
  if (options.counter == null) options.counter = exports._counter(options);

  // pass to hotp
  return this.hotp(options);
};

// Alias time() for totp()
exports.time = exports.totp;

/**
 * Verify a time-based one-time token against the secret and return the delta.
 * By default, it verifies the token at the current time window, with no leeway
 * (no look-ahead or look-behind). A token validated at the current time window
 * will have a delta of 0.
 *
 * You can specify a window to add more leeway to the verification process.
 * Setting the window param will check for the token at the given counter value
 * as well as `window` tokens ahead and `window` tokens behind (two-sided
 * window). See param for more info.
 *
 * `verifyDelta()` will return the delta between the counter value of the token
 * and the given counter value. For example, if given a time at counter 1000 and
 * a window of 5, `verifyDelta()` will look at tokens from 995 to 1005,
 * inclusive. In other words, if the time-step is 30 seconds, it will look at
 * tokens from 2.5 minutes ago to 2.5 minutes in the future, inclusive.
 * If it finds it at counter position 1002, it will return `{ delta: 2 }`.
 * If it finds it at counter position 997, it will return `{ delta: -3 }`.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {String} options.token Passcode to validate
 * @param {Integer} [options.time] Time in seconds with which to calculate
 *   counter value. Defaults to `Date.now()`.
 * @param {Integer} [options.step=30] Time step in seconds
 * @param {Integer} [options.epoch=0] Initial time in seconds since the UNIX
 *   epoch from which to calculate the counter value. Defaults to 0 (no offset).
 * @param {Integer} [options.counter] Counter value, calculated by default.
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode.
 * @param {Integer} [options.window=0] The allowable margin for the counter.
 *   The function will check "W" codes in the future and the past against the
 *   provided passcode, e.g. if W = 5, and C = 1000, this function will check
 *   the passcode against all One Time Passcodes between 995 and 1005,
 *   inclusive.
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @return {Object} On success, returns an object with the time step
 *   difference between the client and the server as the `delta` property (e.g.
 *   `{ delta: 0 }`).
 * @method totp․verifyDelta
 * @global
 */

exports.totp.verifyDelta = function totpVerifyDelta (options) {
  // shadow options
  options = Object.create(options);

  // unpack options
  var window = parseInt(options.window, 10) || 0;

  // calculate default counter value
  if (options.counter == null) options.counter = exports._counter(options);

  // adjust for two-sided window
  options.counter -= window;
  options.window += window;

  // pass to hotp.verifyDelta
  var delta = exports.hotp.verifyDelta(options);

  // adjust for two-sided window
  if (delta) {
    delta.delta -= window;
  }

  return delta;
};

/**
 * Verify a time-based one-time token against the secret and return true if it
 * verifies. Helper function for verifyDelta() that returns a boolean instead of
 * an object. For more on how to use a window with this, see
 * {@link totp.verifyDelta}.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {String} options.token Passcode to validate
 * @param {Integer} [options.time] Time in seconds with which to calculate
 *   counter value. Defaults to `Date.now()`.
 * @param {Integer} [options.step=30] Time step in seconds
 * @param {Integer} [options.epoch=0] Initial time in seconds  since the UNIX
 *   epoch from which to calculate the counter value. Defaults to 0 (no offset).
 * @param {Integer} [options.counter] Counter value, calculated by default.
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode.
 * @param {Integer} [options.window=0] The allowable margin for the counter.
 *   The function will check "W" codes in the future and the past against the
 *   provided passcode, e.g. if W = 5, and C = 1000, this function will check
 *   the passcode against all One Time Passcodes between 995 and 1005,
 *   inclusive.
 * @param {String} [options.encoding="ascii"] Key encoding (ascii, hex,
 *   base32, base64).
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @return {Boolean} Returns true if the token matches within the given
 *   window, false otherwise.
 * @method totp․verify
 * @global
 */
exports.totp.verify = function totpVerify (options) {
  return exports.totp.verifyDelta(options) != null;
};

/**
 * @typedef GeneratedSecret
 * @type Object
 * @property {String} ascii ASCII representation of the secret
 * @property {String} hex Hex representation of the secret
 * @property {String} base32 Base32 representation of the secret
 * @property {String} qr_code_ascii URL for the QR code for the ASCII secret.
 * @property {String} qr_code_hex URL for the QR code for the hex secret.
 * @property {String} qr_code_base32 URL for the QR code for the base32 secret.
 * @property {String} google_auth_qr URL for the Google Authenticator otpauth
 *   URL's QR code.
 * @property {String} otpauth_url Google Authenticator-compatible otpauth URL.
 */

/**
 * Generates a random secret with the set A-Z a-z 0-9 and symbols, of any length
 * (default 32). Returns the secret key in ASCII, hexadecimal, and base32 format,
 * along with the URL used for the QR code for Google Authenticator (an otpauth
 * URL). Use a QR code library to generate a QR code based on the Google
 * Authenticator URL to obtain a QR code you can scan into the app.
 *
 * @param {Object} options
 * @param {Integer} [options.length=32] Length of the secret
 * @param {Boolean} [options.symbols=false] Whether to include symbols
 * @param {Boolean} [options.otpauth_url=true] Whether to output a Google
 *   Authenticator-compatible otpauth:// URL (only returns otpauth:// URL, no
 *   QR code)
 * @param {String} [options.name] The name to use with Google Authenticator.
 * @param {Boolean} [options.qr_codes=false] (DEPRECATED. Do not use to prevent
 *   leaking of secret to a third party. Use your own QR code implementation.)
 *   Output QR code URLs for the token.
 * @param {Boolean} [options.google_auth_qr=false] (DEPRECATED. Do not use to
 *   prevent leaking of secret to a third party. Use your own QR code
 *   implementation.) Output a Google Authenticator otpauth:// QR code URL.
 * @return {Object}
 * @return {GeneratedSecret} The generated secret key.
 */
exports.generateSecret = function generateSecret (options) {
  // options
  if (!options) options = {};
  var length = options.length || 32;
  var name = encodeURIComponent(options.name || 'SecretKey');
  var qr_codes = options.qr_codes || false;
  var google_auth_qr = options.google_auth_qr || false;
  var otpauth_url = options.otpauth_url != null ? options.otpauth_url : true;
  var symbols = true;

  // turn off symbols only when explicity told to
  if (options.symbols !== undefined && options.symbols === false) {
    symbols = false;
  }

  // generate an ascii key
  var key = this.generateSecretASCII(length, symbols);

  // return a SecretKey with ascii, hex, and base32
  var SecretKey = {};
  SecretKey.ascii = key;
  SecretKey.hex = Buffer(key, 'ascii').toString('hex');
  SecretKey.base32 = base32.encode(Buffer(key)).toString().replace(/=/g, '');

  // generate some qr codes if requested
  if (qr_codes) {
    console.warn('Speakeasy - Deprecation Notice - generateSecret() QR codes are deprecated and no longer supported. Please use your own QR code implementation.');
    SecretKey.qr_code_ascii = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(SecretKey.ascii);
    SecretKey.qr_code_hex = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(SecretKey.hex);
    SecretKey.qr_code_base32 = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(SecretKey.base32);
  }

  // add in the Google Authenticator-compatible otpauth URL
  if (otpauth_url) {
    SecretKey.otpauth_url = exports.otpauthURL({
      secret: SecretKey.ascii,
      label: name
    });
  }

  // generate a QR code for use in Google Authenticator if requested
  if (google_auth_qr) {
    console.warn('Speakeasy - Deprecation Notice - generateSecret() Google Auth QR code is deprecated and no longer supported. Please use your own QR code implementation.');
    SecretKey.google_auth_qr = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(exports.otpauthURL({ secret: SecretKey.base32, label: name }));
  }

  return SecretKey;
};

// Backwards compatibility - generate_key is deprecated
exports.generate_key = util.deprecate(function (options) {
  return exports.generateSecret(options);
}, 'Speakeasy - Deprecation Notice - `generate_key()` is depreciated, please use `generateSecret()` instead.');

/**
 * Generates a key of a certain length (default 32) from A-Z, a-z, 0-9, and
 * symbols (if requested).
 *
 * @param  {Integer} [length=32]  The length of the key.
 * @param  {Boolean} [symbols=false] Whether to include symbols in the key.
 * @return {String} The generated key.
 */
exports.generateSecretASCII = function generateSecretASCII (length, symbols) {
  var bytes = crypto.randomBytes(length || 32);
  var set = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
  if (symbols) {
    set += '!@#$%^&*()<>?/[]{},.:;';
  }

  var output = '';
  for (var i = 0, l = bytes.length; i < l; i++) {
    output += set[Math.floor(bytes[i] / 255.0 * (set.length - 1))];
  }
  return output;
};

// Backwards compatibility - generate_key_ascii is deprecated
exports.generate_key_ascii = util.deprecate(function (length, symbols) {
  return exports.generateSecretASCII(length, symbols);
}, 'Speakeasy - Deprecation Notice - `generate_key_ascii()` is depreciated, please use `generateSecretASCII()` instead.');

/**
 * Generate a Google Authenticator-compatible otpauth:// URL for passing the
 * secret to a mobile device to install the secret.
 *
 * Authenticator considers TOTP codes valid for 30 seconds. Additionally,
 * the app presents 6 digits codes to the user. According to the
 * documentation, the period and number of digits are currently ignored by
 * the app.
 *
 * To generate a suitable QR Code, pass the generated URL to a QR Code
 * generator, such as the `qr-image` module.
 *
 * @param {Object} options
 * @param {String} options.secret Shared secret key
 * @param {String} options.label Used to identify the account with which
 *   the secret key is associated, e.g. the user's email address.
 * @param {String} [options.type="totp"] Either "hotp" or "totp".
 * @param {Integer} [options.counter] The initial counter value, required
 *   for HOTP.
 * @param {String} [options.issuer] The provider or service with which the
 *   secret key is associated.
 * @param {String} [options.algorithm="sha1"] Hash algorithm (sha1, sha256,
 *   sha512).
 * @param {Integer} [options.digits=6] The number of digits for the one-time
 *   passcode. Currently ignored by Google Authenticator.
 * @param {Integer} [options.period=30] The length of time for which a TOTP
 *   code will be valid, in seconds. Currently ignored by Google
 *   Authenticator.
 * @param {String} [options.encoding] Key encoding (ascii, hex, base32,
 *   base64). If the key is not encoded in Base-32, it will be reencoded.
 * @return {String} A URL suitable for use with the Google Authenticator.
 * @throws Error if secret or label is missing, or if hotp is used and a
    counter is missing, if the type is not one of `hotp` or `totp`, if the
    number of digits is non-numeric, or an invalid period is used. Warns if
    the number of digits is not either 6 or 8 (though 6 is the only one
    supported by Google Authenticator), and if the hashihng algorithm is
    not one of the supported SHA1, SHA256, or SHA512.
 * @see https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 */

exports.otpauthURL = function otpauthURL (options) {
  // unpack options
  var secret = options.secret;
  var label = options.label;
  var issuer = options.issuer;
  var type = (options.type || 'totp').toLowerCase();
  var counter = options.counter;
  var algorithm = options.algorithm;
  var digits = options.digits;
  var period = options.period;
  var encoding = options.encoding || 'ascii';

  // validate type
  switch (type) {
    case 'totp':
    case 'hotp':
      break;
    default:
      throw new Error('Speakeasy - otpauthURL - Invalid type `' + type + '`; must be `hotp` or `totp`');
  }

  // validate required options
  if (!secret) throw new Error('Speakeasy - otpauthURL - Missing secret');
  if (!label) throw new Error('Speakeasy - otpauthURL - Missing label');

  // require counter for HOTP
  if (type === 'hotp' && (counter === null || typeof counter === 'undefined')) {
    throw new Error('Speakeasy - otpauthURL - Missing counter value for HOTP');
  }

  // convert secret to base32
  if (encoding !== 'base32') secret = new Buffer(secret, encoding);
  if (Buffer.isBuffer(secret)) secret = base32.encode(secret);

  // build query while validating
  var query = {secret: secret};
  if (issuer) query.issuer = issuer;

  // validate algorithm
  if (algorithm != null) {
    switch (algorithm.toUpperCase()) {
      case 'SHA1':
      case 'SHA256':
      case 'SHA512':
        break;
      default:
        console.warn('Speakeasy - otpauthURL - Warning - Algorithm generally should be SHA1, SHA256, or SHA512');
    }
    query.algorithm = algorithm.toUpperCase();
  }

  // validate digits
  if (digits != null) {
    if (isNaN(digits)) {
      throw new Error('Speakeasy - otpauthURL - Invalid digits `' + digits + '`');
    } else {
      switch (parseInt(digits, 10)) {
        case 6:
        case 8:
          break;
        default:
          console.warn('Speakeasy - otpauthURL - Warning - Digits generally should be either 6 or 8');
      }
    }
    query.digits = digits;
  }

  // validate period
  if (period != null) {
    period = parseInt(period, 10);
    if (~~period !== period) {
      throw new Error('Speakeasy - otpauthURL - Invalid period `' + period + '`');
    }
    query.period = period;
  }

  // return url
  return url.format({
    protocol: 'otpauth',
    slashes: true,
    hostname: type,
    pathname: label,
    query: query
  });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:2fa/server/lib/totp.js");
require("./node_modules/meteor/rocketchat:2fa/server/methods/checkCodesRemaining.js");
require("./node_modules/meteor/rocketchat:2fa/server/methods/disable.js");
require("./node_modules/meteor/rocketchat:2fa/server/methods/enable.js");
require("./node_modules/meteor/rocketchat:2fa/server/methods/regenerateCodes.js");
require("./node_modules/meteor/rocketchat:2fa/server/methods/validateTempToken.js");
require("./node_modules/meteor/rocketchat:2fa/server/models/users.js");
require("./node_modules/meteor/rocketchat:2fa/server/loginHandler.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:2fa'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_2fa.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDoyZmEvc2VydmVyL2xpYi90b3RwLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OjJmYS9zZXJ2ZXIvbWV0aG9kcy9jaGVja0NvZGVzUmVtYWluaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OjJmYS9zZXJ2ZXIvbWV0aG9kcy9kaXNhYmxlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OjJmYS9zZXJ2ZXIvbWV0aG9kcy9lbmFibGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6MmZhL3NlcnZlci9tZXRob2RzL3JlZ2VuZXJhdGVDb2Rlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDoyZmEvc2VydmVyL21ldGhvZHMvdmFsaWRhdGVUZW1wVG9rZW4uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6MmZhL3NlcnZlci9tb2RlbHMvdXNlcnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6MmZhL3NlcnZlci9sb2dpbkhhbmRsZXIuanMiXSwibmFtZXMiOlsic3BlYWtlYXN5IiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJSb2NrZXRDaGF0IiwiVE9UUCIsImdlbmVyYXRlU2VjcmV0IiwiZ2VuZXJhdGVPdHBhdXRoVVJMIiwic2VjcmV0IiwidXNlcm5hbWUiLCJvdHBhdXRoVVJMIiwiYXNjaWkiLCJsYWJlbCIsInZlcmlmeSIsInRva2VuIiwiYmFja3VwVG9rZW5zIiwidXNlcklkIiwidmVyaWZpZWQiLCJsZW5ndGgiLCJoYXNoZWRDb2RlIiwiU0hBMjU2IiwidXNlZENvZGUiLCJpbmRleE9mIiwic3BsaWNlIiwibW9kZWxzIiwiVXNlcnMiLCJ1cGRhdGUyRkFCYWNrdXBDb2Rlc0J5VXNlcklkIiwidG90cCIsImVuY29kaW5nIiwiZ2VuZXJhdGVDb2RlcyIsImNvZGVzIiwiaGFzaGVkQ29kZXMiLCJpIiwiY29kZSIsIlJhbmRvbSIsImlkIiwicHVzaCIsIk1ldGVvciIsIm1ldGhvZHMiLCJFcnJvciIsInVzZXIiLCJzZXJ2aWNlcyIsImVuYWJsZWQiLCJyZW1haW5pbmciLCJoYXNoZWRCYWNrdXAiLCJkaXNhYmxlMkZBQnlVc2VySWQiLCJkaXNhYmxlMkZBQW5kU2V0VGVtcFNlY3JldEJ5VXNlcklkIiwiYmFzZTMyIiwidXJsIiwidXNlclRva2VuIiwidGVtcFNlY3JldCIsImVuYWJsZTJGQUFuZFNldFNlY3JldEFuZENvZGVzQnlVc2VySWQiLCJ0ZW1wVG9rZW4iLCJ1cGRhdGUiLCJfaWQiLCIkc2V0IiwiYmFja3VwQ29kZXMiLCIkdW5zZXQiLCJBY2NvdW50cyIsInJlZ2lzdGVyTG9naW5IYW5kbGVyIiwib3B0aW9ucyIsIl9ydW5Mb2dpbkhhbmRsZXJzIiwibG9naW4iLCJjYWxsYmFja3MiLCJhZGQiLCJ0eXBlIiwibWV0aG9kQXJndW1lbnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsU0FBSjtBQUFjQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsV0FBUixDQUFiLEVBQWtDO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxjQUFVSyxDQUFWO0FBQVk7O0FBQXhCLENBQWxDLEVBQTRELENBQTVEO0FBRWRDLFdBQVdDLElBQVgsR0FBa0I7QUFDakJDLGtCQUFpQjtBQUNoQixTQUFPUixVQUFVUSxjQUFWLEVBQVA7QUFDQSxFQUhnQjs7QUFLakJDLG9CQUFtQkMsTUFBbkIsRUFBMkJDLFFBQTNCLEVBQXFDO0FBQ3BDLFNBQU9YLFVBQVVZLFVBQVYsQ0FBcUI7QUFDM0JGLFdBQVFBLE9BQU9HLEtBRFk7QUFFM0JDLFVBQVEsZUFBZUgsUUFBVTtBQUZOLEdBQXJCLENBQVA7QUFJQSxFQVZnQjs7QUFZakJJLFFB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QUVELFFBQU10QixXQUFXYixXQUFXQyxJQUFYLENBQWdCUSxNQUFoQixDQUF1QjtBQUN2Q0wsV0FBUXNELE1BQU10QixJQUFOLENBQVdDLFFBQVgsQ0FBb0JkLElBQXBCLENBQXlCbkIsTUFETTtBQUV2Q00sVUFBT2EsS0FBS00sSUFGMkI7QUFHdkNqQixXQUFROEMsTUFBTXRCLElBQU4sQ0FBV2MsR0FIb0I7QUFJdkN2QyxpQkFBYytDLE1BQU10QixJQUFOLENBQVdDLFFBQVgsQ0FBb0JkLElBQXBCLENBQXlCaUI7QUFKQSxHQUF2QixDQUFqQjs7QUFPQSxNQUFJM0IsYUFBYSxJQUFqQixFQUF1QjtBQUN0QixTQUFNLElBQUlvQixPQUFPRSxLQUFYLENBQWlCLGNBQWpCLEVBQWlDLGNBQWpDLENBQU47QUFDQTtBQUNEO0FBQ0QsQ0FuQkQsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF8yZmEuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgc3BlYWtlYXN5IGZyb20gJ3NwZWFrZWFzeSc7XG5cblJvY2tldENoYXQuVE9UUCA9IHtcblx0Z2VuZXJhdGVTZWNyZXQoKSB7XG5cdFx0cmV0dXJuIHNwZWFrZWFzeS5nZW5lcmF0ZVNlY3JldCgpO1xuXHR9LFxuXG5cdGdlbmVyYXRlT3RwYXV0aFVSTChzZWNyZXQsIHVzZXJuYW1lKSB7XG5cdFx0cmV0dXJuIHNwZWFrZWFzeS5vdHBhdXRoVVJMKHtcblx0XHRcdHNlY3JldDogc2VjcmV0LmFzY2lpLFxuXHRcdFx0bGFiZWw6IGBSb2NrZXQuQ2hhdDokeyB1c2VybmFtZSB9YFxuXHRcdH0pO1xuXHR9LFxuXG5cdHZlcmlmeSh7IHNlY3JldCwgdG9rZW4sIGJhY2t1cFRva2VucywgdXNlcklkIH0pIHtcblx0XHRsZXQgdmVyaWZpZWQ7XG5cblx0XHQvLyB2YWxpZGF0ZXMgYSBiYWNrdXAgY29kZVxuXHRcdGlmICh0b2tlbi5sZW5ndGggPT09IDggJiYgYmFja3VwVG9rZW5zKSB7XG5cdFx0XHRjb25zdCBoYXNoZWRDb2RlID0gU0hBMjU2KHRva2VuKTtcblx0XHRcdGNvbnN0IHVzZWRDb2RlID0gYmFja3VwVG9rZW5zLmluZGV4T2YoaGFzaGVkQ29kZSk7XG5cblx0XHRcdGlmICh1c2VkQ29kZSAhPT0gLTEpIHtcblx0XHRcdFx0dmVyaWZpZWQgPSB0cnVlO1xuXG5cdFx0XHRcdGJhY2t1cFRva2Vucy5zcGxpY2UodXNlZENvZGUsIDEpO1xuXG5cdFx0XHRcdC8vIG1hcmsgdGhlIGNvZGUgYXMgdXNlZCAocmVtb3ZlIGl0IGZyb20gdGhlIGxpc3QpXG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZTJGQUJhY2t1cENvZGVzQnlVc2VySWQodXNlcklkLCBiYWNrdXBUb2tlbnMpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR2ZXJpZmllZCA9IHNwZWFrZWFzeS50b3RwLnZlcmlmeSh7XG5cdFx0XHRcdHNlY3JldCxcblx0XHRcdFx0ZW5jb2Rpbmc6ICdiYXNlMzInLFxuXHRcdFx0XHR0b2tlblxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZlcmlmaWVkO1xuXHR9LFxuXG5cdGdlbmVyYXRlQ29kZXMoKSB7XG5cdFx0Ly8gZ2VuZXJhdGUgMTIgYmFja3VwIGNvZGVzXG5cdFx0Y29uc3QgY29kZXMgPSBbXTtcblx0XHRjb25zdCBoYXNoZWRDb2RlcyA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMTI7IGkrKykge1xuXHRcdFx0Y29uc3QgY29kZSA9IFJhbmRvbS5pZCg4KTtcblx0XHRcdGNvZGVzLnB1c2goY29kZSk7XG5cdFx0XHRoYXNoZWRDb2Rlcy5wdXNoKFNIQTI1Nihjb2RlKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgY29kZXMsIGhhc2hlZENvZGVzIH07XG5cdH1cbn07XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCcyZmE6Y2hlY2tDb2Rlc1JlbWFpbmluZycoKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdC1hdXRob3JpemVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHRpZiAoIXVzZXIuc2VydmljZXMgfHwgIXVzZXIuc2VydmljZXMudG90cCB8fCAhdXNlci5zZXJ2aWNlcy50b3RwLmVuYWJsZWQpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtdG90cCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZW1haW5pbmc6IHVzZXIuc2VydmljZXMudG90cC5oYXNoZWRCYWNrdXAubGVuZ3RoXG5cdFx0fTtcblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCcyZmE6ZGlzYWJsZScoY29kZSkge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3QtYXV0aG9yaXplZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcigpO1xuXG5cdFx0Y29uc3QgdmVyaWZpZWQgPSBSb2NrZXRDaGF0LlRPVFAudmVyaWZ5KHtcblx0XHRcdHNlY3JldDogdXNlci5zZXJ2aWNlcy50b3RwLnNlY3JldCxcblx0XHRcdHRva2VuOiBjb2RlLFxuXHRcdFx0dXNlcklkOiBNZXRlb3IudXNlcklkKCksXG5cdFx0XHRiYWNrdXBUb2tlbnM6IHVzZXIuc2VydmljZXMudG90cC5oYXNoZWRCYWNrdXBcblx0XHR9KTtcblxuXHRcdGlmICghdmVyaWZpZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZGlzYWJsZTJGQUJ5VXNlcklkKE1ldGVvci51c2VySWQoKSk7XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnMmZhOmVuYWJsZScoKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdC1hdXRob3JpemVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHRjb25zdCBzZWNyZXQgPSBSb2NrZXRDaGF0LlRPVFAuZ2VuZXJhdGVTZWNyZXQoKTtcblxuXHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmRpc2FibGUyRkFBbmRTZXRUZW1wU2VjcmV0QnlVc2VySWQoTWV0ZW9yLnVzZXJJZCgpLCBzZWNyZXQuYmFzZTMyKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRzZWNyZXQ6IHNlY3JldC5iYXNlMzIsXG5cdFx0XHR1cmw6IFJvY2tldENoYXQuVE9UUC5nZW5lcmF0ZU90cGF1dGhVUkwoc2VjcmV0LCB1c2VyLnVzZXJuYW1lKVxuXHRcdH07XG5cdH1cbn0pO1xuIiwiTWV0ZW9yLm1ldGhvZHMoe1xuXHQnMmZhOnJlZ2VuZXJhdGVDb2RlcycodXNlclRva2VuKSB7XG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdC1hdXRob3JpemVkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXNlciA9IE1ldGVvci51c2VyKCk7XG5cblx0XHRpZiAoIXVzZXIuc2VydmljZXMgfHwgIXVzZXIuc2VydmljZXMudG90cCB8fCAhdXNlci5zZXJ2aWNlcy50b3RwLmVuYWJsZWQpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtdG90cCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZlcmlmaWVkID0gUm9ja2V0Q2hhdC5UT1RQLnZlcmlmeSh7XG5cdFx0XHRzZWNyZXQ6IHVzZXIuc2VydmljZXMudG90cC5zZWNyZXQsXG5cdFx0XHR0b2tlbjogdXNlclRva2VuLFxuXHRcdFx0dXNlcklkOiBNZXRlb3IudXNlcklkKCksXG5cdFx0XHRiYWNrdXBUb2tlbnM6IHVzZXIuc2VydmljZXMudG90cC5oYXNoZWRCYWNrdXBcblx0XHR9KTtcblxuXHRcdGlmICh2ZXJpZmllZCkge1xuXHRcdFx0Y29uc3QgeyBjb2RlcywgaGFzaGVkQ29kZXMgfSA9IFJvY2tldENoYXQuVE9UUC5nZW5lcmF0ZUNvZGVzKCk7XG5cblx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZTJGQUJhY2t1cENvZGVzQnlVc2VySWQoTWV0ZW9yLnVzZXJJZCgpLCBoYXNoZWRDb2Rlcyk7XG5cdFx0XHRyZXR1cm4geyBjb2RlcyB9O1xuXHRcdH1cblx0fVxufSk7XG4iLCJNZXRlb3IubWV0aG9kcyh7XG5cdCcyZmE6dmFsaWRhdGVUZW1wVG9rZW4nKHVzZXJUb2tlbikge1xuXHRcdGlmICghTWV0ZW9yLnVzZXJJZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3QtYXV0aG9yaXplZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcigpO1xuXG5cdFx0aWYgKCF1c2VyLnNlcnZpY2VzIHx8ICF1c2VyLnNlcnZpY2VzLnRvdHAgfHwgIXVzZXIuc2VydmljZXMudG90cC50ZW1wU2VjcmV0KSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdpbnZhbGlkLXRvdHAnKTtcblx0XHR9XG5cblx0XHRjb25zdCB2ZXJpZmllZCA9IFJvY2tldENoYXQuVE9UUC52ZXJpZnkoe1xuXHRcdFx0c2VjcmV0OiB1c2VyLnNlcnZpY2VzLnRvdHAudGVtcFNlY3JldCxcblx0XHRcdHRva2VuOiB1c2VyVG9rZW5cblx0XHR9KTtcblxuXHRcdGlmICh2ZXJpZmllZCkge1xuXHRcdFx0Y29uc3QgeyBjb2RlcywgaGFzaGVkQ29kZXMgfSA9IFJvY2tldENoYXQuVE9UUC5nZW5lcmF0ZUNvZGVzKCk7XG5cblx0XHRcdFJvY2tldENoYXQubW9kZWxzLlVzZXJzLmVuYWJsZTJGQUFuZFNldFNlY3JldEFuZENvZGVzQnlVc2VySWQoTWV0ZW9yLnVzZXJJZCgpLCB1c2VyLnNlcnZpY2VzLnRvdHAudGVtcFNlY3JldCwgaGFzaGVkQ29kZXMpO1xuXHRcdFx0cmV0dXJuIHsgY29kZXMgfTtcblx0XHR9XG5cdH1cbn0pO1xuIiwiUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZGlzYWJsZTJGQUFuZFNldFRlbXBTZWNyZXRCeVVzZXJJZCA9IGZ1bmN0aW9uKHVzZXJJZCwgdGVtcFRva2VuKSB7XG5cdHJldHVybiB0aGlzLnVwZGF0ZSh7XG5cdFx0X2lkOiB1c2VySWRcblx0fSwge1xuXHRcdCRzZXQ6IHtcblx0XHRcdCdzZXJ2aWNlcy50b3RwJzoge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZSxcblx0XHRcdFx0dGVtcFNlY3JldDogdGVtcFRva2VuXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLmVuYWJsZTJGQUFuZFNldFNlY3JldEFuZENvZGVzQnlVc2VySWQgPSBmdW5jdGlvbih1c2VySWQsIHNlY3JldCwgYmFja3VwQ29kZXMpIHtcblx0cmV0dXJuIHRoaXMudXBkYXRlKHtcblx0XHRfaWQ6IHVzZXJJZFxuXHR9LCB7XG5cdFx0JHNldDoge1xuXHRcdFx0J3NlcnZpY2VzLnRvdHAuZW5hYmxlZCc6IHRydWUsXG5cdFx0XHQnc2VydmljZXMudG90cC5zZWNyZXQnOiBzZWNyZXQsXG5cdFx0XHQnc2VydmljZXMudG90cC5oYXNoZWRCYWNrdXAnOiBiYWNrdXBDb2Rlc1xuXHRcdH0sXG5cdFx0JHVuc2V0OiB7XG5cdFx0XHQnc2VydmljZXMudG90cC50ZW1wU2VjcmV0JzogMVxuXHRcdH1cblx0fSk7XG59O1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5Vc2Vycy5kaXNhYmxlMkZBQnlVc2VySWQgPSBmdW5jdGlvbih1c2VySWQpIHtcblx0cmV0dXJuIHRoaXMudXBkYXRlKHtcblx0XHRfaWQ6IHVzZXJJZFxuXHR9LCB7XG5cdFx0JHNldDoge1xuXHRcdFx0J3NlcnZpY2VzLnRvdHAnOiB7XG5cdFx0XHRcdGVuYWJsZWQ6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLlVzZXJzLnVwZGF0ZTJGQUJhY2t1cENvZGVzQnlVc2VySWQgPSBmdW5jdGlvbih1c2VySWQsIGJhY2t1cENvZGVzKSB7XG5cdHJldHVybiB0aGlzLnVwZGF0ZSh7XG5cdFx0X2lkOiB1c2VySWRcblx0fSwge1xuXHRcdCRzZXQ6IHtcblx0XHRcdCdzZXJ2aWNlcy50b3RwLmhhc2hlZEJhY2t1cCc6IGJhY2t1cENvZGVzXG5cdFx0fVxuXHR9KTtcbn07XG4iLCJBY2NvdW50cy5yZWdpc3RlckxvZ2luSGFuZGxlcigndG90cCcsIGZ1bmN0aW9uKG9wdGlvbnMpIHtcblx0aWYgKCFvcHRpb25zLnRvdHAgfHwgIW9wdGlvbnMudG90cC5jb2RlKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIEFjY291bnRzLl9ydW5Mb2dpbkhhbmRsZXJzKHRoaXMsIG9wdGlvbnMudG90cC5sb2dpbik7XG59KTtcblxuUm9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdvblZhbGlkYXRlTG9naW4nLCAobG9naW4pID0+IHtcblx0aWYgKGxvZ2luLnR5cGUgPT09ICdwYXNzd29yZCcgJiYgbG9naW4udXNlci5zZXJ2aWNlcyAmJiBsb2dpbi51c2VyLnNlcnZpY2VzLnRvdHAgJiYgbG9naW4udXNlci5zZXJ2aWNlcy50b3RwLmVuYWJsZWQgPT09IHRydWUpIHtcblx0XHRjb25zdCB7IHRvdHAgfSA9IGxvZ2luLm1ldGhvZEFyZ3VtZW50c1swXTtcblxuXHRcdGlmICghdG90cCB8fCAhdG90cC5jb2RlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCd0b3RwLXJlcXVpcmVkJywgJ1RPVFAgUmVxdWlyZWQnKTtcblx0XHR9XG5cblx0XHRjb25zdCB2ZXJpZmllZCA9IFJvY2tldENoYXQuVE9UUC52ZXJpZnkoe1xuXHRcdFx0c2VjcmV0OiBsb2dpbi51c2VyLnNlcnZpY2VzLnRvdHAuc2VjcmV0LFxuXHRcdFx0dG9rZW46IHRvdHAuY29kZSxcblx0XHRcdHVzZXJJZDogbG9naW4udXNlci5faWQsXG5cdFx0XHRiYWNrdXBUb2tlbnM6IGxvZ2luLnVzZXIuc2VydmljZXMudG90cC5oYXNoZWRCYWNrdXBcblx0XHR9KTtcblxuXHRcdGlmICh2ZXJpZmllZCAhPT0gdHJ1ZSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcigndG90cC1pbnZhbGlkJywgJ1RPVFAgSW52YWxpZCcpO1xuXHRcdH1cblx0fVxufSk7XG4iXX0=
