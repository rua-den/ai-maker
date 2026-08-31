import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../games/morris-rules.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../games/morris-bot.js', import.meta.url), 'utf8'), context);
  return { rules: context.window.MorrisRules, bot: context.window.MorrisBot };
}

const fixedRng = () => 0.37;

function boardOf(entries) {
  const a = Array(24).fill('.');
  for (const [idx, value] of entries) a[idx] = value;
  return a.join('');
}

test('Morris starts with 24 points and nine pieces to place per player', () => {
  const { rules } = load();
  const state = rules.initialState();
  assert.equal(state.board.length, 24);
  assert.equal(rules.legalMoves(state, 'A').length, 24);
  assert.equal(rules.phase(state, 'A'), 'placing');
});

test('forming a mill requires removing an eligible opponent piece', () => {
  const { rules } = load();
  const state = {
    board: boardOf([[0,'A'],[1,'A'],[3,'B'],[4,'B']]),
    placed: { A: 2, B: 2 }, last: 4, noCapture: 0
  };
  const preview = rules.preview(state, { to: 2 }, 'A');
  assert.equal(preview.madeMill, true);
  assert.deepEqual([...preview.removable], [3, 4]);
  assert.equal(rules.apply(state, { to: 2 }, 'A'), null);
  const result = rules.apply(state, { to: 2, remove: 3 }, 'A');
  assert.ok(result);
  assert.equal(result.state.board[3], '.');
});

test('a piece inside a mill is protected while another victim is outside a mill', () => {
  const { rules } = load();
  const board = boardOf([[3,'B'],[4,'B'],[5,'B'],[6,'B']]);
  assert.deepEqual([...rules.removable(board, 'B')], [6]);
});

test('movement uses adjacent points until a player has only three pieces, then flying is allowed', () => {
  const { rules } = load();
  const moving = { board: boardOf([[0,'A'],[3,'A'],[6,'A'],[9,'A'],[2,'B'],[5,'B'],[8,'B'],[14,'B']]), placed: { A: 9, B: 9 }, last: -1, noCapture: 0 };
  assert.equal(rules.phase(moving, 'A'), 'moving');
  assert.equal(rules.preview(moving, { from: 0, to: 2 }, 'A'), null);
  assert.ok(rules.preview(moving, { from: 0, to: 1 }, 'A'));

  const flying = { ...moving, board: boardOf([[0,'A'],[3,'A'],[6,'A'],[2,'B'],[5,'B'],[8,'B'],[14,'B']]) };
  assert.equal(rules.phase(flying, 'A'), 'flying');
  assert.ok(rules.preview(flying, { from: 0, to: 23 }, 'A'));
});

test('all four Morris bot levels return legal moves', () => {
  const { rules, bot } = load();
  const state = rules.initialState();
  const legal = rules.legalMoves(state, 'B').map(m => JSON.stringify(m));
  for (let level = 1; level <= 4; level++) {
    const move = bot.choose(state, 'B', level, fixedRng, rules);
    assert.ok(move);
    assert.ok(legal.includes(JSON.stringify(move)));
  }
});

test('super-hard Morris bot takes an immediate winning mill', () => {
  const { rules, bot } = load();
  const state = {
    board: boardOf([[0,'B'],[1,'B'],[3,'B'],[4,'A'],[5,'A'],[6,'A']]),
    placed: { A: 9, B: 9 }, last: -1, noCapture: 0
  };
  const move = bot.choose(state, 'B', 4, fixedRng, rules);
  assert.equal(move.from, 3);
  assert.equal(move.to, 2);
  assert.ok([4,5,6].includes(move.remove));
  const result = rules.apply(state, move, 'B');
  assert.equal(result.winner, 'B');
});

test('Morris page includes online room, bot levels and shared Firebase room engine', () => {
  const html = fs.readFileSync(new URL('../games/morris.html', import.meta.url), 'utf8');
  assert.match(html, /morrisRooms/);
  assert.match(html, /realtime-room\.js/);
  assert.match(html, /morris-bot\.js/);
  for (const label of ['Dễ', 'Vừa', 'Khó', 'Siêu khó']) assert.match(html, new RegExp(label));
});
