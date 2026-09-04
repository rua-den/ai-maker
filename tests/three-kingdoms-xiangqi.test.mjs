import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coreSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi-core.js', import.meta.url), 'utf8');
const botSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi-bot.js', import.meta.url), 'utf8');
const pageSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi.html', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadGame() {
  const context = {
    performance: { now: () => Date.now() },
    Math,
    JSON,
    console
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(botSource, context);
  return { rules: context.ThreeKingdomsXiangqi, bot: context.ThreeKingdomsBot };
}

test('Three Kingdoms Xiangqi starts with three 18-piece armies including special units', () => {
  const { rules: R } = loadGame();
  const state = R.initialState(true);
  assert.equal(state.pieces.length, 54);
  for (let k = 0; k < 3; k++) {
    assert.equal(state.pieces.filter(p => p.home === k).length, 18);
    assert.equal(state.pieces.filter(p => p.home === k && p.type === 'X').length, 2);
    assert.ok(state.pieces.some(p => p.home === k && p.type === 'K'));
  }
  assert.deepEqual(Array.from(state.alive), [true, true, true]);
  assert.equal(state.turn, 0, 'Shu/Red moves first');
});

test('special Three Kingdoms pieces can be disabled for a classic 16-piece army game', () => {
  const { rules: R } = loadGame();
  const state = R.initialState(false);
  assert.equal(state.pieces.length, 48);
  assert.equal(state.pieces.some(p => p.type === 'X'), false);
});

test('all three kingdoms have legal opening moves', () => {
  const { rules: R } = loadGame();
  const state = R.initialState(true);
  for (let k = 0; k < 3; k++) {
    assert.ok(R.legalMoves(state, k).length > 0, `kingdom ${k} should have a legal move`);
  }
});

test('capturing a General eliminates that kingdom and transfers its surviving army', () => {
  const { rules: R } = loadGame();
  const state = {
    version: 1,
    includeSpecial: true,
    pieces: [
      { id: 'rk', type: 'K', home: 0, controller: 0, sector: 0, r: 0, f: 3, glyph: '蜀' },
      { id: 'rr', type: 'R', home: 0, controller: 0, sector: 0, r: 4, f: 4, glyph: '車' },
      { id: 'bk', type: 'K', home: 1, controller: 1, sector: 1, r: 0, f: 4, glyph: '魏' },
      { id: 'bp', type: 'P', home: 1, controller: 1, sector: 1, r: 3, f: 0, glyph: '兵' },
      { id: 'gk', type: 'K', home: 2, controller: 2, sector: 2, r: 0, f: 3, glyph: '吳' }
    ],
    alive: [true, true, true],
    turn: 0,
    winner: null,
    moveNo: 0,
    lastMove: null,
    eliminated: [],
    lastEvent: ''
  };
  const target = R.key(1, 0, 4);
  const capture = R.legalMoves(state, 0).find(move => move.pieceId === 'rr' && move.to === target);
  assert.ok(capture, 'red chariot should be able to take the Wei General across the Y river');
  const result = R.makeMove(state, capture);
  assert.equal(result.ok, true);
  assert.equal(result.state.alive[1], false);
  assert.equal(result.state.pieces.some(p => p.id === 'bk'), false);
  assert.equal(result.state.pieces.find(p => p.id === 'bp').controller, 0, 'surviving Wei piece transfers to conqueror');
});

test('Three Kingdoms easy bot returns a legal move without brute-forcing the whole tree', () => {
  const { rules: R, bot } = loadGame();
  const state = R.initialState(true);
  const legal = R.legalMoves(state, state.turn);
  const started = Date.now();
  const move = bot.choose(state, state.turn, 'easy');
  const elapsed = Date.now() - started;
  assert.ok(move);
  assert.ok(legal.some(candidate => candidate.pieceId === move.pieceId && candidate.to === move.to));
  assert.ok(elapsed < 1000, `easy bot took ${elapsed}ms`);
});

test('Three Kingdoms page supports Human/BOT per seat, including two humans plus one bot', () => {
  assert.match(pageSource, /id="seat0"/);
  assert.match(pageSource, /id="seat1"/);
  assert.match(pageSource, /id="seat2"/);
  assert.match(pageSource, /value="human"/);
  assert.match(pageSource, /value="bot"/);
  assert.match(pageSource, /2 người có thể thêm BOT làm nước thứ ba/);
  assert.match(pageSource, /id="botDifficulty"/);
  assert.match(pageSource, /value="destroyer"/);
  assert.match(pageSource, /three-kingdoms-xiangqi-core\.js/);
  assert.match(pageSource, /three-kingdoms-xiangqi-bot\.js/);
});

test('Three Kingdoms canvas animations clamp stale RAF timestamps', () => {
  assert.match(pageSource, /Math\.max\(0,Math\.min\(1,\(now-moveFx\.start\)\/260\)\)/);
  assert.match(pageSource, /Math\.max\(0,\(now-captureFx\.start\)\/450\)/);
  assert.match(pageSource, /Math\.max\(0,pieceRadius\*\(\.8\+t\*1\.6\)\)/);
});

test('Three Kingdoms game is listed on the portfolio home', () => {
  assert.match(indexSource, /games\/three-kingdoms-xiangqi\.html/);
  assert.match(indexSource, /Cờ Tướng Tam Quốc/);
});

test('Three Kingdoms engine and bot parse as browser scripts', () => {
  assert.doesNotThrow(() => new Function(coreSource));
  assert.doesNotThrow(() => new Function(botSource));
});
