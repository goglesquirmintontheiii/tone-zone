// Shared material library: a catalogue of materials (with submaterials, finishes and colours) plus SVG fills for them.
// A spec is { m, s, f, c }: material, submaterial, finish and colour (hex or a palette id), plus optional t (opacity of
// glass and acrylic, 0 clear to 1 solid), mc (multicolour) and w (wear). normalize() always returns a valid one. Textures are small seamless tiles drawn once on a canvas and used as <pattern><image> defs in
// #globalDefs, with stable ids derived from the spec, so raster.js can copy them into bitmaps and thumbnails.
// To hide tiling, paint() with a seed shifts the tile per item (variants), some textures add a second alpha layer
// at another period (layer2), and a low-res overlay stretched over a long period adds slow colour drift (macro).
import { SVGNS } from '../util.js';

// ------------------------------------------------------------------ palettes
const P = (list) => list.map(([id, name, hex]) => ({ id, name, hex }));
export const PALETTES = {
  anodize: P([['black', 'Black', '#1d1e22'], ['silver', 'Silver', '#c9ccd1'], ['red', 'Red', '#b3202a'], ['blue', 'Blue', '#1f5fbf'], ['purple', 'Purple', '#5b2b9a'], ['green', 'Green', '#2f7d4a'], ['gold', 'Gold', '#c99a2e'], ['orange', 'Orange', '#d4631f'], ['pink', 'Pink', '#d0508a'], ['teal', 'Teal', '#1c8a8f'], ['bronze', 'Bronze', '#7a5a34'], ['gunmetal', 'Gunmetal', '#3d4249']]),
  powder: P([['black', 'Black', '#1b1c20'], ['white', 'White', '#efede7'], ['cream', 'Cream', '#e7dcc0'], ['red', 'Red', '#c9302c'], ['orange', 'Orange', '#e56b1f'], ['yellow', 'Yellow', '#f2c230'], ['green', 'Green', '#3a9a5b'], ['olive', 'Olive', '#5d6337'], ['teal', 'Teal', '#1f8a8a'], ['blue', 'Blue', '#2b7bd6'], ['navy', 'Navy', '#1f2d55'], ['purple', 'Purple', '#5a3fb0'], ['pink', 'Pink', '#d6487e'], ['grey', 'Grey', '#8d99a8'], ['brown', 'Brown', '#6b4428']]),
  stain: P([['natural', 'Natural', '#ffffff'], ['honey', 'Honey', '#e8b25a'], ['amber', 'Amber', '#d48a2a'], ['cherry', 'Cherry', '#a8342a'], ['mahogany', 'Mahogany', '#7a2e1c'], ['walnut', 'Walnut', '#5a3a22'], ['ebony', 'Ebony black', '#1c1714'], ['grey', 'Weathered grey', '#8f8c86'], ['blue', 'Blue', '#2f5f9e'], ['green', 'Green', '#3d7a4a'], ['red', 'Red', '#b5262b'], ['purple', 'Purple', '#5e3a8a'], ['sunburst', 'Sunburst', '#d9952f'], ['cherryburst', 'Cherry burst', '#b8402e'], ['blueburst', 'Blue burst', '#3b6fb0']]),
  plastic: P([['black', 'Black', '#1c1d21'], ['white', 'White', '#f1f0ec'], ['cream', 'Cream', '#ece2c6'], ['red', 'Red', '#d0312d'], ['orange', 'Orange', '#ee7a22'], ['yellow', 'Yellow', '#f5cb2f'], ['lime', 'Lime', '#8cc63f'], ['green', 'Green', '#2f9a57'], ['teal', 'Teal', '#1fa0a0'], ['blue', 'Blue', '#2f7de0'], ['purple', 'Purple', '#6b45c4'], ['pink', 'Pink', '#e8579a'], ['grey', 'Grey', '#8a9099'], ['brown', 'Brown', '#6e4a2c']]),
  // frosted glass and acrylic: clear frost first, then the tints
  frost: P([['clear', 'Clear', '#eef3f7'], ['aqua', 'Aqua', '#5fc9d6'], ['blue', 'Blue', '#3b78d8'], ['green', 'Green', '#4caf6a'], ['amber', 'Amber', '#e0a23a'], ['red', 'Red', '#d64545'], ['purple', 'Purple', '#8e5bd8'], ['pink', 'Pink', '#e870aa'], ['grey', 'Grey', '#9aa3ad']]),
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
    // grain params: k rings per tile (integer), warp, streak (fibre lines), con (ring contrast), base (overall tone),
    // pore density/length, cath (cathedral arches), figure (flame, quilt, ribbon, stripe), knots, alt (colour drift)
    subs: S([
      ['ebony', 'Ebony', '#4a3c33', '#080606', { mid: '#141010', alt: '#4a3828', k: 30, warp: 0.35, streak: 0.45, con: 0.25, base: 0.12, pore: 0.05, porL: 5, vary: 0.5, streaky: 1, macro: 0.35 }],
      ['rosewood', 'Rosewood', '#8e5638', '#1e0c0a', { mid: '#53281f', alt: '#4c2140', k: 22, warp: 1, streak: 0.6, con: 0.75, pore: 0.22, porL: 7, cath: 0.4, lines: 0.8, vary: 0.6 }],
      ['birch', 'Birch', '#f2e3c4', '#d0b083', { k: 9, warp: 0.7, streak: 0.22, con: 0.28, base: 0.7, pore: 0.07, porL: 4, cath: 0.35, vary: 0.35 }],
      ['plywood', 'Plywood', '#eed6a8', '#bf9762', { k: 5, warp: 1.9, streak: 0.18, con: 0.45, base: 0.66, pore: 0.05, porL: 4, cath: 0.9, knots: 1, ply: true, vary: 0.4 }],
      ['oak', 'Oak', '#dfba84', '#87602f', { k: 14, warp: 1, streak: 0.45, con: 0.6, pore: 0.7, porL: 12, porH: 2, porK: 1.5, ringPorous: true, rays: true, cath: 0.6, vary: 0.45 }],
      ['maple', 'Maple', '#f4e4c2', '#d6b885', { k: 10, warp: 0.5, streak: 0.18, con: 0.25, base: 0.68, pore: 0.05, porL: 3, cath: 0.3, vary: 0.3 }],
      ['flamed', 'Flamed maple', '#f5dca8', '#b0844a', { k: 10, warp: 0.5, streak: 0.18, con: 0.22, base: 0.64, pore: 0.05, porL: 3, cath: 0.2, flame: 1, vary: 0.35 }],
      ['quilted', 'Quilted maple', '#f4dba6', '#a87a42', { k: 10, warp: 0.6, streak: 0.16, con: 0.2, base: 0.62, pore: 0.04, porL: 3, cath: 0.2, quilt: 1, vary: 0.35 }],
      ['walnut', 'Walnut', '#8d6648', '#2e1c12', { mid: '#5a3e2c', alt: '#5a4436', k: 16, warp: 1.1, streak: 0.5, con: 0.6, pore: 0.32, porL: 7, cath: 0.6, vary: 0.7 }],
      ['mahogany', 'Mahogany', '#ad613a', '#552612', { k: 24, warp: 0.4, streak: 0.45, con: 0.35, pore: 0.3, porL: 6, ribbon: 6, vary: 0.4 }],
      ['koa', 'Figured koa', '#d49450', '#5a3014', { alt: '#9a5a26', k: 18, warp: 1.2, streak: 0.4, con: 0.6, pore: 0.16, porL: 6, cath: 0.4, flame: 1.5, chatoy: true, vary: 0.6 }],
      // zebra: dark stripes per tile height, drawn by zebraAt() instead of rings
      ['zebrawood', 'Zebrawood', '#ead8a8', '#2a1a10', { mid: '#c8a66c', k: 6, warp: 0.3, streak: 0.4, con: 0.2, base: 0.7, pore: 0.13, porL: 7, porH: 2, zebra: 14, vary: 0.35, macro: 0.45 }],
      ['ash', 'Ash', '#ead6aa', '#9c7a4a', { k: 8, warp: 1.3, streak: 0.4, con: 0.7, pore: 0.55, porL: 9, porH: 2, porK: 1.3, ringPorous: true, cath: 0.7, vary: 0.35 }],
      ['pine', 'Pine', '#f0d196', '#b4733a', { k: 6, warp: 1.5, streak: 0.2, con: 0.8, sharp: 3, base: 0.66, pore: 0, cath: 0.8, knots: 2, vary: 0.4 }],
      ['bamboo', 'Bamboo', '#e4c682', '#a58040', { k: 40, warp: 0.1, streak: 0.55, con: 0.18, pore: 0.2, porL: 5, nodes: true, vary: 0.3 }],
    ]),
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
    finishes: F([['clear', 'Clear'], ['frosted', 'Frosted', { colors: 'frost' }], ['smoked', 'Smoked'], ['tinted', 'Tinted', { colors: 'tint' }], ['mirror', 'Mirror']]),
    def: { f: 'clear' },
  },
  {
    id: 'acrylic', name: 'Acrylic',
    finishes: F([['clear', 'Clear tint', { colors: 'tint' }], ['opaque', 'Opaque gloss', { colors: 'plastic' }], ['frosted', 'Frosted', { colors: 'frost' }], ['candy', 'Candy glitter', { colors: 'tint' }], ['swirl', 'Marbled', { colors: 'plastic' }]]),
    def: { f: 'clear', c: '#5fc9d6' },
  },
  {
    id: 'carbon', name: 'Carbon fibre',
    finishes: F([['gloss', 'Gloss', { colors: 'carbon' }], ['matte', 'Matte', { colors: 'carbon' }], ['forged', 'Forged', { colors: 'carbon' }], ['flake', 'Flake', { colors: 'carbon' }]]),
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
    // hue: centre of the colour play, spread: how far it shifts, sat/lum of the sheen, iri: how strong it is
    subs: S([['white', 'White pearl', '#f6f3ee', '#b9b3ab', { hue: 200, spread: 260, sat: 0.55, lum: 0.78, iri: 0.42 }], ['abalone', 'Abalone', '#5ab0a6', '#141a3a', { hue: 175, spread: 300, sat: 0.85, lum: 0.5, iri: 0.75, depth: 0.55 }], ['black', 'Black pearl', '#4a4d58', '#101116', { hue: 250, spread: 220, sat: 0.6, lum: 0.4, iri: 0.55, depth: 0.3 }], ['pink', 'Pink pearl', '#f4dade', '#c09aa4', { hue: 335, spread: 160, sat: 0.55, lum: 0.78, iri: 0.42 }], ['gold', 'Gold pearl', '#f4e4bc', '#b89a5a', { hue: 42, spread: 140, sat: 0.55, lum: 0.72, iri: 0.42 }]]),
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

/**
 * How a spec takes colour: 'free' (palette plus any colour), 'palette' (palette only) or 'none' (the material sets
 * it, so picking a colour would mean another material or finish).
 */
export function colorMode(spec) {
  const s = spec && spec.m === 'stock' ? spec : normalize(spec);
  const M = BY_ID.get(s.m);
  const f = M && M.finishes.find((x) => x.id === s.f);
  if (!f || !f.colors) return 'none';
  return f.free === false ? 'palette' : 'free';
}
export const supportsColor = (spec) => colorMode(spec) !== 'none';

// glass and acrylic: default opacity per finish (the look without a t value)
const OPACITY = {
  glass: { clear: 0.16, frosted: 0.62, smoked: 0.6, tinted: 0.42, mirror: 1 },
  acrylic: { clear: 0.5, frosted: 0.75, candy: 0.55, opaque: 1, swirl: 1 },
};
/** True for materials with an adjustable see-through amount (spec.t). */
export const hasOpacity = (spec) => !!(spec && OPACITY[spec.m]);
/** Opacity of a glass or acrylic spec, 0 clear to 1 solid (1 for everything else). */
export function opacityOf(spec) {
  const s = normalize(spec);
  const tab = OPACITY[s.m];
  if (!tab) return 1;
  return s.t != null ? s.t : tab[s.f] ?? 0.4;
}
/** Can you see what's behind or inside it? */
export const seeThrough = (spec) => opacityOf(spec) < 0.95;

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
  if (OPACITY[out.m] && s.t !== '' && s.t != null && Number.isFinite(+s.t)) out.t = Math.round(Math.min(1, Math.max(0, +s.t)) * 100) / 100;
  // multicolour only goes on finishes that take any colour (paints, coatings, stains, tints)
  const fin0 = M.finishes.find((x) => x.id === out.f);
  const mc = pal && fin0.free !== false ? normMulti(s.mc) : null;
  if (mc) out.mc = mc;
  const w = normWear(s.w, out.m);
  if (w) out.w = w;
  return out;
}

