(() => {
  const tiles = [];
  const values = [];
  const originalMove = move;
  let lastGrid = Array(16).fill(null);
  let lastScore = score;

  boardEl.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const value = document.createElement('span');
    value.className = 'tile-value';
    tile.appendChild(value);
    tiles.push(tile);
    values.push(value);
    boardEl.appendChild(tile);
  }

  function replayClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  render = function fixedGridRender() {
    grid.forEach((v, i) => {
      const tile = tiles[i];
      const value = values[i];
      const changed = lastGrid[i] !== v;

      tile.className = 'tile' + (v > 2048 ? ' big' : '');
      if (v) {
        tile.dataset.v = String(v);
        value.textContent = v;
        if (changed) replayClass(value, 'pop');
      } else {
        delete tile.dataset.v;
        value.textContent = '';
        value.classList.remove('pop');
      }
    });

    scoreEl.textContent = score;
    if (score !== lastScore) replayClass(scoreEl, 'score-pop');

    const best = Math.max(Number(bestEl.textContent) || 0, score);
    bestEl.textContent = best;
    try {
      localStorage.setItem(BEST_KEY, String(best));
      localStorage.setItem(SAVE_KEY, JSON.stringify({ grid, score, wonShown, gameOver }));
    } catch (e) {}

    lastGrid = grid.slice();
    lastScore = score;
  };

  move = function smoothMove(dir) {
    if (gameOver) return;
    const before = grid.join(',');
    originalMove(dir);
    if (before !== grid.join(',')) {
      try { navigator.vibrate?.(5); } catch (e) {}
    }
  };

  const originalNewGame = newGame;
  newGame = function smoothNewGame() {
    lastGrid = Array(16).fill(null);
    lastScore = 0;
    originalNewGame();
  };

  const originalUndo = undo;
  undo = function smoothUndo() {
    originalUndo();
  };

  boardEl.style.transform = '';
  boardEl.classList.remove('dragging');
  delete boardEl.dataset.move;
  render();
})();