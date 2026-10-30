// Pedal Factory: graphics for the extra controls (encoder, XY pad and joystick, touch strip, arcade button, step
// buttons, toggle bank, needle meter) and the extra looks of sliders,
// rotary switches and LEDs. Every function returns a view like the stock controls ({ g, set }) so the factory,
// test mode and the board can drive it. Units are millimetres.
import { svg, clamp, shade, hexToRgb, rgbToHex } from '../util.js';
import { hex, label, angleFor } from '../gfx/controls.js';
import { haloFill, setA } from '../gfx/fx.js';
import { paint, materialFill, normalize } from '../gfx/materials.js';
import { xySize, isStick } from './factory-kinds.js';

const isStock = (m) => !m || normalize(m).m === 'stock';
const specOr = (m, def) => (isStock(m) ? def : m);
const opt = (c, extra) => Object.assign({ scale: 0.3, seed: c.id, edgeWidth: 0.25, wearScale: 0.35 }, extra);
const CHROME = { m: 'metal', s: 'chrome', f: 'polished' };
const ALU = { m: 'metal', s: 'aluminium', f: 'brushed' };
const BLACK = { m: 'plastic', f: 'matte', c: '#1c1d21' };
const RUBBER = { m: 'rubber', f: 'grip', c: '#3a3c41' };
const offCol = (c) => {
  try {
    return shade(c, -0.78);
  } catch (_) {
    return '#2a0a0a';
  }
};
export function mixHex(a, b, t) {
  try {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
  } catch (_) {
    return a;
  }
}
const polar = (a, r) => [Math.sin((a * Math.PI) / 180) * r, -Math.cos((a * Math.PI) / 180) * r];
// a lamp: lens + halo, lit with set(colour | null)
function lamp(g, x, y, r, color, shape = 'circle', cls) {
  const halo = svg('circle', { cx: x, cy: y, r: r * 3.2, 'fill-opacity': 0, 'pointer-events': 'none' }, g);
  const lens = shape === 'rect' ? svg('rect', { x: x - r, y: y - r * 0.7, width: r * 2, height: r * 1.4, rx: r * 0.25, fill: offCol(color), class: cls }, g) : svg('circle', { cx: x, cy: y, r, fill: offCol(color), class: cls }, g);
  if (cls) lens.dataset.on = '0';
  let cur;
  return (on) => {
    const c = on === true ? color : on || null;
    if (c === cur) return;
    cur = c;
    setA(lens, 'fill', c || offCol(color));
    if (cls) lens.dataset.on = c ? '1' : '0';
    if (c) setA(halo, 'fill', haloFill(c));
    setA(halo, 'fill-opacity', c ? 0.85 : 0);
  };
}

// a ring (outer circle minus inner), for evenodd fills
function annulus(r0, r1) {
  const c = (r) => `M${-r},0a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0Z`;
  return c(r1) + c(r0);
}
// one curved LED segment: an arc of a ring between angles a0 and a1 (degrees, 0 = up, clockwise) with softened corners
export function arcPath(a0, a1, ri, ro) {
  const [x0, y0] = polar(a0, ro), [x1, y1] = polar(a1, ro), [x2, y2] = polar(a1, ri), [x3, y3] = polar(a0, ri);
  const big = a1 - a0 > 180 ? 1 : 0;
  const f = (v) => v.toFixed(3);
  return `M${f(x0)},${f(y0)}A${ro},${ro} 0 ${big} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${ri},${ri} 0 ${big} 0 ${f(x3)},${f(y3)}Z`;
}
function arcLamp(g, a0, a1, ri, ro, color, cls) {
  const d = arcPath(a0, a1, ri, ro);
  const rm = (ri + ro) / 2, th = ro - ri;
  const mid = arcPath(a0, a1, rm - 0.001, rm + 0.001);
  // glow: a soft wide band of the same colour behind the lens
  const glow = svg('path', { d: mid, fill: 'none', stroke: color, 'stroke-width': th * 2.4, 'stroke-linejoin': 'round', 'stroke-opacity': 0, 'pointer-events': 'none', style: 'filter:blur(0.9px)' }, g);
  const off = offCol(color);
  const lens = svg('path', { d, fill: off, stroke: off, 'stroke-width': 0.35, 'stroke-linejoin': 'round', class: cls }, g);
  lens.dataset.on = '0';
  // a brighter core along the middle when lit, like the light pipe in the reference
  const core = svg('path', { d: arcPath(a0 + 0.6, a1 - 0.6, rm - th * 0.18, rm + th * 0.18), fill: mixHex(color, '#ffffff', 0.55), opacity: 0, 'pointer-events': 'none' }, g);
  let cur;
  return (on) => {
    const col = on === true ? color : on || null;
    if (col === cur) return;
    cur = col;
    setA(lens, 'fill', col || off);
    setA(lens, 'stroke', col || off);
    lens.dataset.on = col ? '1' : '0';
    if (col) setA(glow, 'stroke', col);
    setA(glow, 'stroke-opacity', col ? 0.45 : 0);
    setA(core, 'opacity', col ? 0.55 : 0);
  };
}

