/**
 * Original ink-and-watercolour artwork for the island journal.
 * All exports return SVG fragments; the journal owns the SVG and interaction.
 */
const PALETTES = {
  completed: {
    ink: '#284B47', shore: '#E5CE9E', shoreLight: '#F8EBCD',
    land: '#8FA878', light: '#B2C394', shade: '#6D8C68',
    rock: '#7D9383', rockLight: '#ADB5A0', wood: '#926849',
    paper: '#FFF4D8', accent: '#BD8B36', water: '#7AAEAA',
  },
  incomplete: {
    ink: '#687266', shore: '#DDD0AD', shoreLight: '#EEE5CE',
    land: '#A3AA8B', light: '#BCC0A1', shade: '#85917A',
    rock: '#959B89', rockLight: '#BCC0AB', wood: '#95816A',
    paper: '#F5EFDC', accent: '#A77754', water: '#91B7B0',
  },
  future: {
    ink: '#879F9C', shore: '#CFDBCF', shoreLight: '#E2E8D9',
    land: '#BCCFC0', light: '#D1DCD0', shade: '#A8BFB2',
    rock: '#A3BAB4', rockLight: '#CBD8CD', wood: '#A5B4A7',
    paper: '#E6EDE2', accent: '#A3B7AC', water: '#AAC9C2',
  },
};

const SHORES = [
  'M-57 1C-63-9-46-18-34-19C-28-29-9-28 3-24C18-31 32-22 39-16C55-15 63-5 57 5C66 16 44 26 28 25C18 33-1 28-10 29C-24 35-45 24-45 18C-59 18-65 10-57 1Z',
  'M-55-6C-48-19-32-18-23-23C-9-31 1-24 10-20C27-28 35-17 37-9C55-11 63 3 57 12C53 24 38 23 29 29C16 36 4 27-8 27C-25 32-32 20-41 18C-56 18-64 7-55-6Z',
  'M-56 6C-60-5-47-13-39-17C-34-28-18-28-7-23C6-30 22-23 29-16C46-19 55-7 53 1C64 12 49 22 37 22C31 32 13 32 3 25C-12 32-26 26-35 22C-49 26-64 18-56 6Z',
  'M-54-3C-54-17-33-15-24-21C-14-29 1-26 9-21C25-24 31-18 37-10C51-12 63 1 58 10C53 21 37 23 30 29C17 32 3 24-7 27C-22 31-35 22-42 17C-60 16-63 5-54-3Z',
  'M-59 2C-59-8-48-17-34-16C-22-29-6-25 5-20C18-27 35-22 38-12C52-12 62-1 56 10C60 21 45 26 32 23C21 29 12 28 2 21C-8 14-10 8-19 12C-26 16-27 25-36 25C-51 24-64 15-59 2Z',
  'M-55 1C-58-12-43-20-30-19C-17-30-4-26 5-22C19-26 33-18 35-11C52-15 63-4 57 7C61 20 42 25 29 23C21 34 3 29-6 26C-20 30-30 22-40 22C-55 21-63 12-55 1Z',
  'M-58 3C-60-9-45-14-37-18C-31-30-13-29-2-22C11-29 25-23 30-16C44-18 59-8 56 3C64 13 52 23 39 24C29 33 16 30 7 24C-7 29-22 27-31 22C-45 26-61 17-58 3Z',
];

const LANDS = [
  'M-47 0C-48-11-35-12-26-16C-13-22-4-14 5-18C17-22 29-15 31-9C45-10 51-2 47 6C46 15 33 18 22 17C11 23-1 18-11 20C-26 22-29 14-37 13C-48 12-53 7-47 0Z',
  'M-45-3C-38-14-27-12-18-17C-7-22 3-15 11-13C23-18 29-9 29-4C44-5 49 5 45 12C38 20 28 15 21 22C9 26 3 18-7 20C-20 24-26 15-34 12C-46 13-51 4-45-3Z',
  'M-47 5C-49-4-36-7-31-13C-25-22-13-21-5-17C7-22 19-15 22-10C37-13 45-5 43 3C52 12 38 14 31 17C24 25 12 22 3 18C-11 24-20 18-29 16C-40 20-52 13-47 5Z',
  'M-45-1C-45-10-28-9-19-15C-10-22 1-17 10-15C23-18 25-9 31-4C44-7 50 3 46 10C42 16 32 15 25 21C13 24 5 17-6 20C-19 23-26 15-36 12C-47 11-52 5-45-1Z',
  'M-49 3C-50-6-39-10-28-10C-18-22-7-17 4-13C16-21 26-14 30-6C43-8 49 0 46 7C47 17 35 17 27 16C16 23 11 18 5 14C-5 5-14 0-23 7C-32 10-30 18-38 17C-47 15-53 11-49 3Z',
  'M-46 1C-49-8-35-13-26-13C-15-23-4-17 6-15C17-19 23-12 29-5C43-10 50-2 46 7C46 16 34 18 23 17C16 25 3 21-5 19C-16 23-25 15-35 16C-46 15-51 9-46 1Z',
  'M-48 3C-49-5-35-8-29-13C-22-23-12-21-2-15C10-22 19-16 24-10C37-12 49-5 46 4C51 12 41 16 31 18C23 25 14 23 7 17C-5 23-15 20-25 16C-39 21-49 11-48 3Z',
];

