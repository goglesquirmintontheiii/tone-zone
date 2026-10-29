// Built-in Tone Zone plugin: Donner.
// Mini pedals inspired by Donner gear. Names and artwork are Tone Zone originals; control layouts and colours
// follow the real units (see each block's `ref`).
import { installMini } from './mini.js';

export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
  installMini(tz, 'donner-mini', { rx: 5, knob: 'mxr', logoFont: "'Oswald', sans-serif", band: 'top' });

  const D = (o) => def(Object.assign({ form: 'donner-mini', brand: 'Donner', cost: 0.5, ports: { ins: ['IN'], outs: ['OUT'] } }, o, {
    controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#3d8bff' })],
  }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));

  tz.addDefs([
    D({
      id: 'donner.morpher', name: 'Shapeshift Distortion', ref: 'Donner Morpher Distortion', logo: 'SHAPESHIFT', typeName: 'Distortion', cat: 'Distortion',
      color: '#c4222b', text: '#fbeaea', art: { kind: 'bolt', c1: '#ffd9d9', c2: '#7a1016' }, led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 8, preHp: 90, gainMinDb: 8, gainMaxDb: 48, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 8000, levelMaxDb: 4, outTrim: 0.42,
        modes: [{ preHp: 220, preEq: [{ type: 'peak', f: 700, q: 0.8, db: -3 }] }, {}, { preHp: 50, stages: 1, gainMaxDb: 42 }] },
      controls: [k('level', 'LEVEL'), k('tone', 'TONE'), k('gain', 'GAIN', { def: 0.55 }), TOG('mode', '', ['TIGHT', 'NORM', 'OPEN'], { def: 1 })],
      desc: 'Tight, focused distortion with a three-way voice switch.',
    }),
    D({
      id: 'donner.yellowfall', name: 'Amber Drop Delay', ref: 'Donner Yellow Fall Analog Delay', logo: 'AMBER DROP', typeName: 'Analog delay', cat: 'Delay',
      color: '#f2c218', text: '#2a2003', art: { kind: 'drop', c1: '#2a2003', c2: '#8a6a00' },
      algo: 'delay', opts: { maxMs: 650 }, fixed: { mode: 1, tone: 0.32, moddepth: 0.08 },
      controls: [k('mix', 'ECHO', { def: 0.42 }), k('feedback', 'FEEDBACK', { def: 0.38, max: 1.0 }), K('time', 'TIME', { min: 20, max: 620, def: 320, display: ms })],
      desc: 'Dark, warm bucket-brigade style echo from 20 to 620 ms.',
    }),
    D({
      id: 'donner.bluesdrive', name: 'Blue Hour Drive', ref: 'Donner Blues Drive', logo: 'BLUE HOUR', typeName: 'Blues overdrive', cat: 'Overdrive',
      color: '#2a63c6', text: '#eef3ff', art: { kind: 'moon', c1: '#dfe8ff', c2: '#ffffff' },
      algo: 'drive', opts: { clip: 'jfet', bias: 0.2, preHp: 50, gainMinDb: 0, gainMaxDb: 40, tone: 'tilt', trebleF: 1800, bassF: 160, eqRangeDb: 9, postLp: 9500, levelMaxDb: 8, cleanSum: true, cleanMix: 0.25 },
      controls: [k('level', 'LEVEL'), k('tone', 'TONE'), k('gain', 'GAIN', { def: 0.45 })],
      desc: 'Touch-sensitive blues overdrive in the style of the classic blue compact.',
    }),
    D({
      id: 'donner.darkmouse', name: 'Night Rodent', ref: 'Donner Dark Mouse Distortion', logo: 'NIGHT RODENT', typeName: 'Distortion', cat: 'Distortion',
      color: '#1b1b1d', text: '#ececec', art: { kind: 'mouse', c1: '#cfcfcf', c2: '#ff3b30' }, led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 64, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4, outTrim: 0.5 },
      controls: [k('level', 'VOLUME'), k('tone', 'FILTER'), k('gain', 'DIST', { def: 0.5 })],
      desc: 'Op-amp distortion. FILTER works backwards: turn it up for a darker sound.',
    }),
    D({
      id: 'donner.tuttilove', name: 'Sweetheart Chorus', ref: 'Donner Tutti Love Chorus', logo: 'SWEETHEART', typeName: 'Analog chorus', cat: 'Modulation',
      color: '#e8769f', text: '#2b0d18', art: { kind: 'waves', c1: '#ffffff', c2: '#a8325c' },
      algo: 'chorus', opts: { style: 'bbd' }, fixed: { mode: 0 },
      controls: [k('mix', 'LEVEL', { def: 0.5 }), k('rate', 'RATE', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.5 })],
      desc: 'Lush analog-voiced chorus.',
    }),
    D({
      id: 'donner.echosquare', name: 'Echo Block 7', ref: 'Donner Echo Square 7-Mode Delay', logo: 'ECHO BLOCK', typeName: '7 mode delay', cat: 'Delay',
      color: '#2d3a50', text: '#e6edf7', accent: '#5ec8ff', art: { kind: 'rings', c1: '#5ec8ff', c2: '#93a7c4' },
      algo: 'delay', opts: { maxMs: 1000 },
      controls: [k('mix', 'LEVEL', { def: 0.4 }), k('feedback', 'F.BACK', { def: 0.35, max: 1.0 }), K('time', 'TIME', { min: 20, max: 1000, def: 380, display: ms }),
        SEL('dmode', 'MODE', ['ANA', 'TAPE', 'DIG', 'MOD', 'REV', 'LOFI', 'VERB'], { def: 0, sweep: 240, printLabels: true, optSize: 3.3, labelRadius: 4.5 })],
      derive: (p) => {
        const m = [1, 2, 0, 4, 5, 3, 10][p.dmode ?? 0];
        return { mode: m, tone: m === 1 ? 0.35 : m === 2 ? 0.45 : 0.7, moddepth: m === 4 ? 0.4 : 0.05, age: 0.3 };
      },
      desc: 'Seven delays: analog, tape, digital, modulated, reverse, lo-fi and echo with reverb.',
    }),
    D({
      id: 'donner.verbsquare', name: 'Verb Block 7', ref: 'Donner Verb Square Reverb', logo: 'VERB BLOCK', typeName: '7 mode reverb', cat: 'Reverb',
      color: '#3b2d61', text: '#efe9ff', accent: '#c7a6ff', art: { kind: 'dots', c1: '#c7a6ff', c2: '#7e64b8' },
      algo: 'reverb',
      controls: [k('mix', 'LEVEL', { def: 0.35 }), k('tone', 'TONE', { def: 0.55 }), k('decay', 'DECAY', { def: 0.5 }),
        SEL('mode', 'MODE', ['ROOM', 'HALL', 'PLATE', 'SPRG', 'MOD', 'SHIM', 'CLOUD'], { values: [0, 1, 2, 3, 6, 4, 5], def: 1, sweep: 240, printLabels: true, optSize: 3.3, labelRadius: 4.5 })],
      desc: 'Seven reverbs from a small room to shimmer and cloud.',
    }),
    D({
      id: 'donner.ultimatecomp', name: 'Squeeze Comp', ref: 'Donner Ultimate Comp', logo: 'SQUEEZE', typeName: 'Compressor', cat: 'Dynamics',
      color: '#2f9c6a', text: '#effff6', art: { kind: 'stripes', c1: '#bff0d6', c2: '#1d6b47' },
      algo: 'comp', opts: { type: 'ota' },
      controls: [k('level', 'VOLUME', { def: 0.4 }), k('tone', 'EQ', { def: 0.5 }), k('sustain', 'COMP', { def: 0.5 }), TOG('attack', '', ['NORM', 'FAST'], { values: [0.35, 0.08] })],
      desc: 'Simple OTA compressor with an EQ knob and normal / fast attack.',
    }),
    D({
      id: 'donner.noisekiller', name: 'Hush Gate', ref: 'Donner Noise Killer', logo: 'HUSH GATE', typeName: 'Noise gate', cat: 'Dynamics',
      color: '#cfd2d6', text: '#151515', brushed: true, art: { kind: 'scope', c1: '#151515' }, led: '#3ddc84',
      algo: 'gate',
      controls: [k('threshold', 'THRESHOLD', { def: 0.4 }), TOG('mode', '', ['SOFT', 'HARD'])],
      derive: (p) => ({ decay: p.mode ? 0.2 : 0.55 }),
      desc: 'Noise gate with one threshold knob. HARD closes faster.',
    }),
    D({
      id: 'donner.stylishfuzz', name: 'Dapper Fuzz', ref: 'Donner Stylish Fuzz', logo: 'DAPPER FUZZ', typeName: 'Fuzz', cat: 'Fuzz',
      color: '#7a2f8e', text: '#fbeeff', art: { kind: 'fur', c1: '#e7b6f5', c2: '#c38ad6' },
      algo: 'drive', opts: { clip: 'si', bias: 0.3, preHp: 70, gainMinDb: 14, gainMaxDb: 46, tone: 'lp', toneLo: 900, toneHi: 7000, postLp: 7500, levelMaxDb: 2, outTrim: 0.5 },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'FUZZ', { def: 0.65 })],
      desc: 'Thick silicon fuzz with a tone control.',
    }),
  ]);
}
