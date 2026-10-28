// Built-in Tone Zone plugin: EVH.
// Blocks inspired by EVH signature gear (MXR / Dunlop signature pedals, the 5150III-style head and 4x12).
// Names, logos and artwork are Tone Zone originals; control layouts and colours follow the real units (see each
// block's `ref`).

// criss-cross "Frankenstein" tape stripes, in normalised coordinates [x1, y1, x2, y2, width px]
const DARK_STRIPES = [[-0.1, 0.14, 1.1, 0.56, 9], [0.22, -0.1, 0.78, 1.1, 8], [1.1, 0.2, -0.1, 0.94, 7], [-0.1, 0.8, 1.1, 0.6, 6]];
const LIGHT_STRIPES = [[-0.1, 0.3, 1.1, 0.04, 6], [0.06, -0.1, 0.56, 1.1, 5], [0.92, -0.1, 0.34, 1.1, 6], [-0.1, 0.63, 1.1, 0.9, 5], [-0.1, 0.46, 1.1, 0.41, 3.5]];
let clipSeq = 0;
function stripes(tz, g, w, h, rx, o = {}) {
  const { svg } = tz.gfx;
  const id = 'evhclip' + ++clipSeq;
  const cp = svg('clipPath', { id }, g);
  svg('rect', { x: 0, y: 0, width: w, height: h, rx }, cp);
  const sg = svg('g', { 'clip-path': `url(#${id})` }, g);
  const sc = o.scale || 1;
  if (o.dark !== false) for (const [x1, y1, x2, y2, sw] of DARK_STRIPES) svg('line', { x1: x1 * w, y1: y1 * h, x2: x2 * w, y2: y2 * h, stroke: o.darkColor || '#0e0e0e', 'stroke-width': sw * sc }, sg);
  for (const [x1, y1, x2, y2, sw] of LIGHT_STRIPES) svg('line', { x1: x1 * w, y1: y1 * h, x2: x2 * w, y2: y2 * h, stroke: o.lightColor || '#f4f1ea', 'stroke-width': sw * sc }, sg);
  return sg;
}

