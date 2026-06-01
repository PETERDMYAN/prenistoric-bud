/**
 * Prehistoric Bud — authoritative multiplayer server.
 * Handles matchmaking, per-player grid state, line/column combos,
 * reward boxes, and the "steal coins" bud-guessing mechanic.
 */
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ---- Game constants ----
const GRID = 10; // 10x10 board
const TARGET_START = 30; // gems needed to clear before reward boxes
const COIN_GOAL = 300; // first to this many coins wins
const TRAY_SIZE = 3; // pieces offered at a time
const FREEZE_MS = 15000; // steal freeze duration

// The pool of "buds" players can be. Used for selection and for stealing guesses.
const BUDS = [
  { id: 'rex', name: 'Rexy', emoji: '🦖', color: '#e74c3c' },
  { id: 'bronto', name: 'Bronto', emoji: '🦕', color: '#27ae60' },
  { id: 'raptor', name: 'Raptor', emoji: '🦎', color: '#8e44ad' },
  { id: 'tri', name: 'Tri', emoji: '🦏', color: '#2980b9' },
  { id: 'dactyl', name: 'Dactyl', emoji: '🦅', color: '#e67e22' },
  { id: 'sauro', name: 'Sauro', emoji: '🐊', color: '#16a085' },
];

// Tetromino shapes (4 cells each). No rotation — random orientation on spawn.
const SHAPES = [
  [[0,0],[1,0],[2,0],[3,0]], // I vertical
  [[0,0],[0,1],[0,2],[0,3]], // I horizontal
  [[0,0],[0,1],[1,0],[1,1]], // O
  [[0,0],[0,1],[0,2],[1,1]], // T
  [[0,1],[1,0],[1,1],[2,1]], // T rot
  [[0,0],[1,0],[1,1],[2,1]], // S
  [[0,1],[1,0],[1,1],[2,0]], // Z
  [[0,0],[1,0],[2,0],[2,1]], // L
  [[0,1],[1,1],[2,1],[2,0]], // J
  [[0,0],[0,1],[0,2],[1,0]], // J flat
  [[0,0],[0,1],[0,2],[1,2]], // L flat
];

const REWARDS = [
  { type: 'coins', amount: 55, label: '+55 coins', color: '#27ae60' },
  { type: 'coins', amount: 95, label: '+95 coins', color: '#27ae60' },
  { type: 'double', label: 'DOUBLE COINS', color: '#16a085' },
  { type: 'triple', label: 'TRIPLE COINS', color: '#16a085' },
  { type: 'steal', label: 'STEAL COINS', color: '#8e44ad' },
  { type: 'nothing', amount: -15, label: 'NOTHING! -15 coins', color: '#e74c3c' },
];

function rand(n) { return Math.floor(Math.random() * n); }
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a piece with normalized cells and 2-4 gems distributed across its 4 cells.
function makePiece() {
  const cells = SHAPES[rand(SHAPES.length)].map(c => c.slice());
  const gemCount = 2 + rand(3); // 2..4
  const gems = [0, 0, 0, 0];
  for (let i = 0; i < gemCount; i++) gems[rand(4)]++;
  return { cells, gems };
}

function newTray() {
  return Array.from({ length: TRAY_SIZE }, makePiece);
}

