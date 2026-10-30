// Pedal Factory: controls drawn in a material (gfx/materials.js). A part with no material (or 'stock') keeps the
// stock look from gfx/controls.js. Units are millimetres.
import { svg, clamp } from '../util.js';
import { drawKnob, drawToggle, drawButton, drawFoot, drawLed, angleFor, hex, label } from '../gfx/controls.js';
import { paint, materialFill, normalize } from '../gfx/materials.js';

export const PART_SCALE = 0.3; // material tile size for small parts
const isStock = (m) => !m || normalize(m).m === 'stock';
const opt = (c, extra) => Object.assign({ scale: PART_SCALE, seed: c.id, edgeWidth: 0.25, wearScale: 0.35 }, extra);
const CHROME = { m: 'metal', s: 'chrome', f: 'polished' };

// ------------------------------------------------------------------ knobs
// caps drawn here in any material (stock = their own default material)
export const NEW_KNOBS = [
  ['pointer', 'Pointer'], ['davies', 'Davies 1900'], ['witch', 'Witch hat'], ['speed', 'Speed knob'], ['dome', 'Dome'], ['fluted', 'Fluted aluminium'],
  ['scifi', 'Sci-fi'], ['bakelite', 'Bakelite'], ['trimmer', 'Tiny trimmer'], ['bigcap', 'Big encoder cap'],
];
const NEW_SET = new Set(NEW_KNOBS.map((k) => k[0]));
const PL = (c, f = 'gloss') => ({ m: 'plastic', f, c });
const STYLE_SPEC = {
  boss: PL('#1c1d21', 'matte'), mxr: PL('#1c1d21', 'soft'), strymon: PL('#1c1d21', 'soft'), chrome: CHROME, fender: PL('#141414'), mesa: CHROME,
  marshall: { m: 'metal', s: 'gold', f: 'polished' }, white: PL('#f1f0ec'), red: PL('#d0312d'), cream: PL('#ece2c6'), chicken: PL('#1c1d21'), vox: PL('#ece2c6'),
  pointer: PL('#1c1d21'), davies: PL('#1c1d21', 'matte'), witch: PL('#1c1d21'), speed: { m: 'metal', s: 'gold', f: 'polished' }, dome: CHROME,
  fluted: { m: 'metal', s: 'aluminium', f: 'polished' }, scifi: PL('#202328', 'soft'), bakelite: PL('#4a2a18'), trimmer: PL('#f1f0ec', 'matte'), bigcap: { m: 'rubber', f: 'grip', c: '#1f2023' },
};
export const DIALS = [['none', 'None'], ['plate', 'Plate'], ['ring', 'Ring'], ['numbers', 'Numbered']];
const DIAL_SPEC = { m: 'metal', s: 'aluminium', f: 'brushed' };
// a dial behind the knob: a plate, a scale ring or a numbered ring (does not turn)
function dialPart(g, c, th, sweep) {
  const r = c.r, d = c.dial;
  if (!d || d === 'none') return;
  const spec = isStock(c.dialMat) ? DIAL_SPEC : c.dialMat;
  const o = opt({ id: c.id + 'd' }, { round: true, glowWidth: 1.5 });
  const f = materialFill(spec, o);
  const R = r + (d === 'plate' ? 6.5 : 5.2);
  svg('circle', { r: R + 0.6, cy: 0.6, fill: '#000', opacity: 0.35 }, g);
  if (d === 'plate') paint(g, 'circle', { r: R }, spec, o);
  else paint(g, 'path', { d: `M${-R},0a${R},${R} 0 1,0 ${R * 2},0a${R},${R} 0 1,0 ${-R * 2},0ZM${-(r + 1.2)},0a${r + 1.2},${r + 1.2} 0 1,1 ${(r + 1.2) * 2},0a${r + 1.2},${r + 1.2} 0 1,1 ${-(r + 1.2) * 2},0Z`, 'fill-rule': 'evenodd' }, spec, o);
  const ink = f ? f.ink : th.text;
  for (let i = 0; i < 11; i++) {
    const a = (angleFor(i / 10, sweep) * Math.PI) / 180, ra = R - (d === 'numbers' ? 3.6 : 2.6), rb = R - (i % 5 === 0 ? 0.7 : 1.4);
    svg('line', { x1: Math.sin(a) * ra, y1: -Math.cos(a) * ra, x2: Math.sin(a) * rb, y2: -Math.cos(a) * rb, stroke: ink, 'stroke-width': 0.35, opacity: 0.85 }, g);
    if (d === 'numbers') label(g, Math.sin(a) * (R - 2), -Math.cos(a) * (R - 2), String(i), { size: 1.5, fill: ink, weight: 700, ls: 0 });
  }
}
export function knobPart(parent, c, th) {
  const sweep = c.sweep || undefined;
  const style0 = { nine: 'mxr', rat: 'fender' }[c.style] || c.style || 'boss';
  const stock = isStock(c.mat) && isStock(c.dialMat) && isStock(c.skirtMat) && !NEW_SET.has(style0);
  const dialG = c.dial && c.dial !== 'none' ? svg('g', { class: 'fz-dial' }, parent) : null;
  if (dialG) dialPart(dialG, c, th, sweep);
  if (stock) return drawKnob(parent, { x: 0, y: 0, cid: c.id, r: c.r, style: c.style, sweep, ticks: c.ticks ? 11 : false, scale: !!c.ticks, label: null }, { ...th, knobTicks: false });
  const r = c.r, spec = isStock(c.mat) ? STYLE_SPEC[style0] || STYLE_SPEC.boss : c.mat;
  // the skirt has its own material (older designs: the dial's, see factory-kinds.js)
  const skirt = isStock(c.skirtMat) ? spec : c.skirtMat;
  const g = svg('g', { class: 'ctl knob' }, parent);
  svg('circle', { r: r + 6, fill: 'transparent' }, g);
  if (c.ticks)
    for (let i = 0; i < 11; i++) {
      const a = (angleFor(i / 10, sweep) * Math.PI) / 180, ra = r + 2.5, rb = r + (i % 5 === 0 ? 5.5 : 4.2);
      svg('line', { x1: Math.sin(a) * ra, y1: -Math.cos(a) * ra, x2: Math.sin(a) * rb, y2: -Math.cos(a) * rb, stroke: th.text, 'stroke-width': 0.8, opacity: 0.75 }, g);
    }
  svg('circle', { r: r + 2.6, cy: 2.4, fill: 'url(#g-knobShadow)', opacity: 0.8 }, g);
  const rot = svg('g', { class: 'knob-rot' }, g);
  const o = opt(c, { round: true, glowWidth: r * 0.4 });
  const f = materialFill(spec, o);
  const ink = f.ink;
  const knurl = (rr, op, dash = 1) => svg('circle', { r: rr, fill: 'none', stroke: '#000', 'stroke-width': Math.max(0.6, r * 0.13), 'stroke-dasharray': `${(r * 0.09 * dash).toFixed(2)} ${(r * 0.11 * dash).toFixed(2)}`, opacity: op }, rot);
  const ptr = (a, b, w = 1.4, col = ink) => svg('line', { x1: 0, y1: -r * a, x2: 0, y2: -r * b, stroke: col, 'stroke-width': w * (r / 10 + 0.4), 'stroke-linecap': 'round' }, rot);
  const style = style0;
  const flutes = (rr, n, depth) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n, q = i % 2 ? rr - depth : rr;
      d += (i ? 'L' : 'M') + (Math.sin(a) * q).toFixed(2) + ',' + (-Math.cos(a) * q).toFixed(2);
    }
    return d + 'Z';
  };
  if (style === 'chicken' || style === 'vox') {
    paint(rot, 'circle', { r: r * 0.95 }, skirt, o);
    svg('circle', { r: r * 0.95, fill: '#000', opacity: 0.4 }, rot);
    paint(rot, 'path', { d: `M0 ${-r * 1.35} L${r * 0.42} ${-r * 0.2} Q${r * 0.5} ${r * 0.75} 0 ${r * 0.8} Q${-r * 0.5} ${r * 0.75} ${-r * 0.42} ${-r * 0.2} Z` }, spec, { ...o, round: false, size: r * 1.6 });
    ptr(1.25, 0.35);
  } else if (style === 'pointer') {
    paint(rot, 'circle', { r: r * 0.82 }, skirt, o);
    svg('circle', { r: r * 0.82, fill: '#000', opacity: 0.3 }, rot);
    paint(rot, 'rect', { x: -r * 0.3, y: -r * 1.12, width: r * 0.6, height: r * 1.9, rx: r * 0.28 }, spec, { ...o, round: false, size: r });
    ptr(1.02, 0.3, 1);
  } else if (style === 'davies') {
    paint(rot, 'circle', { r }, skirt, o);
    knurl(r - 0.6, 0.7, 0.7);
    knurl(r * 0.82, 0.5, 0.7);
    svg('circle', { r: r * 0.66, fill: '#000', opacity: 0.35 }, rot);
    paint(rot, 'circle', { r: r * 0.62 }, spec, o);
    knurl(r * 0.5, 0.35, 0.5);
    ptr(0.1, 1, 1.2, '#f4f4f4');
  } else if (style === 'witch') {
    [1, 0.78, 0.56, 0.34].forEach((k, i) => {
      paint(rot, 'circle', { r: r * k }, i ? spec : skirt, o);
      svg('circle', { r: r * k, fill: '#000', opacity: 0.12 + i * 0.04 }, rot);
      svg('circle', { r: r * k - 0.25, fill: 'none', stroke: '#fff', 'stroke-width': 0.3, opacity: 0.18 }, rot);
    });
    ptr(0.2, 0.98, 1.1);
  } else if (style === 'speed') {
    paint(rot, 'circle', { r }, skirt, o);
    svg('circle', { r, fill: '#000', opacity: 0.25 }, rot);
    for (let i = 0; i <= 10; i++) {
      const a = (angleFor(i / 10) * Math.PI) / 180;
      label(rot, Math.sin(a) * r * 0.84, -Math.cos(a) * r * 0.84, String(i), { size: r * 0.2, fill: ink, weight: 700, ls: 0 });
    }
    svg('circle', { r: r * 0.66, fill: '#000', opacity: 0.25 }, rot);
    paint(rot, 'circle', { r: r * 0.62 }, spec, o);
    ptr(0.12, 0.6, 1);
  } else if (style === 'dome') {
    paint(rot, 'circle', { r }, skirt, o);
    knurl(r - 0.5, 0.5, 0.5);
    svg('circle', { r: r * 0.86, fill: 'url(#g-chromeDome)', opacity: 0.55 }, rot);
    svg('circle', { cy: -r * 0.62, r: r * 0.08, fill: ink }, rot);
  } else if (style === 'fluted') {
    paint(rot, 'path', { d: flutes(r, 16, r * 0.1) }, skirt, o);
    svg('path', { d: flutes(r, 16, r * 0.1), fill: 'none', stroke: '#000', 'stroke-width': 0.3, opacity: 0.4 }, rot);
    svg('circle', { r: r * 0.74, fill: '#000', opacity: 0.2 }, rot);
    paint(rot, 'circle', { r: r * 0.7 }, spec, o);
    ptr(0.2, 0.92, 1.1);
  } else if (style === 'scifi') {
    const glow = c.glowColor || '#3fe0ff';
    paint(rot, 'circle', { r }, skirt, o);
    svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': r * 0.16, 'stroke-dasharray': `${(r * 0.32).toFixed(2)} ${(r * 0.1).toFixed(2)}`, opacity: 0.55 }, rot);
    svg('circle', { r: r * 0.7, fill: 'none', stroke: glow, 'stroke-width': r * 0.06, opacity: 0.8 }, rot);
    paint(rot, 'circle', { r: r * 0.6 }, spec, o);
    svg('line', { x1: 0, y1: -r * 0.15, x2: 0, y2: -r * 0.98, stroke: glow, 'stroke-width': r * 0.16 + 0.4, opacity: 0.25, 'stroke-linecap': 'round' }, rot);
    ptr(0.15, 0.98, 0.9, glow);
  } else if (style === 'bakelite') {
    paint(rot, 'path', { d: flutes(r, 20, r * 0.08) }, skirt, o);
    for (let i = 1; i <= 10; i++) {
      const a = ((-150 + 30 * (i - 1) * (300 / 270)) * Math.PI) / 180;
      label(rot, Math.sin(a) * r * 0.84, -Math.cos(a) * r * 0.84, String(i), { size: r * 0.17, fill: '#efe6cc', weight: 700, ls: 0 });
    }
    svg('circle', { r: r * 0.64, fill: '#000', opacity: 0.35 }, rot);
    paint(rot, 'path', { d: flutes(r * 0.6, 10, r * 0.07) }, spec, o);
    ptr(0.15, 0.62, 1, '#efe6cc');
  } else if (style === 'trimmer') {
    svg('rect', { x: -r - 0.6, y: -r - 0.6, width: r * 2 + 1.2, height: r * 2 + 1.2, rx: 0.5, fill: c.trimColor || '#2b6fd6', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.25 }, g);
    g.insertBefore(g.lastChild, rot);
    paint(rot, 'circle', { r }, spec, o);
    svg('rect', { x: -0.35, y: -r * 0.85, width: 0.7, height: r * 1.7, fill: '#2a2a2a' }, rot);
  } else if (style === 'bigcap') {
    paint(rot, 'circle', { r }, skirt, o);
    knurl(r - 0.5, 0.5, 0.6);
    svg('circle', { r: r * 0.8, fill: '#000', opacity: 0.3 }, rot);
    paint(rot, 'circle', { r: r * 0.76 }, isStock(c.mat) ? { m: 'metal', s: 'aluminium', f: 'polished' } : spec, o);
    svg('circle', { cy: -r * 0.42, r: r * 0.16, fill: '#000', opacity: 0.3 }, rot);
    svg('circle', { cy: -r * 0.43, r: r * 0.13, fill: '#fff', opacity: 0.12 }, rot);
  } else if (style === 'boss' || !style) {
    paint(rot, 'circle', { r }, skirt, o);
    svg('circle', { r, fill: '#000', opacity: 0.32 }, rot);
    knurl(r - 1, 0.55);
    paint(rot, 'circle', { r: r * 0.66 }, spec, o);
    ptr(0.12, 0.62, 1.5);
    svg('path', { d: `M0 ${-r + 0.6} l-1.4 2.4 h2.8z`, fill: materialFill(skirt, o).ink, opacity: 0.85 }, rot);
  } else if (style === 'mxr' || style === 'strymon') {
    paint(rot, 'circle', { r }, skirt, o);
    knurl(r - 0.7, style === 'mxr' ? 0.55 : 0.4);
    svg('circle', { r: r * (style === 'mxr' ? 0.78 : 0.72), fill: '#000', opacity: 0.18 }, rot);
    paint(rot, 'circle', { r: r * (style === 'mxr' ? 0.74 : 0.68) }, spec, o);
    ptr(0.2, 0.92);
  } else if (style === 'chrome' || style === 'fender' || style === 'marshall' || style === 'mesa') {
    paint(rot, 'circle', { r }, skirt, o);
    svg('circle', { r: r * 0.9, fill: 'none', stroke: f.hi, 'stroke-width': r * 0.08, opacity: 0.8 }, rot);
    svg('circle', { r: r * 0.68, fill: '#000', opacity: 0.25 }, rot);
    paint(rot, 'circle', { r: r * 0.64 }, spec, o);
    ptr(0.2, 0.96);
  } else {
    paint(rot, 'circle', { r }, spec, o);
    knurl(r - 0.8, 0.2);
    ptr(0.25, 0.95);
  }
  svg('ellipse', { cx: -r * 0.22, cy: -r * 0.32, rx: r * 0.42, ry: r * 0.26, fill: '#fff', opacity: 0.12, 'pointer-events': 'none' }, g);
  return { g, set: (v) => rot.setAttribute('transform', `rotate(${angleFor(v, sweep)})`) };
}

