// Nautica XL (tz.nautica): the flagship Tone Zone floor processor. A native built-in block: the audio runs in the
// engine's 'rig' algorithm (two paths of eight slots, four FX loops, output routing, per-jack levels), the unit's
// state lives in the `_st` param (JSON), screens and switch logic are in ../screens-nautica.js and the enclosure is
// ../gfx/forms-nautica.js. docs/nautica-xl.md describes the structure (for the Pedal Factory template).
import { K, BTN, FOOT, LED, SCREEN, TREADLE } from './helpers.js';
import { TZ } from './builders.js';
import { ATLAS_MODELS, parseSt, clone, specTo, specPos, specFmt, F } from './originals4.js';
import { getPackDefs } from './index.js'; // cyclic: only used at run time

export { parseSt, clone, specTo, specPos, specFmt, F };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ================================================================== model library
// colour-coded block types (HeadRush style)
export const NX_CATS = [
  { id: 'drv', name: 'DRIVE', short: 'DRV', color: '#ff8a3d' },
  { id: 'amp', name: 'AMP', short: 'AMP', color: '#ff4b4b' },
  { id: 'cab', name: 'CAB', short: 'CAB', color: '#d9b77a' },
  { id: 'nam', name: 'NAM & IR', short: 'NAM', color: '#e070ff' },
  { id: 'dyn', name: 'DYNAMICS', short: 'DYN', color: '#ffd23f' },
  { id: 'eq', name: 'EQ', short: 'EQ', color: '#c4ccda' },
  { id: 'mod', name: 'MODULATION', short: 'MOD', color: '#3fb6ff' },
  { id: 'flt', name: 'FILTER & WAH', short: 'FLT', color: '#ff5fb0' },
  { id: 'pit', name: 'PITCH', short: 'PITCH', color: '#45e0c8' },
  { id: 'dly', name: 'DELAY', short: 'DLY', color: '#46d36f' },
  { id: 'rev', name: 'REVERB', short: 'REV', color: '#a98bff' },
  { id: 'fx', name: 'SYNTH & FX', short: 'FX', color: '#b8f040' },
  { id: 'utl', name: 'UTILITY', short: 'UTIL', color: '#8fa3b8' },
  { id: 'lop', name: 'FX LOOP', short: 'LOOP', color: '#f2f5fa' },
];
export const NX_CAT = Object.fromEntries(NX_CATS.map((c) => [c.id, c]));

const P = (p, l, min, max, def, fmt = 'pct', o = {}) => Object.assign({ p, l, min, max, def, fmt }, o);
const P01 = (p, l, def = 0.5, o = {}) => P(p, l, 0, 1, def, 'pct', o);
const DB = (p, l, min = -24, max = 12, def = 0) => P(p, l, min, max, def, 'db', { step: 0.5 });
const N = (p, l, names, def = 0) => P(p, l, 0, names.length - 1, def, 'int', { step: 1, names });

const EXTRA = [
  { id: 'flt.wah', cat: 'flt', name: 'Classic Wah', short: 'WAH', algo: 'wah', opts: {}, set: { mode: 0, filter: 1 }, knobs: [P01('pos', 'POSITION', 0.5), P01('q', 'Q', 0.55), P01('range', 'RANGE', 0.5), P01('level', 'LEVEL', 0.5)] },
  { id: 'flt.vwah', cat: 'flt', name: 'Vocal Wah', short: 'VOC WAH', algo: 'wah', opts: {}, set: { mode: 0, filter: 1 }, knobs: [P01('pos', 'POSITION', 0.5), P01('q', 'Q', 0.75), P01('range', 'RANGE', 0.65), P01('level', 'LEVEL', 0.5)] },
  { id: 'fx.synth', cat: 'fx', name: 'Guitar Synth', short: 'SYNTH', algo: 'synth', opts: {},
    knobs: [N('mode', 'VOICE', ['SQUARE', 'SAW', 'ORGAN', 'STRINGS', 'BRASS', 'SUB', 'PAD', 'SWEEP'], 1), P01('filter', 'FILTER', 0.5), P01('reso', 'RESO', 0.4), P01('attack', 'ATTACK', 0.2), P01('decay', 'DECAY', 0.6),
      P('octave', 'OCTAVE', -2, 1, 0, 'int', { step: 1 }), P01('sens', 'SENS', 0.5), P01('mod', 'MOD', 0.3), P01('dry', 'DRY', 0.3), P01('wet', 'WET', 0.8), DB('level', 'LEVEL')] },
  { id: 'fx.freeze', cat: 'fx', name: 'Auto Freeze', short: 'FREEZE', algo: 'freeze', opts: {}, set: { mode: 2 },
    knobs: [P01('mix', 'MIX', 0.5), P01('decay', 'DECAY', 0.95), P01('tone', 'TONE', 0.8), P01('speed', 'SPEED', 0.3), P01('dry', 'DRY', 1), DB('level', 'LEVEL')] },
  { id: 'fx.swell', cat: 'fx', name: 'Auto Swell', short: 'SWELL', algo: 'swell', opts: {}, knobs: [P01('sens', 'SENS', 0.5), P01('attack', 'ATTACK', 0.4), DB('level', 'LEVEL')] },
  { id: 'fx.lofi', cat: 'fx', name: 'Lo-Fi Tape', short: 'LO-FI', algo: 'lofi', opts: {},
    knobs: [N('mode', 'TYPE', ['CASSETTE', 'VINYL', 'AM RADIO', 'PHONE', 'SAMPLER']), P01('wow', 'WOW', 0.3), P01('flutter', 'FLUTTER', 0.3), P01('age', 'AGE', 0.4), P01('noise', 'NOISE', 0.15),
      P01('saturate', 'SATURATE', 0.3), P01('bits', 'BITS', 0.7), P01('rate', 'RATE', 0.7), P01('mix', 'MIX', 1), DB('level', 'LEVEL')] },
  { id: 'fx.acoustic', cat: 'fx', name: 'Acoustic Sim', short: 'ACOUSTIC', algo: 'acoustic', opts: {}, set: { mode: 0 },
    knobs: [N('type', 'BODY TYPE', ['DREAD', 'JUMBO', 'PARLOR', 'NYLON', '12-STR']), P01('body', 'BODY', 0.6), P01('top', 'TOP', 0.5), P01('bass', 'BASS', 0.5), P01('mid', 'MID', 0.5), P01('treble', 'TREBLE', 0.5),
      P01('presence', 'PRESENCE', 0.5), P01('comp', 'COMP', 0.2), P01('reverb', 'ROOM', 0.1), P01('mix', 'MIX', 1), DB('level', 'LEVEL')] },
  { id: 'utl.width', cat: 'utl', name: 'Stereo Width', short: 'WIDTH', algo: 'stereo', opts: {}, set: { mode: 0 }, knobs: [P01('width', 'WIDTH', 0.7), P('monobass', 'MONO BASS', 20, 400, 120, 'hz', { log: true }), DB('level', 'LEVEL')] },
  { id: 'utl.haas', cat: 'utl', name: 'Haas Widener', short: 'HAAS', algo: 'stereo', opts: {}, set: { mode: 1 }, knobs: [P('time', 'TIME', 1, 40, 12, 'ms'), P01('width', 'WIDTH', 0.6), DB('level', 'LEVEL')] },
  { id: 'utl.autopan', cat: 'utl', name: 'Auto Pan', short: 'AUTOPAN', algo: 'stereo', opts: {}, set: { mode: 3 }, knobs: [P01('rate', 'RATE', 0.3), P01('depth', 'DEPTH', 0.6), DB('level', 'LEVEL')] },
  { id: 'utl.gain', cat: 'utl', name: 'Gain', short: 'GAIN', algo: 'utility', opts: { kind: 'gain' }, knobs: [DB('level', 'LEVEL', -24, 24, 0)] },
  { id: 'utl.vol', cat: 'utl', name: 'Volume Pedal', short: 'VOLUME', algo: 'volume', opts: {}, knobs: [P01('pos', 'POSITION', 1), P01('min', 'MINIMUM', 0), P01('taper', 'TAPER', 1)] },
];
// FX loops: the signal leaves through SEND k and comes back on RETURN k (stereo loops use two pairs)
const LOOPK = [P('send', 'SEND', -40, 12, 0, 'db', { step: 0.5 }), P('ret', 'RETURN', -40, 12, 0, 'db', { step: 0.5 }), P01('mix', 'MIX', 1)];
const LOOPS = [[0], [1], [2], [3], [0, 1], [2, 3]].map((lp) => ({
  id: 'lop.' + lp.map((k) => k + 1).join(''), cat: 'lop', name: lp.length > 1 ? `Stereo Loop ${lp[0] + 1}+${lp[1] + 1}` : `FX Loop ${lp[0] + 1}`,
  short: lp.length > 1 ? `LOOP ${lp[0] + 1}+${lp[1] + 1}` : `LOOP ${lp[0] + 1}`, algo: 'loop', loop: lp, knobs: LOOPK,
}));

