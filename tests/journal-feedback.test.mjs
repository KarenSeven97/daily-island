import test from 'node:test';
import assert from 'node:assert/strict';
import {weekLayout,clearWater} from '../dist/journal-layout.js';
import {shiftDate} from '../dist/journal-model.js';
import {samplePlan,createRouteVoyage} from '../dist/voyage.js';
import {daysInMonth,clampDateParts} from '../dist/journal-date.js';
import {starRating} from '../dist/journal-stars.js';
import {ISLAND_CATALOG} from '../dist/journal-art.js';

test('each island berth is on its own drawn shoreline and routes stop at that exact point',()=>{
  for(const shape of ISLAND_CATALOG){
    const sampled=shape.boundary.reduce((best,p)=>p.y>best.y?p:best,shape.boundary[0]);
    assert.ok(shape.berth.y>=sampled.y-1e-8);assert.ok(shape.berth.y-sampled.y<.05);
    assert.ok(Math.hypot(shape.berth.x-sampled.x,shape.berth.y-sampled.y)<1.2);
  }
  const layout=weekLayout('2026-10-19');
  layout.islands.forEach((p,i)=>{const berth=ISLAND_CATALOG[p.style].berth;assert.deepEqual(layout.docks[i],{x:p.x+berth.x,y:p.y+berth.y});});
});

test('weekly charts vary by week and reproduce exactly without changing date rules',()=>{
  const first=weekLayout('2026-10-19');assert.deepEqual(first,weekLayout('2026-10-25'));
  const next=weekLayout('2026-10-26');assert.notDeepEqual(first.islands,next.islands);assert.notDeepEqual(first.routes,next.routes);assert.notDeepEqual(first.decorations,next.decorations);
  assert.equal(first.islands.length,7);assert.equal(new Set(first.islands.map(p=>p.style)).size,7);
});
test('104 generated weeks keep smooth routes clear of land and limit all ocean scenery to four',()=>{
  for(let week=0;week<104;week++){
    const layout=weekLayout(shiftDate('2026-01-05',week*7));assert.equal(layout.routes.length,6);assert.ok(layout.decorations.length>=1&&layout.decorations.length<=4);
    const curves=layout.routes.flat();
    for(let j=1;j<curves.length;j++){
      const a=curves[j-1],b=curves[j],u={x:a.to.x-a.control2.x,y:a.to.y-a.control2.y},v={x:b.control1.x-b.from.x,y:b.control1.y-b.from.y};
      assert.deepEqual(a.to,b.from);assert.ok(u.x*v.x+u.y*v.y>0);assert.ok(Math.abs(u.x*v.y-u.y*v.x)<1e-7,'adjacent curve tangents match');
    }
    for(let i=0;i<6;i++){
      assert.deepEqual(layout.routes[i][0].from,layout.docks[i]);assert.deepEqual(layout.routes[i].at(-1).to,layout.docks[i+1]);
      for(const plan of layout.routes[i])for(let j=0;j<=150;j++)assert.ok(clearWater(samplePlan(plan,j/150),layout.islands),layout.week);
    }
    for(let i=0;i<7;i++)for(let j=i+1;j<7;j++)assert.ok(Math.hypot(layout.islands[i].x-layout.islands[j].x,layout.islands[i].y-layout.islands[j].y)>200);
  }
});
test('every week starts upper-left and preserves the seven-day clockwise order with bounded offsets',()=>{
  const slots=[[140,190],[380,190],[620,190],[860,190],[800,430],[540,430],[280,430]];
  for(let i=0;i<1040;i++){
    const {islands}=weekLayout(shiftDate('2020-01-06',i*7));
    islands.forEach((p,j)=>{assert.ok(Math.abs(p.x-slots[j][0])<=13);assert.ok(Math.abs(p.y-slots[j][1])<=14);});
    for(let j=0;j<3;j++)assert.ok(islands[j].x<islands[j+1].x);
    assert.ok(Math.max(...islands.slice(0,4).map(p=>p.y))<Math.min(...islands.slice(4).map(p=>p.y)));
    assert.ok(islands[4].x>islands[5].x&&islands[5].x>islands[6].x);
  }
});
test('ship follows generated curve segments in both directions and stops at the correct docks',()=>{
  const l=weekLayout('2026-10-19'),frames=new Map();let id=0,position;
  const ship=createRouteVoyage({points:l.docks,routes:l.routes,requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:id=>frames.delete(id),onUpdate:p=>{position=p;assert.ok(clearWater(p,l.islands));}});
  ship.reset(0);ship.moveTo(6);for(let t=0;t<=2400;t+=12){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));}
  assert.deepEqual(position,l.docks[6]);ship.moveTo(0);for(let t=3000;t<=5400;t+=12){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));}
  assert.deepEqual(position,l.docks[0]);assert.equal(frames.size,0);
});
test('date wheel clamps leap days, month lengths and supported year bounds',()=>{
  assert.equal(daysInMonth(2000,2),29);assert.equal(daysInMonth(2100,2),28);
  assert.deepEqual(clampDateParts({year:2024,month:2,day:31}),{year:2024,month:2,day:29});
  assert.deepEqual(clampDateParts({year:2025,month:2,day:29}),{year:2025,month:2,day:28});
  assert.deepEqual(clampDateParts({year:0,month:0,day:0}),{year:1,month:1,day:1});
  assert.deepEqual(clampDateParts({year:10000,month:13,day:32}),{year:9998,month:12,day:31});
});
test('engraved star artwork consistently distinguishes zero to three earned stars',()=>{
  for(let i=0;i<=3;i++){const svg=starRating(i);assert.equal((svg.match(/is-earned/g)||[]).length,i);assert.equal((svg.match(/is-unlit/g)||[]).length,3-i);assert.doesNotMatch(svg,/★|☆/);}
  assert.equal((starRating(3,true).match(/is-earned/g)||[]).length,0);
});

