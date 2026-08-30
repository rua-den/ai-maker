(() => {
  'use strict';

  if (window.__ruaGameMusicLoaded) return;

  const path = location.pathname.toLowerCase();
  const game = path.includes('flappy-dog') ? 'flappy' :
    path.includes('/2048') ? '2048' :
    path.includes('/caro') ? 'caro' :
    path.includes('/xiangqi') ? 'xiangqi' :
    path.includes('/tetris') ? 'tetris' : null;

  // Tetris already owns a richer music + SFX system in tetris-mobile.js.
  if (!game || game === 'tetris') return;
  window.__ruaGameMusicLoaded = true;

  const TRACKS = {
    flappy: {
      step: 0.17,
      melody: [659.25, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25, 523.25, 659.25, 783.99, 987.77, 1174.66, 987.77, 783.99, 659.25, 587.33],
      bass: [130.81, 146.83, 164.81, 146.83],
      wave: 'square'
    },
    '2048': {
      step: 0.28,
      melody: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 349.23, 440.00, 523.25, 440.00, 349.23],
      bass: [65.41, 73.42, 87.31, 73.42],
      wave: 'triangle'
    },
    caro: {
      step: 0.31,
      melody: [293.66, 349.23, 440.00, 523.25, 440.00, 349.23, 329.63, 392.00, 493.88, 587.33, 493.88, 392.00],
      bass: [73.42, 82.41, 98.00, 82.41],
      wave: 'triangle'
    },
    xiangqi: {
      step: 0.36,
      melody: [293.66, 349.23, 392.00, 440.00, 523.25, 440.00, 392.00, 349.23, 293.66, 392.00, 440.00, 587.33, 523.25, 440.00, 392.00, 349.23],
      bass: [73.42, 87.31, 98.00, 73.42],
      wave: 'sine'
    }
  };

  const track = TRACKS[game];
  const STORAGE_KEY = 'ruaGameMusicEnabled';
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== '0'; } catch (_) {}

  let audioCtx = null;
  let master = null;
  let timer = null;
  let nextNoteAt = 0;
  let stepIndex = 0;
  let button = null;

  function ensureAudio() {
    if (!enabled) return null;
    try {
      if (!audioCtx) {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;
        audioCtx = new AudioContextCtor();
        master = audioCtx.createGain();
        master.gain.value = 0.7;
        master.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    } catch (_) {
      return null;
    }
  }

  function tone(freq, duration, volume, wave, when) {
    const ctx = ensureAudio();
    if (!ctx || !master || !enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function schedule() {
    if (!enabled || document.hidden) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    while (nextNoteAt < ctx.currentTime + 0.35) {
      const i = stepIndex % track.melody.length;
      tone(track.melody[i], track.step * 0.72, 0.012, track.wave, nextNoteAt);
      if (i % 4 === 0) {
        const bass = track.bass[Math.floor(i / 4) % track.bass.length];
        tone(bass, track.step * 1.2, 0.008, 'triangle', nextNoteAt);
      }
      stepIndex += 1;
      nextNoteAt += track.step;
    }
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startMusic() {
    if (!enabled || document.hidden) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    stopMusic();
    nextNoteAt = ctx.currentTime + 0.05;
    schedule();
    timer = setInterval(schedule, 100);
  }

  function updateButton() {
    if (!button) return;
    button.textContent = enabled ? '🎵' : '🔇';
    button.title = enabled ? 'Tắt nhạc' : 'Bật nhạc';
    button.setAttribute('aria-label', enabled ? 'Tắt nhạc' : 'Bật nhạc');
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function install() {
    if (!document.body || document.getElementById('globalMusicBtn')) return;

    const style = document.createElement('style');
    style.textContent = `
      #globalMusicBtn {
        position: fixed;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        z-index: 9999;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,.28);
        border-radius: 50%;
        background: rgba(10,14,22,.72);
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 18px;
        cursor: pointer;
        box-shadow: 0 5px 16px rgba(0,0,0,.24);
        backdrop-filter: blur(7px);
        -webkit-tap-highlight-color: transparent;
      }
      #globalMusicBtn:active { transform: scale(.92); }
    `;
    document.head.appendChild(style);

    button = document.createElement('button');
    button.id = 'globalMusicBtn';
    button.type = 'button';
    document.body.appendChild(button);
    updateButton();

    button.addEventListener('pointerdown', e => e.stopPropagation());
    button.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      enabled = !enabled;
      try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch (_) {}
      updateButton();
      if (enabled) startMusic();
      else {
        stopMusic();
        if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
      }
    });

    const unlock = e => {
      if (e.target === button || !enabled) return;
      startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopMusic();
      else if (enabled && audioCtx) startMusic();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