const STATIC = [...ATLAS_MODELS, ...EXTRA, ...LOOPS];
const STATIC_BY_ID = Object.fromEntries(STATIC.map((m) => [m.id, m]));
// user NAM / IR packs become models in the NAM & IR category
let packCache = { src: null, list: [] };
function packModels() {
  let src = [];
  try { src = getPackDefs() || []; } catch { src = []; }
  if (src === packCache.src) return packCache.list;
  const list = src.map((d) => {
    const names = (d.pack && d.pack.models ? d.pack.models : []).map((m) => m.name);
    const sel = names.length > 1 ? [P('model', 'MODEL', 0, names.length - 1, 0, 'int', { step: 1, names: names.map((x) => String(x).slice(0, 14).toUpperCase()) })] : [];
    const knobs = d.algo === 'ir'
      ? [...sel, P01('mix', 'MIX', 1), P('lowcut', 'LOW CUT', 20, 500, 20, 'hz', { log: true }), P('highcut', 'HIGH CUT', 2000, 20000, 20000, 'hz', { log: true }), DB('level', 'LEVEL')]
      : [...sel, DB('input', 'INPUT', -24, 24, 0), DB('output', 'OUTPUT', -24, 24, 0), P01('bass', 'BASS'), P01('mid', 'MID'), P01('treble', 'TREBLE'), P01('gate', 'GATE', 0)];
    return { id: 'nam:' + d.pack.id, cat: 'nam', name: d.name, short: String(d.name).slice(0, 9).toUpperCase(), algo: d.algo, opts: d.opts, knobs, pack: true };
  });
  packCache = { src, list };
  return list;
}
const MISSING = { id: 'missing', cat: 'utl', name: 'Missing Model', short: 'MISSING', algo: 'utility', opts: { kind: 'gain' }, knobs: [DB('level', 'LEVEL', -24, 24, 0)] };
export function nxModel(id) {
  if (!id) return null;
  if (STATIC_BY_ID[id]) return STATIC_BY_ID[id];
  if (id.startsWith('nam:')) return packModels().find((m) => m.id === id) || Object.assign({}, MISSING, { id, cat: 'nam', name: 'Missing pack', short: 'NO PACK' });
  return Object.assign({}, MISSING, { id });
}
export function nxModelsIn(cat) {
  if (cat === 'nam') return packModels();
  return STATIC.filter((m) => m.cat === cat);
}
export const nxModelCount = () => STATIC.length + packModels().length;
export function nxDefaults(m) {
  return m.knobs.map((s) => (m.defs && m.defs[s.p] !== undefined ? m.defs[s.p] : s.def));
}

// ================================================================== slots, presets, scenes
export const NX_ROWS = ['A', 'B'];
export const NX_PER_ROW = 8;
export const NX_SLOTS = [...NX_ROWS.flatMap((r) => [...Array(NX_PER_ROW)].map((_, i) => r + (i + 1)))];
export const NX_ROUTES = ['SERIAL', 'PARALLEL', 'DUAL'];
export const NX_MODES = ['STOMP', 'SCENE', 'PRESET', 'LOOPER'];
export const NX_MODE_COL = ['#2ee6d6', '#ffd23f', '#ff8a3d', '#ff3b5c'];
export const NX_SCENE_NAMES = ['VERSE', 'CHORUS', 'LEAD', 'CLEAN', 'AMBIENT', 'CRUNCH', 'SOLO', 'OUTRO'];
export const NX_SCENE_COLS = ['#2ee6d6', '#ff8a3d', '#ff4b4b', '#3fb6ff', '#a98bff', '#ffd23f', '#46d36f', '#ff5fb0'];
export const NX_BANKS = ['A', 'B', 'C', 'D'];
export const NX_PER_BANK = 7;
export const NX_NPRESETS = NX_BANKS.length * NX_PER_BANK;
export const NX_LOOPER = ['REC / DUB', 'PLAY / STOP', 'UNDO', 'REVERSE', 'STOP', 'CLEAR', 'EXIT'];