function pine(x, y, scale, p) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M0 0V-24" stroke="${p.wood}" stroke-width="2.2"/>
    <path d="M0-32-11-16H-6L-14-5H14L6-16H11Z" fill="${p.shade}" stroke="${p.ink}" stroke-width="1.25"/>
    <path d="M0-29-7-17H-3L-9-8H0Z" fill="${p.land}" stroke="none"/>
  </g>`;
}

function palm(x, y, scale, p) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-1 1Q6-13 1-28" fill="none" stroke="${p.ink}" stroke-width="4"/>
    <path d="M-1 1Q6-13 1-28" fill="none" stroke="${p.wood}" stroke-width="2"/>
    <path d="M1-27Q-12-38-19-26Q-8-29 0-25Q-14-26-17-14Q-8-20 2-25Q5-40 15-33Q7-31 4-25Q19-30 22-19Q12-24 3-24Q13-19 10-9Q7-18 2-24Z" fill="${p.shade}" stroke="${p.ink}" stroke-width="1.15"/>
    <path d="M1-27Q-6-33-14-29M4-26 13-31M5-24 17-21" fill="none" stroke="${p.light}" stroke-width="1"/>
    <circle cx="1" cy="-23" r="2" fill="${p.wood}"/>
  </g>`;
}

function pennant(x, y, p, direction = 1) {
  return `<g transform="translate(${x} ${y})">
    <path d="M0 0V-17" stroke="${p.ink}" stroke-width="1.3"/>
    <path d="M0-17 ${12 * direction}-14 0-10Z" fill="${p.accent}" stroke="${p.ink}" stroke-width=".8"/>
  </g>`;
}

