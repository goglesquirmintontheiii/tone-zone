// Block catalog registry: core Tone Zone blocks + blocks registered by plugins + user NAM / IR packs.
import { originals, ioDefs, coreGear } from './originals.js';
import { K, SEL, FOOT, LED, SCREEN, def, MONO, STEREO, db } from './helpers.js';

export const CATEGORIES = ['Overdrive', 'Distortion', 'Fuzz', 'Boost', 'Amp', 'Bass Amp', 'Preamp', 'Cab', 'Bass Cab', 'Dynamics', 'EQ', 'Filter', 'Modulation', 'Pitch', 'Delay', 'Reverb', 'Synth', 'Acoustic', 'Looper', 'Volume', 'Wah', 'Multi-FX', 'Utility', 'Control', 'Device', 'NAM', 'IR'];

const registry = new Map();
const byPlugin = new Map(); // plugin id -> Set(def ids)
let packDefs = [];

function finalize(d) {
  d.controls.forEach((c, i) => (c.cid = c.cid ?? 'c' + i));
  d.search = [d.name, d.ref, d.brand, d.cat, d.code, d.typeName, d.tags && d.tags.join(' ')].filter(Boolean).join(' ').toLowerCase();
  return d;
}

[...originals, ...coreGear, ...ioDefs].forEach((d) => registry.set(d.id, finalize(d)));

// ---- plugin registration
export function registerPluginDefs(pluginId, defs, defaults = {}) {
  missingCache.clear();
  const set = byPlugin.get(pluginId) || new Set();
  byPlugin.set(pluginId, set);
  const flat = defs.flat(3).filter(Boolean);
  for (const d of flat) {
    if (!d.id) throw new Error('block without id');
    if (registry.has(d.id) && !set.has(d.id)) {
      console.warn(`plugin ${pluginId}: block id ${d.id} already registered – skipped`);
      continue;
    }
    d.plugin = pluginId;
    if (!d.brand && defaults.brand) d.brand = defaults.brand;
    registry.set(d.id, finalize(d));
    set.add(d.id);
  }
  return flat.length;
}
export function unregisterPlugin(pluginId) {
  missingCache.clear();
  for (const id of byPlugin.get(pluginId) || []) registry.delete(id);
  byPlugin.delete(pluginId);
}
export function pluginDefIds(pluginId) {
  return [...(byPlugin.get(pluginId) || [])];
}

export const KINDS = ['Pedal', 'Amp', 'Preamp', 'Cab', 'Multi-FX', 'Utility'];
export function kindOf(d) {
  if (d.kind) return d.kind;
  if (d.cat === 'Amp' || d.cat === 'Bass Amp') return 'Amp';
  if (d.cat === 'Preamp') return 'Preamp';
  if (d.cat === 'Cab' || d.cat === 'Bass Cab' || d.cat === 'IR') return 'Cab';
  if (d.cat === 'Multi-FX') return 'Multi-FX';
  if (d.cat === 'Utility' && (d.form === 'util' || d.hardwired)) return 'Utility';
  if (d.cat === 'NAM') return d.packCat === 'cab' ? 'Cab' : 'Amp';
  return 'Pedal';
}
export function isOriginal(d) {
  return !d.pack && (d.brand === 'Tone Zone' || d.ref === 'Tone Zone original' || d.ref === 'Utility');
}
export function brandOf(d) {
  if (d.pack) return null;
  if (isOriginal(d)) return 'Tone Zone';
  if (d.brand) return d.brand;
  return d.ref ? d.ref.split(' ')[0] : null;
}

// remembered block → plugin names so a disabled plugin's blocks can say what they need
let knownBlocks = {};
try { knownBlocks = JSON.parse(localStorage.getItem('tz.knownBlocks') || '{}'); } catch {}
export function rememberPluginBlocks(pluginName, ids) {
  let changed = false;
  for (const id of ids) {
    const d = registry.get(id);
    if (!d) continue;
    const v = { plugin: pluginName, name: d.name, ports: d.ports, stereo: d.stereo };
    if (JSON.stringify(knownBlocks[id]) !== JSON.stringify(v)) { knownBlocks[id] = v; changed = true; }
  }
  if (changed) try { localStorage.setItem('tz.knownBlocks', JSON.stringify(knownBlocks)); } catch {}
}
const missingCache = new Map();
function missingDef(id) {
  if (missingCache.has(id)) return missingCache.get(id);
  const k = knownBlocks[id] || {};
  const d = finalize(def({
    id, name: k.name ? k.name + ' (unavailable)' : 'Unavailable block', missing: true, missingType: id, missingName: k.name, missingPlugin: k.plugin,
    cat: 'Utility', form: 'missing', algo: 'thru', color: '#15171c', hidden: true,
    ports: k.ports || { ins: ['IN 1', 'IN 2'], outs: ['OUT 1', 'OUT 2'] }, stereo: k.stereo || 'mono', controls: [], cost: 0,
  }));
  missingCache.set(id, d);
  return d;
}
export function getDef(id) {
  const d = registry.get(id);
  if (d) return d;
  if (!id || id.startsWith('__')) return undefined;
  return missingDef(id);
}
export function hasDef(id) {
  return registry.has(id);
}
export function allDefs() {
  return [...registry.values()].filter((d) => !d.fixedNode && !d.hidden);
}

