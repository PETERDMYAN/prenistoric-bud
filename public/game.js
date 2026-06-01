/* Prehistoric Bud — client. Rendering + input; the server is authoritative. */
const socket = io();

const $ = (id) => document.getElementById(id);
const screens = ['lobby', 'budSelect', 'game', 'boxes', 'steal', 'over'];
function show(id, overlay = false) {
  if (overlay) { $(id).classList.add('active'); return; }
  screens.forEach(s => $(s).classList.remove('active'));
  $(id).classList.add('active');
}
function hideOverlay(id) { $(id).classList.remove('active'); }

let state = null;      // latest server state
let GRID = 10;
let selectedPiece = -1; // index into tray
let hover = null;       // {row,col} ghost position on own board

const youCanvas = $('youCanvas'), yctx = youCanvas.getContext('2d');
const oppCanvas = $('oppCanvas'), octx = oppCanvas.getContext('2d');

// ---------- Lobby ----------
$('playBtn').onclick = () => { socket.emit('join'); $('lobbyStatus').textContent = 'Searching for an opponent…'; };
socket.on('waiting', () => { $('lobbyStatus').textContent = 'Waiting for another player to join…'; });

socket.on('matched', ({ budOptions }) => {
  const wrap = $('budOptions');
  wrap.innerHTML = '';
  budOptions.forEach(b => {
    const card = document.createElement('div');
    card.className = 'bud-card';
    card.innerHTML = `<div class="emoji">${b.emoji}</div><div class="name">${b.name}</div>`;
    card.onclick = () => socket.emit('selectBud', { budId: b.id });
    wrap.appendChild(card);
  });
  show('budSelect');
});

// ---------- State sync ----------
socket.on('state', (s) => {
  state = s; GRID = s.grid;
  render();
});

socket.on('combo', ({ rows, cols, gems }) => {
  const t = $('comboToast');
  const lines = rows + cols;
  t.textContent = `COMBO ×${lines}!  −${gems} ◆`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 900);
});

let freezeTimer = null;
socket.on('frozen', ({ until }) => startFreeze(until));
function startFreeze(until) {
  clearInterval(freezeTimer);
  $('freezeOverlay').classList.remove('hidden');
  const tick = () => {
    const left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) { clearInterval(freezeTimer); $('freezeOverlay').classList.add('hidden'); return; }
    $('freezeTime').textContent = left;
  };
  tick(); freezeTimer = setInterval(tick, 250);
}

socket.on('stealResult', ({ correct, stolen }) => {
  alert(correct ? `Correct! You stole ${stolen} coins and froze your opponent! 🥷` : 'Wrong bud — the heist failed. 😬');
});

socket.on('opponentLeft', () => {
  $('overTitle').textContent = 'Opponent Left';
  $('overMsg').textContent = 'Your opponent disconnected. You win by default!';
  show('over', true);
});

// ---------- Render ----------
function render() {
  if (!state) return;
  const me = state.you, opp = state.opponent;

  if (me.phase === 'selecting') { show('budSelect'); return; }

  show('game');
  // headers
  if (me.bud) $('youBud').textContent = me.bud.emoji;
  $('youCoins').textContent = me.coins;
  $('youTarget').textContent = Math.max(0, me.target);
  $('oppCoins').textContent = opp ? opp.coins : 0;
  $('oppTarget').textContent = opp ? Math.max(0, opp.target) : '—';

  drawBoard(yctx, youCanvas, me.grid, true);
  if (opp) drawBoard(octx, oppCanvas, opp.grid, false);

  drawTray(me.tray);

  // Freeze overlay sync (in case we reconnect/refresh)
  if (me.frozenUntil && Date.now() < me.frozenUntil) startFreeze(me.frozenUntil);

  // Reward boxes
  if (me.pendingSteal) { showStealUI(me.pendingSteal); }
  else { hideOverlay('steal'); }

  if (me.pendingBoxes) { showBoxesUI(me.pendingBoxes); }
  else { hideOverlay('boxes'); }

  if (state.over) {
    const w = state.over.winnerBud;
    const iWon = w && me.bud && w.id === me.bud.id;
    $('overTitle').textContent = iWon ? 'You Win! 🏆' : 'You Lose';
    $('overMsg').textContent = state.over.reason
      ? state.over.reason
      : `${iWon ? 'You' : (w ? w.name : 'Opponent')} reached ${state.coinGoal} coins first.`;
    show('over', true);
  }
}

