# 🐢 Rùa — Game Portfolio

Trang web game cá nhân, chơi trực tiếp trên trình duyệt, không cần cài đặt gì.

## 📁 Cấu trúc project

```
rua-games/
├── index.html            ← Trang chủ "Welcome to Rùa"
├── firebase-config.js    ← Config Firebase DÙNG CHUNG cho mọi game (điền 1 lần)
├── README.md
└── games/
    ├── flappy-dog.html   ← Flappy Dog (có bảng xếp hạng)
    ├── tetris.html       ← Xếp Gạch / Tetris (có bảng xếp hạng)
    └── xiangqi.html      ← Cờ Tướng (2 người / vs Bot — chưa có bảng xếp hạng)
```

Toàn bộ là **static site** (HTML/CSS/JS thuần) — không cần Node, không cần build,
push thẳng lên GitHub Pages / Netlify / Vercel là chạy.

---

## 🔥 Bước 1 — Bật bảng xếp hạng chung (Firebase, free)

Nếu không làm bước này, mỗi game vẫn chơi được bình thường, nhưng điểm chỉ lưu
theo từng trình duyệt (không share được giữa mọi người chơi).

1. Vào **https://console.firebase.google.com** → tạo project mới (miễn phí).
2. Trong project: **Build → Realtime Database → Create Database** → chọn
   **Start in test mode** (để chạy thử trước, siết bảo mật sau nếu cần).
3. **⚙ Project settings** → cuộn xuống **Your apps** → bấm icon Web `</>` →
   copy đoạn `firebaseConfig` nó đưa ra.
4. Mở file **`firebase-config.js`** ở thư mục gốc, dán giá trị thật vào:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
};
```

5. Xong — **mọi game trên site đều tự dùng chung config này**, mỗi game có
   bảng xếp hạng riêng (namespaced theo `GAME_ID` trong từng file, không lẫn
   điểm giữa các game).

> Muốn thêm game mới sau này? Copy 1 file trong `games/`, đổi biến `GAME_ID`
> trong file đó (vd: `'flappy-dog'` → `'game-moi'`), thêm card link trong
> `index.html` — không cần tạo Firebase project mới.

---

## 🚀 Bước 2 — Đưa lên GitHub Pages

```bash
# 1) Tạo repo mới trên GitHub (vd tên: rua-games), rồi:
cd rua-games
git init
git add .
git commit -m "Rùa game portfolio"
git branch -M main
git remote add origin https://github.com/<username>/rua-games.git
git push -u origin main
```

Sau đó trên GitHub:
1. Vào repo → **Settings → Pages**
2. **Source**: chọn **Deploy from a branch**
3. **Branch**: chọn `main`, thư mục `/ (root)` → **Save**
4. Đợi ~1 phút, trang sẽ live tại:
   `https://<username>.github.io/rua-games/`

Xong — trang chủ sẽ ở `index.html`, các game nằm trong `games/`.

---

## 🎮 Ghi chú từng game

- **Flappy Dog** — click/chạm/Space để bay. Bắt buộc nhập tên trước khi chơi.
- **Xếp Gạch** — phím mũi tên di chuyển/xoay, Space thả nhanh, P tạm dừng. Có nút chạm cho mobile.
- **Cờ Tướng** — chọn 2 người (cùng máy) hoặc đấu Bot (chọn phe + độ khó). Đã có đủ luật (chiếu tướng, mặt tướng, pháo cần ngòi, mã cản chân, tượng không qua sông...). *Bảng xếp hạng cho game này để làm sau.*

Cả 3 game đều: full màn hình, tự scale theo cửa sổ, có nút 🐢 quay về trang chủ và nút ⛶ fullscreen ở mỗi game.