// ------------------------------------------------------------------ rotary encoder (endless, optional LED ring)
export const ENC_CAPS = [['knurl', 'Knurled'], ['rubber', 'Rubber'], ['alu', 'Aluminium']];
export function encoderPart(parent, c) {
  const r = c.r || 8;
  const g = svg('g', { class: 'ctl knob encoder' }, parent);
  svg('circle', { r: r + (c.ring ? 6 : 4), fill: 'transparent' }, g);
  // LED ring all the way round: curved segments with small gaps, the arc fills from the top (or from the centre
  // detent), dot shows one LED
  const leds = [];
  if (c.ring) {
    const n = clamp(Math.round(c.ringN || 12), 2, 32);
    const ri = r + 1.3, ro = r + 4.3, rm = (ri + ro) / 2;
    const gap = Math.min((1.1 / rm) * (180 / Math.PI), 120 / n); // about 1.1 mm between segments
    svg('path', { d: annulus(r + 0.6, ro + 0.9), fill: '#07080a', 'fill-rule': 'evenodd', opacity: 0.92 }, g);
    const c1 = c.ringColor || '#38f07a', c2 = c.ringColor2 || null;
    for (let i = 0; i < n; i++) {
      // segment i is centred on the angle i * 360 / n, so the first one sits at the top
      const a = (360 * i) / n, half = 180 / n - gap / 2;
      const t = c.detent ? Math.min(i, n - i) / (n / 2) : i / Math.max(1, n - 1);
      const col = c2 ? mixHex(c1, c2, t) : c1;
      leds.push({ set: arcLamp(g, a - half, a + half, ri, ro, col, 'enc-led'), col });
    }
  }
  svg('circle', { r: r + 2.4, cy: 2.2, fill: 'url(#g-knobShadow)', opacity: 0.8 }, g);
  const rot = svg('g', { class: 'knob-rot' }, g);
  const cap = c.cap || 'knurl';
  const spec = specOr(c.mat, cap === 'rubber' ? RUBBER : cap === 'alu' ? ALU : CHROME);
  const o = opt(c, { round: true, glowWidth: r * 0.4 });
  const f = materialFill(spec, o);
  paint(rot, 'circle', { r }, spec, o);
  if (cap === 'knurl') svg('circle', { r: r - 0.7, fill: 'none', stroke: '#000', 'stroke-width': 1.3, 'stroke-dasharray': '0.45 0.45', opacity: 0.45 }, rot);
  else if (cap === 'rubber') for (let i = 0; i < 12; i++) svg('line', { x1: 0, y1: -r + 0.3, x2: 0, y2: -r * 0.72, stroke: '#000', 'stroke-width': 0.8, opacity: 0.4, transform: `rotate(${i * 30})` }, rot);
  else svg('circle', { r: r * 0.92, fill: 'none', stroke: f ? f.hi : '#fff', 'stroke-width': 0.5, opacity: 0.6 }, rot);
  svg('circle', { r: r * 0.7, fill: '#000', opacity: 0.18 }, rot);
  paint(rot, 'circle', { r: r * 0.66 }, spec, o);
  svg('line', { x1: 0, y1: -r * 0.86, x2: 0, y2: -r * 0.5, stroke: f ? f.ink : '#111', 'stroke-width': 0.9, 'stroke-linecap': 'round' }, rot);
  if (c.push) {
    // push switch: a smaller press cap in the middle
    svg('circle', { r: r * 0.36, fill: '#000', opacity: 0.35 }, g);
    paint(g, 'circle', { r: r * 0.32 }, spec, o);
    svg('circle', { r: r * 0.12, fill: f ? f.ink : '#111', opacity: 0.5 }, g);
  }
  svg('ellipse', { cx: -r * 0.22, cy: -r * 0.32, rx: r * 0.42, ry: r * 0.26, fill: '#fff', opacity: 0.12, 'pointer-events': 'none' }, g);
  let last = null;
  return {
    g,
    set(v) {
      v = clamp(v, 0, 1);
      if (v === last) return;
      last = v;
      rot.setAttribute('transform', `rotate(${(v * 540).toFixed(1)})`);
      const n = leds.length;
      if (!n) return;
      const mode = c.ringMode || 'arc';
      leds.forEach((L, i) => {
        let on;
        if (mode === 'dot') on = c.detent ? i === (Math.round((v - 0.5) * n) + n) % n : i === Math.min(n - 1, Math.round(v * (n - 1)));
        else if (c.detent) {
          // from the top LED (the centre) clockwise for more, anticlockwise for less
          const k = Math.min(Math.floor(n / 2), Math.round(Math.abs(v - 0.5) * n));
          on = v >= 0.5 ? i <= k : i === 0 || n - i <= k;
        } else on = i < Math.round(v * n);
        L.set(on ? L.col : null);
      });
    },
  };
}