const slot = (m, on = 1, over = {}) => {
  const md = nxModel(m);
  const d = nxDefaults(md);
  return { m, on, v: md.knobs.map((s, i) => (over[s.p] !== undefined ? over[s.p] : d[i])) };
};
// a factory preset: name, slots, routing, scene overrides { scene: { slot: { on, v: { param: value } } } }, extras
function preset(name, slots, scenes = {}, o = {}) {
  return Object.assign({ name, slots, scenes, route: 0 }, o);
}
export const NX_FACTORY = [
  preset('BLUE HORIZON', { A1: slot('dyn.squeeze'), A2: slot('amp.silver', 1, { gain: 0.32 }), A3: slot('cab.212twin'), A4: slot('mod.chorus', 0, { mix: 0.4 }), A5: slot('dly.tape', 1, { mix: 0.18 }), A6: slot('rev.hall', 1, { mix: 0.2 }) },
    { 1: { A4: { on: 1 } }, 2: { A5: { v: { mix: 0.3 } } }, 4: { A5: { v: { mix: 0.35, feedback: 0.5 } }, A6: { v: { mix: 0.45, decay: 0.75 } } } }),
  preset('BRIT STACK', { A1: slot('dyn.gate', 1, { threshold: 0.25 }), A2: slot('drv.jade', 0, { gain: 0.25, level: 0.7 }), A3: slot('amp.brit800', 1, { gain: 0.55 }), A4: slot('cab.412gb'), A5: slot('eq.para', 1, { mid1gain: 2, mid1freq: 800 }), A6: slot('dly.analog', 1, { mix: 0.16 }), A7: slot('rev.plate', 1, { mix: 0.16 }) },
    { 2: { A2: { on: 1 }, A6: { v: { mix: 0.28 } } }, 3: { A3: { v: { gain: 0.25 } } } }),
  preset('TIDAL AMBIENT', { A1: slot('drv.velvet', 0), A2: slot('amp.lux', 1, { gain: 0.35 }), A3: slot('cab.112us'), A4: slot('mod.ensemble'), A5: slot('dly.modulated', 1, { mix: 0.3, feedback: 0.5, time: 520 }), B1: slot('dly.reverse', 1, { mix: 0.5, time: 640 }), B2: slot('rev.cloud', 1, { mix: 0.6 }) },
    { 4: { B2: { v: { mix: 0.8, decay: 0.9 } } } }, { route: 1, mix: { a: 1, b: 0.6, ap: -0.2, bp: 0.2 } }),
  preset('DUAL AMP WALL', { A1: slot('amp.chime', 1, { gain: 0.45 }), A2: slot('cab.212blue'), A3: slot('dly.pingpong', 1, { mix: 0.18 }), B1: slot('amp.calidual', 1, { gain: 0.45, level: -3 }), B2: slot('cab.412v30'), B3: slot('rev.room', 1, { mix: 0.15 }) },
    {}, { route: 1, mix: { a: 1, b: 1, ap: -0.6, bp: 0.6 } }),
  preset('WAH FUNK', { A1: slot('flt.wah', 0), A2: slot('dyn.vca', 1, { sustain: 0.5 }), A3: slot('amp.silver', 1, { gain: 0.35 }), A4: slot('cab.212twin'), A5: slot('mod.phaser', 0), A6: slot('rev.room', 1, { mix: 0.15 }) }, { 1: { A5: { on: 1 } } }),
  preset('SKY LEAD', { A1: slot('dyn.gate', 1, { threshold: 0.2 }), A2: slot('drv.jade', 1, { gain: 0.2, level: 0.72 }), A3: slot('amp.brownbe', 1, { gain: 0.5, level: -4 }), A4: slot('cab.412v30'), A5: slot('dly.digital', 1, { mix: 0.22, time: 400 }), A6: slot('rev.hall', 1, { mix: 0.18 }) },
    { 0: { A2: { on: 0 } }, 2: { A5: { v: { mix: 0.32 } } } }),
  preset('FX LOOP RIG', { A1: slot('drv.gilded', 1), A2: slot('lop.1'), A3: slot('amp.brit68', 1, { gain: 0.45 }), A4: slot('cab.412gb'), A5: slot('lop.2'), A6: slot('dly.tape', 1, { mix: 0.2 }), A7: slot('rev.spring', 1, { mix: 0.22 }) }),
  preset('METAL GRID', { A1: slot('dyn.gate', 1, { threshold: 0.32 }), A2: slot('drv.jade', 1, { gain: 0.08, level: 0.78, tone: 0.62 }), A3: slot('amp.panama', 1, { level: -5 }), A4: slot('cab.412uber'), A5: slot('eq.graphic', 1, { b3: -2, b5: 1.5 }), A6: slot('rev.room', 1, { mix: 0.1 }) }),
  preset('SURF SPRING', { A1: slot('amp.silver', 1, { gain: 0.4 }), A2: slot('cab.212twin'), A3: slot('mod.trem', 1, { rate: 0.55, depth: 0.55 }), A4: slot('dly.tape', 1, { mix: 0.18, time: 320 }), A5: slot('rev.spring', 1, { mix: 0.42, decay: 0.55 }) }, { 1: { A3: { on: 0 } } }),
  preset('SYNTH DREAMS', { A1: slot('dyn.vca'), A2: slot('fx.synth', 1, { mode: 6, dry: 0.25 }), A3: slot('mod.chorus', 1, { mix: 0.4 }), A4: slot('dly.pingpong', 1, { mix: 0.3 }), A5: slot('rev.cloud', 1, { mix: 0.4 }) }, { 1: { A2: { v: { mode: 1 } } } }),
  preset('OCTO FUZZ', { A1: slot('pit.octdown'), A2: slot('drv.fluff'), A3: slot('amp.citrus', 1, { gain: 0.35, level: -5 }), A4: slot('cab.412citrus'), A5: slot('mod.flanger', 0), A6: slot('rev.plate', 1, { mix: 0.16 }) }, { 1: { A5: { on: 1 } } }),
  preset('ACOUSTIC STAGE', { A1: slot('fx.acoustic', 1, { top: 0.25 }), A2: slot('dyn.opto', 1, { sustain: 0.2 }), A3: slot('eq.para', 1, { lowgain: -2, highgain: 1.5 }), A4: slot('mod.chorus', 0, { mix: 0.3 }), A5: slot('rev.hall', 1, { mix: 0.22 }),
    B1: slot('dyn.vca', 1, { sustain: 0.4 }), B2: slot('eq.para', 1, { lowcut: 90 }), B3: slot('dly.digital', 1, { mix: 0.12 }), B4: slot('rev.plate', 1, { mix: 0.2 }) }, {}, { route: 2, mix: { a: 1, b: 1, ap: 0, bp: 0 } }),
  preset('LOFI TAPE', { A1: slot('fx.lofi', 1, { mix: 0.7 }), A2: slot('amp.solid120'), A3: slot('cab.212jc'), A4: slot('mod.chorus', 1, { depth: 0.7 }), A5: slot('dly.lofi', 1, { mix: 0.28 }), A6: slot('rev.cloud', 1, { mix: 0.3 }) }),
  preset('ROTARY ORGAN', { A1: slot('dyn.vca'), A2: slot('amp.lux', 1, { gain: 0.5, level: -3.5 }), A3: slot('mod.rotary'), A4: slot('cab.112us'), A5: slot('rev.room', 1, { mix: 0.18 }) }, { 1: { A3: { v: { speed: 1 } } } }),
];
// per-preset output trim (dB), measured so every factory preset renders at -17 LUFS (scripts/nautica-test.js checks it)
export const NX_TRIM = {
  'BLUE HORIZON': 4.17,
  'BRIT STACK': -0.29,
  'TIDAL AMBIENT': 10.51,
  'DUAL AMP WALL': 9.85,
  'WAH FUNK': 2.99,
  'SKY LEAD': 3.82,
  'FX LOOP RIG': -3.81,
  'METAL GRID': 3.0,
  'SURF SPRING': 5.24,
  'SYNTH DREAMS': -3.08,
  'OCTO FUZZ': 4.29,
  'ACOUSTIC STAGE': 1.82,
  'LOFI TAPE': 3.91,
  'ROTARY ORGAN': 3.75,
};
export const NX_INIT = () => preset('EMPTY RIG', { A1: slot('amp.silver', 1, { gain: 0.35 }), A2: slot('cab.212twin') });

