// Raster thumbnails: draws a block's enclosure once, serialises it to a stand-alone SVG (with the gradients /
// patterns it references copied in), rasterises it to a small PNG and caches it. Lists then show <img> elements –
// one paint item each instead of hundreds of live SVG nodes, which is what made scrolling the block list and the
// presets tab expensive.
import { renderForm } from './forms.js';
import { portsFor, defaultVariant } from '../catalog/index.js';
import { SVGNS } from '../util.js';

const mem = new Map(); // key -> dataURL
// ---- persistent cache (IndexedDB): thumbnails survive restarts, so lists and preset cards appear instantly
let dbP = null;
function db() {
  if (!dbP)
    dbP = new Promise((res) => {
      try {
        const r = indexedDB.open('tz-thumbs', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('t');
        r.onsuccess = () => {
          // one generation of thumbnails at a time: wipe the store when the app version (or dev session) changes
          const d = r.result, gen = VER + '|' + (window.__tzAppVersion || '');
          try {
            const st = d.transaction('t', 'readwrite').objectStore('t');
            const q = st.get('__gen');
            q.onsuccess = () => {
              if (q.result !== gen) { st.clear(); st.put(gen, '__gen'); }
              res(d);
            };
            q.onerror = () => res(d);
          } catch {
            res(d);
          }
        };
        r.onerror = () => res(null);
      } catch {
        res(null);
      }
    });
  return dbP;
}
export async function cacheGet(key) {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const q = d.transaction('t').objectStore('t').get(key);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
export async function cacheSet(key, val) {
  const d = await db();
  if (!d) return;
  try { d.transaction('t', 'readwrite').objectStore('t').put(val, key); } catch {}
}
const VER = '5'; // bump to invalidate every cached thumbnail
const waiting = new Map(); // key -> Promise
const queue = [];
let busy = 0;
const PARALLEL = 3;

function collectDefs(str, out = new Map(), depth = 0) {
  if (depth > 6) return out;
  const re = /url\(#([^)"']+)\)|href="#([^"]+)"/g;
  let m;
  while ((m = re.exec(str))) {
    const id = m[1] || m[2];
    if (out.has(id)) continue;
    const node = document.getElementById(id);
    if (!node) continue;
    const html = node.outerHTML;
    out.set(id, html);
    collectDefs(html, out, depth + 1);
  }
  return out;
}

// build the stand-alone SVG text for a block
function svgFor(d) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('xmlns', SVGNS);
  const g = document.createElementNS(SVGNS, 'g');
  s.appendChild(g);
  const rdef = Object.create(d);
  rdef.ports = portsFor(d, defaultVariant(d));
  const res = renderForm({ g, views: new Map(), flip: false, thumb: true }, rdef);
  const top = d.tubesTop ? 46 : 10; // valves stand above the box
  const vb = [-10, -top, res.w + 20, res.h + 10 + top];
  s.setAttribute('viewBox', vb.join(' '));
  let body = new XMLSerializer().serializeToString(g);
  const defs = collectDefs(body);
  return { body, defs, vb };
}

async function rasterise(d, size) {
  const { body, defs, vb } = svgFor(d);
  const fonts = await fontsFor(body);
  const svgText = `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}" font-family="Inter, sans-serif"><style>${fonts}</style><defs>${[...defs.values()].join('')}</defs>${body}</svg>`;
  const w = vb[2], h = vb[3];
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  await img.decode();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sc = (size * dpr) / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * sc));
  c.height = Math.max(1, Math.round(h * sc));
  const cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function pump() {
  while (busy < PARALLEL && queue.length) pumpOne();
}
function pumpOne() {
  busy++;
  const job = queue.shift();
  cacheGet(job.key)
    .then((hit) => hit || rasterise(job.d, job.size).then((url) => (cacheSet(job.key, url), url)))
    .then((url) => { mem.set(job.key, url); job.res(url); })
    .catch((e) => { console.warn('thumb', job.d.id, e); job.res(null); })
    .finally(() => {
      waiting.delete(job.key);
      busy--;
      // keep the UI responsive: one thumbnail per task
      setTimeout(pump, 0);
    });
}

function keyOf(d, size) {
  return [VER, window.__tzAppVersion || '', d.id, size, d.form || '', d.color || '', d.pluginVersion || ''].join('|');
}

/** Cached PNG data URL of a block's look (or null if it can't be drawn). */
export function thumbURL(d, size = 44, priority = false) {
  const key = keyOf(d, size);
  if (mem.has(key)) return Promise.resolve(mem.get(key));
  if (waiting.has(key)) return waiting.get(key);
  const p = new Promise((res) => {
    const job = { key, d, size, res };
    priority ? queue.unshift(job) : queue.push(job);
  });
  waiting.set(key, p);
  pump();
  return p;
}
export function thumbCached(d, size = 44) {
  return mem.get(keyOf(d, size)) || null;
}

/** An <img> that fills itself in when the thumbnail is ready. */
export function thumbImg(d, size = 44, cls = 'thumb-img') {
  const im = document.createElement('img');
  im.className = cls;
  im.alt = '';
  im.draggable = false;
  im.decoding = 'async';
  const cached = thumbCached(d, size);
  if (cached) im.src = cached;
  else thumbURL(d, size).then((u) => u && (im.src = u));
  return im;
}

/** Rasterise an arbitrary SVG element (already styled, using document defs) into a PNG data URL. */
export async function svgElementToURL(svgEl, w, h, scale = 1) {
  let body = new XMLSerializer().serializeToString(svgEl);
  const defs = collectDefs(body);
  if (defs.size) body = body.replace(/<svg([^>]*)>/, `<svg$1><defs>${[...defs.values()].join('')}</defs>`);
  if (!/xmlns=/.test(body.slice(0, 200))) body = body.replace('<svg', `<svg xmlns="${SVGNS}"`);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(body);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

// ------------------------------------------------------------------ embedded fonts
// An SVG drawn as an image can't see the page's @font-face fonts, so the ones a graphic uses are inlined.
const FONT_FILES = {
  Inter: [[400, 'inter-latin-400-normal'], [500, 'inter-latin-500-normal'], [600, 'inter-latin-600-normal'], [700, 'inter-latin-700-normal']],
  'Barlow Condensed': [[500, 'barlow-condensed-latin-500-normal'], [700, 'barlow-condensed-latin-700-normal'], [800, 'barlow-condensed-latin-800-normal']],
  Oswald: [[600, 'oswald-latin-600-normal'], [700, 'oswald-latin-700-normal']],
  'Dancing Script': [[700, 'dancing-script-latin-700-normal']],
  'Share Tech Mono': [[400, 'share-tech-mono-latin-400-normal']],
};
const fontCss = new Map(); // family -> Promise<css>
function familyCss(fam) {
  if (!fontCss.has(fam))
    fontCss.set(fam, Promise.all(FONT_FILES[fam].map(async ([w, f]) => {
      try {
        const buf = await (await fetch(`fonts/${f}.woff2`)).arrayBuffer();
        let bin = '';
        const u8 = new Uint8Array(buf);
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2')}`;
      } catch { return ''; }
    })).then((a) => a.join('')));
  return fontCss.get(fam);
}
// the font families an SVG string refers to (Inter is the default for unstyled text)
export async function fontsFor(svgText) {
  const fams = ['Inter'];
  for (const f of Object.keys(FONT_FILES)) if (f !== 'Inter' && svgText.includes(f)) fams.push(f);
  return (await Promise.all(fams.map(familyCss))).join('');
}

// ------------------------------------------------------------------ live snapshots (board level of detail)
// Draws a block's current graphic (its content group) to a bitmap and returns a blob URL plus the area it covers.
export async function snapshotNode(content, scale) {
  const bb = content.getBBox();
  const pad = 2;
  const x = Math.floor(bb.x - pad), y = Math.floor(bb.y - pad), w = Math.ceil(bb.width + pad * 2), h = Math.ceil(bb.height + pad * 2);
  if (!(w > 0 && h > 0)) return null;
  const body = new XMLSerializer().serializeToString(content);
  const defs = collectDefs(body);
  const fonts = await fontsFor(body);
  const text = `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="Inter, sans-serif"><style>${fonts}</style><defs>${[...defs.values()].join('')}</defs>${body}</svg>`;
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try { await img.decode(); } finally { URL.revokeObjectURL(img.src); }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return blob ? { url: URL.createObjectURL(blob), x, y, w, h } : null;
}
