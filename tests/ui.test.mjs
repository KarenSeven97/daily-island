// Event-integration checks with a small DOM surface. These do not claim browser/layout QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localDate,freshDB,ensureDay,addTask,startDay,completeTask,settleDay,pathTo} from '../dist/model.js';
import {project} from '../dist/scene.js';
import {ACTOR_LANE} from '../dist/actor-depth.js';
import {sunPoint} from '../dist/lighting.js';
import {shiftDate,weekDates} from '../dist/journal-model.js';
const KEY='daily-island-v1';let serial=0;
async function harness(initial=null){
  const originals=Object.fromEntries(['document','window','localStorage','setTimeout','clearTimeout','setInterval','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
  const elements=new Map(),timers=new Map(),frames=new Map(),intervals=[],storage=new Map(initial?[[KEY,JSON.stringify(initial)]]:[]);let timer=0,frame=0,clock=0;
  const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
  class Element{
    constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.attributes={};this.children=[];this.parentNode=null;this.tagName='';this.style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};this.hidden=false;this.value='';this.checked=false;this.open=false;this.listeners={};this.isConnected=true;this.disabled=false;const cls=new Set();this.classList={add:(...values)=>values.forEach(x=>cls.add(x)),remove:(...values)=>values.forEach(x=>cls.delete(x)),toggle:(x,on)=>{const active=on??!cls.has(x);active?cls.add(x):cls.delete(x);return active;},contains:x=>cls.has(x)};}
    set innerHTML(value){
      const detach=node=>{for(const child of node.children)detach(child);if(node.id&&elements.get(node.id)===node)elements.delete(node.id);node.isConnected=false;};
      for(const child of this.children){detach(child);child.parentNode=null;}this.children=[];this.html=value;
      const stack=[this],voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
      for(const match of value.matchAll(/<\/?([a-zA-Z][\w:-]*)\b([^>]*)>/g)){
        const [raw,tag,attributes]=match;
        if(raw.startsWith('</')){if(stack.length>1)stack.pop();continue;}
        const node=new Element();node.tagName=tag.toLowerCase();
        for(const attr of attributes.matchAll(/([^\s=/'"<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(attr[1],attr[2]??attr[3]??attr[4]??'');
        stack.at(-1).appendChild(node);
        if(!raw.endsWith('/>')&&!voidTags.has(node.tagName))stack.push(node);
      }
    }
    get innerHTML(){return this.html||'';}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(listener=>listener!==fn);}
    dispatch(type,target=this,extra={}){const event={target,currentTarget:this,key:target.key,preventDefault(){},stopPropagation(){},...extra};for(const fn of this.listeners[type]||[])fn(event);if(type==='click')this.onclick?.(event);}
    matches(selector){
      if(selector.startsWith('#'))return this.id===selector.slice(1);
      if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
      const attr=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      if(attr){const value=attr[1].startsWith('data-')?this.dataset[dataKey(attr[1])]:this.getAttribute(attr[1]);return attr[2]===undefined?value!==undefined&&value!==null:value===attr[2];}
      return this.tagName===selector;
    }
    closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='id'){this.id=String(value);elements.set(this.id,this);}if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);if(name==='class')this.classList.add(...String(value).split(/\s+/).filter(Boolean));if(name==='value')this.value=String(value);if(['hidden','checked','disabled'].includes(name))this[name]=true;}
    getAttribute(name){return this.attributes[name]??null;}
    removeAttribute(name){delete this.attributes[name];if(name.startsWith('data-'))delete this.dataset[dataKey(name)];if(['hidden','checked','disabled'].includes(name))this[name]=false;}
    querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    contains(target){return target===this||this.children.some(child=>child.contains(target));}
    appendChild(node){return this.insertBefore(node,null);}
    insertBefore(node,next){
      if(next!==null&&next.parentNode!==this)throw Error('Reference node is not a child');
      if(node===next)return node;
      if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);
      const index=next===null?this.children.length:this.children.indexOf(next);
      this.children.splice(index,0,node);node.parentNode=this;node.isConnected=this.isConnected;return node;
    }
    get nextElementSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;}
    getBoundingClientRect(){return {left:0,top:0,width:320,height:160};}
    setPointerCapture(id){this.pointer=id;}hasPointerCapture(id){return this.pointer===id;}releasePointerCapture(id){if(this.pointer===id){this.pointer=null;this.dispatch('lostpointercapture');}}
    focus(){document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;}
  }
  const get=id=>elements.get(id)||null;
  globalThis.document=Object.assign(new Element('document'),{hidden:false,activeElement:null,getElementById:get});
  document.innerHTML=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');document.body=document.querySelector('body');
  globalThis.window={listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
  globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  globalThis.setTimeout=(fn)=>{timers.set(++timer,fn);return timer;};globalThis.clearTimeout=id=>timers.delete(id);globalThis.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};
  globalThis.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const cleanup=()=>{for(const [k,v]of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
  try{await import(`../dist/app.js?check=${++serial}`);}catch(error){cleanup();throw error;}
  return {get,storage,timers,intervals,frames,state:()=>JSON.parse(storage.get(KEY)),click:id=>get(id).dispatch('click'),
    advance(ms){const end=clock+ms;while(clock<end){clock=Math.min(end,clock+16);const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(clock));}},
    light:value=>value==='auto'?get('lightAuto').dispatch('click'):get('lightPanel').dispatch('click',new Element('',{lightPreset:value})),
    pointer:(type,x,y,id=1)=>get('sunArc').dispatch(type,get('sunArc'),{clientX:x,clientY:y,pointerId:id,button:0}),
    key:(id,key)=>get(id).dispatch('keydown',get(id),{key}),
    action:(action,extra={})=>get('panelContent').dispatch('click',new Element('',{action,...extra})),
    modal:(action,extra={})=>get('modal').dispatch('click',new Element('',{modal:action,...extra})),
    submit:(name,grade)=>{get('taskName').value=name;get('taskGrade').value=grade;get('panelContent').dispatch('submit',new Element('taskForm'));},
    tile:(x,y,extra={})=>get('mapHost').dispatch('click',new Element('',{tile:`${x},${y}`}),{timeStamp:clock,...extra}),
    doubleTile:(x,y)=>get('mapHost').dispatch('dblclick',new Element('',{tile:`${x},${y}`})),
    tileKey:(x,y,key,shiftKey=false)=>get('mapHost').dispatch('keydown',new Element('',{tile:`${x},${y}`}),{key,shiftKey}),
    journal(action,extra={}){
      const root=get('journalView'),target=root.querySelectorAll(`[data-journal="${action}"]`).find(node=>Object.entries(extra).every(([key,value])=>node.dataset[key]===value));
      assert.ok(target,`Journal action ${action} is present`);target.focus();root.dispatch('click',target);
    },
    island:index=>get('journalView').dispatch('click',get(`journalIsland${index}`)),
    islandKey:(index,key)=>get('journalView').dispatch('keydown',get(`journalIsland${index}`),{key}),
    dateOption(part,value){const target=get('journalDateDialog').querySelectorAll('[data-date-value]').find(node=>node.dataset.datePart===part&&Number(node.dataset.dateValue)===value);assert.ok(target);get('journalDateDialog').dispatch('click',target);},
    dateAction(action){const target=get('journalDateDialog').querySelector(`[data-date-action="${action}"]`);get('journalDateDialog').dispatch('click',target);},
    jump(date){get('journalView').dispatch('click',get('journalJump'));for(const [i,part] of ['year','month','day'].entries()){const target=get('journalDateDialog').querySelectorAll('[data-date-value]').find(node=>node.dataset.datePart===part&&Number(node.dataset.dateValue)===Number(date.split('-')[i]));assert.ok(target);get('journalDateDialog').dispatch('click',target);}get('journalDateDialog').dispatch('click',get('journalDateDialog').querySelector('[data-date-action="confirm"]'));},
    cleanup
  };
}
test('complete clickable MVP path: plan → reveal → ordinary land → S unlock → explore → settle → history',async()=>{
  const h=await harness();try{
    assert.match(h.get('themeBadge').innerHTML,/待揭晓/);assert.match(h.get('panelContent').innerHTML,/data-action="start" disabled/);
    h.action('addS');h.submit('完成第一版需求','S');h.action('addOrdinary');h.submit('读二十页书','B');let d=h.state().days[localDate()];assert.equal(d.tasks.length,2);
    h.action('start');assert.ok(h.get('modal').open);assert.match(h.get('modalContent').innerHTML,/海风庭院/);h.modal('close');
    h.action('complete',{id:d.tasks[1].id});d=h.state().days[localDate()];assert.equal(d.tiles.length,1);assert.match(h.get('exploreStatus').innerHTML,/完成 S/);
    h.tile(d.tiles[0].x,d.tiles[0].y);assert.match(h.get('toast').textContent,/先完成/);
    h.action('complete',{id:d.tasks[0].id});d=h.state().days[localDate()];assert.equal(d.tiles.length,2);assert.match(h.get('exploreStatus').innerHTML,/探索已解锁/);
    h.tile(d.tiles[1].x,d.tiles[1].y);assert.equal(h.get('tileDetail').hidden,true);h.doubleTile(d.tiles[1].x,d.tiles[1].y);assert.match(h.get('tileDetail').innerHTML,/完成第一版需求/);
    h.action('settle');assert.ok(h.get('modal').open);h.modal('confirmSettle');assert.equal(h.state().days[localDate()].ended,true);
    h.action('history');assert.equal(h.get('journalView').hidden,false);assert.equal(h.get('todayWorkspace').hidden,true);assert.match(h.get('journalDetail').innerHTML,/已完成/);h.action('openDay',{date:localDate()});assert.match(h.get('panelContent').innerHTML,/今天的手记/);
  }finally{h.cleanup();}
});
test('refresh restores task, theme, terrain coordinates and completed status',async()=>{
  const db=freshDB(),d=ensureDay(db,localDate()),s=addTask(d,'恢复测试','S');startDay(d);completeTask(d,s.id);const expected=JSON.stringify(d.tiles);
  const h=await harness(db);try{assert.equal(JSON.stringify(h.state().days[localDate()].tiles),expected);assert.match(h.get('themeBadge').innerHTML,/海风庭院/);assert.match(h.get('panelContent').innerHTML,/恢复测试/);assert.match(h.get('exploreStatus').innerHTML,/探索已解锁/);}finally{h.cleanup();}
});
test('historical supplement follows confirmation, preserves today and actual-time uncertainty',async()=>{
  const db=freshDB(),d=ensureDay(db,'2020-01-01'),s=addTask(d,'历史的重要行动','S');startDay(d);const h=await harness(db);
  try{const current=JSON.stringify(h.state().days[localDate()]);h.action('history');h.action('openDay',{date:'2020-01-01'});h.action('complete',{id:s.id});assert.ok(h.get('modal').open);assert.equal(h.get('unknownTime').checked,true);h.modal('confirmLate');const state=h.state();assert.equal(state.days['2020-01-01'].tiles.length,1);assert.equal(state.days['2020-01-01'].tasks[0].completedAt,null);assert.equal(JSON.stringify(state.days[localDate()]),current);assert.match(h.get('panelContent').innerHTML,/完成时间未知/);}finally{h.cleanup();}
});
test('edit, delete, grade restrictions and ordinary addition after departure are wired',async()=>{
  const h=await harness();try{h.action('addS');h.submit('原任务','S');let d=h.state().days[localDate()];h.action('edit',{id:d.tasks[0].id});h.submit('更新任务','S');h.action('addOrdinary');h.submit('将删除','B');d=h.state().days[localDate()];h.action('delete',{id:d.tasks[1].id});assert.equal(h.state().days[localDate()].tasks.length,1);h.action('start');h.modal('close');h.action('addOrdinary');h.submit('新行动','A');d=h.state().days[localDate()];assert.equal(d.tasks.length,2);assert.equal(d.tasks[0].name,'更新任务');assert.equal(d.themeId,'coastal-garden');}finally{h.cleanup();}
});
test('light settings persist; private local storage information is accessible',async()=>{
  const h=await harness();try{h.click('lightButton');h.light('night');assert.equal(h.get('scene').dataset.light,'night');assert.equal(h.state().preferences.lighting,'night');h.click('lightClose');h.click('privacyInfo');assert.match(h.get('modalContent').innerHTML,/不提供云同步/);}finally{h.cleanup();}
});

