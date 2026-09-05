import { test, expect } from '@playwright/test';

test('Bùm Chíu bot-only renders Styloo weapon, Quaternius bots and muzzle-aligned tracer on mobile', async ({ page }) => {
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/boom-chiu.html');

  await expect(page.getByRole('heading',{name:'💥 BÙM CHÍU'})).toBeVisible();
  await expect(page.locator('.mapCard')).toHaveCount(3);
  await expect(page.locator('#startBtn')).toContainText('BOT 5v5');
  await expect(page.locator('.mode')).toContainText('KHÔNG CẦN SERVER');
  await expect(page.locator('#fireBtn')).toHaveCSS('background-image',/ui-button-red-round\.svg/);

  await expect.poll(()=>page.evaluate(()=>window.BoomChiuArt?.rifleLoaded),{timeout:5000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.BoomChiuArt?.soldiersLoaded),{timeout:5000}).toBe(8);

  await page.evaluate(()=>window.BoomChiuGame.start({map:'cat_chay',difficulty:'destroyer',target:20}));
  await expect(page.locator('#menu')).toHaveClass(/hidden/);
  await expect(page.locator('#touchUI')).toHaveClass(/playing/);

  const initial=await page.evaluate(()=>window.BoomChiuGame.getState());
  expect(initial.running).toBe(true);
  expect(initial.actors).toHaveLength(10);
  expect(initial.actors.filter(a=>a.team==='blue')).toHaveLength(5);
  expect(initial.actors.filter(a=>a.team==='red')).toHaveLength(5);
  expect(initial.player.clip).toBe(30);
  expect(initial.artReady).toBe(true);
  expect(initial.soldierSprites).toBe(8);

  const before=new Map(initial.actors.filter(a=>!a.isPlayer).map(a=>[a.id,{x:a.x,y:a.y}]));
  await page.waitForTimeout(1600);
  const later=await page.evaluate(()=>window.BoomChiuGame.getState());
  expect(later.actors.filter(a=>!a.isPlayer).some(a=>{const p=before.get(a.id);return p&&Math.hypot(a.x-p.x,a.y-p.y)>.08})).toBe(true);
  expect(later.renderedSpriteCount).toBeGreaterThan(0);
  expect(later.weaponSpriteFrames).toBeGreaterThan(0);

  const tracerBefore=await page.evaluate(()=>window.BoomChiuVfx?.tracerCount||0);
  await page.evaluate(()=>window.BoomChiuGame.fire());
  await expect.poll(()=>page.evaluate(()=>window.BoomChiuGame.getState().player.clip),{timeout:1500}).toBeLessThan(30);
  await expect.poll(()=>page.evaluate(()=>window.BoomChiuVfx?.tracerCount||0),{timeout:1500}).toBeGreaterThan(tracerBefore);
  await expect(page.locator('#boomFx')).toBeAttached();

  const trace=await page.evaluate(()=>({shot:window.BoomChiuVfx?.lastShot,state:window.BoomChiuGame.getState()}));
  expect(trace.shot).toBeTruthy();
  expect(Math.hypot(trace.shot.x1-trace.state.muzzle.x,trace.shot.y1-trace.state.muzzle.y)).toBeLessThan(12);
  expect(Math.abs(trace.shot.x2-195)).toBeLessThan(12);
  expect(Math.abs(trace.shot.y2-422)).toBeLessThan(12);
  // Muzzle is intentionally much closer to crosshair than the old bottom-right hard-coded tracer origin.
  expect(trace.state.muzzle.y).toBeLessThan(844*.7);

  await expect.poll(()=>page.evaluate(()=>window.BoomChiuVfx?.fps||0),{timeout:3000}).toBeGreaterThan(20);
  await expect.poll(()=>page.evaluate(()=>window.BoomChiuGame.getState().diagnosticBotKills),{timeout:9000,intervals:[500]}).toBeGreaterThan(0);

  const canvas=await page.locator('#game').evaluate(el=>({w:el.width,h:el.height}));
  expect(canvas.w).toBeGreaterThan(300);
  expect(canvas.h).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test('Bùm Chíu bot-only can switch to every original map without browser errors', async ({ page }) => {
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/games/boom-chiu.html');
  await expect.poll(()=>page.evaluate(()=>window.BoomChiuArt?.ready),{timeout:5000}).toBe(true);
  for(const map of ['cat_chay','cho_dem','pho_co']){
    await page.evaluate(id=>window.BoomChiuGame.start({map:id,difficulty:'easy',target:20}),map);
    await page.waitForTimeout(100);
    const state=await page.evaluate(()=>window.BoomChiuGame.getState());
    expect(state.mapId).toBe(map);
    expect(state.actors).toHaveLength(10);
    expect(state.weaponSpriteFrames).toBeGreaterThan(0);
    await page.evaluate(()=>window.BoomChiuGame.end());
    await page.waitForTimeout(80);
  }
  expect(errors).toEqual([]);
});
