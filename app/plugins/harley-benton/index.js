// Built-in Tone Zone plugin: Harley Benton.
// MiniStomp series pedals inspired by Harley Benton gear: small boxes with a dark switch deck at the toe.
// Names and artwork are Tone Zone originals; control layouts follow the real units (see each block's `ref`).
import { installMini } from './mini.js';

export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
  installMini(tz, 'hb-ministomp', { rx: 5, knob: 'mxr', band: 'bottom', bandColor: '#17181a', logoFont: "'Oswald', sans-serif", artFrame: false });

  const H = (o) => def(Object.assign({ form: 'hb-ministomp', brand: 'Harley Benton', cost: 0.5, ports: { ins: ['IN'], outs: ['OUT'] } }, o, {
    controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#ff2a1a' })],
  }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
  const drv = (g = 'GAIN', d = 0.5) => [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', g, { def: d })];

  tz.addDefs([
    H({
      id: 'hb.greentint', name: 'Mint Shade Drive', ref: 'Harley Benton MiniStomp Green Tint', logo: 'MINT SHADE', typeName: 'Vintage overdrive', cat: 'Overdrive',
      color: '#4f9a52', text: '#f0fff0', art: { kind: 'stripes', c1: '#8fd18f', c2: '#2f6b33' },
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 700, postLp: 4600, levelMaxDb: 6 },
      controls: drv('DRIVE', 0.45),
      desc: 'Green mid-hump overdrive for leads and stacking.',
    }),
    H({
      id: 'hb.dealbreaker', name: 'Deal Off Drive', ref: 'Harley Benton MiniStomp Dealbreaker', logo: 'DEAL OFF', typeName: 'Blues overdrive', cat: 'Overdrive',
      color: '#d9b22e', text: '#1e1703', art: { kind: 'dots', c1: '#1e1703', c2: '#8a6d10' },
      algo: 'drive', opts: { clip: 'si', preHp: 70, gainMinDb: 2, gainMaxDb: 36, tone: 'lp', toneLo: 1400, toneHi: 10000, postLp: 9000, levelMaxDb: 6 },
      controls: drv('GAIN', 0.45),
      desc: 'Open, amp-like overdrive in the style of the British blues box.',
    }),
    H({
      id: 'hb.rodent', name: 'Rat Pack Distortion', ref: 'Harley Benton MiniStomp Rodent', logo: 'RAT PACK', typeName: 'Vintage distortion', cat: 'Distortion',
      color: '#1d1d1f', text: '#efefef', art: { kind: 'mouse', c1: '#bdbdbd', c2: '#ff3b30' },
      algo: 'drive', opts: { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 64, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4, outTrim: 0.5,
        modes: [{}, { clip: 'led', levelMaxDb: 2 }, { clip: 'si', bias: 0.2 }] },
      controls: [k('gain', 'DIST', { def: 0.5 }), k('tone', 'FILTER'), k('level', 'VOLUME'), TOG('mode', '', ['I', 'II', 'III'])],
      desc: 'Three takes on the classic op-amp distortion. FILTER turns darker clockwise.',
    }),
    H({
      id: 'hb.plexicon', name: 'Plexitone', ref: 'Harley Benton MiniStomp Plexicon', logo: 'PLEXITONE', typeName: 'Amp overdrive', cat: 'Overdrive',
      color: '#c99a3f', text: '#1f1504', art: { kind: 'stripes', c1: '#f0d79a', c2: '#8a6420' },
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, stages: 2, stage2Db: 10, preHp: 80, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 8500, levelMaxDb: 4, outTrim: 0.55 },
      controls: drv('GAIN', 0.5),
      desc: 'Plexi-style British crunch.',
    }),
    H({
      id: 'hb.bigfur', name: 'Shaggy Fuzz', ref: 'Harley Benton MiniStomp Big Fur', logo: 'SHAGGY', typeName: 'Fuzz', cat: 'Fuzz',
      color: '#6e4a2c', text: '#f6eadc', art: { kind: 'fur', c1: '#c8a07a', c2: '#e8cfb3' },
      algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 18, preHp: 80, gainMinDb: 20, gainMaxDb: 52, tone: 'blend', blendLp: 450, blendHp: 1100, postLp: 9000, levelMaxDb: 2, outTrim: 0.55 },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'SUSTAIN', { def: 0.6 })],
      desc: 'Thick, sustaining wall-of-fuzz.',
    }),
    H({
      id: 'hb.fuzzylogic', name: 'Fuzz Theory', ref: 'Harley Benton MiniStomp Fuzzy Logic', logo: 'FUZZ THEORY', typeName: 'Germanium fuzz', cat: 'Fuzz',
      color: '#b8261f', text: '#fff0ec', art: { kind: 'rings', c1: '#ffd1c8', c2: '#7a120d' },
      algo: 'drive', opts: { clip: 'ge', bias: 0.32, gainMinDb: 14, gainMaxDb: 44, tone: 'none', postLp: 6500, levelMaxDb: 2, outTrim: 0.6 },
      controls: [k('level', 'VOLUME'), k('gain', 'FUZZ', { def: 0.7 })],
      desc: 'Round, warm germanium fuzz. Cleans up with your guitar volume.',
    }),
    H({
      id: 'hb.drd', name: 'Doc Dee Drive', ref: 'Harley Benton MiniStomp Dr. D', logo: 'DOC DEE', typeName: 'Dynamic overdrive', cat: 'Overdrive',
      color: '#2b2e5c', text: '#eceeff', art: { kind: 'swirl', c1: '#b3b8ff' },
      algo: 'drive', opts: { clip: 'tube', bias: 0.15, preHp: 70, gainMinDb: 2, gainMaxDb: 38, tone: 'tilt', trebleF: 1500, bassF: 180, eqRangeDb: 9, postLp: 8500, levelMaxDb: 6,
        preEq: [{ type: 'peak', f: 700, q: 0.7, db: 2.5 }] },
      controls: drv('DRIVE', 0.45),
      desc: 'Smooth, touch-sensitive overdrive in the style of famous boutique amps.',
    }),
    H({
      id: 'hb.dropkick', name: 'Stomp Kick Distortion', ref: 'Harley Benton MiniStomp Drop Kick', logo: 'STOMP KICK', typeName: 'High-gain distortion', cat: 'Distortion',
      color: '#2a2a2c', text: '#f28c28', accent: '#f28c28', art: { kind: 'bolt', c1: '#f28c28', c2: '#1a1a1a' },
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 14, preHp: 110, gainMinDb: 12, gainMaxDb: 54, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 2800, postLp: 7500, levelMaxDb: 2, outTrim: 0.4 },
      fixed: { mid: 0.45 },
      controls: [k('level', 'VOLUME'), k('bass', 'LOW'), k('treble', 'HIGH'), k('gain', 'GAIN', { def: 0.55 })],
      desc: 'Tight, saturated high-gain distortion with low and high EQ.',
    }),
    H({
      id: 'hb.edgy', name: 'Sharp Echo', ref: 'Harley Benton MiniStomp Edgy', logo: 'SHARP ECHO', typeName: 'Digital delay', cat: 'Delay',
      color: '#cfd3d8', text: '#141414', brushed: true, art: { kind: 'rings', c1: '#2b6cb0', c2: '#8a96a6' }, led: '#3d8bff',
      algo: 'delay', opts: { maxMs: 838 },
      controls: [k('mix', 'LEVEL', { def: 0.4 }), k('feedback', 'F.BACK', { def: 0.35, max: 1.0 }), K('time', 'TIME', { min: 30, max: 838, def: 380, display: ms }), TOG('mod', '', ['DIG', 'MOD'])],
      derive: (p) => ({ mode: p.mod ? 4 : 0, moddepth: p.mod ? 0.35 : 0, tone: 0.75 }),
      desc: 'Clean digital delay up to 838 ms with optional modulation.',
    }),
    H({
      id: 'hb.deepblue', name: 'Abyss Reverb', ref: 'Harley Benton MiniStomp Deep Blue', logo: 'ABYSS', typeName: 'Digital reverb', cat: 'Reverb',
      color: '#173b78', text: '#e8f0ff', art: { kind: 'waves', c1: '#7fb3ff', c2: '#c6dbff' }, led: '#3d8bff',
      algo: 'reverb',
      controls: [k('mix', 'LEVEL', { def: 0.35 }), k('tone', 'TONE', { def: 0.55 }), k('decay', 'DECAY', { def: 0.5 }), TOG('mode', '', ['ROOM', 'HALL', 'PLATE'], { values: [0, 1, 2], def: 1 })],
      desc: 'Room, hall or plate reverb.',
    }),
    H({
      id: 'hb.shaft', name: 'Funk Tube Wah', ref: 'Harley Benton MiniStomp Shaft', logo: 'FUNK TUBE', typeName: 'Auto-wah', cat: 'Wah',
      color: '#8a3fb3', text: '#f8eeff', art: { kind: 'scope', c1: '#f0d6ff' },
      algo: 'wah', opts: { mode: 2, fLo: 300, fHi: 2400 }, fixed: { mode: 2, level: 0.34 },
      controls: [k('sens', 'SENS', { def: 0.55 }), k('q', 'PEAK', { def: 0.55 }), TOG('filter', '', ['LP', 'BP', 'HP'], { def: 1 })],
      desc: 'Envelope filter: the harder you pick, the more it opens. Three filter types.',
    }),
    H({
      id: 'hb.aliensignal', name: 'Space Static', ref: 'Harley Benton MiniStomp Alien Signal', logo: 'SPACE STATIC', typeName: 'Bit crusher', cat: 'Synth',
      color: '#53c27a', text: '#0b2614', art: { kind: 'dots', c1: '#0b2614', c2: '#e0ffe9' },
      algo: 'chain', cost: 0.4,
      opts: { chain: [{ prefix: 'c', algo: 'crusher' }, { prefix: 'f', algo: 'peq' }] },
      controls: [k('c.bits', 'BITS', { def: 0.45 }), k('c.rate', 'RATE', { def: 0.35 }), k('c.mix', 'MIX', { def: 0.7 }), TOG('flt', '', ['LPF', 'OFF', 'HPF'], { def: 1 })],
      derive: (p) => ({ 'f.lowcut': p.flt === 2 ? 600 : 20, 'f.highcut': p.flt === 0 ? 2500 : 20000 }),
      desc: 'Lo-bit and sample-rate crusher with a low-pass or high-pass filter.',
    }),
  ]);
}
