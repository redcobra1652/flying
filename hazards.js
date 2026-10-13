// Crash effects and world hazards, including meteors and gravity wells.
/* CRASH EFFECTS */
let debris=[],crashParticles=[],popped=[];const debrisGeo=new THREE.BoxGeometry(.24,.24,.24);const smokeMat=new THREE.PointsMaterial({color:'#d7d6cd',size:1.1,transparent:true,opacity:.48,depthWrite:false});let smoke=null,smokeVel=[];const flash=document.getElementById('flash');
function burstCrash(){apHide();stopMusic();setShieldHum(false);state.mode='CRASHING';state.hitTimer=CONFIG.crashHitStop;state.crashElapsed=0;state.timeScale=0;state.shake=.7;plane.updateMatrixWorld(true);for(const m of planeParts){const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();m.getWorldPosition(pos);m.getWorldQuaternion(quat);m.getWorldScale(scale);scene.add(m);m.position.copy(pos);m.quaternion.copy(quat);m.scale.copy(scale);const vel=new THREE.Vector3((Math.random()-.5)*6,2+Math.random()*5,1+Math.random()*6);debris.push({mesh:m,vel,spin:new THREE.Vector3(Math.random()*7,Math.random()*7,Math.random()*7),bounced:false})}plane.visible=false;
 for(let i=0;i<76;i++){const mesh=new THREE.Mesh(debrisGeo,new THREE.MeshBasicMaterial({color:i%3===0?LEVELS[state.level].accent:LEVELS[state.level].palette[Math.floor(Math.random()*5)]}));mesh.position.set(plane.position.x+(Math.random()-.5)*1.8,plane.position.y+(Math.random()-.5)*1.5,plane.position.z+(Math.random()-.5)*1.8);scene.add(mesh);crashParticles.push({mesh,vel:new THREE.Vector3((Math.random()-.5)*11,Math.random()*9-1,Math.random()*10),life:.65+Math.random()*.8})}
 const ps=new Float32Array(30*3);smokeGeo.setAttribute('position',new THREE.BufferAttribute(ps,3));smoke=new THREE.Points(smokeGeo,smokeMat);smoke.position.copy(plane.position);smokeVel=[];for(let i=0;i<30;i++)smokeVel.push(new THREE.Vector3((Math.random()-.5)*.5,Math.random()*.9,.4+Math.random()));scene.add(smoke);flash.style.opacity='.84';setTimeout(()=>flash.style.opacity='0',150);crashSound();
 for(const ch of chunks)for(let i=0;i<ch.records.length;i++){const r=ch.records[i],wz=r.sourceZ+state.worldZ,dx=r.sourceX-plane.position.x,dz=wz;if(r.h>0&&Math.hypot(dx,dz)<CONFIG.blockPopRadius&&wz>-3&&wz<5){const len=Math.max(.1,Math.hypot(dx,dz));popped.push({chunk:ch,index:i,record:r,base:r.h,vel:2+Math.random()*5,dx:dx/len,dz:dz/len})}}}
const smokeGeo=new THREE.BufferGeometry();
function updateCrash(dt){state.crashElapsed+=dt;if(state.hitTimer>0){state.hitTimer-=dt;return}state.timeScale=THREE.MathUtils.lerp(state.timeScale,1,Math.min(1,dt/CONFIG.slowMoEase));for(const d of debris){const step=dt*state.timeScale;d.vel.y-=CONFIG.crashPieceGravity*step;d.mesh.position.addScaledVector(d.vel,step);d.mesh.rotation.x+=d.spin.x*step;d.mesh.rotation.y+=d.spin.y*step;if(!d.bounced&&d.mesh.position.y<.32){d.mesh.position.y=.32;d.vel.y=Math.abs(d.vel.y)*.25;d.vel.multiplyScalar(.58);d.bounced=true}}
 for(let i=crashParticles.length-1;i>=0;i--){const p=crashParticles[i];p.life-=dt;p.vel.y-=8*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.x+=dt*4;if(p.life<0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();crashParticles.splice(i,1)}}if(smoke){const arr=smoke.geometry.attributes.position.array;for(let i=0;i<30;i++){const v=smokeVel[i];arr[i*3]+=v.x*dt;arr[i*3+1]+=v.y*dt;arr[i*3+2]+=v.z*dt}smoke.geometry.attributes.position.needsUpdate=true;smokeMat.opacity=Math.max(0,.48-state.crashElapsed*.24)}for(const p of popped){const pop=Math.sin(Math.min(1,state.crashElapsed*5)*Math.PI);p.record.h=Math.min(p.base+pop*p.vel,p.base+4);p.record.offsetX=p.dx*pop*1.15;p.record.offsetZ=p.dz*pop*1.15;setChunkInstance(p.chunk,p.record);p.chunk.boxMesh.instanceMatrix.needsUpdate=true;p.chunk.spikeMesh.instanceMatrix.needsUpdate=true}
 state.shake=Math.max(0,state.shake-dt*1.6);if(state.crashElapsed>=CONFIG.crashDelay){finishCrash()}}
function finishCrash(){if(state.mode==='DEAD')return;if(state.tut){state.tut.respawn();return}state.mode='DEAD';document.querySelector('#dead h2').textContent=state.runEnded?'RUN ENDED':'CRASHED';state.runEnded=false;const final=Math.floor(state.arena?state.arenaD0:state.distance);const newBest=final>state.best;if(newBest)writeBest(final);document.getElementById('finalDistance').textContent=`${final.toLocaleString()} m`;document.getElementById('reached').textContent=state.arena?'Event Horizon':LEVELS[state.level].name;recordMap(state.arena?'void':state.level);home.classList.remove('active');hud.classList.remove('visible');dead.classList.add('active');showHomeBest();showPayout(accountCrash())}
function clearCrash(){for(const d of debris)scene.remove(d.mesh);debris=[];for(const m of planeParts){plane.add(m);m.position.copy(m.userData.homePosition);m.quaternion.copy(m.userData.homeQuaternion);m.scale.copy(m.userData.homeScale)}for(const p of crashParticles){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose()}crashParticles=[];if(smoke){scene.remove(smoke);smoke=null;smokeMat.opacity=.48}popped=[]}
/* METEORS: diagonal falls, a ground reticle + streak that shows exactly where they land, camera shake on impact */
const meteors=[],blasts=[],sparks=[];
const BR=CONFIG.meteorBlastRadius;
const reticleRingGeo=new THREE.RingGeometry(BR-.45,BR,56),reticleFillGeo=new THREE.CircleGeometry(BR,48),blastGeo=new THREE.SphereGeometry(1,16,12);
/* ---- METEOR LOOK: cratered rock (3 variants) with procedural lava cracks + heat rim, soft fireball flame, glow halo, ember + smoke streams ---- */
const meteorU={uTime:{value:0}};
const MET_NOISE=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}`;
const meteorRockGeos=(()=>{
  const hs=(x,y,z)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n)},L=THREE.MathUtils.lerp;
  const vn=(x,y,z)=>{const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
    return L(L(L(hs(ix,iy,iz),hs(ix+1,iy,iz),u),L(hs(ix,iy+1,iz),hs(ix+1,iy+1,iz),u),v),L(L(hs(ix,iy,iz+1),hs(ix+1,iy,iz+1),u),L(hs(ix,iy+1,iz+1),hs(ix+1,iy+1,iz+1),u),v),w)};
  const make=(seed,st)=>{
    const g=new THREE.IcosahedronGeometry(1,4),p=g.attributes.position,n=p.count,keys=[],craters=[];
    for(let i=0;i<6;i++){const a=Math.random()*6.283,b=Math.acos(2*Math.random()-1);craters.push({x:Math.sin(b)*Math.cos(a),y:Math.sin(b)*Math.sin(a),z:Math.cos(b),c:Math.cos(.36+Math.random()*.3),d:.1+Math.random()*.1})}
    for(let i=0;i<n;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);keys.push(Math.round(x*500)+','+Math.round(y*500)+','+Math.round(z*500));
      let r=1+(vn(x*1.5+seed,y*1.5+seed,z*1.5)-.5)*.62+(vn(x*3.6,y*3.6+seed,z*3.6)-.5)*.2+(vn(x*8+seed,y*8,z*8)-.5)*.06;
      for(const c of craters){const d=x*c.x+y*c.y+z*c.z;if(d>c.c){const t=(d-c.c)/(1-c.c);r-=c.d*t*t*(3-2*t)}}
      p.setXYZ(i,x*r*st[0],y*r*st[1],z*r*st[2])
    }
    g.computeVertexNormals();                                   /* flat face normals ... */
    const nor=g.attributes.normal,sums=new Map();
    for(let i=0;i<n;i++){const s=sums.get(keys[i])||[0,0,0];s[0]+=nor.getX(i);s[1]+=nor.getY(i);s[2]+=nor.getZ(i);sums.set(keys[i],s)}
    for(let i=0;i<n;i++){const s=sums.get(keys[i]),l=Math.hypot(s[0],s[1],s[2])||1;      /* ... blended with smoothed ones: chunky but not harsh */
      const x=s[0]/l*.55+nor.getX(i)*.45,y=s[1]/l*.55+nor.getY(i)*.45,z=s[2]/l*.55+nor.getZ(i)*.45,q=Math.hypot(x,y,z)||1;nor.setXYZ(i,x/q,y/q,z/q)}
    return g
  };
  return [make(1.3,[1,.88,1.1]),make(5.7,[1.1,.95,.9]),make(9.1,[.95,1.05,1.12])]
})();
const meteorRockMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92,metalness:.05,emissive:'#ffffff'});
meteorRockMat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=meteorU.uTime;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOP=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;varying vec3 vOP;\n'+MET_NOISE)
  .replace('#include <color_fragment>',`#include <color_fragment>
  float nA=vn(vOP*2.1),nB=vn(vOP*5.3+7.),nC=vn(vOP*11.+2.);
  float rid=abs(nA*2.-1.),rid2=abs(vn(vOP*4.3+11.)*2.-1.);
  float crk=clamp((1.-smoothstep(0.,.075,rid))*(.5+.5*nB)+(1.-smoothstep(0.,.05,rid2))*.7,0.,1.);
  diffuseColor.rgb=mix(vec3(.075,.06,.065),vec3(.2,.15,.12),smoothstep(.25,.8,nB*.6+nC*.4))*(1.-crk*.8);`)
  .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  float flick=.8+.2*sin(uTime*7.+nA*9.);
  totalEmissiveRadiance=mix(vec3(1.,.16,.03),vec3(1.,.72,.22),crk*crk)*crk*2.6*flick;
  float rim=pow(1.-clamp(dot(normalize(vNormal),normalize(vViewPosition)),0.,1.),2.2);
  totalEmissiveRadiance+=vec3(1.,.38,.08)*rim*.9+vec3(.5,.08,.01)*.35*(.5+nC);`)
};
/* flame: tapered open shell, soft silhouette (fresnel), scrolling turbulence, white-hot -> orange -> deep red along its length */
const meteorFlameGeo=(()=>{const g=new THREE.CylinderGeometry(1,1,1,20,24,true);g.translate(0,.5,0);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const t=Math.min(1,Math.max(0,p.getY(i))),sm=Math.min(1,t/.14),prof=Math.pow(1-t,.85)*(.5+.5*sm*sm*(3-2*sm));p.setX(i,p.getX(i)*prof);p.setZ(i,p.getZ(i)*prof)}
  return g})();
