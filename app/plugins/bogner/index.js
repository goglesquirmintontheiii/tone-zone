// Built-in Tone Zone plugin: Bogner.
// Blocks inspired by Bogner gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.uber', name: 'Uber Schall', ref: 'Bogner Überschall', opts: { model: 'uber' }, tolex: '#141414', panel: '#141414', panelText: '#d9d9d9', grille: 'black', logo: 'Bogart', logoColor: '#d9d9d9', knob: 'chrome', controls: marshallKnobs('GAIN', 'VOLUME') })),
    CAB({ id: 'cab.4x12uber', name: '4x12 Uber V30', ref: 'Bogner Überkab 4x12', opts: { model: '4x12uber' }, cabSize: '4x12', grille: 'black', logo: 'Bogart', logoColor: '#ddd' })
  ]);
}
