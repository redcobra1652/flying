// Ability integration, game flow, frame loop, tutorial, and boot.
function abilityState(k){return k==='shield'?{timer:'shieldTimer',cool:'shieldCooldown',safety:'shieldSafety'}:k==='autopilot'?{timer:'apTimer',cool:'apCooldown'}:{timer:'slowTimer',cool:'slowCooldown'}}
function activateAbility(k){if(state.mode!=='PLAYING'||!save.abilities[k])return;const a=ABILITIES[k],lv=save.abilities[k],s=abilityState(k),btn=document.querySelector(`.ability-button[data-key="${k}"]`);if(state[s.timer]>0||state[s.cool]>0){if(btn){btn.classList.remove('shake');void btn.offsetWidth;btn.classList.add('shake')}return}state[s.timer]=a.levels[lv].duration;if(k==='slow')state.worldScaleTarget=.4;if(k==='shield')setShieldHum(true);if(k==='autopilot')apEngage();if(btn)btn.classList.add('active')}
function finishAbility(k){const s=abilityState(k),btn=document.querySelector(`.ability-button[data-key="${k}"]`);state[s.timer]=0;state[s.cool]=ABILITIES[k].levels[save.abilities[k]].cooldown;if(k==='shield'){setShieldHum(false);shieldEndSound();let overlap=planeCollides();state.shieldSafety=overlap ? 0.6 : 0;shieldBubble.visible=false;plane.traverse(o=>{if(o.isMesh&&!o.userData.cp&&o.userData.baseOpacity!==undefined){o.material.opacity=o.userData.baseOpacity;o.material.transparent=o.userData.baseTransparent}})}else if(k==='autopilot')apDisengage();else state.worldScaleTarget=1;if(btn)btn.classList.remove('active')}
function updateAbilities(realDt){if(state.mode!=='PLAYING')return;for(const k of ['shield','slow','autopilot']){const s=abilityState(k);if(state[s.cool]>0)state[s.cool]=Math.max(0,state[s.cool]-realDt);if(state[s.timer]>0){state[s.timer]=Math.max(0,state[s.timer]-realDt);if(state[s.timer]===0)finishAbility(k)}}if(state.shieldSafety>0){if(!planeCollides())state.shieldSafety=0;else state.shieldSafety=Math.max(0,state.shieldSafety-realDt)}state.worldScale=THREE.MathUtils.lerp(state.worldScale,state.worldScaleTarget,Math.min(1,realDt/.25));shieldBubble.visible=state.shieldTimer>0;shieldBubble.position.copy(plane.position);shieldBubble.scale.setScalar(.42);if(state.shieldTimer>0){const flick=state.shieldTimer<.8&&Math.sin(performance.now()*.035)>0;shieldBubble.material.uniforms.uAlpha.value=flick ? .12 : .34;plane.traverse(o=>{if(o.isMesh&&!o.userData.cp){if(o.userData.baseOpacity===undefined){o.userData.baseOpacity=o.material.opacity;o.userData.baseTransparent=o.material.transparent}o.material.transparent=true;o.material.opacity=.66}})}else plane.traverse(o=>{if(o.isMesh&&!o.userData.cp&&o.userData.baseOpacity!==undefined){o.material.opacity=o.userData.baseOpacity;o.material.transparent=o.userData.baseTransparent}});apHud();document.getElementById('slowGrade').classList.toggle('on',state.worldScale<.98);for(const b of document.querySelectorAll('.ability-button')){const k=b.dataset.key,s=abilityState(k),duration=ABILITIES[k].levels[save.abilities[k]].duration,cool=ABILITIES[k].levels[save.abilities[k]].cooldown,remaining=state[s.timer]||state[s.cool],pct=state[s.timer]>0?state[s.timer]/duration:state[s.cool]>0?1-state[s.cool]/cool:1;b.style.setProperty('--cool',`${pct*100}%`);b.classList.toggle('active',state[s.timer]>0);b.classList.toggle('ready',state[s.timer]===0&&state[s.cool]===0);b.setAttribute('aria-label',`${ABILITIES[k].name}, ${remaining>0?Math.ceil(remaining)+' seconds':'ready'}`)}}
document.getElementById('play').addEventListener('click',startRun);document.getElementById('goHome').addEventListener('click',()=>{resetWorld();state.mode='HOME';dead.classList.remove('active');hud.classList.remove('visible');home.classList.add('active');document.getElementById('vignette').classList.remove('on')});

/* ---- debug: open the page with ?map=N (1-13, 0 = normal) or call window.__jumpToMap(N) mid-run. credits for the skipped distance are pre-paid so this can't be used to farm ---- */
let DEBUG_MAP=0;try{DEBUG_MAP=clampN(parseInt(new URLSearchParams(location.search).get('map'))||0,0,LEVELS.length-1)}catch{}
function jumpToMap(n){
  n=clampN(n|0,0,LEVELS.length-1);const D=n*CONFIG.levelMeters;
  state.distance=state.worldZ=D;state.lifetimeAccountedDistance=D;state.x=0;state.vx=0;
  state.level=state.fromLevel=state.toLevel=n;state.levelStart=D;state.transition=1;state.levelsReached=n;state.terrainAnim=false;
  state.paidRunDistance=runCredits(D);state.paidRunLevel=Array.from({length:n},(_,i)=>levelBonus(i+1)).reduce((a,b)=>a+b,0)+(n>=PERP_IDX?ECONOMY.perplexBonus+ECONOMY.arenaBonus:0);state.gatePassed=n>=PERP_IDX;state.arenaDone=n>=PERP_IDX;state.perpOK=n>=PERP_IDX;
  state.speed=speedAtDistance(D);const mr=LEVEL_RULES[n].meteor;state.meteorTimer=mr?mr.every[0]*.7:3;resetHazardTimers(n);
  plane.position.x=0;streamChunks(true);camera.position.x=0;
  const dEl=document.getElementById('distance');if(dEl)dEl.textContent=Math.floor(D).toLocaleString()
}
window.__jumpToMap=jumpToMap;

/* ---- ADMIN PANEL: press 5 to open, click a map to teleport there at that map's speed ---- */
const adminEl=document.getElementById('admin'),adminListEl=document.getElementById('adminList');
function adminBuild(){adminListEl.innerHTML=LEVELS.map((L,i)=>`<button class="admin-map" data-map="${i}"><i>${i+1}</i><span>${L.name}</span><em>${Math.round(speedAtDistance(i*CONFIG.levelMeters)*3.6)} km/h</em></button>`).join('')+`<div class="admin-sub" style="padding:8px 2px 0">CUTSCENES</div><button class="admin-map" data-scene="cut1"><i>&#9654;</i><span>Cutscene 1</span></button><button class="admin-map" data-scene="arena"><i>&#9654;</i><span>Event Horizon</span></button><button class="admin-map" data-scene="cut2"><i>&#9654;</i><span>Cutscene 2</span></button>`}
function adminMark(){const cur=state.mode==='HOME'||state.mode==='DEAD'?-1:state.level;adminListEl.querySelectorAll('.admin-map').forEach(b=>b.classList.toggle('cur',+b.dataset.map===cur))}
function adminToggle(force){if(state.mode==='SHOP')return;const open=force===undefined?!adminEl.classList.contains('open'):force;adminEl.classList.toggle('open',open);adminEl.setAttribute('aria-hidden',String(!open));if(open)adminMark();else document.activeElement?.blur?.()}
function adminTeleport(n){
  if(!['HOME','DEAD','PLAYING','GATE','CUT1','CUT2'].includes(state.mode))return;
  n=clampN(n|0,0,LEVELS.length-1);
  resetWorld();                                   /* clean slate: clears arena, cutscenes, gate, hazards, crash debris */
  jumpToMap(n);                                   /* sets distance and speed to the map's own values */
  state.mode='PLAYING';state.timeScale=1;state.worldScale=state.worldScaleTarget=1;
  home.classList.remove('active');dead.classList.remove('active');hud.classList.add('visible');
  document.getElementById('vignette').classList.remove('on');document.getElementById('slowGrade').classList.remove('on');
  const t=document.getElementById('levelToast');t.textContent=LEVELS[n].name;t.classList.add('show');clearTimeout(adminTeleport._t);adminTeleport._t=setTimeout(()=>t.classList.remove('show'),1800);
  startMusic(true);adminMark()
}
function adminScene(name){
  if(!['HOME','DEAD','PLAYING','GATE','CUT1','CUT2'].includes(state.mode))return;
  resetWorld();jumpToMap(PERP_IDX-1);                /* start from the map just before the finale, like a real run */
  state.mode='PLAYING';state.timeScale=1;state.worldScale=state.worldScaleTarget=1;state.gatePassed=true;
  home.classList.remove('active');dead.classList.remove('active');hud.classList.add('visible');
  document.getElementById('vignette').classList.remove('on');document.getElementById('slowGrade').classList.remove('on');
  blackoutEl.style.transitionDuration='0s';blackoutEl.classList.remove('on');
  if(name==='cut1')startCut1();else if(name==='arena')startArena();else if(name==='cut2')startCut2();
  adminToggle(false)
}
adminBuild();
adminListEl.addEventListener('click',e=>{const b=e.target.closest('.admin-map');if(!b)return;if(b.dataset.scene)adminScene(b.dataset.scene);else adminTeleport(+b.dataset.map);b.blur()});
window.__adminScene=adminScene;
document.getElementById('adminClose').addEventListener('click',()=>adminToggle(false));
window.__adminTeleport=adminTeleport;
/* debug: ?map=14 (or window.__jumpToMap(14)) starts on Perplexity itself; ?gate=1 (or window.__nearGate()) starts 60 m before the flash-warning gate */
let DEBUG_GATE=false;try{DEBUG_GATE=new URLSearchParams(location.search).get('gate')==='1'}catch{}
function nearGate(){jumpToMap(PERP_IDX-1);const D=GATE_D-60;state.distance=state.worldZ=D;state.lifetimeAccountedDistance=D;state.paidRunDistance=runCredits(D);state.speed=speedAtDistance(D);streamChunks(true);document.getElementById('distance').textContent=Math.floor(D).toLocaleString()}
window.__nearGate=nearGate;
/* GAME FLOW */
function resetWorld(){clearCrash();clearMeteors();resetField();state.distance=0;state.worldZ=0;touchAxis=0;touchRoll=0;touchPts.clear();state.x=0;state.vx=0;state.bank=0;state.yaw=0;state.speed=0;state.level=0;state.levelStart=0;state.fromLevel=state.toLevel=0;state.transition=1;state.timeScale=1;state.worldScale=1;state.worldScaleTarget=1;state.clock=0;state.worldClock=0;state.crashElapsed=0;state.hitTimer=0;state.shake=0;state.rumble=0;state.meteorTimer=8;resetHazardTimers(0);state.terrainAnim=false;state.spikeWeight=0;state.levelsReached=0;resetGateState();state.paidThisRun=0;state.paidRunDistance=0;state.paidRunLevel=0;state.lifetimeAccountedDistance=0;state.shieldTimer=state.shieldSafety=state.slowTimer=0;state.shieldCooldown=save.abilities.shield?ABILITIES.shield.levels[save.abilities.shield].cooldown:0;state.slowCooldown=save.abilities.slow?ABILITIES.slow.levels[save.abilities.slow].cooldown:0;state.apTimer=0;state.apCooldown=save.abilities.autopilot?ABILITIES.autopilot.levels[save.abilities.autopilot].cooldown:0;apHide();plane.visible=true;plane.scale.setScalar(.42);plane.position.set(0,CONFIG.baseAltitude,0);plane.rotation.set(0,0,0);resetRollSystem();shieldBubble.visible=false;streamChunks(true);camera.position.set(0,5.2,10.5);camera.fov=57;camera.updateProjectionMatrix()}
function startRun(){if(state.mode==='PLAYING'||state.mode==='SHOP'||state.lock||state.tut||state.forceHome)return;resetWorld();state.speed=CONFIG.baseSpeed;if(DEBUG_MAP>0)jumpToMap(DEBUG_MAP);else if(DEBUG_GATE)nearGate();state.mode='PLAYING';home.classList.remove('active');dead.classList.remove('active');hud.classList.add('visible');document.getElementById('distance').textContent='0';document.getElementById('levelToast').textContent=LEVELS[DEBUG_MAP].name;document.getElementById('levelToast').classList.add('show');setTimeout(()=>document.getElementById('levelToast').classList.remove('show'),1800);document.getElementById('vignette').classList.remove('on');document.getElementById('slowGrade').classList.remove('on');startMusic(true)}
document.getElementById('goHome').addEventListener('click',()=>{showHomeBest()});
/* TEST: respawn at the nearest forward D >= crash D + 10 where -16..+45 m and |dx| <= 8 around x hold no solid (risers included);
   x starts at the crash x and is shifted in 2-unit steps up to +-40 before D moves on */
