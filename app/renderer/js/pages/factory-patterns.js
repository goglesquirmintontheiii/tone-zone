// Pedal Factory: pattern layers for the enclosure (drawn over the material, under the artwork), plus their inspector.
// Units are millimetres. Raster patterns (camo, marble, galaxy, tie-dye) are drawn once on a canvas and cached.
import { el, svg, clamp } from '../util.js';
import { noiseFbm as fbm, noiseHash as hash } from '../gfx/materials.js';

const r1 = (v) => Math.round(v * 100) / 100;
export const PATTERN_TYPES = [
  ['solid', 'Solid'], ['stripes', 'Striped'], ['checker', 'Checkered'], ['swirl', 'Swirl'], ['fisheye', 'Fisheye'],
  ['dots', 'Polka dots'], ['chevron', 'Chevron'], ['gradient', 'Gradient'], ['camo', 'Camo'], ['marble', 'Marble'],
  ['galaxy', 'Galaxy'], ['tiedye', 'Tie-dye'], ['plaid', 'Plaid'], ['image', 'Custom image'],
];
export const BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['color', 'Colour'], ['difference', 'Difference']];
const SW = ['#111111', '#f4f1e8', '#c9302c', '#e56b1f', '#f2c230', '#3a9a5b', '#1f8a8a', '#2b7bd6', '#5a3fb0', '#d6487e', '#8d99a8', '#ffffff'];

const DEFAULTS = {
  solid: { c1: '#2b7bd6' },
  stripes: { c1: '#f4f1e8', c2: '#c9302c', c3: '#111111', three: false, size: 10, duty: 0.5, angle: 45 },
  checker: { c1: '#111111', c2: '#f4f1e8', size: 8, angle: 0 },
  swirl: { c1: '#f4f1e8', c2: '#c9302c', arms: 6, twist: 1.2, x: 0.5, y: 0.45 },
  fisheye: { c1: '#111111', c2: '#f4f1e8', rays: 16, rings: 8, distort: 1.7, x: 0.5, y: 0.45 },
  dots: { c1: '#f4f1e8', c2: '#c9302c', bg: false, size: 1.6, spacing: 7, angle: 0, stagger: true },
  chevron: { c1: '#f2c230', c2: '#111111', size: 12, thick: 0.5, angle: 0 },
  gradient: { mode: 'linear', c1: '#2b7bd6', c2: '#5a3fb0', c3: '#d6487e', mid: false, angle: 90, x: 0.5, y: 0.5 },
  camo: { c1: '#4b5320', c2: '#7a6a45', c3: '#2f3a22', c4: '#1d1f17', scale: 1, seed: 3 },
  marble: { c1: '#efece6', c2: '#3a3d45', scale: 1, turb: 0.6, seed: 5 },
  galaxy: { c1: '#060818', c2: '#6a3fd0', c3: '#d6487e', stars: 0.5, scale: 1, seed: 7 },
  tiedye: { c1: '#e8403a', c2: '#f2c230', c3: '#2b7bd6', twist: 0.5, x: 0.5, y: 0.5, seed: 2 },
  plaid: { c1: '#8e1f22', c2: '#1d2a4a', c3: '#f2c230', size: 22, angle: 0 },
  image: { img: '', fit: 'cover', scale: 1, x: 0.5, y: 0.5, rot: 0 },
};
export function newPattern(type) {
  return Object.assign({ id: 'p' + Math.random().toString(36).slice(2, 8), type, on: true, opacity: type === 'solid' ? 1 : 0.9, blend: 'normal' }, JSON.parse(JSON.stringify(DEFAULTS[type] || {})));
}

