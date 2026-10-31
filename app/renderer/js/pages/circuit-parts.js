// Circuit parts: everything you can drop into a circuit in the circuit editor. Audio parts run an engine
// algorithm (see docs/engine-blocks.md) or a small native part of the engine's 'patch' block; control parts
// make control signals (envelopes, LFOs, logic, comparators, math) that can drive any part's values.
// Every value of a part is also a control input port, so anything can be wired to move anything.
//
// Signals: audio, analog (a float from -255 to 255) and binary (0 or 1, on above 0.5). A part value reads an
// analog signal through its input span (0 to 1 unless the wire says otherwise) and sweeps its own range; the
// math, delay and output parts take values as they are ('raw' params). Port sig: 'a' audio, 'n' analog, 'b' binary.

// ------------------------------------------------------------------ engine algorithm stages
// params: [key, label, min, max, default, flags] flags: i = whole numbers, l = log sweep, opts = names
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
// drive voicings (engine opts.clip)
export const CLIPS = [['ts', 'Tube screamer'], ['diode', 'Diodes'], ['asym', 'Asymmetric'], ['opamp', 'Op-amp'], ['ge', 'Germanium'], ['si', 'Silicon'], ['muff', 'Muff'], ['led', 'LED'], ['jfet', 'JFET'], ['tube', 'Tube'], ['mosfet', 'MOSFET'], ['clean', 'Clean']];
export const COMP_TYPES = [['ota', 'OTA'], ['vca', 'VCA'], ['opto', 'Opto']];

// ------------------------------------------------------------------ the part registry
// group: palette group, ain / aout: audio ports, cout: control outputs, params: values (each one a control input)
export const GROUPS = [
  ['drive', 'Drive and clipping'], ['dyn', 'Dynamics'], ['eq', 'Filters and EQ'], ['mod', 'Modulation'], ['time', 'Delay and reverb'],
  ['pitch', 'Pitch and synth'], ['route', 'Mixing and routing'], ['util', 'Utility'], ['script', 'Script audio'], ['ctl', 'Control signals'], ['logic', 'Logic and comparators'], ['io', 'Inputs and outputs'],
];
const A_IN = [['in', 'In']], A_OUT = [['out', 'Out']], C_OUT = [['cv', 'Out']], B_OUT = [['cv', 'Out', 'b']];
const SIG = { sig: 1 }; // drawn as a main input of control parts
const BSIG = { sig: 1, bin: 1 }; // a binary main input
export const LIM = 255; // analog values stay within -255..255
const RAW = (key, label, def, f = {}) => P(key, label, -LIM, LIM, def, { raw: 1, sig: 1, ...f });
export const PARTS = {};
for (const [k, st] of Object.entries(STAGES))
  PARTS[k] = { name: st.name, group: st.cat === 'eq' ? 'eq' : st.cat, algo: st.algo, ain: A_IN, aout: A_OUT, cout: [], tap: !!st.tap, params: [...st.params, P('on', 'On', 0, 1, 1, { i: 1, opts: ['Off', 'On'] })] };
const N = (k, o) => (PARTS[k] = { ain: [], aout: [], cout: [], params: [], native: k, ...o });
N('filter', { name: 'Filter', group: 'eq', ain: A_IN, aout: A_OUT, desc: 'Resonant low, band or high pass. Wire an envelope or LFO to Cutoff for sweeps.',
  params: [P('freq', 'Cutoff', 40, 16000, 1200, { l: 1, unit: 'Hz' }), P('res', 'Resonance', 0, 1, 0.3), P('mode', 'Type', 0, 3, 0, { i: 1, opts: ['Low pass', 'Band pass', 'High pass', 'Notch'] })] });
N('shaper', { name: 'Waveshaper', group: 'drive', ain: A_IN, aout: A_OUT, desc: 'Plain clipping or wave folding.',
  params: [P('drive', 'Drive', 0, 1, 0.5), P('mode', 'Curve', 0, 3, 0, { i: 1, opts: ['Soft', 'Hard', 'Fold', 'Asymmetric'] }), P('mix', 'Mix', 0, 1, 1), P('level', 'Level', 0, 1, 0.5)] });
