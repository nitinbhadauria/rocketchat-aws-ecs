(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var ECMAScript = Package.ecmascript.ECMAScript;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var HTTP = Package.http.HTTP;
var HTTPInternals = Package.http.HTTPInternals;
var Accounts = Package['accounts-base'].Accounts;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var SAML;

var require = meteorInstall({"node_modules":{"meteor":{"steffo:meteor-accounts-saml":{"saml_server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/steffo_meteor-accounts-saml/saml_server.js                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

if (!Accounts.saml) {
	Accounts.saml = {
		settings: {
			debug: true,
			generateUsername: false,
			providers: []
		}
	};
}

const fiber = Npm.require('fibers');

const connect = Npm.require('connect');

RoutePolicy.declare('/_saml/', 'network'); /**
                                            * Fetch SAML provider configs for given 'provider'.
                                            */

function getSamlProviderConfig(provider) {
	if (!provider) {
		throw new Meteor.Error('no-saml-provider', 'SAML internal error', {
			method: 'getSamlProviderConfig'
		});
	}

	const samlProvider = function (element) {
		return element.provider === provider;
	};

	return Accounts.saml.settings.providers.filter(samlProvider)[0];
}

Meteor.methods({
	samlLogout(provider) {
		// Make sure the user is logged in before initiate SAML SLO
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'samlLogout'
			});
		}

		const providerConfig = getSamlProviderConfig(provider);

		if (Accounts.saml.settings.debug) {
			console.log(`Logout request from ${JSON.stringify(providerConfig)}`);
		} // This query should respect upcoming array of SAML logins


		const user = Meteor.users.findOne({
			_id: Meteor.userId(),
			'services.saml.provider': provider
		}, {
			'services.saml': 1
		});
		let nameID = user.services.saml.nameID;
		const sessionIndex = user.services.saml.idpSession;
		nameID = sessionIndex;

		if (Accounts.saml.settings.debug) {
			console.log(`NameID for user ${Meteor.userId()} found: ${JSON.stringify(nameID)}`);
		}

		const _saml = new SAML(providerConfig);

		const request = _saml.generateLogoutRequest({
			nameID,
			sessionIndex
		}); // request.request: actual XML SAML Request
		// request.id: comminucation id which will be mentioned in the ResponseTo field of SAMLResponse


		Meteor.users.update({
			_id: Meteor.userId()
		}, {
			$set: {
				'services.saml.inResponseTo': request.id
			}
		});

		const _syncRequestToUrl = Meteor.wrapAsync(_saml.requestToUrl, _saml);

		const result = _syncRequestToUrl(request.request, 'logout');

		if (Accounts.saml.settings.debug) {
			console.log(`SAML Logout Request ${result}`);
		}

		return result;
	}

});
Accounts.registerLoginHandler(function (loginRequest) {
	if (!loginRequest.saml || !loginRequest.credentialToken) {
		return undefined;
	}

	const loginResult = Accounts.saml.retrieveCredential(loginRequest.credentialToken);

	if (Accounts.saml.settings.debug) {
		console.log(`RESULT :${JSON.stringify(loginResult)}`);
	}

	if (loginResult === undefined) {
		return {
			type: 'saml',
			error: new Meteor.Error(Accounts.LoginCancelledError.numericError, 'No matching login attempt found')
		};
	}

	if (loginResult && loginResult.profile && loginResult.profile.email) {
		const email = RegExp.escape(loginResult.profile.email);
		const emailRegex = new RegExp(`^${email}$`, 'i');
		let user = Meteor.users.findOne({
			'emails.address': emailRegex
		});

		if (!user) {
			const newUser = {
				name: loginResult.profile.cn || loginResult.profile.username,
				active: true,
				globalRoles: ['user'],
				emails: [{
					address: loginResult.profile.email,
					verified: true
				}]
			};

			if (Accounts.saml.settings.generateUsername === true) {
				const username = RocketChat.generateUsernameSuggestion(newUser);

				if (username) {
					newUser.username = username;
				}
			} else if (loginResult.profile.username) {
				newUser.username = loginResult.profile.username;
			}

			const userId = Accounts.insertUserDoc({}, newUser);
			user = Meteor.users.findOne(userId);
		} //creating the token and adding to the user


		const stampedToken = Accounts._generateStampedLoginToken();

		Meteor.users.update(user, {
			$push: {
				'services.resume.loginTokens': stampedToken
			}
		});
		const samlLogin = {
			provider: Accounts.saml.RelayState,
			idp: loginResult.profile.issuer,
			idpSession: loginResult.profile.sessionIndex,
			nameID: loginResult.profile.nameID
		};
		Meteor.users.update({
			_id: user._id
		}, {
			$set: {
				// TBD this should be pushed, otherwise we're only able to SSO into a single IDP at a time
				'services.saml': samlLogin
			}
		}); //sending token along with the userId

		const result = {
			userId: user._id,
			token: stampedToken.token
		};
		return result;
	} else {
		throw new Error('SAML Profile did not contain an email address');
	}
});
Accounts.saml._loginResultForCredentialToken = {};

Accounts.saml.hasCredential = function (credentialToken) {
	return _.has(Accounts.saml._loginResultForCredentialToken, credentialToken);
};

Accounts.saml.retrieveCredential = function (credentialToken) {
	// The credentialToken in all these functions corresponds to SAMLs inResponseTo field and is mandatory to check.
	const result = Accounts.saml._loginResultForCredentialToken[credentialToken];
	delete Accounts.saml._loginResultForCredentialToken[credentialToken];
	return result;
};

const closePopup = function (res, err) {
	res.writeHead(200, {
		'Content-Type': 'text/html'
	});
	let content = '<html><head><script>window.close()</script></head><body><H1>Verified</H1></body></html>';

	if (err) {
		content = `<html><body><h2>Sorry, an annoying error occured</h2><div>${err}</div><a onclick="window.close();">Close Window</a></body></html>`;
	}

	res.end(content, 'utf-8');
};

const samlUrlToObject = function (url) {
	// req.url will be '/_saml/<action>/<service name>/<credentialToken>'
	if (!url) {
		return null;
	}

	const splitUrl = url.split('?');
	const splitPath = splitUrl[0].split('/'); // Any non-saml request will continue down the default
	// middlewares.

	if (splitPath[1] !== '_saml') {
		return null;
	}

	const result = {
		actionName: splitPath[2],
		serviceName: splitPath[3],
		credentialToken: splitPath[4]
	};

	if (Accounts.saml.settings.debug) {
		console.log(result);
	}

	return result;
};

const middleware = function (req, res, next) {
	// Make sure to catch any exceptions because otherwise we'd crash
	// the runner
	try {
		const samlObject = samlUrlToObject(req.url);

		if (!samlObject || !samlObject.serviceName) {
			next();
			return;
		}

		if (!samlObject.actionName) {
			throw new Error('Missing SAML action');
		}

		console.log(Accounts.saml.settings.providers);
		console.log(samlObject.serviceName);

		const service = _.find(Accounts.saml.settings.providers, function (samlSetting) {
			return samlSetting.provider === samlObject.serviceName;
		}); // Skip everything if there's no service set by the saml middleware


		if (!service) {
			throw new Error(`Unexpected SAML service ${samlObject.serviceName}`);
		}

		let _saml;

		switch (samlObject.actionName) {
			case 'metadata':
				_saml = new SAML(service);
				service.callbackUrl = Meteor.absoluteUrl(`_saml/validate/${service.provider}`);
				res.writeHead(200);
				res.write(_saml.generateServiceProviderMetadata(service.callbackUrl));
				res.end(); //closePopup(res);

				break;

			case 'logout':
				// This is where we receive SAML LogoutResponse
				_saml = new SAML(service);

				_saml.validateLogoutResponse(req.query.SAMLResponse, function (err, result) {
					if (!err) {
						const logOutUser = function (inResponseTo) {
							if (Accounts.saml.settings.debug) {
								console.log(`Logging Out user via inResponseTo ${inResponseTo}`);
							}

							const loggedOutUser = Meteor.users.find({
								'services.saml.inResponseTo': inResponseTo
							}).fetch();

							if (loggedOutUser.length === 1) {
								if (Accounts.saml.settings.debug) {
									console.log(`Found user ${loggedOutUser[0]._id}`);
								}

								Meteor.users.update({
									_id: loggedOutUser[0]._id
								}, {
									$set: {
										'services.resume.loginTokens': []
									}
								});
								Meteor.users.update({
									_id: loggedOutUser[0]._id
								}, {
									$unset: {
										'services.saml': ''
									}
								});
							} else {
								throw new Meteor.Error('Found multiple users matching SAML inResponseTo fields');
							}
						};

						fiber(function () {
							logOutUser(result);
						}).run();
						res.writeHead(302, {
							'Location': req.query.RelayState
						});
						res.end();
					} //  else {
					// 	// TBD thinking of sth meaning full.
					// }

				});

				break;

			case 'sloRedirect':
				res.writeHead(302, {
					// credentialToken here is the SAML LogOut Request that we'll send back to IDP
					'Location': req.query.redirect
				});
				res.end();
				break;

			case 'authorize':
				service.callbackUrl = Meteor.absoluteUrl(`_saml/validate/${service.provider}`);
				service.id = samlObject.credentialToken;
				_saml = new SAML(service);

				_saml.getAuthorizeUrl(req, function (err, url) {
					if (err) {
						throw new Error('Unable to generate authorize url');
					}

					res.writeHead(302, {
						'Location': url
					});
					res.end();
				});

				break;

			case 'validate':
				_saml = new SAML(service);
				Accounts.saml.RelayState = req.body.RelayState;

				_saml.validateResponse(req.body.SAMLResponse, req.body.RelayState, function (err, profile /*, loggedOut*/) {
					if (err) {
						throw new Error(`Unable to validate response url: ${err}`);
					}

					const credentialToken = profile.inResponseToId || profile.InResponseTo || samlObject.credentialToken;

					if (!credentialToken) {
						// No credentialToken in IdP-initiated SSO
						const saml_idp_credentialToken = Random.id();
						Accounts.saml._loginResultForCredentialToken[saml_idp_credentialToken] = {
							profile
						};
						const url = `${Meteor.absoluteUrl('home')}?saml_idp_credentialToken=${saml_idp_credentialToken}`;
						res.writeHead(302, {
							'Location': url
						});
						res.end();
					} else {
						Accounts.saml._loginResultForCredentialToken[credentialToken] = {
							profile
						};
						closePopup(res);
					}
				});

				break;

			default:
				throw new Error(`Unexpected SAML action ${samlObject.actionName}`);
		}
	} catch (err) {
		closePopup(res, err);
	}
}; // Listen to incoming SAML http requests


WebApp.connectHandlers.use(connect.bodyParser()).use(function (req, res, next) {
	// Need to create a fiber since we're using synchronous http calls and nothing
	// else is wrapping this in a fiber automatically
	fiber(function () {
		middleware(req, res, next);
	}).run();
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saml_utils.js":function(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/steffo_meteor-accounts-saml/saml_utils.js                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* globals SAML:true */const zlib = Npm.require('zlib');

const xml2js = Npm.require('xml2js');

const xmlCrypto = Npm.require('xml-crypto');

const crypto = Npm.require('crypto');

const xmldom = Npm.require('xmldom');

const querystring = Npm.require('querystring');

const xmlbuilder = Npm.require('xmlbuilder'); // var prefixMatch = new RegExp(/(?!xmlns)^.*:/);


SAML = function (options) {
	this.options = this.initialize(options);
}; // var stripPrefix = function(str) {
// 	return str.replace(prefixMatch, '');
// };


SAML.prototype.initialize = function (options) {
	if (!options) {
		options = {};
	}

	if (!options.protocol) {
		options.protocol = 'https://';
	}

	if (!options.path) {
		options.path = '/saml/consume';
	}

	if (!options.issuer) {
		options.issuer = 'onelogin_saml';
	}

	if (options.identifierFormat === undefined) {
		options.identifierFormat = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';
	}

	if (options.authnContext === undefined) {
		options.authnContext = 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport';
	}

	return options;
};

SAML.prototype.generateUniqueID = function () {
	const chars = 'abcdef0123456789';
	let uniqueID = 'id-';

	for (let i = 0; i < 20; i++) {
		uniqueID += chars.substr(Math.floor(Math.random() * 15), 1);
	}

	return uniqueID;
};

SAML.prototype.generateInstant = function () {
	return new Date().toISOString();
};

SAML.prototype.signRequest = function (xml) {
	const signer = crypto.createSign('RSA-SHA1');
	signer.update(xml);
	return signer.sign(this.options.privateKey, 'base64');
};

SAML.prototype.generateAuthorizeRequest = function (req) {
	let id = `_${this.generateUniqueID()}`;
	const instant = this.generateInstant(); // Post-auth destination

	let callbackUrl;

	if (this.options.callbackUrl) {
		callbackUrl = this.options.callbackUrl;
	} else {
		callbackUrl = this.options.protocol + req.headers.host + this.options.path;
	}

	if (this.options.id) {
		id = this.options.id;
	}

	let request = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${id}" Version="2.0" IssueInstant="${instant}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" AssertionConsumerServiceURL="${callbackUrl}" Destination="${this.options.entryPoint}">` + `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.options.issuer}</saml:Issuer>\n`;

	if (this.options.identifierFormat) {
		request += `<samlp:NameIDPolicy xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" Format="${this.options.identifierFormat}" AllowCreate="true"></samlp:NameIDPolicy>\n`;
	}

	request += '<samlp:RequestedAuthnContext xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" Comparison="exact">' + '<saml:AuthnContextClassRef xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></samlp:RequestedAuthnContext>\n' + '</samlp:AuthnRequest>';
	return request;
};

SAML.prototype.generateLogoutRequest = function (options) {
	// options should be of the form
	// nameId: <nameId as submitted during SAML SSO>
	// sessionIndex: sessionIndex
	// --- NO SAMLsettings: <Meteor.setting.saml  entry for the provider you want to SLO from
	const id = `_${this.generateUniqueID()}`;
	const instant = this.generateInstant();
	let request = `${'<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ' + 'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="'}${id}" Version="2.0" IssueInstant="${instant}" Destination="${this.options.idpSLORedirectURL}">` + `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.options.issuer}</saml:Issuer>` + `<saml:NameID Format="${this.options.identifierFormat}">${options.nameID}</saml:NameID>` + '</samlp:LogoutRequest>';
	request = `${'<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"  ' + 'ID="'}${id}" ` + 'Version="2.0" ' + `IssueInstant="${instant}" ` + `Destination="${this.options.idpSLORedirectURL}" ` + '>' + `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.options.issuer}</saml:Issuer>` + '<saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ' + 'NameQualifier="http://id.init8.net:8080/openam" ' + `SPNameQualifier="${this.options.issuer}" ` + `Format="${this.options.identifierFormat}">${options.nameID}</saml:NameID>` + `<samlp:SessionIndex xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">${options.sessionIndex}</samlp:SessionIndex>` + '</samlp:LogoutRequest>';

	if (Meteor.settings.debug) {
		console.log('------- SAML Logout request -----------');
		console.log(request);
	}

	return {
		request,
		id
	};
};

SAML.prototype.requestToUrl = function (request, operation, callback) {
	const self = this;
	zlib.deflateRaw(request, function (err, buffer) {
		if (err) {
			return callback(err);
		}

		const base64 = buffer.toString('base64');
		let target = self.options.entryPoint;

		if (operation === 'logout') {
			if (self.options.idpSLORedirectURL) {
				target = self.options.idpSLORedirectURL;
			}
		}

		if (target.indexOf('?') > 0) {
			target += '&';
		} else {
			target += '?';
		} // TBD. We should really include a proper RelayState here


		let relayState;

		if (operation === 'logout') {
			// in case of logout we want to be redirected back to the Meteor app.
			relayState = Meteor.absoluteUrl();
		} else {
			relayState = self.options.provider;
		}

		const samlRequest = {
			SAMLRequest: base64,
			RelayState: relayState
		};

		if (self.options.privateCert) {
			samlRequest.SigAlg = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
			samlRequest.Signature = self.signRequest(querystring.stringify(samlRequest));
		}

		target += querystring.stringify(samlRequest);

		if (Meteor.settings.debug) {
			console.log(`requestToUrl: ${target}`);
		}

		if (operation === 'logout') {
			// in case of logout we want to be redirected back to the Meteor app.
			return callback(null, target);
		} else {
			callback(null, target);
		}
	});
};

SAML.prototype.getAuthorizeUrl = function (req, callback) {
	const request = this.generateAuthorizeRequest(req);
	this.requestToUrl(request, 'authorize', callback);
};

SAML.prototype.getLogoutUrl = function (req, callback) {
	const request = this.generateLogoutRequest(req);
	this.requestToUrl(request, 'logout', callback);
};

SAML.prototype.certToPEM = function (cert) {
	cert = cert.match(/.{1,64}/g).join('\n');
	cert = `-----BEGIN CERTIFICATE-----\n${cert}`;
	cert = `${cert}\n-----END CERTIFICATE-----\n`;
	return cert;
}; // functionfindChilds(node, localName, namespace) {
// 	var res = [];
// 	for (var i = 0; i < node.childNodes.length; i++) {
// 		var child = node.childNodes[i];
// 		if (child.localName === localName && (child.namespaceURI === namespace || !namespace)) {
// 			res.push(child);
// 		}
// 	}
// 	return res;
// }


SAML.prototype.validateSignature = function (xml, cert) {
	const self = this;
	const doc = new xmldom.DOMParser().parseFromString(xml);
	const signature = xmlCrypto.xpath(doc, '//*[local-name(.)=\'Signature\' and namespace-uri(.)=\'http://www.w3.org/2000/09/xmldsig#\']')[0];
	const sig = new xmlCrypto.SignedXml();
	sig.keyInfoProvider = {
		getKeyInfo() /*key*/{
			return '<X509Data></X509Data>';
		},

		getKey() /*keyInfo*/{
			return self.certToPEM(cert);
		}

	};
	sig.loadSignature(signature);
	return sig.checkSignature(xml);
};

SAML.prototype.getElement = function (parentElement, elementName) {
	if (parentElement[`saml:${elementName}`]) {
		return parentElement[`saml:${elementName}`];
	} else if (parentElement[`samlp:${elementName}`]) {
		return parentElement[`samlp:${elementName}`];
	} else if (parentElement[`saml2p:${elementName}`]) {
		return parentElement[`saml2p:${elementName}`];
	} else if (parentElement[`saml2:${elementName}`]) {
		return parentElement[`saml2:${elementName}`];
	} else if (parentElement[`ns0:${elementName}`]) {
		return parentElement[`ns0:${elementName}`];
	} else if (parentElement[`ns1:${elementName}`]) {
		return parentElement[`ns1:${elementName}`];
	}

	return parentElement[elementName];
};

SAML.prototype.validateLogoutResponse = function (samlResponse, callback) {
	const self = this;
	const compressedSAMLResponse = new Buffer(samlResponse, 'base64');
	zlib.inflateRaw(compressedSAMLResponse, function (err, decoded) {
		if (err) {
			if (Meteor.settings.debug) {
				console.log(err);
			}
		} else {
			const parser = new xml2js.Parser({
				explicitRoot: true
			});
			parser.parseString(decoded, function (err, doc) {
				const response = self.getElement(doc, 'LogoutResponse');

				if (response) {
					// TBD. Check if this msg corresponds to one we sent
					const inResponseTo = response.$.InResponseTo;

					if (Meteor.settings.debug) {
						console.log(`In Response to: ${inResponseTo}`);
					}

					const status = self.getElement(response, 'Status');
					const statusCode = self.getElement(status[0], 'StatusCode')[0].$.Value;

					if (Meteor.settings.debug) {
						console.log(`StatusCode: ${JSON.stringify(statusCode)}`);
					}

					if (statusCode === 'urn:oasis:names:tc:SAML:2.0:status:Success') {
						// In case of a successful logout at IDP we return inResponseTo value.
						// This is the only way how we can identify the Meteor user (as we don't use Session Cookies)
						callback(null, inResponseTo);
					} else {
						callback('Error. Logout not confirmed by IDP', null);
					}
				} else {
					callback('No Response Found', null);
				}
			});
		}
	});
};

SAML.prototype.validateResponse = function (samlResponse, relayState, callback) {
	const self = this;
	const xml = new Buffer(samlResponse, 'base64').toString('utf8'); // We currently use RelayState to save SAML provider

	if (Meteor.settings.debug) {
		console.log(`Validating response with relay state: ${xml}`);
	}

	const parser = new xml2js.Parser({
		explicitRoot: true,
		xmlns: true
	});
	parser.parseString(xml, function (err, doc) {
		// Verify signature
		if (Meteor.settings.debug) {
			console.log('Verify signature');
		}

		if (self.options.cert && !self.validateSignature(xml, self.options.cert)) {
			if (Meteor.settings.debug) {
				console.log('Signature WRONG');
			}

			return callback(new Error('Invalid signature'), null, false);
		}

		if (Meteor.settings.debug) {
			console.log('Signature OK');
		}

		const response = self.getElement(doc, 'Response');

		if (Meteor.settings.debug) {
			console.log('Got response');
		}

		if (response) {
			const assertion = self.getElement(response, 'Assertion');

			if (!assertion) {
				return callback(new Error('Missing SAML assertion'), null, false);
			}

			const profile = {};

			if (response.$ && response.$.InResponseTo) {
				profile.inResponseToId = response.$.InResponseTo;
			}

			const issuer = self.getElement(assertion[0], 'Issuer');

			if (issuer) {
				profile.issuer = issuer[0]._;
			}

			const subject = self.getElement(assertion[0], 'Subject');

			if (subject) {
				const nameID = self.getElement(subject[0], 'NameID');

				if (nameID) {
					profile.nameID = nameID[0]._;

					if (nameID[0].$.Format) {
						profile.nameIDFormat = nameID[0].$.Format;
					}
				}
			}

			const authnStatement = self.getElement(assertion[0], 'AuthnStatement');

			if (authnStatement) {
				if (authnStatement[0].$.SessionIndex) {
					profile.sessionIndex = authnStatement[0].$.SessionIndex;

					if (Meteor.settings.debug) {
						console.log(`Session Index: ${profile.sessionIndex}`);
					}
				} else if (Meteor.settings.debug) {
					console.log('No Session Index Found');
				}
			} else if (Meteor.settings.debug) {
				console.log('No AuthN Statement found');
			}

			const attributeStatement = self.getElement(assertion[0], 'AttributeStatement');

			if (attributeStatement) {
				const attributes = self.getElement(attributeStatement[0], 'Attribute');

				if (attributes) {
					attributes.forEach(function (attribute) {
						const value = self.getElement(attribute, 'AttributeValue');

						if (typeof value[0] === 'string') {
							profile[attribute.$.Name] = value[0];
						} else {
							profile[attribute.$.Name] = value[0]._;
						}
					});
				}

				if (!profile.mail && profile['urn:oid:0.9.2342.19200300.100.1.3']) {
					// See http://www.incommonfederation.org/attributesummary.html for definition of attribute OIDs
					profile.mail = profile['urn:oid:0.9.2342.19200300.100.1.3'];
				}

				if (!profile.email && profile.mail) {
					profile.email = profile.mail;
				}
			}

			if (!profile.email && profile.nameID && profile.nameIDFormat && profile.nameIDFormat.indexOf('emailAddress') >= 0) {
				profile.email = profile.nameID;
			}

			if (Meteor.settings.debug) {
				console.log(`NameID: ${JSON.stringify(profile)}`);
			}

			callback(null, profile, false);
		} else {
			const logoutResponse = self.getElement(doc, 'LogoutResponse');

			if (logoutResponse) {
				callback(null, null, true);
			} else {
				return callback(new Error('Unknown SAML response message'), null, false);
			}
		}
	});
};

let decryptionCert;

SAML.prototype.generateServiceProviderMetadata = function (callbackUrl) {
	if (!decryptionCert) {
		decryptionCert = this.options.privateCert;
	}

	if (!this.options.callbackUrl && !callbackUrl) {
		throw new Error('Unable to generate service provider metadata when callbackUrl option is not set');
	}

	const metadata = {
		'EntityDescriptor': {
			'@xmlns': 'urn:oasis:names:tc:SAML:2.0:metadata',
			'@xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
			'@entityID': this.options.issuer,
			'SPSSODescriptor': {
				'@protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
				'SingleLogoutService': {
					'@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
					'@Location': `${Meteor.absoluteUrl()}_saml/logout/${this.options.provider}/`,
					'@ResponseLocation': `${Meteor.absoluteUrl()}_saml/logout/${this.options.provider}/`
				},
				'NameIDFormat': this.options.identifierFormat,
				'AssertionConsumerService': {
					'@index': '1',
					'@isDefault': 'true',
					'@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
					'@Location': callbackUrl
				}
			}
		}
	};

	if (this.options.privateKey) {
		if (!decryptionCert) {
			throw new Error('Missing decryptionCert while generating metadata for decrypting service provider');
		}

		decryptionCert = decryptionCert.replace(/-+BEGIN CERTIFICATE-+\r?\n?/, '');
		decryptionCert = decryptionCert.replace(/-+END CERTIFICATE-+\r?\n?/, '');
		decryptionCert = decryptionCert.replace(/\r\n/g, '\n');
		metadata['EntityDescriptor']['SPSSODescriptor']['KeyDescriptor'] = {
			'ds:KeyInfo': {
				'ds:X509Data': {
					'ds:X509Certificate': {
						'#text': decryptionCert
					}
				}
			},
			'#list': [// this should be the set that the xmlenc library supports
			{
				'EncryptionMethod': {
					'@Algorithm': 'http://www.w3.org/2001/04/xmlenc#aes256-cbc'
				}
			}, {
				'EncryptionMethod': {
					'@Algorithm': 'http://www.w3.org/2001/04/xmlenc#aes128-cbc'
				}
			}, {
				'EncryptionMethod': {
					'@Algorithm': 'http://www.w3.org/2001/04/xmlenc#tripledes-cbc'
				}
			}]
		};
	}

	return xmlbuilder.create(metadata).end({
		pretty: true,
		indent: '  ',
		newline: '\n'
	});
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"saml_rocketchat.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/steffo_meteor-accounts-saml/saml_rocketchat.js                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
	updateServices: () => updateServices,
	configureSamlService: () => configureSamlService,
	getSamlConfigs: () => getSamlConfigs,
	debounce: () => debounce,
	logger: () => logger
});
const logger = new Logger('steffo:meteor-accounts-saml', {
	methods: {
		updated: {
			type: 'info'
		}
	}
});
RocketChat.settings.addGroup('SAML');
Meteor.methods({
	addSamlService(name) {
		RocketChat.settings.add(`SAML_Custom_${name}`, false, {
			type: 'boolean',
			group: 'SAML',
			section: name,
			i18nLabel: 'Accounts_OAuth_Custom_Enable'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_provider`, 'provider-name', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'SAML_Custom_Provider'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_entry_point`, 'https://example.com/simplesaml/saml2/idp/SSOService.php', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'SAML_Custom_Entry_point'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_idp_slo_redirect_url`, 'https://example.com/simplesaml/saml2/idp/SingleLogoutService.php', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'SAML_Custom_IDP_SLO_Redirect_URL'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_issuer`, 'https://your-rocket-chat/_saml/metadata/provider-name', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'SAML_Custom_Issuer'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_cert`, '', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'SAML_Custom_Cert',
			multiline: true
		});
		RocketChat.settings.add(`SAML_Custom_${name}_public_cert`, '', {
			type: 'string',
			group: 'SAML',
			section: name,
			multiline: true,
			i18nLabel: 'SAML_Custom_Public_Cert'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_private_key`, '', {
			type: 'string',
			group: 'SAML',
			section: name,
			multiline: true,
			i18nLabel: 'SAML_Custom_Private_Key'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_button_label_text`, '', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'Accounts_OAuth_Custom_Button_Label_Text'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_button_label_color`, '#FFFFFF', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'Accounts_OAuth_Custom_Button_Label_Color'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_button_color`, '#13679A', {
			type: 'string',
			group: 'SAML',
			section: name,
			i18nLabel: 'Accounts_OAuth_Custom_Button_Color'
		});
		RocketChat.settings.add(`SAML_Custom_${name}_generate_username`, false, {
			type: 'boolean',
			group: 'SAML',
			section: name,
			i18nLabel: 'SAML_Custom_Generate_Username'
		});
	}

});

const getSamlConfigs = function (service) {
	return {
		buttonLabelText: RocketChat.settings.get(`${service.key}_button_label_text`),
		buttonLabelColor: RocketChat.settings.get(`${service.key}_button_label_color`),
		buttonColor: RocketChat.settings.get(`${service.key}_button_color`),
		clientConfig: {
			provider: RocketChat.settings.get(`${service.key}_provider`)
		},
		entryPoint: RocketChat.settings.get(`${service.key}_entry_point`),
		idpSLORedirectURL: RocketChat.settings.get(`${service.key}_idp_slo_redirect_url`),
		generateUsername: RocketChat.settings.get(`${service.key}_generate_username`),
		issuer: RocketChat.settings.get(`${service.key}_issuer`),
		secret: {
			privateKey: RocketChat.settings.get(`${service.key}_private_key`),
			publicCert: RocketChat.settings.get(`${service.key}_public_cert`),
			cert: RocketChat.settings.get(`${service.key}_cert`)
		}
	};
};

const debounce = (fn, delay) => {
	let timer = null;
	return () => {
		if (timer != null) {
			Meteor.clearTimeout(timer);
		}

		return timer = Meteor.setTimeout(fn, delay);
	};
};

const serviceName = 'saml';

const configureSamlService = function (samlConfigs) {
	let privateCert = false;
	let privateKey = false;

	if (samlConfigs.secret.privateKey && samlConfigs.secret.publicCert) {
		privateKey = samlConfigs.secret.privateKey;
		privateCert = samlConfigs.secret.publicCert;
	} else if (samlConfigs.secret.privateKey || samlConfigs.secret.publicCert) {
		logger.error('You must specify both cert and key files.');
	} // TODO: the function configureSamlService is called many times and Accounts.saml.settings.generateUsername keeps just the last value


	Accounts.saml.settings.generateUsername = samlConfigs.generateUsername;
	return {
		provider: samlConfigs.clientConfig.provider,
		entryPoint: samlConfigs.entryPoint,
		idpSLORedirectURL: samlConfigs.idpSLORedirectURL,
		issuer: samlConfigs.issuer,
		cert: samlConfigs.secret.cert,
		privateCert,
		privateKey
	};
};

const updateServices = debounce(() => {
	const services = RocketChat.settings.get(/^(SAML_Custom_)[a-z]+$/i);
	Accounts.saml.settings.providers = services.map(service => {
		if (service.value === true) {
			const samlConfigs = getSamlConfigs(service);
			logger.updated(service.key);
			ServiceConfiguration.configurations.upsert({
				service: serviceName.toLowerCase()
			}, {
				$set: samlConfigs
			});
			return configureSamlService(samlConfigs);
		} else {
			ServiceConfiguration.configurations.remove({
				service: serviceName.toLowerCase()
			});
		}
	}).filter(e => e);
}, 2000);
RocketChat.settings.get(/^SAML_.+/, updateServices);
Meteor.startup(() => {
	return Meteor.call('addSamlService', 'Default');
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/steffo:meteor-accounts-saml/saml_server.js");
require("./node_modules/meteor/steffo:meteor-accounts-saml/saml_utils.js");
require("./node_modules/meteor/steffo:meteor-accounts-saml/saml_rocketchat.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['steffo:meteor-accounts-saml'] = {};

})();

//# sourceURL=meteor://💻app/packages/steffo_meteor-accounts-saml.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZmZvOm1ldGVvci1hY2NvdW50cy1zYW1sL3NhbWxfc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zdGVmZm86bWV0ZW9yLWFjY291bnRzLXNhbWwvc2FtbF91dGlscy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZmZvOm1ldGVvci1hY2NvdW50cy1zYW1sL3NhbWxfcm9ja2V0Y2hhdC5qcyJdLCJuYW1lcyI6WyJfIiwibW9kdWxlIiwid2F0Y2giLCJyZXF1aXJlIiwiZGVmYXVsdCIsInYiLCJBY2NvdW50cyIsInNhbWwiLCJzZXR0aW5ncyIsImRlYnVnIiwiZ2VuZXJhdGVVc2VybmFtZSIsInByb3ZpZGVycyIsImZpYmVyIiwiTnBtIiwiY29ubmVjdCIsIlJvdXRlUG9saWN5IiwiZGVjbGFyZSIsImdldFNhbWxQcm92aWRlckNvbmZpZyIsInByb3ZpZGVyIiwiTWV0ZW9yIiwiRXJyb3IiLCJtZXRob2QiLCJzYW1sUHJvdmlkZXIiLCJlbGVtZW50IiwiZmlsdGVyIiwibWV0aG9kcyIsInNhbWxMb2dvdXQiLCJ1c2VySWQiLCJwcm92aWRlckNvbmZpZyIsImNvbnNvbGUiLCJsb2ciLCJKU09OIiwic3RyaW5naWZ5IiwidXNlciIsInVzZXJzIiwiZmluZE9uZSIsIl9pZCIsIm5hbWVJRCIsInNlcnZpY2VzIiwic2Vzc2lvbkluZGV4IiwiaWRwU2Vzc2lvbiIsIl9zYW1sIiwiU0FNTCIsInJlcXVlc3QiLCJnZW5lcmF0ZUxvZ291dFJlcXVlc3QiLCJ1cGRhdGUiLCIkc2V0IiwiaWQiLCJfc3luY1JlcXVlc3RUb1VybCIsIndyYXBBc3luYyIsInJlcXVlc3RUb1VybCIsInJlc3VsdCIsInJlZ2lzdGVyTG9naW5IYW5kbGVyIiwibG9naW5SZXF1ZXN0IiwiY3JlZGVudGlhbFRva2VuIiwidW5kZWZpbmVkIiwibG9naW5SZXN1bHQiLCJyZXRyaWV2ZUNyZWRlbnRpYWwiLCJ0eXBlIiwiZXJyb3IiLCJMb2dpbkNhbmNlbGxlZEVycm9yIiwibnVtZXJpY0Vycm9yIiwicHJvZmlsZSIsImVtYWlsIiwiUmVnRXhwIiwiZXNjYXBlIiwiZW1haWxSZWdleCIsIm5ld1VzZXIiLCJuYW1lIiwiY24iLCJ1c2VybmFtZSIsImFjdGl2ZSIsImdsb2JhbFJvbGVzIiwiZW1haWxzIiwiYWRkcmVzcyIsInZlcmlmaWVkIiwiUm9ja2V0Q2hhdCIsImdlbmVyYXRlVXNlcm5hbWVTdWdnZXN0aW9uIiwiaW5zZXJ0VXNlckRvYyIsInN0YW1wZWRUb2tlbiIsIl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuIiwiJHB1c2giLCJzYW1sTG9naW4iLCJSZWxheVN0YXRlIiwiaWRwIiwiaXNzdWVyIiwidG9rZW4iLCJfbG9naW5SZXN1bHRGb3JDcmVkZW50aWFsVG9rZW4iLCJoYXNDcmVkZW50aWFsIiwiaGFzIiwiY2xvc2VQb3B1cCIsInJlcyIsImVyciIsIndyaXRlSGVhZCIsImNvbnRlbnQiLCJlbmQiLCJzYW1sVXJsVG9PYmplY3QiLCJ1cmwiLCJzcGxpdFVybCIsInNwbGl0Iiwic3BsaXRQYXRoIiwiYWN0aW9uTmFtZSIsInNlcnZpY2VOYW1lIiwibWlkZGxld2FyZSIsInJlcSIsIm5leHQiLCJzYW1sT2JqZWN0Iiwic2VydmljZSIsImZpbmQiLCJzYW1sU2V0dGluZyIsImNhbGxiYWNrVXJsIiwiYWJzb2x1dGVVcmwiLCJ3cml0ZSIsImdlbmVyYXRlU2VydmljZVByb3ZpZGVyTWV0YWRhdGEiLCJ2YWxpZGF0ZUxvZ291dFJlc3BvbnNlIiwicXVlcnkiLCJTQU1MUmVzcG9uc2UiLCJsb2dPdXRVc2VyIiwiaW5SZXNwb25zZVRvIiwibG9nZ2VkT3V0VXNlciIsImZldGNoIiwibGVuZ3RoIiwiJHVuc2V0IiwicnVuIiwicmVkaXJlY3QiLCJnZXRBdXRob3JpemVVcmwiLCJib2R5IiwidmFsaWRhdGVSZXNwb25zZSIsImluUmVzcG9uc2VUb0lkIiwiSW5SZXNwb25zZVRvIiwic2FtbF9pZHBfY3JlZGVudGlhbFRva2VuIiwiUmFuZG9tIiwiV2ViQXBwIiwiY29ubmVjdEhhbmRsZXJzIiwidXNlIiwiYm9keVBhcnNlciIsInpsaWIiLCJ4bWwyanMiLCJ4bWxDcnlwdG8iLCJjcnlwdG8iLCJ4bWxkb20iLCJxdWVyeXN0cmluZyIsInhtbGJ1aWxkZXIiLCJvcHRpb25zIiwiaW5pdGlhbGl6ZSIsInByb3RvdHlwZSIsInByb3RvY29sIiwicGF0aCIsImlkZW50aWZpZXJGb3JtYXQiLCJhdXRobkNvbnRleHQiLCJnZW5lcmF0ZVVuaXF1ZUlEIiwiY2hhcnMiLCJ1bmlxdWVJRCIsImkiLCJzdWJzdHIiLCJNYXRoIiwiZmxvb3IiLCJyYW5kb20iLCJnZW5lcmF0ZUluc3RhbnQiLCJEYXRlIiwidG9JU09TdHJpbmciLCJzaWduUmVxdWVzdCIsInhtbCIsInNpZ25lciIsImNyZWF0ZVNpZ24iLCJzaWduIiwicHJpdmF0ZUtleSIsImdlbmVyYXRlQXV0aG9yaXplUmVxdWVzdCIsImluc3RhbnQiLCJoZWFkZXJzIiwiaG9zdCIsImVudHJ5UG9pbnQiLCJpZHBTTE9SZWRpcmVjdFVSTCIsIm9wZXJhdGlvbiIsImNhbGxiYWNrIiwic2VsZiIsImRlZmxhdGVSYXciLCJidWZmZXIiLCJiYXNlNjQiLCJ0b1N0cmluZyIsInRhcmdldCIsImluZGV4T2YiLCJyZWxheVN0YXRlIiwic2FtbFJlcXVlc3QiLCJTQU1MUmVxdWVzdCIsInByaXZhdGVDZXJ0IiwiU2lnQWxnIiwiU2lnbmF0dXJlIiwiZ2V0TG9nb3V0VXJsIiwiY2VydFRvUEVNIiwiY2VydCIsIm1hdGNoIiwiam9pbiIsInZhbGlkYXRlU2lnbmF0dXJlIiwiZG9jIiwiRE9NUGFyc2VyIiwicGFyc2VGcm9tU3RyaW5nIiwic2lnbmF0dXJlIiwieHBhdGgiLCJzaWciLCJTaWduZWRYbWwiLCJrZXlJbmZvUHJvdmlkZXIiLCJnZXRLZXlJbmZvIiwiZ2V0S2V5IiwibG9hZFNpZ25hdHVyZSIsImNoZWNrU2lnbmF0dXJlIiwiZ2V0RWxlbWVudCIsInBhcmVudEVsZW1lbnQiLCJlbGVtZW50TmFtZSIsInNhbWxSZXNwb25zZSIsImNvbXByZXNzZWRTQU1MUmVzcG9uc2UiLCJCdWZmZXIiLCJpbmZsYXRlUmF3IiwiZGVjb2RlZCIsInBhcnNlciIsIlBhcnNlciIsImV4cGxpY2l0Um9vdCIsInBhcnNlU3RyaW5nIiwicmVzcG9uc2UiLCIkIiwic3RhdHVzIiwic3RhdHVzQ29kZSIsIlZhbHVlIiwieG1sbnMiLCJhc3NlcnRpb24iLCJzdWJqZWN0IiwiRm9ybWF0IiwibmFtZUlERm9ybWF0IiwiYXV0aG5TdGF0ZW1lbnQiLCJTZXNzaW9uSW5kZXgiLCJhdHRyaWJ1dGVTdGF0ZW1lbnQiLCJhdHRyaWJ1dGVzIiwiZm9yRWFjaCIsImF0dHJpYnV0ZSIsInZhbHVlIiwiTmFtZSIsIm1haWwiLCJsb2dvdXRSZXNwb25zZSIsImRlY3J5cHRpb25DZXJ0IiwibWV0YWRhdGEiLCJyZXBsYWNlIiwiY3JlYXRlIiwicHJldHR5IiwiaW5kZW50IiwibmV3bGluZSIsImV4cG9ydCIsInVwZGF0ZVNlcnZpY2VzIiwiY29uZmlndXJlU2FtbFNlcnZpY2UiLCJnZXRTYW1sQ29uZmlncyIsImRlYm91bmNlIiwibG9nZ2VyIiwiTG9nZ2VyIiwidXBkYXRlZCIsImFkZEdyb3VwIiwiYWRkU2FtbFNlcnZpY2UiLCJhZGQiLCJncm91cCIsInNlY3Rpb24iLCJpMThuTGFiZWwiLCJtdWx0aWxpbmUiLCJidXR0b25MYWJlbFRleHQiLCJnZXQiLCJrZXkiLCJidXR0b25MYWJlbENvbG9yIiwiYnV0dG9uQ29sb3IiLCJjbGllbnRDb25maWciLCJzZWNyZXQiLCJwdWJsaWNDZXJ0IiwiZm4iLCJkZWxheSIsInRpbWVyIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsInNhbWxDb25maWdzIiwibWFwIiwiU2VydmljZUNvbmZpZ3VyYXRpb24iLCJjb25maWd1cmF0aW9ucyIsInVwc2VydCIsInRvTG93ZXJDYXNlIiwicmVtb3ZlIiwiZSIsInN0YXJ0dXAiLCJjYWxsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEOztBQUlOLElBQUksQ0FBQ0MsU0FBU0MsSUFBZCxFQUFvQjtBQUNuQkQsVUFBU0MsSUFBVCxHQUFnQjtBQUNmQyxZQUFVO0FBQ1RDLFVBQU8sSUFERTtBQUVUQyxxQkFBa0IsS0FGVDtBQUdUQyxjQUFXO0FBSEY7QUFESyxFQUFoQjtBQU9BOztBQUVELE1BQU1DLFFBQVFDLElBQUlWLE9BQUosQ0FBWSxRQUFaLENBQWQ7O0FBQ0EsTUFBTVcsVUFBVUQsSUFBSVYsT0FBSixDQUFZLFNBQVosQ0FBaEI7O0FBQ0FZLFlBQVlDLE9BQVosQ0FBb0IsU0FBcEIsRUFBK0IsU0FBL0IsRSxDQUVBOzs7O0FBR0EsU0FBU0MscUJBQVQsQ0FBK0JDLFFBQS9CLEVBQXlDO0FBQ3hDLEtBQUksQ0FBRUEsUUFBTixFQUFnQjtBQUNmLFFBQU0sSUFBSUMsT0FBT0MsS0FBWCxDQUFpQixrQkFBakIsRUFDTCxxQkFESyxFQUVMO0FBQUVDLFdBQVE7QUFBVixHQUZLLENBQU47QUFHQTs7QUFDRCxPQUFNQyxlQUFlLFVBQVNDLE9BQVQsRUFBa0I7QUFDdEMsU0FBUUEsUUFBUUwsUUFBUixLQUFxQkEsUUFBN0I7QUFDQSxFQUZEOztBQUdBLFFBQU9aLFNBQVNDLElBQVQsQ0FBY0MsUUFBZCxDQUF1QkcsU0FBdkIsQ0FBaUNhLE1BQWpDLENBQXdDRixZQUF4QyxFQUFzRCxDQUF0RCxDQUFQO0FBQ0E7O0FBRURILE9BQU9NLE9BQVAsQ0FBZTtBQUNkQyxZQUFXUixRQUFYLEVBQXFCO0FBQ3BCO0FBQ0EsTUFBSSxDQUFDQyxPQUFPUSxNQUFQLEVBQUwsRUFBc0I7QUFDckIsU0FBTSxJQUFJUixPQUFPQyxLQUFYLENBQWlCLG9CQUFqQixFQUF1QyxjQUF2QyxFQUF1RDtBQUFFQyxZQUFRO0FBQVYsSUFBdkQsQ0FBTjtBQUNBOztBQUNELFFBQU1PLGlCQUFpQlgsc0JBQXNCQyxRQUF0QixDQUF2Qjs7QUFFQSxNQUFJWixTQUFTQyxJQUFULENBQWNDLFFBQWQsQ0FBdUJDLEtBQTNCLEVBQWtDO0FBQ2pDb0IsV0FBUUMsR0FBUixDQUFhLHVCQUF1QkMsS0FBS0MsU0FBTCxDQUFlSixjQUFmLENBQWdDLEVBQXBFO0FBQ0EsR0FUbUIsQ0FVcEI7OztBQUNBLFFBQU1LLE9BQU9kLE9BQU9lLEtBQVAsQ0FBYUMsT0FBYixDQUFxQjtBQUNqQ0MsUUFBS2pCLE9BQU9RLE1BQVAsRUFENEI7QUFFakMsNkJBQTBCVDtBQUZPLEdBQXJCLEVBR1Y7QUFDRixvQkFBaUI7QUFEZixHQUhVLENBQWI7QUFNQSxNQUFJbUIsU0FBU0osS0FBS0ssUUFBTCxDQUFjL0IsSUFBZCxDQUFtQjhCLE1BQWhDO0FBQ0EsUUFBTUUsZUFBZU4sS0FBS0ssUUFBTCxDQUFjL0IsSUFBZCxDQUFtQmlDLFVBQXhDO0FBQ0FILFdBQVNFLFlBQVQ7O0FBQ0EsTUFBSWpDLFNBQVNDLElBQVQsQ0FBY0MsUUFBZCxDQUF1QkMsS0FBM0IsRUFBa0M7QUFDakNvQixXQUFRQyxHQUFSLENBQWEsbUJBQW1CWCxPQUFPUSxNQUFQLEVBQWlCLFdBQVdJLEtBQUtDLFNBQUwsQ0FBZUssTUFBZixDQUF3QixFQUFwRjtBQUNBOztBQUVELFFBQU1JLFFBQVEsSUFBSUMsSUFBSixDQUFTZCxjQUFULENBQWQ7O0FBRUEsUUFBTWUsVUFBVUYsTUFBTUcscUJBQU4sQ0FBNEI7QUFDM0NQLFNBRDJDO0FBRTNDRTtBQUYyQyxHQUE1QixDQUFoQixDQTFCb0IsQ0ErQnBCO0FBQ0E7OztBQUVBcEIsU0FBT2UsS0FBUCxDQUFhVyxNQUFiLENBQW9CO0FBQ25CVCxRQUFLakIsT0FBT1EsTUFBUDtBQURjLEdBQXBCLEVBRUc7QUFDRm1CLFNBQU07QUFDTCxrQ0FBOEJILFFBQVFJO0FBRGpDO0FBREosR0FGSDs7QUFRQSxRQUFNQyxvQkFBb0I3QixPQUFPOEIsU0FBUCxDQUFpQlIsTUFBTVMsWUFBdkIsRUFBcUNULEtBQXJDLENBQTFCOztBQUNBLFFBQU1VLFNBQVNILGtCQUFrQkwsUUFBUUEsT0FBMUIsRUFBbUMsUUFBbkMsQ0FBZjs7QUFDQSxNQUFJckMsU0FBU0MsSUFBVCxDQUFjQyxRQUFkLENBQXVCQyxLQUEzQixFQUFrQztBQUNqQ29CLFdBQVFDLEdBQVIsQ0FBYSx1QkFBdUJxQixNQUFRLEVBQTVDO0FBQ0E7O0FBR0QsU0FBT0EsTUFBUDtBQUNBOztBQW5EYSxDQUFmO0FBc0RBN0MsU0FBUzhDLG9CQUFULENBQThCLFVBQVNDLFlBQVQsRUFBdUI7QUFDcEQsS0FBSSxDQUFDQSxhQUFhOUMsSUFBZCxJQUFzQixDQUFDOEMsYUFBYUMsZUFBeEMsRUFBeUQ7QUFDeEQsU0FBT0MsU0FBUDtBQUNBOztBQUVELE9BQU1DLGNBQWNsRCxTQUFTQyxJQUFULENBQWNrRCxrQkFBZCxDQUFpQ0osYUFBYUMsZUFBOUMsQ0FBcEI7O0FBQ0EsS0FBSWhELFNBQVNDLElBQVQsQ0FBY0MsUUFBZCxDQUF1QkMsS0FBM0IsRUFBa0M7QUFDakNvQixVQUFRQyxHQUFSLENBQWEsV0FBV0MsS0FBS0MsU0FBTCxDQUFld0IsV0FBZixDQUE2QixFQUFyRDtBQUNBOztBQUVELEtBQUlBLGdCQUFnQkQsU0FBcEIsRUFBK0I7QUFDOUIsU0FBTztBQUNORyxTQUFNLE1BREE7QUFFTkMsVUFBTyxJQUFJeEMsT0FBT0MsS0FBWCxDQUFpQmQsU0FBU3NELG1CQUFULENBQTZCQyxZQUE5QyxFQUE0RCxpQ0FBNUQ7QUFGRCxHQUFQO0FBSUE7O0FBRUQsS0FBSUwsZUFBZUEsWUFBWU0sT0FBM0IsSUFBc0NOLFlBQVlNLE9BQVosQ0FBb0JDLEtBQTlELEVBQXFFO0FBQ3BFLFFBQU1BLFFBQVFDLE9BQU9DLE1BQVAsQ0FBY1QsWUFBWU0sT0FBWixDQUFvQkMsS0FBbEMsQ0FBZDtBQUNBLFFBQU1HLGFBQWEsSUFBSUYsTUFBSixDQUFZLElBQUlELEtBQU8sR0FBdkIsRUFBMkIsR0FBM0IsQ0FBbkI7QUFDQSxNQUFJOUIsT0FBT2QsT0FBT2UsS0FBUCxDQUFhQyxPQUFiLENBQXFCO0FBQy9CLHFCQUFrQitCO0FBRGEsR0FBckIsQ0FBWDs7QUFJQSxNQUFJLENBQUNqQyxJQUFMLEVBQVc7QUFDVixTQUFNa0MsVUFBVTtBQUNmQyxVQUFNWixZQUFZTSxPQUFaLENBQW9CTyxFQUFwQixJQUEwQmIsWUFBWU0sT0FBWixDQUFvQlEsUUFEckM7QUFFZkMsWUFBUSxJQUZPO0FBR2ZDLGlCQUFhLENBQUMsTUFBRCxDQUhFO0FBSWZDLFlBQVEsQ0FBQztBQUNSQyxjQUFTbEIsWUFBWU0sT0FBWixDQUFvQkMsS0FEckI7QUFFUlksZUFBVTtBQUZGLEtBQUQ7QUFKTyxJQUFoQjs7QUFVQSxPQUFJckUsU0FBU0MsSUFBVCxDQUFjQyxRQUFkLENBQXVCRSxnQkFBdkIsS0FBNEMsSUFBaEQsRUFBc0Q7QUFDckQsVUFBTTRELFdBQVdNLFdBQVdDLDBCQUFYLENBQXNDVixPQUF0QyxDQUFqQjs7QUFDQSxRQUFJRyxRQUFKLEVBQWM7QUFDYkgsYUFBUUcsUUFBUixHQUFtQkEsUUFBbkI7QUFDQTtBQUNELElBTEQsTUFLTyxJQUFJZCxZQUFZTSxPQUFaLENBQW9CUSxRQUF4QixFQUFrQztBQUN4Q0gsWUFBUUcsUUFBUixHQUFtQmQsWUFBWU0sT0FBWixDQUFvQlEsUUFBdkM7QUFDQTs7QUFFRCxTQUFNM0MsU0FBU3JCLFNBQVN3RSxhQUFULENBQXVCLEVBQXZCLEVBQTJCWCxPQUEzQixDQUFmO0FBQ0FsQyxVQUFPZCxPQUFPZSxLQUFQLENBQWFDLE9BQWIsQ0FBcUJSLE1BQXJCLENBQVA7QUFDQSxHQTdCbUUsQ0ErQnBFOzs7QUFDQSxRQUFNb0QsZUFBZXpFLFNBQVMwRSwwQkFBVCxFQUFyQjs7QUFDQTdELFNBQU9lLEtBQVAsQ0FBYVcsTUFBYixDQUFvQlosSUFBcEIsRUFBMEI7QUFDekJnRCxVQUFPO0FBQ04sbUNBQStCRjtBQUR6QjtBQURrQixHQUExQjtBQU1BLFFBQU1HLFlBQVk7QUFDakJoRSxhQUFVWixTQUFTQyxJQUFULENBQWM0RSxVQURQO0FBRWpCQyxRQUFLNUIsWUFBWU0sT0FBWixDQUFvQnVCLE1BRlI7QUFHakI3QyxlQUFZZ0IsWUFBWU0sT0FBWixDQUFvQnZCLFlBSGY7QUFJakJGLFdBQVFtQixZQUFZTSxPQUFaLENBQW9CekI7QUFKWCxHQUFsQjtBQU9BbEIsU0FBT2UsS0FBUCxDQUFhVyxNQUFiLENBQW9CO0FBQ25CVCxRQUFLSCxLQUFLRztBQURTLEdBQXBCLEVBRUc7QUFDRlUsU0FBTTtBQUNMO0FBQ0EscUJBQWlCb0M7QUFGWjtBQURKLEdBRkgsRUE5Q29FLENBdURwRTs7QUFDQSxRQUFNL0IsU0FBUztBQUNkeEIsV0FBUU0sS0FBS0csR0FEQztBQUVka0QsVUFBT1AsYUFBYU87QUFGTixHQUFmO0FBS0EsU0FBT25DLE1BQVA7QUFFQSxFQS9ERCxNQStETztBQUNOLFFBQU0sSUFBSS9CLEtBQUosQ0FBVSwrQ0FBVixDQUFOO0FBQ0E7QUFDRCxDQW5GRDtBQXFGQWQsU0FBU0MsSUFBVCxDQUFjZ0YsOEJBQWQsR0FBK0MsRUFBL0M7O0FBRUFqRixTQUFTQyxJQUFULENBQWNpRixhQUFkLEdBQThCLFVBQVNsQyxlQUFULEVBQTBCO0FBQ3ZELFFBQU90RCxFQUFFeUYsR0FBRixDQUFNbkYsU0FBU0MsSUFBVCxDQUFjZ0YsOEJBQXBCLEVBQW9EakMsZUFBcEQsQ0FBUDtBQUNBLENBRkQ7O0FBSUFoRCxTQUFTQyxJQUFULENBQWNrRCxrQkFBZCxHQUFtQyxVQUFTSCxlQUFULEVBQTBCO0FBQzVEO0FBQ0EsT0FBTUgsU0FBUzdDLFNBQVNDLElBQVQsQ0FBY2dGLDhCQUFkLENBQTZDakMsZUFBN0MsQ0FBZjtBQUNBLFFBQU9oRCxTQUFTQyxJQUFULENBQWNnRiw4QkFBZCxDQUE2Q2pDLGVBQTdDLENBQVA7QUFDQSxRQUFPSCxNQUFQO0FBQ0EsQ0FMRDs7QUFPQSxNQUFNdUMsYUFBYSxVQUFTQyxHQUFULEVBQWNDLEdBQWQsRUFBbUI7QUFDckNELEtBQUlFLFNBQUosQ0FBYyxHQUFkLEVBQW1CO0FBQ2xCLGtCQUFnQjtBQURFLEVBQW5CO0FBR0EsS0FBSUMsVUFBVSx5RkFBZDs7QUFDQSxLQUFJRixHQUFKLEVBQVM7QUFDUkUsWUFBVyw2REFBNkRGLEdBQUssbUVBQTdFO0FBQ0E7O0FBQ0RELEtBQUlJLEdBQUosQ0FBUUQsT0FBUixFQUFpQixPQUFqQjtBQUNBLENBVEQ7O0FBV0EsTUFBTUUsa0JBQWtCLFVBQVNDLEdBQVQsRUFBYztBQUNyQztBQUNBLEtBQUksQ0FBQ0EsR0FBTCxFQUFVO0FBQ1QsU0FBTyxJQUFQO0FBQ0E7O0FBRUQsT0FBTUMsV0FBV0QsSUFBSUUsS0FBSixDQUFVLEdBQVYsQ0FBakI7QUFDQSxPQUFNQyxZQUFZRixTQUFTLENBQVQsRUFBWUMsS0FBWixDQUFrQixHQUFsQixDQUFsQixDQVBxQyxDQVNyQztBQUNBOztBQUNBLEtBQUlDLFVBQVUsQ0FBVixNQUFpQixPQUFyQixFQUE4QjtBQUM3QixTQUFPLElBQVA7QUFDQTs7QUFFRCxPQUFNakQsU0FBUztBQUNka0QsY0FBWUQsVUFBVSxDQUFWLENBREU7QUFFZEUsZUFBYUYsVUFBVSxDQUFWLENBRkM7QUFHZDlDLG1CQUFpQjhDLFVBQVUsQ0FBVjtBQUhILEVBQWY7O0FBS0EsS0FBSTlGLFNBQVNDLElBQVQsQ0FBY0MsUUFBZCxDQUF1QkMsS0FBM0IsRUFBa0M7QUFDakNvQixVQUFRQyxHQUFSLENBQVlxQixNQUFaO0FBQ0E7O0FBQ0QsUUFBT0EsTUFBUDtBQUNBLENBeEJEOztBQTBCQSxNQUFNb0QsYUFBYSxVQUFTQyxHQUFULEVBQWNiLEdBQWQsRUFBbUJjLElBQW5CLEVBQXlCO0FBQzNDO0FBQ0E7QUFDQSxLQUFJO0FBQ0gsUUFBTUMsYUFBYVYsZ0JBQWdCUSxJQUFJUCxHQUFwQixDQUFuQjs7QUFDQSxNQUFJLENBQUNTLFVBQUQsSUFBZSxDQUFDQSxXQUFXSixXQUEvQixFQUE0QztBQUMzQ0c7QUFDQTtBQUNBOztBQUVELE1BQUksQ0FBQ0MsV0FBV0wsVUFBaEIsRUFBNEI7QUFDM0IsU0FBTSxJQUFJakYsS0FBSixDQUFVLHFCQUFWLENBQU47QUFDQTs7QUFFRFMsVUFBUUMsR0FBUixDQUFZeEIsU0FBU0MsSUFBVCxDQUFjQyxRQUFkLENBQXVCRyxTQUFuQztBQUNBa0IsVUFBUUMsR0FBUixDQUFZNEUsV0FBV0osV0FBdkI7O0FBQ0EsUUFBTUssVUFBVTNHLEVBQUU0RyxJQUFGLENBQU90RyxTQUFTQyxJQUFULENBQWNDLFFBQWQsQ0FBdUJHLFNBQTlCLEVBQXlDLFVBQVNrRyxXQUFULEVBQXNCO0FBQzlFLFVBQU9BLFlBQVkzRixRQUFaLEtBQXlCd0YsV0FBV0osV0FBM0M7QUFDQSxHQUZlLENBQWhCLENBYkcsQ0FpQkg7OztBQUNBLE1BQUksQ0FBQ0ssT0FBTCxFQUFjO0FBQ2IsU0FBTSxJQUFJdkYsS0FBSixDQUFXLDJCQUEyQnNGLFdBQVdKLFdBQWEsRUFBOUQsQ0FBTjtBQUNBOztBQUNELE1BQUk3RCxLQUFKOztBQUNBLFVBQVFpRSxXQUFXTCxVQUFuQjtBQUNDLFFBQUssVUFBTDtBQUNDNUQsWUFBUSxJQUFJQyxJQUFKLENBQVNpRSxPQUFULENBQVI7QUFDQUEsWUFBUUcsV0FBUixHQUFzQjNGLE9BQU80RixXQUFQLENBQW9CLGtCQUFrQkosUUFBUXpGLFFBQVUsRUFBeEQsQ0FBdEI7QUFDQXlFLFFBQUlFLFNBQUosQ0FBYyxHQUFkO0FBQ0FGLFFBQUlxQixLQUFKLENBQVV2RSxNQUFNd0UsK0JBQU4sQ0FBc0NOLFFBQVFHLFdBQTlDLENBQVY7QUFDQW5CLFFBQUlJLEdBQUosR0FMRCxDQU1DOztBQUNBOztBQUNELFFBQUssUUFBTDtBQUNDO0FBQ0F0RCxZQUFRLElBQUlDLElBQUosQ0FBU2lFLE9BQVQsQ0FBUjs7QUFDQWxFLFVBQU15RSxzQkFBTixDQUE2QlYsSUFBSVcsS0FBSixDQUFVQyxZQUF2QyxFQUFxRCxVQUFTeEIsR0FBVCxFQUFjekMsTUFBZCxFQUFzQjtBQUMxRSxTQUFJLENBQUN5QyxHQUFMLEVBQVU7QUFDVCxZQUFNeUIsYUFBYSxVQUFTQyxZQUFULEVBQXVCO0FBQ3pDLFdBQUloSCxTQUFTQyxJQUFULENBQWNDLFFBQWQsQ0FBdUJDLEtBQTNCLEVBQWtDO0FBQ2pDb0IsZ0JBQVFDLEdBQVIsQ0FBYSxxQ0FBcUN3RixZQUFjLEVBQWhFO0FBQ0E7O0FBQ0QsYUFBTUMsZ0JBQWdCcEcsT0FBT2UsS0FBUCxDQUFhMEUsSUFBYixDQUFrQjtBQUN2QyxzQ0FBOEJVO0FBRFMsUUFBbEIsRUFFbkJFLEtBRm1CLEVBQXRCOztBQUdBLFdBQUlELGNBQWNFLE1BQWQsS0FBeUIsQ0FBN0IsRUFBZ0M7QUFDL0IsWUFBSW5ILFNBQVNDLElBQVQsQ0FBY0MsUUFBZCxDQUF1QkMsS0FBM0IsRUFBa0M7QUFDakNvQixpQkFBUUMsR0FBUixDQUFhLGNBQWN5RixjQUFjLENBQWQsRUFBaUJuRixHQUFLLEVBQWpEO0FBQ0E7O0FBQ0RqQixlQUFPZSxLQUFQLENBQWFXLE1BQWIsQ0FBb0I7QUFDbkJULGNBQUttRixjQUFjLENBQWQsRUFBaUJuRjtBQURILFNBQXBCLEVBRUc7QUFDRlUsZUFBTTtBQUNMLHlDQUErQjtBQUQxQjtBQURKLFNBRkg7QUFPQTNCLGVBQU9lLEtBQVAsQ0FBYVcsTUFBYixDQUFvQjtBQUNuQlQsY0FBS21GLGNBQWMsQ0FBZCxFQUFpQm5GO0FBREgsU0FBcEIsRUFFRztBQUNGc0YsaUJBQVE7QUFDUCwyQkFBaUI7QUFEVjtBQUROLFNBRkg7QUFPQSxRQWxCRCxNQWtCTztBQUNOLGNBQU0sSUFBSXZHLE9BQU9DLEtBQVgsQ0FBaUIsd0RBQWpCLENBQU47QUFDQTtBQUNELE9BNUJEOztBQThCQVIsWUFBTSxZQUFXO0FBQ2hCeUcsa0JBQVdsRSxNQUFYO0FBQ0EsT0FGRCxFQUVHd0UsR0FGSDtBQUtBaEMsVUFBSUUsU0FBSixDQUFjLEdBQWQsRUFBbUI7QUFDbEIsbUJBQVlXLElBQUlXLEtBQUosQ0FBVWhDO0FBREosT0FBbkI7QUFHQVEsVUFBSUksR0FBSjtBQUNBLE1BekN5RSxDQTBDMUU7QUFDQTtBQUNBOztBQUNBLEtBN0NEOztBQThDQTs7QUFDRCxRQUFLLGFBQUw7QUFDQ0osUUFBSUUsU0FBSixDQUFjLEdBQWQsRUFBbUI7QUFDbEI7QUFDQSxpQkFBWVcsSUFBSVcsS0FBSixDQUFVUztBQUZKLEtBQW5CO0FBSUFqQyxRQUFJSSxHQUFKO0FBQ0E7O0FBQ0QsUUFBSyxXQUFMO0FBQ0NZLFlBQVFHLFdBQVIsR0FBc0IzRixPQUFPNEYsV0FBUCxDQUFvQixrQkFBa0JKLFFBQVF6RixRQUFVLEVBQXhELENBQXRCO0FBQ0F5RixZQUFRNUQsRUFBUixHQUFhMkQsV0FBV3BELGVBQXhCO0FBQ0FiLFlBQVEsSUFBSUMsSUFBSixDQUFTaUUsT0FBVCxDQUFSOztBQUNBbEUsVUFBTW9GLGVBQU4sQ0FBc0JyQixHQUF0QixFQUEyQixVQUFTWixHQUFULEVBQWNLLEdBQWQsRUFBbUI7QUFDN0MsU0FBSUwsR0FBSixFQUFTO0FBQ1IsWUFBTSxJQUFJeEUsS0FBSixDQUFVLGtDQUFWLENBQU47QUFDQTs7QUFDRHVFLFNBQUlFLFNBQUosQ0FBYyxHQUFkLEVBQW1CO0FBQ2xCLGtCQUFZSTtBQURNLE1BQW5CO0FBR0FOLFNBQUlJLEdBQUo7QUFDQSxLQVJEOztBQVNBOztBQUNELFFBQUssVUFBTDtBQUNDdEQsWUFBUSxJQUFJQyxJQUFKLENBQVNpRSxPQUFULENBQVI7QUFDQXJHLGFBQVNDLElBQVQsQ0FBYzRFLFVBQWQsR0FBMkJxQixJQUFJc0IsSUFBSixDQUFTM0MsVUFBcEM7O0FBQ0ExQyxVQUFNc0YsZ0JBQU4sQ0FBdUJ2QixJQUFJc0IsSUFBSixDQUFTVixZQUFoQyxFQUE4Q1osSUFBSXNCLElBQUosQ0FBUzNDLFVBQXZELEVBQW1FLFVBQVNTLEdBQVQsRUFBYzlCLE9BQWQsQ0FBcUIsZUFBckIsRUFBc0M7QUFDeEcsU0FBSThCLEdBQUosRUFBUztBQUNSLFlBQU0sSUFBSXhFLEtBQUosQ0FBVyxvQ0FBb0N3RSxHQUFLLEVBQXBELENBQU47QUFDQTs7QUFFRCxXQUFNdEMsa0JBQWtCUSxRQUFRa0UsY0FBUixJQUEwQmxFLFFBQVFtRSxZQUFsQyxJQUFrRHZCLFdBQVdwRCxlQUFyRjs7QUFDQSxTQUFJLENBQUNBLGVBQUwsRUFBc0I7QUFDckI7QUFDQSxZQUFNNEUsMkJBQTJCQyxPQUFPcEYsRUFBUCxFQUFqQztBQUNBekMsZUFBU0MsSUFBVCxDQUFjZ0YsOEJBQWQsQ0FBNkMyQyx3QkFBN0MsSUFBeUU7QUFDeEVwRTtBQUR3RSxPQUF6RTtBQUdBLFlBQU1tQyxNQUFPLEdBQUc5RSxPQUFPNEYsV0FBUCxDQUFtQixNQUFuQixDQUE0Qiw2QkFBNkJtQix3QkFBMEIsRUFBbkc7QUFDQXZDLFVBQUlFLFNBQUosQ0FBYyxHQUFkLEVBQW1CO0FBQ2xCLG1CQUFZSTtBQURNLE9BQW5CO0FBR0FOLFVBQUlJLEdBQUo7QUFDQSxNQVhELE1BV087QUFDTnpGLGVBQVNDLElBQVQsQ0FBY2dGLDhCQUFkLENBQTZDakMsZUFBN0MsSUFBZ0U7QUFDL0RRO0FBRCtELE9BQWhFO0FBR0E0QixpQkFBV0MsR0FBWDtBQUNBO0FBQ0QsS0F2QkQ7O0FBd0JBOztBQUNEO0FBQ0MsVUFBTSxJQUFJdkUsS0FBSixDQUFXLDBCQUEwQnNGLFdBQVdMLFVBQVksRUFBNUQsQ0FBTjtBQTdHRjtBQWdIQSxFQXRJRCxDQXNJRSxPQUFPVCxHQUFQLEVBQVk7QUFDYkYsYUFBV0MsR0FBWCxFQUFnQkMsR0FBaEI7QUFDQTtBQUNELENBNUlELEMsQ0E4SUE7OztBQUNBd0MsT0FBT0MsZUFBUCxDQUF1QkMsR0FBdkIsQ0FBMkJ4SCxRQUFReUgsVUFBUixFQUEzQixFQUFpREQsR0FBakQsQ0FBcUQsVUFBUzlCLEdBQVQsRUFBY2IsR0FBZCxFQUFtQmMsSUFBbkIsRUFBeUI7QUFDN0U7QUFDQTtBQUNBN0YsT0FBTSxZQUFXO0FBQ2hCMkYsYUFBV0MsR0FBWCxFQUFnQmIsR0FBaEIsRUFBcUJjLElBQXJCO0FBQ0EsRUFGRCxFQUVHa0IsR0FGSDtBQUdBLENBTkQsRTs7Ozs7Ozs7Ozs7QUM3V0EsdUJBRUEsTUFBTWEsT0FBTzNILElBQUlWLE9BQUosQ0FBWSxNQUFaLENBQWI7O0FBQ0EsTUFBTXNJLFNBQVM1SCxJQUFJVixPQUFKLENBQVksUUFBWixDQUFmOztBQUNBLE1BQU11SSxZQUFZN0gsSUFBSVYsT0FBSixDQUFZLFlBQVosQ0FBbEI7O0FBQ0EsTUFBTXdJLFNBQVM5SCxJQUFJVixPQUFKLENBQVksUUFBWixDQUFmOztBQUNBLE1BQU15SSxTQUFTL0gsSUFBSVYsT0FBSixDQUFZLFFBQVosQ0FBZjs7QUFDQSxNQUFNMEksY0FBY2hJLElBQUlWLE9BQUosQ0FBWSxhQUFaLENBQXBCOztBQUNBLE1BQU0ySSxhQUFhakksSUFBSVYsT0FBSixDQUFZLFlBQVosQ0FBbkIsQyxDQUVBOzs7QUFHQXVDLE9BQU8sVUFBU3FHLE9BQVQsRUFBa0I7QUFDeEIsTUFBS0EsT0FBTCxHQUFlLEtBQUtDLFVBQUwsQ0FBZ0JELE9BQWhCLENBQWY7QUFDQSxDQUZELEMsQ0FJQTtBQUNBO0FBQ0E7OztBQUVBckcsS0FBS3VHLFNBQUwsQ0FBZUQsVUFBZixHQUE0QixVQUFTRCxPQUFULEVBQWtCO0FBQzdDLEtBQUksQ0FBQ0EsT0FBTCxFQUFjO0FBQ2JBLFlBQVUsRUFBVjtBQUNBOztBQUVELEtBQUksQ0FBQ0EsUUFBUUcsUUFBYixFQUF1QjtBQUN0QkgsVUFBUUcsUUFBUixHQUFtQixVQUFuQjtBQUNBOztBQUVELEtBQUksQ0FBQ0gsUUFBUUksSUFBYixFQUFtQjtBQUNsQkosVUFBUUksSUFBUixHQUFlLGVBQWY7QUFDQTs7QUFFRCxLQUFJLENBQUNKLFFBQVExRCxNQUFiLEVBQXFCO0FBQ3BCMEQsVUFBUTFELE1BQVIsR0FBaUIsZUFBakI7QUFDQTs7QUFFRCxLQUFJMEQsUUFBUUssZ0JBQVIsS0FBNkI3RixTQUFqQyxFQUE0QztBQUMzQ3dGLFVBQVFLLGdCQUFSLEdBQTJCLHdEQUEzQjtBQUNBOztBQUVELEtBQUlMLFFBQVFNLFlBQVIsS0FBeUI5RixTQUE3QixFQUF3QztBQUN2Q3dGLFVBQVFNLFlBQVIsR0FBdUIsbUVBQXZCO0FBQ0E7O0FBRUQsUUFBT04sT0FBUDtBQUNBLENBMUJEOztBQTRCQXJHLEtBQUt1RyxTQUFMLENBQWVLLGdCQUFmLEdBQWtDLFlBQVc7QUFDNUMsT0FBTUMsUUFBUSxrQkFBZDtBQUNBLEtBQUlDLFdBQVcsS0FBZjs7QUFDQSxNQUFLLElBQUlDLElBQUksQ0FBYixFQUFnQkEsSUFBSSxFQUFwQixFQUF3QkEsR0FBeEIsRUFBNkI7QUFDNUJELGNBQVlELE1BQU1HLE1BQU4sQ0FBYUMsS0FBS0MsS0FBTCxDQUFZRCxLQUFLRSxNQUFMLEtBQWdCLEVBQTVCLENBQWIsRUFBK0MsQ0FBL0MsQ0FBWjtBQUNBOztBQUNELFFBQU9MLFFBQVA7QUFDQSxDQVBEOztBQVNBOUcsS0FBS3VHLFNBQUwsQ0FBZWEsZUFBZixHQUFpQyxZQUFXO0FBQzNDLFFBQU8sSUFBSUMsSUFBSixHQUFXQyxXQUFYLEVBQVA7QUFDQSxDQUZEOztBQUlBdEgsS0FBS3VHLFNBQUwsQ0FBZWdCLFdBQWYsR0FBNkIsVUFBU0MsR0FBVCxFQUFjO0FBQzFDLE9BQU1DLFNBQVN4QixPQUFPeUIsVUFBUCxDQUFrQixVQUFsQixDQUFmO0FBQ0FELFFBQU90SCxNQUFQLENBQWNxSCxHQUFkO0FBQ0EsUUFBT0MsT0FBT0UsSUFBUCxDQUFZLEtBQUt0QixPQUFMLENBQWF1QixVQUF6QixFQUFxQyxRQUFyQyxDQUFQO0FBQ0EsQ0FKRDs7QUFNQTVILEtBQUt1RyxTQUFMLENBQWVzQix3QkFBZixHQUEwQyxVQUFTL0QsR0FBVCxFQUFjO0FBQ3ZELEtBQUl6RCxLQUFNLElBQUksS0FBS3VHLGdCQUFMLEVBQXlCLEVBQXZDO0FBQ0EsT0FBTWtCLFVBQVUsS0FBS1YsZUFBTCxFQUFoQixDQUZ1RCxDQUl2RDs7QUFDQSxLQUFJaEQsV0FBSjs7QUFDQSxLQUFJLEtBQUtpQyxPQUFMLENBQWFqQyxXQUFqQixFQUE4QjtBQUM3QkEsZ0JBQWMsS0FBS2lDLE9BQUwsQ0FBYWpDLFdBQTNCO0FBQ0EsRUFGRCxNQUVPO0FBQ05BLGdCQUFjLEtBQUtpQyxPQUFMLENBQWFHLFFBQWIsR0FBd0IxQyxJQUFJaUUsT0FBSixDQUFZQyxJQUFwQyxHQUEyQyxLQUFLM0IsT0FBTCxDQUFhSSxJQUF0RTtBQUNBOztBQUVELEtBQUksS0FBS0osT0FBTCxDQUFhaEcsRUFBakIsRUFBcUI7QUFDcEJBLE9BQUssS0FBS2dHLE9BQUwsQ0FBYWhHLEVBQWxCO0FBQ0E7O0FBRUQsS0FBSUosVUFDRiw4RUFBOEVJLEVBQUksaUNBQWlDeUgsT0FDbkgsbUdBQW1HMUQsV0FBYSxrQkFDaEgsS0FBS2lDLE9BQUwsQ0FBYTRCLFVBQVksSUFGMUIsR0FHQyxtRUFBbUUsS0FBSzVCLE9BQUwsQ0FBYTFELE1BQVEsa0JBSjFGOztBQU1BLEtBQUksS0FBSzBELE9BQUwsQ0FBYUssZ0JBQWpCLEVBQW1DO0FBQ2xDekcsYUFBWSxrRkFBa0YsS0FBS29HLE9BQUwsQ0FBYUssZ0JBQzFHLDhDQUREO0FBRUE7O0FBRUR6RyxZQUNDLHdHQUNBLDZNQURBLEdBRUEsdUJBSEQ7QUFLQSxRQUFPQSxPQUFQO0FBQ0EsQ0FqQ0Q7O0FBbUNBRCxLQUFLdUcsU0FBTCxDQUFlckcscUJBQWYsR0FBdUMsVUFBU21HLE9BQVQsRUFBa0I7QUFDeEQ7QUFDQTtBQUNBO0FBQ0E7QUFFQSxPQUFNaEcsS0FBTSxJQUFJLEtBQUt1RyxnQkFBTCxFQUF5QixFQUF6QztBQUNBLE9BQU1rQixVQUFVLEtBQUtWLGVBQUwsRUFBaEI7QUFFQSxLQUFJbkgsVUFBVyxHQUFHLDZFQUNqQix5REFBMkQsR0FBR0ksRUFBSSxpQ0FBaUN5SCxPQUNuRyxrQkFBa0IsS0FBS3pCLE9BQUwsQ0FBYTZCLGlCQUFtQixJQUZyQyxHQUdaLG1FQUFtRSxLQUFLN0IsT0FBTCxDQUFhMUQsTUFBUSxnQkFINUUsR0FJWix3QkFBd0IsS0FBSzBELE9BQUwsQ0FBYUssZ0JBQWtCLEtBQUtMLFFBQVExRyxNQUFRLGdCQUpoRSxHQUtiLHdCQUxEO0FBT0FNLFdBQVcsR0FBRyw4RUFDYixNQUFRLEdBQUdJLEVBQUksSUFETixHQUVULGdCQUZTLEdBR1IsaUJBQWlCeUgsT0FBUyxJQUhsQixHQUlSLGdCQUFnQixLQUFLekIsT0FBTCxDQUFhNkIsaUJBQW1CLElBSnhDLEdBS1QsR0FMUyxHQU1SLG1FQUFtRSxLQUFLN0IsT0FBTCxDQUFhMUQsTUFBUSxnQkFOaEYsR0FPVCxrRUFQUyxHQVFULGtEQVJTLEdBU1Isb0JBQW9CLEtBQUswRCxPQUFMLENBQWExRCxNQUFRLElBVGpDLEdBVVIsV0FBVyxLQUFLMEQsT0FBTCxDQUFhSyxnQkFBa0IsS0FDMUNMLFFBQVExRyxNQUFRLGdCQVhSLEdBWVIsMEVBQTBFMEcsUUFBUXhHLFlBQWMsdUJBWnhGLEdBYVQsd0JBYkQ7O0FBY0EsS0FBSXBCLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsVUFBUUMsR0FBUixDQUFZLHlDQUFaO0FBQ0FELFVBQVFDLEdBQVIsQ0FBWWEsT0FBWjtBQUNBOztBQUNELFFBQU87QUFDTkEsU0FETTtBQUVOSTtBQUZNLEVBQVA7QUFJQSxDQXRDRDs7QUF3Q0FMLEtBQUt1RyxTQUFMLENBQWUvRixZQUFmLEdBQThCLFVBQVNQLE9BQVQsRUFBa0JrSSxTQUFsQixFQUE2QkMsUUFBN0IsRUFBdUM7QUFDcEUsT0FBTUMsT0FBTyxJQUFiO0FBQ0F2QyxNQUFLd0MsVUFBTCxDQUFnQnJJLE9BQWhCLEVBQXlCLFVBQVNpRCxHQUFULEVBQWNxRixNQUFkLEVBQXNCO0FBQzlDLE1BQUlyRixHQUFKLEVBQVM7QUFDUixVQUFPa0YsU0FBU2xGLEdBQVQsQ0FBUDtBQUNBOztBQUVELFFBQU1zRixTQUFTRCxPQUFPRSxRQUFQLENBQWdCLFFBQWhCLENBQWY7QUFDQSxNQUFJQyxTQUFTTCxLQUFLaEMsT0FBTCxDQUFhNEIsVUFBMUI7O0FBRUEsTUFBSUUsY0FBYyxRQUFsQixFQUE0QjtBQUMzQixPQUFJRSxLQUFLaEMsT0FBTCxDQUFhNkIsaUJBQWpCLEVBQW9DO0FBQ25DUSxhQUFTTCxLQUFLaEMsT0FBTCxDQUFhNkIsaUJBQXRCO0FBQ0E7QUFDRDs7QUFFRCxNQUFJUSxPQUFPQyxPQUFQLENBQWUsR0FBZixJQUFzQixDQUExQixFQUE2QjtBQUM1QkQsYUFBVSxHQUFWO0FBQ0EsR0FGRCxNQUVPO0FBQ05BLGFBQVUsR0FBVjtBQUNBLEdBbEI2QyxDQW9COUM7OztBQUNBLE1BQUlFLFVBQUo7O0FBQ0EsTUFBSVQsY0FBYyxRQUFsQixFQUE0QjtBQUMzQjtBQUNBUyxnQkFBYW5LLE9BQU80RixXQUFQLEVBQWI7QUFDQSxHQUhELE1BR087QUFDTnVFLGdCQUFhUCxLQUFLaEMsT0FBTCxDQUFhN0gsUUFBMUI7QUFDQTs7QUFFRCxRQUFNcUssY0FBYztBQUNuQkMsZ0JBQWFOLE1BRE07QUFFbkIvRixlQUFZbUc7QUFGTyxHQUFwQjs7QUFLQSxNQUFJUCxLQUFLaEMsT0FBTCxDQUFhMEMsV0FBakIsRUFBOEI7QUFDN0JGLGVBQVlHLE1BQVosR0FBcUIsNENBQXJCO0FBQ0FILGVBQVlJLFNBQVosR0FBd0JaLEtBQUtkLFdBQUwsQ0FBaUJwQixZQUFZN0csU0FBWixDQUFzQnVKLFdBQXRCLENBQWpCLENBQXhCO0FBQ0E7O0FBRURILFlBQVV2QyxZQUFZN0csU0FBWixDQUFzQnVKLFdBQXRCLENBQVY7O0FBRUEsTUFBSXBLLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsV0FBUUMsR0FBUixDQUFhLGlCQUFpQnNKLE1BQVEsRUFBdEM7QUFDQTs7QUFDRCxNQUFJUCxjQUFjLFFBQWxCLEVBQTRCO0FBQzNCO0FBQ0EsVUFBT0MsU0FBUyxJQUFULEVBQWVNLE1BQWYsQ0FBUDtBQUVBLEdBSkQsTUFJTztBQUNOTixZQUFTLElBQVQsRUFBZU0sTUFBZjtBQUNBO0FBQ0QsRUFuREQ7QUFvREEsQ0F0REQ7O0FBd0RBMUksS0FBS3VHLFNBQUwsQ0FBZXBCLGVBQWYsR0FBaUMsVUFBU3JCLEdBQVQsRUFBY3NFLFFBQWQsRUFBd0I7QUFDeEQsT0FBTW5JLFVBQVUsS0FBSzRILHdCQUFMLENBQThCL0QsR0FBOUIsQ0FBaEI7QUFFQSxNQUFLdEQsWUFBTCxDQUFrQlAsT0FBbEIsRUFBMkIsV0FBM0IsRUFBd0NtSSxRQUF4QztBQUNBLENBSkQ7O0FBTUFwSSxLQUFLdUcsU0FBTCxDQUFlMkMsWUFBZixHQUE4QixVQUFTcEYsR0FBVCxFQUFjc0UsUUFBZCxFQUF3QjtBQUNyRCxPQUFNbkksVUFBVSxLQUFLQyxxQkFBTCxDQUEyQjRELEdBQTNCLENBQWhCO0FBRUEsTUFBS3RELFlBQUwsQ0FBa0JQLE9BQWxCLEVBQTJCLFFBQTNCLEVBQXFDbUksUUFBckM7QUFDQSxDQUpEOztBQU1BcEksS0FBS3VHLFNBQUwsQ0FBZTRDLFNBQWYsR0FBMkIsVUFBU0MsSUFBVCxFQUFlO0FBQ3pDQSxRQUFPQSxLQUFLQyxLQUFMLENBQVcsVUFBWCxFQUF1QkMsSUFBdkIsQ0FBNEIsSUFBNUIsQ0FBUDtBQUNBRixRQUFRLGdDQUFnQ0EsSUFBTSxFQUE5QztBQUNBQSxRQUFRLEdBQUdBLElBQU0sK0JBQWpCO0FBQ0EsUUFBT0EsSUFBUDtBQUNBLENBTEQsQyxDQU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFFQXBKLEtBQUt1RyxTQUFMLENBQWVnRCxpQkFBZixHQUFtQyxVQUFTL0IsR0FBVCxFQUFjNEIsSUFBZCxFQUFvQjtBQUN0RCxPQUFNZixPQUFPLElBQWI7QUFFQSxPQUFNbUIsTUFBTSxJQUFJdEQsT0FBT3VELFNBQVgsR0FBdUJDLGVBQXZCLENBQXVDbEMsR0FBdkMsQ0FBWjtBQUNBLE9BQU1tQyxZQUFZM0QsVUFBVTRELEtBQVYsQ0FBZ0JKLEdBQWhCLEVBQXFCLDhGQUFyQixFQUFxSCxDQUFySCxDQUFsQjtBQUVBLE9BQU1LLE1BQU0sSUFBSTdELFVBQVU4RCxTQUFkLEVBQVo7QUFFQUQsS0FBSUUsZUFBSixHQUFzQjtBQUNyQkMsZUFBVyxPQUFTO0FBQ25CLFVBQU8sdUJBQVA7QUFDQSxHQUhvQjs7QUFJckJDLFdBQU8sV0FBYTtBQUNuQixVQUFPNUIsS0FBS2MsU0FBTCxDQUFlQyxJQUFmLENBQVA7QUFDQTs7QUFOb0IsRUFBdEI7QUFTQVMsS0FBSUssYUFBSixDQUFrQlAsU0FBbEI7QUFFQSxRQUFPRSxJQUFJTSxjQUFKLENBQW1CM0MsR0FBbkIsQ0FBUDtBQUNBLENBcEJEOztBQXNCQXhILEtBQUt1RyxTQUFMLENBQWU2RCxVQUFmLEdBQTRCLFVBQVNDLGFBQVQsRUFBd0JDLFdBQXhCLEVBQXFDO0FBQ2hFLEtBQUlELGNBQWUsUUFBUUMsV0FBYSxFQUFwQyxDQUFKLEVBQTRDO0FBQzNDLFNBQU9ELGNBQWUsUUFBUUMsV0FBYSxFQUFwQyxDQUFQO0FBQ0EsRUFGRCxNQUVPLElBQUlELGNBQWUsU0FBU0MsV0FBYSxFQUFyQyxDQUFKLEVBQTZDO0FBQ25ELFNBQU9ELGNBQWUsU0FBU0MsV0FBYSxFQUFyQyxDQUFQO0FBQ0EsRUFGTSxNQUVBLElBQUlELGNBQWUsVUFBVUMsV0FBYSxFQUF0QyxDQUFKLEVBQThDO0FBQ3BELFNBQU9ELGNBQWUsVUFBVUMsV0FBYSxFQUF0QyxDQUFQO0FBQ0EsRUFGTSxNQUVBLElBQUlELGNBQWUsU0FBU0MsV0FBYSxFQUFyQyxDQUFKLEVBQTZDO0FBQ25ELFNBQU9ELGNBQWUsU0FBU0MsV0FBYSxFQUFyQyxDQUFQO0FBQ0EsRUFGTSxNQUVBLElBQUlELGNBQWUsT0FBT0MsV0FBYSxFQUFuQyxDQUFKLEVBQTJDO0FBQ2pELFNBQU9ELGNBQWUsT0FBT0MsV0FBYSxFQUFuQyxDQUFQO0FBQ0EsRUFGTSxNQUVBLElBQUlELGNBQWUsT0FBT0MsV0FBYSxFQUFuQyxDQUFKLEVBQTJDO0FBQ2pELFNBQU9ELGNBQWUsT0FBT0MsV0FBYSxFQUFuQyxDQUFQO0FBQ0E7O0FBQ0QsUUFBT0QsY0FBY0MsV0FBZCxDQUFQO0FBQ0EsQ0FmRDs7QUFpQkF0SyxLQUFLdUcsU0FBTCxDQUFlL0Isc0JBQWYsR0FBd0MsVUFBUytGLFlBQVQsRUFBdUJuQyxRQUF2QixFQUFpQztBQUN4RSxPQUFNQyxPQUFPLElBQWI7QUFFQSxPQUFNbUMseUJBQXlCLElBQUlDLE1BQUosQ0FBV0YsWUFBWCxFQUF5QixRQUF6QixDQUEvQjtBQUNBekUsTUFBSzRFLFVBQUwsQ0FBZ0JGLHNCQUFoQixFQUF3QyxVQUFTdEgsR0FBVCxFQUFjeUgsT0FBZCxFQUF1QjtBQUU5RCxNQUFJekgsR0FBSixFQUFTO0FBQ1IsT0FBSXpFLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsWUFBUUMsR0FBUixDQUFZOEQsR0FBWjtBQUNBO0FBQ0QsR0FKRCxNQUlPO0FBQ04sU0FBTTBILFNBQVMsSUFBSTdFLE9BQU84RSxNQUFYLENBQWtCO0FBQ2hDQyxrQkFBYztBQURrQixJQUFsQixDQUFmO0FBR0FGLFVBQU9HLFdBQVAsQ0FBbUJKLE9BQW5CLEVBQTRCLFVBQVN6SCxHQUFULEVBQWNzRyxHQUFkLEVBQW1CO0FBQzlDLFVBQU13QixXQUFXM0MsS0FBSytCLFVBQUwsQ0FBZ0JaLEdBQWhCLEVBQXFCLGdCQUFyQixDQUFqQjs7QUFFQSxRQUFJd0IsUUFBSixFQUFjO0FBQ2I7QUFDQSxXQUFNcEcsZUFBZW9HLFNBQVNDLENBQVQsQ0FBVzFGLFlBQWhDOztBQUNBLFNBQUk5RyxPQUFPWCxRQUFQLENBQWdCQyxLQUFwQixFQUEyQjtBQUMxQm9CLGNBQVFDLEdBQVIsQ0FBYSxtQkFBbUJ3RixZQUFjLEVBQTlDO0FBQ0E7O0FBQ0QsV0FBTXNHLFNBQVM3QyxLQUFLK0IsVUFBTCxDQUFnQlksUUFBaEIsRUFBMEIsUUFBMUIsQ0FBZjtBQUNBLFdBQU1HLGFBQWE5QyxLQUFLK0IsVUFBTCxDQUFnQmMsT0FBTyxDQUFQLENBQWhCLEVBQTJCLFlBQTNCLEVBQXlDLENBQXpDLEVBQTRDRCxDQUE1QyxDQUE4Q0csS0FBakU7O0FBQ0EsU0FBSTNNLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsY0FBUUMsR0FBUixDQUFhLGVBQWVDLEtBQUtDLFNBQUwsQ0FBZTZMLFVBQWYsQ0FBNEIsRUFBeEQ7QUFDQTs7QUFDRCxTQUFJQSxlQUFlLDRDQUFuQixFQUFpRTtBQUNoRTtBQUNBO0FBQ0EvQyxlQUFTLElBQVQsRUFBZXhELFlBQWY7QUFDQSxNQUpELE1BSU87QUFDTndELGVBQVMsb0NBQVQsRUFBK0MsSUFBL0M7QUFDQTtBQUNELEtBbEJELE1Ba0JPO0FBQ05BLGNBQVMsbUJBQVQsRUFBOEIsSUFBOUI7QUFDQTtBQUNELElBeEJEO0FBeUJBO0FBRUQsRUFyQ0Q7QUFzQ0EsQ0ExQ0Q7O0FBNENBcEksS0FBS3VHLFNBQUwsQ0FBZWxCLGdCQUFmLEdBQWtDLFVBQVNrRixZQUFULEVBQXVCM0IsVUFBdkIsRUFBbUNSLFFBQW5DLEVBQTZDO0FBQzlFLE9BQU1DLE9BQU8sSUFBYjtBQUNBLE9BQU1iLE1BQU0sSUFBSWlELE1BQUosQ0FBV0YsWUFBWCxFQUF5QixRQUF6QixFQUFtQzlCLFFBQW5DLENBQTRDLE1BQTVDLENBQVosQ0FGOEUsQ0FHOUU7O0FBQ0EsS0FBSWhLLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsVUFBUUMsR0FBUixDQUFhLHlDQUF5Q29JLEdBQUssRUFBM0Q7QUFDQTs7QUFDRCxPQUFNb0QsU0FBUyxJQUFJN0UsT0FBTzhFLE1BQVgsQ0FBa0I7QUFDaENDLGdCQUFjLElBRGtCO0FBRWhDTyxTQUFNO0FBRjBCLEVBQWxCLENBQWY7QUFLQVQsUUFBT0csV0FBUCxDQUFtQnZELEdBQW5CLEVBQXdCLFVBQVN0RSxHQUFULEVBQWNzRyxHQUFkLEVBQW1CO0FBQzFDO0FBQ0EsTUFBSS9LLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsV0FBUUMsR0FBUixDQUFZLGtCQUFaO0FBQ0E7O0FBQ0QsTUFBSWlKLEtBQUtoQyxPQUFMLENBQWErQyxJQUFiLElBQXFCLENBQUNmLEtBQUtrQixpQkFBTCxDQUF1Qi9CLEdBQXZCLEVBQTRCYSxLQUFLaEMsT0FBTCxDQUFhK0MsSUFBekMsQ0FBMUIsRUFBMEU7QUFDekUsT0FBSTNLLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsWUFBUUMsR0FBUixDQUFZLGlCQUFaO0FBQ0E7O0FBQ0QsVUFBT2dKLFNBQVMsSUFBSTFKLEtBQUosQ0FBVSxtQkFBVixDQUFULEVBQXlDLElBQXpDLEVBQStDLEtBQS9DLENBQVA7QUFDQTs7QUFDRCxNQUFJRCxPQUFPWCxRQUFQLENBQWdCQyxLQUFwQixFQUEyQjtBQUMxQm9CLFdBQVFDLEdBQVIsQ0FBWSxjQUFaO0FBQ0E7O0FBQ0QsUUFBTTRMLFdBQVczQyxLQUFLK0IsVUFBTCxDQUFnQlosR0FBaEIsRUFBcUIsVUFBckIsQ0FBakI7O0FBQ0EsTUFBSS9LLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsV0FBUUMsR0FBUixDQUFZLGNBQVo7QUFDQTs7QUFDRCxNQUFJNEwsUUFBSixFQUFjO0FBQ2IsU0FBTU0sWUFBWWpELEtBQUsrQixVQUFMLENBQWdCWSxRQUFoQixFQUEwQixXQUExQixDQUFsQjs7QUFDQSxPQUFJLENBQUNNLFNBQUwsRUFBZ0I7QUFDZixXQUFPbEQsU0FBUyxJQUFJMUosS0FBSixDQUFVLHdCQUFWLENBQVQsRUFBOEMsSUFBOUMsRUFBb0QsS0FBcEQsQ0FBUDtBQUNBOztBQUVELFNBQU0wQyxVQUFVLEVBQWhCOztBQUVBLE9BQUk0SixTQUFTQyxDQUFULElBQWNELFNBQVNDLENBQVQsQ0FBVzFGLFlBQTdCLEVBQTJDO0FBQzFDbkUsWUFBUWtFLGNBQVIsR0FBeUIwRixTQUFTQyxDQUFULENBQVcxRixZQUFwQztBQUNBOztBQUVELFNBQU01QyxTQUFTMEYsS0FBSytCLFVBQUwsQ0FBZ0JrQixVQUFVLENBQVYsQ0FBaEIsRUFBOEIsUUFBOUIsQ0FBZjs7QUFDQSxPQUFJM0ksTUFBSixFQUFZO0FBQ1h2QixZQUFRdUIsTUFBUixHQUFpQkEsT0FBTyxDQUFQLEVBQVVyRixDQUEzQjtBQUNBOztBQUVELFNBQU1pTyxVQUFVbEQsS0FBSytCLFVBQUwsQ0FBZ0JrQixVQUFVLENBQVYsQ0FBaEIsRUFBOEIsU0FBOUIsQ0FBaEI7O0FBRUEsT0FBSUMsT0FBSixFQUFhO0FBQ1osVUFBTTVMLFNBQVMwSSxLQUFLK0IsVUFBTCxDQUFnQm1CLFFBQVEsQ0FBUixDQUFoQixFQUE0QixRQUE1QixDQUFmOztBQUNBLFFBQUk1TCxNQUFKLEVBQVk7QUFDWHlCLGFBQVF6QixNQUFSLEdBQWlCQSxPQUFPLENBQVAsRUFBVXJDLENBQTNCOztBQUVBLFNBQUlxQyxPQUFPLENBQVAsRUFBVXNMLENBQVYsQ0FBWU8sTUFBaEIsRUFBd0I7QUFDdkJwSyxjQUFRcUssWUFBUixHQUF1QjlMLE9BQU8sQ0FBUCxFQUFVc0wsQ0FBVixDQUFZTyxNQUFuQztBQUNBO0FBQ0Q7QUFDRDs7QUFFRCxTQUFNRSxpQkFBaUJyRCxLQUFLK0IsVUFBTCxDQUFnQmtCLFVBQVUsQ0FBVixDQUFoQixFQUE4QixnQkFBOUIsQ0FBdkI7O0FBRUEsT0FBSUksY0FBSixFQUFvQjtBQUNuQixRQUFJQSxlQUFlLENBQWYsRUFBa0JULENBQWxCLENBQW9CVSxZQUF4QixFQUFzQztBQUVyQ3ZLLGFBQVF2QixZQUFSLEdBQXVCNkwsZUFBZSxDQUFmLEVBQWtCVCxDQUFsQixDQUFvQlUsWUFBM0M7O0FBQ0EsU0FBSWxOLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsY0FBUUMsR0FBUixDQUFhLGtCQUFrQmdDLFFBQVF2QixZQUFjLEVBQXJEO0FBQ0E7QUFDRCxLQU5ELE1BTU8sSUFBSXBCLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQ2pDb0IsYUFBUUMsR0FBUixDQUFZLHdCQUFaO0FBQ0E7QUFHRCxJQVpELE1BWU8sSUFBSVgsT0FBT1gsUUFBUCxDQUFnQkMsS0FBcEIsRUFBMkI7QUFDakNvQixZQUFRQyxHQUFSLENBQVksMEJBQVo7QUFDQTs7QUFFRCxTQUFNd00scUJBQXFCdkQsS0FBSytCLFVBQUwsQ0FBZ0JrQixVQUFVLENBQVYsQ0FBaEIsRUFBOEIsb0JBQTlCLENBQTNCOztBQUNBLE9BQUlNLGtCQUFKLEVBQXdCO0FBQ3ZCLFVBQU1DLGFBQWF4RCxLQUFLK0IsVUFBTCxDQUFnQndCLG1CQUFtQixDQUFuQixDQUFoQixFQUF1QyxXQUF2QyxDQUFuQjs7QUFFQSxRQUFJQyxVQUFKLEVBQWdCO0FBQ2ZBLGdCQUFXQyxPQUFYLENBQW1CLFVBQVNDLFNBQVQsRUFBb0I7QUFDdEMsWUFBTUMsUUFBUTNELEtBQUsrQixVQUFMLENBQWdCMkIsU0FBaEIsRUFBMkIsZ0JBQTNCLENBQWQ7O0FBQ0EsVUFBSSxPQUFPQyxNQUFNLENBQU4sQ0FBUCxLQUFvQixRQUF4QixFQUFrQztBQUNqQzVLLGVBQVEySyxVQUFVZCxDQUFWLENBQVlnQixJQUFwQixJQUE0QkQsTUFBTSxDQUFOLENBQTVCO0FBQ0EsT0FGRCxNQUVPO0FBQ041SyxlQUFRMkssVUFBVWQsQ0FBVixDQUFZZ0IsSUFBcEIsSUFBNEJELE1BQU0sQ0FBTixFQUFTMU8sQ0FBckM7QUFDQTtBQUNELE1BUEQ7QUFRQTs7QUFFRCxRQUFJLENBQUM4RCxRQUFROEssSUFBVCxJQUFpQjlLLFFBQVEsbUNBQVIsQ0FBckIsRUFBbUU7QUFDbEU7QUFDQUEsYUFBUThLLElBQVIsR0FBZTlLLFFBQVEsbUNBQVIsQ0FBZjtBQUNBOztBQUVELFFBQUksQ0FBQ0EsUUFBUUMsS0FBVCxJQUFrQkQsUUFBUThLLElBQTlCLEVBQW9DO0FBQ25DOUssYUFBUUMsS0FBUixHQUFnQkQsUUFBUThLLElBQXhCO0FBQ0E7QUFDRDs7QUFFRCxPQUFJLENBQUM5SyxRQUFRQyxLQUFULElBQWtCRCxRQUFRekIsTUFBMUIsSUFBb0N5QixRQUFRcUssWUFBNUMsSUFBNERySyxRQUFRcUssWUFBUixDQUFxQjlDLE9BQXJCLENBQTZCLGNBQTdCLEtBQWdELENBQWhILEVBQW1IO0FBQ2xIdkgsWUFBUUMsS0FBUixHQUFnQkQsUUFBUXpCLE1BQXhCO0FBQ0E7O0FBQ0QsT0FBSWxCLE9BQU9YLFFBQVAsQ0FBZ0JDLEtBQXBCLEVBQTJCO0FBQzFCb0IsWUFBUUMsR0FBUixDQUFhLFdBQVdDLEtBQUtDLFNBQUwsQ0FBZThCLE9BQWYsQ0FBeUIsRUFBakQ7QUFDQTs7QUFFRGdILFlBQVMsSUFBVCxFQUFlaEgsT0FBZixFQUF3QixLQUF4QjtBQUNBLEdBakZELE1BaUZPO0FBQ04sU0FBTStLLGlCQUFpQjlELEtBQUsrQixVQUFMLENBQWdCWixHQUFoQixFQUFxQixnQkFBckIsQ0FBdkI7O0FBRUEsT0FBSTJDLGNBQUosRUFBb0I7QUFDbkIvRCxhQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCLElBQXJCO0FBQ0EsSUFGRCxNQUVPO0FBQ04sV0FBT0EsU0FBUyxJQUFJMUosS0FBSixDQUFVLCtCQUFWLENBQVQsRUFBcUQsSUFBckQsRUFBMkQsS0FBM0QsQ0FBUDtBQUNBO0FBRUQ7QUFDRCxFQTdHRDtBQThHQSxDQTFIRDs7QUE0SEEsSUFBSTBOLGNBQUo7O0FBQ0FwTSxLQUFLdUcsU0FBTCxDQUFlaEMsK0JBQWYsR0FBaUQsVUFBU0gsV0FBVCxFQUFzQjtBQUV0RSxLQUFJLENBQUNnSSxjQUFMLEVBQXFCO0FBQ3BCQSxtQkFBaUIsS0FBSy9GLE9BQUwsQ0FBYTBDLFdBQTlCO0FBQ0E7O0FBRUQsS0FBSSxDQUFDLEtBQUsxQyxPQUFMLENBQWFqQyxXQUFkLElBQTZCLENBQUNBLFdBQWxDLEVBQStDO0FBQzlDLFFBQU0sSUFBSTFGLEtBQUosQ0FDTCxpRkFESyxDQUFOO0FBRUE7O0FBRUQsT0FBTTJOLFdBQVc7QUFDaEIsc0JBQW9CO0FBQ25CLGFBQVUsc0NBRFM7QUFFbkIsZ0JBQWEsb0NBRk07QUFHbkIsZ0JBQWEsS0FBS2hHLE9BQUwsQ0FBYTFELE1BSFA7QUFJbkIsc0JBQW1CO0FBQ2xCLG1DQUErQixzQ0FEYjtBQUVsQiwyQkFBdUI7QUFDdEIsaUJBQVksb0RBRFU7QUFFdEIsa0JBQWMsR0FBR2xFLE9BQU80RixXQUFQLEVBQXNCLGdCQUFnQixLQUFLZ0MsT0FBTCxDQUFhN0gsUUFBVSxHQUZ4RDtBQUd0QiwwQkFBc0IsR0FBR0MsT0FBTzRGLFdBQVAsRUFBc0IsZ0JBQWdCLEtBQUtnQyxPQUFMLENBQWE3SCxRQUFVO0FBSGhFLEtBRkw7QUFPbEIsb0JBQWdCLEtBQUs2SCxPQUFMLENBQWFLLGdCQVBYO0FBUWxCLGdDQUE0QjtBQUMzQixlQUFVLEdBRGlCO0FBRTNCLG1CQUFjLE1BRmE7QUFHM0IsaUJBQVksZ0RBSGU7QUFJM0Isa0JBQWF0QztBQUpjO0FBUlY7QUFKQTtBQURKLEVBQWpCOztBQXVCQSxLQUFJLEtBQUtpQyxPQUFMLENBQWF1QixVQUFqQixFQUE2QjtBQUM1QixNQUFJLENBQUN3RSxjQUFMLEVBQXFCO0FBQ3BCLFNBQU0sSUFBSTFOLEtBQUosQ0FDTCxrRkFESyxDQUFOO0FBRUE7O0FBRUQwTixtQkFBaUJBLGVBQWVFLE9BQWYsQ0FBdUIsNkJBQXZCLEVBQXNELEVBQXRELENBQWpCO0FBQ0FGLG1CQUFpQkEsZUFBZUUsT0FBZixDQUF1QiwyQkFBdkIsRUFBb0QsRUFBcEQsQ0FBakI7QUFDQUYsbUJBQWlCQSxlQUFlRSxPQUFmLENBQXVCLE9BQXZCLEVBQWdDLElBQWhDLENBQWpCO0FBRUFELFdBQVMsa0JBQVQsRUFBNkIsaUJBQTdCLEVBQWdELGVBQWhELElBQW1FO0FBQ2xFLGlCQUFjO0FBQ2IsbUJBQWU7QUFDZCwyQkFBc0I7QUFDckIsZUFBU0Q7QUFEWTtBQURSO0FBREYsSUFEb0Q7QUFRbEUsWUFBUyxDQUNSO0FBQ0E7QUFDQyx3QkFBb0I7QUFDbkIsbUJBQWM7QUFESztBQURyQixJQUZRLEVBT1I7QUFDQyx3QkFBb0I7QUFDbkIsbUJBQWM7QUFESztBQURyQixJQVBRLEVBWVI7QUFDQyx3QkFBb0I7QUFDbkIsbUJBQWM7QUFESztBQURyQixJQVpRO0FBUnlELEdBQW5FO0FBMkJBOztBQUVELFFBQU9oRyxXQUFXbUcsTUFBWCxDQUFrQkYsUUFBbEIsRUFBNEJoSixHQUE1QixDQUFnQztBQUN0Q21KLFVBQVEsSUFEOEI7QUFFdENDLFVBQVEsSUFGOEI7QUFHdENDLFdBQVM7QUFINkIsRUFBaEMsQ0FBUDtBQUtBLENBOUVELEM7Ozs7Ozs7Ozs7O0FDcmJBblAsT0FBT29QLE1BQVAsQ0FBYztBQUFDQyxpQkFBZSxNQUFJQSxjQUFwQjtBQUFtQ0MsdUJBQXFCLE1BQUlBLG9CQUE1RDtBQUFpRkMsaUJBQWUsTUFBSUEsY0FBcEc7QUFBbUhDLFdBQVMsTUFBSUEsUUFBaEk7QUFBeUlDLFNBQU8sTUFBSUE7QUFBcEosQ0FBZDtBQUFBLE1BQU1BLFNBQVMsSUFBSUMsTUFBSixDQUFXLDZCQUFYLEVBQTBDO0FBQ3hEbE8sVUFBUztBQUNSbU8sV0FBUztBQUNSbE0sU0FBTTtBQURFO0FBREQ7QUFEK0MsQ0FBMUMsQ0FBZjtBQVFBa0IsV0FBV3BFLFFBQVgsQ0FBb0JxUCxRQUFwQixDQUE2QixNQUE3QjtBQUVBMU8sT0FBT00sT0FBUCxDQUFlO0FBQ2RxTyxnQkFBZTFMLElBQWYsRUFBcUI7QUFDcEJRLGFBQVdwRSxRQUFYLENBQW9CdVAsR0FBcEIsQ0FBeUIsZUFBZTNMLElBQU0sRUFBOUMsRUFBaUQsS0FBakQsRUFBd0Q7QUFDdkRWLFNBQU0sU0FEaUQ7QUFFdkRzTSxVQUFPLE1BRmdEO0FBR3ZEQyxZQUFTN0wsSUFIOEM7QUFJdkQ4TCxjQUFXO0FBSjRDLEdBQXhEO0FBTUF0TCxhQUFXcEUsUUFBWCxDQUFvQnVQLEdBQXBCLENBQXlCLGVBQWUzTCxJQUFNLFdBQTlDLEVBQTBELGVBQTFELEVBQTJFO0FBQzFFVixTQUFNLFFBRG9FO0FBRTFFc00sVUFBTyxNQUZtRTtBQUcxRUMsWUFBUzdMLElBSGlFO0FBSTFFOEwsY0FBVztBQUorRCxHQUEzRTtBQU1BdEwsYUFBV3BFLFFBQVgsQ0FBb0J1UCxHQUFwQixDQUF5QixlQUFlM0wsSUFBTSxjQUE5QyxFQUE2RCx5REFBN0QsRUFBd0g7QUFDdkhWLFNBQU0sUUFEaUg7QUFFdkhzTSxVQUFPLE1BRmdIO0FBR3ZIQyxZQUFTN0wsSUFIOEc7QUFJdkg4TCxjQUFXO0FBSjRHLEdBQXhIO0FBTUF0TCxhQUFXcEUsUUFBWCxDQUFvQnVQLEdBQXBCLENBQXlCLGVBQWUzTCxJQUFNLHVCQUE5QyxFQUFzRSxrRUFBdEUsRUFBMEk7QUFDeklWLFNBQU0sUUFEbUk7QUFFeklzTSxVQUFPLE1BRmtJO0FBR3pJQyxZQUFTN0wsSUFIZ0k7QUFJekk4TCxjQUFXO0FBSjhILEdBQTFJO0FBTUF0TCxhQUFXcEUsUUFBWCxDQUFvQnVQLEdBQXBCLENBQXlCLGVBQWUzTCxJQUFNLFNBQTlDLEVBQXdELHVEQUF4RCxFQUFpSDtBQUNoSFYsU0FBTSxRQUQwRztBQUVoSHNNLFVBQU8sTUFGeUc7QUFHaEhDLFlBQVM3TCxJQUh1RztBQUloSDhMLGNBQVc7QUFKcUcsR0FBakg7QUFNQXRMLGFBQVdwRSxRQUFYLENBQW9CdVAsR0FBcEIsQ0FBeUIsZUFBZTNMLElBQU0sT0FBOUMsRUFBc0QsRUFBdEQsRUFBMEQ7QUFDekRWLFNBQU0sUUFEbUQ7QUFFekRzTSxVQUFPLE1BRmtEO0FBR3pEQyxZQUFTN0wsSUFIZ0Q7QUFJekQ4TCxjQUFXLGtCQUo4QztBQUt6REMsY0FBVztBQUw4QyxHQUExRDtBQU9BdkwsYUFBV3BFLFFBQVgsQ0FBb0J1UCxHQUFwQixDQUF5QixlQUFlM0wsSUFBTSxjQUE5QyxFQUE2RCxFQUE3RCxFQUFpRTtBQUNoRVYsU0FBTSxRQUQwRDtBQUVoRXNNLFVBQU8sTUFGeUQ7QUFHaEVDLFlBQVM3TCxJQUh1RDtBQUloRStMLGNBQVcsSUFKcUQ7QUFLaEVELGNBQVc7QUFMcUQsR0FBakU7QUFPQXRMLGFBQVdwRSxRQUFYLENBQW9CdVAsR0FBcEIsQ0FBeUIsZUFBZTNMLElBQU0sY0FBOUMsRUFBNkQsRUFBN0QsRUFBaUU7QUFDaEVWLFNBQU0sUUFEMEQ7QUFFaEVzTSxVQUFPLE1BRnlEO0FBR2hFQyxZQUFTN0wsSUFIdUQ7QUFJaEUrTCxjQUFXLElBSnFEO0FBS2hFRCxjQUFXO0FBTHFELEdBQWpFO0FBT0F0TCxhQUFXcEUsUUFBWCxDQUFvQnVQLEdBQXBCLENBQXlCLGVBQWUzTCxJQUFNLG9CQUE5QyxFQUFtRSxFQUFuRSxFQUF1RTtBQUN0RVYsU0FBTSxRQURnRTtBQUV0RXNNLFVBQU8sTUFGK0Q7QUFHdEVDLFlBQVM3TCxJQUg2RDtBQUl0RThMLGNBQVc7QUFKMkQsR0FBdkU7QUFNQXRMLGFBQVdwRSxRQUFYLENBQW9CdVAsR0FBcEIsQ0FBeUIsZUFBZTNMLElBQU0scUJBQTlDLEVBQW9FLFNBQXBFLEVBQStFO0FBQzlFVixTQUFNLFFBRHdFO0FBRTlFc00sVUFBTyxNQUZ1RTtBQUc5RUMsWUFBUzdMLElBSHFFO0FBSTlFOEwsY0FBVztBQUptRSxHQUEvRTtBQU1BdEwsYUFBV3BFLFFBQVgsQ0FBb0J1UCxHQUFwQixDQUF5QixlQUFlM0wsSUFBTSxlQUE5QyxFQUE4RCxTQUE5RCxFQUF5RTtBQUN4RVYsU0FBTSxRQURrRTtBQUV4RXNNLFVBQU8sTUFGaUU7QUFHeEVDLFlBQVM3TCxJQUgrRDtBQUl4RThMLGNBQVc7QUFKNkQsR0FBekU7QUFNQXRMLGFBQVdwRSxRQUFYLENBQW9CdVAsR0FBcEIsQ0FBeUIsZUFBZTNMLElBQU0sb0JBQTlDLEVBQW1FLEtBQW5FLEVBQTBFO0FBQ3pFVixTQUFNLFNBRG1FO0FBRXpFc00sVUFBTyxNQUZrRTtBQUd6RUMsWUFBUzdMLElBSGdFO0FBSXpFOEwsY0FBVztBQUo4RCxHQUExRTtBQU1BOztBQTdFYSxDQUFmOztBQWdGQSxNQUFNVixpQkFBaUIsVUFBUzdJLE9BQVQsRUFBa0I7QUFDeEMsUUFBTztBQUNOeUosbUJBQWlCeEwsV0FBV3BFLFFBQVgsQ0FBb0I2UCxHQUFwQixDQUF5QixHQUFHMUosUUFBUTJKLEdBQUssb0JBQXpDLENBRFg7QUFFTkMsb0JBQWtCM0wsV0FBV3BFLFFBQVgsQ0FBb0I2UCxHQUFwQixDQUF5QixHQUFHMUosUUFBUTJKLEdBQUsscUJBQXpDLENBRlo7QUFHTkUsZUFBYTVMLFdBQVdwRSxRQUFYLENBQW9CNlAsR0FBcEIsQ0FBeUIsR0FBRzFKLFFBQVEySixHQUFLLGVBQXpDLENBSFA7QUFJTkcsZ0JBQWM7QUFDYnZQLGFBQVUwRCxXQUFXcEUsUUFBWCxDQUFvQjZQLEdBQXBCLENBQXlCLEdBQUcxSixRQUFRMkosR0FBSyxXQUF6QztBQURHLEdBSlI7QUFPTjNGLGNBQVkvRixXQUFXcEUsUUFBWCxDQUFvQjZQLEdBQXBCLENBQXlCLEdBQUcxSixRQUFRMkosR0FBSyxjQUF6QyxDQVBOO0FBUU4xRixxQkFBbUJoRyxXQUFXcEUsUUFBWCxDQUFvQjZQLEdBQXBCLENBQXlCLEdBQUcxSixRQUFRMkosR0FBSyx1QkFBekMsQ0FSYjtBQVNONVAsb0JBQWtCa0UsV0FBV3BFLFFBQVgsQ0FBb0I2UCxHQUFwQixDQUF5QixHQUFHMUosUUFBUTJKLEdBQUssb0JBQXpDLENBVFo7QUFVTmpMLFVBQVFULFdBQVdwRSxRQUFYLENBQW9CNlAsR0FBcEIsQ0FBeUIsR0FBRzFKLFFBQVEySixHQUFLLFNBQXpDLENBVkY7QUFXTkksVUFBUTtBQUNQcEcsZUFBWTFGLFdBQVdwRSxRQUFYLENBQW9CNlAsR0FBcEIsQ0FBeUIsR0FBRzFKLFFBQVEySixHQUFLLGNBQXpDLENBREw7QUFFUEssZUFBWS9MLFdBQVdwRSxRQUFYLENBQW9CNlAsR0FBcEIsQ0FBeUIsR0FBRzFKLFFBQVEySixHQUFLLGNBQXpDLENBRkw7QUFHUHhFLFNBQU1sSCxXQUFXcEUsUUFBWCxDQUFvQjZQLEdBQXBCLENBQXlCLEdBQUcxSixRQUFRMkosR0FBSyxPQUF6QztBQUhDO0FBWEYsRUFBUDtBQWlCQSxDQWxCRDs7QUFvQkEsTUFBTWIsV0FBVyxDQUFDbUIsRUFBRCxFQUFLQyxLQUFMLEtBQWU7QUFDL0IsS0FBSUMsUUFBUSxJQUFaO0FBQ0EsUUFBTyxNQUFNO0FBQ1osTUFBSUEsU0FBUyxJQUFiLEVBQW1CO0FBQ2xCM1AsVUFBTzRQLFlBQVAsQ0FBb0JELEtBQXBCO0FBQ0E7O0FBQ0QsU0FBT0EsUUFBUTNQLE9BQU82UCxVQUFQLENBQWtCSixFQUFsQixFQUFzQkMsS0FBdEIsQ0FBZjtBQUNBLEVBTEQ7QUFNQSxDQVJEOztBQVNBLE1BQU12SyxjQUFjLE1BQXBCOztBQUVBLE1BQU1pSix1QkFBdUIsVUFBUzBCLFdBQVQsRUFBc0I7QUFDbEQsS0FBSXhGLGNBQWMsS0FBbEI7QUFDQSxLQUFJbkIsYUFBYSxLQUFqQjs7QUFDQSxLQUFJMkcsWUFBWVAsTUFBWixDQUFtQnBHLFVBQW5CLElBQWlDMkcsWUFBWVAsTUFBWixDQUFtQkMsVUFBeEQsRUFBb0U7QUFDbkVyRyxlQUFhMkcsWUFBWVAsTUFBWixDQUFtQnBHLFVBQWhDO0FBQ0FtQixnQkFBY3dGLFlBQVlQLE1BQVosQ0FBbUJDLFVBQWpDO0FBQ0EsRUFIRCxNQUdPLElBQUlNLFlBQVlQLE1BQVosQ0FBbUJwRyxVQUFuQixJQUFpQzJHLFlBQVlQLE1BQVosQ0FBbUJDLFVBQXhELEVBQW9FO0FBQzFFakIsU0FBTy9MLEtBQVAsQ0FBYSwyQ0FBYjtBQUNBLEVBUmlELENBU2xEOzs7QUFDQXJELFVBQVNDLElBQVQsQ0FBY0MsUUFBZCxDQUF1QkUsZ0JBQXZCLEdBQTBDdVEsWUFBWXZRLGdCQUF0RDtBQUNBLFFBQU87QUFDTlEsWUFBVStQLFlBQVlSLFlBQVosQ0FBeUJ2UCxRQUQ3QjtBQUVOeUosY0FBWXNHLFlBQVl0RyxVQUZsQjtBQUdOQyxxQkFBbUJxRyxZQUFZckcsaUJBSHpCO0FBSU52RixVQUFRNEwsWUFBWTVMLE1BSmQ7QUFLTnlHLFFBQU1tRixZQUFZUCxNQUFaLENBQW1CNUUsSUFMbkI7QUFNTkwsYUFOTTtBQU9ObkI7QUFQTSxFQUFQO0FBU0EsQ0FwQkQ7O0FBc0JBLE1BQU1nRixpQkFBaUJHLFNBQVMsTUFBTTtBQUNyQyxPQUFNbk4sV0FBV3NDLFdBQVdwRSxRQUFYLENBQW9CNlAsR0FBcEIsQ0FBd0IseUJBQXhCLENBQWpCO0FBQ0EvUCxVQUFTQyxJQUFULENBQWNDLFFBQWQsQ0FBdUJHLFNBQXZCLEdBQW1DMkIsU0FBUzRPLEdBQVQsQ0FBY3ZLLE9BQUQsSUFBYTtBQUM1RCxNQUFJQSxRQUFRK0gsS0FBUixLQUFrQixJQUF0QixFQUE0QjtBQUMzQixTQUFNdUMsY0FBY3pCLGVBQWU3SSxPQUFmLENBQXBCO0FBQ0ErSSxVQUFPRSxPQUFQLENBQWVqSixRQUFRMkosR0FBdkI7QUFDQWEsd0JBQXFCQyxjQUFyQixDQUFvQ0MsTUFBcEMsQ0FBMkM7QUFDMUMxSyxhQUFTTCxZQUFZZ0wsV0FBWjtBQURpQyxJQUEzQyxFQUVHO0FBQ0Z4TyxVQUFNbU87QUFESixJQUZIO0FBS0EsVUFBTzFCLHFCQUFxQjBCLFdBQXJCLENBQVA7QUFDQSxHQVRELE1BU087QUFDTkUsd0JBQXFCQyxjQUFyQixDQUFvQ0csTUFBcEMsQ0FBMkM7QUFDMUM1SyxhQUFTTCxZQUFZZ0wsV0FBWjtBQURpQyxJQUEzQztBQUdBO0FBQ0QsRUFma0MsRUFlaEM5UCxNQWZnQyxDQWV6QmdRLEtBQUtBLENBZm9CLENBQW5DO0FBZ0JBLENBbEJzQixFQWtCcEIsSUFsQm9CLENBQXZCO0FBcUJBNU0sV0FBV3BFLFFBQVgsQ0FBb0I2UCxHQUFwQixDQUF3QixVQUF4QixFQUFvQ2YsY0FBcEM7QUFFQW5PLE9BQU9zUSxPQUFQLENBQWUsTUFBTTtBQUNwQixRQUFPdFEsT0FBT3VRLElBQVAsQ0FBWSxnQkFBWixFQUE4QixTQUE5QixDQUFQO0FBQ0EsQ0FGRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9zdGVmZm9fbWV0ZW9yLWFjY291bnRzLXNhbWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWxzIFJvdXRlUG9saWN5LCBTQU1MICovXG4vKiBqc2hpbnQgbmV3Y2FwOiBmYWxzZSAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmlmICghQWNjb3VudHMuc2FtbCkge1xuXHRBY2NvdW50cy5zYW1sID0ge1xuXHRcdHNldHRpbmdzOiB7XG5cdFx0XHRkZWJ1ZzogdHJ1ZSxcblx0XHRcdGdlbmVyYXRlVXNlcm5hbWU6IGZhbHNlLFxuXHRcdFx0cHJvdmlkZXJzOiBbXVxuXHRcdH1cblx0fTtcbn1cblxuY29uc3QgZmliZXIgPSBOcG0ucmVxdWlyZSgnZmliZXJzJyk7XG5jb25zdCBjb25uZWN0ID0gTnBtLnJlcXVpcmUoJ2Nvbm5lY3QnKTtcblJvdXRlUG9saWN5LmRlY2xhcmUoJy9fc2FtbC8nLCAnbmV0d29yaycpO1xuXG4vKipcbiAqIEZldGNoIFNBTUwgcHJvdmlkZXIgY29uZmlncyBmb3IgZ2l2ZW4gJ3Byb3ZpZGVyJy5cbiAqL1xuZnVuY3Rpb24gZ2V0U2FtbFByb3ZpZGVyQ29uZmlnKHByb3ZpZGVyKSB7XG5cdGlmICghIHByb3ZpZGVyKSB7XG5cdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm8tc2FtbC1wcm92aWRlcicsXG5cdFx0XHQnU0FNTCBpbnRlcm5hbCBlcnJvcicsXG5cdFx0XHR7IG1ldGhvZDogJ2dldFNhbWxQcm92aWRlckNvbmZpZycgfSk7XG5cdH1cblx0Y29uc3Qgc2FtbFByb3ZpZGVyID0gZnVuY3Rpb24oZWxlbWVudCkge1xuXHRcdHJldHVybiAoZWxlbWVudC5wcm92aWRlciA9PT0gcHJvdmlkZXIpO1xuXHR9O1xuXHRyZXR1cm4gQWNjb3VudHMuc2FtbC5zZXR0aW5ncy5wcm92aWRlcnMuZmlsdGVyKHNhbWxQcm92aWRlcilbMF07XG59XG5cbk1ldGVvci5tZXRob2RzKHtcblx0c2FtbExvZ291dChwcm92aWRlcikge1xuXHRcdC8vIE1ha2Ugc3VyZSB0aGUgdXNlciBpcyBsb2dnZWQgaW4gYmVmb3JlIGluaXRpYXRlIFNBTUwgU0xPXG5cdFx0aWYgKCFNZXRlb3IudXNlcklkKCkpIHtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2Vycm9yLWludmFsaWQtdXNlcicsICdJbnZhbGlkIHVzZXInLCB7IG1ldGhvZDogJ3NhbWxMb2dvdXQnIH0pO1xuXHRcdH1cblx0XHRjb25zdCBwcm92aWRlckNvbmZpZyA9IGdldFNhbWxQcm92aWRlckNvbmZpZyhwcm92aWRlcik7XG5cblx0XHRpZiAoQWNjb3VudHMuc2FtbC5zZXR0aW5ncy5kZWJ1Zykge1xuXHRcdFx0Y29uc29sZS5sb2coYExvZ291dCByZXF1ZXN0IGZyb20gJHsgSlNPTi5zdHJpbmdpZnkocHJvdmlkZXJDb25maWcpIH1gKTtcblx0XHR9XG5cdFx0Ly8gVGhpcyBxdWVyeSBzaG91bGQgcmVzcGVjdCB1cGNvbWluZyBhcnJheSBvZiBTQU1MIGxvZ2luc1xuXHRcdGNvbnN0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZSh7XG5cdFx0XHRfaWQ6IE1ldGVvci51c2VySWQoKSxcblx0XHRcdCdzZXJ2aWNlcy5zYW1sLnByb3ZpZGVyJzogcHJvdmlkZXJcblx0XHR9LCB7XG5cdFx0XHQnc2VydmljZXMuc2FtbCc6IDFcblx0XHR9KTtcblx0XHRsZXQgbmFtZUlEID0gdXNlci5zZXJ2aWNlcy5zYW1sLm5hbWVJRDtcblx0XHRjb25zdCBzZXNzaW9uSW5kZXggPSB1c2VyLnNlcnZpY2VzLnNhbWwuaWRwU2Vzc2lvbjtcblx0XHRuYW1lSUQgPSBzZXNzaW9uSW5kZXg7XG5cdFx0aWYgKEFjY291bnRzLnNhbWwuc2V0dGluZ3MuZGVidWcpIHtcblx0XHRcdGNvbnNvbGUubG9nKGBOYW1lSUQgZm9yIHVzZXIgJHsgTWV0ZW9yLnVzZXJJZCgpIH0gZm91bmQ6ICR7IEpTT04uc3RyaW5naWZ5KG5hbWVJRCkgfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IF9zYW1sID0gbmV3IFNBTUwocHJvdmlkZXJDb25maWcpO1xuXG5cdFx0Y29uc3QgcmVxdWVzdCA9IF9zYW1sLmdlbmVyYXRlTG9nb3V0UmVxdWVzdCh7XG5cdFx0XHRuYW1lSUQsXG5cdFx0XHRzZXNzaW9uSW5kZXhcblx0XHR9KTtcblxuXHRcdC8vIHJlcXVlc3QucmVxdWVzdDogYWN0dWFsIFhNTCBTQU1MIFJlcXVlc3Rcblx0XHQvLyByZXF1ZXN0LmlkOiBjb21taW51Y2F0aW9uIGlkIHdoaWNoIHdpbGwgYmUgbWVudGlvbmVkIGluIHRoZSBSZXNwb25zZVRvIGZpZWxkIG9mIFNBTUxSZXNwb25zZVxuXG5cdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZSh7XG5cdFx0XHRfaWQ6IE1ldGVvci51c2VySWQoKVxuXHRcdH0sIHtcblx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0J3NlcnZpY2VzLnNhbWwuaW5SZXNwb25zZVRvJzogcmVxdWVzdC5pZFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgX3N5bmNSZXF1ZXN0VG9VcmwgPSBNZXRlb3Iud3JhcEFzeW5jKF9zYW1sLnJlcXVlc3RUb1VybCwgX3NhbWwpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IF9zeW5jUmVxdWVzdFRvVXJsKHJlcXVlc3QucmVxdWVzdCwgJ2xvZ291dCcpO1xuXHRcdGlmIChBY2NvdW50cy5zYW1sLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhgU0FNTCBMb2dvdXQgUmVxdWVzdCAkeyByZXN1bHQgfWApO1xuXHRcdH1cblxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufSk7XG5cbkFjY291bnRzLnJlZ2lzdGVyTG9naW5IYW5kbGVyKGZ1bmN0aW9uKGxvZ2luUmVxdWVzdCkge1xuXHRpZiAoIWxvZ2luUmVxdWVzdC5zYW1sIHx8ICFsb2dpblJlcXVlc3QuY3JlZGVudGlhbFRva2VuKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNvbnN0IGxvZ2luUmVzdWx0ID0gQWNjb3VudHMuc2FtbC5yZXRyaWV2ZUNyZWRlbnRpYWwobG9naW5SZXF1ZXN0LmNyZWRlbnRpYWxUb2tlbik7XG5cdGlmIChBY2NvdW50cy5zYW1sLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0Y29uc29sZS5sb2coYFJFU1VMVCA6JHsgSlNPTi5zdHJpbmdpZnkobG9naW5SZXN1bHQpIH1gKTtcblx0fVxuXG5cdGlmIChsb2dpblJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6ICdzYW1sJyxcblx0XHRcdGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKEFjY291bnRzLkxvZ2luQ2FuY2VsbGVkRXJyb3IubnVtZXJpY0Vycm9yLCAnTm8gbWF0Y2hpbmcgbG9naW4gYXR0ZW1wdCBmb3VuZCcpXG5cdFx0fTtcblx0fVxuXG5cdGlmIChsb2dpblJlc3VsdCAmJiBsb2dpblJlc3VsdC5wcm9maWxlICYmIGxvZ2luUmVzdWx0LnByb2ZpbGUuZW1haWwpIHtcblx0XHRjb25zdCBlbWFpbCA9IFJlZ0V4cC5lc2NhcGUobG9naW5SZXN1bHQucHJvZmlsZS5lbWFpbCk7XG5cdFx0Y29uc3QgZW1haWxSZWdleCA9IG5ldyBSZWdFeHAoYF4keyBlbWFpbCB9JGAsICdpJyk7XG5cdFx0bGV0IHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZSh7XG5cdFx0XHQnZW1haWxzLmFkZHJlc3MnOiBlbWFpbFJlZ2V4XG5cdFx0fSk7XG5cblx0XHRpZiAoIXVzZXIpIHtcblx0XHRcdGNvbnN0IG5ld1VzZXIgPSB7XG5cdFx0XHRcdG5hbWU6IGxvZ2luUmVzdWx0LnByb2ZpbGUuY24gfHwgbG9naW5SZXN1bHQucHJvZmlsZS51c2VybmFtZSxcblx0XHRcdFx0YWN0aXZlOiB0cnVlLFxuXHRcdFx0XHRnbG9iYWxSb2xlczogWyd1c2VyJ10sXG5cdFx0XHRcdGVtYWlsczogW3tcblx0XHRcdFx0XHRhZGRyZXNzOiBsb2dpblJlc3VsdC5wcm9maWxlLmVtYWlsLFxuXHRcdFx0XHRcdHZlcmlmaWVkOiB0cnVlXG5cdFx0XHRcdH1dXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoQWNjb3VudHMuc2FtbC5zZXR0aW5ncy5nZW5lcmF0ZVVzZXJuYW1lID09PSB0cnVlKSB7XG5cdFx0XHRcdGNvbnN0IHVzZXJuYW1lID0gUm9ja2V0Q2hhdC5nZW5lcmF0ZVVzZXJuYW1lU3VnZ2VzdGlvbihuZXdVc2VyKTtcblx0XHRcdFx0aWYgKHVzZXJuYW1lKSB7XG5cdFx0XHRcdFx0bmV3VXNlci51c2VybmFtZSA9IHVzZXJuYW1lO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGxvZ2luUmVzdWx0LnByb2ZpbGUudXNlcm5hbWUpIHtcblx0XHRcdFx0bmV3VXNlci51c2VybmFtZSA9IGxvZ2luUmVzdWx0LnByb2ZpbGUudXNlcm5hbWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHVzZXJJZCA9IEFjY291bnRzLmluc2VydFVzZXJEb2Moe30sIG5ld1VzZXIpO1xuXHRcdFx0dXNlciA9IE1ldGVvci51c2Vycy5maW5kT25lKHVzZXJJZCk7XG5cdFx0fVxuXG5cdFx0Ly9jcmVhdGluZyB0aGUgdG9rZW4gYW5kIGFkZGluZyB0byB0aGUgdXNlclxuXHRcdGNvbnN0IHN0YW1wZWRUb2tlbiA9IEFjY291bnRzLl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuKCk7XG5cdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZSh1c2VyLCB7XG5cdFx0XHQkcHVzaDoge1xuXHRcdFx0XHQnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zJzogc3RhbXBlZFRva2VuXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzYW1sTG9naW4gPSB7XG5cdFx0XHRwcm92aWRlcjogQWNjb3VudHMuc2FtbC5SZWxheVN0YXRlLFxuXHRcdFx0aWRwOiBsb2dpblJlc3VsdC5wcm9maWxlLmlzc3Vlcixcblx0XHRcdGlkcFNlc3Npb246IGxvZ2luUmVzdWx0LnByb2ZpbGUuc2Vzc2lvbkluZGV4LFxuXHRcdFx0bmFtZUlEOiBsb2dpblJlc3VsdC5wcm9maWxlLm5hbWVJRFxuXHRcdH07XG5cblx0XHRNZXRlb3IudXNlcnMudXBkYXRlKHtcblx0XHRcdF9pZDogdXNlci5faWRcblx0XHR9LCB7XG5cdFx0XHQkc2V0OiB7XG5cdFx0XHRcdC8vIFRCRCB0aGlzIHNob3VsZCBiZSBwdXNoZWQsIG90aGVyd2lzZSB3ZSdyZSBvbmx5IGFibGUgdG8gU1NPIGludG8gYSBzaW5nbGUgSURQIGF0IGEgdGltZVxuXHRcdFx0XHQnc2VydmljZXMuc2FtbCc6IHNhbWxMb2dpblxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly9zZW5kaW5nIHRva2VuIGFsb25nIHdpdGggdGhlIHVzZXJJZFxuXHRcdGNvbnN0IHJlc3VsdCA9IHtcblx0XHRcdHVzZXJJZDogdXNlci5faWQsXG5cdFx0XHR0b2tlbjogc3RhbXBlZFRva2VuLnRva2VuXG5cdFx0fTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1NBTUwgUHJvZmlsZSBkaWQgbm90IGNvbnRhaW4gYW4gZW1haWwgYWRkcmVzcycpO1xuXHR9XG59KTtcblxuQWNjb3VudHMuc2FtbC5fbG9naW5SZXN1bHRGb3JDcmVkZW50aWFsVG9rZW4gPSB7fTtcblxuQWNjb3VudHMuc2FtbC5oYXNDcmVkZW50aWFsID0gZnVuY3Rpb24oY3JlZGVudGlhbFRva2VuKSB7XG5cdHJldHVybiBfLmhhcyhBY2NvdW50cy5zYW1sLl9sb2dpblJlc3VsdEZvckNyZWRlbnRpYWxUb2tlbiwgY3JlZGVudGlhbFRva2VuKTtcbn07XG5cbkFjY291bnRzLnNhbWwucmV0cmlldmVDcmVkZW50aWFsID0gZnVuY3Rpb24oY3JlZGVudGlhbFRva2VuKSB7XG5cdC8vIFRoZSBjcmVkZW50aWFsVG9rZW4gaW4gYWxsIHRoZXNlIGZ1bmN0aW9ucyBjb3JyZXNwb25kcyB0byBTQU1McyBpblJlc3BvbnNlVG8gZmllbGQgYW5kIGlzIG1hbmRhdG9yeSB0byBjaGVjay5cblx0Y29uc3QgcmVzdWx0ID0gQWNjb3VudHMuc2FtbC5fbG9naW5SZXN1bHRGb3JDcmVkZW50aWFsVG9rZW5bY3JlZGVudGlhbFRva2VuXTtcblx0ZGVsZXRlIEFjY291bnRzLnNhbWwuX2xvZ2luUmVzdWx0Rm9yQ3JlZGVudGlhbFRva2VuW2NyZWRlbnRpYWxUb2tlbl07XG5cdHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBjbG9zZVBvcHVwID0gZnVuY3Rpb24ocmVzLCBlcnIpIHtcblx0cmVzLndyaXRlSGVhZCgyMDAsIHtcblx0XHQnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbCdcblx0fSk7XG5cdGxldCBjb250ZW50ID0gJzxodG1sPjxoZWFkPjxzY3JpcHQ+d2luZG93LmNsb3NlKCk8L3NjcmlwdD48L2hlYWQ+PGJvZHk+PEgxPlZlcmlmaWVkPC9IMT48L2JvZHk+PC9odG1sPic7XG5cdGlmIChlcnIpIHtcblx0XHRjb250ZW50ID0gYDxodG1sPjxib2R5PjxoMj5Tb3JyeSwgYW4gYW5ub3lpbmcgZXJyb3Igb2NjdXJlZDwvaDI+PGRpdj4keyBlcnIgfTwvZGl2PjxhIG9uY2xpY2s9XCJ3aW5kb3cuY2xvc2UoKTtcIj5DbG9zZSBXaW5kb3c8L2E+PC9ib2R5PjwvaHRtbD5gO1xuXHR9XG5cdHJlcy5lbmQoY29udGVudCwgJ3V0Zi04Jyk7XG59O1xuXG5jb25zdCBzYW1sVXJsVG9PYmplY3QgPSBmdW5jdGlvbih1cmwpIHtcblx0Ly8gcmVxLnVybCB3aWxsIGJlICcvX3NhbWwvPGFjdGlvbj4vPHNlcnZpY2UgbmFtZT4vPGNyZWRlbnRpYWxUb2tlbj4nXG5cdGlmICghdXJsKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBzcGxpdFVybCA9IHVybC5zcGxpdCgnPycpO1xuXHRjb25zdCBzcGxpdFBhdGggPSBzcGxpdFVybFswXS5zcGxpdCgnLycpO1xuXG5cdC8vIEFueSBub24tc2FtbCByZXF1ZXN0IHdpbGwgY29udGludWUgZG93biB0aGUgZGVmYXVsdFxuXHQvLyBtaWRkbGV3YXJlcy5cblx0aWYgKHNwbGl0UGF0aFsxXSAhPT0gJ19zYW1sJykge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Y29uc3QgcmVzdWx0ID0ge1xuXHRcdGFjdGlvbk5hbWU6IHNwbGl0UGF0aFsyXSxcblx0XHRzZXJ2aWNlTmFtZTogc3BsaXRQYXRoWzNdLFxuXHRcdGNyZWRlbnRpYWxUb2tlbjogc3BsaXRQYXRoWzRdXG5cdH07XG5cdGlmIChBY2NvdW50cy5zYW1sLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0Y29uc29sZS5sb2cocmVzdWx0KTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgbWlkZGxld2FyZSA9IGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG5cdC8vIE1ha2Ugc3VyZSB0byBjYXRjaCBhbnkgZXhjZXB0aW9ucyBiZWNhdXNlIG90aGVyd2lzZSB3ZSdkIGNyYXNoXG5cdC8vIHRoZSBydW5uZXJcblx0dHJ5IHtcblx0XHRjb25zdCBzYW1sT2JqZWN0ID0gc2FtbFVybFRvT2JqZWN0KHJlcS51cmwpO1xuXHRcdGlmICghc2FtbE9iamVjdCB8fCAhc2FtbE9iamVjdC5zZXJ2aWNlTmFtZSkge1xuXHRcdFx0bmV4dCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghc2FtbE9iamVjdC5hY3Rpb25OYW1lKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgU0FNTCBhY3Rpb24nKTtcblx0XHR9XG5cblx0XHRjb25zb2xlLmxvZyhBY2NvdW50cy5zYW1sLnNldHRpbmdzLnByb3ZpZGVycyk7XG5cdFx0Y29uc29sZS5sb2coc2FtbE9iamVjdC5zZXJ2aWNlTmFtZSk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IF8uZmluZChBY2NvdW50cy5zYW1sLnNldHRpbmdzLnByb3ZpZGVycywgZnVuY3Rpb24oc2FtbFNldHRpbmcpIHtcblx0XHRcdHJldHVybiBzYW1sU2V0dGluZy5wcm92aWRlciA9PT0gc2FtbE9iamVjdC5zZXJ2aWNlTmFtZTtcblx0XHR9KTtcblxuXHRcdC8vIFNraXAgZXZlcnl0aGluZyBpZiB0aGVyZSdzIG5vIHNlcnZpY2Ugc2V0IGJ5IHRoZSBzYW1sIG1pZGRsZXdhcmVcblx0XHRpZiAoIXNlcnZpY2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBTQU1MIHNlcnZpY2UgJHsgc2FtbE9iamVjdC5zZXJ2aWNlTmFtZSB9YCk7XG5cdFx0fVxuXHRcdGxldCBfc2FtbDtcblx0XHRzd2l0Y2ggKHNhbWxPYmplY3QuYWN0aW9uTmFtZSkge1xuXHRcdFx0Y2FzZSAnbWV0YWRhdGEnOlxuXHRcdFx0XHRfc2FtbCA9IG5ldyBTQU1MKHNlcnZpY2UpO1xuXHRcdFx0XHRzZXJ2aWNlLmNhbGxiYWNrVXJsID0gTWV0ZW9yLmFic29sdXRlVXJsKGBfc2FtbC92YWxpZGF0ZS8keyBzZXJ2aWNlLnByb3ZpZGVyIH1gKTtcblx0XHRcdFx0cmVzLndyaXRlSGVhZCgyMDApO1xuXHRcdFx0XHRyZXMud3JpdGUoX3NhbWwuZ2VuZXJhdGVTZXJ2aWNlUHJvdmlkZXJNZXRhZGF0YShzZXJ2aWNlLmNhbGxiYWNrVXJsKSk7XG5cdFx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdFx0Ly9jbG9zZVBvcHVwKHJlcyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbG9nb3V0Jzpcblx0XHRcdFx0Ly8gVGhpcyBpcyB3aGVyZSB3ZSByZWNlaXZlIFNBTUwgTG9nb3V0UmVzcG9uc2Vcblx0XHRcdFx0X3NhbWwgPSBuZXcgU0FNTChzZXJ2aWNlKTtcblx0XHRcdFx0X3NhbWwudmFsaWRhdGVMb2dvdXRSZXNwb25zZShyZXEucXVlcnkuU0FNTFJlc3BvbnNlLCBmdW5jdGlvbihlcnIsIHJlc3VsdCkge1xuXHRcdFx0XHRcdGlmICghZXJyKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsb2dPdXRVc2VyID0gZnVuY3Rpb24oaW5SZXNwb25zZVRvKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChBY2NvdW50cy5zYW1sLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYExvZ2dpbmcgT3V0IHVzZXIgdmlhIGluUmVzcG9uc2VUbyAkeyBpblJlc3BvbnNlVG8gfWApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxvZ2dlZE91dFVzZXIgPSBNZXRlb3IudXNlcnMuZmluZCh7XG5cdFx0XHRcdFx0XHRcdFx0J3NlcnZpY2VzLnNhbWwuaW5SZXNwb25zZVRvJzogaW5SZXNwb25zZVRvXG5cdFx0XHRcdFx0XHRcdH0pLmZldGNoKCk7XG5cdFx0XHRcdFx0XHRcdGlmIChsb2dnZWRPdXRVc2VyLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChBY2NvdW50cy5zYW1sLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgRm91bmQgdXNlciAkeyBsb2dnZWRPdXRVc2VyWzBdLl9pZCB9YCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdE1ldGVvci51c2Vycy51cGRhdGUoe1xuXHRcdFx0XHRcdFx0XHRcdFx0X2lkOiBsb2dnZWRPdXRVc2VyWzBdLl9pZFxuXHRcdFx0XHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdFx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucyc6IFtdXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0TWV0ZW9yLnVzZXJzLnVwZGF0ZSh7XG5cdFx0XHRcdFx0XHRcdFx0XHRfaWQ6IGxvZ2dlZE91dFVzZXJbMF0uX2lkXG5cdFx0XHRcdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0XHRcdFx0JHVuc2V0OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdCdzZXJ2aWNlcy5zYW1sJzogJydcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdGb3VuZCBtdWx0aXBsZSB1c2VycyBtYXRjaGluZyBTQU1MIGluUmVzcG9uc2VUbyBmaWVsZHMnKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0ZmliZXIoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdGxvZ091dFVzZXIocmVzdWx0KTtcblx0XHRcdFx0XHRcdH0pLnJ1bigpO1xuXG5cblx0XHRcdFx0XHRcdHJlcy53cml0ZUhlYWQoMzAyLCB7XG5cdFx0XHRcdFx0XHRcdCdMb2NhdGlvbic6IHJlcS5xdWVyeS5SZWxheVN0YXRlXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJlcy5lbmQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gIGVsc2Uge1xuXHRcdFx0XHRcdC8vIFx0Ly8gVEJEIHRoaW5raW5nIG9mIHN0aCBtZWFuaW5nIGZ1bGwuXG5cdFx0XHRcdFx0Ly8gfVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdzbG9SZWRpcmVjdCc6XG5cdFx0XHRcdHJlcy53cml0ZUhlYWQoMzAyLCB7XG5cdFx0XHRcdFx0Ly8gY3JlZGVudGlhbFRva2VuIGhlcmUgaXMgdGhlIFNBTUwgTG9nT3V0IFJlcXVlc3QgdGhhdCB3ZSdsbCBzZW5kIGJhY2sgdG8gSURQXG5cdFx0XHRcdFx0J0xvY2F0aW9uJzogcmVxLnF1ZXJ5LnJlZGlyZWN0XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnYXV0aG9yaXplJzpcblx0XHRcdFx0c2VydmljZS5jYWxsYmFja1VybCA9IE1ldGVvci5hYnNvbHV0ZVVybChgX3NhbWwvdmFsaWRhdGUvJHsgc2VydmljZS5wcm92aWRlciB9YCk7XG5cdFx0XHRcdHNlcnZpY2UuaWQgPSBzYW1sT2JqZWN0LmNyZWRlbnRpYWxUb2tlbjtcblx0XHRcdFx0X3NhbWwgPSBuZXcgU0FNTChzZXJ2aWNlKTtcblx0XHRcdFx0X3NhbWwuZ2V0QXV0aG9yaXplVXJsKHJlcSwgZnVuY3Rpb24oZXJyLCB1cmwpIHtcblx0XHRcdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBnZW5lcmF0ZSBhdXRob3JpemUgdXJsJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlcy53cml0ZUhlYWQoMzAyLCB7XG5cdFx0XHRcdFx0XHQnTG9jYXRpb24nOiB1cmxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXMuZW5kKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3ZhbGlkYXRlJzpcblx0XHRcdFx0X3NhbWwgPSBuZXcgU0FNTChzZXJ2aWNlKTtcblx0XHRcdFx0QWNjb3VudHMuc2FtbC5SZWxheVN0YXRlID0gcmVxLmJvZHkuUmVsYXlTdGF0ZTtcblx0XHRcdFx0X3NhbWwudmFsaWRhdGVSZXNwb25zZShyZXEuYm9keS5TQU1MUmVzcG9uc2UsIHJlcS5ib2R5LlJlbGF5U3RhdGUsIGZ1bmN0aW9uKGVyciwgcHJvZmlsZS8qLCBsb2dnZWRPdXQqLykge1xuXHRcdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIHZhbGlkYXRlIHJlc3BvbnNlIHVybDogJHsgZXJyIH1gKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBjcmVkZW50aWFsVG9rZW4gPSBwcm9maWxlLmluUmVzcG9uc2VUb0lkIHx8IHByb2ZpbGUuSW5SZXNwb25zZVRvIHx8IHNhbWxPYmplY3QuY3JlZGVudGlhbFRva2VuO1xuXHRcdFx0XHRcdGlmICghY3JlZGVudGlhbFRva2VuKSB7XG5cdFx0XHRcdFx0XHQvLyBObyBjcmVkZW50aWFsVG9rZW4gaW4gSWRQLWluaXRpYXRlZCBTU09cblx0XHRcdFx0XHRcdGNvbnN0IHNhbWxfaWRwX2NyZWRlbnRpYWxUb2tlbiA9IFJhbmRvbS5pZCgpO1xuXHRcdFx0XHRcdFx0QWNjb3VudHMuc2FtbC5fbG9naW5SZXN1bHRGb3JDcmVkZW50aWFsVG9rZW5bc2FtbF9pZHBfY3JlZGVudGlhbFRva2VuXSA9IHtcblx0XHRcdFx0XHRcdFx0cHJvZmlsZVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdGNvbnN0IHVybCA9IGAkeyBNZXRlb3IuYWJzb2x1dGVVcmwoJ2hvbWUnKSB9P3NhbWxfaWRwX2NyZWRlbnRpYWxUb2tlbj0keyBzYW1sX2lkcF9jcmVkZW50aWFsVG9rZW4gfWA7XG5cdFx0XHRcdFx0XHRyZXMud3JpdGVIZWFkKDMwMiwge1xuXHRcdFx0XHRcdFx0XHQnTG9jYXRpb24nOiB1cmxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmVzLmVuZCgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRBY2NvdW50cy5zYW1sLl9sb2dpblJlc3VsdEZvckNyZWRlbnRpYWxUb2tlbltjcmVkZW50aWFsVG9rZW5dID0ge1xuXHRcdFx0XHRcdFx0XHRwcm9maWxlXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0Y2xvc2VQb3B1cChyZXMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIFNBTUwgYWN0aW9uICR7IHNhbWxPYmplY3QuYWN0aW9uTmFtZSB9YCk7XG5cblx0XHR9XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdGNsb3NlUG9wdXAocmVzLCBlcnIpO1xuXHR9XG59O1xuXG4vLyBMaXN0ZW4gdG8gaW5jb21pbmcgU0FNTCBodHRwIHJlcXVlc3RzXG5XZWJBcHAuY29ubmVjdEhhbmRsZXJzLnVzZShjb25uZWN0LmJvZHlQYXJzZXIoKSkudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG5cdC8vIE5lZWQgdG8gY3JlYXRlIGEgZmliZXIgc2luY2Ugd2UncmUgdXNpbmcgc3luY2hyb25vdXMgaHR0cCBjYWxscyBhbmQgbm90aGluZ1xuXHQvLyBlbHNlIGlzIHdyYXBwaW5nIHRoaXMgaW4gYSBmaWJlciBhdXRvbWF0aWNhbGx5XG5cdGZpYmVyKGZ1bmN0aW9uKCkge1xuXHRcdG1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpO1xuXHR9KS5ydW4oKTtcbn0pO1xuIiwiLyogZ2xvYmFscyBTQU1MOnRydWUgKi9cblxuY29uc3QgemxpYiA9IE5wbS5yZXF1aXJlKCd6bGliJyk7XG5jb25zdCB4bWwyanMgPSBOcG0ucmVxdWlyZSgneG1sMmpzJyk7XG5jb25zdCB4bWxDcnlwdG8gPSBOcG0ucmVxdWlyZSgneG1sLWNyeXB0bycpO1xuY29uc3QgY3J5cHRvID0gTnBtLnJlcXVpcmUoJ2NyeXB0bycpO1xuY29uc3QgeG1sZG9tID0gTnBtLnJlcXVpcmUoJ3htbGRvbScpO1xuY29uc3QgcXVlcnlzdHJpbmcgPSBOcG0ucmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcbmNvbnN0IHhtbGJ1aWxkZXIgPSBOcG0ucmVxdWlyZSgneG1sYnVpbGRlcicpO1xuXG4vLyB2YXIgcHJlZml4TWF0Y2ggPSBuZXcgUmVnRXhwKC8oPyF4bWxucyleLio6Lyk7XG5cblxuU0FNTCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcblx0dGhpcy5vcHRpb25zID0gdGhpcy5pbml0aWFsaXplKG9wdGlvbnMpO1xufTtcblxuLy8gdmFyIHN0cmlwUHJlZml4ID0gZnVuY3Rpb24oc3RyKSB7XG4vLyBcdHJldHVybiBzdHIucmVwbGFjZShwcmVmaXhNYXRjaCwgJycpO1xuLy8gfTtcblxuU0FNTC5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcblx0aWYgKCFvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IHt9O1xuXHR9XG5cblx0aWYgKCFvcHRpb25zLnByb3RvY29sKSB7XG5cdFx0b3B0aW9ucy5wcm90b2NvbCA9ICdodHRwczovLyc7XG5cdH1cblxuXHRpZiAoIW9wdGlvbnMucGF0aCkge1xuXHRcdG9wdGlvbnMucGF0aCA9ICcvc2FtbC9jb25zdW1lJztcblx0fVxuXG5cdGlmICghb3B0aW9ucy5pc3N1ZXIpIHtcblx0XHRvcHRpb25zLmlzc3VlciA9ICdvbmVsb2dpbl9zYW1sJztcblx0fVxuXG5cdGlmIChvcHRpb25zLmlkZW50aWZpZXJGb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuXHRcdG9wdGlvbnMuaWRlbnRpZmllckZvcm1hdCA9ICd1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoxLjE6bmFtZWlkLWZvcm1hdDplbWFpbEFkZHJlc3MnO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuYXV0aG5Db250ZXh0ID09PSB1bmRlZmluZWQpIHtcblx0XHRvcHRpb25zLmF1dGhuQ29udGV4dCA9ICd1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6YWM6Y2xhc3NlczpQYXNzd29yZFByb3RlY3RlZFRyYW5zcG9ydCc7XG5cdH1cblxuXHRyZXR1cm4gb3B0aW9ucztcbn07XG5cblNBTUwucHJvdG90eXBlLmdlbmVyYXRlVW5pcXVlSUQgPSBmdW5jdGlvbigpIHtcblx0Y29uc3QgY2hhcnMgPSAnYWJjZGVmMDEyMzQ1Njc4OSc7XG5cdGxldCB1bmlxdWVJRCA9ICdpZC0nO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IDIwOyBpKyspIHtcblx0XHR1bmlxdWVJRCArPSBjaGFycy5zdWJzdHIoTWF0aC5mbG9vcigoTWF0aC5yYW5kb20oKSAqIDE1KSksIDEpO1xuXHR9XG5cdHJldHVybiB1bmlxdWVJRDtcbn07XG5cblNBTUwucHJvdG90eXBlLmdlbmVyYXRlSW5zdGFudCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xufTtcblxuU0FNTC5wcm90b3R5cGUuc2lnblJlcXVlc3QgPSBmdW5jdGlvbih4bWwpIHtcblx0Y29uc3Qgc2lnbmVyID0gY3J5cHRvLmNyZWF0ZVNpZ24oJ1JTQS1TSEExJyk7XG5cdHNpZ25lci51cGRhdGUoeG1sKTtcblx0cmV0dXJuIHNpZ25lci5zaWduKHRoaXMub3B0aW9ucy5wcml2YXRlS2V5LCAnYmFzZTY0Jyk7XG59O1xuXG5TQU1MLnByb3RvdHlwZS5nZW5lcmF0ZUF1dGhvcml6ZVJlcXVlc3QgPSBmdW5jdGlvbihyZXEpIHtcblx0bGV0IGlkID0gYF8keyB0aGlzLmdlbmVyYXRlVW5pcXVlSUQoKSB9YDtcblx0Y29uc3QgaW5zdGFudCA9IHRoaXMuZ2VuZXJhdGVJbnN0YW50KCk7XG5cblx0Ly8gUG9zdC1hdXRoIGRlc3RpbmF0aW9uXG5cdGxldCBjYWxsYmFja1VybDtcblx0aWYgKHRoaXMub3B0aW9ucy5jYWxsYmFja1VybCkge1xuXHRcdGNhbGxiYWNrVXJsID0gdGhpcy5vcHRpb25zLmNhbGxiYWNrVXJsO1xuXHR9IGVsc2Uge1xuXHRcdGNhbGxiYWNrVXJsID0gdGhpcy5vcHRpb25zLnByb3RvY29sICsgcmVxLmhlYWRlcnMuaG9zdCArIHRoaXMub3B0aW9ucy5wYXRoO1xuXHR9XG5cblx0aWYgKHRoaXMub3B0aW9ucy5pZCkge1xuXHRcdGlkID0gdGhpcy5vcHRpb25zLmlkO1xuXHR9XG5cblx0bGV0IHJlcXVlc3QgPVxuXHRcdGA8c2FtbHA6QXV0aG5SZXF1ZXN0IHhtbG5zOnNhbWxwPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOnByb3RvY29sXCIgSUQ9XCIkeyBpZCB9XCIgVmVyc2lvbj1cIjIuMFwiIElzc3VlSW5zdGFudD1cIiR7IGluc3RhbnRcblx0XHR9XCIgUHJvdG9jb2xCaW5kaW5nPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmJpbmRpbmdzOkhUVFAtUE9TVFwiIEFzc2VydGlvbkNvbnN1bWVyU2VydmljZVVSTD1cIiR7IGNhbGxiYWNrVXJsIH1cIiBEZXN0aW5hdGlvbj1cIiR7XG5cdFx0XHR0aGlzLm9wdGlvbnMuZW50cnlQb2ludCB9XCI+YCArXG5cdFx0YDxzYW1sOklzc3VlciB4bWxuczpzYW1sPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvblwiPiR7IHRoaXMub3B0aW9ucy5pc3N1ZXIgfTwvc2FtbDpJc3N1ZXI+XFxuYDtcblxuXHRpZiAodGhpcy5vcHRpb25zLmlkZW50aWZpZXJGb3JtYXQpIHtcblx0XHRyZXF1ZXN0ICs9IGA8c2FtbHA6TmFtZUlEUG9saWN5IHhtbG5zOnNhbWxwPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOnByb3RvY29sXCIgRm9ybWF0PVwiJHsgdGhpcy5vcHRpb25zLmlkZW50aWZpZXJGb3JtYXRcblx0XHR9XCIgQWxsb3dDcmVhdGU9XCJ0cnVlXCI+PC9zYW1scDpOYW1lSURQb2xpY3k+XFxuYDtcblx0fVxuXG5cdHJlcXVlc3QgKz1cblx0XHQnPHNhbWxwOlJlcXVlc3RlZEF1dGhuQ29udGV4dCB4bWxuczpzYW1scD1cInVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDpwcm90b2NvbFwiIENvbXBhcmlzb249XCJleGFjdFwiPicgK1xuXHRcdCc8c2FtbDpBdXRobkNvbnRleHRDbGFzc1JlZiB4bWxuczpzYW1sPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvblwiPnVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDphYzpjbGFzc2VzOlBhc3N3b3JkUHJvdGVjdGVkVHJhbnNwb3J0PC9zYW1sOkF1dGhuQ29udGV4dENsYXNzUmVmPjwvc2FtbHA6UmVxdWVzdGVkQXV0aG5Db250ZXh0PlxcbicgK1xuXHRcdCc8L3NhbWxwOkF1dGhuUmVxdWVzdD4nO1xuXG5cdHJldHVybiByZXF1ZXN0O1xufTtcblxuU0FNTC5wcm90b3R5cGUuZ2VuZXJhdGVMb2dvdXRSZXF1ZXN0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuXHQvLyBvcHRpb25zIHNob3VsZCBiZSBvZiB0aGUgZm9ybVxuXHQvLyBuYW1lSWQ6IDxuYW1lSWQgYXMgc3VibWl0dGVkIGR1cmluZyBTQU1MIFNTTz5cblx0Ly8gc2Vzc2lvbkluZGV4OiBzZXNzaW9uSW5kZXhcblx0Ly8gLS0tIE5PIFNBTUxzZXR0aW5nczogPE1ldGVvci5zZXR0aW5nLnNhbWwgIGVudHJ5IGZvciB0aGUgcHJvdmlkZXIgeW91IHdhbnQgdG8gU0xPIGZyb21cblxuXHRjb25zdCBpZCA9IGBfJHsgdGhpcy5nZW5lcmF0ZVVuaXF1ZUlEKCkgfWA7XG5cdGNvbnN0IGluc3RhbnQgPSB0aGlzLmdlbmVyYXRlSW5zdGFudCgpO1xuXG5cdGxldCByZXF1ZXN0ID0gYCR7ICc8c2FtbHA6TG9nb3V0UmVxdWVzdCB4bWxuczpzYW1scD1cInVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDpwcm90b2NvbFwiICcgK1xuXHRcdCd4bWxuczpzYW1sPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvblwiIElEPVwiJyB9JHsgaWQgfVwiIFZlcnNpb249XCIyLjBcIiBJc3N1ZUluc3RhbnQ9XCIkeyBpbnN0YW50XG5cdH1cIiBEZXN0aW5hdGlvbj1cIiR7IHRoaXMub3B0aW9ucy5pZHBTTE9SZWRpcmVjdFVSTCB9XCI+YCArXG5cdFx0YDxzYW1sOklzc3VlciB4bWxuczpzYW1sPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvblwiPiR7IHRoaXMub3B0aW9ucy5pc3N1ZXIgfTwvc2FtbDpJc3N1ZXI+YCArXG5cdFx0YDxzYW1sOk5hbWVJRCBGb3JtYXQ9XCIkeyB0aGlzLm9wdGlvbnMuaWRlbnRpZmllckZvcm1hdCB9XCI+JHsgb3B0aW9ucy5uYW1lSUQgfTwvc2FtbDpOYW1lSUQ+YCArXG5cdFx0Jzwvc2FtbHA6TG9nb3V0UmVxdWVzdD4nO1xuXG5cdHJlcXVlc3QgPSBgJHsgJzxzYW1scDpMb2dvdXRSZXF1ZXN0IHhtbG5zOnNhbWxwPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOnByb3RvY29sXCIgICcgK1xuXHRcdCdJRD1cIicgfSR7IGlkIH1cIiBgICtcblx0XHQnVmVyc2lvbj1cIjIuMFwiICcgK1xuXHRcdGBJc3N1ZUluc3RhbnQ9XCIkeyBpbnN0YW50IH1cIiBgICtcblx0XHRgRGVzdGluYXRpb249XCIkeyB0aGlzLm9wdGlvbnMuaWRwU0xPUmVkaXJlY3RVUkwgfVwiIGAgK1xuXHRcdCc+JyArXG5cdFx0YDxzYW1sOklzc3VlciB4bWxuczpzYW1sPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvblwiPiR7IHRoaXMub3B0aW9ucy5pc3N1ZXIgfTwvc2FtbDpJc3N1ZXI+YCArXG5cdFx0JzxzYW1sOk5hbWVJRCB4bWxuczpzYW1sPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvblwiICcgK1xuXHRcdCdOYW1lUXVhbGlmaWVyPVwiaHR0cDovL2lkLmluaXQ4Lm5ldDo4MDgwL29wZW5hbVwiICcgK1xuXHRcdGBTUE5hbWVRdWFsaWZpZXI9XCIkeyB0aGlzLm9wdGlvbnMuaXNzdWVyIH1cIiBgICtcblx0XHRgRm9ybWF0PVwiJHsgdGhpcy5vcHRpb25zLmlkZW50aWZpZXJGb3JtYXQgfVwiPiR7XG5cdFx0XHRvcHRpb25zLm5hbWVJRCB9PC9zYW1sOk5hbWVJRD5gICtcblx0XHRgPHNhbWxwOlNlc3Npb25JbmRleCB4bWxuczpzYW1scD1cInVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDpwcm90b2NvbFwiPiR7IG9wdGlvbnMuc2Vzc2lvbkluZGV4IH08L3NhbWxwOlNlc3Npb25JbmRleD5gICtcblx0XHQnPC9zYW1scDpMb2dvdXRSZXF1ZXN0Pic7XG5cdGlmIChNZXRlb3Iuc2V0dGluZ3MuZGVidWcpIHtcblx0XHRjb25zb2xlLmxvZygnLS0tLS0tLSBTQU1MIExvZ291dCByZXF1ZXN0IC0tLS0tLS0tLS0tJyk7XG5cdFx0Y29uc29sZS5sb2cocmVxdWVzdCk7XG5cdH1cblx0cmV0dXJuIHtcblx0XHRyZXF1ZXN0LFxuXHRcdGlkXG5cdH07XG59O1xuXG5TQU1MLnByb3RvdHlwZS5yZXF1ZXN0VG9VcmwgPSBmdW5jdGlvbihyZXF1ZXN0LCBvcGVyYXRpb24sIGNhbGxiYWNrKSB7XG5cdGNvbnN0IHNlbGYgPSB0aGlzO1xuXHR6bGliLmRlZmxhdGVSYXcocmVxdWVzdCwgZnVuY3Rpb24oZXJyLCBidWZmZXIpIHtcblx0XHRpZiAoZXJyKSB7XG5cdFx0XHRyZXR1cm4gY2FsbGJhY2soZXJyKTtcblx0XHR9XG5cblx0XHRjb25zdCBiYXNlNjQgPSBidWZmZXIudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXHRcdGxldCB0YXJnZXQgPSBzZWxmLm9wdGlvbnMuZW50cnlQb2ludDtcblxuXHRcdGlmIChvcGVyYXRpb24gPT09ICdsb2dvdXQnKSB7XG5cdFx0XHRpZiAoc2VsZi5vcHRpb25zLmlkcFNMT1JlZGlyZWN0VVJMKSB7XG5cdFx0XHRcdHRhcmdldCA9IHNlbGYub3B0aW9ucy5pZHBTTE9SZWRpcmVjdFVSTDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGFyZ2V0LmluZGV4T2YoJz8nKSA+IDApIHtcblx0XHRcdHRhcmdldCArPSAnJic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhcmdldCArPSAnPyc7XG5cdFx0fVxuXG5cdFx0Ly8gVEJELiBXZSBzaG91bGQgcmVhbGx5IGluY2x1ZGUgYSBwcm9wZXIgUmVsYXlTdGF0ZSBoZXJlXG5cdFx0bGV0IHJlbGF5U3RhdGU7XG5cdFx0aWYgKG9wZXJhdGlvbiA9PT0gJ2xvZ291dCcpIHtcblx0XHRcdC8vIGluIGNhc2Ugb2YgbG9nb3V0IHdlIHdhbnQgdG8gYmUgcmVkaXJlY3RlZCBiYWNrIHRvIHRoZSBNZXRlb3IgYXBwLlxuXHRcdFx0cmVsYXlTdGF0ZSA9IE1ldGVvci5hYnNvbHV0ZVVybCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZWxheVN0YXRlID0gc2VsZi5vcHRpb25zLnByb3ZpZGVyO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNhbWxSZXF1ZXN0ID0ge1xuXHRcdFx0U0FNTFJlcXVlc3Q6IGJhc2U2NCxcblx0XHRcdFJlbGF5U3RhdGU6IHJlbGF5U3RhdGVcblx0XHR9O1xuXG5cdFx0aWYgKHNlbGYub3B0aW9ucy5wcml2YXRlQ2VydCkge1xuXHRcdFx0c2FtbFJlcXVlc3QuU2lnQWxnID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvMDkveG1sZHNpZyNyc2Etc2hhMSc7XG5cdFx0XHRzYW1sUmVxdWVzdC5TaWduYXR1cmUgPSBzZWxmLnNpZ25SZXF1ZXN0KHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShzYW1sUmVxdWVzdCkpO1xuXHRcdH1cblxuXHRcdHRhcmdldCArPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoc2FtbFJlcXVlc3QpO1xuXG5cdFx0aWYgKE1ldGVvci5zZXR0aW5ncy5kZWJ1Zykge1xuXHRcdFx0Y29uc29sZS5sb2coYHJlcXVlc3RUb1VybDogJHsgdGFyZ2V0IH1gKTtcblx0XHR9XG5cdFx0aWYgKG9wZXJhdGlvbiA9PT0gJ2xvZ291dCcpIHtcblx0XHRcdC8vIGluIGNhc2Ugb2YgbG9nb3V0IHdlIHdhbnQgdG8gYmUgcmVkaXJlY3RlZCBiYWNrIHRvIHRoZSBNZXRlb3IgYXBwLlxuXHRcdFx0cmV0dXJuIGNhbGxiYWNrKG51bGwsIHRhcmdldCk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2FsbGJhY2sobnVsbCwgdGFyZ2V0KTtcblx0XHR9XG5cdH0pO1xufTtcblxuU0FNTC5wcm90b3R5cGUuZ2V0QXV0aG9yaXplVXJsID0gZnVuY3Rpb24ocmVxLCBjYWxsYmFjaykge1xuXHRjb25zdCByZXF1ZXN0ID0gdGhpcy5nZW5lcmF0ZUF1dGhvcml6ZVJlcXVlc3QocmVxKTtcblxuXHR0aGlzLnJlcXVlc3RUb1VybChyZXF1ZXN0LCAnYXV0aG9yaXplJywgY2FsbGJhY2spO1xufTtcblxuU0FNTC5wcm90b3R5cGUuZ2V0TG9nb3V0VXJsID0gZnVuY3Rpb24ocmVxLCBjYWxsYmFjaykge1xuXHRjb25zdCByZXF1ZXN0ID0gdGhpcy5nZW5lcmF0ZUxvZ291dFJlcXVlc3QocmVxKTtcblxuXHR0aGlzLnJlcXVlc3RUb1VybChyZXF1ZXN0LCAnbG9nb3V0JywgY2FsbGJhY2spO1xufTtcblxuU0FNTC5wcm90b3R5cGUuY2VydFRvUEVNID0gZnVuY3Rpb24oY2VydCkge1xuXHRjZXJ0ID0gY2VydC5tYXRjaCgvLnsxLDY0fS9nKS5qb2luKCdcXG4nKTtcblx0Y2VydCA9IGAtLS0tLUJFR0lOIENFUlRJRklDQVRFLS0tLS1cXG4keyBjZXJ0IH1gO1xuXHRjZXJ0ID0gYCR7IGNlcnQgfVxcbi0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS1cXG5gO1xuXHRyZXR1cm4gY2VydDtcbn07XG5cbi8vIGZ1bmN0aW9uZmluZENoaWxkcyhub2RlLCBsb2NhbE5hbWUsIG5hbWVzcGFjZSkge1xuLy8gXHR2YXIgcmVzID0gW107XG4vLyBcdGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4vLyBcdFx0dmFyIGNoaWxkID0gbm9kZS5jaGlsZE5vZGVzW2ldO1xuLy8gXHRcdGlmIChjaGlsZC5sb2NhbE5hbWUgPT09IGxvY2FsTmFtZSAmJiAoY2hpbGQubmFtZXNwYWNlVVJJID09PSBuYW1lc3BhY2UgfHwgIW5hbWVzcGFjZSkpIHtcbi8vIFx0XHRcdHJlcy5wdXNoKGNoaWxkKTtcbi8vIFx0XHR9XG4vLyBcdH1cbi8vIFx0cmV0dXJuIHJlcztcbi8vIH1cblxuU0FNTC5wcm90b3R5cGUudmFsaWRhdGVTaWduYXR1cmUgPSBmdW5jdGlvbih4bWwsIGNlcnQpIHtcblx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cblx0Y29uc3QgZG9jID0gbmV3IHhtbGRvbS5ET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoeG1sKTtcblx0Y29uc3Qgc2lnbmF0dXJlID0geG1sQ3J5cHRvLnhwYXRoKGRvYywgJy8vKltsb2NhbC1uYW1lKC4pPVxcJ1NpZ25hdHVyZVxcJyBhbmQgbmFtZXNwYWNlLXVyaSguKT1cXCdodHRwOi8vd3d3LnczLm9yZy8yMDAwLzA5L3htbGRzaWcjXFwnXScpWzBdO1xuXG5cdGNvbnN0IHNpZyA9IG5ldyB4bWxDcnlwdG8uU2lnbmVkWG1sKCk7XG5cblx0c2lnLmtleUluZm9Qcm92aWRlciA9IHtcblx0XHRnZXRLZXlJbmZvKC8qa2V5Ki8pIHtcblx0XHRcdHJldHVybiAnPFg1MDlEYXRhPjwvWDUwOURhdGE+Jztcblx0XHR9LFxuXHRcdGdldEtleSgvKmtleUluZm8qLykge1xuXHRcdFx0cmV0dXJuIHNlbGYuY2VydFRvUEVNKGNlcnQpO1xuXHRcdH1cblx0fTtcblxuXHRzaWcubG9hZFNpZ25hdHVyZShzaWduYXR1cmUpO1xuXG5cdHJldHVybiBzaWcuY2hlY2tTaWduYXR1cmUoeG1sKTtcbn07XG5cblNBTUwucHJvdG90eXBlLmdldEVsZW1lbnQgPSBmdW5jdGlvbihwYXJlbnRFbGVtZW50LCBlbGVtZW50TmFtZSkge1xuXHRpZiAocGFyZW50RWxlbWVudFtgc2FtbDokeyBlbGVtZW50TmFtZSB9YF0pIHtcblx0XHRyZXR1cm4gcGFyZW50RWxlbWVudFtgc2FtbDokeyBlbGVtZW50TmFtZSB9YF07XG5cdH0gZWxzZSBpZiAocGFyZW50RWxlbWVudFtgc2FtbHA6JHsgZWxlbWVudE5hbWUgfWBdKSB7XG5cdFx0cmV0dXJuIHBhcmVudEVsZW1lbnRbYHNhbWxwOiR7IGVsZW1lbnROYW1lIH1gXTtcblx0fSBlbHNlIGlmIChwYXJlbnRFbGVtZW50W2BzYW1sMnA6JHsgZWxlbWVudE5hbWUgfWBdKSB7XG5cdFx0cmV0dXJuIHBhcmVudEVsZW1lbnRbYHNhbWwycDokeyBlbGVtZW50TmFtZSB9YF07XG5cdH0gZWxzZSBpZiAocGFyZW50RWxlbWVudFtgc2FtbDI6JHsgZWxlbWVudE5hbWUgfWBdKSB7XG5cdFx0cmV0dXJuIHBhcmVudEVsZW1lbnRbYHNhbWwyOiR7IGVsZW1lbnROYW1lIH1gXTtcblx0fSBlbHNlIGlmIChwYXJlbnRFbGVtZW50W2BuczA6JHsgZWxlbWVudE5hbWUgfWBdKSB7XG5cdFx0cmV0dXJuIHBhcmVudEVsZW1lbnRbYG5zMDokeyBlbGVtZW50TmFtZSB9YF07XG5cdH0gZWxzZSBpZiAocGFyZW50RWxlbWVudFtgbnMxOiR7IGVsZW1lbnROYW1lIH1gXSkge1xuXHRcdHJldHVybiBwYXJlbnRFbGVtZW50W2BuczE6JHsgZWxlbWVudE5hbWUgfWBdO1xuXHR9XG5cdHJldHVybiBwYXJlbnRFbGVtZW50W2VsZW1lbnROYW1lXTtcbn07XG5cblNBTUwucHJvdG90eXBlLnZhbGlkYXRlTG9nb3V0UmVzcG9uc2UgPSBmdW5jdGlvbihzYW1sUmVzcG9uc2UsIGNhbGxiYWNrKSB7XG5cdGNvbnN0IHNlbGYgPSB0aGlzO1xuXG5cdGNvbnN0IGNvbXByZXNzZWRTQU1MUmVzcG9uc2UgPSBuZXcgQnVmZmVyKHNhbWxSZXNwb25zZSwgJ2Jhc2U2NCcpO1xuXHR6bGliLmluZmxhdGVSYXcoY29tcHJlc3NlZFNBTUxSZXNwb25zZSwgZnVuY3Rpb24oZXJyLCBkZWNvZGVkKSB7XG5cblx0XHRpZiAoZXJyKSB7XG5cdFx0XHRpZiAoTWV0ZW9yLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGVycik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHBhcnNlciA9IG5ldyB4bWwyanMuUGFyc2VyKHtcblx0XHRcdFx0ZXhwbGljaXRSb290OiB0cnVlXG5cdFx0XHR9KTtcblx0XHRcdHBhcnNlci5wYXJzZVN0cmluZyhkZWNvZGVkLCBmdW5jdGlvbihlcnIsIGRvYykge1xuXHRcdFx0XHRjb25zdCByZXNwb25zZSA9IHNlbGYuZ2V0RWxlbWVudChkb2MsICdMb2dvdXRSZXNwb25zZScpO1xuXG5cdFx0XHRcdGlmIChyZXNwb25zZSkge1xuXHRcdFx0XHRcdC8vIFRCRC4gQ2hlY2sgaWYgdGhpcyBtc2cgY29ycmVzcG9uZHMgdG8gb25lIHdlIHNlbnRcblx0XHRcdFx0XHRjb25zdCBpblJlc3BvbnNlVG8gPSByZXNwb25zZS4kLkluUmVzcG9uc2VUbztcblx0XHRcdFx0XHRpZiAoTWV0ZW9yLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgSW4gUmVzcG9uc2UgdG86ICR7IGluUmVzcG9uc2VUbyB9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHN0YXR1cyA9IHNlbGYuZ2V0RWxlbWVudChyZXNwb25zZSwgJ1N0YXR1cycpO1xuXHRcdFx0XHRcdGNvbnN0IHN0YXR1c0NvZGUgPSBzZWxmLmdldEVsZW1lbnQoc3RhdHVzWzBdLCAnU3RhdHVzQ29kZScpWzBdLiQuVmFsdWU7XG5cdFx0XHRcdFx0aWYgKE1ldGVvci5zZXR0aW5ncy5kZWJ1Zykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFN0YXR1c0NvZGU6ICR7IEpTT04uc3RyaW5naWZ5KHN0YXR1c0NvZGUpIH1gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHN0YXR1c0NvZGUgPT09ICd1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6c3RhdHVzOlN1Y2Nlc3MnKSB7XG5cdFx0XHRcdFx0XHQvLyBJbiBjYXNlIG9mIGEgc3VjY2Vzc2Z1bCBsb2dvdXQgYXQgSURQIHdlIHJldHVybiBpblJlc3BvbnNlVG8gdmFsdWUuXG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIHRoZSBvbmx5IHdheSBob3cgd2UgY2FuIGlkZW50aWZ5IHRoZSBNZXRlb3IgdXNlciAoYXMgd2UgZG9uJ3QgdXNlIFNlc3Npb24gQ29va2llcylcblx0XHRcdFx0XHRcdGNhbGxiYWNrKG51bGwsIGluUmVzcG9uc2VUbyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrKCdFcnJvci4gTG9nb3V0IG5vdCBjb25maXJtZWQgYnkgSURQJywgbnVsbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNhbGxiYWNrKCdObyBSZXNwb25zZSBGb3VuZCcsIG51bGwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0fSk7XG59O1xuXG5TQU1MLnByb3RvdHlwZS52YWxpZGF0ZVJlc3BvbnNlID0gZnVuY3Rpb24oc2FtbFJlc3BvbnNlLCByZWxheVN0YXRlLCBjYWxsYmFjaykge1xuXHRjb25zdCBzZWxmID0gdGhpcztcblx0Y29uc3QgeG1sID0gbmV3IEJ1ZmZlcihzYW1sUmVzcG9uc2UsICdiYXNlNjQnKS50b1N0cmluZygndXRmOCcpO1xuXHQvLyBXZSBjdXJyZW50bHkgdXNlIFJlbGF5U3RhdGUgdG8gc2F2ZSBTQU1MIHByb3ZpZGVyXG5cdGlmIChNZXRlb3Iuc2V0dGluZ3MuZGVidWcpIHtcblx0XHRjb25zb2xlLmxvZyhgVmFsaWRhdGluZyByZXNwb25zZSB3aXRoIHJlbGF5IHN0YXRlOiAkeyB4bWwgfWApO1xuXHR9XG5cdGNvbnN0IHBhcnNlciA9IG5ldyB4bWwyanMuUGFyc2VyKHtcblx0XHRleHBsaWNpdFJvb3Q6IHRydWUsXG5cdFx0eG1sbnM6dHJ1ZVxuXHR9KTtcblxuXHRwYXJzZXIucGFyc2VTdHJpbmcoeG1sLCBmdW5jdGlvbihlcnIsIGRvYykge1xuXHRcdC8vIFZlcmlmeSBzaWduYXR1cmVcblx0XHRpZiAoTWV0ZW9yLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnVmVyaWZ5IHNpZ25hdHVyZScpO1xuXHRcdH1cblx0XHRpZiAoc2VsZi5vcHRpb25zLmNlcnQgJiYgIXNlbGYudmFsaWRhdGVTaWduYXR1cmUoeG1sLCBzZWxmLm9wdGlvbnMuY2VydCkpIHtcblx0XHRcdGlmIChNZXRlb3Iuc2V0dGluZ3MuZGVidWcpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1NpZ25hdHVyZSBXUk9ORycpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignSW52YWxpZCBzaWduYXR1cmUnKSwgbnVsbCwgZmFsc2UpO1xuXHRcdH1cblx0XHRpZiAoTWV0ZW9yLnNldHRpbmdzLmRlYnVnKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnU2lnbmF0dXJlIE9LJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gc2VsZi5nZXRFbGVtZW50KGRvYywgJ1Jlc3BvbnNlJyk7XG5cdFx0aWYgKE1ldGVvci5zZXR0aW5ncy5kZWJ1Zykge1xuXHRcdFx0Y29uc29sZS5sb2coJ0dvdCByZXNwb25zZScpO1xuXHRcdH1cblx0XHRpZiAocmVzcG9uc2UpIHtcblx0XHRcdGNvbnN0IGFzc2VydGlvbiA9IHNlbGYuZ2V0RWxlbWVudChyZXNwb25zZSwgJ0Fzc2VydGlvbicpO1xuXHRcdFx0aWYgKCFhc3NlcnRpb24pIHtcblx0XHRcdFx0cmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcignTWlzc2luZyBTQU1MIGFzc2VydGlvbicpLCBudWxsLCBmYWxzZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHByb2ZpbGUgPSB7fTtcblxuXHRcdFx0aWYgKHJlc3BvbnNlLiQgJiYgcmVzcG9uc2UuJC5JblJlc3BvbnNlVG8pIHtcblx0XHRcdFx0cHJvZmlsZS5pblJlc3BvbnNlVG9JZCA9IHJlc3BvbnNlLiQuSW5SZXNwb25zZVRvO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpc3N1ZXIgPSBzZWxmLmdldEVsZW1lbnQoYXNzZXJ0aW9uWzBdLCAnSXNzdWVyJyk7XG5cdFx0XHRpZiAoaXNzdWVyKSB7XG5cdFx0XHRcdHByb2ZpbGUuaXNzdWVyID0gaXNzdWVyWzBdLl87XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN1YmplY3QgPSBzZWxmLmdldEVsZW1lbnQoYXNzZXJ0aW9uWzBdLCAnU3ViamVjdCcpO1xuXG5cdFx0XHRpZiAoc3ViamVjdCkge1xuXHRcdFx0XHRjb25zdCBuYW1lSUQgPSBzZWxmLmdldEVsZW1lbnQoc3ViamVjdFswXSwgJ05hbWVJRCcpO1xuXHRcdFx0XHRpZiAobmFtZUlEKSB7XG5cdFx0XHRcdFx0cHJvZmlsZS5uYW1lSUQgPSBuYW1lSURbMF0uXztcblxuXHRcdFx0XHRcdGlmIChuYW1lSURbMF0uJC5Gb3JtYXQpIHtcblx0XHRcdFx0XHRcdHByb2ZpbGUubmFtZUlERm9ybWF0ID0gbmFtZUlEWzBdLiQuRm9ybWF0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhdXRoblN0YXRlbWVudCA9IHNlbGYuZ2V0RWxlbWVudChhc3NlcnRpb25bMF0sICdBdXRoblN0YXRlbWVudCcpO1xuXG5cdFx0XHRpZiAoYXV0aG5TdGF0ZW1lbnQpIHtcblx0XHRcdFx0aWYgKGF1dGhuU3RhdGVtZW50WzBdLiQuU2Vzc2lvbkluZGV4KSB7XG5cblx0XHRcdFx0XHRwcm9maWxlLnNlc3Npb25JbmRleCA9IGF1dGhuU3RhdGVtZW50WzBdLiQuU2Vzc2lvbkluZGV4O1xuXHRcdFx0XHRcdGlmIChNZXRlb3Iuc2V0dGluZ3MuZGVidWcpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBTZXNzaW9uIEluZGV4OiAkeyBwcm9maWxlLnNlc3Npb25JbmRleCB9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKE1ldGVvci5zZXR0aW5ncy5kZWJ1Zykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdObyBTZXNzaW9uIEluZGV4IEZvdW5kJyk7XG5cdFx0XHRcdH1cblxuXG5cdFx0XHR9IGVsc2UgaWYgKE1ldGVvci5zZXR0aW5ncy5kZWJ1Zykge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnTm8gQXV0aE4gU3RhdGVtZW50IGZvdW5kJyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGF0dHJpYnV0ZVN0YXRlbWVudCA9IHNlbGYuZ2V0RWxlbWVudChhc3NlcnRpb25bMF0sICdBdHRyaWJ1dGVTdGF0ZW1lbnQnKTtcblx0XHRcdGlmIChhdHRyaWJ1dGVTdGF0ZW1lbnQpIHtcblx0XHRcdFx0Y29uc3QgYXR0cmlidXRlcyA9IHNlbGYuZ2V0RWxlbWVudChhdHRyaWJ1dGVTdGF0ZW1lbnRbMF0sICdBdHRyaWJ1dGUnKTtcblxuXHRcdFx0XHRpZiAoYXR0cmlidXRlcykge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gc2VsZi5nZXRFbGVtZW50KGF0dHJpYnV0ZSwgJ0F0dHJpYnV0ZVZhbHVlJyk7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIHZhbHVlWzBdID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHRwcm9maWxlW2F0dHJpYnV0ZS4kLk5hbWVdID0gdmFsdWVbMF07XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRwcm9maWxlW2F0dHJpYnV0ZS4kLk5hbWVdID0gdmFsdWVbMF0uXztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghcHJvZmlsZS5tYWlsICYmIHByb2ZpbGVbJ3VybjpvaWQ6MC45LjIzNDIuMTkyMDAzMDAuMTAwLjEuMyddKSB7XG5cdFx0XHRcdFx0Ly8gU2VlIGh0dHA6Ly93d3cuaW5jb21tb25mZWRlcmF0aW9uLm9yZy9hdHRyaWJ1dGVzdW1tYXJ5Lmh0bWwgZm9yIGRlZmluaXRpb24gb2YgYXR0cmlidXRlIE9JRHNcblx0XHRcdFx0XHRwcm9maWxlLm1haWwgPSBwcm9maWxlWyd1cm46b2lkOjAuOS4yMzQyLjE5MjAwMzAwLjEwMC4xLjMnXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghcHJvZmlsZS5lbWFpbCAmJiBwcm9maWxlLm1haWwpIHtcblx0XHRcdFx0XHRwcm9maWxlLmVtYWlsID0gcHJvZmlsZS5tYWlsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghcHJvZmlsZS5lbWFpbCAmJiBwcm9maWxlLm5hbWVJRCAmJiBwcm9maWxlLm5hbWVJREZvcm1hdCAmJiBwcm9maWxlLm5hbWVJREZvcm1hdC5pbmRleE9mKCdlbWFpbEFkZHJlc3MnKSA+PSAwKSB7XG5cdFx0XHRcdHByb2ZpbGUuZW1haWwgPSBwcm9maWxlLm5hbWVJRDtcblx0XHRcdH1cblx0XHRcdGlmIChNZXRlb3Iuc2V0dGluZ3MuZGVidWcpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYE5hbWVJRDogJHsgSlNPTi5zdHJpbmdpZnkocHJvZmlsZSkgfWApO1xuXHRcdFx0fVxuXG5cdFx0XHRjYWxsYmFjayhudWxsLCBwcm9maWxlLCBmYWxzZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGxvZ291dFJlc3BvbnNlID0gc2VsZi5nZXRFbGVtZW50KGRvYywgJ0xvZ291dFJlc3BvbnNlJyk7XG5cblx0XHRcdGlmIChsb2dvdXRSZXNwb25zZSkge1xuXHRcdFx0XHRjYWxsYmFjayhudWxsLCBudWxsLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ1Vua25vd24gU0FNTCByZXNwb25zZSBtZXNzYWdlJyksIG51bGwsIGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdH1cblx0fSk7XG59O1xuXG5sZXQgZGVjcnlwdGlvbkNlcnQ7XG5TQU1MLnByb3RvdHlwZS5nZW5lcmF0ZVNlcnZpY2VQcm92aWRlck1ldGFkYXRhID0gZnVuY3Rpb24oY2FsbGJhY2tVcmwpIHtcblxuXHRpZiAoIWRlY3J5cHRpb25DZXJ0KSB7XG5cdFx0ZGVjcnlwdGlvbkNlcnQgPSB0aGlzLm9wdGlvbnMucHJpdmF0ZUNlcnQ7XG5cdH1cblxuXHRpZiAoIXRoaXMub3B0aW9ucy5jYWxsYmFja1VybCAmJiAhY2FsbGJhY2tVcmwpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXG5cdFx0XHQnVW5hYmxlIHRvIGdlbmVyYXRlIHNlcnZpY2UgcHJvdmlkZXIgbWV0YWRhdGEgd2hlbiBjYWxsYmFja1VybCBvcHRpb24gaXMgbm90IHNldCcpO1xuXHR9XG5cblx0Y29uc3QgbWV0YWRhdGEgPSB7XG5cdFx0J0VudGl0eURlc2NyaXB0b3InOiB7XG5cdFx0XHQnQHhtbG5zJzogJ3VybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDptZXRhZGF0YScsXG5cdFx0XHQnQHhtbG5zOmRzJzogJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvMDkveG1sZHNpZyMnLFxuXHRcdFx0J0BlbnRpdHlJRCc6IHRoaXMub3B0aW9ucy5pc3N1ZXIsXG5cdFx0XHQnU1BTU09EZXNjcmlwdG9yJzoge1xuXHRcdFx0XHQnQHByb3RvY29sU3VwcG9ydEVudW1lcmF0aW9uJzogJ3VybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDpwcm90b2NvbCcsXG5cdFx0XHRcdCdTaW5nbGVMb2dvdXRTZXJ2aWNlJzoge1xuXHRcdFx0XHRcdCdAQmluZGluZyc6ICd1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6YmluZGluZ3M6SFRUUC1SZWRpcmVjdCcsXG5cdFx0XHRcdFx0J0BMb2NhdGlvbic6IGAkeyBNZXRlb3IuYWJzb2x1dGVVcmwoKSB9X3NhbWwvbG9nb3V0LyR7IHRoaXMub3B0aW9ucy5wcm92aWRlciB9L2AsXG5cdFx0XHRcdFx0J0BSZXNwb25zZUxvY2F0aW9uJzogYCR7IE1ldGVvci5hYnNvbHV0ZVVybCgpIH1fc2FtbC9sb2dvdXQvJHsgdGhpcy5vcHRpb25zLnByb3ZpZGVyIH0vYFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnTmFtZUlERm9ybWF0JzogdGhpcy5vcHRpb25zLmlkZW50aWZpZXJGb3JtYXQsXG5cdFx0XHRcdCdBc3NlcnRpb25Db25zdW1lclNlcnZpY2UnOiB7XG5cdFx0XHRcdFx0J0BpbmRleCc6ICcxJyxcblx0XHRcdFx0XHQnQGlzRGVmYXVsdCc6ICd0cnVlJyxcblx0XHRcdFx0XHQnQEJpbmRpbmcnOiAndXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmJpbmRpbmdzOkhUVFAtUE9TVCcsXG5cdFx0XHRcdFx0J0BMb2NhdGlvbic6IGNhbGxiYWNrVXJsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0aWYgKHRoaXMub3B0aW9ucy5wcml2YXRlS2V5KSB7XG5cdFx0aWYgKCFkZWNyeXB0aW9uQ2VydCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFxuXHRcdFx0XHQnTWlzc2luZyBkZWNyeXB0aW9uQ2VydCB3aGlsZSBnZW5lcmF0aW5nIG1ldGFkYXRhIGZvciBkZWNyeXB0aW5nIHNlcnZpY2UgcHJvdmlkZXInKTtcblx0XHR9XG5cblx0XHRkZWNyeXB0aW9uQ2VydCA9IGRlY3J5cHRpb25DZXJ0LnJlcGxhY2UoLy0rQkVHSU4gQ0VSVElGSUNBVEUtK1xccj9cXG4/LywgJycpO1xuXHRcdGRlY3J5cHRpb25DZXJ0ID0gZGVjcnlwdGlvbkNlcnQucmVwbGFjZSgvLStFTkQgQ0VSVElGSUNBVEUtK1xccj9cXG4/LywgJycpO1xuXHRcdGRlY3J5cHRpb25DZXJ0ID0gZGVjcnlwdGlvbkNlcnQucmVwbGFjZSgvXFxyXFxuL2csICdcXG4nKTtcblxuXHRcdG1ldGFkYXRhWydFbnRpdHlEZXNjcmlwdG9yJ11bJ1NQU1NPRGVzY3JpcHRvciddWydLZXlEZXNjcmlwdG9yJ10gPSB7XG5cdFx0XHQnZHM6S2V5SW5mbyc6IHtcblx0XHRcdFx0J2RzOlg1MDlEYXRhJzoge1xuXHRcdFx0XHRcdCdkczpYNTA5Q2VydGlmaWNhdGUnOiB7XG5cdFx0XHRcdFx0XHQnI3RleHQnOiBkZWNyeXB0aW9uQ2VydFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCcjbGlzdCc6IFtcblx0XHRcdFx0Ly8gdGhpcyBzaG91bGQgYmUgdGhlIHNldCB0aGF0IHRoZSB4bWxlbmMgbGlicmFyeSBzdXBwb3J0c1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0J0VuY3J5cHRpb25NZXRob2QnOiB7XG5cdFx0XHRcdFx0XHQnQEFsZ29yaXRobSc6ICdodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGVuYyNhZXMyNTYtY2JjJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdCdFbmNyeXB0aW9uTWV0aG9kJzoge1xuXHRcdFx0XHRcdFx0J0BBbGdvcml0aG0nOiAnaHR0cDovL3d3dy53My5vcmcvMjAwMS8wNC94bWxlbmMjYWVzMTI4LWNiYydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQnRW5jcnlwdGlvbk1ldGhvZCc6IHtcblx0XHRcdFx0XHRcdCdAQWxnb3JpdGhtJzogJ2h0dHA6Ly93d3cudzMub3JnLzIwMDEvMDQveG1sZW5jI3RyaXBsZWRlcy1jYmMnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0fVxuXG5cdHJldHVybiB4bWxidWlsZGVyLmNyZWF0ZShtZXRhZGF0YSkuZW5kKHtcblx0XHRwcmV0dHk6IHRydWUsXG5cdFx0aW5kZW50OiAnICAnLFxuXHRcdG5ld2xpbmU6ICdcXG4nXG5cdH0pO1xufTtcbiIsImNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoJ3N0ZWZmbzptZXRlb3ItYWNjb3VudHMtc2FtbCcsIHtcblx0bWV0aG9kczoge1xuXHRcdHVwZGF0ZWQ6IHtcblx0XHRcdHR5cGU6ICdpbmZvJ1xuXHRcdH1cblx0fVxufSk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuYWRkR3JvdXAoJ1NBTUwnKTtcblxuTWV0ZW9yLm1ldGhvZHMoe1xuXHRhZGRTYW1sU2VydmljZShuYW1lKSB7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoYFNBTUxfQ3VzdG9tXyR7IG5hbWUgfWAsIGZhbHNlLCB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRncm91cDogJ1NBTUwnLFxuXHRcdFx0c2VjdGlvbjogbmFtZSxcblx0XHRcdGkxOG5MYWJlbDogJ0FjY291bnRzX09BdXRoX0N1c3RvbV9FbmFibGUnXG5cdFx0fSk7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoYFNBTUxfQ3VzdG9tXyR7IG5hbWUgfV9wcm92aWRlcmAsICdwcm92aWRlci1uYW1lJywge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRncm91cDogJ1NBTUwnLFxuXHRcdFx0c2VjdGlvbjogbmFtZSxcblx0XHRcdGkxOG5MYWJlbDogJ1NBTUxfQ3VzdG9tX1Byb3ZpZGVyJ1xuXHRcdH0pO1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKGBTQU1MX0N1c3RvbV8keyBuYW1lIH1fZW50cnlfcG9pbnRgLCAnaHR0cHM6Ly9leGFtcGxlLmNvbS9zaW1wbGVzYW1sL3NhbWwyL2lkcC9TU09TZXJ2aWNlLnBocCcsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Z3JvdXA6ICdTQU1MJyxcblx0XHRcdHNlY3Rpb246IG5hbWUsXG5cdFx0XHRpMThuTGFiZWw6ICdTQU1MX0N1c3RvbV9FbnRyeV9wb2ludCdcblx0XHR9KTtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZChgU0FNTF9DdXN0b21fJHsgbmFtZSB9X2lkcF9zbG9fcmVkaXJlY3RfdXJsYCwgJ2h0dHBzOi8vZXhhbXBsZS5jb20vc2ltcGxlc2FtbC9zYW1sMi9pZHAvU2luZ2xlTG9nb3V0U2VydmljZS5waHAnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGdyb3VwOiAnU0FNTCcsXG5cdFx0XHRzZWN0aW9uOiBuYW1lLFxuXHRcdFx0aTE4bkxhYmVsOiAnU0FNTF9DdXN0b21fSURQX1NMT19SZWRpcmVjdF9VUkwnXG5cdFx0fSk7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoYFNBTUxfQ3VzdG9tXyR7IG5hbWUgfV9pc3N1ZXJgLCAnaHR0cHM6Ly95b3VyLXJvY2tldC1jaGF0L19zYW1sL21ldGFkYXRhL3Byb3ZpZGVyLW5hbWUnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGdyb3VwOiAnU0FNTCcsXG5cdFx0XHRzZWN0aW9uOiBuYW1lLFxuXHRcdFx0aTE4bkxhYmVsOiAnU0FNTF9DdXN0b21fSXNzdWVyJ1xuXHRcdH0pO1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKGBTQU1MX0N1c3RvbV8keyBuYW1lIH1fY2VydGAsICcnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGdyb3VwOiAnU0FNTCcsXG5cdFx0XHRzZWN0aW9uOiBuYW1lLFxuXHRcdFx0aTE4bkxhYmVsOiAnU0FNTF9DdXN0b21fQ2VydCcsXG5cdFx0XHRtdWx0aWxpbmU6IHRydWVcblx0XHR9KTtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZChgU0FNTF9DdXN0b21fJHsgbmFtZSB9X3B1YmxpY19jZXJ0YCwgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Z3JvdXA6ICdTQU1MJyxcblx0XHRcdHNlY3Rpb246IG5hbWUsXG5cdFx0XHRtdWx0aWxpbmU6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdTQU1MX0N1c3RvbV9QdWJsaWNfQ2VydCdcblx0XHR9KTtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZChgU0FNTF9DdXN0b21fJHsgbmFtZSB9X3ByaXZhdGVfa2V5YCwgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Z3JvdXA6ICdTQU1MJyxcblx0XHRcdHNlY3Rpb246IG5hbWUsXG5cdFx0XHRtdWx0aWxpbmU6IHRydWUsXG5cdFx0XHRpMThuTGFiZWw6ICdTQU1MX0N1c3RvbV9Qcml2YXRlX0tleSdcblx0XHR9KTtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZChgU0FNTF9DdXN0b21fJHsgbmFtZSB9X2J1dHRvbl9sYWJlbF90ZXh0YCwgJycsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Z3JvdXA6ICdTQU1MJyxcblx0XHRcdHNlY3Rpb246IG5hbWUsXG5cdFx0XHRpMThuTGFiZWw6ICdBY2NvdW50c19PQXV0aF9DdXN0b21fQnV0dG9uX0xhYmVsX1RleHQnXG5cdFx0fSk7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoYFNBTUxfQ3VzdG9tXyR7IG5hbWUgfV9idXR0b25fbGFiZWxfY29sb3JgLCAnI0ZGRkZGRicsIHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Z3JvdXA6ICdTQU1MJyxcblx0XHRcdHNlY3Rpb246IG5hbWUsXG5cdFx0XHRpMThuTGFiZWw6ICdBY2NvdW50c19PQXV0aF9DdXN0b21fQnV0dG9uX0xhYmVsX0NvbG9yJ1xuXHRcdH0pO1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKGBTQU1MX0N1c3RvbV8keyBuYW1lIH1fYnV0dG9uX2NvbG9yYCwgJyMxMzY3OUEnLCB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGdyb3VwOiAnU0FNTCcsXG5cdFx0XHRzZWN0aW9uOiBuYW1lLFxuXHRcdFx0aTE4bkxhYmVsOiAnQWNjb3VudHNfT0F1dGhfQ3VzdG9tX0J1dHRvbl9Db2xvcidcblx0XHR9KTtcblx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZChgU0FNTF9DdXN0b21fJHsgbmFtZSB9X2dlbmVyYXRlX3VzZXJuYW1lYCwgZmFsc2UsIHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGdyb3VwOiAnU0FNTCcsXG5cdFx0XHRzZWN0aW9uOiBuYW1lLFxuXHRcdFx0aTE4bkxhYmVsOiAnU0FNTF9DdXN0b21fR2VuZXJhdGVfVXNlcm5hbWUnXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5jb25zdCBnZXRTYW1sQ29uZmlncyA9IGZ1bmN0aW9uKHNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRidXR0b25MYWJlbFRleHQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X2J1dHRvbl9sYWJlbF90ZXh0YCksXG5cdFx0YnV0dG9uTGFiZWxDb2xvcjogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoYCR7IHNlcnZpY2Uua2V5IH1fYnV0dG9uX2xhYmVsX2NvbG9yYCksXG5cdFx0YnV0dG9uQ29sb3I6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X2J1dHRvbl9jb2xvcmApLFxuXHRcdGNsaWVudENvbmZpZzoge1xuXHRcdFx0cHJvdmlkZXI6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X3Byb3ZpZGVyYClcblx0XHR9LFxuXHRcdGVudHJ5UG9pbnQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X2VudHJ5X3BvaW50YCksXG5cdFx0aWRwU0xPUmVkaXJlY3RVUkw6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X2lkcF9zbG9fcmVkaXJlY3RfdXJsYCksXG5cdFx0Z2VuZXJhdGVVc2VybmFtZTogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoYCR7IHNlcnZpY2Uua2V5IH1fZ2VuZXJhdGVfdXNlcm5hbWVgKSxcblx0XHRpc3N1ZXI6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X2lzc3VlcmApLFxuXHRcdHNlY3JldDoge1xuXHRcdFx0cHJpdmF0ZUtleTogUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoYCR7IHNlcnZpY2Uua2V5IH1fcHJpdmF0ZV9rZXlgKSxcblx0XHRcdHB1YmxpY0NlcnQ6IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KGAkeyBzZXJ2aWNlLmtleSB9X3B1YmxpY19jZXJ0YCksXG5cdFx0XHRjZXJ0OiBSb2NrZXRDaGF0LnNldHRpbmdzLmdldChgJHsgc2VydmljZS5rZXkgfV9jZXJ0YClcblx0XHR9XG5cdH07XG59O1xuXG5jb25zdCBkZWJvdW5jZSA9IChmbiwgZGVsYXkpID0+IHtcblx0bGV0IHRpbWVyID0gbnVsbDtcblx0cmV0dXJuICgpID0+IHtcblx0XHRpZiAodGltZXIgIT0gbnVsbCkge1xuXHRcdFx0TWV0ZW9yLmNsZWFyVGltZW91dCh0aW1lcik7XG5cdFx0fVxuXHRcdHJldHVybiB0aW1lciA9IE1ldGVvci5zZXRUaW1lb3V0KGZuLCBkZWxheSk7XG5cdH07XG59O1xuY29uc3Qgc2VydmljZU5hbWUgPSAnc2FtbCc7XG5cbmNvbnN0IGNvbmZpZ3VyZVNhbWxTZXJ2aWNlID0gZnVuY3Rpb24oc2FtbENvbmZpZ3MpIHtcblx0bGV0IHByaXZhdGVDZXJ0ID0gZmFsc2U7XG5cdGxldCBwcml2YXRlS2V5ID0gZmFsc2U7XG5cdGlmIChzYW1sQ29uZmlncy5zZWNyZXQucHJpdmF0ZUtleSAmJiBzYW1sQ29uZmlncy5zZWNyZXQucHVibGljQ2VydCkge1xuXHRcdHByaXZhdGVLZXkgPSBzYW1sQ29uZmlncy5zZWNyZXQucHJpdmF0ZUtleTtcblx0XHRwcml2YXRlQ2VydCA9IHNhbWxDb25maWdzLnNlY3JldC5wdWJsaWNDZXJ0O1xuXHR9IGVsc2UgaWYgKHNhbWxDb25maWdzLnNlY3JldC5wcml2YXRlS2V5IHx8IHNhbWxDb25maWdzLnNlY3JldC5wdWJsaWNDZXJ0KSB7XG5cdFx0bG9nZ2VyLmVycm9yKCdZb3UgbXVzdCBzcGVjaWZ5IGJvdGggY2VydCBhbmQga2V5IGZpbGVzLicpO1xuXHR9XG5cdC8vIFRPRE86IHRoZSBmdW5jdGlvbiBjb25maWd1cmVTYW1sU2VydmljZSBpcyBjYWxsZWQgbWFueSB0aW1lcyBhbmQgQWNjb3VudHMuc2FtbC5zZXR0aW5ncy5nZW5lcmF0ZVVzZXJuYW1lIGtlZXBzIGp1c3QgdGhlIGxhc3QgdmFsdWVcblx0QWNjb3VudHMuc2FtbC5zZXR0aW5ncy5nZW5lcmF0ZVVzZXJuYW1lID0gc2FtbENvbmZpZ3MuZ2VuZXJhdGVVc2VybmFtZTtcblx0cmV0dXJuIHtcblx0XHRwcm92aWRlcjogc2FtbENvbmZpZ3MuY2xpZW50Q29uZmlnLnByb3ZpZGVyLFxuXHRcdGVudHJ5UG9pbnQ6IHNhbWxDb25maWdzLmVudHJ5UG9pbnQsXG5cdFx0aWRwU0xPUmVkaXJlY3RVUkw6IHNhbWxDb25maWdzLmlkcFNMT1JlZGlyZWN0VVJMLFxuXHRcdGlzc3Vlcjogc2FtbENvbmZpZ3MuaXNzdWVyLFxuXHRcdGNlcnQ6IHNhbWxDb25maWdzLnNlY3JldC5jZXJ0LFxuXHRcdHByaXZhdGVDZXJ0LFxuXHRcdHByaXZhdGVLZXlcblx0fTtcbn07XG5cbmNvbnN0IHVwZGF0ZVNlcnZpY2VzID0gZGVib3VuY2UoKCkgPT4ge1xuXHRjb25zdCBzZXJ2aWNlcyA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KC9eKFNBTUxfQ3VzdG9tXylbYS16XSskL2kpO1xuXHRBY2NvdW50cy5zYW1sLnNldHRpbmdzLnByb3ZpZGVycyA9IHNlcnZpY2VzLm1hcCgoc2VydmljZSkgPT4ge1xuXHRcdGlmIChzZXJ2aWNlLnZhbHVlID09PSB0cnVlKSB7XG5cdFx0XHRjb25zdCBzYW1sQ29uZmlncyA9IGdldFNhbWxDb25maWdzKHNlcnZpY2UpO1xuXHRcdFx0bG9nZ2VyLnVwZGF0ZWQoc2VydmljZS5rZXkpO1xuXHRcdFx0U2VydmljZUNvbmZpZ3VyYXRpb24uY29uZmlndXJhdGlvbnMudXBzZXJ0KHtcblx0XHRcdFx0c2VydmljZTogc2VydmljZU5hbWUudG9Mb3dlckNhc2UoKVxuXHRcdFx0fSwge1xuXHRcdFx0XHQkc2V0OiBzYW1sQ29uZmlnc1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gY29uZmlndXJlU2FtbFNlcnZpY2Uoc2FtbENvbmZpZ3MpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRTZXJ2aWNlQ29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9ucy5yZW1vdmUoe1xuXHRcdFx0XHRzZXJ2aWNlOiBzZXJ2aWNlTmFtZS50b0xvd2VyQ2FzZSgpXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pLmZpbHRlcihlID0+IGUpO1xufSwgMjAwMCk7XG5cblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoL15TQU1MXy4rLywgdXBkYXRlU2VydmljZXMpO1xuXG5NZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XG5cdHJldHVybiBNZXRlb3IuY2FsbCgnYWRkU2FtbFNlcnZpY2UnLCAnRGVmYXVsdCcpO1xufSk7XG5cbmV4cG9ydCB7XG5cdHVwZGF0ZVNlcnZpY2VzLFxuXHRjb25maWd1cmVTYW1sU2VydmljZSxcblx0Z2V0U2FtbENvbmZpZ3MsXG5cdGRlYm91bmNlLFxuXHRsb2dnZXJcbn07XG4iXX0=
