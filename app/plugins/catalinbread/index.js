// Built-in Tone Zone plugin: Catalinbread.
// Blocks inspired by Catalinbread pedals (Portland). Names and artwork are Tone Zone originals; control sets and
// layouts follow the real units (see each block's `ref`). One custom "cb-ornate" enclosure: vintage poster look
// with a double ornamental frame, corner flourishes, a period emblem (tape reels, keyhole) and script lettering.
export default function register(tz) {
  const { K, FOOT, LED, def, ten, ms, db } = tz.helpers;
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
  const EMBLEM = {
    reels(A, c) {
      [[30, 30], [70, 30]].forEach(([x, y]) => {
        A.o(`M${x} ${y}m-18 0a18 18 0 1 0 36 0a18 18 0 1 0 -36 0`, 2.2);
        A.o(`M${x} ${y}m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0`, 1.6);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4; A.f(`M${x + Math.cos(a) * 7} ${y + Math.sin(a) * 7}L${x + Math.cos(a + 0.5) * 15} ${y + Math.sin(a + 0.5) * 15}A15 15 0 0 1 ${x + Math.cos(a + 1.3) * 15} ${y + Math.sin(a + 1.3) * 15}Z`, c); }
      });
      A.o('M30 48 L50 56 L70 48', 1.6);
    },
    keyhole(A, c) {
      A.o('M50 30m-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0', 2);
      A.f('M50 14a8 8 0 0 1 4.5 14.6L58 46H42L45.5 28.6A8 8 0 0 1 50 14Z', c);
      [[16, 8], [84, 8], [16, 52], [84, 52]].forEach(([x, y]) => A.f(`M${x} ${y - 4}L${x + 1.2} ${y - 1.2}L${x + 4} ${y}L${x + 1.2} ${y + 1.2}L${x} ${y + 4}L${x - 1.2} ${y + 1.2}L${x - 4} ${y}L${x - 1.2} ${y - 1.2}Z`, c));
    },
  };
  let seq = 0;
  tz.addForm('cb-ornate', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 128, H = d.h || 248;
    const id = 'cb' + ++seq;
    const ink = d.ink || '#2a1c10', gold = d.gold || '#c9a24a';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [60, 40, 20], 0, 0.12, 1);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    // double frame with corner flourishes
    svg('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 3, fill: 'none', stroke: gold, 'stroke-width': 1.4 }, g);
    svg('rect', { x: 7, y: 7, width: W - 14, height: H - 14, rx: 2, fill: 'none', stroke: gold, 'stroke-width': 0.6 }, g);
    [[7, H - 7, 1, -1], [W - 7, H - 7, -1, -1]].forEach(([x, y, sx, sy]) =>
      svg('path', { d: `M${x} ${y + sy * 9} q${sx * 1.5} ${-sy * 7.5} ${sx * 9} ${-sy * 9} M${x + sx * 4} ${y + sy * 4} m${-sx * 2} 0 a2 2 0 1 0 ${sx * 4} 0 a2 2 0 1 0 ${-sx * 4} 0`, fill: 'none', stroke: gold, 'stroke-width': 1 }, g));
    const L = layout(d, W, H, { kr: d.knobR || 11, top: 20, pad: 12 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 6, z1 = L.artBottom;
    const script = d.script !== false;
    const ns = fit(name, W - 30, 26, script ? 0.48 : 0.56);
    const nameY = z1 - (tag ? 10 : 2) - ns * 0.5;
    const ab = nameY - ns * 0.7 - 6;
    if (ab - z0 > 18) {
      const s = Math.min((W - 40) / 100, (ab - z0) / 60);
      const art = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${z0 + (ab - z0 - 60 * s) / 2}) scale(${s})` }, g);
      const A = { f: (dd, fill) => svg('path', { d: dd, fill }, art), o: (dd, w) => svg('path', { d: dd, fill: 'none', stroke: ink, 'stroke-width': w, 'stroke-linecap': 'round' }, art) };
      (EMBLEM[d.emblem] || EMBLEM.reels)(A, gold);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: d.nameColor || ink, font: script ? "'Dancing Script', cursive" : "'Oswald', sans-serif", weight: 700, ls: script ? 0 : 0.6 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 30, 5, 0.62), fill: ink, weight: 800, ls: 1.4 });
    formKit.tzBadge(g, W / 2, H - 11, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'chrome', labelSize: 5.8, labelFont: "'Oswald', sans-serif", labelWeight: 600, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const C = (o) => def(Object.assign({ form: 'cb-ornate', brand: 'Catalinbread', cost: 0.9 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff2a1a' })] }));

  tz.addDefs([
    C({
      id: 'cb.belleepoch', name: 'Fine Era Tape Echo', ref: 'Catalinbread Belle Epoch', logo: 'Fine Era', tagline: 'TAPE ECHO', cat: 'Delay', typeName: 'EP-3 style tape echo',
      color: '#e6dcc3', ink: '#2c2416', gold: '#3f6b4c', emblem: 'reels', rows: [3, 2], h: 262, cost: 1.1,
      algo: 'delay', opts: { fixedMode: 2, mode: 2, maxMs: 800, defaultMs: 330 },
      controls: [
        K('mix', 'MIX', { def: 0.35 }), K('feedback', 'ECHO SUSTAIN', { min: 0, max: 1.08, def: 0.38 }), K('mod', 'MOD', { def: 0.25, virtual: true }),
        K('rec', 'REC LEV', { def: 0.45, virtual: true }), K('time', 'ECHO DELAY', { min: 60, max: 800, def: 330, display: ms }),
      ],
      derive: (p) => { const r = p.rec ?? 0.45, m = p.mod ?? 0.25; return { mode: 2, heads: 4, sat: 0.1 + 0.75 * r, level: 0.42 + 0.18 * r, moddepth: 0.04 + 0.4 * m, modrate: 0.35, age: 0.25 + 0.4 * m, tone: 0.55 - 0.15 * r }; },
      desc: 'Echoplex EP-3 style tape echo with its preamp colour: REC LEV drives the tape harder for gritty, saturated repeats, MOD dials in wow and flutter.',
    }),
    C({
      id: 'cb.dls', name: 'Grubby Little Rumour', ref: 'Catalinbread Dirty Little Secret', logo: 'Little Rumour', tagline: 'SUPER LEAD IN A BOX', cat: 'Preamp', kind: 'Pedal', typeName: 'Plexi-style preamp pedal',
      color: '#6e1d1f', ink: '#f2e3c4', gold: '#d9b25a', nameColor: '#f2e3c4', emblem: 'keyhole', rows: [2, 3], knob: 'cream', h: 256, cost: 1.6,
      algo: 'amp', opts: { model: 'plexi', preamp: true },
      controls: [
        K('level', 'MASTER', { min: -24, max: 8, def: -5, display: db }), K('gain', 'PRE-AMP', { def: 0.6, display: ten }),
        K('treble', 'TREBLE', { def: 0.6, display: ten }), K('mid', 'MIDDLE', { def: 0.55, display: ten }), K('bass', 'BASS', { def: 0.45, display: ten }),
      ],
      desc: 'A cranked Super Lead preamp in a pedal: open, crunchy and dynamic, built to be run into a clean amp.',
    }),
  ]);
}
