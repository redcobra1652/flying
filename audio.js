// Audio settings, synthesized soundtrack, and sound effects.
let perpLfo=null,audioCtx=null,audioMaster=null,audioMusicGain=null,audioSfxGain=null,audioMusicFilter=null,audioSfxFilter=null,shieldHum=null,musicTimer=null,musicStep=0,musicRunning=false;
const AUDIO_KEY='farflight-audio-v1';let audioSettings={master:.8,music:.72,sfx:.85,muted:false};try{const stored=JSON.parse(localStorage.getItem(AUDIO_KEY)||'null');if(stored)audioSettings={...audioSettings,...stored}}catch{}
for(const key of ['master','music','sfx'])audioSettings[key]=Number.isFinite(Number(audioSettings[key]))?clampN(Number(audioSettings[key]),0,1):.8;
state.muted=!!audioSettings.muted;state.reduced=!!audioSettings.reduced;document.body.classList.toggle('reduced',state.reduced);
function audioEnsure(){audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(!audioMaster){audioMaster=audioCtx.createGain();audioMusicGain=audioCtx.createGain();audioSfxGain=audioCtx.createGain();audioMusicFilter=audioCtx.createBiquadFilter();audioSfxFilter=audioCtx.createBiquadFilter();audioMusicFilter.type=audioSfxFilter.type='lowpass';audioMusicFilter.frequency.value=audioSfxFilter.frequency.value=22000;audioMusicFilter.connect(audioMusicGain).connect(audioMaster);audioSfxFilter.connect(audioSfxGain).connect(audioMaster);audioMaster.connect(audioCtx.destination);applyAudioSettings()}if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function audioBus(){audioEnsure();return audioSfxFilter}
function persistAudio(){try{localStorage.setItem(AUDIO_KEY,JSON.stringify(audioSettings))}catch{}}
function applyAudioSettings(){if(!audioMaster)return;const now=audioCtx.currentTime;audioMaster.gain.setTargetAtTime(state.muted?0:audioSettings.master,now,.04);audioMusicGain.gain.setTargetAtTime(audioSettings.music,now,.04);audioSfxGain.gain.setTargetAtTime(audioSettings.sfx,now,.025)}
function updateAudio(){if(!audioCtx)return;wellHumTick();const slow=state.mode==='PLAYING'?state.worldScale:1,filter=slow<.98?lerpN(2100,680,1-slow):22000;audioMusicFilter.frequency.setTargetAtTime(filter,audioCtx.currentTime,.12);audioSfxFilter.frequency.setTargetAtTime(slow<.98?2800:22000,audioCtx.currentTime,.12);if(musicRunning)musicTargetTempo=musTempoFor(musTheme)}
const audioSettingInputs=[['masterVolume','masterValue','master'],['musicVolume','musicValue','music'],['sfxVolume','sfxValue','sfx']];
function initSettingsUI(){audioSettingInputs.forEach(([id,out,key])=>{const input=document.getElementById(id),output=document.getElementById(out);input.value=Math.round(audioSettings[key]*100);output.value=`${input.value}%`;output.textContent=output.value;input.addEventListener('input',()=>{audioSettings[key]=Number(input.value)/100;output.value=`${input.value}%`;output.textContent=output.value;persistAudio();audioEnsure();applyAudioSettings()})});const toggle=document.getElementById('soundToggle');const sync=()=>{toggle.textContent=state.muted?'SOUND OFF':'SOUND ON';toggle.setAttribute('aria-pressed',String(state.muted))};sync();toggle.addEventListener('click',()=>{state.muted=!state.muted;audioEnsure();applyAudioSettings();audioSettings.muted=state.muted;persistAudio();sync()});const panel=document.getElementById('settings');const close=()=>{panel.classList.remove('active');panel.setAttribute('aria-hidden','true')};document.getElementById('openSettings').addEventListener('click',()=>{panel.classList.add('active');panel.setAttribute('aria-hidden','false')});document.getElementById('closeSettings').addEventListener('click',close);panel.addEventListener('click',e=>{if(e.target===panel)close()});window.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('active'))close()})}
initSettingsUI();
/* ---- Display: brightness + contrast. Applied as a CSS filter on the WebGL canvas so sky, terrain and plane all shift together.
   Saved separately from audio. The filter is removed entirely at 100/100 so default players pay nothing for it. ---- */
(function(){
  const KEY='farflight-display-v1',cfg={brightness:100,contrast:100};
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw){cfg.brightness=Math.min(160,Math.max(70,Number(raw.brightness)||100));cfg.contrast=Math.min(140,Math.max(80,Number(raw.contrast)||100))}}catch{}
  const bS=document.getElementById('brightnessSlider'),cS=document.getElementById('contrastSlider'),bO=document.getElementById('brightnessValue'),cO=document.getElementById('contrastValue'),reset=document.getElementById('displayReset');
  const apply=()=>{
    bS.value=cfg.brightness;cS.value=cfg.contrast;bO.textContent=bO.value=cfg.brightness+'%';cO.textContent=cO.value=cfg.contrast+'%';
    renderer.domElement.style.filter=(cfg.brightness===100&&cfg.contrast===100)?'':`brightness(${cfg.brightness/100}) contrast(${cfg.contrast/100})`;
    reset.disabled=cfg.brightness===100&&cfg.contrast===100;reset.style.opacity=reset.disabled?.45:1;
  };
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch{}};
  bS.addEventListener('input',()=>{cfg.brightness=Number(bS.value);apply();save()});
  cS.addEventListener('input',()=>{cfg.contrast=Number(cS.value);apply();save()});
  reset.addEventListener('click',()=>{cfg.brightness=100;cfg.contrast=100;apply();save()});
  apply();
})();
/* ---- Reduced flashing toggles (Settings + warning screen). saved with the audio settings ---- */
(function(){const btns=[document.getElementById('reduceToggle'),document.getElementById('warnReduce')];
  const sync=()=>{for(const b of btns){b.textContent=`REDUCED FLASHING: ${state.reduced?'ON':'OFF'}`;b.setAttribute('aria-pressed',String(state.reduced))}document.body.classList.toggle('reduced',state.reduced)};
  for(const b of btns)b.addEventListener('click',()=>{state.reduced=!state.reduced;audioSettings.reduced=state.reduced;persistAudio();sync()});sync()})();


