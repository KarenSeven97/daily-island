import {THEME,GRADES,localDate,freshDB,ensureDay,countDone,unlocked,addTask,editTask,deleteTask,startDay,completeTask,settleDay,rollover,validateDB} from './model.js';
import {renderScene,project} from './scene.js';
import {createTraveler} from './motion.js';
import {lightAtHour,preferenceHour} from './lighting.js';
import {createLightControl} from './light-control.js';
import {ACTOR_LANE,placeActor} from './actor-depth.js';
import {createIdle} from './idle.js';
import {detailPosition} from './detail-position.js';
import {createJournal} from './journal.js';
import {initAccount,noteLocalSave,prepareLocalReset} from './account.js';
const $=id=>document.getElementById(id),KEY='daily-island-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16v.2"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',flag:'<path d="M5 21V3m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',leaf:'<path d="M19 3C5 3 1 14 8 18s14-3 11-15ZM5 21 16 8"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14ZM4 14l5 5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',book:'<path d="M12 5C7 2 4 4 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',moon:'<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM20 2v4m-2-2h4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>'};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.leaf}</svg>`;
let db,storageError='';
try { const raw=localStorage.getItem(KEY); db=raw?validateDB(JSON.parse(raw)):freshDB(); }
catch(e) {db=freshDB();storageError='旧存档暂时无法读取，已保留原始数据。本次体验暂不写入，以免覆盖；请保留此页面并联系修复。';}
let today=localDate(),selected=today,view='today',form=null,player={x:0,y:0},selectedTile=null,newTile=null,modalAction=null,lastFocus=null;
// Ephemeral visual state only. Never written into the saved island model.
let lastAnimatedTile=null,feedbackTimer=null,previewHour=null,lightControl=null,detailTile=null,detailOrigin=null,lastTileTap=null;
let idlePose=null,relaxNext=true;
const traveler=createTraveler({onUpdate:(position,state)=>{player=position;updatePlayer(state);}});
const idle=createIdle({onUpdate:pose=>{idlePose=pose;updatePlayer(traveler.state);}});
rollover(db,today); const day=()=>ensureDay(db,selected);
const journal=createJournal({root:$('journalView'),getDB:()=>db,getToday:()=>today,onToday:()=>goDate(today),onVisit:date=>goDate(date),onSupplement:(date,id)=>{selected=date;lateDialog(id);}});
function notify(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function save(){
  if(storageError){$('saveStatus').textContent='本次更改尚未保存';$('storageWarning').hidden=false;$('storageWarning').textContent=storageError;return;}
  try {localStorage.setItem(KEY,JSON.stringify(db));$('saveStatus').textContent='已保存在此浏览器';noteLocalSave(db);}
  catch { $('saveStatus').textContent='本次更改尚未保存';$('storageWarning').hidden=false;$('storageWarning').textContent='浏览器未能保存数据。请保持页面打开，并允许此网站使用本地存储。'; }
}
function run(fn){try {fn();save();render();} catch(e){notify(e.message);}}
function dateTitle(date){const d=new Date(`${date}T12:00:00`);return `${d.getFullYear()} / ${String(d.getMonth()+1).padStart(2,'0')} / ${String(d.getDate()).padStart(2,'0')} · ${['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()]}`;}
function applyLight(){
  const light=lightAtHour(previewHour??preferenceHour(db.preferences)),scene=$('scene');
  scene.dataset.light=light.mode;
  for(const [name,value] of Object.entries({'sea-top':light.top,'sea-bottom':light.bottom,'scene-ink':light.ink,'land-filter':`brightness(${light.brightness}) saturate(${light.saturation})`,'night-strength':light.night,'sun-position':light.sunX}))scene.style.setProperty(`--${name}`,String(value));
  $('lightButton').innerHTML=icon(light.mode==='night'?'moon':'sun');
}
function updatePlayer({gait='idle',facing=1,phase=0}={}){
  const el=$('islander');if(!el)return;const p=project(player.x,player.y),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const pose=gait==='idle'&&!reduced?idlePose:null,idleOffset=pose?.offset||{x:0,y:0},offset={x:ACTOR_LANE.x+idleOffset.x,y:ACTOR_LANE.y+idleOffset.y};
  el.setAttribute('transform',`translate(${p.x+offset.x} ${p.y-6+offset.y})`);el.dataset.motion=gait;el.dataset.activity=pose?.action||'none';
  placeActor(el,$('islandDepthLayer'),player,offset);
  $('islandFacing')?.setAttribute('transform',`scale(${pose?.facing||facing} 1)`);
  const moving=gait!=='idle'&&!reduced,amplitude=gait==='running'?38:24,swing=moving?Math.sin(phase)*amplitude:0;
  for(const [part,angle] of [['LeftLeg',swing],['RightLeg',-swing],['LeftArm',-swing*.8],['RightArm',swing*.8]])$('island'+part)?.setAttribute('transform',`rotate(${angle})`);
  const bob=moving?-Math.abs(Math.sin(phase))*(gait==='running'?1.7:.8):0;
  $('islandBody')?.setAttribute('transform',`translate(0 ${bob}) rotate(${moving&&gait==='running'?-5:0} 0 8)`);
  if(pose){
    const strength=pose.strength,breath=Math.sin(pose.phase*2)*.5*strength;
    el.style.setProperty('--idle-strength',String(strength));
    if(pose.action==='rest'||pose.action==='fish'){
      $('islandBody')?.setAttribute('transform',`translate(0 ${5*strength+breath}) rotate(${-7*strength} 0 8)`);
      $('islandLeftLeg')?.setAttribute('transform',`rotate(${-65*strength})`);$('islandRightLeg')?.setAttribute('transform',`rotate(${-60*strength})`);
      $('islandLeftArm')?.setAttribute('transform',`rotate(${(pose.action==='fish'?-28:12)*strength})`);
      $('islandRightArm')?.setAttribute('transform',`rotate(${(pose.action==='fish'?-62+Math.sin(pose.phase*1.6)*4:-12)*strength})`);
    }else{
      $('islandBody')?.setAttribute('transform',`translate(0 ${breath}) rotate(${Math.sin(pose.phase)*2*strength} 0 8)`);
      $('islandRightArm')?.setAttribute('transform',`rotate(${155*strength})`);
    }
  }
}
function stopWalking(){idle.cancel();traveler.reset();}
function feedback(kind){clearTimeout(feedbackTimer);$('scene').dataset.feedback=kind;feedbackTimer=setTimeout(()=>{$('scene').dataset.feedback='';},1000);}
function goDate(date){stopWalking();selected=date;view='today';form=null;selectedTile=null;detailTile=null;lastTileTap=null;player={x:0,y:0};render();}
function updateWorld(){
  idle.cancel();
  const d=day(),spawnId=newTile&&newTile!==lastAnimatedTile?newTile:null;
  applyLight();$('mapHost').innerHTML=renderScene(d,{player,newId:spawnId,selectedId:selectedTile});
  if(spawnId)lastAnimatedTile=spawnId;
  updatePlayer(traveler.state);
  $('themeBadge').innerHTML=icon(d.started?'leaf':'lock')+(d.started?THEME.name:'今日主题 · 待揭晓');
  $('sceneDate').textContent=selected.replaceAll('-',' . ');
  $('sceneEmpty').hidden=d.started;
  $('exploreStatus').innerHTML=icon(d.started?(unlocked(d)?'flag':'lock'):'spark')+(d.started?(unlocked(d)?'探索已解锁 · 单击前往 · 双击查看':'完成 S 任务，解锁自由探索'):'规划完成后，岛屿的主题才会揭晓');
}
function taskRow(t,d){
  const late=d.ended||selected!==today;
  return `<div class="task-row ${t.grade==='S'?'s-task':''} ${t.done?'done':''}" data-task="${t.id}"><span class="grade">${t.grade}</span><div class="task-copy"><span class="task-name">${esc(t.name)}</span><span class="task-meta">${t.done?(t.late?'已补录 · '+(t.completedAt?'时间已确认':'完成时间未知'):'已成为'+THEME.assets[t.grade]):t.grade==='S'?'今天唯一的重要任务 · 解锁探索':d.started?'完成后凝聚一块土地':'普通任务 · 完成后生长土地'}</span></div>${t.done?`<span class="complete-button is-done" aria-label="已完成">${icon('check')}</span>`:!d.started&&!late?`<div class="task-actions"><button data-action="edit" data-id="${t.id}" aria-label="编辑任务 ${esc(t.name)}" title="编辑">${icon('edit')}</button><button data-action="delete" data-id="${t.id}" aria-label="删除任务 ${esc(t.name)}" title="删除">${icon('close')}</button></div>`:`<button class="complete-button" data-action="complete" data-id="${t.id}" aria-label="${late?'补录':'完成'}任务 ${esc(t.name)}" title="${late?'补录完成':'标记完成'}">${late?icon('plus'):icon('check')}</button>`}</div>`;
}
function formHTML(d){
  if(!form)return '';
  const editing=d.tasks.find(t=>t.id===form.id),grade=editing?.grade||form.grade||'B';
  return `<form class="task-form" id="taskForm"><label for="taskName">${editing?'编辑任务':'写下一个具体的行动'}</label><input id="taskName" type="text" maxlength="80" placeholder="${grade==='S'?'例如：完成产品的第一版需求':'例如：读 20 页书'}" value="${esc(editing?.name||'')}" required autocomplete="off"><div class="form-bottom"><select id="taskGrade" aria-label="任务等级">${GRADES.map(g=>`<option value="${g}" ${g===grade?'selected':''} ${g==='S'&&(d.started||d.tasks.some(t=>t.grade==='S'&&t.id!==form.id))?'disabled':''}>${g} 级</option>`).join('')}</select><button type="submit" class="primary-button">${editing?'保存修改':'加入计划'} ${icon('plus')}</button><button type="button" class="cancel-button" data-action="cancelForm">取消</button></div><p class="grade-hint">等级代表重要性，与耗时无关。每天只设一个 S。</p></form>`;
}
function progressHTML(d){return `<div class="progress-row"><span>今日行动</span><b>${countDone(d)} <span class="progress-total">/ ${d.tasks.length}</span></b></div><div class="progress-track"><div style="width:${d.tasks.length?countDone(d)/d.tasks.length*100:0}%"></div></div>`;}
function panelHTML(){
  const d=day(),historical=selected!==today,late=d.ended||historical,n=countDone(d),s=d.tasks.find(t=>t.grade==='S'),tasks=[...d.tasks].sort((a,b)=>(b.grade==='S')-(a.grade==='S'));
  if(view==='history'){
    const dates=Object.keys(db.days).filter(k=>db.days[k].tasks.length||db.days[k].started).sort().reverse();
    return `<p class="panel-eyebrow">ISLAND JOURNAL</p><div class="panel-title-row"><h2>岛屿手记</h2><span class="step-tag">${dates.length} 天</span></div><p class="panel-description">每一天的行动，都有自己的形状。<br>打开一座岛，也可以补录当时已有的任务。</p><div class="history-list">${dates.map(date=>{const h=db.days[date];return `<button class="history-card" data-action="openDay" data-date="${date}"><span class="history-progress">${countDone(h)} / ${h.tasks.length}</span><strong>${date}${date===today?' · 今天':''}</strong><p>${h.started?THEME.name:'尚未开始'} · ${h.ended?'已结算':'进行中'}<br>${countDone(h)} 块新土地${unlocked(h)?' · 已解锁探索':''}</p></button>`;}).join('')||`<div class="empty-tasks">还没有手记。<br><br>今天的第一个计划，正等着你。</div>`}</div><div class="panel-bottom"><button class="secondary-button full-width" data-action="returnToday">${icon('back')} 回到今日岛屿</button></div>`;
  }
  return `${historical?`<button class="back-link" data-action="history">${icon('back')} 返回岛屿手记</button>`:''}<p class="panel-eyebrow">${late?'A DAY TO REMEMBER':d.started?'MAKE IT HAPPEN':'A LITTLE PLAN, A NEW BEGINNING'}</p><div class="panel-title-row"><h2>${late?(historical?'这一天的行动':'今天的手记'):d.started?'让行动成为风景':'今天，想完成什么？'}</h2><span class="step-tag">${late?'已结算':d.started?'02 / 行动':'01 / 规划'}</span></div><p class="panel-description">${late?'已经生长的土地会一直保留。<br>尚未记录的完成，可以在下方补录。':d.started?'每完成一件事，就有一块土地诞生。<br>慢慢建造，不必一次走得很远。':'先选一件最重要的事，作为今天的 S。<br>其余的小行动，也会让岛屿慢慢生长。'}</p>${late?`<div class="settlement-stats"><div class="stat-box"><strong>${n}<span> / ${d.tasks.length}</span></strong><span>已完成任务</span></div><div class="stat-box"><strong>${d.tiles.length}</strong><span>新生土地</span></div></div>`:progressHTML(d)}${!s&&!d.started&&!late?`<div class="section-label">今日最重要的一件事 <span class="tiny">仅 1 个 S</span></div><button class="task-placeholder" style="width:100%;text-align:left" data-action="addS">${icon('flag')}<div><p>为今天选一个 S 级任务</p><small>完成它，解锁小岛上的自由探索</small></div></button>`:''}<div class="task-list">${tasks.map(t=>taskRow(t,d)).join('')}</div>${late&&!tasks.length?'<div class="empty-tasks">这一天没有计划。好好休息也是生活。</div>':''}${!late?formHTML(d):''}${!late&&!form&&s?`<button class="add-task-button" data-action="addOrdinary">${icon('plus')} 添加一个小行动</button>`:''}<div class="panel-bottom">${late?`<div class="panel-note">${icon('book')}<span>${d.started?THEME.name+' · 主题已保留':'这一天尚未揭晓主题'}<br>${historical?'仅可补录已有任务，今天的进度不受影响。':'结算后仍可补录已有任务。明天会有一座新岛。'}</span></div><button class="secondary-button full-width" data-action="${historical?'returnToday':'history'}">${icon(historical?'back':'book')} ${historical?'回到今日岛屿':'查看岛屿手记'}</button>`:!d.started?`<div class="panel-note">${icon('spark')}<span>出发时揭晓今日主题。<br>土地与建筑，会拥有同一种海风的颜色。</span></div><button class="primary-button" data-action="start" ${!s?'disabled':''}>开始闯关 ${icon('arrow')}</button><p class="button-footnote">${s?'今日 S 已就位，准备出发。':'先添加唯一的 S 级任务，再出发。'}</p>`:`<div class="panel-note">${icon(unlocked(d)?'leaf':'lock')}<span>${unlocked(d)?'灯塔已点亮，可以点击土地探索。<br>每一块土地，都记着你做过的事。':'完成 S 级任务，角色就能离开起点。<br>其他任务也可以先完成，土地照常生长。'}</span></div><button class="secondary-button full-width" data-action="settle">${icon('book')} 结算今日</button><p class="button-footnote">${n===d.tasks.length?'今天的行动已全部完成，收好这片风景。':'按自己的节奏结束，未完成的任务可以补录。'}</p>`}</div>`;
}
function render(){
  const journalOpen=view==='history';
  $('todayHeading').hidden=journalOpen;$('todayWorkspace').hidden=journalOpen;
  $('lightButton').hidden=journalOpen;
  $('historyCount').textContent=Object.values(db.days).filter(d=>d.tasks.length||d.started).length;
  $('helpButton').innerHTML=icon('help');
  if(journalOpen){
    $('todayNav').classList.remove('active');$('historyNav').classList.add('active');
    journal.show();return;
  }
  journal.hide();
  const d=day(),historical=selected!==today;
  $('dateLabel').textContent=dateTitle(selected)+(historical?' · 岛屿手记':' · TODAY');
  $('pageTitle').textContent=view==='history'?'走过的日子，都在这里。':historical?'重访，那一天的风景。':d.ended?'收好今天生长的风景。':d.started?'每一步，都在生长。':'把今天，建成一座岛。';
  $('pageSubtitle').textContent=view==='history'?'每一座小岛，都是一段认真生活的记录。':historical?'主题与土地已保留，行动仍可补录。':'每一件完成的小事，都让岛屿生长。';
  $('todayNav').classList.toggle('active',view!=='history'&&!historical);$('historyNav').classList.toggle('active',view==='history'||historical);
  $('historyCount').textContent=Object.values(db.days).filter(d=>d.tasks.length||d.started).length;
  $('helpButton').innerHTML=icon('help');
  $('panelContent').innerHTML=panelHTML();updateWorld();renderTileDetail();
}
function showModal(html,handler){idle.cancel();lightControl?.close();if(!$('modal').open)lastFocus=document.activeElement;$('modalContent').innerHTML=`<button class="modal-close" data-modal="close" aria-label="关闭">${icon('close')}</button>`+html;modalAction=handler;if(!$('modal').open)$('modal').showModal();}
function closeModal(){$('modal').close();modalAction=null;if(lastFocus?.isConnected)lastFocus.focus();else if(view==='history')journal.focusSelected();}
function reveal(){
  const art=renderScene({started:true,tasks:[{id:'s',name:'',grade:'S',done:true}],tiles:[{x:1,y:0,grade:'S',taskId:'s'}]},{idPrefix:'reveal',showPlayer:false});
  // A small crop of the same theme renderer keeps the reveal faithful to the island assets.
  const mini=art.replace('viewBox="0 0 940 650"','viewBox="300 165 380 390"');
  showModal(`<div class="reveal-content"><p class="modal-kicker">TODAY’S ISLAND · 今日主题</p><div class="reveal-art" aria-hidden="true">${mini}</div><h2 id="modalTitle">${THEME.name}</h2><p>浅绿的草地，沙色的土地，墨绿的屋顶。<br>今天的每一块土地与建筑，都从这里生长。</p><div class="theme-materials"><span><i></i>草木</span><span><i></i>沙石</span><span><i></i>木屋</span></div><button class="primary-button" data-modal="close">进入今天的小岛 ${icon('arrow')}</button><button class="text-button" data-modal="close">跳过仪式，直接开始</button></div>`);
}
function help(kind='all'){
  if(kind==='privacy'){showModal(`<p class="modal-kicker">YOUR LITTLE ISLAND</p><h2 id="modalTitle">数据就在这个浏览器里</h2><p>任务、土地坐标、主题和历史会自动保存在当前浏览器。刷新或关闭页面后，再用同一个浏览器打开即可继续。</p><p>访客记录只保存在本地。登录后可以上传云端；两份记录不同时，请在账户窗口中选择。退出登录仍保留此浏览器的记录。清理网站数据、使用无痕模式，或更换浏览器，可能让你看不到尚未上传的记录。</p><button class="primary-button" data-modal="close">知道了</button>`);return;}
  showModal(`<p class="modal-kicker">A SMALL GUIDE</p><h2 id="modalTitle">让行动，长成一座岛</h2><div class="help-steps"><div class="help-step"><span>01</span><div><strong>规划今天唯一的 S</strong><p>S 是最重要的一件事。也可以添加 A / B / C / F 级小行动；开始前可以编辑与删除。</p></div></div><div class="help-step"><span>02</span><div><strong>出发时，揭晓海风庭院</strong><p>主题会保存下来，并统一决定土地与建筑的材质和颜色。</p></div></div><div class="help-step"><span>03</span><div><strong>完成任务，土地凝聚</strong><p>一个任务对应一块土地。S 会生成灯塔、A 会生成小书屋，其余是树荫、花圃与草地。</p></div></div><div class="help-step"><span>04</span><div><strong>探索与留存</strong><p>完成 S 后，单击土地让角色跑步前往，双击查看对应任务。也可以用触屏快速轻点两次；键盘 Shift 加回车查看。空闲时角色会慢慢散步。结算或跨日后，可以在手记中补录已有任务。</p></div></div></div><button class="primary-button" data-modal="close">开始我的一天</button>`);
}
function settleDialog(){const d=day();showModal(`<p class="modal-kicker">KEEP TODAY’S LANDSCAPE</p><h2 id="modalTitle">把今天，收进手记</h2><p>今天完成了 ${countDone(d)} / ${d.tasks.length} 项行动，留下了 ${d.tiles.length} 块新土地。${unlocked(d)?'海风灯塔已经点亮。':'灯塔还在等待属于它的行动。'}</p><p>结算后不再新增或编辑任务；已有任务仍可补录。到了明天，会从新的起点开始。</p><div class="modal-actions"><button class="secondary-button" data-modal="close">再待一会儿</button><button class="primary-button" data-modal="confirmSettle">保存今日手记</button></div>`,action=>{if(action==='confirmSettle'){run(()=>settleDay(day()));closeModal();notify('今天的岛屿，已经收好。');}});}
function lateDialog(id){const d=day(),t=d.tasks.find(t=>t.id===id);if(!t||t.done)return;showModal(`<p class="modal-kicker">A LITTLE LATE, STILL COUNTS</p><h2 id="modalTitle">补录这一次完成</h2><p>${esc(t.name)}<br>这块土地会留在 ${selected} 的岛屿上。${!d.started?'补录时将同时揭晓并保存「海风庭院」主题。':''}</p><label class="time-choice"><input id="unknownTime" type="checkbox" checked> 具体完成时间记不清了</label><div id="actualTimeField" hidden><label class="field-label" for="actualTime">实际完成时间（设备本地时间）</label><input class="modal-input" id="actualTime" type="datetime-local" min="${selected}T00:00" max="${selected}T23:59" value="${selected}T18:00"></div><p style="font-size:10px">记不清时会保存为「时间未知」，并记录现在的补录时间。</p><div class="modal-actions"><button class="secondary-button" data-modal="close">取消</button><button class="primary-button" data-modal="confirmLate">确认已完成</button></div>`,action=>{if(action==='confirmLate'){
    const unknown=$('unknownTime').checked,value=$('actualTime').value;
    if(!unknown&&(!value||value.slice(0,10)!==selected||!Number.isFinite(new Date(value).getTime()))){notify('请选择这一天内的实际完成时间。');return;}
    if(!unknown&&new Date(value)>new Date()){notify('完成时间不能晚于现在。');return;}
    try{const p=completeTask(d,id,{late:true,completedAt:unknown?null:new Date(value).toISOString()});newTile=p?.taskId;save();render();closeModal();feedback('grow');notify('补录已保存，一块土地在这一天凝聚。');clearTimeout(lateDialog.timer);lateDialog.timer=setTimeout(()=>{newTile=null;},1000);}catch(e){notify(e.message);}
  }});}
function completionTime(t){
  if(!t?.completedAt)return '--:--';
  const date=new Date(t.completedAt);if(!Number.isFinite(date.getTime()))return '--:--';
  return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(/^24:/,'00:');
}
function renderTileDetail(){
  const el=$('tileDetail');if(!detailTile){el.hidden=true;return;}
  const home=detailTile==='home',t=home?null:day().tasks.find(task=>task.id===detailTile),time=completionTime(t);
  el.hidden=false;
  el.innerHTML=`<button id="tileDetailClose" data-action="closeTile" aria-label="关闭地块详情">×</button><strong id="tileDetailTitle">${home?THEME.assets.home:esc(t?.name||'')}</strong>${home?'':`<time aria-label="完成于 ${time}">${time}</time>`}`;
  positionTileDetail();
}
function positionTileDetail(){
  const card=$('tileDetail'),scene=$('scene');if(card.hidden||!scene)return;
  const target=detailOrigin?.isConnected?detailOrigin:(selectedTile==='home'?$('mapHost').querySelector('[data-tile="0,0"]'):(()=>{const p=day().tiles.find(tile=>tile.taskId===selectedTile);return p?$('mapHost').querySelector(`[data-tile="${p.x},${p.y}"]`):null;})());
  if(!target)return;
  const point=detailPosition(target.getBoundingClientRect(),scene.getBoundingClientRect(),card.getBoundingClientRect());
  card.style.setProperty('left',`${point.left}px`);card.style.setProperty('top',`${point.top}px`);card.style.setProperty('bottom','auto');card.dataset.placement=point.side;
}
function closeTileDetail(restoreFocus=false){detailTile=null;renderTileDetail();if(restoreFocus&&detailOrigin?.isConnected)detailOrigin.focus();}
function updateTileSelection(){
  const target=selectedTile==='home'?{x:0,y:0}:day().tiles.find(p=>p.taskId===selectedTile);
  for(const el of $('mapHost').querySelectorAll('[data-tile]'))el.classList.toggle('land-selected',Boolean(target&&el.dataset.tile===`${target.x},${target.y}`));
}
function clickTile(el){idle.cancel();const [x,y]=el.dataset.tile.split(',').map(Number),d=day();const p=d.tiles.find(p=>p.x===x&&p.y===y);selectedTile=x===0&&y===0?'home':p?.taskId;updateTileSelection();closeTileDetail();if(!unlocked(d)){if(x!==0||y!==0)notify('先完成今天的 S 任务，角色就能来这里探索。');return;}traveler.go(d,{x,y},'running');}
function showTileDetails(el){idle.cancel();const [x,y]=el.dataset.tile.split(',').map(Number);const id=x===0&&y===0?'home':day().tiles.find(p=>p.x===x&&p.y===y)?.taskId;if(!id)return;selectedTile=id;detailTile=id;detailOrigin=el;updateTileSelection();renderTileDetail();$('tileDetailClose').focus();}
function activateTile(el,event){
  const time=Number.isFinite(event.timeStamp)?event.timeStamp:performance.now();
  const repeated=lastTileTap&&lastTileTap.key===el.dataset.tile&&time-lastTileTap.time>=0&&time-lastTileTap.time<=340;
  if(event.detail>=2||repeated){lastTileTap=null;showTileDetails(el);}else{lastTileTap={key:el.dataset.tile,time};clickTile(el);}
}
const actions={
  addS(){form={grade:'S'};render();$('taskName').focus();},
  addOrdinary(){form={grade:'B'};render();$('taskName').focus();},
  edit(el){form={id:el.dataset.id};render();$('taskName').focus();},
  delete(el){run(()=>deleteTask(day(),el.dataset.id));},cancelForm(){form=null;render();},
  start(){try {startDay(day());save();form=null;render();reveal();}catch(e){notify(e.message);}},
  complete(el){const d=day();if(d.ended||selected!==today){lateDialog(el.dataset.id);return;}let s=false;run(()=>{const t=d.tasks.find(t=>t.id===el.dataset.id);s=t?.grade==='S';const p=completeTask(d,el.dataset.id);newTile=p?.taskId;});if(newTile){feedback(s?'unlock':'grow');notify(s?'灯塔点亮了。现在，可以自由探索这座岛。':'一件行动，一块新土地。');}setTimeout(()=>{newTile=null;},1000);},
  settle:settleDialog,history(){stopWalking();lightControl?.close();closeTileDetail();view='history';form=null;render();},openDay(el){goDate(el.dataset.date);},returnToday(){goDate(today);}
};
$('panelContent').addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled)actions[el.dataset.action]?.(el);});
$('panelContent').addEventListener('submit',e=>{if(e.target.id!=='taskForm')return;e.preventDefault();const name=$('taskName').value,grade=$('taskGrade').value;try{if(form.id)editTask(day(),form.id,name,grade);else addTask(day(),name,grade);form=null;save();render();notify('计划已保存。');}catch(err){notify(err.message);}});
function tileTarget(target){
  const tile=target.closest('[data-tile]');if(tile)return tile;
  const building=target.closest('[data-building]');
  return building?$('mapHost').querySelector(`[data-tile="${building.dataset.building}"]`):null;
}
$('mapHost').addEventListener('click',e=>{const el=tileTarget(e.target);if(el)activateTile(el,e);});
$('mapHost').addEventListener('dblclick',e=>{const el=tileTarget(e.target);if(el){e.preventDefault();lastTileTap=null;showTileDetails(el);}});
$('mapHost').addEventListener('keydown',e=>{const el=e.target.closest('[data-tile]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();lastTileTap=null;if(e.shiftKey&&e.key==='Enter')showTileDetails(el);else clickTile(el);}});
$('tileDetail').addEventListener('click',e=>{if(e.target.closest('[data-action]')?.dataset.action==='closeTile')closeTileDetail(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('tileDetail').hidden){e.preventDefault();closeTileDetail(true);}});
$('todayNav').onclick=()=>goDate(today);$('historyNav').onclick=actions.history;
lightControl=createLightControl({getPreferences:()=>db.preferences,onPreview:hour=>{previewHour=hour;applyLight();},onCommit:preference=>{previewHour=null;db.preferences.lighting=preference.lighting;if(preference.lighting==='auto')delete db.preferences.lightingHour;else db.preferences.lightingHour=preference.lightingHour;save();applyLight();}});
$('helpButton').onclick=()=>help();$('mapHelp').onclick=()=>help('map');$('privacyInfo').onclick=()=>help('privacy');
$('debugReset').onclick=()=>showModal(`<p class="modal-kicker">DEBUG ONLY · 临时工具</p><h2 id="modalTitle">清空这个浏览器的记录？</h2><p>这会删除当前浏览器中的任务、土地和手记，用于重新测试完整流程。已有云端记录会保留；之后请在账户窗口选择要使用的存档。</p><div class="modal-actions"><button class="secondary-button" data-modal="close">取消</button><button class="primary-button debug-confirm" data-modal="confirmDebugReset">清空并重新开始</button></div>`,action=>{if(action!=='confirmDebugReset')return;try{prepareLocalReset();}catch{notify('无法暂停云端传输，请先导出本地存档再重试。');return;}try{localStorage.removeItem(KEY);}catch{}storageError='';db=freshDB();today=localDate();rollover(db,today);selected=today;view='today';form=null;selectedTile=null;detailTile=null;detailOrigin=null;lastTileTap=null;stopWalking();player={x:0,y:0};save();closeModal();render();notify('本地调试记录已清空。');});
$('modal').addEventListener('click',e=>{const el=e.target.closest('[data-modal]');if(!el)return;if(el.dataset.modal==='close')closeModal();else modalAction?.(el.dataset.modal,el);});
$('modal').addEventListener('change',e=>{if(e.target.id==='unknownTime')$('actualTimeField').hidden=e.target.checked;});
$('modal').addEventListener('cancel',()=>{modalAction=null;});
function checkDate(){const now=localDate();if(now!==today){const old=today;today=now;if($('modal').open)closeModal();rollover(db,today);save();if(selected===old&&view!=='history')goDate(today);else render();notify('新的一天开始了，昨天的岛屿已存入手记。');}applyLight();lightControl.refresh();}
document.addEventListener('pointerdown',()=>idle.cancel());
document.addEventListener('keydown',()=>idle.cancel());
$('lightButton').addEventListener('click',()=>idle.cancel());
document.addEventListener('visibilitychange',()=>{idle.cancel();$('scene').dataset.paused=String(document.hidden);if(!document.hidden)checkDate();});
setInterval(checkDate,15000);
setInterval(()=>{
  if(document.hidden||$('modal').open||!$('lightPanel').hidden||traveler.active||idle.active||!$('tileDetail').hidden||view==='history'||!unlocked(day())||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  if(relaxNext){relaxNext=false;idle.start(day(),player);return;}
  relaxNext=true;const options=[{x:0,y:0},...day().tiles].filter(t=>t.x!==player.x||t.y!==player.y);
  const t=options[Math.floor(Math.random()*options.length)];if(t)traveler.go(day(),t,'walking');
},11000);
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{const incoming=validateDB(JSON.parse(e.newValue));if($('modal').open)closeModal();lightControl.close();db=incoming;rollover(db,today);stopWalking();player={x:0,y:0};form=null;selectedTile=null;detailTile=null;lastTileTap=null;render();lightControl.refresh();notify('已同步此浏览器另一个标签页的最新记录。');}catch{notify('另一个标签页的记录无法读取，请保留当前页面。');}});
window.addEventListener('resize',positionTileDetail);
initAccount({storageKey:KEY});
save();render();
