// Cheap visual effects. SVG filters (blur, turbulence) get re-rasterised whenever anything near them
// repaints, which pinned GPUs at 100% on busy boards. Everything here is a cached bitmap or a gradient,
// so a blinking LED only repaints a few pixels.
import { svg } from '../util.js';

const cache = new Map();
let defsEl = null;
export function setFxDefs(d) {
  defsEl = d;
}

// tileable noise → data URL (alpha speckle in a single colour)
export function noiseURL(px, rgb, aMin, aMax, smooth = 1, seed = 1) {
  const key = `n${px}|${rgb}|${aMin}|${aMax}|${smooth}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const x = c.getContext('2d');
  const img = x.createImageData(px, px);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const raw = new Float32Array(px * px);
  for (let i = 0; i < raw.length; i++) raw[i] = rnd();
  // wrap-around box smoothing so the tile stays seamless
  let v = raw;
  for (let k = 0; k < smooth; k++) {
    const o = new Float32Array(v.length);
    for (let yy = 0; yy < px; yy++)
      for (let xx = 0; xx < px; xx++) {
        let acc = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) acc += v[((yy + dy + px) % px) * px + ((xx + dx + px) % px)];
        o[yy * px + xx] = acc / 9;
      }
    v = o;
  }
  // re-normalise contrast after smoothing
  let lo = 1, hi = 0;
  for (const q of v) { if (q < lo) lo = q; if (q > hi) hi = q; }
  const [r, g, b] = rgb;
  for (let i = 0; i < v.length; i++) {
    const n = (v[i] - lo) / (hi - lo || 1);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round((aMin + (aMax - aMin) * n) * 255);
  }
  x.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

// pattern element using a noise tile (size in user units)
export function noisePattern(defs, id, units, px, rgb, aMin, aMax, smooth) {
  const p = svg('pattern', { id, width: units, height: units, patternUnits: 'userSpaceOnUse' }, defs);
  svg('image', { href: noiseURL(px, rgb, aMin, aMax, smooth), width: units, height: units, preserveAspectRatio: 'none' }, p);
  return p;
}

// Soft drop shadow as a cached, pre-blurred bitmap (rounded rect or arbitrary path).
export function softShadow(parent, o) {
  const { w, h, rx = 8, blur = 9, opacity = 0.55, dx = 0, dy = 10, path = null, x = 0, y = 0 } = o;
  const pad = Math.ceil(blur * 2.5);
  const scale = 0.5; // blurred → low resolution is invisible
  const key = `s${w}|${h}|${rx}|${blur}|${path || ''}`;
  let url = cache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * scale);
    c.height = Math.ceil((h + pad * 2) * scale);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.filter = `blur(${blur * 0.75}px)`;
    g.fillStyle = '#000';
    g.translate(pad, pad);
    if (path) g.fill(new Path2D(path));
    else {
      g.beginPath();
      g.roundRect(0, 0, w, h, rx);
      g.fill();
    }
    url = c.toDataURL('image/png');
    cache.set(key, url);
  }
  return svg('image', { href: url, x: x + dx - pad, y: y + dy - pad, width: w + pad * 2, height: h + pad * 2, opacity, preserveAspectRatio: 'none', 'pointer-events': 'none' }, parent);
}

// radial "glow" gradient for a colour (replaces gaussian-blur glow filters on LEDs)
export function haloFill(color, strength = 1) {
  const key = `h${color}|${strength}`;
  let id = cache.get(key);
  if (id) return id;
  id = 'h' + cache.size + '_' + String(color).replace(/[^a-z0-9]/gi, '');
  const g = svg('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5 }, defsEl || document.getElementById('globalDefs'));
  for (const [o, a] of [[0, 0.95], [0.25, 0.6], [0.5, 0.22], [0.75, 0.06], [1, 0]]) svg('stop', { offset: o, 'stop-color': color, 'stop-opacity': Math.min(1, a * strength) }, g);
  cache.set(key, `url(#${id})`);
  return cache.get(key);
}

// setAttribute that skips no-op writes (they still invalidate paint in Chromium)
export function setA(el, k, v) {
  const store = el.__a || (el.__a = {});
  const s = v == null ? null : String(v);
  if (store[k] === s) return;
  store[k] = s;
  if (s == null) el.removeAttribute(k);
  else el.setAttribute(k, s);
}
export function setText(el, t) {
  const s = String(t);
  if (el.__t === s) return;
  el.__t = s;
  el.textContent = s;
}
