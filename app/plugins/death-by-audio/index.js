// Built-in Tone Zone plugin: Death By Audio.
// Blocks inspired by Death By Audio pedals (Brooklyn noise boxes). Names and artwork are Tone Zone originals;
// control sets, toggles and layouts follow the real units (see each block's `ref`). One custom "dba-print"
// enclosure serves the family: a flat powder-coat box with a heavy screen-printed frame, a bold one-colour
// emblem (planet, crossed bolts, dream-eye, peaks) and tall condensed block lettering.
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
  // ------------------------------------------------------------------ emblems (drawn in a 100 x 60 box)
  const EMBLEM = {
    planet(A) {
      A.fill('M50 30m-17 0a17 17 0 1 0 34 0a17 17 0 1 0 -34 0Z');
      A.line('M44 16 Q34 30 42 46 M54 14 Q62 28 56 46', 2.2, A.bg);
      A.line('M14 38 C24 22 76 14 88 24 C96 32 66 44 40 46 C24 47 10 46 14 38Z', 3.4, A.bg);
      A.line('M14 38 C24 22 76 14 88 24 C96 32 66 44 40 46 C24 47 10 46 14 38Z', 1.8, A.ink);
      [[12, 10, 2.2], [86, 8, 1.6], [90, 50, 2.4], [8, 52, 1.4], [70, 4, 1.2]].forEach(([x, y, r]) => A.fill(`M${x} ${y - r * 2}L${x + r * 0.5} ${y - r * 0.5}L${x + r * 2} ${y}L${x + r * 0.5} ${y + r * 0.5}L${x} ${y + r * 2}L${x - r * 0.5} ${y + r * 0.5}L${x - r * 2} ${y}L${x - r * 0.5} ${y - r * 0.5}Z`));
    },
    bolts(A) {
      A.line('M50 30m-27 0a27 27 0 1 0 54 0a27 27 0 1 0 -54 0', 2.4, A.ink);
      A.fill('M56 4 L36 33 L48 33 L42 56 L66 24 L53 24 L60 4 Z');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; A.line(`M${50 + Math.cos(a) * 31} ${30 + Math.sin(a) * 31}L${50 + Math.cos(a) * (i % 2 ? 36 : 40)} ${30 + Math.sin(a) * (i % 2 ? 36 : 40)}`, 2, A.ink); }
    },
    eye(A) {
      A.line('M8 30 Q50 -4 92 30 Q50 64 8 30Z', 2.6, A.ink);
      A.fill('M50 30m-13 0a13 13 0 1 0 26 0a13 13 0 1 0 -26 0Z');
      A.fill('M50 30m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z', null, A.bg);
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.12 + (i / 8) * 0.76); A.line(`M${50 + Math.cos(a) * 34} ${36 + Math.sin(a) * 34}L${50 + Math.cos(a) * 42} ${36 + Math.sin(a) * 42}`, 2, A.ink); }
      A.line('M22 50 q6 -5 12 0 t12 0 t12 0 t12 0 t12 0', 1.8, A.ink);
    },
    peaks(A) {
      A.fill('M2 58 L28 14 L40 32 L56 6 L98 58 Z');
      A.line('M22 25 L28 14 L34 24 M50 16 L56 6 L63 17', 2.4, A.bg);
      A.line('M2 58 L28 14 L40 32 L56 6 L98 58 Z', 1.6, A.ink);
      [[14, 8], [80, 12], [90, 30]].forEach(([x, y]) => A.line(`M${x - 4} ${y}H${x + 4}M${x} ${y - 4}V${y + 4}`, 1.6, A.ink));
    },
  };

  let seq = 0;
  tz.addForm('dba-print', (ctx, d) => {
    const g = ctx.g;
    const W = d.w || 124, H = d.h || 236;
    const id = 'dba' + ++seq;
    const ink = d.ink || '#121212', bg = d.color;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 48, 64, [255, 255, 255], 0, 0.12, 0);
    formKit.body(g, W, H, bg, { rx: 5 });
    svg('rect', { width: W, height: H, rx: 5, fill: `url(#${id}n)` }, g);
    // heavy printed frame with notched corners
    const f = 4.5, n = 7;
    svg('path', { d: `M${f + n} ${f}H${W - f - n}L${W - f} ${f + n}V${H - f - n}L${W - f - n} ${H - f}H${f + n}L${f} ${H - f - n}V${f + n}Z`, fill: 'none', stroke: ink, 'stroke-width': 1.6 }, g);
    const L = layout(d, W, H, { kr: d.knobR || 11, top: d.top ?? 18, pad: 10 });
    // emblem + name in the free zone
    const tag = d.tagline ? 8 : 0;
    const name = d.logo || d.name;
    const z0 = L.y + 4, z1 = L.artBottom;
    const ns = fit(name, W - 30, Math.min(d.logoSize || 24, (z1 - z0) * 0.32), 0.47);
    const nameY = z1 - tag - ns * 0.55;
    const box = { y: z0, h: nameY - ns * 0.55 - 6 - z0 };
    if (box.h > 18) {
      const s = Math.min((W - 24) / 100, box.h / 60);
      const art = svg('g', { transform: `translate(${(W - 100 * s) / 2} ${box.y + (box.h - 60 * s) / 2}) scale(${s})` }, g);
      const A = {
        ink, bg,
        fill: (dd, tr, col) => svg('path', { d: dd, fill: col || ink, transform: tr || undefined }, art),
        line: (dd, w, col) => svg('path', { d: dd, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, art),
      };
      (EMBLEM[d.emblem] || EMBLEM.planet)(A);
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 0.4 });
    if (d.tagline) label(g, W / 2, z1 - 3, d.tagline, { size: fit(d.tagline, W - 24, 5, 0.6), fill: ink, weight: 800, ls: 1.4 });
    formKit.tzBadge(g, W / 2, H - 9.5, ink, 4);
    togTitles(g, L, ink, { font: "'Oswald', sans-serif" });
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: d.labelSize || 6.2, labelFont: "'Oswald', sans-serif", labelWeight: 600, labelLs: 0.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(d, W, { flip: ctx.flip }) };
  });

  const D = (o) => def(Object.assign({ form: 'dba-print', brand: 'Death By Audio', cost: 0.8 }, o, {
    controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));

  tz.addDefs([
    D({
      id: 'dba.interstellar', name: 'Interplanet Overloader', ref: 'Death By Audio Interstellar Overdriver', logo: 'INTERPLANET', tagline: 'OVERLOADER', cat: 'Overdrive', typeName: 'Wide-range overdrive',
      color: '#c4c7ca', ink: '#141414', emblem: 'planet', knobR: 13,
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, stages: 2, stage2Db: 6, tone: 'none', gainMinDb: 0, gainMaxDb: 48, preHp: 70, clipHp: 220, postLp: 6800, levelMinDb: -38, levelMaxDb: -3,
        postEq: [{ type: 'peak', f: 1100, q: 1.4, db: 4 }, { type: 'hs', f: 4500, q: 0.7, db: -3 }] },
      controls: [K('level', 'MASTER', { def: 0.62, display: ten }), K('gain', 'OVERDRIVER', { def: 0.5, display: ten })],
      desc: 'From a subtle clean boost to full-on power-amp destruction with one knob, and a mid-forward, resonant voice that cuts through.',
    }),
    D({
      id: 'dba.fuzzwar', name: 'Fuzz Feud', ref: 'Death By Audio Fuzz War', logo: 'FUZZ FEUD', tagline: 'FILTERED DESTRUCTION', cat: 'Fuzz', typeName: 'Filtered wall-of-fuzz',
      color: '#1b1b1d', ink: '#efeee8', emblem: 'bolts', knob: 'white',
      algo: 'drive', opts: { clip: 'muff', bias: 0.15, stages: 3, stage2Db: 14, tone: 'lp', toneLo: 500, toneHi: 9000, gainMinDb: 4, gainMaxDb: 56, preHp: 40, postLp: 9500, levelMinDb: -44, levelMaxDb: -10 },
      controls: [K('level', 'VOLUME', { def: 0.62, display: ten, r: 9 }), K('tone', 'TONE', { def: 0.5, display: ten }), K('gain', 'FUZZ', { def: 0.7, display: ten })],
      desc: 'Boost at minimum, then overdrive, distortion and finally a blown-out wall of fuzz. TONE sweeps a filter from bass-heavy mud to jagged highs.',
    }),
    D({
      id: 'dba.echodream2', name: 'Echo Reverie II', ref: 'Death By Audio Echo Dream 2', logo: 'ECHO REVERIE', tagline: 'FUZZ · DELAY · MODULATION', cat: 'Delay', typeName: 'Fuzz + modulated delay',
      color: '#6c3fa0', ink: '#f3eefb', emblem: 'eye', knob: 'white', w: 150, h: 280, rows: [3, 4], knobR: 11, cost: 1.2,
      algo: 'chain', opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'muff', stages: 2, tone: 'lp', toneLo: 1800, toneHi: 1800, gainMinDb: 0, gainMaxDb: 44, preHp: 60, postLp: 7000, levelMinDb: -6, levelMaxDb: -6, cleanSum: true } },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 1000 }, params: { mode: 4, tone: 0.55 } },
      ] },
      controls: [
        K('mstr', 'MASTER', { def: 0.6, virtual: true, display: ten }), K('fuzz', 'FUZZ', { def: 0, virtual: true, display: ten }), K('dmix', 'DELAY', { def: 0.45, virtual: true, display: ten }),
        K('d.time', 'D TIME', { min: 30, max: 1000, def: 380, curve: 'log', display: ms }), K('d.feedback', 'FBACK', { min: 0, max: 1.05, def: 0.4 }),
        K('d.modrate', 'SPEED', { def: 0.3 }), K('d.moddepth', 'DEPTH', { def: 0.25 }),
        TOG('dry', 'DRY', ['ON', 'OFF'], { def: 0, virtual: true }), TOG('shape', 'SHAPE', ['SINE', 'SQR'], { def: 0, virtual: true }),
      ],
      derive: (p) => {
        const fz = p.fuzz ?? 0, dry = (p.dry ?? 0) === 0;
        return {
          'f.on': fz > 0.02 ? 1 : 0, 'f.gain': fz, 'f.blend': 0.4 + 0.6 * fz,
          'd.mix': dry ? (p.dmix ?? 0.45) * 0.6 : 1, 'd.level': 0.25 + 0.6 * (p.mstr ?? 0.6), 'd.age': (p.shape ?? 0) ? 0.75 : 0.25, 'd.sat': 0.2 + 0.5 * fz,
        };
      },
      desc: 'Fuzz into a modulated digital delay. DRY OFF gives repeats only; SHAPE switches the modulation from a smooth sine to a choppier, warbly wave (approximated with heavier wow & flutter).',
    }),
    D({
      id: 'dba.reverbmachine', name: 'Reverb Engine of Doom', ref: 'Death By Audio Reverberation Machine', logo: 'REVERB ENGINE', tagline: 'OF DOOM', cat: 'Reverb', typeName: 'Distorted reverb',
      color: '#e2dccb', ink: '#151515', emblem: 'peaks', cost: 1.3,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: { clip: 'asym', bias: 0.2, tone: 'none', gainMinDb: 0, gainMaxDb: 36, preHp: 70, postLp: 7500, levelMinDb: -34, levelMaxDb: 1 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 1, predelay: 30 } },
      ] },
      controls: [K('a.level', 'VOL', { def: 0.72, display: ten }), K('a.gain', 'ALTITUDE', { def: 0.25, display: ten }), K('r.mix', 'VERB', { def: 0.45 }),
        TOG('light', 'DARK / LIGHT', ['DARK', 'LIGHT'], { def: 0, virtual: true })],
      derive: (p) => ((p.light ?? 0) ? { 'r.mode': 6, 'r.tone': 0.85, 'r.decay': 0.62, 'r.mod': 0.6, 'r.lowcut': 0.35 } : { 'r.mode': 1, 'r.tone': 0.28, 'r.decay': 0.75, 'r.mod': 0.2, 'r.lowcut': 0.1, 'r.size': 0.85 }),
      desc: 'Reverb with a built-in distortion in front: ALTITUDE goes from clean to wide-open fuzz. DARK is cavernous, LIGHT is bright and shimmering.',
    }),
  ]);
}
