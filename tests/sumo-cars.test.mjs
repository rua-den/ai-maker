import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../games/sumo-cars-core.js');

test('sumo cars room contract supports 20 players',()=>{
  assert.equal(C.ROOT,'caroRooms');
  assert.equal(C.ROOM_KIND,'sumo-cars-v0');
  assert.equal(C.MAX_PLAYERS,20);
  assert.equal(C.cleanRoomCode(' a-bc9 '),'ABC9');
  assert.equal(C.roomKey('ab12'),'sumoCars_AB12');
  assert.equal(C.cleanName('<Rùa>   Đen'),'Rùa Đen');
});

test('controller input clamps joystick and preserves boost presses',()=>{
  assert.deepEqual(C.sanitizeInput({x:4,y:0,boost:true,boostSeq:3,seq:9,at:123}),{x:1,y:0,boost:true,boostSeq:3,seq:9,at:123});
  const diagonal=C.sanitizeInput({x:1,y:1});
  assert(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
});

test('cars spawn around the arena facing inward',()=>{
  const arena={cx:550,cy:350,radius:C.BASE_ARENA_RADIUS};
  const cars=Array.from({length:8},(_,i)=>C.makeCar(i,8,arena,'p'+i,'P'+i));
  assert.equal(new Set(cars.map(c=>c.color)).size,8);
  for(const car of cars){
    const distance=Math.hypot(car.x-arena.cx,car.y-arena.cy);
    assert(distance>arena.radius*.6&&distance<arena.radius*.75);
    const inward=Math.atan2(arena.cy-car.y,arena.cx-car.x);
    assert(Math.abs(C.angleDelta(car.angle,inward))<1e-9);
  }
});

test('boost is edge/sequence triggered and respects cooldown',()=>{
  const arena={cx:0,cy:0,radius:500};
  const car=C.makeCar(0,2,arena,'a','A');
  car.x=0;car.y=0;car.angle=0;
  C.stepCar(car,{x:1,y:0,boost:true,boostSeq:1},.016,1000,arena);
  const firstCooldown=car.cooldownUntil,firstBoostUntil=car.boostUntil;
  assert(firstCooldown>=1000+C.BOOST_COOLDOWN_MS);
  assert(car.vx>190);
  C.stepCar(car,{x:1,y:0,boost:false,boostSeq:1},.016,1100,arena);
  C.stepCar(car,{x:1,y:0,boost:true,boostSeq:2},.016,1200,arena);
  assert.equal(car.cooldownUntil,firstCooldown);
  assert.equal(car.boostUntil,firstBoostUntil);
  C.stepCar(car,{x:1,y:0,boost:false,boostSeq:2},.016,firstCooldown+1,arena);
  C.stepCar(car,{x:1,y:0,boost:true,boostSeq:3},.016,firstCooldown+2,arena);
  assert(car.cooldownUntil>firstCooldown);
});

test('boost collision transfers a strong impulse',()=>{
  const arena={cx:0,cy:0,radius:500};
  const a=C.makeCar(0,2,arena,'a','A'),b=C.makeCar(1,2,arena,'b','B');
  Object.assign(a,{x:-15,y:0,vx:220,vy:0,angle:0,boostUntil:5000});
  Object.assign(b,{x:15,y:0,vx:0,vy:0,angle:Math.PI});
  C.resolveCarCollisions([a,b],1000);
  assert(b.vx>200,'victim should receive a large ram impulse');
});

test('cars fall out when crossing the arena and the arena shrinks',()=>{
  const arena={cx:0,cy:0,radius:200};
  const car=C.makeCar(0,2,arena,'a','A');
  Object.assign(car,{x:230,y:0,vx:20,vy:0});
  C.stepCar(car,{x:0,y:0},.016,1000,arena);
  assert.equal(car.alive,false);
  assert.equal(C.arenaRadius(0),C.BASE_ARENA_RADIUS);
  assert.equal(C.arenaRadius(C.SHRINK_DELAY_MS),C.BASE_ARENA_RADIUS);
  assert.equal(C.arenaRadius(C.SHRINK_DELAY_MS+C.SHRINK_DURATION_MS),C.MIN_ARENA_RADIUS);
});
