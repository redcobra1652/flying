// Autopilot planner and flight controller.
/* ===== AUTOPILOT =====
   Receding-horizon planner. Every AP_REPLAN s it builds a time-indexed picture of everything that can hurt the plane over the next 4 s (AP_NP steps):
   terrain cells (including sliding, orbiting, pulsing and blinking ones), meteor / blast / lightning / geyser kill zones, perplexity beam walls,
   gravity-well pull + strain and crosswind gusts. It forward-simulates the plane's REAL lateral dynamics (same acceleration, damping, handling,
   roll-control authority and world-time scaling, so Slow-Mo is handled) for 17 x 11 two-stage lane choices over the first 2.2 s and keeps the cheapest.
   Long-run survival: a cheap backward viability map (20 coarse steps x 128 lateral bins) over the whole 4 s tells each candidate whether its end point
   is a dead end, so the plane stops steering into pockets it cannot leave. On Perplexity the guaranteed corridor safePath(D) is also a long-range target.
   Tight gaps: if no candidate survives, the plan is repeated with the plane rolled onto its wing (narrower hitbox, same spring and ramp as the real roll);
   the autopilot rolls only while that is needed. If a crash is still unavoidable it fires Shield / Slow-Mo by itself and shows a short notice.
   Player steering and roll input are ignored while it runs. Nothing is drawn: no path line. */
const AP_DT=.04,AP_N=56,AP_SW=14,AP_NP=100,AP_MAXE=110,AP_REPLAN=.06,AP_XM=.22,AP_COMF=1.4,AP_KP=.5,AP_KD=.11;
const AP_BW=.5,AP_NB=128,AP_K=5,AP_ND=AP_NP/AP_K,AP_JT=Math.floor(AP_N/AP_K),AP_TC=45,AP_ROLLPEN=10,AP_ROLLAT=60;
const AP_O1=[-14,-10.5,-8,-6,-4.5,-3.2,-2,-1,0,1,2,3.2,4.5,6,8,10.5,14],AP_O2=[-12,-8,-5,-3,-1.5,0,1.5,3,5,8,12];
const AP={since:9,valid:false,tx:0,prevTx:0,v:20,ws:1,A:44,dec:.9,colStep:-1,wellN:0,roll:0,doom:0,rolled:false,spOn:false,vs:4,R:2,bx0:0,sb1:0,sb2:0,nt:0,dR:null,
  cx:new Float32Array(AP_NP*AP_MAXE),hw:new Float32Array(AP_NP*AP_MAXE),hd:new Uint8Array(AP_NP*AP_MAXE),cnt:new Int16Array(AP_NP),
  gust:new Float32Array(AP_NP),wx:new Float32Array(4),wz:new Float32Array(4),wy:new Float32Array(4),
  sp:new Float32Array(AP_N),spW:new Uint8Array(AP_N),dR0:new Float32Array(AP_NP),dR1:new Float32Array(AP_NP),
  blk:new Uint8Array(AP_ND*AP_NB),via:new Uint8Array((AP_ND+1)*AP_NB)};
