// Tone Zone originals, third generation: one character enclosure per classic core original (Drive Lab, VU comp,
// tape echo, cathedral reverb, radio ring mod, cracked-glass crusher, rotary horn, rack-ear DI …).
// Same family as forms-tz.js (engraved type, TONE ZONE badge, chrome hardware) but every pedal gets its own
// silhouette, material and illustration. Performance: gradients, cached noise patterns, clip paths and a few
// dozen paths per pedal – no SVG filters.
import { svg, shade, luminance } from '../util.js';
import { softShadow, noisePattern, haloFill } from './fx.js';
import { label } from './controls.js';
import { formKit as coreKit } from './forms.js'; // cyclic import: only touched at render time

let injected = null;
const kit = () => injected || coreKit;

// ------------------------------------------------------------------ paint helpers
function defsEl() {
  let d = document.getElementById('globalDefs') || document.getElementById('tz3Defs');
  if (!d) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.style.position = 'absolute';
    d = svg('defs', { id: 'tz3Defs' }, s);
    document.body.appendChild(s);
  }
  return d;
}
const keyOf = (c) => String(c).replace(/[^a-z0-9]/gi, '');
function lin(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  if (!document.getElementById(id)) {
    const gr = svg('linearGradient', { id, x1, y1, x2, y2 }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function rad(id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) {
  if (!document.getElementById(id)) {
    const gr = svg('radialGradient', { id, cx, cy, r, fx, fy }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function noise(id, units, px, rgb, aMin, aMax, smooth) {
  if (!document.getElementById(id)) noisePattern(defsEl(), id, units, px, rgb, aMin, aMax, smooth);
  return `url(#${id})`;
}
function pattern(id, w, h, draw, o = {}) {
  if (!document.getElementById(id)) {
    const p = svg('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse', patternTransform: o.transform }, defsEl());
    draw(p);
  }
  return `url(#${id})`;
}
const isLight = (c) => { try { return luminance(c) > 0.5; } catch (_) { return false; } };
const inkFor = (c) => (isLight(c) ? '#17191d' : '#eef1f6');
const P = (g, d, a = {}) => svg('path', Object.assign({ d }, a), g);
const C = (g, cx, cy, r, a = {}) => svg('circle', Object.assign({ cx, cy, r }, a), g);
const R = (g, x, y, w, h, a = {}) => svg('rect', Object.assign({ x, y, width: w, height: h }, a), g);
const f1 = (n) => (+n).toFixed(1);
const pol = (cx, cy, r, deg) => [cx + Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r];
const lineGrad = (col) => lin('t3b' + keyOf(col), [[0, shade(col, 0.22)], [0.45, col], [1, shade(col, -0.32)]], 0, 0, 0.5, 1);
const sheen = () => lin('t3-sheen', [[0, '#fff', 0.08], [0.3, '#fff', 0], [0.47, '#fff', 0], [0.53, '#fff', 0.1], [0.62, '#fff', 0], [1, '#000', 0.1]], 0, 0, 1, 1);
const gloss = () => lin('t3-gloss', [[0, '#fff', 0.34], [0.14, '#fff', 0.1], [0.42, '#fff', 0], [1, '#000', 0.16]]);

let seq = 0;
// enclosure with a material. shape: rect (rx) or path. Returns { clip, shape(attrs, parent), edge() }
function shell(g, w, h, col, o = {}) {
  const rx = o.rx ?? 12;
  const path = o.path || null;
  if (path) softShadow(g, { w, h, path, dy: 14, blur: 9, opacity: 0.6 });
  else softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
  const shape = (a, parent = g) => (path ? svg('path', Object.assign({ d: path }, a), parent) : svg('rect', Object.assign({ x: 0, y: 0, width: w, height: h, rx }, a), parent));
  const mat = o.mat || 'enamel';
  switch (mat) {
    case 'anod':
      shape({ fill: lineGrad(col) });
      shape({ fill: 'url(#p-brushed)' });
      shape({ fill: 'url(#p-grain)', opacity: 0.5 });
      shape({ fill: sheen() });
      break;
    case 'hammer': // hammertone: dimpled lacquer with light / dark mottling
      shape({ fill: lineGrad(col) });
      shape({ fill: noise('t3-hamD2', 44, 22, [0, 0, 0], 0, 0.3, 2) });
      shape({ fill: noise('t3-hamL2', 34, 18, [255, 255, 255], 0, 0.2, 2) });
      shape({ fill: 'url(#p-grain)', opacity: 0.5 });
      shape({ fill: sheen() });
      break;
    case 'crinkle': // powder coat / crinkle finish
      shape({ fill: lineGrad(col) });
      shape({ fill: noise('t3-crk', 9, 48, [0, 0, 0], 0, 0.45, 1) });
      shape({ fill: noise('t3-crkL', 7, 40, [255, 255, 255], 0, 0.14, 1) });
      shape({ fill: sheen() });
      break;
    case 'flake': // metal-flake lacquer
      shape({ fill: rad('t3f' + keyOf(col), [[0, shade(col, 0.3)], [0.6, col], [1, shade(col, -0.4)]], 0.35, 0.28, 0.85) });
      shape({ fill: noise('t3-flake', 11, 64, [255, 255, 255], 0, 0.6, 0), opacity: 0.55 });
      shape({ fill: noise('t3-flakeD', 13, 64, [0, 0, 0], 0, 0.5, 0), opacity: 0.5 });
      shape({ fill: gloss() });
      break;
    case 'wood':
      shape({ fill: lineGrad(col) });
      break;
    case 'tolex':
      shape({ fill: col });
      shape({ fill: 'url(#p-tolex)' });
      shape({ fill: 'url(#g-shadeV)', opacity: 0.7 });
      break;
    case 'pearl':
      shape({ fill: lin('t3-pearl' + keyOf(col), [[0, '#ffffff'], [0.3, shade(col, 0.4)], [0.55, '#f3e6f4'], [0.78, '#dfeaf7'], [1, shade(col, -0.12)]], 0, 0, 1, 1) });
      shape({ fill: noise('t3-pearlN', 16, 48, [255, 255, 255], 0, 0.5, 2), opacity: 0.6 });
      shape({ fill: gloss() });
      break;
    default: // enamel
      shape({ fill: lineGrad(col) });
      shape({ fill: 'url(#p-grain)', opacity: 0.45 });
      shape({ fill: gloss() });
  }
  const id = 't3c' + ++seq;
  const cp = svg('clipPath', { id }, g);
  shape({}, cp);
  const clip = `url(#${id})`;
  return {
    clip,
    shape,
    inside: (a = {}) => svg('g', Object.assign({ 'clip-path': clip }, a), g),
    edge() {
      shape({ fill: 'none', stroke: '#fff', 'stroke-opacity': 0.3, 'stroke-width': 2.4, 'clip-path': clip, 'pointer-events': 'none' });
      shape({ fill: 'none', stroke: '#000', 'stroke-opacity': 0.62, 'stroke-width': 0.9, 'pointer-events': 'none' });
    },
  };
}
function woodGrain(g, w, h, col, n = 30) {
  for (let i = 0; i < n; i++) {
    const y = (i / n) * h + Math.sin(i * 1.7) * 3;
    const a = 2.5 + Math.sin(i * 2.3) * 2.5;
    P(g, `M-4 ${f1(y)} C ${f1(w * 0.3)} ${f1(y + a)} ${f1(w * 0.62)} ${f1(y - a)} ${w + 4} ${f1(y + a * 0.6)}`, { stroke: shade(col, i % 3 ? -0.4 : 0.22), 'stroke-width': i % 4 ? 0.6 : 1.4, fill: 'none', opacity: 0.4 });
  }
  // a knot
  svg('ellipse', { cx: w * 0.72, cy: h * 0.62, rx: 9, ry: 3.2, fill: 'none', stroke: shade(col, -0.45), 'stroke-width': 0.8, opacity: 0.45 }, g);
  svg('ellipse', { cx: w * 0.72, cy: h * 0.62, rx: 4.5, ry: 1.4, fill: shade(col, -0.4), opacity: 0.4 }, g);
}
// engraved / embossed lettering
function engrave(g, x, y, str, o = {}) {
  if (!str) return null;
  const base = Object.assign({ size: 10, weight: 800, ls: 1.2, font: "'Inter', sans-serif" }, o);
  const dark = isLight(base.fill || '#000');
  label(g, x, y + 0.7, str, Object.assign({}, base, { fill: dark ? '#000' : '#fff', opacity: dark ? 0.35 : 0.2 }));
  label(g, x, y - 0.5, str, Object.assign({}, base, { fill: dark ? '#fff' : '#000', opacity: dark ? 0.18 : 0.42 }));
  return label(g, x, y, str, base);
}
function screw(g, x, y, r = 2.6) {
  C(g, x, y + 0.5, r + 0.5, { fill: '#000', opacity: 0.4 });
  C(g, x, y, r, { fill: 'url(#g-chromeR)' });
  P(g, `M${x - r * 0.6} ${y}h${r * 1.2}M${x} ${y - r * 0.6}v${r * 1.2}`, { stroke: '#3a3f45', 'stroke-width': 0.7 });
}
const badge = (g, x, y, fill, size = 4.2, anchor = 'middle') => label(g, x, y, 'TONE ZONE', { size, fill, weight: 800, ls: 1.4, opacity: 0.75, anchor });
const typeLine = (g, x, y, def, fill, o = {}) => label(g, x, y, (def.typeName || def.cat).toUpperCase(), Object.assign({ size: 5, fill, weight: 700, ls: 1.5, opacity: 0.75 }, o));
// recessed window / glass
function windowBox(g, x, y, w, h, o = {}) {
  const rx = o.rx ?? 4;
  R(g, x - 2.5, y - 2.5, w + 5, h + 5, { rx: rx + 2, fill: o.bezel || 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.6 });
  R(g, x, y, w, h, { rx, fill: o.fill || '#0a0b0d' });
  const id = 't3w' + ++seq;
  const cp = svg('clipPath', { id }, g);
  R(cp, x, y, w, h, { rx });
  const inner = svg('g', { 'clip-path': `url(#${id})`, 'pointer-events': 'none' }, g);
  return { inner, glass: () => R(g, x, y, w, h, { rx, fill: 'url(#g-glass)', 'pointer-events': 'none' }) };
}
function textOnPath(g, d, str, o = {}) {
  const id = 't3tp' + ++seq;
  svg('path', { id, d, fill: 'none' }, g);
  const t = svg('text', { fill: o.fill || '#111', 'font-family': o.font || "'Oswald', sans-serif", 'font-weight': o.weight || 700, 'font-size': o.size || 10, 'letter-spacing': o.ls ?? 1, 'text-anchor': 'middle', 'pointer-events': 'none', opacity: o.opacity }, g);
  const tp = svg('textPath', { href: `#${id}`, startOffset: o.offset || '50%' }, t);
  tp.textContent = str;
  return t;
}

// ------------------------------------------------------------------ layout helpers
// controls without coordinates are laid out by the form on every render (the def is shared between renders)
const free = (c) => !c.hidden && (c._tz3 || (c.x === undefined && (c._tz3 = true)));
// spec: { <param>: {x,y,r,...}, foot: {...}, led: {...}, screen: {...} }
function put(def, spec) {
  let fi = 0;
  for (const c of def.controls) {
    if (!free(c)) continue;
    let s = null;
    if (c.t === 'foot') s = spec['foot' + (fi++ || '')] || spec.foot;
    else if (c.t === 'led') s = spec.led;
    else if (c.t === 'screen') s = spec.screen;
    else s = spec[c.p];
    if (!s) continue;
    Object.assign(c, s);
    if (c.t === 'foot') c.style = s.style || 'stomp';
  }
}
const shortJack = (l) => String(l || '').replace(' (MONO)', '').replace(/^OUTPUT/, 'OUT').replace(/^INPUT/, 'IN');
function finish(ctx, def, w, h, theme, jy, gap = 28, zones = []) {
  const done = new Set();
  for (const z of zones) {
    const list = def.controls.filter((c) => z.ps.includes(c.p) || z.ps.includes(c.t));
    list.forEach((c) => done.add(c));
    kit().placeControls(ctx, list, Object.assign({}, theme, z.theme));
  }
  kit().placeControls(ctx, def.controls.filter((c) => !done.has(c)), theme);
  const jacks = kit().jacksSide(def, w, { y0: jy, gap, flip: ctx.flip });
  for (const j of jacks) j.label = shortJack(j.label);
  return { w, h, theme: Object.assign({}, theme, { jackText: theme.jackText || theme.text }), jacks };
}
const T = (text, o = {}) => Object.assign({ text, knob: 'strymon', labelSize: 6.2, labelLs: 0.5, labelFont: "'Barlow Condensed', sans-serif" }, o);
const K = (x, y, r = 11, o = {}) => Object.assign({ x, y, r }, o);
const SELO = (x, y, r, o = {}) => Object.assign({ x, y, r, labelPos: 'below' }, o);

// ================================================================== forms
// Drive Lab: burnt-orange hammertone test instrument, CRT plotting the eight clipping curves, cream panel
function lab(ctx, def) {
  const g = ctx.g, w = 198, h = 262;
  const col = def.color || '#c95a26', acc = def.accent || '#ff7a2f', txt = def.text || '#1b0e06';
  const b = shell(g, w, h, col, { rx: 10, mat: 'hammer' });
  b.edge();
  for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) screw(g, x, y, 2.4);
  // CRT
  const cx = 14, cy = 14, cw = 112, chh = 58;
  const win = windowBox(g, cx, cy, cw, chh, { fill: rad('t3-crt', [[0, '#123826'], [1, '#03100a']], 0.5, 0.5, 0.7), rx: 6 });
  for (let i = 1; i < 8; i++) R(win.inner, cx + (cw * i) / 8, cy, 0.5, chh, { fill: '#5dff9c', opacity: i === 4 ? 0.25 : 0.1 });
  for (let i = 1; i < 4; i++) R(win.inner, cx, cy + (chh * i) / 4, cw, 0.5, { fill: '#5dff9c', opacity: i === 2 ? 0.25 : 0.1 });
  const curves = [(x) => Math.tanh(2.2 * x), (x) => (x > 0 ? Math.tanh(3 * x) : Math.tanh(1.4 * x) * 0.8), (x) => Math.max(-0.7, Math.min(0.7, 1.8 * x)) / 0.7 * 0.85, (x) => Math.tanh(5 * x) * 0.95, (x) => x / (1 + Math.abs(x) * 1.2) * 1.9, (x) => Math.atan(6 * x) / 1.5];
  curves.forEach((fn, k) => {
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const xx = -1 + (2 * i) / 40;
      d += (i ? 'L' : 'M') + f1(cx + cw / 2 + xx * (cw / 2 - 6)) + ' ' + f1(cy + chh / 2 - fn(xx) * (chh / 2 - 7));
    }
    P(win.inner, d, { fill: 'none', stroke: '#7dffb0', 'stroke-width': k === 0 ? 1.3 : 0.7, opacity: k === 0 ? 0.95 : 0.4, 'stroke-linejoin': 'round' });
  });
  label(win.inner, cx + 5, cy + 7, 'Vout / Vin', { size: 4.6, fill: '#7dffb0', anchor: 'start', opacity: 0.8, font: "'Share Tech Mono', monospace", weight: 400 });
  win.glass();
  // cream instrument panel
  const px = 10, py = 84, pw = w - 20, ph = 98;
  R(g, px, py, pw, ph, { rx: 5, fill: '#efe7d3', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.8 });
  R(g, px, py, pw, ph, { rx: 5, fill: 'url(#p-grain)', opacity: 0.4 });
  R(g, px, py, pw, 9, { rx: 5, fill: acc });
  R(g, px, py + 5, pw, 4, { fill: acc });
  label(g, px + 6, py + 4.8, 'INPUT STAGE', { size: 4.8, fill: '#fff', anchor: 'start', weight: 800, ls: 1.2 });
  label(g, px + pw - 6, py + 4.8, 'CH-A', { size: 4.8, fill: '#fff', anchor: 'end', weight: 800, ls: 1.2 });
  label(g, px + pw - 5, py + 72, 'EQ', { size: 4.6, fill: '#2a1a0d', anchor: 'end', weight: 800, opacity: 0.6 });
  // name plate
  engrave(g, 16, 200, def.logo || 'DRIVE LAB', { size: 15, fill: '#1b0e06', anchor: 'start', font: "'Oswald', sans-serif", weight: 700, ls: 2 });
  label(g, 16, 213, 'MODEL TZ-DL8 · 8 CLIPPING CIRCUITS', { size: 4.6, fill: txt, anchor: 'start', weight: 700, ls: 0.9, opacity: 0.8 });
  // calibration sticker
  R(g, w - 50, 192, 36, 20, { rx: 2, fill: '#f6f2e6', stroke: '#000', 'stroke-opacity': 0.3, 'stroke-width': 0.5, transform: `rotate(-4 ${w - 32} 202)` });
  label(g, w - 32, 198.5, 'CALIBRATED', { size: 3.6, fill: '#a3261a', weight: 800, transform: `rotate(-4 ${w - 32} 202)` });
  label(g, w - 32, 206, 'QC ✓ 0.3', { size: 4.2, fill: '#333', weight: 700, transform: `rotate(-4 ${w - 32} 202)` });
  label(g, 40, 252, 'ACTIVE', { size: 4.4, fill: txt, weight: 800, ls: 1, opacity: 0.8 });
  badge(g, w - 40, 252, txt, 4.2);
  put(def, {
    mode: SELO(162, 42, 12, { optSize: 4.2, labelRadius: 7, labelPos: 'none' }),
    gain: K(42, 116, 12.5), level: K(99, 116, 12.5), blend: K(156, 116, 12.5),
    bass: K(42, 156, 10), mid: K(99, 156, 10), treble: K(156, 156, 10),
    foot: { x: w / 2, y: 236, r: 12.5 }, led: { x: 40, y: 236, r: 3.4 },
  });
  label(g, 162, 76, 'CLIP', { size: 6.2, fill: txt, weight: 800, ls: 1 });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 116, 28, [{ ps: ['gain', 'level', 'blend', 'bass', 'mid', 'treble'], theme: { text: '#2a1a0d', knob: 'mxr' } }]);
}

// Clean Boost: white enamel arrow-head body with stacked chevrons
function arrow(ctx, def) {
  const g = ctx.g, w = 150, h = 248;
  const col = def.color || '#e9ecf3', acc = def.accent || '#3b82c4', txt = def.text || '#14161a';
  const path = `M8 30 L68 3 Q75 0 82 3 L142 30 Q150 34 150 42 V${h - 12} Q150 ${h} 138 ${h} H12 Q0 ${h} 0 ${h - 12} V42 Q0 34 8 30 Z`;
  const b = shell(g, w, h, col, { path, mat: 'enamel' });
  const t = b.inside({ 'pointer-events': 'none' });
  for (let i = 0; i < 3; i++) {
    const y = 98 + i * 11;
    P(t, `M14 ${y + 26}L75 ${y}L136 ${y + 26}`, { fill: 'none', stroke: acc, 'stroke-width': 6 - i, opacity: 0.55 - i * 0.11, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  }
  R(t, 0, 180, w, 3, { fill: acc, opacity: 0.85 });
  b.edge();
  engrave(g, w / 2, 160, def.logo || 'CLEAN BOOST', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
  typeLine(g, w / 2, 173, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, {
    gain: K(75, 50, 17, { labelPos: 'none' }), bass: K(28, 66, 10), treble: K(122, 66, 10),
    led: { x: 40, y: 214, r: 3 }, foot: { x: w / 2, y: 214, r: 12.5 },
  });
  label(g, 75, 77, 'BOOST', { size: 6.6, fill: txt, weight: 800, ls: 1.2 });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 200);
}

// Treble Booster: brushed-steel wedge that sits on the amp, 0-10 scale on the big knob, chirp graphic
function wedge(ctx, def) {
  const g = ctx.g, w = 136, h = 214;
  const col = def.color || '#8a8f97', acc = def.accent || '#e8473d', txt = def.text || '#121316';
  const path = `M4 0 H${w - 4} L${w} ${h - 8} Q${w} ${h} ${w - 8} ${h} H8 Q0 ${h} 0 ${h - 8} Z`;
  const b = shell(g, w, h, col, { path, mat: 'anod' });
  const t = b.inside({ 'pointer-events': 'none' });
  // tall back wall seen from above + sloping face shading
  R(t, 0, 0, w, 16, { fill: '#000', opacity: 0.32 });
  R(t, 0, 16, w, 1, { fill: '#fff', opacity: 0.35 });
  R(t, 0, 17, w, h - 17, { fill: lin('t3-wedgeS', [[0, '#000', 0.18], [0.5, '#000', 0], [1, '#fff', 0.08]]) });
  P(t, `M0 0 L9 0 L3 ${h}Z M${w} 0 L${w - 9} 0 L${w - 3} ${h}Z`, { fill: '#000', opacity: 0.18 });
  b.edge();
  // chirp: rising frequency
  let d = '';
  for (let i = 0; i <= 90; i++) { const tt = i / 90; d += (i ? 'L' : 'M') + f1(18 + tt * (w - 36)) + ' ' + f1(126 - Math.sin(tt * tt * 34) * 7 * (0.4 + tt * 0.6)); }
  P(g, d, { fill: 'none', stroke: acc, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
  engrave(g, w / 2, 148, def.logo || 'TREBLE BOOST', { size: 12.5, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
  typeLine(g, w / 2, 160, def, txt, { size: 4.8 });
  badge(g, w / 2, h - 8, txt, 4);
  put(def, { gain: K(68, 66, 17, { scale: 10, labelPos: 'none' }), led: { x: 30, y: 186, r: 3 }, foot: { x: 76, y: 186, r: 12 } });
  label(g, 68, 105, 'BOOST', { size: 6.4, fill: txt, weight: 800, ls: 1.4 });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 66);
}

// Studio Comp: navy enamel with a cream VU meter (gain reduction) and eight knobs
function vu(ctx, def) {
  const g = ctx.g, w = 200, h = 270;
  const col = def.color || '#2c3e50', acc = def.accent || '#e8b04a', txt = def.text || '#e9ecf3';
  const b = shell(g, w, h, col, { rx: 10, mat: 'enamel' });
  b.edge();
  // brushed faceplate behind the controls
  R(g, 8, 84, w - 16, 116, { rx: 6, fill: 'url(#g-chrome)', opacity: 0.18 });
  R(g, 8, 84, w - 16, 116, { rx: 6, fill: 'url(#p-brushed)' });
  R(g, 8.5, 84.5, w - 17, 115, { rx: 6, fill: 'none', stroke: '#000', 'stroke-opacity': 0.4 });
  // VU meter
  const mx = 34, my = 12, mw = 132, mh = 62;
  const win = windowBox(g, mx, my, mw, mh, { fill: lin('t3-vuface', [[0, '#fbf1d2'], [1, '#e8d6a6']]), rx: 5, bezel: '#15181c' });
  const pcx = mx + mw / 2, pcy = my + mh + 22, pr = 64;
  const arc = (a0, a1, r) => { const [x0, y0] = pol(pcx, pcy, r, a0), [x1, y1] = pol(pcx, pcy, r, a1); return `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}`; };
  P(win.inner, arc(-42, 22, pr), { fill: 'none', stroke: '#222', 'stroke-width': 0.9 });
  P(win.inner, arc(22, 42, pr), { fill: 'none', stroke: '#c0221a', 'stroke-width': 2.6 });
  const marks = [['20', -42], ['10', -28], ['7', -18], ['5', -9], ['3', 0], ['2', 7], ['1', 14], ['0', 22], ['+1', 28], ['+2', 34], ['+3', 42]];
  for (const [s, a] of marks) {
    const [x0, y0] = pol(pcx, pcy, pr, a), [x1, y1] = pol(pcx, pcy, pr + 4, a), [lx, ly] = pol(pcx, pcy, pr + 9, a);
    P(win.inner, `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`, { stroke: a > 22 ? '#c0221a' : '#222', 'stroke-width': 0.8 });
    label(win.inner, lx, ly, s, { size: 4.6, fill: a > 22 ? '#c0221a' : '#222', weight: 700 });
  }
  label(win.inner, mx + 16, my + mh - 11, 'VU', { size: 10, fill: '#222', weight: 700, font: "'Oswald', sans-serif" });
  label(win.inner, mx + mw - 8, my + mh - 8, 'GAIN RED.', { size: 4.2, fill: '#444', weight: 700, ls: 0.8, anchor: 'end' });
  const [nx, ny] = pol(pcx, pcy, pr + 2, -8);
  P(win.inner, `M${pcx} ${pcy}L${f1(nx)} ${f1(ny)}`, { stroke: '#111', 'stroke-width': 0.9 });
  R(g, mx, my, mw, mh, { rx: 5, fill: lin('t3-vuglow', [[0, '#ffd27a', 0.0], [1, '#ffb030', 0.18]]), 'pointer-events': 'none' });
  win.glass();
  for (const [x, y] of [[16, 20], [w - 16, 20], [16, 66], [w - 16, 66]]) screw(g, x, y, 2.4);
  engrave(g, w / 2, 207, def.logo || 'STUDIO COMP', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.4 });
  typeLine(g, w / 2, 219, def, txt);
  R(g, w / 2 - 50, 195, 100, 1, { fill: acc, opacity: 0.7 });
  badge(g, w / 2, h - 9, txt);
  const xs = [36, 79, 121, 164];
  put(def, {
    sustain: K(xs[0], 112), ratio: K(xs[1], 112), attack: K(xs[2], 112), release: K(xs[3], 112),
    level: K(xs[0], 160), blend: K(xs[1], 160), knee: K(xs[2], 160), tone: K(xs[3], 160),
    led: { x: 46, y: 238, r: 3 }, foot: { x: w / 2, y: 238, r: 12 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 112);
}

// Opto: cream tombstone with a porthole showing the lamp and the photocell
function tomb(ctx, def) {
  const g = ctx.g, w = 150, h = 254;
  const col = def.color || '#f0e3c8', acc = def.accent || '#8a3a1c', txt = def.text || '#2a1d10';
  const path = `M0 ${w / 2} A${w / 2} ${w / 2} 0 0 1 ${w} ${w / 2} V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} Z`;
  const b = shell(g, w, h, col, { path, mat: 'enamel' });
  const t = b.inside({ 'pointer-events': 'none' });
  for (const r of [70, 66]) P(t, `M${w / 2 - r} ${w / 2} A${r} ${r} 0 0 1 ${w / 2 + r} ${w / 2}`, { fill: 'none', stroke: acc, 'stroke-width': r === 70 ? 1.6 : 0.6, opacity: 0.7 });
  b.edge();
  // porthole
  const cx = w / 2, cy = 56, pr = 31;
  C(g, cx, cy, pr + 4, { fill: 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.5 });
  C(g, cx, cy, pr, { fill: '#120c08' });
  C(g, cx - 10, cy, 26, { fill: haloFill('#ffb347', 0.9) });
  // lamp
  C(g, cx - 12, cy, 7.5, { fill: rad('t3-bulb', [[0, '#fff8e0'], [0.5, '#ffd27a'], [1, '#e08a2a']], 0.45, 0.4, 0.6) });
  P(g, `M${cx - 15} ${cy + 1}q1.5 -4 3 0q1.5 4 3 0`, { fill: 'none', stroke: '#8a3a10', 'stroke-width': 0.7 });
  // photocell
  C(g, cx + 13, cy, 8, { fill: '#c9a14a', stroke: '#5a4010', 'stroke-width': 0.6 });
  P(g, `M${cx + 7} ${cy - 3}h11v2h-11v2h11v2h-11`, { fill: 'none', stroke: '#b2321e', 'stroke-width': 0.9 });
  C(g, cx, cy, pr, { fill: 'url(#g-glass)' });
  for (const a of [45, 135, 225, 315]) { const [x, y] = pol(cx, cy, pr + 2, a); C(g, x, y, 1.3, { fill: '#555' }); }
  engrave(g, w / 2, 176, def.logo || 'OPTO', { size: 22, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 6 });
  typeLine(g, w / 2, 193, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, { sustain: K(40, 112, 13), level: K(110, 112, 13), blend: K(75, 128, 9.5), led: { x: 40, y: 222, r: 3 }, foot: { x: w / 2, y: 222, r: 12 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'cream' }), 112);
}

// Noise Gate: diamond-plate steel with a portcullis half-raised over a hazard stripe
function gate(ctx, def) {
  const g = ctx.g, w = 154, h = 254;
  const col = def.color || '#1b1f27', acc = def.accent || '#ffc23c', txt = def.text || '#e9ecf3';
  const b = shell(g, w, h, col, { rx: 8, mat: 'anod' });
  const plate = pattern('t3-diamond', 10, 10, (p) => {
    P(p, 'M1 4 L4 1 L5 2 L2 5Z', { fill: '#fff', opacity: 0.16 });
    P(p, 'M1.4 4.6 L4.6 1.4', { stroke: '#000', 'stroke-width': 0.6, opacity: 0.4 });
    P(p, 'M6 6 L9 9 L8 10 L5 7Z', { fill: '#fff', opacity: 0.16 });
    P(p, 'M5.6 7 L8.4 9.8', { stroke: '#000', 'stroke-width': 0.6, opacity: 0.4 });
  });
  b.shape({ fill: plate });
  const t = b.inside({ 'pointer-events': 'none' });
  // gate arch + bars
  R(t, 12, 10, w - 24, 50, { rx: 3, fill: '#07080a' });
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * ((w - 40) / 8);
    R(t, x - 2, 10, 4, 38, { fill: 'url(#g-chrome)', opacity: 0.85 });
    P(t, `M${x - 2.5} 48 L${x} 55 L${x + 2.5} 48Z`, { fill: '#c7ccd2' });
  }
  for (const y of [18, 34]) R(t, 14, y, w - 28, 3.2, { fill: 'url(#g-chrome)', opacity: 0.9 });
  R(t, 12, 60, w - 24, 6, { fill: acc });
  const hz = 't3hz' + ++seq;
  R(svg('clipPath', { id: hz }, g), 12, 60, w - 24, 6);
  const hzg = svg('g', { 'clip-path': `url(#${hz})` }, t);
  for (let i = 0; i < 14; i++) P(hzg, `M${12 + i * 10} 66 l6 -6 h4 l-6 6Z`, { fill: '#111' });
  R(g, 12, 10, w - 24, 56, { rx: 3, fill: 'none', stroke: '#000', 'stroke-opacity': 0.7 });
  b.edge();
  // recessed control deck
  R(g, 9, 74, w - 18, 92, { rx: 6, fill: '#101216', opacity: 0.9, stroke: '#000' });
  for (const [x, y] of [[9 + 5, 79], [w - 14, 79], [14, 161], [w - 14, 161]]) screw(g, x, y, 1.8);
  engrave(g, w / 2, 185, def.logo || 'GATE', { size: 22, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 8 });
  typeLine(g, w / 2 + 3, 201, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, {
    threshold: K(36, 98, 11.5), attack: K(77, 98, 11.5), decay: K(118, 98, 11.5),
    range: K(48, 140, 10), mode: { x: 108, y: 142, orient: 'h' },
    led: { x: 40, y: 224, r: 3 }, foot: { x: w / 2, y: 224, r: 12 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'mxr', toggleTitles: false }), 96, 30);
}

// Parametric EQ: console channel strip – four colour-coded band columns under a printed response curve
function consoleStrip(ctx, def) {
  const g = ctx.g, w = 206, h = 282;
  const col = def.color || '#20242d', txt = def.text || '#e9ecf3';
  const BC = ['#e8473d', '#ffc23c', '#3ddc84', '#4aa8ff'];
  const b = shell(g, w, h, col, { rx: 10, mat: 'anod' });
  b.edge();
  const xs = [34, 80, 126, 172];
  // response curve window
  const win = windowBox(g, 14, 12, w - 28, 40, { fill: '#07090c', rx: 4, bezel: '#0c0d10' });
  for (let i = 1; i < 6; i++) R(win.inner, 14 + ((w - 28) * i) / 6, 12, 0.5, 40, { fill: '#fff', opacity: 0.06 });
  R(win.inner, 14, 32, w - 28, 0.5, { fill: '#fff', opacity: 0.18 });
  const bells = [[0.12, 0.7, 0.09], [0.38, -0.55, 0.07], [0.64, 0.6, 0.06], [0.88, 0.45, 0.1]];
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const tt = i / 120;
    let v = 0;
    bells.forEach(([c, a, s]) => (v += a * Math.exp(-((tt - c) ** 2) / (2 * s * s))));
    d += (i ? 'L' : 'M') + f1(16 + tt * (w - 32)) + ' ' + f1(32 - v * 13);
  }
  bells.forEach(([c, a], i) => C(win.inner, 16 + c * (w - 32), 32 - a * 13, 2, { fill: BC[i] }));
  P(win.inner, d, { fill: 'none', stroke: '#e9ecf3', 'stroke-width': 1.1 });
  win.glass();
  // band columns
  ['LOW', 'MID 1', 'MID 2', 'HIGH'].forEach((s, i) => {
    R(g, xs[i] - 21, 62, 42, 140, { rx: 4, fill: '#000', opacity: 0.22 });
    R(g, xs[i] - 21, 62, 42, 11, { rx: 3, fill: BC[i] });
    label(g, xs[i], 67.8, s, { size: 6.2, fill: '#111', weight: 800, ls: 1 });
  });
  engrave(g, w / 2, 214, def.logo || 'PARAMETRIC', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 3 });
  typeLine(g, w / 2, 226, def, txt);
  badge(g, w / 2, h - 9, txt);
  const col3 = (i, a, b2, c, y = [94, 134, 172]) => ({ [a]: K(xs[i], y[0], 11.5, { style: 'white' }), [b2]: K(xs[i], y[1], 10, { style: 'strymon' }), [c]: K(xs[i], y[2], 9, { style: 'mxr' }) });
  put(def, Object.assign(
    col3(0, 'lowgain', 'lowfreq', 'lowcut'), col3(1, 'mid1gain', 'mid1freq', 'mid1q'), col3(2, 'mid2gain', 'mid2freq', 'mid2q'), col3(3, 'highgain', 'highfreq', 'highcut'),
    { led: { x: 50, y: 248, r: 3 }, foot: { x: w / 2, y: 248, r: 12 } }));
  return finish(ctx, def, w, h, T(txt, { labelSize: 6 }), 94, 34);
}

// Ensemble: glossy blue enamel with a rolling wave top edge and layered translucent ribbons
function wave(ctx, def) {
  const g = ctx.g, w = 198, h = 256;
  const col = def.color || '#3b82c4', acc = def.accent || '#bfe3ff', txt = def.text || '#f2f6fb';
  let top = 'M0 18';
  for (let i = 0; i <= 40; i++) top += ` L${f1((w * i) / 40)} ${f1(12 - Math.sin((i / 40) * Math.PI * 4) * 6)}`;
  const path = `${top} V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} Z`;
  const b = shell(g, w, h, col, { path, mat: 'enamel' });
  const t = b.inside({ 'pointer-events': 'none' });
  const ribbon = (y0, amp, ph, colr, op, th) => {
    let up = '', dn = '';
    for (let i = 0; i <= 36; i++) {
      const x = (w * i) / 36, a = (i / 36) * Math.PI * 3 + ph;
      up += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y0 - Math.sin(a) * amp);
      dn = `L${f1(x)} ${f1(y0 - Math.sin(a + 0.5) * amp + th)}` + dn;
    }
    P(t, up + dn + 'Z', { fill: colr, opacity: op });
  };
  ribbon(176, 7, 0, acc, 0.22, 10);
  ribbon(184, 9, 1.3, '#0d2a4a', 0.28, 12);
  ribbon(194, 6, 2.4, acc, 0.18, 14);
  R(t, 0, 206, w, 60, { fill: '#0d2a4a', opacity: 0.25 });
  b.edge();
  engrave(g, w / 2, 145, def.logo || 'ENSEMBLE', { size: 16, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 4 });
  typeLine(g, w / 2, 158, def, txt, { size: 4.8 });
  badge(g, w / 2, h - 9, txt);
  const xs = [34, 79, 124, 169];
  put(def, {
    rate: K(xs[0], 44), depth: K(xs[1], 44), mix: K(xs[2], 44), tone: K(xs[3], 44),
    delay: K(xs[0], 98), feedback: K(xs[1], 98), mode: SELO(146, 104, 11, { optSize: 4, labelRadius: 14, sweep: 150 }),
    led: { x: w / 2, y: 190, r: 3 }, foot: { x: w / 2, y: 222, r: 12.5 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'white' }), 56);
}

// Phaser 12: round metal-flake disc, twelve-arm vortex around a central footswitch, controls on a ring
function vortex(ctx, def) {
  const g = ctx.g, D = 200, w = D, h = D, cx = D / 2, cy = D / 2, Rr = D / 2 - 1;
  const col = def.color || '#e0662f', acc = def.accent || '#2a1206', txt = def.text || '#1a0d05';
  const path = `M${cx - Rr} ${cy}A${Rr} ${Rr} 0 1 0 ${cx + Rr} ${cy}A${Rr} ${Rr} 0 1 0 ${cx - Rr} ${cy}Z`;
  const b = shell(g, w, h, col, { path, mat: 'flake' });
  const t = b.inside({ 'pointer-events': 'none' });
  // vortex: 12 spiral arms (one per stage)
  for (let k = 0; k < 12; k++) {
    let d = '';
    for (let i = 0; i <= 14; i++) {
      const r = 19 + i * 2.3, a = k * 30 + i * 7;
      const [x, y] = pol(cx, cy, r, a);
      d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y);
    }
    P(t, d, { fill: 'none', stroke: acc, 'stroke-width': 2.6 - k * 0.04, opacity: 0.55, 'stroke-linecap': 'round' });
  }
  C(t, cx, cy, 52, { fill: 'none', stroke: acc, 'stroke-width': 0.8, opacity: 0.45 });
  C(t, cx, cy, Rr - 6, { fill: 'none', stroke: '#fff', 'stroke-width': 0.7, opacity: 0.3 });
  b.edge();
  engrave(g, cx, 163, def.logo || 'PHASER 12', { size: 12, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.4 });
  typeLine(g, cx, 174, def, txt, { size: 4.2, ls: 1 });
  badge(g, cx, 188, txt, 4);
  const ring = (a, o = {}) => { const [x, y] = pol(cx, cy, 70, a); return K(f1(x), f1(y), 11, o); };
  put(def, {
    rate: ring(-62), depth: ring(-24, { labelPos: 'above' }), feedback: ring(24, { labelPos: 'above' }), mix: ring(62),
    center: ring(120), stages: Object.assign(ring(-120), { labelPos: 'below', optSize: 4.2, labelRadius: 6.5 }),
    led: { x: cx, y: 142, r: 2.8 }, foot: { x: cx, y: cy, r: 13 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'mxr' }), 113, 28);
}

// Harmonic Trem: 50s appliance capsule – seafoam enamel, chrome belt line, AM-envelope scope, script logo
function capsule(ctx, def) {
  const g = ctx.g, w = 162, h = 256;
  const col = def.color || '#1f5d4a', acc = def.accent || '#9be7c8', txt = def.text || '#eaf6f1';
  const b = shell(g, w, h, col, { rx: 36, mat: 'enamel' });
  const t = b.inside({ 'pointer-events': 'none' });
  R(t, 0, 152, w, 9, { fill: 'url(#g-chrome)' });
  R(t, 0, 155, w, 1, { fill: '#000', opacity: 0.35 });
  b.edge();
  // amplitude envelope window
  const win = windowBox(g, 30, 14, w - 60, 34, { rx: 15, fill: '#0b1d17', bezel: 'url(#g-chrome)' });
  let up = '', sig = '';
  for (let i = 0; i <= 120; i++) {
    const x = 34 + (i / 120) * (w - 68);
    const env = 0.55 + 0.45 * Math.sin((i / 120) * Math.PI * 4);
    up += (i ? 'L' : 'M') + f1(x) + ' ' + f1(31 - env * 12);
    sig += (i ? 'L' : 'M') + f1(x) + ' ' + f1(31 - env * 12 * Math.sin(i * 1.3));
  }
  P(win.inner, sig, { fill: 'none', stroke: acc, 'stroke-width': 0.6, opacity: 0.6 });
  P(win.inner, up, { fill: 'none', stroke: acc, 'stroke-width': 1.3 });
  win.glass();
  engrave(g, w / 2, 184, def.logo ? def.logo.charAt(0) + def.logo.slice(1).toLowerCase() : 'Tremolo', { size: 24, fill: txt, font: "'Dancing Script', cursive", weight: 700, ls: 0.4 });
  typeLine(g, w / 2, 202, def, txt, { size: 4.6, ls: 1.1 });
  badge(g, w / 2, h - 10, txt);
  put(def, {
    rate: K(40, 76), depth: K(81, 76), wave: K(122, 76),
    level: K(36, 124, 10), mode: SELO(81, 126, 10, { optSize: 4.2, labelRadius: 7 }), stereo: { x: 128, y: 128, orient: 'h' },
    led: { x: 46, y: 222, r: 3 }, foot: { x: w / 2, y: 222, r: 12 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'cream' }), 80);
}

// Rotary: walnut cabinet, louvred horn chamber with the double horn mid-spin
function leslie(ctx, def) {
  const g = ctx.g, w = 178, h = 266;
  const col = def.color || '#5a3a24', acc = def.accent || '#d9b77a', txt = def.text || '#f2e6d6';
  const b = shell(g, w, h, col, { rx: 9, mat: 'wood' });
  woodGrain(b.inside({ 'pointer-events': 'none' }), w, h, col);
  b.shape({ fill: gloss(), opacity: 0.8 });
  b.edge();
  // horn chamber
  const x0 = 14, y0 = 12, cw = w - 28, chh = 84;
  const win = windowBox(g, x0, y0, cw, chh, { rx: 5, fill: '#120b06', bezel: shade(col, -0.45) });
  for (let i = 0; i < 12; i++) R(win.inner, x0, y0 + 3 + i * 7, cw, 3.4, { fill: '#2a1a0f' });
  const hx = w / 2, hy = y0 + chh / 2;
  // motion swirl
  for (const [r, a0, op] of [[34, -40, 0.5], [30, 140, 0.5], [38, 150, 0.25], [42, -30, 0.25]]) {
    const [sx, sy] = pol(hx, hy, r, a0), [ex, ey] = pol(hx, hy, r, a0 + 70);
    P(win.inner, `M${f1(sx)} ${f1(sy)}A${r} ${r * 0.62} 0 0 1 ${f1(ex)} ${f1(ey)}`, { fill: 'none', stroke: acc, 'stroke-width': 1.2, opacity: op, 'stroke-linecap': 'round' });
  }
  // double horn (one real, one dummy), slight perspective
  const horn = (dir) => P(win.inner, `M${hx} ${hy - 3} L${hx + dir * 36} ${hy - 12} Q${hx + dir * 46} ${hy} ${hx + dir * 36} ${hy + 12} L${hx} ${hy + 3}Z`, { fill: lin('t3-horn', [[0, '#3a3d42'], [0.5, '#16171a'], [1, '#2a2c30']]), stroke: '#000', 'stroke-width': 0.6 });
  horn(1); horn(-1);
  svg('ellipse', { cx: hx + 37, cy: hy, rx: 4, ry: 11, fill: '#050505' }, win.inner);
  svg('ellipse', { cx: hx - 37, cy: hy, rx: 4, ry: 11, fill: '#050505' }, win.inner);
  C(win.inner, hx, hy, 8, { fill: 'url(#g-chromeR)' });
  C(win.inner, hx, hy, 2.4, { fill: '#222' });
  win.glass();
  engrave(g, w / 2, 203, def.logo || 'ROTARY', { size: 17, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 6 });
  typeLine(g, w / 2, 216, def, txt, { size: 4.6 });
  badge(g, w / 2, h - 9, txt);
  put(def, {
    drive: K(36, 122), balance: K(89, 122), accel: K(142, 122),
    mix: K(62, 164, 10.5), level: K(116, 164, 10.5),
    led: { x: 42, y: 234, r: 3 }, foot: { x: w / 2, y: 234, r: 12 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'chicken' }), 122);
}

// Ring Thing: purple bakelite cathedral radio – fan dial, tuning knob, grille cloth with the footswitch
function radio(ctx, def) {
  const g = ctx.g, w = 162, h = 256;
  const col = def.color || '#6b2d8f', acc = def.accent || '#ffcf7a', txt = def.text || '#f2e8f8';
  const path = `M0 56 A${w / 2} 54 0 0 1 ${w} 56 V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} Z`;
  const b = shell(g, w, h, col, { path, mat: 'enamel' });
  const t = b.inside({ 'pointer-events': 'none' });
  // fluted side columns
  for (const x of [5, 9, w - 9, w - 5]) R(t, x - 1, 40, 2, h - 52, { rx: 1, fill: '#000', opacity: 0.18 });
  b.edge();
  // fan dial
  const dx = w / 2, dy = 74, dr = 50;
  const [lx, ly] = pol(dx, dy, dr, -62), [rx2, ry] = pol(dx, dy, dr, 62);
  P(g, `M${dx} ${dy} L${f1(lx)} ${f1(ly)} A${dr} ${dr} 0 0 1 ${f1(rx2)} ${f1(ry)} Z`, { fill: 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.5 });
  const [lx2, ly2] = pol(dx, dy, dr - 3, -60), [rx3, ry3] = pol(dx, dy, dr - 3, 60);
  P(g, `M${dx} ${dy - 2} L${f1(lx2)} ${f1(ly2)} A${dr - 3} ${dr - 3} 0 0 1 ${f1(rx3)} ${f1(ry3)} Z`, { fill: rad('t3-dial', [[0, '#fff3d0'], [1, '#f0c06a']], 0.5, 0.9, 0.9) });
  ['20', '50', '100', '300', '1k', '2k'].forEach((s, i) => {
    const a = -50 + i * 20;
    const [x1, y1] = pol(dx, dy, dr - 4, a), [x2, y2] = pol(dx, dy, dr - 9, a), [tx, ty] = pol(dx, dy, dr - 15, a);
    P(g, `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`, { stroke: '#3a1e05', 'stroke-width': 0.8 });
    label(g, tx, ty, s, { size: 4.6, fill: '#3a1e05', weight: 700 });
  });
  for (let a = -50; a <= 50; a += 4) { const [x1, y1] = pol(dx, dy, dr - 4, a), [x2, y2] = pol(dx, dy, dr - 6, a); P(g, `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`, { stroke: '#3a1e05', 'stroke-width': 0.4 }); }
  label(g, dx, dy - 22, 'Hz', { size: 4.6, fill: '#3a1e05', weight: 700 });
  const [nx, ny] = pol(dx, dy, dr - 3, 14);
  P(g, `M${f1(dx + (nx - dx) * 0.45)} ${f1(dy + (ny - dy) * 0.45)}L${f1(nx)} ${f1(ny)}`, { stroke: '#d0201a', 'stroke-width': 1.2 });
  // grille cloth + slats
  const gy = 168, gh = 76;
  R(g, 16, gy, w - 32, gh, { rx: 8, fill: 'url(#p-grille-wheat)', stroke: '#000', 'stroke-opacity': 0.5 });
  R(g, 16, gy, w - 32, gh, { rx: 8, fill: 'url(#g-shadeV)', opacity: 0.6 });
  for (const x of [34, w - 34]) R(g, x - 2.5, gy, 5, gh, { fill: col, stroke: '#000', 'stroke-opacity': 0.3 });
  engrave(g, w / 2, 145, def.logo || 'RING MOD', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 3 });
  typeLine(g, w / 2, 157, def, txt, { size: 4.6 });
  badge(g, w / 2, h - 5.5, txt, 3.8);
  put(def, {
    freq: K(w / 2, 102, 15, { style: 'cream' }), fine: K(28, 104, 10), mix: K(w - 28, 104, 10),
    led: { x: w / 2, y: 180, r: 3 }, foot: { x: w / 2, y: 214, r: 12 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'cream' }), 104);
}

// Bit Crusher: pixel LCD behind cracked glass, pixel-font logo
const PIX = { '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'] };
function pixelText(g, x, y, str, px, fill) {
  let d = '';
  const chars = [...str.toUpperCase()].filter((c) => PIX[c]);
  const total = chars.length * 6 * px - px;
  let cx = x - total / 2;
  for (const ch of chars) {
    PIX[ch].forEach((row, r) => [...row].forEach((b2, c) => { if (b2 === '1') d += `M${f1(cx + c * px)} ${f1(y + r * px)}h${px - 0.4}v${px - 0.4}h${-(px - 0.4)}Z`; }));
    cx += 6 * px;
  }
  P(g, d, { fill });
}
function glassCrush(ctx, def) {
  const g = ctx.g, w = 150, h = 252;
  const col = def.color || '#2fbf71', acc = def.accent || '#b8ff3c', txt = def.text || '#06140c';
  const b = shell(g, w, h, col, { rx: 6, mat: 'enamel' });
  const grid = pattern('t3-pixgrid', 6, 6, (p) => R(p, 0, 0, 5.2, 5.2, { fill: '#000', opacity: 0.07 }));
  b.shape({ fill: grid, 'pointer-events': 'none' });
  b.edge();
  // LCD
  const x0 = 14, y0 = 14, lw = w - 28, lh = 66;
  const win = windowBox(g, x0, y0, lw, lh, { rx: 3, fill: '#0c1a10', bezel: '#0a0c0b' });
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const v = Math.round(Math.sin((i / steps) * Math.PI * 2) * 3) / 3;
    R(win.inner, x0 + 4 + (i * (lw - 8)) / steps, y0 + lh / 2 - v * 22 - 2.5, (lw - 8) / steps - 1, 5, { fill: acc, opacity: 0.9 });
  }
  for (let i = 1; i < 7; i++) R(win.inner, x0, y0 + (lh * i) / 7, lw, 0.4, { fill: acc, opacity: 0.12 });
  // cracks: impact point + radial cracks + a ring
  const ix = x0 + lw * 0.7, iy = y0 + lh * 0.32;
  const cracks = [[-160, 46], [-110, 30], [-60, 40], [-10, 24], [35, 36], [80, 30], [130, 44], [190, 28]];
  let cd = '';
  for (const [a, L] of cracks) {
    let px = ix, py = iy;
    cd += `M${f1(px)} ${f1(py)}`;
    for (let s = 1; s <= 3; s++) { const [nx, ny] = pol(ix, iy, (L * s) / 3, a + (s % 2 ? 7 : -6)); cd += `L${f1(nx)} ${f1(ny)}`; px = nx; py = ny; }
  }
  P(win.inner, cd, { fill: 'none', stroke: '#fff', 'stroke-width': 0.7, opacity: 0.75, 'stroke-linejoin': 'round' });
  let rd = '';
  cracks.forEach(([a], i) => { const [x, y] = pol(ix, iy, i % 2 ? 9 : 12, a + 3); rd += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); });
  P(win.inner, rd + 'Z', { fill: '#fff', 'fill-opacity': 0.08, stroke: '#fff', 'stroke-width': 0.6, opacity: 0.7 });
  P(win.inner, `M${f1(ix - 30)} ${f1(iy + 10)}L${f1(ix - 22)} ${f1(iy + 30)}L${f1(ix - 8)} ${f1(iy + 22)}Z`, { fill: '#fff', opacity: 0.1 });
  win.glass();
  pixelText(g, w / 2, 168, def.logo || '8-BIT', 2.6, txt);
  typeLine(g, w / 2, 194, def, txt, { size: 4.6, font: "'Share Tech Mono', monospace", weight: 400, ls: 0.8, opacity: 0.85 });
  badge(g, w / 2, h - 9, txt);
  put(def, { bits: K(40, 106, 13), rate: K(110, 106, 13), mix: K(75, 132, 9.5), led: { x: 40, y: 220, r: 3 }, foot: { x: w / 2, y: 220, r: 12 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'mxr' }), 106);
}

