// Built-in Tone Zone plugin: Matchless.
// Blocks inspired by Matchless gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.dc30', name: 'Matchbox 30', ref: 'Matchless DC-30', opts: { model: 'dc30' }, combo: true, speakers: 2, tolex: '#151515', panel: '#2b2b2b', panelText: '#f2f2f2', grille: 'salt', logo: 'Matchbox', logoColor: '#d8d8d8', knob: 'chicken',
      controls: [k('gain', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] }))
  ]);
}
