// Built-in Tone Zone plugin: Morley.
// Blocks inspired by Morley pedals. Names, logos and artwork are Tone Zone originals; control layouts and colours
// follow the real units (see each block's `ref`).

// Treadle enclosure with an optional side pod for knobs / switches (same layout as the Dunlop plugin's).
function treadleForm(tz) {
  const { svg, label, formKit, shade } = tz.gfx;
  return (ctx, def) => {
    const g = ctx.g;
    const w = def.tw || 152, h = def.th || 304;
    const pn = def.panel || null;
    const P = pn ? pn.w || 48 : 0;
    const col = def.color || '#1a1a1c';
    const py = pn ? pn.y ?? 40 : 0, ph = pn ? pn.h ?? h - 80 : 0;
    if (pn) {
      const pg = svg('g', { transform: `translate(${w - 18},${py})` }, g);
      formKit.body(pg, P + 18, ph, pn.color || shade(col, -0.1), { rx: 9 });
      if (pn.title) label(pg, 18 + P / 2, 12, pn.title, { size: 5.2, fill: def.text || '#d8d8d8', weight: 800, ls: 1 });
    }
    formKit.body(g, w, h, col, { rx: def.rx || 14, brushed: !!def.brushed });
    if (def.art) def.art(g, w, h, tz);
    svg('rect', { x: 6, y: h - 34, width: w - 12, height: 26, rx: 6, fill: '#0c0c0d', opacity: 0.6 }, g);
    const theme = { text: def.text || '#d8d8d8', knob: def.knob || 'mxr', labelSize: 5.8 };
    def.controls.forEach((c) => {
      if (c.t === 'treadle' && c.x === undefined)
        Object.assign(c, { x: w / 2, y: h / 2 - 12, w: w - 30, h: h - 66, color: def.treadleColor || '#161618', logo: def.logo, logoColor: def.logoColor, logoFont: def.logoFont, logoSize: def.logoSize });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 21, r: 2.6 });
    });
    const pc = def.controls.filter((c) => c.panel && c.x === undefined);
    const gap = pn && pn.gap ? pn.gap : pc.length > 1 ? Math.min(52, (ph - 46) / (pc.length - 0.4)) : 0;
    pc.forEach((c, i) => {
      c.x = w + P / 2;
      c.y = py + (pn.top ?? (pn.title ? 50 : 36)) + i * gap;
      if (c.t === 'knob' || c.t === 'sel') { c.r = c.r || 9.5; c.labelPos = c.labelPos || (c.t === 'sel' ? 'below' : 'above'); }
      if (c.t === 'toggle') c.orient = c.orient || 'h';
      if (c.t === 'foot') { c.style = c.style || 'stomp'; c.r = c.r || 10; }
      if (c.t === 'screen') { c.w = c.w || P - 8; c.h = c.h || 14; }
    });
    label(g, 24, h - 21, def.code, { size: 6, fill: theme.text, weight: 800, ls: 1, anchor: 'start' });
    formKit.tzBadge(g, w - 24, h - 21, theme.text, 4.2).setAttribute('text-anchor', 'end');
    formKit.placeControls(ctx, def.controls, theme);
    const W = w + P;
    return { w: W, h, theme, jacks: formKit.jacksSide(def, W, { y0: def.jackY ?? h - 96, gap: 24, flip: ctx.flip }) };
  };
}