// Envelope Funk: 70s sunshine-yellow, swooping racing bands and a resonant peak
function funk(ctx, def) {
  const g = ctx.g, w = 172, h = 254;
  const col = def.color || '#f2c12e', txt = def.text || '#1a1405';
  const bands = def.art?.bands || ['#e8662a', '#b8331d', '#5a2a12'];
  const b = shell(g, w, h, col, { rx: 16, mat: 'enamel' });
  const t = b.inside({ 'pointer-events': 'none' });
  bands.forEach((c, i) => {
    const o = i * 10;
    P(t, `M-10 ${174 + o} C ${w * 0.35} ${174 + o} ${w * 0.55} ${h - 26 + o * 0.3} ${w + 10} ${h - 66 + o}  V${h - 56 + o} C ${w * 0.55} ${h - 16 + o * 0.3} ${w * 0.35} ${184 + o} -10 ${184 + o} Z`, { fill: c, opacity: 0.92 });
  });
  b.edge();
  // resonant peak
  let d = '';
  for (let i = 0; i <= 60; i++) { const tt = i / 60; const v = 1 / Math.sqrt((1 - (tt / 0.55) ** 2) ** 2 + (tt / 0.55 / 4) ** 2); d += (i ? 'L' : 'M') + f1(20 + tt * (w - 40)) + ' ' + f1(138 - Math.min(v, 4.2) * 3); }
  P(g, d, { fill: 'none', stroke: txt, 'stroke-width': 1.2, opacity: 0.75 });
  engrave(g, w / 2, 160, def.logo || 'ENV FILTER', { size: 17, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.2, italic: true });
  label(g, w / 2, 233, (def.typeName || '').toUpperCase(), { size: 4.8, fill: '#fff4d6', weight: 800, ls: 1.4 });
  badge(g, w / 2, h - 9, '#fff4d6');
  put(def, {
    sens: K(36, 44, 12), q: K(86, 44, 12), range: K(136, 44, 12),
    level: K(36, 94, 10.5), filter: SELO(86, 96, 10.5, { optSize: 4.6, labelRadius: 7 }), direction: { x: 136, y: 98, orient: 'h' },
    led: { x: 50, y: 204, r: 3 }, foot: { x: w / 2, y: 204, r: 12.5 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'mxr' }), 56);
}

