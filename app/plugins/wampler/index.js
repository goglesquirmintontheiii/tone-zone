// Built-in Tone Zone plugin: Wampler Pedals.
// A block inspired by Wampler's mini transparent overdrive. Name and artwork are Tone Zone originals; controls follow
// the real unit (see `ref`). Custom "wmp-mini" enclosure: compact box in a pale metallic finish, a fine-line
// lamp-post-in-the-snow illustration and an elegant serif-less wordmark.
export default function register(tz) {
  const { K, FOOT, LED, def, ten } = tz.helpers;
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

  tz.addDefs(def({
    id: 'wmp.tumnus', name: 'Satyr Mini', ref: 'Wampler Tumnus', brand: 'Wampler', logo: 'SATYR', tagline: 'TRANSPARENT OVERDRIVE', cat: 'Overdrive', typeName: 'Klon-style mini overdrive',
    form: 'wmp-mini', color: '#bcd3e2', ink: '#1d2b3a', cost: 0.6,
    algo: 'drive', opts: { clip: 'ge', cleanSum: true, cleanMix: 0.55, preHp: 60, clipHp: 400, gainMinDb: 0, gainMaxDb: 36, tone: 'tilt', trebleF: 1400, eqRangeDb: 8, postLp: 9500, levelMinDb: -24, levelMaxDb: 10 },
    controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('tone', 'TREBLE', { def: 0.5, display: ten }), K('gain', 'GAIN', { def: 0.35, display: ten }), FOOT({ r: 11 }), LED({ color: '#3d8bff', r: 2.4 })],
    desc: 'Mini-sized take on the legendary clean-blend "K" overdrive: a clean boost at low gain, open and amp-like when pushed.',
  }));
}
