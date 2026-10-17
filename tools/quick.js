const P=require('../src/physics.js');
const s=P.create(P.defaults()); s.phiTarget=1;
for(let i=0;i<Math.round(120/s.dt);i++)P.step(s);
const b=P.balance(s);
console.log('beats',s.beats,'bpm',P.beatRate(s).toFixed(1),'x',s.x.toFixed(1));
console.log(Object.fromEntries(Object.entries(b).map(([k,v])=>[k,+v.toExponential(4)])));
console.log(P.strength(s).map(r=>r.label+' peak '+(r.peak/1e6).toFixed(2)+' MPa of '+(r.Su/1e6)+' burstHead '+r.burstHead.toFixed(0)));
