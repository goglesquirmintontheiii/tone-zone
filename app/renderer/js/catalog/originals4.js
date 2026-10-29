// Tone Zone originals, v0.4.0: four multi-effects units that are not inspired by any product.
//   tz.atlas      Atlas Floor     flagship floor modeler: 2 paths × 6 slots, model browser, scenes, presets, looper,
//                                 tuner, global settings, 12 footswitches with scribble strips, 2 expression treadles
//   tz.aurora     Aurora Desk     desktop + stomp ambient / modulation / pitch engine, A/B snapshot morphing
//   tz.pixelquest Pixel Quest     game-console synth / meme multi-FX (characters = synth voices, levels = FX chains)
//   tz.foundry    Low Foundry     bass multi-FX with analog VU meter + 14-segment display
// This file holds the definitions and the *pure* logic (state → engine params / chain layout) so `derive` can run
// anywhere. Interaction (screens, buttons, footswitches, menus) lives in ../screens-tz5.js, enclosures in
// ../gfx/forms-tz5.js. Persistent unit state is a JSON string in the UI param `_st` (never sent to the engine);
// footswitches / buttons toggle `_…` press params that screens-tz5.js turns into actions.
import { K, BTN, FOOT, LED, SCREEN, TREADLE, db } from './helpers.js';
import { TZ } from './builders.js';

// ------------------------------------------------------------------ small helpers
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pcache = new Map();
// parse a JSON state param (cached by string; callers must clone before mutating)
export function parseSt(str, dflt) {
  if (typeof str !== 'string' || !str) return dflt();
  let o = pcache.get(str);
  if (!o) {
    try { o = JSON.parse(str); } catch { o = dflt(); }
    if (pcache.size > 80) pcache.clear();
    pcache.set(str, o);
  }
  return o;
}
export const clone = (o) => JSON.parse(JSON.stringify(o));
// press params: a footswitch / button whose only job is to tell screens-tz5.js "I was pressed"
const PF = (name, o = {}) => FOOT(Object.assign({ action: 'toggle', p: '_p.' + name, def: 0, virtual: true, style: 'soft', label: '' }, o));
const PB = (name, label, o = {}) => BTN(label, Object.assign({ p: '_p.' + name, toggle: true, virtual: true, shape: 'rect', w: 18, h: 9 }, o));

// value formatting
export const F = {
  pct: (v) => Math.round(v * 100) + '%',
  ten: (v) => (v * 10).toFixed(1),
  db: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + 'dB',
  ms: (v) => (v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms'),
  hz: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) + 'Hz'),
  st: (v) => (v > 0 ? '+' : '') + Math.round(v) + 'st',
  int: (v) => String(Math.round(v)),
  onoff: (v) => (v > 0.5 ? 'ON' : 'OFF'),
};
// parameter spec: engine param, label, range, default, format, log curve, step
const P = (p, l, min, max, def, fmt = 'pct', o = {}) => Object.assign({ p, l, min, max, def, fmt }, o);
const P01 = (p, l, def = 0.5, o = {}) => P(p, l, 0, 1, def, 'pct', o);
// knob position (0..1) <-> engine value
export function specTo(s, pos) {
  let v = s.log ? s.min * Math.pow(s.max / s.min, pos) : s.min + (s.max - s.min) * pos;
  if (s.step) v = Math.round(v / s.step) * s.step;
  return clamp(v, Math.min(s.min, s.max), Math.max(s.min, s.max));
}
export function specPos(s, v) {
  if (s.log) return clamp(Math.log(v / s.min) / Math.log(s.max / s.min), 0, 1);
  return clamp((v - s.min) / (s.max - s.min || 1), 0, 1);
}
export const specFmt = (s, v) => (s.names ? s.names[clamp(Math.round(v), 0, s.names.length - 1)] : (F[s.fmt] || F.pct)(v));

// ================================================================== ATLAS: model library
export const ATLAS_CATS = [
  { id: 'drv', name: 'DRIVE', short: 'DRIVE', color: '#ff8a3d' },
  { id: 'amp', name: 'AMP', short: 'AMP', color: '#ff4b4b' },
  { id: 'cab', name: 'CAB', short: 'CAB', color: '#d9b77a' },
  { id: 'dyn', name: 'DYNAMICS', short: 'DYN', color: '#ffd23f' },
  { id: 'eq', name: 'EQ', short: 'EQ', color: '#c4ccda' },
  { id: 'mod', name: 'MODULATION', short: 'MOD', color: '#3fb6ff' },
  { id: 'flt', name: 'FILTER', short: 'FILTER', color: '#ff5fb0' },
  { id: 'pit', name: 'PITCH', short: 'PITCH', color: '#45e0c8' },
  { id: 'dly', name: 'DELAY', short: 'DELAY', color: '#46d36f' },
  { id: 'rev', name: 'REVERB', short: 'REVERB', color: '#a98bff' },
];
export const CAT_BY_ID = Object.fromEntries(ATLAS_CATS.map((c) => [c.id, c]));

// shared lane options per algorithm (identical opts = switching models inside a family needs no rebuild)
const DRIVE_MODES = [
  { clip: 'clean', tone: 'tilt', gainMinDb: 0, gainMaxDb: 22, levelMaxDb: 10, eqRangeDb: 8 },
  { clip: 'ge', bias: 0.1, preHp: 650, tone: 'lp', toneLo: 2500, toneHi: 12000, gainMinDb: 4, gainMaxDb: 30, levelMaxDb: 10 },
  { clip: 'ts', cleanSum: true, clipHp: 720, tone: 'ts', gainMinDb: 6, gainMaxDb: 40, levelMaxDb: 10 },
  { clip: 'diode', cleanSum: true, cleanMix: 0.55, clipHp: 420, tone: 'tilt', trebleF: 1600, eqRangeDb: 9, gainMinDb: 2, gainMaxDb: 36, levelMaxDb: 10 },
  { clip: 'asym', bias: 0.2, tone: 'tilt', gainMinDb: 4, gainMaxDb: 38, postLp: 7500, levelMaxDb: 10 },
  { clip: 'opamp', slew: 0.4, tone: 'rat', gainMinDb: 10, gainMaxDb: 52, levelMaxDb: 6, outTrim: 0.8 },
  { clip: 'diode', tone: 'blend', blendLp: 600, blendHp: 1500, gainMinDb: 10, gainMaxDb: 46, levelMaxDb: 6, outTrim: 0.8 },
  { clip: 'muff', stages: 2, stage2Db: 16, preHp: 80, tone: 'blend', blendLp: 450, blendHp: 1100, gainMinDb: 20, gainMaxDb: 52, levelMaxDb: 4, outTrim: 0.7 },
  { clip: 'ge', bias: 0.32, tone: 'none', postLp: 6500, gainMinDb: 14, gainMaxDb: 44, levelMaxDb: 4, outTrim: 0.75 },
  { clip: 'si', stages: 2, stage2Db: 12, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, gainMinDb: 14, gainMaxDb: 54, levelMaxDb: 4, outTrim: 0.7 },
  { clip: 'jfet', tone: 'eq3', eqRangeDb: 12, gainMinDb: 4, gainMaxDb: 38, levelMaxDb: 8 },
  { clip: 'led', cleanSum: true, cleanMix: 0.4, tone: 'tilt', gainMinDb: 0, gainMaxDb: 30, levelMaxDb: 10 },
];
const LANE = {
  drive: { clip: 'ts', tone: 'tilt', modes: DRIVE_MODES },
  delay: { maxMs: 2500 },
  reverb: {},
  chorus: {},
  pitch: {},
  wah: {},
};
const drvKnobs = (extra = []) => [P01('gain', 'GAIN', 0.45), P01('tone', 'TONE'), P01('level', 'LEVEL', 0.62), P01('blend', 'MIX', 1), P01('bass', 'BASS'), P01('treble', 'TREBLE'), ...extra];
const D = (id, name, short, mode, def = {}) => ({ id: 'drv.' + id, cat: 'drv', name, short, algo: 'drive', opts: LANE.drive, set: { mode }, knobs: drvKnobs(), defs: def });
const AMPK = [P01('gain', 'GAIN', 0.5), P01('bass', 'BASS'), P01('mid', 'MID'), P01('treble', 'TREBLE'), P01('presence', 'PRES'), P01('master', 'MASTER', 0.5),
  P01('depth', 'DEPTH'), P01('sag', 'SAG'), P01('bright', 'BRIGHT', 0), P('level', 'CH VOL', -18, 12, 0, 'db', { step: 0.5 })];
const A = (id, name, short, model, def = {}) => ({ id: 'amp.' + id, cat: 'amp', name, short, algo: 'amp', opts: { model }, knobs: AMPK, defs: def });
const CABK = [P('m1type', 'MIC', 0, 7, 0, 'int', { step: 1, names: ['57 DYN', '414 COND', '121 RIBN', '421 DYN', '906 DYN', '441 DYN', '87 COND', '160 RIBN'] }), P('m1pos', 'POSITION', 0, 1.3, 0.3, 'pct'),
  P('m1dist', 'DISTANCE', 0, 1, 0.15, 'pct'), P('lowcut', 'LOW CUT', 20, 500, 70, 'hz', { log: true }), P('highcut', 'HIGH CUT', 2000, 20000, 9000, 'hz', { log: true }), P('level', 'LEVEL', -24, 12, 0, 'db', { step: 0.5 })];
