const fs = require('fs'), path = require('path'), vm = require('vm');
const P = require('../src/physics.js');
const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const PRESETS = vm.runInNewContext(src.match(/const PRESETS = (\[[\s\S]*?\n\]);/)[1]);
for (const pr of PRESETS) {
  const t0 = Date.now(), b = P.autoTune(pr.p, 60);
  console.log(pr.id.padEnd(8), b ? `vratio ${b.vratio} stroke ${(b.stroke * 1000).toFixed(1)} mm beats30s ${b.beats} pumped ${(b.score * 1000).toFixed(1)}L` : 'no cycling found', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
