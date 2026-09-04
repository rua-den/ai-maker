import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fix = fs.readFileSync(new URL('../games/xiangqi-clock-timeout-fix.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../games/xiangqi.html', import.meta.url), 'utf8');

test('Xiangqi loads clock and timeout fix after match UI', () => {
  assert.match(loader, /xiangqi-clock-timeout-fix\.js/);
  assert.ok(loader.indexOf('xiangqi-match-ui.js') < loader.indexOf('xiangqi-clock-timeout-fix.js'));
});

test('Xiangqi active per-turn countdown is visually huge and mobile-readable', () => {
  assert.match(fix, /\.xiangqiClockRow\.active \.xiangqiTurnClock b\{font-size:40px!important/);
  assert.match(fix, /@media\(max-width:760px\)[\s\S]*\.xiangqiClockRow\.active \.xiangqiTurnClock b\{font-size:34px!important/);
  assert.match(fix, /@media\(max-width:520px\)[\s\S]*\.xiangqiClockRow\.active \.xiangqiTurnClock b\{font-size:30px!important/);
  assert.match(fix, /\.xiangqiClockMain\{font-size:24px!important/);
  assert.match(fix, /@keyframes xiangqiClockPulse/);
});

test('Xiangqi timeout result always makes the timed-out side lose', () => {
  assert.match(fix, /const loser = room\.timeoutLoser \|\| \(action\?\.type === 'timeout' \? action\.loser : null\)/);
  assert.match(fix, /winner: opposite\(loser\)/);
  assert.match(fix, /current\.timeoutLoser = result\.loser/);
  assert.match(fix, /current\.winner = result\.winner/);
  assert.match(fix, /result\.loser\) \+ '\) ' \+ result\.reason/);
});

test('Xiangqi timeout fix JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(fix));
});
