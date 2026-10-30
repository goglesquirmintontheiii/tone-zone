// Shared material library: a catalogue of materials (with submaterials, finishes and colours) plus SVG fills for them.
// A spec is { m, s, f, c }: material, submaterial, finish and colour (hex or a palette id). normalize() always returns
// a valid one. Textures are small seamless tiles drawn once on a canvas and used as <pattern><image> defs in
// #globalDefs, with stable ids derived from the spec, so raster.js can copy them into bitmaps and thumbnails.
import { SVGNS } from '../util.js';

// ------------------------------------------------------------------ palettes
const P = (list) => list.map(([id, name, hex]) => ({ id, name, hex }));
export const PALETTES = {
  anodize: P([['black', 'Black', '#1d1e22'], ['silver', 'Silver', '#c9ccd1'], ['red', 'Red', '#b3202a'], ['blue', 'Blue', '#1f5fbf'], ['purple', 'Purple', '#5b2b9a'], ['green', 'Green', '#2f7d4a'], ['gold', 'Gold', '#c99a2e'], ['orange', 'Orange', '#d4631f'], ['pink', 'Pink', '#d0508a'], ['teal', 'Teal', '#1c8a8f'], ['bronze', 'Bronze', '#7a5a34'], ['gunmetal', 'Gunmetal', '#3d4249']]),
  powder: P([['black', 'Black', '#1b1c20'], ['white', 'White', '#efede7'], ['cream', 'Cream', '#e7dcc0'], ['red', 'Red', '#c9302c'], ['orange', 'Orange', '#e56b1f'], ['yellow', 'Yellow', '#f2c230'], ['green', 'Green', '#3a9a5b'], ['olive', 'Olive', '#5d6337'], ['teal', 'Teal', '#1f8a8a'], ['blue', 'Blue', '#2b7bd6'], ['navy', 'Navy', '#1f2d55'], ['purple', 'Purple', '#5a3fb0'], ['pink', 'Pink', '#d6487e'], ['grey', 'Grey', '#8d99a8'], ['brown', 'Brown', '#6b4428']]),
  stain: P([['natural', 'Natural', '#ffffff'], ['honey', 'Honey', '#e8b25a'], ['amber', 'Amber', '#d48a2a'], ['cherry', 'Cherry', '#a8342a'], ['mahogany', 'Mahogany', '#7a2e1c'], ['walnut', 'Walnut', '#5a3a22'], ['ebony', 'Ebony black', '#1c1714'], ['grey', 'Weathered grey', '#8f8c86'], ['blue', 'Blue', '#2f5f9e'], ['green', 'Green', '#3d7a4a'], ['red', 'Red', '#b5262b'], ['purple', 'Purple', '#5e3a8a'], ['sunburst', 'Sunburst', '#d9952f'], ['cherryburst', 'Cherry burst', '#b8402e'], ['blueburst', 'Blue burst', '#3b6fb0']]),
  plastic: P([['black', 'Black', '#1c1d21'], ['white', 'White', '#f1f0ec'], ['cream', 'Cream', '#ece2c6'], ['red', 'Red', '#d0312d'], ['orange', 'Orange', '#ee7a22'], ['yellow', 'Yellow', '#f5cb2f'], ['lime', 'Lime', '#8cc63f'], ['green', 'Green', '#2f9a57'], ['teal', 'Teal', '#1fa0a0'], ['blue', 'Blue', '#2f7de0'], ['purple', 'Purple', '#6b45c4'], ['pink', 'Pink', '#e8579a'], ['grey', 'Grey', '#8a9099'], ['brown', 'Brown', '#6e4a2c']]),
  tint: P([['aqua', 'Aqua', '#5fc9d6'], ['blue', 'Blue', '#3b78d8'], ['green', 'Green', '#4caf6a'], ['amber', 'Amber', '#e0a23a'], ['red', 'Red', '#d64545'], ['purple', 'Purple', '#8e5bd8'], ['pink', 'Pink', '#e870aa'], ['grey', 'Grey', '#9aa3ad']]),
  carbon: P([['black', 'Black', '#3a3d44'], ['silver', 'Silver', '#9aa3ad'], ['red', 'Red', '#b02a2a'], ['blue', 'Blue', '#2a5fb0'], ['gold', 'Kevlar gold', '#c9a23a'], ['green', 'Green', '#2f8a4f'], ['purple', 'Purple', '#6a3fb0']]),
  tolex: P([['black', 'Black', '#18181a'], ['cream', 'Cream', '#e5d8b8'], ['white', 'White', '#ecebe6'], ['brown', 'Brown', '#5a3a24'], ['tan', 'Tan', '#a87c4f'], ['red', 'Red', '#9e2124'], ['blue', 'Blue', '#24427a'], ['green', 'Green', '#2c5a3c'], ['grey', 'Grey', '#6a6d72'], ['purple', 'Purple', '#4a2a6a'], ['oxblood', 'Oxblood', '#5a1a1e']]),
  rubber: P([['black', 'Black', '#1f2023'], ['grey', 'Grey', '#5d6066'], ['red', 'Red', '#a8292a'], ['blue', 'Blue', '#2a5596'], ['green', 'Green', '#2f7044'], ['yellow', 'Yellow', '#d9b02a'], ['white', 'White', '#d9d8d4'], ['orange', 'Orange', '#d2621f']]),
  glow: P([['green', 'Green', '#7dff6a'], ['aqua', 'Aqua', '#4ff5e0'], ['blue', 'Blue', '#4fb2ff'], ['orange', 'Orange', '#ffb04a'], ['pink', 'Pink', '#ff6fd0'], ['purple', 'Purple', '#b07aff'], ['yellow', 'Yellow', '#eaff5a'], ['white', 'White', '#e8fff4']]),
  concrete: P([['grey', 'Grey', '#9a9a97'], ['light', 'Light', '#c9c7c1'], ['dark', 'Charcoal', '#4e4f50'], ['sand', 'Sand', '#bfae8f'], ['red', 'Terracotta', '#b0674a'], ['green', 'Sage', '#8d9a84'], ['blue', 'Blue grey', '#7d8b99']]),
};