// ------------------------------------------------------------------ custom images (kept out of the undo history)
const IMG_STORE = 'tz.factory.images.v1';
let images = null;
function loadImages() {
  if (images) return images;
  try { images = JSON.parse(localStorage.getItem(IMG_STORE) || '{}') || {}; } catch (_) { images = {}; }
  return images;
}
function saveImages() {
  try { localStorage.setItem(IMG_STORE, JSON.stringify(images)); } catch (_) { /* full or unavailable */ }
}
export function imageFor(id) {
  return loadImages()[id] || null;
}
// drop images no design or undo step refers to
export function pruneImages(keepIds) {
  loadImages();
  let n = 0;
  for (const k of Object.keys(images)) if (!keepIds.has(k)) { delete images[k]; n++; }
  if (n) saveImages();
}
/** Pick an image file, downscale it (max 640 px) and store it. Resolves to the image id or null. */
export function pickImage() {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return res(null);
      const rd = new FileReader();
      rd.onload = () => {
        const im = new Image();
        im.onload = () => res(storeImage(im));
        im.onerror = () => res(null);
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
    inp.click();
  });
}
export function storeImage(im) {
  const k = Math.min(1, 640 / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((im.naturalWidth || im.width) * k));
  c.height = Math.max(1, Math.round((im.naturalHeight || im.height) * k));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  let url = c.toDataURL('image/webp', 0.85);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
  const id = 'img' + Math.random().toString(36).slice(2, 9);
  loadImages()[id] = { url, w: c.width, h: c.height };
  saveImages();
  return id;
}

