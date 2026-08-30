(() => {
  'use strict';
  const empty = () => '.'.repeat(9);
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function apply(state, move, seat) {
    const idx = Number(move?.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx > 8) return null;
    let board = String(state?.board || empty());
    if (board.length !== 9) board = empty();
    if (board[idx] !== '.') return null;
    board = board.slice(0, idx) + seat + board.slice(idx + 1);
    if (lines.some(line => line.every(i => board[i] === seat))) return { state: { board, last: idx }, winner: seat, reason: '3 ô thẳng hàng' };
    if (!board.includes('.')) return { state: { board, last: idx }, winner: 'draw', reason: 'đầy bàn' };
    return { state: { board, last: idx } };
  }
  window.TicTacToeRules = { empty, apply, lines };
})();
