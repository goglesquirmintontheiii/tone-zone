// Built-in Tone Zone plugin: Danelectro.
// Blocks inspired by Danelectro's tongue-in-cheek "food" mini pedals and the Back Talk reverse delay. Names and
// artwork are Tone Zone originals (the food puns are our own); control sets follow the real units (see `ref`).
// One custom "dano-diner" enclosure: 1950s diner look: rounded body in candy metallic paint, a chrome trim strip,
// a little food doodle (or an atomic starburst) and a retro script name.
export default function register(tz) {
  const { K, TOG, SLIDER, FOOT, LED, def, ten, ms } = tz.helpers;
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
  const DOODLE = {
    toast(A) {
      A.f('M30 54 V22 Q30 6 50 6 Q70 6 70 22 V54 Z', '#e9b86a');
      A.f('M35 50 V24 Q35 12 50 12 Q65 12 65 24 V50 Z', '#f7e2b0');
      A.o('M50 31 m0 0 a3 3 0 1 1 3 3 a6 6 0 1 1 -6 -6 a9 9 0 1 1 9 9', 1.6, '#8a4b1c');
    },
    brisket(A) {
      A.f('M14 40 Q20 16 52 16 Q86 16 88 34 Q88 50 56 50 Q22 52 14 40Z', '#b0503a');
      A.o('M24 38 Q50 30 80 34 M28 30 Q52 22 78 26', 2.2, '#f2c7a8');
      A.f('M14 40 Q22 52 56 50 Q88 50 88 34 L88 40 Q86 56 54 56 Q20 56 14 46Z', '#6d2a1c');
    },
    hash(A) {
      A.f('M50 30m-30 0a30 18 0 1 0 60 0a30 18 0 1 0 -60 0Z', '#d79a3d');
      for (let i = 0; i < 7; i++) A.o(`M${28 + i * 7} ${20 + (i % 2) * 3} l6 18`, 1.6, '#9a5e1a');
      A.o('M50 30m-30 0a30 18 0 1 0 60 0a30 18 0 1 0 -60 0', 1.6, '#7a4610');
    },
    fish(A) {
      A.f('M14 30 Q34 10 62 30 Q34 50 14 30Z', '#e6b25a');
      A.f('M60 30 L76 18 L72 30 L76 42Z', '#d49a3e');
      A.f('M24 27m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Z', '#3a2410');
      [[80, 46], [86, 40], [90, 50], [84, 54]].forEach(([x, y]) => A.f(`M${x} ${y}h3v-12h-3z`, '#f2d27a'));
    },
    shake(A) {
      A.f('M36 18 L64 18 L58 56 L42 56 Z', '#f4c6d2');
      A.f('M33 12 Q50 2 67 12 L67 18 L33 18 Z', '#fbf3f6');
      A.o('M36 18 L64 18 L58 56 L42 56 Z', 1.4, A.ink);
      A.o('M56 12 L66 0', 2.2, '#c8262c');
      A.f('M50 4m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z', '#c8262c');
    },
    can(A) {
      A.f('M26 20 H74 V48 Q50 56 26 48 Z', '#9aa3ab');
      A.f('M50 20m-24 0a24 7 0 1 0 48 0a24 7 0 1 0 -48 0Z', '#d6dce1');
      A.f('M28 30 H72 V40 H28 Z', '#2e6fb5');
      A.o('M50 20m-24 0a24 7 0 1 0 48 0a24 7 0 1 0 -48 0', 1.2, A.ink);
    },
    drum(A) {
      A.f('M30 40 Q22 18 46 14 Q68 12 66 30 Q64 44 48 44 Z', '#c97a33');
      A.f('M48 42 L64 54 Q70 52 70 58 Q64 60 60 56 L44 44 Z', '#f4ecd8');
      A.o('M30 40 Q22 18 46 14 Q68 12 66 30 Q64 44 48 44 Z', 1.2, A.ink);
    },
    sandwich(A) {
      A.f('M18 40 L50 10 L82 40 Z', '#e8c27a');
      A.f('M22 40 L50 14 L78 40 Z', '#7a3a8a');
      A.f('M26 40 L50 18 L74 40 Z', '#c99a5a');
      A.f('M18 40 H82 V46 H18 Z', '#e8c27a');
      A.o('M18 40 L50 10 L82 40 Z', 1.2, A.ink);
    },
    coffee(A) {
      A.f('M30 22 H66 L62 54 H34 Z', '#f4ecd8');
      A.f('M33 26 H63 V32 H33 Z', '#3a2210');
      A.o('M66 30 Q78 30 76 40 Q74 48 64 46', 2, A.ink);
      A.o('M30 22 H66 L62 54 H34 Z', 1.2, A.ink);
      A.o('M42 18 Q38 12 42 6 M52 18 Q48 12 52 6', 1.4, A.ink);
    },
    cheese(A) {
      A.f('M20 46 L80 46 L80 30 L28 18 Z', '#f2c53d');
      A.f('M80 30 L28 18 L20 30 L80 30 Z', '#f8dc6e');
      [[40, 38, 4], [62, 40, 3], [70, 34, 2.5], [32, 40, 2.5]].forEach(([x, y, r]) => A.f(`M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0Z`, '#d9a51a'));
      A.o('M20 46 L80 46 L80 30 L28 18 L20 30 Z', 1.2, A.ink);
    },
    atom(A) {
      [0, 60, 120].forEach((a) => A.o(`M50 30m-34 0a34 11 0 1 0 68 0a34 11 0 1 0 -68 0`, 1.8, A.ink, `rotate(${a} 50 30)`));
      A.f('M50 30m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z', A.ink);
      A.o('M86 10 L76 10 M81 5 L81 15 M14 52 L22 52 M18 48 L18 56', 1.6, A.ink);
    },
  };
  let seq = 0;
  tz.addForm('dano-diner', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 100, H = d.h || 196;
    const id = 'dn' + ++seq;
    const ink = d.ink || '#2a1a12';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 24, 64, [255, 255, 255], 0, 0.18, 0);
    formKit.body(g, W, H, d.color, { rx: 16 });
    svg('rect', { width: W, height: H, rx: 16, fill: `url(#${id}n)` }, g);
    const L = layout(d, W, H, { kr: d.knobR || 9.5, top: 18, pad: 8, footB: 32 });
    // chrome trim strip just below the controls
    const cg = svg('linearGradient', { id: id + 'c', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, '#f8f9fa'], [0.5, '#9ea4aa'], [1, '#e6e9ec']].forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, cg));
    svg('rect', { x: 0, y: L.y + 2, width: W, height: 5, fill: `url(#${id}c)` }, g);
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 12, z1 = L.artBottom;
    const ns = fit(name, W - 18, 20, 0.45);
    const nameY = z1 - (tag ? 9 : 1) - ns * 0.5;
    const ab = nameY - ns * 0.7 - 4;
    if (ab - z0 > 14) {
      // cream badge disc behind the doodle
      const s = Math.min((W - 24) / 100, (ab - z0) / 60);
      const cx = W / 2, cy = (z0 + ab) / 2;
      svg('ellipse', { cx, cy, rx: 52 * s, ry: 32 * s, fill: d.disc || '#fbf3dc', stroke: ink, 'stroke-width': 1 }, g);
      const art = svg('g', { transform: `translate(${cx - 50 * s * 0.8} ${cy - 30 * s * 0.8}) scale(${s * 0.8})` }, g);
      const A = { ink, f: (dd, fill) => svg('path', { d: dd, fill }, art), o: (dd, w, col, tr) => svg('path', { d: dd, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', transform: tr }, art) };
      (DOODLE[d.doodle] || DOODLE.atom)(A);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: d.nameColor || ink, font: "'Dancing Script', cursive", weight: 700 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 22, 4.8, 0.62), fill: ink, weight: 800, ls: 1.2 });
    formKit.tzBadge(g, W / 2, H - 8, ink, 3.4);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'cream', labelSize: 5.4, labelWeight: 800, labelLs: 0.5 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const DN = (o) => def(Object.assign({ form: 'dano-diner', brand: 'Danelectro', cost: 0.7 }, o, { controls: [...o.controls, FOOT({ r: 11 }), LED({ color: o.led || '#ff2a1a', r: 2.4 })] }));
  const BANDS = [100, 200, 400, 800, 1600, 3200, 6400];

  tz.addDefs([
    DN({
      id: 'dano.frenchtoast', name: 'Cinnamon Toast Octave Fuzz', ref: 'Danelectro French Toast', logo: 'Cinnamon Toast', tagline: 'OCTAVE DISTORTION', cat: 'Fuzz', typeName: 'Octave-up fuzz',
      color: '#c8562e', ink: '#2a140a', doodle: 'toast', rows: [2],
      algo: 'chain', opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { semis1: 12, level1: 0.55, level2: 0, level3: 0, dry: 1, quality: 0 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'muff', stages: 2, tone: 'lp', toneLo: 3500, toneHi: 3500, gainMinDb: 14, gainMaxDb: 46, preHp: 120, postLp: 6500, levelMinDb: -40, levelMaxDb: -8 } },
      ] },
      controls: [K('d.level', 'VOLUME', { def: 0.6, display: ten }), K('d.gain', 'DISTORTION', { def: 0.6, display: ten })],
      desc: 'Octave-up fuzz with a ring-mod edge. Sounds best on the neck pickup above the 12th fret. The octave is approximated with a pitch voice.',
    }),
    DN({
      id: 'dano.pastrami', name: 'Smoked Brisket Overdrive', ref: 'Danelectro Pastrami Overdrive', logo: 'Smoked Brisket', tagline: 'OVERDRIVE', cat: 'Overdrive', typeName: 'Mid-hump overdrive',
      color: '#8f2f3a', ink: '#fbe9dc', nameColor: '#fbe9dc', disc: '#f6e2cf', doodle: 'brisket', rows: [3], knobR: 9,
      algo: 'drive', opts: { clip: 'ts', tone: 'ts', gainMinDb: 8, gainMaxDb: 40, preHp: 200, clipHp: 720, postLp: 7500, levelMinDb: -30, levelMaxDb: 4 },
      controls: [K('level', 'VOL', { def: 0.55, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), K('gain', 'DRIVE', { def: 0.45, display: ten })],
      desc: 'Classic mid-forward green-box style overdrive in a tiny metallic box.',
    }),
    DN({
      id: 'dano.cornedbeef', name: 'Hash Brown Reverb', ref: 'Danelectro Corned Beef Reverb', logo: 'Hash Brown', tagline: 'REVERB', cat: 'Reverb', typeName: 'Spring-ish reverb',
      color: '#d4a640', ink: '#2c1d08', doodle: 'hash', knobR: 11, cost: 1.1,
      algo: 'reverb', opts: { fixedMode: 3, mode: 3 },
      fixed: { mode: 3, decay: 0.55, tone: 0.55 },
      controls: [K('mix', 'REVERB', { def: 0.35 })],
      desc: 'One knob of drippy, surfy spring-style reverb.',
    }),
    DN({
      id: 'dano.fishchips', name: 'Chips & Gravy EQ', ref: 'Danelectro Fish & Chips EQ', logo: 'Chips & Gravy', tagline: '7 BAND EQ', cat: 'EQ', typeName: '7-band graphic EQ',
      color: '#2d6fa8', ink: '#fdf6e3', nameColor: '#fdf6e3', disc: '#fdf3d6', doodle: 'fish', w: 116, h: 212, cost: 0.4,
      algo: 'geq', opts: { freqs: BANDS, q: 1.1 },
      controls: BANDS.map((f, i) => SLIDER('b' + i, f >= 1000 ? f / 1000 + 'K' : String(f), { min: -15, max: 15, def: 0, h: 38, labelSize: 4.2 })),
      desc: 'Seven sliders of cut / boost (100 Hz to 6.4 kHz) in a lunchbox-sized pedal.',
    }),
    DN({
      id: 'dano.backtalk', name: 'Talkback Reverse Delay', ref: 'Danelectro Back Talk', logo: 'Talkback', tagline: 'REVERSE DELAY', cat: 'Delay', typeName: 'Reverse delay',
      color: '#e7e1cf', ink: '#1f2a44', disc: '#ffffff', doodle: 'atom', w: 116, h: 206, rows: [3], knobR: 10, cost: 1,
      algo: 'delay', opts: { fixedMode: 5, mode: 5, maxMs: 1500, defaultMs: 500 },
      controls: [K('mix', 'MIX', { def: 0.5 }), K('time', 'SPEED', { min: 120, max: 1500, def: 500, curve: 'log', display: ms }), K('feedback', 'REPEAT', { min: 0, max: 0.9, def: 0.25 })],
      fixed: { mode: 5 },
      desc: 'Backwards repeats for instant psychedelia. SPEED sets the length of each reversed chunk.',
    }),
  ]);

  // ---- v0.4 additions
  tz.addDefs([
    DN({
      id: 'dano.milkshake', name: 'Malted Shake Chorus', ref: 'Danelectro Milkshake Chorus', logo: 'Malted Shake', tagline: 'CHORUS', cat: 'Modulation', typeName: 'Chorus',
      color: '#e8a3b6', ink: '#3a1420', doodle: 'shake', rows: [2],
      algo: 'chorus', fixed: { mode: 0, mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.5 })],
      desc: 'Simple, sweet chorus in a tiny box.',
    }),
    DN({
      id: 'dano.tunamelt', name: 'Salmon Melt Tremolo', ref: 'Danelectro Tuna Melt Tremolo', logo: 'Salmon Melt', tagline: 'TREMOLO', cat: 'Modulation', typeName: 'Tremolo',
      color: '#3f7fb8', ink: '#f6f1e2', nameColor: '#f6f1e2', disc: '#f6f1e2', doodle: 'can', rows: [3], knobR: 9,
      algo: 'tremolo', fixed: { mode: 0 },
      controls: [K('rate', 'SPEED', { def: 0.4 }), K('depth', 'DEPTH', { def: 0.6 }), K('level', 'TONE', { def: 0.5 }), TOG('hard', '', ['SOFT', 'HARD'], { virtual: true })],
      derive: (p) => ({ wave: p.hard ? 0.9 : 0.25 }),
      desc: 'Tremolo with a soft (sine) or hard (square) pulse. TONE trims the output level here.',
    }),
    DN({
      id: 'dano.chickensalad', name: 'Turkey Club Vibrato', ref: 'Danelectro Chicken Salad Vibrato', logo: 'Turkey Club', tagline: 'VIBRATO', cat: 'Modulation', typeName: 'Vibrato',
      color: '#e2c35a', ink: '#2a1e06', doodle: 'drum', rows: [2],
      algo: 'chorus', fixed: { mode: 1, mix: 1 },
      controls: [K('rate', 'SPEED', { def: 0.4 }), K('depth', 'DEPTH', { def: 0.45 })],
      desc: 'Pitch-wobble vibrato, from subtle to seasick.',
    }),
    DN({
      id: 'dano.pbj', name: 'Jam Sandwich Delay', ref: 'Danelectro PB&J Delay', logo: 'Jam Sandwich', tagline: 'DELAY', cat: 'Delay', typeName: 'Analog-style delay',
      color: '#8a4aa0', ink: '#f8eefc', nameColor: '#f8eefc', disc: '#fbf3dc', doodle: 'sandwich', rows: [3], knobR: 9,
      algo: 'delay', opts: { maxMs: 600 }, fixed: { mode: 1, tone: 0.4 },
      controls: [K('time', 'DELAY', { min: 30, max: 600, def: 300, display: ms }), K('feedback', 'REPEAT', { def: 0.35, max: 1.0 }), K('mix', 'MIX', { def: 0.4 })],
      desc: 'Warm, short-to-medium delay.',
    }),
    DN({
      id: 'dano.blackcoffee', name: 'Dark Roast Metal', ref: 'Danelectro Black Coffee Metal Distortion', logo: 'Dark Roast', tagline: 'METAL DISTORTION', cat: 'Distortion', typeName: 'Metal distortion',
      color: '#2a1d16', ink: '#f2e3c8', nameColor: '#f2e3c8', disc: '#f2e3c8', doodle: 'coffee', rows: [2, 2], knobR: 9, h: 212,
      algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 16, preHp: 110, gainMinDb: 18, gainMaxDb: 56, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 800, trebleF: 3200, postLp: 7500, levelMaxDb: -8, levelMinDb: -36 },
      fixed: { mid: 0.4 },
      controls: [K('level', 'VOL', { def: 0.5 }), K('gain', 'DRIVE', { def: 0.6 }), K('bass', 'LOW', { def: 0.6 }), K('treble', 'HIGH', { def: 0.55 })],
      desc: 'Heavy, scooped metal distortion with low and high EQ.',
    }),
    DN({
      id: 'dano.grilledcheese', name: 'Toasted Cheese Dist', ref: 'Danelectro Grilled Cheese Distortion', logo: 'Toasted Cheese', tagline: 'DISTORTION', cat: 'Distortion', typeName: 'Distortion',
      color: '#e07b2a', ink: '#2a1404', doodle: 'cheese', rows: [2],
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 10, gainMaxDb: 44, tone: 'none', postLp: 6500, levelMaxDb: -7, levelMinDb: -36,
        modes: [{ postLp: 5000 }, { postLp: 8500, preEq: [{ type: 'peak', f: 1200, q: 0.8, db: 4 }] }] },
      controls: [K('level', 'VOL', { def: 0.55 }), K('gain', 'DIST', { def: 0.55 }), TOG('mode', '', ['MILD', 'HOT'])],
      desc: 'Crunchy distortion with a MILD or HOT voice.',
    }),
  ]);
}
