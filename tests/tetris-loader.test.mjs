import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync(new URL('../games/tetris.html', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../games/tetris-mobile.js', import.meta.url), 'utf8');

test('Tetris loader has exactly one literal script closing tag', () => {
  const closes = loader.match(/<\/script>/g) || [];
  assert.equal(closes.length, 1, 'only the outer loader script may contain a literal closing tag');
});

test('Tetris loader builds injected script close tag safely at runtime', () => {
  assert.match(loader, /const closeScript = '<\/scr' \+ 'ipt>';/);
  assert.match(loader, /<script src="\.\/tetris-mobile\.js">/);
  assert.doesNotMatch(loader, /<\\\\\/script>/);
});

test('Tetris loader inline JavaScript parses', () => {
  const match = loader.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(match, 'loader inline script not found');
  assert.doesNotThrow(() => new Function(match[1]));
});

test('mobile controller JavaScript parses and includes swipe/audio hooks', () => {
  assert.doesNotThrow(() => new Function(mobile));
  assert.match(mobile, /pointerdown/);
  assert.match(mobile, /pointermove/);
  assert.match(mobile, /pointerup/);
  assert.match(mobile, /AudioContext|webkitAudioContext/);
  assert.match(mobile, /#touchControls \{ display: none !important; \}/);
});
