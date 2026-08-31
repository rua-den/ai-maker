// ============================================================
// Firebase config — SHARED by every game on this site.
// Đây là project Firebase thật của rua-den (first-app-7456b),
// đã lấy từ index.html cũ trong repo, dùng chung cho mọi game.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCr7P5vuhMZsGC-DzR-cKV7BUzgpBeeapk",
  authDomain: "first-app-7456b.firebaseapp.com",
  databaseURL: "https://first-app-7456b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "first-app-7456b",
};

// Shared background music for every portfolio game that does not already
// own a richer audio system. Resolve from this file so GitHub Pages subpaths
// (for example /ai-maker/) keep working correctly.
(() => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__ruaGameMusicRequested) return;
  const path = window.location.pathname.toLowerCase();
  const supported = ['flappy-dog', '/2048', '/caro', '/xiangqi', '/connect4', '/tictactoe', '/reversi', '/morris', '/go'];
  if (!supported.some(name => path.includes(name))) return;

  window.__ruaGameMusicRequested = true;
  const current = document.currentScript;
  const src = current && current.src
    ? new URL('./games/game-music.js', current.src).href
    : './games/game-music.js';
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.dataset.ruaGameMusic = '1';
  (document.head || document.documentElement).appendChild(script);
})();