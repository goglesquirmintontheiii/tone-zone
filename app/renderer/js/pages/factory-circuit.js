// Pedal Factory: the sound of a design. A circuit is a list of stages, each one an engine algorithm (see
// docs/engine-blocks.md). The whole pedal runs as one 'chain' engine node; stage params show up as
// "<stage id>.<param>". Every control maps to one stage param (with range, taper and invert), a stage on/off,
// the wet/dry mix, tap tempo or bypass. designToDef() turns a design into a catalog block definition.
import { clamp } from '../util.js';

const uid = (p) => p + Math.random().toString(36).slice(2, 6);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------ stage types
// params: [key, label, min, max, default, flags] flags: i = whole numbers, l = log sweep, o = options list
const P = (key, label, min, max, def, f = {}) => ({ key, label, min, max, def, ...f });
export const STAGE_CATS = { drive: 'Drive', dyn: 'Dynamics', eq: 'Tone', mod: 'Modulation', time: 'Time', pitch: 'Pitch', util: 'Utility' };
export const STAGES = {
  boost: { name: 'Boost', cat: 'drive', algo: 'boost', cost: 0.2, params: [P('gain', 'Gain', 0, 1, 0.5), P('level', 'Level', 0, 1, 0.8), P('bass', 'Bass', 0, 1, 0.5), P('treble', 'Treble', 0, 1, 0.5), P('mode', 'Voice', 0, 3, 0, { i: 1, opts: ['Clean', 'Treble', 'Mid', 'Fat'] })] },
  overdrive: { name: 'Overdrive', cat: 'drive', algo: 'drive', cost: 0.5, opts: { clip: 'ts', tone: 'ts', gainMinDb: 2, gainMaxDb: 38, levelMaxDb: 8 },
    params: [P('gain', 'Drive', 0, 1, 0.5), P('tone', 'Tone', 0, 1, 0.5), P('level', 'Level', 0, 1, 0.5), P('blend', 'Blend', 0, 1, 1), P('bright', 'Bright', 0, 1, 0), P('sag', 'Sag', 0, 1, 0)] },
  distortion: { name: 'Distortion', cat: 'drive', algo: 'drive', cost: 0.5, opts: { clip: 'si', tone: 'rat', gainMinDb: 12, gainMaxDb: 48, levelMaxDb: 6, outTrim: 0.6 },
    params: [P('gain', 'Gain', 0, 1, 0.55), P('tone', 'Filter', 0, 1, 0.5), P('level', 'Level', 0, 1, 0.5), P('sag', 'Sag', 0, 1, 0)] },
  fuzz: { name: 'Fuzz', cat: 'drive', algo: 'drive', cost: 0.5, opts: { clip: 'muff', tone: 'lp', toneLo: 900, toneHi: 6500, gainMinDb: 18, gainMaxDb: 50, levelMaxDb: 4, outTrim: 0.7 },
    params: [P('gain', 'Fuzz', 0, 1, 0.65), P('tone', 'Tone', 0, 1, 0.5), P('level', 'Volume', 0, 1, 0.5), P('sag', 'Starve', 0, 1, 0)] },
  amp: { name: 'Amp drive', cat: 'drive', algo: 'drive', cost: 0.6, opts: { clip: 'tube', tone: 'eq3', bassF: 110, midF: 750, trebleF: 3200, eqRangeDb: 12, gainMinDb: 6, gainMaxDb: 44, levelMaxDb: 6 },
    params: [P('gain', 'Gain', 0, 1, 0.5), P('bass', 'Bass', 0, 1, 0.5), P('mid', 'Mid', 0, 1, 0.5), P('treble', 'Treble', 0, 1, 0.5), P('level', 'Level', 0, 1, 0.5), P('sag', 'Sag', 0, 1, 0.2)] },
  comp: { name: 'Compressor', cat: 'dyn', algo: 'comp', cost: 0.3, opts: { type: 'ota' },
    params: [P('sustain', 'Sustain', 0, 1, 0.5), P('attack', 'Attack', 0, 1, 0.3), P('release', 'Release', 0, 1, 0.4), P('level', 'Level', 0, 1, 0.5), P('tone', 'Tone', 0, 1, 0.5), P('blend', 'Blend', 0, 1, 1), P('ratio', 'Ratio', 0, 1, 0.5)] },
  gate: { name: 'Noise gate', cat: 'dyn', algo: 'gate', cost: 0.1, params: [P('threshold', 'Threshold', 0, 1, 0.3), P('decay', 'Decay', 0, 1, 0.4)] },
  swell: { name: 'Swell', cat: 'dyn', algo: 'swell', cost: 0.2, params: [P('sens', 'Sensitivity', 0, 1, 0.5), P('attack', 'Attack', 0, 1, 0.4)] },
  eq: { name: '3 band EQ', cat: 'eq', algo: 'peq', cost: 0.3,
    params: [P('lowgain', 'Bass', -15, 15, 0), P('mid1gain', 'Mid', -15, 15, 0), P('mid1freq', 'Mid freq', 200, 3000, 700, { l: 1 }), P('highgain', 'Treble', -15, 15, 0), P('level', 'Level', -12, 12, 0)] },
  wah: { name: 'Wah / filter', cat: 'eq', algo: 'wah', cost: 0.2,
    params: [P('pos', 'Position', 0, 1, 0.5), P('q', 'Q', 0, 1, 0.5), P('mode', 'Mode', 0, 2, 0, { i: 1, opts: ['Treadle', 'LFO', 'Envelope'] }), P('rate', 'Rate', 0, 1, 0.4), P('sens', 'Sensitivity', 0, 1, 0.5), P('range', 'Range', 0, 1, 0.5), P('level', 'Level', 0, 1, 0.5)] },
  chorus: { name: 'Chorus', cat: 'mod', algo: 'chorus', cost: 0.3,
    params: [P('rate', 'Rate', 0, 1, 0.35), P('depth', 'Depth', 0, 1, 0.5), P('mix', 'Mix', 0, 1, 0.5), P('tone', 'Tone', 0, 1, 0.5), P('mode', 'Mode', 0, 3, 0, { i: 1, opts: ['Chorus', 'Vibrato', 'Ensemble', 'Dimension'] }), P('level', 'Level', 0, 1, 0.5)] },
  phaser: { name: 'Phaser', cat: 'mod', algo: 'phaser', cost: 0.3,
    params: [P('rate', 'Rate', 0, 1, 0.35), P('depth', 'Depth', 0, 1, 0.8), P('feedback', 'Feedback', 0, 1, 0.4), P('mix', 'Mix', 0, 1, 0.5), P('stages', 'Stages', 2, 12, 4, { i: 1 }), P('center', 'Centre', 0, 1, 0.5)] },
  flanger: { name: 'Flanger', cat: 'mod', algo: 'flanger', cost: 0.3,
    params: [P('speed', 'Rate', 0, 1, 0.3), P('width', 'Depth', 0, 1, 0.6), P('manual', 'Manual', 0, 1, 0.5), P('regen', 'Regen', 0, 1, 0.6), P('mix', 'Mix', 0, 1, 0.5)] },
  vibe: { name: 'Vibe', cat: 'mod', algo: 'vibe', cost: 0.3, params: [P('speed', 'Speed', 0, 1, 0.4), P('intensity', 'Intensity', 0, 1, 0.7), P('mode', 'Mode', 0, 1, 0, { i: 1, opts: ['Chorus', 'Vibrato'] }), P('level', 'Level', 0, 1, 0.5)] },
  tremolo: { name: 'Tremolo', cat: 'mod', algo: 'tremolo', cost: 0.2,
    params: [P('rate', 'Rate', 0, 1, 0.4), P('depth', 'Depth', 0, 1, 0.6), P('wave', 'Shape', 0, 1, 0.3), P('mode', 'Type', 0, 2, 0, { i: 1, opts: ['Opto', 'Harmonic', 'Bias'] }), P('level', 'Level', 0, 1, 0.5)] },
  rotary: { name: 'Rotary', cat: 'mod', algo: 'rotary', cost: 0.4, params: [P('speed', 'Fast', 0, 1, 0, { i: 1 }), P('drive', 'Drive', 0, 1, 0.2), P('balance', 'Balance', 0, 1, 0.5), P('mix', 'Mix', 0, 1, 1)] },
  ringmod: { name: 'Ring mod', cat: 'mod', algo: 'ringmod', cost: 0.2, params: [P('freq', 'Frequency', 0, 1, 0.4), P('fine', 'Fine', 0, 1, 0.5), P('mix', 'Mix', 0, 1, 0.5)] },
  delay: { name: 'Delay', cat: 'time', algo: 'delay', cost: 0.5, tap: true, opts: { maxMs: 3000 },
    params: [P('time', 'Time', 20, 2000, 420, { l: 1, unit: 'ms' }), P('feedback', 'Repeats', 0, 1, 0.35), P('mix', 'Mix', 0, 1, 0.35), P('tone', 'Tone', 0, 1, 0.6),
      P('mode', 'Mode', 0, 10, 0, { i: 1, opts: ['Digital', 'Analog', 'Tape', 'Lo-fi', 'Modulated', 'Reverse', 'Shimmer', 'Ping-pong', 'Dual', 'Warp', 'Delay+verb'] }),
      P('moddepth', 'Mod', 0, 1, 0), P('modrate', 'Mod rate', 0, 1, 0.3), P('subdiv', 'Subdivision', 0, 4, 0, { i: 1 }), P('level', 'Level', 0, 1, 0.5)] },
  reverb: { name: 'Reverb', cat: 'time', algo: 'reverb', cost: 0.8,
    params: [P('decay', 'Decay', 0, 1, 0.5), P('mix', 'Mix', 0, 1, 0.35), P('tone', 'Tone', 0, 1, 0.6), P('predelay', 'Pre-delay', 0, 500, 20, { unit: 'ms' }),
      P('mode', 'Mode', 0, 9, 1, { i: 1, opts: ['Room', 'Hall', 'Plate', 'Spring', 'Shimmer', 'Cloud', 'Modulated', 'Dynamic', '+Delay', 'Swell'] }), P('mod', 'Mod', 0, 1, 0.3), P('shimmer', 'Shimmer', 0, 1, 0.5), P('size', 'Size', 0, 1, 0.5), P('level', 'Level', 0, 1, 0.5)] },
  freeze: { name: 'Freeze', cat: 'time', algo: 'freeze', cost: 0.6, params: [P('decay', 'Decay', 0, 1, 1), P('mix', 'Mix', 0, 1, 0.7), P('mode', 'Mode', 0, 2, 2, { i: 1, opts: ['Latch', 'Momentary', 'Auto'] }), P('speed', 'Speed', 0, 1, 0.3)] },
  slicer: { name: 'Slicer', cat: 'time', algo: 'slicer', cost: 0.2, tap: true, params: [P('time', 'Time', 30, 1000, 125, { l: 1, unit: 'ms' }), P('pattern', 'Pattern', 0, 15, 1, { i: 1 }), P('depth', 'Depth', 0, 1, 1), P('smooth', 'Smooth', 0, 1, 0.2), P('mix', 'Mix', 0, 1, 1)] },
  octave: { name: 'Octave', cat: 'pitch', algo: 'pitch', cost: 0.8, opts: { semis1: -12, level1: 1 },
    params: [P('level1', 'Sub', 0, 1, 0.8), P('level3', 'Up', 0, 1, 0), P('dry', 'Dry', 0, 1, 1), P('tone', 'Tone', 0, 1, 1), P('semis1', 'Low interval', -24, 0, -12, { i: 1 }), P('semis3', 'High interval', 0, 24, 12, { i: 1 })] },
  pitch: { name: 'Pitch shift', cat: 'pitch', algo: 'pitch', cost: 0.8, params: [P('semis1', 'Interval', -24, 24, 7, { i: 1 }), P('level1', 'Level', 0, 1, 1), P('dry', 'Dry', 0, 1, 1), P('cents', 'Detune', -50, 50, 0), P('glide', 'Glide', 0, 1, 0.1)] },
  synth: { name: 'Synth', cat: 'pitch', algo: 'synth', cost: 0.8,
    params: [P('mode', 'Wave', 0, 7, 1, { i: 1, opts: ['Square', 'Saw', 'Organ', 'Strings', 'Brass', 'Sub bass', 'Pad', 'Sweep'] }), P('filter', 'Cutoff', 0, 1, 0.5), P('reso', 'Resonance', 0, 1, 0.4), P('attack', 'Attack', 0, 1, 0.2), P('sens', 'Sensitivity', 0, 1, 0.5), P('octave', 'Octave', -2, 1, 0, { i: 1 }), P('dry', 'Dry', 0, 1, 0), P('wet', 'Wet', 0, 1, 0.8)] },
  lofi: { name: 'Lo-fi', cat: 'util', algo: 'lofi', cost: 0.3, params: [P('mode', 'Type', 0, 4, 0, { i: 1, opts: ['Cassette', 'Vinyl', 'AM radio', 'Telephone', 'Sampler'] }), P('wow', 'Wow', 0, 1, 0.3), P('flutter', 'Flutter', 0, 1, 0.3), P('age', 'Age', 0, 1, 0.4), P('noise', 'Noise', 0, 1, 0.2), P('mix', 'Mix', 0, 1, 1)] },
  crusher: { name: 'Bit crusher', cat: 'util', algo: 'crusher', cost: 0.1, params: [P('bits', 'Bits', 0, 1, 0.5), P('rate', 'Rate', 0, 1, 0.3), P('mix', 'Mix', 0, 1, 1)] },
  volume: { name: 'Volume', cat: 'util', algo: 'volume', cost: 0.05, params: [P('pos', 'Volume', 0, 1, 1), P('min', 'Minimum', 0, 1, 0)] },
  level: { name: 'Output level', cat: 'util', algo: 'utility', cost: 0.05, opts: { kind: 'gain' }, params: [P('level', 'Level', -24, 12, 0, { unit: 'dB' })] },
};
// drive voicings (engine opts.clip), picked per stage in the circuit tab
export const CLIPS = [['ts', 'Tube screamer'], ['diode', 'Diodes'], ['asym', 'Asymmetric'], ['opamp', 'Op-amp'], ['ge', 'Germanium'], ['si', 'Silicon'], ['muff', 'Muff'], ['led', 'LED'], ['jfet', 'JFET'], ['tube', 'Tube'], ['mosfet', 'MOSFET'], ['clean', 'Clean']];
export const COMP_TYPES = [['ota', 'OTA'], ['vca', 'VCA'], ['opto', 'Opto']];

