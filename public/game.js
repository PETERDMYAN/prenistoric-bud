/* Prehistoric Bud — client. Rendering + input; the server is authoritative. */
const socket = io();

// ---------- i18n (English default + Chinese) ----------
// All user-facing copy lives here. Static markup is tagged with data-i18n /
// data-i18n-placeholder and filled by applyI18n(); dynamic strings call t().
const I18N = {
  en: {
    docTitle: '🦕 Prehistoric Bud',
    tagline: 'An online multiplayer block-puzzle from the dawn of time.',
    namePlaceholder: 'Your name (optional)',
    findMatch: 'Find a Match',
    viewGithub: '⭐ View on GitHub',
    createdBy: 'Created by',
    madeOn: 'Made on June 1, 2026',
    selectBud: 'Select your Bud',
    budSelectHint: "Pick a bud — your opponent won't see which one you chose!",
    target: 'TARGET',
    frozen: 'FROZEN',
    youBoardHint: 'Drag a piece from your tray onto the board to drop it. Fill a row or column to combo!',
    oppBoardHint: 'Reach the goal first. Land a STEAL box to guess their bud!',
    reachedTarget: 'You reached the target! 🎉',
    chooseBox: 'Choose a box…',
    stealTitle: 'STEAL COINS 🥷',
    stealHint: "Guess your opponent's bud. Correct = steal half their coins + freeze them 15s!",
    playAgain: 'Play Again',
    you: 'YOU',
    opponent: 'OPPONENT',
    searching: 'Searching for an opponent…',
    waiting: 'Waiting for another player to join…',
    combo: (lines, gems) => `COMBO ×${lines}!  −${gems} ◆`,
    stealWin: (stolen) => `Correct! You stole ${stolen} coins and froze your opponent! 🥷`,
    stealFail: 'Wrong bud — the heist failed. 😬',
    opponentLeftTitle: 'Opponent Left',
    opponentLeftMsg: 'Your opponent disconnected. You win by default!',
    gameOver: 'Game Over',
    youWin: 'You Win! 🏆',
    youLose: 'You Lose',
    reachedGoalYou: (goal) => `You reached ${goal} coins first.`,
    reachedGoalOpp: (who, goal) => `${who} reached ${goal} coins first.`,
    noMoves: (bud) => `${bud} has no moves left! 🪨`,
    boxCoins: (amount) => `+${amount} coins`,
    boxDouble: 'DOUBLE COINS',
    boxTriple: 'TRIPLE COINS',
    boxSteal: 'STEAL COINS',
    boxNothing: (amount) => `NOTHING! ${amount} coins`,
    buds: {
      pyro: 'Pyrobloom', aqua: 'Aqualily', sun: 'Sunpetal',
      mystic: 'Mystivine', tulip: 'Tulipuff', hibis: 'Hibisflare',
    },
  },
  zh: {
    docTitle: '🦕 史前花蕾',
    tagline: '一款来自远古时代的在线多人方块拼图游戏。',
    namePlaceholder: '你的名字（可选）',
    findMatch: '寻找对手',
    viewGithub: '⭐ 在 GitHub 上查看',
    createdBy: '作者',
    madeOn: '制作于 2026 年 6 月 1 日',
    selectBud: '选择你的花蕾',
    budSelectHint: '挑一个花蕾——对手看不到你选了哪一个！',
    target: '目标',
    frozen: '冻结',
    youBoardHint: '从托盘里拖一个方块放到棋盘上。填满一整行或一整列即可消除！',
    oppBoardHint: '抢先达到目标。抽到“偷取”盒子就能猜对方的花蕾！',
    reachedTarget: '你达到目标了！🎉',
    chooseBox: '选择一个盒子…',
    stealTitle: '偷取金币 🥷',
    stealHint: '猜出对手的花蕾。猜对＝偷走对方一半金币并冻结他们 15 秒！',
    playAgain: '再玩一次',
    you: '你',
    opponent: '对手',
    searching: '正在寻找对手…',
    waiting: '等待其他玩家加入…',
    combo: (lines, gems) => `连消 ×${lines}！  −${gems} ◆`,
    stealWin: (stolen) => `猜对了！你偷走了 ${stolen} 枚金币并冻结了对手！🥷`,
    stealFail: '花蕾猜错了——偷窃失败。😬',
    opponentLeftTitle: '对手离开了',
    opponentLeftMsg: '你的对手已断开连接。你不战而胜！',
    gameOver: '游戏结束',
    youWin: '你赢了！🏆',
    youLose: '你输了',
    reachedGoalYou: (goal) => `你率先达到了 ${goal} 枚金币。`,
    reachedGoalOpp: (who, goal) => `${who} 率先达到了 ${goal} 枚金币。`,
    noMoves: (bud) => `${bud} 无处可放了！🪨`,
    boxCoins: (amount) => `+${amount} 金币`,
    boxDouble: '金币翻倍',
    boxTriple: '金币三倍',
    boxSteal: '偷取金币',
    boxNothing: (amount) => `什么都没有！${amount} 金币`,
    buds: {
      pyro: '火焰花', aqua: '水莲花', sun: '太阳花',
      mystic: '神秘藤', tulip: '郁金香', hibis: '朱槿焰',
    },
  },
};

