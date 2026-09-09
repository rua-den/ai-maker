'use strict';
(()=>{
  const C=window.ReadyToRaceCore;
  if(!C)return;

  const MAP_IDS=['park','desert','night','ice'];
  const MAPS={
    park:{id:'park',label:'Rùa Park',emoji:'🌿',cx:480,cy:300,rx:330,ry:190,width:960,height:600,edgeMargin:18,terrain:'#236e3e',terrain2:'#194f2e',road:'#44484d',line:'#f3f4e8',border:'#dce9df',checkpoint:'#78d7ff'},
    desert:{id:'desert',label:'Desert Dash',emoji:'🏜️',cx:480,cy:300,rx:382,ry:145,width:960,height:600,edgeMargin:18,terrain:'#c49a57',terrain2:'#a7783b',road:'#5b5044',line:'#fff1c4',border:'#f2dfb1',checkpoint:'#ffd274'},
    night:{id:'night',label:'Night City',emoji:'🌃',cx:480,cy:300,rx:285,ry:225,width:960,height:600,edgeMargin:18,terrain:'#102236',terrain2:'#081523',road:'#303541',line:'#8ce6ff',border:'#5cd6ff',checkpoint:'#e47cff'},
    ice:{id:'ice',label:'Ice Lake',emoji:'❄️',cx:500,cy:300,rx:350,ry:175,width:960,height:600,edgeMargin:18,terrain:'#bfe7ef',terrain2:'#8fc8d6',road:'#667985',line:'#ffffff',border:'#ffffff',checkpoint:'#2b9fd4'}
  };
  const AUDIO={
    roach:{wave:'square',subWave:'triangle',baseHz:118,topHz:280,subRatio:.48,gain:.045,subGain:.012,revKick:1.34,brakeHz:1900},
    tank:{wave:'sawtooth',subWave:'square',baseHz:38,topHz:92,subRatio:.50,gain:.055,subGain:.040,revKick:1.12,brakeHz:720},
    normal:{wave:'triangle',subWave:'sine',baseHz:66,topHz:165,subRatio:.50,gain:.050,subGain:.018,revKick:1.24,brakeHz:1350},
    race:{wave:'sawtooth',subWave:'triangle',baseHz:92,topHz:320,subRatio:.50,gain:.045,subGain:.015,revKick:1.46,brakeHz:2300}
  };
  const COLORS=['#ff5b5b','#4dc4ff','#ffd34d','#8be36e','#d177ff','#ff8bd0'];
  let activeMapId='park';
  const cleanMap=id=>MAP_IDS.includes(String(id||''))?String(id):'park';
  const mapSpec=id=>MAPS[cleanMap(id)];

  const originalMakeCar=C.makeCar.bind(C);
  const originalStepCar=C.stepCar.bind(C);
  C.makeCar=(index,track,vehicle)=>{Object.assign(track,mapSpec(activeMapId));return originalMakeCar(index,track,vehicle);};
  C.stepCar=(car,input,dt,track)=>{Object.assign(track,mapSpec(activeMapId));return originalStepCar(car,input,dt,track);};

  function setupHostMaps(){
    const original=document.getElementById('raceCanvas');
    const actions=document.querySelector('.actions');
    const start=document.getElementById('startBtn');
    if(!original||!actions||!start||document.getElementById('readyToRaceMapSelect'))return;

    const select=document.createElement('select');
    select.id='readyToRaceMapSelect';
    select.setAttribute('aria-label','Chọn bản đồ');
    select.style.cssText='border:1px solid rgba(255,255,255,.15);border-radius:11px;padding:10px 12px;background:#152431;color:#fff;font-weight:900;cursor:pointer;min-width:165px';
    select.innerHTML=MAP_IDS.map(id=>{const m=mapSpec(id);return `<option value="${id}">${m.emoji} ${m.label}</option>`;}).join('');
    actions.insertBefore(select,actions.firstChild);

    const side=document.querySelector('.side');
    const badge=document.createElement('div');
    badge.id='readyToRaceMapBadge';
    badge.style.cssText='font-size:13px;font-weight:950;color:#8fe6ff;margin:-4px 0 12px';
    if(side)side.insertBefore(badge,side.children[1]||null);

    const canvas=document.createElement('canvas');
    canvas.id='readyToRaceMapCanvas';
    canvas.className=original.className;
    canvas.width=original.width;
    canvas.height=original.height;
    original.style.display='none';
    original.insertAdjacentElement('afterend',canvas);
    const ctx=canvas.getContext('2d');
    let lastWrite='';

    const state=()=>window.ReadyToRaceScreen?.getState?.()||{};
    function paintSelection(id){
      activeMapId=cleanMap(id);
      select.value=activeMapId;
      const m=mapSpec(activeMapId);
      badge.textContent=m.emoji+' '+m.label;
      return activeMapId;
    }
    function writeMap(id){
      id=paintSelection(id);
      const s=state(),code=s.roomCode;
      if(!code||!window.firebase)return;
      const key=code+':'+id;
      if(key===lastWrite)return;
      lastWrite=key;
      window.firebase.database().ref(`${C.ROOT}/${C.roomKey(code)}/mapId`).set(id).catch(()=>{lastWrite='';});
    }
    select.addEventListener('change',()=>writeMap(select.value));

    function sync(){
      const s=state(),room=s.roomState;
      if(!room)return;
      const id=paintSelection(room.mapId||select.value||activeMapId);
      select.disabled=room.status==='race_countdown'||room.status==='race_playing';
      if(!room.mapId)writeMap(id);
    }

    function hexAlpha(hex,alpha){
      if(!/^#[0-9a-f]{6}$/i.test(hex))return `rgba(255,255,255,${alpha})`;
      const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${alpha})`;
    }
    function metric(x,y,map){return Math.hypot((x-map.cx)/map.rx,(y-map.cy)/map.ry);}
    function dot(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    function roundRect(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);return ctx;}
    function drawDecor(map){
      if(map.id==='park'){
        for(let i=0;i<20;i++){const x=45+(i*179)%870,y=42+(i*113)%510;if(metric(x,y,map)>.46&&metric(x,y,map)<1.17)continue;dot(x,y,8+(i%3)*2,i%2?'#245f33':'#347f42');ctx.fillStyle='#6b4930';ctx.fillRect(x-2,y+5,4,9);}
      }else if(map.id==='desert'){
        ctx.strokeStyle='rgba(255,235,185,.24)';ctx.lineWidth=3;for(let i=0;i<9;i++){ctx.beginPath();ctx.arc(80+i*110,80+(i%3)*180,42,Math.PI*.1,Math.PI*.9);ctx.stroke();}
        for(let i=0;i<8;i++){const x=65+(i*131)%850,y=70+(i*197)%470;ctx.strokeStyle='#446b39';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y+16);ctx.lineTo(x,y-15);ctx.moveTo(x,y-3);ctx.lineTo(x-8,y-9);ctx.moveTo(x,y+3);ctx.lineTo(x+9,y-5);ctx.stroke();}
      }else if(map.id==='night'){
        for(let i=0;i<18;i++){const x=30+(i*151)%900,y=30+(i*101)%540;if(metric(x,y,map)<1.22)continue;ctx.fillStyle='rgba(64,120,170,.18)';ctx.fillRect(x-18,y-18,36,36);ctx.fillStyle='rgba(255,224,100,.55)';for(let a=0;a<3;a++)for(let b=0;b<3;b++)ctx.fillRect(x-12+a*9,y-12+b*9,3,4);}
      }else if(map.id==='ice'){
        ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1.5;for(let i=0;i<28;i++){const x=20+(i*173)%920,y=30+(i*127)%530;ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.moveTo(x-4,y-4);ctx.lineTo(x+4,y+4);ctx.moveTo(x+4,y-4);ctx.lineTo(x-4,y+4);ctx.stroke();}
      }
    }
    function drawCheckpoint(x,y,label,map){
      dot(x,y,13,hexAlpha(map.checkpoint,.22));ctx.strokeStyle=map.checkpoint;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 11px system-ui';ctx.textAlign='center';ctx.fillText(label,x,y+4);
    }
    function drawCar(car,index,name){
      const color=COLORS[index%COLORS.length],type=C.sanitizeVehicle(car.vehicle),spec=C.vehicleSpec(type);
      ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.angle);ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(2,3,spec.radius+2,spec.radius*.55,0,0,Math.PI*2);ctx.fill();
      if(type==='roach'){
        ctx.fillStyle='#774a2d';ctx.beginPath();ctx.ellipse(0,0,12,8,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d9a06f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-5);ctx.lineTo(16,-12);ctx.moveTo(7,5);ctx.lineTo(16,12);ctx.stroke();ctx.fillStyle=color;ctx.fillRect(-4,-3,8,6);
      }else if(type==='tank'){
        ctx.fillStyle=color;roundRect(-20,-13,40,26,5);ctx.fill();ctx.fillStyle='#26352b';roundRect(-10,-9,20,18,4);ctx.fill();ctx.fillRect(5,-2,24,4);ctx.fillStyle='#111';ctx.fillRect(-22,-15,44,4);ctx.fillRect(-22,11,44,4);
      }else if(type==='race'){
        ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(21,0);ctx.lineTo(7,-9);ctx.lineTo(-18,-7);ctx.lineTo(-14,0);ctx.lineTo(-18,7);ctx.lineTo(7,9);ctx.closePath();ctx.fill();ctx.fillStyle='#dff6ff';ctx.fillRect(-1,-6,9,12);ctx.fillStyle='#111';ctx.fillRect(-16,-10,9,3);ctx.fillRect(-16,7,9,3);
      }else{
        ctx.fillStyle=color;roundRect(-17,-9,34,18,5);ctx.fill();ctx.fillStyle='#dff6ff';ctx.fillRect(-2,-7,10,14);ctx.fillStyle='#111';ctx.fillRect(-13,-11,8,3);ctx.fillRect(6,-11,8,3);ctx.fillRect(-13,8,8,3);ctx.fillRect(6,8,8,3);
      }
      ctx.restore();ctx.font='800 12px system-ui';ctx.textAlign='center';ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillText(name,car.x+1,car.y-18+1);ctx.fillStyle='#fff';ctx.fillText(name,car.x,car.y-18);
    }
    function drawMap(){
      const s=state(),room=s.roomState,map=mapSpec(room?.mapId||activeMapId);activeMapId=map.id;
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=map.terrain;ctx.fillRect(0,0,canvas.width,canvas.height);
      const grad=ctx.createRadialGradient(map.cx,map.cy,80,map.cx,map.cy,560);grad.addColorStop(0,'rgba(255,255,255,.04)');grad.addColorStop(1,hexAlpha(map.terrain2,.42));ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);
      drawDecor(map);ctx.strokeStyle=map.border;ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,canvas.width-3,canvas.height-3);
      ctx.save();ctx.translate(map.cx,map.cy);ctx.fillStyle=map.road;ctx.beginPath();ctx.ellipse(0,0,map.rx*1.08,map.ry*1.08,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=map.terrain;ctx.beginPath();ctx.ellipse(0,0,map.rx*.60,map.ry*.60,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=map.line;ctx.lineWidth=3;ctx.setLineDash([15,15]);ctx.beginPath();ctx.ellipse(0,0,map.rx*.84,map.ry*.84,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
      drawCheckpoint(map.cx,map.cy+map.ry*.72,'1',map);drawCheckpoint(map.cx-map.rx*.72,map.cy,'2',map);drawCheckpoint(map.cx,map.cy-map.ry*.72,'3',map);
      const sx=map.cx+map.rx*.84,sy=map.cy;for(let c=-5;c<5;c++)for(let r=0;r<2;r++){ctx.fillStyle=(c+r)&1?'#111':'#fff';ctx.fillRect(sx+c*10,sy-10+r*10,10,10);}ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('FINISH',sx,sy-17);
      const players=room?.players||{},entries=s.cars||[];entries.forEach(([id,car],i)=>{const p=players[id]||{};if(car)drawCar(car,i,C.cleanName(p.name));});
      requestAnimationFrame(drawMap);
    }

    sync();
    const timer=setInterval(sync,250);
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    requestAnimationFrame(drawMap);
  }

  function setupControllerAudio(){
    const gas=document.getElementById('gas'),brake=document.getElementById('brake'),reverse=document.getElementById('reverse'),join=document.getElementById('join');
    if(!gas||!brake||!reverse||document.getElementById('readyToRaceSoundToggle'))return;
    const hud=document.querySelector('.hud'),top=document.querySelector('.topline');
    const mapBadge=document.createElement('div');mapBadge.id='readyToRaceControllerMap';mapBadge.style.cssText='margin-top:5px;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.07);font-size:9px;font-weight:950;color:#a9edff;white-space:nowrap';if(top)top.after(mapBadge);
    const sound=document.createElement('button');sound.id='readyToRaceSoundToggle';sound.type='button';sound.style.cssText='margin-top:3px;border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:6px;background:transparent;color:#d9edf6;font-size:9px;font-weight:900';if(hud)hud.appendChild(sound);
    let muted=false;try{muted=localStorage.getItem('readyToRaceMuted')==='1';}catch(e){}
    let ctx,master,engine,sub,engineGain,subGain,noise,lastVehicle='';
    const state=()=>window.ReadyToRaceController?.getState?.()||{};
    const label=()=>{sound.textContent=muted?'🔇 SOUND OFF':'🔊 SOUND';};label();
    function profile(vehicle){return AUDIO[C.sanitizeVehicle(vehicle)]||AUDIO.normal;}
    function ensureAudio(){
      if(!ctx){
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();master=ctx.createGain();master.gain.value=.72;master.connect(ctx.destination);
        noise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.25),ctx.sampleRate);const a=noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;
    }
    function rebuild(vehicle){
      const c=ctx;if(!c)return;vehicle=C.sanitizeVehicle(vehicle);if(vehicle===lastVehicle&&engine)return;lastVehicle=vehicle;try{engine?.stop();sub?.stop();}catch(e){}
      const s=profile(vehicle);engine=c.createOscillator();sub=c.createOscillator();engineGain=c.createGain();subGain=c.createGain();engine.type=s.wave;sub.type=s.subWave;engineGain.gain.value=0;subGain.gain.value=0;engine.connect(engineGain).connect(master);sub.connect(subGain).connect(master);engine.start();sub.start();
    }
    function update(){
      const st=state(),room=st.roomState,map=mapSpec(room?.mapId);mapBadge.textContent=map.emoji+' '+map.label.toUpperCase();if(!ctx)return;const vehicle=C.sanitizeVehicle(st.vehicle);rebuild(vehicle);const s=profile(vehicle),active=room?.status==='race_countdown'||room?.status==='race_playing',drive=st.throttle?1:st.reverse?.58:.13,f=s.baseHz+(s.topHz-s.baseHz)*drive,now=ctx.currentTime;engine.frequency.setTargetAtTime(f,now,.035);sub.frequency.setTargetAtTime(Math.max(22,f*s.subRatio),now,.045);const audible=!muted&&active;engineGain.gain.setTargetAtTime(audible?s.gain*(st.throttle||st.reverse?1:.32):0,now,.05);subGain.gain.setTargetAtTime(audible?s.subGain*(st.throttle||st.reverse?1:.45):0,now,.06);
    }
    function rev(mult=1){
      const st=state(),c=ensureAudio();if(!c||muted)return;const s=profile(st.vehicle),o=c.createOscillator(),g=c.createGain(),now=c.currentTime;o.type=s.wave;o.frequency.setValueAtTime(s.baseHz*s.revKick,now);o.frequency.exponentialRampToValueAtTime(Math.max(30,s.topHz*s.revKick*mult),now+.1);o.frequency.exponentialRampToValueAtTime(Math.max(25,s.baseHz*1.2),now+.3);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.015,s.gain*.85),now+.025);g.gain.exponentialRampToValueAtTime(.0001,now+.31);o.connect(g).connect(master);o.start(now);o.stop(now+.32);
    }
    function squeal(){
      const st=state(),c=ensureAudio();if(!c||muted||!noise)return;const s=profile(st.vehicle),src=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain(),now=c.currentTime;src.buffer=noise;filter.type='bandpass';filter.frequency.value=s.brakeHz;filter.Q.value=1.15;src.playbackRate.value=st.vehicle==='tank'?.72:st.vehicle==='roach'?1.35:1;g.gain.setValueAtTime(.075,now);g.gain.exponentialRampToValueAtTime(.0001,now+.2);src.connect(filter).connect(g).connect(master);src.start(now);src.stop(now+.22);
    }
    join?.addEventListener('pointerdown',ensureAudio,{passive:true});gas.addEventListener('pointerdown',()=>rev(1));reverse.addEventListener('pointerdown',()=>rev(.72));brake.addEventListener('pointerdown',squeal);
    sound.addEventListener('click',()=>{ensureAudio();muted=!muted;try{localStorage.setItem('readyToRaceMuted',muted?'1':'0');}catch(e){}label();update();});
    const timer=setInterval(update,80);window.addEventListener('pagehide',()=>{clearInterval(timer);try{ctx?.close();}catch(e){}},{once:true});
  }

  setupHostMaps();
  setupControllerAudio();
})();
