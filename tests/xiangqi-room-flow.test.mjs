import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');
const controls = fs.readFileSync(new URL('../games/xiangqi-room-controls.js', import.meta.url), 'utf8');
const reset = fs.readFileSync(new URL('../games/xiangqi-suggestion-reset.js', import.meta.url), 'utf8');

test('Xiangqi loads safe room controls before legacy presence menu handling', () => {
  assert.match(loader, /xiangqi-room-controls\.js/);
  assert.match(loader, /xiangqi-suggestion-reset\.js/);
  assert.ok(loader.indexOf('xiangqi-online.js') < loader.indexOf('xiangqi-room-controls.js'));
  assert.ok(loader.indexOf('xiangqi-room-controls.js') < loader.indexOf('xiangqi-presence.js'));
  assert.ok(loader.indexOf('xiangqi-live.js') < loader.indexOf('xiangqi-suggestion-reset.js'));
});

test('in-game Menu opens a closable overlay without leaving the room', () => {
  assert.match(controls, /id = 'xiangqiActiveMenuClose'/);
  assert.match(controls, /textContent = '×'/);
  assert.match(controls, /showActiveMenu\(\)/);
  assert.match(controls, /closeActiveMenu\(\)/);
  assert.match(controls, /e\.stopImmediatePropagation\(\)/);
  assert.doesNotMatch(controls, /menuBtn[\s\S]{0,500}leaveActiveRoom\(\)/);
});

test('Xiangqi has explicit leave controls and asks for confirmation', () => {
  assert.match(controls, /xiangqiLeaveRoomBtn/);
  assert.match(controls, /🚪 Rời bàn/);
  assert.match(controls, /window\.confirm\('Rời bàn cờ\? Đối thủ sẽ được báo là bạn đã out\.'/);
  assert.match(controls, /window\.XiangqiPresence\.leaveActiveRoom\(\)/);
  assert.match(controls, /homeBtn\.addEventListener\('click'/);
});

test('spectator suggestions are removed whenever the room turn changes', () => {
  assert.match(reset, /if \(lastTurn && t !== lastTurn\)/);
  assert.match(reset, /child\('suggestions'\)\.remove\(\)/);
  assert.match(reset, /clearLocalSuggestionUi\(\)/);
  assert.match(reset, /setInterval\(sync, 80\)/);
});

test('new Xiangqi room flow scripts parse as JavaScript', () => {
  assert.doesNotThrow(() => new Function(controls));
  assert.doesNotThrow(() => new Function(reset));
});
