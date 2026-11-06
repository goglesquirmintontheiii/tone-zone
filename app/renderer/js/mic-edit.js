// Mic blocks on cabs (docs/mic-blocks.md): dropping a mic model on a cab, selecting, moving, swapping and removing
// the mics on it, their right-click menu and Delete key, and the cab's Microphones section in the inspector.
// The editor calls micDrop from addAt; everything else hangs off the board's own events.
import { el, esc, bus, toast } from './util.js';
import { getDef, allDefs } from './catalog/index.js';
import { state, blockById, uiParams, commitNow, sendParamsFor, syncGraph, engineParamsFor } from './state.js';
import { cabGeom, defaultMicXY } from './gfx/cabgeom.js';
import { MAX_MICS, MIC_COLORS, DEFAULT_MIC, activeSlots, freeSlot, modelOf, micDef, micShort, isStereo } from './catalog/cabmics.js';
import { showMenu } from './menus.js';
import { thumbImg } from './gfx/raster.js';

let ed = null;
const sui = (id) => (state.ui[id] = state.ui[id] || {});
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// all mic models, core first, then by brand / name
export function micModels() {
  return allDefs().filter((d) => d.cat === 'Mic' && d.mic).sort((a, b) => (a.plugin ? 1 : 0) - (b.plugin ? 1 : 0) || String(a.brand).localeCompare(String(b.brand)) || a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------ geometry
// world point -> cab-local point (undoing the block's rotation), or null when outside the cab
function cabLocal(v, wx, wy) {
  let X = wx - v.block.x, Y = wy - v.block.y;
  const r = v.rot || 0, fw = v.fw ?? v.w, fh = v.fh ?? v.h;
  if (r === 90) [X, Y] = [Y, fh - X];
  else if (r === 180) [X, Y] = [fw - X, fh - Y];
  else if (r === 270) [X, Y] = [fw - Y, X];
  if (X < 0 || Y < 0 || X > fw || Y > fh) return null;
  return { X, Y };
}
// the cab on top under a world point
function cabAt(wx, wy) {
  let best = null;
  for (const v of ed.views.values()) {
    if (!v.def.cabMics) continue;
    const p = cabLocal(v, wx, wy);
    if (p) best = { v, ...p };
  }
  return best;
}
// slot of the mic whose capsule is near a cab-local point
function micNear(v, X, Y, r = 22) {
  const g = cabGeom(v.def.cabSize || '4x12');
  const ui = uiParams(v.block);
  let best = 0, bd = r;
  for (const i of activeSlots(v.block, v.def)) {
    const d = Math.hypot(g.gx + (ui[`_m${i}x`] ?? 0.5) * g.gw - X, g.gy + (ui[`_m${i}y`] ?? 0.5) * g.gh - Y);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ------------------------------------------------------------------ changes (each one undoable)
function afterChange(b, rerender = true) {
  sendParamsFor(b);
  if (rerender && ed) ed.rerenderNode(b.id);
  else ed?.views.get(b.id)?.updateControls();
  syncGraph();
  bus.emit('selection'); // the inspector redraws its mic cards
}
// jack keys before a change, then move the cab's output cables to their new jacks
function withPorts(b, fn) {
  const d = getDef(b.type);
  const before = d.portKeys(b);
  fn(d);
  state.preset.cables = d.remapPorts(state.preset.cables, b, before);
}
export function addMic(b, model = DEFAULT_MIC, xy = null) {
  const d = getDef(b.type);
  const i = freeSlot(b, d);
  if (!i) {
    toast(`A cab takes up to ${MAX_MICS} mics.`, 'warn');
    return 0;
  }
  commitNow();
  const n = activeSlots(b, d).length;
  const at = xy || defaultMicXY(d.cabSize || '4x12', n + 1);
  withPorts(b, () => {
    Object.assign(b.params, { [`m${i}on`]: 1, [`m${i}model`]: model, [`m${i}dist`]: 0.15, [`m${i}axis`]: 0, [`m${i}lvl`]: 0, [`m${i}phase`]: 0, [`_m${i}x`]: clamp01(at.x), [`_m${i}y`]: clamp01(at.y) });
    delete b.params[`m${i}type`];
    b.params[`m${i}pan`] = isStereo(b) ? (n % 2 ? 0.7 : -0.7) : 0;
  });
  sui(b.id).selMic = i;
  afterChange(b);
  return i;
}
export function removeMic(b, i) {
  const d = getDef(b.type);
  if (activeSlots(b, d).length <= 1) {
    toast('A cab needs at least one mic. Drop another mic on this one to swap it.', 'warn');
    return false;
  }
  commitNow();
  withPorts(b, () => {
    b.params[`m${i}on`] = 0;
  });
  sui(b.id).selMic = activeSlots(b, d)[0];
  afterChange(b);
  return true;
}
export function swapMic(b, i, model) {
  if (modelOf(b, getDef(b.type), i) === model) return;
  commitNow();
  b.params[`m${i}model`] = model;
  sui(b.id).selMic = i;
  afterChange(b); // the jack label and the engine's mic data change
}
// shift-click on a mic: next model in the list
export function cycleMicModel(b, i, dir = 1) {
  const list = micModels();
  const k = list.findIndex((d) => d.id === modelOf(b, getDef(b.type), i));
  const next = list[(k + dir + list.length) % list.length];
  if (!next) return;
  swapMic(b, i, next.id);
  toast(`Mic: ${next.name}${next.ref ? ' (' + next.ref + ')' : ''}`, 'info', 1300);
}

// editor.addAt with a mic model: put it on the cab under the point (or swap the mic there), never on the board
export function micDrop(editor, type, wx, wy) {
  ed = editor;
  const md = getDef(type);
  // no point (double-click in the list): the selected cab
  let hit = wx === null ? null : cabAt(wx, wy);
  if (wx === null) {
    const v = state.selection.size === 1 ? ed.views.get([...state.selection][0]) : null;
    if (v && v.def.cabMics) hit = { v, X: null, Y: null };
    else {
      toast(`Select a cab first, or drag ${md.name} onto one.`, 'warn');
      return null;
    }
  }
  if (!hit) {
    toast(`${md.name} is a mic: drop it on a cab to put it there.`, 'warn');
    return null;
  }
  const { v, X, Y } = hit;
  const b = v.block;
  const g = cabGeom(v.def.cabSize || '4x12');
  const on = X !== null ? micNear(v, X, Y) : 0;
  if (on) swapMic(b, on, type);
  else if (X !== null) addMic(b, type, { x: (X - g.gx) / g.gw, y: (Y - g.gy) / g.gh });
  else addMic(b, type);
  editor.select([b.id]);
  return null;
}

// ------------------------------------------------------------------ pointer, keys and menu on the board
let focus = null; // { node, slot } of the mic last clicked, until something else is clicked
function micUnder(e) {
  const ctl = e.target.closest && e.target.closest('.ctl.mic');
  const node = ctl && ctl.closest('[data-node]');
  if (!ctl || !node) return null;
  const v = ed.views.get(node.dataset.node);
  const entry = v && v.views.get(ctl.dataset.ctl);
  return entry ? { v, slot: entry.ctl.idx } : null;
}
function setFocus(f) {
  const old = focus;
  focus = f;
  if (old && (!f || old.node !== f.node)) {
    const s = state.ui[old.node];
    if (s) delete s.selMic;
    ed.views.get(old.node)?.updateControls();
  }
}
export function initMicEdit(editor) {
  ed = editor;
  const board = editor.board;
  board.addEventListener('pointerdown', (e) => {
    const m = micUnder(e);
    if (m) focus = { node: m.v.block.id, slot: m.slot };
    else if (focus) setFocus(null);
  }, true);
  board.addEventListener('keydown', (e) => {
    if (!focus || (e.key !== 'Delete' && e.key !== 'Backspace') || e.target !== board) return;
    const b = blockById(focus.node);
    if (!b || !state.selection.has(b.id) || state.selection.size !== 1 || state.selectedCable) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (removeMic(b, focus.slot)) setFocus(null);
  }, true);
  board.addEventListener('contextmenu', (e) => {
    const m = micUnder(e);
    if (!m) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const b = m.v.block, i = m.slot, d = getDef(b.type);
    focus = { node: b.id, slot: i };
    sui(b.id).selMic = i;
    editor.select([b.id]);
    m.v.updateControls();
    const md = micDef(modelOf(b, d, i));
    const n = activeSlots(b, d).indexOf(i) + 1;
    showMenu(e.clientX, e.clientY, [
      { title: `Mic ${n}: ${md.name}` },
      { label: 'Next model', icon: 'redo', kbd: 'Shift+click', onClick: () => cycleMicModel(b, i, 1) },
      { label: 'Previous model', icon: 'undo', onClick: () => cycleMicModel(b, i, -1) },
      { label: 'Back on axis, 5 cm', icon: 'reload', onClick: () => { commitNow(); Object.assign(b.params, { [`m${i}axis`]: 0, [`m${i}dist`]: 0.15 }); afterChange(b, false); } },
      { sep: true },
      { label: 'Remove mic', icon: 'trash', kbd: 'Del', onClick: () => { if (removeMic(b, i)) setFocus(null); } },
    ]);
  }, true);
  bus.on('preset:changed', () => (focus = null));
  addStyles();
}

// ------------------------------------------------------------------ inspector section
export function micInspector(body, b, { rowFor, render }) {
  const d = getDef(b.type);
  const ui = uiParams(b);
  const ms = el('div', { class: 'insp-section' }, body);
  el('h5', {}, ms).textContent = 'Microphones';
  const slots = activeSlots(b, d);
  const sel = slots.includes(state.ui[b.id]?.selMic) ? state.ui[b.id].selMic : slots[0];
  const stereo = isStereo(b);
  const ports = slots.length > 1 || stereo;
  const models = micModels();
  slots.forEach((i, k) => {
    const id = modelOf(b, d, i);
    const md = micDef(id);
    const card = el('div', { class: 'mic-card' + (sel === i ? ' sel' : '') }, ms);
    const top = el('div', { class: 'mic-top' }, card);
    el('span', { class: 'mic-dot', style: { background: MIC_COLORS[k % MIC_COLORS.length] } }, top).textContent = String(k + 1);
    const th = el('span', { class: 'mic-thumb' }, top);
    th.appendChild(thumbImg(md, 30));
    const nm = el('span', { class: 'mic-name' }, top);
    el('b', {}, nm).textContent = md.name;
    el('small', {}, nm).textContent = `${md.ref || md.typeName} · speaker ${(engineParamsFor(b)[`m${i}spk`] ?? 0) + 1}`;
    top.onclick = () => { sui(b.id).selMic = i; ed?.views.get(b.id)?.updateControls(); render(); };
    if (slots.length > 1) {
      const rm = el('button', { class: 'icon-btn sm', title: 'Remove mic' }, top, '<i class="ic ic-trash"></i>');
      rm.onclick = (e) => { e.stopPropagation(); removeMic(b, i); };
    }
    // model: every mic model, grouped by where it comes from
    const row = el('div', { class: 'prow mic-model-row' }, card);
    el('label', {}, row).textContent = 'Model';
    const s = el('select', { class: 'mic-model' }, row);
    const groups = new Map();
    for (const m of models) {
      const gname = m.plugin ? m.brand || 'Plugin' : 'Core';
      if (!groups.has(gname)) groups.set(gname, el('optgroup', { label: gname }, s));
      el('option', { value: m.id }, groups.get(gname)).textContent = `${m.name}${m.ref ? ' (' + m.ref + ')' : ''}`;
    }
    s.value = md.id;
    s.onchange = () => swapMic(b, i, s.value);
    rowFor(card, b, { t: 'knob', p: `m${i}dist`, label: 'Distance', min: 0, max: 1, def: 0.15, display: (v) => (1 + v * 30).toFixed(0) + ' cm' }, ui);
    rowFor(card, b, { t: 'knob', p: `m${i}axis`, label: 'Angle', min: 0, max: 1, def: 0, display: (v) => (v < 0.02 ? 'On axis' : Math.round(v * 45) + '° off') }, ui);
    rowFor(card, b, { t: 'knob', p: `m${i}lvl`, label: 'Level', min: -40, max: 12, def: 0, display: (v) => v.toFixed(1) + ' dB' }, ui);
    if (stereo) rowFor(card, b, { t: 'knob', p: `m${i}pan`, label: 'Pan (mix)', min: -1, max: 1, def: 0, display: (v) => (Math.abs(v) < 0.02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)) }, ui);
    rowFor(card, b, { t: 'toggle', p: `m${i}phase`, label: 'Polarity', options: ['Normal', 'Inverted'], def: 0 }, ui);
    el('p', { class: 'mic-out' }, card).innerHTML = ports ? `Own output: <b>MIC ${k + 1} ${esc(micShort(id))}</b>, also in the mix` : 'Output: <b>' + esc(`MIC 1 ${micShort(id)}`) + '</b>';
  });
  if (slots.length < MAX_MICS) {
    const add = el('button', { class: 'btn small', style: { marginTop: '8px' } }, ms, '<i class="ic ic-plus"></i>Add a Fifty-Seven');
    add.onclick = () => addMic(b);
  }
  el('p', { class: 'hint' }, ms).textContent = 'Drag mics from the Mics list onto the cab, or onto a mic to swap it. Drag a mic to move it, scroll on it for distance, right-click or Delete to remove it. Each mic has its own output jack.';
  const cs = el('div', { class: 'insp-section' }, body);
  el('h5', {}, cs).textContent = 'Cabinet';
  rowFor(cs, b, { t: 'knob', p: 'lowcut', label: 'Low cut', min: 20, max: 500, def: 30, curve: 'log', unit: 'Hz' }, ui);
  rowFor(cs, b, { t: 'knob', p: 'highcut', label: 'High cut', min: 2000, max: 20000, def: 14000, curve: 'log', unit: 'Hz' }, ui);
  rowFor(cs, b, { t: 'knob', p: 'level', label: 'Level', min: -24, max: 12, def: 0, display: (v) => v.toFixed(1) + ' dB' }, ui);
}

function addStyles() {
  if (document.getElementById('mic-edit-css')) return;
  const st = document.createElement('style');
  st.id = 'mic-edit-css';
  st.textContent = `
.mic-top .mic-thumb { width: 30px; height: 30px; display: grid; place-items: center; flex: none; }
.mic-top .mic-thumb img { max-width: 30px; max-height: 30px; }
.mic-top .mic-name { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
.mic-top .mic-name small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mic-card .mic-model-row { grid-template-columns: 96px 1fr; }
.mic-card select.mic-model { width: 100%; min-width: 0; }
.mic-card .mic-out { margin: 2px 0 4px; font-size: 11px; color: var(--muted); }
.mic-card .mic-out b { color: var(--text); font-weight: 600; }`;
  document.head.appendChild(st);
}