// Treadle enclosure with an optional side pod (see the Dunlop plugin for the same layout).
function treadleForm(tz) {
  const { svg, label, formKit, shade } = tz.gfx;
  return (ctx, def) => {
    const g = ctx.g;
    const w = def.tw || 152, h = def.th || 304;
    const col = def.color || '#1a1a1c';
    tz.gfx.softShadow(g, { w, h, rx: 14, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { x: 0, y: 0, width: w, height: h, rx: 14, fill: col }, g);
    if (def.stripes) stripes(tz, g, w, h, 14, def.stripes);
    for (const f of ['url(#p-grain)', 'url(#g-shadeV)', 'url(#g-shadeH)']) svg('rect', { x: 0, y: 0, width: w, height: h, rx: 14, fill: f }, g);
    svg('rect', { x: 0, y: 0, width: w, height: h, rx: 14, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    svg('rect', { x: 6, y: h - 34, width: w - 12, height: 26, rx: 6, fill: '#0c0c0d', opacity: 0.85 }, g);
    const theme = { text: def.text || '#d8d8d8', knob: 'mxr', labelSize: 5.8 };
    def.controls.forEach((c) => {
      if (c.t === 'treadle' && c.x === undefined)
        Object.assign(c, { x: w / 2, y: h / 2 - 12, w: w - 30, h: h - 66, color: def.treadleColor || '#161618', logo: def.logo, logoColor: def.logoColor, logoFont: def.logoFont, logoSize: def.logoSize });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 21, r: 2.6 });
    });
    label(g, 24, h - 21, def.code, { size: 6, fill: theme.text, weight: 800, ls: 1, anchor: 'start' });
    formKit.tzBadge(g, w - 24, h - 21, theme.text, 4.2).setAttribute('text-anchor', 'end');
    formKit.placeControls(ctx, def.controls, theme);
    void shade;
    return { w, h, theme, jacks: formKit.jacksSide(def, w, { y0: h - 96, gap: 24, flip: ctx.flip }) };
  };
}

export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, TREADLE, def, ten, db, ms, MONO_TO_ST, STD } = tz.helpers;
  const { k, AMP, CAB, preampPair } = tz.builders;
  const { svg, label, formKit } = tz.gfx;

  tz.addForm('evh-treadle', treadleForm(tz));

  // MXR-size box with optional striped artwork, a tri-colour band and a logo plate
  tz.addForm('evh-box', (ctx, d) => {
    const g = ctx.g, w = d.wide ? 196 : 128, h = 222, rx = 7;
    const txt = d.text || '#f2f2f2';
    tz.gfx.softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: d.color }, g);
    if (d.stripes) stripes(tz, g, w, h, rx, d.stripes);
    if (d.band) for (const [i, c] of ['#c8141c', '#f4f1ea', '#c8141c'].entries()) svg('rect', { x: 0, y: d.band + i * 4, width: w, height: i === 1 ? 4 : 3.5, fill: c, opacity: 0.95 }, g);
    for (const f of ['url(#p-grain)', 'url(#g-shadeV)', 'url(#g-shadeH)']) svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: f }, g);
    svg('rect', { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: rx - 0.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 1.2 }, g);
    svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    const theme = { text: txt, knob: 'mxr', labelSize: 6.6 };
    const knobs = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
    const n = knobs.length;
    const auto = (list, x0, x1, y) => list.forEach((c, i) => { c.x = list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1); c.y = y; });
    const hasBtn = d.controls.some((c) => c.t === 'button');
    const rows2 = n > 3 && !(d.wide && n === 4);
    if (!rows2) auto(knobs, n === 1 ? w / 2 : 30, n === 1 ? w / 2 : w - 30, hasBtn ? 36 : 40);
    else { auto(knobs.slice(0, Math.ceil(n / 2)), 28, w - 28, 34); auto(knobs.slice(Math.ceil(n / 2)), 28, w - 28, 78); }
    knobs.forEach((c) => (c.r = c.r || (n <= 2 ? 15 : n <= 4 && !rows2 ? 13 : 11)));
    // dark label tabs keep the knob legends readable over the stripes
    if (d.stripes)
      d.controls.filter((c) => c.t === 'knob' && c.label).forEach((c) => {
        const lw = c.label.length * 3.9 + 8;
        svg('rect', { x: c.x - lw / 2, y: c.y + c.r + 4.5, width: lw, height: 9, rx: 2, fill: '#0b0b0b', opacity: 0.88 }, g);
      });
    const logoY = rows2 ? 130 : hasBtn ? 116 : 104;
    if (d.stripes || d.plate) svg('rect', { x: 12, y: logoY - 15, width: w - 24, height: 38, rx: 4, fill: d.plate || '#0b0b0b', opacity: 0.92 }, g);
    label(g, w / 2, logoY, d.logo, { size: d.logoSize || 21, fill: d.logoColor || txt, font: d.logoFont || "'Dancing Script', cursive", weight: 700, ls: 0.2 });
    label(g, w / 2, logoY + 15, d.code, { size: 7, fill: txt, weight: 700, ls: 1.6, opacity: 0.85 });
    if (d.stripes) svg('rect', { x: w / 2 - 26, y: h - 15, width: 52, height: 9, rx: 2, fill: '#0b0b0b', opacity: 0.88 }, g);
    formKit.tzBadge(g, w / 2, h - 10, txt, 4.6);
    d.controls.forEach((c) => {
      if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'stomp', x: w / 2, y: rows2 ? 190 : 180, r: 13 });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: rows2 ? 170 : 154, r: 3 });
      if (c.t === 'button' && c.x === undefined) Object.assign(c, rows2 ? { x: 34, y: 186, r: 5.5, led: true, ledDy: -10 } : { x: w / 2, y: 76, r: 5, led: true, ledDy: -9 });
    });
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 46, gap: 28, flip: ctx.flip }) };
  });

  const box = (o) => def(Object.assign({ form: 'evh-box', brand: 'EVH' }, o, { controls: [...o.controls, ...STD(o.led || '#ff2a1a')] }));

  // three-channel 50 W head voiced from the built-in 5150 model
  const v = (o) => Object.assign({ base: '5150' }, o);
  const stripeAmp = AMP({
    id: 'evh.amp-stripe50', name: 'Stripe 50 III', ref: 'EVH 5150III 50W', brand: 'EVH', cat: 'Amp',
    opts: { models: [
      v({ drive: 0.16, tight: 0.2, sag: 0.35, nfb: 0.6 }),
      v({ drive: 0.55, tight: 0.45 }),
      v({ drive: 1.15, tight: 0.75, presHz: 3800 }),
    ] },
    tolex: '#111111', panel: '#121212', panelText: '#e4e4e4', grille: 'black', piping: '#8d8f93', knob: 'mxr', panelBrushed: false,
    logo: 'STRIPE III', logoFont: "'Oswald', sans-serif", logoColor: '#efefef', logoSize: 24, logoPlate: '#b8141b',
    controls: [
      SEL('channel', 'CHANNEL', ['CLEAN', 'CRUNCH', 'LEAD'], { def: 2, sweep: 100, optSize: 4.4, labelRadius: 8 }),
      k('gain', 'GAIN', { def: 0.55 }), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'VOLUME', { def: 0.45 }),
      k('presence', 'PRESENCE'), k('depth', 'RESONANCE'),
    ],
    desc: 'Three channels (clean / crunch / lead) sharing one EQ, with global PRESENCE and RESONANCE like the 50 W version.',
  });
  const [amp, pre] = preampPair(stripeAmp);
  pre.controls.unshift(SEL('channel', 'CHANNEL', ['CLEAN', 'CRUNCH', 'LEAD'], { def: 2, sweep: 100, optSize: 4.4, labelRadius: 8 }));

  tz.addDefs([
    box({
      id: 'evh.phase90', name: 'Stripe Phase', ref: 'MXR EVH90 Phase 90', code: 'SP-90', logo: 'Stripe Phase', logoSize: 19, cat: 'Modulation',
      color: '#c8141c', stripes: {}, text: '#f4f1ea',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.85, mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.3 }), BTN('SCRIPT', { p: 'script', toggle: true, led: true, ledColor: '#ff2a1a' })],
      desc: 'The striped Phase 90 with the SCRIPT button (on = smoother, vintage script-logo voicing; off = the more pronounced block-logo sweep).',
    }),
    box({
      id: 'evh.flanger117', name: 'Stripe Flanger', ref: 'MXR EVH117 Flanger', code: 'SF-117', logo: 'Stripe Flanger', logoSize: 17, cat: 'Modulation', wide: true,
      color: '#121212', stripes: { dark: false }, text: '#f4f1ea', stereo: 'both',
      algo: 'flanger',
      controls: [K('manual', 'MANUAL', { def: 0.45 }), K('width', 'WIDTH', { def: 0.6 }), K('speed', 'SPEED', { def: 0.3 }), K('regen', 'REGEN', { def: 0.55 }),
        BTN('EVH', { p: 'evh', toggle: true, led: true, ledColor: '#ff2a1a' })],
      derive: (p) => (p.evh ? { manual: 0.24, width: 0.52, speed: 0.1, regen: 0.78 } : {}),
      desc: 'EVH button = the "Unchained" preset (slow, deep, high regen), overriding the knobs.',
    }),
    box({
      id: 'evh.chorus', name: 'Stripe Chorus', ref: 'MXR EVH 5150 Chorus', code: 'SC-50', logo: 'Stripe Chorus', logoSize: 17, cat: 'Modulation', wide: true,
      color: '#161616', band: 8, plate: '#161616', text: '#ececec', logoFont: "'Oswald', sans-serif", stereo: 'both', ports: { ins: ['INPUT'], outs: ['OUTPUT L', 'OUTPUT R'] },
      algo: 'chorus', opts: { invertR: true },
      controls: [K('mix', 'LEVEL', { def: 0.5 }), K('rate', 'RATE', { def: 0.3 }), K('depth', 'DEPTH', { def: 0.5 }), K('tone', 'TONE', { def: 0.6 }),
        BTN('BRIGHT', { p: 'bright', toggle: true, led: true, ledColor: '#ff2a1a' })],
      derive: (p) => (p.bright ? { tone: Math.min(1, (p.tone ?? 0.6) + 0.25) } : {}),
    }),
    box({
      id: 'evh.od5150', name: 'Stripe Drive', ref: 'MXR EVH 5150 Overdrive', code: 'SD-50', logo: 'Stripe Drive', logoSize: 18, cat: 'Distortion', wide: true,
      color: '#141414', band: 8, plate: '#141414', text: '#ececec', logoFont: "'Oswald', sans-serif",
      algo: 'chain', cost: 0.8,
      opts: { chain: [
        { prefix: 'g', algo: 'gate', params: { decay: 0.25 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'asym', bias: 0.2, stages: 2, stage2Db: 14, preHp: 110, gainMinDb: 14, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 14, bassF: 110, midF: 750, trebleF: 3200, postLp: 7000, levelMaxDb: 2,
          modes: [{}, { gainMaxDb: 60, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 4 }] }] } },
      ] },
      controls: [K('d.level', 'OUTPUT', { def: 0.4 }), K('d.gain', 'GAIN', { def: 0.6 }), K('g.threshold', 'GATE', { def: 0.3, r: 9 }),
        K('d.bass', 'BASS'), K('d.mid', 'MID'), K('d.treble', 'TREBLE'),
        BTN('BOOST', { p: 'd.mode', toggle: true, led: true, ledColor: '#3ddc84' })],
      derive: (p) => ({ 'g.on': (p['g.threshold'] ?? 0.3) > 0.02 ? 1 : 0 }),
      desc: 'High-gain amp-in-a-box with a built-in noise gate (GATE fully down = off) and a BOOST button for extra gain and mids.',
    }),
    def({
      id: 'evh.wah95', name: 'Stripe Weeper', ref: 'Dunlop EVH95 Cry Baby', brand: 'EVH', code: 'SW-95', cat: 'Wah', form: 'evh-treadle', color: '#c8141c', stripes: { scale: 1.4 },
      treadleColor: '#141414', logo: 'Stripe Weeper', logoColor: '#f4f1ea', logoFont: "'Oswald', sans-serif", logoSize: 17,
      algo: 'wah', opts: { fLo: 400, fHi: 2450, q: 6.2, mode: 0 }, fixed: { level: 0.56 },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 })], toeSwitch: true,
      desc: 'Signature wah with a higher, more vocal sweep and a little extra output. Click the treadle to toggle it.',
    }),
    amp, pre,
    CAB({ id: 'evh.cab-stripe412', name: 'Stripe 4x12', ref: 'EVH 5150III 4x12 (Celestion EVH)', brand: 'EVH', cabSize: '4x12', grille: 'black', piping: '#8d8f93',
      opts: { cab: { hp: 72, hpQ: 1.1, resDb: 4.5, lp: 5400, lpQ: 0.9, open: false, peaks: [[120, 1.2, 1.5], [2600, 1.6, 4], [3900, 2.2, -3.5], [5200, 2.5, 2]], seed: 5150, detail: 1.2 } },
      logo: 'STRIPE', logoFont: "'Oswald', sans-serif", logoColor: '#efefef', logoPlate: '#b8141b' }),
  ]);
  void ten; void db; void ms; void MONO_TO_ST; void FOOT; void TOG;
}
