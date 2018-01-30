(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var __coffeescriptShare, OAuth2Server;

(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_oauth2-server/model.coffee                                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var AccessTokens, AuthCodes, Clients, Model, RefreshTokens, debug;
AccessTokens = void 0;
RefreshTokens = void 0;
Clients = void 0;
AuthCodes = void 0;
debug = void 0;

this.Model = Model = function () {
  function Model(config) {
    if (config == null) {
      config = {};
    }

    if (config.accessTokensCollectionName == null) {
      config.accessTokensCollectionName = 'oauth_access_tokens';
    }

    if (config.refreshTokensCollectionName == null) {
      config.refreshTokensCollectionName = 'oauth_refresh_tokens';
    }

    if (config.clientsCollectionName == null) {
      config.clientsCollectionName = 'oauth_clients';
    }

    if (config.authCodesCollectionName == null) {
      config.authCodesCollectionName = 'oauth_auth_codes';
    }

    this.debug = debug = config.debug;
    this.AccessTokens = AccessTokens = config.accessTokensCollection || new Meteor.Collection(config.accessTokensCollectionName);
    this.RefreshTokens = RefreshTokens = config.refreshTokensCollection || new Meteor.Collection(config.refreshTokensCollectionName);
    this.Clients = Clients = config.clientsCollection || new Meteor.Collection(config.clientsCollectionName);
    this.AuthCodes = AuthCodes = config.authCodesCollection || new Meteor.Collection(config.authCodesCollectionName);
  }

  Model.prototype.getAccessToken = Meteor.bindEnvironment(function (bearerToken, callback) {
    var e, token;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in getAccessToken (bearerToken:', bearerToken, ')');
    }

    try {
      token = AccessTokens.findOne({
        accessToken: bearerToken
      });
      return callback(null, token);
    } catch (error) {
      e = error;
      return callback(e);
    }
  });
  Model.prototype.getClient = Meteor.bindEnvironment(function (clientId, clientSecret, callback) {
    var client, e;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in getClient (clientId:', clientId, ', clientSecret:', clientSecret, ')');
    }

    try {
      if (clientSecret == null) {
        client = Clients.findOne({
          active: true,
          clientId: clientId
        });
      } else {
        client = Clients.findOne({
          active: true,
          clientId: clientId,
          clientSecret: clientSecret
        });
      }

      return callback(null, client);
    } catch (error) {
      e = error;
      return callback(e);
    }
  });

  Model.prototype.grantTypeAllowed = function (clientId, grantType, callback) {
    if (debug === true) {
      console.log('[OAuth2Server]', 'in grantTypeAllowed (clientId:', clientId, ', grantType:', grantType + ')');
    }

    return callback(false, grantType === 'authorization_code' || grantType === 'refresh_token');
  };

  Model.prototype.saveAccessToken = Meteor.bindEnvironment(function (token, clientId, expires, user, callback) {
    var e, tokenId;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in saveAccessToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
    }

    try {
      tokenId = AccessTokens.insert({
        accessToken: token,
        clientId: clientId,
        userId: user.id,
        expires: expires
      });
      return callback(null, tokenId);
    } catch (error) {
      e = error;
      return callback(e);
    }
  });
  Model.prototype.getAuthCode = Meteor.bindEnvironment(function (authCode, callback) {
    var code, e;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in getAuthCode (authCode: ' + authCode + ')');
    }

    try {
      code = AuthCodes.findOne({
        authCode: authCode
      });
      return callback(null, code);
    } catch (error) {
      e = error;
      return callback(e);
    }
  });
  Model.prototype.saveAuthCode = Meteor.bindEnvironment(function (code, clientId, expires, user, callback) {
    var codeId, e;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in saveAuthCode (code:', code, ', clientId:', clientId, ', expires:', expires, ', user:', user, ')');
    }

    try {
      codeId = AuthCodes.upsert({
        authCode: code
      }, {
        authCode: code,
        clientId: clientId,
        userId: user.id,
        expires: expires
      });
      return callback(null, codeId);
    } catch (error) {
      e = error;
      return callback(e);
    }
  });
  Model.prototype.saveRefreshToken = Meteor.bindEnvironment(function (token, clientId, expires, user, callback) {
    var e, tokenId;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in saveRefreshToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
    }

    try {
      return tokenId = RefreshTokens.insert({
        refreshToken: token,
        clientId: clientId,
        userId: user.id,
        expires: expires
      }, callback(null, tokenId));
    } catch (error) {
      e = error;
      return callback(e);
    }
  });
  Model.prototype.getRefreshToken = Meteor.bindEnvironment(function (refreshToken, callback) {
    var e, token;

    if (debug === true) {
      console.log('[OAuth2Server]', 'in getRefreshToken (refreshToken: ' + refreshToken + ')');
    }

    try {
      token = RefreshTokens.findOne({
        refreshToken: refreshToken
      });
      return callback(null, token);
    } catch (error) {
      e = error;
      return callback(e);
    }
  });
  return Model;
}();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_oauth2-server/oauth.coffee                                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var express, oauthserver;
oauthserver = Npm.require('oauth2-server');
express = Npm.require('express');

