(() => {
  'use strict';

  const touchControls = document.getElementById('touchControls');
  if (touchControls) touchControls.style.display = 'none';

  const style = document.createElement('style');
  style.id = 'tetris-swipe-audio-style';
  style.textContent = `
    canvas { touch-action: none !important; -webkit-tap-highlight-color: transparent; }
    #touchControls { display: none !important; }
    #soundBtn {
      position: fixed; top: 14px; right: 64px; z-index: 22;
      width: 40px; height: 40px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,.25);
      background: rgba(0,0,0,.4); color: #fff; font-size: 17px;
      display: grid; place-items: center; cursor: pointer;
      backdrop-filter: blur(3px); -webkit-tap-highlight-color: transparent;
    }
    #soundBtn:active { transform: scale(.92); }
    #gestureHint {
      position: fixed; left: 50%; bottom: calc(10px + env(safe-area-inset-bottom));
      transform: translateX(-50%); z-index: 16; pointer-events: none;
      max-width: calc(100vw - 28px); padding: 7px 11px; border-radius: 999px;
      background: rgba(8,12,20,.68); border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.78); font-size: 11px; font-weight: 700;
      white-space: nowrap; backdrop-filter: blur(6px);
    }
    @media (min-width: 721px) and (min-height: 601px) { #gestureHint { display:none; } }
    @media (max-width: 390px) { #gestureHint { font-size: 10px; padding: 6px 9px; } }
  `;
  document.head.appendChild(style);

  const soundBtn = document.createElement('button');
  soundBtn.id = 'soundBtn';
  soundBtn.type = 'button';
  soundBtn.setAttribute('aria-label', 'Bật tắt nhạc và âm thanh');
  soundBtn.title = 'Bật / tắt nhạc và âm thanh';
  document.body.appendChild(soundBtn);

  const gestureHint = document.createElement('div');
  gestureHint.id = 'gestureHint';
  gestureHint.textContent = 'Chạm: xoay · Kéo ↔: di chuyển · Kéo ↓: rơi · Vuốt nhanh ↓: thả';
  document.body.appendChild(gestureHint);

  const SOUND_KEY = 'tetrisSoundEnabled';
  let soundEnabled = true;
  try { soundEnabled = localStorage.getItem(SOUND_KEY) !== '0'; } catch (_) {}

  let audioCtx = null;
  let musicTimer = null;
  let musicNext = 0;
  let musicStep = 0;

  function updateSoundButton() {
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
  }
  updateSoundButton();

  function ensureAudio() {
    if (!soundEnabled) return null;
    try {
      if (!audioCtx) {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;
        audioCtx = new AudioContextCtor();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    } catch (_) {
      return null;
    }
  }

  function tone(freq, duration = .05, volume = .035, type = 'square', when = null, endFreq = null) {
    const ctx = ensureAudio();
    if (!ctx || !soundEnabled) return;
    const start = when == null ? ctx.currentTime : when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + .015);
  }

  function sfx(name, detail = 1) {
    if (!soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (name === 'move') tone(190, .022, .012, 'square', t, 215);
    else if (name === 'rotate') { tone(310, .045, .025, 'square', t, 420); tone(520, .03, .012, 'triangle', t + .018, 620); }
    else if (name === 'lock') tone(135, .055, .026, 'triangle', t, 82);
    else if (name === 'drop') { tone(220, .05, .03, 'square', t, 85); tone(95, .08, .022, 'triangle', t + .025, 55); }
    else if (name === 'clear') {
      const count = Math.max(1, Math.min(4, detail));
      for (let i = 0; i < count + 1; i++) tone(440 * Math.pow(2, i / 12 * 3), .08, .025, 'square', t + i * .045);
    }
    else if (name === 'start') { tone(330, .07, .025, 'square', t); tone(440, .08, .025, 'square', t + .06); tone(660, .1, .026, 'square', t + .12); }
    else if (name === 'over') { tone(260, .13, .032, 'sawtooth', t, 150); tone(150, .18, .026, 'triangle', t + .11, 70); }
  }

  const melody = [
    329.63, 392.00, 493.88, 659.25,
    392.00, 493.88, 587.33, 783.99,
    349.23, 440.00, 523.25, 698.46,
    293.66, 392.00, 493.88, 587.33
  ];
  const bass = [82.41, 98.00, 87.31, 73.42];

  function scheduleMusic() {
    if (!soundEnabled || state !== 'playing') return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const stepDuration = .15;
    while (musicNext < ctx.currentTime + .25) {
      const idx = musicStep % melody.length;
      tone(melody[idx], .105, .009, 'square', musicNext);
      if (idx % 4 === 0) tone(bass[Math.floor(idx / 4) % bass.length], .13, .011, 'triangle', musicNext, bass[Math.floor(idx / 4) % bass.length] * .98);
      musicStep++;
      musicNext += stepDuration;
    }
  }

  function startMusic() {
    if (!soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    stopMusic();
    musicStep = 0;
    musicNext = ctx.currentTime + .08;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 90);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  soundBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch (_) {}
    updateSoundButton();
    if (soundEnabled) {
      ensureAudio();
      if (state === 'playing') { sfx('start'); startMusic(); }
    } else {
      stopMusic();
      if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
    }
  });

  const baseTryMove = tryMove;
  tryMove = function(dx, dy) {
    const ok = baseTryMove(dx, dy);
    if (ok && dx !== 0) sfx('move');
    return ok;
  };

  const baseTryRotate = tryRotate;
  tryRotate = function(dir) {
    const ok = baseTryRotate(dir);
    if (ok) sfx('rotate');
    return ok;
  };

  const baseLockCurrentPiece = lockCurrentPiece;
  lockCurrentPiece = function() {
    sfx('lock');
    return baseLockCurrentPiece();
  };

  const basePerformClear = performClear;
  performClear = function() {
    const count = flashRows.length;
    if (count) sfx('clear', count);
    return basePerformClear();
  };

  const baseTryStartGame = tryStartGame;
  tryStartGame = function() {
    ensureAudio();
    const before = state;
    const result = baseTryStartGame();
    if (before !== 'playing' && state === 'playing') {
      sfx('start');
      startMusic();
    }
    return result;
  };

  const baseTogglePause = togglePause;
  togglePause = function() {
    baseTogglePause();
    if (state === 'paused') stopMusic();
    else if (state === 'playing') startMusic();
  };

  const baseGameOver = gameOver;
  gameOver = function() {
    const wasPlaying = state === 'playing';
    const result = baseGameOver();
    if (wasPlaying && state === 'over') {
      stopMusic();
      sfx('over');
    }
    return result;
  };

  function hardDropMobile() {
    if (state !== 'playing' || !current || flashRows.length) return false;
    const d = hardDropDistance(current);
    if (d <= 0) return false;
    current = { ...current, y: current.y + d };
    score += d * 2;
    sfx('drop');
    try { navigator.vibrate?.(18); } catch (_) {}
    lockCurrentPiece();
    return true;
  }

  const STEP_X = 27;
  const STEP_Y = 28;
  let gesture = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (state !== 'playing') return;
    ensureAudio();
    gesture = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      accX: 0,
      accY: 0,
      startedAt: performance.now(),
      moved: false
    };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (!gesture || gesture.id !== e.pointerId || state !== 'playing') return;
    const dx = e.clientX - gesture.lastX;
    const dy = e.clientY - gesture.lastY;
    gesture.lastX = e.clientX;
    gesture.lastY = e.clientY;
    gesture.accX += dx;
    gesture.accY += dy;

    const totalX = e.clientX - gesture.startX;
    const totalY = e.clientY - gesture.startY;
    if (Math.hypot(totalX, totalY) > 10) gesture.moved = true;

    if (Math.abs(gesture.accX) >= STEP_X && Math.abs(totalX) >= Math.abs(totalY) * .65) {
      const dir = gesture.accX > 0 ? 1 : -1;
      while (Math.abs(gesture.accX) >= STEP_X) {
        if (!tryMove(dir, 0)) { gesture.accX = 0; break; }
        gesture.accX -= dir * STEP_X;
        try { navigator.vibrate?.(4); } catch (_) {}
      }
      gesture.accY = 0;
    } else if (gesture.accY >= STEP_Y && totalY > Math.abs(totalX) * .7) {
      while (gesture.accY >= STEP_Y) {
        if (!baseTryMove(0, 1)) { gesture.accY = 0; break; }
        score += 1;
        gesture.accY -= STEP_Y;
        try { navigator.vibrate?.(3); } catch (_) {}
      }
      gesture.accX = 0;
    }
    e.preventDefault();
  }, { passive: false });

  function finishGesture(e, cancelled = false) {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture;
    gesture = null;
    if (cancelled || state !== 'playing') return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const elapsed = Math.max(1, performance.now() - g.startedAt);
    const velocityY = dy / elapsed;

    if (dy > 72 && Math.abs(dy) > Math.abs(dx) * 1.15 && elapsed < 330 && velocityY > .28) {
      hardDropMobile();
      e.preventDefault();
      return;
    }

    if (!g.moved && Math.hypot(dx, dy) < 14 && elapsed < 320) {
      tryRotate(1);
      try { navigator.vibrate?.(6); } catch (_) {}
      e.preventDefault();
    }
  }

  canvas.addEventListener('pointerup', (e) => finishGesture(e, false), { passive: false });
  canvas.addEventListener('pointercancel', (e) => finishGesture(e, true), { passive: false });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMusic();
    else if (state === 'playing' && soundEnabled) startMusic();
  });
})();
