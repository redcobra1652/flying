// Core configuration, scene setup, rendering, controls, and shared game systems.
/* PERFORMANCE TIER: auto-detected, override with ?quality=low|med|high (remembered in localStorage) */
const PERF=(()=>{let forced=null;try{const q=new URLSearchParams(location.search).get('quality');if(q&&['low','med','high'].includes(q)){localStorage.setItem('farflight-quality',q);forced=q}else forced=localStorage.getItem('farflight-quality')}catch(e){}
  const mem=navigator.deviceMemory||8,cores=navigator.hardwareConcurrency||8,touch=matchMedia('(pointer:coarse)').matches,dpr=window.devicePixelRatio||1;
  let tier=forced;if(!tier)tier=(mem<=4||cores<=4)?'low':(touch||mem<=6||cores<=6)?'med':'high';
  const T={low:{aa:true,shadows:false,maxDpr:1,chunksAhead:3,startDpr:1},med:{aa:true,shadows:true,shadowSize:512,maxDpr:1.5,chunksAhead:4,startDpr:1},high:{aa:true,shadows:true,shadowSize:1024,maxDpr:2,chunksAhead:4,startDpr:Math.min(dpr,1.5)}}[tier];
  return {tier,...T,maxDpr:Math.min(dpr,T.maxDpr),startDpr:Math.min(dpr,T.startDpr)}})();
/* CONFIG */
const CONFIG={
  chunkSize:40,cell:2,chunksX:5,chunksAhead:PERF.chunksAhead,chunksBehind:1,baseAltitude:3.45,
  baseSpeed:21.7,maxSpeed:40,speedGain:.0006,levelBump:.8,           /* 21.7 = 1.75 x the old 12.4 start speed */
  turnAccel:44,turnDamping:4.6,maxLateral:18,collisionForgiveness:.4,planeCollisionX:1.15,planeCollisionZ:1.3,planeCollisionY:.27,crashHitStop:.08,crashDelay:1,slowMo:.3,slowMoEase:.95,transitionSeconds:3,
  levelMeters:850,visibility:108,ambientCount:180,crashPieceGravity:12,blockPopRadius:7,bestKey:'farflight-best-v1',trailLength:20,
  buildBudgetMs:3,                                                    /* max ms of chunk building per frame (smooth streaming) */
  gateStartD:100,layoutLag:110,                                       /* end of the calm run-in; metres a level's layout lags its visual change */
  fieldCols:10,fieldRows:8,                                           /* open field: column width in cells (20 m), band height in rows (16 m) */
  fieldK:.13,fieldKEnd:1.1,pinchMax:.06,                              /* column fill (see fieldPresence), its growth with difficulty, share of brutal 2.88-wide pinch edges */
  riseAheadMin:60,riseAheadMax:78,riseLead:2,riseTime:[.55,.8],       /* risers start rising 60-78 m (30+ tiles) ahead */
  meteorBlastRadius:4.2,meteorFall:[2.1,2.5]
};
/* Tunable progression and aircraft data */
const PLANES=[
 {name:'Skylark',type:'PROPELLER',desc:'A familiar red propeller plane, light on its wings.\nA steady companion for the open sky.',handling:3,visibility:3,price:0,kind:'skylark'},
 {name:'Biplane',type:'PROPELLER',desc:'A warm cream classic with twin wings.\nA little more responsive through turns.',handling:4,visibility:3,price:800,kind:'biplane'},
 {name:'Talon',type:'JET',desc:'A clean trainer with a single, calm exhaust.\nBalanced handling and clearer sight lines.',handling:5,visibility:5,price:3000,kind:'trainer'},
 {name:'F-35',type:'JET',desc:'Angular surfaces and a wide forward view.\nThe sharpest visibility in the hangar.',handling:7,visibility:10,price:8000,kind:'f35'},
 {name:'B-2',type:'JET',desc:'A quiet flying wing with broad control.\nThe most responsive aircraft available.',handling:10,visibility:8,price:16000,kind:'b2'}
];
const ABILITIES={
 shield:{name:'SHIELD',desc:'Pass through obstacles and meteor blasts.',prices:[3000,3500,6000],levels:[null,{duration:3,cooldown:50},{duration:4,cooldown:40},{duration:5,cooldown:30}]},
 slow:{name:'SLOW-MO',desc:'Ease time around you while steering stays quick.',prices:[3000,3500,6000],levels:[null,{duration:3,cooldown:50},{duration:4,cooldown:40},{duration:5,cooldown:30}]},
 autopilot:{name:'AUTOPILOT',desc:'Hands-free flight. Weaves around obstacles, rolls through tight gaps and fires Shield or Slow-Mo itself in an emergency.',prices:[3000,3500,6000],levels:[null,{duration:10,cooldown:100},{duration:15,cooldown:95},{duration:30,cooldown:20}]}
};
const ECONOMY={saveKey:'farflight-save-v2',startingCredits:0,runRate:9,runExponent:1.15,runPerMeters:100,roundTo:5,levelBase:15,levelStep:10,levelCap:120,milestones:[{meters:3000,bonus:150},{meters:8000,bonus:300},{meters:15000,bonus:500},{meters:25000,bonus:800},{meters:40000,bonus:1200},{meters:60000,bonus:1800}],repeatEvery:25000,repeatBonus:1500,perplexBonus:500,arenaBonus:750};
const LEVELS=[
 {name:'Meadow',skyTop:'#68a9c7',skyHorizon:'#c4e0d8',fog:'#b4d4d0',fogFar:145,sun:'#fff1c1',hemi:'#eaf3e8',ground:'#527f63',palette:['#527f63','#658f69','#8da678','#c7b887','#e0d0a4'],height:10,maxHeight:20,density:.32,scale:.045,gap:.18,ambient:'#f6dba3',particle:'cloud',accent:'#ff765e'},
 {name:'Spike Fields',skyTop:'#b5534e',skyHorizon:'#f0a47f',fog:'#d98672',fogFar:118,sun:'#ffd1a0',hemi:'#f0b29b',ground:'#9b5147',palette:['#85443f','#a65545','#c36c50','#d78761','#e8aa78'],height:18,maxHeight:34,density:.34,scale:.085,gap:.30,ambient:'#ffc08a',particle:'dust',accent:'#71e4ce',spikes:true},
 {name:'Night',skyTop:'#0c1538',skyHorizon:'#3a3470',fog:'#1d2147',fogFar:90,sun:'#9ba9ff',hemi:'#6a74a8',ground:'#30336a',palette:['#30336a','#3c4178','#4c5290','#6068a6','#7d89bb'],height:13,maxHeight:25,density:.36,scale:.06,gap:.25,ambient:'#abb8ff',particle:'stars',accent:'#ffbf72',glow:'#75aaff',moon:'#dceaff',hemiI:1.4},
 {name:'Neon Void',skyTop:'#0d0f2a',skyHorizon:'#4d2870',fog:'#17163b',fogFar:82,sun:'#ff55cf',hemi:'#5a54b8',ground:'#1a1c3c',palette:['#212445','#322d5e','#43337a','#574094','#7050ac'],height:16,maxHeight:30,density:.38,scale:.07,gap:.28,ambient:'#ff51dc',particle:'neon',accent:'#fff06a',glow:'#31dfff',ambientSize:.2,hemiI:1.35},
 {name:'Ice Storm',skyTop:'#a8d5e4',skyHorizon:'#e4f3ef',fog:'#cee6e9',fogFar:112,sun:'#eefeff',hemi:'#f2ffff',ground:'#719baa',palette:['#567e93','#709caf','#91bdc9','#b6d9dc','#e3eff0'],height:18,maxHeight:34,density:.4,scale:.065,gap:.27,ambient:'#dffbff',particle:'snow',accent:'#ff7b66',ambientSize:.22},
 /* ---- maps 6-14. sunI / hemiI = light intensity (defaults 2.1 / 1.2); glow = night-light colour; spikes = cone obstacles; crystals = faceted crystal clusters; moon / corona / scan = sky + screen extras ---- */
 {name:'Thunderstorm',skyTop:'#262d40',skyHorizon:'#59647c',fog:'#434d62',fogFar:92,sun:'#8a97b5',hemi:'#7d8aa8',ground:'#2d3a45',palette:['#2f3d4a','#3b4b5a','#4a5c6c','#5d7080','#748898'],height:16,maxHeight:30,density:.38,scale:.065,gap:.27,ambient:'#b8c8e8',particle:'rain',ambientSize:.11,accent:'#ffe36a',sunI:1.1,hemiI:1},
 {name:'Dune Sea',skyTop:'#d4965a',skyHorizon:'#f7dca4',fog:'#e5bd84',fogFar:100,sun:'#fff0c8',hemi:'#f6d8a8',ground:'#b9873f',palette:['#b9873f','#cf9c52','#dcb06a','#e8c585','#f1d7a2'],height:12,maxHeight:24,density:.36,scale:.05,gap:.24,ambient:'#f3d6a0',particle:'sand',ambientSize:.13,accent:'#2f8fa0'},
 {name:'Magma Fields',skyTop:'#1d0808',skyHorizon:'#a32d12',fog:'#4a1510',fogFar:90,sun:'#ff8a3c',hemi:'#a8442a',ground:'#3a1a14',palette:['#2a1210','#3d1a14','#5a261a','#7a3320','#a04a28'],height:16,maxHeight:30,density:.38,scale:.07,gap:.28,ambient:'#ff9a4a',particle:'embers',ambientSize:.17,accent:'#ffd25a',glow:'#ff7a2a',sunI:1.5},
 {name:'Blossom Valley',skyTop:'#f0a9c4',skyHorizon:'#fff0ee',fog:'#f6d6df',fogFar:130,sun:'#fff0d8',hemi:'#fff0f0',ground:'#7ea66c',palette:['#6f9a60','#86b073','#a6c487','#f2c0cc','#ffd9e2'],height:9,maxHeight:18,density:.3,scale:.045,gap:.2,ambient:'#ffc2d4',particle:'petals',ambientSize:.2,accent:'#ff5a7a'},
 {name:'Crystal Caverns',skyTop:'#0a1f2e',skyHorizon:'#3a2a6c',fog:'#14263e',fogFar:84,sun:'#9a8cff',hemi:'#4a7aa8',ground:'#18243a',palette:['#2a4a7a','#3e72a8','#56a0c8','#7ac8d8','#b0ecf0'],height:15,maxHeight:28,density:.36,scale:.06,gap:.26,ambient:'#9ae8ff',particle:'spores',ambientSize:.15,accent:'#ffb04a',glow:'#7a6aff',crystals:true,sunI:1.3,hemiI:1.1},
 {name:'Golden Ruins',skyTop:'#c4783a',skyHorizon:'#f8d890',fog:'#e0b070',fogFar:105,sun:'#ffd890',hemi:'#f2cc90',ground:'#8a6a3a',palette:['#8a6a3a','#a8844a','#c4a068','#dcc088','#eedcaa'],height:14,maxHeight:26,density:.36,scale:.055,gap:.25,ambient:'#ffe0a0',particle:'dust',ambientSize:.15,accent:'#3aa0a8'},
 {name:'Eclipse',skyTop:'#0a0a18',skyHorizon:'#8a3a18',fog:'#1a1424',fogFar:92,sun:'#ff9a50',hemi:'#5e4a78',ground:'#221f30',palette:['#2a2640','#383252','#483f66','#5d5282','#78699e'],height:16,maxHeight:30,density:.38,scale:.07,gap:.28,ambient:'#ff9a50',particle:'stars',ambientSize:.17,accent:'#ffb04a',glow:'#a86aff',moon:'#020204',corona:true,sunI:1.3,hemiI:1.15},
 {name:'Glitch Grid',skyTop:'#02060a',skyHorizon:'#0a2a2a',fog:'#04100f',fogFar:82,sun:'#40ffd0',hemi:'#1a6a6a',ground:'#06100f',palette:['#0a1a1a','#1c7a68','#164848','#1f6060','#2a8080'],height:14,maxHeight:26,density:.38,scale:.06,gap:.26,ambient:'#ff40d0',particle:'neon',ambientSize:.2,accent:'#ff40d0',glow:'#ff40d0',scan:true,sunI:1,hemiI:1},
 {name:'Solar Flare',skyTop:'#ffb86a',skyHorizon:'#fff0c8',fog:'#f6b070',fogFar:110,sun:'#fff6d0',hemi:'#ffd0a0',ground:'#9a3a14',palette:['#8a3414','#a84a1c','#c86a28','#e8903a','#f8bc6a'],height:18,maxHeight:34,density:.4,scale:.075,gap:.3,ambient:'#ffe08a',particle:'embers',ambientSize:.19,accent:'#1f6fa0'},
  /* ---- map 15: PERPLEXITY. perplex = hue-cycling visuals + warp tunnel + safe-corridor layout (see safePath). colours here are only the starting point; blendVisuals rotates them ---- */
 {name:'Perplexity',skyTop:'#000000',skyHorizon:'#1a1a1a',fog:'#0a0a0a',fogFar:88,sun:'#ffffff',hemi:'#ffffff',ground:'#000000',palette:['#000000','#080808','#101010','#000000','#161616'],height:17,maxHeight:32,density:.4,scale:.07,gap:.28,ambient:'#ffffff',particle:'warp',ambientSize:.14,accent:'#fff06a',glow:'#ffffff',sunI:1.4,hemiI:1.1,perplex:true}
];
/* per-level obstacle behaviour. rise = share of gates / scatter pillars / lane blockers that pop up out of the ground.
   meteor.every = [seconds between meteors at level start, at level end] */
const LEVEL_RULES=[
 {scatter:.85,rise:null,meteor:null},
 {scatter:1.15,rise:{gate:.30,scatter:.40,lane:.20},meteor:null},
 {scatter:1,rise:{gate:.32,scatter:.30,lane:.22},meteor:{every:[17,9]}},
 {scatter:1.1,rise:{gate:.36,scatter:.30,lane:.25},meteor:{every:[3,1.7]}},
 {scatter:1.15,rise:{gate:.34,scatter:.30,lane:.24},meteor:null},
 /* maps 6-14: each special key exists ONLY on its own map. lightning/geyser/well.every and meteor.every = [seconds at level start, at level end];
    gust.every likewise; mover = share of field bands that slide sideways (whole band together, so gaps never change), amp in m, freq in Hz;
    pulse / blink = share of formations, period in s */
 {scatter:1.1,rise:null,meteor:null,lightning:{every:[6,2.6]}},                                                                   /* 6 Thunderstorm */
 {scatter:1,rise:null,meteor:null,gust:{every:[7,4]}},                                                                            /* 7 Dune Sea */
 {scatter:1.1,rise:null,meteor:null,geyser:{every:[6,3.2]},mover:{share:.3,amp:1.4,freq:[.3,.45]}},                               /* 8 Magma Fields */
 {scatter:.9,rise:null,meteor:null,mover:{share:.4,amp:1.2,freq:[.22,.35]}},                                                      /* 9 Blossom Valley */
 {scatter:1.1,rise:null,meteor:null,pulse:{share:.35,period:[3.2,4.4]}},                                                          /* 10 Crystal Caverns */
 {scatter:1,rise:null,meteor:null,mover:{share:.5,amp:2.4,freq:[.18,.3]}},                                                        /* 11 Golden Ruins */
 {scatter:1.1,rise:null,meteor:null,well:{every:[12,7]}},                                                                         /* 12 Eclipse */
 {scatter:1.1,rise:null,meteor:null,blink:{share:.3,period:[2.6,3.4]}},                                                           /* 13 Glitch Grid */
 {scatter:1.2,rise:null,meteor:{every:[4.2,2.2]},gust:{every:[6,3.5]},mover:{share:.35,amp:1.5,freq:[.4,.6]}},                    /* 14 Solar Flare */
 /* 15 PERPLEXITY: every hazard in rotation. mover / orbit / pulse / blink are heavier, but cellEntry carves a corridor around safePath(D) so a route always exists.
    orbit = share of formations that circle their cell centre (radius in m, freq in Hz) */
 {scatter:1.25,rise:null,meteor:{every:[2.4,1.3]},lightning:{every:[3.4,1.8]},geyser:{every:[3.8,2]},well:{every:[9,6]},gust:{every:[4,2.4]},beam:{every:[17,9]},mover:{share:.55,amp:2.6,freq:[.25,.5]},pulse:{share:.3,period:[2.6,3.8]},blink:{share:.25,period:[2.4,3.2]},orbit:{share:.3,r:[1.6,2.9],freq:[.18,.38]},perplex:true}
];
/* STATE MACHINE / THREE SETUP */
const state={mode:'HOME',distance:0,worldZ:0,x:0,vx:0,bank:0,yaw:0,speed:0,timeScale:1,worldScale:1,level:0,levelStart:0,fromLevel:0,toLevel:0,transition:1,homeTime:0,clock:0,worldClock:0,crashElapsed:0,hitTimer:0,shake:0,muted:false,best:0,deadAt:0,rumble:0,meteorTimer:8,cx:0,cz:0,terrainAnim:false,spikeWeight:0,levelsReached:0,paidThisRun:0,shieldTimer:0,shieldCooldown:0,shieldSafety:0,slowTimer:0,slowCooldown:0,apTimer:0,apCooldown:0,worldScaleTarget:1,selectedPlane:0,shopTab:'abilities',hangarPulse:0};
const readBest=()=>{try{return Number(localStorage.getItem(CONFIG.bestKey))||0}catch{return state.best||0}};
const writeBest=n=>{state.best=n;try{localStorage.setItem(CONFIG.bestKey,String(n))}catch{}}
state.best=readBest();
const defaultSave=()=>({credits:ECONOMY.startingCredits,lifetimeMeters:0,milestonesClaimed:[],ownedPlanes:[0],equippedPlane:0,abilities:{shield:0,slow:0,autopilot:0}});
function loadSave(){const fallback=defaultSave();try{const raw=localStorage.getItem(ECONOMY.saveKey);if(!raw)return fallback;const x=JSON.parse(raw);if(!x||typeof x!=='object')return fallback;return {credits:Math.min(1000000000,Math.max(ECONOMY.startingCredits,Math.floor((Number.isFinite(Number(x.credits))?Number(x.credits):0)))),lifetimeMeters:Math.min(1000000000000,Math.max(0,(Number.isFinite(Number(x.lifetimeMeters))?Number(x.lifetimeMeters):0))),milestonesClaimed:Array.isArray(x.milestonesClaimed)?x.milestonesClaimed.filter(v=>Number.isInteger(v)&&v>=0&&v<1000000):[],ownedPlanes:[...new Set([0,...(Array.isArray(x.ownedPlanes)?x.ownedPlanes:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<PLANES.length)])],equippedPlane:Number.isInteger(x.equippedPlane)&&x.equippedPlane>=0&&x.equippedPlane<PLANES.length&&((Array.isArray(x.ownedPlanes)?x.ownedPlanes:[]).map(Number).includes(x.equippedPlane))?x.equippedPlane:0,abilities:{shield:Math.max(0,Math.min(3,Number(x.abilities?.shield)||0))|0,slow:Math.max(0,Math.min(3,Number(x.abilities?.slow)||0))|0,autopilot:Math.max(0,Math.min(3,Number(x.abilities?.autopilot)||0))|0}}}catch{return fallback}}
let save=loadSave();
function persistSave(){try{localStorage.setItem(ECONOMY.saveKey,JSON.stringify(save))}catch{}}
function roundTo5(n){return Math.round(n/ECONOMY.roundTo)*ECONOMY.roundTo}
function runCredits(d){return roundTo5(ECONOMY.runRate*Math.pow(Math.max(0,d)/ECONOMY.runPerMeters,ECONOMY.runExponent))}
function levelBonus(n){return Math.min(ECONOMY.levelCap,ECONOMY.levelBase+ECONOMY.levelStep*n)}
function milestoneAt(m){const fixed=ECONOMY.milestones.find(x=>m<x.meters);if(fixed)return fixed;const last=ECONOMY.milestones[ECONOMY.milestones.length-1],step=Math.floor((m-last.meters)/ECONOMY.repeatEvery)+1;return {meters:last.meters+step*ECONOMY.repeatEvery,bonus:ECONOMY.repeatBonus}}
function money(n){return Math.floor(n).toLocaleString()}
const stage=document.getElementById('stage');let renderer;try{renderer=new THREE.WebGLRenderer({antialias:PERF.aa,alpha:false,powerPreference:'high-performance',stencil:false})}catch(error){window.__farflightShowBootError?.(`WebGL could not start: ${error?.message||error}`);throw error}
let curDpr=PERF.startDpr;renderer.setPixelRatio(curDpr);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=PERF.shadows;renderer.shadowMap.type=THREE.PCFShadowMap;stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(LEVELS[0].fog,20,CONFIG.visibility);
const camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.1,320);camera.position.set(0,5.2,10.5);camera.lookAt(0,.5,-13);
const skyGeo=new THREE.SphereGeometry(210,32,18);const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(LEVELS[0].skyTop)},horizon:{value:new THREE.Color(LEVELS[0].skyHorizon)},offset:{value:.08},uPerp:{value:0},uT:{value:0},uPulse:{value:0},uFog:{value:new THREE.Color(0,0,0)}},vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 top;uniform vec3 horizon;uniform float offset;uniform float uPerp;uniform float uT;uniform float uPulse;uniform vec3 uFog;varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;float t=smoothstep(-.22,.72,h+offset);vec3 col=mix(horizon,top,t);if(uPerp>.001){vec2 p=(d.xy-vec2(0.,.1))/(1.1-d.z);float r=length(p),a=atan(p.y,p.x);float s1=sin(a*3.+log(r+.02)*5.5-uT*1.1);float s2=sin(a*5.-log(r+.02)*9.+uT*.7);float w=smoothstep(-.2,.2,s1*.7+s2*.3);float ring=sin(r*30.-uT*3.)*.5+.5;float v=w*(.78+.22*ring);v*=mix(.45,1.,uPulse);v=mix(v,v*.35+.05,smoothstep(.6,1.,s2*s2)*.0);vec3 sp=mix(uFog,vec3(v),smoothstep(-.03,.24,h));col=mix(col,sp,uPerp);}gl_FragColor=vec4(col,1.);}`});const skyDome=new THREE.Mesh(skyGeo,skyMat);scene.add(skyDome);
const hemi=new THREE.HemisphereLight(LEVELS[0].hemi,LEVELS[0].ground,1.2);scene.add(hemi);const sun=new THREE.DirectionalLight(LEVELS[0].sun,2.1);sun.position.set(-9,19,5);scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(PERF.shadowSize||512,PERF.shadowSize||512);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.bias=-.0005;
const nightLight=new THREE.PointLight(0x7edcff,0,25,2);scene.add(nightLight);
/* LOW BLOCK GROUND + OPEN OBSTACLE FIELD + SMOOTHLY STREAMED OBSTACLES */
const chunks=[],cellsPerSide=CONFIG.chunkSize/CONFIG.cell,cellTotal=cellsPerSide*cellsPerSide,CHUNK=CONFIG.chunkSize;
const colorHex=c=>new THREE.Color(c);const mixColor=(a,b,t)=>a.clone().lerp(b,t);
const groundMat=new THREE.MeshStandardMaterial({color:LEVELS[0].palette[3],roughness:1,metalness:0,flatShading:true});
const boxObstacleMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.82,flatShading:true,transparent:true,opacity:1});
const spikeObstacleMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.78,transparent:true,opacity:0});
const boxGeo=new THREE.BoxGeometry(1,1,1),spikeGeo=new THREE.ConeGeometry(.8,1,12,1,false);
/* ---- CRYSTALS (Crystal Caverns obstacles) ----
   One merged, flat-shaded geometry per obstacle: a hexagonal prism with a pointed terminus (the part the hitbox is built around, so it
   fills the obstacle's full height) plus 1-2 fat crystals sprouting beside it (2-3 crystals per obstacle, never a swarm). The base crystals are modelled in METRES
   and the vertex shader turns them back into the obstacle's unit box, so their size does not stretch with the pillar height. Per instance
   the shader also rotates the group, randomises each base crystal's height (never taller than 70% of the pillar) and the CPU varies the
   width. Everything stays inside the obstacle's footprint (circle radius .5), so collision is unchanged.
   Hue = smooth low-frequency noise across the terrain, so crystals of the same colour grow in patches and blend into neighbouring hues.
   Shimmer is all fragment shader (no per-frame CPU work) and only plays as a warning while an obstacle is about to sink or rise
   (aSpark, 0..1 per instance); idle crystals are static. */
const CRYSTAL_COLORS=['#7dff3a','#19ffe1','#2f8bff','#9b5cff','#ff3df2','#ff4f9a'].map(c=>new THREE.Color(c));   /* ordered by hue so neighbouring patches blend */
const CRYSTAL_SIDE=[   /* fat base crystals: d = distance from centre, r = radius, l = outward lean (all unit-box), hn = nominal height in metres. #2 is dropped on ~40% of obstacles, so each obstacle has 2 or 3 crystals */
 {d:.20,r:.17,l:.03,hn:6},{d:.22,r:.14,l:.03,hn:3.6}];
function makeCrystalGeo(){
  const pos=[],face=[],hnA=[],idA=[];let fid=0;
  function addCrystal(x,z,r,base,top,tipFrac,lx,lz,rot,ax,az,hn,id){
    const n=6,H=top-base,ysh=top-tipFrac*H,ctr=[x+lx*.5,(base+top)*.5,z+lz*.5];
    const ring=(y,rad)=>{const k=(y-base)/H,a=[];for(let i=0;i<n;i++){const t=rot+i/n*Math.PI*2;a.push([x+lx*k+Math.cos(t)*rad,y,z+lz*k+Math.sin(t)*rad])}return a};
    const bot=ring(base,r),sh=ring(ysh,r*.9),apex=[x+lx+ax*r,top,z+lz+az*r];
    const tri=(a,b,c)=>{   /* wind every triangle outwards (away from the crystal axis) so culling + shadows are right */
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const out=nx*((a[0]+b[0]+c[0])/3-ctr[0])+ny*((a[1]+b[1]+c[1])/3-ctr[1])+nz*((a[2]+b[2]+c[2])/3-ctr[2])>0;
      const t=out?[a,b,c]:[a,c,b];for(const v of t)pos.push(v[0],v[1],v[2]);face.push(fid,fid,fid);hnA.push(hn,hn,hn);idA.push(id,id,id)};
    for(let i=0;i<n;i++){const j=(i+1)%n;tri(bot[i],bot[j],sh[j]);tri(bot[i],sh[j],sh[i]);fid++}   /* side facet = 2 tris, one face id */
    for(let i=0;i<n;i++){const j=(i+1)%n;tri(sh[i],sh[j],apex);fid++}                                /* pointed terminus */
  }
  addCrystal(0,0,.32,-.5,.5,.10,.02,-.01,.2,.15,-.10,0,0);   /* main pillar, unit-box y (hn = 0 tells the shader not to remap it) */
  CRYSTAL_SIDE.forEach((c,i)=>{const ang=i*2.4+1,cx=Math.cos(ang),cz=Math.sin(ang);
    addCrystal(cx*c.d,cz*c.d,c.r,0,c.hn,Math.min(.45,c.r*3/c.hn),cx*c.l,cz*c.l,ang,.1*cx,.1*cz,c.hn,i+1)});   /* y in metres */
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aFace',new THREE.Float32BufferAttribute(face,1));g.setAttribute('aHn',new THREE.Float32BufferAttribute(hnA,1));g.setAttribute('aId',new THREE.Float32BufferAttribute(idA,1));g.computeVertexNormals();return g
}
const crystalGeo=makeCrystalGeo();
/* shared by the colour pass and the shadow pass so shadows match the shape */
const CRYSTAL_ATTR='attribute float aHn;attribute float aId;';
const CRYSTAL_VTX=`
float sd=fract(sin(dot(instanceMatrix[3].xz,vec2(12.9898,78.233)))*43758.5453);
float ca=cos(sd*6.2832),sa=sin(sd*6.2832);
transformed.xz=vec2(ca*position.x-sa*position.z,sa*position.x+ca*position.z);
if(aHn>0.){
  float sy=length(instanceMatrix[1].xyz);
  float m=.35+1.15*fract(sin(sd*91.7+aId*12.9898)*43758.5453);
  float f=min(m,.7*sy/aHn);
  transformed.y=-.5+position.y*f/sy;
  if(aId>1.5&&fract(sin(sd*57.3+aId*7.1)*43758.5453)<.4)transformed=vec3(0.,-.5,0.);   /* drop crystal #2 on ~40% of obstacles (collapsed to a point) */
}`;
const crystalUniforms={uTime:{value:0},uRM:{value:1}},crystalT0=performance.now();
const crystalMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.16,metalness:.1,flatShading:true,transparent:true,opacity:0});
crystalMat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=crystalUniforms.uTime;sh.uniforms.uRM=crystalUniforms.uRM;
  sh.vertexShader=sh.vertexShader
    .replace('#include <common>','#include <common>\nattribute float aSpark;attribute float aFace;varying float vSpark;varying float vFace;varying float vSeed;'+CRYSTAL_ATTR)
    .replace('#include <begin_vertex>','#include <begin_vertex>'+CRYSTAL_VTX+'\nvSpark=aSpark;vFace=aFace;vSeed=sd;');
  sh.fragmentShader=sh.fragmentShader
    .replace('#include <common>','#include <common>\nuniform float uTime;uniform float uRM;varying float vSpark;varying float vFace;varying float vSeed;')
    .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
{
  float ndv=clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.,1.);
  float fres=pow(1.-ndv,2.2);
  float fp=vFace*2.399+vSeed*6.2832;
  float fast=.5+.5*sin(uTime*22.+fp*1.7);                                 /* fast shimmer while a pulse is about to move */
  float gl=vSpark*(.3+.7*fast)*1.5*uRM;                                   /* shimmer ONLY while vSpark>0 (just before sinking / rising) */
  vec3 iri=.5+.5*cos(6.2832*(vec3(0.,.33,.67)+ndv*.8+vFace*.09)); /* prismatic rainbow on the facet edges */
  totalEmissiveRadiance+=diffuseColor.rgb*(.55+fres*.6+vSpark*.45)+iri*fres*.28+vec3(1.)*gl*.6+diffuseColor.rgb*gl*.9;
}`)
};
crystalMat.customProgramCacheKey=()=>'ff-crystal-v3';
const crystalDepthMat=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});   /* shadow pass needs the same vertex remap */
crystalDepthMat.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+CRYSTAL_ATTR).replace('#include <begin_vertex>','#include <begin_vertex>'+CRYSTAL_VTX)};
crystalDepthMat.customProgramCacheKey=()=>'ff-crystal-depth-v3';
function crystalTick(){crystalUniforms.uTime.value=(performance.now()-crystalT0)*.001;crystalUniforms.uRM.value=state.reduced?.35:1}
/* hue by position: low-frequency noise picks a spot on the hue ramp, so same-coloured crystals grow in patches that blend into their neighbours */
function crystalColorAt(x,z){
  const nB=CRYSTAL_COLORS.length-1;
  let n=noise2(x*.045+40,z*.045-17)*.7+noise2(x*.11-9,z*.11+3)*.3;
  n=clampN((n-.3)/.4+(hash2(x*.91+5,z*.77+1)-.5)*.12,0,.9999)*nB;
  const i=Math.floor(n),f=THREE.MathUtils.smoothstep(n-i,.35,.65);
  return CRYSTAL_COLORS[i].clone().lerp(CRYSTAL_COLORS[i+1],f)
}
const crystalM4=new THREE.Matrix4();
const colorDummy=new THREE.Color(),WHITE=new THREE.Color('#ffffff'),GLOWC=new THREE.Color();
function hash2(x,z){let n=Math.sin(x*127.1+z*311.7+19.19)*43758.5453;return n-Math.floor(n)}
function noise2(x,z){let ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;fx=fx*fx*(3-2*fx);fz=fz*fz*(3-2*fz);let a=hash2(ix,iz),b=hash2(ix+1,iz),c=hash2(ix,iz+1),d=hash2(ix+1,iz+1);return (a+(b-a)*fx)+((c+(d-c)*fx)-(a+(b-a)*fx))*fz}
function paramsFor(level,diff){const L=LEVELS[level];return {...L,height:L.height*(1+diff*.36),maxHeight:L.maxHeight*(1+diff*.4),density:Math.min(.48,L.density+diff*.025)}}
function groundHeight(x,z){const broad=noise2(x*.055+17,z*.055-8),ridge=noise2(x*.19-4,z*.19+13),detail=hash2(Math.floor(x/CONFIG.cell),Math.floor(z/CONFIG.cell));return .02+broad*.08+ridge*.07+detail*.2}
function terrainColor(h,level,x,z){if(LEVELS[level].perplex&&x!==undefined)return new THREE.Color().setHSL(0,0,.7+.3*hash2(Math.floor(x/10)+7,Math.floor(z/10)-3));return colorHex(LEVELS[level].palette[1])}
function setGroundBlock(chunk,i,lx,lz,sourceX,sourceZ){const ix=Math.round((sourceX+19)/2),iz=Math.round((sourceZ+19)/2),jx=(hash2(ix+203,iz+87)-.5)*.62,jz=(hash2(ix-41,iz+133)-.5)*.62,w=2.2+hash2(ix+9,iz-17)*.55,d=2.2+hash2(ix-13,iz+23)*.55,h=groundHeight(sourceX,sourceZ),dummy=chunk.groundDummy;dummy.position.set(lx+jx,h*.5,lz+jz);dummy.scale.set(w,h,d);dummy.updateMatrix();chunk.ground.setMatrixAt(i,dummy.matrix);const shade=.84+hash2(ix+57,iz-29)*.32;colorDummy.setRGB(shade,shade,shade);chunk.ground.setColorAt(i,colorDummy)}
const lerpN=THREE.MathUtils.lerp,clampN=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---- seeded randomness: every run gets its own layout ---- */
const SEED={a:0,b:0};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hashS=(ix,iz,salt)=>hash2(ix+SEED.a+salt*17.31,iz+SEED.b-salt*9.77);

