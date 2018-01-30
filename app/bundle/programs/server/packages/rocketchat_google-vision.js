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
var visionData;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:google-vision":{"server":{"settings.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_google-vision/server/settings.js                                                        //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
Meteor.startup(function () {
	RocketChat.settings.add('GoogleVision_Enable', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		public: true,
		enableQuery: {
			_id: 'FileUpload_Storage_Type',
			value: 'GoogleCloudStorage'
		}
	});
	RocketChat.settings.add('GoogleVision_ServiceAccount', '', {
		type: 'string',
		group: 'FileUpload',
		section: 'Google Vision',
		multiline: true,
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Max_Monthly_Calls', 0, {
		type: 'int',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Current_Month', 0, {
		type: 'int',
		group: 'FileUpload',
		section: 'Google Vision',
		hidden: true
	});
	RocketChat.settings.add('GoogleVision_Current_Month_Calls', 0, {
		type: 'int',
		group: 'FileUpload',
		section: 'Google Vision',
		blocked: true
	});
	RocketChat.settings.add('GoogleVision_Type_Document', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Type_Faces', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Type_Landmarks', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Type_Labels', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Type_Logos', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Type_Properties', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Type_SafeSearch', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
	RocketChat.settings.add('GoogleVision_Block_Adult_Images', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: [{
			_id: 'GoogleVision_Enable',
			value: true
		}, {
			_id: 'GoogleVision_Type_SafeSearch',
			value: true
		}]
	});
	RocketChat.settings.add('GoogleVision_Type_Similar', false, {
		type: 'boolean',
		group: 'FileUpload',
		section: 'Google Vision',
		enableQuery: {
			_id: 'GoogleVision_Enable',
			value: true
		}
	});
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"googlevision.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_google-vision/server/googlevision.js                                                    //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
class GoogleVision {
	constructor() {
		this.storage = Npm.require('@google-cloud/storage');
		this.vision = Npm.require('@google-cloud/vision');
		this.storageClient = {};
		this.visionClient = {};
		this.enabled = RocketChat.settings.get('GoogleVision_Enable');
		this.serviceAccount = {};
		RocketChat.settings.get('GoogleVision_Enable', (key, value) => {
			this.enabled = value;
		});
		RocketChat.settings.get('GoogleVision_ServiceAccount', (key, value) => {
			try {
				this.serviceAccount = JSON.parse(value);
				this.storageClient = this.storage({
					credentials: this.serviceAccount
				});
				this.visionClient = this.vision({
					credentials: this.serviceAccount
				});
			} catch (e) {
				this.serviceAccount = {};
			}
		});
		RocketChat.settings.get('GoogleVision_Block_Adult_Images', (key, value) => {
			if (value) {
				RocketChat.callbacks.add('beforeSaveMessage', this.blockUnsafeImages.bind(this), RocketChat.callbacks.priority.MEDIUM, 'googlevision-blockunsafe');
			} else {
				RocketChat.callbacks.remove('beforeSaveMessage', 'googlevision-blockunsafe');
			}
		});
		RocketChat.callbacks.add('afterFileUpload', this.annotate.bind(this));
	}

	incCallCount(count) {
		const currentMonth = new Date().getMonth();
		const maxMonthlyCalls = RocketChat.settings.get('GoogleVision_Max_Monthly_Calls') || 0;

		if (maxMonthlyCalls > 0) {
			if (RocketChat.settings.get('GoogleVision_Current_Month') !== currentMonth) {
				RocketChat.settings.set('GoogleVision_Current_Month', currentMonth);

				if (count > maxMonthlyCalls) {
					return false;
				}
			} else if (count + (RocketChat.settings.get('GoogleVision_Current_Month_Calls') || 0) > maxMonthlyCalls) {
				return false;
			}
		}

		RocketChat.models.Settings.update({
			_id: 'GoogleVision_Current_Month_Calls'
		}, {
			$inc: {
				value: count
			}
		});
		return true;
	}

	blockUnsafeImages(message) {
		if (this.enabled && this.serviceAccount && message && message.file && message.file._id) {
			const file = RocketChat.models.Uploads.findOne({
				_id: message.file._id
			});

			if (file && file.type && file.type.indexOf('image') !== -1 && file.store === 'GoogleCloudStorage:Uploads' && file.GoogleStorage) {
				if (this.incCallCount(1)) {
					const bucket = this.storageClient.bucket(RocketChat.settings.get('FileUpload_GoogleStorage_Bucket'));
					const bucketFile = bucket.file(file.GoogleStorage.path);
					const results = Meteor.wrapAsync(this.visionClient.detectSafeSearch, this.visionClient)(bucketFile);

					if (results && results.adult === true) {
						FileUpload.getStore('Uploads').deleteById(file._id);
						const user = RocketChat.models.Users.findOneById(message.u && message.u._id);

						if (user) {
							RocketChat.Notifications.notifyUser(user._id, 'message', {
								_id: Random.id(),
								rid: message.rid,
								ts: new Date(),
								msg: TAPi18n.__('Adult_images_are_not_allowed', {}, user.language)
							});
						}

						throw new Meteor.Error('GoogleVisionError: Image blocked');
					}
				} else {
					console.error('Google Vision: Usage limit exceeded');
				}

				return message;
			}
		}
	}

	annotate({
		message
	}) {
		const visionTypes = [];

		if (RocketChat.settings.get('GoogleVision_Type_Document')) {
			visionTypes.push('document');
		}

		if (RocketChat.settings.get('GoogleVision_Type_Faces')) {
			visionTypes.push('faces');
		}

		if (RocketChat.settings.get('GoogleVision_Type_Landmarks')) {
			visionTypes.push('landmarks');
		}

		if (RocketChat.settings.get('GoogleVision_Type_Labels')) {
			visionTypes.push('labels');
		}

		if (RocketChat.settings.get('GoogleVision_Type_Logos')) {
			visionTypes.push('logos');
		}

		if (RocketChat.settings.get('GoogleVision_Type_Properties')) {
			visionTypes.push('properties');
		}

		if (RocketChat.settings.get('GoogleVision_Type_SafeSearch')) {
			visionTypes.push('safeSearch');
		}

		if (RocketChat.settings.get('GoogleVision_Type_Similar')) {
			visionTypes.push('similar');
		}

		if (this.enabled && this.serviceAccount && visionTypes.length > 0 && message.file && message.file._id) {
			const file = RocketChat.models.Uploads.findOne({
				_id: message.file._id
			});

			if (file && file.type && file.type.indexOf('image') !== -1 && file.store === 'GoogleCloudStorage:Uploads' && file.GoogleStorage) {
				if (this.incCallCount(visionTypes.length)) {
					const bucket = this.storageClient.bucket(RocketChat.settings.get('FileUpload_GoogleStorage_Bucket'));
					const bucketFile = bucket.file(file.GoogleStorage.path);
					this.visionClient.detect(bucketFile, visionTypes, Meteor.bindEnvironment((error, results) => {
						if (!error) {
							RocketChat.models.Messages.setGoogleVisionData(message._id, this.getAnnotations(visionTypes, results));
						} else {
							console.trace('GoogleVision error: ', error.stack);
						}
					}));
				} else {
					console.error('Google Vision: Usage limit exceeded');
				}
			}
		}
	}

	getAnnotations(visionTypes, visionData) {
		if (visionTypes.length === 1) {
			const _visionData = {};
			_visionData[`${visionTypes[0]}`] = visionData;
			visionData = _visionData;
		}

		const results = {};

		for (const index in visionData) {
			if (visionData.hasOwnProperty(index)) {
				switch (index) {
					case 'faces':
					case 'landmarks':
					case 'labels':
					case 'similar':
					case 'logos':
						results[index] = (results[index] || []).concat(visionData[index] || []);
						break;

					case 'safeSearch':
						results['safeSearch'] = visionData['safeSearch'];
						break;

					case 'properties':
						results['colors'] = visionData[index]['colors'];
						break;
				}
			}
		}

		return results;
	}

}

RocketChat.GoogleVision = new GoogleVision();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"models":{"Messages.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/rocketchat_google-vision/server/models/Messages.js                                                 //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
RocketChat.models.Messages.setGoogleVisionData = function (messageId, visionData) {
	const updateObj = {};

	for (const index in visionData) {
		if (visionData.hasOwnProperty(index)) {
			updateObj[`attachments.0.${index}`] = visionData[index];
		}
	}

	return this.update({
		_id: messageId
	}, {
		$set: updateObj
	});
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:google-vision/server/settings.js");
require("./node_modules/meteor/rocketchat:google-vision/server/googlevision.js");
require("./node_modules/meteor/rocketchat:google-vision/server/models/Messages.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:google-vision'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_google-vision.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpnb29nbGUtdmlzaW9uL3NlcnZlci9zZXR0aW5ncy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpnb29nbGUtdmlzaW9uL3NlcnZlci9nb29nbGV2aXNpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6Z29vZ2xlLXZpc2lvbi9zZXJ2ZXIvbW9kZWxzL01lc3NhZ2VzLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsInN0YXJ0dXAiLCJSb2NrZXRDaGF0Iiwic2V0dGluZ3MiLCJhZGQiLCJ0eXBlIiwiZ3JvdXAiLCJzZWN0aW9uIiwicHVibGljIiwiZW5hYmxlUXVlcnkiLCJfaWQiLCJ2YWx1ZSIsIm11bHRpbGluZSIsImhpZGRlbiIsImJsb2NrZWQiLCJHb29nbGVWaXNpb24iLCJjb25zdHJ1Y3RvciIsInN0b3JhZ2UiLCJOcG0iLCJyZXF1aXJlIiwidmlzaW9uIiwic3RvcmFnZUNsaWVudCIsInZpc2lvbkNsaWVudCIsImVuYWJsZWQiLCJnZXQiLCJzZXJ2aWNlQWNjb3VudCIsImtleSIsIkpTT04iLCJwYXJzZSIsImNyZWRlbnRpYWxzIiwiZSIsImNhbGxiYWNrcyIsImJsb2NrVW5zYWZlSW1hZ2VzIiwiYmluZCIsInByaW9yaXR5IiwiTUVESVVNIiwicmVtb3ZlIiwiYW5ub3RhdGUiLCJpbmNDYWxsQ291bnQiLCJjb3VudCIsImN1cnJlbnRNb250aCIsIkRhdGUiLCJnZXRNb250aCIsIm1heE1vbnRobHlDYWxscyIsInNldCIsIm1vZGVscyIsIlNldHRpbmdzIiwidXBkYXRlIiwiJGluYyIsIm1lc3NhZ2UiLCJmaWxlIiwiVXBsb2FkcyIsImZpbmRPbmUiLCJpbmRleE9mIiwic3RvcmUiLCJHb29nbGVTdG9yYWdlIiwiYnVja2V0IiwiYnVja2V0RmlsZSIsInBhdGgiLCJyZXN1bHRzIiwid3JhcEFzeW5jIiwiZGV0ZWN0U2FmZVNlYXJjaCIsImFkdWx0IiwiRmlsZVVwbG9hZCIsImdldFN0b3JlIiwiZGVsZXRlQnlJZCIsInVzZXIiLCJVc2VycyIsImZpbmRPbmVCeUlkIiwidSIsIk5vdGlmaWNhdGlvbnMiLCJub3RpZnlVc2VyIiwiUmFuZG9tIiwiaWQiLCJyaWQiLCJ0cyIsIm1zZyIsIlRBUGkxOG4iLCJfXyIsImxhbmd1YWdlIiwiRXJyb3IiLCJjb25zb2xlIiwiZXJyb3IiLCJ2aXNpb25UeXBlcyIsInB1c2giLCJsZW5ndGgiLCJkZXRlY3QiLCJiaW5kRW52aXJvbm1lbnQiLCJNZXNzYWdlcyIsInNldEdvb2dsZVZpc2lvbkRhdGEiLCJnZXRBbm5vdGF0aW9ucyIsInRyYWNlIiwic3RhY2siLCJ2aXNpb25EYXRhIiwiX3Zpc2lvbkRhdGEiLCJpbmRleCIsImhhc093blByb3BlcnR5IiwiY29uY2F0IiwibWVzc2FnZUlkIiwidXBkYXRlT2JqIiwiJHNldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxPQUFPQyxPQUFQLENBQWUsWUFBVztBQUN6QkMsWUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IscUJBQXhCLEVBQStDLEtBQS9DLEVBQXNEO0FBQ3JEQyxRQUFNLFNBRCtDO0FBRXJEQyxTQUFPLFlBRjhDO0FBR3JEQyxXQUFTLGVBSDRDO0FBSXJEQyxVQUFRLElBSjZDO0FBS3JEQyxlQUFhO0FBQUVDLFFBQUsseUJBQVA7QUFBa0NDLFVBQU87QUFBekM7QUFMd0MsRUFBdEQ7QUFPQVQsWUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsNkJBQXhCLEVBQXVELEVBQXZELEVBQTJEO0FBQzFEQyxRQUFNLFFBRG9EO0FBRTFEQyxTQUFPLFlBRm1EO0FBRzFEQyxXQUFTLGVBSGlEO0FBSTFESyxhQUFXLElBSitDO0FBSzFESCxlQUFhO0FBQUVDLFFBQUsscUJBQVA7QUFBOEJDLFVBQU87QUFBckM7QUFMNkMsRUFBM0Q7QUFPQVQsWUFBV0MsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0IsZ0NB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QUVyQyxPQUFLd0Y7QUFBUCxFQUFaLEVBQWdDO0FBQUVFLFFBQU1EO0FBQVIsRUFBaEMsQ0FBUDtBQUNBLENBVEQsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9nb29nbGUtdmlzaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdHb29nbGVWaXNpb25fRW5hYmxlJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdGaWxlVXBsb2FkJyxcblx0XHRzZWN0aW9uOiAnR29vZ2xlIFZpc2lvbicsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0ZpbGVVcGxvYWRfU3RvcmFnZV9UeXBlJywgdmFsdWU6ICdHb29nbGVDbG91ZFN0b3JhZ2UnIH1cblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdHb29nbGVWaXNpb25fU2VydmljZUFjY291bnQnLCAnJywge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdG11bHRpbGluZTogdHJ1ZSxcblx0XHRlbmFibGVRdWVyeTogeyBfaWQ6ICdHb29nbGVWaXNpb25fRW5hYmxlJywgdmFsdWU6IHRydWUgfVxuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0dvb2dsZVZpc2lvbl9NYXhfTW9udGhseV9DYWxscycsIDAsIHtcblx0XHR0eXBlOiAnaW50Jyxcblx0XHRncm91cDogJ0ZpbGVVcGxvYWQnLFxuXHRcdHNlY3Rpb246ICdHb29nbGUgVmlzaW9uJyxcblx0XHRlbmFibGVRdWVyeTogeyBfaWQ6ICdHb29nbGVWaXNpb25fRW5hYmxlJywgdmFsdWU6IHRydWUgfVxuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0dvb2dsZVZpc2lvbl9DdXJyZW50X01vbnRoJywgMCwge1xuXHRcdHR5cGU6ICdpbnQnLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGhpZGRlbjogdHJ1ZVxuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0dvb2dsZVZpc2lvbl9DdXJyZW50X01vbnRoX0NhbGxzJywgMCwge1xuXHRcdHR5cGU6ICdpbnQnLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGJsb2NrZWQ6IHRydWVcblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdHb29nbGVWaXNpb25fVHlwZV9Eb2N1bWVudCcsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0dvb2dsZVZpc2lvbl9FbmFibGUnLCB2YWx1ZTogdHJ1ZSB9XG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnR29vZ2xlVmlzaW9uX1R5cGVfRmFjZXMnLCBmYWxzZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ0ZpbGVVcGxvYWQnLFxuXHRcdHNlY3Rpb246ICdHb29nbGUgVmlzaW9uJyxcblx0XHRlbmFibGVRdWVyeTogeyBfaWQ6ICdHb29nbGVWaXNpb25fRW5hYmxlJywgdmFsdWU6IHRydWUgfVxuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ0dvb2dsZVZpc2lvbl9UeXBlX0xhbmRtYXJrcycsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0dvb2dsZVZpc2lvbl9FbmFibGUnLCB2YWx1ZTogdHJ1ZSB9XG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnR29vZ2xlVmlzaW9uX1R5cGVfTGFiZWxzJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdGaWxlVXBsb2FkJyxcblx0XHRzZWN0aW9uOiAnR29vZ2xlIFZpc2lvbicsXG5cdFx0ZW5hYmxlUXVlcnk6IHsgX2lkOiAnR29vZ2xlVmlzaW9uX0VuYWJsZScsIHZhbHVlOiB0cnVlIH1cblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdHb29nbGVWaXNpb25fVHlwZV9Mb2dvcycsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0dvb2dsZVZpc2lvbl9FbmFibGUnLCB2YWx1ZTogdHJ1ZSB9XG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnR29vZ2xlVmlzaW9uX1R5cGVfUHJvcGVydGllcycsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0dvb2dsZVZpc2lvbl9FbmFibGUnLCB2YWx1ZTogdHJ1ZSB9XG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnR29vZ2xlVmlzaW9uX1R5cGVfU2FmZVNlYXJjaCcsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGVuYWJsZVF1ZXJ5OiB7IF9pZDogJ0dvb2dsZVZpc2lvbl9FbmFibGUnLCB2YWx1ZTogdHJ1ZSB9XG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnR29vZ2xlVmlzaW9uX0Jsb2NrX0FkdWx0X0ltYWdlcycsIGZhbHNlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnRmlsZVVwbG9hZCcsXG5cdFx0c2VjdGlvbjogJ0dvb2dsZSBWaXNpb24nLFxuXHRcdGVuYWJsZVF1ZXJ5OiBbeyBfaWQ6ICdHb29nbGVWaXNpb25fRW5hYmxlJywgdmFsdWU6IHRydWUgfSwgeyBfaWQ6ICdHb29nbGVWaXNpb25fVHlwZV9TYWZlU2VhcmNoJywgdmFsdWU6IHRydWUgfV1cblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdHb29nbGVWaXNpb25fVHlwZV9TaW1pbGFyJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdGaWxlVXBsb2FkJyxcblx0XHRzZWN0aW9uOiAnR29vZ2xlIFZpc2lvbicsXG5cdFx0ZW5hYmxlUXVlcnk6IHsgX2lkOiAnR29vZ2xlVmlzaW9uX0VuYWJsZScsIHZhbHVlOiB0cnVlIH1cblx0fSk7XG59KTtcbiIsImNsYXNzIEdvb2dsZVZpc2lvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuc3RvcmFnZSA9IE5wbS5yZXF1aXJlKCdAZ29vZ2xlLWNsb3VkL3N0b3JhZ2UnKTtcblx0XHR0aGlzLnZpc2lvbiA9IE5wbS5yZXF1aXJlKCdAZ29vZ2xlLWNsb3VkL3Zpc2lvbicpO1xuXHRcdHRoaXMuc3RvcmFnZUNsaWVudCA9IHt9O1xuXHRcdHRoaXMudmlzaW9uQ2xpZW50ID0ge307XG5cdFx0dGhpcy5lbmFibGVkID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9FbmFibGUnKTtcblx0XHR0aGlzLnNlcnZpY2VBY2NvdW50ID0ge307XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9FbmFibGUnLCAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdmFsdWU7XG5cdFx0fSk7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9TZXJ2aWNlQWNjb3VudCcsIChrZXksIHZhbHVlKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLnNlcnZpY2VBY2NvdW50ID0gSlNPTi5wYXJzZSh2YWx1ZSk7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZUNsaWVudCA9IHRoaXMuc3RvcmFnZSh7IGNyZWRlbnRpYWxzOiB0aGlzLnNlcnZpY2VBY2NvdW50IH0pO1xuXHRcdFx0XHR0aGlzLnZpc2lvbkNsaWVudCA9IHRoaXMudmlzaW9uKHsgY3JlZGVudGlhbHM6IHRoaXMuc2VydmljZUFjY291bnQgfSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMuc2VydmljZUFjY291bnQgPSB7fTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnR29vZ2xlVmlzaW9uX0Jsb2NrX0FkdWx0X0ltYWdlcycsIChrZXksIHZhbHVlKSA9PiB7XG5cdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0Um9ja2V0Q2hhdC5jYWxsYmFja3MuYWRkKCdiZWZvcmVTYXZlTWVzc2FnZScsIHRoaXMuYmxvY2tVbnNhZmVJbWFnZXMuYmluZCh0aGlzKSwgUm9ja2V0Q2hhdC5jYWxsYmFja3MucHJpb3JpdHkuTUVESVVNLCAnZ29vZ2xldmlzaW9uLWJsb2NrdW5zYWZlJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRSb2NrZXRDaGF0LmNhbGxiYWNrcy5yZW1vdmUoJ2JlZm9yZVNhdmVNZXNzYWdlJywgJ2dvb2dsZXZpc2lvbi1ibG9ja3Vuc2FmZScpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdFJvY2tldENoYXQuY2FsbGJhY2tzLmFkZCgnYWZ0ZXJGaWxlVXBsb2FkJywgdGhpcy5hbm5vdGF0ZS5iaW5kKHRoaXMpKTtcblx0fVxuXG5cdGluY0NhbGxDb3VudChjb3VudCkge1xuXHRcdGNvbnN0IGN1cnJlbnRNb250aCA9IG5ldyBEYXRlKCkuZ2V0TW9udGgoKTtcblx0XHRjb25zdCBtYXhNb250aGx5Q2FsbHMgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnR29vZ2xlVmlzaW9uX01heF9Nb250aGx5X0NhbGxzJykgfHwgMDtcblx0XHRpZiAobWF4TW9udGhseUNhbGxzID4gMCkge1xuXHRcdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdHb29nbGVWaXNpb25fQ3VycmVudF9Nb250aCcpICE9PSBjdXJyZW50TW9udGgpIHtcblx0XHRcdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5zZXQoJ0dvb2dsZVZpc2lvbl9DdXJyZW50X01vbnRoJywgY3VycmVudE1vbnRoKTtcblx0XHRcdFx0aWYgKGNvdW50ID4gbWF4TW9udGhseUNhbGxzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGNvdW50ICsgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdHb29nbGVWaXNpb25fQ3VycmVudF9Nb250aF9DYWxscycpIHx8IDApID4gbWF4TW9udGhseUNhbGxzKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Um9ja2V0Q2hhdC5tb2RlbHMuU2V0dGluZ3MudXBkYXRlKHsgX2lkOiAnR29vZ2xlVmlzaW9uX0N1cnJlbnRfTW9udGhfQ2FsbHMnIH0sIHsgJGluYzogeyB2YWx1ZTogY291bnQgfSB9KTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGJsb2NrVW5zYWZlSW1hZ2VzKG1lc3NhZ2UpIHtcblx0XHRpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuc2VydmljZUFjY291bnQgJiYgbWVzc2FnZSAmJiBtZXNzYWdlLmZpbGUgJiYgbWVzc2FnZS5maWxlLl9pZCkge1xuXHRcdFx0Y29uc3QgZmlsZSA9IFJvY2tldENoYXQubW9kZWxzLlVwbG9hZHMuZmluZE9uZSh7IF9pZDogbWVzc2FnZS5maWxlLl9pZCB9KTtcblx0XHRcdGlmIChmaWxlICYmIGZpbGUudHlwZSAmJiBmaWxlLnR5cGUuaW5kZXhPZignaW1hZ2UnKSAhPT0gLTEgJiYgZmlsZS5zdG9yZSA9PT0gJ0dvb2dsZUNsb3VkU3RvcmFnZTpVcGxvYWRzJyAmJiBmaWxlLkdvb2dsZVN0b3JhZ2UpIHtcblx0XHRcdFx0aWYgKHRoaXMuaW5jQ2FsbENvdW50KDEpKSB7XG5cdFx0XHRcdFx0Y29uc3QgYnVja2V0ID0gdGhpcy5zdG9yYWdlQ2xpZW50LmJ1Y2tldChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnRmlsZVVwbG9hZF9Hb29nbGVTdG9yYWdlX0J1Y2tldCcpKTtcblx0XHRcdFx0XHRjb25zdCBidWNrZXRGaWxlID0gYnVja2V0LmZpbGUoZmlsZS5Hb29nbGVTdG9yYWdlLnBhdGgpO1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdHMgPSBNZXRlb3Iud3JhcEFzeW5jKHRoaXMudmlzaW9uQ2xpZW50LmRldGVjdFNhZmVTZWFyY2gsIHRoaXMudmlzaW9uQ2xpZW50KShidWNrZXRGaWxlKTtcblx0XHRcdFx0XHRpZiAocmVzdWx0cyAmJiByZXN1bHRzLmFkdWx0ID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0XHRGaWxlVXBsb2FkLmdldFN0b3JlKCdVcGxvYWRzJykuZGVsZXRlQnlJZChmaWxlLl9pZCk7XG5cdFx0XHRcdFx0XHRjb25zdCB1c2VyID0gUm9ja2V0Q2hhdC5tb2RlbHMuVXNlcnMuZmluZE9uZUJ5SWQobWVzc2FnZS51ICYmIG1lc3NhZ2UudS5faWQpO1xuXHRcdFx0XHRcdFx0aWYgKHVzZXIpIHtcblx0XHRcdFx0XHRcdFx0Um9ja2V0Q2hhdC5Ob3RpZmljYXRpb25zLm5vdGlmeVVzZXIodXNlci5faWQsICdtZXNzYWdlJywge1xuXHRcdFx0XHRcdFx0XHRcdF9pZDogUmFuZG9tLmlkKCksXG5cdFx0XHRcdFx0XHRcdFx0cmlkOiBtZXNzYWdlLnJpZCxcblx0XHRcdFx0XHRcdFx0XHR0czogbmV3IERhdGUsXG5cdFx0XHRcdFx0XHRcdFx0bXNnOiBUQVBpMThuLl9fKCdBZHVsdF9pbWFnZXNfYXJlX25vdF9hbGxvd2VkJywge30sIHVzZXIubGFuZ3VhZ2UpXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignR29vZ2xlVmlzaW9uRXJyb3I6IEltYWdlIGJsb2NrZWQnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignR29vZ2xlIFZpc2lvbjogVXNhZ2UgbGltaXQgZXhjZWVkZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbWVzc2FnZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhbm5vdGF0ZSh7IG1lc3NhZ2UgfSkge1xuXHRcdGNvbnN0IHZpc2lvblR5cGVzID0gW107XG5cdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdHb29nbGVWaXNpb25fVHlwZV9Eb2N1bWVudCcpKSB7XG5cdFx0XHR2aXNpb25UeXBlcy5wdXNoKCdkb2N1bWVudCcpO1xuXHRcdH1cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9UeXBlX0ZhY2VzJykpIHtcblx0XHRcdHZpc2lvblR5cGVzLnB1c2goJ2ZhY2VzJyk7XG5cdFx0fVxuXHRcdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnR29vZ2xlVmlzaW9uX1R5cGVfTGFuZG1hcmtzJykpIHtcblx0XHRcdHZpc2lvblR5cGVzLnB1c2goJ2xhbmRtYXJrcycpO1xuXHRcdH1cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9UeXBlX0xhYmVscycpKSB7XG5cdFx0XHR2aXNpb25UeXBlcy5wdXNoKCdsYWJlbHMnKTtcblx0XHR9XG5cdFx0aWYgKFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdHb29nbGVWaXNpb25fVHlwZV9Mb2dvcycpKSB7XG5cdFx0XHR2aXNpb25UeXBlcy5wdXNoKCdsb2dvcycpO1xuXHRcdH1cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9UeXBlX1Byb3BlcnRpZXMnKSkge1xuXHRcdFx0dmlzaW9uVHlwZXMucHVzaCgncHJvcGVydGllcycpO1xuXHRcdH1cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9UeXBlX1NhZmVTZWFyY2gnKSkge1xuXHRcdFx0dmlzaW9uVHlwZXMucHVzaCgnc2FmZVNlYXJjaCcpO1xuXHRcdH1cblx0XHRpZiAoUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0dvb2dsZVZpc2lvbl9UeXBlX1NpbWlsYXInKSkge1xuXHRcdFx0dmlzaW9uVHlwZXMucHVzaCgnc2ltaWxhcicpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuc2VydmljZUFjY291bnQgJiYgdmlzaW9uVHlwZXMubGVuZ3RoID4gMCAmJiBtZXNzYWdlLmZpbGUgJiYgbWVzc2FnZS5maWxlLl9pZCkge1xuXHRcdFx0Y29uc3QgZmlsZSA9IFJvY2tldENoYXQubW9kZWxzLlVwbG9hZHMuZmluZE9uZSh7IF9pZDogbWVzc2FnZS5maWxlLl9pZCB9KTtcblx0XHRcdGlmIChmaWxlICYmIGZpbGUudHlwZSAmJiBmaWxlLnR5cGUuaW5kZXhPZignaW1hZ2UnKSAhPT0gLTEgJiYgZmlsZS5zdG9yZSA9PT0gJ0dvb2dsZUNsb3VkU3RvcmFnZTpVcGxvYWRzJyAmJiBmaWxlLkdvb2dsZVN0b3JhZ2UpIHtcblx0XHRcdFx0aWYgKHRoaXMuaW5jQ2FsbENvdW50KHZpc2lvblR5cGVzLmxlbmd0aCkpIHtcblx0XHRcdFx0XHRjb25zdCBidWNrZXQgPSB0aGlzLnN0b3JhZ2VDbGllbnQuYnVja2V0KFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdGaWxlVXBsb2FkX0dvb2dsZVN0b3JhZ2VfQnVja2V0JykpO1xuXHRcdFx0XHRcdGNvbnN0IGJ1Y2tldEZpbGUgPSBidWNrZXQuZmlsZShmaWxlLkdvb2dsZVN0b3JhZ2UucGF0aCk7XG5cdFx0XHRcdFx0dGhpcy52aXNpb25DbGllbnQuZGV0ZWN0KGJ1Y2tldEZpbGUsIHZpc2lvblR5cGVzLCBNZXRlb3IuYmluZEVudmlyb25tZW50KChlcnJvciwgcmVzdWx0cykgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCFlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRHb29nbGVWaXNpb25EYXRhKG1lc3NhZ2UuX2lkLCB0aGlzLmdldEFubm90YXRpb25zKHZpc2lvblR5cGVzLCByZXN1bHRzKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb25zb2xlLnRyYWNlKCdHb29nbGVWaXNpb24gZXJyb3I6ICcsIGVycm9yLnN0YWNrKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignR29vZ2xlIFZpc2lvbjogVXNhZ2UgbGltaXQgZXhjZWVkZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldEFubm90YXRpb25zKHZpc2lvblR5cGVzLCB2aXNpb25EYXRhKSB7XG5cdFx0aWYgKHZpc2lvblR5cGVzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgX3Zpc2lvbkRhdGEgPSB7fTtcblx0XHRcdF92aXNpb25EYXRhW2AkeyB2aXNpb25UeXBlc1swXSB9YF0gPSB2aXNpb25EYXRhO1xuXHRcdFx0dmlzaW9uRGF0YSA9IF92aXNpb25EYXRhO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHRzID0ge307XG5cdFx0Zm9yIChjb25zdCBpbmRleCBpbiB2aXNpb25EYXRhKSB7XG5cdFx0XHRpZiAodmlzaW9uRGF0YS5oYXNPd25Qcm9wZXJ0eShpbmRleCkpIHtcblx0XHRcdFx0c3dpdGNoIChpbmRleCkge1xuXHRcdFx0XHRcdGNhc2UgJ2ZhY2VzJzpcblx0XHRcdFx0XHRjYXNlICdsYW5kbWFya3MnOlxuXHRcdFx0XHRcdGNhc2UgJ2xhYmVscyc6XG5cdFx0XHRcdFx0Y2FzZSAnc2ltaWxhcic6XG5cdFx0XHRcdFx0Y2FzZSAnbG9nb3MnOlxuXHRcdFx0XHRcdFx0cmVzdWx0c1tpbmRleF0gPSAocmVzdWx0c1tpbmRleF0gfHwgW10pLmNvbmNhdCh2aXNpb25EYXRhW2luZGV4XSB8fCBbXSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdzYWZlU2VhcmNoJzpcblx0XHRcdFx0XHRcdHJlc3VsdHNbJ3NhZmVTZWFyY2gnXSA9IHZpc2lvbkRhdGFbJ3NhZmVTZWFyY2gnXTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ3Byb3BlcnRpZXMnOlxuXHRcdFx0XHRcdFx0cmVzdWx0c1snY29sb3JzJ10gPSB2aXNpb25EYXRhW2luZGV4XVsnY29sb3JzJ107XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0cztcblx0fVxufVxuXG5Sb2NrZXRDaGF0Lkdvb2dsZVZpc2lvbiA9IG5ldyBHb29nbGVWaXNpb247XG4iLCJSb2NrZXRDaGF0Lm1vZGVscy5NZXNzYWdlcy5zZXRHb29nbGVWaXNpb25EYXRhID0gZnVuY3Rpb24obWVzc2FnZUlkLCB2aXNpb25EYXRhKSB7XG5cdGNvbnN0IHVwZGF0ZU9iaiA9IHt9O1xuXHRmb3IgKGNvbnN0IGluZGV4IGluIHZpc2lvbkRhdGEpIHtcblx0XHRpZiAodmlzaW9uRGF0YS5oYXNPd25Qcm9wZXJ0eShpbmRleCkpIHtcblx0XHRcdHVwZGF0ZU9ialtgYXR0YWNobWVudHMuMC4keyBpbmRleCB9YF0gPSB2aXNpb25EYXRhW2luZGV4XTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdGhpcy51cGRhdGUoeyBfaWQ6IG1lc3NhZ2VJZCB9LCB7ICRzZXQ6IHVwZGF0ZU9iaiB9KTtcbn07XG4iXX0=
