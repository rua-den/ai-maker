(() => {
  'use strict';

  const R = typeof window !== 'undefined' ? window.ThreeKingdomsXiangqi : globalThis.ThreeKingdomsXiangqi;
  if (!R) throw new Error('ThreeKingdomsXiangqi core is required before bot');

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function moveCaptureValue(state, move) {
    const target = state.pieces.find(p => R.key(p.sector, p.r, p.f) === move.to);
    return target ? (R.VALUES[target.type] || 0) : 0;
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

  function immediateScore(state, move, controller) {
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

  function opponentReplyPenalty(after, controller, budgetEnd) {
    if (performance.now() >= budgetEnd || after.winner != null) return 0;
    const opponent = after.turn;
    if (opponent === controller || !after.alive[opponent]) return 0;
    const replies = R.legalMoves(after, opponent);
    if (!replies.length) return 0;
    const ranked = replies
      .map(move => ({ move, capture: moveCaptureValue(after, move) }))
      .sort((a, b) => b.capture - a.capture)
      .slice(0, 10);
    let worst = 0;
    for (const item of ranked) {
      if (performance.now() >= budgetEnd) break;
      const reply = R.makeMove(after, item.move);
      if (!reply.ok) continue;
      if (reply.state.winner === opponent) return 1000000;
      const swing = Math.max(0, evaluate(after, controller) - evaluate(reply.state, controller));
      worst = Math.max(worst, swing + item.capture * 0.9);
    }
    return worst;
  }

  function choose(state, controller = state.turn, difficulty = 'hard') {
    const moves = R.legalMoves(state, controller);
    if (!moves.length) return null;
    const level = difficulty === 'easy' ? 'easy' : difficulty === 'destroyer' ? 'destroyer' : 'hard';
    const budgetMs = level === 'destroyer' ? 520 : level === 'hard' ? 230 : 70;
    const budgetEnd = performance.now() + budgetMs;

    let candidates = moves.map(move => {
      const base = immediateScore(state, move, controller);
      if (!base) return null;
      const capture = moveCaptureValue(state, move);
      return { ...base, capture };
    }).filter(Boolean);

    candidates.sort((a, b) => b.score - a.score);
    if (level === 'easy') {
      const pool = candidates.slice(0, Math.min(8, candidates.length));
      return pool[Math.floor(Math.random() * pool.length)]?.move || candidates[0].move;
    }

    const searchCount = Math.min(level === 'destroyer' ? 24 : 14, candidates.length);
    let best = candidates[0];
    let bestScore = -Infinity;
    for (let i = 0; i < searchCount; i++) {
      if (performance.now() >= budgetEnd) break;
      const candidate = candidates[i];
      let score = candidate.score;
      const penalty = opponentReplyPenalty(candidate.state, controller, budgetEnd);
      score -= penalty * (level === 'destroyer' ? 0.76 : 0.57);
      score += (Math.random() - 0.5) * (level === 'destroyer' ? 1 : 7);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best?.move || candidates[0].move;
  }

  const api = { choose, evaluate };
  if (typeof window !== 'undefined') window.ThreeKingdomsBot = api;
  if (typeof globalThis !== 'undefined') globalThis.ThreeKingdomsBot = api;
})();
