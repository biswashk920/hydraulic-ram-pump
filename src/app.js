/* ---------- app: controls, presets, loop, readouts, export ---------- */
const $ = id => document.getElementById(id);
const PH = RamPhysics, MAT = PH.MATERIALS;
const VERSION = '1.0.0';

/* Wall thickness defaults (mm) applied when the material is changed. */
const WALL_PIPE = { steel: 3.5, ductile: 6, castiron: 8, copper: 1.5, pvc: 3, hdpe: 4 };
const WALL_DELIVERY = { steel: 2.6, ductile: 5, castiron: 6, copper: 1, pvc: 2, hdpe: 2.3 };
const WALL_PUMP = { castiron: [8, 6], ductile: [6, 5], steel: [5, 4], bronze: [6, 5], aluminium: [8, 6], pvc: [8, 6] };
const selOf = keys => Object.fromEntries(keys.map(k => [k, MAT[k].name + '  (Su ' + (MAT[k].Su / 1e6) + ' MPa)']));

/* min/max drive the slider; hmin/hmax are the hard limits of the number box (there is no 100 m cap). */
const GROUPS = [
  { t: 'Source and drive pipe', open: true, f: [
    { k: 'Hs', l: 'Intake level above pump', u: 'm', min: .5, max: 60, st: .1, sc: 1, hmin: .2, hmax: 500 },
    { k: 'L', l: 'Drive pipe length', u: 'm', min: 2, max: 300, st: .5, sc: 1, hmin: 1, hmax: 5000 },
    { k: 'D', l: 'Drive pipe inner diameter', u: 'mm', min: 10, max: 300, st: 1, sc: 1000, hmin: 5, hmax: 1000 },
    { k: 'mat', l: 'Drive pipe material', sel: selOf(PH.PIPE_MATS), onSel: v => { params.e = WALL_PIPE[v] / 1000; sync('e') } },
    { k: 'e', l: 'Drive pipe wall thickness', u: 'mm', min: .2, max: 30, st: .1, sc: 1000, hmin: .05, hmax: 100 }]},
  { t: 'Waste (impulse) valve', open: true, f: [
    { k: 'ds', l: 'Seat diameter', u: 'mm', min: 10, max: 300, st: 1, sc: 1000, hmin: 5, hmax: 1000 },
    { k: 'stroke', l: 'Stroke (maximum lift)', u: 'mm', min: 1, max: 40, st: .5, sc: 1000, hmin: .5, hmax: 200 },
    { k: 'vratio', l: 'Spring preload ÷ static-head force', u: '×', min: .3, max: 3, st: .05, sc: 1, hmin: .1, hmax: 10 },
    { k: 'vmass', l: 'Moving mass of flap', u: 'kg', min: .05, max: 5, st: .05, sc: 1, hmin: .01, hmax: 50 }]},
  { t: 'Check valve and air chamber', open: false, f: [
    { k: 'dc', l: 'Check valve bore', u: 'mm', min: 5, max: 150, st: 1, sc: 1000, hmin: 3, hmax: 500 },
    { k: 'Vch', l: 'Air chamber volume', u: 'L', min: .2, max: 100, st: .1, sc: 1000, hmin: .05, hmax: 5000 },
    { k: 'Dch', l: 'Air chamber inner diameter', u: 'mm', min: 30, max: 600, st: 1, sc: 1000, hmin: 20, hmax: 2000 }]},
  { t: 'Pump body material', open: false, f: [
    { k: 'pumpMat', l: 'Material of body and chamber', sel: selOf(PH.PUMP_MATS), onSel: v => { params.tb = WALL_PUMP[v][0] / 1000; params.tch = WALL_PUMP[v][1] / 1000; sync('tb'); sync('tch') } },
    { k: 'tb', l: 'Pump body wall thickness', u: 'mm', min: .2, max: 60, st: .1, sc: 1000, hmin: .05, hmax: 200 },
    { k: 'tch', l: 'Air chamber wall thickness', u: 'mm', min: .2, max: 40, st: .1, sc: 1000, hmin: .05, hmax: 200 }]},
  { t: 'Delivery pipe', open: false, f: [
    { k: 'Dd', l: 'Inner diameter', u: 'mm', min: 5, max: 300, st: 1, sc: 1000, hmin: 3, hmax: 1000 },
    { k: 'Ld', l: 'Length', u: 'm', min: 3, max: 3000, st: 1, sc: 1, hmin: 1, hmax: 50000 },
    { k: 'h', l: 'Lift above pump', u: 'm', min: 1, max: 500, st: .5, sc: 1, hmin: .5, hmax: 5000 },
    { k: 'dmat', l: 'Delivery pipe material', sel: selOf(PH.PIPE_MATS), onSel: v => { params.ed = WALL_DELIVERY[v] / 1000; sync('ed') } },
    { k: 'ed', l: 'Delivery pipe wall thickness', u: 'mm', min: .2, max: 30, st: .1, sc: 1000, hmin: .05, hmax: 100 },
    { k: 'prefilled', l: 'Pipe starts full of water', chk: true }]},
  { t: 'Simulation options', open: false, f: [
    { k: 'valveTime', l: 'Supply valve travel time', u: 's', min: .1, max: 20, st: .1, sc: 1, hmin: .01, hmax: 120 },
    { k: 'burst', l: 'Allow parts to burst', chk: true }]}
];

