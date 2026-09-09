import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../games/ready-to-race-core.js');
const coreSource=fs.readFileSync(new URL('../games/ready-to-race-core.js',import.meta.url),'utf8');
const host=fs.readFileSync(new URL('../games/ready-to-race.html',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../games/ready-to-race-controller.html',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../games/ready-to-race-start.html',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const rules=JSON.parse(fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8'));

test('Ready to Race room identity and input bounds are stable',()=>{
  assert.equal(C.makeRoomCode(()=>0),'AAAA');
  assert.equal(C.cleanRoomCode(' r-4 c!e '),'R4CE');
  assert.equal(C.roomKey('r4ce'),'readyToRace_R4CE');
  assert.equal(C.LAPS,3);
  assert.equal(C.MAX_PLAYERS,6);
  assert.deepEqual(C.sanitizeInput({steer:9,throttle:-2,brake:1,reverse:1,seq:3.9}),{steer:1,throttle:0,brake:true,reverse:true,seq:3,at:0});
});

test('local car physics supports forward and true reverse movement',()=>{
  const track={cx:480,cy:300,rx:330,ry:190};
  const forward=C.makeCar(0,track);C.resetProgress(forward,track);const y0=forward.y;
  for(let i=0;i<30;i++)C.stepCar(forward,{steer:0,throttle:1,brake:false,reverse:false},1/60,track);
  assert.ok(forward.speed>0);
  assert.ok(forward.y>y0);
  const reverse=C.makeCar(0,track);C.resetProgress(reverse,track);const ry0=reverse.y;
  for(let i=0;i<20;i++)C.stepCar(reverse,{steer:0,throttle:0,brake:false,reverse:true},1/60,track);
  assert.ok(reverse.speed<0);
  assert.ok(reverse.y<ry0);
});

test('track boundary correction is soft instead of snapping each frame',()=>{
  const track={cx:480,cy:300,rx:330,ry:190};
  const car=C.makeCar(0,track);
  car.x=track.cx+track.rx*1.16;car.y=track.cy;car.angle=0;car.speed=0;C.resetProgress(car,track);
  const before=C.trackMetric(car.x,car.y,track);
  C.stepCar(car,{steer:0,throttle:0,brake:false,reverse:false},1/60,track);
  const after=C.trackMetric(car.x,car.y,track);
  assert.ok(after<before);
  assert.ok(after>1.12,'soft correction should not teleport directly onto the boundary');
});

test('prototype storage root is allowed by current Firebase rules',()=>{
  const root=rules.rules[C.ROOT];
  assert.ok(root);
  assert.equal(root['.read'],true);
  assert.equal(root.$room['.write'],true);
});

test('Ready to Race entry explicitly chooses host or controller role',()=>{
  assert.match(entry,/Tạo phòng/);
  assert.match(entry,/Vào phòng/);
  assert.match(entry,/href="ready-to-race\.html"/);
  assert.match(entry,/href="ready-to-race-controller\.html"/);
  assert.match(index,/href="games\/ready-to-race-start\.html"/);
});

test('room screen injects a QR that follows the controller room URL',()=>{
  assert.match(coreSource,/readyToRaceQrJoin/);
  assert.match(coreSource,/qrcodejs\/1\.0\.0\/qrcode\.min\.js/);
  assert.match(coreSource,/new window\.QRCode/);
  assert.match(coreSource,/searchParams\.get\('room'\)/);
  assert.match(coreSource,/setInterval\(renderQr,250\)/);
  assert.match(host,/id="joinUrl"/);
  assert.match(host,/controllerUrl\(code\)/);
});

test('controller is a landscape-first gamepad with reverse',()=>{
  assert.match(controller,/@media\(orientation:portrait\)/);
  assert.match(controller,/Xoay ngang điện thoại/);
  assert.match(controller,/screen\.orientation/);
  assert.match(controller,/class="gamepad"/);
  assert.match(controller,/class="zone steeringZone"/);
  assert.match(controller,/class="zone pedalZone"/);
  assert.match(controller,/id="left"/);
  assert.match(controller,/id="right"/);
  assert.match(controller,/id="gas"/);
  assert.match(controller,/id="brake"/);
  assert.match(controller,/id="reverse"/);
  assert.match(controller,/reverse:active\?reverse:false/);
});

test('shared screen has larger standings and race fullscreen control',()=>{
  assert.match(host,/id="expandBtn"/);
  assert.match(host,/PHÓNG ĐƯỜNG ĐUA/);
  assert.match(host,/requestFullscreen/);
  assert.match(host,/fullscreenchange/);
  assert.match(host,/grid-template-columns:minmax\(0,1fr\) 320px/);
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