// footswitches: 0..13 floor, 14..15 above the treadles, 16..19 EXT FS jacks; pedals: 0..1 treadles, 2..3 EXT EXP jacks
export const NX_NFS = 20;
export const NX_FS_NAMES = [...[...Array(14)].map((_, i) => 'FS ' + (i + 1)), 'EXP 1 SW', 'EXP 2 SW', 'EXT FS 1', 'EXT FS 2', 'EXT FS 3', 'EXT FS 4'];
export const NX_EXP_NAMES = ['EXP 1', 'EXP 2', 'EXT EXP 1', 'EXT EXP 2'];
export const NX_EXP_PARAMS = ['exp1', 'exp2', '_xexp1', '_xexp2'];
const FS_DEFAULT = () => [...Array(NX_NFS)].map((_, i) => (i < 16 ? { t: 'auto' } : [{ t: 'pup' }, { t: 'pdn' }, { t: 'tap' }, { t: 'lpr', f: 0 }][i - 16]));
// on-screen controls of the side screen: two LED encoders, XY pad, two sliders
export const NX_SIDE = ['e1', 'e2', 'x', 'y', 's1', 's2'];
export const NX_SIDE_NAMES = { e1: 'ENCODER 1', e2: 'ENCODER 2', x: 'XY PAD X', y: 'XY PAD Y', s1: 'SLIDER 1', s2: 'SLIDER 2' };
const SIDE_DEFAULT = () => ({ e1: { t: 'auto' }, e2: { t: 'auto' }, x: { t: 'auto' }, y: { t: 'auto' }, s1: { t: 'alvl' }, s2: { t: 'blvl' } });

// expand a factory preset into the live state (8 scenes with full on/value snapshots)
export function nxLive(p) {
  const slots = clone(p.slots);
  const scenes = [];
  for (let i = 0; i < 8; i++) {
    const sc = { on: {}, v: {} };
    for (const k in slots) {
      const s = slots[k], over = p.scenes && p.scenes[i] && p.scenes[i][k];
      const md = nxModel(s.m);
      sc.on[k] = over && over.on !== undefined ? over.on : s.on;
      sc.v[k] = s.v.map((x, j) => (over && over.v && md.knobs[j] && over.v[md.knobs[j].p] !== undefined ? over.v[md.knobs[j].p] : x));
    }
    scenes.push(sc);
  }
  for (const k in slots) { slots[k].on = scenes[0].on[k]; slots[k].v = scenes[0].v[k].slice(); }
  return {
    name: p.name, slots, scenes, sc: 0, route: p.route | 0, mix: Object.assign({ a: 1, b: 1, ap: 0, bp: 0 }, p.mix || {}),
    fs: p.fs ? clone(p.fs) : FS_DEFAULT(), exp: p.exp ? clone(p.exp) : [{ t: 'auto' }, { t: 'auto' }, { t: 'none' }, { t: 'none' }], eon: p.eon ? p.eon.slice() : [1, 1, 1, 1],
    side: p.side ? clone(p.side) : SIDE_DEFAULT(), scn: p.scn ? p.scn.slice() : NX_SCENE_NAMES.slice(), trim: p.trim ?? NX_TRIM[p.name] ?? 0,
  };
}
// logical outputs: 0 STEREO 1, 1 STEREO 2, 2..5 OUT 1..4 pairs, 6 PHONES, 7 XLR
export const NX_OUTS = ['STEREO 1', 'STEREO 2', 'OUT 1 L/R', 'OUT 2 L/R', 'OUT 3 L/R', 'OUT 4 L/R', 'PHONES', 'XLR'];
export const NX_OUT_SRC = ['MAIN', 'PATH A', 'PATH B', 'DRY DI', 'OFF'];
const OUT_DEFAULT = () => [0, 0, 0, 1, 2, 3, 0, 0].map((src, j) => ({ src, lvl: 0, m: j < 6 && src !== 3 ? 1 : 0, mono: 0 }));
export const NX_XFO = ['ASSIGNED SWITCH', 'TEMPO PULSE', 'TUNER ON', 'LOOPER RUNNING', 'SCENE 2+ ACTIVE', 'EXP 1 ON', 'EXP 2 ON'];
export const NX_XEO = ['EXP 1', 'EXP 2', 'EXT EXP 1', 'EXT EXP 2', 'XY PAD X', 'XY PAD Y', 'SLIDER 1', 'SLIDER 2', 'MASTER VOL'];
export const NX_STRIPS = ['PRESET & SCENE', 'LEVELS', 'FOCUSED BLOCK', 'TEMPO & TUNER', 'PEDALS', 'SIGNAL PATH'];
export const NX_GLOBAL = {
  bpm: 120, sync: 0, ref: 440, theme: 0, strip: [0, 1], fsB: 1, dmode: 0, tapLed: 1, gate: 0, volPos: 0, lpLvl: 0.9,
  gtr: 0, aux: 0, auxTo: 0, outs: null, xfo: 0, xeo: 0, xlrLift: 0, lcdInv: 0, encSens: 1,
};
export function nxDefault() {
  const g = Object.assign({}, NX_GLOBAL, { strip: [0, 1], outs: OUT_DEFAULT() });
  return Object.assign(nxLive(NX_FACTORY[0]), { pi: 0, mode: 0, g, ver: 1 });
}
export const nxState = (ui) => parseSt(ui._st, nxDefault);
export const nxOuts = (g) => (g && Array.isArray(g.outs) && g.outs.length === 8 ? g.outs : OUT_DEFAULT());
export function nxPresetName(st, pi) {
  const u = st.user && st.user[pi];
  if (u) return u.name;
  const f = NX_FACTORY[pi];
  return f ? f.name : null;
}
export const nxPresetLabel = (st, pi = st.pi | 0) => NX_BANKS[Math.floor(pi / NX_PER_BANK)] + ((pi % NX_PER_BANK) + 1) + '  ' + (nxPresetName(st, pi) || st.name || 'EMPTY RIG');
export function nxPresetSrc(st, pi) {
  if (st.user && st.user[pi]) return clone(st.user[pi]);
  return nxLive(NX_FACTORY[pi] || Object.assign(NX_INIT(), {}));
}