// ------------------------------------------------------------------ catalogue
const S = (list) => list.map(([id, name, a, b, k = {}]) => Object.assign({ id, name, light: a, dark: b }, k));
const F = (list) => list.map(([id, name, k = {}]) => Object.assign({ id, name }, k));
export const MATERIALS = [
  {
    id: 'metal', name: 'Metal',
    subs: S([['aluminium', 'Aluminium', '#d5d8dc', '#9ea3a9'], ['steel', 'Steel', '#b4b9be', '#7d838a'], ['stainless', 'Stainless', '#d0d3d6', '#969ba1'], ['chrome', 'Chrome', '#f0f3f6', '#8b929a'], ['titanium', 'Titanium', '#a9a8a3', '#6f6e6a'], ['brass', 'Brass', '#e3c26a', '#9c7a2e'], ['copper', 'Copper', '#df9a6a', '#93522c'], ['bronze', 'Bronze', '#c49a5c', '#7a5428'], ['gold', 'Gold', '#f2d27a', '#b08a2c'], ['iron', 'Cast iron', '#7a7c7f', '#3e4043']]),
    finishes: F([['brushed', 'Brushed'], ['polished', 'Polished'], ['bare', 'Bare'], ['sandblasted', 'Sandblasted'], ['hammered', 'Hammered'], ['patina', 'Patina'], ['anodized', 'Anodized', { colors: 'anodize' }], ['powder', 'Powder coat', { colors: 'powder' }], ['flake', 'Metal flake', { colors: 'powder' }], ['hammertone', 'Hammertone', { colors: 'powder' }]]),
    def: { s: 'aluminium', f: 'brushed' },
  },
  {
    id: 'wood', name: 'Wood',
    subs: S([['ebony', 'Ebony', '#3a2f2a', '#0e0b0a', { k: 40, warp: 0.25, streak: 0.7, con: 0.45 }], ['rosewood', 'Rosewood', '#7a4430', '#2e1610', { k: 22, warp: 0.9, streak: 0.6, con: 0.75 }], ['birch', 'Birch', '#ecd9b4', '#c9ab7c', { k: 10, warp: 0.6, streak: 0.25, con: 0.35 }], ['plywood', 'Plywood', '#e6cc9c', '#bd9763', { k: 4, warp: 1.6, streak: 0.2, con: 0.55, ply: true }], ['oak', 'Oak', '#d2aa72', '#8e6436', { k: 16, warp: 1, streak: 0.55, con: 0.7, rays: true }], ['maple', 'Maple', '#f0dcb4', '#d2b483', { k: 12, warp: 0.5, streak: 0.2, con: 0.3 }], ['flamed', 'Flamed maple', '#f2d7a2', '#b88a4e', { k: 12, warp: 0.5, streak: 0.2, con: 0.3, flame: 1 }], ['walnut', 'Walnut', '#7b5a40', '#3b2618', { k: 18, warp: 1, streak: 0.5, con: 0.7 }], ['mahogany', 'Mahogany', '#9a5434', '#5a2a16', { k: 26, warp: 0.4, streak: 0.4, con: 0.45, ribbon: true }], ['koa', 'Figured koa', '#c98a4a', '#6a3c1a', { k: 20, warp: 1.2, streak: 0.4, con: 0.75, flame: 1.4 }], ['zebrawood', 'Zebrawood', '#e8cf9a', '#4a3020', { k: 16, warp: 0.35, streak: 0.3, con: 1.25, sharp: 3 }], ['ash', 'Ash', '#e4cfa4', '#9c7a4c', { k: 9, warp: 1.3, streak: 0.4, con: 0.8 }], ['pine', 'Pine', '#ebc98c', '#b97f3e', { k: 7, warp: 1.5, streak: 0.2, con: 0.8 }], ['bamboo', 'Bamboo', '#e2c47e', '#a88442', { k: 40, warp: 0.1, streak: 0.5, con: 0.25, nodes: true }]]),
    finishes: F([['oil', 'Natural oil'], ['matte', 'Matte'], ['satin', 'Satin'], ['poly', 'Poly gloss'], ['nitro', 'Nitro'], ['stained', 'Stained', { colors: 'stain' }], ['burnt', 'Burnt']]),
    def: { s: 'walnut', f: 'oil' },
  },
  {
    id: 'plastic', name: 'Plastic',
    finishes: F([['matte', 'Matte', { colors: 'plastic' }], ['gloss', 'Gloss', { colors: 'plastic' }], ['soft', 'Soft touch', { colors: 'plastic' }], ['textured', 'Textured', { colors: 'plastic' }], ['sparkle', 'Sparkle', { colors: 'plastic' }]]),
    def: { f: 'gloss', c: '#1c1d21' },
  },
  {
    id: 'glass', name: 'Glass',
    finishes: F([['clear', 'Clear'], ['frosted', 'Frosted'], ['smoked', 'Smoked'], ['tinted', 'Tinted', { colors: 'tint' }], ['mirror', 'Mirror']]),
    def: { f: 'clear' },
  },
  {
    id: 'acrylic', name: 'Acrylic',
    finishes: F([['clear', 'Clear tint', { colors: 'tint' }], ['opaque', 'Opaque gloss', { colors: 'plastic' }], ['frosted', 'Frosted', { colors: 'tint' }], ['candy', 'Candy glitter', { colors: 'tint' }], ['swirl', 'Marbled', { colors: 'plastic' }]]),
    def: { f: 'clear', c: '#5fc9d6' },
  },
  {
    id: 'carbon', name: 'Carbon fibre',
    finishes: F([['gloss', 'Gloss', { colors: 'carbon' }], ['matte', 'Matte', { colors: 'carbon' }], ['forged', 'Forged', { colors: 'carbon' }]]),
    def: { f: 'gloss', c: '#3a3d44' },
  },
  {
    id: 'tolex', name: 'Tolex / leather',
    subs: S([['tolex', 'Tolex', '', ''], ['tweed', 'Tweed', '', ''], ['leather', 'Leather', '', ''], ['croc', 'Croc', '', ''], ['suede', 'Suede', '', '']]),
    finishes: F([['new', 'New', { colors: 'tolex' }], ['worn', 'Worn', { colors: 'tolex' }]]),
    def: { s: 'tolex', f: 'new', c: '#18181a' },
  },
  {
    id: 'stone', name: 'Stone',
    subs: S([['marble', 'White marble', '#eeebe6', '#9a9893'], ['blackmarble', 'Black marble', '#1d1d1f', '#d8d2c4'], ['greenmarble', 'Green marble', '#2f5a45', '#c9e0d0'], ['granite', 'Granite', '#8d8b88', '#2a2a2c'], ['slate', 'Slate', '#4a4f55', '#2b2f33'], ['onyx', 'Honey onyx', '#e2b26a', '#9a5a22'], ['travertine', 'Travertine', '#ddcfb4', '#b19c78']]),
    finishes: F([['polished', 'Polished'], ['honed', 'Honed'], ['rough', 'Rough']]),
    def: { s: 'marble', f: 'polished' },
  },
  {
    id: 'rubber', name: 'Rubber',
    finishes: F([['smooth', 'Smooth', { colors: 'rubber' }], ['ribbed', 'Ribbed', { colors: 'rubber' }], ['grip', 'Grip', { colors: 'rubber' }]]),
    def: { f: 'smooth', c: '#1f2023' },
  },
  {
    id: 'glow', name: 'Glow in the dark',
    finishes: F([['glowing', 'Glowing', { colors: 'glow' }], ['daylight', 'Daylight', { colors: 'glow' }]]),
    def: { f: 'glowing', c: '#7dff6a' },
  },
  {
    id: 'pearl', name: 'Mother of pearl',
    subs: S([['white', 'White pearl', '#f4f1ec', '#c9c4bd', { hue: 190, sat: 0.35 }], ['abalone', 'Abalone', '#4fa6a0', '#2b2f5a', { hue: 170, sat: 0.75 }], ['black', 'Black pearl', '#3a3d45', '#14151a', { hue: 260, sat: 0.45 }], ['pink', 'Pink pearl', '#f2d6dc', '#c9a0aa', { hue: 330, sat: 0.4 }], ['gold', 'Gold pearl', '#f2e2b8', '#c9ac6a', { hue: 40, sat: 0.4 }]]),
    finishes: F([['polished', 'Polished'], ['satin', 'Satin']]),
    def: { s: 'white', f: 'polished' },
  },
  {
    id: 'concrete', name: 'Concrete',
    finishes: F([['smooth', 'Smooth', { colors: 'concrete' }], ['rough', 'Rough', { colors: 'concrete' }], ['terrazzo', 'Terrazzo', { colors: 'concrete' }], ['polished', 'Polished', { colors: 'concrete' }]]),
    def: { f: 'smooth', c: '#9a9a97' },
  },
];
const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));
export const DEFAULT_SPEC = { m: 'metal', s: 'aluminium', f: 'brushed', c: '' };

