import {THEME} from './model.js';
import {coastPath} from './coast.js';
import {renderSea} from './sea.js';
import {ACTOR_LANE,depthPoint,compareDepth} from './actor-depth.js';

// Presentation only: projection, task IDs and permanent tile coordinates are unchanged.
const P=THEME.colors;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const project=(x,y)=>({x:(x-y)*68,y:(x+y)*34});

function tree(x,y,s=1) {
  return `<g class="vegetation" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cy="5" rx="22" ry="9" fill="#345d50" opacity=".12"/>
    <path d="M-3 3V-36L3-39V5Z" fill="${P.wood}"/><path d="M0-36V4L3 5V-39Z" fill="#968263"/>
    <path d="M-23-37L0-65 24-37 0-22Z" fill="${P.grassDark}"/>
    <path d="M-23-37L0-65V-22Z" fill="${P.grassLight}"/><path d="M0-65L24-37 0-22Z" fill="#689577"/>
    <path d="M-18-40L0-61 18-40" fill="none" stroke="#d3e3ac" stroke-width="1.3" opacity=".65"/>
  </g>`;
}

function house(type) {
  if(type==='S') return `<g class="architecture"><g class="architecture-body">
    <path d="M-29 0L0-15 29 0V8L0 23-29 8Z" fill="#c7c7ac"/><path d="M-29 0L0 15 29 0 0-15Z" fill="#f5ecd3"/>
    <path d="M-21-6L0-17 21-6V1L0 12-21 1Z" fill="${P.path}"/>
    <path d="M-16-8V-88L0-97 16-88V-8L0 1Z" fill="${P.wall}"/><path d="M0-79L16-88V-8L0 1Z" fill="#b7c6b4"/>
    <path d="M-16-88L0-97 16-88 0-79Z" fill="#fff8e2"/>
    <path d="M-17-40L0-31 17-40V-34L0-25-17-34Z" fill="${P.trim}"/>
    <path d="M-18-89L0-99 18-89V-83L0-73-18-83Z" fill="${P.roofDark}"/>
    <path d="M-10-8V-25Q-5-34 0-25V-3Z" fill="${P.roofDark}"/><path d="M6-52V-62L11-65V-55Z" fill="#6e9482"/>
    <path d="M-16-87V-10M1-76V-4" stroke="#fffae3" stroke-width="1" opacity=".7"/>
    </g><g class="beacon-light" opacity=".38"><path d="M-7-100L-76-118V-80Z M9-100L88-120V-76Z" fill="#ffe7aa" opacity=".45"/></g>
    <path class="window-light" d="M-13-110L0-117 14-110V-90L0-83-13-90Z" fill="#f7dfa2"/>
    <path d="M-13-110V-90L0-83 14-90V-110M0-116V-84M-13-103L0-96 14-103" fill="none" stroke="${P.roofDark}" stroke-width="2"/>
    <path d="M-21-113L0-124 22-113 0-102Z" fill="${P.roof}"/><path d="M-21-113L0-102 22-113V-108L0-97-21-108Z" fill="${P.roofDark}"/>
    <path d="M-19-114L0-124 20-114" fill="none" stroke="#a2c8ac" stroke-width="1.3"/>
    <path d="M-12 11L0 17 12 11M-9 16L0 21 9 16" stroke="#fff4d9" fill="none" stroke-width="2"/></g>`;

  if(type==='home') return `<g class="architecture home-cottage"><g class="architecture-body">
    <ellipse cy="6" rx="35" ry="15" fill="#7c937c" opacity=".16"/>
    <path d="M-28-9Q-29-36 0-40Q29-36 28-9V2Q0 24-28 2Z" fill="${P.wall}"/>
    <path d="M0-38Q29-34 28-9V2Q14 13 0 16Z" fill="#bbc8ac"/>
    <path d="M-34-22Q-27-59 0-63Q27-59 34-22Q0-4-34-22Z" fill="${P.roof}"/>
    <path d="M0-63Q28-52 34-22Q14-10 0-13Z" fill="${P.roofDark}" opacity=".45"/>
    <path d="M-29-24Q-16-49 0-57M-20-19Q-12-38-6-43" fill="none" stroke="#a3bca0" stroke-width="1.5"/>
    <path d="M-16 4V-14Q-9-28-2-14V11Z" fill="${P.roofDark}"/>
    <path d="M-20 6L-5 14 6 8M-23 11L-6 19 7 13" fill="none" stroke="#f4e8cc" stroke-width="3"/>
    <path d="M-37 4V-24M-37-24L-21-20-37-13" stroke="#947c5a" fill="${P.trim}" stroke-width="2"/>
    <path d="M20 13V-4M24 11V-5" stroke="#638569" stroke-width="2"/>
    <path d="M16 10L28 4 31 11 20 17Z" fill="#cb9979"/></g>
    <ellipse class="window-light" cx="16" cy="-11" rx="5" ry="7" fill="#f0d292"/>
    <path d="M16-18V-4M11-11H21" stroke="${P.roofDark}" stroke-width="1.5"/></g>`;

  if(type==='A') return `<g class="architecture"><g class="architecture-body">
    <path d="M-36 0L0-18 37 0V7L0 25-36 7Z" fill="#bec4ab"/><path d="M-36 0L0 18 37 0 0-18Z" fill="#f1e5c8"/>
    <path d="M-29-7V-42L0-57 29-42V-7L0 8Z" fill="${P.wall}"/><path d="M0-27L29-42V-7L0 8Z" fill="#bdcbb7"/>
    <path d="M-33-44L0-61 33-44 0-27Z" fill="${P.roof}"/><path d="M-33-44V-39L0-22 33-39V-44L0-27Z" fill="${P.roofDark}"/>
    <path d="M-26-45L0-58 26-45 0-32Z" fill="none" stroke="#96b7a0" stroke-width="1"/>
    <path d="M-17-6V-23Q-10-37-3-16V1Z" fill="${P.roofDark}"/><path d="M-20-8V-25Q-11-43 0-18V2" fill="none" stroke="#fff8e3" stroke-width="3"/>
    <path d="M-23 7L-6 16 9 8M-26 11L-7 21 9 13" fill="none" stroke="#f9f0d8" stroke-width="3"/>
    <path d="M-11-51V-62L2-69 15-62V-51L2-44Z" fill="${P.wall}"/><path d="M2-55L15-62V-51L2-44Z" fill="#c4cfb8"/>
    <path d="M-14-63L2-71 18-63 2-55Z" fill="${P.roof}"/></g>
    <path class="window-light" d="M8-18L20-24V-13L8-7Z" fill="#efce8b"/><path d="M14-21V-10" stroke="${P.roofDark}" stroke-width="1.7"/>
    ${type==='home'?`<path d="M-37-11V-44M-37-44L-19-40-37-31" fill="${P.trim}" stroke="#927c5d" stroke-width="2"/>`:tree(34,-5,.52)}</g>`;

  if(type==='B') return `<g class="architecture">${tree(-14,-5,.98)}<g class="architecture-body">
    <path d="M6 9L24 18 40 10 22 1Z" fill="#f3e5c5"/><path d="M6 9V14L24 23 40 15V10L24 18Z" fill="#bcaa88"/>
    <path d="M12 15V21M34 15V21" stroke="#8f9473" stroke-width="3"/><path d="M8 3L24 11 40 3V-2L24 6 8-2Z" fill="${P.wood}"/></g></g>`;
  if(type==='C') return `<g class="architecture"><g class="architecture-body">
    <path d="M-34-1L0-18 34-1V6L0 23-34 6Z" fill="#bbab8b"/><path d="M-34-1L0-18 34-1 0 16Z" fill="${P.path}"/>
    <path d="M-27-1L0-14 27-1 0 12Z" fill="#8a9b75"/></g>
    ${[-18,0,18].map((x,i)=>`<g class="vegetation" transform="translate(${x} ${i%2?-6:0})"><path d="M0 1V-14M0-5L-6-9M0-7L6-12" stroke="#4b7e5c" stroke-width="2"/><path d="M0-24L7-17 0-10-7-17Z" fill="${i===1?'#fff0bf':P.trim}"/><circle cy="-17" r="2.5" fill="#fff7d2"/></g>`).join('')}</g>`;
  return `<g class="architecture"><g class="architecture-body"><path d="M-17 2L2-8 24 3 5 13Z" fill="${P.path}"/><path d="M-12 2L3-5 18 3 4 10Z" fill="${P.trim}"/><path d="M-6 1L8 8M0-2L14 5" stroke="#f4dfbf" stroke-width="2"/><path d="M19-5L25-8 31-5V1L25 4 19 1Z" fill="#f2dfb7"/></g>${tree(-29,-9,.5)}</g>`;
}

