// Ambient SVG only. No timers, saved state or interactive hit areas.
export function renderSea(prefix){
  const fish=(x,y,variant)=>`<g transform="translate(${x} ${y})" class="fish-scene ${variant}">
    <ellipse class="fish-shadow" cy="6" rx="23" ry="5" fill="#568e88" opacity=".12"/>
    <g class="fish-jump"><path d="M-12 0Q0-12 13-1Q1 11-12 0L-19-7-18 6Z" fill="#79a9a3"/><path d="M-10 1Q0 7 10 0" stroke="#e1eee0" stroke-width="2" fill="none"/><path d="M0-6L-4-13 6-8" fill="#689991"/><circle cx="8" cy="-2" r="1.2" fill="#335e5d"/></g>
    <g transform="translate(66 0)"><ellipse class="fish-ripple" rx="16" ry="5" fill="none" stroke="#f2fff1" stroke-width="2"/><path class="fish-splash" d="M-4-4L-9-14M1-5V-18M6-4L12-12" fill="none" stroke="#efffec" stroke-width="2" stroke-linecap="round"/></g>
  </g>`;
  const bird=(x,y,scale,delay)=>`<g transform="translate(${x} ${y}) scale(${scale})"><g class="gull-wings" style="animation-delay:${delay}s"><path d="M0 1Q-10-12-22-5Q-10-7 0 1Q10-12 22-5Q10-7 0 1" fill="#fffdf0" stroke="#678c88" stroke-width=".8" stroke-linejoin="round"/><path d="M-2 1L0 6 3 1" fill="#e1e8d7"/></g></g>`;
  return {
    water:`<g class="sea-life water-life" mask="url(#${prefix}-water-only)" aria-hidden="true" pointer-events="none">
      <g class="water-sheen" fill="none" stroke="#f1fff0" stroke-linecap="round"><path d="M70 338q45-14 90 0m-35 14q25-7 50 0M697 370q65-17 130-1m-84 15q29-8 58 0M292 559q55-11 110 0M85 491q24-7 48 0" stroke-width="2"/><path d="M225 214q39-10 78 0M655 248q30-9 60 0M587 574q43-10 86 0M110 569q32-10 64 0" stroke-width="1"/></g>
      <g class="water-current" fill="none" stroke="#76aca5" stroke-width="1.2" stroke-linecap="round"><path d="M61 414q34 10 68 0M731 510q40 12 80 0M268 601q30 8 60 0M569 201q28 7 56 0M160 263q20 6 40 0"/></g>
      ${fish(170,452,'fish-one')}${fish(735,487,'fish-two')}
    </g>`,
    sky:`<g class="sea-life sky-life" aria-hidden="true" pointer-events="none"><g class="gull-flight">${bird(0,0,1,0)}${bird(-48,20,.73,-.2)}${bird(-77,-12,.6,-.45)}</g></g>`
  };
}

