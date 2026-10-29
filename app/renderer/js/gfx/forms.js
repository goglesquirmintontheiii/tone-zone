// Enclosure renderers ("forms"): BOSS-style compact, MXR, 9-series, Strymon (medium / small), loopers, tuners,
// multi-FX, wah / volume treadles, amp heads, combos, cabinets, rack units, utilities and the audio I/O panels.
// Each form lays out the block's controls and returns jacks + control views for the editor.
import { svg, shade, luminance } from '../util.js';
import { softShadow } from './fx.js';
import { drawJack } from './jacks.js';
import { installTzForms } from './forms-tz.js';
import { installTz4Forms } from './forms-tz4.js';
import { installTz3Forms } from './forms-tz3.js';
import { installTz5Forms } from './forms-tz5.js';
import { installTz6Forms } from './forms-tz6.js';
import { cabGeom, MIC_SHORT, MIC_COLORS } from './cabgeom.js';
import { drawKnob, drawSelector, drawToggle, drawButton, drawLed, drawFoot, drawSlider, drawTreadle, label, hex, textColorFor } from './controls.js';

function body(g, w, h, color, o = {}) {
  const rx = o.rx ?? 8;
  softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
  svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: color }, g);
  if (o.brushed) svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#p-brushed)' }, g);
  if (o.grain !== false) svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#p-grain)' }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#g-shadeV)' }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#g-shadeH)' }, g);
  svg('rect', { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: rx - 0.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 1.2 }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
}
function screw(g, x, y, r = 3.2) {
  svg('circle', { cx: x, cy: y + 0.6, r: r + 0.6, fill: '#000', opacity: 0.4 }, g);
  svg('circle', { cx: x, cy: y, r, fill: 'url(#g-chromeR)' }, g);
  const a = Math.random() * Math.PI;
  svg('line', { x1: x - Math.cos(a) * r * 0.7, y1: y - Math.sin(a) * r * 0.7, x2: x + Math.cos(a) * r * 0.7, y2: y + Math.sin(a) * r * 0.7, stroke: '#3a3f45', 'stroke-width': 0.9 }, g);
}
function tzBadge(g, x, y, color, size = 5) {
  return label(g, x, y, 'TONE ZONE', { size, fill: color, weight: 800, ls: 1.2, opacity: 0.8 });
}

// ------------------------------------------------------------------ helpers for controls
function placeControls(ctx, list, theme) {
  for (const c of list) {
    if (c.hidden) continue;
    let view;
    switch (c.t) {
      case 'knob': view = drawKnob(ctx.g, c, theme); break;
      case 'sel': view = drawSelector(ctx.g, c, theme); break;
      case 'toggle': view = drawToggle(ctx.g, c, theme); break;
      case 'button': view = drawButton(ctx.g, c, theme); break;
      case 'led': view = drawLed(ctx.g, c); break;
      case 'foot': view = drawFoot(ctx.g, c, theme); break;
      case 'slider': view = drawSlider(ctx.g, c, theme); break;
      case 'treadle': view = drawTreadle(ctx.g, c); break;
      case 'screen': view = drawScreenFrame(ctx.g, c); break;
      case 'mic': view = drawMic(ctx.g, c); break;
      default: continue;
    }
    ctx.views.set(c.cid, { ctl: c, view });
  }
}

let screenSeq = 0;
function drawScreenFrame(g, c) {
  const s = svg('g', { transform: `translate(${c.x},${c.y})`, class: c.interactive ? 'ctl' : '' }, g);
  if (c.interactive) s.dataset.ctl = c.cid;
  svg('rect', { x: -c.w / 2 - 2.5, y: -c.h / 2 - 2.5, width: c.w + 5, height: c.h + 5, rx: 4, fill: c.bezel || '#0b0b0c', stroke: '#000', 'stroke-width': 0.6 }, s);
  const area = svg('g', { transform: `translate(${-c.w / 2},${-c.h / 2})` }, s);
  svg('rect', { width: c.w, height: c.h, rx: 2, fill: c.bg || 'url(#g-screen)' }, area);
  const clipId = 'sc' + (++screenSeq);
  const cp = svg('clipPath', { id: clipId }, area);
  svg('rect', { width: c.w, height: c.h, rx: 2 }, cp);
  const content = svg('g', { 'clip-path': `url(#${clipId})` }, area);
  svg('rect', { width: c.w, height: c.h, rx: 2, fill: 'url(#g-glass)', 'pointer-events': 'none' }, area);
  return { g: s, content, w: c.w, h: c.h, set() {} };
}

// draggable microphone in front of the speakers: x / y anywhere over the grille, size shows distance
function micHead(g, type) {
  switch (type) {
    case 1: // 414: large-diaphragm, gold grille
    case 6: // 87: nickel
      svg('rect', { x: -7.5, y: -11, width: 15, height: 22, rx: 7.5, fill: type === 1 ? '#b9a26a' : '#c9ccd1', stroke: '#2a2a2a', 'stroke-width': 0.6 }, g);
      svg('rect', { x: -6, y: -9.5, width: 12, height: 13, rx: 6, fill: type === 1 ? 'url(#p-grille-wheat)' : 'url(#p-grille-silver)' }, g);
      svg('rect', { x: -7.5, y: 4, width: 15, height: 1.2, fill: '#000', opacity: 0.4 }, g);
      break;
    case 2: // 121 ribbon: slotted bar
    case 7:
      svg('rect', { x: -5.5, y: -12, width: 11, height: 24, rx: 3, fill: type === 2 ? '#9aa0a8' : '#2b2c30', stroke: '#111', 'stroke-width': 0.6 }, g);
      for (let i = -9; i <= 9; i += 2.4) svg('rect', { x: -3.6, y: i, width: 7.2, height: 1.1, rx: 0.5, fill: '#0d0d0f', opacity: 0.85 }, g);
      break;
    case 3: // 421: dark oblong with slots
    case 5: // 441: long silver
      svg('rect', { x: -5.5, y: -12, width: 11, height: 24, rx: 5.5, fill: type === 3 ? '#26272b' : '#b8bcc2', stroke: '#111', 'stroke-width': 0.6 }, g);
      for (let i = -8; i <= 2; i += 2.5) svg('rect', { x: -4, y: i, width: 8, height: 1.2, rx: 0.6, fill: type === 3 ? '#55575d' : '#5a5e65' }, g);
      break;
    case 4: // 906: flat, hangs over the cab
      svg('rect', { x: -9, y: -5, width: 18, height: 10, rx: 3, fill: '#1d1e21', stroke: '#000', 'stroke-width': 0.6 }, g);
      svg('rect', { x: -7, y: -3.2, width: 14, height: 6.4, rx: 2, fill: 'url(#p-grille-black)' }, g);
      break;
    default: // 57: mesh ball
      svg('circle', { r: 8, fill: '#2b2e33', stroke: '#c7ccd2', 'stroke-width': 1.6 }, g);
      svg('circle', { r: 5.6, fill: 'url(#p-grille-silver)' }, g);
  }
  svg('ellipse', { cx: -2.5, cy: -4, rx: 2.6, ry: 1.6, fill: '#fff', opacity: 0.22 }, g);
}
function drawMic(g, c) {
  const geo = c.geom;
  const m = svg('g', { class: 'ctl mic' }, g);
  m.dataset.ctl = c.cid;
  const body = svg('g', {}, m);
  let lastType = -1;
  const col = MIC_COLORS[(c.idx - 1) % 4];
  return {
    g: m,
    set(v) {
      m.style.display = v.on ? '' : 'none';
      if (!v.on) return;
      const x = geo.gx + (v.x ?? 0.5) * geo.gw, y = geo.gy + (v.y ?? 0.5) * geo.gh;
      const sc = 1.5 - 0.55 * (v.dist ?? 0.15);
      m.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const bottom = geo.gy + geo.gh + 16 - y;
      const key = `${v.type}|${sc.toFixed(2)}|${v.sel ? 1 : 0}|${Math.round(bottom)}`;
      if (key === lastType) return;
      lastType = key;
      body.innerHTML = '';
      svg('circle', { r: 26, fill: 'transparent' }, body);
      // cable / stand shadow dropping out of view and the mic shadow on the grille (farther = softer, offset)
      svg('ellipse', { cx: 3 + 6 * (v.dist ?? 0), cy: 6 + 8 * (v.dist ?? 0), rx: 10 * sc, ry: 12 * sc, fill: '#000', opacity: 0.38 - 0.18 * (v.dist ?? 0) }, body);
      svg('path', { d: `M0 ${10 * sc} C 0 ${(bottom * 0.55).toFixed(1)} 14 ${(bottom * 0.85).toFixed(1)} 22 ${bottom.toFixed(1)}`, stroke: '#0c0c0d', 'stroke-width': 2.6, fill: 'none', opacity: 0.9, 'stroke-linecap': 'round' }, body);
      const head = svg('g', { transform: `scale(${sc.toFixed(2)})` }, body);
      micHead(head, v.type | 0);
      if (v.sel) svg('circle', { r: 17 * sc, fill: 'none', stroke: col, 'stroke-width': 1.6, 'stroke-dasharray': '3 2' }, body);
      const tag = svg('g', { transform: `translate(${(13 * sc).toFixed(1)},${(-13 * sc).toFixed(1)})` }, body);
      svg('circle', { r: 5.2, fill: col, stroke: '#000', 'stroke-width': 0.6 }, tag);
      label(tag, 0, 0.3, String(c.idx), { size: 6.2, fill: '#111', weight: 800 });
      label(body, 0, 18 * sc + 7, MIC_SHORT[v.type | 0], { size: 6, fill: '#eee', weight: 800 });
    },
  };
}

