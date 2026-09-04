import { test, expect } from '@playwright/test';

test('Three Kingdoms opens in Online lobby and keeps local play one tap away', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/games/three-kingdoms-xiangqi.html');
  await expect(page.locator('#setupModal')).toHaveClass(/show/);
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#tkOnlineTab')).toHaveClass(/active/);
  await expect(page.locator('#tkCreateRoom')).toBeVisible();
  await expect(page.locator('#tkRooms')).toBeVisible();
  await expect(page.locator('#tkLocalSetup')).toBeHidden();

  await page.click('#tkLocalTab');
  await expect(page.locator('#tkLocalTab')).toHaveClass(/active/);
  await expect(page.locator('#tkLocalSetup')).toBeVisible();
  await expect(page.locator('#tkOnlinePanel')).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test('Three Kingdoms Xiangqi starts locally as two humans plus one bot without browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/games/three-kingdoms-xiangqi.html');
  await page.click('#tkLocalTab');
  await page.selectOption('#seat0', 'human');
  await page.selectOption('#seat1', 'human');
  await page.selectOption('#seat2', 'bot');
  await page.selectOption('#botDifficulty', 'easy');
  await page.click('#startBtn');

  await expect(page.locator('#setupModal')).not.toHaveClass(/show/);
  await expect(page.locator('#turnMain')).toContainText('Thục');

  const stateCheck = await page.evaluate(() => {
    const R = window.ThreeKingdomsXiangqi;
    const B = window.ThreeKingdomsBot;
    const state = R.initialState(true);
    state.turn = 2;
    const legal = R.legalMoves(state, 2);
    const botMove = B.choose(state, 2, 'easy');
    return {
      pieces: state.pieces.length,
      legalCount: legal.length,
      botLegal: !!botMove && legal.some(move => move.pieceId === botMove.pieceId && move.to === botMove.to),
      canvas: {
        width: document.getElementById('board').width,
        height: document.getElementById('board').height
      }
    };
  });

  expect(stateCheck.pieces).toBe(54);
  expect(stateCheck.legalCount).toBeGreaterThan(0);
  expect(stateCheck.botLegal).toBe(true);
  expect(stateCheck.canvas.width).toBeGreaterThan(300);
  expect(stateCheck.canvas.height).toBeGreaterThan(600);
  expect(pageErrors).toEqual([]);
});

test('Three Kingdoms Xiangqi can run local bot versus bot and advances the game', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/games/three-kingdoms-xiangqi.html');
  await page.click('#tkLocalTab');
  await page.selectOption('#seat0', 'bot');
  await page.selectOption('#seat1', 'bot');
  await page.selectOption('#seat2', 'bot');
  await page.selectOption('#botDifficulty', 'easy');
  await page.click('#startBtn');

  await expect.poll(async () => page.evaluate(() => {
    const text = document.getElementById('turnEvent')?.textContent || '';
    return /BOT đang đọc thế trận|tới lượt|bị chiếu|thu phục/i.test(text);
  }), { timeout: 5000 }).toBe(true);

  await page.waitForTimeout(1500);
  const status = await page.locator('#turnMain').textContent();
  expect(status).toMatch(/Thục|Ngụy|Ngô/);
  expect(pageErrors).toEqual([]);
});
