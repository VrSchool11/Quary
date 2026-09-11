'use strict';
// Generates index.html (the deployed page) from the split sources in src/.
//
//   node build.js
//
// index.html is src/index.html with style.css inlined into a <style> block and
// core.js + entities.js + render-ui.js concatenated into one <script>. It is a
// build output - edit the split sources, never index.html. Deploying one bundled
// file means there is no set of <script src> tags that can point at a stale or
// half-written version of one of them.

const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const SCRIPTS = ['core.js', 'entities.js', 'render-ui.js'];
const OUT = 'index.html';

let html = read('src/index.html');

// 1. inline the stylesheet
const linkRe = /^[ \t]*<link rel="stylesheet" href="style\.css[^"]*"[^>]*>[ \t]*\r?\n/m;
if (!linkRe.test(html)) throw new Error('build: could not find the style.css <link> in index.html');
html = html.replace(linkRe, `    <style>\n${read('style.css').trimEnd()}\n    </style>\n`);

// 2. replace the three <script src> tags with one inline block
const tagRe = new RegExp(
  SCRIPTS.map(s => `[ \\t]*<script src="${s.replace('.', '\\.')}[^"]*"[^>]*></script>[ \\t]*\\r?\\n`).join(''),
  'm',
);
if (!tagRe.test(html)) throw new Error('build: could not find the three <script src> tags in index.html');

const bundle = SCRIPTS.map(f => read(f).trimEnd()).join('\n');
// a literal </script> inside the JS would close the block early
if (/<\/script/i.test(bundle)) throw new Error('build: source contains a literal </script>');

html = html.replace(tagRe, `    <script defer>\n${bundle}\n    </script>\n`);

fs.writeFileSync(path.join(root, OUT), html);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`${OUT} written - ${kb(html.length)} (${SCRIPTS.join(' + ')} + style.css + index.html)`);
