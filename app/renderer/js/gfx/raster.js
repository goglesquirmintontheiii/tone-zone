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
const VER = '4'; // bump to invalidate every cached thumbnail
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
  const vb = [-10, -10, res.w + 20, res.h + 20];
  s.setAttribute('viewBox', vb.join(' '));
  let body = new XMLSerializer().serializeToString(g);
  const defs = collectDefs(body);
  const css = "<style>text{font-family:'Inter','Barlow Condensed',sans-serif}</style>";
  const svgText = `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}">${css}<defs>${[...defs.values()].join('')}</defs>${body}</svg>`;
  return { svgText, w: vb[2], h: vb[3] };
}

async function rasterise(d, size) {
  const { svgText, w, h } = svgFor(d);
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
