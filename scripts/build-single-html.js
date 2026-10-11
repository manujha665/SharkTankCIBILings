#!/usr/bin/env node
/*
 * Bundles app/ into one self-contained HTML file: dist/PortfolioIQ.html
 * (all CSS and JS inlined, no external requests). Run: node scripts/build-single-html.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const OUT_DIR = path.join(__dirname, '..', 'dist');
const OUT = path.join(OUT_DIR, 'PortfolioIQ.html');

let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');
// A literal "</script" inside inlined code would end the tag early
const safe = (code) => code.replace(/<\/script/gi, '<\\/script');

html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g, (_, href) => `<style>\n${read(href)}\n</style>`);
let count = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  count++;
  return `<script>/* ${src} */\n${safe(read(src))}\n</script>`;
});
html = html.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <meta name="description" content="PortfolioIQ prototype: credit & lending intelligence with a governed AI analyst. Synthetic demo data." />');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${count} scripts inlined, ${(html.length / 1024).toFixed(0)} KB)`);
