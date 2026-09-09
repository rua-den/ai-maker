'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ReadyToRaceCore=api;

  if(typeof document!=='undefined'){
    const setupRoomQr=()=>{
      const roomCard=document.querySelector('.room');
      const joinUrl=document.getElementById('joinUrl');
      if(!roomCard||!joinUrl||document.getElementById('readyToRaceQrJoin'))return;

      const style=document.createElement('style');
      style.textContent='.readyQrJoin{margin:12px auto 13px;padding:18px;border-radius:20px;background:#fff;border:2px solid #d8e0dc;display:grid;place-items:center;gap:8px;width:min(284px,100%);box-shadow:0 8px 26px rgba(0,0,0,.13)}.readyQrCode{width:232px;height:232px;padding:0;background:#fff;display:grid;place-items:center}.readyQrCode img,.readyQrCode canvas{display:block!important;width:232px!important;height:232px!important;image-rendering:pixelated}.readyQrLabel{font-size:11px;font-weight:1000;letter-spacing:.12em;color:#233a31}.readyQrHint{font-size:10px;font-weight:850;color:#687970;line-height:1.3}.readyQrTip{font-size:9px;color:#8a9891}';
      document.head.appendChild(style);

      const wrap=document.createElement('div');
      wrap.id='readyToRaceQrJoin';
      wrap.className='readyQrJoin';
      wrap.innerHTML='<div id="readyToRaceQrCode" class="readyQrCode" aria-label="QR vào phòng"></div><div class="readyQrLabel">📱 QUÉT ĐỂ VÀO PHÒNG</div><div id="readyToRaceQrHint" class="readyQrHint">Đang tạo QR…</div><div class="readyQrTip">Đưa camera cách màn hình khoảng 20–40 cm</div>';
      roomCard.insertBefore(wrap,joinUrl);

      const qrBox=wrap.querySelector('#readyToRaceQrCode');
      const hint=wrap.querySelector('#readyToRaceQrHint');
      let lastUrl='';

      const renderQr=()=>{
        const url=String(joinUrl.value||'');
        if(!/^https?:\/\//.test(url)||!window.QRCode||url===lastUrl)return;
        lastUrl=url;
        qrBox.innerHTML='';
        try{
          new window.QRCode(qrBox,{text:url,width:232,height:232,colorDark:'#000000',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.L});
          const code=(new URL(url)).searchParams.get('room')||'';
          hint.textContent=code?'Mở tay cầm · phòng '+code:'Mở tay cầm trên điện thoại';
        }catch(error){
          console.error(error);
          hint.textContent='Không tạo được QR · dùng mã phòng bên trên';
        }
      };

      const loadQrLibrary=()=>{
        if(window.QRCode)return renderQr();
        let script=document.getElementById('readyToRaceQrLib');
        if(!script){
          script=document.createElement('script');
          script.id='readyToRaceQrLib';
          script.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
          script.async=true;
          script.onload=renderQr;
          script.onerror=()=>{hint.textContent='QR không tải được · dùng mã phòng bên trên';};
          document.head.appendChild(script);
        }else{
          script.addEventListener('load',renderQr,{once:true});
        }
      };

      loadQrLibrary();
      const timer=setInterval(renderQr,250);
      window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    };

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupRoomQr,{once:true});
    else setupRoomQr();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ROOT='caroRooms';
  const ROOM_PREFIX='readyToRace_';
  const ROOM_KIND='ready-to-race-v0';
  const MAX_PLAYERS=6;
  const LAPS=3;
  const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const TWO_PI=Math.PI*2;
  const VEHICLES=['roach','tank','normal','race'];
  const VEHICLE_SPECS={
    roach:{id:'roach',label:'Xe gián',emoji:'🪳',max:0.93,reverse:1.05,accel:1.08,turn:1.22,drag:1.0,radius:12,mass:0.72},
    tank:{id:'tank',label:'Xe tank',emoji:'🛡️',max:0.76,reverse:0.78,accel:0.82,turn:0.72,drag:0.998,radius:21,mass:2.35},
    normal:{id:'normal',label:'Xe thường',emoji:'🚗',max:1,reverse:1,accel:1,turn:1,drag:1,radius:16,mass:1.15},
    race:{id:'race',label:'Xe đua',emoji:'🏎️',max:1.15,reverse:0.95,accel:1.08,turn:1.03,drag:1.0015,radius:15,mass:0.9}
  };

  function cleanRoomCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)}
  function roomKey(code){return ROOM_PREFIX+cleanRoomCode(code)}
  function cleanName(value){const s=String(value||'').replace(/[<>\u0000-\u001f]/g,'').trim().replace(/\s+/g,' ').slice(0,16);return s||'Racer'}
  function makeRoomCode(random=Math.random){let code='';for(let i=0;i<4;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)%ALPHABET.length];return code}
  function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0))}
  function clampSteer(value){return clamp(value,-1,1)}
  function clampUnit(value){return clamp(value,0,1)}
  function sanitizeInput(value){const v=value||{};return{steer:clampSteer(v.steer),throttle:clampUnit(v.throttle),brake:!!v.brake,reverse:!!v.reverse,seq:Math.max(0,Math.floor(Number(v.seq)||0)),at:Number(v.at)||0}}
  function sanitizeVehicle(value){return VEHICLES.includes(String(value||''))?String(value):'normal'}
  function vehicleSpec(value){return VEHICLE_SPECS[sanitizeVehicle(typeof value==='object'?value?.vehicle:value)]}
  function normalizeAngle(angle){angle=Number(angle)||0;angle%=TWO_PI;if(angle<0)angle+=TWO_PI;return angle}
  function angleDelta(from,to){let d=normalizeAngle(to)-normalizeAngle(from);if(d>Math.PI)d-=TWO_PI;if(d<-Math.PI)d+=TWO_PI;return d}
  function trackMetric(x,y,track){const dx=(x-track.cx)/track.rx,dy=(y-track.cy)/track.ry;return Math.hypot(dx,dy)}
  function ellipseTheta(x,y,track){return normalizeAngle(Math.atan2((y-track.cy)/track.ry,(x-track.cx)/track.rx))}
  function makeCar(index,track,vehicle='normal'){
    const lane=(index%3)-1,row=Math.floor(index/3);
    const y=track.cy+lane*22;
    return{x:track.cx+track.rx*.84-row*18,y,angle:Math.PI/2,speed:0,theta:0,progress:0,lap:0,checkpoint:0,previousY:y,finished:false,vehicle:sanitizeVehicle(vehicle)}
  }
  function resetProgress(car,track){
    car.theta=ellipseTheta(car.x,car.y,track);
    car.progress=0;car.lap=0;car.checkpoint=0;car.previousY=car.y;car.finished=false;
    return car
  }
  function progressWithinStage(car,track){
    const stage=clamp(car.checkpoint,0,3);
    const theta=ellipseTheta(car.x,car.y,track);
    const start=stage*(Math.PI/2),end=start+Math.PI/2;
    const frac=theta>=start&&theta<=end?clamp((theta-start)/(Math.PI/2),0,1):0;
    return stage*(Math.PI/2)+frac*(Math.PI/2)
  }
  function updateProgress(car,track){
    const prevY=Number.isFinite(car.previousY)?car.previousY:car.y;
    const q=trackMetric(car.x,car.y,track);
    const farEnough=q>.34;
    if(car.checkpoint===0&&farEnough&&car.y>=track.cy+track.ry*.55)car.checkpoint=1;
    else if(car.checkpoint===1&&farEnough&&car.x<=track.cx-track.rx*.55)car.checkpoint=2;
    else if(car.checkpoint===2&&farEnough&&car.y<=track.cy-track.ry*.55)car.checkpoint=3;
    else if(car.checkpoint===3&&farEnough&&prevY<track.cy&&car.y>=track.cy&&car.x>=track.cx+track.rx*.45&&Math.sin(car.angle)*car.speed>4){
      car.lap=Math.min(LAPS,car.lap+1);
      car.checkpoint=0;
      if(car.lap>=LAPS)car.finished=true;
    }
    car.theta=ellipseTheta(car.x,car.y,track);
    car.progress=Math.min(LAPS*TWO_PI,car.lap*TWO_PI+(car.finished?0:progressWithinStage(car,track)));
    car.previousY=car.y;
    return car
  }
  function approach(value,target,amount){if(value<target)return Math.min(target,value+amount);if(value>target)return Math.max(target,value-amount);return value}
  function constrainToMap(car,track){
    const margin=Number(track.edgeMargin)||18,width=Number(track.width)||960,height=Number(track.height)||600;
    let hit=false;
    if(car.x<margin){car.x=margin;if(Math.cos(car.angle)*car.speed<0)car.speed*=-.42;hit=true}
    else if(car.x>width-margin){car.x=width-margin;if(Math.cos(car.angle)*car.speed>0)car.speed*=-.42;hit=true}
    if(car.y<margin){car.y=margin;if(Math.sin(car.angle)*car.speed<0)car.speed*=-.42;hit=true}
    else if(car.y>height-margin){car.y=height-margin;if(Math.sin(car.angle)*car.speed>0)car.speed*=-.42;hit=true}
    if(hit)car.speed*=.88;
    return hit
  }
  function stepCar(car,input,dt,track){
    dt=clamp(dt,0,.05);input=sanitizeInput(input);
    car.vehicle=sanitizeVehicle(car.vehicle);
    const spec=vehicleSpec(car),q=trackMetric(car.x,car.y,track),onRoad=q>=.60&&q<=1.08;
    const forwardMax=(onRoad?285:190)*spec.max,reverseMax=(onRoad?92:68)*spec.reverse;
    const accel=(onRoad?230:175)*spec.accel,reverseAccel=175*spec.accel,brakePower=390,turnRate=2.35*spec.turn;

    if(input.brake){
      car.speed=approach(car.speed,0,brakePower*dt);
    }else if(input.reverse){
      if(car.speed>8)car.speed=approach(car.speed,0,brakePower*.9*dt);
      else car.speed-=reverseAccel*dt;
    }else if(input.throttle){
      if(car.speed<-8)car.speed=approach(car.speed,0,brakePower*.85*dt);
      else car.speed+=input.throttle*accel*dt;
    }

    const drag=(onRoad?.992:.982)*spec.drag;
    car.speed*=Math.pow(clamp(drag,.94,.9995),dt*60);
    car.speed=clamp(car.speed,-reverseMax,forwardMax);

    const absSpeed=Math.abs(car.speed);
    const turnGrip=.18+Math.min(1,absSpeed/165)*.94;
    const direction=car.speed<0?-1:1;
    car.angle+=input.steer*turnRate*turnGrip*direction*dt;
    car.x+=Math.cos(car.angle)*car.speed*dt;
    car.y+=Math.sin(car.angle)*car.speed*dt;

    constrainToMap(car,track);
    updateProgress(car,track);
    return car;
  }
  function resolveCarCollisions(cars){
    const list=(cars||[]).filter(Boolean);
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j],sa=vehicleSpec(a),sb=vehicleSpec(b);
      let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
      const minDist=sa.radius+sb.radius;
      if(dist>=minDist)continue;
      if(dist<.001){dx=.001;dy=0;dist=.001}
      const nx=dx/dist,ny=dy/dist,overlap=minDist-dist,total=sa.mass+sb.mass;
      a.x-=nx*overlap*(sb.mass/total);a.y-=ny*overlap*(sb.mass/total);
      b.x+=nx*overlap*(sa.mass/total);b.y+=ny*overlap*(sa.mass/total);

      const ahx=Math.cos(a.angle),ahy=Math.sin(a.angle),bhx=Math.cos(b.angle),bhy=Math.sin(b.angle);
      const va=a.speed*(ahx*nx+ahy*ny),vb=b.speed*(bhx*nx+bhy*ny);
      if(va>vb){
        const e=.34;
        const va2=(va*(sa.mass-e*sb.mass)+(1+e)*sb.mass*vb)/total;
        const vb2=(vb*(sb.mass-e*sa.mass)+(1+e)*sa.mass*va)/total;
        a.speed+=(va2-va)*(ahx*nx+ahy*ny);
        b.speed+=(vb2-vb)*(bhx*nx+bhy*ny);
        a.speed*=.96;b.speed*=.96;
      }
    }
    return list
  }
  function raceProgress(car){return Math.max(0,Math.min(LAPS,car.progress/TWO_PI))}
  return {ROOT,ROOM_PREFIX,ROOM_KIND,MAX_PLAYERS,LAPS,ALPHABET,TWO_PI,VEHICLES,VEHICLE_SPECS,cleanRoomCode,roomKey,cleanName,makeRoomCode,clamp,clampSteer,clampUnit,sanitizeInput,sanitizeVehicle,vehicleSpec,normalizeAngle,angleDelta,trackMetric,ellipseTheta,makeCar,resetProgress,progressWithinStage,updateProgress,approach,constrainToMap,stepCar,resolveCarCollisions,raceProgress};
});