let musicTargetTempo=110,musTheme='idle',musProg=0,musNext=0;
const MUSIC_MAPS=14;
const MUS={buses:{},comp:null,compC:null,ir:null,irC:null,shape:{},cur:null};
const MUS_TRIM={idle:.95,flight:1,perplexity:1.05,horizon:1};
const MUS_TEMPO={idle:72,perplexity:168,horizon:108};
function midiHz(n){return 440*Math.pow(2,(n-69)/12)}
/* ---------- bus / routing ---------- */
function musOut(){const c=audioCtx;if(MUS.comp&&MUS.compC===c)return MUS.comp;const k=c.createDynamicsCompressor();k.threshold.value=-20;k.knee.value=10;k.ratio.value=3.5;k.attack.value=.006;k.release.value=.2;k.connect(audioMusicFilter);MUS.comp=k;MUS.compC=c;return k}
function musVerbIR(){const c=audioCtx;if(MUS.ir&&MUS.irC===c)return MUS.ir;const len=c.sampleRate*3.2|0,ir=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let lp=0;for(let i=0;i<len;i++){const t=i/len;lp+=((Math.random()*2-1)-lp)*(.5-.42*t);d[i]=lp*Math.pow(1-t,2.2)*Math.min(1,i/400)}}MUS.ir=ir;MUS.irC=c;return ir}
function musBus(name){const c=audioCtx,b=MUS.buses[name];if(b&&b.c===c)return b;const fade=c.createGain(),dry=c.createGain(),wet=c.createGain(),conv=c.createConvolver(),wg=c.createGain();fade.gain.value=.0001;conv.buffer=musVerbIR();wg.gain.value=.8;dry.connect(fade);wet.connect(conv);conv.connect(wg);wg.connect(fade);fade.connect(musOut());return MUS.buses[name]={c,fade,dry,wet}}
function musCur(){if(MUS.cur&&MUS.cur.c===audioCtx)return MUS.cur;audioEnsure();return MUS.cur=musBus(musTheme||'flight')}
function musSwitch(name,instant){const c=audioCtx,now=c.currentTime,nb=musBus(name);MUS.cur=nb;for(const k in MUS.buses){const b=MUS.buses[k];if(b.c!==c)continue;const on=k===name,g=b.fade.gain;g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.setTargetAtTime(on?(MUS_TRIM[k]||1):.0001,now,instant?.01:(on?.45:.3))}}
function musWire(g,wet){const cur=musCur();g.connect(cur.dry);if(wet>0){const w=audioCtx.createGain();w.gain.value=wet;g.connect(w);w.connect(cur.wet)}}
/* ---------- voices ---------- */
/* plucked/short note: attack then exponential decay. bus argument kept for old callers (an explicit non-music-filter node is honoured) */
function synthNote(freq,time,duration,volume,wave='sawtooth',bus,cut=4800,wet=0,att=.012,det=0){
  const osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();att=Math.min(att,duration*.5);
  osc.type=wave;osc.frequency.setValueAtTime(freq,time);if(det)osc.detune.value=det;filter.type='lowpass';filter.frequency.setValueAtTime(cut,time);
  gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(volume,time+att);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(filter).connect(gain);if(bus&&bus!==audioMusicFilter)gain.connect(bus);else musWire(gain,wet);
  osc.start(time);osc.stop(time+duration+.025)}
/* sustained pad: attack / hold / release, optional filter sweep, 1-2 detuned oscillators */
function musPad(freq,t,dur,vol,o){o=o||{};const c=audioCtx,g=c.createGain(),lp=c.createBiquadFilter(),att=Math.min(o.att??.4,dur*.5),rel=Math.min(o.rel??.6,dur*.5),det=o.det??8,two=det!==0&&o.voices!==1;
  lp.type='lowpass';lp.Q.value=.5;lp.frequency.setValueAtTime(o.cut||1200,t);if(o.cut2)lp.frequency.linearRampToValueAtTime(o.cut2,t+dur*.8);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.setValueAtTime(vol,t+dur-rel);g.gain.linearRampToValueAtTime(.0001,t+dur);
  for(const d of two?[-det,det]:[0]){const os=c.createOscillator();os.type=o.wave||'sawtooth';os.frequency.setValueAtTime(freq,t);os.detune.value=d;os.connect(lp);os.start(t);os.stop(t+dur+.05)}
  lp.connect(g);musWire(g,o.wet||0)}
/* oscillator sweep / tone with optional rise */
function musT(type,t,dur,f0,f1,vol,o){o=o||{};const c=audioCtx,os=c.createOscillator(),g=c.createGain();os.type=type;os.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(f1,t+dur*(o.sweep??1));
  g.gain.setValueAtTime(.0001,t);if(o.rise){g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+dur*.95);g.gain.linearRampToValueAtTime(.0001,t+dur)}else{g.gain.linearRampToValueAtTime(vol,t+Math.min(o.att??.003,dur*.4));g.gain.exponentialRampToValueAtTime(.0001,t+dur)}
  let n=os;if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;n.connect(f);n=f}n.connect(g);musWire(g,o.wet||0);os.start(t);os.stop(t+dur+.03)}
/* filtered noise: o.swell = swell up then fall, otherwise attack + decay */
function musNoise(t,dur,vol,o){o=o||{};const c=audioCtx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=sfxNoise(o.kind||'white');
  f.type=o.type||'highpass';f.frequency.setValueAtTime(o.f0||6000,t);if(o.f1&&o.f1!==o.f0)f.frequency.exponentialRampToValueAtTime(o.f1,t+dur);f.Q.value=o.q??.7;
  g.gain.setValueAtTime(.0001,t);if(o.swell){g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+dur*.85);g.gain.linearRampToValueAtTime(.0001,t+dur)}else{g.gain.linearRampToValueAtTime(vol,t+(o.att??.002));g.gain.exponentialRampToValueAtTime(.0001,t+dur)}
  s.connect(f);f.connect(g);musWire(g,o.wet||0);s.start(t,Math.random()*Math.max(0,5.8-dur));s.stop(t+dur+.03)}
function musicKick(time,vol,hard){const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.setValueAtTime(hard?175:142,time);osc.frequency.exponentialRampToValueAtTime(hard?34:38,time+(hard?.16:.18));gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(vol,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+.22);osc.connect(gain);musWire(gain,0);osc.start(time);osc.stop(time+.23);if(hard)musNoise(time,.02,vol*.35,{f0:3000,att:.0007})}
function musHat(t,vol,open){musNoise(t,open?.2:.035,vol,{f0:7500,q:.5,att:.001})}
function musSnare(t,vol,wet,heavy){musNoise(t,heavy?.24:.15,vol,{type:'bandpass',f0:heavy?2200:1800,f1:900,q:.7,wet:wet||0,att:.001});musT('triangle',t,.13,heavy?210:190,120,vol*.9,{wet:wet||0})}
function musTom(t,f,vol,wet){musT('sine',t,.3,f,f*.55,vol,{wet:wet??.2,sweep:.8});musNoise(t,.03,vol*.25,{type:'bandpass',f0:1200,q:1,att:.001})}
function musBoom(t,vol,dur){musT('sine',t,dur||.6,58,28,vol,{sweep:.8,att:.004,wet:.2})}
function musCrash(t,vol,wet){musNoise(t,1.6,vol,{f0:4200,q:.4,wet:wet??.35,att:.002})}
function musBell(f,t,dur,vol,wet){for(const [r,v,d] of [[1,1,1],[2.76,.5,.6],[5.4,.25,.35]]){if(f*r<12000)musT('sine',t,dur*d,f*r,0,vol*v,{att:.002,wet})}}
function musShaper(k){return MUS.shape[k]||(MUS.shape[k]=(()=>{const n=1024,cu=new Float32Array(n),nm=Math.tanh(k);for(let i=0;i<n;i++)cu[i]=Math.tanh((i*2/n-1)*k)/nm;return cu})())}
/* distorted bass: saw through a waveshaper + clean sine sub for weight */
function musDist(freq,t,dur,vol,k,cut,wet){const c=audioCtx,o=c.createOscillator(),sub=c.createOscillator(),ws=c.createWaveShaper(),lp=c.createBiquadFilter(),g=c.createGain(),sg=c.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(freq,t);sub.type='sine';sub.frequency.setValueAtTime(freq,t);ws.curve=musShaper(k);lp.type='lowpass';lp.frequency.setValueAtTime(cut,t);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);sg.gain.value=.7;
  o.connect(ws);ws.connect(lp);lp.connect(g);sub.connect(sg);sg.connect(g);musWire(g,wet||0);o.start(t);sub.start(t);o.stop(t+dur+.03);sub.stop(t+dur+.03)}
/* ---------- progress through the 14 maps (0..1), smoothed by the flight scheduler ---------- */
function musProgTarget(){const L=Number.isFinite(state.level)?state.level:0,lm=(typeof CONFIG!=='undefined'&&CONFIG.levelMeters)||1000,fr=Number.isFinite(state.distance)&&Number.isFinite(state.levelStart)?clampN((state.distance-state.levelStart)/lm,0,1):0;return clampN((L+fr)/MUSIC_MAPS,0,1)}
function musTempoFor(theme){return theme==='flight'?104+36*musProgTarget():(MUS_TEMPO[theme]||110)}
function musStepDur(){const sc=(musTheme!=='idle'&&state.mode==='PLAYING')?Math.max(.52,state.worldScale):1;return 60/(musicTargetTempo*sc)/4}