function landmarks(index, p) {
  switch (index) {
    case 0:
      return `${pine(-31, 6, .65, p)}${pine(29, 5, .55, p)}
        <path d="M-11 10-8-28H7L12 10Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M-10-1H10L9-9H-9ZM-8-23H8L7-28H-8Z" fill="${p.accent}" opacity=".85"/>
        <path d="M-10-28V-36H10V-28ZM-13-36 0-44 13-36Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="1.4"/>
        <path d="M-6-29V-34H-1V-29M3-29V-34H7V-29" fill="${p.paper}" stroke="${p.paper}" stroke-width="1"/>
        <path d="M-3 10V2Q0-2 3 2V10" fill="${p.wood}" stroke="${p.ink}" stroke-width="1"/>
        <path d="M-15 12H16M-12 15H12" stroke="${p.ink}" stroke-width="1.2" opacity=".65"/>
        ${pennant(18, -9, p)}`;
    case 1:
      return `${palm(-16, 10, 1.15, p)}${palm(18, 3, .92, p)}${palm(-37, 3, .65, p)}
        <path d="M-6 13Q7 6 25 13Q14 20-6 17Z" fill="${p.water}" stroke="${p.ink}" stroke-width=".8"/>
        <path d="M2 14Q10 11 17 13" fill="none" stroke="${p.shoreLight}" stroke-width="1.3"/>
        <path d="M31 9 38 5 42 9 39 12H32Z" fill="${p.rock}" stroke="${p.ink}" stroke-width=".9"/>
        ${pennant(33, 1, p)}`;
    case 2:
      return `<path d="M-43 11-16-43 15 12Z" fill="${p.rock}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M-16-43-8 7 15 12Z" fill="${p.shade}" stroke="${p.ink}" stroke-width=".8"/>
        <path d="M-23-28-16-43-5-23-14-28-20-23Z" fill="${p.paper}" stroke="${p.ink}" stroke-width=".8"/>
        <path d="M-9 14 18-29 43 14Z" fill="${p.rockLight}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M18-29 24 10 43 14Z" fill="${p.rock}" stroke="${p.ink}" stroke-width=".8"/>
        <path d="M11-18 18-29 26-15 18-19 15-15Z" fill="${p.paper}" stroke="${p.ink}" stroke-width=".8"/>
        <path d="M-33 6-25-7M-23 6-20-3M8 10 14 0M29 7 26 0" stroke="${p.ink}" stroke-width=".9" opacity=".5"/>
        ${pine(-36, 15, .48, p)}${pine(37, 16, .45, p)}${pennant(-8, -30, p)}`;
    case 3:
      return `<path d="M-32 16H34L28 9H-26Z" fill="${p.rock}" stroke="${p.ink}" stroke-width="1.2"/>
        <path d="M-27 9H28L24 4H-23Z" fill="${p.rockLight}" stroke="${p.ink}" stroke-width="1.2"/>
        <path d="M-21 4V-25H-12V4M13 4V-25H22V4" fill="${p.paper}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M-25-24V-30H26V-24ZM-27-31-1-43 28-31Z" fill="${p.rockLight}" stroke="${p.ink}" stroke-width="1.4"/>
        <path d="M-16-20V0M18-20V0M-9-31H12" stroke="${p.rock}" stroke-width="1.5"/>
        <path d="M-3 4V-14H5V4M-5-14H7V-19H-5Z" fill="${p.rockLight}" stroke="${p.ink}" stroke-width="1.1"/>
        <path d="M-26-29Q-17-22-22-13M22-24Q29-15 21-8" fill="none" stroke="${p.shade}" stroke-width="3"/>
        <path d="M-28 5Q-35 0-31-7Q-25-5-28 5M29 8Q38-1 37 8Q36 13 29 12" fill="${p.land}" stroke="${p.ink}" stroke-width=".9"/>
        ${pennant(35, -3, p)}`;
    case 4:
      return `${pine(-34, -1, .68, p)}
        <path d="M-21 8V-14H5V8Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="1.4"/>
        <path d="M-25-14-9-29 9-14Z" fill="${p.wood}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M-22-13 8-13M-21-17H2M-17-21H-3" stroke="${p.shoreLight}" stroke-width=".8" opacity=".6"/>
        <path d="M-12 8V-3H-5V8" fill="${p.wood}" stroke="${p.ink}" stroke-width="1"/>
        <path d="M-18-8H-14V-3H-18ZM-2-8H2V-3H-2Z" fill="${p.water}" stroke="${p.ink}" stroke-width=".8"/>
        <path d="M13 6V-8H34V6Z" fill="${p.shoreLight}" stroke="${p.ink}" stroke-width="1.2"/>
        <path d="M9-8 23-20 38-8Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="1.2"/>
        <path d="M22 6V-2H27V6" fill="${p.wood}" stroke="${p.ink}" stroke-width=".9"/>
        <path d="M-17 17-6 20 6 30M-20 21-9 24 3 34" fill="none" stroke="${p.wood}" stroke-width="2.4"/>
        <path d="M-16 18-19 23M-10 20-13 25M-5 23-8 28M0 27-3 31" stroke="${p.ink}" stroke-width="1.2"/>
        ${pennant(39, -4, p)}`;
    case 5:
      return `${pine(-35, 8, .66, p)}${pine(31, 6, .55, p)}
        <path d="M-13 12-8-24H7L13 12Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M-12-23 0-34 12-23Z" fill="${p.wood}" stroke="${p.ink}" stroke-width="1.3"/>
        <path d="M-3 12V4Q0 0 3 4V12" fill="${p.wood}" stroke="${p.ink}" stroke-width="1"/>
        <g transform="translate(0 -19) rotate(24)">
          <path d="M0-25V25M-25 0H25" stroke="${p.ink}" stroke-width="2"/>
          <path d="M1-24H8V-5H1ZM24 1V8H5V1ZM-1 24H-8V5H-1ZM-24-1V-8H-5V-1Z" fill="${p.shoreLight}" stroke="${p.ink}" stroke-width="1.1"/>
          <path d="M1-17H8M1-11H8M17 1V8M11 1V8M-1 17H-8M-1 11H-8M-17-1V-8M-11-1V-8" stroke="${p.wood}" stroke-width=".8"/>
          <circle r="3" fill="${p.accent}" stroke="${p.ink}" stroke-width="1"/>
        </g>
        <path d="M-27 12Q-23 4-17 11M19 13Q23 5 28 13" fill="${p.light}" stroke="${p.ink}" stroke-width=".8"/>
        ${pennant(22, -7, p)}`;
    default:
      return `<path d="M-28 16-22 8H25L31 16Z" fill="${p.rock}" stroke="${p.ink}" stroke-width="1.2"/>
        <path d="M-21 8V-17H22V8Z" fill="${p.paper}" stroke="${p.ink}" stroke-width="1.4"/>
        <path d="M-24-17A25 25 0 0 1 25-17Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="1.5"/>
        <path d="M-16-19Q-14-37 0-41M4-41Q16-34 18-19" fill="none" stroke="${p.shoreLight}" stroke-width="1.2"/>
        <path d="M-25-17H26V-13H-25Z" fill="${p.rockLight}" stroke="${p.ink}" stroke-width="1"/>
        <path d="M-4 8V-3Q0-8 4-3V8M-15-7H-10V-1H-15ZM11-7H16V-1H11Z" fill="${p.water}" stroke="${p.ink}" stroke-width="1"/>
        <path d="M-2-38 10-48 14-44 2-34Z" fill="${p.ink}" stroke="${p.ink}" stroke-width="1"/>
        <path d="M11-49 16-43" stroke="${p.accent}" stroke-width="3"/>
        ${pine(-37, 13, .55, p)}${pine(36, 13, .5, p)}${pennant(32, -10, p)}`;
  }
}

