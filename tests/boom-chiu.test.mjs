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

test('Bùm Chíu collision, raycast and line-of-sight primitives are usable by bots',()=>{
  const map=C.MAPS.cat_chay;
  const spawn=C.spawns(map,C.TEAM_BLUE)[0];
  assert.equal(C.canStand(map,spawn.x,spawn.y),true);
  assert.equal(C.isWall(map,.2,.2),true);
  const hit=C.raycast(map,spawn.x,spawn.y,Math.PI,30);
  assert.equal(hit.hit,true);
  assert.ok(hit.distance>0&&hit.distance<30);
  assert.equal(C.lineOfSight(map,spawn,{x:spawn.x+.2,y:spawn.y+.2}),true);
});

test('Bùm Chíu weapon contract supports a 30-round team FPS rifle',()=>{
  assert.equal(C.WEAPON.name,'Rùa-47');
  assert.equal(C.WEAPON.clipSize,30);
  assert.equal(C.WEAPON.reserve,90);
  assert.ok(C.WEAPON.damage>=30);
  assert.ok(C.WEAPON.fireDelay>=80);
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

test('Bùm Chíu production client defaults to Render and migrates stale localhost settings',()=>{
  const pvp=fs.readFileSync(new URL('../games/boom-chiu-pvp.js',import.meta.url),'utf8');
  assert.match(pvp,/const PUBLIC_SERVER='wss:\/\/boom-chiu-pvp\.onrender\.com'/);
  assert.match(pvp,/localhost\|127\\\.0\\\.0\\\.1/);
  assert.match(pvp,/localStorage\.removeItem\('boom-chiu-server'\)/);
  assert.match(pvp,/\/health/);
  assert.match(pvp,/SERVER ONLINE/);
  assert.doesNotMatch(pvp,/\|\|'ws:\/\/localhost:8787'/);
});