/* Examples. Each is a partial parameter set applied over the defaults. */
const PRESETS = [
  { id: 'village', name: 'Village pump (default)', note: 'About 1 beat per second, lifts 18 m from a 4 m head. First water reaches the tank after about a minute.', p: {} },
  { id: 'small', name: 'Small garden pump', note: '1.5 m head lifting 7 m through a 20 mm pipe.', p: { Hs: 1.5, L: 8, D: .04, e: .003, ds: .04, stroke: .007, vratio: .8, dc: .02, Vch: .002, Dch: .08, Dd: .02, ed: .0019, Ld: 30, h: 7 } },
  { id: 'tall', name: 'Tall lift, 60 m', note: 'Lift ratio of 12, so only a small share of the water is delivered. Allow a few minutes (use 30×).', p: { Hs: 5, L: 25, D: .075, e: .004, ds: .075, stroke: .0112, vratio: .8, dc: .04, Vch: .01, Dch: .15, Dd: .032, ed: .0029, Ld: 150, h: 60 } },
  { id: 'farm', name: 'Farm pump, 15 m head', note: 'Large drive pipe lifting 150 m. Allow a few minutes (use 30×).', p: { Hs: 15, L: 60, D: .1, e: .005, ds: .1, stroke: .0098, vratio: .8, dc: .05, Vch: .02, Dch: .2, tb: .012, tch: .008, Dd: .04, ed: .0037, Ld: 250, h: 150 } },
  { id: 'long', name: 'Long pipeline, 2 km', note: 'Delivery pipe 2 km long and 300 m above the pump. Filling it takes about half an hour of simulated time.', p: { Hs: 20, L: 80, D: .15, e: .006, ds: .15, stroke: .01, vratio: .8, dc: .08, Vch: .03, Dch: .25, tb: .012, tch: .008, Dd: .08, ed: .0073, Ld: 2000, h: 300 } },
  { id: 'pvc', name: 'Thin PVC drive pipe (bursts)', note: 'A 0.5 mm PVC wall cannot hold the water hammer. Watch the drive pipe split.', p: { Hs: 25, L: 25, mat: 'pvc', e: .0005, h: 80, Ld: 200, vratio: .9, stroke: .006 } },
  { id: 'body', name: 'Thin cast-iron body (bursts)', note: 'A 0.12 mm cast-iron wall fails at the first hard beat.', p: { Hs: 12, L: 30, tb: .00012, h: 60, Ld: 200, vratio: .8, stroke: .0042 } },
  { id: 'chamber', name: 'Weak air chamber (bursts)', note: 'A thin PVC chamber tube cannot contain the delivery pressure.', p: { pumpMat: 'pvc', tb: .008, tch: .0003, Dch: .1, Hs: 10, L: 30, h: 60, Ld: 200, vratio: .8, stroke: .0042 } }
];

let params = PH.defaults(), sim, valveOn = false, speed = 1, T = readTheme(), themeAge = 0, rebuildT = 0, snaps = [];
let runLog = [], nextLog = 0, lastLogV = null, simStart = 0;
const st = { dp: Array.from({ length: 26 }, (_, i) => ({ u: i / 26, o: Math.random() * 2 - 1 })), lp: Array.from({ length: 30 }, (_, i) => ({ u: i / 30, o: Math.random() * 2 - 1 })),
  drops: [], spawn: 0, clock: 0, sp: [], so: [], acc: 0, acc2: 0,
  sysP: [], sysR: [], secP: [], secR: [], seenS: {}, seenC: {}, accS: {}, accC: {} };

