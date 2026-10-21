// Shared foot-point ordering for the initial SVG and live character movement.
// Screen Y is depth; screen X is a stable tie-breaker. Terrain stays below this layer.
// The actor walks along the front lane of each tile instead of through its building.
export const ACTOR_LANE=Object.freeze({x:0,y:18});
export function depthPoint(position,offset={x:0,y:0}){
  return {y:(position.x+position.y)*34+(offset.y||0),x:(position.x-position.y)*68+(offset.x||0)};
}
export function compareDepth(a,b){return a.y-b.y||a.x-b.x;}
export function placeActor(actor,layer,position,offset={x:0,y:0}){
  if(!actor||!layer)return;
  const depth=depthPoint(position,{x:offset.x,y:(offset.y||0)+5});
  const next=Array.from(layer.children).find(node=>node!==actor&&compareDepth({y:Number(node.dataset.depthY),x:Number(node.dataset.depthX)},depth)>0)||null;
  if(actor.parentNode!==layer||actor.nextElementSibling!==next)layer.insertBefore(actor,next);
}