// ================================================================== engine graph ('rig' algorithm)
export const NX_IO = {
  ins: ['GUITAR IN', 'AUX IN', 'RETURN 1', 'RETURN 2', 'RETURN 3', 'RETURN 4'],
  outs: ['STEREO OUT 1', 'STEREO OUT 2', 'OUT 1 L', 'OUT 1 R', 'OUT 2 L', 'OUT 2 R', 'OUT 3 L', 'OUT 3 R', 'OUT 4 L', 'OUT 4 R', 'PHONES', 'XLR OUT', 'SEND 1', 'SEND 2', 'SEND 3', 'SEND 4'],
};
export const NX_JACK_KINDS = { i1: 'trs', o0: 'trs', o1: 'trs', o10: 'phones', o11: 'xlr' };
// engine channels per UI jack (trs / phones carry two)
export const NX_IN_CH = [[0], [1, 2], [3], [4], [5], [6]];
export const NX_OUT_CH = [[0, 1], [2, 3], [4], [5], [6], [7], [8], [9], [10], [11], [12, 13], [14], [15], [16], [17], [18]];
const ENGINE_OUTS = [
  { o: 0, ch: 0 }, { o: 0, ch: 1 }, { o: 1, ch: 0 }, { o: 1, ch: 1 },
  { o: 2, ch: 0 }, { o: 2, ch: 1 }, { o: 3, ch: 0 }, { o: 3, ch: 1 }, { o: 4, ch: 0 }, { o: 4, ch: 1 }, { o: 5, ch: 0 }, { o: 5, ch: 1 },
  { o: 6, ch: 0 }, { o: 6, ch: 1 }, { o: 7, mono: true }, { send: 0 }, { send: 1 }, { send: 2 }, { send: 3 },
];
const pathHas = (st, r) => NX_SLOTS.some((k) => k[0] === r && st.slots[k]);
// serial when one of the paths is empty (a parallel split would mix in dry signal)
export const nxRoute = (st) => ((st.route | 0) === 2 ? 2 : (st.route | 0) === 1 && pathHas(st, 'A') && pathHas(st, 'B') ? 1 : 0);
export function nxRig(st) {
  const subs = [{ prefix: 'tu', algo: 'tuner', on: false }, { prefix: 'gate', algo: 'gate', on: false }, { prefix: 'pv', algo: 'volume' }];
  const lanes = { pre: [0, 1, 2], a: [], b: [], post: [] };
  for (const k of NX_SLOTS) {
    const s = st.slots[k], m = s && nxModel(s.m);
    if (!m) continue;
    lanes[k[0] === 'A' ? 'a' : 'b'].push(subs.length);
    subs.push(m.loop ? { prefix: k, loop: m.loop } : { prefix: k, algo: m.algo, opts: m.opts || {} });
  }
  lanes.post.push(subs.length, subs.length + 1);
  subs.push({ prefix: 'vol', algo: 'volume' }, { prefix: 'lp', algo: 'looper', opts: { tracks: 1, maxSec: 120 } });
  return { subs, ...lanes, ins: { gtr: 0, aux: [1, 2], ret: [3, 4, 5, 6] }, outs: ENGINE_OUTS, nOuts: 8 };
}
export const nxLooperArg = (st) => (nxRig(st).subs.length - 1) * 100;

// ================================================================== assignments (footswitches, pedals, side controls)
export function nxStompSlots(st) {
  return NX_SLOTS.filter((k) => st.slots[k]).slice(0, 14);
}
const isWah = (m) => m && m.algo === 'wah' && m.set && m.set.mode === 0;
// every assignable parameter: { s, i, name }
export function nxParamTargets(st) {
  const out = [];
  for (const k of NX_SLOTS) {
    const s = st.slots[k], m = s && nxModel(s.m);
    if (!m) continue;
    m.knobs.forEach((sp, i) => out.push({ s: k, i, name: `${k} ${m.short} ${sp.l}` }));
  }
  return out;
}
// resolve an expression pedal assignment -> { tg: [{s, i}], blk, vol, name } (null = nothing)
export function nxExpTarget(st, i) {
  const a = (st.exp && st.exp[i]) || { t: 'none' };
  if (a.t === 'none') return null;
  if (a.t === 'vol') return { vol: true, name: 'VOLUME' };
  if (a.t === 'par') {
    const s = st.slots[a.s], m = s && nxModel(s.m);
    if (!m || !m.knobs[a.i]) return { tg: [], name: 'MISSING', missing: true };
    return { tg: [{ s: a.s, i: a.i, lo: a.lo ?? 0, hi: a.hi ?? 1 }], blk: a.blk ? a.s : null, name: `${a.s} ${m.knobs[a.i].l}` };
  }
  // auto
  if (i === 0) {
    const k = NX_SLOTS.find((x) => st.slots[x] && isWah(nxModel(st.slots[x].m)));
    if (k) return { tg: [{ s: k, i: 0, lo: 0, hi: 1 }], blk: k, name: `${k} WAH`, auto: true };
    return { vol: true, name: 'VOLUME', auto: true };
  }
  if (i === 1) {
    for (const algo of ['delay', 'reverb']) {
      const k = NX_SLOTS.find((x) => st.slots[x] && nxModel(st.slots[x].m).algo === algo);
      if (k) {
        const m = nxModel(st.slots[k].m), j = m.knobs.findIndex((sp) => sp.p === 'mix');
        if (j >= 0) return { tg: [{ s: k, i: j, lo: 0, hi: 1 }], name: `${k} ${m.short} MIX`, auto: true };
      }
    }
  }
  return null;
}
export const nxExpOn = (st, i) => {
  const t = nxExpTarget(st, i);
  if (t && t.blk) return !!(st.slots[t.blk] && st.slots[t.blk].on);
  return !!((st.eon || [1, 1, 1, 1])[i] ?? 1);
};
// resolve a side control: { s, i } | { mix: 'a' | 'b' } | null
export function nxSideTarget(st, key, focus) {
  const a = (st.side && st.side[key]) || { t: 'auto' };
  if (a.t === 'alvl') return { mix: 'a', name: 'PATH A LEVEL' };
  if (a.t === 'blvl') return { mix: 'b', name: 'PATH B LEVEL' };
  if (a.t === 'par') {
    const s = st.slots[a.s], m = s && nxModel(s.m);
    return m && m.knobs[a.i] ? { s: a.s, i: a.i, name: `${a.s} ${m.knobs[a.i].l}` } : null;
  }
  if (a.t === 'none') return null;
  // auto: follows the focused block (encoder 1 = focused parameter, encoder 2 = mix / level, XY = params 1 and 2)
  const fs = focus && focus.s, s = fs && st.slots[fs], m = s && nxModel(s.m);
  if (!m) return null;
  let i = 0;
  if (key === 'e1') i = clamp(focus.i | 0, 0, m.knobs.length - 1);
  else if (key === 'e2') { i = m.knobs.findIndex((sp) => sp.p === 'mix'); if (i < 0) i = m.knobs.findIndex((sp) => sp.p === 'level'); if (i < 0) i = Math.min(1, m.knobs.length - 1); }
  else if (key === 'x') i = 0;
  else if (key === 'y') i = Math.min(1, m.knobs.length - 1);
  else if (key === 's1') i = Math.min(2, m.knobs.length - 1);
  else i = Math.min(3, m.knobs.length - 1);
  return { s: fs, i, name: `${fs} ${m.knobs[i].l}`, auto: true };
}

