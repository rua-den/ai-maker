(() => {
  'use strict';

  const R = window.GoRules;
  if (!R) return;

  const LEVELS = {
    1: { key: 'easy', label: 'Dễ' },
    2: { key: 'medium', label: 'Vừa' },
    3: { key: 'hard', label: 'Khó' },
    4: { key: 'expert', label: 'Siêu khó' }
  };

  const SIZE = R.SIZE;
  const POINTS = R.POINTS;
  const other = seat => seat === 'A' ? 'B' : 'A';
  const row = idx => Math.floor(idx / SIZE);
  const col = idx => idx % SIZE;
  const pick = (items, rng = Math.random) => items.length ? items[Math.floor(rng() * items.length)] : null;
  const STAR = [3, 9, 15].flatMap(r => [3, 9, 15].map(c => r * SIZE + c));

  function uniqueGroups(board, points, color) {
    const groups = [];
    const seen = new Set();
    for (const p of points) {
      if (board[p] !== color || seen.has(p)) continue;
      const g = R.group(board, p);
      g.stones.forEach(x => seen.add(x));
      groups.push(g);
    }
    return groups;
  }

  function positionScore(idx, moveNo) {
    const r = row(idx), c = col(idx);
    const edge = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
    let score = 0;
    if (moveNo < 70) {
      if (edge === 0) score -= 42;
      else if (edge === 1) score -= 15;
      else if (edge === 2) score += 4;
      else if (edge === 3) score += 16;
      else score += 7;
      let starDist = Infinity;
      for (const s of STAR) starDist = Math.min(starDist, Math.abs(row(s) - r) + Math.abs(col(s) - c));
      score += Math.max(0, 10 - starDist * 2);
    } else {
      if (edge === 0) score -= 9;
      else if (edge === 1) score -= 2;
      else score += 2;
    }
    return score;
  }

  function evaluateMove(state, idx, seat) {
    const s = R.normalize(state);
    const next = R.playStone(s, idx, seat);
    if (!next) return null;

    const opp = other(seat);
    const beforeNeighbors = R.neighbors(idx);
    const mineBefore = uniqueGroups(s.board, beforeNeighbors, seat);
    const oppBefore = uniqueGroups(s.board, beforeNeighbors, opp);
    const mineAfter = R.group(next.board, idx);
    const captures = next.captures[seat] - s.captures[seat];
    let score = captures * 230 + positionScore(idx, s.moveNo);

    score += Math.min(8, mineAfter.liberties.length) * 7;
    if (mineAfter.liberties.length === 1 && captures === 0) score -= 105;
    else if (mineAfter.liberties.length === 2) score -= 12;

    for (const g of mineBefore) {
      if (g.liberties.length === 1) score += 58;
      else if (g.liberties.length === 2) score += 15;
    }
    for (const g of oppBefore) {
      if (g.liberties.length === 1) score += 86;
      else if (g.liberties.length === 2) score += 32;
      else if (g.liberties.length === 3) score += 8;
    }

    const r = row(idx), c = col(idx);
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      const d = Math.abs(dr) + Math.abs(dc);
      if (d > 3) continue;
      const v = s.board[rr * SIZE + cc];
      const weight = d === 1 ? 9 : d === 2 ? 4 : 2;
      if (v === opp) score += weight;
      else if (v === seat) score += Math.max(1, weight - 2);
    }

    return { move: { idx }, state: next, score };
  }

  function candidateIndices(state) {
    const s = R.normalize(state);
    const board = s.board;
    const occupied = [];
    for (let i = 0; i < POINTS; i++) if (board[i] !== '.') occupied.push(i);
    if (occupied.length < 6) return Array.from({ length: POINTS }, (_, i) => i).filter(i => board[i] === '.');

    const set = new Set(STAR.filter(i => board[i] === '.'));
    for (const p of occupied) {
      const pr = row(p), pc = col(p);
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
        const dist = Math.abs(dr) + Math.abs(dc);
        if (dist < 1 || dist > 4) continue;
        const rr = pr + dr, cc = pc + dc;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const idx = rr * SIZE + cc;
        if (board[idx] === '.') set.add(idx);
      }
    }
    if (set.size < 28) for (let i = 0; i < POINTS; i++) if (board[i] === '.') set.add(i);
    return [...set];
  }

  function scoredMoves(state, seat) {
    const out = [];
    for (const idx of candidateIndices(state)) {
      const item = evaluateMove(state, idx, seat);
      if (item) out.push(item);
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function shouldPass(state, seat, level) {
    const s = R.normalize(state);
    if (s.passes !== 1 || s.moveNo < 180) return false;
    const score = R.areaScore(s);
    const mine = seat === 'A' ? score.black : score.white;
    const theirs = seat === 'A' ? score.white : score.black;
    return mine - theirs >= (level >= 4 ? 3 : 7);
  }

  function choose(state, seat = 'B', level = 2, rng = Math.random) {
    const n = Math.max(1, Math.min(4, Number(level) || 2));
    const s = R.normalize(state);
    if (shouldPass(s, seat, n)) return { pass: true };

    const moves = scoredMoves(s, seat);
    if (!moves.length) return { pass: true };

    if (n === 1) {
      const pool = moves.slice(0, Math.min(80, moves.length));
      return pick(pool, rng)?.move || { pass: true };
    }

    if (n === 2) {
      const pool = moves.slice(0, Math.min(18, moves.length));
      const shifted = Math.max(0, pool[0].score - pool[pool.length - 1].score);
      if (shifted < 8) return pick(pool, rng)?.move || pool[0].move;
      const weights = pool.map((m, i) => Math.max(1, 24 - i * 1.25));
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = rng() * total;
      for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) return pool[i].move; }
      return pool[0].move;
    }

    if (n === 3) {
      const top = moves.slice(0, Math.min(7, moves.length));
      if (top.length > 2 && rng() < 0.08) return pick(top.slice(1), rng).move;
      return top[0].move;
    }

    const top = moves.slice(0, Math.min(10, moves.length));
    let best = top[0], bestValue = -Infinity;
    for (const item of top) {
      const replies = scoredMoves(item.state, other(seat)).slice(0, 8);
      const replyThreat = replies.length ? replies[0].score : 0;
      const value = item.score - replyThreat * 0.58;
      if (value > bestValue) { bestValue = value; best = item; }
    }
    return best.move;
  }

  window.GoBot = { LEVELS, candidateIndices, evaluateMove, choose };
})();
