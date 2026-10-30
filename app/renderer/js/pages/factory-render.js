// Pedal Factory: draws a design (millimetres). Used by the factory stage, its thumbnails, test mode and the
// 'custom' board form (gfx/forms-custom.js), so a saved pedal looks the same everywhere.
import { svg, clamp, luminance } from '../util.js';
import { drawSlider, drawSelector, angleFor } from '../gfx/controls.js';
import { drawJack } from '../gfx/jacks.js';
import { normalize, materialFill, paint, multiLayer, wearOverlay, seeThrough, opacityOf } from '../gfx/materials.js';
import { knobPart, buttonPart, footPart, togglePart, ledPart, treadlePart, bezel, nutPaint, NEW_KNOBS } from './factory-parts.js';
import { ledPreview } from './circuit-links.js';
import { encoderPart, xyPart, stripPart, arcadePart, stepsPart, tbankPart, tbankWidth, meterPart, sliderLook, selLook, ledLook, ledHalf, STEP } from './factory-controls.js';
import { xySize, drawable } from './factory-kinds.js';
import { renderPatterns } from './factory-patterns.js';
import { drawScriptScreen } from '../screenscript/surface.js';
import { drawPcb } from './factory-pcb.js';

export const r1 = (v) => Math.round(v * 10) / 10;
const lum = (c) => {
  try {
    return luminance(c);
  } catch (_) {
    return 0.5;
  }
};

// ------------------------------------------------------------------ catalogues
export const SHAPES = [
  ['box', 'Box'], ['wedge', 'Wedge'], ['slant', 'Slant'], ['chamfer', 'Chamfer'],
  ['arch', 'Arch'], ['coffin', 'Coffin'], ['pill', 'Pill'], ['shield', 'Shield'],
  ['hex', 'Hexagon'], ['oct', 'Octagon'], ['oval', 'Oval'], ['flare', 'Flare'],
  ['ticket', 'Ticket'], ['tower', 'Tower'], ['waist', 'Waist'], ['drop', 'Drop'],
];
export const FONTS = [
  ["'Barlow Condensed', sans-serif", 'Barlow Condensed'],
  ["'Oswald', sans-serif", 'Oswald'],
  ["'Inter', sans-serif", 'Inter'],
  ["'Dancing Script', cursive", 'Script'],
  ["'Share Tech Mono', monospace", 'Mono'],
  ["Georgia, 'DejaVu Serif', serif", 'Serif'],
];
export const SCREENS = {
  oled: { name: 'OLED', bg: '#04070a', fg: '#7fe8ff' },
  lcd: { name: 'LCD', bg: '#9fbf3a', fg: '#1d2a08' },
  amber: { name: 'Amber', bg: '#1c1403', fg: '#ffb020' },
  tft: { name: 'Colour', bg: '#0d1730', fg: '#ffffff' },
};
export const ART_KINDS = [
  ['rect', 'Box'], ['circle', 'Circle'], ['ring', 'Ring'], ['triangle', 'Triangle'], ['diamond', 'Diamond'], ['star', 'Star'],
  ['burst', 'Burst'], ['bolt', 'Bolt'], ['chevron', 'Chevron'], ['heart', 'Heart'], ['stripe', 'Stripe'], ['stripes', 'Twin stripe'],
  ['wave', 'Wave'], ['dots', 'Dots'],
];
// edge = where a new jack goes. Jack kinds on the board: in/out inst, phones (TRS stereo), xlr, exp = control input,
// fsw = a TRS input for external footswitches (tip and ring each carry an on / off), a control input on the board.
export const JACKS = {
  in: { name: 'Input', label: 'IN', edge: 'right' },
  out: { name: 'Output', label: 'OUT', edge: 'left' },
  stereo: { name: 'Stereo out', label: 'OUT R', edge: 'left' },
  phones: { name: 'Headphones', label: 'PHONES', edge: 'top' },
  xlr: { name: 'XLR out', label: 'XLR', edge: 'left' },
  exp: { name: 'Expression', label: 'EXP', edge: 'top' },
  fsw: { name: 'Footswitch', label: 'FSW', edge: 'top' },
  power: { name: 'Power', label: '9V', edge: 'top' },
};
export const isJackKind = (k) => !!JACKS[k];

