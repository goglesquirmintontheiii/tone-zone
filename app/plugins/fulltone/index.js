// Built-in Tone Zone plugin: Fulltone.
// Blocks inspired by Fulltone pedals. Names and artwork are Tone Zone originals; control sets follow the real
// units (see each block's `ref`). One form ("ft") draws the family: a heavy painted box with an inset pinline,
// knob rows, a switch row, the model name in a framed plate and one or two footswitches.
export default function register(tz) {
  const { K, TOG, FOOT, LED, TREADLE, def, ten } = tz.helpers;
  const { svg, label, formKit, shade, luminance } = tz.gfx;

  const owned = new WeakSet();
  tz.addForm('ft', (ctx, d) => {
    const g = ctx.g;
    const w = d.wide ? 176 : 140;
    let h = d.tall ? 252 : 232;
    const col = d.color, txt = d.text || '#151515';
    const bodyG = svg('g', {}, g); // drawn once the height is known
    d.controls.forEach((c) => { if (c.x === undefined) owned.add(c); });
    const mine = d.controls.filter((c) => owned.has(c));
    const knobs = mine.filter((c) => c.t === 'knob');
    const n = knobs.length;
    const rows = d.rows || (n <= 3 ? [n] : n === 4 ? [2, 2] : [3, n - 3]);
    let k = 0, y = 34, bottom = 20;
    rows.forEach((cnt) => {
      const row = knobs.slice(k, k + cnt);
      k += cnt;
      const r = cnt >= 3 ? 12 : 13;
      const m = cnt >= 3 ? 30 : 40;
      row.forEach((c, i) => Object.assign(c, { x: cnt === 1 ? w / 2 : m + ((w - 2 * m) * i) / (cnt - 1), y, r, labelPos: 'below' }));
      bottom = y + r + 14;
      y = bottom + r + 6;
    });
    const tg = mine.filter((c) => c.t === 'toggle');
    if (tg.length) {
      const ty = bottom + (tg.some((t) => t.label) ? 22 : 12);
      tg.forEach((t, i) => Object.assign(t, { x: tg.length === 1 ? w / 2 : 38 + (i * (w - 76)) / (tg.length - 1), y: ty, orient: t.orient || 'h' }));
      bottom = ty + 16;
    }
    h = Math.max(h, bottom + 6 + 34 + 72);
    formKit.body(bodyG, w, h, col, { rx: 7 });
    svg('rect', { x: 6, y: 6, width: w - 12, height: h - 12, rx: 4, fill: 'none', stroke: txt, 'stroke-width': 0.8, 'stroke-opacity': 0.4 }, bodyG);
    const feet = mine.filter((c) => c.t === 'foot'), leds = mine.filter((c) => c.t === 'led');
    const fx = feet.length > 1 ? [w * 0.28, w * 0.72] : [w / 2];
    feet.forEach((f, i) => Object.assign(f, { style: 'stomp', x: fx[i], y: h - 32, r: 12.5 }));
    leds.forEach((l, i) => Object.assign(l, { x: fx[i] ?? w / 2, y: h - 60, r: 2.8 }));
    // name plate between the controls and the LEDs
    const py = Math.max(bottom + 6, h - 112), ph = Math.min(38, h - 72 - py);
    const plate = d.plate || shade(col, luminance(col) > 0.5 ? -0.55 : -0.35);
    svg('rect', { x: 14, y: py, width: w - 28, height: ph, rx: 3, fill: plate }, g);
    svg('rect', { x: 16, y: py + 2, width: w - 32, height: ph - 4, rx: 2, fill: 'none', stroke: d.plateText || '#f2ead8', 'stroke-width': 0.6, 'stroke-opacity': 0.6 }, g);
    const ls = d.logoSize || 17;
    label(g, w / 2, py + ph * (d.sub ? 0.42 : 0.52), d.logo, { size: ls, fill: d.plateText || '#f2ead8', font: d.logoFont || "'Oswald', sans-serif", weight: 700, ls: 1.2, italic: d.logoItalic });
    if (d.sub) label(g, w / 2, py + ph - 6, d.sub, { size: 4.8, fill: d.plateText || '#f2ead8', weight: 700, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4);
    const theme = { text: txt, knob: d.knob || 'mxr', labelSize: 6.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 48, gap: 28 }) };
  });

  const FT = (o) => def(Object.assign({ form: 'ft', brand: 'Fulltone' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));

  tz.addDefs([
    FT({
      id: 'ft.ocd', name: 'OCV Drive', ref: 'Fulltone OCD', cat: 'Overdrive', typeName: 'Overdrive', color: '#ecebe4', text: '#151515', plate: '#1a1a1a',
      logo: 'O.C.V.', logoSize: 20, sub: 'OBSESSIVE COMPULSIVE',
      algo: 'drive', opts: { clip: 'mosfet', bias: 0.15, preHp: 60, gainMinDb: 6, gainMaxDb: 44, tone: 'lp', toneLo: 1300, toneHi: 9500, postLp: 9000, levelMaxDb: 6,
        modes: [{ preEq: [{ type: 'hs', f: 1800, q: 0.7, db: 2.5 }] }, { preEq: [{ type: 'ls', f: 140, q: 0.7, db: 2.5 }], postLp: 6500 }] },
      controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('gain', 'DRIVE', { def: 0.45, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), TOG('mode', '', ['HP', 'LP'])],
      desc: 'Amp-like drive from light crunch to thick distortion. HP is brighter and louder, LP is darker and smoother.',
    }),
    FT({
      id: 'ft.fd2', name: 'Fuller Drive 2', ref: 'Fulltone Full-Drive 2 Mosfet', cat: 'Overdrive', typeName: 'Overdrive / boost', color: '#a9bccf', text: '#151515', noStd: true, tall: true,
      logo: 'FULLER DRIVE 2', logoSize: 14, sub: 'MOSFET',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 600, gainMinDb: 0, gainMaxDb: 40, tone: 'lp', toneLo: 1100, toneHi: 8000, postLp: 7000, levelMaxDb: 6,
          modes: [{ preEq: [{ type: 'peak', f: 900, q: 0.8, db: 3 }] }, { clipHp: 900, preEq: [{ type: 'ls', f: 150, q: 0.7, db: -3 }] }, {}, { clip: 'mosfet', gainMaxDb: 44 }] } },
        { prefix: 'b', algo: 'boost', on: false, opts: { gainMaxDb: 20 }, params: { mode: 0, level: 1 } },
      ] },
      controls: [K('d.level', 'VOLUME', { def: 0.5, display: ten }), K('d.tone', 'TONE', { def: 0.5, display: ten }), K('d.gain', 'OVERDRIVE', { def: 0.45, display: ten }), K('b.gain', 'BOOST', { def: 0.35, display: ten }),
        TOG('voice', '', ['FM', 'CC', 'FLAT'], { virtual: true }), TOG('mos', '', ['STD', 'MOSFET'], { virtual: true }),
        FOOT({ label: 'ON' }), LED({ color: '#3d8bff' }), FOOT({ action: 'param', p: 'b.on', label: 'BOOST' }), LED({ bind: 'onparam:b.on', color: '#ff2a1a' })],
      derive: (p) => ({ 'd.mode': p.mos ? 3 : p.voice ?? 0 }),
      desc: 'Mid-push overdrive with a boost on its own switch. FM (flat mids), CC (comp cut) and FLAT set the voice; MOSFET adds headroom and grit.',
    }),
    FT({
      id: 'ft.fb3', name: 'Phat Boost 3', ref: 'Fulltone Fat-Boost FB-3', cat: 'Boost', typeName: 'Clean boost', color: '#d8b13a', text: '#1d1606',
      logo: 'PHAT BOOST', logoSize: 16, sub: 'CLEAN BOOST',
      algo: 'drive', opts: { clip: 'mosfet', preHp: 30, gainMinDb: 0, gainMaxDb: 26, tone: 'eq3', eqRangeDb: 10, bassF: 120, midF: 800, trebleF: 3000, postLp: 12000, cleanSum: true, cleanMix: 0.5, levelMaxDb: 10 },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.72, display: ten }), K('gain', 'DRIVE', { def: 0.3, display: ten }), K('treble', 'TONE', { def: 0.5, display: ten }), K('bass', 'BASS', { def: 0.5, display: ten })],
      desc: 'Fat, slightly warm boost that can add a little hair with DRIVE.',
    }),
    FT({
      id: 'ft.plimsoul', name: 'Plimsole', ref: 'Fulltone Plimsoul', cat: 'Overdrive', typeName: 'Overdrive / distortion', color: '#b5262a', text: '#fbeee6', plate: '#2a0a0a',
      logo: 'PLIMSOLE', logoSize: 18, sub: 'DRIVE',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 80, gainMinDb: 4, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 8000, levelMaxDb: 5,
        modes: [{ stages: 1 }, { stages: 2, stage2Db: 10 }] },
      fixed: { mid: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.45, display: ten }), K('gain', 'DRIVE', { def: 0.45, display: ten }), K('treble', 'TREBLE', { def: 0.5, display: ten }), K('bass', 'BASS', { def: 0.5, display: ten }),
        TOG('mode', '', ['SMOOTH', 'BITE'])],
      desc: 'Two drives in one: SMOOTH for creamy overdrive, BITE for a harder, distorted edge.',
    }),
    FT({
      id: 'ft.69', name: "'69 Fuzzbox", ref: "Fulltone '69 Fuzz MkII", cat: 'Fuzz', typeName: 'Germanium fuzz', color: '#3d6db3', text: '#f2f5fb', plate: '#0e1a2e',
      logo: "'69 FUZZBOX", logoSize: 17, sub: 'GERMANIUM',
      algo: 'drive', opts: { clip: 'ge', bias: 0.35, preHp: 60, gainMinDb: 12, gainMaxDb: 42, tone: 'lp', toneLo: 1500, toneHi: 7000, postLp: 6000, levelMaxDb: 0, outTrim: 0.55 },
      controls: [K('level', 'VOLUME', { def: 0.55, display: ten }), K('gain', 'FUZZ', { def: 0.7, display: ten }), K('tone', 'CONTOUR', { def: 0.6, display: ten })],
      desc: 'Fuzz Face style germanium fuzz that cleans up with the guitar volume. CONTOUR sets the top end.',
    }),
    FT({
      id: 'ft.octafuzz', name: 'Octa-Fuzz Two', ref: 'Fulltone Octafuzz OF-2', cat: 'Fuzz', typeName: 'Octave fuzz', color: '#c95a2a', text: '#fbf0e6', plate: '#2a1004', cost: 1,
      logo: 'OCTA-FUZZ', logoSize: 17, sub: 'OCTAVE FUZZ',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', preHp: 120, gainMinDb: 14, gainMaxDb: 42, tone: 'none', postLp: 6500, levelMaxDb: 0, outTrim: 0.7 } },
        { prefix: 'o', algo: 'pitch', params: { semis1: 12, level1: 0.6, dry: 0.85, quality: 0, tone: 0.8 } },
      ] },
      fixed: { 'o.semis1': 12, 'o.quality': 0 },
      controls: [K('f.level', 'VOLUME', { def: 0.5, display: ten }), K('f.gain', 'FUZZ', { def: 0.65, display: ten }), TOG('oct', '', ['FAT', 'OCTAVE'], { virtual: true, def: 1 })],
      initParams: { oct: 1 },
      derive: (p) => ({ 'o.on': p.oct === 0 ? 0 : 1 }),
      desc: 'Octavia-style octave-up fuzz. FAT turns the octave off for a thicker fuzz.',
    }),
    FT({
      id: 'ft.mdv', name: 'Mini Déjà Swirl', ref: "Fulltone Mini Deja'Vibe MDV-3", cat: 'Modulation', typeName: 'Uni-vibe', color: '#6b4a2a', text: '#f4e9da', plate: '#1e1208',
      logo: 'DÉJÀ SWIRL', logoSize: 16, sub: 'MINI VIBE',
      algo: 'vibe',
      ctrl: { ins: [{ label: 'EXP', param: 'speed', min: 0, max: 1 }] },
      controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('intensity', 'INTENSITY', { def: 0.7, display: ten }), K('speed', 'SPEED', { def: 0.4, display: ten }),
        TOG('mode', '', ['CHORUS', 'VIBRATO']), TOG('modern', '', ['VINTAGE', 'MODERN'], { virtual: true })],
      derive: (p) => ({ tone: p.modern ? 0.75 : 0.55, drive: p.modern ? 0.1 : 0.25 }),
      desc: 'Photocell vibe in chorus or vibrato mode. MODERN is brighter and cleaner. An expression pedal can set the speed.',
    }),
    FT({
      id: 'ft.supatrem', name: 'Super Trem', ref: 'Fulltone Supa-Trem ST-1', cat: 'Modulation', typeName: 'Tremolo', color: '#d8cfae', text: '#151515', plate: '#1a1a1a',
      logo: 'SUPER TREM', logoSize: 17, sub: 'TREMOLO',
      algo: 'tremolo',
      controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('rate', 'SPEED', { def: 0.4, display: ten }), K('depth', 'DEPTH', { def: 0.65, display: ten }), TOG('hard', '', ['SOFT', 'HARD'], { virtual: true })],
      derive: (p) => ({ wave: p.hard ? 0.95 : 0.3, mode: 0 }),
      desc: 'Amp-style tremolo with a soft or choppy hard wave.',
    }),
    def({
      id: 'ft.clyde', name: 'Clive Wah', ref: 'Fulltone Clyde Deluxe Wah', brand: 'Fulltone', code: 'CW', cat: 'Wah', form: 'treadle', color: '#1b1b1d', treadleColor: '#232326',
      algo: 'wah', opts: { mode: 0, fLo: 380, fHi: 2300, q: 5.5 }, fixed: { level: 0.38 },
      controls: [TREADLE('pos', { def: 0.5 }), TOG('voice', '', ['WAH', 'JIMI', 'SHAFT'], { x: 84, y: 283, orient: 'h', optSize: 4.2, virtual: true }), LED({ color: '#ff2a1a', r: 2.2, x: 52, y: 283 })],
      derive: (p) => [{ range: 0.5, q: 0.5 }, { range: 0.42, q: 0.62 }, { range: 0.6, q: 0.4 }][p.voice ?? 0],
      logo: 'Clive', logoColor: '#d8c08a', logoFont: "'Dancing Script', cursive", toeSwitch: true,
      desc: 'Vintage-style wah with three voicings: classic, darker and vocal, or wide and funky.',
    }),
  ]);
}