const C = (id, name, short, model) => ({ id: 'cab.' + id, cat: 'cab', name, short, algo: 'cab', opts: { model }, knobs: CABK });
const DLYK = [P('time', 'TIME', 40, 2500, 420, 'ms', { log: true }), P01('feedback', 'FEEDBACK', 0.32), P01('mix', 'MIX', 0.25), P01('tone', 'TONE', 0.6), P01('moddepth', 'MOD DEPTH', 0.15), P01('modrate', 'MOD RATE', 0.3),
  P01('age', 'AGE', 0.3), P01('sat', 'SATURATE', 0.3), P01('spread', 'SPREAD', 0.5), P01('lowcut', 'LOW CUT', 0), P('subdiv', 'SUBDIV', 0, 4, 0, 'int', { step: 1, names: ['1/4', '1/8.', '1/8', '1/4T', '1/16'] })];
const DL = (id, name, short, mode, def = {}) => ({ id: 'dly.' + id, cat: 'dly', name, short, algo: 'delay', opts: LANE.delay, set: { mode }, knobs: DLYK, defs: def });
const REVK = [P01('decay', 'DECAY', 0.5), P01('mix', 'MIX', 0.25), P01('tone', 'TONE', 0.6), P('predelay', 'PREDELAY', 0, 250, 20, 'ms'), P01('mod', 'MOD', 0.3), P01('size', 'SIZE', 0.5),
  P01('shimmer', 'SHIMMER', 0.5), P01('lowcut', 'LOW CUT', 0.15), P01('diffusion', 'DIFFUSION', 0.7), P01('highdamp', 'HI DAMP', 0.5), P01('ensemble', 'ENSEMBLE', 0)];
const RV = (id, name, short, mode, def = {}) => ({ id: 'rev.' + id, cat: 'rev', name, short, algo: 'reverb', opts: LANE.reverb, set: { mode }, knobs: REVK, defs: def });
const CHOK = [P01('rate', 'RATE', 0.3), P01('depth', 'DEPTH', 0.5), P01('mix', 'MIX', 0.5), P01('tone', 'TONE', 0.5), P01('feedback', 'FEEDBACK', 0), P01('delay', 'PREDELAY', 0.5), P01('level', 'LEVEL', 0.5)];
const CH = (id, name, short, mode, def = {}) => ({ id: 'mod.' + id, cat: 'mod', name, short, algo: 'chorus', opts: LANE.chorus, set: { mode }, knobs: CHOK, defs: def });
const PITK = (dry = 1) => [P('semis1', 'SHIFT', -24, 24, -12, 'st', { step: 1 }), P01('level1', 'VOICE 1', 1), P('semis2', 'SHIFT 2', -24, 24, 12, 'st', { step: 1 }), P01('level2', 'VOICE 2', 0), P01('dry', 'DRY', dry), P01('tone', 'TONE', 1),
  P('cents', 'DETUNE', -50, 50, 0, 'int', { step: 1 }), P01('glide', 'GLIDE', 0.1)];

