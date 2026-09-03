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

function loadGame() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../games/go-rules.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../games/go-bot.js', import.meta.url), 'utf8'), context);
  return { rules: context.window.GoRules, bot: context.window.GoBot };
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

test('Go positional superko rejects any previously seen whole-board position', () => {
  const R = loadRules();
  const initial = R.initialState();
  const first = R.playStone(initial, 0, 'A');
  assert.ok(first);
  const repeatedHistory = {
    ...R.initialState(),
    positionHistory: [R.emptyBoard(), first.board]
  };
  assert.equal(R.playStone(repeatedHistory, 0, 'A'), null);
});

test('two passes finish under Chinese AGA area scoring with 7.5 komi', () => {
  const R = loadRules();
  assert.equal(R.RULESET, 'Chinese/AGA area');
  let result = R.apply(R.initialState(), { pass: true }, 'A');
  assert.equal(result.winner, undefined);
  result = R.apply(result.state, { pass: true }, 'B');
  assert.ok(result.winner === 'A' || result.winner === 'B');
  assert.equal(result.state.score.komi, 7.5);
  assert.match(result.reason, /2 lượt Pass liên tiếp/);
});

test('all four Go bot levels choose a legal move', () => {
  const { rules: R, bot: B } = loadGame();
  let state = R.playStone(R.initialState(), 72, 'A');
  assert.ok(state);
  for (let level = 1; level <= 4; level++) {
    const move = B.choose(state, 'B', level, () => 0.37);
    assert.ok(move);
    if (move.pass || move.resign) continue;
    assert.ok(Number.isInteger(move.idx));
    assert.ok(R.playStone(state, move.idx, 'B'));
  }
});

test('expert Go bot takes an immediate capture', () => {
  const { rules: R, bot: B } = loadGame();
  const a = R.initialState().board.split('');
  a[180] = 'A';
  a[161] = 'B';
  a[179] = 'B';
  a[181] = 'B';
  const board = a.join('');
  const state = { ...R.initialState(), board, positionHistory: [board], moveNo: 40 };
  const move = B.choose(state, 'B', 4, () => 0);
  assert.equal(move.idx, 199);
  const next = R.playStone(state, move.idx, 'B');
  assert.ok(next);
  assert.equal(next.board[180], '.');
  assert.equal(next.captures.B, 1);
});

test('Go bot accepts endgame scoring after opponent passes instead of stonewalling while behind', () => {
  const { rules: R, bot: B } = loadGame();
  const cells = Array(R.POINTS).fill('.');
  for (let r = 0; r < R.SIZE; r++) {
    for (let c = 0; c <= 9; c++) cells[r * R.SIZE + c] = 'A';
    for (let c = 11; c < R.SIZE; c++) cells[r * R.SIZE + c] = 'B';
  }
  const board = cells.join('');
  const state = {
    ...R.initialState(),
    board,
    positionHistory: [board],
    moveNo: 220,
    passes: 1,
    lastAction: 'pass'
  };
  const score = R.areaScore(state);
  assert.ok(score.black > score.white, 'Bot/White should be behind in this settled position');
  const move = B.choose(state, 'B', 2, () => 0.25);
  assert.deepEqual(move, { pass: true });
  const result = R.apply(state, move, 'B');
  assert.equal(result.winner, 'A');
});

test('Go bot exposes endgame pass and resign logic', () => {
  const { bot: B } = loadGame();
  assert.equal(typeof B.shouldPass, 'function');
  assert.equal(typeof B.shouldResign, 'function');
  assert.equal(typeof B.endgameAssessment, 'function');
});

test('Go page exposes bot mode plus pan, pinch and wheel zoom without legal-dot guidance', () => {
  const html = fs.readFileSync(new URL('../games/go.html', import.meta.url), 'utf8');
  const bot = fs.readFileSync(new URL('../games/go-bot.js', import.meta.url), 'utf8');
  assert.match(html, /go-bot\.js/);
  assert.match(html, /data-mode="bot"/);
  assert.match(html, /botDifficulty/);
  assert.match(html, /GoBot\.choose/);
  assert.match(html, /pointerdown/);
  assert.match(html, /pointermove/);
  assert.match(html, /pointerMid/);
  assert.match(html, /wheel/);
  assert.match(html, /fitScale\*3\.6/);
  assert.match(html, /Chạm giao điểm trống bất kỳ/);
  assert.match(bot, /Pass \/ Chấm điểm/);
  assert.match(bot, /positional Superko/);
  assert.match(bot, /komi 7\.5/);
  assert.doesNotMatch(html, /class=["'][^"']*legal/);
});
