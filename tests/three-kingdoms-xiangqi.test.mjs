import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coreSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi-core.js', import.meta.url), 'utf8');
const botSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi-bot.js', import.meta.url), 'utf8');
const uiSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi-ui.js', import.meta.url), 'utf8');
const onlineSource = fs.readFileSync(new URL('../games/three-kingdoms-xiangqi-online.js', import.meta.url), 'utf8');
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

test('Three Kingdoms opens with an explicit online lobby and keeps local play as a second tab', () => {
  assert.match(pageSource, /firebase-app\.js/);
  assert.match(pageSource, /firebase-database\.js/);
  assert.match(pageSource, /\.\.\/firebase-config\.js/);
  assert.match(pageSource, /three-kingdoms-xiangqi-ui\.js/);
  assert.match(pageSource, /three-kingdoms-xiangqi-online\.js/);
  assert.match(onlineSource, /tkOnlineTab/);
  assert.match(onlineSource, /🌐 ONLINE/);
  assert.match(onlineSource, /🎮 CÙNG MÁY/);
  assert.match(onlineSource, /TẠO PHÒNG MỚI/);
  assert.match(onlineSource, /Phòng đang chờ/);
});

test('Three Kingdoms online rooms use the already-deployed Xiangqi Firebase namespace', () => {
  assert.match(onlineSource, /const\s+ROOT\s*=\s*'xiangqiRooms\/threeKingdoms'/);
  assert.match(onlineSource, /roomsRef\.limitToLast\(40\)/);
  assert.match(onlineSource, /value\.status\s*===\s*'waiting'/);
  assert.doesNotMatch(onlineSource, /orderByChild\('status'\)\.equalTo\('waiting'\)/);
});

test('Three Kingdoms online room has three selectable seats and host can fill empty seats with bots', () => {
  assert.match(onlineSource, /function\s+createRoom\s*\(/);
  assert.match(onlineSource, /function\s+takeSeat\s*\(index\)/);
  assert.match(onlineSource, /function\s+setSeatBot\s*\(index\s*,\s*enabled\)/);
  assert.match(onlineSource, /function\s+startRoom\s*\(/);
  assert.match(onlineSource, /function\s+submitMove\s*\(move\)/);
  assert.match(onlineSource, /function\s+maybeDriveBot\s*\(value\)/);
  assert.match(onlineSource, /seatAt\(value\s*,\s*i\)\.type\s*===\s*'human'\s*\|\|\s*seatAt\(value\s*,\s*i\)\.type\s*===\s*'bot'/);
  assert.match(onlineSource, /R\.makeMove\(value\.state\s*,\s*move\)/);
});

test('Three Kingdoms room sharing uses a full join URL that can restore the exact room', () => {
  assert.match(onlineSource, /url\.searchParams\.set\('room'\s*,\s*id\)/);
  assert.match(onlineSource, /new\s+URLSearchParams\((?:window\.)?location\.search\)\.get\('room'\)/);
  assert.match(onlineSource, /🔗 Link phòng/);
  assert.match(onlineSource, /bindRoom\(requestedRoom\)/);
  assert.match(onlineSource, /VÀO PHÒNG ĐƯỢC MỜI/);
});

test('Three Kingdoms UI delegates online human moves and blocks control of other seats', () => {
  assert.match(uiSource, /onlineAdapter\.submitMove\?\.\(move\)/);
  assert.match(uiSource, /onlineAdapter&&!onlineAdapter\.canControl\?\.\(state\.turn\)/);
  assert.match(uiSource, /applyRemoteState/);
  assert.match(uiSource, /attachOnline/);
  assert.match(uiSource, /seatLabel/);
});

test('Three Kingdoms canvas animations clamp time and radius to safe ranges', () => {
  assert.match(uiSource, /Math\.max\(0,Math\.min\(1,\(now-moveFx\.start\)\/260\)\)/);
  assert.match(uiSource, /Math\.max\(0,pieceRadius\*\(\.8\+t\*1\.6\)\)/);
});

test('Three Kingdoms game is listed on the portfolio home', () => {
  assert.match(indexSource, /games\/three-kingdoms-xiangqi\.html/);
  assert.match(indexSource, /Cờ Tướng Tam Quốc/);
});

test('Three Kingdoms engine, bot, UI and online scripts parse as browser JavaScript', () => {
  assert.doesNotThrow(() => new Function(coreSource));
  assert.doesNotThrow(() => new Function(botSource));
  assert.doesNotThrow(() => new Function(uiSource));
  assert.doesNotThrow(() => new Function(onlineSource));
});
