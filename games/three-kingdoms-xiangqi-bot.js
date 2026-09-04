(() => {
  'use strict';

  const R = typeof window !== 'undefined' ? window.ThreeKingdomsXiangqi : globalThis.ThreeKingdomsXiangqi;
  if (!R) throw new Error('ThreeKingdomsXiangqi core is required before bot');

  function moveCaptureValue(state, move) {
    const target = state.pieces.find(p => R.key(p.sector, p.r, p.f) === move.to);
    return target ? (R.VALUES[target.type] || 0) : 0;
  }

  function moveTarget(move) {
    const [sector, r, f] = String(move.to).split(':').map(Number);
    return { sector, r, f };
  }

  function positionalScore(state, controller) {
    let score = 0;
    for (const piece of state.pieces) {
      if (piece.controller !== controller) continue;
      const value = R.VALUES[piece.type] || 0;
      if (piece.type === 'P') {
        score += piece.sector === piece.home ? piece.r * 13 : 95 + (4 - piece.r) * 16;
      } else if (piece.type === 'R' || piece.type === 'C' || piece.type === 'H' || piece.type === 'X') {
        score += piece.r * Math.min(24, value * 0.025);
      }
    }
    return score;
  }

  function evaluate(state, controller) {
    if (!state.alive[controller]) return -1e9;
    if (state.winner === controller) return 1e9;
    if (state.winner != null) return -1e9;
    let score = R.material(state, controller) + positionalScore(state, controller);
    for (let enemy = 0; enemy < 3; enemy++) {
      if (enemy === controller || !state.alive[enemy]) continue;
      if (R.isInCheck(state, enemy)) score += 280;
    }
    score += state.alive.filter(Boolean).length === 2 ? 120 : 0;
    return score;
  }

  // Cheap ordering matters on mobile: score all legal moves without recursively
  // resolving every opponent checkmate, then deeply inspect only a tiny shortlist.
  function cheapMoveScore(state, move, controller) {
    const piece = state.pieces.find(p => p.id === move.pieceId);
    if (!piece) return -Infinity;
    const target = state.pieces.find(p => R.key(p.sector, p.r, p.f) === move.to) || null;
    const to = moveTarget(move);
    const capture = target ? (R.VALUES[target.type] || 0) : 0;
    let score = capture * 3.8;

    if (target?.type === 'K') score += 1e8;
    if (target?.controller != null && target.controller !== controller) score += 85;

    const crossed = to.sector !== piece.home;
    if (piece.type === 'P') {
      score += crossed ? 145 + (4 - to.r) * 24 : to.r * 18;
    } else if (piece.type === 'R') {
      score += crossed ? 82 : to.r * 7;
    } else if (piece.type === 'C') {
      score += crossed ? 65 : to.r * 8;
    } else if (piece.type === 'H' || piece.type === 'X') {
      score += crossed ? 58 : to.r * 9;
    } else if (piece.type === 'K') {
      score -= capture ? 0 : 24;
    }

    score += Math.max(0, 4 - Math.abs(4 - to.f)) * 3;
    return score;
  }

  function deepScore(state, move, controller) {
    const capture = moveCaptureValue(state, move);
    const result = R.makeMove(state, move);
    if (!result.ok) return null;
    const after = result.state;
    let score = evaluate(after, controller);
    score += capture * 1.5;
    if (capture >= R.VALUES.K) score += 2e8;
    if (after.eliminated.length > state.eliminated.length) score += 18000;
    if (after.lastMove?.captured?.type === 'K') score += 50000;
    return { move, state: after, score };
  }

  function bestReplyPenalty(after, controller, maxReplies, budgetEnd) {
    if (performance.now() >= budgetEnd || after.winner != null) return 0;
    const opponent = after.turn;
    if (opponent === controller || !after.alive[opponent]) return 0;
    const replies = R.legalMoves(after, opponent)
      .map(move => ({ move, score: cheapMoveScore(after, move, opponent) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxReplies);
    let worst = 0;
    for (const item of replies) {
      if (performance.now() >= budgetEnd) break;
      const reply = R.makeMove(after, item.move);
      if (!reply.ok) continue;
      if (reply.state.winner === opponent) return 1000000;
      const capture = moveCaptureValue(after, item.move);
      const swing = Math.max(0, evaluate(after, controller) - evaluate(reply.state, controller));
      worst = Math.max(worst, swing + capture * 0.9);
    }
    return worst;
  }

  function choose(state, controller = state.turn, difficulty = 'hard') {
    const started = performance.now();
    const moves = R.legalMoves(state, controller);
    if (!moves.length) return null;
    const level = difficulty === 'easy' ? 'easy' : difficulty === 'destroyer' ? 'destroyer' : 'hard';

    const ordered = moves
      .map(move => ({ move, cheap: cheapMoveScore(state, move, controller), capture: moveCaptureValue(state, move) }))
      .sort((a, b) => b.cheap - a.cheap);

    if (level === 'easy') {
      const captures = ordered.filter(item => item.capture > 0);
      const pool = (captures.length ? captures : ordered).slice(0, Math.min(captures.length ? 4 : 10, ordered.length));
      return pool[Math.floor(Math.random() * pool.length)]?.move || ordered[0].move;
    }

    const budgetMs = level === 'destroyer' ? 700 : 330;
    const budgetEnd = started + budgetMs;
    const deepCount = Math.min(level === 'destroyer' ? 5 : 3, ordered.length);
    const candidates = [];

    for (let i = 0; i < deepCount; i++) {
      if (i > 0 && performance.now() >= budgetEnd) break;
      const deep = deepScore(state, ordered[i].move, controller);
      if (deep) candidates.push({ ...deep, cheap: ordered[i].cheap });
    }

    if (!candidates.length) return ordered[0].move;

    let best = candidates[0];
    let bestValue = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let value = candidate.score + candidate.cheap * 0.32;
      if (level === 'destroyer' && i < 2 && performance.now() < budgetEnd) {
        value -= bestReplyPenalty(candidate.state, controller, 2, budgetEnd) * 0.68;
      }
      value += (Math.random() - 0.5) * (level === 'destroyer' ? 1 : 5);
      if (value > bestValue) {
        bestValue = value;
        best = candidate;
      }
    }
    return best.move;
  }

  const api = { choose, evaluate, cheapMoveScore };
  if (typeof window !== 'undefined') window.ThreeKingdomsBot = api;
  if (typeof globalThis !== 'undefined') globalThis.ThreeKingdomsBot = api;
})();
