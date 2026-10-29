// Tone Zone original enclosures – the "studio" design language used by the core originals:
// anodised aluminium lit from the top left, fine brushing, a recessed control deck, engraved type and an
// accent stripe whose placement marks the family. Plus a few playful shapes (orb, cassette, scope slab),
// a treadle housing and trims that dress the built-in amp / cab forms in Tone Zone colours.
// Performance: gradients, cached noise and clip paths only – no SVG filters.
import { svg, shade, luminance } from '../util.js';
import { softShadow } from './fx.js';
import { label } from './controls.js';
import { formKit as coreKit } from './forms.js'; // cyclic import: only touched at render time

let injected = null;
const kit = () => injected || coreKit;

// ------------------------------------------------------------------ shared paint
function defsEl() {
  let d = document.getElementById('globalDefs') || document.getElementById('tzoDefs');
  if (!d) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.style.position = 'absolute';
    d = svg('defs', { id: 'tzoDefs' }, s);
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
const bodyGrad = (col) => lin('tzo-b' + keyOf(col), [[0, shade(col, 0.2)], [0.42, col], [1, shade(col, -0.3)]], 0, 0, 0.55, 1);
const sheen = () => lin('tzo-sheen', [[0, '#fff', 0.07], [0.3, '#fff', 0], [0.46, '#fff', 0], [0.52, '#fff', 0.09], [0.6, '#fff', 0], [1, '#000', 0.08]], 0, 0, 1, 1);
const deckShade = () => lin('tzo-deck', [[0, '#000', 0.4], [0.07, '#000', 0.1], [0.5, '#000', 0], [1, '#fff', 0.05]]);
const isLight = (c) => { try { return luminance(c) > 0.55; } catch (_) { return false; } };
const inkFor = (c) => (isLight(c) ? '#17191d' : '#eef1f6');

let clipSeq = 0;
// enclosure: anodised fill, brushing, grain, diagonal sheen, bevel. Returns a clip-path url for trim.
function anod(g, w, h, col, o = {}) {
  const rx = o.rx ?? 12;
  const path = o.path || null;
  if (path) softShadow(g, { w, h, path, dy: 14, blur: 9, opacity: 0.6 });
  else softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
  const shape = (a, parent = g) => (path ? svg('path', Object.assign({ d: path }, a), parent) : svg('rect', Object.assign({ x: 0, y: 0, width: w, height: h, rx }, a), parent));
  shape({ fill: bodyGrad(col) });
  if (o.finish !== 'gloss') shape({ fill: 'url(#p-brushed)', opacity: o.finish === 'raw' ? 1.6 : 1 });
  shape({ fill: 'url(#p-grain)', opacity: 0.55 });
  shape({ fill: sheen() });
  if (o.finish === 'gloss') shape({ fill: 'url(#g-gloss)', opacity: 0.35 });
  const id = 'tzoc' + ++clipSeq;
  const cp = svg('clipPath', { id }, g);
  shape({}, cp);
  return {
    clip: `url(#${id})`,
    edge() {
      // bevel: bright chamfer on top, dark rim around
      shape({ fill: 'none', stroke: '#fff', 'stroke-opacity': 0.26, 'stroke-width': 1.4, transform: path ? undefined : undefined, ...(path ? {} : { x: 0.8, y: 0.8, width: w - 1.6, height: h - 1.6, rx: rx - 0.6 }) });
      shape({ fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 });
    },
  };
}
// engraved lettering: dark upper lip + light lower lip around the ink
function engrave(g, x, y, str, o = {}) {
  if (!str) return null;
  const base = Object.assign({ size: 10, weight: 800, ls: 1.2, font: "'Inter', sans-serif" }, o);
  label(g, x, y + 0.65, str, Object.assign({}, base, { fill: '#fff', opacity: 0.22 }));
  label(g, x, y - 0.45, str, Object.assign({}, base, { fill: '#000', opacity: 0.42 }));
  return label(g, x, y, str, base);
}
function deck(g, x, y, w, h, col, rx = 8) {
  svg('rect', { x, y, width: w, height: h, rx, fill: col }, g);
  svg('rect', { x, y, width: w, height: h, rx, fill: 'url(#p-grain)', opacity: 0.5 }, g);
  svg('rect', { x, y, width: w, height: h, rx, fill: deckShade() }, g);
  svg('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: h - 1, rx: rx - 0.5, fill: 'none', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.9 }, g);
  svg('line', { x1: x + rx, x2: x + w - rx, y1: y + h + 0.6, y2: y + h + 0.6, stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 0.8 }, g);
}
function screw(g, x, y, r = 2.6) {
  svg('circle', { cx: x, cy: y + 0.5, r: r + 0.5, fill: '#000', opacity: 0.4 }, g);
  svg('circle', { cx: x, cy: y, r, fill: 'url(#g-chromeR)' }, g);
  svg('path', { d: `M${x - r * 0.6} ${y}h${r * 1.2}M${x} ${y - r * 0.6}v${r * 1.2}`, stroke: '#3a3f45', 'stroke-width': 0.7 }, g);
}
function badge(g, x, y, fill, size = 4.4, anchor = 'middle') {
  return label(g, x, y, 'TONE ZONE', { size, fill, weight: 800, ls: 1.4, opacity: 0.75, anchor });
}

// family glyphs (small line icons printed next to the model name)
function wavePath(fn, x, y, w, h, n = 40) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    d += (i ? 'L' : 'M') + (x - w / 2 + w * t).toFixed(2) + ' ' + (y - (h / 2) * fn(t)).toFixed(2);
  }
  return d;
}
export function glyph(g, kind, x, y, s, color, sw = 1.1) {
  const st = { fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const P = (d, extra = {}) => svg('path', Object.assign({ d }, st, extra), g);
  const sin = (t, k = 1) => Math.sin(t * Math.PI * 2 * k);
  switch (kind) {
    case 'od': P(wavePath((t) => Math.tanh(2.2 * sin(t)) / Math.tanh(2.2), x, y, s, s * 0.7)); break;
    case 'dist': P(wavePath((t) => Math.max(-0.55, Math.min(0.55, 1.6 * sin(t))) / 0.55, x, y, s, s * 0.7)); break;
    case 'fuzz': P(wavePath((t) => Math.sign(sin(t, 1.5)) * (0.8 + 0.2 * sin(t, 9)), x, y, s, s * 0.7, 80)); break;
    case 'boost': P(`M${x - s / 2} ${y + s * 0.15}L${x} ${y - s * 0.25}L${x + s / 2} ${y + s * 0.15}M${x - s / 2} ${y + s * 0.4}L${x} ${y}L${x + s / 2} ${y + s * 0.4}`); break;
    case 'dyn': P(`M${x - s / 2} ${y + s / 2}L${x} ${y - s * 0.05}L${x + s / 2} ${y - s * 0.25}`); P(`M${x - s / 2} ${y + s / 2}L${x + s / 2} ${y - s / 2}`, { opacity: 0.35, 'stroke-dasharray': '1 1.4' }); break;
    case 'eq': [-0.35, 0, 0.35].forEach((dx, i) => { P(`M${x + dx * s} ${y - s / 2}V${y + s / 2}`, { opacity: 0.5 }); svg('rect', { x: x + dx * s - 1.6, y: y + [0.15, -0.25, 0.05][i] * s - 1, width: 3.2, height: 2, rx: 0.6, fill: color }, g); }); break;
    case 'filter': P(wavePath((t) => (t < 0.55 ? 0.1 + 0.9 * Math.exp(-((t - 0.5) ** 2) / 0.004) * 0.9 : 0.1 - (t - 0.55) * 2.4), x, y, s, s * 0.9)); break;
    case 'mod': P(wavePath((t) => sin(t, 1.5), x, y, s, s * 0.6)); P(wavePath((t) => sin(t + 0.12, 1.5), x, y, s, s * 0.6), { opacity: 0.4 }); break;
    case 'pitch': P(`M${x - s / 2} ${y + s * 0.35}h${s / 3}v${-s * 0.35}h${s / 3}v${-s * 0.35}h${s / 3}`); break;
    case 'delay': [0, 1, 2, 3].forEach((i) => P(`M${x - s / 2 + i * s / 3} ${y + s * 0.4}v${-s * 0.8 * Math.pow(0.62, i)}`)); break;
    case 'verb': [0.18, 0.34, 0.5].forEach((r, i) => P(`M${x - r * s} ${y + s * 0.3}A${r * s} ${r * s} 0 0 1 ${x + r * s} ${y + s * 0.3}`, { opacity: 1 - i * 0.25 })); break;
    case 'synth': P(wavePath((t) => 1 - 2 * ((t * 2) % 1), x, y, s, s * 0.6, 80)); break;
    case 'acoustic': svg('circle', Object.assign({ cx: x, cy: y, r: s * 0.32 }, st), g); svg('circle', Object.assign({ cx: x, cy: y, r: s * 0.46 }, st, { opacity: 0.45, 'stroke-dasharray': '1 1.2' }), g); break;
    case 'loop': P(`M${x + s * 0.36} ${y - s * 0.12}A${s * 0.38} ${s * 0.38} 0 1 0 ${x + s * 0.3} ${y + s * 0.22}`); P(`M${x + s * 0.18} ${y - s * 0.2}L${x + s * 0.38} ${y - s * 0.12}L${x + s * 0.46} ${y - s * 0.34}`); break;
    case 'vol': svg('path', { d: `M${x - s / 2} ${y + s * 0.3}L${x + s / 2} ${y + s * 0.3}L${x + s / 2} ${y - s * 0.3}Z`, fill: color, opacity: 0.85 }, g); break;
    case 'multi': [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => svg('rect', { x: x + a * s * 0.24 - s * 0.18, y: y + b * s * 0.24 - s * 0.18, width: s * 0.36, height: s * 0.36, rx: 1, fill: 'none', stroke: color, 'stroke-width': sw }, g)); break;
    case 'amp': P(`M${x - s / 2} ${y - s * 0.35}h${s}v${s * 0.7}h${-s}Z`); P(`M${x - s * 0.3} ${y}h${s * 0.6}`, { opacity: 0.6 }); break;
    default: break;
  }
}
const GLYPH_FOR = { Overdrive: 'od', Distortion: 'dist', Fuzz: 'fuzz', Boost: 'boost', Dynamics: 'dyn', EQ: 'eq', Filter: 'filter', Modulation: 'mod', Pitch: 'pitch', Delay: 'delay', Reverb: 'verb', Synth: 'synth', Acoustic: 'acoustic', Looper: 'loop', Volume: 'vol', Wah: 'filter', 'Multi-FX': 'multi', Preamp: 'amp' };

// accent trim drawn inside the body clip
function trim(g, clip, w, h, style, accent, y0) {
  const t = svg('g', { 'clip-path': clip, 'pointer-events': 'none' }, g);
  switch (style) {
    case 'left':
      svg('rect', { x: 0, y: 0, width: 6, height: h, fill: accent }, t);
      svg('rect', { x: 6, y: 0, width: 1, height: h, fill: '#000', opacity: 0.35 }, t);
      break;
    case 'top':
      svg('rect', { x: 0, y: 0, width: w, height: 5, fill: accent }, t);
      svg('rect', { x: 0, y: 5, width: w, height: 0.8, fill: '#000', opacity: 0.35 }, t);
      break;
    case 'diag':
      svg('path', { d: `M${w * 0.62} ${h}L${w} ${h - w * 0.38}V${h - w * 0.38 + 9}L${w * 0.62 + 9} ${h}Z`, fill: accent, opacity: 0.95 }, t);
      svg('path', { d: `M${w * 0.62 + 14} ${h}L${w} ${h - w * 0.38 + 14}V${h - w * 0.38 + 17}L${w * 0.62 + 17} ${h}Z`, fill: accent, opacity: 0.55 }, t);
      break;
    case 'twin':
      svg('rect', { x: w - 14, y: 0, width: 2.4, height: h, fill: accent }, t);
      svg('rect', { x: w - 9, y: 0, width: 1.2, height: h, fill: accent, opacity: 0.6 }, t);
      break;
    case 'none':
      break;
    default: // band under the deck
      svg('rect', { x: 0, y: y0, width: w, height: 3, fill: accent }, t);
      svg('rect', { x: 0, y: y0 + 3, width: w, height: 0.8, fill: '#000', opacity: 0.35 }, t);
  }
}
function woodGrain(g, clip, w, h, col) {
  const t = svg('g', { 'clip-path': clip, 'pointer-events': 'none', opacity: 0.32 }, g);
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * h + Math.sin(i * 1.7) * 3;
    const a = 2 + Math.sin(i * 2.3) * 2;
    svg('path', { d: `M0 ${y.toFixed(1)} C ${w * 0.3} ${(y + a).toFixed(1)} ${w * 0.6} ${(y - a).toFixed(1)} ${w} ${(y + a * 0.5).toFixed(1)}`, stroke: shade(col, i % 3 ? -0.35 : 0.25), 'stroke-width': i % 4 ? 0.6 : 1.3, fill: 'none' }, t);
  }
}

