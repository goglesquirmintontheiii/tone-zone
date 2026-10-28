// Built-in Tone Zone plugin: Vox.
// Blocks inspired by Vox gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.ac30', name: 'Brit 30 Top Boost', ref: 'Vox AC30 Top Boost', opts: { model: 'ac30' }, combo: true, speakers: 2, tolex: '#1a1a1a', panel: '#7a4a2a', panelText: '#f1e3c8', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', logoPlate: '#1a1a1a', knob: 'vox', piping: '#c9b37a',
      controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] })),
    CAB({ id: 'cab.2x12blue', name: '2x12 Brit Blue', ref: 'Vox AC30 2x12 Alnico Blue', opts: { model: '2x12blue' }, cabSize: '2x12', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", piping: '#c9b37a' })
  ]);
}
