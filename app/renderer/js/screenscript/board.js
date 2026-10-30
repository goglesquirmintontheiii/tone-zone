// Custom screens on the board: saved factory pedals run their screen scripts here. The board's status tick
// (about 22 per second, only for blocks in view) draws a frame; pointer input comes through screenPointer.
import { registerScreen } from '../screens.js';
import { state, uiParams, setParam, setBypass, engineParamsFor, blockById } from '../state.js';
import { getDef } from '../catalog/index.js';
import { ScreenRuntime } from './runtime.js';
import { makeHost } from './host.js';
import { svg } from '../util.js';
import { screenPixels, paletteOf, isCustom, rememberCanvas, rememberDesign } from './surface.js';

const peaks = (a) => (Array.isArray(a) && a.length ? Math.max(0, ...a.slice(0, 2)) : 0);
/** Raw access for a block on the board. */
export function boardIO(blockId, fallback, cid) {
  let ui = null, lastSet = 0;
  const B = () => blockById(blockId) || fallback;
  return {
    mode: 'board',
    cid, // the screen (its own inputs and outputs)
    get block() {
      return B();
    },
    get def() {
      return getDef(B().type);
    },
    beginFrame() {
      ui = null;
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
    for (const [k, ent] of running) if (!(ent.img && ent.img.isConnected) && performance.now() - ent.seen > 20000) running.delete(k);
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
    const d = new Uint32Array(ent.rt.g.getImageData(0, 0, ent.W, ent.H).data.buffer);
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
const IMPL = {
  override: true,
  build(s, g, w, h, nv) {
    const c = s.ctl.src;
    const { W, H } = screenPixels(c);
    const key = nv.block.id + '|' + c.id;
    let ent = running.get(key);
    if (!ent || ent.src !== (c.script || '') || ent.W !== W || ent.H !== H || ent.type !== c.type) {
      const canvas = document.createElement('canvas');
      const host = makeHost(s.ctl.design, boardIO(nv.block.id, nv.block, c.id));
      const rt = new ScreenRuntime({ src: c.script || '', w: W, h: H, host, canvas, readBack: true, palette: paletteOf(c), screen: { type: c.type, name: c.label || '' } });
      ent = { rt, canvas, src: c.script || '', W, H, type: c.type, last: 0, shown: 0, hash: 0, seen: performance.now() };
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
    const ctl = { cid: c.id, t: 'screen', kind: 'script', interactive: true, x: c.x * S, y: c.y * S, w: c.w * S, h: c.h * S, src: c, design: D, label: c.label || '' };
    ctx.views.set(c.id, { ctl, view: { g: grp, content: grp, w: c.w, h: c.h, set() {} } });
  }
}
/** Running board screens (tests). */
export function boardScreens() {
  return [...running.entries()].map(([k, e]) => ({ key: k, error: e.rt.error, frames: e.rt.frameN, connected: !!(e.img && e.img.isConnected) }));
}
