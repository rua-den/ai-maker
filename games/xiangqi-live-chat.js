(() => {
  'use strict';

  const ROOT = 'xiangqiRooms';
  const ROOM_KEY = 'xiangqiActiveRoom';
  const COLOR_KEY = 'xiangqiActiveColor';
  const CHAT_NAME_KEY = 'xiangqiChatName';
  const ONLINE_NAME_KEY = 'xiangqiOnlineName';
  const CHAT_ID_KEY = 'xiangqiChatViewerId';
  const MAX_MESSAGE = 180;

  if (!window.firebase || typeof firebaseConfig === 'undefined' || !firebaseConfig.databaseURL) return;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db = firebase.database();
  const gameContainer = document.getElementById('gameContainer');
  if (!gameContainer) return;

  const style = document.createElement('style');
  style.id = 'xiangqi-live-chat-style';
  style.textContent = `
    #xiangqiLiveChat{position:absolute;right:12px;bottom:12px;z-index:26;width:min(330px,calc(100vw - 24px));height:min(390px,48vh);display:none;flex-direction:column;border-radius:15px;overflow:hidden;background:rgba(20,14,10,.95);border:1px solid rgba(255,210,150,.22);box-shadow:0 16px 40px rgba(0,0,0,.46);backdrop-filter:blur(9px)}
    #xiangqiLiveChat.show{display:flex}#xiangqiLiveChat.collapsed{height:auto}#xiangqiLiveChat.collapsed .liveChatBody,#xiangqiLiveChat.collapsed .liveChatComposer{display:none}
    .liveChatHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;background:rgba(255,255,255,.055);border-bottom:1px solid rgba(255,255,255,.08)}
    .liveChatTitle{font-size:12px;font-weight:1000;color:#ffdca6;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.liveChatToggle{border:0;border-radius:8px;background:rgba(255,255,255,.1);color:#fff;font-weight:900;cursor:pointer;padding:5px 8px;flex:none}
    .liveChatBody{flex:1;min-height:0;overflow:auto;padding:9px;display:flex;flex-direction:column;gap:7px;scrollbar-width:thin}
    .liveChatEmpty{text-align:center;opacity:.56;font-size:11px;padding:24px 8px}.liveMsg{display:flex;flex-direction:column;gap:2px;padding:7px 8px;border-radius:10px;background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.055)}
    .liveMsg.playerRed{border-color:rgba(238,91,69,.28);background:rgba(171,54,37,.12)}.liveMsg.playerBlack{border-color:rgba(207,218,232,.2);background:rgba(151,164,182,.08)}
    .liveMsgMeta{display:flex;justify-content:space-between;gap:8px;font-size:10px;opacity:.72}.liveMsgName{font-weight:1000;color:#ffd28f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.liveMsgTime{flex:none}.liveMsgText{font-size:12px;line-height:1.42;white-space:pre-wrap;overflow-wrap:anywhere}
    .liveChatComposer{display:grid;grid-template-columns:88px 1fr auto;gap:6px;padding:8px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.14)}
    .liveChatComposer input{min-width:0;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:#fff8ec;color:#2b1a0e;padding:8px 9px;font:inherit;font-size:12px;font-weight:800;outline:none}.liveChatComposer input:focus{border-color:#f0b35d}.liveChatComposer input:disabled{opacity:.82;background:#eadcc7;color:#4b3421}
    #liveChatSend{border:0;border-radius:9px;background:linear-gradient(180deg,#f3b75f,#d98c2a);color:#3f2300;font-weight:1000;cursor:pointer;padding:7px 10px}#liveChatSend:disabled{opacity:.45;cursor:default}
    @media(max-width:520px){#xiangqiLiveChat{right:8px;bottom:8px;width:calc(100vw - 16px);height:min(255px,36vh)}.liveChatComposer{grid-template-columns:72px 1fr auto;padding:6px}.liveChatComposer input{padding:7px;font-size:11px}.liveChatBody{padding:7px}.liveMsgText{font-size:11px}}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('aside');
  panel.id = 'xiangqiLiveChat';
  panel.setAttribute('aria-label', 'Chat trận Cờ Tướng');
  panel.innerHTML = `
    <div class="liveChatHead">
      <div id="liveChatTitle" class="liveChatTitle">💬 Chat trận đấu</div>
      <button id="liveChatToggle" class="liveChatToggle" type="button">−</button>
    </div>
    <div id="liveChatBody" class="liveChatBody"><div class="liveChatEmpty">Vào trận hoặc livestream để chém gió 😄</div></div>
    <form id="liveChatComposer" class="liveChatComposer" autocomplete="off">
      <input id="liveChatName" maxlength="16" aria-label="Tên chat" placeholder="Tên">
      <input id="liveChatText" maxlength="${MAX_MESSAGE}" aria-label="Tin nhắn" placeholder="Chém gió gì đi…">
      <button id="liveChatSend" type="submit">Gửi</button>
    </form>
  `;
  gameContainer.appendChild(panel);

  const titleEl = panel.querySelector('#liveChatTitle');
  const body = panel.querySelector('#liveChatBody');
  const form = panel.querySelector('#liveChatComposer');
  const nameInput = panel.querySelector('#liveChatName');
  const textInput = panel.querySelector('#liveChatText');
  const sendBtn = panel.querySelector('#liveChatSend');
  const toggleBtn = panel.querySelector('#liveChatToggle');

  function readLocal(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function saveLocal(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function cleanName(value) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 16); }
  function cleanText(value) { return String(value || '').trim().slice(0, MAX_MESSAGE); }
  function chatId() {
    try {
      let id = sessionStorage.getItem(CHAT_ID_KEY);
      if (!id) {
        id = 'chat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(CHAT_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return 'chat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    }
  }
  const myChatId = chatId();
  nameInput.value = readLocal(CHAT_NAME_KEY) || readLocal(ONLINE_NAME_KEY) || '';

  let activeRoomId = null;
  let activeContext = null;
  let chatRef = null;
  let chatQuery = null;
  let chatHandler = null;
  let pollTimer = null;
  let lastSentAt = 0;
  let mobilePlayerCollapsed = false;

  function formatTime(ts) {
    const d = new Date(Number(ts) || Date.now());
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  function roleLabel(role) {
    if (role === 'red') return '🔴';
    if (role === 'black') return '⚫';
    return '👁';
  }

  function renderMessages(items) {
    body.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'liveChatEmpty';
      empty.textContent = 'Chưa ai nói gì. Mở hàng đi 😄';
      body.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'liveMsg';
      if (item.role === 'red') row.classList.add('playerRed');
      if (item.role === 'black') row.classList.add('playerBlack');
      const meta = document.createElement('div');
      meta.className = 'liveMsgMeta';
      const who = document.createElement('span');
      who.className = 'liveMsgName';
      who.textContent = roleLabel(item.role) + ' ' + (item.name || 'Khán giả');
      const time = document.createElement('span');
      time.className = 'liveMsgTime';
      time.textContent = formatTime(item.createdAt);
      meta.append(who, time);
      const text = document.createElement('div');
      text.className = 'liveMsgText';
      text.textContent = item.text || '';
      row.append(meta, text);
      body.appendChild(row);
    }
    body.scrollTop = body.scrollHeight;
  }

  function currentMode() {
    try { return typeof mode === 'undefined' ? '' : mode; } catch (_) { return ''; }
  }

  function resolveChatContext() {
    const liveRoomId = window.XiangqiLive?.watchingId || null;
    if (liveRoomId) return { roomId: liveRoomId, kind: 'spectator', role: 'spectator', color: null };

    const onlineMode = currentMode() === 'online';
    if (!onlineMode) return null;
    const presenceRoomId = window.XiangqiPresence?.roomId || null;
    const presenceColor = window.XiangqiPresence?.color || null;
    const roomId = presenceRoomId || readLocal(ROOM_KEY);
    const color = presenceColor || readLocal(COLOR_KEY);
    if (!roomId || (color !== 'r' && color !== 'b')) return null;
    return { roomId, kind: 'player', role: color === 'r' ? 'red' : 'black', color };
  }

  function applyContextUi(context) {
    activeContext = context;
    const player = context?.kind === 'player';
    if (player) {
      const side = context.color === 'r' ? 'Đỏ' : 'Đen';
      titleEl.textContent = '💬 Chat trận đấu · Bạn: ' + side;
      const onlineName = cleanName(readLocal(ONLINE_NAME_KEY)) || (context.color === 'r' ? 'Đỏ' : 'Đen');
      nameInput.value = onlineName;
      nameInput.disabled = true;
      if (!mobilePlayerCollapsed && window.matchMedia?.('(max-width: 520px)').matches) {
        panel.classList.add('collapsed');
        toggleBtn.textContent = '+';
        mobilePlayerCollapsed = true;
      }
    } else {
      titleEl.textContent = '💬 Chat LIVE · Khán giả';
      nameInput.disabled = false;
      nameInput.value = cleanName(readLocal(CHAT_NAME_KEY)) || cleanName(readLocal(ONLINE_NAME_KEY)) || nameInput.value || '';
      panel.classList.remove('collapsed');
      toggleBtn.textContent = '−';
    }
  }

  function unbindChat() {
    if (chatQuery && chatHandler) chatQuery.off('value', chatHandler);
    chatQuery = null;
    chatHandler = null;
    chatRef = null;
    activeRoomId = null;
    activeContext = null;
    nameInput.disabled = false;
    panel.classList.remove('show');
    body.innerHTML = '<div class="liveChatEmpty">Vào trận hoặc livestream để chém gió 😄</div>';
  }

  function bindChat(context) {
    const roomId = context?.roomId;
    if (!roomId) return;
    if (roomId === activeRoomId) {
      applyContextUi(context);
      return;
    }
    unbindChat();
    activeRoomId = roomId;
    applyContextUi(context);
    chatRef = db.ref(ROOT).child(roomId).child('chat');
    chatQuery = chatRef.orderByChild('createdAt').limitToLast(80);
    chatHandler = snap => {
      const items = [];
      snap.forEach(child => {
        const value = child.val() || {};
        if (value.text) items.push(value);
      });
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      renderMessages(items);
    };
    chatQuery.on('value', chatHandler, () => {
      body.innerHTML = '<div class="liveChatEmpty">Không tải được chat.</div>';
    });
    panel.classList.add('show');
  }

  async function sendMessage() {
    if (!chatRef || !activeRoomId || !activeContext) return;
    const now = Date.now();
    if (now - lastSentAt < 700) return;
    const isPlayer = activeContext.kind === 'player';
    const fallbackPlayerName = activeContext.color === 'r' ? 'Đỏ' : 'Đen';
    const name = isPlayer
      ? (cleanName(readLocal(ONLINE_NAME_KEY)) || fallbackPlayerName)
      : (cleanName(nameInput.value) || 'Khán giả');
    const text = cleanText(textInput.value);
    if (!text) return;
    if (!isPlayer) saveLocal(CHAT_NAME_KEY, name);
    nameInput.value = name;
    textInput.value = '';
    lastSentAt = now;
    sendBtn.disabled = true;
    try {
      await chatRef.push().set({
        name,
        text,
        role: activeContext.role || 'spectator',
        senderId: myChatId,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (_) {
      textInput.value = text;
    } finally {
      setTimeout(() => { sendBtn.disabled = false; }, 450);
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    sendMessage();
  });
  nameInput.addEventListener('change', () => {
    if (activeContext?.kind === 'player') return;
    const name = cleanName(nameInput.value);
    nameInput.value = name;
    if (name) saveLocal(CHAT_NAME_KEY, name);
  });
  toggleBtn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    toggleBtn.textContent = collapsed ? '+' : '−';
  });

  function syncChatRoom() {
    const context = resolveChatContext();
    if (context && (context.roomId !== activeRoomId || context.kind !== activeContext?.kind || context.color !== activeContext?.color)) {
      bindChat(context);
    } else if (!context && activeRoomId) {
      unbindChat();
    }
  }

  pollTimer = setInterval(syncChatRoom, 250);
  syncChatRoom();
  window.addEventListener('pagehide', () => {
    if (pollTimer) clearInterval(pollTimer);
    unbindChat();
  });

  window.XiangqiLiveChat = {
    bindChat,
    unbindChat,
    sendMessage,
    resolveChatContext,
    get roomId() { return activeRoomId; },
    get context() { return activeContext; }
  };
})();
