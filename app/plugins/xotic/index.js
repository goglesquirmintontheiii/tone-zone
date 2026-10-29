// Built-in Tone Zone plugin: Xotic.
// Blocks inspired by Xotic Effects pedals. Names and artwork are Tone Zone originals; control sets follow the
// real units (see each block's `ref`). One form ("xo") draws the family: a plain powder-coated box with big
// outlined initials, the model name low on the face and a small stomp. `mini: true` gives the mini box.
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, db } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;

  const owned = new WeakSet();
  tz.addForm('xo', (ctx, d) => {
    const g = ctx.g, mini = !!d.mini;
    const w = mini ? 86 : 124, h = mini ? 188 : 236;
    const col = d.color, txt = d.text || '#151515';
    formKit.body(g, w, h, col, { rx: mini ? 5 : 6 });
    d.controls.forEach((c) => { if (c.x === undefined) owned.add(c); });
    const mine = d.controls.filter((c) => owned.has(c));
    const knobs = mine.filter((c) => c.t === 'knob');
    const n = knobs.length;
    const rows = d.rows || (mini ? (n <= 2 ? [n] : [2, n - 2]) : n <= 3 ? [n] : n === 4 ? [2, 2] : [3, n - 3]);
    let k = 0, y = mini ? 30 : 34, bottom = 16;
    rows.forEach((cnt) => {
      const row = knobs.slice(k, k + cnt);
      k += cnt;
      const r = mini ? (cnt === 1 ? 11 : 9.5) : cnt >= 3 ? 10.5 : 12;
      const m = mini ? 22 : cnt >= 3 ? 26 : 34;
      row.forEach((c, i) => Object.assign(c, { x: cnt === 1 ? w / 2 : m + ((w - 2 * m) * i) / (cnt - 1), y, r, labelPos: 'below' }));
      bottom = y + r + 14;
      y = bottom + r + 6;
    });
    const tg = mine.filter((c) => c.t === 'toggle');
    if (tg.length) {
      const ty = bottom + (tg.some((t) => t.label) ? 22 : 12);
      tg.forEach((t, i) => Object.assign(t, { x: tg.length === 1 ? w / 2 : 34 + (i * (w - 68)) / (tg.length - 1), y: ty, orient: t.orient || 'h' }));
      bottom = ty + 16;
    }
    const feet = mine.filter((c) => c.t === 'foot'), leds = mine.filter((c) => c.t === 'led');
    const fx = feet.length > 1 ? [w * 0.27, w * 0.73] : [w / 2];
    feet.forEach((f, i) => Object.assign(f, { style: 'stomp', x: fx[i], y: h - 30, r: mini ? 10.5 : 12 }));
    leds.forEach((l, i) => Object.assign(l, { x: fx[i] ?? w / 2, y: h - 56, r: 2.6 }));
    // model name sits above the LED; big outlined initials fill the space above it if there is room
    const ls = d.logoSize || (mini ? 11 : 14);
    const nameY = h - 74 - (d.sub ? 6 : 0);
    const space = nameY - ls * 0.6 - bottom;
    if (d.initials && space > 26) {
      const is = Math.min(mini ? 30 : 40, space * 0.8);
      const t = label(g, w / 2, bottom + space / 2 + 1, d.initials, { size: is, fill: 'none', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
      t.setAttribute('stroke', d.initialsColor || txt);
      t.setAttribute('stroke-width', 1.1);
      t.setAttribute('stroke-opacity', 0.75);
    }
    label(g, w / 2, nameY, d.logo, { size: ls, fill: d.logoColor || txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    if (d.sub) label(g, w / 2, nameY + ls * 0.5 + 5, d.sub, { size: mini ? 4.2 : 4.8, fill: txt, weight: 700, ls: 1.2, opacity: 0.8 });
    formKit.tzBadge(g, w / 2, h - 8, txt, mini ? 3.4 : 4);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: mini ? 5.4 : 6.2 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: mini ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: 46, gap: 28 }) };
  });

  const XO = (o) => def(Object.assign({ form: 'xo', brand: 'Xotic' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#3d8bff' })])] }));
  const RC = { clip: 'opamp', preHp: 30, gainMinDb: 0, gainMaxDb: 24, tone: 'eq3', eqRangeDb: 15, bassF: 100, midF: 800, trebleF: 3500, postLp: 16000, cleanSum: true, cleanMix: 0.4, levelMaxDb: 10 };

  tz.addDefs([
    XO({
      id: 'xo.ep', name: 'EP Lift', ref: 'Xotic EP Booster', cat: 'Boost', typeName: 'Booster', mini: true, color: '#c8ccd2', text: '#151515', initials: 'EP',
      logo: 'EP LIFT', sub: 'BOOSTER',
      algo: 'drive', opts: { clip: 'clean', preHp: 40, gainMinDb: 0, gainMaxDb: 20, tone: 'none', postLp: 16000, levelMaxDb: 0, preEq: [{ type: 'hs', f: 2500, q: 0.7, db: 1.5 }, { type: 'ls', f: 120, q: 0.7, db: 1 }] },
      fixed: { level: 1 },
      controls: [K('gain', 'BOOST', { def: 0.3, display: ten })],
      desc: 'Tape-echo preamp style boost that adds sparkle and a little weight.',
    }),
    XO({
      id: 'xo.rc', name: 'RC Lift', ref: 'Xotic RC Booster V2', cat: 'Boost', typeName: 'Booster', color: '#3a4f9a', text: '#f2f2f2', initials: 'RC', noStd: true,
      logo: 'RC LIFT', sub: 'BOOSTER',
      algo: 'drive', opts: Object.assign({}, RC, { modes: [{}, { gainMaxDb: 30, clip: 'asym' }] }),
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.65 }), K('gain', 'GAIN', { def: 0.35 }), K('treble', 'TREBLE', { def: 0.5 }), K('bass', 'BASS', { def: 0.5 }),
        FOOT({ label: 'ON' }), LED({ color: '#3d8bff' }), FOOT({ action: 'param', p: 'mode', label: 'GAIN 2' }), LED({ bind: 'param:mode', color: '#ff2a1a' })],
      desc: 'Clean, transparent booster with +/-15 dB active EQ. GAIN 2 kicks in a second, hotter gain stage.',
    }),
    XO({
      id: 'xo.bb', name: 'BB Pre', ref: 'Xotic BB Preamp V1.5', cat: 'Overdrive', typeName: 'Preamp / overdrive', color: '#a5652e', text: '#fbf1e6', initials: 'BB',
      logo: 'BB PRE', sub: 'PREAMP',
      algo: 'drive', opts: { clip: 'asym', bias: 0.15, preHp: 60, gainMinDb: 4, gainMaxDb: 38, tone: 'eq3', eqRangeDb: 15, bassF: 100, midF: 800, trebleF: 3200, postLp: 9000, levelMaxDb: 6,
        modes: [{}, { gainMaxDb: 44 }] },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.45 }), K('gain', 'GAIN', { def: 0.45 }), K('treble', 'TREBLE', { def: 0.5 }), K('bass', 'BASS', { def: 0.5 }), TOG('mode', 'GAIN', ['LO', 'HI'])],
      desc: 'Bluesy, amp-like overdrive with an active two-band EQ.',
    }),
    XO({
      id: 'xo.ac', name: 'AC Lift', ref: 'Xotic AC Booster V2', cat: 'Overdrive', typeName: 'Booster / overdrive', color: '#c9a24a', text: '#1d1606', initials: 'AC',
      logo: 'AC LIFT', sub: 'BOOSTER',
      algo: 'drive', opts: { clip: 'diode', bias: 0.05, preHp: 50, gainMinDb: 0, gainMaxDb: 32, tone: 'eq3', eqRangeDb: 15, bassF: 100, midF: 800, trebleF: 3200, postLp: 11000, levelMaxDb: 6,
        modes: [{}, { clip: 'asym', bias: 0.2 }] },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.56 }), K('gain', 'GAIN', { def: 0.4 }), K('treble', 'TREBLE', { def: 0.5 }), K('bass', 'BASS', { def: 0.5 }), TOG('mode', 'COMP', ['LO', 'HI'])],
      desc: 'Light, open drive that goes from clean boost to crunch, with active EQ.',
    }),
    XO({
      id: 'xo.sl', name: 'SL Push', ref: 'Xotic SL Drive', cat: 'Overdrive', typeName: 'Overdrive', mini: true, color: '#d9c48a', text: '#1d1606', initials: 'SL',
      logo: 'SL PUSH', sub: 'DRIVE',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 10, bias: 0.2, preHp: 90, gainMinDb: 6, gainMaxDb: 42, tone: 'lp', toneLo: 1300, toneHi: 9000, postLp: 8000, levelMaxDb: 6 },
      controls: [K('gain', 'DRIVE', { def: 0.5 }), K('tone', 'TONE', { def: 0.5 }), K('level', 'VOLUME', { def: 0.45 })],
      desc: 'Plexi-style crunch in a mini box.',
    }),
    XO({
      id: 'xo.sp', name: 'SP Squeeze', ref: 'Xotic SP Compressor', cat: 'Dynamics', typeName: 'Compressor', mini: true, color: '#b8c4cc', text: '#151515', initials: 'SP',
      logo: 'SP SQUEEZE', logoSize: 10, sub: 'COMPRESSOR',
      algo: 'comp', opts: { type: 'vca' }, fixed: { attack: 0.25, release: 0.4 },
      controls: [K('level', 'VOLUME', { def: 0.4 }), K('blend', 'BLEND', { def: 0.7 }), TOG('amt', '', ['LO', 'MID', 'HI'], { virtual: true })],
      derive: (p) => ({ sustain: [0.3, 0.5, 0.75][p.amt ?? 1], ratio: [0.3, 0.5, 0.7][p.amt ?? 1] }),
      desc: 'Studio-style compressor with a parallel BLEND and three compression amounts.',
    }),
    XO({
      id: 'xo.soul', name: 'Soul Drive', ref: 'Xotic Soul Driven', cat: 'Overdrive', typeName: 'Overdrive / boost', color: '#2f8f8a', text: '#f1fbfa', initials: 'SD',
      logo: 'SOUL DRIVE', sub: 'OVERDRIVE',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, cleanMix: 0.4, preHp: 60, clipHp: 400, gainMinDb: 0, gainMaxDb: 36, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 900, trebleF: 3000, useHiMid: true, hiMidF: 1200, postLp: 9000, levelMaxDb: 7 },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.6 }), K('gain', 'GAIN', { def: 0.4 }), K('treble', 'TREBLE', { def: 0.5 }), K('mid', 'MID BOOST', { def: 0.5, virtual: true }),
        TOG('bass', 'BASS', ['CUT', 'FLAT', 'BOOST'], { values: [0.3, 0.5, 0.7], def: 1 })],
      derive: (p) => ({ himid: 0.3 + 0.6 * (p.mid ?? 0.5) }),
      desc: 'Klon-flavoured transparent drive with a mid boost and a three-way bass switch.',
    }),
    XO({
      id: 'xo.sweet', name: 'Super Sweet Lift', ref: 'Xotic Super Sweet Booster', cat: 'Boost', typeName: 'Booster', mini: true, color: '#e7b9c8', text: '#2a0c16', initials: 'SS',
      logo: 'SWEET LIFT', logoSize: 10.5, sub: 'BOOSTER',
      algo: 'drive', opts: { clip: 'clean', preHp: 30, gainMinDb: 0, gainMaxDb: 20, tone: 'tilt', eqRangeDb: 6, postLp: 16000, levelMaxDb: 0 },
      fixed: { level: 1 },
      controls: [K('gain', 'VOLUME', { def: 0.3 }), K('tone', 'TONE', { def: 0.5 }), TOG('bias', '', ['LO', 'MID', 'HI'], { virtual: true, def: 1 })],
      derive: (p) => ({ sag: [0.3, 0.1, 0][p.bias ?? 1] }),
      desc: 'Clean boost with a tilt tone and a three-way headroom switch.',
    }),
    XO({
      id: 'xo.bassbb', name: 'Bass BB Pre', ref: 'Xotic Bass BB Preamp V1.5', cat: 'Overdrive', typeName: 'Bass preamp / overdrive', color: '#6b3a1e', text: '#fbf1e6', initials: 'BB',
      logo: 'BASS BB PRE', logoSize: 13, sub: 'BASS PREAMP',
      algo: 'drive', opts: { clip: 'asym', bias: 0.15, preHp: 25, gainMinDb: 2, gainMaxDb: 36, tone: 'eq3', eqRangeDb: 15, bassF: 80, midF: 600, trebleF: 2500, postLp: 7000, cleanSum: true, levelMaxDb: 6 },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.64 }), K('gain', 'GAIN', { def: 0.4 }), K('blend', 'BLEND', { def: 0.6 }), K('treble', 'TREBLE', { def: 0.5 }), K('bass', 'BASS', { def: 0.5 })],
      desc: 'Bass overdrive with a clean blend and active EQ.',
    }),
  ]);
}
