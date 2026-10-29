// Built-in Tone Zone plugin: Wampler Pedals.
// Blocks inspired by Wampler pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). Two enclosures: "wmp-mini" (mini box, lamp-post art) and "wmp-std" (gloss 125B / wide box with
// fine-line art and a script name).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
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
  tz.addForm('wmp-mini', (ctx, d) => {
    const g = ctx.g;
    const W = 96, H = 196;
    const id = 'wm' + ++seq;
    const ink = d.ink || '#1d2b3a';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 30, 64, [255, 255, 255], 0, 0.14, 0);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: 9, top: 18, pad: 6, footB: 28 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 18, 16, 0.6);
    const nameY = z1 - (tag ? 8 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 4;
    if (ab - z0 > 16) {
      const s = Math.min((W - 16) / 100, (ab - z0) / 60);
      const a = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${z0 + (ab - z0 - 60 * s) / 2}) scale(${s})`, fill: 'none', stroke: ink, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      svg('path', { d: 'M50 58V18 M44 58h12 M46 52h8 M42 18h16 l-3 -9h-10z M50 9V5 M45 18v-1 M55 18v-1' }, a);
      svg('circle', { cx: 50, cy: 14, r: 2.4, fill: '#f6d36b', stroke: 'none' }, a);
      svg('path', { d: 'M50 14m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0', stroke: '#f6d36b', 'stroke-opacity': 0.6, 'stroke-width': 1 }, a);
      svg('path', { d: 'M4 58 Q30 50 50 58 Q72 50 96 58 M10 46 L16 30 L22 46 M80 48 L86 32 L92 48', 'stroke-width': 1.3 }, a);
      [[20, 10], [30, 22], [72, 8], [84, 20], [64, 30], [12, 30], [36, 40], [76, 40]].forEach(([x, y]) => svg('path', { d: `M${x - 1.6} ${y}h3.2M${x} ${y - 1.6}v3.2`, 'stroke-width': 0.9 }, a));
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Inter', sans-serif", weight: 700, ls: 1 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 18, 4.6, 0.62), fill: ink, weight: 700, ls: 1.2, opacity: 0.8 });
    formKit.tzBadge(g, W / 2, H - 7.5, ink, 3.4);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.2, labelFont: "'Inter', sans-serif", labelWeight: 700, labelLs: 0.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });


  // Standard 125B / wide boxes: gloss paint with metal flake, a thin inset line, a fine-line art panel per model
  // (`art`), the model name in script and a small shield emblem.
  const ART = {
    columns(a) {
      a.S('M10 54H90 M14 50H86 M18 18H82 M50 4L84 16H16Z');
      for (let i = 0; i < 6; i++) { const x = 22 + i * 11.2; a.S(`M${x} 20V48 M${x + 4} 20V48`, 1); }
    },
    plexi(a) {
      a.S('M14 10H86V52H14Z');
      a.S('M18 14H82V24H18Z', 1);
      for (let i = 0; i < 6; i++) a.C(26 + i * 9.6, 19, 2.2);
      for (let y = 30; y < 50; y += 4) a.S(`M18 ${y}H82`, 0.6);
    },
    flame(a) {
      a.S('M50 56C30 52 28 34 40 22C40 32 46 34 48 30C44 20 50 10 56 4C56 16 66 22 66 34C70 30 70 26 68 22C78 34 74 52 50 56Z');
      a.S('M50 50C42 48 42 40 47 34C48 40 52 40 52 36C56 40 58 48 50 50Z', 1);
    },
    fusion(a) {
      a.C(38, 30, 20); a.C(62, 30, 20);
      a.S('M50 14V46 M44 30H56', 1);
    },
    paisley(a) {
      const drop = (x, y, s, r) => a.S(`M${x} ${y}c${-8 * s} ${-2 * s} ${-12 * s} ${-12 * s} ${-4 * s} ${-18 * s}c${6 * s} ${-4 * s} ${14 * s} ${2 * s} ${12 * s} ${10 * s}c${-1 * s} ${4 * s} ${-4 * s} ${6 * s} ${-8 * s} ${8 * s}`, 1.2, `rotate(${r} ${x} ${y})`);
      drop(30, 40, 1.2, -20); drop(70, 36, 1.1, 160); drop(52, 56, 0.8, 40); drop(80, 58, 0.6, -40); drop(20, 58, 0.6, 30);
      a.C(30, 28, 2.4); a.C(70, 26, 2.2);
    },
    reels(a) {
      for (const cx of [30, 70]) { a.C(cx, 26, 18); a.C(cx, 26, 4); for (let k = 0; k < 3; k++) { const t = (k * 2 * Math.PI) / 3; a.S(`M${cx + Math.cos(t) * 6} ${26 + Math.sin(t) * 6}L${cx + Math.cos(t) * 15} ${26 + Math.sin(t) * 15}`, 1); } }
      a.S('M30 44L44 56H56L70 44', 1);
    },
    meter(a) {
      a.S('M14 54A40 40 0 0 1 86 54', 1.4);
      for (let i = 0; i <= 8; i++) { const t = Math.PI + (i / 8) * Math.PI; a.S(`M${50 + Math.cos(t) * 34} ${56 + Math.sin(t) * 34}L${50 + Math.cos(t) * 40} ${56 + Math.sin(t) * 40}`, 1); }
      a.S('M50 56L68 26', 1.6); a.C(50, 56, 3);
    },
  };
  const SIZE = { n: [124, 232], w: [176, 232] };
  tz.addForm('wmp-std', (ctx, d) => {
    const g = ctx.g;
    const [W, H] = SIZE[d.size || 'n'];
    const id = 'wms' + ++seq;
    const ink = d.ink || '#f4efe2';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.18, 0);
    const gl = svg('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0.4, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.28 }, gl);
    svg('stop', { offset: 0.35, 'stop-color': '#fff', 'stop-opacity': 0.03 }, gl);
    svg('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.2 }, gl);
    formKit.body(g, W, H, d.color, { rx: 7 });
    svg('rect', { width: W, height: H, rx: 7, fill: `url(#${id}n)` }, g);
    svg('rect', { width: W, height: H, rx: 7, fill: `url(#${id}g)` }, g);
    svg('rect', { x: 5, y: 5, width: W - 10, height: H - 10, rx: 4, fill: 'none', stroke: ink, 'stroke-opacity': 0.5, 'stroke-width': 0.7 }, g);
    if (d.split) svg('line', { x1: W / 2, x2: W / 2, y1: 14, y2: 112, stroke: ink, 'stroke-opacity': 0.4, 'stroke-width': 0.7, 'stroke-dasharray': '2 2' }, g);
    const L = layout(d, W, H, { kr: d.size === 'w' ? 11 : 11.5, top: 16, pad: 8, footB: 32, perRow: d.perRow || 3 });
    const name = d.logo || d.name, tag = d.tagline;
    const ns = fit(name, W - 22, d.logoSize || 21, 0.48);
    const z0 = L.y + 2, z1 = L.artBottom;
    const tagY = z1 - 2, nameY = tag ? tagY - 6 - ns * 0.45 : z1 - ns * 0.5;
    const ab = nameY - ns * 0.6 - 3;
    if (d.art && ART[d.art]) {
      // no room above the name: print the art faintly behind it instead
      const roomy = ab - z0 > 14, top = roomy ? z0 : z0 - 2, bot = roomy ? ab : z1;
      const s = Math.min((W - 24) / 100, (bot - top) / 60);
      const tr = `translate(${((W - 100 * s) / 2).toFixed(2)} ${(top + (bot - top - 60 * s) / 2).toFixed(2)}) scale(${s.toFixed(3)})`;
      const ag = svg('g', { transform: tr, fill: 'none', stroke: d.artInk || ink, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': roomy ? 0.85 : 0.22 }, g);
      ART[d.art]({
        S: (p, w, t) => svg('path', { d: p, 'stroke-width': w, transform: t }, ag),
        C: (cx, cy, r) => svg('circle', { cx, cy, r }, ag),
      });
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Dancing Script', cursive", weight: 700 });
    if (tag) label(g, W / 2, tagY, tag, { size: fit(tag, W - 24, 5, 0.62), fill: ink, weight: 700, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 8, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.8, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 700, labelLs: 0.5 };
    togTitles(g, L, ink);
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const W = (o) => def(Object.assign({ form: 'wmp-std', brand: 'Wampler', cost: 0.7 }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#3d8bff' })])] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  // Bluesbreaker / plexi style drive voicings shared by a few models
  const bbV = { clip: 'si', bias: 0.1, preHp: 70, gainMinDb: 2, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 10, bassF: 120, midF: 800, trebleF: 2600, postLp: 8000, levelMaxDb: 8 };
  const plexV = { clip: 'tube', stages: 2, stage2Db: 8, bias: 0.25, preHp: 90, gainMinDb: 6, gainMaxDb: 42, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 650, trebleF: 2800, postLp: 7500, levelMaxDb: 4 };

  tz.addDefs([
    def({
      id: 'wmp.tumnus', name: 'Satyr Mini', ref: 'Wampler Tumnus', brand: 'Wampler', logo: 'SATYR', tagline: 'TRANSPARENT OVERDRIVE', cat: 'Overdrive', typeName: 'Klon-style mini overdrive',
    form: 'wmp-mini', color: '#bcd3e2', ink: '#1d2b3a', cost: 0.6,
    algo: 'drive', opts: { clip: 'ge', cleanSum: true, cleanMix: 0.55, preHp: 60, clipHp: 400, gainMinDb: 0, gainMaxDb: 36, tone: 'tilt', trebleF: 1400, eqRangeDb: 8, postLp: 9500, levelMinDb: -24, levelMaxDb: 10 },
    controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('tone', 'TREBLE', { def: 0.5, display: ten }), K('gain', 'GAIN', { def: 0.35, display: ten }), FOOT({ r: 11 }), LED({ color: '#3d8bff', r: 2.4 })],
    desc: 'Mini-sized take on the legendary clean-blend "K" overdrive: a clean boost at low gain, open and amp-like when pushed.',
    }),
    W({
      id: 'wmp.pantheon', name: 'Parthenon Drive', ref: 'Wampler Pantheon', logo: 'Parthenon', tagline: 'OVERDRIVE', cat: 'Overdrive', typeName: 'Bluesbreaker-style overdrive',
      color: '#5f9ccc', ink: '#f6f2e6', art: 'columns',
      algo: 'drive', opts: Object.assign({}, bbV, { modes: [{ postLp: 6200 }, { postLp: 9500 }, { postLp: 6200, gainMaxDb: 42 }, { postLp: 9500, gainMaxDb: 42 }] }),
      fixed: { mid: 0.5 }, rows: [2, 2],
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.45 }), k('treble', 'TREBLE'), k('bass', 'BASS'),
        TOG('voice', 'VOICE', ['SMOOTH', 'OPEN'], { virtual: true }), TOG('range', 'GAIN', ['LO', 'HI'], { virtual: true })],
      derive: (p) => ({ mode: (p.voice ? 1 : 0) + (p.range ? 2 : 0) }),
      desc: 'Bluesbreaker-style drive. VOICE picks smooth or open highs, GAIN picks the low or high gain range.',
    }),
    W({
      id: 'wmp.plexidrive', name: 'Plexus Drive Deluxe', ref: 'Wampler Plexi-Drive Deluxe', logo: 'Plexus Deluxe', tagline: 'BRITISH OVERDRIVE', cat: 'Overdrive', typeName: 'Plexi-in-a-box',
      color: '#d7c18c', ink: '#3a2412', art: 'plexi', knob: 'chicken',
      algo: 'drive', opts: Object.assign({}, plexV, { modes: [{}, { gainMaxDb: 50, stage2Db: 14 }] }), rows: [3, 2],
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.5 }), k('bass', 'BASS'), k('mid', 'MIDS'), k('treble', 'TREBLE'),
        TOG('mode', 'GAIN', ['NORM', 'HI']), TOG('brt', 'BRIGHT', ['DARK', 'NORM', 'BRIGHT'], { def: 1, virtual: true })],
      derive: (p) => ({ bright: [0, 0.35, 0.9][p.brt ?? 1], tone: 0.5 }),
      desc: 'Plexi-style crunch with a 3-band EQ, a normal or high gain range and a three-way bright switch.',
    }),
    W({
      id: 'wmp.ecstasy', name: 'Euphoria Drive', ref: 'Wampler Ecstasy', logo: 'Euphoria', tagline: 'HIGH GAIN OVERDRIVE', cat: 'Distortion', typeName: 'Boutique amp in a box',
      color: '#22305e', ink: '#dfe5f2', art: 'flame', led: '#ff3b2f',
      algo: 'drive', opts: Object.assign({}, plexV, { clip: 'asym', bias: 0.18, gainMaxDb: 48, levelMaxDb: -1, modes: [
        { preEq: [{ type: 'peak', f: 700, q: 0.8, db: 3 }] }, { preEq: [{ type: 'peak', f: 1100, q: 0.9, db: 4 }], gainMaxDb: 52 }, { preEq: [{ type: 'ls', f: 200, q: 0.7, db: 2 }], gainMaxDb: 40 },
      ] }), rows: [3, 2],
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.5 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'),
        TOG('mode', 'VOICE', ['BLUE', 'RED', 'PLEXI']), TOG('shape', 'STRUCTURE', ['TIGHT', 'NORM', 'FAT'], { def: 1, virtual: true })],
      derive: (p) => ({ sag: [0, 0.2, 0.45][p.shape ?? 1], bright: p.shape === 0 ? 0.4 : 0 }),
      desc: 'Three amp voices (blue, red and plexi) plus a structure switch from tight to fat.',
    }),
    W({
      id: 'wmp.dualfusion', name: 'Twin Merge', ref: 'Wampler Dual Fusion', logo: 'Twin Merge', tagline: 'DUAL OVERDRIVE', cat: 'Overdrive', typeName: 'Dual overdrive',
      size: 'w', color: '#c4c9d2', ink: '#1d2433', art: 'fusion', split: true, noStd: true, cost: 1.1, perRow: 4,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: Object.assign({}, bbV, { modes: [{}, { gainMaxDb: 42 }] }) },
        { prefix: 'b', algo: 'drive', opts: Object.assign({}, plexV, { tone: 'lp', toneLo: 1500, toneHi: 8000, modes: [{}, { gainMaxDb: 50 }] }) },
      ] },
      rows: [4, 2],
      controls: [
        k('a.level', 'VOL'), k('a.gain', 'GAIN', { def: 0.4 }), k('b.level', 'VOL'), k('b.gain', 'GAIN', { def: 0.5 }),
        k('a.tone', 'TONE', { virtual: true }), k('b.tone', 'TONE'),
        TOG('a.mode', 'RANGE A', ['LO', 'HI']), TOG('b.mode', 'RANGE B', ['LO', 'HI']),
        FOOT({ action: 'param', p: 'a.on', toggle: true, label: 'A' }), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'B' }),
        LED({ bind: 'param:a.on', color: '#3d8bff' }), LED({ bind: 'param:b.on', color: '#3d8bff' }),
      ],
      derive: (p) => { const t = p['a.tone'] ?? 0.5; return { 'a.treble': t, 'a.bass': 1 - t * 0.6, 'a.mid': 0.5 }; },
      alwaysOn: true, initParams: { 'a.on': 1, 'b.on': 0 },
      desc: 'Two drives in one box. A is a smooth low-gain drive, B is a hotter amp-style drive. Stack them for more gain.',
    }),
    W({
      id: 'wmp.paisley', name: 'Swirl Drive', ref: 'Wampler Paisley Drive', logo: 'Swirl Drive', tagline: 'COUNTRY OVERDRIVE', cat: 'Overdrive', typeName: 'Country overdrive',
      color: '#efe6d2', ink: '#6b1a2c', art: 'paisley', artInk: '#2a5f8a',
      algo: 'drive', opts: Object.assign({}, bbV, { clip: 'ts', cleanSum: true, cleanMix: 0.3, clipHp: 650, gainMaxDb: 36, modes: [{}, { gainMaxDb: 46 }] }), rows: [3, 2],
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.4 }), k('tn', 'TONE', { virtual: true }), k('bass', 'BASS'), k('treble', 'TREBLE'),
        TOG('mode', 'GAIN', ['LO', 'HI']), TOG('brt', 'VOICE', ['DARK', 'NORM', 'BRIGHT'], { def: 1, virtual: true })],
      derive: (p) => ({ mid: 0.3 + (p.tn ?? 0.5) * 0.4, bright: [0, 0.3, 0.8][p.brt ?? 1] }),
      desc: 'Bright, snappy drive for chicken picking. TONE sets the mids, the voice switch adds or cuts sparkle.',
    }),
    W({
      id: 'wmp.fauxtape', name: 'Faux Reel Echo', ref: 'Wampler Faux Tape Echo V2', logo: 'Faux Reel', tagline: 'TAPE ECHO', cat: 'Delay', typeName: 'Tape echo',
      size: 'w', color: '#7a2222', ink: '#f2e3c4', art: 'reels', noStd: true, cost: 0.9,
      algo: 'delay', opts: { maxMs: 1200, fixedMode: 2 }, fixed: { mode: 2, heads: 4 },
      controls: [
        k('mix', 'MIX', { def: 0.35 }), K('time', 'DELAY', { min: 50, max: 1100, def: 380, display: ms, curve: 'log' }), k('feedback', 'REPEATS', { def: 0.4, max: 1.05 }),
        k('tone', 'TONE', { def: 0.45 }), k('moddepth', 'DEPTH', { def: 0.25 }), k('modrate', 'RATE', { def: 0.3 }),
        TOG('age', 'TAPE', ['NEW', 'USED', 'WORN'], { values: [0.15, 0.4, 0.75], def: 1 }), TOG('subdiv', 'TAP', ['1/4', 'DOT', '1/8'], { values: [0, 1, 2] }),
        FOOT({ action: 'tap', label: 'TAP' }), FOOT({ label: 'ON' }),
        LED({ bind: 'tap:time', color: '#ff3b2f' }), LED({ color: '#ff3b2f' }),
      ],
      desc: 'Warm tape-style echo with wow and flutter (DEPTH, RATE), tape wear switch and tap tempo.',
    }),
    W({
      id: 'wmp.ego', name: 'Self Compressor', ref: 'Wampler Ego Compressor', logo: 'Self', tagline: 'COMPRESSOR', cat: 'Dynamics', typeName: 'Blend compressor',
      color: '#e9e3d1', ink: '#1f2a44', art: 'meter', logoSize: 26,
      algo: 'comp', opts: { type: 'ota' }, rows: [3, 2],
      controls: [k('sustain', 'SUSTAIN', { def: 0.5 }), k('level', 'VOLUME', { def: 0.45 }), k('tone', 'TONE'), k('attack', 'ATTACK', { def: 0.35 }), k('blend', 'BLEND', { def: 0.65 })],
      desc: 'Studio-style compressor with a BLEND knob to mix in your dry signal and keep the pick attack.',
    }),
  ]);
}
