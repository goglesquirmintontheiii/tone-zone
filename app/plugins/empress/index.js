// Built-in Tone Zone plugin: Empress Effects.
// Blocks inspired by Empress Effects pedals. Names and artwork are Tone Zone originals; controls follow the real
// units (see `ref`). One "empress" enclosure: flat matte paint, thin white print, a hairline frame around the
// controls, chrome knobs and the model name in light lowercase type.
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ten, db, ms } = tz.helpers;
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

  const SIZE = { n: [124, 230], w: [184, 236] };
  tz.addForm('empress', (ctx, d) => {
    const g = ctx.g, [W, H0] = SIZE[d.size || 'n'], ink = d.text || '#f3f3f1';
    const id = 'em' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.06, 0);
    const { L, H } = layoutFit(d, W, H0, d.tagline ? 50 : 40, { kr: d.size === 'w' ? 11 : 11.5, top: 18, pad: 10, footB: 30, perRow: d.perRow || 3 });
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    // hairline frame around the control area
    svg('rect', { x: 6, y: 8, width: W - 12, height: L.y + 4, rx: 4, fill: 'none', stroke: ink, 'stroke-opacity': 0.45, 'stroke-width': 0.6 }, g);
    const name = d.logo || d.name;
    const room = L.artBottom - L.y - 12 - (d.tagline ? 10 : 0);
    const ns = Math.min(fit(name, W - 24, d.size === 'w' ? 22 : 19, 0.52), room * 0.8);
    const nameY = L.y + 12 + room / 2;
    label(g, W / 2, nameY, name, { size: ns, fill: d.accent || ink, font: "'Inter', sans-serif", weight: 300, ls: 0.6 });
    if (d.tagline) label(g, W / 2, nameY + ns * 0.55 + 4, d.tagline, { size: 4.8, fill: ink, weight: 600, ls: 2, opacity: 0.8 });
    formKit.tzBadge(g, L.nFeet === 3 ? W * 0.35 : W / 2, H - 8, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: 'chrome', labelSize: 5.6, labelFont: "'Inter', sans-serif", labelWeight: 600, labelLs: 0.4 };
    togTitles(g, L, ink, { size: 5.2 });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip) };
  });

  const EM = (o) => def(Object.assign({ form: 'empress', brand: 'Empress Effects', cost: 1 }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#4aa8ff' })])] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const tapRate = (msv) => Math.max(0, Math.min(1, Math.log(1000 / msv / 0.4) / Math.log(35)));
  const hold = { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } };

  tz.addDefs([
    EM({
      id: 'emp.echosystem', name: 'Echo Realm', ref: 'Empress Echosystem', logo: 'echo realm', tagline: 'DUAL ENGINE DELAY', cat: 'Delay', typeName: 'Dual engine delay',
      size: 'w', color: '#2c2f33', stereo: 'both', noStd: true, cost: 1.4, perRow: 4,
      algo: 'delay', opts: { maxMs: 2500 },
      controls: [
        k('mix', 'MIX', { def: 0.35 }), K('level', 'OUTPUT', { def: 0.5, display: ten }), k('feedback', 'FEEDBACK', { def: 0.4, max: 1.08 }), k('tone', 'TONE', { def: 0.6 }),
        K('time', 'DELAY A', { min: 30, max: 2000, def: 450, display: ms, curve: 'log' }), k('spread', 'DELAY B', { def: 0.5 }), k('moddepth', 'THING 1', { def: 0.15 }), k('age', 'THING 2', { def: 0.3 }),
        SEL('mode', 'MODE', ['DIGI', 'TAPE', 'ANA', 'LOFI', 'REV', 'DUAL', 'PING', 'AMB'], { values: [0, 2, 1, 3, 5, 8, 7, 10], togRow: true, r: 12, optSize: 4.4, labelRadius: 8 }),
        FOOT({ label: 'BYPASS' }), FOOT({ action: 'tap', label: 'TAP', hold }), FOOT({ action: 'param', p: 'dual', toggle: true, label: 'A+B' }),
        LED({ color: '#4aa8ff' }), LED({ bind: 'tap:time', color: '#4aa8ff' }), LED({ bind: 'param:dual', color: '#4aa8ff' }),
      ],
      ctrl: { ins: [{ label: 'EXP', param: 'feedback', min: 0, max: 1.05 }] },
      derive: (p) => (p.dual ? { mode: 8 } : {}),
      desc: 'Delay with many modes. A+B runs both engines as a dual delay. THING 1 and THING 2 change per mode (modulation, wear). DELAY B sets the second engine or stereo spread. Hold TAP for runaway repeats.',
    }),
    EM({
      id: 'emp.reverb', name: 'Regal Reverb', ref: 'Empress Reverb', logo: 'regal reverb', tagline: 'MULTI-MODE REVERB', cat: 'Reverb', typeName: 'Multi-mode reverb',
      size: 'w', color: '#1f2733', stereo: 'both', noStd: true, cost: 1.6, perRow: 4,
      algo: 'reverb',
      controls: [
        k('decay', 'DECAY', { def: 0.55 }), k('mix', 'MIX', { def: 0.35 }), k('level', 'OUTPUT', { def: 0.5 }), k('lowcut', 'LO', { def: 0.15 }),
        k('tone', 'HI', { def: 0.6 }), k('mod', 'THING 1', { def: 0.3 }), k('size', 'THING 2', { def: 0.6 }),
        SEL('mode', 'MODE', ['HALL', 'PLATE', 'SPRG', 'ROOM', 'SHIM', 'CLOUD', 'SWELL', 'GHOST'], { values: [1, 2, 3, 0, 4, 5, 9, 6], togRow: true, r: 12, optSize: 4.4, labelRadius: 8 }),
        FOOT({ label: 'BYPASS' }), FOOT({ action: 'param', p: 'sus', toggle: true, label: 'HOLD' }),
        LED({ color: '#4aa8ff' }), LED({ bind: 'param:sus', color: '#4aa8ff' }),
      ],
      ctrl: { ins: [{ label: 'EXP', param: 'mix' }] },
      derive: (p) => (p.sus ? { decay: 0.99 } : {}),
      desc: 'Studio-grade reverb with eight modes, low and high EQ, and two mode-dependent "thing" knobs. HOLD freezes the tail.',
    }),
    EM({
      id: 'emp.paraeq', name: 'Para Equalizer', ref: 'Empress ParaEQ MKII', logo: 'para eq', tagline: 'PARAMETRIC EQ + BOOST', cat: 'EQ', typeName: '3-band parametric EQ',
      size: 'w', color: '#1c1c1e', cost: 0.4, rows: [3, 3, 2],
      algo: 'peq',
      controls: [
        K('lowgain', 'LOW', { min: -15, max: 15, def: 0, display: db }), K('mid1gain', 'MID', { min: -15, max: 15, def: 0, display: db }), K('highgain', 'HIGH', { min: -15, max: 15, def: 0, display: db }),
        K('lowfreq', 'LO FREQ', { min: 35, max: 500, def: 100, curve: 'log', unit: 'Hz' }), K('mid1freq', 'MID FREQ', { min: 150, max: 4000, def: 800, curve: 'log', unit: 'Hz' }), K('highfreq', 'HI FREQ', { min: 1500, max: 12000, def: 5000, curve: 'log', unit: 'Hz' }),
        TOG('mid1q', 'Q', ['WIDE', 'MED', 'NARROW'], { values: [0.5, 1, 2.6], def: 1 }), K('level', 'BOOST', { min: -6, max: 18, def: 0, display: db }),
      ],
      desc: 'Three-band parametric EQ with sweepable frequencies, a mid Q switch and a clean boost.',
    }),
    EM({
      id: 'emp.compressor', name: 'Crown Compressor', ref: 'Empress Compressor MKII', logo: 'crown comp', tagline: 'STUDIO COMPRESSOR', cat: 'Dynamics', typeName: 'VCA compressor',
      color: '#8a1f24', cost: 0.6,
      algo: 'comp', opts: { type: 'vca' },
      controls: [
        k('sustain', 'INPUT', { def: 0.5 }), k('attack', 'ATTACK', { def: 0.3 }), k('release', 'RELEASE', { def: 0.4 }),
        k('blend', 'MIX', { def: 1 }), k('level', 'OUTPUT', { def: 0.36 }), TOG('ratio', 'RATIO', ['2:1', '4:1', '10:1'], { values: [0.3, 0.55, 0.85], def: 1, togRow: true }),
      ],
      desc: 'Clean studio compressor with ratio switch and a MIX knob for parallel compression.',
    }),
    EM({
      id: 'emp.tremolo2', name: 'Throne Tremolo 2', ref: 'Empress Tremolo2', logo: 'throne trem', tagline: 'TAP TREMOLO', cat: 'Modulation', typeName: 'Tap tremolo',
      color: '#c46a1f', noStd: true, cost: 0.5,
      algo: 'tremolo',
      controls: [
        k('rk', 'SPEED', { def: 0.45, virtual: true }), k('depth', 'DEPTH', { def: 0.6 }), k('level', 'VOLUME', { def: 0.5 }),
        SEL('wave', 'WAVE', ['SINE', 'SQR', 'TRI', 'RAMP', 'RND'], { values: [0.3, 1, 0, 0.6, 0.45], togRow: true, r: 9 }), TOG('mode', 'TYPE', ['OPTO', 'HARM', 'BIAS'], { togRow: true }),
        FOOT({ label: 'ON' }), FOOT({ action: 'tap', label: 'TAP', tapTarget: 'tapms' }),
        LED({ color: '#4aa8ff' }), LED({ bind: 'rate:on:rk', color: '#4aa8ff' }),
      ],
      // after a tap, SPEED trims around the tapped tempo
      derive: (p) => ({ rate: p.tapms ? Math.max(0, Math.min(1, tapRate(p.tapms) + ((p.rk ?? 0.5) - 0.5) * 0.25)) : p.rk ?? 0.45 }),
      desc: 'Tremolo with tap tempo, five wave shapes and opto, harmonic or bias types.',
    }),
  ]);
}
