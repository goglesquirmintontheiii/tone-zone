// Tone Zone original designs: one per DSP algorithm with full access to its parameters, plus studio utilities.
import { K, SEL, TOG, BTN, FOOT, LED, SCREEN, def, ms, db, MONO, STEREO, MONO_TO_ST, STD } from './helpers.js';
import { TZ, UT, AMP, CAB, k } from './builders.js';

export const originals = [
  // drives
  TZ({ id: 'tz.klone', form: 'tz3-deco', name: 'Centaurus', cat: 'Overdrive', color: '#c9a64e', text: '#2b1d0a', logo: 'CENTAURUS', typeName: 'Transparent overdrive', ref: 'Klon Centaur style',
    algo: 'drive', opts: { clip: 'ge', bias: 0.1, cleanSum: true, cleanMix: 0.6, clipHp: 400, gainMinDb: 0, gainMaxDb: 34, tone: 'tilt', trebleF: 1600, eqRangeDb: 8, postLp: 9500, levelMaxDb: 10 },
    controls: [K('gain', 'GAIN'), K('tone', 'TREBLE'), K('level', 'OUTPUT')] }),
  TZ({ id: 'tz.muff', form: 'tz3-pi', name: 'Big Fuzz π', cat: 'Fuzz', color: '#d9d4c7', text: '#b0161c', logo: 'BIG FUZZ π', typeName: 'Sustaining fuzz', ref: 'Electro-Harmonix Big Muff π style',
    algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 18, preHp: 80, gainMinDb: 20, gainMaxDb: 52, tone: 'blend', blendLp: 450, blendHp: 1100, postLp: 9000, levelMaxDb: 4 },
    controls: [K('level', 'VOLUME'), K('tone', 'TONE'), K('gain', 'SUSTAIN')] }),
  TZ({ id: 'tz.fuzzface', form: 'tz3-face', name: 'Smiley Fuzz', cat: 'Fuzz', color: '#b9161b', text: '#f2f2f2', logo: 'SMILEY FUZZ', typeName: 'Germanium fuzz', ref: 'Dallas Arbiter Fuzz Face style', knob: 'chicken',
    algo: 'drive', opts: { clip: 'ge', bias: 0.32, gainMinDb: 14, gainMaxDb: 44, tone: 'none', postLp: 6500, levelMaxDb: 2 },
    controls: [K('level', 'VOLUME'), K('gain', 'FUZZ', { def: 0.7 })] }),
  TZ({ id: 'tz.bender', form: 'tz3-bend', name: 'Tone Bend MkII', cat: 'Fuzz', color: '#7b7f86', text: '#111', logo: 'TONE BEND', typeName: 'Three-transistor fuzz', ref: 'Sola Sound Tone Bender MkII style',
    algo: 'drive', opts: { clip: 'ge', bias: 0.22, stages: 2, stage2Db: 10, gainMinDb: 16, gainMaxDb: 48, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 7000, levelMaxDb: 2 },
    controls: [K('level', 'LEVEL'), K('tone', 'TONE'), K('gain', 'ATTACK')] }),
  TZ({ id: 'tz.drive', form: 'tz3-lab', name: 'TZ Drive Lab', cat: 'Overdrive', color: '#c95a26', accent: '#ff7a2f', text: '#1a0d05', logo: 'DRIVE LAB', typeName: 'Configurable drive', stereo: 'both',
    algo: 'drive', opts: { tone: 'eq3', eqRangeDb: 12, cleanSum: false, modes: [{ clip: 'ts', cleanSum: true, clipHp: 720 }, { clip: 'asym' }, { clip: 'diode' }, { clip: 'opamp', slew: 0.4 }, { clip: 'jfet' }, { clip: 'led' }, { clip: 'muff', stages: 2 }, { clip: 'ge' }], gainMaxDb: 48, levelMaxDb: 8 },
    controls: [K('gain', 'GAIN'), K('level', 'LEVEL'), K('blend', 'BLEND', { def: 1 }), K('bass', 'BASS'), K('mid', 'MID'), K('treble', 'TREBLE'),
      SEL('mode', 'CLIP', ['TS', 'ASYM', 'DIODE', 'OPAMP', 'JFET', 'LED', 'MUFF', 'GE'], { sweep: 240, optSize: 4.2 })] }),
  TZ({ id: 'tz.boost', form: 'tz3-arrow', name: 'TZ Clean Boost', cat: 'Boost', color: '#e9ecf3', text: '#111', logo: 'CLEAN BOOST', typeName: 'JFET boost', stereo: 'both',
    algo: 'boost', opts: { gainMaxDb: 24, colored: true }, controls: [K('gain', 'BOOST', { def: 0.35 }), K('bass', 'BASS'), K('treble', 'TREBLE')] }),
  TZ({ id: 'tz.trebleboost', form: 'tz3-wedge', name: 'Treble Booster', cat: 'Boost', color: '#8a8f97', text: '#111', logo: 'TREBLE BOOST', typeName: 'Range booster', ref: 'Dallas Rangemaster style',
    algo: 'boost', opts: { gainMaxDb: 22, colored: true, bassF: 300, trebleF: 1800 }, fixed: { bass: 0.25, treble: 0.8 }, controls: [K('gain', 'BOOST', { def: 0.5 })] }),
  // dynamics / eq
  TZ({ id: 'tz.comp', form: 'tz3-vu', name: 'TZ Studio Comp', cat: 'Dynamics', color: '#2c3e50', text: '#e9ecf3', logo: 'STUDIO COMP', typeName: 'VCA compressor', stereo: 'both',
    algo: 'comp', opts: { type: 'vca' }, controls: [K('sustain', 'AMOUNT'), K('ratio', 'RATIO'), K('attack', 'ATTACK'), K('release', 'RELEASE'), K('level', 'MAKEUP'), K('blend', 'MIX', { def: 1 }), K('knee', 'KNEE'), K('tone', 'TONE')] }),
  TZ({ id: 'tz.opto', form: 'tz3-tomb', name: 'Opto Squeeze', cat: 'Dynamics', color: '#f0e3c8', text: '#2a1d10', logo: 'OPTO', typeName: 'Optical compressor', stereo: 'both',
    algo: 'comp', opts: { type: 'opto' }, controls: [K('sustain', 'PEAK RED.'), K('level', 'GAIN'), K('blend', 'MIX', { def: 1 })] }),
  TZ({ id: 'tz.gate', form: 'tz3-gate', name: 'TZ Noise Gate', cat: 'Dynamics', color: '#1b1f27', text: '#e9ecf3', logo: 'GATE', typeName: 'Noise gate', ports: { ins: ['INPUT', 'RETURN'], outs: ['OUTPUT', 'SEND'] },
    algo: 'gate', controls: [K('threshold', 'THRESH'), K('attack', 'ATTACK', { def: 0.1 }), K('decay', 'RELEASE'), K('range', 'RANGE', { def: 1 }), TOG('mode', 'MODE', ['EXPAND', 'MUTE'])] }),
  TZ({ id: 'tz.peq', form: 'tz3-console', name: 'TZ Parametric EQ', cat: 'EQ', color: '#20242d', text: '#e9ecf3', logo: 'PARAMETRIC', typeName: '4-band parametric EQ', stereo: 'both',
    algo: 'peq', controls: [
      K('lowcut', 'LOW CUT', { min: 20, max: 1000, def: 20, curve: 'log', unit: 'Hz' }), K('lowgain', 'LOW', { min: -18, max: 18, def: 0, display: db }), K('lowfreq', 'LOW F', { min: 30, max: 500, def: 100, curve: 'log', unit: 'Hz' }),
      K('mid1gain', 'MID 1', { min: -18, max: 18, def: 0, display: db }), K('mid1freq', 'MID 1 F', { min: 100, max: 4000, def: 500, curve: 'log', unit: 'Hz' }), K('mid1q', 'MID 1 Q', { min: 0.2, max: 8, def: 1, curve: 'log' }),
      K('mid2gain', 'MID 2', { min: -18, max: 18, def: 0, display: db }), K('mid2freq', 'MID 2 F', { min: 300, max: 10000, def: 2000, curve: 'log', unit: 'Hz' }), K('mid2q', 'MID 2 Q', { min: 0.2, max: 8, def: 1, curve: 'log' }),
      K('highgain', 'HIGH', { min: -18, max: 18, def: 0, display: db }), K('highfreq', 'HIGH F', { min: 1000, max: 16000, def: 5000, curve: 'log', unit: 'Hz' }), K('highcut', 'HIGH CUT', { min: 1000, max: 20000, def: 20000, curve: 'log', unit: 'Hz' }),
    ] }),
  // modulation
  TZ({ id: 'tz.chorus', form: 'tz3-wave', name: 'TZ Ensemble', cat: 'Modulation', color: '#3b82c4', text: '#f2f6fb', logo: 'ENSEMBLE', typeName: 'Chorus / vibrato / ensemble', stereo: 'stereo', ports: MONO_TO_ST,
    algo: 'chorus', controls: [K('rate', 'RATE'), K('depth', 'DEPTH'), K('mix', 'MIX'), K('tone', 'TONE'), K('delay', 'DELAY'), K('feedback', 'FEEDBACK', { def: 0 }), SEL('mode', 'MODE', ['CHORUS', 'VIBRATO', 'ENSEMBLE', 'DIMENSION'], { sweep: 120, optSize: 4.2 })] }),
  TZ({ id: 'tz.phaser', form: 'tz3-vortex', name: 'TZ Phaser 12', cat: 'Modulation', color: '#e0662f', text: '#1a0d05', logo: 'PHASER 12', typeName: 'Multi-stage phaser', stereo: 'both',
    algo: 'phaser', controls: [K('rate', 'RATE'), K('depth', 'DEPTH'), K('feedback', 'RES'), K('mix', 'MIX'), K('center', 'CENTER'), SEL('stages', 'STAGES', ['2', '4', '6', '8', '10', '12'], { values: [2, 4, 6, 8, 10, 12], def: 1, sweep: 150 })] }),
  TZ({ id: 'tz.trem', form: 'tz3-capsule', name: 'TZ Harmonic Trem', cat: 'Modulation', color: '#1f5d4a', text: '#eaf6f1', logo: 'TREMOLO', typeName: 'Amp / harmonic / bias tremolo', stereo: 'both',
    algo: 'tremolo', controls: [K('rate', 'RATE'), K('depth', 'DEPTH'), K('wave', 'SHAPE'), K('level', 'LEVEL'), SEL('mode', 'TYPE', ['OPTO', 'HARMONIC', 'BIAS'], { sweep: 100 }), TOG('stereo', 'PAN', ['OFF', 'ON'])] }),
  TZ({ id: 'tz.rotary', form: 'tz3-leslie', name: 'TZ Rotary', cat: 'Modulation', color: '#5a3a24', text: '#f2e6d6', logo: 'ROTARY', typeName: 'Rotating speaker', stereo: 'stereo', ports: MONO_TO_ST,
    algo: 'rotary', controls: [K('drive', 'DRIVE'), K('balance', 'BALANCE'), K('accel', 'ACCEL'), K('mix', 'MIX', { def: 1 }), K('level', 'LEVEL')],
    extraFoot: true }),
  TZ({ id: 'tz.ring', form: 'tz3-radio', name: 'Ring Thing', cat: 'Modulation', color: '#6b2d8f', text: '#f2e8f8', logo: 'RING MOD', typeName: 'Ring modulator',
    algo: 'ringmod', controls: [K('freq', 'FREQ'), K('fine', 'FINE'), K('mix', 'MIX')] }),
  TZ({ id: 'tz.crush', form: 'tz3-glass', name: 'Bit Crusher', cat: 'Filter', color: '#2fbf71', text: '#06140c', logo: '8-BIT', typeName: 'Bit / sample-rate crusher',
    algo: 'crusher', controls: [K('bits', 'BITS'), K('rate', 'DOWNSAMPLE'), K('mix', 'MIX', { def: 1 })] }),
  // filters
  TZ({ id: 'tz.envfilter', form: 'tz3-funk', name: 'Envelope Funk', cat: 'Filter', color: '#f2c12e', text: '#1a1405', logo: 'ENV FILTER', typeName: 'Envelope filter', ref: 'Mu-Tron III / Q-Tron style',
    algo: 'wah', opts: { mode: 2, fLo: 250, fHi: 3000, q: 4 }, controls: [K('sens', 'SENS'), K('q', 'PEAK'), K('range', 'RANGE'), K('level', 'LEVEL'), SEL('filter', 'MODE', ['LP', 'BP', 'HP'], { def: 1, sweep: 90 }), TOG('direction', 'DRIVE', ['UP', 'DOWN'])] }),
  TZ({ id: 'tz.autowah', form: 'tz3-bubble', name: 'Auto Wah', cat: 'Filter', color: '#d14b8f', text: '#fff', logo: 'AUTO WAH', typeName: 'LFO wah',
    algo: 'wah', opts: { mode: 1 }, controls: [K('rate', 'RATE'), K('q', 'Q'), K('range', 'RANGE'), K('level', 'LEVEL')] }),
  // delays & reverbs
  TZ({ id: 'tz.delay', form: 'tz3-echo', name: 'TZ Multi Delay', cat: 'Delay', color: '#1b2a3a', text: '#e9f1fb', logo: 'MULTI DELAY', typeName: 'Digital / analog / tape / reverse', stereo: 'stereo', ports: STEREO,
    algo: 'delay', opts: { maxMs: 3000 }, controls: [K('time', 'TIME', { min: 10, max: 3000, def: 420, curve: 'log', display: ms }), K('feedback', 'REPEATS', { def: 0.35, max: 1.1 }), K('mix', 'MIX'), K('tone', 'TONE'), K('modrate', 'MOD RATE'), K('moddepth', 'MOD DEPTH', { def: 0 }),
      SEL('mode', 'MODE', ['DIG', 'ANA', 'TAPE', 'LOFI', 'MOD', 'REV', 'SHIM', 'PONG', 'DUAL', 'WARP', '+VERB'], { sweep: 300, optSize: 4 }), SEL('subdiv', 'TAP', ['1/4', '1/8.', '1/8', '1/8T', '1/16'], { sweep: 120, optSize: 4.2 })],
    tapFoot: true, tapLed: true }),
  TZ({ id: 'tz.reverb', form: 'tz3-cathedral', name: 'TZ Hall of Fame', cat: 'Reverb', color: '#2b2140', text: '#efe9fb', logo: 'REVERB', typeName: 'Room / hall / plate / spring / shimmer', stereo: 'stereo', ports: STEREO,
    algo: 'reverb', controls: [K('decay', 'DECAY'), K('mix', 'MIX'), K('predelay', 'PRE-DLY', { min: 0, max: 500, def: 20, display: ms }), K('tone', 'TONE'), K('lowcut', 'LOW CUT'), K('mod', 'MOD'), K('size', 'SIZE'), K('shimmer', 'SHIMMER'),
      SEL('mode', 'MODE', ['ROOM', 'HALL', 'PLATE', 'SPRING', 'SHIM', 'CLOUD', 'MOD', 'DYN', '+DLY', 'SWELL'], { sweep: 300, optSize: 4 })], cost: 1.4 }),
  TZ({ id: 'tz.spring', form: 'tz3-tank', name: "'63 Spring Tank", cat: 'Reverb', color: '#3a2a1a', text: '#efe0c8', logo: "'63 SPRING", typeName: 'Spring reverb', knob: 'chicken',
    algo: 'reverb', opts: { fixedMode: 3 }, controls: [K('mix', 'MIX', { def: 0.35 }), K('decay', 'DWELL', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 })] }),
  TZ({ id: 'tz.shimmer', form: 'tz3-crystal', name: 'Celestial', cat: 'Reverb', color: '#e8eef8', text: '#25324a', logo: 'CELESTIAL', typeName: 'Shimmer reverb', stereo: 'stereo', ports: STEREO,
    algo: 'reverb', opts: { fixedMode: 4 }, controls: [K('decay', 'DECAY', { def: 0.7 }), K('mix', 'MIX', { def: 0.4 }), K('shimmer', 'SHIMMER', { def: 0.6 }), K('tone', 'TONE', { def: 0.6 })], cost: 1.6 }),
  // pitch
  TZ({ id: 'tz.whammy', name: 'Wham Bar', cat: 'Pitch', form: 'treadle', color: '#b5121b', logo: 'WHAM BAR', logoFont: "'Oswald', sans-serif", logoColor: '#fff', treadleColor: '#1a1a1a', noStd: true, ref: 'DigiTech Whammy style',
    algo: 'pitch', fixed: { level1: 1, dry: 0, quality: 1 },
    controls: [{ t: 'treadle', p: 'expr', def: 0, min: 0, max: 1 }, SEL('semis1', 'MODE', ['-24', '-12', '-7', '-5', '+5', '+7', '+12', '+24'], { values: [-24, -12, -7, -5, 5, 7, 12, 24], def: 6, x: 122, y: 283, r: 7, sweep: 220, optSize: 3.4, labelRadius: 6, labelPos: 'none' }), LED({ r: 2.4 })],
    toeSwitch: true, desc: 'Treadle sweeps the pitch from dry to the selected interval.' }),
  TZ({ id: 'tz.harmony', form: 'tz3-staff', name: 'TZ Pitch Lab', cat: 'Pitch', color: '#2a1c3f', text: '#efe6ff', logo: 'PITCH LAB', typeName: 'Dual-voice pitch shifter',
    algo: 'pitch', controls: [K('semis1', 'VOICE 1', { min: -24, max: 24, def: -12, step: 1, display: (v) => (v > 0 ? '+' : '') + Math.round(v) + ' st' }), K('level1', 'LEVEL 1', { def: 0.7 }),
      K('semis2', 'VOICE 2', { min: -24, max: 24, def: 7, step: 1, display: (v) => (v > 0 ? '+' : '') + Math.round(v) + ' st' }), K('level2', 'LEVEL 2', { def: 0 }), K('dry', 'DRY', { def: 1 }), K('cents', 'DETUNE', { min: -50, max: 50, def: 0, display: (v) => Math.round(v) + ' ct' }),
      SEL('quality', 'LATENCY', ['TIGHT', 'BAL', 'STUDIO'], { def: 1, sweep: 90 })], cost: 0.8 }),
  // volume & utilities
  def({ id: 'tz.exp', name: 'TZ Volume / Expression', brand: 'Tone Zone', ref: 'Tone Zone original', code: 'VOL', cat: 'Volume', form: 'tz2-treadle', color: '#23262e', accent: '#9aa3b5', algo: 'volume', stereo: 'both', controls: [{ t: 'treadle', p: 'pos', def: 1, min: 0, max: 1 }, LED({ color: '#9aa3b5' }), FOOT()], logo: 'VOLUME', logoFont: "'Oswald', sans-serif", logoColor: '#9aa3b5', noBypassClick: true }),
  TZ({ id: 'tz.tuner', form: 'tz3-strobe', name: 'TZ Strobe Tuner', cat: 'Utility', color: '#111318', text: '#e9ecf3', logo: 'STROBE', typeName: 'Strobe / chromatic tuner', noStd: true,
    algo: 'tuner', opts: { mute: 1 }, controls: [SCREEN('strobe', { w: 120, h: 70 }), FOOT(), LED({ bind: 'tunerOk', color: '#3ddc84' })], defaultBypass: true, tunerBlock: true }),
  def({ id: 'tz.looper', name: 'TZ Mini Looper', brand: 'Tone Zone', ref: 'Tone Zone original', code: 'LOOP', cat: 'Looper', form: 'tz3-loop', color: '#14161b', text: '#e9ecf3', logo: 'MINI LOOP', typeName: '1-track looper',
    algo: 'looper', opts: { tracks: 1, maxSec: 120 }, stereo: 'both', alwaysOn: true, loopTracks: 1,
    controls: [SCREEN('looperMini', { w: 120, h: 40, y: 44 }), K('level1', 'LOOP LVL', { def: 0.8, y: 100 }), K('dubLevel', 'DUB FB', { def: 1, y: 100 }),
      FOOT({ action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 900, event: { type: 2, arg: 0 } }, doubleHold: { event: { type: 3, arg: 0 } } }), LED({ bind: 'looper:track:0' })],
    desc: 'Press: record → overdub/play. Hold: stop. Hold again while stopped: clear.' }),
  UT({ id: 'ut.split', name: 'A/B/Y Splitter', logo: 'A/B/Y', algo: 'utility', opts: { kind: 'split' }, ports: { ins: ['IN'], outs: ['A', 'B'] }, controls: [TOG('select', 'OUT', ['A', 'B', 'A+B'], { def: 2 }), K('level', 'LEVEL A', { min: -60, max: 12, def: 0, display: db }), K('levelB', 'LEVEL B', { min: -60, max: 12, def: 0, display: db })] }),
  UT({ id: 'ut.merge', name: 'Mixer / Merge', logo: 'MERGE', algo: 'utility', opts: { kind: 'merge' }, ports: { ins: ['IN A', 'IN B'], outs: ['OUT'] }, controls: [K('level', 'LEVEL A', { min: -60, max: 12, def: 0, display: db }), K('levelB', 'LEVEL B', { min: -60, max: 12, def: 0, display: db })] }),
  UT({ id: 'ut.mergeSt', name: 'Stereo Merge', logo: 'L/R MERGE', algo: 'utility', opts: { kind: 'merge' }, ports: { ins: ['IN L', 'IN R'], outs: ['OUT L', 'OUT R'] }, controls: [K('level', 'LEVEL L', { min: -60, max: 12, def: 0, display: db }), K('levelB', 'LEVEL R', { min: -60, max: 12, def: 0, display: db })] }),
  UT({ id: 'ut.gain', name: 'Gain / Polarity', logo: 'GAIN', algo: 'utility', opts: { kind: 'gain' }, controls: [K('level', 'GAIN', { min: -60, max: 24, def: 0, display: db }), TOG('invert', 'POLARITY', ['+', 'Ø'])] }),
  UT({ id: 'ut.pan', name: 'Mono → Stereo Pan', logo: 'PAN', algo: 'utility', opts: { kind: 'pan' }, ports: { ins: ['IN'], outs: ['L', 'R'] }, controls: [K('pan', 'PAN', { min: -1, max: 1, def: 0 }), K('level', 'LEVEL', { min: -60, max: 12, def: 0, display: db })] }),
  UT({ id: 'ut.width', name: 'Stereo Width', logo: 'WIDTH', algo: 'utility', opts: { kind: 'width' }, ports: { ins: ['IN L', 'IN R'], outs: ['OUT L', 'OUT R'] }, controls: [K('width', 'WIDTH', { min: 0, max: 2, def: 1 }), K('pan', 'BALANCE', { min: -1, max: 1, def: 0 }), K('level', 'LEVEL', { min: -60, max: 12, def: 0, display: db })] }),
  UT({ id: 'ut.sum', name: 'Stereo → Mono', logo: 'SUM', algo: 'utility', opts: { kind: 'sum' }, ports: { ins: ['IN L', 'IN R'], outs: ['OUT'] }, controls: [K('level', 'LEVEL', { min: -60, max: 12, def: 0, display: db })] }),
  UT({ id: 'ut.ir', name: 'IR Loader (empty)', logo: 'IR LOADER', cat: 'Cab', algo: 'ir', opts: { files: [] }, controls: [K('mix', 'MIX', { def: 1 }), K('level', 'LEVEL', { min: -24, max: 12, def: 0, display: db })], cost: 0.6, hidden: true }),
];