// ------------------------------------------------------------------ multicolour
// spec.mc = { mode, stops: [hex...], angle }: fades, bursts, gradients, two-tone, colour shift, rainbow.
// It tints the material: the texture is drawn in a neutral version of the finish (unstained wood, grey coating,
// clear glass) and the colours go over it with multiply, so grain, brushing and flake show through. See-through
// materials get the colours as a normal translucent layer instead, so they stay see-through.
export const MULTI = [
  { id: 'fade', name: 'Fade', min: 2, max: 3, angle: true, def: ['#2b5fd6', '#7a3fc4'] },
  { id: 'burst', name: 'Burst', min: 3, max: 3, def: ['#f2b84a', '#9a4a18', '#1a0c05'] },
  { id: 'linear', name: 'Linear', min: 2, max: 4, angle: true, def: ['#e8a030', '#c9302c'] },
  { id: 'radial', name: 'Radial', min: 2, max: 4, def: ['#f2f2f2', '#2b7bd6'] },
  { id: 'split', name: 'Two-tone', min: 2, max: 2, angle: true, def: ['#f1f0ec', '#c9302c'] },
  { id: 'flip', name: 'Colour shift', min: 2, max: 3, angle: true, def: ['#2fb8a8', '#7a3fc4', '#d6487e'] },
  { id: 'rainbow', name: 'Rainbow', min: 0, max: 0, angle: true, def: [] },
];
export const BURST_PRESETS = [
  ['Sunburst', ['#f2b84a', '#b0501a', '#1e0e06']],
  ['Cherry burst', ['#e05a3a', '#8a1410', '#1a0505']],
  ['Tobacco burst', ['#d9a24a', '#6a3a14', '#140a05']],
  ['Blue burst', ['#9fc4ee', '#2a4f9a', '#0a1430']],
];
function normMulti(mc) {
  if (!mc || typeof mc !== 'object') return null;
  const M = MULTI.find((x) => x.id === mc.mode);
  if (!M) return null;
  let stops = Array.isArray(mc.stops) ? mc.stops.filter(isHex).map((c) => c.toLowerCase()) : [];
  stops = stops.slice(0, M.max);
  for (let i = stops.length; i < M.min; i++) stops.push(M.def[i] || M.def[M.def.length - 1]);
  const angle = Math.round(((+mc.angle || 0) % 360 + 360) % 360);
  return { mode: M.id, stops, angle: M.angle ? angle : 0 };
}
export function multiToString(mc) {
  return mc ? [mc.mode, mc.angle, mc.stops.join(' ')].join('|') : '';
}
export function multiFromString(str) {
  const [mode, angle, stops] = String(str || '').split('|');
  return mode ? { mode, angle: +angle || 0, stops: (stops || '').split(' ').filter(Boolean) } : null;
}
// lift: lightens the stops (stains over wood), less so for dark ones so burst edges stay dark
function multiFill(mc, box, lift = 0) {
  const id = 'mc-' + mc.mode + '-' + mc.angle + '-' + mc.stops.map((c) => c.slice(1)).join('') + (box ? '-' + [box.x, box.y, box.w, box.h].map(num).join('-') : '') + (lift ? '-l' + lift : '');
  if (!document.getElementById(id)) {
    const a = (mc.angle * Math.PI) / 180;
    // box: one gradient across several shapes (a whole pedalboard) in user space
    const X = (u) => (box ? box.x + u * box.w : u), Y = (v) => (box ? box.y + v * box.h : v);
    const units = box ? { gradientUnits: 'userSpaceOnUse' } : {};
    const lin = () => mk('linearGradient', Object.assign({ id, x1: X(0.5 - Math.cos(a) / 2), y1: Y(0.5 - Math.sin(a) / 2), x2: X(0.5 + Math.cos(a) / 2), y2: Y(0.5 + Math.sin(a) / 2) }, units), defsHost());
    const radial = (r) => {
      const gg = mk('radialGradient', Object.assign({ id, cx: X(0.5), cy: Y(0.5), r: box ? r * Math.max(box.w, box.h) : r }, units), defsHost());
      // stretch to the box's aspect, like objectBoundingBox does
      if (box) gg.setAttribute('gradientTransform', `translate(${X(0.5)} ${Y(0.5)}) scale(1 ${box.h / Math.max(box.w, box.h) || 1}) scale(${box.w / Math.max(box.w, box.h) || 1} 1) translate(${-X(0.5)} ${-Y(0.5)})`);
      return gg;
    };
    let g, stops;
    const even = (cs) => cs.map((c, i) => [i / Math.max(1, cs.length - 1), c]);
    switch (mc.mode) {
      case 'burst':
        g = radial(0.62);
        stops = [[0, mc.stops[0]], [0.38, mc.stops[0]], [0.72, mc.stops[1]], [1, mc.stops[2]]];
        break;
      case 'radial':
        g = radial(0.6);
        stops = even(mc.stops);
        break;
      case 'split':
        g = lin();
        stops = [[0, mc.stops[0]], [0.5, mc.stops[0]], [0.5, mc.stops[1]], [1, mc.stops[1]]];
        break;
      case 'flip': {
        g = lin();
        const cs = mc.stops;
        stops = [];
        for (let i = 0; i <= 6; i++) stops.push([i / 6, cs[i % cs.length]]);
        break;
      }
      case 'rainbow':
        g = lin();
        stops = ['#e8403a', '#f08a2a', '#f2d23a', '#4cc25a', '#2f8fe0', '#5a4ad0', '#b04ac8'].map((c, i) => [i / 6, c]);
        break;
      default:
        g = lin();
        stops = even(mc.stops);
    }
    const up = (c) => {
      if (!lift) return c;
      const v = rgb(c), k = lift * Math.min(1, lumOf(v) * 2.5);
      return hexOf([v[0] + k, v[1] + k, v[2] + k]);
    };
    for (const [o, c] of stops) mk('stop', { offset: o, 'stop-color': up(c) }, g);
  }
  return `url(#${id})`;
}

// ------------------------------------------------------------------ wear
// Stackable wear layers drawn over the material, each with an amount 0..1. Stored as spec.w = { scratch: 0.6, ... }.
export const WEAR = [
  { id: 'scratch', name: 'Scratched' },
  { id: 'rust', name: 'Rusted', only: ['metal'] },
  { id: 'chip', name: 'Chipped' },
  { id: 'fade', name: 'Faded' },
  { id: 'relic', name: "Relic'd" },
  { id: 'stain', name: 'Stained' },
  { id: 'dent', name: 'Dented' },
];
export function wearFor(m) {
  return WEAR.filter((x) => !x.only || x.only.includes(m));
}
// older specs had separate light scratch and chip layers: they become the main ones at a low amount
const LEGACY_WEAR = { scratchL: 'scratch', chipL: 'chip' };
function normWear(w, m) {
  if (!w || typeof w !== 'object') return null;
  if (Object.keys(LEGACY_WEAR).some((k) => +w[k] > 0)) {
    w = { ...w };
    for (const [k, to] of Object.entries(LEGACY_WEAR)) {
      const v = +w[k];
      delete w[k];
      if (v > 0) w[to] = Math.max(+w[to] || 0, 0.04 + Math.min(1, v) * 0.22);
    }
  }
  const out = {};
  for (const x of wearFor(m)) {
    const v = +w[x.id];
    if (v > 0) out[x.id] = Math.round(Math.min(1, v) * 100) / 100;
  }
  return Object.keys(out).length ? out : null;
}
export function wearToString(w) {
  return w ? Object.entries(w).map(([k, v]) => k + ':' + v).join(',') : '';
}
export function wearFromString(str) {
  const w = {};
  for (const part of String(str || '').split(',')) {
    const [k, v] = part.split(':');
    if (k && +v > 0) w[k.trim()] = +v;
  }
  return w;
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
  const mcName = s.mc && (MULTI.find((x) => x.id === s.mc.mode) || {}).name;
  return [head, fin && fin.name.toLowerCase(), mcName ? mcName.toLowerCase() : col ? col.name.toLowerCase() : pal ? s.c : ''].filter(Boolean).join(', ');
}

