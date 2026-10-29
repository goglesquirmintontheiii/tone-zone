// Built-in Tone Zone plugin: Origin Effects.
// Blocks inspired by Origin Effects pedals. Names and artwork are Tone Zone originals; controls follow the real
// units (see `ref`). One "origin" enclosure: satin metallic paint, a black studio-style face plate behind the
// controls, chrome-skirted knobs and a small engraved-looking model plate.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, noisePattern, shade } = tz.gfx;
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

  tz.addForm('origin', (ctx, d) => {
    const g = ctx.g, W = 132;
    const id = 'or' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 40, 64, [255, 255, 255], 0, 0.12, 0);
    const { L, H } = layoutFit(d, W, 236, 56, { kr: 11.5, top: 24, pad: 12, footB: 30, perRow: d.perRow || 3 });
    formKit.body(g, W, H, d.color, { rx: 7, brushed: true });
    svg('rect', { width: W, height: H, rx: 7, fill: `url(#${id}n)` }, g);
    // face plate: black with a thin silver edge, drawn under the controls
    const plate = svg('rect', { x: 7, y: 15, width: W - 14, height: L.y, rx: 4, fill: '#121315', stroke: '#c9ced4', 'stroke-width': 0.8 }, g);
    void plate;
    for (const [x, y] of [[12, 20], [W - 12, 20], [12, L.y + 10], [W - 12, L.y + 10]]) svg('circle', { cx: x, cy: y, r: 1.6, fill: '#8e949b' }, g);
    // model plate
    const name = d.logo || d.name, ns = fit(name, W - 40, 13, 0.62);
    const py = (L.y + 15 + L.artBottom) / 2;
    svg('rect', { x: 16, y: py - 13, width: W - 32, height: 26, rx: 3, fill: shade(d.color, -0.45), stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.6 }, g);
    label(g, W / 2, py - (d.tagline ? 3 : 0), name, { size: ns, fill: '#f1f1ee', font: "'Inter', sans-serif", weight: 700, ls: 1.8 });
    if (d.tagline) label(g, W / 2, py + 7, d.tagline, { size: 4.4, fill: '#d9dbdd', weight: 600, ls: 1.6 });
    formKit.tzBadge(g, W / 2, H - 8, shade(d.color, -0.6), 3.6);
    const theme = { toggleTitles: false, text: '#e9eaec', knob: 'chrome', labelSize: 5.6, labelFont: "'Inter', sans-serif", labelWeight: 700, labelLs: 0.6 };
    togTitles(g, L, '#e9eaec', { size: 5.2 });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip) };
  });

  const OE = (o) => def(Object.assign({ form: 'origin', brand: 'Origin Effects', cost: 0.7 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff3b2f' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    OE({
      id: 'oe.cali76cd', name: 'Coast 76 Compact Deluxe', ref: 'Origin Effects Cali76 Compact Deluxe', logo: 'COAST 76', tagline: 'COMPACT DELUXE', cat: 'Dynamics', typeName: 'FET studio compressor',
      color: '#8ea3b5', rows: [3, 2],
      algo: 'comp', opts: { type: 'vca' }, fixed: { ratio: 0.6, knee: 0.3 },
      controls: [k('sustain', 'IN', { def: 0.5 }), k('level', 'OUT', { def: 0.42 }), K('dry', 'DRY', { def: 0.25, display: ten, virtual: true }), k('attack', 'ATTACK', { def: 0.3 }), k('release', 'RELEASE', { def: 0.45 })],
      derive: (p) => ({ blend: 1 - (p.dry ?? 0.25) }),
      desc: 'Studio FET-style compressor. IN sets how hard it works, DRY blends in your clean signal.',
    }),
    OE({
      id: 'oe.revivaldrive', name: 'Revive Drive Compact', ref: 'Origin Effects RevivalDRIVE Compact', logo: 'REVIVE', tagline: 'AMP OVERDRIVE', cat: 'Overdrive', typeName: 'Valve amp overdrive',
      color: '#2f4a3a', rows: [3, 2],
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 8, bias: 0.2, preHp: 70, gainMinDb: 4, gainMaxDb: 42, tone: 'eq3', eqRangeDb: 11, bassF: 120, midF: 700, trebleF: 2800, postLp: 8500, levelMaxDb: 4,
        modes: [{ preEq: [{ type: 'peak', f: 700, q: 0.7, db: 2 }] }, { preEq: [{ type: 'ls', f: 120, q: 0.7, db: 3 }] }] },
      fixed: { mid: 0.5 },
      controls: [k('gain', 'DRIVE', { def: 0.45 }), k('level', 'OUTPUT', { def: 0.5 }), k('dirt', 'DIRT', { def: 0.3, virtual: true }), k('bass', 'BASS'), k('treble', 'TREBLE'),
        TOG('mode', 'VOICE', ['BRIT', 'US']), TOG('rect', 'RECT', ['SS', 'VALVE'], { def: 1, virtual: true })],
      derive: (p) => ({ sag: (p.rect ? 0.35 : 0.05) + (p.dirt ?? 0.3) * 0.3 }),
      desc: 'Valve amp style drive. VOICE picks a British or American flavour, RECT sets how much the power supply sags, DIRT adds grit.',
    }),
  ]);
}