export const ATLAS_MODELS = [
  // drive (one lane, 12 voicings)
  D('boost', 'Clean Lift', 'LIFT', 0, { gain: 0.35, level: 0.55 }), D('treble', 'Treble Spike', 'TREBLE', 1, { gain: 0.4, level: 0.55 }), D('jade', 'Jade Screamer', 'JADE OD', 2, { gain: 0.4, level: 0.6 }),
  D('gilded', 'Gilded Horse', 'GILDED', 3, { gain: 0.35, level: 0.62 }), D('bluenote', 'Blue Note OD', 'BLUE OD', 4, { gain: 0.45, level: 0.6 }), D('rodent', 'Rodent Dist', 'RODENT', 5, { gain: 0.45, level: 0.6 }),
  D('ember', 'Ember Box DS', 'EMBER', 6, { gain: 0.5, level: 0.6 }), D('fluff', 'Big Fluff', 'FLUFF', 7, { gain: 0.6, level: 0.6 }), D('round', 'Round Fuzz', 'ROUND FZ', 8, { gain: 0.6, level: 0.65 }),
  D('grid', 'Metal Grid', 'GRID', 9, { gain: 0.55, level: 0.62 }), D('velvet', 'Velvet FET', 'VELVET', 10, { gain: 0.45, level: 0.6 }), D('glass', 'Glass LED', 'GLASS', 11, { gain: 0.35, level: 0.58 }),
  // amps
  A('lux', 'Tweed Lux', 'LUX', 'deluxe', { gain: 0.45 }), A('silver', 'Silver Twin', 'SILVER', 'twin', { gain: 0.35 }), A('tweedbass', 'Tweed Bass 4x10', 'TWD BASS', 'bassman', { gain: 0.45 }),
  A('chime', 'Chime 30', 'CHIME 30', 'ac30', { gain: 0.45 }), A('brit68', 'Brit 68 Plexi', 'BRIT 68', 'plexi', { gain: 0.55 }), A('brit800', 'Brit 800', 'BRIT 800', 'jcm800', { gain: 0.55 }),
  A('britsilver', 'Brit Silver Jub', 'SILV JUB', 'jubilee', { gain: 0.55 }), A('texas', 'Texas Special', 'TX SPEC', 'dumble', { gain: 0.45 }), A('citrus', 'Citrus 120', 'CITRUS', 'orange', { gain: 0.5 }),
  A('calidual', 'Cali Dual Rect', 'CALI DR', 'recto', { gain: 0.55, bass: 0.55, mid: 0.4 }), A('calilead', 'Cali Lead IIC', 'CALI IIC', 'markiic', { gain: 0.55 }), A('panama', 'Panama 51', 'PANAMA', '5150', { gain: 0.5 }),
  A('brownbe', 'Brown BE', 'BROWN BE', 'friedman', { gain: 0.55 }), A('sldrive', 'SL Drive 100', 'SL DRIVE', 'slo', { gain: 0.55 }), A('hipower', 'Hi-Power 100', 'HI-POWER', 'hiwatt', { gain: 0.45 }),
  A('solid120', 'Solid 120 Clean', 'SOLID120', 'jc120', { gain: 0.4 }),
  // cabs
  C('112us', '1x12 US Open', '1x12 US', '1x12us'), C('212twin', '2x12 Silver', '2x12 SLV', '2x12twin'), C('410tweed', '4x10 Tweed', '4x10 TWD', '4x10tweed'), C('212blue', '2x12 Blue Alnico', '2x12 BLU', '2x12blue'),
  C('412gb', '4x12 Greenback', '4x12 GB', '4x12gb'), C('412v30', '4x12 V30', '4x12 V30', '4x12v30'), C('412t75', '4x12 T75', '4x12 T75', '4x12t75'), C('412uber', '4x12 Uber', '4x12 UBR', '4x12uber'),
  C('212cream', '2x12 Cream', '2x12 CRM', '2x12cream'), C('412citrus', '4x12 Citrus', '4x12 CIT', '4x12orange'), C('212jc', '2x12 Solid', '2x12 SLD', '2x12jc'),
  // dynamics
  { id: 'dyn.vca', cat: 'dyn', name: 'Studio VCA Comp', short: 'VCA COMP', algo: 'comp', opts: { type: 'vca' }, knobs: [P01('sustain', 'THRESH', 0.45), P01('ratio', 'RATIO', 0.5), P01('attack', 'ATTACK', 0.3), P01('release', 'RELEASE', 0.4), P01('level', 'LEVEL', 0.5), P01('blend', 'MIX', 1), P01('knee', 'KNEE', 0.5)] },
  { id: 'dyn.squeeze', cat: 'dyn', name: 'Orange Squeeze', short: 'SQUEEZE', algo: 'comp', opts: { type: 'ota' }, knobs: [P01('sustain', 'SUSTAIN', 0.5), P01('level', 'LEVEL', 0.5), P01('attack', 'ATTACK', 0.3), P01('tone', 'TONE', 0.5), P01('blend', 'MIX', 1)] },
  { id: 'dyn.opto', cat: 'dyn', name: 'Opto Leveler', short: 'OPTO', algo: 'comp', opts: { type: 'opto' }, knobs: [P01('sustain', 'PEAK RED', 0.45), P01('level', 'GAIN', 0.5), P01('release', 'RELEASE', 0.4), P01('blend', 'MIX', 1)] },
  { id: 'dyn.gate', cat: 'dyn', name: 'Noise Gate', short: 'GATE', algo: 'gate', opts: {}, knobs: [P01('threshold', 'THRESH', 0.3), P01('decay', 'DECAY', 0.4), P01('attack', 'ATTACK', 0.1), P01('range', 'RANGE', 1)] },
  // eq
  { id: 'eq.para', cat: 'eq', name: 'Parametric 3', short: 'PARA EQ', algo: 'peq', opts: {}, knobs: [P('lowgain', 'LOW', -18, 18, 0, 'db', { step: 0.5 }), P('mid1freq', 'MID FREQ', 100, 4000, 600, 'hz', { log: true }), P('mid1gain', 'MID', -18, 18, 0, 'db', { step: 0.5 }), P('highgain', 'HIGH', -18, 18, 0, 'db', { step: 0.5 }), P('lowcut', 'LOW CUT', 20, 1000, 20, 'hz', { log: true }), P('highcut', 'HIGH CUT', 1000, 20000, 20000, 'hz', { log: true }),
    P('mid1q', 'MID Q', 0.2, 8, 1, 'int', { log: true, fmt: 'q' }), P('lowfreq', 'LOW FREQ', 30, 500, 100, 'hz', { log: true }), P('highfreq', 'HI FREQ', 1000, 16000, 5000, 'hz', { log: true }), P('level', 'LEVEL', -18, 18, 0, 'db', { step: 0.5 })] },
  { id: 'eq.graphic', cat: 'eq', name: 'Graphic 7', short: 'GEQ 7', algo: 'geq', opts: { freqs: [100, 200, 400, 800, 1600, 3200, 6400] },
    knobs: ['100', '200', '400', '800', '1.6k', '3.2k', '6.4k'].map((l, i) => P('b' + i, l, -15, 15, 0, 'db', { step: 0.5 })).concat([P('level', 'LEVEL', -15, 15, 0, 'db', { step: 0.5 })]) },
  // modulation
  CH('chorus', 'Classic Chorus', 'CHORUS', 0), CH('vibrato', 'Pitch Vibrato', 'VIBRATO', 1, { mix: 1, depth: 0.4 }), CH('ensemble', 'Tri Ensemble', 'ENSEMBLE', 2, { rate: 0.25 }), CH('dimension', 'Dimension', 'DIMENS', 3),
  { id: 'mod.flanger', cat: 'mod', name: 'Jet Flanger', short: 'FLANGER', algo: 'flanger', opts: {}, knobs: [P01('speed', 'SPEED', 0.3), P01('width', 'WIDTH', 0.6), P01('regen', 'REGEN', 0.6), P01('manual', 'MANUAL', 0.5), P01('mix', 'MIX', 0.5), P('mode', 'MODE', 0, 3, 0, 'int', { step: 1, names: ['STD', 'ULTRA', 'GATE', 'TZF'] })] },
  { id: 'mod.phaser', cat: 'mod', name: 'Script Phase', short: 'PHASER', algo: 'phaser', opts: { stages: 4 }, knobs: [P01('rate', 'RATE', 0.35), P01('depth', 'DEPTH', 0.8), P01('feedback', 'FEEDBACK', 0.35), P01('mix', 'MIX', 0.5), P01('center', 'CENTER', 0.5), P('stages', 'STAGES', 2, 12, 4, 'int', { step: 2 })] },
  { id: 'mod.trem', cat: 'mod', name: 'Opto Tremolo', short: 'TREMOLO', algo: 'tremolo', opts: {}, set: { mode: 0 }, knobs: [P01('rate', 'SPEED', 0.4), P01('depth', 'DEPTH', 0.6), P01('wave', 'SHAPE', 0.3), P01('level', 'LEVEL', 0.5), P01('stereo', 'PAN', 0)] },
  { id: 'mod.harmtrem', cat: 'mod', name: 'Harmonic Trem', short: 'HARM TRM', algo: 'tremolo', opts: {}, set: { mode: 1 }, knobs: [P01('rate', 'SPEED', 0.4), P01('depth', 'DEPTH', 0.6), P01('wave', 'SHAPE', 0.3), P01('level', 'LEVEL', 0.5)] },
  { id: 'mod.vibe', cat: 'mod', name: 'Photo Vibe', short: 'VIBE', algo: 'vibe', opts: {}, knobs: [P01('speed', 'SPEED', 0.35), P01('intensity', 'INTENSITY', 0.7), P('mode', 'MODE', 0, 1, 0, 'int', { step: 1, names: ['CHORUS', 'VIBRATO'] }), P01('tone', 'TONE', 0.6), P01('drive', 'DRIVE', 0.2), P01('level', 'LEVEL', 0.5)] },
  { id: 'mod.rotary', cat: 'mod', name: 'Rotor 122', short: 'ROTARY', algo: 'rotary', opts: {}, knobs: [P01('speed', 'FAST', 0), P01('drive', 'DRIVE', 0.2), P01('balance', 'HORN/DRUM', 0.5), P01('accel', 'ACCEL', 0.5), P01('mix', 'MIX', 1), P01('level', 'LEVEL', 0.5)] },
  // filter
  { id: 'flt.autowah', cat: 'flt', name: 'Envelope Wah', short: 'ENV WAH', algo: 'wah', opts: LANE.wah, set: { mode: 2 }, knobs: [P01('sens', 'SENS', 0.55), P01('q', 'Q', 0.6), P01('range', 'RANGE', 0.6), P('filter', 'FILTER', 0, 2, 1, 'int', { step: 1, names: ['LP', 'BP', 'HP'] }), P01('direction', 'DIRECTION', 0), P01('level', 'LEVEL', 0.5)] },
  { id: 'flt.lfo', cat: 'flt', name: 'LFO Filter', short: 'LFO FLT', algo: 'wah', opts: LANE.wah, set: { mode: 1 }, knobs: [P01('rate', 'RATE', 0.4), P01('q', 'Q', 0.6), P01('range', 'RANGE', 0.6), P('filter', 'FILTER', 0, 2, 0, 'int', { step: 1, names: ['LP', 'BP', 'HP'] }), P01('level', 'LEVEL', 0.5)] },
  { id: 'flt.ring', cat: 'flt', name: 'Ring Modulator', short: 'RING MOD', algo: 'ringmod', opts: {}, knobs: [P01('freq', 'FREQ', 0.4), P01('mix', 'MIX', 0.5), P01('fine', 'FINE', 0.5)] },
  { id: 'flt.crush', cat: 'flt', name: 'Bit Crusher', short: 'CRUSHER', algo: 'crusher', opts: {}, knobs: [P01('bits', 'BITS', 0.5), P01('rate', 'RATE', 0.3), P01('mix', 'MIX', 0.7)] },
  { id: 'flt.slicer', cat: 'flt', name: 'Step Slicer', short: 'SLICER', algo: 'slicer', opts: {}, knobs: [P('time', 'STEP', 30, 1000, 125, 'ms', { log: true }), P('pattern', 'PATTERN', 0, 15, 1, 'int', { step: 1 }), P01('depth', 'DEPTH', 1), P01('smooth', 'SMOOTH', 0.2), P01('mix', 'MIX', 1)] },
  // pitch
  { id: 'pit.octdown', cat: 'pit', name: 'Sub Octave', short: 'OCT DN', algo: 'pitch', opts: LANE.pitch, set: { scale: 0, level3: 0, quality: 1 }, knobs: PITK(1), defs: { semis1: -12, level1: 0.8, semis2: -24, level2: 0 } },
  { id: 'pit.octup', cat: 'pit', name: 'Octave Up', short: 'OCT UP', algo: 'pitch', opts: LANE.pitch, set: { scale: 0, level3: 0, quality: 1 }, knobs: PITK(1), defs: { semis1: 12, level1: 0.6, semis2: 24, level2: 0 } },
  { id: 'pit.wham', cat: 'pit', name: 'Wham Shift', short: 'WHAM', algo: 'pitch', opts: LANE.pitch, set: { scale: 0, level2: 0, level3: 0, quality: 0 }, knobs: [P('semis1', 'SHIFT', -24, 24, 12, 'st', { step: 1 }), P01('level1', 'LEVEL', 1), P01('dry', 'DRY', 0), P01('glide', 'GLIDE', 0.1), P01('tone', 'TONE', 1)] },
  { id: 'pit.drop', cat: 'pit', name: 'Drop Tune', short: 'DROP', algo: 'pitch', opts: LANE.pitch, set: { scale: 0, level2: 0, level3: 0, quality: 1, dry: 0 }, knobs: [P('semis1', 'TUNE', -12, 0, -2, 'st', { step: 1 }), P01('level1', 'LEVEL', 1), P('cents', 'CENTS', -50, 50, 0, 'int', { step: 1 })] },
  { id: 'pit.harmony', cat: 'pit', name: 'Smart Harmony', short: 'HARMONY', algo: 'pitch', opts: LANE.pitch, set: { level3: 0, quality: 1 },
    knobs: [P('key', 'KEY', 0, 11, 4, 'int', { step: 1, names: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] }), P('scale', 'SCALE', 1, 2, 1, 'int', { step: 1, names: ['MAJOR', 'MAJOR', 'MINOR'] }), P('deg1', 'VOICE 1', -7, 7, 2, 'int', { step: 1 }), P01('level1', 'LEVEL 1', 0.6), P('deg2', 'VOICE 2', -7, 7, 4, 'int', { step: 1 }), P01('level2', 'LEVEL 2', 0), P01('dry', 'DRY', 1)] },
  // delays (one lane, 11 modes)
  DL('digital', 'Clean Digital', 'DIGITAL', 0), DL('analog', 'Bucket Analog', 'ANALOG', 1, { tone: 0.45 }), DL('tape', 'Tape Echo', 'TAPE', 2, { feedback: 0.35 }), DL('lofi', 'Lo-Fi Echo', 'LO-FI', 3),
  DL('modulated', 'Mod Echo', 'MOD DLY', 4, { moddepth: 0.4 }), DL('reverse', 'Reverse', 'REVERSE', 5, { mix: 0.35, time: 600 }), DL('shimmer', 'Shimmer Echo', 'SHIM DLY', 6, { mix: 0.3, feedback: 0.45, time: 520 }),
  DL('pingpong', 'Ping Pong', 'PINGPONG', 7), DL('dual', 'Dual Tap', 'DUAL', 8), DL('warp', 'Warp Echo', 'WARP', 9, { feedback: 0.6 }), DL('echoverb', 'Echo Verb', 'ECHOVERB', 10),
  // reverbs (one lane, 10 modes)
  RV('room', 'Small Room', 'ROOM', 0, { decay: 0.35, mix: 0.2 }), RV('hall', 'Concert Hall', 'HALL', 1), RV('plate', 'Bright Plate', 'PLATE', 2), RV('spring', 'Spring Tank', 'SPRING', 3, { mix: 0.3 }),
  RV('shimmer', 'Shimmer', 'SHIMMER', 4, { decay: 0.75, mix: 0.3 }), RV('cloud', 'Cloud', 'CLOUD', 5, { decay: 0.8, mix: 0.3 }), RV('modverb', 'Mod Verb', 'MODVERB', 6, { mod: 0.5 }),
  RV('ducking', 'Ducking Verb', 'DUCKING', 7, { mix: 0.35 }), RV('verbdelay', 'Verb + Delay', 'VRB+DLY', 8), RV('swell', 'Swell Verb', 'SWELL', 9, { mix: 0.35 }),
];
export const MODEL_BY_ID = Object.fromEntries(ATLAS_MODELS.map((m) => [m.id, m]));
export const MODELS_IN = Object.fromEntries(ATLAS_CATS.map((c) => [c.id, ATLAS_MODELS.filter((m) => m.cat === c.id)]));
F.q = (v) => v.toFixed(2);

