# 🐢 Rùa — Game Portfolio

Browser game portfolio built mainly with plain HTML, CSS and JavaScript, deployed on GitHub Pages.

## 🎮 Games

Current portfolio:

- Flappy Dog
- Tetris
- 2048
- Xiangqi
- Three Kingdoms Xiangqi
- Caro
- Connect Four
- Tic Tac Toe
- Go
- Reversi
- Nine Men's Morris
- **Bùm Chíu** — BOT-first team FPS

## 💥 Bùm Chíu — Current Status

**Primary mode:** BOT-only / offline-style gameplay on GitHub Pages.

`games/boom-chiu.html`

Current playable milestone:

- 5v5 Team Deathmatch: player + 4 blue BOTs vs 5 red BOTs.
- 3 original maps: **Cát Cháy**, **Chợ Đêm**, **Phố Cổ**.
- BOT difficulty: Vừa / Khó / Hủy diệt.
- Rùa-47 rifle: ammo, reload, recoil, spread, hitmarker, kill feed and respawn.
- Styloo CC0 AK-based first-person weapon asset.
- Weapon viewmodel is rendered from the lower-right with muzzle-aligned tracer/VFX.
- Quaternius Toon Shooter CC0 soldier assets rendered into 8 directional BOT sprites.
- BOT sprites use a feet/ground anchor instead of floating around the horizon.
- Full mouse look: yaw + pitch (left/right and up/down).
- Jump: `Space`.
- Crouch: `C` or `Ctrl`.
- Mobile controls include move, look, fire, reload, jump and crouch.
- Runtime remains lightweight raycast/canvas; 3D models are pre-rendered to PNG sprites rather than loaded as a 3D engine during gameplay.

### Bùm Chíu networking

`games/boom-chiu-pvp.html` remains an **experimental PvP mode**.

The authoritative WebSocket server is kept in:

`server/boom-chiu-server.js`

It supports room-based 5v5 play with server BOT fill and is covered by integration/E2E tests. Public hosted PvP is **not the current main path**. The preferred next deployment target is a user-controlled VPS close to players; the existing Node/WebSocket server can be deployed there later.

Render/Railway config files are retained only as deployment experiments/references.

## ✅ Latest verified Bùm Chíu checkpoint

Verified checkpoint before this documentation update:

- Code HEAD: `9a8e2efbcb9f6e5edc11f8ab107ce87ddb810504`
- GitHub Actions **Tests #241**: success.
- GitHub Pages **#278**: success.
- Browser coverage verifies weapon rendering, 8 directional BOT sprites, grounded BOT placement, muzzle/tracer alignment, vertical mouse look, jump, crouch, BOT movement/kills and all 3 maps.

## 🧭 Bùm Chíu next priorities

1. Continue polishing the first-person weapon pose/scale until it feels natural in live play.
2. Improve BOT presentation and animation feel while keeping sprite-based performance.
3. Improve shooting feedback: wall impact, muzzle flash, hit/death feedback and sound mix.
4. Tune movement/camera feel after live testing of pitch, jump and crouch.
5. Return to PvP only after the BOT build feels good; deploy the WebSocket server to the user's VPS instead of making the public hosted server a dependency for the main game.

## 📁 Relevant structure

```text
ai-maker/
├── index.html
├── firebase-config.js
├── games/
│   ├── boom-chiu.html
│   ├── boom-chiu.js
│   ├── boom-chiu-core.js
│   ├── boom-chiu-art.js
│   ├── boom-chiu-vfx.js
│   ├── boom-chiu-pvp.html
│   └── boom-chiu-pvp.js
├── server/
│   └── boom-chiu-server.js
├── assets/
│   └── boom-chiu/
│       ├── styloo/
│       ├── quaternius/
│       └── kenney/
├── tests/
│   └── e2e/
├── package.json
└── README.md
```

## 🧪 Tests

The playable site is static, but the repository uses Node.js tooling for automated tests and the optional Bùm Chíu WebSocket server.

```bash
npm install
npm test
```

The test suite includes unit tests, browser E2E tests and a real WebSocket integration test for Bùm Chíu PvP.

## 🔥 Firebase

Firebase Realtime Database is shared by games that need online rooms, presence, chat or shared game data. Static/offline games can run without it.

Configuration lives in:

`firebase-config.js`

Database rules live in:

`database.rules.json`

## 🚀 Deployment

The main website is deployed as a static GitHub Pages site from `main`.

Bùm Chíu BOT-only requires no game server.

Bùm Chíu PvP requires a persistent Node.js/WebSocket server. For future public PvP, deploy `server/boom-chiu-server.js` to the chosen VPS and point the PvP client at its `ws://` / `wss://` endpoint.

## 🎨 Third-party assets

Bùm Chíu currently uses free/CC0 assets, with provenance recorded under:

`assets/boom-chiu/THIRD_PARTY.md`

Main sources currently include:

- Kenney UI assets — CC0.
- Styloo Guns Asset Pack — CC0.
- Quaternius Toon Shooter Game Kit — CC0.