/* ================= IDLE: slow ambient (Am9 - Fmaj7 - Cmaj7 - G6, two bars each). pads, sub, sparse reverberant plucks, bells, wind ================= */
const IDLE_CH=[{r:45,pad:[57,60,64,67],arp:[64,67,69,71,72,76]},{r:41,pad:[53,57,60,64],arp:[65,69,72,76,77,81]},{r:48,pad:[55,59,60,64],arp:[67,71,72,76,79,83]},{r:43,pad:[55,59,62,64],arp:[62,67,71,74,76,79]}];
const IDLE_MASK=['1001001000100100','0010010010001001','1000100100100010','0100100010010010'];
function stepIdle(t,sd){
  const bar=musicStep>>4,s=musicStep&15,ch=IDLE_CH[(bar>>1)&3],bd=16*sd;
  if(s===0){
    musPad(midiHz(ch.r-12),t,bd*1.1,.07,{wave:'sine',att:.3,rel:.8,cut:300,voices:1});musPad(midiHz(ch.r),t,bd*1.05,.026,{wave:'triangle',att:.4,rel:.8,cut:500,voices:1});
    if(!(bar&1)){for(const n of ch.pad)musPad(midiHz(n),t,bd*2+.8,.017,{wave:'triangle',att:2.4,rel:2.6,cut:1100,cut2:1700,det:7,wet:.9});musPad(midiHz(ch.pad[0]),t,bd*2+.8,.006,{wave:'sawtooth',att:3,rel:3,cut:420,det:5,wet:.6})}
    if((bar&3)===3)musNoise(t,bd*1.5,.016,{kind:'pink',type:'bandpass',f0:260,f1:1100,q:.8,swell:true,wet:.8})}
  if(IDLE_MASK[bar&3][s]==='1')synthNote(midiHz(ch.arp[(bar*3+s)%ch.arp.length]),t,1.7,.024,'triangle',undefined,2400,.85,.008);
  if(s===8&&(bar&3)===2)musBell(midiHz(ch.arp[5]+12),t,3,.016,.9)}

/* ================= FLIGHT: the base theme, evolving over all 14 maps =================
   progress p = (map index + fraction of the map) / 14, smoothed. Layers fade in gradually (L(a,b) = 0..1 ramp between p=a and p=b):
   0.00 kick, root/fifth bass, pad, hook   |  .10-.28 off-beat hats  |  .12-.34 off-beat bass  |  .12 octave hook, .34 form grows to 8 bars (second half = new melody, Dm/E turnaround)
   .28-.48 backbeat snare  |  .38-.58 16th arpeggio  |  .45 open hats  |  .55-.8 supersaw pad, detuned lead, risers, crash  |  .6-.82 driving 16th bass  |  tempo 104 -> 140 */
/* the original hook + chord loop (maps 1-4 of the form) */
const FLIGHT_MELODY=[57,60,60,64,67,64,60,57, 57,60,65,65,69,65,60,57, 55,60,60,64,67,64,60,55, 55,59,62,67,67,62,59,55];
const FLIGHT_CHORDS=[{root:45,third:3,fifth:7},{root:41,third:4,fifth:7},{root:48,third:4,fifth:7},{root:43,third:4,fifth:7}];
const FLIGHT_MELODY_B=[64,64,67,69,72,69,67,64, 65,65,69,72,72,69,65,60, 62,65,69,69,74,69,65,62, 64,68,71,76,71,68,64,59];
const FLIGHT_CHORDS8=[...FLIGHT_CHORDS,{root:45,third:3,fifth:7},{root:41,third:4,fifth:7},{root:50,third:3,fifth:7},{root:52,third:4,fifth:7}];
function stepFlight(t,sd){
  musProg+=(musProgTarget()-musProg)*.035;
  const p=musProg,L=(a,b)=>clampN((p-a)/(b-a),0,1),n8=p>=.34?8:4,bar=(musicStep>>4)%n8,s=musicStep&15,beat=s>>2,chord=FLIGHT_CHORDS8[bar],bd=16*sd;
  if(s%4===0){musicKick(t,.1+.07*L(0,.45)+.03*p);const bass=midiHz(chord.root-12+(beat%2?7:0));synthNote(bass,t,sd*2.3,.07+.02*p,'triangle',undefined,420);synthNote(bass*2,t,sd*1.8,.016+.01*p,'sawtooth',undefined,820)}
  const ob=L(.12,.34);if(ob>0&&s%4===2)synthNote(midiHz(chord.root-12+(beat%2?0:7)),t,sd*1.6,.045*ob,'triangle',undefined,520);
  const dr=L(.6,.82);if(dr>0&&s%2===1)synthNote(midiHz(chord.root-12+((s>>1)%2?12:0)),t,sd*1.2,.035*dr,'sawtooth',undefined,650);
  const h=L(.1,.28);if(h>0&&s%4===2)musHat(t,.02*h);
  if(p>.5&&s%2===1)musHat(t,.008*L(.5,.7));if(p>.45&&s===14)musHat(t,.018,true);
  const sn=L(.28,.48);if(sn>0&&(s===4||s===12))musSnare(t,.05+.04*L(.28,.6),.15);
  if(s===0){const pb=1+p*.5;synthNote(midiHz(chord.root+12),t,bd*.87,.018*pb,'triangle',undefined,1250);synthNote(midiHz(chord.root+12+chord.third),t,bd*.87,.014*pb,'triangle',undefined,1550);synthNote(midiHz(chord.root+19),t,bd*.87,.011*pb,'sawtooth',undefined,1950);
    const sp=L(.55,.82);if(sp>0)for(const iv of [0,chord.third,7])musPad(midiHz(chord.root+24+iv),t,bd*.95,.009*sp,{wave:'sawtooth',att:.3,rel:.5,cut:1900,cut2:3200,det:9,wet:.3});
    if(bar===0&&p>.5)musCrash(t,.03*L(.5,.8));
    if(bar===n8-1&&p>.5)musNoise(t,bd,.02*L(.5,.8),{f0:500,f1:6000,q:.6,swell:true,wet:.15})}
  if(bar===n8-1&&p>.6&&s>=12)musSnare(t,.025+.01*(s-12),.1);
  if(s%2===0){const mi=(bar<4?FLIGHT_MELODY:FLIGHT_MELODY_B)[(bar&3)*8+(s>>1)],f=midiHz(mi);
    synthNote(f,t,sd*1.8,.036+.012*p,'sawtooth',undefined,2200+1000*L(0,.4)+800*p);
    if(p>.12&&s%8===0)synthNote(midiHz(mi+12),t,sd*1.6,.012+.02*p,'triangle',undefined,4300);
    if(p>.5&&s%4===2)synthNote(midiHz(mi+12),t,sd*1.5,.009+.01*p,'triangle',undefined,4300);
    const sh=L(.55,.8);if(sh>0)synthNote(f*1.008,t,sd*1.8,.018*sh,'sawtooth',undefined,2600)}
  const ar=L(.38,.58);if(ar>0&&s%2===1)synthNote(midiHz(chord.root+24+[0,chord.third,chord.fifth,12][(s>>1)&3]),t,sd*1.5,.014*ar,'triangle',undefined,3000,.15)}

