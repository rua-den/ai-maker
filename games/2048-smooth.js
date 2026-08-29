(() => {
  const tiles = [];
  const originalMove = move;
  let lastGrid = Array(16).fill(null);
  let lastScore = score;
  let animTimer = 0;

  boardEl.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'tile';
    tiles.push(el);
    boardEl.appendChild(el);
  }

  function replayClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  render = function smoothRender() {
    grid.forEach((v, i) => {
      const el = tiles[i];
      const changed = lastGrid[i] !== v;
      el.className = 'tile' + (v > 2048 ? ' big' : '');
      if (v) {
        el.dataset.v = String(v);
        el.textContent = v;
        if (changed) replayClass(el, 'tile-pop');
      } else {
        delete el.dataset.v;
        el.textContent = '';
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
    boardEl.dataset.move = dir;
    clearTimeout(animTimer);
    animTimer = setTimeout(() => delete boardEl.dataset.move, 150);
    originalMove(dir);
    if (before !== grid.join(',')) {
      try { navigator.vibrate?.(7); } catch (e) {}
    }
  };

  let dragging = false, px = 0, py = 0;
  boardEl.addEventListener('pointerdown', e => {
    dragging = true;
    px = e.clientX;
    py = e.clientY;
    boardEl.classList.add('dragging');
  }, { passive: true });
  boardEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = Math.max(-18, Math.min(18, (e.clientX - px) * .12));
    const dy = Math.max(-18, Math.min(18, (e.clientY - py) * .12));
    boardEl.style.transform = `translate3d(${dx}px,${dy}px,0)`;
  }, { passive: true });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    boardEl.classList.remove('dragging');
    boardEl.style.transform = '';
  };
  boardEl.addEventListener('pointerup', release, { passive: true });
  boardEl.addEventListener('pointercancel', release, { passive: true });

  const originalNewGame = newGame;
  newGame = function smoothNewGame() {
    lastGrid = Array(16).fill(null);
    lastScore = 0;
    originalNewGame();
    boardEl.classList.remove('board-enter');
    void boardEl.offsetWidth;
    boardEl.classList.add('board-enter');
  };

  const originalUndo = undo;
  undo = function smoothUndo() {
    const canUndo = !!previous && !gameOver;
    originalUndo();
    if (canUndo) {
      boardEl.classList.remove('board-undo');
      void boardEl.offsetWidth;
      boardEl.classList.add('board-undo');
    }
  };

  render();
})();