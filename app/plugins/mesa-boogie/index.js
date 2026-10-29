// Built-in Tone Zone plugin: Mesa/Boogie.
// Blocks inspired by Mesa/Boogie gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.recto', name: 'Cali Rectifire', ref: 'Mesa/Boogie Dual Rectifier', opts: { models: ['recto_clean', 'recto'] }, tolex: '#151515', panel: '#b9bec5', panelText: '#111', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', knob: 'mesa',
      controls: [k('gain', 'GAIN'), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CH', ['CLEAN', 'MODERN'], { def: 1 })] })),
    preampPair(AMP({ id: 'amp.markiic', name: 'Cali Mark IIC', ref: 'Mesa/Boogie Mark IIC+', opts: { model: 'markiic' }, combo: true, speakers: 1, tolex: '#2a2016', panel: '#151515', panelText: '#e8e8e8', grille: 'black', logo: 'Boogaloo', logoColor: '#e0c890', knob: 'mesa',
      controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('master', 'MASTER'), k('presence', 'PRESENCE')] })),
    CAB({ id: 'cab.4x12v30', name: '4x12 Cali V30', ref: 'Mesa Rectifier 4x12 V30', opts: { model: '4x12v30' }, cabSize: '4x12', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),

    // ---------------- v0.2
    AMPX({ id: 'mesa.amp-markv', name: 'Cali Mark Five', ref: 'Mesa/Boogie Mark V', tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'black', logo: 'Boogaloo', logoColor: '#e0c890', knob: 'mesa', piping: '#3a3a3a',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.2, 12500, 20], [28, 1.8, 0.2, 10000, 30]], stack: 'mesa', pwrH: 3.2, sag: 0.25, otLp: 7600 },
        { base: 'markiic', stages: [[40, 1.5, 0.25, 11000, 30], [38, 1.25, 0.33, 8500, 110], [30, 1.2, 0.33, 7200, 90]], gainPos: 1, tsPos: 1, pwrH: 2.5, sag: 0.3, otLp: 7000 },
        { base: 'markiic', drive: 1.1, tight: 0.35, otLp: 6600, presHz: 3600 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('master', 'MASTER'), k('treble', 'TREBLE', { def: 0.65 }), k('mid', 'MID', { def: 0.35 }), k('bass', 'BASS', { def: 0.4 }), k('presence', 'PRESENCE'), SEL('channel', 'CHANNEL', ['CH 1', 'CH 2', 'CH 3'], { def: 2, sweep: 90, optSize: 4.2 })],
      desc: 'Three channels with the cascading Mark lead (IIC+ mode on channel 3).' }),
    AMPX({ id: 'mesa.amp-triplecrown', name: 'Cali Triple Throne', ref: 'Mesa/Boogie Triple Crown TC-50', tolex: '#141414', panel: '#121212', panelText: '#d8b65e', grille: 'black', logo: 'Triple Throne', logoFont: "'Oswald', sans-serif", logoSize: 20, logoColor: '#d8b65e', knob: 'mesa', piping: '#8a7340',
      opts: { models: [
        { base: 'recto_clean', stages: [[35, 1.7, 0.2, 12000, 25], [28, 1.8, 0.2, 9500, 35]], stack: 'mesa', pwrH: 2.4, sag: 0.3, otLp: 7300 },
        { base: 'jcm800', stages: [[46, 1.45, 0.3, 10500, 50], [42, 1.15, 0.35, 8000, 140], [32, 1.2, 0.33, 7000, 110]], stack: 'mesa', pwrH: 2.0, sag: 0.35, otLp: 6600, tight: 0.25 },
        { base: 'recto', drive: 1.05, stack: 'mesa', tight: 0.45, sag: 0.35, otLp: 6400, presHz: 3700 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('master', 'MASTER'), SEL('channel', 'CHANNEL', ['1', '2', '3'], { def: 2, sweep: 90, optSize: 4.4 })],
      desc: 'EL34 three-channel head: modern, tight and articulate.' }),
    AMPX({ id: 'mesa.amp-lonestar', name: 'Cali Lone Ranger', ref: 'Mesa/Boogie Lonestar Classic', combo: true, speakers: 1, tolex: '#151515', panel: '#e6decb', panelText: '#1a1a1a', grille: 'wheat', logo: 'Lone Ranger', logoColor: '#2a1d10', knob: 'mesa', piping: '#e6decb',
      opts: { models: [
        { base: 'deluxe', stages: [[35, 1.7, 0.18, 12000, 22], [30, 1.8, 0.2, 9500, 32]], brightDb: 5, pwrH: 2.6, sag: 0.3, otLp: 7200 },
        { base: 'dumble', stages: [[42, 1.5, 0.27, 10500, 35], [36, 1.25, 0.32, 8000, 100], [26, 1.3, 0.3, 7200, 80]], pwrH: 2.4, sag: 0.4, otLp: 6900 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.5 }), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('r.mix', 'REVERB', { def: 0.18 }), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CHANNEL', ['1', '2'])],
      desc: 'American boutique clean and a smooth, vocal drive channel.' }),
    AMPX({ id: 'mesa.amp-subway', name: 'Cali Tube-way 800', ref: 'Mesa/Boogie Subway D-800', cat: 'Bass Amp', tolex: '#151515', panel: '#c4c8cc', panelText: '#111', grille: 'black', headGrille: false, logo: 'Tube-way', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', knob: 'mesa',
      opts: { voice: { base: 'markbass', stages: [[12, 4.0, 0.05, 15000, 15]], tsType: 3, baxBass: 55, baxTreble: 4500, baxRange: 15, otLp: 12000 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'DEEP', ['OFF', 'ON']), TOG('ultrahi', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Lightweight 800 W class-D bass head with a sweepable mid.' }),
    CAB({ id: 'mesa.cab-2x12recto', name: '2x12 Cali V30', ref: 'Mesa Rectifier 2x12 (V30)', opts: { cab: { hp: 78, hpQ: 1.6, resDb: 4.5, lp: 5600, peaks: [[120, 1, 1.5], [1500, 1.2, 2], [2900, 1.6, 5], [4600, 2.5, 2.5]], seed: 51 } }, cabSize: '2x12', grille: 'black', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', piping: '#9ea4ab' }),
    CAB({ id: 'mesa.cab-subway2x10', name: '2x10 Cali Tube-way', ref: 'Mesa/Boogie Subway 2x10', bass: true, opts: { cab: { hp: 48, hpQ: 1.1, resDb: 2.5, lp: 7500, peaks: [[95, 1, 2], [700, 1, 0.8], [4000, 1.2, 3]], seed: 52, detail: 1.2 } }, cabSize: '2x10', grille: 'black', logo: 'Tube-way', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Mesa's stomp line: black boxes with a dark control plate, plus the classic five-band EQ.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, SLIDER, def, ten, db, ms } = tz.helpers;
  // plain stomp box for this brand: knob rows (optionally on a dark plate), toggles, logo, LED, footswitch.
  // Jacks sit below the controls so their labels never cover a knob.
  tz.addForm('mesa-stomp', (ctx, d) => {
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
    const jacks = d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { y0: deckH + 62, gap: 24, flip: ctx.flip });
    return { w, h, theme, jacks };
  });

  const SP = (o) => def(Object.assign({ form: 'mesa-stomp' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    SP({ id: 'mesa.throttlebox', name: 'Choke Box', ref: 'Mesa/Boogie Throttle Box', logo: 'CHOKE BOX', typeName: 'High-Gain Distortion', cat: 'Distortion', color: '#1d1d1f', plate: '#0c0c0d', accent: '#e8792a', knob: 'mesa',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 6, preHp: 110, tone: 'lp', toneLo: 1300, toneHi: 9000, postLp: 7200, levelMaxDb: -6,
        modes: [{ gainMinDb: 6, gainMaxDb: 38 }, { gainMinDb: 12, gainMaxDb: 50 }, { gainMinDb: 6, gainMaxDb: 38, preEq: [{ type: 'peak', f: 750, q: 0.8, db: -6 }] }, { gainMinDb: 12, gainMaxDb: 50, preEq: [{ type: 'peak', f: 750, q: 0.8, db: -6 }] }] },
      controls: [t('level', 'LEVEL'), t('tone', 'TONE'), t('gain', 'GAIN', { def: 0.55 }), TOG('hi', 'GAIN', ['LO', 'HI'], { virtual: true, def: 1 }), TOG('cut', 'MID CUT', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ mode: (u.hi ?? 1) + 2 * (u.cut ?? 0) }), desc: 'Tight, saturated high-gain distortion with Lo / Hi gain and a mid-cut switch.' }),
    SP({ id: 'mesa.gridslammer', name: 'Grid Smasher', ref: 'Mesa/Boogie Grid Slammer', logo: 'GRID SMASHER', typeName: 'Overdrive', cat: 'Overdrive', color: '#2f6a3a', plate: '#0c0c0d', knob: 'mesa',
      algo: 'drive', opts: { clip: 'ts', preHp: 120, gainMinDb: 0, gainMaxDb: 36, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 720, trebleF: 3000, postLp: 9000, cleanSum: true, levelMaxDb: 8, preEq: [{ type: 'peak', f: 720, q: 0.7, db: 4 }] }, fixed: { mid: 0.5 },
      controls: [t('level', 'LEVEL'), t('gain', 'GAIN', { def: 0.45 }), t('treble', 'TONE'), t('bass', 'BASS')],
      desc: 'Mid-hump overdrive with an extra Bass control, great for pushing a lead channel.' }),
    SP({ id: 'mesa.toneburst', name: 'Tone-Blast', ref: 'Mesa/Boogie Tone-Burst', logo: 'TONE-BLAST', typeName: 'Boost', cat: 'Boost', color: '#a02424', plate: '#0c0c0d', knob: 'mesa',
      algo: 'boost', fixed: { mode: 0 },
      controls: [t('level', 'LEVEL', { def: 0.8 }), t('gain', 'GAIN', { def: 0.15 }), t('treble', 'TREBLE'), t('bass', 'BASS')],
      desc: 'Clean boost with treble and bass, to tighten or fatten your amp.' }),
    SP({ id: 'mesa.fluxdrive', name: 'Flux Overdrive', ref: 'Mesa/Boogie Flux-Drive', logo: 'FLUX-OD', typeName: 'Overdrive', cat: 'Overdrive', color: '#4a3a7a', plate: '#0c0c0d', knob: 'mesa',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 80, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 8500, levelMaxDb: 4, modes: [{ gainMinDb: 2, gainMaxDb: 32 }, { gainMinDb: 8, gainMaxDb: 42 }] }, fixed: { mid: 0.5 },
      controls: [t('level', 'LEVEL'), t('gain', 'GAIN', { def: 0.5 }), t('treble', 'TREBLE'), t('bass', 'BASS'), TOG('mode', 'GAIN', ['LO', 'HI'])],
      desc: 'Open, amp-like overdrive with Lo and Hi gain ranges.' }),
    SP({ id: 'mesa.fiveband', name: 'Five-Slider EQ', ref: 'Mesa/Boogie Five-Band Graphic EQ', logo: 'FIVE-SLIDER', typeName: 'Graphic EQ', cat: 'EQ', color: '#1d1d1f', plate: '#0c0c0d', deckH: 116, cost: 0.2,
      algo: 'geq', opts: { freqs: [80, 240, 750, 2200, 6600], q: 1.1 },
      controls: [...['80', '240', '750', '2200', '6600'].map((l, i) => SLIDER('b' + i, l, { min: -12, max: 12, def: [3, -1, -4, 1, 3][i], x: 24 + i * 18.5, y: 68, h: 70, display: db })), SLIDER('level', 'LVL', { min: -12, max: 12, def: 0, x: 118, y: 68, h: 70, display: db })],
      desc: 'The famous five-band V curve in a pedal: 80, 240, 750, 2200 and 6600 Hz plus level.' }),
    SP({ id: 'mesa.vtwin', name: 'Twin-V Tube Preamp', ref: 'Mesa/Boogie V-Twin', logo: 'TWIN-V', typeName: 'Tube Preamp', cat: 'Preamp', kind: 'Pedal', color: '#26272b', plate: '#0c0c0d', accent: '#c9a24a', knob: 'mesa', cost: 1.6, perRow: 3,
      algo: 'amp', opts: { preamp: true, models: ['twin', 'markiic'] },
      controls: [K('level', 'VOLUME', { min: -24, max: 12, def: -9, display: db }), t('gain', 'GAIN', { def: 0.5 }), t('treble', 'TREBLE'), t('mid', 'MIDDLE'), t('bass', 'BASS'), TOG('channel', 'CHANNEL', ['CLEAN', 'DRIVE'], { values: [0, 1], def: 1 })],
      desc: 'Two-channel tube preamp pedal: sparkly clean or a singing, compressed lead.' }),
  ]);
}
