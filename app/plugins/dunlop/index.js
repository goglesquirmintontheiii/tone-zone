// Built-in Tone Zone plugin: Dunlop.
// Blocks inspired by Dunlop gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    def({
      id: 'dn.gcb95', name: 'Weep Baby Wah', ref: 'Dunlop Cry Baby GCB95', brand: 'Dunlop', code: 'WB-95', cat: 'Filter', form: 'treadle', color: '#121214',
      algo: 'wah', opts: { fLo: 350, fHi: 2200, q: 5.2, mode: 0 },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 })],
      logo: 'Weep Baby', logoColor: '#d8d8d8', toeSwitch: true,
      desc: 'Drag the treadle (heel ↔ toe). Click the treadle without dragging to click the toe switch on/off.',
    })
  ]);
}
