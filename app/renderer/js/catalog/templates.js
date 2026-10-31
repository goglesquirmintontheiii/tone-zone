// Pedal Factory templates as ready made board blocks. Every template in the factory's gallery (pages/factory.js,
// the showcase ones too) is built at startup with designToDef, the same way saved custom blocks are, and
// registered as plugin 'factory-templates' (with the pedals, in a group of their own in the block list). Block ids are
// 'custom.template.<template id>' so the custom block hooks (catalog/custom.js: encoders, control jacks) apply.
// The ids inside each design are made stable, so a preset keeps its knob settings from one start to the next.
// Opening one in the factory gives an editable copy (it saves as a new custom block).
import { registerPluginDefs, unregisterPlugin, getDef } from './index.js';
import { designToDef } from '../pages/factory-circuit.js';

export const TEMPLATE_PLUGIN = 'factory-templates';
export const TEMPLATE_CAT = 'Factory templates';
export const templateBlockId = (id) => 'custom.template.' + id;
export const isTemplateBlock = (id) => typeof id === 'string' && id.startsWith('custom.template.');

/** The same design every time: each generated id becomes <its first letter><template><n>, in the order they appear. */
export function stableIds(d, tag) {
  const ids = [];
  const seen = new Set();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'id' && typeof v === 'string' && v !== 'title' && v !== 'sub') {
        if (!seen.has(v)) {
          seen.add(v);
          ids.push(v);
        }
      } else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(d);
  const safe = String(tag).replace(/[^a-z0-9]/gi, '');
  const map = new Map(ids.map((id, i) => [id, id[0] + safe + i]));
  // ids are letters and digits; references to them (maps 'inst.node', binds 'ctl:id', wires) are bounded by
  // other characters
  return JSON.parse(JSON.stringify(d).replace(/[A-Za-z0-9_]+/g, (tok) => map.get(tok) ?? tok));
}
// a short hash of the design, so the block list draws a new thumbnail when a template changes
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

let factory = null;
/** Build and register every template as a block (at startup). Returns how many. */
export async function loadTemplateBlocks() {
  factory = factory || (await import('../pages/factory.js'));
  const defs = [];
  for (const t of factory.TEMPLATES) {
    try {
      const d = stableIds(factory.migrateDesign(t.make()), t.id);
      delete d.blockId;
      const id = templateBlockId(t.id);
      const def = designToDef(d, { id, cat: TEMPLATE_CAT });
      Object.assign(def, {
        name: t.name,
        kind: 'Pedal', // with the pedals, in a group of their own (saved designs are Custom)
        brand: 'Tone Zone',
        typeName: t.desc || def.typeName,
        desc: (t.desc ? t.desc + '. ' : '') + 'A Pedal Factory template: open it in the Pedal Factory to make your own copy.',
        tags: [...(def.tags || []), 'template', 'factory template'],
        template: t.id,
        pluginVersion: hash(JSON.stringify(d)),
      });
      defs.push(def);
    } catch (e) {
      console.warn('factory template', t.id, e);
    }
  }
  unregisterPlugin(TEMPLATE_PLUGIN);
  registerPluginDefs(TEMPLATE_PLUGIN, defs);
  return defs.length;
}

/** An editable copy of a template block's design (no block id, fresh ids: saving makes a new custom block). */
export async function templateCopy(blockId) {
  const def = getDef(blockId);
  if (!def || !def.template) return null;
  factory = factory || (await import('../pages/factory.js'));
  const t = factory.TEMPLATES.find((x) => x.id === def.template);
  return t ? factory.migrateDesign(t.make()) : null;
}
/** Open a template block in the Pedal Factory as an editable copy. */
export async function openTemplateInFactory(blockId) {
  const d = await templateCopy(blockId);
  if (!d) return false;
  const tab = document.querySelector('#tabs [data-tab="factory"]');
  if (tab) tab.click();
  factory.renderFactory(); // builds the factory the first time
  if (!window.__tzFactory) return false;
  window.__tzFactory.load(d);
  return true;
}