export function stageParam(type, key) {
  return (STAGES[type]?.params || []).find((p) => p.key === key);
}
export function newStage(type, o = {}) {
  return Object.assign({ id: uid('s'), type, on: true, par: false, params: {}, voice: STAGES[type]?.opts?.clip || STAGES[type]?.opts?.type || '' }, o);
}
const isOutput = (k) => k === 'out' || k === 'stereo' || k === 'phones' || k === 'xlr';

// ------------------------------------------------------------------ circuit templates
// Each one fills the chain and says which controls a pedal needs: k = knobs, t = toggles / selectors, f = footswitches.
// Targets use the stage index: '0.gain' = first stage's gain.
const T = (id, name, cat, desc, stages, ctl, o = {}) => ({ id, name, cat, desc, stages, ctl, ...o });
export const CIRCUITS = [
  T('boost', 'Clean boost', 'Boost', 'More volume, a little sparkle', [['boost', { params: { gain: 0.6 } }]], { k: [['LEVEL', '0.level'], ['TONE', '0.treble']] }),
  T('overdrive', 'Overdrive', 'Overdrive', 'Warm mid push, like a tube screamer', [['overdrive']], { k: [['LEVEL', '0.level'], ['TONE', '0.tone'], ['DRIVE', '0.gain']] }),
  T('distortion', 'Distortion', 'Distortion', 'Hard clipping with a filter knob', [['distortion'], ['gate', { params: { threshold: 0.15 } }]], { k: [['DIST', '0.gain'], ['FILTER', '0.tone'], ['VOLUME', '0.level']] }),
  T('fuzz', 'Fuzz', 'Fuzz', 'Big, woolly sustain', [['fuzz']], { k: [['VOLUME', '0.level'], ['TONE', '0.tone'], ['SUSTAIN', '0.gain']] }),
  T('amp', 'Amp in a box', 'Overdrive', 'Gain and a 3 band EQ', [['amp']], { k: [['GAIN', '0.gain'], ['BASS', '0.bass'], ['MID', '0.mid'], ['TREBLE', '0.treble'], ['LEVEL', '0.level']] }),
  T('comp', 'Compressor', 'Dynamics', 'Even, squashed sustain', [['comp']], { k: [['LEVEL', '0.level'], ['SUSTAIN', '0.sustain'], ['ATTACK', '0.attack'], ['BLEND', '0.blend']] }),
  T('chorus', 'Chorus', 'Modulation', 'Shimmery doubled sound', [['chorus']], { k: [['RATE', '0.rate'], ['DEPTH', '0.depth'], ['MIX', '0.mix']], t: [['MODE', '0.mode', ['CHO', 'VIB']]] }),
  T('phaser', 'Phaser', 'Modulation', 'Swirling notches', [['phaser']], { k: [['SPEED', '0.rate'], ['DEPTH', '0.depth'], ['REGEN', '0.feedback']] }),
  T('flanger', 'Flanger', 'Modulation', 'Jet plane sweep', [['flanger']], { k: [['MANUAL', '0.manual'], ['WIDTH', '0.width'], ['SPEED', '0.speed'], ['REGEN', '0.regen']] }),
  T('tremolo', 'Tremolo', 'Modulation', 'Pulsing volume', [['tremolo']], { k: [['RATE', '0.rate'], ['DEPTH', '0.depth'], ['SHAPE', '0.wave']] }),
  T('vibe', 'Vibe', 'Modulation', 'Throbbing photocell phase', [['vibe']], { k: [['SPEED', '0.speed'], ['INTENSITY', '0.intensity']], t: [['MODE', '0.mode', ['CHO', 'VIB']]] }),
  T('delay', 'Delay', 'Delay', 'Echoes with tap tempo', [['delay']], { k: [['TIME', '0.time'], ['REPEATS', '0.feedback'], ['MIX', '0.mix']], t: [['MODE', '0.mode', ['DIG', 'ANA', 'TAPE'], [0, 2]]], tap: true }),
  T('tape', 'Tape echo', 'Delay', 'Warbly, dark repeats', [['delay', { params: { mode: 2, tone: 0.45 } }]], { k: [['TIME', '0.time'], ['REPEATS', '0.feedback'], ['MIX', '0.mix'], ['WOW', '0.moddepth']] }),
  T('reverb', 'Reverb', 'Reverb', 'Room, hall or spring', [['reverb']], { k: [['DECAY', '0.decay'], ['TONE', '0.tone'], ['MIX', '0.mix']], t: [['TYPE', '0.mode', ['ROOM', 'HALL', 'SPRING'], [0, 3]]] }),
  T('shimmer', 'Shimmer verb', 'Reverb', 'Octave-up wash', [['reverb', { params: { mode: 4, decay: 0.75, mix: 0.45 } }]], { k: [['DECAY', '0.decay'], ['SHIMMER', '0.shimmer'], ['MIX', '0.mix']] }),
  T('octave', 'Octave', 'Pitch', 'Adds an octave below', [['octave']], { k: [['SUB', '0.level1'], ['UP', '0.level3'], ['DRY', '0.dry']] }),
  T('wah', 'Wah', 'Wah', 'Expression treadle wah', [['wah', { params: { mode: 0 } }]], { pedal: ['WAH', '0.pos'], k: [['Q', '0.q']] }),
  T('autowah', 'Envelope filter', 'Filter', 'Quacky auto wah', [['wah', { params: { mode: 2, sens: 0.6 } }]], { k: [['SENS', '0.sens'], ['RANGE', '0.range'], ['Q', '0.q']] }),
  T('drivedelay', 'Drive into delay', 'Multi-FX', 'Two pedals in one', [['overdrive'], ['delay', { params: { mix: 0.3 } }]],
    { k: [['DRIVE', '0.gain'], ['LEVEL', '0.level'], ['TIME', '1.time'], ['MIX', '1.mix']], f: [['DRIVE', '0.on'], ['ECHO', '1.on']] }),
  T('shoegaze', 'Shoegaze stack', 'Multi-FX', 'Fuzz, chorus and a huge reverb', [['fuzz', { params: { gain: 0.7 } }], ['chorus', { params: { mix: 0.4 } }], ['reverb', { params: { mode: 5, decay: 0.8, mix: 0.5 } }]],
    { k: [['FUZZ', '0.gain'], ['TONE', '0.tone'], ['WOBBLE', '1.depth'], ['WASH', '2.mix'], ['LEVEL', '0.level']], f: [['FUZZ', '0.on'], ['WASH', '2.on']] }),
  T('ambient', 'Ambient', 'Multi-FX', 'Swells into echo and a cloud reverb', [['swell'], ['delay', { params: { mode: 4, mix: 0.4, feedback: 0.5 } }], ['reverb', { params: { mode: 5, decay: 0.85, mix: 0.55 } }]],
    { k: [['SWELL', '0.attack'], ['TIME', '1.time'], ['REPEATS', '1.feedback'], ['SPACE', '2.mix']] }),
  T('blend', 'Parallel blend', 'Multi-FX', 'Fuzz and octave side by side', [['fuzz'], ['octave', { par: true, params: { dry: 0 } }]],
    { k: [['FUZZ', '0.gain'], ['FUZZ LVL', '0.lvl'], ['OCT LVL', '1.lvl'], ['MIX', 'mix']] }, { mix: true }),
  T('synth', 'Synth', 'Synth', 'Guitar synth with a filter', [['synth']], { k: [['CUTOFF', '0.filter'], ['RES', '0.reso'], ['ATTACK', '0.attack'], ['MIX', '0.wet']], t: [['WAVE', '0.mode', ['SAW', 'SQR', 'PAD'], [1, 0, 6]]] }),
  T('lofi', 'Lo-fi', 'Utility', 'Old cassette wobble', [['lofi']], { k: [['WOW', '0.wow'], ['AGE', '0.age'], ['NOISE', '0.noise'], ['MIX', '0.mix']] }),
];
export function circuitById(id) {
  return CIRCUITS.find((c) => c.id === id);
}
// a fresh circuit from a template: stages plus the control mappings it wants (resolved to stage ids)
export function makeCircuit(id) {
  const t = circuitById(id) || CIRCUITS[1];
  const stages = t.stages.map(([type, o]) => newStage(type, clone(o || {})));
  const res = (to) => {
    if (!to || to === 'mix' || to === 'bypass') return to;
    const [i, k] = to.split('.');
    return stages[+i] ? stages[+i].id + '.' + k : '';
  };
  const circuit = { v: 2, tpl: t.id, cat: t.cat, stages, mix: !!t.mix, mixDef: 1 };
  const wants = {
    knobs: (t.ctl.k || []).map(([label, to]) => ({ label, to: res(to) })),
    toggles: (t.ctl.t || []).map(([label, to, opts, vals]) => ({ label, to: res(to), opts, vals })),
    foots: (t.ctl.f || []).map(([label, to]) => ({ label, to: res(to) })),
    pedal: t.ctl.pedal ? { label: t.ctl.pedal[0], to: res(t.ctl.pedal[1]) } : null,
    tap: !!t.ctl.tap && stages.find((s) => STAGES[s.type].tap),
  };
  return { circuit, wants };
}

