// Enclosures for the v0.4.0 Tone Zone multi-effects originals (catalog/originals4.js): the Atlas Floor flagship
// (two treadles, 12 footswitches with scribble strips), the Aurora Desk (angled desktop deck + stomp row), the
// Pixel Quest handheld console and the Low Foundry bass floor unit. Controls are placed by their `role` (or param)
// on every render (control objects are shared between renders). No SVG filters: gradients + cached noise tiles.
import { svg, shade } from '../util.js';
import { softShadow, noisePattern } from './fx.js';
import { label } from './controls.js';
import { formKit } from './forms.js'; // cyclic import: only touched at render time

// ------------------------------------------------------------------ paint helpers
function defsEl() {
  let d = document.getElementById('globalDefs') || document.getElementById('tz5Defs');
  if (!d) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.style.position = 'absolute';
    d = svg('defs', { id: 'tz5Defs' }, s);
    document.body.appendChild(s);
  }
  return d;
}
const kid = (c) => String(c).replace(/[^a-z0-9]/gi, '');
function lin(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  id = 't5l-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('linearGradient', { id, x1, y1, x2, y2 }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function rad(id, stops, cx = 0.5, cy = 0.5, r = 0.5) {
  id = 't5r-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('radialGradient', { id, cx, cy, r }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function noise(id, units, px, rgb, a0, a1, smooth = 1) {
  id = 't5n-' + id;
  if (!document.getElementById(id)) noisePattern(defsEl(), id, units, px, rgb, a0, a1, smooth);
  return `url(#${id})`;
}
const Pth = (p, d, a = {}) => svg('path', Object.assign({ d }, a), p);
const Cir = (p, cx, cy, r, a = {}) => svg('circle', Object.assign({ cx, cy, r }, a), p);
const Rct = (p, x, y, width, height, rx, a = {}) => svg('rect', Object.assign({ x, y, width, height, rx }, a), p);
const G = (p, a = {}) => svg('g', Object.assign({ 'pointer-events': 'none' }, a), p);
const T = (p, x, y, s, o = {}) => label(p, x, y, s, o);
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
const OSW = "'Oswald', sans-serif", INTER = "'Inter', sans-serif", BAR = "'Barlow Condensed', sans-serif";

function shell(g, w, h, d, fill, o = {}) {
  softShadow(g, { w, h, path: d, dy: o.dy ?? 14, blur: 9, opacity: 0.6 });
  Pth(g, d, { fill });
  if (o.tex) Pth(g, d, { fill: o.tex });
  if (o.grain !== false) Pth(g, d, { fill: 'url(#p-grain)', 'fill-opacity': o.grain ?? 0.5 });
}
function edge(g, d, a = 0.22) {
  Pth(g, d, { fill: 'none', stroke: '#fff', 'stroke-opacity': a, 'stroke-width': 1.2, 'pointer-events': 'none' });
  Pth(g, d, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8, 'pointer-events': 'none' });
}
function screwAt(g, x, y, r = 3) {
  Cir(g, x, y + 0.6, r + 0.6, { fill: '#000', 'fill-opacity': 0.45 });
  Cir(g, x, y, r, { fill: 'url(#g-chromeR)' });
  Pth(g, `M${x - r * 0.65} ${y}H${x + r * 0.65}`, { stroke: '#3a3f45', 'stroke-width': 0.9 });
}

// place controls by role / param / screen kind; everything without a slot is parked off-canvas
function keyOf(c) {
  if (c.role) return c.role;
  if (c.t === 'screen') return 'scr:' + c.kind + (c.row ?? '');
  if (c.p && c.p.startsWith('_p.')) return c.p.slice(3);
  return c.p;
}
function place(def, slots) {
  for (const c of def.controls) {
    const s = slots[keyOf(c)];
    if (s) Object.assign(c, s);
    else Object.assign(c, { x: -999, y: -999 });
  }
}
function finish(ctx, def, slots, theme, w, h, jy, jgap = 26, alt = null, altTheme = null) {
  place(def, slots);
  const list = def.controls.filter((c) => c.x > -900);
  formKit.placeControls(ctx, alt ? list.filter((c) => !alt(c)) : list, theme);
  if (alt) formKit.placeControls(ctx, list.filter(alt), Object.assign({}, theme, altTheme));
  return { w, h, theme, jacks: formKit.jacksSide(def, w, { y0: jy, gap: jgap, flip: ctx.flip }) };
}

