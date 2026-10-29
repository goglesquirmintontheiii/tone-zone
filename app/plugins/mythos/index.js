// Built-in Tone Zone plugin: Mythos Pedals.
// A block inspired by Mythos Pedals' "K"-style overdrive. Name and artwork are Tone Zone originals; controls follow
// the real unit (see `ref`). Custom "myth-forge" enclosure: dark forged-metal finish, a runic-knot border band and
// a war-hammer emblem with lightning, gold lettering.
export default function register(tz) {
  const { K, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;

  // ------------------------------------------------------------------ shared layout kit
  // Forms run more than once on shared control objects, so every control placed here is kept in `owned` and
  // laid out again on each call. Art only goes in the gap between the last control row and the LEDs.
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
  // the form prints toggle titles itself (theme.toggleTitles = false), a bit higher so the lever never hits them
  function togTitles(g, L, fill, o = {}) {
    L.togs.forEach((c) => { if (c.t === 'toggle' && c.label) tz.gfx.label(g, c.x, c.y - 21, c.label, { size: o.size || 5.6, fill, weight: 800, ls: 0.6, font: o.font }); });
  }
  let seq = 0;
  tz.addForm('myth-forge', (ctx, d) => {
    const g = ctx.g;
    const W = 116, H = 232;
    const id = 'my' + ++seq;
    const gold = '#d9b45a';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 26, 64, [255, 255, 255], 0, 0.16, 2);
    formKit.body(g, W, H, d.color, { rx: 6, brushed: true });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    // knot border: interlocking zig-zag band around the edge
    let z = '';
    for (let x = 10; x < W - 10; x += 8) z += `M${x} ${H - 4} l4 -3 l4 3 `;
    for (let y = 30; y < H - 14; y += 8) z += `M4 ${y} l3 4 l-3 4 M${W - 4} ${y} l-3 4 l3 4 `;
    svg('path', { d: z, fill: 'none', stroke: gold, 'stroke-width': 0.9, 'stroke-opacity': 0.8 }, g);
    const L = layout(d, W, H, { kr: 11, top: 20, pad: 9 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 38, 22, 0.58);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 5;
    if (ab - z0 > 20) {
      const s = Math.min((W - 24) / 100, (ab - z0) / 60);
      const a = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${z0 + (ab - z0 - 60 * s) / 2}) scale(${s})` }, g);
      svg('path', { d: 'M30 4 H70 V24 H58 L56 30 H44 L42 24 H30 Z', fill: gold, stroke: '#2a2210', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, a);
      svg('path', { d: 'M36 9 H64 M36 14 H64 M36 19 H64', stroke: '#2a2210', 'stroke-width': 1, 'stroke-opacity': 0.6 }, a);
      svg('path', { d: 'M46 30 H54 V54 Q50 58 46 54 Z', fill: '#6b4a2a', stroke: '#2a2210', 'stroke-width': 1.2 }, a);
      svg('path', { d: 'M46 36 L54 40 M46 42 L54 46 M46 48 L54 52', stroke: gold, 'stroke-width': 1 }, a);
      svg('path', { d: 'M20 8 L12 22 L18 22 L10 38 L24 18 L18 18 L24 8 Z M80 8 L88 22 L82 22 L90 38 L76 18 L82 18 L76 8 Z', fill: '#e8eef8' }, a);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: gold, font: "'Oswald', sans-serif", weight: 700, ls: 2 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 24, 5, 0.62), fill: gold, weight: 800, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 12, gold, 3.6);
    const theme = { toggleTitles: false, text: '#efe6cf', knob: 'chrome', labelSize: 6, labelFont: "'Oswald', sans-serif", labelWeight: 600, labelLs: 0.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  tz.addDefs(def({
    id: 'myth.mjolnir', name: 'Thunder Maul', ref: 'Mythos Pedals Mjolnir', brand: 'Mythos Pedals', logo: 'THUNDER MAUL', tagline: 'OVERDRIVE', cat: 'Overdrive', typeName: 'Klon-style overdrive',
    form: 'myth-forge', color: '#3b3d42', cost: 0.6,
    algo: 'drive', opts: { clip: 'ge', cleanSum: true, cleanMix: 0.5, preHp: 50, clipHp: 380, gainMinDb: 0, gainMaxDb: 38, tone: 'tilt', trebleF: 1300, eqRangeDb: 9, postLp: 10000, levelMinDb: -24, levelMaxDb: 10 },
    controls: [K('gain', 'GAIN', { def: 0.4, display: ten }), K('tone', 'TREBLE', { def: 0.5, display: ten }), K('level', 'OUTPUT', { def: 0.5, display: ten }), FOOT(), LED({ color: '#3d8bff' })],
    desc: 'Tweaked take on the most sought-after "K" overdrive, with a little more clean headroom and a sweeter drive (18 V internal rail).',
  }));
}