function emptyGrid() {
  // Each cell: null (empty) or { color, gems }
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

// ---- Player & room model ----
function makePlayer(socket) {
  return {
    socket,
    bud: null,
    grid: emptyGrid(),
    tray: newTray(),
    coins: 0,
    target: TARGET_START,
    phase: 'selecting', // selecting | playing | boxes | frozen | done
    frozenUntil: 0,
    pendingBoxes: null,
    pendingSteal: null,
  };
}

const rooms = new Map(); // roomId -> { players: [p1,p2], over }
let waiting = null; // a socket awaiting a partner
let roomSeq = 0;

function opponent(room, player) {
  return room.players.find(p => p !== player);
}

// Public view of a player's state to send to a client (self or opponent).
function playerView(p, isSelf) {
  return {
    bud: p.bud,
    coins: p.coins,
    target: p.target,
    phase: p.phase,
    frozenUntil: p.frozenUntil,
    grid: p.grid,
    tray: isSelf ? p.tray : null,
    pendingBoxes: isSelf ? p.pendingBoxes : null,
    pendingSteal: isSelf ? p.pendingSteal : null,
  };
}

function pushState(room) {
  for (const p of room.players) {
    const opp = opponent(room, p);
    p.socket.emit('state', {
      you: playerView(p, true),
      opponent: opp ? playerView(opp, false) : null,
      coinGoal: COIN_GOAL,
      grid: GRID,
      over: room.over || null,
    });
  }
}

// Attempt to place piece at (originR, originC). Returns true on success.
function placePiece(player, pieceIdx, originR, originC) {
  const piece = player.tray[pieceIdx];
  if (!piece) return false;
  const abs = piece.cells.map(([r, c]) => [r + originR, c + originC]);
  // Validate bounds + emptiness
  for (const [r, c] of abs) {
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    if (player.grid[r][c]) return false;
  }
  // Place
  abs.forEach(([r, c], i) => {
    player.grid[r][c] = { color: player.bud.color, gems: piece.gems[i] };
  });
  // Consume the piece; refill tray when empty
  player.tray[pieceIdx] = null;
  if (player.tray.every(t => t === null)) player.tray = newTray();

  resolveCombos(player);
  return true;
}

// Can the player legally place ANY remaining tray piece anywhere on the board?
function hasAnyMove(player) {
  for (const piece of player.tray) {
    if (!piece) continue;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        let fits = true;
        for (const [dr, dc] of piece.cells) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID || player.grid[rr][cc]) { fits = false; break; }
        }
        if (fits) return true;
      }
    }
  }
  return false;
}

// Clear any full rows/columns; subtract their gems from the target.
function resolveCombos(player) {
  const g = player.grid;
  const fullRows = [];
  const fullCols = [];
  for (let r = 0; r < GRID; r++) if (g[r].every(c => c)) fullRows.push(r);
  for (let c = 0; c < GRID; c++) {
    let full = true;
    for (let r = 0; r < GRID; r++) if (!g[r][c]) { full = false; break; }
    if (full) fullCols.push(c);
  }
  if (!fullRows.length && !fullCols.length) return;

  let gemsCleared = 0;
  const clearCell = (r, c) => {
    if (g[r][c]) { gemsCleared += g[r][c].gems; g[r][c] = null; }
  };
  fullRows.forEach(r => { for (let c = 0; c < GRID; c++) clearCell(r, c); });
  fullCols.forEach(c => { for (let r = 0; r < GRID; r++) clearCell(r, c); });

  player.target -= gemsCleared;
  player.socket.emit('combo', {
    rows: fullRows.length, cols: fullCols.length, gems: gemsCleared,
  });

  if (player.target <= 0) enterBoxes(player);
}

function enterBoxes(player) {
  player.phase = 'boxes';
  player.target = 0;
  // 4 boxes drawn from the reward pool (shuffled, may repeat types is fine)
  player.pendingBoxes = shuffle(REWARDS).slice(0, 4).map((r, i) => ({ idx: i, ...r }));
}

function applyReward(room, player, boxIdx) {
  const box = player.pendingBoxes && player.pendingBoxes[boxIdx];
  if (!box) return;
  player.pendingBoxes = null;

  switch (box.type) {
    case 'coins': player.coins += box.amount; finishBox(room, player); break;
    case 'nothing': player.coins = Math.max(0, player.coins + box.amount); finishBox(room, player); break;
    case 'double': player.coins *= 2; finishBox(room, player); break;
    case 'triple': player.coins *= 3; finishBox(room, player); break;
    case 'steal': beginSteal(room, player); break;
  }
}