// ------------------------------------------------------------------ enclosure geometry
export function shapePoints(shape, w, h) {
  const arc = (cx, cy, rx, ry, a0, a1, n = 18) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return out;
  };
  // symmetric outline from a half-width function of u = y / h (0 top, 1 bottom)
  const profile = (hw, n = 40) => {
    const right = [], left = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = clamp(hw(u), 0, 0.5) * w;
      right.push([w / 2 + x, u * h]);
      left.unshift([w / 2 - x, u * h]);
    }
    return [...right, ...left];
  };
  switch (shape) {
    case 'wedge': {
      const i = w * 0.14;
      return [[i, 0], [w - i, 0], [w, h], [0, h]];
    }
    case 'slant':
      return [[0, h * 0.12], [w, 0], [w, h], [0, h]];
    case 'chamfer': {
      const c = Math.min(w, h) * 0.17;
      return [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]];
    }
    case 'oct': {
      const c = Math.min(w, h) * 0.29;
      return [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]];
    }
    case 'hex': {
      const c = Math.min(h * 0.2, w * 0.5);
      return [[w / 2, 0], [w, c], [w, h - c], [w / 2, h], [0, h - c], [0, c]];
    }
    case 'arch': {
      const rise = Math.min(w * 0.5, h * 0.3);
      return [[0, h], ...arc(w / 2, rise, w / 2, rise, Math.PI, Math.PI * 2, 24), [w, h]];
    }
    case 'coffin':
      return [[w * 0.28, 0], [w * 0.72, 0], [w, h * 0.26], [w * 0.8, h], [w * 0.2, h], [0, h * 0.26]];
    case 'flare':
      return [[0, 0], [w, 0], [w * 0.86, h], [w * 0.14, h]];
    case 'pill': {
      if (h >= w) {
        const r = w / 2;
        return [...arc(r, r, r, r, Math.PI, Math.PI * 2), ...arc(r, h - r, r, r, 0, Math.PI)];
      }
      const r = h / 2;
      return [...arc(w - r, r, r, r, -Math.PI / 2, Math.PI / 2), ...arc(r, r, r, r, Math.PI / 2, Math.PI * 1.5)];
    }
    case 'oval':
      return arc(w / 2, h / 2, w / 2, h / 2, -Math.PI / 2, Math.PI * 1.5, 56).slice(0, -1);
    case 'shield': {
      const top = h * 0.62;
      return [[0, 0], [w, 0], [w, top], ...arc(w / 2, top, w / 2, h - top, 0, Math.PI, 20).slice(1, -1), [0, top]];
    }
    case 'ticket': {
      const c = Math.min(w, h) * 0.16;
      return [
        ...arc(0, 0, c, c, Math.PI / 2, 0, 8), ...arc(w, 0, c, c, Math.PI, Math.PI / 2, 8),
        ...arc(w, h, c, c, Math.PI * 1.5, Math.PI, 8), ...arc(0, h, c, c, 0, -Math.PI / 2, 8),
      ];
    }
    case 'tower': {
      const s = h * 0.16, i = w * 0.22;
      return [[i, 0], [w - i, 0], [w - i, s], [w, s], [w, h], [0, h], [0, s], [i, s]];
    }
    case 'waist':
      return profile((u) => 0.5 * (1 - 0.2 * Math.pow(Math.sin(Math.PI * u), 2)) * Math.min(1, Math.sqrt(Math.min(u, 1 - u) * 14)));
    case 'drop':
      return profile((u) => (u < 0.62 ? 0.5 * Math.pow(u / 0.62, 0.8) : 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.62) / 0.38, 2)))), 48);
    default:
      return [[0, 0], [w, 0], [w, h], [0, h]];
  }
}
// polygon with rounded corners (quadratic corners, radius clamped to half of each edge)
export function roundPoly(pts, r) {
  const n = pts.length;
  const seg = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) || 1, d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = [p1[0] + ((p0[0] - p1[0]) / d1) * rr, p1[1] + ((p0[1] - p1[1]) / d1) * rr];
    const b = [p1[0] + ((p2[0] - p1[0]) / d2) * rr, p1[1] + ((p2[1] - p1[1]) / d2) * rr];
    seg.push({ a, p1, b });
  }
  const f = (p) => `${r1(p[0] * 10) / 10},${r1(p[1] * 10) / 10}`;
  let d = `M${f(seg[0].a)}`;
  seg.forEach((s, i) => {
    if (i > 0) d += `L${f(s.a)}`;
    d += `Q${f(s.p1)} ${f(s.b)}`;
  });
  return d + 'Z';
}
// where a jack sits on an edge: point on the outline plus the outward angle
export function edgePoint(pts, w, h, edge, t) {
  const horiz = edge === 'top' || edge === 'bottom';
  const v = horiz ? t * w : t * h;
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const [ka, kb] = horiz ? [a[0], b[0]] : [a[1], b[1]];
    if (ka === kb || v < Math.min(ka, kb) || v > Math.max(ka, kb)) continue;
    const u = (v - ka) / (kb - ka);
    const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
    const score = edge === 'top' ? y : edge === 'bottom' ? -y : edge === 'left' ? x : -x;
    if (!best || score < best.score) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      best = { x, y, score, ang: (Math.atan2(-dx, dy) * 180) / Math.PI };
    }
  }
  if (!best) best = { x: horiz ? v : edge === 'left' ? 0 : w, y: horiz ? (edge === 'top' ? 0 : h) : v, ang: { top: -90, bottom: 90, left: 180, right: 0 }[edge] };
  return best;
}
// a jack's spot in mm: on the outline, nudged 1 mm out along the outline's normal. ang = the way the plug points
// (the outward normal, or the jack's own angle), nang = the normal (labels go the other way)
export function jackSpot(pts, d, j) {
  const p = edgePoint(pts, d.enc.w, d.enc.h, j.edge, j.t);
  const n = (p.ang * Math.PI) / 180;
  const ang = typeof j.angle === 'number' ? j.angle : p.ang;
  return { x: p.x + Math.cos(n), y: p.y + Math.sin(n), ang, nang: p.ang, ex: p.x, ey: p.y };
}
const EDGE_ANG = { right: 0, bottom: 90, left: 180, top: 270 };
const norm360 = (a) => ((a % 360) + 360) % 360;
/** The nearest of left / right / top / bottom for an angle. */
export function sideOf(a) {
  a = norm360(a);
  return a < 45 || a >= 315 ? 'right' : a < 135 ? 'bottom' : a < 225 ? 'left' : 'top';
}
/** The angle to give a jack (board contract), or null when it points straight out of its edge. */
export function jackAngle(s, edge) {
  const d = Math.abs(((norm360(s.ang) - EDGE_ANG[edge] + 540) % 360) - 180);
  return d < 0.5 ? null : Math.round(norm360(s.ang) * 10) / 10;
}
/** Edge and position for a jack dropped or dragged to p: the nearest point on the outline. */
export function jackOnOutline(d, p, grid) {
  const W = d.enc.w, H = d.enc.h;
  const pts = shapePoints(d.enc.shape, W, H);
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const u = clamp(((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L, 0, 1);
    const x = a[0] + dx * u, y = a[1] + dy * u;
    const dist = Math.hypot(p.x - x, p.y - y);
    if (!best || dist < best.dist) best = { x, y, dist, ang: (Math.atan2(-dx, dy) * 180) / Math.PI };
  }
  const edge = sideOf(best.ang);
  const horiz = edge === 'top' || edge === 'bottom';
  const len = horiz ? W : H;
  let t = (horiz ? best.x : best.y) / len;
  if (grid) t = (Math.round((t * len) / grid) * grid) / len;
  t = clamp(t, 0.04, 0.96);
  // concave outlines: if that edge reaches somewhere else here, fall back to the nearest box edge
  const q = edgePoint(pts, W, H, edge, t);
  if (Math.hypot(q.x - best.x, q.y - best.y) > Math.max(3, (grid || 0) * 1.5)) {
    const dists = { top: p.y, bottom: H - p.y, left: p.x, right: W - p.x };
    const e2 = Object.keys(dists).sort((a, b) => dists[a] - dists[b])[0];
    const h2 = e2 === 'top' || e2 === 'bottom';
    let t2 = (h2 ? p.x : p.y) / (h2 ? W : H);
    if (grid) t2 = (Math.round((t2 * (h2 ? W : H)) / grid) * grid) / (h2 ? W : H);
    return { edge: e2, t: clamp(t2, 0.06, 0.94) };
  }
  return { edge, t };
}

// ------------------------------------------------------------------ art shapes (unit box -0.5..0.5 scaled to w x h)
export function artPath(a) {
  const { w, h } = a;
  const P = (pts) => 'M' + pts.map(([u, v]) => `${r1(u * w)},${r1(v * h)}`).join('L') + 'Z';
  const star = (n, inner) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const ang = (Math.PI * i) / n - Math.PI / 2;
      const rr = i % 2 ? inner : 0.5;
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    return P(pts);
  };
  const ell = (rx, ry) => `M${-rx},0a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z`;
  switch (a.kind) {
    case 'circle':
      return ell(w / 2, h / 2);
    case 'ring': {
      const t = a.thick ?? 0.18;
      return ell(w / 2, h / 2) + ell((w / 2) * (1 - t * 2), (h / 2) * (1 - t * 2));
    }
    case 'triangle':
      return P([[0, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
    case 'diamond':
      return P([[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]);
    case 'star':
      return star(5, 0.2);
    case 'burst':
      return star(14, 0.36);
    case 'bolt':
      return P([[-0.05, -0.5], [0.32, -0.5], [0.1, -0.08], [0.36, -0.08], [-0.22, 0.5], [-0.03, 0.04], [-0.3, 0.04]]);
    case 'chevron':
      return P([[-0.5, -0.5], [0, -0.05], [0.5, -0.5], [0.5, -0.05], [0, 0.45], [-0.5, -0.05]]);
    case 'heart': {
      const m = (u, v) => `${r1(u * w)},${r1(v * h)}`;
      return `M${m(0, 0.45)}C${m(-0.75, -0.05)} ${m(-0.4, -0.75)} ${m(0, -0.25)}C${m(0.4, -0.75)} ${m(0.75, -0.05)} ${m(0, 0.45)}Z`;
    }
    case 'stripes':
      return P([[-0.5, -0.5], [0.5, -0.5], [0.5, -0.12], [-0.5, -0.12]]) + P([[-0.5, 0.12], [0.5, 0.12], [0.5, 0.5], [-0.5, 0.5]]);
    case 'wave': {
      const top = [], bot = [];
      for (let i = 0; i <= 24; i++) {
        const u = -0.5 + i / 24;
        const s = Math.sin(u * Math.PI * 4) * 0.25;
        top.push([u, s - 0.25]);
        bot.unshift([u, s + 0.25]);
      }
      return P([...top, ...bot]);
    }
    case 'dots': {
      let d = '';
      const n = 5;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const rr = Math.min(w, h) / n / 2 * (0.35 + 0.55 * ((i + j) / (2 * n - 2)));
          const cx = -w / 2 + (w / n) * (i + 0.5), cy = -h / 2 + (h / n) * (j + 0.5);
          d += `M${r1(cx - rr)},${r1(cy)}a${r1(rr)},${r1(rr)} 0 1,0 ${r1(rr * 2)},0a${r1(rr)},${r1(rr)} 0 1,0 ${r1(-rr * 2)},0Z`;
        }
      return d;
    }
    default:
      return P([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
  }
}

// ------------------------------------------------------------------ materials
// the enclosure's material spec; older designs had a finish + colour (and gradient colours)
export function encSpec(E) {
  if (E.mat) return normalize(E.mat);
  const c = /^#[0-9a-f]{6}$/i.test(E.color || '') ? E.color : '#1d1f24';
  const by = {
    sparkle: { f: 'flake' }, brushed: { f: 'anodized' }, hammer: { f: 'hammertone' },
    gradient: { mc: { mode: 'linear', stops: [c, E.color2 || c], angle: E.angle ?? 90 } },
  };
  return normalize(Object.assign({ m: 'metal', s: 'aluminium', f: 'powder', c }, by[E.finish] || {}));
}
// glass and acrylic you can see into
export function isClear(E) {
  return seeThrough(encSpec(E)); // glass or acrylic below solid (its transparency amount, spec.t)
}

// ------------------------------------------------------------------ part graphics
function drawPowerJack(parent) {
  svg('rect', { x: -1.2, y: -5, width: 4.6, height: 10, rx: 0.8, fill: '#151618', stroke: '#000', 'stroke-width': 0.3 }, parent);
  svg('rect', { x: 2.6, y: -3.4, width: 0.9, height: 6.8, fill: '#2b2d31' }, parent);
  svg('circle', { cx: 3.3, r: 1.2, fill: '#000' }, parent);
}
export const boardKind = (k) => (k === 'phones' ? 'phones' : k === 'xlr' ? 'xlr' : k === 'exp' || k === 'fsw' ? 'ctrl' : 'inst');
// the board's jack graphic at half scale, so the factory and the board show the same jack
// angle: draw it pointing that way (degrees, see the board's angled jack contract) instead of straight out of side
export function drawJackGfx(parent, j, side = 'left', angle = null) {
  if (j.kind === 'power') return drawPowerJack(parent);
  const g = svg('g', { transform: 'scale(0.5)' }, parent);
  const jo = { x: 0, y: 0, side, kind: boardKind(j.kind), key: '' };
  if (typeof angle === 'number') jo.angle = angle;
  const jg = drawJack(g, jo, null);
  const hot = jg.querySelector('.jack-hot');
  if (hot) hot.remove();
  if (j.mat) {
    // nut material: a thin painted ring over the stock nut
    let tf = { left: '', right: 'scale(-1,1)', top: 'matrix(0,1,1,0,0,0)', bottom: 'matrix(0,-1,1,0,0,0)' }[side] || '';
    if (typeof angle === 'number') {
      const a = norm360(angle);
      tf = `rotate(${(a - 180).toFixed(2)})${Math.cos((a * Math.PI) / 180) > 0.01 ? ' scale(1,-1)' : ''}`;
    }
    const s = svg('g', { transform: tf }, g);
    nutPaint(s, j, { x: -3, y: -7.6, width: 3.9, height: 15.2, rx: 0.9 });
  }
}

export function drawScreen(g, c) {
  const s = SCREENS[c.type] || SCREENS.oled;
  const w = c.w, h = c.h;
  bezel(g, c, w, h);
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: s.bg }, g);
  if (c.shows === 'custom') return drawScriptScreen(g, c); // screen scripts (screenscript/)
  const lines = String(c.text || '').split('\n').slice(0, 4);
  const fs = Math.min(h / (lines.length + 1.2), w / 8);
  if (c.type === 'tft') {
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h * 0.2, fill: '#2b7bd6' }, g);
    const pts = [];
    for (let i = 0; i <= 30; i++) pts.push(`${r1(-w / 2 + 2 + ((w - 4) * i) / 30)},${r1(h / 2 - 3 - (((i * 7) % 10) / 10) * h * 0.18)}`);
    svg('polyline', { points: pts.join(' '), fill: 'none', stroke: '#ff7a2f', 'stroke-width': 0.5 }, g);
  }
  lines.forEach((ln, i) => {
    const y = -h / 2 + (c.type === 'tft' ? h * 0.2 : 0) + fs * (i + 1.05);
    svg('text', { x: -w / 2 + 2, y, fill: s.fg, 'font-family': "'Share Tech Mono', monospace", 'font-size': r1(fs * 0.95), 'pointer-events': 'none' }, g, ln);
  });
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: 'url(#g-glass)', 'pointer-events': 'none' }, g);
}

