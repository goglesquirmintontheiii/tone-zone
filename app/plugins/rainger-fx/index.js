// Built-in Tone Zone plugin: Rainger FX.
// Blocks inspired by Rainger FX's micro pedals. Names, logos and artwork are Tone Zone originals; control
// layouts, enclosure shapes and colours follow the real units (see each block's `ref`).
//
// "rainger" form: the tiny top-jacked boxes (no side sockets, Igor socket on the top panel).
//   finish: 'mirror' (polished chrome, carnival lid colours) | 'leather' (black leatherette paint) | 'paint'
//   Controls carry their own x / y (the boxes are too small for auto layout).
// "rainger-cup" screen: the Minibar's cup seen from above. Colour, fizz and froth come from the selected drink,
//   and a green "analysing" light glows under the fluid while you play.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SCREEN, def, ten, MONO } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern, haloFill, setA, setText } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('rgr-mirror')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const lg = (id, stops, o = {}) => {
      const gr = svg(o.radial ? 'radialGradient' : 'linearGradient', Object.assign({ id }, o.radial ? { cx: o.cx ?? 0.5, cy: o.cy ?? 0.5, r: o.r ?? 0.5 } : { x1: o.x1 ?? 0, y1: o.y1 ?? 0, x2: o.x2 ?? 0, y2: o.y2 ?? 1 }), d);
      for (const [off, col, op] of stops) svg('stop', { offset: off, 'stop-color': col, 'stop-opacity': op ?? 1 }, gr);
    };
    // polished mirror: hard reflections (sky / horizon / floor) like a chrome toy
    lg('rgr-mirror', [[0, '#f4f7fa'], [0.18, '#b9c2cc'], [0.34, '#fdfdfd'], [0.47, '#7d8792'], [0.52, '#3e454d'], [0.62, '#aab3bc'], [0.82, '#e8ecf0'], [1, '#8a939c']], { x2: 0.35, y2: 1 });
    lg('rgr-leather', [[0, '#2a2a2c'], [1, '#0d0d0e']]);
    lg('rgr-gloss', [[0, '#fff', 0.28], [0.2, '#fff', 0.04], [1, '#000', 0.25]]);
    lg('rgr-glass', [[0, '#ffffff', 0.55], [0.5, '#ffffff', 0.05], [1, '#ffffff', 0.25]], { x2: 1, y2: 1 });
    lg('rgr-glow', [[0, '#7dff6a', 0.95], [0.45, '#3ddc5a', 0.45], [1, '#3ddc5a', 0]], { radial: true });
    noisePattern(d, 'rgr-grain', 28, 56, [0, 0, 0], 0, 0.16, 1);
  }

  // ------------------------------------------------------------------ the cup screen
  // drink: [name, liquid colour, opacity 0..1, fizz 0..1, froth colour | null]
  const DRINKS = [
    ['WATER', '#bfe6ff', 0.25, 0, null],
    ['LAGER', '#f2b632', 0.8, 0.7, '#fff6dc'],
    ['STOUT', '#2a160c', 1, 0.25, '#efe0c0'],
    ['COLA', '#3b1a0e', 0.95, 0.9, '#b07a52'],
    ['COFFEE', '#2b1608', 1, 0, '#a8774a'],
    ['WHISKY', '#c8781e', 0.75, 0, null],
    ['RED WINE', '#6e0f22', 0.95, 0, null],
    ['ENERGY', '#c7f02e', 0.7, 0.85, '#f2ffd0'],
    ['G & T', '#e6f6f2', 0.3, 0.8, null],
    ['OLIVE OIL', '#9a9a1e', 0.85, 0, null],
  ];
  tz.addScreen('rainger-cup', {
    build(s, g, w, h) {
      const cx = w / 2, cy = h / 2 - 6, R = Math.min(w, h - 14) / 2 - 1;
      s.cx = cx; s.cy = cy; s.R = R;
      // screw-on lid ring
      svg('circle', { cx, cy, r: R, fill: s.ctl.lid || '#e2322b' }, g);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        svg('line', { x1: cx + Math.cos(a) * (R - 0.6), y1: cy + Math.sin(a) * (R - 0.6), x2: cx + Math.cos(a) * (R - 3), y2: cy + Math.sin(a) * (R - 3), stroke: '#000', 'stroke-opacity': 0.25, 'stroke-width': 0.8 }, g);
      }
      svg('circle', { cx, cy, r: R - 3.6, fill: '#1c2a30' }, g);
      // green "analysing" light under the fluid
      s.glow = svg('circle', { cx, cy: cy + R * 0.12, r: R * 0.8, fill: 'url(#rgr-glow)', 'fill-opacity': 0 }, g);
      // the liquid
      s.liq = svg('circle', { cx, cy, r: R - 4.6, fill: '#bfe6ff', 'fill-opacity': 0.5 }, g);
      s.froth = svg('circle', { cx, cy, r: R - 4.6, fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-opacity': 0, 'stroke-dasharray': '2 1.4' }, g);
      // two zinc contacts in the bottom
      s.contacts = [-1, 1].map((k) => svg('circle', { cx: cx + k * R * 0.3, cy: cy + R * 0.18, r: 2.3, fill: '#c7ccd2', stroke: '#6b737c', 'stroke-width': 0.6 }, g));
      s.bubbles = [];
      for (let i = 0; i < 9; i++) s.bubbles.push(svg('circle', { cx, cy, r: 0.8 + (i % 3) * 0.45, fill: '#fff', 'fill-opacity': 0 }, g));
      svg('circle', { cx, cy, r: R - 3.6, fill: 'url(#rgr-glass)' }, g);
      svg('path', { d: `M${cx - R * 0.55} ${cy - R * 0.45} A${R * 0.72} ${R * 0.72} 0 0 1 ${cx + R * 0.2} ${cy - R * 0.7}`, fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-opacity': 0.75, 'stroke-linecap': 'round' }, g);
      // chalkboard menu tag with the drink name
      svg('rect', { x: 3, y: h - 12, width: w - 6, height: 10, rx: 2, fill: '#1d2421', stroke: '#c9a46a', 'stroke-width': 0.8 }, g);
      s.name = svg('text', { x: cx, y: h - 6.6, fill: '#f6f1df', 'font-family': "'Share Tech Mono', monospace", 'font-size': 6.4, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 0.6 }, g, '');
      s.env = 0;
      s.last = -1;
    },
    update(s, st, nv, now) {
      const di = Math.max(0, Math.min(DRINKS.length - 1, (s.ui.drink ?? 1) | 0));
      const [nm, col, op, fizz, froth] = DRINKS[di];
      if (di !== s.last) {
        s.last = di;
        setA(s.liq, 'fill', col);
        setA(s.liq, 'fill-opacity', 0.35 + op * 0.6);
        setA(s.froth, 'stroke', froth || '#fff');
        setA(s.froth, 'stroke-opacity', froth ? 0.9 : 0);
        s.contacts.forEach((c) => setA(c, 'fill-opacity', 1 - op * 0.8));
        setText(s.name, nm);
      }
      const on = !nv.block.bypass;
      const m = st && st.m && st.m.meter && st.m.meter[0];
      const lvl = m ? Math.min(1, Math.sqrt(m[1]) * 3) : 0;
      s.env = Math.max(lvl, s.env * 0.88);
      setA(s.glow, 'fill-opacity', on ? (0.25 + 0.75 * s.env).toFixed(2) : 0);
      // fizz: bubbles drifting up through the glass (seeded positions, time animated)
      const t = now / 1000;
      s.bubbles.forEach((b, i) => {
        if (!fizz || i / s.bubbles.length > fizz) return setA(b, 'fill-opacity', 0);
        const ph = (t * (0.35 + (i % 4) * 0.12) + i * 0.37) % 1;
        const ang = i * 2.4;
        const rr = (s.R - 7) * (0.25 + ((i * 37) % 10) / 14);
        setA(b, 'cx', (s.cx + Math.cos(ang) * rr * (1 - ph * 0.3)).toFixed(1));
        setA(b, 'cy', (s.cy + Math.sin(ang) * rr * (1 - ph * 0.3)).toFixed(1));
        setA(b, 'fill-opacity', (0.75 * Math.sin(ph * Math.PI)).toFixed(2));
      });
    },
    pointer(s, nv, type) {
      if (type !== 'down') return;
      const cur = (s.ui && s.ui.drink) ?? 1;
      const nx = ((cur | 0) + 1) % DRINKS.length;
      tz.app.setParam(nv.block.id, 'drink', nx);
      tz.ui.toast(`Poured: ${DRINKS[nx][0].toLowerCase()}`, 'info', 1100);
    },
  });

  // ------------------------------------------------------------------ enclosure
  const BOX = { minibar: { w: 92, h: 190, rx: 7 }, micro: { w: 100, h: 196, rx: 6 }, dwarf: { w: 86, h: 166, rx: 6 } };
  tz.addForm('rainger', (ctx, d) => {
    ensureDefs();
    const B = BOX[d.box || 'micro'], w = B.w, h = B.h, rx = B.rx, g = ctx.g;
    const fin = d.finish || 'mirror';
    softShadow(g, { w, h, rx, dy: 12, blur: 8, opacity: 0.6 });
    if (fin === 'mirror') {
      svg('rect', { width: w, height: h, rx, fill: 'url(#rgr-mirror)' }, g);
      // carnival stripes on the top end + a lid-colour band
      const cols = d.stripes || ['#e2322b', '#ffd23f', '#2b8be2', '#3ddc84'];
      const sw = w / (cols.length * 2);
      // keep the slanted stripes inside the rounded body
      const cid = `rgr-clip-${d.box || 'micro'}`;
      const cp = svg('clipPath', { id: cid }, g);
      svg('rect', { width: w, height: h, rx }, cp);
      const sg = svg('g', { 'clip-path': `url(#${cid})` }, g);
      for (let i = 0; i < cols.length * 2 + 1; i++) svg('path', { d: `M${i * sw} 0 h${sw} l-6 16 h-${sw} Z`, fill: cols[i % cols.length], 'fill-opacity': 0.92 }, sg);
      svg('rect', { width: w, height: 16, rx, fill: 'url(#rgr-gloss)' }, g);
      svg('line', { x1: 0, y1: 16, x2: w, y2: 16, stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.8 }, g);
    } else if (fin === 'leather') {
      svg('rect', { width: w, height: h, rx, fill: 'url(#rgr-leather)' }, g);
      svg('rect', { width: w, height: h, rx, fill: 'url(#rgr-grain)' }, g);
      svg('rect', { width: w, height: h, rx, fill: 'url(#rgr-gloss)', 'fill-opacity': 0.5 }, g);
    } else {
      svg('rect', { width: w, height: h, rx, fill: d.color }, g);
      svg('rect', { width: w, height: h, rx, fill: 'url(#rgr-grain)', 'fill-opacity': 0.5 }, g);
      svg('rect', { width: w, height: h, rx, fill: 'url(#rgr-gloss)' }, g);
    }
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 }, g);
    const txt = d.text || '#14171a';
    // art: per-block extras
    if (d.art === 'bolts') {
      // Dr Fiend: stitched scar + neck bolts (the monster lives on the sloped top)
      svg('path', { d: `M${w - 30} 22 L${w - 10} 30`, stroke: '#7d8a6e', 'stroke-width': 1.2 }, g);
      for (let k = 0; k < 4; k++) svg('path', { d: `M${w - 27 + k * 5} ${21.5 + k * 2} l-1.4 4.6`, stroke: '#7d8a6e', 'stroke-width': 1 }, g);
      for (const x of [9, w - 9]) {
        svg('rect', { x: x - 4, y: 52, width: 8, height: 10, rx: 1.5, fill: '#9aa3ab', stroke: '#2b2f33', 'stroke-width': 0.6 }, g);
        svg('rect', { x: x - 2.4, y: 50, width: 4.8, height: 2, fill: '#c9d0d6' }, g);
      }
    }
    if (d.logo) {
      const t = label(g, w / 2, d.logoY ?? 30, d.logo, { size: d.logoSize || 12, fill: d.logoColor || txt, font: d.logoFont || "'Oswald', sans-serif", weight: 700, ls: d.logoLs ?? 1 });
      if (d.logoStroke) { t.setAttribute('stroke', d.logoStroke); t.setAttribute('stroke-width', 2.2); t.setAttribute('paint-order', 'stroke'); }
    }
    if (d.sub) label(g, w / 2, d.subY ?? (d.logoY ?? 30) + 10, d.sub, { size: 4.6, fill: d.subColor || txt, weight: 700, ls: 1.2 });
    for (const [x, y, t] of d.captions || []) label(g, x, y, t, { size: 5.4, fill: txt, weight: 700, ls: 0.6, font: "'Barlow Condensed', sans-serif" });
    label(g, w / 2, h - 7, 'TONE ZONE', { size: 4, fill: txt, weight: 800, ls: 1.2, opacity: 0.6 });
    const theme = { text: txt, labelSize: d.labelSize || 5.4, labelFont: "'Barlow Condensed', sans-serif", knob: 'mxr' };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ drinks → fuzz voicings (drive modes)
  // Rainger's rule of thumb: free ions (salt, carbonation, alcohol) = gain; opacity = darker band-pass.
  const bp = (f, db = 5, q = 0.8) => ({ type: 'peak', f, q, db });
  const DRINK_V = [
    { clip: 'ge', gainMinDb: 4, gainMaxDb: 22, postLp: 7500, preEq: [bp(1300, 7)], outTrim: 0.9 },                                  // water: treble-booster push
    { clip: 'si', gainMinDb: 14, gainMaxDb: 40, postLp: 6200, preEq: [bp(950, 5)], outTrim: 0.26 },                                 // lager
    { clip: 'si', gainMinDb: 14, gainMaxDb: 40, postLp: 2300, preEq: [bp(420, 6)], outTrim: 0.28 },                                  // stout
    { clip: 'muff', stages: 2, stage2Db: 14, gainMinDb: 16, gainMaxDb: 46, postLp: 3000, preEq: [bp(600, 4)], outTrim: 0.22 },       // cola
    { clip: 'jfet', gainMinDb: 6, gainMaxDb: 26, postLp: 2100, preEq: [bp(500, 3)], outTrim: 1.4 },                                  // coffee
    { clip: 'ge', stages: 2, stage2Db: 10, bias: 0.3, gainMinDb: 18, gainMaxDb: 48, postLp: 5200, preEq: [bp(800, 3)], outTrim: 0.28 }, // whisky: thick Fuzz-Face gain
    { clip: 'asym', bias: 0.2, gainMinDb: 12, gainMaxDb: 38, postLp: 3600, preEq: [bp(700, 5)], outTrim: 0.38 },                    // red wine
    { clip: 'si', stages: 2, stage2Db: 16, gainMinDb: 20, gainMaxDb: 52, postLp: 8000, preEq: [bp(1500, 6)], outTrim: 0.21 },         // energy drink: ragged burn
    { clip: 'si', stages: 2, stage2Db: 12, gainMinDb: 18, gainMaxDb: 48, postLp: 9000, preEq: [bp(1800, 4)], outTrim: 0.21 },         // G&T
    { clip: 'ge', gainMinDb: -6, gainMaxDb: 4, postLp: 1800, preEq: [bp(300, 2)], outTrim: 0.76 },                                   // olive oil: (almost) no ions
  ];
  const DRINK_GAIN = [0.4, 0.55, 0.6, 0.65, 0.4, 0.7, 0.55, 0.8, 0.75, 0.3];

  tz.addDefs([
    def({
      id: 'rainger.minibar', name: 'Happy Hour Analyser', code: 'HAPPY HOUR', ref: 'Rainger FX Minibar Liquid Analyser', brand: 'Rainger FX',
      cat: 'Fuzz', typeName: 'Liquid analyser fuzz', form: 'rainger', box: 'minibar', finish: 'mirror', color: '#c9d0d6', cost: 0.6,
      tags: ['liquid', 'drink', 'beer', 'novelty', 'conductivity'],
      captions: [[46, 149, 'VOLUME']], logo: 'HAPPY HOUR', logoY: 102, logoSize: 12, logoLs: 1.4, sub: 'LIQUID ANALYSER', subY: 112,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'm', algo: 'meter' },
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', preHp: 90, tone: 'none', levelMinDb: -30, levelMaxDb: 6, modes: DRINK_V } },
      ] },
      controls: [
        SCREEN('rainger-cup', { x: 46, y: 54, w: 60, h: 66, bg: 'transparent', bezel: 'transparent', interactive: true, lid: '#e2322b' }),
        SEL('drink', 'DRINK', DRINKS.map((x) => x[0]), { def: 1, virtual: true, hidden: true }),
        K('f.level', 'VOLUME', { x: 46, y: 134, r: 9, def: 0.62, style: 'red', labelPos: 'none', display: ten }),
        FOOT({ x: 46, y: 168, r: 9 }),
        LED({ x: 20, y: 134, r: 2.2, color: '#3ddc5a' }),
      ],
      derive: (u) => {
        const di = Math.max(0, Math.min(DRINKS.length - 1, (u.drink ?? 1) | 0));
        return { 'f.mode': di, 'f.gain': DRINK_GAIN[di] };
      },
      desc: 'No gain or tone knob: the drink in the cup is the circuit. Click the cup (or pick DRINK in the inspector) to pour something else. Water gives a treble boost, beer and cola fizz into fuzz, whisky is thick fuzz, dark drinks sound darker and olive oil barely passes any signal.',
    }),
    def({
      id: 'rainger.reverbx', name: 'Reverb-Z', code: 'REVERB-Z', ref: 'Rainger FX Reverb-X', brand: 'Rainger FX',
      cat: 'Reverb', typeName: 'Distorting micro reverb', form: 'rainger', box: 'micro', finish: 'paint', color: '#e9e4d4', text: '#1b1d22', cost: 1.6,
      logo: 'REVERB-Z', logoY: 140, logoSize: 15, logoLs: 1.2, logoFont: "'Inter', sans-serif", sub: 'W/ PRESSURE PAD', subY: 151,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'i', algo: 'boost', opts: { gainMinDb: -12, gainMaxDb: 12 }, params: { gain: 0.5 } },
        { prefix: 'm', algo: 'meter' },
        { prefix: 'g', algo: 'gate', on: false, params: { threshold: 0.1, decay: 0.4 } },
        { prefix: 'd', algo: 'utility', opts: { kind: 'gain' }, group: 1 },
        { prefix: 'w', algo: 'chain', group: 1, opts: { chain: [
          { prefix: 's', algo: 'utility', opts: { kind: 'gain' } },
          { prefix: 'v', algo: 'reverb', opts: { mode: 1 }, params: { mix: 1, mode: 1 } },
          { prefix: 'c', algo: 'utility', opts: { kind: 'gain' }, group: 1 },
          { prefix: 'z', algo: 'drive', group: 1, opts: { clip: 'si', stages: 2, stage2Db: 12, gainMinDb: 20, gainMaxDb: 40, tone: 'none', postLp: 5000, preHp: 200, levelMaxDb: 0 }, params: { gain: 0.6, level: 0.45 } },
        ] } },
        { prefix: 'h', algo: 'gate', on: false, params: { threshold: 0.3, decay: 0.55 } },
        { prefix: 'o', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      controls: [
        K('lvl', 'LVL', { x: 22, y: 34, r: 8, def: 0.45, virtual: true }), K('size', 'SIZE', { x: 50, y: 34, r: 8, def: 0.5, virtual: true }), K('distn', 'DISTN', { x: 78, y: 34, r: 8, def: 0.2, virtual: true }),
        K('i.gain', 'INPT', { x: 32, y: 72, r: 8, def: 0.5 }), K('o.level', 'OUT', { x: 68, y: 72, r: 8, min: -24, max: 12, def: 0, display: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' }),
        TOG('dark', 'DARK', ['OFF', 'ON'], { x: 30, y: 116, virtual: true, orient: 'h' }), TOG('gate', 'GATE', ['PRE', 'POST'], { x: 70, y: 116, virtual: true, orient: 'h' }),
        LED({ x: 50, y: 72, r: 1.8, bind: 'fn', sub: 'm', color: '#ff2a1a', ledFn: (ui, b, st) => (st && st.meter && st.meter[0] && st.meter[0][0] > 0.8 ? '#ff2a1a' : null) }),
        FOOT({ x: 50, y: 172, r: 10 }), LED({ x: 82, y: 172, r: 3.4, color: '#3ddc5a' }),
      ],
      ctrl: { ins: [{ label: 'IGOR', param: 'igor', min: 0, max: 1 }] },
      initParams: { igor: 1 },
      derive: (u) => {
        const lvl = u.lvl ?? 0.45, dist = u.distn ?? 0.2, size = u.size ?? 0.5, dark = !!u.dark, igor = u.igor ?? 1;
        const send = igor < 0.02 ? -60 : 20 * Math.log10(igor);
        // parallel lanes are normalised by the number of active lanes (2): dry lane at 2 = unity
        const o = { 'g.on': u.gate ? 0 : 1, 'h.on': u.gate ? 1 : 0, 'd.lvl': 2, 'w.lvl': Math.min(2, lvl * 2), 'w.c.lvl': 2 * (1 - dist), 'w.z.lvl': 2 * dist };
        Object.assign(o, { 'w.s.level': send, 'w.v.decay': 0.2 + size * 0.78, 'w.v.size': 0.3 + size * 0.7, 'w.v.tone': dark ? 0.3 : 0.75, 'w.v.predelay': dark ? 60 : 5 });
        return o;
      },
      desc: 'Tiny reverb where DISTN distorts only the reverb, not the dry sound. The red LED shows input overload, DARK adds pre-delay and darkens it, and GATE can sit before or after the effect. An IGOR pressure pad switches the reverb in while pressed.',
    }),
    def({
      id: 'rainger.dwarf', name: "Dr. Fiendstein's Imp", code: 'IMP', ref: "Rainger FX Dr. Freakenstein's Dwarf", brand: 'Rainger FX',
      cat: 'Fuzz', typeName: 'Overtone fuzz', form: 'rainger', box: 'dwarf', finish: 'leather', text: '#cfe7b0', art: 'bolts', cost: 2.2,
      logo: 'FIENDSTEIN', logoY: 112, logoSize: 12, logoColor: '#a8e06a', logoLs: 1.2, sub: 'IMP · OVERTONE FUZZ', subY: 122, subColor: '#cfe7b0',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'g', algo: 'gate', params: { threshold: 0.25, decay: 0.3 } },
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 14, bias: 0.15, preHp: 80, gainMinDb: 24, gainMaxDb: 50, tone: 'none', postLp: 7000, levelMinDb: -40, levelMaxDb: -10, modes: [{}, { clip: 'ge', bias: 0.4, stage2Db: 18, postLp: 4500 }] }, params: { gain: 0.65 } },
        { prefix: 'o', algo: 'pitch', params: { semis1: -12, level1: 0, dry: 1, level2: 0, level3: 0 } },
        { prefix: 'e', algo: 'peq', params: { mid1q: 4, mid1gain: 10, mid2gain: 0 } },
      ] },
      controls: [
        K('tone', 'TONE', { x: 43, y: 40, r: 15, def: 0.5, virtual: true, style: 'chrome' }),
        K('f.level', 'VOL', { x: 68, y: 86, r: 7, def: 0.55, display: ten }),
        BTN('HI/LO', { p: 'lo', toggle: true, virtual: true, x: 18, y: 86, r: 5, led: true, ledColor: '#ff2a1a' }),
        FOOT({ x: 43, y: 142, r: 10 }), LED({ x: 43, y: 86, r: 2.4, color: '#7dff6a' }),
      ],
      ctrl: { ins: [{ label: 'IGOR', param: 'tone', min: 0, max: 1 }] },
      derive: (u) => {
        const t = u.tone ?? 0.5, lo = !!u.lo;
        return {
          'f.mode': lo ? 1 : 0, 'e.mid1freq': Math.round(180 * Math.pow(2, t * 4.3)), 'e.mid1gain': lo ? 7 : 11,
          'o.on': lo && t > 0.45 ? 1 : 0, 'o.level1': lo ? Math.min(0.8, (t - 0.45) * 1.6) : 0,
        };
      },
      desc: 'Gated fuzz with a resonant "overtone" whose pitch follows the big TONE knob (or the IGOR pressure pad). HI/LO picks the flavour: LO is woollier and adds a lower octave at higher TONE settings. The noise gate is always on.',
    }),
  ]);
}
