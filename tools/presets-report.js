/* Runs every example design through the solver and prints what happens. Usage: node tools/presets-report.js [seconds] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const P = require('../src/physics.js');
const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const m = src.match(/const PRESETS = (\[[\s\S]*?\n\]);/);
const PRESETS = vm.runInNewContext(m[1]);
const secs = +process.argv[2] || 240;
for (const pr of PRESETS) {
  const s = P.create(Object.assign(P.defaults(), pr.p)); s.phiTarget = 1;
  let hb = 0, first = null;
  for (let i = 0, n = Math.round(secs / s.dt); i < n; i++) { P.step(s); if (s.Hb > hb) hb = s.Hb; if (s.V.delivered > 0 && first === null) first = s.t; }
  const b = P.balance(s), f = Object.keys(s.fail).filter(k => s.fail[k]).map(k => k + '@' + s.fail[k].t.toFixed(1) + 's');
  const st = P.strength(s).map(r => r.key + ' ' + (r.ratio * 100).toFixed(1) + '%').join(' | ');
  console.log(pr.id.padEnd(8), 'N', String(s.N).padStart(3), 'bpm', P.beatRate(s).toFixed(0).padStart(3), 'firstWater', first === null ? '--' : first.toFixed(0) + 's',
    'deliv', (b.delivered * 1000).toFixed(1) + 'L', 'eta', b.etaDAubuisson.toFixed(2), 'peakHb', hb.toFixed(0) + 'm', 'fails', f.join(',') || 'none');
  console.log('         ', st, ' balance', Math.abs(b.residualBody).toExponential(0), Math.abs(b.residualDelivery).toExponential(0));
}
