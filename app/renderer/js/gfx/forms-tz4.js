// Enclosure forms for the v0.3.0 Tone Zone originals: playful, illustrated shapes (a cat head, a router, a
// stopwatch, a haunted house, a flying saucer …). Every form draws its own outline + art, then places the
// controls into named slots (knob / toggle param, `foot0`, `led0` …) – slots are re-applied on every render
// because control objects are shared between renders.
// Performance: gradients, cached noise tiles, clip paths and a few dozen paths per pedal – no SVG filters.
import { svg, shade } from '../util.js';
import { softShadow, noisePattern } from './fx.js';
import { label } from './controls.js';
import { formKit } from './forms.js'; // cyclic import: only touched at render time

// ------------------------------------------------------------------ paint helpers
function defsEl() {
  let d = document.getElementById('globalDefs') || document.getElementById('tz4Defs');
  if (!d) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.style.position = 'absolute';
    d = svg('defs', { id: 'tz4Defs' }, s);
    document.body.appendChild(s);
  }
  return d;
}
const kid = (c) => String(c).replace(/[^a-z0-9]/gi, '');
function lin(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  id = 't4l-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('linearGradient', { id, x1, y1, x2, y2 }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function rad(id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) {
  id = 't4r-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('radialGradient', { id, cx, cy, r, fx, fy }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function noise(id, units, px, rgb, a0, a1, smooth = 1) {
  id = 't4n-' + id;
  if (!document.getElementById(id)) noisePattern(defsEl(), id, units, px, rgb, a0, a1, smooth);
  return `url(#${id})`;
}
const P = (p, d, a = {}) => svg('path', Object.assign({ d }, a), p);
const C = (p, cx, cy, r, a = {}) => svg('circle', Object.assign({ cx, cy, r }, a), p);
const E = (p, cx, cy, rx, ry, a = {}) => svg('ellipse', Object.assign({ cx, cy, rx, ry }, a), p);
const R = (p, x, y, width, height, rx, a = {}) => svg('rect', Object.assign({ x, y, width, height, rx }, a), p);
const T = (p, x, y, s, o) => label(p, x, y, s, o);
const G = (p, a = {}) => svg('g', Object.assign({ 'pointer-events': 'none' }, a), p);
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
const circ = (cx, cy, r) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
const bodyGrad = (col, k = '') => lin('b' + kid(col) + k, [[0, shade(col, 0.22)], [0.45, col], [1, shade(col, -0.32)]], 0, 0, 0.45, 1);
const gloss = () => lin('gloss', [[0, '#fff', 0.22], [0.35, '#fff', 0.04], [0.5, '#fff', 0], [1, '#000', 0.12]], 0, 0, 0.3, 1);

// average glyph width (em) per font, used to keep printed text inside its box
const CW = { oswald: 0.5, inter: 0.8, barlow: 0.44, script: 0.46, mono: 0.56 };
const FONTS = { oswald: "'Oswald', sans-serif", inter: "'Inter', sans-serif", barlow: "'Barlow Condensed', sans-serif", script: "'Dancing Script', cursive", mono: "'Share Tech Mono', monospace" };
function fit(str, maxW, size, font = 'oswald', ls = 0) {
  const w = String(str).length * (size * CW[font] + ls);
  return w <= maxW ? size : Math.max(4, (size * maxW) / w);
}
// printed text that never grows past maxW
function txt(g, x, y, s, o = {}) {
  const font = o.font || 'oswald';
  const size = o.maxW ? fit(s, o.maxW, o.size || 10, font, o.ls || 0) : o.size || 10;
  return T(g, x, y, s, Object.assign({}, o, { size, font: FONTS[font] || font }));
}

let clipSeq = 0;
// enclosure from an outline path: drop shadow, colour gradient, optional texture, grain, gloss, rim
function shell(g, w, h, d, col, o = {}) {
  softShadow(g, { w, h, path: d, dy: o.dy ?? 12, blur: 9, opacity: 0.6 });
  P(g, d, { fill: o.fill || bodyGrad(col, o.k || '') });
  if (o.tex) P(g, d, { fill: o.tex });
  if (o.grain !== false) P(g, d, { fill: 'url(#p-grain)', 'fill-opacity': o.grain ?? 0.55 });
  if (o.gloss) P(g, d, { fill: gloss() });
  const id = 't4c' + ++clipSeq;
  const cp = svg('clipPath', { id }, g);
  P(cp, d, {});
  return {
    clip: `url(#${id})`,
    edge(a = 0.26) {
      P(g, d, { fill: 'none', stroke: '#fff', 'stroke-opacity': a, 'stroke-width': 1.3 });
      P(g, d, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 });
    },
  };
}
function badge(g, x, y, fill, size = 4.4, anchor = 'middle') {
  return T(g, x, y, 'TONE ZONE', { size, fill, weight: 800, ls: 1.4, opacity: 0.75, anchor, font: FONTS.inter });
}
function wavePath(fn, x, y, w, h, n = 40) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d += (i ? 'L' : 'M') + (x - w / 2 + w * t).toFixed(1) + ' ' + (y - (h / 2) * fn(t)).toFixed(1);
  }
  return d;
}

// ------------------------------------------------------------------ slots → controls
function place(def, slots) {
  const n = { foot: 0, led: 0, btn: 0 };
  for (const c of def.controls) {
    let key = c.p;
    if (c.t === 'foot') key = 'foot' + n.foot++;
    else if (c.t === 'led') key = 'led' + n.led++;
    else if (c.t === 'button' && !c.p) key = 'btn' + n.btn++;
    const s = slots[key];
    if (s) Object.assign(c, s, { _t4alt: !!s.alt });
    else if (!c.hidden) Object.assign(c, { x: -999, y: -999, _t4alt: false });
  }
}
// a form = an art function returning { w, h, slots, theme, alt?, jy, jgap?, edge?(y) → [left, right], over?() }
function form(build) {
  return (ctx, def) => {
    const s = build(ctx.g, def, def.art || {}, ctx);
    place(def, s.slots);
    const C = def.controls.filter((c) => c.x > -900);
    formKit.placeControls(ctx, C.filter((c) => !c._t4alt), s.theme);
    if (s.alt) formKit.placeControls(ctx, C.filter((c) => c._t4alt), Object.assign({}, s.theme, s.alt));
    if (s.over) s.over();
    const jacks = formKit.jacksSide(def, s.w, { y0: s.jy, gap: s.jgap ?? 26, flip: ctx.flip });
    if (s.edge) for (const j of jacks) { const e = s.edge(j.y); j.x = j.side === 'right' ? e[1] + 2 : e[0] - 2; }
    return { w: s.w, h: s.h, theme: Object.assign({}, s.theme, { jackText: s.jackText || s.theme.text }), jacks };
  };
}
const K = (x, y, r = 12, o = {}) => Object.assign({ x, y, r, labelPos: 'below' }, o);

