// Autopilot planner and flight controller.
/* ===== AUTOPILOT =====
   Receding-horizon planner. Every AP_REPLAN s it builds a time-indexed picture of everything that can hurt the plane over the next 4 s (AP_NP steps):
   terrain cells (including sliding, orbiting, pulsing and blinking ones), meteor / blast / lightning / geyser kill zones, perplexity beam walls,
   gravity-well pull + strain and crosswind gusts. It forward-simulates the plane's REAL lateral dynamics for 17 x 11 two-stage lane choices over the first 2.2 s and keeps the cheapest.
   CPU: obstacles are baked once per plan into a per-step clearance table (distance to the nearest hard / any obstacle edge, 0.25 m bins), so a rollout step is one
   interpolated lookup instead of a scan of every obstacle. The stage-1 prefix is simulated once per first-stage choice, and a running cost bound aborts any rollout that
   can no longer beat the best one. Calm skies (no hazards, big clearances) replan at AP_CALM instead of AP_REPLAN.
   Long-run survival: a cheap backward viability map (20 coarse steps x 128 lateral bins) tells each candidate whether its end point is a dead end.
   On Perplexity the guaranteed corridor safePath(D) is also a long-range target.
   Tight gaps: if no candidate survives, the plan is repeated with the plane rolled onto its wing (narrower hitbox); it rolls only while that is needed.
   Abilities: a predicted crash is first re-searched with a dense candidate set (most "crashes" turn out to be escapable). Only if that fails does it act:
   Slow-Mo when a what-if plan at slowed world speed survives, otherwise Shield at the last moment. Never two at once: a lockout, shield-coverage check and
   eased world-speed model stop the second ability from firing for the same threat. Nothing is drawn. */
