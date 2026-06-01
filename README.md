# 🦕 Prehistoric Bud

> An online, real-time **multiplayer block-puzzle** game from the dawn of time.

**▶️ Play live:** **[prehistoric-bud.onrender.com](https://prehistoric-bud.onrender.com)**
*(Free host — the first load after a quiet spell takes ~30–60s to wake up.)*

Pick your magical flower **bud**, drop blocks on a 10×10 grid, clear lines to drain your target, then crack open mystery boxes — and if you land a **Steal**, guess your rival's bud to rob half their coins and freeze them solid. You've got **2 minutes** — whoever has the **most coins** when the clock runs out wins.

---

## 🎮 How to play

It's a **2-player** game — open the link in two browsers (or share it with a friend) and both click **Find a Match** to get paired.

1. **Select a Bud** — choose 1 of 3 magical flowers. Your opponent *can't see which one you picked*. 🤫
2. **Place blocks** — the system hands you 4-cell blocks, each holding **2–4 gems** 💎. Drag a piece from your tray onto your board; it snaps to the grid where you let go.
3. **Combo!** — fill a whole **row or column** to clear it. The gems on the cleared blocks are **subtracted from your target**. Chain multiple lines at once for bigger combos.
4. **Mystery boxes** — reach the target and pick **1 of 4 boxes**:
   | Reward | Effect |
   |--------|--------|
   | 🟢 `+55` / `+95 coins` | Flat coin bonus |
   | 🔵 `DOUBLE` / `TRIPLE COINS` | Multiply your coins |
   | 🟣 `STEAL COINS` | Guess the opponent's bud → steal half their coins **+ freeze them 15s** |
   | 🔴 `NOTHING! −15 coins` | Womp womp |
5. **Win** — when the **2-minute timer** runs out, the bud with the **most coins** takes the prize. Run out of room to place pieces and the match ends early. 🏆

---

## 🛠️ Tech stack

- **Frontend:** vanilla HTML5 Canvas + JavaScript (no build step)
- **Backend:** Node.js + Express + **Socket.IO** for real-time multiplayer
- **Server-authoritative:** the server owns all game state (grids, combos, coins, steals) so the game can't be cheated from the client
- **Hosting:** [Render](https://render.com) free web service, auto-deploying from `main`

## 🚀 Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone git@github.com:PETERDMYAN/prenistoric-bud.git
cd prenistoric-bud
npm install
npm start
```

Then open **http://localhost:3000** in two browser tabs and click **Find a Match**.

## ☁️ Deploy your own

This repo ships a [`render.yaml`](render.yaml) blueprint:

1. Fork/clone the repo to your GitHub account.
2. On [Render](https://dashboard.render.com) → **New +** → **Blueprint** → connect the repo → **Apply**.
3. Render runs `npm install` / `npm start` and gives you a public URL. Every `git push` to `main` redeploys automatically.

## 📁 Project structure

```
prenistoric-bud/
├── server.js          # Authoritative Socket.IO server — matchmaking, grids, combos, rewards, steals
├── public/
│   ├── index.html     # All screens: lobby → bud select → game → boxes → steal → game over
│   ├── game.js        # Canvas rendering + input; talks to the server
│   └── style.css      # Prehistoric theme
├── render.yaml        # Render deploy blueprint
└── package.json
```

---

Built with 🦴 and [Claude Code](https://claude.com/claude-code).
