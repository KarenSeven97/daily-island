import {PRESET_HOURS,sunPoint,hourFromPoint,formatHour,preferenceHour,modeAtHour,clampHour} from './lighting.js';

export function createLightControl({getPreferences,onPreview,onCommit}){
  const $=id=>document.getElementById(id),button=$('lightButton'),panel=$('lightPanel'),arc=$('sunArc');
  let drag=null,hour=12;
  const labels={morning:'晨光',day:'日间',evening:'暮色',night:'夜色'};
  function update(value=preferenceHour(getPreferences())){
    hour=clampHour(value);const p=sunPoint(hour),mode=modeAtHour(hour),automatic=getPreferences().lighting==='auto'&&drag===null;
    $('sunHandle').setAttribute('transform',`translate(${p.x} ${p.y})`);
    arc.setAttribute('aria-valuenow',String(hour));arc.setAttribute('aria-valuetext',`${formatHour(hour)}，${labels[mode]}`);
    $('lightTime').textContent=formatHour(hour);$('lightModeLabel').textContent=automatic?'跟随设备时间':`${labels[mode]} · 仅调整光照`;
    $('lightAuto').setAttribute('aria-pressed',String(automatic));
    $('sunHandle').dataset.phase=mode==='night'?'moon':'sun';
    for(const el of panel.querySelectorAll('[data-light-preset]'))el.setAttribute('aria-pressed',String(!automatic&&el.dataset.lightPreset===mode));
  }
  function releaseDrag(){const id=drag;drag=null;if(id!==null&&arc.hasPointerCapture(id))arc.releasePointerCapture(id);}
  function close(restoreFocus=false){
    if(drag!==null){releaseDrag();onPreview(null);update();}
    panel.hidden=true;button.setAttribute('aria-expanded','false');if(restoreFocus)button.focus();
  }
  function commit(value){releaseDrag();onCommit({lighting:modeAtHour(value),lightingHour:value});update(value);}
  function move(event){
    const rect=arc.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const value=hourFromPoint((event.clientX-rect.left)*320/rect.width,(event.clientY-rect.top)*160/rect.height);
    onPreview(value);update(value);
  }
  button.addEventListener('click',()=>{if(!panel.hidden){close();return;}update();panel.hidden=false;button.setAttribute('aria-expanded','true');});
  $('lightClose').addEventListener('click',()=>close(true));
  $('lightAuto').addEventListener('click',()=>{releaseDrag();onCommit({lighting:'auto'});update();});
  panel.addEventListener('click',event=>{const el=event.target.closest('[data-light-preset]');if(el)commit(PRESET_HOURS[el.dataset.lightPreset]);});
  arc.addEventListener('pointerdown',event=>{
    if(event.button!==undefined&&event.button!==0)return;
    if(drag!==null)return;drag=event.pointerId;arc.setPointerCapture(drag);arc.focus();event.preventDefault();move(event);
  });
  arc.addEventListener('pointermove',event=>{if(drag===event.pointerId){event.preventDefault();move(event);}});
  arc.addEventListener('pointerup',event=>{
    if(drag!==event.pointerId)return;move(event);commit(hour);
  });
  const cancel=()=>{if(drag===null)return;releaseDrag();onPreview(null);update();};
  arc.addEventListener('pointercancel',cancel);arc.addEventListener('lostpointercapture',cancel);
  arc.addEventListener('keydown',event=>{
    const step={ArrowRight:.25,ArrowUp:.25,ArrowLeft:-.25,ArrowDown:-.25,PageUp:1,PageDown:-1}[event.key];
    if(step===undefined&&!['Home','End'].includes(event.key))return;
    event.preventDefault();commit(clampHour(event.key==='Home'?0:event.key==='End'?24:hour+step));
  });
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!button.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}});
  panel.hidden=true;button.setAttribute('aria-expanded','false');update();
  return {refresh(){if(drag===null)update();},close};
}

