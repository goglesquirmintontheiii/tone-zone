// Block catalog registry: built-in definitions + user NAM / IR packs.
import { realPedals } from './pedals.js';
import { strymonPedals, podExpress } from './strymon.js';
import { ampDefs, preampDefs, cabDefs } from './amps.js';
import { originals, ioDefs } from './originals.js';
import { K, SEL, FOOT, LED, SCREEN, def, MONO, STEREO, db } from './helpers.js';

export const CATEGORIES = ['Overdrive', 'Distortion', 'Fuzz', 'Boost', 'Amp', 'Bass Amp', 'Preamp', 'Cab', 'Bass Cab', 'Dynamics', 'EQ', 'Filter', 'Modulation', 'Pitch', 'Delay', 'Reverb', 'Looper', 'Volume', 'Multi-FX', 'Utility', 'NAM', 'IR'];

const registry = new Map();
let packDefs = [];

function finalize(d) {
  d.controls.forEach((c, i) => (c.cid = c.cid ?? 'c' + i));
  d.search = [d.name, d.ref, d.brand, d.cat, d.code, d.typeName].filter(Boolean).join(' ').toLowerCase();
  return d;
}

[...realPedals, ...strymonPedals, podExpress, ...ampDefs, ...preampDefs, ...cabDefs, ...originals, ...ioDefs].forEach((d) => registry.set(d.id, finalize(d)));

export function getDef(id) {
  return registry.get(id);
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
