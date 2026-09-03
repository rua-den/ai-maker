(() => {
  'use strict';

  const LIVE_MODE = 'spectator';
  const ROOT = 'xiangqiRooms';
  const WATCH_PARAM = 'watch';
  const ACTIVE_ROOM_KEY = 'xiangqiActiveRoom';
  const ACTIVE_COLOR_KEY = 'xiangqiActiveColor';
  const STASH_ROOM_KEY = 'xiangqiLiveStashedRoom';
  const STASH_COLOR_KEY = 'xiangqiLiveStashedColor';
  const VIEWER_KEY = 'xiangqiSpectatorId';

  if (!window.firebase || typeof firebaseConfig === 'undefined' || !firebaseConfig.databaseURL) return;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db = firebase.database();
  const roomsRef = db.ref(ROOT);
  const menuOverlay = document.getElementById('menuOverlay');
  const setupPanel = document.getElementById('setupPanel');
  const onlineOptions = document.getElementById('onlineOptions');
  const botOptions = document.getElementById('newBotOptions');
  const botStart = document.getElementById('newStartGameBtn');
  const topBar = document.getElementById('topBar');
  const turnLabel = document.getElementById('turnLabel');
  const undoBtn = document.getElementById('undoBtn');
  const menuBtn = document.getElementById('menuBtn');
  const canvasEl = document.getElementById('board');
  const gameContainer = document.getElementById('gameContainer');
  const overOverlayEl = document.getElementById('overOverlay');
  const overTitleEl = document.getElementById('overTitle');
  const onlineBadgeEl = document.getElementById('onlineBadge');
  if (!setupPanel || !menuOverlay || !topBar || !turnLabel || !canvasEl || !gameContainer) return;

  const style = document.createElement('style');
  style.id = 'xiangqi-live-style';
  style.textContent = `
    #liveOptions{display:none;width:100%;flex-direction:column;gap:9px;align-items:stretch}
    #liveOptions.show{display:flex}.liveHeader{display:flex;align-items:center;justify-content:space-between;gap:8px}
    #refreshLiveBtn{border:0;background:transparent;color:#ff9f91;font-weight:900;cursor:pointer;padding:4px 6px}
    #liveList{display:flex;flex-direction:column;gap:7px;max-height:250px;overflow:auto}
    .liveRoom{display:flex;align-items:center;gap:9px;padding:10px;border-radius:10px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.09)}
    .liveRoomInfo{min-width:0;flex:1;text-align:left}.livePlayers{font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .liveMeta{font-size:11px;opacity:.68;margin-top:3px}.liveDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4c43;box-shadow:0 0 0 4px rgba(255,76,67,.13);margin-right:6px;animation:livePulse 1.15s ease-in-out infinite alternate}
    @keyframes livePulse{to{opacity:.45;box-shadow:0 0 0 7px rgba(255,76,67,.04)}}
    .watchBtn{border:0;border-radius:8px;padding:8px 11px;background:linear-gradient(180deg,#ff796e,#e95047);color:#fff;font-weight:1000;cursor:pointer;white-space:nowrap}
    #liveStatus{min-height:18px;text-align:center;font-size:12px;color:#ffd79a;font-weight:750}
    #liveBar{position:absolute;top:66px;left:50%;transform:translateX(-50%);z-index:22;display:none;align-items:center;gap:7px;max-width:calc(100vw - 24px);padding:7px 9px;border-radius:999px;background:rgba(25,11,9,.92);border:1px solid rgba(255,112,95,.32);box-shadow:0 7px 22px rgba(0,0,0,.32);color:#fff;font-size:12px;font-weight:900;white-space:nowrap}
    #liveBar.show{display:flex}#liveBar .liveTitle{overflow:hidden;text-overflow:ellipsis}.liveBarBtn{border:0;border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.12);color:#fff;font-weight:900;cursor:pointer}.liveShare{color:#9ff5e6}
    #onlineBadge.liveSpectator{background:rgba(67,10,9,.9)!important;color:#ffd8d2!important;border-color:rgba(255,112,95,.35)!important}
    @media(max-width:520px){#liveBar{top:112px;font-size:11px}.liveRoom{padding:9px}.watchBtn{padding:8px 9px}}
  `;
  document.head.appendChild(style);

  const modeRow = setupPanel.querySelector('.modeRow');
  const liveModeBtn = document.createElement('button');
  liveModeBtn.type = 'button';
  liveModeBtn.className = 'choiceBtn';
  liveModeBtn.dataset.newMode = 'live';
  liveModeBtn.textContent = '🔴 Livestream';
  modeRow.appendChild(liveModeBtn);

  const liveOptions = document.createElement('div');
  liveOptions.id = 'liveOptions';
  liveOptions.innerHTML = `
    <div class="liveHeader"><div class="sectionLabel" style="margin:0"><span class="liveDot"></span>Trận đang phát</div><button id="refreshLiveBtn" type="button">↻ Làm mới</button></div>
    <div id="liveStatus"></div>
    <div id="liveList"><div class="roomEmpty">Đang tìm trận live…</div></div>
    <div class="roomMeta" style="text-align:center">Xem realtime trực tiếp từ Firebase · khán giả chỉ xem, không thể đi quân.</div>
  `;
  setupPanel.insertBefore(liveOptions, botOptions || botStart || null);

  const liveBar = document.createElement('div');
  liveBar.id = 'liveBar';
  liveBar.innerHTML = '<span class="liveDot"></span><span class="liveTitle">LIVE</span><button id="shareLiveBtn" class="liveBarBtn liveShare" type="button">📤 Chia sẻ</button><button id="exitLiveBtn" class="liveBarBtn" type="button">✕</button>';
  gameContainer.appendChild(liveBar);

  const liveList = document.getElementById('liveList');
  const liveStatus = document.getElementById('liveStatus');
  const refreshLiveBtn = document.getElementById('refreshLiveBtn');
  const shareLiveBtn = document.getElementById('shareLiveBtn');
  const exitLiveBtn = document.getElementById('exitLiveBtn');

  let liveQuery = null;
  let liveQueryHandler = null;
  let watchingRef = null;
  let watchingHandler = null;
  let viewerRef = null;
  let viewerDisconnect = null;
  let watchingId = null;
  let watchingRoom = null;
  let autoWatch = false;

  function viewerId() {
    try {
      let id = sessionStorage.getItem(VIEWER_KEY);
      if (!id) {
        id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(VIEWER_KEY, id);
      }
      return id;
    } catch (_) {
      return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    }
  }
  const myViewerId = viewerId();

  function normalizeBoard(value) {
    return Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => value && value[r] && value[r][c] ? value[r][c] : null)
    );
  }

  function shortId(id) { return String(id || '').slice(-5).toUpperCase(); }
  function viewerCount(room) { return room && room.spectators ? Object.keys(room.spectators).length : 0; }
  function liveAge(ts) {
    const mins = Math.max(0, Math.floor((Date.now() - (ts || Date.now())) / 60000));
    if (mins < 1) return 'vừa bắt đầu';
    if (mins < 60) return mins + ' phút';
    return Math.floor(mins / 60) + ' giờ ' + (mins % 60) + ' phút';
  }

  function setLiveStatus(text) { liveStatus.textContent = text || ''; }

  function stopLiveList() {
    if (liveQuery && liveQueryHandler) liveQuery.off('value', liveQueryHandler);
    liveQuery = null;
    liveQueryHandler = null;
  }

  function renderLiveList(rows) {
    liveList.innerHTML = '';
    if (!rows.length) {
      liveList.innerHTML = '<div class="roomEmpty">Chưa có trận nào đang đánh. Khi có 2 người vào bàn, trận sẽ xuất hiện ở đây.</div>';
      return;
    }
    for (const { id, room } of rows) {
      const row = document.createElement('div');
      row.className = 'liveRoom';
      const info = document.createElement('div');
      info.className = 'liveRoomInfo';
      const players = document.createElement('div');
      players.className = 'livePlayers';
      players.textContent = '🔴 ' + (room.red?.name || 'Đỏ') + '  vs  ⚫ ' + (room.black?.name || 'Đen');
      const meta = document.createElement('div');
      meta.className = 'liveMeta';
      meta.innerHTML = '<span class="liveDot"></span>LIVE #' + shortId(id) + ' · ' + viewerCount(room) + ' người xem · ' + liveAge(room.updatedAt || room.createdAt);
      info.append(players, meta);
      const watch = document.createElement('button');
      watch.type = 'button';
      watch.className = 'watchBtn';
      watch.textContent = '▶ Xem';
      watch.addEventListener('click', () => startWatching(id));
      row.append(info, watch);
      liveList.appendChild(row);
    }
  }

  function watchLiveList() {
    stopLiveList();
    setLiveStatus('');
    liveQuery = roomsRef.orderByChild('status').equalTo('playing').limitToLast(40);
    liveQueryHandler = snap => {
      const rows = [];
      snap.forEach(child => {
        const room = child.val() || {};
        if (room.red && room.black) rows.push({ id: child.key, room });
      });
      rows.sort((a, b) => (b.room.updatedAt || b.room.createdAt || 0) - (a.room.updatedAt || a.room.createdAt || 0));
      renderLiveList(rows);
    };
    liveQuery.on('value', liveQueryHandler, () => {
      liveList.innerHTML = '<div class="roomEmpty">Không đọc được danh sách livestream. Kiểm tra Firebase rules.</div>';
    });
  }

  function setMenuMode(next) {
    setupPanel.querySelectorAll('[data-new-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.newMode === next));
    onlineOptions.style.display = next === 'online' ? 'flex' : 'none';
    if (botOptions) botOptions.style.display = next === 'bot' ? 'flex' : 'none';
    if (botStart) botStart.style.display = next === 'bot' ? 'inline-block' : 'none';
    liveOptions.classList.toggle('show', next === 'live');
    if (next === 'live') {
      mode = 'live';
      watchLiveList();
    } else {
      stopLiveList();
    }
  }

  liveModeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    setMenuMode('live');
  }, true);

  setupPanel.querySelectorAll('[data-new-mode]:not([data-new-mode="live"])').forEach(btn => {
    btn.addEventListener('click', () => {
      liveOptions.classList.remove('show');
      stopLiveList();
    });
  });

  function stashActivePlayerSession() {
    try {
      const room = localStorage.getItem(ACTIVE_ROOM_KEY);
      const color = localStorage.getItem(ACTIVE_COLOR_KEY);
      if (room && (color === 'r' || color === 'b')) {
        sessionStorage.setItem(STASH_ROOM_KEY, room);
        sessionStorage.setItem(STASH_COLOR_KEY, color);
        localStorage.removeItem(ACTIVE_ROOM_KEY);
        localStorage.removeItem(ACTIVE_COLOR_KEY);
      }
    } catch (_) {}
  }

  function restoreActivePlayerSession() {
    try {
      const room = sessionStorage.getItem(STASH_ROOM_KEY);
      const color = sessionStorage.getItem(STASH_COLOR_KEY);
      if (room && (color === 'r' || color === 'b')) {
        localStorage.setItem(ACTIVE_ROOM_KEY, room);
        localStorage.setItem(ACTIVE_COLOR_KEY, color);
      }
      sessionStorage.removeItem(STASH_ROOM_KEY);
      sessionStorage.removeItem(STASH_COLOR_KEY);
    } catch (_) {}
  }

  async function registerViewer(id) {
    try {
      viewerRef = roomsRef.child(id).child('spectators').child(myViewerId);
      await viewerRef.set({ joinedAt: firebase.database.ServerValue.TIMESTAMP });
      viewerDisconnect = viewerRef.onDisconnect();
      await viewerDisconnect.remove();
    } catch (_) {
      viewerRef = null;
      viewerDisconnect = null;
    }
  }

  async function unregisterViewer() {
    try { if (viewerDisconnect) await viewerDisconnect.cancel(); } catch (_) {}
    try { if (viewerRef) await viewerRef.remove(); } catch (_) {}
    viewerDisconnect = null;
    viewerRef = null;
  }

  function stopWatching({ restoreMenu = true } = {}) {
    if (watchingRef && watchingHandler) watchingRef.off('value', watchingHandler);
    watchingRef = null;
    watchingHandler = null;
    unregisterViewer();
    watchingId = null;
    watchingRoom = null;
    liveBar.classList.remove('show');
    onlineBadgeEl?.classList.remove('liveSpectator');
    if (onlineBadgeEl) onlineBadgeEl.style.display = 'none';
    selected = null;
    legalTargets = [];
    animAnim = null;
    if (restoreMenu) {
      gameState = 'menu';
      overOverlayEl.style.display = 'none';
      topBar.style.display = 'none';
      menuOverlay.style.display = 'flex';
      restoreActivePlayerSession();
      setMenuMode('live');
    }
  }

  function updateSpectatorUi(room) {
    watchingRoom = room;
    const redName = room.red?.name || 'Đỏ';
    const blackName = room.black?.name || 'Đen';
    const side = (room.turn || 'r') === 'r' ? redName + ' (Đỏ)' : blackName + ' (Đen)';
    const viewers = viewerCount(room);

    board = normalizeBoard(room.board);
    turn = room.turn || 'r';
    lastMove = room.lastMove || null;
    selected = null;
    legalTargets = [];
    animAnim = null;
    mode = LIVE_MODE;
    menuOverlay.style.display = 'none';
    topBar.style.display = 'flex';
    undoBtn.style.display = 'none';

    if (room.status === 'finished') {
      gameState = 'over';
      const winnerName = room.winner === 'r' ? redName : room.winner === 'b' ? blackName : '';
      turnLabel.innerHTML = '🏁 Trận đã kết thúc';
      if (overTitleEl && winnerName) overTitleEl.textContent = '🎉 ' + winnerName + ' thắng!' + (room.endReason ? ' (' + room.endReason + ')' : '');
      if (overOverlayEl) overOverlayEl.style.display = 'flex';
    } else {
      gameState = 'playing';
      if (overOverlayEl) overOverlayEl.style.display = 'none';
      turnLabel.innerHTML = '<span class="turnDot" style="background:' + (turn === 'r' ? '#e2542a' : '#333') + '"></span>Đang tới lượt: ' + side;
    }

    const title = liveBar.querySelector('.liveTitle');
    title.textContent = 'LIVE #' + shortId(watchingId) + ' · ' + redName + ' vs ' + blackName + ' · 👁 ' + viewers;
    liveBar.classList.add('show');
    if (onlineBadgeEl) {
      onlineBadgeEl.textContent = '🔴 LIVE · Khán giả · ' + viewers + ' người xem';
      onlineBadgeEl.classList.add('liveSpectator');
      onlineBadgeEl.style.display = 'block';
    }
  }

  async function startWatching(id) {
    if (!id) return;
    stopLiveList();
    if (watchingId && watchingId !== id) await unregisterViewer();
    if (watchingRef && watchingHandler) watchingRef.off('value', watchingHandler);

    watchingId = id;
    mode = LIVE_MODE;
    setLiveStatus('Đang kết nối livestream…');
    watchingRef = roomsRef.child(id);
    watchingHandler = snap => {
      const room = snap.val();
      if (!room) {
        setLiveStatus('Trận này không còn tồn tại.');
        stopWatching({ restoreMenu: true });
        return;
      }
      if (room.status === 'waiting') {
        setLiveStatus('Trận chưa bắt đầu.');
        stopWatching({ restoreMenu: true });
        return;
      }
      setLiveStatus('');
      updateSpectatorUi(room);
    };
    watchingRef.on('value', watchingHandler, () => {
      setLiveStatus('Mất kết nối livestream.');
    });
    await registerViewer(id);
  }

  function shareUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set(WATCH_PARAM, watchingId || '');
    return url.href;
  }

  async function shareCurrent() {
    if (!watchingId) return;
    const url = shareUrl();
    const title = 'Cờ Tướng LIVE #' + shortId(watchingId);
    try {
      if (navigator.share) {
        await navigator.share({ title, text: 'Xem trận Cờ Tướng đang diễn ra', url });
        return;
      }
    } catch (_) { return; }
    try {
      await navigator.clipboard.writeText(url);
      shareLiveBtn.textContent = '✅ Đã copy';
      setTimeout(() => { shareLiveBtn.textContent = '📤 Chia sẻ'; }, 1400);
    } catch (_) {
      prompt('Copy link livestream:', url);
    }
  }

  refreshLiveBtn.addEventListener('click', watchLiveList);
  shareLiveBtn.addEventListener('click', shareCurrent);
  exitLiveBtn.addEventListener('click', () => stopWatching({ restoreMenu: true }));

  canvasEl.addEventListener('click', e => {
    if (mode === LIVE_MODE) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  canvasEl.addEventListener('touchstart', e => {
    if (mode === LIVE_MODE) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, { capture: true, passive: false });
  undoBtn.addEventListener('click', e => {
    if (mode === LIVE_MODE) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  menuBtn.addEventListener('click', () => {
    if (mode === LIVE_MODE || watchingId) {
      stopWatching({ restoreMenu: true });
    }
  });

  window.addEventListener('pagehide', () => { unregisterViewer(); });

  const params = new URLSearchParams(location.search);
  const directWatch = params.get(WATCH_PARAM);
  if (directWatch) {
    autoWatch = true;
    stashActivePlayerSession();
    setTimeout(() => startWatching(directWatch), 0);
  }

  window.XiangqiLive = {
    startWatching,
    stopWatching,
    watchLiveList,
    shareUrl,
    get watchingId() { return watchingId; },
    get autoWatch() { return autoWatch; }
  };
})();
