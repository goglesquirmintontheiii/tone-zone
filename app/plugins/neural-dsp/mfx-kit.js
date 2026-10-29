// Tone Zone "modeler kit": the shared engine behind the big multi-effects units (block slots that hold any model,
// category → model menus, parameter pages on the knobs under the screen, snapshots / scenes, internal presets,
// tap tempo, tuner, looper, expression pedals).
//
// The SAME file ships in every plugin that uses it (line6, boss, fractal-audio, neural-dsp, headrush, kemper) so a
// plugin never depends on another one being installed. Keep the copies identical (edit plugins/line6/mfx-kit.js,
// then copy it over the others).
//
// How it works
// * Every slot i of a unit keeps its state in hidden block params (underscore names never reach the engine):
//   `_s<i>m` model index (0 = empty), `_s<i>on` on/off, `_s<i>p<j>` parameter j as a 0..1 knob position.
// * The engine block is a `chain` whose sub-blocks are built from the slots that hold a model (one sub-block per
//   used slot, nothing for empty slots), so CPU only goes to what is in the patch. The chain lives in the block
//   instance's own `opts` (`block.opts.chain`, saved with the preset); whenever a slot's model or the routing
//   changes the kit rebuilds it and re-syncs the graph. Parallel paths are nested chains in a `group`.
// * `derive` turns the slot params into engine params (`s3.gain`, `pa.s5.time`, …).
// * Navigation (current view, cursor, selected slot, page) is UI-only state in `state.ui[blockId].mfx`;
//   snapshots / internal presets are stored on the block object (`block.mfx`) so they save with the preset.
// * Model indices are positions in LIB: only ever APPEND models (saved presets refer to them by index).

export const KIT_VERSION = 1;

// ------------------------------------------------------------------ parameter descriptors
// P(name, engineKey, default, { min, max, curve: 'log', step, f: format, names, fn, exp, sync })
//  f: 'ten' 0–10 · 'pct' · 'db' · 'ms' · 'hz' · 'st' semitones · 'n' named steps · 'x' raw · 'onoff'
//  fn(pos) → { relKey: value, … } for one knob driving several engine params (k is then only a label key)
//  exp: 1 | 2 → follows EXP 1 (wah / whammy) or EXP 2 (volume); sync: true → set by tap tempo (time in ms)
const P = (n, k, d, o = {}) => Object.assign({ n, k, d, min: 0, max: 1, f: 'ten' }, o);
const fmtHz = (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + 'kHz' : Math.round(v) + 'Hz');
export function pVal(p, pos) {
  pos = Math.max(0, Math.min(1, pos));
  let v = p.curve === 'log' && p.min > 0 ? p.min * Math.pow(p.max / p.min, pos) : p.min + (p.max - p.min) * pos;
  if (p.step) v = Math.round(v / p.step) * p.step;
  if (p.f === 'n') v = Math.round(v);
  return v;
}
export function pPos(p, v) {
  if (p.curve === 'log' && p.min > 0) return Math.max(0, Math.min(1, Math.log(v / p.min) / Math.log(p.max / p.min)));
  return Math.max(0, Math.min(1, (v - p.min) / (p.max - p.min || 1)));
}
export function pText(p, pos) {
  const v = pVal(p, pos);
  switch (p.f) {
    case 'pct': return Math.round(((v - p.min) / (p.max - p.min || 1)) * 100) + '%';
    case 'db': return (v > 0 ? '+' : '') + v.toFixed(1) + 'dB';
    case 'ms': return v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms';
    case 'hz': return fmtHz(v);
    case 'st': return (v > 0 ? '+' : '') + Math.round(v) + 'st';
    case 'n': return (p.names && p.names[v]) || String(v);
    case 'x': return v.toFixed(2);
    case 'onoff': return v > 0.5 ? 'On' : 'Off';
    default: return (((v - p.min) / (p.max - p.min || 1)) * 10).toFixed(1);
  }
}

// ------------------------------------------------------------------ categories
export const CATS = {
  dist: { n: 'Distortion', s: 'DIST' },
  dyn: { n: 'Dynamics', s: 'DYN' },
  eq: { n: 'EQ', s: 'EQ' },
  mod: { n: 'Modulation', s: 'MOD' },
  dly: { n: 'Delay', s: 'DLY' },
  rev: { n: 'Reverb', s: 'REV' },
  pitch: { n: 'Pitch/Synth', s: 'PITCH' },
  filter: { n: 'Filter', s: 'FILT' },
  wah: { n: 'Wah', s: 'WAH' },
  vol: { n: 'Volume/Pan', s: 'VOL' },
  amp: { n: 'Amp+Cab', s: 'AMP' },
  ampo: { n: 'Amp', s: 'AMP' },
  cab: { n: 'Cab', s: 'CAB' },
};

