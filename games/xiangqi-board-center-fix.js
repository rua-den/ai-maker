(() => {
  'use strict';

  const board = document.getElementById('board');
  if (!board) return;

  const style = document.createElement('style');
  style.id = 'xiangqi-board-center-fix-style';
  style.textContent = `
    #gameContainer > #board {
      transform: none !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
    }
  `;
  document.head.appendChild(style);

  // xiangqi-match-ui may recalculate board sizing on resize/orientation.
  // The board stays a normal flex child, so gameContainer's
  // justify-content:center remains the single source of truth for centering.
  board.style.removeProperty('margin-left');
  board.style.removeProperty('margin-right');
})();
