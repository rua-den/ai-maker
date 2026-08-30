(() => {
  'use strict';

  if (document.getElementById('pauseBtn')) return;

  const style = document.createElement('style');
  style.id = 'tetris-pause-style';
  style.textContent = `
    #pauseBtn {
      position: fixed;
      top: 14px;
      right: 114px;
      z-index: 24;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,.25);
      background: rgba(0,0,0,.4);
      color: #fff;
      font-size: 17px;
      display: grid;
      place-items: center;
      cursor: pointer;
      backdrop-filter: blur(3px);
      -webkit-tap-highlight-color: transparent;
    }
    #pauseBtn:active { transform: scale(.92); }
  `;
  document.head.appendChild(style);

  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'pauseBtn';
  pauseBtn.type = 'button';
  pauseBtn.title = 'Tạm dừng / tiếp tục';
  pauseBtn.setAttribute('aria-label', 'Tạm dừng hoặc tiếp tục game');
  document.body.appendChild(pauseBtn);

  function updatePauseButton() {
    const paused = typeof state !== 'undefined' && state === 'paused';
    pauseBtn.textContent = paused ? '▶' : '⏸';
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  }

  const previousTogglePause = togglePause;
  togglePause = function() {
    const result = previousTogglePause();
    updatePauseButton();
    return result;
  };

  pauseBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state !== 'playing' && state !== 'paused') return;
    togglePause();
  });

  updatePauseButton();
})();