/** Spec from block params with a prefix, e.g. frameMat/frameSub/frameFin/frameCol. */
export function fromParams(p, prefix, fallback) {
  if (!p || !p[prefix + 'Mat']) return normalize(fallback);
  return normalize({ m: p[prefix + 'Mat'], s: p[prefix + 'Sub'], f: p[prefix + 'Fin'], c: p[prefix + 'Col'], t: p[prefix + 'T'], w: wearFromString(p[prefix + 'Wear']), mc: multiFromString(p[prefix + 'Multi']) }, fallback);
}
export function toParams(spec, prefix) {
  const s = normalize(spec);
  return { [prefix + 'Mat']: s.m, [prefix + 'Sub']: s.s, [prefix + 'Fin']: s.f, [prefix + 'Col']: s.c, [prefix + 'T']: s.t != null ? String(s.t) : '', [prefix + 'Wear']: wearToString(s.w), [prefix + 'Multi']: multiToString(s.mc) };
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
    hi = mix(col, [255, 255, 255], 0.14);
    lo = mul(col, 0.82);
  } else if (coated) {
    hi = mix(col, [255, 255, 255], 0.06);
    lo = mul(col, 0.9);
  }
  if (s.f === 'hammered' || s.f === 'hammertone' || s.f === 'patina') return texMetalRich(s, q, sub, lo, hi);
  const W = 256 * q, H = 128 * q;
  const fn = (u, v) => {
    let t = 0.5;
    switch (s.f) {
      case 'brushed':
      case 'anodized': {
        const row = fbm(u, v, 3, 128, 2, 11);
        t = 0.5 + (row - 0.5) * 0.6 + (fbm(u, v, 1, 16, 2, 19) - 0.5) * 0.12 + (hash(u * W | 0, v * H | 0, 3) - 0.5) * 0.08;
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
      case 'powder':
        t = 0.5 + (fbm(u, v, 32, 16, 2, 4) - 0.5) * 0.25 + (hash(u * W | 0, v * H | 0, 6) - 0.5) * 0.08;
        break;
      case 'flake':
        t = 0.5 + (fbm(u, v, 16, 8, 2, 4) - 0.5) * 0.2;
        break;
    }
    let c = mix(lo, hi, Math.max(0, Math.min(1, t)));
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
const wrap1 = (x) => x - Math.round(x);
// Wood: the canvas is 1280 x 256 px drawn over 2560 x 256 units (stretched 2x along the grain, which only lengthens
// pores and streaks), so even the longest rail shows no repeat. A low-res macro overlay adds colour drift on top.
function texWood(s, q) {
  const { sp, light, dark } = woodColor(s);
  // previews (swatches) only show a small patch, so they draw just that patch at full detail
  const pv = q < 1, qq = pv ? 1 : q;
  // zebrawood gets twice the rows so its crisp stripe edges hold up when zoomed in
  const W = pv ? 128 : Math.round(1280 * q), H = pv ? 128 : Math.round(256 * q * (sp.zebra ? 2 : 1));
  const TW = pv ? 256 : 2560, TH = pv ? 128 : 256;
  const Wf = 1280 * qq;
  const sd = seedNum(sp.id) % 9973;
  const mid = sp.mid ? rgb(sp.mid) : mix(dark, light, 0.55);
  const alt = sp.alt ? rgb(sp.alt) : null;
  const ramp = (t) => (t < 0.5 ? mix(dark, mid, Math.max(0, t) * 2) : mix(mid, light, Math.min(1, (t - 0.5) * 2)));
  const stainHex = s.f === 'stained' ? colorHex(s) : null;
  const stain = stainHex ? rgb(stainHex) : null;
  const K = sp.k, base = sp.base ?? 0.6, sharp = sp.sharp || 2.2;
  const ar = 2560 / 256; // u units -> v units
  const knots = [];
  for (let i = 0; i < (sp.knots || 0); i++) knots.push({ u: hash(i, sd, 1), v: 0.15 + hash(i, sd, 2) * 0.7, r: (sp.ply ? 0.025 : 0.045) + hash(i, sd, 3) * 0.03 });
  const px = 1 / q; // canvas px -> units at q = 1
  const porL = Math.max(2, Math.round((sp.porL || 5) * qq));
  const ringAA = Math.min(0.3, (2 * K) / (256 * qq));
  const porK = sp.porK || 1;
  const cols = Math.max(1, Math.floor(W / porL));
  // zebrawood: long, gently wavy dark stripes of uneven width and spacing. Interlocked grain makes neighbours
  // drift together and apart, some stripes taper out, some split into two lines.
  const Z = sp.zebra | 0, zAA = ((Z * 1.3) / H) * (pv ? 0.5 : 1);
  const zEdge = mix(dark, light, 0.42);
  const zebraAt = (u, v) => {
    const wave = (fbm(u, v, 3, 1, 3, sd + 81) - 0.5) * 1.4 + (fbm(u, v, 11, 2, 2, sd + 82) - 0.5) * 0.3;
    const lock = (fbm(u, v, 5, 3, 2, sd + 83) - 0.5) * 0.9;
    const g = Z * v + wave + lock + (fbm(u, v, 1, Z, 2, sd + 84) - 0.5) * 0.7 + (fbm(u, v, 1, 4, 2, sd + 86) - 0.5) * 1.6;
    const fl = Math.floor(g), ri = ((fl % Z) + Z) % Z, p = g - fl;
    const w0 = 0.2 + 0.34 * Math.pow(hash(ri, sd, 6), 1.1);
    const tn = vnoise(u * 6, ri + 0.5, 6, Z, sd + 85);
    const w = (w0 * (0.7 + 0.6 * tn) * smooth(0.0, 0.16, tn + 0.08 * hash(ri, sd, 11))) / 2; // now and then one tapers out
    const c0 = 0.5 + (hash(ri, sd, 7) - 0.5) * 0.3;
    const d = Math.abs(p - c0);
    let band = 1 - smooth(w - zAA, w + zAA, d);
    if (hash(ri, sd, 8) < 0.22 && w0 > 0.25) band *= 0.25 + 0.75 * smooth(w * 0.14, w * 0.14 + zAA * 1.5, d); // split stripe
    const halo = (1 - smooth(w, w + 0.025, d)) * (1 - band);
    // faint narrow lines between the main stripes
    const g3 = g * 3 + 0.5, f3 = Math.floor(g3), i3 = ((f3 % (Z * 3)) + Z * 3) % (Z * 3);
    const minor = (1 - smooth(0.03, 0.03 + zAA * 4, Math.abs(g3 - f3 - 0.5))) * 0.22 * hash(i3, sd, 9) * (1 - band);
    const shim = Math.sin(Math.PI * 2 * (u * 16 + (fbm(u, v, 4, 2, 2, sd + 87) - 0.5) * 3));
    return { band, halo, minor, shim, core: smooth(0, Math.max(0.01, w), w - d), k: 0.8 + 0.4 * hash(ri, sd, 10) };
  };
  const fn = (u, v, x, y) => {
    if (pv) (u *= 0.1), (v *= 0.5);
    // knots: rings bow around them
    let vv = v, kn = 0, kd = 9;
    for (const k of knots) {
      const du = wrap1(u - k.u) * ar, dv = wrap1(v - k.v);
      const d = Math.hypot(du / 1.7, dv) / k.r;
      if (d < kd) kd = d;
      vv += Math.sign(dv) * k.r * 1.3 * Math.exp(-d * d * 0.18);
      kn = Math.max(kn, 1 - smooth(0.75, 1.05, d));
    }
    const wn = fbm(u, vv, 2, 2, 4, sd);
    const wn2 = fbm(u, vv, 6, 3, 3, sd + 7);
    // cathedrals: a bump across the grain whose height rises and falls along it, so rings loop into arches
    const vc = fbm(u, 0.37, 2, 1, 2, sd + 11);
    const env = smooth(0.3, 0.7, fbm(u, 0.71, 6, 1, 3, sd + 12));
    const bump = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (vv - vc));
    let g = K * vv + (sp.cath || 0) * K * 0.3 * env * bump * bump + (wn - 0.5) * sp.warp * 3 + (wn2 - 0.5) * sp.warp * 0.7;
    g += (fbm(u, vv, 1, Math.max(1, K >> 1), 2, sd + 3) - 0.5) * 0.9; // uneven ring widths
    const ri = ((Math.floor(g) % K) + K) % K, p = g - Math.floor(g);
    const rs = 0.55 + 0.9 * hash(ri, sd, 5);
    let ring = Math.pow(p, sharp) * rs * (1 - smooth(1 - ringAA, 1, p)); // soft fall so ring edges don't alias
    const zb = sp.zebra ? zebraAt(u, v) : null;
    if (zb) ring = zb.band;
    let t = base + 0.25 - ring * sp.con * 0.75;
    // fine fibre lines along the grain
    const st = fbm(u, v, 3, 160, 2, sd + 21);
    t += (st - 0.5) * sp.streak * 0.55;
    // slow tone drift
    const cv = fbm(u, v, 3, 2, 3, sd + 31);
    t += (cv - 0.5) * 0.35 * (sp.vary || 0.4);
    if (sp.lines) {
      // dark wandering lines (rosewood)
      const ln = Math.abs(Math.sin(Math.PI * (g * 0.5 + fbm(u, v, 4, 6, 3, sd + 41) * 2)));
      t -= (1 - smooth(0.0, 0.12, ln)) * sp.lines * 0.45;
    }
    if (sp.ribbon) t += Math.sin(Math.PI * 2 * (v * sp.ribbon + (wn - 0.5) * 0.6)) * 0.1;
    if (sp.nodes) {
      const nd = Math.abs(fract(u * 2 + (hash(Math.floor(v * 8), sd, 9) - 0.5) * 0.08) - 0.5);
      if (nd > 0.493) t -= (nd - 0.493) * 50;
      if (Math.abs(fract(v * 8) - 0.5) > 0.49) t -= 0.18; // strip seams
    }
    // pores: short dark dashes, in the early wood for ring porous species
    if (sp.pore) {
      const py = sp.porH ? Math.floor(y / sp.porH) : y;
      const off = Math.floor(hash(py, sd, 11) * porL);
      const xi = (x + off) % W, cell = Math.floor(xi / porL) % cols;
      const dens = sp.pore * (sp.ringPorous ? 0.25 + smooth(0.45, 0.0, p) * 1.4 : 1);
      const h = hash(cell, py, sd + 13);
      if (h < dens * 0.5) {
        const pos = (xi % porL) / porL;
        const len = 0.45 + hash(cell, py, sd + 14) * 0.5;
        if (pos < len) t -= (s.f === 'poly' ? 0.14 : 0.24) * porK * (0.6 + h) * Math.sin((pos / len) * Math.PI);
      }
    }
    if (sp.rays) {
      // ray flecks: small satin lenses along the grain
      const rw = Math.round(36 * qq), rh = Math.max(2, Math.round(5 * qq));
      const row = Math.floor(y / rh), rc = Math.floor((x + hash(row, sd, 15) * rw) / rw);
      if (hash(rc, row, sd + 16) > 0.9) {
        const du = (((x + hash(row, sd, 15) * rw) % rw) / rw - 0.5) * 2, dv = ((y % rh) / rh - 0.5) * 2;
        const lens = 1 - du * du - dv * dv * 0.6;
        if (lens > 0) t += lens * 0.16;
      }
    }
    let c = ramp(t);
    if (zb) {
      // brown feathering at the stripe edges and faint lines between stripes, then the dark stripe itself with
      // the fibres still showing in it
      c = mul(c, 1 + zb.shim * 0.05); // interlocked grain catches the light in soft bands
      c = mix(c, zEdge, Math.min(1, zb.halo * 0.22 + zb.minor));
      const sc = mul(mix(zEdge, dark, 0.7 + 0.3 * zb.core), (0.82 + st * 0.36) * zb.k);
      c = mix(c, sc, zb.band);
    }
    if (alt) c = mix(c, alt, smooth(0.5, 0.8, fbm(u, v, 3, sp.streaky ? 40 : 12, 3, sd + 33)) * (sp.streaky ? 0.75 : 0.35));
    if (sp.flame) {
      // curl: bright and dark bands across the grain, strongest in patches
      const fm = smooth(0.3, 0.7, fbm(u, v, 3, 1, 3, sd + 52));
      const f = Math.sin(Math.PI * 2 * (u * 100 + v * 3 + (fbm(u, v, 4, 2, 3, sd + 51) - 0.5) * 4 + (fbm(u, v, 40, 3, 2, sd + 53) - 0.5) * 0.25));
      const fl = Math.sign(f) * Math.pow(Math.abs(f), 0.8) * (0.55 + 0.45 * fbm(u, v, 60, 4, 2, sd + 54));
      c = mul(c, 1 + fl * 0.12 * sp.flame * (0.15 + 0.85 * fm));
      if (sp.chatoy) c = mix(c, [255, 214, 150], Math.max(0, fl) * 0.12 * fm);
    }
    if (sp.quilt) {
      // quilt: soft billows, lit from one side
      const a1 = Math.PI * 2 * (u * 48 + (fbm(u, v, 6, 3, 3, sd + 61) - 0.5) * 2.5);
      const a2 = Math.PI * 2 * (v * 7 + (fbm(u, v, 6, 3, 3, sd + 62) - 0.5) * 1.6);
      const lit = Math.cos(a1) * Math.sin(a2) * 0.6 + Math.sin(a1) * Math.cos(a2) * 0.4;
      c = mul(c, 1 + lit * 0.2 * sp.quilt * (0.4 + 0.6 * smooth(0.3, 0.65, fbm(u, v, 3, 1, 2, sd + 63))));
    }
    if (kn > 0) {
      // knot core: dark with tight rings and a crack at the rim
      const kr = Math.sin(kd * Math.PI * 6) * 0.5 + 0.5;
      const kc = mix(mul(dark, 0.55), mul(dark, 0.95), kr);
      c = mix(c, kc, kn * 0.9);
      if (kd > 0.9 && kd < 1.0) c = mul(c, 0.7);
    }
    // finishes
    switch (s.f) {
      case 'oil':
        c = mul(mix(c, [c[0] * 1.06, c[1] * 0.98, c[2] * 0.86], 0.6), 0.9);
        break;
      case 'matte': {
        const l = lumOf(c) * 255;
        c = mix(mix(c, [l, l, l], 0.08), [232, 226, 214], 0.05);
        break;
      }
      case 'satin':
        c = mul([c[0] * 1.02, c[1], c[2] * 0.96], 0.97);
        break;
      case 'poly':
        // deep wet look: more contrast and saturation
        c = [255 * Math.pow(c[0] / 255, 1.12) * 1.04, 255 * Math.pow(c[1] / 255, 1.16), 255 * Math.pow(c[2] / 255, 1.24) * 0.95];
        break;
      case 'nitro': {
        // ambered lacquer with fine checking across the grain
        c = mul(mix(c, [c[0] * 1.04, c[1] * 0.95, c[2] * 0.7], 0.75), 0.94);
        const cu = u * 180 + (fbm(u, v, 8, 8, 2, sd + 71) - 0.5) * 1.5;
        const ci = Math.floor(cu);
        if (Math.abs(cu - ci - 0.5) * (Wf / 180) < 0.5 && fbm(u, v, 180, 5, 1, sd + 72) > 0.8 && hash(ci, Math.floor(v * 24), sd + 73) < 0.25) c = mul(c, 0.94);
        break;
      }
      case 'stained': {
        const k = s.c === 'natural' ? 0 : 0.78;
        c = mix(c, [c[0] * stain[0] / 200, c[1] * stain[1] / 200, c[2] * stain[2] / 200], k);
        break;
      }
      case 'burnt': {
        c = mix([22, 16, 13], mul(c, 0.55), Math.max(0, 1 - ring * 1.2) * 0.55);
        if (hash(x, y, 4) > 0.97) c = mix(c, [60, 40, 30], 0.6);
        break;
      }
    }
    return c;
  };
  return { url: tile(W, H, fn), w: TW, h: TH, base: hexOf(ramp(base)), macro: pv ? null : 'wood' };
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
  const tint = s.f === 'smoked' ? [34, 36, 40] : s.f === 'mirror' ? [210, 216, 222] : s.f === 'clear' && !acrylic ? [205, 230, 240] : rgb(colorHex(s));
  // t moves the whole tile's opacity; the texture keeps its small variations around it
  const at = opacityOf(s);
  const W = 128 * q, H = 128 * q;
  const fn = (u, v, x, y) => {
    let c = tint, a = at;
    if (s.f === 'frosted') {
      const n = hash(x, y, 3);
      c = mix(c, [255, 255, 255], 0.08 + n * 0.22);
      a += (n - 0.5) * 0.12;
    } else if (s.f === 'mirror') {
      c = mul(c, 0.8 + fbm(u, v, 2, 2, 3, 8) * 0.4);
    } else if (s.f === 'candy') {
      if (hash(x, y, 12) > 0.94) {
        c = mix(c, [255, 255, 255], 0.6);
        a = Math.max(a, 0.3 + at * 0.65); // glitter stays visible in clear acrylic
      }
    } else if (s.f === 'swirl') {
      const n = fbm(u, v, 3, 3, 4, 44);
      const b = Math.sin((u * 2 + n * 4) * Math.PI * 2);
      c = mix(c, mix(c, [255, 255, 255], 0.65), smooth(0.2, 0.9, b));
    } else if (s.f === 'clear' || s.f === 'tinted' || s.f === 'smoked') a += (fbm(u, v, 2, 2, 2, 5) - 0.5) * 0.06;
    return [c[0], c[1], c[2], Math.max(0, Math.min(1, a)) * 255];
  };
  return { url: tile(W, H, fn, true), w: 128, h: 128, alpha: true, see: at < 0.95, base: hexOf(tint) };
}

function texCarbon(s, q) {
  if (s.f === 'flake') return texCarbonFlake(s, q);
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

// height map -> per-pixel slope (hx, hy), wrapped so the tile stays seamless
function slopes(W, H, h) {
  const sx = new Float32Array(W * H), sy = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      sx[i] = (h[y * W + ((x + 1) % W)] - h[y * W + ((x - 1 + W) % W)]) / 2;
      sy[i] = (h[((y + 1) % H) * W + x] - h[((y - 1 + H) % H) * W + x]) / 2;
    }
  return { sx, sy };
}
// light from the top left: returns diffuse change from flat (about -1..1) and a specular term
const LX = -0.5, LY = -0.62, LZ = 0.6;
function litAt(hx, hy) {
  const n = 1 / Math.hypot(hx, hy, 1);
  const nx = -hx * n, ny = -hy * n, nz = n;
  const ll = Math.hypot(LX, LY, LZ);
  const d = (nx * LX + ny * LY + nz * LZ) / ll - LZ / ll;
  const hl = Math.hypot(LX, LY, LZ + ll);
  const sp = Math.max(0, (nx * LX + ny * LY + nz * (LZ + ll)) / hl);
  return [d, sp];
}
// hammered dimples: a weighted Voronoi of bowls of different sizes (bigger and smaller hammer blows)
function hammerHeight(W, H, cells, sd, depth, info) {
  const nx = cells, ny = Math.max(1, Math.round(cells * H / W));
  const pts = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) pts.push([i + 0.5 + (hash(i, j, sd) - 0.5) * 0.95, j + 0.5 + (hash(i, j, sd + 1) - 0.5) * 0.95, 0.55 + Math.pow(hash(i, j, sd + 2), 1.6) * 1.1]);
  const h = new Float32Array(W * H);
  const cw = W / nx;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fx = (x / W) * nx, fy = (y / H) * ny;
      const xi = Math.floor(fx), yi = Math.floor(fy);
      let e = 99, m = 9, own = 0;
      for (let j = -2; j <= 2; j++)
        for (let i = -2; i <= 2; i++) {
          const ci = xi + i, cj = yi + j;
          const k = (((cj % ny) + ny) % ny) * nx + (((ci % nx) + nx) % nx);
          const p = pts[k];
          const d = Math.hypot(fx - (ci - (((ci % nx) + nx) % nx) + p[0]), fy - (cj - (((cj % ny) + ny) % ny) + p[1]));
          // d^2 / size: every bowl meets its neighbours at about the same steepness, big or small
          const ei = (d * d) / p[2];
          if (ei < e) (e = ei), (m = d / p[2]), (own = k);
        }
      if (info) (info.m[y * W + x] = m), (info.own[y * W + x] = own);
      h[y * W + x] = Math.min(e, 3) * cw * depth + (vnoise(fx * 3, fy * 3, nx * 3, ny * 3, sd + 5) - 0.5) * cw * 0.04;
    }
  return h;
}
const PATINA = {
  warm: { ox: [86, 52, 32], v1: [96, 180, 154], v2: [38, 112, 98], crust: [176, 220, 200] },
  iron: { ox: [52, 40, 34], v1: [112, 62, 34], v2: [66, 38, 24], crust: [176, 96, 44] },
  gold: { ox: [90, 72, 48], v1: [128, 104, 70], v2: [72, 58, 40], crust: [160, 138, 104] },
  grey: { ox: [110, 112, 112], v1: [204, 206, 200], v2: [146, 150, 148], crust: [236, 236, 230] },
};
function patinaOf(sub) {
  return ['copper', 'brass', 'bronze'].includes(sub) ? PATINA.warm : ['steel', 'iron'].includes(sub) ? PATINA.iron : ['gold', 'chrome'].includes(sub) ? PATINA.gold : PATINA.grey;
}
// hammered, hammertone and patina use bigger tiles and a lit height map
function texMetalRich(s, q, sub, lo, hi) {
  const sd = seedNum(s.s + s.f) % 9973;
  if (s.f === 'hammered' || s.f === 'hammertone') {
    const tone = s.f === 'hammertone';
    const W = Math.round((tone ? 512 : 768) * q), H = Math.round(384 * q);
    const hgt = hammerHeight(W, H, tone ? 30 : 22, sd, tone ? 0.18 : 0.3);
    const { sx, sy } = slopes(W, H, hgt);
    const fn = (u, v, x, y) => {
      const i = y * W + x;
      const [d, sp] = litAt(sx[i], sy[i]);
      let t = 0.52 + d * (tone ? 1.3 : 1.7) + (fbm(u, v, 4, 4, 3, sd + 9) - 0.5) * 0.14;
      let c = mix(lo, hi, Math.max(0, Math.min(1, t)));
      c = mix(c, [255, 255, 255], Math.pow(sp, tone ? 40 : 26) * (tone ? 0.35 : 0.7));
      if (tone && hash(x, y, 12) > 0.93) c = mix(c, [255, 255, 255], 0.12 + hash(x, y, 13) * 0.18);
      return c;
    };
    // a second, larger set of blows over about a third of the surface, at another period
    const W2 = Math.round(448 * q), H2 = W2;
    const info = { m: new Float32Array(W2 * H2), own: new Int32Array(W2 * H2) };
    const h2 = hammerHeight(W2, H2, tone ? 16 : 12, sd + 50, tone ? 0.18 : 0.3, info);
    const s2 = slopes(W2, H2, h2);
    const fn2 = (u, v, x, y) => {
      const i = y * W2 + x;
      if (hash(info.own[i], 7, sd) > 0.33) return [0, 0, 0, 0];
      const [d, sp] = litAt(s2.sx[i], s2.sy[i]);
      let c = mix(lo, hi, Math.max(0, Math.min(1, 0.52 + d * (tone ? 1.3 : 1.7))));
      c = mix(c, [255, 255, 255], Math.pow(sp, tone ? 40 : 26) * (tone ? 0.35 : 0.7));
      return [c[0], c[1], c[2], 255 * (1 - smooth(0.45, 0.75, info.m[i]))];
    };
    return { url: tile(W, H, fn), w: tone ? 512 : 768, h: 384, base: hexOf(mix(lo, hi, 0.5)), macro: 'metal', layer2: { url: tile(W2, H2, fn2, true), w: 590, h: 590 } };
  }
  const W = Math.round(512 * q), H = W;
  // patina: darkened metal, layered verdigris blooms that pool in places, tide marks, chalky crust and stray specks
  const P = patinaOf(s.s);
  // extra blooms at another period, so clusters never line up
  const fn2 = (u, v, x, y) => {
    const sd2 = sd + 500;
    const wu = u + (fbm(u, v, 3, 3, 3, sd2 + 2) - 0.5) * 0.25, wv = v + (fbm(u, v, 3, 3, 3, sd2 + 3) - 0.5) * 0.25;
    const th = 0.58 + (fbm(u, v, 2, 2, 3, sd2 + 12) - 0.5) * 0.3;
    const b1 = fbm(wu, wv, 6, 6, 5, sd2 + 4);
    const m1 = Math.pow(smooth(th - 0.03, th + 0.1, b1), 1.3);
    if (m1 <= 0) return [0, 0, 0, 0];
    const pool = smooth(0.5, 0.68, fbm(wu, wv, 14, 14, 4, sd2 + 5));
    let c = mix(P.v1, P.v2, Math.min(1, pool + (fbm(u, v, 16, 16, 2, sd2 + 10) - 0.5) * 0.4));
    c = mix(c, P.crust, smooth(0.6, 0.72, fbm(u, v, 32, 32, 2, sd2 + 6)) * 0.45);
    c = mul(c, 0.94 + hash(x, y, 11) * 0.1);
    return [c[0], c[1], c[2], m1 * 235];
  };
  const fn = (u, v, x, y) => {
    let t = 0.45 + (fbm(u, v, 4, 4, 3, sd) - 0.5) * 0.5;
    let c = mix(lo, hi, Math.max(0, Math.min(1, t)));
    c = mix(c, P.ox, 0.3 + fbm(u, v, 5, 5, 3, sd + 1) * 0.45);
    // mottled oxide: darker and lighter clouds and fine grain
    c = mul(c, 0.7 + fbm(u, v, 12, 12, 3, sd + 13) * 0.6 + (vnoise(u * 48, v * 48, 48, 48, sd + 14) - 0.5) * 0.16);
    const wu = u + (fbm(u, v, 3, 3, 3, sd + 2) - 0.5) * 0.25, wv = v + (fbm(u, v, 3, 3, 3, sd + 3) - 0.5) * 0.25;
    // how much patina an area has drifts slowly, so blooms gather and thin out
    const th = 0.52 + (fbm(u, v, 2, 2, 3, sd + 12) - 0.5) * 0.3;
    const b1 = fbm(wu, wv, 7, 7, 4, sd + 4);
    const m1 = Math.pow(smooth(th - 0.04, th + 0.1, b1), 1.3);
    const tide = smooth(th - 0.07, th - 0.02, b1) * (1 - smooth(th - 0.02, th + 0.03, b1));
    const b2 = fbm(wu, wv, 14, 14, 4, sd + 5);
    const pool = smooth(0.5, 0.68, b2) * m1;
    const crust = smooth(0.58, 0.72, fbm(u, v, 32, 32, 2, sd + 6)) * m1 * (0.6 + hash(x, y, 7) * 0.4);
    const sp = worley(u, v, 40, 40, sd + 8, 0.9);
    const spot = hash(sp.id, 1, sd) < 0.06 * (1 - m1) * smooth(0.4, 0.6, fbm(u, v, 3, 3, 2, sd + 15)) * 2 ? (1 - smooth(0.06, 0.16 + hash(sp.id, 2, sd) * 0.12, sp.d + (fbm(u, v, 64, 64, 1, sd + 9) - 0.5) * 0.2)) * (0.4 + hash(sp.id, 3, sd) * 0.5) : 0;
    c = mul(c, 1 - tide * 0.28);
    const vc = mix(P.v1, P.v2, Math.min(1, pool + (fbm(u, v, 16, 16, 2, sd + 10) - 0.5) * 0.4));
    c = mix(c, vc, Math.max(m1 * 0.92, spot));
    c = mix(c, P.crust, crust * 0.5);
    c = mul(c, 0.92 + hash(x, y, 11) * 0.1 + (fbm(u, v, 24, 24, 3, sd + 16) - 0.5) * 0.2 * m1);
    return c;
  };
  const W2 = Math.round(400 * q);
  return { url: tile(W, H, fn), w: 512, h: 512, base: hexOf(mix(mix(lo, hi, 0.45), P.v1, 0.5)), macro: 'patina', layer2: { url: tile(W2, W2, fn2, true), w: 620, h: 620 } };
}

