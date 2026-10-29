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
    const pts = [...top, ...side, [0.62, 1], [0.38, 1], [0.1, 0.97], [0.03, 0.84], [0, 0.66]].map(([x, y]) => [x * w, y * h]);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length], ch = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const flat = i >= 11 && i <= 12;
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
    const cx = w / 2, by = h - 92;
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
        R(g, bw - 6, 40, 30, 7, 2, { fill: lin('flagp', [[0, '#9aa1a9'], [1, '#50565d']]) });
        P(g, `M${w - 12} 10H${w - 2}V44H${w - 12}Z`, { fill: '#d22a22', stroke: '#000', 'stroke-opacity': 0.4 });
        R(g, w - 14, 8, 4, 40, 2, { fill: '#7d848d' });
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
  const padTop = A.padTop ?? 12, artH = A.artH ?? 80, logoH = A.logoIn ? 0 : A.logoH ?? 36, gap = A.gap ?? 6;
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
  const L = A.logo || {};
  if (!A.noLogo) {
    const ly = A.logoIn ? top + (A.logoY ?? artH / 2) : top + artH + 13;
    const lb = B(ly - 8, ly + 8, L.x ?? cx);
    const lx = L.x ?? (lb[0] + lb[1]) / 2;
    const mw = L.maxW ?? lb[1] - lb[0] - 20;
    logo(g, lx, ly, def.logo || def.name, Object.assign({ size: 18, maxW: mw, fill: def.logoColor || ink, ls: 1.5 }, L));
    if (def.typeName && !A.noType) {
      const ty = ly + (L.typeDy ?? 14);
      const tb = B(ty - 4, ty + 4, lx);
      txt(g, lx, ty, def.typeName.toUpperCase(), { size: 5, maxW: tb[1] - tb[0] - 24, font: 'inter', fill: A.typeColor || L.fill || def.logoColor || ink, weight: 700, ls: 1.1, opacity: 0.8 });
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

export function installTz6Forms(registerForm) {
  registerForm('tz6', tz6);
}
export { MOTIFS as tz6Motifs, SHAPES as tz6Shapes };