function tile(p,day,newId,selectedId,paint) {
  const s=project(p.x,p.y),home=p.grade==='home',planned=!day.started;
  const t=home?null:day.tasks.find(t=>t.id===p.taskId);
  const label=home?'起点':`${THEME.assets[p.grade]}：${t?.name||''}`;
  const newClass=newId===p.taskId?'land-new':'';
  return `<g class="land ${newClass} ${selectedId===p.taskId?'land-selected':''}" transform="translate(${s.x} ${s.y})" data-tile="${p.x},${p.y}" role="button" tabindex="0" aria-label="${esc(label)}" aria-description="单击前往，双击查看；键盘 Shift 加回车查看">
    <g class="land-surface"><g class="terrain-faces">
      <path d="M-68 0L0 34 68 0V22L0 56-68 22Z" fill="${planned?'#b7c7c3':'#a4b5a4'}"/>
      <path d="M-68 0L0 34V56L-68 22Z" fill="${planned?'#dce2d8':paint('stone')}"/>
      <path d="M0 34L68 0V22L0 56Z" fill="${planned?'#bccdc5':paint('stoneShade')}"/>
      <path d="M-68 0L0-34 68 0 0 34Z" fill="${planned?'#e5e8db':paint('grass')}" stroke="${planned?'#f8fbef':'#dae7bd'}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M-68 0L0 34 68 0V6L0 40-68 6Z" fill="${planned?'#c5d0bf':P.grassDark}" opacity=".8"/>
      <path d="M-65-1L0-33 65-1" fill="none" stroke="#ffffe4" stroke-width="1" opacity=".5"/>
      <path d="M-68 17L0 51 68 17V22L0 56-68 22Z" fill="#629b93" opacity=".38"/>
      <path d="M0 40V51M-43 30L-23 40M25 41L44 32" fill="none" stroke="#809a87" stroke-width="1" opacity=".28"/>
    </g>
    <path class="tile-outline" d="M-64 0L0-32 64 0 0 32Z" fill="none" stroke="#fff8db" stroke-width="2.5" opacity="0" pointer-events="none"/>
    ${!planned?'<path d="M-47 0l3-4m-1 6l5-2M34 19l2-5m0 7l5-3" stroke="#6e996b" stroke-width="1.8" stroke-linecap="round"/>':''}
    </g>${newClass?'<path class="spawn-ring" d="M-70 0L0-35 70 0 0 35Z" fill="none" stroke="#fff7ca" stroke-width="2" opacity="0"/>':''}</g>`;
}

