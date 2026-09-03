import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const matchUi = fs.readFileSync(new URL('../games/xiangqi-match-ui.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');

test('Xiangqi loads match UI after chat and existing social modules', () => {
  assert.match(loader, /xiangqi-match-ui\.js/);
  assert.ok(loader.indexOf('xiangqi-live-chat.js') < loader.indexOf('xiangqi-match-ui.js'));
});

test('Xiangqi moves status and suggestion helpers into a left assist rail', () => {
  assert.match(matchUi, /xiangqiAssistRail/);
  assert.match(matchUi, /rail\.appendChild\(topBarEl\)/);
  assert.match(matchUi, /rail\.appendChild\(suggestPanel\)/);
  assert.match(matchUi, /canvasEl\.style\.transform = 'translateX\('/);
  assert.match(matchUi, /#board\{filter:none!important;opacity:1!important/);
});

test('Xiangqi chat is taller and collapsed chat clears the music control', () => {
  assert.match(matchUi, /#xiangqiLiveChat\{height:min\(560px,68vh\)!important\}/);
  assert.match(matchUi, /#xiangqiLiveChat\.collapsed\{height:auto!important;bottom:64px!important/);
  assert.match(matchUi, /@media\(max-width:520px\).*#xiangqiLiveChat\{height:min\(420px,55vh\)!important/s);
});

test('Xiangqi online undo requires opponent approval before restoring state', () => {
  assert.match(matchUi, /oldUndo\.cloneNode\(true\)/);
  assert.match(matchUi, /undoRequest/);
  assert.match(matchUi, /requestOnlineUndo/);
  assert.match(matchUi, /resolveUndo\(accept\)/);
  assert.match(matchUi, /latest\.key !== req\.historyKey/);
  assert.match(matchUi, /room\.board = cloneValue\(hist\.boardBefore\)/);
  assert.match(matchUi, /state: 'accepted'/);
  assert.match(matchUi, /state: 'rejected'/);
});

test('Xiangqi tracks captured pieces chronologically and renders capture effects', () => {
  assert.match(matchUi, /rows\.sort\(\(a, b\) => \(Number\(a\.at\)/);
  assert.match(matchUi, /patch\['captures\/' \+ key\]/);
  assert.match(matchUi, /captureFx\.push/);
  assert.match(matchUi, /function drawCaptureEffects/);
  assert.match(matchUi, /drawPieceAt\(0, 0, fx\.piece/);
});

test('Xiangqi exposes pre-game total and per-turn time controls with timeout enforcement', () => {
  assert.match(matchUi, /id="xiangqiTotalTime"/);
  assert.match(matchUi, /option value="600">10 phút/);
  assert.match(matchUi, /id="xiangqiTurnTime"/);
  assert.match(matchUi, /option value="60">60 giây/);
  assert.match(matchUi, /timeControl/);
  assert.match(matchUi, /clock/);
  assert.match(matchUi, /enforceOnlineTimeout/);
  assert.match(matchUi, /hết giờ tổng/);
  assert.match(matchUi, /hết giờ lượt/);
});

test('Xiangqi match UI JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(matchUi));
});