function findSafeSpot(fromD,fromX){
  for(let off=0;off<600;off+=4){
    const Dc=fromD+off;
    for(let s=0;s<=40;s++){
      const x=fromX+(s===0?0:(s%2?1:-1)*2*Math.ceil(s/2));
      if(freeBox(x-8,x+8,Dc-16,Dc+45))return {D:Dc,x}
    }
  }
  return {D:fromD,x:fromX}
}
function continueRun(){if(state.forceHome)return;
  if(state.mode!=='DEAD')return;
  clearCrash();clearMeteors();hideGateUI();
  const spot=findSafeSpot(state.distance+10,state.x),Dc=spot.D;
  state.distance=Dc;state.worldZ=Dc;state.lifetimeAccountedDistance=Dc;state.x=spot.x;state.vx=0;state.bank=0;state.yaw=0;state.speed=speedAtDistance(Dc);
  state.timeScale=1;state.crashElapsed=0;state.hitTimer=0;state.shake=0;state.rumble=0;state.meteorTimer=6;resetHazardTimers(state.level);state.terrainAnim=state.transition<1;
  plane.visible=true;plane.scale.setScalar(.42);plane.position.set(state.x,CONFIG.baseAltitude,0);plane.rotation.set(0,0,0);
  if(!state.arena)streamChunks(true);camera.position.set(state.x,5.2,10.5);
  state.mode='PLAYING';dead.classList.remove('active');hud.classList.add('visible');startMusic(false);
  document.getElementById('distance').textContent=Math.floor(Dc).toLocaleString();document.getElementById('vignette').classList.remove('on')
}
document.getElementById('continue').addEventListener('click',continueRun);
/* FLY AGAIN: straight from the crash screen into a fresh run. Taps in the first moments are ignored so a player still steering when they crash does not restart by accident. */
(()=>{
  const deadEl=document.getElementById('dead'),btn=document.getElementById('flyAgain');if(!deadEl||!btn)return;
  let shownAt=0;
  new MutationObserver(()=>{if(deadEl.classList.contains('active')&&!shownAt)shownAt=performance.now();else if(!deadEl.classList.contains('active'))shownAt=0}).observe(deadEl,{attributes:true,attributeFilter:['class']});
  btn.addEventListener('click',()=>{if(state.mode!=='DEAD'||!shownAt||performance.now()-shownAt<450)return;startRun()})
})();
/* GAME LOOP */
/* collision runs against the very blocks that are drawn (so rising obstacles only hurt once they have actually risen) */
function planeCollides(){
  if(state.arena)return false;
  const px=plane.position.x,rx=CONFIG.planeCollisionX*state.hitScaleX,rz=CONFIG.planeCollisionZ,bottom=plane.position.y-CONFIG.planeCollisionY,limit=bottom-CONFIG.collisionForgiveness,spikeW=state.spikeWeight||0;
  for(const ch of chunks){
    if(!ch.ready)continue;
    const cz=ch.sourceZ+state.worldZ;
    if(Math.abs(cz)>CHUNK/2+rz+6||Math.abs(px-ch.centerX)>CHUNK/2+rx+6)continue;
    for(const r of ch.records){
      if(r.h<=limit)continue;
      const oz=cz+r.localZ+r.offsetZ,k=1-spikeW*(1-.8*Math.max(0,1-Math.max(0,bottom)/r.h));   /* cones are narrower than their base at plane height */
      if(Math.abs(oz)>=r.depth*.5*k+rz)continue;
      if(Math.abs(ch.centerX+r.localX+r.offsetX-px)<r.width*.5*k+rx)return true
    }
  }
  return false
}
/* ===== KNIFE-EDGE ROLL: narrower hitbox, airframe integrity, loss of control =====
   Q / E still roll the plane to +-90 deg with the same spring as before. What is new:
   - the turn bank fades out as the wing goes vertical, so bank + roll can no longer stack past ~100 deg
   - a rolled plane collides as a narrower shape, so it can slip through tight gaps
   - steering hard while rolled strains the airframe: integrity drains, a warning shows, then control is lost for a moment
   - easing off lets integrity recover; a loss of control ends in a smooth, self-leveling recovery
   - strain only exists past 60 deg of roll. gusts push as before, and also roll the plane in proportion to its incline: a level plane just gets pushed,
     a banked wing gets caught and rolled (toward the way the gust blows), and a gust while past 60 deg adds strain on its own
   Flying level (or only slightly rolled) is untouched: every multiplier below is exactly 1 / 0 at roll = 0. */
const ROLL={w:2.6,narrow:.58,safeVx:3.6,hardVx:9,drain:.85,regen:.45,regenDelay:.3,lostTime:1.5,recoverTime:.9,lockAfter:.5,slip:.5,steerLost:.15,recoverRegen:.6,
  strainAngle:Math.PI/3,strainRamp:.21,           /* integrity only comes into play past 60 deg of roll (full effect by ~72 deg) */
  gustTorque:7,gustFlat:.12,gustFullAngle:Math.PI/3,gustStrain:.6,rollLimit:2.0};   /* gust: roll torque (rad/s^2) at peak, share of it that reaches a level plane, incline where it is full, extra strain, max roll (~115 deg) */
function resetRollSystem(){
  const s=state;s.roll=0;s.rollV=0;s.integrity=1;s.rollMode='ok';s.rollTimer=0;s.rollLock=0;s.stressHold=0;s.tumble=0;s.tumbleDir=1;s.slipDir=1;
  s.hitScaleX=1;s.wellStrain=0;s.wellWarp=0;s.warnAlpha=0;s.flutter=0;s.ctrlShake=0;s.lossRoll=0;s.warnBeep=0;
  const el=document.getElementById('integrity');if(el)el.style.opacity='0'
}
resetRollSystem();
const integrityEl=document.getElementById('integrity'),integrityFill=document.getElementById('integrityFill'),integrityLabel=document.getElementById('integrityLabel'),integrityIcon=integrityEl.querySelector('svg');
let integrityLabelText='',integrityShown=false;