N('vca', { name: 'VCA', group: 'route', ain: A_IN, aout: A_OUT, desc: 'Gain you can move: wire an envelope or LFO to Gain.', params: [P('gain', 'Gain', 0, 2, 1)] });
N('mixer', { name: 'Mixer', group: 'route', ain: [['in1', 'In 1'], ['in2', 'In 2'], ['in3', 'In 3'], ['in4', 'In 4']], aout: A_OUT, desc: 'Four inputs with their own level.',
  params: [P('g1', 'Level 1', 0, 2, 1), P('g2', 'Level 2', 0, 2, 1), P('g3', 'Level 3', 0, 2, 1), P('g4', 'Level 4', 0, 2, 1)] });
N('xfade', { name: 'Blend', group: 'route', ain: [['a', 'A'], ['b', 'B']], aout: A_OUT, desc: 'Fades between two signals (A at 0, B at 1).', params: [P('mix', 'Mix', 0, 1, 0.5)] });
N('switch', { name: 'A / B switch', group: 'route', ain: [['a', 'A'], ['b', 'B']], aout: A_OUT, desc: 'Picks one of two paths. Wire a footswitch, toggle or comparator to Select.', params: [P('sel', 'Select', 0, 1, 0, { i: 1, opts: ['A', 'B'] })] });
N('pol', { name: 'Polarity', group: 'route', ain: A_IN, aout: A_OUT, desc: 'Flips the signal upside down.', params: [P('on', 'Invert', 0, 1, 1, { i: 1, opts: ['Off', 'On'] })] });
N('fb', { name: 'Feedback loop', group: 'route', ain: [['in', 'Send']], aout: [['out', 'Return']], desc: 'The only way to wire audio in a loop: what goes in comes back out after the delay time, quieter.',
  params: [P('amount', 'Amount', 0, 0.95, 0.5), P('time', 'Delay', 0, 2000, 250, { unit: 'ms' }), P('tone', 'Tone', 200, 16000, 6000, { l: 1, unit: 'Hz' })] });
N('env', { name: 'Envelope follower', group: 'ctl', ain: A_IN, cout: C_OUT, desc: 'Turns how hard you play into a control signal.',
  params: [P('sens', 'Sensitivity', 0, 1, 0.5), P('attack', 'Attack', 0.5, 200, 5, { l: 1, unit: 'ms' }), P('release', 'Release', 5, 2000, 150, { l: 1, unit: 'ms' })] });
N('lfo', { name: 'LFO', group: 'ctl', cout: C_OUT, tap: true, desc: 'A repeating wave between Low and High. Sync follows tap tempo.',
  params: [P('rate', 'Rate', 0.05, 20, 2, { l: 1, unit: 'Hz' }), P('shape', 'Shape', 0, 5, 0, { i: 1, opts: ['Sine', 'Triangle', 'Square', 'Saw up', 'Saw down', 'Random'] }), P('lo', 'Low', 0, 1, 0), P('hi', 'High', 0, 1, 1), P('sync', 'Sync', 0, 1, 0, { i: 1, opts: ['Off', 'Tap'] })] });
N('seq', { name: 'Step sequencer', group: 'ctl', cout: C_OUT, tap: true, desc: 'Steps through up to 8 values.',
  params: [P('rate', 'Rate', 0.1, 20, 4, { l: 1, unit: 'Hz' }), P('steps', 'Steps', 1, 8, 8, { i: 1 }), P('glide', 'Glide', 0, 1, 0), ...[0.2, 0.9, 0.5, 1, 0.1, 0.7, 0.4, 0.8].map((v, i) => P('s' + (i + 1), 'Step ' + (i + 1), 0, 1, v))] });
N('const', { name: 'Value', group: 'ctl', cout: C_OUT, desc: 'A fixed control value.', params: [P('value', 'Value', 0, 1, 0.5)] });
N('scale', { name: 'Scale / curve', group: 'ctl', cout: C_OUT, desc: 'Squeezes a control signal into a range and bends it.',
  params: [P('in', 'In', 0, 1, 0, SIG), P('lo', 'Low', 0, 1, 0), P('hi', 'High', 0, 1, 1), P('curve', 'Curve', 0, 3, 0, { i: 1, opts: ['Linear', 'Exponential', 'Log', 'S curve'] }), P('invert', 'Invert', 0, 1, 0, { i: 1, opts: ['Off', 'On'] })] });
