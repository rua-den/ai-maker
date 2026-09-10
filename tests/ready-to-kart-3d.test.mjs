import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const host=fs.readFileSync(new URL('../games/ready-to-kart-3d.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../games/ready-to-kart-3d.js',import.meta.url),'utf8');
const netfix=fs.readFileSync(new URL('../games/ready-to-kart-3d-multiplayer-fix.js',import.meta.url),'utf8');
const start=fs.readFileSync(new URL('../games/ready-to-race-start.html',import.meta.url),'utf8');

test('Ready to Kart 3D uses pinned Three.js and existing realtime stack',()=>{
  assert.match(host,/three@0\.185\.1\/build\/three\.module\.js/);
  assert.match(host,/ready-to-kart-3d\.js/);
  assert.match(host,/firebase-database-compat\.js/);
  assert.match(host,/ready-to-race-core\.js/);
  assert.match(host,/ready-to-kart-3d-multiplayer-fix\.js/);
  assert.match(app,/import \* as THREE from 'three'/);
  assert.match(app,/new THREE\.WebGLRenderer/);
  assert.match(app,/new THREE\.PerspectiveCamera/);
  assert.match(app,/ready-to-race-controller\.html/);
  assert.match(app,/kind:C\.ROOM_KIND/);
  assert.match(app,/mode:'kart3d'/);
});

test('Kart 3D remains host-authoritative and reuses arcade physics',()=>{
  assert.match(app,/C\.stepCar\(/);
  assert.match(app,/C\.resolveCarCollisions/);
  assert.match(app,/C\.constrainToMap/);
  assert.match(app,/requestAnimationFrame\(loop\)/);
  assert.match(app,/child\('telemetry'\)\.set/);
});

test('Kart 3D has four maps, kart animation and multiplayer-first cameras',()=>{
  for(const id of ['park','desert','night','ice'])assert.match(app,new RegExp(`${id}:\\{id:'${id}'`));
  assert.match(app,/function buildKart/);
  assert.match(app,/frontPivots/);
  assert.match(app,/wheel\.rotation\.z/);
  assert.match(app,/function spawnDust/);
  assert.match(app,/cameraMode/);
  assert.match(host,/GROUP CAM · ALL KARTS/);
  assert.match(app,/👥 GROUP/);
  assert.match(app,/THREE\.Fog/);
  assert.match(app,/shadowMap\.enabled=true/);
});

test('Kart 3D state transitions preserve per-device controller input',()=>{
  assert.doesNotThrow(()=>new Function(netfix));
  assert.match(netfix,/stateKeys=\['status','winner','mapId','mode','round','startsAt','startedAt','finishedAt','telemetry'\]/);
  assert.match(netfix,/ref\.update\(patch\)/);
  assert.match(netfix,/originalTransaction\.call/);
  assert.doesNotMatch(netfix,/stateKeys=.*players/);
});

test('Ready to Race entry exposes 2D, 3D and shared controller',()=>{
  assert.match(start,/href="ready-to-race\.html"/);
  assert.match(start,/href="ready-to-kart-3d\.html"/);
  assert.match(start,/href="ready-to-race-controller\.html"/);
  assert.match(start,/Kart 3D/);
  assert.match(start,/THREE\.JS · NEW/);
});