export function material(id) {
  return BY_ID.get(id) || null;
}
export function finishesFor(m) {
  return (BY_ID.get(m) || MATERIALS[0]).finishes;
}
export function paletteFor(spec) {
  const M = BY_ID.get(spec.m);
  const f = M && M.finishes.find((x) => x.id === spec.f);
  return f && f.colors ? PALETTES[f.colors] : null;
}
const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** Always returns a valid spec (falls back to `fallback`, then the default). 'stock' passes through for parts. */
export function normalize(spec, fallback) {
  const s = spec && typeof spec === 'object' ? spec : {};
  if (s.m === 'stock') return { m: 'stock', s: '', f: '', c: '' };
  const M = BY_ID.get(s.m);
  if (!M) return fallback ? normalize(fallback) : { ...DEFAULT_SPEC };
  const sub = M.subs ? (M.subs.some((x) => x.id === s.s) ? s.s : M.def.s || M.subs[0].id) : '';
  const fin = M.finishes.some((x) => x.id === s.f) ? s.f : M.def.f;
  const out = { m: M.id, s: sub, f: fin, c: '' };
  const pal = paletteFor(out);
  if (pal) {
    const c = typeof s.c === 'string' ? s.c.toLowerCase() : '';
    out.c = pal.some((p) => p.id === c) ? c : isHex(c) ? c : M.def.c && (isHex(M.def.c) || pal.some((p) => p.id === M.def.c)) ? M.def.c : pal[0].hex;
  }
  return out;
}

/** Hex colour of a spec's colour value (palette ids resolve to their hex). */
export function colorHex(spec) {
  const pal = paletteFor(spec);
  if (!pal) return null;
  const p = pal.find((x) => x.id === spec.c);
  return p ? p.hex : isHex(spec.c) ? spec.c : pal[0].hex;
}
const BURSTS = { sunburst: '#2a1408', cherryburst: '#2a0a08', blueburst: '#0a1630' };

/** Short readable name, e.g. "Ebony wood, nitro". */
export function specLabel(spec) {
  const s = normalize(spec);
  if (s.m === 'stock') return 'Stock';
  const M = BY_ID.get(s.m);
  const sub = M.subs && M.subs.find((x) => x.id === s.s);
  const fin = M.finishes.find((x) => x.id === s.f);
  const pal = paletteFor(s);
  const col = pal && (pal.find((p) => p.id === s.c || p.hex.toLowerCase() === s.c) || null);
  const head = sub ? (s.m === 'wood' || s.m === 'metal' ? sub.name + ' ' + (s.m === 'wood' ? 'wood' : '') : sub.name).trim() : M.name;
  return [head, fin && fin.name.toLowerCase(), col ? col.name.toLowerCase() : pal ? s.c : ''].filter(Boolean).join(', ');
}

/** Spec from block params with a prefix, e.g. frameMat/frameSub/frameFin/frameCol. */
export function fromParams(p, prefix, fallback) {
  if (!p || !p[prefix + 'Mat']) return normalize(fallback);
  return normalize({ m: p[prefix + 'Mat'], s: p[prefix + 'Sub'], f: p[prefix + 'Fin'], c: p[prefix + 'Col'] }, fallback);
}
export function toParams(spec, prefix) {
  const s = normalize(spec);
  return { [prefix + 'Mat']: s.m, [prefix + 'Sub']: s.s, [prefix + 'Fin']: s.f, [prefix + 'Col']: s.c };
}

