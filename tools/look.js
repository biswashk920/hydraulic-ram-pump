/* Quick visual check: node tools/look.js <preset|-> <speed> <seconds> <out.png> [light|dark] [width] */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [preset, speed, secs, out, scheme = 'light', width = '1440'] = process.argv.slice(2);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +width, height: 1000 }, colorScheme: scheme });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !/ERR_|net::/.test(m.text())) errs.push(m.text()) });
  await pg.goto('file://' + path.join(__dirname, '../index.html'));
  if (preset !== '-') await pg.evaluate(id => RamApp.applyPreset(id), preset);
  await pg.evaluate(() => RamApp.setValve(true)); await pg.evaluate(v => RamApp.setSpeed(v), speed);
  await pg.waitForTimeout(+secs * 1000);
  await pg.evaluate(() => RamApp.setSpeed(1)); await pg.waitForTimeout(700);
  await pg.screenshot({ path: out, fullPage: true });
  console.log(await pg.inner_text?.('#status').catch(() => '') ?? '', await pg.textContent('#status'), 'errors:', errs);
  await b.close();
})();
