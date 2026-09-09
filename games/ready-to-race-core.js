'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ReadyToRaceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ROOT='caroRooms';
  const ROOM_PREFIX='readyToRace_';
  const ROOM_KIND='ready-to-race-v0';
  const MAX_PLAYERS=6;
  const LAPS=3;
  const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const TWO_PI=Math.PI*2;

  function cleanRoomCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)}
  function roomKey(code){return ROOM_PREFIX+cleanRoomCode(code)}
  function cleanName(value){const s=String(value||'').replace(/[<>\u0000-\u001f]/g,'').trim().replace(/\s+/g,' ').slice(0,16);return s||'Racer'}
  function makeRoomCode(random=Math.random){let code='';for(let i=0;i<4;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)%ALPHABET.length];return code}
  function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0))}
  function clampSteer(value){return clamp(value,-1,1)}
  function clampUnit(value){return clamp(value,0,1)}
  function sanitizeInput(value){const v=value||{};return{steer:clampSteer(v.steer),throttle:clampUnit(v.throttle),brake:!!v.brake,seq:Math.max(0,Math.floor(Number(v.seq)||0)),at:Number(v.at)||0}}
  function normalizeAngle(angle){angle=Number(angle)||0;angle%=TWO_PI;if(angle<0)angle+=TWO_PI;return angle}
  function angleDelta(from,to){let d=normalizeAngle(to)-normalizeAngle(from);if(d>Math.PI)d-=TWO_PI;if(d<-Math.PI)d+=TWO_PI;return d}
  function trackMetric(x,y,track){const dx=(x-track.cx)/track.rx,dy=(y-track.cy)/track.ry;return Math.hypot(dx,dy)}
  function ellipseTheta(x,y,track){return normalizeAngle(Math.atan2((y-track.cy)/track.ry,(x-track.cx)/track.rx))}
  function makeCar(index,track){const lane=(index%3)-1,row=Math.floor(index/3);return{x:track.cx+track.rx*.84-row*18,y:track.cy+lane*22,angle:Math.PI/2,speed:0,theta:0,progress:0,lap:0,finished:false}}
  function resetProgress(car,track){car.theta=ellipseTheta(car.x,car.y,track);car.progress=0;car.lap=0;car.finished=false;return car}
  function updateProgress(car,track){const theta=ellipseTheta(car.x,car.y,track),delta=angleDelta(car.theta,theta);car.theta=theta;if(Math.abs(delta)<.32)car.progress=Math.max(0,car.progress+delta);car.lap=Math.max(0,Math.min(LAPS,Math.floor(car.progress/TWO_PI)));if(car.progress>=LAPS*TWO_PI){car.progress=LAPS*TWO_PI;car.lap=LAPS;car.finished=true}return car}
  function stepCar(car,input,dt,track){
    dt=clamp(dt,0,.05);input=sanitizeInput(input);
    const q=trackMetric(car.x,car.y,track),onRoad=q>=.60&&q<=1.08;
    const maxSpeed=onRoad?285:128,accel=onRoad?230:145,brake=320,turnRate=2.35;
    car.speed+=input.throttle*accel*dt;
    if(input.brake)car.speed-=brake*dt;
    car.speed*=Math.pow(onRoad?.992:.972,dt*60);
    car.speed=clamp(car.speed,0,maxSpeed);
    const turnGrip=.20+Math.min(1,car.speed/165)*.92;
    car.angle+=input.steer*turnRate*turnGrip*dt;
    car.x+=Math.cos(car.angle)*car.speed*dt;
    car.y+=Math.sin(car.angle)*car.speed*dt;
    let nq=trackMetric(car.x,car.y,track);
    if(nq<.54||nq>1.14){
      const target=nq<.54?.56:1.12,dx=car.x-track.cx,dy=car.y-track.cy;
      const scale=target/Math.max(.001,nq);
      car.x=track.cx+dx*scale;car.y=track.cy+dy*scale;car.speed*=.55;
      nq=target;
    }
    updateProgress(car,track);
    return car;
  }
  function raceProgress(car){return Math.max(0,Math.min(LAPS,car.progress/TWO_PI))}
  return {ROOT,ROOM_PREFIX,ROOM_KIND,MAX_PLAYERS,LAPS,ALPHABET,TWO_PI,cleanRoomCode,roomKey,cleanName,makeRoomCode,clamp,clampSteer,clampUnit,sanitizeInput,normalizeAngle,angleDelta,trackMetric,ellipseTheta,makeCar,resetProgress,updateProgress,stepCar,raceProgress};
});