function updateRollSystem(dt,axis,handling){
  const s=state,R=ROLL,reduced=!!s.reduced;
  /* roll input -> the same critically damped spring as before. Ignored while control is lost and for a moment afterwards. */
  s.rollLock=Math.max(0,s.rollLock-dt);
  const want=(s.apTimer>0?AP.roll:clampN((keys.has('q')?1:0)-(keys.has('e')?1:0)+touchRoll,-1,1))*Math.PI*.5,rollT=(s.rollMode==='ok'&&s.rollLock<=0)?want:0,rd=Math.min(dt,.05);
  const gustN=s.gustEnv||0;let gustTorque=0;
  if(gustN>.001){const x=clampN(Math.abs(s.roll)/R.gustFullAngle,0,1);gustTorque=-(s.gustDir||1)*R.gustTorque*gustN*(R.gustFlat+(1-R.gustFlat)*smooth01(x))}   /* right gust rolls clockwise, same sense as the camera tilt */
  s.rollV+=(R.w*R.w*(rollT-s.roll)-2*R.w*s.rollV+gustTorque)*rd;s.roll+=s.rollV*rd;
  if(s.roll>R.rollLimit){s.roll=R.rollLimit;s.rollV=Math.min(0,s.rollV)}else if(s.roll<-R.rollLimit){s.roll=-R.rollLimit;s.rollV=Math.max(0,s.rollV)}
  const sinR=Math.abs(Math.sin(s.roll)),k=smooth01(sinR);            /* 0 level .. 1 knife-edge */
  /* strain = (hard lateral steering + gust load), and only while rolled past 60 deg. slight turns stay inside the safe band. */
  const vxa=Math.abs(s.vx),demand=smooth01(clampN((vxa-R.safeVx*handling)/((R.hardVx-R.safeVx)*handling),0,1)),stress=s.rollMode==='ok'?smooth01(clampN((Math.abs(s.roll)-R.strainAngle)/R.strainRamp,0,1))*clampN(demand+R.gustStrain*gustN,0,1):0;
  if(s.rollMode==='ok'){
    const wstrain=s.wellStrain||0;
    if(wstrain>.02){s.integrity-=WELL_DRAIN*wstrain*dt;s.stressHold=R.regenDelay}
    if(stress>.02){s.integrity-=R.drain*stress*dt;s.stressHold=R.regenDelay}
    else if(wstrain<=.02){s.stressHold=Math.max(0,s.stressHold-dt);if(s.stressHold<=0)s.integrity=Math.min(1,s.integrity+R.regen*dt)}
    if(s.integrity<=0){s.integrity=0;s.rollMode='lost';s.rollTimer=0;s.tumbleDir=s.roll<0?-1:1;s.slipDir=vxa>.6?Math.sign(s.vx):-s.tumbleDir;s.warnBeep=0;rollLostSound()}
  }else if(s.rollMode==='lost'){
    s.rollTimer+=dt;const u=clampN(s.rollTimer/R.lostTime,0,1);
    s.tumble=s.tumbleDir*Math.PI*2*(u*u*u*(u*(u*6-15)+10));            /* one smooth spiral that eases to a stop exactly level */
    if(u>=1){s.rollMode='recover';s.rollTimer=0;s.tumble=0;s.integrity=.3;rollRecoverSound()}
  }else{
    s.rollTimer+=dt;s.integrity=Math.min(1,s.integrity+R.recoverRegen*dt);
    if(s.rollTimer>=R.recoverTime){s.rollMode='ok';s.rollTimer=0;s.stressHold=0;s.rollLock=R.lockAfter}
  }
  /* control authority + slide toward the way the plane was already going */
  let steer=1,slip=0;
  if(s.rollMode==='lost'){const u=clampN(s.rollTimer/R.lostTime,0,1);steer=lerpN(1,R.steerLost,smooth01(clampN(s.rollTimer/.25,0,1)));slip=s.slipDir*R.slip*Math.sin(Math.PI*u)}
  else if(s.rollMode==='recover')steer=lerpN(R.steerLost,1,smooth01(clampN(s.rollTimer/R.recoverTime,0,1)));
  /* airframe shudder grows as integrity falls, stays high while out of control, fades through the recovery */
  const flutterT=s.rollMode==='lost'?1:s.rollMode==='recover'?clampN(1-s.rollTimer/R.recoverTime,0,1)*.6:Math.pow(clampN((1-s.integrity)/.75,0,1),1.6);
  s.flutter=lerpN(s.flutter,flutterT,clampN(dt*8,0,1));
  const ck=s.clock,wobble=s.flutter*(.07*Math.sin(ck*23)+.04*Math.sin(ck*37+1.3))*(reduced?.35:1);
  s.ctrlShake=reduced?0:lerpN(s.ctrlShake,s.flutter*.05,clampN(dt*10,0,1));
  s.lossRoll=Math.sin(s.tumble)*.09*(reduced?.3:1);
  /* hitbox: a rolled plane is narrower. widens again straight away if control is lost. */
  s.hitScaleX=lerpN(s.hitScaleX,s.rollMode==='ok'?1-(1-R.narrow)*k:1,clampN(dt*14,0,1));
  /* warning symbol */
  const warnT=s.rollMode==='ok'?clampN((.92-s.integrity)/.12,0,1):1;
  s.warnAlpha=lerpN(s.warnAlpha,warnT,clampN(dt*(warnT>s.warnAlpha?9:3.5),0,1));
  if(s.warnAlpha>.004){
    integrityShown=true;
    const t=1-clampN(s.integrity,0,1);
    integrityEl.style.opacity=s.warnAlpha.toFixed(3);integrityEl.style.color=`rgb(255,${Math.round(210-117*t)},${Math.round(122-48*t)})`;
    integrityFill.style.transform=`scaleX(${clampN(s.integrity,0,1).toFixed(3)})`;
    const pulse=Math.sin(ck*lerpN(5,15,t));integrityIcon.style.transform=`scale(${(1+.07*pulse*(.4+t)).toFixed(3)})`;integrityIcon.style.opacity=(.82+.18*pulse).toFixed(3);
    const label=s.rollMode==='lost'?'CONTROL LOST':s.rollMode==='recover'?'RECOVERING':((s.wellStrain||0)>.05?'GRAVITY PULL':'STABILIZE');
    if(label!==integrityLabelText){integrityLabelText=label;integrityLabel.textContent=label}
  }else if(integrityShown){integrityShown=false;integrityEl.style.opacity='0'}
  if(s.rollMode==='ok'&&(stress>.05||(s.wellStrain||0)>.05)&&s.integrity<.8){s.warnBeep-=dt;if(s.warnBeep<=0){rollWarnBlip(1-s.integrity);s.warnBeep=lerpN(.6,.2,clampN(1-s.integrity,0,1))}}else s.warnBeep=0;
  /* bank fades out as the wing goes vertical; yaw grows a little so the nose still leads the turn */
  s.rollSteer=steer;return {steer,slip,bankMul:1-.8*k,yawMul:1+.9*k,extra:s.tumble+wobble};
}
let last=performance.now(),accum=0;function updatePlay(dt){const wd=dt*state.worldScale,keyAxis=(keys.has('arrowleft')||keys.has('a')?-1:0)+(keys.has('arrowright')||keys.has('d')?1:0),axis0=THREE.MathUtils.clamp(keyAxis+touchAxis,-1,1),stats=PLANES[save.equippedPlane],handling=1+(stats.handling-3)*.045,axis=state.tut?state.tut.axis(axis0):(state.apTimer>0?apAxis(dt,handling):axis0);const progress=state.distance/CONFIG.levelMeters,targetSpeed=state.tut?state.tut.speed:(state.arena?Math.min(36,speedAtDistance(state.arenaD0)):speedAtDistance(state.distance));state.speed=THREE.MathUtils.lerp(state.speed,targetSpeed,Math.min(1,wd*1.1));const rollSys=updateRollSystem(dt,axis,handling);state.vx+=(axis*rollSys.steer+rollSys.slip)*CONFIG.turnAccel*handling*dt+(state.extForce||0)*wd;state.vx*=Math.exp(-CONFIG.turnDamping*dt);state.vx=THREE.MathUtils.clamp(state.vx,-CONFIG.maxLateral,CONFIG.maxLateral);state.x+=state.vx*dt;state.bank=THREE.MathUtils.lerp(state.bank,-state.vx*.04,Math.min(1,dt*4.5));state.yaw=THREE.MathUtils.lerp(state.yaw,-state.vx*.014,Math.min(1,dt*3));state.distance+=state.speed*wd;state.worldZ+=state.speed*wd;state.worldClock+=wd;const idx=Math.min(LEVELS.length-1,Math.floor(progress));if(idx!==state.level&&!state.arena&&!state.tut&&(idx<PERP_IDX||state.perpOK||state.level>=PERP_IDX))startLevelTransition(idx);if(state.transition<1)state.transition=Math.min(1,state.transition+wd/CONFIG.transitionSeconds);const diff=Math.max(0,(state.distance-state.levelStart)/CONFIG.levelMeters);plane.position.x=state.x;plane.position.y=CONFIG.baseAltitude+Math.sin(state.distance*.035)*.12+Math.sin(state.distance*.011)*.16;plane.rotation.set(0,state.yaw*rollSys.yawMul,state.bank*rollSys.bankMul+state.roll+rollSys.extra);if(prop1)prop1.rotation.z+=dt*state.speed*2.2;if(prop2)prop2.rotation.z+=dt*state.speed*2.2;if(!state.arena)streamChunks();if(state.shieldTimer<=0&&state.shieldSafety<=0&&planeCollides())burstCrash();else if(state.arena)updateArena(wd);else if(!state.tut){updateMeteorSpawns(wd);updateHazardSpawns(wd)}if(!state.arena){const dm=Math.floor(state.distance);if(dm!==state._dShown){state._dShown=dm;(window._distEl||(window._distEl=document.getElementById('distance'))).textContent=dm.toLocaleString()}}}
function updateHome(dt){state.homeTime+=dt;state.worldZ+=dt*2.1;plane.position.x=Math.sin(state.homeTime*.24)*2.2;state.x=plane.position.x;plane.position.y=3.6+Math.sin(state.homeTime*.8)*.18;plane.rotation.z=Math.sin(state.homeTime*.3)*.04;plane.rotation.y=Math.sin(state.homeTime*.19)*.045;if(prop1)prop1.rotation.z+=dt*14;if(prop2)prop2.rotation.z+=dt*14;streamChunks()}
const lookTarget=new THREE.Vector3();function updateCamera(dt){if(state.mode!=='PLAYING'){const f=Math.exp(-dt*6);state.lossRoll*=f;state.ctrlShake*=f}if(cockpitActive()&&cockpit){cockpitCamera(dt);return}const homeMode=state.mode==='HOME',hangarMode=state.mode==='SHOP',x=hangarMode?0:state.x;const desiredX=hangarMode?0:x,desiredY=hangarMode?4.05:(homeMode?5.2:5.2+Math.abs(state.bank)*.35),desiredZ=hangarMode?2.5:(homeMode?10.8:10.5);camera.position.x=hangarMode?THREE.MathUtils.lerp(camera.position.x,desiredX,Math.min(1,dt*2.4)):x;camera.position.y=THREE.MathUtils.lerp(camera.position.y,desiredY,Math.min(1,dt*3));camera.position.z=THREE.MathUtils.lerp(camera.position.z,desiredZ,Math.min(1,dt*3));lookTarget.set(hangarMode?0:x,hangarMode?2.7:.5,hangarMode?-3:-13);camera.lookAt(lookTarget);if(state.gustRoll)camera.rotateZ(state.gustRoll);if(state.lossRoll)camera.rotateZ(state.lossRoll);if(state.pw>.001)camera.rotateZ(state.pw*(state.reduced?.17:.436)*(.75*Math.sin(state.clock*.55)+.25*Math.sin(state.clock*1.3)));const targetFov=(hangarMode?48:57)+(state.mode==='PLAYING'?Math.min(10,(state.speed-12.4)*.42):0)+(state.mode==='CRASHING'?4:0)+(1-state.worldScale)*5+(state.wellWarpS||0)*(state.reduced?4:15)+(state.pw||0)*(state.reduced?4:14)*Math.sin(state.clock*.9);camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,Math.min(1,dt*2));camera.near=.1;camera.updateProjectionMatrix();skyDome.position.copy(camera.position);ambient.position.x=x;sun.position.set(x-9,19,5);sun.target.position.set(x,0,0);sun.target.updateMatrixWorld();const sh=state.shake+state.rumble+state.ctrlShake;if(sh>0){camera.position.x+=(Math.random()-.5)*sh;camera.position.y+=(Math.random()-.5)*sh*.7}}
function updateAmbient(dt){if(state.mode==='SHOP')return;const a=ambientGeo.attributes.position.array,scale=state.mode==='PLAYING'?state.worldScale:1,step=dt*scale,pt=LEVELS[state.level].particle,tms=performance.now(),ambN=Math.floor(ambientN*FXQ.amb);for(let i=0;i<ambN;i++){let j=i*3;a[j+2]+=((state.mode==='PLAYING'?state.speed:2.1)+ambientSpeeds[i])*(state.mode==='PLAYING'?step:step*.25);a[j+1]+=pt==='snow'?-step*1.2:pt==='rain'?-step*(15+ambientSpeeds[i]*2):pt==='petals'?-step*.7+Math.sin(tms*.0007+i)*step*.35:pt==='embers'?step*(2+ambientSpeeds[i]*.35):Math.sin(tms*.0005+i)*step*.09;if(pt==='sand')a[j]+=step*(13+ambientSpeeds[i]*2);else if(pt==='rain')a[j]-=step*1.5;else if(pt==='petals')a[j]+=step*Math.sin(i)*.9;if(a[j]>29)a[j]-=58;else if(a[j]<-29)a[j]+=58;if(a[j+2]>18){a[j+2]=-145-Math.random()*20;a[j]=(Math.random()-.5)*58;a[j+1]=Math.random()*23-1}if(a[j+1]<-2)a[j+1]=pt==='rain'?23:20;if(a[j+1]>24)a[j+1]=-1.5}ambientGeo.attributes.position.needsUpdate=true;}
const _trailV=new THREE.Vector3();function updateTrails(){plane.updateMatrixWorld(true);for(const t of trailLines){const arr=t.line.geometry.attributes.position.array,anchor=wingWakeAnchors[t.s<0?0:1];for(let i=0;i<30;i++){const q=i/29,p=_trailV.set(anchor[0],anchor[1]+q*.09,anchor[2]+q*(CONFIG.trailLength/Math.max(.01,plane.scale.x)));plane.localToWorld(p);arr[i*3]=p.x;arr[i*3+1]=p.y;arr[i*3+2]=p.z}t.line.geometry.attributes.position.needsUpdate=true;trailMat.opacity=state.mode==='PLAYING'?Math.min(.58,.2+state.speed*.018):.14}}
const _fFwd=new THREE.Vector3(),_fN=new THREE.Vector3(),_qFlame=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),_moonOff=new THREE.Vector3(-19,15,-76);
function updateFlames(dt){const flying=state.mode==='PLAYING'||state.mode==='CUT1'||state.mode==='CUT2',throttle=flying?.3+.7*clampN((state.speed-CONFIG.baseSpeed)/(CONFIG.maxSpeed-CONFIG.baseSpeed),0,1):0,idle=state.mode==='HOME'?.17:state.mode==='SHOP'?.1:0,now=performance.now()*.001;for(const f of jetFlames){const flick=1+Math.sin(now*23+f.base*19)*.105+Math.sin(now*47+f.base*7)*.045,power=idle+throttle*(f.kind==='outer'?.95:.78),len=f.base*power*flick,width=(f.kind==='outer'?.58:.76)*flick;f.mesh.scale.set(width,Math.max(.001,len),width);f.mesh.position.z=.02+(f.kind==='outer'?.46:.265)*len;f.mesh.material.opacity=(f.kind==='outer'?.66:.9)*power}/* plane.matrixWorld is already fresh: updateTrails() runs right before this and calls plane.updateMatrixWorld(true) */_fFwd.set(0,0,1).transformDirection(plane.matrixWorld);for(const item of jetWakeMeshes){const {mesh,emitter,index}=item;if(!flying||!throttle){mesh.visible=false;continue}const nozzle=_fN.copy(emitter).applyMatrix4(plane.matrixWorld),fade=1-index/12,dist=.24+index*.24,sway=Math.sin(now*19+index*1.7)*.035*fade;mesh.position.copy(nozzle).addScaledVector(_fFwd,dist);mesh.position.x+=Math.cos(now*11+index)*sway;mesh.position.y+=Math.sin(now*13+index*.8)*sway;mesh.quaternion.copy(plane.quaternion).multiply(_qFlame);mesh.scale.set(.7*fade,fade,.7*fade);mesh.material.opacity=throttle*.46*fade;mesh.visible=mesh.material.opacity>.018}}
const wellFxEl=document.getElementById('wellFx'),wellV=new THREE.Vector3(),wellV2=new THREE.Vector3();let wellFxOn=false;
function applyWellWarp(dt){
  const tgt=state.mode==='PLAYING'?(state.wellWarp||0):0,cur=state.wellWarpS||0;
  state.wellWarpS=cur+(tgt-cur)*clampN(dt*(tgt>cur?6:3),0,1);const w=state.wellWarpS,cv=renderer.domElement;
  if(w<.003){if(wellFxOn){wellFxOn=false;cv.style.transform='';cv.style.transformOrigin='';wellFxEl.style.opacity='0'}return}
  const first=!wellFxOn;wellFxOn=true;const r=state.wellRef||state.wellLast;if(r)state.wellLast=r;
  let sx=50,sy=50;
  if(r){camera.updateMatrixWorld();wellV.set(r.x,r.y,r.zs+state.worldZ);wellV2.copy(wellV).applyMatrix4(camera.matrixWorldInverse);
    if(wellV2.z<-.5){wellV.project(camera);sx=(wellV.x*.5+.5)*100;sy=(-wellV.y*.5+.5)*100}else{sx=r.x>plane.position.x?130:-30;sy=55}}
  /* FIX: the origin used to be allowed far off-screen (-30%..130%) and snapped between values (well behind camera, well switching, well fading out).
     Scaling/rotating the canvas around an off-screen origin slides its edge into view, so the page background showed through as a blue flick.
     Now the origin stays well inside the screen and eases toward its target, so the canvas always overscans the viewport. */
  sx=clampN(sx,15,85);sy=clampN(sy,15,85);
  if(first||state.wellOX===undefined){state.wellOX=sx;state.wellOY=sy}else{const k=clampN(dt*8,0,1);state.wellOX+=(sx-state.wellOX)*k;state.wellOY+=(sy-state.wellOY)*k}
  sx=state.wellOX;sy=state.wellOY;const red=state.reduced?.35:1;
  cv.style.transformOrigin=sx.toFixed(1)+'% '+sy.toFixed(1)+'%';
  cv.style.transform='scale('+(1+.34*w*red).toFixed(4)+') rotate('+(w*4.5*red*Math.sin(state.clock*.9+1)).toFixed(3)+'deg)';
  wellFxEl.style.setProperty('--wx',sx.toFixed(1)+'%');wellFxEl.style.setProperty('--wy',sy.toFixed(1)+'%');wellFxEl.style.setProperty('--wa',((state.clock*40)%360).toFixed(1)+'deg');wellFxEl.style.opacity=clampN(w*1.1,0,1).toFixed(3)
}
function frame(now){requestAnimationFrame(frame);const raw=Math.min(.05,(now-last)/1000);last=now;const dt=raw;accum+=dt;
 if(state.mode!=='PAUSED')state.clock+=dt;if(state.mode==='HOME')updateHome(dt);if(state.mode==='SHOP'){state.homeTime+=dt;plane.rotation.y+=dt*.22;plane.position.y=3.05+Math.sin(state.homeTime*1.1)*.12;const shopTx=state.shopTab==='abilities'&&innerWidth>900?-1.5:0;plane.position.x+=(shopTx-plane.position.x)*Math.min(1,dt*4);shieldBubble.visible=state.shopTab==='abilities';if(shieldBubble.visible){shieldBubble.position.copy(plane.position);shieldBubble.scale.setScalar(.42);shieldBubble.rotation.y=state.homeTime*.28;shieldBubble.material.uniforms.uAlpha.value=save.abilities.shield?.34:.2}if(state.hangarPulse>0)state.hangarPulse=Math.max(0,state.hangarPulse-dt);for(const m of planeParts)if(m.material?.emissive){m.material.emissive.setRGB(1,.78,.58);m.material.emissiveIntensity=state.hangarPulse*1.1}}if(state.mode==='PLAYING'){updateAbilities(dt);updatePlay(dt);if(state.tut&&state.mode==='PLAYING')state.tut.update(dt)}if(state.mode==='PLAYING'&&!state.gatePassed&&state.distance>=GATE_D){state.gatePassed=true;startCut1()}if(state.mode==='CRASHING'||state.mode==='DEAD')updateCrash(dt);if(state.mode==='PLAYING'||state.mode==='CRASHING')updateRisers();if(state.mode==='PLAYING')updateDynamics(dt*state.worldScale);if(state.terrainAnim)updateTerrain();if(state.mode==='PLAYING'||state.mode==='CRASHING'||state.mode==='DEAD')updateMeteors(dt*(state.mode==='PLAYING'?state.worldScale:1),state.mode==='PLAYING');if(state.mode!=='SHOP')pumpBuildQueue();blendVisuals(dt);updatePerplexityFx(dt);updateAmbient(dt);updateTrails();updateFlames(dt);ckFrame(dt);updateCamera(dt);updateAudio();const mT=state.transition,mFrom=LEVELS[state.fromLevel],mTo=LEVELS[state.toLevel],mw=(mFrom.moon?1-mT:0)+(mTo.moon?mT:0),cw=(mFrom.corona?1-mT:0)+(mTo.corona?mT:0),mcol=mTo.moon||mFrom.moon;if(mcol)moonMat.color.set(mcol);moonMat.opacity=Math.min(1,mw);moon.position.copy(camera.position).add(_moonOff);corona.position.copy(moon.position);corona.lookAt(camera.position);corona.visible=moon.visible&&cw>.01;coronaMatA.opacity=Math.min(1,cw)*.75;coronaMatB.opacity=Math.min(1,cw)*.2;updateCinematics(dt);if(state.mode!=='PAUSED')updateFx(dt*(state.mode==='PLAYING'?state.worldScale:1));applyWellWarp(dt);shieldBubble.material.uniforms.uTime.value=performance.now()*.001;adaptRes(raw);renderer.render(scene,camera);}