const meteorFlameMat=core=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uTime:meteorU.uTime,uCore:{value:core}},
  vertexShader:`varying float vT;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vT=position.y;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uTime;uniform float uCore;varying float vT;varying vec3 vN;varying vec3 vV;varying vec3 vP;\n${MET_NOISE}
  void main(){
    float e=abs(dot(normalize(vN),normalize(vV))),edge=pow(e,mix(1.1,1.8,uCore));
    vec3 q=vec3(vP.x*2.6,vP.y*3.2-uTime*6.,vP.z*2.6);
    float n=vn(q)*.6+vn(q*2.3+4.)*.4;
    float along=pow(1.-vT,mix(1.5,1.1,uCore));
    float body=along*edge*(.35+1.1*n);
    float k=clamp(vT*1.1+(1.-edge)*.55-uCore*.35,0.,1.);
    vec3 col=k<.45?mix(vec3(1.,.97,.8),vec3(1.,.55,.12),k/.45):mix(vec3(1.,.55,.12),vec3(.6,.06,.02),(k-.45)/.55);
    col=mix(col,vec3(1.,.95,.8),uCore*.5);
    gl_FragColor=vec4(col*1.4,clamp(body*1.3,0.,1.));
  }`});
const meteorFlameOuterMat=meteorFlameMat(0),meteorFlameCoreMat=meteorFlameMat(1);
const meteorGlowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,245,210,1)');gr.addColorStop(.18,'rgba(255,190,90,.75)');gr.addColorStop(.45,'rgba(255,110,30,.28)');gr.addColorStop(1,'rgba(255,60,10,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})();
const meteorGlowMat=new THREE.SpriteMaterial({map:meteorGlowTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,opacity:.9});
/* smoke: normal-blended soft puffs (the shared additive fx pool can only brighten, never darken) */
const SMK_MAX=420,smkPosA=new Float32Array(SMK_MAX*3),smkColA=new Float32Array(SMK_MAX*3),smkSizeA=new Float32Array(SMK_MAX),smkAlphaA=new Float32Array(SMK_MAX),smk=[];
const smkGeo=new THREE.BufferGeometry();
for(const [n,a,k] of [['position',smkPosA,3],['pcol',smkColA,3],['psize',smkSizeA,1],['palpha',smkAlphaA,1]]){const at=new THREE.BufferAttribute(a,k);at.setUsage(THREE.DynamicDrawUsage);smkGeo.setAttribute(n,at)}
smkGeo.setDrawRange(0,0);
const smkMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:700}},vertexShader:`attribute vec3 pcol;attribute float psize;attribute float palpha;uniform float scale;varying vec3 vC;varying float vA;void main(){vC=pcol;vA=palpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(psize*scale/max(.2,-mv.z),1.,260.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float f=1.-d;f=f*f*(3.-2.*f);gl_FragColor=vec4(vC,f*vA);}`});
const smkPts=new THREE.Points(smkGeo,smkMat);smkPts.frustumCulled=false;smkPts.renderOrder=9;scene.add(smkPts);
function smkP(o){if(smk.length>=SMK_MAX)return;const p=Object.assign({x:0,y:0,zs:0,vx:0,vy:0,vz:0,life:1,s0:1,s1:3,a:.5},o);p.max=p.life;smk.push(p)}
function updateMeteorSmoke(dt){
  smkMat.uniforms.scale.value=renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360));
  let n=0;
  for(let i=0;i<smk.length;){
    const p=smk[i];p.life-=dt;if(p.life<=0){smk[i]=smk[smk.length-1];smk.pop();continue}
    const dr=Math.exp(-1.3*dt);p.vx*=dr;p.vy*=dr;p.vz*=dr;p.x+=p.vx*dt;p.y+=p.vy*dt;p.zs+=p.vz*dt;
    const k=1-p.life/p.max,j=n*3,w=Math.min(1,k*3.2);
    smkPosA[j]=p.x;smkPosA[j+1]=p.y;smkPosA[j+2]=p.zs+state.worldZ;
    smkColA[j]=.5+(.19-.5)*w;smkColA[j+1]=.26+(.17-.26)*w;smkColA[j+2]=.14+(.17-.14)*w;
    smkSizeA[n]=p.s0+(p.s1-p.s0)*Math.sqrt(k);smkAlphaA[n]=p.a*Math.min(1,k*9)*Math.pow(1-k,1.4);n++;i++
  }
  smkGeo.setDrawRange(0,n);for(const a of ['position','pcol','psize','palpha'])smkGeo.attributes[a].needsUpdate=true
}
function emitMeteorTrail(m,dt){
  const p=m.rock.position,zs=p.z-state.worldZ,d=m.dir,s=m.size;
  m.accE+=dt*60;m.accS+=dt*24;
  while(m.accE>=1){m.accE-=1;const sp=R2(3,9),o=R2(0,.9)*s,a=Math.random()*6.283,b=Math.random()*3.14,t=R2(0,2);
    fxP({x:p.x+d.x*t+Math.cos(a)*o,y:p.y+d.y*t+Math.sin(b)*o,zs:zs+d.z*t+Math.sin(a)*o,vx:d.x*sp+R2(-1.6,1.6),vy:d.y*sp+R2(-1.6,1.6),vz:d.z*sp+R2(-1.6,1.6),g:2,drag:.9,life:R2(.35,.85),s0:R2(.45,.8)*s,s1:.06,a:1,c0:[1,.85,.45],c1:[.8,.14,.02],flick:true})}
  while(m.accS>=1){m.accS-=1;const back=R2(1.5,7)*s;
    smkP({x:p.x+d.x*back+R2(-.5,.5),y:p.y+d.y*back+R2(-.5,.5),zs:zs+d.z*back+R2(-.5,.5),vx:R2(-.8,.8),vy:R2(.2,1.6),vz:R2(-.8,.8),life:R2(1.1,1.8),s0:R2(1.3,2)*s,s1:R2(5,8)*s,a:R2(.38,.55)})}
}
const UP=new THREE.Vector3(0,1,0);
const overlayMat=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false,fog:false,side:THREE.DoubleSide});









/* meteors aim at where the plane is going (not at any path): impact x = projected plane x + side*(2.4..6.0), D ahead = speed*fall time +-5 m.
   The layout is queried around the impact row; the impact must be on open ground and the far side needs an exit at least one clearance wide. */