function jacksSide(def, w, opts = {}) {
  // default: inputs on the right, outputs on the left (real pedal convention); flipped when board flow is L->R
  const ins = def.ports.ins, outs = def.ports.outs;
  const flip = opts.flip;
  const y0 = opts.y0 ?? 54, gap = opts.gap ?? 28;
  const out = [];
  ins.forEach((l, i) => out.push({ key: `i${i}`, dir: 'in', port: i, label: l, side: flip ? 'left' : 'right', x: flip ? -2 : w + 2, y: y0 + i * gap }));
  outs.forEach((l, i) => out.push({ key: `o${i}`, dir: 'out', port: i, label: l, side: flip ? 'right' : 'left', x: flip ? w + 2 : -2, y: y0 + i * gap }));
  return out;
}
function jacksTop(def, w, opts = {}) {
  const ins = def.ports.ins, outs = def.ports.outs;
  const all = [...outs.map((l, i) => ({ dir: 'out', port: i, label: l })), ...ins.map((l, i) => ({ dir: 'in', port: i, label: l }))];
  if (opts.flip) all.reverse();
  const n = all.length;
  const short = (l) => l.replace(/^INPUT/, 'IN').replace(/^OUTPUT/, 'OUT').replace(' A (MONO)', ' L').replace(/ B$/, ' R').replace('L/MONO', 'L').replace('RIGHT', 'R');
  return all.map((j, k) => ({ key: (j.dir === 'in' ? 'i' : 'o') + j.port, dir: j.dir, port: j.port, label: short(j.label), side: 'top', x: w * (0.15 + (0.7 * (n === 1 ? 0.5 : k / (n - 1)))), y: -2 }));
}

function autoRow(list, x0, x1, y) {
  const n = list.length;
  list.forEach((c, i) => {
    if (c.x === undefined) c.x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    if (c.y === undefined) c.y = y;
  });
}

// ------------------------------------------------------------------ forms
const forms = {};

// BOSS-style compact pedal
forms.compact = (ctx, def) => {
  const w = 146, h = 258;
  const col = def.color, txt = def.text || textColorFor(col);
  const g = ctx.g;
  body(g, w, h, col, { rx: 10 });
  const theme = { text: txt, labelFont: "'Barlow Condensed', sans-serif", labelSize: 7.2, knob: 'boss' };
  // top panel shading
  svg('rect', { x: 4, y: 4, width: w - 8, height: 98, rx: 7, fill: '#000', opacity: 0.06 }, g);
  // pedal plate (footswitch) with hinge gap
  const py = 106;
  svg('path', { d: `M6 ${py} H${w - 6}`, stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 2.2 }, g);
  svg('rect', { x: 6, y: py + 2, width: w - 12, height: h - py - 8, rx: 9, fill: col }, g);
  svg('rect', { x: 6, y: py + 2, width: w - 12, height: h - py - 8, rx: 9, fill: 'url(#g-shadeV)', opacity: 0.85 }, g);
  svg('rect', { x: 6.5, y: py + 2.5, width: w - 13, height: h - py - 9, rx: 8.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22 }, g);
  // name label
  const lb = svg('g', {}, g);
  svg('rect', { x: 16, y: py + 12, width: w - 32, height: 44, rx: 3, fill: def.labelBg || '#141414' }, lb);
  svg('rect', { x: 16, y: py + 12, width: w - 32, height: 44, rx: 3, fill: 'url(#g-gloss)', opacity: 0.35 }, lb);
  label(lb, w / 2, py + 25, def.typeName || def.cat, { size: 9.5, fill: def.labelText || '#f4f4f4', weight: 700, italic: true, font: "'Barlow Condensed', sans-serif", ls: 0.6 });
  label(lb, w / 2, py + 43, def.code, { size: 18, fill: def.codeColor || col, weight: 800, ls: 1.4 });
  tzBadge(g, w / 2, py + 68, txt, 5.2);
  // rubber pad
  svg('rect', { x: 12, y: h - 58, width: w - 24, height: 44, rx: 5, fill: 'url(#g-rubber)' }, g);
  svg('rect', { x: 15, y: h - 55, width: w - 30, height: 38, rx: 3, fill: 'url(#p-ridges)' }, g);
  screw(g, w / 2, h - 6.5, 3.4);
  // controls
  const knobs = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined && !c.inner);
  const n = knobs.length;
  const margin = n >= 4 ? 22 : 30;
  const lastSel = knobs.length && knobs[knobs.length - 1].t === 'sel' && knobs[knobs.length - 1].options.length > 4;
  autoRow(knobs, margin - (lastSel ? 3 : 0), w - margin - (lastSel ? 9 : 0), 52);
  if (lastSel) {
    const sel = knobs[knobs.length - 1];
    sel.labelRadius = sel.labelRadius ?? 7.5;
    sel.optSize = Math.min(sel.optSize || 5, sel.options.length > 8 ? 3.7 : 4.2);
  }
  knobs.forEach((k) => {
    k.r = k.r || (n >= 4 ? 11.5 : 12.5);
    k.labelPos = k.labelPos || 'above';
  });
  // concentric inner knobs share the outer knob's position
  def.controls.filter((c) => c.inner).forEach((c) => {
    const outer = def.controls.find((o) => o.p === c.inner);
    if (outer) { c.x = outer.x; c.y = outer.y; c.r = (outer.r || 12) * 0.62; c.labelPos = 'none'; }
  });
  const sliders = def.controls.filter((c) => c.t === 'slider' && c.x === undefined);
  autoRow(sliders, 18, w - 18, 56);
  sliders.forEach((s) => (s.h = 46));
  def.controls.filter((c) => c.t === 'button' && c.x === undefined).forEach((b, i, arr) => { b.x = arr.length === 1 ? w - 26 : 30 + i * (w - 60) / Math.max(1, arr.length - 1); b.y = b.y ?? 88; });
  def.controls.forEach((c) => {
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'plate', x: w / 2, y: (py + h) / 2, w: w - 12, h: h - py - 6 });
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: 22, y: 16, r: 2.8, label: c.label ?? 'CHECK', textColor: txt });
    if (c.t === 'screen' && c.x === undefined) Object.assign(c, { x: w / 2, y: 54, w: w - 36, h: 44 });
  });
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 92, gap: 20, flip: ctx.flip }) };
};

// MXR-style box
forms.mxr = (ctx, def) => {
  const w = def.wide ? 196 : 128, h = 222;
  const col = def.color, txt = def.text || textColorFor(col);
  const g = ctx.g;
  body(g, w, h, col, { rx: 7 });
  const theme = { text: txt, knob: 'mxr', labelSize: 7 };
  const knobs = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
  const n = knobs.length;
  if (n <= 3) autoRow(knobs, n === 1 ? w / 2 : 30, n === 1 ? w / 2 : w - 30, 40);
  else {
    const top = knobs.slice(0, Math.ceil(n / 2)), bot = knobs.slice(Math.ceil(n / 2));
    autoRow(top, 26, w - 26, 34);
    autoRow(bot, 26, w - 26, 74);
  }
  knobs.forEach((k) => (k.r = k.r || (n <= 2 ? 15 : n === 3 ? 13 : 11)));
  const sliders = def.controls.filter((c) => c.t === 'slider' && c.x === undefined);
  if (sliders.length) {
    autoRow(sliders, 16, w - 16, 62);
    sliders.forEach((s) => Object.assign(s, { h: 62, w: 6.5, led: true, labelSize: 4.6 }));
  }
  const hasBtn = def.controls.some((c) => c.t === 'button');
  const logoY = sliders.length ? 116 : n > 3 ? (hasBtn ? 136 : 118) : hasBtn ? 114 : 104;
  if (def.logo) label(g, w / 2, logoY, def.logo, { size: def.logoSize || 22, fill: def.logoColor || txt, font: def.logoFont || "'Dancing Script', cursive", weight: 700, ls: 0.2 });
  label(g, w / 2, logoY + 18, def.code, { size: 8, fill: txt, weight: 700, ls: 1.6, opacity: 0.85 });
  tzBadge(g, w / 2, h - 10, txt, 4.6);
  def.controls.forEach((c) => {
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'stomp', x: w / 2, y: n > 3 && hasBtn ? 190 : 180, r: 13 });
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: n > 3 && hasBtn ? 163 : 150, r: 3 });
    if (c.t === 'button' && c.x === undefined) Object.assign(c, { x: w / 2, y: 86, r: 5, led: true, ledDy: -9 });
    if (c.t === 'button' && n > 3 && c.y === 120) c.y = 108;
  });
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 46, gap: 28, flip: ctx.flip }) };
};

