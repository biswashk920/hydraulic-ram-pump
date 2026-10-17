/* Hydraulic ram pump physics core. SI units throughout.
 *
 * Heads are gauge metres of water above the pump centreline.
 *   Drive pipe     : elastic water hammer, method of characteristics, steady friction.
 *   Supply valve   : series loss K(opening) between the drive pipe and the pump body.
 *   Waste valve    : spring-loaded flap with mass, stroke and a flow-dependent closing force.
 *   Check valve    : orifice that only passes body -> air chamber.
 *   Air chamber    : polytropic gas (n = 1.2) over a water volume.
 *   Delivery pipe  : rigid water column with a rising front, friction and exit loss.
 *   Failure        : hoop stress sigma = rho g H (D + t) / (2 t) against tensile strength.
 *                    A failed component turns into a leak with exact volume accounting.
 *
 * The module works in Node (CommonJS) and in the browser (global RamPhysics).
 */
(function (root) {
  'use strict';
  const g = 9.81, rho = 1000, K_WATER = 2.2e9, PA = 101325, NPOLY = 1.2;
  const CD_W = 0.65, CD_C = 0.7, CD_LEAK = 0.62, KFLOW = 2.5, H_MIN = -9.5;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* E = Young's modulus (Pa), Su = tensile strength (Pa), eps = absolute roughness (m).
     Strengths are short-term values at 20 C; a pressure spike is short, so the
     ultimate strength is the right comparison. */
  const MATERIALS = {
    steel:     { name: 'Steel (mild)',         E: 200e9, Su: 360e6, eps: 0.15e-3 },
    ductile:   { name: 'Ductile iron',         E: 170e9, Su: 420e6, eps: 0.25e-3 },
    castiron:  { name: 'Grey cast iron',       E: 100e9, Su: 200e6, eps: 0.25e-3 },
    copper:    { name: 'Copper',               E: 117e9, Su: 220e6, eps: 0.0015e-3 },
    bronze:    { name: 'Bronze',               E: 105e9, Su: 260e6, eps: 0.0015e-3 },
    aluminium: { name: 'Aluminium casting',    E: 70e9,  Su: 200e6, eps: 0.0015e-3 },
    pvc:       { name: 'PVC-U',                E: 3e9,   Su: 50e6,  eps: 0.0015e-3 },
    hdpe:      { name: 'HDPE (PE100)',         E: 0.8e9, Su: 22e6,  eps: 0.007e-3 }
  };
  const PIPE_MATS = ['steel', 'ductile', 'castiron', 'copper', 'pvc', 'hdpe'];
  const PUMP_MATS = ['castiron', 'ductile', 'steel', 'bronze', 'aluminium', 'pvc'];

  function defaults() {
    return {
      Hs: 4, L: 10, D: 0.05, mat: 'steel', e: 0.0035,           // intake head, drive pipe
      ds: 0.05, stroke: 0.006, vmass: 0.3, vratio: 1.1,         // waste valve
      dc: 0.025, Vch: 0.004, Dch: 0.1,                          // check valve, air chamber
      pumpMat: 'castiron', tb: 0.008, tch: 0.006,               // pump body and chamber walls
      Dd: 0.025, Ld: 50, h: 18, dmat: 'hdpe', ed: 0.0023,       // delivery pipe
      prefilled: false, burst: true, valveTime: 2
    };
  }

  /* Wave speed in a thin-walled elastic pipe (Korteweg). */
  function waveSpeed(p) {
    const E = (MATERIALS[p.mat] || MATERIALS.steel).E;
    return Math.sqrt(K_WATER / rho) / Math.sqrt(1 + (K_WATER * p.D) / (E * p.e));
  }
  /* Hoop stress in a thin-walled cylinder, mean-diameter form. */
  function hoop(head, D, t) { return rho * g * Math.max(head, 0) * (D + t) / (2 * t); }
  /* Head of water at which hoop stress equals the tensile strength. */
  function burstHead(matKey, D, t) { return 2 * t * MATERIALS[matKey].Su / (rho * g * (D + t)); }

  function fric(V, D, eps) {
    const Re = Math.max(Math.abs(V) * D / 1.0e-6, 100);
    if (Re < 2000) return 64 / Re;
    const R = Math.max(Re, 4000);
    const t = Math.log10(eps / (3.7 * D) + 5.74 / Math.pow(R, 0.9));
    return 0.25 / (t * t);
  }

  function create(p0) {
    const p = Object.assign(defaults(), p0);
    const eps = (MATERIALS[p.mat] || MATERIALS.steel).eps;
    const epsD = (MATERIALS[p.dmat] || MATERIALS.hdpe).eps;
    const a = waveSpeed(p), A = Math.PI * p.D * p.D / 4;
    const N = clamp(Math.round(p.L / (a * 0.0015)), 4, 400);
    const dt = p.L / (N * a), dx = p.L / N;
    const x0 = p.prefilled ? p.Ld : 0.3;
    const s = {
      p, eps, epsD, a, A, N, dt, dx, B: a / (g * A), t: 0,
      H: new Float64Array(N + 1).fill(p.Hs),
      QL: new Float64Array(N + 1), QR: new Float64Array(N + 1),
      Hn: new Float64Array(N + 1), QLn: new Float64Array(N + 1), QRn: new Float64Array(N + 1),
      phi: 0, phiTarget: 0,
      y: p.stroke, yd: 0, As: Math.PI * p.ds * p.ds / 4, closing: false,
      Hb: 0, Hpipe: p.Hs, Qw: 0, Qd: 0, Qbl: 0, Qleak: 0, Qhole: 0, Hch: 0,
      Vw: 0, Vg0: p.Vch, Vg: p.Vch, Vw0: 0,
      Ad: Math.PI * p.Dd * p.Dd / 4, x0, x: x0, vd: 0, Qtop: 0, lift: 0,
      Dbody: 2 * p.D,
      V: { intake: 0, drive: 0, waste: 0, bodyLeak: 0, pump: 0, driveLeak: 0, chamberLeak: 0, deliveryLeak: 0, delivered: 0, clip: 0 },
      beats: 0, beatTimes: [], vClose: 0,
      leakNode: -1,
      fail: { drive: null, body: null, chamber: null, delivery: null },
      peak: { drive: 0, body: 0, chamber: 0, delivery: 0 }
    };
    if (p.prefilled) {
      s.Hch = p.h;
      s.Vg = s.Vg0 * Math.pow(PA / (PA + rho * g * p.h), 1 / NPOLY);
      s.Vw = s.Vw0 = s.Vg0 - s.Vg;
    }
    return s;
  }

  const Kv = phi => 0.2 / (phi * phi);

  function step(s) {
    const p = s.p, N = s.N, B = s.B, dt = s.dt, V = s.V;
    const H = s.H, QL = s.QL, QR = s.QR, Hn = s.Hn, QLn = s.QLn, QRn = s.QRn;

    // supply valve travel
    const dphi = dt / Math.max(p.valveTime, 1e-4);
    if (s.phi < s.phiTarget) s.phi = Math.min(s.phiTarget, s.phi + dphi);
    else if (s.phi > s.phiTarget) s.phi = Math.max(s.phiTarget, s.phi - dphi);

    // friction coefficient from mean drive-pipe velocity
    let vm = 0; for (let i = 0; i <= N; i++) vm += Math.abs(QR[i]);
    vm = vm / (N + 1) / s.A;
    const R = fric(vm, p.D, s.eps) * s.dx / (2 * g * p.D * s.A * s.A);

    // interior nodes
    s.Qleak = 0;
    for (let i = 1; i < N; i++) {
      const CP = H[i - 1] + B * QR[i - 1], CM = H[i + 1] - B * QL[i + 1];
      const BP = B + R * Math.abs(QR[i - 1]), BM = B + R * Math.abs(QL[i + 1]);
      if (i === s.leakNode) {
        const Cl = CD_LEAK * 0.5 * s.A * Math.sqrt(2 * g);
        const r = h => (CP - h) / BP - (h - CM) / BM - Cl * Math.sqrt(Math.max(h, 0));
        let lo = H_MIN, hi = Math.max(CP, CM, lo + 1e-6), h;
        if (r(lo) <= 0) h = lo;
        else { for (let k = 0; k < 40; k++) { const m = 0.5 * (lo + hi); if (r(m) > 0) lo = m; else hi = m; } h = 0.5 * (lo + hi); }
        Hn[i] = h; QLn[i] = (CP - h) / BP; QRn[i] = (h - CM) / BM;
        s.Qleak = Cl * Math.sqrt(Math.max(h, 0));
        V.driveLeak += s.Qleak * dt;
      } else {
        const q = (CP - CM) / (BP + BM);
        QLn[i] = QRn[i] = q; Hn[i] = CP - BP * q;
      }
    }
    // intake end: reservoir head with entrance loss
    {
      const CM = H[1] - B * QL[1], BM = B + R * Math.abs(QL[1]);
      const kk = 0.5 / (2 * g * s.A * s.A), d = p.Hs - CM, ad = Math.abs(d);
      const q = Math.sign(d) * 2 * ad / (BM + Math.sqrt(BM * BM + 4 * kk * ad));
      QLn[0] = QRn[0] = q; Hn[0] = CM + BM * q;
    }
    // pump end: supply valve, then body with waste orifice, check valve and any body rupture
    {
      const CP = H[N - 1] + B * QR[N - 1], BP = B + R * Math.abs(QR[N - 1]);
      const Aw = Math.min(Math.PI * p.ds * s.y, s.As);
      const Cv = CD_W * Aw * Math.sqrt(2 * g);
      const Cb = s.fail.body ? CD_LEAK * Math.max(s.A, s.As) * Math.sqrt(2 * g) : 0;
      const Cc = CD_C * (Math.PI * p.dc * p.dc / 4) * Math.sqrt(2 * g);
      const Hch = s.fail.chamber ? 0 : s.Hch;
      if (s.phi < 1e-3) {
        QLn[N] = QRn[N] = 0; Hn[N] = CP; s.Hb = 0; s.Qw = 0; s.Qd = 0; s.Qbl = 0; s.Hpipe = CP;
      } else {
        const kvq = Kv(s.phi) / (2 * g * s.A * s.A);
        const F = hb => (Cv + Cb) * Math.sqrt(Math.max(hb, 0)) + (hb > Hch ? Cc * Math.sqrt(hb - Hch) : 0);
        const r = hb => { const q = F(hb); return CP - BP * q - kvq * q * q - hb; };
        let lo = H_MIN, hi = Math.max(CP, lo + 1e-6), hb;
        if (r(lo) <= 0) hb = lo;
        else { for (let k = 0; k < 40; k++) { const m = 0.5 * (lo + hi); if (r(m) > 0) lo = m; else hi = m; } hb = 0.5 * (lo + hi); }
        const q = F(hb);
        QLn[N] = QRn[N] = q; Hn[N] = CP - BP * q; s.Hpipe = Hn[N]; s.Hb = hb;
        s.Qw = Cv * Math.sqrt(Math.max(hb, 0));
        s.Qbl = Cb * Math.sqrt(Math.max(hb, 0));
        s.Qd = hb > Hch ? Cc * Math.sqrt(hb - Hch) : 0;
      }
    }
    // swap buffers
    s.H = Hn; s.QL = QLn; s.QR = QRn; s.Hn = H; s.QLn = QL; s.QRn = QR;
    V.intake += s.QR[0] * dt;
    V.drive += s.QR[N] * dt;
    V.waste += s.Qw * dt;
    V.bodyLeak += s.Qbl * dt;
    V.pump += s.Qd * dt;

    // waste flap (y = opening in metres)
    {
      const m = p.vmass, Fopen = p.vratio * rho * g * s.As * p.Hs;
      const Awf = Math.min(Math.PI * p.ds * s.y, s.As);
      const kfac = 1 + KFLOW * (Awf / s.As);
      const Fcl = rho * g * s.Hb * s.As * kfac;
      s.yd += dt * ((Fopen - Fcl) / m - 8 * s.yd);
      s.y += s.yd * dt;
      if (s.y >= p.stroke) { s.y = p.stroke; if (s.yd > 0) s.yd = -0.25 * s.yd; }
      if (s.y <= 0) {
        s.y = 0; s.yd = 0;
        if (!s.closing) { s.closing = true; s.vClose = s.QR[N] / s.A; s.beats++; s.beatTimes.push(s.t); if (s.beatTimes.length > 60) s.beatTimes.shift(); }
      } else if (s.y > 0.2 * p.stroke) s.closing = false;
    }

    // delivery column and air chamber
    {
      const full = s.x >= p.Ld;
      const fd = fric(s.vd, p.Dd, s.epsD);
      const z = s.x * p.h / p.Ld;
      const hf = (fd * s.x / p.Dd + (full ? 1 : 0.5)) * s.vd * Math.abs(s.vd) / (2 * g);
      let vd = s.vd + dt * g * (s.Hch - z - hf) / Math.max(s.x, 0.3);
      if (s.fail.chamber) vd = s.vd + dt * g * (0 - z - hf) / Math.max(s.x, 0.3);
      let dxs;
      s.Qhole = 0;
      if (s.fail.delivery) {
        // pipe split at the bottom: everything leaving the chamber goes through the hole
        vd = 0; dxs = 0;
        s.Qhole = CD_LEAK * 0.5 * s.Ad * Math.sqrt(2 * g * Math.max(s.Hch, 0));
      } else {
        if (full && vd < 0) vd = 0;
        dxs = vd * dt;
        if (!full && s.x + dxs < 0.3) dxs = 0.3 - s.x;
        if (!s.fail.chamber) {
          // cannot take more water out of the chamber than it holds plus what arrives
          const lim = (s.Qd * dt + s.Vw) / s.Ad;
          if (dxs > lim) dxs = lim;
        } else if (dxs > s.Qd * dt / s.Ad) dxs = s.Qd * dt / s.Ad;
        vd = dxs / dt;
      }
      s.vd = vd;
      // advance the water front, count what spills into the tank
      if (!full) {
        if (s.x + dxs >= p.Ld) { const over = s.x + dxs - p.Ld; s.x = p.Ld; V.delivered += over * s.Ad; s.Qtop = over * s.Ad / dt; }
        else { s.x += dxs; s.Qtop = 0; }
      } else { V.delivered += Math.max(dxs, 0) * s.Ad; s.Qtop = Math.max(dxs, 0) * s.Ad / dt; }
      const qOut = dxs * s.Ad / dt;
      if (s.fail.chamber) {
        s.Vw = 0; s.Vg = s.Vg0; s.Hch = 0;
        // chamber open to atmosphere: whatever the column does not take leaves through the hole
        V.chamberLeak += (s.Qd - qOut) * dt;
      } else {
        const hole = Math.min(s.Qhole, (s.Vw + s.Qd * dt) / dt);
        s.Qhole = hole;
        V.deliveryLeak += hole * dt;
        let Vw = s.Vw + (s.Qd - qOut - hole) * dt;
        if (Vw < 0) { V.clip -= Vw; Vw = 0; }
        const Vgmin = 0.002 * s.Vg0;
        if (s.Vg0 - Vw < Vgmin) { V.clip += Vw - (s.Vg0 - Vgmin); Vw = s.Vg0 - Vgmin; }
        s.Vw = Vw; s.Vg = s.Vg0 - Vw;
        s.Hch = (PA * Math.pow(s.Vg0 / s.Vg, NPOLY) - PA) / (rho * g);
      }
      s.lift = Math.min(1, s.Qd / (0.9 * CD_C * (Math.PI * p.dc * p.dc / 4) * Math.sqrt(2 * g * 3)));
    }

    stressCheck(s);
    s.t += dt;
  }

  /* Compare peak hoop stress with tensile strength; a failed part becomes a leak. */
  function stressCheck(s) {
    const p = s.p, N = s.N, f = s.fail, pk = s.peak;
    let hmax = -1e9, hi = 1;
    for (let i = 1; i <= N; i++) if (s.H[i] > hmax) { hmax = s.H[i]; hi = i; }
    const mDrive = MATERIALS[p.mat], mPump = MATERIALS[p.pumpMat], mDel = MATERIALS[p.dmat];
    const sDrive = hoop(hmax, p.D, p.e), sBody = hoop(s.Hb, s.Dbody, p.tb);
    const sCh = hoop(s.Hch, p.Dch, p.tch), sDel = hoop(s.Hch, p.Dd, p.ed);
    s.stress = { drive: sDrive, body: sBody, chamber: sCh, delivery: sDel };
    if (sDrive > pk.drive) pk.drive = sDrive;
    if (sBody > pk.body) pk.body = sBody;
    if (sCh > pk.chamber) pk.chamber = sCh;
    if (sDel > pk.delivery) pk.delivery = sDel;
    if (!p.burst) return;
    const rec = (sig, Su, head, extra) => Object.assign({ t: s.t, sigma: sig, Su, head }, extra);
    if (!f.drive && sDrive >= mDrive.Su) {
      const node = Math.min(hi, N - 1);
      s.leakNode = node;
      f.drive = rec(sDrive, mDrive.Su, hmax, { node, dist: (N - node) * s.dx });
    }
    if (!f.body && sBody >= mPump.Su) f.body = rec(sBody, mPump.Su, s.Hb);
    if (!f.chamber && sCh >= mPump.Su) {
      f.chamber = rec(sCh, mPump.Su, s.Hch);
      s.V.chamberLeak += s.Vw;
      s.Vw = 0; s.Vg = s.Vg0; s.Hch = 0;
    }
    if (!f.delivery && sDel >= mDel.Su) f.delivery = rec(sDel, mDel.Su, s.Hch);
  }

  function advance(s, T, maxSteps) {
    const n = Math.min(Math.round(T / s.dt), maxSteps || 4000);
    for (let i = 0; i < n; i++) step(s);
    return n;
  }
  function beatRate(s) {
    const b = s.beatTimes; if (b.length < 3) return 0;
    const n = Math.min(b.length - 1, 12);
    return 60 * n / (b[b.length - 1] - b[b.length - 1 - n]);
  }
  /* Water balance. Every litre drawn at the intake must be accounted for. */
  function balance(s) {
    const V = s.V, p = s.p;
    const stored = s.Vw - s.Vw0, column = (s.x - s.x0) * s.Ad;
    const r1 = V.drive - V.waste - V.bodyLeak - V.pump;                       // at the pump body
    const r2 = V.pump - stored - column - V.delivered - V.deliveryLeak - V.chamberLeak - V.clip; // after the check valve
    const r0 = V.intake - V.drive - V.driveLeak;                              // along the drive pipe (storage only)
    return { intake: V.intake, drive: V.drive, waste: V.waste, bodyLeak: V.bodyLeak, driveLeak: V.driveLeak,
      pump: V.pump, stored, column, delivered: V.delivered, deliveryLeak: V.deliveryLeak, chamberLeak: V.chamberLeak,
      clip: V.clip, residualPipe: r0, residualBody: r1, residualDelivery: r2,
      etaDAubuisson: V.drive > 1e-9 ? V.delivered * p.h / (V.drive * p.Hs) : 0 };
  }
  /* Strength table for the interface: current and peak stress against strength. */
  function strength(s) {
    const p = s.p, st = s.stress || { drive: 0, body: 0, chamber: 0, delivery: 0 };
    const row = (key, label, matKey, D, t, failRec) => ({ key, label, material: MATERIALS[matKey].name, D, t,
      Su: MATERIALS[matKey].Su, sigma: st[key], peak: s.peak[key], ratio: s.peak[key] / MATERIALS[matKey].Su,
      burstHead: burstHead(matKey, D, t), failed: failRec });
    return [
      row('drive', 'Drive pipe', p.mat, p.D, p.e, s.fail.drive),
      row('body', 'Pump body', p.pumpMat, s.Dbody, p.tb, s.fail.body),
      row('chamber', 'Air chamber', p.pumpMat, p.Dch, p.tch, s.fail.chamber),
      row('delivery', 'Delivery pipe', p.dmat, p.Dd, p.ed, s.fail.delivery)];
  }

  /* Search spring preload and stroke for settings that make the pump cycle and move the most water.
   * Each trial is a short run with bursting off. Returns {vratio, stroke, beats, score} or null.
   * onTrial (optional) is called after every trial so a UI can stay responsive. */
  function* tuneTrials(p0, seconds) {
    const base = Object.assign(defaults(), p0, { burst: false, valveTime: 0.3 });
    const ratios = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.6, 2.0];
    const maxStroke = base.ds / 3;
    const strokes = [0.5, 0.7, 1, 1.4, 2].map(f => Math.min(base.stroke * f, maxStroke)).filter((v, i, a) => a.indexOf(v) === i && v >= 0.001);
    for (const stroke of strokes) for (const vratio of ratios) {
      const s = create(Object.assign({}, base, { vratio, stroke }));
      s.phiTarget = 1;
      const n = Math.round(seconds / s.dt), mid = n - Math.round(15 / s.dt);
      let beatsMid = 0;
      for (let i = 0; i < n; i++) { step(s); if (i === mid) beatsMid = s.beats; }
      const alive = s.beats - beatsMid >= 5;            // still beating in the last 15 s
      yield { vratio, stroke, beats: s.beats, score: alive ? s.V.pump : 0 };
    }
  }
  function autoTune(p0, seconds) {
    let best = null;
    for (const r of tuneTrials(p0, seconds || 60)) if (r.score > 0 && (!best || r.score > best.score)) best = r;
    return best;
  }

  const API = { defaults, create, step, advance, autoTune, tuneTrials, waveSpeed, beatRate, balance, strength, hoop, burstHead, fric,
    MATERIALS, PIPE_MATS, PUMP_MATS, PA, g, rho, NPOLY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.RamPhysics = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
