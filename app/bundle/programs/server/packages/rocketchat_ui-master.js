(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var ECMAScript = Package.ecmascript.ECMAScript;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var RocketChat = Package['rocketchat:lib'].RocketChat;
var Inject = Package['meteorhacks:inject-initial'].Inject;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var TAPi18next = Package['tap:i18n'].TAPi18next;
var TAPi18n = Package['tap:i18n'].TAPi18n;

/* Package-scope variables */
var DynamicCss;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:ui-master":{"server":{"inject.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_ui-master/server/inject.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 0);

const renderDynamicCssList = _.debounce(Meteor.bindEnvironment(() => {
	// const variables = RocketChat.models.Settings.findOne({_id:'theme-custom-variables'}, {fields: { value: 1}});
	const colors = RocketChat.models.Settings.find({
		_id: /theme-color-rc/i
	}, {
		fields: {
			value: 1,
			editor: 1
		}
	}).fetch().filter(color => color && color.value);

	if (!colors) {
		return;
	}

	const css = colors.map(({
		_id,
		value,
		editor
	}) => {
		if (editor === 'expression') {
			return `--${_id.replace('theme-color-', '')}: var(--${value});`;
		}

		return `--${_id.replace('theme-color-', '')}: ${value};`;
	}).join('\n');
	Inject.rawBody('dynamic-variables', `<style id='css-variables'> :root {${css}}</style>`);
}), 500);

renderDynamicCssList(); // RocketChat.models.Settings.find({_id:'theme-custom-variables'}, {fields: { value: 1}}).observe({
// 	changed: renderDynamicCssList
// });

RocketChat.models.Settings.find({
	_id: /theme-color-rc/i
}, {
	fields: {
		value: 1
	}
}).observe({
	changed: renderDynamicCssList
});
Inject.rawHead('dynamic', `<script>(${require('./dynamic-css.js').default.toString().replace(/\/\/.*?\n/g, '')})()</script>`);
Inject.rawHead('page-loading', `<style>${Assets.getText('public/loading.css')}</style>`);
Inject.rawBody('icons', Assets.getText('public/icons.svg'));
Inject.rawBody('page-loading-div', `
<div id="initial-page-loading" class="page-loading">
	<div class="loading-animation">
		<div class="bounce1"></div>
		<div class="bounce2"></div>
		<div class="bounce3"></div>
	</div>
</div>`);

if (process.env.DISABLE_ANIMATION || process.env.TEST_MODE === 'true') {
	Inject.rawHead('disable-animation', `
	<style>
		body, body * {
			animation: none !important;
			transition: none !important;
		}
	</style>
	<script>
		window.DISABLE_ANIMATION = true;
	</script>
	`);
}