// Ibanez 9-series
forms.nine = (ctx, def) => {
  const w = 150, h = 250;
  const col = def.color, txt = def.text || textColorFor(col);
  const g = ctx.g;
  softShadow(g, { w, h, path: `M10 4 Q${w / 2} -8 ${w - 10} 4 L${w} 30 V${h - 8} Q${w} ${h} ${w - 8} ${h} H8 Q0 ${h} 0 ${h - 8} V30 Z`, dy: 14, blur: 9, opacity: 0.55 });
  const shape = `M10 4 Q${w / 2} -8 ${w - 10} 4 L${w} 30 V${h - 8} Q${w} ${h} ${w - 8} ${h} H8 Q0 ${h} 0 ${h - 8} V30 Z`;
  svg('path', { d: shape, fill: col }, g);
  svg('path', { d: shape, fill: 'url(#p-grain)' }, g);
  svg('path', { d: shape, fill: 'url(#g-shadeV)' }, g);
  svg('path', { d: shape, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5 }, g);
  const theme = { text: txt, knob: 'boss', labelSize: 7.4 };
  const knobs = def.controls.filter((c) => c.t === 'knob' && c.x === undefined);
  if (knobs.length === 3) {
    Object.assign(knobs[0], { x: 36, y: 50, r: 16 });
    Object.assign(knobs[1], { x: w / 2, y: 42, r: 10 });
    Object.assign(knobs[2], { x: w - 36, y: 50, r: 16 });
  } else if (knobs.length === 2) {
    Object.assign(knobs[0], { x: 38, y: 48, r: 15 });
    Object.assign(knobs[1], { x: w - 38, y: 48, r: 15 });
  } else autoRow(knobs, 26, w - 26, 46), knobs.forEach((k) => (k.r = 11));
  knobs.forEach((k) => (k.style = k.style || 'nine'));
  // name plate
  const plate = svg('g', {}, g);
  svg('rect', { x: 16, y: 84, width: w - 32, height: 30, rx: 2, fill: def.plate || 'url(#g-chrome)', opacity: def.plate ? 1 : 0.9 }, plate);
  label(plate, w / 2, 95, def.logo || def.name, { size: 11, fill: def.plateText || '#151515', weight: 800, ls: 1 });
  label(plate, w / 2, 107, def.code, { size: 7, fill: def.plateText || '#151515', weight: 700, ls: 2 });
  def.controls.forEach((c) => {
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'ts', x: w / 2, y: 182, w: 124, h: 104, color: '#202124' });
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: 18, r: 3 });
  });
  tzBadge(g, w / 2, 124, txt, 4.8);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 56, gap: 28, flip: ctx.flip }) };
};

// Strymon-style medium 2-footswitch enclosure (and the 1-footswitch compact family)
forms.strymon = (ctx, def) => {
  const small = def.small;
  const w = small ? 128 : 204, h = 230;
  const col = def.color, txt = def.text || textColorFor(col);
  const g = ctx.g;
  body(g, w, h, col, { rx: 6, brushed: true });
  const theme = { text: txt, knob: 'strymon', labelSize: 6.3, labelLs: 0.3, toggleTitles: false };
  const rows = def.rows || null;
  const knobs = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
  if (small) {
    const top = knobs.slice(0, 3), bot = knobs.slice(3);
    autoRow(top, 26, w - 26, 40);
    autoRow(bot, 26, w - 26, 92);
    knobs.forEach((k) => (k.r = k.r || 11));
  } else {
    const top = knobs.slice(0, rows ? rows[0] : 3), bot = knobs.slice(rows ? rows[0] : 3);
    autoRow(top, 40, w - 40, 42);
    autoRow(bot, 40, w - 40, 104);
    knobs.forEach((k) => (k.r = k.r || 13));
  }
  const toggles = def.controls.filter((c) => c.t === 'toggle' && c.x === undefined);
  toggles.forEach((t, i) => {
    if (small) { t.x = toggles.length === 1 ? w / 2 : 36 + i * (w - 72); t.y = 92; }
    else { t.x = toggles.length === 1 ? w / 2 : toggles.length === 2 ? [w * 0.36, w * 0.64][i] : 50 + i * ((w - 100) / (toggles.length - 1)); t.y = 73; }
    t.orient = t.orient || 'h';
  });
  // brand / model text
  label(g, w / 2, small ? 128 : 140, def.logo || def.name.toLowerCase(), { size: small ? 15 : 19, fill: txt, font: "'Inter', sans-serif", weight: 700, ls: small ? 0.6 : 1.2 });
  label(g, w / 2, small ? 142 : 156, def.tagline || def.typeName || '', { size: 5.6, fill: txt, weight: 700, ls: 1.4, opacity: 0.75 });
  tzBadge(g, w / 2, h - 9, txt, 4.4);
  const foots = def.controls.filter((c) => c.t === 'foot' && c.x === undefined);
  foots.forEach((f, i) => {
    Object.assign(f, { style: 'stomp', r: 12, y: 192, x: foots.length === 1 ? w / 2 : [w * 0.27, w * 0.73][i] });
  });
  const leds = def.controls.filter((c) => c.t === 'led' && c.x === undefined);
  leds.forEach((l, i) => Object.assign(l, { r: 2.8, y: 166, x: leds.length === 1 ? w / 2 : [w * 0.27, w * 0.73][i] }));
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksTop(def, w, { flip: ctx.flip }) };
};

// generic Tone Zone original pedal
forms.tz = (ctx, def) => {
  const nk = def.controls.filter((c) => c.t === 'knob' || c.t === 'sel').length;
  const w = nk > 6 ? 196 : 150, h = 250;
  const col = def.color, txt = def.text || textColorFor(col);
  const g = ctx.g;
  body(g, w, h, col, { rx: 12 });
  // accent stripe
  svg('rect', { x: 0, y: 128, width: w, height: 4, fill: def.accent || shade(col, luminance(col) > 0.5 ? -0.35 : 0.35), opacity: 0.85 }, g);
  const theme = { text: txt, knob: def.knob || 'mxr', labelSize: 6.6 };
  const knobs = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
  const perRow = nk > 6 ? 4 : 3;
  const rowsK = [];
  for (let i = 0; i < knobs.length; i += perRow) rowsK.push(knobs.slice(i, i + perRow));
  rowsK.forEach((r, ri) => {
    autoRow(r, r.length === 1 ? w / 2 : 30, r.length === 1 ? w / 2 : w - 30, 34 + ri * 46);
    r.forEach((k) => (k.r = k.r || (knobs.length <= 3 ? 13 : 11)));
  });
  const toggles = def.controls.filter((c) => (c.t === 'toggle' || c.t === 'button') && c.x === undefined);
  toggles.forEach((t, i) => { t.x = toggles.length === 1 ? w / 2 : 30 + (i * (w - 60)) / (toggles.length - 1); t.y = 34 + rowsK.length * 46; t.orient = t.orient || 'h'; });
  label(g, w / 2, 148, def.logo || def.name, { size: def.logo && def.logo.length > 12 ? 11 : 14, fill: txt, weight: 800, ls: 1.2 });
  label(g, w / 2, 160, (def.typeName || def.cat).toUpperCase(), { size: 5.4, fill: txt, weight: 700, ls: 1.6, opacity: 0.7 });
  tzBadge(g, w / 2, h - 10, txt, 4.4);
  def.controls.forEach((c) => {
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'stomp', x: w / 2, y: 204, r: 13 });
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: 176, r: 3 });
    if (c.t === 'screen' && c.x === undefined) {
      if (c.kind === 'modelName') Object.assign(c, { x: w / 2, y: 186, w: Math.min(c.w || 88, w - 30), h: 14 });
      else Object.assign(c, { x: w / 2, y: c.y ?? 54, w: c.w || w - 30, h: c.h || 52 });
    }
  });
  if (def.controls.some((c) => c.kind === 'modelName')) def.controls.forEach((c) => { if (c.t === 'led' && c.y === 176) c.y = 170; });
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 48, gap: 28, flip: ctx.flip }) };
};

