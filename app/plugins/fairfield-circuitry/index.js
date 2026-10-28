// Built-in Tone Zone plugin: Fairfield Circuitry.
// Blocks inspired by Fairfield Circuitry pedals (Montreal). Names and artwork are Tone Zone originals; control sets,
// mini toggles and layouts follow the real units (see each block's `ref`). One custom "ffc-steel" enclosure serves
// the family: bare brushed steel with only the barest information stamped into the metal – a tiny line icon, the
// name in small lower-case type and a turquoise status LED.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
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
  // ------------------------------------------------------------------ stamped line icons (100 x 60 box)
  const ICON = {
    echoes: (A) => { [[22, 13], [48, 10], [70, 7.5], [87, 5]].forEach(([x, r], i) => A.o(`M${x} 30m-${r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0`, 2.2 - i * 0.3)); },
    water: (A) => { [16, 30, 44].forEach((y, i) => A.o(`M8 ${y} q10.5 -${8 - i * 2} 21 0 t21 0 t21 0 t21 0`, 2)); },
    rings: (A) => { [6, 12, 18, 24].forEach((r) => A.o(`M50 30m-${r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0`, 1.8)); A.o('M50 2V8M50 52V58M22 30H16M78 30H84', 1.8); },
    pole: (A) => {
      A.o('M36 4H64M36 56H64M40 8V52M60 8V52', 2.2);
      for (let i = 0; i < 5; i++) A.o(`M40 ${12 + i * 9}L60 ${20 + i * 9}`, 2.4);
    },
  };

  let seq = 0;
  tz.addForm('ffc-steel', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 120, H = d.h || 232;
    const id = 'ffc' + ++seq;
    const ink = '#26292c';
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 36, 64, [0, 0, 0], 0, 0.1, 0);
    formKit.body(g, W, H, d.color || '#d3d6d9', { rx: 6, brushed: true });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    // four corner screws of the steel lid
    [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]].forEach(([x, y]) => formKit.screw(g, x, y, 2.4));
    const L = layout(d, W, H, { kr: d.knobR || 10.5, top: 20, pad: 12 });
    const name = d.logo || d.name, tag = d.tagline;
    const z0 = L.y + 6, z1 = L.artBottom;
    const ns = fit(name, W - 34, 13, 0.52);
    const nameY = z1 - (tag ? 10 : 2) - ns * 0.5;
    const ih = Math.min(34, nameY - ns * 0.6 - 8 - z0);
    if (ih > 12) {
      const s = Math.min((W - 50) / 100, ih / 60);
      const art = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${z0 + (nameY - ns * 0.6 - 8 - z0 - 60 * s) / 2}) scale(${s})`, opacity: 0.85 }, g);
      const A = { o: (dd, w) => svg('path', { d: dd, fill: 'none', stroke: ink, 'stroke-width': w / Math.max(s, 0.4), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, art) };
      (ICON[d.icon] || ICON.rings)(A);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Inter', sans-serif", weight: 600, ls: 0.2 });
    if (tag) label(g, W / 2, z1 - 3, tag, { size: fit(tag, W - 30, 4.8, 0.62), fill: ink, weight: 700, ls: 1.6, opacity: 0.8 });
    formKit.tzBadge(g, W / 2, H - 9, ink, 3.8);
    togTitles(g, L, ink, { size: 6 });
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.8, labelFont: "'Inter', sans-serif", labelWeight: 600, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const F = (o) => def(Object.assign({ form: 'ffc-steel', brand: 'Fairfield Circuitry', cost: 0.8 }, o, {
    controls: [...o.controls, FOOT(), LED({ color: '#2fd6c8' })],
  }));

  tz.addDefs([
    F({ color: '#d3d6d9',
      id: 'ffc.meetmaude', name: 'Greet Gertrude', ref: 'Fairfield Circuitry Meet Maude', logo: 'greet gertrude', tagline: 'ANALOG DELAY', cat: 'Delay', typeName: 'Analog (BBD) delay',
      icon: 'echoes', rows: [3, 2], h: 258, cost: 1,
      algo: 'delay', opts: { fixedMode: 1, mode: 1, maxMs: 500, defaultMs: 300 },
      controls: [
        K('level', 'VOLUME', { def: 0.5, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), K('mix', 'MIX', { def: 0.4, display: ten }),
        K('feedback', 'FEEDBACK', { min: 0, max: 1.08, def: 0.4 }), K('time', 'TIME', { min: 50, max: 500, def: 300, display: ms }),
        TOG('comp', 'C', ['LT', 'HVY'], { def: 0, virtual: true }), TOG('modsw', 'M', ['OFF', 'LT', 'HVY'], { def: 0, virtual: true }),
      ],
      ctrl: { ins: [{ label: 'CV', param: 'feedback', min: 0, max: 1.08 }] },
      derive: (p) => ({ mode: 1, sat: (p.comp ?? 0) ? 0.65 : 0.25, age: (p.comp ?? 0) ? 0.5 : 0.3, moddepth: [0, 0.18, 0.5][p.modsw ?? 0], modrate: 0.32 }),
      desc: 'Dark, warm bucket-brigade delay (50–500 ms) that self-oscillates. C sets light or heavy compression in the feedback path, M adds light or heavy random time modulation (approximated with the BBD wow).',
    }),
    F({ color: '#d3d6d9',
      id: 'ffc.shallowwater', name: 'Puddle Deep', ref: 'Fairfield Circuitry Shallow Water', logo: 'puddle deep', tagline: 'K-FIELD MODULATOR', cat: 'Modulation', typeName: 'Random pitch modulator + LPG',
      icon: 'water', rows: [3, 3], h: 236, cost: 0.9,
      algo: 'chain', opts: { chain: [
        { prefix: 'c', algo: 'chorus', params: { mode: 1, tone: 0.6, feedback: 0 } },
        { prefix: 'w', algo: 'wah', opts: { fLo: 300, fHi: 7000, q: 0.6 }, params: { mode: 2, filter: 0, q: 0.15, direction: 0 } },
      ] },
      controls: [
        K('c.rate', 'RATE', { def: 0.3 }), K('damp', 'DAMP', { def: 0.5, virtual: true }), K('c.depth', 'DEPTH', { def: 0.4 }),
        K('lpg', 'LPG', { def: 0.3, virtual: true }), K('c.mix', 'MIX', { def: 0.6 }), K('c.level', 'VOLUME', { def: 0.5, display: ten }),
      ],
      derive: (p) => { const l = p.lpg ?? 0.3; return { 'c.mode': 1, 'c.wave': 1 - (p.damp ?? 0.5), 'w.on': l > 0.02 ? 1 : 0, 'w.sens': 0.3 + 0.6 * l, 'w.range': 0.35 + 0.6 * l, 'w.level': 0.85 }; },
      desc: 'Woozy, seasick pitch wobble with a low-pass gate that opens on every pick. The real unit\'s random modulation is approximated with a vibrato whose wave softens as DAMP goes up.',
    }),
    F({ color: '#d3d6d9',
      id: 'ffc.randysrevenge', name: 'Rodney\'s Retort', ref: 'Fairfield Circuitry Randy\'s Revenge', logo: 'rodney\'s retort', tagline: 'RING MODULATOR', cat: 'Modulation', typeName: 'Ring modulator',
      icon: 'rings', rows: [2], knobR: 13,
      algo: 'chain', opts: { chain: [
        { prefix: 'm', algo: 'ringmod' },
        { prefix: 's', algo: 'drive', opts: { tone: 'none', postLp: 12000, modes: [{ clip: 'si', gainMinDb: 8, gainMaxDb: 8, levelMinDb: -2, levelMaxDb: -2 }, { clip: 'clean', gainMinDb: 0, gainMaxDb: 0, levelMinDb: 4, levelMaxDb: 4 }] } },
      ] },
      controls: [K('freq', 'FREQUENCY', { def: 0.45, virtual: true }), K('m.mix', 'MIX', { def: 0.6 }),
        TOG('wave', 'WAVE', ['SQR', 'SIN'], { def: 1, virtual: true }), TOG('range', 'RANGE', ['LO', 'HI'], { def: 1, virtual: true })],
      derive: (p) => { const f = p.freq ?? 0.45; return { 'm.freq': (p.range ?? 1) ? 0.4 + 0.6 * f : 0.45 * f, 's.mode': (p.wave ?? 1) ? 1 : 0, 's.gain': 0.5, 's.level': 0.5 }; },
      desc: 'Classic ring modulation from subtle tremolo-like throb (LO range) to clangorous bells (HI). The square carrier is approximated with harmonics added after the modulator.',
    }),
    F({ color: '#d3d6d9',
      id: 'ffc.barbershop', name: 'Hair Salon', ref: 'Fairfield Circuitry The Barbershop', logo: 'hair salon', tagline: 'MILLENNIUM OVERDRIVE', cat: 'Overdrive', typeName: 'Germanium overdrive',
      icon: 'pole', rows: [3],
      algo: 'drive', opts: { clip: 'ge', bias: 0.2, tone: 'lp', toneLo: 1500, toneHi: 7500, gainMinDb: 4, gainMaxDb: 34, preHp: 60, clipHp: 150, postLp: 9000, levelMinDb: -30, levelMaxDb: 4 },
      controls: [K('gain', 'DRIVE', { def: 0.45, display: ten }), K('level', 'VOLUME', { def: 0.55, display: ten }), K('sag', 'SAG', { def: 0.2, display: ten }),
        TOG('bright', 'TONE', ['DARK', 'BRT'], { def: 1, virtual: true })],
      derive: (p) => ({ tone: (p.bright ?? 1) ? 0.78 : 0.35 }),
      desc: 'Open, touch-sensitive germanium overdrive. SAG starves the circuit for a spongy, sputtery feel; the TONE switch picks a darker or brighter voice.',
    }),
  ]);
}