/* ADAPTIVE QUALITY v2.
   Old scaler: DPR only went UP when frame time < 13.5 ms, which a 60 Hz screen can never reach (it is locked to ~16.7), so after any dip it never recovered, and it
   changed the pixel ratio in 0.1 steps (every setSize reallocates the canvas = a hitch). Now:
   - one ladder of "degrade levels" (_lv): 1 = cheaper particles, then step the pixel ratio down through DPR_STEPS, last rung = shadows off (one way, it recompiles shaders)
   - going down needs ~1.2 s of slow frames; going up needs ~6 s of headroom WHILE PLAYING, and every climb is a probe: if it turns slow within 5 s we step back down
     and lock that level out for 30 s (doubling each failed probe, max 2 min), so it can't oscillate
   - only HOME / SHOP / PLAYING frames count (crash hit-stop, cutscenes and the boot warm-up are ignored)
   - the target is a fixed 60 fps (_vs = 16.7 ms), so 120 Hz screens are not pushed to chase 120 and a GPU-bound 30 fps device can't be mistaken for a 30 Hz screen
   Inspect it live from the console with __perf(). */
const DPR_STEPS=(()=>{const s=[.85,1,1.25,1.5,1.75,2].filter(v=>v<PERF.maxDpr-.01);s.push(PERF.maxDpr);return s})();
const DPR_START=(()=>{let k=0;for(let i=0;i<DPR_STEPS.length;i++)if(DPR_STEPS[i]<=PERF.startDpr+.01)k=i;return k})();
let _lv=0,_ema=16.7,_vs=16.7,_slowT=0,_fastT=0,_cool=3,_probe=0,_lockDur=30,_skipT=2,_shadowOff=false,_clk=0;const _lock={};
const _lvMin=()=>-(DPR_STEPS.length-1-DPR_START),_lvMax=()=>1+DPR_START+(PERF.shadows&&!_shadowOff?1:0);
const _dprFor=lv=>DPR_STEPS[Math.max(0,Math.min(DPR_STEPS.length-1,lv<=0?DPR_START-lv:DPR_START-(lv-1)))];
function applyQuality(){
  const d=_dprFor(_lv),cheap=_lv>=1;
  FXQ.amb=cheap?.6:1;FXQ.cap=cheap?.6:1;ambientGeo.setDrawRange(0,Math.floor(ambientN*FXQ.amb));
  if(Math.abs(d-curDpr)>.01){curDpr=d;renderer.setPixelRatio(curDpr);renderer.setSize(innerWidth,innerHeight)}
  if(!_shadowOff&&PERF.shadows&&_lv>=2+DPR_START){_shadowOff=true;renderer.shadowMap.enabled=false;sun.castShadow=false;_lv=Math.min(_lv,_lvMax())}
}
function adaptRes(dt){
  if(state.mode==='PAUSED'||document.hidden){_slowT=_fastT=0;return}
  _clk+=dt;if(_skipT>0){_skipT-=dt;return}
  const mode=state.mode;if(mode!=='PLAYING'&&mode!=='HOME'&&mode!=='SHOP'){_slowT=_fastT=0;return}
  const ms=dt*1000;
  _ema+=(Math.min(ms,_vs*3)-_ema)*.06;_cool-=dt;if(_probe>0){_probe-=dt;if(_probe<=0)_lockDur=30}
  _slowT=_ema>_vs*1.45?_slowT+dt:Math.max(0,_slowT-dt*2);_fastT=(_ema<_vs*1.1&&mode==='PLAYING')?_fastT+dt:0;
  if(_slowT>(_probe>0?.5:1.2)&&_cool<=0&&_lv<_lvMax()){
    if(_probe>0){_lock[_lv]=_clk+_lockDur;_lockDur=Math.min(120,_lockDur*2)}
    _lv++;_cool=2.5;_slowT=_fastT=0;_probe=0;_ema=_vs;applyQuality()
  }else if(_fastT>6&&_cool<=0&&_lv>_lvMin()&&(_lock[_lv-1]||0)<=_clk){
    _lv--;_cool=4;_slowT=_fastT=0;_probe=5;_ema=_vs;applyQuality()
  }
}
window.__perf=()=>({level:_lv,dpr:curDpr,steps:DPR_STEPS,frameMs:+_ema.toFixed(1),budgetMs:+_vs.toFixed(1),particles:{ambient:FXQ.amb,fx:FXQ.cap},shadowsDroppedForSession:_shadowOff,locks:{..._lock},now:+_clk.toFixed(1)});
/* compile every hazard shader once at boot (behind the home screen) so none of them compiles mid-run. waits if a run is already going. */
setTimeout(function warm(){if(state.mode==='PLAYING'||state.mode==='CRASHING'){setTimeout(warm,2000);return}warmUpHazards();_skipT=3;_ema=_vs},400);
requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(curDpr);renderer.setSize(innerWidth,innerHeight)});

