import { test, expect } from '@playwright/test';

test('Go Hủy Diệt loads lazily and replies from its worker when neural is unavailable', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => { window.GO_AI_DISABLE_NEURAL = true; });

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
      body: `window.RuaRealtime = { boot(){ return { async move(){ return false; } }; } };`
    })
  );

  await page.goto('/games/go.html');
  await expect(page.locator('[data-mode="bot"]')).toBeVisible();
  await page.locator('[data-mode="bot"]').click();

  await expect.poll(() => page.locator('#botDifficulty option[value="5"]').count()).toBe(1);
  await expect.poll(() => page.evaluate(() => typeof window.GoAI?.choose)).toBe('function');
  await page.locator('#botDifficulty').selectOption('5');
  await expect(page.locator('#botDifficulty')).toHaveValue('5');
  await page.locator('#botStart').click();

  await expect(page.locator('#boardViewport')).toBeVisible();
  await expect.poll(() => page.evaluate(() => botTurn)).toBe('A');

  const played = await page.evaluate(() => botPlayerMove({ idx: 72 }));
  expect(played).toBe(true);
  await expect.poll(() => page.evaluate(() => botThinking)).toBe(true);
  await expect.poll(() => page.evaluate(() => botTurn), { timeout: 8000 }).toBe('A');
  await expect.poll(() => page.locator('#stones circle.stone').count(), { timeout: 8000 }).toBe(2);

  const status = await page.locator('#roomCode').textContent();
  expect(status).toContain('Hủy Diệt');
  await expect(page.locator('#resultNote')).toContainText('☠️ đọc');
  expect(pageErrors).toEqual([]);
});
