(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const SIZE = 19;
  const POINTS = SIZE * SIZE;
  const KOMI = 7.5;
  const STAR = [3, 9, 15].flatMap(r => [3, 9, 15].map(c => r * SIZE + c));
  const other = seat => seat === 'A' ? 'B' : 'A';
  const row = idx => Math.floor(idx / SIZE);
  const col = idx => idx % SIZE;
  const now = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const emptyBoard = () => '.'.repeat(POINTS);

  function normalize(state) {
    const board = typeof state?.board === 'string' && state.board.length === POINTS ? state.board : emptyBoard();
    const history = Array.isArray(state?.positionHistory)
      ? state.positionHistory.filter(v => typeof v === 'string' && v.length === POINTS)
      : [];
    if (!history.length) history.push(board);
    else if (history[history.length - 1] !== board) history.push(board);
    return {
      size: SIZE,
      board,
      previousBoard: typeof state?.previousBoard === 'string' && state.previousBoard.length === POINTS ? state.previousBoard : null,
      positionHistory: history,
      captures: {
        A: Math.max(0, Number(state?.captures?.A) || 0),
        B: Math.max(0, Number(state?.captures?.B) || 0)
      },
      passes: Math.max(0, Math.min(2, Number(state?.passes) || 0)),
      moveNo: Math.max(0, Number(state?.moveNo) || 0),
      last: Number.isInteger(state?.last) ? state.last : -1,
      lastAction: typeof state?.lastAction === 'string' ? state.lastAction : 'start',
      score: state?.score && typeof state.score === 'object' ? state.score : null
    };
  }

  function neighbors(idx) {
    const r = row(idx), c = col(idx);
    const out = [];
    if (r > 0) out.push(idx - SIZE);
    if (r < SIZE - 1) out.push(idx + SIZE);
    if (c > 0) out.push(idx - 1);
    if (c < SIZE - 1) out.push(idx + 1);
    return out;
  }

  function group(board, start) {
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

  function removeGroup(board, stones) {
    const cells = board.split('');
    for (const idx of stones) cells[idx] = '.';
    return cells.join('');
  }

  function playStone(state, idx, seat) {
    const s = normalize(state);
    if ((seat !== 'A' && seat !== 'B') || !Number.isInteger(idx) || idx < 0 || idx >= POINTS || s.board[idx] !== '.') return null;
    let board = s.board.slice(0, idx) + seat + s.board.slice(idx + 1);
    const opponent = other(seat);
    let captured = 0;
    const checked = new Set();
    for (const n of neighbors(idx)) {
      if (board[n] !== opponent || checked.has(n)) continue;
      const g = group(board, n);
      g.stones.forEach(stone => checked.add(stone));
      if (!g.liberties.length) {
        captured += g.stones.length;
        board = removeGroup(board, g.stones);
      }
    }
    const mine = group(board, idx);
    if (!mine.liberties.length) return null;
    if (s.positionHistory.includes(board)) return null;
    const captures = { ...s.captures };
    captures[seat] += captured;
    return {
      size: SIZE,
      board,
      previousBoard: s.board,
      positionHistory: [...s.positionHistory, board],
      captures,
      passes: 0,
      moveNo: s.moveNo + 1,
      last: idx,
      lastAction: 'play',
      score: null
    };
  }

  function areaScore(state) {
    const s = normalize(state);
    const visited = new Set();
    let stonesA = 0, stonesB = 0, territoryA = 0, territoryB = 0;
    for (const value of s.board) {
      if (value === 'A') stonesA++;
      else if (value === 'B') stonesB++;
    }
    for (let i = 0; i < POINTS; i++) {
      if (s.board[i] !== '.' || visited.has(i)) continue;
      const region = [];
      const border = new Set();
      const stack = [i];
      visited.add(i);
      while (stack.length) {
        const point = stack.pop();
        region.push(point);
        for (const n of neighbors(point)) {
          if (s.board[n] === '.' && !visited.has(n)) {
            visited.add(n);
            stack.push(n);
          } else if (s.board[n] === 'A' || s.board[n] === 'B') border.add(s.board[n]);
        }
      }
      if (border.size === 1) {
        if (border.has('A')) territoryA += region.length;
        else territoryB += region.length;
      }
    }
    return { black: stonesA + territoryA, white: stonesB + territoryB + KOMI };
  }

  function uniqueGroups(board, points, color) {
    const groups = [];
    const seen = new Set();
    for (const point of points) {
      if (board[point] !== color || seen.has(point)) continue;
      const g = group(board, point);
      g.stones.forEach(x => seen.add(x));
      groups.push(g);
    }
    return groups;
  }

  function openingScore(idx, moveNo) {
    const r = row(idx), c = col(idx);
    const edge = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
    let score = 0;
    if (moveNo < 70) {
      if (edge === 0) score -= 70;
      else if (edge === 1) score -= 28;
      else if (edge === 2) score += 5;
      else if (edge === 3) score += 26;
      else score += 8;
      let starDist = Infinity;
      for (const star of STAR) starDist = Math.min(starDist, Math.abs(row(star) - r) + Math.abs(col(star) - c));
      score += Math.max(0, 18 - starDist * 3);
    } else if (edge === 0) score -= 10;
    return score;
  }

  function localInfluence(board, idx, seat) {
    const opponent = other(seat);
    const r = row(idx), c = col(idx);
    let score = 0;
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const d = Math.abs(dr) + Math.abs(dc);
        if (d > 4) continue;
        const value = board[rr * SIZE + cc];
        const weight = d === 1 ? 11 : d === 2 ? 6 : d === 3 ? 3 : 1;
        if (value === opponent) score += weight;
        else if (value === seat) score += Math.max(1, weight - 3);
      }
    }
    return score;
  }

  function evaluateMove(state, idx, seat) {
    const s = normalize(state);
    const next = playStone(s, idx, seat);
    if (!next) return null;
    const opponent = other(seat);
    const near = neighbors(idx);
    const mineBefore = uniqueGroups(s.board, near, seat);
    const oppBefore = uniqueGroups(s.board, near, opponent);
    const mineAfter = group(next.board, idx);
    const captures = next.captures[seat] - s.captures[seat];
    let score = captures * 430 + openingScore(idx, s.moveNo) + localInfluence(s.board, idx, seat);

    score += Math.min(10, mineAfter.liberties.length) * 9;
    if (mineAfter.liberties.length === 1 && captures === 0) score -= 190;
    else if (mineAfter.liberties.length === 2) score -= 28;

    for (const g of mineBefore) {
      if (g.liberties.length === 1) score += 150 + g.stones.length * 9;
      else if (g.liberties.length === 2) score += 36 + g.stones.length * 2;
    }
    for (const g of oppBefore) {
      if (g.liberties.length === 1) score += 180 + g.stones.length * 12;
      else if (g.liberties.length === 2) score += 58 + g.stones.length * 4;
      else if (g.liberties.length === 3) score += 14;
    }

    const adjacent = near.map(n => s.board[n]);
    const ownAdjacent = adjacent.filter(v => v === seat).length;
    const oppAdjacent = adjacent.filter(v => v === opponent).length;
    const emptyAdjacent = adjacent.filter(v => v === '.').length;
    if (ownAdjacent >= 3 && oppAdjacent === 0 && emptyAdjacent <= 1 && captures === 0) score -= 85;

    return { move: { idx }, state: next, score, captures };
  }

  function candidateIndices(state) {
    const s = normalize(state);
    const occupied = [];
    for (let i = 0; i < POINTS; i++) if (s.board[i] !== '.') occupied.push(i);
    if (occupied.length < 8) return Array.from({ length: POINTS }, (_, i) => i).filter(i => s.board[i] === '.');

    const set = new Set(STAR.filter(i => s.board[i] === '.'));
    for (const point of occupied) {
      const pr = row(point), pc = col(point);
      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const dist = Math.abs(dr) + Math.abs(dc);
          if (dist < 1 || dist > 4) continue;
          const rr = pr + dr, cc = pc + dc;
          if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
          const idx = rr * SIZE + cc;
          if (s.board[idx] === '.') set.add(idx);
        }
      }
    }
    if (set.size < 42) for (let i = 0; i < POINTS; i++) if (s.board[i] === '.') set.add(i);
    return [...set];
  }

  function scoredMoves(state, seat, limit = Infinity) {
    const out = [];
    for (const idx of candidateIndices(state)) {
      const item = evaluateMove(state, idx, seat);
      if (item) out.push(item);
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }

  function scoreMargin(state, seat) {
    const score = areaScore(state);
    return seat === 'A' ? score.black - score.white : score.white - score.black;
  }

  function shouldPass(state, seat, moves) {
    const s = normalize(state);
    if (!moves.length) return true;
    if (s.moveNo < 100) return false;
    const best = moves[0];
    if (s.passes === 1 && (best.captures || 0) === 0 && best.score < 34) return true;
    if (s.moveNo >= 260 && (best.captures || 0) === 0 && best.score < 24) return true;
    return false;
  }

  function shouldResign(state, seat) {
    const s = normalize(state);
    if (s.moveNo < 220) return false;
    return scoreMargin(s, seat) < -85;
  }

  function choose(state, seat = 'B', options = {}) {
    const started = now();
    const budgetMs = Math.max(120, Math.min(5000, Number(options.budgetMs) || 1200));
    const deadline = started + budgetMs;
    const s = normalize(state);
    const roots = scoredMoves(s, seat, Math.max(4, Math.min(16, Number(options.rootMoves) || 10)));
    let nodes = roots.length;

    if (shouldResign(s, seat)) return { move: { resign: true }, diagnostics: { nodes, elapsedMs: now() - started, reason: 'resign' } };
    if (shouldPass(s, seat, roots)) return { move: { pass: true }, diagnostics: { nodes, elapsedMs: now() - started, reason: 'pass' } };
    if (!roots.length) return { move: { pass: true }, diagnostics: { nodes, elapsedMs: now() - started, reason: 'no-legal-move' } };

    const opponent = other(seat);
    const baseMargin = scoreMargin(s, seat);
    let best = roots[0];
    let bestValue = -Infinity;
    let completedRoots = 0;

    for (const rootMove of roots) {
      if (now() >= deadline && completedRoots > 0) break;
      const replies = scoredMoves(rootMove.state, opponent, 6);
      nodes += replies.length;
      let worstReplyValue = rootMove.score;

      if (replies.length) {
        worstReplyValue = Infinity;
        for (const reply of replies) {
          if (now() >= deadline && worstReplyValue < Infinity) break;
          const continuations = scoredMoves(reply.state, seat, 4);
          nodes += continuations.length;
          const continuation = continuations[0] || null;
          const leaf = continuation ? continuation.state : reply.state;
          const marginDelta = Math.max(-25, Math.min(25, scoreMargin(leaf, seat) - baseMargin));
          const value = rootMove.score
            - reply.score * 0.78
            + (continuation?.score || 0) * 0.52
            + marginDelta * 2.2;
          if (value < worstReplyValue) worstReplyValue = value;
        }
      }

      const value = rootMove.score * 0.42 + worstReplyValue * 0.58;
      if (value > bestValue) {
        bestValue = value;
        best = rootMove;
      }
      completedRoots++;
    }

    return {
      move: best.move,
      diagnostics: {
        nodes,
        completedRoots,
        elapsedMs: now() - started,
        value: bestValue,
        rootScore: best.score
      }
    };
  }

  root.GoDestroyer = {
    SIZE,
    POINTS,
    normalize,
    neighbors,
    group,
    playStone,
    areaScore,
    candidateIndices,
    evaluateMove,
    scoredMoves,
    scoreMargin,
    choose
  };
})();
