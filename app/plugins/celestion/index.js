// Built-in Tone Zone plugin: Celestion.
// Blocks inspired by Celestion gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    CAB({ id: 'cab.2x12cream', name: '2x12 Cream', ref: '2x12 Celestion Creamback', opts: { model: '2x12cream' }, cabSize: '2x12', grille: 'wheat', logo: 'TZ 212', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
    CAB({ id: 'cab.1x12open', name: '1x12 Open Blue', ref: 'Open-back 1x12 Alnico Blue', opts: { model: '1x12open' }, cabSize: '1x12', grille: 'diamond', logo: 'Chime', logoColor: '#eee' }),

    // ---------------- v0.2
    CAB({ id: 'celestion.cab-g12h4x12', name: '4x12 TZ H30', ref: '4x12 Celestion G12H-30', opts: { cab: { hp: 72, hpQ: 1.7, resDb: 5, lp: 5400, peaks: [[110, 1, 2.5], [700, 1, 1.5], [2000, 1.3, 3], [3600, 2, 2.5]], seed: 81 } }, cabSize: '4x12', grille: 'wheat', logo: 'TZ 412 H', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
    CAB({ id: 'celestion.cab-gold1x12', name: '1x12 TZ Gold', ref: '1x12 Celestion Alnico Gold (open back)', opts: { cab: { hp: 100, hpQ: 0.9, resDb: 2, lp: 6400, open: true, peaks: [[900, 1, 1.5], [2400, 1.3, 3], [4800, 2, 2]], seed: 82, detail: 2 } }, cabSize: '1x12', grille: 'wheat', logo: 'TZ Gold', logoFont: "'Oswald', sans-serif", logoColor: '#7a5a12' }),
    CAB({ id: 'celestion.cab-v30-1x12', name: '1x12 TZ V30', ref: '1x12 Celestion Vintage 30 (closed back)', opts: { cab: { hp: 90, hpQ: 1.4, resDb: 4, lp: 5500, peaks: [[140, 1, 1.5], [1500, 1.2, 2], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 83 } }, cabSize: '1x12', grille: 'black', logo: 'TZ V30', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),
    CAB({ id: 'celestion.cab-g12-65', name: '4x12 TZ 65', ref: '4x12 Celestion G12-65', opts: { cab: { hp: 70, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2.5], [450, 1, 1.5], [1800, 1.3, 2.5], [3200, 1.8, 1.5]], seed: 84 } }, cabSize: '4x12', grille: 'black', logo: 'TZ 412 65', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),
  ]);
}
