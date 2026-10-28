// Built-in Tone Zone plugin: Montreal Assembly.
// A block inspired by Montreal Assembly's buffer-mangling delay / sampler. Name and artwork are Tone Zone
// originals; the control set (three read-head DIR knobs, LEN B / LEN S, FBK, RAND, MIX, M / Q / E switches, soft
// switch) follows the real unit. The DSP is an approximation: pitch voices stand in for the read heads, a
// reversible delay for the buffer (mode 1), a slicer for the granular slices (mode 2), a multi-head tape delay for
// the looper (mode 3) and a freeze block for the soft-switch hold.
// Custom "mta-count" enclosure: bone white, a row of bold Bauhaus-style counting blocks and tiny numerals.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ms, STEREO, MONO } = tz.helpers;
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
  tz.addForm('mta-count', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 150, H = d.h || 300;
    const id = 'mt' + ++seq;
    const ink = '#1c1c1c';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [0, 0, 0], 0, 0.07, 1);
    formKit.body(g, W, H, d.color || '#efece4', { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: 10, top: 18, pad: 9, perRow: 4 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 6, z1 = L.artBottom;
    const ns = fit(name, W - 26, 18, 0.62);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 6;
    if (ab - z0 > 14) {
      // six counting blocks: circle, half, square, triangle, bars, ring (one per count), alternating inks
      const n = 6, bw = Math.min((W - 24) / n, ab - z0), y0 = z0 + (ab - z0 - bw) / 2, x0 = (W - bw * n) / 2;
      const cols = ['#e2452c', '#1c1c1c', '#f0b52d', '#2a62b8', '#1c1c1c', '#e2452c'];
      for (let i = 0; i < n; i++) {
        const x = x0 + i * bw, s = bw * 0.82, cx = x + bw / 2, cy = y0 + bw / 2, c = cols[i];
        const shp = [
          `M${cx} ${cy}m-${s / 2} 0a${s / 2} ${s / 2} 0 1 0 ${s} 0a${s / 2} ${s / 2} 0 1 0 -${s} 0Z`,
          `M${cx - s / 2} ${cy + s / 2}A${s / 2} ${s / 2} 0 0 1 ${cx + s / 2} ${cy + s / 2}Z`,
          `M${cx - s / 2} ${cy - s / 2}h${s}v${s}h-${s}Z`,
          `M${cx} ${cy - s / 2}L${cx + s / 2} ${cy + s / 2}H${cx - s / 2}Z`,
          `M${cx - s / 2} ${cy - s / 2}h${s * 0.25}v${s}h-${s * 0.25}Z M${cx - s * 0.12} ${cy - s / 2}h${s * 0.25}v${s}h-${s * 0.25}Z M${cx + s * 0.25} ${cy - s / 2}h${s * 0.25}v${s}h-${s * 0.25}Z`,
          `M${cx} ${cy}m-${s / 2} 0a${s / 2} ${s / 2} 0 1 0 ${s} 0a${s / 2} ${s / 2} 0 1 0 -${s} 0Z M${cx} ${cy}m-${s / 4} 0a${s / 4} ${s / 4} 0 1 1 ${s / 2} 0a${s / 4} ${s / 4} 0 1 1 -${s / 2} 0Z`,
        ][i];
        svg('path', { d: shp, fill: c, 'fill-rule': 'evenodd' }, g);
      }
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Barlow Condensed', sans-serif", weight: 800, ls: 2 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 26, 5, 0.62), fill: ink, weight: 700, ls: 1.4, opacity: 0.8 });
    formKit.tzBadge(g, W / 2, H - 8.5, ink, 3.6);
    togTitles(g, L, ink);
    const theme = { toggleTitles: false, text: ink, knob: 'mxr', labelSize: 5.6, labelWeight: 800, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const dir = (v) => { const x = (v - 0.5) * 2; return Math.abs(x) < 0.05 ? 'STOP' : (x < 0 ? 'REV ' : 'FWD ') + Math.abs(x * 2).toFixed(2) + 'x'; };
  const speedSemis = (v, q) => {
    const x = Math.abs((v - 0.5) * 2) * 2; // 0 .. 2x speed
    let st = x < 0.06 ? -24 : 12 * Math.log2(x);
    st = Math.max(-24, Math.min(12, st));
    if (q === 0) st = Math.round(st);
    else if (q === 1) st = Math.round(st / 12) * 12 || (st > 3.5 ? 7 : st < -3.5 ? -5 : 0);
    return st;
  };

  tz.addDefs(def({
    id: 'mta.count5', name: 'Tally to Six', ref: 'Montreal Assembly Count to 5', brand: 'Montreal Assembly', logo: 'TALLY TO SIX', tagline: 'BUFFER MANGLER', cat: 'Delay', typeName: 'Pitch / reverse / granular buffer delay',
    form: 'mta-count', color: '#efece4', stereo: 'both', monoPorts: MONO, stereoPorts: STEREO, rows: [4, 4], cost: 1.8,
    algo: 'chain', opts: { mix: true, chain: [
      { prefix: 'p', algo: 'pitch', params: { level1: 1, level2: 0, level3: 0, dry: 0, glide: 0.2 } },
      { prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { mix: 0.75, tone: 0.65 } },
      { prefix: 's', algo: 'slicer', params: { mix: 1, smooth: 0.2, steps: 16 } },
      { prefix: 'f', algo: 'freeze', params: { mode: 1, dry: 1, mix: 0.85, decay: 1 } },
    ] },
    controls: [
      K('dir1', 'DIR 1', { def: 0.1, virtual: true, display: dir }), K('dir2', 'DIR 2', { def: 0.75, virtual: true, display: dir }), K('dir3', 'DIR 3', { def: 1, virtual: true, display: dir }), K('lenb', 'LEN B', { def: 0.45, virtual: true }),
      K('lens', 'LEN S', { def: 0.4, virtual: true }), K('d.feedback', 'FBK', { min: 0, max: 1.05, def: 0.35 }), K('rand', 'RAND', { def: 0.2, virtual: true }), K('mix', 'MIX', { def: 0.5 }),
      TOG('m', 'M', ['1', '2', '3'], { def: 0, virtual: true }), TOG('q', 'Q', ['CHR', 'OCT', 'FREE'], { def: 1, virtual: true }), TOG('e', 'E', ['1', '2', '3'], { def: 2, virtual: true }),
      FOOT({ action: 'none', label: 'SOFT', hold: { ms: 10, event: { type: 1, value: 1, arg: 300 }, release: { type: 2, value: 0, arg: 300 } } }), FOOT({ label: 'BYPASS' }),
      LED({ bind: 'fn', sub: 'f', color: '#2fb6ff', ledFn: (ui, b, st) => !b.bypass && !!(st && st.frozen) }), LED({ color: '#ff3b2a' }),
    ],
    derive: (p) => {
      const m = p.m ?? 0, q = p.q ?? 1, lb = p.lenb ?? 0.45, ls = p.lens ?? 0.4, rd = p.rand ?? 0.2;
      const s1 = speedSemis(p.dir1 ?? 0.1, q), s2 = speedSemis(p.dir2 ?? 0.75, q), s3 = speedSemis(p.dir3 ?? 1, q);
      const rev1 = (p.dir1 ?? 0.1) < 0.5;
      const heads = [1, 3, 7][p.e ?? 2];
      const o = { 'p.semis1': s1, 'p.on': Math.abs(s1) > 0.4 || m === 2 ? 1 : 0, 'p.level2': 0, 'p.level3': 0, 'd.time': 60 + 1900 * lb * lb, 's.on': 0 };
      if (m === 0) Object.assign(o, { 'd.mode': rev1 ? 5 : 0 });
      else if (m === 1) Object.assign(o, { 'd.mode': rev1 ? 5 : 0, 's.on': 1, 's.time': 30 + 600 * ls * ls, 's.pattern': rd > 0.5 ? 15 : rd > 0.2 ? 11 : 1, 's.depth': 0.5 + 0.5 * rd });
      else Object.assign(o, { 'd.mode': 2, 'd.heads': heads, 'p.on': 1, 'p.semis2': s2, 'p.semis3': s3, 'p.level1': 0.7, 'p.level2': heads > 1 ? 0.5 : 0, 'p.level3': heads > 3 ? 0.5 : 0 });
      return o;
    },
    desc: 'M1: fixed-length buffer played back at DIR 1 speed / direction (centre = stop, left = reverse). M2: granular slices (LEN S, RAND). M3: multi-head looper with up to three read heads (E), each with its own DIR. Q quantises the speeds (chromatic / octaves & fifths / free). Hold SOFT to freeze. Approximation of the real buffer engine.',
  }));
}