// Audio interface endpoints (always present, cannot be deleted)
// ------------------------------------------------------------------ hard-wired utilities (passive boxes, no switch)
const BOX = (o) => def(Object.assign({ form: 'box', brand: 'Tone Zone', ref: 'Utility', cat: 'Utility', kind: 'Utility', hardwired: true, alwaysOn: true, cost: 0.01, noBypassClick: true }, o));
const outs = (n, p = 'OUT') => [...Array(n)].map((_, i) => `${p} ${i + 1}`);
export const boxes = [
  BOX({ id: 'box.split2', name: '1 → 2 Splitter', logo: 'SPLIT', sub: '1 IN · 2 OUT', typeName: 'Passive Y splitter', algo: 'split', ports: { ins: ['IN'], outs: outs(2) } }),
  BOX({ id: 'box.split4', name: '1 → 4 Splitter', logo: 'SPLIT ×4', sub: '1 IN · 4 OUT', typeName: 'Buffered 4-way splitter', algo: 'split', ports: { ins: ['IN'], outs: outs(4) } }),
  BOX({ id: 'box.split8', name: '1 → 8 Splitter', logo: 'SPLIT ×8', sub: '1 IN · 8 OUT', typeName: 'Buffered 8-way splitter', algo: 'split', ports: { ins: ['IN'], outs: outs(8) }, boxW: 104 }),
  BOX({ id: 'box.merge2', name: '2 → 1 Merger', logo: 'MERGE', sub: '2 IN · 1 OUT', typeName: 'Passive mixer', algo: 'merge', ports: { ins: outs(2, 'IN'), outs: ['OUT'] }, color: '#7f8a96' }),
  BOX({ id: 'box.merge4', name: '4 → 1 Merger', logo: 'MERGE ×4', sub: '4 IN · 1 OUT', typeName: 'Summing mixer', algo: 'merge', ports: { ins: outs(4, 'IN'), outs: ['OUT'] }, color: '#7f8a96' }),
  BOX({ id: 'box.merge8', name: '8 → 1 Merger', logo: 'MERGE ×8', sub: '8 IN · 1 OUT', typeName: 'Summing mixer', algo: 'merge', ports: { ins: outs(8, 'IN'), outs: ['OUT'] }, color: '#7f8a96', boxW: 104 }),
  BOX({ id: 'box.st2mono', name: 'Stereo → Mono Box', logo: 'L+R → M', sub: 'SUMMING BOX', typeName: 'Stereo summing box', algo: 'merge', ports: { ins: ['IN L', 'IN R'], outs: ['MONO'] }, color: '#6f7a86' }),
  BOX({ id: 'box.mono2st', name: 'Mono → Stereo Box', logo: 'M → L/R', sub: 'DUAL MONO', typeName: 'Mono to dual-mono', algo: 'split', ports: { ins: ['IN'], outs: ['L', 'R'] }, color: '#6f7a86' }),
  BOX({ id: 'box.trs2lr', name: 'TRS → L/R Insert', logo: 'TRS → L/R', sub: 'INSERT Y-CABLE', typeName: 'Stereo breakout', algo: 'thru', ports: { ins: ['TRS IN'], outs: ['L', 'R'] }, jackKinds: { i0: 'trs' }, color: '#5c6a78' }),
  BOX({ id: 'box.lr2trs', name: 'L/R → TRS', logo: 'L/R → TRS', sub: 'STEREO COMBINER', typeName: 'Stereo combiner', algo: 'thru', ports: { ins: ['L', 'R'], outs: ['TRS OUT'] }, jackKinds: { o0: 'trs' }, color: '#5c6a78' }),
  BOX({ id: 'box.phones2lr', name: 'Headphone → L/R', logo: 'PHONES', sub: 'TO L / R', typeName: 'Headphone breakout', algo: 'thru', ports: { ins: ['PHONES IN'], outs: ['L', 'R'] }, jackKinds: { i0: 'phones' }, color: '#4f5b69', text: '#e9ecf3' }),
  BOX({ id: 'box.mini2q', name: '3.5 mm ↔ 1/4" Adapter', logo: '3.5 → 1/4', sub: 'STEREO ADAPTER', typeName: 'Jack adapter', algo: 'thru', ports: { ins: ['3.5 MM IN'], outs: ['1/4" TRS OUT'] }, jackKinds: { i0: 'mini', o0: 'trs' }, color: '#4f5b69', text: '#e9ecf3' }),
  BOX({ id: 'box.invert', name: 'Polarity Inverter', logo: 'Ø', logoSize: 16, sub: 'PHASE FLIP', typeName: 'Polarity inverter', algo: 'split', initParams: { inv1: 1 }, ports: { ins: ['IN'], outs: ['OUT'] }, color: '#8a8f99' }),
];

