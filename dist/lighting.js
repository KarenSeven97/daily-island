// Display hours only: never change dates or task completion timestamps.
export const PRESET_HOURS={morning:8,day:12,evening:17.5,night:22};
export const clampHour=value=>Math.max(0,Math.min(24,Number(value)||0));
export const modeAtHour=hour=>hour<6||hour>=19?'night':hour<10?'morning':hour<16?'day':'evening';
export const formatHour=hour=>{const minutes=Math.round(clampHour(hour)*60);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;};
export function sunPoint(hour){const a=Math.PI*(1-clampHour(hour)/24);return {x:160+132*Math.cos(a),y:130-108*Math.sin(a)};}
export function hourFromPoint(x,y){const a=Math.atan2(Math.max(0,(130-y)/108),(x-160)/132);return Math.round(clampHour((1-a/Math.PI)*24)*4)/4;}
export function preferenceHour(preferences,now=new Date()){
  if(preferences.lighting==='auto')return now.getHours()+now.getMinutes()/60;
  return Number.isFinite(preferences.lightingHour)?clampHour(preferences.lightingHour):(PRESET_HOURS[preferences.lighting]??12);
}
const stops=[
  [0,'#25464f','#162f40','#c2e1d6',.65,.6],
  [5,'#526d78','#547f82','#e1ede0',.76,.72],
  [7,'#edf0dc','#b3d8cb','#3e706d',1,.95],
  [12,'#e0eee8','#acd1ce','#3e706d',1,1],
  [17,'#f1d9c3','#b1c3c1','#6d655e',.96,.9],
  [19.5,'#3d5b67','#254654','#d8e6dc',.73,.66],
  [24,'#25464f','#162f40','#c2e1d6',.65,.6]
];
const mix=(a,b,t)=>a+(b-a)*t;
function mixColor(a,b,t){return '#'+[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)).toString(16).padStart(2,'0')).join('');}
export function lightAtHour(value){
  const hour=clampHour(value);let i=0;while(i<stops.length-2&&hour>stops[i+1][0])i++;
  const a=stops[i],b=stops[i+1],t=(hour-a[0])/(b[0]-a[0]);
  const brightness=mix(a[4],b[4],t),night=Math.max(0,Math.min(1,(1-brightness)/.32));
  return {mode:modeAtHour(hour),top:mixColor(a[1],b[1],t),bottom:mixColor(a[2],b[2],t),ink:mixColor(a[3],b[3],t),brightness,saturation:mix(a[5],b[5],t),night,sunX:`${15+hour/24*70}%`};
}

