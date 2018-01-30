(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
var FlowRouter = Package['kadira:flow-router'].FlowRouter;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var Mailer;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:mailer":{"lib":{"Mailer.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/lib/Mailer.js                                                              //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
Mailer = {}; //eslint-disable-line
///////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"startup.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/server/startup.js                                                          //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
Meteor.startup(function () {
	return RocketChat.models.Permissions.upsert('access-mailer', {
		$setOnInsert: {
			_id: 'access-mailer',
			roles: ['admin']
		}
	});
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////

},"models":{"Users.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/server/models/Users.js                                                     //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
RocketChat.models.Users.rocketMailUnsubscribe = function (_id, createdAt) {
	const query = {
		_id,
		createdAt: new Date(parseInt(createdAt))
	};
	const update = {
		$set: {
			'mailer.unsubscribed': true
		}
	};
	const affectedRows = this.update(query, update);
	console.log('[Mailer:Unsubscribe]', _id, createdAt, new Date(parseInt(createdAt)), affectedRows);
	return affectedRows;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"functions":{"sendMail.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/server/functions/sendMail.js                                               //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
/*globals Mailer */Mailer.sendMail = function (from, subject, body, dryrun, query) {
	const rfcMailPatternWithName = /^(?:.*<)?([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)(?:>?)$/;

	if (!rfcMailPatternWithName.test(from)) {
		throw new Meteor.Error('error-invalid-from-address', 'Invalid from address', {
			'function': 'Mailer.sendMail'
		});
	}

	if (body.indexOf('[unsubscribe]') === -1) {
		throw new Meteor.Error('error-missing-unsubscribe-link', 'You must provide the [unsubscribe] link.', {
			'function': 'Mailer.sendMail'
		});
	}

	const header = RocketChat.placeholders.replace(RocketChat.settings.get('Email_Header') || '');
	const footer = RocketChat.placeholders.replace(RocketChat.settings.get('Email_Footer') || '');
	let userQuery = {
		'mailer.unsubscribed': {
			$exists: 0
		}
	};

	if (query) {
		userQuery = {
			$and: [userQuery, EJSON.parse(query)]
		};
	}

	if (dryrun) {
		return Meteor.users.find({
			'emails.address': from
		}).forEach(user => {
			let email = undefined;

			if (user.emails && user.emails[0] && user.emails[0].address) {
				email = user.emails[0].address;
			}

			const html = RocketChat.placeholders.replace(body, {
				unsubscribe: Meteor.absoluteUrl(FlowRouter.path('mailer/unsubscribe/:_id/:createdAt', {
					_id: user._id,
					createdAt: user.createdAt.getTime()
				})),
				name: user.name,
				email
			});
			email = `${user.name} <${email}>`;

			if (rfcMailPatternWithName.test(email)) {
				Meteor.defer(function () {
					return Email.send({
						to: email,
						from,
						subject,
						html: header + html + footer
					});
				});
				return console.log(`Sending email to ${email}`);
			}
		});
	} else {
		return Meteor.users.find(userQuery).forEach(function (user) {
			let email = undefined;

			if (user.emails && user.emails[0] && user.emails[0].address) {
				email = user.emails[0].address;
			}

			const html = RocketChat.placeholders.replace(body, {
				unsubscribe: Meteor.absoluteUrl(FlowRouter.path('mailer/unsubscribe/:_id/:createdAt', {
					_id: user._id,
					createdAt: user.createdAt.getTime()
				})),
				name: user.name,
				email
			});
			email = `${user.name} <${email}>`;

			if (rfcMailPatternWithName.test(email)) {
				Meteor.defer(function () {
					return Email.send({
						to: email,
						from,
						subject,
						html: header + html + footer
					});
				});
				return console.log(`Sending email to ${email}`);
			}
		});
	}
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////

},"unsubscribe.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/server/functions/unsubscribe.js                                            //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
/* globals Mailer */Mailer.unsubscribe = function (_id, createdAt) {
	if (_id && createdAt) {
		return RocketChat.models.Users.rocketMailUnsubscribe(_id, createdAt) === 1;
	}

	return false;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"methods":{"sendMail.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/server/methods/sendMail.js                                                 //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
/*globals Mailer */Meteor.methods({
	'Mailer.sendMail'(from, subject, body, dryrun, query) {
		const userId = Meteor.userId();

		if (!userId) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'Mailer.sendMail'
			});
		}

		if (RocketChat.authz.hasRole(userId, 'admin') !== true) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'Mailer.sendMail'
			});
		}

		return Mailer.sendMail(from, subject, body, dryrun, query);
	}

}); //Limit setting username once per minute
//DDPRateLimiter.addRule
//	type: 'method'
//	name: 'Mailer.sendMail'
//	connectionId: -> return true
//	, 1, 60000
///////////////////////////////////////////////////////////////////////////////////////////////////////////

},"unsubscribe.js":function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                       //
// packages/rocketchat_mailer/server/methods/unsubscribe.js                                              //
//                                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                         //
/*globals Mailer */Meteor.methods({
	'Mailer:unsubscribe'(_id, createdAt) {
		return Mailer.unsubscribe(_id, createdAt);
	}

});
DDPRateLimiter.addRule({
	type: 'method',
	name: 'Mailer:unsubscribe',

	connectionId() {
		return true;
	}

}, 1, 60000);
///////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:mailer/lib/Mailer.js");
require("./node_modules/meteor/rocketchat:mailer/server/startup.js");
require("./node_modules/meteor/rocketchat:mailer/server/models/Users.js");
require("./node_modules/meteor/rocketchat:mailer/server/functions/sendMail.js");
require("./node_modules/meteor/rocketchat:mailer/server/functions/unsubscribe.js");
require("./node_modules/meteor/rocketchat:mailer/server/methods/sendMail.js");
require("./node_modules/meteor/rocketchat:mailer/server/methods/unsubscribe.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:mailer'] = {}, {
  Mailer: Mailer
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_mailer.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYWlsZXIvbGliL01haWxlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYWlsZXIvc2VydmVyL3N0YXJ0dXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWFpbGVyL3NlcnZlci9tb2RlbHMvVXNlcnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWFpbGVyL3NlcnZlci9mdW5jdGlvbnMvc2VuZE1haWwuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWFpbGVyL3NlcnZlci9mdW5jdGlvbnMvdW5zdWJzY3JpYmUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWFpbGVyL3NlcnZlci9tZXRob2RzL3NlbmRNYWlsLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0Om1haWxlci9zZXJ2ZXIvbWV0aG9kcy91bnN1YnNjcmliZS5qcyJdLCJuYW1lcyI6WyJNYWlsZXIiLCJNZXRlb3IiLCJzdGFydHVwIiwiUm9ja2V0Q2hhdCIsIm1vZGVscyIsIlBlcm1pc3Npb25zIiwidXBzZXJ0IiwiJHNldE9uSW5zZXJ0IiwiX2lkIiwicm9sZXMiLCJVc2VycyIsInJvY2tldE1haWxVbnN1YnNjcmliZSIsImNyZWF0ZWRBdCIsInF1ZXJ5IiwiRGF0ZSIsInBhcnNlSW50IiwidXBkYXRlIiwiJHNldCIsImFmZmVjdGVkUm93cyIsImNvbnNvbGUiLCJsb2ciLCJzZW5kTWFpbCIsImZyb20iLCJzdWJqZWN0IiwiYm9keSIsImRyeXJ1biIsInJmY01haWxQYXR0ZXJuV2l0aE5hbWUiLCJ0ZXN0IiwiRXJyb3IiLCJpbmRleE9mIiwiaGVhZGVyIiwicGxhY2Vob2xkZXJzIiwicmVwbGFjZSIsInNldHRpbmdzIiwiZ2V0IiwiZm9vdGVyIiwidXNlclF1ZXJ5IiwiJGV4aXN0cyIsIiRhbmQiLCJFSlNPTiIsInBhcnNlIiwidXNlcnMiLCJmaW5kIiwiZm9yRWFjaCIsInVzZXIiLCJlbWFpbCIsInVuZGVmaW5lZCIsImVtYWlscyIsImFkZHJlc3MiLCJodG1sIiwidW5zdWJzY3JpYmUiLCJhYnNvbHV0ZVVybCIsIkZsb3dSb3V0ZXIiLCJwYXRoIiwiZ2V0VGltZSIsIm5hbWUiLCJkZWZlciIsIkVtYWlsIiwic2VuZCIsInRvIiwibWV0aG9kcyIsInVzZXJJZCIsIm1ldGhvZCIsImF1dGh6IiwiaGFzUm9sZSIsIkREUFJhdGVMaW1pdGVyIiwiYWRkUnVsZSIsInR5cGUiLCJjb25uZWN0aW9uSWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxTQUFTLEVBQVQsQyxDQUFZLHFCOzs7Ozs7Ozs7OztBQ0FaQyxPQUFPQyxPQUFQLENBQWUsWUFBVztBQUN6QixRQUFPQyxXQUFXQyxNQUFYLENBQWtCQyxXQUFsQixDQUE4QkMsTUFBOUIsQ0FBcUMsZUFBckMsRUFBc0Q7QUFDNURDLGdCQUFjO0FBQ2JDLFFBQUssZUFEUTtBQUViQyxVQUFPLENBQUMsT0FBRDtBQUZNO0FBRDhDLEVBQXRELENBQVA7QUFNQSxDQVBELEU7Ozs7Ozs7Ozs7O0FDQUFOLFdBQVdDLE1BQVgsQ0FBa0JNLEtBQWxCLENBQXdCQyxxQkFBeEIsR0FBZ0QsVUFBU0gsR0FBVCxFQUFjSSxTQUFkLEVBQXlCO0FBQ3hFLE9BQU1DLFFBQVE7QUFDYkwsS0FEYTtBQUViSSxhQUFXLElBQUlFLElBQUosQ0FBU0MsU0FBU0gsU0FBVCxDQUFUO0FBRkUsRUFBZDtBQUlBLE9BQU1JLFNBQVM7QUFDZEMsUUFBTTtBQUNMLDBCQUF1QjtBQURsQjtBQURRLEVBQWY7QUFLQSxPQUFNQyxlQUFlLEtBQUtGLE1BQUwsQ0FBWUgsS0FBWixFQUFtQkcsTUFBbkIsQ0FBckI7QUFDQUcsU0FBUUMsR0FBUixDQUFZLHNCQUFaLEVBQW9DWixHQUFwQyxFQUF5Q0ksU0FB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a0QsV0FBUCxDQUFtQjFDLEdBQW5CLEVBQXdCSSxTQUF4QixDQUFQO0FBQ0E7O0FBSGEsQ0FBZjtBQU1BcUQsZUFBZUMsT0FBZixDQUF1QjtBQUN0QkMsT0FBTSxRQURnQjtBQUV0QlosT0FBTSxvQkFGZ0I7O0FBR3RCYSxnQkFBZTtBQUNkLFNBQU8sSUFBUDtBQUNBOztBQUxxQixDQUF2QixFQU1HLENBTkgsRUFNTSxLQU5OLEUiLCJmaWxlIjoiL3BhY2thZ2VzL3JvY2tldGNoYXRfbWFpbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiTWFpbGVyID0ge307Ly9lc2xpbnQtZGlzYWJsZS1saW5lXG4iLCJNZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcblx0cmV0dXJuIFJvY2tldENoYXQubW9kZWxzLlBlcm1pc3Npb25zLnVwc2VydCgnYWNjZXNzLW1haWxlcicsIHtcblx0XHQkc2V0T25JbnNlcnQ6IHtcblx0XHRcdF9pZDogJ2FjY2Vzcy1tYWlsZXInLFxuXHRcdFx0cm9sZXM6IFsnYWRtaW4nXVxuXHRcdH1cblx0fSk7XG59KTtcbiIsIlJvY2tldENoYXQubW9kZWxzLlVzZXJzLnJvY2tldE1haWxVbnN1YnNjcmliZSA9IGZ1bmN0aW9uKF9pZCwgY3JlYXRlZEF0KSB7XG5cdGNvbnN0IHF1ZXJ5ID0ge1xuXHRcdF9pZCxcblx0XHRjcmVhdGVkQXQ6IG5ldyBEYXRlKHBhcnNlSW50KGNyZWF0ZWRBdCkpXG5cdH07XG5cdGNvbnN0IHVwZGF0ZSA9IHtcblx0XHQkc2V0OiB7XG5cdFx0XHQnbWFpbGVyLnVuc3Vic2NyaWJlZCc6IHRydWVcblx0XHR9XG5cdH07XG5cdGNvbnN0IGFmZmVjdGVkUm93cyA9IHRoaXMudXBkYXRlKHF1ZXJ5LCB1cGRhdGUpO1xuXHRjb25zb2xlLmxvZygnW01haWxlcjpVbnN1YnNjcmliZV0nLCBfaWQsIGNyZWF0ZWRBdCwgbmV3IERhdGUocGFyc2VJbnQoY3JlYXRlZEF0KSksIGFmZmVjdGVkUm93cyk7XG5cdHJldHVybiBhZmZlY3RlZFJvd3M7XG59O1xuIiwiLypnbG9iYWxzIE1haWxlciAqL1xuTWFpbGVyLnNlbmRNYWlsID0gZnVuY3Rpb24oZnJvbSwgc3ViamVjdCwgYm9keSwgZHJ5cnVuLCBxdWVyeSkge1xuXG5cdGNvbnN0IHJmY01haWxQYXR0ZXJuV2l0aE5hbWUgPSAvXig/Oi4qPCk/KFthLXpBLVowLTkuISMkJSYnKitcXC89P15fYHt8fX4tXStAW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KD86XFwuW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KSopKD86Pj8pJC87XG5cdGlmICghcmZjTWFpbFBhdHRlcm5XaXRoTmFtZS50ZXN0KGZyb20pKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC1mcm9tLWFkZHJlc3MnLCAnSW52YWxpZCBmcm9tIGFkZHJlc3MnLCB7XG5cdFx0XHQnZnVuY3Rpb24nOiAnTWFpbGVyLnNlbmRNYWlsJ1xuXHRcdH0pO1xuXHR9XG5cdGlmIChib2R5LmluZGV4T2YoJ1t1bnN1YnNjcmliZV0nKSA9PT0gLTEpIHtcblx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1taXNzaW5nLXVuc3Vic2NyaWJlLWxpbmsnLCAnWW91IG11c3QgcHJvdmlkZSB0aGUgW3Vuc3Vic2NyaWJlXSBsaW5rLicsIHtcblx0XHRcdCdmdW5jdGlvbic6ICdNYWlsZXIuc2VuZE1haWwnXG5cdFx0fSk7XG5cdH1cblx0Y29uc3QgaGVhZGVyID0gUm9ja2V0Q2hhdC5wbGFjZWhvbGRlcnMucmVwbGFjZShSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRW1haWxfSGVhZGVyJykgfHwgJycpO1xuXHRjb25zdCBmb290ZXIgPSBSb2NrZXRDaGF0LnBsYWNlaG9sZGVycy5yZXBsYWNlKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdFbWFpbF9Gb290ZXInKSB8fCAnJyk7XG5cblx0bGV0IHVzZXJRdWVyeSA9IHsgJ21haWxlci51bnN1YnNjcmliZWQnOiB7ICRleGlzdHM6IDAgfSB9O1xuXHRpZiAocXVlcnkpIHtcblx0XHR1c2VyUXVlcnkgPSB7ICRhbmQ6IFsgdXNlclF1ZXJ5LCBFSlNPTi5wYXJzZShxdWVyeSkgXSB9O1xuXHR9XG5cblx0aWYgKGRyeXJ1bikge1xuXHRcdHJldHVybiBNZXRlb3IudXNlcnMuZmluZCh7XG5cdFx0XHQnZW1haWxzLmFkZHJlc3MnOiBmcm9tXG5cdFx0fSkuZm9yRWFjaCgodXNlcikgPT4ge1xuXHRcdFx0bGV0IGVtYWlsID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHVzZXIuZW1haWxzICYmIHVzZXIuZW1haWxzWzBdICYmIHVzZXIuZW1haWxzWzBdLmFkZHJlc3MpIHtcblx0XHRcdFx0ZW1haWwgPSB1c2VyLmVtYWlsc1swXS5hZGRyZXNzO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaHRtbCA9IFJvY2tldENoYXQucGxhY2Vob2xkZXJzLnJlcGxhY2UoYm9keSwge1xuXHRcdFx0XHR1bnN1YnNjcmliZTogTWV0ZW9yLmFic29sdXRlVXJsKEZsb3dSb3V0ZXIucGF0aCgnbWFpbGVyL3Vuc3Vic2NyaWJlLzpfaWQvOmNyZWF0ZWRBdCcsIHtcblx0XHRcdFx0XHRfaWQ6IHVzZXIuX2lkLFxuXHRcdFx0XHRcdGNyZWF0ZWRBdDogdXNlci5jcmVhdGVkQXQuZ2V0VGltZSgpXG5cdFx0XHRcdH0pKSxcblx0XHRcdFx0bmFtZTogdXNlci5uYW1lLFxuXHRcdFx0XHRlbWFpbFxuXHRcdFx0fSk7XG5cdFx0XHRlbWFpbCA9IGAkeyB1c2VyLm5hbWUgfSA8JHsgZW1haWwgfT5gO1xuXHRcdFx0aWYgKHJmY01haWxQYXR0ZXJuV2l0aE5hbWUudGVzdChlbWFpbCkpIHtcblx0XHRcdFx0TWV0ZW9yLmRlZmVyKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHJldHVybiBFbWFpbC5zZW5kKHtcblx0XHRcdFx0XHRcdHRvOiBlbWFpbCxcblx0XHRcdFx0XHRcdGZyb20sXG5cdFx0XHRcdFx0XHRzdWJqZWN0LFxuXHRcdFx0XHRcdFx0aHRtbDogaGVhZGVyICsgaHRtbCArIGZvb3RlclxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIGNvbnNvbGUubG9nKGBTZW5kaW5nIGVtYWlsIHRvICR7IGVtYWlsIH1gKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gTWV0ZW9yLnVzZXJzLmZpbmQodXNlclF1ZXJ5KS5mb3JFYWNoKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHRcdGxldCBlbWFpbCA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICh1c2VyLmVtYWlscyAmJiB1c2VyLmVtYWlsc1swXSAmJiB1c2VyLmVtYWlsc1swXS5hZGRyZXNzKSB7XG5cdFx0XHRcdGVtYWlsID0gdXNlci5lbWFpbHNbMF0uYWRkcmVzcztcblx0XHRcdH1cblx0XHRcdGNvbnN0IGh0bWwgPSBSb2NrZXRDaGF0LnBsYWNlaG9sZGVycy5yZXBsYWNlKGJvZHksIHtcblx0XHRcdFx0dW5zdWJzY3JpYmU6IE1ldGVvci5hYnNvbHV0ZVVybChGbG93Um91dGVyLnBhdGgoJ21haWxlci91bnN1YnNjcmliZS86X2lkLzpjcmVhdGVkQXQnLCB7XG5cdFx0XHRcdFx0X2lkOiB1c2VyLl9pZCxcblx0XHRcdFx0XHRjcmVhdGVkQXQ6IHVzZXIuY3JlYXRlZEF0LmdldFRpbWUoKVxuXHRcdFx0XHR9KSksXG5cdFx0XHRcdG5hbWU6IHVzZXIubmFtZSxcblx0XHRcdFx0ZW1haWxcblx0XHRcdH0pO1xuXHRcdFx0ZW1haWwgPSBgJHsgdXNlci5uYW1lIH0gPCR7IGVtYWlsIH0+YDtcblx0XHRcdGlmIChyZmNNYWlsUGF0dGVybldpdGhOYW1lLnRlc3QoZW1haWwpKSB7XG5cdFx0XHRcdE1ldGVvci5kZWZlcihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRyZXR1cm4gRW1haWwuc2VuZCh7XG5cdFx0XHRcdFx0XHR0bzogZW1haWwsXG5cdFx0XHRcdFx0XHRmcm9tLFxuXHRcdFx0XHRcdFx0c3ViamVjdCxcblx0XHRcdFx0XHRcdGh0bWw6IGhlYWRlciArIGh0bWwgKyBmb290ZXJcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiBjb25zb2xlLmxvZyhgU2VuZGluZyBlbWFpbCB0byAkeyBlbWFpbCB9YCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn07XG4iLCIvKiBnbG9iYWxzIE1haWxlciAqL1xuTWFpbGVyLnVuc3Vic2NyaWJlID0gZnVuY3Rpb24oX2lkLCBjcmVhdGVkQXQpIHtcblx0aWYgKF9pZCAmJiBjcmVhdGVkQXQpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMucm9ja2V0TWFpbFVuc3Vic2NyaWJlKF9pZCwgY3JlYXRlZEF0KSA9PT0gMTtcblx0fVxuXHRyZXR1cm4gZmFsc2U7XG59O1xuIiwiLypnbG9iYWxzIE1haWxlciAqL1xuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnTWFpbGVyLnNlbmRNYWlsJyhmcm9tLCBzdWJqZWN0LCBib2R5LCBkcnlydW4sIHF1ZXJ5KSB7XG5cdFx0Y29uc3QgdXNlcklkID0gTWV0ZW9yLnVzZXJJZCgpO1xuXHRcdGlmICghdXNlcklkKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1pbnZhbGlkLXVzZXInLCAnSW52YWxpZCB1c2VyJywge1xuXHRcdFx0XHRtZXRob2Q6ICdNYWlsZXIuc2VuZE1haWwnXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKFJvY2tldENoYXQuYXV0aHouaGFzUm9sZSh1c2VySWQsICdhZG1pbicpICE9PSB0cnVlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHtcblx0XHRcdFx0bWV0aG9kOiAnTWFpbGVyLnNlbmRNYWlsJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiBNYWlsZXIuc2VuZE1haWwoZnJvbSwgc3ViamVjdCwgYm9keSwgZHJ5cnVuLCBxdWVyeSk7XG5cdH1cbn0pO1xuXG5cbi8vTGltaXQgc2V0dGluZyB1c2VybmFtZSBvbmNlIHBlciBtaW51dGVcbi8vRERQUmF0ZUxpbWl0ZXIuYWRkUnVsZVxuLy9cdHR5cGU6ICdtZXRob2QnXG4vL1x0bmFtZTogJ01haWxlci5zZW5kTWFpbCdcbi8vXHRjb25uZWN0aW9uSWQ6IC0+IHJldHVybiB0cnVlXG4vL1x0LCAxLCA2MDAwMFxuIiwiLypnbG9iYWxzIE1haWxlciAqL1xuTWV0ZW9yLm1ldGhvZHMoe1xuXHQnTWFpbGVyOnVuc3Vic2NyaWJlJyhfaWQsIGNyZWF0ZWRBdCkge1xuXHRcdHJldHVybiBNYWlsZXIudW5zdWJzY3JpYmUoX2lkLCBjcmVhdGVkQXQpO1xuXHR9XG59KTtcblxuRERQUmF0ZUxpbWl0ZXIuYWRkUnVsZSh7XG5cdHR5cGU6ICdtZXRob2QnLFxuXHRuYW1lOiAnTWFpbGVyOnVuc3Vic2NyaWJlJyxcblx0Y29ubmVjdGlvbklkKCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59LCAxLCA2MDAwMCk7XG4iXX0=