/* one obstacle / hazard sample for step i. hard = can hurt; soft = only counts toward the comfort margin */
function apAdd(i,cx,hw,hard,ter){
  const c=AP.cnt[i];if(c>=AP_MAXE||(!hard&&c>=AP_MAXE-24))return;
  const o=i*AP_MAXE+c;AP.cx[o]=cx;AP.hw[o]=hw;AP.hd[o]=(hard?1:0)|(ter?2:0);AP.cnt[i]=c+1
}
/* a kill disc of radius rad centred at lateral hx whose z (relative to the plane) is zr0 now and sweeps toward the plane at AP.v. active from tA to tB (s) */
function apDisc(hx,zr0,rad,tA,tB){
  const v=AP.v;if(tB<0)return;
  for(let i=Math.max(0,Math.floor(tA/AP_DT));i<AP_N&&i*AP_DT<=tB;i++){
    const ta=i*AP_DT,za=zr0+v*ta,zb=za+v*AP_DT,zm=(za<=0&&zb>=0)?0:Math.min(Math.abs(za),Math.abs(zb));
    if(zm<rad)apAdd(i,hx,Math.sqrt(rad*rad-zm*zm),true)
  }
}
function apRise(ph){const LOW=.12;if(ph<.1)return LOW+(1-LOW)*smooth01(ph/.1);if(ph<.5)return 1;if(ph<.62)return 1-(1-LOW)*smooth01((ph-.5)/.12);return LOW}
function apPulseSolid(r,wa,wb,limit){const p=r.pulse;for(const t of [wa,wb]){const ph=((t/p.per+p.ph)%1+1)%1;if(r.baseH*apRise(ph)>limit)return true}return false}
/* blinking blocks only flip while 18+ m ahead; closer than that they are frozen in their current state */
function apBlinkSolid(r,zB,ta,tb,v,wc,ws){
  const b=r.blink;if(zB>-18)return r.bt===1||(r.bs>.35&&ta<.3);
  const tf=(-18-zB)/v;
  for(const t of [Math.min(ta,tf),Math.min(tb,tf)]){const ph=(((wc+ws*t)/b.per+b.ph)%1+1)%1;if(ph<.62)return true}
  return false
}
function apPrep(handling){
  const ws=state.worldScale,v=Math.max(2,state.speed*ws),N=AP_NP,DT=AP_DT,x0=state.x,wc=state.worldClock;
  AP.v=v;AP.ws=ws;AP.A=Math.max(1,CONFIG.turnAccel*handling*Math.max(.15,state.rollSteer??1));AP.dec=Math.exp(-CONFIG.turnDamping*DT);AP.cnt.fill(0);
  const reach=v*N*DT+10;
  /* terrain */
  if(!state.arena){
    const rx=CONFIG.planeCollisionX,rz=CONFIG.planeCollisionZ,limit=CONFIG.baseAltitude-CONFIG.planeCollisionY-CONFIG.collisionForgiveness-.15;
    for(const ch of chunks){
      if(!ch.ready)continue;
      const cz=ch.sourceZ+state.worldZ;
      if(cz-CHUNK/2>10||cz+CHUNK/2<-reach||Math.abs(ch.centerX-x0)>CHUNK/2+32)continue;
      for(const r of ch.records){
        const dyn=r.mv||r.orb||r.pulse||r.blink,H=Math.max(r.h,(r.riser||r.pulse||r.blink)?r.baseH:0);
        if(H<=limit)continue;
        const R=r.orb?r.orb.r:0,Am=r.mv?r.mv.amp:0,bx=ch.centerX+r.localX+(dyn?r.baseOX:r.offsetX);
        if(Math.abs(bx-x0)-Am-R>32)continue;
        const zB=cz+r.localZ+(dyn?r.baseOZ:r.offsetZ),hwX=r.width*.5+rx,W=r.depth*.5+rz+.3,Wp=W+1.1;
        let i0=0,i1=N-1;
        if(!r.orb){i0=Math.max(0,Math.floor((-Wp-zB)/(v*DT))-1);i1=Math.min(N-1,Math.ceil((Wp-zB)/(v*DT))+1);if(i0>i1)continue}
        else if(zB>Wp+R+2||zB<-reach-R)continue;
        for(let i=i0;i<=i1;i++){
          const ta=i*DT,tb=ta+DT;let za=zB+v*ta,zb=zB+v*tb,xa=bx,xb=bx;
          if(dyn){
            const wa=wc+ws*ta,wb=wc+ws*tb;
            if(r.mv){xa+=r.mv.amp*Math.sin(wa*r.mv.w+r.mv.ph);xb+=r.mv.amp*Math.sin(wb*r.mv.w+r.mv.ph)}
            if(r.orb){const o=r.orb;xa+=R*Math.cos(wa*o.w+o.ph);xb+=R*Math.cos(wb*o.w+o.ph);za+=R*Math.sin(wa*o.w+o.ph);zb+=R*Math.sin(wb*o.w+o.ph)}
            if(r.pulse&&!apPulseSolid(r,wa,wb,limit))continue;
            if(r.blink&&!apBlinkSolid(r,zB,ta,tb,v,wc,ws))continue
          }
          const lo=Math.min(za,zb),hi=Math.max(za,zb),hard=hi>-W&&lo<W;
          if(!hard&&!(hi>-Wp&&lo<Wp))continue;
          apAdd(i,(xa+xb)*.5,hwX+Math.abs(xb-xa)*.5,hard,true)
        }
      }
    }
  }
  /* meteors, blasts, lightning, geysers: kill discs that sweep past as the world scrolls */
  for(const m of meteors){const tI=(m.T-m.t)/ws;apDisc(m.x,m.zs+state.worldZ,BR+.5,tI-.06,tI+.42/ws+.06)}
  for(const b of blasts)if(b.age<.42)apDisc(b.x,b.zs+state.worldZ,BR+.5,0,(.42-b.age)/ws+.04);
  for(const b of bolts){
    const zr=b.zs+state.worldZ;
    if(!b.struck){const tS=(b.T-b.t)/ws;apDisc(b.x,zr,LR+.6,tS-.05,tS+.22/ws+.05)}
    else if(b.age<.22)apDisc(b.x,zr,LR+.6,0,(.22-b.age)/ws+.04)
  }
  for(const g of geysers){
    const zr=g.zs+state.worldZ;let a,e;
    if(g.t<g.T){const tE=(g.T-g.t)/ws;a=tE+.04/ws;e=tE+1.1/ws}else{const ge=Math.max(0,g.e);a=Math.max(0,.04-ge)/ws;e=(1.1-ge)/ws}
    apDisc(g.x,zr,GR+.7,a,e)
  }
  /* sky beams: a kill disc (column) or a row of discs along the blade, placed where it will be when it crosses the plane. lethal from the strike for BM_ACT s */
  for(const b of beams){
    const zr=b.zs+state.worldZ;if(zr>8)continue;
    const tA=b.struck?0:(b.T-b.t)/ws-.05,tB=b.struck?Math.max(0,BM_ACT-b.age)/ws:(b.T-b.t+BM_ACT)/ws;
    if(!b.blade){apDisc(b.x,zr,BM_R+.7,tA,tB);continue}
    const tc=Math.max(0,-zr/Math.max(1,v)),thc=b.rot+b.w*(b.t+tc*ws),cc=Math.cos(thc),sc=Math.sin(thc);
    for(let q=-BL_HALF;q<=BL_HALF+.01;q+=1.75)apDisc(b.x+q*cc,zr+q*sc,BL_KILL+.7,tA,tB)
  }
  /* gravity wells: pull + strain are simulated, they are not hard hits */
  AP.wellN=0;
  for(const w of wells){const zr=w.zs+state.worldZ;if(zr>36||zr<-(reach+34)||AP.wellN>=4)continue;const k=AP.wellN++;AP.wx[k]=w.x;AP.wz[k]=zr;AP.wy[k]=w.y-CONFIG.baseAltitude}
  /* crosswind gust: direction and timing are known once the warning starts */
  let tb0=null;
  if(state.gustPhase==='warn')tb0=(.85-state.gustTime)/ws;else if(state.gustPhase==='blow')tb0=-state.gustTime/ws;
  for(let i=0;i<N;i++){let f=0;if(tb0!==null){const tw=((i+.5)*DT-tb0)*ws;if(tw>0&&tw<1.6)f=state.gustDir*24*Math.pow(Math.sin(Math.PI*tw/1.6),.7)}AP.gust[i]=f}
}
/* plane half-width reduction (m) per step if the roll command is T (0 level, pi/2 knife-edge): same spring + hitbox ramp as updateRollSystem */
function apHs(T,out){
  const R=ROLL,rx=CONFIG.planeCollisionX,okm=state.rollMode==='ok',lf=1-Math.exp(-14*AP_DT);
  let r=state.roll,rv=state.rollV,h=state.hitScaleX;
  for(let i=0;i<AP_NP;i++){
    const t=(okm&&state.rollLock<=i*AP_DT)?T:0;
    rv+=(R.w*R.w*(t-r)-2*R.w*rv)*AP_DT;r+=rv*AP_DT;
    if(r>R.rollLimit){r=R.rollLimit;if(rv>0)rv=0}else if(r<-R.rollLimit){r=-R.rollLimit;if(rv<0)rv=0}
    h+=((okm?1-(1-R.narrow)*smooth01(Math.abs(Math.sin(r))):1)-h)*lf;
    out[i]=rx*(1-h)
  }
}
/* blocked map (step groups x lateral bins) from the hard obstacles, then backward viability: how many further coarse steps can be survived from each bin */
function apViab(dR){
  const blk=AP.blk,via=AP.via,cnt=AP.cnt,cx=AP.cx,hw=AP.hw,hd=AP.hd,NB=AP_NB,BW=AP_BW,bx0=AP.bx0,ND=AP_ND,K=AP_K;
  blk.fill(0);
  for(let i=0;i<AP_NP;i++){
    const o=((i/K)|0)*NB,b=i*AP_MAXE,n=cnt[i],dr=dR[i];
    for(let k=0;k<n;k++){
      const f=hd[b+k];if(!(f&1))continue;
      const h=((f&2)?hw[b+k]-dr:hw[b+k])+AP_XM+.3,c=cx[b+k];
      let lo=Math.floor((c-h-bx0)/BW-.5)+1,hi=Math.ceil((c+h-bx0)/BW-.5)-1;
      if(lo<0)lo=0;if(hi>NB-1)hi=NB-1;
      for(let q=lo;q<=hi;q++)blk[o+q]=1
    }
  }
  const R=AP.R;via.fill(0,ND*NB);
  for(let j=ND-1;j>=0;j--){
    const o=j*NB,n=o+NB;
    for(let q=0;q<NB;q++){
      if(blk[o+q]){via[o+q]=0;continue}
      const a=q-R<0?0:q-R,e=q+R>NB-1?NB-1:q+R;let m=0;
      for(let p=a;p<=e;p++){const t=via[n+p];if(t>m)m=t}
      via[o+q]=m+1
    }
  }
}
/* forward-simulate with the same controller the live plane uses. returns a cost (lower is better); AP.colStep = step of first hit or -1 */
function apRun(x0,vx0,t1,t2){
  const N=AP_N,DT=AP_DT,A=AP.A,dec=AP.dec,ws=AP.ws,v=AP.v,cx=AP.cx,hw=AP.hw,hd=AP.hd,cnt=AP.cnt,mx=CONFIG.maxLateral,wn=AP.wellN,dR=AP.dR,rolled=AP.rolled,vs=AP.vs,spOn=AP.spOn;
  let x=x0,vx=vx0,pen=0,strain=0,rp=0,spc=0;AP.colStep=-1;
  for(let i=0;i<N;i++){
    let ext=AP.gust[i];
    if(wn){
      const t=(i+1)*DT;
      for(let k=0;k<wn;k++){
        const dx=AP.wx[k]-x,zr=AP.wz[k]+v*t,dy=AP.wy[k],d=Math.sqrt(dx*dx+dy*dy+zr*zr);
        if(d<WELL_PULL){
          const q=1-d/WELL_PULL,s=dx/2.5;ext+=WELL_FORCE*Math.pow(q,1.25)*(s>1?1:s<-1?-1:s);
          if(d<WELL_STRAIN){const m=1-d/WELL_STRAIN;strain+=m*m*(3-2*m)*DT}
        }
      }
    }
    let u=AP_KP*((i<AP_SW?t1:t2)-x)-AP_KD*vx-ext*ws/A;
    if(u>1)u=1;else if(u<-1)u=-1;
    vx=(vx+u*A*DT+ext*ws*DT)*dec;if(vx>mx)vx=mx;else if(vx<-mx)vx=-mx;
    x+=vx*DT;
    if(rolled){const ax=(vx<0?-vx:vx)-vs;if(ax>0)rp+=ax}      /* hard steering while rolled strains the airframe */
    if(spOn&&AP.spW[i])spc+=Math.abs(x-AP.sp[i]);
    const b=i*AP_MAXE,n=cnt[i],dr=dR[i];let mc=99,hit=false;
    for(let k=0;k<n;k++){const f=hd[b+k],d=Math.abs(x-cx[b+k])-((f&2)?hw[b+k]-dr:hw[b+k]);if(d<mc)mc=d;if(d<AP_XM&&(f&1)){hit=true;break}}
    if(hit){AP.colStep=i;return 500+(N-i)*8}
    if(mc<AP_COMF){const q=AP_COMF-mc;if(q*q>pen)pen=q*q}
  }
  /* dead-end check: survivable coarse steps left after the rollout ends, against the best possible */
  let q=Math.floor((x-AP.bx0)/AP_BW);q=q<0?0:q>AP_NB-1?AP_NB-1:q;
  const o=AP_JT*AP_NB,qa=q>0?q-1:0,qb=q<AP_NB-1?q+1:AP_NB-1;let vm=0;
  for(let p=qa;p<=qb;p++){const t=AP.via[o+p];if(t>vm)vm=t}
  return pen*8+strain*30+rp*DT*5+spc*DT*.5+(AP_ND-AP_JT-vm)*AP_TC
}
function apSearch(x0,vx0){
  let best=1e9,b1=x0,b2=x0;
  for(let a=0;a<AP_O1.length;a++){
    const o1=AP_O1[a],t1=x0+o1,e1=.04*Math.abs(o1)+.03*Math.abs(t1-AP.prevTx);
    for(let b=0;b<AP_O2.length;b++){
      const o2=AP_O2[b],c=apRun(x0,vx0,t1,x0+o2)+e1+.02*Math.abs(o2);
      if(c<best){best=c;b1=t1;b2=x0+o2}
      if(AP.colStep>=0&&AP.colStep<AP_SW)break      /* hit before the second stage starts: the rest of the row is identical */
    }
  }
  AP.sb1=b1;AP.sb2=b2;return best
}
function apPlan(handling){
  apPrep(handling);
  const x0=state.x,vx0=state.vx,v=AP.v;
  AP.bx0=x0-AP_NB*AP_BW*.5;AP.vs=ROLL.safeVx*handling*.9;
  AP.R=Math.max(1,Math.floor(Math.min(CONFIG.maxLateral*.6,.7*AP.A/CONFIG.turnDamping)*AP_K*AP_DT/AP_BW));
  /* Perplexity: the generator guarantees an empty corridor around safePath(D) and keeps terrain off it (sky beams are telegraphed hazards like lightning), so stay near it */
  AP.spOn=false;
  if(state.level===PERP_IDX&&!state.arena){
    const D0=state.distance;
    for(let i=0;i<AP_N;i++){const D=D0+v*(i+1)*AP_DT;if(D>=PERP_LAYOUT_D-20){AP.sp[i]=safePath(D);AP.spW[i]=1;AP.spOn=true}else AP.spW[i]=0}
  }
  /* 1) level flight */
  apHs(0,AP.dR0);AP.dR=AP.dR0;AP.rolled=false;apViab(AP.dR0);
  let best=apSearch(x0,vx0),b1=AP.sb1,b2=AP.sb2,roll=0;
  /* 2) nothing good without rolling: try on the wing (narrow hitbox). only when roll control is actually available. */
  if(best>=AP_ROLLAT&&state.rollMode==='ok'&&state.rollLock<.5&&state.integrity>.4){
    apHs(Math.PI*.5,AP.dR1);AP.dR=AP.dR1;AP.rolled=true;apViab(AP.dR1);
    const c=apSearch(x0,vx0)+AP_ROLLPEN;
    if(c<best){best=c;b1=AP.sb1;b2=AP.sb2;roll=1}
    else{AP.dR=AP.dR0;AP.rolled=false}
  }
  AP.roll=roll;AP.tx=b1;AP.prevTx=b1;
  apRun(x0,vx0,b1,b2);                                  /* re-run the chosen plan to read its first-hit step */
  apEmergency(AP.colStep>=0?(AP.colStep+1)*AP_DT:9)
}
function apNotice(txt){
  try{
    let el=document.getElementById('apNotice');
    if(!el){el=document.createElement('div');el.id='apNotice';el.setAttribute('aria-live','polite');
      el.style.cssText='position:absolute;top:68px;left:50%;transform:translateX(-50%);padding:7px 13px;font:700 10px Manrope,sans-serif;letter-spacing:.24em;color:#fff;background:rgba(13,24,35,.38);border:1px solid rgba(150,236,255,.55);border-radius:4px;backdrop-filter:blur(8px);opacity:0;transition:opacity .25s;pointer-events:none;white-space:nowrap;z-index:5';
      (document.getElementById('hud')||document.body).appendChild(el)}
    el.textContent=txt;el.style.opacity='1';clearTimeout(AP.nt);AP.nt=setTimeout(()=>{el.style.opacity='0'},1800)
  }catch{}
}
/* a crash that no steering or roll can avoid: use Shield / Slow-Mo ourselves (Slow-Mo first when there is still time to use it, Shield as the last resort) */
function apEmergency(tHit){
  if(tHit>1.5){AP.doom=0;return}
  const rdy=k=>save.abilities[k]>0&&(k==='shield'?state.shieldTimer<=0&&state.shieldCooldown<=0:state.slowTimer<=0&&state.slowCooldown<=0);
  const sh=rdy('shield'),sl=rdy('slow');
  if(!sh&&!sl){AP.doom=0;return}
  if(++AP.doom<2&&tHit>.4)return;                       /* must persist for two plans unless it is about to happen */
  let k=null;
  if(sl&&tHit>.65)k='slow';else if(sh&&tHit<=.95)k='shield';else if(sl&&!sh)k='slow';
  if(!k)return;
  AP.doom=0;activateAbility(k);apNotice(ABILITIES[k].name+' ACTIVATED BY AUTOPILOT')
}
/* steering command for this frame (replaces keyboard / touch input while autopilot is active) */
function apAxis(dt,handling){
  AP.since+=dt;
  if(!AP.valid||AP.since>=AP_REPLAN){apPlan(handling);AP.since=0;AP.valid=true}
  const A=Math.max(1,CONFIG.turnAccel*handling*Math.max(.15,state.rollSteer??1)),ext=state.extForce||0;
  return clampN(AP_KP*(AP.tx-state.x)-AP_KD*state.vx-ext*state.worldScale/A,-1,1)
}

function apEngage(){AP.valid=false;AP.since=9;AP.prevTx=AP.tx=state.x;AP.roll=0;AP.doom=0;apSound(true)}
function apHide(){AP.valid=false;AP.roll=0;AP.doom=0;document.getElementById('apBadge')?.classList.remove('on','warn')}
function apDisengage(){apHide();apSound(false)}
function apHud(){
  const on=state.apTimer>0;
  const el=document.getElementById('apBadge');if(!el)return;
  el.classList.toggle('on',on);el.classList.toggle('warn',on&&state.apTimer<3);if(on){const t=document.getElementById('apTime');if(t)t.textContent=state.apTimer.toFixed(1)+'s'}
}
