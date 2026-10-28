// Built-in Tone Zone plugin: Roland.
// Blocks inspired by Roland gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.jc120', name: 'Jazz Clean 120', ref: 'Roland JC-120', opts: { model: 'jc120' }, combo: true, speakers: 2, tolex: '#191919', panel: '#c4c8cc', panelText: '#121212', grille: 'black', logo: 'Jazz Clean', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', knob: 'mxr', controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] })),
    CAB({ id: 'cab.2x12jc', name: '2x12 Jazz Clean', ref: 'Roland JC-120 2x12', opts: { model: '2x12jc' }, cabSize: '2x12', grille: 'black', logo: 'Jazz Clean', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' })
  ]);
}