// pro co style wedge
forms.rat = (ctx, def) => {
  const w = 150, h = 176;
  const g = ctx.g;
  body(g, w, h, def.color, { rx: 5 });
  svg('rect', { x: 0, y: 0, width: w, height: 70, rx: 5, fill: '#000', opacity: 0.18 }, g);
  const theme = { text: def.text || '#f0f0f0', knob: 'chrome', labelSize: 7 };
  const knobs = def.controls.filter((c) => c.t === 'knob');
  autoRow(knobs, 30, w - 30, 36);
  knobs.forEach((k) => ((k.r = 13), (k.style = 'rat'), (k.labelPos = 'below')));
  label(g, w / 2 - 6, 102, def.logo || 'RODENT', { size: 30, fill: def.logoColor || '#f2f2f2', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
  label(g, w / 2, 124, def.code, { size: 6.5, fill: theme.text, weight: 700, ls: 2.4 });
  def.controls.forEach((c) => {
    if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: w / 2 + 30, y: 150, r: 12 });
    if (c.t === 'led') Object.assign(c, { x: w / 2 - 30, y: 150, r: 3.2 });
  });
  tzBadge(g, w / 2 - 30, 166, theme.text, 4.2);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 40, flip: ctx.flip }) };
};

// RC-500 style 2-track looper
forms.rc500 = (ctx, def) => {
  const w = 300, h = 250;
  const g = ctx.g;
  body(g, w, h, def.color, { rx: 12 });
  const txt = '#f4f4f4';
  const theme = { text: txt, knob: 'boss', labelSize: 6.2 };
  svg('rect', { x: 10, y: 10, width: w - 20, height: 112, rx: 8, fill: '#151515', opacity: 0.92 }, g);
  svg('rect', { x: 10, y: 10, width: w - 20, height: 112, rx: 8, fill: 'url(#g-gloss)', opacity: 0.25 }, g);
  label(g, 46, 132, def.code, { size: 9, fill: '#fff', weight: 800, ls: 1.5 });
  label(g, w - 70, 132, 'Loop Station', { size: 8, fill: '#fff', weight: 700, italic: true });
  tzBadge(g, w / 2, 132, '#fff', 4.4);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 150, gap: 28, flip: ctx.flip }) };
};

// RC-600 style 6-track looper
forms.rc600 = (ctx, def) => {
  const w = 620, h = 256;
  const g = ctx.g;
  body(g, w, h, def.color, { rx: 12 });
  const theme = { text: '#f4f4f4', knob: 'boss', labelSize: 6 };
  svg('rect', { x: 12, y: 12, width: 232, height: 104, rx: 8, fill: '#141414', opacity: 0.94 }, g);
  svg('rect', { x: 12, y: 12, width: 232, height: 104, rx: 8, fill: 'url(#g-gloss)', opacity: 0.2 }, g);
  label(g, 270, 30, def.code, { size: 12, fill: '#fff', weight: 800, ls: 1.5, anchor: 'start' });
  label(g, 270, 45, 'Loop Station', { size: 8.5, fill: '#fff', weight: 700, italic: true, anchor: 'start' });
  tzBadge(g, 300, 62, '#fff', 4.6);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 36, gap: 24, flip: ctx.flip }) };
};

// PolyTune-style tuner
forms.polytune = (ctx, def) => {
  const w = 144, h = 244;
  const g = ctx.g;
  body(g, w, h, def.color, { rx: 9 });
  const txt = def.text || '#eaeaea';
  const theme = { text: txt, labelSize: 5.4 };
  label(g, w / 2, 136, def.logo || 'PolyTone 3', { size: 13, fill: txt, weight: 700, font: "'Inter', sans-serif", ls: 0.2 });
  label(g, w / 2, 148, 'POLYPHONIC TUNER', { size: 5.2, fill: txt, weight: 700, ls: 1.8, opacity: 0.7 });
  tzBadge(g, w / 2, h - 9, txt, 4.4);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 60, flip: ctx.flip }) };
};

// DigiTech Drop style
forms.drop = (ctx, def) => {
  const w = 146, h = 244;
  const g = ctx.g;
  body(g, w, h, def.color, { rx: 10 });
  const txt = '#ffffff';
  const theme = { text: txt, labelSize: 6 };
  svg('rect', { x: 10, y: 112, width: w - 20, height: 40, rx: 4, fill: '#111', opacity: 0.9 }, g);
  label(g, w / 2, 129, def.logo || 'DROPPER', { size: 20, fill: '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 3 });
  label(g, w / 2, 145, 'POLYPHONIC DROP TUNE', { size: 5.2, fill: '#ddd', weight: 700, ls: 1.5 });
  tzBadge(g, w / 2, h - 9, txt, 4.4);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 58, flip: ctx.flip }) };
};

// POD Express style multi-effect
forms.pod = (ctx, def) => {
  const w = 184, h = 262;
  const g = ctx.g;
  body(g, w, h, def.color, { rx: 16 });
  svg('rect', { x: 10, y: 10, width: w - 20, height: 176, rx: 12, fill: '#111214', opacity: 0.95 }, g);
  svg('rect', { x: 10, y: 10, width: w - 20, height: 176, rx: 12, fill: 'url(#g-gloss)', opacity: 0.18 }, g);
  const theme = { text: '#eeeeee', knob: 'chrome', labelSize: 6 };
  label(g, w / 2, 172, def.logo || 'POD-X', { size: 9, fill: '#fff', weight: 800, ls: 2 });
  tzBadge(g, w / 2, h - 9, '#fff', 4.2);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksTop(def, w, { flip: ctx.flip }) };
};

// wah / volume / whammy treadle
forms.treadle = (ctx, def) => {
  const w = def.wide ? 180 : 152, h = 304;
  const g = ctx.g;
  body(g, w, h, def.color || '#1a1a1c', { rx: 14 });
  svg('rect', { x: 6, y: h - 34, width: w - 12, height: 26, rx: 6, fill: '#0c0c0d', opacity: 0.6 }, g);
  const theme = { text: def.text || '#d8d8d8', knob: 'mxr', labelSize: 6 };
  def.controls.forEach((c) => {
    if (c.t === 'treadle' && c.x === undefined) Object.assign(c, { x: w / 2, y: h / 2 - 12, w: w - 30, h: h - 66, color: def.treadleColor || '#161618', logo: def.logo, logoColor: def.logoColor, logoFont: def.logoFont });
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 21, r: 2.6 });
  });
  label(g, 26, h - 21, def.code, { size: 6, fill: theme.text, weight: 800, ls: 1, anchor: 'start' });
  if (!def.controls.some((c) => c.t === 'sel')) tzBadge(g, w - 26, h - 21, theme.text, 4.2).setAttribute('text-anchor', 'end');
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: h - 92, gap: 24, flip: ctx.flip }) };
};

// amp head / combo

