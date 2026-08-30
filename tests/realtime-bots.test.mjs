import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadGame(ruleFile, globalName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../games/' + ruleFile, import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../games/realtime-bots.js', import.meta.url), 'utf8'), context);
  return { rules: context.window[globalName], bots: context.window.RuaBots };
}

const fixedRng = () => 0.37;

test('bot engine exposes four difficulty levels', () => {
  const { bots } = loadGame('tictactoe-rules.js', 'TicTacToeRules');
  assert.deepEqual(Object.keys(bots.LEVELS), ['1', '2', '3', '4']);
  assert.equal(bots.LEVELS[1].label, 'Dễ');
  assert.equal(bots.LEVELS[4].label, 'Siêu khó');
});

test('all Tic Tac Toe bot levels return legal moves', () => {
  const { rules, bots } = loadGame('tictactoe-rules.js', 'TicTacToeRules');
  const state = { board: 'A...B....', last: 4 };
  for (let level = 1; level <= 4; level++) {
    const move = bots.chooseTtt(state, 'B', level, fixedRng, rules);
    assert.ok(move && Number.isInteger(move.idx));
    assert.equal(state.board[move.idx], '.');
  }
});

test('super-hard Tic Tac Toe takes an immediate win', () => {
  const { rules, bots } = loadGame('tictactoe-rules.js', 'TicTacToeRules');
  const state = { board: 'BB.AA....', last: 4 };
  const move = bots.chooseTtt(state, 'B', 4, fixedRng, rules);
  assert.equal(move.idx, 2);
});

test('all Connect Four bot levels return playable columns', () => {
  const { rules, bots } = loadGame('connect4-rules.js', 'Connect4Rules');
  const state = { board: rules.empty(), last: -1 };
  for (let level = 1; level <= 4; level++) {
    const move = bots.chooseConnect4(state, 'B', level, fixedRng, rules);
    assert.ok(move && Number.isInteger(move.col));
    assert.ok(move.col >= 0 && move.col < 7);
  }
});

test('super-hard Connect Four finishes a forced vertical win', () => {
  const { rules, bots } = loadGame('connect4-rules.js', 'Connect4Rules');
  let state = { board: rules.empty(), last: -1 };
  for (let i = 0; i < 3; i++) state = rules.apply(state, { col: 3 }, 'B').state;
  const move = bots.chooseConnect4(state, 'B', 4, fixedRng, rules);
  assert.equal(move.col, 3);
});

test('all Reversi bot levels choose legal opening moves', () => {
  const { rules, bots } = loadGame('reversi-rules.js', 'ReversiRules');
  const state = { board: rules.empty(), last: -1 };
  const legal = new Set(rules.legalMoves(state.board, 'B'));
  for (let level = 1; level <= 4; level++) {
    const move = bots.chooseReversi(state, 'B', level, fixedRng, rules);
    assert.ok(move && legal.has(move.idx));
  }
});

test('new realtime pages load the shared bot engine and bot mode UI', () => {
  for (const file of ['connect4.html', 'tictactoe.html', 'reversi.html']) {
    const html = fs.readFileSync(new URL('../games/' + file, import.meta.url), 'utf8');
    assert.match(html, /realtime-bots\.js/);
    assert.match(html, /realtime-bot-mode\.js/);
  }
  const mode = fs.readFileSync(new URL('../games/realtime-bot-mode.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(mode));
  for (const label of ['Dễ', 'Vừa', 'Khó', 'Siêu khó']) assert.match(mode, new RegExp(label));
});
