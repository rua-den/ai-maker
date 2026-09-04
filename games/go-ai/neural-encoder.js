(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const SIZE = 19;
  const POINTS = SIZE * SIZE;
  const PLANES = 22;
  const GLOBAL_FEATURES = 19;
  const KOMI = 7.5;

  function normalizeBoard(value) {
    return typeof value === 'string' && value.length === POINTS ? value : '.'.repeat(POINTS);
  }

  function encode(state, seat = 'B', komi = KOMI) {
    const current = seat === 'A' ? 'A' : 'B';
    const opponent = current === 'A' ? 'B' : 'A';
    const board = normalizeBoard(state?.board);
    const rawHistory = Array.isArray(state?.positionHistory)
      ? state.positionHistory.filter(value => typeof value === 'string' && value.length === POINTS)
      : [];
    const history = rawHistory.length ? rawHistory : [board];
    if (history[history.length - 1] !== board) history.push(board);

    const binInput = new Float32Array(PLANES * POINTS);
    const set = (plane, idx, value = 1) => { binInput[plane * POINTS + idx] = value; };

    for (let depth = 0; depth < 7; depth++) {
      const historyIndex = history.length - 1 - depth;
      const snapshot = historyIndex >= 0 ? history[historyIndex] : board;
      const ownPlane = depth * 2;
      const oppPlane = ownPlane + 1;
      for (let idx = 0; idx < POINTS; idx++) {
        if (snapshot[idx] === current) set(ownPlane, idx);
        else if (snapshot[idx] === opponent) set(oppPlane, idx);
      }
    }

    // KataGo v5 feature layout. For a full 19x19 board plane 18 marks the
    // supported board extent and plane 19 is the all-ones feature.
    for (let idx = 0; idx < POINTS; idx++) {
      set(18, idx);
      set(19, idx);
    }

    // Plane 14 (simple-ko) and plane 21 (superko) intentionally remain zero.
    // Legality is enforced by GoRules/Destroyer after inference, so feeding an
    // incorrect synthetic ko marker would be worse than omitting it.

    const globalInput = new Float32Array(GLOBAL_FEATURES);
    globalInput[0] = (Number(komi) || KOMI) / 15;

    return {
      binInput,
      globalInput,
      shape: [1, PLANES, SIZE, SIZE],
      globalShape: [1, GLOBAL_FEATURES]
    };
  }

  function rankPolicy(data) {
    const values = data instanceof Float32Array ? data : Float32Array.from(data || []);
    const count = Math.min(POINTS + 1, values.length);
    const ranked = [];
    for (let idx = 0; idx < count; idx++) {
      const value = Number(values[idx]);
      ranked.push({ idx, logit: Number.isFinite(value) ? value : -Infinity, pass: idx === POINTS });
    }
    ranked.sort((a, b) => b.logit - a.logit);
    return ranked;
  }

  root.GoNeuralEncoder = {
    SIZE,
    POINTS,
    PLANES,
    GLOBAL_FEATURES,
    KOMI,
    encode,
    rankPolicy
  };
})();