// ------------------------------------------------------------------ model library (APPEND ONLY)
const lvl = (d = 0.5) => P('Level', 'level', d);
const mix = (d = 0.35, k = 'mix') => P('Mix', k, d, { f: 'pct' });
const D = (id, n, opts, extra = {}) => Object.assign({ id, cat: 'dist', n, algo: 'drive', opts, P: [P('Drive', 'gain', 0.5), P('Tone', 'tone', 0.5), lvl(0.5)], cost: 0.5 }, extra);
const MDL = (o) => Object.assign({ cost: 0.4 }, o);
const DLY = (id, n, mode, extra = {}) => MDL(Object.assign({
  id, cat: 'dly', n, algo: 'delay', opts: { maxMs: 2000 }, set: { mode },
  P: [P('Time', 'time', 420, { min: 20, max: 2000, curve: 'log', f: 'ms', sync: true }), P('Feedback', 'feedback', 0.35, { f: 'pct' }), mix(0.3), P('Tone', 'tone', 0.6), P('Mod Rate', 'modrate', 0.3), P('Mod Depth', 'moddepth', 0.1), P('Low Cut', 'lowcut', 0.1), P('Spread', 'spread', 0.5)],
  cost: 0.5,
}, extra));
const REV = (id, n, mode, extra = {}) => MDL(Object.assign({
  id, cat: 'rev', n, algo: 'reverb', set: { mode },
  P: [P('Decay', 'decay', 0.5), mix(0.3), P('Pre-delay', 'predelay', 20, { min: 0, max: 250, f: 'ms' }), P('Tone', 'tone', 0.6), P('Low Cut', 'lowcut', 0.15), P('Mod', 'mod', 0.3), P('Size', 'size', 0.5), P('Diffusion', 'diffusion', 0.7)],
  cost: 1,
}, extra));
const AMPP = (g, m, t = 0) => [
  P('Drive', 'a.gain', g), P('Bass', 'a.bass', 0.5), P('Mid', 'a.mid', 0.5), P('Treble', 'a.treble', 0.55), P('Presence', 'a.presence', 0.5), P('Master', 'a.master', m),
  P('Ch Vol', 'a.level', t, { min: -18, max: 12, f: 'db' }), P('Sag', 'a.sag', 0.5),
];
const CABP = [P('Low Cut', 'c.lowcut', 70, { min: 20, max: 500, curve: 'log', f: 'hz' }), P('High Cut', 'c.highcut', 9000, { min: 2000, max: 20000, curve: 'log', f: 'hz' }), P('Mic Dist', 'c.m1dist', 0.15, { f: 'pct' }), P('Mic Pos', 'c.m1pos', 0.3, { max: 1.3, f: 'x' })];
// measured offline (default knobs, guitar riff): level above dry → channel volume trims to land near +3 dB
const AC_DB = {usdlx: 5.4, ustwin: 3.0, tweed: 6.1, ac30: 7.0, dc30: 4.2, plexi: 10.0, jcm: 6.5, jub: 6.4, recto: 8.4, mk2c: 9.5, 5150: 8.1, slo: 9.5, dumble: 6.3, orange: 7.4, uber: 8.4, vh4: 8.5, fried: 8.2, hiw: 5.0, jc: 0.5, svt: 6.3, b15: 6.8};
const AO_DB = {usdlx: 5.9, ustwin: 3.5, tweed: 5.6, ac30: 7.1, dc30: 4.7, plexi: 9.1, jcm: 6.4, jub: 6.0, recto: 8.5, mk2c: 9.8, 5150: 8.0, slo: 9.6, dumble: 7.4, orange: 6.4, uber: 7.8, vh4: 7.6, fried: 7.1, hiw: 4.1, jc: 2.5, svt: 4.0, b15: 3.7};
const trimOf = (meas, target) => Math.round((target - (meas || 0)) * 2) / 2;
const AMPS = [
  // id, name, amp model, cab, drive default, master default, bass?
  ['usdlx', 'US Deluxe Nrm', 'deluxe', '1x12us', 0.45, 0.6],
  ['ustwin', 'US Double Vib', 'twin', '2x12twin', 0.4, 0.55],
  ['tweed', 'Tweed Bass Nrm', 'bassman', '4x10tweed', 0.5, 0.6],
  ['ac30', 'Essex Top Boost', 'ac30', '2x12blue', 0.5, 0.6],
  ['dc30', 'Chime 30 Brt', 'dc30', '2x12blue', 0.5, 0.55],
  ['plexi', 'Brit Plexi 59', 'plexi', '4x12gb', 0.6, 0.6],
  ['jcm', 'Brit 2204 Lead', 'jcm800', '4x12t75', 0.55, 0.5],
  ['jub', 'Brit Silver Jub', 'jubilee', '4x12v30', 0.55, 0.5],
  ['recto', 'Cali Rectifier', 'recto', '4x12v30', 0.55, 0.45],
  ['mk2c', 'Cali IIC+ Lead', 'markiic', '4x12v30', 0.55, 0.45],
  ['5150', 'PV Panama Red', '5150', '4x12v30', 0.5, 0.45],
  ['slo', 'Solo Lead OD', 'slo', '4x12v30', 0.5, 0.5],
  ['dumble', 'Smooth Overdrive', 'dumble', '1x12open', 0.5, 0.55],
  ['orange', 'Citrus Rockerverb', 'orange', '4x12orange', 0.55, 0.5],
  ['uber', 'German Ubersonic', 'uber', '4x12uber', 0.55, 0.45],
  ['vh4', 'German Fourcade', 'vh4', '4x12uber', 0.55, 0.45],
  ['fried', 'Fried BE Hot', 'friedman', '4x12gb', 0.55, 0.5],
  ['hiw', 'WhoWatt 103', 'hiwatt', '4x12gb', 0.45, 0.6],
  ['jc', 'Jazz Rivet 120', 'jc120', '2x12jc', 0.35, 0.55],
  ['svt', 'SV Beast Bass', 'svt', '8x10svt', 0.45, 0.55],
  ['b15', 'Flip Top 15 Bass', 'b15', '1x15bass', 0.45, 0.55],
];
const CABS = [
  ['1x12us', '1x12 US Deluxe'], ['2x12twin', '2x12 Double C12N'], ['4x10tweed', '4x10 Tweed P10R'], ['2x12blue', '2x12 Blue Bell'], ['4x12gb', '4x12 Greenback 25'],
  ['4x12v30', '4x12 Cali V30'], ['4x12t75', '4x12 1960 T75'], ['4x12uber', '4x12 Uber T75'], ['2x12cream', '2x12 Mail C12Q'], ['1x12open', '1x12 Open Cream'],
  ['4x12orange', '4x12 Citrus V30'], ['2x12jc', '2x12 Jazz Rivet'], ['8x10svt', '8x10 SV Beast'], ['1x15bass', '1x15 Flip Top'],
];
const pitchMix = (dflt = 0.5) => P('Mix', 'mix', dflt, { f: 'pct', fn: (pos) => ({ dry: Math.cos((pos * Math.PI) / 2), level1: Math.sin((pos * Math.PI) / 2) }) });