// forged carbon: chopped tow flakes in every direction, marbled black and grey, with glints under the clear coat
function texCarbonFlake(s, q) {
  const tow = rgb(colorHex(s));
  const N = Math.round(640 * q), k = N / 512; // 640 px over 512 units
  let r = 0;
  const rnd = () => hash(r++, 4242, 99);
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const x = c.getContext('2d');
  x.fillStyle = hexOf(mul(tow, 0.16));
  x.fillRect(0, 0, N, N);
  const lightTow = mix(tow, [255, 255, 255], 0.1);
  // flakes in layers: deeper ones darker, so the stack reads as marbled with depth
  const count = 950;
  for (let i = 0; i < count; i++) {
    const depth = i / count;
    const cx = rnd() * N, cy = rnd() * N, a = rnd() * Math.PI;
    const len = (18 + Math.pow(rnd(), 1.3) * 75) * k, wid = (7 + rnd() * 22) * k;
    const g = rnd();
    const col = mix(mul(tow, 0.12), lightTow, (0.06 + g * 0.7) * (0.7 + depth * 0.3));
    // chopped tow: straight sides, ends cut at an angle, a little ragged
    const L = len / 2, Wd = wid / 2, s1 = (rnd() - 0.5) * wid * 1.4, s2 = (rnd() - 0.5) * wid * 1.4;
    const pts = [[-L + s1, -Wd], [(rnd() - 0.5) * len * 0.3, -Wd - (rnd() - 0.5) * wid * 0.15], [L + s2, -Wd], [L - s2, Wd], [(rnd() - 0.5) * len * 0.3, Wd + (rnd() - 0.5) * wid * 0.15], [-L - s1, Wd]];
    const n = pts.length;
    const lines = [];
    const nl = Math.max(3, Math.round(wid / (1.3 * k)));
    for (let j = 0; j < nl; j++) lines.push([(j / nl - 0.5) * wid * 1.1, rnd()]);
    const reach = len * 0.6;
    const shape = () => {
      x.beginPath();
      pts.forEach(([u, v], j) => (j ? x.lineTo(u, v) : x.moveTo(u, v)));
      x.closePath();
    };
    for (const dx of [-N, 0, N])
      for (const dy of [-N, 0, N]) {
        const px = cx + dx, py = cy + dy;
        if (px < -reach || py < -reach || px > N + reach || py > N + reach) continue;
        x.save();
        x.translate(px, py);
        x.rotate(a);
        x.globalAlpha = 0.7 + rnd() * 0.3;
        shape();
        x.fillStyle = hexOf(col);
        x.fill();
        x.save();
        x.clip();
        x.globalAlpha = 1;
        // tow fibres along the flake
        for (const [ly, k2] of lines) {
          x.strokeStyle = k2 < 0.5 ? `rgba(0,0,0,${0.08 + k2 * 0.16})` : `rgba(255,255,255,${(k2 - 0.5) * 0.12})`;
          x.lineWidth = (0.5 + k2 * 0.6) * k;
          x.beginPath();
          x.moveTo(-len, ly);
          x.lineTo(len, ly + (k2 - 0.5) * 1.5);
          x.stroke();
        }
        x.restore();
        x.strokeStyle = 'rgba(0,0,0,0.3)';
        x.lineWidth = 0.6 * k;
        shape();
        x.stroke();
        x.restore();
      }
  }
  // glints in the clear coat
  for (let i = 0; i < 700; i++) {
    const gx = rnd() * N, gy = rnd() * N, k2 = rnd();
    x.fillStyle = `rgba(255,255,255,${0.15 + k2 * 0.55})`;
    const sz = (k2 > 0.94 ? 1.5 : 0.8) * k;
    x.fillRect(gx, gy, sz, sz);
  }
  return { url: c.toDataURL('image/jpeg', 0.9), w: 512, h: 512, base: hexOf(mul(tow, 0.4)), macro: 'carbon' };
}

