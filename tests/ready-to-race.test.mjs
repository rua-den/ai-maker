import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../games/ready-to-race-core.js');
const host=fs.readFileSync(new URL('../games/ready-to-race.html',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../games/ready-to-race-controller.html',import.meta.url),'utf8');
const rules=JSON.parse(fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8'));

test('Ready to Race room identity and input bounds are stable',()=>{
  assert.equal(C.makeRoomCode(()=>0),'AAAA');
  assert.equal(C.cleanRoomCode(' r-4 c!e '),'R4CE');
  assert.equal(C.roomKey('r4ce'),'readyToRace_R4CE');
  assert.equal(C.LAPS,3);
  assert.equal(C.MAX_PLAYERS,6);
  assert.deepEqual(C.sanitizeInput({steer:9,throttle:-2,brake:1,seq:3.9}),{steer:1,throttle:0,brake:true,seq:3,at:0});
});

test('local car physics moves without Firebase frame state',()=>{
  const track={cx:480,cy:300,rx:330,ry:190};
  const car=C.makeCar(0,track);
  C.resetProgress(car,track);
  const y0=car.y;
  for(let i=0;i<30;i++)C.stepCar(car,{steer:0,throttle:1,brake:false},1/60,track);
  assert.ok(car.speed>0);
  assert.ok(car.y>y0);
  assert.ok(Number.isFinite(car.progress));
  assert.ok(C.trackMetric(car.x,car.y,track)>.5);
});

test('prototype storage root is allowed by current Firebase rules',()=>{
  const root=rules.rules[C.ROOT];
  assert.ok(root);
  assert.equal(root['.read'],true);
  assert.equal(root.$room['.write'],true);
});

test('shared screen runs canvas physics and controller rate-limits Firebase input',()=>{
  assert.match(host,/requestAnimationFrame\(loop\)/);
  assert.match(host,/C\.stepCar\(/);
  assert.match(host,/publishTelemetry/);
  assert.match(host,/ready-to-race-controller\.html/);
  assert.match(controller,/setInterval\(sendInput,80\)/);
  assert.match(controller,/child\('input'\)\.set/);
  assert.match(controller,/pointerdown/);
  for(const page of [host,controller]){
    assert.match(page,/firebase-database-compat\.js/);
    assert.match(page,/\.\.\/firebase-config\.js/);
    assert.doesNotMatch(page,/wss?:\/\//);
  }
});
