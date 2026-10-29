// Built-in Tone Zone plugin: Vox.
// Blocks inspired by Vox gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, preampOf, marshallKnobs, fenderKnobs } = tz.builders;
  // ---- amp helpers (same pattern in every amp-brand plugin)
  // ampFit: explicit panel layout so mini toggles never collide with the knob row / power LED.
  // AMPX: amp + matching rack preamp; controls named 'r.*' / 't.*' add an onboard spring reverb / tremolo (chain).
  const isFx = (c) => typeof c.p === 'string' && /^[rt]\./.test(c.p);
  function ampFit(a) {
    const tg = a.controls.filter((c) => c.t === 'toggle' && c.x === undefined);
    if (!tg.length) return a;
    const kn = a.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && !c.hidden);
    const tgW = 34 * tg.length + 6, pads = Math.ceil(tgW / 44);
    for (let i = 0; i < pads; i++) a.controls.push({ t: 'knob', hidden: true });
    const w = Math.max(420, 70 + (kn.length + pads) * 44 + 90), y = (a.combo ? 14 : 104) + 43, x0 = 76, x1 = w - 86 - tgW;
    kn.forEach((c, i) => Object.assign(c, { x: kn.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (kn.length - 1), y }));
    tg.forEach((t, i) => Object.assign(t, { x: x1 + 40 + i * 34, y: y + 1, orient: 'v', optSize: 4.6 }));
    return a;
  }
  function AMPX(o) {
    const a = ampFit(AMP(o));
    const pre = preampOf(Object.assign({}, a, { controls: a.controls.filter((c) => !isFx(c)) }));
    const sw = a.controls.filter((c) => (c.t === 'toggle' || c.t === 'sel') && !isFx(c)).map((c) => SEL(c.p, c.label, c.options, { values: c.values, def: c.def ?? 0, virtual: c.virtual, sweep: c.options.length > 2 ? 90 : 60, optSize: 4.2 }));
    const pc = pre.controls.filter((c) => !(c.t === 'knob' && !c.p));
    const li = pc.findIndex((c) => c.p === 'level');
    pc.splice(li, 0, ...sw);
    pre.controls = pc;
    if (o.derive) pre.derive = o.derive;
    if (o.preFixed) pre.fixed = o.preFixed;
    if (a.controls.some(isFx)) {
      const hasT = a.controls.some((c) => c.p && c.p.startsWith('t.')), hasR = a.controls.some((c) => c.p && c.p.startsWith('r.'));
      const chain = [{ prefix: 'a', algo: 'amp', opts: a.opts }];
      if (hasT) chain.push({ prefix: 't', algo: 'tremolo', params: Object.assign({ mode: 0, depth: 0, rate: 0.45, wave: 0.25 }, o.trem) });
      if (hasR) chain.push({ prefix: 'r', algo: 'reverb', params: Object.assign({ mode: 3, decay: 0.45, mix: 0.2, tone: 0.55, lowcut: 0.2 }, o.verb) });
      a.algo = 'chain';
      a.opts = { chain };
      a.cost = 3.2;
      a.controls = a.controls.map((c) => (c.p && !isFx(c) ? Object.assign({}, c, { p: 'a.' + c.p }) : c));
      if (a.fixed) a.fixed = Object.fromEntries(Object.entries(a.fixed).map(([kk, v]) => ['a.' + kk, v]));
      const dv = o.derive;
      a.derive = (u) => {
        const out = {};
        if (dv) {
          const plain = {};
          for (const kk in u) plain[kk.startsWith('a.') ? kk.slice(2) : kk] = u[kk];
          const r = dv(plain);
          for (const kk in r) out['a.' + kk] = r[kk];
        }
        if (hasT) out['t.on'] = (u['t.depth'] ?? 0) > 0.01 ? 1 : 0;
        if (hasR) out['r.on'] = (u['r.mix'] ?? 0) > 0.004 ? 1 : 0;
        return out;
      };
    }
    return [a, pre];
  }
  const fk = (p, label, o = {}) => k(p, label, Object.assign({ scale: 10, style: 'fender' }, o));
  tz.addDefs([
    preampPair(AMP({ id: 'amp.ac30', name: 'Brit 30 Top Boost', ref: 'Vox AC30 Top Boost', opts: { model: 'ac30' }, combo: true, speakers: 2, tolex: '#1a1a1a', panel: '#7a4a2a', panelText: '#f1e3c8', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', logoPlate: '#1a1a1a', knob: 'vox', piping: '#c9b37a',
      controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] })),
    CAB({ id: 'cab.2x12blue', name: '2x12 Brit Blue', ref: 'Vox AC30 2x12 Alnico Blue', opts: { model: '2x12blue' }, cabSize: '2x12', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", piping: '#c9b37a' }),

    // ---------------- v0.2
    AMPX({ id: 'vox.amp-ac15', name: 'Brit 15 Top Boost', ref: 'Vox AC15C1', combo: true, speakers: 1, tolex: '#1a1a1a', panel: '#7a4a2a', panelText: '#f1e3c8', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', logoPlate: '#1a1a1a', knob: 'vox', piping: '#c9b37a',
      opts: { voice: { base: 'ac30', stages: [[40, 1.35, 0.22, 11500, 30], [30, 1.25, 0.26, 9500, 65]], pwrH: 1.0, sag: 0.45, otLp: 8500, otHp: 85, presHz: 4500 } },
      controls: [k('gain', 'VOLUME', { def: 0.5 }), k('treble', 'TREBLE', { def: 0.55 }), k('bass', 'BASS'), k('r.mix', 'REVERB', { def: 0.15 }), k('t.rate', 'SPEED', { def: 0.4 }), k('t.depth', 'DEPTH', { def: 0 }), k('presence', 'TONE CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })],
      trem: { mode: 1 }, desc: 'Two-EL84 class-A chime with Top Boost EQ, reverb and tremolo.' }),
    AMPX({ id: 'vox.amp-nighttrain', name: 'Late Express 15', ref: 'Vox Night Train NT15H', tolex: '#aeb3b9', panel: '#1b1b1c', panelText: '#e8e8e8', grille: 'silver', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f4f4f4', logoPlate: '#1b1b1c', knob: 'chrome', corners: false, piping: '#d9dde2',
      opts: { models: [
        { base: 'ac30', stages: [[42, 1.35, 0.24, 11000, 35], [32, 1.25, 0.28, 9000, 70]], tsType: 0, stack: 'vox', pwrH: 1.2, sag: 0.4, otLp: 8000 },
        { base: 'jcm800', stages: [[46, 1.4, 0.3, 10500, 50], [40, 1.15, 0.35, 8000, 130], [30, 1.2, 0.32, 7200, 100]], stack: 'marshall', power: 2, pwrH: 1.3, sag: 0.4, otLp: 7200, presHz: 4200, nfb: 0 },
      ] },
      controls: [k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.55 }), TOG('channel', 'CHANNEL', ['PURE', 'GIRTH']), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Chrome-caged EL84 lunchbox: Pure chime or the thicker, hotter Girth channel.' }),
    CAB({ id: 'vox.cab-ac15', name: '1x12 Brit 15', ref: 'Vox AC15 1x12 (Greenback)', opts: { cab: { hp: 95, hpQ: 1.0, resDb: 2.5, lp: 5600, open: true, peaks: [[850, 1, 1.5], [2200, 1.3, 3.5], [3800, 2, 2]], seed: 41 } }, cabSize: '1x12', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', piping: '#c9b37a' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Classic wah and fuzz plus the Nutube-powered drive series.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, TREADLE, def, ten } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;

  // small box with a window showing the glowing twin-triode
  tz.addForm('vox-valve', (ctx, d) => {
    const g = ctx.g, w = 150, h = 236, txt = d.text || '#f0ece4';
    formKit.body(g, w, h, d.color, { rx: 8, brushed: true });
    const mine = (c) => c.x === undefined || c._fa;
    const kn = d.controls.filter((c) => c.t === 'knob' && mine(c));
    kn.forEach((c, i) => Object.assign(c, { _fa: 1, x: i < 3 ? 30 + i * 45 : 52 + (i - 3) * 46, y: i < 3 ? 30 : 72, r: 11, labelPos: 'below', labelSize: 5.2 }));
    const wy = 104;
    svg('rect', { x: 38, y: wy, width: 74, height: 26, rx: 4, fill: '#060807', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 44, y: wy + 7, width: 62, height: 12, rx: 2, fill: '#103a2a' }, g);
    for (let i = 0; i < 5; i++) svg('rect', { x: 48 + i * 11, y: wy + 9, width: 7, height: 8, rx: 1, fill: '#3dffb0', 'fill-opacity': 0.55 }, g);
    const tg = d.controls.filter((c) => c.t === 'toggle' && mine(c));
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: [16, w - 16][i], y: wy + 13, orient: 'v', optSize: 4, labelSide: i ? 'left' : undefined }));
    label(g, w / 2, 150, d.logo || d.name, { size: 14, fill: d.logoColor || txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, 162, (d.typeName || d.cat).toUpperCase(), { size: 5, fill: txt, weight: 700, ls: 1.6, opacity: 0.8 });
    d.controls.forEach((c) => {
      if (c.t === 'led' && mine(c)) Object.assign(c, { _fa: 1, x: w / 2, y: 176, r: 3 });
      if (c.t === 'foot' && mine(c)) Object.assign(c, { _fa: 1, style: 'stomp', x: w / 2, y: 204, r: 13 });
    });
    formKit.tzBadge(g, w / 2, h - 7, txt, 3.8);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: 5.2 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 150, gap: 26, flip: ctx.flip }) };
  });

  // plain stomp box for this brand: knob rows (optionally on a dark plate), toggles, logo, LED, footswitch.
  // Jacks sit below the controls so their labels never cover a knob.
  tz.addForm('vox-stomp', (ctx, d) => {
    const { svg, label, formKit, shade } = tz.gfx;
    const g = ctx.g;
    const mine = (c) => c.x === undefined || c._fa;
    const kn = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && mine(c));
    const tg = d.controls.filter((c) => c.t === 'toggle' && mine(c));
    const foots = d.controls.filter((c) => c.t === 'foot' && mine(c));
    const leds = d.controls.filter((c) => c.t === 'led' && mine(c));
    const n = kn.length;
    const perRow = d.perRow || (n === 4 ? 4 : Math.min(3, n));
    const w = d.fw || (perRow > 3 || foots.length > 1 ? 176 : 140);
    const rows = [];
    for (let i = 0; i < n; i += perRow) rows.push(kn.slice(i, i + perRow));
    const jt = d.jacksTop ? 8 : 0;
    const deckH = d.deckH || 20 + jt + rows.length * 44 + (tg.length ? 32 : 0);
    const ly = deckH + 36, h = ly + 106;
    const txt = d.text || '#f0f0f0';
    formKit.body(g, w, h, d.color, { rx: d.rx ?? 9, brushed: !!d.brushed });
    if (d.plate) svg('rect', { x: 8, y: 8, width: w - 16, height: deckH, rx: 6, fill: d.plate, stroke: shade(d.plate, 0.3), 'stroke-opacity': 0.5 }, g);
    if (d.accent) svg('rect', { x: 8, y: deckH + 12, width: w - 16, height: 2.5, rx: 1.2, fill: d.accent }, g);
    const big = n <= 2;
    rows.forEach((r, ri) => {
      const x0 = 30, x1 = w - 30, step = perRow > 1 ? (x1 - x0) / (perRow - 1) : 0;
      const off = ((perRow - r.length) * step) / 2;
      r.forEach((c, i) => Object.assign(c, { _fa: 1, x: perRow === 1 ? w / 2 : x0 + off + i * step, y: 38 + jt + ri * 44, r: big ? 13 : 11, labelPos: 'above', labelSize: 5.4 }));
    });
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: tg.length === 1 ? w / 2 : 32 + (i * (w - 64)) / (tg.length - 1), y: 20 + jt + rows.length * 44 + 10, orient: 'h', optSize: 4.2 }));
    if (d.art) d.art(g, w, h, ly);
    const logo = d.logo || d.name;
    label(g, w / 2, ly, logo, { size: d.logoSize || (logo.length > 12 ? 11.5 : 14), fill: d.logoColor || txt, font: d.logoFont || "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    label(g, w / 2, ly + 12, (d.typeName || d.cat).toUpperCase(), { size: 5, fill: txt, weight: 700, ls: 1.6, opacity: 0.75 });
    const spots = (k) => (k > 1 ? [w * 0.28, w * 0.72] : [w / 2]);
    const lx = spots(leds.length), fx = spots(foots.length);
    leds.forEach((l, i) => Object.assign(l, { _fa: 1, x: lx[i], y: ly + 26, r: 3 }));
    foots.forEach((f, i) => Object.assign(f, { _fa: 1, style: 'stomp', x: fx[i], y: ly + 64, r: 13, labelDy: foots.length > 1 ? -19 : undefined }));
    formKit.tzBadge(g, w / 2, h - 8, txt, 3.8);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls, theme);
    const jacks = d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { y0: deckH + 42, gap: 24, flip: ctx.flip });
    return { w, h, theme, jacks };
  });
  const VS = (o) => def(Object.assign({ form: 'vox-stomp' }, o, { controls: [...o.controls, FOOT(), LED({ color: o.led || '#ff2a1a' })] }));

  // Nutube drive: drive stage, optional cab sim so the output can go straight to a desk
  const NU = (o) => def(Object.assign({ form: 'vox-valve', algo: 'chain', cost: 1.4, ports: { ins: ['INPUT'], outs: ['OUTPUT'] } }, o, {
    opts: { chain: [{ prefix: 'd', algo: 'drive', opts: o.voice }, { prefix: 'c', algo: 'cab', on: false, opts: { model: o.cab || '2x12blue' } }] },
    controls: [K('d.gain', 'GAIN', { display: ten, def: 0.5 }), K('d.treble', 'TREBLE', { display: ten }), K('d.mid', 'MIDDLE', { display: ten }), K('d.bass', 'BASS', { display: ten }), K('d.level', 'VOLUME', { display: ten }),
      TOG('d.mode', 'VOICE', ['A', 'B']), TOG('c.on', 'CAB', ['OFF', 'ON']), FOOT(), LED({ color: '#3dffb0' })],
  }));
  const eq = { tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200 };

  tz.addDefs([
    def({ id: 'vox.v847', name: 'Vixen Wah', ref: 'Vox V847 Wah-Wah', code: 'VX-47', logo: 'Vixen', logoColor: '#1a1a1a', logoFont: "'Dancing Script', cursive", cat: 'Wah', form: 'treadle', color: '#1b1b1d', treadleColor: '#c9ccd1',
      algo: 'wah', opts: { fLo: 420, fHi: 2300, q: 4.2, mode: 0 }, fixed: { level: 0.45 },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 })], toeSwitch: true,
      desc: 'The classic Italian-style wah: vocal, slightly wider sweep. Drag the treadle; click it to switch on or off.' }),
    NU({ id: 'vox.mysticedge', name: 'Mystic Crest', ref: 'Vox Valvenergy Mystic Edge', logo: 'MYSTIC CREST', typeName: 'Nutube Drive', cat: 'Overdrive', color: '#5a1f22', logoColor: '#e8d7a8', cab: '2x12blue',
      voice: Object.assign({ clip: 'tube', bias: 0.15, preHp: 90, gainMinDb: 4, gainMaxDb: 36, postLp: 9000, levelMaxDb: 2, modes: [{}, { preEq: [{ type: 'hs', f: 2500, q: 0.7, db: 4 }] }] }, eq),
      desc: 'Chimey top-boost crunch from a real twin-triode. Cab sim lets it go straight to a desk.' }),
    NU({ id: 'vox.copperhead', name: 'Copper Viper', ref: 'Vox Valvenergy Copperhead Drive', logo: 'COPPER VIPER', typeName: 'Nutube Drive', cat: 'Distortion', color: '#8a4a26', logoColor: '#f6e2c4', cab: '4x12gb',
      voice: Object.assign({ clip: 'tube', stages: 2, stage2Db: 6, bias: 0.2, preHp: 90, gainMinDb: 8, gainMaxDb: 42, postLp: 8000, levelMaxDb: -1, modes: [{}, { preEq: [{ type: 'peak', f: 800, q: 0.7, db: 4 }] }] }, eq),
      desc: 'Classic rock stack drive with real valve feel. Cab sim for direct recording.' }),
    NU({ id: 'vox.silkdrive', name: 'Satin Drive', ref: 'Vox Valvenergy Silk Drive', logo: 'SATIN DRIVE', typeName: 'Nutube Drive', cat: 'Overdrive', color: '#3b3f46', logoColor: '#d8dce2', cab: '1x12open',
      voice: Object.assign({ clip: 'tube', bias: 0.1, preHp: 70, gainMinDb: 4, gainMaxDb: 38, postLp: 8500, levelMaxDb: 2, modes: [{}, { preEq: [{ type: 'peak', f: 1200, q: 0.7, db: 3 }] }] }, eq),
      desc: 'Smooth, singing boutique-amp overdrive with real valve compression.' }),
    NU({ id: 'vox.cuttingedge', name: 'Razor Crest', ref: 'Vox Valvenergy Cutting Edge', logo: 'RAZOR CREST', typeName: 'Nutube Drive', cat: 'Distortion', color: '#1e1f22', logoColor: '#ff5a3a', cab: '4x12v30',
      voice: Object.assign({ clip: 'diode', stages: 3, stage2Db: 8, bias: 0.15, preHp: 130, gainMinDb: 12, gainMaxDb: 50, postLp: 7200, levelMaxDb: -4, modes: [{}, { preHp: 200 }] }, eq),
      desc: 'Modern high-gain distortion, tight and aggressive, with a cab sim output.' }),
    VS({ id: 'vox.ice9', name: 'Frost 9 Overdrive', ref: 'Vox Ice 9 Overdrive', logo: 'FROST 9', typeName: 'Overdrive', cat: 'Overdrive', color: '#2f5f9a', text: '#eef3fa', knob: 'chrome', led: '#3d8bff',
      algo: 'drive', opts: { clip: 'asym', bias: 0.15, preHp: 80, gainMinDb: 4, gainMaxDb: 38, tone: 'lp', toneLo: 1400, toneHi: 10000, postLp: 9000, levelMaxDb: 6, modes: [{}, { gainMaxDb: 46, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 3 }] }] },
      controls: [K('level', 'VOLUME', { display: ten }), K('tone', 'TONE', { display: ten }), K('gain', 'DRIVE', { display: ten, def: 0.5 }), TOG('mode', 'GAIN', ['STD', 'MORE'])],
      desc: 'Smooth, mid-rich lead overdrive with a switch for extra gain.' }),
    VS({ id: 'vox.tonebender', name: 'Tone Twister', ref: 'Vox V828 Tone Bender', logo: 'TONE TWISTER', typeName: 'Fuzz', cat: 'Fuzz', color: '#8c9096', text: '#141414', knob: 'chicken',
      algo: 'drive', opts: { clip: 'ge', bias: 0.3, preHp: 80, gainMinDb: 18, gainMaxDb: 44, tone: 'none', postLp: 6000, levelMaxDb: -2 },
      controls: [K('gain', 'ATTACK', { display: ten, def: 0.7 }), K('level', 'LEVEL', { display: ten })],
      desc: 'Late-60s germanium fuzz: raw, thick and cleans up with the guitar volume.' }),
  ]);
}