// controls without coordinates are laid out by the form; remember that so every re-render lays them out again
// (the def is shared, positions written on the first render must not freeze the layout)
const free = (c) => !c.hidden && (c._tzAuto || (c.x === undefined && (c._tzAuto = true)));
function row(list, x0, x1, y) {
  const n = list.length;
  list.forEach((c, i) => {
    c.x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    c.y = y;
  });
}
// place n footswitches (and the LEDs paired with them by order) along the bottom
function footRow(def, w, footY, ledY, r = 12) {
  const foots = def.controls.filter((c) => c.t === 'foot' && free(c));
  const leds = def.controls.filter((c) => c.t === 'led' && free(c));
  const n = foots.length;
  const span = Math.min(w - 50, n * 64);
  foots.forEach((f, i) => Object.assign(f, { style: f.style || 'stomp', r: f.r || r, x: n === 1 ? w / 2 : w / 2 - span / 2 + (span * (i + 0.5)) / n, y: footY }));
  leds.forEach((l, i) => {
    let f = foots.find((ft) => ft.p && l.bind === 'param:' + ft.p) || foots[i] || foots[foots.length - 1];
    if (!f) f = { x: w / 2 };
    Object.assign(l, { x: f.x, y: ledY, r: l.r || 2.8 });
  });
  return { foots, leds };
}

