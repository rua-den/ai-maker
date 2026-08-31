(() => {
  'use strict';

  const SIZE = 19;
  const POINTS = SIZE * SIZE;
  const KOMI = 6.5;
  const other = seat => seat === 'A' ? 'B' : 'A';
  const emptyBoard = () => '.'.repeat(POINTS);

  function initialState() {
    return {
      size: SIZE,
      board: emptyBoard(),
      previousBoard: null,
      captures: { A: 0, B: 0 },
      passes: 0,
      moveNo: 0,
      last: -1,
      lastAction: 'start',
      score: null
    };
  }

  function normalize(state) {
    const board = typeof state?.board === 'string' && state.board.length === POINTS ? state.board : emptyBoard();
    const previousBoard = typeof state?.previousBoard === 'string' && state.previousBoard.length === POINTS ? state.previousBoard : null;
    return {
      size: SIZE,
      board,
      previousBoard,
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
    const r = Math.floor(idx / SIZE), c = idx % SIZE;
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
        else if (board[n] === color && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    return { stones: [...seen], liberties: [...liberties] };
  }

  function removeGroup(board, stones) {
    const a = board.split('');
    for (const idx of stones) a[idx] = '.';
    return a.join('');
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
      for (const stone of g.stones) checked.add(stone);
      if (!g.liberties.length) {
        captured += g.stones.length;
        board = removeGroup(board, g.stones);
      }
    }

    const mine = group(board, idx);
    if (!mine.liberties.length) return null;
    if (s.previousBoard && board === s.previousBoard) return null;

    const captures = { ...s.captures };
    captures[seat] += captured;
    return {
      size: SIZE,
      board,
      previousBoard: s.board,
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
    const board = s.board;
    const visited = new Set();
    let stonesA = 0, stonesB = 0, territoryA = 0, territoryB = 0;
    for (const v of board) { if (v === 'A') stonesA++; else if (v === 'B') stonesB++; }

    for (let i = 0; i < POINTS; i++) {
      if (board[i] !== '.' || visited.has(i)) continue;
      const region = [];
      const border = new Set();
      const stack = [i];
      visited.add(i);
      while (stack.length) {
        const p = stack.pop();
        region.push(p);
        for (const n of neighbors(p)) {
          if (board[n] === '.' && !visited.has(n)) { visited.add(n); stack.push(n); }
          else if (board[n] === 'A' || board[n] === 'B') border.add(board[n]);
        }
      }
      if (border.size === 1) {
        if (border.has('A')) territoryA += region.length;
        else territoryB += region.length;
      }
    }

    const black = stonesA + territoryA;
    const white = stonesB + territoryB + KOMI;
    return {
      black, white, komi: KOMI,
      stones: { A: stonesA, B: stonesB },
      territory: { A: territoryA, B: territoryB },
      winner: black > white ? 'A' : 'B',
      margin: Math.abs(black - white)
    };
  }

  function apply(state, move, seat) {
    const s = normalize(state);
    if (seat !== 'A' && seat !== 'B') return null;

    if (move?.resign) {
      const winner = other(seat);
      return { state: { ...s, lastAction: 'resign' }, winner, reason: (seat === 'A' ? 'Đen' : 'Trắng') + ' xin thua' };
    }

    if (move?.pass) {
      const passes = s.passes + 1;
      const nextState = {
        ...s,
        previousBoard: s.board,
        passes,
        moveNo: s.moveNo + 1,
        last: -1,
        lastAction: 'pass'
      };
      if (passes >= 2) {
        const score = areaScore(nextState);
        nextState.score = score;
        return {
          state: nextState,
          winner: score.winner,
          reason: 'hai bên cùng bỏ lượt · Đen ' + score.black + ' - Trắng ' + score.white
        };
      }
      return { state: nextState, nextTurn: other(seat) };
    }

    const idx = Number(move?.idx);
    const nextState = playStone(s, idx, seat);
    if (!nextState) return null;
    return { state: nextState, nextTurn: other(seat) };
  }

  window.GoRules = { SIZE, POINTS, KOMI, emptyBoard, initialState, normalize, neighbors, group, playStone, areaScore, apply };
})();