// mother of pearl: wavy growth bands in layers, colour play that shifts across the piece, a few dark streaks
function texPearl(s, q) {
  const M = BY_ID.get('pearl');
  const sub = M.subs.find((x) => x.id === s.s) || M.subs[0];
  const a = rgb(sub.light), b = rgb(sub.dark);
  const W = Math.round(384 * q), H = W;
  const sd0 = seedNum(sub.id) % 9973;
  const ab = sub.id === 'abalone';
  const fn = (u, v, x, y, sd = sd0) => {
    const wu = u + (fbm(u, v, 3, 3, 4, sd) - 0.5) * 0.3, wv = v + (fbm(u, v, 3, 3, 4, sd + 1) - 0.5) * 0.3;
    const f1 = fbm(wu, wv, 2, 2, 4, sd + 2);
    const ph = wv * 5 + wu * 2 + f1 * 4;
    const band = 0.5 + 0.5 * Math.sin(Math.PI * 2 * ph);
    const fine = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (ph * 9 + fbm(wu, wv, 6, 6, 2, sd + 3) * 3));
    // a second set of bands at another angle, seen deeper in the shell
    const ph2 = wu * 4 - wv * 3 + fbm(wu, wv, 3, 3, 3, sd + 4) * 3;
    const deep = 0.5 + 0.5 * Math.sin(Math.PI * 2 * ph2);
    const hue = sub.hue + (f1 - 0.5) * sub.spread + Math.sin(Math.PI * 2 * (u + v)) * 35 + band * 50 + deep * 30;
    const tone = band * 0.6 + fine * 0.08 + deep * 0.32;
    let c = mix(b, a, ab ? Math.pow(tone, 1.4) : 0.35 + tone * 0.65);
    const iri = hsl2rgb(hue, sub.sat, sub.lum + (band - 0.5) * 0.12);
    c = mix(c, iri, sub.iri * (0.45 + 0.55 * Math.pow(band * 0.6 + deep * 0.4, 1.3)));
    // depth: darker translucent troughs, bright crests
    c = mul(c, 1 - (sub.depth || 0.2) * 0.5 + (sub.depth || 0.2) * tone);
    c = mix(c, [255, 255, 255], Math.pow(Math.max(0, band * fine), 6) * (ab ? 0.25 : 0.4));
    // natural streaks along the bands
    const st = Math.abs(Math.sin(Math.PI * (ph * 3 + fbm(u, v, 5, 5, 2, sd + 5) * 2)));
    if (st < 0.05) c = mul(c, 1 - (1 - st / 0.05) * 0.28 * smooth(0.5, 0.68, fbm(u, v, 2, 2, 3, sd + 6)));
    return c;
  };
  // a second piece of shell at another period, shown in patches, hides the repeat
  const fn2 = (u, v, x, y) => {
    const c = fn(u, v, x, y, sd0 + 500);
    return [c[0], c[1], c[2], smooth(0.42, 0.62, fbm(u, v, 2, 2, 3, sd0 + 501)) * 255];
  };
  const W2 = Math.round(320 * q);
  return { url: tile(W, H, fn), w: 384, h: 384, base: hexOf(mix(a, b, 0.3)), macro: 'pearl', layer2: { url: tile(W2, W2, fn2, true), w: 530, h: 530 } };
}

