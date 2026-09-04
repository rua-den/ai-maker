(() => {
  'use strict';
  const R = window.ThreeKingdomsXiangqi;
  const Bot = window.ThreeKingdomsBot;
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const setupModal = document.getElementById('setupModal');
  const rulesModal = document.getElementById('rulesModal');
  const gameOver = document.getElementById('gameOver');
  const kingdomBar = document.getElementById('kingdomBar');
  const turnMain = document.getElementById('turnMain');
  const turnEvent = document.getElementById('turnEvent');
  const turnDot = document.getElementById('turnDot');
  const COLORS = ['#e85848','#4c82d0','#43a263'];
  const DARK = ['#6e211c','#183b70','#1c6336'];
  const LABELS = ['Thục','Ngụy','Ngô'];
  let state = R.initialState(true);
  let seats = ['human','bot','bot'];
  let difficulty = 'hard';
  let selected = null;
  let selectedMoves = [];
  let botTimer = null;
  let botThinking = false;
  let onlineAdapter = null;
  let dpr = 1;
  let W = 0, H = 0;
  let nodePos = new Map();
  let pieceRadius = 22;
  let moveFx = null;
  let captureFx = null;

  function clone(value){return value == null ? value : JSON.parse(JSON.stringify(value))}
  function lerp(a,b,t){return a+(b-a)*t}
  function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`}

  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, rect.width); H = Math.max(480, rect.height);
    canvas.width = Math.floor(W*dpr); canvas.height = Math.floor(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    buildGeometry();
  }

  function buildGeometry(){
    nodePos = new Map();
    const min = Math.min(W, H*1.05);
    const cx = W/2;
    const cy = H/2 + (H<650?18:24);
    const backRadius = Math.min(min*.405, H*.39);
    const frontRadius = backRadius*.37;
    const baseGap = backRadius*.115;
    pieceRadius = Math.max(14, Math.min(26, baseGap*.72));
    const angles = [Math.PI/2, Math.PI*7/6, Math.PI*11/6];
    for(let s=0;s<3;s++){
      const a=angles[s]; const hv={x:Math.cos(a),y:Math.sin(a)}; const lv={x:Math.cos(a+Math.PI/2),y:Math.sin(a+Math.PI/2)};
      for(let r=0;r<5;r++){
        const t=r/4; const radial=lerp(backRadius,frontRadius,t); const scale=lerp(1,.68,t); const gap=baseGap*scale;
        for(let f=0;f<9;f++){
          const lateral=(f-4)*gap;
          nodePos.set(R.key(s,r,f),{x:cx+hv.x*radial+lv.x*lateral,y:cy+hv.y*radial+lv.y*lateral});
        }
      }
    }
  }

  function pathPoints(keys){return keys.map(k=>nodePos.get(k)).filter(Boolean)}
  function drawPolyline(points,stroke,width=1,alpha=1){if(points.length<2)return;ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.stroke();ctx.restore()}

  function drawBoard(){
    ctx.clearRect(0,0,W,H);
    const cx=W/2, cy=H/2+(H<650?18:24);
    const back=nodePos.get('0:0:4'); const centerR=Math.hypot(back.x-cx,back.y-cy); const outer=centerR+pieceRadius*2.5;
    const hex=[];for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;hex.push({x:cx+Math.cos(a)*outer,y:cy+Math.sin(a)*outer})}
    ctx.save();ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=38;ctx.fillStyle='#1a130d';ctx.beginPath();ctx.moveTo(hex[0].x,hex[0].y);for(let i=1;i<6;i++)ctx.lineTo(hex[i].x,hex[i].y);ctx.closePath();ctx.fill();ctx.restore();

    for(let s=0;s<3;s++){
      const p0=nodePos.get(R.key(s,0,0)),p1=nodePos.get(R.key(s,0,8)),p2=nodePos.get(R.key(s,4,8)),p3=nodePos.get(R.key(s,4,0));
      const grad=ctx.createLinearGradient(p0.x,p0.y,cx,cy);grad.addColorStop(0,rgba(COLORS[s],.34));grad.addColorStop(1,'rgba(84,54,27,.30)');
      ctx.save();ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(cx,cy);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.fill();ctx.restore();
    }

    ctx.save();ctx.strokeStyle='rgba(72,128,151,.36)';ctx.lineWidth=Math.max(15,pieceRadius*1.05);ctx.lineCap='round';for(let s=0;s<3;s++){const p=nodePos.get(R.key(s,4,4));ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(p.x,p.y);ctx.stroke()}ctx.restore();
    ctx.save();const cg=ctx.createRadialGradient(cx,cy,2,cx,cy,pieceRadius*2.6);cg.addColorStop(0,'rgba(227,187,116,.26)');cg.addColorStop(1,'rgba(18,14,10,.72)');ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx,cy,pieceRadius*2.25,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(242,205,139,.65)';ctx.font=`900 ${Math.max(16,pieceRadius)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('三國',cx,cy);ctx.restore();

    for(let s=0;s<3;s++){
      for(let r=0;r<5;r++)drawPolyline(pathPoints(Array.from({length:9},(_,f)=>R.key(s,r,f))),'rgba(244,211,158,.38)',1.25);
      for(let f=0;f<9;f++)drawPolyline(pathPoints(Array.from({length:5},(_,r)=>R.key(s,r,f))),'rgba(244,211,158,.38)',1.25);
      drawPolyline(pathPoints([R.key(s,0,3),R.key(s,1,4),R.key(s,2,5)]),'rgba(249,219,166,.52)',1.4);
      drawPolyline(pathPoints([R.key(s,0,5),R.key(s,1,4),R.key(s,2,3)]),'rgba(249,219,166,.52)',1.4);
      const label=nodePos.get(R.key(s,1,4));ctx.save();ctx.globalAlpha=.15;ctx.fillStyle='#fff4dc';ctx.font=`1000 ${Math.max(28,pieceRadius*2)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(R.KINGDOMS[s].han,label.x,label.y);ctx.restore();
    }

    ctx.save();ctx.setLineDash([4,5]);for(let s=0;s<3;s++){for(const f of [0,2,4,6,8]){const a=nodePos.get(R.key(s,4,f));for(const o of [(s+1)%3,(s+2)%3]){const b=nodePos.get(R.key(o,4,8-f));const mx=(a.x+b.x+cx)/3,my=(a.y+b.y+cy)/3;ctx.strokeStyle='rgba(209,185,143,.11)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);ctx.stroke()}}}ctx.restore();
  }

  function drawHighlights(now){
    if(!selected)return;
    const p=state.pieces.find(x=>x.id===selected);if(!p)return;const origin=nodePos.get(R.key(p.sector,p.r,p.f));
    ctx.save();ctx.strokeStyle='rgba(255,221,128,.95)';ctx.lineWidth=2.2;ctx.shadowColor='rgba(255,199,78,.7)';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(origin.x,origin.y,pieceRadius*1.18,0,Math.PI*2);ctx.stroke();ctx.restore();
    for(const m of selectedMoves){const pos=nodePos.get(m.to);const occupied=state.pieces.some(x=>R.key(x.sector,x.r,x.f)===m.to);ctx.save();ctx.fillStyle=occupied?'rgba(255,91,74,.44)':'rgba(255,225,137,.28)';ctx.strokeStyle=occupied?'rgba(255,119,101,.88)':'rgba(255,225,137,.74)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(pos.x,pos.y,occupied?pieceRadius*.74:Math.max(5,pieceRadius*.27),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
    const pulse=.5+.5*Math.sin(now/260);if(R.isInCheck(state,state.turn)){const g=state.pieces.find(p=>p.type==='K'&&p.home===state.turn);if(g){const pos=nodePos.get(R.key(g.sector,g.r,g.f));ctx.save();ctx.strokeStyle=`rgba(255,70,55,${.45+.45*pulse})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(pos.x,pos.y,pieceRadius*(1.25+.1*pulse),0,Math.PI*2);ctx.stroke();ctx.restore()}}
  }

  function pieceDisplayPosition(piece,now){
    const target=nodePos.get(R.key(piece.sector,piece.r,piece.f));
    if(moveFx&&moveFx.pieceId===piece.id){const t=Math.max(0,Math.min(1,(now-moveFx.start)/260));if(t<1){const e=1-Math.pow(1-t,3);return{x:lerp(moveFx.from.x,target.x,e),y:lerp(moveFx.from.y,target.y,e),lift:Math.sin(Math.PI*t)*7}}moveFx=null}
    return{x:target.x,y:target.y,lift:0}
  }

  function drawPiece(piece,now){
    const pos=pieceDisplayPosition(piece,now);const c=COLORS[piece.controller];const dark=DARK[piece.controller];const r=pieceRadius;
    ctx.save();ctx.translate(pos.x,pos.y-pos.lift);ctx.shadowColor='rgba(0,0,0,.58)';ctx.shadowBlur=10;ctx.shadowOffsetY=5;
    const g=ctx.createRadialGradient(-r*.35,-r*.45,r*.12,0,0,r);g.addColorStop(0,'#fff4d3');g.addColorStop(.13,c);g.addColorStop(1,dark);ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle='rgba(255,239,204,.72)';ctx.lineWidth=Math.max(1.2,r*.07);ctx.beginPath();ctx.arc(0,0,r*.82,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(0,0,0,.32)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*.7,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff6df';ctx.font=`1000 ${Math.floor(r*1.04)}px "Noto Serif CJK SC","Songti SC",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(piece.glyph,0,1);
    if(piece.home!==piece.controller){ctx.fillStyle=COLORS[piece.home];ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(r*.68,-r*.66,Math.max(3,r*.18),0,Math.PI*2);ctx.fill();ctx.stroke()}
    ctx.restore();
  }

  function render(now=performance.now()){
    drawBoard();
    if(state.lastMove){const a=nodePos.get(state.lastMove.from),b=nodePos.get(state.lastMove.to);if(a&&b){ctx.save();ctx.strokeStyle='rgba(255,217,119,.18)';ctx.lineWidth=pieceRadius*1.35;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}}
    drawHighlights(now);
    for(const piece of state.pieces)drawPiece(piece,now);
    if(captureFx){const t=Math.max(0,(now-captureFx.start)/450);if(t<1){ctx.save();ctx.globalAlpha=1-t;ctx.strokeStyle='#ffcf72';ctx.lineWidth=3*(1-t)+1;ctx.beginPath();ctx.arc(captureFx.x,captureFx.y,Math.max(0,pieceRadius*(.8+t*1.6)),0,Math.PI*2);ctx.stroke();ctx.restore()}else captureFx=null}
    requestAnimationFrame(render);
  }

  function playerTypeLabel(index){
    const online = onlineAdapter?.seatLabel?.(index);
    if(online)return online;
    return seats[index]==='bot'?'🤖 BOT':'👤 Người';
  }

  function updateHud(){
    kingdomBar.innerHTML='';
    for(let k=0;k<3;k++){
      const el=document.createElement('div');el.className='kingdom'+(state.turn===k&&state.alive[k]?' active':'')+(!state.alive[k]?' dead':'');el.style.setProperty('--accent',COLORS[k]);
      const count=state.pieces.filter(p=>p.controller===k).length;const type=playerTypeLabel(k);
      el.innerHTML=`<div class="kingdomHead"><div class="kingdomSeal">${R.KINGDOMS[k].han}</div><div><div class="kingdomName">${LABELS[k]}</div><div class="kingdomMeta">${state.alive[k]?type:'Đã bị thu phục'}</div></div><div class="kingdomPieces">${count} quân</div></div>`;kingdomBar.appendChild(el)
    }
    const turn=state.winner!=null?state.winner:state.turn;turnDot.style.background=COLORS[turn];turnDot.style.color=COLORS[turn];
    if(state.winner!=null){turnMain.textContent=`🏆 ${LABELS[state.winner]} thắng`;turnEvent.textContent=state.lastEvent;turnMain.classList.remove('thinking');return}
    turnMain.textContent=`${R.KINGDOMS[state.turn].han} ${LABELS[state.turn]} · ${playerTypeLabel(state.turn)}`;
    turnMain.classList.toggle('thinking',botThinking);turnEvent.textContent=botThinking?'BOT đang đọc thế trận':(state.lastEvent||'Tới lượt đi.');
  }

  function clearBot(){if(botTimer){clearTimeout(botTimer);botTimer=null}}
  function scheduleBot(){
    clearBot();
    if(onlineAdapter)return;
    if(state.winner!=null||seats[state.turn]!=='bot')return;
    botThinking=true;updateHud();
    botTimer=setTimeout(()=>{botTimer=null;if(state.winner!=null||seats[state.turn]!=='bot')return;const mover=state.turn;const move=Bot.choose(state,mover,difficulty);botThinking=false;if(!move){updateHud();return}commitMove(move)},Math.max(360,difficulty==='destroyer'?620:450));
  }

  function commitMove(move){
    if(onlineAdapter){onlineAdapter.submitMove?.(move);return}
    const moving=state.pieces.find(p=>p.id===move.pieceId);const from=moving?nodePos.get(R.key(moving.sector,moving.r,moving.f)):null;const captured=state.pieces.find(p=>R.key(p.sector,p.r,p.f)===move.to);const capPos=captured?nodePos.get(move.to):null;
    const result=R.makeMove(state,move);if(!result.ok){turnEvent.textContent=result.reason;return}
    state=result.state;selected=null;selectedMoves=[];if(from)moveFx={pieceId:move.pieceId,from,start:performance.now()};if(capPos)captureFx={x:capPos.x,y:capPos.y,start:performance.now()};
    updateHud();if(state.winner!=null){showWinner();return}scheduleBot();
  }

  function findNearestNode(x,y){let best=null,bestD=Infinity;for(const [k,p] of nodePos){const d=Math.hypot(x-p.x,y-p.y);if(d<bestD){bestD=d;best=k}}return bestD<=pieceRadius*1.35?best:null}
  canvas.addEventListener('pointerdown',e=>{
    if(setupModal.classList.contains('show')||rulesModal.classList.contains('show')||gameOver.classList.contains('show')||state.winner!=null||seats[state.turn]==='bot'||(onlineAdapter&&!onlineAdapter.canControl?.(state.turn)))return;
    const rect=canvas.getBoundingClientRect();const node=findNearestNode(e.clientX-rect.left,e.clientY-rect.top);if(!node)return;
    if(selected){const move=selectedMoves.find(m=>m.to===node);if(move){commitMove(move);return}}
    const piece=state.pieces.find(p=>R.key(p.sector,p.r,p.f)===node&&p.controller===state.turn);
    if(piece){selected=piece.id;selectedMoves=R.legalMoves(state,state.turn).filter(m=>m.pieceId===piece.id)}else{selected=null;selectedMoves=[]}
  });

  function startGame(){
    onlineAdapter=null;
    clearBot();seats=[0,1,2].map(i=>document.getElementById('seat'+i).value);difficulty=document.getElementById('botDifficulty').value;state=R.initialState(document.getElementById('specialPieces').checked);selected=null;selectedMoves=[];botThinking=false;setupModal.classList.remove('show');gameOver.classList.remove('show');updateHud();scheduleBot();
  }
  function showWinner(){const k=state.winner;if(k==null)return;document.getElementById('winnerSeal').textContent=R.KINGDOMS[k].han;document.getElementById('winnerSeal').style.color=COLORS[k];document.getElementById('winnerText').textContent=LABELS[k]+' thống nhất Tam Quốc!';document.getElementById('winnerSub').textContent=`Kết thúc sau ${state.moveNo} nước. ${state.eliminated.length} nước đã bị thu phục.`;gameOver.classList.add('show')}

  function applyRemoteState(nextState,nextSeats,nextDifficulty){
    clearBot();
    state=clone(nextState)||R.initialState(true);
    seats=Array.isArray(nextSeats)?nextSeats.slice(0,3):['human','human','human'];
    while(seats.length<3)seats.push('human');
    difficulty=nextDifficulty||'hard';
    selected=null;selectedMoves=[];moveFx=null;captureFx=null;botThinking=false;
    setupModal.classList.remove('show');
    gameOver.classList.remove('show');
    updateHud();
    if(state.winner!=null)showWinner();
  }

  const api={
    attachOnline(adapter){onlineAdapter=adapter||null;clearBot();botThinking=false;updateHud()},
    applyRemoteState,
    setBotThinking(value){botThinking=!!value;updateHud()},
    getState(){return clone(state)},
    showSetup(){setupModal.classList.add('show')},
    get online(){return !!onlineAdapter}
  };
  window.ThreeKingdomsGame=api;

  document.getElementById('startBtn').addEventListener('click',startGame);
  document.getElementById('restartBtn').addEventListener('click',()=>{clearBot();if(onlineAdapter?.backToLobby)onlineAdapter.backToLobby();else setupModal.classList.add('show')});
  document.getElementById('homeBtn').addEventListener('click',()=>location.href='../index.html');
  document.getElementById('rulesBtn').addEventListener('click',()=>rulesModal.classList.add('show'));
  document.getElementById('closeRules').addEventListener('click',()=>rulesModal.classList.remove('show'));
  document.getElementById('changeSeatsBtn').addEventListener('click',()=>{gameOver.classList.remove('show');if(onlineAdapter?.backToLobby)onlineAdapter.backToLobby();else setupModal.classList.add('show')});
  document.getElementById('playAgainBtn').addEventListener('click',()=>{if(onlineAdapter?.requestRematch)onlineAdapter.requestRematch();else startGame()});
  rulesModal.addEventListener('pointerdown',e=>{if(e.target===rulesModal)rulesModal.classList.remove('show')});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')rulesModal.classList.remove('show')});
  window.addEventListener('resize',resize);

  resize();updateHud();requestAnimationFrame(render);
})();
