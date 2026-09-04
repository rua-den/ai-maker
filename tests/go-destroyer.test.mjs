import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const botSource = fs.readFileSync(new URL('../games/go-bot.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../games/go-ai-runtime.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../games/go-ai/destroyer-core.js', import.meta.url), 'utf8');
const workerSource = fs.readFileSync(new URL('../games/go-ai/destroyer-worker.js', import.meta.url), 'utf8');
const encoderSource = fs.readFileSync(new URL('../games/go-ai/neural-encoder.js', import.meta.url), 'utf8');
const neuralWorkerSource = fs.readFileSync(new URL('../games/go-ai/neural-worker.js', import.meta.url), 'utf8');

function loadDestroyer() {
  const context = { performance: { now: () => Date.now() } };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  return context.GoDestroyer;
}

function loadEncoder() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(encoderSource, context);
  return context.GoNeuralEncoder;
}

test('Go exposes a fifth Hủy Diệt difficulty and lazy runtime bootstrap', () => {
  assert.match(botSource, /5:\s*\{\s*key:\s*'destroyer',\s*label:\s*'Hủy Diệt'/);
  assert.match(botSource, /destroyer\.value = '5'/);
  assert.match(botSource, /☠️ Hủy Diệt/);
  assert.match(botSource, /go-ai-runtime\.js/);
  assert.match(botSource, /data-go-ai-runtime|goAiRuntime/);
});

test('Hủy Diệt prefers KataGo ONNX then falls back to local worker and expert', () => {
  assert.match(runtimeSource, /new Worker\('\.\/go-ai\/neural-worker\.js'\)/);
  assert.match(runtimeSource, /new Worker\('\.\/go-ai\/destroyer-worker\.js'\)/);
  assert.match(runtimeSource, /return await chooseNeural\(state, seat\)/);
  assert.match(runtimeSource, /await chooseDestroyer\(state, seat\)/);
  assert.match(runtimeSource, /GoBot\.choose\(state, seat, 4\)/);
  assert.match(runtimeSource, /provider: 'classic-fallback'/);
  assert.match(runtimeSource, /katagoOnnx/);
  assert.match(runtimeSource, /queueBot = function/);
});

test('KataGo neural encoder emits v5 22-plane 19x19 tensors from current-player view', () => {
  const E = loadEncoder();
  const cells = Array(E.POINTS).fill('.');
  cells[72] = 'A';
  cells[73] = 'B';
  const board = cells.join('');
  const encoded = E.encode({ board, positionHistory: [board] }, 'B', 7.5);

  assert.deepEqual(Array.from(encoded.shape), [1, 22, 19, 19]);
  assert.deepEqual(Array.from(encoded.globalShape), [1, 19]);
  assert.equal(encoded.binInput.length, 22 * 19 * 19);
  assert.equal(encoded.globalInput.length, 19);
  assert.equal(encoded.binInput[0 * E.POINTS + 73], 1, 'current player B must be plane 0');
  assert.equal(encoded.binInput[1 * E.POINTS + 72], 1, 'opponent A must be plane 1');
  assert.equal(encoded.binInput[18 * E.POINTS + 180], 1, '19x19 size plane must be set');
  assert.equal(encoded.binInput[19 * E.POINTS + 180], 1, 'all-ones plane must be set');
  assert.equal(encoded.globalInput[0], 0.5, '7.5 komi must normalize to 0.5');
});

test('KataGo neural worker is lazy, single-threaded for GitHub Pages and tactically reranks policy', () => {
  assert.match(neuralWorkerSource, /onnxruntime-web@\$\{ORT_VERSION\}/);
  assert.match(neuralWorkerSource, /katago-b6c96\.onnx/);
  assert.match(neuralWorkerSource, /env\.wasm\.numThreads = 1/);
  assert.match(neuralWorkerSource, /InferenceSession\.create/);
  assert.match(neuralWorkerSource, /GoNeuralEncoder\.encode/);
  assert.match(neuralWorkerSource, /GoDestroyer\.evaluateMove/);
  assert.match(neuralWorkerSource, /rerankWithTactics/);
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

test('Go AI source files parse as browser scripts', () => {
  assert.doesNotThrow(() => new Function(coreSource));
  assert.doesNotThrow(() => new Function(workerSource));
  assert.doesNotThrow(() => new Function(encoderSource));
  assert.doesNotThrow(() => new Function(neuralWorkerSource));
  assert.doesNotThrow(() => new Function(runtimeSource));
});
