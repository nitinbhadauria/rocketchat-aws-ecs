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
var baseUrls, originIndependentUrl;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:markdown":{"settings.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_markdown/settings.js                                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
let Meteor;
module.watch(require("meteor/meteor"), {
	Meteor(v) {
		Meteor = v;
	}

}, 0);
let RocketChat;
module.watch(require("meteor/rocketchat:lib"), {
	RocketChat(v) {
		RocketChat = v;
	}

}, 1);
Meteor.startup(() => {
	RocketChat.settings.add('Markdown_Parser', 'original', {
		type: 'select',
		values: [{
			key: 'disabled',
			i18nLabel: 'Disabled'
		}, {
			key: 'original',
			i18nLabel: 'Original'
		}, {
			key: 'marked',
			i18nLabel: 'Marked'
		}],
		group: 'Message',
		section: 'Markdown',
		public: true
	});
	const enableQueryOriginal = {
		_id: 'Markdown_Parser',
		value: 'original'
	};
	RocketChat.settings.add('Markdown_Headers', false, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: enableQueryOriginal
	});
	RocketChat.settings.add('Markdown_SupportSchemesForLink', 'http,https', {
		type: 'string',
		group: 'Message',
		section: 'Markdown',
		public: true,
		i18nDescription: 'Markdown_SupportSchemesForLink_Description',
		enableQuery: enableQueryOriginal
	});
	const enableQueryMarked = {
		_id: 'Markdown_Parser',
		value: 'marked'
	};
	RocketChat.settings.add('Markdown_Marked_GFM', true, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: enableQueryMarked
	});
	RocketChat.settings.add('Markdown_Marked_Tables', true, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: enableQueryMarked
	});
	RocketChat.settings.add('Markdown_Marked_Breaks', true, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: enableQueryMarked
	});
	RocketChat.settings.add('Markdown_Marked_Pedantic', false, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: [{
			_id: 'Markdown_Parser',
			value: 'marked'
		}, {
			_id: 'Markdown_Marked_GFM',
			value: false
		}]
	});
	RocketChat.settings.add('Markdown_Marked_SmartLists', true, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: enableQueryMarked
	});
	RocketChat.settings.add('Markdown_Marked_Smartypants', true, {
		type: 'boolean',
		group: 'Message',
		section: 'Markdown',
		public: true,
		enableQuery: enableQueryMarked
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"markdown.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_markdown/markdown.js                                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 0);
let Meteor;
module.watch(require("meteor/meteor"), {
	Meteor(v) {
		Meteor = v;
	}

}, 1);
let Blaze;
module.watch(require("meteor/blaze"), {
	Blaze(v) {
		Blaze = v;
	}

}, 2);
let RocketChat;
module.watch(require("meteor/rocketchat:lib"), {
	RocketChat(v) {
		RocketChat = v;
	}

}, 3);
let marked;
module.watch(require("./parser/marked/marked.js"), {
	marked(v) {
		marked = v;
	}

}, 4);
let original;
module.watch(require("./parser/original/original.js"), {
	original(v) {
		original = v;
	}

}, 5);
const parsers = {
	original,
	marked
};

class MarkdownClass {
	parse(text) {
		const message = {
			html: s.escapeHTML(text)
		};
		return this.mountTokensBack(this.parseMessageNotEscaped(message)).html;
	}

	parseNotEscaped(text) {
		const message = {
			html: text
		};
		return this.mountTokensBack(this.parseMessageNotEscaped(message)).html;
	}

	parseMessageNotEscaped(message) {
		const parser = RocketChat.settings.get('Markdown_Parser');

		if (parser === 'disabled') {
			return message;
		}

		if (typeof parsers[parser] === 'function') {
			return parsers[parser](message);
		}

		return parsers['original'](message);
	}

	mountTokensBack(message) {
		if (message.tokens && message.tokens.length > 0) {
			for (const _ref of message.tokens) {
				const {
					token,
					text
				} = _ref;
				message.html = message.html.replace(token, () => text); // Uses lambda so doesn't need to escape $
			}
		}

		return message;
	}

}

const Markdown = new MarkdownClass();
RocketChat.Markdown = Markdown; // renderMessage already did html escape

const MarkdownMessage = message => {
	if (s.trim(message != null ? message.html : undefined)) {
		message = Markdown.parseMessageNotEscaped(message);
	}

	return message;
};

RocketChat.callbacks.add('renderMessage', MarkdownMessage, RocketChat.callbacks.priority.HIGH, 'markdown');

if (Meteor.isClient) {
	Blaze.registerHelper('RocketChatMarkdown', text => Markdown.parse(text));
	Blaze.registerHelper('RocketChatMarkdownUnescape', text => Markdown.parseNotEscaped(text));
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"parser":{"marked":{"marked.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_markdown/parser/marked/marked.js                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
	marked: () => marked
});
let RocketChat;
module.watch(require("meteor/rocketchat:lib"), {
	RocketChat(v) {
		RocketChat = v;
	}

}, 0);
let Random;
module.watch(require("meteor/random"), {
	Random(v) {
		Random = v;
	}

}, 1);

let _;

module.watch(require("underscore"), {
	default(v) {
		_ = v;
	}

}, 2);
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 3);
let hljs;
module.watch(require("highlight.js"), {
	default(v) {
		hljs = v;
	}

}, 4);

let _marked;

module.watch(require("marked"), {
	default(v) {
		_marked = v;
	}

}, 5);
const renderer = new _marked.Renderer();
let msg = null;

renderer.code = function (code, lang, escaped) {
	if (this.options.highlight) {
		const out = this.options.highlight(code, lang);

		if (out != null && out !== code) {
			escaped = true;
			code = out;
		}
	}

	let text = null;

	if (!lang) {
		text = `<pre><code class="code-colors hljs">${escaped ? code : s.escapeHTML(code, true)}</code></pre>`;
	} else {
		text = `<pre><code class="code-colors hljs ${escape(lang, true)}">${escaped ? code : s.escapeHTML(code, true)}</code></pre>`;
	}

	if (_.isString(msg)) {
		return text;
	}

	const token = `=!=${Random.id()}=!=`;
	msg.tokens.push({
		highlight: true,
		token,
		text
	});
	return token;
};

renderer.codespan = function (text) {
	text = `<code class="code-colors inline">${text}</code>`;

	if (_.isString(msg)) {
		return text;
	}

	const token = `=!=${Random.id()}=!=`;
	msg.tokens.push({
		token,
		text
	});
	return token;
};

renderer.blockquote = function (quote) {
	return `<blockquote class="background-transparent-darker-before">${quote}</blockquote>`;
};

const highlight = function (code, lang) {
	if (!lang) {
		return code;
	}

	try {
		return hljs.highlight(lang, code).value;
	} catch (e) {
		// Unknown language
		return code;
	}
};

let gfm = null;
let tables = null;
let breaks = null;
let pedantic = null;
let smartLists = null;
let smartypants = null;

const marked = message => {
	msg = message;

	if (!msg.tokens) {
		msg.tokens = [];
	}

	if (gfm == null) {
		gfm = RocketChat.settings.get('Markdown_Marked_GFM');
	}

	if (tables == null) {
		tables = RocketChat.settings.get('Markdown_Marked_Tables');
	}

	if (breaks == null) {
		breaks = RocketChat.settings.get('Markdown_Marked_Breaks');
	}

	if (pedantic == null) {
		pedantic = RocketChat.settings.get('Markdown_Marked_Pedantic');
	}

	if (smartLists == null) {
		smartLists = RocketChat.settings.get('Markdown_Marked_SmartLists');
	}

	if (smartypants == null) {
		smartypants = RocketChat.settings.get('Markdown_Marked_Smartypants');
	}

	msg.html = _marked(s.unescapeHTML(msg.html), {
		gfm,
		tables,
		breaks,
		pedantic,
		smartLists,
		smartypants,
		renderer,
		sanitize: true,
		highlight
	});
	return msg;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"original":{"code.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_markdown/parser/original/code.js                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
	code: () => code
});
let Random;
module.watch(require("meteor/random"), {
	Random(v) {
		Random = v;
	}

}, 0);
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 1);
let hljs;
module.watch(require("highlight.js"), {
	default(v) {
		hljs = v;
	}

}, 2);

const inlinecode = message => {
	// Support `text`
	return message.html = message.html.replace(/(^|&gt;|[ >_*~])\`([^`\r\n]+)\`([<_*~]|\B|\b|$)/gm, (match, p1, p2, p3) => {
		const token = `=!=${Random.id()}=!=`;
		message.tokens.push({
			token,
			text: `${p1}<span class=\"copyonly\">\`</span><span><code class=\"code-colors inline\">${p2}</code></span><span class=\"copyonly\">\`</span>${p3}`,
			noHtml: match
		});
		return token;
	});
};