N('math', { name: 'Math', group: 'ctl', cout: C_OUT, desc: 'Adds, multiplies or compares two control signals.',
  params: [P('a', 'A', 0, 1, 0, SIG), P('b', 'B', 0, 1, 0, SIG), P('op', 'Operation', 0, 5, 0, { i: 1, opts: ['Add', 'Multiply', 'Lowest', 'Highest', 'Difference', 'Subtract'] })] });
N('smooth', { name: 'Smoother', group: 'ctl', cout: C_OUT, desc: 'Slows a control signal down (slew).', params: [P('in', 'In', 0, 1, 0, SIG), P('time', 'Time', 1, 2000, 60, { l: 1, unit: 'ms' })] });
N('sh', { name: 'Sample and hold', group: 'ctl', cout: C_OUT, desc: 'Grabs the input each time Trigger goes high.', params: [P('in', 'In', 0, 1, 0, SIG), P('trig', 'Trigger', 0, 1, 0, BSIG)] });
N('and', { name: 'AND', group: 'logic', cout: B_OUT, desc: 'On when both inputs are on.', params: [P('a', 'A', 0, 1, 0, BSIG), P('b', 'B', 0, 1, 0, BSIG)] });
N('or', { name: 'OR', group: 'logic', cout: B_OUT, desc: 'On when either input is on.', params: [P('a', 'A', 0, 1, 0, BSIG), P('b', 'B', 0, 1, 0, BSIG)] });
N('xor', { name: 'XOR', group: 'logic', cout: B_OUT, desc: 'On when exactly one input is on.', params: [P('a', 'A', 0, 1, 0, BSIG), P('b', 'B', 0, 1, 0, BSIG)] });
N('not', { name: 'NOT', group: 'logic', cout: B_OUT, desc: 'On when the input is off.', params: [P('a', 'In', 0, 1, 0, BSIG)] });
N('toggle', { name: 'Flip-flop', group: 'logic', cout: B_OUT, desc: 'Flips on and off each time Trigger goes high.', params: [P('trig', 'Trigger', 0, 1, 0, BSIG), P('reset', 'Reset', 0, 1, 0, BSIG)] });
N('cmp', { name: 'Comparator', group: 'logic', cout: B_OUT, desc: 'On when the input goes over Threshold, off again below it (with hysteresis).',
  params: [P('in', 'In', 0, 1, 0, SIG), P('thr', 'Threshold', 0, 1, 0.5), P('hyst', 'Hysteresis', 0, 0.5, 0.05)] });
N('window', { name: 'Window comparator', group: 'logic', cout: B_OUT, desc: 'On while the input is between Low and High.', params: [P('in', 'In', 0, 1, 0, SIG), P('lo', 'Low', 0, 1, 0.25), P('hi', 'High', 0, 1, 0.75)] });
// math on analog values (-255 to 255), as they are
N('add', { name: 'Add', group: 'logic', cout: C_OUT, desc: 'A plus B. Analog values from -255 to 255.', params: [RAW('a', 'A', 0), RAW('b', 'B', 0)] });
N('sub', { name: 'Subtract', group: 'logic', cout: C_OUT, desc: 'A minus B.', params: [RAW('a', 'A', 0), RAW('b', 'B', 0)] });
N('mul', { name: 'Multiply', group: 'logic', cout: C_OUT, desc: 'A times B (kept within -255 to 255).', params: [RAW('a', 'A', 0), RAW('b', 'B', 1)] });
N('div', { name: 'Divide', group: 'logic', cout: C_OUT, desc: 'A divided by B. Dividing by zero gives 0.', params: [RAW('a', 'A', 0), RAW('b', 'B', 1)] });
N('cdelay', { name: 'Delay', group: 'logic', cout: C_OUT, desc: 'Puts out whatever came in, Time seconds later (up to 10 s). Works for analog and binary signals.',
  params: [RAW('in', 'In', 0), P('time', 'Time', 0, 10, 0.5, { raw: 1, unit: 's' })] });