export function modelDefaults(m) {
  return m.knobs.map((s) => (m.defs && m.defs[s.p] !== undefined ? m.defs[s.p] : s.def));
}
export const SLOTS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
const slot = (m, on = 1, over = {}) => {
  const md = MODEL_BY_ID[m];
  return { m, on, v: md.knobs.map((s, i) => (over[s.p] !== undefined ? over[s.p] : modelDefaults(md)[i])) };
};
const SCENE_NAMES = ['RHYTHM', 'LEAD', 'CLEAN', 'AMBIENT', 'CRUNCH', 'SOLO', 'VERSE', 'CHORUS'];
const SCENE_COLS = ['#ff8a3d', '#ff4b4b', '#3fb6ff', '#a98bff', '#ffd23f', '#46d36f', '#45e0c8', '#ff5fb0'];
export { SCENE_NAMES, SCENE_COLS };

// a factory patch = name + slots + scene overrides { sceneIdx: { slot: {on, v: {param: value}} } }
function patch(name, slots, scenes = {}, o = {}) {
  return Object.assign({ name, slots, scenes, sc: 0 }, o);
}
export const ATLAS_FACTORY = [
  patch('BRIT CRUNCH', { A1: slot('drv.jade', 0), A2: slot('amp.brit68', 1, { gain: 0.5 }), A3: slot('cab.412gb'), A4: slot('mod.chorus', 0, { mix: 0.35 }), A5: slot('dly.analog', 1, { mix: 0.18 }), A6: slot('rev.plate', 1, { mix: 0.18 }) },
    { 1: { A1: { on: 1 }, A5: { v: { mix: 0.3 } } }, 2: { A2: { v: { gain: 0.25 } }, A4: { on: 1 } }, 3: { A5: { v: { mix: 0.4, feedback: 0.55 } }, A6: { v: { mix: 0.45, decay: 0.75 } }, A4: { on: 1 } } }),
  patch('GLASS CLEAN', { A1: slot('dyn.squeeze'), A2: slot('amp.silver', 1, { gain: 0.3 }), A3: slot('cab.212twin'), A4: slot('mod.vibe', 0), A5: slot('dly.tape', 1, { mix: 0.2 }), A6: slot('rev.spring', 1, { mix: 0.28 }) },
    { 1: { A4: { on: 1 } }, 3: { A5: { v: { mix: 0.35, feedback: 0.5 } }, A6: { v: { mix: 0.45 } } } }),
  patch('CALI LEAD', { A1: slot('dyn.gate', 1, { threshold: 0.25 }), A2: slot('drv.jade', 1, { gain: 0.2, level: 0.7 }), A3: slot('amp.calidual', 1, { level: -3 }), A4: slot('cab.412v30'), A5: slot('dly.digital', 1, { mix: 0.2, time: 380 }), A6: slot('rev.hall', 1, { mix: 0.15 }) },
    { 1: { A5: { v: { mix: 0.3 } } } }),
  patch('DUAL AMP WALL', { A1: slot('amp.chime'), A2: slot('cab.212blue'), A3: slot('dly.pingpong', 1, { mix: 0.2 }), B1: slot('amp.brit800'), B2: slot('cab.412t75'), B3: slot('mod.chorus', 0), A6: slot('rev.room', 1) }),
  patch('AMBIENT SWELL', { A1: slot('drv.velvet', 0), A2: slot('amp.lux', 1, { gain: 0.35 }), A3: slot('cab.112us'), A4: slot('mod.ensemble'), A5: slot('dly.modulated', 1, { mix: 0.35, feedback: 0.5, time: 520 }), A6: slot('rev.shimmer', 1, { mix: 0.35 }) }),
  patch('FUZZ CAVE', { A1: slot('drv.fluff'), A2: slot('amp.citrus', 1, { gain: 0.4, level: -5 }), A3: slot('cab.412citrus'), A4: slot('mod.phaser', 0), A5: slot('dly.tape', 1, { mix: 0.22 }), A6: slot('rev.room', 1) }),
  patch('TEXAS BLUES', { A1: slot('drv.bluenote'), A2: slot('amp.texas', 1, { level: -5 }), A3: slot('cab.212cream'), A4: slot('mod.trem', 0), A5: slot('dly.analog', 1, { mix: 0.15 }), A6: slot('rev.spring', 1, { mix: 0.2 }) }),
  patch('PANAMA CHUG', { A1: slot('dyn.gate', 1, { threshold: 0.3 }), A2: slot('drv.jade', 1, { gain: 0.1, level: 0.75, tone: 0.6 }), A3: slot('amp.panama', 1, { level: -5 }), A4: slot('cab.412uber'), A5: slot('eq.para', 1, { mid1gain: 3, mid1freq: 800 }), A6: slot('rev.room', 1, { mix: 0.12 }) }),
  patch('OCTO RIPPLE', { A1: slot('pit.octdown'), A2: slot('drv.round'), A3: slot('amp.brit68', 1, { gain: 0.35, level: -2.5 }), A4: slot('cab.412gb'), A5: slot('mod.flanger', 1), A6: slot('rev.plate', 1) }),
  patch('HARMONY TWIN', { A1: slot('drv.gilded'), A2: slot('amp.brownbe', 1, { gain: 0.45, level: -4 }), A3: slot('cab.412v30'), A4: slot('pit.harmony', 1, { level1: 0.55 }), A5: slot('dly.dual', 1, { mix: 0.2 }), A6: slot('rev.hall', 1, { mix: 0.2 }) }),
  patch('ROTOR ORGAN', { A1: slot('dyn.vca'), A2: slot('amp.lux', 1, { gain: 0.5, level: -3.5 }), A3: slot('mod.rotary'), A4: slot('cab.112us'), A6: slot('rev.room', 1) }),
  patch('LOFI DREAMS', { A1: slot('flt.crush', 1, { mix: 0.4 }), A2: slot('amp.solid120'), A3: slot('cab.212jc'), A4: slot('mod.chorus', 1, { depth: 0.7 }), A5: slot('dly.lofi', 1, { mix: 0.3 }), A6: slot('rev.cloud', 1) }),
];
export const ATLAS_BANKS = ['A', 'B', 'C'];
export const ATLAS_MODES = ['STOMP', 'SCENE', 'PRESET', 'LOOPER'];
export const ATLAS_GLOBAL = {
  pad: 0, gate: 0, out: 0, bLvl: 1, route: 0, pan: 0, toe: 0, wahv: 0, volPos: 1, exp2: -1, bpm: 120, sync: 0, theme: 0, stripB: 1, dmode: 0, tapLed: 1, ref: 440,
};

// expand a factory patch into the live state (8 scenes with full on/value snapshots)
export function patchToLive(p) {
  const slots = clone(p.slots);
  const scenes = [];
  for (let i = 0; i < 8; i++) {
    const sc = { on: {}, v: {} };
    for (const k in slots) {
      const s = slots[k], over = p.scenes && p.scenes[i] && p.scenes[i][k];
      sc.on[k] = over && over.on !== undefined ? over.on : s.on;
      const md = MODEL_BY_ID[s.m];
      sc.v[k] = s.v.map((x, j) => (over && over.v && over.v[md.knobs[j].p] !== undefined ? over.v[md.knobs[j].p] : x));
    }
    scenes.push(sc);
  }
  // scene 0 is what is live
  for (const k in slots) { slots[k].on = scenes[0].on[k]; slots[k].v = scenes[0].v[k].slice(); }
  return { name: p.name, slots, scenes, sc: 0 };
}
export function atlasDefault() {
  return Object.assign(patchToLive(ATLAS_FACTORY[0]), { pi: 0, mode: 0, g: Object.assign({}, ATLAS_GLOBAL), ver: 1 });
}
export const atlasState = (ui) => parseSt(ui._st, atlasDefault);

// the dynamic chain: only the models actually loaded get a lane
export function atlasChain(st) {
  const g = st.g || ATLAS_GLOBAL;
  const path = (P) => {
    const subs = [];
    for (let i = 1; i <= 6; i++) {
      const s = st.slots[P + i];
      const m = s && MODEL_BY_ID[s.m];
      if (m) subs.push({ prefix: String(i), algo: m.algo, opts: m.opts });
    }
    return subs;
  };
  const a = path('A'), b = path('B');
  const par = b.length && a.length && !(g.route > 0.5);
  const chain = [
    { prefix: 'tu', algo: 'tuner', on: false },
    { prefix: 'pad', algo: 'utility', opts: { kind: 'gain' } },
    { prefix: 'in', algo: 'gate' },
    { prefix: 'wah', algo: 'wah', opts: { mode: 0 } },
    { prefix: 'pv', algo: 'volume' },
  ];
  if (a.length) chain.push({ prefix: 'A', algo: 'chain', opts: { chain: a }, group: par ? 1 : 0 });
  if (b.length) chain.push({ prefix: 'B', algo: 'chain', opts: { chain: b }, group: par ? 1 : 0 });
  chain.push({ prefix: 'vol', algo: 'volume' }, { prefix: 'out', algo: 'utility', opts: { kind: 'gain' } }, { prefix: 'lp', algo: 'looper', opts: { tracks: 1, maxSec: 60 } });
  return { chain };
}
export const atlasLooperArg = (st) => (atlasChain(st).chain.length - 1) * 100;
// every assignable parameter (for the EXP 2 target list)
export function atlasExpTargets(st) {
  const out = [];
  for (const k of SLOTS) {
    const s = st.slots[k];
    const m = s && MODEL_BY_ID[s.m];
    if (!m) continue;
    m.knobs.forEach((sp, i) => out.push({ s: k, i, name: `${k} ${m.short} ${sp.l}` }));
  }
  return out;
}

