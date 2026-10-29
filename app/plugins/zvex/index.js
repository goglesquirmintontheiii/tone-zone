// Built-in Tone Zone plugin: ZVEX Effects.
// Blocks inspired by ZVEX pedals. Names and artwork are Tone Zone originals; control sets and layouts follow the
// real units (see each block's `ref`). One custom "zvex-paint" enclosure serves the family: a hand-painted box
// covered in loose brush strokes, blobs, drips and splatter (seeded per pedal, palette per block), with a dark
// knob strip so labels stay readable and a painted name banner.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, noisePattern, shade } = tz.gfx;

  // ------------------------------------------------------------------ shared layout kit
  const owned = new WeakSet();
  const fit = (s, maxW, maxSize, k = 0.6) => Math.min(maxSize, maxW / Math.max(1, String(s).length * k));
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
    rows.filter((r) => r.length).forEach((row) => {
      const r = row[0].r || d.knobR || o.kr || 11;
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
      y += 18;
      const n = togs.length, sp = (W - 2 * pad) / n;
      togs.forEach((c, k) => { Object.assign(c, { x: pad + sp * (k + 0.5), y }); if (c.t === 'toggle') c.orient = c.orient || 'h'; });
      y += 16;
    }
    const footY = H - (o.footB ?? 30);
    const fx = feet.length === 1 ? [W / 2] : feet.length === 2 ? [W * 0.27, W * 0.73] : [W * 0.2, W * 0.5, W * 0.8];
    feet.forEach((f, k) => Object.assign(f, { x: fx[k], y: footY, r: f.r || 12, style: f.style || 'stomp' }));
    leds.forEach((l, k) => Object.assign(l, { x: fx[k] ?? W / 2, y: footY - 25, r: l.r || 2.8 }));
    return { y, footY, artBottom: footY - (leds.length ? 33 : 20), nFeet: feet.length };
  }

  // ------------------------------------------------------------------ paint helpers
  const rng = (seed) => { let s = (seed % 2147483646) + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  function blob(cx, cy, rx, ry, r) {
    const n = 8, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.75 + r() * 0.5; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }

  let seq = 0;
  tz.addForm('zvex-paint', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 124, H = d.h || 236;
    const id = 'zv' + ++seq;
    const pal = d.paint || ['#f2c230', '#e8452c', '#2d7fd0', '#46b356', '#f6efe0'];
    const r = rng(hash(d.id));
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [0, 0, 0], 0, 0.18, 1);
    formKit.body(g, W, H, d.color, { rx: 7 });
    const cp = svg('clipPath', { id: id + 'c' }, defs);
    svg('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 6.5 }, cp);
    const art = svg('g', { 'clip-path': `url(#${id}c)` }, g);
    // big loose blobs, then brush strokes, drips and splatter
    for (let i = 0; i < 9; i++) svg('path', { d: blob(r() * W, r() * H, 18 + r() * 26, 14 + r() * 22, r), fill: pal[i % pal.length], 'fill-opacity': 0.85 }, art);
    for (let i = 0; i < 7; i++) {
      const x0 = r() * W, y0 = r() * H, x1 = x0 + (r() - 0.5) * 120, y1 = y0 + (r() - 0.5) * 90;
      const c = pal[(i + 2) % pal.length];
      const dd = `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${((x0 + x1) / 2 + (r() - 0.5) * 60).toFixed(1)} ${((y0 + y1) / 2 + (r() - 0.5) * 60).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      svg('path', { d: dd, fill: 'none', stroke: shade(c, -0.35), 'stroke-width': 7 + r() * 5, 'stroke-linecap': 'round', 'stroke-opacity': 0.5 }, art);
      svg('path', { d: dd, fill: 'none', stroke: c, 'stroke-width': 4 + r() * 4, 'stroke-linecap': 'round' }, art);
      svg('path', { d: dd, fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-opacity': 0.35, transform: 'translate(-1 -1.5)' }, art);
    }
    let sp = '';
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, rr = 0.6 + r() * 1.8; sp += `M${(x - rr).toFixed(1)} ${y.toFixed(1)}a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(2 * rr).toFixed(1)} 0a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(-2 * rr).toFixed(1)} 0Z`; }
    svg('path', { d: sp, fill: d.ink || '#151515', 'fill-opacity': 0.75 }, art);
    svg('rect', { width: W, height: H, fill: `url(#${id}n)` }, art);
    const L = layout(d, W, H, { kr: d.knobR || 10, top: 18, pad: 8 });
    // dark knob strip (keeps labels legible over the paint)
    svg('rect', { x: 5, y: 3, width: W - 10, height: L.y, rx: 5, fill: '#121212', 'fill-opacity': 0.86, stroke: '#000', 'stroke-opacity': 0.5 }, g);
    svg('rect', { x: 5.5, y: 3.5, width: W - 11, height: L.y - 1, rx: 4.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.12 }, g);
    // painted name banner in the free zone
    const zoneTop = L.y + 8, zoneBot = L.artBottom;
    const bh = Math.min(42, zoneBot - zoneTop - 8);
    const by = zoneTop + (zoneBot - zoneTop - bh) / 2;
    const ban = svg('g', { transform: `rotate(${d.tilt ?? -3} ${W / 2} ${by + bh / 2})` }, g);
    svg('rect', { x: 11, y: by + 2, width: W - 22, height: bh, rx: 5, fill: '#000', 'fill-opacity': 0.4 }, ban);
    svg('rect', { x: 10, y: by, width: W - 20, height: bh, rx: 5, fill: d.banner || '#f6efe0', stroke: '#111', 'stroke-width': 1.6 }, ban);
    const name = d.logo || d.name;
    const sub = d.tagline;
    const ns = fit(name, W - 34, sub ? bh * 0.4 : bh * 0.6, 0.56);
    label(ban, W / 2, by + (sub ? bh * 0.36 : bh / 2), name, { size: ns, fill: d.bannerInk || '#141414', font: "'Oswald', sans-serif", weight: 700, ls: 0.6 });
    if (sub) label(ban, W / 2, by + bh * 0.8, sub, { size: fit(sub, W - 34, 5.4, 0.55), fill: d.bannerInk || '#141414', weight: 800, ls: 1 });
    // badge on a small dark tab below the footswitch (a full-width strip when the footswitches carry labels)
    if (L.nFeet > 1) svg('rect', { x: 5, y: L.footY + 17, width: W - 10, height: H - L.footY - 20, rx: 4, fill: '#121212', 'fill-opacity': 0.86 }, g);
    else svg('rect', { x: W / 2 - 22, y: H - 12, width: 44, height: 9, rx: 3, fill: '#121212', 'fill-opacity': 0.8 }, g);
    formKit.tzBadge(g, W / 2, H - 7.5, '#f2f2f2', 4.2);
    const theme = { text: '#f4f1ea', knob: d.knob || 'mxr', labelSize: d.labelSize || 5.8, labelWeight: 800, labelLs: 0.5 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const Z = (o) => def(Object.assign({ form: 'zvex-paint', brand: 'ZVEX', cost: 0.8 }, o, {
    controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));
  const pinchModes = [...Array(16)].map((_, i) => ({ bias: 0.02 + i * 0.045, clipHp: 60 + i * 30 }));

  tz.addDefs([
    Z({
      id: 'zvex.fuzzfactory', name: 'Buzz Foundry', ref: 'ZVEX Fuzz Factory', logo: 'BUZZ FOUNDRY', tagline: 'HAND-PAINTED GERMANIUM FUZZ', cat: 'Fuzz', typeName: 'Gated germanium fuzz',
      color: '#2a1b3d', paint: ['#f2c230', '#e8452c', '#2d9ad0', '#9ad04a', '#f08ac0'], w: 150, knobR: 9, rows: [5], labelSize: 5.4, knob: 'white',
      algo: 'chain', cost: 0.9,
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'ge', bias: 0.35, stages: 2, stage2Db: 8, tone: 'lp', toneLo: 1200, toneHi: 7000, gainMinDb: 12, gainMaxDb: 50, preHp: 35, postLp: 7500, levelMinDb: -38, levelMaxDb: -6 } },
        { prefix: 'g', algo: 'gate', params: { decay: 0.25, attack: 0.05 } },
      ] },
      controls: [
        K('f.level', 'VOLUME', { def: 0.62, display: ten }), K('gate', 'GATE', { def: 1, virtual: true, display: ten }), K('comp', 'COMP', { def: 0.8, virtual: true, display: ten }),
        K('drive', 'DRIVE', { def: 0.75, virtual: true, display: ten }), K('stab', 'STAB', { def: 1, virtual: true, display: ten }),
      ],
      derive: (p) => {
        const gate = p.gate ?? 1, comp = p.comp ?? 0.8, drive = p.drive ?? 0.75, stab = p.stab ?? 1;
        return { 'f.gain': Math.min(1, drive * 0.75 + comp * 0.25), 'f.sag': (1 - comp) * 0.9 + (1 - stab) * 0.4, 'f.tone': 0.25 + 0.75 * stab, 'g.threshold': 0.62 * (1 - gate) };
      },
      desc: 'Five interactive controls: DRIVE and COMP set the saturation, GATE (counter-clockwise) chokes the decay into sputter, STAB below max starves and darkens the circuit.',
    }),
    Z({
      id: 'zvex.boxofrock', name: 'Crate of Stone', ref: 'ZVEX Box of Rock', logo: 'CRATE OF STONE', tagline: 'DISTORTION + BOOST', cat: 'Distortion', typeName: 'Plexi-style distortion + boost',
      color: '#1a3a5c', paint: ['#e8452c', '#f2c230', '#f6efe0', '#3fa9e0', '#141414'], w: 140, h: 248, rows: [4], knobR: 10, noStd: true,
      algo: 'chain', cost: 0.9,
      opts: { chain: [
        { prefix: 'b', algo: 'boost', opts: { gainMinDb: 0, gainMaxDb: 20 }, params: { mode: 3 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'diode', tone: 'lp', toneLo: 900, toneHi: 6500, gainMinDb: 10, gainMaxDb: 40, preHp: 90, clipHp: 160, postLp: 7200, levelMinDb: -36, levelMaxDb: -4, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 4 }] } },
      ] },
      controls: [
        K('d.level', 'VOLUME', { def: 0.62, display: ten }), K('d.tone', 'TONE', { def: 0.55, display: ten }), K('d.gain', 'DRIVE', { def: 0.55, display: ten }), K('b.gain', 'BOOST', { def: 0.35, display: ten }),
        FOOT({ action: 'toggle', p: 'b.on', label: 'BOOST' }), FOOT({ label: 'DIST' }), LED({ bind: 'onparam:b.on', color: '#3d8bff' }), LED({ color: '#ff2a1a' }),
      ],
      initParams: { 'b.on': 0 },
      desc: 'Marshall-style distortion with an independent clean boost in front (left footswitch). The boost hits the distortion harder, as on the real unit.',
    }),
    Z({
      id: 'zvex.woolly', name: 'Hairy Mastodon', ref: 'ZVEX Woolly Mammoth', logo: 'HAIRY MASTODON', tagline: 'BASS FUZZ', cat: 'Fuzz', typeName: 'Bass fuzz',
      color: '#3b2a1c', paint: ['#c9853a', '#7b4a24', '#e8d6a6', '#5a7d3a', '#d2452c'], rows: [2, 2], knobR: 11, knob: 'cream',
      algo: 'drive', opts: { clip: 'si', bias: 0.1, stages: 2, stage2Db: 12, tone: 'lp', toneLo: 260, toneHi: 4200, gainMinDb: 18, gainMaxDb: 52, preHp: 18, clipHp: 30, postLp: 5200, levelMinDb: -40, levelMaxDb: -4, modes: pinchModes },
      controls: [K('level', 'OUTPUT', { def: 0.6, display: ten }), K('gain', 'WOOL', { def: 0.6, display: ten }), K('pinch', 'PINCH', { def: 0.3, virtual: true, display: ten }), K('tone', 'EQ', { def: 0.5, display: ten })],
      derive: (p) => ({ mode: Math.round((p.pinch ?? 0.3) * 15) }),
      desc: 'Massive, woolly bass fuzz that keeps the low end. PINCH narrows the pulse (more asymmetric, splattier), EQ sweeps from subby to snarling.',
    }),
    Z({
      id: 'zvex.sho', name: 'Super Hard Sell', ref: 'ZVEX Super Hard On', logo: 'SUPER HARD SELL', tagline: 'CLEAN BOOST', cat: 'Boost', typeName: 'Clean JFET boost',
      color: '#c22b2b', paint: ['#f2c230', '#141414', '#f6efe0', '#ff7a2f'], w: 100, h: 196, knobR: 13, knob: 'chrome',
      algo: 'drive', opts: { clip: 'jfet', bias: 0.05, tone: 'none', gainMinDb: -6, gainMaxDb: 28, preHp: 25, postLp: 16000, levelMinDb: 0, levelMaxDb: 0 },
      fixed: { level: 0.5 },
      controls: [K('gain', 'GAIN', { def: 0.22, display: ten })],
      desc: 'One knob: clean boost at low settings, grit and push as it goes up (the real one gets dirtier the harder you hit it).',
    }),
  ]);
}
