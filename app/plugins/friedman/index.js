// Built-in Tone Zone plugin: Friedman.
// Blocks inspired by Friedman gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.friedman', name: 'Freed BE-100', ref: 'Friedman BE-100', opts: { model: 'friedman' }, tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'black', logo: 'Freed', logoColor: '#e0e0e0', knob: 'chrome', controls: [...marshallKnobs('GAIN', 'MASTER'), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] }))
  ]);
}
