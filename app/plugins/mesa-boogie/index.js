// Built-in Tone Zone plugin: Mesa/Boogie.
// Blocks inspired by Mesa/Boogie gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.recto', name: 'Cali Rectifire', ref: 'Mesa/Boogie Dual Rectifier', opts: { models: ['recto_clean', 'recto'] }, tolex: '#151515', panel: '#b9bec5', panelText: '#111', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', knob: 'mesa',
      controls: [k('gain', 'GAIN'), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CH', ['CLEAN', 'MODERN'], { def: 1 })] })),
    preampPair(AMP({ id: 'amp.markiic', name: 'Cali Mark IIC', ref: 'Mesa/Boogie Mark IIC+', opts: { model: 'markiic' }, combo: true, speakers: 1, tolex: '#2a2016', panel: '#151515', panelText: '#e8e8e8', grille: 'black', logo: 'Boogaloo', logoColor: '#e0c890', knob: 'mesa',
      controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('master', 'MASTER'), k('presence', 'PRESENCE')] })),
    CAB({ id: 'cab.4x12v30', name: '4x12 Cali V30', ref: 'Mesa Rectifier 4x12 V30', opts: { model: '4x12v30' }, cabSize: '4x12', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' })
  ]);
}
