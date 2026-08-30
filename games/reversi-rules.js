(() => {
  'use strict';
  const SIZE = 8;
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  function empty() {
    const a = Array(SIZE * SIZE).fill('.');
    a[3 * SIZE + 3] = 'B'; a[3 * SIZE + 4] = 'A';
    a[4 * SIZE + 3] = 'A'; a[4 * SIZE + 4] = 'B';
    return a.join('');
  }
  function flipsFor(board, idx, seat) {
    if (idx < 0 || idx >= board.length || board[idx] !== '.') return [];
    const opp = seat === 'A' ? 'B' : 'A';
    const r0 = Math.floor(idx / SIZE), c0 = idx % SIZE;
    const out = [];
    for (const [dr, dc] of dirs) {
      const run = [];
      let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === opp) {
        run.push(r * SIZE + c); r += dr; c += dc;
      }
      if (run.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === seat) out.push(...run);
    }
    return out;
  }
  function legalMoves(board, seat) {
    const out = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (flipsFor(board, i, seat).length) out.push(i);
    return out;
  }
  function apply(state, move, seat) {
    const idx = Number(move?.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= SIZE * SIZE) return null;
    let board = String(state?.board || empty());
    if (board.length !== SIZE * SIZE) board = empty();
    const flips = flipsFor(board, idx, seat);
    if (!flips.length) return null;
    const a = board.split('');
    a[idx] = seat;
    for (const i of flips) a[i] = seat;
    board = a.join('');
    const opp = seat === 'A' ? 'B' : 'A';
    const oppMoves = legalMoves(board, opp);
    const ownMoves = legalMoves(board, seat);
    if (!oppMoves.length && !ownMoves.length) {
      const ac = [...board].filter(x => x === 'A').length;
      const bc = [...board].filter(x => x === 'B').length;
      const winner = ac === bc ? 'draw' : ac > bc ? 'A' : 'B';
      return { state: { board, last: idx }, winner, reason: 'hết nước đi' };
    }
    return { state: { board, last: idx }, nextTurn: oppMoves.length ? opp : seat };
  }
  window.ReversiRules = { SIZE, empty, flipsFor, legalMoves, apply };
})();