function drawBoard(ctx, canvas, grid, isSelf) {
  const n = GRID, cell = canvas.width / n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // grid lines
  ctx.strokeStyle = '#2a3340'; ctx.lineWidth = 1;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
  }
  // filled cells
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = grid[r][c];
    if (v) drawCell(ctx, c * cell, r * cell, cell, v.color, v.gems);
  }
  // ghost preview for own board
  if (isSelf && selectedPiece >= 0 && hover && state.you.tray[selectedPiece]) {
    const piece = state.you.tray[selectedPiece];
    const ok = canPlace(piece, hover.row, hover.col, grid);
    ctx.globalAlpha = 0.45;
    piece.cells.forEach(([dr, dc], i) => {
      const r = hover.row + dr, c = hover.col + dc;
      if (r >= 0 && r < n && c >= 0 && c < n)
        drawCell(ctx, c * cell, r * cell, cell, ok ? state.you.bud.color : '#888', piece.gems[i]);
    });
    ctx.globalAlpha = 1;
  }
}

function drawCell(ctx, x, y, size, color, gems) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 1, y + 1, size - 2, 4);
  if (gems > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = `${size * 0.42}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('◆'.repeat(Math.min(gems, 1)), x + size / 2, y + size / 2);
    if (gems > 1) {
      ctx.font = `bold ${size * 0.3}px sans-serif`;
      ctx.fillStyle = '#1b2a38';
      ctx.fillText(gems, x + size / 2, y + size / 2 + 1);
    }
  }
}

function canPlace(piece, originR, originC, grid) {
  for (const [dr, dc] of piece.cells) {
    const r = originR + dr, c = originC + dc;
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    if (grid[r][c]) return false;
  }
  return true;
}

// ---------- Tray ----------
function drawTray(tray) {
  const wrap = $('tray'); wrap.innerHTML = '';
  tray.forEach((piece, idx) => {
    const div = document.createElement('div');
    div.className = 'tray-piece' + (idx === selectedPiece ? ' selected' : '') + (piece ? '' : ' used');
    if (piece) {
      const cv = document.createElement('canvas');
      const maxR = Math.max(...piece.cells.map(c => c[0])) + 1;
      const maxC = Math.max(...piece.cells.map(c => c[1])) + 1;
      const s = 20; cv.width = maxC * s; cv.height = maxR * s;
      const c2 = cv.getContext('2d');
      piece.cells.forEach(([r, cc], i) => drawCell(c2, cc * s, r * s, s, state.you.bud.color, piece.gems[i]));
      div.appendChild(cv);
      div.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startDrag(idx, e.clientX, e.clientY);
      });
    }
    wrap.appendChild(div);
  });
}

// ---------- Drag & drop (mouse + touch via Pointer Events) ----------
let dragging = false;

// Floating sprite that follows the pointer while a piece is dragged off the tray.
const dragGhost = document.createElement('canvas');
dragGhost.id = 'dragGhost';
document.body.appendChild(dragGhost);
const dgCtx = dragGhost.getContext('2d');

// Map a pointer position (client coords) to a grid cell on the player's board,
// accounting for the canvas being CSS-scaled down on small screens.
function pointToCell(clientX, clientY) {
  const rect = youCanvas.getBoundingClientRect();
  const cell = youCanvas.width / GRID;
  const x = (clientX - rect.left) * (youCanvas.width / rect.width);
  const y = (clientY - rect.top) * (youCanvas.height / rect.height);
  return { row: Math.floor(y / cell), col: Math.floor(x / cell) };
}
function overBoard(clientX, clientY) {
  const r = youCanvas.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}
function redrawSelf() { if (state) drawBoard(yctx, youCanvas, state.you.grid, true); }

// Render the dragged piece into the floating ghost canvas, sized to match the
// board's on-screen cell size so it lines up with where it will drop.
function renderDragSprite(piece) {
  const cellPx = youCanvas.getBoundingClientRect().width / GRID;
  const maxR = Math.max(...piece.cells.map(c => c[0])) + 1;
  const maxC = Math.max(...piece.cells.map(c => c[1])) + 1;
  const dpr = window.devicePixelRatio || 1;
  dragGhost.width = maxC * cellPx * dpr;
  dragGhost.height = maxR * cellPx * dpr;
  dragGhost.style.width = maxC * cellPx + 'px';
  dragGhost.style.height = maxR * cellPx + 'px';
  dgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dgCtx.clearRect(0, 0, dragGhost.width, dragGhost.height);
  piece.cells.forEach(([r, c], i) =>
    drawCell(dgCtx, c * cellPx, r * cellPx, cellPx, state.you.bud.color, piece.gems[i]));
}
function moveGhost(clientX, clientY) {
  // Anchor the sprite's top-left cell roughly under the pointer.
  const cellPx = youCanvas.getBoundingClientRect().width / GRID;
  dragGhost.style.left = (clientX - cellPx / 2) + 'px';
  dragGhost.style.top = (clientY - cellPx / 2) + 'px';
}

function startDrag(idx, clientX, clientY) {
  if (!state || !state.you.tray[idx] || state.you.phase !== 'playing') return;
  selectedPiece = idx; dragging = true;
  renderDragSprite(state.you.tray[idx]);
  moveGhost(clientX, clientY);
  dragGhost.style.display = 'block';
  drawTray(state.you.tray); // highlight the picked-up piece
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
}
function onDragMove(e) {
  if (!dragging) return;
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);
  if (overBoard(e.clientX, e.clientY)) {
    hover = pointToCell(e.clientX, e.clientY);
    dragGhost.style.display = 'none'; // on-board ghost shows the exact landing spot
  } else {
    hover = null;
    dragGhost.style.display = 'block';
  }
  redrawSelf();
}
function onDragEnd(e) {
  if (!dragging) return;
  dragging = false;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  dragGhost.style.display = 'none';
  const dropOnBoard = overBoard(e.clientX, e.clientY);
  if (dropOnBoard) {
    const { row, col } = pointToCell(e.clientX, e.clientY);
    socket.emit('place', { pieceIdx: selectedPiece, row, col });
  }
  selectedPiece = -1; hover = null;
  redrawSelf();
  if (state) drawTray(state.you.tray); // clear pick-up highlight if drop missed
}

// ---------- Reward boxes ----------
function showBoxesUI(boxes) {
  show('boxes', true);
  const wrap = $('boxOptions'); wrap.innerHTML = '';
  boxes.forEach((box) => {
    const div = document.createElement('div');
    div.className = 'box';
    div.textContent = '🎁';
    div.onclick = () => {
      if (div.classList.contains('opened')) return;
      div.classList.add('opened');
      div.style.background = box.color;
      div.textContent = box.label;
      socket.emit('chooseBox', { boxIdx: box.idx });
    };
    wrap.appendChild(div);
  });
}

// ---------- Steal guessing ----------
function showStealUI(steal) {
  hideOverlay('boxes');
  show('steal', true);
  const wrap = $('stealOptions'); wrap.innerHTML = '';
  steal.options.forEach(b => {
    const card = document.createElement('div');
    card.className = 'bud-card';
    card.innerHTML = `<div class="emoji">${b.emoji}</div><div class="name">${b.name}</div>`;
    card.onclick = () => { hideOverlay('steal'); socket.emit('guessBud', { budId: b.id }); };
    wrap.appendChild(card);
  });
}

show('lobby');
