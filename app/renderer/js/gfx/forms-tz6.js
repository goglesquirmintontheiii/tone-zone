// Enclosures for the v0.4.0 Tone Zone originals (catalog/originals5.js).
// One parametric form, 'tz6': def.art picks an outline (SHAPES), a finish (paint) and an illustration (MOTIFS).
// Controls are laid out in rows that are fitted to the outline (sampled with canvas isPointInPath), so knobs,
// labels and text stay inside the shape. No SVG filters: gradients, cached noise tiles and clip paths only.
import { svg, shade, luminance } from '../util.js';
import { softShadow, noisePattern } from './fx.js';
import { label } from './controls.js';
import { formKit } from './forms.js'; // cyclic import: only touched at render time

// ------------------------------------------------------------------ paint helpers
function defsEl() {
  let d = document.getElementById('globalDefs') || document.getElementById('tz6Defs');
  if (!d) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.style.position = 'absolute';
    d = svg('defs', { id: 'tz6Defs' }, s);
    document.body.appendChild(s);
  }
  return d;
}
const kid = (c) => String(c).replace(/[^a-z0-9]/gi, '');
function lin(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  id = 't6l-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('linearGradient', { id, x1, y1, x2, y2 }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function rad(id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) {
  id = 't6r-' + id;
  if (!document.getElementById(id)) {
    const gr = svg('radialGradient', { id, cx, cy, r, fx, fy }, defsEl());
    for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  }
  return `url(#${id})`;
}
function noise(id, units, px, rgb, a0, a1, smooth = 1) {
  id = 't6n-' + id;
  if (!document.getElementById(id)) noisePattern(defsEl(), id, units, px, rgb, a0, a1, smooth);
  return `url(#${id})`;
}
function pattern(id, w, h, draw, o = {}) {
  id = 't6p-' + id;
  if (!document.getElementById(id)) {
    const p = svg('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse', patternTransform: o.transform }, defsEl());
    draw(p);
  }
  return `url(#${id})`;
}
const P = (p, d, a = {}) => svg('path', Object.assign({ d }, a), p);
const C = (p, cx, cy, r, a = {}) => svg('circle', Object.assign({ cx, cy, r }, a), p);
const E = (p, cx, cy, rx, ry, a = {}) => svg('ellipse', Object.assign({ cx, cy, rx, ry }, a), p);
const R = (p, x, y, width, height, rx, a = {}) => svg('rect', Object.assign({ x, y, width, height, rx }, a), p);
const G = (p, a = {}) => svg('g', Object.assign({ 'pointer-events': 'none' }, a), p);
const f = (n) => (+n).toFixed(1);
const rr = (x, y, w, h, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
const circ = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
const poly = (pts) => 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z';
const isLight = (c) => { try { return luminance(c) > 0.5; } catch (_) { return false; } };
const inkFor = (c) => (isLight(c) ? '#1a1b1f' : '#f1f2f5');
// tiny deterministic random for art details
const rnd = (seed) => { let s = seed | 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

const CW = { oswald: 0.5, inter: 0.78, barlow: 0.44, script: 0.46, mono: 0.6 };
const FONTS = { oswald: "'Oswald', sans-serif", inter: "'Inter', sans-serif", barlow: "'Barlow Condensed', sans-serif", script: "'Dancing Script', cursive", mono: "'Share Tech Mono', monospace" };
function fit(str, maxW, size, font = 'oswald', ls = 0) {
  const w = String(str).length * (size * (CW[font] || 0.6) + ls);
  return w <= maxW ? size : Math.max(4, (size * maxW) / w);
}
// printed text that never grows past maxW
function txt(g, x, y, s, o = {}) {
  const font = o.font || 'oswald';
  const size = o.maxW ? fit(s, o.maxW, o.size || 10, font, o.ls || 0) : o.size || 10;
  const t = label(g, x, y, s, Object.assign({}, o, { size, font: FONTS[font] || font }));
  if (o.stroke) { t.setAttribute('stroke', o.stroke); t.setAttribute('stroke-width', o.sw || 0.8); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke-linejoin', 'round'); }
  return t;
}

// ------------------------------------------------------------------ outline sampling
let hit = null;
const pcache = new Map();
function inside(d, x, y) {
  if (!hit) { const c = document.createElement('canvas'); c.width = c.height = 2; hit = c.getContext('2d'); }
  let e = pcache.get(d);
  if (!e) { e = { p: new Path2D(d), rows: new Map() }; if (pcache.size > 200) pcache.clear(); pcache.set(d, e); }
  return hit.isPointInPath(e.p, x, y);
}
// [left, right] of the run of the outline that contains x0 at height y (null if x0 is outside)
function rowAt(d, w, y, x0 = w / 2) {
  const key = Math.round(y * 2) + ':' + Math.round(x0);
  let e = pcache.get(d);
  if (e && e.rows.has(key)) return e.rows.get(key);
  let res = null;
  if (inside(d, x0, y)) {
    const edge = (dir) => {
      let a = x0, b = x0 + dir * 6;
      while (Math.abs(b - x0) < w + 8 && inside(d, b, y)) { a = b; b += dir * 6; }
      for (let k = 0; k < 4; k++) { const m = (a + b) / 2; if (inside(d, m, y)) a = m; else b = m; }
      return a;
    };
    res = [edge(-1), edge(1)];
  }
  e = pcache.get(d);
  e.rows.set(key, res);
  return res;
}
// usable [left, right] over a vertical band
function band(d, w, y0, y1, x0 = w / 2) {
  let l = -1e9, r = 1e9;
  const n = Math.max(2, Math.ceil((y1 - y0) / 6));
  for (let i = 0; i <= n; i++) {
    const b = rowAt(d, w, y0 + ((y1 - y0) * i) / n, x0);
    if (!b) return null;
    l = Math.max(l, b[0]);
    r = Math.min(r, b[1]);
  }
  return r > l ? [l, r] : null;
}

// ------------------------------------------------------------------ outlines
// each returns { d, back?(g), fit?: {w,h} } for a w × h box. `d` is the body used for paint, clip and layout.
const SHAPES = {
  rect: (w, h, A) => ({ d: rr(0, 0, w, h, A.rx ?? 10) }),
  chamfer: (w, h, A) => { const c = A.cut ?? 14; return { d: poly([[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]]) }; },
  pill: (w, h) => ({ d: rr(0, 0, w, h, w / 2) }),
  tomb: (w, h) => ({ d: `M0 ${f(w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${w} ${f(w / 2)}V${h - 14}Q${w} ${h} ${w - 14} ${h}H14Q0 ${h} 0 ${h - 14}Z` }),
  shield: (w, h) => ({ d: `M12 0H${w - 12}Q${w} 0 ${w} 12V${f(h * 0.58)}C${w} ${f(h * 0.8)} ${f(w * 0.72)} ${f(h * 0.93)} ${f(w / 2)} ${h}C${f(w * 0.28)} ${f(h * 0.93)} 0 ${f(h * 0.8)} 0 ${f(h * 0.58)}V12Q0 0 12 0Z` }),
  hexv: (w, h) => { const t = w * 0.3; return { d: poly([[w / 2, 0], [w, t], [w, h - t], [w / 2, h], [0, h - t], [0, t]]) }; },
  hexh: (w, h) => { const t = w * 0.14; return { d: poly([[t, 0], [w - t, 0], [w, h / 2], [w - t, h], [t, h], [0, h / 2]]) }; },
  trap: (w, h, A) => { const k = w * (A.taper ?? 0.12); return { d: `M${f(k + 8)} 0H${f(w - k - 8)}Q${f(w - k)} 0 ${f(w - k + 1)} 8L${w} ${h - 12}Q${w} ${h} ${w - 12} ${h}H12Q0 ${h} 0 ${h - 12}L${f(k - 1)} 8Q${f(k)} 0 ${f(k + 8)} 0Z` }; },
  para: (w, h, A) => { const s = A.skew ?? 24; return { d: `M${s + 6} 0H${w - 4}Q${w} 0 ${w - 1} 4L${w - s} ${h - 4}Q${w - s - 2} ${h} ${w - s - 6} ${h}H4Q0 ${h} 1 ${h - 4}L${s} 4Q${s + 1} 0 ${s + 6} 0Z` }; },
  pick: (w, h) => ({ d: `M${f(w / 2)} ${h}C${f(w * 0.3)} ${f(h * 0.9)} 0 ${f(h * 0.5)} 0 ${f(h * 0.26)}C0 ${f(h * 0.07)} ${f(w * 0.2)} 0 ${f(w / 2)} 0C${f(w * 0.8)} 0 ${w} ${f(h * 0.07)} ${w} ${f(h * 0.26)}C${w} ${f(h * 0.5)} ${f(w * 0.7)} ${f(h * 0.9)} ${f(w / 2)} ${h}Z` }),
  drop: (w, h) => ({ d: `M${f(w / 2)} 0C${f(w * 0.6)} ${f(h * 0.16)} ${w} ${f(h * 0.36)} ${w} ${f(h * 0.62)}C${w} ${f(h * 0.88)} ${f(w * 0.78)} ${h} ${f(w / 2)} ${h}C${f(w * 0.22)} ${h} 0 ${f(h * 0.88)} 0 ${f(h * 0.62)}C0 ${f(h * 0.36)} ${f(w * 0.4)} ${f(h * 0.16)} ${f(w / 2)} 0Z` }),
  circle: (w, h) => { const s = Math.max(w, h); return { d: circ(s / 2, s / 2, s / 2), fit: { w: s, h: s } }; },
  egg: (w, h) => ({ d: `M${f(w / 2)} 0C${f(w * 0.86)} 0 ${w} ${f(h * 0.42)} ${w} ${f(h * 0.62)}C${w} ${f(h * 0.88)} ${f(w * 0.78)} ${h} ${f(w / 2)} ${h}C${f(w * 0.22)} ${h} 0 ${f(h * 0.88)} 0 ${f(h * 0.62)}C0 ${f(h * 0.42)} ${f(w * 0.14)} 0 ${f(w / 2)} 0Z` }),
  blob: (w, h, A) => {
    const r = rnd(A.seed || 7), n = 11, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.93 + 0.07 * r(); pts.push([w / 2 + Math.cos(a) * (w / 2) * k, h / 2 + Math.sin(a) * (h / 2) * k]); }
    let d = '';
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += (i ? '' : `M${f((pts[n - 1][0] + p[0]) / 2)} ${f((pts[n - 1][1] + p[1]) / 2)}`) + `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`; }
    return { d: d + 'Z' };
  },
  ticket: (w, h, A) => { const ny = h * (A.notch ?? 0.36), r = 11; return { d: `M10 0H${w - 10}Q${w} 0 ${w} 10V${f(ny - r)}A${r} ${r} 0 0 0 ${w} ${f(ny + r)}V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}V${f(ny + r)}A${r} ${r} 0 0 0 0 ${f(ny - r)}V10Q0 0 10 0Z` }; },
  cloud: (w, h) => {
    const top = [[0.04, 0.5], [0.12, 0.3], [0.3, 0.13], [0.52, 0.03], [0.72, 0.12], [0.88, 0.28], [0.96, 0.48]];
    const side = [[1, 0.66], [0.97, 0.84], [0.9, 0.97]];
    const pts = [...top, ...side, [0.62, 0.97], [0.38, 0.97], [0.1, 0.97], [0.03, 0.84], [0, 0.66]].map(([x, y]) => [(0.035 + x * 0.93) * w, (0.02 + y * 0.98) * h]);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length], ch = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const flat = i >= 10 && i <= 12;
      d += `A${f(flat ? ch * 2 : ch * 0.58)} ${f(flat ? ch * 2 : ch * 0.58)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
    }
    return { d: d + 'Z' };
  },
  heart: (w, h) => ({ d: `M${f(w / 2)} ${f(h * 0.2)}C${f(w * 0.4)} ${f(h * 0.02)} 0 0 0 ${f(h * 0.3)}C0 ${f(h * 0.56)} ${f(w * 0.28)} ${f(h * 0.76)} ${f(w / 2)} ${h}C${f(w * 0.72)} ${f(h * 0.76)} ${w} ${f(h * 0.56)} ${w} ${f(h * 0.3)}C${w} 0 ${f(w * 0.6)} ${f(h * 0.02)} ${f(w / 2)} ${f(h * 0.2)}Z` }),
  bottle: (w, h, A) => {
    const nw = w * 0.34, nh = A.neck ?? 54, x0 = (w - nw) / 2, x1 = (w + nw) / 2;
    return { d: `M${f(x0 + 4)} 0H${f(x1 - 4)}Q${f(x1)} 0 ${f(x1)} 4V${f(nh)}C${f(x1)} ${f(nh + 16)} ${w} ${f(nh + 14)} ${w} ${f(nh + 48)}V${h - 16}Q${w} ${h} ${w - 16} ${h}H16Q0 ${h} 0 ${h - 16}V${f(nh + 48)}C0 ${f(nh + 14)} ${f(x0)} ${f(nh + 16)} ${f(x0)} ${f(nh)}V4Q${f(x0)} 0 ${f(x0 + 4)} 0Z` };
  },
  tv: (w, h) => {
    const t = 46;
    return {
      d: rr(0, t, w, h - t, 18),
      back(g) {
        for (const a of [-28, 30]) {
          const ag = G(g, { transform: `translate(${w / 2},${t - 8}) rotate(${a})` });
          R(ag, -2.2, -44, 4.4, 46, 2.2, { fill: lin('ant', [[0, '#c9ced6'], [0.5, '#f3f5f8'], [1, '#7c838c']], 0, 0, 1, 0) });
          C(ag, 0, -45, 3.6, { fill: 'url(#g-chromeR)' });
        }
        P(g, `M${w / 2 - 26} ${t + 1}Q${w / 2 - 24} ${t - 16} ${w / 2} ${t - 16}Q${w / 2 + 24} ${t - 16} ${w / 2 + 26} ${t + 1}Z`, { fill: lin('tvdome', [[0, '#4a4e57'], [1, '#17181c']]) });
      },
    };
  },
  rocket: (w, h) => {
    const bx0 = w * 0.16, bx1 = w * 0.84, cx = w / 2, fy = h - 64;
    return {
      d: `M${f(cx)} 0C${f(bx1 - 8)} 30 ${f(bx1)} 90 ${f(bx1)} 140V${h - 14}Q${f(bx1)} ${h} ${f(bx1 - 14)} ${h}H${f(bx0 + 14)}Q${f(bx0)} ${h} ${f(bx0)} ${h - 14}V140C${f(bx0)} 90 ${f(bx0 + 8)} 30 ${f(cx)} 0Z`,
      back(g) {
        for (const m of [1, -1]) {
          const tr = m === 1 ? '' : `translate(${w},0) scale(-1,1)`;
          P(g, `M${f(bx0 + 4)} ${fy}L2 ${h - 20}Q0 ${h - 2} 12 ${h - 4}L${f(bx0 + 4)} ${h - 14}Z`, { fill: lin('fin', [[0, '#e8402a'], [1, '#8a1a10']], 0, 0, 1, 1), stroke: '#000', 'stroke-opacity': 0.4, transform: tr });
        }
      },
    };
  },
  cup: (w, h) => {
    const hx = 30;
    return {
      d: `M${hx} 0H${w}L${w - 8} ${h - 22}Q${w - 10} ${h} ${w - 30} ${h}H${hx + 30}Q${hx + 10} ${h} ${hx + 8} ${h - 22}Z`,
      back(g) {
        P(g, `M${hx + 6} 60C-6 56 -2 150 ${hx + 12} 150L${hx + 14} 132C${hx - 6} 130 ${hx - 10} 80 ${hx + 6} 80Z`, { fill: lin('cuph', [[0, '#ffffff'], [1, '#cfc8bc']], 0, 0, 1, 0), stroke: '#7a6f60', 'stroke-opacity': 0.5 });
      },
    };
  },
  can: (w, h) => { const e = 12; return { d: `M0 ${e}A${f(w / 2)} ${e} 0 0 1 ${w} ${e}V${h - e}A${f(w / 2)} ${e} 0 0 1 0 ${h - e}Z` }; },
  capacitor: (w, h) => {
    const e = 12, bh = h - 24;
    return {
      d: `M0 ${e}A${f(w / 2)} ${e} 0 0 1 ${w} ${e}V${bh - e}A${f(w / 2)} ${e} 0 0 1 0 ${bh - e}Z`,
      back(g) { for (const x of [w * 0.36, w * 0.64]) R(g, x - 2.2, bh - 8, 4.4, h - bh + 8, 2, { fill: lin('lead', [[0, '#8a8f96'], [0.5, '#eef0f3'], [1, '#6d737a']], 0, 0, 1, 0) }); },
    };
  },
  jar: (w, h) => { const l = 26; return { d: `M${f(w * 0.12)} 4Q${f(w * 0.12)} 0 ${f(w * 0.16)} 0H${f(w * 0.84)}Q${f(w * 0.88)} 0 ${f(w * 0.88)} 4V${l}H${f(w * 0.9)}Q${w} ${l + 4} ${w} ${l + 26}V${h - 18}Q${w} ${h} ${w - 18} ${h}H18Q0 ${h} 0 ${h - 18}V${l + 26}Q0 ${l + 4} ${f(w * 0.1)} ${l}H${f(w * 0.12)}Z` }; },
  battery: (w, h) => { const n = 14; return { d: `M${f(w * 0.36)} 3Q${f(w * 0.36)} 0 ${f(w * 0.39)} 0H${f(w * 0.61)}Q${f(w * 0.64)} 0 ${f(w * 0.64)} 3V${n}H${w - 10}Q${w} ${n} ${w} ${n + 10}V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}V${n + 10}Q0 ${n} 10 ${n}H${f(w * 0.36)}Z` }; },
  bellows: (w, h) => {
    const k = 18, dep = 6, top = 26, bot = h - 26, n = Math.round((bot - top) / k);
    let rgt = '', lft = '';
    for (let i = 0; i < n; i++) { const y = top + ((bot - top) * (i + 0.5)) / n, y2 = top + ((bot - top) * (i + 1)) / n; rgt += `L${w - dep} ${f(y)}L${w} ${f(y2)}`; }
    for (let i = n - 1; i >= 0; i--) { const y = top + ((bot - top) * (i + 0.5)) / n, y2 = top + ((bot - top) * i) / n; lft += `L${dep} ${f(y)}L0 ${f(y2)}`; }
    return { d: `M10 0H${w - 10}Q${w} 0 ${w} 10V${top}${rgt}V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}V${bot}${lft}V10Q0 0 10 0Z` };
  },
  fuzzy: (w, h) => {
    const s = 9, b = 2.6, i0 = 6;
    let d = `M${i0} 0`;
    for (let x = i0; x < w - i0 - 1; x += s) d += `Q${f(x + s / 2)} ${-b} ${f(Math.min(w - i0, x + s))} 0`;
    d += `Q${w} 0 ${w} ${i0}`;
    for (let y = i0; y < h - i0 - 1; y += s) d += `Q${f(w + b)} ${f(y + s / 2)} ${w} ${f(Math.min(h - i0, y + s))}`;
    d += `Q${w} ${h} ${w - i0} ${h}`;
    for (let x = w - i0; x > i0 + 1; x -= s) d += `Q${f(x - s / 2)} ${f(h + b)} ${f(Math.max(i0, x - s))} ${h}`;
    d += `Q0 ${h} 0 ${h - i0}`;
    for (let y = h - i0; y > i0 + 1; y -= s) d += `Q${-b} ${f(y - s / 2)} 0 ${f(Math.max(i0, y - s))}`;
    return { d: d + `Q0 0 ${i0} 0Z` };
  },
  pot: (w, h) => {
    const hw = 24, y0 = 34;
    return {
      d: rr(hw, 18, w - 2 * hw, h - 18, 30),
      back(g) {
        for (const m of [1, -1]) {
          const tr = m === 1 ? '' : `translate(${w},0) scale(-1,1)`;
          P(g, `M${hw + 6} ${y0}H8Q0 ${y0} 0 ${y0 + 8}V${y0 + 10}Q0 ${y0 + 18} 8 ${y0 + 18}H${hw + 6}Z`, { fill: lin('poth', [[0, '#3a3c42'], [1, '#121316']]), transform: tr });
        }
        R(g, w / 2 - 22, 4, 44, 18, 6, { fill: lin('potk', [[0, '#3a3c42'], [1, '#121316']]) });
      },
    };
  },
  skyline: (w, h, A) => {
    const b = A.city || [[0.14, 30], [0.1, 8], [0.12, 22], [0.08, 0], [0.16, 16], [0.1, 34], [0.14, 12], [0.16, 26]];
    let x = 0, d = `M0 ${h - 10}V${b[0][1]}`;
    const tot = b.reduce((s, q) => s + q[0], 0);
    b.forEach(([fw, y], i) => { const nx = x + (fw / tot) * w; d += `${i ? `V${y}` : ''}H${f(nx)}`; x = nx; });
    return { d: d + `V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}Z` };
  },
  jelly: (w, h) => {
    const top = w * 0.52, n = 6, yb = h - 16;
    let d = `M0 ${f(top)}A${f(w / 2)} ${f(top)} 0 0 1 ${w} ${f(top)}V${yb}`;
    for (let i = n; i > 0; i--) d += `A${f(w / n / 2)} 15 0 0 1 ${f((w * (i - 1)) / n)} ${yb}`;
    return { d: d + 'Z' };
  },
  octo: (w, h) => {
    const n = 8, yb = h - 18;
    let d = `M0 ${f(w * 0.46)}C0 ${f(w * 0.12)} ${f(w * 0.2)} 0 ${f(w / 2)} 0C${f(w * 0.8)} 0 ${w} ${f(w * 0.12)} ${w} ${f(w * 0.46)}V${yb}`;
    for (let i = n; i > 0; i--) d += `Q${f((w * (i - 0.5)) / n)} ${h + 4} ${f((w * (i - 1)) / n)} ${yb}`;
    return { d: d + 'Z' };
  },
  venn: (w, h) => {
    const r = h / 2, dx = w / 2 - r, yi = Math.sqrt(r * r - dx * dx);
    return { d: `M${f(w / 2)} ${f(r - yi)}A${f(r)} ${f(r)} 0 1 0 ${f(w / 2)} ${f(r + yi)}A${f(r)} ${f(r)} 0 1 0 ${f(w / 2)} ${f(r - yi)}Z` };
  },
  tower: (w, h) => {
    const cx = w / 2, lw = w * 0.36, gw = w * 0.62, tw = w * 0.56;
    return { d: `M${f(cx - lw / 2 + 6)} 22Q${f(cx)} -4 ${f(cx + lw / 2 - 6)} 22V64H${f(cx + gw / 2)}V76H${f(cx + tw / 2)}L${w} ${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}L${f(cx - tw / 2)} 76H${f(cx - gw / 2)}V64H${f(cx - lw / 2 + 6)}Z` };
  },
  bubble: (w, h) => { const t = 22, b = h - t; return { d: `M24 0H${w - 24}Q${w} 0 ${w} 24V${b - 24}Q${w} ${b} ${w - 24} ${b}H${f(w * 0.36)}L${f(w * 0.14)} ${h}L${f(w * 0.2)} ${b}H24Q0 ${b} 0 ${b - 24}V24Q0 0 24 0Z` }; },
  frog: (w, h) => { const T = 26, er = 25, e1 = w * 0.26, e2 = w * 0.74; return { d: `M0 ${T + 16}Q0 ${T} 16 ${T}H${f(e1 - er)}A${er} ${er} 0 0 1 ${f(e1 + er)} ${T}H${f(e2 - er)}A${er} ${er} 0 0 1 ${f(e2 + er)} ${T}H${w - 16}Q${w} ${T} ${w} ${T + 16}V${h - 18}Q${w} ${h} ${w - 18} ${h}H18Q0 ${h} 0 ${h - 18}Z` }; },
  lamp: (w, h) => {
    const cx = w / 2, by = h - 120;
    return { d: `M${f(cx - w * 0.17)} 0H${f(cx + w * 0.17)}L${f(cx + w * 0.2)} 30C${f(cx + w * 0.3)} 70 ${f(cx + w * 0.38)} ${f(by - 60)} ${f(cx + w * 0.34)} ${f(by)}L${w} ${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}L${f(cx - w * 0.34)} ${f(by)}C${f(cx - w * 0.38)} ${f(by - 60)} ${f(cx - w * 0.3)} 70 ${f(cx - w * 0.2)} 30Z` };
  },
  window: (w, h) => ({ d: rr(0, 0, w, h, w * 0.4) }),
  clock: (w, h) => {
    const cw = w * 0.82, cx0 = (w - cw) / 2, hood = 120;
    return { d: `M0 ${hood}V60C0 20 ${f(w * 0.25)} 0 ${f(w / 2)} 0C${f(w * 0.75)} 0 ${w} 20 ${w} 60V${hood}H${f(cx0 + cw)}V${h - 40}H${w - 4}Q${w} ${h - 40} ${w} ${h - 34}V${h - 6}Q${w} ${h} ${w - 6} ${h}H6Q0 ${h} 0 ${h - 6}V${h - 34}Q0 ${h - 40} 4 ${h - 40}H${f(cx0)}V${hood}Z` };
  },
  stairs: (w, h) => { const s = [0, 14, 28, 42]; let d = `M0 ${h - 10}V8Q0 0 8 0`; s.forEach((y, i) => { const x1 = (w * (i + 1)) / s.length; d += `${i ? `V${y}` : ''}H${f(i === s.length - 1 ? x1 - 8 : x1)}`; }); return { d: d + `Q${w} ${s[3]} ${w} ${s[3] + 8}V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}Z` }; },
  pouch: (w, h) => ({ d: `M12 0H${w - 12}Q${w} 0 ${w} 12V${f(h - w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 0 ${f(h - w / 2)}V12Q0 0 12 0Z` }),
  canyon: (w, h) => ({ d: `M0 ${h - 10}V40L${f(w * 0.08)} 40L${f(w * 0.12)} 18H${f(w * 0.3)}L${f(w * 0.34)} 34H${f(w * 0.52)}L${f(w * 0.56)} 6H${f(w * 0.78)}L${f(w * 0.82)} 26H${f(w * 0.92)}L${w} 30V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}Z` }),
  paddle: (w, h) => { const R0 = w / 2, hw = 30, yi = R0 + Math.sqrt(R0 * R0 - hw * hw); return { d: `M${f(R0 - hw)} ${f(yi)}A${f(R0)} ${f(R0)} 0 1 1 ${f(R0 + hw)} ${f(yi)}V${h - 10}Q${f(R0 + hw)} ${h} ${f(R0 + hw - 10)} ${h}H${f(R0 - hw + 10)}Q${f(R0 - hw)} ${h} ${f(R0 - hw)} ${h - 10}Z` }; },
  stamp: (w, h) => {
    const r = 4.2, s = 14;
    const nx = Math.round(w / s), ny = Math.round(h / s), sx = w / nx, sy = h / ny;
    let d = 'M0 0';
    for (let i = 0; i < nx; i++) d += `H${f(i * sx + sx / 2 - r)}A${r} ${r} 0 0 0 ${f(i * sx + sx / 2 + r)} 0`;
    d += `H${w}`;
    for (let i = 0; i < ny; i++) d += `V${f(i * sy + sy / 2 - r)}A${r} ${r} 0 0 0 ${w} ${f(i * sy + sy / 2 + r)}`;
    d += `V${h}`;
    for (let i = nx - 1; i >= 0; i--) d += `H${f(i * sx + sx / 2 + r)}A${r} ${r} 0 0 0 ${f(i * sx + sx / 2 - r)} ${h}`;
    d += 'H0';
    for (let i = ny - 1; i >= 0; i--) d += `V${f(i * sy + sy / 2 + r)}A${r} ${r} 0 0 0 0 ${f(i * sy + sy / 2 - r)}`;
    return { d: d + 'Z' };
  },
  house: (w, h, A) => { const rh = A.roof ?? 70; return { d: `M${f(w / 2)} 0L${w} ${rh}V${h - 8}Q${w} ${h} ${w - 8} ${h}H8Q0 ${h} 0 ${h - 8}V${rh}Z` }; },
  sub: (w, h) => {
    const tH = 44, r0 = (h - tH) / 2, tx0 = w * 0.36, tx1 = w * 0.62;
    return { d: `M${f(r0)} ${tH}H${f(tx0)}V10Q${f(tx0)} 0 ${f(tx0 + 10)} 0H${f(tx1 - 6)}Q${f(tx1 + 4)} 0 ${f(tx1 + 8)} 14L${f(tx1 + 14)} ${tH}H${f(w - r0)}A${f(r0)} ${f(r0)} 0 0 1 ${f(w - r0)} ${h}H${f(r0)}A${f(r0)} ${f(r0)} 0 0 1 ${f(r0)} ${tH}Z` };
  },
  globe: (w, h, A) => {
    const R0 = A.globeR ?? w * 0.43, cx = w / 2, cy = R0, bw = w * 0.7, yi = cy + Math.sqrt(R0 * R0 - (bw / 2) ** 2);
    return { d: `M${f(cx - bw / 2)} ${f(yi)}A${f(R0)} ${f(R0)} 0 1 1 ${f(cx + bw / 2)} ${f(yi)}L${w} ${h - 12}Q${w} ${h} ${w - 12} ${h}H12Q0 ${h} 0 ${h - 12}Z`, yi };
  },
  owl: (w, h) => ({ d: `M0 34L6 0L${f(w * 0.3)} 22Q${f(w / 2)} 12 ${f(w * 0.7)} 22L${w - 6} 0L${w} 34V${h - 40}Q${w} ${h} ${f(w / 2)} ${h}Q0 ${h} 0 ${h - 40}Z` }),
  bell: (w, h) => ({ d: `M${f(w * 0.36)} 6Q${f(w / 2)} -2 ${f(w * 0.64)} 6C${f(w * 0.86)} 18 ${f(w * 0.84)} ${f(h * 0.5)} ${f(w * 0.88)} ${f(h * 0.74)}C${f(w * 0.91)} ${f(h * 0.86)} ${w} ${f(h * 0.88)} ${w} ${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}C0 ${f(h * 0.88)} ${f(w * 0.09)} ${f(h * 0.86)} ${f(w * 0.12)} ${f(h * 0.74)}C${f(w * 0.16)} ${f(h * 0.5)} ${f(w * 0.14)} 18 ${f(w * 0.36)} 6Z` }),
  iceberg: (w, h) => ({ d: `M0 ${h - 10}V58L${f(w * 0.16)} 30L${f(w * 0.28)} 40L${f(w * 0.48)} 0L${f(w * 0.62)} 26L${f(w * 0.76)} 14L${w} 52V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}Z` }),
  pillow: (w, h) => ({ d: `M8 18Q2 2 18 8Q${f(w / 2)} 16 ${w - 18} 8Q${w - 2} 2 ${w - 8} 18Q${w - 15} ${f(h / 2)} ${w - 8} ${h - 18}Q${w - 2} ${h - 2} ${w - 18} ${h - 8}Q${f(w / 2)} ${h - 16} 18 ${h - 8}Q2 ${h - 2} 8 ${h - 18}Q15 ${f(h / 2)} 8 18Z` }),
  guitar: (w, h) => {
    const cx = w / 2, ub = w * 0.4, lb = w / 2, wy = h * 0.4;
    return { d: `M${f(cx - 16)} 0H${f(cx + 16)}V14C${f(cx + ub)} 14 ${f(cx + ub + 6)} ${f(wy - 60)} ${f(cx + ub - 14)} ${f(wy)}C${f(cx + lb + 4)} ${f(wy + 40)} ${w} ${f(h * 0.62)} ${w} ${f(h * 0.76)}C${w} ${f(h * 0.94)} ${f(w * 0.8)} ${h} ${f(cx)} ${h}C${f(w * 0.2)} ${h} 0 ${f(h * 0.94)} 0 ${f(h * 0.76)}C0 ${f(h * 0.62)} ${f(cx - lb - 4)} ${f(wy + 40)} ${f(cx - ub + 14)} ${f(wy)}C${f(cx - ub - 6)} ${f(wy - 60)} ${f(cx - ub)} 14 ${f(cx - 16)} 14Z` };
  },
  notch: (w, h) => ({ d: `M12 0H${w - 12}Q${w} 0 ${w} 12V${h - 4}L${f(w / 2 + 8)} ${h - 28}Q${f(w / 2)} ${h - 33} ${f(w / 2 - 8)} ${h - 28}L0 ${h - 4}V12Q0 0 12 0Z` }),
  diamond: (w, h) => ({ d: `M${f(w / 2 - 8)} 5Q${f(w / 2)} -2 ${f(w / 2 + 8)} 5L${w - 5} ${f(h / 2 - 8)}Q${w + 2} ${f(h / 2)} ${w - 5} ${f(h / 2 + 8)}L${f(w / 2 + 8)} ${h - 5}Q${f(w / 2)} ${h + 2} ${f(w / 2 - 8)} ${h - 5}L5 ${f(h / 2 + 8)}Q-2 ${f(h / 2)} 5 ${f(h / 2 - 8)}Z` }),
  mound: (w, h) => ({ d: `M0 ${h - 12}V${f(h * 0.4)}C0 ${f(h * 0.1)} ${f(w * 0.22)} 0 ${f(w / 2)} 0C${f(w * 0.78)} 0 ${w} ${f(h * 0.1)} ${w} ${f(h * 0.4)}V${h - 12}Q${w} ${h} ${w - 12} ${h}H12Q0 ${h} 0 ${h - 12}Z` }),
  camera: (w, h) => { const t = 22; return { d: `M0 ${t + 14}Q0 ${t} 14 ${t}H${f(w * 0.3)}L${f(w * 0.36)} 0H${f(w * 0.64)}L${f(w * 0.7)} ${t}H${f(w * 0.76)}V${t - 8}Q${f(w * 0.76)} ${t - 12} ${f(w * 0.8)} ${t - 12}H${f(w * 0.88)}Q${f(w * 0.92)} ${t - 12} ${f(w * 0.92)} ${t - 8}V${t}H${w - 14}Q${w} ${t} ${w} ${t + 14}V${h - 14}Q${w} ${h} ${w - 14} ${h}H14Q0 ${h} 0 ${h - 14}Z` }; },
  fork: (w, h, A) => {
    const yb = A.prong ?? 96, pw = 34, gap = w * 0.24, p1 = w / 2 - gap / 2 - pw, p2 = w / 2 + gap / 2, yu = yb - 26;
    return { d: `M0 ${yb + 16}Q0 ${yb} 16 ${yb}H${f(p1)}V12Q${f(p1)} 0 ${f(p1 + 12)} 0H${f(p1 + pw - 12)}Q${f(p1 + pw)} 0 ${f(p1 + pw)} 12V${yu}A${f(gap / 2)} ${f(gap / 2)} 0 0 0 ${f(p2)} ${yu}V12Q${f(p2)} 0 ${f(p2 + 12)} 0H${f(p2 + pw - 12)}Q${f(p2 + pw)} 0 ${f(p2 + pw)} 12V${yb}H${w - 16}Q${w} ${yb} ${w} ${yb + 16}V${h - 16}Q${w} ${h} ${w - 16} ${h}H16Q0 ${h} 0 ${h - 16}Z` };
  },
  sign: (w, h) => { const sh = 74, pw = 26; return { d: `M0 ${sh / 2}L22 0H${w - 22}L${w} ${sh / 2}L${w - 22} ${sh}H${f(w / 2 + pw / 2)}V${sh + 14}H${w - 12}Q${w} ${sh + 14} ${w} ${sh + 26}V${h - 12}Q${w} ${h} ${w - 12} ${h}H12Q0 ${h} 0 ${h - 12}V${sh + 26}Q0 ${sh + 14} 12 ${sh + 14}H${f(w / 2 - pw / 2)}V${sh}H22Z` }; },
  mailbox: (w, h) => {
    const bw = w - 24;
    return {
      d: `M0 ${f(bw / 2)}A${f(bw / 2)} ${f(bw / 2)} 0 0 1 ${bw} ${f(bw / 2)}V${h - 10}Q${bw} ${h} ${bw - 10} ${h}H10Q0 ${h} 0 ${h - 10}Z`,
      back(g) {
        R(g, bw - 6, 104, 30, 7, 2, { fill: lin('flagp', [[0, '#9aa1a9'], [1, '#50565d']]) });
        P(g, `M${w - 12} 70H${w - 1}V96H${w - 12}Z`, { fill: '#d22a22', stroke: '#000', 'stroke-opacity': 0.4 });
        R(g, w - 14, 66, 4, 44, 2, { fill: '#7d848d' });
      },
    };
  },
  barrel: (w, h) => {
    const bw = w - 30;
    return {
      d: rr(0, 0, bw, h, 12),
      back(g) {
        R(g, bw - 4, 48, 16, 12, 3, { fill: lin('crk', [[0, '#c9ced6'], [1, '#6d737a']]) });
        R(g, bw + 8, 20, 8, 40, 4, { fill: lin('crk2', [[0, '#c9ced6'], [0.5, '#f3f5f8'], [1, '#6d737a']], 0, 0, 1, 0) });
        R(g, bw + 4, 8, 22, 16, 7, { fill: lin('crkh', [[0, '#7a3a1c'], [1, '#3a1a08']]) });
      },
    };
  },
  tent: (w, h) => {
    const rh = 74, b0 = w * 0.07, b1 = w * 0.93;
    return { d: `M${f(w / 2 - 6)} 4Q${f(w / 2)} -2 ${f(w / 2 + 6)} 4Q${f(w * 0.66)} ${rh * 0.6} ${w} ${rh}V${rh + 10}H${f(b1)}V${h - 10}Q${f(b1)} ${h} ${f(b1 - 10)} ${h}H${f(b0 + 10)}Q${f(b0)} ${h} ${f(b0)} ${h - 10}V${rh + 10}H0V${rh}Q${f(w * 0.34)} ${rh * 0.6} ${f(w / 2 - 6)} 4Z` };
  },
  slices: (w, h, A) => {
    const n = 8, off = A.offs || [0, 7, -5, 3, 9, -7, 2, -3], m = 10;
    let d = `M${m + off[0]} 0`;
    for (let i = 0; i < n; i++) { const y1 = (h * (i + 1)) / n; d += `H${f(w - m + off[i])}V${f(y1)}`; }
    for (let i = n - 1; i >= 0; i--) { const y0 = (h * i) / n; d += `H${f(m + off[i])}V${f(y0)}`; }
    return { d: d + 'Z' };
  },
  oct: (w, h) => SHAPES.chamfer(w, h, { cut: Math.min(w, h) * 0.2 }),
  lantern: (w, h) => { const cx = w / 2; return { d: `M${f(cx - 16)} 0H${f(cx + 16)}L${f(cx + 44)} 24H${w - 12}Q${w} 24 ${w} 36V${h - 12}Q${w} ${h} ${w - 12} ${h}H12Q0 ${h} 0 ${h - 12}V36Q0 24 12 24H${f(cx - 44)}Z` }; },
  gear: (w, h) => {
    const s = Math.max(w, h), c = s / 2, R1 = c, R0 = c - 10, n = 16;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, da = (Math.PI * 2) / n;
      const p = (ang, r) => `${f(c + Math.sin(ang) * r)} ${f(c - Math.cos(ang) * r)}`;
      d += (i ? 'L' : 'M') + p(a - da * 0.3, R0) + 'L' + p(a - da * 0.18, R1) + 'L' + p(a + da * 0.18, R1) + 'L' + p(a + da * 0.3, R0) + `A${f(R0)} ${f(R0)} 0 0 1 ` + p(a + da * 0.7, R0);
    }
    return { d: d + 'Z', fit: { w: s, h: s } };
  },
  belljar: (w, h, A) => {
    const x0 = w * 0.08, x1 = w * 0.92, rd = (x1 - x0) / 2, yb = A.baseY ?? 284, cx = w / 2;
    return { d: `M${f(x0)} ${yb}V${f(rd + 14)}A${f(rd)} ${f(rd)} 0 0 1 ${f(cx - 12)} 15V8Q${f(cx - 12)} 0 ${f(cx)} 0Q${f(cx + 12)} 0 ${f(cx + 12)} 8V15A${f(rd)} ${f(rd)} 0 0 1 ${f(x1)} ${f(rd + 14)}V${yb}H${w - 10}Q${w} ${yb} ${w} ${yb + 10}V${h - 12}Q${w} ${h} ${w - 12} ${h}H12Q0 ${h} 0 ${h - 12}V${yb + 10}Q0 ${yb} 10 ${yb}Z`, yb };
  },
};

// ------------------------------------------------------------------ finishes
function paint(g, d, col, A, w, h) {
  const m = A.mat || 'enamel', c2 = A.col2 || shade(col, -0.35);
  const grad = (k = '') => lin('b' + kid(col) + k, [[0, shade(col, 0.22)], [0.45, col], [1, shade(col, -0.32)]], 0, 0, 0.45, 1);
  const lay = (fill, a = {}) => P(g, d, Object.assign({ fill }, a));
  switch (m) {
    case 'matte': lay(col); lay('url(#p-grain)', { 'fill-opacity': 0.9 }); lay(lin('matteV', [[0, '#fff', 0.1], [0.5, '#fff', 0], [1, '#000', 0.18]])); break;
    case 'anod': lay(grad()); lay('url(#p-brushed)', { 'fill-opacity': 0.9 }); lay(lin('sheen', [[0, '#fff', 0.1], [0.45, '#fff', 0], [0.52, '#fff', 0.14], [0.6, '#fff', 0], [1, '#000', 0.12]], 0, 0, 1, 1)); break;
    case 'hammer': lay(grad()); lay(noise('hamD', 44, 22, [0, 0, 0], 0, 0.32, 2)); lay(noise('hamL', 34, 18, [255, 255, 255], 0, 0.2, 2)); break;
    case 'crinkle': lay(grad()); lay(noise('crk', 9, 48, [0, 0, 0], 0, 0.45, 1)); lay(noise('crkL', 7, 40, [255, 255, 255], 0, 0.12, 1)); break;
    case 'flake': lay(rad('fl' + kid(col), [[0, shade(col, 0.32)], [0.6, col], [1, shade(col, -0.42)]], 0.35, 0.28, 0.85)); lay(noise('flake', 11, 64, [255, 255, 255], 0, 0.55, 0), { 'fill-opacity': 0.55 }); lay(lin('gl', [[0, '#fff', 0.3], [0.2, '#fff', 0.06], [0.45, '#fff', 0], [1, '#000', 0.16]])); break;
    case 'wood': lay(lin('wd' + kid(col), [[0, shade(col, 0.15)], [0.5, col], [1, shade(col, -0.25)]], 0, 0, 1, 0.3)); break;
    case 'pearl': lay(lin('prl' + kid(col), [[0, '#ffffff'], [0.3, shade(col, 0.4)], [0.55, '#f3e6f4'], [0.78, '#dfeaf7'], [1, shade(col, -0.12)]], 0, 0, 1, 1)); lay(noise('prlN', 16, 48, [255, 255, 255], 0, 0.5, 2), { 'fill-opacity': 0.6 }); break;
    case 'paper': lay(col); lay(noise('paper', 30, 60, [90, 60, 20], 0, 0.16, 1)); lay(lin('paperV', [[0, '#fff', 0.15], [1, '#000', 0.12]])); break;
    case 'glass': lay(lin('gls' + kid(col), [[0, shade(col, 0.35)], [0.5, col], [1, shade(col, -0.45)]], 0, 0, 1, 1)); lay(lin('glsH', [[0, '#fff', 0.38], [0.18, '#fff', 0.06], [0.34, '#fff', 0], [0.8, '#fff', 0], [1, '#fff', 0.18]], 0, 0, 1, 0)); break;
    case 'chrome': lay(lin('chr' + kid(col), [[0, '#ffffff'], [0.2, shade(col, -0.1)], [0.42, '#f6f8fa'], [0.6, shade(col, -0.45)], [0.8, shade(col, 0.1)], [1, shade(col, -0.5)]], 0, 0, 1, 1)); lay('url(#p-brushed)', { 'fill-opacity': 0.5 }); break;
    case 'copper': lay(lin('cu' + kid(col), [[0, shade(col, 0.4)], [0.5, col], [1, shade(col, -0.4)]], 0, 0, 1, 1)); lay(noise('patina', 40, 40, [40, 140, 110], 0, 0.45, 2)); break;
    case 'concrete': lay(col); lay(noise('cretD', 30, 60, [0, 0, 0], 0, 0.45, 1)); lay(noise('cretL', 22, 44, [255, 255, 255], 0, 0.18, 1)); lay(lin('cretV', [[0, '#fff', 0.08], [1, '#000', 0.2]])); break;
    case 'felt': lay(col); lay(noise('feltD', 12, 48, [0, 0, 0], 0, 0.3, 0)); lay(noise('feltL', 10, 40, [255, 255, 255], 0, 0.18, 0)); break;
    case 'fur': lay(grad()); lay(noise('fur', 26, 52, [30, 15, 0], 0, 0.42, 1)); lay(noise('furL', 18, 36, [255, 230, 200], 0, 0.14, 1)); break;
    case 'rubber': lay(col); lay(noise('rub', 14, 42, [255, 255, 255], 0, 0.08, 1)); lay(lin('rubV', [[0, '#fff', 0.08], [1, '#000', 0.25]])); break;
    case 'candy': lay(lin('cdy' + kid(col) + kid(c2), [[0, col], [1, c2]], 0, 0, 1, 1)); lay('url(#p-grain)', { 'fill-opacity': 0.4 }); lay(lin('gl', [[0, '#fff', 0.3], [0.2, '#fff', 0.06], [0.45, '#fff', 0], [1, '#000', 0.16]])); break;
    case 'brass': lay(lin('brs' + kid(col), [[0, '#fff3c4'], [0.25, col], [0.5, shade(col, 0.3)], [0.75, shade(col, -0.35)], [1, shade(col, -0.5)]], 0, 0, 1, 1)); lay('url(#p-brushed)', { 'fill-opacity': 0.55 }); break;
    case 'marble': lay(lin('mrb' + kid(col), [[0, '#ffffff'], [1, col]], 0, 0, 1, 1)); lay(noise('mrbN', 40, 50, [120, 120, 130], 0, 0.22, 2)); break;
    case 'leather': lay(grad()); lay(noise('lth', 16, 48, [0, 0, 0], 0, 0.38, 1)); break;
    case 'velvet': lay(rad('vel' + kid(col), [[0, shade(col, 0.35)], [0.7, col], [1, shade(col, -0.5)]], 0.4, 0.3, 0.8)); lay(noise('velN', 10, 40, [0, 0, 0], 0, 0.2, 0)); break;
    case 'ice': lay(lin('ice' + kid(col), [[0, '#ffffff'], [0.4, col], [1, shade(col, -0.35)]], 0, 0, 0.6, 1)); lay(noise('iceN', 36, 48, [255, 255, 255], 0, 0.3, 2)); break;
    case 'sand': lay(grad()); lay(noise('sandD', 8, 40, [80, 40, 0], 0, 0.3, 0)); break;
    case 'plastic': lay(lin('pl' + kid(col), [[0, shade(col, 0.12)], [0.5, col], [1, shade(col, -0.18)]], 0, 0, 0.3, 1)); lay('url(#p-grain)', { 'fill-opacity': 0.3 }); break;
    default: lay(grad()); lay('url(#p-grain)', { 'fill-opacity': 0.45 }); lay(lin('gl', [[0, '#fff', 0.3], [0.2, '#fff', 0.06], [0.45, '#fff', 0], [1, '#000', 0.16]]));
  }
}
// grain lines etc. that need the clip
function texture(t, w, h, col, A) {
  const m = A.mat;
  if (m === 'wood') {
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * w + Math.sin(i * 1.9) * 4, a = 3 + Math.sin(i * 2.3) * 3;
      P(t, `M${f(x)} -4C${f(x + a)} ${f(h * 0.3)} ${f(x - a)} ${f(h * 0.62)} ${f(x + a * 0.6)} ${h + 4}`, { stroke: shade(col, i % 3 ? -0.45 : 0.25), 'stroke-width': i % 4 ? 0.6 : 1.3, 'stroke-opacity': 0.4, fill: 'none' });
    }
  } else if (m === 'marble') {
    const r = rnd(5);
    for (let i = 0; i < 6; i++) {
      let x = r() * w, y = -4, d = `M${f(x)} ${y}`;
      while (y < h) { x += (r() - 0.45) * 30; y += 18 + r() * 20; d += `L${f(x)} ${f(y)}`; }
      P(t, d, { stroke: shade(col, -0.35), 'stroke-opacity': 0.35, 'stroke-width': 0.5 + r(), fill: 'none' });
    }
  }
}
// the same outline shrunk towards the centre (inner rims, stitching)
function inset(t, d, w, h, px, a) {
  const sx = (w - 2 * px) / w, sy = (h - 2 * px) / h;
  return P(t, d, Object.assign({ fill: 'none', transform: `translate(${f(px)},${f(px)}) scale(${sx.toFixed(4)},${sy.toFixed(4)})`, 'vector-effect': 'non-scaling-stroke' }, a));
}

// ------------------------------------------------------------------ logo styles
function logo(g, x, y, s, o) {
  const st = o.style || 'plain';
  const base = Object.assign({ weight: 700 }, o);
  if (st === 'shadow') txt(g, x + (o.dx ?? 1.4), y + (o.dy ?? 1.4), s, Object.assign({}, base, { fill: o.shadow || '#000', opacity: 0.45 }));
  if (st === 'double') { txt(g, x - 1.3, y, s, Object.assign({}, base, { fill: o.c1 || '#ff2a6a', opacity: 0.8 })); txt(g, x + 1.3, y, s, Object.assign({}, base, { fill: o.c2 || '#2ae0ff', opacity: 0.8 })); }
  if (st === 'neon') { txt(g, x, y, s, Object.assign({}, base, { fill: 'none', stroke: o.fill, sw: 3.2, opacity: 0.3 })); }
  if (st === 'emboss') txt(g, x + 0.6, y + 0.7, s, Object.assign({}, base, { fill: '#fff', opacity: 0.35 }));
  if (st === 'outline') return txt(g, x, y, s, Object.assign({}, base, { stroke: o.stroke || '#000', sw: o.sw || 1.6 }));
  return txt(g, x, y, s, base);
}

// ------------------------------------------------------------------ the form
const KEY = (c, n) => (c.t === 'foot' ? 'foot' + n.foot++ : c.t === 'led' ? 'led' + n.led++ : c.p || (c.t === 'button' ? 'btn' + n.btn++ : c.t + n.x++));
function rowH(kind, items, A) {
  const r = A.kr ?? 11.5;
  if (kind === 'screen') return Math.max(...items.map((c) => c.h || 40)) + 16;
  if (kind === 'treadle') return Math.max(...items.map((c) => c.h || 120)) + 12;
  if (kind === 'slider') return Math.max(...items.map((c) => c.h || 44)) + 26;
  if (items.some((c) => c.t === 'knob' || c.t === 'sel')) return 2 * r + 23;
  if (items.some((c) => c.t === 'toggle')) return 38;
  return 28;
}
function tz6(ctx, def) {
  const A = def.art || {};
  const g = ctx.g;
  const col = def.color || '#555';
  const ink = def.text || inkFor(col);
  const acc = def.accent || '#ffcc33';
  const all = def.controls.filter((c) => !c.hidden);
  // ---- 1. control groups and rows
  const n = { foot: 0, led: 0, btn: 0, x: 0 };
  const keyed = all.map((c) => ({ c, k: KEY(c, n) }));
  const fixed = A.fixed || {};
  const free = keyed.filter(({ k }) => !fixed[k]);
  const foots = free.filter(({ c }) => c.t === 'foot').map((e) => e.c);
  const leds = free.filter(({ c }) => c.t === 'led').map((e) => e.c);
  const mleds = A.mleds || 0; // leading LEDs placed by the illustration
  const autoLeds = leds.slice(mleds);
  const rest = free.filter(({ c }) => c.t !== 'foot' && c.t !== 'led');
  const byKey = new Map(rest.map((e) => [e.k, e.c]));
  const used = new Set();
  const rows = [];
  for (const r of A.layout || []) {
    const items = r.map((k) => byKey.get(k)).filter(Boolean);
    items.forEach((c) => used.add(c));
    if (items.length) rows.push(items);
  }
  const left = rest.map((e) => e.c).filter((c) => !used.has(c));
  const kinds = [['screen'], ['treadle'], ['knob', 'sel'], ['slider'], ['toggle', 'button']];
  const perRow = A.cols || 4;
  for (const ks of kinds) {
    const items = left.filter((c) => ks.includes(c.t));
    if (!items.length) continue;
    const per = ks[0] === 'knob' ? perRow : ks[0] === 'slider' ? 9 : ks[0] === 'toggle' ? 4 : 1;
    const nr = Math.ceil(items.length / per);
    let i = 0;
    for (let k = 0; k < nr; k++) { const cnt = Math.ceil((items.length - i) / (nr - k)); rows.push(items.slice(i, i + cnt)); i += cnt; }
  }
  const plan = rows.map((items) => {
    const kind = items[0].t === 'screen' ? 'screen' : items[0].t === 'treadle' ? 'treadle' : items.every((c) => c.t === 'slider') ? 'slider' : 'mixed';
    return { items, kind, h: rowH(kind, items, A) };
  });
  // ---- 2. vertical budget
  const L = A.logo || {};
  const typeDy = L.typeDy ?? Math.round((L.size || 18) * (L.font === 'script' ? 0.62 : 0.52) + 6);
  const padTop = A.padTop ?? 12, artH = A.artH ?? 80, logoH = A.logoIn ? 0 : A.logoH ?? Math.max(36, typeDy + 22), gap = A.gap ?? 6;
  const fr = A.footR ?? 11;
  const footLab = foots.some((c) => c.label);
  const footH = foots.length ? 2 * fr + 8 + (footLab ? 12 : 0) + (autoLeds.length ? 16 : 0) : autoLeds.length ? 16 : 0;
  const padBot = A.padBot ?? 14;
  const rowsH = plan.reduce((s, r) => s + r.h, 0);
  let w = A.w || 200;
  let h = A.h || padTop + artH + logoH + gap + rowsH + gap + footH + padBot;
  let S = (SHAPES[A.shape] || SHAPES.rect)(w, h, A);
  if (S.fit) { w = S.fit.w; h = S.fit.h; }
  const extra = Math.max(0, h - (padTop + artH + logoH + gap + rowsH + gap + footH + padBot));
  const top = padTop + extra * (A.extraTop ?? 0.5);
  const d = S.d;
  const B = (y0, y1, x0) => band(d, w, y0, y1, x0) || [w / 2 - 20, w / 2 + 20];
  // ---- 3. enclosure
  softShadow(g, { w, h, path: d, dy: 12, blur: 9, opacity: 0.6 });
  if (S.back) S.back(g);
  paint(g, d, col, A, w, h);
  const id = 't6c' + ++clipSeq;
  P(svg('clipPath', { id }, g), d, {});
  const t = G(g, { 'clip-path': `url(#${id})` });
  texture(t, w, h, col, A);
  const artBox = { x: 0, y: top, w, h: artH };
  const deck0 = top + artH + logoH + gap;
  const cx = (A.cx ?? w / 2);
  const kit = { t, g, w, h, d, col, ink, acc, def, A, B, artBox, deck0, cx, shape: S };
  const M = MOTIFS[A.motif];
  const mo = (M && M(t, artBox, kit)) || {};
  // deck panel behind the controls
  if (A.panel) {
    const y0 = deck0 - 6, y1 = deck0 + rowsH + (A.panelFoot ? footH : 0) + 4;
    const [l, r] = B(y0, y1);
    const pm = A.panelM ?? 8;
    R(t, l + pm, y0, r - l - 2 * pm, y1 - y0, A.panelR ?? 8, { fill: A.panel, 'fill-opacity': A.panelA ?? 1, stroke: A.panelStroke || '#000', 'stroke-opacity': 0.35 });
  }
  if (A.rim !== false) inset(t, d, w, h, 3, { stroke: '#fff', 'stroke-opacity': A.rimA ?? 0.12, 'stroke-width': 1 });
  if (A.stitch) inset(t, d, w, h, 6, { stroke: A.stitch, 'stroke-opacity': 0.8, 'stroke-width': 1, 'stroke-dasharray': '3 2.4' });
  P(g, d, { fill: 'none', stroke: '#fff', 'stroke-opacity': A.edgeA ?? 0.24, 'stroke-width': 1.3, 'pointer-events': 'none' });
  P(g, d, { fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8, 'pointer-events': 'none' });
  // ---- 4. printing
  if (!A.noLogo) {
    const ly = A.logoIn ? top + (A.logoY ?? artH / 2) : top + artH + 13;
    const lb = B(ly - 8, ly + 8, L.x ?? cx);
    const lx = L.x ?? (lb[0] + lb[1]) / 2;
    const mw = L.maxW ?? lb[1] - lb[0] - 20;
    logo(g, lx, ly, def.logo || def.name, Object.assign({ size: 18, maxW: mw, fill: def.logoColor || ink, ls: 1.5 }, L));
    if (def.typeName && !A.noType) {
      const ty = ly + typeDy;
      const tb = B(ty - 4, ty + 4, lx);
      txt(g, lx, ty, def.typeName.toUpperCase(), { size: 5, maxW: tb[1] - tb[0] - 24, font: 'inter', fill: A.typeColor || def.logoColor || ink, weight: 700, ls: 1.1, opacity: 0.8 });
    }
  }
  // ---- 5. place controls
  const ctlR = A.kr ?? 11.5;
  let y = deck0;
  for (const row of plan) {
    const items = row.items;
    let cy;
    if (row.kind === 'screen' || row.kind === 'treadle') cy = y + row.h / 2 + 2;
    else if (row.kind === 'slider') cy = y + (items[0].h || 44) / 2 + 8;
    else cy = items.some((c) => c.t === 'knob' || c.t === 'sel') ? y + ctlR + 3 : items.some((c) => c.t === 'toggle') ? y + 18 : y + 10;
    const [l, r] = B(y + 1, y + row.h - 2, cx);
    const ext = (c) => (c.t === 'sel' ? ctlR + (c.labelRadius ?? 8) + 9 : c.t === 'toggle' ? 16 : c.t === 'screen' || c.t === 'treadle' ? (c.w || 100) / 2 : c.t === 'slider' ? 10 : c.t === 'button' ? 12 : Math.max(ctlR + 4, 15));
    const m = A.margin ?? 8;
    const k = items.length;
    const x0 = l + m + ext(items[0]), x1 = r - m - ext(items[k - 1]);
    const pitch = k > 1 ? Math.min(A.maxPitch ?? (row.kind === 'slider' ? 24 : 54), (x1 - x0) / (k - 1)) : 0;
    const mid = (l + r) / 2;
    items.forEach((c, i) => {
      const x = mid + (i - (k - 1) / 2) * pitch;
      const o = { x, y: cy, _t6: true };
      if (c.t === 'knob' || c.t === 'sel') {
        const need = 2 * ctlR + 12;
        o.r = c.rr ?? (k > 1 && pitch < need ? Math.max(8.5, ctlR * (pitch / need)) : ctlR);
        o.labelPos = 'below';
        if (c.t === 'sel') { o.optSize = c.optSize ?? 4.6; o.labelRadius = c.labelRadius ?? 7; }
      }
      if (c.t === 'toggle') o.orient = 'h';
      if (c.t === 'button') o.r = c.r ?? 5;
      Object.assign(c, o);
    });
    y += row.h;
  }
  // footswitches + LEDs
  const fy = h - padBot - fr - (footLab ? 12 : 0) - 2;
  if (foots.length) {
    const [l, r] = B(fy - fr - 2, fy + fr + 2, cx);
    const k = foots.length, span = r - l - 2 * (A.footM ?? 14) - 2 * fr;
    const pitch = k > 1 ? Math.min(A.footPitch ?? (k === 2 ? 100 : 66), span / (k - 1)) : 0;
    foots.forEach((c, i) => Object.assign(c, { x: (l + r) / 2 + (i - (k - 1) / 2) * pitch, y: fy, r: fr, style: c.style || 'stomp', _t6: true }));
  }
  const ly = foots.length ? fy - fr - 13 : h - padBot - 6;
  autoLeds.forEach((c, i) => {
    let x;
    if (autoLeds.length === foots.length) x = foots[i].x;
    else if (autoLeds.length === 1) x = foots.length ? foots[0].x : cx;
    else { const [l, r] = B(ly - 4, ly + 4, cx); const p = Math.min(26, (r - l - 30) / (autoLeds.length - 1)); x = (l + r) / 2 + (i - (autoLeds.length - 1) / 2) * p; }
    Object.assign(c, { x, y: ly, r: c.r || 2.8, _t6: true });
  });
  (mo.leds || []).forEach((s, i) => { if (leds[i]) Object.assign(leds[i], s, { _t6: true }); });
  for (const { c, k } of keyed) if (fixed[k]) Object.assign(c, fixed[k], { _t6: true });
  // badge
  if (A.badge !== false) {
    const by = A.badgeY ?? h - Math.max(6, padBot / 2);
    const bb = B(by - 3, by + 3, cx);
    if (bb[1] - bb[0] > 50) txt(g, (bb[0] + bb[1]) / 2, by, 'TONE ZONE', { size: 4.2, fill: A.badgeColor || ink, weight: 800, ls: 1.4, opacity: 0.7, font: 'inter' });
  }
  const theme = { text: ink, knob: def.knob || 'chrome', labelSize: A.labelSize ?? 6.2, labelLs: 0.5, labelFont: A.labelFont ? FONTS[A.labelFont] : undefined };
  formKit.placeControls(ctx, all, theme);
  if (mo.over) mo.over();
  // jacks hug the outline
  const jy = A.jy ?? (plan.length ? deck0 + 14 : h / 2);
  const jacks = formKit.jacksSide(def, w, { y0: jy, gap: A.jgap ?? 26, flip: ctx.flip });
  for (const j of jacks) { const e = rowAt(d, w, j.y, cx) || [0, w]; j.x = j.side === 'right' ? e[1] + 2 : e[0] - 2; }
  return { w, h, theme: Object.assign({}, theme, { jackText: A.jackText || ink }), jacks };
}
let clipSeq = 0;

