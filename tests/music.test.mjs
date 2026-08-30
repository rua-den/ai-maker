import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const music = fs.readFileSync(new URL('../games/game-music.js', import.meta.url), 'utf8');
const firebaseConfig = fs.readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const tetrisMobile = fs.readFileSync(new URL('../games/tetris-mobile.js', import.meta.url), 'utf8');

test('shared game music JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(music));
});

test('shared music has tracks for every non-Tetris portfolio game', () => {
  for (const name of ['flappy', "'2048'", 'caro', 'xiangqi']) {
    assert.ok(music.includes(name), `missing shared music track: ${name}`);
  }
  assert.match(music, /globalMusicBtn/);
  assert.match(music, /AudioContext|webkitAudioContext/);
});

test('Firebase config requests shared music for every non-Tetris game', () => {
  assert.match(firebaseConfig, /game-music\.js/);
  for (const path of ['flappy-dog', '/2048', '/caro', '/xiangqi']) {
    assert.ok(firebaseConfig.includes(path), `missing auto-load path: ${path}`);
  }
});

test('Tetris keeps its dedicated music and sound system', () => {
  assert.match(tetrisMobile, /soundBtn/);
  assert.match(tetrisMobile, /scheduleMusic/);
  assert.match(tetrisMobile, /sfx\(/);
});
