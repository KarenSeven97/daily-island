// Native SVG and presentation-contract tests. Not a substitute for real-browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshDB,ensureDay,addTask,startDay,completeTask} from '../dist/model.js';
import {project,renderScene} from '../dist/scene.js';

function fixture(count=5){
  const d=ensureDay(freshDB(),'2026-10-17');
  const grades=['S','A','B','C','F'];
  for(let i=0;i<count;i++){const t=addTask(d,`任务 ${i}`,i<5?grades[i]:'B');t.id=`visual-${i}`;}
  return d;
}
test('isometric projection preserves the MVP coordinate system exactly',()=>{
  assert.deepEqual(project(0,0),{x:0,y:0});
  assert.deepEqual(project(1,0),{x:68,y:34});
  assert.deepEqual(project(0,1),{x:-68,y:34});
  assert.deepEqual(project(-3,2),{x:-340,y:-34});
});
test('planning keeps the theme concealed with one neutral starting tile',()=>{
  const d=fixture(),before=JSON.stringify(d),svg=renderScene(d);
  assert.equal((svg.match(/data-tile=/g)||[]).length,1);
  assert.doesNotMatch(svg,/class="blueprint"|class="architecture"|class="window-light"/);
  assert.equal(JSON.stringify(d),before);
});
test('pending work has no preview overlay and only completed work generates solid land',()=>{
  const d=fixture();startDay(d);completeTask(d,d.tasks[0].id);
  const before=JSON.stringify(d),svg=renderScene(d);
  assert.doesNotMatch(svg,/blueprint|dock-marker|码头/);
  assert.equal((svg.match(/data-tile=/g)||[]).length,2);
  assert.match(svg,/class="shoreline"/);assert.equal(JSON.stringify(d),before);
  d.tasks.slice(1).forEach(t=>completeTask(d,t.id));
  assert.doesNotMatch(renderScene(d),/class="blueprint"/);
  assert.equal((renderScene(d).match(/data-tile=/g)||[]).length,6);
});
test('ground selection precedes architecture and decorative sea life cannot intercept input',()=>{
  const d=fixture();startDay(d);completeTask(d,d.tasks[0].id);
  const svg=renderScene(d,{selectedId:d.tasks[0].id});
  const tile=svg.slice(svg.indexOf('data-tile="0,0"'));
  assert.ok(tile.indexOf('class="tile-outline"')<tile.indexOf('class="architecture"'));
  assert.match(svg,/class="sea-life water-life"[^>]*pointer-events="none"/);
  assert.match(svg,/class="sea-life sky-life"[^>]*pointer-events="none"/);
  assert.match(svg,/class="fish-jump"/);assert.match(svg,/class="gull-flight"/);assert.match(svg,/class="shore-surge/);
});
test('scene and reveal IDs are unique; selection, growth and labels target the correct tile',()=>{
  const d=fixture();d.tasks[0].name='<img onerror="bad()"> & task';startDay(d);completeTask(d,d.tasks[0].id);
  const map=renderScene(d,{newId:d.tasks[0].id,selectedId:d.tasks[0].id});
  const reveal=renderScene(d,{idPrefix:'reveal',showPlayer:false});
  const ids=[...(map+reveal).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal((map.match(/land-new/g)||[]).length,1);
  assert.equal((map.match(/land-selected/g)||[]).length,1);
  assert.match(map,/&lt;img onerror=&quot;bad\(\)&quot;&gt; &amp; task/);
  assert.doesNotMatch(map,/<img/);assert.doesNotMatch(reveal,/islander-body/);
});
test('all asset grades and large islands render finite coordinates without mutating data',()=>{
  const d=fixture(120);startDay(d);d.tasks.forEach(t=>completeTask(d,t.id));
  const before=JSON.stringify(d),svg=renderScene(d);
  assert.equal((svg.match(/data-tile=/g)||[]).length,121);
  for(const label of ['海风灯塔','庭院书屋','树荫庭院','海边花圃','休憩草地'])assert.ok(svg.includes(label));
  assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
  assert.equal(JSON.stringify(d),before);
});
test('essential text palette meets 4.5:1 contrast; responsive and reduced-motion rules exist',()=>{
  const css=readFileSync(new URL('../dist/visual.css',import.meta.url),'utf8');
  const luminance=hex=>{
    const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  for(const [fg,bg] of [['294b46','fffef8'],['61756b','fffef8'],['fffdf2','34685c']]){
    const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    assert.ok(ratio>=4.5,`${fg} / ${bg}: ${ratio.toFixed(2)}`);
  }
  for(const width of [1100,1000,740,360])assert.ok(css.includes(`max-width: ${width}px`));
  assert.match(css,/prefers-reduced-motion: reduce/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/:focus-visible/);
});

