// Built-in Tone Zone plugin: Gallien-Krueger.
// Blocks inspired by Gallien-Krueger gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.gk800', name: 'GK 800 Bass', ref: 'Gallien-Krueger 800RB', cat: 'Bass Amp', opts: { model: 'gk800' }, tolex: '#151515', panel: '#151515', panelText: '#e8e8e8', grille: 'black', headGrille: false, logo: 'GK 800', logoFont: "'Oswald', sans-serif", logoColor: '#e0e0e0', knob: 'mxr',
      controls: [k('gain', 'VOLUME'), k('presence', 'CONTOUR'), k('treble', 'TREBLE'), k('mid', 'HI MID'), k('midfreq', 'LO MID'), k('bass', 'BASS'), k('master', 'MASTER')] }))
  ]);
}
