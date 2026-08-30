(() => {
  'use strict';

  const LEVELS = {
    1: { key: 'easy', label: 'Dễ' },
    2: { key: 'medium', label: 'Vừa' },
    3: { key: 'hard', label: 'Khó' },
    4: { key: 'expert', label: 'Siêu khó' }
  };

  const other = seat => seat === 'A' ? 'B' : 'A';
  const pick = (items, rng = Math.random) => items.length ? items[Math.floor(rng() * items.length)] : null;

  function terminalScore(result, bot, depth) {
    if (!result || !result.winner) return null;
    if (result.winner === 'draw') return 0;
    return result.winner === bot ? 100000 + depth : -100000 - depth;
  }

  // ---------- Tic Tac Toe ----------
  function tttMoves(state) {
    const board = String(state?.board || '.'.repeat(9));
    const out = [];
    for (let i = 0; i < 9; i++) if (board[i] === '.') out.push({ idx: i });
    return out;
  }

  function tttImmediate(state, seat, rules) {
    for (const move of tttMoves(state)) {
      const result = rules.apply(state, move, seat);
      if (result?.winner === seat) return move;
    }
    return null;
  }

  function tttMinimax(state, turn, bot, rules, depth, maxDepth, alpha, beta) {
    const moves = tttMoves(state);
    if (!moves.length || depth >= maxDepth) return 0;
    const maximizing = turn === bot;
    let best = maximizing ? -Infinity : Infinity;
    const ordered = moves.sort((a, b) => {
      const rank = i => i === 4 ? 0 : [0,2,6,8].includes(i) ? 1 : 2;
      return rank(a.idx) - rank(b.idx);
    });
    for (const move of ordered) {
      const result = rules.apply(state, move, turn);
      const terminal = terminalScore(result, bot, maxDepth - depth);
      const score = terminal == null
        ? tttMinimax(result.state, other(turn), bot, rules, depth + 1, maxDepth, alpha, beta)
        : terminal;
      if (maximizing) {
        best = Math.max(best, score); alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score); beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseTtt(state, seat, level, rng, rules) {
    const moves = tttMoves(state);
    if (!moves.length) return null;
    if (level <= 1) return pick(moves, rng);
    const win = tttImmediate(state, seat, rules);
    if (win) return win;
    const block = tttImmediate(state, other(seat), rules);
    if (block) return block;
    if (level === 2) {
      const preferred = moves.filter(m => m.idx === 4 || [0,2,6,8].includes(m.idx));
      return pick(preferred.length ? preferred : moves, rng);
    }
    const maxDepth = level >= 4 ? 9 : 5;
    let bestScore = -Infinity, bestMoves = [];
    for (const move of moves) {
      const result = rules.apply(state, move, seat);
      const terminal = terminalScore(result, seat, maxDepth);
      const score = terminal == null
        ? tttMinimax(result.state, other(seat), seat, rules, 1, maxDepth, -Infinity, Infinity)
        : terminal;
      if (score > bestScore) { bestScore = score; bestMoves = [move]; }
      else if (score === bestScore) bestMoves.push(move);
    }
    if (level === 3 && moves.length > 2 && rng() < 0.14) return pick(moves, rng);
    return pick(bestMoves, rng);
  }

  // ---------- Connect Four ----------
  function c4Moves(state, rules) {
    const board = String(state?.board || rules.empty());
    const cols = [3,2,4,1,5,0,6];
    return cols.filter(col => board[col] === '.').map(col => ({ col }));
  }

  function c4Immediate(state, seat, rules) {
    for (const move of c4Moves(state, rules)) {
      const result = rules.apply(state, move, seat);
      if (result?.winner === seat) return move;
    }
    return null;
  }

  function c4Heuristic(board, bot) {
    const opp = other(bot), rows = 6, cols = 7;
    let score = 0;
    for (let r = 0; r < rows; r++) if (board[r * cols + 3] === bot) score += 7;
    const windows = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols - 4; c++) windows.push([r*cols+c,r*cols+c+1,r*cols+c+2,r*cols+c+3]);
    for (let r = 0; r <= rows - 4; r++) for (let c = 0; c < cols; c++) windows.push([r*cols+c,(r+1)*cols+c,(r+2)*cols+c,(r+3)*cols+c]);
    for (let r = 0; r <= rows - 4; r++) for (let c = 0; c <= cols - 4; c++) windows.push([r*cols+c,(r+1)*cols+c+1,(r+2)*cols+c+2,(r+3)*cols+c+3]);
    for (let r = 3; r < rows; r++) for (let c = 0; c <= cols - 4; c++) windows.push([r*cols+c,(r-1)*cols+c+1,(r-2)*cols+c+2,(r-3)*cols+c+3]);
    for (const w of windows) {
      let mine = 0, theirs = 0, empty = 0;
      for (const i of w) {
        if (board[i] === bot) mine++; else if (board[i] === opp) theirs++; else empty++;
      }
      if (mine === 4) score += 100000;
      else if (mine === 3 && empty === 1) score += 110;
      else if (mine === 2 && empty === 2) score += 18;
      if (theirs === 4) score -= 100000;
      else if (theirs === 3 && empty === 1) score -= 130;
      else if (theirs === 2 && empty === 2) score -= 16;
    }
    return score;
  }

  function c4Search(state, turn, bot, rules, depth, alpha, beta) {
    const moves = c4Moves(state, rules);
    if (!moves.length || depth <= 0) return c4Heuristic(String(state.board), bot);
    const maximizing = turn === bot;
    let best = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
      const result = rules.apply(state, move, turn);
      const terminal = terminalScore(result, bot, depth);
      const score = terminal == null ? c4Search(result.state, other(turn), bot, rules, depth - 1, alpha, beta) : terminal;
      if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
      else { best = Math.min(best, score); beta = Math.min(beta, best); }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseConnect4(state, seat, level, rng, rules) {
    const moves = c4Moves(state, rules);
    if (!moves.length) return null;
    if (level <= 1) return pick(moves, rng);
    const win = c4Immediate(state, seat, rules);
    if (win) return win;
    const block = c4Immediate(state, other(seat), rules);
    if (block) return block;
    if (level === 2) {
      const weights = moves.map(m => ({ move: m, score: 8 - Math.abs(3 - m.col) * 2 + rng() }));
      weights.sort((a,b) => b.score - a.score);
      return weights[0].move;
    }
    const depth = level >= 4 ? 5 : 3;
    let bestScore = -Infinity, bestMoves = [];
    for (const move of moves) {
      const result = rules.apply(state, move, seat);
      const terminal = terminalScore(result, seat, depth);
      const score = terminal == null ? c4Search(result.state, other(seat), seat, rules, depth - 1, -Infinity, Infinity) : terminal;
      if (score > bestScore) { bestScore = score; bestMoves = [move]; }
      else if (score === bestScore) bestMoves.push(move);
    }
    if (level === 3 && moves.length > 3 && rng() < 0.08) return pick(moves, rng);
    return pick(bestMoves, rng);
  }

  // ---------- Reversi ----------
  function revMoves(state, seat, rules) {
    const board = String(state?.board || rules.empty());
    return rules.legalMoves(board, seat).map(idx => ({ idx }));
  }

  function revEval(board, bot, rules) {
    const opp = other(bot);
    const corners = [0,7,56,63];
    const danger = [1,6,8,9,14,15,48,49,54,55,57,62];
    let mine = 0, theirs = 0, score = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i] === bot) mine++;
      else if (board[i] === opp) theirs++;
      if (corners.includes(i)) {
        if (board[i] === bot) score += 120; else if (board[i] === opp) score -= 120;
      } else if (danger.includes(i)) {
        if (board[i] === bot) score -= 18; else if (board[i] === opp) score += 18;
      } else if (i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7) {
        if (board[i] === bot) score += 7; else if (board[i] === opp) score -= 7;
      }
    }
    const mobility = rules.legalMoves(board, bot).length - rules.legalMoves(board, opp).length;
    return score + (mine - theirs) * 2 + mobility * 8;
  }

  function revSearch(state, turn, bot, rules, depth, alpha, beta) {
    if (depth <= 0) return revEval(String(state.board), bot, rules);
    const moves = revMoves(state, turn, rules);
    if (!moves.length) {
      const oppMoves = revMoves(state, other(turn), rules);
      if (!oppMoves.length) return revEval(String(state.board), bot, rules);
      return revSearch(state, other(turn), bot, rules, depth - 1, alpha, beta);
    }
    moves.sort((a,b) => {
      const rank = i => [0,7,56,63].includes(i) ? 0 : (i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7) ? 1 : 2;
      return rank(a.idx) - rank(b.idx);
    });
    const maximizing = turn === bot;
    let best = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
      const result = rules.apply(state, move, turn);
      const terminal = terminalScore(result, bot, depth);
      const next = result?.nextTurn || other(turn);
      const score = terminal == null ? revSearch(result.state, next, bot, rules, depth - 1, alpha, beta) : terminal;
      if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
      else { best = Math.min(best, score); beta = Math.min(beta, best); }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseReversi(state, seat, level, rng, rules) {
    const moves = revMoves(state, seat, rules);
    if (!moves.length) return null;
    if (level <= 1) return pick(moves, rng);
    const board = String(state?.board || rules.empty());
    if (level === 2) {
      let best = -Infinity, options = [];
      for (const move of moves) {
        const flips = rules.flipsFor(board, move.idx, seat).length;
        const corner = [0,7,56,63].includes(move.idx) ? 100 : 0;
        const edge = (move.idx < 8 || move.idx >= 56 || move.idx % 8 === 0 || move.idx % 8 === 7) ? 8 : 0;
        const danger = [1,6,8,9,14,15,48,49,54,55,57,62].includes(move.idx) ? -20 : 0;
        const score = flips + corner + edge + danger;
        if (score > best) { best = score; options = [move]; }
        else if (score === best) options.push(move);
      }
      return pick(options, rng);
    }
    const depth = level >= 4 ? 4 : 2;
    let bestScore = -Infinity, bestMoves = [];
    for (const move of moves) {
      const result = rules.apply(state, move, seat);
      const terminal = terminalScore(result, seat, depth);
      const next = result?.nextTurn || other(seat);
      const score = terminal == null ? revSearch(result.state, next, seat, rules, depth - 1, -Infinity, Infinity) : terminal;
      if (score > bestScore) { bestScore = score; bestMoves = [move]; }
      else if (score === bestScore) bestMoves.push(move);
    }
    if (level === 3 && moves.length > 6 && rng() < 0.07) return pick(moves, rng);
    return pick(bestMoves, rng);
  }

  function choose(game, state, seat, level = 2, rng = Math.random) {
    const n = Math.max(1, Math.min(4, Number(level) || 2));
    if (game === 'tictactoe') return chooseTtt(state, seat, n, rng, window.TicTacToeRules);
    if (game === 'connect4') return chooseConnect4(state, seat, n, rng, window.Connect4Rules);
    if (game === 'reversi') return chooseReversi(state, seat, n, rng, window.ReversiRules);
    return null;
  }

  window.RuaBots = { LEVELS, choose, chooseTtt, chooseConnect4, chooseReversi };
})();
