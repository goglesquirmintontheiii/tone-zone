// Built-in Tone Zone plugin: Lovepedal.
// Blocks inspired by Lovepedal pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). One "lovepedal" enclosure: small gloss box with a painted heart emblem and a script name.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;
  // ------------------------------------------------------------------ layout kit
  // Forms run more than once and controls are shared, so every control a form places goes in `owned` and is laid
  // out again on each call.
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
  // the form prints toggle titles a bit higher than the core, so the lever doesn't hit them
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

  tz.addForm('lovepedal', (ctx, d) => {
    const g = ctx.g, W = 104, ink = d.text || '#fff6ea';
    const id = 'lp' + ++seq;
    const { L, H } = layoutFit(d, W, 200, 54, { kr: 10, top: 14, pad: 8, footB: 28, perRow: d.perRow || 2 });
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 36, 64, [255, 255, 255], 0, 0.12, 0);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const z0 = L.y + 4, z1 = L.artBottom;
    const name = d.logo || d.name, ns = fit(name, W - 16, 18, 0.46);
    const nameY = z1 - ns * 0.5;
    const hs = Math.min(16, (nameY - ns * 0.6 - z0 - 4) / 2);
    if (hs > 5) {
      const cx = W / 2, cy = z0 + hs + 1;
      const heart = `M${cx} ${cy + hs} C${cx - hs * 1.5} ${cy + hs * 0.1} ${cx - hs * 1.1} ${cy - hs * 1.1} ${cx} ${cy - hs * 0.4} C${cx + hs * 1.1} ${cy - hs * 1.1} ${cx + hs * 1.5} ${cy + hs * 0.1} ${cx} ${cy + hs} Z`;
      svg('path', { d: heart, fill: d.heart || '#d8202a', stroke: ink, 'stroke-width': 1.2 }, g);
      svg('path', { d: `M${cx - hs * 0.6} ${cy - hs * 0.3} q${hs * 0.2} ${-hs * 0.3} ${hs * 0.5} ${-hs * 0.25}`, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.6, 'stroke-width': 1, 'stroke-linecap': 'round' }, g);
      if (d.heartText) label(g, cx, cy + hs * 0.1, d.heartText, { size: hs * 0.62, fill: '#fff', font: "'Oswald', sans-serif", weight: 700 });
    }
    label(g, W / 2, nameY, name, { size: ns, fill: ink, font: "'Dancing Script', cursive", weight: 700 });
    formKit.tzBadge(g, W / 2, H - 7, ink, 3.2);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'cream', labelSize: 5.6, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 700, labelLs: 0.5 };
    togTitles(g, L, ink, { size: 5.2 });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip, 0.18) };
  });

  const LP = (o) => def(Object.assign({ form: 'lovepedal', brand: 'Lovepedal', cost: 0.6 }, o, { controls: [...o.controls, FOOT({ r: 11 }), LED({ color: o.led || '#ff3b2f', r: 2.5 })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    LP({
      id: 'lp.eternity', name: 'Forever Drive', ref: 'Lovepedal Eternity', logo: 'Forever', cat: 'Overdrive', typeName: 'Low-gain overdrive',
      color: '#1d3f7a', heart: '#d8202a',
      algo: 'drive', opts: { clip: 'si', cleanSum: true, cleanMix: 0.25, preHp: 70, clipHp: 500, gainMinDb: 2, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 8500, postLp: 9000, levelMaxDb: 8, modes: [{}, { clip: 'asym', bias: 0.2, gainMaxDb: 42 }] },
      controls: [k('level', 'VOLUME'), k('gain', 'DRIVE', { def: 0.45 }), k('tone', 'TONE'), k('glass', 'GLASS', { def: 0.4, virtual: true }), TOG('mode', 'CLIP', ['SYM', 'ASYM'])],
      derive: (p) => ({ bright: (p.glass ?? 0.4) * 0.8 }),
      desc: 'Dynamic, amp-like low-gain drive. GLASS adds top-end sparkle, CLIP picks symmetric or asymmetric clipping.',
    }),
    LP({
      id: 'lp.cot50', name: 'Cot 05', ref: 'Lovepedal COT 50', logo: 'Cot 05', cat: 'Overdrive', typeName: 'Small-amp overdrive', heartText: '05',
      color: '#e7e1d2', text: '#2a1a12', heart: '#2a1a12',
      algo: 'drive', opts: { clip: 'ge', stages: 2, stage2Db: 6, bias: 0.3, preHp: 80, gainMinDb: 6, gainMaxDb: 36, tone: 'none', postLp: 6500, levelMaxDb: 6 },
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.5 })],
      desc: 'Two knobs: the sound of a small tube amp cranked up.',
    }),
    LP({
      id: 'lp.ampeleven', name: 'Amp Twelve', ref: 'Lovepedal Amp Eleven', logo: 'Amp Twelve', cat: 'Overdrive', typeName: 'Amp-style overdrive', heartText: '12',
      color: '#b81f2a', heart: '#1a1a1a',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 8, bias: 0.25, preHp: 80, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 120, trebleF: 2600, postLp: 8000, levelMaxDb: 4, modes: [{}, { gainMaxDb: 48 }] },
      fixed: { mid: 0.5 },
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.5 }), k('bass', 'BASS'), k('treble', 'TREBLE'), TOG('mode', 'GAIN', ['LO', 'HI'])],
      desc: 'Amp in a box with bass and treble and a gain range switch.',
    }),
  ]);
}
