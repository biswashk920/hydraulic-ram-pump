/* ---------- pump cutaway section ---------- */
const LW2=700,LH2=560;
let hatchKey='',hatchPat=null;
function hatch(c,T){const k=T.metal+T.ink;if(k!==hatchKey){const t=document.createElement('canvas');t.width=t.height=8;const x=t.getContext('2d');x.fillStyle=T.metal;x.fillRect(0,0,8,8);x.strokeStyle=T.ink;x.globalAlpha=.55;x.lineWidth=1;x.beginPath();x.moveTo(0,8);x.lineTo(8,0);x.moveTo(-2,2);x.lineTo(2,-2);x.moveTo(6,10);x.lineTo(10,6);x.stroke();hatchPat=c.createPattern(t,'repeat');hatchKey=k}return hatchPat}
function polyPos(r,d){let acc=0;for(let i=0;i<r.length-1;i++){const L=Math.hypot(r[i+1][0]-r[i][0],r[i+1][1]-r[i][1]);if(d<=acc+L){const f=(d-acc)/L;return[lerp(r[i][0],r[i+1][0],f),lerp(r[i][1],r[i+1][1],f)]}acc+=L}return null}
function polyLen(r){let a=0;for(let i=0;i<r.length-1;i++)a+=Math.hypot(r[i+1][0]-r[i][0],r[i+1][1]-r[i][1]);return a}
function spring(c,x,y1,y2,w,turns,col){c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(x,y1);const n=turns*2;for(let i=1;i<n;i++){c.lineTo(x+(i%2?w:-w),lerp(y1,y2,i/n))}c.lineTo(x,y2);c.stroke()}