export const DIP_SW = 2.8;
export const DIP_LOOKS = [['slide', 'Slide'], ['piano', 'Piano'], ['toggle', 'Toggles']];
export const dipWidth = (n, look) => (look === 'toggle' ? tbankWidth(n) : n * DIP_SW + 2.4);
// returns one setter per switch; o.ids gives each switch its own data-ctl (board / test mode)
export function drawDip(g, c, o = {}) {
  const n = c.n || 4;
  const piano = c.look === 'piano';
  const sw = DIP_SW, w = dipWidth(n), h = piano ? 7.4 : 9;
  const body = { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6 };
  if (c.mat && normalize(c.mat).m !== 'stock') paint(g, 'rect', body, c.mat, { scale: 0.3, seed: c.id, edgeWidth: 0.25, wearScale: 0.35 });
  else svg('rect', { ...body, fill: c.color || (piano ? '#1f4fbf' : '#c8102e') }, g);
  svg('rect', { ...body, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.3 }, g);
  svg('text', { x: -w / 2 + 0.8, y: -h / 2 + 1.3, fill: '#fff', 'font-size': 1.5, 'font-family': "'Inter', sans-serif", 'font-weight': 700, 'pointer-events': 'none' }, g, 'ON');
  const sets = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 1.2 + i * sw + sw / 2;
    const sg = svg('g', {}, g);
    if (o.ids) sg.dataset.ctl = o.ids[i];
    svg('rect', { x: x - 1.25, y: -3.2, width: 2.5, height: 6.4, fill: 'transparent' }, sg);
    let set;
    if (piano) {
      // piano keys: a rocker you press down at one end
      svg('rect', { x: x - 1.05, y: -2.9, width: 2.1, height: 5.2, rx: 0.3, fill: '#0f1012' }, sg);
      const top = svg('rect', { x: x - 0.9, y: -2.7, width: 1.8, height: 2.4, rx: 0.25 }, sg);
      const bot = svg('rect', { x: x - 0.9, y: -0.3, width: 1.8, height: 2.4, rx: 0.25 }, sg);
      set = (on) => {
        top.setAttribute('fill', on ? '#9aa0a8' : '#f4f4f4');
        bot.setAttribute('fill', on ? '#f4f4f4' : '#9aa0a8');
      };
    } else {
      svg('rect', { x: x - 0.9, y: -2.6, width: 1.8, height: 5.2, rx: 0.2, fill: '#1a1a1a' }, sg);
      const knob = svg('rect', { x: x - 0.8, y: 0.1, width: 1.6, height: 2.4, rx: 0.2, fill: '#f4f4f4' }, sg);
      set = (on) => knob.setAttribute('y', on ? -2.5 : 0.1);
    }
    set(c.bits ? c.bits[i] : 0);
    sets.push(set);
    svg('text', { x, y: h / 2 - 0.7, fill: '#fff', 'font-size': 1.4, 'text-anchor': 'middle', 'font-family': "'Inter', sans-serif", 'font-weight': 700, 'pointer-events': 'none' }, g, String(i + 1));
  }
  return sets;
}