// Valves standing on top of an enclosure. Shared gradients (g-tube*) keep them cheap; only the heater glow
// elements change at runtime (ctx.tubeGlows, flickered by the block view a few times a second).
// groups: [{ x0 | x1 (right edge), n, power }]
export const TUBE_DIM = { power: { w: 11, h: 31, gap: 3.5 }, pre: { w: 7.4, h: 20, gap: 3 } };
function drawTubes(ctx, groups) {
  const g = svg('g', { 'pointer-events': 'none' }, ctx.g);
  ctx.tubeGlows = ctx.tubeGlows || [];
  for (const { x0, x1, n, power } of groups) {
    const D = power ? TUBE_DIM.power : TUBE_DIM.pre;
    const tw = D.w, th = D.h, span = n * tw + (n - 1) * D.gap;
    const start = x0 ?? x1 - span;
    for (let i = 0; i < n; i++) {
      const cx = start + i * (tw + D.gap) + tw / 2, r = tw / 2;
      // chrome socket ring and a warm reflection of the glow on it
      svg('rect', { x: cx - r - 1.6, y: -2.6, width: tw + 3.2, height: 3.4, rx: 1.1, fill: 'url(#g-chromeR)', stroke: '#2a2d31', 'stroke-width': 0.3 }, g);
      svg('ellipse', { cx, cy: -1.6, rx: r * 0.9, ry: 0.9, fill: '#ff8a2a', 'fill-opacity': 0.35 }, g);
      const base = power ? -9.5 : -3.6;
      if (power) {
        // octal bakelite base with its key ridge
        svg('rect', { x: cx - r * 0.84, y: base, width: r * 1.68, height: 7.2, rx: 1.4, fill: 'url(#g-tubeBase)', stroke: '#0b0806', 'stroke-width': 0.3 }, g);
        svg('rect', { x: cx - r * 0.84, y: base + 0.7, width: r * 1.68, height: 0.6, fill: '#fff', 'fill-opacity': 0.14 }, g);
      } else for (const dx of [-0.5, 0, 0.5]) svg('rect', { x: cx + dx * r - 0.3, y: -3.4, width: 0.6, height: 1.2, fill: '#c9ced5' }, g);
      const top = base - th;
      const bottle = power
        ? `M${cx - r} ${base} L${cx - r} ${top + r * 2.6} C${cx - r} ${top + r * 1.15} ${cx - r * 0.66} ${top + r * 0.55} ${cx - r * 0.5} ${top + r * 0.12} Q${cx} ${top - 1.6} ${cx + r * 0.5} ${top + r * 0.12} C${cx + r * 0.66} ${top + r * 0.55} ${cx + r} ${top + r * 1.15} ${cx + r} ${top + r * 2.6} L${cx + r} ${base} Z`
        : `M${cx - r} ${base} L${cx - r} ${top + r} A${r} ${r} 0 0 1 ${cx + r} ${top + r} L${cx + r} ${base} Z`;
      // warm haze inside the glass
      svg('ellipse', { cx, cy: top + th * 0.6, rx: r * 1.05, ry: th * 0.34, fill: 'url(#g-tubeHalo)', 'fill-opacity': 0.5 }, g);
      const py = top + th * (power ? 0.36 : 0.32), ph = th * (power ? 0.4 : 0.44);
      // support rods running through the micas
      svg('path', { d: `M${cx - r * 0.5} ${py - 3} V${py + ph + 2.5} M${cx + r * 0.5} ${py - 3} V${py + ph + 2.5}`, stroke: '#9aa1aa', 'stroke-width': 0.35, 'stroke-opacity': 0.8 }, g);
      for (const my of [py - 1.6, py + ph + 0.7]) svg('rect', { x: cx - r * 0.8, y: my, width: r * 1.6, height: 0.9, rx: 0.4, fill: '#ece6d6', 'fill-opacity': 0.62 }, g);
      const plates = power ? [[-r * 0.6, r * 1.2]] : [[-r * 0.7, r * 0.64], [r * 0.06, r * 0.64]];
      for (const [px, pw] of plates) {
        svg('rect', { x: cx + px, y: py, width: pw, height: ph, rx: 0.5, fill: 'url(#g-tubePlate)', stroke: '#141518', 'stroke-width': 0.25 }, g);
        svg('rect', { x: cx + px + pw * 0.37, y: py + ph * 0.1, width: pw * 0.26, height: ph * 0.8, fill: '#0b0c0e' }, g);
        const glow = svg('rect', { x: cx + px + pw * 0.42, y: py + ph * 0.18, width: pw * 0.16, height: ph * 0.64, rx: pw * 0.08, fill: '#ff9a3a', 'fill-opacity': 0.8 }, g);
        ctx.tubeGlows.push(glow);
        // hottest spot of the filament
        svg('rect', { x: cx + px + pw * 0.45, y: py + ph * 0.42, width: pw * 0.1, height: ph * 0.18, rx: pw * 0.05, fill: '#ffe2a8', 'fill-opacity': 0.75 }, g);
      }
      // silvered getter at the top
      const gd = power
        ? `M${cx - r * 0.84} ${top + r * 1.9} C${cx - r * 0.84} ${top + r * 0.95} ${cx - r * 0.48} ${top + r * 0.38} ${cx} ${top + r * 0.22} C${cx + r * 0.48} ${top + r * 0.38} ${cx + r * 0.84} ${top + r * 0.95} ${cx + r * 0.84} ${top + r * 1.9} Z`
        : `M${cx - r * 0.84} ${top + r * 1.55} L${cx - r * 0.84} ${top + r} A${r * 0.84} ${r * 0.84} 0 0 1 ${cx + r * 0.84} ${top + r} L${cx + r * 0.84} ${top + r * 1.55} Z`;
      svg('path', { d: gd, fill: 'url(#g-tubeGetter)' }, g);
      // glass, exhaust tip and highlights
      svg('path', { d: bottle, fill: 'url(#g-tubeGlass)', stroke: '#e3ecf5', 'stroke-opacity': 0.5, 'stroke-width': 0.45 }, g);
      if (!power) svg('path', { d: `M${cx - 0.7} ${top + 0.2} L${cx} ${top - 1.5} L${cx + 0.7} ${top + 0.2} Z`, fill: '#cfd9e4', 'fill-opacity': 0.6 }, g);
      svg('path', { d: `M${cx - r * 0.58} ${top + r * (power ? 2.3 : 1.4)} L${cx - r * 0.58} ${base - 1.5}`, stroke: '#fff', 'stroke-opacity': 0.62, 'stroke-width': power ? 1 : 0.75, 'stroke-linecap': 'round', fill: 'none' }, g);
      svg('path', { d: `M${cx + r * 0.72} ${top + r * (power ? 2.6 : 1.6)} L${cx + r * 0.72} ${base - 2}`, stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 0.5, 'stroke-linecap': 'round', fill: 'none' }, g);
    }
  }
}

forms.amp = (ctx, def) => {
  const combo = def.combo;
  const knobs = def.controls.filter((c) => c.t === 'knob' || c.t === 'sel');
  const w = Math.max(420, 70 + knobs.length * 44 + 90), h = combo ? 330 : 200;
  const g = ctx.g;
  const tolex = def.tolex || '#151515';
  softShadow(g, { w, h, rx: 12, dy: 16, blur: 10, opacity: 0.6 });
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 12, fill: tolex }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 12, fill: 'url(#p-tolex)' }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 12, fill: 'url(#g-shadeV)', opacity: 0.8 }, g);
  svg('rect', { x: 0.7, y: 0.7, width: w - 1.4, height: h - 1.4, rx: 11.5, fill: 'none', stroke: def.piping || '#000', 'stroke-width': def.piping ? 2.2 : 1, 'stroke-opacity': 0.9 }, g);
  // corners
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) svg('circle', { cx: cx ? cx - 9 : 9, cy: cy ? cy - 9 : 9, r: 7, fill: 'url(#g-chromeR)', opacity: def.corners === false ? 0 : 0.9 }, g);
  if (def.tubesTop && !combo) {
    const [pre, pow] = def.tubesTop;
    drawTubes(ctx, [{ x0: 28, n: pre, power: false }, { x1: w - 28, n: pow, power: true }]);
  }
  // handle
  svg('rect', { x: w / 2 - 50, y: -9, width: 100, height: 12, rx: 6, fill: '#0e0e0e', stroke: '#000' }, g);
  svg('rect', { x: w / 2 - 46, y: -7, width: 92, height: 4, rx: 2, fill: '#fff', opacity: 0.08 }, g);
  // faceplate
  const fy = combo ? 14 : h - 96, fh = 80;
  svg('rect', { x: 14, y: fy, width: w - 28, height: fh, rx: 4, fill: def.panel || '#c9a64e' }, g);
  if (def.panelBrushed !== false) svg('rect', { x: 14, y: fy, width: w - 28, height: fh, rx: 4, fill: 'url(#p-brushed)' }, g);
  svg('rect', { x: 14, y: fy, width: w - 28, height: fh, rx: 4, fill: 'url(#g-shadeV)', opacity: 0.6 }, g);
  svg('rect', { x: 14, y: fy, width: w - 28, height: fh, rx: 4, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5 }, g);
  const ptxt = def.panelText || textColorFor(def.panel || '#c9a64e');
  const theme = { text: ptxt, knob: def.knob || 'marshall', labelSize: 6.4, labelLs: 0.8 };
  // grille / logo area
  if (combo) {
    svg('rect', { x: 16, y: fy + fh + 12, width: w - 32, height: h - fh - fy - 26, rx: 6, fill: `url(#p-grille-${def.grille || 'black'})` }, g);
    svg('rect', { x: 16, y: fy + fh + 12, width: w - 32, height: h - fh - fy - 26, rx: 6, fill: 'url(#g-shadeV)', opacity: 0.55 }, g);
    const sp = def.speakers || 1;
    for (let i = 0; i < sp; i++) svg('circle', { cx: w / 2 + (sp === 1 ? 0 : (i - (sp - 1) / 2) * 150), cy: fy + fh + 12 + (h - fh - fy - 26) / 2, r: 70, fill: 'url(#g-cone)', opacity: 0.6 }, g);
  } else {
    svg('rect', { x: 16, y: 14, width: w - 32, height: h - fh - 40, rx: 6, fill: `url(#p-grille-${def.grille || 'black'})`, opacity: def.headGrille === false ? 0 : 1 }, g);
    svg('rect', { x: 16, y: 14, width: w - 32, height: h - fh - 40, rx: 6, fill: 'url(#g-shadeV)', opacity: def.headGrille === false ? 0 : 0.5 }, g);
  }
  // logo badge
  const ly = combo ? fy + fh + 40 : 14 + (h - fh - 40) / 2;
  const logo = def.logo || def.name;
  const lfont = def.logoFont || "'Dancing Script', cursive";
  if (def.logoPlate) {
    svg('rect', { x: w / 2 - 70, y: ly - 15, width: 140, height: 30, rx: 5, fill: def.logoPlate, stroke: '#000', 'stroke-opacity': 0.4 }, g);
  }
  label(g, w / 2, ly, logo, { size: def.logoSize || 26, fill: def.logoColor || '#f4e8c8', font: lfont, weight: 700, ls: 0.6 });
  // input jack drawn on faceplate (left), speaker outs on the side
  const kx0 = 76, kx1 = w - 86;
  autoRow(knobs, kx0, kx1, fy + fh / 2 + 3);
  knobs.forEach((k) => ((k.r = k.r || 12), (k.labelPos = k.labelPos || 'above'), (k.labelSize = 5.8)));
  const sw = def.controls.filter((c) => c.t === 'toggle' && c.x === undefined);
  sw.forEach((t, i) => Object.assign(t, { x: w - 62 + i * 22, y: fy + fh / 2 + 4, orient: t.orient || 'v', optSize: 4.6 }));
  def.controls.forEach((c) => {
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w - 30, y: fy + fh / 2 - 18, r: 4.5, bezel: '#2a2a2a' });
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'soft', x: w - 30, y: fy + fh / 2 + 14, r: 7 });
    if (c.t === 'screen' && c.kind === 'modelName' && c.x === undefined) Object.assign(c, { x: w / 2, y: combo ? fy + fh + 70 : 30, w: 110, h: 14 });
  });
  label(g, 36, fy + 14, 'INPUT', { size: 5.4, fill: ptxt, weight: 700, ls: 1 });
  placeControls(ctx, def.controls, theme);
  const jacks = [];
  def.ports.ins.forEach((l, i) => jacks.push({ key: `i${i}`, dir: 'in', port: i, label: '', side: 'face', faceX: 36, x: 36, y: fy + 34 + i * 26 }));
  def.ports.outs.forEach((l, i) => jacks.push({ key: `o${i}`, dir: 'out', port: i, label: l, side: ctx.flip ? 'right' : 'left', x: ctx.flip ? w + 2 : -2, y: (combo ? 60 : 50) + i * 28 }));
  return { w, h, theme: Object.assign({}, theme, { jackText: '#ddd' }), jacks };
};