// ------------------------------------------------------------------ raster patterns
const rasterCache = new Map();
function raster(L, W, H) {
  const key = JSON.stringify([L.type, L.c1, L.c2, L.c3, L.c4, L.scale, L.seed, L.turb, L.stars, L.twist, L.x, L.y, r1(W), r1(H)]);
  if (rasterCache.has(key)) return rasterCache.get(key);
  const k = Math.min(4, 420 / Math.max(W, H));
  const cw = Math.max(8, Math.round(W * k)), ch = Math.max(8, Math.round(H * k));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const cx = c.getContext('2d');
  const img = cx.createImageData(cw, ch);
  const d = img.data;
  const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const C = [L.c1, L.c2, L.c3, L.c4].map((v) => hx(/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#808080'));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sc = Math.max(0.2, L.scale || 1);
  const seed = (L.seed | 0) + 1;
  // noise lattice: about one cell per 10 mm at scale 1
  const fx = Math.max(1, Math.round(W / (10 * sc))), fy = Math.max(1, Math.round(H / (10 * sc)));
  let p = 0;
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const u = x / cw, v = y / ch;
      let col;
      if (L.type === 'camo') {
        const n = fbm(u, v, fx, fy, 4, seed * 13);
        col = n < 0.43 ? C[0] : n < 0.5 ? C[1] : n < 0.57 ? C[2] : C[3];
      } else if (L.type === 'marble') {
        const w = fbm(u, v, fx, fy, 3, seed * 7) * (L.turb ?? 0.6);
        const n = fbm(u + w * 0.3, v + w * 0.3, Math.max(1, fx >> 1), Math.max(1, fy >> 1), 5, seed * 11);
        const vein = Math.pow(1 - Math.abs(n * 2 - 1), 12);
        const vein2 = Math.pow(1 - Math.abs(fbm(u, v, fx, fy, 4, seed * 3) * 2 - 1), 22) * 0.5;
        col = mix(C[0], C[1], Math.min(1, vein + vein2));
      } else if (L.type === 'galaxy') {
        const w = fbm(u, v, fx, fy, 3, seed * 5);
        const n1 = fbm(u + w * 0.4, v, fx, fy, 5, seed * 17), n2 = fbm(u, v + w * 0.4, fx, fy, 5, seed * 19);
        col = mix(C[0], C[1], Math.pow(Math.max(0, n1 - 0.35) * 1.7, 2));
        col = mix(col, C[2], Math.pow(Math.max(0, n2 - 0.42) * 1.9, 2));
        const h = hash(x, y, seed);
        if (h > 1 - (L.stars ?? 0.5) * 0.012) col = mix(col, [255, 255, 255], 0.5 + hash(x, y, seed + 1) * 0.5);
      } else {
        // tie-dye: spiral bands from the centre, wobbling with noise
        const dx = (u - (L.x ?? 0.5)) * W, dy = (v - (L.y ?? 0.5)) * H;
        const r = Math.hypot(dx, dy) / Math.max(W, H);
        const a = Math.atan2(dy, dx) / (Math.PI * 2);
        const n = fbm(u, v, fx, fy, 3, seed * 23);
        let t = a * 3 + r * (L.twist ?? 0.5) * 12 + n * 1.2;
        t = ((t % 3) + 3) % 3;
        const i = Math.floor(t), f = t - i;
        col = mix(C[i], C[(i + 1) % 3], f < 0.7 ? 0 : (f - 0.7) / 0.3);
        if (f > 0.62 && f < 0.75) col = mix(col, [255, 255, 255], 0.35 * (1 - Math.abs(f - 0.685) / 0.065));
      }
      d[p] = col[0];
      d[p + 1] = col[1];
      d[p + 2] = col[2];
      d[p + 3] = 255;
      p += 4;
    }
  cx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  if (rasterCache.size > 40) rasterCache.delete(rasterCache.keys().next().value);
  rasterCache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ renderer
/** Draw the enabled pattern layers into g (already clipped to the body). pre: unique id prefix for local defs. */
export function renderPatterns(g, defs, pre, list, W, H) {
  (list || []).forEach((L, li) => {
    if (!L.on) return;
    const lg = svg('g', { opacity: L.opacity ?? 1, style: L.blend && L.blend !== 'normal' ? `mix-blend-mode:${L.blend}` : undefined, 'data-pattern': L.id }, g);
    const id = `${pre}pt${li}`;
    const pat = (w, h, angle, cx = W / 2, cy = H / 2) => svg('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse', patternTransform: angle ? `rotate(${angle} ${cx} ${cy})` : undefined }, defs);
    const fillRect = (fill) => svg('rect', { x: -2, y: -2, width: W + 4, height: H + 4, fill }, lg);
    const R = Math.hypot(W, H);
    switch (L.type) {
      case 'solid':
        fillRect(L.c1);
        break;
      case 'stripes': {
        const s = Math.max(1, L.size || 10);
        const p = pat(s, 10, L.angle);
        if (L.three) {
          svg('rect', { width: s / 3 + 0.01, height: 10, fill: L.c1 }, p);
          svg('rect', { x: s / 3, width: s / 3 + 0.01, height: 10, fill: L.c2 }, p);
          svg('rect', { x: (s * 2) / 3, width: s / 3, height: 10, fill: L.c3 }, p);
        } else {
          svg('rect', { width: s, height: 10, fill: L.c2 }, p);
          svg('rect', { width: s * clamp(L.duty ?? 0.5, 0.05, 0.95), height: 10, fill: L.c1 }, p);
        }
        fillRect(`url(#${id})`);
        break;
      }
      case 'checker': {
        const s = Math.max(1, L.size || 8);
        const p = pat(s * 2, s * 2, L.angle);
        svg('rect', { width: s * 2, height: s * 2, fill: L.c2 }, p);
        svg('path', { d: `M0 0H${s}V${s}H0ZM${s} ${s}H${s * 2}V${s * 2}H${s}Z`, fill: L.c1 }, p);
        fillRect(`url(#${id})`);
        break;
      }
      case 'swirl': {
        fillRect(L.c2);
        const cx = (L.x ?? 0.5) * W, cy = (L.y ?? 0.5) * H, n = Math.max(1, L.arms | 0), tw = (L.twist ?? 1) * Math.PI * 2;
        let d = '';
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
          const pts = [];
          for (let i = 0; i <= 40; i++) { const r = (i / 40) * R; const a = a0 + tw * (i / 40); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
          for (let i = 40; i >= 0; i--) { const r = (i / 40) * R; const a = a1 + tw * (i / 40); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
          d += 'M' + pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join('L') + 'Z';
        }
        svg('path', { d, fill: L.c1 }, lg);
        break;
      }
      case 'fisheye': {
        fillRect(L.c2);
        const cx = (L.x ?? 0.5) * W, cy = (L.y ?? 0.5) * H, nr = Math.max(2, L.rays | 0), ng = Math.max(1, L.rings | 0), k = L.distort ?? 1.6;
        const rad = (j) => R * Math.pow(j / ng, k);
        let d = '';
        for (let j = 0; j < ng; j++)
          for (let i = 0; i < nr; i++) {
            if ((i + j) % 2) continue;
            const a0 = (i / nr) * Math.PI * 2, a1 = ((i + 1) / nr) * Math.PI * 2, ra = rad(j), rb = rad(j + 1);
            const pts = [];
            for (let s = 0; s <= 4; s++) { const a = a0 + ((a1 - a0) * s) / 4; pts.push([cx + Math.cos(a) * rb, cy + Math.sin(a) * rb]); }
            for (let s = 4; s >= 0; s--) { const a = a0 + ((a1 - a0) * s) / 4; pts.push([cx + Math.cos(a) * ra, cy + Math.sin(a) * ra]); }
            d += 'M' + pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join('L') + 'Z';
          }
        svg('path', { d, fill: L.c1 }, lg);
        break;
      }
      case 'dots': {
        const s = Math.max(1, L.spacing || 7), r = Math.min(s / 2, L.size || 1.6);
        const p = pat(s, s, L.angle);
        if (L.bg) svg('rect', { width: s, height: s, fill: L.c2 }, p);
        svg('circle', { cx: s / 2, cy: s / 2, r, fill: L.c1 }, p);
        if (L.stagger) for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) svg('circle', { cx: x, cy: y, r, fill: L.c1 }, p);
        fillRect(`url(#${id})`);
        break;
      }
      case 'chevron': {
        const s = Math.max(2, L.size || 12), t = (s / 2) * clamp(L.thick ?? 0.5, 0.1, 1);
        const p = pat(s, s, L.angle);
        svg('rect', { width: s, height: s, fill: L.c2 }, p);
        const band = (o) => `M0 ${o}L${s / 2} ${o + s / 2}L${s} ${o}L${s} ${o + t}L${s / 2} ${o + s / 2 + t}L0 ${o + t}Z`;
        svg('path', { d: band(0) + band(-s) + band(s), fill: L.c1 }, p);
        fillRect(`url(#${id})`);
        break;
      }
      case 'gradient': {
        const a = ((L.angle || 0) * Math.PI) / 180;
        const gr = L.mode === 'radial'
          ? svg('radialGradient', { id, cx: L.x ?? 0.5, cy: L.y ?? 0.5, r: 0.75 }, defs)
          : svg('linearGradient', { id, x1: 0.5 - Math.cos(a) / 2, y1: 0.5 - Math.sin(a) / 2, x2: 0.5 + Math.cos(a) / 2, y2: 0.5 + Math.sin(a) / 2 }, defs);
        const stops = L.mid ? [L.c1, L.c2, L.c3] : [L.c1, L.c2];
        stops.forEach((c, i) => svg('stop', { offset: i / (stops.length - 1), 'stop-color': c }, gr));
        fillRect(`url(#${id})`);
        break;
      }
      case 'plaid': {
        const s = Math.max(4, L.size || 22);
        const p = pat(s, s, L.angle);
        svg('rect', { width: s, height: s, fill: L.c1 }, p);
        svg('rect', { y: s * 0.35, width: s, height: s * 0.3, fill: L.c2, opacity: 0.6 }, p);
        svg('rect', { x: s * 0.35, width: s * 0.3, height: s, fill: L.c2, opacity: 0.6 }, p);
        const lw = s * 0.035;
        svg('path', { d: `M0 ${s * 0.15}H${s}M0 ${s * 0.85}H${s}M${s * 0.15} 0V${s}M${s * 0.85} 0V${s}`, stroke: L.c3, 'stroke-width': lw, opacity: 0.85 }, p);
        svg('path', { d: `M0 ${s * 0.5}H${s}M${s * 0.5} 0V${s}`, stroke: '#000', 'stroke-width': lw * 0.6, opacity: 0.35 }, p);
        fillRect(`url(#${id})`);
        break;
      }
      case 'image': {
        const im = imageFor(L.img);
        if (!im) break;
        const ar = im.w / im.h;
        let w = W, h = H;
        if (L.fit === 'cover') { if (W / H > ar) h = W / ar; else w = H * ar; }
        else if (L.fit === 'contain') { if (W / H > ar) w = H * ar; else h = W / ar; }
        else if (L.fit === 'tile') { w = Math.min(W, H) * 0.5; h = w / ar; }
        const sc = L.scale || 1;
        if (L.fit === 'tile') {
          const p = svg('pattern', { id, width: w * sc, height: h * sc, patternUnits: 'userSpaceOnUse', patternTransform: `translate(${(L.x ?? 0.5) * W} ${(L.y ?? 0.5) * H}) rotate(${L.rot || 0})` }, defs);
          svg('image', { href: im.url, width: w * sc, height: h * sc, preserveAspectRatio: 'none' }, p);
          fillRect(`url(#${id})`);
        } else {
          const t = `translate(${r1((L.x ?? 0.5) * W)} ${r1((L.y ?? 0.5) * H)}) rotate(${L.rot || 0}) scale(${sc})`;
          svg('image', { href: im.url, x: -w / 2, y: -h / 2, width: w, height: h, preserveAspectRatio: 'none', transform: t }, lg);
        }
        break;
      }
      default:
        svg('image', { href: raster(L, W, H), x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' }, lg);
    }
  });
}

// ------------------------------------------------------------------ inspector
// H: form helpers from factory.js { sec, row, slider, colors, seg, selectField, check, changed, rerender }
let openLayer = null;
export function patternInspector(host, E, H) {
  const list = (E.patterns = E.patterns || []);
  const s = H.sec(host, 'Patterns');
  s.classList.add('fz-patterns');
  const add = el('div', { class: 'fz-pat-add' }, s);
  const sel = el('select', { class: 'fz-pat-type', title: 'Add a pattern layer' }, add);
  el('option', { value: '' }, sel).textContent = 'Add a pattern...';
  for (const [k, n] of PATTERN_TYPES) el('option', { value: k }, sel).textContent = n;
  sel.onchange = async () => {
    const t = sel.value;
    if (!t) return;
    const L = newPattern(t);
    if (t === 'image') {
      const id = await pickImage();
      if (!id) { sel.value = ''; return; }
      L.img = id;
    }
    list.push(L);
    openLayer = L.id;
    H.changed(false);
    H.rerender();
  };
  if (!list.length) el('p', { class: 'fz-note' }, s).textContent = 'Layers go over the material and under the artwork. Stack as many as you like.';
  [...list].reverse().forEach((L) => {
    const i = list.indexOf(L);
    const card = el('div', { class: 'fz-pat' + (openLayer === L.id ? ' open' : '') + (L.on ? '' : ' off'), 'data-pattern-layer': L.id }, s);
    const hd = el('div', { class: 'fz-pat-head' }, card);
    el('i', { class: 'fz-pat-sw', style: { background: L.type === 'image' ? 'var(--bg4)' : `linear-gradient(135deg, ${L.c1 || '#888'} 50%, ${L.c2 || L.c1 || '#888'} 50%)` } }, hd);
    el('b', {}, hd).textContent = (PATTERN_TYPES.find((p) => p[0] === L.type) || [0, L.type])[1];
    const btn = (title, icon, fn, cls = '') => el('button', { class: 'fz-lbtn ' + cls, title, onclick: (e) => { e.stopPropagation(); fn(); } }, hd, `<i class="ic ${icon}"></i>`);
    btn(L.on ? 'Hide' : 'Show', 'fz-ic-eye', () => { L.on = !L.on; H.changed(false); H.rerender(); }, L.on ? '' : 'off');
    btn('Move up', 'fz-ic-up', () => { if (i < list.length - 1) { [list[i], list[i + 1]] = [list[i + 1], list[i]]; H.changed(false); H.rerender(); } });
    btn('Move down', 'ic-down', () => { if (i > 0) { [list[i], list[i - 1]] = [list[i - 1], list[i]]; H.changed(false); H.rerender(); } });
    btn('Remove', 'ic-x', () => { list.splice(i, 1); H.changed(false); H.rerender(); });
    hd.onclick = () => { openLayer = openLayer === L.id ? null : L.id; H.rerender(); };
    if (openLayer !== L.id) return;
    const b = el('div', { class: 'fz-pat-body' }, card);
    layerControls(b, L, H);
    H.slider(b, 'Opacity', L.opacity ?? 1, 0, 1, 0.05, (v) => (L.opacity = v));
    H.selectField(b, 'Blend', BLENDS, L.blend || 'normal', (v) => (L.blend = v));
  });
  H.slider(s, 'Finish shows', E.showThrough ?? 0.3, 0, 1, 0.05, (v) => (E.showThrough = v));
}

function layerControls(b, L, H) {
  const C = (label, k) => H.colors(b, label, L[k], SW, (v) => (L[k] = v), 'pat-' + k);
  const S = (label, k, min, max, step) => H.slider(b, label, L[k] ?? DEFAULTS[L.type][k], min, max, step, (v) => (L[k] = v));
  switch (L.type) {
    case 'solid':
      C('Colour', 'c1');
      break;
    case 'stripes':
      C('Colour 1', 'c1'); C('Colour 2', 'c2');
      H.check(b, 'Three colours', L.three, (v) => (L.three = v), true);
      if (L.three) C('Colour 3', 'c3');
      else S('Width', 'duty', 0.05, 0.95, 0.05);
      S('Size', 'size', 1, 60, 0.5); S('Angle', 'angle', -90, 90, 1);
      break;
    case 'checker':
      C('Colour 1', 'c1'); C('Colour 2', 'c2'); S('Size', 'size', 1, 40, 0.5); S('Angle', 'angle', -90, 90, 1);
      break;
    case 'swirl':
      C('Arms', 'c1'); C('Between', 'c2'); S('Arms', 'arms', 1, 24, 1); S('Twist', 'twist', -4, 4, 0.05); S('Centre X', 'x', 0, 1, 0.01); S('Centre Y', 'y', 0, 1, 0.01);
      break;
    case 'fisheye':
      C('Colour 1', 'c1'); C('Colour 2', 'c2'); S('Rays', 'rays', 4, 48, 2); S('Rings', 'rings', 1, 24, 1); S('Distortion', 'distort', 0.4, 3, 0.05); S('Centre X', 'x', 0, 1, 0.01); S('Centre Y', 'y', 0, 1, 0.01);
      break;
    case 'dots':
      C('Dots', 'c1'); H.check(b, 'Background', L.bg, (v) => (L.bg = v), true);
      if (L.bg) C('Background', 'c2');
      S('Dot size', 'size', 0.3, 15, 0.1); S('Spacing', 'spacing', 2, 40, 0.5); S('Angle', 'angle', -90, 90, 1);
      H.check(b, 'Staggered', L.stagger, (v) => (L.stagger = v));
      break;
    case 'chevron':
      C('Colour 1', 'c1'); C('Colour 2', 'c2'); S('Size', 'size', 2, 60, 0.5); S('Thickness', 'thick', 0.1, 1, 0.05); S('Angle', 'angle', -90, 90, 1);
      break;
    case 'gradient':
      H.seg(b, 'Type', [['linear', 'Linear'], ['radial', 'Radial']], L.mode, (v) => (L.mode = v));
      C('From', 'c1'); C('To', 'c2');
      H.check(b, 'Middle colour', L.mid, (v) => (L.mid = v), true);
      if (L.mid) C('Middle', 'c3');
      if (L.mode === 'radial') { S('Centre X', 'x', 0, 1, 0.01); S('Centre Y', 'y', 0, 1, 0.01); } else S('Angle', 'angle', 0, 360, 5);
      break;
    case 'camo':
      C('Colour 1', 'c1'); C('Colour 2', 'c2'); C('Colour 3', 'c3'); C('Colour 4', 'c4'); S('Scale', 'scale', 0.3, 4, 0.05); S('Variation', 'seed', 0, 50, 1);
      break;
    case 'marble':
      C('Stone', 'c1'); C('Veins', 'c2'); S('Scale', 'scale', 0.3, 4, 0.05); S('Turbulence', 'turb', 0, 2, 0.05); S('Variation', 'seed', 0, 50, 1);
      break;
    case 'galaxy':
      C('Space', 'c1'); C('Nebula', 'c2'); C('Nebula 2', 'c3'); S('Stars', 'stars', 0, 1, 0.05); S('Scale', 'scale', 0.3, 4, 0.05); S('Variation', 'seed', 0, 50, 1);
      break;
    case 'tiedye':
      C('Colour 1', 'c1'); C('Colour 2', 'c2'); C('Colour 3', 'c3'); S('Twist', 'twist', -2, 2, 0.05); S('Centre X', 'x', 0, 1, 0.01); S('Centre Y', 'y', 0, 1, 0.01); S('Variation', 'seed', 0, 50, 1);
      break;
    case 'plaid':
      C('Base', 'c1'); C('Bands', 'c2'); C('Lines', 'c3'); S('Size', 'size', 4, 80, 1); S('Angle', 'angle', -90, 90, 1);
      break;
    case 'image': {
      const r = H.row(b, 'Image');
      el('button', { class: 'btn small', onclick: async () => { const id = await pickImage(); if (id) { L.img = id; H.changed(false); H.rerender(); } } }, r, imageFor(L.img) ? 'Replace...' : 'Choose...');
      H.seg(b, 'Fit', [['cover', 'Cover'], ['contain', 'Fit'], ['stretch', 'Stretch'], ['tile', 'Tile']], L.fit, (v) => (L.fit = v));
      S('Scale', 'scale', 0.1, 4, 0.05); S('Position X', 'x', -0.5, 1.5, 0.01); S('Position Y', 'y', -0.5, 1.5, 0.01); S('Rotation', 'rot', -180, 180, 1);
      break;
    }
  }
}