// Add future island artwork here; the weekly generator samples this registry.
function coastGeometry(path){
  const commands=path.match(/[MC][^MCZ]+/g),boundary=[];
  let current;let berth={x:0,y:-Infinity};
  const point=(a,b,c,d,t)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;
  for(const command of commands){
    const v=command.slice(1).match(/-?\d+(?:\.\d+)?/g).map(Number);
    if(command[0]==='M'){current={x:v[0],y:v[1]};boundary.push(current);continue;}
    const from=current,c1={x:v[0],y:v[1]},c2={x:v[2],y:v[3]},to={x:v[4],y:v[5]};
    const a=-from.y+3*c1.y-3*c2.y+to.y,b=2*(from.y-2*c1.y+c2.y),c=c1.y-from.y;
    const candidates=[0,1],discriminant=b*b-4*a*c;
    if(Math.abs(a)<1e-10){if(Math.abs(b)>1e-10)candidates.push(-c/b);}
    else if(discriminant>=0)candidates.push((-b+Math.sqrt(discriminant))/(2*a),(-b-Math.sqrt(discriminant))/(2*a));
    for(const t of candidates.filter(t=>t>=0&&t<=1)){
      const p={x:point(from.x,c1.x,c2.x,to.x,t),y:point(from.y,c1.y,c2.y,to.y,t)};
      if(p.y>berth.y)berth=p;
    }
    for(let i=1;i<=32;i++){const t=i/32;boundary.push({x:point(from.x,c1.x,c2.x,to.x,t),y:point(from.y,c1.y,c2.y,to.y,t)});}
    current=to;
  }
  return {berth,boundary};
}
export const ISLAND_CATALOG=['lighthouse','palms','mountains','ruins','village','windmill','observatory'].map((id,index)=>({id,shore:SHORES[index],land:LANDS[index],landmark:index,...coastGeometry(SHORES[index])}));
/** Original archipelagos, centred on (0, 0). */
export function islandArt(index, status = 'incomplete') {
  const item=ISLAND_CATALOG[((Math.trunc(Number(index)||0)%ISLAND_CATALOG.length)+ISLAND_CATALOG.length)%ISLAND_CATALOG.length];
  const i=item.landmark;
  const state = Object.hasOwn(PALETTES, status) ? status : 'incomplete';
  const p = PALETTES[state];
  const future = state === 'future';
  const leftRockY = i % 2 ? 21 : 13;
  return `<g class="island-art island-art--${state}" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="0" cy="13" rx="68" ry="24" fill="${p.water}" opacity="${future ? '.15' : '.25'}"/>
    <path d="M-68 14Q-73 24-59 28M-53 35Q-35 42-19 39M34 34Q53 34 66 25M58-13Q71-8 70 2"
      fill="none" stroke="${p.shoreLight}" stroke-width="1.7" opacity=".8"/>
    <path d="${item.shore}" transform="translate(0 4)" fill="${p.water}" stroke="none" opacity=".55"/>
    <path d="${item.shore}" fill="${p.shore}" stroke="${p.ink}" stroke-width="1.5"${future ? ' stroke-dasharray="3 4"' : ''}/>
    <path d="${item.shore}" transform="translate(0 -.8) scale(.94 .9)" fill="none" stroke="${p.shoreLight}" stroke-width="2.2" opacity=".85"/>
    <path d="${item.land}" fill="${p.land}" stroke="${p.ink}" stroke-width=".8"/>
    <path d="M-38 6Q-28-4-16 2M17 12Q28 5 39 10M-16 15-11 16M-29 12-25 13" fill="none" stroke="${p.light}" stroke-width="2.5"/>
    <path d="M-65 ${leftRockY}l5-7 8 3 3 8-10 3-8-3Z" fill="${p.shore}" stroke="${p.ink}" stroke-width=".9"/>
    <path d="M-62 ${leftRockY}l4-8 6 9Z" fill="${p.rock}" stroke="${p.ink}" stroke-width=".9"/>
    <path d="M56 24l4-6 10 1 4 7-9 4-9-2Z" fill="${p.shore}" stroke="${p.ink}" stroke-width=".9"/>
    <path d="M60 23l5-10 5 12Z" fill="${p.rock}" stroke="${p.ink}" stroke-width=".9"/>
    <path d="M65 13v11l5 1Z" fill="${p.shade}" stroke="none"/>
    <g class="island-landmark"${future ? ' opacity=".62"' : ''}>${landmarks(i, p)}</g>
    ${future ? `<g class="island-mist" fill="${p.paper}" opacity=".7">
      <path d="M-52 8Q-43 1-33 5Q-28-3-17 3Q-6-3 1 6Q11 2 20 8Q33 1 44 7Q53 5 57 12Q35 18 15 13Q-5 19-21 13Q-39 17-52 8Z"/>
      <path d="M-34-22Q-24-28-14-23Q-5-28 4-23Q14-26 22-20Q0-17-14-19Q-25-17-34-22Z" opacity=".6"/>
    </g>` : ''}
    <path d="M-41 24h4M-35 26h2M22 25h3M30 26h2" stroke="${p.wood}" stroke-width="1" opacity=".5"/>
  </g>`;
}