// ------------------------------------------------------------------ colour helpers
function rgb(hex) {
  const h = isHex(hex) ? hex.slice(1) : '808080';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
function hexOf([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(cl(v)).toString(16).padStart(2, '0')).join('');
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lumOf = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// ------------------------------------------------------------------ seamless noise
function hash(i, j, s) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
// value noise that repeats every px x py lattice cells
function vnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = (i, j) => hash(((i % px) + px) % px, ((j % py) + py) % py, s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fractal noise on unit coords (u, v in 0..1), periodic over the tile
function fbm(u, v, fx, fy, oct, s) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += vnoise(u * fx, v * fy, fx, fy, s + o * 17) * amp;
    norm += amp;
    fx *= 2;
    fy *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}
// nearest jittered cell point (periodic): returns distance (in cell units) and offset vector
function worley(u, v, nx, ny, s, jit = 0.8) {
  const x = u * nx, y = v * ny;
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9, bx = 0, by = 0, bid = 0, second = 9;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const ci = xi + i, cj = yi + j;
      const wi = ((ci % nx) + nx) % nx, wj = ((cj % ny) + ny) % ny;
      const px = ci + 0.5 + (hash(wi, wj, s) - 0.5) * jit, py = cj + 0.5 + (hash(wi, wj, s + 1) - 0.5) * jit;
      const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
      if (d < best) {
        second = best;
        best = d;
        bx = dx;
        by = dy;
        bid = wi * 131 + wj;
      } else if (d < second) second = d;
    }
  return { d: best, dx: bx, dy: by, id: bid, edge: second - best };
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);

// draws a W x H tile with fn(u, v, x, y) -> [r, g, b, a?] and returns a data URL
function tile(W, H, fn, alpha) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d');
  const img = cx.createImageData(W, H);
  const d = img.data;
  let k = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = fn(x / W, y / H, x, y);
      d[k] = cl(p[0]);
      d[k + 1] = cl(p[1]);
      d[k + 2] = cl(p[2]);
      d[k + 3] = alpha ? cl(p[3] ?? 255) : 255;
      k += 4;
    }
  cx.putImageData(img, 0, 0);
  return alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
}

// ------------------------------------------------------------------ texture generators
// Each returns { url, w, h (tile size in user units at scale 1), alpha, base (average colour) }
function texMetal(s, q) {
  const M = BY_ID.get('metal');
  const sub = M.subs.find((x) => x.id === s.s) || M.subs[0];
  const coated = ['anodized', 'powder', 'flake', 'hammertone'].includes(s.f);
  const col = coated ? rgb(colorHex(s)) : null;
  let lo = rgb(sub.dark), hi = rgb(sub.light);
  if (s.f === 'anodized') {
    hi = mix(col, [255, 255, 255], 0.22);
    lo = mul(col, 0.72);
  } else if (coated) {
    hi = mix(col, [255, 255, 255], 0.06);
    lo = mul(col, 0.9);
  }
  const W = 256 * q, H = 128 * q;
  const patCol = s.s === 'copper' || s.s === 'brass' || s.s === 'bronze' ? [[78, 158, 132], [126, 196, 168]] : s.s === 'steel' || s.s === 'iron' ? [[128, 58, 26], [178, 98, 44]] : s.s === 'gold' || s.s === 'chrome' ? [[92, 70, 40], [130, 104, 70]] : [[188, 190, 186], [222, 222, 216]];
  const fn = (u, v) => {
    let t = 0.5;
    switch (s.f) {
      case 'brushed':
      case 'anodized': {
        const row = fbm(u, v, 3, 128, 2, 11);
        t = 0.5 + (row - 0.5) * 0.55 + (fbm(u, v, 1, 16, 2, 19) - 0.5) * 0.3 + (hash(u * W | 0, v * H | 0, 3) - 0.5) * 0.08;
        break;
      }
      case 'polished':
        t = 0.62 + (fbm(u, v, 2, 2, 2, 5) - 0.5) * 0.12;
        break;
      case 'bare':
        t = 0.45 + (fbm(u, v, 4, 2, 4, 9) - 0.5) * 0.5;
        break;
      case 'sandblasted':
        t = 0.5 + (hash(u * W | 0, v * H | 0, 7) - 0.5) * 0.35 + (fbm(u, v, 8, 4, 2, 2) - 0.5) * 0.2;
        break;
      case 'hammered':
      case 'hammertone': {
        const w = worley(u, v, 10, 5, 21, 0.9);
        const lit = (-w.dx * 0.7 - w.dy * 0.7) * 1.6 + w.d * 0.2;
        t = 0.5 + lit * 0.55 - smooth(0.0, 0.08, w.edge) * 0 + (hash(u * W | 0, v * H | 0, 1) - 0.5) * 0.06;
        break;
      }
      case 'patina': {
        t = 0.45 + (fbm(u, v, 4, 2, 4, 9) - 0.5) * 0.4;
        break;
      }
      case 'powder':
        t = 0.5 + (fbm(u, v, 32, 16, 2, 4) - 0.5) * 0.25 + (hash(u * W | 0, v * H | 0, 6) - 0.5) * 0.08;
        break;
      case 'flake':
        t = 0.5 + (fbm(u, v, 16, 8, 2, 4) - 0.5) * 0.2;
        break;
    }
    let c = mix(lo, hi, Math.max(0, Math.min(1, t)));
    if (s.f === 'patina') {
      const b = fbm(u + 0.3, v, 6, 3, 5, 31);
      const m = smooth(0.45, 0.62, b);
      const pc = mix(patCol[0], patCol[1], fbm(u, v, 12, 6, 2, 8));
      c = mix(c, pc, m * 0.92);
      c = mul(c, 1 - smooth(0.6, 0.75, fbm(u, v, 10, 5, 3, 40)) * 0.25);
    }
    if (s.f === 'flake' && hash(u * W | 0, v * H | 0, 12) > 0.965) c = mix(c, [255, 255, 255], 0.35 + hash(u * W | 0, v * H | 0, 13) * 0.5);
    return c;
  };
  return { url: tile(W, H, fn), w: 256, h: 128, base: hexOf(mix(lo, hi, 0.5)) };
}

