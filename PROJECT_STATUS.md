# PROJECT STATUS / THREAD HANDOFF

> **Read this file first when continuing the project in a new ChatGPT thread.**
>
> Snapshot date: **2026-09-05**  
> Repository: `rua-den/ai-maker`  
> Source of truth: **GitHub `main`**

## 1. Current project direction

This repository is a browser game portfolio. The current active development focus is **Bùm Chíu**, a lightweight browser FPS.

The current product decision is:

- **Bùm Chíu BOT-only is the primary playable mode.**
- It must work directly from GitHub Pages without a game server.
- PvP remains available as an **experimental separate mode**.
- Public PvP should eventually run on the user's own VPS, preferably geographically close to players in Viet Nam / Southeast Asia.
- Do **not** make the main BOT build depend on Render, Firebase or another realtime backend.
- Assets should be **free / CC0 / free for commercial use**. Do not introduce paid asset packs.
- Do not copy Counter-Strike/Valve maps, names, textures or other proprietary assets. Original maps and original presentation only.

## 2. Portfolio status

Current games exposed by the portfolio:

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
- **Bùm Chíu**

Most older games are considered stable unless a new request specifically targets them. Automated tests cover the portfolio as well as the active Bùm Chíu work.

### Notable older-game checkpoints

- **Go**
  - Full 19x19 rules implementation.
  - Multiple bot levels including **Hủy Diệt**.
  - Hủy Diệt can use the vendored KataGo ONNX model through ONNX Runtime Web/WASM in-browser.
  - KataGo model/runtime checksums and encoder behavior are covered by tests.
- **Xiangqi**
  - Local/online play exists.
  - Clock/timeout fixes, explicit untimed mode, board centering, chat, room presence and spectator-related helpers are covered by tests.
- **Three Kingdoms Xiangqi**
  - Three-player variant with online lobby.
  - Three selectable seats and host BOT-fill support.
  - Room sharing and online seat ownership are covered by tests.
- **Caro / Connect Four / Tic Tac Toe / Reversi / Morris**
  - Shared realtime/bot infrastructure exists and has unit coverage.

## 3. Bùm Chíu — primary BOT build

Primary entry point:

`games/boom-chiu.html`

Main implementation files:

- `games/boom-chiu.js` — local gameplay, BOT AI integration, movement, camera, rendering orchestration.
- `games/boom-chiu-core.js` — maps, collision, DDA raycast, pathfinding and shared gameplay primitives.
- `games/boom-chiu-art.js` — pre-rendered weapon/BOT asset loading.
- `games/boom-chiu-vfx.js` — tracer/muzzle/impact-style overlay effects.

### Current gameplay

- 5v5 Team Deathmatch.
- Player + 4 blue BOTs vs 5 red BOTs.
- Continuous respawn.
- Score targets: 20 / 30 / 50.
- BOT difficulty: Vừa / Khó / Hủy diệt.
- Rùa-47 rifle:
  - 30-round magazine + 90 reserve.
  - reload.
  - recoil/spread.
  - hitmarker.
  - headshot logic.
  - kill feed.
- Three original maps:
  1. **Cát Cháy**
  2. **Chợ Đêm**
  3. **Phố Cổ**

### Current desktop controls

- `WASD` — movement.
- Mouse X — yaw / look left-right.
- Mouse Y — pitch / look up-down.
- Left click — fire.
- `R` — reload.
- `Space` — jump.
- `C` or `Ctrl` — crouch.

### Current mobile controls

- Left joystick — movement.
- Right look pad — horizontal + vertical look.
- Fire button.
- Reload button.
- Jump button.
- Crouch button.

## 4. Bùm Chíu renderer / movement architecture

The main BOT game deliberately stays lightweight:

- Canvas + raycast pseudo-3D runtime.
- No Three.js/GLTF runtime dependency in the playable BOT page.
- 3D source assets are pre-rendered into transparent PNGs before runtime.
- The runtime loads small image sprites and draws them into Canvas.

### Camera / movement state added in the latest milestone

Player state includes vertical-look and stance physics:

- `pitch`
- `z`
- `vz`
- `crouching`
- `crouchAmount`

The renderer shifts the horizon according to camera pitch and eye height. Firing also uses pitch in target selection rather than only visually moving the horizon.

Jump uses vertical velocity + gravity and crouch changes eye height/movement speed.

## 5. Weapon asset and first-person view

The current weapon source is **Styloo — Guns Asset Pack**, CC0.

Runtime sprite:

`assets/boom-chiu/styloo/ak47-fps.png`

The source 3D model is rendered offline/build-time into a transparent PNG.

Current weapon work includes:

