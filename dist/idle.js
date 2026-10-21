// Ephemeral relaxation only: never writes tasks, tiles, preferences or storage.
export const IDLE_ACTIONS=['rest','fish','look'];
export function fishingEdge(day,position){
  const occupied=new Set(['0,0',...day.tiles.map(p=>`${p.x},${p.y}`)]);
  if(!occupied.has(`${position.x},${position.y}`))return null;
  // Only front-facing coast edges: the rod and line must finish over water.
  for(const [dx,dy,facing] of [[1,0,1],[0,1,-1]]){
    if(!occupied.has(`${position.x+dx},${position.y+dy}`))return {x:28*facing,y:18,facing};
  }
  return null;
}
export function createIdle({onUpdate,requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}){
  let pose=null,frame=null,last=null,elapsed=0,cycle=0;
  const emit=()=>onUpdate(pose?{...pose}:null);
  function cancel(){if(frame!==null)cancelFrame(frame);frame=null;pose=null;last=null;elapsed=0;emit();}
  function tick(time){
    frame=null;if(!pose)return;
    if(last!==null)elapsed+=Math.min(64,Math.max(0,time-last));last=time;
    if(elapsed>=pose.duration){cancel();return;}
    pose.phase=elapsed/1000;pose.strength=Math.min(1,elapsed/450,(pose.duration-elapsed)/450);emit();frame=requestFrame(tick);
  }
  return {
    get active(){return pose!==null;},
    start(day,position){
      cancel();const action=IDLE_ACTIONS[cycle++%IDLE_ACTIONS.length],edge=action==='fish'?fishingEdge(day,position):null;
      pose={action:action==='fish'&&!edge?'look':action,phase:0,strength:0,duration:action==='fish'&&edge?7000:5000,
        offset:{x:0,y:0},facing:edge?.facing||1};
      emit();frame=requestFrame(tick);return pose.action;
    },cancel
  };
}