// ------------------------------------------------------------------ studio stomp
function studio(ctx, def) {
  const A = def.art || {};
  if (A.columns) return columns(ctx, def);
  const g = ctx.g;
  const col = def.color || '#3a3f48';
  const accent = def.accent || '#ff7a2f';
  const txt = def.text || inkFor(col);
  const C = def.controls;
  const knobs = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c));
  const togs = C.filter((c) => (c.t === 'toggle' || c.t === 'button') && free(c));
  const screen = C.find((c) => c.t === 'screen' && free(c));
  const sliders = C.filter((c) => c.t === 'slider' && free(c));
  const nf = C.filter((c) => c.t === 'foot' && free(c)).length;
  const n = knobs.length;
  const perRow = A.perRow || (n <= 3 ? 3 : n === 4 ? 4 : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6);
  const rows = Math.ceil(n / perRow);
  const w = Math.max(A.minW || 0, perRow <= 3 ? 150 : 34 + perRow * 44, nf >= 2 ? 50 + nf * 62 : 0, togs.length > 3 ? 40 + togs.length * 34 : 0, sliders.length ? 30 + sliders.length * 22 : 0);
  const kr = A.knobR || (n <= 3 ? 13 : 11);
  const deckCol = A.deck === 'none' ? null : A.deck || shade(col, isLight(col) ? -0.18 : -0.5);
  const deckTxt = deckCol ? A.deckText || inkFor(deckCol) : txt;
  // vertical layout
  const top = 10;
  let y = top + 8;
  if (screen) {
    const sh = screen.h || 40, sw = Math.min(screen.w || w - 36, w - 36);
    Object.assign(screen, { x: w / 2, y: y + sh / 2 + 2, w: sw, h: sh });
    y += sh + 12;
  }
  if (sliders.length) {
    const sh = 50;
    row(sliders, 26, w - 26, y + 6 + sh / 2);
    sliders.forEach((s) => Object.assign(s, { h: sh, w: 6.5, labelSize: 5 }));
    y += sh + 26;
  }
  const pitch = 50;
  const hasSelOpts = knobs.some((k) => k.t === 'sel' && k.printLabels !== false);
  if (rows) y += kr + (hasSelOpts ? 12 : 6);
  const x0 = perRow <= 3 && w <= 150 ? 32 : 30, x1 = w - x0;
  for (let r = 0; r < rows; r++) {
    const list = knobs.slice(r * perRow, (r + 1) * perRow);
    // centre short rows on the same grid
    const step = perRow > 1 ? (x1 - x0) / (perRow - 1) : 0;
    const cx = w / 2, span = step * (list.length - 1);
    list.forEach((k, i) => {
      k.x = list.length === 1 ? cx : cx - span / 2 + step * i;
      k.y = y + r * pitch;
      k.r = k.r || (k.t === 'sel' && k.options.length > 6 ? kr - 1 : kr);
      k.labelPos = k.labelPos || 'below';
      if (k.t === 'sel') { k.optSize = k.optSize || (k.options.length > 6 ? 4 : 4.6); k.labelRadius = k.labelRadius || 7; }
    });
  }
  if (rows) y += (rows - 1) * pitch + kr + 20;
  if (togs.length) {
    y += 16;
    row(togs, togs.length === 1 ? w / 2 : 34, togs.length === 1 ? w / 2 : w - 34, y);
    togs.forEach((t) => { if (t.t === 'toggle') t.orient = t.orient || 'h'; });
    y += 16;
  }
  const deckBottom = y + 4;
  const logoY = deckBottom + 22;
  const typeY = logoY + 13;
  const ledY = typeY + 17;
  const footY = ledY + 28;
  const footLabels = C.some((c) => c.t === 'foot' && c.label);
  const h = Math.max(A.minH || 0, footY + 13 + (footLabels ? 22 : 14) + 10);
  // paint
  const b = anod(g, w, h, col, { rx: A.rx ?? 12, finish: A.finish });
  if (A.finish === 'wood') woodGrain(g, b.clip, w, h, col);
  trim(g, b.clip, w, h, A.stripe || 'band', accent, deckBottom + 6);
  b.edge();
  if (deckCol) deck(g, 8, top, w - 16, deckBottom - top, deckCol, 9);
  if (A.screws !== false) for (const [sx, sy] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) if (!deckCol || sy > 10) screw(g, sx, sy, 2.2);
  const logo = def.logo || def.name;
  const lsize = def.logoSize || (logo.length > 13 ? 11 : logo.length > 9 ? 13 : 15);
  const gk = A.glyph === false ? null : A.glyph || GLYPH_FOR[def.cat];
  engrave(g, w / 2, logoY, logo, { size: lsize, fill: def.logoColor || txt, font: def.logoFont || "'Inter', sans-serif", weight: 800, ls: A.logoLs ?? 1.6 });
  const tline = (def.typeName || def.cat).toUpperCase();
  label(g, w / 2 + (gk ? 6 : 0), typeY, tline, { size: 5.2, fill: txt, weight: 700, ls: 1.5, opacity: 0.72 });
  if (gk) glyph(g, gk, w / 2 - tline.length * 1.55 - 6, typeY, 8, accent, 1);
  badge(g, w / 2, h - 9, txt, 4.2);
  footRow(def, w, footY, ledY, nf > 2 ? 11 : 12.5);
  // deck controls get the deck ink; footswitch captions the body ink
  const deckSet = new Set([...knobs, ...togs, ...sliders, ...(screen ? [screen] : [])]);
  const theme = { text: deckTxt, knob: def.knob || A.knob || 'strymon', labelSize: A.labelSize || 6.2, labelLs: 0.5, labelFont: "'Barlow Condensed', sans-serif" };
  const bodyTheme = Object.assign({}, theme, { text: txt });
  kit().placeControls(ctx, C.filter((c) => deckSet.has(c) || (c.x !== undefined && c.y < deckBottom && c.t !== 'foot' && c.t !== 'led')), theme);
  kit().placeControls(ctx, C.filter((c) => !deckSet.has(c) && !(c.x !== undefined && c.y < deckBottom && c.t !== 'foot' && c.t !== 'led')), bodyTheme);
  return { w, h, theme: Object.assign({}, bodyTheme, { jackText: txt }), jacks: kit().jacksSide(def, w, { y0: nf <= 1 ? ledY + 5 : logoY - 4, gap: 28, flip: ctx.flip }) };
}