// speaker cabinet
forms.cab = (ctx, def) => {
  const size = def.cabSize || '4x12';
  const geo = cabGeom(size);
  const { w, h, cols, rows } = geo;
  const g = ctx.g;
  const tolex = def.tolex || '#141414';
  softShadow(g, { w, h, rx: 12, dy: 16, blur: 10, opacity: 0.6 });
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 12, fill: tolex }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 12, fill: 'url(#p-tolex)' }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 12, fill: 'url(#g-shadeV)', opacity: 0.7 }, g);
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) svg('circle', { cx: cx ? cx - 10 : 10, cy: cy ? cy - 10 : 10, r: 8, fill: 'url(#g-chromeR)', opacity: def.corners === false ? 0 : 0.9 }, g);
  const gx = 18, gy = 18, gw = w - 36, gh = h - 36;
  svg('rect', { x: gx, y: gy, width: gw, height: gh, rx: 6, fill: `url(#p-grille-${def.grille || 'black'})` }, g);
  // speakers seen through the grille
  const sr = Math.min(gw / cols, gh / rows) * 0.42;
  const centers = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cx = gx + (gw * (c + 0.5)) / cols, cy = gy + (gh * (r + 0.5)) / rows;
      centers.push([cx, cy]);
      svg('circle', { cx, cy, r: sr, fill: 'url(#g-cone)', opacity: 0.85 }, g);
      svg('circle', { cx, cy, r: sr * 0.22, fill: '#000', opacity: 0.18 }, g);
    }
  svg('rect', { x: gx, y: gy, width: gw, height: gh, rx: 6, fill: 'url(#g-shadeV)', opacity: 0.5 }, g);
  svg('rect', { x: gx, y: gy, width: gw, height: gh, rx: 6, fill: 'none', stroke: def.piping || '#000', 'stroke-width': def.piping ? 2 : 1 }, g);
  const ly = rows >= 2 ? gy + 26 : gy + 24;
  if (def.logoPlate) svg('rect', { x: w / 2 - 54, y: ly - 12, width: 108, height: 24, rx: 4, fill: def.logoPlate }, g);
  label(g, w / 2, ly, def.logo || def.name, { size: def.logoSize || 18, fill: def.logoColor || '#efe3c3', font: def.logoFont || "'Dancing Script', cursive", weight: 700 });
  const theme = { text: '#ddd', labelSize: 6 };
  def.controls.forEach((c) => {
    if (c.t === 'mic') Object.assign(c, { geom: geo });
  });
  void centers;
  const cabKnobs = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
  if (cabKnobs.length || def.controls.some((c) => c.t === 'screen')) {
    svg('rect', { x: 24, y: h - 64, width: w - 48, height: 46, rx: 6, fill: '#101113', opacity: 0.92, stroke: '#000' }, g);
    autoRow(cabKnobs, 50, w - 50, h - 40);
    cabKnobs.forEach((k) => ((k.r = 9), (k.labelPos = 'below'), (k.labelSize = 5), (k.printLabels = false)));
    def.controls.forEach((c) => {
      if (c.t === 'screen' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 74, w: 110, h: 13 });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w - 36, y: 30, r: 3 });
      if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'soft', x: 36, y: 30, r: 7 });
    });
  }
  placeControls(ctx, def.controls, theme);
  const jacks = [];
  def.ports.ins.forEach((l, i) => jacks.push({ key: `i${i}`, dir: 'in', port: i, label: l, side: ctx.flip ? 'left' : 'right', x: ctx.flip ? -2 : w + 2, y: h / 2 - 20 + i * 26 }));
  def.ports.outs.forEach((l, i) => jacks.push({ key: `o${i}`, dir: 'out', port: i, label: l, side: ctx.flip ? 'right' : 'left', x: ctx.flip ? w + 2 : -2, y: h / 2 - 20 + i * 28 }));
  return { w, h, theme: Object.assign({}, theme, { jackText: '#ddd' }), jacks };
};

// 19" rack unit / preamp
forms.rack = (ctx, def) => {
  const knobs = def.controls.filter((c) => c.t === 'knob' || c.t === 'sel');
  const w = Math.max(440, 150 + knobs.length * 46), h = 96;
  const g = ctx.g;
  const col = def.color || '#1b1c1f';
  body(g, w, h, col, { rx: 3, brushed: true });
  for (const x of [0, w - 24]) {
    svg('rect', { x, y: 0, width: 24, height: h, fill: shade(col, -0.25) }, g);
    for (const y of [16, h - 16]) svg('rect', { x: x + 6, y: y - 4, width: 12, height: 8, rx: 4, fill: '#050505' }, g);
  }
  if (def.tubesTop && def.tubesTop[0]) drawTubes(ctx, [{ x1: w - 40, n: def.tubesTop[0], power: false }]);
  const txt = def.text || textColorFor(col);
  const theme = { text: txt, knob: def.knob || 'chrome', labelSize: 6 };
  label(g, 40, 30, def.logo || def.name, { size: 15, fill: def.logoColor || txt, weight: 800, ls: 1, anchor: 'start' });
  label(g, 40, 46, (def.typeName || 'PREAMP').toUpperCase(), { size: 5.6, fill: txt, weight: 700, ls: 1.6, anchor: 'start', opacity: 0.7 });
  tzBadge(g, 72, h - 16, txt, 4.4);
  autoRow(knobs, 170, w - 70, h / 2 + 4);
  knobs.forEach((k) => ((k.r = k.r || 12), (k.labelPos = 'above'), (k.labelSize = 5.6)));
  def.controls.forEach((c) => {
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w - 46, y: 26, r: 3 });
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'soft', x: w - 46, y: 62, r: 8 });
    if (c.t === 'toggle' && c.x === undefined) Object.assign(c, { x: 146, y: h / 2 + 4, orient: 'v' });
    if (c.t === 'screen' && c.kind === 'modelName' && c.x === undefined) Object.assign(c, { x: 92, y: 70, w: 100, h: 14 });
  });
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 30, gap: 30, flip: ctx.flip }) };
};

