(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Logger = Package['rocketchat:logger'].Logger;
var SystemLogger = Package['rocketchat:logger'].SystemLogger;
var LoggerManager = Package['rocketchat:logger'].LoggerManager;
var ECMAScript = Package.ecmascript.ECMAScript;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:theme":{"server":{"server.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/rocketchat_theme/server/server.js                                                              //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);
let less;
module.watch(require("less"), {
	default(v) {
		less = v;
	}

}, 1);
let Autoprefixer;
module.watch(require("less-plugin-autoprefix"), {
	default(v) {
		Autoprefixer = v;
	}

}, 2);
let crypto;
module.watch(require("crypto"), {
	default(v) {
		crypto = v;
	}

}, 3);
const logger = new Logger('rocketchat:theme', {
	methods: {
		stop_rendering: {
			type: 'info'
		}
	}
});
WebApp.rawConnectHandlers.use(function (req, res, next) {
	const path = req.url.split('?')[0];
	const prefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';

	if (path === `${prefix}/__cordova/theme.css` || path === `${prefix}/theme.css`) {
		const css = RocketChat.theme.getCss();
		const hash = crypto.createHash('sha1').update(css).digest('hex');
		res.setHeader('Content-Type', 'text/css; charset=UTF-8');
		res.setHeader('ETag', `"${hash}"`);
		res.write(css);
		return res.end();
	} else {
		return next();
	}
});
const calculateClientHash = WebAppHashing.calculateClientHash;

WebAppHashing.calculateClientHash = function (manifest, includeFilter, runtimeConfigOverride) {
	const css = RocketChat.theme.getCss();

	if (css.trim() !== '') {
		const hash = crypto.createHash('sha1').update(css).digest('hex');

		let themeManifestItem = _.find(manifest, function (item) {
			return item.path === 'app/theme.css';
		});

		if (themeManifestItem == null) {
			themeManifestItem = {};
			manifest.push(themeManifestItem);
		}

		themeManifestItem.path = 'app/theme.css';
		themeManifestItem.type = 'css';
		themeManifestItem.cacheable = true;
		themeManifestItem.where = 'client';
		themeManifestItem.url = `/theme.css?${hash}`;
		themeManifestItem.size = css.length;
		themeManifestItem.hash = hash;
	}

	return calculateClientHash.call(this, manifest, includeFilter, runtimeConfigOverride);
};

RocketChat.theme = new class {
	constructor() {
		this.variables = {};
		this.packageCallbacks = [];
		this.files = ['server/colors.less'];
		this.customCSS = '';
		RocketChat.settings.add('css', '');
		RocketChat.settings.addGroup('Layout');
		RocketChat.settings.onload('css', Meteor.bindEnvironment((key, value, initialLoad) => {
			if (!initialLoad) {
				Meteor.startup(function () {
					process.emit('message', {
						refresh: 'client'
					});
				});
			}
		}));
		this.compileDelayed = _.debounce(Meteor.bindEnvironment(this.compile.bind(this)), 100);
		Meteor.startup(() => {
			RocketChat.settings.onAfterInitialLoad(() => {
				RocketChat.settings.get(/^theme-./, Meteor.bindEnvironment((key, value) => {
					if (key === 'theme-custom-css' && value != null) {
						this.customCSS = value;
					} else {
						const name = key.replace(/^theme-[a-z]+-/, '');

						if (this.variables[name] != null) {
							this.variables[name].value = value;
						}
					}

					this.compileDelayed();
				}));
			});
		});
	}

	compile() {
		let content = [this.getVariablesAsLess()];
		content.push(...this.files.map(name => Assets.getText(name)));
		content.push(...this.packageCallbacks.map(name => name()));
		content.push(this.customCSS);
		content = content.join('\n');
		const options = {
			compress: true,
			plugins: [new Autoprefixer()]
		};
		const start = Date.now();
		return less.render(content, options, function (err, data) {
			logger.stop_rendering(Date.now() - start);

			if (err != null) {
				return console.log(err);
			}

			RocketChat.settings.updateById('css', data.css);
			return Meteor.startup(function () {
				return Meteor.setTimeout(function () {
					return process.emit('message', {
						refresh: 'client'
					});
				}, 200);
			});
		});
	}

	addColor(name, value, section, properties) {
		const config = {
			group: 'Colors',
			type: 'color',
			editor: 'color',
			public: true,
			properties,
			section
		};
		return RocketChat.settings.add(`theme-color-${name}`, value, config);
	}

	addVariable(type, name, value, section, persist = true, editor, allowedTypes, property) {
		this.variables[name] = {
			type,
			value
		};

		if (persist) {
			const config = {
				group: 'Layout',
				type,
				editor: editor || type,
				section,
				'public': true,
				allowedTypes,
				property
			};
			return RocketChat.settings.add(`theme-${type}-${name}`, value, config);
		}
	}

	addPublicColor(name, value, section, editor = 'color', property) {
		return this.addVariable('color', name, value, section, true, editor, ['color', 'expression'], property);
	}

	addPublicFont(name, value) {
		return this.addVariable('font', name, value, 'Fonts', true);
	}

	getVariablesAsObject() {
		return Object.keys(this.variables).reduce((obj, name) => {
			obj[name] = this.variables[name].value;
			return obj;
		}, {});
	}

	getVariablesAsLess() {
		return Object.keys(this.variables).map(name => {
			const variable = this.variables[name];
			return `@${name}: ${variable.value};`;
		}).join('\n');
	}

	addPackageAsset(cb) {
		this.packageCallbacks.push(cb);
		return this.compileDelayed();
	}

	getCss() {
		return RocketChat.settings.get('css') || '';
	}

}();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"variables.js":function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/rocketchat_theme/server/variables.js                                                           //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
// TODO: Define registers/getters/setters for packages to work with established
// 			heirarchy of colors instead of making duplicate definitions
// TODO: Settings pages to show simple separation of major/minor/addon colors
// TODO: Get major colours as swatches for minor colors in minicolors plugin
// TODO: Minicolors settings to use rgb for alphas, hex otherwise
// TODO: Add setting toggle to use defaults for minor colours and hide settings
// New colors, used for shades on solid backgrounds
// Defined range of transparencies reduces random colour variances
// Major colors form the core of the scheme
// Names changed to reflect usage, comments show pre-refactor names
const reg = /--(rc-color-.*?): (.*?);/igm;
const colors = [...Assets.getText('client/imports/general/variables.css').match(reg)].map(color => {
	const [name, value] = color.split(': ');
	return [name.replace('--', ''), value.replace(';', '')];
});
colors.forEach(([key, color]) => {
	if (/var/.test(color)) {
		const [, value] = color.match(/var\(--(.*?)\)/i);
		return RocketChat.theme.addPublicColor(key, value, 'Colors', 'expression');
	}

	RocketChat.theme.addPublicColor(key, color, 'Colors');
});
const majorColors = {
	'content-background-color': '#FFFFFF',
	'primary-background-color': '#04436A',
	'primary-font-color': '#444444',
	'primary-action-color': '#13679A',
	// was action-buttons-color
	'secondary-background-color': '#F4F4F4',
	'secondary-font-color': '#A0A0A0',
	'secondary-action-color': '#DDDDDD',
	'component-color': '#EAEAEA',
	'success-color': '#4dff4d',
	'pending-color': '#FCB316',
	'error-color': '#BC2031',
	'selection-color': '#02ACEC',
	'attention-color': '#9C27B0'
}; // Minor colours implement major colours by default, but can be overruled

const minorColors = {
	'tertiary-background-color': '@component-color',
	'tertiary-font-color': '@transparent-lightest',
	'link-font-color': '@primary-action-color',
	'info-font-color': '@secondary-font-color',
	'custom-scrollbar-color': '@transparent-darker',
	'status-online': '@success-color',
	'status-away': '@pending-color',
	'status-busy': '@error-color',
	'status-offline': '@transparent-darker'
}; // Bulk-add settings for color scheme

Object.keys(majorColors).forEach(key => {
	const value = majorColors[key];
	RocketChat.theme.addPublicColor(key, value, 'Old Colors');
});
Object.keys(minorColors).forEach(key => {
	const value = minorColors[key];
	RocketChat.theme.addPublicColor(key, value, 'Old Colors (minor)', 'expression');
});
RocketChat.theme.addPublicFont('body-font-family', '-apple-system, BlinkMacSystemFont, Roboto, \'Helvetica Neue\', Arial, sans-serif, \'Apple Color Emoji\', \'Segoe UI\', \'Segoe UI Emoji\', \'Segoe UI Symbol\', \'Meiryo UI\'');
RocketChat.settings.add('theme-custom-css', '', {
	group: 'Layout',
	type: 'code',
	code: 'text/css',
	multiline: true,
	section: 'Custom CSS',
	public: true
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"node_modules":{"less":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// ../../.meteor/local/isopacks/rocketchat_theme/npm/node_modules/less/package.json                        //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
exports.name = "less";
exports.version = "https://github.com/meteor/less.js/tarball/8130849eb3d7f0ecf0ca8d0af7c4207b0442e3f6";
exports.main = "index";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/rocketchat_theme/node_modules/less/index.js                                         //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = require('./lib/less-node');

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"less-plugin-autoprefix":{"package.json":function(require,exports){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// ../../.meteor/local/isopacks/rocketchat_theme/npm/node_modules/less-plugin-autoprefix/package.json      //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
exports.name = "less-plugin-autoprefix";
exports.version = "1.4.2";
exports.main = "lib/index.js";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/rocketchat_theme/node_modules/less-plugin-autoprefix/lib/index.js                   //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
var getAutoprefixProcessor = require("./autoprefix-processor"),
    usage = require("./usage"),
    parseOptions = require("./parse-options");

function LessPluginAutoPrefixer(options) {
    this.options = options;
};

LessPluginAutoPrefixer.prototype = {
    install: function(less, pluginManager) {
        var AutoprefixProcessor = getAutoprefixProcessor(less);
        pluginManager.addPostProcessor(new AutoprefixProcessor(this.options));
    },
    printUsage: function () {
        usage.printUsage();
    },
    setOptions: function(options) {
        this.options = parseOptions(options);
    },
    minVersion: [2, 0, 0]
};

module.exports = LessPluginAutoPrefixer;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:theme/server/server.js");
require("./node_modules/meteor/rocketchat:theme/server/variables.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:theme'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_theme.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp0aGVtZS9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yb2NrZXRjaGF0OnRoZW1lL3NlcnZlci92YXJpYWJsZXMuanMiXSwibmFtZXMiOlsiXyIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsImRlZmF1bHQiLCJ2IiwibGVzcyIsIkF1dG9wcmVmaXhlciIsImNyeXB0byIsImxvZ2dlciIsIkxvZ2dlciIsIm1ldGhvZHMiLCJzdG9wX3JlbmRlcmluZyIsInR5cGUiLCJXZWJBcHAiLCJyYXdDb25uZWN0SGFuZGxlcnMiLCJ1c2UiLCJyZXEiLCJyZXMiLCJuZXh0IiwicGF0aCIsInVybCIsInNwbGl0IiwicHJlZml4IiwiX19tZXRlb3JfcnVudGltZV9jb25maWdfXyIsIlJPT1RfVVJMX1BBVEhfUFJFRklYIiwiY3NzIiwiUm9ja2V0Q2hhdCIsInRoZW1lIiwiZ2V0Q3NzIiwiaGFzaCIsImNyZWF0ZUhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJzZXRIZWFkZXIiLCJ3cml0ZSIsImVuZCIsImNhbGN1bGF0ZUNsaWVudEhhc2giLCJXZWJBcHBIYXNoaW5nIiwibWFuaWZlc3QiLCJpbmNsdWRlRmlsdGVyIiwicnVudGltZUNvbmZpZ092ZXJyaWRlIiwidHJpbSIsInRoZW1lTWFuaWZlc3RJdGVtIiwiZmluZCIsIml0ZW0iLCJwdXNoIiwiY2FjaGVhYmxlIiwid2hlcmUiLCJzaXplIiwibGVuZ3RoIiwiY2FsbCIsImNvbnN0cnVjdG9yIiwidmFyaWFibGVzIiwicGFja2FnZUNhbGxiYWNrcyIsImZpbGVzIiwiY3VzdG9tQ1NTIiwic2V0dGluZ3MiLCJhZGQiLCJhZGRHcm91cCIsIm9ubG9hZCIsIk1ldGVvciIsImJpbmRFbnZpcm9ubWVudCIsImtleSIsInZhbHVlIiwiaW5pdGlhbExvYWQiLCJzdGFydHVwIiwicHJvY2VzcyIsImVtaXQiLCJyZWZyZXNoIiwiY29tcGlsZURlbGF5ZWQiLCJkZWJvdW5jZSIsImNvbXBpbGUiLCJiaW5kIiwib25BZnRlckluaXRpYWxMb2FkIiwiZ2V0IiwibmFtZSIsInJlcGxhY2UiLCJjb250ZW50IiwiZ2V0VmFyaWFibGVzQXNMZXNzIiwibWFwIiwiQXNzZXRzIiwiZ2V0VGV4dCIsImpvaW4iLCJvcHRpb25zIiwiY29tcHJlc3MiLCJwbHVnaW5zIiwic3RhcnQiLCJEYXRlIiwibm93IiwicmVuZGVyIiwiZXJyIiwiZGF0YSIsImNvbnNvbGUiLCJsb2ciLCJ1cGRhdGVCeUlkIiwic2V0VGltZW91dCIsImFkZENvbG9yIiwic2VjdGlvbiIsInByb3BlcnRpZXMiLCJjb25maWciLCJncm91cCIsImVkaXRvciIsInB1YmxpYyIsImFkZFZhcmlhYmxlIiwicGVyc2lzdCIsImFsbG93ZWRUeXBlcyIsInByb3BlcnR5IiwiYWRkUHVibGljQ29sb3IiLCJhZGRQdWJsaWNGb250IiwiZ2V0VmFyaWFibGVzQXNPYmplY3QiLCJPYmplY3QiLCJrZXlzIiwicmVkdWNlIiwib2JqIiwidmFyaWFibGUiLCJhZGRQYWNrYWdlQXNzZXQiLCJjYiIsInJlZyIsImNvbG9ycyIsIm1hdGNoIiwiY29sb3IiLCJmb3JFYWNoIiwidGVzdCIsIm1ham9yQ29sb3JzIiwibWlub3JDb2xvcnMiLCJjb2RlIiwibXVsdGlsaW5lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLENBQUo7O0FBQU1DLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxZQUFSLENBQWIsRUFBbUM7QUFBQ0MsU0FBUUMsQ0FBUixFQUFVO0FBQUNMLE1BQUVLLENBQUY7QUFBSTs7QUFBaEIsQ0FBbkMsRUFBcUQsQ0FBckQ7QUFBd0QsSUFBSUMsSUFBSjtBQUFTTCxPQUFPQyxLQUFQLENBQWFDLFFBQVEsTUFBUixDQUFiLEVBQTZCO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDQyxTQUFLRCxDQUFMO0FBQU87O0FBQW5CLENBQTdCLEVBQWtELENB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RUFBbUQsK0tBQW5EO0FBRUFsRixXQUFXOEIsUUFBWCxDQUFvQkMsR0FBcEIsQ0FBd0Isa0JBQXhCLEVBQTRDLEVBQTVDLEVBQWdEO0FBQy9DMkMsUUFBTyxRQUR3QztBQUUvQ3hGLE9BQU0sTUFGeUM7QUFHL0NpSCxPQUFNLFVBSHlDO0FBSS9DQyxZQUFXLElBSm9DO0FBSy9DN0IsVUFBUyxZQUxzQztBQU0vQ0ssU0FBUTtBQU51QyxDQUFoRCxFIiwiZmlsZSI6Ii9wYWNrYWdlcy9yb2NrZXRjaGF0X3RoZW1lLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFscyBXZWJBcHBIYXNoaW5nICovXG5cbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IGxlc3MgZnJvbSAnbGVzcyc7XG5pbXBvcnQgQXV0b3ByZWZpeGVyIGZyb20gJ2xlc3MtcGx1Z2luLWF1dG9wcmVmaXgnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuXG5jb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdyb2NrZXRjaGF0OnRoZW1lJywge1xuXHRtZXRob2RzOiB7XG5cdFx0c3RvcF9yZW5kZXJpbmc6IHtcblx0XHRcdHR5cGU6ICdpbmZvJ1xuXHRcdH1cblx0fVxufSk7XG5cbldlYkFwcC5yYXdDb25uZWN0SGFuZGxlcnMudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG5cdGNvbnN0IHBhdGggPSByZXEudXJsLnNwbGl0KCc/JylbMF07XG5cdGNvbnN0IHByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfHwgJyc7XG5cdGlmIChwYXRoID09PSBgJHsgcHJlZml4IH0vX19jb3Jkb3ZhL3RoZW1lLmNzc2AgfHwgcGF0aCA9PT0gYCR7IHByZWZpeCB9L3RoZW1lLmNzc2ApIHtcblx0XHRjb25zdCBjc3MgPSBSb2NrZXRDaGF0LnRoZW1lLmdldENzcygpO1xuXHRcdGNvbnN0IGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMScpLnVwZGF0ZShjc3MpLmRpZ2VzdCgnaGV4Jyk7XG5cdFx0cmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvY3NzOyBjaGFyc2V0PVVURi04Jyk7XG5cdFx0cmVzLnNldEhlYWRlcignRVRhZycsIGBcIiR7IGhhc2ggfVwiYCk7XG5cdFx0cmVzLndyaXRlKGNzcyk7XG5cdFx0cmV0dXJuIHJlcy5lbmQoKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbmV4dCgpO1xuXHR9XG59KTtcblxuY29uc3QgY2FsY3VsYXRlQ2xpZW50SGFzaCA9IFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaDtcblxuV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoID0gZnVuY3Rpb24obWFuaWZlc3QsIGluY2x1ZGVGaWx0ZXIsIHJ1bnRpbWVDb25maWdPdmVycmlkZSkge1xuXHRjb25zdCBjc3MgPSBSb2NrZXRDaGF0LnRoZW1lLmdldENzcygpO1xuXHRpZiAoY3NzLnRyaW0oKSAhPT0gJycpIHtcblx0XHRjb25zdCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTEnKS51cGRhdGUoY3NzKS5kaWdlc3QoJ2hleCcpO1xuXHRcdGxldCB0aGVtZU1hbmlmZXN0SXRlbSA9IF8uZmluZChtYW5pZmVzdCwgZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0cmV0dXJuIGl0ZW0ucGF0aCA9PT0gJ2FwcC90aGVtZS5jc3MnO1xuXHRcdH0pO1xuXHRcdGlmICh0aGVtZU1hbmlmZXN0SXRlbSA9PSBudWxsKSB7XG5cdFx0XHR0aGVtZU1hbmlmZXN0SXRlbSA9IHt9O1xuXHRcdFx0bWFuaWZlc3QucHVzaCh0aGVtZU1hbmlmZXN0SXRlbSk7XG5cdFx0fVxuXHRcdHRoZW1lTWFuaWZlc3RJdGVtLnBhdGggPSAnYXBwL3RoZW1lLmNzcyc7XG5cdFx0dGhlbWVNYW5pZmVzdEl0ZW0udHlwZSA9ICdjc3MnO1xuXHRcdHRoZW1lTWFuaWZlc3RJdGVtLmNhY2hlYWJsZSA9IHRydWU7XG5cdFx0dGhlbWVNYW5pZmVzdEl0ZW0ud2hlcmUgPSAnY2xpZW50Jztcblx0XHR0aGVtZU1hbmlmZXN0SXRlbS51cmwgPSBgL3RoZW1lLmNzcz8keyBoYXNoIH1gO1xuXHRcdHRoZW1lTWFuaWZlc3RJdGVtLnNpemUgPSBjc3MubGVuZ3RoO1xuXHRcdHRoZW1lTWFuaWZlc3RJdGVtLmhhc2ggPSBoYXNoO1xuXHR9XG5cdHJldHVybiBjYWxjdWxhdGVDbGllbnRIYXNoLmNhbGwodGhpcywgbWFuaWZlc3QsIGluY2x1ZGVGaWx0ZXIsIHJ1bnRpbWVDb25maWdPdmVycmlkZSk7XG59O1xuXG5Sb2NrZXRDaGF0LnRoZW1lID0gbmV3IGNsYXNzIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy52YXJpYWJsZXMgPSB7fTtcblx0XHR0aGlzLnBhY2thZ2VDYWxsYmFja3MgPSBbXTtcblx0XHR0aGlzLmZpbGVzID0gWydzZXJ2ZXIvY29sb3JzLmxlc3MnXTtcblx0XHR0aGlzLmN1c3RvbUNTUyA9ICcnO1xuXHRcdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdjc3MnLCAnJyk7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGRHcm91cCgnTGF5b3V0Jyk7XG5cdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5vbmxvYWQoJ2NzcycsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKGtleSwgdmFsdWUsIGluaXRpYWxMb2FkKSA9PiB7XG5cdFx0XHRpZiAoIWluaXRpYWxMb2FkKSB7XG5cdFx0XHRcdE1ldGVvci5zdGFydHVwKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHByb2Nlc3MuZW1pdCgnbWVzc2FnZScsIHtcblx0XHRcdFx0XHRcdHJlZnJlc2g6ICdjbGllbnQnXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLmNvbXBpbGVEZWxheWVkID0gXy5kZWJvdW5jZShNZXRlb3IuYmluZEVudmlyb25tZW50KHRoaXMuY29tcGlsZS5iaW5kKHRoaXMpKSwgMTAwKTtcblx0XHRNZXRlb3Iuc3RhcnR1cCgoKSA9PiB7XG5cdFx0XHRSb2NrZXRDaGF0LnNldHRpbmdzLm9uQWZ0ZXJJbml0aWFsTG9hZCgoKSA9PiB7XG5cdFx0XHRcdFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KC9edGhlbWUtLi8sIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKGtleSwgdmFsdWUpID0+IHtcblx0XHRcdFx0XHRpZiAoa2V5ID09PSAndGhlbWUtY3VzdG9tLWNzcycgJiYgdmFsdWUgIT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0dGhpcy5jdXN0b21DU1MgPSB2YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29uc3QgbmFtZSA9IGtleS5yZXBsYWNlKC9edGhlbWUtW2Etel0rLS8sICcnKTtcblx0XHRcdFx0XHRcdGlmICh0aGlzLnZhcmlhYmxlc1tuYW1lXSAhPSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudmFyaWFibGVzW25hbWVdLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5jb21waWxlRGVsYXllZCgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGNvbXBpbGUoKSB7XG5cdFx0bGV0IGNvbnRlbnQgPSBbdGhpcy5nZXRWYXJpYWJsZXNBc0xlc3MoKV07XG5cblx0XHRjb250ZW50LnB1c2goLi4udGhpcy5maWxlcy5tYXAoKG5hbWUpID0+IEFzc2V0cy5nZXRUZXh0KG5hbWUpKSk7XG5cblx0XHRjb250ZW50LnB1c2goLi4udGhpcy5wYWNrYWdlQ2FsbGJhY2tzLm1hcChuYW1lID0+IG5hbWUoKSkpO1xuXG5cdFx0Y29udGVudC5wdXNoKHRoaXMuY3VzdG9tQ1NTKTtcblx0XHRjb250ZW50ID0gY29udGVudC5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBvcHRpb25zID0ge1xuXHRcdFx0Y29tcHJlc3M6IHRydWUsXG5cdFx0XHRwbHVnaW5zOiBbbmV3IEF1dG9wcmVmaXhlcigpXVxuXHRcdH07XG5cdFx0Y29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuXHRcdHJldHVybiBsZXNzLnJlbmRlcihjb250ZW50LCBvcHRpb25zLCBmdW5jdGlvbihlcnIsIGRhdGEpIHtcblx0XHRcdGxvZ2dlci5zdG9wX3JlbmRlcmluZyhEYXRlLm5vdygpIC0gc3RhcnQpO1xuXHRcdFx0aWYgKGVyciAhPSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiBjb25zb2xlLmxvZyhlcnIpO1xuXHRcdFx0fVxuXHRcdFx0Um9ja2V0Q2hhdC5zZXR0aW5ncy51cGRhdGVCeUlkKCdjc3MnLCBkYXRhLmNzcyk7XG5cdFx0XHRyZXR1cm4gTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBNZXRlb3Iuc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRyZXR1cm4gcHJvY2Vzcy5lbWl0KCdtZXNzYWdlJywge1xuXHRcdFx0XHRcdFx0cmVmcmVzaDogJ2NsaWVudCdcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSwgMjAwKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0YWRkQ29sb3IobmFtZSwgdmFsdWUsIHNlY3Rpb24sIHByb3BlcnRpZXMpIHtcblx0XHRjb25zdCBjb25maWcgPSB7XG5cdFx0XHRncm91cDogJ0NvbG9ycycsXG5cdFx0XHR0eXBlOiAnY29sb3InLFxuXHRcdFx0ZWRpdG9yOiAnY29sb3InLFxuXHRcdFx0cHVibGljOiB0cnVlLFxuXHRcdFx0cHJvcGVydGllcyxcblx0XHRcdHNlY3Rpb25cblx0XHR9O1xuXG5cdFx0cmV0dXJuIFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKGB0aGVtZS1jb2xvci0keyBuYW1lIH1gLCB2YWx1ZSwgY29uZmlnKTtcblx0fVxuXG5cdGFkZFZhcmlhYmxlKHR5cGUsIG5hbWUsIHZhbHVlLCBzZWN0aW9uLCBwZXJzaXN0ID0gdHJ1ZSwgZWRpdG9yLCBhbGxvd2VkVHlwZXMsIHByb3BlcnR5KSB7XG5cdFx0dGhpcy52YXJpYWJsZXNbbmFtZV0gPSB7XG5cdFx0XHR0eXBlLFxuXHRcdFx0dmFsdWVcblx0XHR9O1xuXHRcdGlmIChwZXJzaXN0KSB7XG5cdFx0XHRjb25zdCBjb25maWcgPSB7XG5cdFx0XHRcdGdyb3VwOiAnTGF5b3V0Jyxcblx0XHRcdFx0dHlwZSxcblx0XHRcdFx0ZWRpdG9yOiBlZGl0b3IgfHwgdHlwZSxcblx0XHRcdFx0c2VjdGlvbixcblx0XHRcdFx0J3B1YmxpYyc6IHRydWUsXG5cdFx0XHRcdGFsbG93ZWRUeXBlcyxcblx0XHRcdFx0cHJvcGVydHlcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoYHRoZW1lLSR7IHR5cGUgfS0keyBuYW1lIH1gLCB2YWx1ZSwgY29uZmlnKTtcblx0XHR9XG5cblx0fVxuXG5cdGFkZFB1YmxpY0NvbG9yKG5hbWUsIHZhbHVlLCBzZWN0aW9uLCBlZGl0b3IgPSAnY29sb3InLCBwcm9wZXJ0eSkge1xuXHRcdHJldHVybiB0aGlzLmFkZFZhcmlhYmxlKCdjb2xvcicsIG5hbWUsIHZhbHVlLCBzZWN0aW9uLCB0cnVlLCBlZGl0b3IsIFsnY29sb3InLCAnZXhwcmVzc2lvbiddLCBwcm9wZXJ0eSk7XG5cdH1cblxuXHRhZGRQdWJsaWNGb250KG5hbWUsIHZhbHVlKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWRkVmFyaWFibGUoJ2ZvbnQnLCBuYW1lLCB2YWx1ZSwgJ0ZvbnRzJywgdHJ1ZSk7XG5cdH1cblxuXHRnZXRWYXJpYWJsZXNBc09iamVjdCgpIHtcblx0XHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy52YXJpYWJsZXMpLnJlZHVjZSgob2JqLCBuYW1lKSA9PiB7XG5cdFx0XHRvYmpbbmFtZV0gPSB0aGlzLnZhcmlhYmxlc1tuYW1lXS52YWx1ZTtcblx0XHRcdHJldHVybiBvYmo7XG5cdFx0fSwge30pO1xuXHR9XG5cblx0Z2V0VmFyaWFibGVzQXNMZXNzKCkge1xuXHRcdHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnZhcmlhYmxlcykubWFwKChuYW1lKSA9PiB7XG5cdFx0XHRjb25zdCB2YXJpYWJsZSA9IHRoaXMudmFyaWFibGVzW25hbWVdO1xuXHRcdFx0cmV0dXJuIGBAJHsgbmFtZSB9OiAkeyB2YXJpYWJsZS52YWx1ZSB9O2A7XG5cdFx0fSkuam9pbignXFxuJyk7XG5cdH1cblxuXHRhZGRQYWNrYWdlQXNzZXQoY2IpIHtcblx0XHR0aGlzLnBhY2thZ2VDYWxsYmFja3MucHVzaChjYik7XG5cdFx0cmV0dXJuIHRoaXMuY29tcGlsZURlbGF5ZWQoKTtcblx0fVxuXG5cdGdldENzcygpIHtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ2NzcycpIHx8ICcnO1xuXHR9XG5cbn07XG4iLCJcbi8vIFRPRE86IERlZmluZSByZWdpc3RlcnMvZ2V0dGVycy9zZXR0ZXJzIGZvciBwYWNrYWdlcyB0byB3b3JrIHdpdGggZXN0YWJsaXNoZWRcbi8vIFx0XHRcdGhlaXJhcmNoeSBvZiBjb2xvcnMgaW5zdGVhZCBvZiBtYWtpbmcgZHVwbGljYXRlIGRlZmluaXRpb25zXG4vLyBUT0RPOiBTZXR0aW5ncyBwYWdlcyB0byBzaG93IHNpbXBsZSBzZXBhcmF0aW9uIG9mIG1ham9yL21pbm9yL2FkZG9uIGNvbG9yc1xuLy8gVE9ETzogR2V0IG1ham9yIGNvbG91cnMgYXMgc3dhdGNoZXMgZm9yIG1pbm9yIGNvbG9ycyBpbiBtaW5pY29sb3JzIHBsdWdpblxuLy8gVE9ETzogTWluaWNvbG9ycyBzZXR0aW5ncyB0byB1c2UgcmdiIGZvciBhbHBoYXMsIGhleCBvdGhlcndpc2Vcbi8vIFRPRE86IEFkZCBzZXR0aW5nIHRvZ2dsZSB0byB1c2UgZGVmYXVsdHMgZm9yIG1pbm9yIGNvbG91cnMgYW5kIGhpZGUgc2V0dGluZ3NcblxuLy8gTmV3IGNvbG9ycywgdXNlZCBmb3Igc2hhZGVzIG9uIHNvbGlkIGJhY2tncm91bmRzXG4vLyBEZWZpbmVkIHJhbmdlIG9mIHRyYW5zcGFyZW5jaWVzIHJlZHVjZXMgcmFuZG9tIGNvbG91ciB2YXJpYW5jZXNcbi8vIE1ham9yIGNvbG9ycyBmb3JtIHRoZSBjb3JlIG9mIHRoZSBzY2hlbWVcbi8vIE5hbWVzIGNoYW5nZWQgdG8gcmVmbGVjdCB1c2FnZSwgY29tbWVudHMgc2hvdyBwcmUtcmVmYWN0b3IgbmFtZXNcblxuY29uc3QgcmVnID0gLy0tKHJjLWNvbG9yLS4qPyk6ICguKj8pOy9pZ207XG5cbmNvbnN0IGNvbG9ycyA9IFsuLi5Bc3NldHMuZ2V0VGV4dCgnY2xpZW50L2ltcG9ydHMvZ2VuZXJhbC92YXJpYWJsZXMuY3NzJykubWF0Y2gocmVnKV0ubWFwKGNvbG9yID0+IHtcblx0Y29uc3QgW25hbWUsIHZhbHVlXSA9IGNvbG9yLnNwbGl0KCc6ICcpO1xuXHRyZXR1cm4gW25hbWUucmVwbGFjZSgnLS0nLCAnJyksIHZhbHVlLnJlcGxhY2UoJzsnLCAnJyldO1xufSk7XG5cbmNvbG9ycy5mb3JFYWNoKChba2V5LCBjb2xvcl0pID0+IFx0e1xuXHRpZiAoL3Zhci8udGVzdChjb2xvcikpIHtcblx0XHRjb25zdCBbLCB2YWx1ZV0gPSBjb2xvci5tYXRjaCgvdmFyXFwoLS0oLio/KVxcKS9pKTtcblx0XHRyZXR1cm4gUm9ja2V0Q2hhdC50aGVtZS5hZGRQdWJsaWNDb2xvcihrZXksIHZhbHVlLCAnQ29sb3JzJywgJ2V4cHJlc3Npb24nKTtcblx0fVxuXHRSb2NrZXRDaGF0LnRoZW1lLmFkZFB1YmxpY0NvbG9yKGtleSwgY29sb3IsICdDb2xvcnMnKTtcbn0pO1xuXG5jb25zdCBtYWpvckNvbG9ycz0ge1xuXHQnY29udGVudC1iYWNrZ3JvdW5kLWNvbG9yJzogJyNGRkZGRkYnLFxuXHQncHJpbWFyeS1iYWNrZ3JvdW5kLWNvbG9yJzogJyMwNDQzNkEnLFxuXHQncHJpbWFyeS1mb250LWNvbG9yJzogJyM0NDQ0NDQnLFxuXHQncHJpbWFyeS1hY3Rpb24tY29sb3InOiAnIzEzNjc5QScsIC8vIHdhcyBhY3Rpb24tYnV0dG9ucy1jb2xvclxuXHQnc2Vjb25kYXJ5LWJhY2tncm91bmQtY29sb3InOiAnI0Y0RjRGNCcsXG5cdCdzZWNvbmRhcnktZm9udC1jb2xvcic6ICcjQTBBMEEwJyxcblx0J3NlY29uZGFyeS1hY3Rpb24tY29sb3InOiAnI0RERERERCcsXG5cdCdjb21wb25lbnQtY29sb3InOiAnI0VBRUFFQScsXG5cdCdzdWNjZXNzLWNvbG9yJzogJyM0ZGZmNGQnLFxuXHQncGVuZGluZy1jb2xvcic6ICcjRkNCMzE2Jyxcblx0J2Vycm9yLWNvbG9yJzogJyNCQzIwMzEnLFxuXHQnc2VsZWN0aW9uLWNvbG9yJzogJyMwMkFDRUMnLFxuXHQnYXR0ZW50aW9uLWNvbG9yJzogJyM5QzI3QjAnXG59O1xuXG4vLyBNaW5vciBjb2xvdXJzIGltcGxlbWVudCBtYWpvciBjb2xvdXJzIGJ5IGRlZmF1bHQsIGJ1dCBjYW4gYmUgb3ZlcnJ1bGVkXG5jb25zdCBtaW5vckNvbG9ycz0ge1xuXHQndGVydGlhcnktYmFja2dyb3VuZC1jb2xvcic6ICdAY29tcG9uZW50LWNvbG9yJyxcblx0J3RlcnRpYXJ5LWZvbnQtY29sb3InOiAnQHRyYW5zcGFyZW50LWxpZ2h0ZXN0Jyxcblx0J2xpbmstZm9udC1jb2xvcic6ICdAcHJpbWFyeS1hY3Rpb24tY29sb3InLFxuXHQnaW5mby1mb250LWNvbG9yJzogJ0BzZWNvbmRhcnktZm9udC1jb2xvcicsXG5cdCdjdXN0b20tc2Nyb2xsYmFyLWNvbG9yJzogJ0B0cmFuc3BhcmVudC1kYXJrZXInLFxuXHQnc3RhdHVzLW9ubGluZSc6ICdAc3VjY2Vzcy1jb2xvcicsXG5cdCdzdGF0dXMtYXdheSc6ICdAcGVuZGluZy1jb2xvcicsXG5cdCdzdGF0dXMtYnVzeSc6ICdAZXJyb3ItY29sb3InLFxuXHQnc3RhdHVzLW9mZmxpbmUnOiAnQHRyYW5zcGFyZW50LWRhcmtlcidcbn07XG5cbi8vIEJ1bGstYWRkIHNldHRpbmdzIGZvciBjb2xvciBzY2hlbWVcbk9iamVjdC5rZXlzKG1ham9yQ29sb3JzKS5mb3JFYWNoKChrZXkpID0+IHtcblx0Y29uc3QgdmFsdWUgPSBtYWpvckNvbG9yc1trZXldO1xuXHRSb2NrZXRDaGF0LnRoZW1lLmFkZFB1YmxpY0NvbG9yKGtleSwgdmFsdWUsICdPbGQgQ29sb3JzJyk7XG59KTtcblxuT2JqZWN0LmtleXMobWlub3JDb2xvcnMpLmZvckVhY2goKGtleSkgPT4ge1xuXHRjb25zdCB2YWx1ZSA9IG1pbm9yQ29sb3JzW2tleV07XG5cdFJvY2tldENoYXQudGhlbWUuYWRkUHVibGljQ29sb3Ioa2V5LCB2YWx1ZSwgJ09sZCBDb2xvcnMgKG1pbm9yKScsICdleHByZXNzaW9uJyk7XG59KTtcblxuUm9ja2V0Q2hhdC50aGVtZS5hZGRQdWJsaWNGb250KCdib2R5LWZvbnQtZmFtaWx5JywgJy1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgUm9ib3RvLCBcXCdIZWx2ZXRpY2EgTmV1ZVxcJywgQXJpYWwsIHNhbnMtc2VyaWYsIFxcJ0FwcGxlIENvbG9yIEVtb2ppXFwnLCBcXCdTZWdvZSBVSVxcJywgXFwnU2Vnb2UgVUkgRW1vamlcXCcsIFxcJ1NlZ29lIFVJIFN5bWJvbFxcJywgXFwnTWVpcnlvIFVJXFwnJyk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCd0aGVtZS1jdXN0b20tY3NzJywgJycsIHtcblx0Z3JvdXA6ICdMYXlvdXQnLFxuXHR0eXBlOiAnY29kZScsXG5cdGNvZGU6ICd0ZXh0L2NzcycsXG5cdG11bHRpbGluZTogdHJ1ZSxcblx0c2VjdGlvbjogJ0N1c3RvbSBDU1MnLFxuXHRwdWJsaWM6IHRydWVcbn0pO1xuXG4iXX0=
