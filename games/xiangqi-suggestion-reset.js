(() => {
  'use strict';

  const ROOT = 'xiangqiRooms';
  const ROOM_KEY = 'xiangqiActiveRoom';
  if (!window.firebase || typeof firebaseConfig === 'undefined' || !firebaseConfig.databaseURL) return;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db = firebase.database();
  let lastRoomId = null;
  let lastTurn = null;
  let clearingKey = null;
  let timer = null;

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function currentMode() {
    try { return typeof mode === 'undefined' ? '' : mode; } catch (_) { return ''; }
  }

  function currentTurn() {
    try { return turn === 'b' ? 'b' : 'r'; } catch (_) { return null; }
  }

  function roomId() {
    return window.XiangqiLive?.watchingId ||
      window.XiangqiPresence?.roomId ||
      (currentMode() === 'online' ? readLocal(ROOM_KEY) : null) ||
      null;
  }

  function clearLocalSuggestionUi() {
    const panel = document.getElementById('xiangqiSuggestPanel');
    if (!panel) return;
    const own = panel.querySelector('#suggestOwn');
    const list = panel.querySelector('#suggestList');
    if (own) own.textContent = '';
    if (list) {
      list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'suggestEmpty';
      empty.textContent = 'Chưa có vote nào cho lượt này.';
      list.appendChild(empty);
    }
  }

  async function clearVotes(id, nextTurn) {
    if (!id) return;
    const key = id + ':' + nextTurn;
    if (clearingKey === key) return;
    clearingKey = key;
    clearLocalSuggestionUi();
    try {
      await db.ref(ROOT).child(id).child('suggestions').remove();
    } catch (_) {}
    if (clearingKey === key) clearingKey = null;
  }

  function sync() {
    const id = roomId();
    const t = currentTurn();
    if (!id || !t) {
      lastRoomId = id;
      lastTurn = t;
      return;
    }
    if (id !== lastRoomId) {
      lastRoomId = id;
      lastTurn = t;
      clearingKey = null;
      return;
    }
    if (lastTurn && t !== lastTurn) {
      lastTurn = t;
      clearVotes(id, t);
      return;
    }
    lastTurn = t;
  }

  timer = setInterval(sync, 80);
  sync();
  window.addEventListener('pagehide', () => {
    if (timer) clearInterval(timer);
  });

  window.XiangqiSuggestionReset = { sync, clearVotes };
})();
