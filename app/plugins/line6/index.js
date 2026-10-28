// Built-in Tone Zone plugin: Line 6.
// Blocks inspired by Line 6 gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  const podAmps = ['deluxe', 'jcm800', 'dc30', 'dumble', 'friedman', 'recto', '5150'];
  const podCabs = ['1x12us', '4x12t75', '2x12blue', '2x12cream', '4x12gb', '4x12v30', '4x12uber'];
  const podExpress = def({
    id: 'l6.podexpress', name: 'Rig X Express', ref: 'Line 6 POD Express', brand: 'Line 6', code: 'RIG X', logo: 'RIG X  EXPRESS', cat: 'Multi-FX', form: 'pod', color: '#c3161c',
    algo: 'chain', stereo: 'stereo', ports: { ins: ['IN'], outs: ['OUT L/MONO', 'OUT RIGHT'] }, cost: 6,
    opts: { chain: [
      { prefix: 'gt', algo: 'gate', params: { threshold: 0.25 } },
      { prefix: 'ds', algo: 'drive', opts: { modes: [{ clip: 'ge', cleanSum: true, gainMaxDb: 24, tone: 'tilt' }, { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40, tone: 'ts', toneLo: 723 }, { clip: 'diode', gainMaxDb: 46, tone: 'blend' }, { clip: 'si', gainMaxDb: 50, tone: 'lp' }] } },
      { prefix: 'amp', algo: 'amp', opts: { models: podAmps } },
      { prefix: 'cab', algo: 'cab', opts: { models: podCabs } },
      { prefix: 'm1', algo: 'chorus', on: false }, { prefix: 'm2', algo: 'flanger', on: false }, { prefix: 'm3', algo: 'phaser', on: false }, { prefix: 'm4', algo: 'tremolo', on: false },
      { prefix: 'dl', algo: 'delay', opts: { maxMs: 2000 } },
      { prefix: 'rv', algo: 'reverb' },
    ] },
    controls: [
      K('dist', 'DIST', { x: 46, y: 50, r: 15, def: 0, virtual: true, alt: 'amp.gain', altLabel: 'GAIN' }),
      K('rev', 'REVERB', { x: 138, y: 50, r: 15, def: 0.3, virtual: true, alt: 'amp.treble', altLabel: 'TREBLE' }),
      K('mod', 'MOD', { x: 46, y: 132, r: 15, def: 0, virtual: true, alt: 'amp.mid', altLabel: 'MID' }),
      K('dly', 'DELAY', { x: 138, y: 132, r: 15, def: 0, virtual: true, alt: 'amp.bass', altLabel: 'BASS' }),
      { t: 'sel', p: 'ampsel', label: 'AMP', options: ['OFF', 'CLEAN', 'SPECIAL', 'CHIME', 'DYNAMIC', 'CRUNCH', 'HEAVY', 'LEAD'], x: 92, y: 90, r: 19, def: 5, sweep: 300, style: 'chrome', printLabels: false, ring: true, labelPos: 'above', alt: 'amp.level', altLabel: 'CH VOL' },
      BTN('ALT', { x: 92, y: 132, shape: 'rect', w: 18, h: 8, action: 'alt', led: true, ledDy: -8, ledColor: '#ffffff' }),
      FOOT({ action: 'bypass', label: 'ON', x: 50, y: 222, r: 12 }),
      FOOT({ action: 'tap', label: 'TAP', x: 134, y: 222, r: 12, tapTarget: 'dl.time' }),
      LED({ x: 50, y: 196, bind: 'on' }), LED({ x: 134, y: 196, bind: 'tap:dl.time' }),
    ],
    initParams: { 'amp.gain': 0.5, 'amp.treble': 0.5, 'amp.mid': 0.5, 'amp.bass': 0.5, 'amp.level': 0, 'dl.time': 400 },
    derive: (p) => {
      const quad = (v) => {
        if (v < 0.03) return [-1, 0];
        const x = (v - 0.03) / 0.97 * 4;
        const q = Math.min(3, Math.floor(x));
        return [q, x - q];
      };
      const o = {};
      const [dq, dv] = quad(p.dist ?? 0);
      o['ds.on'] = dq >= 0 ? 1 : 0;
      o['ds.mode'] = Math.max(0, dq);
      o['ds.gain'] = 0.25 + 0.75 * dv;
      o['ds.level'] = 0.55;
      const a = p.ampsel ?? 5;
      o['amp.on'] = a > 0 ? 1 : 0;
      o['cab.on'] = a > 0 ? 1 : 0;
      o['amp.channel'] = Math.max(0, a - 1);
      o['cab.model'] = Math.max(0, a - 1);
      const [mq, mv] = quad(p.mod ?? 0);
      for (let i = 0; i < 4; i++) o[`m${i + 1}.on`] = mq === i ? 1 : 0;
      o['m1.mix'] = 0.3 + 0.5 * mv; o['m2.mix'] = 0.3 + 0.5 * mv; o['m3.mix'] = 0.3 + 0.5 * mv; o['m4.depth'] = 0.2 + 0.8 * mv;
      const [lq, lv] = quad(Math.min(p.dly ?? 0, 0.999));
      o['dl.on'] = lq >= 0 ? 1 : 0;
      o['dl.mode'] = [1, 0, 2, 7][Math.max(0, lq)];
      o['dl.mix'] = 0.15 + 0.5 * lv;
      o['dl.feedback'] = 0.25 + 0.35 * lv;
      const [rq, rv] = quad(p.rev ?? 0.3);
      o['rv.on'] = rq >= 0 ? 1 : 0;
      o['rv.mode'] = [3, 1, 2, 5][Math.max(0, rq)];
      o['rv.mix'] = 0.15 + 0.45 * rv;
      return o;
    },
    desc: 'Four effect knobs each sweep four models (fully counter-clockwise = off). AMP encoder: 7 amps + off. Press ALT to turn the knobs into GAIN / MID / BASS / TREBLE / CH VOL.',
  });
  tz.addDefs([podExpress]);
  registerModelers(tz);
}


