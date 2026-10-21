export const GRADES = ['S', 'A', 'B', 'C', 'F'];
export const THEME = Object.freeze({
  id: 'coastal-garden', name: '海风庭院', caption: '让今天的行动，长成海边的一座小岛。',
  colors: { grass:'#a6c790', grassLight:'#bcd6a2', grassDark:'#8eb17b', soil:'#d8c7a4', soilSide:'#b5a384', sea:'#dcebec', roof:'#477c75', roofDark:'#315f5a', wall:'#f4e9d2', trim:'#d29571', wood:'#bc9471', path:'#e5d6b7' },
  assets: {home:'起点小屋', S:'海风灯塔', A:'庭院书屋', B:'树荫庭院', C:'海边花圃', F:'休憩草地'}
});
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const freshDB = () => ({schemaVersion:1, days:{}, preferences:{lighting:'auto'}});
export function ensureDay(db,date) {
  return db.days[date] ||= {date,themeId:null,started:false,ended:false,settledAt:null,tasks:[],tiles:[]};
}
export const unlocked = d => d.tasks.some(t=>t.grade==='S'&&t.done);
export const countDone = d => d.tasks.filter(t=>t.done).length;
const key = p => `${p.x},${p.y}`;
const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
function requireOpen(d) { if(d.ended) throw Error('这一天已结算，可以补录已有任务。'); }
export function addTask(d,name,grade,now=new Date().toISOString()) {
  requireOpen(d); name=name.trim();
  if(!name) throw Error('先给这件事起个名字。');
  if(name.length>80) throw Error('任务名称最多 80 个字。');
  if(!GRADES.includes(grade)) throw Error('请选择任务等级。');
  if(grade==='S' && (d.started||d.tasks.some(t=>t.grade==='S'))) throw Error('每天只保留一个 S 级任务。');
  const t={id:globalThis.crypto.randomUUID(),name,grade,done:false,createdAt:now,completedAt:null,recordedAt:null};
  d.tasks.push(t); return t;
}
export function editTask(d,id,name,grade) {
  requireOpen(d); if(d.started) throw Error('开始后，已规划任务的等级与名称已锁定。');
  const t=d.tasks.find(t=>t.id===id); if(!t||t.done) throw Error('该任务无法编辑。');
  name=name.trim(); if(!name||name.length>80) throw Error('请输入 1–80 字的任务名称。');
  if(!GRADES.includes(grade)) throw Error('请选择任务等级。');
  if(grade==='S'&&d.tasks.some(x=>x.id!==id&&x.grade==='S')) throw Error('每天只保留一个 S 级任务。');
  Object.assign(t,{name,grade});
}
export function deleteTask(d,id) {
  requireOpen(d); if(d.started) throw Error('开始闯关后，已规划任务会保留。');
  const t=d.tasks.find(t=>t.id===id); if(!t||t.done) throw Error('已完成任务与土地会永久保留。');
  d.tasks=d.tasks.filter(t=>t.id!==id);
}
export function startDay(d,now=new Date().toISOString()) {
  requireOpen(d); if(d.started) return false;
  if(d.tasks.filter(t=>t.grade==='S').length!==1) throw Error('先规划今天唯一的 S 级任务。');
  d.started=true; d.startedAt=now; d.themeId=THEME.id; return true;
}
export function pickTile(d,grade,seed='') {
  const land=[{x:0,y:0},...d.tiles], occupied=new Set(land.map(key)), candidates=new Map();
  let hash=0; for(const c of seed) hash=(hash*31+c.charCodeAt(0))|0;
  for(const p of land) for(const [dx,dy] of dirs) {
    const x=p.x+dx,y=p.y+dy,k=key({x,y}); if(occupied.has(k)||candidates.has(k)) continue;
    const toward=x-y,side=Math.abs(x+y),r2=x*x+y*y;
    const neighbors=dirs.filter(([a,b])=>occupied.has(key({x:x+a,y:y+b}))).length;
    const bias=grade==='S'?toward*5-side:grade==='A'?toward*3.7-side:grade==='B'?side*2.8-Math.abs(toward)*.8:grade==='C'?side*3.7-toward*.5:side*4.3-toward;
    const noise=((Math.imul(x+271,y+619)^hash)>>>0)%100/250;
    candidates.set(k,{x,y,score:bias-r2*.75+neighbors*1.4+noise});
  }
  const p=[...candidates.values()].sort((a,b)=>b.score-a.score||a.x-b.x||a.y-b.y)[0];
  return {x:p.x,y:p.y};
}
export function completeTask(d,id,{late=false,completedAt=null,now=new Date().toISOString()}={}) {
  const t=d.tasks.find(t=>t.id===id); if(!t) throw Error('未找到这项任务。'); if(t.done) return null;
  if(!d.started) {
    if(!late) throw Error('先开始闯关，再记录完成。');
    if(d.tasks.filter(t=>t.grade==='S').length!==1) throw Error('这一天未规划 S 级任务，无法补录闯关。');
    d.started=true; d.themeId=THEME.id; d.startedAt=null;
  }
  if(d.ended&&!late) throw Error('请用补录为已结算的任务记录完成。');
  if(late&&completedAt&&!Number.isFinite(Date.parse(completedAt))) throw Error('请填写有效的完成时间。');
  const p=pickTile(d,t.grade,t.id);
  const tile={...p,taskId:t.id,grade:t.grade,createdAt:now};
  Object.assign(t,{done:true,completedAt:late?completedAt:now,recordedAt:now,late});
  d.tiles.push(tile); return tile;
}
export function settleDay(d,now=new Date().toISOString()) { if(d.ended) return; d.ended=true; d.settledAt=now; }
export function rollover(db,today,now=new Date().toISOString()) {
  let changed=false;
  for(const [date,d] of Object.entries(db.days)) if(date<today&&!d.ended) {settleDay(d,now); changed=true;}
  if(!db.days[today]) {ensureDay(db,today);changed=true;} return changed;
}
export function pathTo(d,start,target) {
  const allowed=new Set([{x:0,y:0},...d.tiles].map(key)),from=key(start),goal=key(target);
  if(!allowed.has(from)||!allowed.has(goal)) return [];
  const queue=[start],previous=new Map([[from,null]]);
  for(let i=0;i<queue.length;i++) {
    const p=queue[i],k=key(p); if(k===goal) {
      const path=[];let current=k;
      while(current!==from) {const [x,y]=current.split(',').map(Number);path.unshift({x,y});current=previous.get(current);} return path;
    }
    for(const [dx,dy] of dirs) {const n={x:p.x+dx,y:p.y+dy},nk=key(n);if(allowed.has(nk)&&!previous.has(nk)){previous.set(nk,k);queue.push(n);}}
  } return [];
}
export function validateDB(db) {
  if(!db||db.schemaVersion!==1||!db.days||typeof db.days!=='object'||!db.preferences) throw Error('存档格式无法识别。');
  for(const [date,d] of Object.entries(db.days)) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(d.tasks)||!Array.isArray(d.tiles)) throw Error('存档日期或任务格式有误。');
    if(d.tasks.filter(t=>t.grade==='S').length>1) throw Error('存档中出现多个 S 级任务。');
    const ids=new Set(); for(const t of d.tasks) {if(!t.id||ids.has(t.id)||!GRADES.includes(t.grade)||typeof t.name!=='string')throw Error('任务数据有误。');ids.add(t.id);}
    const occupied=new Set(['0,0']),tileTasks=new Set();
    for(const p of d.tiles) {
      const t=d.tasks.find(t=>t.id===p.taskId);
      if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||occupied.has(key(p))||tileTasks.has(p.taskId)||!t?.done||t.grade!==p.grade)throw Error('土地数据有误。');
      if(!dirs.some(([x,y])=>occupied.has(key({x:p.x+x,y:p.y+y}))))throw Error('土地连接数据有误。');
      occupied.add(key(p));tileTasks.add(p.taskId);
    }
    if(d.tasks.filter(t=>t.done).length!==d.tiles.length) throw Error('任务与土地未能对应。');
    if(d.started&&d.themeId!==THEME.id) throw Error('主题数据无法识别。');
  } return db;
}