RocketChat.settings.get('Assets_SvgFavicon_Enable', (key, value) => {
	const standardFavicons = `
		<link rel="icon" sizes="16x16" type="image/png" href="assets/favicon_16.png" />
		<link rel="icon" sizes="32x32" type="image/png" href="assets/favicon_32.png" />`;

	if (value) {
		Inject.rawHead(key, `${standardFavicons}
			<link rel="icon" sizes="any" type="image/svg+xml" href="assets/favicon.svg" />`);
	} else {
		Inject.rawHead(key, standardFavicons);
	}
});
RocketChat.settings.get('theme-color-sidebar-background', (key, value) => {
	Inject.rawHead(key, `<style>body { background-color: ${value};}</style>` + `<meta name="msapplication-TileColor" content="${value}" />` + `<meta name="theme-color" content="${value}" />`);
});
RocketChat.settings.get('Accounts_ForgetUserSessionOnWindowClose', (key, value) => {
	if (value) {
		Inject.rawModHtml(key, html => {
			const script = `
				<script>
					if (Meteor._localStorage._data === undefined && window.sessionStorage) {
						Meteor._localStorage = window.sessionStorage;
					}
				</script>
			`;
			return html.replace(/<\/body>/, `${script}\n</body>`);
		});
	} else {
		Inject.rawModHtml(key, html => {
			return html;
		});
	}
});
RocketChat.settings.get('Site_Name', (key, value = 'Rocket.Chat') => {
	Inject.rawHead(key, `<title>${value}</title>` + `<meta name="application-name" content="${value}">` + `<meta name="apple-mobile-web-app-title" content="${value}">`);
});
RocketChat.settings.get('Meta_language', (key, value = '') => {
	Inject.rawHead(key, `<meta http-equiv="content-language" content="${value}">` + `<meta name="language" content="${value}">`);
});
RocketChat.settings.get('Meta_robots', (key, value = '') => {
	Inject.rawHead(key, `<meta name="robots" content="${value}">`);
});
RocketChat.settings.get('Meta_msvalidate01', (key, value = '') => {
	Inject.rawHead(key, `<meta name="msvalidate.01" content="${value}">`);
});
RocketChat.settings.get('Meta_google-site-verification', (key, value = '') => {
	Inject.rawHead(key, `<meta name="google-site-verification" content="${value}" />`);
});
RocketChat.settings.get('Meta_fb_app_id', (key, value = '') => {
	Inject.rawHead(key, `<meta property="fb:app_id" content="${value}">`);
});
RocketChat.settings.get('Meta_custom', (key, value = '') => {
	Inject.rawHead(key, value);
});
Meteor.defer(() => {
	let baseUrl;

	if (__meteor_runtime_config__.ROOT_URL_PATH_PREFIX && __meteor_runtime_config__.ROOT_URL_PATH_PREFIX.trim() !== '') {
		baseUrl = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;
	} else {
		baseUrl = '/';
	}

	if (/\/$/.test(baseUrl) === false) {
		baseUrl += '/';
	}

	Inject.rawHead('base', `<base href="${baseUrl}">`);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"dynamic-css.js":function(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/rocketchat_ui-master/server/dynamic-css.js                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/* global DynamicCss */'use strict';

module.exportDefault(() => {
	const debounce = (func, wait, immediate) => {
		let timeout;
		return function (...args) {
			const later = () => {
				timeout = null;
				!immediate && func.apply(this, args);
			};

			const callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			callNow && func.apply(this, args);
		};
	};

	const cssVarPoly = {
		test() {
			return window.CSS && window.CSS.supports && window.CSS.supports('(--foo: red)');
		},

		init() {
			if (this.test()) {
				return;
			}

			console.time('cssVarPoly');
			cssVarPoly.ratifiedVars = {};
			cssVarPoly.varsByBlock = [];
			cssVarPoly.oldCSS = [];
			cssVarPoly.findCSS();
			cssVarPoly.updateCSS();
			console.timeEnd('cssVarPoly');
		},

		findCSS() {
			const styleBlocks = Array.prototype.concat.apply([], document.querySelectorAll('#css-variables, link[type="text/css"].__meteor-css__')); // we need to track the order of the style/link elements when we save off the CSS, set a counter

			let counter = 1; // loop through all CSS blocks looking for CSS variables being set

			styleBlocks.map(block => {
				// console.log(block.nodeName);
				if (block.nodeName === 'STYLE') {
					const theCSS = block.innerHTML;
					cssVarPoly.findSetters(theCSS, counter);
					cssVarPoly.oldCSS[counter++] = theCSS;
				} else if (block.nodeName === 'LINK') {
					const url = block.getAttribute('href');
					cssVarPoly.oldCSS[counter] = '';
					cssVarPoly.getLink(url, counter, function (counter, request) {
						cssVarPoly.findSetters(request.responseText, counter);
						cssVarPoly.oldCSS[counter++] = request.responseText;
						cssVarPoly.updateCSS();
					});
				}
			});
		},

		// find all the "--variable: value" matches in a provided block of CSS and add them to the master list
		findSetters(theCSS, counter) {
			// console.log(theCSS);
			cssVarPoly.varsByBlock[counter] = theCSS.match(/(--[^:; ]+:..*?;)/g);
		},

		// run through all the CSS blocks to update the variables and then inject on the page
		updateCSS: debounce(() => {
			// first lets loop through all the variables to make sure later vars trump earlier vars
			cssVarPoly.ratifySetters(cssVarPoly.varsByBlock); // loop through the css blocks (styles and links)

			cssVarPoly.oldCSS.filter(e => e).forEach((css, id) => {
				const newCSS = cssVarPoly.replaceGetters(css, cssVarPoly.ratifiedVars);
				const el = document.querySelector(`#inserted${id}`);

				if (el) {
					// console.log("updating")
					el.innerHTML = newCSS;
				} else {
					// console.log("adding");
					const style = document.createElement('style');
					style.type = 'text/css';
					style.innerHTML = newCSS;
					style.classList.add('inserted');
					style.id = `inserted${id}`;
					document.getElementsByTagName('head')[0].appendChild(style);
				}
			});
		}, 100),

		// parse a provided block of CSS looking for a provided list of variables and replace the --var-name with the correct value
		replaceGetters(oldCSS, varList) {
			return oldCSS.replace(/var\((--.*?)\)/gm, (all, variable) => varList[variable]);
		},

		// determine the css variable name value pair and track the latest
		ratifySetters(varList) {
			// loop through each block in order, to maintain order specificity
			varList.filter(curVars => curVars).forEach(curVars => {
				// const curVars = varList[curBlock] || [];
				curVars.forEach(function (theVar) {
					// console.log(theVar);
					// split on the name value pair separator
					const matches = theVar.split(/:\s*/); // console.log(matches);
					// put it in an object based on the varName. Each time we do this it will override a previous use and so will always have the last set be the winner
					// 0 = the name, 1 = the value, strip off the ; if it is there

					cssVarPoly.ratifiedVars[matches[0]] = matches[1].replace(/;/, '');
				});
			});
			Object.keys(cssVarPoly.ratifiedVars).filter(key => {
				return cssVarPoly.ratifiedVars[key].indexOf('var') > -1;
			}).forEach(key => {
				cssVarPoly.ratifiedVars[key] = cssVarPoly.ratifiedVars[key].replace(/var\((--.*?)\)/gm, function (all, variable) {
					return cssVarPoly.ratifiedVars[variable];
				});
			});
		},

		// get the CSS file (same domain for now)
		getLink(url, counter, success) {
			const request = new XMLHttpRequest();
			request.open('GET', url, true);
			request.overrideMimeType('text/css;');

			request.onload = function () {
				if (request.status >= 200 && request.status < 400) {
					// Success!
					// console.log(request.responseText);
					if (typeof success === 'function') {
						success(counter, request);
					}
				} else {
					// We reached our target server, but it returned an error
					console.warn('an error was returned from:', url);
				}
			};

			request.onerror = function () {
				// There was a connection error of some sort
				console.warn('we could not get anything from:', url);
			};

			request.send();
		}

	};
	const stateCheck = setInterval(() => {
		if (document.readyState === 'complete' && typeof Meteor !== 'undefined') {
			clearInterval(stateCheck); // document ready

			cssVarPoly.init();
		}
	}, 100);
	DynamicCss = typeof DynamicCss !== 'undefined' ? DynamicCss : {};

	DynamicCss.test = () => window.CSS && window.CSS.supports && window.CSS.supports('(--foo: red)');

	DynamicCss.run = debounce((replace = false) => {
		if (replace) {
			// const variables = RocketChat.models.Settings.findOne({_id:'theme-custom-variables'}, {fields: { value: 1}});
			const colors = RocketChat.settings.collection.find({
				_id: /theme-color-rc/i
			}, {
				fields: {
					value: 1,
					editor: 1
				}
			}).fetch().filter(color => color && color.value);

			if (!colors) {
				return;
			}

			const css = colors.map(({
				_id,
				value,
				editor
			}) => {
				if (editor === 'expression') {
					return `--${_id.replace('theme-color-', '')}: var(--${value});`;
				}

				return `--${_id.replace('theme-color-', '')}: ${value};`;
			}).join('\n');
			document.querySelector('#css-variables').innerHTML = `:root {${css}}`;
		}

		cssVarPoly.init();
	}, 1000);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:ui-master/server/inject.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:ui-master'] = {};

})();

//# sourceURL=meteor://💻app/packages/rocketchat_ui-master.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp1aS1tYXN0ZXIvc2VydmVyL2luamVjdC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDp1aS1tYXN0ZXIvc2VydmVyL2R5bmFtaWMtY3NzLmpzIl0sIm5hbWVzIjpbIl8iLCJtb2R1bGUiLCJ3YXRjaCIsInJlcXVpcmUiLCJkZWZhdWx0IiwidiIsInJlbmRlckR5bmFtaWNDc3NMaXN0IiwiZGVib3VuY2UiLCJNZXRlb3IiLCJiaW5kRW52aXJvbm1lbnQiLCJjb2xvcnMiLCJSb2NrZXRDaGF0IiwibW9kZWxzIiwiU2V0dGluZ3MiLCJmaW5kIiwiX2lkIiwiZmllbGRzIiwidmFsdWUiLCJlZGl0b3IiLCJmZXRjaCIsImZpbHRlciIsImNvbG9yIiwiY3NzIiwibWFwIiwicmVwbGFjZSIsImpvaW4iLCJJbmplY3QiLCJyYXdCb2R5Iiwib2JzZXJ2ZSIsImNoYW5nZWQiLCJyYXdIZWFkIiwidG9TdHJpbmciLCJBc3NldHMiLCJnZXRUZXh0IiwicHJvY2VzcyIsImVudiIsIkRJU0FCTEVfQU5JTUFUSU9OIiwiVEVTVF9NT0RFIiwic2V0dGluZ3MiLCJnZXQiLCJrZXkiLCJzdGFuZGFyZEZhdmljb25zIiwicmF3TW9kSHRtbCIsImh0bWwiLCJzY3JpcHQiLCJkZWZlciIsImJhc2VVcmwiLCJfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIiwiUk9PVF9VUkxfUEFUSF9QUkVGSVgiLCJ0cmltIiwidGVzdCIsImV4cG9ydERlZmF1bHQiLCJmdW5jIiwid2FpdCIsImltbWVkaWF0ZSIsInRpbWVvdXQiLCJhcmdzIiwibGF0ZXIiLCJhcHBseSIsImNhbGxOb3ciLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiY3NzVmFyUG9seSIsIndpbmRvdyIsIkNTUyIsInN1cHBvcnRzIiwiaW5pdCIsImNvbnNvbGUiLCJ0aW1lIiwicmF0aWZpZWRWYXJzIiwidmFyc0J5QmxvY2siLCJvbGRDU1MiLCJmaW5kQ1NTIiwidXBkYXRlQ1NTIiwidGltZUVuZCIsInN0eWxlQmxvY2tzIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJjb25jYXQiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJjb3VudGVyIiwiYmxvY2siLCJub2RlTmFtZSIsInRoZUNTUyIsImlubmVySFRNTCIsImZpbmRTZXR0ZXJzIiwidXJsIiwiZ2V0QXR0cmlidXRlIiwiZ2V0TGluayIsInJlcXVlc3QiLCJyZXNwb25zZVRleHQiLCJtYXRjaCIsInJhdGlmeVNldHRlcnMiLCJlIiwiZm9yRWFjaCIsImlkIiwibmV3Q1NTIiwicmVwbGFjZUdldHRlcnMiLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJzdHlsZSIsImNyZWF0ZUVsZW1lbnQiLCJ0eXBlIiwiY2xhc3NMaXN0IiwiYWRkIiwiZ2V0RWxlbWVudHNCeVRhZ05hbWUiLCJhcHBlbmRDaGlsZCIsInZhckxpc3QiLCJhbGwiLCJ2YXJpYWJsZSIsImN1clZhcnMiLCJ0aGVWYXIiLCJtYXRjaGVzIiwic3BsaXQiLCJPYmplY3QiLCJrZXlzIiwiaW5kZXhPZiIsInN1Y2Nlc3MiLCJYTUxIdHRwUmVxdWVzdCIsIm9wZW4iLCJvdmVycmlkZU1pbWVUeXBlIiwib25sb2FkIiwic3RhdHVzIiwid2FybiIsIm9uZXJyb3IiLCJzZW5kIiwic3RhdGVDaGVjayIsInNldEludGVydmFsIiwicmVhZHlTdGF0ZSIsImNsZWFySW50ZXJ2YWwiLCJEeW5hbWljQ3NzIiwicnVuIiwiY29sbGVjdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxDQUFKOztBQUFNQyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsWUFBUixDQUFiLEVBQW1DO0FBQUNDLFNBQVFDLENBQVIsRUFBVTtBQUFDTCxNQUFFSyxDQUFGO0FBQUk7O0FBQWhCLENBQW5DLEVBQXFELENBQXJEOztBQUdOLE1BQU1DLHVCQUF1Qk4sRUFBRU8sUUFBRixDQUFXQyxPQUFPQyxlQUFQ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QztBQUFDUixPQUFEO0FBQU1FLFNBQU47QUFBYUM7QUFBYixJQUFELEtBQTBCO0FBQ2hELFFBQUlBLFdBQVcsWUFBZixFQUE2QjtBQUM1QixZQUFRLEtBQUtILElBQUlTLE9BQUosQ0FBWSxjQUFaLEVBQTRCLEVBQTVCLENBQWlDLFdBQVdQLEtBQU8sSUFBaEU7QUFDQTs7QUFDRCxXQUFRLEtBQUtGLElBQUlTLE9BQUosQ0FBWSxjQUFaLEVBQTRCLEVBQTVCLENBQWlDLEtBQUtQLEtBQU8sR0FBMUQ7QUFDQSxJQUxXLEVBS1RRLElBTFMsQ0FLSixJQUxJLENBQVo7QUFNQXNELFlBQVNxQixhQUFULENBQXVCLGdCQUF2QixFQUF5Q2YsU0FBekMsR0FBc0QsVUFBVS9ELEdBQUssR0FBckU7QUFDQTs7QUFDRHdDLGFBQVdJLElBQVg7QUFDQSxFQWpCZ0IsRUFpQmQsSUFqQmMsQ0FBakI7QUFrQkEsQ0EzS0QsRSIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF91aS1tYXN0ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWxzIEluamVjdCAqL1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IHJlbmRlckR5bmFtaWNDc3NMaXN0ID0gXy5kZWJvdW5jZShNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcblx0Ly8gY29uc3QgdmFyaWFibGVzID0gUm9ja2V0Q2hhdC5tb2RlbHMuU2V0dGluZ3MuZmluZE9uZSh7X2lkOid0aGVtZS1jdXN0b20tdmFyaWFibGVzJ30sIHtmaWVsZHM6IHsgdmFsdWU6IDF9fSk7XG5cdGNvbnN0IGNvbG9ycyA9IFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmQoe19pZDovdGhlbWUtY29sb3ItcmMvaX0sIHtmaWVsZHM6IHsgdmFsdWU6IDEsIGVkaXRvcjogMX19KS5mZXRjaCgpLmZpbHRlcihjb2xvciA9PiBjb2xvciAmJiBjb2xvci52YWx1ZSk7XG5cblx0aWYgKCFjb2xvcnMpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgY3NzID0gY29sb3JzLm1hcCgoe19pZCwgdmFsdWUsIGVkaXRvcn0pID0+IHtcblx0XHRpZiAoZWRpdG9yID09PSAnZXhwcmVzc2lvbicpIHtcblx0XHRcdHJldHVybiBgLS0keyBfaWQucmVwbGFjZSgndGhlbWUtY29sb3ItJywgJycpIH06IHZhcigtLSR7IHZhbHVlIH0pO2A7XG5cdFx0fVxuXHRcdHJldHVybiBgLS0keyBfaWQucmVwbGFjZSgndGhlbWUtY29sb3ItJywgJycpIH06ICR7IHZhbHVlIH07YDtcblx0fSkuam9pbignXFxuJyk7XG5cdEluamVjdC5yYXdCb2R5KCdkeW5hbWljLXZhcmlhYmxlcycsIGA8c3R5bGUgaWQ9J2Nzcy12YXJpYWJsZXMnPiA6cm9vdCB7JHsgY3NzIH19PC9zdHlsZT5gKTtcbn0pLCA1MDApO1xuXG5yZW5kZXJEeW5hbWljQ3NzTGlzdCgpO1xuXG4vLyBSb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kKHtfaWQ6J3RoZW1lLWN1c3RvbS12YXJpYWJsZXMnfSwge2ZpZWxkczogeyB2YWx1ZTogMX19KS5vYnNlcnZlKHtcbi8vIFx0Y2hhbmdlZDogcmVuZGVyRHluYW1pY0Nzc0xpc3Rcbi8vIH0pO1xuXG5Sb2NrZXRDaGF0Lm1vZGVscy5TZXR0aW5ncy5maW5kKHtfaWQ6L3RoZW1lLWNvbG9yLXJjL2l9LCB7ZmllbGRzOiB7IHZhbHVlOiAxfX0pLm9ic2VydmUoe1xuXHRjaGFuZ2VkOiByZW5kZXJEeW5hbWljQ3NzTGlzdFxufSk7XG5cbkluamVjdC5yYXdIZWFkKCdkeW5hbWljJywgYDxzY3JpcHQ+KCR7IHJlcXVpcmUoJy4vZHluYW1pYy1jc3MuanMnKS5kZWZhdWx0LnRvU3RyaW5nKCkucmVwbGFjZSgvXFwvXFwvLio/XFxuL2csICcnKSB9KSgpPC9zY3JpcHQ+YCk7XG5cbkluamVjdC5yYXdIZWFkKCdwYWdlLWxvYWRpbmcnLCBgPHN0eWxlPiR7IEFzc2V0cy5nZXRUZXh0KCdwdWJsaWMvbG9hZGluZy5jc3MnKSB9PC9zdHlsZT5gKTtcblxuSW5qZWN0LnJhd0JvZHkoJ2ljb25zJywgQXNzZXRzLmdldFRleHQoJ3B1YmxpYy9pY29ucy5zdmcnKSk7XG5cbkluamVjdC5yYXdCb2R5KCdwYWdlLWxvYWRpbmctZGl2JywgYFxuPGRpdiBpZD1cImluaXRpYWwtcGFnZS1sb2FkaW5nXCIgY2xhc3M9XCJwYWdlLWxvYWRpbmdcIj5cblx0PGRpdiBjbGFzcz1cImxvYWRpbmctYW5pbWF0aW9uXCI+XG5cdFx0PGRpdiBjbGFzcz1cImJvdW5jZTFcIj48L2Rpdj5cblx0XHQ8ZGl2IGNsYXNzPVwiYm91bmNlMlwiPjwvZGl2PlxuXHRcdDxkaXYgY2xhc3M9XCJib3VuY2UzXCI+PC9kaXY+XG5cdDwvZGl2PlxuPC9kaXY+YCk7XG5cbmlmIChwcm9jZXNzLmVudi5ESVNBQkxFX0FOSU1BVElPTiB8fCBwcm9jZXNzLmVudi5URVNUX01PREUgPT09ICd0cnVlJykge1xuXHRJbmplY3QucmF3SGVhZCgnZGlzYWJsZS1hbmltYXRpb24nLCBgXG5cdDxzdHlsZT5cblx0XHRib2R5LCBib2R5ICoge1xuXHRcdFx0YW5pbWF0aW9uOiBub25lICFpbXBvcnRhbnQ7XG5cdFx0XHR0cmFuc2l0aW9uOiBub25lICFpbXBvcnRhbnQ7XG5cdFx0fVxuXHQ8L3N0eWxlPlxuXHQ8c2NyaXB0PlxuXHRcdHdpbmRvdy5ESVNBQkxFX0FOSU1BVElPTiA9IHRydWU7XG5cdDwvc2NyaXB0PlxuXHRgKTtcbn1cblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0Fzc2V0c19TdmdGYXZpY29uX0VuYWJsZScsIChrZXksIHZhbHVlKSA9PiB7XG5cdGNvbnN0IHN0YW5kYXJkRmF2aWNvbnMgPSBgXG5cdFx0PGxpbmsgcmVsPVwiaWNvblwiIHNpemVzPVwiMTZ4MTZcIiB0eXBlPVwiaW1hZ2UvcG5nXCIgaHJlZj1cImFzc2V0cy9mYXZpY29uXzE2LnBuZ1wiIC8+XG5cdFx0PGxpbmsgcmVsPVwiaWNvblwiIHNpemVzPVwiMzJ4MzJcIiB0eXBlPVwiaW1hZ2UvcG5nXCIgaHJlZj1cImFzc2V0cy9mYXZpY29uXzMyLnBuZ1wiIC8+YDtcblxuXHRpZiAodmFsdWUpIHtcblx0XHRJbmplY3QucmF3SGVhZChrZXksXG5cdFx0XHRgJHsgc3RhbmRhcmRGYXZpY29ucyB9XG5cdFx0XHQ8bGluayByZWw9XCJpY29uXCIgc2l6ZXM9XCJhbnlcIiB0eXBlPVwiaW1hZ2Uvc3ZnK3htbFwiIGhyZWY9XCJhc3NldHMvZmF2aWNvbi5zdmdcIiAvPmApO1xuXHR9IGVsc2Uge1xuXHRcdEluamVjdC5yYXdIZWFkKGtleSwgc3RhbmRhcmRGYXZpY29ucyk7XG5cdH1cbn0pO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgndGhlbWUtY29sb3Itc2lkZWJhci1iYWNrZ3JvdW5kJywgKGtleSwgdmFsdWUpID0+IHtcblx0SW5qZWN0LnJhd0hlYWQoa2V5LCBgPHN0eWxlPmJvZHkgeyBiYWNrZ3JvdW5kLWNvbG9yOiAkeyB2YWx1ZSB9O308L3N0eWxlPmAgK1xuXHRcdFx0XHRcdFx0YDxtZXRhIG5hbWU9XCJtc2FwcGxpY2F0aW9uLVRpbGVDb2xvclwiIGNvbnRlbnQ9XCIkeyB2YWx1ZSB9XCIgLz5gICtcblx0XHRcdFx0XHRcdGA8bWV0YSBuYW1lPVwidGhlbWUtY29sb3JcIiBjb250ZW50PVwiJHsgdmFsdWUgfVwiIC8+YCk7XG59KTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ0FjY291bnRzX0ZvcmdldFVzZXJTZXNzaW9uT25XaW5kb3dDbG9zZScsIChrZXksIHZhbHVlKSA9PiB7XG5cdGlmICh2YWx1ZSkge1xuXHRcdEluamVjdC5yYXdNb2RIdG1sKGtleSwgKGh0bWwpID0+IHtcblx0XHRcdGNvbnN0IHNjcmlwdCA9IGBcblx0XHRcdFx0PHNjcmlwdD5cblx0XHRcdFx0XHRpZiAoTWV0ZW9yLl9sb2NhbFN0b3JhZ2UuX2RhdGEgPT09IHVuZGVmaW5lZCAmJiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UpIHtcblx0XHRcdFx0XHRcdE1ldGVvci5fbG9jYWxTdG9yYWdlID0gd2luZG93LnNlc3Npb25TdG9yYWdlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0PC9zY3JpcHQ+XG5cdFx0XHRgO1xuXHRcdFx0cmV0dXJuIGh0bWwucmVwbGFjZSgvPFxcL2JvZHk+LywgYCR7IHNjcmlwdCB9XFxuPC9ib2R5PmApO1xuXHRcdH0pO1xuXHR9IGVsc2Uge1xuXHRcdEluamVjdC5yYXdNb2RIdG1sKGtleSwgKGh0bWwpID0+IHtcblx0XHRcdHJldHVybiBodG1sO1xuXHRcdH0pO1xuXHR9XG59KTtcblxuUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ1NpdGVfTmFtZScsIChrZXksIHZhbHVlID0gJ1JvY2tldC5DaGF0JykgPT4ge1xuXHRJbmplY3QucmF3SGVhZChrZXksXG5cdFx0YDx0aXRsZT4keyB2YWx1ZSB9PC90aXRsZT5gICtcblx0XHRgPG1ldGEgbmFtZT1cImFwcGxpY2F0aW9uLW5hbWVcIiBjb250ZW50PVwiJHsgdmFsdWUgfVwiPmAgK1xuXHRcdGA8bWV0YSBuYW1lPVwiYXBwbGUtbW9iaWxlLXdlYi1hcHAtdGl0bGVcIiBjb250ZW50PVwiJHsgdmFsdWUgfVwiPmApO1xufSk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXRhX2xhbmd1YWdlJywgKGtleSwgdmFsdWUgPSAnJykgPT4ge1xuXHRJbmplY3QucmF3SGVhZChrZXksXG5cdFx0YDxtZXRhIGh0dHAtZXF1aXY9XCJjb250ZW50LWxhbmd1YWdlXCIgY29udGVudD1cIiR7IHZhbHVlIH1cIj5gICtcblx0XHRgPG1ldGEgbmFtZT1cImxhbmd1YWdlXCIgY29udGVudD1cIiR7IHZhbHVlIH1cIj5gKTtcbn0pO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWV0YV9yb2JvdHMnLCAoa2V5LCB2YWx1ZSA9ICcnKSA9PiB7XG5cdEluamVjdC5yYXdIZWFkKGtleSwgYDxtZXRhIG5hbWU9XCJyb2JvdHNcIiBjb250ZW50PVwiJHsgdmFsdWUgfVwiPmApO1xufSk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXRhX21zdmFsaWRhdGUwMScsIChrZXksIHZhbHVlID0gJycpID0+IHtcblx0SW5qZWN0LnJhd0hlYWQoa2V5LCBgPG1ldGEgbmFtZT1cIm1zdmFsaWRhdGUuMDFcIiBjb250ZW50PVwiJHsgdmFsdWUgfVwiPmApO1xufSk7XG5cblJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNZXRhX2dvb2dsZS1zaXRlLXZlcmlmaWNhdGlvbicsIChrZXksIHZhbHVlID0gJycpID0+IHtcblx0SW5qZWN0LnJhd0hlYWQoa2V5LCBgPG1ldGEgbmFtZT1cImdvb2dsZS1zaXRlLXZlcmlmaWNhdGlvblwiIGNvbnRlbnQ9XCIkeyB2YWx1ZSB9XCIgLz5gKTtcbn0pO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWV0YV9mYl9hcHBfaWQnLCAoa2V5LCB2YWx1ZSA9ICcnKSA9PiB7XG5cdEluamVjdC5yYXdIZWFkKGtleSwgYDxtZXRhIHByb3BlcnR5PVwiZmI6YXBwX2lkXCIgY29udGVudD1cIiR7IHZhbHVlIH1cIj5gKTtcbn0pO1xuXG5Sb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWV0YV9jdXN0b20nLCAoa2V5LCB2YWx1ZSA9ICcnKSA9PiB7XG5cdEluamVjdC5yYXdIZWFkKGtleSwgdmFsdWUpO1xufSk7XG5cbk1ldGVvci5kZWZlcigoKSA9PiB7XG5cdGxldCBiYXNlVXJsO1xuXHRpZiAoX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCAmJiBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYLnRyaW0oKSAhPT0gJycpIHtcblx0XHRiYXNlVXJsID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWDtcblx0fSBlbHNlIHtcblx0XHRiYXNlVXJsID0gJy8nO1xuXHR9XG5cdGlmICgvXFwvJC8udGVzdChiYXNlVXJsKSA9PT0gZmFsc2UpIHtcblx0XHRiYXNlVXJsICs9ICcvJztcblx0fVxuXHRJbmplY3QucmF3SGVhZCgnYmFzZScsIGA8YmFzZSBocmVmPVwiJHsgYmFzZVVybCB9XCI+YCk7XG59KTtcbiIsIi8qIGdsb2JhbCBEeW5hbWljQ3NzICovXG5cbid1c2Ugc3RyaWN0JztcbmV4cG9ydCBkZWZhdWx0ICgpID0+IHtcblxuXHRjb25zdCBkZWJvdW5jZSA9IChmdW5jLCB3YWl0LCBpbW1lZGlhdGUpID0+IHtcblx0XHRsZXQgdGltZW91dDtcblx0XHRyZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuXHRcdFx0Y29uc3QgbGF0ZXIgPSAoKSA9PiB7XG5cdFx0XHRcdHRpbWVvdXQgPSBudWxsO1xuXHRcdFx0XHQhaW1tZWRpYXRlICYmIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcblx0XHRcdGNsZWFyVGltZW91dCh0aW1lb3V0KTtcblx0XHRcdHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcblx0XHRcdGNhbGxOb3cgJiYgZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcblx0XHR9O1xuXHR9O1xuXHRjb25zdCBjc3NWYXJQb2x5ID0ge1xuXHRcdHRlc3QoKSB7IHJldHVybiB3aW5kb3cuQ1NTICYmIHdpbmRvdy5DU1Muc3VwcG9ydHMgJiYgd2luZG93LkNTUy5zdXBwb3J0cygnKC0tZm9vOiByZWQpJyk7IH0sXG5cdFx0aW5pdCgpIHtcblx0XHRcdGlmICh0aGlzLnRlc3QoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zb2xlLnRpbWUoJ2Nzc1ZhclBvbHknKTtcblx0XHRcdGNzc1ZhclBvbHkucmF0aWZpZWRWYXJzID0ge307XG5cdFx0XHRjc3NWYXJQb2x5LnZhcnNCeUJsb2NrID0gW107XG5cdFx0XHRjc3NWYXJQb2x5Lm9sZENTUyA9IFtdO1xuXG5cdFx0XHRjc3NWYXJQb2x5LmZpbmRDU1MoKTtcblx0XHRcdGNzc1ZhclBvbHkudXBkYXRlQ1NTKCk7XG5cdFx0XHRjb25zb2xlLnRpbWVFbmQoJ2Nzc1ZhclBvbHknKTtcblx0XHR9LFxuXHRcdGZpbmRDU1MoKSB7XG5cdFx0XHRjb25zdCBzdHlsZUJsb2NrcyA9IEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNjc3MtdmFyaWFibGVzLCBsaW5rW3R5cGU9XCJ0ZXh0L2Nzc1wiXS5fX21ldGVvci1jc3NfXycpKTtcblxuXHRcdFx0Ly8gd2UgbmVlZCB0byB0cmFjayB0aGUgb3JkZXIgb2YgdGhlIHN0eWxlL2xpbmsgZWxlbWVudHMgd2hlbiB3ZSBzYXZlIG9mZiB0aGUgQ1NTLCBzZXQgYSBjb3VudGVyXG5cdFx0XHRsZXQgY291bnRlciA9IDE7XG5cblx0XHRcdC8vIGxvb3AgdGhyb3VnaCBhbGwgQ1NTIGJsb2NrcyBsb29raW5nIGZvciBDU1MgdmFyaWFibGVzIGJlaW5nIHNldFxuXHRcdFx0c3R5bGVCbG9ja3MubWFwKGJsb2NrID0+IHtcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYmxvY2subm9kZU5hbWUpO1xuXHRcdFx0XHRpZiAoYmxvY2subm9kZU5hbWUgPT09ICdTVFlMRScpIHtcblx0XHRcdFx0XHRjb25zdCB0aGVDU1MgPSBibG9jay5pbm5lckhUTUw7XG5cdFx0XHRcdFx0Y3NzVmFyUG9seS5maW5kU2V0dGVycyh0aGVDU1MsIGNvdW50ZXIpO1xuXHRcdFx0XHRcdGNzc1ZhclBvbHkub2xkQ1NTW2NvdW50ZXIrK10gPSB0aGVDU1M7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYmxvY2subm9kZU5hbWUgPT09ICdMSU5LJykge1xuXHRcdFx0XHRcdGNvbnN0IHVybCA9IGJsb2NrLmdldEF0dHJpYnV0ZSgnaHJlZicpO1xuXHRcdFx0XHRcdGNzc1ZhclBvbHkub2xkQ1NTW2NvdW50ZXJdID0gJyc7XG5cdFx0XHRcdFx0Y3NzVmFyUG9seS5nZXRMaW5rKHVybCwgY291bnRlciwgZnVuY3Rpb24oY291bnRlciwgcmVxdWVzdCkge1xuXHRcdFx0XHRcdFx0Y3NzVmFyUG9seS5maW5kU2V0dGVycyhyZXF1ZXN0LnJlc3BvbnNlVGV4dCwgY291bnRlcik7XG5cdFx0XHRcdFx0XHRjc3NWYXJQb2x5Lm9sZENTU1tjb3VudGVyKytdID0gcmVxdWVzdC5yZXNwb25zZVRleHQ7XG5cdFx0XHRcdFx0XHRjc3NWYXJQb2x5LnVwZGF0ZUNTUygpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Ly8gZmluZCBhbGwgdGhlIFwiLS12YXJpYWJsZTogdmFsdWVcIiBtYXRjaGVzIGluIGEgcHJvdmlkZWQgYmxvY2sgb2YgQ1NTIGFuZCBhZGQgdGhlbSB0byB0aGUgbWFzdGVyIGxpc3Rcblx0XHRmaW5kU2V0dGVycyh0aGVDU1MsIGNvdW50ZXIpIHtcblx0XHRcdC8vIGNvbnNvbGUubG9nKHRoZUNTUyk7XG5cdFx0XHRjc3NWYXJQb2x5LnZhcnNCeUJsb2NrW2NvdW50ZXJdID0gdGhlQ1NTLm1hdGNoKC8oLS1bXjo7IF0rOi4uKj87KS9nKTtcblx0XHR9LFxuXG5cdFx0Ly8gcnVuIHRocm91Z2ggYWxsIHRoZSBDU1MgYmxvY2tzIHRvIHVwZGF0ZSB0aGUgdmFyaWFibGVzIGFuZCB0aGVuIGluamVjdCBvbiB0aGUgcGFnZVxuXHRcdHVwZGF0ZUNTUzogZGVib3VuY2UoKCkgPT4ge1xuXHRcdFx0Ly8gZmlyc3QgbGV0cyBsb29wIHRocm91Z2ggYWxsIHRoZSB2YXJpYWJsZXMgdG8gbWFrZSBzdXJlIGxhdGVyIHZhcnMgdHJ1bXAgZWFybGllciB2YXJzXG5cdFx0XHRjc3NWYXJQb2x5LnJhdGlmeVNldHRlcnMoY3NzVmFyUG9seS52YXJzQnlCbG9jayk7XG5cblx0XHRcdC8vIGxvb3AgdGhyb3VnaCB0aGUgY3NzIGJsb2NrcyAoc3R5bGVzIGFuZCBsaW5rcylcblx0XHRcdGNzc1ZhclBvbHkub2xkQ1NTLmZpbHRlcihlID0+IGUpLmZvckVhY2goKGNzcywgaWQpID0+IHtcblx0XHRcdFx0Y29uc3QgbmV3Q1NTID0gY3NzVmFyUG9seS5yZXBsYWNlR2V0dGVycyhjc3MsIGNzc1ZhclBvbHkucmF0aWZpZWRWYXJzKTtcblx0XHRcdFx0Y29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAjaW5zZXJ0ZWQkeyBpZCB9YCk7XG5cdFx0XHRcdGlmIChlbCkge1xuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKFwidXBkYXRpbmdcIilcblx0XHRcdFx0XHRlbC5pbm5lckhUTUwgPSBuZXdDU1M7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coXCJhZGRpbmdcIik7XG5cdFx0XHRcdFx0Y29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuXHRcdFx0XHRcdHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO1xuXHRcdFx0XHRcdHN0eWxlLmlubmVySFRNTCA9IG5ld0NTUztcblx0XHRcdFx0XHRzdHlsZS5jbGFzc0xpc3QuYWRkKCdpbnNlcnRlZCcpO1xuXHRcdFx0XHRcdHN0eWxlLmlkID0gYGluc2VydGVkJHsgaWQgfWA7XG5cdFx0XHRcdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXS5hcHBlbmRDaGlsZChzdHlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sIDEwMCksXG5cblx0XHQvLyBwYXJzZSBhIHByb3ZpZGVkIGJsb2NrIG9mIENTUyBsb29raW5nIGZvciBhIHByb3ZpZGVkIGxpc3Qgb2YgdmFyaWFibGVzIGFuZCByZXBsYWNlIHRoZSAtLXZhci1uYW1lIHdpdGggdGhlIGNvcnJlY3QgdmFsdWVcblx0XHRyZXBsYWNlR2V0dGVycyhvbGRDU1MsIHZhckxpc3QpIHtcblx0XHRcdHJldHVybiBvbGRDU1MucmVwbGFjZSgvdmFyXFwoKC0tLio/KVxcKS9nbSwgKGFsbCwgdmFyaWFibGUpID0+IHZhckxpc3RbdmFyaWFibGVdKTtcblx0XHR9LFxuXG5cdFx0Ly8gZGV0ZXJtaW5lIHRoZSBjc3MgdmFyaWFibGUgbmFtZSB2YWx1ZSBwYWlyIGFuZCB0cmFjayB0aGUgbGF0ZXN0XG5cdFx0cmF0aWZ5U2V0dGVycyh2YXJMaXN0KSB7XG5cdFx0XHQvLyBsb29wIHRocm91Z2ggZWFjaCBibG9jayBpbiBvcmRlciwgdG8gbWFpbnRhaW4gb3JkZXIgc3BlY2lmaWNpdHlcblx0XHRcdHZhckxpc3QuZmlsdGVyKGN1clZhcnMgPT4gY3VyVmFycykuZm9yRWFjaChjdXJWYXJzID0+IHtcblx0XHRcdFx0Ly8gY29uc3QgY3VyVmFycyA9IHZhckxpc3RbY3VyQmxvY2tdIHx8IFtdO1xuXHRcdFx0XHRjdXJWYXJzLmZvckVhY2goZnVuY3Rpb24odGhlVmFyKSB7XG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2codGhlVmFyKTtcblx0XHRcdFx0XHQvLyBzcGxpdCBvbiB0aGUgbmFtZSB2YWx1ZSBwYWlyIHNlcGFyYXRvclxuXHRcdFx0XHRcdGNvbnN0IG1hdGNoZXMgPSB0aGVWYXIuc3BsaXQoLzpcXHMqLyk7XG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2cobWF0Y2hlcyk7XG5cdFx0XHRcdFx0Ly8gcHV0IGl0IGluIGFuIG9iamVjdCBiYXNlZCBvbiB0aGUgdmFyTmFtZS4gRWFjaCB0aW1lIHdlIGRvIHRoaXMgaXQgd2lsbCBvdmVycmlkZSBhIHByZXZpb3VzIHVzZSBhbmQgc28gd2lsbCBhbHdheXMgaGF2ZSB0aGUgbGFzdCBzZXQgYmUgdGhlIHdpbm5lclxuXHRcdFx0XHRcdC8vIDAgPSB0aGUgbmFtZSwgMSA9IHRoZSB2YWx1ZSwgc3RyaXAgb2ZmIHRoZSA7IGlmIGl0IGlzIHRoZXJlXG5cdFx0XHRcdFx0Y3NzVmFyUG9seS5yYXRpZmllZFZhcnNbbWF0Y2hlc1swXV0gPSBtYXRjaGVzWzFdLnJlcGxhY2UoLzsvLCAnJyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRPYmplY3Qua2V5cyhjc3NWYXJQb2x5LnJhdGlmaWVkVmFycykuZmlsdGVyKGtleSA9PiB7XG5cdFx0XHRcdHJldHVybiBjc3NWYXJQb2x5LnJhdGlmaWVkVmFyc1trZXldLmluZGV4T2YoJ3ZhcicpID4gLTE7XG5cdFx0XHR9KS5mb3JFYWNoKGtleSA9PiB7XG5cdFx0XHRcdGNzc1ZhclBvbHkucmF0aWZpZWRWYXJzW2tleV0gPSBjc3NWYXJQb2x5LnJhdGlmaWVkVmFyc1trZXldLnJlcGxhY2UoL3ZhclxcKCgtLS4qPylcXCkvZ20sIGZ1bmN0aW9uKGFsbCwgdmFyaWFibGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gY3NzVmFyUG9seS5yYXRpZmllZFZhcnNbdmFyaWFibGVdO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0Ly8gZ2V0IHRoZSBDU1MgZmlsZSAoc2FtZSBkb21haW4gZm9yIG5vdylcblx0XHRnZXRMaW5rKHVybCwgY291bnRlciwgc3VjY2Vzcykge1xuXHRcdFx0Y29uc3QgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0cmVxdWVzdC5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXHRcdFx0cmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L2NzczsnKTtcblx0XHRcdHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmIChyZXF1ZXN0LnN0YXR1cyA+PSAyMDAgJiYgcmVxdWVzdC5zdGF0dXMgPCA0MDApIHtcblx0XHRcdFx0XHQvLyBTdWNjZXNzIVxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHJlcXVlc3QucmVzcG9uc2VUZXh0KTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIHN1Y2Nlc3MgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdHN1Y2Nlc3MoY291bnRlciwgcmVxdWVzdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFdlIHJlYWNoZWQgb3VyIHRhcmdldCBzZXJ2ZXIsIGJ1dCBpdCByZXR1cm5lZCBhbiBlcnJvclxuXHRcdFx0XHRcdGNvbnNvbGUud2FybignYW4gZXJyb3Igd2FzIHJldHVybmVkIGZyb206JywgdXJsKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0cmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIFRoZXJlIHdhcyBhIGNvbm5lY3Rpb24gZXJyb3Igb2Ygc29tZSBzb3J0XG5cdFx0XHRcdGNvbnNvbGUud2Fybignd2UgY291bGQgbm90IGdldCBhbnl0aGluZyBmcm9tOicsIHVybCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRyZXF1ZXN0LnNlbmQoKTtcblx0XHR9XG5cblx0fTtcblx0Y29uc3Qgc3RhdGVDaGVjayA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJyAmJiB0eXBlb2YgTWV0ZW9yICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y2xlYXJJbnRlcnZhbChzdGF0ZUNoZWNrKTtcblx0XHRcdC8vIGRvY3VtZW50IHJlYWR5XG5cdFx0XHRjc3NWYXJQb2x5LmluaXQoKTtcblx0XHR9XG5cdH0sIDEwMCk7XG5cblx0RHluYW1pY0NzcyA9IHR5cGVvZiBEeW5hbWljQ3NzICE9PSd1bmRlZmluZWQnPyBEeW5hbWljQ3NzIDoge307XG5cdER5bmFtaWNDc3MudGVzdCA9ICgpID0+IHdpbmRvdy5DU1MgJiYgd2luZG93LkNTUy5zdXBwb3J0cyAmJiB3aW5kb3cuQ1NTLnN1cHBvcnRzKCcoLS1mb286IHJlZCknKTtcblx0RHluYW1pY0Nzcy5ydW4gPSBkZWJvdW5jZSgocmVwbGFjZSA9IGZhbHNlKSA9PiB7XG5cdFx0aWYgKHJlcGxhY2UpIHtcblx0XHRcdC8vIGNvbnN0IHZhcmlhYmxlcyA9IFJvY2tldENoYXQubW9kZWxzLlNldHRpbmdzLmZpbmRPbmUoe19pZDondGhlbWUtY3VzdG9tLXZhcmlhYmxlcyd9LCB7ZmllbGRzOiB7IHZhbHVlOiAxfX0pO1xuXHRcdFx0Y29uc3QgY29sb3JzID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5jb2xsZWN0aW9uLmZpbmQoe19pZDovdGhlbWUtY29sb3ItcmMvaX0sIHtmaWVsZHM6IHsgdmFsdWU6IDEsIGVkaXRvcjogMX19KS5mZXRjaCgpLmZpbHRlcihjb2xvciA9PiBjb2xvciAmJiBjb2xvci52YWx1ZSk7XG5cblx0XHRcdGlmICghY29sb3JzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNzcyA9IGNvbG9ycy5tYXAoKHtfaWQsIHZhbHVlLCBlZGl0b3J9KSA9PiB7XG5cdFx0XHRcdGlmIChlZGl0b3IgPT09ICdleHByZXNzaW9uJykge1xuXHRcdFx0XHRcdHJldHVybiBgLS0keyBfaWQucmVwbGFjZSgndGhlbWUtY29sb3ItJywgJycpIH06IHZhcigtLSR7IHZhbHVlIH0pO2A7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGAtLSR7IF9pZC5yZXBsYWNlKCd0aGVtZS1jb2xvci0nLCAnJykgfTogJHsgdmFsdWUgfTtgO1xuXHRcdFx0fSkuam9pbignXFxuJyk7XG5cdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY3NzLXZhcmlhYmxlcycpLmlubmVySFRNTCA9IGA6cm9vdCB7JHsgY3NzIH19YDtcblx0XHR9XG5cdFx0Y3NzVmFyUG9seS5pbml0KCk7XG5cdH0sIDEwMDApO1xufTtcbiJdfQ==
