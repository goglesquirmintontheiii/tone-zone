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
    const mini = !!d.mini, g = ctx.g, w = mini ? 140 : 176, h = w, cx = w / 2, cy = h / 2, R = w / 2 - 2;
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
    label(g, cx, cy + (mini ? 4 : 6), d.logo, { size: mini ? 15 : 21, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.5 });
    if (d.tagline) label(g, cx, cy + (mini ? 16 : 22), d.tagline, { size: mini ? 7.5 : 9, fill: txt, font: "'Dancing Script', cursive", weight: 700 });
    formKit.tzBadge(g, cx, h - (mini ? 20 : 26), txt, mini ? 3.4 : 4);
    const theme = { text: txt, knob: d.knob || 'chicken', labelSize: 6.4 };
    const knobs = d.controls.filter((c) => c.t === 'knob');
    knobs.forEach((k, i) => Object.assign(k, mini ? { x: cx + (i ? 24 : -24), y: 38, r: 10, labelPos: 'above' } : { x: cx + (i ? 30 : -30), y: 46, r: 12, labelPos: 'above' }));
    d.controls.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, mini ? { style: 'stomp', x: cx, y: 104, r: 10 } : { style: 'stomp', x: cx, y: 132, r: 12 });
      if (c.t === 'led') Object.assign(c, { x: cx, y: mini ? 17 : 22, r: 2.4 });
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

  // ---- v0.4 additions
  // four knobs in a 2 x 2 grid that leaves room for the logo
  const quad = (list) => list.map((k, i) => Object.assign(k, { x: i % 2 ? 92 : 36, y: i < 2 ? 30 : 68, r: 10 }));
  const wah = (o) => def(Object.assign({}, wahFoot, { algo: 'wah', fixed: { level: 0.36 }, controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 }), ...(o.extra || [])] }, o));
  tz.addDefs([
    wah({
      id: 'dn.95q', name: 'Weep Baby 95-Q', ref: 'Dunlop Cry Baby 95Q', code: 'WB-95Q', color: '#141416', logo: 'Weep Baby', logoColor: '#d8d8d8',
      opts: { fLo: 340, fHi: 2200, q: 5.2, mode: 0 },
      panel: { w: 48, y: 60, h: 200, title: '95-Q' },
      extra: [K('q', 'Q', { panel: true, def: 0.5 }), K('boost', 'VOLUME', { panel: true, def: 0, virtual: true })],
      derive: (p) => ({ level: 0.36 + 0.4 * (p.boost ?? 0) }),
      desc: 'Wah with a Q knob for a narrow or wide sweep and a volume boost of up to +10 dB.',
    }),
    wah({
      id: 'dn.gcb95f', name: 'Weep Baby Classic', ref: 'Dunlop Cry Baby Classic GCB95F', code: 'WB-95F', color: '#101012', treadleColor: '#141416', logo: 'Weep Baby', logoColor: '#cfcfcf', logoFont: "'Oswald', sans-serif",
      opts: { fLo: 380, fHi: 2100, q: 5.6, mode: 0 },
      desc: 'Wah with the classic red Fasel-style inductor: smooth, throaty and a little more vocal than the standard model.',
    }),
    wah({
      id: 'dn.105q', name: 'Weep Baby Bass', ref: 'Dunlop Cry Baby Bass Wah 105Q', code: 'WB-105Q', color: '#141416', logo: 'Weep Baby', logoColor: '#d8d8d8',
      opts: { fLo: 180, fHi: 1400, q: 4.6, mode: 0 },
      panel: { w: 48, y: 60, h: 200, title: 'BASS' },
      extra: [K('q', 'Q', { panel: true, def: 0.45 }), K('boost', 'VOLUME', { panel: true, def: 0, virtual: true })],
      derive: (p) => ({ level: 0.36 + 0.4 * (p.boost ?? 0) }),
      desc: 'Wah voiced for bass: a lower sweep, a Q knob and a volume boost.',
    }),
    wah({
      id: 'dn.cbm535q', name: 'Weep Baby Mini Multi', ref: 'Dunlop Cry Baby Mini 535Q', code: 'M535', color: '#121214', logo: 'Weep Baby', logoColor: '#d8d8d8', logoSize: 11,
      tw: 112, th: 214, rx: 11, jackY: 118,
      opts: { fLo: 330, fHi: 2300, q: 5, mode: 0 },
      panel: { w: 60, y: 14, h: 186, top: 34 },
      extra: [SEL('range', 'RANGE', ['1', '2', '3', '4', '5', '6'], { panel: true, values: [0, 0.2, 0.4, 0.6, 0.8, 1], def: 3, sweep: 200, optSize: 4.4, labelRadius: 6, r: 8.5 }),
        K('q', 'Q', { panel: true, def: 0.5, r: 8.5 }), K('boost', 'BOOST', { panel: true, def: 0, virtual: true, r: 8.5 })],
      derive: (p) => ({ level: 0.36 + 0.45 * (p.boost ?? 0) }),
      desc: 'Half-size multi-wah: six frequency ranges, Q and a volume boost.',
    }),
    wah({
      id: 'dn.kh95', name: 'Thrash Wah', ref: 'Dunlop Kirk Hammett Cry Baby KH95', code: 'TW-95', color: '#121212', treadleColor: '#161616', logo: 'Thrash', logoColor: '#b8bcc2', logoFont: "'Oswald', sans-serif", logoSize: 18,
      opts: { fLo: 420, fHi: 2500, q: 6.2, mode: 0 },
      art: (g, w, h) => { for (const x of [10, w - 10]) svg('path', { d: `M${x} 30 V${h - 50}`, stroke: '#8a8f96', 'stroke-width': 1.2, opacity: 0.5 }, g); },
      desc: 'Signature wah with a brighter, more aggressive sweep made for high-gain solos.',
    }),
    wah({
      id: 'dn.db01', name: 'Weep Baby From Below', ref: 'Dunlop Dimebag Cry Baby From Hell DB01', code: 'WB-666', color: '#1a1a1a', treadleColor: '#202020', logo: 'From Below', logoColor: '#9fd14a', logoFont: "'Oswald', sans-serif", logoSize: 15,
      text: '#c9e6a0',
      opts: { fLo: 300, fHi: 2500, q: 5.5, mode: 0 },
      art: (g, w) => { svg('path', { d: `M14 18 L${w / 2} 30 L${w - 14} 18`, stroke: '#9fd14a', 'stroke-width': 1.4, fill: 'none', opacity: 0.7 }, g); },
      panel: { w: 50, y: 40, h: 230, title: 'FROM BELOW' },
      extra: [SEL('range', 'RANGE', ['1', '2', '3', '4', '5', '6'], { panel: true, values: [0, 0.2, 0.4, 0.6, 0.8, 1], def: 3, sweep: 200, optSize: 4.6, labelRadius: 6.5 }),
        K('q', 'Q', { panel: true, def: 0.55 }), K('boost', 'VOLUME', { panel: true, def: 0.4, virtual: true }), TOG('bst', 'BOOST', ['OFF', 'ON'], { panel: true, def: 0, virtual: true })],
      derive: (p) => ({ level: 0.36 + (p.bst ? 0.5 * (p.boost ?? 0.4) : 0) }),
      desc: 'Signature multi-wah: six ranges, Q, and a switchable volume boost.',
    }),
    def({
      id: 'dn.jd4s', name: 'Rotoswirl', ref: 'Dunlop Rotovibe JD-4S', brand: 'Dunlop', code: 'RS-4S', cat: 'Modulation', form: 'dn-treadle', color: '#a9adb3', treadleColor: '#1a1a1c', brushed: true,
      logo: 'ROTOSWIRL', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', text: '#e6e6e6', toeSwitch: true,
      algo: 'vibe', panel: { w: 48, y: 60, h: 200, title: 'ROTO', color: '#1d1e20' },
      controls: [TREADLE('speed', { def: 0.4 }), LED({ color: '#ff2a1a', r: 2.2 }),
        K('level', 'VOLUME', { panel: true, def: 0.5 }), TOG('mode', '', ['CHO', 'VIB'], { panel: true })],
      fixed: { intensity: 0.75 },
      desc: 'Rotating-speaker style vibe: the treadle sets the speed. Click the treadle to bypass.',
    }),
    def({
      id: 'dn.dvp4', name: 'Volume XL Mini', ref: 'Dunlop DVP4 Volume (X) Mini', brand: 'Dunlop', code: 'VX-4', cat: 'Volume', form: 'dn-treadle', color: '#17181a', treadleColor: '#121314',
      tw: 112, th: 214, rx: 11, jackY: 118,
      logo: 'VOLUME', logoFont: "'Oswald', sans-serif", logoColor: '#bfc3c9', logoSize: 12, algo: 'volume', fixed: { taper: 1, min: 0 }, noBypassClick: true,
      ctrl: { outs: [{ label: 'EXP OUT', source: 'param:pos' }] },
      controls: [TREADLE('pos', { def: 1 })],
      desc: 'Mini volume pedal. The EXP OUT jack sends the treadle position to another pedal.',
    }),
    def({
      id: 'dn.dvp1', name: 'Volume Big', ref: 'Dunlop DVP1 Volume Pedal', brand: 'Dunlop', code: 'VB-1', cat: 'Volume', form: 'dn-treadle', color: '#1a1a1c', treadleColor: '#141416', tw: 160, th: 312,
      logo: 'VOLUME', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', algo: 'volume', fixed: { taper: 1, min: 0 }, noBypassClick: true,
      controls: [TREADLE('pos', { def: 1 })],
      desc: 'Large, smooth volume pedal.',
    }),
    def({
      id: 'dn.ffm1', name: 'Fuzzy Face Mini Si', ref: 'Dunlop Fuzz Face Mini Silicon FFM1', brand: 'Dunlop', code: 'FFM-1', cat: 'Fuzz', form: 'dn-round', mini: true, color: '#2a6fc4', text: '#ffffff', knob: 'chicken',
      logo: 'FUZZY FACE', tagline: 'Silicon',
      algo: 'drive', opts: { clip: 'si', bias: 0.25, preHp: 70, gainMinDb: 12, gainMaxDb: 46, tone: 'none', postLp: 5400, levelMaxDb: 0, outTrim: 0.4 },
      controls: [K('level', 'VOLUME', { def: 0.55 }), K('gain', 'FUZZ', { def: 0.7 }), FOOT()],
      desc: 'Bright, aggressive silicon fuzz in a small round box.',
    }),
    def({
      id: 'dn.ffm2', name: 'Fuzzy Face Mini Ge', ref: 'Dunlop Fuzz Face Mini Germanium FFM2', brand: 'Dunlop', code: 'FFM-2', cat: 'Fuzz', form: 'dn-round', mini: true, color: '#c41a22', text: '#ffffff', knob: 'chicken',
      logo: 'FUZZY FACE', tagline: 'Germanium',
      algo: 'drive', opts: { clip: 'ge', bias: 0.35, preHp: 60, gainMinDb: 10, gainMaxDb: 40, tone: 'none', postLp: 4800, levelMaxDb: 0, outTrim: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.55 }), K('gain', 'FUZZ', { def: 0.7 }), FOOT()],
      desc: 'Warm, round germanium fuzz that cleans up when you roll back the guitar volume.',
    }),
    mxr({
      id: 'dn.qz1', name: 'Weep Baby Fixed Zone', ref: 'Dunlop Cry Baby Q Zone QZ1', brand: 'Dunlop', code: 'QZ-1', logo: 'Fixed Zone', logoFont: "'Oswald', sans-serif", logoSize: 18,
      cat: 'Wah', color: '#151517', text: '#e6e6e6', led: '#ff2a1a',
      algo: 'wah', opts: { fLo: 300, fHi: 2400, q: 5.5, mode: 0 }, fixed: { mode: 0 },
      controls: quad([K('pos', 'SWEEP', { def: 0.55 }), K('q', 'Q', { def: 0.5 }), K('level', 'VOLUME', { def: 0.36 }), K('range', 'BASS', { def: 0.5 })]),
      desc: 'A wah parked at one spot: SWEEP picks the frequency, Q the peak, BASS shifts the range.',
    }),
    mxr({
      id: 'dn.ep103', name: 'Echo-Flex Delay', ref: 'Dunlop Echoplex Delay EP103', brand: 'Dunlop', code: 'EF-103', logo: 'ECHO-FLEX', logoFont: "'Oswald', sans-serif", logoSize: 19,
      cat: 'Delay', color: '#6c6f73', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'delay', opts: { maxMs: 1500 }, fixed: { mode: 2, heads: 4, tone: 0.42, modrate: 0.3 }, tapTarget: 'time',
      ctrl: { ins: [{ label: 'TAP', action: 'tap' }] },
      controls: quad([K('mix', 'VOLUME', { def: 0.4 }), K('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), K('time', 'DELAY', { min: 60, max: 1500, def: 380, display: ms }), K('age', 'AGE', { def: 0.3, virtual: true })]),
      derive: (p) => ({ age: p.age ?? 0.3, moddepth: 0.1 + 0.4 * (p.age ?? 0.3) }),
      desc: 'Tape echo voice with wow and flutter. AGE makes the repeats darker and wobblier. Plug a tap switch into the TAP jack.',
    }),
    mxr({
      id: 'dn.ep101', name: 'Echo-Flex Pre', ref: 'Dunlop Echoplex Preamp EP101', brand: 'Dunlop', code: 'EF-101', logo: 'ECHO-FLEX', logoFont: "'Oswald', sans-serif", logoSize: 19,
      cat: 'Boost', color: '#6c6f73', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'tube', preHp: 40, gainMinDb: 0, gainMaxDb: 20, tone: 'none', postLp: 12000, cleanSum: true, cleanMix: 0.7, levelMaxDb: 0, preEq: [{ type: 'hs', f: 3000, q: 0.7, db: 2 }] },
      fixed: { level: 0.9 },
      controls: [K('gain', 'VOLUME', { def: 0.35 })],
      desc: 'Preamp from a vintage tape echo: a fat, slightly bright boost.',
    }),
  ]);
}
