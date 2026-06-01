/* Prehistoric Bud — client. Rendering + input; the server is authoritative. */
const socket = io();

// ---------- i18n (English default + Chinese) ----------
// All user-facing copy lives here. Static markup is tagged with data-i18n /
// data-i18n-placeholder and filled by applyI18n(); dynamic strings call t().
const I18N = {
  en: {
    docTitle: '🦕 Prehistoric Bud',
    titleHTML: '<span class="pre">PRE</span><span class="his">HIS</span><span class="tor">TOR</span><span class="ic">IC</span> <span class="bud">BUD 🌷</span>',
    tagline: 'An online multiplayer block-puzzle from the dawn of time.',
    namePlaceholder: 'Your name (optional)',
    findMatch: 'Find a Match',
    viewGithub: '⭐ View on GitHub',
    createdBy: 'Created by',
    author1: 'Jaden Yan Peihan',
    author2: 'Peter Yan',
    madeOn: 'Made on June 1, 2026',
    selectBud: 'Select your Bud',
    budSelectHint: "Pick a bud — your opponent won't see which one you chose!",
    target: 'TARGET',
    frozen: 'FROZEN',
    youBoardHint: 'Drag a piece from your tray onto the board to drop it. Fill a row or column to combo!',
    oppBoardHint: 'Score the most coins before the 2-minute timer runs out! Land a STEAL box to guess their bud.',
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
    draw: "It's a Draw!",
    timeUpTie: "Time's up — you both finished on the same coins!",
    wonByPoints: (coins) => `Time's up! You finished ahead with ${coins} coins. 🏆`,
    lostByPoints: (coins) => `Time's up! Your opponent finished ahead with ${coins} coins.`,
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
    titleHTML: '<span class="pre">史</span><span class="his">前</span><span class="tor">花</span><span class="bud">蕾</span> 🌷',
    tagline: '一款来自远古时代的在线多人方块拼图游戏。',
    namePlaceholder: '你的名字（可选）',
    findMatch: '寻找对手',
    viewGithub: '⭐ 在 GitHub 上查看',
    createdBy: '作者',
    author1: '颜培瀚（果果）',
    author2: '颜东明（明明）',
    madeOn: '制作于 2026 年 6 月 1 日',
    selectBud: '选择你的花蕾',
    budSelectHint: '挑一个花蕾——对手看不到你选了哪一个！',
    target: '目标',
    frozen: '冻结',
    youBoardHint: '从托盘里拖一个方块放到棋盘上。填满一整行或一整列即可消除！',
    oppBoardHint: '在 2 分钟倒计时结束前赢得最多金币！抽到“偷取”盒子来猜对方的花蕾。',
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
    draw: '平局！',
    timeUpTie: '时间到——你们的金币一样多！',
    wonByPoints: (coins) => `时间到！你以 ${coins} 枚金币领先获胜。🏆`,
    lostByPoints: (coins) => `时间到！对手以 ${coins} 枚金币领先获胜。`,
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
  $('title').innerHTML = t('titleHTML'); // logo keeps its per-character colors
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

  syncMatchTimer(state.endsAt, state.over);

  drawBoard(yctx, youCanvas, me.grid, true);
  if (opp) drawBoard(octx, oppCanvas, opp.grid, false);

  drawTray(me.tray);

  // Freeze overlay sync (in case we reconnect/refresh)
  if (me.frozenUntil && Date.now() < me.frozenUntil) startFreeze(me.frozenUntil);

  if (state.over) {
    // Game's done — clear any reward overlays and show the result.
    hideOverlay('steal'); hideOverlay('boxes');
    const w = state.over.winnerBud;
    const iWon = !!(w && me.bud && w.id === me.bud.id);
    overContext = {
      kind: 'gameOver',
      iWon,
      tie: !!state.over.tie,
      winnerBudId: w ? w.id : null,
      winnerBudName: w ? w.name : null,
      winnerCoins: state.over.coins,
      reasonCode: state.over.reasonCode || null,
      stuckBudId: state.over.stuckBudId || null,
    };
    renderOver();
    show('over', true);
    return;
  }

  // Reward boxes / steal (only while the match is live)
  if (me.pendingSteal) { showStealUI(me.pendingSteal); }
  else { hideOverlay('steal'); }

  if (me.pendingBoxes) { showBoxesUI(me.pendingBoxes); }
  else { hideOverlay('boxes'); }
}

// Countdown clock driven by the server's authoritative match end time.
let matchEndsAt = null, matchTimerInt = null;
function syncMatchTimer(endsAt, over) {
  const el = $('matchTimer');
  if (over || !endsAt) { clearInterval(matchTimerInt); matchTimerInt = null; matchEndsAt = null; return; }
  if (endsAt === matchEndsAt && matchTimerInt) return; // already ticking this match
  matchEndsAt = endsAt;
  clearInterval(matchTimerInt);
  const tick = () => {
    const left = Math.max(0, matchEndsAt - Date.now());
    const s = Math.ceil(left / 1000);
    el.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', left <= 15000);
    if (left <= 0) { clearInterval(matchTimerInt); matchTimerInt = null; }
  };
  tick();
  matchTimerInt = setInterval(tick, 250);
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
  $('overTitle').textContent = c.tie ? t('draw') : (c.iWon ? t('youWin') : t('youLose'));
  if (c.reasonCode === 'noMoves') {
    const base = t('noMoves', budName(c.stuckBudId, ''));
    $('overMsg').textContent = c.tie ? `${base} ${t('timeUpTie')}` : base;
  } else if (c.tie) {
    $('overMsg').textContent = t('timeUpTie');
  } else {
    $('overMsg').textContent = t(c.iWon ? 'wonByPoints' : 'lostByPoints', c.winnerCoins);
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
    ctx.globalAlpha = 0.6;
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
        startDrag(idx, e.clientX, e.clientY, e.pointerType);
      });
    }
    wrap.appendChild(div);
  });
}

