import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';

const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('Bùm Chíu PvP migrates stale localhost server settings to the public Render server',async({page})=>{
  await page.goto('/games/boom-chiu-pvp.html');
  await page.evaluate(()=>localStorage.setItem('boom-chiu-server','ws://localhost:8787'));
  await page.reload();
  await expect(page.locator('#server')).toHaveValue('wss://boom-chiu-pvp.onrender.com');
  await expect.poll(()=>page.evaluate(()=>window.BoomChiuPvP?.server)).toBe('wss://boom-chiu-pvp.onrender.com');
  expect(await page.evaluate(()=>localStorage.getItem('boom-chiu-server'))).toBeNull();
  await expect.poll(()=>page.locator('#crosshair').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
});

test('Bùm Chíu PvP uses local prediction while two browsers share one authoritative 5v5 room',async({browser})=>{
  const port=20500+Math.floor(Math.random()*500);
  const server=spawn(process.execPath,['server/boom-chiu-server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let ready=false;server.stdout.on('data',d=>{if(String(d).includes('listening'))ready=true});
  for(let i=0;i<60&&!ready;i++)await wait(50);
  expect(ready).toBe(true);
  const baseURL='http://127.0.0.1:4173',wsUrl=`ws://127.0.0.1:${port}`;
  const c1=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true});
  const c2=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true});
  const p1=await c1.newPage(),p2=await c2.newPage();
  const errors=[];p1.on('pageerror',e=>errors.push('p1:'+e.message));p2.on('pageerror',e=>errors.push('p2:'+e.message));
  try{
    await p1.goto(`/games/boom-chiu-pvp.html?server=${encodeURIComponent(wsUrl)}`);
    await expect(p1.locator('#server')).toHaveValue(wsUrl);
    await expect.poll(()=>p1.locator('#crosshair').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    await p1.locator('#name').fill('Huy');
    await p1.locator('#create').click();
    await expect.poll(()=>p1.evaluate(()=>window.BoomChiuPvP?.joined),{timeout:6000}).toBe(true);
    await expect.poll(()=>p1.evaluate(()=>window.BoomChiuPvP?.ping),{timeout:4000}).not.toBeNull();
    expect(await p1.evaluate(()=>window.BoomChiuPvP.server)).toBe(wsUrl);
    const room=await p1.evaluate(()=>window.BoomChiuPvP.room);
    expect(room).toMatch(/^[A-Z0-9]{6}$/);

    const before=await p1.evaluate(()=>window.BoomChiuPvP.renderPosition);
    await p1.evaluate(()=>dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})));
    await wait(180);
    const predicted=await p1.evaluate(()=>window.BoomChiuPvP.renderPosition);
    await p1.evaluate(()=>dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})));
    expect(Math.hypot(predicted.x-before.x,predicted.y-before.y)).toBeGreaterThan(.05);
    await expect.poll(()=>p1.evaluate(origin=>{
      const me=window.BoomChiuPvP.actors.find(a=>a.id===window.BoomChiuPvP.you);
      return me?Math.hypot(me.x-origin.x,me.y-origin.y):0;
    },before),{timeout:3000}).toBeGreaterThan(.05);

    await p2.goto(`/games/boom-chiu-pvp.html?server=${encodeURIComponent(wsUrl)}&room=${room}`);
    await expect(p2.locator('#server')).toHaveValue(wsUrl);
    await p2.locator('#name').fill('Bạn Huy');
    await p2.locator('#join').click();
    await expect.poll(()=>p2.evaluate(()=>window.BoomChiuPvP?.joined),{timeout:6000}).toBe(true);
    await expect.poll(()=>p1.evaluate(()=>window.BoomChiuPvP.actors.filter(a=>a.human).length),{timeout:6000}).toBe(2);
    await expect.poll(()=>p2.evaluate(()=>window.BoomChiuPvP.actors.length),{timeout:6000}).toBe(10);
    const teams=await p2.evaluate(()=>({blue:window.BoomChiuPvP.actors.filter(a=>a.team==='blue').length,red:window.BoomChiuPvP.actors.filter(a=>a.team==='red').length,humans:window.BoomChiuPvP.actors.filter(a=>a.human).length}));
    expect(teams).toEqual({blue:5,red:5,humans:2});
    await expect(p2.locator('#netBadge')).toContainText('Hz');
    expect(errors).toEqual([]);
  }finally{
    await c1.close();await c2.close();server.kill('SIGTERM');
  }
});