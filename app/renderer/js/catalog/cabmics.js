// Mics on a speaker cab (docs/mic-blocks.md): which slots hold a mic, which model each one is, the cab's output
// jacks (a blend first, then one per mic) and the mic data the engine gets with the graph.
// Pure helpers: the cab def (builders.js CAB), the cab graphic and the UI (mic-edit.js) use them.

// the catalog lookup, handed over by catalog/index.js (a static import would make builders.js -> index.js a cycle)
let getDef = () => undefined;
export function setDefLookup(fn) {
  getDef = fn;
}
import { MIC_COLORS, cabGeom, defaultMicXY } from '../gfx/cabgeom.js';

export const MAX_MICS = 8;
export const DEFAULT_MIC = 'mics.dyn57';
// the 8 built-in mic types of v0.10 (param m<i>type 0..7) and the core models that replace them
export const LEGACY_MODELS = ['mics.dyn57', 'mics.c414', 'mics.r121', 'mics.md421', 'mics.e906', 'mics.md441', 'mics.u87', 'mics.m160'];
export { MIC_COLORS };

const raw = (b, d, k) => b.params?.[k] ?? d.initParams?.[k];
export function micOn(b, d, i) {
  return (raw(b, d, `m${i}on`) ?? 0) > 0.5;
}
// slots (1..8) holding a mic, in order
export function activeSlots(b, d = getDef(b.type)) {
  const out = [];
  for (let i = 1; i <= MAX_MICS; i++) if (micOn(b, d, i)) out.push(i);
  return out;
}
export function freeSlot(b, d = getDef(b.type)) {
  for (let i = 1; i <= MAX_MICS; i++) if (!micOn(b, d, i)) return i;
  return 0;
}
// model id of slot i. Presets from before v0.11 only have the old type number (m<i>type): it maps to a core model.
export function modelOf(b, d, i) {
  const P = b.params || {};
  if (P[`m${i}model`]) return P[`m${i}model`];
  if (P[`m${i}type`] !== undefined) return LEGACY_MODELS[(P[`m${i}type`] | 0)] || DEFAULT_MIC;
  const ip = d.initParams || {};
  if (ip[`m${i}model`]) return ip[`m${i}model`];
  if (ip[`m${i}type`] !== undefined) return LEGACY_MODELS[ip[`m${i}type`] | 0] || DEFAULT_MIC;
  return LEGACY_MODELS[i === 1 ? (d.opts?.mic ?? 0) : 2] || DEFAULT_MIC;
}
// the mic def for a model id (a model from a disabled plugin falls back to the core 57)
export function micDef(id) {
  const d = getDef(id);
  if (d && d.mic && !d.missing) return d;
  return getDef(DEFAULT_MIC);
}
export function micShort(id) {
  const d = getDef(id);
  if (!d || !d.mic || d.missing) return '?';
  return d.mic.short || String(d.name).split(/\s+/)[0].slice(0, 6).toUpperCase();
}
export const isStereo = (b) => (b.variant || 'mono') === 'stereo';

// Output jacks. Mono: one mic = one jack (MIC 1); 2+ mics = MIX (port 0, the old blended output) then one per mic.
// Stereo: MIX L / MIX R (the old panned pair) then one per mic.
export function cabPorts(b, d, variant = b.variant || 'mono') {
  const slots = activeSlots(b, d);
  const ins = (d.ports && d.ports.ins) || ['INPUT'];
  const mic = (i, k) => `MIC ${k + 1} ${micShort(modelOf(b, d, i))}`;
  if (variant === 'stereo') return { ins, outs: ['MIX L', 'MIX R', ...slots.map(mic)] };
  if (slots.length <= 1) return { ins, outs: [slots.length ? mic(slots[0], 0) : 'MIC OUT'] };
  return { ins, outs: ['MIX', ...slots.map(mic)] };
}
// stable keys for the output jacks, used to move cables when mics come and go
export function cabPortKeys(b, d, variant = b.variant || 'mono') {
  const slots = activeSlots(b, d);
  if (variant === 'stereo') return ['mixL', 'mixR', ...slots.map((i) => 'm' + i)];
  if (slots.length <= 1) return ['mix'];
  return ['mix', ...slots.map((i) => 'm' + i)];
}
// after a change (mics added / removed, mono / stereo), move the cab's output cables to the jack carrying the same
// signal. A lone mic's own jack is the blend jack. Returns the cables list (cables to vanished jacks are dropped).
export function remapCabCables(cables, id, before, after) {
  const alias = (k) => {
    if (after.includes(k)) return after.indexOf(k);
    if (k === 'mix' && after.includes('mixL')) return after.indexOf('mixL');
    if (k === 'mixL' && after.includes('mix')) return after.indexOf('mix');
    // a mic's own jack, when it is now the only mic: its signal is the blend
    if (/^m\d$/.test(k) && after.length === 1 && after[0] === 'mix') return 0;
    return -1;
  };
  const out = [];
  for (const c of cables) {
    if (c.from.node !== id || typeof c.from.port !== 'number') { out.push(c); continue; }
    const k = before[c.from.port];
    const n = k === undefined ? c.from.port : alias(k);
    if (n < 0) continue;
    // two cables from the same jack to the same input: keep one
    if (out.some((o) => o !== c && o.from.node === id && o.from.port === n && o.to.node === c.to.node && o.to.port === c.to.port)) continue;
    out.push(n === c.from.port ? c : Object.assign({}, c, { from: Object.assign({}, c.from, { port: n }) }));
  }
  return out;
}

