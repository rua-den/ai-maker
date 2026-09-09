import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../games/turtle-race-core.js');

const host=fs.readFileSync(new URL('../games/turtle-race.html',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../games/turtle-race-controller.html',import.meta.url),'utf8');
const rules=JSON.parse(fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8'));

test('turtle race room codes and Firebase room key are stable',()=>{
  assert.equal(C.makeRoomCode(()=>0),'AAAA');
  assert.equal(C.cleanRoomCode(' a-b 9!z '),'AB9Z');
  assert.equal(C.roomKey('ab9z'),'turtleRace_AB9Z');
  assert.equal(C.TARGET,30);
  assert.equal(C.MAX_PLAYERS,8);
});

test('turtle race core sanitizes players and caps race progress',()=>{
  assert.equal(C.cleanName('  Rùa   Đen  '),'Rùa Đen');
  assert.equal(C.clampProgress(-4),0);
  assert.equal(C.clampProgress(999),30);
  const players=C.playersFrom({a:{name:'A',progress:7,joinedAt:2},b:{name:'B',progress:31,joinedAt:3},c:{name:'C',progress:7,joinedAt:1}});
  assert.deepEqual(players.map(p=>[p.id,p.progress]),[['b',30],['c',7],['a',7]]);
});

test('prototype storage namespace is already permitted by deployed-style Firebase rules',()=>{
  const root=rules.rules[C.ROOT];
  assert.ok(root,'prototype ROOT must exist in database.rules.json');
  assert.equal(root['.read'],true);
  assert.equal(root.$room['.write'],true);
});

test('shared screen and controller are GitHub Pages friendly Firebase clients',()=>{
  for(const page of [host,controller]){
    assert.match(page,/firebase-app-compat\.js/);
    assert.match(page,/firebase-database-compat\.js/);
    assert.match(page,/\.\.\/firebase-config\.js/);
    assert.match(page,/turtle-race-core\.js/);
    assert.doesNotMatch(page,/wss?:\/\//);
  }
  assert.match(host,/roomRef\.transaction/);
  assert.match(host,/Copy link controller/);
  assert.match(controller,/playerRef\.child\('progress'\)\.transaction/);
  assert.match(controller,/pointerdown/);
});
