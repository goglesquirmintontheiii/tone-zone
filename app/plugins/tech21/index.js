// Built-in Tone Zone plugin: Tech 21.
// Blocks inspired by Tech 21 gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    def({ id: 'pre.sansamp', name: 'BassDrive DI', ref: 'Tech 21 SansAmp Bass Driver DI', cat: 'Preamp', form: 'tz', color: '#202020', text: '#e9e9e9', logo: 'BASS DRIVE', typeName: 'Bass preamp', knob: 'chrome',
        algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 30, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 80, midF: 2800, trebleF: 4500, midQ: 0.9, postLp: 9000, levelMaxDb: 8 },
        controls: [K('level', 'LEVEL'), K('blend', 'BLEND', { def: 0.7 }), K('treble', 'TREBLE'), K('bass', 'BASS'), K('mid', 'PRESENCE'), K('gain', 'DRIVE', { def: 0.35 }), FOOT(), LED()] }),
    def({ id: 'pre.gtamp', name: 'Amp in a Box', ref: 'Tech 21 SansAmp GT2', cat: 'Preamp', form: 'tz', color: '#1f1f1f', text: '#e9e9e9', logo: 'AMP-IN-BOX', typeName: 'Guitar preamp', knob: 'chrome',
        algo: 'drive', opts: { clip: 'tube', stages: 2, bias: 0.25, gainMinDb: 4, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3500, postLp: 6000, levelMaxDb: 6,
          modes: [{ postEq: [{ type: 'peak', f: 1200, q: 0.8, db: 3 }] }, { postEq: [{ type: 'peak', f: 700, q: 0.8, db: 2 }, { type: 'lp', f: 4800, q: 0.7, db: 0 }] }, { postEq: [{ type: 'peak', f: 500, q: 0.9, db: -3 }] }] },
        controls: [K('level', 'LEVEL'), K('treble', 'HIGH'), K('bass', 'LOW'), K('gain', 'DRIVE'), { t: 'sel', p: 'mode', label: 'AMP', options: ['CALI', 'TWEED', 'BRIT'], sweep: 100, def: 2 }, FOOT(), LED({ color: '#3ddc84' })] })
  ]);
}