// multi-effect strip: one column per effect section (title, knobs, LED, footswitch)
function columns(ctx, def) {
  const A = def.art;
  const g = ctx.g;
  const col = def.color || '#2a2e36';
  const accent = def.accent || '#ff7a2f';
  const txt = def.text || inkFor(col);
  const C = def.controls;
  const used = new Set();
  const cols = A.columns.map((c) => Object.assign({}, c));
  const leftovers = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c) && !cols.some((k) => k.knobs.includes(c.p)));
  const byp = C.find((c) => c.t === 'foot' && c.action === 'bypass' && free(c));
  if (leftovers.length || byp) cols.push({ title: A.masterTitle || 'MASTER', knobs: leftovers.map((c) => c.p), foot: byp ? '__bypass' : null, color: A.masterColor || txt, master: true });
  const colW = A.colW || 62;
  const w = 20 + cols.length * colW;
  const maxK = Math.max(...cols.map((c) => c.knobs.length));
  const top = 10;
  const kr = 10.5;
  const ky0 = top + 32 + kr;
  const pitch = 46;
  const deckBottom = ky0 + (maxK - 1) * pitch + kr + 22;
  const logoY = deckBottom + 22;
  const ledY = logoY + 26;
  const footY = ledY + 26;
  const h = footY + 13 + 34;
  const b = anod(g, w, h, col, { rx: 14, finish: A.finish });
  trim(g, b.clip, w, h, A.stripe || 'top', accent, 0);
  b.edge();
  const deckCol = A.deck || shade(col, isLight(col) ? -0.18 : -0.5);
  const deckTxt = inkFor(deckCol);
  deck(g, 8, top, w - 16, deckBottom - top, deckCol, 9);
  for (const [sx, sy] of [[7, h - 7], [w - 7, h - 7]]) screw(g, sx, sy, 2.2);
  const deckCtl = [], bodyCtl = [];
  cols.forEach((c, i) => {
    const cx = 10 + colW * (i + 0.5);
    if (i > 0) svg('line', { x1: 10 + colW * i, x2: 10 + colW * i, y1: top + 8, y2: deckBottom - 8, stroke: deckTxt, 'stroke-opacity': 0.14 }, g);
    const cc = c.color || accent;
    svg('rect', { x: cx - 16, y: top + 7, width: 32, height: 2, rx: 1, fill: cc, opacity: 0.9 }, g);
    label(g, cx, top + 18, c.title, { size: 6.4, fill: c.master ? deckTxt : cc, weight: 800, ls: 1.2 });
    c.knobs.forEach((p, j) => {
      const k = C.find((x) => x.p === p && (x.t === 'knob' || x.t === 'sel'));
      if (!k) return;
      Object.assign(k, { x: cx, y: ky0 + j * pitch, r: k.r || kr, labelPos: 'below' });
      if (k.t === 'sel') { k.optSize = k.optSize || 4; k.labelRadius = k.labelRadius || 6.5; k.printLabels = k.printLabels ?? false; }
      used.add(k);
      deckCtl.push(k);
    });
    const f = c.foot === '__bypass' ? byp : C.find((x) => x.t === 'foot' && x.p === c.foot);
    if (f) {
      Object.assign(f, { x: cx, y: footY, r: 11, style: 'stomp' });
      const led = C.find((x) => x.t === 'led' && free(x) && (c.foot === '__bypass' ? (x.bind || 'on') === 'on' : x.bind === 'param:' + c.foot));
      if (led) Object.assign(led, { x: cx, y: ledY, r: 2.8, color: led.color || (c.master ? '#ff3020' : cc) });
      label(g, cx, footY + 21, c.master ? 'ON' : c.title, { size: 5.6, fill: txt, weight: 800, ls: 1 });
    }
  });
  C.forEach((c) => { if (!used.has(c)) bodyCtl.push(c); });
  engrave(g, 22, logoY - 4, def.logo || def.name, { size: 13, fill: def.logoColor || txt, anchor: 'start', ls: 2, font: def.logoFont || "'Inter', sans-serif" });
  label(g, 22, logoY + 9, (def.typeName || 'MULTI-EFFECT').toUpperCase(), { size: 5.2, fill: txt, weight: 700, ls: 1.5, opacity: 0.72, anchor: 'start' });
  badge(g, w / 2, h - 9, txt, 4.2);
  const theme = { text: deckTxt, knob: def.knob || 'strymon', labelSize: 5.8, labelLs: 0.4 };
  kit().placeControls(ctx, deckCtl, theme);
  kit().placeControls(ctx, bodyCtl, Object.assign({}, theme, { text: txt }));
  return { w, h, theme: Object.assign({}, theme, { text: txt, jackText: txt }), jacks: kit().jacksSide(def, w, { y0: 50, gap: 28, flip: ctx.flip }) };
}