/* ---- grid helpers. row iz sits at track distance D = 19 - 2*iz (forward = smaller iz) ---- */
const rowToD=iz=>19-2*iz,dToRow=D=>Math.round((19-D)/2),cellX=ix=>-19+2*ix;
function speedAtDistance(d){const progress=d/CONFIG.levelMeters;return Math.min(CONFIG.maxSpeed,CONFIG.baseSpeed+(CONFIG.maxSpeed-CONFIG.baseSpeed)*(1-Math.exp(-d*CONFIG.speedGain))+Math.floor(progress)*CONFIG.levelBump)}
function layoutLevel(D){return Math.min(LEVELS.length-1,Math.floor(Math.max(0,D-CONFIG.layoutLag)/CONFIG.levelMeters))}
function hardAt(D){return 1-Math.exp(-Math.max(0,D)/CONFIG.levelMeters/3.2)}
/* ---- what lives in a cell ---- */
function heightFactor(gx,gz){const broad=noise2(gx*.043,gz*.043);return .55+noise2(gx*.06+3,gz*.06-5)*.9+Math.pow(Math.max(0,broad-.5),1.3)*1.2}
function heightFor(f,level,diff){const p=paramsFor(level,diff);return Math.max(6.2,Math.round(Math.min(p.maxHeight,p.height*f)*2)/2)}
/* ---- the open field -------------------------------------------------------------------------------
   A pure function of (run seed, cell coordinates, D). Rows are cut into bands of FMZ rows (16 m); every band
   gets its own random sideways shift, so no lane survives from band to band. Inside a band the x axis is cut
   into columns FCW cells (20 m) wide. Between two neighbouring columns a strip of n cells (n drawn from the old
   gate-width table for the band's difficulty u) ALWAYS stays empty, and a column's formation lives only inside
   its own pads - so the clearance between any two formations holds by construction, nothing can chain into a
   wall, and every band has an opening at least every 20 m. Singles, clusters, wedges, ridges, L-shapes, pairs
   with a slot ... are picked per column by hash. Nothing here is sequential, so chunks can build in any order.
   Risers keep their final footprint, so counting them as solid never changes the clearance. */
const FIELD={cache:new Map(),seed:1};
const FCW=CONFIG.fieldCols,FMZ=CONFIG.fieldRows;
function resetField(){
  SEED.a=100+Math.floor(Math.random()*9000);SEED.b=100+Math.floor(Math.random()*9000);
  FIELD.seed=(Math.random()*4294967296)>>>0;FIELD.cache.clear()
}
function ih(a,b,c){let h=(Math.imul(a|0,0x27d4eb2d)^Math.imul(b|0,0x165667b1)^Math.imul(c|0,0x9e3779b1)^FIELD.seed)>>>0;h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return((h^(h>>>16))>>>0)/4294967296}
const fieldShift=j=>Math.floor(ih(j,0,7)*FCW);
const bandD=j=>rowToD(j*FMZ+(FMZ-1)/2);
/* ---- PERPLEXITY fairness backbone ----------------------------------------------------------------------------------
   safePath(D) = three sines of track distance (13.6 m peak amplitude, the fast one makes the lane visibly weave). Peak slope 7.5*.0085 + 4.5*.004 + 1.6*.016 = .107, so at 65 m/s (map 15 speed
   after 10 km, speed keeps growing .8 m/s per map length) it needs 7 m/s sideways. Steering can only sustain turnAccel/damping = 44/4.6 = 9.6 m/s
   (slowest plane), so the path uses 73% of that, and under 5 m/s^2 of the 44 m/s^2 steering acceleration.
   cellEntry() removes every obstacle whose WHOLE swept range (slide / orbit radius + half width + 1.3 m slack for path slope)
   comes within CORR = 2 m of the path, so there is always a lane at least 4 m wide (6.6 m beside static cells) that snakes between the obstacles, whatever phase the movers are in. */
const PERP_IDX=LEVELS.length-1,PERP_D=PERP_IDX*CONFIG.levelMeters,PERP_LAYOUT_D=PERP_D+CONFIG.layoutLag,GATE_D=PERP_D-40,CORR=2;
const SP={seed:-1,a:0,b:0,c:0};
function safePath(D){if(SP.seed!==FIELD.seed){SP.seed=FIELD.seed;SP.a=ih(1,0,901)*Math.PI*2;SP.b=ih(2,0,902)*Math.PI*2;SP.c=ih(4,0,904)*Math.PI*2}return 7.5*Math.sin(D*.0085+SP.a)+4.5*Math.sin(D*.004+SP.b)+1.6*Math.sin(D*.016+SP.c)}
function perpBlocked(e,ix,D){const sweep=(e.mv?e.mv.amp:0)+(e.orb?e.orb.r:0);return Math.abs(cellX(ix)+e.ox-safePath(D))<CORR+e.w*.5+sweep+1.3}
/* old gate-width table: n open cells (open width about 2n - .12) */
function gapCells(u,r){if(u<.22)return r<.7?4:5;if(u<.5)return r<.2?5:r<.75?4:3;if(u<.72)return r<.15?4:r<.8?3:2;return r<.1?4:r<.65?3:2}
const pinchChance=u=>CONFIG.pinchMax*clampN((u-.15)/.3,0,1);
function gapAt(j,kb,u){const n=gapCells(u,ih(j,kb,11));if(ih(j,kb,12)<pinchChance(u))return {n:2,pinch:true};return {n,pinch:false}}
/* sliding bands: a whole field band (every formation in it) shares ONE phase / direction / amplitude derived from the band index only,
   so every gap between formations keeps its exact width while the band sways. Only maps whose rules carry `mover` ever get one. */
function bandMover(j,rules){const m=rules.mover;if(!m||ih(j,0,23)>=m.share)return null;return {amp:m.amp,w:Math.PI*2*lerpN(m.freq[0],m.freq[1],ih(j,0,24)),ph:ih(j,0,25)*Math.PI*2}}
/* share of columns that hold something. Tuned so a straight line meets a formation about once per old gate interval.
   1.143 = mean of the old gate-time jitter (.9-1.25, plus 14% sweeps x1.45); FCW*FMZ*4 = area of one column-band in m^2 (a cell is 2 x 2 m) */
/* PERPLEXITY pacing: perpDens(D) swings -1 (free) .. +1 (dense) about every 870 m. Dense = more terrain, fewer hazards; free = open sky, more hazards */
function perpDens(D){if(layoutLevel(D)!==PERP_IDX)return 0;safePath(0);return clampN(1.5*Math.sin((D-PERP_LAYOUT_D)*.0072+ih(3,0,903)*Math.PI*2),-1,1)}
const perpHazMul=D=>1+.5*perpDens(D);
function fieldPresence(D,u,calmRamp){
  const lg=lerpN(1.95,1.2,u)*1.143*speedAtDistance(D);                 /* metres between old gates (mean) */
  return clampN(CONFIG.fieldK*lerpN(1,CONFIG.fieldKEnd,u)*(FCW*FMZ*4)/lg*(1+.38*perpDens(D)),.2,.92)*calmRamp
}

/* ---- formation builders. cells are [col,row], row 0 = FARTHEST row of the formation. U = usable columns ---- */
const rint=(r,a,b)=>a+Math.floor(r()*(b-a+1));
function rectCells(w,h){const c=[];for(let r=0;r<h;r++)for(let q=0;q<w;q++)c.push([q,r]);return c}
function mirrorCells(cells,w){return cells.map(([q,r])=>[w-1-q,r])}
function hashHalf(r,i){return r()<.45}
function buildShape(type,r,U,u){
  let cells,w,h,single=false,pair=null;
  switch(type){
  case 'single':cells=[[0,0]];w=1;h=1;single=true;break;
  case 'scatter':{                                              /* 2-3 singles, never two in the same lateral squeeze */
    const m=rint(r,2,3),pts=[];
    for(let t=0;t<40&&pts.length<m;t++){const q=rint(r,0,U-1),row=rint(r,0,5);
      if(pts.every(p=>Math.abs(p[1]-row)>=3||Math.abs(p[0]-q)>=5))pts.push([q,row])}
    cells=pts;w=U;h=6;single=true;break}
  case 'block':w=Math.min(U,2+(r()<.4?1:0));h=2+(r()<.5?1:0)+(r()<.25?1:0);cells=rectCells(w,h);break;
  case 'cluster':{w=Math.min(U,3+(r()<.45?1:0));h=3+(r()<.4?1:0);cells=rectCells(w,h);
    const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];cells=cells.filter(([q,row])=>!corners.some((c,i)=>c[0]===q&&c[1]===row&&hashHalf(r,i)));break}
  case 'wedge':{const hh=Math.min(rint(r,2,4),Math.floor((U+1)/2));h=hh;w=2*hh-1;cells=[];
    for(let row=0;row<hh;row++){const rw=2*row+1,q0=(w-rw)/2;for(let q=0;q<rw;q++)cells.push([q0+q,row])}
    if(hh>=3&&r()<.5)cells=cells.filter(([q,row])=>!(row===hh-1&&q===(w-1)/2));break}   /* chevron notch: 1 cell, too narrow to enter */
  case 'stagger':{const wr=U>=5&&r()<.4?3:2,off=r()<.5?1:Math.min(2,wr-1);h=rint(r,3,5);w=wr+off;cells=[];
    for(let row=0;row<h;row++){const q0=(row%2)*off;for(let q=0;q<wr;q++)cells.push([q0+q,row])}break}
  case 'ridge':{const s=U>=6&&r()<.4?2:1,thick=r()<.5;h=rint(r,3,Math.min(6,s===2?4:U-(thick?1:0)));cells=[];
    for(let row=0;row<h;row++){const q0=row*s,wr=s===2?2:(thick?2:1);for(let q=0;q<wr;q++)cells.push([q0+q,row])}
    w=(h-1)*s+(s===2?2:(thick?2:1));if(r()<.5)cells=mirrorCells(cells,w);break}
  case 'ell':{w=Math.min(U,3+(r()<.4?1:0));const b=r()<.5?1:2;h=rint(r,3,5);cells=[];
    for(let row=0;row<h-1;row++)for(let q=0;q<b;q++)cells.push([q,row]);for(let q=0;q<w;q++)cells.push([q,h-1]);
    if(r()<.5)cells=mirrorCells(cells,w);break}
  case 'clump':{w=Math.min(U,3);h=3;const set=new Set(['1,1']);cells=[[1,1]];const want=rint(r,4,6);
    for(let t=0;t<60&&cells.length<want;t++){const b=cells[Math.floor(r()*cells.length)],q=b[0]+rint(r,-1,1),row=b[1]+rint(r,-1,1);
      if(q<0||q>=w||row<0||row>=h||set.has(q+','+row))continue;set.add(q+','+row);cells.push([q,row])}break}
  case 'pair':{const ns=gapCells(u,r()),wa=rint(r,1,2),wb=rint(r,1,2);
    if(wa+ns+wb>U)return null;
    const ha=rint(r,2,4),hb=rint(r,2,4);h=Math.max(ha,hb)+(r()<.3?1:0);w=wa+ns+wb;cells=[];
    const ra=rint(r,0,h-ha),rb=rint(r,0,h-hb);
    for(let row=0;row<ha;row++)for(let q=0;q<wa;q++)cells.push([q,ra+row]);
    for(let row=0;row<hb;row++)for(let q=0;q<wb;q++)cells.push([wa+ns+q,rb+row]);
    pair={wa,ns,wb};break}
  default:return null}
  return {cells,w,h,single,pair}
}
const SHAPE_W=[['single',.15],['scatter',.08],['block',.16],['cluster',.14],['wedge',.12],['stagger',.07],['ridge',.08],['ell',.06],['pair',.09],['clump',.05]];
function pickShape(r,U,u){
  let tot=0;const w=SHAPE_W.map(([t,v])=>{const x=(t==='ridge'&&u<.1)?0:(t==='pair'&&u<.05)?0:v;tot+=x;return x});
  for(let tries=0;tries<6;tries++){
    let q=r()*tot,i=0;while(i<w.length-1&&q>w[i]){q-=w[i];i++}
    const s=buildShape(SHAPE_W[i][0],r,U,u);if(s&&s.w<=U&&s.h<=6)return s
  }
  return buildShape('block',r,U,u)
}

const FIELD_EMPTY={n:0,cells:null};
function buildMacro(j,k){
  const Dc=bandD(j),u=hardAt(Dc),rules=LEVEL_RULES[layoutLevel(Dc)];
  if(Dc<40)return FIELD_EMPTY;
  const r=mulberry32((ih(j,k,3)*4294967296)>>>0);r();r();
  const gl=gapAt(j,k,u),gr=gapAt(j,k+1,u);
  const padL=gl.n-(gl.n>>1),padR=gr.n>>1,U=FCW-padL-padR;
  const calm=Dc<CONFIG.gateStartD,ramp=calm?1:(.3+.7*THREE.MathUtils.smoothstep(Dc,CONFIG.gateStartD,CONFIG.gateStartD+140));
  const present=calm?.45:fieldPresence(Dc,u,ramp);
  if(r()>=present)return FIELD_EMPTY;
  const shape=calm?buildShape(r()<.6?'single':'scatter',r,U,u):pickShape(r,U,u);
  /* risers: singles / scatter pillars rise one by one (rise.scatter); formations rise as a whole (rise.gate). none in Meadow */
  const riseP=rules.rise?(shape.single?rules.rise.scatter:rules.rise.gate):0;
  const fRiser=!shape.single&&r()<riseP;
  const s=fieldShift(j),ix0=s+k*FCW;
  let cs=padL+Math.floor(r()*(U-shape.w+1)),flushL=false,flushR=false;
  if(gl.pinch&&gr.pinch){if(r()<.5)flushL=true;else flushR=true}else if(gl.pinch)flushL=true;else if(gr.pinch)flushR=true;
  if(flushL)cs=padL;else if(flushR)cs=padL+U-shape.w;
  if(calm){                                                     /* run-in: only far to the sides */
    const x0=cellX(ix0+cs),x1=cellX(ix0+cs+shape.w-1);
    if(!(x0>=9||x1<=-9))return FIELD_EMPTY
  }
  const cells=new Array(FCW*FMZ);let count=0;
  /* per-map dynamics (sliding / pulsing / blinking). off during the first 90 m of every map and the opening run-in. hashes only, so old maps' layouts are untouched */
  const lvlOff=((Dc-CONFIG.layoutLag)%CONFIG.levelMeters+CONFIG.levelMeters)%CONFIG.levelMeters,feat=lvlOff>=90&&!calm;
  const mvBand=feat?bandMover(j,rules):null;
  const pulseF=feat&&rules.pulse&&ih(j,k,31)<rules.pulse.share?{per:lerpN(rules.pulse.period[0],rules.pulse.period[1],ih(j,k,32)),ph:ih(j,k,33)}:null;
  const blinkF=feat&&rules.blink&&ih(j,k,36)<rules.blink.share?{per:lerpN(rules.blink.period[0],rules.blink.period[1],ih(j,k,39)),ph:ih(j,k,37)}:null;
  const orbF=feat&&!mvBand&&rules.orbit&&ih(j,k,41)<rules.orbit.share?{r:lerpN(rules.orbit.r[0],rules.orbit.r[1],ih(j,k,42)),w:Math.PI*2*lerpN(rules.orbit.freq[0],rules.orbit.freq[1],ih(j,k,43)),ph:ih(j,k,44)*Math.PI*2}:null;
  const span=FMZ-1-shape.h,rowStart=span<1?0:1+Math.floor(r()*span);   /* first row 1..span: 1 pad row at both ends of the band, no bias */
  for(const [q,row] of shape.cells){
    const lc=cs+q,lr=rowStart+row;if(lc<0||lc>=FCW||lr<0||lr>=FMZ)continue;
    let e;
    if(shape.single){const w=1.3+r()*.7,d=1.3+r()*.7;e={w,d,ox:(r()-.5)*(2-w),oz:(r()-.5)*(2-d),fm:.9+r()*.25,riser:r()<riseP}}
    else{
      let ox=0;
      if(flushL&&q===0)ox=-.5;else if(flushR&&q===shape.w-1)ox=.5;                /* brutal pinch: gap 2.88 */
      if(shape.pair&&shape.pair.ns===2&&ih(j,k,13)<pinchChance(u)*3){
        const {wa,ns}=shape.pair;if(q===wa-1)ox=.5;else if(q===wa+ns)ox=-.5
      }
      e={w:2.12,d:2.12,ox,oz:0,fm:1,riser:fRiser}
    }
    if(mvBand)e.mv=mvBand;
    if(orbF)e.orb=shape.single?{r:orbF.r,w:orbF.w,ph:ih(lc+k*FCW,lr+j*977,45)*Math.PI*2}:orbF;
    if(pulseF)e.pulse=shape.single?{per:pulseF.per,ph:ih(lc+k*FCW,lr+j*977,35)}:pulseF;
    if(blinkF)e.blink=shape.single?{per:blinkF.per,ph:ih(lc+k*FCW,lr+j*977,38)}:blinkF;
    cells[lr*FCW+lc]=e;count++
  }
  return {n:count,cells}
}
function fieldMacro(j,k){
  const key=(j+8192)*16384+(k+8192);let mc=FIELD.cache.get(key);if(mc)return mc;
  if(FIELD.cache.size>30000)FIELD.cache.clear();
  mc=buildMacro(j,k);FIELD.cache.set(key,mc);return mc
}
function cellEntry(ix,iz){
  if(state.tut)return state.tut.entry(ix,iz);
  if(rowToD(iz)<40)return null;
  {const D0=rowToD(iz);if(state.perpOK&&state.perpObstD&&D0>=PERP_D&&D0<state.perpObstD)return null}           /* Perplexity ease-in: open sky until the first obstacles */
  const j=Math.floor(iz/FMZ),s=fieldShift(j),k=Math.floor((ix-s)/FCW),mc=fieldMacro(j,k);
  if(!mc.n)return null;
  const e=mc.cells[(iz-j*FMZ)*FCW+(ix-s-k*FCW)]||null,D=rowToD(iz);
  return e&&D>=PERP_LAYOUT_D&&perpBlocked(e,ix,D)?null:e
}
function cellSpec(ix,iz,gx,gz){
  const e=cellEntry(ix,iz);if(!e)return null;
  return {riser:e.riser,width:e.w,depth:e.d,offsetX:e.ox,offsetZ:e.oz,f:heightFactor(gx,gz)*e.fm,mv:e.mv,pulse:e.pulse,blink:e.blink,orb:e.orb}
}
/* does any solid (risers included) touch the box x0..x1 (world x) by D0..D1 (track distance)? cell-level, slightly conservative */
function freeBox(x0,x1,D0,D1){
  if(state.arena)return true;
  const ixa=Math.floor((x0+19)/2)-1,ixb=Math.ceil((x1+19)/2)+1,iza=dToRow(D1)-1,izb=dToRow(D0)+1;
  for(let iz=iza;iz<=izb;iz++){
    const dd=rowToD(iz);if(dd+1.06<D0||dd-1.06>D1)continue;
    for(let ix=ixa;ix<=ixb;ix++){const cx=cellX(ix);if(cx+1.06<x0||cx-1.06>x1)continue;if(cellEntry(ix,iz))return false}
  }
  return true
}

