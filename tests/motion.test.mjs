import test from 'node:test';
import assert from 'node:assert/strict';
import {createTraveler} from '../dist/motion.js';
import {pathTo} from '../dist/model.js';

const day={tiles:[{x:1,y:0},{x:2,y:0},{x:2,y:1},{x:2,y:2},{x:1,y:2},{x:0,y:2}]};
function simulation(){
  let now=0,id=0;const frames=new Map(),samples=[];
  const traveler=createTraveler({onUpdate:(p,s)=>samples.push({p,s}),requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:id=>frames.delete(id)});
  const tick=dt=>{now+=dt;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
  return {traveler,samples,tick,advance(ms){for(let left=ms;left>0;left-=16)tick(Math.min(left,16));},frames};
}
function onSegment(p,a,b){return Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;}
test('every running frame follows connected path segments around a gap',()=>{
  const s=simulation(),target={x:0,y:2},route=[{x:0,y:0},...pathTo(day,{x:0,y:0},target)];
  s.traveler.go(day,target,'running');s.advance(4000);
  assert.deepEqual(s.traveler.position,target);assert.equal(s.traveler.active,false);
  for(const {p} of s.samples)assert.ok(route.slice(1).some((b,i)=>onSegment(p,route[i],b)),JSON.stringify(p));
});
test('switching from walking to running preserves position and accelerates the current edge',()=>{
  const s=simulation();s.traveler.go(day,{x:2,y:0},'walking');s.advance(176);
  const before=s.traveler.position;assert.ok(before.x>0&&before.x<1);
  s.traveler.go(day,{x:2,y:0},'running');assert.deepEqual(s.traveler.position,before);
  s.advance(300);assert.ok(s.traveler.position.x>=1);assert.equal(s.traveler.state.gait,'running');
});
test('rapid retargeting does not snap and finishes on the final clicked tile',()=>{
  const s=simulation();s.traveler.go(day,{x:0,y:2},'running');s.advance(160);
  const before=s.traveler.position;
  for(const target of [{x:2,y:0},{x:1,y:2},{x:0,y:0}]){s.traveler.go(day,target,'running');assert.deepEqual(s.traveler.position,before);}
  s.advance(2000);assert.deepEqual(s.traveler.position,{x:0,y:0});assert.equal(s.frames.size,0);
});
test('invalid targets preserve the current journey; resets cancel scheduled movement',()=>{
  const s=simulation();s.traveler.go(day,{x:2,y:0},'walking');s.advance(160);
  const before=s.traveler.position;assert.equal(s.traveler.go(day,{x:1,y:1},'running'),false);assert.deepEqual(s.traveler.position,before);
  s.traveler.reset();s.advance(2000);assert.deepEqual(s.traveler.position,{x:0,y:0});assert.equal(s.frames.size,0);
});
test('resuming after a long frame gap advances by a bounded distance',()=>{
  const s=simulation();s.traveler.go(day,{x:2,y:0},'running');s.advance(100);const before=s.traveler.position;
  s.tick(60000);assert.ok(s.traveler.position.x-before.x<=64/340+1e-7);
});

