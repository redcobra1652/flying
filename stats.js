// Statistics: flight record, discovered maps + hazards, achievements. Loads after main.js.

/* ---- persistence (same key as before; new fields are additive, old saves read fine) ---- */
const STATS_KEY='farflight-stats-v1';
let FF_STATS=null;
function readStats(){
  if(FF_STATS)return FF_STATS;
  let x=null;try{x=JSON.parse(localStorage.getItem(STATS_KEY)||'null')}catch{}
  const n=(v,max)=>Math.max(0,Math.min(max,Number.isFinite(Number(v))?Number(v):0));
  const s={maxMap:0,voidSeen:false,runs:0,air:0,uses:{shield:0,slow:0,autopilot:0},haz:{},ach:{},seen:[]};
  if(x&&typeof x==='object'){
    s.maxMap=Math.floor(n(x.maxMap,LEVELS.length-1));s.voidSeen=!!x.voidSeen;
    s.runs=Math.floor(n(x.runs,1e9));s.air=n(x.air,1e9);
    for(const k of ['shield','slow','autopilot'])s.uses[k]=Math.floor(n(x.uses&&x.uses[k],1e9));
    if(x.haz&&typeof x.haz==='object')for(const k in x.haz)if(x.haz[k])s.haz[k]=true;
    if(x.ach&&typeof x.ach==='object')for(const k in x.ach)s.ach[k]=Number(x.ach[k])||1;
    if(Array.isArray(x.seen))s.seen=x.seen.filter(v=>typeof v==='string').slice(0,200);
  }
  return FF_STATS=s;
}
function writeStats(){try{localStorage.setItem(STATS_KEY,JSON.stringify(readStats()))}catch{}}
function recordMap(m){
  const s=readStats();let changed=false;
  if(m==='void'){if(!s.voidSeen){s.voidSeen=true;changed=true}}
  else if(Number.isInteger(m)&&m>s.maxMap){s.maxMap=Math.min(m,LEVELS.length-1);changed=true}
  if(changed)writeStats();
}

