// Built-in Tone Zone plugin: Old Blood Noise Endeavors.
// Blocks inspired by OBNE pedals (Oklahoma). Names and artwork are Tone Zone originals; control sets, toggles,
// sliders and footswitches follow the real units (see each block's `ref`). One custom "obne-geo" enclosure serves
// the family: a matte two-tone powder coat with a bold, flat geometric composition (arches, split suns, cascading
// bowls, ghost waves) printed in two inks, chunky lower-case wordmark and "80s catalogue" plastic knobs.
export default function register(tz) {
  const { K, TOG, FOOT, LED, SLIDER, def, ten, ms, STEREO, MONO } = tz.helpers;
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
  // ------------------------------------------------------------------ compositions (100 x 60 box)
  const COMP = {
    arches(A) {
      [46, 38, 30, 22, 14].forEach((r, i) => A.f(`M${50 - r} 60A${r} ${r} 0 0 1 ${50 + r} 60Z`, i % 2 ? A.ink2 : A.ink));
      A.f('M50 60m-6 0a6 6 0 0 1 12 0Z', A.bg);
      A.f('M82 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0Z', A.ink2);
    },
    split(A) {
      A.f('M50 30m-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0Z', A.ink);
      A.f('M68.4 11.6A26 26 0 0 1 31.6 48.4Z', A.ink2);
      for (let i = 0; i < 5; i++) A.f(`M${4 + i * 6} ${50 - i * 0}h3v10h-3z M${70 + i * 6} 0h3v10h-3z`, i % 2 ? A.ink2 : A.ink);
    },
    fountain(A) {
      [[50, 14, 20], [36, 32, 16], [64, 32, 16], [50, 50, 22]].forEach(([x, y, r], i) => A.f(`M${x - r} ${y}A${r} ${r * 0.7} 0 0 0 ${x + r} ${y}Z`, i % 2 ? A.ink2 : A.ink));
      [[50, 3], [28, 22], [72, 22], [50, 39]].forEach(([x, y]) => A.f(`M${x} ${y}q3 4 0 6q-3 -2 0 -6Z`, A.ink2));
      A.f('M14 58h72v2h-72z', A.ink);
    },
    haunt(A) {
      for (let i = 0; i < 5; i++) A.o(`M0 ${16 + i * 9} q12.5 ${i % 2 ? -7 : 7} 25 0 t25 0 t25 0 t25 0`, 3, i % 2 ? A.ink2 : A.ink);
      A.f('M50 30m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0Z', A.bg);
      A.o('M50 30m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0Z', 3, A.ink);
      A.f('M50 30m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z', A.ink2);
    },
  };

  let seq = 0;
  tz.addForm('obne-geo', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 124, H = d.h || 240;
    const id = 'ob' + ++seq;
    const ink = d.ink || '#1d1d1f', ink2 = d.ink2 || '#d9653b', bg = d.color;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [0, 0, 0], 0, 0.14, 1);
    formKit.body(g, W, H, bg, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: d.knobR || 11, top: 18, pad: 10, footX: d.footX });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 26, Math.min(22, (z1 - z0) * 0.3), 0.6);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    // art panel: a rounded window in the second body colour
    const ay = z0, ah = nameY - ns * 0.62 - 5 - z0;
    if (ah > 20) {
      svg('rect', { x: 9, y: ay, width: W - 18, height: ah, rx: 5, fill: d.panel || '#efe6d2' }, g);
      const cp = svg('clipPath', { id: id + 'c' }, defs);
      svg('rect', { x: 9, y: ay, width: W - 18, height: ah, rx: 5 }, cp);
      const s = Math.min((W - 26) / 100, (ah - 8) / 60);
      const art = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${ay + (ah - 60 * s) / 2}) scale(${s})` }, svg('g', { 'clip-path': `url(#${id}c)` }, g));
      const A = { ink, ink2, bg: d.panel || '#efe6d2',
        f: (dd, fill) => svg('path', { d: dd, fill }, art),
        o: (dd, w, col) => svg('path', { d: dd, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round' }, art) };
      (COMP[d.comp] || COMP.arches)(A);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: d.text || ink, font: "'Inter', sans-serif", weight: 800, ls: -0.3 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 26, 5, 0.62), fill: d.text || ink, weight: 700, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 8.5, d.text || ink, 3.8);
    togTitles(g, L, d.text || ink);
    const theme = { toggleTitles: false, text: d.text || ink, knob: d.knob || 'cream', labelSize: 5.8, labelFont: "'Inter', sans-serif", labelWeight: 700, labelLs: 0.5 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const O = (o) => def(Object.assign({ form: 'obne-geo', brand: 'Old Blood Noise Endeavors', cost: 0.9 }, o, {
    controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));
  const ahModes = [...Array(16)].map((_, i) => (i < 8 ? { gainMaxDb: 40, bias: 0.05 + (i % 8) * 0.06 } : { gainMaxDb: 56, bias: 0.05 + (i % 8) * 0.06 }));

  tz.addDefs([
    O({
      id: 'obne.dweller', name: 'Lurker Phase Repeater', ref: 'Old Blood Noise Endeavors Dweller', logo: 'lurker', tagline: 'PHASE REPEATER', cat: 'Modulation', typeName: 'Phaser + delay repeater',
      color: '#3e6b4f', ink: '#16251c', ink2: '#e9b949', panel: '#e8e1cc', text: '#f1ecdc', comp: 'arches', rows: [3, 2], h: 272, cost: 1.1,
      algo: 'chain', opts: { chain: [
        { prefix: 'ph', algo: 'phaser', params: { center: 0.5 } },
        { prefix: 'dl', algo: 'delay', opts: { maxMs: 700 }, params: { mode: 4, tone: 0.5, modrate: 0.4 } },
      ] },
      controls: [
        K('ph.rate', 'RATE', { def: 0.3 }), K('ph.depth', 'DEPTH', { def: 0.7 }), K('regen', 'REGEN', { def: 0.45, virtual: true }),
        K('stretch', 'STRETCH', { def: 0.35, virtual: true }), K('mix', 'MIX', { def: 0.5, virtual: true }),
        TOG('voice', 'VOICE', ['4', '8'], { def: 0, virtual: true }), TOG('shape', 'SHAPE', ['SIN', 'TRI', 'RND'], { def: 0, virtual: true }),
      ],
      ctrl: { ins: [{ label: 'EXP', param: 'stretch', min: 0, max: 1 }] },
      derive: (p) => {
        const st = p.stretch ?? 0.35, rg = p.regen ?? 0.45, mx = p.mix ?? 0.5, sh = p.shape ?? 0;
        return { 'ph.stages': (p.voice ?? 0) ? 8 : 4, 'ph.feedback': 0.15 + 0.75 * rg, 'ph.mix': mx,
          'dl.time': 18 + 600 * st * st, 'dl.feedback': 0.7 * rg, 'dl.mix': mx * (0.1 + 0.4 * st), 'dl.moddepth': [0.1, 0.2, 0.45][sh], 'dl.modrate': [0.3, 0.45, 0.8][sh] };
      },
      desc: 'Phaser whose stages are stretched into short delays: low STRETCH is a lush phaser, high STRETCH turns it into phased, pitch-warped repeats. SHAPE RND is approximated with heavier, faster delay wobble.',
    }),
    O({
      id: 'obne.excess', name: 'Surplus Distorting Modulator', ref: 'Old Blood Noise Endeavors Excess V2', logo: 'surplus', tagline: 'DISTORTING MODULATOR', cat: 'Multi-FX', kind: 'Pedal', typeName: 'Distortion + chorus / delay / fifth',
      color: '#2f3b52', ink: '#141a26', ink2: '#e15f4f', panel: '#e6dfcf', text: '#eef0f4', comp: 'split', w: 150, h: 296, rows: [3, 3], noStd: true, cost: 1.6,
      algo: 'chain', opts: { chain: [
        { prefix: 'd1', algo: 'drive', opts: { clip: 'opamp', tone: 'lp', toneLo: 900, toneHi: 7000, gainMinDb: 6, gainMaxDb: 46, preHp: 80, postLp: 8000, levelMinDb: -37, levelMaxDb: -3 } },
        { prefix: 'p', algo: 'pitch', params: { semis1: 7, level1: 0.35, level2: 0, level3: 0, dry: 1 } },
        { prefix: 'm', algo: 'delay', opts: { maxMs: 900 }, params: { mode: 0, tone: 0.55 } },
        { prefix: 'c', algo: 'chorus', params: { mode: 0 } },
        { prefix: 'd2', algo: 'drive', opts: { clip: 'opamp', tone: 'lp', toneLo: 900, toneHi: 7000, gainMinDb: 6, gainMaxDb: 46, preHp: 80, postLp: 8000, levelMinDb: -37, levelMaxDb: -3 } },
      ] },
      controls: [
        K('dvol', 'VOLUME', { def: 0.6, virtual: true, display: ten }), K('dtone', 'TONE', { def: 0.5, virtual: true, display: ten }), K('dgain', 'GAIN', { def: 0.45, virtual: true, display: ten }),
        K('mvol', 'VOLUME', { def: 0.5, virtual: true, display: ten }), K('mtime', 'TIME', { def: 0.4, virtual: true }), K('mdepth', 'DEPTH', { def: 0.45, virtual: true }),
        TOG('mode', 'MODE', ['DLY', 'CHO', '5TH'], { def: 1, virtual: true }), TOG('route', 'ROUTE', ['M>D', 'D>M'], { def: 1, virtual: true }),
        FOOT({ action: 'toggle', p: 'modOn', virtual: true, def: 1, label: 'MOD' }), FOOT({ action: 'toggle', p: 'distOn', virtual: true, def: 1, label: 'DIST' }),
        LED({ bind: 'param:modOn', color: '#3d8bff' }), LED({ bind: 'param:distOn', color: '#ff2a1a' }),
      ],
      derive: (p) => {
        const dOn = (p.distOn ?? 1) > 0.5, mOn = (p.modOn ?? 1) > 0.5, md = p.mode ?? 1, rt = p.route ?? 1;
        const dist = { level: p.dvol ?? 0.6, tone: p.dtone ?? 0.5, gain: p.dgain ?? 0.45 };
        const t = p.mtime ?? 0.4, dp = p.mdepth ?? 0.45, v = p.mvol ?? 0.5;
        const o = { 'd1.on': dOn && rt === 1 ? 1 : 0, 'd2.on': dOn && rt === 0 ? 1 : 0, 'p.on': mOn && md === 2 ? 1 : 0, 'm.on': mOn && md !== 1 ? 1 : 0, 'c.on': mOn && md === 1 ? 1 : 0,
          'm.time': 40 + 860 * t * t, 'm.feedback': 0.05 + 0.75 * dp, 'm.mix': 0.15 + 0.5 * v, 'p.level1': 0.25 + 0.25 * v,
          'c.rate': 0.05 + 0.75 * t, 'c.depth': dp, 'c.mix': 0.2 + 0.4 * v };
        for (const k in dist) { o['d1.' + k] = dist[k]; o['d2.' + k] = dist[k]; }
        return o;
      },
      desc: 'Op-amp distortion (top row) and a chorus / delay / fifth-harmony delay (bottom row) on their own footswitches. ROUTE puts the modulation before or after the distortion. The 5TH mode is approximated with a fifth-up voice feeding the delay.',
    }),
    O({
      id: 'obne.blackfountain', name: 'Ink Spring Oil Can Delay', ref: 'Old Blood Noise Endeavors Black Fountain V3', logo: 'ink spring', tagline: 'OIL CAN DELAY', cat: 'Delay', typeName: 'Oil-can style delay',
      color: '#c75b3f', ink: '#1f1612', ink2: '#f2c14e', panel: '#f1e7d6', text: '#fff4ea', comp: 'fountain', rows: [2, 2], h: 280, stereo: 'both', monoPorts: MONO, stereoPorts: STEREO, noStd: true, cost: 1.1,
      algo: 'delay', opts: { maxMs: 1500, defaultMs: 420 },
      controls: [
        K('fluid', 'FLUID', { def: 0.4, virtual: true }), K('time', 'TIME', { min: 40, max: 1500, def: 420, curve: 'log', display: ms }),
        K('mix', 'MIX', { def: 0.4 }), K('feedback', 'FEEDBACK', { min: 0, max: 1.08, def: 0.45 }),
        TOG('subdiv', 'SUBDIVISION', ['1/4', 'D8', '1/8'], { def: 0, values: [0, 1, 2] }), TOG('voice', 'VOICE', ['I', 'II', 'III'], { def: 0, virtual: true }),
        FOOT({ action: 'tap', label: 'TAP', hold: { ms: 600, event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), FOOT({ label: 'BYPASS' }),
        LED({ bind: 'tap:time', color: '#ffb000' }), LED({ color: '#ff2a1a' }),
      ],
      derive: (p) => {
        const f = p.fluid ?? 0.4, v = p.voice ?? 0;
        const voice = [{ mode: 1, tone: 0.42, age: 0.55 }, { mode: 4, tone: 0.6, age: 0.3 }, { mode: 2, tone: 0.48, age: 0.7, heads: 4 }][v];
        return Object.assign({ moddepth: 0.06 + 0.6 * f, modrate: 0.2 + 0.5 * f }, voice);
      },
      desc: 'Lush oil-can style echo. FLUID sets the amount of warble, VOICE picks dark analog-like, cleaner modulated or tape-saturated repeats. Hold TAP to make the repeats run away.',
    }),
    O({
      id: 'obne.alphahaunt', name: 'Prime Spectre Fuzz', ref: 'Old Blood Noise Endeavors Alpha Haunt', logo: 'prime spectre', tagline: 'STREAMLINED FUZZ', cat: 'Fuzz', typeName: 'Fuzz with gate, bias, LPF and 3-band EQ',
      color: '#efe8da', ink: '#232026', ink2: '#7c6bb0', panel: '#2d2833', text: '#232026', comp: 'haunt', w: 200, h: 336, rows: [4, 3], knobR: 10.5, cost: 1.1,
      algo: 'chain', opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 10, tone: 'none', gainMinDb: 8, preHp: 40, postLp: 9000, levelMinDb: -44, levelMaxDb: -8, cleanSum: true, modes: ahModes } },
        { prefix: 'g', algo: 'gate', params: { decay: 0.3, attack: 0.05 } },
        { prefix: 'e', algo: 'peq', params: { lowfreq: 120, mid1freq: 700, mid1q: 0.8, highfreq: 3200 } },
      ] },
      controls: [
        K('e.level', 'MASTER', { min: -18, max: 12, def: 0, display: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' }), K('f.level', 'FUZZ VOL', { def: 0.62, display: ten }), K('enh', 'ENHANCE', { def: 0.2, virtual: true }), K('f.gain', 'FUZZ', { def: 0.6, display: ten }),
        K('gate', 'GATE', { def: 0, virtual: true }), K('bias', 'BIAS', { def: 0.3, virtual: true }), K('lpf', 'LPF', { def: 0.6, virtual: true }),
        TOG('range', 'RANGE', ['LO', 'HI'], { def: 0, virtual: true }), TOG('lpm', 'LPF MODE', ['OFF', '1', '2'], { def: 1, virtual: true }),
        SLIDER('e.lowgain', 'LOW', { min: -12, max: 12, def: 0, h: 34 }), SLIDER('e.mid1gain', 'MID', { min: -12, max: 12, def: 0, h: 34 }), SLIDER('e.highgain', 'HIGH', { min: -12, max: 12, def: 0, h: 34 }),
      ],
      derive: (p) => {
        const lp = p.lpf ?? 0.6, m = p.lpm ?? 1;
        return { 'f.mode': (p.range ?? 0) * 8 + Math.round((p.bias ?? 0.3) * 7), 'f.blend': 1 - 0.65 * (p.enh ?? 0.2), 'g.threshold': 0.6 * (p.gate ?? 0),
          'e.highcut': m === 0 ? 20000 : m === 1 ? 1500 + 14000 * lp * lp : 1200 + 9000 * lp * lp, 'e.mid2freq': 1200 + 6000 * lp * lp, 'e.mid2gain': m === 2 ? 6 : 0, 'e.mid2q': 3 };
      },
      desc: 'Flexible silicon fuzz: FUZZ / RANGE for the gain, BIAS from smooth to splatty, ENHANCE blends clean signal back in, GATE tames the hiss, and a low-pass filter (mode 2 adds a resonant peak) plus a three-band slider EQ shape the result.',
    }),
  ]);
}
