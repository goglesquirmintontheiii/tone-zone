// Built-in Tone Zone plugin: Source Audio.
// Blocks inspired by Source Audio pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). One "sa-one" enclosure: anodised gunmetal with a brushed finish, a coloured accent line and the model
// name in a slanted condensed type, sized `n` (single) or `w` (wide, two switches).
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, SLIDER, def, ten, db, ms } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;
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

  const SIZE = { n: [124, 226], w: [176, 236], eq: [168, 226] };
  tz.addForm('sa-one', (ctx, d) => {
    const g = ctx.g, [W, H0] = SIZE[d.size || 'n'], acc = d.accent || '#f08a24';
    let H = H0, L;
    if (d.size !== 'eq') ({ L, H } = layoutFit(d, W, H0, d.tagline ? 52 : 44, { kr: d.size === 'w' ? 11 : 11.5, top: 16, pad: 8, footB: 30, perRow: d.perRow || 3 }));
    const id = 'sa' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.07, 0);
    formKit.body(g, W, H, d.color || '#3e4349', { rx: 8, brushed: true });
    svg('rect', { width: W, height: H, rx: 8, fill: `url(#${id}n)` }, g);
    // slightly raised top deck
    svg('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 6, fill: 'none', stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.8 }, g);
    svg('rect', { x: 5, y: 5, width: W - 10, height: H - 10, rx: 5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08, 'stroke-width': 0.8 }, g);
    if (d.size === 'eq') {
      // graphic EQ: a row of vertical sliders across the top half
      const sl = d.controls.filter((c) => c.t === 'slider');
      sl.forEach((c) => owned.add(c));
      const x0 = 16, x1 = W - 16;
      sl.forEach((c, i) => Object.assign(c, { x: x0 + ((x1 - x0) * i) / (sl.length - 1), y: 66, h: 64, w: 6, capColor: c.p === 'level' ? '#d9dde2' : acc, labelSize: 4.6 }));
      L = layout(d, W, H, { top: 126, footB: 30 });
      label(g, 9, 34, '+15', { size: 4.2, fill: '#cfd3d8', anchor: 'start' });
      label(g, 9, 98, '-15', { size: 4.2, fill: '#cfd3d8', anchor: 'start' });
    }
    const name = d.logo || d.name;
    const ns = fit(name, W - 26, d.size === 'w' ? 22 : 19, 0.5);
    const nameY = L.artBottom - (d.tagline ? 9 : 2) - ns * 0.4;
    svg('path', { d: `M14 ${nameY - ns * 0.62 - 4} H${W - 14}`, stroke: acc, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
    const t = label(g, W / 2, nameY, name, { size: ns, fill: acc, font: "'Barlow Condensed', sans-serif", weight: 800, ls: 1.4 });
    t.setAttribute('font-style', 'italic');
    if (d.tagline) label(g, W / 2, nameY + ns * 0.5 + 5, d.tagline, { size: 4.8, fill: '#d6d9dd', weight: 700, ls: 1.6 });
    formKit.tzBadge(g, W / 2, H - 8, '#c4c8cd', 3.6);
    const theme = { toggleTitles: false, text: '#e3e6ea', knob: 'mxr', labelSize: 5.8, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 700, labelLs: 0.5 };
    togTitles(g, L, '#e3e6ea');
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip) };
  });

  const SA = (o) => def(Object.assign({ form: 'sa-one', brand: 'Source Audio', cost: 1 }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#3fd06a' })])] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const exp = (param, min = 0, max = 1) => ({ ins: [{ label: 'CTRL', param, min, max }] });
  const hold = { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } };

  tz.addDefs([
    SA({
      id: 'sa.nemesis', name: 'Nemo Delay', ref: 'Source Audio Nemesis Delay', logo: 'NEMO', tagline: 'DELAY', cat: 'Delay', typeName: 'Multi-mode delay',
      size: 'w', accent: '#f08a24', stereo: 'both', noStd: true,
      algo: 'delay', opts: { maxMs: 2400 },
      controls: [
        K('time', 'TIME', { min: 30, max: 2000, def: 420, display: ms, curve: 'log' }), k('feedback', 'FEEDBACK', { def: 0.38, max: 1.08 }), k('mix', 'MIX', { def: 0.35 }),
        k('intensity', 'INTENSITY', { def: 0.4, virtual: true }), k('moddepth', 'MOD DEPTH', { def: 0.15 }), k('modrate', 'MOD RATE', { def: 0.3 }),
        SEL('mode', 'TYPE', ['DIG', 'ANA', 'TAPE', 'OIL', 'REV', 'SHIM', 'PING', 'LOFI'], { values: [0, 1, 2, 4, 5, 6, 7, 3], togRow: true, r: 12, optSize: 4.4, labelRadius: 8 }),
        FOOT({ label: 'ON' }), FOOT({ action: 'tap', label: 'TAP', hold }),
        LED({ color: '#3fd06a' }), LED({ bind: 'tap:time', color: '#ff7a1a' }),
      ],
      ctrl: exp('feedback', 0, 1.05),
      derive: (p) => { const x = p.intensity ?? 0.4; return { age: x, tone: 0.75 - x * 0.4, sat: x * 0.6, shimmer: x }; },
      desc: 'Eight delay types. INTENSITY adds the character of each type: tape wear, analog darkness, shimmer amount. Hold TAP for runaway repeats.',
    }),
    SA({
      id: 'sa.ventris', name: 'Ventura Dual Reverb', ref: 'Source Audio Ventris Dual Reverb', logo: 'VENTURA', tagline: 'DUAL REVERB', cat: 'Reverb', typeName: 'Multi-mode reverb',
      size: 'w', accent: '#4fb7e8', stereo: 'both', noStd: true, cost: 1.6,
      algo: 'reverb',
      controls: [
        k('decay', 'DECAY', { def: 0.55 }), k('mix', 'MIX', { def: 0.35 }), K('predelay', 'PRE-DELAY', { min: 0, max: 300, def: 20, display: ms }),
        k('tone', 'TREBLE', { def: 0.55 }), k('lowcut', 'LOW CUT', { def: 0.15 }), k('mod', 'CONTROL', { def: 0.3 }),
        SEL('mode', 'TYPE', ['ROOM', 'HALL', 'PLATE', 'SPRG', 'SHIM', 'SWELL', 'ECHO', 'MOD'], { values: [0, 1, 2, 3, 4, 9, 8, 6], def: 1, togRow: true, r: 12, optSize: 4.4, labelRadius: 8 }),
        FOOT({ label: 'ON' }), FOOT({ action: 'param', p: 'sus', toggle: true, label: 'HOLD' }),
        LED({ color: '#3fd06a' }), LED({ bind: 'param:sus', color: '#4fb7e8' }),
      ],
      ctrl: exp('mix'),
      derive: (p) => (p.sus ? { decay: 0.99 } : {}),
      desc: 'Eight reverb types with pre-delay, treble and low cut. HOLD latches an endless tail.',
    }),
    SA({
      id: 'sa.collider', name: 'Collide Delay+Reverb', ref: 'Source Audio Collider Delay+Reverb', logo: 'COLLIDE', tagline: 'DELAY + REVERB', cat: 'Delay', typeName: 'Delay and reverb',
      size: 'w', accent: '#c46ae0', stereo: 'both', noStd: true, cost: 1.8,
      algo: 'chain', opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 2000 } }, { prefix: 'r', algo: 'reverb' }] },
      rows: [3, 3],
      controls: [
        K('d.time', 'TIME', { min: 30, max: 1600, def: 380, display: ms, curve: 'log' }), k('d.feedback', 'FEEDBACK', { def: 0.35, max: 1.05 }), k('d.mix', 'DLY MIX', { def: 0.3 }),
        k('r.decay', 'DECAY', { def: 0.5 }), k('r.tone', 'TONE', { def: 0.55 }), k('r.mix', 'VERB MIX', { def: 0.3 }),
        TOG('dtype', 'DELAY', ['DIG', 'ANA', 'TAPE'], { virtual: true }), TOG('rtype', 'REVERB', ['ROOM', 'HALL', 'PLATE'], { def: 1, virtual: true }),
        FOOT({ action: 'param', p: 'd.on', toggle: true, label: 'DELAY' }), FOOT({ action: 'param', p: 'r.on', toggle: true, label: 'REVERB' }),
        LED({ bind: 'param:d.on', color: '#3fd06a' }), LED({ bind: 'param:r.on', color: '#c46ae0' }),
      ],
      alwaysOn: true, initParams: { 'd.on': 1, 'r.on': 1 },
      ctrl: exp('d.feedback', 0, 1.05),
      derive: (p) => ({ 'd.mode': [0, 1, 2][p.dtype ?? 0], 'r.mode': [0, 1, 2][p.rtype ?? 1] }),
      desc: 'A delay and a reverb in one box, each with its own switch and three types.',
    }),
    SA({
      id: 'sa.eq2', name: 'EQ Two Graphic', ref: 'Source Audio EQ2 Programmable EQ', logo: 'EQ TWO', tagline: 'PROGRAMMABLE EQ', cat: 'EQ', typeName: '10-band graphic EQ',
      size: 'eq', accent: '#e8d14f', cost: 0.4,
      algo: 'geq', opts: { freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], q: 1.8 },
      controls: [
        ...['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'].map((l, i) => SLIDER('b' + i, l, { min: -15, max: 15, def: 0, display: db })),
        SLIDER('level', 'VOL', { min: -15, max: 15, def: 0, display: db }),
      ],
      desc: 'Ten-band graphic EQ with an output volume slider.',
    }),
  ]);
}