function woodColor(s) {
  const M = BY_ID.get('wood');
  const sp = M.subs.find((x) => x.id === s.s) || M.subs[0];
  return { sp, light: rgb(sp.light), dark: rgb(sp.dark) };
}
function texWood(s, q) {
  const { sp, light, dark } = woodColor(s);
  const W = 512 * q, H = 256 * q;
  const stainHex = s.f === 'stained' ? colorHex(s) : null;
  const stain = stainHex ? rgb(stainHex) : null;
  const K = sp.k;
  const fn = (u, v) => {
    const n = fbm(u, v, 3, 2, 4, 101);
    let g = v * K + (n - 0.5) * sp.warp * 4 + Math.sin(u * Math.PI * 2 + n * 3) * sp.warp * 0.4;
    let ring = Math.abs(Math.sin(Math.PI * g));
    ring = Math.pow(ring, sp.sharp || 1.6);
    const streak = fbm(u, v, 2, 128, 2, 77);
    let t = 1 - ring * sp.con - (streak - 0.5) * sp.streak * 0.9;
    if (sp.rays) {
      const r = fbm(u, v, 24, 6, 2, 55);
      if (r > 0.66) t += (r - 0.66) * 2.2;
      if (hash(u * W | 0, (v * H / 2) | 0, 9) > 0.985) t -= 0.35;
    }
    if (sp.ply) t += (fbm(u, v, 2, 1, 3, 12) - 0.5) * 0.35;
    if (sp.ribbon) t += Math.sin(v * Math.PI * 2 * 6 + n * 2) * 0.12;
    if (sp.nodes) {
      const nd = Math.abs(fract(u * 2) - 0.5);
      if (nd > 0.47) t -= (nd - 0.47) * 18;
    }
    let c = mix(dark, light, Math.max(0, Math.min(1.1, t)));
    if (sp.flame) {
      const fl = Math.sin(Math.PI * 2 * (u * 14 + (fbm(u, v, 4, 2, 3, 61) - 0.5) * 1.8 * sp.flame + v * 0.0));
      c = mul(c, 1 + fl * 0.16 * sp.flame);
    }
    // finishes
    switch (s.f) {
      case 'oil':
        c = mul(mix(c, [c[0] * 1.06, c[1] * 0.98, c[2] * 0.88], 0.6), 0.9);
        break;
      case 'matte':
        c = mix(c, [lumOf(c) * 255, lumOf(c) * 255, lumOf(c) * 255], 0.12);
        c = mix(c, [235, 230, 220], 0.06);
        break;
      case 'poly':
        c = mul([c[0] * 1.04, c[1], c[2] * 0.94], 0.93);
        break;
      case 'nitro':
        c = mul([c[0] * 1.02, c[1] * 0.92, c[2] * 0.7], 0.92);
        break;
      case 'stained': {
        const k = s.c === 'natural' ? 0 : 0.78;
        c = mix(c, [c[0] * stain[0] / 200, c[1] * stain[1] / 200, c[2] * stain[2] / 200], k);
        break;
      }
      case 'burnt': {
        const ridge = ring;
        c = mix([22, 16, 13], mul(c, 0.55), Math.max(0, 1 - ridge * 1.2) * 0.55);
        if (hash(u * W | 0, v * H | 0, 4) > 0.97) c = mix(c, [60, 40, 30], 0.6);
        break;
      }
    }
    return c;
  };
  return { url: tile(W, H, fn), w: 512, h: 256, base: hexOf(mix(dark, light, 0.6)) };
}

function texPlastic(s, q) {
  const col = rgb(colorHex(s));
  const W = 128 * q, H = 128 * q;
  const fn = (u, v, x, y) => {
    let c = col;
    if (s.f === 'textured') c = mul(c, 1 + (fbm(u, v, 32, 32, 2, 3) - 0.5) * 0.28 + (hash(x, y, 2) - 0.5) * 0.1);
    else if (s.f === 'soft') c = mul(mix(c, [lumOf(c) * 255, lumOf(c) * 255, lumOf(c) * 255], 0.1), 1 + (hash(x, y, 5) - 0.5) * 0.05);
    else if (s.f === 'matte') c = mul(c, 1 + (hash(x, y, 5) - 0.5) * 0.06);
    else if (s.f === 'sparkle') {
      c = mul(c, 1 + (fbm(u, v, 16, 16, 2, 4) - 0.5) * 0.15);
      if (hash(x, y, 12) > 0.955) c = mix(c, hsl2rgb(hash(x, y, 14) * 360, 0.6, 0.8), 0.5 + hash(x, y, 13) * 0.4);
    }
    return c;
  };
  return { url: tile(W, H, fn), w: 128, h: 128, base: hexOf(col) };
}

function texGlass(s, q, acrylic) {
  const tint = s.f === 'smoked' ? [34, 36, 40] : s.f === 'mirror' ? [210, 216, 222] : s.f === 'frosted' && !acrylic ? [238, 243, 247] : s.f === 'clear' && !acrylic ? [205, 230, 240] : rgb(colorHex(s));
  const a0 = { clear: acrylic ? 0.5 : 0.16, frosted: acrylic ? 0.75 : 0.62, smoked: 0.6, tinted: 0.42, mirror: 1, candy: 0.55, opaque: 1, swirl: 1 }[s.f] ?? 0.4;
  const W = 128 * q, H = 128 * q;
  const fn = (u, v, x, y) => {
    let c = tint, a = a0;
    if (s.f === 'frosted') {
      const n = hash(x, y, 3);
      c = mix(c, [255, 255, 255], n * 0.25);
      a += (n - 0.5) * 0.12;
    } else if (s.f === 'mirror') {
      c = mul(c, 0.8 + fbm(u, v, 2, 2, 3, 8) * 0.4);
    } else if (s.f === 'candy') {
      if (hash(x, y, 12) > 0.94) {
        c = mix(c, [255, 255, 255], 0.6);
        a = 0.95;
      }
    } else if (s.f === 'swirl') {
      const n = fbm(u, v, 3, 3, 4, 44);
      const b = Math.sin((u * 2 + n * 4) * Math.PI * 2);
      c = mix(c, mix(c, [255, 255, 255], 0.65), smooth(0.2, 0.9, b));
    } else if (s.f === 'clear' || s.f === 'tinted' || s.f === 'smoked') a += (fbm(u, v, 2, 2, 2, 5) - 0.5) * 0.06;
    return [c[0], c[1], c[2], a * 255];
  };
  return { url: tile(W, H, fn, true), w: 128, h: 128, alpha: true, base: hexOf(tint) };
}