/* ---- instances: only cells that really hold an obstacle get a slot ---- */
function setChunkInstance(chunk,r){
  const safeH=Math.max(.004,r.h),d=chunk.dummy,s=chunk.spikeDummy;
  d.position.set(r.localX+r.offsetX,r.gh+safeH*.5-.08,r.localZ+r.offsetZ);d.scale.set(r.width,safeH,r.depth);d.updateMatrix();chunk.boxMesh.setMatrixAt(r.slot,d.matrix);
  s.position.copy(d.position);s.scale.set(r.width/2,safeH,r.depth/2);s.updateMatrix();chunk.spikeMesh.setMatrixAt(r.slot,s.matrix);
  const cm=chunk.crystalMesh;
  if(!r.cc){r.cc=crystalColorAt(r.sourceX,r.sourceZ);r.wf=.8+.4*hash2(r.sourceX*1.37+11.3,r.sourceZ*.89+2.7)}   /* wf = per-crystal width variation */
  crystalM4.copy(d.matrix);crystalM4.elements[0]*=r.wf;crystalM4.elements[10]*=r.wf;cm.setMatrixAt(r.slot,crystalM4);
  cm.setColorAt(r.slot,r.cc);cm.geometry.attributes.aSpark.array[r.slot]=r.spark||0;
  const col=r.glow>.001?GLOWC.copy(r.color).lerp(WHITE,r.glow):r.color;   /* glow = telegraph tint for pulsing / blinking obstacles */
  chunk.boxMesh.setColorAt(r.slot,col);chunk.spikeMesh.setColorAt(r.slot,col)
}
/* ---- per-frame dynamics: sliding bands, breathing pillars, blinking blocks. all driven by worldClock, so Slow-Mo slows them ---- */
function smooth01(x){x=clampN(x,0,1);return x*x*(3-2*x)}
function dynRecord(ch,r,wd,init){
  const t=state.worldClock,LOW=.12;
  if(r.mv)r.offsetX=r.baseOX+r.mv.amp*Math.sin(t*r.mv.w+r.mv.ph);
  if(r.orb){r.offsetX=r.baseOX+r.orb.r*Math.cos(t*r.orb.w+r.orb.ph);r.offsetZ=r.baseOZ+r.orb.r*Math.sin(t*r.orb.w+r.orb.ph)}
  if(r.pulse&&!r.riser){
    /* 0-.1 rising | .1-.5 extended | .5-.62 retracting | .62-.85 retracted | .85-1 retracted but glowing (warning) */
    const ph=((t/r.pulse.per+r.pulse.ph)%1+1)%1;let rise,glow=0;
    if(ph<.1){rise=LOW+(1-LOW)*smooth01(ph/.1);glow=(1-ph/.1)*.9}
    else if(ph<.5)rise=1;
    else if(ph<.62)rise=1-(1-LOW)*smooth01((ph-.5)/.12);
    else if(ph<.85)rise=LOW;
    else{rise=LOW;glow=(ph-.85)/.15*.9}
    r.rise=rise;r.glow=glow;r.h=r.baseH*rise;
    /* crystal sparkle telegraph: shimmers while rising, ramps up (.30-.5) before sinking, fades as it sinks, quiet while down, ramps up again (.74-1) before rising */
    let sp;if(ph<.1)sp=1-ph/.1;else if(ph<.30)sp=0;else if(ph<.46)sp=smooth01((ph-.30)/.12);else if(ph<.5)sp=1;else if(ph<.62)sp=1-(ph-.5)/.12;else if(ph<.74)sp=0;else sp=smooth01((ph-.74)/.16);
    r.spark=sp
  }
  if(r.blink&&!r.riser){
    /* ghost = low glowing pad (harmless), solid = full block. state only flips while the block is 18+ m ahead, so nothing pops in under the plane */
    const ph=((t/r.blink.per+r.blink.ph)%1+1)%1,want=ph<.62?1:0,oz=ch.sourceZ+r.localZ+r.offsetZ+state.worldZ;
    if(init){r.bt=want;r.bs=want}else if(want!==r.bt&&oz<-18)r.bt=want;
    r.bs=clampN(r.bs+(r.bt?1:-1)*wd/.22,0,1);
    r.rise=lerpN(.07,1,smooth01(r.bs));r.glow=(1-smooth01(r.bs))*.85;r.h=r.baseH*r.rise
  }
}
function updateDynamics(wd){
  for(const ch of chunks){
    if(!ch.ready||!ch.dyn.length)continue;let col=false;
    for(const r of ch.dyn){dynRecord(ch,r,wd,false);setChunkInstance(ch,r);if(r.pulse||r.blink)col=true}
    touchChunk(ch,col)
  }
}
function touchChunk(ch,colors,force){
  ch.boxMesh.instanceMatrix.needsUpdate=true;ch.spikeMesh.instanceMatrix.needsUpdate=true;
  if(colors){if(ch.boxMesh.instanceColor)ch.boxMesh.instanceColor.needsUpdate=true;if(ch.spikeMesh.instanceColor)ch.spikeMesh.instanceColor.needsUpdate=true}
  const cm=ch.crystalMesh;if(cm.visible||force){cm.instanceMatrix.needsUpdate=true;if(colors){if(cm.instanceColor)cm.instanceColor.needsUpdate=true;cm.geometry.attributes.aSpark.needsUpdate=true}}   /* crystal buffers only upload while visible */
}

let chunkBuildCount=0;
function buildChunk(chunk,ix,iz){
  chunkBuildCount++;
  chunk.ix=ix;chunk.iz=iz;chunk.key=`${ix},${iz}`;chunk.centerX=ix*CHUNK;chunk.sourceZ=iz*CHUNK;
  const z=chunk.sourceZ+state.worldZ;chunk.ground.position.set(chunk.centerX,0,z);chunk.boxMesh.position.set(chunk.centerX,0,z);chunk.spikeMesh.position.copy(chunk.boxMesh.position);chunk.crystalMesh.position.copy(chunk.boxMesh.position);
  chunk.records=[];chunk.anim=[];chunk.dyn=[];
  const diff=Math.max(0,(state.distance-state.levelStart)/CONFIG.levelMeters),transitioning=state.fromLevel!==state.toLevel&&state.transition<1,from=transitioning?state.fromLevel:state.level,to=state.level,t=THREE.MathUtils.smoothstep(state.transition,0,1);
  let slot=0;
  for(let rz=0;rz<cellsPerSide;rz++){
    const lz=-CHUNK/2+CONFIG.cell/2+rz*CONFIG.cell,sourceZ=chunk.sourceZ+lz;
    for(let cx=0;cx<cellsPerSide;cx++){
      const lx=-CHUNK/2+CONFIG.cell/2+cx*CONFIG.cell,sourceX=chunk.centerX+lx;
      setGroundBlock(chunk,rz*cellsPerSide+cx,lx,lz,sourceX,sourceZ);
      const gix=Math.round((sourceX+19)/2),giz=Math.round((sourceZ+19)/2),spec=cellSpec(gix,giz,sourceX,sourceZ);if(!spec)continue;
      const hFrom=heightFor(spec.f,from,diff),hTo=heightFor(spec.f,to,diff),baseH=transitioning?lerpN(hFrom,hTo,t):hTo;
      const color=new THREE.Color().copy(terrainColor(0,from,sourceX,sourceZ)).lerp(terrainColor(0,to,sourceX,sourceZ),transitioning?t:1);
      const r={localX:lx,localZ:lz,sourceX,sourceZ,offsetX:spec.offsetX,baseOX:spec.offsetX,mv:spec.mv||null,pulse:spec.pulse||null,blink:spec.blink||null,orb:spec.orb||null,baseOZ:spec.offsetZ,glow:0,bs:1,bt:1,offsetZ:spec.offsetZ,width:spec.width,depth:spec.depth,f:spec.f,riser:spec.riser,gh:groundHeight(sourceX,sourceZ),slot:slot++,color,baseH,h:spec.riser?0:baseH,rise:spec.riser?0:1,done:!spec.riser,t0:-1,tj:.88+hashS(gix,giz,3)*.12,dur:lerpN(CONFIG.riseTime[0],CONFIG.riseTime[1],hashS(gix,giz,4)),startH:undefined,targetH:0,startColor:null,targetColor:null};
      if(transitioning){r.startH=hFrom;r.targetH=hTo;r.startColor=terrainColor(0,from,sourceX,sourceZ).clone();r.targetColor=terrainColor(0,to,sourceX,sourceZ).clone()}
      chunk.records.push(r);if(r.riser)chunk.anim.push(r);if(r.mv||r.pulse||r.blink||r.orb){chunk.dyn.push(r);dynRecord(chunk,r,0,true)}setChunkInstance(chunk,r)
    }
  }
  chunk.boxMesh.count=slot;chunk.spikeMesh.count=slot;chunk.crystalMesh.count=slot;
  chunk.ground.instanceMatrix.needsUpdate=true;if(chunk.ground.instanceColor)chunk.ground.instanceColor.needsUpdate=true;touchChunk(chunk,true,true);
  chunk.ready=true;chunk.ground.visible=true;chunk.boxMesh.visible=boxObstacleMat.opacity>.015;chunk.spikeMesh.visible=spikeObstacleMat.opacity>.015;chunk.crystalMesh.visible=crystalMat.opacity>.015
}
function createChunk(){
  const ground=new THREE.InstancedMesh(boxGeo,groundMat,cellTotal);ground.receiveShadow=true;ground.frustumCulled=false;
  const boxMesh=new THREE.InstancedMesh(boxGeo,boxObstacleMat,cellTotal),spikeMesh=new THREE.InstancedMesh(spikeGeo,spikeObstacleMat,cellTotal);
  const cg=crystalGeo.clone();cg.setAttribute('aSpark',new THREE.InstancedBufferAttribute(new Float32Array(cellTotal),1).setUsage(THREE.DynamicDrawUsage));
  const crystalMesh=new THREE.InstancedMesh(cg,crystalMat,cellTotal);crystalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);crystalMesh.castShadow=crystalMesh.receiveShadow=true;crystalMesh.onBeforeRender=crystalTick;crystalMesh.customDepthMaterial=crystalDepthMat;
  boxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);spikeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  boxMesh.castShadow=spikeMesh.castShadow=true;boxMesh.receiveShadow=spikeMesh.receiveShadow=true;boxMesh.frustumCulled=false;spikeMesh.frustumCulled=false;crystalMesh.frustumCulled=false;
  ground.visible=boxMesh.visible=spikeMesh.visible=crystalMesh.visible=false;
  /* real per-chunk bounds so three.js can skip off-screen chunks (also in the shadow pass). InstancedMesh defaults to unusable bounds, hence culling was off */
  for(const m of [ground,boxMesh,spikeMesh,crystalMesh])if('boundingSphere' in m){m.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,20,0),50);m.frustumCulled=true}
  const chunk={ground,boxMesh,spikeMesh,crystalMesh,mesh:boxMesh,records:[],anim:[],dyn:[],ready:false,dummy:new THREE.Object3D(),spikeDummy:new THREE.Object3D(),groundDummy:new THREE.Object3D(),key:null,ix:0,iz:0,sourceZ:0,centerX:0};
  scene.add(ground,boxMesh,spikeMesh,crystalMesh);chunks.push(chunk)
}
for(let i=0;i<CONFIG.chunksX*(CONFIG.chunksAhead+CONFIG.chunksBehind+1);i++)createChunk();

/* ---- smooth streaming: new chunks are queued and built a little each frame, nearest-ahead first ---- */
const buildQueue=[];
const chunkPriority=ch=>{const dz=state.cz-ch.iz;return (dz>=0?dz:8-dz)*10+Math.abs(ch.ix-state.cx)};
function releaseChunk(ch){ch.key=null;ch.ready=false;ch.ground.visible=ch.boxMesh.visible=ch.spikeMesh.visible=ch.crystalMesh.visible=false;ch.records=[];ch.anim=[];ch.dyn=[]}
function streamChunks(force=false){
  const cx=Math.round(state.x/CHUNK),cz=Math.round(-state.worldZ/CHUNK),halfX=(CONFIG.chunksX-1)/2,wanted=[];
  state.cx=cx;state.cz=cz;
  for(let iz=cz-CONFIG.chunksAhead;iz<=cz+CONFIG.chunksBehind;iz++)for(let ix=cx-halfX;ix<=cx+halfX;ix++)wanted.push({ix,iz,key:ix+','+iz});
  if(force){buildQueue.length=0;for(const ch of chunks)releaseChunk(ch);for(let i=0;i<wanted.length;i++)buildChunk(chunks[i],wanted[i].ix,wanted[i].iz);return}
  const keys=new Set(wanted.map(w=>w.key)),have=new Set(),free=[];
  for(const ch of chunks){if(ch.key&&keys.has(ch.key))have.add(ch.key);else{if(ch.key){const qi=buildQueue.indexOf(ch);if(qi>=0)buildQueue.splice(qi,1);releaseChunk(ch)}free.push(ch)}}
  let f=0;for(const w of wanted){if(have.has(w.key))continue;const ch=free[f++];if(!ch)break;ch.key=w.key;ch.ix=w.ix;ch.iz=w.iz;ch.ready=false;buildQueue.push(ch)}
  for(const ch of chunks)if(ch.ready){const z=ch.sourceZ+state.worldZ;ch.ground.position.z=z;ch.boxMesh.position.z=z;ch.spikeMesh.position.z=z;ch.crystalMesh.position.z=z}
}
function pumpBuildQueue(){
  if(!buildQueue.length||state.hideWorld)return;const t0=performance.now();
  do{
    let bi=0,bp=Infinity;for(let i=0;i<buildQueue.length;i++){const p=chunkPriority(buildQueue[i]);if(p<bp){bp=p;bi=i}}
    const ch=buildQueue.splice(bi,1)[0];if(ch.key)buildChunk(ch,ch.ix,ch.iz)
  }while(buildQueue.length&&performance.now()-t0<CONFIG.buildBudgetMs)
}

/* ---- level morph + rising obstacles ---- */
function transitionTerrain(level){
  const diff=Math.max(0,(state.distance-state.levelStart)/CONFIG.levelMeters),target=terrainColor(0,level);
  for(const ch of chunks)for(const r of ch.records){r.startH=r.baseH;r.targetH=heightFor(r.f,level,diff);r.startColor=(r.startColor||new THREE.Color()).copy(r.color);r.targetColor=LEVELS[level].perplex?terrainColor(0,level,r.sourceX,r.sourceZ):target}
  state.terrainAnim=true
}
function updateTerrain(){
  const t=THREE.MathUtils.smoothstep(Math.min(1,state.transition),0,1),done=state.transition>=1;
  for(const ch of chunks){
    if(!ch.ready)continue;
    for(const r of ch.records){
      if(r.startH===undefined)continue;
      r.baseH=lerpN(r.startH,r.targetH,t);r.color.copy(r.startColor).lerp(r.targetColor,t);r.h=r.baseH*r.rise;setChunkInstance(ch,r);
      if(done)r.startH=undefined
    }
    touchChunk(ch,true)
  }
  if(done)state.terrainAnim=false
}
function updateRisers(){
  const trig=clampN(state.speed*CONFIG.riseLead,CONFIG.riseAheadMin,CONFIG.riseAheadMax);
  for(const ch of chunks){
    if(!ch.ready||!ch.anim.length)continue;let dirty=false;
    for(const r of ch.anim){
      if(r.done)continue;
      const ahead=-(ch.sourceZ+r.localZ+r.offsetZ+state.worldZ);
      if(r.t0<0){if(ahead>trig*r.tj)continue;r.t0=state.worldClock}
      const p=Math.min(1,(state.worldClock-r.t0)/r.dur),q=p-1;
      r.rise=p>=1?1:1+2.2*q*q*q+1.2*q*q;r.h=r.baseH*r.rise;if(p>=1)r.done=true;
      setChunkInstance(ch,r);dirty=true
    }
    if(dirty)touchChunk(ch,false)
  }
}
function applyObstacleStyle(){
  const t=THREE.MathUtils.smoothstep(state.transition,0,1),spikeWeight=(LEVELS[state.fromLevel].spikes?1-t:0)+(LEVELS[state.toLevel].spikes?t:0),crystalWeight=(LEVELS[state.fromLevel].crystals?1-t:0)+(LEVELS[state.toLevel].crystals?t:0);
  state.spikeWeight=spikeWeight;state.crystalWeight=crystalWeight;
  const solid=Math.min(1,spikeWeight+crystalWeight);
  boxObstacleMat.opacity=1-solid;spikeObstacleMat.opacity=spikeWeight;crystalMat.opacity=crystalWeight;boxObstacleMat.depthWrite=solid<.01;spikeObstacleMat.depthWrite=spikeWeight>.99;crystalMat.depthWrite=crystalWeight>.99;
  for(const ch of chunks){
    const show=!state.hideWorld&&state.mode!=='SHOP'&&ch.ready;ch.boxMesh.visible=show&&boxObstacleMat.opacity>.015;ch.spikeMesh.visible=show&&spikeObstacleMat.opacity>.015;
    const cv=show&&crystalMat.opacity>.015;
    if(cv&&!ch.crystalMesh.visible){const cm=ch.crystalMesh;cm.instanceMatrix.needsUpdate=true;if(cm.instanceColor)cm.instanceColor.needsUpdate=true;cm.geometry.attributes.aSpark.needsUpdate=true}   /* buffers were skipped while hidden: re-upload when it fades in */
    ch.crystalMesh.visible=cv
  }
}
resetField();streamChunks(true);
/* PLANE */
const plane=new THREE.Group();scene.add(plane);const planeParts=[];let planeMat,wingMat,darkMat,prop1=null,prop2=null,jetFlames=[],wakeEmitters=[],wingWakeAnchors=[[-2.35,.08,-.12],[2.35,.08,-.12]];const planeMaterials=new Set(),planeGeometries=new Set();
function part(geo,mat,pos,scale,rot){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);if(scale)m.scale.set(...scale);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;m.userData.homePosition=m.position.clone();m.userData.homeQuaternion=m.quaternion.clone();m.userData.homeScale=m.scale.clone();m.userData.ckHide=hideInCk;plane.add(m);planeParts.push(m);planeGeometries.add(geo);planeMaterials.add(mat);return m}
function makePlaneMaterials(index){let body,wing,detail;if(index===0){body='#ff765e';wing='#f7e9d0';detail='#3f4f55'}else if(index===1){body='#d9c9a6';wing='#64b6ac';detail='#4b6663'}else if(index===2){body='#c7d4d5';wing='#edf2e9';detail='#38525f'}else if(index===3){body='#46515b';wing='#657784';detail='#222b35'}else{body='#171d22';wing='#252d32';detail='#0c1115'}const smooth=index>=2;planeMat=new THREE.MeshStandardMaterial({color:body,roughness:index===4?.92:.58,metalness:index>=3?.16:0,flatShading:!smooth});wingMat=new THREE.MeshStandardMaterial({color:wing,roughness:index===4?.94:.68,metalness:index>=3?.12:0,flatShading:!smooth});darkMat=new THREE.MeshStandardMaterial({color:detail,roughness:.65,flatShading:!smooth});planeMaterials.add(planeMat);planeMaterials.add(wingMat);planeMaterials.add(darkMat)}
function box(w,h,d,mat,pos,rot){return part(new THREE.BoxGeometry(w,h,d),mat,pos,null,rot)}
function cylinder(rt,rb,len,mat,pos,segments=8){return part(new THREE.CylinderGeometry(rt,rb,len,segments,1,false),mat,pos,[1,1,1],[Math.PI/2,0,0])}
function surfaceWing(stations,mat,side=1,centerY=0,steps=12){const positions=[],indices=[],around=12;for(const s of stations){for(let j=0;j<around;j++){const a=j/around*Math.PI*2,chord=s.trailing-s.leading;positions.push(side*s.x,centerY+Math.sin(a)*s.thickness*.5,s.leading+chord*(.5+.5*Math.cos(a)))}}for(let i=0;i<stations.length-1;i++)for(let j=0;j<around;j++){const a=i*around+j,b=i*around+(j+1)%around,c=(i+1)*around+j,d=(i+1)*around+(j+1)%around;if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();part(g,mat,[0,0,0]);}
function makeWings(stations,mat,centerY=0){surfaceWing(stations,mat,1,centerY);surfaceWing(stations,mat,-1,centerY)}
function fuselage(stations,mat,segments=20){const pos=[],idx=[];for(let i=0;i<stations.length;i++){const s=stations[i],expo=s.expo||2;for(let j=0;j<segments;j++){const a=j/segments*Math.PI*2,co=Math.cos(a),si=Math.sin(a),x=Math.sign(co)*Math.pow(Math.abs(co),2/expo),y=Math.sign(si)*Math.pow(Math.abs(si),2/expo);pos.push(x*s.w,y*s.h+(s.cy||0),s.z)}}for(let i=0;i<stations.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=(i+1)*segments+j,d=(i+1)*segments+(j+1)%segments;idx.push(a,b,c,b,d,c)}const noseCenter=pos.length/3;pos.push(0,stations[0].cy||0,stations[0].z);const tailCenter=pos.length/3;pos.push(0,stations.at(-1).cy||0,stations.at(-1).z);for(let j=0;j<segments;j++){const a=j,b=(j+1)%segments,ta=(stations.length-1)*segments+j,tb=(stations.length-1)*segments+(j+1)%segments;idx.push(noseCenter,b,a,tailCenter,ta,tb)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const wasHidden=hideInCk;hideInCk=true;const body=part(g,mat,[0,0,0]);hideInCk=wasHidden;return body}
function verticalFin(stations,mat,xSign=1,cant=0){const pos=[],idx=[],around=12;for(const s of stations){for(let j=0;j<around;j++){const a=j/around*Math.PI*2,co=Math.cos(a),si=Math.sin(a);pos.push(xSign*s.x+cant*s.y+co*s.thickness*.5,s.y,s.leading+(s.trailing-s.leading)*(.5+.5*si))}}for(let i=0;i<stations.length-1;i++)for(let j=0;j<around;j++){const a=i*around+j,b=i*around+(j+1)%around,c=(i+1)*around+j,d=(i+1)*around+(j+1)%around;if(xSign>0)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();part(g,mat,[0,0,0])}
function beam(a,b,r,mat){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),mesh=part(new THREE.CylinderGeometry(r*.78,r,delta.length(),8,1),mat,[0,0,0]);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())}
function canopy(pos,scale,matColor='#243944'){const mat=new THREE.MeshStandardMaterial({color:matColor,roughness:.22,metalness:.2});planeMaterials.add(mat);hideInCk=true;const cm=part(new THREE.SphereGeometry(1,24,16),mat,pos,scale);hideInCk=false;return cm}
function exhaustNozzle(x,y,endZ,radius,depth=.18){const sleeve=part(new THREE.CylinderGeometry(radius*.96,radius,depth,24,1,false),darkMat,[x,y,endZ-depth*.5],[1,1,1],[Math.PI/2,0,0]);const rim=part(new THREE.TorusGeometry(radius*.92,radius*.1,8,28),darkMat,[x,y,endZ]);const apertureMat=new THREE.MeshBasicMaterial({color:'#080c10',side:THREE.DoubleSide});planeMaterials.add(apertureMat);part(new THREE.CircleGeometry(radius*.78,28),apertureMat,[x,y,endZ+.002]);return {sleeve,rim}}
function makeJetFlame(pos){const group=new THREE.Group();group.position.set(...pos);plane.add(group);const outerGeo=new THREE.ConeGeometry(.22,.92,12,2,true),innerGeo=new THREE.ConeGeometry(.095,.53,12,2,true),outerMat=new THREE.MeshBasicMaterial({color:'#ff5836',transparent:true,opacity:.58,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}),innerMat=new THREE.MeshBasicMaterial({color:'#c9f1ff',transparent:true,opacity:.84,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}),outer=new THREE.Mesh(outerGeo,outerMat),inner=new THREE.Mesh(innerGeo,innerMat);outer.rotation.x=inner.rotation.x=Math.PI/2;outer.position.z=.47;inner.position.z=.27;group.add(outer,inner);planeGeometries.add(outerGeo);planeGeometries.add(innerGeo);planeMaterials.add(outerMat);planeMaterials.add(innerMat);jetFlames.push({group,mesh:outer,base:.92,kind:'outer'},{group,mesh:inner,base:.53,kind:'inner'});return group}
function addJetEmitter(pos){makeJetFlame(pos);wakeEmitters.push(new THREE.Vector3(...pos))}
/* ===================================================================================================================
   COCKPIT VIEW (first person). C toggles chase / cockpit. Each plane has its own interior, built in eye-relative
   coordinates (x right, y up, -z forward). The cockpit group is parented to the plane so it banks / rolls with it, and
   the camera sits at its origin. Instruments are live canvas textures driven by game state (ckData). Exterior parts that
   would block the view (propellers, nose blocks, upper biplane wing + struts, canopy glass) are tagged ckHide.
   =================================================================================================================== */
let hideInCk=false,cockpit=null,cockpitGauges=[],cockpitAnim=[],ckClock=0,ckTick=0;
const cockpitTex=[],ckData={hazN:0,hazKind:'',hazD:0,speed:0,alt:35,roll:0,pitch:0,hdg:0,rpm:0,vx:0,dist:0,integ:1,shield:0,slow:0,shieldCd:0,slowCd:0,autopilot:0,autopilotCd:0,level:'MEADOW'};
const ckQ=new THREE.Quaternion(),ckQ2=new THREE.Quaternion(),ckE=new THREE.Euler(),TAU=Math.PI*2;
state.cockpit=false;try{state.cockpit=localStorage.getItem('farflight-view-v1')==='cockpit'}catch{}
state.ckApplied=null;
const cockpitActive=()=>!!state.cockpit&&(state.mode==='PLAYING'||state.mode==='PAUSED');
const CK_EYE=[[0,.40,-.10],[0,.43,.10],[0,.50,-.55],[0,.53,-.62],[0,.34,-1.0]];

/* ---------- small helpers ---------- */
const ckCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ckPt=(c,r,a)=>[c+Math.sin(a)*r,c-Math.cos(a)*r];
function ckM(color,r=.7,m=0,extra){const mat=new THREE.MeshStandardMaterial({color,roughness:r,metalness:m,...extra});planeMaterials.add(mat);return mat}
function ckBasic(color,extra){const mat=new THREE.MeshBasicMaterial({color,fog:false,toneMapped:false,...extra});planeMaterials.add(mat);return mat}
function ckAdd(p,geo,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.userData.cp=true;p.add(m);planeGeometries.add(geo);return m}
const ckBox=(p,w,h,d,mat,x,y,z,rx,ry,rz)=>ckAdd(p,new THREE.BoxGeometry(w,h,d),mat,x,y,z,rx,ry,rz);
const ckCyl=(p,rt,rb,h,mat,x,y,z,rx,ry,rz,seg=20)=>ckAdd(p,new THREE.CylinderGeometry(rt,rb,h,seg),mat,x,y,z,rx,ry,rz);
const ckSph=(p,r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=ckAdd(p,new THREE.SphereGeometry(r,22,16),mat,x,y,z);m.scale.set(sx,sy,sz);return m};
function ckRod(p,a,b,r,mat){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),m=ckAdd(p,new THREE.CylinderGeometry(r,r,d.length(),10),mat);m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m}
function ckGroup(p,x,y,z,rx=0,ry=0,rz=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.set(rx,ry,rz);p.add(g);return g}
const ckTilt=(y,z)=>Math.atan2(y,-z);                 /* rotation.x that makes a board at (y,z) face the eye at the origin */
function ckArc(p,R,tube,mat,x,y,z,ry,arc=Math.PI,seg=36){const m=ckAdd(p,new THREE.TorusGeometry(R,tube,8,seg,arc),mat,x,y,z);m.scale.y=ry/R;return m}

