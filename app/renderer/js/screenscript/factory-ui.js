// Pedal Factory side of screen scripts: the "Shows" choice in the screen inspector, and live custom screens
// on the factory stage (a still preview while designing, playable in test mode).
import { el } from '../util.js';
import { ScreenRuntime } from './runtime.js';
import { makeHost, simIO } from './host.js';
import { screenPixels, paletteOf, isCustom, mountCanvas, rememberCanvas, rememberDesign, DEFAULT_RES } from './surface.js';
import { TEMPLATES, DEFAULT_SCRIPT } from './templates.js';
import { controlList } from './host.js';
import { state, engineParamsFor } from '../state.js';
import { getDef } from '../catalog/index.js';
import { testInfo, playSet, playSetParam, testing, NODE } from '../pages/factory-play.js';
import { TEST_ID } from '../catalog/custom.js';
import { designToDef } from '../pages/factory-circuit.js';
import { openScreenEditor, screenEditor } from './screen-editor.js';
import { openGenerator, generatorOpen } from './gen-ui.js';
import { generate, STYLES } from './generator.js';

let cssDone = false;
export function loadCSS() {
  if (cssDone) return;
  cssDone = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../../css/screenscript.css', import.meta.url).href;
  document.head.appendChild(l);
}

// a hidden input that takes typing for a screen (so the factory's own shortcuts leave it alone)
let trap = null, trapRt = null;
export function keysTo(rt) {
  if (!trap) {
    trap = el('input', { class: 'ss-keytrap', type: 'text', 'aria-label': 'Screen keyboard input', tabindex: '-1' }, document.body);
    trap.addEventListener('keydown', (e) => {
      if (!trapRt) return;
      if ((e.ctrlKey || e.metaKey) && e.key !== 'Backspace') return;
      if (trapRt.key(e)) e.preventDefault();
      e.stopPropagation();
    });
    trap.addEventListener('input', () => (trap.value = ''));
  }
  trapRt = rt;
  trap.focus({ preventScroll: true });
}

export const optsFor = (D) => ({ title: (D && D.name) || 'PEDAL', controls: controlList(D) });

// the values the circuit would run with, for a simulated pedal
export function paramsFor(D) {
  const def = designToDef(D, { id: 'custom.__ssim', hidden: true });
  return (ui) => Object.assign({}, def.fixed || {}, def.derive ? def.derive(ui) : {});
}
// the code panel and the generator, writing into the design through the factory's helpers
function openers(H, getD) {
  const orig = new Map();
  const setCode = (id, code, final) => {
    const c = (getD().ctls || []).find((x) => x.id === id);
    if (!c) return;
    if (!orig.has(id)) orig.set(id, c.script || '');
    if (c.script !== code) {
      c.script = code;
      if (!final) H.changed(true);
    }
    if (final) {
      if (orig.get(id) !== c.script) H.changed(false);
      orig.delete(id);
      H.rerender();
    }
  };
  const openGen = (id, onUse) => openGenerator({ getD, id, paramsFor, onUse: onUse || ((code) => setCode(id, code, true)) });
  const openEditor = (id) => openScreenEditor({ getD, id, paramsFor, onCode: (code, final) => setCode(id, code, final), openGen });
  return { openEditor, openGen };
}

// ------------------------------------------------------------------ inspector
/**
 * The screen part's "Shows" section. H = the factory's inspector helpers, getD = current design,
 * openEditor(id) / openGen(id) open the big panels.
 */