function rebuild() {
  sim = PH.create(params);
  sim.phiTarget = valveOn ? 1 : 0;
  histReset(); snaps = []; runLog = []; nextLog = 0.25; lastLogV = { t: 0, d: 0, w: 0, l: 0 };
  Object.assign(st, { sp: [], so: [], drops: [], sysP: [], sysR: [], secP: [], secR: [], seenS: {}, seenC: {}, accS: {}, accC: {} });
}
function sched() { clearTimeout(rebuildT); rebuildT = setTimeout(rebuild, 120) }
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200) }

/* ---- controls ---- */
const box = $('controls');
const decimals = st_ => (String(st_).split('.')[1] || '').length;
GROUPS.forEach(g => {
  const d = document.createElement('details'); if (g.open) d.open = true;
  d.innerHTML = '<summary>' + g.t + '</summary><div class="fields"></div>';
  const fb = d.querySelector('.fields');
  g.f.forEach(f => {
    const w = document.createElement('div'); w.className = 'fld'; const id = 'f_' + f.k;
    if (f.sel) {
      w.innerHTML = '<label for="' + id + '">' + f.l + '</label><select id="' + id + '">' + Object.entries(f.sel).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select>';
      fb.appendChild(w); const e = w.querySelector('select'); f._e = e;
      e.onchange = () => { params[f.k] = e.value; if (f.onSel) f.onSel(e.value); sched() }; return;
    }
    if (f.chk) {
      w.innerHTML = '<label class="chk"><input type="checkbox" id="' + id + '"> ' + f.l + '</label>'; fb.appendChild(w);
      const e = w.querySelector('input'); f._e = e; e.onchange = () => { params[f.k] = e.checked; sched() }; return;
    }
    const dec = decimals(f.st);
    w.innerHTML = '<label for="' + id + 'n"><span>' + f.l + '</span><span class="u">' + f.u + '</span></label><div class="ctl"><input type="range" id="' + id + 'r" min="' + f.min + '" max="' + f.max + '" step="' + f.st + '"><input type="number" id="' + id + 'n" min="' + f.hmin + '" max="' + f.hmax + '" step="any"></div>';
    fb.appendChild(w);
    const r = w.querySelector('[type=range]'), n = w.querySelector('[type=number]'); f._r = r; f._n = n; f._dec = dec;
    r.oninput = () => { params[f.k] = +r.value / f.sc; n.value = r.value; sched(); showChecks() };
    const commit = () => { let v = parseFloat(n.value); if (!isFinite(v)) return; v = clamp(v, f.hmin, f.hmax); params[f.k] = v / f.sc; sync(f.k); sched(); showChecks() };
    n.onchange = commit; n.onkeydown = ev => { if (ev.key === 'Enter') commit() };
    n.oninput = () => { const v = parseFloat(n.value); if (isFinite(v) && v >= f.hmin && v <= f.hmax) { params[f.k] = v / f.sc; r.value = v; sched() } };
  });
  box.appendChild(d);
});
function sync(k) {
  GROUPS.forEach(g => g.f.forEach(f => {
    if (f.k !== k) return;
    if (f._r) { const v = +(params[k] * f.sc).toFixed(Math.max(f._dec, 3)); f._r.value = v; f._n.value = +(v.toFixed(f._dec + 1)); }
    else if (f._e) { if (f.chk) f._e.checked = !!params[k]; else f._e.value = params[k]; }
  }));
}
function syncAll() { GROUPS.forEach(g => g.f.forEach(f => sync(f.k))) }
syncAll();