/* ---------- live canvas textures ---------- */
function ckLive(w,h,spec){
  const c=ckCanvas(w,h),g=c.getContext('2d'),tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;cockpitTex.push(tex);
  const o={c,g,tex,w,h,spec,draw(){g.clearRect(0,0,w,h);if(spec.face)g.drawImage(spec.face,0,0,w,h);if(spec.draw)spec.draw(g,w,h);if(spec.over)g.drawImage(spec.over,0,0,w,h);if(spec.sheen)ckSheen(g,w);tex.needsUpdate=true}};
  o.draw();cockpitGauges.push(o);return o}
function ckSheen(g,s){const gr=g.createLinearGradient(0,0,s,s);gr.addColorStop(0,'rgba(255,255,255,.2)');gr.addColorStop(.36,'rgba(255,255,255,.05)');gr.addColorStop(.38,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(s/2,s/2,s/2,0,TAU);g.fill()}
function ckNeedle(g,s,a,len,wd,col,tail=.2){g.save();g.translate(s/2,s/2);g.rotate(a);g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=s*.02;g.shadowOffsetY=s*.012;g.fillStyle=col;g.beginPath();g.moveTo(-wd,s*tail*.5);g.lineTo(-wd*.45,-len*s*.5);g.lineTo(0,-len*s*.5-wd*1.6);g.lineTo(wd*.45,-len*s*.5);g.lineTo(wd,s*tail*.5);g.closePath();g.fill();g.restore()}
function ckHub(g,s,col){g.fillStyle=col;g.beginPath();g.arc(s/2,s/2,s*.04,0,TAU);g.fill();g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.arc(s/2,s/2,s*.016,0,TAU);g.fill()}
const GST_DARK={bg:'#101417',fg:'#f2efe6',tick:'#f2efe6',accent:'#ff7a4a',needle:'#f6f1e8'};
const GST_IVORY={bg:'#ece2c8',fg:'#2a2118',tick:'#2a2118',accent:'#b3341f',needle:'#17110c'};
const GST_BLACK={bg:'#07090b',fg:'#e8f1f4',tick:'#e8f1f4',accent:'#ffb347',needle:'#ffffff'};
function ckFlatFace(s,st,title){const c=ckCanvas(s,s),g=c.getContext('2d'),h=s/2;g.fillStyle=st.bg;g.beginPath();g.arc(h,h,h,0,TAU);g.fill();g.strokeStyle=st.tick;g.globalAlpha=.3;g.lineWidth=s*.012;g.beginPath();g.arc(h,h,h*.93,0,TAU);g.stroke();g.globalAlpha=.75;g.fillStyle=st.fg;g.font=`700 ${s*.06}px Manrope,system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';if(title)g.fillText(title,h,h*1.5);return c}
function ckDial(s,st,o){
  const c=ckFlatFace(s,st,''),g=c.getContext('2d'),h=s/2,span=o.a1-o.a0;
  g.strokeStyle=st.tick;g.fillStyle=st.fg;g.textAlign='center';g.textBaseline='middle';
  if(o.bands)for(const b of o.bands){g.strokeStyle=b.c;g.lineWidth=s*.03;g.beginPath();g.arc(h,h,h*.93,o.a0+span*b.a-Math.PI/2,o.a0+span*b.b-Math.PI/2);g.stroke()}
  g.strokeStyle=st.tick;
  for(let i=0;i<=o.minor;i++){const a=o.a0+span*i/o.minor,mj=i%(o.minor/o.major)===0,[x0,y0]=ckPt(h,h*(mj?.7:.8),a),[x1,y1]=ckPt(h,h*.88,a);g.lineWidth=s*(mj?.02:.009);g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke()}
  g.font=`700 ${s*(o.fs||.085)}px Manrope,system-ui,sans-serif`;
  o.labels.forEach((t,i)=>{const [x,y]=ckPt(h,h*.52,o.a0+span*i/(o.labels.length-1));g.fillText(t,x,y)});
  g.globalAlpha=.85;g.font=`800 ${s*.062}px Manrope,system-ui,sans-serif`;g.fillText(o.title,h,h*1.34);
  if(o.unit){g.globalAlpha=.55;g.font=`600 ${s*.05}px Manrope,sans-serif`;g.fillText(o.unit,h,h*1.5)}
  return c}
const CK_MINI={oil:{title:'OIL',labels:['0','50','100'],val:()=>.58+.04*Math.sin(ckClock*.7)},temp:{title:'TEMP',labels:['C','','H'],val:()=>.4+.18*clampN((ckData.speed-21)/40,0,1)+.01*Math.sin(ckClock*1.3)},fuel:{title:'FUEL',labels:['E','1/2','F'],val:()=>.9-Math.min(.55,ckData.dist/40000)},volt:{title:'VOLT',labels:['-','0','+'],val:()=>.56+.02*Math.sin(ckClock*3.1)}};
function gaugeSpec(kind,s,st){
  const h=s/2;
  if(CK_MINI[kind]){const m=CK_MINI[kind],a0=-1.1,a1=1.1;return {sheen:1,face:ckDial(s,st,{a0,a1,minor:8,major:2,labels:m.labels,title:m.title,fs:.1}),draw:g=>{ckNeedle(g,s,a0+(a1-a0)*clampN(m.val(),0,1),.78,s*.035,st.accent);ckHub(g,s,st.needle)}}}
  switch(kind){
  case 'asi':{const a0=-2.35,a1=2.35;return {sheen:1,face:ckDial(s,st,{a0,a1,minor:30,major:6,labels:['0','50','100','150','200','250','300'],title:'AIRSPEED',unit:'KM/H',fs:.075,bands:[{a:.06,b:.5,c:'#4fa36a'},{a:.5,b:.82,c:'#d9b13b'},{a:.82,b:1,c:'#d24a3a'}]}),draw:g=>{ckNeedle(g,s,a0+(a1-a0)*clampN(ckData.speed*3.6,0,300)/300,.82,s*.028,st.needle);ckHub(g,s,st.needle)}}}
  case 'alt':{const a1=TAU*.9;return {sheen:1,face:ckDial(s,st,{a0:0,a1,minor:45,major:9,labels:['0','1','2','3','4','5','6','7','8','9','0'].slice(0,10),title:'ALT',unit:'x10 M',bands:null}),draw:g=>{const v=ckData.alt/100;ckNeedle(g,s,v*TAU,.86,s*.022,st.needle);ckNeedle(g,s,((v*10)%1)*TAU,.52,s*.034,st.accent,.12);ckHub(g,s,st.needle)}}}
  case 'rpm':{const a0=-2.35,a1=2.35;return {sheen:1,face:ckDial(s,st,{a0,a1,minor:30,major:6,labels:['0','5','10','15','20','25','30'],title:'RPM',unit:'x100',fs:.08,bands:[{a:.55,b:.85,c:'#4fa36a'},{a:.9,b:1,c:'#d24a3a'}]}),draw:g=>{ckNeedle(g,s,a0+(a1-a0)*clampN(ckData.rpm/3000,0,1),.82,s*.028,st.needle);ckHub(g,s,st.needle)}}}
  case 'horizon':{
    const over=ckCanvas(s,s),o=over.getContext('2d');
    o.fillStyle=st.bg;o.beginPath();o.arc(h,h,h,0,TAU);o.arc(h,h,h*.84,0,TAU,true);o.fill();
    o.strokeStyle=st.tick;for(const deg of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){const a=deg*Math.PI/180,len=deg%30===0?.1:.06,[x0,y0]=ckPt(h,h*.84,a),[x1,y1]=ckPt(h,h*(.84-len),a);o.lineWidth=s*.012;o.beginPath();o.moveTo(x0,y0);o.lineTo(x1,y1);o.stroke()}
    o.fillStyle=st.accent;o.beginPath();o.moveTo(h,h*.2);o.lineTo(h-s*.03,h*.07);o.lineTo(h+s*.03,h*.07);o.fill();
    o.strokeStyle=st.accent;o.lineWidth=s*.032;o.lineJoin='round';o.beginPath();o.moveTo(h-s*.3,h);o.lineTo(h-s*.1,h);o.lineTo(h-s*.055,h+s*.045);o.moveTo(h+s*.3,h);o.lineTo(h+s*.1,h);o.lineTo(h+s*.055,h+s*.045);o.stroke();o.fillStyle=st.accent;o.beginPath();o.arc(h,h,s*.02,0,TAU);o.fill();
    return {sheen:1,over,draw:g=>{g.save();g.beginPath();g.arc(h,h,h*.84,0,TAU);g.clip();g.translate(h,h);g.rotate(ckData.roll);const py=ckData.pitch*s*1.2;
      g.fillStyle='#4f93c8';g.fillRect(-s,-s+py,2*s,s);g.fillStyle='#8b5e3a';g.fillRect(-s,py,2*s,s);g.strokeStyle='#fff';g.lineWidth=s*.014;g.beginPath();g.moveTo(-s,py);g.lineTo(s,py);g.stroke();
      g.lineWidth=s*.008;for(let k=1;k<=3;k++)for(const sg of [-1,1]){const y=py+sg*k*s*.12,w=k%2?s*.14:s*.24;g.beginPath();g.moveTo(-w/2,y);g.lineTo(w/2,y);g.stroke()}g.restore()}}}
  case 'compass':{
    const over=ckCanvas(s,s),o=over.getContext('2d');o.fillStyle=st.accent;o.beginPath();o.moveTo(h,h*.1);o.lineTo(h-s*.04,h*.01+s*.02);o.lineTo(h+s*.04,h*.01+s*.02);o.fill();
    o.strokeStyle=st.fg;o.lineWidth=s*.022;o.lineCap='round';o.beginPath();o.moveTo(h,h-s*.13);o.lineTo(h,h+s*.14);o.moveTo(h-s*.1,h);o.lineTo(h+s*.1,h);o.moveTo(h-s*.045,h+s*.12);o.lineTo(h+s*.045,h+s*.12);o.stroke();
    return {sheen:1,face:ckFlatFace(s,st,'HDG'),over,draw:g=>{g.save();g.translate(h,h);g.rotate(-ckData.hdg*Math.PI/180);g.strokeStyle=st.tick;g.textAlign='center';g.textBaseline='middle';
      for(let d=0;d<360;d+=5){const a=d*Math.PI/180,L=d%30===0?.12:d%10===0?.08:.04;g.lineWidth=s*(d%30===0?.014:.007);g.beginPath();g.moveTo(Math.sin(a)*h*.88,-Math.cos(a)*h*.88);g.lineTo(Math.sin(a)*h*(.88-L),-Math.cos(a)*h*(.88-L));g.stroke()}
      const lab={0:'N',90:'E',180:'S',270:'W'};for(let d=0;d<360;d+=30){const a=d*Math.PI/180,r=h*.6;g.save();g.translate(Math.sin(a)*r,-Math.cos(a)*r);g.rotate(a);g.font=`800 ${s*(lab[d]?.12:.085)}px Manrope,sans-serif`;g.fillStyle=d===0?st.accent:st.fg;g.fillText(lab[d]||String(d/10),0,0);g.restore()}g.restore()}}}
  case 'turn':{
    return {sheen:1,face:ckFlatFace(s,st,'TURN'),draw:g=>{const t=clampN(ckData.vx/18,-1,1);g.save();g.translate(h,h*.92);g.rotate(t*.55);g.strokeStyle=st.fg;g.lineWidth=s*.035;g.lineCap='round';g.beginPath();g.moveTo(-s*.32,0);g.lineTo(s*.32,0);g.moveTo(0,-s*.1);g.lineTo(0,s*.12);g.moveTo(-s*.1,s*.11);g.lineTo(s*.1,s*.11);g.stroke();g.fillStyle=st.accent;g.beginPath();g.arc(0,0,s*.04,0,TAU);g.fill();g.restore();
      g.strokeStyle=st.tick;g.lineWidth=s*.012;for(const x of [-.32,0,.32]){g.beginPath();g.moveTo(h+x*s*.8,h*.5);g.lineTo(h+x*s*.8,h*.42);g.stroke()}
      g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.roundRect(h-s*.3,h*1.58,s*.6,s*.09,s*.045);g.fill();g.fillStyle=st.fg;g.beginPath();g.arc(h+clampN(-ckData.vx*.012,-1,1)*s*.2,h*1.58+s*.045,s*.032,0,TAU);g.fill()}}}
  }
  return {draw(){}}}

/* ---------- digital screens ---------- */
const PAL_BLUE={sky1:'#1d5f9a',sky2:'#8ec7ee',gnd1:'#7a5230',gnd2:'#36241a',ink:'#e9fbff',acc:'#ffd24a',bg:'#04080c'};
const PAL_AMBER={sky1:'#26323f',sky2:'#7d8da0',gnd1:'#5a4128',gnd2:'#241a12',ink:'#ffe7bd',acc:'#ffb347',bg:'#06070a'};
function drawPFD(g,X,Y,w,h,P){
  g.save();g.translate(X,Y);g.beginPath();g.rect(0,0,w,h);g.clip();
  g.fillStyle=P.bg;g.fillRect(0,0,w,h);
  const cx=w/2,cy=h*.54,py=ckData.pitch*h*2.2;
  g.save();g.beginPath();g.rect(w*.17,h*.13,w*.66,h*.76);g.clip();g.translate(cx,cy);g.rotate(ckData.roll);
  let gr=g.createLinearGradient(0,-h+py,0,py);gr.addColorStop(0,P.sky1);gr.addColorStop(1,P.sky2);g.fillStyle=gr;g.fillRect(-w,-h*1.6+py,2*w,h*1.6);
  gr=g.createLinearGradient(0,py,0,h+py);gr.addColorStop(0,P.gnd1);gr.addColorStop(1,P.gnd2);g.fillStyle=gr;g.fillRect(-w,py,2*w,h*1.6);
  g.strokeStyle='#fff';g.lineWidth=Math.max(1.5,h*.006);g.beginPath();g.moveTo(-w,py);g.lineTo(w,py);g.stroke();
  g.font=`700 ${h*.04}px Manrope,sans-serif`;g.fillStyle='#fff';g.textBaseline='middle';
  for(let k=1;k<=4;k++)for(const sg of [-1,1]){const y=py+sg*k*h*.095,hw=(k%2?.07:.13)*w;g.beginPath();g.moveTo(-hw,y);g.lineTo(hw,y);g.stroke();if(k%2===0){g.textAlign='right';g.fillText(String(k*5),-hw-4,y);g.textAlign='left';g.fillText(String(k*5),hw+4,y)}}
  g.restore();
  g.fillStyle='rgba(0,0,0,.5)';g.fillRect(w*.02,h*.13,w*.14,h*.76);g.fillRect(w*.84,h*.13,w*.14,h*.76);g.fillRect(w*.17,h*.015,w*.66,h*.1);
  g.fillStyle=P.ink;g.strokeStyle=P.ink;g.lineWidth=Math.max(1,h*.004);g.font=`600 ${h*.042}px Manrope,sans-serif`;g.textBaseline='middle';
  const sp=ckData.speed*3.6,ppu=h*.0065;g.save();g.beginPath();g.rect(w*.02,h*.13,w*.14,h*.76);g.clip();g.textAlign='left';
  for(let v=Math.floor((sp-70)/10)*10;v<=sp+70;v+=10){const y=cy-(v-sp)*ppu;if(v<0)continue;g.beginPath();g.moveTo(w*.14,y);g.lineTo(w*.16,y);g.stroke();if(v%20===0)g.fillText(String(v),w*.035,y)}g.restore();
  const al=ckData.alt*3.28,ppa=h*.026;g.save();g.beginPath();g.rect(w*.84,h*.13,w*.14,h*.76);g.clip();g.textAlign='right';
  for(let v=Math.floor((al-26)/5)*5;v<=al+26;v+=5){const y=cy-(v-al)*ppa;g.beginPath();g.moveTo(w*.84,y);g.lineTo(w*.86,y);g.stroke();if(v%10===0)g.fillText(String(v),w*.965,y)}g.restore();
  g.fillStyle='#000';g.strokeStyle=P.acc;g.lineWidth=Math.max(1.5,h*.005);g.beginPath();g.rect(w*.015,cy-h*.04,w*.16,h*.08);g.fill();g.stroke();g.beginPath();g.rect(w*.83,cy-h*.04,w*.16,h*.08);g.fill();g.stroke();
  g.fillStyle=P.acc;g.font=`700 ${h*.05}px Manrope,sans-serif`;g.textAlign='center';g.fillText(String(Math.round(sp)),w*.095,cy);g.fillText(String(Math.round(al)),w*.91,cy);
  g.font=`600 ${h*.032}px Manrope,sans-serif`;g.fillStyle=P.ink;g.fillText('KM/H',w*.095,h*.93);g.fillText('FT',w*.91,h*.93);
  g.strokeStyle=P.ink;g.lineWidth=Math.max(1,h*.004);const hd=ckData.hdg;g.save();g.beginPath();g.rect(w*.17,h*.015,w*.66,h*.1);g.clip();
  for(let d=Math.floor((hd-40)/5)*5;d<=hd+40;d+=5){const x=cx+(d-hd)*w*.0085,mj=((d%10)+10)%10===0;g.beginPath();g.moveTo(x,h*.115);g.lineTo(x,h*(mj?.075:.095));g.stroke();if(((d%30)+30)%30===0){g.font=`600 ${h*.034}px Manrope,sans-serif`;g.fillStyle=P.ink;g.textAlign='center';g.fillText(String((((d/10)%36)+36)%36).padStart(2,'0'),x,h*.05)}}g.restore();
  g.fillStyle=P.acc;g.beginPath();g.moveTo(cx,h*.125);g.lineTo(cx-w*.012,h*.15);g.lineTo(cx+w*.012,h*.15);g.fill();
  g.strokeStyle=P.acc;g.lineWidth=Math.max(2,h*.012);g.lineJoin='round';g.beginPath();g.moveTo(cx-w*.17,cy);g.lineTo(cx-w*.06,cy);g.lineTo(cx-w*.03,cy+h*.035);g.moveTo(cx+w*.17,cy);g.lineTo(cx+w*.06,cy);g.lineTo(cx+w*.03,cy+h*.035);g.stroke();g.fillStyle=P.acc;g.fillRect(cx-2,cy-2,4,4);
  g.restore()}
function ckBar(g,x,y,w,h,f,col,label,P){g.fillStyle='rgba(255,255,255,.1)';g.fillRect(x,y,w,h);g.fillStyle=col;g.fillRect(x,y,w*clampN(f,0,1),h);g.fillStyle=P.ink;g.globalAlpha=.8;g.font=`600 ${h*1.05}px Manrope,sans-serif`;g.textAlign='left';g.textBaseline='bottom';g.fillText(label,x,y-h*.2);g.globalAlpha=1}
function drawSYS(g,X,Y,w,h,P){
  g.save();g.translate(X,Y);g.beginPath();g.rect(0,0,w,h);g.clip();g.fillStyle=P.bg;g.fillRect(0,0,w,h);
  g.fillStyle=P.acc;g.font=`800 ${h*.05}px Manrope,sans-serif`;g.textAlign='left';g.textBaseline='top';g.fillText('SYSTEMS',w*.06,h*.05);
  g.fillStyle=P.ink;g.textAlign='right';g.fillText(ckData.level.toUpperCase(),w*.94,h*.05);
  g.fillStyle=P.ink;g.textAlign='left';g.font=`500 ${h*.034}px Manrope,sans-serif`;g.globalAlpha=.6;g.fillText('DISTANCE',w*.06,h*.15);g.globalAlpha=1;g.font=`700 ${h*.11}px Manrope,sans-serif`;g.fillText(Math.floor(ckData.dist).toLocaleString()+' m',w*.06,h*.19);
  const bh=h*.03;ckBar(g,w*.06,h*.44,w*.88,bh,(ckData.speed-12)/50,P.acc,'THRUST',P);ckBar(g,w*.06,h*.53,w*.88,bh,.45+.12*clampN((ckData.speed-20)/40,0,1)+.01*Math.sin(ckClock*2),'#6fe3b0','TURBINE TEMP',P);ckBar(g,w*.06,h*.62,w*.88,bh,ckData.integ,ckData.integ>.5?'#6fe3b0':'#ff7a5a','AIRFRAME',P);
  const ab=(key,label,y)=>{const lv=save.abilities[key];let t,c;if(!lv){t='LOCKED';c='#7a8590'}else if(ckData[key]>0){t='ACTIVE';c=P.acc}else if(ckData[key+'Cd']>0){t='CHARGING '+Math.ceil(ckData[key+'Cd'])+'s';c='#ff8a6a'}else{t='READY';c='#6fe3b0'}g.fillStyle=P.ink;g.font=`600 ${h*.04}px Manrope,sans-serif`;g.textAlign='left';g.fillText(label,w*.06,y);g.fillStyle=c;g.textAlign='right';g.fillText(t,w*.94,y)};
  ab('shield','SHIELD  [Z]',h*.72);ab('slow','SLOW-MO  [X]',h*.79);ab('autopilot','AUTOPILOT  [V]',h*.86);
  g.restore()}
function ckRadar(g,X,Y,w,h,P,range=100){
  g.save();g.translate(X,Y);g.beginPath();g.rect(0,0,w,h);g.clip();g.fillStyle=P.bg;g.fillRect(0,0,w,h);
  const px=w/2,py=h*.88,sx=w/52,sy=(h*.82)/range;
  g.strokeStyle='rgba(120,255,220,.22)';g.lineWidth=1;for(let r=25;r<=range;r+=25){g.beginPath();g.moveTo(0,py-r*sy);g.lineTo(w,py-r*sy);g.stroke()}
  g.beginPath();g.moveTo(px,py);g.lineTo(px,0);g.stroke();
  const sweep=(ckClock*.9)%1;g.fillStyle='rgba(120,255,220,'+(.05+.06*(1-sweep))+')';g.fillRect(0,py-sweep*range*sy,w,h*.03);
  g.fillStyle='#7dffd0';
  for(const ch of chunks){if(!ch.ready)continue;const cz=ch.sourceZ+state.worldZ;if(cz>CHUNK||cz<-range-CHUNK)continue;for(const r of ch.records){if(r.h<3)continue;const oz=cz+r.localZ+r.offsetZ,ox=ch.centerX+r.localX+r.offsetX-state.x;if(oz>8||oz<-range||Math.abs(ox)>26)continue;const a=.35+.65*(1+oz/range);g.globalAlpha=a;g.fillRect(px+ox*sx-r.width*sx*.5,py+oz*sy-1,Math.max(2,r.width*sx),Math.max(2,r.depth*sy))}}
  g.globalAlpha=1;g.fillStyle=P.acc;g.beginPath();g.moveTo(px,py-8);g.lineTo(px-6,py+5);g.lineTo(px+6,py+5);g.closePath();g.fill();
  g.fillStyle=P.ink;g.globalAlpha=.7;g.font=`700 ${Math.max(9,h*.06)}px Manrope,sans-serif`;g.textAlign='left';g.textBaseline='top';g.fillText('FWD SCAN  '+range+' M',6,5);g.globalAlpha=1;g.restore()}
/* ---------- hazard detection (Talon centre display, B-2 right display) ---------- */
function ckScanHaz(){
  const list=[],pz=plane.position.z,add=(kind,zr)=>{if(zr-pz<8)list.push({kind,d:Math.max(0,pz-zr)})};
  for(const m of meteors)add('METEOR',m.zs+state.worldZ);
  for(const b of bolts)if(!b.struck)add('LIGHTNING',b.zs+state.worldZ);
  for(const g of geysers)add('LAVA GEYSER',g.zs+state.worldZ);
  for(const w of wells)add('GRAVITY WELL',w.zs+state.worldZ);
  for(const b of beams)if(!b.struck)add('SKY BEAM',b.zs+state.worldZ);
  list.sort((a,b)=>a.d-b.d);
  ckData.hazN=list.length;ckData.hazKind=list.length?list[0].kind:'';ckData.hazD=list.length?list[0].d:0}
function drawHazard(g,X,Y,w,h,P){
  g.save();g.translate(X,Y);g.beginPath();g.rect(0,0,w,h);g.clip();
  const alert=ckData.hazN>0,flash=state.reduced?true:Math.sin(ckClock*13)>0,cx=w/2,u=Math.min(w,h);
  g.fillStyle=alert?(flash?'#3a0a08':'#150504'):'#04100b';g.fillRect(0,0,w,h);
  const col=alert?(flash?'#ff5a40':'#c23a28'):'#6fe3b0';
  g.strokeStyle=col;g.lineWidth=Math.max(2,u*.022);g.globalAlpha=alert?1:.55;g.strokeRect(u*.035,u*.035,w-u*.07,h-u*.07);g.globalAlpha=1;
  g.fillStyle=col;g.textAlign='center';g.textBaseline='middle';
  g.font=`700 ${u*.06}px Manrope,system-ui,sans-serif`;g.globalAlpha=.8;g.fillText('HAZARD SCAN',cx,h*.13);g.globalAlpha=1;
  if(alert){
    const ty=h*.36,r=u*.15;g.lineJoin='round';g.lineWidth=u*.03;g.strokeStyle=col;
    g.beginPath();g.moveTo(cx,ty-r);g.lineTo(cx+r*1.08,ty+r*.8);g.lineTo(cx-r*1.08,ty+r*.8);g.closePath();g.stroke();
    g.font=`800 ${r*1.1}px Manrope,sans-serif`;g.fillText('!',cx,ty+r*.22);
    g.font=`800 ${u*.088}px Manrope,sans-serif`;g.fillText('HAZARD',cx,h*.64);g.fillText('DETECTED',cx,h*.75);
    g.font=`700 ${u*.058}px Manrope,sans-serif`;g.fillStyle=P.ink;g.fillText(ckData.hazKind+'  '+Math.round(ckData.hazD)+' M'+(ckData.hazN>1?'  +'+(ckData.hazN-1):''),cx,h*.88)
  }else{
    const r=u*.15,ty=h*.4;g.lineWidth=u*.03;g.lineCap='round';g.lineJoin='round';
    g.beginPath();g.arc(cx,ty,r,0,TAU);g.stroke();
    g.beginPath();g.moveTo(cx-r*.45,ty+r*.02);g.lineTo(cx-r*.1,ty+r*.38);g.lineTo(cx+r*.5,ty-r*.34);g.stroke();
    g.font=`800 ${u*.09}px Manrope,sans-serif`;g.fillText('NO HAZARDS',cx,h*.72);
    g.font=`600 ${u*.055}px Manrope,sans-serif`;g.globalAlpha=.65;g.fillText('AREA CLEAR',cx,h*.84);g.globalAlpha=1}
  g.restore()}
function drawHUD(g,w,h){
  g.clearRect(0,0,w,h);const G='#7dffb0',cx=w/2,cy=h/2;g.strokeStyle=G;g.fillStyle=G;g.shadowColor=G;g.shadowBlur=8;g.lineWidth=2.2;g.globalAlpha=.85;
  g.save();g.beginPath();g.rect(w*.1,h*.12,w*.8,h*.76);g.clip();g.translate(cx,cy);g.rotate(ckData.roll);const py=ckData.pitch*h*2;
  g.beginPath();g.moveTo(-w*.4,py);g.lineTo(-w*.09,py);g.moveTo(w*.09,py);g.lineTo(w*.4,py);g.stroke();
  g.font=`600 ${h*.04}px Manrope,sans-serif`;g.textBaseline='middle';for(let k=1;k<=3;k++)for(const sg of [-1,1]){const y=py+sg*k*h*.12;g.beginPath();g.moveTo(-w*.1,y);g.lineTo(-w*.04,y);g.moveTo(w*.04,y);g.lineTo(w*.1,y);g.stroke()}
  g.restore();
  g.beginPath();g.arc(cx,cy,w*.022,0,TAU);g.moveTo(cx-w*.06,cy);g.lineTo(cx-w*.022,cy);g.moveTo(cx+w*.022,cy);g.lineTo(cx+w*.06,cy);g.moveTo(cx,cy-w*.022);g.lineTo(cx,cy-w*.045);g.stroke();
  g.font=`700 ${h*.058}px Manrope,sans-serif`;g.textBaseline='middle';g.textAlign='right';g.fillText(String(Math.round(ckData.speed*3.6)),w*.2,cy);g.textAlign='left';g.fillText(String(Math.round(ckData.alt*3.28)),w*.8,cy);
  g.textAlign='center';g.font=`700 ${h*.048}px Manrope,sans-serif`;g.fillText(String(Math.round(((ckData.hdg%360)+360)%360)).padStart(3,'0'),cx,h*.16);
  g.font=`600 ${h*.032}px Manrope,sans-serif`;g.globalAlpha=.7;g.fillText('KM/H',w*.2-w*.04,cy+h*.06);g.fillText('FT',w*.8+w*.02,cy+h*.06);g.globalAlpha=1;g.shadowBlur=0}

/* ---------- instrument fittings ---------- */
function ckGauge(p,kind,x,y,d,st,bezel,z=.045){
  const live=ckLive(256,256,gaugeSpec(kind,256,st)),grp=ckGroup(p,x,y,0);
  ckAdd(grp,new THREE.CircleGeometry(d/2*1.1,40),ckBasic('#050607'),0,0,z-.004);
  const face=new THREE.Mesh(new THREE.CircleGeometry(d/2,48),ckBasic('#ffffff',{map:live.tex}));face.position.z=z;face.userData.cp=true;grp.add(face);planeGeometries.add(face.geometry);planeMaterials.add(face.material);
  ckAdd(grp,new THREE.TorusGeometry(d/2*1.04,d*.042,10,48),bezel,0,0,z+.004);
  return grp}
function ckScreen(p,live,x,y,w,h,z=.045,frame){
  const fr=frame||ckM('#0b0e11',.5,.3);ckBox(p,w+.016,h+.016,.014,fr,x,y,z-.005);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),ckBasic('#ffffff',{map:live.tex}));m.position.set(x,y,z+.003);m.userData.cp=true;p.add(m);planeGeometries.add(m.geometry);planeMaterials.add(m.material);return m}
function ckStick(p,x,y,z,len,grip,wood){
  const pivot=ckGroup(p,x,y,z),rod=ckM(wood?'#6a4023':'#2b3035',.6,wood?0:.5),knob=ckM(wood?'#1a1411':'#15181b',.55,.1);
  ckCyl(pivot,.013,.017,len,rod,0,len/2,0);
  if(grip==='ball')ckSph(pivot,.034,knob,0,len+.008,0);
  else{ckCyl(pivot,.026,.022,.11,knob,0,len+.02,0);ckSph(pivot,.026,knob,0,len+.075,0);ckBox(pivot,.018,.02,.03,ckBasic('#ff4a3a'),0,len+.07,-.026);ckBox(pivot,.03,.012,.012,ckM('#9aa4ad',.4,.6),0,len+.045,-.026)}
  ckCyl(pivot,.035,.04,.018,ckM('#0d0f10',.9),0,.01,0);
  const cur={rz:0,rx:0};
  cockpitAnim.push(dt=>{const tz=-clampN(ckData.vx/18,-1,1)*.28+ckData.roll*.12,tx=-.04-Math.min(.1,Math.max(0,ckData.speed-21)/180);cur.rz+=(tz-cur.rz)*Math.min(1,dt*9);cur.rx+=(tx-cur.rx)*Math.min(1,dt*5);pivot.rotation.set(cur.rx,0,cur.rz)});
  return pivot}
function ckThrottle(p,x,y,z,rail,knobCol,jet){
  const g=ckGroup(p,x,y,z),metal=ckM('#a9b2b8',.35,.8);
  ckBox(g,.05,.022,rail,ckM('#1a1d20',.6,.3),0,0,0);ckBox(g,.012,.006,rail*.86,ckBasic('#000'),0,.012,0);
  const lever=ckGroup(g,0,.01,rail*.34);ckCyl(lever,.011,.013,.12,metal,0,.06,0);
  if(jet){ckBox(lever,.03,.05,.07,ckM('#15181b',.6,.2),0,.14,0);ckBox(lever,.02,.01,.02,ckBasic(knobCol),0,.172,-.012)}else ckSph(lever,.03,ckM(knobCol,.4,.1),0,.14,0);
  cockpitAnim.push(dt=>{const f=clampN((ckData.speed-21)/44,0,1);lever.position.z=rail*(.34-.68*f);lever.rotation.x=-.25*f});
  return g}
function ckLeather(c,r=.85){return ckM(c,r,0,{flatShading:false})}
function ckWoodTexture(){
  const c=ckCanvas(512,256),g=c.getContext('2d');g.fillStyle='#8a5526';g.fillRect(0,0,512,256);
  for(let i=0;i<90;i++){const y=Math.random()*256,a=.05+Math.random()*.16;g.strokeStyle=`rgba(${Math.random()<.5?'50,25,8':'190,130,70'},${a})`;g.lineWidth=.6+Math.random()*2.4;g.beginPath();g.moveTo(0,y);for(let x=0;x<=512;x+=32)g.lineTo(x,y+Math.sin(x*.02+i)*3+Math.sin(x*.07+i*2)*1.2);g.stroke()}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;cockpitTex.push(t);return t}
/* ---------- the five interiors (eye = origin) ---------- */
function ckPropShell(o){
  /* shared open-cockpit tub: padded sides, rolled coaming, floor.  short = side walls stop behind the panel so nothing chops into the dials */
  const P=cockpit,L=o.short?.72:1.05,zc=o.short?.2:.02;
  for(const s of [-1,1]){
    ckBox(P,.04,.42,L,o.wall,s*.45,-.29,zc,0,0,-s*.09);
    ckCyl(P,.042,.042,L,o.rim,s*.465,-.085,zc,Math.PI/2,0,0);
    ckSph(P,.042,o.rim,s*.465,-.085,zc+L/2);ckSph(P,.042,o.rim,s*.465,-.085,zc-L/2);
  }
  ckBox(P,.88,.03,1.1,o.wall,0,-.5,.02);
}
function buildSkylarkCk(){
  const P=cockpit,leather=ckLeather('#4a2c1c'),rim=ckLeather('#8a5632',.65),dark=ckM('#14181b',.55,.3),chrome=ckM('#d7dddd',.22,.95);
  ckPropShell({wall:leather,rim,short:true});
  const B=ckGroup(P,0,-.225,-.45,ckTilt(-.225,-.45));
  ckBox(B,1.02,.26,.05,dark,0,0,0);ckBox(B,4,1.44,.05,leather,0,-.58,-.004);
  const bz=.032,d=.17;
  ckGauge(B,'asi',-.33,0,d,GST_DARK,chrome,bz);ckGauge(B,'horizon',-.11,0,d,GST_DARK,chrome,bz);ckGauge(B,'alt',.11,0,d,GST_DARK,chrome,bz);ckGauge(B,'rpm',.33,0,d,GST_DARK,chrome,bz);
  ckGauge(B,'oil',-.455,.05,.07,GST_DARK,chrome,bz);ckGauge(B,'fuel',.455,.05,.07,GST_DARK,chrome,bz);ckGauge(B,'temp',-.455,-.05,.07,GST_DARK,chrome,bz);ckGauge(B,'volt',.455,-.05,.07,GST_DARK,chrome,bz);
  ckBox(B,.2,.028,.008,ckM('#c9a35a',.35,.85),0,-.105,.027);
  /* slim dark coaming lip (the old body-coloured glare cover leaked the plane colour into the view) */
  ckBox(P,1.04,.02,.14,dark,0,-.105,-.58);
  ckCyl(P,.016,.016,1.04,chrome,0,-.094,-.655,0,0,Math.PI/2);
  ckStick(P,0,-.62,-.24,.36,'ball',true);
  ckThrottle(P,-.36,-.3,-.33,.2,'#d83a2a',false);
}
function buildBiplaneCk(){
  const P=cockpit,fabric=ckLeather('#cdbb92',.9),rim=ckLeather('#5a3320',.6),brass=ckM('#c0914a',.32,.9),brown=ckLeather('#3a2416',.7),dark=ckM('#141719',.5,.3);
  const wood=ckM('#ffffff',.5,0,{map:ckWoodTexture()});
  ckPropShell({wall:fabric,rim,short:true});
  const B=ckGroup(P,0,-.225,-.45,ckTilt(-.225,-.45));
  ckBox(B,1.02,.26,.05,wood,0,0,0);ckBox(B,4,1.44,.05,brown,0,-.58,-.004);
  ckBox(B,1.06,.012,.052,brass,0,.133,0);ckBox(B,1.06,.012,.052,brass,0,-.133,0);
  const bz=.032,d=.17;
  ckGauge(B,'asi',-.33,0,d,GST_IVORY,brass,bz);ckGauge(B,'alt',-.11,0,d,GST_IVORY,brass,bz);ckGauge(B,'rpm',.11,0,d,GST_IVORY,brass,bz);ckGauge(B,'compass',.33,0,d,GST_IVORY,brass,bz);
  ckGauge(B,'oil',-.455,.05,.07,GST_IVORY,brass,bz);ckGauge(B,'temp',.455,.05,.07,GST_IVORY,brass,bz);ckGauge(B,'fuel',-.455,-.05,.07,GST_IVORY,brass,bz);ckGauge(B,'turn',.455,-.05,.07,GST_IVORY,brass,bz);
  /* low, clean coaming roll below the dial tops */
  ckBox(P,1.04,.02,.14,brown,0,-.105,-.58);
  ckCyl(P,.022,.022,1.04,rim,0,-.09,-.655,0,0,Math.PI/2);
  ckStick(P,0,-.64,-.24,.36,'ball',true);
  ckThrottle(P,-.36,-.3,-.33,.2,'#ead7a6',false);
}
function ckSwitches(p,x,y,z,n,spread,rx){
  const m=ckM('#b9c1c6',.3,.8);for(let i=0;i<n;i++){const xx=x+(i-(n-1)/2)*spread;ckCyl(p,.012,.012,.012,ckM('#0d0f10',.5),xx,y,z,0,0,0,12);ckRod(p,[xx,y+.006,z],[xx,y+.04,z-.012+((i%3)-1)*.01],.005,m);ckSph(p,.007,ckBasic(i%3===0?'#ff5a3a':i%3===1?'#58f09a':'#ffd24a'),xx,y+.043,z-.012)}}
function ckLightStrip(p,x,y,z,n,gap,w){for(let i=0;i<n;i++)ckBox(p,w,.009,.006,ckBasic(['#ff6a4a','#ffd24a','#58f09a','#4acfff','#58f09a'][i%5]),x+(i-(n-1)/2)*gap,y,z)}
function ckHazScreen(B,x,y,w,h,P,z){ckScreen(B,ckLive(512,Math.round(512*h/w),{draw:(g,cw,ch)=>drawHazard(g,0,0,cw,ch,P)}),x,y,w,h,z)}
function buildTrainerCk(){
  const P=cockpit,shell=ckM('#2c343b',.65,.2),dark=ckM('#161b1f',.55,.25),pad=ckLeather('#1d2327',.8),metal=ckM('#aab3b8',.3,.85);
  for(const s of [-1,1]){
    ckBox(P,.05,.5,1.25,shell,s*.5,-.32,-.02,0,0,-s*.06);
    ckCyl(P,.024,.024,1.3,metal,s*.505,-.045,-.02,Math.PI/2,0,0);
    ckRod(P,[s*.5,-.045,-.83],[s*.5,-.11,-.54],.02,shell);
  }
  ckBox(P,1.3,.03,1.25,dark,0,-.52,-.02);
  const B=ckGroup(P,0,-.26,-.5,ckTilt(-.26,-.5));
  ckBox(B,1.06,.27,.05,dark,0,0,0);ckBox(B,1.7,.6,.05,dark,0,-.43,-.004);
  const bz=.032,dm=.125,sc=PAL_BLUE;
  ckScreen(B,ckLive(512,512,{draw:g=>drawPFD(g,0,0,512,512,sc)}),-.385,.005,.23,.23,bz);
  ckGauge(B,'asi',-.2,.0,dm,GST_BLACK,metal,bz);ckGauge(B,'alt',.2,.0,dm,GST_BLACK,metal,bz);
  ckHazScreen(B,0,.005,.2,.2,sc,bz);
  ckScreen(B,ckLive(512,512,{draw:g=>drawSYS(g,0,0,512,512,sc)}),.385,.005,.23,.23,bz);
  ckLightStrip(B,0,-.118,bz+.002,13,.06,.03);
  ckBox(P,1.12,.03,.2,pad,0,-.12,-.6);
  /* HUD combiner */
  const hud=ckLive(512,512,{draw:g=>drawHUD(g,512,512)});
  const hm=new THREE.Mesh(new THREE.PlaneGeometry(.34,.34),ckBasic('#ffffff',{map:hud.tex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));hm.position.set(0,.07,-.7);hm.rotation.x=.06;hm.userData.cp=true;hm.renderOrder=3;P.add(hm);planeGeometries.add(hm.geometry);planeMaterials.add(hm.material);
  ckRod(P,[-.17,-.03,-.7],[-.17,.19,-.7],.005,metal);ckRod(P,[.17,-.03,-.7],[.17,.19,-.7],.005,metal);ckRod(P,[-.17,-.03,-.7],[.17,-.03,-.7],.005,metal);ckRod(P,[-.17,.19,-.7],[.17,.19,-.7],.004,metal);
  /* canopy bow + mirrors */
  ckArc(P,.5,.018,shell,0,-.045,-.84,.5,Math.PI,40);
  for(const s of [-1,1]){ckBox(P,.1,.05,.012,ckM('#a8c0cc',.04,.95),s*.22,.34,-.82,0,s*.35,0);ckRod(P,[s*.22,.37,-.8],[s*.2,.43,-.8],.006,metal)}
  ckStick(P,0,-.68,-.28,.32,'grip',false);
}
function buildF35Ck(){
  const P=cockpit,shell=ckM('#363e45',.55,.35),dark=ckM('#12161a',.45,.4),pad=ckLeather('#171c20',.75),metal=ckM('#8c979e',.3,.85);
  for(const s of [-1,1]){
    ckBox(P,.045,.5,1.3,shell,s*.55,-.32,-.05,0,0,-s*.08);
    ckCyl(P,.017,.017,1.5,metal,s*.56,-.07,-.05,Math.PI/2,0,0);
    ckRod(P,[s*.56,-.07,-1.15],[s*.55,-.1,-.56],.014,shell);
  }
  ckBox(P,1.3,.03,1.3,dark,0,-.58,-.05);
  const B=ckGroup(P,0,-.25,-.5,ckTilt(-.25,-.5));
  ckBox(B,1.7,.6,.05,dark,0,-.43,-.004);
  const W=.8,H=.2,fr=ckM('#1b2126',.4,.5),bez=ckM('#59666e',.3,.85);
  ckBox(B,W+.05,H+.05,.05,dark,0,0,0);
  const sc=PAL_BLUE,PW=1024,PH=Math.round(PW*H/W),k=PW/1024,
    pano=ckLive(PW,PH,{draw:g=>{g.fillStyle='#04080c';g.fillRect(0,0,PW,PH);const a=PW*.29,c=PW*.42;drawPFD(g,0,0,a,PH,sc);ckRadar(g,a,0,c,PH,{bg:'#031014',ink:'#e9fbff',acc:'#ffd24a'},100);drawSYS(g,a+c,0,PW-a-c,PH,sc);g.strokeStyle='rgba(120,200,255,.3)';g.lineWidth=2;g.beginPath();g.moveTo(a,0);g.lineTo(a,PH);g.moveTo(a+c,0);g.lineTo(a+c,PH);g.stroke()}});
  ckScreen(B,pano,0,0,W,H,.032,fr);
  /* thin metal bezel around the display */
  ckBox(B,W+.03,.008,.012,bez,0,H/2+.012,.03);ckBox(B,W+.03,.008,.012,bez,0,-H/2-.012,.03);ckBox(B,.008,H+.03,.012,bez,-W/2-.012,0,.03);ckBox(B,.008,H+.03,.012,bez,W/2+.012,0,.03);
  ckBox(P,1.2,.026,.2,pad,0,-.115,-.6);
  ckArc(P,.56,.013,shell,0,-.075,-1.15,.62,Math.PI,44);
}
function buildB2Ck(){
  const P=cockpit,shell=ckM('#1a1f24',.8,.15),dark=ckM('#0c0f12',.6,.2),carbon=ckM('#14181c',.5,.35),amber=ckBasic('#ffb347'),metal=ckM('#7d878d',.35,.8);
  for(const s of [-1,1]){
    ckBox(P,.05,.45,1.2,shell,s*.55,-.3,.0,0,0,-s*.12);
  }
  ckBox(P,1.3,.03,1.2,dark,0,-.55,.0);
  const B=ckGroup(P,0,-.25,-.46,ckTilt(-.25,-.46));
  ckBox(B,1.14,.27,.05,carbon,0,0,0);ckBox(B,1.8,.6,.05,dark,0,-.43,-.004);
  const sc=PAL_AMBER,bz=.032;
  ckScreen(B,ckLive(512,512,{draw:g=>drawPFD(g,0,0,512,512,sc)}),-.43,.005,.235,.235,bz);
  ckScreen(B,ckLive(512,512,{draw:g=>drawSYS(g,0,0,512,512,sc)}),-.17,.005,.235,.235,bz);
  ckGauge(B,'compass',.1,0,.19,GST_BLACK,metal,bz);
  ckHazScreen(B,.34,.005,.2,.2,sc,bz);
  ckLightStrip(B,0,-.122,bz+.002,15,.065,.03);
  ckBox(P,1.2,.03,.2,dark,0,-.12,-.6);
  ckStick(P,0,-.655,-.26,.3,'grip',false);
}
/* ---------- build / reset / per-frame ---------- */
let cockpitIndex=0;
function ckReset(index){for(const t of cockpitTex)t.dispose();cockpitTex.length=0;cockpitGauges.length=0;cockpitAnim.length=0;cockpit=null;cockpitIndex=index;state.ckApplied=null}
function ckBuildNow(){
  const index=cockpitIndex;cockpitGauges.length=0;cockpitAnim.length=0;
  cockpit=new THREE.Group();cockpit.position.set(...CK_EYE[index]);cockpit.visible=false;plane.add(cockpit);
  [buildSkylarkCk,buildBiplaneCk,buildTrainerCk,buildF35Ck,buildB2Ck][index]();
  cockpit.traverse(o=>{if(o.isMesh){o.renderOrder=Math.max(o.renderOrder,50);const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)m.transparent=true}});  /* draw after the world's depth-less hazard rings so they never paint over the dash */
  state.ckApplied=null
}
const viewToast=document.getElementById('viewToast'),viewBtn=document.getElementById('viewBtn'),shieldRim=document.getElementById('shieldRim');let viewToastT=0;
function syncViewUI(toast){
  viewBtn.textContent=state.cockpit?'◉  COCKPIT':'◎  CHASE';viewBtn.setAttribute('aria-pressed',String(state.cockpit));
  if(toast){viewToast.textContent=state.cockpit?'COCKPIT VIEW':'CHASE VIEW';viewToast.classList.add('show');clearTimeout(viewToastT);viewToastT=setTimeout(()=>viewToast.classList.remove('show'),1300)}
}
function toggleView(){
  if(!['PLAYING','HOME','DEAD','PAUSED'].includes(state.mode))return;
  state.cockpit=!state.cockpit;try{localStorage.setItem('farflight-view-v1',state.cockpit?'cockpit':'chase')}catch{}
  syncViewUI(true)
}
viewBtn.addEventListener('click',e=>{e.stopPropagation();toggleView();viewBtn.blur()});syncViewUI(false);
function ckFrame(dt){
  const on=cockpitActive();
  if(on&&!cockpit)ckBuildNow();
  if(on!==state.ckApplied){state.ckApplied=on;if(cockpit)cockpit.visible=on;for(const m of planeParts)m.visible=!on}
  shieldRim.style.opacity=on&&state.shieldTimer>0?(state.shieldTimer<.8&&Math.sin(performance.now()*.035)>0?'.3':'1'):'0';
  if(!on)return;
  ckClock+=dt;
  ckData.speed=state.speed;ckData.alt=plane.position.y*10;ckData.roll=plane.rotation.z;ckData.pitch=Math.cos(state.distance*.035)*.012;ckData.vx=state.vx;
  ckData.hdg=((ckData.hdg+state.vx*dt*1.6)%360+360)%360;ckData.rpm=1500+state.speed*13+Math.sin(ckClock*31)*14;ckData.dist=state.distance;ckData.integ=state.integrity??1;
  ckData.shield=state.shieldTimer;ckData.slow=state.slowTimer;ckData.shieldCd=state.shieldCooldown;ckData.slowCd=state.slowCooldown;ckData.autopilot=state.apTimer;ckData.autopilotCd=state.apCooldown;ckData.level=LEVELS[state.level].name;
  for(const f of cockpitAnim)f(dt);
  ckScanHaz();
  ckTick-=dt;if(ckTick<=0){ckTick=1/24;for(const o of cockpitGauges)o.draw()}
}
function cockpitCamera(dt){
  plane.updateMatrixWorld(true);cockpit.updateMatrixWorld(true);
  camera.position.setFromMatrixPosition(cockpit.matrixWorld);
  plane.getWorldQuaternion(ckQ);
  if(state.reduced){ckQ2.setFromEuler(ckE.set(0,plane.rotation.y,0));ckQ.slerp(ckQ2,.4)}
  camera.quaternion.copy(ckQ);
  if(state.pw>.001)camera.rotateZ(state.pw*(state.reduced?.1:.3)*(.75*Math.sin(state.clock*.55)+.25*Math.sin(state.clock*1.3)));
  let fov=78+Math.min(6,Math.max(0,state.speed-12.4)*.16)+(1-state.worldScale)*4+(state.wellWarpS||0)*(state.reduced?4:15)+(state.pw||0)*(state.reduced?2:8)*Math.sin(state.clock*.9);
  if(camera.aspect<1.25)fov=Math.max(fov,Math.min(108,2*Math.atan(Math.tan(43*Math.PI/180)/camera.aspect)*180/Math.PI));
  camera.fov=THREE.MathUtils.lerp(camera.fov,fov,Math.min(1,dt*4));camera.near=.03;camera.updateProjectionMatrix();
  skyDome.position.copy(camera.position);ambient.position.x=state.x;sun.position.set(state.x-9,19,5);sun.target.position.set(state.x,0,0);sun.target.updateMatrixWorld();
  const sh=(state.shake+state.rumble)*.12+state.ctrlShake*.4;if(sh>0){camera.position.x+=(Math.random()-.5)*sh;camera.position.y+=(Math.random()-.5)*sh*.7}
}

function buildAircraft(index){for(const m of planeParts)plane.remove(m);planeParts.length=0;for(const c of plane.children.slice())plane.remove(c);for(const g of planeGeometries)g.dispose();for(const m of planeMaterials)m.dispose();planeGeometries.clear();planeMaterials.clear();jetFlames=[];wakeEmitters=[];makePlaneMaterials(index);prop1=prop2=null;
 if(index===0){hideInCk=true;cylinder(.31,.24,3.8,planeMat,[0,0,0],7);hideInCk=false;box(5.2,.16,1.25,wingMat,[0,.05,-.12]);box(.16,1.14,.86,planeMat,[0,.52,1.37]);box(2,.12,.64,wingMat,[0,.08,1.48]);hideInCk=true;box(.9,.12,.7,planeMat,[0,.02,-1.55]);part(new THREE.SphereGeometry(.34,8,6),new THREE.MeshStandardMaterial({color:'#243b49',roughness:.28,metalness:.2}),[0,.26,-.52],[.83,.55,1.5]);cylinder(.12,.12,.28,darkMat,[0,0,-2],8);prop1=box(.16,1.68,.1,planeMat,[0,0,-2.18]);prop2=box(1.68,.16,.1,planeMat,[0,0,-2.18]);hideInCk=false;wingWakeAnchors=[[-2.35,.07,-.12],[2.35,.07,-.12]];for(const s of [-1,1]){const light=new THREE.PointLight(0xff9b70,1.3,5,2);light.position.set(s*2.5,.04,0);plane.add(light);part(new THREE.SphereGeometry(.09,6,5),new THREE.MeshBasicMaterial({color:s===-1?'#ff5b50':'#72f4db'}),[s*2.5,.04,0])}}
 else if(index===1){fuselage([{z:-2.15,w:.07,h:.08},{z:-1.8,w:.28,h:.28},{z:-1.15,w:.34,h:.31},{z:0,w:.32,h:.29},{z:1,w:.23,h:.22},{z:1.8,w:.12,h:.15},{z:2.05,w:.04,h:.08}],planeMat);const cowl=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),planeMat);cowl.scale.set(.37,.35,.35);cowl.position.set(0,0,-1.78);plane.add(cowl);cowl.userData.ckHide=true;planeParts.push(cowl);planeGeometries.add(cowl.geometry);hideInCk=true;makeWings([{x:0,leading:-1.25,trailing:.52,thickness:.18},{x:.9,leading:-1.1,trailing:.6,thickness:.15},{x:1.9,leading:-.86,trailing:.68,thickness:.12},{x:2.55,leading:-.53,trailing:.5,thickness:.08}],wingMat,.53);hideInCk=false;makeWings([{x:0,leading:-.98,trailing:.86,thickness:.16},{x:.8,leading:-.88,trailing:.95,thickness:.13},{x:1.75,leading:-.58,trailing:1.02,thickness:.1},{x:2.25,leading:-.25,trailing:.86,thickness:.07}],wingMat,.02);hideInCk=true;for(const s of [-1,1])beam([s*.86,.12,.08],[s*.98,.53,.12],.055,darkMat),beam([s*1.55,.12,.08],[s*1.68,.53,.1],.05,darkMat);hideInCk=false;verticalFin([{x:0,y:.16,leading:.83,trailing:1.46,thickness:.15},{x:0,y:.92,leading:1.18,trailing:1.48,thickness:.1}],planeMat);makeWings([{x:0,leading:.9,trailing:1.5,thickness:.1},{x:.7,leading:.95,trailing:1.48,thickness:.08},{x:.98,leading:1.15,trailing:1.4,thickness:.05}],wingMat,.27);canopy([0,.29,-.57],[.29,.25,.55],'#25424b');hideInCk=true;cylinder(.11,.11,.3,darkMat,[0,0,-2.1],12);prop1=box(.13,1.56,.08,planeMat,[0,0,-2.28]);prop2=box(1.56,.13,.08,planeMat,[0,0,-2.28]);hideInCk=false;wingWakeAnchors=[[-2.32,.53,.34],[2.32,.53,.34]]}
 else if(index===2){fuselage([{z:-2.72,w:.035,h:.035,expo:2.2},{z:-2.45,w:.12,h:.105,expo:2.2},{z:-2.0,w:.22,h:.2,expo:2.2},{z:-1.15,w:.37,h:.32,expo:2.2},{z:-.25,w:.48,h:.39,expo:2.25},{z:.65,w:.45,h:.34,expo:2.25},{z:1.35,w:.32,h:.27,expo:2.1},{z:1.9,w:.17,h:.17},{z:2.15,w:.07,h:.09}],planeMat);makeWings([{x:0,leading:-1.6,trailing:.55,thickness:.22},{x:.7,leading:-1.42,trailing:.62,thickness:.19},{x:1.55,leading:-.98,trailing:.74,thickness:.14},{x:2.35,leading:-.38,trailing:.62,thickness:.09},{x:2.62,leading:-.02,trailing:.38,thickness:.055}],wingMat,0);makeWings([{x:0,leading:.55,trailing:1.62,thickness:.13},{x:.62,leading:.62,trailing:1.64,thickness:.11},{x:.96,leading:.82,trailing:1.53,thickness:.07}],wingMat,.12);verticalFin([{x:0,y:.26,leading:.9,trailing:1.6,thickness:.2},{x:0,y:.9,leading:1.34,trailing:1.52,thickness:.12},{x:0,y:1.02,leading:1.4,trailing:1.46,thickness:.06}],planeMat);canopy([0,.33,-.72],[.32,.27,.65],'#172a35');/* low-profile side intakes */hideInCk=true;for(const s of [-1,1])part(new THREE.SphereGeometry(1,18,12),darkMat,[s*.36,-.04,-.95],[.16,.22,.42]);hideInCk=false;exhaustNozzle(0,0,2.15,.25,.2);addJetEmitter([0,0,2.17]);wingWakeAnchors=[[-2.45,.06,.35],[2.45,.06,.35]]}
 else if(index===3){fuselage([{z:-2.75,w:.035,h:.04,expo:2.3},{z:-2.48,w:.12,h:.1,expo:2.3},{z:-1.95,w:.24,h:.2,expo:2.4},{z:-1.25,w:.42,h:.31,expo:2.5},{z:-.48,w:.55,h:.39,expo:2.5},{z:.35,w:.51,h:.36,expo:2.45},{z:1.15,w:.38,h:.29,expo:2.2},{z:1.62,w:.25,h:.22},{z:1.95,w:.12,h:.14},{z:2.08,w:.06,h:.08}],planeMat);makeWings([{x:0,leading:-1.6,trailing:.55,thickness:.23},{x:.55,leading:-1.42,trailing:.57,thickness:.2},{x:1.3,leading:-.91,trailing:.68,thickness:.15},{x:2.05,leading:-.25,trailing:.79,thickness:.1},{x:2.55,leading:.32,trailing:.66,thickness:.06}],wingMat,0);makeWings([{x:0,leading:.72,trailing:1.7,thickness:.12},{x:.68,leading:.82,trailing:1.74,thickness:.095},{x:1.03,leading:1.09,trailing:1.52,thickness:.06}],wingMat,.07);verticalFin([{x:.72,y:.07,leading:.95,trailing:1.65,thickness:.16},{x:.94,y:.66,leading:1.32,trailing:1.55,thickness:.11},{x:1.01,y:.87,leading:1.38,trailing:1.5,thickness:.06}],planeMat,1,.12);verticalFin([{x:.72,y:.07,leading:.95,trailing:1.65,thickness:.16},{x:.94,y:.66,leading:1.32,trailing:1.55,thickness:.11},{x:1.01,y:.87,leading:1.38,trailing:1.5,thickness:.06}],planeMat,-1,-.12);for(const s of [-1,1])part(new THREE.SphereGeometry(1,18,12),planeMat,[s*.75,.13,1.3],[.22,.14,.38]);canopy([0,.42,-.79],[.3,.24,.58],'#172b38');hideInCk=true;for(const s of [-1,1]){part(new THREE.SphereGeometry(1,18,12),darkMat,[s*.38,-.02,-.9],[.18,.24,.52]);}hideInCk=false;exhaustNozzle(0,0,2.08,.25,.2);addJetEmitter([0,0,2.1]);wingWakeAnchors=[[-2.36,.08,.57],[2.36,.08,.57]]}
 else {fuselage([{z:-2.25,w:.04,h:.04,expo:2.3},{z:-1.95,w:.2,h:.14,expo:2.3},{z:-1.4,w:.4,h:.23,expo:2.3},{z:-.55,w:.57,h:.26,expo:2.25},{z:.35,w:.54,h:.23,expo:2.15},{z:1.05,w:.38,h:.17,expo:2.1},{z:1.4,w:.2,h:.12},{z:1.5,w:.06,h:.06}],planeMat);makeWings([{x:0,leading:-2.12,trailing:.72,thickness:.28},{x:.48,leading:-2.04,trailing:1.08,thickness:.25},{x:.9,leading:-1.9,trailing:.63,thickness:.22},{x:1.42,leading:-1.64,trailing:1.12,thickness:.18},{x:1.95,leading:-1.23,trailing:.58,thickness:.14},{x:2.45,leading:-.69,trailing:.98,thickness:.105},{x:2.88,leading:-.12,trailing:.32,thickness:.065}],planeMat,0);canopy([0,.26,-1.25],[.27,.09,.47],'#111a20');for(const s of [-1,1]){exhaustNozzle(s*.47,0,1.14,.15,.18);addJetEmitter([s*.47,0,1.16])}wingWakeAnchors=[[-2.72,.045,.82],[2.72,.045,.82]]}
 for(const m of planeParts){m.userData.homePosition=m.position.clone();m.userData.homeQuaternion=m.quaternion.clone();m.userData.homeScale=m.scale.clone()}plane.scale.setScalar(.42);plane.userData.planeIndex=index;ckReset(index);resetJetWakeMeshes()}
const trailMat=new THREE.LineBasicMaterial({color:'#ffd0a0',transparent:true,opacity:.28,depthWrite:false});const trailLines=[];for(const s of [-1,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(90),3));const line=new THREE.Line(geo,trailMat);line.frustumCulled=false;scene.add(line);trailLines.push({line,s})}
const jetWakeMeshes=[],jetWakeGeo=new THREE.ConeGeometry(.055,.42,8,1,true);const jetWakeMaterials=Array.from({length:12},(_,i)=>new THREE.MeshBasicMaterial({color:i<3?'#ffb14f':i<7?'#ff7145':'#ef4c38',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}));function resetJetWakeMeshes(){for(const m of jetWakeMeshes)scene.remove(m.mesh);jetWakeMeshes.length=0;for(const p of wakeEmitters){for(let i=0;i<12;i++){const mesh=new THREE.Mesh(jetWakeGeo,jetWakeMaterials[i]);mesh.rotation.x=Math.PI/2;mesh.visible=false;scene.add(mesh);jetWakeMeshes.push({mesh,emitter:p,index:i})}}}
buildAircraft(save.equippedPlane);plane.position.set(0,CONFIG.baseAltitude,0);
/* AMBIENT PARTICLES */
const ambientN=CONFIG.ambientCount,ambientPositions=new Float32Array(ambientN*3),ambientSpeeds=new Float32Array(ambientN),ambientGeo=new THREE.BufferGeometry();for(let i=0;i<ambientN;i++){ambientPositions[i*3]=(Math.random()-.5)*58;ambientPositions[i*3+1]=Math.random()*22-1;ambientPositions[i*3+2]=-Math.random()*150;ambientSpeeds[i]=1+Math.random()*5}ambientGeo.setAttribute('position',new THREE.BufferAttribute(ambientPositions,3));const ambientMat=new THREE.PointsMaterial({color:LEVELS[0].ambient,size:.17,transparent:true,opacity:.6,depthWrite:false,sizeAttenuation:true});const ambient=new THREE.Points(ambientGeo,ambientMat);scene.add(ambient);const moonMat=new THREE.MeshBasicMaterial({color:'#dceaff',transparent:true,opacity:0});const moon=new THREE.Mesh(new THREE.SphereGeometry(3.1,18,14),moonMat);scene.add(moon);
/* LEVEL TRANSITIONS */
function currentLevelName(){return LEVELS[state.level].name}
function blendVisuals(dt){const old=LEVELS[state.fromLevel],next=LEVELS[state.toLevel],t=THREE.MathUtils.smoothstep(state.transition,0,1);const c=(a,b)=>mixColor(colorHex(a),colorHex(b),t),vision=1+(PLANES[save.equippedPlane].visibility-3)*.06;skyMat.uniforms.top.value.copy(c(old.skyTop,next.skyTop));skyMat.uniforms.horizon.value.copy(c(old.skyHorizon,next.skyHorizon));scene.fog.color.copy(c(old.fog,next.fog));scene.fog.far=THREE.MathUtils.lerp(old.fogFar,next.fogFar,t)*vision;hemi.color.copy(c(old.hemi,next.hemi));hemi.groundColor.copy(c(old.ground,next.ground));groundMat.color.copy(c(old.palette[3],next.palette[3]));sun.color.copy(c(old.sun,next.sun));ambientMat.color.copy(c(old.ambient,next.ambient));if(planeMat&&plane.userData.planeIndex===0)planeMat.color.copy(c(old.accent,next.accent));ambientMat.size=LEVELS[state.level].ambientSize||.16;nightLight.color.copy(c(old.glow||'#75aaff',next.glow||'#75aaff'));const glowWeight=Math.min(1,(old.glow?1-t:0)+(next.glow?t:0)),nightVision=1+(PLANES[save.equippedPlane].visibility-3)*.035;nightLight.intensity=glowWeight*1.1*nightVision;nightLight.distance=25+(nightVision-1)*12;nightLight.position.set(state.x,3.5,-6);hemi.intensity=lerpN(old.hemiI??1.2,next.hemiI??1.2,t)+state.skyFlash*1.4;sun.intensity=lerpN(old.sunI??2.1,next.sunI??2.1,t);renderer.toneMappingExposure=1.12+state.skyFlash*.35;scanEl.style.opacity=String(Math.min(1,(old.scan?1-t:0)+(next.scan?t:0))*.55);applyObstacleStyle()}
function startLevelTransition(next){state.fromLevel=state.level;state.toLevel=next;state.level=next;state.levelStart=state.distance;state.transition=0;state.levelsReached++;recordMap(next);transitionTerrain(next);{const mr=LEVEL_RULES[next].meteor;state.meteorTimer=mr?mr.every[0]*(next===3?1.1:.7):3;resetHazardTimers(next)}const toast=document.getElementById('levelToast');toast.textContent=LEVELS[next].name;toast.classList.toggle('glitch',!!LEVELS[next].perplex);toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),LEVELS[next].perplex?3400:1800)}
/* ===== PERPLEXITY: state, flash safety, gate, visual effects. Everything here is visual-only; collision geometry is never touched. ===== */
Object.assign(state,{perpEaseT:99,perpObstD:0,pw:0,gatePassed:false,gateReady:false,runEnded:false,perpMusic:false,perpTint:false,lastFlash:-9,flashHeld:false});
const blackoutEl=document.getElementById('blackout'),warnEl=document.getElementById('warn'),hypnoEl=document.getElementById('hypno');
/* Reduced flashing caps every sky flash. On Perplexity, flashes are also limited to at most 2.5 per second even with it off. */
function limitFlash(){
  if(state.reduced){state.skyFlash=Math.min(state.skyFlash,.2);return}
  if(!LEVEL_RULES[state.level].perplex)return;
  if(state.skyFlash>.3){if(state.clock-state.lastFlash<.4)state.skyFlash=.3;else if(!state.flashHeld){state.lastFlash=state.clock;state.flashHeld=true}}
  if(state.skyFlash<.12)state.flashHeld=false
}
/* hue-cycled sky / fog / light / ground and iridescent obstacles. one full hue turn takes 33 s (66 s reduced), far below 3 Hz */
const hsl=(h,s,l)=>new THREE.Color().setHSL(((h%1)+1)%1,s,l);
function perpVisuals(old,next,t){
  const pw=(state.arena||state.mode==='CUT1'||state.mode==='CUT2'||state.mode==='GATE')?0:(old.perplex?1-t:0)+(next.perplex?t:0);state.pw=pw;
  ambientMat.opacity=.6*(1-.75*pw);
  const rd=state.reduced,pl=.5+.5*Math.sin(state.clock*Math.PI*2*(rd?.4:1.1)),amp=rd?.35:1,U=skyMat.uniforms;
  U.uPerp.value=pw;U.uT.value=state.clock*(rd?.5:1);U.uPulse.value=rd?.7+.3*pl:pl;
  const g=l=>new THREE.Color(l,l,l);
  if(pw>.001){
    const fl=.03+.1*pl*amp;U.uFog.value.setRGB(fl,fl,fl);scene.fog.color.lerp(g(fl),pw);
    hemi.color.lerp(g(.85),pw);hemi.groundColor.lerp(g(.05),pw);
    groundMat.color.lerp(g(.015+.16*pl*amp),pw);sun.color.lerp(g(1),pw);ambientMat.color.lerp(g(1),pw);nightLight.color.lerp(g(1),pw);
    const ol=.95-.3*pl*amp,e=.28*(1-pl)*amp*pw;
    boxObstacleMat.color.copy(WHITE).lerp(g(ol),pw);boxObstacleMat.emissive.setRGB(e,e,e);
    spikeObstacleMat.color.copy(WHITE).lerp(g(ol),pw);spikeObstacleMat.emissive.setRGB(e,e,e);state.perpTint=true
  }else if(state.perpTint){boxObstacleMat.color.copy(WHITE);boxObstacleMat.emissive.setRGB(0,0,0);spikeObstacleMat.color.copy(WHITE);spikeObstacleMat.emissive.setRGB(0,0,0);state.perpTint=false}
}
/* ground ripple: top faces of the ground blocks rise and fall in a travelling wave (vertex shader only) */
const groundRip={uRip:{value:0},uT:{value:0}};
groundMat.onBeforeCompile=sh=>{sh.uniforms.uRip=groundRip.uRip;sh.uniforms.uT=groundRip.uT;sh.vertexShader='uniform float uRip;\nuniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
{vec4 wp=modelMatrix*instanceMatrix*vec4(transformed,1.);float sy=max(.05,length(instanceMatrix[1].xyz));transformed.y+=uRip*(.5+.5*sin(wp.z*.33-uT*2.6+wp.x*.21))*(position.y+.5)/sy;}
#endif`)};
/* warp tunnel: an inward-facing tube (r 70 m, 300 m long) around the camera. additive, no depth write, no fog, so it only adds light behind everything and never hides an obstacle */
const tunnelMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,fog:false,uniforms:{t:{value:0},hue:{value:0},alpha:{value:0},scroll:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float t;uniform float hue;uniform float alpha;uniform float scroll;varying vec2 vUv;
vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return v*mix(vec3(1.),k,s);}
void main(){float a=vUv.x*6.2831853,z=vUv.y*300.;
float spiral=sin(a*5.+z*.045+t*.35)*.5+.5;
float rings=smoothstep(.82,1.,sin((z-scroll)*.2617994)*.5+.5);
float rays=smoothstep(.9,1.,sin(a*14.+t*.2)*.5+.5);
float m=spiral*.35+rings*.9+rays*.3,fade=smoothstep(0.,.18,vUv.y)*smoothstep(1.,.6,vUv.y);
gl_FragColor=vec4(vec3(m),m*alpha*fade);}`});
const tunnelGeo=new THREE.CylinderGeometry(70,70,300,64,1,true);tunnelGeo.rotateX(Math.PI/2);
const tunnel=new THREE.Mesh(tunnelGeo,tunnelMat);tunnel.frustumCulled=false;tunnel.visible=false;tunnel.renderOrder=-1;scene.add(tunnel);
/* warp streaks replace the ambient dots */
const WL_N=150,wlGeo=new THREE.BufferGeometry(),wlMat=new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});
wlGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(WL_N*6),3));
const warpLines=new THREE.LineSegments(wlGeo,wlMat);warpLines.frustumCulled=false;warpLines.visible=false;scene.add(warpLines);
const wlSeed=Array.from({length:WL_N},()=>{const a=Math.random()*Math.PI*2,r=8+Math.random()*34;return {dx:Math.cos(a)*r,y:5+Math.sin(a)*r*.55,z:-Math.random()*170,len:4+Math.random()*10}});
/* ---- Perplexity ease-in: calm flight (flat ground, swaying sky) for PERP_EASE.obstacles s (ground ripple runs the whole time), then obstacles, then hazards at PERP_EASE.hazards s ----
   perpEaseT counts seconds since entering Perplexity (99 = no ease active). hazards.js / main.js should skip spawning while perpHazardsHeld() is true. */
const PERP_EASE={obstacles:10,hazards:15};
const perpHazardsHeld=()=>!!state.perpOK&&state.perpEaseT<PERP_EASE.hazards;
function updatePerplexityFx(dt){
  perpVisuals(LEVELS[state.fromLevel],LEVELS[state.toLevel],THREE.MathUtils.smoothstep(state.transition,0,1));
  const pw=state.pw,on=pw>.01&&state.mode!=='SHOP'&&state.mode!=='HOME',rf=state.reduced?.5:1;
  groundRip.uRip.value=on?pw*(state.reduced?.4:1.4):0;groundRip.uT.value=state.clock;
  tunnel.visible=on;warpLines.visible=on;
  if(hypnoEl){hypnoEl.style.opacity=on?String(pw*(state.reduced?.1:.26)):'0';if(on)hypnoEl.style.transform=`rotate(${(state.clock*8)%360}deg)`}
  if(!on)return;
  const h=state.clock*(state.reduced?.015:.03);
  tunnel.position.set(camera.position.x,6,camera.position.z-110);
  tunnelMat.uniforms.t.value=state.clock;tunnelMat.uniforms.hue.value=h+.25;tunnelMat.uniforms.alpha.value=pw*.3*rf;tunnelMat.uniforms.scroll.value=state.worldZ%24;
  const arr=wlGeo.attributes.position.array,step=dt*(state.mode==='PLAYING'?state.worldScale:1),sp=state.mode==='PLAYING'?state.speed:12,stretch=clampN(sp/40,.4,1.5);
  for(let i=0;i<WL_N;i++){const s=wlSeed[i];s.z+=(sp+30)*step;if(s.z>14){s.z=-170-Math.random()*20}const b=i*6,x=state.x+s.dx;arr[b]=x;arr[b+1]=s.y;arr[b+2]=s.z;arr[b+3]=x;arr[b+4]=s.y;arr[b+5]=s.z-s.len*stretch}
  wlGeo.attributes.position.needsUpdate=true;wlMat.color.setRGB(1,1,1);wlMat.opacity=pw*.55*rf
}
/* ---- flash-warning gate between Solar Flare and Perplexity (GATE_D = 40 m before the map starts). once per run ---- */
function resetGateState(){state.perpEaseT=99;state.perpObstD=0;state.perpOK=false;arenaOff();state.arenaDone=false;state.cut=null;state.gatePassed=false;state.gateReady=false;state.runEnded=false;state.perpMusic=false;hideGateUI()}
function hideGateUI(){state.gateReady=false;if(warnEl)warnEl.classList.remove('active');if(blackoutEl){blackoutEl.style.transitionDuration='.3s';blackoutEl.classList.remove('on')}}
function startGate(){
  state.mode='GATE';state.gateReady=false;state.timeScale=1;state.rumble=state.shake=0;touchAxis=0;clearMeteors();setShieldHum(false);
  try{if(audioCtx&&audioMusicGain){audioMusicGain.gain.cancelScheduledValues(audioCtx.currentTime);audioMusicGain.gain.setTargetAtTime(0,audioCtx.currentTime,.25)}}catch{}
  setTimeout(()=>{if(state.mode==='GATE'){stopMusic();applyAudioSettings()}},800);
  blackoutEl.style.transitionDuration='1.2s';blackoutEl.classList.add('on');
  setTimeout(()=>{if(state.mode!=='GATE')return;warnEl.classList.add('active');state.gateReady=true;document.getElementById('warnYes').focus({preventScroll:true})},1300)
}
/* =====================================================================================================================
   EVENT HORIZON  (inserted between Solar Flare and Perplexity)
   flash warning -> CUTSCENE 1 ("come find me") -> 180 s hazard arena -> CUTSCENE 2 ("you found me" + stinger) -> Perplexity
   Arena = state.arena: no terrain, no obstacles, flat grid floor. Only hazards (meteors, lightning, magma, gravity wells, gusts) and bosses.
   Distance is not scored in the arena (arenaD0 is held for payout); clearing it pays ECONOMY.arenaBonus.
   ===================================================================================================================== */
Object.assign(state,{arena:false,arn:null,arenaD0:0,arenaDone:false,hideWorld:false,cut:null});
const ARENA_LEN=180,ARENA_TILE=10,ARENA_SIZE=640,ARENA_RULE={gust:null};
const ARENA_BOSSES=[{at:40,kind:'storm'},{at:76,kind:'magma'},{at:110,kind:'meteors'},{at:142,kind:'well'},{at:164,kind:'calamity'}];
const cutTextEl=document.getElementById('cutText'),arenaHudEl=document.getElementById('arenaHud'),ahTime=document.getElementById('ahTime'),ahFill=document.getElementById('ahFill'),arenaBannerEl=document.getElementById('arenaBanner');
const arenaTex=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#0c0508';g.fillRect(0,0,256,256);g.strokeStyle='rgba(255,110,60,.10)';g.lineWidth=1;for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*64,0);g.lineTo(i*64,256);g.moveTo(0,i*64);g.lineTo(256,i*64);g.stroke()}g.strokeStyle='rgba(255,110,60,.6)';g.lineWidth=3;g.strokeRect(1.5,1.5,253,253);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(ARENA_SIZE/ARENA_TILE,ARENA_SIZE/ARENA_TILE);return t})();
const arenaGround=new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE,ARENA_SIZE),new THREE.MeshBasicMaterial({map:arenaTex,fog:true}));arenaGround.rotation.x=-Math.PI/2;arenaGround.visible=false;arenaGround.frustumCulled=false;scene.add(arenaGround);
const AC={h0:new THREE.Color('#34100f'),h1:new THREE.Color('#7a1424'),t0:new THREE.Color('#0a0408'),t1:new THREE.Color('#1e0614'),f0:new THREE.Color('#1c0809'),f1:new THREE.Color('#33091a'),hemi:new THREE.Color('#ffb08a'),hemiG:new THREE.Color('#200808'),sun:new THREE.Color('#ff9a6a'),amb:new THREE.Color('#ff7a4a')};

function setWorldVisible(v){for(const ch of chunks){const on=!!v&&ch.ready;ch.ground.visible=on;ch.boxMesh.visible=on&&boxObstacleMat.opacity>.015;ch.spikeMesh.visible=on&&spikeObstacleMat.opacity>.015;ch.crystalMesh.visible=on&&crystalMat.opacity>.015}}
function arenaOff(){
  state.arena=false;state.hideWorld=false;state.arn=null;ARENA_RULE.gust=null;
  arenaGround.visible=false;ambient.visible=true;skyDome.rotation.set(0,0,0);blackHole.visible=false;
  setWorldVisible(true);document.body.classList.remove('arena');
  arenaHudEl.classList.remove('on');arenaBannerEl.classList.remove('show');hideCutText(true)
}
function showCutText(text,pos){cutTextEl.style.transition='';cutTextEl.textContent=text;cutTextEl.className=pos||'';void cutTextEl.offsetWidth;cutTextEl.classList.add('show')}
function hideCutText(fast){if(fast){cutTextEl.style.transition='none';cutTextEl.classList.remove('show');setTimeout(()=>{cutTextEl.style.transition=''},80)}else cutTextEl.classList.remove('show')}
function arenaBanner(a,b){arenaBannerEl.querySelector('b').textContent=a;arenaBannerEl.querySelector('span').textContent=b||'';arenaBannerEl.classList.remove('show');void arenaBannerEl.offsetWidth;arenaBannerEl.classList.add('show')}







/* ---- visuals ---- */
function voidLook(pulse){
  const U=skyMat.uniforms;U.uPerp.value=0;U.top.value.setRGB(0,0,0);U.horizon.value.setRGB(0,0,0);U.uFog.value.setRGB(0,0,0);
  scene.fog.color.setRGB(0,0,0);scene.fog.far=220;hemi.color.setRGB(1,1,1);hemi.groundColor.setRGB(0,0,0);hemi.intensity=.4;sun.color.setRGB(1,1,1);sun.intensity=2.1;nightLight.intensity=0;ambient.visible=false
}
function arenaVisuals(){
  const A=state.arn,u=A?clampN(A.t/ARENA_LEN,0,1):0,U=skyMat.uniforms;
  arenaGround.visible=state.mode!=='SHOP';arenaGround.position.set(state.x,0,-200);
  arenaTex.offset.set(((state.x/ARENA_TILE)%1+1)%1,((state.worldZ/ARENA_TILE)%1+1)%1);
  U.uPerp.value=0;U.horizon.value.copy(AC.h0).lerp(AC.h1,u);U.top.value.copy(AC.t0).lerp(AC.t1,u);
  scene.fog.color.copy(AC.f0).lerp(AC.f1,u);scene.fog.far=150*(1+(PLANES[save.equippedPlane].visibility-3)*.06);
  hemi.color.copy(AC.hemi);hemi.groundColor.copy(AC.hemiG);hemi.intensity=.75+state.skyFlash*1.4;sun.color.copy(AC.sun);sun.intensity=1.5;ambientMat.color.copy(AC.amb);nightLight.intensity=0
}


/* ---- Gargantua-style black hole for the final side shot: shadow, thin lensed disk, light bent over the top and under the bottom, photon ring ---- */
const holeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,uniforms:{uT:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uT;varying vec2 vUv;
float hs(float n){return fract(sin(n*127.1)*43758.5453);}
float vn(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);float a=hs(i.x+i.y*57.),b=hs(i.x+1.+i.y*57.),c=hs(i.x+(i.y+1.)*57.),d=hs(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
/* disk emission at disk radius rho (shadow radius = 1) and azimuth phi: hot white inner edge, orange outer, Keplerian swirl + turbulence */
vec3 disk(float rho,float phi,float side){
  float inner=smoothstep(1.5,1.72,rho),outer=pow(smoothstep(4.1,1.7,rho),1.7);
  float ph=phi-uT*.9/pow(rho,1.5);
  float t=vn(vec2(ph*5.,rho*9.))*.55+vn(vec2(ph*14.+3.,rho*26.))*.3+vn(vec2(ph*40.,rho*70.))*.15;
  float e=inner*outer*(.35+1.15*t);
  vec3 c=mix(vec3(1.,.97,.88),vec3(1.,.42,.1),smoothstep(1.6,3.8,rho));
  float dop=1.+.62*side;           /* approaching (left) side is beamed brighter */
  return c*e*dop*dop;
}
void main(){
  vec2 p=(vUv-.5)*2.;vec2 s=p/.25;float r=length(s);vec3 col=vec3(0.);
  float inc=.034;                                    /* disk inclination: seen almost edge-on */
  /* direct image of the disk: front half crosses the shadow, back half only shows outside it */
  float rho=sqrt(s.x*s.x+(s.y/inc)*(s.y/inc));
  float phi=atan(-s.y/inc,s.x);
  if(rho>1.5&&rho<4.1){bool front=s.y<0.;if(front||r>1.0)col+=disk(rho,phi,clamp(-s.x/rho,-1.,1.))*(front?1.:.85);}
  /* light bent over the top and under the bottom: the far side of the disk seen around the shadow */
  float vert=abs(s.y)/max(r,.001);
  float tt=(r-1.012)/.85;
  if(tt>0.&&tt<1.){
    float sh=smoothstep(.18,.85,vert);
    float prof=pow(1.-tt,4.2)*smoothstep(0.,.02,tt);
    float aphi=atan(s.y,s.x);
    float n=vn(vec2(aphi*4.,r*8.-uT*.5))*.6+vn(vec2(aphi*12.,r*22.))*.4;
    float dop=1.+.55*clamp(-s.x/r,-1.,1.);
    vec3 c=mix(vec3(1.,.95,.82),vec3(1.,.5,.16),smoothstep(0.,.8,tt));
    col+=c*prof*sh*(.7+.6*n)*dop*(s.y>0.?1.5:.8);
  }
  /* photon ring + a faint second-order ring + soft halo */
  float ring=exp(-pow((r-1.025)/.014,2.));col+=vec3(1.,.93,.78)*ring*(1.1+.5*clamp(-s.x/max(r,.001),-1.,1.));
  col+=vec3(1.,.8,.55)*exp(-pow((r-1.075)/.012,2.))*.35;
  col+=vec3(1.,.55,.2)*exp(-(r-1.)*4.)*.04*step(1.,r);
  col=1.-exp(-col*1.25);                              /* soft tone-map */
  gl_FragColor=vec4(col,1.);
}`});
const blackHole=new THREE.Mesh(new THREE.PlaneGeometry(150,150),holeMat);blackHole.visible=false;blackHole.frustumCulled=false;blackHole.renderOrder=-2;scene.add(blackHole);

