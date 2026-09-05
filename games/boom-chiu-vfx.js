(() => {
  'use strict';
  const ammo=document.getElementById('ammo');
  const game=document.getElementById('game');
  if(!ammo||!game)return;

  const fx=document.createElement('canvas');
  fx.id='boomFx';
  Object.assign(fx.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'9'});
  document.body.appendChild(fx);
  const ctx=fx.getContext('2d');
  let shots=[];
  let lastClip=null;
  let tracerCount=0;
  let fps=60,frames=0,fpsAt=performance.now();
  let lastDirectAt=-Infinity;
  let lastShot=null;

  function resize(){
    const dpr=Math.min(innerWidth<760?1:1.25,devicePixelRatio||1);
    fx.width=Math.floor(innerWidth*dpr);fx.height=Math.floor(innerHeight*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();addEventListener('resize',resize);

  function parseClip(){
    const m=String(ammo.textContent||'').match(/(\d+)\s*\//);
    return m?Number(m[1]):null;
  }

  function spawnTracer(opts={}){
    const t=performance.now(),muzzle=window.BoomChiuWeaponView?.muzzle;
    const x1=Number.isFinite(opts.x1)?opts.x1:(muzzle?.x??innerWidth*.575);
    const y1=Number.isFinite(opts.y1)?opts.y1:(muzzle?.y??innerHeight*.585);
    const spread=Math.min(7,Math.max(2,innerWidth*.004));
    const x2=Number.isFinite(opts.x2)?opts.x2:innerWidth*.5+(Math.random()-.5)*spread;
    const y2=Number.isFinite(opts.y2)?opts.y2:innerHeight*.5+(Math.random()-.5)*spread;
    const shot={t,x1,y1,x2,y2,life:105};
    shots.push(shot);tracerCount++;lastShot={...shot};return shot;
  }

  function fire(opts={}){lastDirectAt=performance.now();return spawnTracer(opts)}

  const observer=new MutationObserver(()=>{
    const clip=parseClip();
    if(clip!=null&&lastClip!=null&&clip<lastClip&&performance.now()-lastDirectAt>40)spawnTracer();
    lastClip=clip;
  });
  observer.observe(ammo,{subtree:true,childList:true,characterData:true});
  lastClip=parseClip();

  function draw(t){
    frames++;
    if(t-fpsAt>=500){fps=frames*1000/(t-fpsAt);frames=0;fpsAt=t}
    ctx.clearRect(0,0,innerWidth,innerHeight);
    shots=shots.filter(s=>t-s.t<s.life);
    for(const s of shots){
      const p=(t-s.t)/s.life,alpha=1-p;
      const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
      const tailX=s.x1+dx*.12,tailY=s.y1+dy*.12,headX=s.x1+dx*Math.min(1,.55+p*.55),headY=s.y1+dy*Math.min(1,.55+p*.55);
      const g=ctx.createLinearGradient(tailX,tailY,headX,headY);
      g.addColorStop(0,`rgba(255,173,44,${alpha*.08})`);
      g.addColorStop(.36,`rgba(255,231,133,${alpha*.92})`);
      g.addColorStop(1,`rgba(255,255,255,${alpha*.18})`);
      ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=g;ctx.lineWidth=2;ctx.shadowBlur=10;ctx.shadowColor='rgba(255,190,55,.85)';ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(headX,headY);ctx.stroke();
      ctx.fillStyle=`rgba(255,224,108,${alpha*.85})`;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(s.x1,s.y1,3.5+3.5*(1-p),0,Math.PI*2);ctx.fill();
      if(p>.5){ctx.strokeStyle=`rgba(255,245,205,${alpha})`;ctx.lineWidth=1.1;ctx.shadowBlur=4;ctx.beginPath();ctx.moveTo(s.x2-uy*5,s.y2+ux*5);ctx.lineTo(s.x2+uy*5,s.y2-ux*5);ctx.moveTo(s.x2-ux*4,s.y2-uy*4);ctx.lineTo(s.x2+ux*4,s.y2+uy*4);ctx.stroke()}
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  window.BoomChiuVfx={
    fire,
    get tracerCount(){return tracerCount},
    get fps(){return fps},
    get lastShot(){return lastShot&&{...lastShot}},
    testTracer:spawnTracer
  };
})();