// small trim pot: a square screwdriver trimmer, a round open one, or a thumbwheel
export const TRIM_LOOKS = [['square', 'Square'], ['round', 'Round'], ['thumb', 'Thumbwheel']];
function trimPart(parent, c) {
  const r = c.r || 3;
  const look = c.look || 'square';
  const g = svg('g', { class: 'ctl trim' }, parent);
  svg('circle', { r: r + 3, fill: 'transparent' }, g);
  const o = { scale: 0.3, seed: c.id, edgeWidth: 0.25, wearScale: 0.35 };
  const mat = c.mat && normalize(c.mat).m !== 'stock' ? c.mat : null;
  const body = (tag, attrs, col) => (mat ? paint(g, tag, attrs, mat, o) : svg(tag, { ...attrs, fill: col, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.25 }, g));
  const rot = svg('g', {});
  if (look === 'thumb') {
    // a thumbwheel seen from above: a knurled disc edge poking out of a slot
    svg('rect', { x: -r - 1.4, y: -r * 0.75 - 0.6, width: r * 2 + 2.8, height: r * 1.5 + 1.2, rx: 0.6, fill: '#0d0e10' }, g);
    body('rect', { x: -r - 0.6, y: -r * 0.75, width: r * 2 + 1.2, height: r * 1.5, rx: 0.5 }, c.color || '#d8dade');
    g.appendChild(rot);
    const lines = svg('g', {}, rot);
    lines.dataset.ribs = '1';
    rot.dataset.thumb = '1';
    for (let i = -4; i <= 4; i++) svg('line', { x1: (i * r) / 4.6, x2: (i * r) / 4.6, y1: -r * 0.7, y2: r * 0.7, stroke: '#000', 'stroke-width': 0.3, opacity: 0.4 }, lines);
    svg('rect', { x: -r - 0.6, y: -r * 0.75, width: r * 2 + 1.2, height: r * 1.5, rx: 0.5, fill: 'url(#g-shadeV)', opacity: 0.6, 'pointer-events': 'none' }, g);
    const set = (v) => lines.setAttribute('transform', `translate(${((clamp(v, 0, 1) - 0.5) * (r / 2.3)).toFixed(2)},0)`);
    set(c.value ?? 0.5);
    return { g, set };
  }
  if (look === 'round') {
    body('circle', { r: r + 0.9 }, c.color || '#f2c230');
    svg('circle', { r: r * 0.92, fill: '#000', opacity: 0.25 }, g);
    svg('circle', { r: r * 0.75, fill: '#e8e6df', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.25 }, g);
    g.appendChild(rot);
    svg('rect', { x: -0.4, y: -r * 0.7, width: 0.8, height: r * 1.4, fill: '#2a2a2a' }, rot);
    svg('path', { d: `M0,${-r * 0.92} l-0.6,-0.6 h1.2z`, fill: '#2a2a2a' }, rot);
  } else {
    body('rect', { x: -r - 0.9, y: -r - 0.9, width: r * 2 + 1.8, height: r * 2 + 1.8, rx: 0.6 }, c.color || '#2b6fd6');
    svg('circle', { r, fill: '#e8e6df', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.25 }, g);
    g.appendChild(rot);
    svg('rect', { x: -0.35, y: -r * 0.85, width: 0.7, height: r * 1.7, fill: '#2a2a2a' }, rot);
    svg('rect', { x: -r * 0.85, y: -0.35, width: r * 1.7, height: 0.7, fill: '#2a2a2a', opacity: 0.55 }, rot);
  }
  const set = (v) => rot.setAttribute('transform', `rotate(${angleFor(v)})`);
  set(c.value ?? 0.5);
  return { g, set };
}