const TZW_VOICE = [{ q: 0.55, range: 0.5 }, { q: 0.75, range: 0.65 }, { q: 0.4, range: 0.35 }]; // wah voicings: classic / vocal / smooth
function atlasDerive(ui) {
  const st = atlasState(ui);
  const g = st.g || ATLAS_GLOBAL;
  const o = {};
  const e1 = ui.exp1 ?? 0.5, e2 = ui.exp2 ?? 0;
  const toe = (ui.toe ?? 0) > 0.5;
  const tuner = (ui._tuner ?? 0) > 0.5;
  o['tu.on'] = tuner ? 1 : 0;
  o['tu.calib'] = g.ref || 440;
  o['in.on'] = g.gate > 0.01 ? 1 : 0;
  o['in.threshold'] = g.gate;
  // toe switch: 0 = auto wah / volume, 1 = wah only, 2 = volume only
  const wahOn = g.toe === 1 ? toe : g.toe === 2 ? false : toe;
  const volOn = g.toe === 1 ? false : g.toe === 2 ? true : !toe;
  const wv = TZW_VOICE[g.wahv | 0] || TZW_VOICE[0];
  o['wah.on'] = wahOn ? 1 : 0;
  o['wah.pos'] = e1; o['wah.q'] = wv.q; o['wah.range'] = wv.range; o['wah.mode'] = 0;
  const pre = (g.volPos | 0) === 0;
  o['pv.on'] = volOn && pre ? 1 : 0; o['pv.pos'] = e1;
  o['vol.on'] = volOn && !pre ? 1 : 0; o['vol.pos'] = e1;
  o['pad.level'] = [0, -6, -12][g.pad | 0];
  o['out.level'] = (g.out || 0) - 4; // calibrated so the factory presets sit near unity
  const targets = g.exp2 >= 0 ? atlasExpTargets(st) : [];
  const tgt = targets[g.exp2 | 0];
  for (const k of SLOTS) {
    const s = st.slots[k];
    const m = s && MODEL_BY_ID[s.m];
    if (!m) continue;
    const pre2 = k[0] + '.' + k[1] + '.';
    o[pre2 + 'on'] = s.on ? 1 : 0;
    if (m.set) for (const p in m.set) o[pre2 + p] = m.set[p];
    m.knobs.forEach((sp, i) => {
      let v = s.v[i] ?? sp.def;
      if (tgt && tgt.s === k && tgt.i === i) v = specTo(sp, e2);
      // tempo sync: delay time follows the global BPM and the SUBDIV choice
      if (sp.p === 'time' && m.algo === 'delay' && g.sync) v = (60000 / (g.bpm || 120)) * [1, 0.75, 0.5, 2 / 3, 0.25][Math.round(s.v[10] ?? 0)];
      o[pre2 + sp.p] = v;
    });
    if (m.algo === 'delay' && g.sync) o[pre2 + 'subdiv'] = 0;
  }
  const hasB = SLOTS.slice(6).some((k) => st.slots[k]);
  if (hasB) {
    o['A.lvl'] = 1; o['B.lvl'] = g.bLvl ?? 1;
  }
  o['lp.master'] = 0.9; o['lp.sync'] = 0;
  return o;
}

// footswitch → function per mode (FS 1..10)
export function atlasStompSlots(st) {
  return SLOTS.filter((k) => st.slots[k]).slice(0, 10);
}
export const LOOPER_FS = ['REC/DUB', 'PLAY/STOP', 'UNDO', 'REVERSE', 'CLEAR', null, null, null, null, 'EXIT'];
export function atlasFsInfo(st, i, lp) {
  // i = 0..9 → { label, color, lit }
  const mode = st.mode | 0;
  if (mode === 0 || (mode === 3 && i >= 5 && i <= 8)) {
    const list = atlasStompSlots(st);
    const k = mode === 3 ? list[i - 5] : list[i];
    if (!k) return { label: '', color: '#2a2e36', lit: false };
    const s = st.slots[k], m = MODEL_BY_ID[s.m];
    return { label: m.short, color: CAT_BY_ID[m.cat].color, lit: !!s.on };
  }
  if (mode === 1) {
    if (i < 8) return { label: (st.scn && st.scn[i]) || SCENE_NAMES[i], color: SCENE_COLS[i], lit: (st.sc | 0) === i };
    return { label: i === 8 ? 'PRESET ▼' : 'PRESET ▲', color: '#e8ecf3', lit: false };
  }
  if (mode === 2) {
    if (i < 4) { const pi = ((st.pi | 0) - ((st.pi | 0) % 4)) + i; return { label: (presetName(st, pi) || '—'), color: '#ffffff', lit: (st.pi | 0) === pi }; }
    if (i === 4) return { label: 'BANK ▲', color: '#e8ecf3', lit: false };
    if (i === 9) return { label: 'BANK ▼', color: '#e8ecf3', lit: false };
    const si = i - 5;
    return { label: (st.scn && st.scn[si]) || SCENE_NAMES[si], color: SCENE_COLS[si], lit: (st.sc | 0) === si };
  }
  // looper
  const t = lp && lp.tracks && lp.tracks[0];
  const state = t ? t.state : 0;
  const label = LOOPER_FS[i];
  const col = i === 0 ? (state === 1 ? '#ff3b30' : state === 3 ? '#ffb21f' : '#ff3b30') : i === 1 ? '#46d36f' : i === 3 ? '#3fb6ff' : '#e8ecf3';
  const lit = i === 0 ? state === 1 || state === 3 : i === 1 ? state === 2 || state === 3 : i === 3 ? !!(t && t.rev) : false;
  return { label: label || '', color: col, lit };
}
export function presetName(st, pi) {
  const user = st.user && st.user[pi];
  if (user) return user.name;
  const f = ATLAS_FACTORY[pi];
  return f ? f.name : null;
}

// ================================================================== AURORA DESK: programs + snapshot morph
// fixed chain: pitch → mod (chorus) → trem → delay → reverb → freeze
export const AURORA_PROGRAMS = [
  { name: 'DRIFT', sub: 'tape-mod echo', col: '#7dffb0' },
  { name: 'HALO', sub: 'shimmer octaves', col: '#9fd8ff' },
  { name: 'TIDE', sub: 'pulsing swell', col: '#ffd36b' },
  { name: 'PRISM', sub: 'detuned 5ths', col: '#ff8fe0' },
  { name: 'ORBIT', sub: 'rotating pan', col: '#b6a3ff' },
  { name: 'VOID', sub: 'frozen cloud', col: '#ff9a6b' },
];
export const AURORA_MACROS = ['SPACE', 'MOTION', 'PITCH', 'TEXTURE'];
const lerp = (a, b, t) => a + (b - a) * t;
export function auroraDefault() {
  return {
    prog: 0,
    a: { m: [0.35, 0.3, 0.2, 0.25], mix: 0.45, time: 420, fb: 0.4 },
    b: { m: [0.85, 0.75, 0.7, 0.6], mix: 0.7, time: 640, fb: 0.62 },
    mtime: 1.5, ver: 1, // morph glide seconds (footswitch hold)
  };
}
export const auroraState = (ui) => parseSt(ui._st, auroraDefault);
// macro values after morphing (macro knobs edit the snapshot being edited, see screens-tz5.js)
export function auroraMacros(st, morph) {
  const m = st.a.m.map((x, i) => lerp(x, st.b.m[i], morph));
  return { m, mix: lerp(st.a.mix, st.b.mix, morph), time: lerp(st.a.time, st.b.time, morph), fb: lerp(st.a.fb, st.b.fb, morph) };
}
function auroraDerive(ui) {
  const st = auroraState(ui);
  const mo = clamp(ui.morph ?? 0, 0, 1);
  const { m, mix, time, fb } = auroraMacros(st, mo);
  const [space, motion, pitch, tex] = m;
  const prog = st.prog | 0;
  const o = {};
  // pitch voices
  const pit = [
    { s1: 12, s2: -12, l1: 0.15, l2: 0, on: pitch > 0.05 },
    { s1: 12, s2: 24, l1: 0.55, l2: 0.3, on: true },
    { s1: -12, s2: 12, l1: 0.2, l2: 0.2, on: pitch > 0.05 },
    { s1: 7, s2: -5, l1: 0.5, l2: 0.35, on: true },
    { s1: 12, s2: -12, l1: 0.25, l2: 0.15, on: pitch > 0.05 },
    { s1: -12, s2: 7, l1: 0.3, l2: 0.25, on: pitch > 0.05 },
  ][prog];
  o['p.on'] = pit.on ? 1 : 0;
  o['p.semis1'] = pit.s1; o['p.semis2'] = pit.s2; o['p.level3'] = 0; o['p.dry'] = 1;
  o['p.level1'] = pit.l1 * pitch * 1.6; o['p.level2'] = pit.l2 * pitch * 1.6; o['p.cents'] = prog === 3 ? 8 : 0;
  o['p.quality'] = 1; o['p.tone'] = 0.75 - 0.4 * tex;
  // modulation (chorus lane: DRIFT/PRISM chorus, HALO ensemble, ORBIT vibrato, TIDE / VOID dimension)
  o['ch.mode'] = [0, 2, 3, 0, 1, 3][prog];
  o['ch.rate'] = 0.05 + 0.6 * motion * (prog === 4 ? 0.6 : 1); o['ch.depth'] = 0.2 + 0.7 * motion; o['ch.mix'] = prog === 4 ? 0.35 * motion : 0.25 + 0.4 * motion;
  o['ch.on'] = motion > 0.03 ? 1 : 0;
  // tremolo / pulse (TIDE + ORBIT)
  o['tr.on'] = (prog === 2 || prog === 4) && motion > 0.03 ? 1 : 0;
  o['tr.rate'] = 0.15 + 0.5 * motion; o['tr.depth'] = 0.35 + 0.5 * motion; o['tr.stereo'] = prog === 4 ? 1 : 0; o['tr.wave'] = 0.2; o['tr.level'] = 0.62;
  // delay
  o['dl.mode'] = [2, 6, 4, 8, 7, 4][prog];
  o['dl.time'] = time; o['dl.feedback'] = fb * (0.7 + 0.4 * space); o['dl.mix'] = mix * (0.35 + 0.4 * space);
  o['dl.moddepth'] = 0.1 + 0.5 * motion; o['dl.age'] = 0.2 + 0.6 * tex; o['dl.tone'] = 0.75 - 0.45 * tex; o['dl.level'] = 0.5;
  // reverb
  o['rv.mode'] = [6, 4, 9, 1, 6, 5][prog];
  o['rv.decay'] = 0.35 + 0.6 * space; o['rv.mix'] = mix * (0.3 + 0.55 * space); o['rv.size'] = 0.4 + 0.55 * space;
  o['rv.shimmer'] = prog === 1 ? 0.3 + 0.6 * pitch : 0.2 * pitch; o['rv.mod'] = 0.2 + 0.6 * motion; o['rv.tone'] = 0.7 - 0.45 * tex; o['rv.level'] = 0.5;
  // freeze (VOID holds a cloud; others: momentary freeze from the FREEZE switch)
  o['fz.mix'] = 0.55; o['fz.decay'] = prog === 5 ? 0.97 : 1; o['fz.mode'] = prog === 5 ? 2 : 0; o['fz.dry'] = 1; o['fz.tone'] = 0.85 - 0.5 * tex; o['fz.speed'] = 0.3 + 0.5 * motion;
  o['fz.on'] = prog === 5 || (ui._fz ?? 0) > 0.5 ? 1 : 0;
  o['lf.on'] = tex > 0.05 ? 1 : 0; o['lf.mix'] = tex * 0.7; o['lf.mode'] = 0; o['lf.wow'] = 0.2 + 0.5 * tex; o['lf.flutter'] = 0.2 + 0.3 * tex; o['lf.age'] = tex; o['lf.noise'] = 0.15 * tex; o['lf.saturate'] = 0.2 + 0.4 * tex;
  o['lf.level'] = 0;
  return o;
}

