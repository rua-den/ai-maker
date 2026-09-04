import { test, expect } from '@playwright/test';

test('Bùm Chíu starts a 5v5 bot match and renders the mobile FPS HUD', async ({ page }) => {
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/games/boom-chiu.html');

  await expect(page.getByRole('heading',{name:'BÙM CHÍU'})).toBeVisible();
  await expect(page.locator('.mapCard')).toHaveCount(3);
  await expect(page.locator('#startBtn')).toContainText('5v5');

  await page.evaluate(()=>window.BoomChiuGame.start({map:'cat_chay',difficulty:'easy',target:20}));
  await expect(page.locator('#menu')).toHaveClass(/hidden/);
  await expect(page.locator('#touchUI')).toHaveClass(/playing/);

  const initial=await page.evaluate(()=>window.BoomChiuGame.getState());
  expect(initial.running).toBe(true);
  expect(initial.actors).toHaveLength(10);
  expect(initial.actors.filter(a=>a.team==='blue')).toHaveLength(5);
  expect(initial.actors.filter(a=>a.team==='red')).toHaveLength(5);
  expect(initial.player.clip).toBe(30);

  const before=new Map(initial.actors.filter(a=>!a.isPlayer).map(a=>[a.id,{x:a.x,y:a.y}]));
  await page.waitForTimeout(1800);
  const later=await page.evaluate(()=>window.BoomChiuGame.getState());
  const moved=later.actors.filter(a=>!a.isPlayer).some(a=>{
    const p=before.get(a.id);return p&&Math.hypot(a.x-p.x,a.y-p.y)>.08;
  });
  expect(moved).toBe(true);

  await expect(page.locator('#blueScore')).toHaveText(/\d+/);
  await expect(page.locator('#redScore')).toHaveText(/\d+/);
  await expect(page.locator('#ammo')).toContainText('30 / 90');
  const canvas=await page.locator('#game').evaluate(el=>({w:el.width,h:el.height}));
  expect(canvas.w).toBeGreaterThan(300);
  expect(canvas.h).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test('Bùm Chíu can switch to every original map without browser errors', async ({ page }) => {
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/games/boom-chiu.html');
  for(const map of ['cat_chay','cho_dem','pho_co']){
    await page.evaluate(id=>window.BoomChiuGame.start({map:id,difficulty:'easy',target:20}),map);
    const state=await page.evaluate(()=>window.BoomChiuGame.getState());
    expect(state.mapId).toBe(map);
    expect(state.actors).toHaveLength(10);
    await page.evaluate(()=>window.BoomChiuGame.end());
    await page.waitForTimeout(80);
  }
  expect(errors).toEqual([]);
});