/* ---------- TUTORIAL ---------- */
(()=>{
const el=document.getElementById('tutorial'),body=document.getElementById('tutBody'),dots=document.getElementById('tutDots'),count=document.getElementById('tutCount'),nextB=document.getElementById('tutNext'),backB=document.getElementById('tutBack'),skipB=document.getElementById('tutSkip'),closeB=document.getElementById('tutClose'),helpB=document.getElementById('homeHelp');
if(!el||!body)return;
const touch=(()=>{try{return matchMedia('(pointer: coarse)').matches}catch{return false}})();
const k=(...c)=>c.map(x=>`<kbd class="k">${x}</kbd>`).join('');
const row=(label,caps)=>`<div class="tut-row"><span class="lbl">${label}</span><span class="caps">${caps}</span></div>`;
const plane=(x,y,cls='')=>`<g class="${cls}" transform="translate(${x} ${y})"><path d="M0 -13 L3 -3 L16 4 L16 8 L3 5 L2 12 L6 15 L6 17 L0 16 L-6 17 L-6 15 L-2 12 L-3 5 L-16 8 L-16 4 L-3 -3 Z" fill="currentColor"/></g>`;
const STEPS=[
 {t:'Steer left and right',
  p:'Your plane flies forward on its own. Slide sideways to line up with the open sky.',
  art:`<svg viewBox="0 0 240 128" aria-hidden="true"><path class="acc soft" d="M30 100H210" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round"/><g class="tut-drift">${plane(120,64)}</g><path class="acc" d="M52 64 40 64M52 64l6-6M52 64l6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path class="acc" d="M188 64h12M188 64l-6-6M188 64l-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  keys:touch?row('TOUCH','<span>hold left / right side</span>'):row('KEYBOARD',k('A','D')+'<span style="opacity:.5;align-self:center">or</span>'+k('←','→'))},
 {t:'Dodge what rises',
  p:'<b>Towers and spikes</b> grow out of the ground ahead. Find the gaps and fly through. Touching one ends the flight.',
  art:`<svg viewBox="0 0 240 128" aria-hidden="true"><g fill="currentColor" class="soft"><rect x="20" y="58" width="44" height="70" rx="2"/><rect x="176" y="40" width="44" height="88" rx="2"/><rect x="86" y="92" width="26" height="36" rx="2"/></g><path class="fillacc" d="M124 128l11-34 11 34z"/><g class="tut-bob">${plane(140,38)}</g><path class="acc" d="M150 66l0 12" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6" opacity=".7"/></svg>`,
  keys:''},
 {t:'Roll through tight gaps',
  p:'Some gaps are too narrow to fit through flat. <b>Roll onto a wing</b> to slim down and slip past.',
  art:`<svg viewBox="0 0 240 128" aria-hidden="true"><g fill="currentColor" class="soft"><rect x="40" y="0" width="52" height="128" rx="2"/><rect x="148" y="0" width="52" height="128" rx="2"/></g><g class="tut-roll">${plane(120,64)}</g></svg>`,
  keys:(touch?row('ROLL','<span>touch with two fingers</span>'):row('ROLL LEFT / RIGHT',k('Q','E')))+row('AUTOPILOT','<span>rolls for you</span>')},
 {t:'Go a little farther',
  p:`Every meter earns <b>credits</b>, even when you crash. The world changes every <b>${(typeof CONFIG!=='undefined'?CONFIG.levelMeters:850).toLocaleString()} m</b>, so each new place is a milestone worth chasing.`,
  art:`<svg viewBox="0 0 240 128" aria-hidden="true"><path class="acc soft" d="M20 100C70 100 90 84 120 70S190 40 220 30" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round"/><g fill="currentColor"><circle cx="20" cy="100" r="4"/><circle class="tut-pulse" cx="120" cy="70" r="4"/><circle class="tut-pulse" cx="220" cy="30" r="4"/></g><g font-family="Manrope,sans-serif" font-size="9" font-weight="700" letter-spacing="1.6" fill="currentColor" opacity=".7"><text x="20" y="118" text-anchor="middle">0 M</text><text x="120" y="92" text-anchor="middle">850</text><text x="214" y="52" text-anchor="middle">1,700</text></g></svg>`,
  keys:''},
 {t:'Abilities and the shop',
  p:'Spend credits in the <b>Shop</b> to unlock abilities and new aircraft. Once unlocked, trigger abilities mid-flight. They recharge between uses.',
  art:`<svg viewBox="0 0 240 128" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><g transform="translate(40 34)"><circle cx="30" cy="30" r="30" opacity=".25"/><path d="M30 12l15 8.5v17L30 46l-15-8.5v-17z"/></g><g transform="translate(90 34)"><circle cx="30" cy="30" r="30" opacity=".25"/><circle cx="30" cy="30" r="14"/><path d="M30 21v10l6 4"/></g><g transform="translate(140 34)"><circle cx="30" cy="30" r="30" opacity=".25"/><path d="M30 13c1.5 0 2.4 1.4 2.4 3.3V25l12 7.3v3.4l-12-3.4v6l3.2 2.6v2.7L30 45l-5.6 1.8v-2.7l3.2-2.6v-6l-12 3.4v-3.4l12-7.3v-8.7c0-1.9.9-3.3 2.4-3.3z"/></g></g></svg>`,
  keys:touch?row('ABILITIES','<span>tap the buttons at the bottom</span>')+row('VIEW','<span>tap the view button</span>'):row('SHIELD',k('Z'))+row('SLOW-MO',k('X'))+row('AUTOPILOT',k('V'))+row('CHASE / COCKPIT VIEW',k('C'))}
];
let i=0,opener=null;
const build=()=>{dots.innerHTML=STEPS.map(()=>'<i></i>').join('')};build();
function render(animate){const s=STEPS[i];body.innerHTML=`<div class="tut-art">${s.art}</div><h2 id="tutTitle" class="tut-title">${s.t}</h2><p class="tut-text">${s.p}</p>${s.keys?`<div class="tut-keys">${s.keys}</div>`:''}`;
 if(animate){body.classList.remove('in');void body.offsetWidth;body.classList.add('in')}
 count.textContent=`${i+1} / ${STEPS.length}`;[...dots.children].forEach((d,n)=>d.classList.toggle('on',n===i));
 backB.hidden=i===0;const last=i===STEPS.length-1;nextB.textContent=last?'GOT IT':'NEXT';skipB.textContent=last?'REPLAY TUTORIAL FLIGHT':'SKIP TUTORIAL'}
function open(){if(el.classList.contains('active'))return;if(typeof state!=='undefined'&&state.mode!=='HOME')return;opener=document.activeElement;i=0;render(false);el.classList.add('active');el.setAttribute('aria-hidden','false');setTimeout(()=>nextB.focus({preventScroll:true}),60)}
function close(){if(!el.classList.contains('active'))return;el.classList.remove('active');el.setAttribute('aria-hidden','true');if(opener&&opener.focus&&opener!==document.body)opener.focus({preventScroll:true});else document.getElementById('play')?.focus({preventScroll:true});opener=null}
function go(d){const n=i+d;if(n<0)return;if(n>=STEPS.length){close();return}i=n;render(true)}
nextB.addEventListener('click',()=>go(1));backB.addEventListener('click',()=>go(-1));skipB.addEventListener('click',()=>{const last=i===STEPS.length-1;close();if(last)setTimeout(()=>window.farflightTutorial&&window.farflightTutorial.replay(),200)});closeB.addEventListener('click',close);
el.addEventListener('pointerdown',e=>{if(e.target===el)close()});
if(helpB)helpB.addEventListener('click',open);
window.addEventListener('keydown',e=>{
 if(el.classList.contains('active')){
  if(e.key==='Escape'){e.preventDefault();close();return}
  if(e.key==='ArrowRight'){e.preventDefault();go(1);return}
  if(e.key==='ArrowLeft'){e.preventDefault();go(-1);return}
  if((e.key==='Enter'||e.key===' ')&&!e.target.closest?.('button')){e.preventDefault();go(1)}
  return}
 /* shop: arrow keys scroll the abilities list (the global handler swallows them) */
 if(typeof state!=='undefined'&&state.mode==='SHOP'&&state.shopTab==='abilities'&&(e.key==='ArrowDown'||e.key==='ArrowUp')){const pn=document.querySelector('.hangar-panel');if(pn)pn.scrollBy({top:e.key==='ArrowDown'?90:-90,behavior:'smooth'})}
});
})();

