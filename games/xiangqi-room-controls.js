(() => {
  'use strict';

  const ROOM_KEY = 'xiangqiActiveRoom';
  const COLOR_KEY = 'xiangqiActiveColor';
  const gameContainer = document.getElementById('gameContainer');
  const menuOverlay = document.getElementById('menuOverlay');
  const setupPanel = document.getElementById('setupPanel');
  const topBar = document.getElementById('topBar');
  const menuBtn = document.getElementById('menuBtn');
  const homeBtn = document.getElementById('homeBtn');
  if (!gameContainer || !menuOverlay || !setupPanel || !topBar || !menuBtn) return;

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function currentMode() {
    try { return typeof mode === 'undefined' ? '' : mode; } catch (_) { return ''; }
  }

  function activeRoomId() {
    return window.XiangqiPresence?.roomId || readLocal(ROOM_KEY) || null;
  }

  function activeColor() {
    return window.XiangqiPresence?.color || readLocal(COLOR_KEY) || null;
  }

  function hasActiveOnlineRoom() {
    const color = activeColor();
    return currentMode() === 'online' && !!activeRoomId() && (color === 'r' || color === 'b');
  }

  const style = document.createElement('style');
  style.id = 'xiangqi-room-controls-style';
  style.textContent = `
    #xiangqiLeaveRoomBtn{border-color:rgba(255,133,112,.42)!important;background:rgba(147,44,28,.34)!important;color:#ffd7cf!important}
    #xiangqiLeaveRoomBtn:hover{background:rgba(178,52,33,.52)!important}
    #xiangqiActiveMenuClose{position:fixed;right:16px;top:16px;z-index:101;width:46px;height:46px;display:none;place-items:center;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(8,7,6,.78);color:#fff;font-size:24px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.36)}
    #xiangqiActiveMenuPanel{display:none;flex-direction:column;align-items:center;gap:12px;width:min(390px,calc(100vw - 28px));padding:22px 20px!important;text-align:center}
    #xiangqiActiveMenuPanel h2{margin:0;font-size:24px}.xiangqiActiveMenuSub{font-size:13px;line-height:1.5;opacity:.8}.xiangqiActiveMenuActions{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:9px}.xiangqiMenuContinue,.xiangqiMenuLeave{min-height:46px;border-radius:10px;font-size:14px;font-weight:1000;cursor:pointer}.xiangqiMenuContinue{border:0;background:linear-gradient(180deg,#74df86,#46b95a);color:#0b3712}.xiangqiMenuLeave{border:1px solid rgba(255,133,112,.42);background:rgba(151,45,29,.46);color:#ffe0d8}
    #menuOverlay.xiangqiActiveMenuOpen{z-index:100;background:rgba(12,8,5,.82);backdrop-filter:blur(7px)}
    @media(max-width:520px){#xiangqiActiveMenuClose{right:10px;top:10px;width:48px;height:48px}.xiangqiActiveMenuActions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const leaveBtn = document.createElement('button');
  leaveBtn.id = 'xiangqiLeaveRoomBtn';
  leaveBtn.type = 'button';
  leaveBtn.textContent = '🚪 Rời bàn';
  topBar.appendChild(leaveBtn);

  const closeBtn = document.createElement('button');
  closeBtn.id = 'xiangqiActiveMenuClose';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Đóng menu');
  closeBtn.textContent = '×';
  menuOverlay.appendChild(closeBtn);

  const activePanel = document.createElement('section');
  activePanel.id = 'xiangqiActiveMenuPanel';
  activePanel.className = 'panel';
  activePanel.innerHTML = `
    <h2>☰ Menu ván đấu</h2>
    <div id="xiangqiActiveMenuRoom" class="xiangqiActiveMenuSub"></div>
    <div class="xiangqiActiveMenuSub">Ván vẫn tiếp tục realtime trong lúc mở menu. Bấm × hoặc “Tiếp tục” để quay lại bàn.</div>
    <div class="xiangqiActiveMenuActions">
      <button id="xiangqiMenuContinue" class="xiangqiMenuContinue" type="button">▶ Tiếp tục</button>
      <button id="xiangqiMenuLeave" class="xiangqiMenuLeave" type="button">🚪 Rời bàn</button>
    </div>
  `;
  menuOverlay.appendChild(activePanel);

  const roomText = activePanel.querySelector('#xiangqiActiveMenuRoom');
  const continueBtn = activePanel.querySelector('#xiangqiMenuContinue');
  const menuLeaveBtn = activePanel.querySelector('#xiangqiMenuLeave');
  let leaving = false;

  function showActiveMenu() {
    if (!hasActiveOnlineRoom()) return false;
    const id = activeRoomId();
    const color = activeColor();
    roomText.textContent = 'Bàn #' + String(id).slice(-5).toUpperCase() + ' · Bạn: ' + (color === 'r' ? 'Đỏ' : 'Đen');
    setupPanel.style.display = 'none';
    activePanel.style.display = 'flex';
    closeBtn.style.display = 'grid';
    menuOverlay.classList.add('xiangqiActiveMenuOpen');
    menuOverlay.style.display = 'flex';
    topBar.style.display = 'none';
    return true;
  }

  function closeActiveMenu() {
    if (!menuOverlay.classList.contains('xiangqiActiveMenuOpen')) return;
    menuOverlay.classList.remove('xiangqiActiveMenuOpen');
    menuOverlay.style.display = 'none';
    setupPanel.style.display = 'flex';
    activePanel.style.display = 'none';
    closeBtn.style.display = 'none';
    if (hasActiveOnlineRoom()) topBar.style.display = 'flex';
  }

  async function leaveAndNavigate(destination) {
    if (leaving || !hasActiveOnlineRoom()) return;
    const ok = window.confirm('Rời bàn cờ? Đối thủ sẽ được báo là bạn đã out.');
    if (!ok) return;
    leaving = true;
    leaveBtn.disabled = true;
    menuLeaveBtn.disabled = true;
    closeBtn.disabled = true;
    try {
      if (window.XiangqiPresence?.leaveActiveRoom) {
        await window.XiangqiPresence.leaveActiveRoom();
      } else {
        try { localStorage.removeItem(ROOM_KEY); localStorage.removeItem(COLOR_KEY); } catch (_) {}
      }
    } catch (_) {}
    const target = destination || (() => {
      const url = new URL(location.href);
      url.search = '';
      url.hash = '';
      return url.pathname;
    })();
    location.href = target;
  }

  // Capture before the legacy/core Menu handler and before presence's old
  // leave-on-menu fallback. Opening Menu must never silently leave a game.
  menuBtn.addEventListener('click', e => {
    if (!hasActiveOnlineRoom()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showActiveMenu();
  }, true);

  closeBtn.addEventListener('click', closeActiveMenu);
  continueBtn.addEventListener('click', closeActiveMenu);
  leaveBtn.addEventListener('click', () => leaveAndNavigate());
  menuLeaveBtn.addEventListener('click', () => leaveAndNavigate());

  if (homeBtn) {
    homeBtn.addEventListener('click', e => {
      if (!hasActiveOnlineRoom()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      leaveAndNavigate(homeBtn.href);
    }, true);
  }

  window.XiangqiRoomControls = {
    showActiveMenu,
    closeActiveMenu,
    leaveAndNavigate,
    hasActiveOnlineRoom
  };
})();
