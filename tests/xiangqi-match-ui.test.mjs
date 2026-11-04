import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const matchUi = fs.readFileSync(new URL('../games/xiangqi-match-ui.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');
const boardCenterFix = fs.readFileSync(new URL('../games/xiangqi-board-center-fix.js', import.meta.url), 'utf8');

test('Xiangqi loads match UI after chat and existing social modules', () => {
  assert.match(loader, /xiangqi-match-ui\.js/);
  assert.ok(loader.indexOf('xiangqi-live-chat.js') < loader.indexOf('xiangqi-match-ui.js'));
});

test('Xiangqi moves status and suggestion helpers into a left assist rail', () => {
  assert.match(matchUi, /xiangqiAssistRail/);
  assert.match(matchUi, /rail\.appendChild\(topBarEl\)/);
  assert.match(matchUi, /rail\.appendChild\(suggestPanel\)/);
  assert.match(matchUi, /#xiangqiAssistRail\{position:absolute;left:8px;right:8px;top:max\(56px,env\(safe-area-inset-top\)\)/);
  assert.match(matchUi, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(matchUi, /rail\.style\.display = show \? \(window\.innerWidth <= 760 \? 'grid' : 'flex'\) : 'none'/);
  assert.match(matchUi, /gameContainer\.style\.setProperty\('--xiangqi-board-offset-y'/);
  assert.match(boardCenterFix, /translateY\(var\(--xiangqi-board-offset-y, 0px\)\)/);
  assert.match(matchUi, /#board\{filter:none!important;opacity:1!important/);
});

test('Xiangqi chat is taller and collapsed chat clears the music control', () => {
  assert.match(matchUi, /#xiangqiLiveChat\{height:min\(560px,68vh\)!important\}/);
  assert.match(matchUi, /#xiangqiLiveChat\.collapsed\{height:auto!important;bottom:64px!important/);
  assert.match(matchUi, /#xiangqiLiveChat\{height:min\(420px,48dvh\)!important\}/);
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
  assert.match(matchUi, /current\.captures\[key\] =/);
  assert.match(matchUi, /Number\(current\.updatedAt\) !== Number\(after\.updatedAt\)/);
  assert.match(matchUi, /captureFx\.push/);
  assert.match(matchUi, /function drawCaptureEffects/);
  assert.match(matchUi, /drawPieceAt\(0, 0, fx\.piece/);
});

test('Xiangqi supports untimed play and one cumulative time pool per side', () => {
  assert.match(matchUi, /option value="0">∞ Không tính giờ/);
  assert.match(matchUi, /Quỹ thời gian mỗi bên/);
  assert.match(matchUi, /option value="600">10 phút/);
  assert.match(matchUi, /Thời gian được tích lũy cho cả ván đấu/);
  assert.match(matchUi, /function isTimeControlEnabled/);
  assert.match(matchUi, /return \{ enabled, totalSeconds: enabled \? total : 0 \}/);
  assert.match(matchUi, /xiangqiClockOff/);
  assert.match(matchUi, /∞ Không tính giờ/);
  assert.doesNotMatch(matchUi, /TIME_TURN_KEY|DEFAULT_TURN_SECONDS|xiangqiTimeTurnSeconds|xiangqiTurnTime|turnSeconds|xiangqiTurnClock|hết giờ lượt/);
});

test('Xiangqi deducts only the active side elapsed time from its cumulative clock', () => {
  assert.match(matchUi, /const elapsed = active \? Math\.max\(0, now - localClock\.turnStartedAt\) : 0/);
  assert.match(matchUi, /localClock\[mover \+ 'Ms'\] = remain\.total/);
  assert.match(matchUi, /current\.clock\[field\] = Math\.max\(0, \(Number\(current\.clock\[field\]\) \|\| 0\) - elapsed\)/);
  assert.match(matchUi, /elements\.bar\.style\.width = percent \+ '%'/);
  assert.match(matchUi, /finishLocalTimeout\(current, 'hết giờ'\)/);
});

test('Xiangqi prevents false timeout while a newly switched turn clock is still syncing', () => {
  assert.match(matchUi, /const synchronized = !clock\.lastTurn \|\| clock\.lastTurn === room\.turn/);
  assert.match(matchUi, /const provisionalStart = Number\(room\.updatedAt\)/);
  assert.match(matchUi, /function syncClockTurn\(room\)/);
  assert.match(matchUi, /if \(room\.clock\.lastTurn && room\.clock\.lastTurn !== room\.turn\) return false/);
  assert.match(matchUi, /if \(remain\.disabled \|\| !remain\.synchronized\) return false/);
  assert.match(matchUi, /current\.clock\.lastTurn = current\.turn/);
});

test('Xiangqi applies the cumulative clock to local and online games', () => {
  assert.match(matchUi, /id="xiangqiTotalTime"/);
  assert.match(matchUi, /option value="600">10 phút/);
  assert.doesNotMatch(matchUi, /id="xiangqiTurnTime"|turnSeconds|hết giờ tổng|hết giờ lượt/);
  assert.match(matchUi, /timeControl/);
  assert.match(matchUi, /clock/);
  assert.match(matchUi, /enforceOnlineTimeout/);
  assert.match(matchUi, /const reason = remain\.total <= 0 \? 'hết giờ' : null/);
  assert.match(matchUi, /const finalReason = check\.total <= 0 \? 'hết giờ' : null/);
});


test('Xiangqi mobile controls sit above the board without covering its play area', () => {
  assert.match(matchUi, /availableH = Math\.max\(220, vh - railTop - railHeight - 28\)/);
  assert.match(matchUi, /availableW = Math\.max\(180, vw - 20\)/);
  assert.match(matchUi, /visualViewport\.addEventListener\('resize'/);
  assert.match(matchUi, /#xiangqiAssistRail #topBar\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(matchUi, /#xiangqiAssistRail #xiangqiSuggestPanel\{max-height:76px!important/);
});

test('Xiangqi match UI JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(matchUi));
});

test('Xiangqi offers selectable per-move increment before starting', () => {
  assert.match(matchUi, /id="xiangqiIncrementTime"/);
  for (const seconds of [5, 10, 15, 20, 30]) assert.match(matchUi, new RegExp('option value="' + seconds + '">\\+' + seconds + ' giây/nước'));
  assert.match(matchUi, /TIME_INCREMENT_KEY/);
  assert.match(matchUi, /incrementSeconds: storedNumber\(TIME_INCREMENT_KEY, 10, false\)/);
  assert.match(matchUi, /localClock\[mover \+ 'Ms'\] \+= Number\(storedNumber\(TIME_INCREMENT_KEY, 10, false\)\) \* 1000/);
  assert.match(matchUi, /current\.clock\[mover \+ 'Ms'\].*incrementSeconds/);
});

test('Xiangqi provides move record and replay controls for local and online games', () => {
  assert.match(matchUi, /Biên bản & Replay/);
  assert.match(matchUi, /⏮ Đầu/);
  assert.match(matchUi, /◀ Lùi/);
  assert.match(matchUi, /▶ Phát/);
  assert.match(matchUi, /Tiến ▶/);
  assert.match(matchUi, /Cuối ⏭/);
  assert.match(matchUi, /boardBefore: cloneValue\(before\.board\)/);
  assert.match(matchUi, /boardAfter: cloneValue\(after\.board\)/);
  assert.match(matchUi, /localReplayFrames\.push\(window\.XiangqiReplay\.snapshot\(\)\)/);
});

test('Xiangqi saves completed games in persistent history and replays them later', () => {
  assert.match(matchUi, /xiangqiCompletedGameHistoryV1/);
  assert.match(matchUi, /function saveCompletedGame/);
  assert.match(matchUi, /function saveLocalCompletedGame/);
  assert.match(matchUi, /localStorage\.setItem\(GAME_HISTORY_KEY/);
  assert.match(matchUi, /data-history=/);
  assert.match(matchUi, /function openSavedGame/);
  assert.match(matchUi, /Lịch sử ván đấu/);
  assert.match(matchUi, /room\?\.status === 'finished'/);
  assert.match(matchUi, /frames: cloneValue\(localReplayFrames\)/);
});

test('Xiangqi game history is visible in mode selection with player names and replay action', () => {
  assert.match(matchUi, /xiangqiMenuHistory/);
  assert.match(matchUi, /Chọn một ván để xem lại bàn cờ và từng nước đi/);
  assert.match(matchUi, /item\.redName \|\| 'Đỏ'/);
  assert.match(matchUi, /item\.blackName \|\| 'Đen'/);
  assert.match(matchUi, /Xem lại ván đấu/);
  assert.match(matchUi, /replayReturnToMenu/);
  assert.match(matchUi, /redName:room\.red\?\.name/);
  assert.match(matchUi, /blackName:room\.black\?\.name/);
});
