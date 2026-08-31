import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadRules() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../games/go-rules.js', import.meta.url), 'utf8'), context);
  return context.window.GoRules;
}

test('Go uses a full 19x19 board and allows free legal intersections', () => {
  const R = loadRules();
  const s = R.initialState();
  assert.equal(R.SIZE, 19);
  assert.equal(s.board.length, 361);
  assert.ok(R.apply(s, { idx: 0 }, 'A'));
  assert.ok(R.apply(s, { idx: 180 }, 'A'));
  assert.ok(R.apply(s, { idx: 360 }, 'A'));
});

test('Go captures surrounded stones and rejects suicide', () => {
  const R = loadRules();
  let s = R.initialState();
  const p = (idx, seat) => { const n = R.playStone(s, idx, seat); assert.ok(n); s = n; };
  p(180, 'B'); p(161, 'A'); p(179, 'A'); p(181, 'A'); p(199, 'A');
  assert.equal(s.board[180], '.');
  assert.equal(s.captures.A, 1);

  s = R.initialState();
  p(161, 'A'); p(179, 'A'); p(181, 'A'); p(199, 'A');
  assert.equal(R.playStone(s, 180, 'B'), null);
});

test('two passes finish and calculate area score with komi', () => {
  const R = loadRules();
  let result = R.apply(R.initialState(), { pass: true }, 'A');
  assert.equal(result.winner, undefined);
  result = R.apply(result.state, { pass: true }, 'B');
  assert.ok(result.winner === 'A' || result.winner === 'B');
  assert.equal(result.state.score.komi, 6.5);
});

test('Go page exposes pan, pinch and wheel zoom without legal-dot guidance', () => {
  const html = fs.readFileSync(new URL('../games/go.html', import.meta.url), 'utf8');
  assert.match(html, /pointerdown/);
  assert.match(html, /pointermove/);
  assert.match(html, /pointerMid/);
  assert.match(html, /wheel/);
  assert.match(html, /fitScale\*3\.6/);
  assert.match(html, /Chạm giao điểm trống bất kỳ/);
  assert.doesNotMatch(html, /class=["'][^"']*legal/);
});