// ================================================================== PIXEL QUEST: characters (voices) + levels (chains)
export const PQ_CHARS = [
  { name: 'KNIGHT', voice: 'square lead', lane: 's', mode: 0, col: '#4aa8ff', stats: [4, 3, 2] },
  { name: 'NINJA', voice: 'saw lead', lane: 's', mode: 1, col: '#ff4f6a', stats: [5, 2, 3] },
  { name: 'WIZARD', voice: 'magic pad', lane: 's', mode: 6, col: '#b36bff', stats: [2, 5, 4] },
  { name: 'GOLEM', voice: 'sub bass', lane: 's', mode: 5, col: '#9b7a4a', stats: [5, 1, 1] },
  { name: 'GHOST', voice: 'strings', lane: 's', mode: 3, col: '#d8e6ff', stats: [2, 4, 5] },
  { name: 'ROBOT', voice: 'robot voice', lane: 'v', mode: 4, col: '#a8b4c4', stats: [3, 3, 3] },
  { name: 'KITTY', voice: 'meow voice', lane: 'v', mode: 2, col: '#ffa94d', stats: [1, 5, 4] },
  { name: 'SLIME', voice: 'filter sweep', lane: 's', mode: 7, col: '#5be36b', stats: [3, 2, 5] },
];
export const PQ_LEVELS = [
  { name: '1-1 GREEN HILLS', fx: 'slap echo', cr: 0, sl: 0, dl: [180, 0.2, 0.25], rv: [0, 0.2], col: '#3ddc84' },
  { name: '1-2 CRYSTAL CAVE', fx: 'big cave verb', cr: 0, sl: 0, dl: [0, 0, 0], rv: [1, 0.45], col: '#5ec8ff' },
  { name: '1-3 8-BIT TOWN', fx: 'crunch + gate', cr: 0.65, sl: 1, dl: [0, 0, 0], rv: [0, 0.12], col: '#ffd54a' },
  { name: '1-4 BOSS CASTLE', fx: 'arpeggio echo', cr: 0.35, sl: 7, dl: [330, 0.45, 0.3], rv: [2, 0.2], col: '#ff5a2a' },
  { name: '2-1 SKY TEMPLE', fx: 'shimmer heaven', cr: 0, sl: 0, dl: [420, 0.4, 0.25], rv: [4, 0.4], col: '#e9e3ff' },
  { name: '2-2 UNDERWATER', fx: 'wobble + dark', cr: 0.2, sl: 0, dl: [260, 0.5, 0.3], rv: [6, 0.35], col: '#2fd1c4' },
];
export function pqDefault() {
  return { ch: 0, lv: 0, unlocked: 6, coins: 0, ver: 1 };
}
export const pqState = (ui) => parseSt(ui._st, pqDefault);
function pqDerive(ui) {
  const st = pqState(ui);
  const c = PQ_CHARS[st.ch | 0] || PQ_CHARS[0];
  const L = PQ_LEVELS[st.lv | 0] || PQ_LEVELS[0];
  const mix = ui.mix ?? 0.7, tone = ui.tone ?? 0.6, spd = ui.speed ?? 0.5, vol = ui.vol ?? 0;
  const power = (ui._power ?? 0) > 0.5;
  const o = {};
  const wet = Math.min(1, 2 * mix), dry = Math.min(1, 2 * (1 - mix));
  o['s.on'] = c.lane === 's' ? 1 : 0;
  o['s.mode'] = c.mode; o['s.filter'] = 0.2 + 0.75 * tone; o['s.reso'] = 0.25; o['s.sens'] = 0.55; o['s.attack'] = c.mode === 6 || c.mode === 3 ? 0.35 : 0.03;
  o['s.decay'] = 0.55; o['s.wet'] = wet; o['s.dry'] = dry * 0.85; o['s.level'] = vol - 7 + (c.mode === 5 ? 2 : c.mode === 6 ? 3.5 : c.mode === 3 ? 1.5 : 0);
  o['s.octave'] = (c.mode === 5 ? -1 : 0) + (power ? 1 : 0);
  o['v.on'] = c.lane === 'v' ? 1 : 0;
  o['v.mode'] = c.mode; o['v.vowel'] = 3; o['v.lyric'] = c.mode === 2 ? 3 : 4; o['v.sens'] = 0.55; o['v.tone'] = 0.3 + 0.6 * tone;
  o['v.mix'] = wet * 0.05; o['v.dry'] = dry; o['v.level'] = vol; o['v.octave'] = power ? 1 : 0; o['v.shift'] = c.mode === 2 ? 0.7 : 0.5;
  // power-up: sparkle octave (pitch) while held
  o['pw.on'] = power ? 1 : 0; o['pw.semis1'] = 12; o['pw.level1'] = 0.6; o['pw.dry'] = 1; o['pw.level2'] = 0; o['pw.level3'] = 0; o['pw.scale'] = 0;
  o['cr.on'] = L.cr > 0 ? 1 : 0; o['cr.bits'] = 0.75 - 0.5 * L.cr; o['cr.rate'] = 0.1 + 0.3 * L.cr; o['cr.mix'] = 0.4 + 0.5 * L.cr;
  o['sl.on'] = L.sl > 0 ? 1 : 0; o['sl.pattern'] = L.sl; o['sl.time'] = 60 + 260 * (1 - spd); o['sl.depth'] = 0.9; o['sl.smooth'] = 0.15;
  o['dl.on'] = L.dl[0] > 0 ? 1 : 0; o['dl.time'] = L.dl[0] * (1.5 - spd); o['dl.feedback'] = L.dl[1]; o['dl.mix'] = L.dl[2]; o['dl.mode'] = L.cr > 0 ? 3 : 0; o['dl.level'] = 0.5;
  o['rv.on'] = L.rv[1] > 0 ? 1 : 0; o['rv.mode'] = L.rv[0]; o['rv.mix'] = L.rv[1]; o['rv.decay'] = 0.45 + 0.3 * (L.rv[0] === 1 || L.rv[0] === 4 ? 1 : 0); o['rv.level'] = 0.5;
  if (L.name.startsWith('2-2')) { o['ch.on'] = 1; o['ch.mode'] = 1; o['ch.rate'] = 0.25; o['ch.depth'] = 0.45; o['ch.mix'] = 1; } else o['ch.on'] = 0;
  return o;
}