// ------------------------------------------------------------------ targets
// everything a control can drive: [value, label, info]
export function targetsFor(circuit, ctlKind) {
  const out = [['', 'Nothing']];
  const sw = ctlKind === 'foot' || ctlKind === 'button';
  if (ctlKind === 'foot') out.push(['bypass', 'Bypass (pedal on / off)']);
  if (circuit.mix) out.push(['mix', 'Wet / dry mix', { min: 0, max: 1 }]);
  circuit.stages.forEach((s, i) => {
    const st = STAGES[s.type];
    if (!st) return;
    const nm = `${i + 1}. ${st.name}`;
    out.push([s.id + '.on', `${nm}: on / off`, { min: 0, max: 1, i: 1 }]);
    if (sw && st.tap) out.push([s.id + '.tap', `${nm}: tap tempo`]);
    if (s.par || circuit.stages[i + 1]?.par) out.push([s.id + '.lvl', `${nm}: blend level`, { min: 0, max: 2, def: 1 }]);
    for (const p of st.params) out.push([s.id + '.' + p.key, `${nm}: ${p.label}`, p]);
  });
  return out;
}
export function targetInfo(circuit, to) {
  if (!to) return null;
  if (to === 'mix') return { min: 0, max: 1, label: 'Mix' };
  const [sid, key] = to.split('.');
  const s = circuit.stages.find((x) => x.id === sid);
  if (!s) return null;
  if (key === 'on') return { min: 0, max: 1, i: 1, label: 'On' };
  if (key === 'lvl') return { min: 0, max: 2, label: 'Blend level' };
  if (key === 'tap') return { tap: true, label: 'Tap' };
  const p = stageParam(s.type, key);
  return p ? { ...p } : null;
}
export function targetLabel(circuit, to) {
  if (!to) return 'Nothing';
  if (to === 'bypass') return 'Bypass';
  const t = targetsFor(circuit, 'foot').find((x) => x[0] === to);
  return t ? t[1] : 'Missing stage';
}
// a default mapping for a control: full range of the target
export function mapTo(circuit, to, o = {}) {
  const info = targetInfo(circuit, to) || {};
  return Object.assign({ to, min: info.min ?? 0, max: info.max ?? 1, taper: info.l ? 'log' : 'lin', invert: false }, o);
}

