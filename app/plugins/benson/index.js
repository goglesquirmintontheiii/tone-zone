// Built-in Tone Zone plugin: Benson Amps.
// A block inspired by Benson Amps' preamp pedal (their amp's front end in a box). Name and artwork are Tone Zone
// originals; controls follow the real unit (see `ref`). Custom "bns-grille" enclosure: grey hammertone box with an
// inset strip of wheat grille cloth framed in cream piping, cream chicken-head knobs and a script wordmark.
export default function register(tz) {
  const { K, FOOT, LED, def, ten, db } = tz.helpers;
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
  tz.addForm('bns-grille', (ctx, d) => {
    const g = ctx.g;
    const W = 120, H = 236;
    const id = 'bn' + ++seq;
    const ink = '#f1e8d2';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 22, 64, [0, 0, 0], 0, 0.3, 2);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: 11, top: 18, pad: 12, perRow: 2 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 6, z1 = L.artBottom;
    const ns = fit(name, W - 26, 24, 0.46);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.75 - 4;
    if (ab - z0 > 12) {
      svg('rect', { x: 12, y: z0, width: W - 24, height: ab - z0, rx: 4, fill: '#cdb98a' }, g);
      svg('rect', { x: 12, y: z0, width: W - 24, height: ab - z0, rx: 4, fill: 'url(#p-grille-wheat)' }, g);
      svg('rect', { x: 12, y: z0, width: W - 24, height: ab - z0, rx: 4, fill: 'none', stroke: '#efe3c3', 'stroke-width': 1.8 }, g);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Dancing Script', cursive", weight: 700 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 26, 5, 0.62), fill: ink, weight: 800, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 8.5, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: 'chicken', labelSize: 6, labelWeight: 800, labelLs: 0.8 };
    d.controls.forEach((c) => { if (c.t === 'knob') c.cap = 'white'; });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  tz.addDefs(def({
    id: 'bns.preamp', name: 'Benefactor Preamp', ref: 'Benson Amps Preamp Pedal', brand: 'Benson Amps', logo: 'Benefactor', tagline: 'PREAMP', cat: 'Preamp', kind: 'Pedal', typeName: 'Amp-in-a-box preamp / drive',
    form: 'bns-grille', color: '#5d6166', cost: 1.6,
    algo: 'amp', opts: { model: 'deluxe', preamp: true },
    fixed: { mid: 0.55, bright: 0.3 },
    controls: [K('gain', 'GAIN', { def: 0.45, display: ten }), K('level', 'VOLUME', { min: -24, max: 10, def: -3, display: db }), K('bass', 'BASS', { def: 0.5, display: ten }), K('treble', 'TREBLE', { def: 0.55, display: ten }), FOOT(), LED({ color: '#ff8a1f' })],
    desc: 'The front end of a boutique blackface-meets-plexi amp: chimey clean boost at low gain, rich edge-of-breakup to full crunch as GAIN goes up.',
  }));
}
