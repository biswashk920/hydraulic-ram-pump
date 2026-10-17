/* ---------- shared drawing helpers ---------- */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
function hex(c){c=c.trim();if(c[0]!=='#')return[128,128,128];if(c.length===4)c='#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3];return[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
function mix(a,b,t){const A=hex(a),B=hex(b);t=clamp(t,0,1);return`rgb(${Math.round(lerp(A[0],B[0],t))},${Math.round(lerp(A[1],B[1],t))},${Math.round(lerp(A[2],B[2],t))})`}
function readTheme(){const cs=getComputedStyle(document.documentElement),v=n=>cs.getPropertyValue(n).trim();
  return{bg:v('--bg'),panel:v('--panel'),ink:v('--ink'),mute:v('--mute'),line:v('--line'),grid:v('--grid'),water:v('--water'),hot:v('--hot'),vac:v('--vac'),accent:v('--accent'),air:v('--air'),metal:v('--metal'),ground:v('--ground'),ok:v('--ok')}}

function headColor(h,T,Hmax){if(h<0)return mix(T.water,T.vac,-h/9.5);const t=clamp(h/Hmax,0,1)*3;return t<1?mix(T.water,'#3FBFAF',t):t<2?mix('#3FBFAF','#F0B93B',t-1):mix('#F0B93B',T.hot,t-2)}
function niceStep(range,target){const raw=range/target,pw=Math.pow(10,Math.floor(Math.log10(raw)));for(const m of[1,2,5,10]){if(m*pw>=raw)return m*pw}return 10*pw}
function txt(c,s,x,y,o){o=o||{};c.font=(o.w||500)+' '+(o.size||12)+'px '+(o.mono?"'IBM Plex Mono',monospace":"'Barlow Condensed',sans-serif");c.fillStyle=o.color||'#888';c.textAlign=o.align||'left';c.textBaseline=o.base||'alphabetic';c.fillText(s,x,y)}
function dimLine(c,x1,y1,x2,y2,T,dash){c.save();c.strokeStyle=T.mute;c.lineWidth=1;c.setLineDash(dash||[4,4]);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore()}

/* ---------- system elevation ---------- */
const LW1=1000,LH1=470;
function drawSystem(c,s,T,st,dtSim){
  const p=s.p,N=s.N;
  c.fillStyle=T.panel;c.fillRect(0,0,LW1,LH1);
  const yp=LH1-72,maxEl=Math.max(p.h,p.Hs,2)*1.14,sv=(yp-44)/maxEl,yEl=m=>yp-m*sv;
  const Hmax=Math.max(40,2*p.h);
  // elevation grid + ruler
  const stp=niceStep(maxEl,6);
  c.lineWidth=1;
  for(let m=0;m<=maxEl;m+=stp){const y=yEl(m);c.strokeStyle=T.grid;c.beginPath();c.moveTo(44,y);c.lineTo(LW1,y);c.stroke();
    txt(c,m+' m',38,y+4,{align:'right',color:T.mute,size:11,mono:true})}
  // terrain
  const yT=yEl(p.h)+26,yI=yEl(p.Hs)+16,yB=yp+24;
  c.beginPath();c.moveTo(44,yI);c.lineTo(205,yI);c.quadraticCurveTo(330,yI,380,yB-4);c.quadraticCurveTo(410,yB,470,yB);c.lineTo(600,yB);
  c.bezierCurveTo(700,yB,740,yT+30,860,yT);c.lineTo(LW1,yT);c.lineTo(LW1,LH1);c.lineTo(44,LH1);c.closePath();
  c.fillStyle=T.ground;c.fill();c.strokeStyle=T.ink;c.lineWidth=1.5;c.stroke();
  // intake pond
  const yS=yEl(p.Hs);
  c.fillStyle=mix(T.water,T.panel,.25);c.fillRect(52,yS,140,yI+4-yS+30);
  c.strokeStyle=T.ink;c.lineWidth=1.5;c.strokeRect(52,yS,140,yI+4-yS+30);
  c.beginPath();c.strokeStyle=T.water;c.lineWidth=2;
  for(let x=52;x<=192;x+=4){const y=yS+Math.sin(x*.09+st.clock*1.3)*1.4;x===52?c.moveTo(x,y):c.lineTo(x,y)}c.stroke();
  txt(c,'INTAKE',122,yS-18,{align:'center',color:T.ink,size:14,w:700});
  txt(c,'+'+p.Hs.toFixed(1)+' m',122,yS-5,{align:'center',color:T.mute,size:12,mono:true});
  // drive pipe
  const A={x:180,y:yS+26},Bp={x:474,y:yp};
  const wD=clamp(6+p.D*70,7,17);
  const pt=u=>({x:lerp(A.x,Bp.x,u),y:lerp(A.y,Bp.y,u)});
  c.lineCap='butt';c.strokeStyle=T.ink;c.lineWidth=wD+4;c.beginPath();c.moveTo(A.x,A.y);c.lineTo(Bp.x,Bp.y);c.stroke();
  for(let i=0;i<N;i++){const a=pt(i/N),b=pt((i+1)/N);c.strokeStyle=headColor((s.H[i]+s.H[i+1])/2,T,Hmax);c.lineWidth=wD;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
  // drive particles
  let Vm=0;for(let i=0;i<=N;i++)Vm+=s.QR[i];Vm=Vm/(N+1)/s.A;
  const du=clamp(Vm*dtSim/p.L,-.02,.02);
  const dx=Bp.x-A.x,dy=Bp.y-A.y,dl=Math.hypot(dx,dy),nx=-dy/dl,ny=dx/dl;
  c.fillStyle='rgba(255,255,255,.85)';
  st.dp.forEach(q=>{q.u=(q.u+du+1)%1;const m=pt(q.u);c.beginPath();c.arc(m.x+nx*q.o*wD*.3,m.y+ny*q.o*wD*.3,1.6,0,6.3);c.fill()});
  // supply valve (bow-tie), filled when closed
  {const m=pt(.9),ang=Math.atan2(dy,dx);c.save();c.translate(m.x,m.y);c.rotate(ang);
   c.fillStyle=s.phi<.02?T.ink:T.panel;c.strokeStyle=T.ink;c.lineWidth=1.5;
   c.beginPath();c.moveTo(-9,-wD);c.lineTo(9,wD);c.lineTo(9,-wD);c.lineTo(-9,wD);c.closePath();c.fill();c.stroke();
   c.beginPath();c.moveTo(0,0);c.lineTo(0,-wD-8);c.stroke();c.fillStyle=T.accent;c.fillRect(-6,-wD-11,12,3);c.restore();
   txt(c,'supply valve '+Math.round(s.phi*100)+'%',m.x-46,m.y-wD-18,{color:T.mute,size:12})}
  txt(c,'DRIVE PIPE  L = '+p.L+' m  ⌀'+Math.round(p.D*1000)+' mm',pt(.14).x-6,pt(.14).y+36,{color:T.mute,size:12});txt(c,'wave speed a = '+Math.round(s.a)+' m/s',pt(.14).x-6,pt(.14).y+50,{color:T.mute,size:12});
  // pump icon
  const hot=headColor(s.Hb,T,Hmax);
  c.fillStyle=T.metal;c.strokeStyle=T.ink;c.lineWidth=1.5;
  c.fillRect(474,yp-14,86,28);c.strokeRect(474,yp-14,86,28);
  const chX=540,chW=46,chTop=yp-96,chH=82;
  c.fillRect(chX,chTop,chW,chH);c.strokeRect(chX,chTop,chW,chH);
  c.fillStyle=T.air;c.fillRect(chX+4,chTop+4,chW-8,chH-8);
  const wl=clamp(s.Vw/s.Vg0,0,1)*(chH-8);
  c.fillStyle=headColor(s.Hch,T,Hmax);c.fillRect(chX+4,chTop+chH-4-wl,chW-8,wl);
  c.fillStyle=hot;c.fillRect(478,yp-10,78,20);
  // waste drops
  st.spawn+=s.Qw*dtSim*8000;
  while(st.spawn>1&&st.drops.length<90){st.spawn--;st.drops.push({x:508+(Math.random()-.5)*8,y:yp+14,vx:(Math.random()-.5)*14+10,vy:20+Math.random()*30,l:1})}
  st.spawn=Math.min(st.spawn,4);
  const dd=Math.min(dtSim,0.02)*Math.max(1,1);
  c.fillStyle=T.water;
  st.drops=st.drops.filter(d=>{const t=Math.min(Math.max(dtSim,0.001),0.03)*3;d.vy+=300*t;d.x+=d.vx*t;d.y+=d.vy*t;if(d.y>yB+10)return false;c.beginPath();c.arc(d.x,d.y,1.8,0,6.3);c.fill();return true});
  c.fillStyle=mix(T.water,T.ground,.4);c.beginPath();c.ellipse(512,yB+2,30,5,0,0,6.3);c.fill();
  txt(c,'RAM PUMP',517,yp+46,{align:'center',color:T.ink,size:14,w:700});
  txt(c,Math.round(Vm>0?s.beats:s.beats)+' beats',517,yp+60,{align:'center',color:T.mute,size:12,mono:true});
  // delivery pipe
  const wd=clamp(5+p.Dd*60,6,12),fx=clamp(s.x/p.Ld,0,1),xa=612,xb=852;
  const dp=f=>({x:lerp(xa,xb,f),y:yEl(f*p.h)-30*(1-f)});
  const pts=[];for(let k=0;k<=60;k++)pts.push(dp(k/60));
  c.strokeStyle=T.ink;c.lineWidth=wd+4;c.lineJoin='round';c.beginPath();c.moveTo(586,yp-30);c.lineTo(xa,yp-30);pts.forEach(q=>c.lineTo(q.x,q.y));c.stroke();
  c.strokeStyle=T.panel;c.lineWidth=wd;c.beginPath();c.moveTo(586,yp-30);c.lineTo(xa,yp-30);pts.forEach(q=>c.lineTo(q.x,q.y));c.stroke();
  const nW=Math.max(1,Math.round(fx*60));
  for(let k=0;k<nW;k++){const a=k===0?{x:586,y:yp-30}:pts[k-1],b=pts[Math.min(k,60)];const f=k/60;
    c.strokeStyle=headColor(s.Hch-f*p.h,T,Hmax);c.lineWidth=wd;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
  c.beginPath();c.moveTo(586,yp-30);c.lineTo(xa,yp-30);c.strokeStyle=headColor(s.Hch,T,Hmax);c.lineWidth=wd;c.stroke();
  const du2=clamp(s.vd*dtSim/p.Ld,-.01,.01);
  c.fillStyle='rgba(255,255,255,.85)';
  st.lp.forEach(q=>{q.u=((q.u+du2)%1+1)%1;const f=q.u*fx;if(fx<.01)return;const m=dp(f);c.beginPath();c.arc(m.x,m.y+q.o*wd*.25,1.5,0,6.3);c.fill()});
  if(fx<1&&fx>0){const m=dp(fx);c.fillStyle=T.water;c.beginPath();c.arc(m.x,m.y,wd*.55,0,6.3);c.fill()}
  txt(c,'DELIVERY PIPE  '+p.Ld+' m  ⌀'+Math.round(p.Dd*1000)+' mm',dp(.45).x-16,dp(.45).y+4,{color:T.mute,size:12,align:'right'});
  // tank
  const yTop=yEl(p.h);
  c.fillStyle=T.panel;c.fillRect(858,yTop-8,112,56);
  const lvl=clamp(s.V.delivered/0.2,0,1)*50;c.fillStyle=mix(T.water,T.panel,.2);c.fillRect(860,yTop+46-lvl,108,lvl);
  c.strokeStyle=T.ink;c.lineWidth=2;c.beginPath();c.moveTo(858,yTop-8);c.lineTo(858,yTop+48);c.lineTo(970,yTop+48);c.lineTo(970,yTop-8);c.stroke();
  if(s.Qtop>1e-5){c.strokeStyle=T.water;c.lineWidth=2.5;c.beginPath();c.moveTo(xb,yTop);c.quadraticCurveTo(xb+6,yTop+4,xb+8,yTop+Math.max(4,40-lvl));c.stroke()}
  txt(c,'TANK',914,yTop-14,{align:'center',color:T.ink,size:14,w:700});
  txt(c,(s.V.delivered*1000).toFixed(1)+' L',914,yTop+30,{align:'center',color:T.ink,size:12,mono:true});
  // head markers
  dimLine(c,192,yS,xb,yS,T);
  dimLine(c,586,yTop,xb,yTop,T,[2,4]);
  txt(c,'+'+p.h+' m',650,yTop-6,{color:T.mute,size:12,mono:true});
  const yH=yEl(s.Hch);
  c.strokeStyle=T.accent;c.lineWidth=1.5;c.setLineDash([6,3]);c.beginPath();c.moveTo(590,yH);c.lineTo(840,yH);c.stroke();c.setLineDash([]);
  c.fillStyle=T.accent;c.beginPath();c.moveTo(590,yH);c.lineTo(598,yH-4);c.lineTo(598,yH+4);c.fill();
  txt(c,'chamber head '+s.Hch.toFixed(1)+' m',702,yH-5,{color:T.accent,size:12,w:600});
  sysFailures(c,s,T,st,dtSim,{pt,dp,sv,yp,wD,wd,yB,chX,chTop,chW});
}
const FAIL_LABELS={drive:'DRIVE PIPE',body:'PUMP BODY',chamber:'AIR CHAMBER',delivery:'DELIVERY PIPE'};
function sysFailures(c,s,T,st,dtSim,G){
  const f=s.fail;
  if(!(f.drive||f.body||f.chamber||f.delivery)){st.seenS={};return}
  const dt=clamp(dtSim,0,.03),gPx=FXG*G.sv,yp=G.yp;
  const spot={drive:()=>G.pt(f.drive.node/s.N),body:()=>({x:517,y:yp-14}),chamber:()=>({x:G.chX+G.chW/2,y:G.chTop}),delivery:()=>G.dp(.02)};
  const head={drive:()=>Math.max(s.H[f.drive?f.drive.node:1],.3),body:()=>Math.max(s.Hb,.3),chamber:()=>Math.max(s.Hb,.3),delivery:()=>Math.max(s.Hch,.3)};
  const flow={drive:s.Qleak,body:s.Qbl,chamber:s.Qd,delivery:s.Qhole};
  for(const k of['drive','body','chamber','delivery']){
    if(!f[k])continue;
    const m=spot[k]();
    if(!st.seenS[k]){st.seenS[k]=1;fxExplode(st.sysP,st.sysR,m.x,m.y,G.sv,f[k].head*.25)}
    // torn metal and cracks
    if(k==='drive'){fxTear(c,m.x-10,m.y-G.wD-1,20,G.wD*2+2,11,T.panel,T.ink);fxCrack(c,m.x-18,m.y+G.wD,24,5,T.ink)}
    if(k==='body'){fxTear(c,495,yp-17,44,12,13,T.panel,T.ink);fxCrack(c,482,yp-4,30,9,T.ink)}
    if(k==='chamber'){fxTear(c,G.chX+6,G.chTop-4,G.chW-12,12,17,T.panel,T.ink);fxCrack(c,G.chX+4,G.chTop+20,30,3,T.ink)}
    if(k==='delivery'){fxTear(c,m.x-8,m.y-G.wd-2,16,G.wd*2+4,23,T.panel,T.ink)}
    // continuing jet, height from the actual head: v = sqrt(2 g H)
    const q=flow[k];
    if(q>1e-6){
      const vm=Math.sqrt(2*FXG*head[k]())*.75,px=clamp(vm*G.sv,50,520);
      st.accS[k]=(st.accS[k]||0)+Math.min(q/6e-4,1)*200*dt;
      const n=Math.floor(st.accS[k]);st.accS[k]-=n;
      fxJet(st.sysP,m.x,m.y-4,-Math.PI/2,.55,px,n);
    }
    txt(c,FAIL_LABELS[k]+' BURST',k==='drive'?m.x-12:m.x+(k==='delivery'?-14:14),m.y-(k==='drive'?58:6),{color:T.hot,size:13,w:700,align:(k==='delivery'||k==='drive')?'right':'left'});
  }
  fxStep(c,st.sysP,dt,gPx,T,{x0:0,y0:0,x1:LW1,floor:G.yB+16});
  fxRings(c,st.sysR,dt,T,90);
  fxBanner(c,s,T,LW1,FAIL_LABELS);
}