// low-res overlays stretched over a long period, so tiles don't line up into an obvious repeat
const MACRO = {
  wood: { W: 128, H: 32, w: 3328, h: 704 },
  metal: { W: 48, H: 48, w: 1100, h: 1100 },
  patina: { W: 64, H: 64, w: 1300, h: 1300 },
  carbon: { W: 48, H: 48, w: 1000, h: 1000 },
  pearl: { W: 64, H: 64, w: 900, h: 900 },
};
function macroTex(kind, s) {
  const k = MACRO[kind];
  const sd = seedNum(kind + s.s) % 9973;
  let fn;
  if (kind === 'wood') {
    const { sp, light, dark } = woodColor(s);
    const d = mul(dark, 0.7), l = mix(light, [255, 236, 200], 0.25), alt = sp.alt ? rgb(sp.alt) : d;
    fn = (u, v) => {
      const n = fbm(u, v, 4, 2, 3, sd) - 0.5;
      const h = fbm(u, v, 3, 3, 2, sd + 1);
      const c = n < 0 ? mix(d, alt, h) : l;
      return [c[0], c[1], c[2], Math.min(1, Math.abs(n) * 2.2) * 0.3 * (sp.macro ?? 1) * 255];
    };
  } else if (kind === 'pearl') {
    const sub = BY_ID.get('pearl').subs.find((x) => x.id === s.s) || {};
    fn = (u, v) => {
      const n = fbm(u, v, 3, 3, 3, sd);
      const c = hsl2rgb((sub.hue || 200) + (n - 0.5) * 420, 0.75, 0.6);
      return [c[0], c[1], c[2], (0.08 + 0.14 * fbm(u, v, 2, 2, 2, sd + 1)) * 255];
    };
  } else if (kind === 'patina') {
    const P = patinaOf(s.s);
    fn = (u, v) => {
      const n = fbm(u, v, 3, 3, 4, sd);
      const c = n > 0.5 ? P.v1 : P.ox;
      return [c[0], c[1], c[2], Math.min(1, Math.abs(n - 0.5) * 2.5) * 0.3 * 255];
    };
  } else {
    fn = (u, v) => {
      const n = fbm(u, v, 3, 3, 3, sd) - 0.5;
      const c = n < 0 ? [0, 0, 0] : [255, 255, 255];
      return [c[0], c[1], c[2], Math.min(1, Math.abs(n) * 2.4) * (kind === 'carbon' ? 0.14 : 0.12) * 255];
    };
  }
  return { url: tile(k.W, k.H, fn, true), w: k.w, h: k.h };
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
const keyOf = (s) => [s.m, s.s, s.f, String(s.c || '').replace('#', '')].join('-').replace(/[^a-z0-9-]/gi, '') + (s.t != null ? '-t' + Math.round(s.t * 100) : '');
const num = (v) => String(Math.round(v * 1000) / 1000).replace('.', 'p').replace('-', 'm');
const num0 = (v) => Math.round(v * 10) / 10;

// shared sheen gradients (objectBoundingBox): one per sheen kind and shape
const SHEENS = {
  gloss: [[0, '#fff', 0.34], [0.12, '#fff', 0.12], [0.45, '#fff', 0.02], [0.5, '#000', 0.02], [0.85, '#000', 0.12], [1, '#000', 0.3]],
  satin: [[0, '#fff', 0.2], [0.4, '#fff', 0.03], [0.6, '#000', 0.04], [1, '#000', 0.24]],
  matte: [[0, '#fff', 0.08], [0.5, '#fff', 0], [1, '#000', 0.2]],
  // nitro lacquer: glossy but softer than poly, with a warm low highlight
  lacquer: [[0, '#fff', 0.26], [0.1, '#fff', 0.1], [0.42, '#fff', 0.02], [0.55, '#000', 0.03], [0.8, '#fff', 0.05], [0.9, '#000', 0.1], [1, '#000', 0.26]],
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
  if (s.m === 'metal') return s.f === 'polished' ? 'mirror' : s.f === 'powder' || s.f === 'sandblasted' || s.f === 'patina' ? 'matte' : s.f === 'flake' || s.f === 'hammertone' ? 'gloss' : 'metal';
  if (s.m === 'wood') return s.f === 'poly' ? 'gloss' : s.f === 'nitro' ? 'lacquer' : s.f === 'satin' ? 'satin' : 'matte';
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
 * round (part is round: radial sheen, spun metal), preview (small, quick tile), variant (1..6: the tile shifted by a
 * seeded offset, so items in the same material don't line up).
 * Returns { fill, macro, sheen, sheenOpacity, overlay, base, hi, lo, edge, ink, glow, translucent, spec }.
 */
export function materialFill(spec, opts = {}) {
  let s = normalize(spec);
  if (s.m === 'stock') return null;
  // under a multicolour layer the finish goes neutral, so the colours read true and only tint it
  const mt = s.mc ? multiTint(s) : null;
  if (mt) s = mt.spec;
  const scale = opts.scale || 1, angle = opts.angle || 0, q = opts.preview ? (s.m === 'wood' ? 0.25 : 0.5) : 1;
  const variant = opts.variant | 0;
  const baseId = `mt-${keyOf(s)}-${num(scale)}-${num(angle)}${q < 1 ? '-q' : ''}`;
  const id = baseId + (variant ? '-v' + variant : '');
  const ck = id + (opts.round ? '-r' : '') + (mt ? '|' + multiToString(mt.mc) : '');
  if (fillCache.has(ck) && document.getElementById(id)) return fillCache.get(ck);
  const tk = keyOf(s) + (q < 1 ? '-q' : '');
  let tex = texCache.get(tk);
  if (!tex) {
    tex = TEX[s.m](s, q);
    texCache.set(tk, tex);
  }
  const rot = angle ? `rotate(${angle})` : '';
  const shift = (n, w, h) => `${rot} translate(${num0(hash(n, 1, 5) * w)} ${num0(hash(n, 2, 5) * h)})`.trim();
  // variants are the same tile shifted (the browser decodes the shared image once)
  if (!document.getElementById(id)) {
    const w = tex.w * scale, h = tex.h * scale;
    const p = mk('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }, defsHost());
    const tf = variant ? shift(variant, w, h) : rot;
    if (tf) p.setAttribute('patternTransform', tf);
    mk('image', { href: tex.url, width: w, height: h, preserveAspectRatio: 'none' }, p);
  }
  let layer2 = null;
  if (tex.layer2) {
    const lid = id + '-l2';
    if (!document.getElementById(lid)) {
      const L = tex.layer2, w = L.w * scale, h = L.h * scale;
      const p = mk('pattern', { id: lid, width: w, height: h, patternUnits: 'userSpaceOnUse', patternTransform: shift(variant + 23, w, h) }, defsHost());
      mk('image', { href: L.url, width: w, height: h, preserveAspectRatio: 'none' }, p);
    }
    layer2 = `url(#${lid})`;
  }
  let macro = null;
  if (tex.macro && !opts.preview) {
    const mkey = tex.macro + '-' + (tex.macro === 'wood' || tex.macro === 'pearl' || tex.macro === 'patina' ? s.s : 'x');
    let mt = texCache.get('macro-' + mkey);
    if (!mt) texCache.set('macro-' + mkey, (mt = macroTex(tex.macro, s)));
    const mid = `mtm-${mkey}-${num(scale)}-${num(angle)}`;
    if (!document.getElementById(mid)) {
      const p = mk('pattern', { id: mid, width: mt.w * scale, height: mt.h * scale, patternUnits: 'userSpaceOnUse' }, defsHost());
      if (angle) p.setAttribute('patternTransform', rot);
      mk('image', { href: mt.url, width: mt.w * scale, height: mt.h * scale, preserveAspectRatio: 'none' }, p);
    }
    macro = `url(#${mid})`;
    if (variant) {
      const vid = mid + '-v' + variant;
      if (!document.getElementById(vid)) {
        const p = mk('pattern', { id: vid, width: mt.w * scale, height: mt.h * scale, patternUnits: 'userSpaceOnUse', patternTransform: shift(variant + 11, mt.w * scale, mt.h * scale) }, defsHost());
        mk('image', { href: mt.url, width: mt.w * scale, height: mt.h * scale, preserveAspectRatio: 'none' }, p);
      }
      macro = `url(#${vid})`;
    }
  }
  const base = rgb(tex.base);
  const kind = sheenKind(s);
  const out = {
    spec: s,
    fill: `url(#${id})`,
    layer2,
    macro,
    sheen: sheenId(kind, opts.round),
    sheenOpacity: kind === 'matte' ? 0.8 : 1,
    overlay: null,
    base: tex.base,
    hi: hexOf(mix(base, [255, 255, 255], 0.45)),
    lo: hexOf(mul(base, 0.55)),
    edge: hexOf(mul(base, 0.35)),
    ink: lumOf(base) > 0.5 ? '#141414' : '#f2f2f2',
    glow: s.m === 'glow' && s.f === 'glowing' ? colorHex(s) : null,
    translucent: !!tex.alpha && tex.see !== false,
    multi: mt,
  };
  if (mt) {
    // colours for edges and ink follow the average multicolour
    const avg = mt.mc.stops.length ? mt.mc.stops.map(rgb).reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]]).map((v) => v / mt.mc.stops.length) : [150, 120, 160];
    const b2 = mt.see ? mix(base, avg, 0.8) : [base[0] * avg[0] / 255, base[1] * avg[1] / 255, base[2] * avg[2] / 255];
    Object.assign(out, { base: hexOf(b2), hi: hexOf(mix(b2, [255, 255, 255], 0.45)), lo: hexOf(mul(b2, 0.55)), edge: hexOf(mul(b2, 0.35)), ink: lumOf(b2) > 0.5 ? '#141414' : '#f2f2f2' });
  }
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
  if (opts.seed && opts.variant == null) opts = { ...opts, variant: 1 + (seedNum(String(opts.seed)) % 6) };
  const f = materialFill(spec, opts);
  const g = mk('g', {}, parent);
  if (!f) return { g, f };
  if (f.glow && opts.glow !== false) {
    const gw = opts.glowWidth || 6;
    mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: f.glow, 'stroke-width': gw * 2, 'stroke-opacity': 0.12, 'stroke-linejoin': 'round' }), g);
    mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: f.glow, 'stroke-width': gw, 'stroke-opacity': 0.22, 'stroke-linejoin': 'round' }), g);
  }
  mk(tag, Object.assign({}, attrs, { fill: f.fill }), g);
  if (f.layer2) mk(tag, Object.assign({}, attrs, { fill: f.layer2 }), g);
  if (f.macro) mk(tag, Object.assign({}, attrs, { fill: f.macro }), g);
  if (f.spec.m === 'wood' && f.spec.s === 'plywood' && tag === 'rect') plyEdge(g, attrs, f.spec);
  if (f.overlay) mk(tag, Object.assign({}, attrs, { fill: f.overlay }), g);
  const ns = normalize(spec);
  if (f.multi) {
    // the texture is already drawn right under it in this group, so multiply only needs an isolated group
    if (!f.multi.see) g.setAttribute('style', 'isolation:isolate');
    multiLayer(g, tag, attrs, ns, opts, f);
  }
  if (opts.sheen !== false) mk(tag, Object.assign({}, attrs, { fill: f.sheen, opacity: f.sheenOpacity * (opts.sheenOpacity ?? 1) }), g);
  if (opts.edge !== false) mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: f.translucent ? 'rgba(255,255,255,0.55)' : f.hi, 'stroke-width': opts.edgeWidth || 0.8, 'stroke-opacity': f.translucent ? 0.8 : 0.45 }), g);
  if (opts.wear !== false && ns.w) wearOverlay(g, tag, attrs, ns, opts);
  return { g, f };
}

