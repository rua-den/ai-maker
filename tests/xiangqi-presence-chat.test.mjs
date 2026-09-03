import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const presence = fs.readFileSync(new URL('../games/xiangqi-presence.js', import.meta.url), 'utf8');
const chat = fs.readFileSync(new URL('../games/xiangqi-live-chat.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');
const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;

test('Xiangqi loader wires presence before live and chat after live', () => {
  assert.match(loader, /xiangqi-presence\.js/);
  assert.match(loader, /xiangqi-live-chat\.js/);
  assert.ok(loader.indexOf('xiangqi-online.js') < loader.indexOf('xiangqi-presence.js'));
  assert.ok(loader.indexOf('xiangqi-presence.js') < loader.indexOf('xiangqi-live.js'));
  assert.ok(loader.indexOf('xiangqi-live.js') < loader.indexOf('xiangqi-live-chat.js'));
});

test('Xiangqi presence marks disconnects and deletes room when the last player leaves', () => {
  assert.match(presence, /\.info\/connected/);
  assert.match(presence, /myConnRef\.onDisconnect\(\)/);
  assert.match(presence, /lastPlayerRoomDisconnect = roomRef\.onDisconnect\(\)/);
  assert.match(presence, /await lastPlayerRoomDisconnect\.remove\(\)/);
  assert.match(presence, /đã out · đang chờ đối thủ quay lại/);
  assert.match(presence, /!seatOnline\(room, 'r'\) && !seatOnline\(room, 'b'\)/);
  assert.match(presence, /equalTo\('playing'\)/);
});

test('Xiangqi chat is shared by spectators and both online players', () => {
  assert.match(chat, /window\.XiangqiLive\?\.watchingId/);
  assert.match(chat, /window\.XiangqiPresence\?\.roomId/);
  assert.match(chat, /window\.XiangqiPresence\?\.color/);
  assert.match(chat, /readLocal\(ROOM_KEY\)/);
  assert.match(chat, /currentMode\(\) === 'online'/);
  assert.match(chat, /role: color === 'r' \? 'red' : 'black'/);
  assert.match(chat, /Chat trận đấu · Bạn:/);
  assert.match(chat, /Chat LIVE · Khán giả/);
});

test('Xiangqi chat stores bounded safe messages in the room', () => {
  assert.match(chat, /child\('chat'\)/);
  assert.match(chat, /limitToLast\(80\)/);
  assert.match(chat, /MAX_MESSAGE = 180/);
  assert.match(chat, /chatRef\.push\(\)\.set/);
  assert.match(chat, /role: activeContext\.role/);
  assert.match(chat, /text\.textContent = item\.text/);
  assert.match(chat, /who\.textContent = roleLabel\(item\.role\)/);
});

test('Firebase rules index Xiangqi live chat timestamps', () => {
  assert.deepEqual(rules.xiangqiRooms.$room.chat['.indexOn'], ['createdAt']);
});

test('Xiangqi presence and shared chat scripts parse as JavaScript', () => {
  assert.doesNotThrow(() => new Function(presence));
  assert.doesNotThrow(() => new Function(chat));
});
