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
    assert.ok(C.findPath(map,C.spawns(map,C.TEAM_BLUE)[0],C.spawns(map,C.TEAM_RED)[0]).length>0);
  }
});

test('Bùm Chíu collision, DDA raycast and LOS primitives are usable by bots',()=>{
  const map=C.MAPS.cat_chay,spawn=C.spawns(map,C.TEAM_BLUE)[0];
  assert.equal(C.PLAYER_SPEED,3.15);
  assert.equal(C.canStand(map,spawn.x,spawn.y),true);
  assert.equal(C.isWall(map,.2,.2),true);
  const hit=C.raycast(map,spawn.x,spawn.y,Math.PI,30);
  assert.equal(hit.hit,true);
  assert.ok(Math.abs(hit.distance-.5)<.001);
  assert.equal(C.lineOfSight(map,spawn,{x:spawn.x+.2,y:spawn.y+.2}),true);
  const source=fs.readFileSync(new URL('../games/boom-chiu-core.js',import.meta.url),'utf8');
  assert.match(source,/Grid DDA/);
  assert.doesNotMatch(source,/step\s*=\s*\.025/);
});

test('Bùm Chíu weapon contract supports a 30-round rifle',()=>{
  assert.equal(C.WEAPON.name,'Rùa-47');
  assert.equal(C.WEAPON.clipSize,30);
  assert.equal(C.WEAPON.reserve,90);
  assert.ok(C.WEAPON.damage>=30);
});

test('Bùm Chíu bot-only page visibly uses vendored Kenney CC0 UI and tracer VFX',()=>{
  const files=[
    '../assets/boom-chiu/kenney/crosshair.svg',
    '../assets/boom-chiu/kenney/ui-button-yellow.svg',
    '../assets/boom-chiu/kenney/ui-button-blue.svg',
    '../assets/boom-chiu/kenney/ui-button-red-round.svg',
    '../assets/boom-chiu/kenney/LICENSE-UI-PACK.txt'
  ];
  for(const file of files)assert.equal(fs.existsSync(new URL(file,import.meta.url)),true,`${file} must exist`);
  const local=fs.readFileSync(new URL('../games/boom-chiu.html',import.meta.url),'utf8');
  assert.match(local,/BOT-ONLY · KHÔNG CẦN SERVER/);
  assert.match(local,/ui-button-yellow\.svg/);
  assert.match(local,/ui-button-blue\.svg/);
  assert.match(local,/ui-button-red-round\.svg/);
  assert.match(local,/boom-chiu-vfx\.js/);
});

test('Bùm Chíu ships rendered Styloo weapon and eight Quaternius directional BOT sprites',()=>{
  const weapon=new URL('../assets/boom-chiu/styloo/ak47-fps.png',import.meta.url);
  assert.equal(fs.existsSync(weapon),true);
  assert.ok(fs.statSync(weapon).size>10000,'rendered Styloo weapon should not be an empty placeholder');
  for(let i=0;i<8;i++){
    const file=new URL(`../assets/boom-chiu/quaternius/soldier-${i}.png`,import.meta.url);
    assert.equal(fs.existsSync(file),true,`soldier-${i}.png must exist`);
    assert.ok(fs.statSync(file).size>10000,`soldier-${i}.png should contain rendered art`);
  }
  const art=fs.readFileSync(new URL('../games/boom-chiu-art.js',import.meta.url),'utf8');
  const game=fs.readFileSync(new URL('../games/boom-chiu.js',import.meta.url),'utf8');
  const vfx=fs.readFileSync(new URL('../games/boom-chiu-vfx.js',import.meta.url),'utf8');
  assert.match(art,/styloo\/ak47-fps\.png/);
  assert.match(art,/quaternius\/soldier-\$\{i\}\.png/);
  assert.match(game,/ART\?\.soldiers/);
  assert.match(game,/ctx\.drawImage\(sprite/);
  assert.match(game,/BoomChiuWeaponView/);
  assert.match(game,/BoomChiuVfx\?\.fire/);
  assert.match(vfx,/window\.BoomChiuWeaponView\?\.muzzle/);
  assert.match(vfx,/function fire\(opts=\{\}\)/);
});

test('Bùm Chíu records CC0 provenance and keeps 3D rendering out of runtime',()=>{
  const thirdParty=fs.readFileSync(new URL('../assets/boom-chiu/THIRD_PARTY.md',import.meta.url),'utf8');
  const renderer=fs.readFileSync(new URL('../scripts/render-boom-chiu-assets.mjs',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../games/boom-chiu.html',import.meta.url),'utf8');
  assert.match(thirdParty,/Styloo Guns Asset Pack/);
  assert.match(thirdParty,/Quaternius Toon Shooter Game Kit/);
  assert.match(thirdParty,/CC0/);
  assert.match(renderer,/ak47\.glb/);
  assert.match(renderer,/Character_Soldier\.gltf/);
  assert.match(renderer,/for\(let i=0;i<8;i\+\+\)/);
  assert.doesNotMatch(html,/three\.module\.js|GLTFLoader|cdn\.jsdelivr/);
  assert.match(html,/boom-chiu-art\.js/);
});

test('Bùm Chíu homepage is bot-first; PvP remains a separate experimental page',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const local=fs.readFileSync(new URL('../games/boom-chiu.html',import.meta.url),'utf8');
  const online=fs.readFileSync(new URL('../games/boom-chiu-pvp.html',import.meta.url),'utf8');
  assert.match(index,/href="games\/boom-chiu\.html"/);
  assert.match(index,/BOT-only 5v5/);
  assert.doesNotMatch(index,/href="games\/boom-chiu-pvp\.html"/);
  assert.match(local,/\.\.\/assets\/app-fonts\.css/);
  assert.match(local,/PvP thử nghiệm/);
  assert.match(local,/VÀO TRẬN BOT 5v5/);
  assert.match(online,/boom-chiu-pvp\.js/);
});

test('Bùm Chíu local WebSocket server remains self-contained for future VPS hosting',()=>{
  const server=fs.readFileSync(new URL('../server/boom-chiu-server.js',import.meta.url),'utf8');
  assert.match(server,/TICK_MS=50/);
  assert.match(server,/process\.env\.PORT\|\|8787/);
  assert.match(server,/new WebSocketServer\(\{server\}\)/);
  assert.match(server,/m\.type==='ping'/);
  assert.match(server,/type:'pong'/);
  assert.match(server,/server\.listen\(PORT,'0\.0\.0\.0'/);
});
