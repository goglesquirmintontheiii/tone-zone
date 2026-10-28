// Built-in Tone Zone plugin: Meris.
// Blocks inspired by Meris pedals. Names, logos and artwork are Tone Zone originals; control layouts, colours and
// enclosure proportions follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, SCREEN, def, ms, STEREO } = tz.helpers;
  const { svg, label, formKit, shade, luminance, noisePattern, setText } = tz.gfx;

  // ------------------------------------------------------------------ OLED (LVX / MercuryX style systems)
  tz.addScreen('meris-oled', {
    override: true,
    build(s, g, w, h, nv) {
      svg('rect', { width: w, height: h, rx: 1.5, fill: '#010101' }, g);
      s.l1 = svg('text', { x: 6, y: h * 0.36, fill: '#f4f4f4', 'font-family': "'Share Tech Mono', monospace", 'font-size': Math.min(11, h * 0.36), 'dominant-baseline': 'central', 'letter-spacing': 1.2 }, g, '');
      s.l2 = svg('text', { x: 6, y: h * 0.76, fill: '#bdbdbd', 'font-family': "'Share Tech Mono', monospace", 'font-size': Math.min(6.4, h * 0.22), 'dominant-baseline': 'central', 'letter-spacing': 0.8 }, g, '');
      s.bar = svg('rect', { x: w - 40, y: h * 0.66, width: 0, height: 3.2, rx: 1, fill: '#f4f4f4' }, g);
      svg('rect', { x: w - 40, y: h * 0.66, width: 34, height: 3.2, rx: 1, fill: 'none', stroke: '#777', 'stroke-width': 0.5 }, g);
      this.update(s, {}, nv);
    },
    update(s, st, nv) {
      const c = s.ctl, b = nv && nv.block;
      const get = (p, d) => (b && b.params && b.params[p] !== undefined ? b.params[p] : (c.defaults || {})[p] ?? d);
      setText(s.l1, (c.names || [])[get(c.param, 0) | 0] || '');
      setText(s.l2, b && b.bypass ? 'BYPASS' : c.status ? c.status(get) : 'ACTIVE');
      const v = c.meter ? Math.max(0, Math.min(1, c.meter(get))) : 0;
      s.bar.setAttribute('width', (34 * v).toFixed(1));
    },
  });

  // ------------------------------------------------------------------ enclosure: matte black, colour columns
  let seq = 0;
  tz.addForm('meris', (ctx, def) => {
    const g = ctx.g, big = !!def.big;
    // auto-placed controls are tagged so a re-render (gallery → board) lays them out again
    const free = (c) => c.x === undefined || c._auto;
    def.controls.forEach((c) => { if (c.x === undefined) c._auto = true; });
    const knobs = def.controls.filter((c) => c.t === 'knob' && free(c));
    const cols = big ? knobs.length : knobs.length <= 4 ? 2 : 3;
    const w = big ? 316 : cols === 2 ? 164 : 206, h = big ? 238 : 232;
    const id = 'mrs' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 36, 72, [255, 255, 255], 0, 0.085, 0);
    formKit.body(g, w, h, def.color || '#141416', { rx: 7, grain: false });
    svg('rect', { width: w, height: h, rx: 7, fill: `url(#${id}n)` }, g);
    const pal = def.palette || ['#7a5cff', '#ff5ab4', '#4fc3ff'];
    const theme = { text: '#f6f6f6', knob: 'mxr', labelSize: 5.1, labelFont: "'Inter', sans-serif", labelWeight: 500, labelLs: 0.6, toggleTitles: false };
    // colour column (vertical pill) behind each knob column
    const pill = (cx, y0, y1, color, i) => {
      const gid = `${id}c${i}`;
      const lg = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svg('stop', { offset: 0, 'stop-color': shade(color, 0.12) }, lg);
      svg('stop', { offset: 0.55, 'stop-color': color }, lg);
      svg('stop', { offset: 1, 'stop-color': shade(color, -0.25) }, lg);
      svg('rect', { x: cx - 17, y: y0, width: 34, height: y1 - y0, rx: 17, fill: `url(#${gid})`, opacity: 0.92 }, g);
      svg('rect', { x: cx - 16, y: y0 + 1, width: 32, height: y1 - y0 - 2, rx: 16, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 0.8 }, g);
      svg('rect', { x: cx - 17, y: y0, width: 34, height: y1 - y0, rx: 17, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.6 }, g);
    };
    const logoFont = "'Inter', sans-serif";
    // knob captions printed on the colour column: dark ink on light colours, white on dark ones
    const knobLabel = (k, color) => {
      k.labelPos = 'none';
      const n = k.label.length;
      label(g, k.x, k.y + k.r + 8.5, k.label, { size: Math.min(5.1, (28 - 0.5 * n) / (0.72 * n)), fill: luminance(color) > 0.5 ? '#141414' : '#ffffff', font: logoFont, weight: 600, ls: 0.5 });
    };
    if (!big) {
      label(g, w / 2, 24, def.logo, { size: def.logoSize || 17, fill: '#fff', font: logoFont, weight: 300, ls: 3 });
      label(g, w / 2, 39, (def.typeName || '').toUpperCase(), { size: 4.8, fill: '#cfcfcf', font: logoFont, weight: 500, ls: 2 });
      const x0 = cols === 2 ? 46 : 42, x1 = w - x0;
      for (let ci = 0; ci < cols; ci++) {
        const cx = cols === 1 ? w / 2 : x0 + ((x1 - x0) * ci) / (cols - 1);
        pill(cx, 52, 154, pal[ci % pal.length], ci);
        knobs.filter((_, i) => i % cols === ci).forEach((k, ri) => { Object.assign(k, { x: cx, y: 72 + ri * 50, r: k.r || 12.5 }); knobLabel(k, pal[ci % pal.length]); });
      }
      const tog = def.controls.filter((c) => c.t === 'toggle' && free(c));
      tog.forEach((t, i) => Object.assign(t, { x: tog.length === 1 ? w / 2 : w * (0.37 + 0.26 * i), y: 168, orient: 'h' }));
      const foots = def.controls.filter((c) => c.t === 'foot' && free(c));
      foots.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 11, x: foots.length === 1 ? w / 2 : w * [0.22, 0.78][i], y: 202 }));
      const leds = def.controls.filter((c) => c.t === 'led' && free(c));
      leds.forEach((l, i) => Object.assign(l, { r: 2.5, x: leds.length === 1 ? w / 2 : w * [0.22, 0.78][i], y: 178 }));
      formKit.tzBadge(g, w / 2, h - 8, '#bdbdbd', 4.2);
    } else {
      label(g, 18, 24, def.logo, { size: def.logoSize || 18, fill: '#fff', font: logoFont, weight: 300, ls: 3, anchor: 'start' });
      label(g, 19, 38, (def.typeName || '').toUpperCase(), { size: 4.6, fill: '#cfcfcf', font: logoFont, weight: 500, ls: 1.3, anchor: 'start' });
      const scr = def.controls.find((c) => c.t === 'screen');
      if (scr && free(scr)) Object.assign(scr, { x: w / 2 + 32, y: 36, w: 108, h: 30, bezel: '#000' });
      const sel = def.controls.find((c) => c.role === 'type');
      if (sel && free(sel)) Object.assign(sel, { x: w - 34, y: 38, r: 12, printLabels: false, ring: true, labelPos: 'none' });
      if (sel) label(g, sel.x, 62, sel.label, { size: 5.2, fill: '#ddd', font: logoFont, weight: 500, ls: 1.2 });
      knobs.forEach((k) => (k.x = undefined, k.y = undefined));
      formKit.autoRow(knobs, 36, w - 36, 98);
      knobs.forEach((k, i) => { k.r = k.r || 12; pill(k.x, 76, 128, pal[i % pal.length], i); knobLabel(k, pal[i % pal.length]); });
      const tog = def.controls.filter((c) => c.t === 'toggle' && free(c));
      tog.forEach((t, i) => Object.assign(t, { x: tog.length === 1 ? w / 2 : w * (0.36 + (0.28 * i) / Math.max(1, tog.length - 1)), y: 148, orient: 'h' }));
      const fx = [0.17, 0.5, 0.83];
      def.controls.filter((c) => c.t === 'foot' && free(c)).forEach((f, i) => Object.assign(f, { style: 'stomp', r: 11, x: w * fx[i], y: 206 }));
      def.controls.filter((c) => c.t === 'led' && free(c)).forEach((l, i) => Object.assign(l, { r: 2.5, x: w * fx[i], y: 182 }));
      formKit.tzBadge(g, w / 2, 166, '#bdbdbd', 4.2);
    }
    formKit.placeControls(ctx, def.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { jackText: '#ddd' }), jacks: formKit.jacksTop(def, w, { flip: ctx.flip }) };
  });

  const M = (o) => {
    const d = def(Object.assign({ form: 'meris', brand: 'Meris', stereo: 'stereo', ports: STEREO, cost: 1.4, color: '#141416' }, o));
    const scr = d.controls.find((c) => c.t === 'screen');
    if (scr) scr.defaults = Object.fromEntries(d.controls.filter((c) => c.p).map((c) => [c.p, c.def ?? 0]));
    return d;
  };
  const byp = () => FOOT({ action: 'bypass', label: 'BYPASS' });
  const led = (o = {}) => LED(Object.assign({ color: '#ff3b2f' }, o));
  const hold = { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } };

  const LVX_T = ['DIGITAL', 'TAPE', 'BBD', 'LO-FI', 'REVERSE', 'PING PONG', 'DUAL', 'CRYSTAL', 'WARP', 'DLY+VERB'];
  const LVX_M = [0, 2, 1, 3, 5, 7, 8, 6, 9, 10];
  const MX_T = ['ROOM', 'HALL', 'PLATE', 'CATHEDRA', 'SPRING', 'SWELL', 'PITCH', 'CLOUD', 'DYNAMIC', 'ECHO-VERB'];
  const MX_M = [0, 1, 2, 1, 3, 9, 4, 5, 7, 8];

  tz.addDefs([
    M({
      id: 'mrs.polymoon', name: 'Polyluna Super', ref: 'Meris Polymoon', code: 'POLYLUNA', logo: 'polyluna', typeName: 'Modulated multi-tap delay', cat: 'Delay',
      palette: ['#7b5cff', '#e255c4', '#43b9ff'], cost: 1.6,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'delay', opts: { maxMs: 1600 }, params: { sat: 0.05, age: 0.05 } },
        { prefix: 'ph', algo: 'phaser', opts: { stages: 6 }, params: { mix: 0.3 } },
        { prefix: 'fl', algo: 'flanger', params: { mix: 0 } },
      ] },
      controls: [
        K('d.time', 'TIME', { min: 20, max: 1500, def: 380, display: ms, curve: 'log' }), K('d.feedback', 'FEEDBACK', { def: 0.45, max: 1.05 }), K('d.mix', 'MIX', { def: 0.38 }),
        K('multiply', 'MULTIPLY', { def: 0.5, virtual: true }), K('dimension', 'DIMENSION', { def: 0.3, virtual: true }), K('dynamics', 'DYNAMICS', { def: 0.2, virtual: true }),
        TOG('d.subdiv', 'TEMPO', ['1/4', 'dot', 'trip'], { values: [0, 1, 3] }), TOG('early', 'EARLY MOD', ['off', 'lite', 'deep'], { def: 1, virtual: true }),
        byp(), FOOT({ action: 'tap', label: 'TAP', hold }), led(), LED({ bind: 'tap:d.time', color: '#43b9ff' }),
      ],
      tapTarget: 'd.time',
      ctrl: { ins: [{ label: 'EXP', param: 'dimension', min: 0, max: 1 }] },
      derive: (p) => {
        const mu = p.multiply ?? 0.5, dm = p.dimension ?? 0.3, dy = p.dynamics ?? 0.2;
        const heads = mu < 0.15 ? 4 : mu < 0.4 ? 6 : mu < 0.7 ? 5 : 7;
        return {
          'd.mode': mu < 0.15 ? 4 : 2, 'd.heads': heads, 'd.moddepth': [0, 0.18, 0.45][p.early ?? 1], 'd.modrate': 0.35,
          'ph.on': dm > 0.02 ? 1 : 0, 'ph.mix': dm * 0.7, 'ph.depth': 0.5 + 0.5 * dm, 'ph.feedback': 0.2 + 0.5 * dy,
          'fl.on': dy > 0.05 ? 1 : 0, 'fl.mix': dy * 0.45, 'fl.speed': 0.15, 'fl.regen': 0.3 + 0.4 * dy,
        };
      },
      desc: 'Multi-tap delay (MULTIPLY spreads repeats over up to three taps) with a phaser (DIMENSION) and flanger (DYNAMICS) acting on the echoes. Hold TAP to freeze the repeats.',
    }),
    M({
      id: 'mrs.mercury7', name: 'Hermes9 Reverb', ref: 'Meris Mercury7', code: 'HERMES9', logo: 'hermes9', typeName: 'Cathedral reverb', cat: 'Reverb',
      palette: ['#2b6fe0', '#33b6d8', '#8fd6ff'], cost: 1.6,
      algo: 'reverb',
      controls: [
        K('decay', 'SPACE DECAY', { def: 0.62 }), K('mod', 'MODULATE', { def: 0.35 }), K('mix', 'MIX', { def: 0.38 }),
        K('lowcut', 'LO FREQ', { def: 0.2 }), K('shimmer', 'PITCH VECTOR', { def: 0, virtual: true }), K('diffusion', 'DENSITY', { def: 0.75 }),
        TOG('algo', 'ALGORITHM', ['ultra', 'cathedra'], { def: 1 }), TOG('swell', 'SWELL', ['off', 'on']),
        byp(), FOOT({ action: 'param', p: 'inf', label: 'ALT · HOLD' }), led(), LED({ bind: 'param:inf', color: '#8fd6ff' }),
      ],
      initParams: { inf: 0 },
      ctrl: { ins: [{ label: 'EXP', param: 'decay', min: 0, max: 1 }] },
      derive: (p) => {
        const sh = p.shimmer ?? 0;
        return { mode: p.swell ? 9 : sh > 0.03 ? 4 : p.algo ? 1 : 2, shimmer: sh, size: p.algo ? 0.95 : 0.6, decay: p.inf > 0.5 ? 1 : p.decay ?? 0.62, ensemble: 0.25 };
      },
      desc: 'Ultraplate (plate) or Cathedra (huge hall) reverb. PITCH VECTOR adds octave shimmer, SWELL fades every note in, ALT holds the tail.',
    }),
    M({
      id: 'mrs.hedra', name: 'Tetra Harmonizer', ref: 'Meris Hedra', code: 'TETRA', logo: 'tetra', typeName: 'Rhythmic pitch shifter', cat: 'Pitch',
      palette: ['#e8452c', '#f2902c', '#f5c833'], cost: 2.4,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'delay', opts: { maxMs: 1500 }, params: { mix: 0.15, feedback: 0.2 } },
        { prefix: 'p', algo: 'pitch', params: { dry: 1, scale: 1, level2: 0.8 } },
      ] },
      controls: [
        K('mix', 'MIX', { def: 0.6, virtual: true }), K('p.deg1', 'PITCH 1', { min: -7, max: 7, step: 1, def: 2, display: (v) => (v > 0 ? '+' : '') + Math.round(v) }),
        K('p.deg2', 'PITCH 2', { min: -7, max: 7, step: 1, def: 4, display: (v) => (v > 0 ? '+' : '') + Math.round(v) }),
        K('p.key', 'KEY', { min: 0, max: 11, step: 1, def: 0, display: (v) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][Math.round(v)] }),
        K('d.time', 'TIME', { min: 20, max: 1200, def: 300, display: ms }), K('d.feedback', 'FEEDBACK', { def: 0.2, max: 0.95 }),
        TOG('scl', 'SCALE', ['major', 'minor', 'chrom'], { def: 0 }), TOG('micro', 'MICRO', ['off', 'detune']),
        byp(), FOOT({ action: 'tap', label: 'TAP', tapTarget: 'd.time' }), led(), LED({ bind: 'tap:d.time', color: '#f5c833' }),
      ],
      tapTarget: 'd.time',
      ctrl: { ins: [{ label: 'EXP', param: 'mix', min: 0, max: 1 }] },
      derive: (p) => {
        const mx = p.mix ?? 0.6, sc = p.scl ?? 0;
        const o = { 'p.scale': [1, 2, 0][sc], 'p.level1': mx, 'p.level2': mx * 0.85, 'p.dry': 1 - mx * 0.35, 'p.cents': p.micro ? 12 : 0, 'd.mix': 0.12 + 0.25 * (p['d.feedback'] ?? 0.2) };
        if (sc === 2) { o['p.semis1'] = Math.round(p['p.deg1'] ?? 2); o['p.semis2'] = Math.round(p['p.deg2'] ?? 4); }
        return o;
      },
      desc: 'Diatonic harmonizer: KEY + SCALE make PITCH 1 / 2 follow the scale (chromatic = semitones). TIME / FEEDBACK set a delay in front of the voices. Two harmony voices (the real unit has three).',
    }),
    M({
      id: 'mrs.ottobit', name: 'Nonobit Jr.', ref: 'Meris Ottobit Jr.', code: 'NONOBIT', logo: 'nonobit jr.', logoSize: 15, typeName: 'Bit crusher & sequencer', cat: 'Filter',
      palette: ['#3cc061', '#c9d83a', '#2bb3a1'], cost: 1,
      algo: 'chain',
      opts: { chain: [
        { prefix: 's', algo: 'slicer', params: { depth: 0.8 } },
        { prefix: 'c', algo: 'crusher' },
        { prefix: 'f', algo: 'wah', params: { mode: 0, filter: 0, q: 0.25, level: 0.5 } },
      ] },
      controls: [
        K('c.rate', 'SMPL RATE', { def: 0.35 }), K('f.pos', 'FILTER', { def: 0.75 }), K('c.bits', 'BITS', { def: 0.55 }),
        K('s.depth', 'STUTTER', { def: 0.7 }), K('s.pattern', 'SEQUENCE', { min: 0, max: 15, step: 1, def: 3 }), K('s.time', 'TEMPO', { min: 60, max: 600, def: 180, display: ms }),
        TOG('seq', 'SEQ', ['off', 'gate', 'duck'], { def: 0 }), TOG('blend', 'MIX', ['blend', 'wet'], { def: 1 }),
        byp(), FOOT({ action: 'tap', label: 'TAP' }), led(), LED({ bind: 'tap:s.time', color: '#c9d83a' }),
      ],
      tapTarget: 's.time',
      ctrl: { ins: [{ label: 'EXP', param: 'f.pos', min: 0, max: 1 }] },
      derive: (p) => ({ 's.on': p.seq ? 1 : 0, 's.mode': p.seq === 2 ? 1 : 0, 'c.mix': p.blend ? 1 : 0.55, 'f.on': (p['f.pos'] ?? 0.75) > 0.97 ? 0 : 1 }),
      desc: 'Sample-rate / bit-depth crusher into a low-pass filter, with a rhythmic step sequencer (SEQ) that gates or ducks the sound in time with TAP.',
    }),
    M({
      id: 'mrs.enzo', name: 'Enrico Synth', ref: 'Meris Enzo', code: 'ENRICO', logo: 'enrico', typeName: 'Multi-voice instrument synth', cat: 'Synth',
      palette: ['#f27a1d', '#e8452c', '#f5c833'], cost: 1.8,
      algo: 'synth', fixed: { level: -6 },
      controls: [
        K('octave', 'PITCH', { min: -2, max: 1, step: 1, def: 0, display: (v) => (v > 0 ? '+' : '') + Math.round(v) + ' oct' }), K('filter', 'FILTER', { def: 0.55 }), K('mix', 'MIX', { def: 0.7, virtual: true }),
        K('decay', 'SUSTAIN', { def: 0.6 }), K('attack', 'ENVELOPE', { def: 0.15 }), K('reso', 'MODULATION', { def: 0.35 }),
        TOG('voice', 'SYNTH MODE', ['mono', 'poly', 'pad'], { def: 0 }), TOG('wave', 'WAVEFORM', ['saw', 'square'], { def: 0 }),
        byp(), FOOT({ action: 'param', p: 'sus', label: 'ALT · HOLD' }), led(), LED({ bind: 'param:sus', color: '#f5c833' }),
      ],
      initParams: { sus: 0 },
      ctrl: { ins: [{ label: 'EXP', param: 'filter', min: 0, max: 1 }] },
      derive: (p) => {
        const v = p.voice ?? 0, wv = p.wave ?? 0, mx = p.mix ?? 0.7;
        return { mode: v === 2 ? 6 : v === 1 ? (wv ? 2 : 3) : wv ? 0 : 1, wet: 0.2 + 0.7 * mx, dry: 1 - mx, decay: p.sus > 0.5 ? 1 : p.decay ?? 0.6, mod: p.reso ?? 0.35 };
      },
      desc: 'Pitch-tracking synth: mono / poly / pad voices with saw or square waves, resonant filter and envelope. ALT holds the note.',
    }),
    M({
      id: 'mrs.lvx', name: 'Lumx Delay System', ref: 'Meris LVX', code: 'LUMX', logo: 'lumx', typeName: 'Modular delay system', cat: 'Delay', big: true,
      palette: ['#ff5a3c', '#ffad33', '#f2e03a', '#5ad17a', '#4fb8ff', '#a77cff'], cost: 1.8,
      algo: 'delay', opts: { maxMs: 2600 },
      controls: [
        SCREEN('meris-oled', { param: 'dtype', names: LVX_T, status: (v) => `${Math.round(v('time', 450))} MS`, meter: (v) => v('feedback', 0.4) }),
        SEL('dtype', 'TYPE', LVX_T, { role: 'type', def: 0, sweep: 300 }),
        K('time', 'TIME', { min: 20, max: 2500, def: 450, display: ms, curve: 'log' }), K('feedback', 'FEEDBACK', { def: 0.4, max: 1.1 }), K('mix', 'MIX', { def: 0.35 }),
        K('moddepth', 'MOD', { def: 0.15 }), K('tone', 'FILTER', { def: 0.6 }), K('character', 'CHARACTER', { def: 0.3, virtual: true }),
        TOG('subdiv', 'TEMPO', ['1/4', 'dot', 'trip'], { values: [0, 1, 3] }), TOG('stereo', 'SPREAD', ['narrow', 'wide'], { def: 1, virtual: true }),
        byp(), FOOT({ action: 'tap', label: 'TAP', hold }), FOOT({ action: 'favorite', label: 'PRESET' }),
        led(), LED({ bind: 'tap:time', color: '#4fb8ff' }), LED({ bind: 'fav', color: '#f2e03a' }),
      ],
      ctrl: { ins: [{ label: 'EXP', param: 'feedback', min: 0, max: 1 }] },
      derive: (p) => ({ mode: LVX_M[p.dtype ?? 0], age: p.character ?? 0.3, sat: 0.1 + 0.5 * (p.character ?? 0.3), spread: p.stereo ? 0.8 : 0.2, modrate: 0.3 }),
      desc: 'Approximation of a modular delay system: 10 delay types on the display, CHARACTER sets age / saturation, hold TAP to freeze, PRESET recalls a favourite.',
    }),
    M({
      id: 'mrs.mercuryx', name: 'HermesX Reverb System', ref: 'Meris MercuryX', code: 'HERMESX', logo: 'hermesX', typeName: 'Modular reverb system', cat: 'Reverb', big: true,
      palette: ['#2b6fe0', '#33b6d8', '#5ad1c8', '#8fd6ff', '#7c8cff', '#b48cff'], cost: 1.8,
      algo: 'reverb',
      controls: [
        SCREEN('meris-oled', { param: 'rtype', names: MX_T, status: (v) => `DECAY ${Math.round(v('decay', 0.6) * 100)}`, meter: (v) => v('mix', 0.38) }),
        SEL('rtype', 'TYPE', MX_T, { role: 'type', def: 3, sweep: 300 }),
        K('decay', 'DECAY', { def: 0.6 }), K('mix', 'MIX', { def: 0.38 }), K('predelay', 'PRE-DELAY', { min: 0, max: 500, def: 20, display: ms }),
        K('mod', 'MODULATE', { def: 0.3 }), K('lowcut', 'LO FREQ', { def: 0.15 }), K('tone', 'HI FREQ', { def: 0.6 }),
        TOG('size', 'SIZE', ['small', 'large'], { def: 1, values: [0.4, 0.9] }), TOG('pitch', 'PITCH', ['off', '+oct'], { virtual: true }),
        byp(), FOOT({ action: 'param', p: 'inf', label: 'HOLD' }), FOOT({ action: 'favorite', label: 'PRESET' }),
        led(), LED({ bind: 'param:inf', color: '#8fd6ff' }), LED({ bind: 'fav', color: '#f2e03a' }),
      ],
      initParams: { inf: 0 },
      ctrl: { ins: [{ label: 'EXP', param: 'decay', min: 0, max: 1 }] },
      derive: (p) => ({ mode: p.pitch ? 4 : MX_M[p.rtype ?? 3], shimmer: p.pitch ? 0.6 : 0.5, decay: p.inf > 0.5 ? 1 : p.decay ?? 0.6, size: (p.rtype ?? 3) === 3 ? 1 : [0.4, 0.9][p.size ?? 1] }),
      desc: 'Approximation of a modular reverb system: 10 reverb types on the display, PITCH adds an octave shimmer, HOLD freezes the tail.',
    }),
  ]);
}
