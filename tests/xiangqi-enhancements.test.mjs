import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancement = fs.readFileSync(new URL('../games/xiangqi-enhancements.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');

test('Xiangqi loads enhancements before livestream input blocking', () => {
  assert.match(loader, /xiangqi-enhancements\.js/);
  assert.ok(loader.indexOf('xiangqi-online.js') < loader.indexOf('xiangqi-enhancements.js'));
  assert.ok(loader.indexOf('xiangqi-enhancements.js') < loader.indexOf('xiangqi-live.js'));
  assert.ok(loader.indexOf('xiangqi-live.js') < loader.indexOf('xiangqi-live-chat.js'));
});

test('Xiangqi flips board and input coordinates for the black side', () => {
  assert.match(enhancement, /playerSide\(\)/);
  assert.match(enhancement, /humanColor === 'b'/);
  assert.match(enhancement, /return playerSide\(\) === 'b'/);
  assert.match(enhancement, /baseBoardToPx\(9 - r, 8 - c\)/);
  assert.match(enhancement, /row: 9 - cell\.row, col: 8 - cell\.col/);
});

test('Xiangqi chat contrast is explicitly bright and high contrast', () => {
  assert.match(enhancement, /#xiangqiLiveChat\{color:#fffdf8!important/);
  assert.match(enhancement, /\.liveMsgText\{color:#fff!important;font-weight:750!important/);
  assert.match(enhancement, /background:rgba\(10,7,5,\.985\)!important/);
});

test('Xiangqi spectators can vote suggested legal moves for the current turn', () => {
  assert.match(enhancement, /suggestionsRef = db\.ref\(ROOT\)\.child\(activeRoomId\)\.child\('suggestions'\)/);
  assert.match(enhancement, /legalMovesForPiece\(b, row, col\)/);
  assert.match(enhancement, /await voteRef\.set\(vote\)/);
  assert.match(enhancement, /turn: currentTurn\(\)/);
  assert.match(enhancement, /kind: 'spectator'/);
  assert.match(enhancement, /Top nước khán giả đang vote/);
});

test('Xiangqi suggestion overlay renders crowd arrows for players and spectators', () => {
  assert.match(enhancement, /const baseDrawSelection = drawSelection/);
  assert.match(enhancement, /suggestionRows\.slice\(0, 3\)/);
  assert.match(enhancement, /ctx\.lineTo\(endX, endY\)/);
  assert.match(enhancement, /ctx\.fillText\(String\(row\.count\)/);
});

test('Xiangqi enhancements parse as JavaScript', () => {
  assert.doesNotThrow(() => new Function(enhancement));
});
