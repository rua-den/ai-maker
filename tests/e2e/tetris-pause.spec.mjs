import { test, expect } from '@playwright/test';

test('Tetris pause button pauses and resumes the game', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.route('https://www.gstatic.com/firebasejs/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  );
  await page.route('**/firebase-config.js', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'const firebaseConfig = { apiKey: "YOUR_API_KEY" };'
    })
  );

  await page.goto('/games/tetris.html');

  const pauseBtn = page.locator('#pauseBtn');
  await expect(pauseBtn).toBeVisible();
  await expect(pauseBtn).toHaveText('⏸');

  await page.locator('#nameInput').fill('Pause Test');
  await page.locator('#startBtn').click();
  await expect.poll(() => page.evaluate(() => state)).toBe('playing');

  await pauseBtn.click();
  await expect.poll(() => page.evaluate(() => state)).toBe('paused');
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#titleText')).toContainText('TẠM DỪNG');
  await expect(pauseBtn).toHaveText('▶');

  await pauseBtn.click();
  await expect.poll(() => page.evaluate(() => state)).toBe('playing');
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(pauseBtn).toHaveText('⏸');

  expect(pageErrors).toEqual([]);
});
