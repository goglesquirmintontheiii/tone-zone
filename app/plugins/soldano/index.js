// Built-in Tone Zone plugin: Soldano.
// Blocks inspired by Soldano gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.slo', name: 'Solo 100', ref: 'Soldano SLO-100', opts: { model: 'slo' }, tolex: '#141414', panel: '#c7ccd2', panelText: '#121212', grille: 'black', logo: 'Solo', logoColor: '#e4e6e8', knob: 'chrome', controls: marshallKnobs('PREAMP', 'MASTER') }))
  ]);
}
