/* ---------- scope: pressure, velocity, valve lanes ---------- */
const LW3=560,LH3=372,HN=6000;
const hist={n:0,i:0,t:new Float64Array(HN),Hb:new Float32Array(HN),Hch:new Float32Array(HN),V:new Float32Array(HN),vd:new Float32Array(HN),y:new Float32Array(HN),lift:new Float32Array(HN)};
function rec(s){const i=hist.i;hist.t[i]=s.t;hist.Hb[i]=s.Hb;hist.Hch[i]=s.Hch;hist.V[i]=s.QR[s.N]/s.A;hist.vd[i]=s.vd;hist.y[i]=s.y/s.p.stroke;hist.lift[i]=s.lift;hist.i=(i+1)%HN;if(hist.n<HN)hist.n++}
function histReset(){hist.n=0;hist.i=0}
function drawScope(c,s,T,win){
  c.fillStyle=T.panel;c.fillRect(0,0,LW3,LH3);
  const X0=52,X1=LW3-12,t1=s.t,t0=t1-win;
  const idx=k=>(hist.i-hist.n+k+HN*2)%HN;
  let first=0;{let lo=0,hi=hist.n-1;while(lo<hi){const m=(lo+hi)>>1;if(hist.t[idx(m)]<t0)lo=m+1;else hi=m}first=lo}
  const cnt=hist.n-first,stepK=Math.max(1,Math.floor(cnt/(X1-X0)));
  const tx=t=>X0+(t-t0)/win*(X1-X0);
  const lanes=[{y0:38,y1:190,name:'HEAD  m'},{y0:214,y1:288,name:'VELOCITY  m/s'},{y0:312,y1:352,name:'VALVES'}];
  let pk=Math.max(s.p.h*1.2,s.p.Hs*2,8);for(let k=first;k<hist.n;k+=stepK)pk=Math.max(pk,hist.Hb[idx(k)]);
  let vmax=0.5;for(let k=first;k<hist.n;k+=stepK)vmax=Math.max(vmax,Math.abs(hist.V[idx(k)]),Math.abs(hist.vd[idx(k)]));
  const ymin=-10,sy1=v=>lanes[0].y1-(v-ymin)/(pk-ymin)*(lanes[0].y1-lanes[0].y0);
  const vm=Math.ceil(vmax*1.1*2)/2,sy2=v=>lanes[1].y1-(v+vm*.15)/(vm*1.15)*(lanes[1].y1-lanes[1].y0);
  c.lineWidth=1;
  lanes.forEach(L=>{c.strokeStyle=T.line;c.strokeRect(X0,L.y0,X1-X0,L.y1-L.y0);txt(c,L.name,X0+4,L.y0-5,{color:T.mute,size:11,w:600})});
  // head gridlines
  const gs=niceStep(pk-ymin,5);for(let v=Math.ceil(ymin/gs)*gs;v<pk;v+=gs){const y=sy1(v);c.strokeStyle=T.grid;c.beginPath();c.moveTo(X0,y);c.lineTo(X1,y);c.stroke();txt(c,String(v),X0-5,y+4,{align:'right',color:T.mute,size:10,mono:true})}
  const ts=win<=1?0.1:win<=2?.25:1;for(let t=Math.ceil(t0/ts)*ts;t<=t1;t+=ts){const x=tx(t);c.strokeStyle=T.grid;c.beginPath();c.moveTo(x,lanes[0].y0);c.lineTo(x,lanes[2].y1);c.stroke()}
  txt(c,'−'+win+' s',X0,LH3-6,{color:T.mute,size:11,mono:true});txt(c,'now',X1,LH3-6,{color:T.mute,size:11,mono:true,align:'right'});
  // reference heads
  c.setLineDash([5,4]);c.strokeStyle=T.mute;c.beginPath();c.moveTo(X0,sy1(s.p.Hs));c.lineTo(X1,sy1(s.p.Hs));c.stroke();
  c.strokeStyle=T.accent;c.beginPath();c.moveTo(X0,sy1(s.p.h));c.lineTo(X1,sy1(s.p.h));c.stroke();c.setLineDash([]);
  txt(c,'supply head',X1-4,sy1(s.p.Hs)-3,{align:'right',color:T.mute,size:10});txt(c,'delivery head',X1-4,sy1(s.p.h)-3,{align:'right',color:T.accent,size:10});
  const line=(arr,sy,col,w)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();let st=false;for(let k=first;k<hist.n;k+=stepK){const x=tx(hist.t[idx(k)]),y=sy(arr[idx(k)]);st?c.lineTo(x,y):c.moveTo(x,y);st=true}c.stroke()};
  c.save();c.beginPath();c.rect(X0,lanes[0].y0,X1-X0,lanes[0].y1-lanes[0].y0);c.clip();
  line(hist.Hch,sy1,T.water,2);line(hist.Hb,sy1,T.hot,1.6);c.restore();
  c.save();c.beginPath();c.rect(X0,lanes[1].y0,X1-X0,lanes[1].y1-lanes[1].y0);c.clip();
  c.strokeStyle=T.grid;c.beginPath();c.moveTo(X0,sy2(0));c.lineTo(X1,sy2(0));c.stroke();
  line(hist.vd,sy2,T.water,2);line(hist.V,sy2,T.ink,1.6);c.restore();
  // valve lanes as filled steps
  const L3=lanes[2],hh=(L3.y1-L3.y0)/2-3;
  const bar=(arr,y0,col,th)=>{c.fillStyle=col;for(let k=first;k<hist.n;k+=stepK){const v=arr[idx(k)];if(v<th)continue;const x=tx(hist.t[idx(k)]);c.fillRect(x,y0+hh*(1-clamp(v,0,1)),Math.max(1,(X1-X0)/(cnt/stepK)+.5),hh*clamp(v,0,1))}};
  bar(hist.y,L3.y0+1,T.accent,0.001);bar(hist.lift,L3.y0+hh+5,T.water,0.001);
  txt(c,'waste flap',X0+4,L3.y0+11,{color:T.mute,size:10});txt(c,'check valve',X0+4,L3.y1-3,{color:T.mute,size:10});
  // legend
  const lg=[['body',T.hot],['chamber',T.water],['drive V',T.ink],['delivery v',T.water]];let lx=X0+250;
  txt(c,'TRACES AT THE PUMP  ·  '+win+' s window',10,16,{color:T.mute,size:12,w:600});
  lg.slice(0,2).forEach(([n,col])=>{c.fillStyle=col;c.fillRect(lx,13,14,3);txt(c,n,lx+18,18,{color:T.ink,size:11});lx+=70});
  lx=X0+190;lg.slice(2).forEach(([n,col])=>{c.fillStyle=col;c.fillRect(lx,203,14,3);txt(c,n,lx+18,208,{color:T.ink,size:11});lx+=72});
}
