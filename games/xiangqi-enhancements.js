(() => {
  'use strict';

  const ROOT = 'xiangqiRooms';
  const ROOM_KEY = 'xiangqiActiveRoom';
  const COLOR_KEY = 'xiangqiActiveColor';
  const CHAT_NAME_KEY = 'xiangqiChatName';
  const ONLINE_NAME_KEY = 'xiangqiOnlineName';
  const SUGGEST_ID_KEY = 'xiangqiSuggestViewerId';

  if (!window.firebase || typeof firebaseConfig === 'undefined' || !firebaseConfig.databaseURL) return;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const db = firebase.database();
  const gameContainer = document.getElementById('gameContainer');
  const canvasEl = document.getElementById('board');
  if (!gameContainer || !canvasEl) return;

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  // ============================================================
  // 1) Board orientation: your own side must always be at bottom.
  // ============================================================
  const baseBoardToPx = boardToPx;
  const baseGetBoardCell = getBoardCell;

  function currentMode() {
    try { return typeof mode === 'undefined' ? '' : mode; } catch (_) { return ''; }
  }

  function playerSide() {
    const m = currentMode();
    if (m === 'online') {
      const color = window.XiangqiPresence?.color || readLocal(COLOR_KEY);
      return color === 'b' ? 'b' : 'r';
    }
    if (m === 'bot') {
      try { return humanColor === 'b' ? 'b' : 'r'; } catch (_) { return 'r'; }
    }
    return 'r';
  }

  function isBoardFlipped() {
    return playerSide() === 'b';
  }

  boardToPx = function(r, c) {
    return isBoardFlipped() ? baseBoardToPx(9 - r, 8 - c) : baseBoardToPx(r, c);
  };

  getBoardCell = function(evt) {
    const cell = baseGetBoardCell(evt);
    if (!isBoardFlipped()) return cell;
    return { row: 9 - cell.row, col: 8 - cell.col };
  };

  window.XiangqiBoardView = {
    isFlipped: isBoardFlipped,
    side: playerSide
  };

  // ============================================================
  // 2) Chat contrast polish — readable over the board on every phone.
  // The chat module is loaded later; CSS selectors still apply when it mounts.
  // ============================================================
  const style = document.createElement('style');
  style.id = 'xiangqi-enhancements-style';
  style.textContent = `
    #xiangqiLiveChat{color:#fffdf8!important;background:rgba(10,7,5,.985)!important;border-color:rgba(255,211,142,.4)!important;box-shadow:0 18px 46px rgba(0,0,0,.72)!important}
    #xiangqiLiveChat .liveChatHead{background:rgba(255,255,255,.095)!important;border-bottom-color:rgba(255,255,255,.16)!important}
    #xiangqiLiveChat .liveChatTitle{color:#ffe3a8!important;text-shadow:0 1px 3px #000!important}
    #xiangqiLiveChat .liveMsg{background:rgba(255,255,255,.115)!important;border-color:rgba(255,255,255,.15)!important}
    #xiangqiLiveChat .liveMsg.playerRed{background:rgba(150,42,26,.36)!important;border-color:rgba(255,111,84,.45)!important}
    #xiangqiLiveChat .liveMsg.playerBlack{background:rgba(102,115,132,.26)!important;border-color:rgba(219,230,245,.32)!important}
    #xiangqiLiveChat .liveMsgText{color:#fff!important;font-weight:750!important;text-shadow:0 1px 2px rgba(0,0,0,.85)!important}
    #xiangqiLiveChat .liveMsgMeta{opacity:1!important;color:#e8edf2!important}
    #xiangqiLiveChat .liveMsgName{color:#ffd37d!important;text-shadow:0 1px 2px #000!important}
    #xiangqiLiveChat .liveChatEmpty{color:#e5e5e5!important;opacity:.82!important}

    #xiangqiSuggestPanel{position:absolute;left:12px;top:72px;z-index:25;display:none;width:min(292px,calc(100vw - 24px));padding:10px 11px;border-radius:13px;background:rgba(11,20,25,.94);border:1px solid rgba(117,224,237,.35);box-shadow:0 10px 30px rgba(0,0,0,.42);color:#f5ffff;font-size:11px;line-height:1.42;backdrop-filter:blur(8px)}
    #xiangqiSuggestPanel.show{display:block}.suggestHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.suggestTitle{font-size:12px;font-weight:1000;color:#9ef5ff}.suggestTurn{font-size:10px;font-weight:900;opacity:.75}.suggestHint{color:#fff;font-weight:750}.suggestOwn{margin-top:5px;color:#ffe79c;font-weight:900}.suggestList{margin-top:6px;display:flex;flex-direction:column;gap:4px}.suggestRow{display:flex;gap:7px;align-items:center;padding:5px 7px;border-radius:8px;background:rgba(255,255,255,.08)}.suggestCount{flex:none;min-width:30px;color:#7ff3ff;font-weight:1000}.suggestMove{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800}.suggestEmpty{opacity:.65;font-style:italic}
    @media(max-width:520px){#xiangqiSuggestPanel{left:8px;top:164px;width:min(270px,calc(100vw - 16px));padding:8px 9px}.suggestRow{padding:4px 6px}}
  `;
  document.head.appendChild(style);

  // ============================================================
  // 3) Spectator move suggestions.
  // Each spectator owns exactly one current vote. Players see the crowd's
  // top suggestions rendered both as a list and as arrows on the board.
  // ============================================================
  const panel = document.createElement('section');
  panel.id = 'xiangqiSuggestPanel';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="suggestHead"><div class="suggestTitle">💡 Khán giả suggest</div><div id="suggestTurn" class="suggestTurn"></div></div>
    <div id="suggestHint" class="suggestHint"></div>
    <div id="suggestOwn" class="suggestOwn"></div>
    <div id="suggestList" class="suggestList"></div>
  `;
  gameContainer.appendChild(panel);

  const suggestTurnEl = panel.querySelector('#suggestTurn');
  const suggestHintEl = panel.querySelector('#suggestHint');
  const suggestOwnEl = panel.querySelector('#suggestOwn');
  const suggestListEl = panel.querySelector('#suggestList');

  function suggestViewerId() {
    try {
      let id = sessionStorage.getItem(SUGGEST_ID_KEY);
      if (!id) {
        id = 'sg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(SUGGEST_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return 'sg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    }
  }
  const mySuggestId = suggestViewerId();

  let activeRoomId = null;
  let activeKind = null;
  let suggestionsRef = null;
  let suggestionsHandler = null;
  let myVoteDisconnect = null;
  let suggestionRows = [];
  let selectedFrom = null;
  let selectedTargets = [];
  let myVote = null;
  let pollTimer = null;
  let lastTouchAt = 0;

  function currentTurn() {
    try { return turn === 'b' ? 'b' : 'r'; } catch (_) { return 'r'; }
  }

  function currentBoard() {
    try { return board; } catch (_) { return null; }
  }

  function spectatorRoomId() {
    return window.XiangqiLive?.watchingId || null;
  }

  function playerRoomId() {
    if (currentMode() !== 'online') return null;
    return window.XiangqiPresence?.roomId || readLocal(ROOM_KEY) || null;
  }

  function resolveContext() {
    const watch = spectatorRoomId();
    if (watch) return { roomId: watch, kind: 'spectator' };
    const play = playerRoomId();
    if (play) return { roomId: play, kind: 'player' };
    return null;
  }

  function pieceGlyph(move) {
    const b = currentBoard();
    const p = b?.[move.from?.[0]]?.[move.from?.[1]];
    try { return p ? GLYPH[p.color][p.type] : 'Quân'; } catch (_) { return 'Quân'; }
  }

  function moveLabel(move) {
    const from = move.from || [0, 0], to = move.to || [0, 0];
    return pieceGlyph(move) + ' (' + (from[0] + 1) + ',' + (from[1] + 1) + ') → (' + (to[0] + 1) + ',' + (to[1] + 1) + ')';
  }

  function cleanName() {
    return String(readLocal(CHAT_NAME_KEY) || readLocal(ONLINE_NAME_KEY) || 'Khán giả').trim().slice(0, 16) || 'Khán giả';
  }

  function aggregate(raw) {
    const t = currentTurn();
    const map = new Map();
    Object.entries(raw || {}).forEach(([id, vote]) => {
      if (!vote || vote.turn !== t || !Array.isArray(vote.from) || !Array.isArray(vote.to)) return;
      const key = vote.from.join('_') + '__' + vote.to.join('_');
      let row = map.get(key);
      if (!row) {
        row = { from: vote.from, to: vote.to, count: 0, names: [], key };
        map.set(key, row);
      }
      row.count++;
      if (vote.name && row.names.length < 3) row.names.push(vote.name);
      if (id === mySuggestId) myVote = vote;
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, 5);
  }

  function renderPanel() {
    const context = resolveContext();
    const t = currentTurn();
    if (!context || !activeRoomId) {
      panel.classList.remove('show');
      return;
    }
    panel.classList.add('show');
    suggestTurnEl.textContent = 'Lượt ' + (t === 'r' ? 'Đỏ' : 'Đen');

    if (context.kind === 'spectator') {
      if (selectedFrom) {
        const p = currentBoard()?.[selectedFrom[0]]?.[selectedFrom[1]];
        let glyph = 'quân';
        try { if (p) glyph = GLYPH[p.color][p.type]; } catch (_) {}
        suggestHintEl.textContent = 'Đã chọn ' + glyph + ' — chạm ô đích để suggest.';
      } else {
        suggestHintEl.textContent = 'Chạm quân của bên đang đi → chạm ô đích để suggest nước.';
      }
      suggestOwnEl.textContent = myVote && myVote.turn === t ? '✓ Suggest của bạn: ' + moveLabel(myVote) : '';
    } else {
      suggestHintEl.textContent = suggestionRows.length ? 'Top nước khán giả đang vote:' : 'Chưa có khán giả suggest nước nào.';
      suggestOwnEl.textContent = '';
    }

    suggestListEl.innerHTML = '';
    if (!suggestionRows.length) {
      const empty = document.createElement('div');
      empty.className = 'suggestEmpty';
      empty.textContent = context.kind === 'spectator' ? 'Chưa có vote nào cho lượt này.' : '';
      suggestListEl.appendChild(empty);
      return;
    }
    suggestionRows.slice(0, 3).forEach(row => {
      const el = document.createElement('div');
      el.className = 'suggestRow';
      const count = document.createElement('span');
      count.className = 'suggestCount';
      count.textContent = '×' + row.count;
      const move = document.createElement('span');
      move.className = 'suggestMove';
      move.textContent = moveLabel(row);
      el.append(count, move);
      suggestListEl.appendChild(el);
    });
  }

  async function clearMyVoteDisconnect() {
    try { if (myVoteDisconnect) await myVoteDisconnect.cancel(); } catch (_) {}
    myVoteDisconnect = null;
  }

  function unbindSuggestions() {
    if (suggestionsRef && suggestionsHandler) suggestionsRef.off('value', suggestionsHandler);
    suggestionsHandler = null;
    suggestionsRef = null;
    clearMyVoteDisconnect();
    activeRoomId = null;
    activeKind = null;
    suggestionRows = [];
    selectedFrom = null;
    selectedTargets = [];
    myVote = null;
    panel.classList.remove('show');
  }

  function bindSuggestions(context) {
    if (!context?.roomId) return;
    if (activeRoomId === context.roomId && activeKind === context.kind) return;
    unbindSuggestions();
    activeRoomId = context.roomId;
    activeKind = context.kind;
    suggestionsRef = db.ref(ROOT).child(activeRoomId).child('suggestions');
    suggestionsHandler = snap => {
      myVote = null;
      suggestionRows = aggregate(snap.val());
      renderPanel();
    };
    suggestionsRef.on('value', suggestionsHandler, () => {
      suggestionRows = [];
      renderPanel();
    });
    renderPanel();
  }

  async function voteMove(from, to) {
    if (!suggestionsRef || activeKind !== 'spectator') return;
    const voteRef = suggestionsRef.child(mySuggestId);
    const vote = {
      from: [from[0], from[1]],
      to: [to[0], to[1]],
      turn: currentTurn(),
      name: cleanName(),
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    try {
      await voteRef.set(vote);
      myVote = vote;
      await clearMyVoteDisconnect();
      myVoteDisconnect = voteRef.onDisconnect();
      await myVoteDisconnect.remove();
    } catch (_) {}
    selectedFrom = null;
    selectedTargets = [];
    renderPanel();
  }

  function handleSuggestTap(evt) {
    if (currentMode() !== 'spectator' || !spectatorRoomId() || !activeRoomId) return;
    const b = currentBoard();
    if (!b) return;
    const { row, col } = getBoardCell(evt);
    if (!inBounds(row, col)) return;
    const p = b[row]?.[col] || null;
    const t = currentTurn();

    if (selectedFrom) {
      const legal = selectedTargets.some(([r, c]) => r === row && c === col);
      if (legal) {
        voteMove(selectedFrom, [row, col]);
        return;
      }
      if (p && p.color === t) {
        selectedFrom = [row, col];
        selectedTargets = legalMovesForPiece(b, row, col);
        renderPanel();
        return;
      }
      selectedFrom = null;
      selectedTargets = [];
      renderPanel();
      return;
    }

    if (p && p.color === t) {
      selectedFrom = [row, col];
      selectedTargets = legalMovesForPiece(b, row, col);
      renderPanel();
    }
  }

  // Register before xiangqi-live.js. That module blocks spectator board input
  // afterwards, so suggestions are captured without ever becoming real moves.
  canvasEl.addEventListener('touchstart', evt => {
    if (currentMode() !== 'spectator') return;
    lastTouchAt = Date.now();
    handleSuggestTap(evt);
  }, { capture: true, passive: true });
  canvasEl.addEventListener('click', evt => {
    if (currentMode() !== 'spectator' || Date.now() - lastTouchAt < 650) return;
    handleSuggestTap(evt);
  }, true);

  const baseDrawSelection = drawSelection;
  drawSelection = function() {
    baseDrawSelection();
    const t = currentTurn();
    const context = resolveContext();
    if (!context || !activeRoomId) return;

    // Spectator's in-progress selection.
    if (context.kind === 'spectator' && selectedFrom) {
      const [sx, sy] = boardToPx(selectedFrom[0], selectedFrom[1]);
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(76,234,255,.95)'; ctx.lineWidth = 4; ctx.stroke();
      selectedTargets.forEach(([r, c]) => {
        const [x, y] = boardToPx(r, c);
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(76,234,255,.6)'; ctx.fill();
      });
      ctx.restore();
    }

    // Crowd's top 3 suggestions, visible to both players and spectators.
    suggestionRows.slice(0, 3).forEach((row, index) => {
      if (!row || t !== currentTurn()) return;
      const [x1, y1] = boardToPx(row.from[0], row.from[1]);
      const [x2, y2] = boardToPx(row.to[0], row.to[1]);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len, uy = dy / len;
      const startX = x1 + ux * 28, startY = y1 + uy * 28;
      const endX = x2 - ux * 28, endY = y2 - uy * 28;
      const alpha = index === 0 ? .92 : index === 1 ? .64 : .45;
      ctx.save();
      ctx.strokeStyle = 'rgba(71,231,255,' + alpha + ')';
      ctx.fillStyle = 'rgba(71,231,255,' + alpha + ')';
      ctx.lineWidth = index === 0 ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
      const head = 10;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - ux * head - uy * head * .65, endY - uy * head + ux * head * .65);
      ctx.lineTo(endX - ux * head + uy * head * .65, endY - uy * head - ux * head * .65);
      ctx.closePath(); ctx.fill();
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,32,38,.88)'; ctx.fill();
      ctx.fillStyle = '#baf9ff'; ctx.font = '900 11px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(row.count), mx, my + .5);
      ctx.restore();
    });
  };

  function syncContext() {
    const context = resolveContext();
    if (context && (context.roomId !== activeRoomId || context.kind !== activeKind)) bindSuggestions(context);
    else if (!context && activeRoomId) unbindSuggestions();
    else if (context) renderPanel();
  }

  pollTimer = setInterval(syncContext, 250);
  syncContext();
  window.addEventListener('pagehide', () => {
    if (pollTimer) clearInterval(pollTimer);
    unbindSuggestions();
  });

  window.XiangqiSuggestions = {
    resolveContext,
    voteMove,
    isBoardFlipped,
    get roomId() { return activeRoomId; },
    get rows() { return suggestionRows.slice(); }
  };
})();
