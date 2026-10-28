// Built-in Tone Zone plugin: Celestion.
// Blocks inspired by Celestion gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    CAB({ id: 'cab.2x12cream', name: '2x12 Cream', ref: '2x12 Celestion Creamback', opts: { model: '2x12cream' }, cabSize: '2x12', grille: 'wheat', logo: 'TZ 212', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
    CAB({ id: 'cab.1x12open', name: '1x12 Open Blue', ref: 'Open-back 1x12 Alnico Blue', opts: { model: '1x12open' }, cabSize: '1x12', grille: 'diamond', logo: 'Chime', logoColor: '#eee' })
  ]);
}
