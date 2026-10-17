#!/usr/bin/env node
/* Builds a single self-contained HTML file from index.html and src/.
 *   node tools/build.js                -> dist/ram-pump.html   (full page, works offline except web fonts)
 *   node tools/build.js --fragment     -> dist/ram-pump.fragment.html (body-only page for hosts that add their own <html>) */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const frag = process.argv.includes('--fragment');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="src\/styles.css">/, () => '<style>\n' + fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="(src\/[^"]+)"><\/script>\n?/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '\n</script>\n');
if (frag) {
  const title = '<title>Hydraulic Ram Pump</title>';
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/)[0];
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  html = title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + fonts + '\n' + style + '\n' + body.replace('<script>\n/* Hydraulic', '<script>window.RAM_DIALOG=true;</script>\n<script>\n/* Hydraulic');
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', frag ? 'ram-pump.fragment.html' : 'ram-pump.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(root, out), (html.length / 1024).toFixed(0) + ' kB');