// ================================================================== LOW FOUNDRY: bass amps / programs
export const LF_AMPS = [
  { name: 'SVT', full: 'SUPER VALVE 8x10', model: 'svt', cab: '8x10svt', trim: -3 },
  { name: 'B15', full: 'FLIP-TOP 15', model: 'b15', cab: '1x15bass', trim: -3.5 },
  { name: 'GK8', full: 'GRAPH KRUEG 800', model: 'gk800', cab: '4x10bass', trim: -2 },
  { name: 'AD2', full: 'AD 200 TUBE', model: 'ad200', cab: '4x10bass', trim: -1.5 },
  { name: 'MKB', full: 'MARK LITTLE', model: 'markbass', cab: '2x10horn', trim: 1 },
];
export const LF_PROGS = ['CLEAN DI', 'MOTOWN', 'GRIND', 'OCTAFUZZ', 'SYNTH', 'CHORUS'];
export function lfDefault() {
  return { amp: 0, prog: 0, chan: 0, cab: 1, ver: 1 };
}
export const lfState = (ui) => parseSt(ui._st, lfDefault);
export function lfChain(st) {
  const a = LF_AMPS[st.amp | 0] || LF_AMPS[0];
  return { chain: [
    { prefix: 'tu', algo: 'tuner', on: false },
    { prefix: 'cp', algo: 'comp', opts: { type: 'opto' } },
    { prefix: 'oc', algo: 'pitch' },
    { prefix: 'sy', algo: 'synth', on: false },
    { prefix: 'dr', algo: 'drive', opts: { clip: 'mosfet', tone: 'eq3', bassF: 90, midF: 600, trebleF: 3000, preHp: 40, gainMinDb: 6, gainMaxDb: 42, levelMaxDb: 8 } },
    { prefix: 'amp', algo: 'amp', opts: { model: a.model, preamp: true } },
    { prefix: 'eq', algo: 'peq' },
    { prefix: 'ch', algo: 'chorus', on: false },
    { prefix: 'cab', algo: 'cab', opts: { model: a.cab } },
    { prefix: 'mt', algo: 'meter' },
  ], mix: true };
}
function lfDerive(ui) {
  const st = lfState(ui);
  const o = {};
  const prog = st.prog | 0;
  const tuner = (ui._tuner ?? 0) > 0.5;
  o['tu.on'] = tuner ? 1 : 0;
  o['cp.on'] = (ui.comp ?? 0.4) > 0.02 && (ui.cpOn ?? 1) > 0.5 ? 1 : 0;
  o['cp.sustain'] = ui.comp ?? 0.4; o['cp.level'] = 0.5 + 0.15 * (ui.comp ?? 0.4);
  // octave: footswitch + program
  const octOn = (ui.ocOn ?? 0) > 0.5 || prog === 3;
  o['oc.on'] = octOn ? 1 : 0; o['oc.semis1'] = -12; o['oc.level1'] = 0.7; o['oc.dry'] = 1; o['oc.level2'] = 0; o['oc.level3'] = 0; o['oc.quality'] = 1; o['oc.scale'] = 0; o['oc.tone'] = 0.6;
  o['sy.on'] = prog === 4 ? 1 : 0; o['sy.mode'] = 5; o['sy.wet'] = 0.7; o['sy.dry'] = 0.6; o['sy.filter'] = 0.35 + 0.5 * (ui.treble ?? 0.5); o['sy.reso'] = 0.45; o['sy.level'] = -6; o['sy.octave'] = 0;
  const drvOn = (ui.drOn ?? 0) > 0.5 || prog === 2 || prog === 3;
  o['dr.on'] = drvOn ? 1 : 0;
  o['dr.gain'] = ui.drive ?? 0.45; o['dr.blend'] = ui.blend ?? 0.5; o['dr.level'] = 0.55; o['dr.bass'] = 0.5; o['dr.treble'] = 0.55; o['dr.mid'] = prog === 3 ? 0.7 : 0.5;
  // amp + EQ
  o['amp.gain'] = (ui.gain ?? 0.45) * (st.chan ? 1 : 0.7) + (st.chan ? 0.15 : 0);
  o['amp.bass'] = 0.5; o['amp.mid'] = prog === 1 ? 0.65 : 0.5; o['amp.treble'] = prog === 1 ? 0.35 : 0.5;
  o['amp.level'] = (LF_AMPS[st.amp | 0] || LF_AMPS[0]).trim - (prog === 1 ? 2 : prog === 3 ? 4 : prog === 2 ? 1.5 : 0) + (prog === 4 ? 2 : 0);
  o['eq.lowgain'] = ((ui.bass ?? 0.5) - 0.5) * 24; o['eq.lowfreq'] = 70;
  o['eq.mid1gain'] = ((ui.lomid ?? 0.5) - 0.5) * 24; o['eq.mid1freq'] = 250; o['eq.mid1q'] = 0.9;
  o['eq.mid2gain'] = ((ui.himid ?? 0.5) - 0.5) * 24; o['eq.mid2freq'] = 1200; o['eq.mid2q'] = 0.9;
  o['eq.highgain'] = ((ui.treble ?? 0.5) - 0.5) * 24; o['eq.highfreq'] = 4000; o['eq.level'] = (ui.level ?? 0) - 1.5;
  o['ch.on'] = prog === 5 ? 1 : 0; o['ch.mode'] = 0; o['ch.rate'] = 0.25; o['ch.depth'] = 0.45; o['ch.mix'] = 0.4;
  o['cab.on'] = st.cab ? 1 : 0; o['cab.lowcut'] = 30; o['cab.highcut'] = 7000;
  o.mix = ui.dimix ?? 1;
  o['mt.release'] = 0.5;
  return o;
}

// ================================================================== definitions
const ATLAS_STEREO = { ins: ['IN L', 'IN R'], outs: ['OUT L', 'OUT R'] };
const stripLed = (i) => LED({ bind: 'fn', r: 2.2, color: '#ffffff', ledFn: (ui, b, st) => {
  const s = atlasState(ui);
  const f = atlasFsInfo(s, i, st && st.lp && st.lp.looper);
  return f.lit && !b.bypass ? f.color : null;
} });