function clearW(u){return u<.22?8:u<.5?6:4}                          /* 2*n(u) for the tightest old gap of the band (n = 4 / 3 / 2) */
function spawnMeteor(sp){
  const rnd=Math.random;let pick=sp||null;
  for(let attempt=0;attempt<4&&!pick;attempt++){
    const T=lerpN(CONFIG.meteorFall[0],CONFIG.meteorFall[1],rnd()),speed=Math.max(state.speed,CONFIG.baseSpeed);
    const Dp=state.distance+speed*T+(rnd()-.5)*10,base=state.x+clampN(state.vx*T*.5,-6,6),off=2.4+rnd()*3.6;
    const W=clearW(hardAt(Dp)),R=BR+CONFIG.planeCollisionX;
    let best=null;
    for(const side of (rnd()<.5?[-1,1]:[1,-1])){
      const ix=base+side*off;
      if(!freeBox(ix-1.3,ix+1.3,Dp-1.3,Dp+1.3))continue;               /* never on top of a solid */
      let run=0;                                                      /* free room on the far side, measured outward from the blast edge */
      for(let i=0;i<7;i++){const xa=ix-side*(R+2*i),xb=ix-side*(R+2*i+2);if(!freeBox(Math.min(xa,xb),Math.max(xa,xb),Dp-8,Dp+8))break;run+=2}
      if(run>=W&&(!best||run>best.run))best={x:ix,run}
    }
    if(best)pick={x:best.x,zs:-Dp,T}
  }
  if(!pick)return false;
  const {x,zs,T}=pick,size=1+rnd()*.55;
  const start=new THREE.Vector3((rnd()<.5?-1:1)*(34+rnd()*14),46+rnd()*10,-(2+rnd()*12));   /* offset from impact to where it begins: ~45 deg diagonal */
  const rock=new THREE.Mesh(meteorRockGeos[(rnd()*meteorRockGeos.length)|0],meteorRockMat),sc=size*1.15;rock.scale.set(sc*(.9+rnd()*.25),sc*(.85+rnd()*.2),sc*(.9+rnd()*.25));rock.rotation.set(rnd()*6.28,rnd()*6.28,rnd()*6.28);
  const dir=start.clone().normalize(),q=new THREE.Quaternion().setFromUnitVectors(UP,dir),FL=22+8*size;
  const trail=new THREE.Mesh(meteorFlameGeo,meteorFlameOuterMat);trail.quaternion.copy(q);trail.scale.set(size*1.9,FL,size*1.9);
  const core=new THREE.Mesh(meteorFlameGeo,meteorFlameCoreMat);core.quaternion.copy(q);core.scale.set(size,FL*.55,size);
  const glow=new THREE.Sprite(meteorGlowMat);glow.scale.setScalar(size*10);
  const ringMat=overlayMat('#ff5a3a',.9),fillMat=overlayMat('#ff8a4a',.14),progMat=overlayMat('#ff7a3a',.3);
  const ring=new THREE.Mesh(reticleRingGeo,ringMat),fill=new THREE.Mesh(reticleFillGeo,fillMat),prog=new THREE.Mesh(reticleFillGeo,progMat),retic=new THREE.Group();
  for(const mm of [ring,fill,prog]){mm.rotation.x=-Math.PI/2;mm.renderOrder=9;retic.add(mm)}prog.scale.setScalar(.001);
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  const lineMat=new THREE.LineBasicMaterial({color:'#ffa070',transparent:true,opacity:.2,depthTest:false,depthWrite:false,fog:false}),line=new THREE.Line(lineGeo,lineMat);line.frustumCulled=false;line.renderOrder=9;
  scene.add(rock,trail,core,glow,retic,line);
  if(state.mode==='PLAYING')meteorFallSound(T,x);meteors.push({x,zs,T,t:0,start,dir,size,seed:rnd()*6.28,spin:new THREE.Vector3(1.5+rnd()*2.5,1+rnd()*2.5,rnd()*2-1),accE:0,accS:0,rock,trail,core,glow,retic,prog,ringMat,fillMat,progMat,line,lineGeo,lineMat});return true
}
function removeMeteor(i){const m=meteors[i];scene.remove(m.rock,m.trail,m.core,m.glow,m.retic,m.line);m.ringMat.dispose();m.fillMat.dispose();m.progMat.dispose();m.lineMat.dispose();m.lineGeo.dispose();meteors.splice(i,1)}
function impactMeteor(m){
  const zr=m.zs+state.worldZ,dist=Math.hypot(m.x-plane.position.x,zr);
  const fire=new THREE.Mesh(blastGeo,new THREE.MeshBasicMaterial({color:'#ffb04a',transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  const shock=new THREE.Mesh(reticleRingGeo,overlayMat('#ffd9a0',.9));shock.rotation.x=-Math.PI/2;shock.renderOrder=9;
  scene.add(fire,shock);blasts.push({x:m.x,zs:m.zs,age:0,life:.55,fire,shock});
  for(let i=0;i<16;i++){
    const mesh=new THREE.Mesh(debrisGeo,new THREE.MeshBasicMaterial({color:i%3?'#ffb04a':'#ff6a3a',fog:false})),a=Math.random()*Math.PI*2,sp=3+Math.random()*7;
    scene.add(mesh);sparks.push({mesh,ax:m.x,az:m.zs,o:new THREE.Vector3(0,.8,0),vel:new THREE.Vector3(Math.cos(a)*sp,4+Math.random()*7,Math.sin(a)*sp),life:.7+Math.random()*.5})
  }
  {const ix=m.x,iz=m.zs;
    fxP({x:ix,y:1.4,zs:iz,life:.3,s0:7,s1:15,a:.9,c0:[1,.92,.65],c1:[1,.45,.1]});
    for(let i=0;i<28;i++){const a=Math.random()*6.283,sp=R2(5,17);fxP({x:ix,y:.9,zs:iz,vx:Math.cos(a)*sp,vy:R2(4,13),vz:Math.sin(a)*sp,g:20,drag:.35,life:R2(.5,1.2),s0:R2(.5,.9),s1:.08,a:1,c0:[1,.85,.4],c1:[.85,.15,.02],land:true,flick:true})}
    for(let i=0;i<16;i++){const a=Math.random()*6.283,sp=R2(2,7);smkP({x:ix+Math.cos(a)*1.5,y:.8,zs:iz+Math.sin(a)*1.5,vx:Math.cos(a)*sp,vy:R2(1.5,5),vz:Math.sin(a)*sp,life:R2(1.4,2.3),s0:R2(2.5,4),s1:R2(8,13),a:R2(.45,.65)})}}
  state.rumble=Math.max(state.rumble,.14+.6*Math.max(0,1-dist/70));
  thudSound(Math.max(0,1-dist/90),clampN((m.x-plane.position.x)/25,-.8,.8));
  if(dist<26){flash.style.opacity=String(.06+.2*(1-dist/26));setTimeout(()=>flash.style.opacity='0',90)}
}
function updateMeteors(dt,canKill){updateHazards(dt,canKill);
  state.rumble=Math.max(0,state.rumble-dt*2.4);meteorU.uTime.value=state.clock;updateMeteorSmoke(dt);
  for(let i=meteors.length-1;i>=0;i--){
    const m=meteors[i];m.t+=dt;
    const k=Math.min(1,m.t/m.T),rem=1-Math.pow(k,1.3),zr=m.zs+state.worldZ,pulse=.5+.5*Math.sin(state.clock*(8+16*k));
    m.rock.position.set(m.x+m.start.x*rem,.4+m.start.y*rem,zr+m.start.z*rem);m.rock.rotation.x+=dt*m.spin.x;m.rock.rotation.y+=dt*m.spin.y;m.rock.rotation.z+=dt*m.spin.z;m.trail.position.copy(m.rock.position);m.core.position.copy(m.rock.position);m.glow.position.copy(m.rock.position);
    m.glow.scale.setScalar(m.size*(9+1.1*Math.sin(state.clock*23+m.seed)+.6*Math.sin(state.clock*41+m.seed*2)));if(dt>0)emitMeteorTrail(m,dt);
    m.retic.position.set(m.x,.5,zr);m.prog.scale.setScalar(Math.max(.001,k));
    m.ringMat.opacity=Math.min(1,.45+.55*pulse)*Math.min(1,m.t*4);m.fillMat.opacity=.1+.1*pulse;m.progMat.opacity=.18+.22*k;m.lineMat.opacity=.15+.3*k;
    const lp=m.lineGeo.attributes.position.array;lp[0]=m.x;lp[1]=.5;lp[2]=zr;lp[3]=m.rock.position.x;lp[4]=m.rock.position.y;lp[5]=m.rock.position.z;m.lineGeo.attributes.position.needsUpdate=true;
    if(k>.5){const dist=Math.hypot(m.x-plane.position.x,zr);state.rumble=Math.max(state.rumble,.05*k*Math.max(0,1-dist/80))}
    if(k>=1){impactMeteor(m);removeMeteor(i)}
  }
  for(let i=blasts.length-1;i>=0;i--){
    const b=blasts[i];b.age+=dt;const k=Math.min(1,b.age/b.life),zr=b.zs+state.worldZ,out=1-(1-k)*(1-k);
    b.fire.position.set(b.x,1.2+k*1.6,zr);b.fire.scale.setScalar(lerpN(.7,BR*.85,out));b.fire.material.opacity=.9*Math.pow(1-k,1.5);
    b.shock.position.set(b.x,.55,zr);b.shock.scale.setScalar(lerpN(1,1.9,out));b.shock.material.opacity=.9*(1-k);
    if(canKill&&state.mode==='PLAYING'&&state.shieldTimer<=0&&state.shieldSafety<=0&&b.age<.42&&Math.hypot(b.x-plane.position.x,zr)<BR)burstCrash();
    if(k>=1){scene.remove(b.fire,b.shock);b.fire.material.dispose();b.shock.material.dispose();blasts.splice(i,1)}
  }
  for(let i=sparks.length-1;i>=0;i--){
    const s=sparks[i];s.life-=dt;s.vel.y-=16*dt;s.o.addScaledVector(s.vel,dt);if(s.o.y<.2){s.o.y=.2;s.vel.y*=-.3;s.vel.x*=.6;s.vel.z*=.6}
    s.mesh.position.set(s.ax+s.o.x,s.o.y,s.az+state.worldZ+s.o.z);s.mesh.rotation.x+=dt*6;s.mesh.rotation.y+=dt*5;
    if(s.life<=0){scene.remove(s.mesh);s.mesh.material.dispose();sparks.splice(i,1)}
  }
}
function updateMeteorSpawns(dt){
  if(perpHazardsHeld()){state.meteorTimer=Math.min(state.meteorTimer,1.5);return}   /* Perplexity ease-in: no hazards for the first 15 s */
  state.meteorTimer-=dt;if(state.meteorTimer>0)return;
  const rule=LEVEL_RULES[state.level].meteor;if(!rule){state.meteorTimer=3;return}
  const prog=clampN((state.distance-state.levelStart)/CONFIG.levelMeters,0,1),mean=lerpN(rule.every[0],rule.every[1],prog);
  state.meteorTimer=spawnMeteor()?mean*(.65+Math.random()*.7):.4   /* skipped (no safe spot): try again shortly */
}
function clearMeteors(){clearHazards();
  while(meteors.length)removeMeteor(meteors.length-1);smk.length=0;smkGeo.setDrawRange(0,0);
  for(const b of blasts){scene.remove(b.fire,b.shock);b.fire.material.dispose();b.shock.material.dispose()}blasts.length=0;
  for(const s of sparks){scene.remove(s.mesh);s.mesh.material.dispose()}sparks.length=0
}
/* ===== PER-MAP HAZARDS =====
   lightning (Thunderstorm), crosswind gusts (Dune Sea, Solar Flare), lava geysers (Magma Fields), gravity wells (Eclipse).
   Each spawner / force only runs when LEVEL_RULES[state.level] carries its key, so nothing leaks into other maps.
   They follow the meteor pattern: telegraph -> effect -> shake + sound -> kill check (Shield blocks it). Timers run on world time, so Slow-Mo slows them. */
Object.assign(state,{skyFlash:0,extForce:0,lightT:9,geyserT:9,wellT:9,gustT:9,skyT:6,flashPulses:0,flashGap:0,gustPhase:'idle',gustTime:0,gustDir:1,gustEnv:0,gustRoll:0,wellStrain:0,wellWarp:0,wellWarpS:0,wellRef:null});
const scanEl=document.getElementById('scan');
const coronaMatA=new THREE.MeshBasicMaterial({color:'#ff9a3c',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}),coronaMatB=coronaMatA.clone();
const corona=new THREE.Group();corona.add(new THREE.Mesh(new THREE.RingGeometry(3.15,3.9,64),coronaMatA),new THREE.Mesh(new THREE.RingGeometry(3.9,7.2,64),coronaMatB));corona.visible=false;scene.add(corona);
const bolts=[],geysers=[],wells=[],LR=2.3,GR=2.2;
const strikeRingGeo=new THREE.RingGeometry(LR-.35,LR,40),strikeFillGeo=new THREE.CircleGeometry(LR,32);
const columnGeo=new THREE.CylinderGeometry(1.2,1.7,1,14,1,true);columnGeo.translate(0,.5,0);
const GUST_N=70,gustMat=new THREE.LineBasicMaterial({color:'#f6e0b0',transparent:true,opacity:0,depthWrite:false,fog:false}),gustGeo=new THREE.BufferGeometry();
gustGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(GUST_N*6),3));
const gustLines=new THREE.LineSegments(gustGeo,gustMat);gustLines.frustumCulled=false;gustLines.visible=false;scene.add(gustLines);
const gustSeed=Array.from({length:GUST_N},()=>({y:.6+Math.random()*13,z:-Math.random()*70,o:Math.random(),len:3+Math.random()*5}));
function resetHazardTimers(level){const R=LEVEL_RULES[level];state.lightT=R.lightning?R.lightning.every[0]*1.1:9;state.geyserT=R.geyser?R.geyser.every[0]*.9:9;state.wellT=R.well?4:9;state.gustT=R.gust?R.gust.every[0]*.7:9;state.skyT=3+Math.random()*3;state.beamT=R.beam?R.beam.every[0]:9}
function emitSparks(x,zs,n,c1,c2,sp,up){for(let i=0;i<n;i++){const mesh=new THREE.Mesh(debrisGeo,new THREE.MeshBasicMaterial({color:i%3?c1:c2,fog:false})),a=Math.random()*Math.PI*2,sv=sp*(.4+Math.random());scene.add(mesh);sparks.push({mesh,ax:x,az:zs,o:new THREE.Vector3(0,.8,0),vel:new THREE.Vector3(Math.cos(a)*sv,up*(.5+Math.random()),Math.sin(a)*sv),life:.7+Math.random()*.5})}}

/* a spot on open ground about where the plane will be in T seconds, shifted sideways by offMin..offMax so it must be dodged, never an instant trap */
function pickStrikeSpot(T,offMin,offMax,clear){
  for(let a=0;a<6;a++){
    const Dp=state.distance+Math.max(state.speed,CONFIG.baseSpeed)*T+(Math.random()-.5)*8,base=state.x+clampN(state.vx*T*.5,-6,6),x=base+(Math.random()<.5?-1:1)*(offMin+Math.random()*(offMax-offMin));
    if(freeBox(x-clear,x+clear,Dp-clear,Dp+clear))return {x,zs:-Dp}
  }
  return null
}
/* ---- lightning (Thunderstorm) ---- */
function spawnLightning(sp,lite){
  const p=sp||pickStrikeSpot(.95,1.8,5.2,3);if(!p)return false;
  const ringMat=overlayMat('#ffe36a',.9),fillMat=overlayMat('#fff4a8',.12),ring=new THREE.Mesh(strikeRingGeo,ringMat),fill=new THREE.Mesh(strikeFillGeo,fillMat),retic=new THREE.Group();
  for(const m of [ring,fill]){m.rotation.x=-Math.PI/2;m.renderOrder=9;retic.add(m)}
  const top=(Math.random()-.5)*14,pts=[];
  for(let i=0;i<=14;i++){const q=i/14,jit=(i>0&&i<14)?5.5*(1-q*.4):0;pts.push(new THREE.Vector3(top*(1-q)+(Math.random()-.5)*jit,48*(1-q),(Math.random()-.5)*jit*.6))}
  const curve=new THREE.CatmullRomCurve3(pts),coreGeo=new THREE.TubeGeometry(curve,lite?16:42,.2,5,false),haloGeo=new THREE.TubeGeometry(curve,lite?16:42,.75,6,false);
  const coreMat=new THREE.MeshBasicMaterial({color:'#f7fbff',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}),haloMat=new THREE.MeshBasicMaterial({color:'#8fb4ff',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
  const core=new THREE.Mesh(coreGeo,coreMat),halo=new THREE.Mesh(haloGeo,haloMat);core.visible=halo.visible=false;core.frustumCulled=halo.frustumCulled=false;
  const beamGeo=new THREE.BufferGeometry();beamGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,.5,0,0,48,0]),3));
  const beamMat=new THREE.LineBasicMaterial({color:'#fff0a0',transparent:true,opacity:.1,depthTest:false,depthWrite:false,fog:false}),beam=new THREE.Line(beamGeo,beamMat);beam.frustumCulled=false;beam.renderOrder=9;
  scene.add(retic,core,halo,beam);
  if(!p.quiet&&state.mode==='PLAYING')staticSound(p.T||.95);bolts.push({x:p.x,zs:p.zs,t:0,T:p.T||.95,quiet:!!p.quiet,age:0,struck:false,retic,ringMat,fillMat,core,halo,coreMat,haloMat,coreGeo,haloGeo,beam,beamGeo,beamMat});return true
}
function strikeBolt(b){
  b.struck=true;b.age=0;b.core.visible=b.halo.visible=true;b.beam.visible=false;
  const zr=b.zs+state.worldZ,dist=Math.hypot(b.x-plane.position.x,zr);
  state.skyFlash=Math.max(state.skyFlash,b.quiet?.45:.8);state.rumble=Math.max(state.rumble,.12+.4*Math.max(0,1-dist/60));
  if(!b.quiet){zapSound(Math.max(0,1-dist/90),clampN((b.x-plane.position.x)/25,-.8,.8));
  if(dist<30){flash.style.opacity=String(.05+.2*(1-dist/30));setTimeout(()=>flash.style.opacity='0',90)}
  emitSparks(b.x,b.zs,10,'#fff2a0','#9ac0ff',5,6)}
}
function removeBolt(i){const b=bolts[i];scene.remove(b.retic,b.core,b.halo,b.beam);b.ringMat.dispose();b.fillMat.dispose();b.coreMat.dispose();b.haloMat.dispose();b.beamMat.dispose();b.coreGeo.dispose();b.haloGeo.dispose();b.beamGeo.dispose();bolts.splice(i,1)}
function updateBolts(dt,canKill){
  for(let i=bolts.length-1;i>=0;i--){
    const b=bolts[i];b.t+=dt;const zr=b.zs+state.worldZ;
    b.retic.position.set(b.x,.5,zr);b.core.position.set(b.x,0,zr);b.halo.position.copy(b.core.position);b.beam.position.set(b.x,0,zr);
    if(!b.struck){
      const k=Math.min(1,b.t/b.T),pulse=.5+.5*Math.sin(state.clock*(10+24*k));
      b.ringMat.opacity=Math.min(1,.4+.6*pulse)*Math.min(1,b.t*5);b.fillMat.opacity=.08+.14*pulse;b.beamMat.opacity=.08+.3*k*pulse;
      if(b.t>=b.T)strikeBolt(b)
    }else{
      b.age+=dt;const f=.55+.45*Math.sin(b.age*95),fade=Math.max(0,1-b.age/.38);
      b.coreMat.opacity=fade*f;b.haloMat.opacity=fade*.55*f;b.ringMat.opacity=fade*.6;b.fillMat.opacity=fade*.3;
      if(canKill&&state.mode==='PLAYING'&&state.shieldTimer<=0&&state.shieldSafety<=0&&b.age<.22&&Math.hypot(b.x-plane.position.x,zr)<LR)burstCrash();
      if(b.age>=.4)removeBolt(i)
    }
  }
}
/* ---- particle pool: lava blobs, flame puffs, sparks, drips and infalling matter. one additive Points object, soft round sprites ---- */
const FX_MAX=1800,fxPosA=new Float32Array(FX_MAX*3),fxColA=new Float32Array(FX_MAX*3),fxSizeA=new Float32Array(FX_MAX),fxAlphaA=new Float32Array(FX_MAX),fx=[];
const fxGeo=new THREE.BufferGeometry();
for(const [n,a,k] of [['position',fxPosA,3],['pcol',fxColA,3],['psize',fxSizeA,1],['palpha',fxAlphaA,1]]){const at=new THREE.BufferAttribute(a,k);at.setUsage(THREE.DynamicDrawUsage);fxGeo.setAttribute(n,at)}
fxGeo.setDrawRange(0,0);
const fxMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{scale:{value:700}},vertexShader:`attribute vec3 pcol;attribute float psize;attribute float palpha;uniform float scale;varying vec3 vC;varying float vA;void main(){vC=pcol;vA=palpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(psize*scale/max(.2,-mv.z),1.,240.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float f=1.-d;gl_FragColor=vec4(vC*(.55+f*f*.9),f*vA);}`});
const fxPts=new THREE.Points(fxGeo,fxMat);fxPts.frustumCulled=false;fxPts.renderOrder=10;scene.add(fxPts);
const FX_HOT=[1,.7,.25],FX_RED=[.75,.1,.02],rnd=Math.random,R2=(a,b)=>a+(b-a)*Math.random();
function fxP(o){if(fx.length>=FX_MAX)return;const p=Object.assign({x:0,y:0,zs:0,vx:0,vy:0,vz:0,g:0,drag:0,life:1,s0:.3,s1:.2,a:1,c0:FX_HOT,c1:FX_RED,ph:rnd()*6.28,land:false,kind:0},o);p.max=p.life;fx.push(p)}
/* WELL_TILT / WELL_ROLL: the accretion disc is a ring tilted toward the camera; infalling matter uses the same maths so it hugs the disc */
const WELL_TILT=-1,WELL_ROLL=.28;
function updateFx(dt){
  fxMat.uniforms.scale.value=renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360));
  const ct=Math.cos(WELL_TILT),st=Math.sin(WELL_TILT),cr=Math.cos(WELL_ROLL),sr=Math.sin(WELL_ROLL);let n=0;
  for(let i=0;i<fx.length;){
    const p=fx[i];p.life-=dt;
    if(p.kind===1)p.r-=p.vr*dt*(1+(6.6-p.r)*.16);
    if(p.life<=0||(p.kind===1&&p.r<1.45)){fx[i]=fx[fx.length-1];fx.pop();continue}
    let k,fade;
    if(p.kind===1){
      p.ang+=p.av*dt*(6/Math.max(1.3,p.r));
      const u=Math.cos(p.ang)*p.r,v=Math.sin(p.ang)*p.r,yy=v*ct,zz=v*st;
      p.x=p.cx+u*cr-yy*sr;p.y=p.cy+u*sr+yy*cr;p.zs=p.cz+zz;
      k=clampN(1-(p.r-1.45)/5,0,1);fade=clampN((p.r-1.45)/1.1,0,1)*Math.min(1,(p.max-p.life)*3)
    }else{
      const dr=Math.exp(-p.drag*dt);p.vx*=dr;p.vy*=dr;p.vz*=dr;p.vy-=p.g*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.zs+=p.vz*dt;
      if(p.land&&p.y<.3&&p.vy<0){p.y=.3;p.vx=p.vy=p.vz=0;p.g=0;p.land=false;p.life=Math.min(p.life,.3)}
      k=1-p.life/p.max;fade=Math.min(1,k*10)*Math.min(1,p.life/.25)*(p.flick?(.7+.3*Math.sin(state.clock*38+p.ph)):1)
    }
    const j=n*3,kc=Math.min(1,k*1.25);
    fxPosA[j]=p.x;fxPosA[j+1]=p.y;fxPosA[j+2]=p.zs+state.worldZ;
    fxColA[j]=p.c0[0]+(p.c1[0]-p.c0[0])*kc;fxColA[j+1]=p.c0[1]+(p.c1[1]-p.c0[1])*kc;fxColA[j+2]=p.c0[2]+(p.c1[2]-p.c0[2])*kc;
    fxSizeA[n]=p.s0+(p.s1-p.s0)*k;fxAlphaA[n]=p.a*fade;n++;i++
  }
  fxGeo.setDrawRange(0,n);fxGeo.attributes.position.needsUpdate=fxGeo.attributes.pcol.needsUpdate=fxGeo.attributes.psize.needsUpdate=fxGeo.attributes.palpha.needsUpdate=true;fxPts.visible=n>0
}
function clearFx(){fx.length=0;fxGeo.setDrawRange(0,0);fxPts.visible=false}
/* ---- lava geysers (Magma Fields): glowing cracks open in the ground and brighten, then a column of flame and lava erupts, throwing lava blobs, flame sparks and drips ---- */
const flameGeo=new THREE.CylinderGeometry(.35,1.5,1,22,10,true);flameGeo.translate(0,.5,0);
const crackFrag=`uniform float glow;uniform float time;uniform float ph;varying float vT;varying float vC;void main(){float e=1.-abs(vC);float flick=.62+.38*sin(ph+vT*5.);vec3 deep=vec3(.5,.07,.02),hot=vec3(1.,.62,.16),white=vec3(1.,.93,.65);vec3 c=mix(deep,hot,clamp(glow*1.2*e+.1,0.,1.));c=mix(c,white,smoothstep(.55,1.,glow)*e*e);float a=(.7+.3*min(glow,1.))*smoothstep(0.,.7,e)*(1.-vT*.25)*flick;gl_FragColor=vec4(c*(1.1+glow*1.5),a);}`;
const crackVert=`attribute float aT;attribute float aC;varying float vT;varying float vC;void main(){vT=aT;vC=aC;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const haloGeo=new THREE.CircleGeometry(3.4,36);
const haloFrag=`uniform float glow;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(1.,.5,.14,pow(1.-r,1.8)*min(glow,1.4)*.95);}`;
const haloVert=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const flameFrag=`uniform float time;uniform float seed;uniform float alpha;uniform float core;varying vec2 vUv;void main(){float y=vUv.y;float ang=vUv.x*6.28318;float n=sin(ang*3.+y*9.-time*14.+seed)*.5+.5;float n2=sin(ang*5.-y*15.-time*19.+seed*2.)*.5+.5;float f=n*.6+n2*.4;float body=smoothstep(1.,.15,y+(f-.5)*.5*y);vec3 bot=core>.5?vec3(1.,.95,.7):vec3(1.,.6,.15);vec3 top=core>.5?vec3(1.,.55,.15):vec3(.85,.16,.03);vec3 c=mix(bot,top,smoothstep(0.,.9,y));float a=body*(1.-smoothstep(.72,1.,y))*alpha*(.5+.5*f);gl_FragColor=vec4(c*1.25,a);}`;
const flameVert=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
function buildCrackGeo(){
  const pos=[],aT=[],aC=[],idx=[];
  const crack=(ang,len,w0,t0)=>{
    const N=6,pts=[];let x=0,z=0,a=ang;
    for(let i=0;i<=N;i++){pts.push({x,z,a});a+=(rnd()-.5)*.9;x+=Math.cos(a)*len/N;z+=Math.sin(a)*len/N}
    for(let i=0;i<=N;i++){
      const p=pts[i],w=w0*(1-i/N*.85)+.02,nx=-Math.sin(p.a),nz=Math.cos(p.a),b=pos.length/3,t=t0+i/N*(1-t0);
      pos.push(p.x+nx*w,0,p.z+nz*w,p.x-nx*w,0,p.z-nz*w);aT.push(t,t);aC.push(-1,1);
      if(i>0){const q=b-2;idx.push(q,q+1,b,q+1,b+1,b)}
    }
    return pts
  };
  const n=5+(rnd()*2|0),off=rnd()*6.28;
  for(let i=0;i<n;i++){
    const a=off+i/n*6.283+(rnd()-.5)*.5,len=R2(1.8,2.9),pts=crack(a,len,.2,0),bp=pts[2+(rnd()*2|0)];
    if(rnd()<.8){const sub=crack(bp.a+(rnd()<.5?-1:1)*R2(.6,1.1),len*.5,.1,.35);for(const q of sub){q.x+=bp.x;q.z+=bp.z}
      /* shift the branch ribbon to start at the branch point */
      const base=pos.length/3-14;for(let v=0;v<14;v++){pos[(base+v)*3]+=bp.x;pos[(base+v)*3+2]+=bp.z}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aT',new THREE.Float32BufferAttribute(aT,1));g.setAttribute('aC',new THREE.Float32BufferAttribute(aC,1));g.setIndex(idx);return g
}
const GEYSER_WARN=2.7;   /* seconds of warning (was 1.4): cracks now appear ~2x farther out */
function spawnGeyser(sp){
  const p=sp||pickStrikeSpot(GEYSER_WARN,1.6,5,2.6);if(!p)return false;
  const crackGeo=buildCrackGeo(),crackMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{glow:{value:0},time:{value:0},ph:{value:0}},vertexShader:crackVert,fragmentShader:crackFrag}),cracks=new THREE.Mesh(crackGeo,crackMat);
  const haloMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{glow:{value:0}},vertexShader:haloVert,fragmentShader:haloFrag}),halo=new THREE.Mesh(haloGeo,haloMat);halo.rotation.x=-Math.PI/2;
  cracks.renderOrder=9;halo.renderOrder=8;cracks.frustumCulled=halo.frustumCulled=false;
  const group=new THREE.Group();group.add(halo,cracks);group.scale.setScalar(1.35);
  const mk=core=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,uniforms:{time:{value:0},seed:{value:rnd()*20},alpha:{value:0},core:{value:core}},vertexShader:flameVert,fragmentShader:flameFrag});
  const colMat=mk(0),coreMat=mk(1),col=new THREE.Group(),outer=new THREE.Mesh(flameGeo,colMat),inner=new THREE.Mesh(flameGeo,coreMat);
  inner.scale.set(.55,.8,.55);col.add(outer,inner);col.visible=false;outer.frustumCulled=inner.frustumCulled=false;
  scene.add(group,col);geysers.push({x:p.x,zs:p.zs,t:0,T:p.T||GEYSER_WARN,quiet:!!p.quiet,e:-1,acc:0,ph:0,group,crackGeo,crackMat,haloMat,col,colMat,coreMat,inner});return true
}
function removeGeyser(i){const g=geysers[i];scene.remove(g.group,g.col);g.crackGeo.dispose();g.crackMat.dispose();g.haloMat.dispose();g.colMat.dispose();g.coreMat.dispose();geysers.splice(i,1)}
function fxLava(g,sp,v0,v1,y0){const a=rnd()*6.283,s=sp*Math.sqrt(rnd());fxP({x:g.x+Math.cos(a)*.5,y:y0,zs:g.zs+Math.sin(a)*.5,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:R2(v0,v1),g:22,drag:.12,life:R2(1.1,1.8),s0:R2(.5,.9),s1:.32,a:.95,c0:[1,.72,.26],c1:FX_RED,land:true})}
function fxSpark(g){const a=rnd()*6.283,s=R2(1.5,9);fxP({x:g.x,y:R2(.4,2),zs:g.zs,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:R2(8,26),g:14,drag:.22,life:R2(.5,1.4),s0:.2,s1:.05,a:1,c0:[1,.96,.62],c1:[1,.35,.06],flick:true})}
function fxPuff(g,h){fxP({x:g.x+R2(-.9,.9),y:R2(.3,Math.max(.5,h*.35)),zs:g.zs+R2(-.9,.9),vx:R2(-1.2,1.2),vz:R2(-1.2,1.2),vy:R2(5,11),g:-2,drag:.6,life:R2(.5,.9),s0:R2(1,1.6),s1:R2(2.2,3.3),a:.36,c0:[1,.62,.2],c1:[.5,.06,.02]})}
function fxDrip(g,h){const a=rnd()*6.283,r=R2(.5,1.3);fxP({x:g.x+Math.cos(a)*r,y:R2(1,Math.max(1.5,h*.8)),zs:g.zs+Math.sin(a)*r,vx:Math.cos(a)*R2(.1,.9),vz:Math.sin(a)*R2(.1,.9),vy:R2(-1,1),g:16,drag:.05,life:R2(.8,1.4),s0:.28,s1:.2,a:.95,c0:[1,.6,.15],c1:[.7,.1,.02],land:true})}
function updateGeysers(dt,canKill){
  for(let i=geysers.length-1;i>=0;i--){
    const g=geysers[i];g.t+=dt;const zr=g.zs+state.worldZ,q=g.quiet?.55:1;
    g.group.position.set(g.x,.5,zr);g.col.position.set(g.x,0,zr);g.crackMat.uniforms.time.value=state.clock;
    g.ph+=dt*(26+34*Math.min(1,g.t/g.T));g.crackMat.uniforms.ph.value=g.ph;   /* strobe: fast from the start, faster as it nears */
    if(g.t<g.T){
      const k=g.t/g.T,gl=(.85+.65*Math.pow(k,1.4))*Math.min(1,g.t*10);
      g.crackMat.uniforms.glow.value=gl;g.haloMat.uniforms.glow.value=gl;
      if(k>.45){g.acc+=dt*(k-.45)*70*q;while(g.acc>=1){g.acc--;const a=rnd()*6.283,r=R2(.2,2);fxP({x:g.x+Math.cos(a)*r,y:.6,zs:g.zs+Math.sin(a)*r,vx:R2(-.6,.6),vz:R2(-.6,.6),vy:R2(1.5,4),g:5,drag:.3,life:R2(.5,.9),s0:.13,s1:.04,a:.9,c0:[1,.8,.4],c1:[1,.3,.05],flick:true})}}
    }else{
      if(g.e<0){
        g.e=0;const dist=Math.hypot(g.x-plane.position.x,zr);state.rumble=Math.max(state.rumble,.1+.3*Math.max(0,1-dist/60));
        if(!g.quiet)geyserSound(.6*Math.max(0,1-dist/80)+.05,clampN((g.x-plane.position.x)/25,-.8,.8));
        for(let n=0;n<Math.round(24*q);n++)fxLava(g,4.5,11,22,.5);
        for(let n=0;n<Math.round(46*q);n++)fxSpark(g);
        for(let n=0;n<Math.round(12*q);n++)fxPuff(g,10)
      }
      g.e+=dt;const e=g.e,fade=e>.85?Math.max(0,1-(e-.85)/.3):1,h=14*smooth01(e/.18)*fade,wob=1+.12*Math.sin(e*45),gl=Math.max(0,1.5*(1-e/.9));
      g.crackMat.uniforms.glow.value=gl;g.haloMat.uniforms.glow.value=1.1*fade;
      g.col.visible=h>.05;g.col.scale.set(wob,Math.max(.01,h),wob);
      for(const m of [g.colMat,g.coreMat]){m.uniforms.time.value=state.clock;m.uniforms.alpha.value=.85*fade}
      if(e<.85){g.acc+=dt;const rate=dt*q;
        for(let n=0,c=rate*30+rnd();n<c-.5;n++)fxLava(g,3.2,9,19,R2(.5,3));
        for(let n=0,c=rate*85+rnd();n<c-.5;n++)fxSpark(g);
        for(let n=0,c=rate*60+rnd();n<c-.5;n++)fxPuff(g,h)}
      if(e>.3&&e<1.4){for(let n=0,c=dt*q*55+rnd();n<c-.5;n++)fxDrip(g,h)}
      if(canKill&&state.mode==='PLAYING'&&state.shieldTimer<=0&&state.shieldSafety<=0&&h>3.3&&Math.hypot(g.x-plane.position.x,zr)<GR+.1)burstCrash();
      if(e>=1.15)removeGeyser(i)
    }
  }
}
/* ---- gravity wells (Eclipse): a mini black hole hanging at plane height. inside WELL_PULL it drags the plane sideways hard, inside WELL_WARP it bends the screen toward itself,
   inside WELL_STRAIN it drains the stability meter. never kills directly; losing stability costs control for a moment. only placed where the ground around it is open ---- */
const WELL_Y=CONFIG.baseAltitude+.15,WELL_PULL=34,WELL_WARP=30,WELL_STRAIN=21,WELL_FORCE=135,WELL_DRAIN=1.3;
const wellDiscFrag=`uniform float time;uniform float alpha;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float ri=.27;if(r>1.||r<ri)discard;float t=(r-ri)/(1.-ri);float a=atan(p.y,p.x);float sw=sin(a*3.-t*14.+time*3.4)*.5+.5;float sw2=sin(a*7.+t*23.-time*5.1)*.5+.5;float band=mix(.55,1.,sw*.65+sw2*.35);vec3 hot=vec3(1.,.85,1.),mid=vec3(.62,.2,1.),cold=vec3(.18,.03,.4);vec3 c=mix(hot,mid,smoothstep(0.,.25,t));c=mix(c,cold,smoothstep(.25,1.,t));float dop=.75+.25*cos(a-.6);float fade=pow(1.-t,1.35)*smoothstep(0.,.05,t);gl_FragColor=vec4(c*band*dop*1.35,fade*band*alpha);}`;
const wellRingFrag=`uniform float alpha;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float ri=.775;if(r>1.||r<ri)discard;float t=(r-ri)/(1.-ri);gl_FragColor=vec4(vec3(.85,.6,1.)*1.3,pow(1.-t,2.)*smoothstep(0.,.1,t)*alpha);}`;
const wellGlowFrag=`uniform float alpha;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.45,.12,.9,pow(1.-r,2.4)*.55*alpha);}`;
const wellDarkFrag=`uniform float alpha;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.02,0.,.05,pow(1.-r,1.5)*.6*alpha);}`;
const wellVert=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const wellCoreGeo=new THREE.SphereGeometry(1.35,24,16),wellDiscGeo=new THREE.RingGeometry(1.75,6.4,96,1),wellRingGeo=new THREE.RingGeometry(1.38,1.78,72),wellGlowGeo=new THREE.CircleGeometry(12,48),wellDarkGeo=new THREE.CircleGeometry(4.4,40);
const wellMat=(frag,blend,test)=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:test,blending:blend,side:THREE.DoubleSide,uniforms:{time:{value:0},alpha:{value:0}},vertexShader:wellVert,fragmentShader:frag});
function spawnWell(dpO,sideO){
  for(let a=0;a<6;a++){
    const Dp=state.distance+(dpO||95+Math.random()*25),x=state.x+(sideO||(Math.random()<.5?-1:1))*(7+Math.random()*(state.arena?20:9));
    if(!freeBox(x-6,x+6,Dp-30,Dp+30))continue;
    const group=new THREE.Group(),mats=[],add=(geo,mat,order)=>{const m=new THREE.Mesh(geo,mat);m.renderOrder=order;m.frustumCulled=false;group.add(m);mats.push(mat);return m};
    const dark=add(wellDarkGeo,wellMat(wellDarkFrag,THREE.NormalBlending,true),3),glow=add(wellGlowGeo,wellMat(wellGlowFrag,THREE.AdditiveBlending,true),4);
    const coreMat=new THREE.MeshBasicMaterial({color:'#07000f',transparent:true,opacity:0,fog:false});mats.push(coreMat);
    const core=new THREE.Mesh(wellCoreGeo,coreMat);core.renderOrder=5;core.frustumCulled=false;group.add(core);
    const pivot=new THREE.Group();pivot.rotation.z=WELL_ROLL;group.add(pivot);
    const discMat=wellMat(wellDiscFrag,THREE.AdditiveBlending,true),disc=new THREE.Mesh(wellDiscGeo,discMat);disc.rotation.x=WELL_TILT;disc.renderOrder=6;disc.frustumCulled=false;pivot.add(disc);mats.push(discMat);
    const ring=add(wellRingGeo,wellMat(wellRingFrag,THREE.AdditiveBlending,true),7);
    scene.add(group);wells.push({x,y:WELL_Y,zs:-Dp,t:0,acc:0,group,mats,coreMat,discMat,billboards:[dark,glow,ring]});return true
  }
  return false
}
function removeWell(i){const w=wells[i];scene.remove(w.group);for(const m of w.mats)m.dispose();wells.splice(i,1)}
function updateWells(dt,canKill){
  let ext=0,strain=0,warp=0,best=null;
  for(let i=wells.length-1;i>=0;i--){
    const w=wells[i];w.t+=dt;const zr=w.zs+state.worldZ;
    w.group.position.set(w.x,w.y,zr);
    const al=Math.min(1,w.t*1.2)*clampN((zr+125)/30,0,1)*(1-clampN((zr-4)/8,0,1));
    for(const m of w.mats){if(m.uniforms){m.uniforms.alpha.value=al;if(m.uniforms.time)m.uniforms.time.value=state.clock}}
    w.coreMat.opacity=al;for(const b of w.billboards)b.quaternion.copy(camera.quaternion);
    if(al>.25){w.acc+=dt*38*al;while(w.acc>=1){w.acc--;fxP({kind:1,cx:w.x,cy:w.y,cz:w.zs,ang:rnd()*6.283,r:R2(3.2,6.4),av:R2(2.2,3.4),vr:R2(1.1,2.1),life:6,s0:.3,s1:.1,a:.9,c0:[.55,.15,1],c1:[1,.85,1]})}}
    if(canKill){
      const dx=w.x-plane.position.x,dy=w.y-plane.position.y,d=Math.hypot(dx,dy,zr);
      ext+=WELL_FORCE*Math.pow(clampN(1-d/WELL_PULL,0,1),1.25)*clampN(dx/2.5,-1,1);
      strain=Math.max(strain,smooth01(clampN(1-d/WELL_STRAIN,0,1)));
      const wp=smooth01(clampN(1-d/WELL_WARP,0,1));if(wp>warp){warp=wp;best=w}
    }
    if(zr>40)removeWell(i)
  }
  state.extForce+=ext;state.wellStrain=Math.max(state.wellStrain,strain);
  if(warp>state.wellWarp){state.wellWarp=warp;state.wellRef=best}
  if(strain>.05)state.rumble=Math.max(state.rumble,.45*strain);
  wellHum(Math.max(warp*.9,strain))
}
/* ---- crosswind gusts (Dune Sea, Solar Flare): streaks sweep in for .85 s, then a 1.6 s push (about half of full steering power) ---- */
function updateGustLines(){
  const on=state.gustPhase!=='idle';gustLines.visible=on;if(!on)return;
  const warn=state.gustPhase==='warn',p=warn?clampN(state.gustTime/.85,0,1):1,dir=state.gustDir,arr=gustGeo.attributes.position.array,span=80;
  for(let i=0;i<GUST_N;i++){
    const s=gustSeed[i],prog=(state.clock*(warn?.8:1.6)+s.o)%1,x0=state.x-dir*span/2+dir*prog*span,x1=x0-dir*s.len*(warn?.6:1),show=warn?s.o<p*.45:true,b=i*6;
    arr[b]=x0;arr[b+1]=s.y;arr[b+2]=s.z;arr[b+3]=show?x1:x0;arr[b+4]=s.y;arr[b+5]=s.z
  }
  gustGeo.attributes.position.needsUpdate=true;gustMat.opacity=warn?.15+.35*p:.55*clampN(.3+state.gustEnv,0,1)
}
function updateGust(dt,canKill,rule){
  if(!rule||!canKill)state.gustPhase='idle';
  else{
    state.gustTime+=dt;
    if(state.gustPhase==='idle'){state.gustT-=dt;if(state.gustT<=0){state.gustPhase='warn';state.gustTime=0;state.gustDir=Math.random()<.5?-1:1;gustSound(state.gustDir)}}
    else if(state.gustPhase==='warn'){if(state.gustTime>=.85){state.gustPhase='blow';state.gustTime=0}}
    else if(state.gustTime>=1.6){state.gustPhase='idle';state.gustT=lerpN(rule.every[0],rule.every[1],clampN((state.distance-state.levelStart)/CONFIG.levelMeters,0,1))*(.75+Math.random()*.5)}
  }
  const env=state.gustPhase==='blow'?Math.pow(Math.sin(Math.PI*clampN(state.gustTime/1.6,0,1)),.7):0;
  state.gustEnv=env;state.extForce+=state.gustDir*24*env;
  state.gustRoll=lerpN(state.gustRoll,-state.gustDir*.06*env,Math.min(1,dt*6));if(Math.abs(state.gustRoll)<.0005&&!env)state.gustRoll=0;
  updateGustLines()
}
/* harmless distant lightning on the Thunderstorm map: two quick brightness pulses and a late rumble */
function skyFlashTick(dt){
  state.skyT-=dt;if(state.skyT<=0){state.flashPulses=2;state.flashGap=0;state.skyT=4+Math.random()*5;setTimeout(()=>thunderSound(.45+Math.random()*.3),500+Math.random()*900)}
  if(state.flashPulses>0){state.flashGap-=dt;if(state.flashGap<=0){state.skyFlash=Math.max(state.skyFlash,.9);state.flashPulses--;state.flashGap=.18}}
}
/* ---- SKY BEAMS (Perplexity): white columns of light that blast down from the sky. A rare, telegraphed event.
   fixed column ('s') or a slowly turning blade ('r'). The ground marks the spot for T seconds, then the beam slams down about BM_LEAD s
   ahead of the plane and stays lethal for BM_ACT s. Big shake + flash + shockwave. Never aimed at the plane's exact line: it must be dodged. ---- */
const beams=[],BM_R=3.1,BL_HALF=7,BL_KILL=1.9,BM_LEAD=.5,BM_ACT=1.15;
const bmCylGeo=new THREE.CylinderGeometry(1,1,70,24,1,true),bmBladeGeo=new THREE.BoxGeometry(1,70,1),bmBarGeo=new THREE.BoxGeometry(1,.05,1),bmShockGeo=new THREE.RingGeometry(.86,1,48);
const bmMat=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide});
function spawnBeam(){
  const blade=Math.random()<.4,T=blade?1.9:1.5,sp=Math.max(state.speed,CONFIG.baseSpeed),Dp=state.distance+sp*(T+BM_LEAD)+(Math.random()-.5)*6;
  const base=state.x+clampN(state.vx*T*.5,-6,6),side=Math.random()<.5?-1:1,x=base+side*(blade?Math.random()*3.5:1.6+Math.random()*4.4);
  const mats=[],retic=new THREE.Group(),halo=new THREE.Mesh(blade?bmBladeGeo:bmCylGeo,bmMat('#bcd4ff',0)),core=new THREE.Mesh(blade?bmBladeGeo:bmCylGeo,bmMat('#ffffff',0));
  const shockMat=overlayMat('#ffffff',0),shock=new THREE.Mesh(bmShockGeo,shockMat);shock.rotation.x=-Math.PI/2;shock.renderOrder=9;shock.visible=false;
  mats.push(halo.material,core.material,shockMat);
  let rM,fM=null,bar=null;
  if(blade){
    rM=overlayMat('#ffffff',0);bar=new THREE.Mesh(bmBarGeo,rM);bar.scale.set(BL_HALF*2,1,1.2);bar.renderOrder=9;retic.add(bar);mats.push(rM);
    halo.scale.set(BL_HALF*2,1,2.2);core.scale.set(BL_HALF*1.92,1,1)
  }else{
    rM=overlayMat('#ffffff',0);fM=overlayMat('#ffffff',.1);
    const ring=new THREE.Mesh(strikeRingGeo,rM),fill=new THREE.Mesh(strikeFillGeo,fM);
    for(const m of [ring,fill]){m.rotation.x=-Math.PI/2;m.scale.setScalar(BM_R/LR);m.renderOrder=9;retic.add(m)}mats.push(rM,fM);
    halo.scale.set(BM_R,1,BM_R);core.scale.set(BM_R*.5,1,BM_R*.5)
  }
  halo.visible=core.visible=false;halo.frustumCulled=core.frustumCulled=false;scene.add(retic,halo,core,shock);
  if(state.mode==='PLAYING')beamChargeSound(T);beams.push({blade,x,zs:-Dp,t:0,T,age:0,struck:false,rot:Math.random()*Math.PI,w:(Math.random()<.5?-1:1)*(.35+Math.random()*.25),retic,halo,core,shock,shockMat,rM,fM,bar,mats});return true
}
function removeBeam(i){const b=beams[i];scene.remove(b.retic,b.halo,b.core,b.shock);for(const m of b.mats)m.dispose();beams.splice(i,1)}
function strikeBeam(b){
  b.struck=true;b.age=0;b.halo.visible=b.core.visible=b.shock.visible=true;
  const zr=b.zs+state.worldZ,dist=Math.hypot(b.x-plane.position.x,zr),near=Math.max(0,1-dist/80),th=b.rot+b.w*b.t,R=state.reduced;
  state.rumble=Math.max(state.rumble,(R?.5:2.2)*(.45+.55*near));   /* rumble decays in play (shake does not), ~3x a lightning strike */
  state.skyFlash=Math.max(state.skyFlash,.7);beamSound(near,clampN((b.x-plane.position.x)/25,-.8,.8));
  if(!R&&dist<45){flash.style.opacity=String(.08+.16*(1-dist/45));setTimeout(()=>flash.style.opacity='0',80)}
  emitSparks(b.x,b.zs,b.blade?14:26,'#ffffff','#bcd4ff',9,9);
  if(b.blade)for(const q of [-1,1])emitSparks(b.x+q*Math.cos(th)*BL_HALF,b.zs+q*Math.sin(th)*BL_HALF,8,'#ffffff','#bcd4ff',7,8)
}
function updateBeams(dt,canKill){
  for(let i=beams.length-1;i>=0;i--){
    const b=beams[i];b.t+=dt;const zr=b.zs+state.worldZ,th=b.rot+b.w*b.t;
    b.retic.position.set(b.x,.5,zr);b.halo.position.set(b.x,30,zr);b.core.position.set(b.x,30,zr);b.shock.position.set(b.x,.6,zr);
    if(b.blade)b.halo.rotation.y=b.core.rotation.y=b.bar.rotation.y=-th;
    if(!b.struck){
      const k=Math.min(1,b.t/b.T),pulse=.5+.5*Math.sin(state.clock*(9+22*k));
      b.rM.opacity=Math.min(1,.3+.7*pulse)*Math.min(1,b.t*4)*(b.blade?.8:1);if(b.fM)b.fM.opacity=.05+.14*pulse*k;
      if(b.t>=b.T)strikeBeam(b)
    }else{
      b.age+=dt;const f=.8+.2*Math.sin(b.age*70),fade=b.age<BM_ACT?1:Math.max(0,1-(b.age-BM_ACT)/.35),s=1+.7*Math.max(0,1-b.age/.18);
      b.core.material.opacity=fade*f;b.halo.material.opacity=fade*.55*f;b.rM.opacity=fade*.5;if(b.fM)b.fM.opacity=fade*.25;
      if(b.blade){b.halo.scale.z=2.2*s;b.core.scale.z=s}else{b.halo.scale.x=b.halo.scale.z=BM_R*s;b.core.scale.x=b.core.scale.z=BM_R*.5*s}
      if(b.age<.6){const q=b.age/.6;b.shock.scale.setScalar((b.blade?BL_HALF:BM_R)*(1+q*2.4));b.shockMat.opacity=(1-q)*.8}else b.shockMat.opacity=0;
      if(canKill&&state.mode==='PLAYING'&&state.shieldTimer<=0&&state.shieldSafety<=0&&b.age<BM_ACT){
        let hit;
        if(b.blade){const dx=plane.position.x-b.x,dz=-zr,c=Math.cos(th),sn=Math.sin(th),q=clampN(dx*c+dz*sn,-BL_HALF,BL_HALF);hit=Math.hypot(dx-q*c,dz-q*sn)<BL_KILL}
        else hit=Math.hypot(b.x-plane.position.x,zr)<BM_R;
        if(hit)burstCrash()
      }
      if(b.age>=BM_ACT+.4)removeBeam(i)
    }
  }
}
function updateHazards(dt,canKill){
  state.extForce=0;state.wellStrain=0;state.wellWarp=0;state.wellRef=null;state.skyFlash=Math.max(0,state.skyFlash-dt*3.5);limitFlash();
  updateBolts(dt,canKill);updateBeams(dt,canKill);updateGeysers(dt,canKill);updateWells(dt,canKill);
  const R=state.arena?ARENA_RULE:LEVEL_RULES[state.level];if(perpHazardsHeld())state.gustT=Math.min(state.gustT,3);updateGust(dt,canKill,perpHazardsHeld()?null:R.gust);
  if(canKill&&R.lightning&&!R.perplex)skyFlashTick(dt)
}
function updateHazardSpawns(dt){
  if(perpHazardsHeld()){state.lightT=Math.min(state.lightT,1);state.geyserT=Math.min(state.geyserT,2.5);state.wellT=Math.min(state.wellT,6);state.beamT=Math.min(state.beamT??4,8);return}
  const R=LEVEL_RULES[state.level],prog=clampN((state.distance-state.levelStart)/CONFIG.levelMeters,0,1),hz=R.perplex&&!state.arena?perpHazMul(state.distance+Math.max(state.speed,CONFIG.baseSpeed)*1.5):1,iv=r=>lerpN(r.every[0],r.every[1],prog)*(.65+Math.random()*.7)*hz;
  if(R.lightning){state.lightT-=dt;if(state.lightT<=0)state.lightT=spawnLightning()?iv(R.lightning):.4}
  if(R.geyser){state.geyserT-=dt;if(state.geyserT<=0)state.geyserT=spawnGeyser()?iv(R.geyser):.4}
  if(R.beam){state.beamT=(state.beamT??4)-dt;if(state.beamT<=0)state.beamT=spawnBeam()?iv(R.beam):.4}
  if(R.well){state.wellT-=dt;if(state.wellT<=0)state.wellT=spawnWell()?iv(R.well):.8}
}
function clearHazards(){
  if(state.arn)state.arn.q.length=0;
  while(bolts.length)removeBolt(bolts.length-1);while(geysers.length)removeGeyser(geysers.length-1);while(wells.length)removeWell(wells.length-1);while(beams.length)removeBeam(beams.length-1);clearFx();state.wellStrain=0;state.wellWarp=0;state.wellRef=null;
  state.skyFlash=0;state.extForce=0;state.gustPhase='idle';state.gustEnv=0;state.gustRoll=0;state.flashPulses=0;gustLines.visible=false
}