/* ---- auto-tune the waste valve ---- */
{
  const fields = [...document.querySelectorAll('#controls details')].find(d => d.textContent.startsWith('Waste')).querySelector('.fields');
  const b = document.createElement('button'); b.id = 'tuneBtn'; b.textContent = 'Auto-tune spring and stroke';
  const note = document.createElement('p'); note.className = 'hint'; note.style.padding = '0';
  note.textContent = 'Tries 60 combinations in short trial runs and keeps the one that keeps beating and pumps the most water.';
  fields.appendChild(b); fields.appendChild(note);
  b.onclick = async () => {
    b.disabled = true; let best = null, i = 0;
    const it = PH.tuneTrials(params, 60), total = 60;
    for (let r = it.next(); !r.done; r = it.next()) {
      i++; if (r.value.score > 0 && (!best || r.value.score > best.score)) best = r.value;
      if (i % 2 === 0) { b.textContent = 'Tuning… ' + Math.min(100, Math.round(100 * i / total)) + '%'; await new Promise(res => setTimeout(res, 0)) }
    }
    b.disabled = false; b.textContent = 'Auto-tune spring and stroke';
    if (best) { params.vratio = best.vratio; params.stroke = best.stroke; sync('vratio'); sync('stroke'); rebuild(); toast('Spring preload ' + best.vratio + '×, stroke ' + (best.stroke * 1000).toFixed(1) + ' mm') }
    else toast('No spring and stroke made this pump keep beating. Try a higher intake level or a shorter drive pipe.');
  };
}

/* ---- presets ---- */
{
  const sel = $('presetSel');
  sel.innerHTML = '<option value="">Choose an example…</option>' + PRESETS.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');
  sel.onchange = () => {
    const p = PRESETS.find(x => x.id === sel.value); if (!p) return;
    params = Object.assign(PH.defaults(), p.p); syncAll();
    $('presetNote').textContent = p.note; setValve(false); rebuild(); showChecks();
  };
}
function setValve(on) {
  valveOn = on; if (sim) sim.phiTarget = on ? 1 : 0;
  $('valveBtn').setAttribute('aria-pressed', on); $('valveBtn').textContent = on ? 'Close supply valve' : 'Open supply valve';
}
$('valveBtn').onclick = () => setValve(!valveOn);
$('resetBtn').onclick = () => { setValve(false); rebuild() };
document.querySelectorAll('#speed button').forEach(b => b.onclick = () => {
  speed = +b.dataset.s; document.querySelectorAll('#speed button').forEach(x => x.setAttribute('aria-pressed', x === b));
});

/* ---- canvases ---- */
const CV = [['cSys', LW1, LH1, drawSystem], ['cSec', LW2, LH2, drawSection]].map(([id, w, h, fn]) => ({ cv: $(id), w, h, fn, c: $(id).getContext('2d') }));
const SC = { cv: $('cScope'), w: LW3, h: LH3, c: $('cScope').getContext('2d') };
function fit(o) {
  const r = o.cv.parentElement.clientWidth, d = Math.min(window.devicePixelRatio || 1, 2.5);
  const W = Math.round(r * d), Hh = Math.round(r * d * o.h / o.w);
  if (o.cv.width !== W || o.cv.height !== Hh) { o.cv.width = W; o.cv.height = Hh }
  o.k = W / o.w;
}
const ro = new ResizeObserver(() => CV.concat([SC]).forEach(fit));
CV.concat([SC]).forEach(o => ro.observe(o.cv.parentElement));
new MutationObserver(() => { T = readTheme() }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(() => { T = readTheme() }, 50));

/* ---- tiles, strength, balance, checks ---- */
const TL = ['Beats / min', 'Drive flow', 'Waste flow', 'Delivered', 'Efficiency', 'Hammer peak'];
$('tiles').innerHTML = TL.map((t, i) => '<div class="tile"><b>' + t + '</b><span id="t' + i + '">–</span><small id="u' + i + '"></small></div>').join('');
const setTile = (i, v, u) => { $('t' + i).textContent = v; $('u' + i).textContent = u || '' };
const fmtN = (v, d) => Math.abs(v) >= 1e4 ? v.toExponential(2) : v.toFixed(d);
const fmtM = v => v >= 1e4 ? (v / 1000).toFixed(1) + ' km' : v >= 100 ? Math.round(v) + ' m' : v.toFixed(1) + ' m';