function beginSteal(room, player) {
  const opp = opponent(room, player);
  if (!opp || !opp.bud) { finishBox(room, player); return; }
  // 3 bud options including the real one.
  const decoys = shuffle(BUDS.filter(b => b.id !== opp.bud.id)).slice(0, 2);
  const options = shuffle([opp.bud, ...decoys]).map(b => ({ id: b.id, emoji: b.emoji, name: b.name }));
  player.pendingSteal = { options };
  player.phase = 'boxes'; // still in reward flow
}

function resolveSteal(room, player, budId) {
  const opp = opponent(room, player);
  player.pendingSteal = null;
  let stolen = 0, correct = false;
  if (opp && opp.bud && opp.bud.id === budId) {
    correct = true;
    stolen = Math.floor(opp.coins / 2);
    opp.coins -= stolen;
    player.coins += stolen;
    // Freeze the opponent for 15s
    opp.frozenUntil = Date.now() + FREEZE_MS;
    opp.socket.emit('frozen', { until: opp.frozenUntil });
  }
  player.socket.emit('stealResult', { correct, stolen });
  finishBox(room, player);
}

function finishBox(room, player) {
  // Check win
  if (player.coins >= COIN_GOAL && !room.over) {
    room.over = { winnerBud: player.bud, coins: player.coins };
    room.players.forEach(p => { p.phase = 'done'; });
    pushState(room);
    return;
  }
  // Continue playing: reset target, fresh tray.
  player.phase = 'playing';
  player.target = TARGET_START;
  player.tray = newTray();
  pushState(room);
}

io.on('connection', (socket) => {
  socket.on('join', () => {
    if (waiting && waiting.connected && waiting !== socket) {
      const roomId = 'r' + (++roomSeq);
      const p1 = makePlayer(waiting);
      const p2 = makePlayer(socket);
      const room = { id: roomId, players: [p1, p2], over: null };
      rooms.set(roomId, room);
      p1.socket.data.room = roomId; p1.socket.data.player = p1;
      p2.socket.data.room = roomId; p2.socket.data.player = p2;
      waiting = null;
      p1.socket.emit('matched', { budOptions: shuffle(BUDS).slice(0, 3) });
      p2.socket.emit('matched', { budOptions: shuffle(BUDS).slice(0, 3) });
    } else {
      waiting = socket;
      socket.emit('waiting');
    }
  });

  socket.on('selectBud', ({ budId }) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || !player) return;
    const bud = BUDS.find(b => b.id === budId);
    if (!bud) return;
    player.bud = bud;
    player.phase = 'playing';
    pushState(room);
  });

  socket.on('place', ({ pieceIdx, row, col }) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || !player || player.phase !== 'playing' || room.over) return;
    if (Date.now() < player.frozenUntil) return; // frozen by a steal
    if (placePiece(player, pieceIdx, row, col)) {
      // If, after this move, the player is still mid-round but can't place any
      // remaining piece anywhere, they're stuck — end the game.
      if (player.phase === 'playing' && !hasAnyMove(player) && !room.over) {
        const opp = opponent(room, player);
        room.over = {
          winnerBud: opp ? opp.bud : null,
          coins: opp ? opp.coins : 0,
          reason: `${player.bud.name} has no moves left! 🪨`,
        };
        room.players.forEach(p => { p.phase = 'done'; });
      }
      pushState(room);
    }
  });

  socket.on('chooseBox', ({ boxIdx }) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || !player || player.phase !== 'boxes' || !player.pendingBoxes) return;
    applyReward(room, player, boxIdx);
    if (player.pendingSteal) pushState(room); // show steal guessing UI
  });

  socket.on('guessBud', ({ budId }) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || !player || !player.pendingSteal) return;
    resolveSteal(room, player, budId);
  });

  socket.on('disconnect', () => {
    if (waiting === socket) waiting = null;
    const room = rooms.get(socket.data.room);
    if (room && !room.over) {
      room.over = { winnerBud: null, coins: 0, reason: 'opponent left' };
      room.players.forEach(p => {
        p.phase = 'done';
        if (p.socket !== socket && p.socket.connected) p.socket.emit('opponentLeft');
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🦕 Prehistoric Bud running at http://localhost:${PORT}`));