// ------------------------------------------------------------------ treadle housing (wah / volume / wham)
function treadle(ctx, def) {
  const A = def.art || {};
  const g = ctx.g;
  const C = def.controls;
  // a bypass footswitch gets its own strip on the deck
  const foot = C.find((c) => c.t === 'foot' && free(c));
  const w = def.wide ? 178 : 154, h = 314 + (foot ? 40 : 0);
  const col = def.color || '#2a2d33';
  const accent = def.accent || '#ff7a2f';
  const txt = def.text || inkFor(col);
  const extras = C.filter((c) => (c.t === 'knob' || c.t === 'sel' || c.t === 'toggle') && free(c));
  const plateH = (extras.length ? 66 : 34) + (foot ? 40 : 0);
  const plateY = h - plateH - 8;
  const b = anod(g, w, h, col, { rx: 16, finish: A.finish });
  // side rails in the accent colour
  const t = svg('g', { 'clip-path': b.clip, 'pointer-events': 'none' }, g);
  for (const x of [5, w - 8]) svg('rect', { x, y: 0, width: 3, height: h, fill: accent, opacity: 0.95 }, t);
  b.edge();
  const tr = C.find((c) => c.t === 'treadle' && free(c));
  const th = plateY - 22;
  if (tr) Object.assign(tr, { x: w / 2, y: 12 + th / 2, w: w - 34, h: th, color: def.treadleColor || '#17181b', logo: def.logo, logoColor: def.logoColor || accent, logoFont: def.logoFont || "'Oswald', sans-serif", logoSize: def.logoSize || 17 });
  // hinge
  svg('rect', { x: 22, y: plateY - 7, width: w - 44, height: 4, rx: 2, fill: '#0b0c0e', opacity: 0.7 }, g);
  deck(g, 10, plateY, w - 20, plateH, A.deck || shade(col, isLight(col) ? -0.2 : -0.5), 7);
  const ptxt = inkFor(A.deck || shade(col, isLight(col) ? -0.2 : -0.5));
  label(g, 20, plateY + 11, def.code || def.name, { size: 6.2, fill: ptxt, weight: 800, ls: 1, anchor: 'start' });
  badge(g, w - 20, plateY + 11, ptxt, 4, 'end');
  const led = C.find((c) => c.t === 'led' && free(c));
  if (led) Object.assign(led, { x: w / 2, y: plateY + 11, r: 2.4 });
  if (extras.length) {
    row(extras, extras.length === 1 ? w / 2 : 32, extras.length === 1 ? w / 2 : w - 32, plateY + 39);
    extras.forEach((c) => {
      if (c.t === 'knob' || c.t === 'sel') { c.r = c.r || 8; c.labelPos = c.labelPos || 'below'; c.labelSize = 5.2; if (c.t === 'sel') { c.optSize = c.optSize || 3.6; c.labelRadius = c.labelRadius || 5.5; c.printLabels = c.printLabels ?? false; } }
      else { c.orient = 'h'; }
    });
  }
  if (foot) {
    Object.assign(foot, { x: w / 2, y: plateY + plateH - 21, r: 11, style: foot.style || 'stomp' });
    label(g, w / 2 + 22, plateY + plateH - 20, 'BYPASS', { size: 4.6, fill: ptxt, weight: 800, ls: 0.8, anchor: 'start', opacity: 0.8 });
  }
  const theme = { text: ptxt, knob: def.knob || 'strymon', labelSize: 5.2, toggleTitles: true };
  kit().placeControls(ctx, C, theme);
  return { w, h, theme: Object.assign({}, theme, { text: txt, jackText: txt }), jacks: kit().jacksSide(def, w, { y0: h - 150 - (foot ? 40 : 0), gap: 24, flip: ctx.flip }) };
}

// ------------------------------------------------------------------ playful: round "orb" pedal
function orb(ctx, def) {
  const A = def.art || {};
  const g = ctx.g;
  const D = 188, w = D, h = D, cx = D / 2, cy = D / 2, R = D / 2 - 2;
  const col = def.color || '#6b2d8f';
  const accent = def.accent || '#ffc23c';
  const txt = def.text || inkFor(col);
  const path = `M${cx - R} ${cy}A${R} ${R} 0 1 0 ${cx + R} ${cy}A${R} ${R} 0 1 0 ${cx - R} ${cy}Z`;
  softShadow(g, { w, h, path, dy: 14, blur: 9, opacity: 0.6 });
  svg('circle', { cx, cy, r: R, fill: rad('tzo-orb' + keyOf(col), [[0, shade(col, 0.35)], [0.55, col], [1, shade(col, -0.45)]], 0.38, 0.3, 0.75) }, g);
  svg('circle', { cx, cy, r: R, fill: 'url(#p-grain)', opacity: 0.6 }, g);
  // machined rings
  for (const [r, o] of [[R - 6, 0.3], [R - 9, 0.12], [56, 0.18]]) svg('circle', { cx, cy, r, fill: 'none', stroke: '#fff', 'stroke-opacity': o, 'stroke-width': 0.8 }, g);
  svg('circle', { cx, cy, r: R - 6.8, fill: 'none', stroke: '#000', 'stroke-opacity': 0.3, 'stroke-width': 0.8 }, g);
  // accent orbit arc + moon
  svg('path', { d: `M${cx - (R - 13)} ${cy + 8}A${R - 13} ${R - 13} 0 0 0 ${cx + (R - 13)} ${cy + 8}`, fill: 'none', stroke: accent, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.9, 'pointer-events': 'none' }, g);
  const ma = (A.moon ?? 0.68) * Math.PI;
  svg('circle', { cx: cx - Math.cos(ma) * (R - 13), cy: cy + 8 + Math.sin(ma) * (R - 13), r: 4, fill: accent, stroke: '#000', 'stroke-opacity': 0.3 }, g);
  svg('circle', { cx, cy, r: R, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 1.2 }, g);
  svg('circle', { cx, cy, r: R, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 }, g);
  const C = def.controls;
  const knobs = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c));
  const n = knobs.length;
  const spread = n <= 1 ? 0 : n === 2 ? 60 : n === 3 ? 100 : 128;
  knobs.forEach((k, i) => {
    const a = ((n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)) * Math.PI) / 180;
    Object.assign(k, { x: cx + Math.sin(a) * 58, y: cy - 12 - Math.cos(a) * 46, r: k.r || 11.5, labelPos: k.labelPos || 'above' });
    if (k.t === 'sel') { k.optSize = 4; k.labelRadius = 6; k.printLabels = k.printLabels ?? false; }
  });
  const togs = C.filter((c) => c.t === 'toggle' && free(c));
  togs.forEach((t, i) => Object.assign(t, { x: togs.length === 1 ? cx + 48 : cx + (i ? 50 : -50), y: cy + 30, orient: 'h' }));
  engrave(g, cx, cy + 6, def.logo || def.name, { size: def.logoSize || 14, fill: def.logoColor || txt, font: def.logoFont || "'Oswald', sans-serif", weight: 700, ls: 2.2 });
  label(g, cx, cy + 18, (def.typeName || def.cat).toUpperCase(), { size: 4.8, fill: txt, weight: 700, ls: 1.4, opacity: 0.72 });
  C.forEach((c) => {
    if (c.t === 'foot' && free(c)) Object.assign(c, { style: 'stomp', x: cx, y: cy + 52, r: 12 });
    if (c.t === 'led' && free(c)) Object.assign(c, { x: cx, y: cy + 30, r: 2.8 });
  });
  badge(g, cx, h - 14, txt, 4);
  const theme = { text: txt, knob: def.knob || 'chrome', labelSize: 6, labelLs: 0.6 };
  kit().placeControls(ctx, C, theme);
  return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks: kit().jacksSide(def, w, { y0: cy - 16, gap: 30, flip: ctx.flip }) };
}

