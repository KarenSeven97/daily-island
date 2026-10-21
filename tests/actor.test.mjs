import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTOR_LANE,depthPoint,compareDepth,placeActor} from '../dist/actor-depth.js';
import {createIdle,fishingEdge,IDLE_ACTIONS} from '../dist/idle.js';
import {renderScene} from '../dist/scene.js';

const day={started:true,tasks:[{id:'s',name:'灯塔',grade:'S',done:true},{id:'a',name:'书屋',grade:'A',done:true}],tiles:[{x:1,y:0,grade:'S',taskId:'s'},{x:0,y:1,grade:'A',taskId:'a'}]};
test('foreground contains each building once, after all ground; actor is behind nearer architecture',()=>{
  const svg=renderScene(day,{player:{x:0,y:0}}),actor=svg.indexOf('id="islander"');
  assert.equal((svg.match(/class="architecture-layer"/g)||[]).length,3);
  assert.equal((svg.match(/home-cottage/g)||[]).length,1);
  assert.ok(svg.lastIndexOf('data-tile=')<svg.indexOf('class="depth-layer"'));
  assert.ok(actor>svg.indexOf('data-depth-y="0"'));
  assert.ok(actor<svg.indexOf('data-depth-y="34"'));
  assert.equal((svg.match(/id="islander"/g)||[]).length,1);
  const front=renderScene(day,{player:{x:1,y:1}});
  assert.ok(front.indexOf('id="islander"')>front.lastIndexOf('data-depth-y="34"'));
});
test('home silhouette is distinct from A library and remains unrevealed during planning',()=>{
  const svg=renderScene(day);
  assert.match(svg,/home-cottage/);assert.match(svg,/Q-27-59 0-63/);
  assert.match(svg,/M-33-44L0-61/); // A's angular roof remains unchanged.
  assert.doesNotMatch(renderScene({started:false,tasks:[],tiles:[]}),/home-cottage/);
});
test('depth uses continuously interpolated foot position, including negative coordinates and ties',()=>{
  assert.deepEqual(depthPoint({x:-.25,y:.75}),{x:-68,y:17});
  assert.ok(compareDepth(depthPoint({x:0,y:0}),depthPoint({x:.01,y:0}))<0);
  assert.ok(compareDepth(depthPoint({x:0,y:1}),depthPoint({x:1,y:0}))<0);
});
test('live ordering moves the existing actor only when it crosses an occluder',()=>{
  const layer={children:[],calls:0,insertBefore(node,next){this.calls++;const old=this.children.indexOf(node);if(old>=0)this.children.splice(old,1);this.children.splice(next?this.children.indexOf(next):this.children.length,0,node);node.parentNode=this;}};
  const building=(y,x)=>({dataset:{depthY:y,depthX:x}}),a=building(0,0),b=building(34,68),actor={};
  Object.defineProperty(actor,'nextElementSibling',{get(){return layer.children[layer.children.indexOf(actor)+1]||null;}});
  layer.children=[a,b];placeActor(actor,layer,{x:0,y:0});assert.deepEqual(layer.children,[a,actor,b]);
  placeActor(actor,layer,{x:.1,y:0});assert.equal(layer.calls,1);
  placeActor(actor,layer,{x:1,y:0});assert.deepEqual(layer.children,[a,b,actor]);
  placeActor(actor,layer,{x:-1,y:0});assert.deepEqual(layer.children,[actor,a,b]);
});
test('the walking lane stays in front of each tile and delays rearward occlusion until its edge',()=>{
  assert.deepEqual(ACTOR_LANE,{x:0,y:18});
  const layer={children:[],insertBefore(node,next){const old=this.children.indexOf(node);if(old>=0)this.children.splice(old,1);this.children.splice(next?this.children.indexOf(next):this.children.length,0,node);node.parentNode=this;}};
  const rear={dataset:{depthY:'0',depthX:'0'}},front={dataset:{depthY:'34',depthX:'68'}},actor={};
  Object.defineProperty(actor,'nextElementSibling',{get(){return layer.children[layer.children.indexOf(actor)+1]||null;}});
  layer.children=[rear,front];placeActor(actor,layer,{x:1,y:0},ACTOR_LANE);assert.deepEqual(layer.children,[rear,front,actor]);
  placeActor(actor,layer,{x:.5,y:0},ACTOR_LANE);assert.deepEqual(layer.children,[rear,front,actor]);
  placeActor(actor,layer,{x:.2,y:0},ACTOR_LANE);assert.deepEqual(layer.children,[rear,actor,front]);
});
function idleHarness(){
  let id=0,clock=0,poses=[];const frames=new Map();
  const idle=createIdle({onUpdate:p=>poses.push(p),requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:id=>frames.delete(id)});
  return {idle,frames,poses,advance(ms){for(let n=0;n<ms;n+=16){clock+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(clock));}}};
}
test('idle cycles through rest, fish and look without moving feet or mutating the day',()=>{
  const h=idleHarness(),snapshot=JSON.stringify(day);
  for(const action of IDLE_ACTIONS){assert.equal(h.idle.start(day,{x:1,y:0}),action);h.advance(500);assert.deepEqual(h.poses.at(-1).offset,{x:0,y:0});h.advance(7500);assert.equal(h.idle.active,false);assert.equal(h.frames.size,0);}
  assert.equal(JSON.stringify(day),snapshot);
});
test('fishing faces an empty front neighbour; interior land falls back to looking',()=>{
  const center={x:0,y:0};assert.equal(fishingEdge(day,center),null);
  const h=idleHarness();h.idle.start(day,center);assert.equal(h.idle.start(day,center),'look');
  assert.equal(fishingEdge(day,{x:1,y:0}).facing,1);
  assert.equal(fishingEdge({tiles:[{x:1,y:0}]},center).facing,-1);
  assert.equal(fishingEdge(day,{x:3,y:3}),null);
});
test('idle cancellation clears scheduled frames and resets props; restart has a new timeline',()=>{
  const h=idleHarness();h.idle.start(day,{x:1,y:0});h.advance(500);h.idle.cancel();
  assert.equal(h.frames.size,0);assert.equal(h.poses.at(-1),null);assert.equal(h.idle.active,false);
  h.idle.start(day,{x:1,y:0});assert.equal(h.poses.at(-1).phase,0);assert.equal(h.poses.at(-1).strength,0);
  h.advance(600);assert.equal(h.poses.at(-1).strength,1);
});