export const LIB = [null]; // index 0 = empty slot
function add(m) { m.idx = LIB.length; LIB.push(m); return m; }
[
  // ---- distortion / drive / boost / fuzz
  D('minotaur', 'Minotaur', { clip: 'ge', cleanSum: true, gainMaxDb: 26, tone: 'tilt', levelMaxDb: 6, outTrim: 1.3 }, { P: [P('Gain', 'gain', 0.35), P('Treble', 'tone', 0.5), lvl(0.5)] }),
  D('scream', 'Scream 808', { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, preHp: 100, tone: 'lp', levelMaxDb: 6 }, { P: [P('Drive', 'gain', 0.4), P('Tone', 'tone', 0.5), lvl(0.55)] }),
  D('teemah', 'Teemah!', { clip: 'asym', gainMinDb: 4, gainMaxDb: 34, preHp: 90, tone: 'eq3', eqRangeDb: 12, bassF: 120, trebleF: 3200, outTrim: 1.2 }, { P: [P('Gain', 'gain', 0.4), P('Bass', 'bass', 0.5), P('Treble', 'treble', 0.55), lvl(0.5)] }),
  D('compulsive', 'Compulsive Drive', { clip: 'mosfet', gainMinDb: 8, gainMaxDb: 44, preHp: 80, tone: 'lp', outTrim: 0.6 }),
  D('vermin', 'Vermin Dist', { clip: 'diode', gainMinDb: 12, gainMaxDb: 52, preHp: 70, tone: 'rat', outTrim: 0.5 }, { P: [P('Distortion', 'gain', 0.5), P('Filter', 'tone', 0.45), lvl(0.45)] }),
  D('deez', 'Deez One', { clip: 'diode', gainMinDb: 10, gainMaxDb: 46, preHp: 90, tone: 'lp', postLp: 7000, outTrim: 0.5 }),
  D('arbitrator', 'Arbitrator Fuzz', { clip: 'ge', gainMinDb: 14, gainMaxDb: 44, preHp: 40, postLp: 5200, tone: 'none', outTrim: 0.6 }, { P: [P('Fuzz', 'gain', 0.6), lvl(0.45)] }),
  D('triangle', 'Triangle Fuzz', { clip: 'muff', gainMinDb: 16, gainMaxDb: 50, preHp: 60, postLp: 6000, tone: 'blend', outTrim: 0.75 }, { P: [P('Sustain', 'gain', 0.55), P('Tone', 'tone', 0.5), lvl(0.45)] }),
  D('megadeth', 'Hedgehog D9', { clip: 'si', stages: 2, stage2Db: 16, gainMinDb: 18, gainMaxDb: 58, preHp: 120, postLp: 7200, tone: 'eq3', eqRangeDb: 14, bassF: 110, midF: 750, trebleF: 3000, outTrim: 0.5 }, { P: [P('Gain', 'gain', 0.55), P('Bass', 'bass', 0.55), P('Mid', 'mid', 0.5), P('Treble', 'treble', 0.55), lvl(0.4)], cost: 0.7 }),
  MDL({ id: 'kinky', cat: 'dist', n: 'Kinky Boost', algo: 'boost', set: { mode: 0 }, P: [P('Boost', 'gain', 0.4), P('Bass', 'bass', 0.5), P('Treble', 'treble', 0.5), P('Level', 'level', 0.5)], cost: 0.2 }),
  MDL({ id: 'trebboost', cat: 'dist', n: 'Range Booster', algo: 'boost', set: { mode: 1 }, P: [P('Boost', 'gain', 0.5), P('Level', 'level', 0.5)], cost: 0.2 }),
  // ---- dynamics
  MDL({ id: 'redsq', cat: 'dyn', n: 'Red Squeeze', algo: 'comp', opts: { type: 'ota' }, P: [P('Sensitivity', 'sustain', 0.5), P('Level', 'level', 0.35), P('Attack', 'attack', 0.3), P('Mix', 'blend', 1, { f: 'pct' })], cost: 0.2 }),
  MDL({ id: 'dlxcomp', cat: 'dyn', n: 'Deluxe Comp', algo: 'comp', opts: { type: 'vca' }, P: [P('Threshold', 'sustain', 0.5), P('Ratio', 'ratio', 0.5), P('Attack', 'attack', 0.3), P('Release', 'release', 0.4), P('Level', 'level', 0.35), P('Mix', 'blend', 1, { f: 'pct' })], cost: 0.2 }),
  MDL({ id: 'lastudio', cat: 'dyn', n: 'LA Studio Comp', algo: 'comp', opts: { type: 'opto' }, P: [P('Peak Red', 'sustain', 0.5), P('Gain', 'level', 0.35), P('Emphasis', 'tone', 0.5), P('Mix', 'blend', 1, { f: 'pct' })], cost: 0.2 }),
  MDL({ id: 'gate', cat: 'dyn', n: 'Noise Gate', algo: 'gate', P: [P('Threshold', 'threshold', 0.35), P('Decay', 'decay', 0.4), P('Attack', 'attack', 0.1), P('Range', 'range', 1, { f: 'pct' })], cost: 0.1 }),
  // ---- EQ
  MDL({ id: 'paraeq', cat: 'eq', n: 'Parametric', algo: 'peq', P: [P('Low Freq', 'lowfreq', 100, { min: 30, max: 500, curve: 'log', f: 'hz' }), P('Low Gain', 'lowgain', 0, { min: -12, max: 12, f: 'db' }), P('Mid Freq', 'mid1freq', 800, { min: 100, max: 4000, curve: 'log', f: 'hz' }), P('Mid Gain', 'mid1gain', 0, { min: -12, max: 12, f: 'db' }), P('Mid Q', 'mid1q', 1, { min: 0.3, max: 6, curve: 'log', f: 'x' }), P('High Freq', 'highfreq', 5000, { min: 1000, max: 16000, curve: 'log', f: 'hz' }), P('High Gain', 'highgain', 0, { min: -12, max: 12, f: 'db' }), P('Low Cut', 'lowcut', 20, { min: 20, max: 1000, curve: 'log', f: 'hz' }), P('High Cut', 'highcut', 20000, { min: 1000, max: 20000, curve: 'log', f: 'hz' }), P('Level', 'level', 0, { min: -12, max: 12, f: 'db' })], cost: 0.15 }),
  MDL({ id: 'geq', cat: 'eq', n: '7 Band Graphic', algo: 'geq', opts: { freqs: [100, 200, 400, 800, 1600, 3200, 6400] }, P: ['100', '200', '400', '800', '1.6k', '3.2k', '6.4k'].map((l, i) => P(l, 'b' + i, 0, { min: -12, max: 12, f: 'db' })).concat([P('Level', 'level', 0, { min: -12, max: 12, f: 'db' })]), cost: 0.15 }),
  MDL({ id: 'lowhicut', cat: 'eq', n: 'Low/High Cut', algo: 'peq', P: [P('Low Cut', 'lowcut', 80, { min: 20, max: 1000, curve: 'log', f: 'hz' }), P('High Cut', 'highcut', 8000, { min: 1000, max: 20000, curve: 'log', f: 'hz' })], cost: 0.1 }),
  // ---- modulation
  MDL({ id: 'opttrem', cat: 'mod', n: 'Optical Trem', algo: 'tremolo', set: { mode: 0 }, P: [P('Speed', 'rate', 0.4), P('Intensity', 'depth', 0.6), P('Wave', 'wave', 0.3), lvl(0.5)], cost: 0.1 }),
  MDL({ id: 'biastrem', cat: 'mod', n: '60s Bias Trem', algo: 'tremolo', set: { mode: 2 }, P: [P('Speed', 'rate', 0.45), P('Depth', 'depth', 0.55), P('Wave', 'wave', 0.4), lvl(0.5)], cost: 0.1 }),
  MDL({ id: 'harmtrem', cat: 'mod', n: 'Harmonic Trem', algo: 'tremolo', set: { mode: 1 }, P: [P('Speed', 'rate', 0.4), P('Depth', 'depth', 0.6), P('Wave', 'wave', 0.3), lvl(0.5)], cost: 0.15 }),
  MDL({ id: 'plasti', cat: 'mod', n: 'PlastiChorus', algo: 'chorus', set: { mode: 0 }, P: [P('Speed', 'rate', 0.35), P('Depth', 'depth', 0.5), mix(0.5), P('Tone', 'tone', 0.5), P('Pre-delay', 'delay', 0.5), P('Feedback', 'feedback', 0)], cost: 0.2 }),
  MDL({ id: 'trinity', cat: 'mod', n: 'Trinity Chorus', algo: 'chorus', set: { mode: 2 }, P: [P('Speed', 'rate', 0.3), P('Depth', 'depth', 0.5), mix(0.5), P('Tone', 'tone', 0.55)], cost: 0.3 }),
  MDL({ id: 'dimension', cat: 'mod', n: 'Dimension 4', algo: 'chorus', set: { mode: 3 }, P: [P('Speed', 'rate', 0.3), P('Depth', 'depth', 0.45), mix(0.5), P('Tone', 'tone', 0.5)], cost: 0.3 }),
  MDL({ id: 'vibrato', cat: 'mod', n: 'Bubble Vibrato', algo: 'chorus', set: { mode: 1, mix: 1 }, P: [P('Speed', 'rate', 0.45), P('Depth', 'depth', 0.4), P('Tone', 'tone', 0.5)], cost: 0.2 }),
  MDL({ id: 'script', cat: 'mod', n: 'Script Mod Phase', algo: 'phaser', set: { stages: 4, script: 1 }, P: [P('Speed', 'rate', 0.35), P('Depth', 'depth', 0.8), P('Feedback', 'feedback', 0.3), mix(0.5), P('Center', 'center', 0.5)], cost: 0.2 }),
  MDL({ id: 'phase8', cat: 'mod', n: 'Deluxe Phaser 8', algo: 'phaser', set: { stages: 8, script: 0 }, P: [P('Speed', 'rate', 0.3), P('Depth', 'depth', 0.8), P('Feedback', 'feedback', 0.5), mix(0.5), P('Center', 'center', 0.5)], cost: 0.3 }),
  MDL({ id: 'univibe', cat: 'mod', n: 'Ubiquitous Vibe', algo: 'vibe', P: [P('Speed', 'speed', 0.4), P('Intensity', 'intensity', 0.7), P('Mode', 'mode', 0, { f: 'n', names: ['Chorus', 'Vibrato'] }), P('Tone', 'tone', 0.6), lvl(0.5)], cost: 0.3 }),
  MDL({ id: 'grayflg', cat: 'mod', n: 'Gray Flanger', algo: 'flanger', set: { mode: 0 }, P: [P('Rate', 'speed', 0.3), P('Width', 'width', 0.6), P('Regen', 'regen', 0.55), P('Manual', 'manual', 0.5), mix(0.5)], cost: 0.2 }),
  MDL({ id: 'tzflg', cat: 'mod', n: 'Thru-Zero Flange', algo: 'flanger', set: { mode: 3 }, P: [P('Rate', 'speed', 0.25), P('Width', 'width', 0.7), P('Regen', 'regen', 0.4), P('Manual', 'manual', 0.5), mix(0.5)], cost: 0.2 }),
  MDL({ id: 'rotary', cat: 'mod', n: '145 Rotary', algo: 'rotary', P: [P('Speed', 'speed', 0, { f: 'n', names: ['Slow', 'Fast'], max: 1, step: 1 }), P('Drive', 'drive', 0.2), P('Balance', 'balance', 0.5), mix(1), P('Accel', 'accel', 0.5), lvl(0.5)], cost: 0.4 }),
  MDL({ id: 'ringmod', cat: 'mod', n: 'Ring Modulator', algo: 'ringmod', P: [P('Freq', 'freq', 0.4), P('Fine', 'fine', 0.5), mix(0.5)], cost: 0.1 }),
  // ---- delay
  DLY('simple', 'Simple Delay', 0),
  DLY('tape', 'Transistor Tape', 2, { set: { mode: 2, heads: 4 }, P: [P('Time', 'time', 380, { min: 20, max: 2000, curve: 'log', f: 'ms', sync: true }), P('Feedback', 'feedback', 0.35, { f: 'pct' }), mix(0.3), P('Wow/Flutter', 'age', 0.35), P('Sat', 'sat', 0.4), P('Tone', 'tone', 0.5)] }),
  DLY('adriatic', 'Adriatic Delay', 1, { set: { mode: 1 }, P: [P('Time', 'time', 400, { min: 20, max: 1000, curve: 'log', f: 'ms', sync: true }), P('Feedback', 'feedback', 0.4, { f: 'pct' }), mix(0.3), P('Rate', 'modrate', 0.3), P('Depth', 'moddepth', 0.3), P('Tone', 'tone', 0.45)] }),
  DLY('vintdig', 'Vintage Digital', 3),
  DLY('pingpong', 'Ping Pong', 7),
  DLY('reverse', 'Reverse Delay', 5, { P: [P('Time', 'time', 600, { min: 100, max: 2000, curve: 'log', f: 'ms', sync: true }), P('Feedback', 'feedback', 0.3, { f: 'pct' }), mix(0.4), P('Tone', 'tone', 0.6)] }),
  DLY('dual', 'Dual Delay', 8),
  DLY('cosmos', 'Cosmos Echo', 2, { set: { mode: 2, heads: 7 }, P: [P('Time', 'time', 300, { min: 40, max: 1200, curve: 'log', f: 'ms', sync: true }), P('Feedback', 'feedback', 0.45, { f: 'pct' }), mix(0.3), P('Heads', 'heads', 7, { min: 1, max: 7, f: 'n', names: ['', 'H1', 'H2', 'H1+2', 'H3', 'H1+3', 'H2+3', 'All'] }), P('Wow/Flutter', 'age', 0.45), P('Tone', 'tone', 0.45)] }),
  DLY('shimdly', 'Glitz Delay', 6),
  DLY('warp', 'Elephant Man', 9),
  // ---- reverb
  REV('room', 'Room', 0, { P: [P('Decay', 'decay', 0.35), mix(0.25), P('Pre-delay', 'predelay', 10, { min: 0, max: 250, f: 'ms' }), P('Tone', 'tone', 0.6), P('Size', 'size', 0.4)] }),
  REV('hall', 'Hall', 1),
  REV('plate', 'Plate', 2),
  REV('spring', '63 Spring', 3, { P: [P('Dwell', 'decay', 0.5), mix(0.3), P('Tone', 'tone', 0.55), P('Low Cut', 'lowcut', 0.2)] }),
  REV('shimmer', 'Glitz', 4, { P: [P('Decay', 'decay', 0.7), mix(0.35), P('Shimmer', 'shimmer', 0.5), P('Tone', 'tone', 0.6), P('Pre-delay', 'predelay', 40, { min: 0, max: 250, f: 'ms' }), P('Mod', 'mod', 0.4)] }),
  REV('cloud', 'Searchlights', 5),
  REV('ganymede', 'Ganymede', 6),
  REV('ducking', 'Ducking Verb', 7),
  REV('dlyverb', 'Double Tank', 8),
  REV('swell', 'Swell Verb', 9),
  // ---- pitch / synth
  MDL({ id: 'whammy', cat: 'pitch', n: 'Pitch Wham', algo: 'pitch', set: { dry: 0, level1: 1, level2: 0, level3: 0 }, P: [P('Position', 'expr', 0, { f: 'pct', exp: 1 }), P('Toe Pitch', 'semis1', 12, { min: -24, max: 24, step: 1, f: 'st' })], cost: 1.2 }),
  MDL({ id: 'simplepitch', cat: 'pitch', n: 'Simple Pitch', algo: 'pitch', set: { level2: 0, level3: 0 }, P: [P('Interval', 'semis1', -12, { min: -24, max: 24, step: 1, f: 'st' }), pitchMix(0.5), P('Cents', 'cents', 0, { min: -50, max: 50, step: 1, f: 'x' })], cost: 1.2 }),
  MDL({ id: 'dualpitch', cat: 'pitch', n: 'Dual Pitch', algo: 'pitch', set: { dry: 0.8, level3: 0 }, P: [P('Interval 1', 'semis1', 12, { min: -24, max: 24, step: 1, f: 'st' }), P('Level 1', 'level1', 0.5, { f: 'pct' }), P('Interval 2', 'semis2', -12, { min: -24, max: 24, step: 1, f: 'st' }), P('Level 2', 'level2', 0.5, { f: 'pct' })], cost: 1.6 }),
  MDL({ id: 'harmony', cat: 'pitch', n: 'Twin Harmony', algo: 'pitch', set: { dry: 0.8, level3: 0, scale: 1 }, P: [P('Key', 'key', 4, { min: 0, max: 11, f: 'n', names: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] }), P('Voice 1', 'deg1', 2, { min: -7, max: 7, step: 1, f: 'x' }), P('Level 1', 'level1', 0.6, { f: 'pct' }), P('Voice 2', 'deg2', 4, { min: -7, max: 7, step: 1, f: 'x' }), P('Level 2', 'level2', 0, { f: 'pct' })], cost: 1.6 }),
  MDL({ id: 'octorg', cat: 'pitch', n: '3 OSC Organ', algo: 'synth', set: { mode: 2, level: -6 }, P: [P('Octave', 'octave', 0, { min: -2, max: 1, f: 'n', names: { '-2': '-2', '-1': '-1', 0: '0', 1: '+1' } }), P('Filter', 'filter', 0.6), P('Dry', 'dry', 0.5, { f: 'pct' }), P('Wet', 'wet', 0.7, { f: 'pct' })], cost: 0.8 }),
  MDL({ id: 'synthlead', cat: 'pitch', n: 'Synth Lead', algo: 'synth', set: { mode: 1, level: -6 }, P: [P('Filter', 'filter', 0.5), P('Reso', 'reso', 0.4), P('Attack', 'attack', 0.15), P('Dry', 'dry', 0.3, { f: 'pct' }), P('Wet', 'wet', 0.7, { f: 'pct' }), P('Octave', 'octave', 0, { min: -2, max: 1, f: 'n', names: { '-2': '-2', '-1': '-1', 0: '0', 1: '+1' } })], cost: 0.8 }),
  MDL({ id: 'synthstr', cat: 'pitch', n: 'Synth String', algo: 'synth', set: { mode: 3 }, P: [P('Attack', 'attack', 0.5), P('Filter', 'filter', 0.5), P('Dry', 'dry', 0.4, { f: 'pct' }), P('Wet', 'wet', 0.7, { f: 'pct' })], cost: 0.8 }),
  MDL({ id: 'suboct', cat: 'pitch', n: 'Bass Octaver', algo: 'synth', set: { mode: 5, octave: -1, level: -6 }, P: [P('Filter', 'filter', 0.4), P('Dry', 'dry', 0.7, { f: 'pct' }), P('Wet', 'wet', 0.7, { f: 'pct' })], cost: 0.6 }),
  // ---- filter
  MDL({ id: 'mutant', cat: 'filter', n: 'Mutant Filter', algo: 'wah', opts: { fLo: 250, fHi: 2800 }, set: { mode: 2, filter: 1 }, P: [P('Sens', 'sens', 0.55), P('Q', 'q', 0.6), P('Range', 'range', 0.6), P('Direction', 'direction', 0, { f: 'n', names: ['Up', 'Down'], max: 1, step: 1 }), lvl(0.3)], cost: 0.15 }),
  MDL({ id: 'throbber', cat: 'filter', n: 'Seeker Throb', algo: 'wah', opts: { fLo: 250, fHi: 2600 }, set: { mode: 1, filter: 1 }, P: [P('Speed', 'rate', 0.4), P('Q', 'q', 0.55), P('Range', 'range', 0.6), lvl(0.36)], cost: 0.15 }),
  MDL({ id: 'autolp', cat: 'filter', n: 'Asheville Lowpass', algo: 'wah', opts: { fLo: 200, fHi: 3200 }, set: { mode: 2, filter: 0 }, P: [P('Sens', 'sens', 0.5), P('Q', 'q', 0.45), P('Range', 'range', 0.6), lvl(0.36)], cost: 0.15 }),
  MDL({ id: 'bitcrush', cat: 'filter', n: 'Bitcrusher', algo: 'crusher', P: [P('Bits', 'bits', 0.5), P('Sample Rate', 'rate', 0.3), mix(0.6)], cost: 0.1 }),
  MDL({ id: 'lofiradio', cat: 'filter', n: 'AM Radio', algo: 'lofi', set: { mode: 2 }, P: [P('Age', 'age', 0.4), P('Noise', 'noise', 0.15), mix(1), P('Level', 'level', -4, { min: -12, max: 12, f: 'db' })], cost: 0.2 }),
  // ---- wah
  MDL({ id: 'fassel', cat: 'wah', n: 'Fassel Wah', algo: 'wah', opts: { fLo: 380, fHi: 2200 }, set: { mode: 0, filter: 1 }, P: [P('Position', 'pos', 0.5, { f: 'pct', exp: 1 }), P('Q', 'q', 0.55), lvl(0.36)], cost: 0.1 }),
  MDL({ id: 'chromewah', cat: 'wah', n: 'Chrome Custom', algo: 'wah', opts: { fLo: 320, fHi: 2600 }, set: { mode: 0, filter: 1 }, P: [P('Position', 'pos', 0.5, { f: 'pct', exp: 1 }), P('Q', 'q', 0.7), lvl(0.33)], cost: 0.1 }),
  MDL({ id: 'teardrop', cat: 'wah', n: 'Teardrop 310', algo: 'wah', opts: { fLo: 450, fHi: 1900 }, set: { mode: 0, filter: 1 }, P: [P('Position', 'pos', 0.5, { f: 'pct', exp: 1 }), P('Q', 'q', 0.4), lvl(0.4)], cost: 0.1 }),
  // ---- volume
  MDL({ id: 'volpedal', cat: 'vol', n: 'Volume Pedal', algo: 'volume', P: [P('Position', 'pos', 1, { f: 'pct', exp: 2 }), P('Min Vol', 'min', 0, { f: 'pct' }), P('Taper', 'taper', 1, { f: 'n', names: ['Linear', 'Audio'], step: 1 })], cost: 0.05 }),
  MDL({ id: 'gain', cat: 'vol', n: 'Gain Block', algo: 'utility', opts: { kind: 'gain' }, P: [P('Gain', 'level', 0, { min: -24, max: 12, f: 'db' })], cost: 0.02 }),
  MDL({ id: 'width', cat: 'vol', n: 'Stereo Width', algo: 'stereo', set: { mode: 0 }, P: [P('Width', 'width', 0.7, { f: 'pct' }), P('Mono Bass', 'monobass', 20, { min: 20, max: 400, curve: 'log', f: 'hz' })], cost: 0.05 }),
].forEach(add);
// ---- amps (+cab), amps alone, cabs alone
for (const [id, n, model, cab, g, m] of AMPS)
  add({ id: 'ac-' + id, cat: 'amp', n, algo: 'chain', cost: 3.4, amp: model, cabModel: cab, opts: { chain: [{ prefix: 'a', algo: 'amp', opts: { model } }, { prefix: 'c', algo: 'cab', opts: { model: cab } }] }, P: AMPP(g, m, trimOf(AC_DB[id], 3)).concat(CABP) });
