(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;

/* Package-scope variables */
var changeCase;

(function(){

////////////////////////////////////////////////////////////////////////////
//                                                                        //
// packages/konecty_change-case/packages/konecty_change-case.js           //
//                                                                        //
////////////////////////////////////////////////////////////////////////////
                                                                          //
(function () {

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/konecty:change-case/konecty:change-case.js               //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
// Write your package code here!                                     // 1
changeCase = Npm.require('change-case');                             // 2
///////////////////////////////////////////////////////////////////////

}).call(this);

////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
(function (pkg, symbols) {
  for (var s in symbols)
    (s in pkg) || (pkg[s] = symbols[s]);
})(Package['konecty:change-case'] = {}, {
  changeCase: changeCase
});

})();
