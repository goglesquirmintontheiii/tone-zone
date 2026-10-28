// Built-in Tone Zone plugin: Hologram Electronics.
// Blocks inspired by Hologram Electronics' sampling / texture machines. Names and artwork are Tone Zone originals;
// control sets follow the real units (see each block's `ref`). Both real units are far deeper than one engine
// block, so each is an approximation built as a chain (pitch, slicer, delay, reverb, drive, modulation, lo-fi …)
// whose sub-blocks are switched and voiced by the algorithm / module selectors.
// One custom "holo-prism" enclosure: dark anodised body with an iridescent prism band, concentric light rings
// and thin hairline lettering.
export default function register(tz) {
  const { K, SEL, FOOT, LED, def, ms, STEREO, MONO } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;

  // ------------------------------------------------------------------ shared layout kit
  // Forms run more than once and control objects are shared: every control this form positions is remembered in
  // `owned` and laid out again on each call. Knob labels sit above the knobs; art only goes in the free zone
  // between the last control row and the LEDs, so printed text never touches artwork or other text.
  const owned = new WeakSet();
  const fit = (s, maxW, maxSize, k = 0.6) => Math.min(maxSize, maxW / Math.max(1, String(s).length * k));
  function layout(d, W, H, o = {}) {
    const cs = d.controls.filter((c) => !c.hidden);
    cs.forEach((c) => { if (c.x === undefined) owned.add(c); });
    const mine = (c) => owned.has(c);
    const knobs = cs.filter((c) => mine(c) && (c.t === 'knob' || c.t === 'sel') && !c.togRow);
    const togs = cs.filter((c) => mine(c) && (c.t === 'toggle' || c.t === 'button' || c.togRow));
    const sliders = cs.filter((c) => mine(c) && c.t === 'slider');
    const feet = cs.filter((c) => mine(c) && c.t === 'foot');
    const leds = cs.filter((c) => mine(c) && c.t === 'led');
    const pad = o.pad ?? 8;
    let y = o.top ?? 18;
    const rows = [];
    let i = 0;
    for (const n of d.rows || []) { rows.push(knobs.slice(i, i + n)); i += n; }
    while (i < knobs.length) { rows.push(knobs.slice(i, i + (o.perRow || 3))); i += o.perRow || 3; }
    rows.filter((r) => r.length).forEach((row, ri) => {
      const r = row[0].r || (Array.isArray(d.knobR) ? d.knobR[ri] : d.knobR) || o.kr || 11;
      const sel = row.some((c) => c.t === 'sel');
      y += sel ? r + 20 : r + 12;
      const n = row.length, sp = (W - 2 * pad) / n;
      row.forEach((c, k) => {
        Object.assign(c, { x: pad + sp * (k + 0.5), y, r: c.r || r, labelPos: 'above' });
        if (c.t === 'sel') Object.assign(c, { optSize: c.optSize || 4.6, labelRadius: c.labelRadius ?? 7 });
      });
      y += sel ? r + 12 : r + 5;
    });
    if (togs.length) {
      y += togs.some((c) => c.t === 'sel') ? 34 : togs.some((c) => c.t === 'toggle' && c.label) ? 25 : 18;
      const n = togs.length, sp = (W - 2 * pad) / n;
      togs.forEach((c, k) => {
        Object.assign(c, { x: pad + sp * (k + 0.5), y });
        if (c.t === 'toggle') c.orient = c.orient || 'h';
        if (c.t === 'sel') Object.assign(c, { r: c.r || 8, labelPos: 'below', optSize: c.optSize || 4.4, labelRadius: c.labelRadius ?? 6 });
      });
      y += togs.some((c) => c.t === 'sel') ? 26 : 16;
    }
    if (sliders.length) {
      const sh = sliders[0].h || 36, n = sliders.length, sw = o.sliderSpan || Math.min(W - 2 * pad, n * 26);
      y += sh / 2 + 8;
      sliders.forEach((c, k) => Object.assign(c, { x: W / 2 - sw / 2 + (sw / n) * (k + 0.5), y, h: sh }));
      y += sh / 2 + 14;
    }
    const footY = H - (o.footB ?? 30);
    const fx = o.footX || (feet.length === 1 ? [W / 2] : feet.length === 2 ? [W * 0.27, W * 0.73] : [W * 0.2, W * 0.5, W * 0.8]);
    feet.forEach((f, k) => Object.assign(f, { x: fx[k], y: footY, r: f.r || 12, style: f.style || 'stomp' }));
    leds.forEach((l, k) => Object.assign(l, { x: fx[k] ?? W / 2, y: footY - 25, r: l.r || 2.8 }));
    return { y, footY, artBottom: footY - (leds.length ? 33 : 20), nFeet: feet.length, feet, leds, togs };
  }
  // toggle titles are printed by the form (theme.toggleTitles = false) a little higher than the core does, so the
  // lever tip never touches them
  function togTitles(g, L, fill, o = {}) {
    L.togs.forEach((c) => { if (c.t === 'toggle' && c.label) tz.gfx.label(g, c.x, c.y - 21, c.label, { size: o.size || 5.6, fill, weight: 800, ls: 0.6, font: o.font }); });
  }
  let seq = 0;
  tz.addForm('holo-prism', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 170, H = d.h || 300;
    const id = 'ho' + ++seq;
    const ink = d.ink || '#ecebf2';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.03, 1);
    const lg = svg('linearGradient', { id: id + 'p', x1: 0, y1: 0, x2: 1, y2: 0.3 }, defs);
    (d.prism || ['#7ee8fa', '#a78bfa', '#f472b6', '#fbbf24', '#80ffdb']).forEach((c, i, a) => svg('stop', { offset: i / (a.length - 1), 'stop-color': c }, lg));
    formKit.body(g, W, H, d.color || '#1d1f26', { rx: 8 });
    svg('rect', { width: W, height: H, rx: 8, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: d.knobR || 11, top: 20, pad: 10, perRow: d.perRow || 4 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 6, z1 = L.artBottom;
    const ns = fit(name, W - 40, 20, 0.62);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 6;
    if (ab - z0 > 14) {
      const h = ab - z0, cy = z0 + h / 2;
      // prism band + rings
      svg('rect', { x: 10, y: z0 + h * 0.3, width: W - 20, height: h * 0.4, rx: h * 0.2, fill: `url(#${id}p)`, 'fill-opacity': 0.85 }, g);
      const rr = Math.min(h * 0.48, W * 0.3);
      [1, 0.78, 0.56, 0.34].forEach((k, i) => svg('circle', { cx: W / 2, cy, r: rr * k, fill: i === 3 ? d.color || '#1d1f26' : 'none', stroke: ink, 'stroke-width': i === 0 ? 1.4 : 0.8, 'stroke-opacity': 0.75 }, g));
      svg('circle', { cx: W / 2, cy, r: rr * 0.14, fill: `url(#${id}p)` }, g);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Inter', sans-serif", weight: 300, ls: 2.4 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 30, 5, 0.62), fill: ink, weight: 700, ls: 1.8, opacity: 0.7 });
    formKit.tzBadge(g, W / 2, H - 8.5, ink, 3.8);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'strymon', labelSize: 5.8, labelFont: "'Inter', sans-serif", labelWeight: 600, labelLs: 0.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const HG = (o) => def(Object.assign({ form: 'holo-prism', brand: 'Hologram Electronics', stereo: 'stereo', ports: STEREO, monoPorts: MONO, stereoPorts: STEREO }, o));
  const ALGOS = ['MOS', 'SEQ', 'GLD', 'HAZ', 'TUN', 'STR', 'BLK', 'INT', 'ARP', 'PAT', 'WRP'];

  // Chroma Console module tables
  const CHAR = ['DRV', 'SWT', 'FUZ', 'HWL', 'SWL'], MOVE = ['DBL', 'VIB', 'PHS', 'TRM', 'PIT'], DIFF = ['CSC', 'RLS', 'SPC', 'CLG', 'REV'], TEXT = ['FLT', 'SQZ', 'CAS', 'BRK', 'INT'];

  tz.addDefs([
    HG({
      id: 'holo.microcosm', name: 'Minicosm', ref: 'Hologram Electronics Microcosm', logo: 'MINICOSM', tagline: 'GRANULAR LOOP SAMPLER', cat: 'Multi-FX', kind: 'Pedal', typeName: 'Granular / glitch delay machine',
      w: 196, rows: [1, 4, 3], knobR: 11, cost: 2.4, color: '#1d1f26',
      algo: 'chain', opts: { mix: true, chain: [
        { prefix: 'p', algo: 'pitch', params: { level1: 0.6, level2: 0, level3: 0, dry: 1 } },
        { prefix: 's', algo: 'slicer', params: { mix: 1, steps: 16 } },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { mix: 0.7 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 5, decay: 0.6, predelay: 20 } },
      ] },
      controls: [
        SEL('algo', 'ALGORITHM', ALGOS, { def: 3, virtual: true, sweep: 300, r: 14, optSize: 4.2, labelRadius: 8 }),
        K('act', 'ACTIVITY', { def: 0.5, virtual: true }), K('d.feedback', 'REPEATS', { min: 0, max: 1, def: 0.4 }), K('shape', 'SHAPE', { def: 0.5, virtual: true }), K('d.tone', 'FILTER', { def: 0.6 }),
        K('mix', 'MIX', { def: 0.5 }), K('r.mix', 'SPACE', { def: 0.3 }), K('d.time', 'TIME', { min: 40, max: 2000, def: 450, curve: 'log', display: ms }),
        FOOT({ action: 'tap', label: 'TAP', tapSub: 2, tapTarget: 'd.time', hold: { ms: 700, event: { type: 2, value: 1, arg: 200 }, release: { type: 2, value: 0, arg: 200 } } }), FOOT({ label: 'BYPASS' }),
        LED({ bind: 'tap:d.time', color: '#a78bfa' }), LED({ color: '#7ee8fa' }),
      ],
      derive: (p) => {
        const a = p.algo ?? 3, act = p.act ?? 0.5, sh = p.shape ?? 0.5;
        const T = [
          { p: [12, 0], s: 0, d: 0 }, { s: 3, d: 0 }, { p: [12, 0], glide: 0.85, d: 4 }, { d: 4, md: 0.5, r: 5 }, { p: [-12, 0], d: 6, r: 5 }, { s: 7, d: 0 },
          { s: 11, d: 5 }, { s: 13, d: 0, sm: 0.05 }, { p: [7, 12], s: 2, d: 0 }, { s: 5, d: 8 }, { d: 9, p: [-5, 0] },
        ][a];
        return { 'p.on': T.p ? 1 : 0, 'p.semis1': T.p ? T.p[0] : 0, 'p.semis2': T.p ? T.p[1] : 0, 'p.level1': 0.25 + 0.6 * act, 'p.level2': T.p && T.p[1] ? 0.4 * act : 0, 'p.glide': T.glide ?? 0.1,
          's.on': T.s ? 1 : 0, 's.pattern': T.s || 1, 's.depth': 0.4 + 0.6 * act, 's.smooth': T.sm ?? 0.05 + 0.6 * sh, 's.time': Math.max(30, (p['d.time'] ?? 450) / 4),
          'd.mode': T.d, 'd.moddepth': T.md ?? 0.1 + 0.3 * sh, 'r.mode': T.r ?? 5, 'r.decay': 0.5 + 0.35 * act };
      },
      desc: 'Eleven algorithms of granular, sequenced, glitched and smeared delays (MOSaic, SEQuence, GLiDe, HAZe, TUNnel, STRum, BLocKs, INTerrupt, ARPeggio, PATtern, WaRP). ACTIVITY drives the grains / pitch voices, SHAPE softens the envelopes, SPACE adds reverb. Hold TAP to freeze. Approximation: the real unit\'s per-algorithm variations and looper are not modelled.',
    }),
    HG({
      id: 'holo.chroma', name: 'Hue Console', ref: 'Hologram Electronics Chroma Console', logo: 'HUE CONSOLE', tagline: 'MULTI-TEXTURE PROCESSOR', cat: 'Multi-FX', kind: 'Pedal', typeName: 'Four-module texture multi-effect',
      color: '#ece9e2', ink: '#1d1d22', prism: ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5'], knob: 'mxr', w: 236, h: 304, rows: [4, 4], knobR: 11, cost: 2.6,
      algo: 'chain', opts: { mix: true, chain: [
        { prefix: 'c', algo: 'drive', opts: { tone: 'tilt', eqRangeDb: 8, preHp: 50, postLp: 9000, modes: [
          { clip: 'ts', gainMinDb: 0, gainMaxDb: 32, levelMinDb: -26, levelMaxDb: 0 }, { clip: 'clean', gainMinDb: 0, gainMaxDb: 8, levelMinDb: -6, levelMaxDb: 2 },
          { clip: 'muff', stages: 2, gainMinDb: 10, gainMaxDb: 50, levelMinDb: -40, levelMaxDb: -8 }, { clip: 'opamp', gainMinDb: 14, gainMaxDb: 46, levelMinDb: -38, levelMaxDb: -6, postEq: [{ type: 'peak', f: 1400, q: 3, db: 8 }] }] } },
        { prefix: 'sw', algo: 'swell', params: { sens: 0.5 } },
        { prefix: 'mc', algo: 'chorus' },
        { prefix: 'mp', algo: 'phaser', params: { stages: 6 } },
        { prefix: 'mt', algo: 'tremolo' },
        { prefix: 'mi', algo: 'pitch', params: { semis1: 0, cents: 14, level1: 0.5, level2: 0, level3: 0, dry: 1 } },
        { prefix: 'dd', algo: 'delay', opts: { maxMs: 1500 } },
        { prefix: 'dr', algo: 'reverb', params: { mode: 1 } },
        { prefix: 'tl', algo: 'lofi' },
        { prefix: 'tc', algo: 'comp', opts: { type: 'vca' } },
        { prefix: 'tx', algo: 'crusher' },
        { prefix: 'eq', algo: 'peq', params: { lowfreq: 250, highfreq: 2500 } },
      ] },
      controls: [
        K('ac', 'CHARACTER', { def: 0.35, virtual: true }), K('am', 'MOVEMENT', { def: 0.4, virtual: true }), K('ad', 'DIFFUSION', { def: 0.35, virtual: true }), K('at', 'TEXTURE', { def: 0.3, virtual: true }),
        K('tilt', 'TILT', { def: 0.5, virtual: true }), K('rate', 'RATE', { def: 0.35, virtual: true }), K('time', 'TIME', { def: 0.4, virtual: true }), K('mix', 'MIX', { def: 0.6 }),
        SEL('mc_', 'CHAR', CHAR, { def: 0, r: 10, labelRadius: 9, sweep: 220, optSize: 4.4, virtual: true, togRow: true }), SEL('mm_', 'MOVE', MOVE, { def: 0, r: 10, labelRadius: 9, sweep: 220, optSize: 4.4, virtual: true, togRow: true }), SEL('md_', 'DIFF', DIFF, { def: 2, r: 10, labelRadius: 9, sweep: 220, optSize: 4.4, virtual: true, togRow: true }), SEL('mx_', 'TEXT', TEXT, { def: 2, r: 10, labelRadius: 9, sweep: 220, optSize: 4.4, virtual: true, togRow: true }),
        FOOT({ action: 'tap', label: 'TAP', tapSub: 6, tapTarget: '_tap' }), FOOT({ label: 'BYPASS' }), LED({ color: '#ffd166', bind: 'tap:_tap' }), LED({ color: '#06d6a0' }),
      ],
      derive: (p) => {
        const ac = p.ac ?? 0.35, am = p.am ?? 0.4, ad = p.ad ?? 0.35, at = p.at ?? 0.3, rate = p.rate ?? 0.35, tm = p.time ?? 0.4, tilt = p.tilt ?? 0.5;
        const ch = p.mc_ ?? 0, mv = p.mm_ ?? 0, df = p.md_ ?? 2, tx = p.mx_ ?? 2;
        const o = {
          'c.on': ch < 4 && ac > 0.02 ? 1 : 0, 'c.mode': ch, 'c.gain': ac, 'c.level': 0.62, 'c.tone': 0.5, 'sw.on': ch === 4 ? 1 : 0, 'sw.attack': 0.15 + 0.8 * ac,
          'mc.on': mv <= 1 && am > 0.02 ? 1 : 0, 'mc.mode': mv === 0 ? 3 : 1, 'mc.rate': rate, 'mc.depth': am, 'mc.mix': mv === 0 ? 0.5 : 1, 'mc.level': 0.5,
          'mp.on': mv === 2 && am > 0.02 ? 1 : 0, 'mp.rate': rate, 'mp.depth': am, 'mp.mix': 0.5,
          'mt.on': mv === 3 && am > 0.02 ? 1 : 0, 'mt.rate': rate, 'mt.depth': am,
          'mi.on': mv === 4 && am > 0.02 ? 1 : 0, 'mi.cents': 4 + 40 * am, 'mi.semis1': am > 0.85 ? 12 : 0,
          'dd.on': df !== 2 && ad > 0.02 ? 1 : 0, 'dd.mode': [8, 2, 0, 3, 5][df], 'dd.time': 60 + 1200 * tm * tm, 'dd.mix': 0.15 + 0.45 * ad, 'dd.feedback': 0.15 + 0.6 * ad,
          'dr.on': df === 2 || df === 0 ? (ad > 0.02 ? 1 : 0) : 0, 'dr.mix': df === 2 ? 0.15 + 0.5 * ad : 0.2 * ad, 'dr.decay': 0.3 + 0.6 * tm,
          'tl.on': (tx === 2 || tx === 3) && at > 0.02 ? 1 : 0, 'tl.mode': tx === 2 ? 0 : 4, 'tl.wow': 0.1 + 0.6 * at, 'tl.age': 0.2 + 0.6 * at, 'tl.bits': 1 - 0.6 * at, 'tl.rate': 1 - 0.6 * at,
          'tc.on': tx === 1 && at > 0.02 ? 1 : 0, 'tc.sustain': 0.3 + 0.7 * at, 'tc.level': 0.55,
          'tx.on': tx === 4 && at > 0.02 ? 1 : 0, 'tx.bits': 1 - 0.7 * at, 'tx.rate': 0.15 + 0.5 * at, 'tx.mix': 0.6,
          'eq.lowgain': (0.5 - tilt) * 16, 'eq.highgain': (tilt - 0.5) * 16, 'eq.highcut': tx === 0 ? 20000 - 18500 * Math.sqrt(at) : 20000,
        };
        return o;
      },
      desc: 'Four modules in series – CHARACTER (drive / sweeten / fuzz / howl / swell), MOVEMENT (doubler / vibrato / phaser / tremolo / pitch), DIFFUSION (cascade / reels / space / collage / reverse) and TEXTURE (filter / squash / cassette / broken / interference) – each with its own amount knob and effect selector, plus a tilt EQ. Approximation of the real unit (no gesture recorder, presets or capture).',
    }),
  ]);
}
