import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const live = fs.readFileSync(new URL('../games/xiangqi-live.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');

test('Xiangqi loader includes livestream enhancement after online mode', () => {
  assert.match(loader, /xiangqi-online\.js/);
  assert.match(loader, /xiangqi-live\.js/);
  assert.ok(loader.indexOf('xiangqi-online.js') < loader.indexOf('xiangqi-live.js'));
});

test('Xiangqi livestream lists playing rooms and registers spectators', () => {
  assert.match(live, /equalTo\('playing'\)/);
  assert.match(live, /spectators/);
  assert.match(live, /onDisconnect\(\)/);
  assert.match(live, /viewerCount/);
  assert.match(live, /Xem realtime trực tiếp/);
});

test('Xiangqi spectator is read-only and supports shareable watch links', () => {
  assert.match(live, /const LIVE_MODE = 'spectator'/);
  assert.match(live, /stopImmediatePropagation\(\)/);
  assert.match(live, /searchParams\.set\(WATCH_PARAM/);
  assert.match(live, /navigator\.share/);
  assert.match(live, /navigator\.clipboard\.writeText/);
});

test('Xiangqi livestream script parses as JavaScript', () => {
  assert.doesNotThrow(() => new Function(live));
});