const codeblocks = message => {
	// Count occurencies of ```
	const count = (message.html.match(/```/g) || []).length;

	if (count) {
		// Check if we need to add a final ```
		if (count % 2 > 0) {
			message.html = `${message.html}\n\`\`\``;
			message.msg = `${message.msg}\n\`\`\``;
		} // Separate text in code blocks and non code blocks


		const msgParts = message.html.split(/(^.*)(```(?:[a-zA-Z]+)?(?:(?:.|\r|\n)*?)```)(.*\n?)$/gm);

		for (let index = 0; index < msgParts.length; index++) {
			// Verify if this part is code
			const part = msgParts[index];
			const codeMatch = part.match(/^```(.*[\r\n\ ]?)([\s\S]*?)```+?$/);

			if (codeMatch != null) {
				// Process highlight if this part is code
				const singleLine = codeMatch[0].indexOf('\n') === -1;
				const lang = !singleLine && Array.from(hljs.listLanguages()).includes(s.trim(codeMatch[1])) ? s.trim(codeMatch[1]) : '';
				const code = singleLine ? s.unescapeHTML(codeMatch[1]) : lang === '' ? s.unescapeHTML(codeMatch[1] + codeMatch[2]) : s.unescapeHTML(codeMatch[2]);
				const result = lang === '' ? hljs.highlightAuto(lang + code) : hljs.highlight(lang, code);
				const token = `=!=${Random.id()}=!=`;
				message.tokens.push({
					highlight: true,
					token,
					text: `<pre><code class='code-colors hljs ${result.language}'><span class='copyonly'>\`\`\`<br></span>${result.value}<span class='copyonly'><br>\`\`\`</span></code></pre>`,
					noHtml: `\`\`\`\n${s.stripTags(result.value)}\n\`\`\``
				});
				msgParts[index] = token;
			} else {
				msgParts[index] = part;
			}
		} // Re-mount message


		return message.html = msgParts.join('');
	}
};

const code = message => {
	if (s.trim(message.html)) {
		if (message.tokens == null) {
			message.tokens = [];
		}

		codeblocks(message);
		inlinecode(message);
	}

	return message;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"markdown.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_markdown/parser/original/markdown.js                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
	markdown: () => markdown
});
let Meteor;
module.watch(require("meteor/meteor"), {
	Meteor(v) {
		Meteor = v;
	}

}, 0);
let Random;
module.watch(require("meteor/random"), {
	Random(v) {
		Random = v;
	}

}, 1);
let RocketChat;
module.watch(require("meteor/rocketchat:lib"), {
	RocketChat(v) {
		RocketChat = v;
	}

}, 2);
let s;
module.watch(require("underscore.string"), {
	default(v) {
		s = v;
	}

}, 3);

