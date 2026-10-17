/* Writes examples/designs/*.json (every preset) and examples/results/*.csv (summary of each preset after a 240 s run).
   Usage: node tools/export-examples.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const P = require('../src/physics.js');
const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const PRESETS = vm.runInNewContext(src.match(/const PRESETS = (\[[\s\S]*?\n\]);/)[1]);
const out = path.join(__dirname, '../examples');
fs.mkdirSync(out + '/designs', { recursive: true }); fs.mkdirSync(out + '/results', { recursive: true });
const rows = ['design,name,seconds,beats_per_min,intake_L,wasted_L,stored_L,delivered_L,dAubuisson_eta,peak_body_head_m,failures'];
for (const pr of PRESETS) {
  const p = Object.assign(P.defaults(), pr.p);
  fs.writeFileSync(`${out}/designs/${pr.id}.json`, JSON.stringify({ id: pr.id, name: pr.name, parameters: p }, null, 2) + '\n');
  const s = P.create(p); s.phiTarget = 1; let hb = 0; const secs = 240;
  for (let i = 0, n = Math.round(secs / s.dt); i < n; i++) { P.step(s); if (s.Hb > hb) hb = s.Hb; }
  const b = P.balance(s), f = Object.keys(s.fail).filter(k => s.fail[k]).map(k => k + '@' + s.fail[k].t.toFixed(1) + 's').join(' ') || 'none';
  rows.push([pr.id, JSON.stringify(pr.name || pr.id), secs, P.beatRate(s).toFixed(1), (b.intake * 1e3).toFixed(2), (b.waste * 1e3).toFixed(2),
    ((b.stored + b.column) * 1e3).toFixed(2), (b.delivered * 1e3).toFixed(2), b.etaDAubuisson.toFixed(3), hb.toFixed(1), f].join(','));
}
fs.writeFileSync(`${out}/results/presets-240s.csv`, rows.join('\n') + '\n');
console.log(rows.join('\n'));
