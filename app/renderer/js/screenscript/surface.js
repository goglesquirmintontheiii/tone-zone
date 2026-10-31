// Custom screens inside a drawn pedal (factory stage, thumbnails, board). The SVG gets the last frame as an
// image (so bitmaps and thumbnails show it) and an empty group where a live canvas can go.
import { svg } from '../util.js';
import { ScreenRuntime, SCREEN_PALETTE } from './runtime.js';
import { makeHost, simIO } from './host.js';
import { codeSig } from './files.js';

export const DEFAULT_RES = 4; // canvas pixels per millimetre
const MAX_W = 480, MAX_H = 320;

/** Canvas size for a screen part. */
export function screenPixels(c) {
  let k = c.res || DEFAULT_RES;
  const w = c.w || 30, h = c.h || 14;
  k = Math.min(k, MAX_W / w, MAX_H / h);
  return { W: Math.max(8, Math.round(w * k)), H: Math.max(8, Math.round(h * k)), k };
}
export const paletteOf = (c) => SCREEN_PALETTE[c.type] || 'oled';
export const isCustom = (c) => c && c.kind === 'screen' && c.shows === 'custom';

// the newest frame of each screen part: a live canvas when one is running, else a rendered still
const live = new Map(); // screen id -> { canvas, src, at }
const stills = new Map(); // key -> dataURL
const designs = new Map(); // screen id -> the design it belongs to (for stills)
export function rememberDesign(D) {
  for (const c of (D && D.ctls) || []) if (isCustom(c)) designs.set(c.id, D);
}
export function rememberCanvas(id, canvas, src) {
  live.set(id, { canvas, src, url: null, at: 0 });
}
function stillFor(c, design) {
  design = design || designs.get(c.id);
  const { W, H } = screenPixels(c);
  const key = c.id + '|' + W + 'x' + H + '|' + (c.type || '') + '|' + codeSig(c, design);
  if (stills.has(key)) return stills.get(key);
  let url = null;
  try {
    const { io } = simIO(design || { ctls: [] }, { readOnly: true, demo: false });
    io.cid = c.id;
    const rt = new ScreenRuntime({ src: c.script || '', w: W, h: H, host: makeHost(design || { ctls: [] }, io), palette: paletteOf(c), screen: { type: c.type, name: c.label || '' } });
    const t = performance.now();
    rt.frame(t);
    rt.frame(t + 50);
    url = rt.canvas.toDataURL('image/png');
  } catch (_) {
    url = null;
  }
  if (stills.size > 60) stills.delete(stills.keys().next().value);
  stills.set(key, url);
  return url;
}
export function frameURL(c, design) {
  const L = live.get(c.id);
  if (L && L.src === codeSig(c, design || designs.get(c.id)) && L.canvas.width) {
    const now = performance.now();
    if (!L.url || now - L.at > 400) {
      try {
        L.url = L.canvas.toDataURL('image/png');
        L.at = now;
      } catch (_) {
        L.url = null;
      }
    }
    if (L.url) return L.url;
  }
  return stillFor(c, design);
}

/** Called by the factory renderer for a screen that shows custom graphics (g is centred on the screen). */
export function drawScriptScreen(g, c, design) {
  const w = c.w, h = c.h;
  const url = frameURL(c, design);
  if (url) svg('image', { x: -w / 2, y: -h / 2, width: w, height: h, href: url, preserveAspectRatio: 'none', 'pointer-events': 'none' }, g);
  svg('g', { class: 'ss-live', 'data-sscreen': c.id }, g);
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: 'url(#g-glass)', opacity: 0.55, 'pointer-events': 'none' }, g);
}

/** Put a live canvas into a screen's group (in millimetres, centred). */
export function mountCanvas(group, canvas, w, h) {
  group.textContent = '';
  const fo = svg('foreignObject', { x: -w / 2, y: -h / 2, width: w, height: h }, group);
  canvas.classList.add('ss-canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  fo.appendChild(canvas);
  return fo;
}
