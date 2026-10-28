// Built-in Tone Zone plugin: Marshall.
// Blocks inspired by Marshall gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.plexi', name: 'Brit Plexi 100', ref: 'Marshall 1959 Super Lead', opts: { model: 'plexi' }, tolex: '#161616', panel: '#c9a64e', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall',
      controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'VOLUME I'), k('master', 'VOLUME II', { def: 0.65 }), TOG('bright', 'BRIGHT', ['HI', 'LO'], { values: [1, 0] })] })),
    preampPair(AMP({ id: 'amp.jcm800', name: 'Brit 800', ref: 'Marshall JCM800 2203', opts: { model: 'jcm800' }, tolex: '#161616', panel: '#c9a64e', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall', controls: marshallKnobs() })),
    preampPair(AMP({ id: 'amp.jubilee', name: 'Silver Jubilant', ref: 'Marshall Silver Jubilee 2555', opts: { model: 'jubilee' }, tolex: '#cfd2d6', panel: '#c6c9cd', panelText: '#121212', grille: 'black', logo: 'Marsh', logoColor: '#f4f4f4', logoPlate: '#121212', knob: 'chrome', controls: marshallKnobs('INPUT GAIN', 'OUTPUT') })),
    CAB({ id: 'cab.4x12gb', name: '4x12 Brit Greenback', ref: 'Marshall 1960B G12M Greenback', opts: { model: '4x12gb' }, cabSize: '4x12', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212' }),
    CAB({ id: 'cab.4x12t75', name: '4x12 Brit T75', ref: 'Marshall 1960A G12T-75', opts: { model: '4x12t75' }, cabSize: '4x12', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212' })
  ]);
}