/* ================= PERPLEXITY: full boss. 168 bpm, 16-bar form (A = ostinato, B = lead motif). bass roots A A Bb A | A C B Bb ================= */
const PERP_ROOTS=[33,33,34,33,33,36,35,34];
const PERP_KICK=['1001101010011010','1010101010101011'],PERP_BASS=['1011011010110110','1101110111011101'],PERP_STAB=[[0,6],[0,3,6,10]];
const PERP_LEAD=[[76,0,0,77,0,76,0,73,0,0,70,0,73,0,69,0],[69,0,0,70,0,69,0,67,0,0,69,0,70,0,73,0],[76,0,0,77,0,79,0,77,0,0,76,0,73,0,70,0],[69,0,69,0,70,0,73,0,74,0,0,0,73,0,0,0],
 [81,0,0,79,0,77,0,76,0,0,77,0,76,0,73,0],[74,0,0,76,0,77,0,76,0,0,73,0,74,0,76,0],[77,0,77,0,79,0,81,0,79,0,77,0,76,0,73,0],[76,0,0,0,73,0,0,0,70,0,0,0,69,0,0,0]];
function stepPerp(t,sd){
  const ba=musicStep>>4,bar=ba&7,sec=(ba>>3)&1,s=musicStep&15,root=PERP_ROOTS[bar],bd=16*sd,fill=bar===7&&s>=12;
  if(!fill&&PERP_KICK[sec][s]==='1')musicKick(t,.2,true);
  if(fill)musTom(t,[200,165,135,105][s-12],.14,.25);else if(s===4||s===12)musSnare(t,.1,.25,true);
  if(sec||s%2===0)musHat(t,.012+(s%4===0?.01:0));
  if(s===0){if(bar===0)musCrash(t,ba%16===0?.07:.05,.4);if(bar%4===0){musBoom(t,.24,.7);for(const iv of [0,7,12,18])synthNote(midiHz(root+24+iv),t,1.2,.026,'sawtooth',undefined,3000,.4,.005)}
    if(sec)for(const iv of (bar===7?[0,3,6,9]:[0,3,7,10]))musPad(midiHz(root+24+iv),t,bd*.97,.011,{wave:'sawtooth',att:.45,rel:.4,cut:1300,cut2:2400,det:10,wet:.5});
    else for(const iv of [0,1,6])musPad(midiHz(root+36+iv),t,bd,.011,{wave:'triangle',att:.1,rel:.4,cut:1800,det:6});
    if(bar===7)musNoise(t,bd,.035,{f0:400,f1:7000,q:.6,swell:true,wet:.2});if(bar===7)musT('sawtooth',t,bd,110,880,.025,{rise:true,lp:2400,wet:.2})}
  if(PERP_BASS[sec][s]==='1'){let iv=0;if(s%8===3)iv=12;if(s%8===6)iv=1;if(s===14&&(bar&3)===3)iv=6;musDist(midiHz(root+iv),t,sd*1.6,.08,3,950)}
  if(PERP_STAB[sec].includes(s)){for(const iv of [0,3,6]){const f=midiHz(root+24+iv);synthNote(f,t,sd*2.2,.022,'sawtooth',undefined,2600,.15,.006,-9);synthNote(f,t,sd*2.2,.022,'sawtooth',undefined,2600,.15,.006,9)}}
  if(!sec&&s>=12){const f=midiHz(72+(s&3));synthNote(f,t,sd*1.4,.03,'square',undefined,3200,.1);synthNote(f*1.013,t,sd*1.4,.02,'sawtooth',undefined,3200)}
  if(sec){const ln=PERP_LEAD[bar][s];if(ln){const f=midiHz(ln);synthNote(f,t,sd*2.4,.045,'sawtooth',undefined,3800,.2);synthNote(f*1.013,t,sd*2.4,.03,'sawtooth',undefined,3400);synthNote(f*.5,t,sd*2.4,.02,'square',undefined,1400);if(bar>=4)synthNote(f*2,t,sd*2,.015,'triangle',undefined,4500)}}}

/* ================= EVENT HORIZON: half-way boss. 108 bpm half-time pulse, Cm Cm Ab Bb | Cm Fm Db G.
   The arpeggio each bar slows down note by note (time dilation), a gravity drone and accretion swells sit underneath, last bar falls into the well ================= */
const EH_BASS=[36,36,32,34,36,41,37,31];
const EH_PAD=[[55,60,63,67],[55,60,63,67],[56,60,63,67],[58,62,65,69],[55,60,63,67],[53,56,60,65],[61,65,68,72],[55,59,62,68]];
const EH_LEAD=[[[0,79],[8,75],[12,77]],[[0,75],[6,74],[8,72]],[[0,80],[8,77],[12,75]],[[0,74],[6,77],[10,82]],[[0,84],[8,79],[12,75]],[[0,80],[6,77],[8,72],[12,80]],[[0,77],[6,80],[8,84],[12,80]],[[0,83],[8,79],[12,74]]];
function stepHorizon(t,sd){
  const ba=musicStep>>4,bar=ba&7,s=musicStep&15,bass=EH_BASS[bar],pad=EH_PAD[bar],bd=16*sd;
  if(s===0)musicKick(t,.16);if(s===6)musicKick(t,.09);
  if(s===8)musSnare(t,.07,.5,true);
  if(s%4===2)musHat(t,.01);
  if(bar===7&&s>=14)musTom(t,s===14?150:110,.08,.4);
  if(s===0||s===10||(bar&1&&s===3))musDist(midiHz(bass),t,sd*(s===0?14:5),s===0?.07:.04,1.8,500);
  if(s===0){
    for(const n of pad)musPad(midiHz(n),t,bd+.3,.012,{wave:'sawtooth',att:1.1,rel:1.2,cut:600,cut2:1500,det:9,wet:.7});
    if(!(bar&1))musPad(midiHz(bass),t,bd*2,.03,{wave:'sawtooth',att:.8,rel:1.5,cut:240,det:6,wet:.2});
    if(bar===0){musCrash(t,.02,.5);musBoom(t,.12,.8)}if(bar===4)musBoom(t,.12,.8);
    if(bar&1)musNoise(t,bd*1.8,.02,{kind:'pink',type:'bandpass',f0:200,f1:1800,q:.9,swell:true,wet:.6});
    if(bar===7)musT('sine',t,bd,80,420,.03,{rise:true,wet:.3});
    /* time dilation: each gap is 1.3x the previous one */
    const r=1.3;let sum=0,cum=0;for(let i=0;i<8;i++)sum+=Math.pow(r,i);
    for(let i=0;i<8;i++){const n=pad[[0,1,2,3,2,3,1,3][i]]+12+(i>=4?12:0);synthNote(midiHz(n),t+bd*.96*cum/sum,1.2+i*.15,.016*(1-i*.05),'triangle',undefined,2500,.6,.01);cum+=Math.pow(r,i)}}
  if(bar===7&&s===8)musT('sine',t,bd*.5,900,60,.05,{wet:.4});
  for(const [st,nt] of EH_LEAD[bar])if(st===s){const f=midiHz(nt);synthNote(f,t,sd*7,.04,'sawtooth',undefined,1700,.5,.05);synthNote(f,t,sd*7,.03,'sine',undefined,2500,.5,.05)}}