// ================================================================== 1. ATLAS FLOOR (800 × 404)
function atlasForm(ctx, def) {
  const g = ctx.g, w = 800, h = 404;
  const col = def.color || '#24272d', acc = def.accent || '#ff8a3d';
  const d = rr(0, 0, w, h, 16);
  shell(g, w, h, d, lin('atl' + kid(col), [[0, shade(col, 0.18)], [0.5, col], [1, shade(col, -0.3)]]), { grain: 0.6 });
  // side treadle wells
  for (const x of [10, w - 90]) {
    Rct(g, x, 10, 80, h - 20, 12, { fill: '#0d0e11' });
    Rct(g, x, 10, 80, h - 20, 12, { fill: noise('rub', 18, 36, [255, 255, 255], 0, 0.05, 1) });
    Rct(g, x + 0.5, 10.5, 79, h - 21, 11.5, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08 });
  }
  // top deck (brushed, slightly raised) and the floor deck with rubber texture
  const tx = 98, tw = w - 196;
  Rct(g, tx, 10, tw, 214, 10, { fill: lin('atltop' + kid(col), [[0, shade(col, 0.32)], [1, shade(col, 0.06)]]) });
  Rct(g, tx, 10, tw, 214, 10, { fill: 'url(#p-brushed)', 'fill-opacity': 0.7 });
  Rct(g, tx + 0.5, 10.5, tw - 1, 213, 9.5, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.14 });
  Rct(g, tx, 232, tw, h - 242, 10, { fill: '#15171b' });
  Rct(g, tx, 232, tw, h - 242, 10, { fill: noise('floor', 20, 40, [255, 255, 255], 0, 0.06, 1) });
  // accent ribbon between the decks
  Rct(g, tx + 14, 225.5, tw - 28, 2.4, 1.2, { fill: acc, 'fill-opacity': 0.9 });
  // printing
  T(g, tx + 14, 30, def.logo || 'ATLAS', { size: 20, fill: '#f2f3f5', font: OSW, weight: 700, ls: 5, anchor: 'start' });
  T(g, tx + 15, 46, 'FLOOR MODELER', { size: 5.6, fill: acc, font: INTER, weight: 800, ls: 2.2, anchor: 'start' });
  T(g, w - tx - 14, 22, 'TONE ZONE', { size: 5, fill: '#c9ced8', font: INTER, weight: 800, ls: 1.8, anchor: 'end', opacity: 0.8 });
  // joystick cluster plate
  Cir(g, 640, 94, 34, { fill: '#121418', stroke: '#000', 'stroke-opacity': 0.6 });
  Cir(g, 640, 94, 34, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08, 'stroke-width': 2 });
  for (const [dx, dy, a] of [[0, -31, 0], [0, 31, 180], [-31, 0, -90], [31, 0, 90]]) Pth(g, 'M-2.6 1.6L0 -1.8L2.6 1.6Z', { fill: '#9aa3b4', transform: `translate(${640 + dx},${94 + dy}) rotate(${a})` });
  T(g, 640, 136, 'NAVIGATE', { size: 4.6, fill: '#8d95a5', font: INTER, weight: 800, ls: 1.4 });
  // knob numbers under the screen
  const kx = (i) => 400 + (i - 2.5) * 54;
  for (let i = 0; i < 6; i++) T(g, kx(i), 222, String(i + 1), { size: 5, fill: '#8d95a5', font: INTER, weight: 800 });
  // footswitch row legends
  T(g, 650, 248, 'FUNCTION', { size: 4.6, fill: '#6e7686', font: INTER, weight: 800, ls: 1.4 });
  for (const [x, t] of [[50, 'EXP 2 · ASSIGN'], [w - 50, 'EXP 1 · WAH / VOL']]) T(g, x, h - 4.5, t, { size: 4.4, fill: '#8d95a5', font: INTER, weight: 800, ls: 1 });
  for (const [x, y] of [[tx + 6, 16], [w - tx - 6, 16], [tx + 6, 218], [w - tx - 6, 218]]) screwAt(g, x, y, 2.4);
  edge(g, d);
  const fsx = (i) => 140 + (i % 5) * 104, fsy = (i) => (i < 5 ? 286 : 362);
  const slots = {
    'scr:tz5-atlas': { x: 400, y: 100, w: 330, h: 160, bezel: '#050608' },
    'scr:tz5-atlas-strip0': { x: 348, y: 250, w: 520, h: 15, bezel: '#050608' },
    'scr:tz5-atlas-strip1': { x: 348, y: 326, w: 520, h: 15, bezel: '#050608' },
    menu: { x: 132, y: 74, color: '#2c3038' }, home: { x: 132, y: 100, color: '#2c3038' }, save: { x: 132, y: 126, color: '#3a2a20' },
    pgl: { x: 206, y: 206, color: '#2c3038', labelPos: 'none' }, pgr: { x: 594, y: 206, color: '#2c3038', labelPos: 'none' },
    up: { x: 640, y: 72, color: '#2c3038', labelPos: 'none' }, down: { x: 640, y: 116, color: '#2c3038', labelPos: 'none' },
    left: { x: 616, y: 94, color: '#2c3038', labelPos: 'none' }, right: { x: 664, y: 94, color: '#2c3038', labelPos: 'none' },
    enter: { x: 640, y: 94, r: 8, color: '#3a3f49', labelPos: 'none' },
    back: { x: 610, y: 160, color: '#2c3038' }, onoff: { x: 670, y: 160, color: '#2c3038' },
    fsmode: { x: 650, y: 286, r: 14, style: 'soft', labelDy: 26 }, fstap: { x: 650, y: 362, r: 14, style: 'soft', labelDy: 26 },
    modeled: { x: 650, y: 263, r: 2.2 }, tapled: { x: 650, y: 339, r: 2.2 },
    exp2: { x: 50, y: 200, w: 62, h: 360, color: '#191b20', logo: 'EXP 2' },
    exp1: { x: w - 50, y: 214, w: 62, h: 332, color: '#191b20', logo: 'WAH · VOL' },
    toe: { x: w - 50, y: 30, w: 46, h: 12, color: '#2b2e35', labelPos: 'none' },
    toeled: { x: w - 50, y: 20, r: 1.8 },
  };
  for (let i = 0; i < 6; i++) slots['pk' + (i + 1)] = { x: kx(i), y: 207, r: 12, labelPos: 'none', style: 'chrome' };
  for (let i = 0; i < 10; i++) {
    slots['fs' + i] = { x: fsx(i), y: fsy(i), r: 14, style: 'soft' };
  }
  // the strip LEDs live in the order they were declared (no role): give them slots by index
  let li = 0;
  for (const c of def.controls) if (c.t === 'led' && !c.role) { c.role = 'sled' + li; li++; }
  for (let i = 0; i < 10; i++) slots['sled' + i] = { x: fsx(i) - 24, y: fsy(i), r: 2.4 };
  const theme = { text: '#dfe3ea', knob: 'chrome', labelSize: 5.4, labelLs: 0.6 };
  // labels for the rect buttons live under them; on the floor deck switch labels are light grey
  return finish(ctx, def, slots, theme, w, h, 60, 30);
}

