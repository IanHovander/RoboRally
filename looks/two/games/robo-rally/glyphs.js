// Small ink pictures for the screens (instead of words and emoji). 24x24, drawn in currentColor.
//   glyph('flag')  ->  '<svg class="g g-flag" ...>'
const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';

const G = {
  flag: `<path d="M6 21V4" ${S}/><path d="M6 4h12l-3 4 3 4H6" ${F}/>`,
  energy: `<path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z" ${F}/>`,
  damage: `<rect x="5" y="3" width="14" height="18" rx="2.5" ${F}/><path d="M12 7.5v6" stroke="#fffaf0" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="#fffaf0"/>`,
  push: `<path d="M12 2l2 6 6-2-4 5 5 3-6 1 1 6-4-4-4 4 1-6-6-1 5-3-4-5 6 2z" ${F}/>`,
  hit: `<circle cx="12" cy="12" r="8.5" ${S}/><circle cx="12" cy="12" r="4" ${S}/><circle cx="12" cy="12" r="1.3" ${F}/>`,
  fall: `<ellipse cx="12" cy="17" rx="8" ry="3.2" ${F}/><path d="M12 3v8M8.5 7.5 12 11l3.5-3.5" ${S}/>`,
  trophy: `<path d="M7 3.5h10v5a5 5 0 0 1-10 0z" ${F}/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13.5V18M8 20.5h8" ${S}/>`,
  home: `<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5" ${S}/><path d="M10 20v-5h4v5" ${S}/>`,
  restart: `<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" ${S}/><path d="M4 3.5v4.5h4.5" ${S}/>`,
  soundOn: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" ${F}/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" ${S}/>`,
  soundOff: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" ${F}/><path d="m16 9.5 5 5m0-5-5 5" ${S}/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2" ${F}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ${S}/>`,
  check: `<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: `<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  power: `<path d="M7.5 6.5a7.5 7.5 0 1 0 9 0" ${S}/><path d="M12 3v8" ${S}/>`,
  reboot: `<path d="M19.5 12A7.5 7.5 0 1 1 15 5.1" ${S}/><path d="M14 2.5l3.2 2.8L14.4 8.7" ${S}/>`,
  priority: `<circle cx="12" cy="12" r="9" ${F}/><path d="M10 9l2.5-1.5V17" fill="none" stroke="#fffaf0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  hurry: `<path d="M3.5 6v12l8-6zM12.5 6v12l8-6z" ${F}/>`,
  play: `<path d="M7 4.5v15l12.5-7.5z" ${F}/>`,
  phone: `<rect x="6.5" y="2.5" width="11" height="19" rx="2.5" ${S}/><path d="M10.5 18.5h3" ${S}/>`,
  scan: `<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" ${S}/><path d="M8 12h8" ${S}/>`,
  cards: `<rect x="3" y="6" width="9" height="13" rx="1.6" transform="rotate(-12 7.5 12.5)" ${S}/><rect x="11" y="5" width="9" height="13" rx="1.6" transform="rotate(10 15.5 11.5)" ${F}/>`,
  card: `<rect x="6" y="3" width="12" height="18" rx="2.2" ${F}/>`,
  belt: `<rect x="3" y="7" width="18" height="10" rx="5" ${S}/><path d="m9 9.5 2.5 2.5L9 14.5m4-5 2.5 2.5-2.5 2.5" ${S}/>`,
  gear: `<path d="M12 2.8 13.6 5l2.7-.6.4 2.7 2.5 1.2-1 2.6 1.6 2.2-2.4 1.4.1 2.8-2.7.2-1.2 2.5-2.5-1.2-2.5 1.2-1.2-2.5-2.7-.2.1-2.8-2.4-1.4 1.6-2.2-1-2.6 2.5-1.2.4-2.7 2.7.6z" ${F}/><circle cx="12" cy="12" r="3" fill="#fffaf0"/>`,
  laser: `<rect x="2.5" y="8.5" width="6" height="7" rx="1" ${F}/><path d="M9 12h12.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="0.1 4.2"/><path d="M9 12h12" stroke="currentColor" stroke-width="1.2"/>`,
  robotLaser: `<path d="M3 15.5 7.5 8l4.5 7.5z" ${F}/><path d="M12 12h9.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  shop: `<rect x="4" y="4" width="16" height="16" rx="3" ${S}/><path d="M12 8v8M8 12h8" ${S}/>`,
  plus: `<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  minus: `<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  back: `<path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  next: `<path d="m9.5 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  map: `<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" ${S}/><path d="M9 4v13.5M15 6.5V20" ${S}/>`,
  zoomIn: `<circle cx="10.5" cy="10.5" r="6.5" ${S}/><path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" ${S}/>`,
  zoomOut: `<circle cx="10.5" cy="10.5" r="6.5" ${S}/><path d="m15.5 15.5 5 5M7.5 10.5h6" ${S}/>`,
  trash: `<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" ${S}/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" ${S}/><circle cx="12" cy="12" r="3" ${F}/>`,
  wall: `<rect x="3" y="9" width="18" height="7" rx="1" ${F}/><path d="M3 19.5h18" ${S}/>`,
  edge: `<path d="M3 16.5h12" ${S}/><path d="M15 16.5V20" ${S}/><path d="M18 9v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  timer: `<circle cx="12" cy="13" r="8" ${S}/><path d="M12 13V9M9.5 2.5h5" ${S}/>`,
  infinity: `<path d="M12 12c-2-3-3.5-4.5-5.5-4.5a4.5 4.5 0 0 0 0 9c2 0 3.5-1.5 5.5-4.5s3.5-4.5 5.5-4.5a4.5 4.5 0 0 1 0 9c-2 0-3.5-1.5-5.5-4.5z" ${S}/>`,
  dots: `<circle cx="5.5" cy="12" r="2" ${F}/><circle cx="12" cy="12" r="2" ${F}/><circle cx="18.5" cy="12" r="2" ${F}/>`,
  sleep: `<path d="M5 8h5l-5 6h5M13 4h4l-4 5h4" ${S}/>`,
  swap: `<path d="M5 8h13m-3.5-3.5L18 8l-3.5 3.5M19 16H6m3.5-3.5L6 16l3.5 3.5" ${S}/>`,
  hand: `<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V13m0-5a1.5 1.5 0 0 1 3 0v6.5c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4L5 14a1.6 1.6 0 0 1 2.6-1.8L8 13" ${S}/>`,
};

export function glyph(name, cls = '') {
  return `<svg class="g g-${name} ${cls}" viewBox="0 0 24 24" aria-hidden="true">${G[name] ?? ''}</svg>`;
}
