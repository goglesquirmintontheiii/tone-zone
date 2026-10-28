// Built-in Tone Zone plugin: Peavey.
// Blocks inspired by Peavey gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.5150', name: 'PV 5051', ref: 'Peavey 5150 / EVH', opts: { model: '5150' }, tolex: '#141414', panel: '#141414', panelText: '#e0e0e0', grille: 'black', logo: '5051', logoFont: "'Oswald', sans-serif", logoColor: '#d33', knob: 'chrome',
      controls: [k('gain', 'PRE GAIN'), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'POST GAIN'), k('depth', 'RESONANCE'), k('presence', 'PRESENCE')] }))
  ]);
}
