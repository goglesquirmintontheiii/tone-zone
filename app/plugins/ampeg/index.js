// Built-in Tone Zone plugin: Ampeg.
// Blocks inspired by Ampeg gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.svt', name: 'Super Valve Bass', ref: 'Ampeg SVT Classic', cat: 'Bass Amp', opts: { model: 'svt' }, tolex: '#151515', panel: '#c7cbd0', panelText: '#121212', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#f0f0f0', logoPlate: '#2a4f9a', knob: 'mesa',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDRANGE'), k('midfreq', 'FREQUENCY'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'ULTRA LO', ['OFF', 'ON']), TOG('ultrahi', 'ULTRA HI', ['OFF', 'ON'])] })),
    preampPair(AMP({ id: 'amp.b15', name: 'Portaflux B15', ref: 'Ampeg B-15 Portaflex', cat: 'Bass Amp', opts: { model: 'b15' }, combo: true, speakers: 1, tolex: '#2c3d5a', panel: '#c7cbd0', panelText: '#121212', grille: 'silver', logo: 'Portaflux', logoColor: '#e8e8e8', knob: 'chicken', controls: [k('gain', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('master', 'MASTER', { def: 0.6 })] })),
    CAB({ id: 'cab.8x10svt', name: '8x10 Fridge', ref: 'Ampeg SVT-810E', opts: { model: '8x10svt' }, cabSize: '8x10', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#eee', logoPlate: '#2a4f9a', bass: true }),
    CAB({ id: 'cab.1x15bass', name: '1x15 Bass', ref: 'Ampeg B-15 / 1x15', opts: { model: '1x15bass' }, cabSize: '1x15', tolex: '#2c3d5a', grille: 'silver', logo: 'Portaflux', logoColor: '#eee', bass: true })
  ]);
}