// ------------------------------------------------------------------ converters / DI / control (Tone Zone originals)
export const converters = [
  TZ({ id: 'tz.di', form: 'tz3-rackdi', name: 'TZ Direct Box', cat: 'Utility', kind: 'Utility', color: '#1d4f8f', text: '#f2f5fa', logo: 'DIRECT BOX', typeName: 'Instrument → XLR DI', algo: 'di', alwaysOn: true, noStd: true,
    ports: { ins: ['INPUT'], outs: ['XLR OUT', 'THRU'] }, jackKinds: { o0: 'xlr' },
    controls: [TOG('pad', 'PAD', ['0', '-20', '-40']), TOG('lift', 'GND', ['GND', 'LIFT']), TOG('invert', 'Ø', ['0°', '180°']), TOG('speaker', 'SPKR SIM', ['OFF', 'ON']), K('lowcut', 'LOW CUT', { min: 20, max: 300, def: 20, curve: 'log', unit: 'Hz' }), K('level', 'LEVEL', { min: -24, max: 24, def: 0, display: db })] }),
  TZ({ id: 'tz.reamp', form: 'tz3-xformer', name: 'TZ Re-Amp Box', cat: 'Utility', kind: 'Utility', color: '#8f3b1d', text: '#f7efe9', logo: 'RE-AMP', typeName: 'XLR → instrument level', algo: 'di', opts: { reamp: true }, alwaysOn: true, noStd: true,
    ports: { ins: ['XLR IN'], outs: ['TO AMP'] }, jackKinds: { i0: 'xlr' },
    controls: [TOG('invert', 'Ø', ['0°', '180°']), K('level', 'LEVEL', { min: -24, max: 24, def: 0, display: db }), K('lowcut', 'LOW CUT', { min: 20, max: 300, def: 20, curve: 'log', unit: 'Hz' })] }),
  TZ({ id: 'tz.hpamp', form: 'tz3-phones', name: 'TZ Headphone Amp', cat: 'Utility', kind: 'Utility', color: '#222630', text: '#e9ecf3', logo: 'PHONES AMP', typeName: 'Stereo → headphone out', algo: 'stereo', opts: { mode: 6 }, stereo: 'stereo',
    ports: { ins: ['IN L', 'IN R'], outs: ['PHONES'] }, jackKinds: { o0: 'phones' }, controls: [K('level', 'VOLUME', { min: -40, max: 12, def: -6, display: db }), K('pan', 'BALANCE', { min: -1, max: 1, def: 0 })] }),
  TZ({ id: 'tz.xlrsplit', form: 'tz3-xlr', name: 'TZ Mic Splitter', cat: 'Utility', kind: 'Utility', color: '#3a3f4a', text: '#e9ecf3', logo: 'XLR SPLIT', typeName: 'XLR 1 → 2 (isolated)', algo: 'split', alwaysOn: true, noStd: true,
    ports: { ins: ['XLR IN'], outs: ['XLR A', 'XLR B'] }, jackKinds: { i0: 'xlr', o0: 'xlr', o1: 'xlr' }, controls: [TOG('lift', 'B GND', ['GND', 'LIFT']), TOG('inv2', 'B Ø', ['0°', '180°'])] }),
  TZ({ id: 'tz.stereo', form: 'tz3-wings', name: 'TZ Stereo Image', cat: 'Utility', kind: 'Pedal', color: '#2c1f4f', text: '#efeaff', logo: 'STEREO IMAGE', typeName: 'Mono → stereo widener', algo: 'stereo', stereo: 'stereo', led: '#a98bff',
    ports: { ins: ['IN L (MONO)', 'IN R'], outs: ['OUT L', 'OUT R'] },
    controls: [SEL('mode', 'MODE', ['WIDTH', 'HAAS', 'DUAL', 'A-PAN', 'MONO', 'SWAP', 'PAN'], { sweep: 210 }), K('width', 'WIDTH', { def: 0.65 }), K('time', 'TIME', { min: 1, max: 40, def: 12, unit: 'ms' }), K('rate', 'RATE', { def: 0.3 }), K('depth', 'DEPTH', { def: 0.5 }), K('monobass', 'MONO BASS', { min: 20, max: 400, def: 20, curve: 'log', unit: 'Hz' }), K('level', 'LEVEL', { min: -24, max: 12, def: 0, display: db })] }),
  TZ({ id: 'tz.meter', name: 'TZ Level Meter', cat: 'Utility', kind: 'Pedal', form: 'meter', color: '#15181e', text: '#e9ecf3', logo: 'LEVEL METER', typeName: 'Stereo peak / RMS meter', algo: 'meter', stereo: 'stereo', alwaysOn: true, noStd: true,
    ports: { ins: ['IN L', 'IN R'], outs: ['OUT L', 'OUT R'] }, controls: [SCREEN('meter', { w: 92, h: 150 }), BTN('PEAK', { action: 'resetPeak', shape: 'rect', w: 18, h: 8 })] }),
  // output selectors: stereo in, N stereo pairs out, a footswitch + LED per output
  ...[2, 4, 6].map((n) =>
    TZ({ id: `tz.select${n}`, name: `TZ Output Selector ${n}`, cat: 'Utility', kind: 'Pedal', form: 'selector', color: n === 2 ? '#1f2a36' : n === 4 ? '#24303d' : '#2a3644', text: '#e9ecf3', logo: n === 2 ? 'A / B' : n === 4 ? 'A B C D' : 'SELECT 6', typeName: `Stereo 1 → ${n} selector`, algo: 'select', stereo: 'stereo', alwaysOn: true, noStd: true,
      ports: { ins: ['IN L (MONO)', 'IN R'], outs: [...Array(n)].flatMap((_, i) => [`${'ABCDEF'[i]} L`, `${'ABCDEF'[i]} R`]) },
      controls: [
        ...[...Array(n)].flatMap((_, i) => [FOOT({ action: 'select', idx: i, label: 'ABCDEF'[i] }), LED({ bind: `select:${i}`, color: ['#3ddc84', '#ff7a2f', '#37a3ff', '#ffd23f', '#e84393', '#a98bff'][i] })]),
        TOG('mode', 'MODE', ['ONE', 'MULTI']), K('fade', 'XFADE', { min: 1, max: 200, def: 12, unit: 'ms' }),
      ] })
  ),
  // studio parametric EQ with an interactive screen
  (() => {
    const bands = [1, 2, 3, 4, 5, 6];
    const BC = ['#ff7a2f', '#ffc23c', '#3ddc84', '#37d6c2', '#4aa8ff', '#a98bff'];
    const init = { hpon: 0, hpf: 80, hps: 1, lpon: 0, lpf: 9000, lps: 1, listen: 0, listenf: 1000, listenq: 2, spectrum: 0, specpost: 1 };
    const defF = [80, 250, 800, 2500, 6000, 12000], defT = [1, 0, 0, 0, 0, 2];
    bands.forEach((i) => Object.assign(init, { [`b${i}on`]: 1, [`b${i}type`]: defT[i - 1], [`b${i}f`]: defF[i - 1], [`b${i}g`]: 0, [`b${i}q`]: 0.9 }));
    return TZ({ id: 'tz.paraeq', name: 'TZ Parametric EQ', cat: 'EQ', kind: 'Pedal', form: 'paraeq', color: '#15181e', accent: '#ff7a2f', logo: 'PARAMETRIC', typeName: '6-band studio EQ · analyser · listen', algo: 'pareq', stereo: 'both', cost: 0.6, noStd: true,
      initParams: init,
      desc: 'Drag the numbered handles (frequency / gain), scroll for Q (or HPF/LPF slope), double-click to switch a band on/off, click the band name to change its type. LISTEN solos the band you pick (or click / drag anywhere on the screen); SPECTRUM shows the analyser – PRE / POST in the corner.',
      controls: [
        SCREEN('paraeq', { interactive: true }),
        ...bands.flatMap((i) => [FOOT({ action: 'toggle', p: `b${i}on`, caption: `B${i}`, labelColor: BC[i - 1] }), LED({ bind: `param:b${i}on`, color: BC[i - 1] })]),
        FOOT({ action: 'toggle', p: 'hpon', caption: 'HPF' }), LED({ bind: 'param:hpon', color: '#e9ecf3' }),
        FOOT({ action: 'toggle', p: 'lpon', caption: 'LPF' }), LED({ bind: 'param:lpon', color: '#e9ecf3' }),
        FOOT({ action: 'toggle', p: 'listen', caption: 'LISTEN', labelColor: '#ffc23c' }), LED({ bind: 'param:listen', color: '#ffc23c' }),
        FOOT({ action: 'toggle', p: 'spectrum', caption: 'SPECTRUM', labelColor: '#37d6c2' }), LED({ bind: 'param:spectrum', color: '#37d6c2' }),
        K('level', 'OUTPUT', { min: -24, max: 12, def: 0, display: db }),
      ] });
  })(),
  // control sources
  def({ id: 'tz.expctl', name: 'TZ Expression Pedal', brand: 'Tone Zone', ref: 'Tone Zone original', code: 'EXP', cat: 'Control', kind: 'Utility', form: 'treadle', color: '#23262e', algo: null,
    ports: { ins: [], outs: [] }, ctrl: { outs: [{ label: 'EXP OUT', source: 'param:pos' }] }, controls: [{ t: 'treadle', p: 'pos', def: 0.5, min: 0, max: 1, virtual: true }], logo: 'EXPRESSION', logoFont: "'Oswald', sans-serif", logoColor: '#9aa3b5', noBypassClick: true, alwaysOn: true,
    desc: 'Plug its TRS cable into any EXP / CTRL jack (or a device plugin like the Helix) to sweep that parameter.' }),
  ...[1, 2, 3].map((n) =>
    def({ id: `tz.fs${n}`, name: `TZ Footswitch ${n === 1 ? '' : '×' + n}`.trim(), brand: 'Tone Zone', ref: 'Tone Zone original', code: 'FS', cat: 'Control', kind: 'Utility', form: 'footswitch', color: '#1a1d23', text: '#e9ecf3', algo: null, logo: n === 1 ? 'FS' : `FS ×${n}`, alwaysOn: true,
      ports: { ins: [], outs: [] }, ctrl: { outs: [...Array(n)].map((_, i) => ({ label: `SW ${i + 1}`, source: 'foot' })) },
      controls: [...[...Array(n)].flatMap((_, i) => [FOOT({ action: 'ctrl', idx: i, label: String(i + 1) }), LED({ bind: `param:sw${i + 1}`, color: '#ff3020' })]), ...[...Array(n)].map((_, i) => TOG(`mode${i + 1}`, `SW${i + 1}`, ['MOM', 'LATCH'], { def: 0 }))],
      desc: 'External footswitch. Connect its control jacks to EXT FS / CTRL inputs (tap tempo, bypass, presets, Helix footswitches…).' })
  ),
];

