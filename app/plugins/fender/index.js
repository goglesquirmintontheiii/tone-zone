// Built-in Tone Zone plugin: Fender.
// Blocks inspired by Fender gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    preampPair(AMP({ id: 'amp.deluxe', name: 'US Deluxe 65', ref: 'Fender Deluxe Reverb', opts: { model: 'deluxe' }, combo: true, speakers: 1, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Delux', logoColor: '#e9e9e9', knob: 'fender', controls: [...fenderKnobs(false), TOG('bright', 'BRIGHT', ['OFF', 'ON'])], desc: 'Classic blackface clean that breaks up when pushed.' })),
    preampPair(AMP({ id: 'amp.twin', name: 'US Twin 65', ref: 'Fender Twin Reverb', opts: { model: 'twin' }, combo: true, speakers: 2, tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'silver', logo: 'Twain', logoColor: '#e9e9e9', knob: 'fender', controls: [...fenderKnobs(true), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] })),
    preampPair(AMP({ id: 'amp.bassman', name: 'Tweed Bassmaster', ref: 'Fender 1959 Bassman', opts: { model: 'bassman' }, combo: true, speakers: 2, tolex: '#c8b27c', panel: '#c9c1ad', panelText: '#2a1d10', grille: 'brown', logo: 'Bassmaster', logoColor: '#efe6d0', knob: 'chicken', piping: '#5a3a1a',
      controls: [k('presence', 'PRESENCE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('gain', 'VOLUME'), k('master', 'MASTER', { def: 0.65 })] })),
    CAB({ id: 'cab.1x12us', name: '1x12 US Deluxe', ref: 'Fender Deluxe 1x12 (Jensen)', opts: { model: '1x12us' }, cabSize: '1x12', grille: 'silver', logo: 'Delux', logoColor: '#eee' }),
    CAB({ id: 'cab.2x12twin', name: '2x12 US Twin', ref: 'Fender Twin 2x12', opts: { model: '2x12twin' }, cabSize: '2x12', grille: 'silver', logo: 'Twain', logoColor: '#eee' }),
    CAB({ id: 'cab.4x10tweed', name: '4x10 Tweed', ref: 'Fender Bassman 4x10', opts: { model: '4x10tweed' }, cabSize: '4x10', tolex: '#c8b27c', grille: 'brown', logo: 'Bassmaster', piping: '#5a3a1a' })
  ]);
}