- lower-right first-person viewmodel placement.
- idle sway/bob.
- recoil motion.
- reload motion.
- muzzle point exposed through `window.BoomChiuWeaponView.muzzle`.
- tracer spawned from the exact muzzle position used for the shot.
- tracer travels toward the screen crosshair instead of using the old hard-coded bottom-right origin.

### Important current UX note

The weapon pose has been reworked multiple times because the user specifically disliked the gun looking horizontally pasted across the screen and the tracer flying diagonally from a visually incorrect origin.

**Do not treat the current weapon pose as permanently approved.**

The next thread should visually test it first. If it still looks unnatural, keep focus on:

- weapon camera angle.
- scale.
- crop.
- lower-right anchor.
- exact visible muzzle location.
- ensuring the barrel visually points toward the crosshair.

Do not change engines just to solve the weapon pose.

## 6. BOT visual assets

The current BOT source is **Quaternius — Toon Shooter Game Kit**, CC0.

Runtime sprites:

`assets/boom-chiu/quaternius/soldier-0.png` through `soldier-7.png`

The latest render pipeline produces **8 genuinely different directional images**, approximately every 45 degrees.

A previous asset-render attempt accidentally produced identical images for all eight directions. That bug was detected and fixed by preserving the WebGL buffer and adding a uniqueness regression test. Do not remove that regression coverage.

### BOT grounding fix

The user reported BOT legs floating above the ground.

The latest pass:

- cropped source renders more tightly.
- uses a feet/ground anchor.
- projects the BOT bottom edge to the raycast floor/ground line.
- keeps a ground shadow under the BOT.

**Still visually review this in live play.** The technical grounding test is green, but the user may still ask for better character presentation/animation.

## 7. Asset pipeline / provenance

Asset rendering script:

`scripts/render-boom-chiu-assets.mjs`

Third-party provenance:

`assets/boom-chiu/THIRD_PARTY.md`

Current Bùm Chíu third-party sources:

- **Kenney UI Pack / Crosshair** — CC0.
- **Styloo Guns Asset Pack** — CC0.
- **Quaternius Toon Shooter Game Kit** — CC0.

There was a temporary GitHub Actions workflow with `contents: write` used only to render and commit the generated PNG assets. It was deleted after use. Normal CI remains read-only.

Do not reintroduce a persistent write-enabled workflow just for asset rendering.

## 8. Bùm Chíu PvP — experimental only

PvP entry point:

`games/boom-chiu-pvp.html`

Client:

`games/boom-chiu-pvp.js`

Server:

`server/boom-chiu-server.js`

Package command:

```bash
npm run start:boom-chiu-server
```

### PvP architecture already implemented

- Real WebSocket server using `ws`.
- Server-authoritative room state for core gameplay.
- 5v5 rooms.
- Human players replace BOT seats.
- Remaining seats are filled by server BOTs.
- Example: 2 humans => 2 humans + 8 server BOTs = 10 actors.
- Real integration test starts the server and connects two WebSocket clients.
- Browser E2E covers multiple browser contexts joining the same room.
- PvP client has work for prediction/interpolation/ping diagnostics from the earlier online iteration.

### Render history / current decision

A Render service was created at:

`https://boom-chiu-pvp.onrender.com`

and its HTTP health endpoint + public WebSocket room creation were successfully smoke-tested from GitHub Actions during development.

However, realtime gameplay felt very laggy from Viet Nam. One major reason identified was geographic latency: the original Render Blueprint did not specify a region and Render's default was not close to the user.

Files retained:

- `render.yaml`
- `render-singapore.yaml`
- `railway.json`

`render-singapore.yaml` was added as a Singapore deployment blueprint, but **do not assume a Singapore service was actually deployed unless verified**.

Current product decision:

- Stop spending time making the Render service the main experience.
- Keep PvP experimental.
- Later deploy the existing Node/WebSocket server to the user's VPS.
- Then measure latency and tune PvP there.

## 9. Tests / quality gates

Repository scripts:

```bash
npm install
npm test
```

`npm test` runs:

```text
npm run test:unit
npm run test:e2e
```

Unit tests use Node's built-in test runner. Browser tests use Playwright Chromium.

Important Bùm Chíu coverage includes:

- map validity/path connectivity.
- raycast/collision/LOS primitives.
- rifle contract.
- CC0 asset presence/provenance.
- real Styloo weapon sprite loading/rendering.
- all 8 Quaternius BOT images load.
- directional BOT images are distinct.
- BOT-only main entry remains server-independent.
- 10 actors / correct 5v5 split.
- BOT movement and BOT kills.
- muzzle/tracer alignment.
- grounded BOT projection.
- mouse pitch changes up/down.
- jump state.
- crouch state.
- mobile controls.
- all 3 maps start in-browser.
- PvP two-human WebSocket integration.