// How a multicolour spec is drawn: the neutral spec for the texture, the colours and how they go on
function multiTint(s) {
  const a = OPACITY[s.m] ? opacityOf(s) : 1;
  if (a < 0.95) {
    // see-through: a faint clear base keeps the frost, glitter and sheen, the colours carry most of the opacity
    const a1 = Math.round(a * 30) / 100;
    return { spec: { ...s, c: '#f4f6f8', t: a1 }, mc: s.mc, see: true, alpha: Math.round((1 - (1 - a) / (1 - a1)) * 100) / 100, lift: 0 };
  }
  // wood: unstained grain under a coloured stain, lifted like the single colour stains
  if (s.m === 'wood') return { spec: { ...s, c: 'natural' }, mc: s.mc, see: false, alpha: 1, lift: 56 };
  return { spec: { ...s, c: '#eeeeee' }, mc: s.mc, see: false, alpha: 1, lift: 0 };
}

/**
 * The multicolour layer of a spec over a shape, for callers that draw the texture themselves. It is self
 * contained (the texture is drawn again inside an isolated group when multiply needs a backdrop), so it works
 * inside clipped or isolated groups too. opts must match the ones used for the base fill so the textures line up.
 * own: pass the fill info when the texture is drawn right under it in an isolated group already (paint does).
 */
export function multiLayer(parent, tag, attrs, spec, opts = {}, own = null) {
  const f = own || materialFill(spec, opts);
  if (!f || !f.multi) return null;
  const mt = f.multi;
  const fill = multiFill(mt.mc, opts.box, mt.lift);
  if (mt.see) return mk(tag, Object.assign({}, attrs, { fill, opacity: mt.alpha, 'pointer-events': 'none' }), parent);
  if (own) return mk(tag, Object.assign({}, attrs, { fill, style: 'mix-blend-mode:multiply' }), parent);
  const g = mk('g', { style: 'isolation:isolate', 'pointer-events': 'none' }, parent);
  mk(tag, Object.assign({}, attrs, { fill: f.fill }), g);
  if (f.layer2) mk(tag, Object.assign({}, attrs, { fill: f.layer2 }), g);
  if (f.macro) mk(tag, Object.assign({}, attrs, { fill: f.macro }), g);
  mk(tag, Object.assign({}, attrs, { fill, style: 'mix-blend-mode:multiply' }), g);
  return g;
}

// plywood: the plies show as thin layers just inside the edge
function plyEdge(g, a, s) {
  const w = +a.width, h = +a.height;
  if (!(w > 24 && h > 24)) return;
  const band = Math.min(9, Math.min(w, h) * 0.12);
  const { light, dark } = woodColor(s);
  const n = 7, lw = band / n;
  const x0 = +(a.x || 0), y0 = +(a.y || 0), rx = +(a.rx || 0);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) * lw;
    const c = i % 2 ? mul(dark, 0.78) : mix(light, [255, 245, 220], 0.15);
    mk('rect', { x: x0 + k, y: y0 + k, width: w - k * 2, height: h - k * 2, rx: Math.max(0, rx - k), fill: 'none', stroke: hexOf(c), 'stroke-width': lw * (i % 2 ? 0.55 : 1), 'stroke-opacity': 0.8, 'pointer-events': 'none' }, g);
  }
}

