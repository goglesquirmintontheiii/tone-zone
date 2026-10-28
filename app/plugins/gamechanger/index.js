// Built-in Tone Zone plugin: Gamechanger Audio.
// Blocks inspired by Gamechanger Audio's "impossible" pedals (Riga). Names and artwork are Tone Zone originals;
// control sets follow the real units (see each block's `ref`). One custom "gca-steel" enclosure: heavy black steel
// chassis with crisp white industrial type, in two variants – a box with a chrome piano sustain pedal attached
// (the pedal is the footswitch) and a box with a glass gas-discharge tube window across the middle.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
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
  tz.addForm('gca-steel', (ctx, d) => {
    const g = ctx.g;
    const piano = d.variant === 'piano';
    const W = d.w || 150, H = d.h || 240;
    const id = 'gc' + ++seq;
    const ink = '#f4f4f2', acc = d.accent || '#ff4a2a';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 36, 64, [255, 255, 255], 0, 0.05, 0);
    const boxH = piano ? 132 : H;
    formKit.body(g, W, boxH, d.color, { rx: 4 });
    svg('rect', { width: W, height: boxH, rx: 4, fill: `url(#${id}n)` }, g);
    [[6, 6], [W - 6, 6], [6, boxH - 6], [W - 6, boxH - 6]].forEach(([x, y]) => formKit.screw(g, x, y, 2.2));
    const L = layout(d, W, piano ? boxH + 60 : H, { kr: d.knobR || 11, top: 18, pad: 12, footB: piano ? 0 : 30 });
    const name = d.logo || d.name, tag = d.tagline;
    if (piano) {
      // chrome sustain pedal hinged under the box (the footswitch is an invisible plate over it)
      const py = boxH + 4, pw = W * 0.42;
      svg('rect', { x: W / 2 - pw / 2 - 6, y: boxH - 2, width: pw + 12, height: 12, rx: 3, fill: '#0c0c0c' }, g);
      const lg = svg('linearGradient', { id: id + 'c', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      [[0, '#8d9399'], [0.25, '#f2f4f6'], [0.5, '#b9bec4'], [0.75, '#eef0f2'], [1, '#7d838a']].forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, lg));
      const pd = `M${W / 2 - pw / 2 + 6} ${py} H${W / 2 + pw / 2 - 6} L${W / 2 + pw / 2} ${py + 120} Q${W / 2} ${py + 136} ${W / 2 - pw / 2} ${py + 120} Z`;
      tz.gfx.softShadow(g, { w: pw, h: 130, x: W / 2 - pw / 2, y: py, rx: 14, dy: 8, blur: 7, opacity: 0.6 });
      svg('path', { d: pd, fill: `url(#${id}c)`, stroke: '#4a4f55', 'stroke-width': 0.8 }, g);
      svg('path', { d: `M${W / 2 - pw / 2 + 12} ${py + 10} H${W / 2 + pw / 2 - 12}`, stroke: '#fff', 'stroke-opacity': 0.6, 'stroke-width': 1.2 }, g);
      L.feet.forEach((f) => Object.assign(f, { style: 'plate', x: W / 2, y: py + 64, w: pw, h: 124, label: null }));
      L.leds.forEach((l) => Object.assign(l, { x: W - 40, y: boxH - 22 }));
      const ns = fit(name, W * 0.5, 12, 0.6);
      label(g, 16, boxH - 22, name, { size: ns, fill: ink, font: "'Inter', sans-serif", weight: 800, ls: 0.4, anchor: 'start' });
      if (tag) label(g, 16, boxH - 10, tag, { size: 4.6, fill: ink, weight: 700, ls: 1.2, opacity: 0.75, anchor: 'start' });
      formKit.tzBadge(g, W - 40, boxH - 9, '#9aa0a6', 3.8);
    } else {
      const z0 = L.y + 6, z1 = L.artBottom;
      const ns = fit(name, W - 30, 18, 0.62);
      const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
      const ab = nameY - ns * 0.62 - 8;
      if (ab - z0 > 16) {
        // glass discharge tube with a frozen plasma arc
        const ty = (z0 + ab) / 2, th = Math.min(22, ab - z0);
        svg('rect', { x: 10, y: ty - th / 2 - 3, width: W - 20, height: th + 6, rx: (th + 6) / 2, fill: '#050507', stroke: '#3a3d42', 'stroke-width': 1.2 }, g);
        svg('rect', { x: 14, y: ty - th / 2, width: W - 28, height: th, rx: th / 2, fill: '#151022' }, g);
        [16, W - 16].forEach((x) => svg('rect', { x: x - 3, y: ty - 3, width: 6, height: 6, rx: 1, fill: '#9aa0a6' }, g));
        let p = `M19 ${ty}`;
        const n = 18;
        for (let i = 1; i <= n; i++) p += `L${19 + ((W - 38) * i) / n} ${ty + (i === n ? 0 : (i % 2 ? -1 : 1) * th * (0.18 + 0.2 * ((i * 7) % 5) / 5))}`;
        svg('path', { d: p, fill: 'none', stroke: '#b45cff', 'stroke-width': 4, 'stroke-opacity': 0.45, 'stroke-linejoin': 'round' }, g);
        svg('path', { d: p, fill: 'none', stroke: '#f3dcff', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
        svg('rect', { x: 16, y: ty - th / 2 + 2, width: W - 32, height: th * 0.22, rx: th * 0.11, fill: '#fff', 'fill-opacity': 0.12 }, g);
      }
      label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Inter', sans-serif", weight: 800, ls: 0.6 });
      if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 30, 5, 0.62), fill: acc, weight: 800, ls: 1.4 });
      formKit.tzBadge(g, W / 2, H - 8.5, '#9aa0a6', 3.8);
    }
    togTitles(g, L, ink);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'strymon', labelSize: 5.8, labelFont: "'Inter', sans-serif", labelWeight: 700, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: piano ? boxH + 152 : H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const G = (o) => def(Object.assign({ form: 'gca-steel', brand: 'Gamechanger Audio', color: '#17181a' }, o));

  tz.addDefs([
    G({
      id: 'gca.plus', name: 'Sustainer Plus', ref: 'Gamechanger Audio Plus Pedal', logo: 'MORE+', tagline: 'SUSTAIN PEDAL', cat: 'Synth', typeName: 'Piano-style sustain pedal', variant: 'piano', w: 190, rows: [4], cost: 1.2,
      algo: 'freeze', opts: {},
      controls: [
        K('mix', 'BLEND', { def: 0.7 }), K('sus', 'SUSTAIN', { def: 0.5, virtual: true }), K('rise', 'RISE', { def: 0.3, virtual: true }), K('tail', 'TAIL', { def: 0.6, virtual: true }),
        TOG('group', 'MODE', ['SINGLE', 'GROUP'], { def: 0, virtual: true }), TOG('split', 'OUTPUT', ['MIX', 'SPLIT'], { def: 0, virtual: true }),
        FOOT({ action: 'none', hold: { ms: 10, event: { type: 1, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }),
        LED({ bind: 'fn', color: '#ff4a2a', ledFn: (ui, b, st) => !b.bypass && !!(st && st.frozen) }),
      ],
      derive: (p) => {
        const grp = (p.group ?? 0) === 1, s = p.sus ?? 0.5, t = p.tail ?? 0.6;
        return { mode: 1, speed: 0.05 + 0.9 * (1 - (p.rise ?? 0.3)), decay: t > 0.97 ? 1 : 0.6 + 0.39 * t, layer: grp ? 1 : 0, tone: grp ? 0.85 : 1 - 0.7 * s, dry: (p.split ?? 0) ? 0 : 1, level: grp ? -1 - 2 * s : 0 };
      },
      desc: 'Press the piano pedal to sustain what you are playing, like a piano\'s damper pedal: RISE is how fast the sustain fades in, TAIL how long it rings after release (max = forever). GROUP layers successive presses, SINGLE holds one sound (SUSTAIN darkens it). SPLIT outputs the wet signal only.',
    }),
    G({
      id: 'gca.plasma', name: 'Arc Tube Distortion', ref: 'Gamechanger Audio Plasma Pedal', logo: 'ARC TUBE', tagline: 'HIGH VOLTAGE DISTORTION', cat: 'Distortion', typeName: 'Gas-discharge distortion', rows: [3, 2], h: 292, cost: 1,
      algo: 'chain', opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 18, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 900, trebleF: 3200, gainMinDb: 26, gainMaxDb: 62, preHp: 90, postLp: 9500, levelMinDb: -42, levelMaxDb: -11, cleanSum: true } },
        { prefix: 'g', algo: 'gate', params: { threshold: 0.35, decay: 0.15, attack: 0.02 } },
        { prefix: 'e', algo: 'peq', params: { lowfreq: 120, highfreq: 3200 } },
      ] },
      controls: [
        K('d.blend', 'BLEND', { def: 1 }), K('d.gain', 'VOLTAGE', { def: 0.5 }), K('d.level', 'VOLUME', { def: 0.6, display: ten }),
        K('lo', 'LOW', { def: 0.5, virtual: true }), K('hi', 'HIGH', { def: 0.5, virtual: true }),
        TOG('ceq', 'CLEAN EQ', ['OFF', 'ON'], { def: 0, virtual: true }),
        FOOT(), LED({ color: '#c86bff' }),
      ],
      derive: (p) => {
        const ce = (p.ceq ?? 0) === 1, lo = p.lo ?? 0.5, hi = p.hi ?? 0.5;
        return ce ? { 'd.bass': 0.5, 'd.treble': 0.5, 'e.on': 1, 'e.lowgain': (lo - 0.5) * 24, 'e.highgain': (hi - 0.5) * 24 } : { 'd.bass': lo, 'd.treble': hi, 'e.on': 0 };
      },
      desc: 'Distortion made by a high-voltage spark jumping across a xenon tube: brutally square, gated and fizzy. BLEND mixes the clean signal back in; CLEAN EQ applies LOW / HIGH to the clean signal too.',
    }),
  ]);
}