// ================================================================== 2. AURORA DESK (330 × 300)
function auroraForm(ctx, def) {
  const g = ctx.g, w = 330, h = 300;
  const col = def.color || '#1b1f2a', acc = def.accent || '#7dffb0';
  const d = `M14 0H${w - 14}Q${w} 0 ${w} 14V${h - 18}Q${w} ${h} ${w - 18} ${h}H18Q0 ${h} 0 ${h - 18}V14Q0 0 14 0Z`;
  shell(g, w, h, d, lin('aur' + kid(col), [[0, shade(col, 0.25)], [0.62, col], [1, shade(col, -0.35)]]), { grain: 0.5 });
  // angled desktop deck: lighter top face with a bevel line + a sliver of the deck's front edge
  Pth(g, `M8 8H${w - 8}V206H8Z`, { fill: lin('aurdeck' + kid(col), [[0, shade(col, 0.32)], [1, shade(col, 0.08)]]) });
  Pth(g, `M8 206H${w - 8}L${w - 4} 214H4Z`, { fill: shade(col, -0.45) });
  Pth(g, `M8 206H${w - 8}`, { stroke: '#fff', 'stroke-opacity': 0.12 });
  // aurora ribbons across the deck (art)
  const rg = G(g);
  for (const [i, c] of [[0, acc], [1, '#9fd8ff'], [2, '#ff8fe0']]) {
    Pth(rg, `M8 ${150 + i * 9}C70 ${118 + i * 10} 120 ${190 - i * 6} 190 ${158 + i * 8}S290 ${128 + i * 9} ${w - 8} ${150 + i * 7}`, { fill: 'none', stroke: c, 'stroke-opacity': 0.16, 'stroke-width': 9 - i * 2, 'stroke-linecap': 'round' });
  }
  // knob deck plate on the right
  Rct(g, 214, 16, 106, 186, 8, { fill: '#0f1219', 'fill-opacity': 0.55 });
  T(g, 267, 132, 'SNAPSHOT MORPH', { size: 4.5, fill: acc, font: INTER, weight: 800, ls: 1.2 });
  // stomp deck
  Rct(g, 8, 216, w - 16, h - 224, 8, { fill: '#0e1016' });
  Rct(g, 8, 216, w - 16, h - 224, 8, { fill: noise('aurrub', 18, 36, [255, 255, 255], 0, 0.05, 1) });
  T(g, 18, 196, def.logo || 'AURORA', { size: 15, fill: '#eef3ff', font: OSW, weight: 600, ls: 6, anchor: 'start' });
  T(g, 116, 196, 'DESK', { size: 7, fill: acc, font: INTER, weight: 800, ls: 2.5, anchor: 'start' });
  T(g, 204, 197, 'TONE ZONE', { size: 4.2, fill: '#c8d0e0', font: INTER, weight: 800, ls: 1.4, anchor: 'end', opacity: 0.7 });
  edge(g, d);
  const slots = {
    'scr:tz5-aurora': { x: 110, y: 78, w: 176, h: 112, bezel: '#07090c' },
    mac0: { x: 241, y: 44, r: 12 }, mac1: { x: 293, y: 44, r: 12 }, mac2: { x: 241, y: 96, r: 12 }, mac3: { x: 293, y: 96, r: 12 },
    morph: { x: 241, y: 160, r: 15 }, mixk: { x: 293, y: 148, r: 9 }, timek: { x: 293, y: 184, r: 9 },
    prev: { x: 36, y: 154, color: '#262b36' }, next: { x: 80, y: 154, color: '#262b36' }, edit: { x: 136, y: 154, color: '#2b3a32' }, page: { x: 180, y: 154, color: '#262b36' },
    onled: { x: 56, y: 230, r: 2.6 }, abled: { x: 165, y: 230, r: 2.6 }, fzled: { x: 274, y: 230, r: 2.6 },
    fon: { x: 56, y: 258, r: 12, labelDy: 25 }, fab: { x: 165, y: 258, r: 12, labelDy: 25 }, ffz: { x: 274, y: 258, r: 12, labelDy: 25 },
  };
  const theme = { text: '#dfe7f5', knob: 'white', labelSize: 5.6, labelLs: 0.8 };
  return finish(ctx, def, slots, theme, w, h, 40, 26);
}

