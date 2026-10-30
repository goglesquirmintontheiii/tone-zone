// Custom blocks: Pedal Factory designs saved to <data>/custom-blocks and registered as catalog blocks
// (pseudo plugin 'custom', kind 'Custom'). Test mode registers the design being edited as a hidden block.
import { registerPluginDefs, unregisterPlugin } from './index.js';
import { designToDef } from '../pages/factory-circuit.js';
import { installCustomForm } from '../gfx/forms-custom.js';
import { bus } from '../util.js';

installCustomForm();
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