function rates(s) {
  if (!snaps.length || s.t - snaps[snaps.length - 1].t >= .5) { snaps.push({ t: s.t, Vd: s.V.drive, Vw: s.V.waste, Vl: s.V.delivered }); if (snaps.length > 60) snaps.shift() }
  const a = snaps[Math.max(0, snaps.length - 11)], b = snaps[snaps.length - 1], dt = b.t - a.t, r = v => dt > 1 ? v / dt : 0;
  return { qd: r(b.Vd - a.Vd), qw: r(b.Vw - a.Vw), ql: r(b.Vl - a.Vl) };
}
function tiles(s) {
  const { qd, qw, ql } = rates(s);
  setTile(0, PH.beatRate(s).toFixed(0), '');
  setTile(1, (qd * 1000).toFixed(2), 'L/s'); setTile(2, (qw * 1000).toFixed(2), 'L/s');
  setTile(3, (ql * 60000).toFixed(1), 'L/min');
  setTile(4, qd > 1e-5 && ql > 0 ? (100 * ql * s.p.h / (qd * s.p.Hs)).toFixed(0) + '%' : '–', '');
  setTile(5, s.peak ? Math.max(0, hbPeakNow()).toFixed(0) : '0', 'm');
  const last = s.beatTimes[s.beatTimes.length - 1], fails = Object.keys(s.fail).filter(k => s.fail[k]);
  let msg, on = false;
  if (fails.length) msg = 'Burst: ' + fails.map(k => ({ drive: 'drive pipe', body: 'pump body', chamber: 'air chamber', delivery: 'delivery pipe' })[k]).join(', ') + '. Press Reset and repair to rebuild.';
  else if (!valveOn && s.phi < .01) msg = 'Supply valve closed. Drive pipe at rest; the flap is held open by its spring.';
  else if (s.beats === 0 && s.t < 60) { msg = 'Water accelerating down the drive pipe toward the waste valve.'; on = true }
  else if (valveOn && s.phi > .95 && s.t - (last || 0) > 6) msg = 'Stalled: the waste valve has stopped cycling. Try Auto-tune in the waste valve settings, or see "If the pump stalls" below.';
  else if (s.x < s.p.Ld) { msg = 'Charging: water front ' + s.x.toFixed(1) + ' m of ' + s.p.Ld + ' m up the delivery pipe.'; on = true }
  else if (s.Qtop > 1e-6 || ql > 1e-6) { msg = 'Pumping to the tank at ' + (ql * 60000).toFixed(1) + ' L/min.'; on = true }
  else { msg = 'Delivery pipe full. Chamber head is below the tank level.'; on = true }
  $('status').textContent = msg; $('dot').classList.toggle('on', on && valveOn);
}
let hbPk = 0;
function hbPeakNow() { return hbPk }