export function screenInspector(s, c, H, o = {}) {
  loadCSS();
  const D = o.getD ? o.getD() : null;
  if (o.getD && !o.openEditor) Object.assign(o, openers(H, o.getD));
  H.selectField(s, 'Shows', [['text', 'Basic text'], ['custom', 'Custom']], c.shows === 'custom' ? 'custom' : 'text', (v) => {
    c.shows = v;
    if (v === 'custom' && !c.script) c.script = DEFAULT_SCRIPT(optsFor(D));
  }, true);
  if (c.shows !== 'custom') {
    H.textField(s, 'Text', c.text, (v) => (c.text = v), { multi: true });
    return;
  }
  if (o.multi) {
    el('p', { class: 'fz-note' }, s).textContent = 'Select one screen to edit its code.';
    return;
  }
  const r = H.row(s, 'Code');
  const bar = el('div', { class: 'ss-insp-btns' }, r);
  el('button', { class: 'btn small btn-accent', 'data-ss': 'edit', onclick: () => o.openEditor && o.openEditor(c.id) }, bar).textContent = 'Edit code';
  el('button', { class: 'btn small', 'data-ss': 'gen', onclick: () => o.openGen && o.openGen(c.id) }, bar).textContent = 'Generate';
  const tr = H.row(s, 'Template');
  const sel = el('select', { 'data-ss': 'template' }, tr);
  el('option', { value: '' }, sel).textContent = 'Start from...';
  for (const t of TEMPLATES) el('option', { value: t.id }, sel).textContent = t.name + ': ' + t.desc;
  sel.onchange = () => {
    const t = TEMPLATES.find((x) => x.id === sel.value);
    sel.value = '';
    if (!t) return;
    c.script = t.make(optsFor(D));
    H.changed(false);
    H.rerender();
  };
  H.seg(s, 'Pixels', [[3, 'Coarse'], [4, 'Normal'], [6, 'Fine']], c.res || DEFAULT_RES, (v) => (c.res = +v), true);
  const { W, H: Hp } = screenPixels(c);
  const info = el('p', { class: 'fz-note ss-insp-info' }, s);
  const lines = String(c.script || '').split('\n').length;
  info.textContent = `${W} x ${Hp} pixels, ${lines} lines of code.`;
  const st = stageEntries.get('edit|' + c.id);
  if (st && st.rt.error) {
    const e = el('p', { class: 'fz-note ss-insp-err' }, s);
    e.textContent = (st.rt.error.line ? `Line ${st.rt.error.line}: ` : '') + st.rt.error.message;
  }
}

// ------------------------------------------------------------------ live screens on the stage
const stageEntries = new Map(); // mode|id -> entry
let loop = 0;

// read only values from the design itself (the stage preview while designing)
function designIO(getD) {
  const val = (p) => {
    const D = getD();
    const m = /^u\.([^.]+)(?:\.(\d+))?$/.exec(p);
    if (!m || !D) return undefined;
    const c = D.ctls.find((x) => x.id === m[1]);
    if (!c) return undefined;
    if (m[2] !== undefined) return c.bits && c.bits[+m[2]] ? 1 : 0;
    if (c.kind === 'toggle' || c.kind === 'sel') return c.pos || 0;
    if (c.kind === 'button') return c.on ? 1 : 0;
    if (c.kind === 'foot') return 1;
    return c.value ?? 0.5;
  };
  const { io } = simIO({ ctls: [] }, { readOnly: true, demo: true });
  return Object.assign(io, { mode: 'edit', get: val, set() {}, setBypass() {}, bypassed: () => false });
}
function testIO() {
  let info = null;
  const I = () => info || (info = testInfo() || { params: {}, bypass: false });
  return {
    mode: 'test',
    block: null,
    get def() {
      return getDef(TEST_ID);
    },
    beginFrame() {
      info = null;
    },
    get: (p) => I().params[p],
    set: (p, v, e) => {
      if (e && e.raw) playSetParam(p, v); // a screen output
      else playSet(e.id, v);
      info = null;
    },
    bypassed: () => !!I().bypass,
    setBypass() {},
    levels() {
      const pk = (a) => (Array.isArray(a) && a.length ? Math.max(0, ...a.slice(0, 2)) : 0);
      return { inPk: pk(state.status && state.status.inPeak), outPk: pk(state.status && state.status.outPeak) };
    },
    blockStatus: () => (state.status && state.status.blocks && state.status.blocks[NODE]) || null,
    params: () => engineParamsFor({ id: NODE, type: TEST_ID, params: I().params, bypass: I().bypass }),
    storeGet: () => null,
    storeSet() {},
  };
}

