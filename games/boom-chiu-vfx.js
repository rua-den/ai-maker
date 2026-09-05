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

  function spawnTracer(){
    const t=performance.now();
    const x1=innerWidth*.69,y1=innerHeight*.82;
    const spread=Math.min(18,Math.max(5,innerWidth*.012));
    const x2=innerWidth*.5+(Math.random()-.5)*spread;
    const y2=innerHeight*.5+(Math.random()-.5)*spread;
    shots.push({t,x1,y1,x2,y2,life:110});
    tracerCount++;
  }

  const observer=new MutationObserver(()=>{
    const clip=parseClip();
    if(clip!=null&&lastClip!=null&&clip<lastClip)spawnTracer();
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
      const g=ctx.createLinearGradient(s.x1,s.y1,s.x2,s.y2);
      g.addColorStop(0,`rgba(255,180,55,${alpha*.15})`);
      g.addColorStop(.35,`rgba(255,235,145,${alpha*.95})`);
      g.addColorStop(1,`rgba(255,255,255,${alpha*.25})`);
      ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=g;ctx.lineWidth=2.2;ctx.shadowBlur=12;ctx.shadowColor='rgba(255,193,66,.9)';ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();
      ctx.fillStyle=`rgba(255,222,100,${alpha*.9})`;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(s.x1,s.y1,5+5*(1-p),0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=`rgba(255,245,200,${alpha})`;ctx.lineWidth=1.2;ctx.shadowBlur=5;ctx.beginPath();ctx.moveTo(s.x2-4,s.y2-4);ctx.lineTo(s.x2+4,s.y2+4);ctx.moveTo(s.x2+4,s.y2-4);ctx.lineTo(s.x2-4,s.y2+4);ctx.stroke();ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  window.BoomChiuVfx={
    get tracerCount(){return tracerCount},
    get fps(){return fps},
    testTracer:spawnTracer
  };
})();
