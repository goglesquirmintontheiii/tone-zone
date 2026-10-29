// Built-in Tone Zone plugin: Tone City.
// Mini pedals inspired by Tone City gear: small matte boxes with a hand-drawn picture. Names and artwork are
// Tone Zone originals; control layouts and colours follow the real units (see each block's `ref`).
import { installMini } from './mini.js';

export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  installMini(tz, 'tonecity-mini', { rx: 7, knob: 'boss', logoFont: "'Barlow Condensed', sans-serif", logoItalic: true, logoSize: 12 });

  const T = (o) => def(Object.assign({ form: 'tonecity-mini', brand: 'Tone City', cost: 0.5, ports: { ins: ['IN'], outs: ['OUT'] } }, o, {
    controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#ff2a1a' })],
  }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
  const drv = (p = 'GAIN', d = 0.5) => [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', p, { def: d })];

  tz.addDefs([
    T({
      id: 'tonecity.kaffirlime', name: 'Zesty Lime Drive', ref: 'Tone City Kaffir Lime Overdrive', logo: 'ZESTY LIME', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#8cc63f', text: '#16260a', art: { kind: 'lime', c1: '#a6d84a', c2: '#3c7a1c' },
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 700, postLp: 4800, levelMaxDb: 6 },
      controls: drv('GAIN', 0.45),
      desc: 'Classic green mid-hump overdrive.',
    }),
    T({
      id: 'tonecity.goldenplexi', name: 'Gilded Stack', ref: 'Tone City Golden Plexi Distortion', logo: 'GILDED STACK', typeName: 'Plexi distortion', cat: 'Distortion',
      color: '#c9a03c', text: '#231a05', art: { kind: 'crown', c1: '#fff1b8', c2: '#6a4c0a' },
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, stages: 2, stage2Db: 10, preHp: 80, gainMinDb: 4, gainMaxDb: 42, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 8500, levelMaxDb: 4, outTrim: 0.5 },
      controls: drv('GAIN', 0.55),
      desc: 'Cranked British plexi crunch in a box.',
    }),
    T({
      id: 'tonecity.sweetcream', name: 'Velvet Cream Drive', ref: 'Tone City Sweet Cream Overdrive', logo: 'VELVET CREAM', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#efe3c4', text: '#3a2a12', art: { kind: 'swirl', c1: '#b07a3a' },
      algo: 'drive', opts: { clip: 'asym', bias: 0.12, preHp: 60, gainMinDb: 0, gainMaxDb: 34, tone: 'lp', toneLo: 1500, toneHi: 11000, postLp: 9500, levelMaxDb: 8 },
      controls: drv('GAIN', 0.45),
      desc: 'Smooth, open low-gain overdrive that keeps your amp tone.',
    }),
    T({
      id: 'tonecity.badhorse', name: 'Wild Stallion Drive', ref: 'Tone City Bad Horse Overdrive', logo: 'WILD STALLION', typeName: 'Transparent overdrive', cat: 'Overdrive',
      color: '#25385e', text: '#e9eefa', art: { kind: 'horseshoe', c1: '#d6b25c', c2: '#25385e' },
      algo: 'drive', opts: { clip: 'ge', bias: 0.1, cleanSum: true, cleanMix: 0.6, clipHp: 400, gainMinDb: 0, gainMaxDb: 34, tone: 'tilt', trebleF: 1600, eqRangeDb: 8, postLp: 9500, levelMaxDb: 10 },
      controls: [k('level', 'VOLUME'), k('tone', 'TREBLE'), k('gain', 'GAIN', { def: 0.35 })],
      desc: 'Clean-blend boost and overdrive in the style of the golden centaur.',
    }),
    T({
      id: 'tonecity.wildfire', name: 'Bushfire Distortion', ref: 'Tone City Wild Fire Distortion', logo: 'BUSHFIRE', typeName: 'Distortion', cat: 'Distortion',
      color: '#c3271d', text: '#fff0e6', art: { kind: 'flame', c1: '#ffb02e', c2: '#ffe36b' },
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 46, clipLp: 9000, tone: 'blend', blendLp: 650, blendHp: 1150, postLp: 7500, levelMaxDb: 4, outTrim: 0.5 },
      controls: drv('GAIN', 0.55),
      desc: 'Bright, aggressive diode distortion.',
    }),
    T({
      id: 'tonecity.kingofblues', name: 'Blues Monarch', ref: 'Tone City King of Blues Overdrive', logo: 'BLUES MONARCH', typeName: 'Blues overdrive', cat: 'Overdrive',
      color: '#2f6fb7', text: '#eef4ff', art: { kind: 'rings', c1: '#9cc8ff', c2: '#ffffff' },
      algo: 'drive', opts: { clip: 'jfet', bias: 0.2, preHp: 50, gainMinDb: 0, gainMaxDb: 40, tone: 'tilt', trebleF: 1800, bassF: 160, eqRangeDb: 9, postLp: 9500, levelMaxDb: 8, cleanSum: true, cleanMix: 0.25 },
      controls: drv('GAIN', 0.45),
      desc: 'Dynamic blues overdrive that cleans up with your picking.',
    }),
    T({
      id: 'tonecity.compengine', name: 'Squash Motor', ref: 'Tone City Comp Engine Compressor', logo: 'SQUASH MOTOR', typeName: 'Compressor', cat: 'Dynamics',
      color: '#e8e8e4', text: '#1a1a1a', art: { kind: 'gear', c1: '#444', c2: '#e8e8e4' },
      algo: 'comp', opts: { type: 'ota' },
      controls: [k('level', 'VOLUME', { def: 0.4 }), k('sustain', 'COMP', { def: 0.5 }), TOG('attack', '', ['FAST', 'SLOW'], { values: [0.1, 0.45], def: 1 })],
      desc: 'Classic pedal squash with a fast / slow attack switch.',
    }),
    T({
      id: 'tonecity.tinyspring', name: 'Little Coil Reverb', ref: 'Tone City Tiny Spring Reverb', logo: 'LITTLE COIL', typeName: 'Spring reverb', cat: 'Reverb',
      color: '#2a9b9a', text: '#eafffe', art: { kind: 'spring', c1: '#eafffe' }, led: '#3d8bff',
      algo: 'reverb', opts: { mode: 3 }, fixed: { mode: 3 },
      controls: [k('mix', 'MIX', { def: 0.35 }), k('decay', 'DECAY', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 })],
      desc: 'Drippy spring reverb.',
    }),
    T({
      id: 'tonecity.angelwing', name: 'Halo Feather Chorus', ref: 'Tone City Angel Wing Chorus', logo: 'HALO FEATHER', typeName: 'Analog chorus', cat: 'Modulation',
      color: '#f3f0f7', text: '#2a2338', art: { kind: 'wing', c1: '#b9a7d9', c2: '#7e6aa6' }, led: '#3d8bff',
      algo: 'chorus', opts: { style: 'bbd' }, fixed: { mode: 0, mix: 0.5 },
      controls: [k('rate', 'RATE', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.5 }), k('tone', 'TONE', { def: 0.5 })],
      desc: 'Soft, warm analog-style chorus.',
    }),
  ]);
}