// ------------------------------------------------------------------ push buttons
export const BUTTON_SHAPES = [['round', 'Round'], ['square', 'Square'], ['rect', 'Rectangle'], ['pill', 'Pill'], ['hex', 'Hex']];
export function buttonPart(parent, c, th) {
  const r = c.r || 4;
  const ledDy = c.shape === 'rect' || c.shape === 'pill' ? -(c.h || 6) / 2 - 3 : -(r + 4);
  if (isStock(c.mat) && (c.shape === 'round' || c.shape === 'rect' || !c.shape))
    return drawButton(parent, { x: 0, y: 0, cid: c.id, r, shape: c.shape, w: c.w || 12, h: c.h || 6, color: c.color, led: c.led, ledColor: c.ledColor, ledDy, label: null }, th);
  const spec = isStock(c.mat) ? { m: 'plastic', f: 'gloss', c: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#2a2c31' } : c.mat;
  const g = svg('g', { class: 'ctl button' }, parent);
  svg('circle', { r: r + 5, fill: 'transparent' }, g);
  const o = opt(c, { glowWidth: r * 0.5 });
  const w = c.w || 12, h = c.h || 6;
  if (c.shape === 'rect' || c.shape === 'pill') {
    const rx = c.shape === 'pill' ? h / 2 : 1.6;
    svg('rect', { x: -w / 2 - 1, y: -h / 2 - 1, width: w + 2, height: h + 2, rx: rx + 1, fill: '#000', opacity: 0.5 }, g);
    paint(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx }, spec, o);
  } else if (c.shape === 'square') {
    svg('rect', { x: -r - 1.4, y: -r - 1.4, width: r * 2 + 2.8, height: r * 2 + 2.8, rx: 1.2, fill: 'url(#g-chrome)' }, g);
    paint(g, 'rect', { x: -r, y: -r, width: r * 2, height: r * 2, rx: 0.8 }, spec, o);
  } else if (c.shape === 'hex') {
    svg('polygon', { points: hex(r + 1.6), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.3 }, g);
    paint(g, 'circle', { r }, spec, { ...o, round: true });
  } else {
    svg('circle', { r: r + 1.4, fill: 'url(#g-chrome)' }, g);
    paint(g, 'circle', { r }, spec, { ...o, round: true });
  }
  let halo = null, lens = null;
  if (c.led) {
    halo = svg('circle', { cy: ledDy, r: 4, fill: c.ledColor || '#4aa8ff', opacity: c.on ? 0.3 : 0 }, g);
    lens = svg('circle', { cy: ledDy, r: 2, fill: c.on ? c.ledColor || '#4aa8ff' : '#151a22' }, g);
  }
  return {
    g,
    set(on) {
      if (!lens) return;
      halo.setAttribute('opacity', on ? 0.3 : 0);
      lens.setAttribute('fill', on ? c.ledColor || '#4aa8ff' : '#151a22');
    },
  };
}