function bars(s) {
  const rows = PH.strength(s);
  $('bars').innerHTML = rows.map(r => {
    const pct = r.ratio * 100, cls = r.failed ? 'bad' : pct >= 50 ? 'warn' : '';
    return '<div class="brow"><div class="top"><b>' + r.label + '</b><span>' + r.material + '</span></div>' +
      '<div class="bar" title="peak hoop stress as a share of tensile strength"><i class="' + cls + '" style="width:' + Math.min(100, pct).toFixed(1) + '%"></i></div>' +
      '<small>' + (r.failed ? '<span class="tag">BURST</span> at ' + r.failed.t.toFixed(1) + ' s, ' : '') + 'peak ' + fmtN(r.peak / 1e6, 2) + ' of ' + (r.Su / 1e6) + ' MPa (' + (pct < 10 ? pct.toFixed(2) : pct.toFixed(0)) + '%)</small>' +
      '<small>bursts at about ' + fmtM(r.burstHead) + ' of head. Now ' + fmtN(r.sigma / 1e6, 2) + ' MPa.</small></div>';
  }).join('') + (s.p.burst ? '' : '<small style="color:var(--mute)">Bursting is switched off in the simulation options.</small>');
}
function balance(s) {
  const b = PH.balance(s), L = v => (v * 1000), pc = v => b.intake > 1e-9 ? (100 * v / b.intake).toFixed(1) + '%' : '–';
  const leaks = b.driveLeak + b.bodyLeak + b.chamberLeak + b.deliveryLeak;
  const sum = b.waste + leaks + b.stored + b.column + b.delivered + b.clip, res = b.intake - sum;
  const row = (n, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + n + '</td><td>' + L(v).toFixed(2) + ' L</td><td>' + pc(v) + '</td></tr>';
  $('bal').innerHTML = '<table class="bal">' + row('Drawn from the intake', b.intake, 'sum') + row('Wasted at the waste valve', b.waste) +
    row('Lost through bursts', leaks) + row('Stored in the air chamber', b.stored) + row('Filling the delivery pipe', b.column) +
    row('Delivered to the tank', b.delivered) + '<tr class="res"><td>Residual (pipe elasticity)</td><td>' + (L(res)).toFixed(4) + ' L</td><td>' + pc(res) + '</td></tr></table>' +
    '<small style="display:block;margin-top:6px;color:var(--mute)">Waste valve to tank ratio: ' + (b.delivered > 1e-9 ? (b.waste / b.delivered).toFixed(1) + ' : 1' : '–') + '. Checks at the pump body and in the delivery system close to ' + Math.max(Math.abs(b.residualBody), Math.abs(b.residualDelivery)).toExponential(0) + ' m³.</small>';
}
function checks(s) {
  const p = params, out = [], add = (cls, t, sm) => out.push({ cls, t, sm });
  const r1 = p.L / p.Hs, r2 = p.L / p.D, r3 = p.h / p.Hs, r4 = p.Dd / p.D, r5 = p.ds / p.D;
  if (p.h <= p.Hs) add('bad', 'Delivery is not above the intake level', 'The water would simply flow downhill. A ram pump is not needed.');
  else add(r3 <= 20 ? 'ok' : r3 <= 40 ? 'warn' : 'bad', 'Lift ratio h ÷ Hs = ' + r3.toFixed(1), 'Up to about 20 is workable. Higher ratios deliver very little.');
  add(r1 >= 3 && r1 <= 12 ? 'ok' : (r1 >= 1.5 && r1 <= 20 ? 'warn' : 'bad'), 'Drive length ÷ head = ' + r1.toFixed(1), 'Rule of thumb 3 to 12. Short pipes beat too fast; long pipes are slow and wasteful.');
  add(r2 >= 150 && r2 <= 1000 ? 'ok' : 'warn', 'Drive length ÷ diameter = ' + Math.round(r2), 'Rule of thumb 150 to 1000.');
  add(r4 >= .3 && r4 <= .8 ? 'ok' : 'warn', 'Delivery ÷ drive diameter = ' + r4.toFixed(2), 'The delivery pipe is usually about half the drive pipe diameter.');
  add(r5 >= .7 && r5 <= 1.6 ? 'ok' : 'warn', 'Waste seat ÷ drive diameter = ' + r5.toFixed(2), 'The waste valve seat is normally close to the drive pipe size.');
  const vc = s.vClose;
  if (vc > 0) add('ok', 'Closing velocity ' + vc.toFixed(2) + ' m/s', 'Water hammer rise a·V/g = ' + fmtM(s.a * vc / 9.81) + ' (a = ' + Math.round(s.a) + ' m/s). A check valve and air chamber limit the real peak.');
  const worst = PH.strength(s).reduce((m, r) => r.ratio > m.ratio ? r : m);
  add(worst.failed || worst.ratio >= 1 ? 'bad' : worst.ratio >= .5 ? 'warn' : 'ok', 'Highest stress: ' + worst.label.toLowerCase() + ' at ' + (worst.ratio * 100).toFixed(worst.ratio < .1 ? 2 : 0) + '% of tensile strength', 'Real systems keep peaks well under half the strength to allow for fatigue and defects.');
  const html = out.map(c => '<div class="chip ' + c.cls + '"><div><b>' + c.t + '</b><small>' + c.sm + '</small></div></div>').join('');
  if ($('chips').dataset.h !== html) { $('chips').innerHTML = html; $('chips').dataset.h = html }
}
function showChecks() { if (sim) { /* heuristics use params; refreshed on the next tick */ } }
$('hint').textContent = 'Changing any value restarts the pump from rest. The number boxes accept values beyond the slider range.';

/* ---- export ---- */
const esc = v => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v };
const csv = rows => rows.map(r => r.map(esc).join(',')).join('\n') + '\n';
function designCsv() {
  const s = sim, rows = [['section', 'key', 'name', 'value', 'unit', 'si_value']];
  GROUPS.forEach(g => g.f.forEach(f => {
    const v = params[f.k];
    if (f.sel) rows.push(['design', f.k, f.l, MAT[v].name, '', v]);
    else if (f.chk) rows.push(['design', f.k, f.l, v ? 'yes' : 'no', '', v ? 'true' : 'false']);
    else rows.push(['design', f.k, f.l, +(v * f.sc).toPrecision(6), f.u, v]);
  }));
  const { qd, qw, ql } = rates(s), b = PH.balance(s);
  const R = (k, n, v, u) => rows.push(['result', k, n, typeof v === 'number' ? +v.toPrecision(6) : v, u || '', typeof v === 'number' ? v : '']);
  R('sim_time', 'Simulated time', s.t, 's'); R('beats', 'Waste valve closures', s.beats, ''); R('beats_per_min', 'Beat rate', PH.beatRate(s), '1/min');
  R('drive_flow', 'Drive flow (recent average)', qd * 1000, 'L/s'); R('waste_flow', 'Waste flow (recent average)', qw * 1000, 'L/s');
  R('delivered_flow', 'Delivered flow (recent average)', ql * 60000, 'L/min');
  R('efficiency_daubuisson', "D'Aubuisson efficiency (whole run)", b.etaDAubuisson, '');
  R('wave_speed', 'Drive pipe wave speed', s.a, 'm/s'); R('closing_velocity', 'Drive velocity at flap closure', s.vClose || 0, 'm/s');
  R('joukowsky_head', 'Joukowsky rise a·V/g at closure', s.a * (s.vClose || 0) / 9.81, 'm');
  R('chamber_head', 'Air chamber head now', s.Hch, 'm'); R('front', 'Water front position in delivery pipe', s.x, 'm');
  [['intake', 'Drawn from intake'], ['waste', 'Wasted at waste valve'], ['driveLeak', 'Lost: drive pipe burst'], ['bodyLeak', 'Lost: pump body burst'],
   ['chamberLeak', 'Lost: air chamber burst'], ['deliveryLeak', 'Lost: delivery pipe burst'], ['stored', 'Stored in air chamber'], ['column', 'Filling delivery pipe'], ['delivered', 'Delivered to tank']]
    .forEach(([k, n]) => R('balance_' + k, n, b[k] * 1000, 'L'));
  R('balance_residual', 'Balance residual (pipe elasticity)', (b.intake - b.waste - b.driveLeak - b.bodyLeak - b.chamberLeak - b.deliveryLeak - b.stored - b.column - b.delivered - b.clip) * 1000, 'L');
  PH.strength(s).forEach(r => {
    R('stress_' + r.key + '_peak', r.label + ' peak hoop stress', r.peak / 1e6, 'MPa'); R('stress_' + r.key + '_strength', r.label + ' tensile strength (' + r.material + ')', r.Su / 1e6, 'MPa');
    R('stress_' + r.key + '_burst_head', r.label + ' burst head', r.burstHead, 'm'); R('stress_' + r.key + '_failed', r.label + ' burst', r.failed ? 'yes at ' + r.failed.t.toFixed(2) + ' s' : 'no', '');
  });
  rows.push(['meta', 'app', 'Hydraulic Ram Pump simulator', VERSION, '', '']);
  rows.push(['meta', 'exported', 'Export time', new Date().toISOString(), '', '']);
  return csv(rows);
}
function logCsv() {
  const rows = [['time_s', 'drive_flow_Lps', 'waste_flow_Lps', 'delivered_flow_Lps', 'body_head_m', 'chamber_head_m', 'front_m', 'delivered_L', 'beats']];
  runLog.forEach(r => rows.push(r)); return csv(rows);
}
function traceCsv() {
  const rows = [['time_s', 'body_head_m', 'chamber_head_m', 'drive_velocity_mps', 'delivery_velocity_mps', 'waste_flap_open_fraction', 'check_valve_lift_fraction']];
  for (let k = 0; k < hist.n; k++) { const i = (hist.i - hist.n + k + HN * 2) % HN; rows.push([+hist.t[i].toFixed(4), +hist.Hb[i].toFixed(3), +hist.Hch[i].toFixed(3), +hist.V[i].toFixed(4), +hist.vd[i].toFixed(4), +hist.y[i].toFixed(4), +hist.lift[i].toFixed(4)]) }
  return csv(rows);
}
function showDialog(name, text) {
  $('dlgTitle').textContent = name; $('dlgText').value = text;
  const d = $('dlg'); if (d.showModal) { if (!d.open) d.showModal() } else d.setAttribute('open', '');
}
$('dlgClose').onclick = () => $('dlg').close ? $('dlg').close() : $('dlg').removeAttribute('open');
$('dlgCopy').onclick = () => { $('dlgText').select(); copyText($('dlgText').value, true) };
function copyText(text, quiet) {
  const ok = () => toast('Copied to the clipboard');
  const fallback = () => { try { const t = $('dlgText'); t.value = text; t.select(); document.execCommand('copy') ? ok() : showDialog('Copy this CSV', text) } catch (e) { showDialog('Copy this CSV', text) } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
}
function save(name, text) {
  if (window.RAM_DIALOG) { showDialog(name, text); return }          // hosted preview frames block file downloads
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Saved ' + name);
  } catch (e) { showDialog(name, text) }
}
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
$('dlDesign').onclick = () => save('ram-pump-design-' + stamp() + '.csv', designCsv());
$('dlLog').onclick = () => save('ram-pump-run-log-' + stamp() + '.csv', logCsv());
$('dlTrace').onclick = () => save('ram-pump-traces-' + stamp() + '.csv', traceCsv());
$('cpDesign').onclick = () => copyText(designCsv()); $('cpLog').onclick = () => copyText(logCsv()); $('cpTrace').onclick = () => copyText(traceCsv());
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = [] }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows;
}
$('ldDesign').onclick = () => $('fileIn').click();
$('fileIn').onchange = ev => {
  const f = ev.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const rows = parseCsv(String(rd.result)).filter(r => r[0] === 'design'), np = PH.defaults(); let n = 0;
      rows.forEach(r => {
        const k = r[1], v = r[5]; if (!(k in np)) return;
        if (typeof np[k] === 'boolean') np[k] = v === 'true'; else if (typeof np[k] === 'string') { if (MAT[v]) np[k] = v } else if (isFinite(+v)) np[k] = +v; else return; n++;
      });
      if (!n) throw new Error('no design rows');
      params = np; syncAll(); setValve(false); rebuild(); toast('Loaded ' + n + ' values from ' + f.name);
    } catch (e) { toast('That file is not a design CSV from this app.') }
    ev.target.value = '';
  };
  rd.readAsText(f);
};

