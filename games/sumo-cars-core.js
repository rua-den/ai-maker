'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SumoCarsCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ROOT='caroRooms';
  const ROOM_PREFIX='sumoCars_';
  const ROOM_KIND='sumo-cars-v0';
  const MAX_PLAYERS=20;
  const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const COLORS=['#ff5d73','#47d7ff','#ffd166','#7cf29a','#b28dff','#ff9f43','#5eead4','#f472b6','#a3e635','#60a5fa','#facc15','#fb7185','#34d399','#c084fc','#f97316','#22d3ee','#84cc16','#818cf8','#e879f9','#f43f5e'];
  const CAR_RADIUS=18;
  const BASE_ARENA_RADIUS=310;
  const MIN_ARENA_RADIUS=185;
  const SHRINK_DELAY_MS=18000;
  const SHRINK_DURATION_MS=36000;
  const BOOST_COOLDOWN_MS=1900;
  const BOOST_ACTIVE_MS=260;

  function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0))}
  function cleanRoomCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)}
  function roomKey(code){return ROOM_PREFIX+cleanRoomCode(code)}
  function cleanName(value){const s=String(value||'').replace(/[<>\u0000-\u001f]/g,'').trim().replace(/\s+/g,' ').slice(0,16);return s||'Driver'}
  function makeRoomCode(random=Math.random){let code='';for(let i=0;i<4;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)%ALPHABET.length];return code}
  function normalizeVector(x,y){x=clamp(x,-1,1);y=clamp(y,-1,1);const m=Math.hypot(x,y);if(m<=1)return{x,y,mag:m};return{x:x/m,y:y/m,mag:1}}
  function sanitizeInput(value){const v=value||{},n=normalizeVector(v.x,v.y);return{x:n.x,y:n.y,boost:!!v.boost,boostSeq:Math.max(0,Math.floor(Number(v.boostSeq)||0)),seq:Math.max(0,Math.floor(Number(v.seq)||0)),at:Number(v.at)||0}}
  function normalizeAngle(angle){const t=Math.PI*2;angle=(Number(angle)||0)%t;if(angle>Math.PI)angle-=t;if(angle<-Math.PI)angle+=t;return angle}
  function angleDelta(from,to){return normalizeAngle(to-from)}
  function approachAngle(from,to,maxStep){const d=angleDelta(from,to);return from+clamp(d,-maxStep,maxStep)}
  function arenaRadius(elapsedMs){const elapsed=Math.max(0,Number(elapsedMs)||0);if(elapsed<=SHRINK_DELAY_MS)return BASE_ARENA_RADIUS;const t=clamp((elapsed-SHRINK_DELAY_MS)/SHRINK_DURATION_MS,0,1);return BASE_ARENA_RADIUS+(MIN_ARENA_RADIUS-BASE_ARENA_RADIUS)*t}
  function makeCar(index,count,arena,playerId,name){
    count=Math.max(1,Number(count)||1);index=Math.max(0,Number(index)||0);
    const a=-Math.PI/2+(index/count)*Math.PI*2;
    const spawnRadius=(arena?.radius||BASE_ARENA_RADIUS)*.68;
    const cx=arena?.cx||0,cy=arena?.cy||0;
    return{id:playerId||('p'+index),name:cleanName(name||('Driver '+(index+1))),color:COLORS[index%COLORS.length],x:cx+Math.cos(a)*spawnRadius,y:cy+Math.sin(a)*spawnRadius,vx:0,vy:0,angle:normalizeAngle(a+Math.PI),alive:true,boostUntil:0,cooldownUntil:0,boostHeld:false,lastBoostSeq:0,knockoutAt:0,place:0};
  }
  function speed(car){return Math.hypot(Number(car?.vx)||0,Number(car?.vy)||0)}
  function stepCar(car,input,dt,now,arena){
    if(!car||!car.alive)return car;
    dt=clamp(dt,0,.05);now=Number(now)||0;input=sanitizeInput(input);
    const n=normalizeVector(input.x,input.y);
    if(n.mag>.12){
      const target=Math.atan2(n.y,n.x);
      car.angle=approachAngle(car.angle,target,5.3*dt);
      const accel=235*(.42+.58*n.mag);
      car.vx+=Math.cos(car.angle)*accel*dt;
      car.vy+=Math.sin(car.angle)*accel*dt;
    }
    const boostPressed=(input.boostSeq>car.lastBoostSeq)||(input.boost&&!car.boostHeld);
    if(input.boostSeq>car.lastBoostSeq)car.lastBoostSeq=input.boostSeq;
    if(boostPressed&&now>=car.cooldownUntil){
      car.vx+=Math.cos(car.angle)*205;
      car.vy+=Math.sin(car.angle)*205;
      car.boostUntil=now+BOOST_ACTIVE_MS;
      car.cooldownUntil=now+BOOST_COOLDOWN_MS;
    }
    car.boostHeld=input.boost;
    const drag=Math.pow(.984,dt*60);
    car.vx*=drag;car.vy*=drag;
    const maxSpeed=now<car.boostUntil?430:265,s=speed(car);
    if(s>maxSpeed){const k=maxSpeed/s;car.vx*=k;car.vy*=k}
    car.x+=car.vx*dt;car.y+=car.vy*dt;
    const dx=car.x-(arena?.cx||0),dy=car.y-(arena?.cy||0),limit=(arena?.radius||BASE_ARENA_RADIUS)+CAR_RADIUS*.35;
    if(Math.hypot(dx,dy)>limit){car.alive=false;car.knockoutAt=now;car.vx*=.55;car.vy*=.55}
    return car;
  }
  function resolveCarCollisions(cars,now){
    const list=(cars||[]).filter(c=>c&&c.alive);now=Number(now)||0;
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),minDist=CAR_RADIUS*2;
      if(dist>=minDist)continue;if(dist<.001){dx=.001;dy=0;dist=.001}
      const nx=dx/dist,ny=dy/dist,overlap=minDist-dist;
      a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;
      if(rel<0){
        const restitution=.48,base=-(1+restitution)*rel*.5;
        const aBoost=now<a.boostUntil,bBoost=now<b.boostUntil;
        const aToward=Math.max(0,a.vx*nx+a.vy*ny),bToward=Math.max(0,-(b.vx*nx+b.vy*ny));
        const bonusA=aBoost?120+Math.min(150,aToward*.42):0,bonusB=bBoost?120+Math.min(150,bToward*.42):0;
        const impulse=base+bonusA+bonusB;
        a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;
      }
    }
    return list;
  }
  function aliveCars(cars){return(cars||[]).filter(c=>c&&c.alive)}
  function assignPlaces(cars){
    const list=(cars||[]).filter(Boolean),alive=aliveCars(list),dead=list.filter(c=>!c.alive).sort((a,b)=>(b.knockoutAt||0)-(a.knockoutAt||0));
    if(alive.length===1)alive[0].place=1;
    const start=alive.length===1?2:alive.length+1;
    dead.forEach((c,i)=>{c.place=start+i});
    return list;
  }
  function roundWinner(cars){const alive=aliveCars(cars);return alive.length===1?alive[0]:null}
  return {ROOT,ROOM_PREFIX,ROOM_KIND,MAX_PLAYERS,ALPHABET,COLORS,CAR_RADIUS,BASE_ARENA_RADIUS,MIN_ARENA_RADIUS,SHRINK_DELAY_MS,SHRINK_DURATION_MS,BOOST_COOLDOWN_MS,BOOST_ACTIVE_MS,clamp,cleanRoomCode,roomKey,cleanName,makeRoomCode,normalizeVector,sanitizeInput,normalizeAngle,angleDelta,approachAngle,arenaRadius,makeCar,speed,stepCar,resolveCarCollisions,aliveCars,assignPlaces,roundWinner};
});
