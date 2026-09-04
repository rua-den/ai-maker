(() => {
  'use strict';
  const C = window.BoomChiuCore;
  if(!C) throw new Error('BoomChiuCore missing');

  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const mini=document.getElementById('minimap');
  const mctx=mini.getContext('2d');
  const menu=document.getElementById('menu');
  const mapGrid=document.getElementById('mapGrid');
  const startBtn=document.getElementById('startBtn');
  const difficultyEl=document.getElementById('difficulty');
  const targetScoreEl=document.getElementById('targetScore');
  const blueScoreEl=document.getElementById('blueScore');
  const redScoreEl=document.getElementById('redScore');
  const timerEl=document.getElementById('timer');
  const healthEl=document.getElementById('health');
  const ammoEl=document.getElementById('ammo');
  const kdEl=document.getElementById('kd');
  const killFeed=document.getElementById('killFeed');
  const hitmarker=document.getElementById('hitmarker');
  const damageFlash=document.getElementById('damageFlash');
  const banner=document.getElementById('banner');
  const touchUI=document.getElementById('touchUI');
  const stick=document.getElementById('stick');
  const knob=document.getElementById('knob');
  const lookPad=document.getElementById('lookPad');
  const fireBtn=document.getElementById('fireBtn');
  const reloadBtn=document.getElementById('reloadBtn');

  const FOV=Math.PI*70/180;
  const PLAYER_SPEED=3.15;
  const BOT_SPEED={easy:1.75,hard:2.15,destroyer:2.45};
  const BOT_FIRE={easy:620,hard:430,destroyer:315};
  const BOT_ACCURACY={easy:.48,hard:.66,destroyer:.79};
  const keys=new Set();
  const actors=[];
  const feed=[];
  let mapId='cat_chay';
  let map=C.MAPS[mapId];
  let difficulty='hard';
  let targetScore=30;
  let running=false;
  let matchEnded=false;
  let player=null;
  let blueScore=0, redScore=0;
  let endsAt=0;
  let lastFrame=performance.now();
  let muzzleUntil=0;
  let reloadingUntil=0;
  let audioCtx=null;
  let touchMove={x:0,y:0};
  let lookTouch=null;
  let stickTouch=null;
  let diagnosticBotKills=0;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`}
  function rand(a,b){return a+Math.random()*(b-a)}
  function now(){return performance.now()}

  function resize(){
    const dpr=Math.min(1.6,window.devicePixelRatio||1);
    canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);
    canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();addEventListener('resize',resize);

  Object.values(C.MAPS).forEach((m,i)=>{
    const b=document.createElement('button');b.className='mapCard'+(i===0?' active':'');b.dataset.map=m.id;
    b.innerHTML=`<b>${m.name}</b><small>${m.subtitle}</small>`;
    b.addEventListener('click',()=>{mapId=m.id;map=C.MAPS[mapId];mapGrid.querySelectorAll('.mapCard').forEach(x=>x.classList.toggle('active',x===b))});
    mapGrid.appendChild(b);
  });

  function spawnFor(team,index=0){
    const list=C.spawns(map,team);const p=list[index%Math.max(1,list.length)]||{x:2.5,y:2.5};
    return {x:p.x,y:p.y};
  }

  function makeActor(id,name,team,isPlayer,index){
    const s=spawnFor(team,index);
    return {id,name,team,isPlayer,x:s.x,y:s.y,angle:team===C.TEAM_BLUE?0:Math.PI,hp:100,alive:true,respawnAt:0,kills:0,deaths:0,nextShotAt:0,path:[],pathAt:0,targetId:null,strafe:Math.random()<.5?-1:1};
  }

  function resetActors(){
    actors.length=0;
    player=makeActor('player','Bạn',C.TEAM_BLUE,true,0);actors.push(player);
    for(let i=0;i<4;i++)actors.push(makeActor('b'+i,C.BOT_NAMES[i],C.TEAM_BLUE,false,i+1));
    for(let i=0;i<5;i++)actors.push(makeActor('r'+i,C.BOT_NAMES[i+5],C.TEAM_RED,false,i));
  }

  function startMatch(){
    difficulty=difficultyEl.value;targetScore=Number(targetScoreEl.value)||30;map=C.MAPS[mapId];
    blueScore=0;redScore=0;diagnosticBotKills=0;matchEnded=false;endsAt=now()+5*60*1000;feed.length=0;killFeed.innerHTML='';
    resetActors();player.clip=C.WEAPON.clipSize;player.reserve=C.WEAPON.reserve;player.angle=0;reloadingUntil=0;
    running=true;menu.classList.add('hidden');touchUI.classList.add('playing');updateHud();
    ensureAudio();
    if(matchMedia('(pointer:fine)').matches) canvas.requestPointerLock?.();
  }
  startBtn.addEventListener('click',startMatch);

  function ensureAudio(){
    if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch{}}
    if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
  }
  function tone(freq,dur=.05,volume=.05,type='square'){
    if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);
  }
  function shotSound(){tone(82,.075,.08,'sawtooth');tone(42,.09,.05,'square')}
  function hitSound(head=false){tone(head?1080:760,.045,.035,'square')}

  function moveActor(a,dx,dy){
    const nx=a.x+dx,ny=a.y+dy;
    if(C.canStand(map,nx,a.y))a.x=nx;
    if(C.canStand(map,a.x,ny))a.y=ny;
  }

  function updatePlayer(dt){
    if(!player?.alive)return;
    let f=0,s=0;
    if(keys.has('KeyW'))f+=1;if(keys.has('KeyS'))f-=1;if(keys.has('KeyD'))s+=1;if(keys.has('KeyA'))s-=1;
    f+=-touchMove.y;s+=touchMove.x;
    const len=Math.hypot(f,s)||1;f/=len;s/=len;
    const speed=PLAYER_SPEED*dt;
    const dx=(Math.cos(player.angle)*f+Math.cos(player.angle+Math.PI/2)*s)*speed;
    const dy=(Math.sin(player.angle)*f+Math.sin(player.angle+Math.PI/2)*s)*speed;
    moveActor(player,dx,dy);
  }

  function nearestEnemy(a){
    let best=null,bd=Infinity;
    for(const b of actors){if(!b.alive||b.team===a.team)continue;const d=(b.x-a.x)**2+(b.y-a.y)**2;if(d<bd){bd=d;best=b}}
    return best;
  }

  function botShoot(bot,target,t){
    if(t<bot.nextShotAt||!target.alive)return;
    bot.nextShotAt=t+BOT_FIRE[difficulty]+rand(-70,110);
    const dist=Math.hypot(target.x-bot.x,target.y-bot.y);
    let chance=BOT_ACCURACY[difficulty]-Math.max(0,dist-3)*.024;
    if(target.isPlayer&&keys.size)chance-=.05;
    if(Math.random()<clamp(chance,.16,.9)){
      const head=Math.random()<(difficulty==='destroyer'?.2:.1);
      damage(target,head?72:rand(22,38),bot,head);
    }
  }

  function updateBot(bot,dt,t){
    if(!bot.alive)return;
    let target=actors.find(x=>x.id===bot.targetId&&x.alive&&x.team!==bot.team);
    if(!target){target=nearestEnemy(bot);bot.targetId=target?.id||null}
    if(!target)return;
    const dist=Math.hypot(target.x-bot.x,target.y-bot.y);
    const sees=dist<13&&C.lineOfSight(map,bot,target);
    if(sees){
      const desired=Math.atan2(target.y-bot.y,target.x-bot.x);bot.angle+=C.angleDelta(bot.angle,desired)*Math.min(1,dt*5.5);
      if(dist>4.4){moveActor(bot,Math.cos(bot.angle)*BOT_SPEED[difficulty]*dt,Math.sin(bot.angle)*BOT_SPEED[difficulty]*dt)}
      else if(dist<2.2){moveActor(bot,-Math.cos(bot.angle)*BOT_SPEED[difficulty]*.55*dt,-Math.sin(bot.angle)*BOT_SPEED[difficulty]*.55*dt)}
      else{moveActor(bot,Math.cos(bot.angle+bot.strafe*Math.PI/2)*BOT_SPEED[difficulty]*.38*dt,Math.sin(bot.angle+bot.strafe*Math.PI/2)*BOT_SPEED[difficulty]*.38*dt)}
      botShoot(bot,target,t);return;
    }
    if(t>bot.pathAt||!bot.path.length){bot.path=C.findPath(map,bot,target).slice(0,12);bot.pathAt=t+rand(650,1050)}
    const p=bot.path[0];if(!p)return;
    const dx=p.x-bot.x,dy=p.y-bot.y,d=Math.hypot(dx,dy);if(d<.2){bot.path.shift();return}
    bot.angle=Math.atan2(dy,dx);moveActor(bot,dx/d*BOT_SPEED[difficulty]*dt,dy/d*BOT_SPEED[difficulty]*dt);
  }

  function respawn(a,t){
    if(a.alive||t<a.respawnAt)return;
    const list=C.spawns(map,a.team);let best=list[0]||{x:2.5,y:2.5},bestScore=-1;
    for(const s of list){let nearest=Infinity;for(const e of actors){if(e.alive&&e.team!==a.team)nearest=Math.min(nearest,Math.hypot(e.x-s.x,e.y-s.y))}if(nearest>bestScore){bestScore=nearest;best=s}}
    a.x=best.x;a.y=best.y;a.hp=100;a.alive=true;a.angle=a.team===C.TEAM_BLUE?0:Math.PI;a.path=[];a.targetId=null;
    if(a.isPlayer){a.clip=C.WEAPON.clipSize;a.reserve=C.WEAPON.reserve;bannerText('TRỞ LẠI!',650)}
  }

  function damage(victim,amount,killer,head=false){
    if(!victim.alive||matchEnded)return;
    victim.hp-=amount;
    if(victim.isPlayer){damageFlash.style.opacity='.85';setTimeout(()=>damageFlash.style.opacity='0',85)}
    if(victim.hp>0)return;
    victim.hp=0;victim.alive=false;victim.deaths++;victim.respawnAt=now()+1800;killer.kills++;
    if(!killer.isPlayer)diagnosticBotKills++;
    if(killer.team===C.TEAM_BLUE)blueScore++;else redScore++;
    addKill(killer,victim,head);
    if(victim.isPlayer)bannerText('BẠN ĐÃ NẰM!',900);
    if(blueScore>=targetScore||redScore>=targetScore)endMatch();
  }

  function addKill(killer,victim,head){
    const item={text:`${killer.name} ${head?'🎯':'▸'} ${victim.name}`,team:killer.team,until:now()+4300};feed.unshift(item);feed.splice(5);
    killFeed.innerHTML=feed.map(f=>`<div class="kill ${f.team==='blue'?'blue':'red'}">${f.text}</div>`).join('');
  }

  function reload(){
    if(!running||!player?.alive||reloadingUntil||player.clip>=C.WEAPON.clipSize||player.reserve<=0)return;
    reloadingUntil=now()+C.WEAPON.reloadMs;bannerText('ĐANG NẠP...',500);tone(240,.04,.025,'square');
  }

  function finishReload(t){
    if(!reloadingUntil||t<reloadingUntil)return;
    const need=C.WEAPON.clipSize-player.clip,take=Math.min(need,player.reserve);player.clip+=take;player.reserve-=take;reloadingUntil=0;tone(360,.045,.025,'square');
  }

  function firePlayer(){
    const t=now();if(!running||!player?.alive||matchEnded||reloadingUntil)return;
    if(t<(player.nextShotAt||0))return;
    if(player.clip<=0){reload();return}
    player.nextShotAt=t+C.WEAPON.fireDelay;player.clip--;muzzleUntil=t+55;shotSound();
    const shotAngle=player.angle+rand(-C.WEAPON.spread,C.WEAPON.spread);
    const wall=C.raycast(map,player.x,player.y,shotAngle,C.WEAPON.range).distance;
    let best=null,bestDist=wall,bestErr=Infinity;
    for(const a of actors){
      if(!a.alive||a.team===player.team||a.isPlayer)continue;
      const dx=a.x-player.x,dy=a.y-player.y,dist=Math.hypot(dx,dy);if(dist>=bestDist)continue;
      const err=Math.abs(C.angleDelta(shotAngle,Math.atan2(dy,dx)));const radius=Math.atan(.3/Math.max(.3,dist));
      if(err<radius&&C.lineOfSight(map,player,a)&&err<bestErr){best=a;bestDist=dist;bestErr=err}
    }
    if(best){const head=bestErr<Math.atan(.075/Math.max(.3,bestDist));damage(best,C.WEAPON.damage*(head?C.WEAPON.headshot:1),player,head);showHit(head)}
    if(player.clip===0&&player.reserve>0)setTimeout(reload,160);
  }

  function showHit(head){hitmarker.style.opacity='1';hitmarker.style.filter=head?'drop-shadow(0 0 5px #ff5757)':'none';setTimeout(()=>hitmarker.style.opacity='0',95);hitSound(head)}
  function bannerText(text,ms=900){banner.textContent=text;banner.style.opacity='1';setTimeout(()=>banner.style.opacity='0',ms)}

  function endMatch(){
    if(matchEnded)return;matchEnded=true;running=false;const win=blueScore===redScore?'HÒA':blueScore>redScore?'ĐỘI XANH THẮNG':'ĐỘI ĐỎ THẮNG';bannerText(win,1800);document.exitPointerLock?.();
    setTimeout(()=>{menu.classList.remove('hidden');touchUI.classList.remove('playing')},1900);
  }

  function updateHud(){
    blueScoreEl.textContent=blueScore;redScoreEl.textContent=redScore;healthEl.textContent=Math.max(0,Math.ceil(player?.hp||0));
    ammoEl.textContent=player?`${player.clip??0} / ${player.reserve??0}`:'30 / 90';kdEl.textContent=player?`${player.kills} / ${player.deaths}`:'0 / 0';
    const left=Math.max(0,endsAt-now()),sec=Math.ceil(left/1000);timerEl.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    while(feed.length&&feed[feed.length-1].until<now())feed.pop();
  }

  function drawScene(){
    const W=innerWidth,H=innerHeight,p=map.palette;
    const sky=ctx.createLinearGradient(0,0,0,H*.52);sky.addColorStop(0,p.sky);sky.addColorStop(1,'#b6c4c4');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H*.52);
    const floor=ctx.createLinearGradient(0,H*.48,0,H);floor.addColorStop(0,p.floor);floor.addColorStop(1,'#17191a');ctx.fillStyle=floor;ctx.fillRect(0,H*.5,W,H*.5);
    if(!player)return;
    const column=Math.max(2,Math.floor(W/420));
    for(let x=0;x<W;x+=column){
      const rayAngle=player.angle-FOV/2+(x/W)*FOV;const hit=C.raycast(map,player.x,player.y,rayAngle,24);const corrected=hit.distance*Math.cos(rayAngle-player.angle);const wallH=Math.min(H*1.8,H/Math.max(.05,corrected));
      const light=clamp(1-corrected/26,.2,1);ctx.fillStyle=corrected<4?rgba(p.wall,.92):rgba(p.wallDark,.78+light*.16);ctx.fillRect(x,H/2-wallH/2,column+1,wallH);
      if(corrected<2.2){ctx.fillStyle=`rgba(255,255,255,${.025*(2.2-corrected)})`;ctx.fillRect(x,H/2-wallH/2,column+1,wallH)}
    }
    drawActors(W,H);drawWeapon(W,H);
    if(!player.alive){ctx.fillStyle='rgba(90,0,0,.22)';ctx.fillRect(0,0,W,H)}
  }

  function drawActors(W,H){
    if(!player)return;
    const visible=actors.filter(a=>a.alive&&!a.isPlayer).map(a=>({a,d:Math.hypot(a.x-player.x,a.y-player.y),ang:C.angleDelta(player.angle,Math.atan2(a.y-player.y,a.x-player.x))})).filter(o=>Math.abs(o.ang)<FOV*.62&&o.d<18).sort((a,b)=>b.d-a.d);
    for(const o of visible){
      const {a,d,ang}=o;if(!C.lineOfSight(map,player,a))continue;const sx=W/2+(ang/FOV)*W;const h=clamp(H/(d*.86),22,H*.82);const w=h*.42;const y=H/2-h*.49;
      const c=a.team===C.TEAM_BLUE?'#55aaff':'#f05b57';ctx.save();ctx.globalAlpha=clamp(1-d/25,.45,1);ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(sx,H/2+h*.5,w*.55,h*.08,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c;ctx.fillRect(sx-w*.34,y+h*.24,w*.68,h*.58);ctx.beginPath();ctx.arc(sx,y+h*.15,w*.25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1b2025';ctx.fillRect(sx-w*.43,y+h*.42,w*.86,h*.13);
      ctx.fillStyle='rgba(0,0,0,.58)';ctx.fillRect(sx-w*.48,y-12,w*.96,5);ctx.fillStyle='#61df72';ctx.fillRect(sx-w*.48,y-12,w*.96*clamp(a.hp/100,0,1),5);ctx.restore();
    }
  }

  function drawWeapon(W,H){
    const kick=muzzleUntil>now()?8:0;const bob=running&&player?.alive?Math.sin(now()/115)*2:0;ctx.save();ctx.translate(W*.54,H*.83+bob+kick);ctx.rotate(-.06);ctx.fillStyle='#24282d';ctx.fillRect(-26,-15,115,32);ctx.fillStyle='#3b4148';ctx.fillRect(33,-10,100,18);ctx.fillStyle='#15181b';ctx.fillRect(-5,12,25,70);ctx.fillStyle='#5b3927';ctx.fillRect(-23,8,30,67);ctx.fillStyle='#111';ctx.fillRect(128,-6,54,10);ctx.restore();
    if(muzzleUntil>now()){ctx.save();ctx.translate(W*.54+178,H*.83-5);ctx.fillStyle='rgba(255,213,82,.9)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(30,-13);ctx.lineTo(21,0);ctx.lineTo(31,13);ctx.closePath();ctx.fill();ctx.restore()}
  }

  function drawMinimap(){
    if(!player)return;const w=mini.width,h=mini.height,d=C.dimensions(map),sx=w/d.width,sy=h/d.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='rgba(5,9,13,.9)';mctx.fillRect(0,0,w,h);
    for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[y].length;x++)if(map.grid[y][x]==='#'){mctx.fillStyle='rgba(235,222,190,.24)';mctx.fillRect(x*sx,y*sy,sx+.5,sy+.5)}
    for(const a of actors){if(!a.alive)continue;mctx.fillStyle=a.isPlayer?'#fff':a.team===C.TEAM_BLUE?'#55aaff':'#ff625d';mctx.beginPath();mctx.arc(a.x*sx,a.y*sy,a.isPlayer?4:2.6,0,Math.PI*2);mctx.fill()}
  }

  function frame(t){
    const dt=Math.min(.035,(t-lastFrame)/1000||0);lastFrame=t;
    if(running&&!matchEnded){
      updatePlayer(dt);for(const a of actors)if(!a.isPlayer)updateBot(a,dt,t);for(const a of actors)respawn(a,t);finishReload(t);updateHud();drawMinimap();
      if(t>=endsAt)endMatch();
    }
    drawScene();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyR')reload();if(e.code==='Space')firePlayer()});
  addEventListener('keyup',e=>keys.delete(e.code));
  canvas.addEventListener('click',()=>{if(running&&document.pointerLockElement!==canvas&&matchMedia('(pointer:fine)').matches){canvas.requestPointerLock?.();return}firePlayer()});
  addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&player?.alive)player.angle+=e.movementX*.0025});
  addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===canvas)firePlayer()});

  function touchPos(e,id){for(const t of e.changedTouches)if(t.identifier===id)return t;return null}
  stick.addEventListener('touchstart',e=>{const t=e.changedTouches[0];stickTouch=t.identifier;e.preventDefault()},{passive:false});
  addEventListener('touchmove',e=>{
    if(stickTouch!=null){const t=touchPos(e,stickTouch);if(t){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=36,k=Math.min(1,max/(len||1));const px=dx*k,py=dy*k;touchMove={x:px/max,y:py/max};knob.style.transform=`translate(${px}px,${py}px)`}}
    if(lookTouch){const t=touchPos(e,lookTouch.id);if(t){const dx=t.clientX-lookTouch.x;player.angle+=dx*.006;lookTouch.x=t.clientX;lookTouch.y=t.clientY}}
  },{passive:false});
  addEventListener('touchend',e=>{if(stickTouch!=null&&touchPos(e,stickTouch)){stickTouch=null;touchMove={x:0,y:0};knob.style.transform=''}if(lookTouch&&touchPos(e,lookTouch.id))lookTouch=null},{passive:false});
  lookPad.addEventListener('touchstart',e=>{const t=e.changedTouches[0];lookTouch={id:t.identifier,x:t.clientX,y:t.clientY};e.preventDefault()},{passive:false});
  fireBtn.addEventListener('touchstart',e=>{e.preventDefault();firePlayer()},{passive:false});
  reloadBtn.addEventListener('touchstart',e=>{e.preventDefault();reload()},{passive:false});

  window.BoomChiuGame={
    start:(opts={})=>{if(opts.map&&C.MAPS[opts.map]){mapId=opts.map;map=C.MAPS[mapId]}if(opts.difficulty)difficultyEl.value=opts.difficulty;if(opts.target)targetScoreEl.value=String(opts.target);startMatch()},
    fire:firePlayer,
    getState:()=>({running,mapId,difficulty,blueScore,redScore,targetScore,actors:actors.map(a=>({id:a.id,team:a.team,isPlayer:a.isPlayer,alive:a.alive,hp:a.hp,x:a.x,y:a.y,kills:a.kills,deaths:a.deaths})),player:player&&{hp:player.hp,clip:player.clip,reserve:player.reserve,kills:player.kills,deaths:player.deaths},diagnosticBotKills}),
    end:endMatch
  };
})();