// script audio: sound a screen script makes or shapes. Wire their values from circuit inputs and drive those from
// the screen's outputs in the wiring diagram. Every value glides in the engine, so a script can set them per frame.
N('osc', { name: 'Script osc', group: 'script', aout: A_OUT, desc: 'An oscillator. Note is a MIDI note number (69 = A 440 Hz, fractions bend it), so a screen output can play it.',
  params: [P('note', 'Note', 0, 127, 57, { raw: 1 }), P('amp', 'Level', 0, 1, 0.5), P('shape', 'Wave', 0, 4, 0, { i: 1, opts: ['Sine', 'Triangle', 'Saw', 'Square', 'Pulse'] }), P('pw', 'Pulse width', 0.05, 0.95, 0.5), P('glide', 'Glide', 0, 2000, 10, { unit: 'ms' })] });
N('noise', { name: 'Script noise', group: 'script', aout: A_OUT, desc: 'White or pink noise.', params: [P('amp', 'Level', 0, 1, 0.3), P('color', 'Colour', 0, 1, 0, { i: 1, opts: ['White', 'Pink'] })] });
N('adsr', { name: 'Script envelope', group: 'script', ain: A_IN, aout: A_OUT, cout: C_OUT, desc: 'An ADSR envelope: Gate on starts it, off lets it go. The audio input goes through it and Out is its level.',
  params: [P('gate', 'Gate', 0, 1, 0, BSIG), P('attack', 'Attack', 0.5, 5000, 5, { l: 1, unit: 'ms' }), P('decay', 'Decay', 1, 5000, 150, { l: 1, unit: 'ms' }), P('sustain', 'Sustain', 0, 1, 0.7), P('release', 'Release', 1, 10000, 250, { l: 1, unit: 'ms' })] });
N('sampler', { name: 'Script sampler', group: 'script', aout: A_OUT, cout: [['cv', 'Playing', 'b'], ['pos', 'Position']], desc: 'Plays a sound the screen script loads into its slot (1 to 8). Gate starts it; One shot plays to the end, Gate stops on release, Loop repeats while the gate is on.',
  params: [P('slot', 'Slot', 1, 8, 1, { i: 1 }), P('gate', 'Gate', 0, 1, 0, BSIG), P('mode', 'Mode', 0, 2, 0, { i: 1, opts: ['One shot', 'Gate', 'Loop'] }), P('rate', 'Speed', 0.25, 4, 1, { l: 1 }), P('level', 'Level', 0, 2, 1), P('start', 'Start', 0, 1, 0)] });
N('scriptin', { name: 'Script audio in', group: 'script', aout: A_OUT, desc: 'Sound a screen script sends into this circuit: to = "circuit:Name" in audio.gen or audio.play, where Name is this part\'s label or the circuit\'s name.',
  params: [P('level', 'Level', 0, 2, 1)] });
N('sgain', { name: 'Script gain', group: 'script', ain: A_IN, aout: A_OUT, desc: 'Gain with a low and a high cut that all glide over Smooth, for values a script sets every frame.',
  params: [P('gain', 'Gain', 0, 2, 1), P('lp', 'High cut', 200, 20000, 20000, { l: 1, unit: 'Hz' }), P('hp', 'Low cut', 20, 2000, 20, { l: 1, unit: 'Hz' }), P('smooth', 'Smooth', 0, 500, 20, { unit: 'ms' })] });