// ------------------------------------------------------------------ footswitches
export function footPart(parent, c, th) {
  if (isStock(c.mat) && isStock(c.nutMat)) return drawFoot(parent, { x: 0, y: 0, cid: c.id, style: c.style, r: c.r || 7, w: c.w || 34, h: c.h || 30, label: null }, th);
  const spec = isStock(c.mat) ? (c.style === 'soft' ? { m: 'rubber', f: 'smooth', c: '#1f2023' } : c.style === 'rc' || c.style === 'ts' ? { m: 'rubber', f: 'grip', c: '#2b2c30' } : CHROME) : c.mat;
  // the nut (and the soft switch's bezel) has its own material; stock is chrome
  const nut = isStock(c.nutMat) ? null : c.nutMat;
  const g = svg('g', { class: 'ctl foot-wrap' }, parent);
  const o = opt(c, { glowWidth: 2 });
  if (c.style === 'rc' || c.style === 'ts') {
    const w = c.w || 34, h = c.h || 30;
    svg('rect', { x: -w / 2 - 1, y: -h / 2 + 1.5, width: w + 2, height: h, rx: 4, fill: '#000', opacity: 0.45 }, g);
    paint(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 3.5 }, spec, o);
    svg('rect', { x: -w / 2 + 3, y: -h / 2 + 3, width: w - 6, height: h - 6, rx: 2, fill: c.style === 'rc' ? 'url(#p-ridges)' : 'url(#p-pad)', opacity: 0.35 }, g);
  } else if (c.style === 'soft') {
    const r = c.r || 7;
    svg('circle', { r: r + 2.5, fill: '#000', opacity: 0.45, cy: 2 }, g);
    if (nut) paint(g, 'circle', { r: r + 1.5 }, nut, { ...o, round: true, seed: c.id + 'n' });
    else svg('circle', { r: r + 1.5, fill: 'url(#g-chrome)' }, g);
    paint(g, 'circle', { r }, spec, { ...o, round: true });
  } else {
    const r = c.r || 7;
    svg('circle', { r: r + 6, cy: 2.8, fill: 'url(#g-knobShadow)', opacity: 0.75 }, g);
    if (nut) {
      paint(g, 'polygon', { points: hex(r + 3.5) }, nut, { ...o, seed: c.id + 'n', size: r * 2 });
      // facet shading so it still reads as a hex nut
      for (let i = 0; i < 6; i++) {
        const a0 = (Math.PI / 3) * i + Math.PI / 6, a1 = a0 + Math.PI / 3, R = r + 3.5;
        svg('path', { d: `M0,0L${(Math.cos(a0) * R).toFixed(2)},${(Math.sin(a0) * R).toFixed(2)}L${(Math.cos(a1) * R).toFixed(2)},${(Math.sin(a1) * R).toFixed(2)}Z`, fill: i < 3 ? '#000' : '#fff', opacity: [0.18, 0.28, 0.12, 0.1, 0.18, 0.04][i] }, g);
      }
      svg('polygon', { points: hex(r + 3.5), fill: 'none', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.4 }, g);
    } else svg('polygon', { points: hex(r + 3.5), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.5 }, g);
    paint(g, 'circle', { r: r + 0.5 }, spec, { ...o, round: true });
    svg('circle', { r: r - 1.2, fill: 'none', stroke: '#000', 'stroke-width': 1.2, 'stroke-dasharray': '0.8 1', opacity: 0.35 }, g);
    paint(g, 'circle', { r: r * 0.68 }, spec, { ...o, round: true });
  }
  return { g, set() {} };
}

