import {ISLAND_CATALOG} from './journal-art.js';
import {weekStart} from './journal-model.js';
import {bezierPlan,samplePlan} from './voyage.js';

// Chronological reading order is fixed: upper-left Monday, clockwise to Sunday.
const SLOTS=[[140,190],[380,190],[620,190],[860,190],[800,430],[540,430],[280,430]];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function insideShore(point,island){
  const shape=ISLAND_CATALOG[island.style],x=point.x-island.x,y=point.y-island.y;
  if(y>=shape.berth.y-1e-6||y< -40||Math.abs(x)>75)return false;
  let inside=false;const polygon=shape.boundary;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
function randomFor(seed){
  let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);
  return ()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
// A berth may meet the illustrated coast; the route itself never cuts across land.
export function clearWater(point,islands){
  return point.x>=42&&point.x<=958&&point.y>=45&&point.y<=552
    && islands.every(p=>!insideShore(point,p))
    && Math.hypot(point.x-105,point.y-455)>75;
}
function coastalArc(from,to,dip,random){
  const middle={x:(from.x+to.x)/2,y:Math.max(from.y,to.y)+dip};
  const direction=Math.sign(to.x-from.x),reach=Math.abs(to.x-from.x)*(.16+random()*.035);
  // Every endpoint and midpoint has the same horizontal tangent. No corner fallback.
  return [bezierPlan(from,middle,{x:from.x+direction*reach,y:from.y},{x:middle.x-direction*reach,y:middle.y}),
    bezierPlan(middle,to,{x:middle.x+direction*reach,y:middle.y},{x:to.x-direction*reach,y:to.y})];
}
export function weekLayout(date){
  const week=weekStart(date),random=randomFor('island-chart-v3:'+week);
  const islands=SLOTS.map(([x,y])=>({x:Math.round(x+(random()-.5)*26),y:Math.round(y+(random()-.5)*28)}));
  const styles=ISLAND_CATALOG.map((_,i)=>i);
  for(let i=styles.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[styles[i],styles[j]]=[styles[j],styles[i]];}
  islands.forEach((p,i)=>{p.style=styles[i];});
  const docks=islands.map(p=>{const berth=ISLAND_CATALOG[p.style].berth;return {x:p.x+berth.x,y:p.y+berth.y};});
  const routes=docks.slice(1).map((point,i)=>{
    const from=docks[i];
    if(i===3){
      const edge=948+random()*9;
      const turn={x:edge,y:(from.y+point.y)/2},reach=62+random()*10;
      return [bezierPlan(from,turn,{x:edge,y:from.y},{x:edge,y:turn.y-reach}),
        bezierPlan(turn,point,{x:edge,y:point.y+80},{x:point.x+reach,y:point.y})];
    }
    const room=i<3?65:Math.max(8,548-Math.max(from.y,point.y));
    return coastalArc(from,point,Math.min(room,22+random()*37),random);
  });
  // Validate the actual shared render/animation curves instead of hiding unsafe corners.
  for(const route of routes)for(const plan of route)for(let i=0;i<=100;i++){
    if(!clearWater(samplePlan(plan,i/100),islands))throw Error('本周平滑航线越过海岸安全边界');
  }
  const samples=routes.flatMap(route=>route.flatMap(plan=>Array.from({length:30},(_,i)=>samplePlan(plan,i/29))));
  const kinds=['cloud','birds','reef','whale','buoy','monster','wreck','fish'];
  for(let i=kinds.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
  const decorations=[],budget=3+Math.floor(random()*2);
  for(let i=0;i<700&&decorations.length<budget;i++){
    const p={x:65+random()*870,y:55+random()*480};
    if(!clearWater(p,islands)||islands.some(q=>Math.abs(p.x-q.x)<120&&p.y-q.y>-155&&p.y-q.y<105)||samples.some(q=>distance(p,q)<48)||decorations.some(q=>distance(p,q)<120))continue;
    decorations.push({...p,kind:kinds[decorations.length],scale:.65+random()*.25});
  }
  return {week,islands,docks,routes,decorations};
}