// circuit inputs and outputs (what the pedal's jacks and controls wire to)
PARTS.in = { name: 'Audio in', group: 'io', io: 'in', ain: [], aout: A_OUT, cout: [], params: [], desc: 'Where the pedal sends audio into this circuit.' };
PARTS.out = { name: 'Audio out', group: 'io', io: 'out', ain: A_IN, aout: [], cout: [], params: [], desc: 'What this circuit sends back out.' };
PARTS.analog = { name: 'Analog input', group: 'io', io: 'ctl', ain: [], aout: [], cout: C_OUT, params: [], desc: 'A value the pedal can set (from -255 to 255): wire a knob, expression jack, screen or another circuit to it in the wiring diagram.' };
PARTS.binary = { name: 'Binary input', group: 'io', io: 'ctl', ain: [], aout: [], cout: B_OUT, params: [], desc: 'An on / off input: wire a footswitch, switch, footswitch jack, screen or another circuit to it in the wiring diagram.' };
PARTS.anaout = { name: 'Analog output', group: 'io', io: 'cout', ain: [], aout: [], cout: [], params: [RAW('in', 'In', 0)], desc: 'A value this circuit puts out: wire it to an LED, an EXP jack, a screen or another circuit in the wiring diagram.' };
PARTS.binout = { name: 'Binary output', group: 'io', io: 'cout', ain: [], aout: [], cout: [], params: [P('in', 'In', 0, 1, 0, { raw: 1, sig: 1, bin: 1 })], desc: 'An on / off output: wire it to an LED, a footswitch jack, a screen or another circuit in the wiring diagram.' };
// older circuits had a single 'knob' kind of input (migrateGraph turns it into analog or binary)
PARTS.knob = { ...PARTS.analog, group: 'old', name: 'Control input' };
PARTS.note = { name: 'Note', group: 'io', io: 'note', ain: [], aout: [], cout: [], params: [], desc: 'A comment on the canvas.' };
// palette blurbs for the engine parts
const BLURB = { overdrive: 'Soft clipping with a mid hump.', distortion: 'Hard clipping and a filter.', fuzz: 'Big, squared off sustain.', amp: 'Tube style drive with a 3 band stack.', boost: 'Clean gain.', comp: 'Evens out your playing.', gate: 'Cuts noise between notes.', swell: 'Fades each note in.',
  eq: 'Bass, mid and treble.', wah: 'Swept band pass.', delay: 'Echoes with tap tempo.', reverb: 'Rooms, halls, springs and more.', octave: 'Octave down and up.', synth: 'Guitar synth voices.' };
for (const [k, b] of Object.entries(BLURB)) if (PARTS[k]) PARTS[k].desc = b;

/** Signal kind of a part value: 'b' binary or 'n' analog. */
export const paramSig = (p) => (p.bin || (p.i && p.min === 0 && p.max === 1) ? 'b' : 'n');
export const isRaw = (p) => !!(p && p.raw);
export const isAudioPart = (t) => !!PARTS[t] && !PARTS[t].io && (PARTS[t].ain.length || PARTS[t].aout.length);
export const partParam = (t, key) => (PARTS[t]?.params || []).find((p) => p.key === key);