/* ---- main loop ---- */
let prev = performance.now(), tick = 0;
function frame(now) {
  const dr = Math.min((now - prev) / 1000, .05); prev = now; st.clock += dr;
  const n = Math.min(Math.round(dr * speed / sim.dt), 7000);
  for (let i = 0; i < n; i++) {
    PH.step(sim); rec(sim); if (sim.Hb > hbPk) hbPk = sim.Hb;
    if (sim.t >= nextLog) {
      const v = sim.V, dt = sim.t - lastLogV.t;
      runLog.push([+sim.t.toFixed(3), +((v.drive - lastLogV.d) / dt * 1000).toFixed(4), +((v.waste - lastLogV.w) / dt * 1000).toFixed(4), +((v.delivered - lastLogV.l) / dt * 1000).toFixed(5), +sim.Hb.toFixed(3), +sim.Hch.toFixed(3), +sim.x.toFixed(3), +(v.delivered * 1000).toFixed(4), sim.beats]);
      lastLogV = { t: sim.t, d: v.drive, w: v.waste, l: v.delivered }; nextLog = sim.t + 0.25; if (runLog.length > 40000) runLog.shift();
    }
  }
  const dtSim = n * sim.dt;
  if (++themeAge > 90) { T = readTheme(); themeAge = 0 }
  CV.forEach(o => { fit(o); o.c.setTransform(o.k, 0, 0, o.k, 0, 0); o.fn(o.c, sim, T, st, dtSim) });
  fit(SC); SC.c.setTransform(SC.k, 0, 0, SC.k, 0, 0); drawScope(SC.c, sim, T, speed <= .01 ? .5 : speed <= .1 ? 1.5 : 4);
  if (++tick % 6 === 0) { tiles(sim); bars(sim); balance(sim); checks(sim) }
  requestAnimationFrame(frame);
}
const _rebuild = rebuild; rebuild = function () { _rebuild(); hbPk = 0 };
rebuild(); requestAnimationFrame(frame);
window.RamApp = { get sim() { return sim }, get params() { return params }, setValve, rebuild, designCsv, logCsv, traceCsv, PRESETS, applyPreset: id => { const e = $('presetSel'); e.value = id; e.onchange() }, setSpeed: v => document.querySelector('#speed button[data-s="' + v + '"]').click() };