// what shows through chips and worn spots
function bareOf(s) {
  const coated = s.m === 'metal' && ['anodized', 'powder', 'flake', 'hammertone'].includes(s.f);
  if (s.m === 'metal') {
    const sub = BY_ID.get('metal').subs.find((x) => x.id === s.s);
    return { spec: coated ? { m: 'metal', s: s.s, f: 'bare' } : null, hex: coated ? sub.light : sub.dark };
  }
  if (s.m === 'wood') return { spec: { m: 'wood', s: s.s, f: 'matte' }, hex: BY_ID.get('wood').subs.find((x) => x.id === s.s).light };
  const base = rgb(TEXBASE(s));
  const hex = { plastic: hexOf(mix(base, [255, 255, 255], 0.35)), glass: '#f4f8fa', acrylic: '#f4f8fa', carbon: '#6a6d72', tolex: '#3a2a1e', stone: hexOf(mix(base, [255, 255, 255], 0.3)), rubber: hexOf(mix(base, [255, 255, 255], 0.2)), glow: '#f2f4ea', pearl: '#ffffff', concrete: hexOf(mul(base, 0.7)) }[s.m] || '#cccccc';
  return { spec: null, hex };
}
function TEXBASE(s) {
  const pal = paletteFor(s);
  if (pal) return colorHex(s);
  const M = BY_ID.get(s.m);
  const sub = M.subs && M.subs.find((x) => x.id === s.s);
  return sub && sub.light ? sub.light : '#999999';
}
function seedNum(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
// small canvas helpers for wear tiles (drawn three times across the edges so they tile)
function canvasTile(W, fn) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const x = c.getContext('2d');
  fn(x, W);
  return c.toDataURL('image/png');
}
function wrapDraw(x, W, draw) {
  for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) {
    x.save();
    x.translate(dx, dy);
    draw();
    x.restore();
  }
}
const wearTiles = new Map();
function wearTile(kind, amt, bare, seed) {
  const key = [kind, amt, bare, seed].join('|');
  if (wearTiles.has(key)) return wearTiles.get(key);
  let r = 0;
  const rnd = () => hash(r++, seed, 777);
  const W = WEAR_PX[kind] || 256;
  let url;
  if (kind === 'scratch') {
    // from a few faint hairlines to a heavily used surface with deep gouges, clustered where hands and feet go
    const n = Math.round(4 + 520 * Math.pow(amt, 1.7));
    const hot = [];
    for (let i = 0; i < 4; i++) hot.push([rnd() * W, rnd() * W, rnd() * Math.PI]);
    const lines = [];
    for (let i = 0; i < n; i++) {
      const h = hot[Math.floor(rnd() * hot.length)];
      const clustered = amt > 0.25 && rnd() < 0.55;
      const x0 = clustered ? h[0] + (rnd() - 0.5) * W * 0.45 : rnd() * W, y0 = clustered ? h[1] + (rnd() - 0.5) * W * 0.45 : rnd() * W;
      const a = clustered ? h[2] + (rnd() - 0.5) * 0.7 : (rnd() - 0.5) * 1.3 + (rnd() < 0.3 ? 1.57 : 0);
      const len = 8 + rnd() * (22 + 76 * amt), bend = (rnd() - 0.5) * (4 + 10 * amt);
      const deep = amt > 0.45 && rnd() < 0.06 + amt * 0.12;
      lines.push([x0, y0, a, len, bend, rnd(), deep]);
    }
    url = canvasTile(W, (x) => wrapDraw(x, W, () => {
      for (const [x0, y0, a, len, bend, k, deep] of lines) {
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        const mx = (x0 + x1) / 2 - Math.sin(a) * bend, my = (y0 + y1) / 2 + Math.cos(a) * bend;
        const path = (ox, oy) => {
          x.beginPath();
          x.moveTo(x0 + ox, y0 + oy);
          x.quadraticCurveTo(mx + ox, my + oy, x1 + ox, y1 + oy);
        };
        if (deep) {
          // gouge: dark groove with a lit lip
          path(0, 0);
          x.strokeStyle = `rgba(0,0,0,${0.35 + k * 0.25})`;
          x.lineWidth = 1.4 + k * 1.4;
          x.stroke();
          path(0.8, 0.8);
          x.strokeStyle = `rgba(255,255,255,${0.3 + k * 0.25})`;
          x.lineWidth = 0.7;
          x.stroke();
          continue;
        }
        path(0, 0);
        x.strokeStyle = k < 0.22 ? `rgba(0,0,0,${0.16 + amt * 0.22})` : `rgba(255,255,255,${0.3 + amt * 0.1 + k * 0.25})`;
        x.lineWidth = 0.5 + k * (0.35 + amt * 0.85);
        x.stroke();
      }
    }));
  } else if (kind === 'dent') {
    const n = Math.round(4 + amt * 22);
    const dents = [];
    for (let i = 0; i < n; i++) dents.push([rnd() * W, rnd() * W, 3 + rnd() * 9 * (0.6 + amt)]);
    url = canvasTile(W, (x) => wrapDraw(x, W, () => {
      for (const [cx, cy, rr] of dents) {
        let g = x.createRadialGradient(cx - rr * 0.35, cy - rr * 0.35, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(0,0,0,0.45)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(cx, cy, rr, 0, Math.PI * 2);
        x.fill();
        g = x.createRadialGradient(cx + rr * 0.4, cy + rr * 0.4, 0, cx + rr * 0.2, cy + rr * 0.2, rr * 0.8);
        g.addColorStop(0, 'rgba(255,255,255,0.4)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(cx + rr * 0.2, cy + rr * 0.2, rr * 0.8, 0, Math.PI * 2);
        x.fill();
      }
    }));
  } else if (kind === 'stain') {
    const rings = Math.round(1 + amt * 5), blots = Math.round(3 + amt * 14);
    const R = [], B = [];
    for (let i = 0; i < rings; i++) R.push([rnd() * W, rnd() * W, 12 + rnd() * 22, rnd()]);
    for (let i = 0; i < blots; i++) B.push([rnd() * W, rnd() * W, 6 + rnd() * 26, rnd()]);
    url = canvasTile(W, (x) => wrapDraw(x, W, () => {
      for (const [cx, cy, rr, k] of B) {
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, `rgba(40,30,15,${0.18 + k * 0.2})`);
        g.addColorStop(1, 'rgba(40,30,15,0)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(cx, cy, rr, 0, Math.PI * 2);
        x.fill();
      }
      for (const [cx, cy, rr, k] of R) {
        x.strokeStyle = `rgba(60,45,25,${0.35 + k * 0.25})`;
        x.lineWidth = 1.2 + k * 1.6;
        x.beginPath();
        x.arc(cx, cy, rr, k * 6, k * 6 + Math.PI * (1.4 + k * 0.6));
        x.stroke();
      }
    }));
  } else {
    // pixel tiles: rust, chips, relic blotches, fade
    const bc = rgb(bare);
    const sd = seed * 131 + 7;
    const fn = (u, v, px, py) => {
      if (kind === 'rust') {
        // patchy coverage that grows with the amount, flaky scale, pits and drip streaks below the patches
        const F = rustField(W, sd), i = py * W + px;
        const n = F.n[i];
        const th = 0.66 - amt * 0.34;
        let m = smooth(th, th + 0.045, n);
        if (F.spotH[i] < 0.05 + amt * 0.25) m = Math.max(m, 1 - smooth(0.1, 0.2 + amt * 0.15, F.spotD[i]));
        const streak = F.streak[i] * smooth(th - 0.06, th + 0.02, F.above[i]) * (0.3 + amt * 0.5);
        if (m <= 0.01 && streak <= 0.02) return [0, 0, 0, 0];
        const deep = Math.min(1, Math.max(0, (n - 0.4) * 3)); // not tied to the amount, so bands blend
        const flake = F.flake[i];
        let c = mix([186, 96, 40], [86, 36, 16], Math.min(1, deep * 0.8 + flake * 0.35));
        c = mul(c, 0.8 + flake * 0.35 + F.fine[i]);
        if (F.edge[i] && deep > 0.35) c = mul(c, F.edge[i] > 0 ? 1.18 : 0.78); // lifted flake edges
        if (deep > 0.4 && F.pit[i]) c = mul(c, 0.35); // pits
        if (m < streak) return [140, 66, 28, streak * 150];
        return [c[0], c[1], c[2], m * 255 * (0.82 + deep * 0.18)];
      }
      if (kind === 'fade') {
        const n = fbm(u, v, 3, 3, 3, seed % 991);
        return [238, 234, 224, (0.25 + n * 0.5) * 255];
      }
      if (kind === 'relic') {
        const w = worley(u, v, 12, 12, seed % 983, 1);
        const show = hash(w.id, 4, seed % 977) < 0.02 + amt * 0.06;
        const rr = 0.4 + hash(w.id, 5, 3) * 0.2 + (fbm(u, v, 32, 32, 2, 9) - 0.5) * 0.3;
        if (!show || w.d > rr) return [0, 0, 0, 0];
        // rubbed through: soft edges, no broken rim
        const c = mul(bc, 0.9 + hash(px, py, 2) * 0.2);
        return [c[0], c[1], c[2], 255 * Math.min(1, (rr - w.d) / 0.15) * 0.85];
      }
      // chips: a couple of tiny nicks at the low end, big flaked areas at the top
      const edgeN = (fbm(u, v, 40, 40, 2, sd + 9) - 0.5) * 0.35;
      let inside = -1;
      const big = worley(u, v, 9, 9, sd + 10, 1);
      if (hash(big.id, 4, sd) < 0.42 * Math.pow(amt, 1.4)) inside = Math.max(inside, (0.12 + amt * 0.3 + hash(big.id, 5, sd) * 0.22 + edgeN) - big.d);
      const sm = worley(u, v, 24, 24, sd + 11, 1);
      if (hash(sm.id, 4, sd) < 0.01 + 0.3 * amt) inside = Math.max(inside, (0.1 + hash(sm.id, 5, sd) * 0.2 + edgeN) - sm.d);
      if (amt > 0.55) inside = Math.max(inside, (fbm(u, v, 3, 3, 4, sd + 12) + edgeN * 0.3 - (1.18 - amt * 0.5)) * 2);
      if (inside < 0) return [0, 0, 0, 0];
      if (inside < 0.035) return [0, 0, 0, 120]; // dark rim where the finish breaks
      if (inside < 0.06) return [255, 255, 255, 50]; // lit lip of the step
      const c = mul(bc, 0.88 + hash(px, py, 2) * 0.2);
      return [c[0], c[1], c[2], 255];
    };
    url = tile(W, W, fn, true);
  }
  wearTiles.set(key, url);
  return url;
}
const WEAR_PX = { rust: 400, chip: 320, scratch: 384 };
// rust noise per seed, computed once: each amount is then just a threshold over it
const rustFields = new Map();
function rustField(W, sd) {
  const key = W + '|' + sd;
  if (rustFields.has(key)) return rustFields.get(key);
  const N = W * W;
  const F = { n: new Float32Array(N), spotD: new Float32Array(N), spotH: new Float32Array(N), above: new Float32Array(N), streak: new Float32Array(N), flake: new Float32Array(N), fine: new Float32Array(N), edge: new Int8Array(N), pit: new Uint8Array(N) };
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, u = x / W, v = y / W;
      const wu = u + (fbm(u, v, 3, 3, 3, sd) - 0.5) * 0.3, wv = v + (fbm(u, v, 3, 3, 3, sd + 1) - 0.5) * 0.3;
      F.n[i] = fbm(wu, wv, 5, 5, 4, sd + 2) * 0.8 + fbm(u, v, 18, 18, 2, sd + 3) * 0.2;
      const sp = worley(u, v, 34, 34, sd + 4, 0.9);
      F.spotD[i] = sp.d;
      F.spotH[i] = hash(sp.id, 2, sd);
      F.streak[i] = smooth(0.55, 0.8, fbm(u, v, 80, 3, 2, sd + 5));
      const fl = worley(u, v, 30, 30, sd + 6, 1);
      F.flake[i] = hash(fl.id, 3, sd);
      F.fine[i] = (vnoise(u * 64, v * 64, 64, 64, sd + 7) - 0.5) * 0.4 + (hash(x, y, sd + 9) - 0.5) * 0.16; // granular scale
      F.edge[i] = fl.edge < 0.06 && F.flake[i] < 0.35 ? (fl.dx + fl.dy < 0 ? 1 : -1) : 0;
      F.pit[i] = hash(x, y, sd + 8) > 0.985 ? 1 : 0;
    }
  // drips start below rusty areas: coverage a little way up
  const dy = Math.round(W * 0.03);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) F.above[y * W + x] = F.n[((y - dy + W) % W) * W + x];
  rustFields.set(key, F);
  return F;
}
function wearPattern(kind, amt, bare, variant, scale) {
  const id = `mw-${kind}-${num(amt)}-${bare.replace('#', '')}-${variant}-${num(scale)}`;
  if (!document.getElementById(id)) {
    const url = wearTile(kind, amt, bare, 1 + (variant % (kind === 'rust' ? 2 : 4))); // rust noise is costly: two seeds, shifted
    const w = (WEAR_PX[kind] || 256) * scale;
    // rust keeps its drips pointing down; the rest turn too
    const rot = kind === 'rust' ? 0 : variant * 45;
    const p = mk('pattern', { id, width: w, height: w, patternUnits: 'userSpaceOnUse', patternTransform: `translate(${(variant * 37) % 97 * scale} ${(variant * 61) % 89 * scale}) rotate(${rot})` }, defsHost());
    mk('image', { href: url, width: w, height: w, preserveAspectRatio: 'none' }, p);
  }
  return `url(#${id})`;
}
let clipN = 0;
/** Wear layers over a painted shape. opts.seed keeps them the same on every redraw. */
export function wearOverlay(g, tag, attrs, spec, opts = {}) {
  const w = spec.w;
  if (!w) return;
  const scale = (opts.wearScale || opts.scale || 1) * 0.6;
  const variant = seedNum(String(opts.seed || '')) % 8;
  const bare = bareOf(spec);
  const q = (v) => Math.round(v * 10) / 10 || 0.1;
  const qf = (v) => Math.max(0.02, Math.round(v * 50) / 50); // finer steps for scratches and chips
  const layer = (fill, op = 1) => mk(tag, Object.assign({}, attrs, { fill, opacity: op, 'pointer-events': 'none' }), g);
  const size = Math.min(120, tag === 'circle' ? attrs.r * 2 : tag === 'rect' ? Math.min(attrs.width, attrs.height) : opts.size || 20);
  let cid = null;
  const clipped = () => {
    if (!cid) {
      cid = 'mwc' + (++clipN) + '-' + seedNum(String(opts.seed || '')).toString(36);
      const cp = mk('clipPath', { id: cid }, g);
      mk(tag, Object.assign({}, attrs), cp);
    }
    return mk('g', { 'clip-path': `url(#${cid})`, 'pointer-events': 'none' }, g);
  };
  if (w.fade) {
    layer(wearPattern('fade', 1, '#ffffff', variant, scale * 2), w.fade * 0.55);
  }
  if (w.stain) layer(wearPattern('stain', q(w.stain), '#000000', variant, scale), 0.5 + w.stain * 0.5);
  if (w.rust) {
    // two layers with different tile sizes, so the patches never line up into a repeat
    layer(wearPattern('rust', q(w.rust), '#000000', variant, scale), 1);
    layer(wearPattern('rust', q(w.rust * 0.7), '#000000', (variant + 5) % 8, scale * 1.37), 1);
    // rust starts at the edges: bands along the outline, denser towards the edge
    const cg = clipped();
    const ew = size * (0.05 + w.rust * 0.2);
    [[1, 0.12], [0.62, 0.26], [0.32, 0.42]].forEach(([k, more]) => {
      mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: wearPattern('rust', q(Math.min(1, w.rust + more)), '#000000', variant, scale), 'stroke-width': ew * 2 * k, 'stroke-linejoin': 'round' }), cg);
    });
  }
  if (w.relic) {
    // worn through at the edges, plus a few rubbed spots
    const sw = size * (0.03 + w.relic * 0.11);
    const cg = clipped();
    const bf = bare.spec ? materialFill(bare.spec, { scale: opts.scale || 1 }).fill : bare.hex;
    const v = seedNum(String(opts.seed || '') + 'r');
    const k = size / 40 + 0.5;
    // a few dashed strokes with round ends along the edge make an uneven worn band
    [[1, 1], [0.6, 2], [0.32, 3]].forEach(([wf, n]) => {
      const dash = [];
      for (let i = 0; i < 7; i++) dash.push((2 + hash(i, v, n) * 18 * (0.4 + w.relic)) * k, (2 + hash(i, v, n + 9) * 16 * (1.2 - w.relic)) * k);
      mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: bf, 'stroke-width': sw * 2 * wf, 'stroke-dasharray': dash.map((x) => x.toFixed(1)).join(' '), 'stroke-dashoffset': (hash(n, v, 5) * 50 * k).toFixed(1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), cg);
    });
    mk(tag, Object.assign({}, attrs, { fill: 'none', stroke: bf, 'stroke-width': sw * 0.5 }), cg);
    mk(tag, Object.assign({}, attrs, { fill: wearPattern('relic', q(w.relic), bare.hex, variant, scale) }), cg);
  }
  // chips and scratches also get a second layer at another size, so they don't repeat on long shapes
  if (w.chip) {
    layer(wearPattern('chip', qf(w.chip * 0.8), bare.hex, variant, scale), 1);
    layer(wearPattern('chip', qf(w.chip * 0.8), bare.hex, (variant + 3) % 8, scale * 1.41), 1);
  }
  if (w.dent) layer(wearPattern('dent', q(w.dent), '#000000', variant, scale), 0.6 + w.dent * 0.4);
  if (w.scratch) {
    const two = w.scratch > 0.15;
    const op = 0.75 + w.scratch * 0.25;
    layer(wearPattern('scratch', qf(w.scratch * (two ? 0.72 : 1)), '#000000', variant, scale), op);
    if (two) layer(wearPattern('scratch', qf(w.scratch * 0.72), '#000000', (variant + 5) % 8, scale * 1.37), op);
  }
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

// noise helpers and the multicolour fill, shared with the Pedal Factory's pattern layers
export { hash as noiseHash, fbm as noiseFbm, worley as noiseWorley, multiFill };
