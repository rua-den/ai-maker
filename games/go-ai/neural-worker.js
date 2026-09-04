'use strict';

importScripts('./destroyer-core.js', './neural-encoder.js');

const ORT_VERSION = '1.29.0';
const ORT_BASE = new URL('./vendor/ort/', self.location.href).href;
const ORT_SCRIPT = new URL('ort.wasm.min.js', ORT_BASE).href;
const VERIFIED_LOCAL_MODEL = new URL('./models/katago-b6c96.onnx', self.location.href).href;
const DEFAULT_MODEL = VERIFIED_LOCAL_MODEL;

let sessionPromise = null;
let loadedModelUrl = null;

function opposite(seat) { return seat === 'A' ? 'B' : 'A'; }

function ensureOrt() {
  if (self.ort) return self.ort;
  importScripts(ORT_SCRIPT);
  if (!self.ort) throw new Error('ONNX Runtime Web failed to load');
  self.ort.env.wasm.wasmPaths = ORT_BASE;
  self.ort.env.wasm.numThreads = 1;
  self.ort.env.wasm.proxy = false;
  return self.ort;
}

function resolveModelUrl(modelUrl) {
  return new URL(modelUrl || DEFAULT_MODEL, self.location.href).href;
}

async function ensureSession(modelUrl = DEFAULT_MODEL) {
  const resolvedModelUrl = resolveModelUrl(modelUrl);
  if (!resolvedModelUrl) throw new Error('No verified KataGo ONNX model configured');
  if (sessionPromise && loadedModelUrl === resolvedModelUrl) return sessionPromise;
  const ort = ensureOrt();
  loadedModelUrl = resolvedModelUrl;
  sessionPromise = ort.InferenceSession.create(resolvedModelUrl, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  }).catch(error => {
    sessionPromise = null;
    loadedModelUrl = null;
    throw error;
  });
  return sessionPromise;
}

function inputName(session, exact, fallbackPattern) {
  const names = Array.isArray(session.inputNames) ? session.inputNames : [];
  return names.find(name => name === exact)
    || names.find(name => fallbackPattern.test(name))
    || null;
}

function extractBasePolicy(outputs) {
  const entries = Object.entries(outputs || {});
  const boardTensor = outputs?.OutputPolicy
    || entries.find(([name, tensor]) =>
      /policy/i.test(name)
      && !/pass/i.test(name)
      && tensor?.data
      && tensor.data.length >= self.GoNeuralEncoder.POINTS
    )?.[1];
  if (!boardTensor?.data) throw new Error('KataGo ONNX returned no board policy tensor');

  const passTensor = outputs?.OutputPolicyPass
    || entries.find(([name, tensor]) => /policy.*pass|pass.*policy/i.test(name) && tensor?.data)?.[1];

  const points = self.GoNeuralEncoder.POINTS;
  const policy = new Float32Array(points + 1);
  for (let idx = 0; idx < points; idx++) policy[idx] = Number(boardTensor.data[idx]) || 0;
  policy[points] = passTensor?.data?.length ? (Number(passTensor.data[0]) || 0) : -1e9;
  return policy;
}

function neuralCandidates(state, seat, policyData, limit = 14) {
  const ranked = self.GoNeuralEncoder.rankPolicy(policyData);
  const candidates = [];
  for (let rank = 0; rank < ranked.length && candidates.length < limit; rank++) {
    const item = ranked[rank];
    if (item.pass) {
      if ((Number(state?.moveNo) || 0) >= 100 || (Number(state?.passes) || 0) > 0) {
        candidates.push({ move: { pass: true }, rank, logit: item.logit, pass: true });
      }
      continue;
    }
    const evaluated = self.GoDestroyer.evaluateMove(state, item.idx, seat);
    if (!evaluated) continue;
    candidates.push({ ...item, rank, evaluated, move: { idx: item.idx } });
  }
  return candidates;
}

function rerankWithTactics(state, seat, candidates) {
  if (!candidates.length) return { move: { pass: true }, tacticalNodes: 0 };
  const opponent = opposite(seat);
  let tacticalNodes = 0;
  let best = null;
  let bestValue = -Infinity;

  for (const item of candidates) {
    if (item.pass) {
      const passValue = -item.rank * 18 - 80;
      if (passValue > bestValue) { bestValue = passValue; best = item; }
      continue;
    }
    const root = item.evaluated;
    const replies = self.GoDestroyer.scoredMoves(root.state, opponent, 4);
    tacticalNodes += 1 + replies.length;
    const replyThreat = replies.length ? replies[0].score : 0;

    const neuralPrior = Math.max(0, 16 - item.rank) * 34;
    const tactical = Math.max(-260, Math.min(520, root.score)) * 0.42;
    const defense = Math.max(0, Math.min(420, replyThreat)) * 0.24;
    const captureBonus = (root.captures || 0) * 95;
    const value = neuralPrior + tactical + captureBonus - defense;
    if (value > bestValue) {
      bestValue = value;
      best = item;
    }
  }

  return { move: best?.move || { pass: true }, tacticalNodes, value: bestValue };
}

async function choose(message) {
  const started = performance.now();
  const seat = message.seat === 'A' ? 'A' : 'B';
  const modelUrl = resolveModelUrl(message.modelUrl || DEFAULT_MODEL);
  const session = await ensureSession(modelUrl);
  const encoded = self.GoNeuralEncoder.encode(message.state, seat, 7.5);
  const ort = self.ort;

  const spatialName = inputName(session, 'InputSpatial', /spatial|bin|plane/i);
  const globalName = inputName(session, 'InputGlobal', /global/i);
  const maskName = inputName(session, 'InputMask', /mask/i);
  const metaName = inputName(session, 'InputMeta', /meta/i);
  if (!spatialName || !globalName || !maskName) {
    throw new Error('KataGo ONNX input contract mismatch');
  }
  if (metaName) {
    throw new Error('Human-style KataGo models with InputMeta are not supported');
  }

  const feeds = {};
  feeds[spatialName] = new ort.Tensor('float32', encoded.binInput, encoded.shape);
  feeds[globalName] = new ort.Tensor('float32', encoded.globalInput, encoded.globalShape);
  feeds[maskName] = new ort.Tensor('float32', encoded.mask, encoded.maskShape);

  const outputs = await session.run(feeds);
  const policy = extractBasePolicy(outputs);
  const candidates = neuralCandidates(message.state, seat, policy, 14);
  const selected = rerankWithTactics(message.state, seat, candidates);

  return {
    move: selected.move,
    diagnostics: {
      provider: 'katago-onnx',
      ortVersion: ORT_VERSION,
      model: modelUrl.split('/').pop(),
      neuralCandidates: candidates.length,
      tacticalNodes: selected.tacticalNodes,
      elapsedMs: performance.now() - started,
      value: selected.value
    }
  };
}

self.onmessage = async event => {
  const message = event.data || {};
  if (message.type !== 'choose') return;
  try {
    const result = await choose(message);
    self.postMessage({ type: 'result', id: message.id, ...result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: message.id,
      error: error?.message || String(error || 'KataGo ONNX worker failed')
    });
  }
};
