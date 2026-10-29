// Built-in Tone Zone plugin: Nobels.
// The green natural overdrive family inspired by Nobels gear. Names are Tone Zone originals; colours and control
// layouts follow the real units (see each block's `ref`).
import { installMini } from './mini.js';

export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { stomp } = tz.builders;
  installMini(tz, 'nobels-mini', { rx: 5, knob: 'mxr', logoFont: "'Oswald', sans-serif" });
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));

  // natural overdrive: soft asymmetric clipping, SPECTRUM tilts from warm to bright with a mid push
  const odr = { clip: 'asym', bias: 0.12, preHp: 60, gainMinDb: 2, gainMaxDb: 40, tone: 'tilt', trebleF: 1400, bassF: 250, eqRangeDb: 8, postLp: 7500, levelMaxDb: 6,
    preEq: [{ type: 'peak', f: 900, q: 0.8, db: 2.5 }] };

  tz.addDefs([
    stomp({
      id: 'nobels.odr1', name: 'ODN-1 Natural Drive', ref: 'Nobels ODR-1 Natural Overdrive', brand: 'Nobels', code: 'ODN-1', logo: 'ODN-1', typeName: 'Natural overdrive', cat: 'Overdrive',
      color: '#2e6a33', text: '#f3f1d8', accent: '#e9d64a', knob: 'mxr',
      algo: 'drive', opts: odr,
      controls: [k('gain', 'DRIVE', { def: 0.45 }), k('tone', 'SPECTRUM'), k('level', 'LEVEL')],
      desc: 'The studio-favourite green overdrive. SPECTRUM sweeps from warm and round to bright and cutting.',
    }),
    stomp({
      id: 'nobels.odr1bc', name: 'ODN-1 BC Natural Drive', ref: 'Nobels ODR-1 BC Natural Overdrive (Bass Cut)', brand: 'Nobels', code: 'ODN-1 BC', logo: 'ODN-1 BC', typeName: 'Natural overdrive', cat: 'Overdrive',
      color: '#2b6431', text: '#f3f1d8', accent: '#e9d64a', knob: 'mxr',
      algo: 'drive', opts: Object.assign({}, odr, { modes: [{}, { preHp: 160 }] }),
      controls: [k('gain', 'DRIVE', { def: 0.45 }), k('tone', 'SPECTRUM'), k('level', 'LEVEL'), TOG('mode', 'BASS CUT', ['OFF', 'ON'])],
      desc: 'The green natural overdrive with a bass cut switch for tighter low end.',
    }),
    def({
      id: 'nobels.odrmini', name: 'ODN Mini Natural Drive', ref: 'Nobels ODR-mini Natural Overdrive', brand: 'Nobels', logo: 'ODN MINI', typeName: 'Natural overdrive', cat: 'Overdrive', form: 'nobels-mini',
      color: '#2e6a33', text: '#f3f1d8', accent: '#e9d64a', ports: { ins: ['IN'], outs: ['OUT'] }, art: { kind: 'rings', c1: '#e9d64a', c2: '#9fbf5a' },
      algo: 'drive', opts: odr,
      controls: [k('gain', 'DRIVE', { def: 0.45 }), k('tone', 'SPECTRUM'), k('level', 'LEVEL'), FOOT(), LED({ color: '#ff2a1a' })],
      desc: 'The green natural overdrive in a mini box.',
    }),
  ]);
}