const AP_DT=.04,AP_N=56,AP_SW=14,AP_NP=100,AP_MAXE=110,AP_REPLAN=.06,AP_CALM=.1,AP_XM=.22,AP_COMF=1.4,AP_KP=.5,AP_KD=.11;
const AP_BW=.5,AP_NB=128,AP_K=5,AP_ND=AP_NP/AP_K,AP_JT=Math.floor(AP_N/AP_K),AP_TC=45,AP_ROLLPEN=10,AP_ROLLAT=60;
/* a plan that hits ALWAYS ranks below any plan that survives the horizon, however poor its comfort / strain / dead-end score (those top out near 1300) */
const HITC=2000;
const AP_FW=.25,AP_FB=256,AP_IFW=1/AP_FW;                 /* clearance table: 256 bins x 0.25 m = same 64 m window as the viability map */
const AP_LOCK=.4,AP_LATE=.35,AP_LOOK=1.2,AP_NOW=.2;   /* lockout after firing (s, wall clock), shield window (s), look-ahead (s), 'about to hit' override (s) */                 
/* candidate offsets, centre-first so a good plan is found early and the cost bound prunes the rest */
const AP_O1=[0,-1,1,-2,2,-3.2,3.2,-4.5,4.5,-6,6,-8,8,-10.5,10.5,-14,14],AP_O2=[0,-1.5,1.5,-3,3,-5,5,-8,8,-12,12];
const AP_O1D=[],AP_O2D=[];for(let o=-16;o<=16;o+=1)AP_O1D.push(o);for(let o=-14;o<=14;o+=2)AP_O2D.push(o);
const AP={planAt:0,valid:false,tx:0,prevTx:0,v:20,ws:1,A:44,dec:.9,wellN:0,roll:0,doom:0,rolled:false,spOn:false,vs:4,R:2,bx0:0,sb1:0,sb2:0,sbh:-1,nt:0,dR:null,
  int:AP_REPLAN,lockUntil:0,wiAt:0,wiOk:false,rb:0,rb1:0,rb2:0,rbh:-1,rr:0,
  cx:new Float32Array(AP_NP*AP_MAXE),hw:new Float32Array(AP_NP*AP_MAXE),hd:new Uint8Array(AP_NP*AP_MAXE),cnt:new Int16Array(AP_NP),
  gust:new Float32Array(AP_NP),wx:new Float32Array(4),wz:new Float32Array(4),wy:new Float32Array(4),
  sp:new Float32Array(AP_N),spW:new Uint8Array(AP_N),dR0:new Float32Array(AP_NP),dR1:new Float32Array(AP_NP),
  blk:new Uint8Array(AP_ND*AP_NB),via:new Uint8Array((AP_ND+1)*AP_NB),
  fa:new Float32Array(AP_N*AP_FB),fh:new Float32Array(AP_N*AP_FB),shSteps:0,S0:new Float64Array(6),S1:new Float64Array(6),ord:new Uint8Array(48)};
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
/* world speed the plan should assume: while Slow-Mo eases in or out the real scale is mid-transition, so lean toward where it is heading */
function apWsEff(){const ws=state.worldScale,tg=state.worldScaleTarget??ws;return Math.abs(tg-ws)>.03?ws+(tg-ws)*.4:ws}
function apPrep(handling,wsOv){
  const ws=wsOv||apWsEff(),v=Math.max(2,state.speed*ws),N=AP_NP,DT=AP_DT,x0=state.x,wc=state.worldClock;
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
/* clearance table: for every step, the signed distance from lateral x to the nearest hard obstacle edge (fh) and to the nearest obstacle edge of any kind (fa).
   Same geometry as the obstacle list (terrain shrinks by the rolled hitbox reduction dR). 9 = nothing near. Piecewise linear, so lerp between bins is exact on edges. */
function apField(dR){
  const fa=AP.fa,fh=AP.fh,cnt=AP.cnt,cx=AP.cx,hw=AP.hw,hd=AP.hd,fx0=AP.bx0,FB=AP_FB,FW=AP_FW,pad=AP_COMF+.5;
  fa.fill(9);fh.fill(9);
  for(let i=0;i<AP_N;i++){
    const o=i*FB,b=i*AP_MAXE,n=cnt[i],dr=dR[i];
    for(let k=0;k<n;k++){
      const f=hd[b+k],h=(f&2)?hw[b+k]-dr:hw[b+k],c=cx[b+k],w=h+pad;
      let lo=Math.ceil((c-w-fx0)/FW),hi=Math.floor((c+w-fx0)/FW);
      if(lo<0)lo=0;if(hi>FB-1)hi=FB-1;
      if(f&1){for(let q=lo;q<=hi;q++){const d=Math.abs(fx0+q*FW-c)-h;if(d<fa[o+q])fa[o+q]=d;if(d<fh[o+q])fh[o+q]=d}}
      else{for(let q=lo;q<=hi;q++){const d=Math.abs(fx0+q*FW-c)-h;if(d<fa[o+q])fa[o+q]=d}}
    }
  }
}
/* simulate steps i0..i1-1 toward lateral target tg with the controller the live plane uses. S = [x, vx, comfort, strain, rollStrain, perplexOffset] in/out.
   returns the step of the first hit, -2 if the running cost already reached `bound` (cannot win), else -1 */
function apSim(i0,i1,tg,S,bound){
  const DT=AP_DT,hs=AP.shSteps,A=AP.A,dec=AP.dec,ws=AP.ws,v=AP.v,mx=CONFIG.maxLateral,wn=AP.wellN,rolled=AP.rolled,vs=AP.vs,spOn=AP.spOn,fa=AP.fa,fh=AP.fh,bx0=AP.bx0,gust=AP.gust,sp=AP.sp,spW=AP.spW,FM=AP_FB-1.001;
  let x=S[0],vx=S[1],pen=S[2],strain=S[3],rp=S[4],spc=S[5];
  for(let i=i0;i<i1;i++){
    let ext=gust[i];
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
    let u=AP_KP*(tg-x)-AP_KD*vx-ext*ws/A;
    if(u>1)u=1;else if(u<-1)u=-1;
    vx=(vx+u*A*DT+ext*ws*DT)*dec;if(vx>mx)vx=mx;else if(vx<-mx)vx=-mx;
    x+=vx*DT;
    if(rolled){const ax=(vx<0?-vx:vx)-vs;if(ax>0)rp+=ax}      /* hard steering while rolled strains the airframe */
    if(spOn&&spW[i])spc+=Math.abs(x-sp[i]);
    let p=(x-bx0)*AP_IFW;if(p<0)p=0;else if(p>FM)p=FM;
    const q=p|0,fr=p-q,o=i*AP_FB+q;
    if(i>=hs&&fh[o]+(fh[o+1]-fh[o])*fr<AP_XM){S[0]=x;S[1]=vx;S[2]=pen;S[3]=strain;S[4]=rp;S[5]=spc;return i}
    const d=fa[o]+(fa[o+1]-fa[o])*fr;
    if(d<AP_COMF){const z=AP_COMF-d;if(z*z>pen)pen=z*z}
    if(pen*8+strain*30+(rp*5+spc*.5)*DT>=bound)return -2     /* every term only grows, so this is a true lower bound */
  }
  S[0]=x;S[1]=vx;S[2]=pen;S[3]=strain;S[4]=rp;S[5]=spc;return -1
}
/* cost of a surviving rollout: comfort + strain + roll strain + perplexity offset + dead-end check (survivable coarse steps left vs the best possible) */
function apTail(S){
  let q=Math.floor((S[0]-AP.bx0)/AP_BW);q=q<0?0:q>AP_NB-1?AP_NB-1:q;
  const o=AP_JT*AP_NB,qa=q>0?q-1:0,qb=q<AP_NB-1?q+1:AP_NB-1;let vm=0;
  for(let p=qa;p<=qb;p++){const t=AP.via[o+p];if(t>vm)vm=t}
  return S[2]*8+S[3]*30+S[4]*AP_DT*5+S[5]*AP_DT*.5+(AP_ND-AP_JT-vm)*AP_TC
}
/* best two-stage plan from the offset lists. `cap` = cost to beat (nothing better -> returns cap). sets AP.sb1 / sb2 / sbh (first-hit step or -1) */
function apSearch(x0,vx0,O1,O2,cap){
  const N=AP_N,SW=AP_SW,S0=AP.S0,S1=AP.S1,n1=O1.length,n2=O2.length,ptx=AP.prevTx,ord=AP.ord;
  let best=cap,b1=x0,b2=x0,bh=-1;
  for(let a=0;a<n1;a++)ord[a]=a;                              /* nearest the previous plan first: steady plans, and an early good cost to prune against */
  for(let a=1;a<n1;a++){const w=ord[a],kw=Math.abs(x0+O1[w]-ptx);let j=a-1;while(j>=0&&Math.abs(x0+O1[ord[j]]-ptx)>kw){ord[j+1]=ord[j];j--}ord[j+1]=w}
  for(let ia=0;ia<n1;ia++){
    const o1=O1[ord[ia]],t1=x0+o1,e1=.04*Math.abs(o1)+.03*Math.abs(t1-ptx);
    if(e1>=best)continue;
    S0[0]=x0;S0[1]=vx0;S0[2]=S0[3]=S0[4]=S0[5]=0;
    const h0=apSim(0,SW,t1,S0,best-e1);
    if(h0===-2)continue;
    if(h0>=0){const c=HITC+(N-h0)*8+e1;if(c<best){best=c;b1=t1;b2=x0;bh=h0}continue}   /* hit before stage 2 starts: stage 2 cannot matter */
    for(let ib=0;ib<n2;ib++){
      const o2=O2[ib],ex=e1+.02*Math.abs(o2);if(ex>=best)continue;
      S1.set(S0);
      const h=apSim(SW,N,x0+o2,S1,best-ex);
      if(h===-2)continue;
      const c=(h>=0?HITC+(N-h)*8:apTail(S1))+ex;
      if(c<best){best=c;b1=t1;b2=x0+o2;bh=h}
    }
  }
  AP.sb1=b1;AP.sb2=b2;AP.sbh=bh;return best
}
/* build the obstacle picture for a world speed (null = current) and reset per-plan setup */
function apBuild(handling,wsOv){
  apPrep(handling,wsOv);
  const x0=state.x,v=AP.v;
  AP.shSteps=state.shieldTimer>0?Math.ceil((state.shieldTimer-.05)/AP_DT):0;   /* Shield makes terrain harmless until it ends: plan to be in clear air when it does */
  AP.bx0=x0-AP_NB*AP_BW*.5;AP.vs=ROLL.safeVx*handling*.9;
  AP.R=Math.max(1,Math.floor(Math.min(CONFIG.maxLateral*.6,.7*AP.A/CONFIG.turnDamping)*AP_K*AP_DT/AP_BW));
  /* Perplexity: the generator guarantees an empty corridor around safePath(D) and keeps terrain off it, so stay near it */
  AP.spOn=false;
  if(state.level===PERP_IDX&&!state.arena){
    const D0=state.distance;
    for(let i=0;i<AP_N;i++){const D=D0+v*(i+1)*AP_DT;if(D>=PERP_LAYOUT_D-20){AP.sp[i]=safePath(D);AP.spW[i]=1;AP.spOn=true}else AP.spW[i]=0}
  }
}
/* search the built picture: level flight first, then (only if nothing good) on the wing. result in AP.rb / rb1 / rb2 / rbh (first-hit step, -1 = survives) / rr (roll) */
function apSolve(deep){
  const x0=state.x,vx0=state.vx,O1=deep?AP_O1D:AP_O1,O2=deep?AP_O2D:AP_O2,held=AP.roll===1;
  apHs(0,AP.dR0);AP.dR=AP.dR0;AP.rolled=false;apViab(AP.dR0);apField(AP.dR0);
  let best=apSearch(x0,vx0,O1,O2,1e9),b1=AP.sb1,b2=AP.sb2,bh=AP.sbh,roll=0;
  /* on the wing: tried when level flight is poor, or whenever we are already rolled. Rolling takes a few tenths of a second to complete, so a plan that
     flips level <-> rolled every replan never gets the narrow hitbox: the current roll state is held unless the other choice is clearly better (hysteresis). */
  /* airframe care: on a damaged airframe (integrity <= .4) only roll when level flight would otherwise HIT. Refusing outright just converts every tight gap into an ability use or a crash. */
  if((best>=AP_ROLLAT||held)&&state.rollMode==='ok'&&state.rollLock<.5&&(state.integrity>.4||best>=HITC)){
    const lv=best+(held?AP_ROLLPEN:0);                         /* level flight pays to leave a held roll */
    apHs(Math.PI*.5,AP.dR1);AP.dR=AP.dR1;AP.rolled=true;apViab(AP.dR1);apField(AP.dR1);
    const pen=held?0:AP_ROLLPEN,c=apSearch(x0,vx0,O1,O2,lv-pen)+pen;
    if(c<lv){best=c;b1=AP.sb1;b2=AP.sb2;bh=AP.sbh;roll=1}
  }
  AP.rb=best;AP.rb1=b1;AP.rb2=b2;AP.rbh=bh;AP.rr=roll
}
function apPlan(handling){
  apBuild(handling,0);apSolve(false);
  let cost=AP.rb,b1=AP.rb1,roll=AP.rr,hit=AP.rbh;
  /* a predicted crash is often just a coarse search: look again with a dense candidate set before anything drastic */
  if(hit>=0&&(hit+1)*AP_DT<1.5){
    apSolve(true);
    if(AP.rb<cost){cost=AP.rb;b1=AP.rb1;roll=AP.rr;hit=AP.rbh}
  }
  AP.roll=roll;AP.tx=b1;AP.prevTx=b1;
  /* calm sky (nothing hazardous around, big clearances): replan less often */
  AP.int=(hit<0&&cost<6&&!meteors.length&&!blasts.length&&!bolts.length&&!geysers.length&&!beams.length&&!AP.wellN&&state.gustPhase==='idle')?AP_CALM:AP_REPLAN;
  apEmergency(hit>=0?(hit+1)*AP_DT:9,handling)
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
/* would the plan survive if Slow-Mo were on? same planner, world speed eased toward the Slow-Mo scale (not all the way: it takes time to ease in) */
function apSlowSaves(handling){
  const ws=apWsEff();
  apBuild(handling,CONFIG.slowMo+(ws-CONFIG.slowMo)*.3);apSolve(false);
  if(AP.rbh>=0)apSolve(true);
  return AP.rbh<0
}
/* a crash that no steering or roll can avoid (the dense re-search already failed). One ability, chosen by what is needed:
   Slow-Mo as soon as a what-if plan says it saves us, Shield only at the last moment, and never while a previous activation is still taking effect. */
function apEmergency(tHit,handling){
  const shOn=state.shieldTimer>0,now=performance.now(),lk=AP.lockUntil-now;
  /* locked out (wall clock, so a time-scaled dt during Slow-Mo cannot stretch it), too far off, or the live Shield already covers the hit.
     An imminent hit overrides the lockout once the plan has had time to see the new world speed: whatever just fired evidently was not enough. */
  if((lk>0&&!(tHit<=AP_NOW&&lk<AP_LOCK*1000-120))||tHit>AP_LOOK||(shOn&&state.shieldTimer>=tHit+.25)){AP.doom=0;AP.wiAt=0;return}
  const rdy=k=>save.abilities[k]>0&&(k==='shield'?state.shieldTimer<=0&&state.shieldCooldown<=0:state.slowTimer<=0&&state.slowCooldown<=0);
  const sh=rdy('shield'),sl=rdy('slow');
  if(!sh&&!sl){AP.doom=0;return}
  const late=tHit<=AP_LATE;
  if(++AP.doom<2&&!late)return;                          /* must persist for two plans unless it is about to happen */
  let k=null;
  if(sl&&!late){if(now>=AP.wiAt){AP.wiOk=apSlowSaves(handling);AP.wiAt=now+120}if(AP.wiOk)k='slow'}
  if(!k&&sh&&late)k='shield';
  else if(!k&&sl&&!sh&&tHit<=.6)k='slow';                /* no Shield to fall back on: Slow-Mo is the only help left */
  if(!k)return;
  AP.doom=0;AP.lockUntil=now+AP_LOCK*1000;AP.wiAt=0;AP.planAt=0;
  activateAbility(k);apNotice(ABILITIES[k].name+' ACTIVATED BY AUTOPILOT')
}
/* steering command for this frame (replaces keyboard / touch input while autopilot is active) */
function apAxis(dt,handling){
  /* replan on the wall clock: a time-scaled dt (Slow-Mo, hit-stop) must not stretch the replan interval just when the plane is in danger */
  const now=performance.now();
  if(!AP.valid||now-AP.planAt>=AP.int*1000){AP.planAt=now;apPlan(handling);AP.valid=true}
  const A=Math.max(1,CONFIG.turnAccel*handling*Math.max(.15,state.rollSteer??1)),ext=state.extForce||0;
  return clampN(AP_KP*(AP.tx-state.x)-AP_KD*state.vx-ext*state.worldScale/A,-1,1)
}

function apEngage(){AP.valid=false;AP.planAt=0;AP.prevTx=AP.tx=state.x;AP.roll=0;AP.doom=0;AP.lockUntil=0;AP.wiAt=0;AP.int=AP_REPLAN;apSound(true)}
function apHide(){AP.valid=false;AP.roll=0;AP.doom=0;document.getElementById('apBadge')?.classList.remove('on','warn')}
function apDisengage(){apHide();apSound(false)}
function apHud(){
  const on=state.apTimer>0;
  const el=document.getElementById('apBadge');if(!el)return;
  el.classList.toggle('on',on);el.classList.toggle('warn',on&&state.apTimer<3);if(on){const t=document.getElementById('apTime');if(t)t.textContent=state.apTimer.toFixed(1)+'s'}
}