/* ---------- INTERACTIVE TUTORIAL FLIGHT ----------
   First visit: a short welcome -> the plane flies and you steer from the first second -> two beats that only move on once you have done them:
   1) a block ahead: steer around it, 2) a narrow gap: roll through it. Then you drop straight into your first real flight.
   After your first real crash you are sent home and shown the hangar, abilities, statistics and achievements once (see the post-crash tour at the bottom).
   Checkpoints are close to each obstacle; after 1 crash on the block you get a steering nudge, after 2 the obstacle is removed. */
(()=>{
const FLAG='farflight-tutorial-v2',$=id=>document.getElementById(id);
const welcomeEl=$('welcome'),coach=$('coach'),coachCard=$('coachCard'),cTag=$('coachTag'),cTitle=$('coachTitle'),cText=$('coachText'),cKeys=$('coachKeys'),cNext=$('coachNext'),cSkip=$('coachSkip'),ring=$('coachRing'),skipFlight=$('tutSkipFlight'),fadeEl=$('tutFade'),welcomeSkip=$('welcomeSkip'),arrowsEl=$('tutArrows'),markEl=$('tutMark'),markTxt=$('tutMarkTxt');
if(!welcomeEl||!coach)return;
const root=document.documentElement,touch=(()=>{try{return matchMedia('(pointer: coarse)').matches}catch{return false}})();
const markSeen=()=>{try{localStorage.setItem(FLAG,'1')}catch{}};
const cap=(label,key)=>`<kbd class="k" data-k="${key}">${label}</kbd>`;
const pill=t=>`<span class="coach-pill">${t}</span>`;
let capEls=[];
let ringSel=null,ringFit=null,ringRaf=0,fitSig='';
function ringLoop(){
  if(!ringSel){ringRaf=0;return}
  let r=null;
  if(ringFit)r=ringFit.rect();else{const t=document.querySelector(ringSel);if(t)r=t.getBoundingClientRect()}
  if(r&&r.width>0&&r.height>0){ring.style.left=(r.left-6)+'px';ring.style.top=(r.top-6)+'px';ring.style.width=(r.width+12)+'px';ring.style.height=(r.height+12)+'px';ring.classList.add('show');if(ringFit)fitCoach()}else ring.classList.remove('show');
  ringRaf=requestAnimationFrame(ringLoop)
}
function setRing(sel,fit){ringSel=sel||null;ringFit=fit||null;fitSig='';if(!ringSel){ring.classList.remove('show');return}if(!ringRaf)ringLoop()}

/* ---- fit steps: the abilities step and the settings-slider step ----
   Their card is placed beside the highlighted panel (below, above or to the side, whichever has room on this screen) so it never sits on top of
   the panel or its red outline. On the settings step the panel itself is also shrunk or moved when the screen is too small for both. */
const qs=s=>document.querySelector(s);
const clampPx=(v,a,b)=>Math.max(a,Math.min(b,v));
const mkRect=(l,t,r,b)=>({left:l,top:t,right:r,bottom:b,width:r-l,height:b-t});
const panelRect=sel=>{const e=qs(sel);return e?e.getBoundingClientRect():null};
/* one rectangle: from just above the MUSIC label down to just above the RESET DISPLAY button */
function sliderRect(){
  const row=qs('#musicVolume')&&qs('#musicVolume').closest('.volume-row'),reset=qs('#displayReset');
  if(!row||!reset)return null;
  const a=row.getBoundingClientRect(),b=reset.getBoundingClientRect();
  return mkRect(a.left,a.top-3,a.right,b.top-14)   /* the ring adds 6px on every side: ends up 9px above MUSIC and 8px above RESET DISPLAY */
}
const FIT={
  abilities:{rect:()=>panelRect('.hangar-panel'),avoid:()=>panelRect('.hangar-panel'),order:['below','above','left','right'],valign:'bottom',lift:70,liftAbove:28,   /* keep clear of the ABILITY PREVIEW label */
    sig:r=>[r.left,r.top,r.width,r.height].map(Math.round).join(',')},
  settings:{rect:sliderRect,avoid:()=>panelRect('#settings .settings-panel'),order:['right','left','below','above'],valign:'center',squeeze:true,
    sig:()=>{const p=qs('#settings .settings-panel');return p?p.offsetWidth+','+p.offsetHeight:''}}
};
function coachHeight(w){coach.style.width=Math.round(w)+'px';return coach.offsetHeight}
function tryPlacements(f,order,W,H){
  const M=10,G=12,rr=f.rect(),av=f.avoid();
  if(!rr||!av)return null;
  const topEdge=Math.min(av.top,rr.top-6),botEdge=Math.max(av.bottom,rr.bottom+6),leftEdge=Math.min(av.left,rr.left-6),rightEdge=Math.max(av.right,rr.right+6);
  const wMax=Math.min(380,W-2*M),minW=(W<=600||H<=700)?176:240,cx=(av.left+av.right)/2,cy=(rr.top+rr.bottom)/2;
  for(const side of order){
    if(side==='below'||side==='above'){
      const h=coachHeight(wMax),left=clampPx(cx-wMax/2,M,W-M-wMax);
      if(side==='below'&&H-botEdge>=h+G+M)return{left,top:botEdge+G,w:wMax};
      const la=f.liftAbove||0;if(side==='above'&&topEdge>=h+G+M+la)return{left,top:topEdge-G-h-la,w:wMax}
    }else{
      const room=side==='right'?W-rightEdge-G-M:leftEdge-G-M,w=Math.min(wMax,room);
      if(w<minW)continue;
      const h=coachHeight(w);if(h>H-2*M)continue;
      const top=f.valign==='bottom'?clampPx(botEdge-h-(f.lift||0),M,H-h-M):clampPx(cy-h/2,M,H-h-M);
      return{left:side==='right'?rightEdge+G:leftEdge-G-w,top,w}
    }
  }
  return null
}
/* settings step: try full size first, then pin the panel to the bottom/top and shrink it a little, until the card fits next to it */
function settingsLayout(al,s){
  const p=qs('#settings .settings-panel'),scr=qs('#settings');if(!p||!scr)return;
  p.style.transform=s<1?'scale('+s+')':'';p.style.transformOrigin=al==='bottom'?'50% 100%':al==='top'?'50% 0':al==='left'?'0 50%':'50% 50%';
  scr.style.alignItems=al==='bottom'?'flex-end':al==='top'?'flex-start':'';scr.style.paddingBottom=al==='bottom'?'10px':'';scr.style.paddingTop=al==='top'?'10px':'';
  scr.style.justifyContent=al==='left'?'flex-start':'';scr.style.paddingLeft=al==='left'?'10px':''
}
let settingsDown=false,settingsPending=null;
function settingsLayoutReset(){
  const run=()=>{document.body.classList.remove('tour-fit');settingsLayout('center',1)};
  if(settingsDown)settingsPending=run;else run()
}
function squeezeSettings(f,W,H){
  const by={center:['right','left','below','above'],left:['right'],bottom:['above'],top:['below']};
  for(const s of [1,.9,.8,.7])for(const al of ['center','left','bottom','top']){
    settingsLayout(al,s);
    const pr=panelRect('#settings .settings-panel');                      /* the panel itself must stay fully on screen */
    if(!pr||pr.top<-.5||pr.left<-.5||pr.bottom>H+.5||pr.right>W+.5)continue;
    const pos=tryPlacements(f,by[al],W,H);if(pos)return pos
  }
  settingsLayout('center',.7);return null
}
function fitCoach(){
  const f=ringFit;if(!f)return;
  const rr=f.rect();if(!rr)return;
  const W=innerWidth,H=innerHeight,sig=W+'x'+H+'|'+f.sig(rr);
  if(sig===fitSig)return;fitSig=sig;
  coach.classList.toggle('compact',W<=600||H<=700);
  let pos=f.squeeze?squeezeSettings(f,W,H):tryPlacements(f,f.order,W,H);
  if(!pos){const w=Math.min(380,W-20),h=coachHeight(w);pos={left:(W-w)/2,top:H-h-10,w}}   /* nothing fits: sit at the bottom edge, card is opaque so the outline never shows through */
  coach.style.left=Math.round(pos.left)+'px';coach.style.top=Math.round(pos.top)+'px';coach.style.width=Math.round(pos.w)+'px'
}
/* if a slider drag is what moved the tour on, wait until the finger lifts before putting the panel back, so the slider does not jump under it */
const settingsScreen=document.getElementById('settings');
if(settingsScreen)settingsScreen.addEventListener('pointerdown',e=>{if(e.target.matches&&e.target.matches('input[type=range]'))settingsDown=true},true);
const settingsUp=()=>{settingsDown=false;if(settingsPending){const f=settingsPending;settingsPending=null;f()}};
window.addEventListener('pointerup',settingsUp);window.addEventListener('pointercancel',settingsUp);

/* ---- coach card ---- */
function coachShow(o){
  coach.classList.remove('ok');coach.classList.toggle('bottom',o.pos==='bottom');coach.classList.toggle('shop',!!o.shop);coach.classList.toggle('big',!o.pos);
  coach.classList.toggle('fit',!!o.fit);if(!o.fit){coach.classList.remove('compact');coach.style.left=coach.style.top=coach.style.width=''}
  cTag.textContent=o.tag||'';cTitle.textContent=o.title||'';cText.innerHTML=o.text||'';
  cKeys.innerHTML=o.keys||'';cKeys.hidden=!o.keys;capEls=[...cKeys.querySelectorAll('kbd[data-k]')];
  cNext.hidden=!o.next;if(o.next)cNext.textContent=o.next;
  cSkip.hidden=!o.skip;
  coachCard.classList.remove('pop');void coachCard.offsetWidth;coachCard.classList.add('pop');
  coach.classList.add('show')
}
function coachHide(){coach.classList.remove('show');setRing(null);arrowsEl.classList.remove('show');markEl.classList.remove('show')}
function coachOk(label){coach.classList.add('ok');cTitle.textContent='✓ '+label;try{rollRecoverSound()}catch{}}
function fade(to,sec){fadeEl.style.transition=`opacity ${sec}s ease`;fadeEl.style.opacity=String(to)}

/* ---- the scripted course ---- */
const E={w:2.12,d:2.12,ox:0,oz:0,fm:1,riser:false},E_L={...E,ox:-1.16},E_R={...E,ox:1.16};   /* slit: 2.2 m wide - a level plane (2.3 m) cannot fit, a rolled one (1.3 m) can */
/* obstacle rows are D and D+2 (odd D). far apart on purpose: room to read, think and line up */
const COURSE=[
  {id:'b1',kind:'block',D:111},
  {id:'r1',kind:'slit',D:291}
];
const mv=new THREE.Vector3();
function solidAt(it,x){
  switch(it.kind){
    case 'wallR':return x<=1?E:null;            /* open on the right */
    case 'wallL':return x>=-1?E:null;           /* open on the left */
    case 'block':return (x===-1||x===1)?E:null;
    case 'slit':return x===-1?E_L:x===1?E_R:E;
    default:return E
  }
}
function isClear(it,x){return it.kind==='wallR'?x>=3.8:it.kind==='wallL'?x<=-3.8:Math.abs(x)>=4.2}
function makeRun(){
  const T={speed:CONFIG.baseSpeed,id:'',stage:0,scale:1,cp:20,lock:false,timer:0,idle:0,done:false,next:null,delay:0,flag:false,fails:0,cleared:{},closing:false,origAbilities:null,granted:false,opts:null};
  T.order=[...COURSE.map(c=>c.id),'finish'];
  T.entry=(ix,iz)=>{
    const D=19-2*iz,x=-19+2*ix;
    for(const it of COURSE){
      if(D!==it.D&&D!==it.D+2)continue;
      if(T.cleared[it.id]||Math.abs(x)>21)return null;
      return solidAt(it,x)
    }
    return null
  };
  T.axis=a=>T.lock?0:T.assist!==null&&T.assist!==undefined?Math.max(-1,Math.min(1,(T.assist-state.x)*.9-state.vx*.35)):a;
  T.update=dt=>tick(T,dt);
  T.respawn=()=>respawn(T);
  return T
}
const show=(T,o)=>{T.opts=o;coachShow(o)};
const kSteerR=()=>touch?pill('HOLD RIGHT SIDE'):cap('D','d')+cap('→','arrowright');
const kSteerL=()=>touch?pill('HOLD LEFT SIDE'):cap('←','arrowleft')+cap('A','a');
const STAGE_UI={
  b1:()=>({tag:'STEERING',title:'Go around it',text:touch?'Press and hold the left or right side of the screen to steer around the block.':'Steer around the block. Either side works.',keys:touch?pill('HOLD LEFT OR RIGHT SIDE'):cap('←','arrowleft')+cap('A','a')+'<span class="coach-or">or</span>'+cap('D','d')+cap('→','arrowright')}),
  r1:()=>({tag:'ROLL',title:'Too narrow to fit flat',text:touch?'Touch the screen with two fingers to roll onto a wing, then slip through.':'Roll onto a wing, then slip through the gap.',keys:touch?pill('TWO FINGERS'):cap('Q','q')+cap('E','e')})
};
function enter(T,id){
  T.id=id;T.stage=T.order.indexOf(id);T.done=false;T.timer=0;T.idle=0;T.lock=false;T.flag=false;T.fails=0;T.scale=.6;T.assist=null;
  const it=COURSE.find(c=>c.id===id);
  if(it){
    T.cp=Math.max(20,it.D-55);
    if(it.kind==='slit')T.assist=0;
    show(T,STAGE_UI[id]())
  }
  else if(id==='finish'){
    T.scale=.5;setRing('#viewBtn');
    show(T,{tag:'WELL FLOWN',title:'Nicely flown',text:touch?'Starting your first real flight. Tip: tap the view button anytime to change camera.':'Starting your first real flight. Tip: press C anytime to change camera.',pos:'top'})
  }
}
function complete(T,label){if(T.done)return;T.done=true;T.fails=0;coachOk(label);if(T.id==='cam')setRing(null);arrowsEl.className='tut-arrows';markEl.classList.remove('show');T.delay=1.1;T.next=T.order[T.stage+1]}
function placeMark(rowD,text,on){
  if(!on){markEl.classList.remove('show');return}
  mv.set(0,11,state.worldZ-(rowD+1));mv.project(camera);
  if(mv.z>1||mv.z<-1){markEl.classList.remove('show');return}
  markTxt.textContent=text;
  markEl.style.left=((mv.x*.5+.5)*innerWidth)+'px';markEl.style.top=Math.max(innerHeight*.3,(-mv.y*.5+.5)*innerHeight)+'px';
  markEl.classList.add('show')
}
const MARK={wallR:'WALL',wallL:'WALL',block:'BLOCK',slit:'GAP',wall:'WALL'};
function tick(T,dt){
  const D=state.distance;
  if(Math.abs(state.x)>14){state.x=Math.sign(state.x)*14;state.vx=0}
  for(const c of capEls)c.classList.toggle('down',keys.has(c.dataset.k));
  if(T.delay>0){T.delay-=dt;if(T.delay<=0&&T.next){const n=T.next;T.next=null;enter(T,n)}}
  let scale=T.scale,waiting=false;
  const it=COURSE.find(c=>c.id===T.id);
  if(!T.done&&!T.closing){
    if(it){
      const slowFrom=it.D-30,hold=it.D-12,commit=it.D-3.5;
      let ok=false;
      if(it.kind==='slit'){
        const r=Math.abs(state.roll);
        if(!T.flag){if(r>1.35){T.flag=true;cTitle.textContent='Hold it. Go.'}}
        else if(r<.9&&D<commit){T.flag=false;cTitle.textContent=STAGE_UI[it.id]().title}
        ok=T.flag
      }else if(it.kind==='wall'){
        T.flag=state.shieldTimer>0;
        if(!T.flag)state.shieldCooldown=0;
        ok=T.flag
      }else ok=isClear(it,state.x);
      if(T.cleared[it.id])ok=true;
      scale=1;if(D>=it.D-70&&D<commit&&!ok)waiting=true;
      placeMark(it.D,MARK[it.kind],D<it.D-3);
      if(waiting)T.idle+=dt;
      arrowsEl.className='tut-arrows';
      if(D>it.D+8)complete(T,it.kind==='slit'?'Smooth':it.kind==='wall'?'Through':'Nice')
    }
    else if(T.id==='finish'){T.timer+=dt;scale=.5;if(T.timer>3.6){T.closing=true;endFlight(true)}}
  }
  if(!waiting)T.idle=0;
  coach.classList.toggle('nudge',T.idle>6);
  state.worldScaleTarget=1;
  document.getElementById('slowGrade')?.classList.remove('on')
}
function respawn(T){
  clearCrash();clearMeteors();
  T.fails++;
  const it=COURSE.find(c=>c.id===T.id);
  if(it&&T.fails>=2)T.cleared[it.id]=true;else if(it&&it.kind==='block'&&T.fails===1)T.assist=(Math.random()<.5?-1:1)*5.5;
  state.distance=state.worldZ=T.cp;state.x=0;state.vx=0;state.bank=0;state.yaw=0;state.speed=T.speed;
  state.timeScale=1;state.crashElapsed=0;state.hitTimer=0;state.shake=0;state.rumble=0;state.shieldTimer=0;state.shieldSafety=0;
  state.shieldCooldown=0;state.worldScale=state.worldScaleTarget=1;
  plane.visible=true;plane.scale.setScalar(.42);plane.position.set(0,CONFIG.baseAltitude,0);plane.rotation.set(0,0,0);
  resetRollSystem();streamChunks(true);camera.position.set(0,5.2,10.5);
  state.mode='PLAYING';startMusic(false);
  T.flag=false;T.done=false;T.next=null;T.delay=0;T.idle=0;
  coach.classList.remove('ok');if(T.opts)coachShow(T.opts);
  const easy=!!(it&&T.cleared[it.id]);
  cTag.textContent=easy?'NO WORRIES':'TRY AGAIN';if(easy)cTitle.textContent='We cleared the way';else if(it&&it.kind==='block'&&T.assist!==null)cTitle.textContent='We\'ll steer this one';
  document.getElementById('distance').textContent=Math.floor(T.cp).toLocaleString();
  fade(.9,.12);requestAnimationFrame(()=>requestAnimationFrame(()=>fade(0,.6)))
}

/* ---- begin / end ---- */
function startFlight(){
  if(state.mode!=='HOME'||state.tut)return;
  const T=makeRun();state.tut=T;
  T.origAbilities={...save.abilities};save.abilities={shield:0,slow:0,autopilot:0};renderAbilityHud();
  home.classList.remove('active');welcomeEl.classList.remove('active');root.classList.remove('ff-first');
  resetWorld();state.speed=T.speed;state.mode='PLAYING';
  hud.classList.add('visible');{const dc=document.querySelector('#hud .distance');if(dc)dc.style.display='none'}document.getElementById('distance').textContent='0';
  document.getElementById('vignette').classList.remove('on');document.getElementById('slowGrade').classList.remove('on');
  skipFlight.classList.add('show');startMusic(true);enter(T,T.order[0])
}
function endFlight(completed){
  const T=state.tut;if(!T)return;T.closing=true;coachHide();skipFlight.classList.remove('show');fade(1,.7);
  setTimeout(()=>{
    if(state.shieldTimer>0)finishAbility('shield');
    state.tut=null;save.abilities=T.origAbilities;renderAbilityHud();
    resetWorld();state.mode='HOME';stopMusic();
    hud.classList.remove('visible');{const dc=document.querySelector('#hud .distance');if(dc)dc.style.display=''}if(!completed)home.classList.add('active');
    document.getElementById('vignette').classList.remove('on');document.getElementById('slowGrade').classList.remove('on');
    markSeen();fade(0,.9);
    if(completed)startRun()
  },750)
}
skipFlight.addEventListener('click',()=>endFlight(false));

/* ---- welcome scene (first visit only) ---- */
let welcomeTimer=null;
function beginWelcome(){
  state.lock=true;home.classList.remove('active');root.classList.remove('ff-first');
  welcomeEl.classList.add('active');
  const wake=()=>{try{if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume()}catch{}};
  window.addEventListener('pointerdown',wake,{once:true});window.addEventListener('keydown',wake,{once:true});
  welcomeTimer=setTimeout(()=>{state.lock=false;startFlight()},2200)
}
function skipWelcome(){
  clearTimeout(welcomeTimer);state.lock=false;markSeen();welcomeEl.classList.remove('active');home.classList.add('active')
}
welcomeSkip.addEventListener('click',skipWelcome);
window.addEventListener('keydown',e=>{if(state.lock){e.stopImmediatePropagation();e.preventDefault()}},true);

/* ---- guided tour: shop -> abilities -> hangar -> settings ---- */
const settingsEl=$('settings'),settingsOpen=()=>!!(settingsEl&&settingsEl.classList.contains('active')),statsEl=$('stats'),statsOpen=()=>!!(statsEl&&statsEl.classList.contains('active'));
let settingsTouched=false;
if(settingsEl)settingsEl.addEventListener('input',()=>{settingsTouched=true});
const tap=touch?'Tap':'Click';
const achOpen=()=>{const t=$('sxTabAch');return !!t&&t.getAttribute('aria-selected')==='true'};
const TOUR=[
  /* 0 */ {mode:'HOME',target:'#homeShop',tag:'THE SHOP',title:'Spend what you earned',text:`You collected credits on that flight. ${tap} Shop to spend them on abilities and aircraft.`,done:()=>state.mode==='SHOP'},
  /* 1 */ {mode:'SHOP',target:'#planeRail',tag:'HANGAR',title:'Pick your plane',text:'Each aircraft handles and sees differently. '+tap+' one to preview it.',next:'NEXT',shop:true},
  /* 2 */ {mode:'SHOP',target:'#abilitiesTab',tag:'ABILITIES',title:'Now the abilities',text:`${tap} the Abilities tab to see your tools.`,shop:true,done:()=>state.shopTab==='abilities'},
  /* 3 */ {mode:'SHOP',target:'.hangar-panel',fit:'abilities',tag:'ABILITIES',title:'Three tools for the sky',text:'Unlock and upgrade Shield, Slow-Mo and Autopilot here, then trigger them mid-flight.',next:'NEXT',shop:true},
  /* 4 */ {mode:'SHOP',target:'#hangarBack',tag:'ALL SET',title:'Back to the runway',text:`${tap} Back when you are ready.`,shop:true,done:()=>state.mode==='HOME'},
  /* 5 */ {mode:'HOME',target:'#homeStats',tag:'STATISTICS',title:'Track your progress',text:`${tap} Statistics to see your flight record, what you have discovered, and your achievements.`,done:statsOpen},
  /* 6 */ {mode:'HOME',target:'#sxTabAch',tag:'ACHIEVEMENTS',title:'Achievements pay credits',text:`${tap} the Achievements tab. Every achievement you unlock pays out credits.`,shop:true,needs:statsOpen,done:achOpen},
  /* 7 */ {mode:'HOME',target:'.stats-panel',tag:'ACHIEVEMENTS',title:'Another way to earn',text:'Unlock an achievement, then press CLAIM to collect its credits. Check back here as you fly.',next:'NEXT',shop:true,needs:statsOpen},
  /* 8 */ {mode:'HOME',target:'#closeStats',tag:'STATISTICS',title:'Nicely done',text:`${tap} the ✕ to close it.`,shop:true,done:()=>!statsOpen()}
];
const STATS_I=5;
let tourI=-1,tourTimer=null,tourAdvance=false;
function tourRender(){
  const st=TOUR[tourI];if(!st)return;tourAdvance=false;
  if(st.fit==='settings')document.body.classList.add('tour-fit');else settingsLayoutReset();
  coachShow({pos:'bottom',shop:st.shop,tag:st.tag,title:st.title,text:st.text,next:st.next,skip:true,fit:!!st.fit});setRing(st.target,st.fit?FIT[st.fit]:null)
}
function tourTick(){
  const st=TOUR[tourI];if(!st)return;
  if(state.mode!==st.mode){
    /* left the path: leaving the shop continues with statistics; the first shop click moves on; anything else ends the tour */
    if(st.mode==='SHOP'&&state.mode==='HOME'){tourGo(STATS_I);return}
    if(st.mode==='HOME'&&state.mode==='SHOP'&&tourI===0){tourGo(1);return}
    endTour();return
  }
  if(st.needs&&!st.needs()){endTour();return}   /* stats closed early: the tour is over */
  if(st.done&&st.done()||tourAdvance){tourGo(tourI+1)}
}
function tourGo(i){
  if(i>=TOUR.length){endTour();return}
  tourI=i;
  if(i===1&&state.shopTab!=='hangar')setShopTab('hangar');
  tourRender()
}
function startTour(){
  if(state.mode!=='HOME')return;
  tourI=-1;tourGo(0);clearInterval(tourTimer);tourTimer=setInterval(tourTick,150)
}
function endTour(){tourI=-1;clearInterval(tourTimer);coachHide();settingsLayoutReset()}
cNext.addEventListener('click',()=>{tourAdvance=true});
cSkip.addEventListener('click',endTour);

/* ---- public hook + boot ---- */
window.farflightTutorial={replay(){if(state.mode==='HOME'&&!state.tut&&!state.lock){endTour();startFlight()}}};
const forced=root.classList.contains('ff-first');
if(forced)beginWelcome();

/* ---- post-crash tour: shown once, the first time the player crashes in a real run. Forces them home, then walks hangar -> abilities -> statistics -> achievements ---- */
const HINT='farflight-shop-hint-v1';
let hintDone=false,hintPending=false;
try{
  hintDone=localStorage.getItem(HINT)==='1';
  if(!forced&&!hintDone&&localStorage.getItem(FLAG)==='1'){hintDone=true;localStorage.setItem(HINT,'1')}   /* returning players already know the shop */
}catch{}
/* first crash: the only way forward is HOME. Fly Again / Continue are hidden (CSS) and startRun/continueRun are blocked while state.forceHome is set */
new MutationObserver(()=>{
  if(!dead.classList.contains('active')||hintDone||state.tut||state.forceHome)return;
  hintPending=true;state.forceHome=true;dead.classList.add('ff-force-home');
  coachShow({pos:'top',tag:'FIRST CRASH',title:'Crashes still pay',text:'You earned credits on that flight. Head home to spend them.'});setRing('#goHome')
}).observe(dead,{attributes:true,attributeFilter:['class']});
$('goHome').addEventListener('click',()=>{if(!state.forceHome)return;state.forceHome=false;dead.classList.remove('ff-force-home');coachHide()});
setInterval(()=>{
  if(hintDone||tourI>=0||state.tut||state.lock)return;
  if(dead.classList.contains('active'))hintPending=true;
  else if(hintPending&&state.mode==='HOME'&&home.classList.contains('active')&&!settingsOpen()&&!statsOpen()){
    hintDone=true;try{localStorage.setItem(HINT,'1')}catch{}
    startTour()
  }
},400);
})();

