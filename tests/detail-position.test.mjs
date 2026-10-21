import test from 'node:test';
import assert from 'node:assert/strict';
import {detailPosition} from '../dist/detail-position.js';

const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
test('detail card chooses an adjacent side and never covers the selected tile',()=>{
  const container=rect(100,50,600,420),card=rect(0,0,180,86),anchor=rect(300,220,100,70);
  const p=detailPosition(anchor,container,card),absolute=rect(container.left+p.left,container.top+p.top,card.width,card.height);
  assert.equal(p.side,'right');assert.ok(absolute.left>=anchor.right);
});
test('detail card changes side near an edge and remains inside the scene',()=>{
  const container=rect(20,30,360,260),card=rect(0,0,190,90),anchor=rect(310,130,60,60);
  const p=detailPosition(anchor,container,card),absolute=rect(container.left+p.left,container.top+p.top,card.width,card.height);
  assert.equal(p.side,'left');assert.ok(absolute.left>=container.left+10);assert.ok(absolute.right<=container.right-10);
  assert.ok(absolute.top>=container.top+10);assert.ok(absolute.bottom<=container.bottom-10);
});