function texCarbon(s, q) {
  const tow = rgb(colorHex(s));
  const W = 64 * q, H = 64 * q;
  const N = 8; // cells per tile
  const fn = (u, v) => {
    if (s.f === 'forged') {
      const w = worley(u, v, 6, 6, 9, 1);
      const ang = hash(w.id, 3, 2) * Math.PI;
      const along = Math.cos(ang) * u * 60 + Math.sin(ang) * v * 60;
      let t = 0.15 + 0.35 * hash(w.id, 1, 5) + Math.sin(along * 6) * 0.05;
      if (w.edge < 0.06) t *= 0.4;
      return mix([10, 10, 12], tow, t);
    }
    const ci = Math.floor(u * N), cj = Math.floor(v * N);
    const fu = u * N - ci, fv = v * N - cj;
    const horiz = ((ci - cj) % 4 + 4) % 4 < 2;
    const across = horiz ? fv : fu;
    const along = horiz ? fu : fv;
    let t = Math.sin(across * Math.PI) * 0.75 + 0.1;
    t *= 0.85 + Math.sin(along * Math.PI) * 0.15;
    t *= horiz ? 1 : 0.55;
    t += (hash(u * W * 4 | 0, v * H | 0, 7) - 0.5) * 0.08;
    return mix([8, 8, 10], tow, Math.max(0, t));
  };
  return { url: tile(W, H, fn), w: 24, h: 24, base: hexOf(mul(tow, 0.4)) };
}

function texTolex(s, q) {
  const col = rgb(colorHex(s));
  const W = 128 * q, H = 128 * q;
  const worn = s.f === 'worn';
  const fn = (u, v, x, y) => {
    let c = col;
    if (s.s === 'tolex') {
      const n = fbm(u, v, 24, 24, 2, 3);
      const n2 = fbm(u + 0.01, v + 0.01, 24, 24, 2, 3);
      c = mul(c, 0.92 + (n - n2) * 3 + n * 0.1);
    } else if (s.s === 'tweed') {
      const d = fract((u + v) * 16);
      const d2 = fract((u - v) * 16);
      const band = Math.sin(d * Math.PI * 2) * 0.5 + 0.5;
      const yarn = hash(Math.floor((u + v) * 64), Math.floor((u - v) * 64) & 63, 5);
      const light = mix(c, [235, 220, 180], 0.55);
      c = mix(mul(c, 0.7), light, band * 0.6 + yarn * 0.3 + Math.sin(d2 * Math.PI * 2) * 0.08);
    } else if (s.s === 'leather') {
      const n = fbm(u, v, 8, 8, 4, 13);
      const crease = 1 - Math.abs(n - 0.5) * 2;
      c = mul(c, 0.92 + (1 - Math.pow(crease, 8)) * 0.12 + (hash(x, y, 1) - 0.5) * 0.05);
    } else if (s.s === 'croc') {
      const w = worley(u, v, 6, 4, 77, 0.6);
      c = mul(c, 0.7 + Math.min(1, w.edge * 4) * 0.4 - w.d * 0.15);
    } else {
      c = mul(c, 0.95 + (hash(x, y, 2) - 0.5) * 0.12 + (fbm(u, v, 6, 6, 3, 2) - 0.5) * 0.15);
    }
    if (worn) {
      const m = smooth(0.55, 0.75, fbm(u, v, 3, 3, 4, 90));
      c = mix(c, mix(c, [200, 190, 170], 0.5), m * 0.7);
    }
    return c;
  };
  return { url: tile(W, H, fn), w: s.s === 'tweed' ? 96 : 128, h: s.s === 'tweed' ? 96 : 128, base: hexOf(col) };
}

function texStone(s, q) {
  const M = BY_ID.get('stone');
  const sub = M.subs.find((x) => x.id === s.s) || M.subs[0];
  const a = rgb(sub.light), b = rgb(sub.dark);
  const W = 256 * q, H = 256 * q;
  const fn = (u, v, x, y) => {
    let c;
    switch (sub.id) {
      case 'granite': {
        const r = hash(x, y, 3);
        c = mix(a, b, fbm(u, v, 16, 16, 3, 5));
        if (r > 0.86) c = mix(c, [20, 20, 22], 0.8);
        else if (r > 0.78) c = mix(c, [210, 190, 180], 0.6);
        break;
      }
      case 'slate': {
        const n = fbm(u, v, 2, 24, 4, 7);
        c = mix(b, a, n);
        break;
      }
      case 'onyx': {
        const n = fbm(u, v, 3, 3, 4, 11);
        const band = Math.sin((v * 6 + n * 3) * Math.PI * 2) * 0.5 + 0.5;
        c = mix(b, a, band * 0.7 + n * 0.3);
        break;
      }
      case 'travertine': {
        const n = fbm(u, v, 2, 12, 4, 3);
        c = mix(a, b, n * 0.7);
        if (fbm(u, v, 24, 12, 2, 8) > 0.68) c = mul(c, 0.8);
        break;
      }
      default: {
        // marbles: dark base with light veins or the other way round
        const vein = 1 - Math.abs(fbm(u, v, 2, 2, 5, 21) * 2 - 1);
        const vein2 = 1 - Math.abs(fbm(u, v, 4, 4, 4, 23) * 2 - 1);
        const t = Math.pow(vein, 14) * 0.9 + Math.pow(vein2, 24) * 0.45 + (fbm(u, v, 6, 6, 3, 2) - 0.5) * 0.12;
        c = mix(a, b, Math.max(0, Math.min(1, t)));
      }
    }
    if (s.f === 'rough') c = mul(c, 0.86 + hash(x, y, 9) * 0.22);
    if (s.f === 'honed') c = mix(c, [200, 200, 200], 0.05);
    return c;
  };
  return { url: tile(W, H, fn), w: 256, h: 256, base: hexOf(mix(a, b, 0.25)) };
}

function texRubber(s, q) {
  const col = rgb(colorHex(s));
  const W = 64 * q, H = 64 * q;
  const fn = (u, v, x, y) => {
    let c = mul(col, 1 + (hash(x, y, 4) - 0.5) * 0.06);
    if (s.f === 'ribbed') c = mul(c, 0.8 + Math.sin(v * Math.PI * 2 * 8) * 0.2);
    if (s.f === 'grip') {
      const du = fract(u * 8) - 0.5, dv = fract(v * 8) - 0.5;
      const d = Math.hypot(du, dv);
      c = mul(c, d < 0.25 ? 1.15 - d : d < 0.32 ? 0.75 : 0.95);
    }
    return c;
  };
  return { url: tile(W, H, fn), w: 32, h: 32, base: hexOf(col) };
}

