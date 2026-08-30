import { test, expect } from '@playwright/test';

const sharedMusicGames = [
  '/games/flappy-dog.html',
  '/games/2048.html',
  '/games/caro.html',
  '/games/xiangqi.html'
];

for (const gamePath of sharedMusicGames) {
  test(`shared music control loads on ${gamePath}`, async ({ page }) => {
    await page.route('https://www.gstatic.com/firebasejs/**', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    );

    await page.goto(gamePath);
    await expect(page.locator('#globalMusicBtn')).toBeVisible();
    await expect(page.locator('#globalMusicBtn')).toHaveText('🎵');
    await page.locator('#globalMusicBtn').click();
    await expect(page.locator('#globalMusicBtn')).toHaveText('🔇');
  });
}

test('Tetris uses its dedicated audio control instead of shared music button', async ({ page }) => {
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
  await expect(page.locator('#soundBtn')).toBeVisible();
  await expect(page.locator('#globalMusicBtn')).toHaveCount(0);
});