function architectureLayer(p,day,newId){
  const s=project(p.x,p.y),depth=depthPoint(p);
  const content=day.started?house(p.grade):'<g class="planned-marker"><path d="M-19 4L0-6 19 4 0 14Z" fill="#f8faef"/><path d="M0 2V-34M0-34L19-28 0-19" fill="#fafff3" stroke="#95b7b0" stroke-width="2"/></g>';
  return `<g class="architecture-layer" data-building="${p.x},${p.y}" data-depth-y="${depth.y}" data-depth-x="${depth.x}"${newId===p.taskId?' data-new="true"':''} transform="translate(${s.x} ${s.y})" pointer-events="visiblePainted">${content}</g>`;
}

function character(player,idPrefix) {
  const p=project(player.x,player.y);
  return `<g id="${idPrefix}er" data-motion="idle" data-activity="none" transform="translate(${p.x+ACTOR_LANE.x} ${p.y-6+ACTOR_LANE.y})" aria-hidden="true" pointer-events="none">
    <ellipse cy="11" rx="9" ry="3.5" fill="#254e42" opacity=".20"/>
    <ellipse class="islander-halo" cy="9" rx="20" ry="10" fill="none" stroke="#fff3b0" stroke-width="2" opacity="0"/>
    <g id="${idPrefix}Facing"><g class="islander-body" id="${idPrefix}Body">
    <g transform="translate(-3 5)"><g id="${idPrefix}LeftLeg"><path d="M0 0L-1 4 0 8" stroke="#35584e" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M-1 8H3" stroke="#28473f" stroke-width="3" stroke-linecap="round"/></g></g>
    <g transform="translate(4 5)"><g id="${idPrefix}RightLeg"><path d="M0 0L1 4 0 8" stroke="#476759" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M-1 8H3" stroke="#28473f" stroke-width="3" stroke-linecap="round"/></g></g>
    <g transform="translate(-6 -5)"><g id="${idPrefix}LeftArm"><path d="M0 0L-3 4-1 8" stroke="#edc58e" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>
    <path d="M-6-5Q0-10 6-5L7 6Q0 9-7 6Z" fill="#d8a566"/><path d="M3-6L7 6 3 8Z" fill="#bf8752"/>
    <g transform="translate(6 -5)"><g id="${idPrefix}RightArm"><path d="M0 0L3 4 1 8" stroke="#f3d9a7" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>
    <circle cy="-14" r="8" fill="#ffeacf"/><path d="M-8-14Q-10-26 1-26Q11-25 9-14L5-18-7-15Z" fill="#3c6358"/>
    <path class="islander-scarf" d="M-6-6Q0-2 6-6M4-4L12 0" stroke="#b46f51" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="3" cy="-13" r="1" fill="#526253"/></g>
    <g class="idle-fishing-gear"><path d="M8 1Q21-28 43-24" fill="none" stroke="#896947" stroke-width="1.8"/><path d="M43-24L52 50" fill="none" stroke="#dbe7d7" stroke-width=".9"/><ellipse class="fishing-ripple" cx="52" cy="52" rx="8" ry="2.5" fill="none" stroke="#f7fff0" stroke-width="1"/><path d="M52 48V53" stroke="#c58261" stroke-width="2"/></g>
    <g class="idle-look-gear"><path d="M-7-18L0-20 6-16" fill="none" stroke="#efcf9f" stroke-width="3" stroke-linecap="round"/></g>
    </g></g>`;
}

