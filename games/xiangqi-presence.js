(() => {
  'use strict';

  const ROOT = 'xiangqiRooms';
  const ROOM_KEY = 'xiangqiActiveRoom';
  const COLOR_KEY = 'xiangqiActiveColor';
  const CLIENT_KEY = 'xiangqiClientId';
  const CONNECTION_KEY = 'xiangqiPresenceConnectionId';
  const CLEANUP_GRACE_MS = 12000;
  const JOIN_GRACE_MS = 1600;

  if (!window.firebase || typeof firebaseConfig === 'undefined' || !firebaseConfig.databaseURL) return;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db = firebase.database();
  const roomsRef = db.ref(ROOT);
  const connectedRef = db.ref('.info/connected');
  const gameContainer = document.getElementById('gameContainer');
  const menuBtn = document.getElementById('menuBtn');
  if (!gameContainer) return;

  const style = document.createElement('style');
  style.id = 'xiangqi-presence-style';
  style.textContent = `
    #xiangqiPresenceBanner{position:absolute;left:50%;top:112px;transform:translateX(-50%);z-index:24;display:none;max-width:calc(100vw - 24px);padding:9px 13px;border-radius:12px;background:rgba(99,45,12,.94);border:1px solid rgba(255,187,105,.42);color:#ffe1b8;font-size:12px;font-weight:900;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.34);backdrop-filter:blur(6px)}
    #xiangqiPresenceBanner.show{display:block}
    @media(max-width:520px){#xiangqiPresenceBanner{top:158px;font-size:11px;padding:8px 10px}}
  `;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'xiangqiPresenceBanner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  gameContainer.appendChild(banner);

  function connectionId() {
    try {
      let id = sessionStorage.getItem(CONNECTION_KEY);
      if (!id) {
        id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(CONNECTION_KEY, id);
      }
      return id;
    } catch (_) {
      return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    }
  }
  const myConnectionId = connectionId();

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function removeLocal(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }
  function hasConnections(value) {
    return !!(value && typeof value === 'object' && Object.keys(value).length);
  }
  function seatOnline(room, color) {
    return hasConnections(room?.connections?.[color]);
  }
  function playerName(room, color) {
    const player = color === 'r' ? room?.red : room?.black;
    return player?.name || (color === 'r' ? 'Đỏ' : 'Đen');
  }
  function hideBanner() {
    banner.classList.remove('show');
    banner.textContent = '';
  }
  function showBanner(text) {
    banner.textContent = text;
    banner.classList.add('show');
  }

  let boundRoomId = null;
  let boundColor = null;
  let boundClientId = null;
  let roomRef = null;
  let roomHandler = null;
  let myConnRef = null;
  let lastSeenRef = null;
  let connectedHandler = null;
  let disconnectRemove = null;
  let disconnectSeen = null;
  let lastPlayerRoomDisconnect = null;
  let pollTimer = null;
  const cleanupTimers = new Map();

  async function armPresence() {
    if (!roomRef || !myConnRef || !boundColor) return;
    try {
      await roomRef.child('presenceVersion').set(1);
      await myConnRef.set({ clientId: boundClientId || '', connectedAt: firebase.database.ServerValue.TIMESTAMP });
      disconnectRemove = myConnRef.onDisconnect();
      await disconnectRemove.remove();
      disconnectSeen = lastSeenRef.onDisconnect();
      await disconnectSeen.set(firebase.database.ServerValue.TIMESTAMP);
    } catch (_) {}
  }

  async function cancelLastPlayerCleanup() {
    try { if (lastPlayerRoomDisconnect) await lastPlayerRoomDisconnect.cancel(); } catch (_) {}
    lastPlayerRoomDisconnect = null;
  }

  async function armLastPlayerCleanup() {
    if (!roomRef || lastPlayerRoomDisconnect) return;
    try {
      lastPlayerRoomDisconnect = roomRef.onDisconnect();
      await lastPlayerRoomDisconnect.remove();
    } catch (_) {
      lastPlayerRoomDisconnect = null;
    }
  }

  async function disarmPresence({ removeNow = true } = {}) {
    try { if (disconnectRemove) await disconnectRemove.cancel(); } catch (_) {}
    try { if (disconnectSeen) await disconnectSeen.cancel(); } catch (_) {}
    await cancelLastPlayerCleanup();
    if (removeNow) {
      try { if (myConnRef) await myConnRef.remove(); } catch (_) {}
      try { if (lastSeenRef) await lastSeenRef.set(firebase.database.ServerValue.TIMESTAMP); } catch (_) {}
    }
    disconnectRemove = null;
    disconnectSeen = null;
  }

  function maybeDeleteIfBothOut(id, room) {
    if (!id || !room || room.status !== 'playing' || room.presenceVersion !== 1) return;
    if (seatOnline(room, 'r') || seatOnline(room, 'b')) {
      const old = cleanupTimers.get(id);
      if (old) clearTimeout(old);
      cleanupTimers.delete(id);
      return;
    }
    if (cleanupTimers.has(id)) return;
    const timer = setTimeout(async () => {
      cleanupTimers.delete(id);
      try {
        const ref = roomsRef.child(id);
        const snap = await ref.once('value');
        const latest = snap.val();
        if (!latest || latest.status !== 'playing' || latest.presenceVersion !== 1) return;
        if (seatOnline(latest, 'r') || seatOnline(latest, 'b')) return;
        await ref.remove();
      } catch (_) {}
    }, CLEANUP_GRACE_MS);
    cleanupTimers.set(id, timer);
  }

  function watchBoundRoom() {
    if (!roomRef) return;
    roomHandler = snap => {
      const room = snap.val();
      if (!room) {
        hideBanner();
        removeLocal(ROOM_KEY);
        removeLocal(COLOR_KEY);
        return;
      }
      maybeDeleteIfBothOut(boundRoomId, room);
      if (room.status !== 'playing' || room.presenceVersion !== 1 || !boundColor) {
        cancelLastPlayerCleanup();
        hideBanner();
        return;
      }
      const other = boundColor === 'r' ? 'b' : 'r';
      const meOnline = seatOnline(room, boundColor);
      const otherOnline = seatOnline(room, other);
      if (otherOnline) {
        cancelLastPlayerCleanup();
        hideBanner();
      } else if (meOnline) {
        // When I am the last connected player, arm a server-side room removal.
        // If I also disconnect before the opponent returns, Firebase deletes
        // the whole room even though no browser remains online to do cleanup.
        armLastPlayerCleanup();
        const justStarted = Date.now() - Number(room.updatedAt || room.createdAt || 0) < JOIN_GRACE_MS;
        if (justStarted) hideBanner();
        else showBanner('⚠️ ' + playerName(room, other) + ' đã out · đang chờ đối thủ quay lại…');
      }
    };
    roomRef.on('value', roomHandler);
  }

  async function unbind({ removeNow = true } = {}) {
    if (roomRef && roomHandler) roomRef.off('value', roomHandler);
    roomHandler = null;
    if (connectedHandler) connectedRef.off('value', connectedHandler);
    connectedHandler = null;
    await disarmPresence({ removeNow });
    roomRef = null;
    myConnRef = null;
    lastSeenRef = null;
    boundRoomId = null;
    boundColor = null;
    boundClientId = null;
    hideBanner();
  }

  async function bind(id, color, clientId) {
    if (!id || (color !== 'r' && color !== 'b')) return;
    if (boundRoomId === id && boundColor === color) return;
    await unbind({ removeNow: true });
    boundRoomId = id;
    boundColor = color;
    boundClientId = clientId || readLocal(CLIENT_KEY) || '';
    roomRef = roomsRef.child(id);
    myConnRef = roomRef.child('connections').child(color).child(myConnectionId);
    lastSeenRef = roomRef.child('presenceLastSeen').child(color);
    connectedHandler = snap => {
      if (snap.val() === true && boundRoomId === id && boundColor === color) armPresence();
    };
    connectedRef.on('value', connectedHandler);
    watchBoundRoom();
  }

  async function syncFromStorage() {
    const id = readLocal(ROOM_KEY);
    const color = readLocal(COLOR_KEY);
    if (id && (color === 'r' || color === 'b')) {
      await bind(id, color, readLocal(CLIENT_KEY));
    } else if (boundRoomId) {
      await unbind({ removeNow: true });
    }
  }

  async function leaveActiveRoom() {
    const id = boundRoomId || readLocal(ROOM_KEY);
    const color = boundColor || readLocal(COLOR_KEY);
    if (!id || (color !== 'r' && color !== 'b')) return;
    const ref = roomsRef.child(id);
    await unbind({ removeNow: true });
    removeLocal(ROOM_KEY);
    removeLocal(COLOR_KEY);
    try {
      const snap = await ref.once('value');
      const room = snap.val();
      if (!room) return;
      if (room.status === 'waiting' && color === 'r') {
        await ref.remove();
        return;
      }
      if (room.status === 'playing' && room.presenceVersion === 1 && !seatOnline(room, 'r') && !seatOnline(room, 'b')) {
        await ref.remove();
      }
    } catch (_) {}
  }

  // Fallback reaper for the rare case where both connections disappear at
  // virtually the same time before either side can arm last-player cleanup.
  const reapQuery = roomsRef.orderByChild('status').equalTo('playing').limitToLast(60);
  reapQuery.on('value', snap => {
    snap.forEach(child => maybeDeleteIfBothOut(child.key, child.val() || {}));
  });

  if (menuBtn) {
    menuBtn.addEventListener('click', async e => {
      const currentMode = typeof mode === 'undefined' ? '' : mode;
      if (currentMode !== 'online' || !boundRoomId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showBanner('Đang rời bàn…');
      await leaveActiveRoom();
      const url = new URL(location.href);
      url.search = '';
      url.hash = '';
      location.href = url.pathname;
    }, true);
  }

  pollTimer = setInterval(syncFromStorage, 350);
  syncFromStorage();

  window.addEventListener('pagehide', () => {
    if (pollTimer) clearInterval(pollTimer);
    // Keep Firebase onDisconnect handlers armed. They remove this player's
    // connection marker and, when this is the last player, the whole room.
  });

  window.XiangqiPresence = {
    bind,
    unbind,
    leaveActiveRoom,
    seatOnline,
    maybeDeleteIfBothOut,
    get roomId() { return boundRoomId; },
    get color() { return boundColor; }
  };
})();
