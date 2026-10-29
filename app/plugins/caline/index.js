// Built-in Tone Zone plugin: Caline.
// Mini pedals inspired by Caline gear: small aluminium boxes with a full-face picture. Names and artwork are
// Tone Zone originals; control layouts and colours follow the real units (see each block's `ref`).
import { installMini } from './mini.js';

export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
  installMini(tz, 'caline-mini', { rx: 6, knob: 'white', artBleed: true, logoFont: "'Dancing Script', cursive", logoSize: 14 });

  const C = (o) => def(Object.assign({ form: 'caline-mini', brand: 'Caline', cost: 0.5, ports: { ins: ['IN'], outs: ['OUT'] } }, o, {
    controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#ff2a1a' })],
  }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));

  tz.addDefs([
    C({
      id: 'caline.puresky', name: 'Clear Sky Drive', ref: 'Caline CP-12 Pure Sky Overdrive', logo: 'Clear Sky', typeName: 'Transparent overdrive', cat: 'Overdrive',
      color: '#7cc3ea', text: '#0e2a3a', art: { kind: 'clouds', c1: '#ffffff', bg: '#9fd6f4' },
      algo: 'drive', opts: { clip: 'diode', preHp: 40, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, levelMaxDb: 6,
        modes: [{ clip: 'asym' }, { clip: 'diode' }] },
      fixed: { mid: 0.5 },
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.45 }), k('treble', 'TREBLE'), k('bass', 'BASS', { def: 0.55 }), TOG('mode', '', ['ASYM', 'SYM'], { def: 1 })],
      desc: 'Clear, open overdrive with bass and treble controls and a clipping switch.',
    }),
    C({
      id: 'caline.orangeburst', name: 'Citrus Flare Drive', ref: 'Caline CP-18 Orange Burst Overdrive', logo: 'Citrus Flare', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#f08a1c', text: '#2a1300', art: { kind: 'burst', c1: '#ffd27a', c2: '#c95a00', bg: '#f5a040' },
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, stages: 2, stage2Db: 6, preHp: 80, gainMinDb: 6, gainMaxDb: 42, tone: 'lp', toneLo: 1300, toneHi: 9000, postLp: 8000, levelMaxDb: 4, outTrim: 0.6 },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'GAIN', { def: 0.5 })],
      desc: 'Hot, crunchy amp-style overdrive with plenty of gain on tap.',
    }),
    C({
      id: 'caline.blueocean', name: 'Deep Tide Delay', ref: 'Caline CP-19 Blue Ocean Delay', logo: 'Deep Tide', typeName: 'Delay', cat: 'Delay',
      color: '#1f5fa8', text: '#eaf3ff', art: { kind: 'waves', c1: '#bfe3ff', c2: '#ffffff', bg: '#2a73c4' },
      algo: 'delay', opts: { maxMs: 650 }, fixed: { mode: 1, tone: 0.4 },
      controls: [k('mix', 'ECHO', { def: 0.42 }), k('feedback', 'F.BACK', { def: 0.38, max: 1.0 }), K('time', 'TIME', { min: 20, max: 600, def: 320, display: ms })],
      desc: 'Warm analog-voiced echo up to 600 ms.',
    }),
    C({
      id: 'caline.pegasus', name: 'Skyhorse Drive', ref: 'Caline CP-43 Pegasus Overdrive', logo: 'Skyhorse', typeName: 'Transparent overdrive', cat: 'Overdrive',
      color: '#e9e4d6', text: '#2b2414', knob: 'mxr', art: { kind: 'wing', c1: '#c9a64e', c2: '#8a6a24', bg: '#f3efe3' },
      algo: 'drive', opts: { clip: 'ge', bias: 0.1, cleanSum: true, cleanMix: 0.6, clipHp: 400, gainMinDb: 0, gainMaxDb: 34, tone: 'tilt', trebleF: 1600, eqRangeDb: 8, postLp: 9500, levelMaxDb: 10 },
      controls: [k('gain', 'GAIN', { def: 0.35 }), k('tone', 'TREBLE'), k('level', 'OUTPUT')],
      desc: 'Clean-blend overdrive in the style of the famous golden horse pedal.',
    }),
    C({
      id: 'caline.puffer', name: 'Blowfish Fuzz', ref: 'Caline CP-11 Puffer Fuzz', logo: 'Blowfish', typeName: 'Fuzz', cat: 'Fuzz',
      color: '#e2c33a', text: '#2a2205', knob: 'mxr', art: { kind: 'rings', c1: '#3a8fc4', c2: '#ffffff', bg: '#eed25a' },
      algo: 'drive', opts: { clip: 'ge', bias: 0.32, gainMinDb: 14, gainMaxDb: 44, tone: 'none', postLp: 6500, levelMaxDb: 2, outTrim: 0.6 },
      controls: [k('level', 'VOLUME'), k('gain', 'FUZZ', { def: 0.7 })],
      desc: 'Two-knob germanium-style fuzz. Roll back your guitar volume to clean up.',
    }),
    C({
      id: 'caline.cacti', name: 'Prickly Pear Drive', ref: 'Caline CP-20 Crazy Cacti Overdrive', logo: 'Prickly Pear', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#3d8a4a', text: '#f0fff2', art: { kind: 'cactus', c1: '#1f5a2a', c2: '#ffcf4a', bg: '#e9cf9a' },
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 600, gainMinDb: 2, gainMaxDb: 42, tone: 'ts', toneLo: 800, postLp: 5200, levelMaxDb: 6 },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'DRIVE', { def: 0.5 })],
      desc: 'Mid-rich overdrive for leads and pushing an amp.',
    }),
    C({
      id: 'caline.pressuretank', name: 'Boiler Comp', ref: 'Caline CP-47 Pressure Tank Compressor', logo: 'Boiler', typeName: 'Compressor', cat: 'Dynamics',
      color: '#8b9096', text: '#111417', knob: 'mxr', art: { kind: 'gear', c1: '#3b3f44', c2: '#c9ced4', bg: '#a8adb3' },
      algo: 'comp', opts: { type: 'ota' },
      controls: [k('level', 'VOLUME', { def: 0.4 }), k('sustain', 'COMP', { def: 0.5 }), k('attack', 'ATTACK', { def: 0.3 })],
      desc: 'Squashy pedal compressor with volume, amount and attack.',
    }),
    C({
      id: 'caline.osmium', name: 'Heavy Metal Element', ref: 'Caline CP-501 Osmium Distortion', logo: 'Element 76', typeName: 'Distortion', cat: 'Distortion',
      color: '#3a3e44', text: '#e6ebf0', knob: 'mxr', art: { kind: 'mountains', c1: '#6b737d', c2: '#c4ccd6', bg: '#262a2f' },
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 12, preHp: 110, gainMinDb: 12, gainMaxDb: 52, tone: 'lp', toneLo: 1200, toneHi: 8500, postLp: 7500, levelMaxDb: 2, outTrim: 0.4 },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'GAIN', { def: 0.55 })],
      desc: 'Tight high-gain distortion for modern rock and metal.',
    }),
    C({
      id: 'caline.wonderland', name: 'Dreamland Verb', ref: 'Caline CP-508 Wonderland Ambient Reverb', logo: 'Dreamland', typeName: 'Ambient reverb', cat: 'Reverb',
      color: '#5a3d8f', text: '#f1eaff', art: { kind: 'moon', c1: '#ffe9a8', c2: '#ffffff', bg: '#2c1f4d' }, led: '#3d8bff',
      algo: 'reverb', fixed: { size: 0.8 },
      controls: [k('mix', 'MIX', { def: 0.4 }), k('decay', 'DECAY', { def: 0.6 }), k('tone', 'TONE', { def: 0.55 }),
        TOG('mode', '', ['HALL', 'SHIM', 'CLOUD'], { values: [1, 4, 5], def: 0 })],
      desc: 'Big ambient reverb: hall, shimmer or a soft cloud wash.',
    }),
  ]);
}
