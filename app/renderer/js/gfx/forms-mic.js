// Microphone graphics: one drawing per model, used for the mic blocks in the library ('mic' form) and for the mics
// standing in front of a cab. A model's `mic.look` picks a drawing kind and its colours / sizes (docs/mic-blocks.md);
// plugins can add kinds with registerMicLook (tz.builders.micLook). Drawings are in millimetres, the pickup point
// (front of the capsule, or the diaphragm centre of a side-address mic) at 0,0 and the body running down (+y).
import { svg, shade } from '../util.js';
import { label } from './controls.js';
import { MIC_COLORS } from './cabgeom.js';

const NS = (n) => (Number.isFinite(+n) ? +(+n).toFixed(2) : 0);
const cache = new Map();
const defsEl = () => document.getElementById('globalDefs');
function gradient(key, make) {
  if (cache.has(key)) return cache.get(key);
  const id = 'mic' + cache.size + '_' + key.replace(/[^a-z0-9]/gi, '').slice(0, 24);
  const host = defsEl();
  if (host) make(host, id);
  const url = `url(#${id})`;
  cache.set(key, url);
  return url;
}
function lin(host, id, stops, x2 = 1, y2 = 0) {
  const g = svg('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, host);
  for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  return g;
}
// a metal / painted cylinder seen from the side: colour with a highlight a third of the way across
export function cylFill(c) {
  return gradient('c' + c, (h, id) =>
    lin(h, id, [[0, shade(c, -0.55)], [0.14, shade(c, -0.1)], [0.3, shade(c, 0.38)], [0.42, shade(c, 0.12)], [0.72, shade(c, -0.22)], [1, shade(c, -0.6)]]));
}
// the same shading as a see-through overlay (over a grille mesh)
function cylOver() {
  return gradient('over', (h, id) => lin(h, id, [[0, '#000', 0.62], [0.16, '#000', 0.08], [0.3, '#fff', 0.34], [0.44, '#fff', 0.04], [0.74, '#000', 0.22], [1, '#000', 0.66]]));
}
// a ball grille: highlight up and to the left
function ballOver() {
  return gradient('ball', (h, id) => {
    const g = svg('radialGradient', { id, cx: 0.38, cy: 0.32, r: 0.72 }, h);
    for (const [o, c, a] of [[0, '#fff', 0.55], [0.3, '#fff', 0.12], [0.62, '#000', 0.08], [1, '#000', 0.62]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  });
}
// fine woven wire mesh in a colour
export function meshFill(c, cell = 1.6) {
  return gradient('m' + c + cell, (h, id) => {
    const p = svg('pattern', { id, width: cell, height: cell, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, h);
    svg('rect', { width: cell, height: cell, fill: shade(c, -0.45) }, p);
    svg('rect', { width: cell, height: cell * 0.42, fill: shade(c, 0.05) }, p);
    svg('rect', { width: cell * 0.42, height: cell, fill: c }, p);
  });
}
// chrome for vintage mics
function chrome() {
  return gradient('chrome', (h, id) => lin(h, id, [[0, '#4a4f56'], [0.12, '#c9ced4'], [0.26, '#ffffff'], [0.38, '#9aa1a9'], [0.6, '#e6e9ec'], [0.82, '#6d737b'], [1, '#2f3338']]));
}

// ---- small drawing helpers (all in mm)
const P = (pts) => 'M' + pts.map(([x, y]) => `${NS(x)} ${NS(y)}`).join(' L') + ' Z';
function rect(g, x, y, w, h, fill, o = {}) {
  return svg('rect', Object.assign({ x: NS(x), y: NS(y), width: NS(w), height: NS(h), fill }, o), g);
}
function cylRect(g, x, y, w, h, color, rx = 0) {
  rect(g, x, y, w, h, cylFill(color), { rx });
}
function meshRect(g, x, y, w, h, color, rx = 0, cell) {
  rect(g, x, y, w, h, meshFill(color, cell), { rx });
  rect(g, x, y, w, h, cylOver(), { rx });
}
// tapered body from width w0 at y0 to w1 at y1
function taper(g, y0, w0, y1, w1, color) {
  svg('path', { d: P([[-w0 / 2, y0], [w0 / 2, y0], [w1 / 2, y1], [-w1 / 2, y1]]), fill: cylFill(color) }, g);
}
function xlr(g, y, w, color) {
  cylRect(g, -w / 2, y, w, 7, shade(color, -0.25), 1);
  rect(g, -w / 2, y + 6.2, w, 1.4, '#000', { opacity: 0.45, rx: 0.7 });
}
function outline(g, d, o = 0.55) {
  svg('path', { d, fill: 'none', stroke: '#000', 'stroke-opacity': o, 'stroke-width': 0.7 }, g);
}
function print(g, x, y, text, color, size = 5) {
  if (text) label(g, x, y, text, { size, fill: color || '#e8e8e8', weight: 700, ls: 0.4 });
}

// ---- drawing kinds. Each returns its extent { top, bottom, w } in mm.
const KINDS = {
  // end-address stick dynamic (57 style): cylindrical grille head, a ring, a tapered body
  stick(g, L) {
    const len = L.len ?? 157, w = L.w ?? 32, hw = L.headW ?? w, hl = L.headLen ?? 38, tail = L.tail ?? w * 0.78;
    const r = hw * 0.26;
    const head = `M${-hw / 2} ${hl} L${-hw / 2} ${r} Q${-hw / 2} 0 ${-hw / 2 + r} 0 L${hw / 2 - r} 0 Q${hw / 2} 0 ${hw / 2} ${r} L${hw / 2} ${hl} Z`;
    taper(g, hl + 4, w, len - 7, tail, L.body);
    xlr(g, len - 7, tail * 0.96, L.body);
    svg('path', { d: head, fill: meshFill(L.grille || '#9ea3aa') }, g);
    if (L.angled) {
      // stepped front of the Beta-style head
      rect(g, -hw / 2, hl * 0.42, hw, 1.6, shade(L.grille || '#9ea3aa', -0.5), { opacity: 0.8 });
      rect(g, -hw / 2, hl * 0.42 + 1.6, hw, 1, '#fff', { opacity: 0.25 });
    }
    svg('path', { d: head, fill: cylOver() }, g);
    outline(g, head, 0.45);
    cylRect(g, -hw / 2 - 0.6, hl, hw + 1.2, 4.5, L.ring || shade(L.body, -0.2), 0.8);
    if (L.band) cylRect(g, -w / 2 + 0.6, hl + 7, w - 1.2, 2.4, L.band);
    print(g, 0, hl + 22, L.text, L.textColor, 4.4);
    return { top: 0, bottom: len, w: Math.max(w, hw) };
  },
  // ball-grille handheld (58 style)
  handheld(g, L) {
    const len = L.len ?? 162, w = L.w ?? 34, D = L.ball ?? 51, tail = L.tail ?? 25, R = D / 2;
    const cupY = D * 0.86;
    taper(g, cupY + 4, w, len - 7, tail, L.body);
    xlr(g, len - 7, tail * 0.96, L.body);
    // grille cup under the ball
    svg('path', { d: P([[-R * 0.84, cupY - 6], [R * 0.84, cupY - 6], [w / 2 + 1, cupY + 5], [-w / 2 - 1, cupY + 5]]), fill: cylFill(L.cup || shade(L.grille || '#b9bdc3', -0.15)) }, g);
    svg('circle', { cx: 0, cy: R, r: R, fill: meshFill(L.grille || '#b9bdc3', 1.8) }, g);
    // the ball's flat band where the two halves meet
    svg('ellipse', { cx: 0, cy: R * 1.42, rx: R * 0.93, ry: R * 0.18, fill: 'none', stroke: shade(L.grille || '#b9bdc3', 0.2), 'stroke-width': 2.2, opacity: 0.85 }, g);
    svg('circle', { cx: 0, cy: R, r: R, fill: ballOver() }, g);
    svg('circle', { cx: 0, cy: R, r: R, fill: 'none', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.7 }, g);
    if (L.band) cylRect(g, -w / 2 + 0.5, cupY + 9, w - 1, 2.6, L.band);
    print(g, 0, cupY + 26, L.text, L.textColor, 4.4);
    return { top: 0, bottom: len, w: D };
  },
  // long cylinder (441 / M160 / RE20 style): slotted or mesh front, rings, straight body
  tube(g, L) {
    const len = L.len ?? 180, w = L.w ?? 34, hl = L.headLen ?? 55, round = L.top === 'round';
    const r = round ? w / 2 : w * 0.16;
    const head = `M${-w / 2} ${hl} L${-w / 2} ${r} Q${-w / 2} 0 ${-w / 2 + r} 0 L${w / 2 - r} 0 Q${w / 2} 0 ${w / 2} ${r} L${w / 2} ${hl} Z`;
    taper(g, hl, w, len - 7, w * (L.taper ?? 0.9), L.body);
    xlr(g, len - 7, w * (L.taper ?? 0.9) * 0.96, L.body);
    if (L.mesh) {
      svg('path', { d: head, fill: meshFill(L.grille || '#b5b9bf') }, g);
      svg('path', { d: head, fill: cylOver() }, g);
    } else {
      svg('path', { d: head, fill: cylFill(L.headColor || L.body) }, g);
      // long front slots
      const n = 5;
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + (w * (k + 0.75)) / (n + 0.5);
        const sw = w / (n * 2.2);
        rect(g, x - sw / 2, 5, sw, hl - 12, L.grille || '#1d1e21', { rx: sw / 2, opacity: 0.92 - Math.abs(k - (n - 1) / 2) * 0.12 });
      }
      svg('path', { d: head, fill: cylOver(), opacity: 0.5 }, g);
    }
    outline(g, head, 0.4);
    cylRect(g, -w / 2 - 0.5, hl - 1, w + 1, 3.2, L.ring || shade(L.body, -0.3), 0.6);
    if (L.rings) for (let k = 1; k <= L.rings; k++) cylRect(g, -w / 2, hl + 6 * k + 6, w, 1.6, L.ring || shade(L.body, -0.3));
    print(g, 0, hl + 30, L.text, L.textColor, 4.6);
    return { top: 0, bottom: len, w };
  },
  // 421 style: wide slotted head, a tapered body with the bass switch ring, stand clip at the end
  oblong(g, L) {
    const len = L.len ?? 200, w = L.w ?? 46, hl = L.headLen ?? 62, hw = w * 1.08;
    taper(g, hl - 2, w * 0.86, len - 16, w * 0.52, L.body);
    // stand clip
    cylRect(g, -w * 0.3, len - 18, w * 0.6, 18, shade(L.body, -0.2), 2);
    rect(g, -w * 0.34, len - 9, w * 0.68, 3, '#000', { opacity: 0.4, rx: 1 });
    const head = `M${-hw / 2} ${hl} L${-hw / 2} ${hw * 0.42} Q${-hw / 2} 0 0 0 Q${hw / 2} 0 ${hw / 2} ${hw * 0.42} L${hw / 2} ${hl} Z`;
    svg('path', { d: head, fill: cylFill(L.grille || L.body) }, g);
    // rows of horizontal slots across the head
    for (let y = 8; y < hl - 6; y += 5.2) {
      const t = y / hl, half = (hw / 2) * (t < 0.42 ? Math.sqrt(Math.max(0.05, 1 - Math.pow(1 - t / 0.42, 2))) : 1) - 5;
      if (half > 2) rect(g, -half, y, half * 2, 2.3, L.slots || '#6a6d74', { rx: 1.1 });
    }
    svg('path', { d: head, fill: cylOver(), opacity: 0.55 }, g);
    outline(g, head, 0.5);
    // five-position bass roll-off ring
    cylRect(g, -w * 0.43, hl + 4, w * 0.86, 7, L.ring || '#8a8e95', 1);
    for (let k = -2; k <= 2; k++) rect(g, k * 4.5 - 0.5, hl + 5, 1, 5, '#1a1a1c', { opacity: 0.8 });
    print(g, 0, hl + 30, L.text, L.textColor, 4.6);
    return { top: 0, bottom: len, w: hw };
  },
  // flat side-address (906 / 609 style) that hangs over the cab by its cable
  sideflat(g, L) {
    const len = L.len ?? 135, w = L.w ?? 54, win = L.window ?? 44;
    const top = -win / 2 - 3;
    rect(g, -w / 2, top, w, len, L.body, { rx: 11 });
    rect(g, -w / 2, top, w, len, 'url(#g-shadeH)', { rx: 11 });
    rect(g, -w / 2, top, w, len, 'url(#g-shadeV)', { rx: 11, opacity: 0.5 });
    // the grille wraps over the top end
    rect(g, -w / 2 + 3, -win / 2, w - 6, win, meshFill(L.grille || '#3a3c41', 1.3), { rx: 9 });
    rect(g, -w / 2 + 3, -win / 2, w - 6, win, 'url(#g-shadeV)', { rx: 9, opacity: 0.6 });
    rect(g, -w / 2 + 3, win / 2 - 2, w - 6, 2, '#000', { opacity: 0.5 });
    if (L.switch) {
      rect(g, -8, win / 2 + 12, 16, 7, '#0b0b0c', { rx: 2.5 });
      rect(g, -2.4, win / 2 + 12.8, 4.8, 5.4, '#9aa0a8', { rx: 1 });
      for (const k of [-1, 0, 1]) svg('circle', { cx: k * 5, cy: win / 2 + 23, r: 0.9, fill: '#9aa0a8', opacity: 0.7 }, g);
    }
    print(g, 0, win / 2 + 36, L.text, L.textColor, 5);
    rect(g, -w / 2, top, w, len, 'none', { rx: 11, stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 });
    return { top, bottom: top + len, w };
  },
  // large-diaphragm condenser: 'square' (414 style framed box) or 'pill' (87 style) head on a cylindrical body
  ldc(g, L) {
    const len = L.len ?? 190, w = L.w ?? 54, hl = L.headLen ?? 74;
    const top = -hl / 2, bodyEnd = top + len;
    const bw = L.head === 'square' ? w * 0.86 : w;
    taper(g, hl / 2 - 2, bw, bodyEnd - 7, bw * (L.taper ?? 0.96), L.body);
    xlr(g, bodyEnd - 7, bw * (L.taper ?? 0.96) * 0.94, L.body);
    if (L.head === 'square') {
      const rx = w * 0.18;
      rect(g, -w / 2, top, w, hl, cylFill(L.frame || L.grille), { rx });
      rect(g, -w / 2 + 3, top + 3, w - 6, hl - 6, meshFill(L.grille || '#c8a95c', 1.3), { rx: rx * 0.7 });
      rect(g, -w / 2 + 3, top + 3, w - 6, hl - 6, cylOver(), { rx: rx * 0.7 });
      // inner mesh seen through the outer one
      rect(g, -w * 0.3, top + 9, w * 0.6, hl - 18, '#000', { rx: rx * 0.5, opacity: 0.12 });
      rect(g, -w / 2, top, w, hl, 'none', { rx, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.7 });
    } else {
      const r = w / 2;
      const d = `M${-r} ${hl / 2} L${-r} ${top + r} A${r} ${r} 0 0 1 ${r} ${top + r} L${r} ${hl / 2} Z`;
      svg('path', { d, fill: meshFill(L.grille || '#c8cacc', 1.4) }, g);
      svg('path', { d, fill: cylOver() }, g);
      outline(g, d, 0.45);
      cylRect(g, -r - 0.4, hl / 2 - 6, w + 0.8, 6, shade(L.grille || L.body, -0.12));
    }
    // badge under the head
    if (L.badge) {
      const by = hl / 2 + 12;
      if (L.head === 'square') svg('circle', { cx: 0, cy: by, r: 4.2, fill: L.badge, stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.5 }, g);
      else svg('path', { d: P([[0, by - 5.5], [4.4, by], [0, by + 5.5], [-4.4, by]]), fill: L.badge, stroke: '#fff', 'stroke-opacity': 0.25, 'stroke-width': 0.5 }, g);
    }
    print(g, 0, hl / 2 + 30, L.text, L.textColor, 5);
    return { top, bottom: bodyEnd, w };
  },
  // small-diaphragm pencil condenser
  sdc(g, L) {
    const len = L.len ?? 150, w = L.w ?? 21, hl = L.headLen ?? 24;
    taper(g, hl, w, len - 7, w, L.body);
    xlr(g, len - 7, w * 0.96, L.body);
    const r = w * 0.18;
    const d = `M${-w / 2} ${hl} L${-w / 2} ${r} Q${-w / 2} 0 ${-w / 2 + r} 0 L${w / 2 - r} 0 Q${w / 2} 0 ${w / 2} ${r} L${w / 2} ${hl} Z`;
    svg('path', { d, fill: meshFill(L.grille || '#aab0b6', 1.2) }, g);
    svg('path', { d, fill: cylOver() }, g);
    outline(g, d, 0.45);
    cylRect(g, -w / 2 - 0.3, hl - 1, w + 0.6, 2.4, L.ring || shade(L.body, -0.3));
    print(g, 0, hl + 30, L.text, L.textColor, 3.8);
    return { top: 0, bottom: len, w };
  },
  // modern side-address ribbon (121 style): slim body, long window with the ribbon behind the mesh
  ribbon(g, L) {
    const len = L.len ?? 158, w = L.w ?? 25, win = L.window ?? len * 0.5;
    const top = -win / 2 - 6;
    rect(g, -w / 2, top, w, len, cylFill(L.body), { rx: w * 0.45 });
    rect(g, -w / 2 + 3.5, -win / 2, w - 7, win, meshFill(L.grille || '#1c1d20', 1.1), { rx: (w - 7) / 2 });
    // the ribbon element
    rect(g, -1.2, -win / 2 + 6, 2.4, win - 12, L.element || '#c9a74c', { opacity: 0.5, rx: 1 });
    rect(g, -w / 2 + 3.5, -win / 2, w - 7, win, cylOver(), { rx: (w - 7) / 2, opacity: 0.8 });
    rect(g, -w / 2, top, w, len, 'none', { rx: w * 0.45, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.7 });
    rect(g, -w / 2 + 1, top + len - 9, w - 2, 1.6, '#000', { opacity: 0.35 });
    print(g, 0, win / 2 + 20, L.text, L.textColor, 4);
    return { top, bottom: top + len, w };
  },
  // big vintage ribbon (44 style): chrome-framed oval grille on a yoke
  ribbon44(g, L) {
    const w = L.w ?? 92, h = L.headLen ?? 150, len = L.len ?? 230;
    const top = -h / 2;
    // yoke and stem
    cylRect(g, -6, h / 2 - 4, 12, len - h + 4, L.body || '#2b2c30');
    svg('path', { d: `M${-w / 2 - 6} 0 Q${-w / 2 - 6} ${h / 2 + 18} 0 ${h / 2 + 18} Q${w / 2 + 6} ${h / 2 + 18} ${w / 2 + 6} 0`, fill: 'none', stroke: L.yoke || '#3a3c40', 'stroke-width': 4 }, g);
    rect(g, -w / 2, top, w, h, L.frame === 'chrome' || !L.frame ? chrome() : cylFill(L.frame), { rx: w / 2 });
    rect(g, -w / 2 + 5, top + 5, w - 10, h - 10, meshFill(L.grille || '#8a7a55', 1.6), { rx: (w - 10) / 2 });
    for (let k = -2; k <= 2; k++) rect(g, k * (w / 6) - 1, top + 8, 2, h - 16, L.frame === 'chrome' || !L.frame ? '#d9dde2' : shade(L.frame, 0.2), { rx: 1, opacity: 0.85 });
    rect(g, -w / 2 + 5, top + 5, w - 10, h - 10, cylOver(), { rx: (w - 10) / 2, opacity: 0.7 });
    rect(g, -w / 2, top, w, h, 'none', { rx: w / 2, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.8 });
    return { top, bottom: top + len, w: w + 12 };
  },
  // vintage capsule (55 / 77 style): chrome capsule with ribs, short stem
  pill(g, L) {
    const w = L.w ?? 64, h = L.headLen ?? 104, len = L.len ?? 170;
    const top = -h / 2;
    cylRect(g, -9, h / 2 - 6, 18, len - h + 6, L.body || '#2b2c30', 2);
    rect(g, -w / 2, top, w, h, L.frame && L.frame !== 'chrome' ? cylFill(L.frame) : chrome(), { rx: w / 2 });
    const ribs = L.ribs ?? 'v';
    if (ribs === 'v') for (let k = -3; k <= 3; k++) rect(g, k * (w / 8.5) - 1.1, top + 10, 2.2, h - 20, L.grille || '#2a2c30', { rx: 1.1, opacity: 0.85 });
    else for (let y = top + 10; y < h / 2 - 8; y += 6) rect(g, -w / 2 + 7, y, w - 14, 2.6, L.grille || '#2a2c30', { rx: 1.3, opacity: 0.85 });
    rect(g, -w / 2, top, w, h, cylOver(), { rx: w / 2, opacity: 0.35 });
    rect(g, -w / 2, top, w, h, 'none', { rx: w / 2, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.8 });
    return { top, bottom: top + len, w };
  },
  // broadcast dynamic (7B style): foam windscreen, long body, yoke
  broadcast(g, L) {
    const len = L.len ?? 190, w = L.w ?? 50, hl = L.headLen ?? 60, fw = w * 1.18;
    taper(g, hl - 4, w, len - 7, w * 0.86, L.body);
    xlr(g, len - 7, w * 0.82, L.body);
    // yoke arms
    for (const s of [-1, 1]) rect(g, s * (w / 2 + 2) - 3, hl + 14, 6, 52, shade(L.body, 0.12), { rx: 3 });
    svg('circle', { cx: -w / 2 - 2, cy: hl + 40, r: 5, fill: '#111', stroke: '#555', 'stroke-width': 0.8 }, g);
    svg('circle', { cx: w / 2 + 2, cy: hl + 40, r: 5, fill: '#111', stroke: '#555', 'stroke-width': 0.8 }, g);
    const d = `M${-fw / 2} ${hl} L${-fw / 2} ${fw * 0.4} Q${-fw / 2} 0 0 0 Q${fw / 2} 0 ${fw / 2} ${fw * 0.4} L${fw / 2} ${hl} Z`;
    svg('path', { d, fill: meshFill(L.foam || '#2a2b2e', 2.2) }, g);
    svg('path', { d, fill: cylOver(), opacity: 0.7 }, g);
    outline(g, d, 0.5);
    print(g, 0, hl + 26, L.text, L.textColor, 5);
    return { top: 0, bottom: len, w: fw + 8 };
  },
  // kick drum mic (D112 style): egg-shaped grille head with a short mount
  egg(g, L) {
    const w = L.w ?? 72, h = L.headLen ?? 110, len = L.len ?? 150;
    cylRect(g, -w * 0.18, h * 0.72, w * 0.36, len - h * 0.72, L.body, 3);
    cylRect(g, -w * 0.28, len - 16, w * 0.56, 10, shade(L.body, -0.2), 2);
    const d = `M0 0 C${w * 0.62} 0 ${w * 0.56} ${h * 0.86} 0 ${h * 0.86} C${-w * 0.56} ${h * 0.86} ${-w * 0.62} 0 0 0 Z`;
    svg('path', { d, fill: meshFill(L.grille || '#2a2b2e', 1.8) }, g);
    svg('path', { d, fill: ballOver(), opacity: 0.8 }, g);
    outline(g, d, 0.5);
    if (L.band) svg('path', { d: `M${-w * 0.42} ${h * 0.58} Q0 ${h * 0.68} ${w * 0.42} ${h * 0.58}`, fill: 'none', stroke: L.band, 'stroke-width': 3 }, g);
    return { top: 0, bottom: len, w };
  },
  // boundary / half-cylinder mic lying in front of the speaker
  boundary(g, L) {
    const w = L.w ?? 90, h = L.headLen ?? 70;
    const top = -h / 2;
    rect(g, -w / 2, top, w, h, cylFill(L.body), { rx: h / 2 });
    rect(g, -w / 2 + 10, top + 8, w - 20, h - 16, meshFill(L.grille || '#55585e', 1.4), { rx: (h - 16) / 2 });
    rect(g, -w / 2, top, w, h, 'none', { rx: h / 2, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.8 });
    return { top, bottom: h / 2 + 4, w };
  },
};
const FALLBACK = { dynamic: 'stick', condenser: 'ldc', ribbon: 'ribbon' };
const BUILTIN = new Set(Object.keys(KINDS));

// add a drawing kind: fn(g, look, mic, def) draws in mm (pickup point at 0,0, body down) and returns { top, bottom, w }
export function registerMicLook(kind, fn) {
  KINDS[kind] = fn;
  return () => unregisterMicLook(kind, fn);
}
// a disabled plugin's kinds go away (models using them fall back to the drawing for their type)
export function unregisterMicLook(kind, fn) {
  if (BUILTIN.has(kind) || (fn && KINDS[kind] !== fn)) return;
  delete KINDS[kind];
}
// draw a mic model; returns its extent
export function drawMicModel(g, d) {
  const m = (d && d.mic) || {};
  const L = Object.assign({ body: m.color || '#3a3d42' }, m.look || {});
  const fn = KINDS[L.kind] || KINDS[FALLBACK[m.type]] || KINDS.stick;
  try {
    return fn(g, L, m, d) || { top: -20, bottom: 150, w: 40 };
  } catch (e) {
    console.warn('mic look', d && d.id, e);
    return KINDS.stick(g, { body: '#3a3d42', grille: '#9ea3aa' });
  }
}
// rotated extent: bounding box of the mic drawn at angle a (degrees)
function rotBox(ext, a, s) {
  const r = (a * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  const pts = [[-ext.w / 2, ext.top], [ext.w / 2, ext.top], [-ext.w / 2, ext.bottom], [ext.w / 2, ext.bottom]].map(([x, y]) => [(x * c - y * sn) * s, (x * sn + y * c) * s]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

// ---- the mic block itself (library thumbnails, or a mic dropped where it can't go): lying at an angle
let clipSeq = 0;
export function micForm(ctx, def) {
  const probe = svg('g', {});
  const ext = drawMicModel(probe, def);
  // list thumbnails: upright and cropped to the head and upper body, so the mic fills the little square
  if (ctx.thumb) {
    const s = 1, pad = 4;
    const h = Math.min(ext.bottom - ext.top, Math.max(52, ext.w * 1.45));
    const w = Math.ceil(ext.w * s + pad * 2), hh = Math.ceil(h * s + pad);
    const id = 'micclip' + ++clipSeq;
    const cp = svg('clipPath', { id }, ctx.g);
    svg('rect', { x: 0, y: 0, width: w, height: hh }, cp);
    const g = svg('g', { 'clip-path': `url(#${id})` }, ctx.g);
    const inner = svg('g', { transform: `translate(${NS(w / 2)},${NS(pad - ext.top * s)}) scale(${s})` }, g);
    inner.appendChild(probe);
    return { w, h: hh, theme: { text: '#ddd' }, jacks: [] };
  }
  // on the board (a mic dropped where it can't go): the whole mic lying at an angle
  const ang = -38, s = 0.9;
  const bx = rotBox(ext, ang, s);
  const pad = 8;
  const w = Math.ceil(bx.x1 - bx.x0 + pad * 2), h = Math.ceil(bx.y1 - bx.y0 + pad * 2);
  const g = svg('g', { transform: `translate(${NS(pad - bx.x0)},${NS(pad - bx.y0)}) rotate(${ang}) scale(${s})` }, ctx.g);
  // soft shadow under the mic
  const sh = svg('g', { transform: 'translate(5,7)', opacity: 0.32 }, g);
  svg('rect', { x: -ext.w / 2, y: ext.top, width: ext.w, height: ext.bottom - ext.top, rx: ext.w / 2, fill: '#000' }, sh);
  g.appendChild(probe);
  return { w, h, theme: { text: '#ddd' }, jacks: [] };
}

// ---- a mic standing in front of a cab (one per MIC control of the cab def). ctx.micInfo(i) tells it which model,
// its number on the cab and its angle; the set() values come from nodeview (on, x, y, dist, sel).
export function drawCabMic(g, c, ctx) {
  const geo = c.geom;
  const m = svg('g', { class: 'ctl mic' }, g);
  m.dataset.ctl = c.cid;
  const body = svg('g', {}, m);
  let lastKey = '';
  return {
    g: m,
    set(v) {
      m.style.display = v.on ? '' : 'none';
      if (!v.on) return;
      const info = (ctx.micInfo && ctx.micInfo(c.idx)) || { def: null, n: c.idx, axis: 0, short: '' };
      const x = geo.gx + (v.x ?? 0.5) * geo.gw, y = geo.gy + (v.y ?? 0.5) * geo.gh;
      m.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const dist = v.dist ?? 0.15;
      const flip = (v.x ?? 0.5) > 0.5 ? -1 : 1; // the mic's body points to the nearer side of the cab
      const bottom = geo.gy + geo.gh + 16 - y;
      const key = `${info.def?.id}|${dist.toFixed(3)}|${(info.axis || 0).toFixed(2)}|${v.sel ? 1 : 0}|${flip}|${info.n}|${Math.round(bottom)}`;
      if (key === lastKey) return;
      lastKey = key;
      body.innerHTML = '';
      const s = 0.52 * (1.12 - 0.42 * dist); // mm -> px, smaller when farther from the grille
      const ang = flip * (24 + 34 * (info.axis || 0));
      const col = MIC_COLORS[(info.n - 1) % MIC_COLORS.length];
      // hit area around the capsule
      svg('circle', { r: 24, fill: 'transparent' }, body);
      const probe = svg('g', {});
      const ext = drawMicModel(probe, info.def);
      // shadow on the grille: farther = softer and more offset
      const sh = svg('g', { transform: `translate(${(4 + 9 * dist).toFixed(1)},${(6 + 12 * dist).toFixed(1)}) rotate(${ang}) scale(${s.toFixed(3)})`, opacity: (0.42 - 0.2 * dist).toFixed(2) }, body);
      svg('rect', { x: -ext.w / 2, y: ext.top, width: ext.w, height: ext.bottom - ext.top, rx: ext.w / 2, fill: '#000' }, sh);
      // cable from the end of the mic, falling out of view below the cab
      const r = (ang * Math.PI) / 180;
      const ex = -Math.sin(r) * ext.bottom * s, ey = Math.cos(r) * ext.bottom * s;
      svg('path', { d: `M${ex.toFixed(1)} ${ey.toFixed(1)} C ${(ex - Math.sin(r) * 30).toFixed(1)} ${(ey + Math.cos(r) * 30).toFixed(1)} ${(ex - flip * 18).toFixed(1)} ${Math.max(ey, bottom * 0.8).toFixed(1)} ${(ex - flip * 22).toFixed(1)} ${Math.max(ey + 4, bottom).toFixed(1)}`, stroke: '#0c0c0d', 'stroke-width': 2.6, fill: 'none', opacity: 0.92, 'stroke-linecap': 'round' }, body);
      const mic = svg('g', { transform: `rotate(${ang}) scale(${s.toFixed(3)})` }, body);
      mic.appendChild(probe);
      if (v.sel) svg('circle', { r: Math.max(13, (ext.w / 2) * s + 6), fill: 'none', stroke: col, 'stroke-width': 1.6, 'stroke-dasharray': '3 2' }, body);
      // number tag and model name
      const tx = flip * (Math.max(10, (ext.w / 2) * s) + 6), ty = -12;
      const tag = svg('g', { transform: `translate(${tx.toFixed(1)},${ty})` }, body);
      const tw = 11 + (info.short || '').length * 3.9;
      svg('rect', { x: flip > 0 ? -5.5 : -tw + 5.5, y: -5.5, width: tw, height: 11, rx: 5.5, fill: '#111317', opacity: 0.88 }, tag);
      svg('circle', { r: 5.2, fill: col, stroke: '#000', 'stroke-width': 0.6 }, tag);
      label(tag, 0, 0.3, String(info.n), { size: 6.2, fill: '#111', weight: 800 });
      if (info.short) label(tag, flip > 0 ? (tw - 11) / 2 + 5 : -(tw - 11) / 2 - 5, 0.3, info.short, { size: 5.6, fill: '#eee', weight: 700 });
    },
  };
}
