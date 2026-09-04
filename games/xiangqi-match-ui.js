(() => {
  'use strict';

  const ROOT = 'xiangqiRooms';
  const ROOM_KEY = 'xiangqiActiveRoom';
  const COLOR_KEY = 'xiangqiActiveColor';
  const CLIENT_KEY = 'xiangqiClientId';
  const TIME_TOTAL_KEY = 'xiangqiTimeTotalSeconds';
  const TIME_TURN_KEY = 'xiangqiTimeTurnSeconds';
  const DEFAULT_TOTAL_SECONDS = 10 * 60;
  const DEFAULT_TURN_SECONDS = 60;
  const gameContainer = document.getElementById('gameContainer');
  const canvasEl = document.getElementById('board');
  const setupPanel = document.getElementById('setupPanel');
  const topBarEl = document.getElementById('topBar');
  if (!gameContainer || !canvasEl || !topBarEl) return;

  const firebaseReady = !!(window.firebase && typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL);
  if (firebaseReady && !firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebaseReady ? firebase.database() : null;

  function readLocal(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function writeLocal(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
  function currentMode() { try { return typeof mode === 'undefined' ? '' : mode; } catch (_) { return ''; } }
  function activeColor() {
    const value = window.XiangqiPresence?.color || readLocal(COLOR_KEY);
    return value === 'r' || value === 'b' ? value : null;
  }
  function activeRoomId() {
    return window.XiangqiPresence?.roomId || readLocal(ROOM_KEY) || null;
  }
  function watchingRoomId() { return window.XiangqiLive?.watchingId || null; }
  function clientId() { return readLocal(CLIENT_KEY) || 'unknown'; }
  function cloneValue(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function samePoint(a, b) { return Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1]; }
  function pieceAt(value, point) {
    if (!Array.isArray(point)) return null;
    return value?.[point[0]]?.[point[1]] || null;
  }
  function formatClock(ms) {
    const safe = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }
  function sideName(color) { return color === 'r' ? 'Đỏ' : 'Đen'; }
  function opposite(color) { return color === 'r' ? 'b' : 'r'; }
  function isTimeControlEnabled(control) {
    if (!control || control.enabled === false) return false;
    return (Number(control.totalSeconds) || 0) > 0 && (Number(control.turnSeconds) || 0) > 0;
  }

  const style = document.createElement('style');
  style.id = 'xiangqi-match-ui-style';
  style.textContent = `
    #xiangqiAssistRail{position:absolute;left:max(8px,env(safe-area-inset-left));top:62px;bottom:10px;z-index:24;width:196px;display:none;flex-direction:column;gap:8px;pointer-events:none;overflow-y:auto;overflow-x:hidden;padding-right:3px;scrollbar-width:thin}
    #xiangqiAssistRail>*{pointer-events:auto;flex:none}
    #xiangqiAssistRail #topBar{position:static!important;left:auto!important;top:auto!important;transform:none!important;width:100%;max-width:none!important;display:none;flex-direction:column;align-items:stretch;gap:7px!important;padding:10px 11px!important;background:rgba(25,16,10,.97)!important;backdrop-filter:blur(9px)!important}
    #xiangqiAssistRail #topBar #turnLabel{font-size:12px;line-height:1.35;text-align:center;padding:2px 0 4px}
    #xiangqiAssistRail #topBar button{width:100%;padding:8px 7px!important;font-size:12px!important}
    #xiangqiAssistRail #onlineBadge{position:static!important;left:auto!important;bottom:auto!important;transform:none!important;width:100%;text-align:center;margin:0!important;border-radius:10px!important;white-space:normal!important;line-height:1.35}
    #xiangqiAssistRail #xiangqiSuggestPanel{position:static!important;left:auto!important;top:auto!important;width:100%!important;max-width:none!important;margin:0!important;padding:9px!important;max-height:230px;overflow:auto}
    .xiangqiRailCard{width:100%;padding:9px 10px;border-radius:12px;background:rgba(18,12,8,.96);border:1px solid rgba(255,214,149,.22);box-shadow:0 8px 22px rgba(0,0,0,.34);color:#fff}
    .xiangqiRailTitle{font-size:11px;font-weight:1000;color:#ffd792;text-transform:uppercase;letter-spacing:.45px;margin-bottom:7px}
    .xiangqiClockRow{display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center;padding:5px 0;border-top:1px solid rgba(255,255,255,.08)}.xiangqiClockRow:first-of-type{border-top:0}.xiangqiClockSide{font-size:11px;font-weight:900}.xiangqiClockMain{font:900 17px ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right}.xiangqiTurnClock{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px;opacity:.76;text-align:right}.xiangqiTurnClock b{font:1000 18px ui-monospace,SFMono-Regular,Consolas,monospace}.xiangqiClockRow.active .xiangqiClockMain{color:#ffe26f}.xiangqiClockRow.danger .xiangqiClockMain,.xiangqiClockRow.danger .xiangqiTurnClock{color:#ff8876}.xiangqiClockOff{padding:12px 6px;text-align:center;font-size:14px;font-weight:1000;color:#ffe7b5;border:1px dashed rgba(255,226,111,.25);border-radius:10px;background:rgba(255,226,111,.06)}
    .capturedGroup{margin-top:7px}.capturedGroup:first-of-type{margin-top:0}.capturedLabel{font-size:10px;font-weight:900;opacity:.72;margin-bottom:4px}.capturedList{display:flex;gap:4px;flex-wrap:wrap}.capturedChip{min-width:27px;height:27px;padding:0 5px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.11);font-size:17px;font-weight:900}.capturedEmpty{font-size:10px;opacity:.52;font-style:italic}
    #xiangqiTimeSettings{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:9px;border-radius:11px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09)}.xiangqiTimeField{display:flex;flex-direction:column;gap:5px}.xiangqiTimeField label{font-size:10px;font-weight:900;opacity:.72;text-transform:uppercase}.xiangqiTimeField select{width:100%;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#fff7e9;color:#2b190c;padding:8px 7px;font-size:12px;font-weight:900;outline:none}.xiangqiTimeField select:disabled{opacity:.45;cursor:not-allowed}
    #xiangqiUndoDialog{position:absolute;inset:0;z-index:110;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,5,3,.68);backdrop-filter:blur(5px)}#xiangqiUndoDialog.show{display:flex}.xiangqiUndoCard{width:min(360px,calc(100vw - 32px));padding:20px;border-radius:16px;background:#24170e;border:1px solid rgba(255,218,157,.28);box-shadow:0 22px 60px rgba(0,0,0,.6);text-align:center}.xiangqiUndoCard h3{margin:0 0 8px;font-size:21px}.xiangqiUndoCard p{margin:0 0 15px;font-size:13px;line-height:1.5;opacity:.86}.xiangqiUndoActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.xiangqiUndoActions button{min-height:43px;border-radius:9px;font-size:13px;font-weight:1000;cursor:pointer}.xiangqiUndoAccept{border:0;background:linear-gradient(180deg,#79df88,#45b85a);color:#0a3511}.xiangqiUndoReject{border:1px solid rgba(255,137,117,.35);background:rgba(133,42,28,.45);color:#ffe1d9}
    #xiangqiToast{position:absolute;left:50%;bottom:18px;z-index:120;transform:translate(-50%,18px);opacity:0;pointer-events:none;max-width:min(430px,calc(100vw - 30px));padding:9px 13px;border-radius:999px;background:rgba(8,7,6,.94);border:1px solid rgba(255,220,165,.23);color:#fff1d6;font-size:12px;font-weight:850;text-align:center;transition:opacity .18s,transform .18s}#xiangqiToast.show{opacity:1;transform:translate(-50%,0)}
    #board{filter:none!important;opacity:1!important;image-rendering:auto;outline:1px solid rgba(255,225,178,.15)}
    #xiangqiLiveChat{height:min(560px,68vh)!important}
    #xiangqiLiveChat.collapsed{height:auto!important;bottom:64px!important;width:min(245px,calc(100vw - 24px))!important}
    #xiangqiLiveChat.collapsed .liveChatHead{box-shadow:0 7px 20px rgba(0,0,0,.38)}
    #globalMusicBtn{right:max(12px,env(safe-area-inset-right))!important;bottom:max(12px,env(safe-area-inset-bottom))!important}
    @media(max-width:760px){#xiangqiAssistRail{width:142px;top:58px}.xiangqiRailCard{padding:7px 8px}.xiangqiClockMain{font-size:14px}#xiangqiAssistRail #topBar{padding:8px!important}#xiangqiAssistRail #topBar button{font-size:11px!important;padding:7px 5px!important}}
    @media(max-width:520px){#xiangqiAssistRail{width:104px;left:6px;top:58px;gap:6px}.xiangqiRailTitle{font-size:9px}.xiangqiClockRow{grid-template-columns:1fr;gap:2px;padding:4px 0}.xiangqiClockMain{text-align:left;font-size:13px}.xiangqiTurnClock{grid-column:auto;text-align:left;font-size:8px}.xiangqiTurnClock b{font-size:18px}.capturedChip{min-width:23px;height:23px;font-size:14px;padding:0 3px}#xiangqiAssistRail #topBar #turnLabel{font-size:10px}#xiangqiAssistRail #topBar button{font-size:10px!important;padding:6px 3px!important}#xiangqiAssistRail #xiangqiSuggestPanel{font-size:9px!important;padding:6px!important;max-height:170px}#xiangqiTimeSettings{grid-template-columns:1fr;padding:7px}.xiangqiTimeField select{padding:7px 6px;font-size:11px}#xiangqiLiveChat{height:min(420px,55vh)!important;right:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important}#xiangqiLiveChat.collapsed{bottom:64px!important;width:min(230px,calc(100vw - 118px))!important}.liveChatTitle{font-size:11px!important}}
  `;
  document.head.appendChild(style);

  const rail = document.createElement('aside');
  rail.id = 'xiangqiAssistRail';
  rail.setAttribute('aria-label', 'Trợ năng ván Cờ Tướng');
  gameContainer.appendChild(rail);
  rail.appendChild(topBarEl);
  const badge = document.getElementById('onlineBadge');
  if (badge) rail.appendChild(badge);
  const suggestPanel = document.getElementById('xiangqiSuggestPanel');
  if (suggestPanel) rail.appendChild(suggestPanel);

  const clockPanel = document.createElement('section');
  clockPanel.id = 'xiangqiClockPanel';
  clockPanel.className = 'xiangqiRailCard';
  clockPanel.innerHTML = '<div class="xiangqiRailTitle">⏱ Đồng hồ</div><div id="xiangqiClockRows"></div>';
  rail.appendChild(clockPanel);
  const clockRows = clockPanel.querySelector('#xiangqiClockRows');

  const capturedPanel = document.createElement('section');
  capturedPanel.id = 'xiangqiCapturedPanel';
  capturedPanel.className = 'xiangqiRailCard';
  capturedPanel.innerHTML = '<div class="xiangqiRailTitle">⚔ Quân đã ăn</div><div id="xiangqiCapturedRows"></div>';
  rail.appendChild(capturedPanel);
  const capturedRows = capturedPanel.querySelector('#xiangqiCapturedRows');

  const undoDialog = document.createElement('div');
  undoDialog.id = 'xiangqiUndoDialog';
  undoDialog.innerHTML = '<div class="xiangqiUndoCard"><h3>↩ Xin Undo</h3><p id="xiangqiUndoText">Đối thủ muốn đi lại nước vừa rồi.</p><div class="xiangqiUndoActions"><button class="xiangqiUndoReject" type="button">Không</button><button class="xiangqiUndoAccept" type="button">OK, Undo</button></div></div>';
  gameContainer.appendChild(undoDialog);
  const undoText = undoDialog.querySelector('#xiangqiUndoText');
  const undoAccept = undoDialog.querySelector('.xiangqiUndoAccept');
  const undoReject = undoDialog.querySelector('.xiangqiUndoReject');

  const toastEl = document.createElement('div');
  toastEl.id = 'xiangqiToast';
  gameContainer.appendChild(toastEl);
  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  let totalSelect = null;
  let turnSelect = null;
  function storedNumber(key, fallback, allowZero = false) {
    const raw = readLocal(key);
    if (raw == null || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    if (allowZero ? value >= 0 : value > 0) return value;
    return fallback;
  }
  function selectedControl() {
    const total = totalSelect ? Number(totalSelect.value) : storedNumber(TIME_TOTAL_KEY, DEFAULT_TOTAL_SECONDS, true);
    const enabled = Number.isFinite(total) && total > 0;
    const turnSeconds = enabled
      ? (turnSelect ? Number(turnSelect.value) : storedNumber(TIME_TURN_KEY, DEFAULT_TURN_SECONDS))
      : 0;
    return {
      enabled,
      totalSeconds: enabled ? total : 0,
      turnSeconds: enabled && Number.isFinite(turnSeconds) && turnSeconds > 0 ? turnSeconds : (enabled ? DEFAULT_TURN_SECONDS : 0)
    };
  }
  if (setupPanel) {
    const settings = document.createElement('div');
    settings.id = 'xiangqiTimeSettings';
    settings.innerHTML = `
      <div class="xiangqiTimeField"><label for="xiangqiTotalTime">Thời gian mỗi bên</label><select id="xiangqiTotalTime"><option value="0">∞ Không tính giờ</option><option value="300">5 phút</option><option value="600">10 phút</option><option value="900">15 phút</option><option value="1800">30 phút</option></select></div>
      <div class="xiangqiTimeField"><label for="xiangqiTurnTime">Giới hạn mỗi lượt</label><select id="xiangqiTurnTime"><option value="15">15 giây</option><option value="30">30 giây</option><option value="60">60 giây</option><option value="120">120 giây</option></select></div>`;
    const firstModeRow = setupPanel.querySelector('.modeRow');
    if (firstModeRow) firstModeRow.insertAdjacentElement('afterend', settings); else setupPanel.prepend(settings);
    totalSelect = settings.querySelector('#xiangqiTotalTime');
    turnSelect = settings.querySelector('#xiangqiTurnTime');
    totalSelect.value = String(storedNumber(TIME_TOTAL_KEY, DEFAULT_TOTAL_SECONDS, true));
    turnSelect.value = String(storedNumber(TIME_TURN_KEY, DEFAULT_TURN_SECONDS));
    const syncTurnAvailability = () => { turnSelect.disabled = totalSelect.value === '0'; };
    const persist = () => {
      writeLocal(TIME_TOTAL_KEY, totalSelect.value);
      writeLocal(TIME_TURN_KEY, turnSelect.value);
      syncTurnAvailability();
    };
    syncTurnAvailability();
    totalSelect.addEventListener('change', persist);
    turnSelect.addEventListener('change', persist);
    document.getElementById('createRoomBtn')?.addEventListener('click', persist);
    document.getElementById('newStartGameBtn')?.addEventListener('click', persist);
  }

  function fitBoard() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const railWidth = vw <= 520 ? 104 : vw <= 760 ? 142 : 196;
    const availableW = Math.max(180, vw - railWidth - 20);
    const availableH = Math.max(220, vh * 0.97);
    const scale = Math.min(availableW / 560, availableH / 640);
    const cssW = Math.max(180, Math.floor(560 * scale));
    const cssH = Math.floor(cssW * 640 / 560);
    canvasEl.style.width = cssW + 'px';
    canvasEl.style.height = cssH + 'px';
    canvasEl.style.transform = 'translateX(' + Math.floor(railWidth / 2) + 'px)';
  }
  fitBoard();
  window.addEventListener('resize', () => requestAnimationFrame(fitBoard));
  window.addEventListener('orientationchange', () => setTimeout(fitBoard, 60));

  let localCaptures = [];
  let localMoveLog = [];
  let localClock = null;
  let captureFx = [];

  function glyph(piece) {
    if (!piece) return '?';
    try { return GLYPH[piece.color][piece.type] || piece.type; } catch (_) { return piece.type || '?'; }
  }
  function renderCaptured(items) {
    const rows = Array.isArray(items) ? items.slice() : [];
    rows.sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    capturedRows.innerHTML = '';
    for (const capturer of ['r', 'b']) {
      const group = document.createElement('div');
      group.className = 'capturedGroup';
      const label = document.createElement('div');
      label.className = 'capturedLabel';
      label.textContent = (capturer === 'r' ? '🔴 Đỏ' : '⚫ Đen') + ' đã ăn';
      const list = document.createElement('div');
      list.className = 'capturedList';
      const mine = rows.filter(row => row.capturedBy === capturer);
      if (!mine.length) {
        const empty = document.createElement('span');
        empty.className = 'capturedEmpty';
        empty.textContent = 'Chưa có';
        list.appendChild(empty);
      } else {
        mine.forEach(row => {
          const chip = document.createElement('span');
          chip.className = 'capturedChip';
          chip.textContent = glyph(row.piece);
          chip.title = 'Ăn lúc ' + new Date(Number(row.at) || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          list.appendChild(chip);
        });
      }
      group.append(label, list);
      capturedRows.appendChild(group);
    }
  }
  renderCaptured([]);

  function drawCaptureEffects(now) {
    const current = Number(now) || performance.now();
    captureFx = captureFx.filter(fx => current - fx.start < fx.duration);
    captureFx.forEach(fx => {
      const t = Math.max(0, Math.min(1, (current - fx.start) / fx.duration));
      const [px, py] = boardToPx(fx.to[0], fx.to[1]);
      const scale = 1 + t * 0.45;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.max(0, 0.78 * (1 - t));
      drawPieceAt(0, 0, fx.piece, fx.to[0], true);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = fx.piece.color === 'r' ? '#ff6c4c' : '#e7edf5';
      ctx.lineWidth = 3 - t * 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 27 + t * 24, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i / 6) + t;
        const distance = 27 + t * 28;
        ctx.beginPath();
        ctx.arc(px + Math.cos(angle) * distance, py + Math.sin(angle) * distance, Math.max(1, 3 * (1 - t)), 0, Math.PI * 2);
        ctx.fillStyle = '#ffd77d';
        ctx.fill();
      }
      ctx.restore();
    });
  }
  try {
    const baseDrawPieces = drawPieces;
    drawPieces = function(now) {
      baseDrawPieces(now);
      drawCaptureEffects(now);
    };
  } catch (_) {}

  function initLocalClock() {
    const control = selectedControl();
    localClock = {
      enabled: control.enabled,
      totalSeconds: control.totalSeconds,
      turnSeconds: control.turnSeconds,
      rMs: control.totalSeconds * 1000,
      bMs: control.totalSeconds * 1000,
      turnStartedAt: Date.now(),
      turn: 'r'
    };
  }
  function localClockSnapshot() { return localClock ? cloneValue(localClock) : null; }
  function localRemaining(color, now = Date.now()) {
    if (!localClock) return { total: 0, turn: 0, disabled: false };
    if (localClock.enabled === false) return { total: 0, turn: 0, disabled: true };
    const base = Number(localClock[color + 'Ms']) || 0;
    const active = localClock.turn === color && gameState === 'playing';
    const elapsed = active ? Math.max(0, now - localClock.turnStartedAt) : 0;
    return { total: Math.max(0, base - elapsed), turn: Math.max(0, localClock.turnSeconds * 1000 - elapsed), disabled: false };
  }
  function finishLocalTimeout(loser, reason) {
    if (gameState !== 'playing' || localClock?.enabled === false) return;
    gameState = 'over';
    winner = opposite(loser);
    overTitle.textContent = (winner === 'r' ? '🔴 Đỏ' : '⚫ Đen') + ' thắng! (' + reason + ')';
    overOverlay.style.display = 'flex';
    toast(sideName(loser) + ' đã hết giờ.');
  }

  try {
    const baseStartGame = startGame;
    startGame = function() {
      localCaptures = [];
      localMoveLog = [];
      captureFx = [];
      initLocalClock();
      const result = baseStartGame();
      renderCaptured(localCaptures);
      return result;
    };
  } catch (_) {}

  let roomRef = null;
  let roomHandler = null;
  let boundRoomId = null;
  let roomShadow = null;
  let lastRoom = null;
  let lastHandledUndoId = null;
  let lastResolvedUndoId = null;
  let resolvingUndo = false;
  let timeoutLock = null;
  let clockSyncLock = null;

  function onlineRemaining(room, color, now = Date.now()) {
    const clock = room?.clock;
    const control = room?.timeControl;
    if (!isTimeControlEnabled(control)) return { total: 0, turn: 0, disabled: true, synchronized: true };
    if (!clock) return { total: control.totalSeconds * 1000, turn: control.turnSeconds * 1000, disabled: false, synchronized: false };
    const base = Number(clock[color + 'Ms']) || 0;
    const active = room.status === 'playing' && room.turn === color;
    const synchronized = !clock.lastTurn || clock.lastTurn === room.turn;
    const provisionalStart = Number(room.updatedAt) || Number(clock.turnStartedAt) || now;
    const startedAt = synchronized ? (Number(clock.turnStartedAt) || provisionalStart) : provisionalStart;
    const elapsed = active ? Math.max(0, now - startedAt) : 0;
    return {
      total: Math.max(0, base - elapsed),
      turn: Math.max(0, Number(control.turnSeconds) * 1000 - elapsed),
      disabled: false,
      synchronized
    };
  }

  function renderClock(room = null) {
    let red;
    let black;
    let activeTurn = null;
    if (room?.timeControl && !isTimeControlEnabled(room.timeControl)) {
      red = black = { disabled: true, total: 0, turn: 0 };
    } else if (room?.clock && room?.timeControl) {
      red = onlineRemaining(room, 'r');
      black = onlineRemaining(room, 'b');
      activeTurn = room.status === 'playing' ? room.turn : null;
    } else if (localClock) {
      red = localRemaining('r');
      black = localRemaining('b');
      try { activeTurn = gameState === 'playing' ? turn : null; } catch (_) { activeTurn = null; }
    } else {
      const fallback = selectedControl();
      if (!fallback.enabled) red = black = { disabled: true, total: 0, turn: 0 };
      else red = black = { disabled: false, total: fallback.totalSeconds * 1000, turn: fallback.turnSeconds * 1000 };
    }
    clockRows.innerHTML = '';
    if (red?.disabled && black?.disabled) {
      clockRows.innerHTML = '<div class="xiangqiClockOff">∞ Không tính giờ</div>';
      return;
    }
    [['r', red], ['b', black]].forEach(([color, value]) => {
      const row = document.createElement('div');
      row.className = 'xiangqiClockRow' + (activeTurn === color ? ' active' : '') + (activeTurn === color && Math.min(value.total, value.turn) <= 10000 ? ' danger' : '');
      row.innerHTML = '<div class="xiangqiClockSide">' + (color === 'r' ? '🔴 Đỏ' : '⚫ Đen') + '</div><div class="xiangqiClockMain">' + formatClock(value.total) + '</div><div class="xiangqiTurnClock"><span>Lượt</span><b>' + formatClock(value.turn) + '</b></div>';
      clockRows.appendChild(row);
    });
  }

  function capturesFromRoom(room) {
    return Object.entries(room?.captures || {}).map(([key, value]) => ({ key, ...(value || {}) }));
  }

  async function ensureTimeControl(room) {
    if (!roomRef || !room || !boundRoomId) return;
    if (currentMode() !== 'online' || activeRoomId() !== boundRoomId) return;
    const me = activeColor();
    if (!room.timeControl && me === 'r') {
      const control = selectedControl();
      try {
        await roomRef.child('timeControl').transaction(value => value || { enabled: control.enabled, totalSeconds: control.totalSeconds, turnSeconds: control.turnSeconds });
      } catch (_) {}
      return;
    }
    if (room.status === 'playing' && isTimeControlEnabled(room.timeControl) && !room.clock) {
      const total = Number(room.timeControl.totalSeconds) * 1000;
      try {
        await roomRef.child('clock').transaction(value => value || { rMs: total, bMs: total, turnStartedAt: Date.now(), lastTurn: room.turn || 'r' });
      } catch (_) {}
    }
  }

  async function syncClockTurn(room) {
    if (!roomRef || !room?.clock || !isTimeControlEnabled(room.timeControl) || room.status !== 'playing') return;
    const previousTurn = room.clock.lastTurn;
    if (!previousTurn || previousTurn === room.turn) return;
    const moveAt = Number(room.updatedAt) || Date.now();
    const signature = previousTurn + '>' + room.turn + ':' + moveAt;
    if (clockSyncLock === signature) return;
    clockSyncLock = signature;
    try {
      await roomRef.transaction(current => {
        if (!current?.clock || current.status !== 'playing' || !isTimeControlEnabled(current.timeControl)) return;
        if (current.turn !== room.turn || current.clock.lastTurn !== previousTurn || Number(current.updatedAt) !== moveAt) return;
        const startedAt = Number(current.clock.turnStartedAt) || moveAt;
        const elapsed = Math.max(0, moveAt - startedAt);
        const field = previousTurn + 'Ms';
        current.clock[field] = Math.max(0, (Number(current.clock[field]) || 0) - elapsed);
        current.clock.turnStartedAt = moveAt;
        current.clock.lastTurn = current.turn;
        return current;
      }, undefined, false);
    } catch (_) {}
    clockSyncLock = null;
  }

  function moveRecordKey(room, move) {
    const at = Number(room.updatedAt) || Date.now();
    return 'm_' + at + '_' + move.from.join('') + '_' + move.to.join('');
  }

  async function persistMoveRecord(before, after) {
    if (!roomRef || !after?.lastMove) return;
    if (currentMode() !== 'online' || activeRoomId() !== boundRoomId) return;
    const mover = before.turn;
    if (activeColor() !== mover) return;
    const move = after.lastMove;
    const key = moveRecordKey(after, move);
    const captured = pieceAt(before.board, move.to);
    const record = {
      mover,
      from: cloneValue(move.from),
      to: cloneValue(move.to),
      boardBefore: cloneValue(before.board),
      turnBefore: before.turn,
      lastMoveBefore: cloneValue(before.lastMove || null),
      clockBefore: cloneValue(before.clock || null),
      movedAt: Number(after.updatedAt) || Date.now()
    };
    try {
      await roomRef.transaction(current => {
        if (!current || Number(current.updatedAt) !== Number(after.updatedAt) || current.turn !== after.turn) return;
        current.moveHistory = current.moveHistory || {};
        if (current.moveHistory[key]) return current;
        current.moveHistory[key] = record;
        if (captured) {
          current.captures = current.captures || {};
          current.captures[key] = { piece: cloneValue(captured), capturedBy: mover, from: cloneValue(move.from), to: cloneValue(move.to), at: record.movedAt };
        }
        if (before.clock && current.clock && isTimeControlEnabled(current.timeControl) && current.clock.lastTurn === mover) {
          const moveAt = record.movedAt;
          const startedAt = Number(before.clock.turnStartedAt) || moveAt;
          const elapsed = Math.max(0, moveAt - startedAt);
          const field = mover + 'Ms';
          current.clock[field] = Math.max(0, (Number(current.clock[field]) || 0) - elapsed);
          current.clock.turnStartedAt = moveAt;
          current.clock.lastTurn = after.turn;
        }
        return current;
      }, undefined, false);
    } catch (_) {}
  }

  function isUndoTransition(room) {
    return room?.lastAction?.type === 'undo' && Number(room.lastAction.at) === Number(room.updatedAt);
  }

  function onRoomValue(room) {
    lastRoom = room;
    renderClock(room);
    renderCaptured(capturesFromRoom(room));
    ensureTimeControl(room);
    syncClockTurn(room);

    if (roomShadow && room && room.turn !== roomShadow.turn && Number(room.updatedAt) !== Number(roomShadow.updatedAt) && !isUndoTransition(room)) {
      const move = room.lastMove;
      if (move && Array.isArray(move.from) && Array.isArray(move.to)) {
        const movingPiece = pieceAt(roomShadow.board, move.from);
        const captured = pieceAt(roomShadow.board, move.to);
        if (movingPiece) {
          try { animAnim = { piece: cloneValue(movingPiece), capturedAt: captured ? cloneValue(move.to) : null, from: cloneValue(move.from), to: cloneValue(move.to), start: performance.now() }; } catch (_) {}
        }
        if (captured) captureFx.push({ piece: cloneValue(captured), to: cloneValue(move.to), start: performance.now(), duration: 420 });
        persistMoveRecord(roomShadow, room);
      }
    }

    const req = room?.undoRequest;
    const playerContext = currentMode() === 'online' && activeRoomId() === boundRoomId;
    const me = playerContext ? activeColor() : null;
    if (req?.state === 'pending' && req.id && me && req.requestedBy !== me && req.id !== lastHandledUndoId) {
      lastHandledUndoId = req.id;
      undoText.textContent = sideName(req.requestedBy) + ' muốn undo nước vừa đi. Đồng ý cho đi lại không?';
      undoDialog.classList.add('show');
    }
    if (req?.id && req.requestedBy === me && req.state !== 'pending' && req.id !== lastResolvedUndoId) {
      lastResolvedUndoId = req.id;
      toast(req.state === 'accepted' ? 'Đối thủ đã đồng ý Undo.' : 'Đối thủ không đồng ý Undo.');
    }

    roomShadow = cloneValue(room);
  }

  function unbindRoom() {
    if (roomRef && roomHandler) roomRef.off('value', roomHandler);
    roomRef = null;
    roomHandler = null;
    boundRoomId = null;
    roomShadow = null;
    lastRoom = null;
    undoDialog.classList.remove('show');
  }

  function bindRoom(id) {
    if (!db || !id || id === boundRoomId) return;
    unbindRoom();
    boundRoomId = id;
    roomRef = db.ref(ROOT).child(id);
    roomHandler = snap => {
      const value = snap.val();
      if (!value) { unbindRoom(); return; }
      onRoomValue(value);
    };
    roomRef.on('value', roomHandler, () => toast('Mất kết nối dữ liệu ván cờ.'));
  }

  function latestHistoryEntry(room) {
    return Object.entries(room?.moveHistory || {})
      .map(([key, value]) => ({ key, ...(value || {}) }))
      .sort((a, b) => (Number(a.movedAt) || 0) - (Number(b.movedAt) || 0))
      .at(-1) || null;
  }

  async function requestOnlineUndo() {
    if (currentMode() !== 'online' || activeRoomId() !== boundRoomId || !roomRef || !lastRoom || lastRoom.status !== 'playing') { toast('Chưa có ván PVP đang chơi.'); return; }
    const me = activeColor();
    if (!me) return;
    const latest = latestHistoryEntry(lastRoom);
    if (!latest) { toast('Nước vừa đi đang được đồng bộ, thử Undo lại ngay sau đó.'); return; }
    if (latest.mover !== me) { toast('Chỉ có thể xin Undo nước vừa đi của bạn.'); return; }
    if (lastRoom.undoRequest?.state === 'pending') { toast('Đang chờ đối thủ trả lời Undo.'); return; }
    const request = {
      id: 'undo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      requestedBy: me,
      historyKey: latest.key,
      state: 'pending',
      requestedAt: Date.now()
    };
    try {
      await roomRef.child('undoRequest').set(request);
      toast('Đã hỏi đối thủ. Chờ họ đồng ý Undo.');
    } catch (_) { toast('Không gửi được yêu cầu Undo.'); }
  }

  async function resolveUndo(accept) {
    if (currentMode() !== 'online' || activeRoomId() !== boundRoomId || !roomRef || resolvingUndo) return;
    const me = activeColor();
    const requestId = lastRoom?.undoRequest?.id;
    if (!me || !requestId) return;
    resolvingUndo = true;
    undoAccept.disabled = true;
    undoReject.disabled = true;
    try {
      await roomRef.transaction(room => {
        if (!room?.undoRequest || room.undoRequest.id !== requestId || room.undoRequest.state !== 'pending' || room.undoRequest.requestedBy === me) return;
        const req = room.undoRequest;
        if (!accept) {
          room.undoRequest = { ...req, state: 'rejected', resolvedAt: Date.now(), resolvedBy: me };
          return room;
        }
        const latest = latestHistoryEntry(room);
        const hist = room.moveHistory?.[req.historyKey];
        if (!hist || !latest || latest.key !== req.historyKey) {
          room.undoRequest = { ...req, state: 'rejected', reason: 'stale', resolvedAt: Date.now(), resolvedBy: me };
          return room;
        }
        const now = Date.now();
        room.board = cloneValue(hist.boardBefore);
        room.turn = hist.turnBefore;
        room.lastMove = cloneValue(hist.lastMoveBefore || null);
        if (hist.clockBefore && isTimeControlEnabled(room.timeControl)) {
          room.clock = cloneValue(hist.clockBefore);
          room.clock.turnStartedAt = now;
          room.clock.lastTurn = hist.turnBefore;
        }
        if (room.moveHistory) delete room.moveHistory[req.historyKey];
        if (room.captures) delete room.captures[req.historyKey];
        room.status = 'playing';
        room.winner = null;
        room.endReason = null;
        delete room.finishedAt;
        room.updatedAt = now;
        room.lastAction = { type: 'undo', id: req.id, at: now };
        room.undoRequest = { ...req, state: 'accepted', resolvedAt: now, resolvedBy: me };
        return room;
      }, undefined, false);
    } catch (_) { toast('Không xử lý được Undo.'); }
    undoDialog.classList.remove('show');
    undoAccept.disabled = false;
    undoReject.disabled = false;
    resolvingUndo = false;
  }
  undoAccept.addEventListener('click', () => resolveUndo(true));
  undoReject.addEventListener('click', () => resolveUndo(false));

  const oldUndo = document.getElementById('undoBtn');
  if (oldUndo) {
    const undoBtn = oldUndo.cloneNode(true);
    oldUndo.replaceWith(undoBtn);
    undoBtn.addEventListener('click', () => {
      if (currentMode() === 'online') { requestOnlineUndo(); return; }
      if (gameState !== 'playing' || !localMoveLog.length) return;
      const log = localMoveLog.pop();
      try { undoMove(); } catch (_) { return; }
      if (log?.captured) localCaptures.pop();
      if (log?.clockBefore) localClock = cloneValue(log.clockBefore);
      captureFx = [];
      renderCaptured(localCaptures);
      renderClock();
    });
  }

  async function enforceOnlineTimeout(room) {
    if (!roomRef || !room?.clock || !isTimeControlEnabled(room?.timeControl) || room.status !== 'playing') return false;
    if (room.clock.lastTurn && room.clock.lastTurn !== room.turn) return false;
    const loser = room.turn;
    const remain = onlineRemaining(room, loser);
    if (remain.disabled || !remain.synchronized) return false;
    const reason = remain.total <= 0 ? 'hết giờ tổng' : remain.turn <= 0 ? 'hết giờ lượt' : null;
    if (!reason) return false;
    const signature = loser + ':' + room.clock.turnStartedAt + ':' + reason;
    if (timeoutLock === signature) return true;
    timeoutLock = signature;
    try {
      await roomRef.transaction(value => {
        if (!value || value.status !== 'playing' || value.turn !== loser || !isTimeControlEnabled(value.timeControl)) return;
        if (value.clock?.lastTurn && value.clock.lastTurn !== value.turn) return;
        if (Number(value.clock?.turnStartedAt) !== Number(room.clock.turnStartedAt)) return;
        const check = onlineRemaining(value, loser);
        if (check.disabled || !check.synchronized) return;
        const finalReason = check.total <= 0 ? 'hết giờ tổng' : check.turn <= 0 ? 'hết giờ lượt' : null;
        if (!finalReason) return;
        const now = Date.now();
        value.status = 'finished';
        value.winner = opposite(loser);
        value.timeoutLoser = loser;
        value.endReason = finalReason;
        value.finishedAt = now;
        value.updatedAt = now;
        value.lastAction = { type: 'timeout', at: now, loser };
        return value;
      }, undefined, false);
    } catch (_) {}
    return true;
  }

  try {
    const basePerformMove = performMove;
    performMove = function(from, to) {
      if (currentMode() === 'online') {
        if (lastRoom && lastRoom.status === 'playing' && isTimeControlEnabled(lastRoom.timeControl)) {
          const remain = onlineRemaining(lastRoom, lastRoom.turn);
          if (!remain.disabled && remain.synchronized && (remain.total <= 0 || remain.turn <= 0)) { enforceOnlineTimeout(lastRoom); return; }
        }
        return basePerformMove(from, to);
      }
      const mover = turn;
      if (!localClock) initLocalClock();
      const remain = localRemaining(mover);
      if (!remain.disabled && (remain.total <= 0 || remain.turn <= 0)) { finishLocalTimeout(mover, remain.total <= 0 ? 'hết giờ tổng' : 'hết giờ lượt'); return; }
      const captured = cloneValue(board?.[to[0]]?.[to[1]] || null);
      const clockBefore = localClockSnapshot();
      const at = Date.now();
      if (!remain.disabled) localClock[mover + 'Ms'] = remain.total;
      localMoveLog.push({ captured: !!captured, clockBefore });
      if (captured) {
        localCaptures.push({ piece: captured, capturedBy: mover, from: cloneValue(from), to: cloneValue(to), at });
        captureFx.push({ piece: captured, to: cloneValue(to), start: performance.now(), duration: 420 });
      }
      const result = basePerformMove(from, to);
      localClock.turn = opposite(mover);
      localClock.turnStartedAt = Date.now();
      renderCaptured(localCaptures);
      renderClock();
      return result;
    };
  } catch (_) {}

  function syncRoomBinding() {
    const id = watchingRoomId() || (currentMode() === 'online' ? activeRoomId() : null);
    if (id && id !== boundRoomId) bindRoom(id);
    if (!id && boundRoomId) unbindRoom();
  }

  function syncRail() {
    let state = '';
    try { state = gameState; } catch (_) {}
    const show = !!watchingRoomId() || state === 'playing' || state === 'over' || topBarEl.style.display === 'flex';
    rail.style.display = show ? 'flex' : 'none';
    if (!boundRoomId) {
      renderClock();
      renderCaptured(localCaptures);
    }
  }

  setInterval(() => {
    syncRoomBinding();
    syncRail();
    if (lastRoom?.status === 'playing') {
      renderClock(lastRoom);
      if (isTimeControlEnabled(lastRoom.timeControl)) {
        syncClockTurn(lastRoom);
        enforceOnlineTimeout(lastRoom);
      }
    } else if (localClock) {
      renderClock();
      if (gameState === 'playing' && localClock.enabled !== false) {
        const current = turn;
        const remain = localRemaining(current);
        if (!remain.disabled && (remain.total <= 0 || remain.turn <= 0)) finishLocalTimeout(current, remain.total <= 0 ? 'hết giờ tổng' : 'hết giờ lượt');
      }
    }
  }, 250);

  syncRoomBinding();
  syncRail();
  renderClock();

  window.XiangqiMatchUI = {
    requestUndo: requestOnlineUndo,
    enforceTimeout: enforceOnlineTimeout,
    selectedControl,
    fitBoard,
    get roomId() { return boundRoomId; },
    get room() { return lastRoom; }
  };
})();