for (const [id, n, model, , g, m] of AMPS)
  add({ id: 'a-' + id, cat: 'ampo', n, algo: 'chain', cost: 2.5, amp: model, opts: { chain: [{ prefix: 'a', algo: 'amp', opts: { model } }] }, P: AMPP(g, m, trimOf(AO_DB[id], 2)) });
for (const [model, n] of CABS)
  add({ id: 'c-' + model, cat: 'cab', n, algo: 'chain', cost: 0.9, cabModel: model, opts: { chain: [{ prefix: 'c', algo: 'cab', opts: { model } }] }, P: CABP });

export const BY_ID = Object.fromEntries(LIB.filter(Boolean).map((m) => [m.id, m]));
export const modelsIn = (cat, filter) => LIB.filter((m) => m && m.cat === cat && (!filter || filter(m)));
export const modelIdx = (id) => (BY_ID[id] ? BY_ID[id].idx : 0);

// ------------------------------------------------------------------ the kit
export function createKit(tz) {
  const UNITS = new Map(); // def id -> cfg
  const live = new Map(); // block id -> { refs drawn by the form (rings, scribble strips …) }
  const T = () => tz.app.state;
  const blk = (id) => tz.app.blocks().find((b) => b.id === id);
  const ui = (b) => tz.app.ui(b);
  const nav = (id) => {
    const s = T().ui;
    const o = (s[id] = s[id] || {});
    if (!o.mfx) o.mfx = { view: 'home', sel: (UNITS.get((blk(id) || {}).type) || {}).sel0 || 1, page: 0, cur: 0, top: 0, cat: null, back: [], taps: [], msg: '', msgT: 0, rev: 0 };
    return o.mfx;
  };
  const bump = (id) => { nav(id).rev++; };
  const mfx = (b) => (b.mfx = b.mfx || { snaps: [], snap: 0, presets: {}, preset: 0, clip: null });

  const slotModel = (u, i) => LIB[(u[`_s${i}m`] ?? 0) | 0] || null;
  const slotOn = (u, i) => (u[`_s${i}on`] ?? 1) > 0.5;
  const slotPos = (u, i, j, m) => {
    const v = u[`_s${i}p${j}`];
    if (v !== undefined) return v;
    m = m || slotModel(u, i);
    const p = m && m.P[j];
    return p ? pPos(p, p.d) : 0.5;
  };

  // ---- routing → engine chain
  // cfg.layout(u) → steps: slot number (series) | { par: [[slots…], [slots…]] } (parallel paths, each path series)
  function prefixes(cfg, u) {
    const pre = {};
    const lv = [];
    let g = 0;
    for (const st of cfg.layout(u)) {
      if (typeof st === 'number') pre[st] = 's' + st;
      else {
        g++;
        st.par.forEach((path, k) => {
          const pp = `p${g}${'abcdefgh'[k]}`;
          lv.push(pp);
          path.forEach((i) => (pre[i] = pp + '.s' + i));
        });
      }
    }
    return { pre, lv };
  }
  function slotSub(u, i) {
    const m = slotModel(u, i);
    if (!m) return null;
    const s = { prefix: 's' + i, algo: m.algo };
    if (m.opts) s.opts = m.opts;
    return s;
  }
  function buildChain(cfg, u) {
    const subs = [];
    if (cfg.inputGate) subs.push({ prefix: 'ig', algo: 'gate', on: false });
    let g = 0;
    for (const st of cfg.layout(u)) {
      if (typeof st === 'number') {
        const s = slotSub(u, st);
        if (s) subs.push(s);
      } else {
        g++;
        st.par.forEach((path, k) => {
          subs.push({ prefix: `p${g}${'abcdefgh'[k]}`, algo: 'chain', group: g, lvlDef: cfg.parLvl ?? 1.4, opts: { chain: path.map((i) => slotSub(u, i)).filter(Boolean) } });
        });
      }
    }
    if (cfg.tuner !== false) subs.push({ prefix: 'tu', algo: 'tuner', on: false, params: { mute: 0 } });
    if (cfg.looper) subs.push({ prefix: 'lp', algo: 'looper', on: false, opts: { tracks: 1, maxSec: 60 } });
    subs.push({ prefix: 'out', algo: 'utility', opts: { kind: 'gain' } });
    return subs;
  }
  function deriveFor(cfg) {
    return (u) => {
      const o = {};
      const { pre, lv } = prefixes(cfg, u);
      for (let i = 1; i <= cfg.n; i++) {
        const m = slotModel(u, i);
        const px = pre[i];
        if (!m || !px) continue;
        o[px + '.on'] = slotOn(u, i) ? 1 : 0;
        if (m.set) for (const k in m.set) o[px + '.' + k] = m.set[k];
        m.P.forEach((p, j) => {
          const pos = slotPos(u, i, j, m);
          if (p.fn) { const r = p.fn(pos); for (const k in r) o[px + '.' + k] = r[k]; }
          else o[px + '.' + p.k] = pVal(p, pos);
        });
        if (cfg.slotDerive) cfg.slotDerive(o, px, m, u, i);
      }
      lv.forEach((p) => (o[p + '.lvl'] = cfg.parLvl ?? 1.4));
      if (cfg.inputGate) { o['ig.on'] = (u._gate ?? 0) > 0.5 ? 1 : 0; o['ig.threshold'] = 0.2 + 0.5 * (u._gateT ?? 0.4); }
      const tun = (u._tuner ?? 0) > 0.5;
      if (cfg.tuner !== false) { o['tu.on'] = tun ? 1 : 0; o['tu.calib'] = u._tref ?? 440; o['tu.mute'] = 0; }
      if (cfg.looper) o['lp.on'] = (u._loop ?? 0) > 0.5 ? 1 : 0;
      const vol = cfg.volume ? cfg.volume(u) : u._vol ?? 0;
      o['out.level'] = tun && (u._tmute ?? 1) > 0.5 ? -60 : vol;
      if (cfg.derive) Object.assign(o, cfg.derive(u, pre));
      return o;
    };
  }
  let syncT = 0;
  const syncSoon = () => { clearTimeout(syncT); syncT = setTimeout(() => tz.app.syncGraph(), 0); };
  function curChain(b) {
    const d = tz.app.getDef(b.type);
    return (b.opts && b.opts.chain) || d.opts.chain;
  }
  function ensure(id) {
    const b = blk(id);
    if (!b) return;
    const cfg = UNITS.get(b.type);
    if (!cfg) return;
    const want = buildChain(cfg, ui(b));
    if (JSON.stringify(want) !== JSON.stringify(curChain(b))) {
      b.opts = Object.assign({}, b.opts || {}, { chain: want });
      syncSoon();
    }
  }
  // set several params with one undo step and one engine update
  function bulk(id, obj, mutate) {
    const b = blk(id);
    if (!b) return;
    const keys = Object.keys(obj);
    const k0 = keys[0] || '_rev';
    tz.app.setParam(id, k0, obj[k0] ?? b.params[k0] ?? 0); // commits the undo snapshot first
    if (mutate) mutate(b);
    for (const k of keys) { if (obj[k] === undefined) delete b.params[k]; else b.params[k] = obj[k]; }
    tz.app.setParam(id, k0, b.params[k0] ?? 0);
    ensure(id);
    bump(id);
  }
  // UI-only param (knob positions under the screen): no undo step, no engine traffic
  function uiSet(id, obj) {
    const b = blk(id);
    if (!b) return;
    Object.assign(b.params, obj);
    tz.bus.emit('param', { id });
  }
  const say = (id, msg) => { const n = nav(id); n.msg = msg; n.msgT = performance.now(); bump(id); };

  // ---- slot operations
  function setModel(id, i, idx) {
    const b = blk(id);
    if (!b) return;
    const o = { [`_s${i}m`]: idx, [`_s${i}on`]: idx ? 1 : undefined };
    for (let j = 0; j < 16; j++) o[`_s${i}p${j}`] = undefined;
    bulk(id, o);
    syncKnobs(id);
  }
  function toggleSlot(id, i, v) {
    const b = blk(id);
    if (!b || !slotModel(ui(b), i)) return;
    const on = v ?? (slotOn(ui(b), i) ? 0 : 1);
    tz.app.setParam(id, `_s${i}on`, on);
    bump(id);
  }
  function setPos(id, i, j, pos) {
    tz.app.setParam(id, `_s${i}p${j}`, Math.max(0, Math.min(1, pos)));
    bump(id);
  }
  function stepParam(id, i, j, d) {
    const b = blk(id);
    const u = ui(b);
    const m = slotModel(u, i);
    const p = m && m.P[j];
    if (!p) return;
    const pos = slotPos(u, i, j, m);
    let np;
    if (p.f === 'n' || p.step) {
      const st = p.step || 1;
      np = pPos(p, Math.max(p.min, Math.min(p.max, pVal(p, pos) + d * st)));
    } else np = pos + d * 0.02;
    setPos(id, i, j, np);
  }
  const slotKeys = (b, i) => Object.keys(b.params).filter((k) => k.startsWith(`_s${i}`) && /^_s\d+[a-z]/.test(k) && k.match(/^_s(\d+)/)[1] === String(i));
  function slotDump(b, i) {
    const o = {};
    for (const k of slotKeys(b, i)) o[k.replace(/^_s\d+/, '')] = b.params[k];
    return o;
  }
  function slotLoad(o, i, data) {
    for (let j = 0; j < 16; j++) o[`_s${i}p${j}`] = undefined;
    o[`_s${i}m`] = 0;
    o[`_s${i}on`] = undefined;
    for (const k in data || {}) o[`_s${i}${k}`] = data[k];
  }
  function swapSlots(id, a, c) {
    const b = blk(id);
    if (!b) return;
    const da = slotDump(b, a), dc = slotDump(b, c);
    const o = {};
    slotLoad(o, a, dc);
    slotLoad(o, c, da);
    bulk(id, o);
  }
  function copySlot(id, i) {
    const b = blk(id);
    mfx(b).clip = slotDump(b, i);
    say(id, 'Copied');
  }
  function pasteSlot(id, i) {
    const b = blk(id);
    const c = mfx(b).clip;
    if (!c) return say(id, 'Clipboard empty');
    const o = {};
    slotLoad(o, i, c);
    bulk(id, o);
    syncKnobs(id);
    say(id, 'Pasted');
  }
  function clearSlot(id, i) { setModel(id, i, 0); say(id, 'Block cleared'); }

  // ---- knobs under the screen (k1..kN) follow the selected slot + page
  function knobMap(id) {
    const b = blk(id);
    const cfg = UNITS.get(b.type);
    const n = nav(id);
    const u = ui(b);
    const out = [];
    for (let k = 1; k <= (cfg.knobs || 0); k++) out.push(cfg.knobTarget ? cfg.knobTarget(u, n, k) : [n.sel, n.page * cfg.knobs + k - 1]);
    return out;
  }
  function syncKnobs(id) {
    const b = blk(id);
    if (!b) return;
    const u = ui(b);
    const o = {};
    knobMap(id).forEach((t, k) => {
      const m = t && slotModel(u, t[0]);
      o['k' + (k + 1)] = m && m.P[t[1]] ? slotPos(u, t[0], t[1], m) : 0;
    });
    uiSet(id, o);
    bump(id);
  }
  function selectSlot(id, i) {
    const n = nav(id);
    n.sel = i;
    n.page = 0;
    syncKnobs(id);
  }
  function pages(u, i, per) {
    const m = slotModel(u, i);
    return m ? Math.max(1, Math.ceil(m.P.length / per)) : 1;
  }
  function page(id, d) {
    const b = blk(id);
    const cfg = UNITS.get(b.type);
    const n = nav(id);
    const np = pages(ui(b), n.sel, cfg.knobs || 1);
    n.page = (n.page + d + np) % np;
    syncKnobs(id);
  }

  // ---- snapshots / scenes
  function capture(b) {
    const cfg = UNITS.get(b.type);
    const u = ui(b);
    const s = { m: {}, v: {} };
    for (let i = 1; i <= cfg.n; i++) {
      const m = slotModel(u, i);
      if (!m) continue;
      s.m[i] = m.idx;
      s.v[`_s${i}on`] = slotOn(u, i) ? 1 : 0;
      m.P.forEach((p, j) => (s.v[`_s${i}p${j}`] = slotPos(u, i, j, m)));
    }
    if (cfg.snapKeys) cfg.snapKeys.forEach((k) => (s.v[k] = u[k]));
    return s;
  }
  function recallSnap(id, k) {
    const b = blk(id);
    if (!b) return;
    const cfg = UNITS.get(b.type);
    const x = mfx(b);
    const u = ui(b);
    if ((u._snapEdit ?? 1) > 0.5 || !x.snaps[x.snap]) x.snaps[x.snap] = capture(b);
    const s = x.snaps[k];
    const o = { _snap: k };
    if (s) for (const key in s.v) {
      const mm = key.match(/^_s(\d+)/);
      if (mm && s.m[mm[1]] !== ((u[`_s${mm[1]}m`] ?? 0) | 0)) continue; // model changed since: keep current
      o[key] = s.v[key];
    }
    bulk(id, o, (bb) => { mfx(bb).snap = k; if (!s) mfx(bb).snaps[k] = capture(bb); });
    syncKnobs(id);
    say(id, (cfg.snapWord || 'Snapshot') + ' ' + (cfg.snapName ? cfg.snapName(k) : k + 1));
  }
  // ---- internal presets (a bank of patches inside the unit)
  const STRUCT = /^_(s\d+|split|grid|route)/;
  function dumpPreset(b) {
    const o = {};
    for (const k in b.params) if (STRUCT.test(k)) o[k] = b.params[k];
    const x = mfx(b);
    x.snaps[x.snap] = capture(b);
    return { params: o, snaps: JSON.parse(JSON.stringify(x.snaps)), snap: x.snap, name: x.name };
  }
  function factoryParams(cfg, f) {
    const o = {};
    Object.assign(o, f.extra || {});
    for (const i in f.slots || {}) {
      const [mid, vals, off] = f.slots[i];
      const m = BY_ID[mid];
      if (!m) continue;
      o[`_s${i}m`] = m.idx;
      if (off) o[`_s${i}on`] = 0;
      for (const k in vals || {}) {
        const j = m.P.findIndex((p) => p.k === k);
        if (j >= 0) o[`_s${i}p${j}`] = pPos(m.P[j], vals[k]);
      }
    }
    return o;
  }
  function loadPreset(id, k, fresh) {
    const b = blk(id);
    if (!b) return;
    const cfg = UNITS.get(b.type);
    const x = mfx(b);
    if (fresh) delete x.presets[k];
    else x.presets[x.preset] = dumpPreset(b);
    const f = cfg.presets[k] || { name: 'New Preset', slots: {} };
    const data = x.presets[k] || { params: factoryParams(cfg, f), snaps: [], snap: 0, name: f.name };
    const o = {};
    for (const key in b.params) if (STRUCT.test(key)) o[key] = undefined;
    Object.assign(o, data.params, { _preset: k, _snap: data.snap || 0 });
    bulk(id, o, (bb) => {
      const xx = mfx(bb);
      xx.preset = k;
      xx.snaps = JSON.parse(JSON.stringify(data.snaps || []));
      xx.snap = data.snap || 0;
      xx.name = data.name || f.name;
    });
    const n = nav(id);
    n.sel = firstSlot(id) || 1;
    n.page = 0;
    syncKnobs(id);
    say(id, presetName(b, k));
  }
  const presetName = (b, k) => {
    const cfg = UNITS.get(b.type);
    const x = mfx(b);
    if (k === undefined) k = x.preset || 0;
    return (x.presets[k] && x.presets[k].name) || (k === (x.preset || 0) && x.name) || (cfg.presets[k] || {}).name || 'New Preset';
  };
  function firstSlot(id) {
    const b = blk(id);
    const cfg = UNITS.get(b.type);
    const u = ui(b);
    for (let i = 1; i <= cfg.n; i++) if (slotModel(u, i)) return i;
    return 0;
  }

  // ---- tap tempo, tuner, looper, expression
  function tap(id) {
    const n = nav(id);
    const now = performance.now();
    n.taps = n.taps.filter((t) => now - t < 2500);
    n.taps.push(now);
    if (n.taps.length < 2) return;
    const dts = n.taps.slice(1).map((t, i) => t - n.taps[i]);
    const dt = dts.reduce((a, x) => a + x, 0) / dts.length;
    const bpm = Math.max(30, Math.min(300, 60000 / dt));
    setTempo(id, bpm);
  }
  function setTempo(id, bpm) {
    const b = blk(id);
    const cfg = UNITS.get(b.type);
    const u = ui(b);
    const o = { _bpm: Math.round(bpm * 10) / 10 };
    if ((u._tapSync ?? 1) > 0.5)
      for (let i = 1; i <= cfg.n; i++) {
        const m = slotModel(u, i);
        if (!m) continue;
        m.P.forEach((p, j) => { if (p.sync) o[`_s${i}p${j}`] = pPos(p, Math.max(p.min, Math.min(p.max, 60000 / bpm))); });
      }
    bulk(id, o);
    syncKnobs(id);
  }
  function tuner(id, on) {
    const b = blk(id);
    if (!b) return;
    on = on ?? !((ui(b)._tuner ?? 0) > 0.5);
    tz.app.setParam(id, '_tuner', on ? 1 : 0);
    const n = nav(id);
    if (on) { if (n.view !== 'tuner') n.prevView = n.view; n.view = 'tuner'; } else if (n.view === 'tuner') n.view = n.prevView && n.prevView !== 'tuner' ? n.prevView : 'home';
    bump(id);
  }
  function looper(id, act) {
    const b = blk(id);
    if (!b) return;
    if ((ui(b)._loop ?? 0) < 0.5) tz.app.setParam(id, '_loop', 1);
    const idx = curChain(b).findIndex((s) => s.prefix === 'lp');
    if (idx < 0) return;
    const type = { rec: 1, play: 1, stop: 2, clear: 3, undo: 4 }[act];
    setTimeout(() => tz.engine.send({ cmd: 'event', id, type, value: 0, arg: idx * 100 }), (ui(b)._loop ?? 0) < 0.5 ? 60 : 0);
    bump(id);
  }
  function loopState(st) {
    const t = st && st.lp && st.lp.looper && st.lp.looper.tracks && st.lp.looper.tracks[0];
    return t ? t.state : 0;
  }
  function exp(id, which, v) {
    const b = blk(id);
    if (!b) return;
    const cfg = UNITS.get(b.type);
    const u = ui(b);
    const o = { ['_exp' + which]: v };
    for (let i = 1; i <= cfg.n; i++) {
      const m = slotModel(u, i);
      if (!m) continue;
      m.P.forEach((p, j) => { if (p.exp === which) o[`_s${i}p${j}`] = v; });
    }
    const keys = Object.keys(o);
    // continuous: no undo step per move, but the engine must hear it
    for (const k of keys) b.params[k] = o[k];
    tz.app.setParam(id, keys[0], o[keys[0]]);
    bump(id);
  }

  // ---- settings rows: { n, p, opts | min/max/step/f }
  function setText(row, u) {
    const v = u[row.p] ?? row.d ?? 0;
    if (row.opts) return row.opts[Math.round(v)] ?? String(v);
    if (row.f) return row.f(v);
    return String(v);
  }
  function setStep(id, row, d) {
    const b = blk(id);
    const u = ui(b);
    const v = u[row.p] ?? row.d ?? 0;
    let nv;
    if (row.opts) nv = (Math.round(v) + d + row.opts.length) % row.opts.length;
    else nv = Math.max(row.min, Math.min(row.max, v + d * (row.step || 1)));
    tz.app.setParam(id, row.p, nv);
    if (row.after) row.after(id, nv);
    ensure(id);
    bump(id);
  }

  // ---- press / hold helper for footswitch & button hooks
  const holds = new Map();
  function press(key, down, h) {
    if (down) {
      const st = { held: false, t: 0 };
      holds.set(key, st);
      if (h.down) h.down();
      if (h.hold) st.t = setTimeout(() => { st.held = true; h.hold(); }, h.ms || 700);
      return;
    }
    const st = holds.get(key) || { held: false };
    clearTimeout(st.t);
    holds.delete(key);
    if (h.up) h.up(st.held);
    if (!st.held && h.tap) h.tap();
  }

  // ---- register a unit
  function register(d, cfg) {
    cfg.def = d;
    UNITS.set(d.id, cfg);
    const init = Object.assign({ _vol: 0, _bpm: 120, _snap: 0, _preset: 0, _tref: 440, _tmute: 1, _snapEdit: 1, _tapSync: 1, _gate: 0 }, cfg.init || {}, factoryParams(cfg, cfg.presets[0]));
    d.initParams = Object.assign(init, d.initParams || {});
    d.opts = Object.assign({}, d.opts || {}, { chain: buildChain(cfg, d.initParams) });
    d.algo = 'chain';
    d.derive = deriveFor(cfg);
    d.cost = d.cost || 7;
    tz.blockHooks(d.id, {
      foot(view, ctl, down) {
        if (!ctl.mfx) return false;
        const id = view.block.id;
        nav(id);
        cfg.foot(id, ctl, down, view);
        bump(id);
        return true;
      },
      ctrl(b, idx, value, kind, inp) {
        if (inp.exp && kind === 'cont') exp(b.id, inp.exp, value);
        else if (inp.fs && kind === 'press' && cfg.extFs) cfg.extFs(b.id, inp.fs, value > 0.5);
      },
    });
  }
  // knob / treadle params → slot params; model / routing changes → rebuild the chain
  tz.bus.on('param', ({ id, p, v }) => {
    if (!p) return;
    const b = blk(id);
    if (!b) return;
    const cfg = UNITS.get(b.type);
    if (!cfg) return;
    let m;
    if ((m = /^k(\d+)$/.exec(p))) {
      const t = knobMap(id)[+m[1] - 1];
      if (t && slotModel(ui(b), t[0]) && slotModel(ui(b), t[0]).P[t[1]]) {
        tz.app.setParam(id, `_s${t[0]}p${t[1]}`, v);
        bump(id);
      }
    } else if (p === '_tre' && cfg.treadle) cfg.treadle(id, v);
    else if (/^_(s\d+m|split|grid|route)/.test(p)) ensure(id);
  });
  const checkAll = () => { for (const b of tz.app.blocks()) if (UNITS.has(b.type)) ensure(b.id); };
  tz.bus.on('preset:changed', () => setTimeout(checkAll, 0));
  tz.bus.on('block:added', (b) => b && UNITS.has(b.type) && setTimeout(() => { ensure(b.id); syncKnobs(b.id); }, 0));

  // ---- drawing helpers for unit screens
  const svgT = (g, x, y, str, o = {}) => tz.gfx.svg('text', {
    x, y, fill: o.fill || '#fff', 'font-family': o.font, 'font-size': o.size || 6, 'font-weight': o.weight || 400,
    'text-anchor': o.anchor || 'start', 'dominant-baseline': 'central', 'letter-spacing': o.ls, 'pointer-events': 'none',
  }, g, str ?? '');
  // strip the standard screen frame (bezel, background, glass) so a screen can be a knob / ring / strip
  function bare(g) {
    const area = g.parentNode, frame = area && area.parentNode;
    if (frame && frame.firstChild) { frame.firstChild.setAttribute('fill', 'transparent'); frame.firstChild.setAttribute('stroke', 'none'); }
    if (area && area.firstChild) area.firstChild.setAttribute('fill', 'none');
    if (g.nextSibling) g.nextSibling.setAttribute('fill', 'none');
  }
  // endless push encoder drawn by `draw(s, g, w, h)` (returns the element to rotate): drag / wheel = turn, click = push
  function addEncoder(kind, draw, onTurn, onPush) {
    tz.addScreen(kind, {
      build(s, g, w, h) { bare(g); s.rot = draw(s, g, w, h); s.ang = 0; },
      update() {},
      pointer(s, nv, type, pt, e) {
        const id = nv.block.id;
        const turn = (n) => {
          for (let k = 0; k < Math.abs(n); k++) onTurn(id, s.ctl, Math.sign(n));
          s.ang += n * 18;
          if (s.rot) s.rot.setAttribute('transform', `rotate(${s.ang})`);
          bump(id);
        };
        if (type === 'down') { s.y0 = pt.y; s.x0 = pt.x; s.used = 0; s.moved = false; }
        else if (type === 'move' && s.y0 !== undefined) {
          const d = s.y0 - pt.y + (pt.x - s.x0);
          const n = Math.trunc((d - s.used) / 7);
          if (n) { s.used += n * 7; s.moved = true; turn(n); }
        } else if (type === 'up') { if (!s.moved && s.y0 !== undefined) { onPush(id, s.ctl); bump(id); } s.y0 = undefined; }
        else if (type === 'wheel') turn(e.deltaY < 0 ? 1 : -1);
      },
    });
  }
  // ---- generic menu machine: slot → category → model lists, ACTION menu, MENU → settings
  // o: { n, cats(slot) → [catKey…] (empty = fixed: o.fixedCat(slot)), settings: [rows], menu(id) → [items], action(id) → [items], col: {cat: colour} }
  function menus(o) {
    const M = {};
    M.isList = (v) => v === 'cats' || v === 'models' || v === 'action' || v === 'menu' || v === 'settings';
    M.models = (id, cat) => modelsIn(cat, o.filter ? (m) => o.filter(id, m) : null);
    M.items = (id) => {
      const n = nav(id), u = ui(blk(id));
      const cur = slotModel(u, n.sel);
      switch (n.view) {
        case 'cats': {
          const list = o.cats(n.sel) || [];
          const base = o.noNone && o.noNone(n.sel) ? [] : [{ t: 'None', c: '#555', act: () => { clearSlot(id, n.sel); n.view = 'home'; } }];
          return base.concat(list.map((c) => ({ t: CATS[c].n, cat: c, c: o.col[c], mark: cur && cur.cat === c, r: '▸', act: () => M.openModels(id, c) })));
        }
        case 'models':
          return M.models(id, n.cat).map((m) => ({ t: m.n, m, c: o.col[m.cat], mark: cur && cur.idx === m.idx, act: () => { setModel(id, n.sel, m.idx); n.view = o.stayInList ? 'models' : 'home'; } }));
        case 'action': return o.action ? o.action(id) : [];
        case 'menu': return o.menu ? o.menu(id) : [];
        case 'settings': return (o.settings || []).map((row) => ({ t: row.n, r: setText(row, u), row, act: () => setStep(id, row, 1) }));
      }
      return [];
    };
    M.openModels = (id, c) => {
      const n = nav(id), u = ui(blk(id));
      const cur = slotModel(u, n.sel);
      n.cat = c; n.view = 'models';
      n.cur = Math.max(0, M.models(id, c).findIndex((m) => cur && m.idx === cur.idx));
      n.top = 0;
    };
    M.openSlot = (id) => {
      const n = nav(id), u = ui(blk(id));
      const cur = slotModel(u, n.sel);
      const list = o.cats(n.sel) || [];
      if (!list.length) return M.openModels(id, o.fixedCat(n.sel));
      n.view = 'cats';
      const off = o.noNone && o.noNone(n.sel) ? 0 : 1;
      n.cur = cur ? Math.max(0, list.indexOf(cur.cat) + off) : 0;
      n.top = 0;
    };
    M.open = (id, view) => { const n = nav(id); n.view = view; n.cur = 0; n.top = 0; };
    M.back = (id) => {
      const n = nav(id);
      if (n.view === 'models' && (o.cats(n.sel) || []).length) { const off = o.noNone && o.noNone(n.sel) ? 0 : 1; n.view = 'cats'; n.cur = Math.max(0, (o.cats(n.sel) || []).indexOf(n.cat) + off); n.top = 0; }
      else if (n.view === 'settings') M.open(id, 'menu');
      else if (n.view === 'tuner') tuner(id, false);
      else n.view = 'home';
    };
    M.move = (id, d) => { const n = nav(id); const l = M.items(id).length; n.cur = Math.max(0, Math.min(l - 1, n.cur + d)); };
    M.activate = (id) => { const n = nav(id); const it = M.items(id)[n.cur]; if (it && it.act) it.act(); };
    M.valueTurn = (id, d) => { const n = nav(id); const it = M.items(id)[n.cur]; if (it && it.row) setStep(id, it.row, d); else if (it && it.turn) it.turn(d); else M.move(id, d); };
    return M;
  }
  // visible window of a list
  const windowTop = (n, cur, top, rows) => Math.max(0, Math.min(Math.max(0, n - rows), cur < top ? cur : cur >= top + rows ? cur - rows + 1 : top));

  return {
    svgT, bare, addEncoder, windowTop, menus,
    LIB, CATS, BY_ID, modelsIn, modelIdx, pVal, pPos, pText, P,
    UNITS, live, blk, ui, nav, mfx, bump, say, bulk, uiSet,
    slotModel, slotOn, slotPos, setModel, toggleSlot, setPos, stepParam, swapSlots, copySlot, pasteSlot, clearSlot,
    knobMap, syncKnobs, selectSlot, pages, page, capture, recallSnap, loadPreset, presetName, firstSlot,
    tap, setTempo, tuner, looper, loopState, exp, setText, setStep, press, register, ensure, curChain, buildChain,
  };
}