// ------------------------------------------------------------------ playful: cassette / reel-to-reel
function reelArt(g, x, y, r, col, spokes = 3, hub = '#e9e4d8') {
  svg('circle', { cx: x, cy: y, r, fill: col, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.6 }, g);
  svg('circle', { cx: x, cy: y, r: r * 0.92, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.12 }, g);
  svg('circle', { cx: x, cy: y, r: r * 0.36, fill: hub, stroke: '#000', 'stroke-opacity': 0.35 }, g);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    svg('rect', { x: -r * 0.07, y: -r * 0.34, width: r * 0.14, height: r * 0.18, fill: '#222', transform: `translate(${x},${y}) rotate(${(a * 180) / Math.PI})` }, g);
  }
  svg('circle', { cx: x, cy: y, r: r * 0.1, fill: '#111' }, g);
}
function cassette(ctx, def) {
  const A = def.art || {};
  const g = ctx.g;
  const C = def.controls;
  const knobs = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c));
  const togs = C.filter((c) => (c.t === 'toggle' || c.t === 'button') && free(c));
  const nf = C.filter((c) => c.t === 'foot' && free(c)).length;
  const perRow = A.perRow || Math.min(4, Math.max(3, Math.ceil(knobs.length / Math.ceil(knobs.length / 4))));
  const rows = Math.ceil(knobs.length / perRow);
  const w = Math.max(204, nf >= 2 ? 60 + nf * 66 : 0, 40 + perRow * 44);
  const col = def.color || '#2b2f36';
  const accent = def.accent || '#ff7a2f';
  const txt = def.text || inkFor(col);
  const artH = 86;
  let y = 12 + artH + 30;
  const kr = 11;
  const x0 = 34, x1 = w - 34;
  for (let r = 0; r < rows; r++) {
    const list = knobs.slice(r * perRow, (r + 1) * perRow);
    const step = perRow > 1 ? (x1 - x0) / (perRow - 1) : 0;
    const span = step * (list.length - 1);
    list.forEach((k, i) => {
      Object.assign(k, { x: w / 2 - span / 2 + step * i, y: y + r * 48, r: k.r || kr, labelPos: k.labelPos || 'below' });
      if (k.t === 'sel') { k.optSize = k.optSize || 4; k.labelRadius = k.labelRadius || 6.5; }
    });
  }
  y += (rows - 1) * 48 + kr + 18;
  if (togs.length) {
    y += 14;
    row(togs, togs.length === 1 ? w / 2 : 40, togs.length === 1 ? w / 2 : w - 40, y);
    togs.forEach((t) => { if (t.t === 'toggle') t.orient = 'h'; });
    y += 14;
  }
  const ledY = y + 14, footY = ledY + 28;
  const footLabels = C.some((c) => c.t === 'foot' && c.label);
  const h = footY + 13 + (footLabels ? 22 : 14) + 10;
  const b = anod(g, w, h, col, { rx: 12, finish: A.finish });
  trim(g, b.clip, w, h, A.stripe || 'none', accent, 0);
  b.edge();
  // cassette shell
  const cx0 = 14, cw = w - 28, cy0 = 12;
  const shell = A.shell || '#1d1f23';
  svg('rect', { x: cx0, y: cy0, width: cw, height: artH, rx: 7, fill: shell, stroke: '#000', 'stroke-opacity': 0.6 }, g);
  svg('rect', { x: cx0, y: cy0, width: cw, height: artH, rx: 7, fill: 'url(#g-gloss)', opacity: 0.25 }, g);
  for (const [sx, sy] of [[cx0 + 6, cy0 + 6], [cx0 + cw - 6, cy0 + 6], [cx0 + 6, cy0 + artH - 6], [cx0 + cw - 6, cy0 + artH - 6]]) svg('circle', { cx: sx, cy: sy, r: 1.6, fill: 'url(#g-chromeR)' }, g);
  if (A.reels) {
    // reel-to-reel: two big reels and a tape path across the heads
    const r = 30;
    const lx = cx0 + 8 + r, rx2 = cx0 + cw - 8 - r, ry = cy0 + artH / 2 - 2;
    svg('path', { d: `M${lx} ${ry + r * 0.62}L${w / 2 - 14} ${cy0 + artH - 10}H${w / 2 + 14}L${rx2} ${ry + r * 0.62}`, stroke: '#4a3220', 'stroke-width': 1.6, fill: 'none' }, g);
    reelArt(g, lx, ry, r, A.reelCol || '#b9bec6', 3, '#2a2c30');
    reelArt(g, rx2, ry, r, A.reelCol || '#b9bec6', 3, '#2a2c30');
    svg('circle', { cx: lx, cy: ry, r: r * 0.7, fill: '#4a3220', opacity: 0.55 }, g);
    svg('circle', { cx: rx2, cy: ry, r: r * 0.5, fill: '#4a3220', opacity: 0.55 }, g);
    for (const hx of [-8, 0, 8]) svg('rect', { x: w / 2 + hx - 3, y: cy0 + artH - 14, width: 6, height: 7, rx: 1.5, fill: 'url(#g-chrome)' }, g);
    engrave(g, w / 2, cy0 + 12, def.logo || def.name, { size: 10, fill: def.logoColor || '#e9e4d8', font: def.logoFont || "'Oswald', sans-serif", ls: 2 });
  } else {
    // paper label with the model name hand-written, tape window with two hubs
    const lab = A.label || '#efe6cf';
    svg('rect', { x: cx0 + 9, y: cy0 + 8, width: cw - 18, height: artH - 22, rx: 4, fill: lab }, g);
    svg('rect', { x: cx0 + 9, y: cy0 + 8, width: cw - 18, height: 9, rx: 4, fill: accent }, g);
    svg('rect', { x: cx0 + 9, y: cy0 + 14, width: cw - 18, height: 3, fill: accent }, g);
    for (let i = 0; i < 3; i++) svg('line', { x1: cx0 + 16, x2: cx0 + cw - 16, y1: cy0 + 28 + i * 7, y2: cy0 + 28 + i * 7, stroke: '#9c8f74', 'stroke-width': 0.4, opacity: 0.6 }, g);
    label(g, cx0 + 16, cy0 + 12.6, A.side || 'A', { size: 6, fill: '#fff', weight: 800, anchor: 'start' });
    label(g, cx0 + cw - 16, cy0 + 12.6, A.minutes || 'C-60', { size: 5, fill: '#fff', weight: 800, anchor: 'end', ls: 1 });
    label(g, w / 2, cy0 + 27, def.logo || def.name, { size: def.logoSize || 15, fill: def.logoColor || '#2a2c6a', font: "'Dancing Script', cursive", weight: 700, ls: 0.4 });
    const wy = cy0 + 46, ww = 74;
    svg('rect', { x: w / 2 - ww / 2, y: wy - 9, width: ww, height: 18, rx: 9, fill: '#141518', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    svg('rect', { x: w / 2 - 14, y: wy - 6, width: 28, height: 12, rx: 2, fill: '#5a3a22', opacity: 0.85 }, g);
    reelArt(g, w / 2 - ww / 2 + 10, wy, 7.5, '#f2f2f2', 6, '#f2f2f2');
    reelArt(g, w / 2 + ww / 2 - 10, wy, 7.5, '#f2f2f2', 6, '#f2f2f2');
    // trapezoid bottom of the shell with head openings
    svg('path', { d: `M${w / 2 - 50} ${cy0 + artH}L${w / 2 - 42} ${cy0 + artH - 12}H${w / 2 + 42}L${w / 2 + 50} ${cy0 + artH}Z`, fill: shade(shell, 0.12), stroke: '#000', 'stroke-opacity': 0.4 }, g);
    for (const hx of [-28, -8, 8, 28]) svg('circle', { cx: w / 2 + hx, cy: cy0 + artH - 6, r: 2, fill: '#0a0a0b' }, g);
  }
  label(g, w / 2, cy0 + artH + 9, (def.typeName || def.cat).toUpperCase(), { size: 5.2, fill: txt, weight: 700, ls: 1.6, opacity: 0.75 });
  badge(g, w / 2, h - 9, txt, 4.2);
  footRow(def, w, footY, ledY, 12);
  const theme = { text: txt, knob: def.knob || 'chrome', labelSize: 6, labelLs: 0.5 };
  kit().placeControls(ctx, C, theme);
  return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks: kit().jacksSide(def, w, { y0: nf <= 1 ? ledY + 5 : cy0 + artH + 30, gap: 28, flip: ctx.flip }) };
}

