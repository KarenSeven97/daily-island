// Presentation geometry only: trace the existing cells, never allocate new land.
const key=p=>`${p.x},${p.y}`;
export function coastEdges(tiles){
  const occupied=new Set(tiles.map(key)),edges=[];
  for(const {x,y} of tiles){
    const corners=[{x:x-.5,y:y-.5},{x:x+.5,y:y-.5},{x:x+.5,y:y+.5},{x:x-.5,y:y+.5}];
    [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy],i)=>{
      if(!occupied.has(key({x:x+dx,y:y+dy})))edges.push({from:corners[i],to:corners[(i+1)%4]});
    });
  }
  return edges;
}
export function coastPath(tiles,depth=22){
  const edges=coastEdges(tiles),unused=new Set(edges),starts=new Map();
  for(const edge of edges){const k=key(edge.from);if(!starts.has(k))starts.set(k,[]);starts.get(k).push(edge);}
  const point=p=>`${(p.x-p.y)*68} ${(p.x+p.y)*34+depth}`;
  const paths=[];
  while(unused.size){
    let edge=unused.values().next().value;const first=key(edge.from),parts=[`M${point(edge.from)}`];
    while(edge&&unused.has(edge)){
      unused.delete(edge);parts.push(`L${point(edge.to)}`);
      if(key(edge.to)===first){parts.push('Z');break;}
      const next=(starts.get(key(edge.to))||[]).filter(e=>unused.has(e));
      // At a corner shared by two contours, follow the right-hand boundary.
      const dx=edge.to.x-edge.from.x,dy=edge.to.y-edge.from.y;
      next.sort((a,b)=>{
        const turn=e=>Math.atan2(dx*(e.to.y-e.from.y)-dy*(e.to.x-e.from.x),dx*(e.to.x-e.from.x)+dy*(e.to.y-e.from.y));
        return turn(b)-turn(a);
      });
      edge=next[0];
    }
    paths.push(parts.join(' '));
  }
  return paths.join(' ');
}