/* ---- CUTSCENE 1: the plane fades to black, a black void answers: "come find me" ---- */
function startCut1(){
  state.mode='CUT1';state.cut={t:0,ph:0};
  if(state.shieldTimer>0)finishAbility('shield');if(state.slowTimer>0)finishAbility('slow');if(state.apTimer>0)finishAbility('autopilot');shieldBubble.visible=false;
  hud.classList.remove('visible');
  blackoutEl.style.transitionDuration='.9s';blackoutEl.classList.remove('on');
  cutDrone(8.6,46,72,.22)
}
function enterVoid(){state.hideWorld=true;setWorldVisible(false);clearMeteors();ambient.visible=false}
function cut1Cam(t){
  const k=clampN(t/5,0,1);
  plane.position.set(0,3.95,-k*6);plane.rotation.set(0,0,Math.sin(t*.8)*.04);
  camera.position.set(0,3.6,9.2);camera.up.set(0,1,0);camera.lookAt(0,4.5,-40);camera.fov=lerpN(58,50,k);camera.near=.1;camera.updateProjectionMatrix();
  sun.position.set(3,9,-25);sun.target.position.set(0,3.9,0);sun.target.updateMatrixWorld();skyDome.position.copy(camera.position)
}
function cut1Update(dt){
  const C=state.cut;C.t+=dt;const t=C.t;
  if(prop1)prop1.rotation.z+=dt*40;if(prop2)prop2.rotation.z+=dt*40;
  if(C.ph===0){                                   /* the plane hangs in the last light of Solar Flare */
    plane.rotation.z=Math.sin(t*1.3)*.06;
    if(t>1.4){C.ph=1;blackoutEl.style.transitionDuration='1.6s';blackoutEl.classList.add('on')}
  }else if(C.ph===1){                             /* fade to black */
    if(t>3.2){C.ph=2;enterVoid();blackoutEl.style.transitionDuration='1.6s';blackoutEl.classList.remove('on')}
  }else if(C.ph===2){                             /* black void */
    voidLook(.75+.25*Math.sin(state.clock*2.2));cut1Cam(t-3.2);
    if(t>4.8&&!C.txt){C.txt=1;showCutText('COME FIND ME')}
    if(t>7.6){hideCutText();C.ph=3;blackoutEl.style.transitionDuration='1.1s';blackoutEl.classList.add('on')}
  }else if(C.ph===3){voidLook(.75+.25*Math.sin(state.clock*2.2));cut1Cam(t-3.2);if(t>8.8)startArena()}
}

