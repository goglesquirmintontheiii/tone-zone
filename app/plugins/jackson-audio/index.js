// Built-in Tone Zone plugin: Jackson Audio.
// Blocks inspired by Jackson Audio pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). One "jackson" enclosure: gloss metal-flake paint, an ornate double frame with corner flourishes, a
// fine-line emblem per model (`art`) and a script name.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, db } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;
  // ------------------------------------------------------------------ layout kit
  // Forms run more than once and control objects are shared: every control a form places is remembered in `owned`
  // and laid out again on each call.
  const owned = new WeakSet();
  let seq = 0;
  const fit = (s, maxW, maxSize, k = 0.6) => Math.min(maxSize, maxW / Math.max(1, String(s).length * k));
  // knob rows (labels above), a toggle row, footswitches + LEDs at the bottom; returns the free zone in between
  function layout(d, W, H, o = {}) {
    const cs = d.controls.filter((c) => !c.hidden);
    cs.forEach((c) => { if (c.x === undefined) owned.add(c); });
    const mine = (c) => owned.has(c);
    const knobs = cs.filter((c) => mine(c) && (c.t === 'knob' || c.t === 'sel') && !c.togRow);
    const togs = cs.filter((c) => mine(c) && (c.t === 'toggle' || c.t === 'button' || c.togRow));
    const feet = cs.filter((c) => mine(c) && c.t === 'foot');
    const leds = cs.filter((c) => mine(c) && c.t === 'led');
    const pad = o.pad ?? 8;
    let y = o.top ?? 16;
    const rows = [];
    let i = 0;
    for (const n of d.rows || []) { rows.push(knobs.slice(i, i + n)); i += n; }
    while (i < knobs.length) { rows.push(knobs.slice(i, i + (o.perRow || 3))); i += o.perRow || 3; }
    rows.filter((r) => r.length).forEach((row, ri) => {
      const r = row[0].r || (Array.isArray(d.knobR) ? d.knobR[ri] : d.knobR) || o.kr || 11;
      const sel = row.some((c) => c.t === 'sel');
      y += sel ? r + 19 : r + 12;
      const n = row.length, sp = (W - 2 * pad) / n;
      row.forEach((c, k) => {
        Object.assign(c, { x: pad + sp * (k + 0.5), y, r: c.r || r, labelPos: 'above' });
        if (c.t === 'sel') Object.assign(c, { optSize: c.optSize || 4.6, labelRadius: c.labelRadius ?? 7 });
      });
      y += sel ? r + 11 : r + 5;
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
    const footY = H - (o.footB ?? 30);
    const fx = o.footX || (feet.length === 1 ? [W / 2] : feet.length === 2 ? [W * 0.27, W * 0.73] : [W * 0.2, W * 0.5, W * 0.8]);
    feet.forEach((f, k) => Object.assign(f, { x: fx[k], y: footY, r: f.r || 12, style: f.style || 'stomp' }));
    leds.forEach((l, k) => Object.assign(l, { x: fx[k] ?? W / 2, y: footY - 25, r: l.r || 2.8 }));
    return { y, footY, artBottom: footY - (leds.length ? 33 : 20), nFeet: feet.length, togs };
  }
  // grows the box when the controls leave less than `need` px between the last row and the LEDs
  function layoutFit(d, W, H, need, o = {}) {
    let L = layout(d, W, H, o);
    const lack = need - (L.artBottom - L.y);
    if (lack > 0) { H += Math.ceil(lack); L = layout(d, W, H, o); }
    return { L, H };
  }
  // toggle titles printed by the form, a bit higher than the core does, so the lever never touches them
  function togTitles(g, L, fill, o = {}) {
    L.togs.forEach((c) => { if (c.t === 'toggle' && c.label) label(g, c.x, c.y - 21, c.label, { size: o.size || 5.6, fill, weight: 800, ls: 0.6, font: o.font }); });
  }
  // every jack on the top edge: audio outs, control jacks, audio ins
  function topJacks(d, W, flip, m = 0.12) {
    const short = (l) => l.replace(/^INPUT/, 'IN').replace(/^OUTPUT/, 'OUT').replace(' A (MONO)', ' L').replace(/ B$/, ' R');
    const ci = (d.ctrl && d.ctrl.ins) || [], co = (d.ctrl && d.ctrl.outs) || [];
    const all = [
      ...d.ports.outs.map((l, i) => ({ key: 'o' + i, dir: 'out', port: i, label: short(l) })),
      ...co.map((c, i) => ({ key: 'oc' + i, dir: 'out', port: 'c' + i, label: c.label, kind: c.kind || 'ctrl' })),
      ...ci.map((c, i) => ({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: c.label, kind: c.kind || 'ctrl' })),
      ...d.ports.ins.map((l, i) => ({ key: 'i' + i, dir: 'in', port: i, label: short(l) })),
    ];
    if (flip) all.reverse();
    const n = all.length;
    return all.map((j, k) => Object.assign(j, { side: 'top', x: W * (m + (1 - 2 * m) * (n === 1 ? 0.5 : k / (n - 1))), y: -2 }));
  }

  const ART = {
    sun(a) {
      a.C(50, 30, 12);
      for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2, r1 = i % 2 ? 16 : 18, r2 = i % 2 ? 22 : 28; a.S(`M${50 + Math.cos(t) * r1} ${30 + Math.sin(t) * r1}L${50 + Math.cos(t) * r2} ${30 + Math.sin(t) * r2}`, 1.2); }
    },
    bloom(a) {
      for (let i = 0; i < 6; i++) a.S(`M50 30 C${50 + Math.cos((i / 6) * 6.283 - 0.4) * 30} ${30 + Math.sin((i / 6) * 6.283 - 0.4) * 30} ${50 + Math.cos((i / 6) * 6.283 + 0.4) * 30} ${30 + Math.sin((i / 6) * 6.283 + 0.4) * 30} 50 30Z`, 1.2);
      a.C(50, 30, 4);
    },
    prism(a) {
      a.S('M50 6L74 50H26Z', 1.4);
      a.S('M6 34L40 30', 1.2);
      ['#e84a4a', '#f2a43a', '#f2e04a', '#4ac46a', '#4a8ae8', '#9a5ae8'].forEach((c, i) => a.S(`M62 ${28 + i * 1.6}L96 ${20 + i * 5}`, 1.4, c));
    },
  };
  tz.addForm('jackson', (ctx, d) => {
    const g = ctx.g, W = 126, ink = d.text || '#1a1a1a';
    const id = 'ja' + ++seq;
    const { L, H } = layoutFit(d, W, 232, 60, { kr: 11.5, top: 18, pad: 12, footB: 30, perRow: d.perRow || 3 });
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.22, 0);
    const gl = svg('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0.3, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.32 }, gl);
    svg('stop', { offset: 0.4, 'stop-color': '#fff', 'stop-opacity': 0 }, gl);
    svg('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.22 }, gl);
    formKit.body(g, W, H, d.color, { rx: 7 });
    svg('rect', { width: W, height: H, rx: 7, fill: `url(#${id}n)` }, g);
    svg('rect', { width: W, height: H, rx: 7, fill: `url(#${id}g)` }, g);
    // ornate frame
    svg('rect', { x: 5, y: 5, width: W - 10, height: H - 10, rx: 3, fill: 'none', stroke: ink, 'stroke-width': 0.9, 'stroke-opacity': 0.7 }, g);
    svg('rect', { x: 7.5, y: 7.5, width: W - 15, height: H - 15, rx: 2, fill: 'none', stroke: ink, 'stroke-width': 0.4, 'stroke-opacity': 0.6 }, g);
    for (const [x, y, sx, sy] of [[9, 9, 1, 1], [W - 9, 9, -1, 1], [9, H - 9, 1, -1], [W - 9, H - 9, -1, -1]])
      svg('path', { d: `M${x} ${y + sy * 8} Q${x} ${y} ${x + sx * 8} ${y} M${x + sx * 2} ${y + sy * 5} Q${x + sx * 2} ${y + sy * 2} ${x + sx * 5} ${y + sy * 2}`, fill: 'none', stroke: ink, 'stroke-width': 0.7, 'stroke-opacity': 0.7 }, g);
    const name = d.logo || d.name, ns = fit(name, W - 26, 22, 0.46);
    const z0 = L.y + 2, z1 = L.artBottom;
    const tagY = z1 - 2, nameY = d.tagline ? tagY - 6 - ns * 0.45 : z1 - ns * 0.5;
    const ab = nameY - ns * 0.62 - 2;
    if (d.art && ART[d.art] && ab - z0 > 14) {
      const s = Math.min((W - 30) / 100, (ab - z0) / 60);
      const ag = svg('g', { transform: `translate(${((W - 100 * s) / 2).toFixed(2)} ${(z0 + (ab - z0 - 60 * s) / 2).toFixed(2)}) scale(${s.toFixed(3)})`, fill: 'none', stroke: d.artInk || ink, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      ART[d.art]({ S: (p, w, c) => svg('path', { d: p, 'stroke-width': w, stroke: c }, ag), C: (cx, cy, r) => svg('circle', { cx, cy, r }, ag) });
    }
    label(g, W / 2, nameY, name, { size: ns, fill: d.logoColor || ink, font: "'Dancing Script', cursive", weight: 700 });
    if (d.tagline) label(g, W / 2, tagY, d.tagline, { size: fit(d.tagline, W - 28, 4.8, 0.62), fill: ink, weight: 700, ls: 1.6 });
    formKit.tzBadge(g, W / 2, H - 13, ink, 3.4);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'cream', labelSize: 5.6, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 700, labelLs: 0.6 };
    togTitles(g, L, ink);
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip, 0.26) };
  });

  const JA = (o) => def(Object.assign({ form: 'jackson', brand: 'Jackson Audio', cost: 0.7 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff3b2f' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    JA({
      id: 'ja.goldenboy', name: 'Gilded Lad', ref: 'Jackson Audio Golden Boy', logo: 'Gilded Lad', tagline: 'TRANSPARENT OVERDRIVE', cat: 'Overdrive', typeName: 'Klon-style overdrive',
      color: '#c9a44a', text: '#2a1c06', art: 'sun', knob: 'cream',
      algo: 'drive', opts: { clip: 'ge', cleanSum: true, cleanMix: 0.55, preHp: 60, clipHp: 400, gainMinDb: 0, gainMaxDb: 38, tone: 'tilt', trebleF: 1400, eqRangeDb: 8, postLp: 9500, levelMinDb: -24, levelMaxDb: 10,
        modes: [{}, { clip: 'si' }, { clip: 'clean', gainMaxDb: 24 }, { preEq: [{ type: 'ls', f: 120, q: 0.7, db: 3 }] }, { clip: 'si', preEq: [{ type: 'ls', f: 120, q: 0.7, db: 3 }] }, { clip: 'clean', gainMaxDb: 24, preEq: [{ type: 'ls', f: 120, q: 0.7, db: 3 }] }] },
      controls: [k('gain', 'GAIN', { def: 0.35 }), k('tone', 'TREBLE'), k('level', 'OUTPUT', { def: 0.45 }),
        TOG('clip', 'CLIP', ['GE', 'SI', 'OFF'], { virtual: true }), TOG('bass', 'BASS', ['STOCK', 'MORE'], { virtual: true })],
      derive: (p) => ({ mode: (p.clip ?? 0) + (p.bass ? 3 : 0) }),
      desc: 'Clean-blend "K" style overdrive with germanium, silicon or no clipping, plus a bass switch.',
    }),
    JA({
      id: 'ja.bloom', name: 'Blossom Compressor', ref: 'Jackson Audio Bloom', logo: 'Blossom', tagline: 'COMPRESSOR / EQ / BOOST', cat: 'Dynamics', typeName: 'Compressor with EQ',
      color: '#2a4f8f', text: '#f2ead2', art: 'bloom', knob: 'cream', cost: 0.9,
      algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'comp', opts: { type: 'opto' } }, { prefix: 'e', algo: 'peq', params: { lowfreq: 120, highfreq: 3500 } }] },
      controls: [k('c.level', 'VOLUME', { def: 0.45 }), k('c.sustain', 'SUSTAIN', { def: 0.5 }), k('c.blend', 'BLEND', { def: 0.7 }),
        k('c.attack', 'ATTACK', { def: 0.3 }), K('e.lowgain', 'BASS', { min: -12, max: 12, def: 0, display: db }), K('e.highgain', 'TREBLE', { min: -12, max: 12, def: 0, display: db }),
        TOG('c.ratio', 'RATIO', ['LO', 'MID', 'HI'], { values: [0.3, 0.55, 0.8], def: 1 })],
      desc: 'Optical compressor with blend, attack and a two-band EQ after it.',
    }),
    JA({
      id: 'ja.prism', name: 'Spectrum Preamp', ref: 'Jackson Audio Prism', logo: 'Spectrum', tagline: 'BUFFER / PREAMP / BOOST', cat: 'Boost', typeName: 'EQ preamp and boost',
      color: '#ece8df', text: '#1c1c1c', art: 'prism', knob: 'cream', cost: 0.4,
      algo: 'peq',
      controls: [K('level', 'BOOST', { min: -6, max: 18, def: 0, display: db }), K('lowgain', 'BASS', { min: -12, max: 12, def: 0, display: db }), K('mid1gain', 'MIDDLE', { min: -12, max: 12, def: 0, display: db }),
        K('highgain', 'TREBLE', { min: -12, max: 12, def: 0, display: db }), K('mid1freq', 'MID FREQ', { min: 250, max: 3000, def: 800, curve: 'log', unit: 'Hz' })],
      desc: 'Clean boost with a sweepable mid and bass and treble controls. Good as an always-on buffer.',
    }),
  ]);
}
