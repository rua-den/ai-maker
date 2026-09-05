(() => {
  'use strict';
  const C=window.BoomChiuCore;
  if(!C)throw new Error('BoomChiuCore missing');
  const ART=window.BoomChiuArt||null;

  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});
  const mini=document.getElementById('minimap'),mctx=mini.getContext('2d');
  const menu=document.getElementById('menu'),mapGrid=document.getElementById('mapGrid'),startBtn=document.getElementById('startBtn');
  const difficultyEl=document.getElementById('difficulty'),targetScoreEl=document.getElementById('targetScore');
  const blueScoreEl=document.getElementById('blueScore'),redScoreEl=document.getElementById('redScore'),timerEl=document.getElementById('timer');
  const healthEl=document.getElementById('health'),ammoEl=document.getElementById('ammo'),kdEl=document.getElementById('kd');
  const killFeed=document.getElementById('killFeed'),hitmarker=document.getElementById('hitmarker'),damageFlash=document.getElementById('damageFlash'),banner=document.getElementById('banner');
  const touchUI=document.getElementById('touchUI'),stick=document.getElementById('stick'),knob=document.getElementById('knob'),lookPad=document.getElementById('lookPad');
  const fireBtn=document.getElementById('fireBtn'),reloadBtn=document.getElementById('reloadBtn'),jumpBtn=document.getElementById('jumpBtn'),crouchBtn=document.getElementById('crouchBtn');

  const FOV=Math.PI*70/180,MAX_PITCH=.62,PLAYER_SPEED=3.15,EYE_STAND=1.58,EYE_CROUCH=1.04,JUMP_V=4.35,GRAVITY=11.8;
  const BOT_SPEED={easy:1.75,hard:2.15,destroyer:2.45},BOT_FIRE={easy:620,hard:430,destroyer:315},BOT_ACCURACY={easy:.48,hard:.66,destroyer:.79};
  const keys=new Set(),actors=[],feed=[];
  let mapId='cat_chay',map=C.MAPS[mapId],difficulty='hard',targetScore=30,running=false,matchEnded=false,player=null;
  let blueScore=0,redScore=0,endsAt=0,lastFrame=performance.now(),muzzleUntil=0,lastShotAt=-Infinity,reloadingUntil=0,audioCtx=null;
  let touchMove={x:0,y:0},lookTouch=null,stickTouch=null,diagnosticBotKills=0,renderedSpriteCount=0,weaponSpriteFrames=0;
  let weaponMuzzle={x:innerWidth*.43,y:innerHeight*.61},lastBotGrounding=null;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`};
  const rand=(a,b)=>a+Math.random()*(b-a),now=()=>performance.now();
  const eyeHeight=()=>EYE_STAND-(EYE_STAND-EYE_CROUCH)*(player?.crouchAmount||0)+(player?.z||0);

  function resize(){const dpr=Math.min(1.6,devicePixelRatio||1);canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
  resize();addEventListener('resize',resize);

  Object.values(C.MAPS).forEach((m,i)=>{const b=document.createElement('button');b.className='mapCard'+(i===0?' active':'');b.dataset.map=m.id;b.innerHTML=`<b>${m.name}</b><small>${m.subtitle}</small>`;b.addEventListener('click',()=>{mapId=m.id;map=C.MAPS[mapId];mapGrid.querySelectorAll('.mapCard').forEach(x=>x.classList.toggle('active',x===b))});mapGrid.appendChild(b)});
  function spawnFor(team,index=0){const list=C.spawns(map,team),p=list[index%Math.max(1,list.length)]||{x:2.5,y:2.5};return{x:p.x,y:p.y}}
  function makeActor(id,name,team,isPlayer,index){const s=spawnFor(team,index);return{id,name,team,isPlayer,x:s.x,y:s.y,angle:team===C.TEAM_BLUE?0:Math.PI,pitch:0,z:0,vz:0,crouching:false,crouchAmount:0,hp:100,alive:true,respawnAt:0,kills:0,deaths:0,nextShotAt:0,path:[],pathAt:0,targetId:null,strafe:Math.random()<.5?-1:1,hitUntil:0}}
  function resetActors(){actors.length=0;player=makeActor('player','Bạn',C.TEAM_BLUE,true,0);actors.push(player);for(let i=0;i<4;i++)actors.push(makeActor('b'+i,C.BOT_NAMES[i],C.TEAM_BLUE,false,i+1));for(let i=0;i<5;i++)actors.push(makeActor('r'+i,C.BOT_NAMES[i+5],C.TEAM_RED,false,i))}

  function startMatch(){difficulty=difficultyEl.value;targetScore=Number(targetScoreEl.value)||30;map=C.MAPS[mapId];blueScore=0;redScore=0;diagnosticBotKills=0;renderedSpriteCount=0;weaponSpriteFrames=0;lastBotGrounding=null;matchEnded=false;endsAt=now()+5*60*1000;feed.length=0;killFeed.innerHTML='';resetActors();player.clip=C.WEAPON.clipSize;player.reserve=C.WEAPON.reserve;reloadingUntil=0;lastShotAt=-Infinity;running=true;menu.classList.add('hidden');touchUI.classList.add('playing');updateHud();ensureAudio();if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.()}
  startBtn.addEventListener('click',startMatch);

  function ensureAudio(){if(!audioCtx){try{audioCtx=new (AudioContext||webkitAudioContext)()}catch{}}if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{})}
  function tone(freq,dur=.05,volume=.05,type='square'){if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}
  const shotSound=()=>{tone(82,.075,.08,'sawtooth');tone(42,.09,.05,'square')},hitSound=head=>tone(head?1080:760,.045,.035,'square');
  function moveActor(a,dx,dy){const nx=a.x+dx,ny=a.y+dy;if(C.canStand(map,nx,a.y))a.x=nx;if(C.canStand(map,a.x,ny))a.y=ny}

  function jump(){if(!running||!player?.alive||player.z>.001)return false;player.crouching=false;player.vz=JUMP_V;player.z=.001;crouchBtn?.classList.remove('active');tone(180,.04,.018,'sine');return true}
  function setCrouch(value){if(!player)return;player.crouching=!!value;if(player.crouching&&player.z>.05)player.crouching=false;crouchBtn?.classList.toggle('active',player.crouching)}
  function toggleCrouch(){setCrouch(!player?.crouching)}
  function look(dx,dy,s=.0025){if(!player?.alive)return;player.angle+=dx*s;player.pitch=clamp(player.pitch-dy*s,-MAX_PITCH,MAX_PITCH)}

  function updatePlayer(dt){
    if(!player?.alive)return;
    const crouchTarget=player.crouching?1:0;player.crouchAmount+=clamp(crouchTarget-player.crouchAmount,-dt*7,dt*7);
    if(player.z>0||player.vz!==0){player.vz-=GRAVITY*dt;player.z+=player.vz*dt;if(player.z<=0){player.z=0;player.vz=0}}
    let f=0,s=0;if(keys.has('KeyW'))f++;if(keys.has('KeyS'))f--;if(keys.has('KeyD'))s++;if(keys.has('KeyA'))s--;f+=-touchMove.y;s+=touchMove.x;
    const len=Math.hypot(f,s)||1;f/=len;s/=len;const speed=PLAYER_SPEED*(player.crouchAmount>.35?.62:1)*dt;
    moveActor(player,(Math.cos(player.angle)*f+Math.cos(player.angle+Math.PI/2)*s)*speed,(Math.sin(player.angle)*f+Math.sin(player.angle+Math.PI/2)*s)*speed);
  }

  function nearestEnemy(a){let best=null,bd=Infinity;for(const b of actors){if(!b.alive||b.team===a.team)continue;const d=(b.x-a.x)**2+(b.y-a.y)**2;if(d<bd){bd=d;best=b}}return best}
  function botShoot(bot,target,t){if(t<bot.nextShotAt||!target.alive)return;bot.nextShotAt=t+BOT_FIRE[difficulty]+rand(-70,110);const dist=Math.hypot(target.x-bot.x,target.y-bot.y);let chance=BOT_ACCURACY[difficulty]-Math.max(0,dist-3)*.024;if(target.isPlayer&&keys.size)chance-=.05;if(Math.random()<clamp(chance,.16,.9)){const head=Math.random()<(difficulty==='destroyer'?.2:.1);damage(target,head?72:rand(22,38),bot,head)}}
  function updateBot(bot,dt,t){if(!bot.alive)return;let target=actors.find(x=>x.id===bot.targetId&&x.alive&&x.team!==bot.team);if(!target){target=nearestEnemy(bot);bot.targetId=target?.id||null}if(!target)return;const dist=Math.hypot(target.x-bot.x,target.y-bot.y),sees=dist<13&&C.lineOfSight(map,bot,target);if(sees){const desired=Math.atan2(target.y-bot.y,target.x-bot.x);bot.angle+=C.angleDelta(bot.angle,desired)*Math.min(1,dt*5.5);if(dist>4.4)moveActor(bot,Math.cos(bot.angle)*BOT_SPEED[difficulty]*dt,Math.sin(bot.angle)*BOT_SPEED[difficulty]*dt);else if(dist<2.2)moveActor(bot,-Math.cos(bot.angle)*BOT_SPEED[difficulty]*.55*dt,-Math.sin(bot.angle)*BOT_SPEED[difficulty]*.55*dt);else moveActor(bot,Math.cos(bot.angle+bot.strafe*Math.PI/2)*BOT_SPEED[difficulty]*.38*dt,Math.sin(bot.angle+bot.strafe*Math.PI/2)*BOT_SPEED[difficulty]*.38*dt);botShoot(bot,target,t);return}if(t>bot.pathAt||!bot.path.length){bot.path=C.findPath(map,bot,target).slice(0,12);bot.pathAt=t+rand(650,1050)}const p=bot.path[0];if(!p)return;const dx=p.x-bot.x,dy=p.y-bot.y,d=Math.hypot(dx,dy);if(d<.2){bot.path.shift();return}bot.angle=Math.atan2(dy,dx);moveActor(bot,dx/d*BOT_SPEED[difficulty]*dt,dy/d*BOT_SPEED[difficulty]*dt)}

  function respawn(a,t){if(a.alive||t<a.respawnAt)return;const list=C.spawns(map,a.team);let best=list[0]||{x:2.5,y:2.5},bestScore=-1;for(const s of list){let nearest=Infinity;for(const e of actors)if(e.alive&&e.team!==a.team)nearest=Math.min(nearest,Math.hypot(e.x-s.x,e.y-s.y));if(nearest>bestScore){bestScore=nearest;best=s}}Object.assign(a,{x:best.x,y:best.y,hp:100,alive:true,angle:a.team===C.TEAM_BLUE?0:Math.PI,path:[],targetId:null,hitUntil:0});if(a.isPlayer){Object.assign(a,{clip:C.WEAPON.clipSize,reserve:C.WEAPON.reserve,pitch:0,z:0,vz:0,crouching:false,crouchAmount:0});bannerText('TRỞ LẠI!',650)}}
  function damage(victim,amount,killer,head=false){if(!victim.alive||matchEnded)return;victim.hitUntil=now()+120;victim.hp-=amount;if(victim.isPlayer){damageFlash.style.opacity='.85';setTimeout(()=>damageFlash.style.opacity='0',85)}if(victim.hp>0)return;victim.hp=0;victim.alive=false;victim.deaths++;victim.respawnAt=now()+1800;killer.kills++;if(!killer.isPlayer)diagnosticBotKills++;if(killer.team===C.TEAM_BLUE)blueScore++;else redScore++;addKill(killer,victim,head);if(victim.isPlayer)bannerText('BẠN ĐÃ NẰM!',900);if(blueScore>=targetScore||redScore>=targetScore)endMatch()}
  function addKill(killer,victim,head){feed.unshift({text:`${killer.name} ${head?'🎯':'▸'} ${victim.name}`,team:killer.team,until:now()+4300});feed.splice(5);killFeed.innerHTML=feed.map(f=>`<div class="kill ${f.team==='blue'?'blue':'red'}">${f.text}</div>`).join('')}

  function reload(){if(!running||!player?.alive||reloadingUntil||player.clip>=C.WEAPON.clipSize||player.reserve<=0)return;reloadingUntil=now()+C.WEAPON.reloadMs;bannerText('ĐANG NẠP...',500);tone(240,.04,.025,'square')}
  function finishReload(t){if(!reloadingUntil||t<reloadingUntil)return;const need=C.WEAPON.clipSize-player.clip,take=Math.min(need,player.reserve);player.clip+=take;player.reserve-=take;reloadingUntil=0;tone(360,.045,.025,'square')}

  function firePlayer(){
    const t=now();if(!running||!player?.alive||matchEnded||reloadingUntil)return;if(t<(player.nextShotAt||0))return;if(player.clip<=0){reload();return}
    player.nextShotAt=t+C.WEAPON.fireDelay;player.clip--;muzzleUntil=t+58;lastShotAt=t;shotSound();
    const muzzle=window.BoomChiuWeaponView?.muzzle||weaponMuzzle;window.BoomChiuVfx?.fire?.({x1:muzzle.x,y1:muzzle.y,x2:innerWidth*.5,y2:innerHeight*.5});
    const shotAngle=player.angle+rand(-C.WEAPON.spread,C.WEAPON.spread),shotPitch=player.pitch+rand(-C.WEAPON.spread*.55,C.WEAPON.spread*.55),wall=C.raycast(map,player.x,player.y,shotAngle,C.WEAPON.range).distance,eye=eyeHeight();
    let best=null,bestDist=wall,bestScore=Infinity,bestHead=false;
    for(const a of actors){
      if(!a.alive||a.team===player.team||a.isPlayer)continue;const dx=a.x-player.x,dy=a.y-player.y,dist=Math.hypot(dx,dy);if(dist>=bestDist)continue;
      const hErr=Math.abs(C.angleDelta(shotAngle,Math.atan2(dy,dx))),hRadius=Math.atan(.31/Math.max(.3,dist));if(hErr>=hRadius||!C.lineOfSight(map,player,a))continue;
      const torsoPitch=Math.atan2(1.05-eye,dist),vErr=Math.abs(shotPitch-torsoPitch),vRadius=Math.atan(.83/Math.max(.4,dist));if(vErr>=vRadius)continue;
      const score=hErr/hRadius+vErr/vRadius;if(score<bestScore){const headPitch=Math.atan2(1.58-eye,dist);best=a;bestDist=dist;bestScore=score;bestHead=hErr<Math.atan(.11/Math.max(.4,dist))&&Math.abs(shotPitch-headPitch)<Math.atan(.15/Math.max(.4,dist))}
    }
    if(best){damage(best,C.WEAPON.damage*(bestHead?C.WEAPON.headshot:1),player,bestHead);showHit(bestHead)}if(player.clip===0&&player.reserve>0)setTimeout(reload,160);
  }

  function showHit(head){hitmarker.style.opacity='1';hitmarker.style.filter=head?'drop-shadow(0 0 5px #ff5757)':'none';setTimeout(()=>hitmarker.style.opacity='0',95);hitSound(head)}
  function bannerText(text,ms=900){banner.textContent=text;banner.style.opacity='1';setTimeout(()=>banner.style.opacity='0',ms)}
  function endMatch(){if(matchEnded)return;matchEnded=true;running=false;const win=blueScore===redScore?'HÒA':blueScore>redScore?'ĐỘI XANH THẮNG':'ĐỘI ĐỎ THẮNG';bannerText(win,1800);document.exitPointerLock?.();setTimeout(()=>{menu.classList.remove('hidden');touchUI.classList.remove('playing')},1900)}
  function updateHud(){blueScoreEl.textContent=blueScore;redScoreEl.textContent=redScore;healthEl.textContent=Math.max(0,Math.ceil(player?.hp||0));ammoEl.textContent=player?`${player.clip??0} / ${player.reserve??0}`:'30 / 90';kdEl.textContent=player?`${player.kills} / ${player.deaths}`:'0 / 0';const left=Math.max(0,endsAt-now()),sec=Math.ceil(left/1000);timerEl.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;while(feed.length&&feed[feed.length-1].until<now())feed.pop()}

  function viewCenter(H){return H*.5+(player?.pitch||0)*H*.58+(eyeHeight()-EYE_STAND)*H*.11}
  function drawScene(){
    const W=innerWidth,H=innerHeight,p=map.palette,horizon=viewCenter(H);const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,p.sky);sky.addColorStop(1,'#b6c4c4');ctx.fillStyle=sky;ctx.fillRect(0,0,W,clamp(horizon,0,H));const floor=ctx.createLinearGradient(0,horizon,0,H);floor.addColorStop(0,p.floor);floor.addColorStop(1,'#17191a');ctx.fillStyle=floor;ctx.fillRect(0,clamp(horizon,0,H),W,H);
    if(!player)return;const column=Math.max(2,Math.floor(W/420));
    for(let x=0;x<W;x+=column){const rayAngle=player.angle-FOV/2+(x/W)*FOV,hit=C.raycast(map,player.x,player.y,rayAngle,24),corrected=hit.distance*Math.cos(rayAngle-player.angle),wallH=Math.min(H*1.8,H/Math.max(.05,corrected)),top=horizon-wallH/2;const light=clamp(1-corrected/26,.2,1);ctx.fillStyle=corrected<4?rgba(p.wall,.92):rgba(p.wallDark,.78+light*.16);ctx.fillRect(x,top,column+1,wallH);if(corrected<2.2){ctx.fillStyle=`rgba(255,255,255,${.025*(2.2-corrected)})`;ctx.fillRect(x,top,column+1,wallH)}}
    drawActors(W,H,horizon);drawWeapon(W,H);if(!player.alive){ctx.fillStyle='rgba(90,0,0,.22)';ctx.fillRect(0,0,W,H)}
  }

  function drawActors(W,H,horizon){
    if(!player)return;const visible=actors.filter(a=>a.alive&&!a.isPlayer).map(a=>({a,d:Math.hypot(a.x-player.x,a.y-player.y),ang:C.angleDelta(player.angle,Math.atan2(a.y-player.y,a.x-player.x))})).filter(o=>Math.abs(o.ang)<FOV*.62&&o.d<18).sort((a,b)=>b.d-a.d);
    for(const {a,d,ang} of visible){
      if(!C.lineOfSight(map,player,a))continue;const sx=W/2+(ang/FOV)*W,h=clamp(H/(d*.86),22,H*.82),c=a.team===C.TEAM_BLUE?'#55aaff':'#f05b57',ground=horizon+h*.52,viewer=Math.atan2(player.y-a.y,player.x-a.x),relative=C.angleDelta(a.angle,viewer),viewIndex=(Math.round(relative/(Math.PI*2)*8)+8)%8,sprite=ART?.soldiers?.[viewIndex];
      ctx.save();ctx.globalAlpha=clamp(1-d/25,.48,1);ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.ellipse(sx,ground+2,h*.22,h*.05,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=clamp(h*.022,1.3,3.5);ctx.beginPath();ctx.ellipse(sx,ground,h*.25,h*.065,0,0,Math.PI*2);ctx.stroke();
      let charH=h*.98;
      if(sprite?.complete&&sprite.naturalWidth>0){const aspect=sprite.naturalWidth/sprite.naturalHeight,charW=charH*aspect;ctx.shadowColor=a.hitUntil>now()?'#fff':c;ctx.shadowBlur=a.hitUntil>now()?18:clamp(h*.03,1,8);ctx.drawImage(sprite,sx-charW/2,ground-charH,charW,charH);renderedSpriteCount++;lastBotGrounding={ground,feetY:ground,viewIndex}}
      else{const w=h*.42,y=ground-charH;ctx.fillStyle=c;ctx.fillRect(sx-w*.34,y+charH*.24,w*.68,charH*.58);ctx.beginPath();ctx.arc(sx,y+charH*.15,w*.25,0,Math.PI*2);ctx.fill()}
      const barW=h*.48,barY=ground-charH-8;ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.fillStyle='#000a';ctx.fillRect(sx-barW/2,barY,barW,5);ctx.fillStyle=a.hp>55?'#61df72':a.hp>25?'#ffd65c':'#ff5258';ctx.fillRect(sx-barW/2,barY,barW*clamp(a.hp/100,0,1),5);ctx.fillStyle='#fff';ctx.font=`900 ${clamp(h*.075,8,12)}px var(--app-font-sans, sans-serif)`;ctx.textAlign='center';ctx.fillText(a.name,sx,barY-4);ctx.restore();
    }
  }

  function drawWeapon(W,H){
    const t=now(),recoil=clamp(1-(t-lastShotAt)/135,0,1),moving=keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD')||Math.hypot(touchMove.x,touchMove.y)>.12,bobX=moving?Math.sin(t/105)*4:Math.sin(t/520)*1.2,bobY=moving?Math.abs(Math.cos(t/105))*5:Math.sin(t/650)*1.1,reloadActive=reloadingUntil>t,reloadPhase=reloadActive?1-clamp((reloadingUntil-t)/C.WEAPON.reloadMs,0,1):0;
    const rifle=ART?.rifle,aspect=rifle?.naturalWidth&&rifle?.naturalHeight?rifle.naturalWidth/rifle.naturalHeight:1.9,drawW=Math.min(W<760?W*.92:W*.68,H*.72*aspect),drawH=drawW/aspect,anchorX=W*.74+bobX,anchorY=H*.72+bobY+recoil*11,baseAngle=.58,reloadTilt=reloadActive?Math.sin(reloadPhase*Math.PI)*.72:0,angle=baseAngle+reloadTilt-recoil*.045;
    const lx=-drawW*.46,ly=-drawH*.03,cos=Math.cos(angle),sin=Math.sin(angle);weaponMuzzle={x:anchorX+lx*cos-ly*sin,y:anchorY+lx*sin+ly*cos};window.BoomChiuWeaponView={muzzle:weaponMuzzle,recoil,reloading:reloadActive,angle,anchor:{x:anchorX,y:anchorY}};
    if(rifle?.complete&&rifle.naturalWidth>0){ctx.save();ctx.translate(anchorX,anchorY);ctx.rotate(angle);ctx.scale(-1,1);ctx.globalAlpha=player?.alive?1:.7;ctx.drawImage(rifle,-drawW/2,-drawH/2,drawW,drawH);ctx.restore();weaponSpriteFrames++}else{ctx.save();ctx.translate(anchorX,anchorY);ctx.rotate(angle);ctx.fillStyle='#24282d';ctx.fillRect(-drawW*.36,-12,drawW*.6,24);ctx.fillStyle='#111';ctx.fillRect(-drawW*.48,-5,drawW*.14,8);ctx.restore()}
    if(muzzleUntil>t){ctx.save();ctx.translate(weaponMuzzle.x,weaponMuzzle.y);ctx.rotate(angle+Math.PI);ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(255,228,120,.96)';ctx.shadowBlur=18;ctx.shadowColor='#ffb22e';ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(25,-8);ctx.lineTo(13,1);ctx.lineTo(25,10);ctx.closePath();ctx.fill();ctx.restore()}
  }

  function drawMinimap(){if(!player)return;const w=mini.width,h=mini.height,d=C.dimensions(map),sx=w/d.width,sy=h/d.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='rgba(5,9,13,.9)';mctx.fillRect(0,0,w,h);for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[y].length;x++)if(map.grid[y][x]==='#'){mctx.fillStyle='rgba(235,222,190,.24)';mctx.fillRect(x*sx,y*sy,sx+.5,sy+.5)}for(const a of actors){if(!a.alive)continue;mctx.fillStyle=a.isPlayer?'#fff':a.team===C.TEAM_BLUE?'#55aaff':'#ff625d';mctx.beginPath();mctx.arc(a.x*sx,a.y*sy,a.isPlayer?4:2.6,0,Math.PI*2);mctx.fill()}}
  function frame(t){const dt=Math.min(.035,(t-lastFrame)/1000||0);lastFrame=t;if(running&&!matchEnded){updatePlayer(dt);for(const a of actors)if(!a.isPlayer)updateBot(a,dt,t);for(const a of actors)respawn(a,t);finishReload(t);updateHud();drawMinimap();if(t>=endsAt)endMatch()}drawScene();requestAnimationFrame(frame)}requestAnimationFrame(frame);

  addEventListener('keydown',e=>{if(['Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyR')reload();if(e.code==='Space'&&!e.repeat)jump();if(e.code==='KeyC'&&!e.repeat)toggleCrouch();if(e.code==='ControlLeft'||e.code==='ControlRight')setCrouch(true)});
  addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='ControlLeft'||e.code==='ControlRight')setCrouch(false)});
  canvas.addEventListener('click',()=>{if(running&&document.pointerLockElement!==canvas&&matchMedia('(pointer:fine)').matches){canvas.requestPointerLock?.();return}firePlayer()});
  addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&player?.alive)look(e.movementX,e.movementY,.0025)});
  addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===canvas)firePlayer()});

  function touchPos(e,id){for(const t of e.changedTouches)if(t.identifier===id)return t;return null}
  stick.addEventListener('touchstart',e=>{const t=e.changedTouches[0];stickTouch=t.identifier;e.preventDefault()},{passive:false});
  addEventListener('touchmove',e=>{if(stickTouch!=null){const t=touchPos(e,stickTouch);if(t){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=36,k=Math.min(1,max/(len||1)),px=dx*k,py=dy*k;touchMove={x:px/max,y:py/max};knob.style.transform=`translate(${px}px,${py}px)`}}if(lookTouch){const t=touchPos(e,lookTouch.id);if(t){look(t.clientX-lookTouch.x,t.clientY-lookTouch.y,.0055);lookTouch.x=t.clientX;lookTouch.y=t.clientY}}},{passive:false});
  addEventListener('touchend',e=>{if(stickTouch!=null&&touchPos(e,stickTouch)){stickTouch=null;touchMove={x:0,y:0};knob.style.transform=''}if(lookTouch&&touchPos(e,lookTouch.id))lookTouch=null},{passive:false});
  lookPad.addEventListener('touchstart',e=>{const t=e.changedTouches[0];lookTouch={id:t.identifier,x:t.clientX,y:t.clientY};e.preventDefault()},{passive:false});
  fireBtn.addEventListener('touchstart',e=>{e.preventDefault();firePlayer()},{passive:false});reloadBtn.addEventListener('touchstart',e=>{e.preventDefault();reload()},{passive:false});jumpBtn?.addEventListener('touchstart',e=>{e.preventDefault();jump()},{passive:false});crouchBtn?.addEventListener('touchstart',e=>{e.preventDefault();toggleCrouch()},{passive:false});

  window.BoomChiuGame={
    start:(opts={})=>{if(opts.map&&C.MAPS[opts.map]){mapId=opts.map;map=C.MAPS[mapId]}if(opts.difficulty)difficultyEl.value=opts.difficulty;if(opts.target)targetScoreEl.value=String(opts.target);startMatch()},
    fire:firePlayer,jump,setCrouch,look:(dx,dy)=>look(dx,dy,.0025),
    getState:()=>({running,mapId,difficulty,blueScore,redScore,targetScore,actors:actors.map(a=>({id:a.id,team:a.team,isPlayer:a.isPlayer,alive:a.alive,hp:a.hp,x:a.x,y:a.y,kills:a.kills,deaths:a.deaths})),player:player&&{hp:player.hp,clip:player.clip,reserve:player.reserve,kills:player.kills,deaths:player.deaths,pitch:player.pitch,z:player.z,vz:player.vz,crouching:player.crouching,crouchAmount:player.crouchAmount,eyeHeight:eyeHeight()},diagnosticBotKills,renderedSpriteCount,weaponSpriteFrames,artReady:!!ART?.ready,soldierSprites:ART?.soldiersLoaded||0,muzzle:{...weaponMuzzle},weaponView:window.BoomChiuWeaponView?{...window.BoomChiuWeaponView}:null,lastBotGrounding}),
    end:endMatch
  };
})();