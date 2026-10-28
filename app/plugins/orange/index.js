// Built-in Tone Zone plugin: Orange.
// Blocks inspired by Orange gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.orange', name: 'Citrus Rockerbox', ref: 'Orange Rockerverb', opts: { model: 'orange' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', headGrille: true, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] })),
    preampPair(AMP({ id: 'amp.ad200', name: 'Citrus AD Bass', ref: 'Orange AD200', cat: 'Bass Amp', opts: { model: 'ad200' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] })),
    CAB({ id: 'cab.4x12orange', name: '4x12 Citrus', ref: 'Orange PPC412', opts: { model: '4x12orange' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
    CAB({ id: 'cab.4x12bass', name: '4x12 Bass', ref: 'Orange OBC / 4x12 bass', opts: { model: '4x12bass' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', bass: true })
  ]);
}
