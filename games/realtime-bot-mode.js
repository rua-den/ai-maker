(() => {
  'use strict';

  const path = location.pathname.toLowerCase();
  const gameKey = path.includes('connect4') ? 'connect4' : path.includes('tictactoe') ? 'tictactoe' : path.includes('reversi') ? 'reversi' : null;
  if (!gameKey || !window.RuaBots) return;

  const rules = gameKey === 'connect4' ? window.Connect4Rules : gameKey === 'tictactoe' ? window.TicTacToeRules : window.ReversiRules;
  if (!rules) return;

  const lobby = document.getElementById('lobby');
  const game = document.getElementById('game');
  const boardEl = document.getElementById('board');
  const gameStatus = document.getElementById('gameStatus');
  const roomCode = document.getElementById('roomCode');
  const leaveBtn = document.getElementById('leaveBtn');
  const resultNote = document.getElementById('resultNote');
  if (!lobby || !game || !boardEl || !gameStatus || !leaveBtn) return;

  const style = document.createElement('style');
  style.textContent = `
    .botModeTabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px}
    .botModeTabs button{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.08);color:#fff;font-weight:900;cursor:pointer}
    .botModeTabs button.active{background:linear-gradient(180deg,#6fe4d1,#38bda9);color:#073a32;border-color:transparent}
    .botPanel{display:none;flex-direction:column;gap:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09)}
    .botPanel.show{display:flex}.botLabel{font-size:12px;font-weight:900;opacity:.8}.botDifficulty{width:100%;min-height:44px;border:0;border-radius:10px;padding:10px 12px;background:#f5fbfc;color:#16313a;font:inherit;font-weight:900;outline:none}
    .botStart{min-height:44px;border:0;border-radius:10px;background:linear-gradient(180deg,#ffd66d,#edb83a);color:#412e00;font-weight:1000;font-size:14px;cursor:pointer;box-shadow:0 3px 0 #a77a18}
    .botHint{font-size:11px;line-height:1.5;text-align:center;opacity:.62}.botThinking{opacity:.68}
  `;
  document.head.appendChild(style);

  const sub = lobby.querySelector('.sub');
  const tabs = document.createElement('div');
  tabs.className = 'botModeTabs';
  tabs.innerHTML = '<button type="button" data-mode="online" class="active">🌐 Online</button><button type="button" data-mode="bot">🤖 Đấu Bot</button>';
  sub?.insertAdjacentElement('afterend', tabs);

  const botPanel = document.createElement('div');
  botPanel.className = 'botPanel';
  botPanel.innerHTML = `
    <div class="botLabel">ĐỘ KHÓ BOT</div>
    <select class="botDifficulty" aria-label="Độ khó bot">
      <option value="1">🙂 Dễ</option>
      <option value="2" selected>😎 Vừa</option>
      <option value="3">🔥 Khó</option>
      <option value="4">💀 Siêu khó</option>
    </select>
    <button type="button" class="botStart">▶ Đấu với Bot</button>
    <div class="botHint">Dễ: đi khá ngẫu nhiên · Vừa: biết chặn/thắng · Khó: nhìn trước nhiều nước · Siêu khó: tìm kiếm sâu nhất.</div>
  `;
  tabs.insertAdjacentElement('afterend', botPanel);

  const difficulty = botPanel.querySelector('.botDifficulty');
  const startBtn = botPanel.querySelector('.botStart');
  const onlineBlocks = [
    lobby.querySelector('.nameRow'),
    document.getElementById('status'),
    lobby.querySelector('.sectionHead'),
    document.getElementById('roomList'),
    lobby.querySelector('.rules')
  ].filter(Boolean);

  const STORAGE_KEY = 'ruaBotDifficulty:' + gameKey;
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= 1 && saved <= 4) difficulty.value = String(saved);
  } catch (_) {}

  let selectedMode = 'online';
  let active = false;
  let state = null;
  let turn = 'A';
  let winner = null;
  let thinking = false;
  let timer = null;

  const levelLabel = () => window.RuaBots.LEVELS[Number(difficulty.value)]?.label || 'Vừa';
  const other = seat => seat === 'A' ? 'B' : 'A';

  function setMode(mode) {
    selectedMode = mode;
    [...tabs.querySelectorAll('button')].forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    const bot = mode === 'bot';
    botPanel.classList.toggle('show', bot);
    onlineBlocks.forEach(el => { el.style.display = bot ? 'none' : ''; });
  }

  function stopTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function finishMessage() {
    if (winner === 'draw') return '🤝 Hòa với Bot';
    if (winner === 'A') return '🏆 Bạn thắng Bot';
    if (winner === 'B') return '💥 Bot thắng';
    return 'Ván đã kết thúc';
  }

  function renderHeader() {
    if (winner) gameStatus.textContent = finishMessage();
    else if (thinking) gameStatus.textContent = '🤖 Bot đang nghĩ…';
    else if (turn === 'A') gameStatus.textContent = '🟢 Tới lượt bạn';
    else gameStatus.textContent = '⏳ Tới lượt Bot';
    gameStatus.classList.toggle('botThinking', thinking);
    if (roomCode) roomCode.textContent = '🤖 Bot · ' + levelLabel();
  }

  function renderConnect4() {
    const board = String(state?.board || rules.empty());
    const last = Number(state?.last ?? -1);
    const playable = active && !winner && !thinking && turn === 'A';
    [...boardEl.children].forEach((el, i) => {
      const v = board[i] || '.';
      const col = i % 7;
      el.className = 'slot' + (v === 'A' ? ' a' : v === 'B' ? ' b' : '') + (i === last ? ' last' : '');
      el.disabled = !playable || board[col] !== '.';
      el.onclick = () => playerMove({ col });
    });
    if (resultNote) resultNote.textContent = '🔴 Bạn  ·  🟡 Bot (' + levelLabel() + ')';
  }

  function renderTtt() {
    const board = String(state?.board || rules.empty());
    const last = Number(state?.last ?? -1);
    const playable = active && !winner && !thinking && turn === 'A';
    [...boardEl.children].forEach((el, i) => {
      const v = board[i] || '.';
      el.textContent = v === 'A' ? '×' : v === 'B' ? '○' : '';
      el.className = 'cell' + (v === 'A' ? ' a' : v === 'B' ? ' b' : '') + (i === last ? ' last' : '');
      el.disabled = !playable || v !== '.';
      el.onclick = () => playerMove({ idx: i });
    });
    if (resultNote) resultNote.textContent = '❌ Bạn  ·  ⭕ Bot (' + levelLabel() + ')';
  }

  function renderReversi() {
    const board = String(state?.board || rules.empty());
    const last = Number(state?.last ?? -1);
    const playable = active && !winner && !thinking && turn === 'A';
    const legal = playable ? new Set(rules.legalMoves(board, 'A')) : new Set();
    [...boardEl.children].forEach((el, i) => {
      const v = board[i] || '.';
      el.innerHTML = v === '.' ? '' : '<span class="disc ' + (v === 'A' ? 'a' : 'b') + '"></span>';
      el.className = 'cell' + (legal.has(i) ? ' legal' : '') + (i === last ? ' last' : '');
      el.disabled = !legal.has(i);
      el.onclick = () => playerMove({ idx: i });
    });
    const ac = [...board].filter(x => x === 'A').length;
    const bc = [...board].filter(x => x === 'B').length;
    const score = document.getElementById('score');
    if (score) score.textContent = '⚫ ' + ac + '  ·  ⚪ ' + bc;
    if (resultNote) resultNote.textContent = '⚫ Bạn  ·  ⚪ Bot (' + levelLabel() + ')';
  }

  function render() {
    renderHeader();
    if (gameKey === 'connect4') renderConnect4();
    else if (gameKey === 'tictactoe') renderTtt();
    else renderReversi();
  }

  function applyResult(result, seat) {
    if (!result) return false;
    state = result.state;
    if (result.winner) {
      winner = result.winner;
      thinking = false;
      render();
      return true;
    }
    turn = result.nextTurn || other(seat);
    render();
    if (turn === 'B') queueBot();
    return true;
  }

  function playerMove(move) {
    if (!active || winner || thinking || turn !== 'A') return;
    const result = rules.apply(state, move, 'A');
    if (!result) return;
    applyResult(result, 'A');
  }

  function queueBot() {
    if (!active || winner || turn !== 'B') return;
    stopTimer();
    thinking = true;
    render();
    timer = setTimeout(() => {
      timer = null;
      if (!active || winner || turn !== 'B') return;
      const move = window.RuaBots.choose(gameKey, state, 'B', Number(difficulty.value));
      thinking = false;
      if (!move) {
        // Reversi normally handles passes in apply(); this fallback keeps the local game recoverable.
        turn = 'A';
        render();
        return;
      }
      const result = rules.apply(state, move, 'B');
      if (!result) { turn = 'A'; render(); return; }
      applyResult(result, 'B');
    }, Number(difficulty.value) >= 4 ? 260 : 180);
  }

  function startBot() {
    stopTimer();
    try { localStorage.setItem(STORAGE_KEY, difficulty.value); } catch (_) {}
    active = true;
    winner = null;
    thinking = false;
    state = { board: rules.empty(), last: -1 };
    turn = 'A';
    lobby.style.display = 'none';
    game.classList.add('show');
    leaveBtn.textContent = 'Về sảnh';
    render();
  }

  function exitBot() {
    stopTimer();
    active = false;
    winner = null;
    thinking = false;
    state = null;
    game.classList.remove('show');
    lobby.style.display = 'flex';
    leaveBtn.textContent = 'Rời bàn';
    setMode('bot');
  }

  tabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  difficulty.addEventListener('change', () => {
    try { localStorage.setItem(STORAGE_KEY, difficulty.value); } catch (_) {}
  });
  startBtn.addEventListener('click', startBot);

  leaveBtn.addEventListener('click', e => {
    if (!active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exitBot();
  }, true);

  setMode('online');
})();
