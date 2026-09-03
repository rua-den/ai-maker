import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');
const centerFix = fs.readFileSync(new URL('../games/xiangqi-board-center-fix.js', import.meta.url), 'utf8');

test('Xiangqi board center fix loads after match UI', () => {
  assert.match(loader, /xiangqi-board-center-fix\.js/);
  assert.ok(loader.indexOf('xiangqi-match-ui.js') < loader.indexOf('xiangqi-board-center-fix.js'));
});

test('Xiangqi board remains viewport-centered despite match UI sizing', () => {
  assert.match(centerFix, /#gameContainer > #board/);
  assert.match(centerFix, /transform: none !important/);
  assert.match(centerFix, /justify-content:center/);
  assert.doesNotThrow(() => new Function(centerFix));
});
