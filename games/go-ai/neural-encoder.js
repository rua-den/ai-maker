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

  function neighbors(idx) {
    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    const out = [];
    if (row > 0) out.push(idx - SIZE);
    if (row < SIZE - 1) out.push(idx + SIZE);
    if (col > 0) out.push(idx - 1);
    if (col < SIZE - 1) out.push(idx + 1);
    return out;
  }

  function collectGroup(board, start) {
    const color = board[start];
    if (color !== 'A' && color !== 'B') return { stones: [], liberties: [] };
    const seen = new Set([start]);
    const liberties = new Set();
    const stack = [start];
    while (stack.length) {
      const idx = stack.pop();
      for (const n of neighbors(idx)) {
        if (board[n] === '.') liberties.add(n);
        else if (board[n] === color && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return { stones: [...seen], liberties: [...liberties] };
  }

  function libertyCounts(board) {
    const counts = new Int16Array(POINTS);
    const visited = new Uint8Array(POINTS);
    for (let idx = 0; idx < POINTS; idx++) {
      if (visited[idx] || (board[idx] !== 'A' && board[idx] !== 'B')) continue;
      const group = collectGroup(board, idx);
      const count = group.liberties.length;
      for (const stone of group.stones) {
        visited[stone] = 1;
        counts[stone] = count;
      }
    }
    return counts;
  }

  function playWithoutSuperko(board, idx, seat) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= POINTS || board[idx] !== '.') return null;
    const cells = board.split('');
    cells[idx] = seat;
    const opponent = seat === 'A' ? 'B' : 'A';
    let next = cells.join('');
    const checked = new Set();
    for (const n of neighbors(idx)) {
      if (next[n] !== opponent || checked.has(n)) continue;
      const group = collectGroup(next, n);
      for (const stone of group.stones) checked.add(stone);
      if (!group.liberties.length) {
        const mutable = next.split('');
        for (const stone of group.stones) mutable[stone] = '.';
        next = mutable.join('');
      }
    }
    if (!collectGroup(next, idx).liberties.length) return null;
    return next;
  }

  function inferMoveHistory(state) {
    if (Array.isArray(state?.moveHistory) && state.moveHistory.length) {
      const cleaned = [];
      for (const item of state.moveHistory.slice(-64)) {
        const seat = item?.seat === 'A' ? 'A' : item?.seat === 'B' ? 'B' : null;
        if (!seat) continue;
        if (item?.pass === true) cleaned.push({ seat, pass: true, idx: -1 });
        else {
          const idx = Number(item?.idx);
          if (Number.isInteger(idx) && idx >= 0 && idx < POINTS) cleaned.push({ seat, pass: false, idx });
        }
      }
      return cleaned;
    }

    // Backward compatibility for rooms/states created before moveHistory existed.
    // Position history contains only stone moves, so old passes cannot be recovered.
    const positions = Array.isArray(state?.positionHistory)
      ? state.positionHistory.filter(v => typeof v === 'string' && v.length === POINTS)
      : [];
    const inferred = [];
    for (let i = 1; i < positions.length; i++) {
      const before = positions[i - 1];
      const after = positions[i];
      let added = -1;
      let seat = null;
      for (let idx = 0; idx < POINTS; idx++) {
        if (before[idx] !== after[idx] && after[idx] !== '.') {
          added = idx;
          seat = after[idx];
          break;
        }
      }
      if ((seat === 'A' || seat === 'B') && added >= 0) inferred.push({ seat, pass: false, idx: added });
    }
    return inferred;
  }

  function areaOwnership(board) {
    const owner = new Array(POINTS).fill(null);
    for (let idx = 0; idx < POINTS; idx++) {
      if (board[idx] === 'A' || board[idx] === 'B') owner[idx] = board[idx];
    }

    const visited = new Uint8Array(POINTS);
    for (let start = 0; start < POINTS; start++) {
      if (board[start] !== '.' || visited[start]) continue;
      const region = [];
      const border = new Set();
      const stack = [start];
      visited[start] = 1;
      while (stack.length) {
        const idx = stack.pop();
        region.push(idx);
        for (const n of neighbors(idx)) {
          if (board[n] === '.' && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          } else if (board[n] === 'A' || board[n] === 'B') {
            border.add(board[n]);
          }
        }
      }
      if (border.size === 1) {
        const color = [...border][0];
        for (const idx of region) owner[idx] = color;
      }
    }
    return owner;
  }

  function parityWave(selfKomi) {
    // 19x19 has odd area, so drawable area-scoring komis are odd integers.
    const komiFloor = Math.floor((selfKomi - 1) / 2) * 2 + 1;
    let delta = selfKomi - komiFloor;
    delta = Math.max(0, Math.min(2, delta));
    if (delta < 0.5) return delta;
    if (delta < 1.5) return 1 - delta;
    return delta - 2;
  }

  function encode(state, seat = 'B', komi = KOMI) {
    const current = seat === 'A' ? 'A' : 'B';
    const opponent = current === 'A' ? 'B' : 'A';
    const board = normalizeBoard(state?.board);
    const positionHistory = Array.isArray(state?.positionHistory)
      ? state.positionHistory.filter(value => typeof value === 'string' && value.length === POINTS)
      : [];
    const moveHistory = inferMoveHistory(state);
    const binInput = new Float32Array(PLANES * POINTS);
    const globalInput = new Float32Array(GLOBAL_FEATURES);
    const mask = new Float32Array(POINTS);
    mask.fill(1);

    const set = (plane, idx, value = 1) => { binInput[plane * POINTS + idx] = value; };

    // KataGo V7 spatial features 0-5.
    const libs = libertyCounts(board);
    for (let idx = 0; idx < POINTS; idx++) {
      set(0, idx); // on-board mask
      if (board[idx] === current) set(1, idx);
      else if (board[idx] === opponent) set(2, idx);

      if (board[idx] === 'A' || board[idx] === 'B') {
        if (libs[idx] === 1) set(3, idx);
        else if (libs[idx] === 2) set(4, idx);
        else if (libs[idx] === 3) set(5, idx);
      }
    }

    // Feature 6: positional-superko banned points. Suicide remains represented
    // only as illegal and is NOT marked as ko/superko.
    const seenBoards = new Set(positionHistory);
    for (let idx = 0; idx < POINTS; idx++) {
      if (board[idx] !== '.') continue;
      const next = playWithoutSuperko(board, idx, current);
      if (next && seenBoards.has(next)) set(6, idx);
    }

    // Features 7-8 are encore-only and stay zero under our Chinese/AGA area game.

    // Features 9-13 and globals 0-4: the last five moves/passes, newest first.
    let expectedSeat = opponent;
    for (let depth = 0; depth < 5; depth++) {
      const item = moveHistory[moveHistory.length - 1 - depth];
      if (!item || item.seat !== expectedSeat) break;
      if (item.pass) globalInput[depth] = 1;
      else set(9 + depth, item.idx);
      expectedSeat = expectedSeat === 'A' ? 'B' : 'A';
    }

    // Features 14-17 are KataGo's ladder-reader planes. We leave them neutral
    // rather than emit incorrect pseudo-ladder data; tactical correction happens
    // after policy inference in destroyer-core.
    //
    // Features 18-19: current area ownership from the side-to-move view.
    const ownership = areaOwnership(board);
    for (let idx = 0; idx < POINTS; idx++) {
      if (ownership[idx] === current) set(18, idx);
      else if (ownership[idx] === opponent) set(19, idx);
    }
    // Features 20-21 are second-encore starting stones and stay zero.

    // V7 globals for the exact rules used by this game:
    // positional superko, no suicide, area scoring, no tax, no encore/button.
    const whiteKomi = Number.isFinite(Number(komi)) ? Number(komi) : KOMI;
    const selfKomi = current === 'B' ? whiteKomi : -whiteKomi;
    globalInput[5] = selfKomi / 20;
    globalInput[6] = 1;
    globalInput[7] = 0.5;
    globalInput[14] = Number(state?.passes) >= 1 ? 1 : 0;
    globalInput[18] = parityWave(selfKomi);

    return {
      binInput,
      globalInput,
      mask,
      shape: [1, PLANES, SIZE, SIZE],
      globalShape: [1, GLOBAL_FEATURES, 1, 1],
      maskShape: [1, 1, SIZE, SIZE]
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
    rankPolicy,
    collectGroup,
    inferMoveHistory
  };
})();
