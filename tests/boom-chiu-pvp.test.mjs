import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';

const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
function waitFor(ws,pred,timeout=5000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',on);reject(new Error('timeout waiting websocket message'))},timeout);function on(e){let m;try{m=JSON.parse(String(e.data))}catch{return}if(pred(m)){clearTimeout(timer);ws.removeEventListener('message',on);resolve(m)}}ws.addEventListener('message',on)})}
async function open(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});return ws}

test('Bùm Chíu PvP server lets two humans share a 5v5 room with eight server bots',async t=>{
  const port=19000+Math.floor(Math.random()*1000);
  const child=spawn(process.execPath,['server/boom-chiu-server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill('SIGTERM'));
  let ready=false;child.stdout.on('data',d=>{if(String(d).includes('listening'))ready=true});
  for(let i=0;i<50&&!ready;i++)await wait(50);
  assert.equal(ready,true,'server should start');
  const url=`ws://127.0.0.1:${port}`;
  const a=await open(url),b=await open(url);t.after(()=>{a.close();b.close()});
  const joinedA=waitFor(a,m=>m.type==='joined');
  a.send(JSON.stringify({type:'create',name:'Huy',map:'cat_chay',difficulty:'hard',targetScore:20}));
  const ja=await joinedA;assert.match(ja.room,/^[A-Z0-9]{6}$/);
  const joinedB=waitFor(b,m=>m.type==='joined');
  b.send(JSON.stringify({type:'join',name:'Bạn Huy',room:ja.room}));
  const jb=await joinedB;assert.equal(jb.room,ja.room);assert.notEqual(jb.you,ja.you);
  const state=await waitFor(a,m=>m.type==='state'&&m.room===ja.room&&m.actors.filter(x=>x.human).length===2);
  assert.equal(state.actors.length,10);
  assert.equal(state.actors.filter(x=>x.human).length,2);
  assert.equal(state.actors.filter(x=>!x.human).length,8);
  assert.equal(state.actors.filter(x=>x.team==='blue').length,5);
  assert.equal(state.actors.filter(x=>x.team==='red').length,5);
  a.send(JSON.stringify({type:'input',forward:1,strafe:0,angle:0}));
  const moved=await waitFor(a,m=>m.type==='state'&&m.actors.some(x=>x.id===ja.you&&x.x!==state.actors.find(y=>y.id===ja.you).x));
  assert.ok(moved.actors.find(x=>x.id===ja.you));
});