// ------------------------------------------------------------------ XY pad and joystick: two views (x, y)
export function xyPart(parent, c, th, o = {}) {
  const [w, h] = xySize(c);
  const stick = isStick(c), thumb = c.look === 'thumb', glow = c.look === 'glow';
  const g = svg('g', { class: 'ctl xy' }, parent);
  const yG = svg('g', {}, g), xG = svg('g', {}, g);
  if (o.ids) {
    xG.dataset.ctl = o.ids[0];
    yG.dataset.ctl = o.ids[1];
  }
  const accent = c.color || '#3fa8ff';
  let vx = c.vx ?? 0.5, vy = c.vy ?? 0.5;
  let upd;
  if (stick) {
    const R = w / 2;
    svg('rect', { x: -R - 1, y: -R - 1, width: R * 2 + 2, height: R * 2 + 2, fill: 'transparent' }, yG);
    svg('circle', { r: R + 1.2, cy: 1.2, fill: '#000', opacity: 0.4 }, yG);
    paint(yG, 'circle', { r: R + 0.6 }, specOr(c.plateMat, CHROME), opt(c, { round: true }));
    svg('circle', { r: R - 0.6, fill: '#131416' }, yG);
    for (let i = 1; i < 4; i++) svg('circle', { r: (R - 0.6) * (i / 4), fill: 'none', stroke: '#000', 'stroke-width': 0.5, opacity: 0.5 }, yG);
    svg('rect', { x: -R * 0.55, y: -R * 0.55, width: R * 1.1, height: R * 1.1, fill: 'none', stroke: '#fff', 'stroke-width': 0.25, opacity: 0.12 }, yG);
    const shaft = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#9aa0a8', 'stroke-width': thumb ? 0 : 1.4, 'stroke-linecap': 'round' }, yG);
    const top = svg('g', {}, yG);
    if (thumb) {
      // a game pad thumbstick: a wide rubber cap with a dished, ringed top
      svg('circle', { r: R * 0.72, cy: 1, fill: '#000', opacity: 0.4 }, top);
      const sp = specOr(c.mat, { m: 'rubber', f: 'grip', c: '#2a2c31' });
      paint(top, 'circle', { r: R * 0.68 }, sp, opt(c, { round: true }));
      svg('circle', { r: R * 0.66, fill: 'none', stroke: '#000', 'stroke-width': R * 0.05, 'stroke-dasharray': '0.5 0.5', opacity: 0.5 }, top);
      svg('circle', { r: R * 0.5, fill: '#000', opacity: 0.28 }, top);
      svg('circle', { r: R * 0.46, cy: R * 0.04, fill: '#fff', opacity: 0.05 }, top);
      svg('circle', { r: R * 0.3, fill: 'none', stroke: '#000', 'stroke-width': 0.25, opacity: 0.35 }, top);
    } else {
      svg('circle', { r: R * 0.48, cy: 0.8, fill: '#000', opacity: 0.35 }, top);
      paint(top, 'circle', { r: R * 0.44 }, specOr(c.mat, { m: 'plastic', f: 'gloss', c: '#d0312d' }), opt(c, { round: true }));
      svg('ellipse', { cx: -R * 0.13, cy: -R * 0.16, rx: R * 0.2, ry: R * 0.12, fill: '#fff', opacity: 0.35 }, top);
    }
    upd = () => {
      const dx = (vx - 0.5) * R * 0.9, dy = (0.5 - vy) * R * 0.9;
      shaft.setAttribute('x2', dx.toFixed(2));
      shaft.setAttribute('y2', dy.toFixed(2));
      top.setAttribute('transform', `translate(${dx.toFixed(2)},${dy.toFixed(2)})`);
    };
  } else {
    svg('rect', { x: -w / 2 - 1.2, y: -h / 2 - 1.2, width: w + 2.4, height: h + 2.4, rx: 2.6, fill: '#000', opacity: 0.45 }, yG);
    if (isStock(c.mat)) svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 2, fill: '#121418', stroke: '#2b2f36', 'stroke-width': 0.4 }, yG);
    else paint(yG, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 2 }, c.mat, opt(c));
    let grid = '';
    if (glow) {
      // a frosted pad with a lit edge and a soft glow under the finger, no grid
      svg('rect', { x: -w / 2 + 0.5, y: -h / 2 + 0.5, width: w - 1, height: h - 1, rx: 1.6, fill: 'none', stroke: accent, 'stroke-width': 0.5, opacity: 0.8 }, yG);
      svg('rect', { x: -w / 2 + 0.5, y: -h / 2 + 0.5, width: w - 1, height: h - 1, rx: 1.6, fill: 'none', stroke: accent, 'stroke-width': 2, opacity: 0.18 }, yG);
    } else {
      for (let i = 1; i < 4; i++) grid += `M${-w / 2 + (w * i) / 4},${-h / 2 + 0.8}V${h / 2 - 0.8}M${-w / 2 + 0.8},${-h / 2 + (h * i) / 4}H${w / 2 - 0.8}`;
      svg('path', { d: grid, stroke: accent, 'stroke-width': 0.2, opacity: 0.3 }, yG);
    }
    const cross = svg('path', { d: '', stroke: accent, 'stroke-width': 0.3, opacity: glow ? 0 : 0.55 }, yG);
    const puck = svg('g', {}, yG);
    svg('circle', { r: glow ? Math.min(w, h) * 0.32 : 4.5, fill: haloFill(accent), 'pointer-events': 'none' }, puck);
    if (!glow) {
      svg('circle', { r: 1.8, fill: accent }, puck);
      svg('circle', { r: 0.8, fill: '#fff', opacity: 0.8 }, puck);
    } else svg('circle', { r: 1.2, fill: '#fff', opacity: 0.55 }, puck);
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 2, fill: 'url(#g-glass)', 'pointer-events': 'none', opacity: 0.6 }, yG);
    upd = () => {
      const x = -w / 2 + 1.5 + (w - 3) * vx, y = h / 2 - 1.5 - (h - 3) * vy;
      cross.setAttribute('d', `M${x.toFixed(2)},${-h / 2 + 0.6}V${h / 2 - 0.6}M${-w / 2 + 0.6},${y.toFixed(2)}H${w / 2 - 0.6}`);
      puck.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    };
  }
  // X rail under the pad
  const ry = h / 2 + 2.8;
  svg('rect', { x: -w / 2 - 1, y: ry - 1.8, width: w + 2, height: 3.6, fill: 'transparent' }, xG);
  svg('rect', { x: -w / 2, y: ry - 0.7, width: w, height: 1.4, rx: 0.7, fill: '#0a0b0d', stroke: '#000', 'stroke-width': 0.2 }, xG);
  const mark = svg('rect', { x: -1.2, y: ry - 1.2, width: 2.4, height: 2.4, rx: 0.5, fill: accent }, xG);
  const updRail = () => mark.setAttribute('x', (-w / 2 + (w - 2.4) * vx).toFixed(2));
  upd();
  updRail();
  return {
    g,
    subs: {
      x: { set: (v) => { vx = clamp(v, 0, 1); upd(); updRail(); }, press() {} },
      y: { set: (v) => { vy = clamp(v, 0, 1); upd(); }, press() {} },
    },
  };
}

// ------------------------------------------------------------------ touch strip / ribbon (kind slider)
export const STRIP_LOOKS = [['touch', 'Touch strip'], ['ribbon', 'Ribbon'], ['leds', 'LED dots']];
export function stripPart(parent, c) {
  const h = c.h || 40, w = c.w || 6;
  const outer = svg('g', { class: 'ctl slider strip' }, parent);
  const g = c.orient === 'h' ? svg('g', { transform: 'rotate(90)' }, outer) : outer;
  const accent = c.color || '#3fa8ff';
  svg('rect', { x: -w / 2 - 2, y: -h / 2 - 2, width: w + 4, height: h + 4, fill: 'transparent' }, g);
  svg('rect', { x: -w / 2 - 0.8, y: -h / 2 - 0.8, width: w + 1.6, height: h + 1.6, rx: w / 2 + 0.8, fill: '#000', opacity: 0.45 }, g);
  let fillR = null, bar, dot, dots = null;
  if (c.look === 'leds') {
    // a dark glass strip with a column of LEDs that fill up to the touch point
    paint(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 1.2 }, specOr(c.mat, BLACK), opt(c));
    const n = Math.max(4, Math.floor((h - 2) / 2.6));
    const lr = Math.min(0.75, w * 0.14);
    dots = [];
    for (let i = 0; i < n; i++) dots.push(lamp(g, 0, h / 2 - 1.4 - ((h - 2.8) * i) / (n - 1), lr, accent));
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 1.2, fill: 'url(#g-glass)', opacity: 0.5, 'pointer-events': 'none' }, g);
  } else if (c.look === 'ribbon') {
    paint(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 1 }, specOr(c.mat, BLACK), opt(c));
    svg('rect', { x: -0.9, y: -h / 2 + 1.5, width: 1.8, height: h - 3, rx: 0.9, fill: 'url(#g-chrome)' }, g);
    for (const yy of [-h / 2 + 1, h / 2 - 1]) svg('rect', { x: -w / 2 + 0.6, y: yy - 0.6, width: w - 1.2, height: 1.2, rx: 0.4, fill: '#3a3d42' }, g);
    dot = svg('g', {}, g);
    svg('circle', { r: 3.6, fill: haloFill(accent) }, dot);
    svg('circle', { r: 1.2, fill: accent }, dot);
  } else {
    if (isStock(c.mat)) svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: w / 2, fill: '#0d0f12', stroke: '#2b2f36', 'stroke-width': 0.35 }, g);
    else paint(g, 'rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: w / 2 }, c.mat, opt(c));
    fillR = svg('rect', { x: -w / 2 + 0.8, width: w - 1.6, rx: (w - 1.6) / 2, fill: accent, opacity: 0.22 }, g);
    bar = svg('rect', { x: -w / 2 + 0.8, width: w - 1.6, height: 2.6, rx: 1.2, fill: accent }, g);
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: w / 2, fill: 'url(#g-glass)', opacity: 0.55, 'pointer-events': 'none' }, g);
  }
  return {
    g: outer,
    set(v) {
      v = clamp(v, 0, 1);
      const y = h / 2 - 1.5 - (h - 3) * v;
      if (dots) dots.forEach((set, i) => set(i <= Math.round(v * (dots.length - 1)) && v > 0.005 ? true : null));
      if (dot) dot.setAttribute('transform', `translate(0,${y.toFixed(2)})`);
      if (bar) {
        bar.setAttribute('y', (y - 1.3).toFixed(2));
        fillR.setAttribute('y', y.toFixed(2));
        fillR.setAttribute('height', Math.max(0, h / 2 - 0.8 - y).toFixed(2));
      }
    },
  };
}