OAuth2Server = function () {
  function OAuth2Server(config) {
    this.config = config != null ? config : {};
    this.app = express();
    this.routes = express();
    this.model = new Model(this.config);
    this.oauth = oauthserver({
      model: this.model,
      grants: ['authorization_code', 'refresh_token'],
      debug: this.config.debug
    });
    this.publishAuhorizedClients();
    this.initRoutes();
    return this;
  }

  OAuth2Server.prototype.publishAuhorizedClients = function () {
    return Meteor.publish('authorizedOAuth', function () {
      if (this.userId == null) {
        return this.ready();
      }

      return Meteor.users.find({
        _id: this.userId
      }, {
        fields: {
          'oauth.authorizedClients': 1
        }
      });
      return typeof user !== "undefined" && user !== null;
    });
  };

  OAuth2Server.prototype.initRoutes = function () {
    var debugMiddleware, self, transformRequestsNotUsingFormUrlencodedType;
    self = this;

    debugMiddleware = function (req, res, next) {
      if (self.config.debug === true) {
        console.log('[OAuth2Server]', req.method, req.url);
      }

      return next();
    };

    transformRequestsNotUsingFormUrlencodedType = function (req, res, next) {
      if (!req.is('application/x-www-form-urlencoded') && req.method === 'POST') {
        if (self.config.debug === true) {
          console.log('[OAuth2Server]', 'Transforming a request to form-urlencoded with the query going to the body.');
        }

        req.headers['content-type'] = 'application/x-www-form-urlencoded';
        req.body = Object.assign({}, req.body, req.query);
      }

      return next();
    };

    this.app.all('/oauth/token', debugMiddleware, transformRequestsNotUsingFormUrlencodedType, this.oauth.grant());
    this.app.get('/oauth/authorize', debugMiddleware, Meteor.bindEnvironment(function (req, res, next) {
      var client;
      client = self.model.Clients.findOne({
        active: true,
        clientId: req.query.client_id
      });

      if (client == null) {
        return res.redirect('/oauth/error/404');
      }

      if (client.redirectUri !== req.query.redirect_uri) {
        return res.redirect('/oauth/error/invalid_redirect_uri');
      }

      return next();
    }));
    this.app.post('/oauth/authorize', debugMiddleware, Meteor.bindEnvironment(function (req, res, next) {
      var user;

      if (req.body.token == null) {
        return res.sendStatus(401).send('No token');
      }

      user = Meteor.users.findOne({
        'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(req.body.token)
      });

      if (user == null) {
        return res.sendStatus(401).send('Invalid token');
      }

      req.user = {
        id: user._id
      };
      return next();
    }));
    this.app.post('/oauth/authorize', debugMiddleware, this.oauth.authCodeGrant(function (req, next) {
      if (req.body.allow === 'yes') {
        Meteor.users.update(req.user.id, {
          $addToSet: {
            'oauth.authorizedClients': this.clientId
          }
        });
      }

      return next(null, req.body.allow === 'yes', req.user);
    }));
    this.app.use(this.routes);
    return this.app.all('/oauth/*', this.oauth.errorHandler());
  };

  return OAuth2Server;
}();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['rocketchat:oauth2-server'] = {}, {
  OAuth2Server: OAuth2Server
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_oauth2-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdF9vYXV0aDItc2VydmVyL21vZGVsLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvbW9kZWwuY29mZmVlIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0X29hdXRoMi1zZXJ2ZXIvb2F1dGguY29mZmVlIiwibWV0ZW9yOi8v8J+Su2FwcC9vYXV0aC5jb2ZmZWUiXSwibmFtZXMiOlsiQWNjZXNzVG9rZW5zIiwiQXV0aENvZGVzIiwiQ2xpZW50cyIsIk1vZGVsIiwiUmVmcmVzaFRva2VucyIsImRlYnVnIiwiY29uZmlnIiwiYWNjZXNzVG9rZW5zQ29sbGVjdGlvbk5hbWUiLCJyZWZyZXNoVG9rZW5zQ29sbGVjdGlvbk5hbWUiLCJjbGllbnRzQ29sbGVjdGlvbk5hbWUiLCJhdXRoQ29kZXNDb2xsZWN0aW9uTmFtZSIsImFjY2Vzc1Rva2Vuc0NvbGxlY3Rpb24iLCJNZXRlb3IiLCJDb2xsZWN0aW9uIiwicmVmcmVzaFRva2Vuc0NvbGxlY3Rpb24iLCJjbGllbnRzQ29sbGVjdGlvbiIsImF1dGhDb2Rlc0NvbGxlY3Rpb24iLCJwcm90b3R5cGUiLCJnZXRBY2Nlc3NUb2tlbiIsImJpbmRFbnZpcm9ubWVudCIsImJlYXJlclRva2VuIiwiY2FsbGJhY2siLCJlIiwidG9rZW4iLCJjb25zb2xlIiwibG9nIiwiZmluZE9uZSIsImFjY2Vzc1Rva2VuIiwiZXJyb3IiLCJnZXRDbGllbnQiLCJjbGllbnRJZCIsImNsaWVudFNlY3JldCIsImNsaWVudCIsImFjdGl2ZSIsImdyYW50VHlwZUFsbG93ZWQiLCJncmFudFR5cGUiLCJzYXZlQWNjZXNzVG9rZW4iLCJleHBpcmVzIiwidXNlciIsInRva2VuSWQiLCJpbnNlcnQiLCJ1c2VySWQiLCJpZCIsImdldEF1dGhDb2RlIiwiYXV0aENvZGUiLCJjb2RlIiwic2F2ZUF1dGhDb2RlIiwiY29kZUlkIiwidXBzZXJ0Iiwic2F2ZVJlZnJlc2hUb2tlbiIsInJlZnJlc2hUb2tlbiIsImdldFJlZnJlc2hUb2tlbiIsImV4cHJlc3MiLCJvYXV0aHNlcnZlciIsIk5wbSIsInJlcXVpcmUiLCJPQXV0aDJTZXJ2ZXIiLCJhcHAiLCJyb3V0ZXMiLCJtb2RlbCIsIm9hdXRoIiwiZ3JhbnRzIiwicHVibGlzaEF1aG9yaXplZENsaWVudHMiLCJpbml0Um91dGVzIiwicHVibGlzaCIsInJlYWR5IiwidXNlcnMiLCJmaW5kIiwiX2lkIiwiZmllbGRzIiwiZGVidWdNaWRkbGV3YXJlIiwic2VsZiIsInRyYW5zZm9ybVJlcXVlc3RzTm90VXNpbmdGb3JtVXJsZW5jb2RlZFR5cGUiLCJyZXEiLCJyZXMiLCJuZXh0IiwibWV0aG9kIiwidXJsIiwiaXMiLCJoZWFkZXJzIiwiYm9keSIsIk9iamVjdCIsImFzc2lnbiIsInF1ZXJ5IiwiYWxsIiwiZ3JhbnQiLCJnZXQiLCJjbGllbnRfaWQiLCJyZWRpcmVjdCIsInJlZGlyZWN0VXJpIiwicmVkaXJlY3RfdXJpIiwicG9zdCIsInNlbmRTdGF0dXMiLCJzZW5kIiwiQWNjb3VudHMiLCJfaGFzaExvZ2luVG9rZW4iLCJhdXRoQ29kZUdyYW50IiwiYWxsb3ciLCJ1cGRhdGUiLCIkYWRkVG9TZXQiLCJ1c2UiLCJlcnJvckhhbmRsZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUFBLFlBQUEsRUFBQUMsU0FBQSxFQUFBQyxPQUFBLEVBQUFDLEtBQUEsRUFBQUMsYUFBQSxFQUFBQyxLQUFBO0FBQUFMLGVBQWUsTUFBZjtBQUNBSSxnQkFBZ0IsTUFBaEI7QUFDQUYsVUFBVSxNQUFWO0FBQ0FELFlBQVksTUFBWjtBQUNBSSxRQUFRLE1BQVI7O0FBRUEsS0FBQ0YsS0FBRCxHQUFlQSxRQUFBO0FBQ0QsV0FBQUEsS0FBQSxDQUFDRyxNQUFEO0FDT1YsUUFBSUEsVUFBVSxJQUFkLEVBQW9CO0FEUFRBLGVBQU8sRUFBUDtBQ1NWOztBQUNELFFBQUlBLE9BQU9DLDBCQUFQLElBQXFDLElBQXpDLEVBQStDO0FE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LEtBQVQsS0FBa0IsS0FBckI7QUFDQ3JGLGVBQU9zRCxLQUFQLENBQWFnQyxNQUFiLENBQW9CekIsSUFBSW5DLElBQUosQ0FBU0ksRUFBN0IsRUFBaUM7QUFBQ3lELHFCQUFXO0FBQUMsdUNBQTJCLEtBQUNyRTtBQUE3QjtBQUFaLFNBQWpDO0FDUUc7O0FBQ0QsYURQSDZDLEtBQUssSUFBTCxFQUFXRixJQUFJTyxJQUFKLENBQVNpQixLQUFULEtBQWtCLEtBQTdCLEVBQW9DeEIsSUFBSW5DLElBQXhDLENDT0c7QURYMkMsTUFBL0M7QUFNQSxTQUFDbUIsR0FBRCxDQUFLMkMsR0FBTCxDQUFTLEtBQUMxQyxNQUFWO0FDUUUsV0RORixLQUFDRCxHQUFELENBQUsyQixHQUFMLENBQVMsVUFBVCxFQUFxQixLQUFDeEIsS0FBRCxDQUFPeUMsWUFBUCxFQUFyQixDQ01FO0FEM0RTLEdDRlg7O0FBZ0VBLFNBQU83QyxZQUFQO0FBRUQsQ0RqR0ssRyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9vYXV0aDItc2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiQWNjZXNzVG9rZW5zID0gdW5kZWZpbmVkXG5SZWZyZXNoVG9rZW5zID0gdW5kZWZpbmVkXG5DbGllbnRzID0gdW5kZWZpbmVkXG5BdXRoQ29kZXMgPSB1bmRlZmluZWRcbmRlYnVnID0gdW5kZWZpbmVkXG5cbkBNb2RlbCA9IGNsYXNzIE1vZGVsXG5cdGNvbnN0cnVjdG9yOiAoY29uZmlnPXt9KSAtPlxuXHRcdGNvbmZpZy5hY2Nlc3NUb2tlbnNDb2xsZWN0aW9uTmFtZSA/PSAnb2F1dGhfYWNjZXNzX3Rva2Vucydcblx0XHRjb25maWcucmVmcmVzaFRva2Vuc0NvbGxlY3Rpb25OYW1lID89ICdvYXV0aF9yZWZyZXNoX3Rva2Vucydcblx0XHRjb25maWcuY2xpZW50c0NvbGxlY3Rpb25OYW1lID89ICdvYXV0aF9jbGllbnRzJ1xuXHRcdGNvbmZpZy5hdXRoQ29kZXNDb2xsZWN0aW9uTmFtZSA/PSAnb2F1dGhfYXV0aF9jb2RlcydcblxuXHRcdEBkZWJ1ZyA9IGRlYnVnID0gY29uZmlnLmRlYnVnXG5cblx0XHRAQWNjZXNzVG9rZW5zID0gQWNjZXNzVG9rZW5zID0gY29uZmlnLmFjY2Vzc1Rva2Vuc0NvbGxlY3Rpb24gb3IgbmV3IE1ldGVvci5Db2xsZWN0aW9uIGNvbmZpZy5hY2Nlc3NUb2tlbnNDb2xsZWN0aW9uTmFtZVxuXHRcdEBSZWZyZXNoVG9rZW5zID0gUmVmcmVzaFRva2VucyA9IGNvbmZpZy5yZWZyZXNoVG9rZW5zQ29sbGVjdGlvbiBvciBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24gY29uZmlnLnJlZnJlc2hUb2tlbnNDb2xsZWN0aW9uTmFtZVxuXHRcdEBDbGllbnRzID0gQ2xpZW50cyA9IGNvbmZpZy5jbGllbnRzQ29sbGVjdGlvbiBvciBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24gY29uZmlnLmNsaWVudHNDb2xsZWN0aW9uTmFtZVxuXHRcdEBBdXRoQ29kZXMgPSBBdXRoQ29kZXMgPSBjb25maWcuYXV0aENvZGVzQ29sbGVjdGlvbiBvciBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24gY29uZmlnLmF1dGhDb2Rlc0NvbGxlY3Rpb25OYW1lXG5cblxuXHRnZXRBY2Nlc3NUb2tlbjogTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCAoYmVhcmVyVG9rZW4sIGNhbGxiYWNrKSAtPlxuXHRcdGlmIGRlYnVnIGlzIHRydWVcblx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdpbiBnZXRBY2Nlc3NUb2tlbiAoYmVhcmVyVG9rZW46JywgYmVhcmVyVG9rZW4sICcpJ1xuXG5cdFx0dHJ5XG5cdFx0XHR0b2tlbiA9IEFjY2Vzc1Rva2Vucy5maW5kT25lIGFjY2Vzc1Rva2VuOiBiZWFyZXJUb2tlblxuXHRcdFx0Y2FsbGJhY2sgbnVsbCwgdG9rZW5cblx0XHRjYXRjaCBlXG5cdFx0XHRjYWxsYmFjayBlXG5cblxuXHRnZXRDbGllbnQ6IE1ldGVvci5iaW5kRW52aXJvbm1lbnQgKGNsaWVudElkLCBjbGllbnRTZWNyZXQsIGNhbGxiYWNrKSAtPlxuXHRcdGlmIGRlYnVnIGlzIHRydWVcblx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdpbiBnZXRDbGllbnQgKGNsaWVudElkOicsIGNsaWVudElkLCAnLCBjbGllbnRTZWNyZXQ6JywgY2xpZW50U2VjcmV0LCAnKSdcblxuXHRcdHRyeVxuXHRcdFx0aWYgbm90IGNsaWVudFNlY3JldD9cblx0XHRcdFx0Y2xpZW50ID0gQ2xpZW50cy5maW5kT25lIHsgYWN0aXZlOiB0cnVlLCBjbGllbnRJZDogY2xpZW50SWQgfVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRjbGllbnQgPSBDbGllbnRzLmZpbmRPbmUgeyBhY3RpdmU6IHRydWUsIGNsaWVudElkOiBjbGllbnRJZCwgY2xpZW50U2VjcmV0OiBjbGllbnRTZWNyZXQgfVxuXHRcdFx0Y2FsbGJhY2sgbnVsbCwgY2xpZW50XG5cdFx0Y2F0Y2ggZVxuXHRcdFx0Y2FsbGJhY2sgZVxuXG5cblx0Z3JhbnRUeXBlQWxsb3dlZDogKGNsaWVudElkLCBncmFudFR5cGUsIGNhbGxiYWNrKSAtPlxuXHRcdGlmIGRlYnVnIGlzIHRydWVcblx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdpbiBncmFudFR5cGVBbGxvd2VkIChjbGllbnRJZDonLCBjbGllbnRJZCwgJywgZ3JhbnRUeXBlOicsIGdyYW50VHlwZSArICcpJ1xuXG5cdFx0cmV0dXJuIGNhbGxiYWNrKGZhbHNlLCBncmFudFR5cGUgaW4gWydhdXRob3JpemF0aW9uX2NvZGUnLCAncmVmcmVzaF90b2tlbiddKVxuXG5cblx0c2F2ZUFjY2Vzc1Rva2VuOiBNZXRlb3IuYmluZEVudmlyb25tZW50ICh0b2tlbiwgY2xpZW50SWQsIGV4cGlyZXMsIHVzZXIsIGNhbGxiYWNrKSAtPlxuXHRcdGlmIGRlYnVnIGlzIHRydWVcblx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdpbiBzYXZlQWNjZXNzVG9rZW4gKHRva2VuOicsIHRva2VuLCAnLCBjbGllbnRJZDonLCBjbGllbnRJZCwgJywgdXNlcjonLCB1c2VyLCAnLCBleHBpcmVzOicsIGV4cGlyZXMsICcpJ1xuXG5cdFx0dHJ5XG5cdFx0XHR0b2tlbklkID0gQWNjZXNzVG9rZW5zLmluc2VydFxuXHRcdFx0XHRhY2Nlc3NUb2tlbjogdG9rZW5cblx0XHRcdFx0Y2xpZW50SWQ6IGNsaWVudElkXG5cdFx0XHRcdHVzZXJJZDogdXNlci5pZFxuXHRcdFx0XHRleHBpcmVzOiBleHBpcmVzXG5cblx0XHRcdGNhbGxiYWNrIG51bGwsIHRva2VuSWRcblx0XHRjYXRjaCBlXG5cdFx0XHRjYWxsYmFjayBlXG5cblxuXHRnZXRBdXRoQ29kZTogTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCAoYXV0aENvZGUsIGNhbGxiYWNrKSAtPlxuXHRcdGlmIGRlYnVnIGlzIHRydWVcblx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdpbiBnZXRBdXRoQ29kZSAoYXV0aENvZGU6ICcgKyBhdXRoQ29kZSArICcpJ1xuXG5cdFx0dHJ5XG5cdFx0XHRjb2RlID0gQXV0aENvZGVzLmZpbmRPbmUgYXV0aENvZGU6IGF1dGhDb2RlXG5cdFx0XHRjYWxsYmFjayBudWxsLCBjb2RlXG5cdFx0Y2F0Y2ggZVxuXHRcdFx0Y2FsbGJhY2sgZVxuXG5cblx0c2F2ZUF1dGhDb2RlOiBNZXRlb3IuYmluZEVudmlyb25tZW50IChjb2RlLCBjbGllbnRJZCwgZXhwaXJlcywgdXNlciwgY2FsbGJhY2spIC0+XG5cdFx0aWYgZGVidWcgaXMgdHJ1ZVxuXHRcdFx0Y29uc29sZS5sb2cgJ1tPQXV0aDJTZXJ2ZXJdJywgJ2luIHNhdmVBdXRoQ29kZSAoY29kZTonLCBjb2RlLCAnLCBjbGllbnRJZDonLCBjbGllbnRJZCwgJywgZXhwaXJlczonLCBleHBpcmVzLCAnLCB1c2VyOicsIHVzZXIsICcpJ1xuXG5cdFx0dHJ5XG5cdFx0XHRjb2RlSWQgPSBBdXRoQ29kZXMudXBzZXJ0XG5cdFx0XHRcdGF1dGhDb2RlOiBjb2RlXG5cdFx0XHQsXG5cdFx0XHRcdGF1dGhDb2RlOiBjb2RlXG5cdFx0XHRcdGNsaWVudElkOiBjbGllbnRJZFxuXHRcdFx0XHR1c2VySWQ6IHVzZXIuaWRcblx0XHRcdFx0ZXhwaXJlczogZXhwaXJlc1xuXG5cdFx0XHRjYWxsYmFjayBudWxsLCBjb2RlSWRcblx0XHRjYXRjaCBlXG5cdFx0XHRjYWxsYmFjayBlXG5cblxuXHRzYXZlUmVmcmVzaFRva2VuOiBNZXRlb3IuYmluZEVudmlyb25tZW50ICh0b2tlbiwgY2xpZW50SWQsIGV4cGlyZXMsIHVzZXIsIGNhbGxiYWNrKSAtPlxuXHRcdGlmIGRlYnVnIGlzIHRydWVcblx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdpbiBzYXZlUmVmcmVzaFRva2VuICh0b2tlbjonLCB0b2tlbiwgJywgY2xpZW50SWQ6JywgY2xpZW50SWQsICcsIHVzZXI6JywgdXNlciwgJywgZXhwaXJlczonLCBleHBpcmVzLCAnKSdcblxuXHRcdHRyeVxuXHRcdFx0dG9rZW5JZCA9IFJlZnJlc2hUb2tlbnMuaW5zZXJ0XG5cdFx0XHRcdHJlZnJlc2hUb2tlbjogdG9rZW5cblx0XHRcdFx0Y2xpZW50SWQ6IGNsaWVudElkXG5cdFx0XHRcdHVzZXJJZDogdXNlci5pZFxuXHRcdFx0XHRleHBpcmVzOiBleHBpcmVzXG5cblx0XHRcdFx0Y2FsbGJhY2sgbnVsbCwgdG9rZW5JZFxuXHRcdGNhdGNoIGVcblx0XHRcdGNhbGxiYWNrIGVcblxuXG5cdGdldFJlZnJlc2hUb2tlbjogTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCAocmVmcmVzaFRva2VuLCBjYWxsYmFjaykgLT5cblx0XHRpZiBkZWJ1ZyBpcyB0cnVlXG5cdFx0XHRjb25zb2xlLmxvZyAnW09BdXRoMlNlcnZlcl0nLCAnaW4gZ2V0UmVmcmVzaFRva2VuIChyZWZyZXNoVG9rZW46ICcgKyByZWZyZXNoVG9rZW4gKyAnKSdcblxuXHRcdHRyeVxuXHRcdFx0dG9rZW4gPSBSZWZyZXNoVG9rZW5zLmZpbmRPbmUgcmVmcmVzaFRva2VuOiByZWZyZXNoVG9rZW5cblx0XHRcdGNhbGxiYWNrIG51bGwsIHRva2VuXG5cdFx0Y2F0Y2ggZVxuXHRcdFx0Y2FsbGJhY2sgZVxuIiwidmFyIEFjY2Vzc1Rva2VucywgQXV0aENvZGVzLCBDbGllbnRzLCBNb2RlbCwgUmVmcmVzaFRva2VucywgZGVidWc7XG5cbkFjY2Vzc1Rva2VucyA9IHZvaWQgMDtcblxuUmVmcmVzaFRva2VucyA9IHZvaWQgMDtcblxuQ2xpZW50cyA9IHZvaWQgMDtcblxuQXV0aENvZGVzID0gdm9pZCAwO1xuXG5kZWJ1ZyA9IHZvaWQgMDtcblxudGhpcy5Nb2RlbCA9IE1vZGVsID0gKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiBNb2RlbChjb25maWcpIHtcbiAgICBpZiAoY29uZmlnID09IG51bGwpIHtcbiAgICAgIGNvbmZpZyA9IHt9O1xuICAgIH1cbiAgICBpZiAoY29uZmlnLmFjY2Vzc1Rva2Vuc0NvbGxlY3Rpb25OYW1lID09IG51bGwpIHtcbiAgICAgIGNvbmZpZy5hY2Nlc3NUb2tlbnNDb2xsZWN0aW9uTmFtZSA9ICdvYXV0aF9hY2Nlc3NfdG9rZW5zJztcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5yZWZyZXNoVG9rZW5zQ29sbGVjdGlvbk5hbWUgPT0gbnVsbCkge1xuICAgICAgY29uZmlnLnJlZnJlc2hUb2tlbnNDb2xsZWN0aW9uTmFtZSA9ICdvYXV0aF9yZWZyZXNoX3Rva2Vucyc7XG4gICAgfVxuICAgIGlmIChjb25maWcuY2xpZW50c0NvbGxlY3Rpb25OYW1lID09IG51bGwpIHtcbiAgICAgIGNvbmZpZy5jbGllbnRzQ29sbGVjdGlvbk5hbWUgPSAnb2F1dGhfY2xpZW50cyc7XG4gICAgfVxuICAgIGlmIChjb25maWcuYXV0aENvZGVzQ29sbGVjdGlvbk5hbWUgPT0gbnVsbCkge1xuICAgICAgY29uZmlnLmF1dGhDb2Rlc0NvbGxlY3Rpb25OYW1lID0gJ29hdXRoX2F1dGhfY29kZXMnO1xuICAgIH1cbiAgICB0aGlzLmRlYnVnID0gZGVidWcgPSBjb25maWcuZGVidWc7XG4gICAgdGhpcy5BY2Nlc3NUb2tlbnMgPSBBY2Nlc3NUb2tlbnMgPSBjb25maWcuYWNjZXNzVG9rZW5zQ29sbGVjdGlvbiB8fCBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24oY29uZmlnLmFjY2Vzc1Rva2Vuc0NvbGxlY3Rpb25OYW1lKTtcbiAgICB0aGlzLlJlZnJlc2hUb2tlbnMgPSBSZWZyZXNoVG9rZW5zID0gY29uZmlnLnJlZnJlc2hUb2tlbnNDb2xsZWN0aW9uIHx8IG5ldyBNZXRlb3IuQ29sbGVjdGlvbihjb25maWcucmVmcmVzaFRva2Vuc0NvbGxlY3Rpb25OYW1lKTtcbiAgICB0aGlzLkNsaWVudHMgPSBDbGllbnRzID0gY29uZmlnLmNsaWVudHNDb2xsZWN0aW9uIHx8IG5ldyBNZXRlb3IuQ29sbGVjdGlvbihjb25maWcuY2xpZW50c0NvbGxlY3Rpb25OYW1lKTtcbiAgICB0aGlzLkF1dGhDb2RlcyA9IEF1dGhDb2RlcyA9IGNvbmZpZy5hdXRoQ29kZXNDb2xsZWN0aW9uIHx8IG5ldyBNZXRlb3IuQ29sbGVjdGlvbihjb25maWcuYXV0aENvZGVzQ29sbGVjdGlvbk5hbWUpO1xuICB9XG5cbiAgTW9kZWwucHJvdG90eXBlLmdldEFjY2Vzc1Rva2VuID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihiZWFyZXJUb2tlbiwgY2FsbGJhY2spIHtcbiAgICB2YXIgZSwgdG9rZW47XG4gICAgaWYgKGRlYnVnID09PSB0cnVlKSB7XG4gICAgICBjb25zb2xlLmxvZygnW09BdXRoMlNlcnZlcl0nLCAnaW4gZ2V0QWNjZXNzVG9rZW4gKGJlYXJlclRva2VuOicsIGJlYXJlclRva2VuLCAnKScpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgdG9rZW4gPSBBY2Nlc3NUb2tlbnMuZmluZE9uZSh7XG4gICAgICAgIGFjY2Vzc1Rva2VuOiBiZWFyZXJUb2tlblxuICAgICAgfSk7XG4gICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgdG9rZW4pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBlID0gZXJyb3I7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZSk7XG4gICAgfVxuICB9KTtcblxuICBNb2RlbC5wcm90b3R5cGUuZ2V0Q2xpZW50ID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihjbGllbnRJZCwgY2xpZW50U2VjcmV0LCBjYWxsYmFjaykge1xuICAgIHZhciBjbGllbnQsIGU7XG4gICAgaWYgKGRlYnVnID09PSB0cnVlKSB7XG4gICAgICBjb25zb2xlLmxvZygnW09BdXRoMlNlcnZlcl0nLCAnaW4gZ2V0Q2xpZW50IChjbGllbnRJZDonLCBjbGllbnRJZCwgJywgY2xpZW50U2VjcmV0OicsIGNsaWVudFNlY3JldCwgJyknKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGlmIChjbGllbnRTZWNyZXQgPT0gbnVsbCkge1xuICAgICAgICBjbGllbnQgPSBDbGllbnRzLmZpbmRPbmUoe1xuICAgICAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICBjbGllbnRJZDogY2xpZW50SWRcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjbGllbnQgPSBDbGllbnRzLmZpbmRPbmUoe1xuICAgICAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICBjbGllbnRJZDogY2xpZW50SWQsXG4gICAgICAgICAgY2xpZW50U2VjcmV0OiBjbGllbnRTZWNyZXRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgY2xpZW50KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgZSA9IGVycm9yO1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGUpO1xuICAgIH1cbiAgfSk7XG5cbiAgTW9kZWwucHJvdG90eXBlLmdyYW50VHlwZUFsbG93ZWQgPSBmdW5jdGlvbihjbGllbnRJZCwgZ3JhbnRUeXBlLCBjYWxsYmFjaykge1xuICAgIGlmIChkZWJ1ZyA9PT0gdHJ1ZSkge1xuICAgICAgY29uc29sZS5sb2coJ1tPQXV0aDJTZXJ2ZXJdJywgJ2luIGdyYW50VHlwZUFsbG93ZWQgKGNsaWVudElkOicsIGNsaWVudElkLCAnLCBncmFudFR5cGU6JywgZ3JhbnRUeXBlICsgJyknKTtcbiAgICB9XG4gICAgcmV0dXJuIGNhbGxiYWNrKGZhbHNlLCBncmFudFR5cGUgPT09ICdhdXRob3JpemF0aW9uX2NvZGUnIHx8IGdyYW50VHlwZSA9PT0gJ3JlZnJlc2hfdG9rZW4nKTtcbiAgfTtcblxuICBNb2RlbC5wcm90b3R5cGUuc2F2ZUFjY2Vzc1Rva2VuID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbih0b2tlbiwgY2xpZW50SWQsIGV4cGlyZXMsIHVzZXIsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGUsIHRva2VuSWQ7XG4gICAgaWYgKGRlYnVnID09PSB0cnVlKSB7XG4gICAgICBjb25zb2xlLmxvZygnW09BdXRoMlNlcnZlcl0nLCAnaW4gc2F2ZUFjY2Vzc1Rva2VuICh0b2tlbjonLCB0b2tlbiwgJywgY2xpZW50SWQ6JywgY2xpZW50SWQsICcsIHVzZXI6JywgdXNlciwgJywgZXhwaXJlczonLCBleHBpcmVzLCAnKScpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgdG9rZW5JZCA9IEFjY2Vzc1Rva2Vucy5pbnNlcnQoe1xuICAgICAgICBhY2Nlc3NUb2tlbjogdG9rZW4sXG4gICAgICAgIGNsaWVudElkOiBjbGllbnRJZCxcbiAgICAgICAgdXNlcklkOiB1c2VyLmlkLFxuICAgICAgICBleHBpcmVzOiBleHBpcmVzXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCB0b2tlbklkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgZSA9IGVycm9yO1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGUpO1xuICAgIH1cbiAgfSk7XG5cbiAgTW9kZWwucHJvdG90eXBlLmdldEF1dGhDb2RlID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihhdXRoQ29kZSwgY2FsbGJhY2spIHtcbiAgICB2YXIgY29kZSwgZTtcbiAgICBpZiAoZGVidWcgPT09IHRydWUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbT0F1dGgyU2VydmVyXScsICdpbiBnZXRBdXRoQ29kZSAoYXV0aENvZGU6ICcgKyBhdXRoQ29kZSArICcpJyk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb2RlID0gQXV0aENvZGVzLmZpbmRPbmUoe1xuICAgICAgICBhdXRoQ29kZTogYXV0aENvZGVcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIGNvZGUpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBlID0gZXJyb3I7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZSk7XG4gICAgfVxuICB9KTtcblxuICBNb2RlbC5wcm90b3R5cGUuc2F2ZUF1dGhDb2RlID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihjb2RlLCBjbGllbnRJZCwgZXhwaXJlcywgdXNlciwgY2FsbGJhY2spIHtcbiAgICB2YXIgY29kZUlkLCBlO1xuICAgIGlmIChkZWJ1ZyA9PT0gdHJ1ZSkge1xuICAgICAgY29uc29sZS5sb2coJ1tPQXV0aDJTZXJ2ZXJdJywgJ2luIHNhdmVBdXRoQ29kZSAoY29kZTonLCBjb2RlLCAnLCBjbGllbnRJZDonLCBjbGllbnRJZCwgJywgZXhwaXJlczonLCBleHBpcmVzLCAnLCB1c2VyOicsIHVzZXIsICcpJyk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjb2RlSWQgPSBBdXRoQ29kZXMudXBzZXJ0KHtcbiAgICAgICAgYXV0aENvZGU6IGNvZGVcbiAgICAgIH0sIHtcbiAgICAgICAgYXV0aENvZGU6IGNvZGUsXG4gICAgICAgIGNsaWVudElkOiBjbGllbnRJZCxcbiAgICAgICAgdXNlcklkOiB1c2VyLmlkLFxuICAgICAgICBleHBpcmVzOiBleHBpcmVzXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBjb2RlSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBlID0gZXJyb3I7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZSk7XG4gICAgfVxuICB9KTtcblxuICBNb2RlbC5wcm90b3R5cGUuc2F2ZVJlZnJlc2hUb2tlbiA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24odG9rZW4sIGNsaWVudElkLCBleHBpcmVzLCB1c2VyLCBjYWxsYmFjaykge1xuICAgIHZhciBlLCB0b2tlbklkO1xuICAgIGlmIChkZWJ1ZyA9PT0gdHJ1ZSkge1xuICAgICAgY29uc29sZS5sb2coJ1tPQXV0aDJTZXJ2ZXJdJywgJ2luIHNhdmVSZWZyZXNoVG9rZW4gKHRva2VuOicsIHRva2VuLCAnLCBjbGllbnRJZDonLCBjbGllbnRJZCwgJywgdXNlcjonLCB1c2VyLCAnLCBleHBpcmVzOicsIGV4cGlyZXMsICcpJyk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdG9rZW5JZCA9IFJlZnJlc2hUb2tlbnMuaW5zZXJ0KHtcbiAgICAgICAgcmVmcmVzaFRva2VuOiB0b2tlbixcbiAgICAgICAgY2xpZW50SWQ6IGNsaWVudElkLFxuICAgICAgICB1c2VySWQ6IHVzZXIuaWQsXG4gICAgICAgIGV4cGlyZXM6IGV4cGlyZXNcbiAgICAgIH0sIGNhbGxiYWNrKG51bGwsIHRva2VuSWQpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgZSA9IGVycm9yO1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGUpO1xuICAgIH1cbiAgfSk7XG5cbiAgTW9kZWwucHJvdG90eXBlLmdldFJlZnJlc2hUb2tlbiA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24ocmVmcmVzaFRva2VuLCBjYWxsYmFjaykge1xuICAgIHZhciBlLCB0b2tlbjtcbiAgICBpZiAoZGVidWcgPT09IHRydWUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbT0F1dGgyU2VydmVyXScsICdpbiBnZXRSZWZyZXNoVG9rZW4gKHJlZnJlc2hUb2tlbjogJyArIHJlZnJlc2hUb2tlbiArICcpJyk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICB0b2tlbiA9IFJlZnJlc2hUb2tlbnMuZmluZE9uZSh7XG4gICAgICAgIHJlZnJlc2hUb2tlbjogcmVmcmVzaFRva2VuXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCB0b2tlbik7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGUgPSBlcnJvcjtcbiAgICAgIHJldHVybiBjYWxsYmFjayhlKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBNb2RlbDtcblxufSkoKTtcbiIsIm9hdXRoc2VydmVyID0gTnBtLnJlcXVpcmUoJ29hdXRoMi1zZXJ2ZXInKVxuZXhwcmVzcyA9IE5wbS5yZXF1aXJlKCdleHByZXNzJylcblxuIyBXZWJBcHAucmF3Q29ubmVjdEhhbmRsZXJzLnVzZSBhcHBcbiMgSnNvblJvdXRlcy5NaWRkbGV3YXJlLnVzZSBhcHBcblxuXG5jbGFzcyBPQXV0aDJTZXJ2ZXJcblx0Y29uc3RydWN0b3I6IChAY29uZmlnPXt9KSAtPlxuXHRcdEBhcHAgPSBleHByZXNzKClcblxuXHRcdEByb3V0ZXMgPSBleHByZXNzKClcblxuXHRcdEBtb2RlbCA9IG5ldyBNb2RlbChAY29uZmlnKVxuXG5cdFx0QG9hdXRoID0gb2F1dGhzZXJ2ZXJcblx0XHRcdG1vZGVsOiBAbW9kZWxcblx0XHRcdGdyYW50czogWydhdXRob3JpemF0aW9uX2NvZGUnLCAncmVmcmVzaF90b2tlbiddXG5cdFx0XHRkZWJ1ZzogQGNvbmZpZy5kZWJ1Z1xuXG5cdFx0QHB1Ymxpc2hBdWhvcml6ZWRDbGllbnRzKClcblx0XHRAaW5pdFJvdXRlcygpXG5cblx0XHRyZXR1cm4gQFxuXG5cblx0cHVibGlzaEF1aG9yaXplZENsaWVudHM6IC0+XG5cdFx0TWV0ZW9yLnB1Ymxpc2ggJ2F1dGhvcml6ZWRPQXV0aCcsIC0+XG5cdFx0XHRcdGlmIG5vdCBAdXNlcklkP1xuXHRcdFx0XHRcdHJldHVybiBAcmVhZHkoKVxuXG5cdFx0XHRcdHJldHVybiBNZXRlb3IudXNlcnMuZmluZFxuXHRcdFx0XHRcdF9pZDogQHVzZXJJZFxuXHRcdFx0XHQsXG5cdFx0XHRcdFx0ZmllbGRzOlxuXHRcdFx0XHRcdFx0J29hdXRoLmF1dGhvcml6ZWRDbGllbnRzJzogMVxuXG5cdFx0XHRcdHJldHVybiB1c2VyP1xuXG5cblx0aW5pdFJvdXRlczogLT5cblx0XHRzZWxmID0gQFxuXHRcdGRlYnVnTWlkZGxld2FyZSA9IChyZXEsIHJlcywgbmV4dCkgLT5cblx0XHRcdGlmIHNlbGYuY29uZmlnLmRlYnVnIGlzIHRydWVcblx0XHRcdFx0Y29uc29sZS5sb2cgJ1tPQXV0aDJTZXJ2ZXJdJywgcmVxLm1ldGhvZCwgcmVxLnVybFxuXHRcdFx0bmV4dCgpXG5cblx0XHQjIFRyYW5zZm9ybXMgcmVxdWVzdHMgd2hpY2ggYXJlIFBPU1QgYW5kIGFyZW4ndCBcIngtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIGNvbnRlbnQgdHlwZVxuXHRcdCMgYW5kIHRoZXkgcGFzcyB0aGUgcmVxdWlyZWQgaW5mb3JtYXRpb24gYXMgcXVlcnkgc3RyaW5nc1xuXHRcdHRyYW5zZm9ybVJlcXVlc3RzTm90VXNpbmdGb3JtVXJsZW5jb2RlZFR5cGUgPSAocmVxLCByZXMsIG5leHQpIC0+XG5cdFx0XHRpZiBub3QgcmVxLmlzKCdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnKSBhbmQgcmVxLm1ldGhvZCBpcyAnUE9TVCdcblx0XHRcdFx0aWYgc2VsZi5jb25maWcuZGVidWcgaXMgdHJ1ZVxuXHRcdFx0XHRcdGNvbnNvbGUubG9nICdbT0F1dGgyU2VydmVyXScsICdUcmFuc2Zvcm1pbmcgYSByZXF1ZXN0IHRvIGZvcm0tdXJsZW5jb2RlZCB3aXRoIHRoZSBxdWVyeSBnb2luZyB0byB0aGUgYm9keS4nXG5cdFx0XHRcdHJlcS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSA9ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG5cdFx0XHRcdHJlcS5ib2R5ID0gT2JqZWN0LmFzc2lnbiB7fSwgcmVxLmJvZHksIHJlcS5xdWVyeVxuXHRcdFx0bmV4dCgpXG5cblx0XHRAYXBwLmFsbCAnL29hdXRoL3Rva2VuJywgZGVidWdNaWRkbGV3YXJlLCB0cmFuc2Zvcm1SZXF1ZXN0c05vdFVzaW5nRm9ybVVybGVuY29kZWRUeXBlLCBAb2F1dGguZ3JhbnQoKVxuXG5cdFx0QGFwcC5nZXQgJy9vYXV0aC9hdXRob3JpemUnLCBkZWJ1Z01pZGRsZXdhcmUsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQgKHJlcSwgcmVzLCBuZXh0KSAtPlxuXHRcdFx0Y2xpZW50ID0gc2VsZi5tb2RlbC5DbGllbnRzLmZpbmRPbmUoeyBhY3RpdmU6IHRydWUsIGNsaWVudElkOiByZXEucXVlcnkuY2xpZW50X2lkIH0pXG5cdFx0XHRpZiBub3QgY2xpZW50P1xuXHRcdFx0XHRyZXR1cm4gcmVzLnJlZGlyZWN0ICcvb2F1dGgvZXJyb3IvNDA0J1xuXG5cdFx0XHRpZiBjbGllbnQucmVkaXJlY3RVcmkgaXNudCByZXEucXVlcnkucmVkaXJlY3RfdXJpXG5cdFx0XHRcdHJldHVybiByZXMucmVkaXJlY3QgJy9vYXV0aC9lcnJvci9pbnZhbGlkX3JlZGlyZWN0X3VyaSdcblxuXHRcdFx0bmV4dCgpXG5cblx0XHRAYXBwLnBvc3QgJy9vYXV0aC9hdXRob3JpemUnLCBkZWJ1Z01pZGRsZXdhcmUsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQgKHJlcSwgcmVzLCBuZXh0KSAtPlxuXHRcdFx0aWYgbm90IHJlcS5ib2R5LnRva2VuP1xuXHRcdFx0XHRyZXR1cm4gcmVzLnNlbmRTdGF0dXMoNDAxKS5zZW5kKCdObyB0b2tlbicpXG5cblx0XHRcdHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZVxuXHRcdFx0XHQnc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLmhhc2hlZFRva2VuJzogQWNjb3VudHMuX2hhc2hMb2dpblRva2VuIHJlcS5ib2R5LnRva2VuXG5cblx0XHRcdGlmIG5vdCB1c2VyP1xuXHRcdFx0XHRyZXR1cm4gcmVzLnNlbmRTdGF0dXMoNDAxKS5zZW5kKCdJbnZhbGlkIHRva2VuJylcblxuXHRcdFx0cmVxLnVzZXIgPVxuXHRcdFx0XHRpZDogdXNlci5faWRcblxuXHRcdFx0bmV4dCgpXG5cblxuXHRcdEBhcHAucG9zdCAnL29hdXRoL2F1dGhvcml6ZScsIGRlYnVnTWlkZGxld2FyZSwgQG9hdXRoLmF1dGhDb2RlR3JhbnQgKHJlcSwgbmV4dCkgLT5cblx0XHRcdGlmIHJlcS5ib2R5LmFsbG93IGlzICd5ZXMnXG5cdFx0XHRcdE1ldGVvci51c2Vycy51cGRhdGUgcmVxLnVzZXIuaWQsIHskYWRkVG9TZXQ6IHsnb2F1dGguYXV0aG9yaXplZENsaWVudHMnOiBAY2xpZW50SWR9fVxuXG5cdFx0XHRuZXh0KG51bGwsIHJlcS5ib2R5LmFsbG93IGlzICd5ZXMnLCByZXEudXNlcilcblxuXHRcdEBhcHAudXNlIEByb3V0ZXNcblxuXHRcdEBhcHAuYWxsICcvb2F1dGgvKicsIEBvYXV0aC5lcnJvckhhbmRsZXIoKVxuIiwidmFyIGV4cHJlc3MsIG9hdXRoc2VydmVyOyAgICAgICAgICAgICAgXG5cbm9hdXRoc2VydmVyID0gTnBtLnJlcXVpcmUoJ29hdXRoMi1zZXJ2ZXInKTtcblxuZXhwcmVzcyA9IE5wbS5yZXF1aXJlKCdleHByZXNzJyk7XG5cbk9BdXRoMlNlcnZlciA9IChmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gT0F1dGgyU2VydmVyKGNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnICE9IG51bGwgPyBjb25maWcgOiB7fTtcbiAgICB0aGlzLmFwcCA9IGV4cHJlc3MoKTtcbiAgICB0aGlzLnJvdXRlcyA9IGV4cHJlc3MoKTtcbiAgICB0aGlzLm1vZGVsID0gbmV3IE1vZGVsKHRoaXMuY29uZmlnKTtcbiAgICB0aGlzLm9hdXRoID0gb2F1dGhzZXJ2ZXIoe1xuICAgICAgbW9kZWw6IHRoaXMubW9kZWwsXG4gICAgICBncmFudHM6IFsnYXV0aG9yaXphdGlvbl9jb2RlJywgJ3JlZnJlc2hfdG9rZW4nXSxcbiAgICAgIGRlYnVnOiB0aGlzLmNvbmZpZy5kZWJ1Z1xuICAgIH0pO1xuICAgIHRoaXMucHVibGlzaEF1aG9yaXplZENsaWVudHMoKTtcbiAgICB0aGlzLmluaXRSb3V0ZXMoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIE9BdXRoMlNlcnZlci5wcm90b3R5cGUucHVibGlzaEF1aG9yaXplZENsaWVudHMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gTWV0ZW9yLnB1Ymxpc2goJ2F1dGhvcml6ZWRPQXV0aCcsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMudXNlcklkID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZHkoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBNZXRlb3IudXNlcnMuZmluZCh7XG4gICAgICAgIF9pZDogdGhpcy51c2VySWRcbiAgICAgIH0sIHtcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgJ29hdXRoLmF1dGhvcml6ZWRDbGllbnRzJzogMVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0eXBlb2YgdXNlciAhPT0gXCJ1bmRlZmluZWRcIiAmJiB1c2VyICE9PSBudWxsO1xuICAgIH0pO1xuICB9O1xuXG4gIE9BdXRoMlNlcnZlci5wcm90b3R5cGUuaW5pdFJvdXRlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkZWJ1Z01pZGRsZXdhcmUsIHNlbGYsIHRyYW5zZm9ybVJlcXVlc3RzTm90VXNpbmdGb3JtVXJsZW5jb2RlZFR5cGU7XG4gICAgc2VsZiA9IHRoaXM7XG4gICAgZGVidWdNaWRkbGV3YXJlID0gZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICAgIGlmIChzZWxmLmNvbmZpZy5kZWJ1ZyA9PT0gdHJ1ZSkge1xuICAgICAgICBjb25zb2xlLmxvZygnW09BdXRoMlNlcnZlcl0nLCByZXEubWV0aG9kLCByZXEudXJsKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfTtcbiAgICB0cmFuc2Zvcm1SZXF1ZXN0c05vdFVzaW5nRm9ybVVybGVuY29kZWRUeXBlID0gZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICAgIGlmICghcmVxLmlzKCdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnKSAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgaWYgKHNlbGYuY29uZmlnLmRlYnVnID09PSB0cnVlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tPQXV0aDJTZXJ2ZXJdJywgJ1RyYW5zZm9ybWluZyBhIHJlcXVlc3QgdG8gZm9ybS11cmxlbmNvZGVkIHdpdGggdGhlIHF1ZXJ5IGdvaW5nIHRvIHRoZSBib2R5LicpO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSA9ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnO1xuICAgICAgICByZXEuYm9keSA9IE9iamVjdC5hc3NpZ24oe30sIHJlcS5ib2R5LCByZXEucXVlcnkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9O1xuICAgIHRoaXMuYXBwLmFsbCgnL29hdXRoL3Rva2VuJywgZGVidWdNaWRkbGV3YXJlLCB0cmFuc2Zvcm1SZXF1ZXN0c05vdFVzaW5nRm9ybVVybGVuY29kZWRUeXBlLCB0aGlzLm9hdXRoLmdyYW50KCkpO1xuICAgIHRoaXMuYXBwLmdldCgnL29hdXRoL2F1dGhvcml6ZScsIGRlYnVnTWlkZGxld2FyZSwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbihyZXEsIHJlcywgbmV4dCkge1xuICAgICAgdmFyIGNsaWVudDtcbiAgICAgIGNsaWVudCA9IHNlbGYubW9kZWwuQ2xpZW50cy5maW5kT25lKHtcbiAgICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgICBjbGllbnRJZDogcmVxLnF1ZXJ5LmNsaWVudF9pZFxuICAgICAgfSk7XG4gICAgICBpZiAoY2xpZW50ID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5yZWRpcmVjdCgnL29hdXRoL2Vycm9yLzQwNCcpO1xuICAgICAgfVxuICAgICAgaWYgKGNsaWVudC5yZWRpcmVjdFVyaSAhPT0gcmVxLnF1ZXJ5LnJlZGlyZWN0X3VyaSkge1xuICAgICAgICByZXR1cm4gcmVzLnJlZGlyZWN0KCcvb2F1dGgvZXJyb3IvaW52YWxpZF9yZWRpcmVjdF91cmknKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfSkpO1xuICAgIHRoaXMuYXBwLnBvc3QoJy9vYXV0aC9hdXRob3JpemUnLCBkZWJ1Z01pZGRsZXdhcmUsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICAgIHZhciB1c2VyO1xuICAgICAgaWYgKHJlcS5ib2R5LnRva2VuID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kU3RhdHVzKDQwMSkuc2VuZCgnTm8gdG9rZW4nKTtcbiAgICAgIH1cbiAgICAgIHVzZXIgPSBNZXRlb3IudXNlcnMuZmluZE9uZSh7XG4gICAgICAgICdzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuaGFzaGVkVG9rZW4nOiBBY2NvdW50cy5faGFzaExvZ2luVG9rZW4ocmVxLmJvZHkudG9rZW4pXG4gICAgICB9KTtcbiAgICAgIGlmICh1c2VyID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zZW5kU3RhdHVzKDQwMSkuc2VuZCgnSW52YWxpZCB0b2tlbicpO1xuICAgICAgfVxuICAgICAgcmVxLnVzZXIgPSB7XG4gICAgICAgIGlkOiB1c2VyLl9pZFxuICAgICAgfTtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfSkpO1xuICAgIHRoaXMuYXBwLnBvc3QoJy9vYXV0aC9hdXRob3JpemUnLCBkZWJ1Z01pZGRsZXdhcmUsIHRoaXMub2F1dGguYXV0aENvZGVHcmFudChmdW5jdGlvbihyZXEsIG5leHQpIHtcbiAgICAgIGlmIChyZXEuYm9keS5hbGxvdyA9PT0gJ3llcycpIHtcbiAgICAgICAgTWV0ZW9yLnVzZXJzLnVwZGF0ZShyZXEudXNlci5pZCwge1xuICAgICAgICAgICRhZGRUb1NldDoge1xuICAgICAgICAgICAgJ29hdXRoLmF1dGhvcml6ZWRDbGllbnRzJzogdGhpcy5jbGllbnRJZFxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV4dChudWxsLCByZXEuYm9keS5hbGxvdyA9PT0gJ3llcycsIHJlcS51c2VyKTtcbiAgICB9KSk7XG4gICAgdGhpcy5hcHAudXNlKHRoaXMucm91dGVzKTtcbiAgICByZXR1cm4gdGhpcy5hcHAuYWxsKCcvb2F1dGgvKicsIHRoaXMub2F1dGguZXJyb3JIYW5kbGVyKCkpO1xuICB9O1xuXG4gIHJldHVybiBPQXV0aDJTZXJ2ZXI7XG5cbn0pKCk7XG4iXX0=