// ------------------------------------------------------------------ migration from the old sketch format
const OLD = { boost: 'boost', drive: 'overdrive', dist: 'distortion', fuzz: 'fuzz', comp: 'comp', eq: 'amp', chorus: 'chorus', phaser: 'phaser', flanger: 'flanger', trem: 'tremolo', delay: 'delay', reverb: 'reverb', octave: 'octave', pitch: 'octave', filter: 'autowah', synth: 'synth' };
export function migrateCircuit(d) {
  if (d.circuit && d.circuit.v === 2) return false;
  const old = d.circuit || {};
  const { circuit } = makeCircuit(OLD[old.type] || 'overdrive');
  d.circuit = circuit;
  return true;
}
// map controls that have no mapping yet, by their label or old parameter name
const SYN = { drive: ['gain', 'drive', 'fuzz', 'sustain', 'dist'], gain: ['gain'], level: ['level', 'volume', 'vol', 'output'], volume: ['level', 'volume'], tone: ['tone', 'treble', 'filter'], filter: ['tone', 'filter'],
  time: ['time'], repeats: ['feedback', 'repeats'], feedback: ['feedback'], mix: ['mix', 'wet'], rate: ['rate', 'speed'], speed: ['rate', 'speed'], depth: ['depth', 'width', 'intensity'], decay: ['decay'],
  bass: ['bass', 'lowgain'], mid: ['mid', 'mid1gain'], treble: ['treble', 'highgain'], cutoff: ['filter'], res: ['reso'], resonance: ['reso'], glide: ['glide'], mod: ['moddepth', 'mod'], sub: ['level1'], q: ['q'] };