// small utility box (splitter, mixer, gain, I/O helpers)
forms.util = (ctx, def) => {
  const nk = def.controls.filter((c) => c.t === 'knob' || c.t === 'sel' || c.t === 'toggle').length;
  const w = 118, h = Math.max(150, 80 + Math.ceil(nk / 2) * 44 + 30);
  const g = ctx.g;
  const col = def.color || '#2a2f3a';
  body(g, w, h, col, { rx: 10, brushed: true });
  svg('rect', { x: 0, y: 0, width: w, height: 6, rx: 3, fill: def.accent || '#ff7a2f' }, g);
  const txt = def.text || '#e8ebf2';
  const theme = { text: txt, knob: 'strymon', labelSize: 6 };
  label(g, w / 2, 22, def.logo || def.name, { size: 9.5, fill: txt, weight: 800, ls: 0.8 });
  const items = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel' || c.t === 'toggle') && c.x === undefined);
  items.forEach((c, i) => {
    c.x = items.length === 1 ? w / 2 : i % 2 === 0 ? 34 : w - 34;
    c.y = 58 + Math.floor(i / 2) * 46;
    if (c.t !== 'toggle') c.r = c.r || 11;
    else c.orient = 'h';
  });
  def.controls.forEach((c) => {
    if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'soft', x: w / 2, y: h - 24, r: 9 });
    if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 44, r: 2.5 });
  });
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { y0: 44, gap: 26, flip: ctx.flip }) };
};

// audio interface I/O panels
forms.io = (ctx, def) => {
  const isIn = def.io === 'in';
  const n = isIn ? def.ports.outs.length : def.ports.ins.length;
  const w = 150, h = 90 + n * 50;
  const g = ctx.g;
  body(g, w, h, '#20242d', { rx: 12, brushed: true });
  svg('rect', { x: 0, y: 0, width: w, height: 30, rx: 12, fill: '#000', opacity: 0.25 }, g);
  label(g, w / 2, 16, isIn ? 'AUDIO IN' : 'AUDIO OUT', { size: 9, fill: '#e9ecf3', weight: 800, ls: 2 });
  label(g, w / 2, h - 14, 'PIPEWIRE · JACK', { size: 5, fill: '#9aa3b5', weight: 700, ls: 1.6 });
  const theme = { text: '#cfd5e2', labelSize: 6 };
  const labels = isIn ? def.ports.outs : def.ports.ins;
  const meters = [];
  labels.forEach((l, i) => {
    const y = 56 + i * 50;
    const leftAligned = ctx.flip ? isIn : !isIn;
    label(g, leftAligned ? 18 : w - 18, y - 16, l, { size: 6.4, fill: '#e3e7ef', weight: 700, anchor: leftAligned ? 'start' : 'end', ls: 0.6 });
    // level meter (10 segments)
    const segs = [];
    for (let s = 0; s < 10; s++) {
      const sx = (leftAligned ? 18 : w - 18 - 9 * 9) + s * 9;
      segs.push(svg('rect', { x: sx, y: y - 6, width: 7, height: 10, rx: 1.5, fill: '#14181f', class: 'led' }, g));
    }
    meters.push(segs);
  });
  ctx.ioMeters = meters;
  placeControls(ctx, def.controls, theme);
  const jacks = [];
  // realistic flow: the interface input sits on the right of the board (jacks face left), the output on the left
  if (isIn) def.ports.outs.forEach((l, i) => jacks.push({ key: `o${i}`, dir: 'out', port: i, label: '', side: ctx.flip ? 'right' : 'left', x: ctx.flip ? w + 2 : -2, y: 56 + i * 50 - 1 }));
  else def.ports.ins.forEach((l, i) => jacks.push({ key: `i${i}`, dir: 'in', port: i, label: '', side: ctx.flip ? 'left' : 'right', x: ctx.flip ? -2 : w + 2, y: 56 + i * 50 - 1 }));
  return { w, h, theme, jacks };
};

export function renderForm(ctx, def) {
  const f = forms[def.form] || forms.tz;
  const res = f(ctx, def);
  // control (TRS footswitch / expression) jacks: on the top edge unless the form placed them
  const ci = def.ctrl?.ins || [], co = def.ctrl?.outs || [];
  if ((ci.length || co.length) && !res.jacks.some((j) => /^[io]c/.test(j.key))) {
    const all = [...co.map((c, i) => ({ c, key: 'oc' + i, dir: 'out' })), ...ci.map((c, i) => ({ c, key: 'ic' + i, dir: 'in' }))];
    const gap = Math.min(30, (res.w - 30) / Math.max(1, all.length));
    const x0 = res.w / 2 - (gap * (all.length - 1)) / 2;
    all.forEach((a, i) => {
      const x = ctx.flip ? res.w - (x0 + i * gap) : x0 + i * gap;
      res.jacks.push({ key: a.key, dir: a.dir, port: a.key.slice(1), label: a.c.label, side: 'top', x, y: -2, kind: a.c.kind || 'ctrl' });
    });
  }
  // jacks are drawn last so they sit above the enclosure edge
  for (const j of res.jacks) {
    if (!j.kind && def.jackKinds) j.kind = def.jackKinds[j.key];
    if (j.side === 'face') {
      drawJack(ctx.g, Object.assign({}, j, { label: j.label && def.form !== 'amp' ? j.label : '' }), res.theme);
      j.side = 'front';
    } else drawJack(ctx.g, j, res.theme);
  }
  return res;
}

// ------------------------------------------------------------------ plugin access
let builtinForms = null;
export function registerForm(name, fn) {
  builtinForms = builtinForms || new Set(Object.keys(forms));
  if (builtinForms.has(name)) throw new Error(`form "${name}" is built in`);
  forms[name] = fn;
}
export function unregisterForm(name) {
  if (builtinForms && !builtinForms.has(name)) delete forms[name];
}
export function hasForm(name) {
  return !!forms[name];
}
// building blocks for custom enclosures (see docs/plugins.md)
export const formKit = { body, screw, tzBadge, placeControls, drawScreenFrame, jacksSide, jacksTop, autoRow, callForm: (name, ctx, def) => forms[name](ctx, def) };

// placeholder for blocks whose plugin is disabled or missing: an empty gray outline the size of the real
// block (remembered from the last time it was drawn); audio passes straight through
forms.missing = (ctx, def) => {
  const w = def.missingW || 150, h = def.missingH || 190, g = ctx.g;
  svg('rect', { x: 0, y: 0, width: w, height: h, rx: 10, fill: 'rgba(120,128,142,0.06)', stroke: '#6b7385', 'stroke-width': 1.6, 'stroke-dasharray': '7 6' }, g);
  const cy = h / 2;
  label(g, w / 2, cy - 8, (def.missingName || 'Unavailable block').slice(0, 26), { size: Math.min(9, w / 16), fill: '#8c94a6', weight: 700 });
  label(g, w / 2, cy + 8, def.missingPlugin ? `enable the “${def.missingPlugin}” plugin` : 'plugin not installed', { size: Math.min(6.4, w / 22), fill: '#6b7385', weight: 600 });
  return { w, h, theme: { text: '#8c94a6', jackText: '#6b7385' }, jacks: jacksSide(def, w, { flip: ctx.flip, y0: Math.min(54, h * 0.3), gap: Math.min(28, (h * 0.6) / Math.max(1, Math.max(def.ports.ins.length, def.ports.outs.length))) }) };
};

