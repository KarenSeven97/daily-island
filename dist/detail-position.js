const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));

// Places the detail card beside its tile. Candidates are scored before clamping so
// the card picks a side with real room instead of drifting back across the tile.
export function detailPosition(anchor,container,card,gap=12,padding=10){
  const width=card.width,height=card.height,cx=anchor.left+anchor.width/2,cy=anchor.top+anchor.height/2;
  const bounds={left:container.left+padding,right:container.right-padding,top:container.top+padding,bottom:container.bottom-padding};
  const candidates=[
    {side:'right',left:anchor.right+gap,top:cy-height/2},
    {side:'left',left:anchor.left-gap-width,top:cy-height/2},
    {side:'top',left:cx-width/2,top:anchor.top-gap-height},
    {side:'bottom',left:cx-width/2,top:anchor.bottom+gap}
  ];
  const overflow=c=>Math.max(0,bounds.left-c.left)+Math.max(0,c.left+width-bounds.right)+Math.max(0,bounds.top-c.top)+Math.max(0,c.top+height-bounds.bottom);
  const chosen=candidates.reduce((best,current)=>overflow(current)<overflow(best)?current:best);
  return {
    side:chosen.side,
    left:clamp(chosen.left,bounds.left,bounds.right-width)-container.left,
    top:clamp(chosen.top,bounds.top,bounds.bottom-height)-container.top
  };
}