export function renderScene(d,{player={x:0,y:0},newId=null,selectedId=null,idPrefix='island',showPlayer=true}={}) {
  const paint=name=>`url(#${idPrefix}-${name})`;
  const tiles=[{x:0,y:0,grade:'home',taskId:'home'},...d.tiles].sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);
  const pts=tiles.map(t=>project(t.x,t.y));
  const minX=Math.min(-125,...pts.map(p=>p.x-110)),maxX=Math.max(125,...pts.map(p=>p.x+110));
  const minY=Math.min(-145,...pts.map(p=>p.y-137)),maxY=Math.max(95,...pts.map(p=>p.y+80));
  const scale=Math.min(1.65,620/(maxX-minX),390/(maxY-minY));
  const tx=470-(minX+maxX)/2*scale,ty=352-(minY+maxY)/2*scale;
  const coast=coastPath(tiles),world=`translate(${tx} ${ty}) scale(${scale})`,sea=renderSea(idPrefix);
  const objects=tiles.map(tile=>({depth:depthPoint(tile),html:architectureLayer(tile,d,newId)}));
  if(showPlayer)objects.push({depth:depthPoint(player,{x:ACTOR_LANE.x,y:ACTOR_LANE.y+5}),html:character(player,idPrefix)});
  objects.sort((a,b)=>compareDepth(a.depth,b.depth));
  return `<svg id="${idPrefix}Map" viewBox="0 0 940 650" aria-label="每日岛屿互动地图" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${idPrefix}-grass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${P.grassLight}"/><stop offset="1" stop-color="${P.grass}"/></linearGradient>
      <linearGradient id="${idPrefix}-stone" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#eee4c8"/><stop offset="1" stop-color="#cec6a9"/></linearGradient>
      <linearGradient id="${idPrefix}-stoneShade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9c6ad"/><stop offset="1" stop-color="#94ac9d"/></linearGradient>
      <radialGradient id="${idPrefix}-seaGlow"><stop stop-color="#fcffe5" stop-opacity=".36"/><stop offset="1" stop-color="#fcffe5" stop-opacity="0"/></radialGradient>
      <mask id="${idPrefix}-water-only" maskUnits="userSpaceOnUse" x="0" y="0" width="940" height="650"><rect width="940" height="650" fill="white"/><path d="${coast}" transform="${world}" fill="black" fill-rule="evenodd" stroke="black" stroke-width="45" stroke-linejoin="round"/></mask>
    </defs>
    <ellipse cx="470" cy="370" rx="400" ry="235" fill="${paint('seaGlow')}"/>
    <g class="sea-lines" fill="none" stroke="currentColor" opacity=".23" stroke-width="1" stroke-linecap="round"><path d="M87 240q22 6 44 0m14 19q15 5 30 0M714 280q25 7 50 0M142 492q22 7 45 0M700 520q25 7 51 0M300 173q17 5 33 0M793 433q14 5 29 0M170 560q28 6 56 0M590 565q20 5 40 0"/></g>
    <g class="night-sky" fill="#e1efd8" opacity="0" aria-hidden="true"><path d="M748 119a18 18 0 1 0 19 28 21 21 0 0 1-19-28Z"/><circle cx="200" cy="164" r="1.6"/><circle cx="320" cy="116" r="1.4"/><circle cx="640" cy="163" r="1.8"/><circle cx="846" cy="251" r="1.3"/><circle cx="126" cy="345" r="1.6"/><circle cx="551" cy="109" r="1.2"/></g>
    <g class="cloud" fill="#fffdf1" opacity=".18" aria-hidden="true"><path d="M139 190l60-30 69 34-60 30Z"/><path d="M746 463l40-20 54 27-40 20Z"/></g>
    ${sea.water}
    <g transform="${world}">
      <g class="shore-waves" aria-hidden="true" pointer-events="none"><path class="shore-surge surge-one" d="${coast}" fill="none" stroke="#f3ffed" stroke-width="30" stroke-linejoin="round"/><path class="shore-surge surge-two" d="${coast}" fill="none" stroke="#e2f6e3" stroke-width="30" stroke-linejoin="round"/></g>
      <g class="shoreline" aria-hidden="true"><path d="${coast}" fill="#76aaa1" fill-rule="evenodd" stroke="#79b9b0" stroke-width="22" stroke-linejoin="round" opacity=".34"/><path d="${coast}" fill="#d9dbb3" fill-rule="evenodd" stroke="#dce1ba" stroke-width="8" stroke-linejoin="round"/><path class="shore-foam" d="${coast}" fill="none" stroke="#f4ffdf" stroke-width="10" stroke-dasharray="34 12 9 15" stroke-linejoin="round" opacity=".75"/></g>
      ${tiles.map(p=>tile(p,d,newId,selectedId,paint)).join('')}
      <g id="${idPrefix}DepthLayer" class="depth-layer">${objects.map(o=>o.html).join('')}</g>
    </g>
    ${sea.sky}
    <g transform="translate(837 531)" fill="none" stroke="currentColor" opacity=".5" aria-hidden="true"><path d="M0-18V18M-18 0H18" stroke-width=".7"/><path d="M0-13L4 0 0 13-4 0Z" fill="currentColor" stroke="none"/><text y="-27" text-anchor="middle" fill="currentColor" stroke="none" font-size="10">N</text></g>
  </svg>`;
}

