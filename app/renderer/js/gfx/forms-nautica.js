// Enclosure of the Nautica XL floor processor (catalog/nautica.js). Controls are placed by role on every render.
// Jacks run along the rear edge with a rail of bar LEDs under them (the 'nxl-io' screen lights them by level).
// No SVG filters: gradients, noise patterns and soft shadows only.
import { svg, shade } from '../util.js';
import { softShadow, noisePattern } from './fx.js';
import { label } from './controls.js';
import { formKit } from './forms.js'; // cyclic import: only touched at render time

export const NXW = 1260, NXH = 620;
const Pth = (p, d, a = {}) => svg('path', Object.assign({ d }, a), p);
const Cir = (p, cx, cy, r, a = {}) => svg('circle', Object.assign({ cx, cy, r }, a), p);
const Rct = (p, x, y, width, height, rx, a = {}) => svg('rect', Object.assign({ x, y, width, height, rx }, a), p);
const T = (p, x, y, s, o = {}) => label(p, x, y, s, o);
const OSW = "'Oswald', sans-serif", INTER = "'Inter', sans-serif";
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
const kid = (c) => String(c).replace(/[^a-z0-9]/gi, '');

function defsEl() {
  let d = document.getElementById('globalDefs') || document.getElementById('nxDefs');
  if (!d) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.style.position = 'absolute';
    d = svg('defs', { id: 'nxDefs' }, s);
    document.body.appendChild(s);
  }
  return d;
}
function lin(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  id = 'nxl-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('linearGradient', { id, x1, y1, x2, y2 }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function noise(id, units, px, rgb, a0, a1, smooth = 1) {
  id = 'nxn-' + id;
  if (!document.getElementById(id)) noisePattern(defsEl(), id, units, px, rgb, a0, a1, smooth);
  return `url(#${id})`;
}
function screwAt(g, x, y, r = 2.6) {
  Cir(g, x, y + 0.6, r + 0.6, { fill: '#000', 'fill-opacity': 0.45 });
  Cir(g, x, y, r, { fill: 'url(#g-chromeR)' });
  Pth(g, `M${x - r * 0.65} ${y}H${x + r * 0.65}`, { stroke: '#3a3f45', 'stroke-width': 0.9 });
}

// rear panel order (left to right when signal flows right to left): outputs, loops, inputs, control jacks
const JACK_ORDER = [
  ['o', 11], ['o', 10], ['o', 0], ['o', 1], ['o', 2], ['o', 3], ['o', 4], ['o', 5], ['o', 6], ['o', 7], ['o', 8], ['o', 9], null,
  ['o', 12], ['i', 2], ['o', 13], ['i', 3], ['o', 14], ['i', 4], ['o', 15], ['i', 5], null,
  ['i', 1], ['i', 0], null, ['ic', 0], ['ic', 1], ['ic', 2], ['ic', 3], ['ic', 4], ['ic', 5], ['oc', 0], ['oc', 1],
];
const SHORT = { 'STEREO OUT 1': 'STEREO 1', 'STEREO OUT 2': 'STEREO 2', 'GUITAR IN': 'GUITAR', 'XLR OUT': 'XLR', 'EXT FS OUT': 'FS OUT', 'EXT EXP OUT': 'EXP OUT' };
// jack positions + the bar LED list for the io screen (x relative to the screen's left edge)
export function nautJacks(def, flip) {
  const order = flip ? JACK_ORDER.slice().reverse() : JACK_ORDER;
  const n = order.filter(Boolean).length, gaps = order.length - n;
  const x0 = 26, x1 = NXW - 26, gapW = 14, step = (x1 - x0 - gaps * gapW) / (n - 1);
  const jacks = [];
  let x = x0;
  for (const e of order) {
    if (!e) { x += gapW; continue; }
    const [dir, i] = e;
    const isCtl = dir === 'ic' || dir === 'oc';
    const full = isCtl ? def.ctrl[dir === 'ic' ? 'ins' : 'outs'][i].label : def.ports[dir === 'i' ? 'ins' : 'outs'][i];
    const l = SHORT[full] || full.replace(/^EXT /, '');
    const j = { key: dir + i, dir: dir[0] === 'i' ? 'in' : 'out', port: isCtl ? 'c' + i : i, label: l, side: 'top', x: Math.round(x * 10) / 10, y: -2 };
    if (isCtl) j.kind = 'ctrl';
    jacks.push(j);
    x += step;
  }
  return jacks;
}