// rough half-height used to place labels under or over a control
export function ctlExtent(c) {
  c = drawable(c);
  const p = partHalf(c);
  if (p) return p[1];
  switch (c.kind) {
    case 'knob': return c.r + (c.dial && c.dial !== 'none' ? 7 : c.ticks ? 6.5 : 2.5);
    case 'trim': return (c.r || 3) + 1.5;
    case 'sel': return (c.r || 7) + 5.5;
    case 'slider': return c.orient === 'h' ? 4 : (c.h || 24) / 2 + 4;
    case 'pedal': return (c.h || 60) / 2 + 1.5;
    case 'toggle': return c.orient === 'h' ? 9 : 10;
    case 'button': return (c.shape === 'rect' || c.shape === 'pill' ? (c.h || 6) / 2 : c.r) + (c.led ? 1 : 1.5);
    case 'foot': return c.style === 'rc' || c.style === 'ts' ? (c.h || 30) / 2 + 1 : (c.r || 7) + 4.5;
    case 'led': return c.r + 2;
    case 'screen': return c.h / 2 + 2.5;
    case 'dip': return c.look === 'toggle' ? 5.2 : c.look === 'piano' ? 4.7 : 5.5;
    default: return 6;
  }
}
// half size of a control (for collision checks and mirror), as [half width, half height]
export function ctlHalf(c) {
  c = drawable(c);
  const p = partHalf(c);
  if (p) return p;
  switch (c.kind) {
    case 'screen': return [c.w / 2 + 1.8, c.h / 2 + 1.8];
    case 'dip': return [dipWidth(c.n || 4, c.look) / 2, c.look === 'toggle' ? 5.2 : 4.5];
    case 'pedal': return [(c.w || 40) / 2, (c.h || 60) / 2];
    case 'slider': return c.orient === 'h' ? [(c.h || 24) / 2 + 4, 4] : [4, (c.h || 24) / 2 + 4];
    case 'button': return c.shape === 'rect' || c.shape === 'pill' ? [(c.w || 12) / 2, (c.h || 6) / 2] : [c.r || 4, c.r || 4];
    case 'foot': return c.style === 'rc' || c.style === 'ts' ? [(c.w || 34) / 2, (c.h || 30) / 2] : [(c.r || 7) + 3.5, (c.r || 7) + 3.5];
    default: {
      const e = ctlExtent(c);
      return [e, e];
    }
  }
}
export const ctlRadius = (c) => Math.max(...ctlHalf(c));
// sizes of the extra controls and looks (null: the kind's own size)
function partHalf(c) {
  const r = c.r || 8;
  switch (c.part) {
    case 'encoder': return [r + (c.ring ? 5.3 : 2.5), r + (c.ring ? 5.3 : 2.5)];
    case 'meter': return c.look === 'round' ? [(c.h || 18) / 2 + 1.6, (c.h || 18) / 2 + 1.6] : [(c.w || 28) / 2 + 1.5, (c.h || 18) / 2 + 1.5];
    case 'strip': return c.orient === 'h' ? [(c.h || 40) / 2 + 1, (c.w || 6) / 2 + 1] : [(c.w || 6) / 2 + 1, (c.h || 40) / 2 + 1];
    case 'arcade': return [(c.r || 7) + 2.4, (c.r || 7) + 2.4];
    case 'steps': return [((c.n || 4) * STEP) / 2, 6];
  }
  if (c.kind === 'xy') {
    const [w, h] = xySize(c);
    return [w / 2 + 1, h / 2 + 4.8]; // the X rail sits under the pad
  }
  if (c.kind === 'trim' && c.look === 'thumb') return [(c.r || 3) + 1.4, (c.r || 3) * 0.75 + 0.6];
  if (c.kind === 'knob' && c.dial && c.dial !== 'none') return [c.r + (c.dial === 'plate' ? 6.5 : 5.2), c.r + (c.dial === 'plate' ? 6.5 : 5.2)];
  if (c.kind === 'led' && c.look && c.look !== 'round') return ledHalf(c);
  if (c.kind === 'sel' && c.look === 'lcd') return [Math.max(9, (c.r || 7) + 3), (c.r || 7) + 7];
  if (c.kind === 'slider' && (c.look === 'scale' || c.look === 'long')) return c.orient === 'h' ? [(c.h || 24) / 2 + 4, 6] : [6, (c.h || 24) / 2 + 4];
  return null;
}

