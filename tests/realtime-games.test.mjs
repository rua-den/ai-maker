import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadRules(file, globalName) {
  const code = fs.readFileSync(new URL('../games/' + file, import.meta.url), 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window[globalName];
}

test('shared realtime room engine parses', () => {
  const code = fs.readFileSync(new URL('../games/realtime-room.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(code));
});

test('Connect Four detects a vertical win', () => {
  const r = loadRules('connect4-rules.js', 'Connect4Rules');
  let state = { board: r.empty(), last: -1 };
  for (let i = 0; i < 3; i++) state = r.apply(state, { col: 2 }, 'A').state;
  const result = r.apply(state, { col: 2 }, 'A');
  assert.equal(result.winner, 'A');
  assert.equal(result.reason, 'nối 4');
});

test('Tic Tac Toe detects three in a row', () => {
  const r = loadRules('tictactoe-rules.js', 'TicTacToeRules');
  let state = { board: r.empty(), last: -1 };
  state = r.apply(state, { idx: 0 }, 'A').state;
  state = r.apply(state, { idx: 1 }, 'A').state;
  const result = r.apply(state, { idx: 2 }, 'A');
  assert.equal(result.winner, 'A');
});

test('Reversi initial board has four legal black moves and flips correctly', () => {
  const r = loadRules('reversi-rules.js', 'ReversiRules');
  const board = r.empty();
  const legal = r.legalMoves(board, 'A');
  assert.equal(legal.length, 4);
  const result = r.apply({ board, last: -1 }, { idx: legal[0] }, 'A');
  assert.ok(result);
  const beforeA = [...board].filter(x => x === 'A').length;
  const afterA = [...result.state.board].filter(x => x === 'A').length;
  assert.ok(afterA > beforeA);
});

test('new realtime game pages include Firebase and shared room engine', () => {
  for (const file of ['connect4.html', 'tictactoe.html', 'reversi.html']) {
    const html = fs.readFileSync(new URL('../games/' + file, import.meta.url), 'utf8');
    assert.match(html, /firebase-database-compat\.js/);
    assert.match(html, /realtime-room\.js/);
    assert.match(html, /RuaRealtime\.boot/);
  }
});
