'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TurtleRaceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ROOT='caroRooms';
  const ROOM_PREFIX='turtleRace_';
  const ROOM_KIND='turtle-race-v0';
  const TARGET=30;
  const MAX_PLAYERS=8;
  const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function cleanRoomCode(value){
    return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
  }
  function roomKey(code){
    return ROOM_PREFIX+cleanRoomCode(code);
  }
  function cleanName(value){
    const name=String(value||'').replace(/[<>\u0000-\u001f]/g,'').trim().replace(/\s+/g,' ').slice(0,16);
    return name||'Rùa';
  }
  function makeRoomCode(random=Math.random){
    let code='';
    for(let i=0;i<4;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)%ALPHABET.length];
    return code;
  }
  function clampProgress(value,target=TARGET){
    return Math.max(0,Math.min(target,Math.floor(Number(value)||0)));
  }
  function playersFrom(value){
    return Object.entries(value||{}).map(([id,p])=>({
      id,
      name:cleanName(p&&p.name),
      progress:clampProgress(p&&p.progress),
      joinedAt:Number(p&&p.joinedAt)||0
    })).sort((a,b)=>b.progress-a.progress||a.joinedAt-b.joinedAt||a.name.localeCompare(b.name,'vi'));
  }
  return {ROOT,ROOM_PREFIX,ROOM_KIND,TARGET,MAX_PLAYERS,ALPHABET,cleanRoomCode,roomKey,cleanName,makeRoomCode,clampProgress,playersFrom};
});