export function portsFor(d, variant) {
  if (d.stereo === 'both' || d.stereo === 'stereo') {
    if (variant === 'stereo') {
      if (d.stereoPorts) return d.stereoPorts;
      if (d.form === 'cab') return { ins: ['INPUT'], outs: ['MIC 1', 'MIC 2'] };
      return d.ports.ins.length > 1 || d.ports.outs.length > 1 ? d.ports : STEREO;
    }
    return d.monoPorts || MONO;
  }
  return d.ports;
}
export function defaultVariant(d) {
  return d.stereo === 'stereo' ? 'stereo' : 'mono';
}
export function canSwitchVariant(d) {
  return d.stereo === 'both' || d.stereo === 'stereo';
}

// ------------------------------------------------------------------ user packs
const FORM_FOR = { amp: 'amp', pedal: 'tz', preamp: 'rack', cab: 'cab' };
export function packToDef(pack) {
  const isIR = pack.kind === 'ir';
  const category = isIR ? 'cab' : pack.category || 'amp';
  const form = pack.form || FORM_FOR[category] || 'tz';
  const names = pack.models.map((m) => m.name);
  const controls = [];
  if (names.length > 1) {
    controls.push(SEL('model', names.length > 8 ? 'MODEL' : 'MODEL', names.map((n) => n.slice(0, 10)), { sweep: Math.min(300, Math.max(90, (names.length - 1) * 30)), printLabels: names.length <= 8, optSize: 4.2, r: 13 }));
    if (names.length > 8 || form === 'amp' || form === 'rack') controls.push(SCREEN('modelName', { w: 88, h: 16, names }));
  }
  if (isIR) {
    controls.push(K('mix', 'MIX', { def: 1 }), K('lowcut', 'LOW CUT', { min: 20, max: 500, def: 20, curve: 'log', unit: 'Hz' }), K('highcut', 'HIGH CUT', { min: 2000, max: 20000, def: 20000, curve: 'log', unit: 'Hz' }), K('level', 'LEVEL', { min: -24, max: 12, def: 0, display: db }));
  } else {
    controls.push(
      K('input', 'INPUT', { min: -24, max: 24, def: 0, display: db }),
      K('bass', 'BASS'), K('mid', 'MIDDLE'), K('treble', 'TREBLE'),
      K('output', 'OUTPUT', { min: -24, max: 24, def: 0, display: db }),
      K('gate', 'GATE', { def: 0 })
    );
  }
  controls.push(FOOT(), LED({ color: '#ff3020' }));
  const catMap = { amp: 'Amp', pedal: 'Overdrive', preamp: 'Preamp', cab: 'Cab' };
  const d = def({
    id: 'pack:' + pack.id,
    name: pack.name,
    ref: `${isIR ? 'IR' : 'NAM'} pack · ${names.length} ${names.length === 1 ? 'model' : 'configurations'}`,
    brand: isIR ? 'IR' : 'NAM',
    cat: isIR ? 'IR' : 'NAM',
    packCat: catMap[category],
    form,
    color: pack.color || '#8a5cf6',
    tolex: form === 'amp' || form === 'cab' ? '#151515' : undefined,
    panel: form === 'amp' ? pack.color || '#8a5cf6' : undefined,
    logo: pack.name.slice(0, 18),
    logoFont: "'Oswald', sans-serif",
    logoColor: '#f0f0f0',
    grille: 'black',
    cabSize: '2x12',
    typeName: isIR ? 'Impulse response' : 'Neural Amp Model',
    algo: isIR ? 'ir' : 'nam',
    opts: { files: pack.files },
    stereo: isIR ? 'both' : 'mono',
    ports: isIR ? { ins: ['INPUT'], outs: ['OUTPUT'] } : form === 'amp' ? { ins: ['INPUT'], outs: ['SPEAKER OUT'] } : MONO,
    stereoPorts: isIR ? { ins: ['INPUT'], outs: ['OUT L', 'OUT R'] } : undefined,
    cost: isIR ? 0.6 : 12,
    controls,
    pack,
    knob: 'chrome',
  });
  return finalize(d);
}

export function setPacks(packs) {
  for (const d of packDefs) registry.delete(d.id);
  packDefs = packs.map(packToDef);
  for (const d of packDefs) registry.set(d.id, d);
  return packDefs;
}
export function getPackDefs() {
  return packDefs;
}
