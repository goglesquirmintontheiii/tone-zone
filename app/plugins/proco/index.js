// Built-in Tone Zone plugin: ProCo.
// Blocks inspired by ProCo gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    def({
      id: 'pc.rat2', name: 'Rodent 2', ref: 'ProCo RAT2', brand: 'ProCo', code: 'DISTORTION', cat: 'Distortion', form: 'rat', color: '#151515', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 67, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4 },
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten }), FOOT(), LED()],
      desc: 'FILTER is reverse-acting like the original: clockwise = darker.',
    })
  ]);
}