// ================================================================== 3. PIXEL QUEST handheld (300 × 374)
function consoleForm(ctx, def) {
  const g = ctx.g, w = 300, h = 374;
  const col = def.color || '#c9c3d6', acc = def.accent || '#ff3f7f';
  const d = `M16 0H${w - 16}Q${w} 0 ${w} 16V${h - 52}Q${w} ${h} ${w - 52} ${h}H16Q0 ${h} 0 ${h - 16}V16Q0 0 16 0Z`;
  shell(g, w, h, d, lin('pq' + kid(col), [[0, shade(col, 0.16)], [0.6, col], [1, shade(col, -0.22)]]), { grain: 0.35 });
  // plastic seam + grip lines
  Pth(g, `M6 14H${w - 6}`, { stroke: '#000', 'stroke-opacity': 0.18 });
  for (let i = 0; i < 5; i++) Pth(g, `M${w - 34 - i * 7} ${h - 14}l${22} ${-22}`, { stroke: shade(col, -0.3), 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  // screen surround (dark plate, coloured stripe)
  Pth(g, `M24 32Q24 22 34 22H${w - 34}Q${w - 24} 22 ${w - 24} 32V168Q${w - 24} 178 ${w - 34} 178H64Q24 178 24 152Z`, { fill: '#45405a' });
  Rct(g, 34, 27, w - 68, 2, 1, { fill: acc });
  Rct(g, 34, 31, w - 68, 2, 1, { fill: '#5ec8ff' });
  T(g, 44, 62, 'POWER', { size: 4, fill: '#c9c3d6', font: INTER, weight: 800, ls: 0.6, opacity: 0.8 });
  T(g, 150, 168, 'DOT·MATRIX  SYNTH  SYSTEM', { size: 4.4, fill: '#c9c3d6', font: INTER, weight: 800, ls: 1.4, opacity: 0.85 });
  // logo
  T(g, 128, 194, def.logo || 'PIXEL QUEST', { size: 14, fill: '#2d2a7a', font: OSW, weight: 700, ls: 1.5, italic: true });
  T(g, 226, 194.5, 'TONE ZONE', { size: 4.5, fill: '#2d2a7a', font: INTER, weight: 800, ls: 1.5, anchor: 'start', opacity: 0.7 });
  // d-pad cross
  const dp = G(g);
  const cross = 'M-24 -8h16v-16q0 -4 4 -4h8q4 0 4 4v16h16q4 0 4 4v8q0 4 -4 4h-16v16q0 4 -4 4h-8q-4 0 -4 -4v-16h-16q-4 0 -4 -4v-8q0 -4 4 -4z';
  Pth(dp, cross, { fill: '#000', 'fill-opacity': 0.25, transform: 'translate(62 234)' });
  Pth(dp, cross, { fill: '#2a2833', transform: 'translate(62 232)' });
  Cir(dp, 62, 232, 4, { fill: '#000', 'fill-opacity': 0.35 });
  // A/B button wells
  for (const [x, y] of [[252, 224], [222, 240]]) Cir(g, x, y, 12, { fill: shade(col, -0.18) });
  // start/select wells
  for (const x of [122, 162]) Rct(g, x - 12, 254, 24, 9, 4.5, { fill: shade(col, -0.18), transform: `rotate(-20 ${x} 258)` });
  // speaker slots
  for (let i = 0; i < 6; i++) Rct(g, 214 + i * 9, 270, 3.5, 22, 1.75, { fill: '#000', 'fill-opacity': 0.28, transform: `rotate(-28 ${214 + i * 9} 281)` });
  // foot deck (rubber strip)
  Rct(g, 10, 312, w - 50, 54, 10, { fill: '#2a2833' });
  Rct(g, 10, 312, w - 50, 54, 10, { fill: noise('pqrub', 16, 32, [255, 255, 255], 0, 0.06, 1) });
  edge(g, d, 0.4);
  const slots = {
    'scr:tz5-pixel': { x: 150, y: 96, w: 160, h: 120, bezel: '#1a1726' },
    power: { x: 44, y: 72, r: 2.6 },
    dup: { x: 62, y: 217, color: '#2a2833' }, ddown: { x: 62, y: 247, color: '#2a2833' },
    dleft: { x: 47, y: 232, color: '#2a2833' }, dright: { x: 77, y: 232, color: '#2a2833' },
    ba: { x: 252, y: 224, r: 9, color: acc }, bb: { x: 222, y: 240, r: 9, color: acc },
    bsel: { x: 122, y: 258, w: 18, h: 6, color: '#55506a' }, bstart: { x: 162, y: 258, w: 18, h: 6, color: '#55506a' },
    kvol: { x: 30, y: 290, r: 9 }, kmix: { x: 74, y: 290, r: 9 }, ktone: { x: 118, y: 290, r: 9 }, kspeed: { x: 162, y: 290, r: 9 },
    fon: { x: 42, y: 336, r: 11, labelDy: 21 }, flp: { x: 102, y: 336, r: 11, labelDy: 21 }, fln: { x: 162, y: 336, r: 11, labelDy: 21 }, fpw: { x: 222, y: 336, r: 11, labelDy: 21 },
  };
  const theme = { text: '#2d2a7a', knob: 'white', labelSize: 5.2, labelLs: 0.5 };
  // footswitch labels sit on the dark rubber strip: light text there
  return finish(ctx, def, slots, theme, w, h, 60, 26, (c) => c.t === 'foot', { text: '#e9e4f5' });
}

// ================================================================== 4. LOW FOUNDRY bass floor (430 × 272)
function foundryForm(ctx, def) {
  const g = ctx.g, w = 430, h = 272;
  const col = def.color || '#2b2622', acc = def.accent || '#ffb02e';
  const d = rr(0, 0, w, h, 10);
  shell(g, w, h, d, lin('lf' + kid(col), [[0, shade(col, 0.2)], [0.5, col], [1, shade(col, -0.3)]]), { tex: noise('cast', 22, 44, [0, 0, 0], 0, 0.22, 1), grain: 0.6 });
  // hammered "cast iron" ribs + amber pinstripe
  for (const y of [96, 198]) {
    Rct(g, 10, y, w - 20, 2, 1, { fill: '#000', 'fill-opacity': 0.4 });
    Rct(g, 10, y + 2, w - 20, 1, 0.5, { fill: '#fff', 'fill-opacity': 0.08 });
  }
  Rct(g, 10, 6, w - 20, 1.6, 0.8, { fill: acc, 'fill-opacity': 0.85 });
  // display window plate
  Rct(g, 14, 14, 252, 78, 6, { fill: '#120f0d' });
  Rct(g, 14.5, 14.5, 251, 77, 5.5, { fill: 'none', stroke: acc, 'stroke-opacity': 0.35 });
  T(g, 352, 38, def.logo || 'LOW FOUNDRY', { size: 16, fill: '#f3e6cf', font: OSW, weight: 700, ls: 1.5 });
  T(g, 352, 54, 'BASS FLOOR SYSTEM', { size: 5.4, fill: acc, font: INTER, weight: 800, ls: 2 });
  T(g, 352, 82, 'TONE ZONE', { size: 4.6, fill: '#d9ccb4', font: INTER, weight: 800, ls: 1.6, opacity: 0.7 });
  for (const [x, y] of [[280, 20], [w - 12, 20], [280, 86], [w - 12, 86]]) screwAt(g, x, y, 2.6);
  T(g, 14, 112, 'PREAMP', { size: 4.8, fill: acc, font: INTER, weight: 800, ls: 1.4, anchor: 'start' });
  T(g, 14, 160, 'EQUALIZER', { size: 4.8, fill: acc, font: INTER, weight: 800, ls: 1.4, anchor: 'start' });
  edge(g, d);
  const kx = (i) => 58 + i * 78;
  const slots = {
    'scr:tz5-meter': { x: 66, y: 53, w: 92, h: 56, bezel: '#3a2f22' },
    'scr:tz5-seg': { x: 186, y: 40, w: 120, h: 30, bezel: '#050302' },
    bmode: { x: 141, y: 74, color: '#3a3330' }, bl: { x: 170, y: 74, w: 12, color: '#3a3330', labelPos: 'none' }, br: { x: 190, y: 74, w: 12, color: '#3a3330', labelPos: 'none' }, bstore: { x: 230, y: 74, color: '#4a2a1a' },
    k0: { x: kx(0), y: 128, r: 12 }, k1: { x: kx(1), y: 128, r: 12 }, k2: { x: kx(2), y: 128, r: 12 }, k3: { x: kx(3), y: 128, r: 12 }, k9: { x: kx(4), y: 128, r: 12 },
    k4: { x: kx(0), y: 174, r: 12 }, k5: { x: kx(1), y: 174, r: 12 }, k6: { x: kx(2), y: 174, r: 12 }, k7: { x: kx(3), y: 174, r: 12 }, k8: { x: kx(4), y: 174, r: 12 },
  };
  for (let i = 0; i < 6; i++) {
    slots['f' + i] = { x: 40 + i * 70, y: 236, r: 11, labelDy: 23 };
    slots['l' + i] = { x: 40 + i * 70, y: 211, r: 2.6 };
  }
  const theme = { text: '#f0e2c8', knob: 'cream', labelSize: 5.6, labelLs: 0.7 };
  return finish(ctx, def, slots, theme, w, h, 150, 30);
}

export function installTz5Forms(registerForm) {
  registerForm('tz5-atlas', atlasForm);
  registerForm('tz5-aurora', auroraForm);
  registerForm('tz5-console', consoleForm);
  registerForm('tz5-foundry', foundryForm);
}
void rad;
