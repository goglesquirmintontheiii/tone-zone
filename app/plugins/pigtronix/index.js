// Built-in Tone Zone plugin: Pigtronix.
// Blocks inspired by Pigtronix pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). One "pigtronix" enclosure: polished, brushed metal with a painted colour band holding the model name
// in heavy slanted type.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, shade } = tz.gfx;
  // ------------------------------------------------------------------ layout kit
  // Forms run more than once on shared control objects, so every placed control is kept in `owned` and
  // laid out again on each call.
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
  // the form prints toggle titles itself, a bit higher so the lever never hits them
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

  tz.addForm('pigtronix', (ctx, d) => {
    const g = ctx.g, W = 120, acc = d.accent || '#c8202a';
    const { L, H } = layoutFit(d, W, 224, 44, { kr: 11, top: 16, pad: 10, footB: 30, perRow: d.perRow || 3 });
    formKit.body(g, W, H, d.color || '#b9bec4', { rx: 6, brushed: true });
    // painted band with the name
    const by = L.y + 6, bh = Math.min(34, L.artBottom - by - 2);
    svg('path', { d: `M0 ${by + 5} L${W} ${by} V${by + bh - 5} L0 ${by + bh} Z`, fill: acc }, g);
    svg('path', { d: `M0 ${by + 5} L${W} ${by}`, stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 0.8 }, g);
    const name = d.logo || d.name, ns = Math.min(fit(name, W - 18, 17, 0.55), bh * 0.55);
    const t = label(g, W / 2, by + bh / 2 - (d.tagline ? 3 : 0), name, { size: ns, fill: d.logoColor || '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
    t.setAttribute('font-style', 'italic');
    if (d.tagline) label(g, W / 2, by + bh / 2 + ns * 0.5 + 1, d.tagline, { size: 4.4, fill: d.logoColor || '#fff', weight: 700, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, W / 2, H - 8, '#1d2024', 3.6);
    const ink = '#1d2024';
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.8, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 800, labelLs: 0.5 };
    togTitles(g, L, ink);
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip) };
  });

  const PX = (o) => def(Object.assign({ form: 'pigtronix', brand: 'Pigtronix', cost: 0.8 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff3b2f' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    PX({
      id: 'px.philtone', name: "Thinker's Tone", ref: "Pigtronix Philosopher's Tone", logo: "THINKER'S TONE", tagline: 'COMPRESSOR / SUSTAINER', cat: 'Dynamics', typeName: 'Parallel compressor',
      accent: '#c8202a', rows: [3, 2], cost: 0.9,
      algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'comp', opts: { type: 'opto' }, params: { attack: 0.15, ratio: 0.7 } }, { prefix: 'd', algo: 'drive', opts: { clip: 'asym', gainMinDb: 6, gainMaxDb: 24, tone: 'none', postLp: 9000, levelMaxDb: 0 }, params: { gain: 0.4, level: 0.5 } }] },
      controls: [k('c.level', 'VOLUME', { def: 0.42 }), k('c.blend', 'BLEND', { def: 0.65 }), k('c.sustain', 'SUSTAIN', { def: 0.55 }), k('c.tone', 'TREBLE'), k('grit', 'GRIT', { def: 0, virtual: true })],
      derive: (p) => { const gr = p.grit ?? 0; return { 'd.on': gr > 0.02 ? 1 : 0, 'd.blend': gr * 0.7, 'd.gain': 0.3 + gr * 0.5 }; },
      desc: 'Parallel optical compressor for long sustain. BLEND mixes in your dry signal, GRIT adds a little distortion.',
    }),
    PX({
      id: 'px.fatdrive', name: 'Chubby Drive', ref: 'Pigtronix Fat Drive', logo: 'CHUBBY DRIVE', tagline: 'TUBE-SOUND OVERDRIVE', cat: 'Overdrive', typeName: 'Tube-style overdrive',
      accent: '#1f1f22', led: '#ff7a1a',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 8, bias: 0.25, preHp: 60, gainMinDb: 4, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 8500, postLp: 8000, levelMaxDb: 6, modes: [{}, { gainMaxDb: 46, stage2Db: 14 }] },
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.45 }), k('tone', 'TONE'), TOG('mode', 'GAIN', ['LO', 'HI'])],
      desc: 'Warm, tube-like overdrive with a low and a high gain range.',
    }),
    PX({
      id: 'px.qtm', name: 'Quanta Time Modulator', ref: 'Pigtronix Quantum Time Modulator', logo: 'QUANTA', tagline: 'CHORUS / VIBRATO', cat: 'Modulation', typeName: 'Analog chorus / vibrato',
      accent: '#2a5fb0', stereo: 'both', rows: [2, 2],
      algo: 'chorus',
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.5 }), k('mix', 'MIX', { def: 0.5 }), k('delay', 'TIME', { def: 0.5 }), TOG('mode', 'MODE', ['CHORUS', 'VIBRATO', 'ENSEMBLE'], { values: [0, 1, 2], orient: 'v' })],
      desc: 'Analog-style chorus with vibrato and a lush three-voice ensemble mode.',
    }),
  ]);
}
