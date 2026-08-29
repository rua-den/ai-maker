# 🐢 Rùa — Game Portfolio

A personal game portfolio where you can play directly in your browser — no installation required.

## 📁 Project Structure

```
rua-games/
├── index.html            ← Homepage: "Welcome to Rùa"
├── firebase-config.js    ← Shared Firebase config for all games (configure once)
├── README.md
└── games/
    ├── flappy-dog.html   ← Flappy Dog (with leaderboard)
    ├── tetris.html       ← Tetris (with leaderboard)
    └── xiangqi.html      ← Chinese Chess (2 players / vs Bot — no leaderboard yet)
```

The entire project is a **static site** built with plain HTML, CSS, and JavaScript — no Node.js and no build step required. You can deploy it directly to GitHub Pages, Netlify, or Vercel.

---

## 🔥 Step 1 — Enable Shared Leaderboards with Firebase (Free)

This step is optional. Without Firebase, every game will still work normally, but scores will only be stored locally in each player's browser and will not be shared across players.

1. Go to the **Firebase Console** at `https://console.firebase.google.com` and create a new project (free).
2. Inside the project, go to **Build → Realtime Database → Create Database**, then select **Start in test mode** for initial testing. You can tighten the security rules later.
3. Go to **⚙ Project settings**, scroll down to **Your apps**, click the Web `</>` icon, and copy the generated `firebaseConfig` values.
4. Open **`firebase-config.js`** in the project root and replace the placeholder values with your actual Firebase configuration:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
};
```

5. That's it — **all games on the site automatically share this Firebase configuration**. Each game has its own leaderboard namespace based on the `GAME_ID` defined in that game's file, so scores from different games do not get mixed together.

> Want to add another game later? Copy one of the files in `games/`, change its `GAME_ID` (for example, `'flappy-dog'` → `'new-game'`), and add a card/link to `index.html`. You do not need to create another Firebase project.

---

## 🚀 Step 2 — Deploy to GitHub Pages

```bash
# 1) Create a new GitHub repository (for example: rua-games), then:
cd rua-games
git init
git add .
git commit -m "Rùa game portfolio"
git branch -M main
git remote add origin https://github.com/<username>/rua-games.git
git push -u origin main
```

Then, on GitHub:

1. Open the repository and go to **Settings → Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Select the `main` branch and `/ (root)` folder, then click **Save**.
4. Wait about a minute. The site should become available at:
   `https://<username>.github.io/rua-games/`

The homepage is served from `index.html`, and individual games are located in the `games/` directory.

---

## 🎮 Game Notes

- **Flappy Dog** — Click, tap, or press Space to fly. A player name is required before starting.
- **Tetris** — Use the arrow keys to move and rotate pieces, Space for hard drop, and P to pause. Touch controls are included for mobile devices.
- **Chinese Chess (Xiangqi)** — Play locally with two players or against the bot, with side and difficulty selection. Core rules are implemented, including check, flying general, cannon screens, blocked horse legs, and elephants not crossing the river. *Leaderboard support for this game is planned for later.*

All three games support full-screen layouts, automatically scale to the browser window, and include a 🐢 button to return to the homepage plus a ⛶ fullscreen button.