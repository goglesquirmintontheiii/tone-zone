// Built-in Tone Zone plugin: Joyo.
// Pedals inspired by Joyo gear: the classic JF series (painted boxes, knob row on top, name window) and the
// R series (black glossy control deck, big lower art panel). Names and artwork are Tone Zone originals; control
// layouts and colours follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ten, ms, db } = tz.helpers;
  const { svg, label, formKit, shade, luminance, textColorFor } = tz.gfx;

  const row = (list, x0, x1, y) => list.forEach((c, i) => {
    c.x = list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1);
    c.y = y;
  });

  // ---------------------------------------------------------------- JF series
  tz.addForm('joyo-jf', (ctx, d) => {
    const g = ctx.g, w = 132, h = 230;
    const col = d.color, txt = d.text || textColorFor(col), acc = d.accent || shade(col, luminance(col) > 0.5 ? -0.4 : 0.45);
    formKit.body(g, w, h, col, { rx: 8 });
    const knobs = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && (c.x === undefined || c._auto));
    const toggles = d.controls.filter((c) => c.t === 'toggle' && (c.x === undefined || c._auto));
    const two = knobs.length > 3;
    const top = two ? knobs.slice(0, 3) : knobs, bot = two ? knobs.slice(3) : [];
    top.forEach((c) => (c._auto = true));
    bot.forEach((c) => (c._auto = true));
    row(top, top.length === 1 ? w / 2 : 28, top.length === 1 ? w / 2 : w - 28, 30);
    row(bot, bot.length === 1 ? w / 2 : 28, bot.length === 1 ? w / 2 : w - 28, 68);
    knobs.forEach((c) => { c.r = two ? 10.5 : knobs.length === 1 ? 14 : 12.5; c.labelPos = 'below'; c.labelSize = 6; });
    const ty = two ? 98 : 72;
    toggles.forEach((t, i) => { t._auto = true; t.orient = 'h'; t.x = toggles.length === 1 ? w / 2 : 36 + i * (w - 72); t.y = ty; t.optSize = 4.6; });
    // name window: rounded plate with a bevel and a double rule
    const wy = two ? 112 : toggles.length ? 96 : 80, wh = 168 - wy;
    svg('rect', { x: 12, y: wy, width: w - 24, height: wh, rx: 10, fill: acc, 'fill-opacity': 0.9 }, g);
    svg('rect', { x: 15, y: wy + 3, width: w - 30, height: wh - 6, rx: 8, fill: 'none', stroke: txt, 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    svg('rect', { x: 12, y: wy, width: w - 24, height: wh * 0.45, rx: 10, fill: '#fff', 'fill-opacity': 0.08 }, g);
    const ink = d.windowText || textColorFor(acc);
    const logo = d.logo || d.name;
    label(g, w / 2, wy + wh * 0.42, logo, { size: d.logoSize || Math.min(15, 150 / Math.max(6, logo.length)), fill: ink, font: d.logoFont || "'Oswald', sans-serif", weight: 700, ls: 0.8 });
    label(g, w / 2, wy + wh * 0.42 + 13, (d.typeName || d.cat).toUpperCase(), { size: 5, fill: ink, weight: 700, ls: 1.4, opacity: 0.85 });
    label(g, w / 2, wy + wh - 8, d.code, { size: 5.4, fill: ink, weight: 800, ls: 2, opacity: 0.7 });
    formKit.tzBadge(g, w / 2, h - 8, txt, 4.2);
    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      if (c.t === 'foot') Object.assign(c, { _auto: true, style: 'stomp', x: w / 2, y: 196, r: 12.5 });
      else if (c.t === 'led') Object.assign(c, { _auto: true, x: w / 2, y: 176, r: 2.8 });
    }
    const theme = { text: txt, knob: d.knob || 'mxr', labelSize: 6, labelFont: "'Barlow Condensed', sans-serif", toggleTitles: false };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 182, gap: 24 }) };
  });

  // ---------------------------------------------------------------- R series
  tz.addForm('joyo-r', (ctx, d) => {
    const g = ctx.g, w = 140, h = 236;
    const col = d.color, txt = d.text || textColorFor(col), acc = d.accent || '#ffffff';
    formKit.body(g, w, h, col, { rx: 9 });
    const knobs = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && (c.x === undefined || c._auto));
    const toggles = d.controls.filter((c) => c.t === 'toggle' && (c.x === undefined || c._auto));
    const n = knobs.length;
    const rows = n > 4 ? [knobs.slice(0, 3), knobs.slice(3)] : n === 4 && !toggles.length ? [knobs.slice(0, 2), knobs.slice(2)] : [knobs];
    const hasSel = knobs.some((c) => c.t === 'sel');
    const gap = hasSel ? 50 : 42;
    const deckH = rows.length > 1 ? 62 + gap : toggles.length ? 84 : 70;
    // glossy black deck with a chamfered lower edge
    const dk = `M8 8 H${w - 8} V${deckH - 8} L${w - 16} ${deckH} H16 L8 ${deckH - 8} Z`;
    svg('path', { d: dk, fill: '#141416' }, g);
    svg('path', { d: dk, fill: 'none', stroke: acc, 'stroke-opacity': 0.5, 'stroke-width': 0.9 }, g);
    svg('path', { d: `M10 10 H${w - 10} V${deckH * 0.4} H10 Z`, fill: '#fff', 'fill-opacity': 0.06 }, g);
    rows.forEach((r, ri) => {
      r.forEach((c) => (c._auto = true));
      const m = r.length >= 4 ? 24 : r.length === 3 ? 30 : 42;
      row(r, r.length === 1 ? w / 2 : m, r.length === 1 ? w / 2 : w - m, 32 + ri * gap);
      r.forEach((c) => { c.r = c.t === 'sel' ? 9.5 : n > 3 ? 10 : 11.5; c.labelPos = 'below'; c.labelSize = 5.6; });
    });
    toggles.forEach((t, i) => { t._auto = true; t.orient = 'h'; t.x = toggles.length === 1 ? w / 2 : 40 + i * (w - 80); t.y = deckH - 16; t.optSize = 4.4; });
    if (rows.length === 1 && toggles.length) row(knobs, n === 1 ? w / 2 : n >= 4 ? 24 : 30, n === 1 ? w / 2 : w - (n >= 4 ? 24 : 30), 28);
    // lower art panel: diagonal speed stripes behind a slanted name
    const ay = deckH + 8;
    const cid = `joyo-r-${d.id.replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
    const cp = svg('clipPath', { id: cid }, g);
    svg('rect', { x: 8, y: ay, width: w - 16, height: 160 - ay, rx: 5 }, cp);
    const ag = svg('g', { 'clip-path': `url(#${cid})` }, g);
    svg('rect', { x: 8, y: ay, width: w - 16, height: 160 - ay, fill: shade(col, -0.25) }, ag);
    for (let i = 0; i < 7; i++) svg('path', { d: `M${-20 + i * 26} ${160} L${20 + i * 26} ${ay} h9 L${-11 + i * 26} ${160} Z`, fill: acc, 'fill-opacity': 0.08 + (i % 3) * 0.04 }, ag);
    const logo = d.logo || d.name;
    const t = label(g, w / 2, ay + (160 - ay) * 0.45, logo, { size: d.logoSize || Math.min(20, 190 / Math.max(5, logo.length)), fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1, italic: true });
    t.setAttribute('stroke', shade(col, -0.6)); t.setAttribute('stroke-width', 1.6); t.setAttribute('paint-order', 'stroke');
    label(g, w / 2, ay + (160 - ay) * 0.45 + 15, (d.typeName || d.cat).toUpperCase(), { size: 5.2, fill: txt, weight: 700, ls: 1.4 });
    label(g, 18, 170, d.code, { size: 6.4, fill: txt, weight: 800, ls: 1, anchor: 'start', italic: true });
    formKit.tzBadge(g, w / 2, h - 8, txt, 4.2);
    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      if (c.t === 'foot') Object.assign(c, { _auto: true, style: 'stomp', x: w / 2, y: 200, r: 13 });
      else if (c.t === 'led') Object.assign(c, { _auto: true, x: w - 20, y: 170, r: 2.8 });
    }
    const theme = { text: '#ececec', knob: d.knob || 'chrome', labelSize: 5.6, labelFont: "'Barlow Condensed', sans-serif", toggleTitles: false };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { text: txt }), jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: deckH + 20, gap: 26 }) };
  });

  const JF = (o) => def(Object.assign({ form: 'joyo-jf', brand: 'Joyo' }, o, { controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#ff2a1a' })] }));
  const JR = (o) => def(Object.assign({ form: 'joyo-r', brand: 'Joyo' }, o, { controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#3d8bff' })] }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));

  // amp-in-a-box preamps (JF-13 to JF-16): preamp voice, no speaker sim
  const AMPBOX = (o) => JF(Object.assign({ cat: 'Preamp', kind: 'Pedal', algo: 'amp', cost: 1.6, opts: { preamp: true, voice: o.voice } }, o));

  tz.addDefs([
    // ---------------------------------------------------------------- JF drives
    JF({
      id: 'joyo.jf01', name: 'Vintage Green Drive', ref: 'Joyo JF-01 Vintage Overdrive', code: 'J-01', logo: 'VINTAGE GREEN', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#5f9f45', text: '#f3fff0', accent: '#2e5a22',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 700, postLp: 4600, levelMaxDb: 6 },
      controls: [k('level', 'LEVEL'), k('tone', 'TONE'), k('gain', 'DRIVE', { def: 0.45 })],
      desc: 'Green mid-hump overdrive in the classic 808 style.',
    }),
    JF({
      id: 'joyo.jf02', name: 'Ultra Push Drive', ref: 'Joyo JF-02 Ultimate Drive', code: 'J-02', logo: 'ULTRA PUSH', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#e7b51f', text: '#231a02', accent: '#7a5a00',
      algo: 'drive', opts: { clip: 'mosfet', bias: 0.15, preHp: 60, gainMinDb: 4, gainMaxDb: 42, tone: 'lp', toneLo: 1200, toneHi: 9500, postLp: 8500, levelMaxDb: 4, outTrim: 0.6 },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'DRIVE', { def: 0.5 })],
      desc: 'Amp-like overdrive that goes from light grit to near distortion.',
    }),
    JF({
      id: 'joyo.jf03', name: 'Crunch Box Distortion', ref: 'Joyo JF-03 Crunch Distortion', code: 'J-03', logo: 'CRUNCH BOX', typeName: 'Distortion', cat: 'Distortion',
      color: '#d4421e', text: '#fff1ea', accent: '#5a1407',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 8, preHp: 80, gainMinDb: 6, gainMaxDb: 44, tone: 'lp', toneLo: 1300, toneHi: 9000, postLp: 8000, levelMaxDb: 4, outTrim: 0.5 },
      controls: [k('level', 'LEVEL'), k('tone', 'TONE'), k('gain', 'DIST', { def: 0.5 })],
      desc: 'British-style crunch distortion.',
    }),
    JF({
      id: 'joyo.jf04', name: 'Max Gain Distortion', ref: 'Joyo JF-04 High Gain Distortion', code: 'J-04', logo: 'MAX GAIN', typeName: 'High gain distortion', cat: 'Distortion',
      color: '#262628', text: '#f0f0f0', accent: '#b5161c',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 14, preHp: 100, gainMinDb: 12, gainMaxDb: 54, tone: 'lp', toneLo: 1200, toneHi: 8500, postLp: 7500, levelMaxDb: 2, outTrim: 0.4 },
      controls: [k('level', 'LEVEL'), k('tone', 'TONE'), k('gain', 'GAIN', { def: 0.55 })],
      desc: 'Saturated high-gain distortion for metal and hard rock.',
    }),
    // ---------------------------------------------------------------- JF modulation / delay / dynamics
    JF({
      id: 'joyo.jf05', name: 'Classic Swirl Chorus', ref: 'Joyo JF-05 Classic Chorus', code: 'J-05', logo: 'CLASSIC SWIRL', typeName: 'Chorus', cat: 'Modulation',
      color: '#5aaedc', text: '#06202e', accent: '#1d5f86', led: '#3d8bff',
      algo: 'chorus', opts: { style: 'bbd' }, fixed: { mode: 0 },
      controls: [k('mix', 'LEVEL', { def: 0.5 }), k('depth', 'DEPTH', { def: 0.5 }), k('rate', 'RATE', { def: 0.35 })],
      desc: 'Warm, wide analog-style chorus.',
    }),
    JF({
      id: 'joyo.jf06', name: 'Old School Phase', ref: 'Joyo JF-06 Vintage Phase', code: 'J-06', logo: 'OLD SCHOOL', typeName: 'Phaser', cat: 'Modulation',
      color: '#ec7a1c', text: '#2a1100', accent: '#7a3300',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.85, mix: 0.5 },
      controls: [k('rate', 'SPEED', { def: 0.35 }), TOG('vmode', '', ['VINTAGE', 'MODERN'])],
      derive: (p) => ({ feedback: p.vmode ? 0.55 : 0.2 }),
      desc: 'Four-stage phaser with one speed knob. MODERN adds resonance.',
    }),
    JF({
      id: 'joyo.jf08', name: 'Digital Echo', ref: 'Joyo JF-08 Digital Delay', code: 'J-08', logo: 'DIGITAL ECHO', typeName: 'Digital delay', cat: 'Delay',
      color: '#e8e8e6', text: '#151515', accent: '#2b2b2d', led: '#3d8bff',
      algo: 'delay', opts: { maxMs: 1600 }, fixed: { mode: 0, tone: 0.75 },
      controls: [k('mix', 'LEVEL', { def: 0.4 }), k('feedback', 'F.BACK', { def: 0.35, max: 0.98 }), k('dtime', 'TIME', { def: 0.5, virtual: true }),
        TOG('range', '', ['S', 'M', 'L'], { def: 1 })],
      derive: (p) => { const r = [[25, 200], [100, 800], [200, 1600]][p.range ?? 1]; return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.5) }; },
      desc: 'Clean digital delay with three time ranges.',
    }),
    JF({
      id: 'joyo.jf10', name: 'Dyna Squeeze', ref: 'Joyo JF-10 Dynamic Compressor', code: 'J-10', logo: 'DYNA SQUEEZE', typeName: 'Compressor', cat: 'Dynamics',
      color: '#c92a2a', text: '#fff0f0', accent: '#4a0b0b',
      algo: 'comp', opts: { type: 'ota' }, fixed: { attack: 0.25 },
      controls: [k('level', 'OUTPUT', { def: 0.42 }), k('sustain', 'SUSTAIN', { def: 0.5 })],
      desc: 'Two-knob OTA compressor for funk chops and clean sustain.',
    }),
    // ---------------------------------------------------------------- JF amp-in-a-box
    AMPBOX({
      id: 'joyo.jf13', name: 'Chime Tone', ref: 'Joyo JF-13 AC Tone', code: 'J-13', logo: 'CHIME TONE', typeName: 'Class A amp sim',
      color: '#7a1f2b', text: '#f6e7cf', accent: '#d8c49a', windowText: '#3a1a10',
      voice: { base: 'ac30', otLp: 6000, otHp: 90 },
      controls: [K('level', 'VOLUME', { min: -24, max: 12, def: -1.5, display: db }), k('treble', 'TREBLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.5 })],
      fixed: { mid: 0.5 },
      desc: 'Chimey class A British combo voice. Gain goes from clean jangle to crunch.',
    }),
    AMPBOX({
      id: 'joyo.jf14', name: 'US Sound', ref: 'Joyo JF-14 American Sound', code: 'J-14', logo: 'US SOUND', typeName: 'Tweed amp sim',
      color: '#1d1d1f', text: '#efe3c0', accent: '#d9c690', windowText: '#2a210c',
      voice: { base: 'deluxe', otLp: 5600, otHp: 70 },
      controls: [k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), K('level', 'LEVEL', { min: -24, max: 12, def: 0, display: db }), k('bright', 'VOICE', { def: 0.3 }), k('gain', 'DRIVE', { def: 0.45 })],
      desc: 'Fifties tweed combo in a box: from fat clean to hairy breakup.',
    }),
    AMPBOX({
      id: 'joyo.jf15', name: 'West Coast Sound', ref: 'Joyo JF-15 California Sound', code: 'J-15', logo: 'WEST COAST', typeName: 'High gain amp sim',
      color: '#202022', text: '#e8463c', accent: '#2f2f33', windowText: '#e8463c',
      voice: { base: 'recto', otLp: 5200, otHp: 90, tight: 0.6 },
      controls: [k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), K('level', 'LEVEL', { min: -24, max: 12, def: -6, display: db }), k('bright', 'VOICE', { def: 0.3 }), k('gain', 'DRIVE', { def: 0.55 })],
      desc: 'Californian high-gain stack tone: thick, tight and heavy.',
    }),
    AMPBOX({
      id: 'joyo.jf16', name: 'UK Sound', ref: 'Joyo JF-16 British Sound', code: 'J-16', logo: 'UK SOUND', typeName: 'British amp sim',
      color: '#b8a06a', text: '#1d1607', accent: '#1d1d1f', windowText: '#e9d9a8',
      voice: { base: 'jcm800', otLp: 5200, otHp: 90 },
      controls: [k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), K('level', 'LEVEL', { min: -24, max: 12, def: -2, display: db }), k('bright', 'VOICE', { def: 0.3 }), k('gain', 'DRIVE', { def: 0.5 })],
      desc: 'Classic British stack crunch and lead.',
    }),

    // ---------------------------------------------------------------- R series
    JR({
      id: 'joyo.r01', name: 'Bull Horn Drive', ref: 'Joyo R-01 Tauren Overdrive', code: 'RZ-01', logo: 'BULL HORN', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#2c7a5a', text: '#effff7', accent: '#9ff0cc',
      algo: 'drive', opts: { clip: 'ge', bias: 0.12, cleanSum: true, cleanMix: 0.45, clipHp: 400, gainMinDb: 0, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 2800, postLp: 9000, levelMaxDb: 8 },
      fixed: { mid: 0.5 },
      controls: [k('level', 'VOLUME'), k('gain', 'GAIN', { def: 0.45 }), k('treble', 'TREBLE'), k('bass', 'BASS')],
      desc: 'Clean-blend overdrive with more gain on tap and separate bass and treble.',
    }),
    JR({
      id: 'joyo.r02', name: 'Yin Yang Drive', ref: 'Joyo R-02 Taichi Overdrive', code: 'RZ-02', logo: 'YIN YANG', typeName: 'Low gain overdrive', cat: 'Overdrive',
      color: '#ecebe6', text: '#141414', accent: '#141414',
      algo: 'drive', opts: { clip: 'tube', bias: 0.15, preHp: 70, gainMinDb: 2, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 9000, levelMaxDb: 6, preEq: [{ type: 'peak', f: 700, q: 0.7, db: 2 }] },
      controls: [k('level', 'VOLUME'), k('tone', 'TONE'), k('gain', 'GAIN', { def: 0.4 }), TOG('bright', '', ['WARM', 'BRIGHT'], { values: [0, 0.6] })],
      desc: 'Smooth, touch-sensitive low-gain drive in the style of famous boutique amps.',
    }),
    JR({
      id: 'joyo.r03', name: 'Sub Machine Distortion', ref: 'Joyo R-03 Uzi Distortion', code: 'RZ-03', logo: 'SUB MACHINE', typeName: 'British distortion', cat: 'Distortion',
      color: '#5a5f66', text: '#f2f4f7', accent: '#ffb02e',
      algo: 'amp', cost: 1.6, opts: { preamp: true, voice: { base: 'jcm800', otLp: 5000, otHp: 90, drive: 1.1 } },
      controls: [K('level', 'VOLUME', { min: -24, max: 12, def: -5, display: db }), k('gain', 'GAIN', { def: 0.6 }), k('sag', 'BIAS', { def: 0.5 }), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH')],
      desc: 'British stack in a box. BIAS changes the feel from tight to saggy.',
    }),
    JR({
      id: 'joyo.r04', name: 'Zap Amp Drive', ref: 'Joyo R-04 Zip Amp', code: 'RZ-04', logo: 'ZAP AMP', typeName: 'Compressed overdrive', cat: 'Overdrive',
      color: '#c21f2a', text: '#fff0f1', accent: '#ffd0d4',
      algo: 'drive', opts: { clip: 'si', bias: 0.1, preHp: 60, gainMinDb: 0, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 9000, levelMaxDb: 6, outTrim: 0.33,
        modes: [{ gainMaxDb: 22, clip: 'clean' }, { stages: 2, stage2Db: 10 }] },
      fixed: { mid: 0.5 },
      controls: [k('level', 'VOLUME'), k('bass', 'LOW'), k('treble', 'HIGH'), k('gain', 'DRIVE', { def: 0.5 }), TOG('mode', '', ['OPEN', 'COMP'], { def: 1 })],
      desc: 'Amp-style drive. OPEN is a clean boost, COMP is a squashed, saturated small amp.',
    }),
    JR({
      id: 'joyo.r07', name: 'Water Bearer Delay', ref: 'Joyo R-07 Aquarius Delay', code: 'RZ-07', logo: 'WATER BEARER', typeName: 'Multi-mode delay', cat: 'Delay',
      color: '#1f6fa8', text: '#e9f5ff', accent: '#8fd0ff', stereo: 'both',
      algo: 'delay', opts: { maxMs: 2000 },
      controls: [k('mix', 'LEVEL', { def: 0.4 }), k('feedback', 'REPEAT', { def: 0.38, max: 1.05 }), K('time', 'TIME', { min: 30, max: 2000, def: 420, display: ms }),
        SEL('dmode', 'MODE', ['TUBE', 'TAPE', 'REV', 'LO-BIT', 'MOD', 'GALAXY', 'DIG', 'PING'], { def: 1, sweep: 270, optSize: 4.2, labelRadius: 6 })],
      derive: (p) => {
        const m = [1, 2, 5, 3, 4, 10, 0, 7][p.dmode ?? 1];
        return { mode: m, tone: m === 1 ? 0.4 : m === 2 ? 0.45 : 0.7, moddepth: m === 4 || m === 3 ? 0.4 : 0.05, sat: m === 1 ? 0.5 : 0.3 };
      },
      tapFoot: true, tapLed: true,
      desc: 'Eight delays from warm tube and tape echo to reverse and a spacey galaxy mode. Hold the switch to tap the tempo.',
    }),
    JR({
      id: 'joyo.r14', name: 'Sky Layer Reverb', ref: 'Joyo R-14 Atmosphere Reverb', code: 'RZ-14', logo: 'SKY LAYER', typeName: 'Multi-mode reverb', cat: 'Reverb',
      color: '#4b3a8c', text: '#f1edff', accent: '#c6b8ff', stereo: 'both',
      algo: 'reverb',
      controls: [k('mix', 'MIX', { def: 0.38 }), k('decay', 'DECAY', { def: 0.55 }), k('tone', 'TONE', { def: 0.55 }), k('mod', 'MOD', { def: 0.3 }),
        SEL('mode', 'MODE', ['PLATE', 'HALL', 'SPRING', 'ECHO', 'SHIM', 'CLOUD', 'SWELL', 'ROOM', 'MOD'], { values: [2, 1, 3, 8, 4, 5, 9, 0, 6], def: 1, sweep: 280, optSize: 4, labelRadius: 6 })],
      desc: 'Nine reverbs: classic plate, hall and spring plus echo, shimmer, cloud and swell.',
    }),
  ]);
}
