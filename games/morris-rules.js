(() => {
  'use strict';

  const POINTS = 24;
  const MAX_PIECES = 9;
  const DRAW_PLY = 100;
  const ADJ = [
    [1,9], [0,2,4], [1,14], [4,10], [1,3,5,7], [4,13],
    [7,11], [4,6,8], [7,12], [0,10,21], [3,9,11,18], [6,10,15],
    [8,13,17], [5,12,14,20], [2,13,23], [11,16], [15,17,19], [12,16],
    [10,19], [16,18,20,22], [13,19], [9,22], [19,21,23], [14,22]
  ];
  const MILLS = [
    [0,1,2], [3,4,5], [6,7,8], [9,10,11], [12,13,14], [15,16,17], [18,19,20], [21,22,23],
    [0,9,21], [3,10,18], [6,11,15], [1,4,7], [16,19,22], [8,12,17], [5,13,20], [2,14,23]
  ];

  const other = seat => seat === 'A' ? 'B' : 'A';
  const emptyBoard = () => '.'.repeat(POINTS);
  const initialState = () => ({ board: emptyBoard(), placed: { A: 0, B: 0 }, last: -1, noCapture: 0 });

  function normalize(state) {
    const board = typeof state?.board === 'string' && state.board.length === POINTS ? state.board : emptyBoard();
    const placed = {
      A: Math.max(0, Math.min(MAX_PIECES, Number(state?.placed?.A) || 0)),
      B: Math.max(0, Math.min(MAX_PIECES, Number(state?.placed?.B) || 0))
    };
    return {
      board,
      placed,
      last: Number.isInteger(state?.last) ? state.last : -1,
      noCapture: Math.max(0, Number(state?.noCapture) || 0)
    };
  }

  const count = (board, seat) => [...board].filter(x => x === seat).length;
  const millsFor = (board, seat) => MILLS.filter(line => line.every(i => board[i] === seat));
  const isInMill = (board, idx, seat) => MILLS.some(line => line.includes(idx) && line.every(i => board[i] === seat));
  const formsMill = (board, idx, seat) => isInMill(board, idx, seat);

  function phase(state, seat) {
    const s = normalize(state);
    if (s.placed[seat] < MAX_PIECES) return 'placing';
    return count(s.board, seat) === 3 ? 'flying' : 'moving';
  }

  function removable(board, victim) {
    const pieces = [];
    const outside = [];
    for (let i = 0; i < POINTS; i++) {
      if (board[i] !== victim) continue;
      pieces.push(i);
      if (!isInMill(board, i, victim)) outside.push(i);
    }
    return outside.length ? outside : pieces;
  }

  function destinations(state, seat, from) {
    const s = normalize(state);
    if (!Number.isInteger(from) || from < 0 || from >= POINTS || s.board[from] !== seat) return [];
    const p = phase(s, seat);
    if (p === 'placing') return [];
    if (p === 'flying') {
      const out = [];
      for (let i = 0; i < POINTS; i++) if (s.board[i] === '.') out.push(i);
      return out;
    }
    return ADJ[from].filter(i => s.board[i] === '.');
  }

  function preview(state, move, seat) {
    if (seat !== 'A' && seat !== 'B') return null;
    const s = normalize(state);
    const to = Number(move?.to);
    if (!Number.isInteger(to) || to < 0 || to >= POINTS || s.board[to] !== '.') return null;

    const p = phase(s, seat);
    let from = null;
    let board = s.board;
    const placed = { ...s.placed };

    if (p === 'placing') {
      if (move?.from != null) return null;
      placed[seat]++;
    } else {
      from = Number(move?.from);
      if (!Number.isInteger(from) || from < 0 || from >= POINTS || board[from] !== seat) return null;
      if (!destinations(s, seat, from).includes(to)) return null;
      board = board.slice(0, from) + '.' + board.slice(from + 1);
    }

    board = board.slice(0, to) + seat + board.slice(to + 1);
    const madeMill = formsMill(board, to, seat);
    const canRemove = madeMill ? removable(board, other(seat)) : [];
    return { state: { board, placed, last: to, noCapture: s.noCapture }, from, to, madeMill, removable: canRemove };
  }

  function baseMoves(state, seat) {
    const s = normalize(state);
    const p = phase(s, seat);
    const out = [];
    if (p === 'placing') {
      for (let to = 0; to < POINTS; to++) if (s.board[to] === '.') out.push({ to });
      return out;
    }
    for (let from = 0; from < POINTS; from++) {
      if (s.board[from] !== seat) continue;
      for (const to of destinations(s, seat, from)) out.push({ from, to });
    }
    return out;
  }

  function legalMoves(state, seat) {
    const out = [];
    for (const base of baseMoves(state, seat)) {
      const p = preview(state, base, seat);
      if (!p) continue;
      if (p.madeMill && p.removable.length) {
        for (const remove of p.removable) out.push({ ...base, remove });
      } else out.push(base);
    }
    return out;
  }

  function apply(state, move, seat) {
    const before = normalize(state);
    const p = preview(before, move, seat);
    if (!p) return null;

    let board = p.state.board;
    let captured = false;
    if (p.madeMill && p.removable.length) {
      const remove = Number(move?.remove);
      if (!Number.isInteger(remove) || !p.removable.includes(remove)) return null;
      board = board.slice(0, remove) + '.' + board.slice(remove + 1);
      captured = true;
    } else if (move?.remove != null) {
      return null;
    }

    const next = other(seat);
    const bothPlaced = p.state.placed.A >= MAX_PIECES && p.state.placed.B >= MAX_PIECES;
    const noCapture = bothPlaced ? (captured ? 0 : before.noCapture + 1) : 0;
    const nextState = { board, placed: p.state.placed, last: p.to, noCapture };

    if (p.state.placed[next] >= MAX_PIECES) {
      const nextCount = count(board, next);
      if (nextCount < 3) return { state: nextState, winner: seat, reason: 'đối thủ còn dưới 3 quân' };
      if (!baseMoves(nextState, next).length) return { state: nextState, winner: seat, reason: 'đối thủ hết nước đi' };
    }
    if (bothPlaced && noCapture >= DRAW_PLY) return { state: nextState, winner: 'draw', reason: '100 nước không ăn quân' };
    return { state: nextState, nextTurn: next };
  }

  window.MorrisRules = {
    POINTS, MAX_PIECES, DRAW_PLY, ADJ, MILLS,
    emptyBoard, initialState, normalize, count, millsFor, isInMill, formsMill,
    phase, removable, destinations, preview, baseMoves, legalMoves, apply
  };
})();