// ------------------------------------------------------------------ playful: synth slab with scope + keys
function scopeTrace(kind, t) {
  const s = (k) => Math.sin(t * Math.PI * 2 * k);
  switch (kind) {
    case 'square': return Math.sign(s(2)) * 0.8;
    case 'saw': return 1 - 2 * ((t * 2.5) % 1);
    case 'organ': return 0.5 * s(2) + 0.3 * s(4) + 0.2 * s(8);
    case 'strings': return 0.6 * s(2) * (0.6 + 0.4 * s(0.5)) + 0.2 * s(6.03);
    case 'sub': return 0.9 * s(1) * Math.exp(-t * 0.6);
    case 'sweep': return s(2 + t * 6) * (1 - t * 0.5);
    default: return s(2);
  }
}
function scope(ctx, def) {
  const A = def.art || {};
  const g = ctx.g;
  const C = def.controls;
  const knobs = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c));
  const togs = C.filter((c) => (c.t === 'toggle' || c.t === 'button') && free(c));
  const nf = C.filter((c) => c.t === 'foot' && free(c)).length;
  const perRow = A.perRow || (knobs.length <= 4 ? 4 : knobs.length <= 8 ? 4 : 5);
  const rows = Math.ceil(knobs.length / perRow);
  const w = Math.max(212, 40 + perRow * 44, nf >= 2 ? 60 + nf * 66 : 0);
  const col = def.color || '#1b1d24';
  const accent = def.accent || '#3ddc84';
  const txt = def.text || inkFor(col);
  const slope = 12;
  const scrY = slope + 10, scrH = 50;
  let y = scrY + scrH + (knobs.some((k) => k.t === 'sel') ? 46 : 38);
  const kr = 11;
  for (let r = 0; r < rows; r++) {
    const list = knobs.slice(r * perRow, (r + 1) * perRow);
    const step = (w - 68) / (perRow - 1 || 1);
    const span = step * (list.length - 1);
    list.forEach((k, i) => {
      Object.assign(k, { x: w / 2 - span / 2 + step * i, y: y + r * 50, r: k.r || kr, labelPos: k.labelPos || 'below' });
      if (k.t === 'sel') { k.optSize = k.optSize || 4; k.labelRadius = k.labelRadius || 6.5; }
    });
  }
  y += (rows - 1) * 50 + kr + 18;
  if (togs.length) {
    y += 14;
    row(togs, togs.length === 1 ? w / 2 : 40, togs.length === 1 ? w / 2 : w - 40, y);
    togs.forEach((t) => { if (t.t === 'toggle') t.orient = 'h'; });
    y += 14;
  }
  const keysY = y + 6;
  const ledY = keysY + 30, footY = ledY + 28;
  const footLabels = C.some((c) => c.t === 'foot' && c.label);
  const h = footY + 13 + (footLabels ? 22 : 14) + 10;
  const r = 12;
  const path = `M${r} ${slope}L${w - r} 0Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${slope + r}Q0 ${slope} ${r} ${slope}Z`;
  const b = anod(g, w, h, col, { path, finish: A.finish });
  trim(g, b.clip, w, h, A.stripe || 'left', accent, 0);
  b.edge();
  // oscilloscope
  const sx = 14, sw = w - 28;
  svg('rect', { x: sx - 2.5, y: scrY - 2.5, width: sw + 5, height: scrH + 5, rx: 5, fill: '#08090b', stroke: '#000' }, g);
  svg('rect', { x: sx, y: scrY, width: sw, height: scrH, rx: 3, fill: rad('tzo-scope', [[0, '#0f2a1d'], [1, '#040a07']], 0.5, 0.5, 0.75) }, g);
  for (let i = 1; i < 8; i++) svg('line', { x1: sx + (sw * i) / 8, x2: sx + (sw * i) / 8, y1: scrY + 2, y2: scrY + scrH - 2, stroke: accent, 'stroke-opacity': i === 4 ? 0.22 : 0.08, 'stroke-width': 0.5 }, g);
  for (let i = 1; i < 4; i++) svg('line', { x1: sx + 2, x2: sx + sw - 2, y1: scrY + (scrH * i) / 4, y2: scrY + (scrH * i) / 4, stroke: accent, 'stroke-opacity': i === 2 ? 0.22 : 0.08, 'stroke-width': 0.5 }, g);
  const tr = wavePath((t) => scopeTrace(A.wave || 'sine', t), sx + sw / 2, scrY + scrH / 2, sw - 12, scrH - 14, 140);
  svg('path', { d: tr, fill: 'none', stroke: accent, 'stroke-width': 3.6, opacity: 0.18, 'stroke-linejoin': 'round' }, g);
  svg('path', { d: tr, fill: 'none', stroke: shade(accent, 0.45), 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
  svg('rect', { x: sx, y: scrY, width: sw, height: scrH, rx: 3, fill: 'url(#g-glass)', 'pointer-events': 'none' }, g);
  engrave(g, 16, scrY + scrH + 14, def.logo || def.name, { size: def.logoSize || 13, fill: def.logoColor || txt, anchor: 'start', font: def.logoFont || "'Oswald', sans-serif", weight: 700, ls: 2 });
  label(g, w - 16, scrY + scrH + 14, (def.typeName || def.cat).toUpperCase(), { size: 5, fill: txt, weight: 700, ls: 1.4, opacity: 0.75, anchor: 'end' });
  // mini keyboard strip
  const kx = 18, kw = w - 36, nk = 21, kwid = kw / nk;
  svg('rect', { x: kx - 2, y: keysY - 2, width: kw + 4, height: 20, rx: 3, fill: '#0b0c0e' }, g);
  for (let i = 0; i < nk; i++) svg('rect', { x: kx + i * kwid + 0.4, y: keysY, width: kwid - 0.8, height: 16, rx: 1, fill: '#ecebe6' }, g);
  for (let i = 0; i < nk - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) svg('rect', { x: kx + (i + 1) * kwid - kwid * 0.3, y: keysY, width: kwid * 0.6, height: 9.5, rx: 0.8, fill: '#16171a' }, g);
  svg('rect', { x: kx + 9 * kwid + 0.4, y: keysY, width: kwid - 0.8, height: 16, rx: 1, fill: accent, opacity: 0.55 }, g);
  badge(g, w / 2, h - 9, txt, 4.2);
  footRow(def, w, footY, ledY, 12);
  const theme = { text: txt, knob: def.knob || 'strymon', labelSize: 6, labelLs: 0.5 };
  kit().placeControls(ctx, C, theme);
  return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks: kit().jacksSide(def, w, { y0: nf <= 1 ? ledY + 5 : keysY - 30, gap: 28, flip: ctx.flip }) };
}