/** A three-masted expedition ship, with its prow pointing right. */
export function shipArt() {
  return `<g class="journal-ship-art" stroke-linecap="round" stroke-linejoin="round">
    <g class="ship-wake" fill="none" stroke="#F9F5E7" stroke-linecap="round">
      <path d="M-29 23Q-43 17-54 22M-29 28Q-42 32-51 29" stroke-width="2.3" opacity=".9"/>
      <path d="M-35 18Q-43 13-48 16M-36 34Q-42 37-48 35M-56 26H-61" stroke-width="1.5" opacity=".7"/>
      <circle cx="-54" cy="16" r="1" fill="#F9F5E7" stroke="none"/>
      <circle cx="-58" cy="31" r="1.3" fill="#F9F5E7" stroke="none"/>
    </g>
    <ellipse cx="1" cy="29" rx="33" ry="5" fill="#397D83" opacity=".2"/>
    <path d="M-26 13V-21M-6 12V-34M13 13V-25" stroke="#243F42" stroke-width="2.2"/>
    <path d="M-25 13V-20M-5 12V-33M14 13V-24" stroke="#BD8B36" stroke-width=".7"/>
    <path d="M-27-21-30 15M-5-34-24 13M-5-34 23 13M14-25 34 12M14-25 3 12"
      fill="none" stroke="#5C6355" stroke-width=".65" opacity=".8"/>
    <path d="M-6-34Q3-39 10-34L5-30Q0-34-6-31ZM13-25 24-22 14-19Z"
      fill="#BD8B36" stroke="#243F42" stroke-width=".7"/>
    <g class="ship-sails" fill="#FFF3D4" stroke="#243F42" stroke-width="1">
      <path d="M-28-19Q-20-22-13-18Q-8-9-14-1Q-22-4-29-1Q-23-10-28-19Z"/>
      <path d="M-16-29Q-5-32 6-28Q13-20 7-11Q-5-15-18-10Q-11-20-16-29Z"/>
      <path d="M-19-9Q-7-14 8-9Q16 1 9 12Q-5 8-21 13Q-13 1-19-9Z"/>
      <path d="M8-21Q16-24 23-19Q30-10 24-2Q17-5 6-1Q13-11 8-21Z"/>
      <path d="M16-16 33 8Q26 5 18 10Q23-1 16-16Z"/>
      <path d="M-16-28Q-9-23-14-13M-19-8Q-10 1-17 10M8-20Q15-11 9-3"
        fill="none" stroke="#E4C99C" stroke-width="2"/>
      <path d="M-4-26V-16M-9-21H1" fill="none" stroke="#BD8B36" stroke-width="1.4"/>
      <path d="M-4-6 0-1-4 4-8-1Z" fill="#BD8B36" stroke="none"/>
    </g>
    <path d="M-31 10Q-13 15 8 13L31 8 25 24Q12 31-13 28Q-25 25-31 10Z"
      fill="#865B3D" stroke="#243F42" stroke-width="1.5"/>
    <path d="M-28 15Q-7 22 28 13L24 19Q-2 27-24 20Z" fill="#B78A54"/>
    <path d="M-24 22Q-2 30 24 21M-25 17Q-3 24 26 16" fill="none" stroke="#243F42" stroke-width=".8"/>
    <path d="M-32 10Q-14 16 9 13L32 7" fill="none" stroke="#E2C184" stroke-width="2.5"/>
    <path d="M26 11Q32 12 34 5Q37 2 34 1Q29 3 30 7" fill="none" stroke="#BD8B36" stroke-width="2.2"/>
    <path d="M-30 11-31 3H-21V13" fill="#926849" stroke="#243F42" stroke-width="1.2"/>
    <path d="M-31 3H-20M-31 7H-21" stroke="#D8B77B" stroke-width="1.5"/>
    <path d="M-17 18v4M-8 20v4M2 20v4M12 18v4" stroke="#243F42" stroke-width="2.4"/>
    <path d="M-17 18v2M-8 20v2M2 20v2M12 18v2" stroke="#E5CE9E" stroke-width="1"/>
    <path d="M-25 30Q-6 34 16 30M22 28l7-2" fill="none" stroke="#F9F5E7" stroke-width="1.7" opacity=".9"/>
  </g>`;
}

