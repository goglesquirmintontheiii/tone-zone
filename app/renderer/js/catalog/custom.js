// Custom blocks: Pedal Factory designs saved to <data>/custom-blocks and registered as catalog blocks
// (pseudo plugin 'custom', kind 'Custom'). Test mode registers the design being edited as a hidden block.
import { registerPluginDefs, unregisterPlugin, getDef } from './index.js';
import { designToDef, cvValue } from '../pages/factory-circuit.js';
import { encSteps, makePulser } from '../pages/circuit-links.js';
import { state, setParam, blockById, uiParams } from '../state.js';
import { sendCtrl } from '../control.js';
import { installCustomForm } from '../gfx/forms-custom.js';
import { bus } from '../util.js';

installCustomForm();

// circuit outputs wired to EXP / footswitch OUT jacks: the engine reports them (status cv[]), and they move
// whatever is plugged in on the board, like an expression pedal or a footswitch would. Jacks wired straight to
// a control, jack or screen (source 'link') read the block's params, on every status and every param change.
const lastOut = new Map(); // blockId:i -> last value sent
function pushOut(b, o, i, v) {
  const k = b.id + ':' + i;
  if (o.sig === 'b') {
    const on = v > 0.5 && !b.bypass ? 1 : 0;
    if (lastOut.get(k) === on) return;
    lastOut.set(k, on);
    sendCtrl(b, i, on, 'press');
    return;
  }
  const t = Math.max(0, Math.min(1, (v - o.lo) / ((o.hi - o.lo) || 1)));
  if (Math.abs((lastOut.get(k) ?? -1) - t) < 0.002) return;
  lastOut.set(k, t);
  // continuous: straight into the targets' params, without an undo step per change
  for (const c of state.preset.cables) {
    if (c.from.node !== b.id || c.from.port !== 'c' + i) continue;
    const tb = blockById(c.to.node);
    const inp = tb && getDef(tb.type)?.ctrl?.ins?.[parseInt(String(c.to.port).slice(1), 10)];
    if (!inp || !inp.param) continue;
    const x = inp.invert ? 1 - t : t;
    const val = inp.curve === 'log' && inp.min > 0 ? inp.min * Math.pow(inp.max / inp.min, x) : (inp.min ?? 0) + ((inp.max ?? 1) - (inp.min ?? 0)) * x;
    setParam(tb.id, inp.param, val, { silent: true });
  }
}
function pushBlock(b, st, onlyLinks) {
  const d = b.type && b.type.startsWith('custom.') ? getDef(b.type) : null;
  const outs = d && d.ctrl && d.ctrl.outs;
  if (!outs || !outs.length) return;
  let ui = null;
  outs.forEach((o, i) => {
    let v;
    if (o.source === 'link') {
      const r = o.read((ui = ui || uiParams(b)), st, b);
      v = r ? r.t : undefined;
    } else if (o.source === 'cv' && !onlyLinks) v = cvValue(st, o.cv);
    if (v !== undefined) pushOut(b, o, i, v);
  });
}
function pushCtrlOuts(ev) {
  const st = ev && ev.blocks;
  if (!st || !state.preset || !Array.isArray(state.preset.blocks)) return;
  for (const b of state.preset.blocks) {
    pushBlock(b, st[b.id], false);
    encInit(b);
  }
}
// encoders on the board: turning one pulses its CW or CCW output per detent step and counts the steps
const encState = new Map(); // blockId:param -> {last, acc}
const pulse = makePulser((key, v) => {
  const [id, p] = key;
  if (blockById(id)) setParam(id, p, v, { silent: true });
});
function encInit(b) {
  const d = b.type && b.type.startsWith('custom.') ? getDef(b.type) : null;
  if (!d || !d.encoders) return;
  let ui = null;
  for (const e of d.encoders) if (!encState.has(b.id + ':' + e.p)) encState.set(b.id + ':' + e.p, { last: (ui = ui || uiParams(b))[e.p] ?? e.def });
}
function encTurned(b, d, p, v) {
  const e = d.encoders && d.encoders.find((x) => x.p === p);
  if (!e) return;
  const k = b.id + ':' + p;
  if (!encState.has(k)) encState.set(k, { last: null });
  const n = encSteps(encState.get(k), v, e.wrap);
  if (!n) return;
  setParam(b.id, e.n, Math.max(-255, Math.min(255, (+b.params[e.n] || 0) + n)), { silent: true });
  // the pulse params are [block, param] pairs so one pulser serves every block
  pulse(k, { cw: [b.id, e.cw], ccw: [b.id, e.ccw] }, n);
}
// a param changed: controls moved by it follow (def.plinks), OUT jacks wired to it send
let depth = 0;
function onParam({ id, p, v }) {
  if (depth > 4 || !state.preset) return;
  const b = blockById(id);
  const d = b && b.type && b.type.startsWith('custom.') ? getDef(b.type) : null;
  if (!d) return;
  depth++;
  try {
    if (d.encoders) encTurned(b, d, p, v);
    for (const l of d.plinks || []) {
      if (l.from !== p) continue;
      const v = l.value(uiParams(b), b);
      if (v !== undefined && b.params[l.to] !== v) setParam(b.id, l.to, v, { silent: true });
    }
    if (d.ctrl && d.ctrl.outs && d.ctrl.outs.some((o) => o.source === 'link')) pushBlock(b, state.status && state.status.blocks ? state.status.blocks[b.id] : null, true);
  } finally {
    depth--;
  }
}
bus.on('param', onParam);
let outsHooked = false;
export function hookCtrlOuts() {
  if (outsHooked || !window.tz || !window.tz.engine) return;
  outsHooked = true;
  window.tz.engine.onEvent((ev) => ev && ev.ev === 'status' && pushCtrlOuts(ev));
}
const records = new Map(); // id -> { id, design, savedAt }
export const TEST_ID = 'custom.__test';
const api = () => (window.tz && window.tz.custom) || null;

