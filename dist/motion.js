import {pathTo} from './model.js';

// Movement remains on the model's four-neighbour path. All state here is ephemeral.
export const GAIT_DURATION={walking:800,running:340};
export function createTraveler({onUpdate,requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}){
  let cell={x:0,y:0},position={...cell},route=[],segment=null,frame=null,lastTime=null;
  let gait='idle',facing=1,phase=0;
  const emit=()=>onUpdate({...position},{gait,facing,phase});
  function begin(){
    if(!route.length){segment=null;gait='idle';emit();return;}
    segment={from:{...cell},to:route.shift(),elapsed:0,duration:GAIT_DURATION[gait]};
    const dx=segment.to.x-segment.from.x,dy=segment.to.y-segment.from.y;
    facing=dx-dy<0?-1:1;
  }
  function tick(time){
    frame=null;
    // Returning from a hidden tab never fast-forwards across the island.
    let dt=lastTime===null?0:Math.min(64,Math.max(0,time-lastTime));lastTime=time;
    if(!segment)begin();
    while(segment){
      const used=Math.min(dt,segment.duration-segment.elapsed);
      segment.elapsed+=used;dt-=used;phase+=used/segment.duration*Math.PI*4;
      const t=segment.elapsed/segment.duration;
      position={x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t};
      if(t<1)break;
      cell={...segment.to};position={...cell};begin();
      if(dt<=0)break;
    }
    emit();if(segment)frame=requestFrame(tick);else lastTime=null;
  }
  return {
    get active(){return Boolean(segment||route.length);},
    get state(){return {gait,facing,phase};},
    get position(){return {...position};},
    go(day,target,mode='walking'){
      if(!GAIT_DURATION[mode])throw Error('Unknown gait');
      // A redirected journey finishes its current connected edge first; no snapping.
      const anchor=segment?segment.to:cell;
      const next=pathTo(day,anchor,target);
      if(!next.length&&(anchor.x!==target.x||anchor.y!==target.y))return false;
      route=next;gait=mode;
      if(segment){
        const progress=segment.elapsed/segment.duration;
        segment.duration=GAIT_DURATION[mode];segment.elapsed=progress*segment.duration;
      }
      if(!segment)begin();
      if(segment&&frame===null){lastTime=null;frame=requestFrame(tick);}
      emit();return true;
    },
    reset(at={x:0,y:0}){
      if(frame!==null)cancelFrame(frame);
      cell={...at};position={...at};route=[];segment=null;frame=null;lastTime=null;gait='idle';phase=0;emit();
    }
  };
}