export function autoMap(d) {
  const C = d.circuit;
  const used = new Set();
  const all = targetsFor(C, 'knob').filter((t) => t[2] && !String(t[0]).endsWith('.on'));
  for (const c of d.ctls) {
    if (c.map || c.kind === 'led' || c.kind === 'screen') continue;
    if (c.kind === 'foot') {
      c.map = c.param === 'Tap tempo' && C.stages.find((s) => STAGES[s.type].tap) ? { to: C.stages.find((s) => STAGES[s.type].tap).id + '.tap' } : { to: 'bypass' };
      continue;
    }
    if (c.kind === 'dip') continue;
    const words = [c.param, c.label].filter(Boolean).map((w) => w.toLowerCase().trim());
    let hit = null;
    for (const w of words) {
      const keys = SYN[w] || [w];
      hit = all.find((t) => !used.has(t[0]) && keys.includes(t[0].split('.')[1])) || all.find((t) => !used.has(t[0]) && t[2].label && t[2].label.toLowerCase() === w);
      if (hit) break;
    }
    if (!hit && (c.kind === 'knob' || c.kind === 'slider' || c.kind === 'trim' || c.kind === 'pedal')) hit = all.find((t) => !used.has(t[0]) && !t[2].i);
    if (!hit && (c.kind === 'toggle' || c.kind === 'sel')) hit = all.find((t) => !used.has(t[0]) && t[2].i && t[2].max > 1);
    if (hit) {
      used.add(hit[0]);
      c.map = mapTo(C, hit[0]);
      if ((c.kind === 'toggle' || c.kind === 'sel') && hit[2].opts) c.map.max = Math.min(hit[2].max, hit[2].min + ((c.ways || c.n || 2) - 1));
    } else c.map = { to: '' };
  }
  for (const l of d.ctls) if (l.kind === 'led' && !l.bind) l.bind = 'on';
}