/* ================= theme control ================= */
const MUS_STEP={idle:stepIdle,flight:stepFlight,perplexity:stepPerp,horizon:stepHorizon};
function musEhLevel(){return typeof EH_IDX==='number'?EH_IDX:typeof EVENT_HORIZON_IDX==='number'?EVENT_HORIZON_IDX:typeof HORIZON_IDX==='number'?HORIZON_IDX:-1}
function musThemeForLevel(level){if(typeof PERP_IDX!=='undefined'&&level>=PERP_IDX)return 'perplexity';const eh=musEhLevel();return eh>=0&&level===eh?'horizon':'flight'}
function perpTremolo(){}/* retired: kept so old call sites don't break */
function musTick(){if(!musicRunning||!audioCtx)return;const c=audioCtx;if(musNext<c.currentTime)musNext=c.currentTime+.03;let n=0;while(musNext<c.currentTime+.14&&n++<8){const sd=musStepDur();try{MUS_STEP[musTheme](musNext,sd)}catch{}musicStep++;musNext+=sd}musicTimer=setTimeout(musTick,28)}
function scheduleMusicStep(){musTick()}
function startMusic(restart=true,theme){try{
  audioEnsure();if(typeof theme!=='string')theme=theme===true?'perplexity':theme===false?'flight':(state.arena?'horizon':musThemeForLevel(state.level));
  if(!MUS_STEP[theme])theme='flight';
  const changed=theme!==musTheme||!musicRunning;musTheme=theme;state.perpMusic=theme==='perplexity';state.ehMusic=theme==='horizon';
  if(restart||changed){musicStep=0;musProg=musProgTarget();musNext=audioCtx.currentTime+.05}
  musicTargetTempo=musTempoFor(theme);musSwitch(theme,false);
  if(musicTimer)clearTimeout(musicTimer);musicRunning=true;musTick()}catch{}}
function playIdleMusic(restart=false){startMusic(restart,'idle')}
function stopMusic(){musicRunning=false;if(musicTimer)clearTimeout(musicTimer);musicTimer=null;try{if(audioCtx&&MUS.cur&&MUS.cur.c===audioCtx){const g=MUS.cur.fade.gain,now=audioCtx.currentTime;g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.setTargetAtTime(.0001,now,.12)}}catch{}}
/* ================= MUSIC DIRECTOR =================
   Picks the theme from game state, so every path in the game (start, crash, continue, home, shop, arena, Perplexity) gets the right music
   without each call site having to know about it. Runs on a 200 ms timer (independent of the frame loop) and only acts when the wanted theme differs.
     HOME / SHOP / DEAD              -> idle   (after 1.4 s on the death screen so the crash SFX can breathe)
     PLAYING / PAUSED, Event Horizon -> horizon,  level >= PERP_IDX -> perplexity,  otherwise flight
     GATE / CUT1 / CUT2              -> hands off: the engine fades/stops the music itself during the warning gate and cutscenes
   Browsers block audio until the first click/key, so the director waits for one (plus 350 ms, so a click on TAKE FLIGHT doesn't flash idle first). */
let musGesture=false,musModeSeen=null,musModeSince=0;
function musWanted(){const m=state.mode;if(m==='GATE'||m==='CUT1'||m==='CUT2')return null;if(m==='PLAYING'||m==='PAUSED')return state.arena?'horizon':musThemeForLevel(state.level);if(m==='HOME'||m==='SHOP'||m==='DEAD')return 'idle';return null}
function musDirector(){try{const m=state.mode,now=performance.now();if(m!==musModeSeen){musModeSeen=m;musModeSince=now}
  if(!musGesture)return;const want=musWanted();if(!want)return;if(want==='idle'&&m==='DEAD'&&now-musModeSince<1400)return;
  if(!musicRunning||musTheme!==want)startMusic(true,want)}catch{}}
setInterval(musDirector,200);
(function(){const ev=['pointerdown','keydown'],go=()=>{for(const e of ev)window.removeEventListener(e,go);setTimeout(()=>{musGesture=true;musDirector()},350)};for(const e of ev)window.addEventListener(e,go)})();
/* ================= SFX ENGINE v2 =================
   Every sound effect is synthesised here (music code is untouched). Shared pieces:
   cached noise buffers (white / pink / brown), a generated stereo room reverb, and a compressor that glues
   the layers of big explosions together so they hit hard without clipping. All of it feeds the SFX bus, so the
   volume settings, mute and slow-mo muffling keep working. */
const SFX={nz:{},verb:null,verbC:null,comp:null,compC:null,shape:{}};
function sfxNoise(kind){
  const c=audioCtx,k=SFX.nz[kind];if(k&&k.sampleRate===c.sampleRate)return k;
  const n=c.sampleRate*6|0,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
  if(kind==='white'){for(let i=0;i<n;i++)d[i]=Math.random()*2-1}
  else if(kind==='pink'){let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}}
  else{let l=0;for(let i=0;i<n;i++){l=(l+.02*(Math.random()*2-1))/1.02;d[i]=l*3.5}}
  SFX.nz[kind]=b;return b
}
function sfxDest(){
  const c=audioCtx;if(SFX.comp&&SFX.compC===c)return SFX.comp;
  const k=c.createDynamicsCompressor();k.threshold.value=-16;k.knee.value=8;k.ratio.value=5;k.attack.value=.002;k.release.value=.22;k.connect(audioBus());
  SFX.comp=k;SFX.compC=c;return k
}
function sfxVerb(){
  const c=audioCtx;if(SFX.verb&&SFX.verbC===c)return SFX.verb;
  const len=c.sampleRate*2.4|0,ir=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let lp=0;for(let i=0;i<len;i++){const t=i/len;lp+=((Math.random()*2-1)-lp)*(.7-.6*t);d[i]=lp*Math.pow(1-t,2.8)*Math.min(1,i/90)}}
  const conv=c.createConvolver();conv.buffer=ir;const inp=c.createGain(),out=c.createGain();out.gain.value=.55;inp.connect(conv);conv.connect(out);out.connect(sfxDest());
  SFX.verb=inp;SFX.verbC=c;return inp
}
function sfxShaper(k){
  if(SFX.shape[k])return SFX.shape[k];
  const n=1024,cu=new Float32Array(n),nm=Math.tanh(k);for(let i=0;i<n;i++)cu[i]=Math.tanh((i*2/n-1)*k)/nm;
  return SFX.shape[k]=cu
}
function sfxOut(node,wet,pan){
  let o=node;
  if(pan&&audioCtx.createStereoPanner){const p=audioCtx.createStereoPanner();p.pan.value=clampN(pan,-1,1);node.connect(p);o=p}
  o.connect(sfxDest());
  if(wet>0){const g=audioCtx.createGain();g.gain.value=wet;o.connect(g);g.connect(sfxVerb())}
}
/* gain envelope: o.env = [[time, level 0-1], ...] shape, o.rise = swell up to the end, otherwise attack + exponential decay */
function sfxEnv(g,t,dur,vol,att,o){
  g.gain.setValueAtTime(.0001,t);
  if(o.env){for(const e of o.env)g.gain.linearRampToValueAtTime(Math.max(.0001,e[1]*vol),t+Math.min(e[0],dur));g.gain.linearRampToValueAtTime(.0001,t+dur)}
  else if(o.rise){g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+dur*.97);g.gain.linearRampToValueAtTime(.0001,t+dur+.03)}
  else{g.gain.linearRampToValueAtTime(vol,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur)}
}
/* filtered noise burst */
function sfxN(kind,t,dur,o){
  o=o||{};const c=audioCtx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),f0=o.f0||1000,f1=o.f1||f0;
  s.buffer=sfxNoise(kind);f.type=o.type||'lowpass';f.frequency.setValueAtTime(f0,t);if(f1!==f0)f.frequency.exponentialRampToValueAtTime(f1,t+dur);f.Q.value=o.q??.7;
  sfxEnv(g,t,dur,o.vol??.3,o.att??.003,o);
  s.connect(f);f.connect(g);sfxOut(g,o.wet??.15,o.pan);
  s.start(t,Math.random()*Math.max(0,6-dur-.1));s.stop(t+dur+.05)
}
/* oscillator tone / sweep */
function sfxT(type,t,dur,f0,f1,o){
  o=o||{};const c=audioCtx,os=c.createOscillator(),g=c.createGain();
  os.type=type;os.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(f1,t+dur*(o.sweep??1));if(o.det)os.detune.value=o.det;
  sfxEnv(g,t,dur,o.vol??.2,o.att??.004,o);
  let n=os;
  if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;n.connect(f);n=f}
  if(o.shape){const w=c.createWaveShaper();w.curve=sfxShaper(o.shape);n.connect(w);n=w}
  n.connect(g);sfxOut(g,o.wet??0,o.pan);os.start(t);os.stop(t+dur+.05)
}
/* struck-metal ring: inharmonic partials with different decay times */
function sfxPing(t,f,dur,vol,pan,wet){
  for(const [r,v,d] of [[1,1,1],[2.76,.55,.6],[5.4,.3,.35]]){if(f*r<16000)sfxT('sine',t,dur*d,f*r,0,{vol:vol*v,att:.0015,pan,wet:wet??.25})}
}

