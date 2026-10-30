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
export function knobPart(parent, c, th) {
  if (isStock(c.mat)) return drawKnob(parent, { x: 0, y: 0, cid: c.id, r: c.r, style: c.style, ticks: c.ticks ? 11 : false, scale: !!c.ticks, label: null }, { ...th, knobTicks: false });
  const r = c.r, spec = c.mat;
  const g = svg('g', { class: 'ctl knob' }, parent);
  svg('circle', { r: r + 6, fill: 'transparent' }, g);
  if (c.ticks)
    for (let i = 0; i < 11; i++) {
      const a = (angleFor(i / 10) * Math.PI) / 180, ra = r + 2.5, rb = r + (i % 5 === 0 ? 5.5 : 4.2);
      svg('line', { x1: Math.sin(a) * ra, y1: -Math.cos(a) * ra, x2: Math.sin(a) * rb, y2: -Math.cos(a) * rb, stroke: th.text, 'stroke-width': 0.8, opacity: 0.75 }, g);
    }
  svg('circle', { r: r + 2.6, cy: 2.4, fill: 'url(#g-knobShadow)', opacity: 0.8 }, g);
  const rot = svg('g', { class: 'knob-rot' }, g);
  const o = opt(c, { round: true, glowWidth: r * 0.4 });
  const f = materialFill(spec, o);
  const ink = f.ink;
  const knurl = (rr, op) => svg('circle', { r: rr, fill: 'none', stroke: '#000', 'stroke-width': Math.max(0.6, r * 0.13), 'stroke-dasharray': `${(r * 0.09).toFixed(2)} ${(r * 0.11).toFixed(2)}`, opacity: op }, rot);
  const ptr = (a, b, w = 1.4) => svg('line', { x1: 0, y1: -r * a, x2: 0, y2: -r * b, stroke: ink, 'stroke-width': w * (r / 10 + 0.4), 'stroke-linecap': 'round' }, rot);
  const style = { nine: 'mxr', rat: 'fender' }[c.style] || c.style;
  if (style === 'chicken' || style === 'vox') {
    paint(rot, 'circle', { r: r * 0.95 }, spec, o);
    svg('circle', { r: r * 0.95, fill: '#000', opacity: 0.4 }, rot);
    paint(rot, 'path', { d: `M0 ${-r * 1.35} L${r * 0.42} ${-r * 0.2} Q${r * 0.5} ${r * 0.75} 0 ${r * 0.8} Q${-r * 0.5} ${r * 0.75} ${-r * 0.42} ${-r * 0.2} Z` }, spec, { ...o, round: false, size: r * 1.6 });
    ptr(1.25, 0.35);
  } else if (style === 'boss' || !style) {
    paint(rot, 'circle', { r }, spec, o);
    svg('circle', { r, fill: '#000', opacity: 0.32 }, rot);
    knurl(r - 1, 0.55);
    paint(rot, 'circle', { r: r * 0.66 }, spec, o);
    ptr(0.12, 0.62, 1.5);
    svg('path', { d: `M0 ${-r + 0.6} l-1.4 2.4 h2.8z`, fill: ink, opacity: 0.85 }, rot);
  } else if (style === 'mxr' || style === 'strymon') {
    paint(rot, 'circle', { r }, spec, o);
    knurl(r - 0.7, style === 'mxr' ? 0.55 : 0.4);
    svg('circle', { r: r * (style === 'mxr' ? 0.78 : 0.72), fill: '#000', opacity: 0.18 }, rot);
    paint(rot, 'circle', { r: r * (style === 'mxr' ? 0.74 : 0.68) }, spec, o);
    ptr(0.2, 0.92);
  } else if (style === 'chrome' || style === 'fender' || style === 'marshall' || style === 'mesa') {
    paint(rot, 'circle', { r }, spec, o);
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
  return { g, set: (v) => rot.setAttribute('transform', `rotate(${angleFor(v)})`) };
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
  if (c.led) {
    svg('circle', { cy: ledDy, r: 4, fill: c.ledColor || '#4aa8ff', opacity: c.on ? 0.3 : 0 }, g);
    svg('circle', { cy: ledDy, r: 2, fill: c.on ? c.ledColor || '#4aa8ff' : '#151a22' }, g);
  }
  return { g, set() {} };
}

// ------------------------------------------------------------------ footswitches
export function footPart(parent, c, th) {
  if (isStock(c.mat)) return drawFoot(parent, { x: 0, y: 0, cid: c.id, style: c.style, r: c.r || 7, w: c.w || 34, h: c.h || 30, label: null }, th);
  const spec = c.mat;
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
    svg('circle', { r: r + 1.5, fill: 'url(#g-chrome)' }, g);
    paint(g, 'circle', { r }, spec, { ...o, round: true });
  } else {
    const r = c.r || 7;
    svg('circle', { r: r + 6, cy: 2.8, fill: 'url(#g-knobShadow)', opacity: 0.75 }, g);
    svg('polygon', { points: hex(r + 3.5), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.5 }, g);
    paint(g, 'circle', { r: r + 0.5 }, spec, { ...o, round: true });
    svg('circle', { r: r - 1.2, fill: 'none', stroke: '#000', 'stroke-width': 1.2, 'stroke-dasharray': '0.8 1', opacity: 0.35 }, g);
    paint(g, 'circle', { r: r * 0.68 }, spec, { ...o, round: true });
  }
  return { g, set() {} };
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
  return drawLed(parent, { x: 0, y: 0, r: c.r || 2.5, color: c.color, bezel: f ? f.fill : undefined }).set(c.on ? true : null);
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