const NEW_STYLE = new Set(NEW_KNOBS.map((k) => k[0]));
const hasMat = (c) => !!c.mat && normalize(c.mat).m !== 'stock';
// draws one control; returns a view ({set, press}) for board / test use
export function drawControl(parent, c, th, o = {}) {
  c = drawable(c); // older parts drawn as what they became (factory-kinds.js)
  let view = null;
  const ids = o.ids || null;
  // each part can have its own material (factory-parts.js); no material keeps the stock look
  const part = c.part;
  if (part === 'encoder') view = encoderPart(parent, c, th);
  else if (part === 'meter') view = meterPart(parent, c, th);
  else if (part === 'strip') view = stripPart(parent, c, th);
  else if (part === 'arcade') view = arcadePart(parent, c, th);
  else if (part === 'steps') view = stepsPart(parent, c, th);
  else if (c.kind === 'dip' && c.look === 'toggle') view = tbankPart(parent, c, th, { ids });
  else if (c.kind === 'xy') view = xyPart(parent, c, th, { ids });
  else if (c.kind === 'slider' && ((c.look && c.look !== 'classic') || hasMat(c))) view = sliderLook(parent, c, th);
  else if (c.kind === 'sel' && ((c.look && c.look !== 'classic') || hasMat(c) || NEW_STYLE.has(c.style))) view = selLook(parent, c, th, knobPart);
  else if (c.kind === 'led' && c.look && c.look !== 'round') view = ledLook(parent, c);
  else if (c.kind === 'led' && c.bezel && c.bezel !== 'chrome') view = ledLook(parent, c);
  else if (c.kind === 'knob') view = knobPart(parent, c, th);
  else if (c.kind === 'trim') view = trimPart(parent, c);
  else if (c.kind === 'slider') view = drawSlider(parent, { x: 0, y: 0, cid: c.id, h: c.h || 24, w: c.w || 5, orient: c.orient, capColor: c.capColor, lineColor: c.lineColor, label: null, marks: c.marks !== false }, th);
  else if (c.kind === 'sel') {
    const n = c.n || 4;
    const opts = (c.opts || []).slice(0, n);
    while (opts.length < n) opts.push(String(opts.length + 1));
    view = drawSelector(parent, { x: 0, y: 0, cid: c.id, r: c.r || 7, style: c.style || 'boss', options: opts, labelPos: 'none', optSize: 2.4, labelRadius: 3.8, printLabels: c.marks !== false }, th);
  } else if (c.kind === 'pedal') view = treadlePart(parent, c);
  else if (c.kind === 'toggle') {
    // toggles redraw on change (the lever has no transform to animate)
    const tg = svg('g', {}, parent);
    let cur = null;
    view = {
      g: tg,
      set(pos) {
        if (pos === cur) return;
        cur = pos;
        tg.textContent = '';
        togglePart(tg, { ...c, pos }, th);
      },
    };
  } else if (c.kind === 'button') view = buttonPart(parent, c, th);
  else if (c.kind === 'foot') view = footPart(parent, c, th);
  else if (c.kind === 'led') view = ledPart(parent, c);
  else if (c.kind === 'screen') drawScreen(parent, c);
  else if (c.kind === 'dip' && !view) {
    const sets = drawDip(parent, c, { ids });
    view = { sets };
  }
  if (view && !view.press) {
    const g = view.g || parent;
    view.press = (p) => g.setAttribute('opacity', p ? 0.85 : 1);
  }
  // initial state
  if (view && view.set) {
    if (c.kind === 'knob' || c.kind === 'trim' || c.kind === 'slider' || c.kind === 'pedal') view.set(c.value ?? 0.5);
    else if (c.kind === 'toggle' || c.kind === 'sel') view.set(clamp(c.pos || 0, 0, (c.kind === 'toggle' ? c.ways : c.n || 4) - 1));
    else if (c.kind === 'button') view.set(!!c.on);
    else if (c.kind === 'led') view.set(c.on ? ledPreview(c) || true : null); // RGB / bicolour: the mix of its wired colours
  }
  if (c.label && c.labelPos !== 'none') {
    const e = ctlExtent(c) + (c.kind === 'button' && c.led && c.labelPos === 'above' ? 5 : 0);
    const y = c.labelPos === 'above' ? -e - th.labelSize * 0.6 : e + th.labelSize * 0.6;
    svg('text', { x: 0, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: th.text, 'font-family': th.labelFont, 'font-weight': 700, 'font-size': th.labelSize, 'letter-spacing': 0.3, 'pointer-events': 'none' }, parent, c.label);
  }
  return view;
}