### Latest verified implementation checkpoint

The last implementation checkpoint before documentation-only commits:

- HEAD: `9a8e2efbcb9f6e5edc11f8ab107ce87ddb810504`
- GitHub Actions **Tests #241** — **SUCCESS**.
- GitHub Pages **#278** — **SUCCESS**.

Documentation was then refreshed in commit:

- `45414418ef7c085783ad6cdfc887400c09567438`

When starting a new thread, verify the latest `main` HEAD and latest Actions runs instead of assuming these historical IDs are still current.

## 10. Known issues / open visual work

Current open work is mostly **feel and presentation**, not missing basic functionality.

Priority issues:

1. **First-person weapon pose still needs live visual approval.**
   - User has repeatedly called out the gun angle.
   - The barrel and tracer must visually agree.
2. **BOT visual presentation still needs polish.**
   - Grounding has been technically fixed.
   - Character pose/animation may still feel odd.
3. **Pitch / jump / crouch need game-feel tuning.**
   - Input exists and tests pass.
   - Tune sensitivity, eye-height transitions, jump arc and landing feel from live play.
4. **Shooting feedback can improve.**
   - wall impact.
   - muzzle flash quality.
   - hit/death reaction.
   - sound mix.
5. **PvP should wait until BOT build feels good.**
   - Then deploy server on user VPS.

## 11. Recommended next milestones

### M1 — Weapon visual approval

Focus only on the first-person gun until it looks correct in actual browser play:

- inspect current `ak47-fps.png` composition.
- adjust source render camera/model orientation if needed.
- tune viewmodel scale/anchor.
- verify visible muzzle pixel vs tracer origin.
- keep performance unchanged.

### M2 — BOT presentation pass

- visually verify feet on ground at near/mid/far distances.
- improve directional sprite selection if transitions look strange.
- improve hit/death presentation.
- optionally add lightweight walk-state sprite variation, but keep runtime sprite-based.

### M3 — FPS feel pass

- mouse pitch sensitivity.
- crouch transition.
- jump arc + landing bump.
- weapon sway/recoil.
- wall impacts and audio.

### M4 — PvP on VPS

Only after M1-M3 are satisfactory:

- deploy `server/boom-chiu-server.js` to user VPS.
- use HTTPS/WSS behind the VPS/domain reverse proxy if public.
- point PvP client to the VPS endpoint.
- measure ping from Viet Nam.
- run two-browser live E2E/smoke.
- then tune server tick/snapshot/netcode if necessary.

## 12. Working rules for the next thread

When continuing this repository:

1. Use **GitHub `main` as the source of truth**.
2. Read this file and `README.md` first.
3. Fetch current files before editing; do not rely on old conversation snippets.
4. Make incremental commits to `main`.
5. Run/verify unit + Playwright tests before calling a milestone done.
6. Verify exact current Actions run ID + exact HEAD SHA before reporting CI green.
7. Do not confuse historical failed runs with current successful runs.
8. Keep Bùm Chíu BOT-only working without a server.
9. Keep assets free/CC0 unless the user explicitly changes that requirement.
10. Prefer practical browser-visible improvements over architectural rewrites.
11. Do not claim a public server/region/deployment exists unless it has actually been verified.

## 13. Quick file map

```text
ai-maker/
├── README.md
├── PROJECT_STATUS.md                <- READ FIRST IN A NEW THREAD
├── index.html
├── package.json
├── playwright.config.mjs
├── firebase-config.js
├── database.rules.json
├── games/
│   ├── boom-chiu.html               <- PRIMARY BÙM CHÍU MODE
│   ├── boom-chiu.js
│   ├── boom-chiu-core.js
│   ├── boom-chiu-art.js
│   ├── boom-chiu-vfx.js
│   ├── boom-chiu-pvp.html           <- EXPERIMENTAL
│   └── boom-chiu-pvp.js
├── server/
│   └── boom-chiu-server.js
├── assets/
│   └── boom-chiu/
│       ├── THIRD_PARTY.md
│       ├── kenney/
│       ├── styloo/
│       │   └── ak47-fps.png
│       └── quaternius/
│           └── soldier-0.png ... soldier-7.png
├── scripts/
│   └── render-boom-chiu-assets.mjs
├── tests/
│   ├── boom-chiu.test.mjs
│   ├── boom-chiu-pvp.test.mjs
│   └── e2e/
│       └── boom-chiu.spec.mjs
├── render.yaml
├── render-singapore.yaml
└── railway.json
```

---

**New-thread starting point:** verify `main`, read current `games/boom-chiu.js` + `games/boom-chiu-art.js` + `tests/e2e/boom-chiu.spec.mjs`, then continue with **M1 Weapon visual approval** unless the user changes priority.
