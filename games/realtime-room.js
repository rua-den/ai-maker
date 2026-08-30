(() => {
  'use strict';

  function makeId() {
    try { return crypto.randomUUID(); } catch (_) { return 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  }

  function ageLabel(ts) {
    const m = Math.max(0, Math.floor((Date.now() - (ts || Date.now())) / 60000));
    if (m < 1) return 'vừa tạo';
    if (m < 60) return m + ' phút trước';
    return Math.floor(m / 60) + ' giờ trước';
  }

  window.RuaRealtime = {
    boot(config) {
      const $ = id => document.getElementById(id);
      const lobby = $('lobby');
      const game = $('game');
      const nameInput = $('playerName');
      const createBtn = $('createBtn');
      const refreshBtn = $('refreshBtn');
      const roomList = $('roomList');
      const statusEl = $('status');
      const gameStatus = $('gameStatus');
      const leaveBtn = $('leaveBtn');
      const roomCode = $('roomCode');
      const root = firebase.database().ref(config.root);
      const CLIENT_KEY = 'ruaClientId';
      const NAME_KEY = 'ruaPlayerName';
      const ROOM_KEY = 'ruaActiveRoom:' + config.root;
      const SEAT_KEY = 'ruaActiveSeat:' + config.root;
      let clientId = localStorage.getItem(CLIENT_KEY);
      if (!clientId) { clientId = makeId(); localStorage.setItem(CLIENT_KEY, clientId); }
      nameInput.value = localStorage.getItem(NAME_KEY) || '';
      let activeRef = null;
      let activeRoomId = null;
      let seat = null;
      let currentRoom = null;
      let waitingDisconnect = null;

      function setStatus(text, bad = false) {
        statusEl.textContent = text || '';
        statusEl.classList.toggle('bad', !!bad);
      }

      function playerName() {
        const name = (nameInput.value || '').trim().slice(0, 18);
        if (!name) { nameInput.focus(); setStatus('Nhập tên trước đã.', true); return null; }
        localStorage.setItem(NAME_KEY, name);
        return name;
      }

      function clearSession() {
        localStorage.removeItem(ROOM_KEY);
        localStorage.removeItem(SEAT_KEY);
        activeRoomId = null;
        seat = null;
        currentRoom = null;
        if (activeRef) activeRef.off();
        activeRef = null;
      }

      function showLobby() {
        game.classList.remove('show');
        lobby.style.display = 'flex';
        roomCode.textContent = '';
      }

      function showGame() {
        lobby.style.display = 'none';
        game.classList.add('show');
      }

      function subscribe(roomId, mySeat) {
        if (activeRef) activeRef.off();
        activeRoomId = roomId;
        seat = mySeat;
        localStorage.setItem(ROOM_KEY, roomId);
        localStorage.setItem(SEAT_KEY, mySeat);
        activeRef = root.child(roomId);
        activeRef.on('value', snap => {
          const room = snap.val();
          if (!room) {
            clearSession();
            showLobby();
            setStatus('Bàn đã đóng.');
            refreshRooms();
            return;
          }
          currentRoom = room;
          showGame();
          roomCode.textContent = '#' + roomId.slice(-6).toUpperCase();
          const a = room.players?.A?.name || 'A';
          const b = room.players?.B?.name || 'Đang chờ…';
          if (room.status === 'waiting') gameStatus.textContent = '🟡 ' + a + ' đang chờ đối thủ';
          else if (room.status === 'playing') gameStatus.textContent = room.turn === seat ? '🟢 Tới lượt bạn' : '⏳ Tới lượt ' + (room.turn === 'A' ? a : b);
          else if (room.status === 'finished') {
            if (room.winner === 'draw') gameStatus.textContent = '🤝 Hòa';
            else if (room.winner === seat) gameStatus.textContent = '🏆 Bạn thắng';
            else gameStatus.textContent = '💥 ' + (room.winner ? 'Bạn thua' : 'Kết thúc');
          }
          config.render(room, seat, api);
        });
      }

      function refreshRooms() {
        roomList.innerHTML = '<div class="empty">Đang tải…</div>';
        root.orderByChild('status').equalTo('waiting').limitToLast(30).once('value').then(snap => {
          const rows = [];
          snap.forEach(child => {
            const room = child.val() || {};
            if (Date.now() - (room.createdAt || 0) > 30 * 60 * 1000) return;
            rows.push({ id: child.key, room });
          });
          rows.sort((x, y) => (y.room.createdAt || 0) - (x.room.createdAt || 0));
          roomList.innerHTML = '';
          if (!rows.length) { roomList.innerHTML = '<div class="empty">Chưa có bàn đang chờ.</div>'; return; }
          for (const { id, room } of rows) {
            const row = document.createElement('div');
            row.className = 'room';
            const own = room.players?.A?.clientId === clientId;
            row.innerHTML = '<div class="roomInfo"><div class="roomName"></div><div class="roomMeta"></div></div><button class="btn join"></button>';
            row.querySelector('.roomName').textContent = room.players?.A?.name || 'Người chơi';
            row.querySelector('.roomMeta').textContent = '#' + id.slice(-6).toUpperCase() + ' · ' + ageLabel(room.createdAt);
            const btn = row.querySelector('button');
            btn.textContent = own ? 'Bàn của bạn' : 'Vào bàn';
            btn.disabled = own;
            btn.addEventListener('click', () => joinRoom(id));
            roomList.appendChild(row);
          }
        }).catch(() => {
          roomList.innerHTML = '<div class="empty">Không đọc được danh sách bàn.</div>';
        });
      }

      function createRoom() {
        const name = playerName();
        if (!name) return;
        createBtn.disabled = true;
        const ref = root.push();
        const room = {
          status: 'waiting', createdAt: Date.now(), updatedAt: Date.now(),
          players: { A: { name, clientId }, B: null },
          turn: 'A', winner: null, reason: null, state: config.initialState()
        };
        ref.set(room).then(() => {
          waitingDisconnect = ref.onDisconnect();
          waitingDisconnect.remove();
          subscribe(ref.key, 'A');
        }).catch(() => setStatus('Không tạo được bàn. Kiểm tra Firebase rules.', true)).finally(() => { createBtn.disabled = false; });
      }

      function joinRoom(roomId) {
        const name = playerName();
        if (!name) return;
        const ref = root.child(roomId);
        ref.transaction(room => {
          if (!room || room.status !== 'waiting' || room.players?.B) return;
          room.players = room.players || {};
          room.players.B = { name, clientId };
          room.status = 'playing';
          room.updatedAt = Date.now();
          return room;
        }, (err, committed) => {
          if (err || !committed) { setStatus('Bàn vừa có người vào hoặc đã đóng.', true); refreshRooms(); return; }
          subscribe(roomId, 'B');
        });
      }

      function move(moveData) {
        if (!activeRef || !seat) return Promise.resolve(false);
        return new Promise(resolve => {
          activeRef.transaction(room => {
            if (!room || room.status !== 'playing' || room.turn !== seat) return;
            if (room.players?.[seat]?.clientId !== clientId) return;
            const result = config.applyMove(room.state, moveData, seat, room);
            if (!result) return;
            room.state = result.state;
            room.updatedAt = Date.now();
            if (result.winner) {
              room.status = 'finished';
              room.winner = result.winner;
              room.reason = result.reason || null;
              room.finishedAt = Date.now();
            } else {
              room.turn = result.nextTurn || (seat === 'A' ? 'B' : 'A');
            }
            return room;
          }, (err, committed) => resolve(!err && committed));
        });
      }

      function leave() {
        if (!activeRef || !currentRoom) { clearSession(); showLobby(); return; }
        const room = currentRoom;
        if (waitingDisconnect?.cancel) waitingDisconnect.cancel();
        waitingDisconnect = null;
        if (room.status === 'waiting' && seat === 'A') {
          activeRef.remove().finally(() => { clearSession(); showLobby(); refreshRooms(); });
        } else if (room.status === 'playing') {
          const winner = seat === 'A' ? 'B' : 'A';
          activeRef.update({ status: 'finished', winner, reason: 'đối thủ rời bàn', finishedAt: Date.now(), updatedAt: Date.now() })
            .finally(() => { clearSession(); showLobby(); refreshRooms(); });
        } else {
          clearSession(); showLobby(); refreshRooms();
        }
      }

      const api = {
        move,
        get seat() { return seat; },
        get room() { return currentRoom; },
        get clientId() { return clientId; }
      };

      createBtn.addEventListener('click', createRoom);
      refreshBtn.addEventListener('click', refreshRooms);
      leaveBtn.addEventListener('click', leave);
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });

      const savedRoom = localStorage.getItem(ROOM_KEY);
      const savedSeat = localStorage.getItem(SEAT_KEY);
      if (savedRoom && (savedSeat === 'A' || savedSeat === 'B')) {
        root.child(savedRoom).once('value').then(snap => {
          const room = snap.val();
          if (room && room.players?.[savedSeat]?.clientId === clientId && (room.status === 'waiting' || room.status === 'playing')) subscribe(savedRoom, savedSeat);
          else { clearSession(); showLobby(); refreshRooms(); }
        }).catch(() => { clearSession(); showLobby(); refreshRooms(); });
      } else refreshRooms();

      return api;
    }
  };
})();