function texGlow(s, q) {
  const col = rgb(colorHex(s));
  const day = s.f === 'daylight';
  const base = day ? mix(col, [240, 245, 225], 0.68) : col;
  const W = 96 * q, H = 96 * q;
  const fn = (u, v, x, y) => mul(base, 1 + (fbm(u, v, 6, 6, 3, 3) - 0.5) * (day ? 0.08 : 0.25) + (hash(x, y, 2) - 0.5) * 0.04);
  return { url: tile(W, H, fn), w: 96, h: 96, base: hexOf(base) };
}

function texPearl(s, q) {
  const M = BY_ID.get('pearl');
  const sub = M.subs.find((x) => x.id === s.s) || M.subs[0];
  const a = rgb(sub.light), b = rgb(sub.dark);
  const W = 256 * q, H = 256 * q;
  const fn = (u, v) => {
    const w = worley(u, v, 5, 5, 3, 0.9);
    const n = fbm(u + w.id * 0.013, v, 4, 4, 4, 33 + (w.id % 7));
    const t = Math.sin((n * 3 + w.id * 0.37) * Math.PI * 2) * 0.5 + 0.5;
    const hue = sub.hue + (n - 0.5) * 220 + (w.id % 5) * 18;
    const iri = hsl2rgb(hue, sub.sat, sub.id === 'black' ? 0.35 : sub.id === 'abalone' ? 0.45 : 0.78);
    let c = mix(mix(b, a, t), iri, 0.45 + t * 0.25);
    if (w.edge < 0.05) c = mul(c, 0.82);
    c = mul(c, 0.9 + Math.pow(t, 4) * 0.25);
    return c;
  };
  return { url: tile(W, H, fn), w: 160, h: 160, base: hexOf(mix(a, b, 0.3)) };
}

function texConcrete(s, q) {
  const col = rgb(colorHex(s));
  const W = 192 * q, H = 192 * q;
  const fn = (u, v, x, y) => {
    let c = mul(col, 1 + (fbm(u, v, 4, 4, 4, 7) - 0.5) * 0.18);
    const r = hash(x, y, 3);
    if (s.f === 'rough') {
      c = mul(c, 0.88 + r * 0.24);
      if (fbm(u, v, 48, 48, 1, 9) > 0.8) c = mul(c, 0.7);
    } else if (s.f === 'terrazzo') {
      const w = worley(u, v, 18, 18, 5, 1);
      if (w.d < 0.28 + hash(w.id, 2, 2) * 0.12) {
        const pick = hash(w.id, 1, 1);
        c = pick < 0.3 ? [240, 238, 232] : pick < 0.5 ? [40, 40, 42] : pick < 0.7 ? [196, 120, 90] : pick < 0.85 ? [120, 150, 130] : [220, 190, 120];
      }
    } else {
      c = mul(c, 1 + (r - 0.5) * 0.05);
      if (r > 0.995) c = mul(c, 0.6);
    }
    return c;
  };
  return { url: tile(W, H, fn), w: 192, h: 192, base: hexOf(col) };
}

const TEX = { metal: texMetal, wood: texWood, plastic: texPlastic, glass: (s, q) => texGlass(s, q, false), acrylic: (s, q) => texGlass(s, q, true), carbon: texCarbon, tolex: texTolex, stone: texStone, rubber: texRubber, glow: texGlow, pearl: texPearl, concrete: texConcrete };