// ------------------------------------------------------------------ illustrations
// MOTIFS[name](t, box, kit): t = group clipped to the body, box = art area {x, y, w, h}. May return
// { leds: [{x, y, r, bezel, color}], over() } (LED slots for the first `art.mleds` LEDs).
const MOTIFS = {};
let mclip = 0;
const clipTo = (p, d) => { const id = 't6m' + ++mclip; P(svg('clipPath', { id }, p), d, {}); return G(p, { 'clip-path': `url(#${id})` }); };
const hexP = (cx, cy, r) => poly([0, 1, 2, 3, 4, 5].map((i) => [cx + Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r, cy + Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r]));
const starP = (cx, cy, r1, r2, n = 5, a0 = -Math.PI / 2) => poly([...Array(n * 2)].map((_, i) => { const a = a0 + (i * Math.PI) / n, r = i % 2 ? r2 : r1; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }));
const wave = (x0, x1, y, amp, per, ph = 0) => { let d = ''; for (let x = x0; x <= x1 + 0.1; x += 4) d += (d ? 'L' : 'M') + f(x) + ' ' + f(y + Math.sin(((x - x0) / per) * Math.PI * 2 + ph) * amp); return d; };
const stroke = (c, w = 1, a = 1) => ({ fill: 'none', stroke: c, 'stroke-width': w, 'stroke-opacity': a, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });

