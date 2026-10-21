import {GRADES} from './model.js';
import {weekStart,weekDates,shiftDate,islandSummary,dashboard} from './journal-model.js';
import {createRouteVoyage} from './voyage.js';
import {islandArt,shipArt,mapDecorations} from './journal-art.js';
import {weekLayout} from './journal-layout.js';
import {createDatePicker} from './journal-date.js';
import {starRating,starMarks} from './journal-stars.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
const statusNames={completed:'已完成',incomplete:'未完成',future:'未来岛屿'};
const monthDay=date=>`${Number(date.slice(5,7))}.${Number(date.slice(8,10))}`;
const starText=n=>starRating(n);
const percent=value=>`${Math.round(value*100)}%`;
const glyph=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${{
  left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  chart:'<path d="M4 20h17M7 16v-5m5 5V5m5 11V8"/>',
  anchor:'<path d="M12 7v14M8 11h8M4 15c0 8 16 8 16 0M2 17l2-2 2 2m12 0 2-2 2 2"/><circle cx="12" cy="4" r="3"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>'
}[name]||''}</svg>`;

// Browsing the journal never creates a date or changes the saved task model.
export function createJournal({root,getDB,getToday,onToday,onSupplement,onVisit=onToday}){
  const $=id=>document.getElementById(id);
  let selected=getToday(),anchor=weekStart(selected),tab='map',mounted=false,visible=false;
  let layout=weekLayout(anchor),datePicker,voyage={cancel(){}};
  function setupVoyage(){voyage.cancel();voyage=createRouteVoyage({
    points:layout.docks,routes:layout.routes,
    onUpdate(position,state){
      const ship=$('journalShip');if(!ship)return;
      ship.setAttribute('transform',`translate(${position.x} ${position.y})`);
      ship.dataset.moving=String(state.moving);
      $('journalShipFacing')?.setAttribute('transform',`scale(${Math.cos(state.heading*Math.PI/180)<0?-1:1} 1)`);
      ship.style.setProperty('--wake-scale',String(state.wakeScale));
      ship.style.setProperty('--wake-opacity',state.moving?'.8':'.16');
    },
    onArrive(){const status=$('voyageStatus');if(status)status.textContent=`已停泊 · ${monthDay(selected)} ${weekdays[weekDates(anchor).indexOf(selected)]}`;}
  });}
  const summary=(date=selected)=>islandSummary(getDB().days[date],date,getToday());
  function mount(){
    if(mounted)return;mounted=true;
    root.innerHTML=`
      <div class="journal-heading"><div><p class="journal-eyebrow">THE ISLAND CHRONICLES</p><h1 class="island-page-title">岛屿手记</h1><p>每一天，都值得靠岸。循着航线，重访生活的风景。</p></div><div class="journal-tabs" role="group" aria-label="手记视图"><button id="journalMapTab" data-journal="map" aria-pressed="true">${glyph('compass')} 周航海图</button><button id="journalStatsTab" data-journal="stats" aria-pressed="false">${glyph('chart')} 航行总览</button></div></div>
      <section id="journalMapPanel" aria-label="每周岛屿航海图">
        <div class="journal-toolbar"><div class="journal-week-switch"><button id="journalPrev" class="journal-icon" data-journal="prev" aria-label="上一周">${glyph('left')}</button><div><p class="journal-eyebrow">WEEKLY EXPEDITION</p><h2 id="journalWeekTitle"></h2></div><button id="journalNext" class="journal-icon" data-journal="next" aria-label="下一周">${glyph('right')}</button></div><div class="journal-week-tools"><button type="button" id="journalJump" class="journal-date-label" data-journal="date" aria-haspopup="dialog" aria-label="选择年月日，跳转到指定日期所在周">${glyph('calendar')}<span id="journalJumpLabel"></span><span class="date-entry-arrow" aria-hidden="true">⌄</span></button><button class="journal-text-button" data-journal="thisWeek">回到本周 ${glyph('arrow')}</button></div></div>
        <div class="journal-layout"><div class="journal-chart-wrap"><div class="journal-chart-top"><span><i></i> THE SEVEN ISLES</span><span id="journalWeekProgress"></span></div><div class="journal-chart" id="journalChart"></div><div class="journal-chart-footer"><span id="voyageStatus" role="status" aria-live="polite"></span><span class="chart-instruction"><span class="chart-swipe-hint">左右滑动海图 · </span>点选启航 · 再点登岛</span></div></div><aside id="journalDetail" class="journal-detail" aria-label="所选岛屿手记"></aside></div>
        <div class="journal-map-foot"><div class="journal-legend"><span><i class="completed"></i>已完成 · 已结算</span><span><i class="incomplete"></i>未完成</span><span><i class="future"></i>未来岛屿</span></div><span>七座群岛，一周的故事。</span></div>
        <details class="journal-rules"><summary>星光如何点亮？ <span>0–3 星的航行规则</span></summary><p>已结算且有任务或出发记录的日期为完成岛屿。未完成任何任务为 0 星；完成部分任务为 1 星；完成率达到 60% 为 2 星；全部完成为 3 星。S 任务未完成（或未规划 S）时最多 1 星。未结算的星级待定，补录后会重新计算。</p></details>
      </section><section id="journalStatsPanel" aria-label="全部航行统计" hidden></section><dialog id="journalDateDialog" class="journal-date-dialog" aria-labelledby="journalDateTitle"></dialog>`;
    datePicker=createDatePicker({dialog:$('journalDateDialog'),onConfirm(date){anchor=weekStart(date);selected=date;renderMap();}});
    root.addEventListener('click',event=>{
      const island=event.target.closest('[data-island]');
      if(island){select(island.dataset.island);return;}
      const button=event.target.closest('[data-journal]');if(!button)return;
      const action=button.dataset.journal;
      if(action==='prev'||action==='next')changeWeek(action==='prev'?-7:7);
      else if(action==='thisWeek'){selected=getToday();anchor=weekStart(selected);renderMap();}
      else if(action==='map'||action==='stats')setTab(action);
      else if(action==='date')datePicker.open(selected,$('journalJump'));
      else if(action==='visit')visit();
      else if(action==='today')onToday();
      else if(action==='supplement')onSupplement(selected,button.dataset.task);
      else if(action==='revisit'){selected=button.dataset.date;anchor=weekStart(selected);setTab('map');}
    });
    root.addEventListener('keydown',event=>{
      const island=event.target.closest('[data-island]');if(!island)return;
      if(event.key==='Enter'||event.key===' '){event.preventDefault();select(island.dataset.island);}
      const delta={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
      if(delta){event.preventDefault();const dates=weekDates(anchor),i=(dates.indexOf(island.dataset.island)+delta+7)%7;select(dates[i]);$(`journalIsland${i}`)?.focus();}
    });

  }
  function changeWeek(delta){
    const next=shiftDate(anchor,delta);if(next<'0001-01-01'||next>'9998-12-25')return;
    const index=weekDates(anchor).indexOf(selected);
    anchor=next;selected=shiftDate(anchor,Math.max(0,index));renderMap();
  }
  function renderMap(){
    if(layout.week!==anchor)layout=weekLayout(anchor);setupVoyage();
    const dates=weekDates(anchor),days=dates.map(date=>summary(date));
    $('journalWeekTitle').textContent=`${anchor.slice(0,4)} / ${monthDay(dates[0])} — ${monthDay(dates[6])}`;
    $('journalJump').value=selected;$('journalJumpLabel').textContent=selected.replaceAll('-',' / ');
    $('journalWeekProgress').textContent=`${days.filter(d=>d.status==='completed').length} / 7 座已归档`;
    const routes=layout.routes.map(plans=>`<path d="${plans.map((p,i)=>i?p.path.slice(p.path.indexOf(' C')+1):p.path).join(' ')}" class="journal-route"/>`).join('')+layout.docks.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="1.8" fill="#6b8a76" opacity=".75"/>`).join('');
    $('journalChart').innerHTML=`<svg class="journal-map-svg" viewBox="0 0 1000 600" aria-label="本周七座群岛，使用 Tab 或方向键选择岛屿"><defs><pattern id="journalGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#467a7b" opacity=".085" stroke-width=".8"/></pattern><radialGradient id="journalSea"><stop stop-color="#d4e5d9"/><stop offset="1" stop-color="#aacdc8"/></radialGradient></defs><rect width="1000" height="600" fill="url(#journalSea)"/><rect width="1000" height="600" fill="url(#journalGrid)"/><g aria-hidden="true" pointer-events="none">${mapDecorations(layout.decorations)}</g><g fill="none" aria-hidden="true" pointer-events="none">${routes}</g>${days.map((s,i)=>{
      const p=layout.islands[i],isSelected=s.date===selected;
      return `<g id="journalIsland${i}" class="journal-island ${s.status}${isSelected?' is-selected':''}" data-island="${s.date}" role="button" tabindex="0" aria-pressed="${isSelected}" aria-label="${s.date} ${weekdays[i]}，${statusNames[s.status]}，${s.status==='completed'?s.stars+' 星，':''}${s.done}/${s.total} 项任务" transform="translate(${p.x} ${p.y})"><ellipse class="island-selection" cx="0" cy="7" rx="83" ry="43"/><g class="island-illustration" aria-hidden="true">${islandArt(p.style,s.status)}</g><rect class="island-hit" x="-85" y="-68" width="170" height="164" rx="40" fill="transparent"/><g class="island-caption" transform="translate(0 -181)" aria-hidden="true"><rect x="-71" y="51" width="142" height="58" rx="10"/><text class="island-date" x="0" y="72" text-anchor="middle">${weekdays[i]} · ${monthDay(s.date)}${s.date===getToday()?' 今日':''}</text><g class="island-star-marks" transform="translate(-54 80) scale(.65)">${starMarks(s.stars,s.status!=='completed')}</g><text class="island-status" x="19" y="93" text-anchor="middle">${s.status==='future'?'未启航':statusNames[s.status]}</text></g>${s.status!=='future'&&(s.recorded||s.date===getToday())?'<text class="island-visit" x="0" y="-140" text-anchor="middle">再次点击登岛 ↗</text>':''}</g>`;
    }).join('')}<g id="journalShip" aria-hidden="true" pointer-events="none"><g id="journalShipFacing">${shipArt()}</g></g></svg>`;
    renderDetail();voyage.reset(Math.max(0,dates.indexOf(selected)));
    const chart=$('journalChart');
    if(chart.scrollWidth>chart.clientWidth)chart.scrollLeft=layout.islands[dates.indexOf(selected)].x/1000*chart.scrollWidth-chart.clientWidth/2;
    $('voyageStatus').textContent=`已停泊 · ${monthDay(selected)} ${weekdays[dates.indexOf(selected)]} · 再点岛屿可登岛`;
  }
  function select(date){
    if(!weekDates(anchor).includes(date))return;
    const unchanged=selected===date;selected=date;
    weekDates(anchor).forEach((d,i)=>{const node=$(`journalIsland${i}`);node?.classList.toggle('is-selected',d===date);node?.setAttribute('aria-pressed',String(d===date));});
    $('journalJump').value=selected;$('journalJumpLabel').textContent=selected.replaceAll('-',' / ');renderDetail();if(unchanged){visit();return;}
    $('voyageStatus').textContent=`正在驶向 ${monthDay(date)} 的岛屿…`;
    voyage.moveTo(weekDates(anchor).indexOf(date),{reducedMotion:!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
  }
  function visit(){
    const s=summary();if(selected<=getToday()&&(s.recorded||selected===getToday()))onVisit(selected);else $('voyageStatus').textContent=s.status==='future'?'未来岛屿，尚未启航。':'这一天尚无岛屿记录。';
  }
  function renderDetail(){
    const s=summary(),d=getDB().days[selected],tasks=d?.tasks||[],index=weekDates(anchor).indexOf(selected),future=s.status==='future';
    const title=future?'还未写下的风景':s.status==='completed'?'这一天，已珍藏':selected===getToday()?'今天的航行，进行中':'留给生活的一片海';
    const reason=future?'未来的岛屿，等那一天再启航。':!s.recorded?'这一天还没有任务记录，空白也可以是生活的一部分。':s.status!=='completed'?'还未结算。今天结束时，把这片风景收进手记。':!s.done?'这一天已收好，尚未记录完成的行动。':!s.sDone?'S 任务尚未完成，本岛最多获得 1 星。':s.stars===3?'所有行动都已完成，收获一座三星岛屿。':`已完成 ${percent(s.ratio)} 的行动，每一步都留下了星光。`;
    const grades=GRADES.map(grade=>{const all=tasks.filter(t=>t.grade===grade);return {grade,total:all.length,done:all.filter(t=>t.done).length};});
    const date=new Date(`${selected}T12:00:00`);
    $('journalDetail').innerHTML=`<div class="journal-detail-top"><span class="journal-eyebrow">ISLAND NO. ${String(index+1).padStart(2,'0')}</span><span class="journal-status-tag ${s.status}">${statusNames[s.status]}</span></div><button class="detail-island-art" data-journal="visit" aria-label="进入所选日期的岛屿" ${future||(!s.recorded&&selected!==getToday())?'disabled':''}><svg aria-hidden="true" viewBox="-110 -75 220 140">${islandArt(layout.islands[index].style,s.status)}</svg></button><p class="detail-date">${date.getFullYear()} 年 ${date.getMonth()+1} 月 ${date.getDate()} 日 · ${weekdays[index]}</p><h2>${title}</h2><div class="detail-stars" aria-label="${s.status==='completed'?s.stars+' 星':'星级待定'}">${starRating(s.stars,s.status!=='completed')}<small>${s.status==='completed'?'本次航行星级':'等待点亮'}</small></div><p class="detail-reason">${reason}</p><div class="detail-progress"><div><span>完成的行动</span><strong>${future?'—':s.done}<small> / ${future?'—':s.total}</small></strong></div><div class="journal-progress-track"><i style="width:${future?0:s.ratio*100}%"></i></div></div><div class="detail-grades">${grades.map(g=>`<div><span class="journal-grade grade-${g.grade}">${g.grade}</span><b>${future?'—':g.done+'/'+g.total}</b></div>`).join('')}</div>
      <div class="detail-task-heading"><h3>这一天的行动</h3><span>${future?'尚未开始':tasks.length+' 项计划'}</span></div><div class="journal-task-list">${future?`<div class="journal-empty">${glyph('compass')}<p>下一页故事，<br>留给未来的你。</p></div>`:tasks.length?tasks.map(t=>`<div class="journal-task${t.done?' is-done':''}"><span class="journal-grade grade-${t.grade}">${t.grade}</span><div><strong>${esc(t.name)}</strong><small>${t.done?(t.late?'已补录 · '+(t.completedAt?'完成时间已记录':'完成时间未知'):'已完成'):t.grade==='S'?'重要行动 · 点亮星级':'待完成'}</small></div>${t.done?'<span class="journal-task-check" aria-label="已完成">✓</span>':d?.ended&&d.tasks.some(task=>task.grade==='S')?`<button data-journal="supplement" data-task="${esc(t.id)}" aria-label="补录 ${esc(t.name)}">补录</button>`:'<span class="journal-task-pending" aria-label="待完成">○</span>'}</div>`).join(''):`<div class="journal-empty">${glyph('anchor')}<p>没有留下计划。<br>好好休息，也是生活。</p></div>`}</div>${!future&&(s.recorded||selected===getToday())?`<button class="journal-primary" data-journal="visit">${selected===getToday()?'进入今日岛屿':'登上这一天的岛屿'} ${glyph('arrow')}</button>`:''}<p class="detail-footnote">${s.status==='completed'?'已结算的任务仍可补录，星级与总览会同步更新。':'每一座岛屿，都有自己的节奏。'}</p>`;
  }
  function renderStats(){
    const data=dashboard(getDB(),getToday()),records=Object.keys(getDB().days).filter(date=>date<=getToday()&&summary(date).recorded).sort().reverse();
    $('journalStatsPanel').innerHTML=`<div class="stats-intro"><div><p class="journal-eyebrow">YOUR VOYAGE, SO FAR</p><h2>走过的海，都会记得。</h2><p>截至 ${getToday().replaceAll('-',' / ')} · 全部真实记录</p></div><span class="stats-compass" aria-hidden="true">${glyph('compass')}</span></div><div class="journal-metrics">${[
      [data.completedDays,'已完成天数','有记录且已结算的岛屿','座岛'],
      [data.completedTasks,'已完成任务',`共规划 ${data.totalTasks} 项行动`,'项'],
      [percent(data.completionRate),'任务完成率','全部已完成任务 / 全部计划',''],
      [data.stars,'累计星光',`${data.perfectDays} 座三星岛屿`,'颗星']
    ].map(([value,label,note,unit])=>`<article class="journal-metric"><p>${label}</p><strong>${value}<small>${unit}</small></strong><span>${note}</span></article>`).join('')}</div>
      <div class="stats-charts"><article class="stats-card"><div class="stats-card-heading"><div><p class="journal-eyebrow">ACTIONS BY PRIORITY</p><h3>每一份行动的分量</h3></div><span>已完成 / 已规划</span></div><div class="grade-chart">${data.grades.map(g=>`<div class="grade-chart-row"><span class="journal-grade grade-${g.grade}">${g.grade}</span><div class="grade-chart-track"><i class="grade-bar-${g.grade}" style="width:${g.total?g.done/g.total*100:0}%"></i></div><strong>${g.done} / ${g.total}</strong><small>${g.total?percent(g.done/g.total):'—'}</small></div>`).join('')}</div><p class="stats-note">每条进度表示该等级任务的完成率；等级代表重要性。</p><div class="grade-composition" aria-label="已完成任务等级占比">${data.grades.map(g=>`<span><i class="grade-bar-${g.grade}"></i>${g.grade} ${data.completedTasks?percent(g.done/data.completedTasks):'0%'}</span>`).join('')}</div></article>
      <article class="stats-card"><div class="stats-card-heading"><div><p class="journal-eyebrow">A SKY FULL OF LITTLE WINS</p><h3>收藏的星光</h3></div><span>已结算岛屿分布</span></div><div class="star-chart">${[3,2,1,0].map(n=>`<div><span class="star-chart-label" aria-label="${n}星">${starText(n)}</span><div class="grade-chart-track"><i style="width:${data.completedDays?data.starCounts[n]/data.completedDays*100:0}%"></i></div><b>${data.starCounts[n]}<small> 座</small></b></div>`).join('')}</div><p class="stats-note">星级记录过程，不定义努力。未结算和空白日期不计入。</p></article></div>
      <article class="stats-card journal-recent"><div class="stats-card-heading"><div><p class="journal-eyebrow">RECENT LOGBOOK</p><h3>最近靠岸</h3></div><button class="journal-text-button" data-journal="map">打开航海图 ${glyph('arrow')}</button></div>${records.length?`<div class="recent-list">${records.slice(0,6).map(date=>{const s=summary(date);return `<button data-journal="revisit" data-date="${date}"><span>${date.replaceAll('-',' / ')}</span><strong>${s.done} / ${s.total} <small>项行动</small></strong><span class="recent-stars" aria-label="${s.status==='completed'?s.stars+' 星':'星级待定'}">${s.status==='completed'?starText(s.stars):'星级待定'}</span><span>${statusNames[s.status]} ${glyph('right')}</span></button>`;}).join('')}</div>`:`<div class="stats-empty">${glyph('anchor')}<h3>你的航海故事，正要开始。</h3><p>完成今天的第一项行动，第一座岛屿就会留下足迹。</p><button class="journal-primary" data-journal="today">去规划今天 ${glyph('arrow')}</button></div>`}</article>`;
  }
  function setTab(next){
    tab=next;voyage.cancel();
    $('journalMapTab').setAttribute('aria-pressed',String(tab==='map'));
    $('journalStatsTab').setAttribute('aria-pressed',String(tab==='stats'));
    $('journalMapPanel').hidden=tab!=='map';$('journalStatsPanel').hidden=tab!=='stats';
    if(tab==='map')renderMap();else renderStats();
  }
  return {
    show(){mount();visible=true;root.hidden=false;setTab(tab);},
    hide(){visible=false;root.hidden=true;voyage.cancel();if($('journalDateDialog')?.open)datePicker.close();},
    refresh(){if(visible)setTab(tab);},
    reset(){selected=getToday();anchor=weekStart(selected);tab='map';voyage.cancel();},
    focusSelected(){$(`journalIsland${weekDates(anchor).indexOf(selected)}`)?.focus();},
    get selected(){return selected;}
  };
}