// generic (not brand-specific) amp / cab
export const coreGear = [
AMP({ id: 'amp.acoustic', name: 'Acoustic DI Pre', brand: 'Tone Zone', ref: 'Tone Zone original', cat: 'Preamp', opts: { model: 'acoustic' }, tolex: '#4b3324', panel: '#d9c7a4', panelText: '#2a1d10', grille: 'brown', headGrille: false, logo: 'Acoustic', logoColor: '#f3e7cf', knob: 'cream', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE')] }),
CAB({ id: 'cab.4x10bass', name: '4x10 Bass', brand: 'Tone Zone', ref: 'Tone Zone original', typeName: '4x10 bass cab with horn', opts: { model: '4x10bass' }, cabSize: '4x10', grille: 'black', logo: 'TZ 410', logoFont: "'Oswald', sans-serif", logoColor: '#ddd', bass: true }),
];

export const ioDefs = [
  // tiny 1/4" couplers: female-female barrel and male-male plug that joins two pedals directly
  def({ id: 'tz.dfemale', name: 'Female-Female Coupler', brand: 'Tone Zone', ref: 'Tone Zone original', cat: 'Utility', kind: 'Utility', typeName: '1/4" barrel coupler', form: 'coupler', coupler: 'female', algo: 'thru', ports: { ins: ['IN'], outs: ['OUT'] }, controls: [], recolor: true, rerenderOn: ['jacket'], alwaysOn: true, cost: 0, desc: 'Joins two cables end to end. Right-click to change its colour.' }),
  def({ id: 'tz.dmale', name: 'Male-Male Coupler', brand: 'Tone Zone', ref: 'Tone Zone original', cat: 'Utility', kind: 'Utility', typeName: '1/4" pedal coupler', form: 'coupler', coupler: 'male', algo: 'thru', ports: { ins: ['IN'], outs: ['OUT'] }, controls: [], recolor: true, rerenderOn: ['jacket'], alwaysOn: true, cost: 0, desc: 'Plugs straight into two pedals with no cable. Drag a pedal next to an open end and it snaps on. Right-click to change its colour.' }),
  // extra jacks share the interface channels (combo XLR / 1/4" inputs, aux = return L/R, XLR outs = main L/R)
  def({ id: '__in', name: 'Audio In', cat: 'I/O', form: 'io', io: 'in', algo: null, ports: { ins: [], outs: ['GUITAR IN 1', 'GUITAR IN 2', 'RETURN L', 'RETURN R', 'XLR IN 1', 'XLR IN 2', 'AUX IN'] }, jackKinds: { o4: 'xlr', o5: 'xlr', o6: 'phones' }, ioMap: { o4: [0], o5: [1], o6: [2, 3] }, controls: [], fixedNode: true }),
  def({ id: '__out', name: 'Audio Out', cat: 'I/O', form: 'io', io: 'out', algo: null, ports: { ins: ['MAIN OUT L', 'MAIN OUT R', 'SEND L', 'SEND R', 'PHONES', 'XLR OUT L', 'XLR OUT R'], outs: [] }, jackKinds: { i4: 'phones', i5: 'xlr', i6: 'xlr' }, ioMap: { i4: [0, 1], i5: [0], i6: [1] }, controls: [], fixedNode: true }),
];