// ------------------------------------------------------------------ arcade button (kind button)
export const ARCADE_SHAPES = [['round', 'Round'], ['square', 'Square'], ['dome', 'Big dome']];
export function arcadePart(parent, c) {
  const r = c.r || 7;
  const shape = c.shape || 'round';
  const g = svg('g', { class: 'ctl button arcade' }, parent);
  svg('circle', { r: r + 4, fill: 'transparent' }, g);
  const col = /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#d0312d';
  const capSpec = specOr(c.mat, { m: 'plastic', f: 'gloss', c: col });
  const ringSpec = isStock(c.ringMat) ? { m: 'plastic', f: 'gloss', c: c.ringColor || '#1c1d21' } : c.ringMat;
  const cap = svg('g', {}, g);
  let lit, halo;
  if (shape === 'square') {
    const R = r + 1.9;
    svg('rect', { x: -R - 0.4, y: -R + 1, width: R * 2 + 0.8, height: R * 2 + 0.8, rx: 2, fill: '#000', opacity: 0.45 }, g);
    paint(g, 'rect', { x: -R, y: -R, width: R * 2, height: R * 2, rx: 1.8 }, ringSpec, opt(c));
    svg('rect', { x: -r - 0.4, y: -r - 0.4, width: r * 2 + 0.8, height: r * 2 + 0.8, rx: 1.2, fill: '#000', opacity: 0.55 }, g);
    g.appendChild(cap);
    paint(cap, 'rect', { x: -r, y: -r, width: r * 2, height: r * 2, rx: 1.1 }, capSpec, opt(c));
    svg('rect', { x: -r * 0.8, y: -r * 0.8, width: r * 1.6, height: r * 1.6, rx: 0.8, fill: 'none', stroke: '#000', 'stroke-width': r * 0.06, opacity: 0.2 }, cap);
    lit = svg('rect', { x: -r * 0.96, y: -r * 0.96, width: r * 1.92, height: r * 1.92, rx: 1, fill: c.ledColor || col, 'fill-opacity': 0 }, cap);
    svg('rect', { x: -r * 0.85, y: -r * 0.85, width: r * 1.1, height: r * 0.45, rx: 0.6, fill: '#fff', opacity: 0.22, 'pointer-events': 'none' }, cap);
  } else {
    const dome = shape === 'dome';
    svg('circle', { r: r + 2.4, cy: 1.4, fill: '#000', opacity: 0.45 }, g);
    paint(g, 'circle', { r: r + (dome ? 1.4 : 1.9) }, ringSpec, opt(c, { round: true }));
    svg('circle', { r: r + 0.4, fill: '#000', opacity: 0.55 }, g);
    g.appendChild(cap);
    paint(cap, 'circle', { r }, capSpec, opt(c, { round: true }));
    if (dome) {
      // a big domed cap: rings of shade towards the edge and a large highlight
      for (const [k, op] of [[0.98, 0.25], [0.88, 0.12]]) svg('circle', { r: r * k, fill: 'none', stroke: '#000', 'stroke-width': r * 0.1, opacity: op }, cap);
      svg('circle', { r: r * 0.55, cx: -r * 0.12, cy: -r * 0.15, fill: '#fff', opacity: 0.12 }, cap);
    } else svg('circle', { r: r * 0.86, fill: 'none', stroke: '#fff', 'stroke-width': r * 0.08, opacity: 0.18 }, cap);
    lit = svg('circle', { r: r * 0.96, fill: c.ledColor || col, 'fill-opacity': 0 }, cap);
    svg('ellipse', { cx: -r * 0.25, cy: -r * 0.35, rx: r * (dome ? 0.62 : 0.5), ry: r * (dome ? 0.38 : 0.3), fill: '#fff', opacity: dome ? 0.4 : 0.32, 'pointer-events': 'none' }, cap);
  }
  halo = svg('circle', { r: r * 2.2, fill: haloFill(c.ledColor || col), 'fill-opacity': 0, 'pointer-events': 'none' }, g);
  return {
    g,
    set(on) {
      if (!c.led) return;
      setA(lit, 'fill-opacity', on ? 0.45 : 0);
      setA(halo, 'fill-opacity', on ? 0.6 : 0);
    },
    press(p) {
      cap.setAttribute('transform', p ? 'translate(0,0.4) scale(0.96)' : '');
    },
  };
}

