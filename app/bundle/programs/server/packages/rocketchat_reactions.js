(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var fileUpload = Package['rocketchat:ui'].fileUpload;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var reaction;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:reactions":{"server":{"models":{"Messages.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_reactions/server/models/Messages.js                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
RocketChat.models.Messages.setReactions = function (messageId, reactions) {
	return this.update({
		_id: messageId
	}, {
		$set: {
			reactions
		}
	});
};

RocketChat.models.Messages.unsetReactions = function (messageId) {
	return this.update({
		_id: messageId
	}, {
		$unset: {
			reactions: 1
		}
	});
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"setReaction.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_reactions/setReaction.js                                                                   //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
Meteor.methods({
	setReaction(reaction, messageId) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'setReaction'
			});
		}

		const message = RocketChat.models.Messages.findOneById(messageId);

		if (!message) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'setReaction'
			});
		}

		const room = Meteor.call('canAccessRoom', message.rid, Meteor.userId());

		if (!room) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'setReaction'
			});
		}

		const user = Meteor.user();

		if (Array.isArray(room.muted) && room.muted.indexOf(user.username) !== -1 && !room.reactWhenReadOnly) {
			RocketChat.Notifications.notifyUser(Meteor.userId(), 'message', {
				_id: Random.id(),
				rid: room._id,
				ts: new Date(),
				msg: TAPi18n.__('You_have_been_muted', {}, user.language)
			});
			return false;
		} else if (!RocketChat.models.Subscriptions.findOne({
			rid: message.rid
		})) {
			return false;
		}

		reaction = `:${reaction.replace(/:/g, '')}:`;

		if (message.reactions && message.reactions[reaction] && message.reactions[reaction].usernames.indexOf(user.username) !== -1) {
			message.reactions[reaction].usernames.splice(message.reactions[reaction].usernames.indexOf(user.username), 1);

			if (message.reactions[reaction].usernames.length === 0) {
				delete message.reactions[reaction];
			}

			if (_.isEmpty(message.reactions)) {
				delete message.reactions;
				RocketChat.models.Messages.unsetReactions(messageId);
				RocketChat.callbacks.run('unsetReaction', messageId, reaction);
			} else {
				RocketChat.models.Messages.setReactions(messageId, message.reactions);
				RocketChat.callbacks.run('setReaction', messageId, reaction);
			}
		} else {
			if (!message.reactions) {
				message.reactions = {};
			}

			if (!message.reactions[reaction]) {
				message.reactions[reaction] = {
					usernames: []
				};
			}

			message.reactions[reaction].usernames.push(user.username);
			RocketChat.models.Messages.setReactions(messageId, message.reactions);
			RocketChat.callbacks.run('setReaction', messageId, reaction);
		}

		msgStream.emit(message.rid, message);
		return;
	}

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:reactions/server/models/Messages.js");
require("./node_modules/meteor/rocketchat:reactions/setReaction.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:reactions'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_reactions.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpyZWFjdGlvbnMvc2VydmVyL21vZGVscy9NZXNzYWdlcy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpyZWFjdGlvbnMvc2V0UmVhY3Rpb24uanMiXSwibmFtZXMiOlsiUm9ja2V0Q2hhdCIsIm1vZGVscyIsIk1lc3NhZ2VzIiwic2V0UmVhY3Rpb25zIiwibWVzc2FnZUlkIiwicmVhY3Rpb25zIiwidXBkYXRlIiwiX2lkIiwiJHNldCIsInVuc2V0UmVhY3Rpb25zIiwiJHVuc2V0IiwiXyIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2IiwiTWV0ZW9yIiwibWV0aG9kcyIsInNldFJlYWN0aW9uIiwicmVhY3Rpb24iLCJ1c2VySWQiLCJFcnJvciIsIm1ldGhvZCIsIm1lc3NhZ2UiLCJmaW5kT25lQnlJZCIsInJvb20iLCJjYWxsIiwicmlkIiwidXNlciIsIkFycmF5IiwiaXNBcnJheSIsIm11dGVkIiwiaW5kZXhPZiIsInVzZXJuYW1lIiwicmVhY3RXaGVuUmVhZE9ubHkiLCJOb3RpZmljYXRpb25zIiwibm90aWZ5VXNlciIsIlJhbmRvbSIsImlkIiwidHMiLCJEYXRlIiwibXNnIiwiVEFQaTE4biIsIl9fIiwibGFuZ3VhZ2UiLCJTdWJzY3JpcHRpb25zIiwiZmluZE9uZSIsInJlcGxhY2UiLCJ1c2VybmFtZXMiLCJzcGxpY2UiLCJsZW5ndGgiLCJpc0VtcHR5IiwiY2FsbGJhY2tzIiwicnVuIiwicHVzaCIsIm1zZ1N0cmVhbSIsImVtaXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLFdBQVdDLE1BQVgsQ0FBa0JDLFFBQWxCLENBQTJCQyxZQUEzQixHQUEwQyxVQUFTQyxTQUFULEVBQW9CQyxTQUFwQixFQUErQjtBQUN4RSxRQUFPLEtBQUtDLE1BQUwsQ0FBWTtBQUFFQyxPQUFLSDtBQUFQLEVBQVosRUFBZ0M7QUFBRUksUUFBTTtBQUFFSDtBQUFGO0FBQVIsRUFBaEMsQ0FBUDtBQUNBLENBRkQ7O0FBSUFMLFdBQVdDLE1BQVgsQ0FBa0JDLFFBQWxCLENBQTJCTyxjQUEzQixHQUE0QyxVQUFTTCxTQUFULEVBQW9CO0FBQy9ELFFBQU8sS0FBS0UsTUFBTCxDQUFZO0FBQUVDLE9BQUtIO0FBQVAsRUFBWixFQUFnQztBQUFFTSxVQUFRO0FBQUVMLGNBQVc7QUFBYjtBQUFWLEVBQWhDLENBQVA7QUFDQSxDQUZELEM7Ozs7Ozs7Ozs7O0FDSkEsSUFBSU0sQ0FBSjs7QUFBTUMsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFlBQVIsQ0FBYixFQUFtQztBQUFDQyxTQUFRQyxDQUFSLEVBQVU7QUFBQ0wsTUFBRUssQ0FBRjtBQUFJOztBQUFoQixDQUFuQyxFQUFxRCxDQUFyRDtBQUdOQyxPQUFPQyxPQUFQLENBQWU7QUFDZEMsYUFBWUMsUUFBWixFQUFzQmhCLFNBQXRCLEVBQWlDO0FBQ2hDLE1BQUksQ0FBQ2EsT0FBT0ksTUFBUCxFQUFMLEVBQXNCO0FBQ3JCLFNBQU0sSUFBSUosT0FBT0ssS0FBWCxDQUFpQixvQkFBakIsRUFBdUMsY0FBdkMsRUFBdUQ7QUFBRUMsWUFBUTtBQUFWLElBQXZELENBQU47QUFDQTs7QUFFRCxRQUFNQyxVQUFVeEIsV0FBV0MsTUFBWCxDQUFrQkMsUUFBbEIsQ0FBMkJ1QixXQUEzQixDQUF1Q3JCLFNBQXZDLENBQWhCOztBQUVBLE1BQUksQ0FBQ29CLE9BQUwsRUFBYztBQUNiLFNBQU0sSUFBSVAsT0FBT0ssS0FBWCxDQUFpQixtQkFBakIsRUFBc0MsYUFBdEMsRUFBcUQ7QUFBRUMsWUFBUTtBQUFWLElBQXJELENBQU47QUFDQTs7QUFFRCxRQUFNRyxPQUFPVCxPQUFPVSxJQUFQLENBQVksZUFBWixFQUE2QkgsUUFBUUksR0FBckMsRUFBMENYLE9BQU9JLE1BQVAsRUFBMUMsQ0FBYjs7QUFFQSxNQUFJLENBQUNLLElBQUwsRUFBVztBQUNWLFNBQU0sSUFBSVQsT0FBT0ssS0FBWCxDQUFpQixtQkFBakIsRUFBc0MsYUFBdEMsRUFBcUQ7QUFBRUMsWUFBUTtBQUFWLElBQXJELENBQU47QUFDQTs7QUFFRCxRQUFNTSxPQUFPWixPQUFPWSxJQUFQLEVBQWI7O0FBRUEsTUFBSUMsTUFBTUMsT0FBTixDQUFjTCxLQUFLTSxLQUFuQixLQUE2Qk4sS0FBS00sS0FBTCxDQUFXQyxPQUFYLENBQW1CSixLQUFLSyxRQUF4QixNQUFzQyxDQUFDLENBQXBFLElBQXlFLENBQUNSLEtBQUtTLGlCQUFuRixFQUFzRztBQUNyR25DLGNBQVdvQyxhQUFYLENBQXlCQyxVQUF6QixDQUFvQ3BCLE9BQU9JLE1BQVAsRUFBcEMsRUFBcUQsU0FBckQsRUFBZ0U7QUFDL0RkLFNBQUsrQixPQUFPQyxFQUFQLEVBRDBEO0FBRS9EWCxTQUFLRixLQUFLbkIsR0FGcUQ7QUFHL0RpQyxRQUFJLElBQUlDLElBQUosRUFIMkQ7QUFJL0RDLFNBQUtDLFFBQVFDLEVBQVIsQ0FBVyxxQkFBWCxFQUFrQyxFQUFsQyxFQUFzQ2YsS0FBS2dCLFFBQTNDO0FBSjBELElBQWhFO0FBTUEsVUFBTyxLQUFQO0FBQ0EsR0FSRCxNQVFPLElBQUksQ0FBQzdDLFdBQVdDLE1BQVgsQ0FBa0I2QyxhQUFsQixDQUFnQ0MsT0FBaEMsQ0FBd0M7QUFBRW5CLFFBQUtKLFFBQVFJO0FBQWYsR0FBeEMsQ0FBTCxFQUFvRTtBQUMxRSxVQUFPLEtBQVA7QUFDQTs7QUFFRFIsYUFBWSxJQUFJQSxTQUFTNEIsT0FBVCxDQUFpQixJQUFqQixFQUF1QixFQUF2QixDQUE0QixHQUE1Qzs7QUFFQSxNQUFJeEIsUUFBUW5CLFNBQVIsSUFBcUJtQixRQUFRbkIsU0FBUixDQUFrQmUsUUFBbEIsQ0FBckIsSUFBb0RJLFFBQVFuQixTQUFSLENBQWtCZSxRQUFsQixFQUE0QjZCLFNBQTVCLENBQXNDaEIsT0FBdEMsQ0FBOENKLEtBQUtLLFFBQW5ELE1BQWlFLENBQUMsQ0FBMUgsRUFBNkg7QUFDNUhWLFdBQVFuQixTQUFSLENBQWtCZSxRQUFsQixFQUE0QjZCLFNBQTVCLENBQXNDQyxNQUF0QyxDQUE2QzFCLFFBQVFuQixTQUFSLENBQWtCZSxRQUFsQixFQUE0QjZCLFNBQTVCLENBQXNDaEIsT0FBdEMsQ0FBOENKLEtBQUtLLFFBQW5ELENBQTdDLEVBQTJHLENBQTNHOztBQUVBLE9BQUlWLFFBQVFuQixTQUFSLENBQWtCZSxRQUFsQixFQUE0QjZCLFNBQTVCLENBQXNDRSxNQUF0QyxLQUFpRCxDQUFyRCxFQUF3RDtBQUN2RCxXQUFPM0IsUUFBUW5CLFNBQVIsQ0FBa0JlLFFBQWxCLENBQVA7QUFDQTs7QUFFRCxPQUFJVCxFQUFFeUMsT0FBRixDQUFVNUIsUUFBUW5CLFNBQWxCLENBQUosRUFBa0M7QUFDakMsV0FBT21CLFFBQVFuQixTQUFmO0FBQ0FMLGVBQVdDLE1BQVgsQ0FBa0JDLFFBQWxCLENBQTJCTyxjQUEzQixDQUEwQ0wsU0FBMUM7QUFDQUosZUFBV3FELFNBQVgsQ0FBcUJDLEdBQXJCLENBQXlCLGVBQXpCLEVBQTBDbEQsU0FBMUMsRUFBcURnQixRQUFyRDtBQUNBLElBSkQsTUFJTztBQUNOcEIsZUFBV0MsTUFBWCxDQUFrQkMsUUFBbEIsQ0FBMkJDLFlBQTNCLENBQXdDQyxTQUF4QyxFQUFtRG9CLFFBQVFuQixTQUEzRDtBQUNBTCxlQUFXcUQsU0FBWCxDQUFxQkMsR0FBckIsQ0FBeUIsYUFBekIsRUFBd0NsRCxTQUF4QyxFQUFtRGdCLFFBQW5EO0FBQ0E7QUFDRCxHQWZELE1BZU87QUFDTixPQUFJLENBQUNJLFFBQVFuQixTQUFiLEVBQXdCO0FBQ3ZCbUIsWUFBUW5CLFNBQVIsR0FBb0IsRUFBcEI7QUFDQTs7QUFDRCxPQUFJLENBQUNtQixRQUFRbkIsU0FBUixDQUFrQmUsUUFBbEIsQ0FBTCxFQUFrQztBQUNqQ0ksWUFBUW5CLFNBQVIsQ0FBa0JlLFFBQWxCLElBQThCO0FBQzdCNkIsZ0JBQVc7QUFEa0IsS0FBOUI7QUFHQTs7QUFDRHpCLFdBQVFuQixTQUFSLENBQWtCZSxRQUFsQixFQUE0QjZCLFNBQTVCLENBQXNDTSxJQUF0QyxDQUEyQzFCLEtBQUtLLFFBQWhEO0FBRUFsQyxjQUFXQyxNQUFYLENBQWtCQyxRQUFsQixDQUEyQkMsWUFBM0IsQ0FBd0NDLFNBQXhDLEVBQW1Eb0IsUUFBUW5CLFNBQTNEO0FBQ0FMLGNBQVdxRCxTQUFYLENBQXFCQyxHQUFyQixDQUF5QixhQUF6QixFQUF3Q2xELFNBQXhDLEVBQW1EZ0IsUUFBbkQ7QUFDQTs7QUFFRG9DLFlBQVVDLElBQVYsQ0FBZWpDLFFBQVFJLEdBQXZCLEVBQTRCSixPQUE1QjtBQUVBO0FBQ0E7O0FBbkVhLENBQWYsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9yZWFjdGlvbnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRSZWFjdGlvbnMgPSBmdW5jdGlvbihtZXNzYWdlSWQsIHJlYWN0aW9ucykge1xuXHRyZXR1cm4gdGhpcy51cGRhdGUoeyBfaWQ6IG1lc3NhZ2VJZCB9LCB7ICRzZXQ6IHsgcmVhY3Rpb25zIH19KTtcbn07XG5cblJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnVuc2V0UmVhY3Rpb25zID0gZnVuY3Rpb24obWVzc2FnZUlkKSB7XG5cdHJldHVybiB0aGlzLnVwZGF0ZSh7IF9pZDogbWVzc2FnZUlkIH0sIHsgJHVuc2V0OiB7IHJlYWN0aW9uczogMSB9fSk7XG59O1xuIiwiLyogZ2xvYmFscyBtc2dTdHJlYW0gKi9cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5NZXRlb3IubWV0aG9kcyh7XG5cdHNldFJlYWN0aW9uKHJlYWN0aW9uLCBtZXNzYWdlSWQpIHtcblx0XHRpZiAoIU1ldGVvci51c2VySWQoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignZXJyb3ItaW52YWxpZC11c2VyJywgJ0ludmFsaWQgdXNlcicsIHsgbWV0aG9kOiAnc2V0UmVhY3Rpb24nIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5maW5kT25lQnlJZChtZXNzYWdlSWQpO1xuXG5cdFx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnc2V0UmVhY3Rpb24nIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb20gPSBNZXRlb3IuY2FsbCgnY2FuQWNjZXNzUm9vbScsIG1lc3NhZ2UucmlkLCBNZXRlb3IudXNlcklkKCkpO1xuXG5cdFx0aWYgKCFyb29tKSB7XG5cdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdlcnJvci1ub3QtYWxsb3dlZCcsICdOb3QgYWxsb3dlZCcsIHsgbWV0aG9kOiAnc2V0UmVhY3Rpb24nIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcigpO1xuXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkocm9vbS5tdXRlZCkgJiYgcm9vbS5tdXRlZC5pbmRleE9mKHVzZXIudXNlcm5hbWUpICE9PSAtMSAmJiAhcm9vbS5yZWFjdFdoZW5SZWFkT25seSkge1xuXHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIoTWV0ZW9yLnVzZXJJZCgpLCAnbWVzc2FnZScsIHtcblx0XHRcdFx0X2lkOiBSYW5kb20uaWQoKSxcblx0XHRcdFx0cmlkOiByb29tLl9pZCxcblx0XHRcdFx0dHM6IG5ldyBEYXRlKCksXG5cdFx0XHRcdG1zZzogVEFQaTE4bi5fXygnWW91X2hhdmVfYmVlbl9tdXRlZCcsIHt9LCB1c2VyLmxhbmd1YWdlKVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIGlmICghUm9ja2V0Q2hhdC5tb2RlbHMuU3Vic2NyaXB0aW9ucy5maW5kT25lKHsgcmlkOiBtZXNzYWdlLnJpZCB9KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJlYWN0aW9uID0gYDokeyByZWFjdGlvbi5yZXBsYWNlKC86L2csICcnKSB9OmA7XG5cblx0XHRpZiAobWVzc2FnZS5yZWFjdGlvbnMgJiYgbWVzc2FnZS5yZWFjdGlvbnNbcmVhY3Rpb25dICYmIG1lc3NhZ2UucmVhY3Rpb25zW3JlYWN0aW9uXS51c2VybmFtZXMuaW5kZXhPZih1c2VyLnVzZXJuYW1lKSAhPT0gLTEpIHtcblx0XHRcdG1lc3NhZ2UucmVhY3Rpb25zW3JlYWN0aW9uXS51c2VybmFtZXMuc3BsaWNlKG1lc3NhZ2UucmVhY3Rpb25zW3JlYWN0aW9uXS51c2VybmFtZXMuaW5kZXhPZih1c2VyLnVzZXJuYW1lKSwgMSk7XG5cblx0XHRcdGlmIChtZXNzYWdlLnJlYWN0aW9uc1tyZWFjdGlvbl0udXNlcm5hbWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRkZWxldGUgbWVzc2FnZS5yZWFjdGlvbnNbcmVhY3Rpb25dO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoXy5pc0VtcHR5KG1lc3NhZ2UucmVhY3Rpb25zKSkge1xuXHRcdFx0XHRkZWxldGUgbWVzc2FnZS5yZWFjdGlvbnM7XG5cdFx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnVuc2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCk7XG5cdFx0XHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bigndW5zZXRSZWFjdGlvbicsIG1lc3NhZ2VJZCwgcmVhY3Rpb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Um9ja2V0Q2hhdC5tb2RlbHMuTWVzc2FnZXMuc2V0UmVhY3Rpb25zKG1lc3NhZ2VJZCwgbWVzc2FnZS5yZWFjdGlvbnMpO1xuXHRcdFx0XHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5ydW4oJ3NldFJlYWN0aW9uJywgbWVzc2FnZUlkLCByZWFjdGlvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghbWVzc2FnZS5yZWFjdGlvbnMpIHtcblx0XHRcdFx0bWVzc2FnZS5yZWFjdGlvbnMgPSB7fTtcblx0XHRcdH1cblx0XHRcdGlmICghbWVzc2FnZS5yZWFjdGlvbnNbcmVhY3Rpb25dKSB7XG5cdFx0XHRcdG1lc3NhZ2UucmVhY3Rpb25zW3JlYWN0aW9uXSA9IHtcblx0XHRcdFx0XHR1c2VybmFtZXM6IFtdXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRtZXNzYWdlLnJlYWN0aW9uc1tyZWFjdGlvbl0udXNlcm5hbWVzLnB1c2godXNlci51c2VybmFtZSk7XG5cblx0XHRcdFJvY2tldENoYXQubW9kZWxzLk1lc3NhZ2VzLnNldFJlYWN0aW9ucyhtZXNzYWdlSWQsIG1lc3NhZ2UucmVhY3Rpb25zKTtcblx0XHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLnJ1bignc2V0UmVhY3Rpb24nLCBtZXNzYWdlSWQsIHJlYWN0aW9uKTtcblx0XHR9XG5cblx0XHRtc2dTdHJlYW0uZW1pdChtZXNzYWdlLnJpZCwgbWVzc2FnZSk7XG5cblx0XHRyZXR1cm47XG5cdH1cbn0pO1xuIl19