MOTIFS.honeycomb = (t, b, k) => {
  const y1 = b.y + b.h - 18;
  let drip = `M0 0H${k.w}V${f(y1)}`;
  const dr = [[0.9, 10], [0.78, 26], [0.66, 6], [0.55, 18], [0.42, 32], [0.3, 8], [0.18, 22], [0.06, 4]];
  let px = k.w;
  for (const [fx, dl] of dr) { const x = fx * k.w; drip += `Q${f((px + x) / 2 + 6)} ${f(y1)} ${f(x + 6)} ${f(y1)}Q${f(x + 6)} ${f(y1 + dl)} ${f(x)} ${f(y1 + dl + 4)}Q${f(x - 6)} ${f(y1 + dl)} ${f(x - 6)} ${f(y1)}`; px = x - 6; }
  drip += 'L0 ' + f(y1) + 'Z';
  P(t, drip, { fill: lin('honey', [[0, '#ffd35a'], [0.6, '#f2a516'], [1, '#b8680a']]) });
  const hg = clipTo(t, drip);
  const r = 14, hx = r * Math.sqrt(3);
  let d = '';
  for (let row = 0; row < (y1 + 40) / (r * 1.5); row++) for (let c = -1; c < k.w / hx + 1; c++) d += hexP(c * hx + (row % 2 ? hx / 2 : 0), row * r * 1.5, r - 1.2);
  P(hg, d, stroke('#7a4606', 2.2, 0.75));
  P(hg, d, { fill: '#fff', 'fill-opacity': 0.06 });
  P(t, drip, stroke('#fff3b0', 1, 0.5));
};
MOTIFS.porchlight = (t, b, k) => {
  P(t, `M0 0H${k.w}V24H0Z`, { fill: lin('lcap', [[0, '#3a3c42'], [1, '#121316']]) });
  const x0 = 26, x1 = k.w - 26, y0 = b.y + 2, y1 = b.y + b.h - 6, cx = k.w / 2, cy = (y0 + y1) / 2;
  R(t, x0, y0, x1 - x0, y1 - y0, 6, { fill: '#1a1408' });
  R(t, x0, y0, x1 - x0, y1 - y0, 6, { fill: rad('lglow', [[0, '#fff4c8'], [0.35, '#ffcf6a', 0.9], [1, '#ff9a2a', 0.05]]) });
  for (const x of [x0 + (x1 - x0) / 3, x0 + (2 * (x1 - x0)) / 3]) R(t, x - 1.5, y0, 3, y1 - y0, 1, { fill: '#121316' });
  R(t, x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, 8, { fill: 'none', stroke: '#121316', 'stroke-width': 4 });
  E(t, cx, cy + 4, 12, 16, { fill: '#fff', 'fill-opacity': 0.25 });
  for (const [mx, my, s] of [[cx - 34, cy - 18, 1], [cx + 30, cy + 10, -1]]) {
    const mg = G(t, { transform: `translate(${mx},${my}) scale(${s},1)` });
    P(mg, 'M0 0C-7 -9 -14 -4 -11 2C-8 5 -3 3 0 1C3 3 8 5 11 2C14 -4 7 -9 0 0Z', { fill: '#5a4630', 'fill-opacity': 0.85 });
    P(mg, 'M0 -2V5', stroke('#2a2010', 1.2));
  }
  R(t, 0, y1 + 6, k.w, 3, 0, { fill: '#000', 'fill-opacity': 0.25 });
  return { leds: [{ x: cx, y: cy + 4, r: 6.5, bezel: '#6a5a3a', color: '#ffcf6a' }] };
};
MOTIFS.saltflat = (t, b, k) => {
  const hy = b.y + b.h * 0.58;
  R(t, 0, 0, k.w, hy, 0, { fill: lin('sfsky', [[0, '#9fc8e8'], [1, '#f4efe4']]) });
  C(t, k.w * 0.72, hy - 10, 13, { fill: k.acc, 'fill-opacity': 0.9 });
  P(t, `M0 ${f(hy)}L${f(k.w * 0.12)} ${f(hy - 14)}L${f(k.w * 0.22)} ${f(hy - 6)}L${f(k.w * 0.36)} ${f(hy - 20)}L${f(k.w * 0.5)} ${f(hy - 4)}L${f(k.w * 0.6)} ${f(hy - 9)}L${f(k.w * 0.68)} ${f(hy)}Z`, { fill: '#7f93ab', 'fill-opacity': 0.8 });
  R(t, 0, hy, k.w, b.y + b.h - hy + 4, 0, { fill: lin('sfg', [[0, '#e9e3d6'], [1, '#f6f2ea']]) });
  const r = rnd(3);
  for (let i = 0; i < 9; i++) {
    const yy = hy + 3 + i * i * 0.55, sp = 12 + i * 5;
    for (let x = -sp + (i % 2) * sp * 0.5; x < k.w + sp; x += sp) P(t, `M${f(x)} ${f(yy)}l${f(sp * 0.5)} ${f(1.5 + i * 0.7)}l${f(sp * 0.5)} ${f(-1.5 - i * 0.7 * r())}`, stroke('#b7aa92', 0.5 + i * 0.08, 0.7));
  }
  P(t, `M0 ${f(hy)}H${k.w}`, stroke('#fff', 1, 0.8));
};
MOTIFS.treerings = (t, b, k) => {
  const cx = k.w / 2, cy = b.y + b.h / 2, R0 = Math.min(b.h / 2 - 2, 48);
  C(t, cx, cy, R0 + 4, { fill: '#3a1a0a' });
  C(t, cx, cy, R0, { fill: rad('ring', [[0, '#e9b97a'], [0.7, '#c98a4e'], [1, '#9a5a2a']]) });
  for (let i = 1; i < 11; i++) {
    const r0 = (R0 * i) / 11;
    let d = '';
    for (let a = 0; a <= 64; a++) { const an = (a / 64) * Math.PI * 2, rr2 = r0 * (1 + 0.05 * Math.sin(an * 3 + i) + 0.03 * Math.sin(an * 7)); d += (a ? 'L' : 'M') + f(cx + Math.cos(an) * rr2) + ' ' + f(cy + Math.sin(an) * rr2 * 0.96); }
    P(t, d + 'Z', stroke('#7a3e18', i % 3 ? 0.6 : 1.1, 0.7));
  }
  P(t, `M${cx} ${cy}l8 -10l4 -14l10 -16`, stroke('#3a1a0a', 1.4, 0.8));
};
MOTIFS.marmalade = (t, b, k) => {
  const ck = pattern('ging' + kid(k.acc), 10, 10, (p) => { R(p, 0, 0, 10, 10, 0, { fill: '#fff' }); R(p, 0, 0, 5, 10, 0, { fill: '#d22a3a', 'fill-opacity': 0.55 }); R(p, 0, 0, 10, 5, 0, { fill: '#d22a3a', 'fill-opacity': 0.55 }); });
  P(t, `M0 0H${k.w}V26H0Z`, { fill: ck });
  R(t, 0, 24, k.w, 3, 0, { fill: '#000', 'fill-opacity': 0.3 });
  const cx = k.w / 2, cy = b.y + b.h / 2 - 4, r = 30;
  C(t, cx, cy, r + 3, { fill: '#ffb23a' });
  C(t, cx, cy, r, { fill: '#ffe2a0' });
  for (let i = 0; i < 9; i++) { const a0 = (i / 9) * Math.PI * 2 + 0.08, a1 = ((i + 1) / 9) * Math.PI * 2 - 0.08; P(t, `M${f(cx + Math.cos(a0) * 4)} ${f(cy + Math.sin(a0) * 4)}L${f(cx + Math.cos(a0) * (r - 3))} ${f(cy + Math.sin(a0) * (r - 3))}A${r - 3} ${r - 3} 0 0 1 ${f(cx + Math.cos(a1) * (r - 3))} ${f(cy + Math.sin(a1) * (r - 3))}Z`, { fill: '#ff8a1a', 'fill-opacity': 0.85 }); }
  for (const [x, y, a] of [[34, b.y + 20, 30], [k.w - 40, b.y + 64, -20], [44, b.y + 70, 70]]) R(t, x, y, 14, 3.4, 1.7, { fill: '#ff9a2a', transform: `rotate(${a} ${x} ${y})` });
  P(t, `M14 ${b.y + b.h + 2}H${k.w - 14}`, stroke('#fff', 1, 0.4));
};
MOTIFS.road = (t, b, k) => {
  const cx = k.w / 2, vy = b.y - 6, y1 = b.y + b.h + 4;
  R(t, 0, 0, k.w, b.y + 8, 0, { fill: lin('rsky', [[0, '#0b1230'], [1, '#2a2b2e', 0]]) });
  for (const s of [-1, 1]) P(t, `M${cx + s * 2} ${vy}L${f(cx + s * 7)} ${y1}`, stroke(k.acc, 2.2, 0.9));
  for (const s of [-1, 1]) P(t, `M${cx + s * 18} ${vy}L${f(cx + s * k.w * 0.4)} ${y1}`, stroke('#f2f2ee', 2, 0.55));
  R(t, 0, y1, k.w, 2, 0, { fill: k.acc, 'fill-opacity': 0.6 });
  for (let i = 0; i < 7; i++) { const yy = vy + 8 + i * i * 4; P(t, `M${f(cx - 1)} ${f(yy)}V${f(yy + 2 + i)}`, stroke('#2a2b2e', 4)); }
};
MOTIFS.battery = (t, b, k) => {
  P(t, `M0 0H${k.w}V14H0Z`, { fill: lin('nub', [[0, '#e8c48a'], [1, '#8a5a2a']], 0, 0, 1, 0) });
  R(t, 0, 14, k.w, 26, 0, { fill: lin('cu' + kid(k.acc), [[0, '#e8b46a'], [1, k.acc]]) });
  T6(t, k.w / 2, 27, '+', { size: 16, fill: '#3a2410', weight: 800, font: FONTS.inter });
  const cx = k.w / 2, cy = b.y + b.h * 0.56;
  P(t, `M${cx + 6} ${f(cy - 40)}L${cx - 22} ${f(cy + 4)}H${cx - 2}L${cx - 10} ${f(cy + 38)}L${cx + 22} ${f(cy - 8)}H${cx + 2}Z`, { fill: '#ffcf3a', stroke: '#7a4a00', 'stroke-width': 1.2 });
  R(t, cx - 16, cy - 16, 32, 8, 4, { fill: '#141518' });
  for (const x of [cx - 9, cx + 9]) C(t, x, cy - 12, 2, { fill: '#fff' });
  for (let i = 0; i < 5; i++) R(t, 26 + i * ((k.w - 52) / 5), b.y + b.h + 34, (k.w - 52) / 5 - 4, 4, 1, { fill: i === 0 ? '#ff3b30' : '#ffffff', 'fill-opacity': i === 0 ? 0.95 : 0.12 });
};
MOTIFS.scrap = (t, b, k) => {
  const c = k.w / 2, r = rnd(9);
  for (let i = 0; i < 7; i++) E(t, 20 + r() * (k.w - 40), 20 + r() * (k.h - 40), 8 + r() * 16, 5 + r() * 10, { fill: '#8a3a12', 'fill-opacity': 0.22 + r() * 0.2 });
  C(t, c, c, c - 22, stroke('#000', 1.4, 0.35));
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; C(t, c + Math.sin(a) * (c - 16), c - Math.cos(a) * (c - 16), 2.2, { fill: 'url(#g-chromeR)', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.5 }); }
  const ty = b.y + b.h - 6;
  const hz = pattern('hazard', 14, 14, (p) => { R(p, 0, 0, 14, 14, 0, { fill: '#1d1d1d' }); P(p, 'M0 14L14 0H7L0 7ZM14 14V7L7 14Z', { fill: '#ffcf3a' }); });
  R(t, 0, ty, k.w, 7, 0, { fill: hz, 'fill-opacity': 0.9 });
};
MOTIFS.city = (t, b, k) => {
  R(t, 0, 0, k.w, b.y + b.h, 0, { fill: lin('ncity', [[0, '#090b1e'], [1, '#2a1846']]) });
  C(t, k.w * 0.74, b.y + 18, 10, { fill: '#f4ecd2' });
  C(t, k.w * 0.74 + 4, b.y + 15, 9, { fill: '#100f28' });
  const r = rnd(4), base = b.y + b.h;
  let x = 0, d = '', wins = '';
  while (x < k.w) {
    const bw = 12 + r() * 18, bh = 18 + r() * 46;
    d += `M${f(x)} ${f(base)}V${f(base - bh)}H${f(x + bw)}V${f(base)}Z`;
    for (let yy = base - bh + 5; yy < base - 4; yy += 6) for (let xx = x + 3; xx < x + bw - 3; xx += 5) if (r() > 0.6) wins += `M${f(xx)} ${f(yy)}h2v3h-2Z`;
    x += bw + 1;
  }
  P(t, d, { fill: '#05060f' });
  P(t, wins, { fill: '#ffd36b', 'fill-opacity': 0.8 });
  for (let i = 0; i < 18; i++) { const x0 = r() * k.w, y0 = r() * base; P(t, `M${f(x0)} ${f(y0)}l-3 9`, stroke('#9aa8ff', 0.6, 0.35)); }
  R(t, 0, base, k.w, 2, 0, { fill: k.acc, 'fill-opacity': 0.8 });
};
MOTIFS.tumbleweed = (t, b, k) => {
  const hy = b.y + b.h - 8;
  C(t, k.w * 0.7, hy - 6, 22, { fill: '#ff8a3a', 'fill-opacity': 0.75 });
  P(t, `M0 ${hy}H${k.w}`, stroke('#8a4b1e', 1.4, 0.6));
  P(t, `M${f(k.w * 0.2)} ${hy}V${hy - 24}M${f(k.w * 0.2)} ${hy - 14}h-6v-8M${f(k.w * 0.2)} ${hy - 10}h6v-8`, stroke('#4a6a2a', 3.4));
  const cx = k.w / 2 - 6, cy = hy - 22, r = rnd(2);
  for (let i = 0; i < 14; i++) E(t, cx + (r() - 0.5) * 8, cy + (r() - 0.5) * 6, 10 + r() * 10, 6 + r() * 10, Object.assign(stroke('#6b3a14', 0.9, 0.8), { transform: `rotate(${f(r() * 180)} ${cx} ${cy})` }));
  for (const yy of [cy - 8, cy, cy + 8]) P(t, `M${cx - 34} ${yy}h-16`, stroke('#8a4b1e', 1, 0.5));
};
MOTIFS.velcro = (t, b, k) => {
  const y0 = b.y + 10, hh = b.h - 22;
  const lp = pattern('loops', 8, 7, (p) => { P(p, 'M1 7V3Q1 0.5 4 0.5Q7 0.5 7 3V7', stroke('#2a2a2a', 1)); });
  R(t, -2, y0, k.w + 4, hh, 0, { fill: '#1b1b1b' });
  R(t, -2, y0, k.w + 4, hh, 0, { fill: lp });
  R(t, -2, y0, k.w + 4, hh, 0, { fill: lin('vband', [[0, '#fff', 0.12], [0.5, '#fff', 0], [1, '#000', 0.3]]) });
  let z = `M-2 ${y0 + hh / 2}`;
  for (let x = 0; x <= k.w; x += 10) z += `L${x} ${y0 + hh / 2 + (x % 20 ? -5 : 5)}`;
  P(t, z, stroke(k.col, 2.2, 0.9));
};
MOTIFS.hornet = (t, b, k) => {
  const cx = k.w / 2;
  for (const s of [-1, 1]) {
    const wx = cx + s * 52, wy = b.y + 50, tr = `rotate(${s * -30} ${wx} ${wy})`;
    E(t, wx, wy, 44, 15, { fill: '#e8f8ff', 'fill-opacity': 0.6, stroke: '#141414', 'stroke-opacity': 0.55, transform: tr });
    P(t, `M${wx - s * 40} ${wy}H${wx + s * 38}M${wx - s * 10} ${wy}l${s * 22} -10M${wx - s * 10} ${wy}l${s * 24} 9M${wx + s * 14} ${wy}l${s * 14} -8`, Object.assign(stroke('#141414', 0.7, 0.45), { transform: tr }));
    P(t, `M${cx + s * 10} ${b.y + 4}Q${cx + s * 24} ${b.y - 10} ${cx + s * 40} ${b.y - 14}`, stroke('#141414', 2));
  }
  const eye = pattern('ommat', 4, 4, (p) => { C(p, 2, 2, 1.3, { fill: '#3a3a3a' }); });
  for (const s of [-1, 1]) { E(t, cx + s * 22, b.y + 20, 17, 22, { fill: '#141414' }); E(t, cx + s * 22, b.y + 20, 17, 22, { fill: eye }); E(t, cx + s * 26, b.y + 12, 5, 8, { fill: '#fff', 'fill-opacity': 0.3 }); }
  for (const y of [b.y + b.h - 16, b.y + b.h - 2]) R(t, 0, y, k.w, 8, 0, { fill: '#141414' });
  P(t, `M${cx - 30} ${k.h - 40}H${cx + 30}L${cx} ${k.h}Z`, { fill: '#141414' });
};
MOTIFS.mammoth = (t, b, k) => {
  const cx = k.w / 2, cy = b.y + b.h / 2;
  for (const s of [-1, 1]) E(t, cx + s * 58, cy - 4, 34, 44, { fill: shade(k.col, -0.3) });
  E(t, cx, cy - 6, 50, 46, { fill: shade(k.col, -0.12) });
  P(t, `M${cx - 12} ${cy}C${cx - 14} ${cy + 30} ${cx - 2} ${cy + 52} ${cx + 16} ${cy + 46}C${cx + 26} ${cy + 42} ${cx + 22} ${cy + 30} ${cx + 12} ${cy + 34}C${cx + 6} ${cy + 36} ${cx + 10} ${cy + 20} ${cx + 12} ${cy}Z`, { fill: shade(k.col, -0.22), stroke: shade(k.col, -0.5), 'stroke-width': 0.8 });
  for (const s of [-1, 1]) P(t, `M${cx + s * 14} ${cy + 12}C${cx + s * 30} ${cy + 40} ${cx + s * 64} ${cy + 44} ${cx + s * 74} ${cy + 18}C${cx + s * 60} ${cy + 34} ${cx + s * 36} ${cy + 30} ${cx + s * 22} ${cy + 6}Z`, { fill: lin('tusk', [[0, '#fffaf0'], [1, '#d8c8a4']]), stroke: '#6a5a3a', 'stroke-width': 0.8 });
  for (const s of [-1, 1]) C(t, cx + s * 20, cy - 14, 3, { fill: '#140a04' });
  for (let i = 0; i < 16; i++) { const x = cx - 46 + i * 6; P(t, `M${x} ${cy - 46}q2 6 -1 12`, stroke(shade(k.col, -0.45), 1.2, 0.7)); }
};
MOTIFS.espresso = (t, b, k) => {
  const cx = k.cx, rx = (k.w - 30) / 2 - 2;
  E(t, cx, 8, rx, 12, { fill: '#c9b89a' });
  E(t, cx, 9, rx - 6, 9, { fill: rad('crema', [[0, '#c98a4a'], [0.75, '#7a3e18'], [1, '#3a1a08']]) });
  P(t, `M${cx} 15C${cx - 6} 10 ${cx - 14} 7 ${cx - 9} 3C${cx - 5} 0.5 ${cx - 1} 3 ${cx} 6C${cx + 1} 3 ${cx + 5} 0.5 ${cx + 9} 3C${cx + 14} 7 ${cx + 6} 10 ${cx} 15Z`, { fill: '#f6ead2', 'fill-opacity': 0.9 });
  R(t, 0, b.y + b.h - 26, k.w, 14, 0, { fill: k.acc, 'fill-opacity': 0.9 });
  for (let i = 0; i < 7; i++) E(t, 48 + i * 22, b.y + b.h - 19, 5, 3.2, { fill: '#3a1a08', transform: `rotate(${i % 2 ? 30 : -30} ${48 + i * 22} ${b.y + b.h - 19})` });
};
MOTIFS.rocket = (t, b, k) => {
  const cx = k.w / 2;
  P(t, `M0 0H${k.w}V66H0Z`, { fill: lin('nose', [[0, '#ff6a4a'], [1, '#a8180c']], 0, 0, 1, 0) });
  P(t, `M0 66H${k.w}`, stroke('#5a0a04', 2));
  const py = b.y + 74;
  C(t, cx, py, 26, { fill: 'url(#g-chrome)' });
  C(t, cx, py, 20, { fill: rad('port', [[0, '#9fe8ff'], [1, '#14365a']], 0.4, 0.35, 0.7) });
  E(t, cx - 7, py - 7, 7, 4, { fill: '#fff', 'fill-opacity': 0.5 });
  for (const yy of [b.y + 40, k.h - 40]) { P(t, `M0 ${yy}H${k.w}`, stroke('#000', 0.8, 0.3)); for (let x = 30; x < k.w - 20; x += 12) C(t, x, yy + 4, 1, { fill: '#000', 'fill-opacity': 0.3 }); }
};
MOTIFS.capacitor = (t, b, k) => {
  E(t, k.w / 2, 12, k.w / 2 - 2, 10, { fill: lin('capTop', [[0, '#f3f5f8'], [1, '#8a9099']]) });
  P(t, `M${k.w / 2 - 20} 6L${k.w / 2 + 20} 18M${k.w / 2 + 20} 6L${k.w / 2 - 20} 18`, stroke('#5a6068', 1.4));
  R(t, k.w - 22, 22, 22, k.h, 0, { fill: '#d8dde6', 'fill-opacity': 0.85 });
  for (let y = 40; y < k.h - 40; y += 30) R(t, k.w - 16, y, 9, 3, 1, { fill: k.col });
  T6(t, 70, b.y + b.h / 2 - 8, '4700 µF', { size: 13, fill: '#eef2fa', font: FONTS.mono, weight: 400 });
  T6(t, 70, b.y + b.h / 2 + 10, '50 V  105°C', { size: 7, fill: '#eef2fa', font: FONTS.mono, weight: 400, opacity: 0.8 });
  P(t, `M0 ${k.h - 36}H${k.w}`, stroke('#000', 2, 0.25));
};
MOTIFS.accordion = (t, b, k) => {
  const x0 = 20, x1 = k.w - 20, y0 = b.y + 2, y1 = b.y + b.h - 4;
  R(t, x0, y0, x1 - x0, y1 - y0, 6, { fill: '#1a1a1a' });
  const lat = pattern('lattice', 10, 10, (p) => { P(p, 'M0 5L5 0L10 5L5 10Z', stroke('#d9b45a', 0.8)); });
  R(t, x0 + 44, y0 + 6, x1 - x0 - 88, y1 - y0 - 12, 3, { fill: lat });
  for (const sx of [x0 + 10, x1 - 34]) for (let r0 = 0; r0 < 4; r0++) for (let c = 0; c < 2; c++) C(t, sx + c * 12 + (r0 % 2) * 6, y0 + 12 + r0 * 14, 4.2, { fill: 'url(#g-whiteKnob)', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.5 });
  for (let y = 26; y < k.h - 26; y += 9) { P(t, `M0 ${y}h12`, stroke('#000', 1, 0.35)); P(t, `M${k.w} ${y}h-12`, stroke('#000', 1, 0.35)); }
};
MOTIFS.rope = (t, b, k) => {
  const y0 = b.y + 16, y1 = b.y + b.h - 6, xl = 30, xr = k.w - 30;
  for (const x of [xl, xr]) { R(t, x - 4, y0, 8, y1 - y0, 3, { fill: 'url(#g-gold)' }); C(t, x, y0, 7, { fill: 'url(#g-gold)' }); E(t, x, y1, 14, 4, { fill: 'url(#g-gold)' }); }
  P(t, `M${xl} ${y0 + 8}Q${k.w / 2} ${y0 + 58} ${xr} ${y0 + 8}`, stroke('#7a1030', 7));
  P(t, `M${xl} ${y0 + 8}Q${k.w / 2} ${y0 + 58} ${xr} ${y0 + 8}`, Object.assign(stroke('#d9b45a', 7, 0.6), { 'stroke-dasharray': '3 3' }));
  T6(t, k.w / 2, y0 + 8, 'VIP', { size: 10, fill: '#e8c76a', weight: 800, ls: 4, font: FONTS.inter });
};
MOTIFS.gauge = (t, b, k) => {
  P(t, rr(24, 18, k.w - 48, 16, 8), { fill: '#000', 'fill-opacity': 0.2 });
  const cx = k.w / 2, cy = b.y + b.h / 2 + 4, r = 38;
  C(t, cx, cy, r + 5, { fill: 'url(#g-chrome)' });
  C(t, cx, cy, r, { fill: rad('gface', [[0, '#ffffff'], [1, '#dfe2e6']]) });
  const pol = (a, rr2) => [cx + Math.sin(a) * rr2, cy - Math.cos(a) * rr2];
  const a0 = -2.2, a1 = 2.2;
  const [rx0, ry0] = pol(1.3, r - 6), [rx1, ry1] = pol(a1, r - 6);
  P(t, `M${f(rx0)} ${f(ry0)}A${r - 6} ${r - 6} 0 0 1 ${f(rx1)} ${f(ry1)}`, stroke(k.acc, 5, 0.85));
  for (let i = 0; i <= 10; i++) { const a = a0 + ((a1 - a0) * i) / 10, [x0, y0] = pol(a, r - 3), [x1, y1] = pol(a, r - (i % 5 ? 8 : 12)); P(t, `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`, stroke('#1a1c20', i % 5 ? 0.8 : 1.6)); }
  const [nx, ny] = pol(0.9, r - 10);
  P(t, `M${cx} ${cy}L${f(nx)} ${f(ny)}`, stroke('#d22a22', 2));
  C(t, cx, cy, 4, { fill: '#1a1c20' });
  T6(t, cx, cy + 16, 'PSI', { size: 6, fill: '#1a1c20', weight: 800, font: FONTS.inter });
};
MOTIFS.book = (t, b, k) => {
  R(t, 0, 0, 14, k.h, 0, { fill: '#000', 'fill-opacity': 0.25 });
  for (let y = 30; y < k.h; y += 60) R(t, 0, y, 14, 4, 1, { fill: '#000', 'fill-opacity': 0.35 });
  R(t, 22, 10, k.w - 32, k.h - 20, 4, stroke(k.acc, 1.4, 0.8));
  R(t, 26, 14, k.w - 40, k.h - 28, 3, stroke(k.acc, 0.6, 0.7));
  const cx = k.w / 2 + 4, cy = b.y + b.h / 2;
  for (const s of [-1, 1]) C(t, cx + s * 18, cy, 13, stroke(k.acc, 2.4));
  P(t, `M${cx - 5} ${cy - 2}Q${cx} ${cy - 7} ${cx + 5} ${cy - 2}M${cx - 31} ${cy - 3}l-14 -6M${cx + 31} ${cy - 3}l14 -6`, stroke(k.acc, 2));
  R(t, k.w - 44, 0, 10, b.y + 18, 0, { fill: '#a8202a' });
  P(t, `M${k.w - 44} ${b.y + 18}l5 -5l5 5Z`, { fill: shade(k.col, -0.1) });
};
MOTIFS.skyline = (t, b, k) => {
  const r = rnd(8);
  let wins = '';
  for (let y = 4; y < b.y + b.h - 6; y += 7) for (let x = 6; x < k.w - 6; x += 7) if (r() > 0.55) wins += `M${x} ${y}h3v4h-3Z`;
  P(t, wins, { fill: k.acc, 'fill-opacity': 0.75 });
  R(t, 0, b.y + b.h - 14, k.w, 14, 0, { fill: lin('skyglow', [[0, '#ff7a59', 0], [1, '#ff7a59', 0.4]]) });
};
MOTIFS.level = (t, b, k) => {
  for (let i = -6; i < 14; i++) P(t, `M${i * 22} ${b.y + b.h}L${i * 22 + 50} 0`, stroke('#fff', 6, 0.05));
  const x0 = 44, x1 = k.w - 44, y0 = b.y + b.h / 2 - 10;
  R(t, x0 - 6, y0 - 6, x1 - x0 + 12, 32, 16, { fill: '#0b2a2c' });
  R(t, x0, y0, x1 - x0, 20, 10, { fill: lin('vial', [[0, '#e8ff9a'], [0.5, k.acc], [1, '#7a9a1a']]) });
  E(t, (x0 + x1) / 2 + 10, y0 + 7, 16, 5.5, { fill: '#fdfff0' });
  for (const x of [(x0 + x1) / 2 - 12, (x0 + x1) / 2 + 32]) P(t, `M${x} ${y0}v20`, stroke('#0b2a2c', 1.4));
  R(t, x0, y0, x1 - x0, 7, 4, { fill: '#fff', 'fill-opacity': 0.35 });
};
MOTIFS.greek = (t, b, k) => {
  const key = pattern('meander', 16, 16, (p) => { P(p, 'M0 14H14V2H4V10H10V6', stroke('#9a7b4f', 1.6)); });
  for (const y of [b.y + 2, b.y + b.h - 14]) { R(t, 0, y, k.w, 14, 0, { fill: key }); P(t, `M0 ${y - 1}H${k.w}M0 ${y + 15}H${k.w}`, stroke('#9a7b4f', 1)); }
  const cx = k.w / 2, cy = b.y + b.h / 2 + 1, gold = '#9a7b4f';
  R(t, cx - 30, cy - 12, 60, 5, 1, { fill: gold, 'fill-opacity': 0.85 });
  P(t, `M${cx - 24} ${cy - 7}H${cx + 24}Q${cx + 18} ${cy + 1} ${cx + 12} ${cy + 3}H${cx - 12}Q${cx - 18} ${cy + 1} ${cx - 24} ${cy - 7}Z`, { fill: gold, 'fill-opacity': 0.55 });
  for (const s of [-1, 1]) { C(t, cx + s * 22, cy - 2, 6, stroke(gold, 1.6)); C(t, cx + s * 22, cy - 2, 2.4, { fill: gold }); }
  for (let i = -3; i <= 3; i++) P(t, `M${cx + i * 4} ${cy + 4}V${cy + 14}`, stroke(gold, 1.2, 0.8));
};
MOTIFS.jelly = (t, b, k) => {
  const cx = k.w / 2;
  for (let i = 1; i < 5; i++) P(t, `M${f(cx - i * 22)} ${f(b.y + 78)}Q${cx} ${f(b.y + 78 - i * 24)} ${f(cx + i * 22)} ${f(b.y + 78)}`, stroke('#fff', 1.4, 0.25));
  for (const [x, y, r] of [[cx - 40, b.y + 40, 9], [cx + 36, b.y + 30, 7], [cx + 4, b.y + 20, 6], [cx - 12, b.y + 58, 5], [cx + 56, b.y + 60, 5]]) C(t, x, y, r * 2.2, { fill: rad('jglow', [[0, '#7dfff0', 0.8], [1, '#7dfff0', 0]]) });
  for (let i = 0; i < 7; i++) { const x = 18 + i * ((k.w - 36) / 6); P(t, `M${f(x)} ${f(b.y + b.h)}C${f(x + 8)} ${f(b.y + b.h + 60)} ${f(x - 8)} ${f(b.y + b.h + 120)} ${f(x + 4)} ${k.h}`, stroke('#fff', 1.6, 0.12)); }
  P(t, `M0 ${f(b.y + b.h)}Q${cx} ${f(b.y + b.h + 10)} ${k.w} ${f(b.y + b.h)}`, stroke('#fff', 1.2, 0.3));
};
MOTIFS.lighthouse = (t, b, k) => {
  const cx = k.w / 2;
  R(t, 0, 0, k.w, 64, 0, { fill: lin('lroom', [[0, '#1a2a3a'], [1, '#0c141c']]) });
  for (const x of [cx - 26, cx - 9, cx + 9, cx + 26]) P(t, `M${x} 20V64`, stroke('#2a2c30', 2));
  P(t, `M${cx} 40L0 18V62Z`, { fill: '#fff3b0', 'fill-opacity': 0.3 });
  P(t, `M${cx} 40L${k.w} 22V58Z`, { fill: '#fff3b0', 'fill-opacity': 0.18 });
  R(t, 0, 0, k.w, 22, 0, { fill: '#b8201a' });
  R(t, 0, 64, k.w, 12, 0, { fill: '#2a2c30' });
  for (let x = 4; x < k.w; x += 7) P(t, `M${x} 64v-6`, stroke('#2a2c30', 1));
  R(t, 0, b.y + b.h - 18, k.w, 16, 0, { fill: '#b8201a' });
  R(t, 0, k.h - 14, k.w, 14, 0, { fill: '#b8201a' });
  R(t, cx - 6, b.y + 96 - 50, 12, 18, 6, { fill: '#1a2a3a' });
  return { leds: [{ x: cx, y: 40, r: 7, bezel: '#5a4a2a', color: '#fff3b0' }] };
};
MOTIFS.comic = (t, b, k) => {
  const dots = pattern('halftone' + kid(k.acc), 7, 7, (p) => { C(p, 3.5, 3.5, 1.6, { fill: k.acc, 'fill-opacity': 0.35 }); });
  P(t, k.d, { fill: dots });
  T6(t, k.w / 2 - 30, b.y + 28, 'BLAH', { size: 13, fill: '#1b1b1b', weight: 800, font: FONTS.oswald, transform: `rotate(-8 ${k.w / 2 - 30} ${b.y + 28})` });
  T6(t, k.w / 2 + 34, b.y + 22, 'blah...', { size: 11, fill: '#1b1b1b', weight: 700, font: FONTS.script, transform: `rotate(6 ${k.w / 2 + 34} ${b.y + 22})` });
  for (const [x, y, a] of [[24, b.y + 10, -30], [k.w - 26, b.y + 46, 30], [30, b.y + 52, -60]]) P(t, `M${x} ${y}l8 0M${x} ${y + 5}l6 3`, Object.assign(stroke('#1b1b1b', 1.6), { transform: `rotate(${a} ${x} ${y})` }));
};
MOTIFS.frog = (t, b, k) => {
  const r = rnd(6);
  for (let i = 0; i < 12; i++) E(t, r() * k.w, 60 + r() * (k.h - 80), 5 + r() * 8, 4 + r() * 6, { fill: '#2a5a14', 'fill-opacity': 0.5 });
  R(t, 0, k.h - 60, k.w, 60, 0, { fill: lin('belly', [[0, '#d8e8a0', 0], [1, '#d8e8a0', 0.35]]) });
  const ex = [k.w * 0.26, k.w * 0.74];
  for (const x of ex) { C(t, x, 26, 18, { fill: '#f6efc8' }); C(t, x, 26, 18, stroke('#1a3a0a', 1.6)); }
  return { leds: ex.map((x) => ({ x, y: 27, r: 7, bezel: '#1a1206', color: '#ffd23f' })) };
};
MOTIFS.dimmer = (t, b, k) => {
  for (const y of [9, k.h - 9]) { C(t, k.cx, y, 4.4, { fill: 'url(#g-chromeR)', stroke: '#000', 'stroke-opacity': 0.3 }); P(t, `M${k.cx - 3} ${y}h6`, stroke('#5a5a5a', 1)); }
  R(t, k.cx - 9, k.deck0 + 4, 18, 136, 9, { fill: '#2a2620', stroke: '#000', 'stroke-opacity': 0.4 });
  R(t, k.cx - 11, k.deck0 + 2, 22, 140, 11, stroke('#fff', 1, 0.5));
};
MOTIFS.peacock = (t, b, k) => {
  const cx = k.w / 2, cy = b.y + b.h * 0.56;
  P(t, `M${cx} 10V${k.h}`, stroke('#e9d6a0', 1.6, 0.6));
  for (let i = 0; i < 26; i++) { const y = 26 + i * 11, s = i % 2 ? 1 : -1; P(t, `M${cx} ${y}q${s * 40} 10 ${s * 90} -6`, stroke('#7fd8c0', 0.6, 0.35)); P(t, `M${cx} ${y}q${-s * 40} 10 ${-s * 90} -6`, stroke('#7fd8c0', 0.6, 0.35)); }
  E(t, cx, cy, 52, 62, { fill: '#2a9a6a', 'fill-opacity': 0.8 });
  E(t, cx, cy, 40, 50, { fill: '#c9a03a' });
  E(t, cx, cy + 4, 30, 38, { fill: '#8a5a2a' });
  E(t, cx, cy + 6, 22, 28, { fill: '#1a6ad8' });
  P(t, `M${cx} ${cy + 22}C${cx - 18} ${cy + 10} ${cx - 16} ${cy - 10} ${cx} ${cy - 6}C${cx + 16} ${cy - 10} ${cx + 18} ${cy + 10} ${cx} ${cy + 22}Z`, { fill: '#1a0f3a' });
  E(t, cx - 5, cy + 2, 4, 6, { fill: '#7fd8ff', 'fill-opacity': 0.5 });
};
MOTIFS.carousel = (t, b, k) => {
  const rh = 74, cx = k.w / 2;
  const tri = [];
  for (let i = 0; i < 10; i++) { const x0 = (k.w * i) / 10, x1 = (k.w * (i + 1)) / 10; if (i % 2) tri.push(poly([[cx, 0], [x0, rh + 2], [x1, rh + 2]])); }
  P(t, `M0 0H${k.w}V${rh + 10}H0Z`, { fill: '#f6efe2' });
  P(t, tri.join(''), { fill: k.acc });
  let sc = `M0 ${rh}`;
  for (let i = 0; i < 12; i++) { const x0 = (k.w * i) / 12, x1 = (k.w * (i + 1)) / 12; sc += `H${f(x0)}A${f((x1 - x0) / 2)} 8 0 0 0 ${f(x1)} ${rh}`; }
  P(t, sc + `V${rh - 4}H0Z`, { fill: '#e3c26a' });
  for (let i = 0; i < 12; i++) C(t, (k.w * (i + 0.5)) / 12, rh + 5, 2, { fill: '#fff6c8', stroke: '#8a6a2a', 'stroke-width': 0.4 });
  for (const x of [k.w * 0.18, k.w * 0.82]) { R(t, x - 2, rh + 10, 4, k.h, 0, { fill: 'url(#g-gold)' }); }
};
MOTIFS.lava = (t, b, k) => {
  const cx = k.w / 2;
  P(t, `M0 0H${k.w}V30H0Z`, { fill: lin('lcap2', [[0, '#c9ced6'], [0.5, '#f3f5f8'], [1, '#5d636b']], 0, 0, 1, 0) });
  const by = k.h - 120;
  P(t, `M0 ${by}H${k.w}V${k.h}H0Z`, { fill: lin('lbase', [[0, '#c9ced6'], [0.5, '#f3f5f8'], [1, '#5d636b']], 0, 0, 1, 0) });
  const blob = (x, y, r, s) => P(t, `M${x - r} ${y}C${x - r} ${y - r * s} ${x + r} ${y - r * s} ${x + r} ${y}C${x + r} ${y + r * 0.9} ${x - r} ${y + r * 1.1} ${x - r} ${y}Z`, { fill: lin('lava' + kid(k.acc), [[0, '#ffe066'], [1, k.acc]]) });
  blob(cx - 14, 64, 14, 1.2); blob(cx + 18, 104, 18, 1.4); blob(cx - 26, 150, 11, 1);
  P(t, `M0 ${by}H${k.w}`, stroke('#5d636b', 2));
  R(t, cx - 42, 36, 8, by - 60, 4, { fill: '#fff', 'fill-opacity': 0.22 });
};
MOTIFS.ecg = (t, b, k) => {
  E(t, k.w * 0.26, 34, 30, 14, { fill: '#fff', 'fill-opacity': 0.25, transform: `rotate(-30 ${k.w * 0.26} 34)` });
  const y = b.y + b.h / 2 + 2;
  P(t, `M0 ${y}H${k.w * 0.32}l6 -6l5 6h6l5 22l7 -44l6 30l5 -8h7l6 -5l6 5H${k.w}`, stroke('#fff', 2.2, 0.95));
  P(t, `M0 ${y}H${k.w}`, stroke('#fff', 0.5, 0.25));
};
MOTIFS.ship = (t, b, k) => {
  const nh = k.A.neck ?? 54, nw = k.w * 0.34;
  R(t, (k.w - nw) / 2, 0, nw, 26, 0, { fill: lin('cork', [[0, '#c99a5a'], [1, '#7a5228']]) });
  for (let i = 0; i < 10; i++) C(t, (k.w - nw) / 2 + 6 + i * 6.5, 6 + (i % 3) * 7, 1, { fill: '#5a3a18', 'fill-opacity': 0.5 });
  const wy = b.y + b.h - 22;
  P(t, wave(0, k.w, wy, 4, 40) + `V${wy + 30}H0Z`, { fill: '#1d5aa8', 'fill-opacity': 0.85 });
  P(t, wave(0, k.w, wy + 8, 3, 30, 1) + `V${wy + 30}H0Z`, { fill: '#12407a', 'fill-opacity': 0.9 });
  const cx = k.w / 2;
  P(t, `M${cx - 34} ${wy - 6}H${cx + 34}L${cx + 24} ${wy + 6}H${cx - 24}Z`, { fill: '#6a3a18' });
  P(t, `M${cx} ${wy - 6}V${wy - 68}`, stroke('#3a2410', 1.6));
  P(t, `M${cx + 2} ${wy - 64}L${cx + 30} ${wy - 14}H${cx + 2}Z`, { fill: '#f6efd8' });
  P(t, `M${cx - 2} ${wy - 56}L${cx - 26} ${wy - 14}H${cx - 2}Z`, { fill: '#e9e0c4' });
  R(t, 22, nh + 30, 8, k.h - nh - 70, 4, { fill: '#fff', 'fill-opacity': 0.2 });
};
MOTIFS.plane = (t, b, k) => {
  const x0 = 22, y0 = b.y, ww = k.w - 44, hh = b.h;
  P(t, rr(x0 - 8, y0 - 8, ww + 16, hh + 16, (ww + 16) * 0.4), { fill: '#cfc9bc' });
  const win = rr(x0, y0, ww, hh, ww * 0.42);
  P(t, win, { fill: lin('jsky', [[0, '#2a6fdb'], [0.7, '#9fd0ff'], [1, '#e8f4ff']]) });
  const vg = clipTo(t, win);
  for (const [x, y, r] of [[x0 + 30, y0 + 90, 26], [x0 + 70, y0 + 98, 22], [x0 + 120, y0 + 92, 30], [x0 + 150, y0 + 104, 20]]) E(vg, x, y, r, r * 0.45, { fill: '#fff', 'fill-opacity': 0.9 });
  P(vg, `M${x0 - 10} ${y0 + 54}L${x0 + ww * 0.85} ${y0 + 74}L${x0 + ww * 0.85} ${y0 + 80}L${x0 - 10} ${y0 + 76}Z`, { fill: '#c9ced6' });
  P(vg, `M${x0 + ww * 0.7} ${y0 + 72}l14 -16h6l-6 18Z`, { fill: '#2a6fdb' });
  P(t, win, stroke('#8a8478', 2));
};
MOTIFS.clock = (t, b, k) => {
  const cx = k.w / 2, cy = 58, r = 40;
  C(t, cx, cy, r + 5, { fill: 'url(#g-gold)' });
  C(t, cx, cy, r, { fill: rad('cface', [[0, '#fffaf0'], [1, '#e8dcc0']]) });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; P(t, `M${f(cx + Math.sin(a) * (r - 3))} ${f(cy - Math.cos(a) * (r - 3))}L${f(cx + Math.sin(a) * (r - (i % 3 ? 7 : 11)))} ${f(cy - Math.cos(a) * (r - (i % 3 ? 7 : 11)))}`, stroke('#2a1a08', i % 3 ? 1 : 2)); }
  P(t, `M${cx} ${cy}L${cx + 14} ${cy - 18}M${cx} ${cy}L${cx - 22} ${cy + 6}`, stroke('#2a1a08', 2));
  C(t, cx, cy, 2.6, { fill: '#2a1a08' });
  P(t, `M${cx} ${cy + r + 5}V${cy + r + 14}`, stroke('#c9a03a', 2));
  C(t, cx, cy + r + 19, 6, { fill: 'url(#g-gold)' });
  P(t, `M0 120H${k.w}`, stroke('#000', 2, 0.4));
};
MOTIFS.bulb = (t, b, k) => {
  for (const [x, y] of [[k.w / 4, 0], [k.w / 2, 14], [(3 * k.w) / 4, 28]]) P(t, `M${f(x)} ${y}V${y + 4}`, stroke('#000', 1, 0));
  const steps = [0, 14, 28, 42];
  steps.forEach((y, i) => { P(t, `M${f((k.w * i) / 4)} ${y + 1}H${f((k.w * (i + 1)) / 4)}`, stroke('#fff', 2, 0.25)); P(t, `M${f((k.w * i) / 4)} ${y + 4}H${f((k.w * (i + 1)) / 4)}`, stroke('#000', 4, 0.15)); });
  const bx = k.w * 0.62, by = b.y + 58;
  P(t, `M${bx} 28V${by - 16}`, stroke('#1a1a1a', 1.2));
  C(t, bx, by, 34, { fill: rad('bglow', [[0, '#ffe8a0', 0.7], [1, '#ffe8a0', 0]]) });
  R(t, bx - 5, by - 18, 10, 8, 2, { fill: '#8a8f96' });
  P(t, `M${bx - 5} ${by - 10}C${bx - 14} ${by - 4} ${bx - 12} ${by + 12} ${bx} ${by + 12}C${bx + 12} ${by + 12} ${bx + 14} ${by - 4} ${bx + 5} ${by - 10}Z`, { fill: '#fff6d0', 'fill-opacity': 0.95 });
  P(t, `M${bx - 3} ${by - 4}q3 6 6 0`, stroke('#ff9a2a', 1));
  P(t, `M14 ${b.y + 60}l10 6l-4 10l8 8`, stroke('#000', 0.8, 0.35));
};
MOTIFS.kangaroo = (t, b, k) => {
  const cx = k.w / 2, hy = b.y + b.h - 8;
  R(t, 0, 0, k.w, hy, 0, { fill: lin('osky', [[0, '#ffcf7a'], [1, '#ff7a3a']]) });
  C(t, cx + 20, hy - 6, 30, { fill: '#ffe8b0', 'fill-opacity': 0.85 });
  R(t, 0, hy, k.w, 4, 0, { fill: '#5a2a0a' });
  P(t, `M${cx - 60} ${hy - 4}Q${cx - 24} ${b.y - 4} ${cx + 30} ${hy - 30}`, Object.assign(stroke('#5a2a0a', 1.4, 0.7), { 'stroke-dasharray': '2 4' }));
  const kg = G(t, { transform: `translate(${cx + 34},${hy - 46}) scale(1.05)` });
  P(kg, 'M-46 24Q-24 18 -12 8C-14 -6 -2 -16 10 -14C14 -20 16 -26 20 -30L18 -39L23 -32L27 -40L27 -30C33 -28 35 -24 29 -22C23 -20 21 -16 19 -12C23 -8 23 -2 17 2L25 4L23 6L15 5C17 10 15 16 11 18L27 24L27 27L6 26C0 24 -6 20 -10 16Q-24 22 -46 26Z', { fill: '#3a1a08' });
  P(t, `M${cx - 50} ${k.h - 64}Q${cx} ${k.h - 10} ${cx + 50} ${k.h - 64}`, Object.assign(stroke('#5a2a0a', 1.2, 0.6), { 'stroke-dasharray': '4 3' }));
};
MOTIFS.octopus = (t, b, k) => {
  const cy = b.y + b.h / 2 + 4, ex = [k.w / 2 - 34, k.w / 2 + 34];
  for (const [x, y, r] of [[40, 40, 6], [k.w - 50, 50, 8], [k.w / 2, 20, 5], [60, 80, 4], [k.w - 40, 90, 5]]) C(t, x, y, r, { fill: '#fff', 'fill-opacity': 0.14 });
  for (const x of ex) { E(t, x, cy, 18, 15, { fill: '#fff6e6' }); E(t, x, cy, 18, 15, stroke('#5a0a24', 1.4)); }
  P(t, `M${k.w / 2 - 10} ${cy + 22}q10 6 20 0`, stroke('#5a0a24', 1.6));
  for (let i = 0; i < 8; i++) { const x = (k.w * (i + 0.5)) / 8; for (let j = 0; j < 3; j++) C(t, x, k.h - 26 - j * 9, 2.6 - j * 0.5, { fill: '#ffd0dc', 'fill-opacity': 0.7 }); }
  return { leds: ex.map((x) => ({ x, y: cy, r: 6, bezel: '#1a0a10', color: '#ffe066' })) };
};
MOTIFS.glasses = (t, b, k) => {
  const r = k.h / 2;
  C(t, r, r, r, { fill: '#ff3d5a', 'fill-opacity': 0.22 });
  C(t, k.w - r, r, r, { fill: '#2ae0ff', 'fill-opacity': 0.22 });
  for (const x of [r, k.w - r]) C(t, x, r, r - 8, stroke('#fff', 1, 0.15));
};
MOTIFS.envelope = (t, b, k) => {
  const ty = b.y + b.h * 0.72, cx = k.w / 2;
  P(t, `M0 0L${cx} ${ty}L${k.w} 0Z`, { fill: shade(k.col, -0.08) });
  P(t, `M0 0L${cx} ${ty}L${k.w} 0`, stroke(shade(k.col, -0.35), 1));
  P(t, `M0 ${k.h}L${cx} ${ty + 30}L${k.w} ${k.h}`, stroke(shade(k.col, -0.2), 0.8, 0.6));
  const sx = k.w - 48, sy = 10;
  P(t, SHAPES.stamp(36, 42).d, { fill: '#f6efe0', transform: `translate(${sx},${sy})` });
  R(t, sx + 4, sy + 4, 28, 34, 0, { fill: '#2a6a8a' });
  P(t, `M${sx + 8} ${sy + 26}c4 -8 10 -10 16 -6l6 -6l-2 8c2 4 -2 8 -8 8h-8z`, { fill: '#f6efe0' });
  for (let i = 0; i < 3; i++) P(t, wave(sx - 46, sx + 6, sy + 12 + i * 6, 2, 14), stroke('#3a2a1a', 0.8, 0.5));
  C(t, cx, ty, 13, { fill: '#a8202a' });
  return { leds: [{ x: cx, y: ty, r: 6, bezel: '#6a0a12', color: '#ff3b30' }] };
};
MOTIFS.strata = (t, b, k) => {
  const cols = ['#e8a46a', '#c4683a', '#d88a52', '#a8502a', '#e0b07a', '#b85a32', '#8a3a1e'];
  for (let i = 0; i < cols.length; i++) { const y = i * 18; P(t, wave(0, k.w, y, 2.5, 60, i) + `V${y + 22}H0Z`, { fill: cols[i], 'fill-opacity': 0.8 }); }
  C(t, k.w * 0.8, b.y + 26, 12, { fill: '#fff1d6', 'fill-opacity': 0.85 });
  for (let i = 0; i < 3; i++) P(t, `M${k.w * 0.2 + i * 14} ${b.y + 40 + i * 10}c-8 -6 -14 6 -22 0`, stroke('#2a1206', 1, 0.5 - i * 0.12));
};
MOTIFS.pingpong = (t, b, k) => {
  const R0 = k.w / 2, hw = 30, yi = R0 + Math.sqrt(R0 * R0 - hw * hw);
  const pm = pattern('pimple', 8, 8, (p) => { C(p, 4, 4, 1.6, { fill: '#000', 'fill-opacity': 0.18 }); });
  C(t, R0, R0, R0, { fill: pm });
  R(t, R0 - hw, f(yi - 6), hw * 2, k.h, 0, { fill: lin('handle', [[0, '#8a5a2a'], [0.5, '#d8a86a'], [1, '#7a4a1e']], 0, 0, 1, 0) });
  for (let i = 0; i < 5; i++) P(t, `M${R0 - hw + 6 + i * 12} ${f(yi)}v${k.h}`, stroke('#5a3a18', 0.6, 0.5));
  C(t, R0, R0, R0 - 6, stroke('#000', 1.4, 0.25));
  P(t, `M${R0 - 50} ${b.y + 26}Q${R0} ${b.y - 4} ${R0 + 40} ${b.y + 20}`, Object.assign(stroke('#fff', 1.2, 0.6), { 'stroke-dasharray': '3 4' }));
  C(t, R0 + 44, b.y + 22, 7, { fill: 'url(#g-whiteKnob)' });
};
MOTIFS.tunnel = (t, b, k) => {
  const c = k.w / 2;
  for (let i = 0; i < 12; i++) { const s = 1 - i / 12, x = c + (1 - s) * 18, y = c - (1 - s) * 30; E(t, x, y, c * s, c * s * 0.92, stroke(i % 2 ? '#33e6ff' : k.acc, 1.2, 0.18 + i * 0.03)); }
  const r = rnd(12);
  for (let i = 0; i < 30; i++) C(t, r() * k.w, r() * k.h, 0.6 + r(), { fill: '#fff', 'fill-opacity': 0.5 });
  C(t, c + 18, c - 30, 10, { fill: rad('whcore', [[0, '#fff'], [0.4, k.acc], [1, k.acc, 0]]) });
};
MOTIFS.vhs = (t, b, k) => {
  R(t, 14, b.y, k.w - 28, 30, 2, { fill: '#f2ede2' });
  ['#ff3b30', '#ff9a2a', '#ffd23f', '#3ddc84', '#2a9dff'].forEach((c, i) => R(t, 14, b.y + 3 + i * 4, 40, 3, 0, { fill: c }));
  T6(t, k.w - 24, b.y + 15, 'T-120', { size: 11, fill: '#141416', weight: 800, anchor: 'end', font: FONTS.inter });
  R(t, k.w / 2 - 60, b.y + 40, 120, 44, 6, { fill: '#050506', stroke: '#3a3a3a' });
  for (const x of [k.w / 2 - 34, k.w / 2 + 34]) { C(t, x, b.y + 62, 16, { fill: '#2a1a10' }); C(t, x, b.y + 62, 7, { fill: '#e8e8e8' }); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; R(t, x + Math.cos(a) * 4 - 1, b.y + 62 + Math.sin(a) * 4 - 1, 2, 2, 0, { fill: '#141416' }); } }
  P(t, `M${k.w / 2 - 10} ${b.y + 62}l8 -6v12zM${k.w / 2 + 2} ${b.y + 62}l8 -6v12z`, { fill: '#3dffb0' });
};
MOTIFS.postcard = (t, b, k) => {
  const x0 = 14, y0 = 14, ww = k.w - 28, hh = b.y + b.h - 14;
  const ph = rr(x0, y0, ww, hh, 3);
  P(t, ph, { fill: lin('pcsky', [[0, '#ff7a59'], [0.55, '#ffd36b'], [0.56, '#2a8fb8'], [1, '#1a5a7a']]) });
  const pg = clipTo(t, ph);
  C(pg, x0 + ww * 0.6, y0 + hh * 0.56, 22, { fill: '#fff1b0', 'fill-opacity': 0.85 });
  P(pg, `M${x0} ${y0 + hh * 0.56}H${x0 + ww}V${y0 + hh}H${x0}Z`, { fill: lin('pcsea', [[0, '#2a8fb8'], [1, '#14465a']]) });
  P(pg, `M${x0 + 30} ${y0 + hh}C${x0 + 34} ${y0 + hh - 30} ${x0 + 30} ${y0 + hh - 50} ${x0 + 40} ${y0 + hh - 70}`, stroke('#3a2410', 3));
  for (const a of [-60, -20, 20, 60, 100]) P(pg, `M${x0 + 40} ${y0 + hh - 70}q${f(Math.cos((a * Math.PI) / 180) * 14)} -10 ${f(Math.cos((a * Math.PI) / 180) * 26)} ${f(4 + Math.abs(a) / 10)}`, stroke('#1a3a10', 3));
  P(t, ph, stroke('#fff', 3));
  C(t, x0 + ww - 22, y0 + hh - 6, 16, Object.assign(stroke('#3a2a1a', 1, 0.5), { 'stroke-dasharray': '3 2' }));
};
MOTIFS.greenhouse = (t, b, k) => {
  const rh = k.A.roof ?? 64, cx = k.w / 2;
  const dark = '#1d2a24';
  for (let i = 1; i < 6; i++) P(t, `M${cx} 0L${f((k.w * i) / 6)} ${rh}`, stroke(dark, 2));
  P(t, `M0 ${rh}H${k.w}`, stroke(dark, 3));
  for (let i = 1; i < 5; i++) P(t, `M${f((k.w * i) / 5)} ${rh}V${b.y + b.h}`, stroke(dark, 2));
  P(t, `M0 ${b.y + b.h}H${k.w}`, stroke(dark, 3));
  const base = b.y + b.h - 4;
  for (const [x, s] of [[k.w * 0.22, 1], [k.w * 0.5, 1.25], [k.w * 0.78, 0.9]]) {
    for (const a of [-50, -25, 0, 25, 50]) { const an = (a * Math.PI) / 180, l = 26 * s; E(t, x + Math.sin(an) * l * 0.55, base - 12 - Math.cos(an) * l * 0.55, 4 * s, l * 0.5, { fill: a % 50 ? '#3dbf6a' : '#2a9a52', transform: `rotate(${a} ${f(x + Math.sin(an) * l * 0.55)} ${f(base - 12 - Math.cos(an) * l * 0.55)})` }); }
    P(t, `M${f(x - 10 * s)} ${f(base - 12)}H${f(x + 10 * s)}L${f(x + 7 * s)} ${base}H${f(x - 7 * s)}Z`, { fill: '#c4683a' });
  }
  P(t, `M${cx} ${rh - 10}V${rh + 10}`, stroke(dark, 1));
  for (let i = 0; i < 5; i++) P(t, `M${cx} ${rh + 10 + i * 6}q${i % 2 ? 8 : -8} 2 ${i % 2 ? 12 : -12} 8`, stroke('#3dbf6a', 2));
};
MOTIFS.sub = (t, b, k) => {
  const tH = 44, r0 = (k.h - tH) / 2;
  P(t, `M0 ${tH + r0}H${k.w}`, stroke('#000', 1, 0.3));
  for (let x = r0; x < k.w - r0; x += 14) { C(t, x, tH + 6, 1.1, { fill: '#000', 'fill-opacity': 0.35 }); C(t, x, k.h - 6, 1.1, { fill: '#000', 'fill-opacity': 0.35 }); }
  P(t, `M${k.w * 0.48} 0V-20`, stroke('#000', 1));
  for (const x of [k.w * 0.13, k.w * 0.21, k.w * 0.79, k.w * 0.87]) { C(t, x, tH + 18, 7, { fill: 'url(#g-chrome)' }); C(t, x, tH + 18, 5, { fill: rad('subport', [[0, '#5ae0ff'], [1, '#0a2238']], 0.4, 0.35, 0.7) }); }
  for (const [x, y, r] of [[k.w * 0.7, 12, 3], [k.w * 0.74, 22, 2], [k.w * 0.3, 18, 2.4]]) C(t, x, y, r, stroke('#bfefff', 0.8, 0.6));
  return { leds: [{ x: k.w * 0.49, y: 20, r: 4.5, bezel: '#0a1a28', color: '#5ae0ff' }] };
};
MOTIFS.spring = (t, b, k) => {
  const y = b.y + b.h / 2 - 8, x0 = 26, x1 = k.w - 26;
  R(t, 14, y - 28, k.w - 28, 56, 8, { fill: '#000', 'fill-opacity': 0.35 });
  let d = '';
  const n = 14;
  for (let i = 0; i <= n * 8; i++) { const tt = i / (n * 8), x = x0 + (x1 - x0) * tt + Math.cos(tt * n * Math.PI * 2) * 4, yy = y + Math.sin(tt * n * Math.PI * 2) * 14; d += (i ? 'L' : 'M') + f(x) + ' ' + f(yy); }
  P(t, d, stroke('#e8ecf0', 1.8));
  P(t, d, Object.assign(stroke(k.acc, 0.8, 0.6), { transform: 'translate(0.6,0.6)' }));
  for (const x of [x0 - 4, x1 + 4]) R(t, x - 3, y - 18, 6, 36, 2, { fill: 'url(#g-chrome)' });
  T6(t, k.w / 2, y + 40, 'LONG TANK', { size: 5, fill: '#f0f2f5', weight: 800, ls: 2, font: FONTS.inter, opacity: 0.6 });
};
MOTIFS.snowglobe = (t, b, k) => {
  const S = k.shape, R0 = k.A.globeR ?? k.w * 0.43, cx = k.w / 2;
  C(t, cx, R0, R0, { fill: lin('sgsky', [[0, '#14306a'], [1, '#5a8ad8']]) });
  const r = rnd(21);
  for (let i = 0; i < 40; i++) C(t, cx + (r() - 0.5) * R0 * 1.6, R0 + (r() - 0.6) * R0 * 1.6, 0.8 + r() * 1.4, { fill: '#fff', 'fill-opacity': 0.85 });
  E(t, cx, S.yi - 4, R0 * 0.8, 16, { fill: '#f4f8ff' });
  P(t, `M${cx - 26} ${S.yi - 14}V${S.yi - 34}L${cx - 12} ${S.yi - 48}L${cx + 2} ${S.yi - 34}V${S.yi - 14}Z`, { fill: '#a83a2a' });
  P(t, `M${cx - 30} ${S.yi - 33}L${cx - 12} ${S.yi - 52}L${cx + 6} ${S.yi - 33}`, stroke('#fff', 3));
  for (const [x, s] of [[cx + 30, 1], [cx + 50, 0.7]]) P(t, `M${x} ${S.yi - 14 - 50 * s}L${x + 14 * s} ${S.yi - 14}H${x - 14 * s}Z`, { fill: '#1a5a3a' });
  C(t, cx, R0, R0 - 2, stroke('#fff', 1.6, 0.4));
  E(t, cx - R0 * 0.45, R0 * 0.55, 14, 26, { fill: '#fff', 'fill-opacity': 0.18, transform: `rotate(30 ${cx - R0 * 0.45} ${R0 * 0.55})` });
  P(t, `M0 ${f(S.yi)}H${k.w}`, stroke('#000', 3, 0.35));
  return { leds: [{ x: cx - 12, y: S.yi - 26, r: 3.4, bezel: '#5a1a10', color: '#ffe6a0' }] };
};
MOTIFS.cloud = (t, b, k) => {
  C(t, k.w * 0.7, k.h * 0.18, 40, { fill: rad('csun', [[0, '#fff6c8', 0.9], [1, '#fff6c8', 0]]) });
  for (const [x, y, rx] of [[0.3, 0.2, 40], [0.52, 0.12, 46], [0.74, 0.22, 36], [0.18, 0.42, 30], [0.84, 0.44, 30]]) E(t, k.w * x, k.h * y, rx, rx * 0.6, { fill: '#fff', 'fill-opacity': 0.35 });
  P(t, `M20 ${k.h * 0.92}Q${k.w / 2} ${k.h * 0.98} ${k.w - 20} ${k.h * 0.92}`, stroke('#5a8ab8', 6, 0.15));
};
MOTIFS.owl = (t, b, k) => {
  const cx = k.w / 2, ey = b.y + 34;
  P(t, `M${cx} ${ey + 52}C${cx - 90} ${ey + 40} ${cx - 92} ${ey - 40} ${cx} ${ey - 22}C${cx + 92} ${ey - 40} ${cx + 90} ${ey + 40} ${cx} ${ey + 52}Z`, { fill: '#e8d2a8', 'fill-opacity': 0.55 });
  for (const s of [-1, 1]) { C(t, cx + s * 34, ey, 24, { fill: '#2a1a0a' }); C(t, cx + s * 34, ey, 19, { fill: rad('oeye', [[0, '#fff36a'], [1, '#e89a12']]) }); }
  P(t, `M${cx - 7} ${ey + 14}L${cx + 7} ${ey + 14}L${cx} ${ey + 30}Z`, { fill: '#e8892a', stroke: '#5a2a0a', 'stroke-width': 0.8 });
  for (const s of [-1, 1]) P(t, `M${cx + s * 4} 4L${cx + s * 46} 28`, stroke(shade(k.col, -0.4), 4, 0.6));
  let sc = '';
  for (let y = b.y + b.h + 50; y < k.h - 20; y += 12) for (let x = 20 + ((y / 12) % 2) * 8; x < k.w - 20; x += 16) sc += `M${x} ${y}q8 8 16 0`;
  P(t, sc, stroke(shade(k.col, 0.3), 1, 0.25));
  return { leds: [-1, 1].map((s) => ({ x: cx + s * 34, y: ey, r: 7, bezel: '#0a0604', color: '#ffcf3a' })) };
};
MOTIFS.valves = (t, b, k) => {
  const cx = k.w / 2, y = b.y + b.h / 2;
  P(t, `M40 ${y + 16}H${k.w - 40}`, stroke(shade(k.col, -0.3), 8, 0.6));
  P(t, `M40 ${y + 16}C10 ${y + 16} 10 ${y - 18} 40 ${y - 18}H${k.w - 40}C${k.w - 10} ${y - 18} ${k.w - 10} ${y + 16} ${k.w - 40} ${y + 16}`, stroke(shade(k.col, -0.3), 4, 0.5));
  for (const x of [cx - 36, cx, cx + 36]) { R(t, x - 8, y - 20, 16, 36, 3, { fill: lin('valve', [[0, '#8a6a1a'], [0.5, '#fff3c4'], [1, '#6a4a10']], 0, 0, 1, 0) }); C(t, x, y - 22, 10, { fill: 'url(#g-chromeR)' }); C(t, x, y - 22, 7, { fill: 'url(#g-cream)' }); }
};
MOTIFS.pipes = (t, b, k) => {
  const n = 9, x0 = 18, ww = k.w - 30 - 36, y1 = b.y + b.h - 4;
  for (let i = 0; i < n; i++) {
    const x = x0 + (ww * i) / (n - 1), hh = 30 + Math.sin((i / (n - 1)) * Math.PI) * 40;
    R(t, x - 6, y1 - hh, 12, hh, 6, { fill: lin('pipe', [[0, '#8a6a1a'], [0.45, '#fff0b0'], [1, '#6a4a10']], 0, 0, 1, 0) });
    P(t, `M${f(x - 4)} ${f(y1 - 14)}h8l-4 -5Z`, { fill: '#2a1a08' });
  }
  P(t, `M10 ${y1 + 3}H${k.w - 40}`, stroke('#e3c26a', 2));
};
MOTIFS.gingham = (t, b, k) => {
  const gp = pattern('gingham2', 16, 16, (p) => { R(p, 0, 0, 8, 16, 0, { fill: '#d22a3a', 'fill-opacity': 0.22 }); R(p, 0, 0, 16, 8, 0, { fill: '#d22a3a', 'fill-opacity': 0.22 }); });
  P(t, k.d, { fill: gp });
  const y = b.y + b.h - 2, x0 = k.w / 2 - 42;
  let d = `M${x0} ${y}`;
  for (let i = 0; i < 6; i++) d += `V${i % 2 ? y : y - 18}h14`;
  P(t, d, stroke('#2a1010', 5));
  P(t, d, stroke('#ffffff', 2.4));
};
MOTIFS.moon = (t, b, k) => {
  const cx = k.w / 2 + 6, cy = b.y + b.h / 2;
  P(t, `M${cx - 6} ${cy - 40}A40 40 0 1 0 ${cx + 30} ${cy + 22}A32 32 0 1 1 ${cx - 6} ${cy - 40}Z`, { fill: lin('moonf', [[0, '#fffbe8'], [1, '#ffd8a0']]) });
  for (const [x, y, r] of [[k.w * 0.24, b.y + 16, 6], [k.w * 0.74, b.y + 10, 4], [k.w * 0.8, b.y + 70, 5], [k.w * 0.18, b.y + 76, 3.5]]) P(t, starP(x, y, r, r * 0.42), { fill: '#fff', 'fill-opacity': 0.9 });
  E(t, k.w * 0.3, b.y + b.h - 6, 36, 9, { fill: '#fff', 'fill-opacity': 0.5 });
};
MOTIFS.laser = (t, b, k) => {
  const cx = k.w / 2, cy = b.y + b.h / 2;
  for (let i = 0; i <= 10; i++) P(t, `M${cx} ${cy}L${f((k.w * i) / 10)} ${k.h}`, stroke(k.acc, 0.6, 0.18));
  for (const yy of [cy + 60, cy + 90, cy + 140, cy + 210]) P(t, `M0 ${yy}H${k.w}`, stroke(k.acc, 0.6, 0.15));
  C(t, cx, cy, 30, stroke(k.acc, 1.6, 0.9));
  C(t, cx, cy, 16, stroke(k.acc, 1, 0.7));
  P(t, `M${cx - 40} ${cy}H${cx - 8}M${cx + 8} ${cy}H${cx + 40}M${cx} ${cy - 40}V${cy - 8}M${cx} ${cy + 8}V${cy + 40}`, stroke(k.acc, 1.4));
  P(t, `M0 ${b.y + 8}L${cx - 4} ${cy - 2}M${k.w} ${b.y + 70}L${cx + 4} ${cy + 2}`, stroke('#ff3b6b', 1.6, 0.8));
  C(t, cx, cy, 2.4, { fill: '#ff3b6b' });
};
MOTIFS.snake = (t, b, k) => {
  const c = k.w / 2, r = c - 15;
  C(t, c, c, r, stroke('#2a5a1a', 13));
  C(t, c, c, r, Object.assign(stroke('#7ad86a', 9), { 'stroke-dasharray': '5 3' }));
  C(t, c, c, r, stroke('#bff0a8', 1, 0.5));
  const hx = c + 18, hy = 15;
  P(t, `M${hx - 12} ${hy - 9}Q${hx + 14} ${hy - 12} ${hx + 18} ${hy}Q${hx + 14} ${hy + 12} ${hx - 12} ${hy + 9}Z`, { fill: '#3a7a2a', stroke: '#1a3a0a', 'stroke-width': 1 });
  C(t, hx + 6, hy - 3, 1.8, { fill: '#ffe066' });
  P(t, `M${c - 6} ${hy + 4}l-10 0l-6 -4`, stroke('#2a5a1a', 4));
};
MOTIFS.groundhog = (t, b, k) => {
  const cx = k.w / 2, hy = b.y + b.h - 8;
  for (let x = 30; x < k.w - 30; x += 9) P(t, `M${x} ${f(k.h * 0.06 + Math.abs(x - cx) * 0.18)}l3 -7l2 8`, stroke('#3a5a1a', 1.2, 0.6));
  E(t, cx, hy, 44, 12, { fill: '#2a1a0a' });
  P(t, `M${cx - 26} ${hy}C${cx - 28} ${hy - 30} ${cx - 18} ${hy - 50} ${cx} ${hy - 50}C${cx + 18} ${hy - 50} ${cx + 28} ${hy - 30} ${cx + 26} ${hy}Z`, { fill: '#8a5a2a' });
  for (const s of [-1, 1]) C(t, cx + s * 16, hy - 46, 5, { fill: '#6a3a18' });
  for (const s of [-1, 1]) C(t, cx + s * 9, hy - 32, 2.6, { fill: '#140a04' });
  E(t, cx, hy - 22, 6, 4, { fill: '#3a1a08' });
  R(t, cx - 3, hy - 18, 6, 6, 1, { fill: '#fff6e0' });
  E(t, cx, hy + 2, 30, 6, { fill: '#2a1a0a' });
};
MOTIFS.camera = (t, b, k) => {
  P(t, `M0 0H${k.w}V40H0Z`, { fill: lin('ctop', [[0, '#f3f5f8'], [0.5, '#c9ced6'], [1, '#8a9099']]) });
  P(t, `M0 40H${k.w}`, stroke('#000', 1, 0.5));
  R(t, k.w * 0.4, 6, k.w * 0.2, 12, 2, { fill: '#2a2c30' });
  const cx = k.w / 2, cy = b.y + b.h / 2 + 12;
  C(t, cx, cy, 40, { fill: 'url(#g-chrome)' });
  C(t, cx, cy, 33, { fill: '#121314' });
  C(t, cx, cy, 24, { fill: rad('lens', [[0, '#5a6ad8'], [0.5, '#141a3a'], [1, '#050508']], 0.4, 0.35, 0.7) });
  E(t, cx - 8, cy - 9, 8, 5, { fill: '#fff', 'fill-opacity': 0.4 });
  C(t, cx, cy, 36.5, Object.assign(stroke('#d8dde4', 0.8, 0.7), { 'stroke-dasharray': '1 2' }));
  return { leds: [{ x: 30, y: 54, r: 3.6, bezel: '#2a0a0a', color: '#ff3b30' }] };
};
MOTIFS.fork = (t, b, k) => {
  const yb = k.A.prong ?? 96;
  for (const x of [k.w / 2 - k.w * 0.12 - 26, k.w / 2 + k.w * 0.12 + 8]) R(t, x, 6, 4, yb - 20, 2, { fill: '#fff', 'fill-opacity': 0.55 });
  for (let i = 0; i < 3; i++) { const x = k.w / 2 - k.w * 0.12 - 40 - i * 7; P(t, `M${x} ${30 + i * 4}q-4 18 0 36`, stroke('#16181c', 1, 0.4 - i * 0.1)); P(t, `M${k.w - x} ${30 + i * 4}q4 18 0 36`, stroke('#16181c', 1, 0.4 - i * 0.1)); }
  const px = k.w / 2 - k.w * 0.12 - 17;
  T6(t, px, yb / 2, 'A = 440 Hz', { size: 6, fill: '#16181c', weight: 800, ls: 1.4, font: FONTS.inter, opacity: 0.7, transform: `rotate(-90 ${f(px)} ${f(yb / 2)})` });
};
MOTIFS.sign = (t, b, k) => {
  const sh = 74;
  P(t, `M0 ${sh}H${k.w}V${k.h}H0Z`, { fill: lin('post', [[0, '#3a2410'], [1, '#1a0f06']]) });
  P(t, `M0 ${sh + 14}H${k.w}V${k.h}H0Z`, { fill: lin('base', [[0, '#3f7a3a'], [1, '#1f4a1f']]) });
  for (let x = 6; x < k.w; x += 7) P(t, `M${x} ${sh + 15}l2 6l2 -6`, stroke('#7ac86a', 1, 0.6));
  R(t, 8, 6, k.w - 16, sh - 12, 2, stroke('#f2e6c4', 1, 0.5));
  T6(t, 18, sh / 2, 'A', { size: 12, fill: '#f2e6c4', weight: 800, font: FONTS.oswald });
  T6(t, k.w - 18, sh / 2, 'B', { size: 12, fill: '#f2e6c4', weight: 800, font: FONTS.oswald });
  for (const x of [34, k.w - 34]) C(t, x, sh / 2, 2.4, { fill: 'url(#g-chromeR)' });
};
MOTIFS.mail = (t, b, k) => {
  const cx = k.cx;
  P(t, `M0 ${cx}H${2 * cx}`, stroke('#000', 6, 0.15));
  R(t, cx - 40, b.y + 34, 80, 14, 3, { fill: 'url(#g-chrome)' });
  R(t, cx - 34, b.y + 38, 68, 6, 2, { fill: '#0a0a0a' });
  T6(t, cx, b.y + 24, 'LETTERS', { size: 7, fill: '#fff2e8', weight: 800, ls: 3, font: FONTS.inter });
  T6(t, cx, b.y + 62, 'NEXT COLLECTION 5:30', { size: 4.6, fill: '#fff2e8', weight: 700, ls: 1, font: FONTS.inter, opacity: 0.75 });
  for (const y of [b.y + 6, b.y + b.h - 4]) P(t, `M8 ${y}H${2 * cx - 8}`, stroke('#000', 1.4, 0.35));
};
MOTIFS.crt = (t, b, k) => {
  const x0 = 18, y0 = b.y, ww = k.w - 36, hh = b.h - 10;
  R(t, x0 - 6, y0 - 6, ww + 12, hh + 12, 16, { fill: '#121316' });
  const scr = rr(x0, y0, ww, hh, 14);
  P(t, scr, { fill: rad('crtg', [[0, '#14402a'], [1, '#030a06']], 0.5, 0.5, 0.7) });
  const sg = clipTo(t, scr), r = rnd(31);
  let px = '';
  for (let i = 0; i < 60; i++) { const s = 4 + Math.floor(r() * 3) * 2, x = x0 + r() * ww, y = y0 + r() * hh; if (r() > 0.4) px += `M${f(x)} ${f(y)}h${s}v${s}h-${s}Z`; }
  P(sg, px, { fill: k.acc, 'fill-opacity': 0.55 });
  for (let i = 0; i < 4; i++) R(sg, x0, y0 + 10 + i * 22 + r() * 6, ww, 2 + r() * 4, 0, { fill: '#000', 'fill-opacity': 0.6 });
  for (let y = y0; y < y0 + hh; y += 3) R(sg, x0, y, ww, 1, 0, { fill: '#000', 'fill-opacity': 0.25 });
  T6(sg, x0 + 10, y0 + 10, 'NO SIGNAL', { size: 7, fill: k.acc, font: FONTS.mono, anchor: 'start', weight: 400 });
  P(t, scr, { fill: 'url(#g-glass)' });
};
MOTIFS.soda = (t, b, k) => {
  E(t, k.w / 2, 12, k.w / 2 - 4, 9, { fill: lin('canTop', [[0, '#f3f5f8'], [1, '#8a9099']]) });
  P(t, rr(k.w / 2 - 16, 4, 32, 10, 5), { fill: '#c9ced6', stroke: '#6d737a', 'stroke-width': 0.8 });
  E(t, k.w / 2 - 6, 9, 5, 2.6, { fill: '#6d737a' });
  const y0 = 34, y1 = k.h - 26;
  R(t, 0, y0, k.w, y1 - y0, 0, { fill: k.col });
  R(t, 0, y0, k.w, y1 - y0, 0, { fill: lin('canR', [[0, '#000', 0.25], [0.3, '#fff', 0.25], [0.45, '#fff', 0], [1, '#000', 0.35]], 0, 0, 1, 0) });
  P(t, `M0 ${b.y + b.h - 20}C${k.w * 0.3} ${b.y + b.h - 50} ${k.w * 0.6} ${b.y + b.h} ${k.w} ${b.y + b.h - 34}V${b.y + b.h - 24}C${k.w * 0.6} ${b.y + b.h + 10} ${k.w * 0.3} ${b.y + b.h - 40} 0 ${b.y + b.h - 10}Z`, { fill: '#fff' });
  const r = rnd(41);
  for (let i = 0; i < 16; i++) C(t, 12 + r() * (k.w - 24), y0 + 10 + r() * (b.y + b.h - y0 - 40), 1.5 + r() * 3, stroke('#fff', 0.9, 0.7));
};
MOTIFS.mosh = (t, b, k) => {
  const r = rnd(51);
  const cols = ['#ff3fd4', '#33e6ff', '#3dff8a', '#ffe066'];
  for (let i = 0; i < 26; i++) R(t, r() * k.w - 10, r() * (b.y + b.h + 40), 8 + r() * 46, 2 + r() * 8, 0, { fill: cols[i % 4], 'fill-opacity': 0.25 + r() * 0.35 });
  for (let i = 0; i < 8; i++) { const y = r() * k.h; R(t, 0, y, k.w, 1, 0, { fill: '#fff', 'fill-opacity': 0.2 }); }
  let px = '';
  for (let i = 0; i < 40; i++) { const x = r() * k.w, y = b.y + r() * b.h; px += `M${f(x)} ${f(y)}h3v3h-3Z`; }
  P(t, px, { fill: '#fff', 'fill-opacity': 0.5 });
};
MOTIFS.belljar = (t, b, k) => {
  const yb = k.shape.yb, cx = k.w / 2;
  P(t, `M0 0H${k.w}V${yb}H0Z`, { fill: lin('jarglass', [[0, '#1d3a3a'], [1, '#0a1a1c']]) });
  P(t, `M0 0H${k.w}V${yb}H0Z`, { fill: lin('jarhl', [[0, '#fff', 0.2], [0.12, '#fff', 0.04], [0.3, '#fff', 0], [0.85, '#fff', 0], [1, '#fff', 0.12]], 0, 0, 1, 0) });
  const py = b.y + b.h - 4;
  P(t, `M${cx - 22} ${py - 22}H${cx + 22}L${cx + 16} ${py}H${cx - 16}Z`, { fill: lin('tpot', [[0, '#c4683a'], [1, '#7a3a1a']]) });
  R(t, cx - 25, py - 26, 50, 6, 2, { fill: '#a8502a' });
  const fr = [[-70, 0.9], [-40, 1], [-12, 1.1], [14, 1.05], [42, 0.95], [70, 0.85]];
  for (const [a, s] of fr) {
    const ang = (a * Math.PI) / 180, len = 92 * s;
    const ex = cx + Math.sin(ang) * len, ey = py - 26 - Math.cos(ang) * len;
    const mx = cx + Math.sin(ang) * len * 0.5 + (a > 0 ? 8 : -8), my = py - 26 - Math.cos(ang) * len * 0.6;
    P(t, `M${cx} ${py - 26}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`, stroke('#3dbf6a', 2));
    for (let j = 1; j < 9; j++) { const tt = j / 9, x = (1 - tt) * (1 - tt) * cx + 2 * (1 - tt) * tt * mx + tt * tt * ex, y = (1 - tt) * (1 - tt) * (py - 26) + 2 * (1 - tt) * tt * my + tt * tt * ey, l = 10 * (1 - tt * 0.6); P(t, `M${f(x)} ${f(y)}l${f(-l * 0.8)} ${f(-l * 0.4)}M${f(x)} ${f(y)}l${f(l * 0.8)} ${f(-l * 0.4)}`, stroke('#6ae08a', 1.2, 0.85)); }
  }
  for (const [x, y] of [[cx - 50, b.y + 40], [cx + 56, b.y + 30], [cx + 20, b.y + 70], [cx - 30, b.y + 90]]) C(t, x, y, 8, { fill: rad('ffly', [[0, '#e8ffb0', 0.8], [1, '#e8ffb0', 0]]) });
  E(t, cx - k.w * 0.28, b.y + 60, 10, 50, { fill: '#fff', 'fill-opacity': 0.08 });
  P(t, `M0 ${yb}H${k.w}`, stroke('#000', 3, 0.45));
  P(t, `M0 ${yb + 3}H${k.w}`, stroke('#fff', 1, 0.2));
  return { leds: [{ x: cx, y: b.y + 14, r: 4.2, bezel: '#1d3a2a', color: '#bff0c8' }] };
};
MOTIFS.bell = (t, b, k) => {
  for (const y of [b.y + 8, b.y + 14, k.h - 8]) P(t, `M0 ${f(y)}H${k.w}`, stroke(shade(k.col, -0.45), 1.4, 0.6));
  for (let i = 0; i < 18; i++) C(t, k.w * 0.18 + i * ((k.w * 0.64) / 17), b.y + 11, 1.6, { fill: shade(k.col, -0.45), 'fill-opacity': 0.6 });
  const cx = k.w / 2, cy = b.y + b.h / 2 + 10;
  C(t, cx, cy, 20, { fill: shade(k.col, -0.2) });
  C(t, cx, cy, 20, stroke(shade(k.col, -0.5), 1.2));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; P(t, `M${f(cx + Math.cos(a) * 7)} ${f(cy + Math.sin(a) * 7)}L${f(cx + Math.cos(a) * 16)} ${f(cy + Math.sin(a) * 16)}`, stroke('#fff6d0', i % 2 ? 1 : 1.8, 0.6)); }
  C(t, cx, cy, 5, { fill: '#fff6d0', 'fill-opacity': 0.7 });
};
MOTIFS.ice = (t, b, k) => {
  const r = rnd(61), pts = [];
  for (let i = 0; i < 12; i++) pts.push([r() * k.w, r() * (b.y + b.h + 30)]);
  for (let i = 0; i < pts.length - 2; i++) P(t, poly([pts[i], pts[i + 1], pts[i + 2]]), { fill: i % 2 ? '#ffffff' : '#5aa8d8', 'fill-opacity': 0.12 + r() * 0.12 });
  for (const [c, y] of [['#5aff9a', b.y + 30], ['#b07aff', b.y + 44]]) P(t, wave(0, k.w, y, 6, 70, y) + `L${k.w} ${y + 12}L0 ${y + 12}Z`, { fill: c, 'fill-opacity': 0.18 });
  P(t, wave(0, k.w, k.h - 22, 2, 30) + `V${k.h}H0Z`, { fill: '#2a6a9a', 'fill-opacity': 0.55 });
  const cx = k.w / 2, cy = b.y + b.h / 2;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P(t, `M${cx} ${cy}l${f(Math.cos(a) * 16)} ${f(Math.sin(a) * 16)}`, stroke('#fff', 1.6, 0.8)); }
};
MOTIFS.stars = (t, b, k) => {
  const r = rnd(71);
  for (let i = 0; i < 18; i++) { const x = 14 + r() * (k.w - 28), y = 14 + r() * (b.y + b.h - 20), s = 1 + r() * 2.4; P(t, starP(x, y, s * 1.6, s * 0.6, 4), { fill: '#ffe6a0', 'fill-opacity': 0.25 + r() * 0.4 }); }
  const cx = k.w / 2 + 40, cy = b.y + b.h / 2;
  P(t, `M${cx - 4} ${cy - 26}A26 26 0 1 0 ${cx + 20} ${cy + 14}A21 21 0 1 1 ${cx - 4} ${cy - 26}Z`, { fill: '#ffe6a0' });
  T6(t, cx - 64, cy - 4, 'z', { size: 16, fill: '#ffe6a0', weight: 700, font: FONTS.script, opacity: 0.8 });
  T6(t, cx - 50, cy - 16, 'z', { size: 11, fill: '#ffe6a0', weight: 700, font: FONTS.script, opacity: 0.6 });
};
MOTIFS.campfire = (t, b, k) => {
  const cx = k.w / 2, cy = b.y + b.h - 50, r = 42;
  inset(t, k.d, k.w, k.h, 4, { stroke: '#f6e6cc', 'stroke-width': 1.6, 'stroke-opacity': 0.7 });
  for (let i = 0; i < 4; i++) C(t, cx, cy, r + 6 + i * 3, stroke(i % 2 ? '#2a1406' : '#f6e6cc', 1.2, 0.7));
  C(t, cx, cy, r, { fill: '#120804' });
  const fg = clipTo(t, circ(cx, cy, r));
  C(fg, cx, cy + 20, 40, { fill: rad('fire', [[0, '#ffcf6a', 0.9], [1, '#ff6a1a', 0]]) });
  P(fg, `M${cx - 22} ${cy + 20}C${cx - 24} ${cy} ${cx - 10} ${cy - 8} ${cx - 8} ${cy - 24}C${cx} ${cy - 10} ${cx + 4} ${cy - 18} ${cx + 4} ${cy - 30}C${cx + 18} ${cy - 14} ${cx + 24} ${cy} ${cx + 20} ${cy + 20}Z`, { fill: '#ff6a1a' });
  P(fg, `M${cx - 12} ${cy + 20}C${cx - 12} ${cy + 6} ${cx - 2} ${cy} ${cx} ${cy - 10}C${cx + 6} ${cy} ${cx + 12} ${cy + 8} ${cx + 10} ${cy + 20}Z`, { fill: '#ffd36b' });
  for (const a of [-16, 16]) R(fg, cx - 26, cy + 18, 52, 7, 3.5, { fill: '#5a3a1e', transform: `rotate(${a} ${cx} ${cy + 22})` });
  P(t, `M${cx - 16} 0V14`, stroke('#000', 0.8, 0.4));
};
const T6 = (p, x, y, s, o) => label(p, x, y, s, o);

export function installTz6Forms(registerForm) {
  registerForm('tz6', tz6);
}
export { MOTIFS as tz6Motifs, SHAPES as tz6Shapes };
