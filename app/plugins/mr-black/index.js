// Built-in Tone Zone plugin: Mr. Black.
// Blocks inspired by Mr. Black pedals. Names and artwork are Tone Zone originals; control sets follow the real units
// (see each block's `ref`). One custom "mrb-flake" enclosure: sparkly metal-flake powder coat (speckle of bright
// flakes over a deep base), a big flat cartoon emblem (moon, eternal sun) and a bubbly wordmark.
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
  const rng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const EMBLEM = {
    moon(A) {
      A.f('M50 30m-24 0a24 24 0 1 0 48 0a24 24 0 1 0 -48 0Z', A.c1);
      A.f('M62 30m-21 0a21 21 0 1 0 42 0a21 21 0 1 0 -42 0Z', A.bg);
      [[36, 20, 3.4], [32, 36, 2.6], [42, 44, 2]].forEach(([x, y, r]) => A.f(`M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0Z`, A.c2));
      [[80, 12, 3], [88, 40, 2.4], [70, 52, 1.8], [12, 12, 2]].forEach(([x, y, r]) => A.f(`M${x} ${y - r * 2}L${x + r * 0.5} ${y - r * 0.5}L${x + r * 2} ${y}L${x + r * 0.5} ${y + r * 0.5}L${x} ${y + r * 2}L${x - r * 0.5} ${y + r * 0.5}L${x - r * 2} ${y}L${x - r * 0.5} ${y - r * 0.5}Z`, A.c1));
    },
    sun(A) {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; A.f(`M${50 + Math.cos(a - 0.12) * 18} ${30 + Math.sin(a - 0.12) * 18}L${50 + Math.cos(a) * (i % 2 ? 26 : 30)} ${30 + Math.sin(a) * (i % 2 ? 26 : 30)}L${50 + Math.cos(a + 0.12) * 18} ${30 + Math.sin(a + 0.12) * 18}Z`, A.c1); }
      A.f('M50 30m-16 0a16 16 0 1 0 32 0a16 16 0 1 0 -32 0Z', A.c2);
      A.o('M41 30c3 -5 6 -5 9 0s6 5 9 0c-3 -5 -6 -5 -9 0s-6 5 -9 0Z', 1.6, A.bg);
    },
  };
  let seq = 0;
  tz.addForm('mrb-flake', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 112, H = d.h || 216;
    const id = 'mb' + ++seq;
    const ink = d.text || '#f6f1ff';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 30, 64, [255, 255, 255], 0, 0.22, 0);
    formKit.body(g, W, H, d.color, { rx: 7 });
    svg('rect', { width: W, height: H, rx: 7, fill: `url(#${id}n)` }, g);
    // bright metal flakes
    const r = rng(d.seed || 5);
    let fl = '';
    for (let i = 0; i < 70; i++) { const x = 4 + r() * (W - 8), y = 4 + r() * (H - 8), s = 0.4 + r() * 0.7; fl += `M${x.toFixed(1)} ${(y - s).toFixed(1)}l${s} ${s}l${-s} ${s}l${-s} ${-s}Z`; }
    svg('path', { d: fl, fill: d.flake || '#ffffff', 'fill-opacity': 0.55 }, g);
    const L = layout(d, W, H, { kr: d.knobR || 11, top: 18, pad: 8 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 22, 21, 0.58);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.62 - 5;
    if (ab - z0 > 16) {
      const s = Math.min((W - 20) / 100, (ab - z0) / 60);
      const art = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${z0 + (ab - z0 - 60 * s) / 2}) scale(${s})` }, g);
      const A = { c1: d.c1 || '#f7d774', c2: d.c2 || '#d9c27a', bg: d.color,
        f: (dd, fill) => svg('path', { d: dd, fill }, art), o: (dd, w, col) => svg('path', { d: dd, fill: 'none', stroke: col, 'stroke-width': w }, art) };
      (EMBLEM[d.emblem] || EMBLEM.moon)(A);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 0.8 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 24, 5, 0.62), fill: ink, weight: 800, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 8, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'chrome', labelSize: 6, labelFont: "'Oswald', sans-serif", labelWeight: 600, labelLs: 0.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const M = (o) => def(Object.assign({ form: 'mrb-flake', brand: 'Mr. Black', cost: 1.4 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#7fd4ff' })] }));

  tz.addDefs([
    M({
      id: 'mrb.supermoon', name: 'Mega Moon Reverb', ref: 'Mr. Black SuperMoon', logo: 'MEGA MOON', tagline: 'MODULATED REVERB', cat: 'Reverb', typeName: 'Swaying ambient reverb',
      color: '#1d2a5a', flake: '#cfe0ff', c1: '#f4e7b0', c2: '#cbbd84', emblem: 'moon', seed: 9,
      algo: 'reverb', opts: { fixedMode: 6, mode: 6 },
      controls: [K('mix', 'MIX', { def: 0.4 }), K('decay', 'DECAY', { def: 0.55 }), K('mod', 'SWAY', { def: 0.4 })],
      fixed: { mode: 6, size: 0.8, tone: 0.55, predelay: 25 },
      desc: 'Lush, wobbling reverb from short rooms to near-endless washes; SWAY adds pitch modulation at a fixed rate.',
    }),
    M({
      id: 'mrb.eterna', name: 'Forever Gilded', ref: 'Mr. Black Eterna Gold', logo: 'FOREVER', tagline: 'GILDED SHIMMER REVERB', cat: 'Reverb', typeName: 'Shimmer reverb',
      color: '#8c6a1e', flake: '#fff3c0', c1: '#fbe7a1', c2: '#3a2a08', text: '#fff7df', emblem: 'sun', seed: 21,
      algo: 'reverb', opts: { fixedMode: 4, mode: 4 },
      controls: [K('shimmer', 'SHIMMER', { def: 0.45 }), K('decay', 'DECAY', { def: 0.7 }), K('mix', 'MIX', { def: 0.4 })],
      fixed: { mode: 4, size: 0.85, tone: 0.65 },
      desc: 'Octave-up shimmer reverb with very long tails (up to near-infinite). SHIMMER blends the octave voice into the reverb.',
    }),
  ]);
}