(function(){
  const $=id=>document.getElementById(id),panel=$('stats'),btn=$('homeStats');
  if(!panel||!btn)return;
  const fmtM=n=>Math.floor(n).toLocaleString()+' m';
  const fmtT=s=>{s=Math.floor(s);if(s<60)return s+'s';const m=Math.floor(s/60);if(m<60)return m+'m';const h=Math.floor(m/60);return h+'h '+String(m%60).padStart(2,'0')+'m'};
  const calm=()=>{try{return !!(state&&state.reduced)||matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ================= hazards ================= */
  const rule=(i,k)=>!!(LEVEL_RULES[i]&&LEVEL_RULES[i][k]);
  const HAZ=[
    {id:'rise',name:'Rising Pillars',event:false,text:'Pillars burst out of the ground just ahead of you.',on:i=>rule(i,'rise')},
    {id:'spikes',name:'Spike Cones',event:false,text:'Rows of sharp cones with narrow gaps between them.',on:i=>!!LEVELS[i].spikes},
    {id:'crystals',name:'Crystal Clusters',event:false,text:'Faceted crystals that glow in the dark and block your path.',on:i=>!!LEVELS[i].crystals},
    {id:'meteor',name:'Meteor Strike',event:true,text:'A marker shows where a meteor will land. Get clear of the blast.',on:i=>rule(i,'meteor')},
    {id:'lightning',name:'Lightning Strike',event:true,text:'A ring marks the ground, then a bolt hits it.',on:i=>rule(i,'lightning')},
    {id:'gust',name:'Crosswind Gust',event:true,text:'After a warning, a strong crosswind shoves you off course.',on:i=>rule(i,'gust')},
    {id:'geyser',name:'Lava Geyser',event:true,text:'Cracks glow in the ground, then lava erupts.',on:i=>rule(i,'geyser')},
    {id:'mover',name:'Sliding Bands',event:false,text:'Whole rows of obstacles slide from side to side.',on:i=>rule(i,'mover')},
    {id:'pulse',name:'Breathing Pillars',event:false,text:'Pillars glow, sink into the ground and rise again.',on:i=>rule(i,'pulse')},
    {id:'well',name:'Gravity Well',event:true,text:'A dark mass that drags your plane toward it.',on:i=>rule(i,'well')},
    {id:'blink',name:'Phase Blocks',event:false,text:'Blocks that vanish and return on a timer.',on:i=>rule(i,'blink')},
    {id:'beam',name:'Sky Beams',event:true,text:'Columns of light and turning blades slam down from above.',on:i=>rule(i,'beam')},
    {id:'orbit',name:'Orbiting Formations',event:false,text:'Obstacle groups that circle around a fixed point.',on:i=>rule(i,'orbit')}
  ];
  const mapsOf=h=>LEVELS.map((_,i)=>i).filter(h.on);
  function mapsReached(S){const lm=(typeof CONFIG!=='undefined'&&CONFIG.levelMeters)||850;return Math.max(S.maxMap,Math.min(LEVELS.length-1,Math.floor((state.best||0)/lm)))}
  function hazardSeen(h,S,max){
    if(S.haz[h.id])return true;
    const m=mapsOf(h);
    /* terrain hazards are in view the moment you enter the map; timed events only count once you have flown past that map or one has actually fired */
    return h.event?m.some(i=>i<max):m.some(i=>i<=max);
  }
  function markHazard(id){const S=readStats();if(S.haz[id])return;S.haz[id]=true;writeStats()}

  /* ================= achievements ================= */
  const ICON={
    wings:'<path d="M3 13c4 0 6-1 9-5 3 4 5 5 9 5-3 1-5 3-9 7-4-4-6-6-9-7z"/>',
    route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l5-5"/>',
    plane:'<path d="M12 2.8c.9 0 1.5.9 1.5 2v5.3l7.5 4.6v2l-7.5-2.3v3.7l2 1.6v1.6L12 20.2l-3.5 1.1v-1.6l2-1.6v-3.7L3 16.7v-2l7.5-4.6V4.8c0-1.1.6-2 1.5-2z"/>',
    shield:'<path d="M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z"/>',
    hourglass:'<path d="M7 3h10M7 21h10M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3"/>',
    wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M3.5 10.5 10 12M20.5 10.5 14 12M12 14v7"/>',
    book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    crown:'<path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z"/>',
    bolt:'<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
    box:'<path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="M12 12 20 7.5M12 12 4 7.5M12 12v9"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  const svgIcon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const usesSum=c=>c.uses.shield+c.uses.slow+c.uses.autopilot;
  const CATS=['Flight','Exploration','Discovery','Hangar','Mastery'];
  const ACH=[
    {id:'first_flight',cat:0,tier:1,icon:'wings',name:'Wheels Up',desc:'Complete your first flight.',goal:1,val:c=>Math.max(c.runs,c.best>0?1:0)},
    {id:'short_haul',cat:0,tier:1,icon:'route',name:'Short Haul',desc:'Fly 1,000 m in a single flight.',goal:1000,val:c=>c.best},
    {id:'long_haul',cat:0,tier:2,icon:'route',name:'Long Haul',desc:'Fly 5,000 m in a single flight.',goal:5000,val:c=>c.best},
    {id:'transcontinental',cat:0,tier:3,icon:'route',name:'Transcontinental',desc:'Fly 10,000 m in a single flight.',goal:10000,val:c=>c.best},
    {id:'frequent_flyer',cat:0,tier:1,icon:'plane',name:'Frequent Flyer',desc:'Fly 10,000 m in total.',goal:10000,val:c=>c.life},
    {id:'gold_status',cat:0,tier:2,icon:'star',name:'Gold Status',desc:'Fly 50,000 m in total.',goal:50000,val:c=>c.life},
    {id:'platinum_status',cat:0,tier:3,icon:'star',name:'Platinum Status',desc:'Fly 200,000 m in total.',goal:200000,val:c=>c.life},
    {id:'million_meter_club',cat:0,tier:4,icon:'crown',name:'Million Meter Club',desc:'Fly 1,000,000 m in total.',goal:1000000,val:c=>c.life},

    {id:'pathfinder',cat:1,tier:1,icon:'compass',name:'Pathfinder',desc:'Discover 4 maps.',goal:4,val:c=>c.maps},
    {id:'cartographer',cat:1,tier:2,icon:'compass',name:'Cartographer',desc:'Discover 10 maps.',goal:10,val:c=>c.maps},
    {id:'master_cartographer',cat:1,tier:3,icon:'globe',name:'Master Cartographer',desc:'Discover every map.',goal:LEVELS.length,val:c=>c.maps},
    {id:'final_approach',cat:1,tier:4,icon:'radar',name:'Final Approach',desc:'Reach the final map.',goal:1,val:c=>c.maxMap>=LEVELS.length-1?1:0},
    {id:'beyond_the_horizon',cat:1,tier:3,icon:'radar',name:'Beyond the Horizon',desc:'Enter the Event Horizon.',goal:1,secret:true,val:c=>c.voidSeen?1:0},

    {id:'field_researcher',cat:2,tier:1,icon:'box',name:'Field Researcher',desc:'Discover 4 hazards.',goal:4,val:c=>c.haz},
    {id:'hazard_analyst',cat:2,tier:3,icon:'bolt',name:'Hazard Analyst',desc:'Discover every hazard.',goal:HAZ.length,val:c=>c.haz},

    {id:'hangar_expansion',cat:3,tier:1,icon:'plane',name:'Hangar Expansion',desc:'Own 2 aircraft.',goal:2,val:c=>c.planes},
    {id:'full_hangar',cat:3,tier:3,icon:'plane',name:'Full Hangar',desc:'Own every aircraft.',goal:PLANES.length,val:c=>c.planes},
    {id:'systems_upgrade',cat:3,tier:1,icon:'shield',name:'Systems Upgrade',desc:'Unlock an ability.',goal:1,val:c=>c.abilityAny},
    {id:'fully_loaded',cat:3,tier:3,icon:'shield',name:'Fully Loaded',desc:'Max out every ability.',goal:9,val:c=>c.abilitySum},
    {id:'flight_log_entry',cat:3,tier:1,icon:'book',name:'Flight Log Entry',desc:'Claim a flight log bonus.',goal:1,val:c=>c.milestones},
    {id:'logbook_veteran',cat:3,tier:3,icon:'book',name:'Logbook Veteran',desc:'Claim 6 flight log bonuses.',goal:6,val:c=>c.milestones},

    {id:'emergency_protocol',cat:4,tier:1,icon:'shield',name:'Emergency Protocol',desc:'Activate Shield.',goal:1,val:c=>c.uses.shield},
    {id:'time_dilation',cat:4,tier:1,icon:'hourglass',name:'Time Dilation',desc:'Activate Slow-Mo.',goal:1,val:c=>c.uses.slow},
    {id:'hands_free',cat:4,tier:1,icon:'wheel',name:'Hands Free',desc:'Engage Autopilot.',goal:1,val:c=>c.uses.autopilot},
    {id:'systems_operator',cat:4,tier:2,icon:'wheel',name:'Systems Operator',desc:'Use abilities 50 times.',goal:50,val:c=>usesSum(c)},
    {id:'line_pilot',cat:4,tier:1,icon:'wings',name:'Line Pilot',desc:'Take 25 flights.',goal:25,val:c=>c.runs},
    {id:'captain',cat:4,tier:3,icon:'crown',name:'Captain',desc:'Take 100 flights.',goal:100,val:c=>c.runs},
    {id:'logged_hours',cat:4,tier:2,icon:'clock',name:'Logged Hours',desc:'Spend 1 hour in the air.',goal:3600,time:true,val:c=>c.air},
    {id:'seasoned_aviator',cat:4,tier:4,icon:'clock',name:'Seasoned Aviator',desc:'Spend 10 hours in the air.',goal:36000,time:true,val:c=>c.air}
  ];
  function ctx(S){
    S=S||readStats();const max=mapsReached(S),ab=save.abilities||{};
    return{
      best:state.best||0,life:save.lifetimeMeters||0,maxMap:max,voidSeen:S.voidSeen||max>=LEVELS.length-1,
      maps:max+1,runs:S.runs,air:S.air,uses:S.uses,
      haz:HAZ.filter(h=>hazardSeen(h,S,max)).length,
      planes:(save.ownedPlanes||[]).length,
      abilityAny:(ab.shield||ab.slow||ab.autopilot)?1:0,abilitySum:(ab.shield|0)+(ab.slow|0)+(ab.autopilot|0),
      milestones:(save.milestonesClaimed||[]).length
    };
  }
  function evaluate(){
    const S=readStats(),c=ctx(S);let fresh=0;
    for(const a of ACH)if(!S.ach[a.id]&&a.val(c)>=a.goal){S.ach[a.id]=Date.now();fresh++}
    if(fresh)writeStats();
    syncDots();return fresh;
  }
  const unseen=()=>{const S=readStats();return Object.keys(S.ach).filter(id=>ACH.some(a=>a.id===id)&&!S.seen.includes(id))};
  function syncDots(){const n=unseen().length;btn.classList.toggle('has-new',n>0);const t=$('sxTabAch');if(t)t.classList.toggle('has-new',n>0)}

  /* ================= previews: maps ================= */
  const hx=c=>{c=String(c).replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)||0)};
  const mix=(a,b,t)=>{const A=hx(a),B=hx(b);return'#'+A.map((v,k)=>Math.round(v+(B[k]-v)*t).toString(16).padStart(2,'0')).join('')};
  const rng=seed=>{let s=(seed*7919+13)%233280;return()=>(s=(s*9301+49297)%233280)/233280};
  const f1=n=>Math.round(n*10)/10;
  function particles(L,r,uid){
    const p=L.particle,col=L.ambient||'#fff';let o='';
    const dots=(n,y0,y1,rad,c,op,cls)=>{for(let k=0;k<n;k++)o+=`<circle ${cls&&k%3===0?`class="${cls}" `:''}cx="${f1(r()*160)}" cy="${f1(y0+r()*(y1-y0))}" r="${f1(rad*(.6+r()*.8))}" fill="${c}" opacity="${op}"/>`};
    if(p==='cloud'){for(let k=0;k<4;k++){const x=r()*140+10,y=8+r()*22;o+=`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(14+r()*10)}" ry="${f1(3.2+r()*2)}" fill="#fff" opacity=".6"/>`}}
    else if(p==='stars'||p==='warp')dots(24,2,50,.9,'#fff',.85,'sxm-twinkle');
    else if(p==='snow')dots(26,4,96,1.2,'#fff',.85);
    else if(p==='rain'){for(let k=0;k<22;k++){const x=r()*160,y=r()*90;o+=`<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x-3)}" y2="${f1(y+8)}" stroke="#c8d6f0" stroke-width=".8" opacity=".5"/>`}}
    else if(p==='embers')dots(18,20,96,1,'#ffb04a',.85,'sxm-twinkle');
    else if(p==='petals'){for(let k=0;k<14;k++)o+=`<ellipse cx="${f1(r()*160)}" cy="${f1(r()*92)}" rx="1.8" ry="1" fill="#ffd0dc" opacity=".85" transform="rotate(${f1(r()*180)} 80 50)"/>`}
    else if(p==='neon')dots(16,4,70,1.2,col,.9,'sxm-twinkle');
    else if(p==='spores')dots(16,20,92,1.1,col,.8,'sxm-twinkle');
    else dots(14,30,96,.9,mix(col,'#ffffff',.2),.5);
    return o;
  }
  function mapSVG(i){
    const L=LEVELS[i],r=rng(i+5),id='sxm'+i,hz=58;
    if(L.perplex){
      let rings='';for(let k=0;k<9;k++){const rad=6+k*9,hue=k*42;rings+=`<ellipse cx="80" cy="50" rx="${rad*1.55}" ry="${rad*.95}" fill="none" stroke="hsl(${hue} 95% 62%)" stroke-width="${f1(1.2+k*.18)}" opacity="${f1(.95-k*.07)}"/>`}
      return`<svg class="sxm sxm-hue" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="100" fill="#000"/>${rings}<circle cx="80" cy="50" r="4" fill="#fff"/></svg>`;
    }
    const sky=`<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.skyTop}"/><stop offset="1" stop-color="${L.skyHorizon}"/></linearGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.fog}" stop-opacity="0"/><stop offset=".7" stop-color="${L.fog}" stop-opacity=".7"/><stop offset="1" stop-color="${L.fog}" stop-opacity="0"/></linearGradient></defs><rect width="160" height="100" fill="url(#${id}s)"/>`;
    let body='';
    if(L.moon){body+=`<circle cx="116" cy="28" r="17" fill="${L.sun}" opacity=".2"/><circle cx="116" cy="28" r="8" fill="${L.moon}"/>`;if(L.corona)body+=`<circle cx="116" cy="28" r="10.5" fill="none" stroke="#ff9a50" stroke-width="2" opacity=".9"/>`}
    else body+=`<circle cx="116" cy="30" r="17" fill="${L.sun}" opacity=".28"/><circle cx="116" cy="30" r="8" fill="${L.sun}"/>`;
    body+=particles(L,r,id);
    const ridge=(base,amp,col,seed)=>{const q=rng(seed);let d=`M0 ${hz+6}`;for(let x=0;x<=160;x+=16)d+=`L${x} ${f1(base-q()*amp)}`;return`<path d="${d}L160 ${hz+8}V100H0Z" fill="${col}"/>`};
    body+=ridge(hz-2,12,mix(L.fog,L.palette[2],.3),i+40)+ridge(hz+2,8,mix(L.palette[1],L.fog,.35),i+70);
    body+=`<path d="M0 ${hz+3}L160 ${hz+3}V100H0Z" fill="${L.ground}"/>`;
    for(let k=-4;k<=4;k++)body+=`<line x1="80" y1="${hz+3}" x2="${80+k*38}" y2="100" stroke="${mix(L.ground,'#ffffff',.16)}" stroke-width=".6" opacity=".5"/>`;
    const obs=[];for(let k=0;k<8;k++){const t=.12+.88*r();obs.push({t,x:80+(r()-.5)*(24+t*150),y:hz+4+t*34})}
    obs.sort((a,b)=>a.y-b.y);
    obs.forEach((o,k)=>{const s=3+o.t*11,x=f1(o.x),y=f1(o.y),c=L.palette[2+(k%3)];
      if(L.spikes)body+=`<polygon points="${f1(x-s/2)},${y} ${f1(x+s/2)},${y} ${x},${f1(y-s*1.9)}" fill="${c}"/><polygon points="${x},${y} ${f1(x+s/2)},${y} ${x},${f1(y-s*1.9)}" fill="${mix(c,'#000',.22)}"/>`;
      else if(L.crystals)body+=`<polygon points="${f1(x-s/2)},${y} ${f1(x-s/2)},${f1(y-s)} ${x},${f1(y-s*1.8)} ${f1(x+s/2)},${f1(y-s)} ${f1(x+s/2)},${y}" fill="${mix(c,L.glow||'#fff',.3)}"/><polygon points="${x},${y} ${x},${f1(y-s*1.8)} ${f1(x+s/2)},${f1(y-s)} ${f1(x+s/2)},${y}" fill="${mix(c,'#ffffff',.3)}" opacity=".7"/>`;
      else body+=`<rect x="${f1(x-s/2)}" y="${f1(y-s*1.3)}" width="${f1(s)}" height="${f1(s*1.3)}" fill="${c}"/><rect x="${f1(x-s/2)}" y="${f1(y-s*1.3)}" width="${f1(s)}" height="${f1(s*.25)}" fill="${mix(c,'#ffffff',.3)}"/>`});
    body+=`<rect y="${hz-12}" width="160" height="24" fill="url(#${id}f)"/>`;
    if(L.scan){body+=`<g opacity=".22">${Array.from({length:25},(_,k)=>`<rect y="${k*4}" width="160" height="1.2" fill="#000"/>`).join('')}</g><rect x="0" y="34" width="70" height="3" fill="${L.accent}" opacity=".7"/><rect x="60" y="58" width="100" height="2" fill="#40ffd0" opacity=".6"/>`}
    return`<svg class="sxm" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${sky}${body}</svg>`;
  }
  function horizonSVG(){
    let st='';const r=rng(99);for(let k=0;k<26;k++)st+=`<circle cx="${f1(r()*160)}" cy="${f1(r()*100)}" r="${f1(.4+r()*.9)}" fill="#fff" opacity=".7"/>`;
    return`<svg class="sxm" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="sxhg"><stop offset=".55" stop-color="#ff55cf" stop-opacity=".5"/><stop offset="1" stop-color="#ff55cf" stop-opacity="0"/></radialGradient></defs><rect width="160" height="100" fill="#05030d"/>${st}<circle cx="80" cy="50" r="40" fill="url(#sxhg)"/><g transform="rotate(-16 80 50)"><ellipse cx="80" cy="50" rx="44" ry="11" fill="none" stroke="#ff9a50" stroke-width="3.5" opacity=".9"/><ellipse cx="80" cy="50" rx="34" ry="8" fill="none" stroke="#ffd25a" stroke-width="2" stroke-dasharray="16 9"><animate attributeName="stroke-dashoffset" from="0" to="50" dur="2.2s" repeatCount="indefinite"/></ellipse></g><circle cx="80" cy="50" r="13" fill="#000"/><circle cx="80" cy="50" r="13" fill="none" stroke="#fff" stroke-width=".8" opacity=".6"/></svg>`;
  }

  /* ================= previews: hazards ================= */
  const pil=(x,y,w,h,c,top,cls,st)=>`<g ${cls?`class="${cls}" `:''}${st?`style="${st}"`:''}><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="4" fill="${top}"/><rect x="${x+w-4}" y="${y}" width="4" height="${h}" fill="#000" opacity=".18"/></g>`;
  function scene(id,top,bot,ground,inner,hy=70){
    return`<svg class="sxh" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sxk${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient><linearGradient id="sxc${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a14"/><stop offset=".55" stop-color="#ffb43a"/><stop offset="1" stop-color="#fff2b0"/></linearGradient></defs><rect width="160" height="100" fill="url(#sxk${id})"/><path d="M0 ${hy}L160 ${hy-2}V100H0Z" fill="${ground}"/>${inner}</svg>`;
  }
  const SHARD=(cx,b,w,h,c1,c2)=>`<polygon points="${cx-w/2},${b} ${cx-w/2},${b-h*.7} ${cx},${b-h} ${cx+w/2},${b-h*.7} ${cx+w/2},${b}" fill="${c1}"/><polygon points="${cx},${b} ${cx},${b-h} ${cx+w/2},${b-h*.7} ${cx+w/2},${b}" fill="${c2}" opacity=".75"/>`;
  const HZ={
    rise:()=>scene('rise','#b5534e','#f0a47f','#9b5147',[24,52,80,108].map((x,k)=>pil(x,48-k%2*6,18,40+k%2*6,'#c36c50','#e8aa78','sxh-rise',`animation-delay:${k*.35}s`)).join('')+`<path d="M0 86L160 84V100H0Z" fill="#7d3f39"/>`),
    spikes:()=>scene('spikes','#b5534e','#f0a47f','#9b5147',[16,44,72,100,128].map((x,k)=>{const h=30+(k%3)*9;return`<polygon points="${x-10},88 ${x+10},88 ${x},${88-h}" fill="#d78761"/><polygon points="${x},88 ${x+10},88 ${x},${88-h}" fill="#a65545"/>`}).join('')),
    crystals:()=>scene('crys','#0a1f2e','#3a2a6c','#18243a',`<ellipse class="sxh-glow" cx="80" cy="74" rx="62" ry="22" fill="#7a6aff" opacity=".35"/>`+SHARD(36,88,16,40,'#56a0c8','#b0ecf0')+SHARD(66,88,20,56,'#3e72a8','#7ac8d8')+SHARD(98,88,18,46,'#56a0c8','#b0ecf0')+SHARD(128,88,14,32,'#3e72a8','#7ac8d8')),
    meteor:()=>scene('met','#3a2a58','#f0a47f','#6a3a40',`<ellipse class="sxh-reticle" cx="104" cy="80" rx="24" ry="6" fill="#ff765e" fill-opacity=".18" stroke="#ff765e" stroke-width="1.6"/><g class="sxh-meteor"><polygon points="101,72 108,79 26,-20" fill="#ff9a3c" opacity=".7"/><circle cx="104" cy="76" r="6" fill="#ffd25a"/><circle cx="104" cy="76" r="3" fill="#fff"/></g><circle class="sxh-blast" cx="104" cy="78" r="16" fill="#ffb04a"/>`,72),
    lightning:()=>scene('lit','#262d40','#59647c','#2d3a45',`<ellipse cx="40" cy="12" rx="40" ry="12" fill="#161b28"/><ellipse cx="120" cy="8" rx="46" ry="12" fill="#161b28"/><ellipse class="sxh-reticle" cx="96" cy="80" rx="22" ry="5.5" fill="#ffe36a" fill-opacity=".14" stroke="#ffe36a" stroke-width="1.6"/><g class="sxh-bolt"><polyline points="88,8 100,26 90,34 104,52 94,58 97,79" fill="none" stroke="#ffe36a" stroke-width="6" stroke-linejoin="round" opacity=".35"/><polyline points="88,8 100,26 90,34 104,52 94,58 97,79" fill="none" stroke="#fffbe0" stroke-width="2.4" stroke-linejoin="round"/></g><rect class="sxh-flash" width="160" height="100" fill="#fff"/>`,72),
    geyser:()=>scene('gey','#1d0808','#a32d12','#2a1210',`<ellipse class="sxh-crack" cx="80" cy="82" rx="30" ry="6" fill="#ff7a2a" opacity=".35"/><g class="sxh-crack" stroke="#ff9a3a" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M56 84l10-3 7 3 7-3 7 3 8-3 10 3"/><path d="M68 90l8-3M92 90l8-3"/></g><path class="sxh-col" d="M69 83C67 62 74 42 79 14C84 42 94 62 91 83Z" fill="url(#sxcgey)"/>`+[[-18,66],[14,58],[-8,52],[22,70],[-26,74]].map(([dx,y],k)=>`<circle class="sxh-spark" style="--dx:${dx}px;animation-delay:${k*.06}s" cx="80" cy="${y}" r="1.8" fill="#ffd25a"/>`).join(''),74),
    well:()=>scene('wel','#0d0f2a','#4d2870','#1a1c3c',`<circle cx="80" cy="42" r="30" fill="#ff55cf" opacity=".14"/><g transform="rotate(-14 80 42)"><ellipse cx="80" cy="42" rx="34" ry="9" fill="none" stroke="#ff9a50" stroke-width="4" opacity=".85"/><ellipse cx="80" cy="42" rx="26" ry="6.5" fill="none" stroke="#ffd25a" stroke-width="2" stroke-dasharray="14 8"><animate attributeName="stroke-dashoffset" from="0" to="44" dur="1.6s" repeatCount="indefinite"/></ellipse></g><circle cx="80" cy="42" r="11" fill="#030006"/><circle cx="80" cy="42" r="11" fill="none" stroke="#fff" stroke-width=".7" opacity=".5"/>`+[[18,16],[40,60],[130,22],[144,58],[112,80],[30,84]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".9" fill="#fff" opacity=".7"/>`).join(''),84),
    gust:()=>scene('gus','#d4965a','#f7dca4','#b9873f',[[24,36,70],[34,10,50],[46,30,80],[58,0,60],[70,46,64]].map(([y,x,l],k)=>`<line class="sxh-gust" style="animation-delay:${k*.4}s" x1="${x+20}" y1="${y}" x2="${x+20+l}" y2="${y}" stroke="#fff3d6" stroke-width="2.4" stroke-linecap="round"/>`).join('')+`<ellipse cx="40" cy="88" rx="30" ry="4" fill="#e8c585" opacity=".6"/><ellipse cx="120" cy="84" rx="26" ry="3.5" fill="#e8c585" opacity=".5"/>`,78),
    mover:()=>scene('mov','#c4783a','#f8d890','#8a6a3a',`<g class="sxh-slide" style="animation-direction:alternate-reverse">${pil(-20,50,52,26,'#a8844a','#dcc088')}${pil(60,50,100,26,'#a8844a','#dcc088')}</g><g class="sxh-slide">${pil(-30,68,58,24,'#c4a068','#eedcaa')}${pil(62,68,110,24,'#c4a068','#eedcaa')}</g>`),
    pulse:()=>scene('pul','#0a1f2e','#3a2a6c','#18243a',[22,54,86,118].map((x,k)=>`<g class="sxh-pulse" style="animation-delay:${k*.45}s"><rect x="${x}" y="40" width="18" height="48" fill="#3e72a8" stroke="#9ae8ff" stroke-width="1.4"/><rect x="${x}" y="40" width="18" height="5" fill="#b0ecf0"/></g>`).join(''),88),
    blink:()=>scene('bli','#02060a','#0a2a2a','#06100f',`<g stroke="#1c7a68" stroke-width=".8" opacity=".7">${[-3,-2,-1,0,1,2,3].map(k=>`<line x1="80" y1="68" x2="${80+k*50}" y2="100"/>`).join('')}<line x1="0" y1="78" x2="160" y2="78"/><line x1="0" y1="90" x2="160" y2="90"/></g>`+[[18,42,28],[62,50,24],[104,40,30]].map(([x,y,w],k)=>`<rect x="${x-2}" y="${y-2}" width="${w}" height="${72-y}" fill="none" stroke="#ff40d0" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/><rect class="sxh-blink" style="animation-delay:${-k*.9}s" x="${x}" y="${y}" width="${w-4}" height="${68-y}" fill="#0f4a42" stroke="#40ffd0" stroke-width="1.6"/>`).join(''),68),
    beam:()=>scene('bea','#050510','#2a2a3a','#0a0a0e',`<ellipse class="sxh-reticle" cx="86" cy="82" rx="16" ry="4.5" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-width="1.4"/><rect class="sxh-beam" x="74" y="0" width="24" height="82" fill="#bcd4ff" opacity=".35"/><rect class="sxh-beam" x="80" y="0" width="12" height="82" fill="#fff"/>`,76),
    orbit:()=>{const path='M44 70a36 9 0 1 0 72 0a36 9 0 1 0 -72 0';const blk=(b)=>`<g><rect x="-6" y="-26" width="12" height="26" fill="#7050ac"/><rect x="-6" y="-26" width="12" height="4" fill="#c9a8ff"/><animateMotion dur="5s" begin="${b}" repeatCount="indefinite" path="${path}"/></g>`;return scene('orb','#14081f','#3a1a52','#0c0814',`<ellipse cx="80" cy="70" rx="36" ry="9" fill="none" stroke="#c9a8ff" stroke-width="1" stroke-dasharray="3 4" opacity=".7"/><circle cx="80" cy="70" r="2.4" fill="#c9a8ff"/>${blk('0s')}${blk('-2.5s')}`,66)}
  };

  /* ================= rendering ================= */
  const lockCard=(sub)=>`<div class="sx-card locked"><div class="sx-prev"><div class="sx-lock">${svgIcon('lock')}</div></div><div class="sx-info"><div class="sx-name">UNDISCOVERED</div><div class="sx-desc">${sub}</div></div></div>`;
  function renderMaps(S,max){
    const seenHaz=new Set(HAZ.filter(h=>hazardSeen(h,S,max)).map(h=>h.id));
    let out='';
    LEVELS.forEach((L,i)=>{
      if(i>max){out+=lockCard(`Map ${String(i+1).padStart(2,'0')}`);return}
      const tags=HAZ.filter(h=>h.on(i)&&seenHaz.has(h.id)).map(h=>`<span>${esc(h.name)}</span>`).join('');
      out+=`<div class="sx-card"><div class="sx-prev">${mapSVG(i)}<span class="sx-badge">MAP ${String(i+1).padStart(2,'0')}</span></div><div class="sx-info"><div class="sx-name">${esc(L.name)}</div>${tags?`<div class="sx-tags">${tags}</div>`:`<div class="sx-desc">Open skies. Nothing special to watch for.</div>`}</div></div>`;
    });
    const hz=S.voidSeen||max>=LEVELS.length-1;
    out+=hz?`<div class="sx-card"><div class="sx-prev">${horizonSVG()}<span class="sx-badge">SPECIAL</span></div><div class="sx-info"><div class="sx-name">Event Horizon</div><div class="sx-desc">A one-time encounter at the edge of the map.</div></div></div>`:lockCard('Special encounter');
    $('sxMaps').innerHTML=out;
  }
  function renderHaz(S,max){
    $('sxHaz').innerHTML=HAZ.map(h=>{
      if(!hazardSeen(h,S,max))return lockCard('Keep flying to find it');
      const seen=mapsOf(h).filter(i=>i<=max).map(i=>LEVELS[i].name),show=seen.slice(0,3).map(n=>`<span>${esc(n)}</span>`).join('')+(seen.length>3?`<span>+${seen.length-3}</span>`:'');
      return`<div class="sx-card"><div class="sx-prev">${HZ[h.id]()}</div><div class="sx-info"><div class="sx-name">${esc(h.name)}</div><div class="sx-desc">${esc(h.text)}</div><div class="sx-tags">${show}</div></div></div>`;
    }).join('');
  }
  const CIRC=2*Math.PI*24;
  function renderAch(S){
    const c=ctx(S),fresh=new Set(unseen()),total=ACH.length,got=ACH.filter(a=>S.ach[a.id]).length;
    $('spAchCount').innerHTML=`${got}<small> / ${total}</small>`;
    const bar=$('spAchBar');bar.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.width=(got/total*100)+'%'}));
    let out='';
    CATS.forEach((cat,ci)=>{
      const list=ACH.filter(a=>a.cat===ci);if(!list.length)return;
      out+=`<div class="sx-cat"><span>${cat.toUpperCase()}</span><i>${list.filter(a=>S.ach[a.id]).length} / ${list.length}</i></div><div class="sx-achs">`;
      for(const a of list){
        const done=!!S.ach[a.id],v=Math.min(a.val(c),a.goal),p=done?1:v/a.goal,hidden=a.secret&&!done;
        const prog=done?'Unlocked':hidden?'Hidden':a.goal===1?'Locked':a.time?`${fmtT(v)} / ${fmtT(a.goal)}`:`${Math.floor(v).toLocaleString()} / ${a.goal.toLocaleString()}`;
        out+=`<div class="sx-ach${done?' done':''}${a.secret?' secret':''}" data-tier="${a.tier}"><div class="sx-medal"><svg class="ring" viewBox="0 0 52 52"><circle class="tr" cx="26" cy="26" r="24"/><circle class="pr" cx="26" cy="26" r="24" stroke-dasharray="${f1(CIRC)}" stroke-dashoffset="${f1(CIRC*(1-p))}"/></svg><div class="ico">${svgIcon(hidden?'lock':a.icon)}</div></div><div class="sx-meta"><div class="sx-aname">${hidden?'HIDDEN ACHIEVEMENT':esc(a.name)}</div><div class="sx-adesc">${hidden?'Keep flying to find out.':esc(a.desc)}</div><div class="sx-aprog">${prog}</div></div>${fresh.has(a.id)?'<span class="sx-new">NEW</span>':''}</div>`;
      }
      out+='</div>';
    });
    $('sxAch').innerHTML=out;
  }
  const countUp=(el,to,fmtFn)=>{if(calm()||to<=0){el.textContent=fmtFn(to);return}const t0=performance.now(),d=900,f=t=>{const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=fmtFn(to*e);if(k<1&&panel.classList.contains('active'))requestAnimationFrame(f);else el.textContent=fmtFn(to)};requestAnimationFrame(f)};
  function fill(){
    evaluate();
    const S=readStats(),max=mapsReached(S),total=LEVELS.length,hs=HAZ.filter(h=>hazardSeen(h,S,max)).length,got=ACH.filter(a=>S.ach[a.id]).length;
    countUp($('spBest'),state.best||0,fmtM);countUp($('spLife'),save.lifetimeMeters||0,fmtM);
    $('spRuns').textContent=S.runs.toLocaleString();$('spAir').textContent=fmtT(S.air);
    $('spUses').textContent=(S.uses.shield+S.uses.slow+S.uses.autopilot).toLocaleString();
    $('spHaz').innerHTML=`${hs}<small> / ${HAZ.length}</small>`;$('spAch').innerHTML=`${got}<small> / ${ACH.length}</small>`;
    $('spMaps').textContent=max+1;$('spMapsOf').textContent=' / '+total;
    $('spFurthest').textContent='Furthest: '+(max>=total-1?LEVELS[total-1].name:(S.voidSeen&&max>=total-2?'Event Horizon':LEVELS[max].name));
    const bar=$('spBar');bar.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.width=((max+1)/total*100)+'%'}));
    $('sxCountDisc').textContent=(max+1+hs)+' / '+(total+HAZ.length);$('sxCountAch').textContent=got+' / '+ACH.length;
    $('sxSegMapsN').textContent=(max+1)+' / '+total;$('sxSegHazN').textContent=hs+' / '+HAZ.length;
    renderMaps(S,max);renderHaz(S,max);renderAch(S);
  }

  /* ================= tabs ================= */
  const tabs=['Flight','Discovered','Ach'].map(k=>({tab:$('sxTab'+k),pane:$('sxPane'+k)}));
  const segs=[{tab:$('sxSegMaps'),pane:$('sxMaps')},{tab:$('sxSegHaz'),pane:$('sxHaz')}];
  function pick(set,idx){set.forEach((t,i)=>{const on=i===idx;t.tab.setAttribute('aria-selected',on);t.tab.tabIndex=on?0:-1;t.pane.hidden=!on})}
  function wire(set,after){set.forEach((t,i)=>{t.tab.addEventListener('click',()=>{pick(set,i);after&&after(i)});t.tab.addEventListener('keydown',e=>{let j=-1;if(e.key==='ArrowRight')j=(i+1)%set.length;else if(e.key==='ArrowLeft')j=(i+set.length-1)%set.length;if(j<0)return;e.preventDefault();pick(set,j);set[j].tab.focus();after&&after(j)})})}
  function markSeen(){const S=readStats(),ids=Object.keys(S.ach);if(ids.some(id=>!S.seen.includes(id))){S.seen=ids;writeStats()}syncDots()}
  wire(tabs,i=>{$('sxScroll').scrollTop=0;if(i===2)markSeen()});wire(segs,()=>{$('sxScroll').scrollTop=0});
  const applyCalm=()=>{const c=calm();panel.classList.toggle('sx-calm',c);panel.querySelectorAll('svg').forEach(s=>{try{c?s.pauseAnimations():s.unpauseAnimations()}catch{}})};

  const open=()=>{fill();pick(tabs,0);pick(segs,0);$('sxScroll').scrollTop=0;panel.classList.add('active');panel.setAttribute('aria-hidden','false');applyCalm()};
  const close=()=>{panel.classList.remove('active');panel.setAttribute('aria-hidden','true');syncDots()};
  btn.addEventListener('click',open);$('closeStats').addEventListener('click',close);
  panel.addEventListener('click',e=>{if(e.target===panel)close()});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('active'))close()});

  /* ================= tracking: wrap game functions, no engine edits needed ================= */
  const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function')return;window[name]=function(){return fn(orig,this,arguments)}};
  const spawned=(name,count,id)=>wrap(name,(orig,self,args)=>{let n=0;try{n=count()}catch{}const r=orig.apply(self,args);try{if(count()>n)markHazard(id)}catch{}return r});
  spawned('spawnMeteor',()=>meteors.length,'meteor');
  spawned('spawnLightning',()=>bolts.length,'lightning');
  spawned('spawnGeyser',()=>geysers.length,'geyser');
  spawned('spawnWell',()=>wells.length,'well');
  spawned('spawnBeam',()=>beams.length,'beam');
  wrap('updateGust',(orig,self,args)=>{const r=orig.apply(self,args);if(state.gustPhase==='warn')markHazard('gust');return r});
  wrap('updatePlay',(orig,self,args)=>{if(state.mode==='PLAYING'&&!state.tut)readStats().air+=args[0]||0;return orig.apply(self,args)});
  wrap('activateAbility',(orig,self,args)=>{
    const k=args[0];let before=0;try{before=state[abilityState(k).timer]||0}catch{}
    const r=orig.apply(self,args);
    try{if(!before&&!state.tut&&state[abilityState(k).timer]>0){const S=readStats();S.uses[k]=(S.uses[k]||0)+1;writeStats();evaluate()}}catch{}
    return r;
  });
  wrap('finishCrash',(orig,self,args)=>{
    const was=state.mode,r=orig.apply(self,args);
    if(was!=='DEAD'&&state.mode==='DEAD'){const S=readStats();S.runs++;evaluate();writeStats()}
    return r;
  });
  const flush=()=>{try{writeStats()}catch{}};
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
  evaluate();
  window.FFStats={open,close,evaluate,HAZ,ACH};
})();
