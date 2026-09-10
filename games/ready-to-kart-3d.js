import * as THREE from 'three';

const C=window.ReadyToRaceCore;
const stage=document.getElementById('stage'),statusEl=document.getElementById('status'),roomCodeEl=document.getElementById('roomCode'),joinUrlEl=document.getElementById('joinUrl'),copyBtn=document.getElementById('copyBtn'),startBtn=document.getElementById('startBtn'),newRoomBtn=document.getElementById('newRoomBtn'),mapSelect=document.getElementById('mapSelect'),boardEl=document.getElementById('board'),bigText=document.getElementById('bigText'),cameraBtn=document.getElementById('cameraBtn'),fullscreenBtn=document.getElementById('fullscreenBtn');
const SCALE=.045;
const MAPS={
 park:{id:'park',label:'Rùa Park',emoji:'🌿',cx:480,cy:300,rx:330,ry:190,terrain:0x276c3d,terrain2:0x174d2d,road:0x4a4d50,sky:0x8ed9ff,fog:0x8ed9ff,prop:'tree'},
 desert:{id:'desert',label:'Desert Dash',emoji:'🏜️',cx:480,cy:300,rx:382,ry:145,terrain:0xc39754,terrain2:0xa77739,road:0x5d5145,sky:0xffcc8a,fog:0xe0b672,prop:'cactus'},
 night:{id:'night',label:'Night City',emoji:'🌃',cx:480,cy:300,rx:285,ry:225,terrain:0x102235,terrain2:0x071522,road:0x303641,sky:0x050914,fog:0x07101c,prop:'lamp'},
 ice:{id:'ice',label:'Ice Lake',emoji:'❄️',cx:500,cy:300,rx:350,ry:175,terrain:0xbfe7ef,terrain2:0x8fc9d7,road:0x687b87,sky:0xdaf7ff,fog:0xc9edf5,prop:'crystal'}
};
let selectedMap='park';
const track={cx:480,cy:300,rx:330,ry:190,width:960,height:600,edgeMargin:18};
const colors=[0xff5b5b,0x4dc4ff,0xffd34d,0x8be36e,0xd177ff,0xff8bd0];
let db=null,roomRef=null,roomState=null,roomCode='',hostId='',disconnectOp=null,transitioning=false,finishing=false,telemetryAt=0,last=performance.now(),cameraMode=0;
const cars=new Map(),kartViews=new Map(),dust=[];
try{hostId=sessionStorage.getItem('readyToKart3DHostId')||'';if(!hostId){hostId=(crypto.randomUUID?.()||('k'+Date.now()+Math.random())).replace(/[^a-z0-9]/gi,'').slice(0,32);sessionStorage.setItem('readyToKart3DHostId',hostId)}}catch(e){hostId='k'+Date.now()}

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,180);
camera.position.set(0,15,23);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;stage.appendChild(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xffffff,0x314331,1.45);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-18,28,-14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;scene.add(sun);
const world=new THREE.Group();scene.add(world);

function setStatus(text){statusEl.textContent=text}
function controllerUrl(code){const u=new URL('ready-to-race-controller.html',location.href);u.searchParams.set('room',code);return u.href}
function map(){return MAPS[selectedMap]||MAPS.park}
function applyTrack(){const m=map();Object.assign(track,{cx:m.cx,cy:m.cy,rx:m.rx,ry:m.ry,width:960,height:600,edgeMargin:18})}
function wx(x){return(x-track.cx)*SCALE}function wz(y){return(y-track.cy)*SCALE}
function players(){return Object.entries(roomState?.players||{}).map(([id,p])=>({id,name:C.cleanName(p?.name),vehicle:C.sanitizeVehicle(p?.vehicle),input:C.sanitizeInput(p?.input),joinedAt:Number(p?.joinedAt)||0})).sort((a,b)=>a.joinedAt-b.joinedAt||a.name.localeCompare(b.name,'vi'))}
function ensureCars(){applyTrack();const ps=players(),ids=new Set(ps.map(p=>p.id));for(const id of [...cars.keys()])if(!ids.has(id)){cars.delete(id);removeKart(id)}ps.forEach((p,i)=>{if(!cars.has(p.id)){const car=C.makeCar(i,track,p.vehicle);C.resetProgress(car,track);cars.set(p.id,car)}else cars.get(p.id).vehicle=p.vehicle;if(!kartViews.has(p.id))addKart(p.id,p,i)})}
function resetCars(){applyTrack();players().forEach((p,i)=>{const car=C.makeCar(i,track,p.vehicle);C.resetProgress(car,track);cars.set(p.id,car);removeKart(p.id);addKart(p.id,p,i)})}
function ranking(){return players().map(p=>({p,car:cars.get(p.id)})).filter(x=>x.car).sort((a,b)=>b.car.progress-a.car.progress||b.car.speed-a.car.speed)}