// ------------------------------------------------------------------ foot pedals (treadles)
export const PEDAL_GRIPS = [['pad', 'Rubber pad'], ['ridges', 'Ribbed'], ['plate', 'Toe plate'], ['none', 'Smooth']];
export function treadlePart(parent, c) {
  const w = c.w || 40, h = c.h || 60;
  const logo = c.logo || '', logoSize = Math.min(9, h / 7), logoColor = c.logoColor || '#d9d9d9';
  const grip = c.grip === false ? 'none' : c.grip || 'pad';
  const g = svg('g', { class: 'ctl treadle' }, parent);
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent' }, g);
  const tread = svg('g', {}, g);
  const rx = Math.min(10, w / 3);
  svg('rect', { x: -w / 2 - 2, y: -h / 2 + 4, width: w + 4, height: h, rx, fill: '#000', opacity: 0.55 }, tread);
  // the pedal itself: its own material, or the stock colour
  const main = !isStock(c.mat);
  if (main) paint(tread, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx }, c.mat, opt(c, { scale: 0.44, glowWidth: 3 }));
  else svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx, fill: c.color || '#1b1c1f', stroke: '#000', 'stroke-width': 0.8 }, tread);
  // the grip on top, with a material of its own
  const gm = isStock(c.gripMat) ? null : c.gripMat;
  const go = opt(c, { scale: 0.44, seed: c.id + 'g' });
  if (grip === 'pad' || grip === 'ridges') {
    const ix = Math.min(7, w * 0.17), iy = Math.min(10, h * 0.16);
    const box = { x: -w / 2 + ix, y: -h / 2 + iy, width: w - ix * 2, height: h - iy * 2, rx: Math.min(6, w * 0.15) };
    if (gm) paint(tread, 'rect', box, gm, go);
    if (grip === 'pad') svg('rect', { ...box, fill: 'url(#p-pad)', opacity: gm ? 0.35 : main ? 0.55 : 0.9 }, tread);
    else {
      if (!gm) svg('rect', { ...box, fill: '#1e1f23', opacity: main ? 0.45 : 0.85 }, tread);
      // ribs across the pedal
      let d = '';
      for (let y = box.y + 3; y < box.y + box.height - 2; y += 3.2) d += `M${(box.x + 2).toFixed(2)},${y.toFixed(2)}H${(box.x + box.width - 2).toFixed(2)}`;
      svg('path', { d, stroke: '#000', 'stroke-width': 1.3, opacity: 0.45, 'stroke-linecap': 'round' }, tread);
      svg('path', { d, stroke: '#fff', 'stroke-width': 0.35, opacity: 0.12, transform: 'translate(0,-0.7)', 'stroke-linecap': 'round' }, tread);
    }
  } else if (grip === 'plate') {
    // a smooth pedal with a ribbed metal plate at the toe
    const ix = Math.min(5, w * 0.12);
    const box = { x: -w / 2 + ix, y: -h / 2 + ix, width: w - ix * 2, height: Math.min(h * 0.3, 40), rx: 3 };
    svg('rect', { ...box, y: box.y + 0.8, fill: '#000', opacity: 0.35 }, tread);
    paint(tread, 'rect', box, gm || CHROME, go);
    let d = '';
    for (let x = box.x + 3; x < box.x + box.width - 2; x += 2.6) d += `M${x.toFixed(2)},${(box.y + 2).toFixed(2)}V${(box.y + box.height - 2).toFixed(2)}`;
    svg('path', { d, stroke: '#000', 'stroke-width': 0.6, opacity: 0.3 }, tread);
  }
  if (logo) label(tread, 0, -h * 0.05 + (grip === 'plate' ? h * 0.15 : 0), logo, { size: logoSize, fill: logoColor, font: "'Dancing Script', cursive", weight: 700, ls: 0.5, transform: `rotate(-90 0 ${-h * 0.05 + (grip === 'plate' ? h * 0.15 : 0)})` });
  const sheen = svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx, fill: 'url(#g-shadeV)', opacity: 0.9 }, tread);
  return {
    g,
    set(v01) {
      // toe down = 1: the toe end catches more light and the visible length shrinks slightly (perspective)
      tread.setAttribute('transform', `scale(1,${(0.94 + 0.06 * (1 - v01)).toFixed(4)})`);
      sheen.setAttribute('opacity', 0.5 + 0.5 * v01);
    },
  };
}