// the function a footswitch has right now (mode aware): { a: assignment, label, sub, color, lit }
const looperOf = (lp) => (lp && lp.tracks && lp.tracks[0]) || null;
export function nxFsFunc(st, i) {
  const mode = st.mode | 0;
  if (i < 14) {
    if (mode === 1 && i < 8) return { t: 'scn', i };
    if (mode === 2) {
      if (i < 7) return { t: 'prs', i };
      if (i === 7) return { t: 'bdn' };
      if (i === 13) return { t: 'bup' };
      return { t: 'scn', i: i - 8 };
    }
    if (mode === 3 && i < 7) return i === 6 ? { t: 'lpx' } : { t: 'lpr', f: i };
  }
  const a = (st.fs && st.fs[i]) || { t: 'auto' };
  if (a.t !== 'auto') return a;
  if (i === 14 || i === 15) return { t: 'expb', i: i - 14 };
  if (i < 14) {
    const k = nxStompSlots(st)[i];
    return k ? { t: 'blk', s: k } : { t: 'none' };
  }
  return { t: 'none' };
}
export function nxFsInfo(st, i, ctx = {}) {
  const a = nxFsFunc(st, i);
  const W = '#e8ecf3';
  switch (a.t) {
    case 'blk': {
      const s = st.slots[a.s], m = s && nxModel(s.m);
      if (!m) return { label: a.s + ' EMPTY', sub: 'BLOCK', color: '#4a5260', lit: false };
      return { label: m.short, sub: a.s + ' ' + NX_CAT[m.cat].short, color: NX_CAT[m.cat].color, lit: !!s.on };
    }
    case 'scn': return { label: (st.scn && st.scn[a.i]) || NX_SCENE_NAMES[a.i], sub: 'SCENE ' + (a.i + 1), color: NX_SCENE_COLS[a.i], lit: (st.sc | 0) === a.i };
    case 'prs': {
      const bank = Math.floor((st.pi | 0) / NX_PER_BANK), pi = bank * NX_PER_BANK + a.i;
      return { label: nxPresetName(st, pi) || 'EMPTY RIG', sub: NX_BANKS[bank] + (a.i + 1), color: '#ff8a3d', lit: (st.pi | 0) === pi };
    }
    case 'pup': return { label: 'PRESET UP', sub: 'PRESET', color: W, lit: false };
    case 'pdn': return { label: 'PRESET DOWN', sub: 'PRESET', color: W, lit: false };
    case 'bup': return { label: 'BANK UP', sub: 'BANK ' + NX_BANKS[Math.floor((st.pi | 0) / NX_PER_BANK)], color: W, lit: false };
    case 'bdn': return { label: 'BANK DOWN', sub: 'BANK ' + NX_BANKS[Math.floor((st.pi | 0) / NX_PER_BANK)], color: W, lit: false };
    case 'tap': return { label: 'TAP', sub: Math.round((st.g && st.g.bpm) || 120) + ' BPM', color: '#ff3b5c', lit: false };
    case 'tun': return { label: 'TUNER', sub: 'TUNER', color: '#46d36f', lit: !!ctx.tuner };
    case 'lpx': return { label: 'EXIT', sub: 'LOOPER', color: W, lit: false };
    case 'lpr': {
      const t = looperOf(ctx.lp), s = t ? t.state : 0;
      const lit = a.f === 0 ? s === 1 || s === 3 : a.f === 1 ? s === 2 || s === 3 : a.f === 3 ? !!(t && t.rev) : a.f === 4 ? s === 4 : false;
      const col = a.f === 0 ? (s === 3 ? '#ffb21f' : '#ff3b30') : a.f === 1 ? '#46d36f' : a.f === 3 ? '#3fb6ff' : a.f === 4 ? '#a98bff' : W;
      return { label: NX_LOOPER[a.f] || '', sub: 'LOOPER', color: col, lit };
    }
    case 'expb': {
      const t = nxExpTarget(st, a.i);
      return { label: t && t.blk ? nxModel(st.slots[t.blk].m).short : 'EXP ' + (a.i + 1), sub: t && t.blk ? 'EXP ' + (a.i + 1) + ' + BLOCK' : 'EXP ' + (a.i + 1) + ' ON/OFF', color: '#2ee6d6', lit: nxExpOn(st, a.i) };
    }
    case 'par': {
      const s = st.slots[a.s], m = s && nxModel(s.m), sp = m && m.knobs[a.i];
      if (!sp) return { label: 'MISSING', sub: 'PARAM', color: '#4a5260', lit: false };
      return { label: sp.l, sub: a.s + ' ' + m.short, color: NX_CAT[m.cat].color, lit: specPos(sp, s.v[a.i] ?? sp.def) > 0.5 };
    }
    case 'xfs': return { label: 'EXT FS OUT', sub: 'CONTROL', color: '#ffd23f', lit: !!ctx.xfo };
    case 'mode': return { label: 'NEXT MODE', sub: 'MODE', color: W, lit: false };
    default: return { label: '', sub: '', color: '#2a2f38', lit: false };
  }
}
// assignment pickers: [{ label, a }]
export function nxFsChoices(st, i) {
  const out = [{ label: 'AUTO', a: { t: 'auto' } }, { label: 'NONE', a: { t: 'none' } }];
  for (const k of NX_SLOTS) {
    const s = st.slots[k], m = s && nxModel(s.m);
    if (m) out.push({ label: `BLOCK ${k} ${m.short}`, a: { t: 'blk', s: k } });
  }
  for (let j = 0; j < 8; j++) out.push({ label: `SCENE ${j + 1} ${(st.scn && st.scn[j]) || NX_SCENE_NAMES[j]}`, a: { t: 'scn', i: j } });
  out.push({ label: 'PRESET UP', a: { t: 'pup' } }, { label: 'PRESET DOWN', a: { t: 'pdn' } }, { label: 'BANK UP', a: { t: 'bup' } }, { label: 'BANK DOWN', a: { t: 'bdn' } });
  out.push({ label: 'TAP TEMPO', a: { t: 'tap' } }, { label: 'TUNER', a: { t: 'tun' } }, { label: 'NEXT MODE', a: { t: 'mode' } });
  NX_LOOPER.slice(0, 6).forEach((l, f) => out.push({ label: 'LOOPER ' + l, a: { t: 'lpr', f } }));
  out.push({ label: 'EXP 1 ON/OFF', a: { t: 'expb', i: 0 } }, { label: 'EXP 2 ON/OFF', a: { t: 'expb', i: 1 } }, { label: 'EXT FS OUT', a: { t: 'xfs' } });
  for (const t of nxParamTargets(st)) out.push({ label: 'TOGGLE ' + t.name, a: { t: 'par', s: t.s, i: t.i } });
  void i;
  return out;
}
export function nxExpChoices(st) {
  const out = [{ label: 'AUTO', a: { t: 'auto' } }, { label: 'NONE', a: { t: 'none' } }, { label: 'VOLUME PEDAL', a: { t: 'vol' } }];
  for (const t of nxParamTargets(st)) {
    const m = nxModel(st.slots[t.s].m);
    out.push({ label: t.name, a: { t: 'par', s: t.s, i: t.i, blk: isWah(m) && t.i === 0 ? 1 : 0 } });
  }
  return out;
}
export function nxSideChoices(st) {
  const out = [{ label: 'AUTO (FOCUSED BLOCK)', a: { t: 'auto' } }, { label: 'NONE', a: { t: 'none' } }, { label: 'PATH A LEVEL', a: { t: 'alvl' } }, { label: 'PATH B LEVEL', a: { t: 'blvl' } }];
  for (const t of nxParamTargets(st)) out.push({ label: t.name, a: { t: 'par', s: t.s, i: t.i } });
  return out;
}
export const nxSameA = (x, y) => JSON.stringify(x || { t: 'auto' }) === JSON.stringify(y || { t: 'auto' });