// ------------------------------------------------------------------ the block definition
const TAPERS = { lin: (t) => t, audio: (t) => t * t, rev: (t) => 1 - (1 - t) * (1 - t), log: (t) => t };
export const TAPER_NAMES = [['lin', 'Linear'], ['log', 'Log'], ['audio', 'Audio'], ['rev', 'Reverse']];
export function mapValue(m, info, t) {
  t = clamp(t, 0, 1);
  if (m.invert) t = 1 - t;
  const lo = m.min ?? info?.min ?? 0, hi = m.max ?? info?.max ?? 1;
  let v;
  if (m.taper === 'log' && lo > 0 && hi > 0) v = lo * Math.pow(hi / lo, t);
  else v = lo + (hi - lo) * (TAPERS[m.taper] || TAPERS.lin)(t);
  if (info && (info.i || info.key === 'on')) v = Math.round(v);
  return v;
}
const fmtV = (v, info) => {
  if (!info) return '';
  if (info.opts && info.i) return info.opts[Math.round(v) - (info.min || 0)] ?? String(Math.round(v));
  if (info.i) return String(Math.round(v));
  if (info.unit === 'ms') return v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms';
  if (info.unit === 'dB' || (info.min < 0 && info.max > 0 && info.max >= 12)) return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
  if (info.max > 20) return String(Math.round(v));
  return ((v - (info.min || 0)) / ((info.max - info.min) || 1) * 10).toFixed(1);
};
export const S = 2; // board units per millimetre
// audio jacks in port order: inputs, then outputs (main out first)
export function portJacks(D) {
  const order = { out: 0, stereo: 1, phones: 2, xlr: 3 };
  return {
    ins: D.jacks.filter((j) => j.kind === 'in'),
    outs: D.jacks.filter((j) => isOutput(j.kind)).sort((a, b) => order[a.kind] - order[b.kind]),
    exps: D.jacks.filter((j) => j.kind === 'exp'),
  };
}
// stage index in the chain (taps are routed by index)
const stageIndex = (C, sid) => C.stages.findIndex((s) => s.id === sid);

