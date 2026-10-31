// Custom screens on the board: saved factory pedals run their screen scripts here. The board's status tick
// (about 22 per second, only for blocks in view) draws a frame; pointer input comes through screenPointer.
import { registerScreen } from '../screens.js';
import { state, uiParams, setParam, setBypass, engineParamsFor, blockById, markDirty } from '../state.js';
import { getDef } from '../catalog/index.js';
import { ScreenRuntime } from './runtime.js';
import { makeHost } from './host.js';
import { svg } from '../util.js';
import { screenPixels, paletteOf, isCustom, rememberCanvas, rememberDesign } from './surface.js';
import { FileStore, mainBytes, codeSig } from './files.js';

// the files of each block on the board: the design's files with what its scripts wrote on top, saved in the
// block's params (_fs, so with the preset) a moment after the last write. All screens of the block share it.
const stores = new Map(); // blockId -> { store, raw, D }
function parseFs(raw) {
  try {
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (_) {
    return {};
  }
}
export function blockFiles(blockId, B, D) {
  let e = stores.get(blockId);
  if (!e) {
    e = { raw: null, D };
    e.store = new FileStore({
      base: () => (e.D && e.D.files) || null,
      fixed: () => mainBytes(e.D),
      save: (over) => {
        if (!blockById(blockId)) return;
        const js = JSON.stringify(over);
        e.raw = js;
        setParam(blockId, '_fs', js, { silent: true });
        markDirty(true);
      },
    });
    stores.set(blockId, e);
  }
  if (D) e.D = D;
  // a preset load or an undo brings other files
  const raw = (B() && B().params && B().params._fs) || '';
  if (e.raw !== raw) {
    e.raw = raw;
    e.store.dirty = false;
    e.store.setOverlay(parseFs(raw));
  }
  return e.store;
}

const peaks = (a) => (Array.isArray(a) && a.length ? Math.max(0, ...a.slice(0, 2)) : 0);
/** Raw access for a block on the board. */
export function boardIO(blockId, fallback, cid, design) {
  let ui = null, lastSet = 0;
  const B = () => blockById(blockId) || fallback;
  const files = blockFiles(blockId, B, design);
  return {
    mode: 'board',
    cid, // the screen (its own inputs and outputs)
    blockId,
    files,
    get block() {
      return B();
    },
    get def() {
      return getDef(B().type);
    },
    beginFrame() {
      ui = null;
      blockFiles(blockId, B); // picks up files a preset load brought
    },
    get(p) {
      if (!ui) ui = uiParams(B());
      return ui[p];
    },
    // one undo step per burst of changes; every change still goes to the engine and the panel
    set(p, v) {
      const now = performance.now();
      setParam(blockId, p, v, { silent: now - lastSet < 700 });
      lastSet = now;
      ui = null;
    },
    bypassed: () => !!B().bypass,
    taps: () => (state.ui[blockId] && state.ui[blockId].taps) || 0,
    presetSerial: () => state.presetSerial || 0,
    setBypass: (on) => setBypass(blockId, on),
    levels: () => ({ inPk: peaks(state.status && state.status.inPeak), outPk: peaks(state.status && state.status.outPeak) }),
    blockStatus: () => (state.status && state.status.blocks && state.status.blocks[blockId]) || null,
    params: () => engineParamsFor(B()),
    storeGet() {
      try {
        return JSON.parse(B().params['_ss.' + cid] || 'null');
      } catch (_) {
        return null;
      }
    },
    storeSet: (o) => setParam(blockId, '_ss.' + cid, JSON.stringify(o), { silent: true }),
  };
}

// runtimes survive a redraw of the block (same block, same screen, same code)
const running = new Map(); // blockId|cid -> entry
let kbTarget = null;
let installed = false;
function install() {
  if (installed) return;
  installed = true;
  registerScreen('script', IMPL);
  window.addEventListener(
    'keydown',
    (e) => {
      const rt = kbTarget;
      if (!rt || !rt.wantsKeys()) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey) return;
      if (rt.key(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (kbTarget && !(e.target && e.target.closest && e.target.closest('.ss-board'))) {
        if (kbTarget.focus) kbTarget.blur(true);
        kbTarget = null;
      }
    },
    true
  );
  // forget runtimes of blocks that are gone
  setInterval(() => {
    for (const [k, ent] of running) {
      if (!(ent.img && ent.img.isConnected) && performance.now() - ent.seen > 20000) {
        ent.rt.stop();
        running.delete(k);
      }
    }
    for (const [id, e] of stores) if (!blockById(id) && ![...running.keys()].some((k) => k.startsWith(id + '|'))) {
      e.store.flush();
      stores.delete(id);
    }
  }, 10000);
}
/** The keyboard goes to this runtime until the next click elsewhere. */
export function focusKeys(rt) {
  kbTarget = rt;
}

// On the board a screen is an SVG image of the canvas (not a live canvas in a foreignObject), so the board's
// bitmaps of a block (zoomed out, thumbnails) show the screen too. A new image is made only when the pixels change.
function present(ent, now) {
  if (!ent.img || now - ent.shown < 60) return;
  ent.shown = now;
  let h = 0;
  try {
    const d = new Uint32Array(ent.rt.g.getImageData(0, 0, ent.canvas.width, ent.canvas.height).data.buffer);
    for (let i = 0; i < d.length; i += 1) h = (Math.imul(h, 31) + d[i]) | 0;
  } catch (_) {
    h = now;
  }
  if (h === ent.hash && ent.img.getAttribute('href')) return;
  ent.hash = h;
  try {
    ent.img.setAttribute('href', ent.canvas.toDataURL('image/png'));
  } catch (_) {
    /* keep the last image */
  }
}
// Big screens are drawn at a lower resolution while they're small on screen: full detail when the mouse is over
// one or the board is zoomed past 140%, and less the further out you zoom. Small screens always run at full size.
const LOD_MIN_PX = 160 * 100; // screens with fewer canvas pixels than this are cheap enough as they are
const LOD_STEPS = [1, 0.75, 0.55, 0.4, 0.3, 0.22, 0.16, 0.12];
export function screenScale(ent, boardW, hovered) {
  if (ent.W * ent.H < LOD_MIN_PX || hovered) return 1;
  const z = (window.__tz && window.__tz.editor && window.__tz.editor.view && window.__tz.editor.view.z) || 1;
  if (Math.round(z * 100) > 140) return 1;
  // about as many backing pixels as the screen covers on the display, a bit under so it's always a saving
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const want = (0.8 * boardW * z * dpr) / ent.W; // boardW is in board units, which are CSS pixels at 100%
  return LOD_STEPS.find((k) => k <= want) || LOD_STEPS[LOD_STEPS.length - 1];
}
function applyScale(s, ent) {
  const k = screenScale(ent, s.ctl.w, !!(s.view.g && s.view.g._hover));
  if (k === ent.rt.k) return;
  // going down waits a little (zooming through levels shouldn't resize every frame); going up is instant
  const now = performance.now();
  if (k < ent.rt.k && now - (ent.scaleAt || 0) < 400) return;
  ent.scaleAt = now;
  if (ent.rt.setScale(k)) ent.shown = 0;
}
const IMPL = {
  override: true,
  build(s, g, w, h, nv) {
    const c = s.ctl.src;
    const { W, H } = screenPixels(c);
    const key = nv.block.id + '|' + c.id;
    let ent = running.get(key);
    const sig = codeSig(c, s.ctl.design);
    if (!ent || ent.src !== sig || ent.W !== W || ent.H !== H || ent.type !== c.type) {
      const canvas = document.createElement('canvas');
      const host = makeHost(s.ctl.design, boardIO(nv.block.id, nv.block, c.id, s.ctl.design));
      const rt = new ScreenRuntime({ src: c.script || '', w: W, h: H, host, canvas, readBack: true, palette: paletteOf(c), screen: { type: c.type, name: c.label || '' } });
      ent = { rt, canvas, src: sig, W, H, type: c.type, last: 0, shown: 0, hash: 0, seen: performance.now() };
      running.set(key, ent);
    }
    ent.seen = performance.now();
    s.ent = ent;
    g.textContent = '';
    ent.img = svg('image', { x: -w / 2, y: -h / 2, width: w, height: h, preserveAspectRatio: 'none', class: 'ss-img' }, g);
    ent.hash = 0;
    rememberCanvas(c.id, ent.canvas, ent.src);
    // first frame now, so the screen never shows blank
    const now = performance.now();
    ent.rt.frame(now);
    ent.shown = 0;
    present(ent, now);
  },
  update(s, st, nv, now) {
    const ent = s.ent;
    if (!ent) return;
    ent.seen = now;
    if (now - ent.last < 38) return;
    ent.last = now;
    applyScale(s, ent);
    ent.rt.frame(now);
    present(ent, now);
  },
  pointer(s, nv, type, pt, e) {
    const ent = s.ent;
    if (!ent || type === 'dbl') return;
    const x = (pt.x / s.ctl.w) * ent.W, y = (pt.y / s.ctl.h) * ent.H;
    if (type === 'down') kbTarget = ent.rt;
    ent.rt.pointer(type, x, y, { dy: e ? e.deltaY : 0 });
    // show the result right away instead of waiting for the next tick
    const now = performance.now();
    ent.rt.frame(now);
    ent.last = now;
    ent.shown = 0;
    present(ent, now);
  },
};

/** Hook for the custom board form: registers a view for each custom screen of design D (S = units per mm). */
export function attachBoardScreens(ctx, D, S) {
  if (!D || !Array.isArray(D.ctls) || !D.ctls.some(isCustom)) return;
  rememberDesign(D);
  if (ctx.thumb || !ctx.views || !ctx.g) return;
  install();
  for (const c of D.ctls) {
    if (!isCustom(c) || c.hidden) continue;
    const grp = [...ctx.g.querySelectorAll('[data-sscreen]')].find((x) => x.dataset.sscreen === c.id);
    if (!grp) continue;
    grp.dataset.ctl = c.id;
    grp.classList.add('ctl', 'ss-board');
    // full resolution while the mouse is over the screen
    grp.addEventListener('pointerenter', () => (grp._hover = true));
    grp.addEventListener('pointerleave', () => (grp._hover = false));
    const ctl = { cid: c.id, t: 'screen', kind: 'script', interactive: true, x: c.x * S, y: c.y * S, w: c.w * S, h: c.h * S, src: c, design: D, label: c.label || '' };
    ctx.views.set(c.id, { ctl, view: { g: grp, content: grp, w: c.w, h: c.h, set() {} } });
  }
}
/** Running board screens (tests). */
export function boardScreens() {
  return [...running.entries()].map(([k, e]) => ({ key: k, error: e.rt.error, frames: e.rt.frameN, connected: !!(e.img && e.img.isConnected), scale: e.rt.k, px: [e.canvas.width, e.canvas.height], W: e.W, H: e.H }));
}
