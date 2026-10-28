// Built-in Tone Zone plugin: Dwarfcraft Devices.
// A block inspired by Dwarfcraft Devices' two-stage "destroyer" distortion. Name and artwork are Tone Zone
// originals; the control set follows the real unit (see `ref`). Custom "dwc-doodle" enclosure: cream powder coat
// with a hand-inked cartoon monster (wobbly outlines, cross-hatching) and doodled lettering.
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
  tz.addForm('dwc-doodle', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 124, H = d.h || 250;
    const id = 'dw' + ++seq;
    const ink = '#171310', acc = d.accent || '#d8372b';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [80, 60, 30], 0, 0.14, 1);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: 11, top: 18, pad: 10, perRow: 2 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 24, 20, 0.56);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 5;
    if (ab - z0 > 20) {
      const s = Math.min((W - 20) / 100, (ab - z0) / 60);
      const a = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${z0 + (ab - z0 - 60 * s) / 2}) scale(${s})`, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      const P = (dd, fill, w = 1.8) => svg('path', { d: dd, fill: fill || 'none', stroke: ink, 'stroke-width': w }, a);
      // horns, head, eyes, toothy grin, little arms smashing a speaker cab
      P('M30 22 Q20 6 30 2 Q30 12 38 16Z M70 22 Q80 6 70 2 Q70 12 62 16Z', '#f3e7cf');
      P('M24 44 Q20 16 50 14 Q80 16 76 44 Q74 58 50 58 Q26 58 24 44Z', acc);
      P('M38 30m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z M62 30m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z', '#fff');
      P('M39 31m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0Z M61 31m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0Z', ink, 0.8);
      P('M32 44 Q50 54 68 44 Q50 48 32 44Z', '#fff');
      P('M37 45.5 l2 4 l2 -3.6 l2 4.2 l2 -4 l2 4.2 l2 -4 l2 4.2 l2 -4 l2 4 l2 -3.6 l2 3', null, 1.2);
      P('M24 46 Q12 48 8 40 M76 46 Q88 48 92 40', null, 2.4);
      P('M2 44h12v14h-12z M86 44h12v14h-12z', '#3a3530', 1.2);
      P('M27 22 l6 4 M26 28 l6 3 M68 20 l4 -3 M73 26 l5 -2', null, 1);
      [[12, 10], [90, 18], [8, 28]].forEach(([x, y]) => P(`M${x - 3} ${y}h6M${x} ${y - 3}v6`, null, 1.2));
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 0.4 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 24, 5, 0.62), fill: acc, weight: 800, ls: 1.2 });
    formKit.tzBadge(g, W / 2, H - 8.5, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'white', labelSize: 6, labelFont: "'Oswald', sans-serif", labelWeight: 600, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const stage2 = [...Array(16)].map((_, i) => ({ stage2Db: i * 1.8, levelMaxDb: -2 - i * 0.6, levelMinDb: -36 - i * 0.6 }));
  tz.addDefs(def({
    id: 'dwc.destroyer', name: 'Grand Wrecker', ref: 'Dwarfcraft Devices The Great Destroyer', brand: 'Dwarfcraft Devices', logo: 'GRAND WRECKER', tagline: 'TWO-STAGE DESTRUCTION', cat: 'Distortion', typeName: 'Two-stage starved distortion',
    form: 'dwc-doodle', color: '#efe4cc', accent: '#d8372b', cost: 0.8,
    algo: 'drive', opts: { clip: 'si', stages: 2, bias: 0.15, tone: 'lp', toneLo: 3800, toneHi: 3800, gainMinDb: 6, gainMaxDb: 44, preHp: 60, postLp: 7000, modes: stage2 },
    controls: [K('gain', 'PRIMARY', { def: 0.5, display: ten }), K('sec', 'SECONDARY', { def: 0.4, virtual: true, display: ten }), K('level', 'VOLUME', { def: 0.6, display: ten }), K('sag', 'STARVE', { def: 0.15, display: ten }), FOOT(), LED({ color: '#ff2a1a' })],
    derive: (p) => ({ mode: Math.round((p.sec ?? 0.4) * 15) }),
    desc: 'Two cascaded gain stages (PRIMARY into SECONDARY) from crunchy to obliterated; STARVE sags the supply for sputtery, dying-battery decay.',
  }));
}
