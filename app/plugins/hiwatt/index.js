// Built-in Tone Zone plugin: Hiwatt.
// Blocks inspired by Hiwatt gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.hiwatt', name: 'High-Watt 103', ref: 'Hiwatt DR103', opts: { model: 'hiwatt' }, tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'black', logo: 'HIGH-WATT', logoFont: "'Oswald', sans-serif", logoColor: '#f0f0f0', knob: 'chrome', controls: [k('gain', 'NORMAL VOL'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('presence', 'PRESENCE'), k('master', 'MASTER')] }))
  ]);
}
