(() => {
  'use strict';

  if (typeof window === 'undefined' || !window.GoBot || !window.GoRules) return;

  let destroyerWorker = null;
  let neuralWorker = null;
  let requestSeq = 0;
  let generation = 0;
  let neuralWarm = false;
  let neuralFailedForSession = false;
  const destroyerPending = new Map();
  const neuralPending = new Map();
  let fallbackNoticeShown = false;
  let neuralFallbackNoticeShown = false;

  function rejectPending(map, reason) {
    for (const { reject, timer } of map.values()) {
      clearTimeout(timer);
      reject(new Error(reason));
    }
    map.clear();
  }

  function destroyDestroyerWorker(reason = 'cancelled') {
    if (destroyerWorker) {
      destroyerWorker.terminate();
      destroyerWorker = null;
    }
    rejectPending(destroyerPending, reason);
  }

  function destroyNeuralWorker(reason = 'cancelled') {
    if (neuralWorker) {
      neuralWorker.terminate();
      neuralWorker = null;
    }
    rejectPending(neuralPending, reason);
  }

  function destroyWorkers(reason = 'cancelled') {
    destroyDestroyerWorker(reason);
    destroyNeuralWorker(reason);
  }

  function ensureDestroyerWorker() {
    if (destroyerWorker) return destroyerWorker;
    if (typeof Worker === 'undefined') throw new Error('Web Worker is not supported');
    destroyerWorker = new Worker('./go-ai/destroyer-worker.js');
    destroyerWorker.onmessage = event => {
      const message = event.data || {};
      const slot = destroyerPending.get(message.id);
      if (!slot) return;
      destroyerPending.delete(message.id);
      clearTimeout(slot.timer);
      if (message.type === 'result') slot.resolve({ move: message.move, diagnostics: message.diagnostics || null, provider: 'destroyer-worker' });
      else slot.reject(new Error(message.error || 'Destroyer worker failed'));
    };
    destroyerWorker.onerror = event => {
      destroyDestroyerWorker(event?.message || 'Destroyer worker crashed');
    };
    return destroyerWorker;
  }

  function ensureNeuralWorker() {
    if (neuralWorker) return neuralWorker;
    if (window.GO_AI_DISABLE_NEURAL === true) throw new Error('Neural provider disabled');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Offline');
    if (neuralFailedForSession) throw new Error('Neural provider disabled after previous failure');
    if (typeof Worker === 'undefined') throw new Error('Web Worker is not supported');

    neuralWorker = new Worker('./go-ai/neural-worker.js');
    neuralWorker.onmessage = event => {
      const message = event.data || {};
      const slot = neuralPending.get(message.id);
      if (!slot) return;
      neuralPending.delete(message.id);
      clearTimeout(slot.timer);
      if (message.type === 'result') {
        neuralWarm = true;
        slot.resolve({ move: message.move, diagnostics: message.diagnostics || null, provider: 'katago-onnx' });
      } else {
        neuralFailedForSession = true;
        slot.reject(new Error(message.error || 'KataGo ONNX worker failed'));
        destroyNeuralWorker(message.error || 'KataGo ONNX worker failed');
      }
    };
    neuralWorker.onerror = event => {
      neuralFailedForSession = true;
      destroyNeuralWorker(event?.message || 'KataGo ONNX worker crashed');
    };
    return neuralWorker;
  }

  function workerBudget() {
    const cores = Math.max(1, Number(navigator.hardwareConcurrency) || 2);
    const memory = Math.max(0, Number(navigator.deviceMemory) || 0);
    if (memory && memory <= 2) return 520;
    if (cores <= 2) return 650;
    if (memory && memory <= 4) return 850;
    return 1250;
  }

  function chooseDestroyer(state, seat) {
    return new Promise((resolve, reject) => {
      let active;
      try { active = ensureDestroyerWorker(); } catch (error) { reject(error); return; }
      const id = ++requestSeq;
      const timeoutMs = Math.max(1800, workerBudget() * 3);
      const timer = setTimeout(() => {
        destroyerPending.delete(id);
        reject(new Error('Destroyer worker timed out'));
      }, timeoutMs);
      destroyerPending.set(id, { resolve, reject, timer });
      active.postMessage({
        type: 'choose',
        id,
        state,
        seat,
        options: { budgetMs: workerBudget(), rootMoves: 10 }
      });
    });
  }

  function chooseNeural(state, seat) {
    return new Promise((resolve, reject) => {
      let active;
      try { active = ensureNeuralWorker(); } catch (error) { reject(error); return; }
      const id = ++requestSeq;
      const timeoutMs = neuralWarm ? 8000 : 22000;
      const timer = setTimeout(() => {
        neuralPending.delete(id);
        neuralFailedForSession = true;
        destroyNeuralWorker('KataGo ONNX timed out');
        reject(new Error('KataGo ONNX timed out'));
      }, timeoutMs);
      neuralPending.set(id, { resolve, reject, timer });
      active.postMessage({
        type: 'choose',
        id,
        state,
        seat,
        modelUrl: typeof window.GO_AI_MODEL_URL === 'string' ? window.GO_AI_MODEL_URL : undefined
      });
    });
  }

  async function choose(state, seat = 'B', level = 2) {
    const n = Number(level) || 2;
    if (n < 5) return { move: GoBot.choose(state, seat, n), diagnostics: null, provider: 'classic' };

    let neuralError = null;
    try {
      return await chooseNeural(state, seat);
    } catch (error) {
      neuralError = error;
    }

    try {
      const local = await chooseDestroyer(state, seat);
      local.diagnostics = {
        ...(local.diagnostics || {}),
        neuralFallback: true,
        neuralError: neuralError?.message || String(neuralError || 'neural unavailable')
      };
      return local;
    } catch (error) {
      return {
        move: GoBot.choose(state, seat, 4),
        diagnostics: {
          fallback: true,
          neuralError: neuralError?.message || String(neuralError || 'neural unavailable'),
          error: error?.message || String(error || 'worker failed')
        },
        provider: 'classic-fallback'
      };
    }
  }

  window.GoAI = {
    choose,
    providers: {
      classic: { levels: [1, 2, 3, 4] },
      katagoOnnx: { levels: [5], mode: 'lazy-worker', model: 'b6c96', runtime: 'onnxruntime-web' },
      destroyer: { levels: [5], mode: 'worker-fallback' }
    },
    reset() {
      generation++;
      neuralWarm = false;
      neuralFailedForSession = false;
      destroyWorkers('Go AI reset');
    }
  };

  if (typeof queueBot !== 'function' || typeof renderBot !== 'function') return;
  const classicQueueBot = queueBot;
  const classicExitBot = typeof exitBot === 'function' ? exitBot : null;

  queueBot = function() {
    const level = Number(botDifficulty.value) || 2;
    if (level < 5) return classicQueueBot();
    if (!botActive || botWinner || botTurn !== 'B') return;

    stopBotTimer();
    botThinking = true;
    renderBot();
    resultNote.textContent = neuralFailedForSession || window.GO_AI_DISABLE_NEURAL === true
      ? '☠️ Hủy Diệt đang đọc chiến thuật trong Worker…'
      : '🧠 Hủy Diệt đang chạy KataGo neural policy… lần đầu có thể cần tải model.';
    const token = ++generation;
    const snapshot = GoRules.normalize(botState);

    botTimer = setTimeout(async () => {
      botTimer = null;
      const result = await window.GoAI.choose(snapshot, 'B', level);
      if (token !== generation || !botActive || botWinner || botTurn !== 'B') return;

      botThinking = false;
      let move = result.move;
      let applied = GoRules.apply(botState, move, 'B');
      if (!applied && result.provider !== 'classic-fallback') {
        try {
          const local = await chooseDestroyer(botState, 'B');
          move = local.move;
          applied = GoRules.apply(botState, move, 'B');
        } catch (_) {}
      }
      if (!applied) {
        move = GoBot.choose(botState, 'B', 4);
        applied = GoRules.apply(botState, move, 'B');
      }
      if (!applied) {
        botTurn = 'A';
        renderBot();
        return;
      }

      botState = applied.state;
      if (applied.winner) {
        botWinner = applied.winner;
        botTurn = '';
        renderBot();
        return;
      }
      botTurn = applied.nextTurn || 'A';
      renderBot();

      const ms = Math.round(Number(result.diagnostics?.elapsedMs) || 0);
      if (result.provider === 'katago-onnx') {
        const candidates = Number(result.diagnostics?.neuralCandidates) || 0;
        resultNote.textContent += ' · 🧠 KataGo NN ' + candidates + ' ứng viên / ' + ms + 'ms';
      } else if (result.provider === 'destroyer-worker') {
        const nodes = Number(result.diagnostics?.nodes) || 0;
        if (nodes > 0) resultNote.textContent += ' · ☠️ đọc ' + nodes.toLocaleString('vi-VN') + ' nhánh / ' + ms + 'ms';
        if (result.diagnostics?.neuralFallback && !neuralFallbackNoticeShown) {
          neuralFallbackNoticeShown = true;
          showNotice('🧠 Neural không tải được — Hủy Diệt đang dùng engine local mạnh hơn Siêu khó.');
        }
      } else if (result.provider === 'classic-fallback' && !fallbackNoticeShown) {
        fallbackNoticeShown = true;
        showNotice('☠️ Engine Hủy Diệt lỗi trên thiết bị này — đã fallback Siêu khó.');
      }
    }, 70);
  };

  if (classicExitBot) {
    exitBot = function() {
      generation++;
      destroyWorkers('Left Go bot game');
      return classicExitBot();
    };
  }
})();