function compass() {
  return `<g class="chart-compass" transform="translate(105 455)" stroke="#397D83" stroke-linejoin="round">
    <circle r="43" fill="#F5EFE0" fill-opacity=".18" stroke-width=".7" opacity=".65"/>
    <circle r="34" fill="none" stroke-width=".7" opacity=".6"/>
    <circle r="27" fill="none" stroke-width=".6" stroke-dasharray="1 4" opacity=".5"/>
    <path d="M0-48 7-8 0 0-7-8ZM48 0 8 7 0 0 8-7ZM0 48-7 8 0 0 7 8ZM-48 0-8-7 0 0-8 7Z"
      fill="#397D83" fill-opacity=".5" stroke-width=".8"/>
    <path d="M0-48V0L7-8ZM48 0H0L8 7ZM0 48V0L-7 8ZM-48 0H0L-8-7Z"
      fill="#F5EFE0" fill-opacity=".8" stroke-width=".6"/>
    <path d="m-25-25 20 18 5 7-7-5Zm50 0L7-5 0 0l5-7Zm0 50L5 7 0 0l7 5Zm-50 0L-7 5 0 0l-5 7Z"
      fill="#BD8B36" fill-opacity=".5" stroke-width=".6"/>
    <circle r="4" fill="#E5CE9E" stroke-width="1"/>
    <g fill="#397D83" stroke="none" font-family="Georgia, serif" font-size="9" text-anchor="middle" opacity=".85">
      <text y="-55">N</text><text x="58" y="3">E</text><text y="62">S</text><text x="-58" y="3">W</text>
    </g>
  </g>`;
}