// ================================================================== derive: UI state -> engine params
// volume dials: 0.8 = unity, log taper, bottom = off
export const nxVolDb = (pos) => (pos < 0.02 ? -60 : clamp(40 * Math.log10(pos / 0.8), -60, 6));
export const nxVolFmt = (pos) => (pos < 0.02 ? 'OFF' : (nxVolDb(pos) > 0 ? '+' : '') + nxVolDb(pos).toFixed(1) + ' dB');
const CAL = -4; // base output trim; each preset adds its own (st.trim)
let dcache = { key: '', o: null };
function nxDerive(ui) {
  const key = [ui._st, ui.exp1, ui.exp2, ui._xexp1, ui._xexp2, ui._emv, ui._tuner, ui._mute, ui.mvol, ui.pvol, ui.xvol].join('|');
  if (dcache.key === key && dcache.o) return dcache.o;
  const st = nxState(ui);
  const g = Object.assign({}, NX_GLOBAL, st.g || {});
  const o = {};
  const tuner = (ui._tuner ?? 0) > 0.5;
  o['tu.on'] = tuner ? 1 : 0; o['tu.calib'] = g.ref || 440; o['tu.mute'] = 1;
  o['gate.on'] = g.gate > 0.01 ? 1 : 0; o['gate.threshold'] = g.gate;
  // pedals: values from the treadles / EXT EXP jacks, applied once a pedal has moved since the preset loaded
  const moved = ui._emv | 0;
  const over = {};
  let vol = 1;
  for (let i = 0; i < 4; i++) {
    const t = nxExpTarget(st, i);
    if (!t || !nxExpOn(st, i)) continue;
    const v = clamp(ui[NX_EXP_PARAMS[i]] ?? (i === 0 ? 1 : 0), 0, 1);
    if (t.vol) { vol = Math.min(vol, v); continue; }
    if (!(moved & (1 << i))) continue;
    for (const x of t.tg) over[x.s + '|' + x.i] = x.lo + (x.hi - x.lo) * v;
  }
  const post = (g.volPos | 0) === 1;
  o['pv.on'] = post ? 0 : 1; o['pv.pos'] = post ? 1 : vol;
  o['vol.on'] = post ? 1 : 0; o['vol.pos'] = post ? vol : 1;
  for (const k of NX_SLOTS) {
    const s = st.slots[k], m = s && nxModel(s.m);
    if (!m) continue;
    const pre = k + '.';
    o[pre + 'on'] = s.on ? 1 : 0;
    if (m.set) for (const p in m.set) o[pre + p] = m.set[p];
    m.knobs.forEach((sp, i) => {
      let v = s.v[i] ?? sp.def;
      const ov = over[k + '|' + i];
      if (ov !== undefined) v = specTo(sp, ov);
      // tempo sync: delay time follows the global BPM and the SUBDIV choice
      if (g.sync && m.algo === 'delay' && sp.p === 'time') v = (60000 / (g.bpm || 120)) * [1, 0.75, 0.5, 2 / 3, 0.25][Math.round(s.v[10] ?? 0)];
      o[pre + sp.p] = v;
    });
    if (m.algo === 'delay' && g.sync) o[pre + 'subdiv'] = 0;
  }
  const mix = Object.assign({ a: 1, b: 1, ap: 0, bp: 0 }, st.mix || {});
  o.route = nxRoute(st); o.aLvl = mix.a; o.bLvl = mix.b; o.aPan = mix.ap; o.bPan = mix.bp;
  o.gtr = g.gtr || 0; o.aux = g.aux || 0; o.auxTo = g.auxTo | 0;
  const mute = (ui._mute ?? 0) > 0.5;
  const mdb = nxVolDb(ui.mvol ?? 0.8), pdb = nxVolDb(ui.pvol ?? 0.8), xdb = nxVolDb(ui.xvol ?? 0.8);
  nxOuts(g).forEach((x, j) => {
    let lv = (x.lvl || 0) + CAL + ((x.src | 0) === 3 ? 0 : st.trim || 0) + (x.m ? mdb : 0) + (j === 6 ? pdb : 0) + (j === 7 ? xdb : 0);
    if (mute && j !== 6) lv = -60;
    o[`o${j}.src`] = x.src | 0; o[`o${j}.lvl`] = clamp(lv, -60, 12); o[`o${j}.mono`] = x.mono | 0;
  });
  o['lp.master'] = g.lpLvl ?? 0.9; o['lp.sync'] = 0;
  dcache = { key, o };
  return o;
}