// Auto Wah: hot-pink comic panel, halftone dots and a "wah-wah" speech bubble
function bubble(ctx, def) {
  const g = ctx.g, w = 152, h = 252;
  const col = def.color || '#d14b8f', txt = def.text || '#ffffff';
  const b = shell(g, w, h, col, { rx: 12, mat: 'enamel' });
  const dots = pattern('t3-halftone', 6, 6, (p) => { C(p, 1.5, 1.5, 1.1, { fill: '#000', opacity: 0.18 }); C(p, 4.5, 4.5, 1.1, { fill: '#000', opacity: 0.18 }); });
  const t = b.inside({ 'pointer-events': 'none' });
  R(t, 0, 166, w, h - 166, { fill: dots });
  b.edge();
  // speech bubble
  P(g, `M22 12 H130 Q142 12 142 24 V56 Q142 68 130 68 H70 L52 82 L56 68 H22 Q10 68 10 56 V24 Q10 12 22 12Z`, { fill: '#fffdf5', stroke: '#111', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
  const words = [['wah', 10, 34, -8], ['WAH', 15, 73, 4], ['wah', 10, 114, -6]];
  for (const [s, sz, x, rot] of words) {
    label(g, x + 1, 41, s, { size: sz, fill: '#111', font: "'Oswald', sans-serif", weight: 700, transform: `rotate(${rot} ${x} 40)` });
    label(g, x, 40, s, { size: sz, fill: '#d14b8f', font: "'Oswald', sans-serif", weight: 700, transform: `rotate(${rot} ${x} 40)` });
  }
  P(g, 'M24 56 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0', { fill: 'none', stroke: '#111', 'stroke-width': 1, opacity: 0.6 });
  engrave(g, w / 2, 182, def.logo || 'AUTO WAH', { size: 16, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.4 });
  typeLine(g, w / 2, 195, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, { rate: K(42, 100, 12), q: K(110, 100, 12), range: K(42, 140, 11), level: K(110, 140, 11), led: { x: 40, y: 222, r: 3 }, foot: { x: w / 2, y: 222, r: 12 } });
  // LFO glyph between the knobs
  P(g, `M66 120 q4.5 -9 9 0 t9 0`, { fill: 'none', stroke: txt, 'stroke-width': 1.3, opacity: 0.8, 'stroke-linecap': 'round' });
  return finish(ctx, def, w, h, T(txt, { knob: 'white' }), 104);
}

// Multi Delay: navy hammertone tape-echo unit – tape loop around capstan, heads and a serpentine bin
function echo(ctx, def) {
  const g = ctx.g, w = 216, h = 270;
  const col = def.color || '#1f3347', acc = def.accent || '#ff7a2f', txt = def.text || '#e9f1fb';
  const b = shell(g, w, h, col, { rx: 10, mat: 'hammer' });
  b.edge();
  const x0 = 12, y0 = 12, cw = w - 24, chh = 74;
  const win = windowBox(g, x0, y0, cw, chh, { rx: 5, fill: '#0d1116', bezel: '#0b0d10' });
  const I = win.inner;
  // tape path
  const tape = { fill: 'none', stroke: '#6b4425', 'stroke-width': 2.2, 'stroke-linejoin': 'round' };
  const ly = y0 + 60;
  P(I, `M${x0 + 20} ${ly} H${x0 + 128} Q${x0 + 140} ${ly} ${x0 + 142} ${ly - 10} L${x0 + 146} ${y0 + 18} Q${x0 + 148} ${y0 + 10} ${x0 + 156} ${y0 + 10} H${x0 + 170} Q${x0 + 180} ${y0 + 10} ${x0 + 180} ${y0 + 20} V${y0 + 40}`, tape);
  // serpentine storage bin
  let s = `M${x0 + 180} ${y0 + 40}`;
  for (let i = 0; i < 6; i++) s += ` Q${x0 + 180 - (i % 2 ? -6 : 6)} ${y0 + 44 + i * 3} ${x0 + 180} ${y0 + 47 + i * 3}`;
  P(I, s, Object.assign({}, tape, { 'stroke-width': 1.6 }));
  P(I, `M${x0 + 20} ${ly} Q${x0 + 8} ${ly} ${x0 + 8} ${ly - 12} V${y0 + 20} Q${x0 + 8} ${y0 + 10} ${x0 + 18} ${y0 + 10} H${x0 + 128}`, tape);
  // rollers
  for (const [x, y, r] of [[x0 + 18, y0 + 10, 5], [x0 + 130, y0 + 10, 4], [x0 + 158, y0 + 10, 4]]) { C(I, x, y + 0.5, r, { fill: 'url(#g-chromeR)' }); C(I, x, y + 0.5, 1.4, { fill: '#222' }); }
  C(I, x0 + 128, ly - 2, 6, { fill: '#1a1a1a', stroke: '#555', 'stroke-width': 0.6 }); // pinch roller
  C(I, x0 + 128, ly - 2, 2.4, { fill: 'url(#g-chromeR)' }); // capstan
  // heads: erase, record, 3 playback
  const heads = [['E', 28, '#8a8f97'], ['R', 46, acc], ['1', 68, '#c7ccd2'], ['2', 88, '#c7ccd2'], ['3', 108, '#c7ccd2']];
  for (const [n, x, c] of heads) {
    R(I, x0 + x - 5, ly - 1, 10, 9, { rx: 1.5, fill: c === acc ? acc : 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.5 });
    R(I, x0 + x - 0.5, ly - 1, 1, 3, { fill: '#111' });
    label(I, x0 + x, ly - 9, n === 'E' || n === 'R' ? n : 'P' + n, { size: 4.4, fill: n === 'R' ? acc : '#b8c2cc', weight: 800 });
  }
  label(I, x0 + 64, y0 + 30, 'ECHO · CONTINUOUS LOOP', { size: 4.6, fill: '#8fa2b5', weight: 800, ls: 1 });
  win.glass();
  engrave(g, 20, 210, def.logo || 'MULTI DELAY', { size: 15, fill: txt, anchor: 'start', font: "'Oswald', sans-serif", weight: 700, ls: 2.4 });
  typeLine(g, 20, 222, def, txt, { anchor: 'start', size: 4.6 });
  badge(g, w / 2, h - 9, txt);
  const xs = [34, 82, 132, 182];
  put(def, {
    time: K(xs[0], 108, 12.5), feedback: K(xs[1], 108, 12), mix: K(xs[2], 108, 12), tone: K(xs[3], 108, 12),
    modrate: K(xs[0], 160, 10), moddepth: K(xs[1], 160, 10),
    mode: SELO(132, 162, 11, { optSize: 4, labelRadius: 7, labelPos: 'none' }), subdiv: SELO(186, 166, 9.5, { optSize: 4.2, labelRadius: 6.5, labelPos: 'none' }),
    led: { x: 150, y: 236, r: 3 }, foot: { x: 182, y: 236, r: 12.5 },
  });
  label(g, 132, 190, 'MODE', { size: 6, fill: txt, weight: 700, ls: 0.5, font: "'Barlow Condensed', sans-serif" });
  label(g, 186, 186, 'TAP DIV', { size: 6, fill: txt, weight: 700, ls: 0.5, font: "'Barlow Condensed', sans-serif" });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 108);
}

// Hall of Fame: pointed gothic arch with a stained-glass rose window around the MODE selector
function cathedral(ctx, def) {
  const g = ctx.g, w = 202, h = 300;
  const col = def.color || '#2b2140', txt = def.text || '#efe9fb';
  const path = `M0 ${h - 12} V100 C0 52 52 16 ${w / 2} 0 C${w - 52} 16 ${w} 52 ${w} 100 V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} Z`;
  const b = shell(g, w, h, col, { path, mat: 'crinkle' });
  const t = b.inside({ 'pointer-events': 'none' });
  // inner arch moulding
  P(t, `M10 ${h} V104 C10 60 56 28 ${w / 2} 13 C${w - 56} 28 ${w - 10} 60 ${w - 10} 104 V${h}`, { fill: 'none', stroke: '#fff', 'stroke-width': 0.8, opacity: 0.22 });
  P(t, `M14 ${h} V106 C14 64 58 32 ${w / 2} 18 C${w - 58} 32 ${w - 14} 64 ${w - 14} 106 V${h}`, { fill: 'none', stroke: '#000', 'stroke-width': 0.8, opacity: 0.4 });
  b.edge();
  // rose window
  const cx = w / 2, cy = 76, R1 = 26, R2 = 47;
  const GL = ['#2346a8', '#8a1c3a', '#e0a62a', '#5a2a9a', '#1f7a6a', '#c0421f'];
  C(g, cx, cy, R2 + 3, { fill: '#0b0910', stroke: '#c9b48a', 'stroke-width': 1.4 });
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n + 2, a1 = ((i + 1) * 360) / n - 2, am = (a0 + a1) / 2;
    const [x0, y0] = pol(cx, cy, R1 + 2, a0), [x1, y1] = pol(cx, cy, R1 + 2, a1), [xm, ym] = pol(cx, cy, R2 + 1, am);
    const [c0x, c0y] = pol(cx, cy, R2 + 2, a0 + 3), [c1x, c1y] = pol(cx, cy, R2 + 2, a1 - 3);
    const c = GL[i % GL.length];
    P(g, `M${f1(x0)} ${f1(y0)} Q${f1(c0x)} ${f1(c0y)} ${f1(xm)} ${f1(ym)} Q${f1(c1x)} ${f1(c1y)} ${f1(x1)} ${f1(y1)} Z`, { fill: rad('t3-glass' + keyOf(c), [[0, shade(c, 0.45)], [1, c]], 0.5, 0.3, 0.8), stroke: '#0b0910', 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
  }
  C(g, cx, cy, R1 + 1, { fill: '#100c18', stroke: '#c9b48a', 'stroke-width': 1 });
  C(g, cx, cy, R2 + 3, { fill: rad('t3-roseglow', [[0, '#fff', 0], [0.7, '#fff', 0], [1, '#fff', 0.12]]), 'pointer-events': 'none' });
  engrave(g, w / 2, 236, def.logo || 'REVERB', { size: 17, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 7 });
  typeLine(g, w / 2, 249, def, txt, { size: 4.4, ls: 1 });
  badge(g, w / 2, h - 7, txt, 3.8);
  const xs = [32, 77, 125, 170];
  put(def, {
    mode: SELO(cx, cy, 10.5, { optSize: 3.7, labelRadius: 6.4, labelPos: 'none', style: 'chrome' }),
    decay: K(xs[0], 152), mix: K(xs[1], 152), predelay: K(xs[2], 152), tone: K(xs[3], 152),
    lowcut: K(xs[0], 198, 10.5), mod: K(xs[1], 198, 10.5), size: K(xs[2], 198, 10.5), shimmer: K(xs[3], 198, 10.5),
    led: { x: 46, y: 270, r: 3 }, foot: { x: w / 2, y: 270, r: 12 },
  });
  label(g, cx, 132, 'MODE', { size: 6, fill: txt, weight: 700, ls: 1.4, opacity: 0.85 });
  return finish(ctx, def, w, h, T(txt, { knob: 'strymon' }), 152, 30, [{ ps: ['mode'], theme: { text: '#f2e7c9' } }]);
}

// '63 Spring Tank: brown tolex outboard reverb, window onto the pan and its three coiled springs
function tank(ctx, def) {
  const g = ctx.g, w = 158, h = 254;
  const col = def.color || '#3a2a1a', acc = def.accent || '#e8d7b0', txt = def.text || '#efe0c8';
  const b = shell(g, w, h, col, { rx: 10, mat: 'tolex' });
  b.edge();
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) C(g, x ? x - 8 : 8, y ? y - 8 : 8, 5.5, { fill: 'url(#g-chromeR)', opacity: 0.9 });
  // tank window
  const x0 = 16, y0 = 16, tw = w - 32, th = 64;
  const win = windowBox(g, x0, y0, tw, th, { rx: 3, fill: lin('t3-pan', [[0, '#9aa0a8'], [1, '#5d636b']]) });
  const I = win.inner;
  R(I, x0, y0, tw, th, { fill: 'url(#p-brushed)' });
  for (const x of [x0 + 6, x0 + tw - 22]) { R(I, x, y0 + 8, 16, th - 16, { rx: 2, fill: '#1c1d20' }); R(I, x + 3, y0 + 12, 10, th - 24, { rx: 1, fill: '#3a2e1c' }); }
  [y0 + 18, y0 + 32, y0 + 46].forEach((sy) => {
    let d = `M${x0 + 22} ${sy}`;
    const n = 30, L = tw - 44;
    for (let i = 1; i <= n; i++) d += ` L${f1(x0 + 22 + (L * i) / n)} ${f1(sy + (i % 2 ? -3.2 : 3.2))}`;
    P(I, d, { fill: 'none', stroke: '#e8ecf0', 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
    P(I, d, { fill: 'none', stroke: '#3a3f45', 'stroke-width': 0.4, transform: 'translate(0.6 0.8)' });
  });
  label(I, x0 + tw / 2, y0 + th - 5, 'TYPE 4 · 3 SPRING', { size: 4, fill: '#1c1d20', weight: 800, ls: 1 });
  win.glass();
  // cream control panel
  R(g, 24, 92, w - 48, 58, { rx: 4, fill: acc, stroke: '#000', 'stroke-opacity': 0.45 });
  R(g, 24, 92, w - 48, 58, { rx: 4, fill: 'url(#g-shadeV)', opacity: 0.4 });
  engrave(g, w / 2, 176, def.logo || "'63 SPRING", { size: 22, fill: txt, font: "'Dancing Script', cursive", weight: 700, ls: 0.4 });
  typeLine(g, w / 2, 195, def, txt);
  badge(g, w / 2, h - 10, txt);
  put(def, { mix: K(46, 117, 11), decay: K(79, 117, 11), tone: K(112, 117, 11), led: { x: 44, y: 220, r: 3 }, foot: { x: w / 2, y: 220, r: 12 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'chicken' }), 118, 28, [{ ps: ['mix', 'decay', 'tone'], theme: { text: '#3a2410' } }]);
}

// Celestial: opal crystal with faceted top and a constellation
function crystal(ctx, def) {
  const g = ctx.g, w = 164, h = 258;
  const col = def.color || '#e8eef8', acc = def.accent || '#7b8fd9', txt = def.text || '#25324a';
  const path = `M28 0 H${w - 28} L${w} 34 V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} V34 Z`;
  const b = shell(g, w, h, col, { path, mat: 'pearl' });
  const t = b.inside({ 'pointer-events': 'none' });
  // facets
  const fc = [[`M28 0 L${w / 2} 30 L0 34Z`, '#b9c6f2', 0.5], [`M28 0 H${w - 28} L${w / 2} 30Z`, '#ffffff', 0.6], [`M${w - 28} 0 L${w} 34 L${w / 2} 30Z`, '#e3c9ef', 0.55], [`M0 34 L${w / 2} 30 L${w} 34 L${w} 40 L${w / 2} 36 L0 40Z`, '#9fb0e8', 0.35]];
  for (const [d, c, o] of fc) P(t, d, { fill: c, 'fill-opacity': o, stroke: '#fff', 'stroke-opacity': 0.8, 'stroke-width': 0.7 });
  P(t, `M${w / 2} 30 L60 0 M${w / 2} 30 L${w - 60} 0`, { stroke: '#fff', 'stroke-width': 0.6, opacity: 0.8 });
  P(t, `M0 34 L${w / 2} 30 L${w} 34`, { fill: 'none', stroke: acc, 'stroke-width': 0.8, opacity: 0.6 });
  b.edge();
  // constellation
  const stars = [[30, 54, 1.8], [56, 46, 2.6], [82, 60, 1.6], [108, 48, 3.2], [134, 58, 2]];
  P(g, 'M' + stars.map(([x, y]) => `${x} ${y}`).join(' L'), { fill: 'none', stroke: acc, 'stroke-width': 0.6, opacity: 0.6, 'stroke-dasharray': '1.5 1.5' });
  for (const [x, y, r] of stars) {
    C(g, x, y, r * 3, { fill: haloFill('#9fb4ff', 0.6) });
    P(g, `M${x} ${y - r * 2}L${x + r * 0.45} ${y - r * 0.45}L${x + r * 2} ${y}L${x + r * 0.45} ${y + r * 0.45}L${x} ${y + r * 2}L${x - r * 0.45} ${y + r * 0.45}L${x - r * 2} ${y}L${x - r * 0.45} ${y - r * 0.45}Z`, { fill: '#fff', stroke: acc, 'stroke-width': 0.4 });
  }
  engrave(g, w / 2, 182, def.logo || 'CELESTIAL', { size: 14, fill: txt, font: "'Inter', sans-serif", weight: 600, ls: 4.4 });
  typeLine(g, w / 2, 195, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, { decay: K(46, 94, 12.5), mix: K(118, 94, 12.5), shimmer: K(46, 142, 11.5), tone: K(118, 142, 11.5), led: { x: 44, y: 226, r: 3 }, foot: { x: w / 2, y: 226, r: 12 } });
  // octave-up glyph in the middle
  P(g, `M${w / 2} 128 v-16 m-5 5 l5 -5 l5 5`, { fill: 'none', stroke: acc, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  label(g, w / 2, 134, '+12', { size: 5, fill: acc, weight: 800 });
  return finish(ctx, def, w, h, T(txt, { knob: 'white' }), 94, 30);
}

// Pitch Lab: stepped top (rising semitones), a music staff with the chord the voices make
function staff(ctx, def) {
  const g = ctx.g, w = 202, h = 262;
  const col = def.color || '#2a1c3f', txt = def.text || '#efe6ff';
  const V1 = def.art?.v1 || '#37d6c2', V2 = def.art?.v2 || '#ff6fa8';
  const path = `M0 ${h - 12} V24 Q0 16 8 16 H60 V10 H128 V4 H${w - 8} Q${w} 4 ${w} 12 V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} Z`;
  const b = shell(g, w, h, col, { path, mat: 'anod' });
  b.edge();
  // staff
  const sx = 16, sw = w - 32, sy = 30;
  for (let i = 0; i < 5; i++) R(g, sx, sy + i * 5, sw, 0.6, { fill: txt, opacity: 0.5 });
  label(g, sx + 7, sy + 10, '𝄞', { size: 26, fill: txt, font: 'serif', weight: 400, opacity: 0.85 });
  const note = (x, y, c, stemUp = true) => {
    svg('ellipse', { cx: x, cy: y, rx: 3.6, ry: 2.6, fill: c, transform: `rotate(-20 ${x} ${y})` }, g);
    P(g, stemUp ? `M${x + 3.3} ${y - 0.5}V${y - 16}` : `M${x - 3.3} ${y + 0.5}V${y + 16}`, { stroke: c, 'stroke-width': 0.9 });
  };
  const chord = (x, ys) => { note(x, ys[0], txt); note(x + 0.5, ys[1], V1, false); note(x, ys[2], V2); };
  chord(70, [sy + 12.5, sy + 22.5, sy + 5]);
  chord(112, [sy + 10, sy + 17.5, sy + 0]);
  chord(154, [sy + 7.5, sy + 20, sy - 2.5]);
  R(g, sx + sw - 1, sy, 1.2, 20.6, { fill: txt, opacity: 0.6 });
  // voice columns
  for (const [x, c, s] of [[38, V1, 'VOICE 1'], [94, V2, 'VOICE 2']]) {
    R(g, x - 24, 70, 48, 104, { rx: 5, fill: '#000', opacity: 0.22 });
    R(g, x - 24, 70, 48, 3, { rx: 1.5, fill: c });
  }
  engrave(g, w / 2, 196, def.logo || 'PITCH LAB', { size: 16, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 3.4 });
  typeLine(g, w / 2, 209, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, {
    semis1: K(38, 98, 12.5, { style: 'white' }), level1: K(38, 146, 10.5), semis2: K(94, 98, 12.5, { style: 'white' }), level2: K(94, 146, 10.5),
    dry: K(144, 98, 10.5), cents: K(144, 146, 10.5), quality: SELO(180, 124, 8.5, { optSize: 4, labelRadius: 6, labelPos: 'none' }),
    led: { x: 50, y: 230, r: 3 }, foot: { x: w / 2, y: 230, r: 12 },
  });
  label(g, 180, 142, 'LATENCY', { size: 5.6, fill: txt, weight: 700, ls: 0.3, font: "'Barlow Condensed', sans-serif" });
  return finish(ctx, def, w, h, T(txt, { knob: 'strymon' }), 98);
}

// Mini Looper: black crinkle, glowing loop-arrow ring around the footswitch
function loopRing(ctx, def) {
  const g = ctx.g, w = 150, h = 252;
  const col = def.color || '#14161b', acc = def.accent || '#ff7a2f', txt = def.text || '#e9ecf3';
  const b = shell(g, w, h, col, { rx: 12, mat: 'crinkle' });
  b.edge();
  const cx = w / 2, cy = 196, r = 30;
  C(g, cx, cy, r + 7, { fill: haloFill(acc, 0.35) });
  const [ax, ay] = pol(cx, cy, r, 330), [bx, by] = pol(cx, cy, r, 20);
  P(g, `M${f1(bx)} ${f1(by)} A${r} ${r} 0 1 1 ${f1(ax)} ${f1(ay)}`, { fill: 'none', stroke: acc, 'stroke-width': 3.4, 'stroke-linecap': 'round' });
  const [hx, hy] = pol(cx, cy, r, 342);
  P(g, `M${f1(hx - 6)} ${f1(hy - 5)} L${f1(hx + 4)} ${f1(hy - 1)} L${f1(hx - 4)} ${f1(hy + 6)} Z`, { fill: acc, transform: `rotate(-30 ${f1(hx)} ${f1(hy)})` });
  for (const [s, a] of [['REC', 270], ['DUB', 90]]) { const [x, y] = pol(cx, cy, r + 12, a); label(g, x, y, s, { size: 5, fill: txt, weight: 800, ls: 0.6, opacity: 0.8 }); }
  engrave(g, w / 2, 134, def.logo || 'MINI LOOP', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.6 });
  typeLine(g, w / 2, 146, def, txt);
  badge(g, w / 2, h - 7, txt, 3.8);
  put(def, { screen: { x: cx, y: 36, w: 120, h: 40 }, level1: K(42, 94, 11), dubLevel: K(108, 94, 11), led: { x: cx, y: 160, r: 2.8 }, foot: { x: cx, y: cy, r: 13 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 94);
}

// Strobe Tuner: black anodised, strobe screen, turntable strobe disc around the footswitch
function strobe(ctx, def) {
  const g = ctx.g, w = 150, h = 252;
  const col = def.color || '#111318', txt = def.text || '#e9ecf3';
  const b = shell(g, w, h, col, { rx: 10, mat: 'anod' });
  b.edge();
  const cx = w / 2, cy = 186;
  C(g, cx, cy, 50, { fill: '#0a0b0d', stroke: '#2a2d33' });
  for (const [r, n, wd] of [[46, 60, 5], [39.5, 48, 5], [33, 36, 5], [26.5, 24, 5]]) {
    const circ = 2 * Math.PI * r;
    C(g, cx, cy, r, { fill: 'none', stroke: '#d9dde3', 'stroke-width': wd, 'stroke-dasharray': `${f1(circ / n / 2)} ${f1(circ / n / 2)}`, opacity: 0.85 });
  }
  C(g, cx, cy, 22, { fill: '#0a0b0d' });
  label(g, 16, 114, def.logo || 'STROBE', { size: 15, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 3, anchor: 'start' });
  label(g, 16, 127, (def.typeName || '').toUpperCase(), { size: 4.6, fill: txt, weight: 700, ls: 1.2, anchor: 'start', opacity: 0.7 });
  label(g, 124, 127, 'IN TUNE', { size: 4.6, fill: txt, weight: 800, ls: 0.8, opacity: 0.8 });
  badge(g, w / 2, h - 7, txt, 3.8);
  put(def, { screen: { x: cx, y: 52 }, led: { x: 124, y: 114, r: 3.2 }, foot: { x: cx, y: cy, r: 13 } });
  return finish(ctx, def, w, h, T(txt), 150);
}

// Centaurus: brushed gold with art-deco sunburst and the Centaurus star map (no figure)
function deco(ctx, def) {
  const g = ctx.g, w = 150, h = 244;
  const col = def.color || '#c9a64e', acc = def.accent || '#5a3f12', txt = def.text || '#2b1d0a';
  const b = shell(g, w, h, col, { rx: 9, mat: 'anod' });
  const t = b.inside({ 'pointer-events': 'none' });
  for (let i = 0; i < 17; i++) {
    const a = -80 + i * 10;
    const [x0, y0] = pol(w / 2, 214, 22, a), [x1, y1] = pol(w / 2, 214, 180, a - 2.5), [x2, y2] = pol(w / 2, 214, 180, a + 2.5);
    if (i % 2 === 0) P(t, `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}Z`, { fill: '#fff', opacity: 0.1 });
  }
  b.edge();
  // stepped deco frame
  P(g, `M10 34 V20 H20 V10 H${w - 20} V20 H${w - 10} V34 M10 ${h - 27} V${h - 10} H${w - 10} V${h - 27}`, { fill: 'none', stroke: acc, 'stroke-width': 1, opacity: 0.7 });
  P(g, `M14 30 V24 H24 V14 H${w - 24} V24 H${w - 14} V30 M14 ${h - 23} V${h - 14} H${w - 14} V${h - 23}`, { fill: 'none', stroke: acc, 'stroke-width': 0.5, opacity: 0.5 });
  // star map
  const S = [[34, 102, 3], [50, 94, 1.6], [66, 104, 2], [80, 92, 1.4], [92, 106, 2.2], [108, 96, 1.6], [118, 110, 2.8], [100, 120, 1.2]];
  P(g, 'M34 102 L50 94 L66 104 L80 92 L92 106 L108 96 L118 110 M92 106 L100 120', { fill: 'none', stroke: acc, 'stroke-width': 0.6, opacity: 0.7 });
  for (const [x, y, r] of S) { C(g, x, y, r, { fill: '#fff8de', stroke: acc, 'stroke-width': 0.5 }); }
  label(g, 34, 110, 'α', { size: 5, fill: acc, weight: 700 });
  engrave(g, w / 2, 140, def.logo || 'CENTAURUS', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 3.2 });
  P(g, `M22 151 H${w / 2 - 34} M${w / 2 + 34} 151 H${w - 22}`, { stroke: acc, 'stroke-width': 0.8 });
  label(g, w / 2, 151, (def.typeName || '').toUpperCase(), { size: 4.4, fill: txt, weight: 700, ls: 0.9, opacity: 0.85 });
  badge(g, w / 2, h - 19, txt, 3.8);
  for (const sx of [24, w - 24]) P(g, `M${sx} ${h - 19} l3 -3 l3 3 l-3 3Z`, { fill: acc, opacity: 0.7, transform: `translate(-3 0)` });
  put(def, { gain: K(38, 52, 12), tone: K(75, 52, 12), level: K(112, 52, 12), led: { x: w / 2, y: 172, r: 3 }, foot: { x: w / 2, y: 200, r: 12 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 56);
}

// Big Fuzz π: wide off-white enamel, a huge π wrapped in a spiral of its digits
function piFuzz(ctx, def) {
  const g = ctx.g, w = 178, h = 244;
  const col = def.color || '#d9d4c7', ink = def.text || '#b0161c';
  const b = shell(g, w, h, col, { rx: 8, mat: 'enamel' });
  b.edge();
  const cx = w / 2, cy = 120;
  let d = '';
  for (let i = 0; i <= 120; i++) { const a = 200 + i * 6, r = 44 - i * 0.16; const [x, y] = pol(cx, cy, r, a); d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); }
  textOnPath(g, d, '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651', { size: 5.2, fill: ink, font: "'Share Tech Mono', monospace", weight: 400, ls: 0.6, offset: '0%', opacity: 0.85 }).setAttribute('text-anchor', 'start');
  label(g, cx, cy - 2, 'π', { size: 46, fill: ink, font: 'serif', weight: 700 });
  engrave(g, cx, 178, def.logo ? def.logo.replace(/\s*π\s*$/, '') : 'BIG FUZZ', { size: 15, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 4 });
  typeLine(g, cx, 191, def, ink);
  badge(g, cx, h - 8, ink, 4);
  put(def, { level: K(36, 42, 13), tone: K(cx, 42, 13), gain: K(w - 36, 42, 13), led: { x: 40, y: 212, r: 3 }, foot: { x: cx, y: 212, r: 12 } });
  return finish(ctx, def, w, h, T(ink, { knob: 'mxr' }), 56);
}

// Smiley Fuzz: round red metal-flake, knob eyes and a grin drawn as a clipped fuzz waveform
function face(ctx, def) {
  const g = ctx.g, D = 182, w = D, h = D, cx = D / 2, cy = D / 2, Rr = D / 2 - 1;
  const col = def.color || '#b9161b', txt = def.text || '#f2f2f2';
  const path = `M${cx - Rr} ${cy}A${Rr} ${Rr} 0 1 0 ${cx + Rr} ${cy}A${Rr} ${Rr} 0 1 0 ${cx - Rr} ${cy}Z`;
  const b = shell(g, w, h, col, { path, mat: 'flake' });
  b.edge();
  C(g, cx, cy, Rr - 7, { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.25, 'stroke-width': 0.8 });
  textOnPath(g, `M${cx - 70} ${cy} A70 70 0 0 1 ${cx + 70} ${cy}`, def.logo || 'SMILEY FUZZ', { size: 10, fill: txt, ls: 3 });
  // grin: square-ish fuzz wave following a smile arc
  let d = '';
  for (let i = 0; i <= 64; i++) {
    const a = 120 + (i / 64) * 120;
    const amp = Math.sign(Math.sin(i * 0.9)) * 3.2;
    const [x, y] = pol(cx, cy + 4, 46 + amp, a);
    d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y);
  }
  P(g, d, { fill: 'none', stroke: txt, 'stroke-width': 1.6, 'stroke-linejoin': 'round', opacity: 0.9 });
  typeLine(g, cx, cy + 66, def, txt, { size: 4.2, ls: 1.2 });
  badge(g, cx, cy + 74, txt, 3.6);
  put(def, { level: K(cx - 34, cy - 26, 13), gain: K(cx + 34, cy - 26, 13), led: { x: cx, y: cy - 8, r: 3 }, foot: { x: cx, y: cy + 20, r: 12.5 } });
  return finish(ctx, def, w, h, T(txt, { knob: def.knob || 'chicken' }), cy - 12, 26);
}

// Tone Bend: barrel-sided grey hammertone, the logo literally bends
function bend(ctx, def) {
  const g = ctx.g, w = 156, h = 234;
  const col = def.color || '#7b7f86', acc = def.accent || '#d9861f', txt = def.text || '#111';
  const path = `M14 0 H${w - 14} Q${w + 14} ${h / 2} ${w - 14} ${h} H14 Q-14 ${h / 2} 14 0 Z`;
  const b = shell(g, w, h, col, { path, mat: 'hammer' });
  b.edge();
  textOnPath(g, `M30 128 Q${w / 2} 90 ${w - 30} 128`, def.logo || 'TONE BEND', { size: 17, fill: txt, ls: 2 });
  svg('ellipse', { cx: w / 2, cy: 132, rx: 18, ry: 7, fill: acc, stroke: '#000', 'stroke-opacity': 0.5 }, g);
  label(g, w / 2, 132.5, 'MkII', { size: 7.5, fill: '#111', weight: 800, font: "'Oswald', sans-serif" });
  typeLine(g, w / 2, 148, def, txt, { size: 4.4, ls: 1 });
  badge(g, w / 2, h - 9, txt, 4);
  put(def, { level: K(38, 50, 12), tone: K(78, 50, 12), gain: K(118, 50, 12), led: { x: w / 2, y: 168, r: 3 }, foot: { x: w / 2, y: 198, r: 12 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'fender' }), 117);
}

// Direct Box: blue powder-coated steel with slotted rack-ear flanges top and bottom
function rackDI(ctx, def) {
  const g = ctx.g, w = 152, h = 206;
  const col = def.color || '#1d4f8f', txt = def.text || '#f2f5fa';
  const b = shell(g, w, h, col, { rx: 4, mat: 'crinkle' });
  const t = b.inside({ 'pointer-events': 'none' });
  for (const y of [0, h - 18]) {
    R(t, 0, y, w, 18, { fill: 'url(#g-chrome)', opacity: 0.85 });
    R(t, 0, y, w, 18, { fill: 'url(#p-brushed)' });
    R(t, 0, y ? y : 17, w, 1, { fill: '#000', opacity: 0.45 });
    for (const x of [18, w - 18]) R(t, x - 8, y + 6, 16, 6, { rx: 3, fill: '#0a0b0d' });
  }
  b.edge();
  for (const [x, y] of [[w / 2 - 20, 9], [w / 2 + 20, 9], [w / 2 - 20, h - 9], [w / 2 + 20, h - 9]]) screw(g, x, y, 2.2);
  engrave(g, 14, 33, def.logo || 'DIRECT BOX', { size: 11, fill: txt, anchor: 'start', font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
  label(g, w - 14, 33, 'ACTIVE · DI', { size: 4.6, fill: txt, anchor: 'end', weight: 800, ls: 1, opacity: 0.75 });
  R(g, 12, 40, w - 24, 0.8, { fill: txt, opacity: 0.3 });
  // signal flow
  const fy = 168;
  P(g, `M22 ${fy} H${w - 22} M${w - 30} ${fy - 3} L${w - 22} ${fy} L${w - 30} ${fy + 3}`, { fill: 'none', stroke: txt, 'stroke-width': 0.8, opacity: 0.6 });
  label(g, 22, fy - 6, 'HI-Z', { size: 4.6, fill: txt, anchor: 'start', weight: 800, opacity: 0.75 });
  label(g, w - 22, fy - 6, 'BALANCED', { size: 4.6, fill: txt, anchor: 'end', weight: 800, opacity: 0.75 });
  badge(g, w / 2, fy + 9, txt, 4);
  put(def, {
    pad: { x: 44, y: 70, orient: 'h' }, lift: { x: 82, y: 70, orient: 'h' }, invert: { x: 116, y: 70, orient: 'h' },
    speaker: { x: 38, y: 124, orient: 'h' }, lowcut: K(78, 122, 11), level: K(120, 122, 11),
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 70, 40);
}

// Re-Amp Box: rust hammertone with an exposed transformer (E-I core and copper windings)
function xformer(ctx, def) {
  const g = ctx.g, w = 142, h = 188;
  const col = def.color || '#8f3b1d', txt = def.text || '#f7efe9';
  const b = shell(g, w, h, col, { rx: 8, mat: 'hammer' });
  b.edge();
  const x0 = 30, y0 = 14, tw = w - 60, th = 50;
  // laminations
  R(g, x0, y0, tw, th, { rx: 2, fill: 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.5 });
  for (let i = 1; i < 12; i++) R(g, x0, y0 + (th * i) / 12, tw, 0.5, { fill: '#000', opacity: 0.35 });
  // windings
  R(g, x0 + 18, y0 - 3, tw - 36, th + 6, { rx: 5, fill: lin('t3-copper', [[0, '#7a3a14'], [0.4, '#e0954a'], [0.6, '#f2b26a'], [1, '#7a3a14']], 0, 0, 1, 0) });
  for (let i = 0; i < 16; i++) R(g, x0 + 18, y0 - 1 + i * 3.4, tw - 36, 0.6, { fill: '#5a2a0a', opacity: 0.5 });
  R(g, x0 + 22, y0 + th / 2 - 6, tw - 44, 12, { rx: 1, fill: '#efe7d3' });
  label(g, w / 2, y0 + th / 2, '10k : 600', { size: 5, fill: '#2a1a0d', weight: 800, ls: 0.4 });
  for (const x of [x0 - 6, x0 + tw + 6]) screw(g, x, y0 + th / 2, 2.4);
  engrave(g, w / 2, 148, def.logo || 'RE-AMP', { size: 15, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 3 });
  typeLine(g, w / 2, 160, def, txt, { size: 4.6 });
  badge(g, w / 2, h - 9, txt, 4);
  put(def, { invert: { x: 30, y: 104, orient: 'h' }, level: K(74, 102, 11), lowcut: K(114, 102, 11) });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 100);
}

// Headphone Amp: the headphones are the panel – headband arc, a knob in each ear cup
function phones(ctx, def) {
  const g = ctx.g, w = 158, h = 240;
  const col = def.color || '#222630', acc = def.accent || '#ff7a2f', txt = def.text || '#e9ecf3';
  const b = shell(g, w, h, col, { rx: 14, mat: 'anod' });
  b.edge();
  // headband
  P(g, `M30 92 C30 22 ${w - 30} 22 ${w - 30} 92`, { fill: 'none', stroke: '#0b0c0e', 'stroke-width': 9, 'stroke-linecap': 'round' });
  P(g, `M30 92 C30 22 ${w - 30} 22 ${w - 30} 92`, { fill: 'none', stroke: acc, 'stroke-width': 1.4, opacity: 0.9 });
  const bz = (tt) => { const u = 1 - tt; return [u * u * u * 30 + 3 * u * u * tt * 30 + 3 * u * tt * tt * (w - 30) + tt * tt * tt * (w - 30), u * u * u * 92 + 3 * u * u * tt * 22 + 3 * u * tt * tt * 22 + tt * tt * tt * 92]; };
  let pad = '';
  for (let i = 0; i <= 16; i++) { const [x, y] = bz(0.3 + (0.4 * i) / 16); pad += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); }
  P(g, pad, { fill: 'none', stroke: '#2e3138', 'stroke-width': 12, 'stroke-linecap': 'round' });
  P(g, pad, { fill: 'none', stroke: '#454953', 'stroke-width': 1, 'stroke-dasharray': '1.5 1.5', transform: 'translate(0 -3)' });
  for (const x of [36, w - 36]) {
    svg('ellipse', { cx: x, cy: 98, rx: 27, ry: 30, fill: '#0e0f12', stroke: '#000' }, g);
    svg('ellipse', { cx: x, cy: 98, rx: 24, ry: 27, fill: rad('t3-cup', [[0, '#3a3e47'], [1, '#121317']], 0.4, 0.35, 0.7) }, g);
  }
  engrave(g, w / 2, 160, def.logo || 'PHONES AMP', { size: 13, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.4 });
  typeLine(g, w / 2, 172, def, txt, { size: 4.6 });
  badge(g, w / 2, h - 9, txt);
  put(def, { level: K(36, 92, 12.5), pan: K(w - 36, 92, 12.5), led: { x: 44, y: 208, r: 3 }, foot: { x: w / 2, y: 208, r: 12 } });
  return finish(ctx, def, w, h, T(txt, { knob: 'chrome' }), 140, 30);
}

// Mic Splitter: cast grey box, XLR face and a Y split diagram
function xlrBox(ctx, def) {
  const g = ctx.g, w = 142, h = 188;
  const col = def.color || '#3a3f4a', acc = def.accent || '#37a3ff', txt = def.text || '#e9ecf3';
  const b = shell(g, w, h, col, { rx: 10, mat: 'crinkle' });
  const t = b.inside({ 'pointer-events': 'none' });
  for (let i = 0; i < 6; i++) for (const [y0, y1] of [[0, 76], [140, h]]) { R(t, 3 + i * 3, y0, 1.2, y1 - y0, { fill: '#000', opacity: 0.25 }); R(t, w - 4 - i * 3, y0, 1.2, y1 - y0, { fill: '#000', opacity: 0.25 }); }
  b.edge();
  // XLR face
  const cx = 48, cy = 44;
  C(g, cx, cy, 22, { fill: 'url(#g-chrome)', stroke: '#000', 'stroke-opacity': 0.6 });
  C(g, cx, cy, 18, { fill: '#15161a' });
  for (const [x, y, n] of [[cx - 7, cy - 4, '1'], [cx + 7, cy - 4, '2'], [cx, cy + 7, '3']]) { C(g, x, y, 3.2, { fill: '#000', stroke: '#888', 'stroke-width': 0.6 }); label(g, x + (n === '3' ? 6 : 0), y + (n === '3' ? 0 : -7), n, { size: 4.4, fill: '#bbb', weight: 800 }); }
  R(g, cx - 4, cy - 22, 8, 5, { rx: 1, fill: '#888' });
  // Y split
  P(g, `M74 44 H88 C98 44 98 30 108 30 H122 M88 44 C98 44 98 58 108 58 H122`, { fill: 'none', stroke: acc, 'stroke-width': 1.4 });
  label(g, 128, 30, 'A', { size: 7, fill: txt, weight: 800 });
  label(g, 128, 58, 'B', { size: 7, fill: txt, weight: 800 });
  engrave(g, w / 2, 148, def.logo || 'XLR SPLIT', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.6 });
  typeLine(g, w / 2, 160, def, txt, { size: 4.6 });
  badge(g, w / 2, h - 9, txt, 4);
  put(def, { lift: { x: 44, y: 106, orient: 'h' }, inv2: { x: 98, y: 106, orient: 'h' } });
  return finish(ctx, def, w, h, T(txt), 100, 30);
}

// Stereo Image: wing-topped body, overlapping L / R fields around the MODE selector
function wings(ctx, def) {
  const g = ctx.g, w = 202, h = 256;
  const col = def.color || '#2c1f4f', txt = def.text || '#efeaff';
  const L = def.art?.l || '#a98bff', Rc = def.art?.r || '#37d6c2';
  const path = `M0 24 Q0 4 22 4 Q${w / 4} 2 ${w / 2} 18 Q${(w * 3) / 4} 2 ${w - 22} 4 Q${w} 4 ${w} 24 V${h - 12} Q${w} ${h} ${w - 12} ${h} H12 Q0 ${h} 0 ${h - 12} Z`;
  const b = shell(g, w, h, col, { path, mat: 'anod' });
  const t = b.inside({ 'pointer-events': 'none' });
  C(t, w / 2 - 24, 70, 50, { fill: rad('t3-wl', [[0, L, 0.42], [1, L, 0]]) });
  C(t, w / 2 + 24, 70, 50, { fill: rad('t3-wr', [[0, Rc, 0.38], [1, Rc, 0]]) });
  C(t, w / 2 - 24, 70, 44, { fill: 'none', stroke: L, 'stroke-width': 0.8, opacity: 0.55 });
  C(t, w / 2 + 24, 70, 44, { fill: 'none', stroke: Rc, 'stroke-width': 0.8, opacity: 0.55 });
  b.edge();
  label(g, 22, 22, 'L', { size: 9, fill: L, weight: 800, font: "'Oswald', sans-serif" });
  label(g, w - 22, 22, 'R', { size: 9, fill: Rc, weight: 800, font: "'Oswald', sans-serif" });
  engrave(g, w / 2, 176, def.logo || 'STEREO IMAGE', { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.6 });
  typeLine(g, w / 2, 188, def, txt);
  badge(g, w / 2, h - 9, txt);
  put(def, {
    mode: SELO(w / 2, 66, 12, { optSize: 4.2, labelRadius: 7 }),
    width: K(30, 54, 11), time: K(30, 108, 11), rate: K(w - 30, 54, 11), depth: K(w - 30, 108, 11),
    monobass: K(74, 136, 10), level: K(128, 136, 10),
    led: { x: 50, y: 224, r: 3 }, foot: { x: w / 2, y: 224, r: 12 },
  });
  return finish(ctx, def, w, h, T(txt, { knob: 'strymon' }), 54, 30);
}

export function installTz3Forms(registerForm, k) {
  if (k && k.formKit) injected = k.formKit;
  const F = { lab, arrow, wedge, vu, tomb, gate, console: consoleStrip, wave, vortex, capsule, leslie, radio, glass: glassCrush, funk, bubble, echo, cathedral, tank, crystal, staff, loop: loopRing, strobe, deco, pi: piFuzz, face, bend, rackdi: rackDI, xformer, phones, xlr: xlrBox, wings };
  for (const [n, f] of Object.entries(F)) registerForm('tz3-' + n, f);
}
