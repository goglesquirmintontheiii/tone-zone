// Built-in Tone Zone plugin: TC Electronic.
// Blocks inspired by TC Electronic gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    def({
      id: 'tc.polytune3', name: 'PolyTone 3', ref: 'TC Electronic PolyTune 3', brand: 'TC Electronic', code: 'PT3', cat: 'Utility', form: 'polytune', color: '#1d1e21', text: '#ececec',
      algo: 'tuner', opts: { mute: 1 },
      controls: [SCREEN('polytune', { x: 72, y: 68, w: 108, h: 84 }), BTN('TUNING', { x: 30, y: 16, r: 4, shape: 'rect', w: 18, h: 7, cycle: 'tuning', labelPos: 'below' }), BTN('DISPLAY', { x: 114, y: 16, r: 4, shape: 'rect', w: 18, h: 7, cycle: 'tunerDisplay', labelPos: 'below' }),
        FOOT({ style: 'stomp', x: 72, y: 196, r: 13 })],
      defaultBypass: true, tunerBlock: true, polyDefault: true,
      desc: 'Strum all strings for polyphonic view; play one note for chromatic. DISPLAY toggles needle / strobe.',
    })
  ]);
}
