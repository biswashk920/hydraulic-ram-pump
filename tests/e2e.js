'use strict';
/* End-to-end check in headless Chromium.   npm i -D playwright && npx playwright install chromium && node tests/e2e.js
 * Writes screenshots to docs/screenshots/. Exits non-zero on any failed assertion. */
const assert = require('node:assert/strict');
const path = require('path'), fs = require('fs');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.error('Install playwright first: npm i -D playwright'); process.exit(2); }
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, '..', 'docs', 'screenshots'); fs.mkdirSync(shots, { recursive: true });
let passed = 0; const ok = (name) => { passed++; console.log('  ok  ' + name); };

(async () => {
  const browser = await chromium.launch();
  const open = async (opts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }, opts));
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push(m.text()); });
    await page.goto(url); await page.waitForFunction(() => window.RamApp && RamApp.sim);
    return { ctx, page, errors };
  };
  const run = async (page, speed, ms) => { await page.evaluate(v => RamApp.setSpeed(v), speed); await page.waitForTimeout(ms); await page.evaluate(() => RamApp.setSpeed(1)); };

  // 1. loads cleanly, default state
  {
    const { ctx, page, errors } = await open();
    assert.equal(await page.title(), 'Hydraulic Ram Pump');
    assert.match(await page.textContent('#status'), /Supply valve closed/);
    for (const id of ['cSys', 'cSec', 'cScope']) assert.ok(await page.$eval('#' + id, c => c.width > 200), id + ' is sized');
    assert.ok(await page.$('#howto'), 'how-to section present');
    assert.ok((await page.textContent('#howto')).includes('Quick start'));
    ok('page loads, canvases sized, how-to section present');

    // 2. open the valve and pump
    await page.click('#valveBtn');
    assert.equal(await page.getAttribute('#valveBtn', 'aria-pressed'), 'true');
    await run(page, 30, 7000);
    const r = await page.evaluate(() => { const s = RamApp.sim, b = RamRamBal(); return { beats: s.beats, front: s.x, del: s.V.delivered, b }; function RamRamBal() { return RamPhysics.balance(RamApp.sim); } });
    assert.ok(r.beats > 100, 'pump beats: ' + r.beats);
    assert.ok(Math.abs(r.b.residualBody) < 1e-12 && Math.abs(r.b.residualDelivery) < 1e-12, 'balance closes in the page');
    assert.match(await page.textContent('#status'), /Charging|Pumping|Delivery pipe full/);
    const tile = await page.textContent('#t0'); assert.ok(+tile > 20, 'beats per minute tile: ' + tile);
    assert.match(await page.textContent('#bal'), /Drawn from the intake/);
    assert.match(await page.textContent('#bars'), /Drive pipe/);
    ok('valve opens, pump beats, balance and strength panels fill in');
    await page.screenshot({ path: path.join(shots, 'pumping-light.png'), fullPage: false });

    // 3. exports
    const dl = page.waitForEvent('download'); await page.click('#dlDesign'); const d = await dl;
    const p1 = path.join(__dirname, '..', 'tests', '.tmp-design.csv'); await d.saveAs(p1);
    const text = fs.readFileSync(p1, 'utf8');
    assert.match(text.split('\n')[0], /^section,key,name,value,unit,si_value/);
    assert.ok(/design,Hs,Intake level above pump,4,m,4/.test(text), 'design row for Hs');
    assert.ok(/result,beats_per_min/.test(text) && /result,balance_delivered/.test(text) && /result,stress_body_peak/.test(text));
    const dl2 = page.waitForEvent('download'); await page.click('#dlLog'); const d2 = await dl2;
    await d2.saveAs(p1 + '2'); const log = fs.readFileSync(p1 + '2', 'utf8').trim().split('\n'); assert.ok(log.length > 100, 'run log rows ' + log.length);
    const dl3 = page.waitForEvent('download'); await page.click('#dlTrace'); const d3 = await dl3;
    await d3.saveAs(p1 + '3'); assert.ok(fs.readFileSync(p1 + '3', 'utf8').trim().split('\n').length > 500, 'trace rows');
    ok('three CSV downloads work');

    // 4. design CSV round-trip
    await page.evaluate(() => document.querySelectorAll('#controls details').forEach(d => { d.open = true; }));
    await page.fill('#f_hn', '3.5'); await page.press('#f_hn', 'Enter'); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => RamApp.params.h), 3.5);
    await page.setInputFiles('#fileIn', p1); await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => RamApp.params.h), 18, 'loading the CSV restores the lift');
    ok('design CSV loads back');
    for (const f of ['', '2', '3']) fs.unlinkSync(p1 + f);

    // 5. no lift cap
    await page.fill('#f_hn', '1800'); await page.press('#f_hn', 'Enter');
    await page.fill('#f_Ldn', '9000'); await page.press('#f_Ldn', 'Enter'); await page.waitForTimeout(300);
    const big = await page.evaluate(() => [RamApp.params.h, RamApp.params.Ld]);
    assert.deepEqual(big, [1800, 9000]); ok('lift of 1800 m and a 9 km delivery pipe are accepted');
    await page.evaluate(() => RamApp.applyPreset('village'));
    assert.deepEqual(errors, [], 'no console errors: ' + errors.join(' | '));
    ok('no console errors');
    await ctx.close();
  }

  // 6. every example loads and runs; the burst examples burst, the others do not
  {
    const { ctx, page, errors } = await open();
    const ids = await page.evaluate(() => RamApp.PRESETS.map(p => p.id));
    for (const id of ids) {
      await page.evaluate(i => RamApp.applyPreset(i), id); await page.evaluate(() => RamApp.setValve(true));
      await page.evaluate(() => RamApp.setSpeed(30)); await page.waitForTimeout(id === 'village' || id === 'small' ? 2500 : 6000);
      const r = await page.evaluate(() => { const s = RamApp.sim; return { beats: s.beats, fail: Object.keys(s.fail).filter(k => s.fail[k]), t: s.t }; });
      const expectFail = { pvc: 'drive', body: 'body', chamber: 'chamber' }[id];
      if (expectFail) {
        assert.ok(r.fail.includes(expectFail), id + ' should burst the ' + expectFail + ' (t=' + r.t.toFixed(0) + ', ' + JSON.stringify(r.fail) + ')');
        assert.match(await page.textContent('#status'), /Burst/);
        await page.waitForTimeout(500);
        await page.evaluate(() => RamApp.setSpeed(1)); await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(shots, 'burst-' + id + '.png') });
      } else assert.deepEqual(r.fail, [], id + ' must not burst');
      assert.ok(r.beats > 0, id + ' beats');
      assert.ok(Number.isFinite(r.t));
      await page.evaluate(() => RamApp.setSpeed(1));
    }
    ok('all ' + ids.length + ' examples run; the three burst examples burst as described');
    // repair
    await page.evaluate(() => RamApp.applyPreset('body')); await page.click('#resetBtn');
    assert.equal(await page.evaluate(() => Object.values(RamApp.sim.fail).filter(Boolean).length), 0, 'reset repairs');
    assert.equal(await page.getAttribute('#valveBtn', 'aria-pressed'), 'false');
    ok('reset repairs and closes the valve');
    // auto-tune
    await page.evaluate(() => RamApp.applyPreset('farm')); await page.evaluate(() => { RamApp.params.vratio = 2.5; });
    await page.click('#tuneBtn'); await page.waitForFunction(() => !document.getElementById('tuneBtn').disabled, null, { timeout: 60000 });
    const vr = await page.evaluate(() => RamApp.params.vratio); assert.ok(vr <= 2, 'auto-tune chose a preload: ' + vr);
    ok('auto-tune finds a working valve setting');
    assert.deepEqual(errors, [], 'no console errors in example run: ' + errors.join(' | '));
    await ctx.close();
  }

  // 7. dark theme and phone width
  {
    const { ctx, page } = await open({ colorScheme: 'dark' });
    await page.click('#valveBtn'); await run(page, 30, 5000); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shots, 'pumping-dark.png') });
    ok('dark theme renders'); await ctx.close();
  }
  {
    const { ctx, page } = await open({ viewport: { width: 400, height: 900 } });
    await page.click('#valveBtn'); await run(page, 30, 3000);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth); assert.ok(sw <= 400, 'no horizontal scroll at 400 px: ' + sw);
    await page.screenshot({ path: path.join(shots, 'phone.png'), fullPage: true });
    ok('phone width has no horizontal scroll'); await ctx.close();
  }
  await browser.close();
  console.log(passed + ' end-to-end checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