/* ---- ARENA ---- */
function startArena(){
  state.arn={t:0,spawnT:2.2,boss:0,bossUntil:0,q:[],stage:0,s:0};
  state.arena=true;state.hideWorld=true;state.arenaD0=state.distance;
  setWorldVisible(false);clearMeteors();state.terrainAnim=false;
  skyDome.rotation.set(0,0,0);ambient.visible=true;
  state.x=0;state.vx=0;state.bank=0;state.yaw=0;state.speed=36;state.worldScale=state.worldScaleTarget=1;state.timeScale=1;state.gustT=6;state.gustPhase='idle';
  plane.visible=true;plane.scale.setScalar(.42);plane.position.set(0,CONFIG.baseAltitude,0);plane.rotation.set(0,0,0);resetRollSystem();shieldBubble.visible=false;
  camera.position.set(0,5.2,10.5);camera.fov=57;camera.updateProjectionMatrix();
  document.body.classList.add('arena');hud.classList.add('visible');hideCutText(true);
  blackoutEl.style.transitionDuration='1.2s';blackoutEl.classList.remove('on');
  applyAudioSettings();startMusic(true,'horizon');state.mode='PLAYING';
  arenaBanner('EVENT HORIZON','SURVIVE 3:00');
  {const toast=document.getElementById('levelToast');toast.textContent='EVENT HORIZON';toast.classList.remove('glitch');toast.classList.add('show');clearTimeout(startArena._t);startArena._t=setTimeout(()=>toast.classList.remove('show'),2200)}
}
/* where a hazard lands. aimed = near the plane's path (a dodge), otherwise scattered on the flanks and ahead for atmosphere.
   rz = where the strike is relative to the plane at the moment it lands (negative = ahead, positive = just behind) */
