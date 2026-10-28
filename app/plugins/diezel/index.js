// Built-in Tone Zone plugin: Diezel.
// Blocks inspired by Diezel gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.vh4', name: 'Teutonic V4', ref: 'Diezel VH4', opts: { model: 'vh4' }, tolex: '#141414', panel: '#202020', panelText: '#e0e0e0', grille: 'black', logo: 'DIESL', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', knob: 'chrome', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME'), k('depth', 'DEEP'), k('presence', 'PRESENCE')] }))
  ]);
}
