import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const botSource = fs.readFileSync(new URL('../games/go-bot.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../games/go-ai-runtime.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../games/go-ai/destroyer-core.js', import.meta.url), 'utf8');
const workerSource = fs.readFileSync(new URL('../games/go-ai/destroyer-worker.js', import.meta.url), 'utf8');

function loadDestroyer() {
  const context = { performance: { now: () => Date.now() } };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  return context.GoDestroyer;
}

test('Go exposes a fifth Hủy Diệt difficulty and lazy runtime bootstrap', () => {
  assert.match(botSource, /5:\s*\{\s*key:\s*'destroyer',\s*label:\s*'Hủy Diệt'/);
  assert.match(botSource, /destroyer\.value = '5'/);
  assert.match(botSource, /☠️ Hủy Diệt/);
  assert.match(botSource, /go-ai-runtime\.js/);
  assert.match(botSource, /data-go-ai-runtime|goAiRuntime/);
});

test('Destroyer runtime uses a lazy Web Worker and safe expert fallback', () => {
  assert.match(runtimeSource, /new Worker\('\.\/go-ai\/destroyer-worker\.js'\)/);
  assert.match(runtimeSource, /await chooseDestroyer/);
  assert.match(runtimeSource, /GoBot\.choose\(state, seat, 4\)/);
  assert.match(runtimeSource, /provider: 'classic-fallback'/);
  assert.match(runtimeSource, /queueBot = function/);
});

test('Destroyer core finds an immediate capture', () => {
  const D = loadDestroyer();
  const cells = Array(D.POINTS).fill('.');
  cells[180] = 'A';
  cells[161] = 'B';
  cells[179] = 'B';
  cells[181] = 'B';
  const board = cells.join('');
  const state = {
    size: 19,
    board,
    previousBoard: null,
    positionHistory: [board],
    captures: { A: 0, B: 0 },
    passes: 0,
    moveNo: 40,
    last: 181,
    lastAction: 'play',
    score: null
  };

  const result = D.choose(state, 'B', { budgetMs: 180, rootMoves: 6 });
  assert.ok(result?.move);
  assert.equal(result.move.idx, 199);
  const next = D.playStone(state, result.move.idx, 'B');
  assert.ok(next);
  assert.equal(next.board[180], '.');
  assert.equal(next.captures.B, 1);
});

test('Destroyer source files parse as browser scripts', () => {
  assert.doesNotThrow(() => new Function(coreSource));
  assert.doesNotThrow(() => new Function(workerSource));
  assert.doesNotThrow(() => new Function(runtimeSource));
});