/** Build a catalog block definition from a factory design. */
export function designToDef(design, o = {}) {
  const D = clone(design);
  const C = D.circuit;
  const stages = C.stages.filter((s) => STAGES[s.type]);
  // parallel groups: a stage marked par joins the group of the stage before it
  let gid = 0;
  const groups = stages.map((s, i) => (s.par && i > 0 ? 0 : ++gid));
  stages.forEach((s, i) => {
    if (s.par && i > 0) groups[i] = groups[i - 1];
  });
  const groupSize = (g) => groups.filter((x) => x === g).length;
  const chain = stages.map((s, i) => {
    const st = STAGES[s.type];
    const opts = Object.assign({}, st.opts || {});
    if (s.voice && st.algo === 'drive') opts.clip = s.voice;
    if (s.voice && st.algo === 'comp') opts.type = s.voice;
    const params = {};
    for (const p of st.params) params[p.key] = s.params[p.key] ?? p.def;
    const sj = { prefix: s.id, algo: st.algo, opts, params, on: s.on !== false };
    if (groupSize(groups[i]) > 1) sj.group = groups[i];
    return sj;
  });
  const fixed = {};
  stages.forEach((s) => {
    for (const p of STAGES[s.type].params) fixed[s.id + '.' + p.key] = s.params[p.key] ?? p.def;
    fixed[s.id + '.on'] = s.on !== false ? 1 : 0;
    if (s.par || groupSize(groups[stages.indexOf(s)]) > 1) fixed[s.id + '.lvl'] = s.lvl ?? 1;
  });
  if (C.mix) fixed.mix = C.mixDef ?? 1;

  // jacks -> ports
  const { ins, outs } = portJacks(D);
  const jackKinds = {};
  outs.forEach((j, i) => {
    if (j.kind === 'phones') jackKinds['o' + i] = 'phones';
    if (j.kind === 'xlr') jackKinds['o' + i] = 'xlr';
  });
  const ports = { ins: ins.length ? ins.map((j, i) => j.label || (ins.length > 1 ? 'IN ' + (i + 1) : 'INPUT')) : ['INPUT'], outs: outs.length ? outs.map((j) => j.label || 'OUTPUT') : ['OUTPUT'] };

  // controls and their mappings
  const controls = [];
  const maps = []; // {key, n, def, m, info}
  const knobLike = { knob: 'knob', trim: 'knob', slider: 'slider', pedal: 'treadle' };
  const disp = (m, info) => (v) => (m && info && !info.tap ? fmtV(mapValue(m, info, v), info) : (v * 10).toFixed(1));
  const addMap = (key, n, def, m) => {
    if (!m || !m.to || m.to === 'bypass' || m.to.endsWith('.tap')) return;
    const info = targetInfo(C, m.to);
    if (info) maps.push({ key, n, def, m, info, to: m.to });
  };
  let tapSub = null;
  for (const c of D.ctls) {
    if (c.hidden) continue;
    const key = 'u.' + c.id;
    const m = c.map || null;
    const info = m && targetInfo(C, m.to);
    const base = { cid: c.id, label: c.label || '', virtual: true };
    if (knobLike[c.kind]) {
      const val = c.kind === 'pedal' ? c.value ?? 0.5 : c.value ?? 0.5;
      controls.push(Object.assign(base, { t: knobLike[c.kind], p: key, min: 0, max: 1, def: val, display: disp(m, info) }, c.kind === 'slider' ? { h: (c.h || 24) * S, orient: c.orient } : {}, c.kind === 'pedal' ? { h: (c.h || 60) * S, w: (c.w || 40) * S } : {}));
      addMap(key, 0, val, m);
    } else if (c.kind === 'toggle' || c.kind === 'sel') {
      const n = c.kind === 'toggle' ? c.ways : c.n || 4;
      const opts = (c.opts || []).slice(0, n);
      while (opts.length < n) opts.push(String(opts.length + 1));
      controls.push(Object.assign(base, { t: c.kind === 'toggle' ? 'toggle' : 'sel', p: key, options: opts, def: c.pos || 0 }));
      addMap(key, n, c.pos || 0, m);
    } else if (c.kind === 'button') {
      if (m && m.to && m.to.endsWith('.tap')) controls.push(Object.assign(base, { t: 'button', event: { type: 1, arg: stageIndex(C, m.to.split('.')[0]) * 100 }, virtual: undefined }));
      else {
        controls.push(Object.assign(base, { t: 'button', toggle: true, p: key, def: c.on ? 1 : 0, led: c.led, ledColor: c.ledColor }));
        addMap(key, 2, c.on ? 1 : 0, m);
      }
    } else if (c.kind === 'foot') {
      const to = m ? m.to : 'bypass';
      if (!to || to === 'bypass') controls.push(Object.assign(base, { t: 'foot', action: 'bypass', virtual: undefined }));
      else if (to.endsWith('.tap')) {
        const idx = stageIndex(C, to.split('.')[0]);
        if (tapSub == null) tapSub = idx;
        controls.push(Object.assign(base, { t: 'foot', action: 'tap', tapSub: idx, tapTarget: '_tap', virtual: undefined }));
      } else {
        // latching footswitch on a param (stage on / off by default)
        const def0 = to.endsWith('.on') ? (stages.find((s) => s.id === to.split('.')[0])?.on !== false ? 1 : 0) : 1;
        controls.push(Object.assign(base, { t: 'foot', action: 'toggle', p: key, def: def0 }));
        addMap(key, 2, def0, m);
      }
    } else if (c.kind === 'dip') {
      const n = c.n || 4;
      for (let i = 0; i < n; i++) {
        const k2 = key + '.' + i;
        const mi = (c.maps || [])[i] || null;
        controls.push({ cid: c.id + '.' + i, t: 'toggle', p: k2, options: ['OFF', 'ON'], def: c.bits?.[i] ? 1 : 0, virtual: true, label: (c.label || 'DIP') + ' ' + (i + 1) });
        addMap(k2, 2, c.bits?.[i] ? 1 : 0, mi);
      }
    } else if (c.kind === 'led') {
      const bind = c.bind || 'on';
      const l = { cid: c.id, t: 'led', color: c.color, label: '' };
      if (bind === 'on') l.bind = 'on';
      else if (bind === 'always') Object.assign(l, { bind: 'fn', ledFn: () => true });
      else if (bind === 'off') Object.assign(l, { bind: 'fn', ledFn: () => null });
      else if (bind.startsWith('ctl:')) {
        const src = D.ctls.find((x) => x.id === bind.slice(4));
        const k3 = 'u.' + bind.slice(4);
        const n = src ? (src.kind === 'toggle' ? src.ways : src.kind === 'sel' ? src.n || 4 : 2) : 2;
        const knob = src && knobLike[src.kind];
        Object.assign(l, { bind: 'fn', ledFn: (ui, b) => !b.bypass && ((ui[k3] ?? 0) / (knob ? 1 : Math.max(1, n - 1))) > (knob ? 0.05 : 0.5) });
      } else if (bind.startsWith('tap:')) l.bind = 'tap:' + bind.slice(4) + '.time';
      controls.push(l);
    }
  }
  // expression input: drives one of the knob-like controls
  const ctrlIns = [];
  for (const j of D.jacks.filter((x) => x.kind === 'exp')) {
    const tgt = D.ctls.find((c) => c.id === j.drive) || D.ctls.find((c) => c.kind === 'pedal') || D.ctls.find((c) => c.kind === 'knob');
    if (tgt && knobLike[tgt.kind]) ctrlIns.push({ label: j.label || 'EXP', param: 'u.' + tgt.id, min: 0, max: 1, _jack: j.id });
  }
  const derive = (ui) => {
    const out = {};
    for (const x of maps) {
      let v = ui[x.key];
      if (v == null) v = x.def;
      if (x.n && Array.isArray(x.m.values) && x.m.values.length) out[x.to] = x.m.values[clamp(Math.round(v), 0, x.m.values.length - 1)];
      else out[x.to] = mapValue(x.m, x.info, x.n ? v / Math.max(1, x.n - 1) : v);
    }
    return out;
  };
  const mat = D.enc.mat || {};
  const cost = 0.1 + stages.reduce((a, s) => a + (STAGES[s.type].cost || 0.4), 0);
  const names = stages.map((s) => STAGES[s.type].name);
  const def = {
    id: o.id || D.blockId || 'custom.' + uid('x'),
    name: D.name || 'Custom pedal',
    code: D.name || 'Custom',
    kind: 'Custom',
    cat: o.cat || C.cat || 'Multi-FX',
    brand: 'Custom',
    typeName: names.join(' + ') || 'Custom pedal',
    desc: (D.desc ? D.desc + ' ' : '') + 'Made in the Pedal Factory: ' + (names.join(' into ') || 'clean pass-through') + '.',
    form: 'custom',
    design: D,
    color: /^#[0-9a-f]{6}$/i.test(mat.c || '') ? mat.c : '#555555',
    algo: 'chain',
    opts: { chain, mix: !!C.mix, mixDef: C.mixDef ?? 1 },
    fixed,
    derive,
    ports,
    jackKinds,
    stereo: 'mono',
    cost,
    controls,
    noBypassClick: true,
    tags: ['custom', 'factory', ...names.map((n) => n.toLowerCase())],
  };
  if (tapSub != null) def.tapSub = tapSub;
  if (ctrlIns.length) def.ctrl = { ins: ctrlIns };
  if (o.hidden) def.hidden = true;
  return def;
}
