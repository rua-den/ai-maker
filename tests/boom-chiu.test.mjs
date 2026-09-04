import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadCore(){
  const code=fs.readFileSync(new URL('../games/boom-chiu-core.js',import.meta.url),'utf8');
  const context={module:{exports:{}},exports:{},console,Math};
  context.globalThis=context;
  vm.runInNewContext(code,context,{filename:'boom-chiu-core.js'});
  return context.module.exports;
}

const C=loadCore();

test('Bùm Chíu ships three original connected team maps',()=>{
  assert.equal(C.validateMaps().length,0);
  assert.equal(Object.keys(C.MAPS).length,3);
  assert.deepEqual(Array.from(Object.values(C.MAPS),m=>m.name),['Cát Cháy','Chợ Đêm','Phố Cổ']);
  for(const map of Object.values(C.MAPS)){
    assert.ok(C.spawns(map,C.TEAM_BLUE).length>=8);
    assert.ok(C.spawns(map,C.TEAM_RED).length>=8);
    const path=C.findPath(map,C.spawns(map,C.TEAM_BLUE)[0],C.spawns(map,C.TEAM_RED)[0]);
    assert.ok(path.length>0,`${map.name} must connect both team spawns`);
  }
});

test('Bùm Chíu collision, DDA raycast and line-of-sight primitives are usable by bots',()=>{
  const map=C.MAPS.cat_chay;
  const spawn=C.spawns(map,C.TEAM_BLUE)[0];
  assert.equal(C.PLAYER_SPEED,3.15);
  assert.equal(C.canStand(map,spawn.x,spawn.y),true);
  assert.equal(C.isWall(map,.2,.2),true);
  const hit=C.raycast(map,spawn.x,spawn.y,Math.PI,30);
  assert.equal(hit.hit,true);
  assert.ok(Math.abs(hit.distance-.5)<.001,`expected DDA wall at 0.5, got ${hit.distance}`);
  assert.equal(C.lineOfSight(map,spawn,{x:spawn.x+.2,y:spawn.y+.2}),true);
  const source=fs.readFileSync(new URL('../games/boom-chiu-core.js',import.meta.url),'utf8');
  assert.match(source,/Grid DDA/);
  assert.match(source,/Math\.abs\(1\/dx\)/);
  assert.doesNotMatch(source,/step\s*=\s*\.025/);
});

test('Bùm Chíu weapon contract supports a 30-round team FPS rifle',()=>{
  assert.equal(C.WEAPON.name,'Rùa-47');
  assert.equal(C.WEAPON.clipSize,30);
  assert.equal(C.WEAPON.reserve,90);
  assert.ok(C.WEAPON.damage>=30);
  assert.ok(C.WEAPON.fireDelay>=80);
});

test('Bùm Chíu vendors real free Kenney CC0 UI assets',()=>{
  const files=[
    '../assets/boom-chiu/kenney/crosshair.svg',
    '../assets/boom-chiu/kenney/button-primary.svg',
    '../assets/boom-chiu/kenney/button-fire.svg',
    '../assets/boom-chiu/kenney/button-reload.svg'
  ];
  for(const file of files)assert.equal(fs.existsSync(new URL(file,import.meta.url)),true,`${file} must exist`);
  const online=fs.readFileSync(new URL('../games/boom-chiu-pvp.html',import.meta.url),'utf8');
  assert.match(online,/kenney\/crosshair\.svg/);
  assert.match(online,/kenney\/button-primary\.svg/);
  assert.match(online,/kenney\/button-fire\.svg/);
  assert.match(online,/kenney\/button-reload\.svg/);
  assert.match(online,/id="netBadge"/);
  const thirdParty=fs.readFileSync(new URL('../assets/boom-chiu/THIRD_PARTY.md',import.meta.url),'utf8');
  assert.match(thirdParty,/Kenney Crosshair Pack/);
  assert.match(thirdParty,/Kenney UI Pack/);
  assert.match(thirdParty,/CC0/);
});

test('Bùm Chíu homepage is online-first and both online/local pages use Vietnamese-safe fonts',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const local=fs.readFileSync(new URL('../games/boom-chiu.html',import.meta.url),'utf8');
  const online=fs.readFileSync(new URL('../games/boom-chiu-pvp.html',import.meta.url),'utf8');
  assert.match(index,/games\/boom-chiu-pvp\.html/);
  assert.match(index,/Bùm Chíu Online/);
  assert.match(local,/\.\.\/assets\/app-fonts\.css/);
  assert.match(local,/VÀO TRẬN 5v5/);
  assert.match(local,/boom-chiu-core\.js/);
  assert.match(local,/boom-chiu\.js/);
  assert.match(online,/\.\.\/assets\/app-fonts\.css/);
  assert.match(online,/id="create"[^>]*>[^<]*TẠO PHÒNG 5V5/);
  assert.match(online,/boom-chiu-pvp\.js/);
});

test('Bùm Chíu production client defaults to Render, predicts locally and smooths remote actors',()=>{
  const pvp=fs.readFileSync(new URL('../games/boom-chiu-pvp.js',import.meta.url),'utf8');
  assert.match(pvp,/const PUBLIC_SERVER='wss:\/\/boom-chiu-pvp\.onrender\.com'/);
  assert.match(pvp,/function isLocalServer/);
  assert.match(pvp,/localStorage\.removeItem\('boom-chiu-server'\)/);
  assert.match(pvp,/const .*INTERP_MS=70/);
  assert.match(pvp,/function sampleActor/);
  assert.match(pvp,/function predict\(dt\)/);
  assert.match(pvp,/PING_INTERVAL=1500/);
  assert.match(pvp,/get renderPosition/);
  assert.match(pvp,/Math\.min\(180/);
  assert.match(pvp,/\/health/);
  assert.match(pvp,/SERVER ONLINE/);
  assert.doesNotMatch(pvp,/\|\|'ws:\/\/localhost:8787'/);
});

test('Bùm Chíu server broadcasts every 50 ms tick and supports latency probes',()=>{
  const server=fs.readFileSync(new URL('../server/boom-chiu-server.js',import.meta.url),'utf8');
  assert.match(server,/TICK_MS=50/);
  assert.match(server,/tickMs:TICK_MS/);
  assert.match(server,/m\.type==='ping'/);
  assert.match(server,/type:'pong'/);
  assert.match(server,/if\(room\.clients\.size\)broadcast\(room\)/);
  assert.doesNotMatch(server,/now%100/);
});
