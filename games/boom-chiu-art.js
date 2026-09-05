(() => {
  'use strict';
  const load=(src)=>{
    const img=new Image();
    img.decoding='async';
    img.src=src;
    return img;
  };
  const rifle=load('../assets/boom-chiu/styloo/ak47-fps.png');
  const soldiers=Array.from({length:8},(_,i)=>load(`../assets/boom-chiu/quaternius/soldier-${i}.png`));
  const all=[rifle,...soldiers];
  const readyPromise=Promise.all(all.map(img=>new Promise(resolve=>{
    if(img.complete) return resolve(img.naturalWidth>0);
    img.addEventListener('load',()=>resolve(true),{once:true});
    img.addEventListener('error',()=>resolve(false),{once:true});
  })));
  window.BoomChiuArt={
    rifle,
    soldiers,
    readyPromise,
    get ready(){return all.every(img=>img.complete&&img.naturalWidth>0)},
    get rifleLoaded(){return rifle.complete&&rifle.naturalWidth>0},
    get soldiersLoaded(){return soldiers.filter(img=>img.complete&&img.naturalWidth>0).length}
  };
})();
