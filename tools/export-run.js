/* Writes the solver output used by the Python notebook for its cross-check.  node tools/export-run.js */
const fs = require('fs'), path = require('path');
const P = require('../src/physics.js');
const cases = { village: {}, tall: { Hs: 5, L: 25, D: .075, e: .004, ds: .075, stroke: .0112, vratio: .8, dc: .04, Vch: .01, Dch: .15, Dd: .032, ed: .0029, Ld: 150, h: 60 } };
fs.mkdirSync(path.join(__dirname, '../python/data'), { recursive: true });
for (const [name, cfg] of Object.entries(cases)) {
  const s = P.create(Object.assign(P.defaults(), cfg, { burst: false })); s.phiTarget = 1;
  const every = Math.round(0.5 / s.dt), n = Math.round(120 / s.dt);
  const rows = ['step,t,Hb,Hch,Hpipe,y,x,vd,beats,V_intake,V_drive,V_waste,V_pump,V_delivered'];
  for (let i = 1; i <= n; i++) {
    P.step(s);
    if (i % every === 0) rows.push([i, s.t, s.Hb, s.Hch, s.Hpipe, s.y, s.x, s.vd, s.beats, s.V.intake, s.V.drive, s.V.waste, s.V.pump, s.V.delivered].map(v => typeof v === 'number' ? v.toPrecision(15) : v).join(','));
  }
  fs.writeFileSync(path.join(__dirname, '../python/data/js_' + name + '_run.csv'), rows.join('\n') + '\n');
  console.log(name, rows.length - 1, 'rows, dt =', s.dt);
}
