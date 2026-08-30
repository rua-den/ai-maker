(() => {
  'use strict';
  const ROWS = 6, COLS = 7;
  const empty = () => '.'.repeat(ROWS * COLS);
  function win(board, idx, token) {
    const r0 = Math.floor(idx / COLS), c0 = idx % COLS;
    for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]) {
      let n = 1;
      for (const s of [-1,1]) {
        let r = r0 + dr * s, c = c0 + dc * s;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === token) {
          n++; r += dr * s; c += dc * s;
        }
      }
      if (n >= 4) return true;
    }
    return false;
  }
  function apply(state, move, seat) {
    const col = Number(move?.col);
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
    let board = String(state?.board || empty());
    if (board.length !== ROWS * COLS) board = empty();
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === '.') { row = r; break; }
    if (row < 0) return null;
    const idx = row * COLS + col;
    board = board.slice(0, idx) + seat + board.slice(idx + 1);
    if (win(board, idx, seat)) return { state: { board, last: idx }, winner: seat, reason: 'nối 4' };
    if (!board.includes('.')) return { state: { board, last: idx }, winner: 'draw', reason: 'đầy bàn' };
    return { state: { board, last: idx } };
  }
  window.Connect4Rules = { ROWS, COLS, empty, apply, win };
})();