function drawSection(c,s,T,st,dtSim){
  const p=s.p,Hmax=Math.max(40,2*p.h),H=hatch(c,T);
  c.fillStyle=T.panel;c.fillRect(0,0,LW2,LH2);
  const wall=(x,y,w,h)=>{c.fillStyle=H;c.fillRect(x,y,w,h);c.strokeStyle=T.ink;c.lineWidth=1.5;c.strokeRect(x,y,w,h)};
  const cav=(x,y,w,h,f)=>{c.fillStyle=f;c.fillRect(x,y,w,h)};
  const ws=clamp(p.ds*600,36,84),xw=300,wc=clamp(p.dc*600,24,60),xc=452,Yb=398,strokePx=clamp(p.stroke*1000*5,8,50);
  const hPipe=headColor(s.H[s.N],T,Hmax),hBody=headColor(s.Hb,T,Hmax),hCh=headColor(s.Hch,T,Hmax);
  // ground + discharge
  c.fillStyle=T.ground;c.fillRect(0,522,LW2,LH2-522);c.strokeStyle=T.ink;c.lineWidth=1.5;c.beginPath();c.moveTo(0,522);c.lineTo(LW2,522);c.stroke();
  // drive pipe + gate valve
  wall(14,339,190,52);cav(14,349,190,32,hPipe);cav(140,349,64,32,hBody);
  wall(60,318,80,94);cav(60,349,80,32,hPipe);cav(100,349,40,32,hBody);
  // gate slides in slot
  const gb=385-s.phi*42;c.fillStyle=T.ink;c.fillRect(93,gb-80,14,80);
  c.fillStyle=T.metal;c.fillRect(88,282,24,36);c.strokeStyle=T.ink;c.lineWidth=1.5;c.strokeRect(88,282,24,36);
  c.beginPath();c.moveTo(100,280);c.lineTo(100,262);c.stroke();
  c.save();c.translate(100,258);c.rotate(s.phi*8);c.strokeStyle=T.accent;c.lineWidth=3;c.beginPath();c.moveTo(-22,0);c.lineTo(22,0);c.moveTo(0,-5);c.lineTo(0,5);c.stroke();c.restore();
  // pump body + waste opening
  wall(190,318,376,94);cav(204,332,342,66,hBody);cav(190,349,16,32,hBody);
  cav(xw-ws/2,Yb,ws,14,T.panel);
  // chamber
  wall(390,60,176,258);cav(404,74,148,244,T.air);
  const cavH=244,wl=clamp(s.Vw/s.Vg0,0,1)*cavH*0.92;
  // air shading by compression
  const comp=clamp(1-s.Vg/s.Vg0,0,1);cav(404,74,148,cavH-wl,mix(T.air,T.hot,comp*.45));
  cav(404,74+cavH-wl,148,wl,hCh);
  c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.5;c.beginPath();
  for(let x=404;x<=552;x+=4){const y=74+cavH-wl+Math.sin(x*.12+st.clock*2)*1.2;x===404?c.moveTo(x,y):c.lineTo(x,y)}c.stroke();
  // outlet
  wall(566,278,134,44);cav(552,288,148,24,hCh);
  c.fillStyle=hCh;c.fillRect(552,288,14,24);
  // check valve: opening in ceiling wall, disc above seat
  cav(xc-wc/2,318,wc,14,hBody);
  const lift=s.lift*20,dy=318-lift-7;
  c.fillStyle=T.accent;c.strokeStyle=T.ink;c.lineWidth=1.5;c.fillRect(xc-wc/2-7,dy,wc+14,7);c.strokeRect(xc-wc/2-7,dy,wc+14,7);
  spring(c,xc,dy,268,7,5,T.ink);c.fillStyle=H;c.fillRect(xc-wc/2-10,262,wc+20,7);c.strokeRect(xc-wc/2-10,262,wc+20,7);
  // waste flap: plate inside body above seat, spring below, stop bolt above
  const lp=s.y/p.stroke*strokePx,py=Yb-lp-8;
  c.fillStyle=T.ink;c.fillRect(xw-2,py,4,Yb+28-py);
  spring(c,xw,Yb+26,py+8,8,6,T.ink);
  wall(xw-ws/2-12,Yb+24,ws+24,5);c.fillStyle=H;c.fillRect(xw-ws/2-14,Yb+14,8,12);c.fillRect(xw+ws/2+6,Yb+14,8,12);
  c.fillStyle=T.accent;c.strokeStyle=T.ink;c.lineWidth=1.5;c.fillRect(xw-ws/2-8,py,ws+16,8);c.strokeRect(xw-ws/2-8,py,ws+16,8);
  const tipY=Yb-strokePx-16;c.fillStyle=T.metal;c.fillRect(xw-3,332,6,tipY-332);c.strokeRect(xw-3,332,6,tipY-332);c.fillRect(xw-9,tipY,18,5);c.strokeRect(xw-9,tipY,18,5);
  // particles
  const spPx=(s.QR[s.N]/s.A)*34;
  const rW=[[24,365],[xw-ws*.2,365],[xw+ws*.28,Yb-4],[xw+ws*.36,Yb+22],[xw+ws*.42,520]];
  const rC=[[24,365],[xc-26,365],[xc-6,346],[xc,326],[xc,296],[xc+6,262]];
  const rO=[[480,300],[566,300],[690,300]];
  const dt=clamp(dtSim,0,.03);
  st.acc+=Math.abs(spPx)*dt/16;
  while(st.acc>1&&st.sp.length<220){st.acc--;const ratio=s.Qw+s.Qd>1e-9?s.Qw/(s.Qw+s.Qd):(s.y>0?1:0);
    if(s.QR[s.N]>1e-5)st.sp.push({r:Math.random()<ratio?0:1,d:0,o:(Math.random()-.5)*12})}
  st.acc=Math.min(st.acc,3);
  const oPx=Math.abs(s.vd)*34;st.acc2+=oPx*dt/16;while(st.acc2>1&&st.so.length<90){st.acc2--;if(s.vd>0.02&&s.Vw>1e-5)st.so.push({d:0,o:(Math.random()-.5)*10})}st.acc2=Math.min(st.acc2,3);
  c.fillStyle='rgba(255,255,255,.9)';
  const wFlow=Math.max(spPx,0)*dt+1e-6;
  st.sp=st.sp.filter(q=>{const R=q.r?rC:rW;
    // speed rises through the narrow waste gap
    q.d+=Math.max(spPx,2)*dt*(q.r?1:1);const m=polyPos(R,q.d);if(!m)return false;
    if(q.r&&m[1]<300&&s.Vw>0&&false)return false;
    c.beginPath();c.arc(m[0],m[1]+(q.d<polyLen(R)*.45?q.o*.5:0),2,0,6.3);c.fill();return true});
  st.so=st.so.filter(q=>{q.d+=Math.max(oPx,2)*dt;const m=polyPos(rO,q.d);if(!m)return false;c.beginPath();c.arc(m[0],m[1]+q.o*.4,2,0,6.3);c.fill();return true});
  // jet below the seat
  if(s.Qw>1e-6){const a=clamp(s.Qw/2.5e-3,.15,1);c.strokeStyle=mix(T.water,T.panel,.15);c.lineWidth=3+5*a;c.lineCap='round';
    for(const sd of[-1,1]){c.beginPath();c.moveTo(xw+sd*ws*.38,Yb+20);c.quadraticCurveTo(xw+sd*(ws*.5+14*a),Yb+60,xw+sd*(ws*.5+34*a),518);c.stroke()}c.lineCap='butt'}
  // labels
  const lab=(t,x,y,px,py)=>{txt(c,t,x,y-4,{color:T.ink,size:13,w:600});const w=c.measureText(t).width,sx=Math.abs(px-x)<Math.abs(px-(x+w))?x:x+w;c.strokeStyle=T.mute;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.moveTo(sx,y);c.lineTo(px,py);c.stroke();c.fillStyle=T.mute;c.beginPath();c.arc(px,py,2.5,0,6.3);c.fill()};
  lab('SUPPLY VALVE',18,262,90,300);
  lab('IMPULSE (WASTE) VALVE',24,486,xw-ws/2-14,Yb+18);
  lab('CHECK VALVE',590,226,xc+wc/2+6,dy+3);
  txt(c,'AIR CHAMBER',478,98,{color:T.ink,size:13,w:700,align:'center'});
  txt(c,'trapped air '+(s.Vg*1000).toFixed(2)+' L',478,113,{color:T.mute,size:11,mono:true,align:'center'});txt(c,(s.Hch*0.0981+1.013).toFixed(2)+' bar absolute',478,127,{color:T.mute,size:11,mono:true,align:'center'});
  txt(c,'to delivery pipe  →',634,272,{color:T.mute,size:13,align:'center'});
  txt(c,'DRIVE PIPE  V = '+(s.QR[s.N]/s.A).toFixed(2)+' m/s',16,420,{color:T.ink,size:13,w:700});
  txt(c,'pipe head '+s.H[s.N].toFixed(1)+' m',16,436,{color:T.mute,size:12,mono:true});
  txt(c,'BODY  '+s.Hb.toFixed(1)+' m  ('+(s.Hb*0.0981).toFixed(2)+' bar g)',212,350,{color:T.ink,size:12,mono:true,w:500});
  txt(c,'flap lift '+(s.y*1000).toFixed(1)+' mm',xw+ws/2+22,Yb+44,{color:T.mute,size:12,mono:true});
  txt(c,s.Qw>1e-6?'waste flow '+(s.Qw*1000).toFixed(2)+' L/s':'waste valve shut',xw+ws/2+22,Yb+60,{color:T.mute,size:12,mono:true});
  secFailures(c,s,T,st,dtSim,{xw,ws});
}
function secFailures(c,s,T,st,dtSim){
  const f=s.fail;
  if(!(f.drive||f.body||f.chamber||f.delivery)){st.seenC={};return}
  const dt=clamp(dtSim,0,.03),gPx=FXG*14;
  const spot={drive:{x:44,y:339},body:{x:300,y:318},chamber:{x:404,y:150},delivery:{x:640,y:278}};
  const head={drive:Math.max(s.H[f.drive?f.drive.node:1],.3),body:Math.max(s.Hb,.3),chamber:Math.max(s.Hb,.3),delivery:Math.max(s.Hch,.3)};
  const flow={drive:s.Qleak,body:s.Qbl,chamber:s.Qd,delivery:s.Qhole};
  for(const k of['drive','body','chamber','delivery']){
    if(!f[k])continue;const m=spot[k];
    if(!st.seenC[k]){st.seenC[k]=1;fxExplode(st.secP,st.secR,m.x,m.y,14,f[k].head*.25)}
    if(k==='drive'){fxTear(c,m.x-14,m.y-4,28,14,3,T.panel,T.ink);fxCrack(c,m.x+14,m.y+8,26,5,T.ink)}
    if(k==='body'){fxTear(c,m.x-40,m.y-4,80,16,5,T.panel,T.ink);fxCrack(c,m.x+40,m.y+10,40,9,T.ink)}
    if(k==='chamber'){fxTear(c,m.x-4,m.y-22,18,44,7,T.panel,T.ink);fxCrack(c,m.x+4,m.y+24,40,11,T.ink)}
    if(k==='delivery'){fxTear(c,m.x-12,m.y-4,24,14,9,T.panel,T.ink)}
    const q=flow[k];
    if(q>1e-6){
      const vm=Math.sqrt(2*FXG*head[k])*.75,px=clamp(vm*14,60,520);
      st.accC[k]=(st.accC[k]||0)+Math.min(q/6e-4,1)*220*dt;const n=Math.floor(st.accC[k]);st.accC[k]-=n;
      fxJet(st.secP,m.x,m.y,k==='chamber'?-2.6:-Math.PI/2,.6,px,n);
    }
    if(k==='drive'){txt(c,'DRIVE PIPE BURST',14,452,{color:T.hot,size:13,w:700});txt(c,f.drive.dist.toFixed(1)+' m upstream of the pump (schematic)',14,466,{color:T.hot,size:12,w:500})}
    else txt(c,FAIL_LABELS[k]+' BURST',k==='delivery'?m.x+10:m.x+(k==='chamber'?-14:16),m.y-(k==='body'?32:16),{color:T.hot,size:13,w:700,align:k==='chamber'?'right':'left'});
  }
  fxStep(c,st.secP,dt,gPx,T,{x0:0,y0:0,x1:LW2,floor:521});
  fxRings(c,st.secR,dt,T,70);
  fxBanner(c,s,T,LW2,FAIL_LABELS);
}
