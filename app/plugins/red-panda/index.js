// Built-in Tone Zone plugin: Red Panda.
// Blocks inspired by Red Panda's digital "lab" pedals. Names and artwork are Tone Zone originals; control sets,
// switches and footswitches follow the real units (see each block's `ref`). The DSP is an approximation built from
// pitch / slicer / delay / freeze blocks (the real units are granular engines). One custom "rpd-lab" enclosure:
// clean powder coat with a halftone "particle" field or a warped tensor grid, lower-case wordmark.
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ms, STEREO, MONO } = tz.helpers;
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
  const rng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  let seq = 0;
  tz.addForm('rpd-lab', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 132, H = d.h || 268;
    const id = 'rp' + ++seq;
    const ink = d.ink || '#1a1a1a', acc = d.accent || '#d8402b';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [0, 0, 0], 0, 0.08, 1);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: d.knobR || 11, top: 18, pad: 9 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 6, z1 = L.artBottom;
    const ns = fit(name, W - 26, 22, 0.55);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 6;
    if (ab - z0 > 14) {
      const r = rng(d.seed || 7);
      let a = '', b = '';
      if (d.art === 'grid') {
        // warped tensor grid: lines bent around a centre mass
        const cx = W / 2, cy = (z0 + ab) / 2, R = Math.min(W * 0.4, (ab - z0) * 0.9);
        const warp = (x, y) => { const dx = x - cx, dy = y - cy, q = Math.exp(-(dx * dx + dy * dy) / (R * R * 0.5)) * 0.35; return [x - dx * q, y - dy * q]; };
        for (let k = 0; k <= 8; k++) {
          const y = z0 + ((ab - z0) * k) / 8, x0 = 12, x1 = W - 12;
          let p = '';
          for (let j = 0; j <= 16; j++) { const [x, yy] = warp(x0 + ((x1 - x0) * j) / 16, y); p += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1); }
          a += p;
        }
        for (let k = 0; k <= 10; k++) {
          const x = 12 + ((W - 24) * k) / 10;
          let p = '';
          for (let j = 0; j <= 12; j++) { const [xx, y] = warp(x, z0 + ((ab - z0) * j) / 12); p += (j ? 'L' : 'M') + xx.toFixed(1) + ' ' + y.toFixed(1); }
          a += p;
        }
        svg('path', { d: a, fill: 'none', stroke: ink, 'stroke-width': 0.7, 'stroke-opacity': 0.7 }, g);
        svg('circle', { cx, cy, r: Math.min(10, (ab - z0) * 0.2), fill: acc }, g);
      } else {
        // halftone particle field: dots grow towards a drifting cloud, a few accent particles
        const cx = W * 0.62, cy = z0 + (ab - z0) * 0.45;
        for (let y = z0 + 3; y < ab - 2; y += 5)
          for (let x = 10; x < W - 8; x += 5) {
            const dd = Math.hypot((x - cx) / (W * 0.45), (y - cy) / ((ab - z0) * 0.7));
            const rr = Math.max(0, 1.9 * (1 - dd) + (r() - 0.5) * 0.5);
            if (rr > 0.25) {
              const c = `M${(x - rr).toFixed(2)} ${y}a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(2 * rr).toFixed(2)} 0a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(-2 * rr).toFixed(2)} 0Z`;
              if (r() < 0.07) b += c; else a += c;
            }
          }
        svg('path', { d: a, fill: ink, 'fill-opacity': 0.85 }, g);
        svg('path', { d: b, fill: acc }, g);
      }
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Inter', sans-serif", weight: 600, ls: -0.2 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 26, 5, 0.62), fill: acc, weight: 800, ls: 1.4 });
    formKit.tzBadge(g, W / 2, H - 8.5, ink, 3.8);
    togTitles(g, L, ink);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.8, labelFont: "'Inter', sans-serif", labelWeight: 700, labelLs: 0.5 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const R = (o) => def(Object.assign({ form: 'rpd-lab', brand: 'Red Panda', stereo: 'both', monoPorts: MONO, stereoPorts: STEREO, cost: 1.6 }, o));
  const semi = (v) => (v > 0 ? '+' : '') + Math.round(v) + ' st';
  const PMODES = ['DLY', 'REV', 'PIT', 'PRV', 'DNS', 'SPR', 'WRP', 'SHM'];

  tz.addDefs([
    R({
      id: 'rpd.particle', name: 'Mote Granular Delay', ref: 'Red Panda Particle V2', logo: 'mote', tagline: 'GRANULAR DELAY / PITCH', cat: 'Delay', typeName: 'Granular delay & pitch shifter',
      color: '#f1efea', ink: '#1b1b1b', accent: '#d8402b', rows: [3, 3], seed: 11,
      algo: 'chain', opts: { mix: true, chain: [
        { prefix: 'p', algo: 'pitch', params: { level1: 1, level2: 0, level3: 0, dry: 0, quality: 1 } },
        { prefix: 's', algo: 'slicer', params: { depth: 0.7, smooth: 0.35, mix: 1, steps: 16 } },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 2500 }, params: { mix: 0.6, tone: 0.6 } },
      ] },
      controls: [
        K('mix', 'BLEND', { def: 0.45 }), K('d.time', 'DELAY', { min: 20, max: 2500, def: 380, curve: 'log', display: ms }), K('d.feedback', 'FEEDBACK', { min: 0, max: 1.05, def: 0.4 }),
        K('chunk', 'CHUNK', { def: 0.4, virtual: true }), K('pitch', 'PITCH', { min: -12, max: 12, def: 12, step: 1, virtual: true, display: semi }),
        SEL('pmode', 'MODE', PMODES, { def: 0, virtual: true, sweep: 280, optSize: 4.2 }),
        FOOT({ hold: { ms: 600, event: { type: 2, value: 1, arg: 200 }, release: { type: 2, value: 0, arg: 200 } } }), LED({ color: '#ff3b2a' }),
      ],
      derive: (p) => {
        const m = p.pmode ?? 0, c = p.chunk ?? 0.4, st = Math.round(p.pitch ?? 12);
        const T = [
          { p: 0, s: 0, d: 0 }, { p: 0, s: 0, d: 5 }, { p: 1, s: 0, d: 0 }, { p: 1, s: 0, d: 5 },
          { p: 0, s: 1, d: 4, pat: 9 }, { p: 0, s: 1, d: 5, pat: 5 }, { p: 0, s: 0, d: 9 }, { p: 0, s: 0, d: 6 },
        ][m];
        return { 'p.on': T.p, 'p.semis1': st, 's.on': T.s, 's.pattern': T.pat ?? 1, 's.time': 40 + 460 * c, 's.smooth': 0.15 + 0.5 * (1 - c), 'd.mode': T.d, 'd.moddepth': 0.15 * c, 'd.mix': 0.65 };
      },
      desc: 'Eight modes of chopped-up, reversed, pitch-shifted and smeared repeats: DLY, REV(erse), PIT(ch), PRV (pitch + reverse), DNS (dense grains), SPR (sparse grains), WRP (warp) and SHM (shimmer). CHUNK sets the grain size. Hold the footswitch to freeze the repeats. Granular behaviour is approximated with slicer + delay + pitch blocks.',
    }),
    R({
      id: 'rpd.tensor', name: 'Strain Time Warper', ref: 'Red Panda Tensor', logo: 'strain', tagline: 'TIME WARPER', cat: 'Delay', typeName: 'Tape-speed / reverse / stretch looper',
      color: '#20242c', ink: '#ece6d6', accent: '#e2b23a', art: 'grid', knob: 'white', rows: [3, 2], h: 284, cost: 1.8,
      algo: 'chain', opts: { mix: true, chain: [
        { prefix: 'p', algo: 'pitch', params: { level1: 1, level2: 0, level3: 0, dry: 0, glide: 0.4 } },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { mix: 0.7, feedback: 0.25, tone: 0.6 } },
        { prefix: 's', algo: 'slicer', params: { mix: 1, smooth: 0.25, steps: 16 } },
        { prefix: 'f', algo: 'freeze', params: { mode: 1, dry: 1, mix: 0.8, decay: 1 } },
      ] },
      controls: [
        K('speed', 'SPEED', { def: 0.75, virtual: true }), K('d.time', 'TIME', { min: 60, max: 2000, def: 500, curve: 'log', display: ms }), K('pitch', 'PITCH', { min: -24, max: 24, def: 0, step: 1, virtual: true, display: semi }),
        K('rand', 'RAND', { def: 0, virtual: true }), K('mix', 'BLEND', { def: 0.5 }),
        TOG('dir', 'DIR', ['FWD', 'REV', 'ALT'], { def: 1, virtual: true }), TOG('hmode', 'HOLD', ['REC', 'OVR', 'NXT'], { def: 0, virtual: true }),
        FOOT({ action: 'none', label: 'HOLD', hold: { ms: 10, event: { type: 1, value: 1, arg: 300 }, release: { type: 2, value: 0, arg: 300 } } }), FOOT({ label: 'BYPASS' }),
        LED({ bind: 'fn', sub: 'f', color: '#ff3b2a', ledFn: (ui, b, st) => !b.bypass && !!(st && (st.frozen || st.hold)) }), LED({ color: '#3dd6ff' }),
      ],
      derive: (p) => {
        const sp = (p.speed ?? 0.75) - 0.5, a = Math.abs(sp), rd = p.rand ?? 0, dir = p.dir ?? 1;
        const spdSemis = a < 0.02 ? -24 : Math.max(-24, Math.min(12, 12 * Math.log2(a * 4)));
        const rev = dir === 1 || (dir === 0 && sp < 0);
        return { 'p.semis1': Math.max(-24, Math.min(24, Math.round(spdSemis + (p.pitch ?? 0)))), 'p.on': Math.abs(spdSemis + (p.pitch ?? 0)) > 0.4 ? 1 : 0,
          'd.mode': dir === 2 ? 7 : rev ? 5 : 0, 's.on': rd > 0.02 ? 1 : 0, 's.depth': rd, 's.pattern': rd > 0.6 ? 15 : rd > 0.3 ? 11 : 6, 's.time': 60 + 300 * (1 - rd),
          'f.layer': (p.hmode ?? 0) === 1 ? 1 : 0, 'f.speed': (p.hmode ?? 0) === 2 ? 0.7 : 0.25 };
      },
      desc: 'Tape-speed playback in both directions (SPEED: centre = stopped, right = forward faster, left = reverse), pitch shift, time stretch and randomised slicing. HOLD captures and sustains the sound (OVR layers on top). Approximated with pitch + reverse delay + slicer + freeze blocks.',
    }),
  ]);
}