function clearWorld(){while(world.children.length)world.remove(world.children[0]);for(const id of [...kartViews.keys()])kartViews.delete(id);dust.length=0}
function mat(color,rough=.75,metal=.05){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
function mesh(geometry,material,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
function roadGeometry(m){const shape=new THREE.Shape();const rox=m.rx*1.08*SCALE,roy=m.ry*1.08*SCALE,rix=m.rx*.60*SCALE,riy=m.ry*.60*SCALE;shape.absellipse(0,0,rox,roy,0,Math.PI*2,false);const hole=new THREE.Path();hole.absellipse(0,0,rix,riy,0,Math.PI*2,true);shape.holes.push(hole);return new THREE.ShapeGeometry(shape,72)}
function curbRing(m,factor,colorA,colorB){const group=new THREE.Group();for(let i=0;i<56;i++){const a=i/56*Math.PI*2,x=Math.cos(a)*m.rx*factor*SCALE,z=Math.sin(a)*m.ry*factor*SCALE;const b=mesh(new THREE.BoxGeometry(.62,.13,.22),mat(i%2?colorA:colorB,.8),x,.11,z);b.rotation.y=-a;group.add(b)}return group}
function addTree(x,z,theme){const g=new THREE.Group();if(theme==='tree'){const trunk=mesh(new THREE.CylinderGeometry(.12,.16,1.25,7),mat(0x6d472a),0,.62,0);const crown=mesh(new THREE.ConeGeometry(.75,1.8,8),mat(0x1e7d40),0,1.75,0);g.add(trunk,crown)}else if(theme==='cactus'){const stem=mesh(new THREE.CylinderGeometry(.18,.24,1.7,7),mat(0x2e7e42),0,.85,0);const arm=mesh(new THREE.CylinderGeometry(.1,.12,.75,6),mat(0x2e7e42),.35,.95,0);arm.rotation.z=Math.PI/2;g.add(stem,arm)}else if(theme==='lamp'){const pole=mesh(new THREE.CylinderGeometry(.06,.08,2.6,7),mat(0x26313d,.35,.7),0,1.3,0);const glow=mesh(new THREE.SphereGeometry(.18,8,8),new THREE.MeshBasicMaterial({color:0x76e8ff}),0,2.55,0);g.add(pole,glow)}else{const cry=mesh(new THREE.OctahedronGeometry(.48,0),mat(0x8ee9ff,.2,.15),0,.6,0);cry.scale.y=1.8;g.add(cry)}g.position.set(x,0,z);world.add(g)}
function buildWorld(){clearWorld();const m=map();scene.background=new THREE.Color(m.sky);scene.fog=new THREE.Fog(m.fog,28,74);hemi.groundColor.setHex(m.terrain2);sun.intensity=m.id==='night'?1.1:2.2;
 const ground=mesh(new THREE.PlaneGeometry(48,31),mat(m.terrain,1),0,-.05,0);ground.rotation.x=-Math.PI/2;world.add(ground);
 const road=mesh(roadGeometry(m),mat(m.road,.92),0,.02,0);road.rotation.x=Math.PI/2;world.add(road);
 world.add(curbRing(m,1.085,0xffffff,0xe94f4f));world.add(curbRing(m,.595,0xffffff,0xe94f4f));
 for(let i=0;i<30;i++){const a=i/30*Math.PI*2,rad=i%2?1.35:.43;const x=Math.cos(a)*m.rx*rad*SCALE,z=Math.sin(a)*m.ry*rad*SCALE;if(Math.abs(x)<22&&Math.abs(z)<13)addTree(x,z,m.prop)}
 const railMat=mat(m.id==='night'?0x76e8ff:0xe5e7e8,.4,.6);const rails=[[0,0.18,-13.45,43.6,.28,.18],[0,.18,13.45,43.6,.28,.18],[-21.45,.18,0,.18,.28,27.1],[21.45,.18,0,.18,.28,27.1]];for(const [x,y,z,w,h,d]of rails)world.add(mesh(new THREE.BoxGeometry(w,h,d),railMat,x,y,z));
 drawFinish3D(m);ensureCars()}
function drawFinish3D(m){const center=m.rx*.84*SCALE;for(let i=-5;i<=5;i++){const tile=mesh(new THREE.BoxGeometry(.36,.035,.55),mat(i%2?0x111111:0xffffff,.7),center+i*.36,.07,0);world.add(tile)}const arch=new THREE.Group();const poleMat=mat(0x22262a,.45,.5);arch.add(mesh(new THREE.BoxGeometry(.18,3,.18),poleMat,-2.2,1.5,0),mesh(new THREE.BoxGeometry(.18,3,.18),poleMat,2.2,1.5,0),mesh(new THREE.BoxGeometry(4.55,.22,.22),poleMat,0,2.95,0));arch.position.x=center;arch.position.z=-1.25;world.add(arch)}

function kartDimensions(type){if(type==='tank')return{l:2.1,w:1.35,h:.55,wheel:.38};if(type==='roach')return{l:1.35,w:.78,h:.32,wheel:.25};if(type==='race')return{l:1.9,w:.92,h:.32,wheel:.3};return{l:1.65,w:1.0,h:.42,wheel:.31}}
function buildKart(type,color){const d=kartDimensions(type),g=new THREE.Group(),bodyMat=mat(color,.42,.18),dark=mat(0x171b20,.6,.35);const body=mesh(new THREE.BoxGeometry(d.l,d.h,d.w),bodyMat,0,.52,0);g.add(body);if(type==='race'){const nose=mesh(new THREE.BoxGeometry(.75,.18,d.w*.72),bodyMat,d.l*.55,.43,0);g.add(nose);const spoiler=mesh(new THREE.BoxGeometry(.12,.16,d.w*1.15),dark,-d.l*.55,.83,0);g.add(spoiler)}else if(type==='tank'){const turret=mesh(new THREE.CylinderGeometry(.43,.52,.28,10),dark,0,.9,0);g.add(turret);const gun=mesh(new THREE.BoxGeometry(.85,.12,.12),dark,.55,.9,0);g.add(gun)}else if(type==='roach'){const shell=mesh(new THREE.SphereGeometry(.48,10,7),mat(0x71462c,.6),0,.62,0);shell.scale.set(1.25,.55,.8);g.add(shell);for(const z of[-.32,.32]){const ant=mesh(new THREE.CylinderGeometry(.018,.018,.72,5),mat(0xd6a077),d.l*.5,.72,z);ant.rotation.z=Math.PI/2.5;g.add(ant)}}else{const cabin=mesh(new THREE.BoxGeometry(.6,.34,d.w*.75),mat(0xcdefff,.2,.15),-.05,.88,0);g.add(cabin)}
 const wheels=[],frontPivots=[];for(const x of[-d.l*.37,d.l*.37])for(const z of[-d.w*.56,d.w*.56]){const steerPivot=new THREE.Group();steerPivot.position.set(x,.35,z);const roll=new THREE.Group();const tire=mesh(new THREE.CylinderGeometry(d.wheel,d.wheel,.22,12),dark);tire.rotation.x=Math.PI/2;roll.add(tire);steerPivot.add(roll);g.add(steerPivot);wheels.push(roll);if(x>0)frontPivots.push(steerPivot)}
 const driver=mesh(new THREE.SphereGeometry(.22,10,8),mat(0xffd3ae,.65),-.18,1.15,0);g.add(driver);g.userData={wheels,frontPivots,type};return g}
function addKart(id,p,index){if(kartViews.has(id))return;const kart=buildKart(p.vehicle,colors[index%colors.length]);world.add(kart);kartViews.set(id,kart)}
function removeKart(id){const k=kartViews.get(id);if(k)world.remove(k);kartViews.delete(id)}
function syncKartViews(dt){const ps=players();for(const [id,car]of cars){const k=kartViews.get(id);if(!k)continue;k.position.set(wx(car.x),.04,wz(car.y));k.rotation.y=-car.angle;const input=ps.find(p=>p.id===id)?.input||{};for(const pivot of k.userData.frontPivots)pivot.rotation.y=-Number(input.steer||0)*.38;for(const wheel of k.userData.wheels)wheel.rotation.z-=car.speed*dt*.11;const q=C.trackMetric(car.x,car.y,track),offRoad=q<.6||q>1.08;if(offRoad&&Math.abs(car.speed)>85&&Math.random()<.16)spawnDust(k.position,map().id)}}
function spawnDust(pos,mapId){if(dust.length>70){const old=dust.shift();world.remove(old.mesh)}const color=mapId==='desert'?0xd4b06e:mapId==='ice'?0xe6fbff:0x8d765b;const m=mesh(new THREE.SphereGeometry(.08+Math.random()*.09,5,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5}),pos.x,.18,pos.z);m.castShadow=false;world.add(m);dust.push({mesh:m,life:1,vx:(Math.random()-.5)*.8,vz:(Math.random()-.5)*.8})}
function updateDust(dt){for(let i=dust.length-1;i>=0;i--){const d=dust[i];d.life-=dt*1.8;d.mesh.position.x+=d.vx*dt;d.mesh.position.z+=d.vz*dt;d.mesh.position.y+=dt*.45;d.mesh.scale.multiplyScalar(1+dt*.9);d.mesh.material.opacity=Math.max(0,d.life*.45);if(d.life<=0){world.remove(d.mesh);dust.splice(i,1)}}}

function syncRoom(snap){roomState=snap.val();if(!roomState||roomState.kind!==C.ROOM_KIND){setStatus('Phòng đã đóng.');startBtn.disabled=true;return}if(MAPS[roomState.mapId]&&selectedMap!==roomState.mapId){selectedMap=roomState.mapId;mapSelect.value=selectedMap;applyTrack();buildWorld()}ensureCars();const count=players().length,status=roomState.status;startBtn.disabled=count===0||status==='race_countdown'||status==='race_playing';startBtn.textContent=status==='race_finished'?'ĐUA LẠI 3D':'START KART';mapSelect.disabled=status==='race_countdown'||status==='race_playing';if(status==='race_waiting')setStatus(`${count} kart trong garage · ${map().emoji} ${map().label}`);else if(status==='race_countdown')setStatus('READY… giữ GAS!');else if(status==='race_playing')setStatus(`RACE · ${map().label}`);else setStatus('FINISH! · bấm ĐUA LẠI để chạy tiếp');renderBoard()}
async function initFirebase(){try{if(!window.firebase||typeof firebaseConfig==='undefined')throw new Error('firebase_missing');if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);db=firebase.database();await createRoom()}catch(e){console.error(e);setStatus('Không kết nối được Firebase.')}}
async function createRoom(){if(!db)return;if(roomRef){roomRef.off();try{await roomRef.remove()}catch(e){}roomRef=null}roomCodeEl.textContent='····';joinUrlEl.value='Đang tạo phòng…';copyBtn.disabled=true;cars.clear();for(const id of [...kartViews.keys()])removeKart(id);for(let attempt=0;attempt<12;attempt++){const code=C.makeRoomCode(),ref=db.ref(`${C.ROOT}/${C.roomKey(code)}`),seed={kind:C.ROOM_KIND,status:'race_waiting',hostId,laps:C.LAPS,mapId:selectedMap,mode:'kart3d',createdAt:firebase.database.ServerValue.TIMESTAMP,round:0,winner:null,players:{},telemetry:{}};try{const tx=await ref.transaction(cur=>cur===null?seed:undefined);if(!tx.committed)continue;roomCode=code;roomRef=ref;disconnectOp=roomRef.onDisconnect();await disconnectOp.remove();roomRef.on('value',syncRoom);roomCodeEl.textContent=code;joinUrlEl.value=controllerUrl(code);copyBtn.disabled=false;setStatus('Garage 3D sẵn sàng · quét QR để vào');return}catch(e){console.error(e)}}setStatus('Không tạo được phòng.')}
async function setMap(id){if(!MAPS[id]||mapSelect.disabled)return;selectedMap=id;applyTrack();resetCars();buildWorld();if(roomRef)try{await roomRef.child('mapId').set(id)}catch(e){}}
async function startRace(){if(!roomRef||transitioning)return;transitioning=true;try{resetCars();await roomRef.transaction(room=>{if(!room||room.kind!==C.ROOM_KIND||!Object.keys(room.players||{}).length)return;room.status='race_countdown';room.winner=null;room.mapId=selectedMap;room.mode='kart3d';room.round=(Number(room.round)||0)+1;room.startsAt=Date.now()+3200;room.telemetry={};return room})}finally{transitioning=false}}
async function beginPlaying(){if(!roomRef||transitioning)return;transitioning=true;try{await roomRef.transaction(room=>{if(!room||room.status!=='race_countdown')return;room.status='race_playing';room.startedAt=Date.now();return room})}finally{transitioning=false}}
async function finishRace(id){if(finishing||!roomRef)return;finishing=true;try{await roomRef.transaction(room=>{if(!room||room.status!=='race_playing'||room.winner)return;room.winner=id;room.status='race_finished';room.finishedAt=Date.now();return room})}finally{finishing=false}}
async function publishTelemetry(now){if(!roomRef||now-telemetryAt<180)return;telemetryAt=now;const data={};ranking().forEach((x,i)=>{data[x.p.id]={lap:Math.min(C.LAPS,x.car.lap+1),place:i+1,speed:Math.round(x.car.speed),progress:+C.raceProgress(x.car).toFixed(3),checkpoint:x.car.checkpoint,vehicle:x.p.vehicle}});try{await roomRef.child('telemetry').set(data)}catch(e){}}