export default function register(tz) {
  const { K, TOG, FOOT, LED, TREADLE, def, db } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  tz.addForm('mo-treadle', treadleForm(tz));

  // A/B/Y box: logo on top, A/B indicator lever, two footswitches with LEDs
  tz.addForm('mo-aby', (ctx, d) => {
    const g = ctx.g, w = 150, h = 176;
    formKit.body(g, w, h, d.color, { rx: 8 });
    svg('rect', { x: 0, y: 0, width: w, height: 34, rx: 8, fill: '#000', opacity: 0.25 }, g);
    const txt = d.text || '#f2f2f2';
    label(g, w / 2, 18, d.logo, { size: 14, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 2 });
    label(g, w / 2, 46, d.typeName.toUpperCase(), { size: 5.2, fill: txt, weight: 700, ls: 1.4, opacity: 0.75 });
    const theme = { text: txt, knob: 'mxr', labelSize: 6 };
    d.controls.forEach((c) => {
      if (c.t === 'toggle') Object.assign(c, { x: w / 2, y: 74, orient: 'h' });
      if (c.t === 'knob') Object.assign(c, { x: c.p === 'level' ? 28 : w - 28, y: 74, r: 9, labelPos: 'below' });
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: c.p === 'ab' ? 44 : w - 44, y: 136, r: 12 });
      if (c.t === 'led') Object.assign(c, { x: c.bind === 'param:ab' ? 44 : w - 44, y: 108, r: 2.8 });
    });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 70, gap: 28, flip: ctx.flip }) };
  });

  // purple pinstripes down both sides of the base
  const horse = (g, w, h) => {
    for (const x of [7, w - 7]) svg('path', { d: `M${x} 26 V${h - 44}`, stroke: '#9b78e8', 'stroke-width': 1.6, opacity: 0.7 }, g);
    for (const x of [10.5, w - 10.5]) svg('path', { d: `M${x} 40 V${h - 58}`, stroke: '#9b78e8', 'stroke-width': 0.7, opacity: 0.5 }, g);
  };
  const MO = (o) => def(Object.assign({ brand: 'Morley', form: 'mo-treadle', logoFont: "'Oswald', sans-serif", text: '#e8e8e8' }, o));
  tz.addDefs([
    MO({
      id: 'mo.badhorsie', name: 'Rad Horsey Wah', ref: 'Morley Bad Horsie 2 (switchless)', code: 'RH-2', cat: 'Wah', color: '#141416', treadleColor: '#1a1a1d', logo: 'RAD HORSEY', logoColor: '#b998ff', logoSize: 16,
      art: horse, tw: 160, th: 312,
      algo: 'chain', alwaysOn: true, noBypassClick: true,
      opts: { chain: [{ prefix: 'w', algo: 'wah', opts: { fLo: 320, fHi: 2500, q: 5.8, mode: 0 } }] },
      panel: { w: 44, y: 150, h: 130 },
      controls: [TREADLE('w.pos', { def: 0 }),
        K('w.range', 'CONTOUR', { panel: true, def: 0.5, r: 8 }), K('w.level', 'LEVEL', { panel: true, def: 0.5, r: 8 })],
      derive: (p) => ({ 'w.on': (p['w.pos'] ?? 0) > 0.03 ? 1 : 0 }),
      desc: 'Switchless wah: it switches itself on as soon as you rock the treadle forward and off again when you return it fully to the heel.',
    }),
    MO({
      id: 'mo.2020vol', name: 'Twenty-Twenty Volume', ref: 'Morley 20/20 Volume Plus', code: '20·20 VOL', cat: 'Volume', color: '#18181a', treadleColor: '#202024', logo: 'TWENTY·TWENTY', logoColor: '#d9d9d9', logoSize: 14,
      algo: 'volume', noBypassClick: true, stereo: 'both', fixed: { taper: 1 },
      panel: { w: 42, y: 150, h: 130 },
      controls: [TREADLE('pos', { def: 1 }), K('min', 'MIN VOL', { panel: true, def: 0, r: 8 })],
      desc: 'Optical-style volume pedal with a minimum-volume knob.',
    }),
    def({
      id: 'mo.aby', name: 'A/B/Y Chooser', ref: 'Morley ABY Selector / Combiner', brand: 'Morley', code: 'ABY', logo: 'A / B / Y', typeName: 'Selector · combiner', cat: 'Utility', kind: 'Utility', form: 'mo-aby',
      color: '#2a4f9a', algo: 'utility', opts: { kind: 'split' }, alwaysOn: true, noBypassClick: true, cost: 0.05,
      ports: { ins: ['INPUT'], outs: ['A', 'B'] },
      controls: [TOG('ab', '', ['A', 'B'], { def: 0 }), K('level', 'LEVEL A', { min: -24, max: 12, def: 0, display: db }), K('levelB', 'LEVEL B', { min: -24, max: 12, def: 0, display: db }),
        FOOT({ action: 'param', p: 'ab', label: 'A / B' }), FOOT({ action: 'param', p: 'y', label: 'Y (A+B)' }), LED({ bind: 'param:ab', color: '#ff2a1a' }), LED({ bind: 'param:y', color: '#3ddc84' })],
      derive: (p) => ({ select: p.y ? 2 : p.ab ? 1 : 0 }),
      desc: 'Send your guitar to amp A, amp B or both. Left switch flips A ↔ B (red LED = B), right switch turns on Y (both outputs, green LED).',
    }),
  ]);
}
