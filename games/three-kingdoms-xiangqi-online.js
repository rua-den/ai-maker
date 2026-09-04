(() => {
  'use strict';

  const ROOT = 'threeKingdomsRooms';
  const CLIENT_KEY = 'threeKingdomsClientId';
  const NAME_KEY = 'threeKingdomsOnlineName';
  const ROOM_KEY = 'threeKingdomsActiveRoom';
  const SEAT_KEY = 'threeKingdomsActiveSeat';
  const R = window.ThreeKingdomsXiangqi;
  const Bot = window.ThreeKingdomsBot;
  const Game = window.ThreeKingdomsGame;
  if (!R || !Bot || !Game) return;

  const setupModal = document.getElementById('setupModal');
  const panel = setupModal?.querySelector('.panel');
  const title = panel?.querySelector('.panelTitle');
  const localSeatGrid = panel?.querySelector('.seatGrid');
  const localSettings = panel?.querySelector('.settings');
  const localStart = document.getElementById('startBtn');
  if (!setupModal || !panel || !title || !localSeatGrid || !localSettings || !localStart) return;

  const style = document.createElement('style');
  style.id = 'three-kingdoms-online-style';
  style.textContent = `
    .tkModeTabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 14px}.tkModeTab{min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:#fff;font-weight:950;font-size:12px;cursor:pointer}.tkModeTab.active{background:linear-gradient(180deg,rgba(224,180,110,.28),rgba(166,107,47,.18));border-color:rgba(238,196,127,.5);color:#ffd995;box-shadow:inset 0 0 0 1px rgba(255,226,172,.08)}
    #tkLocalSetup{display:none}.tkOnlinePanel{display:flex;flex-direction:column;gap:10px}.tkOnlinePanel[hidden]{display:none!important}.tkOnlineHero{padding:12px 13px;border-radius:14px;background:linear-gradient(135deg,rgba(82,125,187,.13),rgba(66,169,105,.08));border:1px solid rgba(127,174,238,.2)}.tkOnlineHero strong{display:block;font-size:13px}.tkOnlineHero span{display:block;margin-top:3px;font-size:10px;line-height:1.5;opacity:.68}
    .tkNameRow{display:grid;grid-template-columns:1fr 138px;gap:8px}.tkInput,.tkSelect{width:100%;min-height:43px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#18191d;color:#fff;padding:0 11px;font-weight:850;font-size:12px;outline:none}.tkInput:focus,.tkSelect:focus{border-color:rgba(232,186,115,.6);box-shadow:0 0 0 3px rgba(232,186,115,.08)}
    .tkCreateBtn,.tkPrimary,.tkSecondary,.tkSeatBtn{min-height:43px;border-radius:11px;font-weight:950;font-size:12px;cursor:pointer}.tkCreateBtn,.tkPrimary{border:0;background:linear-gradient(180deg,#e0b46e,#a66b2f);color:#24170c}.tkSecondary,.tkSeatBtn{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.055);color:#fff}.tkCreateBtn:disabled,.tkPrimary:disabled,.tkSeatBtn:disabled{opacity:.4;cursor:not-allowed}
    .tkLobbyHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:3px}.tkLobbyHead strong{font-size:11px;letter-spacing:.45px;text-transform:uppercase;color:#efc47f}.tkRefresh{border:0;background:transparent;color:#d7d9df;font-size:11px;font-weight:850;cursor:pointer;padding:5px 0}.tkRooms{display:flex;flex-direction:column;gap:7px;max-height:270px;overflow:auto}.tkEmpty{padding:15px 11px;text-align:center;border:1px dashed rgba(255,255,255,.12);border-radius:12px;font-size:10px;line-height:1.5;opacity:.6}.tkRoomRow{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}.tkRoomName{font-size:12px;font-weight:950}.tkRoomMeta{font-size:9px;opacity:.58;margin-top:3px}.tkRoomJoin{min-width:82px;min-height:36px;border-radius:9px;border:1px solid rgba(115,174,244,.35);background:rgba(74,126,196,.16);color:#dcecff;font-weight:950;font-size:10px;cursor:pointer}
    .tkStatus{min-height:18px;font-size:10px;line-height:1.45;color:#ffd99b}.tkRoomDetail{display:none;flex-direction:column;gap:10px}.tkRoomDetail.show{display:flex}.tkRoomTop{display:flex;align-items:center;justify-content:space-between;gap:8px}.tkRoomCode{font-size:12px;font-weight:1000;color:#ffd691}.tkRoomSub{font-size:9px;opacity:.58;margin-top:2px}.tkLeave{border:1px solid rgba(255,116,100,.28);background:rgba(138,51,38,.24);color:#ffd9d3;border-radius:9px;min-height:35px;padding:0 10px;font-weight:900;font-size:10px;cursor:pointer}
    .tkSeatGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.tkOnlineSeat{padding:10px;border-radius:13px;border:1px solid color-mix(in srgb,var(--accent) 32%,rgba(255,255,255,.08));background:rgba(255,255,255,.04);min-width:0}.tkSeatHead{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:1000}.tkSeatDot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px color-mix(in srgb,var(--accent) 55%,transparent)}.tkSeatWho{height:30px;margin:7px 0;font-size:10px;line-height:1.35;opacity:.76;overflow:hidden}.tkSeatActions{display:flex;gap:5px;flex-wrap:wrap}.tkSeatBtn{min-height:31px;padding:0 8px;font-size:9px;flex:1}.tkSeatBtn.bot{border-color:rgba(232,186,115,.34);color:#ffd693}.tkSeatBtn.mine{border-color:rgba(101,222,134,.34);color:#bff2cb}.tkSeatBadge{display:inline-flex;align-items:center;min-height:25px;padding:0 7px;border-radius:8px;background:rgba(255,255,255,.06);font-size:9px;font-weight:900}
    .tkHostSettings{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tkHostField{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.tkHostField label{display:block;font-size:9px;opacity:.6;font-weight:900;text-transform:uppercase;margin-bottom:6px}.tkHostField .tkSelect{min-height:38px;font-size:10px}.tkCheck{display:flex;align-items:center;gap:7px;min-height:38px;font-size:10px;font-weight:850}.tkCheck input{width:18px;height:18px;accent-color:#d6a158}.tkRoomActions{display:grid;grid-template-columns:1fr auto;gap:8px}.tkPrimary{min-height:46px}.tkCopy{min-width:92px}
    .tkOnlineBadge{position:absolute;z-index:22;right:max(12px,env(safe-area-inset-right));bottom:max(13px,env(safe-area-inset-bottom));padding:7px 10px;border-radius:999px;background:rgba(10,12,15,.82);border:1px solid rgba(105,166,238,.28);font-size:9px;font-weight:900;color:#dcecff;backdrop-filter:blur(10px);display:none}
    @media(max-width:700px){.tkNameRow{grid-template-columns:1fr}.tkSeatGrid{grid-template-columns:1fr}.tkOnlineSeat{display:grid;grid-template-columns:92px 1fr auto;align-items:center;gap:7px}.tkSeatWho{height:auto;margin:0}.tkSeatActions{min-width:88px}.tkHostSettings{grid-template-columns:1fr}.tkRooms{max-height:220px}}
  `;
  document.head.appendChild(style);

  const tabs = document.createElement('div');
  tabs.className = 'tkModeTabs';
  tabs.innerHTML = '<button class="tkModeTab active" id="tkOnlineTab" type="button">🌐 ONLINE</button><button class="tkModeTab" id="tkLocalTab" type="button">🎮 CÙNG MÁY</button>';
  title.insertAdjacentElement('afterend', tabs);

  const localWrap = document.createElement('div');
  localWrap.id = 'tkLocalSetup';
  localSeatGrid.parentNode.insertBefore(localWrap, localSeatGrid);
  localWrap.append(localSeatGrid, localSettings, localStart);

  const onlinePanel = document.createElement('div');
  onlinePanel.className = 'tkOnlinePanel';
  onlinePanel.id = 'tkOnlinePanel';
  onlinePanel.innerHTML = `
    <div class="tkOnlineHero"><strong>🌐 Lobby Tam Quốc</strong><span>Tạo phòng hoặc vào phòng đang chờ. Trong phòng chọn ghế Thục / Ngụy / Ngô; host có thể dùng BOT lấp ghế còn trống.</span></div>
    <div id="tkLobbyView">
      <div class="tkNameRow"><input class="tkInput" id="tkOnlineName" maxlength="16" placeholder="Tên của bạn"><select class="tkSelect" id="tkCreateSeat" aria-label="Ghế khi tạo phòng"><option value="0">蜀 Ghế Thục</option><option value="1">魏 Ghế Ngụy</option><option value="2">吳 Ghế Ngô</option></select></div>
      <button class="tkCreateBtn" id="tkCreateRoom" type="button" style="width:100%;margin-top:8px">＋ TẠO PHÒNG MỚI</button>
      <div class="tkStatus" id="tkStatus"></div>
      <div class="tkLobbyHead"><strong>Phòng đang chờ</strong><button class="tkRefresh" id="tkRefresh" type="button">↻ Làm mới</button></div>
      <div class="tkRooms" id="tkRooms"><div class="tkEmpty">Đang tải danh sách phòng…</div></div>
    </div>
    <div class="tkRoomDetail" id="tkRoomDetail">
      <div class="tkRoomTop"><div><div class="tkRoomCode" id="tkRoomCode">Phòng #-----</div><div class="tkRoomSub" id="tkRoomSub">Chọn một ghế để tham chiến.</div></div><button class="tkLeave" id="tkLeaveRoom" type="button">Rời phòng</button></div>
      <div class="tkSeatGrid" id="tkOnlineSeats"></div>
      <div class="tkHostSettings" id="tkHostSettings">
        <div class="tkHostField"><label for="tkBotDifficulty">Độ khó BOT</label><select class="tkSelect" id="tkBotDifficulty"><option value="easy">Vừa</option><option value="hard" selected>Khó</option><option value="destroyer">☠ Hủy diệt</option></select></div>
        <div class="tkHostField"><label>Luật</label><label class="tkCheck"><input type="checkbox" id="tkSpecialPieces" checked><span>Dùng quân đặc biệt 火 / 旗 / 風</span></label></div>
      </div>
      <div class="tkStatus" id="tkRoomStatus"></div>
      <div class="tkRoomActions"><button class="tkPrimary" id="tkStartRoom" type="button">⚔ KHAI CHIẾN</button><button class="tkSecondary tkCopy" id="tkCopyRoom" type="button">🔗 Mã phòng</button></div>
    </div>`;
  localWrap.insertAdjacentElement('beforebegin', onlinePanel);

  const badge = document.createElement('div');
  badge.className = 'tkOnlineBadge';
  badge.id = 'tkOnlineBadge';
  document.getElementById('app').appendChild(badge);

  const onlineTab = document.getElementById('tkOnlineTab');
  const localTab = document.getElementById('tkLocalTab');
  const lobbyView = document.getElementById('tkLobbyView');
  const roomDetail = document.getElementById('tkRoomDetail');
  const nameInput = document.getElementById('tkOnlineName');
  const createSeat = document.getElementById('tkCreateSeat');
  const createBtn = document.getElementById('tkCreateRoom');
  const refreshBtn = document.getElementById('tkRefresh');
  const roomsEl = document.getElementById('tkRooms');
  const statusEl = document.getElementById('tkStatus');
  const roomCodeEl = document.getElementById('tkRoomCode');
  const roomSubEl = document.getElementById('tkRoomSub');
  const seatsEl = document.getElementById('tkOnlineSeats');
  const roomStatusEl = document.getElementById('tkRoomStatus');
  const leaveBtn = document.getElementById('tkLeaveRoom');
  const startRoomBtn = document.getElementById('tkStartRoom');
  const copyRoomBtn = document.getElementById('tkCopyRoom');
  const botDifficultyEl = document.getElementById('tkBotDifficulty');
  const specialPiecesEl = document.getElementById('tkSpecialPieces');
  const hostSettings = document.getElementById('tkHostSettings');

  let db = null;
  let roomsRef = null;
  let lobbyQuery = null;
  let lobbyHandler = null;
  let roomRef = null;
  let roomHandler = null;
  let roomId = null;
  let room = null;
  let mySeat = null;
  let mode = 'online';
  let botTimer = null;
  let botSignature = null;

  function clientId() {
    try {
      let id = localStorage.getItem(CLIENT_KEY);
      if (!id) {
        id = 'tk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(CLIENT_KEY, id);
      }
      return id;
    } catch (_) {
      return 'tk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }
  }
  const myClientId = clientId();

  function cleanName(value) { return String(value || '').trim().slice(0, 16); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function kingdomLabel(index) { return ['蜀 Thục', '魏 Ngụy', '吳 Ngô'][index] || 'Tam Quốc'; }
  function seatAt(value, index) { return value?.seats?.[String(index)] || value?.seats?.[index] || { type: 'open' }; }
  function seatsAsTypes(value) { return [0, 1, 2].map(i => seatAt(value, i).type === 'bot' ? 'bot' : 'human'); }
  function seatLabel(value, index) {
    const seat = seatAt(value, index);
    if (seat.type === 'bot') return '🤖 BOT';
    if (seat.type === 'human') return '👤 ' + (seat.name || 'Người');
    return 'Ghế trống';
  }
  function setStatus(text) { statusEl.textContent = text || ''; }
  function setRoomStatus(text) { roomStatusEl.textContent = text || ''; }
  function saveSession(id, seat) {
    try {
      if (id) localStorage.setItem(ROOM_KEY, id); else localStorage.removeItem(ROOM_KEY);
      if (Number.isInteger(seat)) localStorage.setItem(SEAT_KEY, String(seat)); else localStorage.removeItem(SEAT_KEY);
    } catch (_) {}
  }
  function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } }
  function getName() {
    const name = cleanName(nameInput.value);
    if (!name) { setStatus('Nhập tên trước đã.'); nameInput.focus(); return null; }
    try { localStorage.setItem(NAME_KEY, name); } catch (_) {}
    return name;
  }
  nameInput.value = savedName();

  const firebaseReady = !!(window.firebase && typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL);
  if (firebaseReady) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    roomsRef = db.ref(ROOT);
  } else {
    createBtn.disabled = true;
    setStatus('Firebase chưa sẵn sàng — Online tạm thời không dùng được.');
  }

  function setMode(next) {
    mode = next === 'local' ? 'local' : 'online';
    onlineTab.classList.toggle('active', mode === 'online');
    localTab.classList.toggle('active', mode === 'local');
    onlinePanel.hidden = mode !== 'online';
    localWrap.style.display = mode === 'local' ? 'block' : 'none';
    if (mode === 'local') {
      Game.attachOnline(null);
      badge.style.display = 'none';
    } else {
      Game.attachOnline(adapter);
      if (firebaseReady) watchLobby();
    }
  }

  function roomAge(ts) {
    const mins = Math.max(0, Math.floor((Date.now() - (Number(ts) || Date.now())) / 60000));
    return mins < 1 ? 'vừa tạo' : mins + ' phút trước';
  }

  function stopLobby() {
    if (lobbyQuery && lobbyHandler) lobbyQuery.off('value', lobbyHandler);
    lobbyQuery = null;
    lobbyHandler = null;
  }

  function renderLobby(rows) {
    roomsEl.innerHTML = '';
    if (!rows.length) {
      roomsEl.innerHTML = '<div class="tkEmpty">Chưa có phòng nào đang chờ.<br>Tạo phòng mới rồi gửi mã cho hai ông kia.</div>';
      return;
    }
    for (const item of rows) {
      const occupied = [0, 1, 2].filter(i => seatAt(item.room, i).type !== 'open').length;
      const humans = [0, 1, 2].filter(i => seatAt(item.room, i).type === 'human').length;
      const bots = [0, 1, 2].filter(i => seatAt(item.room, i).type === 'bot').length;
      const row = document.createElement('div');
      row.className = 'tkRoomRow';
      row.innerHTML = `<div><div class="tkRoomName">🏯 ${(item.room.hostName || 'Chủ phòng')} · #${item.id.slice(-5).toUpperCase()}</div><div class="tkRoomMeta">${occupied}/3 ghế · ${humans} người${bots ? ' · ' + bots + ' BOT' : ''} · ${roomAge(item.room.createdAt)}</div></div>`;
      const join = document.createElement('button');
      join.className = 'tkRoomJoin';
      join.type = 'button';
      join.textContent = 'Vào phòng';
      join.addEventListener('click', () => bindRoom(item.id));
      row.appendChild(join);
      roomsEl.appendChild(row);
    }
  }

  function watchLobby() {
    if (!roomsRef || lobbyQuery) return;
    lobbyQuery = roomsRef.orderByChild('status').equalTo('waiting').limitToLast(30);
    lobbyHandler = snap => {
      const rows = [];
      snap.forEach(child => {
        const value = child.val() || {};
        if (Date.now() - (Number(value.createdAt) || 0) <= 45 * 60 * 1000) rows.push({ id: child.key, room: value });
      });
      rows.sort((a, b) => (Number(b.room.createdAt) || 0) - (Number(a.room.createdAt) || 0));
      renderLobby(rows);
    };
    lobbyQuery.on('value', lobbyHandler, () => {
      roomsEl.innerHTML = '<div class="tkEmpty">Không đọc được lobby. Kiểm tra Firebase rules.</div>';
    });
  }

  function detachRoom() {
    if (roomRef && roomHandler) roomRef.off('value', roomHandler);
    roomRef = null;
    roomHandler = null;
    room = null;
    roomId = null;
    mySeat = null;
    clearTimeout(botTimer);
    botTimer = null;
    botSignature = null;
  }

  function detectMySeat(value) {
    for (let i = 0; i < 3; i++) {
      const seat = seatAt(value, i);
      if (seat.type === 'human' && seat.clientId === myClientId) return i;
    }
    return null;
  }

  function renderRoom(value) {
    room = value;
    mySeat = detectMySeat(value);
    saveSession(roomId, mySeat);
    lobbyView.style.display = 'none';
    roomDetail.classList.add('show');
    roomCodeEl.textContent = 'Phòng #' + roomId.slice(-5).toUpperCase();
    roomSubEl.textContent = value.status === 'waiting' ? 'Chọn ghế · host có thể thêm BOT vào ghế trống.' : 'Ván đang diễn ra.';
    seatsEl.innerHTML = '';
    const host = value.hostClientId === myClientId;

    for (let i = 0; i < 3; i++) {
      const seat = seatAt(value, i);
      const card = document.createElement('div');
      card.className = 'tkOnlineSeat';
      card.style.setProperty('--accent', ['#e85848', '#4c82d0', '#43a263'][i]);
      const who = seat.type === 'human' ? ((seat.clientId === myClientId ? 'Bạn · ' : '') + (seat.name || 'Người')) : seat.type === 'bot' ? '🤖 BOT ' + ((value.botDifficulty || 'hard') === 'destroyer' ? 'Hủy diệt' : (value.botDifficulty || 'hard') === 'hard' ? 'Khó' : 'Vừa') : 'Đang trống';
      card.innerHTML = `<div class="tkSeatHead"><span class="tkSeatDot"></span>${kingdomLabel(i)}</div><div class="tkSeatWho">${who}</div>`;
      const actions = document.createElement('div');
      actions.className = 'tkSeatActions';

      if (value.status === 'waiting') {
        if (seat.type === 'open') {
          const sit = document.createElement('button');
          sit.className = 'tkSeatBtn';
          sit.type = 'button';
          sit.textContent = 'Ngồi ghế';
          sit.addEventListener('click', () => takeSeat(i));
          actions.appendChild(sit);
          if (host) {
            const bot = document.createElement('button');
            bot.className = 'tkSeatBtn bot';
            bot.type = 'button';
            bot.textContent = '+ BOT';
            bot.addEventListener('click', () => setSeatBot(i, true));
            actions.appendChild(bot);
          }
        } else if (seat.type === 'human' && seat.clientId === myClientId) {
          const badgeEl = document.createElement('span');
          badgeEl.className = 'tkSeatBadge';
          badgeEl.textContent = '✓ Ghế của bạn';
          actions.appendChild(badgeEl);
          const stand = document.createElement('button');
          stand.className = 'tkSeatBtn mine';
          stand.type = 'button';
          stand.textContent = 'Đổi ghế';
          stand.addEventListener('click', leaveSeat);
          actions.appendChild(stand);
        } else if (seat.type === 'bot' && host) {
          const remove = document.createElement('button');
          remove.className = 'tkSeatBtn bot';
          remove.type = 'button';
          remove.textContent = 'Bỏ BOT';
          remove.addEventListener('click', () => setSeatBot(i, false));
          actions.appendChild(remove);
        } else {
          const busy = document.createElement('span');
          busy.className = 'tkSeatBadge';
          busy.textContent = seat.type === 'bot' ? 'BOT' : 'Đã có người';
          actions.appendChild(busy);
        }
      } else {
        const fixed = document.createElement('span');
        fixed.className = 'tkSeatBadge';
        fixed.textContent = seat.type === 'bot' ? '🤖 BOT' : seat.clientId === myClientId ? '✓ Bạn' : '👤 Người';
        actions.appendChild(fixed);
      }
      card.appendChild(actions);
      seatsEl.appendChild(card);
    }

    botDifficultyEl.value = value.botDifficulty || 'hard';
    specialPiecesEl.checked = value.includeSpecial !== false;
    botDifficultyEl.disabled = !host || value.status !== 'waiting';
    specialPiecesEl.disabled = !host || value.status !== 'waiting';
    hostSettings.style.opacity = host ? '1' : '.62';

    const complete = [0, 1, 2].every(i => seatAt(value, i).type === 'human' || seatAt(value, i).type === 'bot');
    startRoomBtn.style.display = value.status === 'waiting' ? 'block' : 'none';
    startRoomBtn.disabled = !host || !complete;
    setRoomStatus(value.status === 'waiting'
      ? (host ? (complete ? 'Đủ 3 ghế. Có thể khai chiến.' : 'Cần đủ 3 ghế Người/BOT mới bắt đầu được.') : 'Chờ chủ phòng bấm Khai chiến.')
      : '🌐 Đang chơi online · ' + (mySeat == null ? 'Bạn đang xem' : 'Bạn: ' + kingdomLabel(mySeat)));

    if (value.status === 'playing' || value.status === 'finished') {
      const remoteState = clone(value.state);
      if (remoteState) {
        Game.applyRemoteState(remoteState, seatsAsTypes(value), value.botDifficulty || 'hard');
        badge.textContent = '🌐 #' + roomId.slice(-5).toUpperCase() + (mySeat == null ? ' · Xem' : ' · ' + kingdomLabel(mySeat));
        badge.style.display = 'block';
        maybeDriveBot(value);
      }
    } else {
      setupModal.classList.add('show');
      badge.style.display = 'none';
    }
  }

  function bindRoom(id) {
    if (!roomsRef || !id) return;
    if (roomRef && roomId === id) return;
    if (roomRef && roomHandler) roomRef.off('value', roomHandler);
    roomId = id;
    roomRef = roomsRef.child(id);
    roomHandler = snap => {
      const value = snap.val();
      if (!value) {
        setStatus('Phòng không còn tồn tại.');
        leaveRoomView(false);
        return;
      }
      renderRoom(value);
    };
    roomRef.on('value', roomHandler, () => setRoomStatus('Mất kết nối với phòng.'));
  }

  async function createRoom() {
    if (!roomsRef) return;
    const name = getName();
    if (!name) return;
    const seatIndex = Math.max(0, Math.min(2, Number(createSeat.value) || 0));
    createBtn.disabled = true;
    const ref = roomsRef.push();
    const now = Date.now();
    const seats = { '0': { type: 'open' }, '1': { type: 'open' }, '2': { type: 'open' } };
    seats[String(seatIndex)] = { type: 'human', name, clientId: myClientId, joinedAt: now };
    try {
      await ref.set({
        status: 'waiting',
        createdAt: now,
        updatedAt: now,
        hostClientId: myClientId,
        hostName: name,
        seats,
        includeSpecial: true,
        botDifficulty: 'hard',
        state: null,
        winner: null
      });
      bindRoom(ref.key);
    } catch (_) {
      setStatus('Không tạo được phòng. Firebase có thể đang chặn quyền ghi.');
    } finally {
      createBtn.disabled = false;
    }
  }

  async function takeSeat(index) {
    if (!roomRef || !room || room.status !== 'waiting') return;
    const name = getName();
    if (!name) return;
    const target = String(index);
    try {
      await roomRef.transaction(value => {
        if (!value || value.status !== 'waiting') return;
        const currentTarget = seatAt(value, index);
        if (currentTarget.type !== 'open' && !(currentTarget.type === 'human' && currentTarget.clientId === myClientId)) return;
        value.seats = value.seats || {};
        for (let i = 0; i < 3; i++) {
          const seat = seatAt(value, i);
          if (seat.type === 'human' && seat.clientId === myClientId) value.seats[String(i)] = { type: 'open' };
        }
        value.seats[target] = { type: 'human', name, clientId: myClientId, joinedAt: Date.now() };
        value.updatedAt = Date.now();
        return value;
      }, undefined, false);
    } catch (_) { setRoomStatus('Không ngồi được ghế này.'); }
  }

  async function leaveSeat() {
    if (!roomRef || !room || room.status !== 'waiting' || mySeat == null) return;
    const index = mySeat;
    try {
      await roomRef.transaction(value => {
        if (!value || value.status !== 'waiting') return;
        const seat = seatAt(value, index);
        if (seat.type !== 'human' || seat.clientId !== myClientId) return;
        value.seats[String(index)] = { type: 'open' };
        value.updatedAt = Date.now();
        return value;
      }, undefined, false);
    } catch (_) {}
  }

  async function setSeatBot(index, enabled) {
    if (!roomRef || !room || room.status !== 'waiting' || room.hostClientId !== myClientId) return;
    try {
      await roomRef.transaction(value => {
        if (!value || value.status !== 'waiting' || value.hostClientId !== myClientId) return;
        const seat = seatAt(value, index);
        if (enabled && seat.type !== 'open') return;
        if (!enabled && seat.type !== 'bot') return;
        value.seats = value.seats || {};
        value.seats[String(index)] = enabled ? { type: 'bot' } : { type: 'open' };
        value.updatedAt = Date.now();
        return value;
      }, undefined, false);
    } catch (_) {}
  }

  async function updateHostSettings() {
    if (!roomRef || !room || room.status !== 'waiting' || room.hostClientId !== myClientId) return;
    const nextDifficulty = botDifficultyEl.value;
    const nextSpecial = !!specialPiecesEl.checked;
    try {
      await roomRef.transaction(value => {
        if (!value || value.status !== 'waiting' || value.hostClientId !== myClientId) return;
        value.botDifficulty = nextDifficulty;
        value.includeSpecial = nextSpecial;
        value.updatedAt = Date.now();
        return value;
      }, undefined, false);
    } catch (_) {}
  }

  async function startRoom() {
    if (!roomRef || !room || room.status !== 'waiting' || room.hostClientId !== myClientId) return;
    await updateHostSettings();
    try {
      await roomRef.transaction(value => {
        if (!value || value.status !== 'waiting' || value.hostClientId !== myClientId) return;
        const complete = [0, 1, 2].every(i => {
          const type = seatAt(value, i).type;
          return type === 'human' || type === 'bot';
        });
        if (!complete) return;
        value.state = R.initialState(value.includeSpecial !== false);
        value.status = 'playing';
        value.startedAt = Date.now();
        value.updatedAt = Date.now();
        value.winner = null;
        return value;
      }, undefined, false);
    } catch (_) { setRoomStatus('Không bắt đầu được ván.'); }
  }

  function submitMove(move) {
    if (!roomRef || !room || room.status !== 'playing' || mySeat == null) return;
    const expectedTurn = Number(room.state?.turn);
    if (expectedTurn !== mySeat) return;
    roomRef.transaction(value => {
      if (!value || value.status !== 'playing' || !value.state) return;
      const turn = Number(value.state.turn);
      if (turn !== expectedTurn || turn !== mySeat) return;
      const seat = seatAt(value, turn);
      if (seat.type !== 'human' || seat.clientId !== myClientId) return;
      const result = R.makeMove(value.state, move);
      if (!result.ok) return;
      value.state = result.state;
      value.updatedAt = Date.now();
      if (result.state.winner != null) {
        value.status = 'finished';
        value.winner = result.state.winner;
        value.finishedAt = Date.now();
      }
      return value;
    }, (error, committed) => {
      if (error || !committed) setRoomStatus('Nước đi không được đồng bộ — thử lại.');
    }, false);
  }

  function maybeDriveBot(value) {
    if (!roomRef || value.status !== 'playing' || !value.state) return;
    const turn = Number(value.state.turn);
    if (seatAt(value, turn).type !== 'bot') {
      botSignature = null;
      clearTimeout(botTimer);
      botTimer = null;
      Game.setBotThinking(false);
      return;
    }
    const signature = String(value.state.moveNo) + ':' + turn;
    if (botSignature === signature) return;
    botSignature = signature;
    Game.setBotThinking(true);
    clearTimeout(botTimer);
    botTimer = setTimeout(async () => {
      botTimer = null;
      let snap;
      try { snap = await roomRef.once('value'); } catch (_) { Game.setBotThinking(false); return; }
      const latest = snap.val();
      if (!latest || latest.status !== 'playing' || !latest.state) { Game.setBotThinking(false); return; }
      const latestTurn = Number(latest.state.turn);
      if (String(latest.state.moveNo) + ':' + latestTurn !== signature || seatAt(latest, latestTurn).type !== 'bot') { Game.setBotThinking(false); return; }
      const move = Bot.choose(latest.state, latestTurn, latest.botDifficulty || 'hard');
      if (!move) { Game.setBotThinking(false); return; }
      roomRef.transaction(current => {
        if (!current || current.status !== 'playing' || !current.state) return;
        const currentTurn = Number(current.state.turn);
        if (String(current.state.moveNo) + ':' + currentTurn !== signature || seatAt(current, currentTurn).type !== 'bot') return;
        const result = R.makeMove(current.state, move);
        if (!result.ok) return;
        current.state = result.state;
        current.updatedAt = Date.now();
        if (result.state.winner != null) {
          current.status = 'finished';
          current.winner = result.state.winner;
          current.finishedAt = Date.now();
        }
        return current;
      }, undefined, false);
    }, (value.botDifficulty || 'hard') === 'destroyer' ? 700 : 470);
  }

  async function leaveRoom() {
    if (!roomRef || !room) { leaveRoomView(false); return; }
    const currentRoomRef = roomRef;
    const currentRoom = room;
    const currentSeat = mySeat;
    try {
      if (currentRoom.status === 'waiting' && currentRoom.hostClientId === myClientId) {
        await currentRoomRef.remove();
      } else if (currentRoom.status === 'waiting' && currentSeat != null) {
        await currentRoomRef.transaction(value => {
          if (!value || value.status !== 'waiting') return;
          const seat = seatAt(value, currentSeat);
          if (seat.type === 'human' && seat.clientId === myClientId) {
            value.seats[String(currentSeat)] = { type: 'open' };
            value.updatedAt = Date.now();
          }
          return value;
        }, undefined, false);
      }
    } catch (_) {}
    leaveRoomView(true);
  }

  function leaveRoomView(showMessage) {
    if (roomRef && roomHandler) roomRef.off('value', roomHandler);
    detachRoom();
    saveSession(null, null);
    lobbyView.style.display = 'block';
    roomDetail.classList.remove('show');
    setupModal.classList.add('show');
    badge.style.display = 'none';
    Game.attachOnline(adapter);
    if (showMessage) setStatus('Đã rời phòng.');
    watchLobby();
  }

  function copyRoomCode() {
    if (!roomId) return;
    const code = roomId.slice(-5).toUpperCase();
    const text = 'Tam Quốc Kỳ · Phòng #' + code;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => setRoomStatus('Đã copy mã phòng #' + code));
    else setRoomStatus('Mã phòng: #' + code);
  }

  function restoreSession() {
    if (!roomsRef) return;
    let id = null;
    try { id = localStorage.getItem(ROOM_KEY); } catch (_) {}
    if (!id) return;
    roomsRef.child(id).once('value').then(snap => {
      const value = snap.val();
      if (!value) { saveSession(null, null); return; }
      bindRoom(id);
    }).catch(() => {});
  }

  const adapter = {
    submitMove,
    canControl(index) { return room?.status === 'playing' && mySeat === index && seatAt(room, index).type === 'human'; },
    seatLabel(index) { return room ? seatLabel(room, index) : null; },
    backToLobby() { setupModal.classList.add('show'); setMode('online'); if (roomId) renderRoom(room); },
    requestRematch() { setupModal.classList.add('show'); setMode('online'); if (roomId) renderRoom(room); }
  };

  onlineTab.addEventListener('click', () => setMode('online'));
  localTab.addEventListener('click', () => setMode('local'));
  createBtn.addEventListener('click', createRoom);
  refreshBtn.addEventListener('click', () => { stopLobby(); watchLobby(); });
  leaveBtn.addEventListener('click', leaveRoom);
  startRoomBtn.addEventListener('click', startRoom);
  copyRoomBtn.addEventListener('click', copyRoomCode);
  botDifficultyEl.addEventListener('change', updateHostSettings);
  specialPiecesEl.addEventListener('change', updateHostSettings);

  Game.attachOnline(adapter);
  setMode('online');
  watchLobby();
  restoreSession();

  window.ThreeKingdomsOnline = {
    ROOT,
    createRoom,
    takeSeat,
    setSeatBot,
    startRoom,
    submitMove,
    leaveRoom,
    get roomId() { return roomId; },
    get room() { return room; },
    get seat() { return mySeat; }
  };
})();
