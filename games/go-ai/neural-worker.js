'use strict';

importScripts('./destroyer-core.js', './neural-encoder.js');

const ORT_VERSION = '1.29.0';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const ORT_SCRIPT = ORT_BASE + 'ort.min.js';
// Never silently fall back to a third-party/random-weight model. A real model
// must be explicitly configured by the runtime until the verified local asset
// games/go-ai/models/katago-b6c96.onnx is committed.
const DEFAULT_MODEL = null;
const VERIFIED_LOCAL_MODEL = './models/katago-b6c96.onnx';

let sessionPromise = null;
let loadedModelUrl = null;

function opposite(seat) { return seat === 'A' ? 'B' : 'A'; }

function ensureOrt() {
  if (self.ort) return self.ort;
  importScripts(ORT_SCRIPT);
  if (!self.ort) throw new Error('ONNX Runtime Web failed to load');
  self.ort.env.wasm.wasmPaths = ORT_BASE;
  // GitHub Pages cannot opt into cross-origin isolation headers, so force a
  // single WASM thread. The neural work already runs off the UI thread here.
  self.ort.env.wasm.numThreads = 1;
  self.ort.env.wasm.proxy = false;
  return self.ort;
}

async function ensureSession(modelUrl = DEFAULT_MODEL) {
  if (!modelUrl) throw new Error('No verified KataGo ONNX model configured');
  if (sessionPromise && loadedModelUrl === modelUrl) return sessionPromise;
  const ort = ensureOrt();
  loadedModelUrl = modelUrl;
  sessionPromise = ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  }).catch(error => {
    sessionPromise = null;
    loadedModelUrl = null;
    throw error;
  });
  return sessionPromise;
}

function findInputName(session, kind) {
  const names = Array.isArray(session.inputNames) ? session.inputNames : [];
  if (kind === 'global') return names.find(name => /global/i.test(name)) || names[1] || 'global_input';
  return names.find(name => /bin|spatial|plane/i.test(name)) || names[0] || 'bin_input_global_ncplane';
}

function findPolicyTensor(outputs) {
  const entries = Object.entries(outputs || {});
  const named = entries.find(([name]) => /policy/i.test(name));
  if (named?.[1]) return named[1];
  const compatible = entries.find(([, tensor]) => tensor?.data && tensor.data.length >= self.GoNeuralEncoder.POINTS + 1);
  return compatible?.[1] || entries[0]?.[1] || null;
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

    // Neural rank remains the primary signal. The local tactical reader only
    // corrects obvious captures, rescues and one-ply tactical disasters.
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
  const modelUrl = message.modelUrl || DEFAULT_MODEL;
  const session = await ensureSession(modelUrl);
  const encoded = self.GoNeuralEncoder.encode(message.state, seat, 7.5);
  const ort = self.ort;
  const binName = findInputName(session, 'bin');
  const globalName = findInputName(session, 'global');
  const feeds = {};
  feeds[binName] = new ort.Tensor('float32', encoded.binInput, encoded.shape);
  feeds[globalName] = new ort.Tensor('float32', encoded.globalInput, encoded.globalShape);

  const outputs = await session.run(feeds);
  const policyTensor = findPolicyTensor(outputs);
  if (!policyTensor?.data) throw new Error('KataGo ONNX model returned no policy tensor');

  const candidates = neuralCandidates(message.state, seat, policyTensor.data, 14);
  const selected = rerankWithTactics(message.state, seat, candidates);
  return {
    move: selected.move,
    diagnostics: {
      provider: 'katago-onnx',
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