/* ---------- PLANE CRASH ----------
   0.00 s  impact transient + metal crunch + canopy glass
   0.00 s  body thump / sub drop, debris clatter bouncing away, fuselage scrape
   0.05 s  fireball whoomph and roar
   ~0.95 s secondary fuel explosion
   0.5-3.5 s fire crackle and a long rumbling tail through the reverb */
function crashSound(){try{
  audioEnsure();const t=audioCtx.currentTime+.005,R=Math.random,rr=(a,b)=>a+R()*(b-a);
  /* short punchy burst (hard crack + mid body + debris crunch), then bright crackling fire. no long low rumble */
  sfxN('white',t,.04,{type:'highpass',f0:2500,f1:1200,vol:.6,att:.0007,wet:.1});
  sfxN('pink',t,.35,{type:'bandpass',f0:1500,f1:400,q:.6,vol:.7,att:.001,wet:.2});
  sfxN('brown',t,.55,{f0:2200,f1:150,vol:.9,att:.002,wet:.2});
  sfxT('sine',t,.5,120,35,{vol:.8,att:.002,sweep:.8,shape:2.2});
  for(let i=0;i<10;i++)sfxN('pink',t+.05+R()*.5,rr(.03,.09),{type:'bandpass',f0:rr(600,2500),q:1.2,vol:rr(.08,.2),att:.002,wet:.15,pan:rr(-.5,.5)});
  sfxN('pink',t+.3,3,{type:'bandpass',f0:1800,f1:700,q:.5,vol:.1,att:.2,wet:.1});
  for(let i=0;i<80;i++){const k=Math.pow(R(),1.1),at=t+.35+k*3.2;sfxN('white',at,rr(.004,.02),{type:'bandpass',f0:rr(1500,6000),q:rr(.8,3),vol:rr(.06,.2)*(1-k*.6),att:.001,wet:0,pan:rr(-.5,.5)})}
}catch{}}

/* ---------- METEOR / GROUND IMPACT (also used for other big thumps) ----------
   vol 0..1 = how close it is: close ones get a crack and full bass, far ones are duller and quieter */
function thudSound(vol,pan){
  if(vol<.03)return;
  try{
    audioEnsure();const v=clampN(vol,0,1),t=audioCtx.currentTime+.003,R=Math.random,rr=(a,b)=>a+R()*(b-a),near=Math.pow(v,.8),cut=500+3800*v;
    if(v>.25)sfxN('white',t,.04+.03*v,{type:'bandpass',f0:2600,f1:900,q:.9,vol:.38*v,att:.001,wet:.1,pan});
    sfxT('sine',t,.9,rr(60,70),24,{vol:.7*near,att:.002,sweep:.85,shape:1.8});
    sfxT('triangle',t,.3,140,45,{vol:.16*v,lp:700});
    sfxN('brown',t,.95,{f0:cut,f1:90,vol:.75*near,att:.005,wet:.3});
    sfxN('pink',t+.02,.6,{type:'bandpass',f0:cut*.5+200,f1:200,q:.8,vol:.2*v,att:.01,wet:.2,pan});
    const nd=Math.round(4+10*v);
    for(let i=0;i<nd;i++){const at=t+.18+Math.pow(R(),.8)*1.1;sfxN('pink',at,rr(.02,.08),{type:'bandpass',f0:rr(300,1800),q:rr(1.5,4),vol:rr(.03,.1)*v,att:.002,wet:.2,pan:rr(-.5,.5)});if(R()<.35)sfxT('sine',at,.09,rr(70,130),rr(35,55),{vol:.1*v})}
    sfxN('brown',t+.05,1.5,{f0:170,f1:55,vol:.28*v,att:.12,wet:.5})
  }catch{}
}

/* ---------- LIGHTNING STRIKE: sharp crack + electrical sizzle, then a rolling thunder peal ---------- */
function zapSound(vol,pan){
  if(vol<.02)return;
  try{
    audioEnsure();const v=clampN(vol,0,1),t=audioCtx.currentTime+.002,R=Math.random,rr=(a,b)=>a+R()*(b-a);
    /* electric zap: snap, fast descending discharge, buzzing arc and crackle. no thunder here */
    sfxN('white',t,.05,{type:'highpass',f0:3500,f1:1800,vol:.6*v,att:.0007,wet:.1,pan});
    sfxT('sawtooth',t,.2,5200,160,{vol:.26*v,att:.001,lp:8000,shape:3,sweep:.75,wet:.15,pan});
    sfxT('square',t,.13,2800,420,{vol:.1*v,att:.001,lp:6000,wet:.1,pan});
    sfxT('sawtooth',t+.01,.36,118,104,{vol:.1*v,att:.004,lp:2800,shape:4,wet:.1,pan});
    sfxT('sawtooth',t+.01,.3,2200,2600,{vol:.05*v,att:.004,lp:6000,det:35,pan});
    sfxN('white',t,.35,{type:'bandpass',f0:6500,f1:3200,q:1.2,vol:.18*v,att:.002,wet:.1,pan,env:[[.01,1],[.15,.7],[.35,0]]});
    for(let i=0;i<26;i++){const at=t+.02+Math.pow(R(),1.1)*.38;sfxN('white',at,rr(.005,.02),{type:'bandpass',f0:rr(2500,9500),q:rr(2,6),vol:rr(.08,.22)*v,att:.0007,wet:.1,pan:(pan||0)+rr(-.3,.3)})}
    sfxT('triangle',t,.12,900,220,{vol:.1*v,att:.001,pan})
  }catch{}
}
/* far-off thunder on the Thunderstorm map: no crack, just a slow low roll */
function thunderSound(vol){
  try{
    audioEnsure();const v=clampN(vol,0,1),t=audioCtx.currentTime+.01,R=Math.random,rr=(a,b)=>a+R()*(b-a);
    /* distant thunder: a ripping crackle far away, then overlapping slow rolling swells. no boom, no punch */
    for(let i=0;i<8;i++)sfxN('pink',t+R()*.5,rr(.05,.14),{type:'bandpass',f0:rr(250,700),q:1.5,vol:rr(.1,.22)*v,att:.01,wet:.4,pan:rr(-.4,.4)});
    let at=t+.1;
    for(let i=0;i<6;i++){const d=rr(.7,1.4);sfxN('pink',at,d,{type:'bandpass',f0:rr(110,300),f1:rr(70,160),q:.8,vol:rr(.3,.6)*v*(1-i*.1),att:rr(.15,.35),wet:.5,pan:rr(-.4,.4)});at+=rr(.3,.65)}
    sfxN('brown',t+.1,3.8,{f0:260,f1:60,vol:.35*v,att:.4,wet:.5,env:[[.5,1],[1.4,.6],[2.2,.8],[3,.3]]})
  }catch{}
}
/* quiet electrical build-up while a lightning strike is being telegraphed */
function staticSound(T){
  try{
    audioEnsure();const t=audioCtx.currentTime,R=Math.random,rr=(a,b)=>a+R()*(b-a);
    sfxN('white',t,T,{type:'highpass',f0:4200,vol:.05,rise:true,wet:.1});
    sfxT('sine',t,T,90,240,{vol:.012,rise:true,wet:.1});
    for(let i=0;i<10;i++){const at=t+T*Math.pow(R(),.55)*.95;sfxN('white',at,rr(.006,.02),{type:'bandpass',f0:rr(3000,8000),q:2,vol:rr(.03,.07),att:.001,wet:.1,pan:rr(-.4,.4)})}
  }catch{}
}