// ---------------------------------------------------------------- classic stompbox modelers (DL4 / MM4 / DM4 / FM4 / M5)
function registerModelers(tz) {
  const { K, SEL, BTN, FOOT, LED, SCREEN, def, ms } = tz.helpers;
  const { svg, label, formKit, shade } = tz.gfx;

  // big 4-switch modeler: model knob on the left, 5 knobs, name band, 4 footswitches, jacks on the back
  tz.addForm('l6-modeler', (ctx, d) => {
    const g = ctx.g, w = 312, h = 200;
    const col = d.color;
    formKit.body(g, w, h, col, { rx: 12 });
    svg('rect', { x: 0, y: 112, width: w, height: h - 112, rx: 12, fill: shade(col, -0.35), opacity: 0.55 }, g);
    svg('rect', { x: 0, y: 110, width: w, height: 3, fill: '#000', opacity: 0.35 }, g);
    const txt = d.text || '#111';
    const theme = { text: txt, knob: 'chrome', labelSize: 6.2 };
    const sel = d.controls.find((c) => c.t === 'sel' && c.x === undefined);
    if (sel) Object.assign(sel, { x: 54, y: 58, r: 15, sweep: 300, optSize: 3.9, labelRadius: 9, labelPos: 'none', style: 'chrome' });
    const knobs = d.controls.filter((c) => c.t === 'knob' && c.x === undefined);
    knobs.forEach((k, i) => Object.assign(k, { x: 122 + i * 42, y: 60, r: 13, labelPos: 'above' }));
    label(g, w / 2 + 34, 98, d.logo, { size: 12, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2.4 });
    label(g, 52, 98, d.typeName.toUpperCase(), { size: 5.2, fill: txt, weight: 800, ls: 1 });
    const ft = shade(col, 0.6);
    const foots = d.controls.filter((c) => c.t === 'foot');
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', x: w * (0.14 + (0.72 * i) / Math.max(1, foots.length - 1)), y: 166, r: 12, labelDy: -24 }));
    d.controls.filter((c) => c.t === 'led' && c.x === undefined).forEach((l, i) => Object.assign(l, { x: foots[i] ? foots[i].x + 22 : w / 2, y: 166, r: 2.8 }));
    formKit.tzBadge(g, w / 2, h - 8, ft, 4.4);
    formKit.placeControls(ctx, d.controls.filter((c) => c.t !== 'foot'), theme);
    formKit.placeControls(ctx, foots, Object.assign({}, theme, { text: ft }));
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });
  // M5-style: LCD on top, model knob + 4 knobs, 2 footswitches
  tz.addForm('l6-m5', (ctx, d) => {
    const g = ctx.g, w = 156, h = 240;
    formKit.body(g, w, h, d.color, { rx: 10 });
    const txt = '#e8e8e8';
    const theme = { text: txt, knob: 'chrome', labelSize: 6 };
    d.controls.forEach((c) => {
      if (c.t === 'screen') Object.assign(c, { x: w / 2, y: 34, w: 132, h: 40, bg: '#0a1410' });
      if (c.t === 'sel') Object.assign(c, { x: w / 2, y: 90, r: 14, labelPos: 'none', printLabels: false, ring: true, sweep: 300 });
    });
    const knobs = d.controls.filter((c) => c.t === 'knob');
    knobs.forEach((k, i) => Object.assign(k, { x: 24 + i * 36, y: 132, r: 10, labelPos: 'below' }));
    label(g, w / 2, 160, d.logo, { size: 11, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2 });
    const foots = d.controls.filter((c) => c.t === 'foot');
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', x: i ? w - 40 : 40, y: 204, r: 12 }));
    d.controls.filter((c) => c.t === 'led').forEach((l, i) => Object.assign(l, { x: i ? w - 40 : 40, y: 180, r: 2.8 }));
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ---- DL4 MkII: 16 delay models, TWEAK / TWEEZ mapped per model
  const DL = [
    ['TUBE ECHO', 2, { heads: 4, age: 0.2, sat: 0.4 }, 'moddepth', 'sat'],
    ['TAPE ECHO', 2, { heads: 4, age: 0.45 }, 'tone', 'moddepth'],
    ['MULTI-HEAD', 2, { age: 0.3 }, 'heads', 'moddepth'],
    ['SWEEP ECHO', 4, {}, 'modrate', 'moddepth'],
    ['ANALOG', 1, { moddepth: 0 }, 'tone', 'sat'],
    ['ANALOG MOD', 1, { moddepth: 0.35 }, 'modrate', 'moddepth'],
    ['LO RES', 3, {}, 'age', 'tone'],
    ['DIGITAL', 0, {}, 'tone', 'lowcut'],
    ['DIGITAL MOD', 4, {}, 'modrate', 'moddepth'],
    ['RHYTHMIC', 0, {}, 'subdiv', 'tone'],
    ['STEREO', 8, {}, 'spread', 'tone'],
    ['PING PONG', 7, {}, 'spread', 'tone'],
    ['REVERSE', 5, {}, 'tone', 'moddepth'],
    ['HELIOSPHERE', 10, {}, 'tone', 'moddepth'],
    ['PITCH ECHO', 6, {}, 'tone', 'moddepth'],
    ['COSMOS', 9, { age: 0.4 }, 'tone', 'moddepth'],
  ];
  const tweakVal = (key, v) => (key === 'heads' ? 1 + Math.round(v * 6) : key === 'subdiv' ? Math.round(v * 4) : v);
  const modelFoot = (extra) => [FOOT({ action: 'bypass', label: 'A · ON' }), FOOT({ action: 'favorite', label: 'B · FAV' }), ...extra];

  tz.addDefs([
    def({
      id: 'l6.dl4mk2', name: 'DL-Four MkII', ref: 'Line 6 DL4 MkII', brand: 'Line 6', code: 'DL-FOUR', logo: 'DELAY  MODELER', typeName: 'Delay select', cat: 'Delay', form: 'l6-modeler', color: '#3f8f33', text: '#0e1a0c',
      algo: 'delay', opts: { maxMs: 2500 }, stereo: 'both', monoPorts: { ins: ['INPUT'], outs: ['OUTPUT'] }, stereoPorts: { ins: ['INPUT L', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] }, cost: 1.2,
      tapTarget: 'time',
      controls: [
        SEL('model', 'DELAY SELECT', ['TUBE', 'TAPE', 'MULTI', 'SWEEP', 'ANALOG', 'A-MOD', 'LO RES', 'DIGITL', 'D-MOD', 'RHYTHM', 'STEREO', 'PING', 'REVERS', 'HELIOS', 'PITCH', 'COSMOS'], { def: 1, virtual: true }),
        K('time', 'TIME', { min: 20, max: 2500, def: 420, curve: 'log', display: ms }), K('feedback', 'REPEATS', { def: 0.4, max: 1.05 }),
        K('tweak', 'TWEAK', { def: 0.5, virtual: true }), K('tweez', 'TWEEZ', { def: 0.4, virtual: true }), K('mix', 'MIX', { def: 0.4 }),
        ...modelFoot([FOOT({ action: 'none', label: 'C · HOLD', hold: { ms: 10, event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), FOOT({ action: 'tap', label: 'TAP' })]),
        LED({ bind: 'on', color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }), LED({ bind: 'on', color: '#ffb020' }), LED({ bind: 'tap:time', color: '#ff2a1a' }),
      ],
      derive: (p) => {
        const m = DL[p.model ?? 1] || DL[1];
        const o = Object.assign({ mode: m[1], heads: 4, age: 0.3, sat: 0.3, moddepth: 0.05, modrate: 0.3, tone: 0.6, spread: 0.5, lowcut: 0, subdiv: 0 }, m[2]);
        o[m[3]] = tweakVal(m[3], p.tweak ?? 0.5);
        o[m[4]] = tweakVal(m[4], p.tweez ?? 0.4);
        return o;
      },
      desc: '16 delay models (vintage tape / tube / analog / digital plus newer ambient voices). TWEAK and TWEEZ change per model (e.g. wow, head pattern, mod speed / depth, brightness). Footswitches: A on/off, B favorite (hold to save), C hold for infinite repeats, TAP tempo.',
    }),
  ]);

  // ---- MM4: modulation modeler (one effect of a chain active at a time)
  const MM = [
    ['OPTO TREM', 't', { 't.mode': 0 }], ['BIAS TREM', 't', { 't.mode': 2 }], ['HARM TREM', 't', { 't.mode': 1 }],
    ['PHASER', 'p', { 'p.stages': 4 }], ['DUAL PHASE', 'p', { 'p.stages': 8 }], ['U-VIBE', 'v', { 'v.mode': 0 }],
    ['ROTARY', 'r', {}], ['ANALOG FLG', 'f', { 'f.mode': 0 }], ['JET FLG', 'f', { 'f.mode': 1 }],
    ['CHORUS', 'c', { 'c.mode': 0 }], ['DIMENSION', 'c', { 'c.mode': 3 }], ['TRI CHORUS', 'c', { 'c.mode': 2 }],
    ['VIBRATO', 'c', { 'c.mode': 1 }], ['RING MOD', 'g', {}],
  ];
  const MMKEYS = ['t', 'p', 'v', 'r', 'f', 'c', 'g'];
  tz.addDefs([def({
    id: 'l6.mm4', name: 'MM-Four', ref: 'Line 6 MM4 Modulation Modeler', brand: 'Line 6', code: 'MM-FOUR', logo: 'MODULATION  MODELER', typeName: 'Model select', cat: 'Modulation', form: 'l6-modeler', color: '#5d3f95', text: '#f2ecff',
    algo: 'chain', stereo: 'both', monoPorts: { ins: ['INPUT'], outs: ['OUTPUT'] }, stereoPorts: { ins: ['INPUT L', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] }, cost: 1.2,
    opts: { chain: [
      { prefix: 't', algo: 'tremolo', on: false }, { prefix: 'p', algo: 'phaser', on: false }, { prefix: 'v', algo: 'vibe', on: false }, { prefix: 'r', algo: 'rotary', on: false },
      { prefix: 'f', algo: 'flanger', on: false }, { prefix: 'c', algo: 'chorus', on: false }, { prefix: 'g', algo: 'ringmod', on: false },
    ] },
    controls: [
      SEL('model', 'MODEL', ['OPTO', 'BIAS', 'HARM', 'PHASER', 'DUAL', 'VIBE', 'ROTO', 'FLG', 'JET', 'CHORUS', 'DIMENS', 'TRI', 'VIBRAT', 'RING'], { def: 9, virtual: true }),
      K('speed', 'SPEED', { def: 0.35, virtual: true }), K('depth', 'DEPTH', { def: 0.55, virtual: true }), K('tweak', 'TWEAK', { def: 0.5, virtual: true }), K('tweez', 'TWEEZ', { def: 0.5, virtual: true }), K('mix', 'MIX', { def: 0.5, virtual: true }),
      ...modelFoot([]), LED({ bind: 'on', color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
    ],
    derive: (p) => {
      const m = MM[p.model ?? 9] || MM[9];
      const s = p.speed ?? 0.35, dp = p.depth ?? 0.55, tw = p.tweak ?? 0.5, tz2 = p.tweez ?? 0.5, mx = p.mix ?? 0.5;
      const o = {};
      MMKEYS.forEach((k) => (o[k + '.on'] = k === m[1] ? 1 : 0));
      Object.assign(o, {
        't.rate': s, 't.depth': dp, 't.wave': tw, 't.level': 0.5,
        'p.rate': s, 'p.depth': dp, 'p.feedback': tw * 0.8, 'p.center': tz2, 'p.mix': mx,
        'v.speed': s, 'v.intensity': dp, 'v.tone': tw, 'v.level': 0.5,
        'r.speed': s > 0.5 ? 1 : 0, 'r.drive': tw * 0.5, 'r.balance': tz2, 'r.mix': mx, 'r.accel': 0.5, 'r.level': 0.5,
        'f.speed': s, 'f.width': dp, 'f.regen': tw, 'f.manual': tz2, 'f.mix': mx,
        'c.rate': s, 'c.depth': dp, 'c.tone': tw, 'c.delay': tz2, 'c.mix': mx,
        'g.freq': s, 'g.fine': tw, 'g.mix': mx,
      }, m[2]);
      return o;
    },
    desc: '14 modulation models (tremolos, phasers, vibe, rotary, flangers, choruses, vibrato, ring mod). SPEED / DEPTH / MIX work on every model; TWEAK and TWEEZ change per model (wave shape, feedback, tone, manual, delay).',
  })]);

  // ---- DM4: distortion modeler (drive voicings switched with the drive `mode` param)
  const eq = { tone: 'eq3', eqRangeDb: 14, bassF: 120, midF: 800, trebleF: 3000 };
  const DM = [
    ['SCREAMER', { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, preHp: 100 }],
    ['CLASSIC DIST', { clip: 'diode', gainMinDb: 10, gainMaxDb: 46, preHp: 90, postLp: 7000 }],
    ['TUBE DRIVE', { clip: 'tube', gainMinDb: 6, gainMaxDb: 42, preHp: 70 }],
    ['OVERDRIVE', { clip: 'asym', gainMinDb: 4, gainMaxDb: 36, preHp: 80 }],
    ['FACIAL FUZZ', { clip: 'ge', gainMinDb: 14, gainMaxDb: 44, preHp: 40, postLp: 5000 }],
    ['FUZZ PI', { clip: 'muff', gainMinDb: 16, gainMaxDb: 50, preHp: 60, postLp: 6000 }],
    ['JUMBO FUZZ', { clip: 'si', gainMinDb: 20, gainMaxDb: 54, preHp: 50, postLp: 4800 }],
    ['HEAVY DIST', { clip: 'si', stages: 2, stage2Db: 16, gainMinDb: 18, gainMaxDb: 58, preHp: 120, postLp: 7200 }],
  ];
  tz.addDefs([def({
    id: 'l6.dm4', name: 'DM-Four', ref: 'Line 6 DM4 Distortion Modeler', brand: 'Line 6', code: 'DM-FOUR', logo: 'DISTORTION  MODELER', typeName: 'Model select', cat: 'Distortion', form: 'l6-modeler', color: '#e4c41c', text: '#1a1604', cost: 0.8,
    algo: 'drive', opts: Object.assign({ levelMaxDb: 2 }, eq, { modes: DM.map((m) => Object.assign({}, eq, m[1])) }),
    controls: [
      SEL('mode', 'MODEL', DM.map((m) => m[0].split(' ')[0].slice(0, 6)), { def: 0 }),
      K('gain', 'DRIVE', { def: 0.5 }), K('bass', 'BASS'), K('mid', 'MID'), K('treble', 'TREBLE'), K('level', 'VOLUME', { def: 0.45 }),
      ...modelFoot([]), LED({ bind: 'on', color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
    ],
    desc: '8 overdrive / distortion / fuzz models with a shared 3-band EQ.',
  })]);

  // ---- FM4: filter modeler (envelope / LFO filters, synths, voice box)
  const FM = [
    ['TRON UP', 'w', { 'w.mode': 2, 'w.direction': 0, 'w.filter': 1 }], ['TRON DOWN', 'w', { 'w.mode': 2, 'w.direction': 1, 'w.filter': 1 }],
    ['SLOW FILTER', 'w', { 'w.mode': 2, 'w.filter': 0 }], ['SEEKER', 'w', { 'w.mode': 1, 'w.filter': 1 }], ['THROBBER', 'w', { 'w.mode': 1, 'w.filter': 0 }],
    ['Q FILTER', 'w', { 'w.mode': 0, 'w.filter': 1 }], ['VOICE BOX', 'b', { 'b.mode': 1 }],
    ['SYNTH-O-MATIC', 's', { 's.mode': 0, 's.octave': 0 }], ['OCTISYNTH', 's', { 's.mode': 1, 's.octave': -1 }], ['SYNTH STRING', 's', { 's.mode': 3, 's.octave': 0 }],
    ['GROWLER', 's', { 's.mode': 5, 's.octave': -1 }], ['COMET TRAILS', 's', { 's.mode': 7, 's.octave': 0 }],
  ];
  tz.addDefs([def({
    id: 'l6.fm4', name: 'FM-Four', ref: 'Line 6 FM4 Filter Modeler', brand: 'Line 6', code: 'FM-FOUR', logo: 'FILTER  MODELER', typeName: 'Model select', cat: 'Filter', form: 'l6-modeler', color: '#e2681c', text: '#1a0c02',
    algo: 'chain', stereo: 'both', monoPorts: { ins: ['INPUT'], outs: ['OUTPUT'] }, stereoPorts: { ins: ['INPUT L', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] }, cost: 1.4,
    opts: { chain: [{ prefix: 'w', algo: 'wah', opts: { fLo: 200, fHi: 2600 } }, { prefix: 'b', algo: 'talkbox', on: false }, { prefix: 's', algo: 'synth', on: false }] },
    controls: [
      SEL('model', 'MODEL', ['T-UP', 'T-DOWN', 'SLOW', 'SEEKER', 'THROB', 'Q FILT', 'VOICE', 'SYNTH', 'OCTI', 'STRING', 'GROWL', 'COMET'], { def: 0, virtual: true }),
      K('speed', 'SPEED', { def: 0.4, virtual: true }), K('freq', 'FREQ', { def: 0.5, virtual: true }), K('q', 'Q', { def: 0.55, virtual: true }), K('mix', 'MIX', { def: 0.7, virtual: true }), K('vol', 'VOLUME', { def: 0.5, virtual: true }),
      ...modelFoot([]), LED({ bind: 'on', color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
    ],
    derive: (p) => {
      const m = FM[p.model ?? 0] || FM[0];
      const sp = p.speed ?? 0.4, f = p.freq ?? 0.5, q = p.q ?? 0.55, mx = p.mix ?? 0.7, v = p.vol ?? 0.5;
      const o = { 'w.on': m[1] === 'w' ? 1 : 0, 'b.on': m[1] === 'b' ? 1 : 0, 's.on': m[1] === 's' ? 1 : 0,
        'w.rate': sp, 'w.sens': sp, 'w.pos': f, 'w.range': f, 'w.q': q, 'w.level': v,
        'b.pos': f, 'b.tone': q, 'b.sens': sp, 'b.volume': v,
        's.mod': sp, 's.filter': f, 's.reso': q, 's.wet': mx, 's.dry': 1 - mx, 's.level': (v - 0.5) * 24, 's.attack': 0.15, 's.decay': 0.6 };
      return Object.assign(o, m[2]);
    },
    desc: '12 filter models: envelope filters, LFO filters, a fixed Q filter, voice box and guitar synths. SPEED = envelope sensitivity / LFO rate / synth modulation, FREQ = filter frequency, MIX blends the synths with the dry guitar.',
  })]);

  // ---- M5: one effect at a time from a mini library, LCD shows model + knob functions
  const M5 = [
    ['SCREAMER', 'd', ['DRIVE', 'TONE', 'LEVEL', '—'], { 'd.mode': 0 }], ['FUZZ PI', 'd', ['DRIVE', 'TONE', 'LEVEL', '—'], { 'd.mode': 1 }], ['HEAVY DIST', 'd', ['DRIVE', 'TONE', 'LEVEL', '—'], { 'd.mode': 2 }],
    ['ANALOG CHORUS', 'c', ['SPEED', 'DEPTH', 'TONE', 'MIX'], {}], ['SCRIPT PHASE', 'p', ['SPEED', 'DEPTH', 'FDBK', 'MIX'], { 'p.stages': 4, 'p.script': 1 }],
    ['JET FLANGER', 'f', ['SPEED', 'DEPTH', 'REGEN', 'MIX'], { 'f.mode': 1 }], ['OPTO TREM', 't', ['SPEED', 'DEPTH', 'WAVE', 'LEVEL'], { 't.mode': 0 }],
    ['ANALOG ECHO', 'e', ['TIME', 'REPEATS', 'TONE', 'MIX'], { 'e.mode': 1 }], ['TAPE ECHO', 'e', ['TIME', 'REPEATS', 'TONE', 'MIX'], { 'e.mode': 2, 'e.heads': 4 }],
    ['SPRING', 'r', ['DECAY', 'TONE', 'PRE-DLY', 'MIX'], { 'r.mode': 3 }], ['HALL', 'r', ['DECAY', 'TONE', 'PRE-DLY', 'MIX'], { 'r.mode': 1 }],
    ['AUTO WAH', 'w', ['SENS', 'RANGE', 'Q', 'LEVEL'], { 'w.mode': 2 }],
  ];
  const M5KEYS = ['e', 'd', 'c', 'p', 'f', 't', 'r', 'w'];
  tz.addScreen('l6-m5', {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, rx: 2, fill: '#0a1410' }, g);
      s.name = svg('text', { x: w / 2, y: 11, fill: '#7dffb8', 'font-family': "'Share Tech Mono', monospace", 'font-size': 10, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      s.parts = [0, 1, 2, 3].map((i) => svg('text', { x: 16 + i * ((w - 32) / 3), y: h - 10, fill: '#7dffb8', opacity: 0.75, 'font-family': "'Share Tech Mono', monospace", 'font-size': 6, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g));
    },
    update(s, st, nv) {
      const m = M5[(nv.block.params.model ?? 3) | 0] || M5[3];
      tz.gfx.setText(s.name, m[0]);
      m[2].forEach((n, i) => tz.gfx.setText(s.parts[i], n));
    },
  });
  tz.addDefs([def({
    id: 'l6.m5', name: 'Modeler Five', ref: 'Line 6 M5 Stompbox Modeler', brand: 'Line 6', code: 'MOD-5', logo: 'MODELER FIVE', cat: 'Multi-FX', form: 'l6-m5', color: '#1c1d20',
    algo: 'chain', stereo: 'both', monoPorts: { ins: ['INPUT'], outs: ['OUTPUT'] }, stereoPorts: { ins: ['INPUT L', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] }, cost: 1.4, tapTarget: 'e.time',
    opts: { chain: [
      { prefix: 'e', algo: 'delay', on: false, opts: { maxMs: 2000 } },
      { prefix: 'd', algo: 'drive', on: false, opts: { levelMaxDb: 2, modes: [{ clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40, tone: 'lp' }, { clip: 'muff', gainMinDb: 16, gainMaxDb: 50, tone: 'lp' }, { clip: 'si', stages: 2, stage2Db: 16, gainMinDb: 18, gainMaxDb: 58, tone: 'lp' }] } },
      { prefix: 'c', algo: 'chorus', on: false }, { prefix: 'p', algo: 'phaser', on: false }, { prefix: 'f', algo: 'flanger', on: false }, { prefix: 't', algo: 'tremolo', on: false },
      { prefix: 'r', algo: 'reverb', on: false }, { prefix: 'w', algo: 'wah', on: false },
    ] },
    controls: [
      SCREEN('l6-m5', {}), SEL('model', 'MODEL', M5.map((m) => m[0]), { def: 3, virtual: true }),
      K('k1', '1', { def: 0.45, virtual: true }), K('k2', '2', { def: 0.5, virtual: true }), K('k3', '3', { def: 0.5, virtual: true }), K('k4', '4', { def: 0.45, virtual: true }),
      FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'tap', label: 'TAP' }), LED({ bind: 'on', color: '#ff2a1a' }), LED({ bind: 'tap:e.time', color: '#3ddc84' }),
    ],
    derive: (p) => {
      const m = M5[p.model ?? 3] || M5[3];
      const [a, b, c, d] = [p.k1 ?? 0.45, p.k2 ?? 0.5, p.k3 ?? 0.5, p.k4 ?? 0.45];
      const o = {};
      M5KEYS.forEach((k) => (o[k + '.on'] = k === m[1] ? 1 : 0));
      Object.assign(o, {
        'd.gain': a, 'd.tone': b, 'd.level': c * 0.9,
        'c.rate': a, 'c.depth': b, 'c.tone': c, 'c.mix': d,
        'p.rate': a, 'p.depth': b, 'p.feedback': c * 0.8, 'p.mix': d,
        'f.speed': a, 'f.width': b, 'f.regen': c, 'f.mix': d,
        't.rate': a, 't.depth': b, 't.wave': c, 't.level': 0.3 + 0.4 * d,
        'e.time': 40 + 1200 * a * a, 'e.feedback': b, 'e.tone': c, 'e.mix': d * 0.8,
        'r.decay': a, 'r.tone': b, 'r.predelay': 200 * c, 'r.mix': d * 0.8,
        'w.sens': a, 'w.range': b, 'w.q': c, 'w.level': 0.3 + 0.4 * d,
      }, m[3]);
      return o;
    },
    desc: 'One effect at a time from a library of 12 models; the LCD shows what knobs 1–4 do for the current model. TAP sets the echo time.',
  })]);
  void BTN;
}