function cloud(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#789E98" stroke-width=".8" stroke-linecap="round">
    <path d="M-48 9Q-58 0-46-5Q-47-18-34-19Q-29-34-12-27Q-2-40 13-30Q29-31 32-17Q49-18 49-5Q64-1 54 9Z"
      fill="#F7F3E6" fill-opacity=".78"/>
    <path d="M-38 8H43M-31 13H27M-22-17Q-18-25-10-22M14-16Q24-23 31-16M-49-1Q-40-7-34-1M-5 5H8"
      fill="none" opacity=".55"/>
  </g>`;
}

function seaMonster() {
  return `<g class="chart-sea-monster" transform="translate(700 316)" stroke="#397D83" stroke-linecap="round" stroke-linejoin="round" opacity=".62">
    <path d="M-34 14Q-26 5-18 12Q-7 23 6 12Q16 4 25 13Q34 18 40 11"
      fill="none" stroke="#EFF1DD" stroke-width="5"/>
    <path d="M-31 10Q-23-1-14 9Q-6 16 3 8Q10 2 18 10Q26 18 34 8"
      fill="none" stroke-width="4"/>
    <path d="M18 10Q30-5 23-16Q18-24 23-29Q29-34 35-28L41-24 34-20Q39-5 33 7L28 13"
      fill="#82ABA0" stroke-width="1.2"/>
    <path d="M25-26 23-33 29-30M31-29 34-35 35-28M35-19 41-16 36-12M36-9 42-5 35-3"
      fill="#E5CE9E" stroke-width="1"/>
    <path d="M-34 10-40 2-41 11-47 8-42 16Q-37 17-31 13" fill="#82ABA0" stroke-width="1"/>
    <circle cx="32" cy="-26" r="1.2" fill="#243F42" stroke="none"/>
    <path d="M33-20 38-21M24-14Q29-11 27-4M-22 18Q-16 22-8 19M8 20Q18 23 25 20M-46 21h10"
      fill="none" stroke-width=".8"/>
  </g>`;
}


function decoration({kind,x,y,scale=1}) {
  if(kind==='cloud')return cloud(x,y,scale);
  if(kind==='monster')return '<g transform="translate('+ (x-700*scale)+' '+(y-316*scale)+') scale('+scale+')">'+seaMonster()+'</g>';
  const shapes={
    reef:'<path d="M-25 12Q0 24 29 11" stroke="#edf2df" stroke-width="5"/><path d="m-22 8 11-25L1 11 11-16 27 12Z" fill="#8fa89b"/><path d="m-11-17 2 26M11-16l4 26"/>',
    birds:'<path d="M-25 0Q-16-10-6 0Q3-10 12 0M6-18q8-8 16 0q7-8 14-1"/>',
    whale:'<path d="M-36 9Q-23-15 3-8Q20-3 27 8l7-15 9 2-7 15Q17 24-11 17Z" fill="#8bafa5"/><path d="M-25 8q9 6 21 4M-2-8v-13m0 0q-7-12-12-5m12 5q7-12 12-5"/><circle cx="-23" cy="2" r="1.4" fill="#345d57"/>',
    buoy:'<path d="M-17 16q17 8 34 0M-10 8l5-19H5l5 19Z" fill="#d6bd87"/><path d="M-5-5H5M0-11v-15M-10 8H10M-16 21H16"/><circle cy="-29" r="3" fill="#fbefd0"/>',
    wreck:'<path d="m-28 6 15 18H17L32 3Q6 12-28 6Z" fill="#b08b62"/><path d="M-8 8v-36l19 23H-8M-24 14l48-2M-12 22l28-2"/><path d="M-29 26q18 8 37 1" stroke="#f3f2df"/>',
    fish:'<path d="M-23 1Q-7-13 10 0Q-6 13-23 1Z" fill="#9cb8a8"/><path d="m10 0 11-10v19ZM-27 16q23 6 47-1"/><circle cx="-15" r="1.1" fill="#345d57"/>'
  };
  return '<g class="chart-ocean-scene" transform="translate('+x+' '+y+') scale('+scale+')" fill="none" stroke="#557f76" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".65">'+(shapes[kind]||shapes.reef)+'</g>';
}
export function mapDecorations(decorations=[]) {
  return '<g class="chart-decoration" data-ocean-count="'+decorations.length+'" aria-hidden="true" pointer-events="none"><g fill="none" stroke="#397d83" opacity=".16" stroke-width=".8"><path d="M24 70V24H70M930 24H976V70M976 530V576H930M70 576H24V530"/>'+'</g>'+compass()+decorations.map(decoration).join('')+'</g>';
}