const parseNotEscaped = function (msg, message) {
	if (message && message.tokens == null) {
		message.tokens = [];
	}

	const addAsToken = function (html) {
		const token = `=!=${Random.id()}=!=`;
		message.tokens.push({
			token,
			text: html
		});
		return token;
	};

	const schemes = RocketChat.settings.get('Markdown_SupportSchemesForLink').split(',').join('|');

	if (RocketChat.settings.get('Markdown_Headers')) {
		// Support # Text for h1
		msg = msg.replace(/^# (([\S\w\d-_\/\*\.,\\][ \u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?)+)/gm, '<h1>$1</h1>'); // Support # Text for h2

		msg = msg.replace(/^## (([\S\w\d-_\/\*\.,\\][ \u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?)+)/gm, '<h2>$1</h2>'); // Support # Text for h3

		msg = msg.replace(/^### (([\S\w\d-_\/\*\.,\\][ \u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?)+)/gm, '<h3>$1</h3>'); // Support # Text for h4

		msg = msg.replace(/^#### (([\S\w\d-_\/\*\.,\\][ \u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?)+)/gm, '<h4>$1</h4>');
	} // Support *text* to make bold


	msg = msg.replace(/(^|&gt;|[ >_~`])\*{1,2}([^\*\r\n]+)\*{1,2}([<_~`]|\B|\b|$)/gm, '$1<span class="copyonly">*</span><strong>$2</strong><span class="copyonly">*</span>$3'); // Support _text_ to make italics

	msg = msg.replace(/(^|&gt;|[ >*~`])\_{1,2}([^\_\r\n]+)\_{1,2}([<*~`]|\B|\b|$)/gm, '$1<span class="copyonly">_</span><em>$2</em><span class="copyonly">_</span>$3'); // Support ~text~ to strike through text

	msg = msg.replace(/(^|&gt;|[ >_*`])\~{1,2}([^~\r\n]+)\~{1,2}([<_*`]|\B|\b|$)/gm, '$1<span class="copyonly">~</span><strike>$2</strike><span class="copyonly">~</span>$3'); // Support for block quote
	// >>>
	// Text
	// <<<

	msg = msg.replace(/(?:&gt;){3}\n+([\s\S]*?)\n+(?:&lt;){3}/g, '<blockquote class="background-transparent-darker-before"><span class="copyonly">&gt;&gt;&gt;</span>$1<span class="copyonly">&lt;&lt;&lt;</span></blockquote>'); // Support >Text for quote

	msg = msg.replace(/^&gt;(.*)$/gm, '<blockquote class="background-transparent-darker-before"><span class="copyonly">&gt;</span>$1</blockquote>'); // Remove white-space around blockquote (prevent <br>). Because blockquote is block element.

	msg = msg.replace(/\s*<blockquote class="background-transparent-darker-before">/gm, '<blockquote class="background-transparent-darker-before">');
	msg = msg.replace(/<\/blockquote>\s*/gm, '</blockquote>'); // Remove new-line between blockquotes.

	msg = msg.replace(/<\/blockquote>\n<blockquote/gm, '</blockquote><blockquote'); // Support ![alt text](http://image url)

	msg = msg.replace(new RegExp(`!\\[([^\\]]+)\\]\\(((?:${schemes}):\\/\\/[^\\)]+)\\)`, 'gm'), (match, title, url) => {
		const target = url.indexOf(Meteor.absoluteUrl()) === 0 ? '' : '_blank';
		return addAsToken(`<a href="${s.escapeHTML(url)}" title="${s.escapeHTML(title)}" target="${s.escapeHTML(target)}" rel="noopener noreferrer"><div class="inline-image" style="background-image: url(${s.escapeHTML(url)});"></div></a>`);
	}); // Support [Text](http://link)

	msg = msg.replace(new RegExp(`\\[([^\\]]+)\\]\\(((?:${schemes}):\\/\\/[^\\)]+)\\)`, 'gm'), (match, title, url) => {
		const target = url.indexOf(Meteor.absoluteUrl()) === 0 ? '' : '_blank';
		return addAsToken(`<a href="${s.escapeHTML(url)}" target="${s.escapeHTML(target)}" rel="noopener noreferrer">${s.escapeHTML(title)}</a>`);
	}); // Support <http://link|Text>

	msg = msg.replace(new RegExp(`(?:<|&lt;)((?:${schemes}):\\/\\/[^\\|]+)\\|(.+?)(?=>|&gt;)(?:>|&gt;)`, 'gm'), (match, url, title) => {
		const target = url.indexOf(Meteor.absoluteUrl()) === 0 ? '' : '_blank';
		return addAsToken(`<a href="${s.escapeHTML(url)}" target="${s.escapeHTML(target)}" rel="noopener noreferrer">${s.escapeHTML(title)}</a>`);
	});
	return msg;
};

const markdown = function (message) {
	message.html = parseNotEscaped(message.html, message);
	return message;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"original.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/rocketchat_markdown/parser/original/original.js                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
	original: () => original
});
let markdown;
module.watch(require("./markdown.js"), {
	markdown(v) {
		markdown = v;
	}

}, 0);
let code;
module.watch(require("./code.js"), {
	code(v) {
		code = v;
	}

}, 1);

const original = message => {
	// Parse markdown code
	message = code(message); // Parse markdown

	message = markdown(message); // Replace linebreak to br

	message.html = message.html.replace(/\n/gm, '<br>');
	return message;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"node_modules":{"marked":{"package.json":function(require,exports){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// ../../.meteor/local/isopacks/rocketchat_markdown/npm/node_modules/marked/package.json                              //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
exports.name = "marked";
exports.version = "0.3.9";
exports.main = "./lib/marked.js";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"marked.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/rocketchat_markdown/node_modules/marked/lib/marked.js                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 */

;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
  ('def', '\\n+(?=' + block.def.source + ')')
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

/**
 * Normal Block Grammar
 */

block.normal = merge({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = merge({}, block.normal, {
  fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
  paragraph: /^/,
  heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/
});

block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!'
    + block.gfm.fences.source.replace('\\1', '\\2') + '|'
    + block.list.source.replace('\\1', '\\3') + '|')
  ();

/**
 * GFM + Tables Block Grammar
 */

block.tables = merge({}, block.gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || marked.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top, bq) {
  var src = src.replace(/^ +$/gm, '')
    , next
    , loose
    , cap
    , bull
    , b
    , item
    , space
    , i
    , l;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        });
      }
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, '');
      this.tokens.push({
        type: 'code',
        text: !this.options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap
      });
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        lang: cap[2],
        text: cap[3] || ''
      });
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      });
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr'
      });
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top, true);

      this.tokens.push({
        type: 'blockquote_end'
      });

      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      src = src.substring(cap[0].length);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i + 1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose
            ? 'loose_item_start'
            : 'list_item_start'
        });

        // Recurse.
        this.token(item, false, bq);

        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });

      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: !this.options.sanitizer
          && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
        text: cap[0]
      });
      continue;
    }

    // def
    if ((!bq && top) && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1].charAt(cap[1].length - 1) === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)([\s\S]*?[^`])\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || marked.defaults;
  this.links = links;
  this.rules = inline.normal;
  this.renderer = this.options.renderer || new Renderer;
  this.renderer.options = this.options;

  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src) {
  var out = ''
    , link
    , text
    , href
    , cap;

  while (src) {
    // escape
    if (cap = this.rules.escape.exec(src)) {
      src = src.substring(cap[0].length);
      out += cap[1];
      continue;
    }

    // autolink
    if (cap = this.rules.autolink.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[2] === '@') {
        text = escape(
          cap[1].charAt(6) === ':'
          ? this.mangle(cap[1].substring(7))
          : this.mangle(cap[1])
        );
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      out += this.renderer.link(href, null, text);
      continue;
    }

    // url (gfm)
    if (!this.inLink && (cap = this.rules.url.exec(src))) {
      src = src.substring(cap[0].length);
      text = escape(cap[1]);
      href = text;
      out += this.renderer.link(href, null, text);
      continue;
    }

    // tag
    if (cap = this.rules.tag.exec(src)) {
      if (!this.inLink && /^<a /i.test(cap[0])) {
        this.inLink = true;
      } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
        this.inLink = false;
      }
      src = src.substring(cap[0].length);
      out += this.options.sanitize
        ? this.options.sanitizer
          ? this.options.sanitizer(cap[0])
          : escape(cap[0])
        : cap[0]
      continue;
    }

    // link
    if (cap = this.rules.link.exec(src)) {
      src = src.substring(cap[0].length);
      this.inLink = true;
      out += this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      });
      this.inLink = false;
      continue;
    }

    // reflink, nolink
    if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out += cap[0].charAt(0);
        src = cap[0].substring(1) + src;
        continue;
      }
      this.inLink = true;
      out += this.outputLink(cap, link);
      this.inLink = false;
      continue;
    }

    // strong
    if (cap = this.rules.strong.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.strong(this.output(cap[2] || cap[1]));
      continue;
    }

    // em
    if (cap = this.rules.em.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.em(this.output(cap[2] || cap[1]));
      continue;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.codespan(escape(cap[2].trim(), true));
      continue;
    }

    // br
    if (cap = this.rules.br.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.br();
      continue;
    }

    // del (gfm)
    if (cap = this.rules.del.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.del(this.output(cap[1]));
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.text(escape(this.smartypants(cap[0])));
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  var href = escape(link.href)
    , title = link.title ? escape(link.title) : null;

  return cap[0].charAt(0) !== '!'
    ? this.renderer.link(href, title, this.output(cap[1]))
    : this.renderer.image(href, title, escape(cap[1]));
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    // em-dashes
    .replace(/---/g, '\u2014')
    // en-dashes
    .replace(/--/g, '\u2013')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026');
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  if (!this.options.mangle) return text;
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Renderer
 */

function Renderer(options) {
  this.options = options || {};
}

Renderer.prototype.code = function(code, lang, escaped) {
  if (this.options.highlight) {
    var out = this.options.highlight(code, lang);
    if (out != null && out !== code) {
      escaped = true;
      code = out;
    }
  }

  if (!lang) {
    return '<pre><code>'
      + (escaped ? code : escape(code, true))
      + '\n</code></pre>';
  }

  return '<pre><code class="'
    + this.options.langPrefix
    + escape(lang, true)
    + '">'
    + (escaped ? code : escape(code, true))
    + '\n</code></pre>\n';
};

Renderer.prototype.blockquote = function(quote) {
  return '<blockquote>\n' + quote + '</blockquote>\n';
};

Renderer.prototype.html = function(html) {
  return html;
};

Renderer.prototype.heading = function(text, level, raw) {
  return '<h'
    + level
    + ' id="'
    + this.options.headerPrefix
    + raw.toLowerCase().replace(/[^\w]+/g, '-')
    + '">'
    + text
    + '</h'
    + level
    + '>\n';
};

Renderer.prototype.hr = function() {
  return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
};

Renderer.prototype.list = function(body, ordered) {
  var type = ordered ? 'ol' : 'ul';
  return '<' + type + '>\n' + body + '</' + type + '>\n';
};

Renderer.prototype.listitem = function(text) {
  return '<li>' + text + '</li>\n';
};

Renderer.prototype.paragraph = function(text) {
  return '<p>' + text + '</p>\n';
};

Renderer.prototype.table = function(header, body) {
  return '<table>\n'
    + '<thead>\n'
    + header
    + '</thead>\n'
    + '<tbody>\n'
    + body
    + '</tbody>\n'
    + '</table>\n';
};

Renderer.prototype.tablerow = function(content) {
  return '<tr>\n' + content + '</tr>\n';
};

Renderer.prototype.tablecell = function(content, flags) {
  var type = flags.header ? 'th' : 'td';
  var tag = flags.align
    ? '<' + type + ' style="text-align:' + flags.align + '">'
    : '<' + type + '>';
  return tag + content + '</' + type + '>\n';
};

// span level renderer
Renderer.prototype.strong = function(text) {
  return '<strong>' + text + '</strong>';
};

Renderer.prototype.em = function(text) {
  return '<em>' + text + '</em>';
};

Renderer.prototype.codespan = function(text) {
  return '<code>' + text + '</code>';
};

Renderer.prototype.br = function() {
  return this.options.xhtml ? '<br/>' : '<br>';
};

Renderer.prototype.del = function(text) {
  return '<del>' + text + '</del>';
};

Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
      return '';
    }
  }
  if (this.options.baseUrl && !originIndependentUrl.test(href)) {
    href = resolveUrl(this.options.baseUrl, href);
  }
  var out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += '>' + text + '</a>';
  return out;
};

Renderer.prototype.image = function(href, title, text) {
  if (this.options.baseUrl && !originIndependentUrl.test(href)) {
    href = resolveUrl(this.options.baseUrl, href);
  }
  var out = '<img src="' + href + '" alt="' + text + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += this.options.xhtml ? '/>' : '>';
  return out;
};

Renderer.prototype.text = function(text) {
  return text;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || marked.defaults;
  this.options.renderer = this.options.renderer || new Renderer;
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options, renderer) {
  var parser = new Parser(options, renderer);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options, this.renderer);
  this.tokens = src.reverse();

  var out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length - 1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
  switch (this.token.type) {
    case 'space': {
      return '';
    }
    case 'hr': {
      return this.renderer.hr();
    }
    case 'heading': {
      return this.renderer.heading(
        this.inline.output(this.token.text),
        this.token.depth,
        this.token.text);
    }
    case 'code': {
      return this.renderer.code(this.token.text,
        this.token.lang,
        this.token.escaped);
    }
    case 'table': {
      var header = ''
        , body = ''
        , i
        , row
        , cell
        , flags
        , j;

      // header
      cell = '';
      for (i = 0; i < this.token.header.length; i++) {
        flags = { header: true, align: this.token.align[i] };
        cell += this.renderer.tablecell(
          this.inline.output(this.token.header[i]),
          { header: true, align: this.token.align[i] }
        );
      }
      header += this.renderer.tablerow(cell);

      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];

        cell = '';
        for (j = 0; j < row.length; j++) {
          cell += this.renderer.tablecell(
            this.inline.output(row[j]),
            { header: false, align: this.token.align[j] }
          );
        }

        body += this.renderer.tablerow(cell);
      }
      return this.renderer.table(header, body);
    }
    case 'blockquote_start': {
      var body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return this.renderer.blockquote(body);
    }
    case 'list_start': {
      var body = ''
        , ordered = this.token.ordered;

      while (this.next().type !== 'list_end') {
        body += this.tok();
      }

      return this.renderer.list(body, ordered);
    }
    case 'list_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text'
          ? this.parseText()
          : this.tok();
      }

      return this.renderer.listitem(body);
    }
    case 'loose_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return this.renderer.listitem(body);
    }
    case 'html': {
      var html = !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text;
      return this.renderer.html(html);
    }
    case 'paragraph': {
      return this.renderer.paragraph(this.inline.output(this.token.text));
    }
    case 'text': {
      return this.renderer.paragraph(this.parseText());
    }
  }
};

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescape(html) {
	// explicitly match decimal, hex, and named HTML entities
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, function(_, n) {
    n = n.toLowerCase();
    if (n === 'colon') return ':';
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1));
    }
    return '';
  });
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function resolveUrl(base, href) {
  if (!baseUrls[' ' + base]) {
    // we can ignore everything in base after the last slash of its path component,
    // but we might need to add _that_
    // https://tools.ietf.org/html/rfc3986#section-3
    if (/^[^:]+:\/*[^/]*$/.test(base)) {
      baseUrls[' ' + base] = base + '/';
    } else {
      baseUrls[' ' + base] = base.replace(/[^/]*$/, '');
    }
  }
  base = baseUrls[' ' + base];

  if (href.slice(0, 2) === '//') {
    return base.replace(/:[^]*/, ':') + href;
  } else if (href.charAt(0) === '/') {
    return base.replace(/(:\/*[^/]*)[^]*/, '$1') + href;
  } else {
    return base + href;
  }
}
baseUrls = {};
originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}


/**
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    opt = merge({}, marked.defaults, opt || {});

    var highlight = opt.highlight
      , tokens
      , pending
      , i = 0;

    try {
      tokens = Lexer.lex(src, opt)
    } catch (e) {
      return callback(e);
    }

    pending = tokens.length;

    var done = function(err) {
      if (err) {
        opt.highlight = highlight;
        return callback(err);
      }

      var out;

      try {
        out = Parser.parse(tokens, opt);
      } catch (e) {
        err = e;
      }

      opt.highlight = highlight;

      return err
        ? callback(err)
        : callback(null, out);
    };

    if (!highlight || highlight.length < 3) {
      return done();
    }

    delete opt.highlight;

    if (!pending) return done();

    for (; i < tokens.length; i++) {
      (function(token) {
        if (token.type !== 'code') {
          return --pending || done();
        }
        return highlight(token.text, token.lang, function(err, code) {
          if (err) return done(err);
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  sanitizer: null,
  mangle: true,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  renderer: new Renderer,
  xhtml: false,
  baseUrl: null
};

/**
 * Expose
 */

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Renderer = Renderer;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

if (typeof module !== 'undefined' && typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.marked = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
require("./node_modules/meteor/rocketchat:markdown/settings.js");
var exports = require("./node_modules/meteor/rocketchat:markdown/markdown.js");

/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['rocketchat:markdown'] = exports;

})();

//# sourceURL=meteor://💻app/packages/rocketchat_markdown.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYXJrZG93bi9zZXR0aW5ncy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYXJrZG93bi9tYXJrZG93bi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYXJrZG93bi9wYXJzZXIvbWFya2VkL21hcmtlZC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYXJrZG93bi9wYXJzZXIvb3JpZ2luYWwvY29kZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDptYXJrZG93bi9wYXJzZXIvb3JpZ2luYWwvbWFya2Rvd24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6bWFya2Rvd24vcGFyc2VyL29yaWdpbmFsL29yaWdpbmFsLmpzIl0sIm5hbWVzIjpbIk1ldGVvciIsIm1vZHVsZSIsIndhdGNoIiwicmVxdWlyZSIsInYiLCJSb2NrZXRDaGF0Iiwic3RhcnR1cCIsInNldHRpbmdzIiwiYWRkIiwidHlwZSIsInZhbHVlcyIsImtleSIsImkxOG5MYWJlbCIsImdyb3VwIiwic2VjdGlvbiIsInB1YmxpYyIsImVuYWJsZVF1ZXJ5T3JpZ2luYWwiLCJfaWQiLCJ2YWx1ZSIsImVuYWJsZVF1ZXJ5IiwiaTE4bkRlc2NyaXB0aW9uIiwiZW5hYmxlUXVlcnlNYXJrZWQiLCJzIiwiZGVmYXVsdCIsIkJsYXplIiwibWFya2VkIiwib3JpZ2luYWwiLCJwYXJzZXJzIiwiTWFya2Rvd25DbGFzcyIsInBhcnNlIiwidGV4dCIsIm1lc3NhZ2UiLCJodG1sIiwiZXNjYXBlSFRNTCIsIm1vdW50VG9rZW5zQmFjayIsInBhcnNlTWVzc2FnZU5vdEVzY2FwZWQiLCJwYXJzZU5vdEVzY2FwZWQiLCJwYXJzZXIiLCJnZXQiLCJ0b2tlbnMiLCJsZW5ndGgiLCJ0b2tlbiIsInJlcGxhY2UiLCJNYXJrZG93biIsIk1hcmtkb3duTWVzc2FnZSIsInRyaW0iLCJ1bmRlZmluZWQiLCJjYWxsYmFja3MiLCJwcmlvcml0eSIsIkhJR0giLCJpc0NsaWVudCIsInJlZ2lzdGVySGVscGVyIiwiZXhwb3J0IiwiUmFuZG9tIiwiXyIsImhsanMiLCJfbWFya2VkIiwicmVuZGVyZXIiLCJSZW5kZXJlciIsIm1zZyIsImNvZGUiLCJsYW5nIiwiZXNjYXBlZCIsIm9wdGlvbnMiLCJoaWdobGlnaHQiLCJvdXQiLCJlc2NhcGUiLCJpc1N0cmluZyIsImlkIiwicHVzaCIsImNvZGVzcGFuIiwiYmxvY2txdW90ZSIsInF1b3RlIiwiZSIsImdmbSIsInRhYmxlcyIsImJyZWFrcyIsInBlZGFudGljIiwic21hcnRMaXN0cyIsInNtYXJ0eXBhbnRzIiwidW5lc2NhcGVIVE1MIiwic2FuaXRpemUiLCJpbmxpbmVjb2RlIiwibWF0Y2giLCJwMSIsInAyIiwicDMiLCJub0h0bWwiLCJjb2RlYmxvY2tzIiwiY291bnQiLCJtc2dQYXJ0cyIsInNwbGl0IiwiaW5kZXgiLCJwYXJ0IiwiY29kZU1hdGNoIiwic2luZ2xlTGluZSIsImluZGV4T2YiLCJBcnJheSIsImZyb20iLCJsaXN0TGFuZ3VhZ2VzIiwiaW5jbHVkZXMiLCJyZXN1bHQiLCJoaWdobGlnaHRBdXRvIiwibGFuZ3VhZ2UiLCJzdHJpcFRhZ3MiLCJqb2luIiwibWFya2Rvd24iLCJhZGRBc1Rva2VuIiwic2NoZW1lcyIsIlJlZ0V4cCIsInRpdGxlIiwidXJsIiwidGFyZ2V0IiwiYWJzb2x1dGVVcmwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxJQUFJQSxNQUFKO0FBQVdDLE9BQU9DLEtBQVAsQ0FBYUMsUUFBUSxlQUFSLENBQWIsRUFBc0M7QUFBQ0gsUUFBT0ksQ0FBUCxFQUFTO0FBQUNKLFdBQU9JLENBQVA7QUFBUzs7QUFBcEIsQ0FBdEMsRUFBNEQsQ0FBNUQ7QUFBK0QsSUFBSUMsVUFBSjtBQUFlSixPQUFPQyxLQUFQLENB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RCxNQUFQLENBQWM7QUFBQzFCLFdBQVMsTUFBSUE7QUFBZCxDQUFkO0FBQXVDLElBQUlnRixRQUFKO0FBQWF6RyxPQUFPQyxLQUFQLENBQWFDLFFBQVEsZUFBUixDQUFiLEVBQXNDO0FBQUN1RyxVQUFTdEcsQ0FBVCxFQUFXO0FBQUNzRyxhQUFTdEcsQ0FBVDtBQUFXOztBQUF4QixDQUF0QyxFQUFnRSxDQUFoRTtBQUFtRSxJQUFJd0QsSUFBSjtBQUFTM0QsT0FBT0MsS0FBUCxDQUFhQyxRQUFRLFdBQVIsQ0FBYixFQUFrQztBQUFDeUQsTUFBS3hELENBQUwsRUFBTztBQUFDd0QsU0FBS3hELENBQUw7QUFBTzs7QUFBaEIsQ0FBbEMsRUFBb0QsQ0FBcEQ7O0FBT3pILE1BQU1zQixXQUFZSyxPQUFELElBQWE7QUFDcEM7QUFDQUEsV0FBVTZCLEtBQUs3QixPQUFMLENBQVYsQ0FGb0MsQ0FJcEM7O0FBQ0FBLFdBQVUyRSxTQUFTM0UsT0FBVCxDQUFWLENBTG9DLENBT3BDOztBQUNBQSxTQUFRQyxJQUFSLEdBQWVELFFBQVFDLElBQVIsQ0FBYVUsT0FBYixDQUFxQixNQUFyQixFQUE2QixNQUE3QixDQUFmO0FBRUEsUUFBT1gsT0FBUDtBQUNBLENBWE0sQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9tYXJrZG93bi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgUm9ja2V0Q2hhdCB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmxpYic7XG5cbk1ldGVvci5zdGFydHVwKCgpID0+IHtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ01hcmtkb3duX1BhcnNlcicsICdvcmlnaW5hbCcsIHtcblx0XHR0eXBlOiAnc2VsZWN0Jyxcblx0XHR2YWx1ZXM6IFt7XG5cdFx0XHRrZXk6ICdkaXNhYmxlZCcsXG5cdFx0XHRpMThuTGFiZWw6ICdEaXNhYmxlZCdcblx0XHR9LCB7XG5cdFx0XHRrZXk6ICdvcmlnaW5hbCcsXG5cdFx0XHRpMThuTGFiZWw6ICdPcmlnaW5hbCdcblx0XHR9LCB7XG5cdFx0XHRrZXk6ICdtYXJrZWQnLFxuXHRcdFx0aTE4bkxhYmVsOiAnTWFya2VkJ1xuXHRcdH1dLFxuXHRcdGdyb3VwOiAnTWVzc2FnZScsXG5cdFx0c2VjdGlvbjogJ01hcmtkb3duJyxcblx0XHRwdWJsaWM6IHRydWVcblx0fSk7XG5cblx0Y29uc3QgZW5hYmxlUXVlcnlPcmlnaW5hbCA9IHtfaWQ6ICdNYXJrZG93bl9QYXJzZXInLCB2YWx1ZTogJ29yaWdpbmFsJ307XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdNYXJrZG93bl9IZWFkZXJzJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdNZXNzYWdlJyxcblx0XHRzZWN0aW9uOiAnTWFya2Rvd24nLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRlbmFibGVRdWVyeTogZW5hYmxlUXVlcnlPcmlnaW5hbFxuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ01hcmtkb3duX1N1cHBvcnRTY2hlbWVzRm9yTGluaycsICdodHRwLGh0dHBzJywge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGdyb3VwOiAnTWVzc2FnZScsXG5cdFx0c2VjdGlvbjogJ01hcmtkb3duJyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0aTE4bkRlc2NyaXB0aW9uOiAnTWFya2Rvd25fU3VwcG9ydFNjaGVtZXNGb3JMaW5rX0Rlc2NyaXB0aW9uJyxcblx0XHRlbmFibGVRdWVyeTogZW5hYmxlUXVlcnlPcmlnaW5hbFxuXHR9KTtcblxuXHRjb25zdCBlbmFibGVRdWVyeU1hcmtlZCA9IHtfaWQ6ICdNYXJrZG93bl9QYXJzZXInLCB2YWx1ZTogJ21hcmtlZCd9O1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTWFya2Rvd25fTWFya2VkX0dGTScsIHRydWUsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdNZXNzYWdlJyxcblx0XHRzZWN0aW9uOiAnTWFya2Rvd24nLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRlbmFibGVRdWVyeTogZW5hYmxlUXVlcnlNYXJrZWRcblx0fSk7XG5cdFJvY2tldENoYXQuc2V0dGluZ3MuYWRkKCdNYXJrZG93bl9NYXJrZWRfVGFibGVzJywgdHJ1ZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ01lc3NhZ2UnLFxuXHRcdHNlY3Rpb246ICdNYXJrZG93bicsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGVuYWJsZVF1ZXJ5OiBlbmFibGVRdWVyeU1hcmtlZFxuXHR9KTtcblx0Um9ja2V0Q2hhdC5zZXR0aW5ncy5hZGQoJ01hcmtkb3duX01hcmtlZF9CcmVha3MnLCB0cnVlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnTWVzc2FnZScsXG5cdFx0c2VjdGlvbjogJ01hcmtkb3duJyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0ZW5hYmxlUXVlcnk6IGVuYWJsZVF1ZXJ5TWFya2VkXG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTWFya2Rvd25fTWFya2VkX1BlZGFudGljJywgZmFsc2UsIHtcblx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0Z3JvdXA6ICdNZXNzYWdlJyxcblx0XHRzZWN0aW9uOiAnTWFya2Rvd24nLFxuXHRcdHB1YmxpYzogdHJ1ZSxcblx0XHRlbmFibGVRdWVyeTogW3tcblx0XHRcdF9pZDogJ01hcmtkb3duX1BhcnNlcicsXG5cdFx0XHR2YWx1ZTogJ21hcmtlZCdcblx0XHR9LCB7XG5cdFx0XHRfaWQ6ICdNYXJrZG93bl9NYXJrZWRfR0ZNJyxcblx0XHRcdHZhbHVlOiBmYWxzZVxuXHRcdH1dXG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTWFya2Rvd25fTWFya2VkX1NtYXJ0TGlzdHMnLCB0cnVlLCB7XG5cdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdGdyb3VwOiAnTWVzc2FnZScsXG5cdFx0c2VjdGlvbjogJ01hcmtkb3duJyxcblx0XHRwdWJsaWM6IHRydWUsXG5cdFx0ZW5hYmxlUXVlcnk6IGVuYWJsZVF1ZXJ5TWFya2VkXG5cdH0pO1xuXHRSb2NrZXRDaGF0LnNldHRpbmdzLmFkZCgnTWFya2Rvd25fTWFya2VkX1NtYXJ0eXBhbnRzJywgdHJ1ZSwge1xuXHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRncm91cDogJ01lc3NhZ2UnLFxuXHRcdHNlY3Rpb246ICdNYXJrZG93bicsXG5cdFx0cHVibGljOiB0cnVlLFxuXHRcdGVuYWJsZVF1ZXJ5OiBlbmFibGVRdWVyeU1hcmtlZFxuXHR9KTtcbn0pO1xuIiwiLypcbiAqIE1hcmtkb3duIGlzIGEgbmFtZWQgZnVuY3Rpb24gdGhhdCB3aWxsIHBhcnNlIG1hcmtkb3duIHN5bnRheFxuICogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSBvYmplY3RcbiAqL1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBCbGF6ZSB9IGZyb20gJ21ldGVvci9ibGF6ZSc7XG5pbXBvcnQgeyBSb2NrZXRDaGF0IH0gZnJvbSAnbWV0ZW9yL3JvY2tldGNoYXQ6bGliJztcblxuaW1wb3J0IHsgbWFya2VkIH0gZnJvbSAnLi9wYXJzZXIvbWFya2VkL21hcmtlZC5qcyc7XG5pbXBvcnQgeyBvcmlnaW5hbCB9IGZyb20gJy4vcGFyc2VyL29yaWdpbmFsL29yaWdpbmFsLmpzJztcblxuY29uc3QgcGFyc2VycyA9IHtcblx0b3JpZ2luYWwsXG5cdG1hcmtlZFxufTtcblxuY2xhc3MgTWFya2Rvd25DbGFzcyB7XG5cdHBhcnNlKHRleHQpIHtcblx0XHRjb25zdCBtZXNzYWdlID0ge1xuXHRcdFx0aHRtbDogcy5lc2NhcGVIVE1MKHRleHQpXG5cdFx0fTtcblx0XHRyZXR1cm4gdGhpcy5tb3VudFRva2Vuc0JhY2sodGhpcy5wYXJzZU1lc3NhZ2VOb3RFc2NhcGVkKG1lc3NhZ2UpKS5odG1sO1xuXHR9XG5cblx0cGFyc2VOb3RFc2NhcGVkKHRleHQpIHtcblx0XHRjb25zdCBtZXNzYWdlID0ge1xuXHRcdFx0aHRtbDogdGV4dFxuXHRcdH07XG5cdFx0cmV0dXJuIHRoaXMubW91bnRUb2tlbnNCYWNrKHRoaXMucGFyc2VNZXNzYWdlTm90RXNjYXBlZChtZXNzYWdlKSkuaHRtbDtcblx0fVxuXG5cdHBhcnNlTWVzc2FnZU5vdEVzY2FwZWQobWVzc2FnZSkge1xuXHRcdGNvbnN0IHBhcnNlciA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNYXJrZG93bl9QYXJzZXInKTtcblxuXHRcdGlmIChwYXJzZXIgPT09ICdkaXNhYmxlZCcpIHtcblx0XHRcdHJldHVybiBtZXNzYWdlO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgcGFyc2Vyc1twYXJzZXJdID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gcGFyc2Vyc1twYXJzZXJdKG1lc3NhZ2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gcGFyc2Vyc1snb3JpZ2luYWwnXShtZXNzYWdlKTtcblx0fVxuXG5cdG1vdW50VG9rZW5zQmFjayhtZXNzYWdlKSB7XG5cdFx0aWYgKG1lc3NhZ2UudG9rZW5zICYmIG1lc3NhZ2UudG9rZW5zLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3Qge3Rva2VuLCB0ZXh0fSBvZiBtZXNzYWdlLnRva2Vucykge1xuXHRcdFx0XHRtZXNzYWdlLmh0bWwgPSBtZXNzYWdlLmh0bWwucmVwbGFjZSh0b2tlbiwgKCkgPT4gdGV4dCk7IC8vIFVzZXMgbGFtYmRhIHNvIGRvZXNuJ3QgbmVlZCB0byBlc2NhcGUgJFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG59XG5cbmNvbnN0IE1hcmtkb3duID0gbmV3IE1hcmtkb3duQ2xhc3M7XG5Sb2NrZXRDaGF0Lk1hcmtkb3duID0gTWFya2Rvd247XG5cbi8vIHJlbmRlck1lc3NhZ2UgYWxyZWFkeSBkaWQgaHRtbCBlc2NhcGVcbmNvbnN0IE1hcmtkb3duTWVzc2FnZSA9IChtZXNzYWdlKSA9PiB7XG5cdGlmIChzLnRyaW0obWVzc2FnZSAhPSBudWxsID8gbWVzc2FnZS5odG1sIDogdW5kZWZpbmVkKSkge1xuXHRcdG1lc3NhZ2UgPSBNYXJrZG93bi5wYXJzZU1lc3NhZ2VOb3RFc2NhcGVkKG1lc3NhZ2UpO1xuXHR9XG5cblx0cmV0dXJuIG1lc3NhZ2U7XG59O1xuXG5Sb2NrZXRDaGF0LmNhbGxiYWNrcy5hZGQoJ3JlbmRlck1lc3NhZ2UnLCBNYXJrZG93bk1lc3NhZ2UsIFJvY2tldENoYXQuY2FsbGJhY2tzLnByaW9yaXR5LkhJR0gsICdtYXJrZG93bicpO1xuXG5pZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG5cdEJsYXplLnJlZ2lzdGVySGVscGVyKCdSb2NrZXRDaGF0TWFya2Rvd24nLCB0ZXh0ID0+IE1hcmtkb3duLnBhcnNlKHRleHQpKTtcblx0QmxhemUucmVnaXN0ZXJIZWxwZXIoJ1JvY2tldENoYXRNYXJrZG93blVuZXNjYXBlJywgdGV4dCA9PiBNYXJrZG93bi5wYXJzZU5vdEVzY2FwZWQodGV4dCkpO1xufVxuIiwiaW1wb3J0IHsgUm9ja2V0Q2hhdCB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmxpYic7XG5pbXBvcnQgeyBSYW5kb20gfSBmcm9tICdtZXRlb3IvcmFuZG9tJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuaW1wb3J0IGhsanMgZnJvbSAnaGlnaGxpZ2h0LmpzJztcbmltcG9ydCBfbWFya2VkIGZyb20gJ21hcmtlZCc7XG5cbmNvbnN0IHJlbmRlcmVyID0gbmV3IF9tYXJrZWQuUmVuZGVyZXIoKTtcblxubGV0IG1zZyA9IG51bGw7XG5cbnJlbmRlcmVyLmNvZGUgPSBmdW5jdGlvbihjb2RlLCBsYW5nLCBlc2NhcGVkKSB7XG5cdGlmICh0aGlzLm9wdGlvbnMuaGlnaGxpZ2h0KSB7XG5cdFx0Y29uc3Qgb3V0ID0gdGhpcy5vcHRpb25zLmhpZ2hsaWdodChjb2RlLCBsYW5nKTtcblx0XHRpZiAob3V0ICE9IG51bGwgJiYgb3V0ICE9PSBjb2RlKSB7XG5cdFx0XHRlc2NhcGVkID0gdHJ1ZTtcblx0XHRcdGNvZGUgPSBvdXQ7XG5cdFx0fVxuXHR9XG5cblx0bGV0IHRleHQgPSBudWxsO1xuXG5cdGlmICghbGFuZykge1xuXHRcdHRleHQgPSBgPHByZT48Y29kZSBjbGFzcz1cImNvZGUtY29sb3JzIGhsanNcIj4keyAoZXNjYXBlZCA/IGNvZGUgOiBzLmVzY2FwZUhUTUwoY29kZSwgdHJ1ZSkpIH08L2NvZGU+PC9wcmU+YDtcblx0fSBlbHNlIHtcblx0XHR0ZXh0ID0gYDxwcmU+PGNvZGUgY2xhc3M9XCJjb2RlLWNvbG9ycyBobGpzICR7IGVzY2FwZShsYW5nLCB0cnVlKSB9XCI+JHsgKGVzY2FwZWQgPyBjb2RlIDogcy5lc2NhcGVIVE1MKGNvZGUsIHRydWUpKSB9PC9jb2RlPjwvcHJlPmA7XG5cdH1cblxuXHRpZiAoXy5pc1N0cmluZyhtc2cpKSB7XG5cdFx0cmV0dXJuIHRleHQ7XG5cdH1cblxuXHRjb25zdCB0b2tlbiA9IGA9IT0keyBSYW5kb20uaWQoKSB9PSE9YDtcblx0bXNnLnRva2Vucy5wdXNoKHtcblx0XHRoaWdobGlnaHQ6IHRydWUsXG5cdFx0dG9rZW4sXG5cdFx0dGV4dFxuXHR9KTtcblxuXHRyZXR1cm4gdG9rZW47XG59O1xuXG5yZW5kZXJlci5jb2Rlc3BhbiA9IGZ1bmN0aW9uKHRleHQpIHtcblx0dGV4dCA9IGA8Y29kZSBjbGFzcz1cImNvZGUtY29sb3JzIGlubGluZVwiPiR7IHRleHQgfTwvY29kZT5gO1xuXHRpZiAoXy5pc1N0cmluZyhtc2cpKSB7XG5cdFx0cmV0dXJuIHRleHQ7XG5cdH1cblxuXHRjb25zdCB0b2tlbiA9IGA9IT0keyBSYW5kb20uaWQoKSB9PSE9YDtcblx0bXNnLnRva2Vucy5wdXNoKHtcblx0XHR0b2tlbixcblx0XHR0ZXh0XG5cdH0pO1xuXG5cdHJldHVybiB0b2tlbjtcbn07XG5cbnJlbmRlcmVyLmJsb2NrcXVvdGUgPSBmdW5jdGlvbihxdW90ZSkge1xuXHRyZXR1cm4gYDxibG9ja3F1b3RlIGNsYXNzPVwiYmFja2dyb3VuZC10cmFuc3BhcmVudC1kYXJrZXItYmVmb3JlXCI+JHsgcXVvdGUgfTwvYmxvY2txdW90ZT5gO1xufTtcblxuY29uc3QgaGlnaGxpZ2h0ID0gZnVuY3Rpb24oY29kZSwgbGFuZykge1xuXHRpZiAoIWxhbmcpIHtcblx0XHRyZXR1cm4gY29kZTtcblx0fVxuXHR0cnkge1xuXHRcdHJldHVybiBobGpzLmhpZ2hsaWdodChsYW5nLCBjb2RlKS52YWx1ZTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIFVua25vd24gbGFuZ3VhZ2Vcblx0XHRyZXR1cm4gY29kZTtcblx0fVxufTtcblxubGV0IGdmbSA9IG51bGw7XG5sZXQgdGFibGVzID0gbnVsbDtcbmxldCBicmVha3MgPSBudWxsO1xubGV0IHBlZGFudGljID0gbnVsbDtcbmxldCBzbWFydExpc3RzID0gbnVsbDtcbmxldCBzbWFydHlwYW50cyA9IG51bGw7XG5cbmV4cG9ydCBjb25zdCBtYXJrZWQgPSAobWVzc2FnZSkgPT4ge1xuXHRtc2cgPSBtZXNzYWdlO1xuXG5cdGlmICghbXNnLnRva2Vucykge1xuXHRcdG1zZy50b2tlbnMgPSBbXTtcblx0fVxuXG5cdGlmIChnZm0gPT0gbnVsbCkgeyBnZm0gPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWFya2Rvd25fTWFya2VkX0dGTScpOyB9XG5cdGlmICh0YWJsZXMgPT0gbnVsbCkgeyB0YWJsZXMgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWFya2Rvd25fTWFya2VkX1RhYmxlcycpOyB9XG5cdGlmIChicmVha3MgPT0gbnVsbCkgeyBicmVha3MgPSBSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWFya2Rvd25fTWFya2VkX0JyZWFrcycpOyB9XG5cdGlmIChwZWRhbnRpYyA9PSBudWxsKSB7IHBlZGFudGljID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01hcmtkb3duX01hcmtlZF9QZWRhbnRpYycpOyB9XG5cdGlmIChzbWFydExpc3RzID09IG51bGwpIHsgc21hcnRMaXN0cyA9IFJvY2tldENoYXQuc2V0dGluZ3MuZ2V0KCdNYXJrZG93bl9NYXJrZWRfU21hcnRMaXN0cycpOyB9XG5cdGlmIChzbWFydHlwYW50cyA9PSBudWxsKSB7IHNtYXJ0eXBhbnRzID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01hcmtkb3duX01hcmtlZF9TbWFydHlwYW50cycpOyB9XG5cblx0bXNnLmh0bWwgPSBfbWFya2VkKHMudW5lc2NhcGVIVE1MKG1zZy5odG1sKSwge1xuXHRcdGdmbSxcblx0XHR0YWJsZXMsXG5cdFx0YnJlYWtzLFxuXHRcdHBlZGFudGljLFxuXHRcdHNtYXJ0TGlzdHMsXG5cdFx0c21hcnR5cGFudHMsXG5cdFx0cmVuZGVyZXIsXG5cdFx0c2FuaXRpemU6IHRydWUsXG5cdFx0aGlnaGxpZ2h0XG5cdH0pO1xuXG5cdHJldHVybiBtc2c7XG59O1xuIiwiLypcbiAqIGNvZGUoKSBpcyBhIG5hbWVkIGZ1bmN0aW9uIHRoYXQgd2lsbCBwYXJzZSBgaW5saW5lIGNvZGVgIGFuZCBgYGBjb2RlYmxvY2tgYGAgc3ludGF4ZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlIC0gVGhlIG1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHMgZnJvbSAndW5kZXJzY29yZS5zdHJpbmcnO1xuaW1wb3J0IGhsanMgZnJvbSAnaGlnaGxpZ2h0LmpzJztcblxuY29uc3QgaW5saW5lY29kZSA9IChtZXNzYWdlKSA9PiB7XG5cdC8vIFN1cHBvcnQgYHRleHRgXG5cdHJldHVybiBtZXNzYWdlLmh0bWwgPSBtZXNzYWdlLmh0bWwucmVwbGFjZSgvKF58Jmd0O3xbID5fKn5dKVxcYChbXmBcXHJcXG5dKylcXGAoWzxfKn5dfFxcQnxcXGJ8JCkvZ20sIChtYXRjaCwgcDEsIHAyLCBwMykgPT4ge1xuXHRcdGNvbnN0IHRva2VuID0gYD0hPSR7IFJhbmRvbS5pZCgpIH09IT1gO1xuXG5cdFx0bWVzc2FnZS50b2tlbnMucHVzaCh7XG5cdFx0XHR0b2tlbixcblx0XHRcdHRleHQ6IGAkeyBwMSB9PHNwYW4gY2xhc3M9XFxcImNvcHlvbmx5XFxcIj5cXGA8L3NwYW4+PHNwYW4+PGNvZGUgY2xhc3M9XFxcImNvZGUtY29sb3JzIGlubGluZVxcXCI+JHsgcDIgfTwvY29kZT48L3NwYW4+PHNwYW4gY2xhc3M9XFxcImNvcHlvbmx5XFxcIj5cXGA8L3NwYW4+JHsgcDMgfWAsXG5cdFx0XHRub0h0bWw6IG1hdGNoXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdG9rZW47XG5cdH0pO1xufTtcblxuY29uc3QgY29kZWJsb2NrcyA9IChtZXNzYWdlKSA9PiB7XG5cdC8vIENvdW50IG9jY3VyZW5jaWVzIG9mIGBgYFxuXHRjb25zdCBjb3VudCA9IChtZXNzYWdlLmh0bWwubWF0Y2goL2BgYC9nKSB8fCBbXSkubGVuZ3RoO1xuXG5cdGlmIChjb3VudCkge1xuXG5cdFx0Ly8gQ2hlY2sgaWYgd2UgbmVlZCB0byBhZGQgYSBmaW5hbCBgYGBcblx0XHRpZiAoKGNvdW50ICUgMikgPiAwKSB7XG5cdFx0XHRtZXNzYWdlLmh0bWwgPSBgJHsgbWVzc2FnZS5odG1sIH1cXG5cXGBcXGBcXGBgO1xuXHRcdFx0bWVzc2FnZS5tc2cgPSBgJHsgbWVzc2FnZS5tc2cgfVxcblxcYFxcYFxcYGA7XG5cdFx0fVxuXG5cdFx0Ly8gU2VwYXJhdGUgdGV4dCBpbiBjb2RlIGJsb2NrcyBhbmQgbm9uIGNvZGUgYmxvY2tzXG5cdFx0Y29uc3QgbXNnUGFydHMgPSBtZXNzYWdlLmh0bWwuc3BsaXQoLyheLiopKGBgYCg/OlthLXpBLVpdKyk/KD86KD86LnxcXHJ8XFxuKSo/KWBgYCkoLipcXG4/KSQvZ20pO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG1zZ1BhcnRzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Ly8gVmVyaWZ5IGlmIHRoaXMgcGFydCBpcyBjb2RlXG5cdFx0XHRjb25zdCBwYXJ0ID0gbXNnUGFydHNbaW5kZXhdO1xuXHRcdFx0Y29uc3QgY29kZU1hdGNoID0gcGFydC5tYXRjaCgvXmBgYCguKltcXHJcXG5cXCBdPykoW1xcc1xcU10qPylgYGArPyQvKTtcblxuXHRcdFx0aWYgKGNvZGVNYXRjaCAhPSBudWxsKSB7XG5cdFx0XHRcdC8vIFByb2Nlc3MgaGlnaGxpZ2h0IGlmIHRoaXMgcGFydCBpcyBjb2RlXG5cdFx0XHRcdGNvbnN0IHNpbmdsZUxpbmUgPSBjb2RlTWF0Y2hbMF0uaW5kZXhPZignXFxuJykgPT09IC0xO1xuXHRcdFx0XHRjb25zdCBsYW5nID0gIXNpbmdsZUxpbmUgJiYgQXJyYXkuZnJvbShobGpzLmxpc3RMYW5ndWFnZXMoKSkuaW5jbHVkZXMocy50cmltKGNvZGVNYXRjaFsxXSkpID8gcy50cmltKGNvZGVNYXRjaFsxXSkgOiAnJztcblx0XHRcdFx0Y29uc3QgY29kZSA9XG5cdFx0XHRcdFx0c2luZ2xlTGluZSA/XG5cdFx0XHRcdFx0XHRzLnVuZXNjYXBlSFRNTChjb2RlTWF0Y2hbMV0pIDpcblx0XHRcdFx0XHRcdGxhbmcgPT09ICcnID9cblx0XHRcdFx0XHRcdFx0cy51bmVzY2FwZUhUTUwoY29kZU1hdGNoWzFdICsgY29kZU1hdGNoWzJdKSA6XG5cdFx0XHRcdFx0XHRcdHMudW5lc2NhcGVIVE1MKGNvZGVNYXRjaFsyXSk7XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gbGFuZyA9PT0gJycgPyBobGpzLmhpZ2hsaWdodEF1dG8oKGxhbmcgKyBjb2RlKSkgOiBobGpzLmhpZ2hsaWdodChsYW5nLCBjb2RlKTtcblx0XHRcdFx0Y29uc3QgdG9rZW4gPSBgPSE9JHsgUmFuZG9tLmlkKCkgfT0hPWA7XG5cblx0XHRcdFx0bWVzc2FnZS50b2tlbnMucHVzaCh7XG5cdFx0XHRcdFx0aGlnaGxpZ2h0OiB0cnVlLFxuXHRcdFx0XHRcdHRva2VuLFxuXHRcdFx0XHRcdHRleHQ6IGA8cHJlPjxjb2RlIGNsYXNzPSdjb2RlLWNvbG9ycyBobGpzICR7IHJlc3VsdC5sYW5ndWFnZSB9Jz48c3BhbiBjbGFzcz0nY29weW9ubHknPlxcYFxcYFxcYDxicj48L3NwYW4+JHsgcmVzdWx0LnZhbHVlIH08c3BhbiBjbGFzcz0nY29weW9ubHknPjxicj5cXGBcXGBcXGA8L3NwYW4+PC9jb2RlPjwvcHJlPmAsXG5cdFx0XHRcdFx0bm9IdG1sOiBgXFxgXFxgXFxgXFxuJHsgcy5zdHJpcFRhZ3MocmVzdWx0LnZhbHVlKSB9XFxuXFxgXFxgXFxgYFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRtc2dQYXJ0c1tpbmRleF0gPSB0b2tlbjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1zZ1BhcnRzW2luZGV4XSA9IHBhcnQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmUtbW91bnQgbWVzc2FnZVxuXHRcdHJldHVybiBtZXNzYWdlLmh0bWwgPSBtc2dQYXJ0cy5qb2luKCcnKTtcblx0fVxufTtcblxuZXhwb3J0IGNvbnN0IGNvZGUgPSAobWVzc2FnZSkgPT4ge1xuXHRpZiAocy50cmltKG1lc3NhZ2UuaHRtbCkpIHtcblx0XHRpZiAobWVzc2FnZS50b2tlbnMgPT0gbnVsbCkge1xuXHRcdFx0bWVzc2FnZS50b2tlbnMgPSBbXTtcblx0XHR9XG5cblx0XHRjb2RlYmxvY2tzKG1lc3NhZ2UpO1xuXHRcdGlubGluZWNvZGUobWVzc2FnZSk7XG5cdH1cblxuXHRyZXR1cm4gbWVzc2FnZTtcbn07XG4iLCIvKlxuICogTWFya2Rvd24gaXMgYSBuYW1lZCBmdW5jdGlvbiB0aGF0IHdpbGwgcGFyc2UgbWFya2Rvd24gc3ludGF4XG4gKiBAcGFyYW0ge1N0cmluZ30gbXNnIC0gVGhlIG1lc3NhZ2UgaHRtbFxuICovXG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgUm9ja2V0Q2hhdCB9IGZyb20gJ21ldGVvci9yb2NrZXRjaGF0OmxpYic7XG5pbXBvcnQgcyBmcm9tICd1bmRlcnNjb3JlLnN0cmluZyc7XG5cbmNvbnN0IHBhcnNlTm90RXNjYXBlZCA9IGZ1bmN0aW9uKG1zZywgbWVzc2FnZSkge1xuXHRpZiAobWVzc2FnZSAmJiBtZXNzYWdlLnRva2VucyA9PSBudWxsKSB7XG5cdFx0bWVzc2FnZS50b2tlbnMgPSBbXTtcblx0fVxuXG5cdGNvbnN0IGFkZEFzVG9rZW4gPSBmdW5jdGlvbihodG1sKSB7XG5cdFx0Y29uc3QgdG9rZW4gPSBgPSE9JHsgUmFuZG9tLmlkKCkgfT0hPWA7XG5cdFx0bWVzc2FnZS50b2tlbnMucHVzaCh7XG5cdFx0XHR0b2tlbixcblx0XHRcdHRleHQ6IGh0bWxcblx0XHR9KTtcblxuXHRcdHJldHVybiB0b2tlbjtcblx0fTtcblxuXHRjb25zdCBzY2hlbWVzID0gUm9ja2V0Q2hhdC5zZXR0aW5ncy5nZXQoJ01hcmtkb3duX1N1cHBvcnRTY2hlbWVzRm9yTGluaycpLnNwbGl0KCcsJykuam9pbignfCcpO1xuXG5cdGlmIChSb2NrZXRDaGF0LnNldHRpbmdzLmdldCgnTWFya2Rvd25fSGVhZGVycycpKSB7XG5cdFx0Ly8gU3VwcG9ydCAjIFRleHQgZm9yIGgxXG5cdFx0bXNnID0gbXNnLnJlcGxhY2UoL14jICgoW1xcU1xcd1xcZC1fXFwvXFwqXFwuLFxcXFxdWyBcXHUwMGEwXFx1MTY4MFxcdTE4MGVcXHUyMDAwLVxcdTIwMGFcXHUyMDI4XFx1MjAyOVxcdTIwMmZcXHUyMDVmXFx1MzAwMFxcdWZlZmZdPykrKS9nbSwgJzxoMT4kMTwvaDE+Jyk7XG5cblx0XHQvLyBTdXBwb3J0ICMgVGV4dCBmb3IgaDJcblx0XHRtc2cgPSBtc2cucmVwbGFjZSgvXiMjICgoW1xcU1xcd1xcZC1fXFwvXFwqXFwuLFxcXFxdWyBcXHUwMGEwXFx1MTY4MFxcdTE4MGVcXHUyMDAwLVxcdTIwMGFcXHUyMDI4XFx1MjAyOVxcdTIwMmZcXHUyMDVmXFx1MzAwMFxcdWZlZmZdPykrKS9nbSwgJzxoMj4kMTwvaDI+Jyk7XG5cblx0XHQvLyBTdXBwb3J0ICMgVGV4dCBmb3IgaDNcblx0XHRtc2cgPSBtc2cucmVwbGFjZSgvXiMjIyAoKFtcXFNcXHdcXGQtX1xcL1xcKlxcLixcXFxcXVsgXFx1MDBhMFxcdTE2ODBcXHUxODBlXFx1MjAwMC1cXHUyMDBhXFx1MjAyOFxcdTIwMjlcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHVmZWZmXT8pKykvZ20sICc8aDM+JDE8L2gzPicpO1xuXG5cdFx0Ly8gU3VwcG9ydCAjIFRleHQgZm9yIGg0XG5cdFx0bXNnID0gbXNnLnJlcGxhY2UoL14jIyMjICgoW1xcU1xcd1xcZC1fXFwvXFwqXFwuLFxcXFxdWyBcXHUwMGEwXFx1MTY4MFxcdTE4MGVcXHUyMDAwLVxcdTIwMGFcXHUyMDI4XFx1MjAyOVxcdTIwMmZcXHUyMDVmXFx1MzAwMFxcdWZlZmZdPykrKS9nbSwgJzxoND4kMTwvaDQ+Jyk7XG5cdH1cblxuXHQvLyBTdXBwb3J0ICp0ZXh0KiB0byBtYWtlIGJvbGRcblx0bXNnID0gbXNnLnJlcGxhY2UoLyhefCZndDt8WyA+X35gXSlcXCp7MSwyfShbXlxcKlxcclxcbl0rKVxcKnsxLDJ9KFs8X35gXXxcXEJ8XFxifCQpL2dtLCAnJDE8c3BhbiBjbGFzcz1cImNvcHlvbmx5XCI+Kjwvc3Bhbj48c3Ryb25nPiQyPC9zdHJvbmc+PHNwYW4gY2xhc3M9XCJjb3B5b25seVwiPio8L3NwYW4+JDMnKTtcblxuXHQvLyBTdXBwb3J0IF90ZXh0XyB0byBtYWtlIGl0YWxpY3Ncblx0bXNnID0gbXNnLnJlcGxhY2UoLyhefCZndDt8WyA+Kn5gXSlcXF97MSwyfShbXlxcX1xcclxcbl0rKVxcX3sxLDJ9KFs8Kn5gXXxcXEJ8XFxifCQpL2dtLCAnJDE8c3BhbiBjbGFzcz1cImNvcHlvbmx5XCI+Xzwvc3Bhbj48ZW0+JDI8L2VtPjxzcGFuIGNsYXNzPVwiY29weW9ubHlcIj5fPC9zcGFuPiQzJyk7XG5cblx0Ly8gU3VwcG9ydCB+dGV4dH4gdG8gc3RyaWtlIHRocm91Z2ggdGV4dFxuXHRtc2cgPSBtc2cucmVwbGFjZSgvKF58Jmd0O3xbID5fKmBdKVxcfnsxLDJ9KFteflxcclxcbl0rKVxcfnsxLDJ9KFs8XypgXXxcXEJ8XFxifCQpL2dtLCAnJDE8c3BhbiBjbGFzcz1cImNvcHlvbmx5XCI+fjwvc3Bhbj48c3RyaWtlPiQyPC9zdHJpa2U+PHNwYW4gY2xhc3M9XCJjb3B5b25seVwiPn48L3NwYW4+JDMnKTtcblxuXHQvLyBTdXBwb3J0IGZvciBibG9jayBxdW90ZVxuXHQvLyA+Pj5cblx0Ly8gVGV4dFxuXHQvLyA8PDxcblx0bXNnID0gbXNnLnJlcGxhY2UoLyg/OiZndDspezN9XFxuKyhbXFxzXFxTXSo/KVxcbisoPzombHQ7KXszfS9nLCAnPGJsb2NrcXVvdGUgY2xhc3M9XCJiYWNrZ3JvdW5kLXRyYW5zcGFyZW50LWRhcmtlci1iZWZvcmVcIj48c3BhbiBjbGFzcz1cImNvcHlvbmx5XCI+Jmd0OyZndDsmZ3Q7PC9zcGFuPiQxPHNwYW4gY2xhc3M9XCJjb3B5b25seVwiPiZsdDsmbHQ7Jmx0Ozwvc3Bhbj48L2Jsb2NrcXVvdGU+Jyk7XG5cblx0Ly8gU3VwcG9ydCA+VGV4dCBmb3IgcXVvdGVcblx0bXNnID0gbXNnLnJlcGxhY2UoL14mZ3Q7KC4qKSQvZ20sICc8YmxvY2txdW90ZSBjbGFzcz1cImJhY2tncm91bmQtdHJhbnNwYXJlbnQtZGFya2VyLWJlZm9yZVwiPjxzcGFuIGNsYXNzPVwiY29weW9ubHlcIj4mZ3Q7PC9zcGFuPiQxPC9ibG9ja3F1b3RlPicpO1xuXG5cdC8vIFJlbW92ZSB3aGl0ZS1zcGFjZSBhcm91bmQgYmxvY2txdW90ZSAocHJldmVudCA8YnI+KS4gQmVjYXVzZSBibG9ja3F1b3RlIGlzIGJsb2NrIGVsZW1lbnQuXG5cdG1zZyA9IG1zZy5yZXBsYWNlKC9cXHMqPGJsb2NrcXVvdGUgY2xhc3M9XCJiYWNrZ3JvdW5kLXRyYW5zcGFyZW50LWRhcmtlci1iZWZvcmVcIj4vZ20sICc8YmxvY2txdW90ZSBjbGFzcz1cImJhY2tncm91bmQtdHJhbnNwYXJlbnQtZGFya2VyLWJlZm9yZVwiPicpO1xuXHRtc2cgPSBtc2cucmVwbGFjZSgvPFxcL2Jsb2NrcXVvdGU+XFxzKi9nbSwgJzwvYmxvY2txdW90ZT4nKTtcblxuXHQvLyBSZW1vdmUgbmV3LWxpbmUgYmV0d2VlbiBibG9ja3F1b3Rlcy5cblx0bXNnID0gbXNnLnJlcGxhY2UoLzxcXC9ibG9ja3F1b3RlPlxcbjxibG9ja3F1b3RlL2dtLCAnPC9ibG9ja3F1b3RlPjxibG9ja3F1b3RlJyk7XG5cblx0Ly8gU3VwcG9ydCAhW2FsdCB0ZXh0XShodHRwOi8vaW1hZ2UgdXJsKVxuXHRtc2cgPSBtc2cucmVwbGFjZShuZXcgUmVnRXhwKGAhXFxcXFsoW15cXFxcXV0rKVxcXFxdXFxcXCgoKD86JHsgc2NoZW1lcyB9KTpcXFxcL1xcXFwvW15cXFxcKV0rKVxcXFwpYCwgJ2dtJyksIChtYXRjaCwgdGl0bGUsIHVybCkgPT4ge1xuXHRcdGNvbnN0IHRhcmdldCA9IHVybC5pbmRleE9mKE1ldGVvci5hYnNvbHV0ZVVybCgpKSA9PT0gMCA/ICcnIDogJ19ibGFuayc7XG5cdFx0cmV0dXJuIGFkZEFzVG9rZW4oYDxhIGhyZWY9XCIkeyBzLmVzY2FwZUhUTUwodXJsKSB9XCIgdGl0bGU9XCIkeyBzLmVzY2FwZUhUTUwodGl0bGUpIH1cIiB0YXJnZXQ9XCIkeyBzLmVzY2FwZUhUTUwodGFyZ2V0KSB9XCIgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiPjxkaXYgY2xhc3M9XCJpbmxpbmUtaW1hZ2VcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6IHVybCgkeyBzLmVzY2FwZUhUTUwodXJsKSB9KTtcIj48L2Rpdj48L2E+YCk7XG5cdH0pO1xuXG5cdC8vIFN1cHBvcnQgW1RleHRdKGh0dHA6Ly9saW5rKVxuXHRtc2cgPSBtc2cucmVwbGFjZShuZXcgUmVnRXhwKGBcXFxcWyhbXlxcXFxdXSspXFxcXF1cXFxcKCgoPzokeyBzY2hlbWVzIH0pOlxcXFwvXFxcXC9bXlxcXFwpXSspXFxcXClgLCAnZ20nKSwgKG1hdGNoLCB0aXRsZSwgdXJsKSA9PiB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gdXJsLmluZGV4T2YoTWV0ZW9yLmFic29sdXRlVXJsKCkpID09PSAwID8gJycgOiAnX2JsYW5rJztcblx0XHRyZXR1cm4gYWRkQXNUb2tlbihgPGEgaHJlZj1cIiR7IHMuZXNjYXBlSFRNTCh1cmwpIH1cIiB0YXJnZXQ9XCIkeyBzLmVzY2FwZUhUTUwodGFyZ2V0KSB9XCIgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiPiR7IHMuZXNjYXBlSFRNTCh0aXRsZSkgfTwvYT5gKTtcblx0fSk7XG5cblx0Ly8gU3VwcG9ydCA8aHR0cDovL2xpbmt8VGV4dD5cblx0bXNnID0gbXNnLnJlcGxhY2UobmV3IFJlZ0V4cChgKD86PHwmbHQ7KSgoPzokeyBzY2hlbWVzIH0pOlxcXFwvXFxcXC9bXlxcXFx8XSspXFxcXHwoLis/KSg/PT58Jmd0OykoPzo+fCZndDspYCwgJ2dtJyksIChtYXRjaCwgdXJsLCB0aXRsZSkgPT4ge1xuXHRcdGNvbnN0IHRhcmdldCA9IHVybC5pbmRleE9mKE1ldGVvci5hYnNvbHV0ZVVybCgpKSA9PT0gMCA/ICcnIDogJ19ibGFuayc7XG5cdFx0cmV0dXJuIGFkZEFzVG9rZW4oYDxhIGhyZWY9XCIkeyBzLmVzY2FwZUhUTUwodXJsKSB9XCIgdGFyZ2V0PVwiJHsgcy5lc2NhcGVIVE1MKHRhcmdldCkgfVwiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj4keyBzLmVzY2FwZUhUTUwodGl0bGUpIH08L2E+YCk7XG5cdH0pO1xuXG5cdHJldHVybiBtc2c7XG59O1xuXG5leHBvcnQgY29uc3QgbWFya2Rvd24gPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdG1lc3NhZ2UuaHRtbCA9IHBhcnNlTm90RXNjYXBlZChtZXNzYWdlLmh0bWwsIG1lc3NhZ2UpO1xuXHRyZXR1cm4gbWVzc2FnZTtcbn07XG4iLCIvKlxuICogTWFya2Rvd24gaXMgYSBuYW1lZCBmdW5jdGlvbiB0aGF0IHdpbGwgcGFyc2UgbWFya2Rvd24gc3ludGF4XG4gKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIG9iamVjdFxuICovXG5pbXBvcnQgeyBtYXJrZG93biB9IGZyb20gJy4vbWFya2Rvd24uanMnO1xuaW1wb3J0IHsgY29kZSB9IGZyb20gJy4vY29kZS5qcyc7XG5cbmV4cG9ydCBjb25zdCBvcmlnaW5hbCA9IChtZXNzYWdlKSA9PiB7XG5cdC8vIFBhcnNlIG1hcmtkb3duIGNvZGVcblx0bWVzc2FnZSA9IGNvZGUobWVzc2FnZSk7XG5cblx0Ly8gUGFyc2UgbWFya2Rvd25cblx0bWVzc2FnZSA9IG1hcmtkb3duKG1lc3NhZ2UpO1xuXG5cdC8vIFJlcGxhY2UgbGluZWJyZWFrIHRvIGJyXG5cdG1lc3NhZ2UuaHRtbCA9IG1lc3NhZ2UuaHRtbC5yZXBsYWNlKC9cXG4vZ20sICc8YnI+Jyk7XG5cblx0cmV0dXJuIG1lc3NhZ2U7XG59O1xuIl19