// ------------------------------------------------------------------ nodes and ports
export const nid = (p = 'n') => p + Math.random().toString(36).slice(2, 8);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export function newNode(type, x = 0, y = 0, o = {}) {
  if (type === 'knob') type = o.steps === 2 ? 'binary' : 'analog'; // the old control input
  const pt = PARTS[type];
  const n = { id: nid(), t: type, x: Math.round(x), y: Math.round(y), p: {} };
  if (STAGES[type]?.opts?.clip) n.voice = STAGES[type].opts.clip;
  if (STAGES[type]?.opts?.type) n.voice = STAGES[type].opts.type;
  if (pt && pt.io === 'in') n.name = 'IN';
  if (pt && pt.io === 'out') n.name = 'OUT';
  if (type === 'analog') Object.assign(n, { name: 'Analog', def: 0.5, min: 0, max: 1, steps: 0 });
  if (type === 'binary') Object.assign(n, { name: 'Switch', def: 0, opts: ['Off', 'On'] });
  if (type === 'anaout') Object.assign(n, { name: 'Value out', min: 0, max: 1 });
  if (type === 'binout') Object.assign(n, { name: 'Gate out' });
  if (pt && pt.io === 'note') Object.assign(n, { text: 'Note', w: 160, h: 60 });
  Object.assign(n, o);
  if (type === 'binary') delete n.steps;
  return n;
}
/** Old 'knob' control inputs become analog (or binary for 2 way switches). Returns true when it changed G. */
export function migrateGraph(G) {
  let changed = false;
  for (const n of (G && G.nodes) || []) {
    if (n.t !== 'knob') continue;
    changed = true;
    if (n.steps === 2) {
      n.t = 'binary';
      n.def = n.def ? 1 : 0;
      if (!n.opts || n.opts.length < 2) n.opts = ['Off', 'On'];
      delete n.steps;
    } else {
      n.t = 'analog';
      if (!(n.steps >= 2)) Object.assign(n, { min: n.min ?? 0, max: n.max ?? 1 });
    }
  }
  return changed;
}
/** Signal kind of a node's port: 'a' audio, 'n' analog, 'b' binary (null when there is no such port). */
export function portSig(n, key, out) {
  const pt = n && PARTS[n.t];
  if (!pt) return null;
  if (out) {
    if (pt.aout.some((x) => x[0] === key)) return 'a';
    const c = pt.cout.find((x) => x[0] === key);
    return c ? c[2] || 'n' : null;
  }
  if (key.startsWith('@')) {
    const p = pt.params.find((q) => q.key === key.slice(1));
    return p ? paramSig(p) : null;
  }
  return pt.ain.some((x) => x[0] === key) ? 'a' : null;
}
export const val = (n, p) => (n.p && n.p[p.key] != null ? n.p[p.key] : p.def);
// a port is {n: node id, p: key}; parameter inputs use '@' + param key
export function portsOf(n) {
  const pt = PARTS[n.t] || { ain: [], aout: [], cout: [], params: [] };
  return {
    ins: [...pt.ain.map(([k, l]) => ({ k, l, kind: 'a', sig: 'a' })), ...pt.params.map((p) => ({ k: '@' + p.key, l: p.label, kind: 'c', sig: paramSig(p), param: p }))],
    outs: [...pt.aout.map(([k, l]) => ({ k, l, kind: 'a', sig: 'a' })), ...pt.cout.map(([k, l, sg]) => ({ k, l, kind: 'c', sig: sg || 'n' }))],
  };
}
export function portKind(n, key, out) {
  if (!n) return null;
  const pt = PARTS[n.t];
  if (!pt) return null;
  if (out) return pt.aout.some((x) => x[0] === key) ? 'a' : pt.cout.some((x) => x[0] === key) ? 'c' : null;
  if (key.startsWith('@')) return pt.params.some((p) => p.key === key.slice(1)) ? 'c' : null;
  return pt.ain.some((x) => x[0] === key) ? 'a' : null;
}
/** Can output port a feed input port b? */
export function canWire(G, a, b) {
  if (!a || !b || a.n === b.n) return false;
  const na = G.nodes.find((x) => x.id === a.n), nb = G.nodes.find((x) => x.id === b.n);
  const ka = portKind(na, a.p, true), kb = portKind(nb, b.p, false);
  if (!ka || !kb || ka !== kb) return false;
  return !G.wires.some((w) => w.a.n === a.n && w.a.p === a.p && w.b.n === b.n && w.b.p === b.p);
}
export const ioNodes = (G, io) => G.nodes.filter((n) => PARTS[n.t]?.io === io);
export const emptyGraph = () => {
  const i = newNode('in', 40, 120), o = newNode('out', 520, 120);
  return { nodes: [i, o], wires: [] };
};

