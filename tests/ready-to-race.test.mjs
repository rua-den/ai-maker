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
  const track={cx:480,cy:300,rx:330,ry:190,width:960,height:600};
  const forward=C.makeCar(0,track);C.resetProgress(forward,track);const y0=forward.y;
  for(let i=0;i<30;i++)C.stepCar(forward,{steer:0,throttle:1,brake:false,reverse:false},1/60,track);
  assert.ok(forward.speed>0);
  assert.ok(forward.y>y0);
  const reverse=C.makeCar(0,track);C.resetProgress(reverse,track);const ry0=reverse.y;
  for(let i=0;i<20;i++)C.stepCar(reverse,{steer:0,throttle:0,brake:false,reverse:true},1/60,track);
  assert.ok(reverse.speed<0);
  assert.ok(reverse.y<ry0);
});

test('grass is free-roam terrain while asphalt stays faster',()=>{
  const track={cx:480,cy:300,rx:330,ry:190,width:960,height:600,edgeMargin:18};
  const free=C.makeCar(0,track);
  free.x=track.cx+track.rx*1.16;free.y=track.cy;free.angle=0;free.speed=0;C.resetProgress(free,track);
  const before=C.trackMetric(free.x,free.y,track);
  C.stepCar(free,{steer:0,throttle:0,brake:false,reverse:false},1/60,track);
  const after=C.trackMetric(free.x,free.y,track);
  assert.ok(Math.abs(after-before)<1e-9,'grass position should not be pulled back toward the oval');

  const road=C.makeCar(0,track);C.resetProgress(road,track);
  const grass={x:120,y:120,angle:Math.PI/2,speed:0,theta:0,progress:0,lap:0,finished:false};C.resetProgress(grass,track);
  for(let i=0;i<60;i++){
    C.stepCar(road,{steer:0,throttle:1,brake:false,reverse:false},1/60,track);
    C.stepCar(grass,{steer:0,throttle:1,brake:false,reverse:false},1/60,track);
  }
  assert.ok(road.speed>grass.speed,'asphalt should reward staying on the road');
});

test('only the outer map edges constrain cars',()=>{
  const track={cx:480,cy:300,rx:330,ry:190,width:960,height:600,edgeMargin:18};
  const car={x:5,y:300,angle:Math.PI,speed:100,theta:0,progress:0,lap:0,finished:false};C.resetProgress(car,track);
  C.stepCar(car,{steer:0,throttle:0,brake:false,reverse:false},1/60,track);
  assert.equal(car.x,18);
  assert.ok(car.speed<0,'edge hit should bounce the car gently back into the map');
  assert.doesNotMatch(coreSource,/target=nq<\.54/);
  assert.match(coreSource,/constrainToMap/);
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

test('shared screen advertises the open map terrain rules',()=>{
  assert.match(host,/width:960,height:600,edgeMargin:18/);
  assert.match(host,/Asphalt nhanh nhất/);
  assert.match(host,/chỉ 4 cạnh bản đồ là tường/);
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
