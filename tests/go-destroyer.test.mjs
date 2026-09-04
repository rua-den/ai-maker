import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const botSource = fs.readFileSync(new URL('../games/go-bot.js', import.meta.url), 'utf8');
const rulesSource = fs.readFileSync(new URL('../games/go-rules.js', import.meta.url), 'utf8');
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

function loadRulesAndEncoder() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(rulesSource, context);
  vm.runInContext(encoderSource, context);
  return { rules: context.window.GoRules, encoder: context.GoNeuralEncoder };
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

test('Go rules persist real move history for KataGo V7 history planes', () => {
  const { rules: R } = loadRulesAndEncoder();
  let state = R.initialState();
  state = R.playStone(state, 72, 'A');
  state = R.playStone(state, 73, 'B');
  state = R.apply(state, { pass: true }, 'A').state;

  assert.deepEqual(
    Array.from(state.moveHistory, m => ({ seat: m.seat, pass: m.pass, idx: m.idx })),
    [
      { seat: 'A', pass: false, idx: 72 },
      { seat: 'B', pass: false, idx: 73 },
      { seat: 'A', pass: true, idx: -1 }
    ]
  );
  assert.equal(R.normalize(state).moveHistory.length, 3);
});

test('KataGo encoder matches V7 core feature semantics for 19x19 positional-superko area rules', () => {
  const { rules: R, encoder: E } = loadRulesAndEncoder();
  let state = R.initialState();
  state = R.playStone(state, 72, 'A');
  state = R.playStone(state, 73, 'B');

  const encoded = E.encode(state, 'A', 7.5);
  assert.deepEqual(Array.from(encoded.shape), [1, 22, 19, 19]);
  assert.deepEqual(Array.from(encoded.globalShape), [1, 19, 1, 1]);
  assert.deepEqual(Array.from(encoded.maskShape), [1, 1, 19, 19]);
  assert.equal(encoded.binInput.length, 22 * 19 * 19);
  assert.equal(encoded.globalInput.length, 19);
  assert.equal(encoded.mask.length, 19 * 19);

  assert.equal(encoded.binInput[0 * E.POINTS + 180], 1, 'V7 plane 0 is on-board mask');
  assert.equal(encoded.binInput[1 * E.POINTS + 72], 1, 'V7 plane 1 is current-player stones');
  assert.equal(encoded.binInput[2 * E.POINTS + 73], 1, 'V7 plane 2 is opponent stones');
  assert.equal(encoded.binInput[9 * E.POINTS + 73], 1, 'V7 plane 9 is opponent previous move');
  assert.equal(encoded.binInput[10 * E.POINTS + 72], 1, 'V7 plane 10 is own move two plies ago');

  assert.equal(encoded.globalInput[5], -7.5 / 20, 'black self-komi is -7.5 / 20');
  assert.equal(encoded.globalInput[6], 1, 'positional superko global bit');
  assert.equal(encoded.globalInput[7], 0.5, 'positional superko subtype');
  assert.equal(encoded.globalInput[18], -0.5, '19x19 area-scoring komi parity wave');

  const passed = R.apply(state, { pass: true }, 'A').state;
  const afterPass = E.encode(passed, 'B', 7.5);
  assert.equal(afterPass.globalInput[0], 1, 'most recent move was a pass');
  assert.equal(afterPass.globalInput[14], 1, 'another pass would end the phase');
});

test('KataGo neural worker feeds official ONNX contract and combines board/pass policy', () => {
  assert.match(neuralWorkerSource, /onnxruntime-web@\$\{ORT_VERSION\}/);
  assert.match(neuralWorkerSource, /const ORT_VERSION = '1\.28\.0'/);
  assert.match(neuralWorkerSource, /VERIFIED_LOCAL_MODEL = '\.\/models\/katago-b6c96\.onnx'/);
  assert.match(neuralWorkerSource, /env\.wasm\.numThreads = 1/);
  assert.match(neuralWorkerSource, /InferenceSession\.create/);
  assert.match(neuralWorkerSource, /InputSpatial/);
  assert.match(neuralWorkerSource, /InputGlobal/);
  assert.match(neuralWorkerSource, /InputMask/);
  assert.match(neuralWorkerSource, /OutputPolicyPass/);
  assert.match(neuralWorkerSource, /OutputPolicy/);
  assert.match(neuralWorkerSource, /encoded\.mask/);
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
    moveHistory: [],
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
