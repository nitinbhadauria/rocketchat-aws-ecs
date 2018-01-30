(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var __coffeescriptShare;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/konecty_nrr/packages/konecty_nrr.js                                                            //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/konecty:nrr/konecty:nrr.coffee.js                                                           //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var Blaze, HTML, Template;

if (Package.templating != null) {
  Template = Package.templating.Template;
  Blaze = Package.blaze.Blaze;
  HTML = Package.htmljs.HTML;
  Blaze.toHTMLWithDataNonReactive = function(content, data) {
    var html, key, makeCursorReactive, value, _ref;
    makeCursorReactive = function(obj) {
      if (obj instanceof Meteor.Collection.Cursor) {
        return obj._depend({
          added: true,
          removed: true,
          changed: true
        });
      }
    };
    makeCursorReactive(data);
    if (data instanceof Spacebars.kw && Object.keys(data.hash).length > 0) {
      _ref = data.hash;
      for (key in _ref) {
        value = _ref[key];
        makeCursorReactive(value);
      }
      data = data.hash;
    }
    html = '';
    Tracker.nonreactive(function() {
      return html = Blaze.toHTMLWithData(content, data);
    });
    return html;
  };
  Blaze.registerHelper('nrrargs', function() {
    var obj;
    obj = {};
    obj._arguments = arguments;
    return obj;
  });
  Blaze.renderNonReactive = function(templateName, data) {
    var view, _arguments;
    _arguments = this.parentView.dataVar.get()._arguments;
    templateName = _arguments[0];
    data = _arguments[1];
    view = void 0;
    Tracker.nonreactive(function() {
      view = new Blaze.View('nrr', function() {
        return HTML.Raw(Blaze.toHTMLWithDataNonReactive(Template[templateName], data));
      });
      view.onViewReady(function() {
        var _ref;
        return (_ref = Template[templateName].onViewReady) != null ? _ref.call(view, data) : void 0;
      });
      return view._onViewRendered(function() {
        var _ref;
        return (_ref = Template[templateName].onViewRendered) != null ? _ref.call(view, data) : void 0;
      });
    });
    return view;
  };
  Blaze.registerHelper('nrr', Blaze.Template('nrr', Blaze.renderNonReactive));
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['konecty:nrr'] = {};

})();