// ================================================================== 1. cat head (Meowsynth, Whoopee …)
const catForm = form((g, def, A) => {
  const w = 210, h = 322;
  const col = def.color || '#e08a3c';
  const ink = def.text || '#3a1d08';
  const d = 'M22 80C18 60 22 30 31 8Q34 1 41 6L86 44Q105 38 124 44L169 6Q176 1 179 8C188 30 192 60 188 80C202 100 206 128 206 160C206 252 165 318 105 320C45 318 4 252 4 160C4 128 8 100 22 80Z';
  const b = shell(g, w, h, d, col, { tex: noise('fur', 26, 52, [70, 30, 0], 0, 0.28, 1), grain: 0.4 });
  const t = G(g, { 'clip-path': b.clip });
  const dark = shade(col, -0.42), cream = A.cream || '#f7ead2';
  // inner ears
  for (const m of [1, -1]) {
    const tr = m === 1 ? '' : `translate(${w},0) scale(-1,1)`;
    P(t, 'M37 18L76 47Q55 56 34 66Q31 40 37 18Z', { fill: lin('ear', [[0, '#f5a9b4'], [1, '#c96a7a']]), transform: tr });
    for (const k of [0, 1, 2]) P(t, `M${44 + k * 6} ${30 + k * 3}l${-6 + k} ${18 - k * 2}`, { stroke: '#fff', 'stroke-opacity': 0.5, 'stroke-width': 0.8, fill: 'none', transform: tr });
    // tabby stripes: forehead + cheeks
    P(t, 'M80 50q4 7 2 16M72 56q4 6 3 12', { stroke: dark, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none', 'stroke-opacity': 0.75, transform: tr });
    P(t, 'M5 116q14 2 26 10M5 132q12 0 22 6M8 100q10 4 18 12', { stroke: dark, 'stroke-width': 3.2, 'stroke-linecap': 'round', fill: 'none', 'stroke-opacity': 0.7, transform: tr });
  }
  // bib (control deck) and muzzle
  P(t, 'M0 196Q105 150 210 196V330H0Z', { fill: cream });
  P(t, 'M0 196Q105 150 210 196', { fill: 'none', stroke: shade(cream, -0.25), 'stroke-width': 1 });
  P(t, 'M0 196Q105 150 210 196V330H0Z', { fill: noise('furc', 22, 44, [120, 80, 40], 0, 0.14, 1) });
  E(t, 92, 133, 19, 12, { fill: cream });
  E(t, 118, 133, 19, 12, { fill: cream });
  for (const [x, y] of [[86, 131], [80, 136], [90, 138], [124, 131], [130, 136], [120, 138]]) C(t, x, y, 0.9, { fill: shade(col, -0.5), 'fill-opacity': 0.7 });
  // eyes (the LEDs are the pupils)
  for (const ex of [64, 146]) {
    const ey = 100;
    P(t, `M${ex - 19} ${ey}Q${ex} ${ey - 17} ${ex + 19} ${ey}Q${ex} ${ey + 17} ${ex - 19} ${ey}Z`, { fill: rad('eye' + kid(A.eye || 'g'), [[0, A.eye || '#d8f06a'], [1, shade(A.eye || '#d8f06a', -0.45)]], 0.5, 0.45, 0.6), stroke: '#1a0f06', 'stroke-width': 1.6 });
    E(t, ex, ey, 3.2, 9.5, { fill: '#0b0806' });
  }
  // nose, mouth, whiskers
  P(t, 'M97 120Q105 116 113 120Q110 127 105 129Q100 127 97 120Z', { fill: '#e8899a', stroke: '#7a3442', 'stroke-width': 0.8 });
  P(t, 'M105 129V134M93 134Q99 141 105 134Q111 141 117 134', { stroke: '#3a1d08', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' });
  for (const m of [1, -1]) {
    const tr = m === 1 ? '' : `translate(${w},0) scale(-1,1)`;
    P(t, 'M78 128Q50 118 22 116M78 132Q48 130 18 132M78 136Q50 142 24 150', { stroke: '#fffaf0', 'stroke-width': 0.9, fill: 'none', 'stroke-opacity': 0.85, transform: tr });
  }
  // paw-print footswitch
  const pw = G(t);
  P(pw, 'M91 300Q91 288 105 288Q119 288 119 300Q119 309 105 309Q91 309 91 300Z', { fill: '#e8899a', stroke: '#7a3442', 'stroke-width': 0.8 });
  for (const [x, y] of [[85, 286], [97, 279], [113, 279], [125, 286]]) E(pw, x, y, 4.4, 5.2, { fill: '#e8899a', stroke: '#7a3442', 'stroke-width': 0.8 });
  b.edge();
  // printing
  txt(g, 105, 155, def.logo || def.name, { size: 16, maxW: 120, fill: def.logoColor || '#2a1405', weight: 700, ls: 1.5 });
  txt(g, 105, 168, (def.typeName || '').toUpperCase(), { size: 5, maxW: 110, font: 'inter', fill: ink, weight: 700, ls: 1, opacity: 0.75 });
  // knob sweep ends for the SIZE knob
  if (A.ends) {
    const [lo, hi] = A.ends;
    T(g, 52 - 18, 196 + 15, lo, { size: 4.3, fill: ink, weight: 700, font: FONTS.inter, anchor: 'middle' });
    T(g, 52 + 18, 196 + 15, hi, { size: 4.3, fill: ink, weight: 700, font: FONTS.inter, anchor: 'middle' });
  }
  const slots = {
    led0: { x: 64, y: 100, r: 3.4, bezel: '#0b0806' }, led1: { x: 146, y: 100, r: 3.4, bezel: '#0b0806' },
    foot0: { x: 105, y: 294, style: 'plate', w: 48, h: 36 },
  };
  const ks = A.knobs || [];
  const pos = [[52, 198], [105, 198], [158, 198], [60, 241], [105, 241], [150, 241]];
  ks.forEach((p, i) => { if (p) slots[p] = K(pos[i][0], pos[i][1], 12); });
  if (A.toggle) slots[A.toggle] = { x: 105, y: 68, orient: 'h', optSize: 5 };
  return {
    w, h, slots, jy: 172, edge: () => [4, 206],
    theme: { text: ink, knob: def.knob || 'cream', labelSize: 6.6, labelLs: 0.6 },
    over() { for (const ex of [64, 146]) C(g, ex - 4, 95, 1.6, { fill: '#fff', 'fill-opacity': 0.85, 'pointer-events': 'none' }); },
  };
});

// ================================================================== 2. Wi-Fi router (Bad Wi-Fi)
const routerForm = form((g, def, A) => {
  const w = 230, h = 268, top = 52;
  const col = def.color || '#eceef1';
  const ink = def.text || '#1d2026';
  // antennas (behind the case)
  for (const [x, a] of [[40, -13], [115, 0], [190, 13]]) {
    const ag = G(g, { transform: `translate(${x},${top + 4}) rotate(${a})` });
    softShadow(ag, { w: 9, h: 56, rx: 4.5, dy: 8, blur: 6, opacity: 0.5, x: -4.5, y: -54 });
    R(ag, -4.5, -54, 9, 56, 4.5, { fill: lin('ant', [[0, '#3a3d44'], [0.4, '#1d1f24'], [1, '#0d0e10']], 0, 0, 1, 0) });
    R(ag, -4.5, -54, 9, 7, 3, { fill: '#fff', 'fill-opacity': 0.08 });
    R(ag, -5.5, -12, 11, 4, 1.5, { fill: '#000', 'fill-opacity': 0.35 });
    C(ag, 0, 0, 6.5, { fill: lin('knuck', [[0, '#55585f'], [1, '#141518']]) });
  }
  const d = rr(0, top, w, h - top, 16);
  const b = shell(g, w, h, d, col, { gloss: true, grain: 0.35 });
  const t = G(g, { 'clip-path': b.clip });
  // front strip
  const sy = 196;
  R(t, 0, sy, w, h - sy, 0, { fill: lin('strip', [[0, '#2a2d33'], [1, '#121317']]) });
  R(t, 0, sy, w, 1.2, 0, { fill: '#fff', 'fill-opacity': 0.25 });
  for (let i = 0; i < 7; i++) R(t, 98 + i * 5, 236, 2, 18, 1, { fill: '#000', 'fill-opacity': 0.6 });
  b.edge();
  // branding + weak-signal icon
  txt(g, 18, top + 16, def.logo || def.name, { size: 18, maxW: 150, fill: def.logoColor || ink, weight: 700, ls: 1, anchor: 'start' });
  txt(g, 18, top + 31, (def.typeName || '').toUpperCase(), { size: 5, maxW: 150, font: 'inter', fill: ink, weight: 700, ls: 1.2, anchor: 'start', opacity: 0.7 });
  const wx = 200, wy = top + 32;
  [9, 15, 21].forEach((r, i) => P(g, `M${wx - r * 0.75} ${wy - r * 0.66}A${r} ${r} 0 0 1 ${wx + r * 0.75} ${wy - r * 0.66}`, { fill: 'none', stroke: i === 0 ? (def.accent || '#ff3b30') : ink, 'stroke-opacity': i === 0 ? 1 : 0.18, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
  C(g, wx, wy, 2.4, { fill: def.accent || '#ff3b30' });
  T(g, wx + 13, wy - 2, '!', { size: 9, fill: def.accent || '#ff3b30', weight: 800, font: FONTS.inter });
  const slots = {};
  (A.knobs || []).forEach((p, i) => { if (p) slots[p] = K([36, 88, 140, 192][i % 4], i < 4 ? 114 : 164, 12); });
  if (A.sel) slots[A.sel] = K(156, 164, 12, { optSize: 4.5, labelRadius: 7 });
  slots.led0 = { x: 62, y: 210, r: 2.6, label: 'PWR', textColor: '#c9ced8', alt: true };
  slots.led1 = { x: 115, y: 210, r: 2.6, label: 'WAN', textColor: '#c9ced8', alt: true };
  slots.led2 = { x: 168, y: 210, r: 2.6, label: 'BUF', textColor: '#c9ced8', alt: true };
  slots.foot0 = { x: 62, y: 236, r: 11, style: 'stomp', alt: true };
  slots.foot1 = { x: 168, y: 236, r: 11, style: 'stomp', alt: true };
  return { w, h, slots, jy: 150, theme: { text: ink, knob: def.knob || 'white', labelSize: 6.2, labelLs: 0.5 }, alt: { text: '#e6e9ef' }, jackText: ink };
});

// ================================================================== 3. déjà vu (double-printed micro looper)
function spiral(cx, cy, r, turns = 3.2, n = 90, a0 = 0) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + t * turns * Math.PI * 2, rr2 = 4 + (r - 4) * t;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr2).toFixed(1) + ' ' + (cy + Math.sin(a) * rr2).toFixed(1);
  }
  return d;
}
const dejavuForm = form((g, def, A) => {
  const w = 206, h = 318;
  const col = def.color || '#2a1f4f';
  const acc = def.accent || '#ff4fa3', acc2 = A.accent2 || '#32e0e6';
  const ink = def.text || '#efeaff';
  // the "seen it before" ghost outline
  P(g, rr(10, 0, 196, 310, 22), { fill: acc2, 'fill-opacity': 0.12, stroke: acc2, 'stroke-opacity': 0.55, 'stroke-width': 1.2, 'stroke-dasharray': '5 3', 'pointer-events': 'none' });
  const d = rr(0, 8, 196, 310, 22);
  const b = shell(g, w, h, d, col, { grain: 0.5 });
  const t = G(g, { 'clip-path': b.clip });
  C(t, 98, 86, 66, { fill: rad('djv', [[0, shade(col, 0.35)], [1, col, 0]]) });
  P(t, spiral(99.5, 85, 58, 3.3, 110, 0.3), { fill: 'none', stroke: acc2, 'stroke-width': 2.4, 'stroke-opacity': 0.55, 'stroke-linecap': 'round' });
  P(t, spiral(98, 86, 58, 3.3, 110, 0), { fill: 'none', stroke: acc, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  // scanline glitch bars
  for (const [y, x, ww] of [[46, 8, 40], [128, 140, 50], [150, 20, 30]]) R(t, x, y, ww, 2, 0, { fill: acc2, 'fill-opacity': 0.4 });
  b.edge();
  const logo = def.logo || def.name;
  const ly = 166;
  txt(g, 96.8, ly, logo, { size: 22, maxW: 170, fill: acc2, weight: 700, ls: 3, opacity: 0.8 });
  txt(g, 99.2, ly, logo, { size: 22, maxW: 170, fill: acc, weight: 700, ls: 3, opacity: 0.8 });
  txt(g, 98, ly, logo, { size: 22, maxW: 170, fill: ink, weight: 700, ls: 3 });
  txt(g, 98, ly + 15, (def.typeName || '').toUpperCase(), { size: 5, maxW: 170, font: 'inter', fill: ink, weight: 700, ls: 1.3, opacity: 0.7 });
  badge(g, 98, h - 9, ink, 4.2);
  const slots = {};
  const pos = [[44, 202], [98, 202], [152, 202], [44, 242], [98, 242], [152, 242]];
  (A.knobs || []).forEach((p, i) => { if (p) slots[p] = K(pos[i][0], pos[i][1], 11.5); });
  if (A.sel) slots[A.sel] = K(98, 86, 14, { labelPos: 'none', optSize: 5, labelRadius: 10 });
  slots.led0 = { x: 52, y: 275, r: 2.8 };
  slots.led1 = { x: 144, y: 275, r: 2.8 };
  slots.foot0 = { x: 52, y: 293, r: 11, style: 'stomp' };
  slots.foot1 = { x: 144, y: 293, r: 11, style: 'stomp' };
  return { w, h, slots, jy: 210, edge: () => [0, 196], theme: { text: ink, knob: def.knob || 'chrome', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 4. gothic arch + stained glass (Vespers)
const archForm = form((g, def, A) => {
  const w = 200, h = 322;
  const col = def.color || '#5f5a55';
  const ink = def.text || '#f3ead8';
  const d = 'M0 302V124C0 62 50 18 100 0C150 18 200 62 200 124V302Q200 322 180 322H20Q0 322 0 302Z';
  const b = shell(g, w, h, d, col, { tex: noise('stone', 34, 64, [0, 0, 0], 0, 0.35, 1), grain: 0.4 });
  const t = G(g, { 'clip-path': b.clip });
  // masonry joints
  for (let r = 0; r < 15; r++) {
    const y = 150 + r * 22;
    P(t, `M0 ${y}H200`, { stroke: '#000', 'stroke-opacity': 0.22, 'stroke-width': 0.8 });
    for (let x = (r % 2) * 30 + 15; x < 200; x += 60) P(t, `M${x} ${y}v22`, { stroke: '#000', 'stroke-opacity': 0.18, 'stroke-width': 0.8 });
  }
  // window: lead frame, rose and two lancets
  const win = 'M28 146V112C28 70 60 38 100 24C140 38 172 70 172 112V146Z';
  P(t, win, { fill: '#1a1414', stroke: shade(col, 0.3), 'stroke-width': 3 });
  const jewel = A.glass || ['#c2203b', '#2a5bd7', '#e3a72f', '#2f9e5a', '#7b3fc4', '#e0602a'];
  const cx = 100, cy = 78, R0 = 30;
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
    const p = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    P(t, `M${p(a0, 11)}L${p(a0, R0)}A${R0} ${R0} 0 0 1 ${p(a1, R0)}L${p(a1, 11)}Z`, { fill: jewel[i % jewel.length], 'fill-opacity': 0.9, stroke: '#1a1414', 'stroke-width': 1.4 });
  }
  C(t, cx, cy, 11, { fill: '#f2d36b', stroke: '#1a1414', 'stroke-width': 1.4 });
  for (const [x0, x1] of [[34, 96], [104, 166]]) {
    const m = (x0 + x1) / 2, top = 114;
    P(t, `M${x0} 144V${top + 10}Q${x0} ${top - 4} ${m} ${top - 8}Q${x1} ${top - 4} ${x1} ${top + 10}V144Z`, { fill: '#1a1414' });
    for (let k = 0; k < 3; k++) R(t, x0 + 3 + k * ((x1 - x0 - 6) / 3), top + 2, (x1 - x0 - 6) / 3 - 1.4, 26, 1.5, { fill: jewel[(k + (x0 > 100 ? 3 : 0)) % jewel.length], 'fill-opacity': 0.85 });
  }
  for (const [x0, x1] of [[34, 96], [104, 166]]) for (const y of [128, 136]) P(t, `M${x0} ${y}H${x1}`, { stroke: '#1a1414', 'stroke-width': 1.2 });
  P(t, win, { fill: rad('glassglow', [[0, '#fff', 0.35], [1, '#fff', 0]], 0.5, 0.35, 0.6) });
  P(t, win, { fill: 'none', stroke: shade(col, -0.4), 'stroke-width': 1 });
  b.edge();
  txt(g, 100, 162, def.logo || def.name, { size: 18, maxW: 150, fill: def.logoColor || '#f2d36b', weight: 700, ls: 4 });
  txt(g, 100, 176, (def.typeName || '').toUpperCase(), { size: 5, maxW: 160, font: 'inter', fill: ink, weight: 700, ls: 1.2, opacity: 0.8 });
  const s = {};
  const [k1, sel, k2, ...row2] = A.knobs || [];
  s[k1] = K(38, 212, 12); s[k2] = K(162, 212, 12);
  s[sel] = K(100, 214, 13, { optSize: 4.6, labelRadius: 7 });
  row2.forEach((p, i) => { s[p] = K(row2.length > 4 ? 27 + i * 36.5 : 30 + i * 46.7, 252, row2.length > 4 ? 10.5 : 11); });
  s.led0 = { x: 100, y: 78, r: 4.2, bezel: '#1a1414' };
  s.foot0 = { x: 100, y: 296, r: 11.5, style: 'stomp' };
  return { w, h, slots: s, jy: 214, edge: () => [0, 200], theme: { text: ink, knob: def.knob || 'chrome', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 5. 70s string machine (Polyester)
const discoForm = form((g, def, A) => {
  const w = 236, h = 292, cw = 22;
  const col = def.color || '#efe3c8';
  const ink = def.text || '#4a2410';
  const d = rr(0, 0, w, h, 14);
  const b = shell(g, w, h, d, col, { grain: 0.4 });
  const t = G(g, { 'clip-path': b.clip });
  // walnut cheeks
  for (const x of [0, w - cw]) {
    R(t, x, 0, cw, h, 0, { fill: lin('walnut', [[0, '#6b3f22'], [0.5, '#8a5631'], [1, '#4d2b16']], 0, 0, 1, 0) });
    for (let i = 0; i < 9; i++) P(t, `M${x + 2 + i * 2.3} 0C${x + 5 + i * 2.1} ${h * 0.3} ${x - 1 + i * 2.4} ${h * 0.6} ${x + 3 + i * 2.2} ${h}`, { stroke: i % 3 ? '#3a1f0e' : '#a8703f', 'stroke-opacity': 0.45, 'stroke-width': i % 4 ? 0.5 : 1, fill: 'none' });
    R(t, x === 0 ? cw - 1 : x, 0, 1, h, 0, { fill: '#000', 'fill-opacity': 0.4 });
  }
  // the three stripes
  const stripes = A.stripes || ['#e8772e', '#b8461f', '#e0b23a'];
  stripes.forEach((c, i) => P(t, `M${cw} ${16 + i * 11}H${w - cw - 40 - i * 11}Q${w - cw - 18 - i * 11} ${16 + i * 11} ${w - cw - 18 - i * 11} ${38 + i * 11}V${h}H${w - cw - 27 - i * 11}V${40 + i * 11}Q${w - cw - 27 - i * 11} ${25 + i * 11} ${w - cw - 40 - i * 11} ${25 + i * 11}H${cw}Z`, { fill: c }));
  b.edge();
  txt(g, 96, 70, def.logo || def.name, { size: 30, maxW: 160, font: 'script', fill: def.logoColor || ink, weight: 700, ls: 0.3 });
  txt(g, 96, 90, (def.typeName || '').toUpperCase(), { size: 5.2, maxW: 150, font: 'inter', fill: ink, weight: 700, ls: 1.5, opacity: 0.8 });
  // badge on the left cheek
  T(g, 11, h / 2, 'TONE ZONE', { size: 5, fill: '#f2d7a6', weight: 800, ls: 2, font: FONTS.inter, opacity: 0.8, transform: `rotate(-90 11 ${h / 2})` });
  const s = {};
  const xs = [42, 78, 114, 150];
  (A.knobs || []).forEach((p, i) => { s[p] = K(xs[i % 4], i < 4 ? 124 : 170, 11.5); });
  (A.toggles || []).forEach((p, i) => { s[p] = { x: [60, 132][i], y: 220, orient: 'h' }; });
  s.led0 = { x: 96, y: 246, r: 2.8 };
  s.foot0 = { x: 96, y: 268, r: 11.5, style: 'stomp' };
  return { w, h, slots: s, jy: 124, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'chicken', labelSize: 6.2, labelLs: 0.5 }, jackText: '#f2d7a6' };
});

// ================================================================== 6. arcade cabinet (Insert Coin)
const INVADER = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
const arcadeForm = form((g, def, A) => {
  const w = 214, h = 336;
  const col = def.color || '#1c1630';
  const acc = def.accent || '#ff3fa4';
  const ink = def.text || '#f1ecff';
  const d = 'M16 0H198Q206 0 206 8V40L214 50V326Q214 336 204 336H10Q0 336 0 326V50L8 40V8Q8 0 16 0Z';
  const b = shell(g, w, h, d, col, { grain: 0.45 });
  const t = G(g, { 'clip-path': b.clip });
  // side-art stripes
  for (const [i, c] of [[0, acc], [1, A.accent2 || '#3fd2ff']]) P(t, `M0 ${300 + i * 9}L${w} ${226 + i * 9}v5L0 ${305 + i * 9}Z`, { fill: c, 'fill-opacity': 0.55 });
  // marquee
  R(t, 14, 6, w - 28, 32, 4, { fill: lin('marq', [[0, '#fff3b0'], [0.5, '#ffc93c'], [1, '#e8892a']]) });
  R(t, 14, 6, w - 28, 32, 4, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.5 });
  // screen
  const sx = 18, sy = 48, sw = w - 36, sh = 66;
  R(t, sx - 3, sy - 3, sw + 6, sh + 6, 6, { fill: '#050507' });
  R(t, sx, sy, sw, sh, 8, { fill: rad('crt', [[0, '#1b2350'], [1, '#05060f']], 0.5, 0.45, 0.7) });
  const px = 2.6, ix = w / 2 - (11 * px) / 2, iy = sy + 10;
  let dpx = '';
  INVADER.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X') dpx += `M${(ix + x * px).toFixed(1)} ${(iy + y * px).toFixed(1)}h${px}v${px}h${-px}Z`; }));
  P(t, dpx, { fill: A.pixel || '#5dff7a' });
  T(t, sx + 8, sy + 9, 'HI 990000', { size: 5.4, fill: '#ff5a5a', font: FONTS.mono, anchor: 'start', ls: 0.5 });
  T(t, sx + sw - 8, sy + 9, '1UP', { size: 5.4, fill: '#ffffff', font: FONTS.mono, anchor: 'end', ls: 0.5 });
  txt(t, w / 2, sy + 48, (def.typeName || '').toUpperCase(), { size: 6, maxW: sw - 16, font: 'mono', fill: '#9fe8ff', ls: 0.6 });
  for (let i = 0; i < 9; i++) R(t, sx, sy + 4 + i * 7, sw, 1.2, 0, { fill: '#000', 'fill-opacity': 0.25 });
  R(t, sx, sy, sw, sh, 8, { fill: 'url(#g-glass)' });
  // control deck panel
  R(t, 6, 122, w - 12, 108, 6, { fill: '#000', 'fill-opacity': 0.28 });
  // coin door
  R(t, 52, 240, w - 104, 34, 4, { fill: lin('door', [[0, '#3a3d44'], [1, '#17181c']]), stroke: '#000', 'stroke-opacity': 0.6 });
  for (const x of [w / 2 - 26, w / 2 + 26]) {
    R(t, x - 9, 248, 18, 18, 2, { fill: '#7a1010', stroke: '#000', 'stroke-opacity': 0.6 });
    R(t, x - 1.2, 251, 2.4, 12, 1, { fill: '#0b0b0c' });
  }
  T(t, w / 2, 257, '25¢', { size: 6, fill: '#ffd54a', weight: 800, font: FONTS.inter });
  // big arcade start button (the bypass footswitch sits on it)
  C(t, w / 2, 302, 19, { fill: '#111', 'fill-opacity': 0.6 });
  C(t, w / 2, 300, 17, { fill: lin('btnRing', [[0, '#e8e8ec'], [1, '#7c7f88']]) });
  C(t, w / 2, 300, 13.5, { fill: rad('btnTop' + kid(acc), [[0, shade(acc, 0.45)], [1, shade(acc, -0.25)]], 0.4, 0.35, 0.7) });
  E(t, w / 2 - 4, 295, 6, 3.5, { fill: '#fff', 'fill-opacity': 0.35 });
  b.edge();
  txt(g, w / 2, 22, def.logo || def.name, { size: 19, maxW: w - 44, fill: def.logoColor || '#7a1010', weight: 700, ls: 2 });
  T(g, w / 2 + 34, 300, '1P START', { size: 5.2, fill: ink, weight: 800, font: FONTS.inter, anchor: 'start', ls: 0.8 });
  badge(g, w / 2, h - 7, ink, 4);
  const s = {};
  const xs = [36, 83, 131, 178];
  (A.knobs || []).forEach((p, i) => { s[p] = K(xs[i % 4], i < 4 ? 146 : 194, 11.5); });
  s.led0 = { x: w / 2 - 26, y: 257, r: 2.6, color: '#ff5a2a', bezel: '#2a0505' };
  s.led1 = { x: w / 2 + 26, y: 257, r: 2.6, color: '#ff5a2a', bezel: '#2a0505' };
  s.foot0 = { x: w / 2, y: 300, style: 'plate', w: 36, h: 36 };
  return { w, h, slots: s, jy: 150, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'mxr', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 7. subwoofer cab (Wobbler)
const subForm = form((g, def, A) => {
  const w = 220, h = 342;
  const col = def.color || '#1d1e22';
  const acc = def.accent || '#b6ff3b';
  const ink = def.text || '#eef1f6';
  const d = rr(0, 0, w, h, 10);
  const b = shell(g, w, h, d, col, { tex: 'url(#p-tolex)', grain: 0.3 });
  const t = G(g, { 'clip-path': b.clip });
  const cx = w / 2, cy = 82;
  // wobble rings
  for (let i = 0; i < 4; i++) C(t, cx, cy, 70 + i * 8, { fill: 'none', stroke: acc, 'stroke-opacity': 0.42 - i * 0.09, 'stroke-width': 1.4, 'stroke-dasharray': i % 2 ? '4 5' : 'none' });
  // woofer: basket, surround, cone, dust cap
  C(t, cx, cy, 64, { fill: lin('basket', [[0, '#5d6068'], [1, '#1b1c20']]) });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; C(t, cx + Math.cos(a) * 60, cy + Math.sin(a) * 60, 2, { fill: 'url(#g-chromeR)' }); }
  C(t, cx, cy, 55, { fill: rad('surround', [[0.75, '#0c0c0e'], [0.88, '#3a3b40'], [1, '#0c0c0e']]) });
  C(t, cx, cy, 46, { fill: rad('cone', [[0, '#3a3c42'], [0.6, '#16171a'], [1, '#08080a']], 0.45, 0.4, 0.6) });
  for (let i = 0; i < 3; i++) C(t, cx, cy, 20 + i * 8, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.05 });
  C(t, cx, cy, 17, { fill: rad('cap' + kid(acc), [[0, shade(acc, 0.5)], [0.7, acc], [1, shade(acc, -0.5)]], 0.38, 0.32, 0.7) });
  E(t, cx - 5, cy - 6, 6, 3.5, { fill: '#fff', 'fill-opacity': 0.4 });
  // corner protectors
  for (const [x, y, rx2, ry2] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) P(t, `M${x} ${y}h${22 * rx2}l${-22 * rx2} ${22 * ry2}Z`, { fill: 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.4 });
  b.edge();
  txt(g, cx, 170, def.logo || def.name, { size: 21, maxW: 170, fill: def.logoColor || acc, weight: 700, ls: 3 });
  txt(g, cx, 186, (def.typeName || '').toUpperCase(), { size: 5.2, maxW: 170, font: 'inter', fill: ink, weight: 700, ls: 1.4, opacity: 0.75 });
  badge(g, cx, h - 9, ink, 4.2);
  const s = {};
  const xs = [40, 87, 133, 180];
  (A.knobs || []).forEach((p, i) => { if (p) s[p] = K(xs[i % 4], i < 4 ? 214 : 258, 11.5); });
  if (A.toggle) s[A.toggle] = { x: 180, y: 260, orient: 'h' };
  s.led0 = { x: cx, y: 284, r: 2.8 };
  s.foot0 = { x: cx, y: 306, r: 11.5, style: 'stomp' };
  return { w, h, slots: s, jy: 214, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'chrome', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 8. flying saucer + tractor beam (Mothership)
const ufoForm = form((g, def, A) => {
  const w = 252, h = 300;
  const metal = def.color || '#b9c0cc';
  const acc = def.accent || '#7dffb0';
  const ink = def.text || '#e9fff2';
  const beam = 'M72 96H180L236 280Q238 296 222 296H30Q14 296 16 280Z';
  const dome = 'M82 64Q82 8 126 6Q170 8 170 64Z';
  const disc = 'M2 80C2 56 250 56 250 80C250 106 2 106 2 80Z';
  softShadow(g, { w, h, path: beam + disc + dome, dy: 12, blur: 9, opacity: 0.6 });
  // beam deck
  P(g, beam, { fill: lin('beamBase', [[0, '#16203a'], [1, '#0b0f1c']]) });
  P(g, beam, { fill: lin('beam' + kid(acc), [[0, acc, 0.5], [0.35, acc, 0.16], [1, acc, 0.04]]) });
  P(g, beam, { fill: 'url(#p-grain)', 'fill-opacity': 0.4 });
  for (let i = 0; i < 6; i++) P(g, `M${90 + i * 15} 98L${40 + i * 34} 294`, { stroke: acc, 'stroke-opacity': 0.12, 'stroke-width': 1, 'pointer-events': 'none' });
  P(g, beam, { fill: 'none', stroke: acc, 'stroke-opacity': 0.6, 'stroke-width': 1.2 });
  P(g, beam, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.6 });
  // dome with pilot
  P(g, dome, { fill: rad('dome', [[0, '#d6fbff', 0.55], [1, '#4aa8c8', 0.35]], 0.4, 0.3, 0.8) });
  P(g, 'M106 64C106 52 112 46 118 44Q112 40 112 32Q112 20 126 20Q140 20 140 32Q140 40 134 44C140 46 146 52 146 64Z', { fill: lin('alien', [[0, '#9cf27a'], [1, '#3f9a3a']]), 'pointer-events': 'none' });
  P(g, 'M118 30q4 -3 6 3q-4 3 -6 -3ZM134 30q-4 -3 -6 3q4 3 6 -3Z', { fill: '#0b0d0b', 'pointer-events': 'none' });
  P(g, 'M126 20V12', { stroke: '#3f9a3a', 'stroke-width': 1.4, 'pointer-events': 'none' });
  P(g, dome, { fill: lin('domeSheen', [[0, '#fff', 0.45], [0.3, '#fff', 0.05], [1, '#fff', 0]], 0, 0, 1, 1), stroke: '#fff', 'stroke-opacity': 0.5 });
  // saucer disc
  P(g, disc, { fill: lin('disc' + kid(metal), [[0, shade(metal, 0.5)], [0.45, metal], [0.55, shade(metal, -0.25)], [1, shade(metal, -0.55)]]) });
  P(g, disc, { fill: 'url(#p-brushed)', 'fill-opacity': 0.8 });
  P(g, 'M10 80C40 94 212 94 242 80', { fill: 'none', stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 1 });
  P(g, 'M14 72C60 64 192 64 238 72', { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.5, 'stroke-width': 1 });
  P(g, disc, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 });
  txt(g, 126, 120, def.logo || def.name, { size: 15, maxW: 112, fill: def.logoColor || ink, weight: 700, ls: 2.5 });
  txt(g, 126, 133, (def.typeName || '').toUpperCase(), { size: 4.8, maxW: 120, font: 'inter', fill: ink, weight: 700, ls: 1.1, opacity: 0.8 });
  badge(g, 126, 290, ink, 4);
  const s = {};
  const [r1 = [], r2 = []] = A.rows || [];
  r1.forEach((p, i) => { s[p] = K([86, 126, 166][i], 162, 11.5); });
  r2.forEach((p, i) => { s[p] = K([62, 103, 149, 190][i], 210, 11.5); });
  if (A.toggle) s[A.toggle] = { x: 74, y: 260, orient: 'h' };
  s.led0 = { x: 126, y: 11, r: 2.4, bezel: '#3f9a3a' };
  [32, 64, 96, 126, 156, 188, 220].forEach((x, i) => { s['led' + (i + 1)] = { x, y: 87 + (Math.abs(x - 126) < 40 ? 2 : Math.abs(x - 126) < 70 ? 1 : -1), r: 2.4 }; });
  s.foot0 = { x: 126, y: 258, r: 11.5, style: 'stomp' };
  return { w, h, slots: s, jy: 80, edge: () => [2, 250], theme: { text: ink, knob: def.knob || 'chrome', labelSize: 6.2, labelLs: 0.5, jackLabels: false } };
});

// ================================================================== 9. sheet ghost with a cassette (Cassette Ghost)
const ghostForm = form((g, def, A) => {
  const w = 210, h = 322;
  const col = def.color || '#e6f0f2';
  const ink = def.text || '#283a48';
  let hem = '';
  for (let k = 0; k < 8; k++) { const x0 = 204 - k * 24.75; hem += `Q${(x0 - 12.375).toFixed(2)} 320 ${(x0 - 24.75).toFixed(2)} 300`; }
  const d = `M6 300V112C6 40 50 4 105 4C160 4 204 40 204 112V300${hem}Z`;
  const b = shell(g, w, h, d, col, { fill: lin('ghost' + kid(col), [[0, '#ffffff'], [0.5, col], [1, shade(col, -0.18)]], 0, 0, 0.6, 1), grain: 0.25 });
  const t = G(g, { 'clip-path': b.clip });
  // soft folds of the sheet
  for (const [x, c] of [[40, 0.1], [170, 0.1], [105, 0.05]]) P(t, `M${x} 120C${x - 6} 200 ${x + 8} 250 ${x} 330`, { stroke: '#5a7a8c', 'stroke-opacity': c * 1.6, 'stroke-width': 8, fill: 'none' });
  // face
  for (const ex of [80, 130]) E(t, ex, 62, 11, 15, { fill: '#141a22' });
  E(t, 105, 96, 7, 9, { fill: '#141a22' });
  E(t, 64, 86, 8, 4, { fill: '#ff8fb0', 'fill-opacity': 0.45 });
  E(t, 146, 86, 8, 4, { fill: '#ff8fb0', 'fill-opacity': 0.45 });
  // the cassette it carries
  const cx = 105, cy = 140, cw = 120, ch = 60;
  R(t, cx - cw / 2, cy - ch / 2 + 2, cw, ch, 6, { fill: '#000', 'fill-opacity': 0.25 });
  R(t, cx - cw / 2, cy - ch / 2, cw, ch, 6, { fill: A.shell || '#2b2f3a' });
  R(t, cx - cw / 2 + 7, cy - ch / 2 + 5, cw - 14, 34, 3, { fill: '#f3ead2' });
  R(t, cx - cw / 2 + 7, cy - ch / 2 + 5, cw - 14, 7, 3, { fill: def.accent || '#8fd3e8' });
  R(t, cx - 26, cy + 3, 52, 11, 5.5, { fill: '#11131a' });
  for (const rx of [cx - 18, cx + 18]) { C(t, rx, cy + 8.5, 4.6, { fill: '#e9e4d8' }); C(t, rx, cy + 8.5, 1.6, { fill: '#11131a' }); }
  P(t, `M${cx - 38} ${cy + ch / 2}L${cx - 32} ${cy + ch / 2 - 8}H${cx + 32}L${cx + 38} ${cy + ch / 2}Z`, { fill: shade(A.shell || '#2b2f3a', 0.15) });
  // a loose ribbon of tape trailing out
  P(t, `M${cx + 30} ${cy + ch / 2 - 2}C${cx + 50} ${cy + 44} ${cx + 70} ${cy + 24} ${cx + 78} ${cy + 40}`, { stroke: '#5a3a22', 'stroke-width': 1.6, fill: 'none', 'stroke-opacity': 0.85 });
  b.edge(0.6);
  txt(g, cx, cy - 13, def.logo || def.name, { size: 15, maxW: cw - 22, font: 'script', fill: def.logoColor || '#2a2c6a', weight: 700 });
  txt(g, cx, 182, (def.typeName || '').toUpperCase(), { size: 5, maxW: 170, font: 'inter', fill: ink, weight: 700, ls: 1.3, opacity: 0.75 });
  const s = {};
  const r1 = [55, 105, 155], r2 = [40, 83, 127, 170];
  (A.knobs || []).forEach((p, i) => { s[p] = i < 3 ? K(r1[i], 204, 11.5) : K(r2[i - 3], 242, 11); });
  s.led0 = { x: 80, y: 62, r: 4.2, bezel: '#141a22' };
  s.led1 = { x: 130, y: 62, r: 4.2, bezel: '#141a22' };
  s.foot0 = { x: 68, y: 280, r: 10.5, style: 'stomp', labelDy: 18 };
  s.foot1 = { x: 142, y: 280, r: 10.5, style: 'stomp', labelDy: 18 };
  return { w, h, slots: s, jy: 210, edge: () => [6, 204], theme: { text: ink, knob: def.knob || 'white', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 10. monitor with a ping graph (Lag Spike)
const lagForm = form((g, def, A) => {
  const w = 224, h = 310;
  const col = def.color || '#26282e';
  const acc = def.accent || '#ff3b3b';
  const ink = def.text || '#e8ebf2';
  const mon = rr(0, 0, w, 144, 12), neck = 'M94 142H130L134 158H90Z', deck = rr(0, 154, w, h - 154, 12);
  const d = mon + neck + deck;
  softShadow(g, { w, h, path: d, dy: 12, blur: 9, opacity: 0.6 });
  for (const p of [neck, deck, mon]) P(g, p, { fill: bodyGrad(col, 'lag') });
  P(g, deck, { fill: 'url(#p-grain)', 'fill-opacity': 0.5 });
  P(g, mon, { fill: 'url(#p-grain)', 'fill-opacity': 0.5 });
  // screen + ping graph
  const sx = 12, sy = 10, sw = w - 24, sh = 94;
  R(g, sx, sy, sw, sh, 5, { fill: rad('lagscr', [[0, '#14231c'], [1, '#050806']], 0.5, 0.5, 0.75) });
  for (let i = 1; i < 6; i++) P(g, `M${sx} ${sy + (sh * i) / 6}H${sx + sw}`, { stroke: '#3ddc84', 'stroke-opacity': 0.08 });
  const base = sy + sh - 18;
  const pts = [0, 2, 1, 3, 2, 2, 4, 1, 3, 2, 60, 66, 3, 2, 4, 1, 2, 3, 1, 2];
  let pd = '';
  pts.forEach((v, i) => { pd += (i ? 'L' : 'M') + (sx + 8 + (i * (sw - 16)) / (pts.length - 1)).toFixed(1) + ' ' + (base - v).toFixed(1); });
  P(g, pd, { fill: 'none', stroke: '#3ddc84', 'stroke-width': 3.5, 'stroke-opacity': 0.18, 'stroke-linejoin': 'round' });
  P(g, pd, { fill: 'none', stroke: '#6dffa8', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
  const spx = sx + 8 + (10.5 * (sw - 16)) / (pts.length - 1);
  C(g, spx, base - 66, 3, { fill: acc });
  T(g, spx + 8, base - 62, '999 ms', { size: 11, fill: acc, font: FONTS.mono, anchor: 'start', weight: 400 });
  T(g, sx + 8, sy + 9, 'PING', { size: 6, fill: '#6dffa8', font: FONTS.mono, anchor: 'start' });
  T(g, sx + sw - 8, sy + sh - 7, 'PKT LOSS 37%', { size: 6, fill: '#6dffa8', font: FONTS.mono, anchor: 'end' });
  R(g, sx, sy, sw, sh, 5, { fill: 'url(#g-glass)' });
  for (const p of [mon, deck]) { P(g, p, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 1.2 }); P(g, p, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 }); }
  // chin branding
  txt(g, 16, 118, def.logo || def.name, { size: 16, maxW: 150, fill: def.logoColor || ink, weight: 700, ls: 2, anchor: 'start' });
  txt(g, 16, 132, (def.typeName || '').toUpperCase(), { size: 4.8, maxW: 160, font: 'inter', fill: ink, weight: 700, ls: 1.2, anchor: 'start', opacity: 0.7 });
  badge(g, w - 16, 134, ink, 4, 'end');
  const s = {};
  const xs = [36, 84, 140, 188];
  (A.knobs || []).forEach((p, i) => { s[p] = K(xs[i % 4], i < 4 ? 184 : 226, 11.5); });
  if (A.toggle) s[A.toggle] = { x: w / 2, y: 280, orient: 'h' };
  s.led0 = { x: w - 18, y: 118, r: 2.4 };
  s.led1 = { x: 188, y: 258, r: 2.8 };
  s.foot0 = { x: 36, y: 280, r: 11, style: 'stomp', labelDy: 21 };
  s.foot1 = { x: 188, y: 280, r: 11, style: 'stomp', labelDy: 21 };
  return { w, h, slots: s, jy: 200, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'mxr', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 11. microwave oven (Reheat)
const microForm = form((g, def, A) => {
  dotsPattern();
  const w = 268, h = 238;
  const col = def.color || '#d9d5cc';
  const ink = def.text || '#22252b';
  const d = rr(0, 0, w, h - 6, 12);
  const b = shell(g, w, h, d, col, { grain: 0.35, gloss: true });
  // rubber feet
  for (const x of [22, w - 22]) R(g, x - 12, h - 9, 24, 8, 3, { fill: '#18191c' });
  const t = G(g, { 'clip-path': b.clip });
  // door + window (the interior lamp is the bypass LED, drawn above this)
  R(t, 10, 10, 168, 210, 8, { fill: lin('door', [[0, '#3a3d44'], [1, '#15161a']]) });
  R(t, 22, 22, 140, 172, 5, { fill: rad('oven', [[0, '#2a2418'], [1, '#0b0a08']], 0.5, 0.55, 0.7) });
  R(t, 182, 30, 6, 160, 3, { fill: 'url(#g-chrome)' });
  // control panel
  R(t, 196, 14, 62, 26, 4, { fill: '#0b120d', stroke: '#000', 'stroke-opacity': 0.6 });
  T(t, 227, 28, A.display || '0:30', { size: 15, fill: '#5dff8f', font: FONTS.mono });
  T(t, 202, 18.5, 'COOK', { size: 3.6, fill: '#5dff8f', font: FONTS.inter, anchor: 'start', weight: 700, opacity: 0.8 });
  b.edge();
  txt(g, 227, 204, (def.typeName || '').toUpperCase(), { size: 4.4, maxW: 66, font: 'inter', fill: ink, weight: 700, ls: 0.8, opacity: 0.7 });
  const s = {};
  if (A.sel) s[A.sel] = K(227, 72, 12, { optSize: 4.4, labelRadius: 6.5, labelPos: 'none' });
  const ks = A.knobs || [];
  ks.forEach((p, i) => { s[p] = K([208, 246][i % 2], i < 2 ? 116 : 158, 10.5); });
  s.led0 = { x: 92, y: 116, r: 34, bezel: 'none', color: '#ffcf6a' };
  // the switch is the big START pad under the door handle
  s.foot0 = { x: 92, y: 210, style: 'plate', w: 120, h: 18 };
  return {
    w, h, slots: s, jy: 116, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'chrome', labelSize: 6, labelLs: 0.4 },
    over() {
      const o = G(g);
      // turntable, food (a giant pick) and steam
      E(o, 92, 168, 56, 9, { fill: '#e9e6df', 'fill-opacity': 0.35, stroke: '#fff', 'stroke-opacity': 0.4 });
      P(o, 'M70 120Q92 106 114 120Q112 146 92 166Q72 146 70 120Z', { fill: lin('pick' + kid(def.accent || '#ff6a2a'), [[0, shade(def.accent || '#ff6a2a', 0.3)], [1, shade(def.accent || '#ff6a2a', -0.3)]]), stroke: '#000', 'stroke-opacity': 0.4 });
      T(o, 92, 132, 'TZ', { size: 9, fill: '#fff', weight: 800, font: FONTS.inter, opacity: 0.85 });
      for (const x of [78, 92, 106]) P(o, `M${x} 100q-5 -8 0 -16q5 -8 0 -16`, { stroke: '#fff', 'stroke-opacity': 0.45, 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' });
      // perforated window screen + glass
      R(o, 22, 22, 140, 172, 5, { fill: 'url(#t4-dots)' });
      R(o, 22, 22, 140, 172, 5, { fill: 'url(#g-glass)' });
      // START pad
      R(o, 34, 201, 116, 18, 5, { fill: lin('start', [[0, '#4a4e57'], [1, '#202227']]), stroke: '#000', 'stroke-opacity': 0.6 });
      T(o, 92, 210.5, 'START · STOP', { size: 6.2, fill: '#e9ecf1', weight: 800, ls: 1.4, font: FONTS.inter });
      txt(o, 92, 36, def.logo || def.name, { size: 15, maxW: 120, fill: def.logoColor || '#ffcf6a', weight: 700, ls: 4 });
    },
  };
});
function dotsPattern() {
  if (document.getElementById('t4-dots')) return;
  const p = svg('pattern', { id: 't4-dots', width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defsEl());
  svg('rect', { width: 5, height: 5, fill: '#000', 'fill-opacity': 0.42 }, p);
  svg('circle', { cx: 2.5, cy: 2.5, r: 1.5, fill: '#000', 'fill-opacity': 0 }, p);
  svg('circle', { cx: 2.5, cy: 2.5, r: 1.6, fill: '#fff', 'fill-opacity': 0.06 }, p);
}

// ================================================================== 12. rubber duck
const duckForm = form((g, def, A) => {
  const w = 232, h = 252;
  const col = def.color || '#ffd23f';
  const ink = def.text || '#4a2d00';
  const bodyP = 'M10 92L36 116C72 106 112 110 132 116L190 116C214 122 226 150 224 180C222 228 180 248 116 248C50 248 8 228 6 180C5 150 6 118 10 92Z';
  const headP = circ(150, 62, 54);
  const beakP = 'M194 60C210 56 228 60 230 70C226 78 214 80 196 80Z';
  softShadow(g, { w, h, path: bodyP + headP + beakP, dy: 12, blur: 9, opacity: 0.55 });
  P(g, beakP, { fill: lin('beak', [[0, '#ffae4a'], [1, '#e8641a']]), stroke: '#8a3a0a', 'stroke-opacity': 0.5 });
  P(g, 'M197 71C210 71 222 72 229 70', { stroke: '#8a3a0a', 'stroke-opacity': 0.55, fill: 'none' });
  const fill = rad('duck' + kid(col), [[0, shade(col, 0.45)], [0.6, col], [1, shade(col, -0.25)]], 0.4, 0.3, 0.8);
  P(g, bodyP, { fill });
  P(g, headP, { fill });
  for (const p of [bodyP, headP]) P(g, p, { fill: 'url(#p-grain)', 'fill-opacity': 0.3 });
  P(g, 'M118 110C130 118 172 118 184 110', { fill: 'none', stroke: shade(col, -0.3), 'stroke-opacity': 0.5, 'stroke-width': 1.2 });
  // blush + gloss
  E(g, 176, 86, 9, 5, { fill: '#ff8a4a', 'fill-opacity': 0.35 });
  E(g, 128, 30, 18, 9, { fill: '#fff', 'fill-opacity': 0.35, transform: 'rotate(-25 128 30)' });
  for (const p of [bodyP, headP]) { P(g, p, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.3, 'stroke-width': 1.2 }); P(g, p, { fill: 'none', stroke: '#7a5200', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }); }
  txt(g, 116, 138, def.logo || def.name, { size: 17, maxW: 170, fill: def.logoColor || ink, weight: 700, ls: 2 });
  txt(g, 116, 151, (def.typeName || '').toUpperCase(), { size: 5, maxW: 160, font: 'inter', fill: ink, weight: 700, ls: 1.3, opacity: 0.75 });
  badge(g, 116, 238, ink, 4);
  const s = {};
  const xs = [44, 89, 134, 179];
  (A.knobs || []).forEach((p, i) => { s[p] = i < 4 ? K(xs[i], 178, 11.5) : K(170, 214, 11); });
  if (A.toggle) s[A.toggle] = { x: 58, y: 224, orient: 'h' };
  s.led0 = { x: 166, y: 50, r: 4.6, bezel: '#1a1206', color: '#9ff3ff' };
  s.foot0 = { x: 116, y: 212, r: 11, style: 'stomp' };
  return {
    w, h, slots: s, jy: 178, edge: () => [6, 224], theme: { text: ink, knob: def.knob || 'white', labelSize: 6.2, labelLs: 0.5 },
    over() { C(g, 164, 48, 1.5, { fill: '#fff', 'fill-opacity': 0.9, 'pointer-events': 'none' }); },
  };
});

// ================================================================== 13. external modem (Dial-Up)
const modemForm = form((g, def, A) => {
  const w = 244, h = 232;
  const col = def.color || '#d9d2c3';
  const ink = def.text || '#2a2620';
  const d = rr(0, 0, w, h, 10);
  const b = shell(g, w, h, d, col, { grain: 0.45 });
  const t = G(g, { 'clip-path': b.clip });
  // sloped front face with the status LEDs
  R(t, 0, 146, w, h - 146, 0, { fill: shade(col, -0.12) });
  R(t, 0, 146, w, 1.4, 0, { fill: '#fff', 'fill-opacity': 0.5 });
  R(t, 0, 147.4, w, 1, 0, { fill: '#000', 'fill-opacity': 0.25 });
  R(t, 12, 156, w - 24, 24, 4, { fill: '#1a1916' });
  // vent slots
  for (let i = 0; i < 9; i++) P(t, `M${168 + i * 7} 12l-6 26`, { stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  b.edge();
  txt(g, 16, 22, def.logo || def.name, { size: 18, maxW: 140, fill: def.logoColor || ink, weight: 700, ls: 1.5, anchor: 'start' });
  txt(g, 16, 36, (def.typeName || '').toUpperCase(), { size: 4.8, maxW: 140, font: 'inter', fill: ink, weight: 700, ls: 1.2, anchor: 'start', opacity: 0.7 });
  T(g, w - 16, 220, 'V.90 · 56 000 bps', { size: 4.6, fill: ink, weight: 700, font: FONTS.inter, anchor: 'end', opacity: 0.6 });
  badge(g, 16, 220, ink, 4.2, 'start');
  const s = {};
  const xs = [36, 89, 142, 195];
  (A.knobs || []).forEach((p, i) => { s[p] = i < 4 ? K(xs[i], 70, 11.5) : K([60, 120, 180][i - 4], 114, 11.5); });
  const names = ['HS', 'AA', 'CD', 'OH', 'RD', 'SD', 'TR', 'MR'];
  names.forEach((n, i) => { s['led' + i] = { x: 30 + i * 26.3, y: 172, r: 2.4, label: n, textColor: '#d9d2c3', bezel: '#2a2926' }; });
  s.foot0 = { x: w / 2, y: 204, r: 10.5, style: 'stomp' };
  return { w, h, slots: s, jy: 92, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'cream', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 14. choir boy: robe, surplice, wings, halo
const haloForm = form((g, def, A) => {
  const w = 214, h = 304;
  const col = def.color || '#9b1c2c';
  const ink = def.text || '#fbeee0';
  const robe = 'M36 58Q107 30 178 58L194 290Q195 302 182 302H32Q19 302 20 290Z';
  const xl = (y) => 36 + ((20 - 36) * (y - 58)) / 232;
  // wings behind the robe
  const wing = 'M44 70C14 64 2 90 4 120C6 150 14 176 34 196C30 170 34 150 40 130Z';
  softShadow(g, { w, h, path: robe + wing, dy: 12, blur: 9, opacity: 0.55 });
  for (const m of [1, -1]) {
    const tr = m === 1 ? '' : `translate(${w},0) scale(-1,1)`;
    P(g, wing, { fill: lin('wing', [[0, '#ffffff'], [1, '#d9dde6']], 0, 0, 1, 1), stroke: '#8a90a0', 'stroke-opacity': 0.6, transform: tr, 'pointer-events': 'none' });
    P(g, 'M36 90C22 96 14 110 12 124M36 112C24 120 18 134 18 148M38 134C30 142 26 156 28 170', { stroke: '#8a90a0', 'stroke-opacity': 0.55, fill: 'none', transform: tr, 'pointer-events': 'none' });
  }
  const b = shell(g, w, h, robe, col, { grain: 0.4, dy: 0.01 });
  const t = G(g, { 'clip-path': b.clip });
  // white surplice with a lace hem
  let lace = '';
  for (let k = 0; k < 10; k++) lace += `Q${12 + k * 19 + 9.5} 160 ${12 + (k + 1) * 19} 150`;
  P(t, `M12 150${lace}V40H12Z`, { fill: lin('surplice', [[0, '#ffffff'], [1, '#e4e6ee']]) });
  for (let k = 0; k < 10; k++) C(t, 12 + k * 19 + 9.5, 152, 1.6, { fill: col, 'fill-opacity': 0.6 });
  for (const x of [70, 107, 144]) P(t, `M${x} 64C${x - 3} 100 ${x + 3} 120 ${x} 150`, { stroke: '#9aa0b0', 'stroke-opacity': 0.35, 'stroke-width': 1.2, fill: 'none' });
  // ruff collar
  for (let k = 0; k < 9; k++) C(t, 74 + k * 8.25, 46 + Math.sin((k / 8) * Math.PI) * 6, 6, { fill: '#fff', stroke: '#c9ccd6', 'stroke-width': 0.6 });
  b.edge();
  // halo
  E(g, 107, 38, 40, 9, { fill: 'none', stroke: lin('halo', [[0, '#fff2b0'], [0.5, '#e8b93a'], [1, '#a8781a']]), 'stroke-width': 5, 'pointer-events': 'none' });
  E(g, 107, 38, 40, 9, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.5, 'stroke-width': 1, 'pointer-events': 'none' });
  // music notes
  for (const [x, y] of [[44, 120], [168, 112]]) { E(g, x, y, 3.4, 2.4, { fill: col, transform: `rotate(-20 ${x} ${y})`, 'pointer-events': 'none' }); P(g, `M${x + 3} ${y - 1}V${y - 14}l5 3`, { stroke: col, 'stroke-width': 1.2, fill: 'none', 'pointer-events': 'none' }); }
  txt(g, 107, 96, def.logo || def.name, { size: 18, maxW: 116, fill: def.logoColor || col, weight: 700, ls: 2 });
  txt(g, 107, 110, (def.typeName || '').toUpperCase(), { size: 4.8, maxW: 110, font: 'inter', fill: shade(col, -0.2), weight: 700, ls: 1.1, opacity: 0.85 });
  badge(g, 107, 293, ink, 4);
  const s = {};
  const [k1, sel, k2, ...row2] = A.knobs || [];
  s[k1] = K(50, 190, 11.5); s[k2] = K(164, 190, 11.5);
  s[sel] = K(107, 192, 12, { optSize: 4.3, labelRadius: 6.5 });
  row2.forEach((p, i) => { s[p] = K([46, 87, 128][i], 240, 11); });
  if (A.toggle) s[A.toggle] = { x: 168, y: 242, orient: 'h' };
  s.led0 = { x: 136, y: 272, r: 2.8 };
  s.foot0 = { x: 107, y: 272, r: 10.5, style: 'stomp' };
  return { w, h, slots: s, jy: 284, edge: (y) => [xl(y), w - xl(y)], theme: { text: ink, knob: def.knob || 'cream', labelSize: 6.2, labelLs: 0.5 } };
});

// ================================================================== 15. haunted house
const houseForm = form((g, def, A) => {
  const w = 220, h = 312;
  const col = def.color || '#3b3350';
  const ink = def.text || '#e9e0ff';
  const glow = def.accent || '#ffcf5a';
  // chimney behind the roof
  softShadow(g, { w: 20, h: 50, rx: 1, dy: 10, blur: 6, opacity: 0.5, x: 156, y: 36 });
  R(g, 156, 36, 20, 50, 1, { fill: lin('brick', [[0, '#5a3a3a'], [1, '#2e1d1d']]) });
  R(g, 152, 32, 28, 7, 1, { fill: '#2a1a1a' });
  const d = 'M6 302V128H0L110 24L220 128H214V302Q214 312 204 312H16Q6 312 6 302Z';
  const b = shell(g, w, h, d, col, { grain: 0.45 });
  const t = G(g, { 'clip-path': b.clip });
  // siding
  for (let y = 132; y < 312; y += 9) P(t, `M0 ${y}H220`, { stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 0.8 });
  // roof shingles
  P(t, 'M0 128L110 24L220 128Z', { fill: lin('roof', [[0, '#2a2338'], [1, '#17131f']]) });
  for (let y = 44; y < 128; y += 8) P(t, `M0 ${y}H220`, { stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.8 });
  P(t, 'M0 128L110 24L220 128', { fill: 'none', stroke: '#6b5a8a', 'stroke-width': 3 });
  // cobweb
  P(t, 'M14 128L40 106M14 128L28 100M14 128L48 122M22 121Q28 113 34 116M28 112Q32 106 37 108', { stroke: '#d8d0e8', 'stroke-opacity': 0.4, 'stroke-width': 0.6, fill: 'none' });
  // windows (one with a ghost)
  for (const x of [50, 170]) {
    R(t, x - 15, 140, 30, 34, 2, { fill: '#1a1424', stroke: '#6b5a8a', 'stroke-width': 2 });
    R(t, x - 13, 142, 26, 30, 1, { fill: rad('win' + kid(glow), [[0, glow, 0.55], [1, glow, 0.08]]) });
    P(t, `M${x} 142V172M${x - 13} 157H${x + 13}`, { stroke: '#1a1424', 'stroke-width': 1.6 });
  }
  P(t, 'M164 170V152Q164 145 170 145Q176 145 176 152V170L173 167L170 170L167 167Z', { fill: '#f4f0ff', 'fill-opacity': 0.8 });
  C(t, 168, 152, 0.9, { fill: '#1a1424' }); C(t, 172, 152, 0.9, { fill: '#1a1424' });
  // door
  P(t, 'M92 312V278Q92 262 110 262Q128 262 128 278V312Z', { fill: lin('door', [[0, '#3a2418'], [1, '#1d120c']]), stroke: '#6b5a8a', 'stroke-width': 2 });
  C(t, 122, 292, 1.8, { fill: glow });
  // attic window frame (the LED is the light)
  C(t, 110, 88, 13, { fill: '#1a1424', stroke: '#6b5a8a', 'stroke-width': 2.2 });
  b.edge();
  txt(g, 110, 110, def.logo || def.name, { size: 17, maxW: 130, fill: def.logoColor || glow, weight: 700, ls: 3 });
  txt(g, 110, 121, (def.typeName || '').toUpperCase(), { size: 4.4, maxW: 150, font: 'inter', fill: ink, weight: 700, ls: 1.1, opacity: 0.8 });
  const s = {};
  const pos = [[44, 190], [110, 190], [176, 190], [44, 236], [110, 236], [176, 236]];
  (A.knobs || []).forEach((p, i) => { s[p] = K(pos[i][0], pos[i][1], 11.5); });
  s.led0 = { x: 110, y: 88, r: 9, bezel: '#1a1424', color: glow };
  s.foot0 = { x: 110, y: 290, style: 'plate', w: 36, h: 44 };
  return {
    w, h, slots: s, jy: 214, edge: () => [6, 214], theme: { text: ink, knob: def.knob || 'chrome', labelSize: 6.2, labelLs: 0.5 },
    over() { P(g, 'M110 75V101M97 88H123', { stroke: '#1a1424', 'stroke-width': 1.6, 'pointer-events': 'none' }); },
  };
});

// ================================================================== 16. goblin head
const goblinForm = form((g, def, A) => {
  const w = 252, h = 268;
  const col = def.color || '#5d8c3a';
  const ink = def.text || '#16220c';
  const d = 'M126 12C182 12 210 50 212 96L250 64L216 130C216 202 186 264 126 264C66 264 36 202 36 130L2 64L40 96C42 50 70 12 126 12Z';
  const b = shell(g, w, h, d, col, { tex: noise('gob', 30, 60, [20, 40, 0], 0, 0.3, 1), grain: 0.35 });
  const t = G(g, { 'clip-path': b.clip });
  for (const m of [1, -1]) {
    const tr = m === 1 ? '' : `translate(${w},0) scale(-1,1)`;
    P(t, 'M44 104L12 74L42 118Z', { fill: shade(col, -0.35), transform: tr });
    // brow
    P(t, 'M70 70Q96 58 116 72', { stroke: shade(col, -0.5), 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none', transform: tr });
    // eye
    P(t, 'M74 86Q96 72 114 86Q96 98 74 86Z', { fill: rad('gobeye', [[0, '#fff36a'], [1, '#c99a12']]), stroke: '#1c1006', 'stroke-width': 1.4, transform: tr });
  }
  // warts
  for (const [x, y, r] of [[64, 140, 3], [196, 120, 2.4], [182, 210, 2.8], [78, 220, 2.2]]) C(t, x, y, r, { fill: shade(col, -0.3) });
  // nose
  P(t, 'M120 94Q126 90 130 96Q140 116 132 122Q124 126 118 118Z', { fill: shade(col, -0.15), stroke: shade(col, -0.5), 'stroke-width': 1 });
  // grin with teeth
  P(t, 'M80 134Q126 170 172 134Q170 152 126 160Q82 152 80 134Z', { fill: '#2a0e0a' });
  let teeth = 'M86 138';
  for (let i = 0; i < 10; i++) teeth += `L${90 + i * 8.6} ${144 + (i % 2 ? 0 : 5)}`;
  P(t, teeth + 'L170 138Q126 160 86 138Z', { fill: '#efe6c2' });
  P(t, 'M96 141L100 158L105 143ZM147 143L152 158L156 141Z', { fill: '#fffbe6', stroke: '#2a0e0a', 'stroke-width': 0.6 });
  b.edge();
  txt(g, 126, 40, def.logo || def.name, { size: 19, maxW: 120, fill: def.logoColor || ink, weight: 700, ls: 3 });
  txt(g, 126, 54, (def.typeName || '').toUpperCase(), { size: 4.8, maxW: 110, font: 'inter', fill: ink, weight: 700, ls: 1.1, opacity: 0.8 });
  const s = {};
  const pos = [[72, 186], [126, 186], [180, 186], [94, 222], [158, 222]];
  (A.knobs || []).forEach((p, i) => { s[p] = K(pos[i][0], pos[i][1], 11.5); });
  s.led0 = { x: 94, y: 86, r: 3, bezel: '#1c1006', color: '#ff2a1a' };
  s.led1 = { x: w - 94, y: 86, r: 3, bezel: '#1c1006', color: '#ff2a1a' };
  s.foot0 = { x: 126, y: 230, r: 10, style: 'stomp' };
  return { w, h, slots: s, jy: 168, edge: () => [37, 215], theme: { text: ink, knob: def.knob || 'rat', labelSize: 6.4, labelLs: 0.5 } };
});

// ================================================================== 17. stopwatch (Speedrun)
const watchForm = form((g, def, A) => {
  const w = 214, h = 272;
  const col = def.color || '#c9ced6';
  const ink = def.text || '#16181c';
  const acc = def.accent || '#ff3b5c';
  const cx = 107, cy = 166, R0 = 104;
  // stem + lap button
  R(g, 98, 14, 18, 52, 3, { fill: lin('stem', [[0, '#9aa0aa'], [0.5, '#eef1f5'], [1, '#7a808a']], 0, 0, 1, 0) });
  const lb = G(g, { transform: `rotate(42 ${cx} ${cy})` });
  R(lb, cx - 7, cy - R0 - 12, 14, 16, 3, { fill: lin('stem', [[0, '#9aa0aa'], [0.5, '#eef1f5'], [1, '#7a808a']], 0, 0, 1, 0) });
  const d = circ(cx, cy, R0);
  const b = shell(g, w, h, d, col, { fill: rad('watch' + kid(col), [[0, shade(col, 0.5)], [0.7, col], [1, shade(col, -0.45)]], 0.35, 0.3, 0.8), grain: 0.3 });
  void b;
  C(g, cx, cy, R0 - 6, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 2 });
  // dial
  C(g, cx, cy, 92, { fill: rad('dial', [[0, '#ffffff'], [1, '#e2e5ea']]) });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, r1 = i % 5 ? 87 : 82;
    P(g, `M${(cx + Math.sin(a) * r1).toFixed(1)} ${(cy - Math.cos(a) * r1).toFixed(1)}L${(cx + Math.sin(a) * 91).toFixed(1)} ${(cy - Math.cos(a) * 91).toFixed(1)}`, { stroke: i % 5 ? '#6a6f78' : ink, 'stroke-width': i % 5 ? 0.6 : 1.4 });
    if (i === 10 || i === 50) T(g, cx + Math.sin(a) * 75, cy - Math.cos(a) * 75, String(i), { size: 6.4, fill: ink, weight: 800, font: FONTS.inter });
  }
  T(g, cx, cy - 75, '60', { size: 6.4, fill: acc, weight: 800, font: FONTS.inter });
  // split display
  R(g, cx - 42, 100, 84, 22, 4, { fill: '#1a1d22' });
  R(g, cx - 39, 103, 78, 16, 2, { fill: lin('lcd', [[0, '#b7c7a0'], [1, '#93a67c']]) });
  T(g, cx, 111.5, A.split || '0:42.069', { size: 12, fill: '#1d2416', font: FONTS.mono });
  T(g, cx - 36, 106.5, 'WR', { size: 3.8, fill: '#1d2416', font: FONTS.inter, weight: 800, anchor: 'start' });
  txt(g, cx, 140, def.logo || def.name, { size: 16, maxW: 110, fill: def.logoColor || ink, weight: 700, ls: 3 });
  txt(g, cx, 152, (def.typeName || '').toUpperCase(), { size: 4.6, maxW: 110, font: 'inter', fill: acc, weight: 700, ls: 1.1 });
  const s = {};
  (A.knobs || []).forEach((p, i) => { s[p] = K([50, 88, 126, 164][i], 182, 10.5); });
  s.foot0 = { x: cx, y: 8, r: 8, style: 'soft' };
  s.foot1 = { x: cx, y: 228, r: 10.5, style: 'stomp' };
  s.led0 = { x: 72, y: 228, r: 2.6, label: 'ON', textColor: ink };
  s.led1 = { x: 142, y: 228, r: 2.6, label: 'TAP', textColor: ink, color: acc };
  return { w, h, slots: s, jy: 166, edge: () => [3, 211], theme: { text: ink, knob: def.knob || 'mxr', labelSize: 6, labelLs: 0.4 } };
});

// ================================================================== 18. RPG dialogue box (NPC)
const VILLAGER = ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'X.XXXX.X', 'XX....XX', '.XXXXXX.', '..XXXX..'];
const dialogForm = form((g, def, A) => {
  const w = 252, h = 226;
  const col = def.color || '#1b2a6b';
  const ink = def.text || '#ffffff';
  const box = rr(0, 24, w, h - 24, 10), tab = rr(14, 0, 82, 34, 6);
  softShadow(g, { w, h, path: box + tab, dy: 12, blur: 9, opacity: 0.6 });
  for (const p of [tab, box]) { P(g, p, { fill: lin('npc' + kid(col), [[0, shade(col, 0.2)], [1, shade(col, -0.35)]]) }); P(g, p, { fill: 'url(#p-grain)', 'fill-opacity': 0.4 }); }
  P(g, rr(5, 29, w - 10, h - 34, 6), { fill: 'none', stroke: '#fff', 'stroke-width': 2 });
  P(g, rr(9, 33, w - 18, h - 42, 4), { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.4, 'stroke-width': 0.8 });
  P(g, rr(19, 5, 72, 24, 4), { fill: 'none', stroke: '#fff', 'stroke-width': 1.6 });
  P(g, 'M18 30H92', { stroke: shade(col, -0.1), 'stroke-width': 4 });
  txt(g, 55, 17, def.logo || def.name, { size: 12, maxW: 64, font: 'mono', fill: def.logoColor || '#ffe066', ls: 1 });
  // portrait
  R(g, 18, 42, 46, 46, 3, { fill: '#0d1640', stroke: '#fff', 'stroke-width': 1.2 });
  let dp = '';
  VILLAGER.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X') dp += `M${23 + x * 4.5} ${46 + y * 4.5}h4.5v4.5h-4.5Z`; }));
  P(g, dp, { fill: A.skin || '#ffb36b' });
  // dialogue text
  const lines = A.lines || ['* Hello, traveler!', '* Nice tone you got', '  there. Wanna trade?'];
  lines.forEach((l, i) => T(g, 74, 50 + i * 12, l, { size: 8, fill: ink, font: FONTS.mono, anchor: 'start', ls: 0.2 }));
  P(g, `M${w - 26} 202l6 0l-3 5z`, { fill: '#fff', 'pointer-events': 'none' });
  txt(g, 74, 92, (def.typeName || '').toUpperCase(), { size: 4.6, maxW: 160, font: 'inter', fill: '#cfd8ff', weight: 700, ls: 1, anchor: 'start', opacity: 0.8 });
  const s = {};
  (A.knobs || []).forEach((p, i) => { s[p] = K(30 + i * 38.4, 120, 10.5); });
  if (A.sel) s[A.sel] = K(56, 182, 10.5, { optSize: 4.3, labelRadius: 6 });
  s.foot0 = { x: 136, y: 182, r: 10.5, style: 'stomp' };
  s.led0 = { x: 196, y: 182, r: 2.8, label: 'TALKING', textColor: '#cfd8ff' };
  return { w, h, slots: s, jy: 128, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'white', labelSize: 6, labelLs: 0.4, jackLabels: false } };
});

// ================================================================== 19. vaporwave window (Slowed + Reverb)
const vaporForm = form((g, def, A) => {
  const w = 232, h = 304;
  const col = def.color || '#c3c3c3';
  const ink = def.text || '#111111';
  const d = rr(0, 0, w, h, 3);
  shell(g, w, h, d, col, { fill: col, grain: 0.15, dy: 12 });
  // win95 bevel
  P(g, `M1 ${h - 1}V1H${w - 1}`, { stroke: '#fff', 'stroke-width': 2, fill: 'none' });
  P(g, `M${w - 1} 1V${h - 1}H1`, { stroke: '#404040', 'stroke-width': 2, fill: 'none' });
  // title bar
  R(g, 5, 5, w - 10, 18, 0, { fill: lin('title95', [[0, '#000080'], [1, '#b04fd0']], 0, 0, 1, 0) });
  T(g, 26, 14.5, A.title || 'slowed_reverb.exe', { size: 7, fill: '#fff', font: FONTS.mono, anchor: 'start' });
  ['_', '□', '×'].forEach((c, i) => {
    const x = w - 49 + i * 15;
    R(g, x, 8, 13, 12, 0, { fill: col });
    P(g, `M${x} ${20}V8H${x + 13}`, { stroke: '#fff', fill: 'none' });
    P(g, `M${x + 13} 8V20H${x}`, { stroke: '#404040', fill: 'none' });
    T(g, x + 6.5, 14, c, { size: 8, fill: '#000', font: FONTS.mono });
  });
  // sky scene
  const sx = 8, sy = 28, sw = w - 16, sh = 128;
  P(g, `M${sx} ${sy + sh}V${sy}H${sx + sw}`, { stroke: '#808080', fill: 'none', 'stroke-width': 1.4 });
  R(g, sx, sy, sw, sh, 0, { fill: lin('vsky', [[0, '#2b1055'], [0.55, '#d53f8c'], [1, '#ff9a5a']]) });
  const sun = G(g);
  const scx = w / 2, scy = sy + 92, sr = 40;
  const cid = 't4c' + ++clipSeq;
  const cp = svg('clipPath', { id: cid }, g);
  R(cp, sx, sy, sw, 104, 0, {});
  const sunG = G(sun, { 'clip-path': `url(#${cid})` });
  C(sunG, scx, scy, sr, { fill: lin('vsun', [[0, '#ffe36a'], [1, '#ff4f9a']]) });
  for (let i = 0; i < 5; i++) R(sunG, scx - sr, scy - 4 + i * 6, sr * 2, 1.6 + i * 0.7, 0, { fill: '#d53f8c' });
  // grid floor
  R(g, sx, sy + 104, sw, sh - 104, 0, { fill: '#1a0636' });
  const gid = 't4c' + ++clipSeq;
  R(svg('clipPath', { id: gid }, g), sx, sy + 104, sw, sh - 104, 0, {});
  const grid = G(g, { 'clip-path': `url(#${gid})` });
  for (let i = 0; i <= 10; i++) P(grid, `M${scx} ${sy + 104}L${sx + (sw * i) / 10 + (i - 5) * 18} ${sy + sh}`, { stroke: '#ff4fd8', 'stroke-opacity': 0.8, 'stroke-width': 0.7 });
  for (const yy of [2, 6, 12, 20]) P(grid, `M${sx} ${sy + 104 + yy}H${sx + sw}`, { stroke: '#ff4fd8', 'stroke-opacity': 0.8, 'stroke-width': 0.7 });
  const logo = def.logo || def.name;
  txt(g, w / 2 + 1.2, sy + 23.2, logo, { size: 15, maxW: sw - 20, fill: '#00e5ff', weight: 700, ls: 3.5 });
  txt(g, w / 2, sy + 22, logo, { size: 15, maxW: sw - 20, fill: '#fff', weight: 700, ls: 3.5 });
  txt(g, w / 2, sy + 38, (def.typeName || '').toUpperCase(), { size: 5, maxW: sw - 30, font: 'inter', fill: '#ffe1f4', weight: 700, ls: 2 });
  // OK button (bypass)
  const bx = w / 2 - 36, by = 266;
  R(g, bx, by, 72, 24, 0, { fill: col });
  P(g, `M${bx} ${by + 24}V${by}H${bx + 72}`, { stroke: '#fff', 'stroke-width': 1.6, fill: 'none' });
  P(g, `M${bx + 72} ${by}V${by + 24}H${bx}`, { stroke: '#404040', 'stroke-width': 1.6, fill: 'none' });
  R(g, bx + 4, by + 4, 64, 16, 0, { fill: 'none', stroke: '#000', 'stroke-dasharray': '1 1', 'stroke-width': 0.6 });
  T(g, w / 2, by + 12.5, 'OK', { size: 8, fill: '#000', weight: 700, font: FONTS.inter });
  T(g, 12, h - 10, 'TONE ZONE', { size: 4.4, fill: '#404040', weight: 800, ls: 1.4, font: FONTS.inter, anchor: 'start' });
  const s = {};
  const pos = [[48, 184], [116, 184], [184, 184], [48, 230], [116, 230], [184, 230]];
  (A.knobs || []).forEach((p, i) => { s[p] = K(pos[i][0], pos[i][1], 12); });
  s.led0 = { x: 15, y: 14, r: 3, color: '#3dffb0', bezel: '#202020' };
  s.foot0 = { x: w / 2, y: by + 12, style: 'plate', w: 72, h: 24 };
  return { w, h, slots: s, jy: 200, edge: () => [0, w], theme: { text: ink, knob: def.knob || 'white', labelSize: 6.4, labelLs: 0.5 } };
});

// ================================================================== 20. whoopee cushion
const cushionForm = form((g, def, A) => {
  const w = 212, h = 246;
  const col = def.color || '#ff6f9c';
  const ink = def.text || '#4a0a22';
  const body = 'M106 46C170 46 210 90 210 142C210 200 166 238 106 238C46 238 2 200 2 142C2 90 42 46 106 46Z';
  const neck = 'M88 56L94 18H118L124 56Z';
  softShadow(g, { w, h, path: body + neck, dy: 12, blur: 9, opacity: 0.55 });
  const fill = rad('cush' + kid(col), [[0, shade(col, 0.45)], [0.65, col], [1, shade(col, -0.35)]], 0.4, 0.32, 0.75);
  P(g, neck, { fill: lin('neck' + kid(col), [[0, shade(col, -0.2)], [0.5, shade(col, 0.25)], [1, shade(col, -0.3)]], 0, 0, 1, 0) });
  E(g, 106, 18, 14, 5, { fill: shade(col, -0.15), stroke: shade(col, -0.45), 'stroke-width': 0.8 });
  E(g, 106, 18, 8, 2.4, { fill: shade(col, -0.6) });
  P(g, body, { fill });
  P(g, body, { fill: 'url(#p-grain)', 'fill-opacity': 0.3 });
  E(g, 70, 82, 26, 10, { fill: '#fff', 'fill-opacity': 0.35, transform: 'rotate(-24 70 82)' });
  P(g, 'M22 142C40 156 172 156 190 142', { fill: 'none', stroke: shade(col, -0.35), 'stroke-opacity': 0.5, 'stroke-width': 1.4 });
  P(g, body, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.3, 'stroke-width': 1.2 });
  P(g, body, { fill: 'none', stroke: shade(col, -0.6), 'stroke-opacity': 0.7, 'stroke-width': 0.8 });
  txt(g, 106, 104, def.logo || def.name, { size: 21, maxW: 150, fill: '#fff', weight: 700, ls: 2 });
  txt(g, 106, 120, (def.typeName || '').toUpperCase(), { size: 5, maxW: 150, font: 'inter', fill: ink, weight: 700, ls: 1.2, opacity: 0.8 });
  const s = {};
  const pos = [[56, 156], [106, 156], [156, 156], [66, 200], [146, 200]];
  (A.knobs || []).forEach((p, i) => { s[p] = K(pos[i][0], pos[i][1], 11.5); });
  s.led0 = { x: 106, y: 32, r: 2.6 };
  s.foot0 = { x: 106, y: 206, r: 10.5, style: 'stomp' };
  return { w, h, slots: s, jy: 146, edge: () => [3, 209], theme: { text: ink, knob: def.knob || 'white', labelSize: 6.4, labelLs: 0.5 } };
});

export function installTz4Forms(registerForm) {
  registerForm('tz4-ghost', ghostForm);
  registerForm('tz4-lag', lagForm);
  registerForm('tz4-microwave', microForm);
  registerForm('tz4-duck', duckForm);
  registerForm('tz4-modem', modemForm);
  registerForm('tz4-halo', haloForm);
  registerForm('tz4-house', houseForm);
  registerForm('tz4-goblin', goblinForm);
  registerForm('tz4-watch', watchForm);
  registerForm('tz4-dialog', dialogForm);
  registerForm('tz4-vapor', vaporForm);
  registerForm('tz4-cushion', cushionForm);
  registerForm('tz4-arch', archForm);
  registerForm('tz4-disco', discoForm);
  registerForm('tz4-arcade', arcadeForm);
  registerForm('tz4-sub', subForm);
  registerForm('tz4-ufo', ufoForm);
  registerForm('tz4-cat', catForm);
  registerForm('tz4-router', routerForm);
  registerForm('tz4-dejavu', dejavuForm);
}