let lang = localStorage.getItem('lang') || 'en';
if (!I18N[lang]) lang = 'en';

function t(key, ...args) {
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(...args) : v;
}
// Localized bud name by id, falling back to the server-provided name.
function budName(id, fallback) {
  return (I18N[lang].buds && I18N[lang].buds[id]) || fallback;
}
// Build a localized reward-box label from the server's structured box data.
function boxLabel(box) {
  switch (box.type) {
    case 'coins':   return t('boxCoins', box.amount);
    case 'double':  return t('boxDouble');
    case 'triple':  return t('boxTriple');
    case 'steal':   return t('boxSteal');
    case 'nothing': return t('boxNothing', box.amount);
    default:        return box.label || '';
  }
}

// Fill all static markup tagged with data-i18n / data-i18n-placeholder.
function applyI18n() {
  document.documentElement.lang = lang === 'zh' ? 'zh' : 'en';
  document.title = t('docTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function setLang(next) {
  if (!I18N[next] || next === lang) return;
  lang = next;
  localStorage.setItem('lang', lang);
  applyI18n();
  if (state) render();      // refresh dynamic labels (headers, overlays)
  renderOver();             // refresh game-over copy if it's showing
}

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

// ---------- Language selector ----------
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.onclick = () => setLang(btn.dataset.lang);
});

// ---------- Lobby ----------
$('playBtn').onclick = () => {
  const name = ($('nameInput').value || '').trim();
  socket.emit('join', { name });
  $('lobbyStatus').textContent = t('searching');
};
socket.on('waiting', () => { $('lobbyStatus').textContent = t('waiting'); });

socket.on('matched', ({ budOptions }) => {
  const wrap = $('budOptions');
  wrap.innerHTML = '';
  budOptions.forEach(b => {
    const card = document.createElement('div');
    card.className = 'bud-card';
    card.innerHTML = `<div class="emoji">${b.emoji}</div><div class="name">${budName(b.id, b.name)}</div>`;
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
  const toast = $('comboToast');
  const lines = rows + cols;
  toast.textContent = t('combo', lines, gems);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 900);
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
  alert(correct ? t('stealWin', stolen) : t('stealFail'));
});

socket.on('opponentLeft', () => {
  overContext = { kind: 'opponentLeft' };
  renderOver();
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
  $('youLabel').textContent = (me.name && me.name !== 'Player') ? me.name : t('you');
  if (opp) $('oppLabel').textContent = (opp.name && opp.name !== 'Player') ? opp.name : t('opponent');
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
    const iWon = !!(w && me.bud && w.id === me.bud.id);
    overContext = {
      kind: 'gameOver',
      iWon,
      winnerBudId: w ? w.id : null,
      winnerBudName: w ? w.name : null,
      reasonCode: state.over.reasonCode || null,
      stuckBudId: state.over.stuckBudId || null,
      coinGoal: state.coinGoal,
    };
    renderOver();
    show('over', true);
  }
}

// Game-over / opponent-left copy is localized here so it can be re-rendered
// when the player switches language while the screen is up.
let overContext = null;
function renderOver() {
  if (!overContext) return;
  if (overContext.kind === 'opponentLeft') {
    $('overTitle').textContent = t('opponentLeftTitle');
    $('overMsg').textContent = t('opponentLeftMsg');
    return;
  }
  const c = overContext;
  $('overTitle').textContent = c.iWon ? t('youWin') : t('youLose');
  if (c.reasonCode === 'noMoves') {
    $('overMsg').textContent = t('noMoves', budName(c.stuckBudId, ''));
  } else if (c.iWon) {
    $('overMsg').textContent = t('reachedGoalYou', c.coinGoal);
  } else {
    const who = c.winnerBudId ? budName(c.winnerBudId, c.winnerBudName) : t('opponent');
    $('overMsg').textContent = t('reachedGoalOpp', who, c.coinGoal);
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
      div.textContent = boxLabel(box);
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
    card.innerHTML = `<div class="emoji">${b.emoji}</div><div class="name">${budName(b.id, b.name)}</div>`;
    card.onclick = () => { hideOverlay('steal'); socket.emit('guessBud', { budId: b.id }); };
    wrap.appendChild(card);
  });
}

applyI18n();
show('lobby');
