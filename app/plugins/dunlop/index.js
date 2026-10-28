// Built-in Tone Zone plugin: Dunlop.
// Blocks inspired by Dunlop gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.

// Treadle enclosure with an optional side pod for knobs / switches (wahs, volume pedals, vibe controllers).
// def: tw / th (size), panel: { w, y, h, title } (side pod on the input side), art(g, w, h, tz) for printed artwork.
// Controls flagged `panel: true` are stacked down the pod; everything else uses explicit x / y.
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
    });
    label(g, 24, h - 21, def.code, { size: 6, fill: theme.text, weight: 800, ls: 1, anchor: 'start' });
    formKit.tzBadge(g, w - 24, h - 21, theme.text, 4.2).setAttribute('text-anchor', 'end');
    formKit.placeControls(ctx, def.controls, theme);
    const W = w + P;
    return { w: W, h, theme, jacks: formKit.jacksSide(def, W, { y0: def.jackY ?? h - 96, gap: 24, flip: ctx.flip }) };
  };
}

export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { mxr } = tz.builders;
  const { svg, label, formKit } = tz.gfx;

  tz.addForm('dn-treadle', treadleForm(tz));

  // round "smiley" fuzz enclosure: two knobs as eyes, logo, footswitch as the mouth
  tz.addForm('dn-round', (ctx, d) => {
    const g = ctx.g, w = 176, h = 176, cx = w / 2, cy = h / 2, R = 86;
    tz.gfx.softShadow(g, { w, h, rx: R, dy: 12, blur: 9, opacity: 0.6 });
    svg('circle', { cx, cy, r: R + 2, fill: '#1a1a1a' }, g); // rubber base ring
    svg('circle', { cx, cy, r: R, fill: d.color }, g);
    svg('circle', { cx, cy, r: R, fill: 'url(#p-grain)' }, g);
    svg('circle', { cx, cy, r: R, fill: 'url(#g-shadeV)' }, g);
    svg('circle', { cx, cy, r: R - 1, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.25, 'stroke-width': 1.4 }, g);
    svg('circle', { cx, cy, r: R - 9, fill: 'none', stroke: d.text || '#fff', 'stroke-opacity': 0.7, 'stroke-width': 0.9 }, g);
    // printed ring of dots
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      svg('circle', { cx: cx + Math.cos(a) * (R - 5), cy: cy + Math.sin(a) * (R - 5), r: 0.7, fill: d.text || '#fff', opacity: 0.55 }, g);
    }
    const txt = d.text || '#fff';
    label(g, cx, cy + 6, d.logo, { size: 21, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.5 });
    if (d.tagline) label(g, cx, cy + 22, d.tagline, { size: 9, fill: txt, font: "'Dancing Script', cursive", weight: 700 });
    formKit.tzBadge(g, cx, h - 26, txt, 4);
    const theme = { text: txt, knob: d.knob || 'chicken', labelSize: 6.4 };
    const knobs = d.controls.filter((c) => c.t === 'knob');
    knobs.forEach((k, i) => Object.assign(k, { x: cx + (i ? 30 : -30), y: 46, r: 12, labelPos: 'above' }));
    d.controls.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: cx, y: 132, r: 12 });
      if (c.t === 'led') Object.assign(c, { x: cx, y: 22, r: 2.4 });
    });
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: cy, gap: 26, flip: ctx.flip }) };
  });

  const wahFoot = { form: 'dn-treadle', cat: 'Wah', brand: 'Dunlop', toeSwitch: true, desc: 'Drag the treadle (heel ↔ toe). Click the treadle without dragging to click the toe switch on/off.' };
  tz.addDefs([
    def({
      id: 'dn.gcb95', name: 'Weep Baby Wah', ref: 'Dunlop Cry Baby GCB95', brand: 'Dunlop', code: 'WB-95', cat: 'Wah', form: 'treadle', color: '#121214',
      algo: 'wah', opts: { fLo: 350, fHi: 2200, q: 5.2, mode: 0 },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 })],
      logo: 'Weep Baby', logoColor: '#d8d8d8', toeSwitch: true,
      desc: 'Drag the treadle (heel ↔ toe). Click the treadle without dragging to click the toe switch on/off.',
    }),
    def(Object.assign({}, wahFoot, {
      id: 'dn.535q', name: 'Weep Baby Multi-Wah', ref: 'Dunlop Cry Baby 535Q Multi-Wah', code: '535-M', color: '#141416', logo: 'Weep Baby', logoColor: '#d8d8d8',
      algo: 'wah', opts: { fLo: 330, fHi: 2300, q: 5, mode: 0 },
      panel: { w: 54, y: 34, h: 236, title: 'MULTI-WAH' },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 }),
        SEL('range', 'RANGE', ['1', '2', '3', '4', '5', '6'], { panel: true, values: [0, 0.2, 0.4, 0.6, 0.8, 1], def: 3, sweep: 200, optSize: 5, labelRadius: 6.5 }),
        K('q', 'Q', { panel: true, def: 0.5 }),
        K('boost', 'VOLUME', { panel: true, def: 0.4, virtual: true }),
        TOG('bst', 'BOOST', ['OFF', 'ON'], { panel: true, def: 0 })],
      derive: (p) => ({ level: 0.5 + (p.bst ? 0.5 * (p.boost ?? 0.4) : 0) }),
      desc: 'Side controls: 6-position frequency RANGE, Q (bandwidth) and a switchable volume BOOST of up to +15 dB. Click the treadle to toggle the effect.',
    })),
    def(Object.assign({}, wahFoot, {
      id: 'dn.cbm95', name: 'Weep Baby Mini', ref: 'Dunlop Cry Baby Mini CBM95', code: 'WB-MINI', color: '#121214', logo: 'Weep Baby', logoColor: '#d8d8d8', logoSize: 11,
      tw: 112, th: 214, rx: 11, jackY: 118,
      algo: 'wah', opts: { fLo: 360, fHi: 2250, q: 5.2, mode: 0 },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2 }),
        TOG('voice', '', ['LO', 'GCB', 'HI'], { values: [0.25, 0.5, 0.75], def: 1, x: 56, y: 162, orient: 'h', optSize: 4.4 })],
      fixed: {}, derive: (p) => ({ range: [0.25, 0.5, 0.75][p.voice ?? 1] }),
      desc: 'Half-size wah with the 3-way voicing switch (low / classic / high) brought out on top.',
    })),
    def(Object.assign({}, wahFoot, {
      id: 'dn.jc95', name: 'Rooster Wah', ref: 'Dunlop Jerry Cantrell Cry Baby JC95', code: 'RW-95', color: '#2a2b2e', treadleColor: '#1b1c1e', logo: 'Rooster', logoColor: '#c9a35a', logoFont: "'Oswald', sans-serif", logoSize: 18,
      algo: 'wah', opts: { fLo: 290, fHi: 1750, q: 5.8, mode: 0 },
      art: (g, w, h) => {
        // etched rooster-feather lines along the sides
        for (let i = 0; i < 9; i++) {
          const y = 40 + i * 24;
          svg('path', { d: `M5 ${y} q 4 8 0 16`, stroke: '#c9a35a', 'stroke-width': 0.8, fill: 'none', opacity: 0.45 }, g);
          svg('path', { d: `M${w - 5} ${y} q -4 8 0 16`, stroke: '#c9a35a', 'stroke-width': 0.8, fill: 'none', opacity: 0.45 }, g);
        }
      },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 })],
      desc: 'Signature wah with a narrower, darker sweep (Fasel inductor, custom Q) – great for slow, vocal sweeps.',
    })),
    def(Object.assign({}, wahFoot, {
      id: 'dn.sw95', name: 'Top Hat Wah', ref: 'Dunlop Slash Cry Baby SW95', code: 'TH-95', color: '#151515', treadleColor: '#141414', logo: 'Top Hat', logoColor: '#d7b46a', logoFont: "'Oswald', sans-serif",
      text: '#e6d3a3',
      art: (g, w) => { svg('rect', { x: 8, y: 8, width: w - 16, height: 6, rx: 3, fill: '#8a1c1c', opacity: 0.85 }, g); },
      algo: 'chain', cost: 1,
      opts: { chain: [
        { prefix: 'w', algo: 'wah', opts: { fLo: 330, fHi: 2100, q: 6, mode: 0 } },
        { prefix: 'd', algo: 'drive', on: false, opts: { clip: 'asym', bias: 0.15, preHp: 90, gainMinDb: 8, gainMaxDb: 38, tone: 'none', postLp: 6200, levelMaxDb: 6 } },
      ] },
      panel: { w: 50, y: 52, h: 210, title: 'DISTORTION' },
      controls: [TREADLE('w.pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 }),
        K('d.level', 'VOLUME', { panel: true, def: 0.5 }), K('d.gain', 'GAIN', { panel: true, def: 0.55 }),
        LED({ panel: true, bind: 'param:d.on', color: '#ff2a1a', r: 2.4 }),
        FOOT({ panel: true, action: 'param', p: 'd.on', label: 'DIST' })],
      desc: 'Wah with a built-in distortion booster: the side footswitch turns the distortion on and off. The toe switch bypasses the whole pedal.',
    })),
    def(Object.assign({}, wahFoot, {
      id: 'dn.uv1sc', name: 'Uni-Swirl', ref: 'Dunlop Uni-Vibe UV1SC', code: 'US-1', cat: 'Modulation', color: '#121212', treadleColor: '#18181a', logo: 'Uni-Swirl', logoColor: '#d9c08a', logoFont: "'Oswald', sans-serif",
      text: '#e2d6b8', toeSwitch: true,
      algo: 'vibe', panel: { w: 52, y: 40, h: 222, title: 'CONTROL' },
      controls: [TREADLE('speed', { def: 0.4 }), LED({ color: '#ffb020', r: 2.2 }),
        K('level', 'VOLUME', { panel: true, def: 0.5, style: 'chicken' }), K('intensity', 'INTENSITY', { panel: true, def: 0.7, style: 'chicken' }),
        TOG('mode', '', ['CHO', 'VIB'], { panel: true })],
      desc: 'Photocell vibe: the treadle sets the speed (heel slow, toe fast) like the original foot controller. Click the treadle to bypass.',
    })),
    def({
      id: 'dn.dvp3', name: 'Volume XL', ref: 'Dunlop DVP3 Volume (X)', brand: 'Dunlop', code: 'VX-3', cat: 'Volume', form: 'dn-treadle', color: '#17181a', treadleColor: '#121314',
      logo: 'VOLUME', logoFont: "'Oswald', sans-serif", logoColor: '#bfc3c9', algo: 'volume', fixed: { taper: 1 }, noBypassClick: true,
      panel: { w: 42, y: 150, h: 120 },
      controls: [TREADLE('pos', { def: 1 }), K('min', 'MIN VOL', { panel: true, def: 0, r: 8 })],
      desc: 'Volume pedal with a minimum-volume knob (sets the heel-down level).',
    }),
    def({
      id: 'dn.jhf1', name: 'Fuzzy Face JF', ref: 'Dunlop Fuzz Face JHF1 (Jimi Hendrix)', brand: 'Dunlop', code: 'JF-1', cat: 'Fuzz', form: 'dn-round', color: '#c4121c', text: '#ffffff', knob: 'chicken',
      logo: 'FUZZY FACE', tagline: 'Experience Series',
      algo: 'drive', opts: { clip: 'si', bias: 0.25, preHp: 70, gainMinDb: 12, gainMaxDb: 46, tone: 'none', postLp: 5400, levelMaxDb: 0, outTrim: 0.4 },
      controls: [K('level', 'VOLUME', { def: 0.55 }), K('gain', 'FUZZ', { def: 0.7 }), FOOT()],
      desc: 'Silicon Fuzz Face in the classic round enclosure. Roll your guitar volume back for clean-up.',
    }),
    mxr({
      id: 'dn.jhoc1', name: 'Octavius Fuzz', ref: 'Dunlop JHOC1 Octavio Fuzz', brand: 'Dunlop', code: 'OF-1', logo: 'OCTAVIUS', logoFont: "'Oswald', sans-serif", logoSize: 20,
      cat: 'Fuzz', color: '#aeb3b9', text: '#151515', led: '#ff2a1a',
      algo: 'chain', cost: 1.1,
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', preHp: 120, gainMinDb: 16, gainMaxDb: 44, tone: 'none', postLp: 6500, levelMaxDb: 0 } },
        { prefix: 'o', algo: 'pitch', params: { semis1: 12, level1: 0.7, dry: 0.8, quality: 0, tone: 0.8 } },
      ] },
      controls: [K('f.level', 'VOLUME', { def: 0.5 }), K('f.gain', 'FUZZ', { def: 0.7 })],
      fixed: { 'o.semis1': 12, 'o.quality': 0 },
      desc: 'Octave-up fuzz: play above the 12th fret for the ringing upper octave.',
    }),
  ]);
}
