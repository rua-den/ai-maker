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

test('Three Kingdoms Online supports two real players plus a host-added bot in Firebase', async ({ browser }) => {
  const contextOptions = {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    hasTouch: true
  };
  const hostContext = await browser.newContext(contextOptions);
  const guestContext = await browser.newContext(contextOptions);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const hostErrors = [];
  const guestErrors = [];
  host.on('pageerror', error => hostErrors.push(error.message));
  guest.on('pageerror', error => guestErrors.push(error.message));
  let createdRoomId = null;

  try {
    await host.goto('/games/three-kingdoms-xiangqi.html');
    await expect.poll(() => host.evaluate(() => !!window.firebase && !!window.ThreeKingdomsOnline), { timeout: 12000 }).toBe(true);

    const stamp = Date.now().toString(36).slice(-6);
    await host.fill('#tkOnlineName', 'Host-' + stamp);
    await host.selectOption('#tkCreateSeat', '0');
    await host.click('#tkCreateRoom');
    await expect(host.locator('#tkRoomDetail')).toHaveClass(/show/, { timeout: 12000 });

    createdRoomId = await host.evaluate(() => window.ThreeKingdomsOnline?.roomId || null);
    expect(createdRoomId).toBeTruthy();
    const shareUrl = await host.evaluate(() => window.ThreeKingdomsOnline.roomShareUrl(window.ThreeKingdomsOnline.roomId));
    expect(shareUrl).toContain('room=');

    await guest.goto(shareUrl);
    await expect.poll(() => guest.evaluate(() => !!window.firebase && !!window.ThreeKingdomsOnline), { timeout: 12000 }).toBe(true);
    await expect(guest.locator('#tkCreateRoom')).toContainText('VÀO PHÒNG ĐƯỢC MỜI');
    await guest.fill('#tkOnlineName', 'Guest-' + stamp);
    await guest.click('#tkCreateRoom');
    await expect(guest.locator('#tkRoomDetail')).toHaveClass(/show/, { timeout: 12000 });

    // Host owns Shu. Guest explicitly takes Wei.
    const weiSeat = guest.locator('.tkOnlineSeat').nth(1);
    await expect(weiSeat).toContainText('Ngụy');
    await weiSeat.getByRole('button', { name: 'Ngồi ghế' }).click();
    await expect(weiSeat).toContainText('Ghế của bạn', { timeout: 8000 });

    // Only Wu remains open, so host fills that third seat with a BOT.
    await expect(host.locator('.tkSeatBtn.bot', { hasText: '+ BOT' })).toHaveCount(1, { timeout: 8000 });
    await host.locator('.tkSeatBtn.bot', { hasText: '+ BOT' }).click();
    await expect(host.locator('#tkStartRoom')).toBeEnabled({ timeout: 8000 });
    await expect(host.locator('#tkRoomStatus')).toContainText('Đủ 3 ghế');

    await host.click('#tkStartRoom');
    await expect(host.locator('#setupModal')).not.toHaveClass(/show/, { timeout: 10000 });
    await expect(guest.locator('#setupModal')).not.toHaveClass(/show/, { timeout: 10000 });
    await expect(host.locator('#tkOnlineBadge')).toBeVisible();
    await expect(guest.locator('#tkOnlineBadge')).toBeVisible();
    await expect(host.locator('#turnMain')).toContainText('Thục');
    await expect(guest.locator('#turnMain')).toContainText('Thục');

    expect(hostErrors).toEqual([]);
    expect(guestErrors).toEqual([]);
  } finally {
    if (createdRoomId) {
      await host.evaluate(async id => {
        if (!window.firebase) return;
        await window.firebase.database().ref('xiangqiRooms/threeKingdoms').child(id).remove();
      }, createdRoomId).catch(() => {});
    }
    await guestContext.close();
    await hostContext.close();
  }
});
