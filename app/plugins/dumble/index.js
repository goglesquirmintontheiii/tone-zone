// Built-in Tone Zone plugin: Dumble.
// Blocks inspired by Dumble gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.dumble', name: 'Smooth ODS', ref: 'Dumble Overdrive Special', opts: { model: 'dumble' }, tolex: '#151515', panel: '#1c1c1c', panelText: '#e0e0e0', grille: 'wheat', logo: 'Smooth', logoColor: '#e8d8a8', knob: 'chrome',
      controls: [k('gain', 'DRIVE'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('master', 'MASTER'), k('presence', 'PRESENCE')] }))
  ]);
}