const camTarget=new THREE.Vector3(),desired=new THREE.Vector3(),look=new THREE.Vector3();
function updateCamera(now,dt){
 const ranked=ranking();
 if(!ranked.length){const a=now*.00012;desired.set(Math.cos(a)*29,17,Math.sin(a)*24);camTarget.set(0,0,0)}
 else if(cameraMode===0){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,count=0;
  for(const x of ranked){const k=kartViews.get(x.p.id);if(!k)continue;minX=Math.min(minX,k.position.x);maxX=Math.max(maxX,k.position.x);minZ=Math.min(minZ,k.position.z);maxZ=Math.max(maxZ,k.position.z);count++}
  if(!count)return;
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,spanX=Math.max(3,maxX-minX),spanZ=Math.max(3,maxZ-minZ);
  const spread=Math.min(36,Math.max(7,spanX,spanZ*1.25));
  camTarget.set(cx,.55,cz);
  desired.set(cx-spread*.34,7.2+spread*.62,cz+7.5+spread*.42);
 }else{
  const lead=ranked[0],car=lead.car,k=kartViews.get(lead.p.id);if(!k)return;
  const forward=new THREE.Vector3(Math.cos(car.angle),0,Math.sin(car.angle));
  if(cameraMode===1){desired.copy(k.position).addScaledVector(forward,-7.8).add(new THREE.Vector3(0,4.3,0));camTarget.copy(k.position).addScaledVector(forward,3.2).add(new THREE.Vector3(0,1,0))}
  else{desired.set(k.position.x,30,k.position.z+.01);camTarget.copy(k.position)}
 }
 const follow=1-Math.pow(.001,Math.min(.05,dt));camera.position.lerp(desired,follow*.72);look.lerp(camTarget,follow);camera.lookAt(look)
}
function loop(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;if(roomState){ensureCars();if(roomState.status==='race_countdown'&&Date.now()>=(Number(roomState.startsAt)||0))beginPlaying();if(roomState.status==='race_playing'){for(const p of players()){const car=cars.get(p.id);if(car&&!car.finished)C.stepCar(car,p.input,dt,track)}C.resolveCarCollisions([...cars.values()].filter(c=>!c.finished));for(const car of cars.values())C.constrainToMap(car,track);const lead=ranking()[0];if(lead?.car.finished)finishRace(lead.p.id);publishTelemetry(now)}}syncKartViews(dt);updateDust(dt);updateCamera(now,dt);renderBoard();renderBig();renderer.render(scene,camera);requestAnimationFrame(loop)}
function renderBoard(){const ranked=ranking();boardEl.innerHTML='';if(!ranked.length){boardEl.innerHTML='<div class="empty">Quét QR để vào garage.</div>';return}ranked.forEach((x,i)=>{const spec=C.vehicleSpec(x.p.vehicle),row=document.createElement('div');row.className='row'+(i===0?' leader':'');row.innerHTML=`<div class="pos">#${i+1}</div><div class="driver">${escapeHtml(spec.emoji+' '+x.p.name)}</div><div class="meta">L${Math.min(C.LAPS,x.car.lap+1)}/${C.LAPS} · ${Math.abs(Math.round(x.car.speed))}</div>`;boardEl.appendChild(row)})}
function renderBig(){let text='';if(roomState?.status==='race_countdown'){const left=Math.ceil(((Number(roomState.startsAt)||0)-Date.now())/1000);text=left>0?String(left):'GO!'}else if(roomState?.status==='race_finished'){const w=roomState.players?.[roomState.winner];text=w?'🏆 '+C.cleanName(w.name):'FINISH'}bigText.textContent=text;bigText.classList.toggle('show',!!text)}
function escapeHtml(text){const d=document.createElement('div');d.textContent=text;return d.innerHTML}
async function copyJoin(){if(!joinUrlEl.value.startsWith('http'))return;try{await navigator.clipboard.writeText(joinUrlEl.value);copyBtn.textContent='Đã copy ✓';setTimeout(()=>copyBtn.textContent='Copy link controller',1200)}catch(e){}}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2))}
mapSelect.addEventListener('change',()=>setMap(mapSelect.value));startBtn.addEventListener('click',startRace);newRoomBtn.addEventListener('click',createRoom);copyBtn.addEventListener('click',copyJoin);cameraBtn.textContent='👥 GROUP';cameraBtn.addEventListener('click',()=>{cameraMode=(cameraMode+1)%3;cameraBtn.textContent=['👥 GROUP','🎥 LEADER','🛰️ TOP'][cameraMode]});fullscreenBtn.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(e){}});addEventListener('resize',resize);
applyTrack();buildWorld();initFirebase();requestAnimationFrame(loop);window.ReadyToKart3D={getState:()=>({roomCode,roomState,cars:[...cars.entries()],map:selectedMap,cameraMode}),start:startRace,newRoom:createRoom};