// ------------------------------------------------------------------ step buttons: a row, one lit (kind sel)
export const STEP = 8;
export const STEP_LOOKS = [['rubber', 'Rubber'], ['lit', 'Lit pads'], ['round', 'Round']];
export function stepsPart(parent, c, th) {
  const n = c.n || 4;
  const look = c.look || 'rubber';
  const g = svg('g', { class: 'ctl steps' }, parent);
  const W = n * STEP;
  svg('rect', { x: -W / 2 - 1, y: -6.5, width: W + 2, height: 13, fill: 'transparent' }, g);
  const col = c.ledColor || '#3ddc84';
  const spec = specOr(c.mat, look === 'lit' ? { m: 'acrylic', f: 'frosted', c: '#c9ced6' } : look === 'round' ? BLACK : RUBBER);
  const items = [];
  const opts = c.opts || [];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + STEP * (i + 0.5);
    const b = svg('g', { transform: `translate(${x},1)` }, g);
    let set, shade2;
    if (look === 'lit') {
      // the pad itself lights up
      svg('rect', { x: -3.2, y: -3.1, width: 6.4, height: 6.4, rx: 1, fill: '#000', opacity: 0.55 }, b);
      paint(b, 'rect', { x: -2.9, y: -3.3, width: 5.8, height: 5.8, rx: 0.9 }, spec, opt(c, { seed: c.id + i }));
      const glowR = svg('rect', { x: -2.9, y: -3.3, width: 5.8, height: 5.8, rx: 0.9, fill: col, 'fill-opacity': 0, class: 'step-led' }, b);
      glowR.dataset.on = '0';
      const halo = svg('circle', { cy: -0.4, r: 6, fill: haloFill(col), 'fill-opacity': 0, 'pointer-events': 'none' }, b);
      shade2 = svg('rect', { x: -2.9, y: -3.3, width: 5.8, height: 5.8, rx: 0.9, fill: '#000', 'fill-opacity': 0 }, b);
      set = (on) => {
        setA(glowR, 'fill-opacity', on ? 0.75 : 0);
        glowR.dataset.on = on ? '1' : '0';
        setA(halo, 'fill-opacity', on ? 0.6 : 0);
      };
    } else if (look === 'round') {
      svg('circle', { r: 3.1, cy: 0.3, fill: '#000', opacity: 0.5 }, b);
      svg('circle', { r: 2.9, fill: 'url(#g-chrome)' }, b);
      paint(b, 'circle', { r: 2.2 }, spec, opt(c, { seed: c.id + i, round: true }));
      shade2 = svg('circle', { r: 2.2, fill: '#000', 'fill-opacity': 0 }, b);
      set = lamp(g, x, -4.6, 0.75, col, 'circle', 'step-led');
    } else {
      svg('rect', { x: -2.9, y: -2.6, width: 5.8, height: 5.8, rx: 1, fill: '#000', opacity: 0.5 }, b);
      paint(b, 'rect', { x: -2.7, y: -2.9, width: 5.4, height: 5.4, rx: 0.9 }, spec, opt(c, { seed: c.id + i }));
      shade2 = svg('rect', { x: -2.7, y: -2.9, width: 5.4, height: 5.4, rx: 0.9, fill: '#000', 'fill-opacity': 0 }, b);
      set = lamp(g, x, -4.6, 0.85, col, 'circle', 'step-led');
    }
    if (c.marks !== false && opts[i]) label(g, x, 5.6, opts[i], { size: 2.1, fill: th.text, weight: 700, ls: 0 });
    items.push({ set, shade2 });
  }
  let cur = -1;
  return {
    g,
    set(idx) {
      if (idx === cur) return;
      cur = idx;
      items.forEach((it, i) => {
        it.set(i === idx ? col : null);
        setA(it.shade2, 'fill-opacity', i === idx ? (look === 'lit' ? 0 : 0.25) : 0);
      });
    },
  };
}

// ------------------------------------------------------------------ mini toggle bank (kind dip)
export const TB = 4.4;
export const tbankWidth = (n) => n * TB + 2;
export function tbankPart(parent, c, th, o = {}) {
  const n = c.n || 4;
  const W = tbankWidth(n);
  const g = svg('g', { class: 'ctl tbank' }, parent);
  paint(g, 'rect', { x: -W / 2, y: -5.2, width: W, height: 10.4, rx: 1.2 }, specOr(c.plateMat, { m: 'metal', s: 'steel', f: 'brushed' }), opt(c));
  svg('rect', { x: -W / 2, y: -5.2, width: W, height: 10.4, rx: 1.2, fill: 'none', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.3 }, g);
  const spec = specOr(c.mat, CHROME);
  const sets = [];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 1 + TB * (i + 0.5);
    const sg = svg('g', { transform: `translate(${x},-0.4)` }, g);
    if (o.ids) sg.dataset.ctl = o.ids[i];
    svg('rect', { x: -TB / 2, y: -5, width: TB, height: 9, fill: 'transparent' }, sg);
    svg('polygon', { points: hex(1.6), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.2 }, sg);
    svg('circle', { r: 0.9, fill: '#1c1e21' }, sg);
    const lev = svg('g', {}, sg);
    paint(lev, 'path', { d: 'M-0.55,0.2 L-0.4,-3.6 Q0,-4 0.4,-3.6 L0.55,0.2 Z' }, spec, opt(c, { size: 2 }));
    svg('circle', { cy: -3.8, r: 0.65, fill: '#d8dce2' }, lev);
    label(g, x, 4.1, String(i + 1), { size: 1.6, fill: th.text, weight: 700, ls: 0 });
    const set = (on) => lev.setAttribute('transform', on ? '' : 'scale(1,-1)');
    set(c.bits ? c.bits[i] : 0);
    sets.push(set);
  }
  return { g, sets };
}