export const originals4 = [
  // ------------------------------------------------------------------ 1. ATLAS FLOOR
  TZ({ id: 'tz.atlas', name: 'Atlas Floor', cat: 'Multi-FX', kind: 'Multi-FX', form: 'tz5-atlas', color: '#24272d', accent: '#ff8a3d', logo: 'ATLAS', noStd: true,
    typeName: 'Flagship modeler · 2 paths · 12 slots · scenes · looper', stereo: 'both', ports: ATLAS_STEREO, monoPorts: { ins: ['IN'], outs: ['OUT'] }, cost: 5, noBypassClick: true,
    algo: 'chain', opts: atlasChain(atlasDefault()),
    ctrl: { ins: [{ label: 'EXP 3', param: 'exp2' }] },
    controls: [
      SCREEN('tz5-atlas', { w: 330, h: 168, interactive: true, bg: '#0b0d12' }),
      SCREEN('tz5-atlas-strip', { row: 0, w: 520, h: 15, bg: '#05070a' }),
      SCREEN('tz5-atlas-strip', { row: 1, w: 520, h: 15, bg: '#05070a' }),
      ...[1, 2, 3, 4, 5, 6].map((i) => K('k' + i, '', { def: 0.5, virtual: true, role: 'pk' + i, display: (v) => Math.round(v * 100) + '%' })),
      PB('menu', 'MENU'), PB('home', 'HOME'), PB('save', 'SAVE'), PB('pgl', '◀ PAGE'), PB('pgr', 'PAGE ▶'),
      PB('up', '', { w: 13, h: 11 }), PB('down', '', { w: 13, h: 11 }), PB('left', '', { w: 11, h: 13 }), PB('right', '', { w: 11, h: 13 }), PB('enter', '', { shape: 'circle', r: 7 }),
      PB('back', 'BACK'), PB('onoff', 'ON/OFF'),
      ...[...Array(10)].map((_, i) => stripLed(i)),
      ...[...Array(10)].map((_, i) => PF('fs' + (i + 1), { role: 'fs' + i })),
      PF('mode', { label: 'MODE', role: 'fsmode' }), PF('tap', { label: 'TAP · TUNER', role: 'fstap' }),
      LED({ bind: 'fn', r: 2.2, color: '#ff3b30', role: 'tapled', ledFn: (ui, b, st, now) => {
        const s = atlasState(ui);
        if ((ui._tuner ?? 0) > 0.5) return '#3ddc84';
        if (!s.g || s.g.tapLed === 0) return null;
        return now % (60000 / (s.g.bpm || 120)) < 70 ? '#ff3b30' : null;
      } }),
      LED({ bind: 'fn', r: 2.2, color: '#ffffff', role: 'modeled', ledFn: (ui) => ['#ffffff', '#3fb6ff', '#ffd23f', '#ff3b30'][atlasState(ui).mode | 0] }),
      TREADLE('exp2', { def: 0, role: 'exp2', logo: 'EXP 2', color: '#17191d', logoColor: '#8b93a3', logoFont: "'Oswald', sans-serif", logoSize: 12 }),
      TREADLE('exp1', { def: 1, role: 'exp1', logo: 'WAH · VOL', color: '#17191d', logoColor: '#8b93a3', logoFont: "'Oswald', sans-serif", logoSize: 12 }),
      BTN('', { p: 'toe', toggle: true, virtual: true, shape: 'rect', w: 30, h: 8, role: 'toe', led: true, ledColor: '#ff3b30', ledDy: 0, ledDx: 22 }),
      LED({ bind: 'param:toe', r: 2, color: '#ff3b30', role: 'toeled' }),
    ],
    derive: atlasDerive,
    desc: 'The Tone Zone flagship. Two parallel paths of six slots, each holding any of 80 drive, amp, cab, dynamics, EQ, modulation, filter, pitch, delay and reverb models. The big colour screen shows the signal chain; the joystick buttons move the cursor and open the model browser, the six knobs edit the selected block page by page. Eight scenes per preset, 12 factory presets in 3 banks, a 60-second looper, a tuner (hold TAP) and a global settings menu. Ten footswitches with scribble strips switch between STOMP, SCENE, PRESET and LOOPER modes (MODE). Two treadles: WAH/VOL with a toe switch and the assignable EXP 2 (Global ▸ Pedals ▸ EXP 2 target).' }),

  // ------------------------------------------------------------------ 2. AURORA DESK
  TZ({ id: 'tz.aurora', name: 'Aurora Desk', cat: 'Multi-FX', kind: 'Multi-FX', form: 'tz5-aurora', color: '#1b1f2a', accent: '#7dffb0', logo: 'AURORA', noStd: true,
    typeName: 'Ambient · modulation · pitch · A/B morph', stereo: 'stereo', ports: ATLAS_STEREO, monoPorts: { ins: ['IN'], outs: ['OUT'] }, cost: 6,
    algo: 'chain', opts: { chain: [
      { prefix: 'p', algo: 'pitch' },
      { prefix: 'ch', algo: 'chorus' },
      { prefix: 'tr', algo: 'tremolo', on: false },
      { prefix: 'lf', algo: 'lofi' },
      { prefix: 'dl', algo: 'delay', opts: { maxMs: 2000 } },
      { prefix: 'rv', algo: 'reverb' },
      { prefix: 'fz', algo: 'freeze', on: false },
    ] },
    ctrl: { ins: [{ label: 'EXP', param: 'morph' }] },
    controls: [
      SCREEN('tz5-aurora', { w: 176, h: 112, interactive: true, bg: '#020604' }),
      ...AURORA_MACROS.map((l, i) => K('m' + (i + 1), l, { def: 0.5, virtual: true, role: 'mac' + i, r: 13 })),
      K('morph', 'MORPH', { def: 0, virtual: true, role: 'morph', r: 15, display: (v) => 'A ' + Math.round((1 - v) * 100) + ' · B ' + Math.round(v * 100) }),
      K('mixk', 'MIX', { def: 0.5, virtual: true, role: 'mixk', r: 10 }),
      K('timek', 'TIME', { def: 0.4, virtual: true, role: 'timek', r: 10 }),
      PB('prev', '◀ PROG'), PB('next', 'PROG ▶'), PB('edit', 'EDIT A/B'), PB('page', 'PAGE'),
      LED({ bind: 'on', color: '#7dffb0', role: 'onled' }),
      LED({ bind: 'fn', color: '#9fd8ff', role: 'abled', ledFn: (ui, b) => !b.bypass && ((ui.morph ?? 0) > 0.5 ? '#ff9a6b' : '#7dffb0') }),
      LED({ bind: 'onparam:_fz', color: '#ffffff', role: 'fzled' }),
      FOOT({ label: 'BYPASS', role: 'fon', style: 'stomp' }),
      PF('ab', { label: 'A ⇄ B  (HOLD = GLIDE)', role: 'fab', style: 'stomp' }),
      PF('fz', { label: 'FREEZE', role: 'ffz', style: 'stomp' }),
    ],
    derive: auroraDerive,
    desc: 'A desktop + stomp ambient engine: pitch voices → ensemble / vibrato → pulse → tape texture → modulated echo → reverb → freeze. Six programs (DRIFT, HALO, TIDE, PRISM, ORBIT, VOID) re-wire four macro knobs (SPACE, MOTION, PITCH, TEXTURE). Two complete snapshots (A and B): EDIT chooses which one the knobs change, the MORPH knob, an expression pedal or the A⇄B switch blend between them (tap = jump, hold = glide over the MORPH TIME). The vector-scope screen draws the morph as a Lissajous figure.' }),

  // ------------------------------------------------------------------ 3. PIXEL QUEST
  TZ({ id: 'tz.pixelquest', name: 'Pixel Quest', cat: 'Multi-FX', kind: 'Multi-FX', form: 'tz5-console', color: '#c9c3d6', accent: '#ff3f7f', logo: 'PIXEL QUEST', noStd: true,
    typeName: 'Game-console synth · 8 characters · 6 levels', stereo: 'both', cost: 2.5,
    algo: 'chain', opts: { chain: [
      { prefix: 'pw', algo: 'pitch', on: false },
      { prefix: 's', algo: 'synth' },
      { prefix: 'v', algo: 'vocal', on: false },
      { prefix: 'cr', algo: 'crusher', on: false },
      { prefix: 'sl', algo: 'slicer', on: false },
      { prefix: 'ch', algo: 'chorus', on: false },
      { prefix: 'dl', algo: 'delay', opts: { maxMs: 1200 } },
      { prefix: 'rv', algo: 'reverb' },
      { prefix: 'mt', algo: 'meter' },
    ] },
    controls: [
      SCREEN('tz5-pixel', { w: 160, h: 120, interactive: true, bg: '#1d2b53' }),
      K('vol', 'VOLUME', { min: -18, max: 12, def: 0, display: db, role: 'kvol', virtual: true }),
      K('mix', 'MIX', { def: 0.7, virtual: true, role: 'kmix' }),
      K('tone', 'TONE', { def: 0.6, virtual: true, role: 'ktone' }),
      K('speed', 'SPEED', { def: 0.5, virtual: true, role: 'kspeed' }),
      PB('up', '', { role: 'dup', w: 11, h: 11 }), PB('down', '', { role: 'ddown', w: 11, h: 11 }), PB('left', '', { role: 'dleft', w: 11, h: 11 }), PB('right', '', { role: 'dright', w: 11, h: 11 }),
      PB('a', 'A', { role: 'ba', shape: 'circle', r: 7 }), PB('b', 'B', { role: 'bb', shape: 'circle', r: 7 }),
      PB('select', 'SELECT', { role: 'bsel', w: 16, h: 6 }), PB('start', 'START', { role: 'bstart', w: 16, h: 6 }),
      LED({ bind: 'on', color: '#ff3f7f', role: 'power' }),
      FOOT({ label: 'POWER', role: 'fon', style: 'soft' }),
      PF('lvprev', { label: '◀ LEVEL', role: 'flp' }), PF('lvnext', { label: 'LEVEL ▶', role: 'fln' }),
      PF('pw', { label: 'POWER-UP (HOLD)', role: 'fpw' }),
    ],
    derive: pqDerive,
    desc: 'A handheld game console that is secretly a synth: pick a CHARACTER (each one is a synth voice – square knight, saw ninja, pad wizard, sub-bass golem, string ghost, robot and cat voices, slime filter sweep) and a LEVEL (each world is an effects chain: slap echo, cave reverb, 8-bit crunch + gate, arpeggio castle, shimmer temple, underwater wobble). D-pad, A/B, START (pause menu) and SELECT drive the pixel menus; the LEVEL switches warp between worlds and POWER-UP adds a sparkling octave while held.' }),

  // ------------------------------------------------------------------ 4. LOW FOUNDRY (bass)
  TZ({ id: 'tz.foundry', name: 'Low Foundry', cat: 'Multi-FX', kind: 'Multi-FX', form: 'tz5-foundry', color: '#2b2622', accent: '#ffb02e', logo: 'LOW FOUNDRY', noStd: true,
    typeName: 'Bass multi-FX · amp · drive · octave · DI', stereo: 'mono', ports: { ins: ['INPUT'], outs: ['OUTPUT'] }, cost: 3, tags: ['bass'],
    algo: 'chain', opts: lfChain(lfDefault()),
    ctrl: { ins: [{ label: 'EXP', param: 'dimix' }] },
    controls: [
      SCREEN('tz5-meter', { w: 92, h: 56, interactive: true, bg: '#e9dfc4' }),
      SCREEN('tz5-seg', { w: 120, h: 30, interactive: true, bg: '#120806' }),
      K('gain', 'GAIN', { def: 0.45, virtual: true, role: 'k0' }), K('comp', 'COMP', { def: 0.4, virtual: true, role: 'k1' }), K('drive', 'DRIVE', { def: 0.45, virtual: true, role: 'k2' }), K('blend', 'BLEND', { def: 0.5, virtual: true, role: 'k3' }),
      K('bass', 'BASS', { def: 0.5, virtual: true, role: 'k4' }), K('lomid', 'LO MID', { def: 0.5, virtual: true, role: 'k5' }), K('himid', 'HI MID', { def: 0.5, virtual: true, role: 'k6' }), K('treble', 'TREBLE', { def: 0.5, virtual: true, role: 'k7' }),
      K('dimix', 'DI / AMP', { def: 1, virtual: true, role: 'k8', display: (v) => 'AMP ' + Math.round(v * 100) + '%' }), K('level', 'MASTER', { min: -18, max: 12, def: 0, display: db, virtual: true, role: 'k9' }),
      PB('mode', 'MODE', { role: 'bmode' }), PB('left', '◀', { role: 'bl', w: 12 }), PB('right', '▶', { role: 'br', w: 12 }), PB('store', 'STORE', { role: 'bstore' }),
      FOOT({ action: 'toggle', virtual: true, p: 'cpOn', def: 1, label: 'COMP', role: 'f0' }), FOOT({ action: 'toggle', virtual: true, p: 'drOn', def: 0, label: 'DRIVE', role: 'f1' }), FOOT({ action: 'toggle', virtual: true, p: 'ocOn', def: 0, label: 'OCTAVE', role: 'f2' }),
      PF('chan', { label: 'CH A / B', role: 'f3', style: 'stomp' }), PF('tuner', { label: 'TUNER · MUTE', role: 'f4', style: 'stomp' }), FOOT({ label: 'BYPASS', role: 'f5' }),
      LED({ bind: 'onparam:cpOn', color: '#ffb02e', role: 'l0' }), LED({ bind: 'onparam:drOn', color: '#ff4b2b', role: 'l1' }), LED({ bind: 'onparam:ocOn', color: '#7dd3ff', role: 'l2' }),
      LED({ bind: 'fn', color: '#ffb02e', role: 'l3', ledFn: (ui, b) => !b.bypass && (lfState(ui).chan ? '#ff4b2b' : '#3ddc84') }),
      LED({ bind: 'param:_tuner', color: '#3ddc84', role: 'l4' }), LED({ bind: 'on', color: '#ff2a1a', role: 'l5' }),
    ],
    derive: lfDerive,
    desc: 'A bass rig on the floor: opto compressor → sub octave → bass synth → blendable grit → tube bass preamp (5 amp voices) → 4-band EQ → chorus → cab sim, with a DI/AMP blend. The analog VU meter shows the output level (and the cents while tuning); the 14-segment display shows program, amp and values. MODE cycles PROGRAM / AMP / CAB / TUNER pages, ◀ ▶ change the value, STORE keeps the program on the current channel. Footswitches: COMP, DRIVE, OCTAVE, CH A/B (channel B = hotter preamp), TUNER (mutes) and BYPASS.' }),
];
