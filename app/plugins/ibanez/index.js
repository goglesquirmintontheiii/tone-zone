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

  // ================================================================ v0.2 catalog expansion
  const G = tz.gfx;

  // Mini enclosure (TS Mini / Analog Delay Mini): narrow die-cast box, TS-style knob layout, chrome plate, stomp
  tz.addForm('ib-mini', (ctx, d) => {
    const { svg, label, formKit } = G;
    const g = ctx.g, w = 96, h = 186;
    const col = d.color, txt = d.text || G.textColorFor(col);
    formKit.body(g, w, h, col, { rx: 7, brushed: !!d.brushed });
    const theme = { text: txt, knob: 'mxr', labelSize: 5.6 };
    const knobs = d.controls.filter((c) => c.t === 'knob');
    const pos = [{ x: 24, y: 38, r: 11, labelPos: 'above' }, { x: 48, y: 58, r: 7.5, labelPos: 'below' }, { x: 72, y: 38, r: 11, labelPos: 'above' }];
    knobs.forEach((k, i) => Object.assign(k, pos[i] || {}, { style: 'nine' }));
    svg('rect', { x: 10, y: 84, width: w - 20, height: 22, rx: 2, fill: d.plate || 'url(#g-chrome)', opacity: 0.92 }, g);
    label(g, w / 2, 92, d.logo || d.name, { size: d.logoSize || 7.4, fill: d.plateText || '#151515', weight: 800, ls: 0.6 });
    label(g, w / 2, 101, d.code, { size: 5, fill: d.plateText || '#151515', weight: 700, ls: 1.6 });
    d.controls.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: w / 2, y: 146, r: 12 });
      if (c.t === 'led') Object.assign(c, { x: w / 2, y: 15, r: 2.6 });
    });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 124, gap: 24 }) };
  });

  // Tone-Lok (7-series) enclosure: knob deck with recessed push-lock knobs, logo band, big rubber-covered switch plate
  tz.addForm('ib7', (ctx, d) => {
    const { svg, label, formKit } = G;
    const g = ctx.g, w = 140, h = 250;
    const col = d.color, txt = d.text || G.textColorFor(col);
    formKit.body(g, w, h, col, { rx: 11 });
    // recessed knob deck
    svg('rect', { x: 8, y: 22, width: w - 16, height: 82, rx: 6, fill: '#000', opacity: 0.18 }, g);
    svg('rect', { x: 8.5, y: 22.5, width: w - 17, height: 81, rx: 5.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.15 }, g);
    const theme = { text: txt, knob: 'mxr', labelSize: 6 };
    const knobs = d.controls.filter((c) => c.t === 'knob' || c.t === 'sel');
    const tog = d.controls.filter((c) => c.t === 'toggle');
    const ky = tog.length ? 50 : 60;
    knobs.forEach((k, i) => Object.assign(k, { x: knobs.length === 1 ? w / 2 : 26 + (i * (w - 52)) / (knobs.length - 1), y: ky, r: knobs.length > 3 ? 11 : 13, labelPos: 'above' }));
    tog.forEach((t, i) => Object.assign(t, { x: tog.length === 1 ? w / 2 : 38 + (i * (w - 76)) / (tog.length - 1), y: 86, orient: 'h' }));
    // logo band
    svg('rect', { x: 0, y: 110, width: w, height: 24, fill: d.band || '#141416', opacity: 0.92 }, g);
    label(g, w / 2, 119, d.logo || d.name, { size: d.logoSize || 10, fill: d.logoColor || '#f2f2f2', weight: 800, ls: 1.2, font: "'Oswald', sans-serif" });
    label(g, w / 2, 129.5, d.code + '  ·  PUSH-LOCK', { size: 4.6, fill: d.logoColor || '#f2f2f2', weight: 700, ls: 1.4, opacity: 0.75 });
    d.controls.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, { style: 'ts', x: w / 2, y: 192, w: 118, h: 92, color: '#1d1d1f' });
      if (c.t === 'led') Object.assign(c, { x: w / 2, y: 13, r: 2.8 });
    });
    formKit.placeControls(ctx, d.controls, theme);
    formKit.tzBadge(g, w / 2, h - 7, txt, 4.2);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 156, gap: 26 }) };
  });

  // Echo Shifter: wide copper box, black control deck with the delay-time slider, three switches
  tz.addForm('ib-es', (ctx, d) => {
    const { svg, label, formKit } = G;
    const g = ctx.g, w = 196, h = 252;
    const col = d.color, txt = d.text || '#f4ead8';
    formKit.body(g, w, h, col, { rx: 12, brushed: true });
    svg('rect', { x: 9, y: 9, width: w - 18, height: 112, rx: 8, fill: '#151413' }, g);
    svg('rect', { x: 9.5, y: 9.5, width: w - 19, height: 111, rx: 7.5, fill: 'none', stroke: '#d8b27a', 'stroke-opacity': 0.5 }, g);
    label(g, w / 2, 136, d.logo || d.name, { size: 15, fill: txt, weight: 700, font: "'Oswald', sans-serif", ls: 2 });
    label(g, w / 2, 150, d.typeName || '', { size: 5.4, fill: txt, weight: 700, ls: 1.6, opacity: 0.8 });
    formKit.tzBadge(g, w / 2, h - 8, txt, 4.4);
    const theme = { text: '#efe2c8', knob: 'chrome', labelSize: 6 };
    formKit.placeControls(ctx, d.controls.filter((c) => c.y < 125), theme);
    formKit.placeControls(ctx, d.controls.filter((c) => !(c.y < 125)), Object.assign({}, theme, { text: txt }));
    return { w, h, theme: Object.assign({}, theme, { text: txt, jackText: txt }), jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 162, gap: 24 }) };
  });

  const TS = { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 720, postLp: 4800, levelMaxDb: 5 };
  const lock = (o) => def(Object.assign({ form: 'ib7', brand: 'Ibanez' }, o, { controls: [...o.controls, FOOT(), LED({ color: '#ff2a1a' })] }));
  const mini = (o) => def(Object.assign({ form: 'ib-mini', brand: 'Ibanez' }, o, { controls: [...o.controls, FOOT(), LED({ color: '#ff2a1a' })] }));

  tz.addDefs([
    // ---------------------------------------------------------------- 9-series / 808 family
    NINE({
      id: 'ib.ts9dx', name: 'GD9DX Green Drive Deluxe', ref: 'Ibanez TS9DX Turbo Tube Screamer', code: 'GD9DX', logo: 'GREEN DRIVE DX', cat: 'Overdrive', color: '#2f8c46', text: '#f2f2f2',
      algo: 'drive', opts: Object.assign({}, TS, { modes: [{}, { gainMaxDb: 43, preEq: [{ type: 'ls', f: 150, q: 0.7, db: 2 }] }, { gainMaxDb: 45, clipHp: 500, preEq: [{ type: 'ls', f: 120, q: 0.7, db: 4 }] }, { gainMaxDb: 48, clipHp: 380, preEq: [{ type: 'ls', f: 100, q: 0.7, db: 6 }] }] }),
      controls: [
        K('gain', 'OVERDRIVE', { x: 36, y: 50, r: 15, style: 'nine', display: ten }), K('tone', 'TONE', { x: 75, y: 33, r: 8, style: 'nine', labelPos: 'below', display: ten }),
        K('level', 'LEVEL', { x: 114, y: 50, r: 15, style: 'nine', display: ten }),
        SEL('mode', 'MODE', ['TS9', '+', 'HOT', 'TURBO'], { x: 75, y: 72, r: 6.5, sweep: 180, optSize: 4, labelRadius: 6, labelPos: 'none' }),
      ],
      desc: 'Four voicings: TS9 (stock), + (more bass and output), HOT (louder, fatter) and TURBO (most gain and low end).',
    }),
    NINE({
      id: 'ib.ph9', name: 'PS9 Phase Shifter', ref: 'Ibanez PH9', code: 'PS9', logo: 'PHASE SHIFTER', cat: 'Modulation', color: '#2c6fbf', text: '#f2f2f2',
      algo: 'chain', opts: { chain: [{ prefix: 'p', algo: 'phaser', params: { mix: 0.5 } }, { prefix: 'v', algo: 'utility', opts: { kind: 'gain' } }] },
      controls: [K('p.rate', 'SPEED', { def: 0.35 }), K('p.depth', 'DEPTH', { def: 0.75 }), K('p.feedback', 'FEEDBACK', { def: 0.4 }), K('v.level', 'LEVEL', { min: -12, max: 12, def: 0, display: db }),
        TOG('pmode', '', ['VINTAGE', 'MODERN'], { x: 75, y: 70, orient: 'h', optSize: 4.6 })],
      derive: (p) => (p.pmode ? { 'p.stages': 8, 'p.script': 0 } : { 'p.stages': 4, 'p.script': 1 }),
      desc: 'VINTAGE = classic 4-stage script-style sweep, MODERN = deeper 8-stage phasing.',
    }),
    // ---------------------------------------------------------------- minis
    mini({
      id: 'ib.tsmini', name: 'GD Mini', ref: 'Ibanez TS Mini Tube Screamer', code: 'GD-MINI', logo: 'GREEN DRIVE', cat: 'Overdrive', color: '#3f9a52', text: '#f2f2f2',
      algo: 'drive', opts: Object.assign({}, TS, { postLp: 4700, levelMaxDb: 5 }),
      controls: [K('gain', 'OVERDRIVE', { display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { display: ten })],
    }),
    mini({
      id: 'ib.admini', name: 'AE Mini', ref: 'Ibanez Analog Delay Mini', code: 'AE-MINI', logo: 'ANALOG ECHO', cat: 'Delay', color: '#a7acb2', text: '#151515', brushed: true, plate: '#1b1b1d', plateText: '#e9e9e9',
      algo: 'delay', opts: { maxMs: 650 }, fixed: { mode: 1, tone: 0.35 },
      controls: [K('time', 'DELAY TIME', { min: 20, max: 600, def: 250, display: ms }), K('feedback', 'REPEAT', { def: 0.35, max: 1.0 }), K('mix', 'DELAY LEVEL', { def: 0.45 })],
    }),
    // ---------------------------------------------------------------- Tone-Lok
    lock({
      id: 'ib.cf7', name: 'CF7X Chorus / Flanger', ref: 'Ibanez CF7 Tone-Lok', code: 'CF7X', logo: 'CHORUS / FLANGER', logoSize: 9, cat: 'Modulation', color: '#4f5aa8', text: '#f0f1fa', stereo: 'both',
      algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'chorus', opts: { style: 'bbd', invertR: true }, params: { mix: 0.5 } }, { prefix: 'f', algo: 'flanger', on: false, params: { mix: 0.5 } }] },
      controls: [K('speed', 'SPEED', { def: 0.35, virtual: true }), K('depth', 'DEPTH', { def: 0.55, virtual: true }), K('dtime', 'DELAY', { def: 0.5, virtual: true }), K('regen', 'REGEN', { def: 0.35, virtual: true }),
        TOG('cfmode', 'MODE', ['CHORUS', 'FLANGER']), TOG('krazy', 'KRAZY', ['NORMAL', "WACK'D"])],
      derive: (p) => {
        const fl = p.cfmode ? 1 : 0, k = p.krazy ? 1 : 0;
        const sp = Math.min(1, (p.speed ?? 0.35) * (k ? 1.4 : 1)), dp = Math.min(1, (p.depth ?? 0.55) * (k ? 1.5 : 1));
        return { 'c.on': fl ? 0 : 1, 'f.on': fl, 'c.rate': sp, 'c.depth': dp, 'c.delay': p.dtime ?? 0.5, 'c.feedback': (p.regen ?? 0.35) * 0.6,
          'f.speed': sp, 'f.width': dp, 'f.manual': p.dtime ?? 0.5, 'f.regen': p.regen ?? 0.35, 'f.mode': k };
      },
      desc: 'Chorus or flanger. KRAZY switch: NORMAL or WACK\'D (faster, deeper, ultra-resonant flanging).',
    }),
    lock({
      id: 'ib.fz7', name: 'FZ7X Fuzz', ref: 'Ibanez FZ7 Tone-Lok', code: 'FZ7X', logo: 'FUZZ', logoSize: 12, cat: 'Fuzz', color: '#c8401e', text: '#fbeee8',
      algo: 'drive', opts: { gainMinDb: 14, gainMaxDb: 48, tone: 'lp', toneLo: 1000, toneHi: 9000, postLp: 7000, levelMaxDb: 4,
        modes: [{ clip: 'ge', bias: 0.3 }, { clip: 'si', bias: 0.2 }, { clip: 'si', bias: 0.45, postLp: 4500 }, { clip: 'muff', bias: 0.5, preHp: 500, postLp: 3000 }] },
      controls: [K('gain', 'DRIVE', { def: 0.6, display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { def: 0.5, display: ten }), K('damage', 'DAMAGE', { def: 0.1, virtual: true, display: ten })],
      derive: (p) => { const dm = p.damage ?? 0.1; return { mode: Math.min(3, Math.floor(dm * 4)), sag: dm * 0.8 }; },
      desc: 'DAMAGE morphs from fat vintage fuzz through rough fuzz to a broken, radio-like sound.',
    }),
    lock({
      id: 'ib.sm7', name: 'SB7X Smash Box', ref: 'Ibanez SM7 Smashbox Tone-Lok', code: 'SB7X', logo: 'SMASH BOX', logoSize: 11, cat: 'Distortion', color: '#e2b023', text: '#151515',
      algo: 'chain', cost: 0.7,
      opts: { chain: [{ prefix: 'g', algo: 'gate', params: { threshold: 0.3 } }, { prefix: 'd', algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 12, preHp: 100, gainMinDb: 14, gainMaxDb: 52, tone: 'eq3', bassF: 100, midF: 800, trebleF: 3200, eqRangeDb: 14, postLp: 8000, levelMaxDb: 5 }, params: { mid: 0.45 } }] },
      controls: [K('d.gain', 'DRIVE', { def: 0.6, display: ten }), K('d.bass', 'LO', { display: ten }), K('d.treble', 'HI', { display: ten }), K('d.level', 'LEVEL', { def: 0.3, display: ten }),
        TOG('void', 'VOID', ['OFF', '1', '2'], { def: 1 }), TOG('edge', 'EDGE', ['SHARP', 'SMOOTH'], { def: 1 })],
      derive: (p) => { const v = p.void ?? 1; return { 'g.on': v ? 1 : 0, 'g.threshold': v === 1 ? 0.3 : 0.45, 'g.decay': v === 2 ? 0.12 : 0.4, 'd.bright': p.edge ? 0 : 0.8 }; },
      desc: 'High-gain distortion. VOID: OFF (max sustain), 1 (noise reduction), 2 (short, tight decay). EDGE: SHARP adds bite, SMOOTH rounds it off.',
    }),
    lock({
      id: 'ib.de7', name: 'DX7 Delay / Echo', ref: 'Ibanez DE7 Tone-Lok', code: 'DX7', logo: 'DELAY / ECHO', logoSize: 10, cat: 'Delay', color: '#8d9196', text: '#111',
      algo: 'delay', opts: { maxMs: 2700 },
      controls: [K('dtime', 'DELAY TIME', { def: 0.45, virtual: true }), K('feedback', 'REPEAT', { def: 0.35, max: 1.0 }), K('mix', 'DELAY LEVEL', { def: 0.45 }),
        TOG('range', 'RANGE', ['S', 'M', 'L'], { def: 1 }), TOG('demode', 'MODE', ['ECHO', 'DELAY'], { def: 0 })],
      derive: (p) => {
        const r = [[30, 160], [120, 650], [480, 2600]][p.range ?? 1];
        const echo = !p.demode;
        return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.45), mode: echo ? 1 : 0, tone: echo ? 0.35 : 0.8 };
      },
      desc: 'RANGE: 30-160 ms, 120-650 ms or 480-2600 ms. MODE: ECHO (dark, analog-style) or DELAY (clean digital).',
    }),
    // ---------------------------------------------------------------- wah
    def({
      id: 'ib.wh10', name: 'WW10 Wah', ref: 'Ibanez WH10 V3', brand: 'Ibanez', code: 'WW10', cat: 'Wah', form: 'treadle', color: '#1a1a1b', treadleColor: '#262628',
      algo: 'wah', opts: { mode: 0, fLo: 420, fHi: 2600, q: 5.5 },
      controls: [TREADLE('pos', { def: 0.5 }), TOG('wb', '', ['GUITAR', 'BASS'], { x: 84, y: 283, orient: 'h', optSize: 4.4 }), LED({ color: '#3ddc84', r: 2.2, x: 56, y: 283 })],
      derive: (p) => (p.wb ? { range: 0.25, q: 0.42 } : { range: 0.5, q: 0.5 }),
      logo: 'Wah Wah', logoColor: '#8ad14a', toeSwitch: true,
      desc: 'Bright, vocal wah with a GUITAR / BASS range switch. Click the treadle to toggle the toe switch.',
    }),
    // ---------------------------------------------------------------- Echo Shifter
    def({
      id: 'ib.es2', name: 'Echo Morpher ES2X', ref: 'Ibanez ES2 Echo Shifter', brand: 'Ibanez', code: 'ES2X', logo: 'ECHO MORPHER', typeName: 'ANALOG DELAY WITH MODULATION', cat: 'Delay', form: 'ib-es', color: '#8a5a33',
      algo: 'delay', opts: { maxMs: 1100 }, fixed: { mode: 1, tone: 0.4, modrate: 0.35 },
      controls: [
        SLIDER('time', 'DELAY TIME', { x: 30, y: 66, h: 84, w: 9, min: 30, max: 1000, def: 350, display: ms }),
        K('feedback', 'FEEDBACK', { x: 76, y: 48, r: 13, def: 0.4, max: 0.98 }), K('mix', 'MIX', { x: 122, y: 48, r: 13, def: 0.45 }), K('moddepth', 'MOD DEPTH', { x: 166, y: 48, r: 13, def: 0.3 }),
        TOG('modsw', 'MOD', ['OFF', 'ON'], { x: 122, y: 98, orient: 'h', def: 1 }),
        FOOT({ label: 'ON', x: 42, y: 204, r: 12 }), FOOT({ action: 'toggle', p: 'osc', label: 'OSCILLATION', style: 'soft', x: 98, y: 204, r: 10 }), FOOT({ action: 'tap', label: 'TAP', x: 154, y: 204, r: 12 }),
        LED({ x: 42, y: 174, color: '#ff2a1a' }), LED({ x: 98, y: 174, bind: 'param:osc', color: '#ffb020' }), LED({ x: 154, y: 174, bind: 'tap:time', color: '#ff2a1a' }),
      ],
      initParams: { osc: 0 },
      derive: (p) => ({ feedback: p.osc ? 1.08 : p.feedback ?? 0.4, moddepth: p.modsw === 0 ? 0 : p.moddepth ?? 0.3 }),
      desc: 'Analog-voiced delay: slide DELAY TIME, tap tempo, MOD adds chorus-like movement, OSCILLATION pushes the repeats into self-oscillation.',
    }),
  ]);

  // ---- v0.4 additions
  tz.addDefs([
    // ---- Tube Screamer family
    NINE({
      id: 'ib.ts808hw', name: 'GD808HW Hand-Wired', ref: 'Ibanez TS808HW Tube Screamer Hand-Wired', code: 'GD808HW', logo: 'GREEN DRIVE HW', cat: 'Overdrive', color: '#56913e', text: '#f2f2f2', plate: '#1b1b1d', plateText: '#e9d9a6',
      algo: 'drive', opts: Object.assign({}, TS, { toneLo: 680, postLp: 4700, levelMaxDb: 4, clipHp: 700 }),
      controls: [K('gain', 'OVERDRIVE', { display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { display: ten })],
      desc: 'Hand-wired 808 with a vintage-style chip: warm mids, smooth clipping.',
    }),
    def({
      id: 'ib.ts808dx', name: 'GD808DX Green Drive Booster', ref: 'Ibanez TS808DX Tube Screamer', brand: 'Ibanez', code: 'GD808DX', logo: 'GREEN DRIVE DX', cat: 'Overdrive', form: 'nine', color: '#5e9a45', text: '#f2f2f2',
      algo: 'chain', cost: 0.8, alwaysOn: true,
      opts: { chain: [
        { prefix: 'b', algo: 'boost', on: false, opts: { gainMaxDb: 20 }, params: { mode: 0, level: 1 } },
        { prefix: 'd', algo: 'drive', opts: Object.assign({}, TS, { toneLo: 700, postLp: 4600, levelMaxDb: 4 }) },
      ] },
      controls: [
        K('d.gain', 'OVERDRIVE', { x: 38, y: 52, r: 12, style: 'nine', display: ten }), K('d.tone', 'TONE', { x: 67, y: 38, r: 7.5, style: 'nine', display: ten }), K('d.level', 'LEVEL', { x: 96, y: 52, r: 12, style: 'nine', display: ten }),
        K('b.gain', 'BOOST', { x: 124, y: 36, r: 8.5, style: 'nine', def: 0.4, labelPos: 'above', display: ten }),
        FOOT({ action: 'param', p: 'b.on', label: 'BOOST', style: 'ts', x: 110, y: 186, w: 64, h: 100, color: '#202124' }), FOOT({ action: 'param', p: 'd.on', label: 'OD', style: 'ts', x: 40, y: 186, w: 64, h: 100, color: '#202124' }),
        LED({ x: 40, y: 18, bind: 'param:d.on', color: '#ff2a1a' }), LED({ x: 110, y: 18, bind: 'param:b.on', color: '#ff2a1a' }),
      ],
      initParams: { 'd.on': 1, 'b.on': 0 },
      desc: 'An 808 overdrive plus a clean booster (up to +20 dB) in front, each on its own switch.',
    }),
    NINE({
      id: 'ib.nts', name: 'NGD Nu Green Drive', ref: 'Ibanez NTS Nu Tubescreamer', code: 'NGD', logo: 'NU GREEN DRIVE', cat: 'Overdrive', color: '#2f8c46', text: '#f2f2f2',
      algo: 'drive', opts: Object.assign({}, TS, { clip: 'tube', bias: 0.15, cleanSum: true, levelMaxDb: 6 }),
      controls: [
        K('gain', 'OVERDRIVE', { x: 36, y: 50, r: 15, style: 'nine', display: ten }), K('tone', 'TONE', { x: 75, y: 33, r: 8, style: 'nine', labelPos: 'below', display: ten }),
        K('level', 'LEVEL', { x: 114, y: 50, r: 15, style: 'nine', display: ten }), K('blend', 'MIX', { x: 75, y: 70, r: 7, style: 'nine', labelPos: 'none', def: 1 }),
      ],
      desc: 'Tube Screamer built around a tiny vacuum tube. MIX (the small knob) blends in the clean signal.',
    }),
    NINE({
      id: 'ib.ts9b', name: 'GD9B Bass Green Drive', ref: 'Ibanez TS9B Bass Tube Screamer', code: 'GD9B', logo: 'BASS GREEN DRIVE', cat: 'Overdrive', color: '#2b8a7e', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, preHp: 30, clipHp: 300, gainMinDb: 0, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 90, midF: 700, trebleF: 2500, postLp: 6000, levelMaxDb: 6 },
      fixed: { mid: 0.5 },
      controls: [K('gain', 'DRIVE', { x: 30, y: 38, r: 11, display: ten }), K('blend', 'MIX', { x: 75, y: 38, r: 11, def: 0.6 }), K('level', 'LEVEL', { x: 120, y: 38, r: 11, display: ten }),
        K('bass', 'BASS', { x: 50, y: 70, r: 8, labelPos: 'none', display: ten }), K('treble', 'TREBLE', { x: 100, y: 70, r: 8, labelPos: 'none', display: ten })],
      desc: 'Tube Screamer voiced for bass, with a clean MIX and two-band EQ (the small knobs: bass left, treble right).',
    }),
    // ---- other 9-series
    NINE({
      id: 'ib.bb9', name: 'LB9 Low Booster', ref: 'Ibanez BB9 Bottom Booster', code: 'LB9', logo: 'LOW BOOSTER', cat: 'Boost', color: '#5b4a3a', text: '#f2ead8',
      algo: 'drive', opts: { clip: 'clean', preHp: 30, gainMinDb: 0, gainMaxDb: 24, tone: 'eq3', eqRangeDb: 10, bassF: 120, midF: 800, trebleF: 3000, postLp: 9000, levelMaxDb: 8 },
      fixed: { mid: 0.5, level: 0.7 },
      controls: [K('gain', 'GAIN', { def: 0.35, display: ten }), K('bass', 'BASS', { def: 0.6, display: ten }), K('treble', 'TREBLE', { def: 0.5, display: ten })],
      desc: 'Fat clean boost made to drive a tube amp, with bass and treble controls.',
    }),
    NINE({
      id: 'ib.sd9', name: 'SN9 Sonic Dist', ref: 'Ibanez SD9 Sonic Distortion', code: 'SN9', logo: 'SONIC DIST', cat: 'Distortion', color: '#3f4a59', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'diode', preHp: 120, gainMinDb: 10, gainMaxDb: 46, tone: 'lp', toneLo: 1200, toneHi: 8000, postLp: 7500, levelMaxDb: 4 },
      controls: [K('gain', 'DISTORTION', { def: 0.55, display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { def: 0.36, display: ten })],
    }),
    NINE({
      id: 'ib.sm9', name: 'HM9 Heavy Metal', ref: 'Ibanez SM9 Super Metal', code: 'HM9', logo: 'HEAVY METAL', cat: 'Distortion', color: '#2a2a2c', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 14, preHp: 120, gainMinDb: 16, gainMaxDb: 54, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 8000, levelMaxDb: 2, postEq: [{ type: 'peak', f: 800, q: 0.7, db: -4 }] },
      controls: [K('gain', 'DISTORTION', { def: 0.6, display: ten }), K('tone', 'EDGE', { display: ten }), K('level', 'LEVEL', { def: 0.34, display: ten })],
      desc: 'High-gain metal distortion. EDGE sets the treble bite.',
    }),
    // ---- minis
    mini({
      id: 'ib.bigmini', name: 'Big Little Dist', ref: 'Ibanez Big Mini Distortion', code: 'BIG-MINI', logo: 'BIG LITTLE', cat: 'Distortion', color: '#252527', text: '#f2f2f2', plate: '#b3141b', plateText: '#f4f4f4',
      algo: 'drive', opts: { clip: 'diode', preHp: 100, gainMinDb: 12, gainMaxDb: 50, tone: 'lp', toneLo: 1300, toneHi: 9000, postLp: 7500, levelMaxDb: 2 },
      controls: [K('gain', 'DIST', { def: 0.55, display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { def: 0.34, display: ten })],
    }),
    mini({
      id: 'ib.csmini', name: 'Chorus Mini', ref: 'Ibanez Chorus Mini', code: 'CS-MINI', logo: 'CHORUS', cat: 'Modulation', color: '#86b6d8', text: '#151515',
      algo: 'chorus', fixed: { mode: 0 },
      controls: [K('rate', 'SPEED', { def: 0.35 }), K('mix', 'LEVEL', { def: 0.5 }), K('depth', 'DEPTH', { def: 0.5 })],
    }),
    mini({
      id: 'ib.fzmini', name: 'Fuzz Mini', ref: 'Ibanez Fuzz Mini', code: 'FZ-MINI', logo: 'FUZZ', cat: 'Fuzz', color: '#c8401e', text: '#fbeee8',
      algo: 'drive', opts: { clip: 'ge', bias: 0.35, preHp: 80, gainMinDb: 16, gainMaxDb: 46, tone: 'lp', toneLo: 900, toneHi: 7000, postLp: 6500, levelMaxDb: 0 },
      controls: [K('gain', 'FUZZ', { def: 0.6, display: ten }), K('tone', 'TONE', { display: ten }), K('level', 'LEVEL', { def: 0.5, display: ten })],
    }),
    mini({
      id: 'ib.phmini', name: 'Phaser Mini', ref: 'Ibanez Phaser Mini', code: 'PH-MINI', logo: 'PHASER', cat: 'Modulation', color: '#2c6fbf', text: '#f2f2f2',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.35 }), K('feedback', 'FEEDBACK', { def: 0.4 }), K('depth', 'DEPTH', { def: 0.8 })],
    }),
    // ---- Tone-Lok
    lock({
      id: 'ib.tc7', name: 'TX7 Tri-Mode Chorus', ref: 'Ibanez TC7 Tone-Lok Tri Mode Chorus', code: 'TX7', logo: 'TRI-MODE CHORUS', logoSize: 8.6, cat: 'Modulation', color: '#5f9fb8', text: '#0f1d24', stereo: 'both',
      algo: 'chorus', opts: { invertR: true },
      controls: [K('rate', 'SPEED', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.5 }), K('delay', 'DELAY', { def: 0.5 }), K('mix', 'LEVEL', { def: 0.5 }),
        TOG('cmode', 'MODE', ['CHORUS', 'TRI', 'VIB'], { virtual: true })],
      derive: (p) => [{ mode: 0 }, { mode: 2 }, { mode: 1, mix: 1 }][p.cmode ?? 0],
      desc: 'Chorus, a thicker three-voice chorus, or vibrato.',
    }),
    lock({
      id: 'ib.lf7', name: 'LX7 Lo-Fi', ref: 'Ibanez LF7 Tone-Lok Lo Fi', code: 'LX7', logo: 'LO-FI', logoSize: 12, cat: 'Filter', color: '#c9b37a', text: '#1d1606',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'si', preHp: 80, gainMinDb: 0, gainMaxDb: 36, tone: 'none', postLp: 12000, levelMaxDb: 4 } },
        { prefix: 'f', algo: 'peq', params: { lowcut: 300, highcut: 3000 } },
      ] },
      controls: [K('f.lowcut', 'LO', { min: 20, max: 1000, def: 300, curve: 'log' }), K('f.highcut', 'HI', { min: 1000, max: 20000, def: 3000, curve: 'log' }), K('d.gain', 'DRIVE', { def: 0.3 }), K('d.level', 'LEVEL', { def: 0.55 }),
        TOG('flt', 'FILTER', ['ON', 'OFF'], { virtual: true })],
      derive: (p) => ({ 'f.on': p.flt ? 0 : 1 }),
      desc: 'Telephone and AM-radio tones: LO and HI cut the band, DRIVE adds grit.',
    }),
  ]);
}