// ------------------------------------------------------------------ needle meter (kind knob)
export const METER_LOOKS = [['vu', 'VU'], ['dark', 'Dark'], ['round', 'Round gauge']];
export function meterPart(parent, c, th) {
  const look = c.look || 'vu';
  const round = look === 'round', dark = look === 'dark';
  const w = round ? c.h || 18 : c.w || 28, h = c.h || 18;
  const g = svg('g', { class: 'ctl knob meter' }, parent);
  const face = c.face || (dark ? '#15171b' : '#efe6cc');
  const ink = luma(face) > 0.45 ? '#2a2420' : '#e9e4d8';
  const red = '#d9362f';
  let py, R, a0 = -48, a1 = 48;
  if (round) {
    // a round panel gauge: chrome ring, needle from the middle, 240 degree scale
    const rr = h / 2;
    paint(g, 'circle', { r: rr + 1.6 }, specOr(c.mat, CHROME), opt(c, { round: true }));
    svg('circle', { r: rr, fill: face }, g);
    if (c.lit) svg('circle', { r: rr, fill: haloFill('#ffb020', 0.8), opacity: 0.6 }, g);
    py = 0;
    R = rr * 1.02;
    a0 = -120;
    a1 = 120;
  } else {
    paint(g, 'rect', { x: -w / 2 - 1.5, y: -h / 2 - 1.5, width: w + 3, height: h + 3, rx: 1.6 }, specOr(c.mat, BLACK), opt(c));
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.8, fill: face }, g);
    if (c.lit || dark) svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.8, fill: haloFill(dark ? '#7fd8ff' : '#ffb020', 0.8), opacity: dark ? 0.35 : 0.7 }, g);
    py = h / 2 - 1.5;
    R = h * 0.82;
  }
  const span = a1 - a0, warn = a0 + span * 0.79;
  const arc = (b0, b1, rr) => {
    const [x0, y0] = polar(b0, rr), [x1, y1] = polar(b1, rr);
    return `M${x0.toFixed(2)},${(py + y0).toFixed(2)}A${rr},${rr} 0 ${b1 - b0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${(py + y1).toFixed(2)}`;
  };
  const rs = R * (round ? 0.8 : 0.86);
  svg('path', { d: arc(a0, warn, rs), fill: 'none', stroke: ink, 'stroke-width': 0.35 }, g);
  svg('path', { d: arc(warn, a1, rs), fill: 'none', stroke: red, 'stroke-width': 1.1 }, g);
  for (let i = 0; i <= 10; i++) {
    const a = a0 + (span * i) / 10;
    const [x0, y0] = polar(a, rs), [x1, y1] = polar(a, rs - R * (i % 5 === 0 ? 0.12 : 0.07));
    svg('line', { x1: x0, y1: py + y0, x2: x1, y2: py + y1, stroke: i > 7 ? red : ink, 'stroke-width': 0.3 }, g);
  }
  label(g, 0, round ? R * 0.42 : py - R * 0.36, c.text ?? 'VU', { size: Math.min(3.2, h * 0.17), fill: ink, weight: 700, ls: 0.2 });
  const needle = svg('line', { x1: 0, y1: py, x2: 0, y2: py - R * (round ? 0.86 : 0.92), stroke: dark ? '#ff5a3a' : round ? red : '#111', 'stroke-width': 0.35, 'stroke-linecap': 'round' }, g);
  svg('circle', { cy: py, r: 1.2, fill: '#1a1a1a' }, g);
  if (round) svg('circle', { r: h / 2, fill: 'url(#g-glass)', 'pointer-events': 'none' }, g);
  else svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.8, fill: 'url(#g-glass)', 'pointer-events': 'none' }, g);
  return { g, set: (v) => needle.setAttribute('transform', `rotate(${(a0 + span * clamp(v, 0, 1)).toFixed(1)} 0 ${py})`) };
}
const luma = (hx) => {
  try {
    const [r, g2, b] = hexToRgb(hx);
    return (0.299 * r + 0.587 * g2 + 0.114 * b) / 255;
  } catch (_) {
    return 0.8;
  }
};