// ================================================================== definition
// nav state written by screens-nautica.js (the button LEDs read the open page)
export const nxNav = {};
const PF = (name, o = {}) => FOOT(Object.assign({ action: 'toggle', p: '_p.' + name, def: 0, virtual: true, style: 'soft', label: '' }, o));
const PB = (name, label, page, o = {}) => BTN(label, Object.assign({ p: '_p.' + name, toggle: true, virtual: true, shape: 'rect', w: 30, h: 11, role: 'b_' + name,
  led: true, ledColor: '#2ee6d6', bind: 'fn', ledFn: (ui, b) => (nxNav[b.id] && page.includes(nxNav[b.id].page) ? '#2ee6d6' : null) }, o));
export const NX_BUTTONS = [
  ['lib', 'LIBRARY', ['lib']], ['amp', 'AMP', ['blk']], ['pre', 'PRESETS', ['pre']], ['scn', 'SCENES', ['scn']], ['lpr', 'LOOPER', ['lpr']],
  ['tun', 'TUNER', ['tun']], ['asg', 'ASSIGN', ['asg', 'asgl']], ['io', 'I/O', ['io']], ['glb', 'GLOBAL', ['glb']],
];
const knobs10 = [...Array(10)].map((_, i) => K('k' + (i + 1), '', { def: 0.5, virtual: true, role: 'k' + i, labelPos: 'none', display: (v) => Math.round(v * 100) + '%' }));

export const nautica = [
  TZ({ id: 'tz.nautica', name: 'Nautica XL', cat: 'Multi-FX', kind: 'Multi-FX', form: 'nautica', color: '#1c2026', accent: '#2ee6d6', logo: 'NAUTICA', noStd: true,
    typeName: 'Flagship floor processor · 2 x 8 slots · 4 FX loops · 8 outputs', tags: ['headrush', 'modeler', 'scenes', 'looper', 'fx loop', 'nam', 'flagship'],
    stereo: 'stereo', ports: NX_IO, monoPorts: NX_IO, stereoPorts: NX_IO, jackKinds: NX_JACK_KINDS, loopReturns: [2, 3, 4, 5], cost: 6, noBypassClick: true,
    algo: 'rig', opts: nxRig(nxDefault()),
    ctrl: {
      ins: [1, 2, 3, 4].map((i) => ({ label: 'EXT FS ' + i, param: '_xfs' + i })).concat([1, 2].map((i) => ({ label: 'EXT EXP ' + i, param: '_xexp' + i }))),
      outs: [{ label: 'EXT FS OUT', source: 'foot' }, { label: 'EXT EXP OUT', source: 'param:_xeo' }],
    },
    controls: [
      SCREEN('nxl-main', { w: 560, h: 250, interactive: true, bg: '#070a0e', role: 'main' }),
      SCREEN('nxl-strip', { row: 0, w: 560, h: 22, interactive: true, bg: '#03060a', role: 'strip0' }),
      SCREEN('nxl-strip', { row: 1, w: 560, h: 22, interactive: true, bg: '#03060a', role: 'strip1' }),
      SCREEN('nxl-side', { w: 138, h: 306, interactive: true, bg: '#05080c', role: 'side' }),
      SCREEN('nxl-io', { w: 1204, h: 9, bg: 'transparent', bezel: 'transparent', role: 'io' }),
      ...[...Array(16)].map((_, i) => SCREEN('nxl-fs', { idx: i, w: 84, h: 22, bg: '#05070a', role: 'lcd' + i })),
      ...[0, 1].map((i) => SCREEN('nxl-exp', { idx: i, w: 116, h: 24, bg: '#05070a', role: 'xlcd' + i })),
      ...knobs10,
      K('mvol', 'MASTER', { def: 0.8, virtual: true, role: 'mvol', display: nxVolFmt }),
      K('pvol', 'PHONES', { def: 0.8, virtual: true, role: 'pvol', display: nxVolFmt }),
      K('xvol', 'XLR', { def: 0.8, virtual: true, role: 'xvol', display: nxVolFmt }),
      ...NX_BUTTONS.map(([n, l, pg]) => PB(n, l, pg)),
      BTN('MUTE', { p: '_mute', toggle: true, virtual: true, shape: 'rect', w: 30, h: 11, role: 'b_mute', led: true, ledColor: '#ff3b30', bind: 'param:_mute' }),
      ...[...Array(16)].map((_, i) => PF('fs' + (i + 1), { role: 'fs' + i })),
      PF('mode', { label: 'MODE', role: 'fsmode' }), PF('tap', { label: 'TAP · TUNER', role: 'fstap' }),
      LED({ bind: 'fn', r: 2.4, color: '#ff3b5c', role: 'tapled', ledFn: (ui, b, st, now) => {
        if ((ui._tuner ?? 0) > 0.5) return '#46d36f';
        const s = nxState(ui);
        if (s.g && s.g.tapLed === 0) return null;
        return now % (60000 / ((s.g && s.g.bpm) || 120)) < 70 ? '#ff3b5c' : null;
      } }),
      LED({ bind: 'fn', r: 2.4, color: '#2ee6d6', role: 'modeled', ledFn: (ui) => NX_MODE_COL[nxState(ui).mode | 0] }),
      TREADLE('exp1', { def: 1, virtual: true, role: 'exp1', logo: 'EXP 1', color: '#15181d', logoColor: '#7c8697', logoFont: "'Oswald', sans-serif", logoSize: 13 }),
      TREADLE('exp2', { def: 0, virtual: true, role: 'exp2', logo: 'EXP 2', color: '#15181d', logoColor: '#7c8697', logoFont: "'Oswald', sans-serif", logoSize: 13 }),
    ],
    derive: nxDerive,
    initParams: { _st: JSON.stringify(nxDefault()) },
    desc: 'Flagship floor processor with a touch screen: two paths of eight blocks (series, parallel or two separate rigs), amps, cabs, NAM and IR packs, 100+ effects, four FX loops, 8 scenes, 28 presets, a looper and a tuner. 14 assignable footswitches with their own displays, two treadles, EXT switch and pedal jacks in and out, and outputs you can route anywhere.' }),
];