/* ---------- LAVA GEYSER: ground thump, a roaring steam/flame jet, hissing, lava splats and fire pops ---------- */
function geyserSound(vol,pan){
  if(vol<.03)return;
  try{
    audioEnsure();const v=clampN(vol,0,1),t=audioCtx.currentTime+.003,R=Math.random,rr=(a,b)=>a+R()*(b-a);
    /* flame jet: a rising blowtorch roar that sustains and fades, with low lava glugs. long, tonal-ish, no explosion */
    sfxRoar(t,1.1,.75*v,pan,.25,350,1400,.5,.07);
    sfxN('pink',t,.8,{type:'bandpass',f0:120,f1:180,q:2,vol:.25*v,att:.06,wet:.3});
    for(let i=0;i<9;i++){const at=t+.1+R()*.8;sfxT('sine',at,.12,rr(140,300),rr(60,110),{vol:.1*v,att:.004,wet:.15,pan:(pan||0)+rr(-.3,.3)})}
  }catch{}
}
/* flame roar: low-mid turbulent noise whose loudness flutters quickly, like a gas jet / big fire */
function sfxRoar(t,dur,vol,pan,wet,f0,f1,fl,att){
  fl=fl??.3;att=att??.35;f0=f0||900;f1=f1||260;
  const c=audioCtx,s=c.createBufferSource(),f=c.createBiquadFilter(),f2=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),lfo2=c.createOscillator(),lg=c.createGain(),lg2=c.createGain();
  s.buffer=sfxNoise('pink');f.type='lowpass';f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur*.6);f.Q.value=1.4;
  f2.type='peaking';f2.frequency.value=180;f2.gain.value=7;
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.linearRampToValueAtTime(vol*.85,t+dur*.6);g.gain.linearRampToValueAtTime(.0001,t+dur);
  lfo.type='sine';lfo.frequency.value=rr2(14,22);lg.gain.value=vol*fl;lfo2.type='sine';lfo2.frequency.value=rr2(5,9);lg2.gain.value=vol*fl*.7;
  lfo.connect(lg);lg.connect(g.gain);lfo2.connect(lg2);lg2.connect(g.gain);
  s.connect(f);f.connect(f2);f2.connect(g);sfxOut(g,wet??.2,pan);
  s.start(t,Math.random()*Math.max(0,6-dur-.1));s.stop(t+dur+.05);lfo.start(t);lfo.stop(t+dur+.05);lfo2.start(t);lfo2.stop(t+dur+.05)
}
function rr2(a,b){return a+Math.random()*(b-a)}

/* ---------- PERPLEXITY BEAM: rising charge whine when it is telegraphed, then a huge plasma discharge ---------- */
function beamChargeSound(T){
  try{
    audioEnsure();const t=audioCtx.currentTime;let at=t,gap=.24,f=320;
    /* arming pulses that speed up and climb in pitch until the beam fires */
    while(at<t+T-.05){sfxT('square',at,.07,f,0,{vol:.02,att:.003,lp:3000,wet:.2});sfxT('sine',at,.09,f*2,0,{vol:.02,att:.003,wet:.2});at+=gap;gap=Math.max(.04,gap*.82);f*=1.07}
    sfxT('sawtooth',t,T,90,700,{vol:.035,rise:true,lp:1500,wet:.2})
  }catch{}
}
function beamSound(near,pan){
  try{
    audioEnsure();const v=.5+.5*clampN(near,0,1),t=audioCtx.currentTime+.002,R=Math.random,rr=(a,b)=>a+R()*(b-a),c=audioCtx,D=1.25;
    /* sci-fi energy beam: upward launch sweep, then a wobbling detuned power chord held for the beam, sparkle, power-down */
    sfxT('sawtooth',t,.14,120,2400,{vol:.2*v,att:.002,lp:5000,pan,wet:.15});
    sfxN('white',t,.05,{type:'highpass',f0:3000,vol:.3*v,att:.001,wet:.1,pan});
    for(const f of [110,165.2,220.5,330]){
      const o=c.createOscillator(),l=c.createOscillator(),lg=c.createGain(),lp=c.createBiquadFilter(),g=c.createGain();
      o.type='sawtooth';o.frequency.value=f;l.frequency.value=rr(9,15);lg.gain.value=f*.04;l.connect(lg);lg.connect(o.frequency);
      lp.type='lowpass';lp.frequency.setValueAtTime(500,t);lp.frequency.exponentialRampToValueAtTime(4200,t+.18);lp.frequency.exponentialRampToValueAtTime(700,t+D);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.05*v,t+.03);g.gain.setValueAtTime(.05*v,t+D*.8);g.gain.linearRampToValueAtTime(.0001,t+D+.2);
      o.connect(lp);lp.connect(g);sfxOut(g,.3,pan);o.start(t);l.start(t);o.stop(t+D+.25);l.stop(t+D+.25)
    }
    sfxT('sine',t,D+.2,55,50,{vol:.22*v,att:.03,wet:.2,env:[[.04,1],[D*.8,1]]});
    sfxT('sine',t+D,.5,400,60,{vol:.12*v,att:.005,wet:.3});
    for(let i=0;i<16;i++)sfxT('sine',t+.05+R()*D,.05,rr(2500,8000),0,{vol:.05*v,att:.002,wet:.2,pan:rr(-.6,.6)})
  }catch{}
}

/* ---------- INCOMING METEOR: a swelling whistle and flame rush while it falls ---------- */
function meteorFallSound(T,x){
  try{
    audioEnsure();const t=audioCtx.currentTime,pan=clampN(((x||0)-plane.position.x)/25,-.8,.8);
    sfxN('pink',t,T,{type:'bandpass',f0:2800,f1:900,q:6,vol:.1,rise:true,wet:.1,pan});
    sfxN('pink',t,T,{type:'bandpass',f0:400,f1:1100,q:.7,vol:.09,rise:true,wet:.15,pan})
  }catch{}
}

/* ---------- CROSSWIND GUST: wind that builds during the warning, peaks in the push, then dies away ---------- */
function gustSound(dir){
  try{
    audioEnsure();const t=audioCtx.currentTime,pan=-(dir||0)*.5,E=[[.85,.7],[1.5,1],[2.1,.45]];
    sfxN('pink',t,2.5,{type:'bandpass',f0:300,f1:650,q:.9,vol:.4,wet:.25,pan,env:E});
    sfxN('pink',t+.2,2.2,{type:'bandpass',f0:1400,f1:900,q:5,vol:.08,wet:.2,pan,env:[[.6,.8],[1.3,1],[2,.3]]});
    sfxN('white',t,2.4,{type:'highpass',f0:4000,vol:.06,wet:.1,pan,env:E});
    sfxN('brown',t,2.5,{f0:120,f1:100,vol:.25,wet:.2,env:E})
  }catch{}
}