function arenaSpot(T,aimed){
  const rnd=Math.random,sp=Math.max(state.speed,18);let x,rz;
  if(aimed){x=state.x+clampN(state.vx*T*.5,-6,6)+(rnd()<.5?-1:1)*(2.4+rnd()*3.8);rz=(rnd()-.5)*6}
  else{x=state.x+(rnd()<.5?-1:1)*(7+rnd()*27);rz=-70+rnd()*76}
  return {x,zs:-(state.distance+sp*T-rz),T}
}
function spawnArenaHazard(t){
  const rnd=Math.random,pool=[['meteor',3]];if(t>=14)pool.push(['bolt',2.6]);if(t>=32)pool.push(['geyser',2.2]);if(t>=58&&wells.length<2)pool.push(['well',.45]);
  let r=rnd()*pool.reduce((a,p)=>a+p[1],0),kind='meteor';for(const p of pool){r-=p[1];if(r<=0){kind=p[0];break}}
  const aimed=rnd()<.55;
  if(kind==='meteor')spawnMeteor(arenaSpot(lerpN(CONFIG.meteorFall[0],CONFIG.meteorFall[1],rnd()),aimed));
  else if(kind==='bolt')spawnLightning(arenaSpot(.95,aimed));
  else if(kind==='geyser')spawnGeyser(arenaSpot(GEYSER_WARN,aimed));
  else spawnWell()
}
/* boss patterns share one weaving "safe lane" (world x as a function of time) so there is always a way through, even when patterns overlap */
function laneAt(ctx,T){const A=state.arn;if(ctx.base==null){ctx.base=state.x;ctx.t0=A.t}return ctx.base+6.5*Math.sin(.65*(A.t-ctx.t0+T))}
function rowSpot(x,T,zj,quiet){return {x,zs:-(state.distance+Math.max(state.speed,18)*T+5+(Math.random()-.5)*zj),T,quiet}}
function stormRow(ctx){const T=.95,lane=laneAt(ctx,T);let first=true;for(let x=lane-34;x<=lane+34;x+=5.2){if(Math.abs(x-lane)<6.4)continue;spawnLightning(rowSpot(x+(Math.random()-.5)*1.4,T,4,!first),true);first=false}}
function magmaRow(ctx){const T=GEYSER_WARN,lane=laneAt(ctx,T);let first=true;for(let x=lane-30;x<=lane+30;x+=4.6){if(Math.abs(x-lane)<6)continue;spawnGeyser(rowSpot(x,T,3,!first));first=false}}
function stormMeteor(ctx){const rnd=Math.random,T=lerpN(CONFIG.meteorFall[0],CONFIG.meteorFall[1],rnd()),lane=laneAt(ctx,T),x=lane+(rnd()<.5?-1:1)*(BR+3.2+rnd()*14);spawnMeteor({x,zs:-(state.distance+Math.max(state.speed,18)*T+4+rnd()*26),T})}
function runBoss(kind){
  const A=state.arn,ctx={base:null,t0:0},Q=(d,fn)=>A.q.push({t:d,fn});thudSound(.5);
  if(kind==='storm'){arenaBanner('LIGHTNING FIELD','FIND THE GAP');for(let k=0;k<9;k++)Q(1.7+k*.5,()=>stormRow(ctx));A.bossUntil=A.t+7.7}
  else if(kind==='magma'){arenaBanner('MAGMA WALL','FIND THE GAP');for(let k=0;k<6;k++)Q(1.7+k*.85,()=>magmaRow(ctx));A.bossUntil=A.t+8.3}
  else if(kind==='meteors'){arenaBanner('METEOR STORM','KEEP MOVING');for(let i=0;i<18;i++)Q(1.5+i*.28,()=>stormMeteor(ctx));A.bossUntil=A.t+9.6}
  else if(kind==='well'){arenaBanner('SINGULARITY','FIGHT THE PULL');Q(.2,()=>spawnWell(95,-1));Q(.9,()=>spawnWell(120,1));Q(1.6,()=>spawnWell(150,-1));Q(2.3,()=>spawnWell(180,1));for(let k=0;k<4;k++)Q(5.2+k*.55,()=>stormRow(ctx));A.bossUntil=A.t+10}
  else{arenaBanner('CALAMITY','NOTHING IS SAFE');for(let k=0;k<8;k++)Q(1.8+k*.6,()=>stormRow(ctx));for(let k=0;k<6;k++)Q(2.4+k*.9,()=>magmaRow(ctx));for(let i=0;i<9;i++)Q(2.2+i*.95,()=>stormMeteor(ctx));A.bossUntil=A.t+12}
}
function updateArena(dt){
  const A=state.arn;if(!A)return;
  A.t+=dt;const u=clampN(A.t/ARENA_LEN,0,1);
  for(let i=A.q.length-1;i>=0;i--){const e=A.q[i];e.t-=dt;if(e.t<=0){A.q.splice(i,1);e.fn()}}
  if(A.stage===0&&A.t>=76){const g=lerpN(7.5,3.4,clampN((A.t-76)/104,0,1));ARENA_RULE.gust={every:[g,g]}}else ARENA_RULE.gust=null;
  if(A.stage===0){
    if(A.t>=ARENA_LEN-3){A.stage=1;A.q.length=0}
    else{
      if(A.boss<ARENA_BOSSES.length&&A.t>=ARENA_BOSSES[A.boss].at){runBoss(ARENA_BOSSES[A.boss].kind);A.boss++}
      A.spawnT-=dt;
      if(A.spawnT<=0){
        const quiet=A.t<A.bossUntil,rnd=Math.random;
        A.spawnT=lerpN(2.5,.5,Math.pow(u,.85))*(.7+rnd()*.6)*(quiet?2.2:1);
        if(meteors.length+bolts.length+geysers.length<7+u*13){
          const n=1+(u>.35&&rnd()<.4?1:0)+(u>.7&&rnd()<.45?1:0)+(u>.9?1:0);
          for(let i=0;i<n;i++)spawnArenaHazard(A.t)
        }
      }
    }
  }else if(A.stage===1){
    const busy=meteors.length+bolts.length+geysers.length+blasts.length;
    if(A.t>=ARENA_LEN+.5&&(!busy||A.t>=ARENA_LEN+4)){A.stage=2;A.s=0;state.arenaDone=true;arenaBanner('SURVIVED','ARENA BONUS +'+ECONOMY.arenaBonus+' ◈')}
  }else if(A.stage===2){A.s+=dt;if(A.s>2.4){A.stage=3;A.s=0;blackoutEl.style.transitionDuration='1.2s';blackoutEl.classList.add('on')}}
  else if(A.stage===3){A.s+=dt;if(A.s>1.35)startCut2()}
}

