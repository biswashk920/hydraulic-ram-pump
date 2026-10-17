/* ---------- burst effects: water jets, debris, shock rings, banners ---------- */
const FXG = 9.81;

/* particle arrays hold {x,y,vx,vy,life,kind:'w'|'s',r,rot,vr}; positions and velocities in canvas px, px/s */
function fxJet(arr, x, y, ang, spread, speed, n) {
  for (let i = 0; i < n && arr.length < 700; i++) {
    const a = ang + (Math.random() - 0.5) * spread, v = speed * (0.55 + Math.random() * 0.45);
    arr.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + Math.random() * 1.6, kind: 'w', r: 1.3 + Math.random() * 1.6 });
  }
}
function fxShards(arr, x, y, speed, n) {
  for (let i = 0; i < n && arr.length < 700; i++) {
    const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7);
    arr.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 2 + Math.random() * 1.5, kind: 's',
      r: 3 + Math.random() * 5, rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 14 });
  }
}
function fxExplode(arr, rings, x, y, pxPerM, bigness) {
  const sp = clamp(Math.sqrt(2 * FXG * Math.max(bigness, 2)) * pxPerM, 90, 560);
  fxJet(arr, x, y, -Math.PI / 2, 6.283, sp, 90);
  fxShards(arr, x, y, sp * 0.8, 16);
  rings.push({ x, y, age: 0 });
}
/* Advance and draw. gPx = gravity in px/s^2. bounds = {x0,y0,x1,y1,floor} */
function fxStep(c, arr, dt, gPx, T, b) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const q = arr[i];
    q.vy += gPx * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    if (q.kind === 's') q.rot += q.vr * dt;
    if (q.life <= 0 || q.x < b.x0 || q.x > b.x1 || q.y > b.floor || q.y < b.y0 - 400) { arr.splice(i, 1); continue; }
    if (q.kind === 'w') { c.fillStyle = 'rgba(255,255,255,.88)'; c.beginPath(); c.arc(q.x, q.y, q.r, 0, 6.3); c.fill(); c.fillStyle = T.water; c.globalAlpha = .75; c.beginPath(); c.arc(q.x, q.y, q.r * .7, 0, 6.3); c.fill(); c.globalAlpha = 1; }
    else { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.fillStyle = T.ink; c.beginPath(); c.moveTo(-q.r, -q.r * .5); c.lineTo(q.r, -q.r * .2); c.lineTo(q.r * .3, q.r); c.closePath(); c.fill(); c.restore(); }
  }
}
function fxRings(c, rings, dt, T, maxR) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.age += dt;
    if (r.age > 0.6) { rings.splice(i, 1); continue; }
    const k = r.age / 0.6;
    c.strokeStyle = T.hot; c.globalAlpha = 1 - k; c.lineWidth = 5 * (1 - k) + 1;
    c.beginPath(); c.arc(r.x, r.y, 8 + k * maxR, 0, 6.3); c.stroke();
    c.fillStyle = '#fff'; c.globalAlpha = (1 - k) * .55; c.beginPath(); c.arc(r.x, r.y, 4 + k * maxR * .5, 0, 6.3); c.fill();
    c.globalAlpha = 1;
  }
}
/* Jagged torn edge: a polygon with deterministic teeth so it does not flicker. */
function fxTear(c, x, y, w, h, seed, fill, stroke) {
  const n = 9; let sd = seed;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  c.beginPath();
  for (let i = 0; i <= n; i++) c.lineTo(x + w * i / n, y + (i % 2 ? h * .25 : 0) * (0.5 + rnd()));
  for (let i = 0; i <= n; i++) c.lineTo(x + w - w * i / n, y + h - (i % 2 ? h * .25 : 0) * (0.5 + rnd()));
  c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke();
}
function fxCrack(c, x, y, len, seed, col) {
  let sd = seed; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647 - .5; };
  c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y);
  let px = x, py = y; for (let i = 0; i < 6; i++) { px += len / 6 * (0.5 + rnd()); py += len / 5 * rnd() * 2; c.lineTo(px, py); } c.stroke();
}
/* Banner listing every failure so far. */
function fxBanner(c, s, T, W, labels) {
  const lines = [];
  for (const k of ['drive', 'body', 'chamber', 'delivery']) {
    const f = s.fail[k]; if (!f) continue;
    lines.push(labels[k] + ' burst at t = ' + f.t.toFixed(1) + ' s   hoop stress ' + (f.sigma / 1e6).toFixed(1) + ' MPa  ≥  strength ' + (f.Su / 1e6).toFixed(0) + ' MPa   (head ' + f.head.toFixed(0) + ' m)');
  }
  if (!lines.length) return;
  const h = 14 + lines.length * 17;
  const pulse = 0.82 + 0.18 * Math.sin(performance.now() / 160);
  c.fillStyle = T.hot; c.globalAlpha = pulse; c.fillRect(W / 2 - 330, 30, 660, h); c.globalAlpha = 1;
  c.strokeStyle = T.ink; c.lineWidth = 1.5; c.strokeRect(W / 2 - 330, 30, 660, h);
  txt(c, 'FAILURE', W / 2 - 320, 46, { color: T.bg, size: 13, w: 700 });
  lines.forEach((l, i) => txt(c, l, W / 2 - 250, 46 + i * 17, { color: T.bg, size: 13, w: 600, mono: false }));
}