// ------------------------------------------------------------------ slider looks
export const SLIDER_LOOKS = [['classic', 'Classic'], ['fader', 'Fader cap'], ['mini', 'Mini fader'], ['led', 'LED slider'], ['long', 'Long throw'], ['scale', 'With scale']];
export function sliderLook(parent, c, th) {
  const look = c.look;
  const h = c.h || 24;
  const outer = svg('g', { class: 'ctl slider' }, parent);
  const g = c.orient === 'h' ? svg('g', { transform: 'rotate(90)' }, outer) : outer;
  const mini = look === 'mini', long = look === 'long';
  const cw = c.w || (mini ? 4 : 6), ch = mini ? 3.4 : long ? 4 : 5.4;
  svg('rect', { x: -cw / 2 - 3, y: -h / 2 - ch, width: cw + 6, height: h + ch * 2, fill: 'transparent' }, g);
  // slot plate and track
  svg('rect', { x: -2.2, y: -h / 2 - 1.6, width: 4.4, height: h + 3.2, rx: 1.2, fill: '#1a1c20', stroke: '#000', 'stroke-width': 0.3 }, g);
  svg('rect', { x: -0.6, y: -h / 2, width: 1.2, height: h, rx: 0.6, fill: '#030304' }, g);
  if (look === 'scale' || long) {
    const marks = long ? ['+10', '0', '-10', '-20', '-40', '-inf'] : ['10', '8', '6', '4', '2', '0'];
    marks.forEach((m, i) => {
      const yy = -h / 2 + (h * i) / (marks.length - 1);
      svg('line', { x1: -cw / 2 - 2.6, x2: -cw / 2 - 0.8, y1: yy, y2: yy, stroke: th.text, 'stroke-width': 0.35, opacity: 0.8 }, g);
      if (c.orient !== 'h') label(g, -cw / 2 - 3.2, yy, m === '-inf' ? '-∞' : m, { size: 2, fill: th.text, anchor: 'end', weight: 700, ls: 0 });
    });
  } else if (c.marks !== false)
    for (let i = 0; i <= 6; i++) {
      const yy = -h / 2 + (h * i) / 6;
      svg('line', { x1: -cw / 2 - 2, x2: -cw / 2 - 0.6, y1: yy, y2: yy, stroke: th.text, 'stroke-width': 0.35, opacity: 0.7 }, g);
      svg('line', { x1: cw / 2 + 0.6, x2: cw / 2 + 2, y1: yy, y2: yy, stroke: th.text, 'stroke-width': 0.35, opacity: 0.7 }, g);
    }
  const cap = svg('g', {}, g);
  svg('rect', { x: -cw / 2 - 0.4, y: -ch / 2 + 0.6, width: cw + 0.8, height: ch, rx: 0.9, fill: '#000', opacity: 0.5 }, cap);
  const led = look === 'led';
  const spec = specOr(c.mat, led ? { m: 'acrylic', f: 'frosted', c: '#9aa3ad' } : { m: 'plastic', f: 'matte', c: c.capColor && /^#/.test(c.capColor) ? c.capColor : '#1c1d21' });
  const f = paint(cap, 'rect', { x: -cw / 2, y: -ch / 2, width: cw, height: ch, rx: 0.8 }, spec, opt(c)).f;
  if (!led) for (const yy of [-ch * 0.28, ch * 0.28]) svg('line', { x1: -cw / 2 + 0.5, x2: cw / 2 - 0.5, y1: yy, y2: yy, stroke: '#000', 'stroke-width': 0.3, opacity: 0.45 }, cap);
  svg('line', { x1: -cw / 2 + 0.4, x2: cw / 2 - 0.4, y1: 0, y2: 0, stroke: c.lineColor || (f ? f.ink : '#eee'), 'stroke-width': 0.5 }, cap);
  let ledSet = null;
  if (led) ledSet = lamp(cap, 0, 0, Math.min(1.1, cw * 0.18), c.ledColor || '#3fa8ff', 'rect');
  if (ledSet) ledSet(true);
  return {
    g: outer,
    set(v) {
      cap.setAttribute('transform', `translate(0,${(h / 2 - h * clamp(v, 0, 1)).toFixed(2)})`);
    },
    led(on) {
      if (ledSet) ledSet(on ? true : null);
    },
  };
}

// ------------------------------------------------------------------ rotary switch looks
export const SEL_LOOKS = [['classic', 'Classic'], ['pointer', 'Pointer'], ['chicken', 'Chicken head'], ['wafer', 'Wafer'], ['ring', 'Lit ring'], ['lcd', 'Readout']];
export function selLook(parent, c, th, knobPart) {
  const n = c.n || 4, r = c.r || 7, look = c.look;
  const opts = (c.opts || []).slice(0, n);
  while (opts.length < n) opts.push(String(opts.length + 1));
  const sweep = Math.min(300, Math.max(120, (n - 1) * 30));
  const g = svg('g', { class: 'ctl sel' }, parent);
  const angAt = (i) => -sweep / 2 + (sweep * i) / Math.max(1, n - 1);
  const marks = [];
  const col = c.ledColor || '#ff3020';
  for (let i = 0; i < n; i++) {
    const a = angAt(i);
    if (look === 'wafer') {
      const [x, y] = polar(a, r + 3.6);
      const box = svg('rect', { x: x - 1.7, y: y - 1.3, width: 3.4, height: 2.6, rx: 0.5, fill: '#0b0c0e', stroke: th.text, 'stroke-width': 0.2, 'stroke-opacity': 0.5 }, g);
      const t = label(g, x, y, String(i + 1), { size: 1.9, fill: '#d8dce2', weight: 700, ls: 0 });
      marks.push((on) => {
        setA(box, 'fill', on ? col : '#0b0c0e');
        setA(t, 'fill', on ? '#fff' : '#d8dce2');
      });
    } else if (look === 'ring') {
      const [x, y] = polar(a, r + 2.8);
      marks.push(lamp(g, x, y, 0.9, col));
    } else {
      const [x0, y0] = polar(a, r + 1.6), [x1, y1] = polar(a, r + (look === 'pointer' ? 3.6 : 2.6));
      svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: th.text, 'stroke-width': look === 'pointer' ? 0.6 : 0.4, opacity: 0.85 }, g);
    }
    if (c.marks !== false && look !== 'wafer' && look !== 'lcd') {
      const [x, y] = polar(a, r + (look === 'ring' ? 5.6 : 5.4));
      label(g, x, y, opts[i], { size: 2.3, fill: th.text, weight: 700, ls: 0 });
    }
  }
  let lcd = null;
  if (look === 'lcd') {
    const lw = Math.max(16, r * 2 + 4);
    svg('rect', { x: -lw / 2 - 0.8, y: -r - 10.8, width: lw + 1.6, height: 7.6, rx: 1, fill: '#0b0c0e' }, g);
    svg('rect', { x: -lw / 2, y: -r - 10, width: lw, height: 6, rx: 0.5, fill: c.screenBg || '#9fbf3a' }, g);
    lcd = label(g, 0, -r - 7, '', { size: 3.4, fill: '#1d2a08', font: "'Share Tech Mono', monospace", weight: 400, ls: 0.1 });
    for (let i = 0; i < n; i++) {
      const [x0, y0] = polar(angAt(i), r + 1.6), [x1, y1] = polar(angAt(i), r + 2.8);
      svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: th.text, 'stroke-width': 0.4, opacity: 0.85 }, g);
    }
  }
  const style = look === 'pointer' ? 'pointer' : look === 'chicken' ? 'chicken' : c.style || 'boss';
  const k = knobPart(g, { ...c, style, r: look === 'chicken' ? r * 0.85 : r, ticks: false, dial: 'none', sweep }, th);
  let cur = -1;
  return {
    g,
    set(idx) {
      if (idx === cur) return;
      cur = idx;
      k.set(n > 1 ? idx / (n - 1) : 0.5);
      marks.forEach((m, i) => m(i === idx ? col : null));
      if (lcd) lcd.textContent = opts[idx] || String(idx + 1);
    },
  };
}

