// Built-in Tone Zone plugin: Maxon.
// 9-series and 808 style pedals inspired by Maxon gear. Names are Tone Zone originals; enclosures, colours and
// control layouts follow the real units (see each block's `ref`).
//
// Form `maxon-nine`: the built-in 9-series box, with extra layout for 4-knob units and units with mini toggles.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
  const { formKit } = tz.gfx;

  const row = (list, x0, x1, y) => list.forEach((c, i) => {
    c.x = list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1);
    c.y = y;
  });

  tz.addForm('maxon-nine', (ctx, d) => {
    const w = 150;
    const knobs = d.controls.filter((c) => c.t === 'knob' && (c.x === undefined || c._auto));
    const tg = d.controls.filter((c) => c.t === 'toggle' && (c.x === undefined || c._auto));
    if (knobs.length >= 4 || tg.length) {
      knobs.forEach((c) => (c._auto = true));
      if (knobs.length >= 4) {
        row(knobs, 24, w - 24, 36);
        knobs.forEach((c) => { c.r = 10; c.labelSize = 6; });
      } else if (knobs.length === 3) {
        row(knobs, 32, w - 32, 38);
        knobs.forEach((c, i) => { c.r = i === 1 ? 10 : 13; c.labelSize = 6.4; });
      } else {
        const m = tg.length === 2 ? 30 : 38;
        row(knobs, knobs.length === 1 ? w / 2 : m, knobs.length === 1 ? w / 2 : w - m, 40);
        knobs.forEach((c) => { c.r = tg.length === 2 ? 12 : 13; c.labelSize = 6.6; });
      }
      knobs.forEach((c) => { c.style = c.style || 'nine'; c.labelPos = 'below'; });
      tg.forEach((t, i) => {
        t._auto = true;
        t.orient = 'h';
        t.optSize = 4.6;
        const pair = knobs.length === 2 && tg.length === 2;
        t.y = pair ? 46 : knobs.length >= 4 ? 70 : 68;
        t.x = tg.length === 1 ? w / 2 : knobs.length >= 4 ? [w * 0.28, w * 0.72][i] : w / 2 + (i ? 1 : -1) * (pair ? 16 : 22);
      });
    }
    return formKit.callForm('nine', ctx, d);
  });

  const MX = (o) => def(Object.assign({ form: 'maxon-nine', brand: 'Maxon' }, o, { controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#ff2a1a' })] }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
  const ts = { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 700, postLp: 4600, levelMaxDb: 8 };

  tz.addDefs([
    MX({
      id: 'maxon.od808', name: 'MD808 Overdrive', ref: 'Maxon OD808 Overdrive', code: 'MD808', logo: 'OVER DRIVE', cat: 'Overdrive', color: '#4f8f41', text: '#f2f2f2',
      algo: 'drive', opts: ts,
      controls: [k('gain', 'OVERDRIVE', { def: 0.45 }), k('tone', 'TONE'), k('level', 'LEVEL')],
      desc: 'The original green mid-hump overdrive circuit, by the people who designed it.',
    }),
    MX({
      id: 'maxon.od808x', name: 'MD808X Overdrive Extreme', ref: 'Maxon OD808X Overdrive Extreme', code: 'MD808X', logo: 'OD EXTREME', cat: 'Overdrive', color: '#364a34', text: '#e8f2e4', plate: '#1b1d1b', plateText: '#d9e8d2',
      algo: 'drive', opts: Object.assign({}, ts, { gainMaxDb: 48, postLp: 5600, cleanMix: 0.18, outTrim: 0.7 }),
      controls: [k('gain', 'OVERDRIVE', { def: 0.5 }), k('tone', 'TONE'), k('level', 'LEVEL')],
      desc: 'Green overdrive with more gain and a tighter, more open top end.',
    }),
    MX({
      id: 'maxon.od9', name: 'MD9 Overdrive', ref: 'Maxon OD9 Overdrive', code: 'MD9', logo: 'OVERDRIVE', cat: 'Overdrive', color: '#3d8a52', text: '#f2f2f2',
      algo: 'drive', opts: Object.assign({}, ts, { postLp: 5400, levelMaxDb: 6 }),
      controls: [k('gain', 'DRIVE', { def: 0.45 }), k('tone', 'TONE'), k('level', 'LEVEL')],
      desc: 'Nine-series green overdrive: a little brighter than the 808.',
    }),
    MX({
      id: 'maxon.sd9', name: 'MS9 Sonic Distortion', ref: 'Maxon SD9 Sonic Distortion', code: 'MS9', logo: 'SONIC DIST', cat: 'Distortion', color: '#c8323c', text: '#fff0f0',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 120, gainMinDb: 10, gainMaxDb: 48, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 7500, levelMaxDb: 4, outTrim: 0.45 },
      controls: [k('gain', 'DISTORTION', { def: 0.55 }), k('tone', 'TONE'), k('level', 'LEVEL')],
      desc: 'Crunchy, mid-forward distortion with tight lows.',
    }),
    MX({
      id: 'maxon.ad9pro', name: 'ME9 Pro Analog Delay', ref: 'Maxon AD9 Pro Analog Delay', code: 'ME9 PRO', logo: 'ANALOG DELAY', cat: 'Delay', color: '#25292f', text: '#e8eaee', plate: '#c9ccd1',
      algo: 'delay', opts: { maxMs: 900 }, fixed: { mode: 1, tone: 0.32, modrate: 0.25 }, ports: { ins: ['IN'], outs: ['OUT', 'DRY OUT'] },
      controls: [k('dtime', 'DELAY TIME', { def: 0.5, virtual: true }), k('feedback', 'REPEAT', { def: 0.35, max: 1.0 }), k('mix', 'D.LEVEL', { def: 0.45 }), k('moddepth', 'MOD', { def: 0.15 }),
        TOG('range', '', ['SHORT', 'LONG'], { def: 0 })],
      derive: (p) => { const r = p.range ? [300, 900] : [30, 300]; return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.5) }; },
      desc: 'All-analog bucket-brigade delay up to 900 ms with modulation and a dry out.',
    }),
    MX({
      id: 'maxon.cp9pro', name: 'MC9 Pro+ Compressor', ref: 'Maxon CP9 Pro+ Compressor', code: 'MC9 PRO+', logo: 'COMPRESSOR', cat: 'Dynamics', color: '#e2b52a', text: '#1e1704',
      algo: 'comp', opts: { type: 'ota' },
      controls: [k('sustain', 'SUSTAIN', { def: 0.5 }), k('attack', 'ATTACK', { def: 0.35 }), k('level', 'LEVEL', { def: 0.4 })],
      desc: 'Studio-grade pedal compressor with a smooth attack control.',
    }),
    MX({
      id: 'maxon.pac9', name: 'MAC9 Pure Analog Chorus', ref: 'Maxon PAC9 Pure Analog Chorus', code: 'MAC9', logo: 'ANALOG CHORUS', cat: 'Modulation', color: '#6f8fc7', text: '#0b1426',
      algo: 'chorus', opts: { style: 'bbd' }, fixed: { mode: 0, mix: 0.5 },
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'WIDTH', { def: 0.55 }), TOG('tone', 'BRIGHT', ['OFF', 'ON'], { values: [0.45, 0.75] }), TOG('pure', 'PURE', ['OFF', 'ON'])],
      derive: (p) => ({ mix: p.pure ? 0.42 : 0.5, delay: p.pure ? 0.42 : 0.5 }),
      desc: 'All-analog chorus. BRIGHT opens the top end, PURE gives a cleaner, subtler voice.',
    }),
    MX({
      id: 'maxon.pt999', name: 'MP999 Phase Tone', ref: 'Maxon PT999 Phase Tone', code: 'MP999', logo: 'PHASE TONE', cat: 'Modulation', color: '#d9672a', text: '#1f0d02',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.85, mix: 0.5, feedback: 0.3 },
      controls: [k('rate', 'SPEED', { def: 0.35 })],
      desc: 'Classic one-knob four-stage phaser.',
    }),
    MX({
      id: 'maxon.af9', name: 'MF9 Auto Filter', ref: 'Maxon AF9 Auto Filter', code: 'MF9', logo: 'AUTO FILTER', cat: 'Filter', color: '#2d7b8a', text: '#eafcff',
      algo: 'wah', opts: { mode: 2, fLo: 250, fHi: 2600 }, fixed: { mode: 2, level: 0.34 },
      controls: [k('sens', 'SENS', { def: 0.55 }), k('q', 'PEAK', { def: 0.55 }), k('range', 'RANGE', { def: 0.5 }), TOG('direction', '', ['UP', 'DOWN']), TOG('filter', '', ['LP', 'BP'], { values: [0, 1], def: 1 })],
      desc: 'Envelope filter: the harder you pick, the further it sweeps.',
    }),
    MX({
      id: 'maxon.fl9', name: 'MG9 Flanger', ref: 'Maxon FL9 Flanger', code: 'MG9', logo: 'FLANGER', cat: 'Modulation', color: '#7a5aa6', text: '#f3edff',
      algo: 'flanger',
      controls: [k('speed', 'SPEED', { def: 0.3 }), k('width', 'WIDTH', { def: 0.6 }), k('manual', 'MANUAL', { def: 0.5 }), k('regen', 'REGEN', { def: 0.55 })],
      desc: 'Analog jet flanger with manual and regeneration.',
    }),
  ]);
}