// hard-wired junction box (passive splitter / merger / adapter): folded aluminium, no switch, jacks only
forms.box = (ctx, def) => {
  const nIn = def.ports.ins.length, nOut = def.ports.outs.length;
  const n = Math.max(nIn, nOut, 1);
  const gap = 30;
  const w = def.boxW || 96, h = Math.max(110, 56 + n * gap);
  const g = ctx.g;
  body(g, w, h, def.color || '#9aa1aa', { rx: 6, brushed: true, grain: false });
  // folded edges + corner screws
  svg('rect', { x: 4, y: 4, width: w - 8, height: h - 8, rx: 4, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.25 }, g);
  for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) screw(g, x, y, 2.6);
  const txt = def.text || '#1b1e23';
  label(g, w / 2, 24, def.logo || def.name, { size: def.logoSize || 9, fill: txt, weight: 800, ls: 0.8 });
  if (def.sub) label(g, w / 2, 35, def.sub, { size: 5.4, fill: txt, weight: 700, opacity: 0.7, ls: 0.6 });
  // printed wiring diagram between the jack rows
  const y0 = 56 + ((n - nIn) * gap) / 2, y1 = 56 + ((n - nOut) * gap) / 2;
  const xi = ctx.flip ? 14 : w - 14, xo = ctx.flip ? w - 14 : 14;
  const mid = w / 2;
  for (let i = 0; i < nIn; i++)
    for (let o = 0; o < nOut; o++)
      svg('path', { d: `M${xi} ${y0 + i * gap} C ${mid} ${y0 + i * gap} ${mid} ${y1 + o * gap} ${xo} ${y1 + o * gap}`, fill: 'none', stroke: txt, 'stroke-width': 0.8, opacity: 0.35 }, g);
  const theme = { text: txt, labelSize: 6, jackText: txt };
  placeControls(ctx, def.controls, theme);
  const jacks = [];
  def.ports.ins.forEach((l, i) => jacks.push({ key: `i${i}`, dir: 'in', port: i, label: l, side: ctx.flip ? 'left' : 'right', x: ctx.flip ? -2 : w + 2, y: y0 + i * gap }));
  def.ports.outs.forEach((l, i) => jacks.push({ key: `o${i}`, dir: 'out', port: i, label: l, side: ctx.flip ? 'right' : 'left', x: ctx.flip ? w + 2 : -2, y: y1 + i * gap }));
  return { w, h, theme, jacks };
};

// output selector: stereo input on the side, output pairs along the top, a footswitch + LED per output
forms.selector = (ctx, def) => {
  const foots = def.controls.filter((c) => c.t === 'foot');
  const n = foots.length;
  const w = Math.max(200, 40 + n * 66), h = 210;
  const col = def.color, txt = def.text || '#e9ecf3', g = ctx.g;
  body(g, w, h, col, { rx: 12 });
  svg('rect', { x: 10, y: 40, width: w - 20, height: 1.2, fill: txt, opacity: 0.25 }, g);
  label(g, 18, 26, def.logo, { size: 12, fill: txt, weight: 800, ls: 1.4, anchor: 'start', font: "'Oswald', sans-serif" });
  label(g, w - 18, 26, 'OUTPUT SELECTOR', { size: 5.6, fill: txt, weight: 700, ls: 1.2, anchor: 'end', opacity: 0.7 });
  tzBadge(g, w / 2, h - 10, txt, 4.6);
  const theme = { text: txt, knob: 'mxr', labelSize: 6 };
  const step = (w - 40) / n;
  foots.forEach((f, i) => {
    const x = 20 + step * (i + 0.5);
    Object.assign(f, { x, y: 150, r: 12 });
    const led = def.controls.find((c) => c.t === 'led' && c.bind === `select:${i}`);
    if (led) Object.assign(led, { x, y: 104, r: 3.4 });
    label(g, x, 124, f.label, { size: 13, fill: txt, weight: 800, font: "'Oswald', sans-serif" });
  });
  const tog = def.controls.find((c) => c.t === 'toggle');
  if (tog) Object.assign(tog, { x: 40, y: 66 });
  const kn = def.controls.find((c) => c.t === 'knob');
  if (kn) Object.assign(kn, { x: w - 40, y: 66, r: 10 });
  placeControls(ctx, def.controls, theme);
  const jacks = [];
  def.ports.ins.forEach((l, i) => jacks.push({ key: `i${i}`, dir: 'in', port: i, label: l.replace(' (MONO)', ''), side: ctx.flip ? 'left' : 'right', x: ctx.flip ? -2 : w + 2, y: 70 + i * 30 }));
  def.ports.outs.forEach((l, i) => {
    const pair = Math.floor(i / 2), lr = i % 2;
    const cx = 20 + step * (pair + 0.5) + (lr ? 9 : -9);
    jacks.push({ key: `o${i}`, dir: 'out', port: i, label: l, side: 'top', x: ctx.flip ? w - cx : cx, y: -2 });
  });
  return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks };
};

// external footswitch box (control outputs on top)
forms.footswitch = (ctx, def) => {
  const foots = def.controls.filter((c) => c.t === 'foot');
  const n = foots.length;
  const w = Math.max(110, 30 + n * 64), h = 150;
  const g = ctx.g;
  body(g, w, h, def.color || '#1a1d23', { rx: 10 });
  const txt = def.text || '#e9ecf3';
  label(g, w / 2, 22, def.logo, { size: 11, fill: txt, weight: 800, ls: 1.2, font: "'Oswald', sans-serif" });
  const theme = { text: txt, labelSize: 5.4 };
  const step = (w - 30) / n;
  foots.forEach((f, i) => {
    const x = 15 + step * (i + 0.5);
    Object.assign(f, { x, y: 100, r: 11, style: f.style || 'soft' });
    const led = def.controls.find((c) => c.t === 'led' && c.bind === `param:sw${i + 1}`);
    if (led) Object.assign(led, { x, y: 70, r: 2.8 });
    const tg = def.controls.find((c) => c.t === 'toggle' && c.p === `mode${i + 1}`);
    if (tg) Object.assign(tg, { x, y: 46, orient: 'h', labelPos: 'none' });
  });
  tzBadge(g, w / 2, h - 9, txt, 4.2);
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: [] };
};

// tall stereo meter pedal
forms.meter = (ctx, def) => {
  const w = 130, h = 270, g = ctx.g;
  const txt = def.text || '#e9ecf3';
  body(g, w, h, def.color || '#15181e', { rx: 12 });
  label(g, w / 2, 20, def.logo || 'LEVEL METER', { size: 9, fill: txt, weight: 800, ls: 1.4 });
  const scr = def.controls.find((c) => c.t === 'screen');
  if (scr) Object.assign(scr, { x: w / 2, y: 120, w: 96, h: 170, bg: '#07090c' });
  const btn = def.controls.find((c) => c.t === 'button');
  if (btn) Object.assign(btn, { x: w / 2, y: 228 });
  tzBadge(g, w / 2, h - 10, txt, 4.4);
  const theme = { text: txt, labelSize: 6 };
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { flip: ctx.flip, y0: 60, gap: 30 }) };
};

// Tone Zone studio parametric EQ: big interactive screen, 10 footswitches (6 bands, HPF, LPF, LISTEN, SPECTRUM)
forms.paraeq = (ctx, def) => {
  const w = 540, h = 340, g = ctx.g;
  const txt = '#dfe4ee';
  body(g, w, h, def.color || '#16191f', { rx: 14, brushed: true });
  svg('rect', { x: 0, y: 0, width: w, height: 5, rx: 2.5, fill: def.accent || '#ff7a2f' }, g);
  label(g, 22, 24, def.logo || 'PARAMETRIC', { size: 13, fill: txt, weight: 800, ls: 2, anchor: 'start', font: "'Oswald', sans-serif" });
  label(g, 22, 36, (def.typeName || '').toUpperCase(), { size: 5.6, fill: txt, weight: 700, ls: 1.6, anchor: 'start', opacity: 0.6 });
  tzBadge(g, w / 2, h - 9, txt, 4.4);
  const scr = def.controls.find((c) => c.t === 'screen');
  if (scr) Object.assign(scr, { x: w / 2, y: 140, w: 490, h: 188, bg: '#06080c', bezel: '#050608' });
  const foots = def.controls.filter((c) => c.t === 'foot');
  const step = (w - 40) / foots.length;
  foots.forEach((f, i) => {
    const x = 20 + step * (i + 0.5);
    Object.assign(f, { x, y: 300, r: 10.5, style: 'soft' });
    const led = def.controls.find((c) => c.t === 'led' && c.bind === 'param:' + f.p);
    if (led) Object.assign(led, { x, y: 256, r: 2.6 });
    label(g, x, 271, f.caption || '', { size: 6.2, fill: f.labelColor || txt, weight: 800, ls: 0.6 });
  });
  // separators between band / filter / utility groups
  for (const k of [6, 8]) svg('line', { x1: 20 + step * k, x2: 20 + step * k, y1: 250, y2: 318, stroke: txt, 'stroke-opacity': 0.12 }, g);
  const kn = def.controls.find((c) => c.t === 'knob');
  if (kn) Object.assign(kn, { x: w - 40, y: 26, r: 10, labelPos: 'none' });
  if (kn) label(g, w - 62, 26, 'OUTPUT', { size: 5.6, fill: txt, weight: 700, ls: 1, anchor: 'end', opacity: 0.7 });
  const theme = { text: txt, knob: 'strymon', labelSize: 6 };
  placeControls(ctx, def.controls, theme);
  return { w, h, theme, jacks: jacksSide(def, w, { flip: ctx.flip, y0: 120, gap: 30 }) };
};

installTzForms(registerForm);
installTz3Forms(registerForm);
installTz4Forms(registerForm);
installTz5Forms(registerForm);
installTz6Forms(registerForm);
