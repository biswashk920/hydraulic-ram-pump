#!/usr/bin/env node
/* Builds the single self-contained page docs/index.html from src/page.template + src/*.css + src/*.js.
 *   node tools/build.js
 * GitHub Pages serves docs/index.html directly, and you can also just double-click it. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'src/page.template'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="src\/styles.css">/, () => '<style>\n' + fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="(src\/[^"]+)"><\/script>\n?/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '\n</script>\n');
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/index.html'), html);
console.log('wrote docs/index.html', (html.length / 1024).toFixed(0) + ' kB');