// ------------------------------------------------------------------ toggles
export const TOGGLE_TIPS = [['bat', 'Bat'], ['ball', 'Ball'], ['paddle', 'Paddle']];
export function togglePart(parent, c, th) {
  const opts = (c.opts || []).slice(0, c.ways);
  while (opts.length < c.ways) opts.push('');
  const pos = clamp(c.pos || 0, 0, c.ways - 1);
  const s = svg('g', { transform: 'scale(0.8)' }, parent);
  if (isStock(c.mat) && (!c.tip || c.tip === 'bat')) {
    drawToggle(s, { x: 0, y: 0, cid: c.id, options: opts, orient: c.orient, optSize: 3.6, label: null }, th).set(pos);
    return;
  }
  const spec = isStock(c.mat) ? CHROME : c.mat;
  const o = opt(c, { glowWidth: 1.2, edgeWidth: 0.3 });
  const g = svg('g', { class: 'ctl toggle' }, s);
  const n = c.ways, horiz = c.orient === 'h';
  svg('rect', { x: -14, y: -16, width: 28, height: 32, fill: 'transparent' }, g);
  svg('circle', { r: 6.4, fill: '#111', opacity: 0.4, cy: 1 }, g);
  svg('polygon', { points: hex(5.6), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.4 }, g);
  svg('circle', { r: 3.6, fill: '#1c1e21', stroke: '#5b6068', 'stroke-width': 0.5 }, g);
  const tip = c.tip || 'bat';
  const drawLever = (lg) => {
    if (tip === 'ball') {
      paint(lg, 'rect', { x: -0.9, y: -10, width: 1.8, height: 10.5, rx: 0.6 }, spec, o);
      paint(lg, 'circle', { cy: -11, r: 3.2 }, spec, { ...o, round: true });
    } else if (tip === 'paddle') {
      paint(lg, 'path', { d: 'M-1.4,0.6 L-3.2,-11.5 Q0,-12.6 3.2,-11.5 L1.4,0.6 Z' }, spec, { ...o, size: 6 });
    } else {
      paint(lg, 'path', { d: 'M-1.9,0.6 L-1.25,-10.6 Q0,-11.6 1.25,-10.6 L1.9,0.6 Q0,1.6 -1.9,0.6 Z' }, spec, { ...o, size: 4 });
      paint(lg, 'circle', { cy: -11, r: 2.5 }, spec, { ...o, round: true });
    }
  };
  const centre = n === 3 && pos === 1 && !horiz;
  if (centre) paint(g, 'circle', { r: tip === 'paddle' ? 3 : tip === 'ball' ? 3.2 : 2.5 }, spec, { ...o, round: true });
  else {
    let ang;
    if (horiz) ang = n === 2 ? (pos === 0 ? -32 : 32) : [-36, 0, 36][pos];
    else ang = n === 2 ? (pos === 0 ? 0 : 180) : [0, 0, 180][pos];
    const lg = svg('g', { transform: `rotate(${ang})` }, g);
    svg('path', { d: 'M-1.9,0.6 L-1.4,-10.4 L1.6,-10.4 L2.4,0.6 Z', fill: '#000', 'fill-opacity': 0.3, transform: 'translate(1.2,0.8)' }, lg);
    drawLever(lg);
  }
  opts.forEach((t, i) => {
    let x, y, anchor = 'start';
    if (horiz) { x = n === 2 ? (i === 0 ? -11 : 11) : -14 + i * 14; y = 11.5; anchor = 'middle'; }
    else { x = 9; y = n === 2 ? (i === 0 ? -8 : 8) : -10 + i * 10; }
    const e = label(g, x, y, t, { size: 3.6, fill: th.text, anchor, weight: 700, ls: 0.1 });
    e.setAttribute('fill-opacity', i === pos ? 1 : 0.55);
  });
}

// ------------------------------------------------------------------ LEDs, screens, jacks
export function ledPart(parent, c) {
  const f = isStock(c.mat) ? null : materialFill(c.mat, opt(c, { round: true }));
  return drawLed(parent, { x: 0, y: 0, r: c.r || 2.5, color: c.color, bezel: f ? f.fill : undefined });
}
export function bezel(parent, c, w, h) {
  if (isStock(c.mat)) {
    svg('rect', { x: -w / 2 - 1.8, y: -h / 2 - 1.8, width: w + 3.6, height: h + 3.6, rx: 1.6, fill: '#0b0c0e', stroke: '#000', 'stroke-width': 0.4 }, parent);
    return;
  }
  paint(parent, 'rect', { x: -w / 2 - 1.8, y: -h / 2 - 1.8, width: w + 3.6, height: h + 3.6, rx: 1.6 }, c.mat, opt(c, { glowWidth: 1.5 }));
}
// the nut seen from the side (fill for the rect), or null for stock chrome
export function nutPaint(parent, j, attrs) {
  if (isStock(j.mat)) return false;
  paint(parent, 'rect', attrs, j.mat, opt(j, { edgeWidth: 0.3, glowWidth: 1.2 }));
  return true;
}
