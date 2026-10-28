// Built-in Tone Zone plugin: Darkglass.
// Blocks inspired by Darkglass gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    def({ id: 'pre.b7k', name: 'Dark Bass Pre', ref: 'Darkglass Microtubes B7K', cat: 'Preamp', form: 'tz', color: '#5c5f63', text: '#111', logo: 'DARK B7', typeName: 'Bass preamp', knob: 'mxr',
        algo: 'drive', opts: { clip: 'mosfet', bias: 0.15, preHp: 60, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', useHiMid: true, eqRangeDb: 12, bassF: 80, midF: 500, hiMidF: 1500, trebleF: 5000, postLp: 10000, levelMaxDb: 8 },
        controls: [K('level', 'MASTER'), K('blend', 'BLEND', { def: 0.6 }), K('gain', 'DRIVE', { def: 0.5 }), K('bass', 'BASS'), K('mid', 'LO MIDS'), K('himid', 'HI MIDS'), K('treble', 'TREBLE'), FOOT(), LED({ color: '#ff2a1a' })] })
  ]);
}