/* ---------- GRAVITY WELL: a continuous low drone that swells and rises in pitch as you get pulled in ---------- */
const WELLH={n:null,last:0};
function wellHum(level){
  try{
    if(level<.02||!audioCtx)return;audioEnsure();const c=audioCtx,now=c.currentTime;
    if(!WELLH.n){
      const o1=c.createOscillator(),o2=c.createOscillator(),o3=c.createOscillator(),lp=c.createBiquadFilter(),src=c.createBufferSource(),nf=c.createBiquadFilter(),ng=c.createGain(),g=c.createGain();
      o1.type='sine';o1.frequency.value=38;o2.type='sine';o2.frequency.value=40.5;o3.type='sawtooth';o3.frequency.value=57;lp.type='lowpass';lp.frequency.value=160;
      const g3=c.createGain();g3.gain.value=.25;o3.connect(lp);lp.connect(g3);o1.connect(g);o2.connect(g);g3.connect(g);
      src.buffer=sfxNoise('pink');src.loop=true;nf.type='bandpass';nf.frequency.value=300;nf.Q.value=1.2;ng.gain.value=.5;src.connect(nf);nf.connect(ng);ng.connect(g);
      g.gain.value=.0001;sfxOut(g,.25);o1.start();o2.start();o3.start();src.start();
      WELLH.n={o1,o2,o3,nf,g,src}
    }
    const n=WELLH.n;WELLH.last=now;
    n.g.gain.setTargetAtTime(.2*level,now,.12);
    n.o1.frequency.setTargetAtTime(34+30*level,now,.2);n.o2.frequency.setTargetAtTime(36.5+31*level,now,.2);n.o3.frequency.setTargetAtTime(52+40*level,now,.2);
    n.nf.frequency.setTargetAtTime(200+1400*level,now,.2)
  }catch{}
}
function wellHumTick(){
  const n=WELLH.n;if(!n||!audioCtx)return;
  if(audioCtx.currentTime-WELLH.last>.25){
    const now=audioCtx.currentTime;n.g.gain.setTargetAtTime(.0001,now,.1);
    for(const o of [n.o1,n.o2,n.o3,n.src]){try{o.stop(now+.5)}catch{}}
    WELLH.n=null
  }
}

/* ---------- CUTSCENE IMPACT STINGER ---------- */
function stingerSound(){try{
  audioEnsure();const t=audioCtx.currentTime+.005;
  sfxT('sine',t,1.6,110,24,{vol:.9,att:.003,shape:1.8,sweep:.7,wet:.15});
  sfxN('white',t,.6,{type:'highpass',f0:700,f1:500,vol:.4,att:.002,wet:.4});
  sfxN('brown',t,1.4,{f0:1500,f1:80,vol:.6,att:.004,wet:.5});
  for(const f of [233,311,466,659])sfxT('sawtooth',t,1.1,f,f*.97,{vol:.07,att:.015,lp:2200,wet:.4});
  sfxPing(t,520,1.4,.04,0,.5)
}catch{}}

/* ---------- AUTOPILOT chirps ---------- */
function apSound(on){
  try{
    audioEnsure();const t=audioCtx.currentTime;
    (on?[[660,0],[990,.09],[1320,.18]]:[[988,0],[660,.1]]).forEach(([f,d])=>{
      sfxT('sine',t+d,.3,f,0,{vol:.024,att:.008,wet:.3});
      sfxT('triangle',t+d,.2,f*2,0,{vol:.006,att:.008,wet:.3})
    })
  }catch{}
}

/* ---------- SHIELD: energy-field hum (detuned pair + octave, slow shimmer), power-up swell, power-down ---------- */
function setShieldHum(on){
  try{
    audioEnsure();const c=audioCtx,now=c.currentTime;
    if(on&&!shieldHum){
      const g=c.createGain(),lp=c.createBiquadFilter(),o1=c.createOscillator(),o2=c.createOscillator(),o3=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),src=c.createBufferSource(),nf=c.createBiquadFilter(),ng=c.createGain();
      lp.type='lowpass';lp.frequency.value=900;o1.type='sine';o1.frequency.value=82;o2.type='sine';o2.frequency.value=82.9;o3.type='triangle';o3.frequency.value=164;
      const g3=c.createGain();g3.gain.value=.3;o1.connect(lp);o2.connect(lp);o3.connect(g3);g3.connect(lp);lp.connect(g);
      lfo.type='sine';lfo.frequency.value=5.5;lg.gain.value=.006;lfo.connect(lg);lg.connect(g.gain);
      src.buffer=sfxNoise('pink');src.loop=true;nf.type='bandpass';nf.frequency.value=2400;nf.Q.value=3;ng.gain.value=.12;src.connect(nf);nf.connect(ng);ng.connect(g);
      g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(.026,now+.3);sfxOut(g,.15);
      for(const o of [o1,o2,o3,lfo,src])o.start(now);
      shieldHum={g,nodes:[o1,o2,o3,lfo,src]};
      sfxT('sine',now,.4,260,1100,{vol:.03,att:.06,wet:.3});sfxT('triangle',now,.4,390,1650,{vol:.014,att:.06,wet:.3})
    }else if(!on&&shieldHum){
      shieldHum.g.gain.cancelScheduledValues(now);shieldHum.g.gain.setTargetAtTime(.0001,now,.08);
      for(const o of shieldHum.nodes){try{o.stop(now+.4)}catch{}}
      shieldHum=null
    }
  }catch{}
}
function shieldEndSound(){
  try{
    audioEnsure();const t=audioCtx.currentTime,R=Math.random;
    sfxT('sine',t,.5,1000,180,{vol:.04,att:.01,wet:.3});
    sfxT('triangle',t+.03,.45,1500,300,{vol:.02,att:.01,wet:.3});
    sfxT('sine',t,.35,90,50,{vol:.08,att:.004});
    for(let i=0;i<6;i++)sfxN('white',t+R()*.4,.012+R()*.02,{type:'bandpass',f0:2500+R()*4000,q:2,vol:.03+R()*.03,att:.001,wet:.2,pan:R()*1.2-.6})
  }catch{}
}

/* ---------- LOSS-OF-CONTROL warnings (crosswind / gravity-well) ---------- */
function rollWarnBlip(sev){
  try{
    audioEnsure();const t=audioCtx.currentTime,f=760+sev*340;
    sfxT('sine',t,.11,f,0,{vol:.014+.014*sev,att:.005});
    sfxT('square',t,.09,f,0,{vol:.006+.006*sev,att:.004,lp:2400})
  }catch{}
}
function rollLostSound(){
  try{
    audioEnsure();const t=audioCtx.currentTime;
    sfxT('sawtooth',t,.9,420,95,{vol:.035,att:.05,lp:900,wet:.15});
    sfxT('sine',t,.85,460,120,{vol:.03,att:.04});
    sfxN('pink',t,.9,{type:'bandpass',f0:900,f1:300,q:.8,vol:.07,att:.08,wet:.2});
    for(const d of [0,.12,.24])sfxT('sine',t+d,.06,1100,0,{vol:.02,att:.004})
  }catch{}
}
function rollRecoverSound(){
  try{
    audioEnsure();const t=audioCtx.currentTime;
    for(const [f,d] of [[520,0],[780,.09]]){sfxT('sine',t+d,.32,f,0,{vol:.015,att:.02,wet:.25});sfxT('triangle',t+d,.25,f*2,0,{vol:.004,att:.02,wet:.25})}
    sfxN('pink',t,.3,{type:'bandpass',f0:400,f1:1800,q:.8,vol:.03,att:.05,wet:.2})
  }catch{}
}


/* ---- cutscene audio (all synthesised, routed through the SFX bus so volume settings apply) ---- */
function cutDrone(dur,f0,f1,vol){try{const bus=audioBus(),now=audioCtx.currentTime,g=audioCtx.createGain(),lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(240,now);lp.frequency.linearRampToValueAtTime(950,now+dur);g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(vol,now+dur*.55);g.gain.linearRampToValueAtTime(.0001,now+dur);for(const d of [0,7,-9]){const o=audioCtx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f0,now);o.frequency.exponentialRampToValueAtTime(f1,now+dur);o.detune.value=d*3;o.connect(lp);o.start(now);o.stop(now+dur+.05)}lp.connect(g).connect(bus)}catch{}}

