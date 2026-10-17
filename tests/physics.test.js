'use strict';
/* Run with:  node --test tests/        (Node 18 or newer, no dependencies) */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/physics.js');

const run = (cfg, seconds, opts) => {
  const s = P.create(Object.assign(P.defaults(), cfg));
  s.phiTarget = 1;
  const n = Math.round(seconds / s.dt);
  let hbPeak = 0, hchPeak = 0;
  for (let i = 0; i < n; i++) { P.step(s); if (s.Hb > hbPeak) hbPeak = s.Hb; if (s.Hch > hchPeak) hchPeak = s.Hch; }
  s.hbPeak = hbPeak; s.hchPeak = hchPeak;
  return s;
};
const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg}: ${a} vs ${b} (tolerance ${rel * 100}%)`);
const noNaN = s => {
  for (const arr of [s.H, s.QL, s.QR]) for (const v of arr) assert.ok(Number.isFinite(v), 'non-finite value in pipe state');
  for (const k of ['Hb', 'Hch', 'Vw', 'x', 'vd', 'y']) assert.ok(Number.isFinite(s[k]), k + ' is not finite');
};

test('wave speed follows the Korteweg formula', () => {
  const a = P.waveSpeed({ D: 0.05, e: 0.0035, mat: 'steel' });
  const expected = Math.sqrt(2.2e9 / 1000) / Math.sqrt(1 + 2.2e9 * 0.05 / (200e9 * 0.0035));
  near(a, expected, 1e-12, 'steel wave speed');
  assert.ok(a > 1300 && a < 1450, 'steel 50 mm pipe is about 1380 m/s');
  const aPvc = P.waveSpeed({ D: 0.05, e: 0.003, mat: 'pvc' });
  assert.ok(aPvc < 500, 'PVC is much slower than steel');
});

test('hoop stress and burst head are consistent', () => {
  const sigma = P.hoop(100, 0.05, 0.003);               // 100 m of water
  near(sigma, 1000 * 9.81 * 100 * 0.053 / (2 * 0.003), 1e-12, 'hoop stress');
  const hb = P.burstHead('pvc', 0.05, 0.003);
  near(P.hoop(hb, 0.05, 0.003), P.MATERIALS.pvc.Su, 1e-9, 'burst head returns the tensile strength');
  assert.equal(P.hoop(-5, 0.05, 0.003), 0, 'suction does not create hoop tension');
});

test('water balance closes exactly at the pump body and in the delivery system', () => {
  const s = run({}, 150);
  const b = P.balance(s);
  assert.ok(s.beats > 100, 'pump is beating');
  assert.ok(b.delivered > 0.01, 'water reached the tank');
  assert.ok(Math.abs(b.residualBody) < 1e-12, 'drive = waste + pumped: ' + b.residualBody);
  assert.ok(Math.abs(b.residualDelivery) < 1e-12, 'pumped = stored + rising + delivered: ' + b.residualDelivery);
  assert.ok(Math.abs(b.residualPipe) < 1e-4 * b.drive, 'intake = drive flow within pipe compressibility: ' + b.residualPipe);
  assert.ok(b.waste > b.delivered, 'most of the water is wasted, as in a real ram pump');
});

test('default pump beats at a realistic rate with a realistic efficiency', () => {
  const s = run({}, 150);
  const bpm = P.beatRate(s), b = P.balance(s);
  assert.ok(bpm > 30 && bpm < 120, 'beat rate ' + bpm);
  // D'Aubuisson efficiency over the whole run includes the start-up charge, so use the late window
  const s2 = run({}, 400); const late = P.balance(s2);
  assert.ok(late.etaDAubuisson > 0.3 && late.etaDAubuisson < 0.7, 'efficiency ' + late.etaDAubuisson);
  assert.ok(b.etaDAubuisson < 1, 'efficiency below 100 percent');
});

test('energy delivered never exceeds energy drawn', () => {
  for (const cfg of [{}, { Hs: 2, h: 10 }, { Hs: 8, L: 30, h: 60, Ld: 200 }, { D: 0.1, ds: 0.1, dc: 0.05, Dd: 0.05, Vch: 0.01 }]) {
    const s = run(cfg, 200);
    const b = P.balance(s);
    assert.ok(b.delivered * s.p.h <= b.drive * s.p.Hs, 'energy conservation for ' + JSON.stringify(cfg));
  }
});

test('instant valve closure gives the Joukowsky pressure rise', () => {
  const s = P.create(Object.assign(P.defaults(), { Hs: 20, L: 100, D: 0.05, ds: 0.1, stroke: 0.05, vratio: 200, dc: 0.002, Vch: 0.001, valveTime: 0.5 }));
  s.phiTarget = 1;
  for (let i = 0; i < Math.round(20 / s.dt); i++) P.step(s);
  const V0 = s.QR[s.N] / s.A, H0 = s.H[s.N];
  assert.ok(V0 > 1, 'steady flow established: ' + V0);
  s.p.valveTime = 0.002; s.phiTarget = 0;
  let peak = -1e9;
  for (let i = 0; i < Math.round(0.4 / s.dt); i++) { P.step(s); if (s.H[s.N] > peak) peak = s.H[s.N]; }
  const expected = H0 + s.a * V0 / 9.81;
  near(peak, expected, 0.06, 'peak pipe-end head against H0 + aV/g');
});

test('steady flow matches the analytic energy equation', () => {
  const cfg = { Hs: 10, L: 40, D: 0.05, ds: 0.08, stroke: 0.05, vratio: 200, dc: 0.001, Vch: 0.001, valveTime: 0.2, burst: false };
  const s = P.create(Object.assign(P.defaults(), cfg));
  s.phiTarget = 1;
  for (let i = 0; i < Math.round(30 / s.dt); i++) P.step(s);
  const V = s.QR[s.N] / s.A;
  const Aw = Math.min(Math.PI * cfg.ds * s.y, s.As), K = 0.5 + 0.2 + P.fric(V, cfg.D, s.eps) * cfg.L / cfg.D + Math.pow(s.A / (0.65 * Aw), 2);
  const Vexp = Math.sqrt(2 * 9.81 * cfg.Hs / K);
  near(V, Vexp, 0.02, 'steady drive velocity');
});

test('closed supply valve leaves the pump at rest with hydrostatic pressure', () => {
  const s = P.create(P.defaults());
  for (let i = 0; i < 2000; i++) P.step(s);
  assert.equal(s.beats, 0);
  for (let i = 0; i <= s.N; i++) near(s.H[i], 4, 1e-9, 'static head');
  assert.equal(s.V.drive, 0);
});

test('thin weak drive pipe bursts, a strong pipe survives the same duty', () => {
  const duty = { Hs: 30, L: 20, h: 100, Ld: 300, Vch: 0.006 };
  const strong = run(Object.assign({ mat: 'steel', e: 0.004 }, duty), 60);
  assert.equal(strong.fail.drive, null, 'steel survives');
  // a 0.2 mm PVC wall is good for about 40 m of head; this duty produces far more
  assert.ok(P.burstHead('pvc', 0.05, 0.0002) < 60);
  const weak = run(Object.assign({ mat: 'pvc', e: 0.0002 }, duty), 60);
  assert.ok(weak.fail.drive, 'thin PVC bursts');
  assert.ok(weak.fail.drive.sigma >= P.MATERIALS.pvc.Su, 'burst happened at or above the strength');
  assert.ok(weak.fail.drive.dist >= 0 && weak.fail.drive.dist <= 20, 'burst location is inside the pipe');
  noNaN(weak);
  const b = P.balance(weak);
  assert.ok(b.driveLeak > 0, 'the burst leaks water');
  assert.ok(Math.abs(b.residualBody) < 1e-12 && Math.abs(b.residualDelivery) < 1e-12);
  assert.ok(Math.abs(b.residualPipe) < 2e-3 * Math.max(b.intake, 1e-9) + 1e-6, 'pipe balance after burst ' + b.residualPipe);
});

test('pump body bursts when its wall is too thin and balance still closes', () => {
  const ok = run({}, 40);
  const tCrit = 1000 * 9.81 * ok.hbPeak * ok.Dbody / (2 * P.MATERIALS.castiron.Su);   // wall at which the observed peak equals the strength
  const thick = run({ tb: tCrit * 1.25 }, 40), thin = run({ tb: tCrit * 0.8 }, 40);
  assert.equal(thick.fail.body, null, 'thicker wall holds');
  assert.ok(thin.fail.body, 'thinner wall fails');
  noNaN(thin);
  const b = P.balance(thin);
  assert.ok(b.bodyLeak > 0, 'water escapes through the burst body');
  assert.ok(Math.abs(b.residualBody) < 1e-12 && Math.abs(b.residualDelivery) < 1e-12, 'balance closes');
  const before = thin.V.pump;
  for (let i = 0; i < 20000; i++) P.step(thin);
  assert.ok(thin.V.pump - before < 0.02 * Math.max(thin.V.drive, 1e-9), 'a burst body stops pumping');
});

test('air chamber and delivery pipe bursts are detected and conserve water', () => {
  const ok = run({}, 60), pk = ok.hchPeak;
  const tCh = 1000 * 9.81 * pk * ok.p.Dch / (2 * P.MATERIALS.castiron.Su);
  assert.equal(run({ tch: tCh * 1.25 }, 60).fail.chamber, null, 'thicker chamber holds');
  const ch = run({ tch: tCh * 0.5 }, 60);
  assert.ok(ch.fail.chamber, 'chamber bursts');
  assert.equal(ch.Hch, 0);
  const bc = P.balance(ch);
  assert.ok(bc.chamberLeak > 0);
  assert.ok(Math.abs(bc.residualDelivery) < 1e-10, 'chamber burst balance ' + bc.residualDelivery);
  const edCrit = 1000 * 9.81 * pk * ok.p.Dd / (2 * P.MATERIALS.hdpe.Su);
  assert.equal(run({ ed: edCrit * 1.25 }, 60).fail.delivery, null, 'thicker delivery pipe holds');
  const del = run({ ed: edCrit * 0.4 }, 60);
  assert.ok(del.fail.delivery, 'delivery pipe bursts');
  const bd = P.balance(del);
  assert.ok(bd.deliveryLeak > 0);
  assert.ok(Math.abs(bd.residualDelivery) < 1e-10, 'delivery burst balance ' + bd.residualDelivery);
  noNaN(del); noNaN(ch);
});

test('disabling bursting lets stress exceed strength without failure', () => {
  const s = run({ ed: 0.00005, burst: false }, 40);
  assert.equal(s.fail.delivery, null);
  assert.ok(s.peak.delivery > P.MATERIALS.hdpe.Su);
});

test('extreme sizes stay numerically healthy', () => {
  const big = run({ Hs: 60, L: 1000, D: 0.15, e: 0.006, ds: 0.15, dc: 0.08, Vch: 0.05, Dch: 0.25, tch: 0.02, tb: 0.02,
    Dd: 0.1, Ld: 3000, h: 800, ed: 0.012, dmat: 'steel', burst: false }, 20);
  noNaN(big);
  const small = run({ Hs: 0.5, L: 3, D: 0.02, e: 0.002, ds: 0.02, dc: 0.01, Vch: 0.0005, Dch: 0.05, Dd: 0.01, Ld: 6, h: 2 }, 40);
  noNaN(small);
});

test('every pipe and pump material runs', () => {
  for (const m of P.PIPE_MATS) for (const pm of P.PUMP_MATS) {
    const s = run({ mat: m, pumpMat: pm, dmat: m, burst: false }, 10);
    noNaN(s);
  }
});

test('a prefilled delivery pipe starts at static head and keeps balance', () => {
  const s = run({ prefilled: true }, 120);
  const b = P.balance(s);
  assert.ok(Math.abs(b.residualBody) < 1e-12 && Math.abs(b.residualDelivery) < 1e-12);
  assert.equal(s.x, s.p.Ld);
  assert.ok(b.delivered > 0, 'prefilled pipe delivers');
});

test('closing the supply valve stops the beating and stays finite', () => {
  const s = run({}, 30);
  s.phiTarget = 0;
  for (let i = 0; i < Math.round(30 / s.dt); i++) P.step(s);
  noNaN(s);
  assert.ok(s.Qw < 1e-6);
});

test('simulation is deterministic', () => {
  const a = run({}, 20), b = run({}, 20);
  assert.equal(a.beats, b.beats);
  assert.equal(a.V.delivered, b.V.delivered);
  assert.equal(a.Hch, b.Hch);
});