// ------------------------------------------------------------------ checks
/** Problems with a circuit: [{level: 'error' | 'warn', msg, node?, wire?}] */
export function validate(G) {
  const out = [];
  const by = new Map(G.nodes.map((n) => [n.id, n]));
  const ins = ioNodes(G, 'in'), outs = ioNodes(G, 'out');
  if (!ins.length) out.push({ level: 'error', msg: 'No audio input: add an Audio in part.' });
  if (!outs.length) out.push({ level: 'error', msg: 'No audio output: add an Audio out part.' });
  for (const w of G.wires) if (!by.has(w.a.n) || !by.has(w.b.n)) out.push({ level: 'error', msg: 'A wire goes nowhere.', wire: w.id });
  const audioIn = new Map();
  for (const w of G.wires) if (portKind(by.get(w.b.n), w.b.p, false) === 'a') audioIn.set(w.b.n, (audioIn.get(w.b.n) || 0) + 1);
  for (const o of outs) if (!audioIn.get(o.id)) out.push({ level: 'error', msg: `"${o.name || 'OUT'}" gets no audio.`, node: o.id });
  for (const n of G.nodes) {
    const pt = PARTS[n.t];
    if (!pt) {
      out.push({ level: 'error', msg: 'Unknown part ' + n.t, node: n.id });
      continue;
    }
    if (!pt.io && pt.ain.length && n.t !== 'mixer' && n.t !== 'xfade' && n.t !== 'switch' && !audioIn.get(n.id)) out.push({ level: 'warn', msg: `${pt.name} has nothing plugged into its input.`, node: n.id });
  }
  // audio loops have to go through a feedback part
  const adj = new Map();
  for (const w of G.wires) {
    if (portKind(by.get(w.a.n), w.a.p, true) !== 'a') continue;
    if (by.get(w.b.n)?.t === 'fb') continue;
    if (!adj.has(w.a.n)) adj.set(w.a.n, []);
    adj.get(w.a.n).push(w);
  }
  const state = new Map();
  const loopWires = new Set();
  const visit = (id) => {
    state.set(id, 1);
    for (const w of adj.get(id) || []) {
      const s = state.get(w.b.n);
      if (s === 1) loopWires.add(w.id);
      else if (!s) visit(w.b.n);
    }
    state.set(id, 2);
  };
  for (const n of G.nodes) if (!state.get(n.id)) visit(n.id);
  if (loopWires.size) out.push({ level: 'error', msg: 'Audio goes round in a loop. Put a Feedback loop part in it.', wires: [...loopWires], wire: [...loopWires][0] });
  // parts that never reach an output
  const reach = new Set();
  const radj = new Map();
  for (const w of G.wires) {
    if (!radj.has(w.b.n)) radj.set(w.b.n, []);
    radj.get(w.b.n).push(w.a.n);
  }
  const stack = [...outs, ...ioNodes(G, 'cout')].map((o) => o.id);
  while (stack.length) {
    const id = stack.pop();
    if (reach.has(id)) continue;
    reach.add(id);
    for (const s of radj.get(id) || []) stack.push(s);
  }
  for (const n of G.nodes) if (!PARTS[n.t]?.io && PARTS[n.t] && !reach.has(n.id)) out.push({ level: 'warn', msg: `${PARTS[n.t].name} does not reach an output.`, node: n.id });
  for (const [io, what] of [['ctl', 'inputs'], ['cout', 'outputs']]) {
    const names = new Map();
    for (const k of ioNodes(G, io)) {
      const nm = (k.name || '').trim().toLowerCase();
      if (!nm) out.push({ level: 'warn', msg: `A control ${what.slice(0, -1)} has no name.`, node: k.id });
      else if (names.has(nm)) out.push({ level: 'warn', msg: `Two control ${what} are called "${k.name}".`, node: k.id });
      names.set(nm, 1);
    }
  }
  for (const o of ioNodes(G, 'cout')) if (!G.wires.some((w) => w.b.n === o.id)) out.push({ level: 'warn', msg: `"${o.name || 'Output'}" has nothing wired to it.`, node: o.id });
  return out;
}

// ------------------------------------------------------------------ summaries
/** Category of a circuit from the parts in it (for the list filter). */
export function graphCat(G) {
  const cats = new Set();
  for (const n of G.nodes) {
    const st = STAGES[n.t];
    if (st) cats.add({ drive: 'Drive', dyn: 'Dynamics', eq: 'Filter', mod: 'Modulation', time: st.algo === 'reverb' || st.algo === 'freeze' ? 'Reverb' : 'Delay', pitch: 'Pitch', util: 'Utility' }[st.cat]);
    else if (n.t === 'filter') cats.add('Filter');
    else if (n.t === 'shaper') cats.add('Drive');
  }
  cats.delete(undefined);
  return cats.size === 1 ? [...cats][0] : cats.size ? 'Multi-FX' : 'Utility';
}
export const graphCost = (G) => 0.1 + G.nodes.reduce((a, n) => a + (STAGES[n.t]?.cost ?? (PARTS[n.t]?.native ? 0.03 : 0)), 0);
export const graphNames = (G) => G.nodes.filter((n) => STAGES[n.t]).map((n) => STAGES[n.t].name);
export const hasTap = (G) => G.nodes.some((n) => PARTS[n.t]?.tap);
