import { test, expect } from '@playwright/test';

test('Go board supports free placement, pan and zoom without legal-dot guidance', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.route('https://www.gstatic.com/firebasejs/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.firebase = window.firebase || { apps: [], initializeApp(){ this.apps.push({}); } };'
    })
  );
  await page.route('**/firebase-config.js', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'const firebaseConfig = { databaseURL: "stub" };'
    })
  );
  await page.route('**/realtime-room.js', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.RuaRealtime = {
          boot(config) {
            const room = {
              status: 'playing', turn: 'A', winner: null,
              players: { A: { name: 'Đen' }, B: { name: 'Trắng' } },
              state: config.initialState()
            };
            const show = () => {
              document.getElementById('lobby').style.display = 'none';
              document.getElementById('game').classList.add('show');
              config.render(room, 'A', api);
            };
            const api = {
              async move(move) {
                const result = config.applyMove(room.state, move, 'A', room);
                if (!result) return false;
                room.state = result.state;
                room.turn = result.nextTurn || 'A';
                if (result.winner) { room.status = 'finished'; room.winner = result.winner; }
                show();
                return true;
              }
            };
            setTimeout(show, 0);
            return api;
          }
        };
      `
    })
  );

  await page.goto('/games/go.html');
  await expect(page.locator('#boardViewport')).toBeVisible();
  await expect(page.locator('#zoomIn')).toBeVisible();
  await expect(page.locator('#helpBtn')).toBeVisible();
  await expect(page.locator('.legal')).toHaveCount(0);

  await expect.poll(() => page.locator('#stones circle.stone').count()).toBe(0);
  await page.locator('#boardViewport').evaluate(viewport => {
    const r = viewport.getBoundingClientRect();
    const x = r.left + panX + (PAD + 9 * STEP) * scale;
    const y = r.top + panY + (PAD + 9 * STEP) * scale;
    viewport.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 501, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, buttons: 1
    }));
    viewport.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 501, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, buttons: 0
    }));
  });
  await expect.poll(() => page.locator('#stones circle.stone').count()).toBe(1);

  const beforeZoom = await page.evaluate(() => scale);
  await page.locator('#zoomIn').click();
  await expect.poll(() => page.evaluate(() => scale)).toBeGreaterThan(beforeZoom);

  await page.locator('#zoomIn').click();
  const beforePan = await page.evaluate(() => ({ x: panX, y: panY }));
  await page.locator('#boardViewport').evaluate(viewport => {
    const r = viewport.getBoundingClientRect();
    const sx = r.left + r.width / 2;
    const sy = r.top + r.height / 2;
    viewport.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 502, pointerType: 'touch', isPrimary: true,
      clientX: sx, clientY: sy, buttons: 1
    }));
    viewport.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 502, pointerType: 'touch', isPrimary: true,
      clientX: sx + 55, clientY: sy + 35, buttons: 1
    }));
    viewport.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 502, pointerType: 'touch', isPrimary: true,
      clientX: sx + 55, clientY: sy + 35, buttons: 0
    }));
  });
  await expect.poll(() => page.evaluate(({ x, y }) => panX !== x || panY !== y, beforePan)).toBe(true);

  expect(pageErrors).toEqual([]);
});
