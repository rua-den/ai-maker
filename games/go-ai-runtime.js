(() => {
  'use strict';

  if (typeof window === 'undefined' || !window.GoBot || !window.GoRules) return;

  let worker = null;
  let requestSeq = 0;
  let generation = 0;
  const pending = new Map();
  let fallbackNoticeShown = false;

  function destroyWorker(reason = 'cancelled') {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error(reason));
    }
    pending.clear();
  }

  function ensureWorker() {
    if (worker) return worker;
    if (typeof Worker === 'undefined') throw new Error('Web Worker is not supported');
    worker = new Worker('./go-ai/destroyer-worker.js');
    worker.onmessage = event => {
      const message = event.data || {};
      const slot = pending.get(message.id);
      if (!slot) return;
      pending.delete(message.id);
      clearTimeout(slot.timer);
      if (message.type === 'result') slot.resolve({ move: message.move, diagnostics: message.diagnostics || null, provider: 'destroyer-worker' });
      else slot.reject(new Error(message.error || 'Destroyer worker failed'));
    };
    worker.onerror = event => {
      const message = event?.message || 'Destroyer worker crashed';
      destroyWorker(message);
    };
    return worker;
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
      try { active = ensureWorker(); } catch (error) { reject(error); return; }
      const id = ++requestSeq;
      const timeoutMs = Math.max(1800, workerBudget() * 3);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Destroyer worker timed out'));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      active.postMessage({
        type: 'choose',
        id,
        state,
        seat,
        options: { budgetMs: workerBudget(), rootMoves: 10 }
      });
    });
  }

  async function choose(state, seat = 'B', level = 2) {
    const n = Number(level) || 2;
    if (n < 5) return { move: GoBot.choose(state, seat, n), diagnostics: null, provider: 'classic' };
    try {
      return await chooseDestroyer(state, seat);
    } catch (error) {
      return {
        move: GoBot.choose(state, seat, 4),
        diagnostics: { fallback: true, error: error?.message || String(error || 'worker failed') },
        provider: 'classic-fallback'
      };
    }
  }

  window.GoAI = {
    choose,
    providers: {
      classic: { levels: [1, 2, 3, 4] },
      destroyer: { levels: [5], mode: 'worker', neuralReady: false }
    },
    reset() {
      generation++;
      destroyWorker('Go AI reset');
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

      if (result.provider === 'classic-fallback' && !fallbackNoticeShown) {
        fallbackNoticeShown = true;
        showNotice('☠️ Engine Hủy Diệt lỗi trên thiết bị này — đã fallback Siêu khó.');
      } else if (result.diagnostics && !result.diagnostics.fallback) {
        const nodes = Number(result.diagnostics.nodes) || 0;
        const ms = Math.round(Number(result.diagnostics.elapsedMs) || 0);
        if (nodes > 0) resultNote.textContent += ' · ☠️ đọc ' + nodes.toLocaleString('vi-VN') + ' nhánh / ' + ms + 'ms';
      }
    }, 70);
  };

  if (classicExitBot) {
    exitBot = function() {
      generation++;
      destroyWorker('Left Go bot game');
      return classicExitBot();
    };
  }
})();
