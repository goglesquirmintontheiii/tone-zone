// Built-in Tone Zone plugin: Markbass.
// Blocks inspired by Markbass gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.markbass', name: 'Bassmark Little', ref: 'Markbass Little Mark', cat: 'Bass Amp', opts: { model: 'markbass' }, tolex: '#1a1a1a', panel: '#1a1a1a', panelText: '#f5d000', grille: 'black', headGrille: false, logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', knob: 'mxr',
      controls: [k('gain', 'GAIN'), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'MASTER')] })),
    CAB({ id: 'cab.2x10horn', name: '2x10 Neo + Horn', ref: 'Markbass-style 2x10 neo', opts: { model: '2x10horn' }, cabSize: '2x10', grille: 'black', logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', bass: true })
  ]);
}