function defFor(rec) {
  const d = designToDef(rec.design, { id: rec.id });
  d.pluginVersion = String(rec.savedAt || 0); // new thumbnails after an update
  return d;
}
function registerAll() {
  unregisterPlugin('custom');
  const defs = [];
  for (const rec of records.values()) {
    try {
      defs.push(defFor(rec));
    } catch (e) {
      console.warn('custom block', rec.id, e);
    }
  }
  registerPluginDefs('custom', defs);
}

/** Read the saved designs and register them (at startup). */
export async function loadCustomBlocks() {
  hookCtrlOuts();
  const a = api();
  if (!a) return 0;
  try {
    for (const rec of await a.list()) records.set(rec.id, rec);
  } catch (e) {
    console.warn('custom blocks', e);
  }
  registerAll();
  bus.emit('catalog');
  return records.size;
}
export function customBlocks() {
  return [...records.values()];
}
const slug = (s) => String(s || 'pedal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'pedal';

/** Save a design as a block (or update the block it came from). Returns the block id. */
export async function saveCustomBlock(design, { asNew = false } = {}) {
  const d = JSON.parse(JSON.stringify(design));
  const id = !asNew && d.blockId && records.has(d.blockId) ? d.blockId : 'custom.' + slug(d.name) + '-' + Math.random().toString(36).slice(2, 7);
  d.blockId = id;
  const rec = { id, design: d, savedAt: Date.now() };
  designToDef(d, { id }); // throws on a broken design before anything is written
  const a = api();
  if (a) await a.save(rec);
  records.set(id, rec);
  registerAll();
  bus.emit('catalog');
  bus.emit('rebuildBoard');
  import('../state.js').then((m) => m.syncGraph());
  return id;
}
export async function deleteCustomBlock(id) {
  const a = api();
  if (a) await a.remove(id);
  records.delete(id);
  registerAll();
  bus.emit('catalog');
  bus.emit('rebuildBoard');
}

/** The design being edited, as a hidden block for test mode. */
export function registerTestDef(design) {
  const d = designToDef(design, { id: TEST_ID, hidden: true });
  registerPluginDefs('custom-test', [d]);
  return d;
}
export function unregisterTestDef() {
  unregisterPlugin('custom-test');
}
// a single circuit played alone from the circuit editor
export const SOLO_ID = 'custom.__solo';
export function registerSoloDef(design) {
  const d = designToDef(design, { id: SOLO_ID, hidden: true });
  registerPluginDefs('custom-solo', [d]);
  return d;
}
export function unregisterSoloDef() {
  unregisterPlugin('custom-solo');
}
