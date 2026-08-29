(() => {
  'use strict';

  const ONLINE_ROOT = 'xiangqiRooms';
  const CLIENT_ID_KEY = 'xiangqiClientId';
  const ONLINE_NAME_KEY = 'xiangqiOnlineName';
  const ACTIVE_ROOM_KEY = 'xiangqiActiveRoom';
  const ACTIVE_COLOR_KEY = 'xiangqiActiveColor';

  const menuOverlay = document.getElementById('menuOverlay');
  const topBarEl = document.getElementById('topBar');
  const turnLabelEl = document.getElementById('turnLabel');
  const onlineBadge = document.createElement('div');
  onlineBadge.id = 'onlineBadge';
  onlineBadge.textContent = '🌐 Online';
  document.getElementById('gameContainer').appendChild(onlineBadge);

  menuOverlay.innerHTML = `
    <h1>🐴 CỜ TƯỚNG</h1>
    <div id="setupPanel" class="panel">
      <div class="sectionLabel">Chế độ chơi</div>
      <div class="modeRow">
        <button class="choiceBtn active" data-new-mode="online">🌐 2 người Online</button>
        <button class="choiceBtn" data-new-mode="bot">🤖 Đấu với Bot</button>
      </div>

      <div id="onlineOptions">
        <div class="playerField">
          <label for="onlineNameInput">Tên của bạn</label>
          <input id="onlineNameInput" class="playerInput" maxlength="14" placeholder="Nhập tên để tạo / vào bàn">
        </div>
        <div class="onlineActionRow">
          <button id="createRoomBtn" class="onlinePrimary">＋ Tạo bàn mới</button>
          <button id="cancelRoomBtn" class="onlineSecondary" style="display:none">Hủy bàn</button>
        </div>
        <div id="onlineStatus"></div>
        <div id="lobbyHeader">
          <div class="sectionLabel" style="margin:0">Bàn đang chờ</div>
          <button id="refreshRoomsBtn">↻ Làm mới</button>
        </div>
        <div id="roomList"><div class="roomEmpty">Đang tải danh sách bàn…</div></div>
      </div>

      <div id="newBotOptions" style="display:none; flex-direction:column; gap:12px; align-items:center;">
        <div class="sectionLabel">Bạn cầm quân</div>
        <div class="modeRow">
          <button class="choiceBtn active" data-new-side="r">🔴 Đỏ (đi trước)</button>
          <button class="choiceBtn" data-new-side="b">⚫ Đen</button>
        </div>
        <div class="sectionLabel">Độ khó</div>
        <div class="modeRow">
          <button class="choiceBtn" data-new-diff="1">Dễ</button>
          <button class="choiceBtn active" data-new-diff="2">Vừa</button>
          <button class="choiceBtn" data-new-diff="3">Khó</button>
        </div>
      </div>
      <button id="newStartGameBtn" style="display:none">▶ Bắt đầu đấu Bot</button>
    </div>`;

  const onlineOptions = document.getElementById('onlineOptions');
  const botOptionsNew = document.getElementById('newBotOptions');
  const startGameBtnNew = document.getElementById('newStartGameBtn');
  const onlineNameInput = document.getElementById('onlineNameInput');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const cancelRoomBtn = document.getElementById('cancelRoomBtn');
  const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
  const roomList = document.getElementById('roomList');
  const onlineStatus = document.getElementById('onlineStatus');

  let onlineDb = null;
  let roomsRef = null;
  let lobbyQuery = null;
  let lobbyHandler = null;
  let roomRef = null;
  let roomHandler = null;
  let roomId = null;
  let onlineColor = null;
  let waitingDisconnect = null;
  let redPlayerName = 'Đỏ';
  let blackPlayerName = 'Đen';

  function clientId() {
    try {
      let id = localStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }
  }
  const myClientId = clientId();

  function cleanName(value) { return String(value || '').trim().slice(0, 14); }
  function normalizeBoard(value) {
    return Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => value && value[r] && value[r][c] ? value[r][c] : null)
    );
  }
  function setStatus(text) { onlineStatus.textContent = text || ''; }
  function setBadge(text, show) {
    onlineBadge.textContent = text || '🌐 Online';
    onlineBadge.style.display = show ? 'block' : 'none';
  }
  function saveActive(id, color) {
    try { localStorage.setItem(ACTIVE_ROOM_KEY, id); localStorage.setItem(ACTIVE_COLOR_KEY, color); } catch (_) {}
  }
  function clearActive() {
    try { localStorage.removeItem(ACTIVE_ROOM_KEY); localStorage.removeItem(ACTIVE_COLOR_KEY); } catch (_) {}
  }
  function getName() {
    const name = cleanName(onlineNameInput.value);
    if (!name) {
      setStatus('Nhập tên trước đã.');
      onlineNameInput.focus();
      return null;
    }
    try { localStorage.setItem(ONLINE_NAME_KEY, name); } catch (_) {}
    return name;
  }
  try { onlineNameInput.value = localStorage.getItem(ONLINE_NAME_KEY) || ''; } catch (_) {}

  const enabled = !!(window.firebase && typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL);
  if (enabled) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    onlineDb = firebase.database();
    roomsRef = onlineDb.ref(ONLINE_ROOT);
  } else {
    createRoomBtn.disabled = true;
    setStatus('Firebase chưa sẵn sàng — Online tạm thời không dùng được.');
  }

  function roomAge(ts) {
    const mins = Math.max(0, Math.floor((Date.now() - (ts || Date.now())) / 60000));
    return mins === 0 ? 'vừa tạo' : mins + ' phút trước';
  }
  function stopLobby() {
    if (lobbyQuery && lobbyHandler) lobbyQuery.off('value', lobbyHandler);
    lobbyQuery = null; lobbyHandler = null;
  }
  function renderLobby(rows) {
    roomList.innerHTML = '';
    if (!rows.length) {
      roomList.innerHTML = '<div class="roomEmpty">Chưa có bàn nào đang chờ. Tạo bàn mới đi.</div>';
      return;
    }
    rows.forEach(({ id, room }) => {
      const row = document.createElement('div'); row.className = 'roomRow';
      const info = document.createElement('div'); info.className = 'roomInfo';
      const name = document.createElement('div'); name.className = 'roomName';
      name.textContent = '🔴 ' + ((room.red && room.red.name) || 'Người chơi');
      const meta = document.createElement('div'); meta.className = 'roomMeta';
      meta.textContent = 'Bàn #' + id.slice(-5).toUpperCase() + ' · ' + roomAge(room.createdAt);
      info.append(name, meta);
      const join = document.createElement('button'); join.className = 'joinRoomBtn';
      const own = room.red && room.red.clientId === myClientId;
      join.textContent = own ? 'Bàn của bạn' : 'Vào bàn';
      join.disabled = own;
      if (!own) join.addEventListener('click', () => joinRoom(id));
      row.append(info, join); roomList.appendChild(row);
    });
  }
  function watchLobby() {
    if (!enabled) return;
    stopLobby();
    lobbyQuery = roomsRef.orderByChild('status').equalTo('waiting').limitToLast(30);
    lobbyHandler = (snap) => {
      const rows = [];
      snap.forEach((child) => {
        const r = child.val() || {};
        if (Date.now() - (r.createdAt || 0) <= 30 * 60 * 1000) rows.push({ id: child.key, room: r });
      });
      rows.sort((a, b) => (b.room.createdAt || 0) - (a.room.createdAt || 0));
      renderLobby(rows);
    };
    lobbyQuery.on('value', lobbyHandler, () => {
      roomList.innerHTML = '<div class="roomEmpty">Không đọc được danh sách bàn. Kiểm tra Firebase rules.</div>';
    });
  }

  function detachRoom() {
    if (roomRef && roomHandler) roomRef.off('value', roomHandler);
    roomHandler = null;
  }
  function bindRoom(id, color) {
    detachRoom();
    roomId = id;
    onlineColor = color;
    roomRef = roomsRef.child(id);
    saveActive(id, color);
    roomHandler = (snap) => {
      const r = snap.val();
      if (!r) {
        clearActive(); setBadge('', false);
        gameState = 'menu'; menuOverlay.style.display = 'flex'; topBarEl.style.display = 'none';
        setStatus('Bàn này không còn tồn tại.');
        return;
      }
      redPlayerName = (r.red && r.red.name) || 'Đỏ';
      blackPlayerName = (r.black && r.black.name) || 'Đen';
      if (r.status === 'waiting') {
        mode = 'online';
        gameState = 'menu';
        menuOverlay.style.display = 'flex'; topBarEl.style.display = 'none';
        setStatus('✅ Bàn #' + id.slice(-5).toUpperCase() + ' đã tạo — đang chờ người khác vào…');
        cancelRoomBtn.style.display = color === 'r' ? 'inline-block' : 'none';
        return;
      }
      if (waitingDisconnect) { waitingDisconnect.cancel(); waitingDisconnect = null; }
      cancelRoomBtn.style.display = 'none';
      board = normalizeBoard(r.board);
      turn = r.turn || 'r';
      lastMove = r.lastMove || null;
      selected = null; legalTargets = []; animAnim = null;
      mode = 'online';
      menuOverlay.style.display = 'none'; topBarEl.style.display = 'flex';
      setBadge('🌐 Bàn #' + id.slice(-5).toUpperCase() + ' · Bạn: ' + (onlineColor === 'r' ? 'Đỏ' : 'Đen'), true);
      if (r.status === 'finished') {
        gameState = 'over'; winner = r.winner || null;
        const who = winner === 'r' ? redPlayerName + ' (Đỏ)' : blackPlayerName + ' (Đen)';
        overTitle.textContent = '🎉 ' + who + ' thắng!' + (r.endReason ? ' (' + r.endReason + ')' : '');
        overOverlay.style.display = 'flex';
      } else {
        gameState = 'playing'; winner = null; overOverlay.style.display = 'none';
      }
      updateTurnLabel();
    };
    roomRef.on('value', roomHandler, () => setStatus('Mất kết nối với bàn chơi.'));
  }

  async function createRoom() {
    if (!enabled) return;
    const name = getName(); if (!name) return;
    const ref = roomsRef.push();
    const now = Date.now();
    createRoomBtn.disabled = true;
    try {
      await ref.set({
        status: 'waiting', createdAt: now, updatedAt: now,
        red: { name, clientId: myClientId }, black: null,
        board: initialBoard(), turn: 'r', lastMove: null, winner: null
      });
      waitingDisconnect = ref.onDisconnect();
      await waitingDisconnect.remove();
      bindRoom(ref.key, 'r');
    } catch (_) {
      setStatus('Không tạo được bàn. Firebase có thể đang chặn quyền ghi.');
    } finally {
      createRoomBtn.disabled = false;
    }
  }

  function joinRoom(id) {
    if (!enabled) return;
    const name = getName(); if (!name) return;
    setStatus('Đang vào bàn…');
    const ref = roomsRef.child(id);
    ref.transaction((r) => {
      if (!r || r.status !== 'waiting' || r.black) return;
      r.black = { name, clientId: myClientId };
      r.status = 'playing'; r.updatedAt = Date.now();
      r.board = r.board || initialBoard(); r.turn = r.turn || 'r';
      return r;
    }, (error, committed) => {
      if (error || !committed) { setStatus('Bàn vừa có người vào hoặc không còn tồn tại.'); return; }
      bindRoom(id, 'b');
    }, false);
  }

  async function cancelWaitingRoom() {
    if (!roomRef || onlineColor !== 'r') return;
    try {
      const snap = await roomRef.once('value');
      const r = snap.val();
      if (r && r.status === 'waiting' && r.red && r.red.clientId === myClientId) await roomRef.remove();
    } catch (_) {}
    if (waitingDisconnect) { waitingDisconnect.cancel(); waitingDisconnect = null; }
    detachRoom(); roomRef = null; roomId = null; onlineColor = null;
    clearActive(); cancelRoomBtn.style.display = 'none'; setStatus('Đã hủy bàn.');
  }

  function onlineMove(from, to) {
    if (!roomRef || !onlineColor || gameState !== 'playing') return;
    setBadge('🌐 Đang gửi nước đi…', true);
    roomRef.transaction((r) => {
      if (!r || r.status !== 'playing' || r.turn !== onlineColor) return;
      const seat = onlineColor === 'r' ? r.red : r.black;
      if (!seat || seat.clientId !== myClientId) return;
      const remoteBoard = normalizeBoard(r.board);
      const piece = remoteBoard[from[0]] && remoteBoard[from[0]][from[1]];
      if (!piece || piece.color !== onlineColor) return;
      const legal = legalMovesForPiece(remoteBoard, from[0], from[1]);
      if (!legal.some(([rr, cc]) => rr === to[0] && cc === to[1])) return;
      const nextBoard = applyMove(remoteBoard, from, to);
      const nextTurn = onlineColor === 'r' ? 'b' : 'r';
      r.board = nextBoard; r.turn = nextTurn; r.lastMove = { from, to }; r.updatedAt = Date.now();
      const replies = allLegalMoves(nextBoard, nextTurn);
      if (replies.length === 0) {
        r.status = 'finished'; r.winner = onlineColor; r.finishedAt = Date.now();
        r.endReason = isInCheck(nextBoard, nextTurn) ? 'chiếu bí' : 'hết nước đi';
      }
      return r;
    }, (error, committed) => {
      if (error || !committed) setBadge('⚠️ Nước đi không được đồng bộ', true);
    }, false);
  }

  function restoreSession() {
    if (!enabled) return;
    let id = null, color = null;
    try { id = localStorage.getItem(ACTIVE_ROOM_KEY); color = localStorage.getItem(ACTIVE_COLOR_KEY); } catch (_) {}
    if (!id || (color !== 'r' && color !== 'b')) return;
    roomsRef.child(id).once('value').then((snap) => {
      const r = snap.val();
      const seat = color === 'r' ? r && r.red : r && r.black;
      if (!r || !seat || seat.clientId !== myClientId || !['waiting', 'playing'].includes(r.status)) { clearActive(); return; }
      mode = 'online'; bindRoom(id, color);
    }).catch(() => {});
  }

  const localPerformMove = performMove;
  performMove = function(from, to) {
    if (mode === 'online') {
      onlineMove(from, to);
      selected = null; legalTargets = [];
      return;
    }
    return localPerformMove(from, to);
  };

  const localUpdateTurnLabel = updateTurnLabel;
  updateTurnLabel = function() {
    if (mode !== 'online') return localUpdateTurnLabel();
    const side = turn === 'r' ? 'Đỏ' : 'Đen';
    const player = turn === 'r' ? redPlayerName : blackPlayerName;
    turnDot.style.background = turn === 'r' ? '#e2542a' : '#333';
    turnLabelEl.innerHTML = '<span class="turnDot" style="background:' + (turn === 'r' ? '#e2542a' : '#333') + '"></span>Lượt: ' +
      player + ' (' + side + ')' + (turn === onlineColor ? ' — lượt bạn' : '');
  };

  let lastOnlineTouchAt = 0;
  canvas.addEventListener('click', (e) => {
    if (mode === 'online' && (Date.now() - lastOnlineTouchAt < 700 || gameState !== 'playing' || turn !== onlineColor)) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  canvas.addEventListener('touchstart', (e) => {
    if (mode === 'online') lastOnlineTouchAt = Date.now();
    if (mode === 'online' && (gameState !== 'playing' || turn !== onlineColor)) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, { capture: true, passive: false });

  document.getElementById('undoBtn').addEventListener('click', (e) => {
    if (mode === 'online') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.getElementById('menuBtn').addEventListener('click', () => {
    if (mode === 'online') { setBadge('', false); setTimeout(watchLobby, 0); }
  });
  document.getElementById('playAgainBtn').addEventListener('click', (e) => {
    if (mode === 'online') {
      e.preventDefault(); e.stopImmediatePropagation();
      gameState = 'menu'; overOverlay.style.display = 'none'; topBarEl.style.display = 'none'; menuOverlay.style.display = 'flex';
      setBadge('', false); setStatus('Tạo bàn mới hoặc chọn bàn đang chờ để chơi tiếp.'); watchLobby();
    }
  }, true);

  document.querySelectorAll('[data-new-mode]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-new-mode]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.newMode;
    onlineOptions.style.display = mode === 'online' ? 'flex' : 'none';
    botOptionsNew.style.display = mode === 'bot' ? 'flex' : 'none';
    startGameBtnNew.style.display = mode === 'bot' ? 'inline-block' : 'none';
    if (mode === 'online') watchLobby();
  }));
  document.querySelectorAll('[data-new-side]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-new-side]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active'); humanColor = btn.dataset.newSide;
  }));
  document.querySelectorAll('[data-new-diff]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-new-diff]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active'); botDepth = parseInt(btn.dataset.newDiff, 10);
  }));
  startGameBtnNew.addEventListener('click', () => { mode = 'bot'; startGame(); });
  createRoomBtn.addEventListener('click', createRoom);
  cancelRoomBtn.addEventListener('click', cancelWaitingRoom);
  refreshRoomsBtn.addEventListener('click', watchLobby);

  mode = 'online';
  watchLobby();
  setTimeout(restoreSession, 60);
})();