export function drawText(parent, t) {
  return svg('text', {
    x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: t.color, 'font-family': t.font, 'font-weight': t.weight,
    'font-size': t.size, 'letter-spacing': t.ls, 'font-style': t.italic ? 'italic' : undefined,
    stroke: t.outline ? t.outlineColor : undefined, 'stroke-width': t.outline || undefined, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
  }, parent, t.text || ' ');
}

// the circuit board seen through clear enclosures is built from the design's circuits (factory-pcb.js)
export { drawPcb };

// ------------------------------------------------------------------ the whole pedal
let rid = 0;
/** The dot grid over the enclosure: on unless the design turns it off. */
export const dotsOn = (E) => E.dots !== false;
export const theme = (d) => ({ text: d.labels.color, labelFont: d.labels.font, labelSize: d.labels.size, toggleTitles: false });

/**
 * Draws a pedal into <g> root. Options: edit (hit targets), grid (mm), board (leave the audio jacks to the board),
 * views + ctlDefs (fill a board style view map: cid -> {ctl, view}), pcb (force the circuit board on / off).
 */
export function renderPedal(root, d, o = {}) {
  const pre = 'fz' + ++rid + '-';
  const E = d.enc;
  const W = E.w, H = E.h;
  const pts = shapePoints(E.shape, W, H);
  const body = roundPoly(pts, E.radius || 0);
  const defs = svg('defs', {}, root);
  const cp = svg('clipPath', { id: pre + 'clip' }, defs);
  svg('path', { d: body }, cp);
  const spec = encSpec(E);
  const mf = materialFill(spec, { scale: 0.44 });
  const sh = svg('filter', { id: pre + 'sh', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  svg('feDropShadow', { dx: 0, dy: 3, stdDeviation: 3.5, 'flood-color': '#000', 'flood-opacity': 0.55 }, sh);
  const th = theme(d);
  const edit = !!o.edit;
  const spots = d.jacks.map((j) => ({ j, ...jackSpot(pts, d, j) }));

  // power jacks sit under the body so only the part outside the edge shows
  const jackLayer = svg('g', { class: 'fz-jacks' }, root);
  for (const s of spots)
    if (s.j.kind === 'power') drawJackGfx(svg('g', { transform: `translate(${r1(s.ex)},${r1(s.ey)}) rotate(${r1(s.ang)})`, 'data-sel': s.j.id }, jackLayer), s.j);

  // a clear enclosure can show its circuit board and wiring under the body
  const pcbOn = o.pcb ?? (E.pcb && isClear(E));
  if (pcbOn) {
    // the drop shadow only outside the body, so it does not darken the board seen through it
    const mk = svg('mask', { id: pre + 'out', maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: W + 80, height: H + 80 }, defs);
    svg('rect', { x: -40, y: -40, width: W + 80, height: H + 80, fill: '#fff' }, mk);
    svg('path', { d: body, fill: '#000' }, mk);
    svg('path', { d: body, fill: '#000', filter: `url(#${pre}sh)`, mask: `url(#${pre}out)`, 'pointer-events': 'none' }, root);
    drawPcb(svg('g', { 'clip-path': `url(#${pre}clip)` }, root), d, pts, spots);
  }

  if (mf.glow) for (const [sw, op] of [[7, 0.12], [3.5, 0.22]]) svg('path', { d: body, fill: 'none', stroke: mf.glow, 'stroke-width': sw, 'stroke-opacity': op, 'pointer-events': 'none' }, root);
  svg('path', { d: body, fill: mf.fill, filter: pcbOn ? undefined : `url(#${pre}sh)`, 'data-body': 1, 'data-sel': 'enc' }, root);
  // material extras, multicolour, then the pattern layers (blend modes mix with the body underneath)
  const cg = svg('g', { 'clip-path': `url(#${pre}clip)`, 'pointer-events': 'none' }, root);
  const full = { x: -2, y: -2, width: W + 4, height: H + 4 };
  if (mf.overlay) svg('rect', { ...full, fill: mf.overlay }, cg);
  if (spec.mc) multiLayer(cg, 'rect', full, spec, { scale: 0.44 });
  // tinted acrylic hides a lot: a faint second pass keeps the board readable through it
  if (pcbOn) drawPcb(svg('g', { opacity: 0.4 * Math.min(1, (1 - opacityOf(spec)) * 2) }, cg), d, pts, spots);
  const pats = (E.patterns || []).filter((L) => L.on);
  if (pats.length) {
    renderPatterns(cg, defs, pre, E.patterns, W, H);
    // the material's texture shows through the patterns
    if ((E.showThrough ?? 0.3) > 0) svg('rect', { ...full, fill: mf.fill, opacity: E.showThrough ?? 0.3, style: 'mix-blend-mode:soft-light' }, cg);
  }

  // artwork (clipped to the body)
  const artG = svg('g', { 'clip-path': `url(#${pre}clip)` }, root);
  for (const a of d.art) {
    if (a.hidden) continue;
    const g = svg('g', { transform: `translate(${r1(a.x)},${r1(a.y)}) rotate(${r1(a.rot || 0)})`, 'data-sel': a.id, class: 'fz-item' }, artG);
    if (edit) g.dataset.id = a.id;
    svg('path', { d: artPath(a), fill: a.color, opacity: a.opacity ?? 1, 'fill-rule': 'evenodd' }, g);
  }
  // lighting over body and art, then the finish sheen and wear
  svg('path', { d: body, fill: 'url(#g-shadeV)', opacity: pcbOn ? 0.35 : 0.6, 'pointer-events': 'none' }, root);
  svg('path', { d: body, fill: mf.sheen, opacity: mf.sheenOpacity * 0.8, 'pointer-events': 'none' }, root);
  if (spec.w) wearOverlay(svg('g', { 'pointer-events': 'none' }, root), 'path', { d: body }, spec, { scale: 0.44, seed: 'enc' + W + 'x' + H, size: Math.min(W, H) });
  const ed = svg('g', { 'clip-path': `url(#${pre}clip)`, 'pointer-events': 'none' }, root);
  svg('path', { d: body, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 1.4 }, ed);
  svg('path', { d: body, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.5, 'pointer-events': 'none' }, root);

  // the dot grid is part of the design (enc.dots), so the board shows it too
  if (dotsOn(E)) {
    const step = clamp(E.dotStep || 2.5, 1.5, 10);
    const gp = svg('pattern', { id: pre + 'grid', width: step, height: step, patternUnits: 'userSpaceOnUse' }, defs);
    const dark = lum(mf.base) > 0.55;
    svg('circle', { cx: 0, cy: 0, r: E.dotSize || 0.22, fill: dark ? '#000' : '#fff', opacity: 0.45 }, gp);
    svg('rect', { width: W + 1, height: H + 1, fill: `url(#${pre}grid)`, 'clip-path': `url(#${pre}clip)`, 'pointer-events': 'none', class: 'fz-gridfill' }, root);
  }

  // audio jacks (the board draws its own at the same spots)
  if (!o.board)
    for (const s of spots)
      if (s.j.kind !== 'power') {
        const a = jackAngle(s, s.j.edge);
        drawJackGfx(svg('g', { transform: `translate(${r1(s.x)},${r1(s.y)})`, 'data-sel': s.j.id, 'pointer-events': 'none' }, root), s.j, a == null ? s.j.edge : sideOf(a), a);
      }

  // jack labels are printed on the body
  for (const s of spots) {
    if (!s.j.label) continue;
    const a = (s.nang * Math.PI) / 180;
    const k = s.j.kind === 'xlr' ? 8 : 5.2;
    svg('text', { x: r1(s.ex - Math.cos(a) * k), y: r1(s.ey - Math.sin(a) * k), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: th.text, 'font-family': th.labelFont, 'font-weight': 700, 'font-size': th.labelSize * 0.85, 'letter-spacing': 0.2, 'pointer-events': 'none' }, root, s.j.label);
  }

  for (const t of [d.title, d.sub]) {
    if (t.hidden || !t.text) continue;
    const g = svg('g', { transform: `translate(${r1(t.x)},${r1(t.y)}) rotate(${r1(t.rot || 0)})`, 'data-sel': t.id, class: 'fz-item' }, root);
    if (edit) g.dataset.id = t.id;
    drawText(g, t);
  }
  const views = o.views, defsBy = o.ctlDefs;
  for (const c of d.ctls) {
    if (c.hidden) continue;
    const g = svg('g', { transform: `translate(${r1(c.x)},${r1(c.y)})`, 'data-sel': c.id, class: 'fz-item fz-ctl' }, root);
    if (edit) {
      g.dataset.id = c.id;
      // a hit area of its own: LEDs and screens ignore the pointer
      const [hw, hh] = ctlHalf(c);
      svg('rect', { x: -hw - 1, y: -hh - 1, width: hw * 2 + 2, height: hh * 2 + 2, rx: 1.5, fill: 'transparent', class: 'fz-hit' }, g);
    }
    const ids = !views ? null : c.kind === 'dip' ? [...Array(c.n || 4)].map((_, i) => c.id + '.' + i) : c.kind === 'xy' ? [c.id + '.x', c.id + '.y'] : null;
    const view = drawControl(g, c, th, { ids });
    if (views && view) {
      if (c.kind === 'dip') view.sets.forEach((set, i) => defsBy.has(ids[i]) && views.set(ids[i], { ctl: defsBy.get(ids[i]), view: { set: (v) => set(!!v), press() {} } }));
      else if (view.subs) for (const [k, v] of Object.entries(view.subs)) defsBy.has(c.id + '.' + k) && views.set(c.id + '.' + k, { ctl: defsBy.get(c.id + '.' + k), view: v });
      else if (defsBy.has(c.id)) {
        if (c.kind !== 'led' && !view.subs) g.dataset.ctl = c.id;
        views.set(c.id, { ctl: defsBy.get(c.id), view });
      }
    }
  }
  // jack hit areas on top so they can be grabbed through the body edge
  if (edit)
    for (const s of spots) {
      const g = svg('g', { transform: `translate(${r1(s.ex)},${r1(s.ey)}) rotate(${r1(s.nang)})`, 'data-id': s.j.id, class: 'fz-item fz-jack' }, root);
      svg('rect', { x: -8, y: -6.5, width: 13, height: 13, fill: 'transparent' }, g);
    }
  return { W, H, pts, body, spots };
}

export function thumb(d, cls = 'fz-thumb') {
  const pad = 9;
  const s = svg('svg', { viewBox: `${-pad} ${-pad} ${d.enc.w + pad * 2} ${d.enc.h + pad * 2}`, class: cls });
  renderPedal(svg('g', {}, s), d);
  return s;
}
