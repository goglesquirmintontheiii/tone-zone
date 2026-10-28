// Built-in Tone Zone plugin: Radial Engineering.
// DI / re-amp boxes, an A/B/Y switcher and a booster inspired by Radial and Tonebone gear. Names, logos and
// artwork are Tone Zone originals; switch layouts follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, db } = tz.helpers;
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const hz = (v) => Math.round(v) + ' Hz';

  // ---------------------------------------------------------------- enclosure: 14-gauge steel "I-beam" box –
  // a painted shell slid into thick book-end caps (left / right), recessed switches, bold italic logo.
  tz.addForm('rd-box', (ctx, d) => {
    const { svg, label, formKit, shade } = tz.gfx;
    const g = ctx.g, w = d.fw || 130, h = d.fh || 160;
    const cap = 12;
    formKit.body(g, w, h, shade(d.color, -0.45), { rx: 4 });
    // painted shell between the caps
    svg('rect', { x: cap, y: 3, width: w - cap * 2, height: h - 6, fill: d.color }, g);
    svg('rect', { x: cap, y: 3, width: w - cap * 2, height: h - 6, fill: 'url(#p-grain)' }, g);
    svg('rect', { x: cap, y: 3, width: w - cap * 2, height: h - 6, fill: 'url(#g-shadeV)', opacity: 0.7 }, g);
    for (const x of [cap, w - cap]) svg('line', { x1: x, y1: 3, x2: x, y2: h - 3, stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 1.2 }, g);
    // book-end caps with screws
    for (const x of [cap / 2, w - cap / 2]) for (const y of [14, h - 14]) formKit.screw(g, x, y, 2.4);
    const txt = d.text || '#f2f2f2';
    label(g, w / 2, d.logoY ?? 30, d.logo, { size: d.logoSize || 15, fill: txt, weight: 900, italic: true, ls: 0.4, font: "'Inter', sans-serif" });
    label(g, w / 2, (d.logoY ?? 30) + 12, d.tagline || '', { size: 5, fill: txt, weight: 700, ls: 1.3, opacity: 0.8 });
    if (d.stripe) svg('rect', { x: cap, y: (d.logoY ?? 30) + 19, width: w - cap * 2, height: 2, fill: d.stripe }, g);
    formKit.tzBadge(g, w / 2, h - 9, txt, 4);
    const theme = { text: txt, knob: d.knob || 'chicken', labelSize: 5.8, labelLs: 0.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: d.jy0 ?? 70, gap: d.jgap ?? 30 }) };
  });

  const R = (o) => def(Object.assign({ form: 'rd-box', brand: 'Radial Engineering', cat: 'Utility', kind: 'Utility', alwaysOn: true, cost: 0.05 }, o));

  tz.addDefs([
    R({
      id: 'rd.prodi', name: 'Pro Direct', ref: 'Radial ProDI', logo: 'PRO·DIRECT', logoSize: 12, tagline: 'PASSIVE DIRECT BOX', typeName: 'Passive DI box', color: '#2c5c95', stripe: '#d7dde5',
      fw: 132, fh: 150, algo: 'di', ports: { ins: ['INPUT'], outs: ['XLR OUT', 'THRU'] }, jackKinds: { o0: 'xlr' }, jy0: 66,
      controls: [
        at(TOG('pad', '-15dB', ['0', 'PAD'], { values: [0, 1] }), 36, 98, { orient: 'v' }),
        at(TOG('speaker', 'FILTER', ['FLAT', 'LPF']), 66, 98, { orient: 'v' }),
        at(TOG('lift', 'GROUND', ['GND', 'LIFT']), 96, 98, { orient: 'v' }),
      ],
      fixed: { level: 6 },
      desc: 'Passive DI: -15 dB pad, high-cut FILTER (speaker-voiced low pass), ground lift. XLR mic-level out + THRU to the amp.',
    }),
    R({
      id: 'rd.j48', name: 'Jay-48 Active DI', ref: 'Radial J48', logo: 'JAY-48', tagline: 'ACTIVE DIRECT BOX', typeName: 'Active (phantom) DI box', color: '#7b838c', stripe: '#1d4f8f',
      fw: 140, fh: 176, algo: 'di', ports: { ins: ['INPUT'], outs: ['XLR OUT', 'THRU'] }, jackKinds: { o0: 'xlr' }, jy0: 66,
      controls: [
        at(TOG('pad', 'PAD', ['0', '-15'], { values: [0, 1] }), 44, 86, { orient: 'h' }),
        at(TOG('lowcut', 'LOW CUT', ['FLAT', '80Hz'], { values: [20, 80] }), 96, 86, { orient: 'h' }),
        at(TOG('invert', 'POLARITY', ['0°', '180°']), 44, 132, { orient: 'h' }),
        at(TOG('lift', 'GND LIFT', ['GND', 'LIFT']), 96, 132, { orient: 'h' }),
      ],
      fixed: { level: 6 },
      desc: 'Phantom-powered active DI: pad, 80 Hz low cut, polarity reverse and ground lift.',
    }),
    R({
      id: 'rd.pzdi', name: 'Piezo Direct', ref: 'Radial PZ-DI', logo: 'PZ·DIRECT', logoSize: 13, tagline: 'ORCHESTRAL / PIEZO DI', typeName: 'Variable-load piezo DI', color: '#3f4a3a', stripe: '#c9b46a',
      fw: 140, fh: 176, algo: 'di', ports: { ins: ['INPUT'], outs: ['XLR OUT', 'THRU'] }, jackKinds: { o0: 'xlr' }, jy0: 66,
      controls: [
        at(K('lowcut', 'LOW CUT', { min: 20, max: 300, def: 40, curve: 'log', display: hz }), 46, 84, { r: 11 }),
        at(K('level', 'LEVEL', { min: -24, max: 24, def: 6, display: db }), 94, 84, { r: 11 }),
        at(TOG('pad', 'PAD', ['0', '-15'], { values: [0, 1] }), 36, 136, { orient: 'h' }),
        at(TOG('invert', 'Ø', ['0°', '180°']), 70, 136, { orient: 'h' }),
        at(TOG('lift', 'GND', ['GND', 'LIFT']), 104, 136, { orient: 'h' }),
      ],
      desc: 'High-impedance DI for piezo pickups: adjustable low cut to tame body boom and feedback, pad, polarity, ground lift.',
    }),
    R({
      id: 'rd.prormp', name: 'Pro Re-Amper', ref: 'Radial ProRMP', logo: 'PRO·REAMP', logoSize: 12, tagline: 'PASSIVE RE-AMPER', typeName: 'Re-amp box (XLR → amp)', color: '#a2412a', stripe: '#f0d9b5',
      fw: 132, fh: 150, algo: 'di', opts: { reamp: true }, ports: { ins: ['XLR IN'], outs: ['TO AMP'] }, jackKinds: { i0: 'xlr' }, jy0: 70,
      controls: [
        at(K('level', 'LEVEL', { min: -24, max: 12, def: -6, display: db }), 48, 98, { r: 13 }),
        at(TOG('lift', 'GROUND', ['GND', 'LIFT']), 96, 98, { orient: 'v' }),
      ],
      desc: 'Passive re-amper: send a recorded (line-level, XLR) track back out to a guitar amp or pedals. LEVEL trims the instrument-level output.',
    }),
    R({
      id: 'rd.bigshotaby', name: 'Big Pick A/B/Y', ref: 'Radial Tonebone BigShot ABY', logo: 'BIG PICK', logoSize: 15, tagline: 'A/B/Y AMP SWITCHER', typeName: 'A/B/Y switcher', color: '#b02a22', stripe: '#f1e2c4',
      fw: 150, fh: 206, kind: 'Utility', algo: 'split', ports: { ins: ['INPUT'], outs: ['OUT A', 'OUT B'] }, jy0: 70,
      controls: [
        at(TOG('inv2', 'B POLARITY', ['0°', '180°']), 46, 76, { orient: 'h' }),
        at(TOG('iso', 'B ISO', ['OFF', 'ISO']), 104, 76, { orient: 'h' }),
        at(LED({ bind: 'param:ab', color: '#ffb000', r: 3, label: 'A / B' }), 46, 116),
        at(LED({ bind: 'param:y', color: '#3ddc84', r: 3, label: 'A + B' }), 104, 116),
        at(FOOT({ action: 'param', p: 'ab', label: 'A / B', style: 'stomp', r: 12 }), 46, 160),
        at(FOOT({ action: 'param', p: 'y', label: 'Y', style: 'stomp', r: 12 }), 104, 160),
      ],
      initParams: { ab: 0, y: 0 },
      derive: (p) => ({ m1: !p.y && p.ab ? 1 : 0, m2: !p.y && !p.ab ? 1 : 0 }),
      desc: 'Route one guitar to amp A, amp B (A/B footswitch, LED lit = B) or both (Y). B output has a polarity switch; ISO = isolation transformer on B (kills ground hum; sonically transparent here).',
    }),
    R({
      id: 'rd.cherrybomb', name: 'Cherry Blast', ref: 'Radial Tonebone Cherry Bomb', logo: 'CHERRY', logoSize: 17, tagline: 'CLEAN BOOST', typeName: 'Clean / treble booster', color: '#b3122a', stripe: '#ffd6d6',
      fw: 112, fh: 206, cat: 'Boost', kind: 'Pedal', alwaysOn: false, cost: 0.2, algo: 'boost', jy0: 70,
      controls: [
        at(K('gain', 'BOOST', { def: 0.05 }), 56, 82, { r: 14 }),
        at(K('treble', 'HIGH', { def: 0.5 }), 36, 124, { r: 9 }),
        at(TOG('mode', 'VOICE', ['FLAT', 'BRT'], { values: [0, 1] }), 80, 124, { orient: 'h' }),
        at(LED({ color: '#ff2a1a', r: 3 }), 56, 146),
        at(FOOT({ style: 'stomp', r: 12 }), 56, 172),
      ],
      desc: 'Discrete clean boost with a high-frequency trim and FLAT / BRIGHT voicing.',
    }),
  ]);
}
