(() => {
  'use strict';

  const LEVELS = {
    1: { label: 'Dễ' },
    2: { label: 'Vừa' },
    3: { label: 'Khó' },
    4: { label: 'Siêu khó' }
  };

  const other = seat => seat === 'A' ? 'B' : 'A';
  const pick = (items, rng = Math.random) => items.length ? items[Math.floor(rng() * items.length)] : null;

  function terminalScore(result, bot, depth) {
    if (!result?.winner) return null;
    if (result.winner === 'draw') return 0;
    return result.winner === bot ? 100000 + depth : -100000 - depth;
  }

  function potentialMills(board, seat, rules) {
    let n = 0;
    for (const line of rules.MILLS) {
      let own = 0, empty = 0, blocked = false;
      for (const i of line) {
        if (board[i] === seat) own++;
        else if (board[i] === '.') empty++;
        else blocked = true;
      }
      if (!blocked && own === 2 && empty === 1) n++;
    }
    return n;
  }

  function blockedPieces(state, seat, rules) {
    if (rules.phase(state, seat) !== 'moving') return 0;
    const s = rules.normalize(state);
    let n = 0;
    for (let i = 0; i < rules.POINTS; i++) {
      if (s.board[i] === seat && !rules.destinations(s, seat, i).length) n++;
    }
    return n;
  }

  function evaluate(state, bot, rules) {
    const s = rules.normalize(state);
    const opp = other(bot);
    const mine = rules.count(s.board, bot), theirs = rules.count(s.board, opp);
    const mills = rules.millsFor(s.board, bot).length - rules.millsFor(s.board, opp).length;
    const potential = potentialMills(s.board, bot, rules) - potentialMills(s.board, opp, rules);
    const blocked = blockedPieces(s, opp, rules) - blockedPieces(s, bot, rules);
    let mobility = 0;
    if (s.placed.A >= rules.MAX_PIECES && s.placed.B >= rules.MAX_PIECES) {
      mobility = rules.baseMoves(s, bot).length - rules.baseMoves(s, opp).length;
    }
    let structure = 0;
    for (let i = 0; i < rules.POINTS; i++) {
      const degree = rules.ADJ[i].length;
      if (s.board[i] === bot) structure += degree;
      else if (s.board[i] === opp) structure -= degree;
    }
    return (mine - theirs) * 120 + mills * 65 + potential * 16 + blocked * 12 + mobility * 2 + structure * 2;
  }

  function moveOrder(move, rules) {
    let score = 0;
    if (move.remove != null) score += 1000;
    if (Number.isInteger(move.to)) score += (rules.ADJ[move.to]?.length || 0) * 8;
    return score;
  }

  function search(state, turn, bot, rules, depth, alpha, beta, budget, table) {
    if (budget.nodes++ >= budget.maxNodes) return evaluate(state, bot, rules);
    const key = state.board + '|' + state.placed.A + state.placed.B + '|' + state.noCapture + '|' + turn + '|' + depth;
    if (table.has(key)) return table.get(key);
    if (depth <= 0) return evaluate(state, bot, rules);

    const moves = rules.legalMoves(state, turn);
    if (!moves.length) {
      const score = turn === bot ? -100000 - depth : 100000 + depth;
      table.set(key, score);
      return score;
    }
    moves.sort((a, b) => moveOrder(b, rules) - moveOrder(a, rules));
    const maximizing = turn === bot;
    let best = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      const result = rules.apply(state, move, turn);
      if (!result) continue;
      const terminal = terminalScore(result, bot, depth);
      const score = terminal == null
        ? search(result.state, result.nextTurn || other(turn), bot, rules, depth - 1, alpha, beta, budget, table)
        : terminal;
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha || budget.nodes >= budget.maxNodes) break;
    }
    table.set(key, best);
    return best;
  }

  function choose(state, seat, level = 2, rng = Math.random, rules = window.MorrisRules) {
    const n = Math.max(1, Math.min(4, Number(level) || 2));
    const moves = rules.legalMoves(state, seat);
    if (!moves.length) return null;
    if (n === 1) return pick(moves, rng);

    const wins = [];
    for (const move of moves) {
      const result = rules.apply(state, move, seat);
      if (result?.winner === seat) wins.push(move);
    }
    if (wins.length) return pick(wins, rng);

    if (n === 2) {
      let best = -Infinity, options = [];
      for (const move of moves) {
        const result = rules.apply(state, move, seat);
        if (!result) continue;
        let score = evaluate(result.state, seat, rules);
        if (move.remove != null) score += 180;
        if ((rules.ADJ[move.to]?.length || 0) >= 4) score += 8;
        if (score > best) { best = score; options = [move]; }
        else if (score === best) options.push(move);
      }
      return pick(options.length ? options : moves, rng);
    }

    const phase = rules.phase(state, seat);
    let depth = n === 3 ? 2 : 3;
    if (n === 4 && phase !== 'placing' && moves.length <= 12) depth = 4;
    const budget = { nodes: 0, maxNodes: n === 4 ? 80000 : 22000 };
    const table = new Map();
    let best = -Infinity, options = [];

    const ordered = [...moves].sort((a, b) => moveOrder(b, rules) - moveOrder(a, rules));
    for (const move of ordered) {
      const result = rules.apply(state, move, seat);
      if (!result) continue;
      const terminal = terminalScore(result, seat, depth);
      const score = terminal == null
        ? search(result.state, result.nextTurn || other(seat), seat, rules, depth - 1, -Infinity, Infinity, budget, table)
        : terminal;
      if (score > best) { best = score; options = [move]; }
      else if (score === best) options.push(move);
      if (budget.nodes >= budget.maxNodes) break;
    }

    if (n === 3 && moves.length > 8 && rng() < 0.06) return pick(moves, rng);
    return pick(options.length ? options : moves, rng);
  }

  window.MorrisBot = { LEVELS, choose, evaluate };
})();