/* ---------- HOME TIPS: one tip at a time, a new one every 15 s ---------- */
(()=>{
const el=document.getElementById('tipText'),wrap=document.getElementById('homeHint');if(!el||!wrap)return;
const touch=(()=>{try{return matchMedia('(pointer: coarse)').matches}catch{return false}})();
const lv=(typeof CONFIG!=='undefined'&&CONFIG.levelMeters)||850;
const common=[
  'Every meter you fly earns credits, even when you crash.',
  `The world changes every ${lv.toLocaleString()} meters.`,
  'Spend credits in the shop on abilities and new aircraft.',
  'Settings has volume, brightness and contrast controls.',
  'Statistics shows your longest flight, lifetime distance and maps reached.',
  'Forgot the controls? The ? button in the top corner replays How to Play.'
];
const TIPS=(touch?[
  'Hold the left or right side of the screen to steer.',
  'Touch with two fingers to roll onto a wing and slip through narrow gaps.',
  'Tap the shield button to pass straight through obstacles. Unlock it in the shop.',
  'Tap the slow-mo button to ease time while your steering stays quick. Unlock it in the shop.',
  'Autopilot flies for you for a while. Unlock it in the shop.',
  'Tap the view button to switch between chase and cockpit view.'
]:[
  'Hold A / D or ← / → to steer.',
  'Press Q or E to roll onto a wing and slip through narrow gaps.',
  'Shield (Z) lets you pass straight through obstacles. Unlock it in the shop.',
  'Slow-Mo (X) eases time while your steering stays quick. Unlock it in the shop.',
  'Autopilot (V) flies for you for a while. Unlock it in the shop.',
  'Press C to switch between chase and cockpit view.'
]).concat(common);
let i=0;el.textContent=TIPS[0];
setInterval(()=>{
  if(document.hidden||state.mode!=='HOME')return;
  wrap.classList.add('swap');
  setTimeout(()=>{i=(i+1)%TIPS.length;el.textContent=TIPS[i];wrap.classList.remove('swap')},700)
},15000)
})();

/* ---- statistics: moved to stats.js (flight record, discovered maps + hazards, achievements) ---- */
