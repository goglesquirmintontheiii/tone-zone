// Built-in Tone Zone plugin: Ibanez.
// Blocks inspired by Ibanez gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    NINE({
      id: 'ib.ts9', name: 'GD9 Green Drive', ref: 'Ibanez TS9 Tube Screamer', code: 'GD9', logo: 'GREEN DRIVE', cat: 'Overdrive', color: '#2f8c46', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 723, postLp: 5000, levelMaxDb: 6, outTrim: 1.1 },
      controls: [K('gain', 'DRIVE', { display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { display: ten })],
    }),
    NINE({
      id: 'ib.ts808', name: 'GD808 Green Drive Pro', ref: 'Ibanez TS808 Tube Screamer', code: 'GD808', logo: 'GREEN DRIVE PRO', cat: 'Overdrive', color: '#5e9a45', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 700, postLp: 4600, levelMaxDb: 4 },
      controls: [K('gain', 'OVERDRIVE', { display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { display: ten })],
    }),
    NINE({
      id: 'ib.ad9', name: 'AE9 Analog Echo', ref: 'Ibanez AD9', code: 'AE9', logo: 'ANALOG ECHO', cat: 'Delay', color: '#7a5a3a', text: '#f0e6d6',
      algo: 'delay', opts: { maxMs: 400 }, fixed: { mode: 1, tone: 0.3 }, ports: { ins: ['IN'], outs: ['OUT', 'DRY OUT'] },
      controls: [K('time', 'DELAY TIME', { min: 10, max: 300, def: 220, display: ms }), K('feedback', 'REPEAT', { def: 0.35, max: 1.0 }), K('mix', 'DELAY LEVEL', { def: 0.45 })],
    }),
    NINE({
      id: 'ib.cs9', name: 'SC9 Stereo Chorus', ref: 'Ibanez CS9', code: 'SC9', logo: 'STEREO CHORUS', cat: 'Modulation', color: '#b39ad6', text: '#151515',
      algo: 'chorus', opts: { invertR: true }, ports: { ins: ['INPUT'], outs: ['NORMAL', 'INVERTED'] }, stereo: 'fixed', fixed: { mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.35 }), K('depth', 'WIDTH', { def: 0.55 })],
    }),
    NINE({
      id: 'ib.fl9', name: 'FL9X Flanger', ref: 'Ibanez FL9', code: 'FL9X', logo: 'FLANGER', cat: 'Modulation', color: '#f4d21e', text: '#151515',
      algo: 'flanger', controls: [K('speed', 'SPEED', { def: 0.3, r: 10 }), K('regen', 'REGEN', { def: 0.5, r: 10 }), K('width', 'WIDTH', { def: 0.6, r: 10 }), K('manual', 'D.TIME', { def: 0.4, r: 10 })],
    })
  ]);
}