// ---------- Drag & drop (mouse + touch via Pointer Events) ----------
let dragging = false;
let dragPointerType = 'mouse';   // 'touch' lifts the piece above the finger

// Floating sprite that follows the pointer while a piece is dragged off the tray.
const dragGhost = document.createElement('canvas');
dragGhost.id = 'dragGhost';
document.body.appendChild(dragGhost);
const dgCtx = dragGhost.getContext('2d');

function pieceSize(piece) {
  return {
    rows: Math.max(...piece.cells.map(c => c[0])) + 1,
    cols: Math.max(...piece.cells.map(c => c[1])) + 1,
  };
}

// How far (in cells) the piece floats above the pointer. On touch we lift it
// clear of the finger so the landing spot stays visible; with a mouse the piece
// just sits centred under the cursor.
function liftCells(piece) {
  if (dragPointerType !== 'touch') return 0;
  return pieceSize(piece).rows / 2 + 1.2;
}

// The board cell the piece's top-left should snap to for a given pointer
// position. Centres the piece on the pointer (minus the touch lift) so what you
// see under your finger is exactly what drops — WYSIWYG, scale-aware.
function computeOrigin(clientX, clientY) {
  const piece = state && state.you.tray[selectedPiece];
  if (!piece) return null;
  const rect = youCanvas.getBoundingClientRect();
  const cell = youCanvas.width / GRID;
  const x = (clientX - rect.left) * (youCanvas.width / rect.width);
  const y = (clientY - rect.top) * (youCanvas.height / rect.height);
  const { rows, cols } = pieceSize(piece);
  const col = Math.round(x / cell - cols / 2);
  const row = Math.round(y / cell - rows / 2 - liftCells(piece));
  return { row, col };
}

// Does the piece, placed at this origin, overlap the board at all?
function pieceOnBoard(piece, origin) {
  return piece.cells.some(([dr, dc]) => {
    const r = origin.row + dr, c = origin.col + dc;
    return r >= 0 && r < GRID && c >= 0 && c < GRID;
  });
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
// Position the floating sprite to match the same centred + lifted anchor that
// computeOrigin() uses, so the piece doesn't jump as it crosses onto the board.
function moveGhost(clientX, clientY) {
  const piece = state && state.you.tray[selectedPiece];
  if (!piece) return;
  const cellPx = youCanvas.getBoundingClientRect().width / GRID;
  const { rows, cols } = pieceSize(piece);
  dragGhost.style.left = (clientX - (cols / 2) * cellPx) + 'px';
  dragGhost.style.top = (clientY - (rows / 2 + liftCells(piece)) * cellPx) + 'px';
}

function startDrag(idx, clientX, clientY, pointerType) {
  if (!state || !state.you.tray[idx] || state.you.phase !== 'playing') return;
  if (state.you.frozenUntil && Date.now() < state.you.frozenUntil) return; // frozen
  dragPointerType = pointerType || 'mouse';
  selectedPiece = idx; dragging = true;
  renderDragSprite(state.you.tray[idx]);
  // Show the on-board preview immediately if the piece already overlaps the board.
  const origin = computeOrigin(clientX, clientY);
  hover = origin && pieceOnBoard(state.you.tray[idx], origin) ? origin : null;
  moveGhost(clientX, clientY);
  dragGhost.style.display = hover ? 'none' : 'block';
  drawTray(state.you.tray); // highlight the picked-up piece
  redrawSelf();
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
}
function onDragMove(e) {
  if (!dragging) return;
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);
  const origin = computeOrigin(e.clientX, e.clientY);
  if (origin && pieceOnBoard(state.you.tray[selectedPiece], origin)) {
    hover = origin;
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
  const piece = state && state.you.tray[selectedPiece];
  const origin = computeOrigin(e.clientX, e.clientY);
  // Drop only when the piece fully fits on empty cells — the same rule the
  // server enforces — so a near-miss simply returns the piece to the tray.
  if (piece && origin && canPlace(piece, origin.row, origin.col, state.you.grid)) {
    socket.emit('place', { pieceIdx: selectedPiece, row: origin.row, col: origin.col });
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
