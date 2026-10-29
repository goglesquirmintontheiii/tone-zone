// Built-in Tone Zone plugin: Mojo Hand FX.
// Blocks inspired by Mojo Hand FX pedals. Names and artwork are Tone Zone originals; controls follow the real units
// (see `ref`). One "mojohand" enclosure: bright gloss paint with a bold woodcut-style emblem per model (`art`) on a
// round badge and a heavy name banner.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
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

  // emblems drawn in a 60 x 60 box, filled with the ink colour
  const ART = {
    giant: 'M30 7a5 5 0 1 1 0.1 0Z M24 15h12l2 17h-16Z M35 16l8 -9l3 2l-8 10Z M45 1c2 2 3 4 1 6c-2 -1 -2 -4 -1 -6Z M25 16l-6 12l3 1l5 -9Z M22 32h7l-3 24h-6Z M31 32h7l4 24h-6Z',
    bell: 'M30 6a3 3 0 1 1 0.1 0Z M30 10c-10 0 -14 8 -14 20c0 8 -4 12 -8 14h44c-4 -2 -8 -6 -8 -14c0 -12 -4 -20 -14 -20Z M24 48a6 6 0 0 0 12 0Z',
    rook: 'M16 8h6v5h5V8h6v5h5V8h6v12l-5 4v18l5 6v6H16v-6l5 -6V24l-5 -4Z',
  };
  tz.addForm('mojohand', (ctx, d) => {
    const g = ctx.g, W = 120, ink = d.text || '#151515';
    const id = 'mh' + ++seq;
    const { L, H } = layoutFit(d, W, 224, 62, { kr: 11, top: 16, pad: 10, footB: 30, perRow: d.perRow || 3 });
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'n', 36, 64, [255, 255, 255], 0, 0.14, 0);
    formKit.body(g, W, H, d.color, { rx: 6 });
    svg('rect', { width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const z0 = L.y + 4, z1 = L.artBottom;
    const name = d.logo || d.name, ns = fit(name, W - 26, 15, 0.62);
    const bnY = z1 - 10;
    const R = Math.min(22, (bnY - 12 - z0) / 2);
    if (R > 8) {
      const cy = z0 + R;
      svg('circle', { cx: W / 2, cy, r: R, fill: d.badge || '#f4ecd6', stroke: ink, 'stroke-width': 1.6 }, g);
      svg('circle', { cx: W / 2, cy, r: R - 3, fill: 'none', stroke: ink, 'stroke-width': 0.6 }, g);
      const s = ((R - 5) * 2) / 60;
      svg('path', { d: ART[d.art] || ART.giant, fill: ink, 'fill-rule': 'evenodd', transform: `translate(${(W / 2 - 30 * s).toFixed(2)} ${(cy - 30 * s).toFixed(2)}) scale(${s.toFixed(3)})` }, g);
    }
    // name banner
    svg('path', { d: `M10 ${bnY - 9} H${W - 10} L${W - 14} ${bnY} L${W - 10} ${bnY + 9} H10 L14 ${bnY} Z`, fill: ink }, g);
    label(g, W / 2, bnY, name, { size: ns, fill: d.color, font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
    formKit.tzBadge(g, W / 2, H - 8, ink, 3.6);
    const theme = { toggleTitles: false, text: ink, knob: d.knob || 'mxr', labelSize: 5.8, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 800, labelLs: 0.5 };
    togTitles(g, L, ink);
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: topJacks(d, W, ctx.flip) };
  });

  const MH = (o) => def(Object.assign({ form: 'mojohand', brand: 'Mojo Hand FX', cost: 0.7 }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff3b2f' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const muffV = { clip: 'muff', stages: 2, stage2Db: 18, preHp: 80, gainMinDb: 20, gainMaxDb: 52, tone: 'blend', blendLp: 450, blendHp: 1100, postLp: 9000, levelMaxDb: -3 };

  tz.addDefs([
    MH({
      id: 'mh.colossus', name: 'Titan Fuzz', ref: 'Mojo Hand FX Colossus', logo: 'TITAN', cat: 'Fuzz', typeName: 'Muff-style fuzz',
      color: '#e2a62a', art: 'giant',
      algo: 'drive', opts: Object.assign({}, muffV, { modes: [{}, { preEq: [{ type: 'peak', f: 800, q: 0.8, db: 5 }] }] }),
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'SUSTAIN', { def: 0.6 }), TOG('mode', 'MIDS', ['SCOOP', 'FLAT'])],
      desc: 'Huge, sustaining fuzz in the ram\'s head tradition, with a switch to fill in the mids.',
    }),
    MH({
      id: 'mh.ironbell', name: 'Steel Bell Fuzz', ref: 'Mojo Hand FX Iron Bell', logo: 'STEEL BELL', cat: 'Fuzz', typeName: 'Dark fuzz',
      color: '#5e7f8f', text: '#101418', art: 'bell',
      algo: 'drive', opts: Object.assign({}, muffV, { blendLp: 380, blendHp: 900, postLp: 6500, modes: [{}, { stages: 3, stage2Db: 12, gainMaxDb: 56 }] }),
      controls: [k('level', 'VOLUME'), k('tone', 'TONE', { def: 0.4 }), k('gain', 'FUZZ', { def: 0.6 }), TOG('mode', 'GAIN', ['LO', 'HI'])],
      desc: 'Dark, thick fuzz with a gain switch for even more saturation.',
    }),
    MH({
      id: 'mh.rook', name: 'Castle Distortion', ref: 'Mojo Hand FX Rook', logo: 'CASTLE', cat: 'Distortion', typeName: 'Rodent-style distortion',
      color: '#c9cdd2', art: 'rook',
      algo: 'drive', opts: { clip: 'si', preHp: 60, gainMinDb: 6, gainMaxDb: 56, tone: 'rat', postLp: 9000, levelMaxDb: -3, slew: 0.35, modes: [{}, { clip: 'led', gainMaxDb: 52 }, { clip: 'ge', bias: 0.2 }] },
      controls: [k('level', 'VOLUME'), k('tone', 'FILTER', { def: 0.4 }), k('gain', 'DISTORTION', { def: 0.5 }), TOG('mode', 'CLIP', ['SI', 'LED', 'GE'])],
      desc: 'Classic rodent distortion with a three-way clipping switch.',
    }),
  ]);
}