// ------------------------------------------------------------------ defs
const texCache = new Map(); // tex key -> texture
const fillCache = new Map(); // def key -> result
let host = null;
function defsHost() {
  if (host && host.isConnected) return host;
  host = document.getElementById('globalDefs');
  if (!host) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', 0);
    s.setAttribute('height', 0);
    s.style.position = 'absolute';
    host = document.createElementNS(SVGNS, 'defs');
    host.id = 'globalDefs';
    s.appendChild(host);
    document.body.appendChild(s);
  }
  return host;
}
function mk(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const keyOf = (s) => [s.m, s.s, s.f, String(s.c || '').replace('#', '')].join('-').replace(/[^a-z0-9-]/gi, '');
const num = (v) => String(Math.round(v * 1000) / 1000).replace('.', 'p').replace('-', 'm');

// shared sheen gradients (objectBoundingBox): one per sheen kind and shape
const SHEENS = {
  gloss: [[0, '#fff', 0.34], [0.12, '#fff', 0.12], [0.45, '#fff', 0.02], [0.5, '#000', 0.02], [0.85, '#000', 0.12], [1, '#000', 0.3]],
  satin: [[0, '#fff', 0.2], [0.4, '#fff', 0.03], [0.6, '#000', 0.04], [1, '#000', 0.24]],
  matte: [[0, '#fff', 0.08], [0.5, '#fff', 0], [1, '#000', 0.2]],
  mirror: [[0, '#fff', 0.55], [0.18, '#000', 0.12], [0.36, '#fff', 0.4], [0.58, '#000', 0.22], [0.8, '#fff', 0.25], [1, '#000', 0.3]],
  glass: [[0, '#fff', 0.5], [0.08, '#fff', 0.1], [0.42, '#fff', 0], [0.46, '#fff', 0.22], [0.52, '#fff', 0], [1, '#000', 0.12]],
  metal: [[0, '#fff', 0.24], [0.3, '#fff', 0.04], [0.55, '#000', 0.06], [0.75, '#fff', 0.08], [1, '#000', 0.26]],
};
function sheenId(kind, round) {
  const id = `mt-sh-${kind}${round ? '-r' : ''}`;
  if (!document.getElementById(id)) {
    const stops = SHEENS[kind];
    const g = round ? mk('radialGradient', { id, cx: 0.38, cy: 0.3, r: 0.8, fx: 0.32, fy: 0.24 }, defsHost()) : mk('linearGradient', { id, x1: 0, y1: 0, x2: kind === 'mirror' || kind === 'glass' ? 0.6 : 0.15, y2: 1 }, defsHost());
    for (const [o, c, a] of stops) mk('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  }
  return `url(#${id})`;
}
function sheenKind(s) {
  if (s.m === 'metal') return s.f === 'polished' ? 'mirror' : s.f === 'powder' || s.f === 'sandblasted' || s.f === 'patina' ? 'matte' : s.f === 'flake' ? 'gloss' : 'metal';
  if (s.m === 'wood') return s.f === 'poly' ? 'gloss' : s.f === 'nitro' || s.f === 'satin' ? 'satin' : 'matte';
  if (s.m === 'plastic') return s.f === 'gloss' || s.f === 'sparkle' ? 'gloss' : s.f === 'soft' ? 'matte' : 'satin';
  if (s.m === 'glass' || s.m === 'acrylic') return s.f === 'mirror' ? 'mirror' : s.f === 'frosted' ? 'satin' : 'glass';
  if (s.m === 'carbon') return s.f === 'matte' ? 'satin' : 'gloss';
  if (s.m === 'stone') return s.f === 'polished' ? 'gloss' : 'matte';
  if (s.m === 'pearl') return s.f === 'polished' ? 'gloss' : 'satin';
  if (s.m === 'concrete') return s.f === 'polished' ? 'satin' : 'matte';
  if (s.m === 'glow') return 'satin';
  return 'matte';
}
// a radial "burst" overlay (sunburst stains)
function burstId(col) {
  const id = 'mt-burst-' + col.replace('#', '');
  if (!document.getElementById(id)) {
    const g = mk('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.72 }, defsHost());
    for (const [o, a] of [[0, 0], [0.45, 0], [0.78, 0.55], [1, 0.92]]) mk('stop', { offset: o, 'stop-color': col, 'stop-opacity': a }, g);
  }
  return `url(#${id})`;
}
// concentric machining rings for round metal parts
function spunId() {
  const id = 'mt-spun';
  if (!document.getElementById(id)) {
    const g = mk('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5 }, defsHost());
    for (let i = 0; i <= 24; i++) mk('stop', { offset: i / 24, 'stop-color': i % 2 ? '#000' : '#fff', 'stop-opacity': i % 2 ? 0.07 : 0.1 }, g);
  }
  return 'url(#mt-spun)';
}

/**
 * Fill info for a spec. opts: scale (tile size multiplier, 1 = board pixels), angle (grain rotation in degrees),
 * round (part is round: radial sheen, spun metal), preview (small, quick tile).
 * Returns { fill, sheen, sheenOpacity, overlay, base, hi, lo, edge, ink, glow, translucent, spec }.
 */
export function materialFill(spec, opts = {}) {
  const s = normalize(spec);
  if (s.m === 'stock') return null;
  const scale = opts.scale || 1, angle = opts.angle || 0, q = opts.preview ? 0.5 : 1;
  const id = `mt-${keyOf(s)}-${num(scale)}-${num(angle)}${q < 1 ? '-q' : ''}`;
  const ck = id + (opts.round ? '-r' : '');
  if (fillCache.has(ck) && document.getElementById(id)) return fillCache.get(ck);
  const tk = keyOf(s) + (q < 1 ? '-q' : '');
  let tex = texCache.get(tk);
  if (!tex) {
    tex = TEX[s.m](s, q);
    texCache.set(tk, tex);
  }
  if (!document.getElementById(id)) {
    const w = tex.w * scale, h = tex.h * scale;
    const p = mk('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }, defsHost());
    if (angle) p.setAttribute('patternTransform', `rotate(${angle})`);
    mk('image', { href: tex.url, width: w, height: h, preserveAspectRatio: 'none' }, p);
  }
  const base = rgb(tex.base);
  const kind = sheenKind(s);
  const out = {
    spec: s,
    fill: `url(#${id})`,
    sheen: sheenId(kind, opts.round),
    sheenOpacity: kind === 'matte' ? 0.8 : 1,
    overlay: null,
    base: tex.base,
    hi: hexOf(mix(base, [255, 255, 255], 0.45)),
    lo: hexOf(mul(base, 0.55)),
    edge: hexOf(mul(base, 0.35)),
    ink: lumOf(base) > 0.5 ? '#141414' : '#f2f2f2',
    glow: s.m === 'glow' && s.f === 'glowing' ? colorHex(s) : null,
    translucent: !!tex.alpha,
  };
  if (s.m === 'wood' && s.f === 'stained' && BURSTS[s.c]) out.overlay = burstId(BURSTS[s.c]);
  if (opts.round && s.m === 'metal' && ['brushed', 'polished', 'anodized', 'bare'].includes(s.f)) out.overlay = spunId();
  fillCache.set(ck, out);
  return out;
}

/**
 * Draw a shape in a material: glow halo, base texture, optional overlay, sheen and a thin edge.
 * tag/attrs describe the shape (rect, circle, path...). Returns the <g> and the fill info.
 */
export function paint(parent, tag, attrs, spec, opts = {}) {
  const f = materialFill(spec, opts);
  const g = mk('g', {}, parent);
  if (!f) return { g, f };
  if (f.glow && opts.glow !== false) {
    const gw = opts.glowWidth || 6;
    mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: f.glow, 'stroke-width': gw * 2, 'stroke-opacity': 0.12, 'stroke-linejoin': 'round' }), g);
    mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: f.glow, 'stroke-width': gw, 'stroke-opacity': 0.22, 'stroke-linejoin': 'round' }), g);
  }
  mk(tag, Object.assign({}, attrs, { fill: f.fill }), g);
  if (f.overlay) mk(tag, Object.assign({}, attrs, { fill: f.overlay }), g);
  if (opts.sheen !== false) mk(tag, Object.assign({}, attrs, { fill: f.sheen, opacity: f.sheenOpacity * (opts.sheenOpacity ?? 1) }), g);
  if (opts.edge !== false) mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: f.translucent ? 'rgba(255,255,255,0.55)' : f.hi, 'stroke-width': opts.edgeWidth || 0.8, 'stroke-opacity': f.translucent ? 0.8 : 0.45 }), g);
  return { g, f };
}

/** A small swatch (circle) for pickers: an <svg> element drawn with the material. */
export function swatchSVG(spec, size = 28, o = {}) {
  const s = mk('svg', { viewBox: '0 0 28 28', width: size, height: size, class: 'mt-sw' });
  if (normalize(spec).m === 'stock') {
    mk('circle', { cx: 14, cy: 14, r: 12, fill: 'url(#g-knobBlack)' }, s);
    mk('path', { d: 'M14 4V12', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' }, s);
    return s;
  }
  paint(s, 'circle', { cx: 14, cy: 14, r: 12 }, spec, { scale: o.scale || 0.35, round: true, preview: true, glowWidth: 2, edgeWidth: 0.8 });
  return s;
}
