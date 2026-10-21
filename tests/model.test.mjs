import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDB,ensureDay,addTask,editTask,deleteTask,startDay,completeTask,settleDay,rollover,pathTo,validateDB,unlocked,THEME,pickTile} from '../dist/model.js';
import {renderScene} from '../dist/scene.js';
const make=()=>{const db=freshDB();return [db,ensureDay(db,'2026-10-16')];};
test('planning does not reveal a theme; S is required and unique',()=>{
  const [,d]=make();assert.equal(d.themeId,null);assert.throws(()=>startDay(d));assert.throws(()=>addTask(d,' ','S'));
  addTask(d,'重要行动','S');assert.throws(()=>addTask(d,'第二件','S'));startDay(d);assert.equal(d.themeId,THEME.id);
  assert.throws(()=>addTask(d,'第二件','S'));assert.equal(startDay(d),false);
});
test('planning can edit grades and delete without moving land',()=>{
  const [,d]=make();const s=addTask(d,'S','S'),a=addTask(d,'A','A');
  assert.throws(()=>editTask(d,a.id,'A','S'));editTask(d,a.id,'更新名称','B');assert.equal(a.grade,'B');deleteTask(d,a.id);assert.equal(d.tasks.length,1);
  startDay(d);completeTask(d,s.id);assert.throws(()=>deleteTask(d,s.id));assert.throws(()=>editTask(d,s.id,'x','A'));
});
test('ordinary tasks can complete before S; S alone unlocks exploration',()=>{
  const [,d]=make(),s=addTask(d,'S','S'),b=addTask(d,'B','B');assert.throws(()=>completeTask(d,b.id));startDay(d);
  completeTask(d,b.id);assert.equal(unlocked(d),false);completeTask(d,s.id);assert.equal(unlocked(d),true);assert.equal(d.tiles.length,2);
  assert.equal(completeTask(d,s.id),null);assert.equal(d.tiles.length,2);
});
test('adding ordinary tasks after start preserves every generated coordinate',()=>{
  const [,d]=make(),s=addTask(d,'S','S');startDay(d);completeTask(d,s.id);const old=JSON.stringify(d.tiles);
  for(const g of ['A','B','C','F'])addTask(d,g,g);assert.equal(JSON.stringify(d.tiles),old);
});
test('500 completion orders retain a connected, unique map and task associations',()=>{
  for(let trial=0;trial<500;trial++){
    const [db,d]=make();addTask(d,'S','S');for(let i=0;i<24;i++)addTask(d,`行动${i}`,['A','B','C','F'][i%4]);startDay(d);
    let seed=trial+1;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const order=[...d.tasks];for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    const before=[];for(const t of order){completeTask(d,t.id);assert.deepEqual(d.tiles.slice(0,-1),before);before.push({...d.tiles.at(-1)});}
    validateDB(db);assert.equal(new Set(d.tiles.map(t=>`${t.x},${t.y}`)).size,25);
    for(const p of d.tiles){const path=pathTo(d,{x:0,y:0},p);assert.ok(path.length);assert.deepEqual(path.at(-1),{x:p.x,y:p.y});}
  }
});
test('grade direction preferences operate inside connectivity constraints',()=>{
  const [,d]=make(),s=pickTile(d,'S','a'),a=pickTile(d,'A','a'),b=pickTile(d,'B','a');
  assert.ok(s.x-s.y>0);assert.ok(a.x-a.y>0);assert.ok(Math.abs(b.x+b.y)>0);
});
test('settlement and late records retain unknown actual time honestly',()=>{
  const [db,d]=make(),s=addTask(d,'S','S');startDay(d);settleDay(d);assert.throws(()=>addTask(d,'new','A'));assert.throws(()=>completeTask(d,s.id));
  completeTask(d,s.id,{late:true,completedAt:null,now:'2026-10-18T12:00:00Z'});assert.equal(s.completedAt,null);assert.equal(s.recordedAt,'2026-10-18T12:00:00Z');assert.ok(s.late);validateDB(db);
});
test('history supplement cannot move old land or alter today',()=>{
  const [db,d]=make(),s=addTask(d,'S','S'),a=addTask(d,'A','A');startDay(d);completeTask(d,s.id);const old={...d.tiles[0]};
  rollover(db,'2026-10-17');const current=JSON.stringify(db.days['2026-10-17']);completeTask(d,a.id,{late:true,completedAt:'2026-10-16T08:00:00Z'});
  assert.deepEqual(d.tiles[0],old);assert.equal(JSON.stringify(db.days['2026-10-17']),current);assert.equal(d.themeId,THEME.id);validateDB(db);
});
test('planned but unstarted prior day can supplement existing S and reveal theme',()=>{
  const [db,d]=make(),s=addTask(d,'S','S');rollover(db,'2026-10-17');completeTask(d,s.id,{late:true});assert.equal(d.themeId,THEME.id);assert.ok(d.ended);validateDB(db);
});
test('date rollover settles planned and empty dates and is idempotent',()=>{
  const [db,d]=make();addTask(d,'S','S');assert.ok(rollover(db,'2026-10-17'));assert.ok(d.ended);assert.equal(rollover(db,'2026-10-17'),false);assert.equal(db.days['2026-10-17'].tasks.length,0);
});
test('serialization restores exact state and theme',()=>{
  const [db,d]=make(),s=addTask(d,'S','S');startDay(d);completeTask(d,s.id);db.preferences.lighting='night';const restored=validateDB(JSON.parse(JSON.stringify(db)));assert.deepEqual(restored,db);
});
test('corrupt storage associations or disconnected coordinates are rejected',()=>{
  const [db,d]=make(),s=addTask(d,'S','S');startDay(d);completeTask(d,s.id);d.tiles[0].x=400;assert.throws(()=>validateDB(db));
});
test('scene omits removed overlays; task text is escaped; tiles support keyboard input',()=>{
  const [,d]=make(),s=addTask(d,'<img src=x onerror=alert(1)>','S');addTask(d,'A','A');startDay(d);let svg=renderScene(d);
  assert.doesNotMatch(svg,/blueprint|dock-marker|码头/);completeTask(d,s.id);svg=renderScene(d);assert.ok(svg.includes('&lt;img'));assert.ok(!svg.includes('<img'));assert.ok(svg.includes('tabindex="0"'));
  assert.ok(svg.includes(THEME.colors.roof));assert.ok(svg.includes(THEME.colors.grass));
});
test('large islands remain inside the scene camera',()=>{
  const [,d]=make();const s=addTask(d,'S','S');startDay(d);completeTask(d,s.id);
  for(let i=0;i<200;i++){const t=addTask(d,`t${i}`,'A');completeTask(d,t.id);}
  const svg=renderScene(d);assert.ok(!svg.includes('NaN'));assert.equal((svg.match(/data-tile=/g)||[]).length,202);
});