// ------------------------------------------------------------------ LED looks
export const LED_LOOKS = [['round', 'Round'], ['flat', 'Flat top'], ['square', 'Square'], ['bar', 'Bar'], ['diffused', 'Diffused'], ['clear', 'Clear'], ['jewel', 'Jewel lamp'], ['rgb', 'RGB'], ['bicolour', 'Bicolour'], ['meter', 'Meter bar']];
export const LED_BEZELS = [['chrome', 'Chrome'], ['black', 'Black'], ['cup', 'Deep cup'], ['ring', 'Thin ring'], ['none', 'None']];
const METER_COLS = (n) => [...Array(n)].map((_, i) => (i >= n - 1 ? '#ff2a1a' : i >= n * 0.65 ? '#ffb020' : '#3ddc84'));
export function ledLook(parent, c) {
  const r = c.r || 2.5, look = c.look || 'round';
  const color = c.color || '#ff2a1a';
  const g = svg('g', { class: 'led-part', 'pointer-events': 'none' }, parent);
  const bez = c.bezel || 'chrome';
  const bf = isStock(c.mat) ? null : materialFill(c.mat, opt(c, { round: true }));
  const bezFill = bf ? bf.fill : bez === 'black' ? '#141518' : 'url(#g-chrome)';
  const bezelAt = (tag, attrs, grow) => {
    if (bez === 'none') return;
    if (bez === 'cup') svg(tag, { ...grow(1.9), fill: bezFill }, g), svg(tag, { ...grow(1.1), fill: '#000', opacity: 0.45 }, g);
    else if (bez === 'ring') svg(tag, { ...grow(0.55), fill: bezFill }, g);
    else svg(tag, { ...grow(1.3), fill: bezFill }, g);
  };
  const circleGrow = (k) => ({ r: r + k });
  if (look === 'meter') {
    const n = clamp(c.n || 8, 3, 16), sp = 2.4;
    const W = n * sp;
    svg('rect', { x: -W / 2 - 1, y: -2.6, width: W + 2, height: 5.2, rx: 0.8, fill: bez === 'none' ? 'none' : bezFill }, g);
    svg('rect', { x: -W / 2 - 0.3, y: -2, width: W + 0.6, height: 4, rx: 0.4, fill: '#050506' }, g);
    const cols = METER_COLS(n);
    const segs = cols.map((col, i) => ({ col, set: lamp(g, -W / 2 + sp * (i + 0.5), 0, 0.95, col, 'rect') }));
    let cur;
    return {
      g,
      set(on) {
        const lvl = on ? clamp(c.level ?? 0.7, 0, 1) : 0;
        if (lvl === cur) return;
        cur = lvl;
        segs.forEach((s, i) => s.set(i < Math.round(lvl * n) ? s.col : null));
      },
    };
  }
  let lens, die = null, dieCol = null;
  if (look === 'square' || look === 'bar') {
    const w = look === 'bar' ? c.w || 8 : r * 2, h = look === 'bar' ? c.h || 2.4 : r * 2;
    bezelAt('rect', {}, (k) => ({ x: -w / 2 - k, y: -h / 2 - k, width: w + k * 2, height: h + k * 2, rx: 0.4 + k * 0.4 }));
    lens = svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.35, fill: offCol(color) }, g);
    svg('rect', { x: -w / 2 + 0.3, y: -h / 2 + 0.25, width: w - 0.6, height: h * 0.35, rx: 0.3, fill: '#fff', opacity: 0.18 }, g);
  } else if (look === 'jewel') {
    svg('circle', { r: r + 2.2, fill: bezFill }, g);
    svg('polygon', { points: hex(r + 1.4), fill: bezFill, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.2 }, g);
    lens = svg('circle', { r, fill: offCol(color) }, g);
    for (let i = 0; i < 8; i++) {
      const a0 = (i * 45 * Math.PI) / 180, a1 = ((i + 1) * 45 * Math.PI) / 180;
      svg('path', { d: `M0,0L${(Math.cos(a0) * r).toFixed(2)},${(Math.sin(a0) * r).toFixed(2)}L${(Math.cos(a1) * r).toFixed(2)},${(Math.sin(a1) * r).toFixed(2)}Z`, fill: i % 2 ? '#fff' : '#000', opacity: i % 2 ? 0.2 : 0.18 }, g);
    }
    svg('circle', { r: r * 0.35, fill: '#fff', opacity: 0.22 }, g);
  } else {
    bezelAt('circle', {}, circleGrow);
    const clear = look === 'clear' || look === 'rgb';
    lens = svg('circle', { r, fill: clear ? '#cdd5dc' : offCol(color), 'fill-opacity': clear ? 0.35 : 1 }, g);
    if (clear) {
      // the die and its posts seen through a water clear lens
      svg('path', { d: `M${-r * 0.35},${r * 0.9}V${r * 0.1}M${r * 0.35},${r * 0.9}V${-r * 0.05}`, stroke: '#9aa0a8', 'stroke-width': r * 0.12 }, g);
      if (look === 'rgb') {
        dieCol = ['#ff3030', '#30ff60', '#3070ff'].map((cc, i) => svg('rect', { x: -r * 0.45 + i * r * 0.32, y: -r * 0.15, width: r * 0.24, height: r * 0.24, fill: offCol(cc) }, g));
      } else die = svg('rect', { x: -r * 0.16, y: -r * 0.2, width: r * 0.32, height: r * 0.32, fill: '#3a3d42' }, g);
    }
    if (look === 'bicolour') svg('path', { d: `M${-r * 0.3},${r * 0.2}h${r * 0.25}M${r * 0.05},${r * 0.2}h${r * 0.25}`, stroke: '#000', 'stroke-width': r * 0.12, opacity: 0.35 }, g);
    if (look === 'diffused') svg('circle', { r, fill: '#fff', opacity: 0.22 }, g);
    if (look === 'flat') svg('circle', { r: r * 0.8, fill: 'none', stroke: '#fff', 'stroke-width': r * 0.12, opacity: 0.22 }, g);
    else svg('circle', { r: r * 0.95, fill: 'url(#g-ledLens)' }, g);
  }
  const halo = svg('circle', { r: r * (look === 'diffused' ? 4.2 : 3.4), 'fill-opacity': 0, 'pointer-events': 'none' }, g);
  let cur;
  const set = (on) => {
    let col = on === true ? color : on || null;
    if (!col && look === 'bicolour') col = c.color2 || '#3ddc84';
    if (col === cur) return;
    cur = col;
    const clear = look === 'clear' || look === 'rgb';
    setA(lens, 'fill', col || (clear ? '#cdd5dc' : offCol(color)));
    if (clear) setA(lens, 'fill-opacity', col ? 0.9 : 0.35);
    if (die) setA(die, 'fill', col ? '#fff' : '#3a3d42');
    if (dieCol) dieCol.forEach((d, i) => setA(d, 'fill', col ? '#fff' : offCol(['#ff3030', '#30ff60', '#3070ff'][i])));
    if (col) setA(halo, 'fill', haloFill(col, look === 'diffused' ? 0.8 : 1));
    setA(halo, 'fill-opacity', col ? 1 : 0);
  };
  return { g, set };
}
// half size of an LED in its look
export function ledHalf(c) {
  const r = c.r || 2.5;
  if (c.look === 'meter') return [(clamp(c.n || 8, 3, 16) * 2.4) / 2 + 1, 2.6];
  if (c.look === 'bar') return [(c.w || 8) / 2 + 1.3, (c.h || 2.4) / 2 + 1.3];
  if (c.look === 'jewel') return [r + 2.2, r + 2.2];
  return [r + 1.9, r + 1.9];
}
