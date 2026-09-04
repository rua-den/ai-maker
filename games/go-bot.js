(() => {
  'use strict';

  const R = window.GoRules;
  if (!R) return;

  const LEVELS = {
    1: { key: 'easy', label: 'Dễ' },
    2: { key: 'medium', label: 'Vừa' },
    3: { key: 'hard', label: 'Khó' },
    4: { key: 'expert', label: 'Siêu khó' },
    5: { key: 'destroyer', label: 'Hủy Diệt' }
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

    return { move: { idx }, state: next, score, captures };
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

  function scoreMargin(state, seat) {
    const score = R.areaScore(state);
    const mine = seat === 'A' ? score.black : score.white;
    const theirs = seat === 'A' ? score.white : score.black;
    return mine - theirs;
  }

  function endgameAssessment(state, seat, moves) {
    const s = R.normalize(state);
    const baseMargin = scoreMargin(s, seat);
    let bestGain = -Infinity;
    let maxCapture = 0;
    const sample = moves.slice(0, Math.min(36, moves.length));
    for (const item of sample) {
      const gain = scoreMargin(item.state, seat) - baseMargin;
      if (gain > bestGain) bestGain = gain;
      maxCapture = Math.max(maxCapture, item.captures || 0);
    }
    if (!sample.length) bestGain = 0;
    return { margin: baseMargin, bestGain, maxCapture };
  }

  function shouldPass(state, seat, level, moves) {
    const s = R.normalize(state);
    if (!moves.length) return true;
    if (s.moveNo < 80) return false;

    const end = endgameAssessment(s, seat, moves);

    // If the opponent just passed, accept scoring once there is no meaningful
    // tactical capture or profitable endgame point left. Crucially, this does
    // NOT require the bot to be ahead, so it no longer stonewalls forever when
    // it is losing a finished game.
    if (s.passes === 1) {
      if (end.maxCapture > 0 && s.moveNo < 260) return false;
      const tolerance = level >= 4 ? 0.75 : level >= 3 ? 1.25 : 2;
      if (end.bestGain <= tolerance) return true;
      if (s.moveNo >= 220 && end.bestGain <= 4) return true;
      if (s.moveNo >= 300) return true;
      return false;
    }

    // In a settled late game, pass proactively instead of filling own secure
    // territory forever. The human can then Pass back and finish immediately.
    if (s.moveNo >= 180 && end.maxCapture === 0 && end.bestGain <= 0.25) return true;
    if (s.moveNo >= 280 && end.maxCapture === 0 && end.bestGain <= 1) return true;
    return false;
  }

  function shouldResign(state, seat, level, moves) {
    const s = R.normalize(state);
    if (level < 2 || s.moveNo < 240 || !moves.length) return false;
    const end = endgameAssessment(s, seat, moves);
    const hopeless = level >= 4 ? -55 : level >= 3 ? -65 : -80;
    return end.margin <= hopeless && end.maxCapture === 0 && end.bestGain <= 1.5;
  }

  function choose(state, seat = 'B', level = 2, rng = Math.random) {
    // Level 5 is handled asynchronously by go-ai-runtime.js. If that runtime
    // cannot start, clamping here gives it a safe Siêu khó fallback.
    const n = Math.max(1, Math.min(4, Number(level) || 2));
    const s = R.normalize(state);
    const moves = scoredMoves(s, seat);

    if (shouldResign(s, seat, n, moves)) return { resign: true };
    if (shouldPass(s, seat, n, moves)) return { pass: true };
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

  function installRulesCopy() {
    if (typeof document === 'undefined') return;
    const update = () => {
      const pass = document.getElementById('passBtn');
      if (pass) pass.textContent = 'Pass / Chấm điểm';

      const difficulty = document.getElementById('botDifficulty');
      if (difficulty && !difficulty.querySelector('option[value="5"]')) {
        const destroyer = document.createElement('option');
        destroyer.value = '5';
        destroyer.textContent = '☠️ Hủy Diệt';
        difficulty.appendChild(destroyer);
      }
      if (difficulty) {
        try {
          if (Number(localStorage.getItem('goBotDifficulty')) === 5) difficulty.value = '5';
        } catch (_) {}
      }

      const rules = document.querySelector('.rules.onlineOnly');
      if (rules) rules.textContent = '⚫ Đen đi trước · luật Chinese/AGA: cấm tự sát, positional Superko, tính điểm theo diện tích, Trắng komi 7.5. Hai bên Pass liên tiếp là kết thúc và chấm điểm ngay.';

      const help = document.querySelector('.helpCard');
      if (help) {
        const lead = help.querySelector('p');
        if (lead) lead.textContent = 'Luật dùng kiểu Chinese/AGA: tính điểm theo diện tích. Đen đi trước, Trắng được cộng 7.5 komi.';
        const items = [...help.querySelectorAll('li')];
        const ko = items.find(li => li.textContent.includes('Ko:'));
        if (ko) ko.innerHTML = '<strong>Superko:</strong> không được tạo lại bất kỳ thế bàn nào đã từng xuất hiện trong ván.';
        const end = items.find(li => li.textContent.includes('Kết thúc:'));
        if (end) end.innerHTML = '<strong>Kết thúc:</strong> 2 lượt Pass liên tiếp là chấm điểm ngay; hoặc một bên bấm Xin thua.';
      }

      const hint = document.querySelector('.botHint');
      if (hint) hint.textContent = 'Bạn cầm Đen. 💀 Siêu khó dùng bot chiến thuật hiện tại; ☠️ Hủy Diệt chạy engine riêng trong Web Worker và tự fallback an toàn nếu thiết bị không hỗ trợ.';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true });
    else update();
  }

  function installDestroyerRuntime() {
    if (typeof document === 'undefined') return;
    const inject = () => {
      if (document.querySelector('script[data-go-ai-runtime]')) return;
      const script = document.createElement('script');
      script.src = './go-ai-runtime.js';
      script.async = false;
      script.dataset.goAiRuntime = '1';
      document.body.appendChild(script);
    };
    if (document.readyState === 'complete') setTimeout(inject, 0);
    else window.addEventListener('load', inject, { once: true });
  }

  installRulesCopy();
  installDestroyerRuntime();
  window.GoBot = { LEVELS, candidateIndices, evaluateMove, scoredMoves, scoreMargin, endgameAssessment, shouldPass, shouldResign, choose };
})();