function nauticaForm(ctx, def) {
  const g = ctx.g, w = NXW, h = NXH;
  const col = def.color || '#1c2026', acc = def.accent || '#2ee6d6';
  const d = rr(0, 0, w, h, 18);
  softShadow(g, { w, h, path: d, dy: 16, blur: 10, opacity: 0.6 });
  Pth(g, d, { fill: lin('body' + kid(col), [[0, shade(col, 0.16)], [0.5, col], [1, shade(col, -0.32)]]) });
  Pth(g, d, { fill: 'url(#p-grain)', 'fill-opacity': 0.55 });
  // rear rail: jack labels and the bar LEDs
  Rct(g, 8, 4, w - 16, 26, 7, { fill: '#0b0d10' });
  Rct(g, 8.5, 4.5, w - 17, 25, 6.5, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.06 });
  // upper deck (brushed) and floor deck (rubber)
  Rct(g, 10, 34, w - 20, 372, 12, { fill: lin('deck' + kid(col), [[0, shade(col, 0.3)], [1, shade(col, 0.05)]]) });
  Rct(g, 10, 34, w - 20, 372, 12, { fill: 'url(#p-brushed)', 'fill-opacity': 0.55 });
  Rct(g, 10.5, 34.5, w - 21, 371, 11.5, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.13 });
  Rct(g, 10, 414, 910, h - 424, 12, { fill: '#14161a' });
  Rct(g, 10, 414, 910, h - 424, 12, { fill: noise('floor', 20, 40, [255, 255, 255], 0, 0.06, 1) });
  // treadle well on the right
  Rct(g, 928, 268, w - 940, h - 278, 14, { fill: '#0c0d10' });
  Rct(g, 928, 268, w - 940, h - 278, 14, { fill: noise('rub', 18, 36, [255, 255, 255], 0, 0.05, 1) });
  Rct(g, 928.5, 268.5, w - 941, h - 279, 13.5, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.07 });
  // accent ribbon between the decks
  Rct(g, 26, 408.2, 878, 2.4, 1.2, { fill: acc, 'fill-opacity': 0.85 });
  // display surround: one glass panel behind the strips, the main screen and the side screen
  Rct(g, 168, 30.5, 744, 324, 10, { fill: '#08090c' });
  Rct(g, 168.5, 31, 743, 323, 9.5, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08 });
  // left control panel
  Rct(g, 18, 42, 142, 356, 9, { fill: '#000', 'fill-opacity': 0.18 });
  T(g, 89, 56, 'OUTPUT', { size: 5.2, fill: acc, font: INTER, weight: 800, ls: 2 });
  T(g, 89, 214, 'SHORTCUTS', { size: 5.2, fill: acc, font: INTER, weight: 800, ls: 2 });
  // logo block (top right)
  T(g, 1086, 74, def.logo || 'NAUTICA', { size: 30, fill: '#f2f4f7', font: OSW, weight: 700, ls: 7 });
  Rct(g, 1170, 87, 34, 15, 3, { fill: acc });
  T(g, 1187, 95, 'XL', { size: 10, fill: '#0b0d10', font: OSW, weight: 700, ls: 1 });
  T(g, 1062, 95, 'FLAGSHIP FLOOR PROCESSOR', { size: 5.4, fill: '#aeb6c4', font: INTER, weight: 800, ls: 1.6 });
  T(g, 1086, 118, 'TONE ZONE', { size: 5, fill: '#c9ced8', font: INTER, weight: 800, ls: 2.2, opacity: 0.75 });
  Pth(g, 'M940 132H1236', { stroke: '#fff', 'stroke-opacity': 0.08 });
  for (const [x, t] of [[1010, 'EXP 1'], [1170, 'EXP 2']]) T(g, x, 148, t + ' SWITCH', { size: 5, fill: '#8d95a5', font: INTER, weight: 800, ls: 1.4 });
  // dial numbers under the main screen
  const kx = (i) => 208 + i * 56;
  for (let i = 0; i < 10; i++) T(g, kx(i), 394, String(i + 1), { size: 5.2, fill: '#8d95a5', font: INTER, weight: 800 });
  T(g, 832, 368, 'TOUCH CONTROL', { size: 5, fill: '#8d95a5', font: INTER, weight: 800, ls: 1.4 });
  T(g, 832, 380, 'SWIPE · TAP · DRAG', { size: 4.4, fill: '#5f6878', font: INTER, weight: 800, ls: 1 });
  // floor deck legends
  T(g, 64, 430, 'MODE', { size: 5, fill: '#6e7686', font: INTER, weight: 800, ls: 1.4 });
  for (const [x, y] of [[18, 40], [w - 18, 40], [18, 400], [w - 18, 262], [926, 400]]) screwAt(g, x, y, 2.4);
  Pth(g, d, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.2, 'stroke-width': 1.2, 'pointer-events': 'none' });
  Pth(g, d, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8, 'pointer-events': 'none' });

  const jacks = nautJacks(def, ctx.flip);
  const fsx = (i) => 196 + (i % 7) * 113.7, fsy = (i) => (i < 7 ? 466 : 566);
  const slots = {
    main: { x: 460, y: 214, w: 560, h: 250, bezel: '#020305' },
    strip0: { x: 460, y: 47, w: 560, h: 22, bezel: '#020305' },
    strip1: { x: 460, y: 73, w: 560, h: 22, bezel: '#020305' },
    side: { x: 832, y: 188, w: 138, h: 306, bezel: '#020305' },
    io: { x: w / 2, y: 24, w: w - 56, h: 9, bezel: 'transparent', bg: 'transparent' },
    mvol: { x: 89, y: 104, r: 28, style: 'chrome', labelPos: 'below' },
    pvol: { x: 54, y: 170, r: 14, style: 'chrome', labelPos: 'below' },
    xvol: { x: 124, y: 170, r: 14, style: 'chrome', labelPos: 'below' },
    fsmode: { x: 64, y: 466, r: 16, style: 'soft', labelDy: 28 }, fstap: { x: 64, y: 566, r: 16, style: 'soft', labelDy: 28 },
    modeled: { x: 96, y: 444, r: 2.4 }, tapled: { x: 96, y: 544, r: 2.4 },
    exp1: { x: 1010, y: 442, w: 112, h: 300, color: '#15181d', logo: 'EXP 1' },
    exp2: { x: 1170, y: 442, w: 112, h: 300, color: '#15181d', logo: 'EXP 2' },
    fs14: { x: 1010, y: 212, r: 16, style: 'soft' }, fs15: { x: 1170, y: 212, r: 16, style: 'soft' },
    lcd14: { x: 1010, y: 176, w: 84, h: 22, bezel: '#020305' }, lcd15: { x: 1170, y: 176, w: 84, h: 22, bezel: '#020305' },
    xlcd0: { x: 1010, y: 248, w: 116, h: 24, bezel: '#020305' }, xlcd1: { x: 1170, y: 248, w: 116, h: 24, bezel: '#020305' },
  };
  const btns = ['b_lib', 'b_amp', 'b_pre', 'b_scn', 'b_lpr', 'b_tun', 'b_asg', 'b_io', 'b_glb', 'b_mute'];
  btns.forEach((r, i) => (slots[r] = { x: i % 2 ? 124 : 54, y: 238 + Math.floor(i / 2) * 33, w: 40, h: 12, color: r === 'b_mute' ? '#3a2226' : '#2a2f37', ledDx: 0, ledDy: -10.5 }));
  for (let i = 0; i < 10; i++) slots['k' + i] = { x: kx(i), y: 373, r: 14, labelPos: 'none', style: 'chrome' };
  for (let i = 0; i < 14; i++) {
    slots['fs' + i] = { x: fsx(i), y: fsy(i), r: 16, style: 'soft' };
    slots['lcd' + i] = { x: fsx(i), y: fsy(i) - 33, w: 84, h: 22, bezel: '#020305' };
  }
  // the io screen lights a bar under each jack: give it the jack positions (screen-local x)
  const io = def.controls.find((c) => c.role === 'io');
  if (io) io.bars = jacks.map((j) => ({ key: j.key, x: j.x - 28, label: j.label }));
  for (const c of def.controls) {
    const s = slots[c.role];
    Object.assign(c, s || { x: -999, y: -999 });
  }
  const theme = { text: '#dfe3ea', knob: 'chrome', labelSize: 5.6, labelLs: 0.8, jackText: '#9aa3b2' };
  formKit.placeControls(ctx, def.controls.filter((c) => c.x > -900), theme);
  return { w, h, theme, jacks };
}

export function installNauticaForms(registerForm) {
  registerForm('nautica', nauticaForm);
}