// ------------------------------------------------------------------ Tone Zone trim for the amp / cab forms
function tzAmp(ctx, def) {
  const res = kit().callForm('amp', ctx, def);
  const g = ctx.g, w = res.w, h = res.h;
  const acc = def.accent || '#ff7a2f';
  const deco = svg('g', { 'pointer-events': 'none' }, g);
  const yStripe = def.combo ? 100 : h - 99;
  svg('rect', { x: 20, y: yStripe - 1.2, width: w - 40, height: 2.4, rx: 1.2, fill: acc, opacity: 0.95 }, deco);
  svg('rect', { x: 20, y: yStripe + 1.2, width: w - 40, height: 0.6, fill: '#000', opacity: 0.5 }, deco);
  const by = def.combo ? h - 24 : h - 106;
  if (def.combo) {
    svg('rect', { x: w - 80, y: by - 5, width: 58, height: 10, rx: 5, fill: '#101114', opacity: 0.75 }, deco);
    if (def.series) svg('rect', { x: 22, y: by - 5, width: def.series.length * 4.6 + 8, height: 10, rx: 5, fill: '#101114', opacity: 0.75 }, deco);
  }
  badge(deco, w - 26, by, '#e9ecf3', 4.6, 'end');
  if (def.series) label(deco, 26, by, def.series, { size: 4.6, fill: acc, weight: 800, ls: 1.4, anchor: 'start', opacity: 0.9 });
  return res;
}
function tzCab(ctx, def) {
  const res = kit().callForm('cab', ctx, def);
  const g = ctx.g, w = res.w, h = res.h;
  const acc = def.accent || '#ff7a2f';
  const deco = svg('g', { 'pointer-events': 'none' }, g);
  for (const y of [8.5, h - 8.5]) svg('rect', { x: 24, y: y - 1, width: w - 48, height: 2, rx: 1, fill: acc, opacity: 0.9 }, deco);
  svg('rect', { x: w - 80, y: h - 31, width: 58, height: 10, rx: 5, fill: '#101114', opacity: 0.7 }, deco);
  badge(deco, w - 26, h - 26, '#e9ecf3', 4.4, 'end');
  return res;
}

export function installTzForms(registerForm, k) {
  if (k && k.formKit) injected = k.formKit;
  registerForm('tz2-studio', studio);
  registerForm('tz2-treadle', treadle);
  registerForm('tz2-orb', orb);
  registerForm('tz2-cassette', cassette);
  registerForm('tz2-scope', scope);
  registerForm('tz2-amp', tzAmp);
  registerForm('tz2-cab', tzCab);
}
