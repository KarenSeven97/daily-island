export function daysInMonth(year,month){
  return [31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
export function clampDateParts({year,month,day}){
  year=Math.max(1,Math.min(9998,Math.round(year)));month=Math.max(1,Math.min(12,Math.round(month)));
  return {year,month,day:Math.max(1,Math.min(daysInMonth(year,month),Math.round(day)))};
}
export function createDatePicker({dialog,onConfirm,onClose=()=>{}}){
  let draft,trigger,columns={},values={},timers={};
  const format=()=>[String(draft.year).padStart(4,'0'),String(draft.month).padStart(2,'0'),String(draft.day).padStart(2,'0')].join('-');
  dialog.innerHTML=`<form method="dialog" class="date-voyage"><div class="date-voyage-heading"><p class="journal-eyebrow">CHOOSE YOUR LANDING</p><button type="button" data-date-action="cancel" aria-label="关闭日期选择">×</button><h2 id="journalDateTitle">选择靠岸的日子</h2><p>拨动年月日，重访一周的风景。</p></div><div class="date-wheel-labels"><span>年</span><span>月</span><span>日</span></div><div class="date-wheel-group">${['year','month','day'].map((part,i)=>`<div class="date-wheel" id="journalWheel${part}" data-wheel="${part}" role="spinbutton" tabindex="0" aria-label="${['年','月','日'][i]}" aria-valuemin="1"></div>`).join('')}<div class="date-wheel-selection" aria-hidden="true"></div></div><p class="date-wheel-hint">上下滚动或滑动 · 方向键选择</p><div class="date-voyage-actions"><button type="button" class="journal-text-button" data-date-action="cancel">取消</button><button type="button" class="journal-primary" data-date-action="confirm">前往这一周 <span aria-hidden="true">↗</span></button></div></form>`;
  const close=()=>{Object.values(timers).forEach(clearTimeout);dialog.close();trigger?.focus();onClose();};
  function highlight(part){
    const wheel=columns[part];wheel.setAttribute('aria-valuenow',draft[part]);
    wheel.setAttribute('aria-valuemax',part==='year'?9998:part==='month'?12:daysInMonth(draft.year,draft.month));
    for(const option of wheel.querySelectorAll('[data-date-value]'))option.setAttribute('aria-selected',String(Number(option.dataset.dateValue)===draft[part]));
  }
  function render(part){
    const max=part==='year'?9998:part==='month'?12:daysInMonth(draft.year,draft.month),start=part==='year'?Math.max(1,draft.year-80):1,end=part==='year'?Math.min(max,draft.year+80):max;
    values[part]=Array.from({length:end-start+1},(_,i)=>start+i);
    columns[part].innerHTML=values[part].map(value=>`<button type="button" tabindex="-1" role="option" data-date-part="${part}" data-date-value="${value}" aria-selected="${value===draft[part]}">${part==='year'?String(value).padStart(4,'0'):String(value).padStart(2,'0')}</button>`).join('');
    columns[part].scrollTop=values[part].indexOf(draft[part])*42;highlight(part);
  }
  function choose(part,value,scroll=true){
    const old=draft,oldMax=daysInMonth(old.year,old.month);draft=clampDateParts({...draft,[part]:value});
    if(scroll||!values[part].includes(draft[part]))render(part);else highlight(part);
    if(part==='year'&&!scroll&&(values.year.indexOf(draft.year)<10||values.year.indexOf(draft.year)>values.year.length-11))render('year');
    if(part!=='day'&&(draft.day!==old.day||daysInMonth(draft.year,draft.month)!==oldMax))render('day');
  }
  for(const part of ['year','month','day']){
    const wheel=dialog.querySelector(`#journalWheel${part}`);columns[part]=wheel;
    wheel.addEventListener('scroll',()=>{
      if(!dialog.open)return;clearTimeout(timers[part]);
      timers[part]=setTimeout(()=>{const value=values[part][Math.max(0,Math.min(values[part].length-1,Math.round(wheel.scrollTop/42)))];if(value!==draft[part])choose(part,value,false);},90);
    });
    wheel.addEventListener('keydown',event=>{
      const delta={ArrowUp:-1,ArrowDown:1,PageUp:-10,PageDown:10}[event.key];
      if(delta||event.key==='Home'||event.key==='End'){
        event.preventDefault();choose(part,event.key==='Home'?1:event.key==='End'?(part==='year'?9998:part==='month'?12:daysInMonth(draft.year,draft.month)):draft[part]+delta);
      }
    });
  }
  dialog.addEventListener('click',event=>{
    const option=event.target.closest('[data-date-value]');if(option){choose(option.dataset.datePart,Number(option.dataset.dateValue));return;}
    const action=event.target.closest('[data-date-action]')?.dataset.dateAction;
    if(action==='confirm'){
      // Read settled positions too: an immediate confirm must not lose the final scroll.
      for(const part of ['year','month','day']){const value=values[part][Math.max(0,Math.min(values[part].length-1,Math.round(columns[part].scrollTop/42)))];choose(part,value,false);}
      onConfirm(format());close();
    }else if(action==='cancel'||event.target===dialog)close();
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  return {open(date,from){draft=clampDateParts(Object.fromEntries(['year','month','day'].map((p,i)=>[p,Number(date.split('-')[i])])));trigger=from;dialog.showModal();for(const part of ['year','month','day'])render(part);columns.year.focus();},close};
}

