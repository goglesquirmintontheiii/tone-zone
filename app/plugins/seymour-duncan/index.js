// Built-in Tone Zone plugin: Seymour Duncan.
// Blocks inspired by Seymour Duncan pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). One "sd-stomp" enclosure: wrinkle-texture powder coat, a printed pinstripe frame and a bold block
// name over a worn band.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, ms } = tz.helpers;
  const { svg, label, formKit, noisePattern, shade } = tz.gfx;
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

  tz.addForm('sd-stomp', (ctx, d) => {
    const g = ctx.g, W = 122, ink = d.text || '#f1ece0', acc = d.accent || '#d32f2f';
    const id = 'sd' + ++seq;
    const { L, H } = layoutFit(d, W, 228, 46, { kr: 11, top: 16, pad: 10, footB: 30, perRow: d.perRow || 3 });
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'a', 30, 64, [0, 0, 0], 0, 0.3, 0);
    noisePattern(defs, id + 'b', 24, 48, [255, 255, 255], 0, 0.12, 0);
    formKit.body(g, W, H, d.color, { rx: 6, grain: false });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}a)` }, g);
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}b)` }, g);
    svg('rect', { x: 6, y: 6, width: W - 12, height: H - 12, rx: 3, fill: 'none', stroke: acc, 'stroke-width': 0.8 }, g);
    const by = L.y + 8, bh = Math.min(32, L.artBottom - by);
    svg('rect', { x: 6, y: by, width: W - 12, height: bh, fill: acc }, g);
    svg('rect', { x: 6, y: by, width: W - 12, height: bh, fill: `url(#${id}a)` }, g);
    const name = d.logo || d.name, ns = Math.min(fit(name, W - 24, 18, 0.62), bh * 0.56);
    label(g, W / 2, by + bh / 2 - (d.tagline ? 3 : 0), name, { size: ns, fill: d.logoColor || '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    if (d.tagline) label(g, W / 2, by + bh / 2 + ns * 0.5 + 1.5, d.tagline, { size: 4.4, fill: d.logoColor || '#fff', weight: 700, ls: 1.4 });
    formKit.tzBadge(g, W / 2, H - 9, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.8, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 800, labelLs: 0.6 };
    togTitles(g, L, ink);
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip) };
  });

  const SD = (o) => def(Object.assign({ form: 'sd-stomp', brand: 'Seymour Duncan', cost: 0.7 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff3b2f' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    SD({
      id: 'sd.killingfloor', name: 'Floor Burner', ref: 'Seymour Duncan Killing Floor', logo: 'FLOOR BURNER', tagline: 'HIGH GAIN BOOST', cat: 'Boost', typeName: 'Boost / overdrive',
      color: '#2d3a2e', accent: '#b8322a',
      algo: 'drive', opts: { clip: 'clean', preHp: 70, gainMinDb: 0, gainMaxDb: 24, tone: 'tilt', eqRangeDb: 8, trebleF: 1500, postLp: 12000, levelMinDb: -20, levelMaxDb: 6,
        modes: [{}, { clip: 'si', gainMaxDb: 36, preEq: [{ type: 'peak', f: 800, q: 0.7, db: 3 }] }] },
      controls: [k('level', 'LEVEL', { def: 0.45 }), k('gain', 'GAIN', { def: 0.4 }), k('tone', 'TONE'), TOG('mode', 'MODE', ['BOOST', 'OD'])],
      desc: 'Clean, punchy boost with a lot of gain on tap. The OD mode adds soft clipping and a mid push.',
    }),
    SD({
      id: 'sd.dirtydeed', name: 'Grimy Act', ref: 'Seymour Duncan Dirty Deed', logo: 'GRIMY ACT', tagline: 'DISTORTION', cat: 'Distortion', typeName: 'Rock distortion',
      color: '#1a1a1c', accent: '#c8202a',
      algo: 'drive', opts: { clip: 'si', bias: 0.1, stages: 2, stage2Db: 8, preHp: 80, gainMinDb: 8, gainMaxDb: 46, tone: 'lp', toneLo: 1200, toneHi: 7500, postLp: 8000, levelMaxDb: -6,
        modes: [{}, { preEq: [{ type: 'ls', f: 140, q: 0.7, db: 4 }] }] },
      controls: [k('level', 'LEVEL'), k('gain', 'GAIN', { def: 0.55 }), k('tone', 'TONE'), TOG('mode', 'BOTTOM', ['TIGHT', 'FULL'])],
      desc: 'Classic rock distortion, from crunchy rhythm to singing leads. BOTTOM adds low end.',
    }),
    SD({
      id: 'sd.vaportrail', name: 'Mist Trail', ref: 'Seymour Duncan Vapor Trail', logo: 'MIST TRAIL', tagline: 'ANALOG DELAY', cat: 'Delay', typeName: 'Analog delay',
      color: '#7f8a96', accent: '#24508a', text: '#14181d', rows: [3, 2],
      algo: 'delay', opts: { maxMs: 600, fixedMode: 1 }, fixed: { mode: 1, tone: 0.45 },
      controls: [k('mix', 'MIX', { def: 0.35 }), K('time', 'DELAY', { min: 25, max: 600, def: 320, display: ms }), k('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), k('modrate', 'RATE', { def: 0.3 }), k('moddepth', 'DEPTH', { def: 0.15 })],
      desc: 'Warm bucket-brigade delay with modulation.',
    }),
    SD({
      id: 'sd.805', name: '508 Overdrive', ref: 'Seymour Duncan 805 Overdrive', logo: '508', tagline: 'OVERDRIVE', cat: 'Overdrive', typeName: 'EQ overdrive',
      color: '#121214', accent: '#d9a62a', logoColor: '#141414', rows: [2, 3],
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 650, preHp: 60, gainMinDb: 2, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 110, trebleF: 2800, midMin: 400, midMax: 1500, postLp: 7000, levelMaxDb: 6 },
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), TOG('midfreq', 'MID SHIFT', ['LO', 'HI'], { values: [0.25, 0.75] })],
      desc: 'Screamer-style drive with an active three-band EQ and a mid shift switch.',
    }),
  ]);
}