test('guest account window stays pending and never stores entered credentials',async()=>{
  const h=await harness();try{
    h.click('accountButton');
    assert.equal(h.get('accountDialog').open,true);
    assert.match(h.get('accountSyncStatus').textContent,/待传输/);
    h.get('accountUsername').value='island-friend';
    h.get('accountPassword').value='private-pass-123';
    h.get('accountForm').dispatch('submit');
    assert.match(h.get('accountMessage').textContent,/尚未完成登录或注册/);
    assert.equal(h.get('accountPassword').value,'');
    assert.deepEqual([...h.storage.keys()],[KEY]);
    assert.doesNotMatch(h.storage.get(KEY),/island-friend|private-pass-123/);
    h.click('accountGuest');
    h.action('addS');h.submit('访客任务','S');
    assert.equal(h.state().days[localDate()].tasks[0].name,'访客任务');
  }finally{h.cleanup();}
});

test('registration tab remains pending without a backend and local save survives refresh',async()=>{
  const h=await harness();try{
    h.click('accountButton');h.click('accountSignUpTab');
    assert.equal(h.get('accountSubmit').textContent,'注册');
    h.get('accountUsername').value='new-islander';
    h.get('accountPassword').value='another-pass-123';
    h.get('accountForm').dispatch('submit');
    assert.match(h.get('accountMessage').textContent,/待传输/);
    assert.equal(h.get('accountPassword').value,'');
    assert.doesNotMatch(h.storage.get(KEY),/new-islander|another-pass-123/);
  }finally{h.cleanup();}
});