function canvasPos(canvas, e, rt) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / (r.width || 1)) * rt.W, ((e.clientY - r.top) / (r.height || 1)) * rt.H];
}
function makeEntry(c, mode, getD) {
  const { W, H } = screenPixels(c);
  const canvas = document.createElement('canvas');
  const io = mode === 'test' ? testIO() : designIO(getD);
  io.cid = c.id; // the screen's own inputs and outputs
  const host = makeHost(getD(), io);
  const rt = new ScreenRuntime({ src: c.script || '', w: W, h: H, host, canvas, palette: paletteOf(c), screen: { type: c.type, name: c.label || '' } });
  const ent = { rt, canvas, src: c.script || '', W, H, type: c.type, mode, last: 0 };
  if (mode === 'test') {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
      ent.rt.pointer('down', ...canvasPos(canvas, e, ent.rt));
      keysTo(ent.rt);
    });
    canvas.addEventListener('pointermove', (e) => ent.rt.in.down && ent.rt.pointer('move', ...canvasPos(canvas, e, ent.rt)));
    const up = (e) => ent.rt.in.down && ent.rt.pointer('up', ...canvasPos(canvas, e, ent.rt));
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ent.rt.pointer('wheel', ...canvasPos(canvas, e, ent.rt), { dy: e.deltaY });
    }, { passive: false });
  }
  return ent;
}

/** After each stage render: put live canvases into the custom screens of design D. mode = edit | test. */
export function liveStage(root, D, mode) {
  if (!root || !D || !Array.isArray(D.ctls)) return;
  rememberDesign(D);
  if (!D.ctls.some(isCustom)) return;
  loadCSS();
  const getD = () => (window.__tzFactory && window.__tzFactory.design()) || D;
  for (const grp of root.querySelectorAll('[data-sscreen]')) {
    const c = D.ctls.find((x) => x.id === grp.dataset.sscreen);
    if (!c) continue;
    const key = mode + '|' + c.id;
    const { W, H } = screenPixels(c);
    let ent = stageEntries.get(key);
    if (!ent || ent.src !== (c.script || '') || ent.W !== W || ent.H !== H || ent.type !== c.type) {
      ent = makeEntry(c, mode, getD);
      stageEntries.set(key, ent);
    }
    ent.canvas.style.pointerEvents = mode === 'test' ? 'auto' : 'none';
    ent.canvas.classList.toggle('ss-play', mode === 'test');
    mountCanvas(grp, ent.canvas, c.w, c.h);
    rememberCanvas(c.id, ent.canvas, ent.src);
    if (!ent.last) {
      ent.rt.frame(performance.now());
      ent.last = performance.now();
    }
  }
  // drop runtimes that are no longer on the stage (other mode, deleted screens, another design)
  for (const [k, e] of stageEntries) if (!e.canvas.isConnected) stageEntries.delete(k);
  if (!loop) loop = requestAnimationFrame(tick);
}
function tick(now) {
  loop = 0;
  const view = document.getElementById('view-factory');
  const visible = view && view.classList.contains('active') && !document.hidden;
  let any = false;
  for (const ent of stageEntries.values()) {
    if (!ent.canvas.isConnected) continue;
    any = true;
    if (!visible || now - ent.last < 33) continue;
    ent.last = now;
    ent.rt.frame(now);
  }
  if (any) loop = requestAnimationFrame(tick);
}
/** Stage runtimes (tests). */
export function stageScreens() {
  return [...stageEntries.entries()].map(([k, e]) => ({ key: k, error: e.rt.error, frames: e.rt.frameN, connected: e.canvas.isConnected }));
}
export { testing };

// for tests and plugins
window.__tzScreens = {
  stage: stageScreens,
  editor: () => screenEditor(),
  generator: () => generatorOpen(),
  generate,
  styles: () => STYLES.map((x) => x.id),
};