/* ---- CUTSCENE 2: front view in pure black space, "you found me", then the stinger and a side view of the plane beside a black hole ---- */
function startCut2(){
  clearMeteors();if(state.shieldTimer>0)finishAbility('shield');if(state.slowTimer>0)finishAbility('slow');if(state.apTimer>0)finishAbility('autopilot');shieldBubble.visible=false;
  stopMusic();setShieldHum(false);
  state.mode='CUT2';state.cut={t:0,ph:0};state.x=0;state.vx=0;state.worldScale=state.worldScaleTarget=1;state.timeScale=1;
  arenaGround.visible=false;state.hideWorld=true;setWorldVisible(false);ambient.visible=false;
  hud.classList.remove('visible');document.body.classList.remove('arena');
  skyDome.rotation.set(0,0,0);blackHole.visible=false;
  plane.visible=true;plane.scale.setScalar(.42);plane.position.set(0,3.3,0);plane.rotation.set(0,0,0);
  blackoutEl.style.transitionDuration='1s';blackoutEl.classList.remove('on');
  cutDrone(5,40,90,.26)
}
function cut2Stinger(){
  const rd=state.reduced;hideCutText(true);
  blackoutEl.style.transitionDuration='0s';blackoutEl.classList.add('on');stingerSound();
  setTimeout(()=>{if(state.mode!=='CUT2')return;blackoutEl.classList.remove('on');if(!rd){flash.style.opacity='1';setTimeout(()=>flash.style.opacity='0',80)}},120)
}
function cut2Update(dt){
  const C=state.cut;C.t+=dt;const t=C.t;
  if(prop1)prop1.rotation.z+=dt*40;if(prop2)prop2.rotation.z+=dt*40;
  voidLook(.75+.25*Math.sin(state.clock*2.2));
  camera.up.set(0,1,0);camera.near=.1;
  if(C.ph===0){                                     /* front view: the plane flies at the camera, the sky is about to swallow it */
    const k=clampN(t/4.4,0,1);
    plane.position.set(0,3.3,-k*2.2);plane.rotation.set(0,0,Math.sin(t*1.1)*.07);
    camera.position.set(.9-k*.35,2.75+k*.25,-4.6-k);camera.lookAt(0,3.35,plane.position.z);camera.fov=lerpN(46,37,k);camera.updateProjectionMatrix();
    sun.position.set(2,8,-14);sun.target.position.set(0,3.3,plane.position.z);sun.target.updateMatrixWorld();
    if(t>1.2&&!C.txt){C.txt=1;showCutText('YOU FOUND ME','low')}
    if(t>=4.5){C.ph=1;C.t=0;cut2Stinger()}
  }else if(C.ph===1){                               /* stinger: hard cut to a wide side shot, a tiny plane in front of a gigantic black hole */
    const k=clampN(t/3.6,0,1),fov=40,dist=lerpN(42,37,k);
    blackHole.visible=true;holeMat.uniforms.uT.value=state.clock;
    /* only the left half of the black hole is in frame: its centre sits on the right screen edge and it is scaled up to fill that whole side */
    const HOLE_X=-70,hDepth=dist-HOLE_X,hHalfW=Math.tan(fov*Math.PI/360)*hDepth*camera.aspect;
    blackHole.scale.setScalar(2.3);blackHole.position.set(HOLE_X,.5,-hHalfW);
    const jolt=state.reduced?0:Math.max(0,1-t/.55);
    plane.position.set(0,3.3,10-k*2.4);plane.rotation.set(0,0,Math.sin(t*1.4)*.03+jolt*.12);
    camera.position.set(dist+(Math.random()-.5)*.25*jolt,3.3+(Math.random()-.5)*.2*jolt,(Math.random()-.5)*.2*jolt);camera.lookAt(0,3.3,0);camera.fov=fov;camera.updateProjectionMatrix();blackHole.lookAt(camera.position);
    sun.position.set(6,9,-10);sun.target.position.set(0,3.3,plane.position.z);sun.target.updateMatrixWorld();
    if(t>3.7){C.ph=2;C.t=0;blackoutEl.style.transitionDuration='1s';blackoutEl.classList.add('on')}
  }else if(C.ph===2){
    if(t>1.15&&!C.gated){C.gated=1;startGate()}
  }
  skyDome.position.copy(camera.position)
}

/* ---- gate -> cutscene 1; end of cutscene 2 -> Perplexity (the old gate hand-off) ---- */
function gateYes(){
  if(state.mode!=='GATE'||!state.gateReady)return;state.gateReady=false;state.gatePassed=true;warnEl.classList.remove('active');
  enterPerplexity()
}
function enterPerplexity(){
  arenaOff();state.x=0;
  const spot=findSafeSpot(PERP_D,0),Dc=spot.D;
  state.distance=Dc;state.worldZ=Dc;state.lifetimeAccountedDistance=Dc;state.x=spot.x;state.vx=0;state.bank=0;state.yaw=0;state.speed=speedAtDistance(Dc);
  state.worldScale=state.worldScaleTarget=1;state.timeScale=1;state.meteorTimer=6;resetHazardTimers(PERP_IDX);
  plane.visible=true;plane.scale.setScalar(.42);plane.position.set(state.x,CONFIG.baseAltitude,0);plane.rotation.set(0,0,0);resetRollSystem();
  state.perpEaseT=0;state.perpObstD=Dc+state.speed*PERP_EASE.obstacles+100;state.perpOK=true;streamChunks(true);startLevelTransition(PERP_IDX);camera.position.set(state.x,5.2,10.5);camera.fov=57;camera.updateProjectionMatrix();
  hud.classList.add('visible');
  document.getElementById('distance').textContent=Math.floor(Dc).toLocaleString();
  blackoutEl.style.transitionDuration='1.5s';blackoutEl.classList.remove('on');
  applyAudioSettings();startMusic(true,'perplexity');state.mode='PLAYING'
}
/* runs last each frame, so it overrides the per-level look set earlier in the frame */
function updateCinematics(dt){
  const m=state.mode;
  if(state.perpOK&&!state.arena&&m==='PLAYING'&&state.perpEaseT<99){
    state.perpEaseT=Math.min(99,state.perpEaseT+dt);
    const amp=1-smooth01((state.perpEaseT-PERP_EASE.obstacles+2)/2);
    if(amp>.001)camera.rotateZ(amp*(state.reduced?.012:.04)*(Math.sin(state.clock*.55)+.4*Math.sin(state.clock*1.3)))
  }
  if(m!=='CUT2')blackHole.visible=false;
  if(m==='CUT1')cut1Update(dt);else if(m==='CUT2')cut2Update(dt);else if(state.arena&&m!=='GATE')arenaVisuals();
  const A=state.arn,on=!!(state.arena&&m==='PLAYING'&&A&&A.stage<2);
  arenaHudEl.classList.toggle('on',on);
  if(on){const rem=Math.max(0,Math.ceil(ARENA_LEN-A.t)),txt=Math.floor(rem/60)+':'+String(rem%60).padStart(2,'0');if(txt!==ahTime.textContent)ahTime.textContent=txt;ahFill.style.width=(clampN(A.t/ARENA_LEN,0,1)*100).toFixed(1)+'%'}
}
function gateNo(){if(state.mode!=='GATE'||!state.gateReady)return;endRunAtGate()}
function endRunAtGate(){state.gateReady=false;state.runEnded=true;stopMusic();applyAudioSettings();hideGateUI();finishCrash()}
document.getElementById('warnYes').addEventListener('click',gateYes);document.getElementById('warnNo').addEventListener('click',gateNo);
/* INPUT */
const keys=new Set();let touchAxis=0,touchRoll=0;const touchPts=new Map();window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(document.getElementById('settings')?.classList.contains('active')||document.getElementById('tutorial')?.classList.contains('active'))return;if(k==='5'){if(!e.repeat)adminToggle();return}if(state.mode!=='SHOP'&&(e.key==='Enter'||e.code==='Space')&&e.target.closest?.('button'))return;if(['arrowleft','arrowright',' ','enter','a','d','arrowup','arrowdown','escape'].includes(k))e.preventDefault();keys.add(k);if(state.mode==='SHOP'){if(e.key==='Enter'&&e.target.closest?.('button')){e.target.closest('button').click();return}if(k==='escape')closeShop();else if(['arrowup','arrowleft'].includes(k)&&state.shopTab==='hangar')selectPlane(state.selectedPlane-1);else if(['arrowdown','arrowright'].includes(k)&&state.shopTab==='hangar')selectPlane(state.selectedPlane+1);else if(k==='enter'){(state.shopTab==='hangar'?document.getElementById('planeAction'):document.querySelector('.ability-buy:not(:disabled)'))?.click()}return}if(state.mode==='GATE'){if(state.gateReady){if(k==='enter'||k==='y')gateYes();else if(k==='escape'||k==='n')gateNo()}return}if(k==='escape'&&state.mode==='HOME')return;if(k==='c')toggleView();if(k==='z')activateAbility('shield');if(k==='x')activateAbility('slow');if(k==='v')activateAbility('autopilot');if((e.code==='Space'||k==='enter')&&state.mode==='HOME')startRun();else if((e.code==='Space'||k==='enter')&&state.mode==='DEAD')startRun()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();touchAxis=0});document.addEventListener('visibilitychange',()=>{if(document.hidden){state.wasMode=state.mode;if(state.mode==='PLAYING')state.mode='PAUSED'}else if(state.mode==='PAUSED')state.mode=state.wasMode||'PLAYING'});
/* touch: first finger steers (left / right half), a second finger rolls (left half = roll left, right half = roll right) */
function touchSync(){const pts=[...touchPts.values()];touchAxis=pts.length?(pts[0]<innerWidth/2?-1:1):0;touchRoll=pts.length>1?(pts[1]<innerWidth/2?1:-1):0}
window.addEventListener('pointerdown',e=>{if(e.target.closest?.('.ability-button,.view-btn'))return;if(e.pointerType==='touch'&&state.mode==='PLAYING'){touchPts.set(e.pointerId,e.clientX);touchSync()}});
const touchEnd=e=>{if(touchPts.delete(e.pointerId))touchSync()};window.addEventListener('pointerup',touchEnd);window.addEventListener('pointercancel',touchEnd);
/* UI */
const home=document.getElementById('home'),dead=document.getElementById('dead'),hud=document.getElementById('hud'),shopScreen=document.getElementById('shop');const showHomeBest=()=>{const e=document.getElementById('homeBest');if(e)e.textContent=`${Math.floor(state.best).toLocaleString()} m`};showHomeBest();
function nextMilestone(){return milestoneAt(save.lifetimeMeters)}
let creditDisplay=save.credits;function refreshCredits(){document.querySelectorAll('#homeCredits span,#hangarCredits span').forEach(n=>{if(creditDisplay===save.credits)n.textContent=money(save.credits);else animateNumber(n,save.credits,550,'')});creditDisplay=save.credits;const m=nextMilestone(),prev=m.meters-(m.meters===ECONOMY.milestones[0].meters?0:(m.meters===3000?0:(m.meters===8000?3000:m.meters===15000?8000:m.meters===25000?15000:m.meters===40000?25000:m.meters===60000?40000:m.meters-ECONOMY.repeatEvery)));const pct=m.meters<=prev?1:clampN((save.lifetimeMeters-prev)/(m.meters-prev),0,1);const label=`${money(save.lifetimeMeters)} / ${money(m.meters)} M`;const dl=document.getElementById('deathLogLabel'),df=document.getElementById('deathLogFill');if(dl)dl.textContent=label;if(df)df.style.width=`${pct*100}%`;};refreshCredits();
const rail=document.getElementById('planeRail'),details=document.getElementById('hangarDetails');
function ownedPlane(i){return save.ownedPlanes.includes(i)}
const shopGrid=document.getElementById('shopGrid'),stageLabel=document.getElementById('stageLabel'),abilitiesTabBtn=document.getElementById('abilitiesTab'),planesTabBtn=document.getElementById('planesTab');
const ABILITY_META={shield:{key:'Z',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z"/><path d="M12 7.6l4.2 2.4v4.8L12 17.2l-4.2-2.4V10z" opacity=".6"/></svg>'},slow:{key:'X',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.3 2"/></svg>'},autopilot:{key:'V',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8c.9 0 1.4.9 1.4 2v5.2l7.1 4.3v2l-7.1-2v3.6l1.9 1.5v1.6L12 20.6l-3.3 1v-1.6l1.9-1.5v-3.6l-7.1 2v-2l7.1-4.3V4.8c0-1.1.5-2 1.4-2z"/></svg>'}};
function renderShop(){const hangarTab=state.shopTab==='hangar';shopGrid.classList.toggle('abilities-mode',!hangarTab);stageLabel.textContent=hangarTab?'':'ABILITY PREVIEW';rail.innerHTML='';if(hangarTab)PLANES.forEach((p,i)=>{const row=document.createElement('button');row.className=`plane-row${i===state.selectedPlane?' selected':''}${ownedPlane(i)?'':' locked'}`;row.innerHTML=`<span class="plane-index">0${i+1}</span><span><span class="plane-name">${p.name}</span><span class="plane-class">${p.type}</span></span><span class="plane-state">${i===save.equippedPlane?'EQUIPPED':ownedPlane(i)?'OWNED':`${money(p.price)} ◈`}</span>`;row.addEventListener('click',()=>selectPlane(i));rail.appendChild(row)});abilitiesTabBtn.classList.toggle('active',!hangarTab);planesTabBtn.classList.toggle('active',hangarTab);abilitiesTabBtn.setAttribute('aria-selected',String(!hangarTab));planesTabBtn.setAttribute('aria-selected',String(hangarTab));if(hangarTab)renderPlaneDetails();else renderAbilityDetails();refreshCredits()}
function setShopTab(tab){if(state.shopTab===tab)return;state.shopTab=tab;if(tab==='abilities'&&state.selectedPlane!==save.equippedPlane){state.selectedPlane=save.equippedPlane;buildAircraft(save.equippedPlane)}renderShop()}
function renderPlaneDetails(){const p=PLANES[state.selectedPlane],owned=ownedPlane(state.selectedPlane),equipped=save.equippedPlane===state.selectedPlane,due=Math.max(0,p.price-save.credits);details.innerHTML=`<h2 class="hangar-title">${p.name}</h2><div class="micro">${p.type} · FLIGHT ${String(state.selectedPlane+1).padStart(2,'0')}</div><p class="hangar-copy">${p.desc.replace('\n','<br>')}</p><div class="bar-row"><div class="bar-head"><span>HANDLING</span><span>${p.handling} / 10</span></div><div class="bar-track"><i style="width:${p.handling*10}%"></i></div></div><div class="bar-row"><div class="bar-head"><span>VISIBILITY</span><span>${p.visibility} / 10</span></div><div class="bar-track"><i style="width:${p.visibility*10}%"></i></div></div><div class="shop-price">${owned?'READY TO FLY':`${money(p.price)} CREDITS`}</div><button id="planeAction" class="shop-action" ${equipped||(!owned&&due)?'disabled':''}>${equipped?'EQUIPPED':owned?'EQUIP':due?`NEED ${money(due)} MORE`:'BUY'}</button>`;document.getElementById('planeAction').addEventListener('click',()=>{if(owned){save.equippedPlane=state.selectedPlane;buildAircraft(save.equippedPlane);persistSave();renderShop();const a=document.getElementById('planeAction');a.textContent='✓ EQUIPPED';a.classList.add('success');setTimeout(renderShop,700)}else if(save.credits>=p.price){save.credits-=p.price;save.ownedPlanes.push(state.selectedPlane);save.equippedPlane=state.selectedPlane;buildAircraft(save.equippedPlane);persistSave();state.hangarPulse=1;renderShop();const a=document.getElementById('planeAction');a.textContent='✓ PURCHASED';a.classList.add('success');setTimeout(renderShop,850)}})}
function renderAbilityDetails(){const sec=v=>`${v.toFixed(1)} s`;details.innerHTML=`<h2 class="hangar-title">Abilities</h2><p class="hangar-copy">Trigger them mid-flight. Each upgrade lasts longer and recharges faster.</p>`+Object.entries(ABILITIES).map(([key,a])=>{const meta=ABILITY_META[key]||{key:'',icon:''},level=save.abilities[key],cur=level?a.levels[level]:null,next=level<3?a.levels[level+1]:null,price=level<3?a.prices[level]:0,due=Math.max(0,price-save.credits),label=level===0?'UNLOCK':'UPGRADE',durNow=cur?sec(cur.duration):'—',coolNow=cur?`${cur.cooldown} s`:'—',durDelta=next&&cur?`<em>→ ${sec(next.duration)}</em>`:next?`<em>${sec(next.duration)}</em>`:'',coolDelta=next&&cur?`<em>→ ${next.cooldown} s</em>`:next?`<em>${next.cooldown} s</em>`:'';return `<article class="ab-card${level?' owned':''}"><div class="ab-top"><div class="ab-badge">${meta.icon}</div><div><div class="ab-name">${a.name}</div><span class="ab-key">KEY ${meta.key}</span></div><span class="ab-level">${level?`LEVEL ${level} / 3`:'LOCKED'}</span></div><p class="ab-desc">${a.desc}</p><div class="ab-stats"><div class="ab-stat"><label>DURATION</label><b>${durNow}</b>${durDelta}</div><div class="ab-stat"><label>COOLDOWN</label><b>${coolNow}</b>${coolDelta}</div></div><div class="pips">${[1,2,3].map(n=>`<i class="${n<=level?'on':''}"></i>`).join('')}</div><button class="shop-action ability-buy" data-ability="${key}" ${level>=3||due?'disabled':''}>${level>=3?'MAX LEVEL':due?`NEED ${money(due)} MORE`:`${label} · ${money(price)} ◈`}</button></article>`}).join('');details.querySelectorAll('.ability-buy').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.ability,a=ABILITIES[k],lv=save.abilities[k];if(lv>=3||save.credits<a.prices[lv])return;save.credits-=a.prices[lv];save.abilities[k]++;persistSave();renderShop();const done=details.querySelector(`[data-ability="${k}"]`);if(done){done.textContent='✓ UPGRADED';done.classList.add('success');setTimeout(renderShop,750)}renderAbilityHud()}))}
function selectPlane(i){state.selectedPlane=(i+PLANES.length)%PLANES.length;buildAircraft(state.selectedPlane);renderShop()}
function openShop(){if(state.mode!=='HOME')return;state.mode='SHOP';state.selectedPlane=save.equippedPlane;buildAircraft(state.selectedPlane);for(const ch of chunks)ch.ground.visible=ch.boxMesh.visible=ch.spikeMesh.visible=ch.crystalMesh.visible=false;clearMeteors();ambient.visible=false;moon.visible=false;for(const t of trailLines)t.line.visible=false;plane.visible=true;plane.position.set(0,3.1,-3);plane.rotation.set(0,0,0);renderShop();home.classList.remove('active');hud.classList.remove('visible');shopScreen.classList.add('active')}
function closeShop(){if(state.mode!=='SHOP')return;shopScreen.classList.remove('active');buildAircraft(save.equippedPlane);state.mode='HOME';shieldBubble.visible=false;shieldBubble.rotation.y=0;plane.position.set(state.x,3.6,0);plane.rotation.set(0,0,0);plane.visible=true;for(const ch of chunks)if(ch.ready){ch.ground.visible=true;ch.boxMesh.visible=boxObstacleMat.opacity>.015;ch.spikeMesh.visible=spikeObstacleMat.opacity>.015;ch.crystalMesh.visible=crystalMat.opacity>.015}ambient.visible=true;moon.visible=true;for(const t of trailLines)t.line.visible=true;home.classList.add('active')}
document.getElementById('homeShop').addEventListener('click',openShop);document.getElementById('hangarBack').addEventListener('click',closeShop);planesTabBtn.addEventListener('click',()=>setShopTab('hangar'));abilitiesTabBtn.addEventListener('click',()=>setShopTab('abilities'));
function animateNumber(el,to,duration=1200,prefix=''){const from=0,start=performance.now();const tick=now=>{const t=clampN((now-start)/duration,0,1),e=1-Math.pow(1-t,3);el.textContent=`${prefix}${money(to*e)}`;if(t<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}
function accountCrash(){const d=Math.floor(state.arena?state.arenaD0:state.distance),dist=runCredits(d),lvl=Array.from({length:state.levelsReached},(_,i)=>levelBonus(i+1)).reduce((a,b)=>a+b,0)+(state.levelsReached>=PERP_IDX?ECONOMY.perplexBonus:0)+(state.arenaDone?ECONOMY.arenaBonus:0),distDue=Math.max(0,dist-(state.paidRunDistance||0)),levelDue=Math.max(0,lvl-(state.paidRunLevel||0));const before=save.lifetimeMeters,added=Math.max(0,d-(state.lifetimeAccountedDistance||0));save.lifetimeMeters+=added;state.lifetimeAccountedDistance=d;let milestone=0;const candidates=[...ECONOMY.milestones.map((m,i)=>({meters:m.meters,bonus:m.bonus,id:i}))];for(let k=1;k<1000;k++)candidates.push({meters:ECONOMY.milestones[5].meters+k*ECONOMY.repeatEvery,bonus:ECONOMY.repeatBonus,id:5+k});for(const m of candidates){if(m.meters>before&&m.meters<=save.lifetimeMeters&&!save.milestonesClaimed.includes(m.id)){milestone+=m.bonus;save.milestonesClaimed.push(m.id)}}const runDue=distDue+levelDue;state.paidThisRun+=runDue;state.paidRunDistance=dist;state.paidRunLevel=lvl;const total=runDue+milestone;save.credits+=total;persistSave();return {dist:distDue,levels:levelDue,milestone,total,hasMilestone:milestone>0}}
function showPayout(p){const levelRow=document.getElementById('levelPayRow'),mileRow=document.getElementById('milestonePayRow'),card=document.getElementById('payout');levelRow.hidden=!p.levels;mileRow.hidden=!p.milestone;card.classList.toggle('milestone',p.hasMilestone);animateNumber(document.getElementById('payDistance'),p.dist,1200,'+');animateNumber(document.getElementById('payLevels'),p.levels,1200,'+');animateNumber(document.getElementById('payMilestone'),p.milestone,1200,'+');animateNumber(document.getElementById('payTotal'),p.total,1200,'+');refreshCredits()}
function buildHexShieldGeometry(R,detail){const ico=new THREE.IcosahedronGeometry(1,detail),src=ico.attributes.position,cents=[],map=new Map(),key=v=>[v.x,v.y,v.z].map(n=>Math.round(n*1e4)||0).join(',');for(let i=0;i<src.count;i+=3){const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(src,i+j).normalize()),fi=cents.length;cents.push(tri[0].clone().add(tri[1]).add(tri[2]).normalize());for(const p of tri){const k=key(p);let e=map.get(k);if(!e){e={p,faces:[]};map.set(k,e)}e.faces.push(fi)}}const pos=[],edge=[],cell=[];let ci=0;for(const {p,faces} of map.values()){const up=Math.abs(p.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0),t1=new THREE.Vector3().crossVectors(p,up).normalize(),t2=new THREE.Vector3().crossVectors(p,t1),ring=faces.map(f=>cents[f]).sort((a,b)=>Math.atan2(a.dot(t2),a.dot(t1))-Math.atan2(b.dot(t2),b.dot(t1))),rnd=Math.abs(Math.sin((ci+1)*12.9898)*43758.5453)%1;ci++;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];for(const [v,e] of [[p,0],[a,1],[b,1]]){pos.push(v.x*R,v.y*R,v.z*R);edge.push(e);cell.push(rnd)}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aEdge',new THREE.Float32BufferAttribute(edge,1));g.setAttribute('aCell',new THREE.Float32BufferAttribute(cell,1));ico.dispose();return g}
/* Shield: a geodesic hex lattice (hexagons + 12 pentagons, the dual of an icosphere) with glowing cell borders, a Fresnel rim, a sweeping scan wave and per-cell twinkle. */
const shieldBubble=new THREE.Mesh(buildHexShieldGeometry(3.25,2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uColor:{value:new THREE.Color('#bfeeff')},uAlpha:{value:.3},uTime:{value:0}},vertexShader:`attribute float aEdge;attribute float aCell;varying vec3 vNormal;varying vec3 vView;varying float vEdge;varying float vCell;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*position);vView=normalize(-mv.xyz);vEdge=aEdge;vCell=aCell;vY=position.y;gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform vec3 uColor;uniform float uAlpha;uniform float uTime;varying vec3 vNormal;varying vec3 vView;varying float vEdge;varying float vCell;varying float vY;void main(){float ndv=max(dot(normalize(vNormal),normalize(vView)),0.);float fres=pow(1.-ndv,2.2);float line=smoothstep(.84,.975,vEdge);float glow=smoothstep(.55,1.,vEdge);float sweep=pow(.5+.5*sin(vY*.9-uTime*2.2),10.);float twinkle=pow(max(0.,sin(uTime*1.7+vCell*37.)),14.);float fill=.07+twinkle*.34+sweep*.16;float a=line*(.55+.45*sweep+.5*fres)+glow*.09+fill+fres*.5;a*=gl_FrontFacing?1.:.55;vec3 col=mix(uColor,vec3(1.),line*.5+twinkle*.4);gl_FragColor=vec4(col,clamp(a,0.,1.)*uAlpha*2.);}`}));shieldBubble.visible=false;scene.add(shieldBubble);
function renderAbilityHud(){const root=document.getElementById('abilityHud');root.innerHTML='';for(const [key,label,icon] of [['shield','Z','⬡'],['slow','X','Ⅱ'],['autopilot','V','<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8c.9 0 1.4.9 1.4 2v5.2l7.1 4.3v2l-7.1-2v3.6l1.9 1.5v1.6L12 20.6l-3.3 1v-1.6l1.9-1.5v-3.6l-7.1 2v-2l7.1-4.3V4.8c0-1.1.5-2 1.4-2z"/></svg>']]){const level=save.abilities[key];if(!level)continue;const b=document.createElement('button');b.className='ability-button';b.dataset.key=key;b.innerHTML=`<span class="ability-icon">${icon}</span><span class="ability-pips">${[1,2,3].map(i=>`<i class="${i<=level?'on':''}"></i>`).join('')}</span><small>${label}</small>`;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();b.classList.add('pressed')});b.addEventListener('pointerup',e=>{e.stopPropagation();b.classList.remove('pressed')});b.addEventListener('click',e=>{e.stopPropagation();activateAbility(key)});root.appendChild(b)}}renderAbilityHud();
