import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;

test('Firebase rules keep the database closed by default', () => {
  assert.equal(rules['.read'], false);
  assert.equal(rules['.write'], false);
});

test('game data roots needed by the site are readable and writable', () => {
  const roomRoots = ['xiangqiRooms', 'caroRooms', 'connect4Rooms', 'tictactoeRooms', 'reversiRooms'];
  for (const root of roomRoots) {
    assert.equal(rules[root]['.read'], true, root + ' must be readable');
    assert.equal(rules[root].$room['.write'], true, root + ' rooms must be writable');
    assert.deepEqual(rules[root]['.indexOn'], ['status'], root + ' must index lobby status');
  }

  assert.equal(rules.leaderboards['.read'], true);
  assert.equal(rules.leaderboards.$game['.write'], true);
  assert.deepEqual(rules.leaderboards.$game['.indexOn'], ['score']);
});
