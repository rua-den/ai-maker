(() => {
  'use strict';

  const TEAM_BLUE = 'blue';
  const TEAM_RED = 'red';
  const TILE = 1;
  const PLAYER_SPEED = 3.15;

  const MAPS = {
    cat_chay: {
      id: 'cat_chay', name: 'Cát Cháy', subtitle: 'Đường dài · ngã tư · hẻm xuyên',
      palette: { sky:'#87b6c7', floor:'#b69260', wall:'#c7a16b', wallDark:'#7d5c39', accent:'#e6c68a' },
      grid: [
        '########################','#BBBB...#......#.......#','#BBBB...#......#.......#','#.......#......#.......#','#.......#..##..#.......#','#.......#..##..........#','#..###...........###...#','#..#.............#.....#','#..#.....####....#.....#','#........#..#..........#','####.....#..#.....######','#........#..#..........#','#........#..#..........#','######...#..#.....######','#........####..........#','#..#..............#....#','#..#.....######...#....#','#..###............###..#','#..........##..........#','#.......#..##..#.......#','#.......#......#.......#','#.......#......#...RRRR#','#.......#......#...RRRR#','########################'
      ]
    },
    cho_dem: {
      id: 'cho_dem', name: 'Chợ Đêm', subtitle: 'Quảng trường · kiosk · connector',
      palette: { sky:'#1e2944', floor:'#4d4148', wall:'#9b6b5d', wallDark:'#55363a', accent:'#efb35f' },
      grid: [
        '########################','#BBBB....#....#........#','#BBBB....#....#........#','#........#....#........#','#..####..#....#..####..#','#........#.............#','#........#######.......#','#......................#','#####....#....#....#####','#........#....#........#','#........#....#........#','#..###..............#..#','#..#.................#.#','#..#......####.......#.#','#..#......#..#.......#.#','#.........#..#.........#','#####.....#..#.....#####','#.........#..#.........#','#...####........####...#','#........#....#........#','#........#....#........#','#........#....#....RRRR#','#........#....#....RRRR#','########################'
      ]
    },
    pho_co: {
      id: 'pho_co', name: 'Phố Cổ', subtitle: 'Hẻm hẹp · góc gắt · đường vòng',
      palette: { sky:'#a5b6b1', floor:'#74665b', wall:'#b68663', wallDark:'#684738', accent:'#d8bd8e' },
      grid: [
        '########################','#BBBB...#.........#....#','#BBBB...#.........#....#','#.......#..#####..#....#','#.......#......#.......#','#####...######.#...#####','#..............#.......#','#..########....#.......#','#..............#####...#','#....#####.............#','#....#...#.............#','#....#...#####....####.#','#........#.............#','####.....#.....#####...#','#........#.........#...#','#...######.........#...#','#..............#####...#','#..#####...............#','#...........######.....#','#....#.................#','#....#..#####..........#','#....#.........#...RRRR#','#..............#...RRRR#','########################'
      ]
    }
  };

  const BOT_NAMES = ['Mập','Tí Nâu','Rambo Rùa','Bảy Đạn','Ông Chú','Cá Mập','Bắp','Khoai','Nấm','Mực','Sói','Chim Cút'];
  const WEAPON = Object.freeze({ name:'Rùa-47', clipSize:30, reserve:90, damage:34, headshot:2.25, fireDelay:95, reloadMs:1450, spread:0.008, range:22 });

  function mapData(mapOrId) { return typeof mapOrId === 'string' ? MAPS[mapOrId] : mapOrId; }
  function dimensions(mapOrId) { const m=mapData(mapOrId); return {width:m.grid[0].length,height:m.grid.length}; }
  function cell(mapOrId,x,y) { const m=mapData(mapOrId),col=Math.floor(x),row=Math.floor(y); if(row<0||col<0||row>=m.grid.length||col>=m.grid[0].length)return '#'; return m.grid[row][col]; }
  function isWall(mapOrId,x,y){return cell(mapOrId,x,y)==='#'}
  function spawns(mapOrId,team){const m=mapData(mapOrId),marker=team===TEAM_BLUE?'B':'R',out=[];for(let y=0;y<m.grid.length;y++)for(let x=0;x<m.grid[y].length;x++)if(m.grid[y][x]===marker)out.push({x:x+.5,y:y+.5});return out}
  function randomSpawn(mapOrId,team,random=Math.random){const list=spawns(mapOrId,team);return list[Math.floor(random()*list.length)]||{x:2.5,y:2.5}}
  function canStand(mapOrId,x,y,radius=.22){return !isWall(mapOrId,x-radius,y-radius)&&!isWall(mapOrId,x+radius,y-radius)&&!isWall(mapOrId,x-radius,y+radius)&&!isWall(mapOrId,x+radius,y+radius)}

  // Grid DDA: crosses tile boundaries instead of sampling every 0.025 tile.
  function raycast(mapOrId,x,y,angle,maxDistance=30){
    const m=mapData(mapOrId),dx=Math.cos(angle),dy=Math.sin(angle);
    let mx=Math.floor(x),my=Math.floor(y);
    const ddx=Math.abs(dx)<1e-9?Infinity:Math.abs(1/dx),ddy=Math.abs(dy)<1e-9?Infinity:Math.abs(1/dy);
    const sx=dx<0?-1:1,sy=dy<0?-1:1;
    let sdx=dx<0?(x-mx)*ddx:(mx+1-x)*ddx,sdy=dy<0?(y-my)*ddy:(my+1-y)*ddy,dist=0;
    while(dist<=maxDistance){
      if(sdx<sdy){mx+=sx;dist=sdx;sdx+=ddx}else{my+=sy;dist=sdy;sdy+=ddy}
      if(dist>maxDistance)break;
      if(my<0||mx<0||my>=m.grid.length||mx>=m.grid[0].length||m.grid[my][mx]==='#')return{distance:dist,x:x+dx*dist,y:y+dy*dist,hit:true};
    }
    return{distance:maxDistance,x:x+dx*maxDistance,y:y+dy*maxDistance,hit:false};
  }

  function lineOfSight(mapOrId,a,b){const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);if(dist<.001)return true;const hit=raycast(mapOrId,a.x,a.y,Math.atan2(dy,dx),dist);return !hit.hit||hit.distance>=dist-.03}
  function cellKey(x,y){return`${x},${y}`}
  function parseKey(k){const[x,y]=k.split(',').map(Number);return{x,y}}
  function findPath(mapOrId,from,to,limit=900){const m=mapData(mapOrId),sx=Math.floor(from.x),sy=Math.floor(from.y),tx=Math.floor(to.x),ty=Math.floor(to.y);if(sx===tx&&sy===ty)return[];const q=[[sx,sy]],prev=new Map([[cellKey(sx,sy),null]]),dirs=[[1,0],[-1,0],[0,1],[0,-1]];let qi=0,found=null;while(qi<q.length&&qi<limit){const[x,y]=q[qi++];for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy,key=cellKey(nx,ny);if(nx<0||ny<0||ny>=m.grid.length||nx>=m.grid[0].length||m.grid[ny][nx]==='#'||prev.has(key))continue;prev.set(key,cellKey(x,y));if(nx===tx&&ny===ty){found=key;qi=q.length;break}q.push([nx,ny])}}if(!found)return[];const path=[];let k=found;while(k&&k!==cellKey(sx,sy)){const p=parseKey(k);path.push({x:p.x+.5,y:p.y+.5});k=prev.get(k)}path.reverse();return path}
  function angleDelta(a,b){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d}
  function validateMaps(){const issues=[];for(const m of Object.values(MAPS)){const w=m.grid[0].length;if(m.grid.length<16)issues.push(`${m.id}: too short`);if(m.grid.some(r=>r.length!==w))issues.push(`${m.id}: inconsistent row width`);if(spawns(m,TEAM_BLUE).length<4)issues.push(`${m.id}: blue spawns`);if(spawns(m,TEAM_RED).length<4)issues.push(`${m.id}: red spawns`);const a=spawns(m,TEAM_BLUE)[0],b=spawns(m,TEAM_RED)[0];if(a&&b&&!findPath(m,a,b).length)issues.push(`${m.id}: teams disconnected`)}return issues}

  const api={TEAM_BLUE,TEAM_RED,TILE,PLAYER_SPEED,MAPS,BOT_NAMES,WEAPON,mapData,dimensions,cell,isWall,spawns,randomSpawn,canStand,lineOfSight,raycast,findPath,angleDelta,validateMaps};
  globalThis.BoomChiuCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
