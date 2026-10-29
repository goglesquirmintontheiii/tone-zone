// Built-in Tone Zone plugin: Analogman.
// A block inspired by Analogman's dual overdrive. Name and artwork are Tone Zone originals; the controls (Volume /
// Tone / Drive per side, two footswitches, a red and a yellow side, internal clean / OD / DIST DIP modes brought
// out as mini toggles) follow the real unit. Custom "am-dual" enclosure: two-tone powder coat, a little crown
// emblem, and a red and a yellow channel stripe.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;

  // ------------------------------------------------------------------ shared layout kit
  // Forms run more than once and controls are shared, so every control this form places goes in `owned` and is
  // laid out again on each call. Labels sit above the knobs; art only goes in the gap above the LEDs so it never
  // overlaps text.
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
  // the form prints toggle titles itself (theme.toggleTitles = false), a bit higher than the core, so the lever
  // tip doesn't hit them
  function togTitles(g, L, fill, o = {}) {
    L.togs.forEach((c) => { if (c.t === 'toggle' && c.label) tz.gfx.label(g, c.x, c.y - 21, c.label, { size: o.size || 5.6, fill, weight: 800, ls: 0.6, font: o.font }); });
  }
  let seq = 0;
  tz.addForm('am-dual', (ctx, d) => {
    const g = ctx.g;
    const W = 150, H = 252;
    const id = 'am' + ++seq;
    const ink = '#1e1c2c';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 36, 64, [255, 255, 255], 0, 0.12, 0);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: 10.5, top: 22, pad: 10 });
    // channel stripes: yellow next to the first knob row, red next to the second
    const rows = d.controls.filter((c) => c.t === 'knob');
    [[rows[0], '#f2c230'], [rows[3], '#d8372b']].forEach(([c, col]) => c && svg('rect', { x: 4, y: c.y - 14, width: 3, height: 26, rx: 1.5, fill: col }, g));
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 30, 18, 0.6);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 4;
    if (ab - z0 > 12) {
      const s = Math.min(1, (ab - z0) / 26), cx = W / 2, cy = (z0 + ab) / 2;
      svg('path', { d: `M${cx - 16 * s} ${cy + 9 * s} L${cx - 19 * s} ${cy - 8 * s} L${cx - 8 * s} ${cy} L${cx} ${cy - 12 * s} L${cx + 8 * s} ${cy} L${cx + 19 * s} ${cy - 8 * s} L${cx + 16 * s} ${cy + 9 * s} Z`, fill: '#e8c35a', stroke: ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
      [[-19, -8], [0, -12], [19, -8]].forEach(([x, y]) => svg('circle', { cx: cx + x * s, cy: cy + y * s, r: 2 * s, fill: '#d8372b', stroke: ink, 'stroke-width': 0.6 }, g));
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 30, 5, 0.62), fill: ink, weight: 800, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 9, ink, 3.6);
    togTitles(g, L, ink);
    const theme = { toggleTitles: false, text: ink, knob: 'mxr', labelSize: 5.8, labelFont: "'Oswald', sans-serif", labelWeight: 600, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const side = { clip: 'asym', bias: 0.2, cleanSum: true, tone: 'lp', toneLo: 1200, toneHi: 7500, preHp: 80, clipHp: 600, postLp: 9000,
    modes: [{ clip: 'clean', gainMinDb: 0, gainMaxDb: 14, cleanMix: 0.9, levelMinDb: -12, levelMaxDb: 6 }, { gainMinDb: 2, gainMaxDb: 30, cleanMix: 0.45, levelMinDb: -24, levelMaxDb: 6 }, { clip: 'diode', gainMinDb: 10, gainMaxDb: 40, cleanMix: 0.15, levelMinDb: -30, levelMaxDb: 0 }] };
  tz.addDefs(def({
    id: 'am.kot', name: 'Ruler of Tone', ref: 'Analogman King of Tone', brand: 'Analogman', logo: 'RULER OF TONE', tagline: 'DUAL OVERDRIVE', cat: 'Overdrive', typeName: 'Dual Bluesbreaker-style overdrive',
    form: 'am-dual', color: '#a7a3cc', cost: 1, rows: [3, 3],
    algo: 'chain', opts: { chain: [{ prefix: 'y', algo: 'drive', opts: side }, { prefix: 'r', algo: 'drive', opts: side }] },
    controls: [
      K('y.level', 'VOLUME', { def: 0.5, display: ten }), K('y.tone', 'TONE', { def: 0.5, display: ten }), K('y.gain', 'DRIVE', { def: 0.35, display: ten }),
      K('r.level', 'VOLUME', { def: 0.45, display: ten }), K('r.tone', 'TONE', { def: 0.5, display: ten }), K('r.gain', 'DRIVE', { def: 0.55, display: ten }),
      TOG('y.mode', 'YELLOW', ['CLN', 'OD', 'DST'], { def: 1 }), TOG('r.mode', 'RED', ['CLN', 'OD', 'DST'], { def: 1 }),
      FOOT({ action: 'toggle', p: 'y.on', def: 1, label: 'YELLOW' }), FOOT({ action: 'toggle', p: 'r.on', def: 0, label: 'RED' }),
      LED({ bind: 'onparam:y.on', color: '#ffc21a' }), LED({ bind: 'onparam:r.on', color: '#ff2a1a' }),
    ],
    initParams: { 'y.on': 1, 'r.on': 0 },
    desc: 'Two transparent, amp-like overdrives in one box. The yellow side feeds the red side for more gain, and each side has its own clean boost / overdrive / distortion switch.',
  }));
}