test('new terrain animates once; selection does not replay growth or save visual state',async()=>{
  const db=freshDB(),d=ensureDay(db,localDate()),s=addTask(d,'点亮灯塔','S'),b=addTask(d,'整理桌面','B');startDay(d);
  const h=await harness(db);try{
    h.action('complete',{id:b.id});
    assert.equal((h.get('mapHost').innerHTML.match(/land-new/g)||[]).length,1);
    assert.equal(h.get('scene').dataset.feedback,'grow');
    h.action('complete',{id:s.id});
    assert.equal((h.get('mapHost').innerHTML.match(/land-new/g)||[]).length,1);
    assert.equal(h.get('scene').dataset.feedback,'unlock');
    const saved=h.storage.get(KEY),p=h.state().days[localDate()].tiles[1],terrain=h.get('mapHost').innerHTML,actor=h.get('islander');
    h.tile(p.x,p.y);
    assert.equal(h.get('mapHost').innerHTML,terrain);assert.equal(h.get('islander'),actor);
    assert.equal(h.storage.get(KEY),saved);
    assert.deepEqual(Object.keys(h.state()).sort(),['days','preferences','schemaVersion']);
  }finally{h.cleanup();}
});

test('walking updates the existing character only and leaves terrain and saved data intact',async()=>{
  const db=freshDB(),d=ensureDay(db,localDate());
  const tasks=Array.from({length:12},(_,i)=>addTask(d,`行走测试 ${i}`,i?'B':'S'));startDay(d);tasks.forEach(t=>completeTask(d,t.id));
  const target=[...d.tiles].sort((a,b)=>pathTo(d,{x:0,y:0},b).length-pathTo(d,{x:0,y:0},a).length)[0];
  assert.ok(pathTo(d,{x:0,y:0},target).length>1);
  const h=await harness(db);try{
    const saved=h.storage.get(KEY);h.tile(target.x,target.y);
    const actor=h.get('islander'),terrain=h.get('mapHost').innerHTML;
    assert.equal(actor.dataset.motion,'running');
    for(let i=0;i<500&&h.frames.size;i++){
      h.advance(16);
      assert.equal(h.get('islander'),actor);assert.equal(h.get('mapHost').innerHTML,terrain);
    }
    const p=project(target.x,target.y);
    assert.equal(actor.getAttribute('transform'),`translate(${p.x+ACTOR_LANE.x} ${p.y-6+ACTOR_LANE.y})`);
    assert.equal(actor.dataset.motion,'idle');assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});

test('all lighting modes preserve task history, tile coordinates and the saved schema',async()=>{
  const db=freshDB(),d=ensureDay(db,localDate()),s=addTask(d,'光照测试','S');startDay(d);completeTask(d,s.id);
  const h=await harness(db);try{
    const days=JSON.stringify(h.state().days);
    for(const value of ['morning','day','evening','night','auto']){
      h.click('lightButton');h.light(value);
      assert.equal(h.state().preferences.lighting,value);
      if(value!=='auto')assert.equal(h.get('scene').dataset.light,value);
      assert.equal(JSON.stringify(h.state().days),days);
      assert.doesNotMatch(h.get('mapHost').innerHTML,/land-new/);
      h.click('lightClose');
    }
  }finally{h.cleanup();}
});

test('reduced motion pauses automatic wandering without disabling explicit exploration',async()=>{
  const db=freshDB(),d=ensureDay(db,localDate()),s=addTask(d,'探索测试','S');startDay(d);const p=completeTask(d,s.id);
  const h=await harness(db);try{
    window.matchMedia=query=>({matches:query==='(prefers-reduced-motion: reduce)'});
    const actor=h.get('islander'),position=actor.getAttribute('transform');
    h.intervals.find(i=>i.ms===11000).fn();
    assert.equal(actor.getAttribute('transform'),position);assert.equal(actor.dataset.motion,'idle');
    h.tile(p.x,p.y);assert.equal(h.get('islander').dataset.motion,'running');
  }finally{h.cleanup();}
});

test('historical completion keeps the growth feedback on the original day',async()=>{
  const db=freshDB(),d=ensureDay(db,'2020-02-02'),s=addTask(d,'补录光影','S');startDay(d);
  const h=await harness(db);try{
    const current=JSON.stringify(h.state().days[localDate()]);
    h.action('openDay',{date:d.date});h.action('complete',{id:s.id});h.modal('confirmLate');
    assert.equal(h.get('scene').dataset.feedback,'grow');
    assert.equal((h.get('mapHost').innerHTML.match(/land-new/g)||[]).length,1);
    assert.equal(JSON.stringify(h.state().days[localDate()]),current);
    h.action('returnToday');assert.doesNotMatch(h.get('mapHost').innerHTML,/land-new/);
  }finally{h.cleanup();}
});

test('sun drag previews without saving, commits on release and restores after reload',async()=>{
  let saved;
  const h=await harness();try{
    h.click('lightButton');assert.equal(h.get('modal').open,false);assert.equal(h.get('lightPanel').hidden,false);
    const before=h.storage.get(KEY),days=JSON.stringify(h.state().days),p=sunPoint(17.25);
    h.pointer('pointerdown',p.x,p.y);assert.equal(h.storage.get(KEY),before);
    assert.equal(h.get('sunArc').getAttribute('aria-valuenow'),'17.25');
    assert.equal(h.get('scene').dataset.light,'evening');
    h.pointer('pointerup',p.x,p.y);saved=h.state();
    assert.equal(saved.preferences.lightingHour,17.25);assert.equal(JSON.stringify(saved.days),days);
    assert.equal(h.get('sunArc').pointer,null);
  }finally{h.cleanup();}
  const restored=await harness(saved);try{
    restored.click('lightButton');assert.equal(restored.get('lightTime').textContent,'17:15');
    assert.equal(restored.get('scene').dataset.light,'evening');
  }finally{restored.cleanup();}
});

test('cancel, Escape and outside dismissal discard an uncommitted sun drag',async()=>{
  const h=await harness();try{
    h.light('day');const saved=h.storage.get(KEY),p=sunPoint(22);
    for(const how of ['cancel','escape','outside']){
      if(h.get('lightPanel').hidden)h.click('lightButton');
      h.pointer('pointerdown',p.x,p.y);assert.equal(h.get('scene').dataset.light,'night');
      if(how==='cancel')h.pointer('pointercancel',p.x,p.y);
      if(how==='escape')document.dispatch('keydown',h.get('sunArc'),{key:'Escape'});
      if(how==='outside')document.dispatch('pointerdown',h.get('mapHost'));
      assert.equal(h.get('scene').dataset.light,'day');assert.equal(h.storage.get(KEY),saved);
      assert.equal(h.get('sunArc').pointer,null);
      h.pointer('pointerup',p.x,p.y);assert.equal(h.storage.get(KEY),saved);
    }
  }finally{h.cleanup();}
});

test('keyboard hour limits and automatic lighting do not change task dates',async()=>{
  const h=await harness();try{
    const days=JSON.stringify(h.state().days);h.click('lightButton');h.light('day');
    h.key('sunArc','ArrowRight');assert.equal(h.state().preferences.lightingHour,12.25);
    h.key('sunArc','Home');h.key('sunArc','ArrowLeft');assert.equal(h.state().preferences.lightingHour,0);
    h.key('sunArc','End');h.key('sunArc','ArrowRight');assert.equal(h.state().preferences.lightingHour,24);
    h.light('auto');assert.equal(h.state().preferences.lighting,'auto');assert.equal('lightingHour' in h.state().preferences,false);
    assert.equal(JSON.stringify(h.state().days),days);
  }finally{h.cleanup();}
});

test('incoming same-browser data cancels a drag and refreshes the light control',async()=>{
  const h=await harness();try{
    h.light('day');h.click('lightButton');const p=sunPoint(22);h.pointer('pointerdown',p.x,p.y);
    const incoming=h.state();incoming.preferences={lighting:'morning',lightingHour:8.25};
    window.listeners.storage({key:KEY,newValue:JSON.stringify(incoming)});
    assert.equal(h.get('scene').dataset.light,'morning');assert.equal(h.get('lightTime').textContent,'08:15');
    assert.equal(h.get('lightPanel').hidden,true);assert.equal(h.get('sunArc').pointer,null);
  }finally{h.cleanup();}
});

test('single click explores without details; double click opens details; another single click dismisses',async()=>{
  const db=freshDB(),d=ensureDay(db,localDate()),s=addTask(d,'重要的行动','S');startDay(d);const p=completeTask(d,s.id);
  const h=await harness(db);try{
    const saved=h.storage.get(KEY),actor=h.get('islander'),map=h.get('mapHost').innerHTML;
    h.tile(p.x,p.y);assert.equal(h.get('tileDetail').hidden,true);assert.equal(actor.dataset.motion,'running');
    h.doubleTile(p.x,p.y);assert.equal(h.get('tileDetail').hidden,false);assert.match(h.get('tileDetail').innerHTML,/重要的行动/);
    h.tile(0,0);assert.equal(h.get('tileDetail').hidden,true);
    assert.equal(h.get('islander'),actor);assert.equal(h.get('mapHost').innerHTML,map);assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});

test('two rapid taps open only the same tile; spaced taps remain exploration',async()=>{
  const h=await harness();try{
    h.tile(0,0,{timeStamp:100});assert.equal(h.get('tileDetail').hidden,true);
    h.tile(0,0,{timeStamp:250});assert.equal(h.get('tileDetail').hidden,false);
    h.tile(0,0,{timeStamp:1000});assert.equal(h.get('tileDetail').hidden,true);
    h.tile(0,0,{timeStamp:1400});assert.equal(h.get('tileDetail').hidden,true);
    h.tile(9,9,{timeStamp:1450});assert.equal(h.get('tileDetail').hidden,true);
  }finally{h.cleanup();}
});

test('keyboard exploration and explicit details remain separate and Escape closes details',async()=>{
  const h=await harness();try{
    h.tileKey(0,0,'Enter');assert.equal(h.get('tileDetail').hidden,true);
    h.tileKey(0,0,'Enter',true);assert.equal(h.get('tileDetail').hidden,false);
    document.dispatch('keydown',h.get('tileDetailClose'),{key:'Escape'});assert.equal(h.get('tileDetail').hidden,true);
    h.doubleTile(0,0);h.action('returnToday');assert.equal(h.get('tileDetail').hidden,true);
  }finally{h.cleanup();}
});

test('journal is a separate seven-island weekly view; calendar browsing never writes or creates days',async()=>{
  const h=await harness();try{
    const saved=h.storage.get(KEY),terrain=h.get('mapHost').innerHTML;
    h.click('lightButton');h.click('historyNav');
    assert.equal(h.get('journalView').hidden,false);assert.equal(h.get('todayHeading').hidden,true);assert.equal(h.get('todayWorkspace').hidden,true);
    assert.equal(h.get('lightPanel').hidden,true);assert.equal(h.get('mapHost').innerHTML,terrain);
    const dates=()=>h.get('journalChart').querySelectorAll('[data-island]').map(node=>node.dataset.island);
    assert.deepEqual(dates(),weekDates(localDate()));assert.equal(new Set(dates()).size,7);
    h.journal('prev');assert.deepEqual(dates(),weekDates(shiftDate(localDate(),-7)));
    h.journal('next');assert.deepEqual(dates(),weekDates(localDate()));
    h.jump('2020-12-31');assert.deepEqual(dates(),['2020-12-28','2020-12-29','2020-12-30','2020-12-31','2021-01-01','2021-01-02','2021-01-03']);
    h.journal('next');assert.equal(dates().length,7);assert.equal(dates()[0],'2021-01-04');
    h.journal('thisWeek');assert.equal(h.get('journalJump').value,localDate());
    h.journal('stats');assert.equal(h.get('journalMapPanel').hidden,true);assert.equal(h.get('journalStatsPanel').hidden,false);
    assert.match(h.get('journalStatsPanel').innerHTML,/你的航海故事，正要开始/);assert.doesNotMatch(h.get('journalStatsPanel').innerHTML,/NaN|Infinity/);
    h.journal('today');assert.equal(h.get('journalView').hidden,true);assert.equal(h.get('todayHeading').hidden,false);assert.equal(h.get('todayWorkspace').hidden,false);
    assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});

test('selecting an island updates details and keyboard focus; future visits remain read-only',async()=>{
  const h=await harness();try{
    const saved=h.storage.get(KEY);h.click('historyNav');h.jump('2099-01-07');
    const islands=h.get('journalChart').querySelectorAll('[data-island]'),chart=h.get('journalChart').innerHTML,ship=h.get('journalShip');
    assert.equal(islands.length,7);assert.ok(islands.every(node=>node.classList.contains('future')));
    h.island(0);assert.equal(h.get('journalJump').value,islands[0].dataset.island);assert.equal(h.get('journalIsland0').getAttribute('aria-pressed'),'true');
    assert.match(h.get('journalDetail').innerHTML,/未来岛屿/);assert.match(h.get('journalDetail').innerHTML,/未来的岛屿，等那一天再启航/);
    assert.equal(h.get('journalDetail').querySelectorAll('[data-journal="supplement"]').length,0);
    assert.equal(h.get('journalChart').innerHTML,chart);assert.equal(h.get('journalShip'),ship);
    h.islandKey(0,'ArrowLeft');assert.equal(document.activeElement,h.get('journalIsland6'));assert.equal(h.get('journalIsland6').getAttribute('aria-pressed'),'true');
    window.matchMedia=()=>({matches:true});
    h.islandKey(2,'Enter');assert.equal(h.get('journalJump').value,islands[2].dataset.island);assert.equal(ship.dataset.moving,'false');assert.equal(h.frames.size,0);
    assert.match(h.get('voyageStatus').textContent,/已停泊/);
    assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});

test('ship retargets in place and changing week, dashboard, or page cancels the voyage',async()=>{
  const h=await harness();try{
    h.click('historyNav');h.jump('2020-01-06');
    const saved=h.storage.get(KEY),ship=h.get('journalShip'),origin=ship.getAttribute('transform');
    h.island(3);assert.equal(ship.dataset.moving,'true');assert.equal(h.frames.size,1);
    h.advance(320);const mid=ship.getAttribute('transform');assert.notEqual(mid,origin);assert.ok(Number(ship.style['--wake-scale'])>0);
    h.island(5);assert.equal(ship.getAttribute('transform'),mid);assert.equal(h.get('journalShip'),ship);assert.equal(h.frames.size,1);
    h.advance(2200);assert.equal(ship.dataset.moving,'false');assert.equal(h.frames.size,0);assert.match(h.get('voyageStatus').textContent,/已停泊/);
    h.island(0);assert.equal(h.frames.size,1);h.journal('next');assert.equal(h.frames.size,0);assert.equal(h.get('journalShip').dataset.moving,'false');
    h.island(2);assert.equal(h.frames.size,1);h.journal('stats');assert.equal(h.frames.size,0);assert.equal(h.get('journalMapPanel').hidden,true);
    h.journal('map');h.island(6);assert.equal(h.frames.size,1);h.click('todayNav');assert.equal(h.frames.size,0);assert.equal(h.get('journalView').hidden,true);
    assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});

test('journal supplement preserves today and refreshes island stars and all-time statistics',async()=>{
  const db=freshDB(),date=shiftDate(localDate(),-14),d=ensureDay(db,date),s=addTask(d,'手记里的重要行动','S'),b=addTask(d,'已经完成的小行动','B');
  startDay(d);completeTask(d,b.id);settleDay(d);
  const h=await harness(db);try{
    const todayBefore=JSON.stringify(h.state().days[localDate()]);h.click('historyNav');h.jump(date);
    assert.match(h.get('journalDetail').innerHTML,/aria-label="1 星"/);assert.match(h.get('journalDetail').innerHTML,/最多获得 1 星/);
    const saved=h.storage.get(KEY);
    h.journal('supplement',{task:s.id});assert.equal(h.get('modal').open,true);assert.equal(h.get('unknownTime').checked,true);
    h.modal('close');assert.equal(h.storage.get(KEY),saved);
    h.journal('supplement',{task:s.id});h.modal('confirmLate');
    assert.equal(h.get('journalView').hidden,false);assert.equal(h.get('todayWorkspace').hidden,true);
    assert.equal(document.activeElement?.id,`journalIsland${weekDates(date).indexOf(date)}`);
    const updated=h.state().days[date];assert.equal(updated.tasks.find(task=>task.id===s.id).done,true);assert.equal(updated.tasks.find(task=>task.id===s.id).completedAt,null);
    assert.equal(JSON.stringify(h.state().days[localDate()]),todayBefore);assert.equal(updated.tiles.length,2);
    assert.match(h.get('journalDetail').innerHTML,/aria-label="3 星"/);assert.match(h.get('journalDetail').innerHTML,/完成时间未知/);
    h.journal('stats');const stats=h.get('journalStatsPanel').innerHTML;
    assert.match(stats,/<p>已完成天数<\/p><strong>1<small>/);
    assert.match(stats,/<p>已完成任务<\/p><strong>2<small>/);
    assert.match(stats,/<p>任务完成率<\/p><strong>100%<small>/);
    assert.match(stats,/<p>累计星光<\/p><strong>3<small>/);
    h.journal('revisit',{date});assert.equal(h.get('journalMapPanel').hidden,false);assert.equal(h.get('journalJump').value,date);assert.match(h.get('journalDetail').innerHTML,/aria-label="3 星"/);
  }finally{h.cleanup();}
});

test('date wheel supports keyboard, cancel, leap-year adjustment and focus restoration',async()=>{
  const h=await harness();try{
    h.click('historyNav');const saved=h.storage.get(KEY);h.jump('2024-02-29');
    h.journal('date');assert.equal(h.get('journalDateDialog').open,true);
    h.key('journalWheelyear','ArrowDown');assert.equal(h.get('journalWheelday').getAttribute('aria-valuemax'),'28');
    h.dateAction('cancel');assert.equal(h.get('journalJump').value,'2024-02-29');assert.equal(document.activeElement?.id,'journalJump');
    h.journal('date');h.key('journalWheelyear','ArrowDown');h.dateAction('confirm');
    assert.equal(h.get('journalJump').value,'2025-02-28');assert.equal(h.get('journalDateDialog').open,false);assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});
test('map and detail card enter an existing historical island without changing its records',async()=>{
  const db=freshDB(),date=shiftDate(localDate(),-14),d=ensureDay(db,date),s=addTask(d,'历史登岛','S');startDay(d);completeTask(d,s.id);settleDay(d);
  const h=await harness(db);try{
    const saved=h.storage.get(KEY);h.click('historyNav');h.jump(date);h.journal('visit');
    assert.equal(h.get('journalView').hidden,true);assert.match(h.get('panelContent').innerHTML,/历史登岛/);assert.match(h.get('dateLabel').textContent,/岛屿手记/);
    h.click('historyNav');h.island(weekDates(date).indexOf(date));assert.equal(h.get('journalView').hidden,true);
    assert.equal(h.storage.get(KEY),saved);
  }finally{h.cleanup();}
});