// what the engine needs to know about a model
export function micEngineData(id) {
  const d = micDef(id);
  const m = d.mic;
  const o = { type: m.type || 'dynamic', pattern: m.pattern || (m.type === 'ribbon' ? 'figure8' : 'cardioid'), resp: m.resp || [], offAxis: m.offAxis ?? -6, prox: m.prox ?? (m.pattern === 'omni' ? 0 : 6), sens: m.sens ?? 0 };
  if (m.legacy !== undefined) o.legacy = m.legacy;
  return o;
}
// engine opts for a cab block: the mic models by slot and the output layout
export function cabEngineOpts(b, d, base) {
  const slots = activeSlots(b, d);
  const stereo = isStereo(b);
  const mics = [];
  for (let i = 1; i <= MAX_MICS; i++) mics.push(slots.includes(i) ? micEngineData(modelOf(b, d, i)) : null);
  return Object.assign({}, base, { mics, layout: { mix: stereo ? 2 : 1, mics: stereo || slots.length > 1 ? slots.map((i) => i - 1) : [] } });
}

// Preset specs (scripts/build-presets.js): put mics on a fresh cab block from a readable list.
//   mics: [{ model: 'mics.dyn57', at: 'cap' | 'cap-edge' | 'cone' | 'edge' | 'off' | {x, y}, spk: 0, dist: 0.15,
//            axis: 0, lvl: 0, phase: 0, pan: 0 }, ...]
// The old keys still work: mic1 / mic2 = v0.10 type numbers (mic2 on the next speaker, mic2lvl its level).
export const MIC_SPOTS = { cap: 0.05, 'cap-edge': 0.3, cone: 0.6, edge: 0.95, off: 1.15 };
export function applyMicSpec(b, d, spec) {
  const P = b.params;
  const size = d.cabSize || '4x12';
  const g = cabGeom(size);
  const place = (i, at = 'cap-edge', spk = i - 1) => {
    if (at && typeof at === 'object') return { x: at.x, y: at.y };
    const s = Math.min(g.centers.length - 1, Math.max(0, spk | 0));
    const [cx, cy] = g.centers[s];
    const r = (MIC_SPOTS[at] ?? (typeof at === 'number' ? at : 0.3)) * g.sr;
    const dir = i % 2 ? 1 : -1; // alternate sides so two mics on one speaker don't sit on each other
    return { x: (cx + dir * r - g.gx) / g.gw, y: (cy - g.gy) / g.gh };
  };
  if (Array.isArray(spec.mics)) {
    for (let i = 1; i <= MAX_MICS; i++) for (const k of ['on', 'type', 'model', 'dist', 'axis', 'lvl', 'phase', 'pan']) delete P[`m${i}${k}`];
    spec.mics.slice(0, MAX_MICS).forEach((m, k) => {
      const i = k + 1, xy = place(i, m.at, m.spk ?? (m.at && typeof m.at === 'object' ? 0 : k));
      Object.assign(P, { [`m${i}on`]: 1, [`m${i}model`]: m.model || DEFAULT_MIC, [`m${i}dist`]: m.dist ?? 0.15, [`_m${i}x`]: xy.x, [`_m${i}y`]: xy.y });
      for (const f of ['axis', 'lvl', 'phase', 'pan']) if (m[f] !== undefined) P[`m${i}${f}`] = m[f];
    });
    return;
  }
  if (spec.mic1 !== undefined) { P.m1type = spec.mic1; P.m1model = LEGACY_MODELS[spec.mic1 | 0]; }
  if (spec.mic2 !== undefined) {
    const xy = defaultMicXY(size, 2);
    Object.assign(P, { m2on: 1, m2type: spec.mic2, m2model: LEGACY_MODELS[spec.mic2 | 0], m2dist: 0.2, _m2x: xy.x, _m2y: xy.y, m2lvl: spec.mic2lvl ?? -3 });
  }
}

// what the cab graphic needs to draw mic i: model def, number on the cab (by order), angle and short name
export function cabMicInfo(b, d, i) {
  const slots = activeSlots(b, d);
  const id = modelOf(b, d, i);
  return { def: micDef(id), id, n: Math.max(1, slots.indexOf(i) + 1), axis: b.params?.[`m${i}axis`] ?? 0, short: micShort(id) };
}
