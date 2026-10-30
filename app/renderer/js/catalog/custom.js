// Custom blocks: Pedal Factory designs saved to <data>/custom-blocks and registered as catalog blocks
// (pseudo plugin 'custom', kind 'Custom'). Test mode registers the design being edited as a hidden block.
import { registerPluginDefs, unregisterPlugin, getDef } from './index.js';
import { designToDef, cvValue } from '../pages/factory-circuit.js';
import { state, setParam, blockById } from '../state.js';
import { sendCtrl } from '../control.js';
import { installCustomForm } from '../gfx/forms-custom.js';
import { bus } from '../util.js';

installCustomForm();

// circuit outputs wired to EXP / footswitch OUT jacks: the engine reports them (status cv[]), and they move
// whatever is plugged in on the board, like an expression pedal or a footswitch would
const lastOut = new Map(); // blockId:i -> last value sent
function pushCtrlOuts(ev) {
  const st = ev && ev.blocks;
  if (!st || !state.preset || !Array.isArray(state.preset.blocks)) return;
  for (const b of state.preset.blocks) {
    const d = b.type && b.type.startsWith('custom.') ? getDef(b.type) : null;
    const outs = d && d.ctrl && d.ctrl.outs;
    if (!outs || !outs.length) continue;
    outs.forEach((o, i) => {
      if (o.source !== 'cv') return;
      const v = cvValue(st[b.id], o.cv);
      if (v === undefined) return;
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
    });
  }
}
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
