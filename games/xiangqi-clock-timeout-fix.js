(() => {
  'use strict';

  const ROOT = 'xiangqiRooms';
  const ROOM_KEY = 'xiangqiActiveRoom';
  const COLOR_KEY = 'xiangqiActiveColor';

  const style = document.createElement('style');
  style.id = 'xiangqi-clock-timeout-fix-style';
  style.textContent = `
    .xiangqiRailCard{padding:11px 12px!important}
    .xiangqiRailTitle{font-size:13px!important;letter-spacing:.55px!important;margin-bottom:9px!important}
    .xiangqiClockRow{gap:8px 10px!important;padding:10px 8px!important}
    .xiangqiClockSide{font-size:14px!important;font-weight:1000!important}
    .xiangqiClockStatus{font-size:9px!important;letter-spacing:.65px!important}
    .xiangqiClockMain{font-size:27px!important;line-height:1!important;font-weight:1000!important;letter-spacing:-1px!important}
    .xiangqiClockProgress{height:5px!important;background:rgba(255,255,255,.12)!important}
    .xiangqiClockRow.active{box-shadow:inset 0 0 0 1px rgba(255,226,111,.2),0 7px 18px rgba(0,0,0,.17)!important}
    .xiangqiClockRow.active .xiangqiClockMain{color:#ffe26f!important;text-shadow:0 0 16px rgba(255,226,111,.2)!important}
    .xiangqiClockRow.danger .xiangqiClockMain,.xiangqiClockRow.danger .xiangqiClockStatus{color:#ff8876!important}
    .xiangqiClockRow.danger{animation:xiangqiClockPulse .72s ease-in-out infinite alternate!important}
    @keyframes xiangqiClockPulse{from{box-shadow:inset 0 0 0 1px rgba(255,91,72,.16)}to{box-shadow:inset 0 0 0 1px rgba(255,91,72,.52),0 0 18px rgba(255,91,72,.1)}}
    .xiangqiClockOff{font-size:16px!important;padding:14px 8px!important}
    .capturedLabel{font-size:12px!important;margin-bottom:6px!important}
    .capturedEmpty{font-size:11px!important}
    .capturedChip{min-width:30px!important;height:30px!important;font-size:19px!important}
    #xiangqiAssistRail #topBar #turnLabel{font-size:14px!important;line-height:1.4!important}
    #xiangqiAssistRail #topBar button{font-size:13px!important}
    #xiangqiAssistRail #onlineBadge{font-size:13px!important}
    #xiangqiAssistRail #xiangqiSuggestPanel{font-size:12px!important;line-height:1.48!important}
    #xiangqiAssistRail .suggestTitle{font-size:13px!important}
    #xiangqiAssistRail .suggestTurn{font-size:11px!important}
    #xiangqiAssistRail .suggestRow{font-size:12px!important}
    @media(max-width:760px){
      .xiangqiRailCard{padding:9px!important}
      .xiangqiRailTitle{font-size:12px!important}
      .xiangqiClockSide{font-size:12px!important}
      .xiangqiClockMain{font-size:21px!important}
      .xiangqiClockStatus{font-size:8px!important}
      .xiangqiClockProgress{height:4px!important}
      .capturedLabel{font-size:11px!important}.capturedChip{min-width:27px!important;height:27px!important;font-size:17px!important}
      #xiangqiAssistRail #topBar #turnLabel{font-size:12px!important}#xiangqiAssistRail #topBar button{font-size:11px!important}
      #xiangqiAssistRail #xiangqiSuggestPanel{font-size:11px!important}
    }
    @media(max-width:520px){
      .xiangqiRailCard{padding:7px!important}
      .xiangqiRailTitle{font-size:11px!important;margin-bottom:6px!important}
      .xiangqiClockRow{gap:5px 4px!important;padding:6px 4px!important}
      .xiangqiClockSide{font-size:10px!important}
      .xiangqiClockStatus{font-size:7px!important}
      .xiangqiClockMain{font-size:16px!important;letter-spacing:-.7px!important}
      .xiangqiClockProgress{height:3px!important}
      .capturedLabel{font-size:10px!important}.capturedEmpty{font-size:9px!important}.capturedChip{min-width:25px!important;height:25px!important;font-size:15px!important}
      #xiangqiAssistRail #topBar #turnLabel{font-size:11px!important}#xiangqiAssistRail #topBar button{font-size:10px!important}
      #xiangqiAssistRail #onlineBadge{font-size:10px!important}
      #xiangqiAssistRail #xiangqiSuggestPanel{font-size:10px!important;line-height:1.35!important}
    }
  `;

  document.head.appendChild(style);

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function currentMode() {
    try { return typeof mode === 'undefined' ? '' : mode; } catch (_) { return ''; }
  }

  function opposite(color) {
    return color === 'r' ? 'b' : 'r';
  }

  function sideLabel(color) {
    return color === 'r' ? 'Đỏ' : 'Đen';
  }

  function playerName(room, color) {
    const seat = color === 'r' ? room?.red : room?.black;
    return (seat?.name ? String(seat.name).trim() : '') || sideLabel(color);
  }

  function timeoutResult(room) {
    if (!room || room.status !== 'finished') return null;
    const action = room.lastAction;
    const loser = room.timeoutLoser || (action?.type === 'timeout' ? action.loser : null);
    if (loser !== 'r' && loser !== 'b') return null;
    return {
      loser,
      winner: opposite(loser),
      reason: room.endReason || 'hết giờ'
    };
  }

  function showTimeoutResult(room, result) {
    const title = document.getElementById('overTitle');
    const overlay = document.getElementById('overOverlay');
    if (!title || !overlay || !result) return;

    const winnerName = playerName(room, result.winner);
    const loserName = playerName(room, result.loser);
    title.textContent = '🏆 ' + winnerName + ' (' + sideLabel(result.winner) + ') thắng! · ' + loserName + ' (' + sideLabel(result.loser) + ') ' + result.reason;
    overlay.style.display = 'flex';
    try { winner = result.winner; } catch (_) {}
  }

  let repairedSignature = null;
  async function repairOnlineTimeout(room, result) {
    if (!result || currentMode() !== 'online' || !window.firebase || typeof firebaseConfig === 'undefined' || !firebaseConfig.databaseURL) return;
    const roomId = window.XiangqiMatchUI?.roomId || window.XiangqiPresence?.roomId || readLocal(ROOM_KEY);
    const color = window.XiangqiPresence?.color || readLocal(COLOR_KEY);
    if (!roomId || (color !== 'r' && color !== 'b')) return;

    const actionAt = Number(room?.lastAction?.at) || Number(room?.finishedAt) || 0;
    const signature = roomId + ':' + actionAt + ':' + result.loser + ':' + result.winner;
    if (signature === repairedSignature || (room.winner === result.winner && room.timeoutLoser === result.loser)) return;
    repairedSignature = signature;

    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      const ref = firebase.database().ref(ROOT).child(roomId);
      await ref.transaction(current => {
        if (!current || current.status !== 'finished') return;
        const action = current.lastAction;
        const loser = current.timeoutLoser || (action?.type === 'timeout' ? action.loser : null);
        if (loser !== result.loser) return;
        current.timeoutLoser = result.loser;
        current.winner = result.winner;
        return current;
      }, undefined, false);
    } catch (_) {
      repairedSignature = null;
    }
  }

  function repairLocalTimeoutDisplay() {
    if (currentMode() === 'online') return;
    const title = document.getElementById('overTitle');
    const overlay = document.getElementById('overOverlay');
    if (!title || !overlay || !/hết giờ/i.test(title.textContent || '')) return;

    let loser = null;
    try { loser = turn === 'b' ? 'b' : 'r'; } catch (_) { return; }
    const expectedWinner = opposite(loser);
    try { winner = expectedWinner; } catch (_) {}
    title.textContent = '🏆 ' + sideLabel(expectedWinner) + ' thắng! · ' + sideLabel(loser) + ' hết giờ';
    overlay.style.display = 'flex';
  }

  function syncTimeoutResult() {
    const room = window.XiangqiMatchUI?.room || null;
    const result = timeoutResult(room);
    if (result) {
      showTimeoutResult(room, result);
      repairOnlineTimeout(room, result);
      return;
    }
    repairLocalTimeoutDisplay();
  }

  setInterval(syncTimeoutResult, 200);
  syncTimeoutResult();

  window.XiangqiTimeoutUI = {
    timeoutResult,
    sync: syncTimeoutResult
  };
})();
