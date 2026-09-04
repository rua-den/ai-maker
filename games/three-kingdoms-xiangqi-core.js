(() => {
  'use strict';

  // Modern playable reconstruction of San-kwo-k'i / Three Kingdoms Xiangqi.
  // Historical sources agree on the three 9x5 Xiangqi half-boards, armies,
  // turn order concept, special pieces and elimination rule, while the exact
  // centre-line connectivity is not fully preserved. This engine uses a
  // deterministic Y-river convention: a line moving through a river fork may
  // continue into either opposing kingdom, mirrored by file.

  const FILES = 9;
  const RANKS = 5;
  const KINGDOMS = [
    { id: 0, key: 'shu', name: 'Thục', han: '蜀', color: 'red', special: '火', specialName: 'Hỏa' },
    { id: 1, key: 'wei', name: 'Ngụy', han: '魏', color: 'blue', special: '旗', specialName: 'Kỳ' },
    { id: 2, key: 'wu', name: 'Ngô', han: '吳', color: 'green', special: '風', specialName: 'Phong' }
  ];
  const TURN_ORDER = [0, 1, 2];
  const VALUES = { K: 100000, R: 900, C: 470, H: 410, E: 250, A: 240, P: 130, X: 520 };
  const GLYPH = { R: '車', H: '馬', E: '象', A: '士', C: '炮', P: '兵' };

  function key(sector, r, f) { return sector + ':' + r + ':' + f; }
  function point(sector, r, f) { return { sector, r, f, key: key(sector, r, f) }; }
  function nextKingdom(id) { return (id + 1) % 3; }
  function prevKingdom(id) { return (id + 2) % 3; }
  function inBounds(r, f) { return r >= 0 && r < RANKS && f >= 0 && f < FILES; }
  function inPalace(sector, r, f, home) { return sector === home && r >= 0 && r <= 2 && f >= 3 && f <= 5; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function resolveVirtual(sector, f, virtualR, branch = 0) {
    if (f < 0 || f >= FILES || virtualR < 0 || virtualR > 9) return null;
    if (virtualR <= 4) return point(sector, virtualR, f);
    const targetSector = branch === 0 ? nextKingdom(sector) : prevKingdom(sector);
    const targetR = 4 - (virtualR - 5);
    if (targetR < 0) return null;
    return point(targetSector, targetR, 8 - f);
  }

  function stepTargets(sector, r, f, df, dr) {
    const targetF = f + df;
    const targetR = r + dr;
    if (targetF < 0 || targetF >= FILES || targetR < 0 || targetR > 9) return [];
    if (targetR <= 4) return [point(sector, targetR, targetF)];
    const a = resolveVirtual(sector, targetF, targetR, 0);
    const b = resolveVirtual(sector, targetF, targetR, 1);
    return [a, b].filter(Boolean);
  }

  function pieceMap(state) {
    const map = new Map();
    for (const p of state.pieces) map.set(key(p.sector, p.r, p.f), p);
    return map;
  }

  function makePiece(id, type, home, r, f, extra = {}) {
    const kingdom = KINGDOMS[home];
    return {
      id,
      type,
      home,
      controller: home,
      sector: home,
      r,
      f,
      glyph: type === 'K' ? kingdom.han : type === 'X' ? kingdom.special : GLYPH[type],
      ...extra
    };
  }

  function initialState(includeSpecial = true) {
    const pieces = [];
    let id = 0;
    for (const kingdom of KINGDOMS) {
      const home = kingdom.id;
      const back = ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'];
      for (let f = 0; f < FILES; f++) pieces.push(makePiece('p' + id++, back[f], home, 0, f));
      pieces.push(makePiece('p' + id++, 'C', home, 2, 1));
      pieces.push(makePiece('p' + id++, 'C', home, 2, 7));
      if (includeSpecial) {
        pieces.push(makePiece('p' + id++, 'X', home, 2, 3));
        pieces.push(makePiece('p' + id++, 'X', home, 2, 5));
      }
      for (const f of [0, 2, 4, 6, 8]) pieces.push(makePiece('p' + id++, 'P', home, 3, f));
    }
    return {
      version: 1,
      includeSpecial: !!includeSpecial,
      pieces,
      alive: [true, true, true],
      turn: 0,
      winner: null,
      moveNo: 0,
      lastMove: null,
      eliminated: [],
      lastEvent: 'Thục đi trước.'
    };
  }

  function forwardRays(piece) {
    const rays = [];
    const prefix = [];
    for (let rr = piece.r + 1; rr <= 4; rr++) prefix.push(point(piece.sector, rr, piece.f));
    for (const branch of [0, 1]) {
      const ray = prefix.slice();
      for (let virtualR = Math.max(5, piece.r + 1); virtualR <= 9; virtualR++) {
        const p = resolveVirtual(piece.sector, piece.f, virtualR, branch);
        if (p) ray.push(p);
      }
      rays.push(ray);
    }
    return rays;
  }

  function rays(piece) {
    const out = [];
    const back = [];
    for (let rr = piece.r - 1; rr >= 0; rr--) back.push(point(piece.sector, rr, piece.f));
    out.push(back);
    const left = [];
    for (let ff = piece.f - 1; ff >= 0; ff--) left.push(point(piece.sector, piece.r, ff));
    out.push(left);
    const right = [];
    for (let ff = piece.f + 1; ff < FILES; ff++) right.push(point(piece.sector, piece.r, ff));
    out.push(right);
    out.push(...forwardRays(piece));
    return out;
  }

  function moveObject(piece, target, occupant) {
    return {
      pieceId: piece.id,
      from: key(piece.sector, piece.r, piece.f),
      to: target.key,
      captureId: occupant && occupant.controller !== piece.controller ? occupant.id : null
    };
  }

  function dedupeMoves(moves) {
    const seen = new Set();
    return moves.filter(move => {
      const signature = move.pieceId + '>' + move.to;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }

  function sliderMoves(state, piece, cannon) {
    const map = pieceMap(state);
    const moves = [];
    for (const ray of rays(piece)) {
      let screen = false;
      for (const target of ray) {
        const occupant = map.get(target.key);
        if (!cannon) {
          if (!occupant) moves.push(moveObject(piece, target, null));
          else {
            if (occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
            break;
          }
          continue;
        }
        if (!screen) {
          if (!occupant) moves.push(moveObject(piece, target, null));
          else screen = true;
        } else if (occupant) {
          if (occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
          break;
        }
      }
    }
    return dedupeMoves(moves);
  }

  const HORSE = [
    [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
    [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]
  ];
  const EXTENDED = [
    [1, 3], [-1, 3], [1, -3], [-1, -3], [3, 1], [3, -1], [-3, 1], [-3, -1]
  ];

  function horseMoves(state, piece) {
    const map = pieceMap(state);
    const moves = [];
    for (const [df, dr, ldf, ldr] of HORSE) {
      const virtualR = piece.r + dr;
      const branches = virtualR > 4 ? [0, 1] : [0];
      for (const branch of branches) {
        const target = resolveVirtual(piece.sector, piece.f + df, virtualR, branch);
        const leg = resolveVirtual(piece.sector, piece.f + ldf, piece.r + ldr, branch);
        if (!target || !leg || map.has(leg.key)) continue;
        const occupant = map.get(target.key);
        if (!occupant || occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
      }
    }
    return dedupeMoves(moves);
  }

  function extendedMoves(state, piece) {
    const map = pieceMap(state);
    const moves = [];
    for (const [df, dr] of EXTENDED) {
      for (const target of stepTargets(piece.sector, piece.r, piece.f, df, dr)) {
        const occupant = map.get(target.key);
        if (!occupant || occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
      }
    }
    return dedupeMoves(moves);
  }

  function elephantMoves(state, piece) {
    if (piece.sector !== piece.home) return [];
    const map = pieceMap(state);
    const moves = [];
    for (const [df, dr] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) {
      const r = piece.r + dr;
      const f = piece.f + df;
      if (!inBounds(r, f)) continue;
      const eye = key(piece.sector, piece.r + dr / 2, piece.f + df / 2);
      if (map.has(eye)) continue;
      const target = point(piece.sector, r, f);
      const occupant = map.get(target.key);
      if (!occupant || occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
    }
    return moves;
  }

  function advisorMoves(state, piece) {
    const map = pieceMap(state);
    const moves = [];
    for (const [df, dr] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const r = piece.r + dr;
      const f = piece.f + df;
      if (!inPalace(piece.home, r, f, piece.home)) continue;
      const target = point(piece.home, r, f);
      const occupant = map.get(target.key);
      if (!occupant || occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
    }
    return moves;
  }

  function flyingGeneralMoves(state, piece) {
    const map = pieceMap(state);
    const moves = [];
    for (const ray of forwardRays(piece)) {
      for (const target of ray) {
        const occupant = map.get(target.key);
        if (!occupant) continue;
        if (occupant.type === 'K' && occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
        break;
      }
    }
    return dedupeMoves(moves);
  }

  function generalMoves(state, piece) {
    const map = pieceMap(state);
    const moves = [];
    for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = piece.r + dr;
      const f = piece.f + df;
      if (!inPalace(piece.home, r, f, piece.home)) continue;
      const target = point(piece.home, r, f);
      const occupant = map.get(target.key);
      if (!occupant || occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
    }
    moves.push(...flyingGeneralMoves(state, piece));
    return dedupeMoves(moves);
  }

  function soldierMoves(state, piece) {
    const map = pieceMap(state);
    const moves = [];
    const crossed = piece.sector !== piece.home;
    const candidates = [];
    if (!crossed) candidates.push(...stepTargets(piece.sector, piece.r, piece.f, 0, 1));
    else {
      if (piece.r > 0) candidates.push(point(piece.sector, piece.r - 1, piece.f));
      if (piece.f > 0) candidates.push(point(piece.sector, piece.r, piece.f - 1));
      if (piece.f < 8) candidates.push(point(piece.sector, piece.r, piece.f + 1));
    }
    for (const target of candidates) {
      const occupant = map.get(target.key);
      if (!occupant || occupant.controller !== piece.controller) moves.push(moveObject(piece, target, occupant));
    }
    return dedupeMoves(moves);
  }

  function pseudoMovesForPiece(state, piece) {
    if (!piece || !state.alive[piece.controller]) return [];
    switch (piece.type) {
      case 'R': return sliderMoves(state, piece, false);
      case 'C': return sliderMoves(state, piece, true);
      case 'H': return horseMoves(state, piece);
      case 'E': return elephantMoves(state, piece);
      case 'A': return advisorMoves(state, piece);
      case 'K': return generalMoves(state, piece);
      case 'P': return soldierMoves(state, piece);
      case 'X': return extendedMoves(state, piece);
      default: return [];
    }
  }

  function findGeneral(state, controller) {
    return state.pieces.find(p => p.type === 'K' && p.home === controller) || null;
  }

  function eliminate(state, controller, conqueror, reason = 'chiếu bí') {
    if (!state.alive[controller]) return;
    state.alive[controller] = false;
    const general = findGeneral(state, controller);
    if (general) state.pieces = state.pieces.filter(p => p.id !== general.id);
    for (const piece of state.pieces) {
      if (piece.controller === controller) piece.controller = conqueror;
    }
    state.eliminated.push({ controller, by: conqueror, moveNo: state.moveNo, reason });
    state.lastEvent = KINGDOMS[conqueror].name + ' thu phục ' + KINGDOMS[controller].name + ' (' + reason + ').';
    const alive = state.alive.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (alive.length === 1) state.winner = alive[0];
  }

  function applyRaw(state, move, mover, simulate = false) {
    const next = clone(state);
    const piece = next.pieces.find(p => p.id === move.pieceId);
    if (!piece) return null;
    const [sector, r, f] = move.to.split(':').map(Number);
    const captured = next.pieces.find(p => key(p.sector, p.r, p.f) === move.to) || null;
    if (captured && captured.controller === piece.controller) return null;
    if (captured) next.pieces = next.pieces.filter(p => p.id !== captured.id);
    piece.sector = sector;
    piece.r = r;
    piece.f = f;
    next.lastMove = { ...move, mover, captured: captured ? { id: captured.id, type: captured.type, controller: captured.controller, home: captured.home } : null };
    if (!simulate) next.moveNo += 1;
    if (captured?.type === 'K') eliminate(next, captured.home, mover, 'bắt Tướng');
    return next;
  }

  function isInCheck(state, controller) {
    if (!state.alive[controller]) return false;
    const general = findGeneral(state, controller);
    if (!general) return true;
    const target = key(general.sector, general.r, general.f);
    for (const piece of state.pieces) {
      if (piece.controller === controller || !state.alive[piece.controller]) continue;
      const moves = pseudoMovesForPiece(state, piece);
      if (moves.some(move => move.to === target)) return true;
    }
    return false;
  }

  function legalMoves(state, controller = state.turn) {
    if (!state.alive[controller] || state.winner != null) return [];
    const moves = [];
    for (const piece of state.pieces) {
      if (piece.controller !== controller) continue;
      for (const move of pseudoMovesForPiece(state, piece)) {
        const after = applyRaw(state, move, controller, true);
        if (after && !isInCheck(after, controller)) moves.push(move);
      }
    }
    return dedupeMoves(moves);
  }

  function resolveCheckmates(state, mover) {
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 3 && state.winner == null) {
      changed = false;
      for (let enemy = 0; enemy < 3; enemy++) {
        if (enemy === mover || !state.alive[enemy]) continue;
        if (isInCheck(state, enemy) && legalMoves(state, enemy).length === 0) {
          eliminate(state, enemy, mover, 'chiếu bí');
          changed = true;
        }
      }
    }
  }

  function nextAlive(state, from) {
    for (let step = 1; step <= 3; step++) {
      const candidate = (from + step) % 3;
      if (state.alive[candidate]) return candidate;
    }
    return null;
  }

  function makeMove(state, move) {
    if (!state || state.winner != null) return { ok: false, reason: 'Ván đã kết thúc.' };
    const mover = state.turn;
    const legal = legalMoves(state, mover);
    const chosen = legal.find(candidate => candidate.pieceId === move.pieceId && candidate.to === move.to);
    if (!chosen) return { ok: false, reason: 'Nước đi không hợp lệ.' };
    const next = applyRaw(state, chosen, mover, false);
    if (!next) return { ok: false, reason: 'Không thể áp dụng nước đi.' };
    resolveCheckmates(next, mover);
    if (next.winner != null) {
      next.turn = next.winner;
      next.lastEvent = '🏆 ' + KINGDOMS[next.winner].name + ' thống nhất Tam Quốc!';
      return { ok: true, state: next, move: chosen };
    }
    let nextTurn = nextAlive(next, mover);
    let loop = 0;
    while (nextTurn != null && legalMoves(next, nextTurn).length === 0 && loop++ < 3) {
      eliminate(next, nextTurn, mover, isInCheck(next, nextTurn) ? 'chiếu bí' : 'hết nước đi');
      if (next.winner != null) break;
      nextTurn = nextAlive(next, nextTurn);
    }
    if (next.winner != null) {
      next.turn = next.winner;
      next.lastEvent = '🏆 ' + KINGDOMS[next.winner].name + ' thống nhất Tam Quốc!';
    } else if (nextTurn != null) {
      next.turn = nextTurn;
      if (isInCheck(next, nextTurn)) next.lastEvent = '⚠ ' + KINGDOMS[nextTurn].name + ' đang bị chiếu!';
      else if (!next.lastEvent || /^Thục đi trước/.test(next.lastEvent)) next.lastEvent = KINGDOMS[nextTurn].name + ' tới lượt.';
    }
    return { ok: true, state: next, move: chosen };
  }

  function material(state, controller) {
    let score = 0;
    for (const p of state.pieces) {
      const value = VALUES[p.type] || 0;
      score += p.controller === controller ? value : -value * 0.46;
    }
    if (!state.alive[controller]) score -= 200000;
    if (state.winner === controller) score += 500000;
    if (isInCheck(state, controller)) score -= 1800;
    return score;
  }

  function describeMove(state, move) {
    const piece = state.pieces.find(p => p.id === move.pieceId);
    const target = state.pieces.find(p => key(p.sector, p.r, p.f) === move.to);
    return (piece?.glyph || '?') + ' ' + move.from + ' → ' + move.to + (target ? ' × ' + target.glyph : '');
  }

  const api = {
    FILES,
    RANKS,
    KINGDOMS,
    TURN_ORDER,
    VALUES,
    key,
    point,
    initialState,
    pieceMap,
    pseudoMovesForPiece,
    legalMoves,
    makeMove,
    isInCheck,
    material,
    describeMove,
    nextKingdom,
    prevKingdom,
    resolveVirtual
  };

  if (typeof window !== 'undefined') window.ThreeKingdomsXiangqi = api;
  if (typeof globalThis !== 'undefined') globalThis.ThreeKingdomsXiangqi = api;
})();
