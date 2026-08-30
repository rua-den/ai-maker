import { test, expect } from '@playwright/test';

test('Tetris starts and mobile gestures work without runtime errors', async ({ page }) => {
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

  await expect(page.locator('#startBtn')).toBeVisible();
  await expect(page.locator('#touchControls')).toBeHidden();
  await expect(page.locator('#soundBtn')).toBeVisible();

  await page.locator('#nameInput').fill('Test');
  await page.locator('#startBtn').click();
  await expect(page.locator('#overlay')).toBeHidden();

  const beforeTap = await page.evaluate(() => ({ state, rot: current.rot, x: current.x, score }));
  expect(beforeTap.state).toBe('playing');

  await page.locator('canvas').evaluate(canvas => {
    const r = canvas.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 101, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, buttons: 1
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 101, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, buttons: 0
    }));
  });

  await expect.poll(() => page.evaluate(() => current.rot)).not.toBe(beforeTap.rot);

  const beforeSwipe = await page.evaluate(() => current.x);
  await page.locator('canvas').evaluate(canvas => {
    const r = canvas.getBoundingClientRect();
    const sx = r.left + r.width / 2;
    const sy = r.top + r.height / 2;
    const ex = sx + 62;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 102, pointerType: 'touch', isPrimary: true,
      clientX: sx, clientY: sy, buttons: 1
    }));
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 102, pointerType: 'touch', isPrimary: true,
      clientX: ex, clientY: sy, buttons: 1
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 102, pointerType: 'touch', isPrimary: true,
      clientX: ex, clientY: sy, buttons: 0
    }));
  });
  await expect.poll(() => page.evaluate(() => current.x)).toBeGreaterThan(beforeSwipe);

  const scoreBeforeDrop = await page.evaluate(() => score);
  await page.locator('canvas').evaluate(async canvas => {
    const r = canvas.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const sy = r.top + r.height * .35;
    const ey = sy + 110;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 103, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: sy, buttons: 1
    }));
    await new Promise(resolve => setTimeout(resolve, 80));
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 103, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: ey, buttons: 1
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 103, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: ey, buttons: 0
    }));
  });
  await expect.poll(() => page.evaluate(() => score)).toBeGreaterThan(scoreBeforeDrop);

  expect(pageErrors).toEqual([]);
});
