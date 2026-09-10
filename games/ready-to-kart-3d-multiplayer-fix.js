'use strict';
(()=>{
  if(typeof window==='undefined'||!window.firebase||!location.pathname.toLowerCase().includes('ready-to-kart-3d'))return;
  const db=firebase.database();
  const proto=Object.getPrototypeOf(db.ref());
  if(!proto||typeof proto.transaction!=='function'||proto.__kart3dTransactionFix)return;
  const originalTransaction=proto.transaction;
  const stateKeys=['status','winner','mapId','mode','round','startsAt','startedAt','finishedAt','telemetry'];
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  proto.transaction=function(updateFn,onComplete,applyLocally){
    const ref=this;
    if(!/^readyToRace_[A-Z0-9]{4}$/.test(String(ref.key||'')))return originalTransaction.call(ref,updateFn,onComplete,applyLocally);
    return ref.once('value').then(async snap=>{
      const current=snap.val();
      if(!current||current.kind!=='ready-to-race-v0')return originalTransaction.call(ref,updateFn,onComplete,applyLocally);
      const before=clone(current),next=updateFn(clone(current));
      if(next===undefined){const result={committed:false,snapshot:snap};if(typeof onComplete==='function')onComplete(null,false,snap);return result;}
      const patch={};
      for(const key of stateKeys){
        const a=JSON.stringify(before?.[key]??null),b=JSON.stringify(next?.[key]??null);
        if(a!==b)patch[key]=Object.prototype.hasOwnProperty.call(next,key)?next[key]:null;
      }
      if(Object.keys(patch).length)await ref.update(patch);
      const after=await ref.once('value');
      const result={committed:true,snapshot:after};
      if(typeof onComplete==='function')onComplete(null,true,after);
      return result;
    }).catch(error=>{
      if(typeof onComplete==='function')onComplete(error,false,null);
      throw error;
    });
  };
  proto.__kart3dTransactionFix=true;
})();
