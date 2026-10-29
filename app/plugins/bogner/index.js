// Built-in Tone Zone plugin: Bogner.
// Blocks inspired by Bogner gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
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
    preampPair(AMP({ id: 'amp.uber', name: 'Uber Schall', ref: 'Bogner Überschall', opts: { model: 'uber' }, tolex: '#141414', panel: '#141414', panelText: '#d9d9d9', grille: 'black', logo: 'Bogart', logoColor: '#d9d9d9', knob: 'chrome', controls: marshallKnobs('GAIN', 'VOLUME') })),
    CAB({ id: 'cab.4x12uber', name: '4x12 Uber V30', ref: 'Bogner Überkab 4x12', opts: { model: '4x12uber' }, cabSize: '4x12', grille: 'black', logo: 'Bogart', logoColor: '#ddd' }),

    // ---------------- v0.2
    AMPX({ id: 'bogner.amp-shiva', name: 'Shakti 20th', ref: 'Bogner Shiva', tolex: '#141414', panel: '#151515', panelText: '#e6e6e6', grille: 'salt', logo: 'Bogart', logoColor: '#e6e6e6', knob: 'chrome', piping: '#bdbdbd',
      opts: { models: [
        { base: 'plexi', stages: [[38, 1.6, 0.22, 12000, 30], [30, 1.6, 0.25, 9500, 60]], pwrH: 2.4, sag: 0.3, otLp: 7300, presHz: 3400 },
        { base: 'jcm800', stages: [[46, 1.45, 0.3, 10500, 50], [42, 1.15, 0.35, 7800, 130], [32, 1.15, 0.35, 7000, 110]], pwrH: 2.2, sag: 0.35, otLp: 6700, presHz: 3400, tight: 0.2 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('master', 'VOLUME'), k('presence', 'PRESENCE'), k('r.mix', 'REVERB', { def: 0.12 }), TOG('channel', 'CHANNEL', ['1', '2'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      verb: { mode: 3, decay: 0.45 }, desc: 'Two-channel EL34 head: glassy clean and a creamy, singing lead.' }),
    AMPX({ id: 'bogner.amp-ecstasy', name: 'Rapture 101', ref: 'Bogner Ecstasy 101B', tolex: '#141414', panel: '#c6cacf', panelText: '#121212', grille: 'black', logo: 'Bogart', logoColor: '#e6e6e6', knob: 'chrome',
      opts: { models: [
        { base: 'twin', stages: [[36, 1.7, 0.18, 12500, 25], [30, 1.8, 0.2, 9800, 35]], stack: 'marshall', pwrH: 2.6, sag: 0.3, otLp: 7400, presHz: 3400 },
        { base: 'plexi', stages: [[44, 1.45, 0.3, 11500, 40], [36, 1.3, 0.35, 8800, 90]], pwrH: 2.2, sag: 0.4, otLp: 7000 },
        { base: 'jcm800', stages: [[48, 1.45, 0.3, 10500, 50], [44, 1.1, 0.36, 7600, 140], [36, 1.05, 0.4, 7000, 120]], pwrH: 2.2, sag: 0.4, otLp: 6600, presHz: 3400, tight: 0.25 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('presence', 'PRESENCE'), SEL('channel', 'CHANNEL', ['CH 1', 'CH 2', 'CH 3'], { def: 1, sweep: 90, optSize: 4.2 }), TOG('sag', 'VARIAC', ['OFF', 'ON'], { values: [0.4, 0.85] })],
      desc: 'Three-channel boutique classic; Variac softens the power section.' }),
    CAB({ id: 'bogner.cab-2x12', name: '2x12 Bogart', ref: 'Bogner 2x12 (V30 / G12M)', opts: { cab: { hp: 80, hpQ: 1.5, resDb: 4, lp: 5400, peaks: [[130, 1, 1.5], [900, 1, 1], [2300, 1.4, 3.5], [3800, 2, 2.5]], seed: 71 } }, cabSize: '2x12', grille: 'salt', logo: 'Bogart', logoColor: '#e6e6e6', piping: '#bdbdbd' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Bogner's pedal line, from the Ecstasy channels to the transformer drives.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, SLIDER, def, ten, db, ms } = tz.helpers;
  // plain stomp box for this brand: knob rows (optionally on a dark plate), toggles, logo, LED, footswitch.
  // Jacks sit below the controls so their labels never cover a knob.
  tz.addForm('bogner-stomp', (ctx, d) => {
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

  const SP = (o) => def(Object.assign({ form: 'bogner-stomp' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    SP({ id: 'bogner.ecstasyblue', name: 'Euphoria Blue', ref: 'Bogner Ecstasy Blue', logo: 'EUPHORIA BLUE', typeName: 'Overdrive', cat: 'Overdrive', color: '#2b4f8f', knob: 'chrome', fw: 170, perRow: 3,
      algo: 'drive', opts: { preHp: 80, gainMinDb: 4, gainMaxDb: 38, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 8500, levelMaxDb: 2, modes: [{ clip: 'asym', bias: 0.2 }, { clip: 'si', bias: 0.1, preEq: [{ type: 'peak', f: 700, q: 0.7, db: 3 }] }] },
      controls: [t('level', 'VOLUME'), t('gain', 'GAIN', { def: 0.5 }), t('treble', 'TREBLE'), t('mid', 'MIDDLE'), t('bass', 'BASS'), TOG('variac', 'VARIAC', ['OFF', 'ON'], { virtual: true }), TOG('mode', 'MODE', ['BLUE', 'PLEXI']), TOG('pre', 'PRE EQ', ['FLAT', 'BRIGHT'], { virtual: true })],
      derive: (u) => ({ sag: u.variac ? 0.6 : 0, bright: u.pre ? 0.4 : 0 }), desc: 'The blue channel of the boutique amp: rich crunch with Variac sag, Blue / Plexi modes and a bright Pre EQ.' }),
    SP({ id: 'bogner.ecstasyred', name: 'Euphoria Red', ref: 'Bogner Ecstasy Red', logo: 'EUPHORIA RED', typeName: 'Distortion', cat: 'Distortion', color: '#9a2226', knob: 'chrome', fw: 170, perRow: 3,
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 6, preHp: 90, gainMinDb: 8, gainMaxDb: 46, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 3200, postLp: 7800, levelMaxDb: -3, modes: [{}, { preHp: 160 }] },
      controls: [t('level', 'VOLUME'), t('gain', 'GAIN', { def: 0.55 }), t('treble', 'TREBLE'), t('mid', 'MIDDLE'), t('bass', 'BASS'), TOG('variac', 'VARIAC', ['OFF', 'ON'], { virtual: true }), TOG('mode', 'STRUCTURE', ['FAT', 'TIGHT']), TOG('pre', 'PRE EQ', ['FLAT', 'BRIGHT'], { virtual: true })],
      derive: (u) => ({ sag: u.variac ? 0.6 : 0, bright: u.pre ? 0.4 : 0 }), desc: 'The red lead channel: smooth, saturated high gain with Variac sag and a Structure switch.' }),
    SP({ id: 'bogner.uberschall', name: 'Ultraschall', ref: 'Bogner Uberschall (pedal)', logo: 'ULTRASCHALL', typeName: 'High-Gain Distortion', cat: 'Distortion', color: '#1c1d20', knob: 'chrome', accent: '#8a8f96',
      algo: 'drive', opts: { clip: 'diode', stages: 3, stage2Db: 8, preHp: 120, gainMinDb: 12, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 650, trebleF: 3000, postLp: 7000, levelMaxDb: -6, modes: [{}, { preEq: [{ type: 'ls', f: 120, q: 0.7, db: 4 }] }] },
      controls: [t('level', 'VOLUME'), t('gain', 'GAIN', { def: 0.6 }), t('treble', 'TREBLE'), t('mid', 'MIDDLE'), t('bass', 'BASS'), TOG('mode', 'THICK', ['OFF', 'ON'])],
      desc: 'Brutal, tight high gain from the metal monster amp.' }),
    SP({ id: 'bogner.burnley', name: 'Burnside', ref: 'Bogner Burnley', logo: 'BURNSIDE', typeName: 'Distortion', cat: 'Distortion', color: '#3d5a3a', knob: 'chrome',
      algo: 'drive', opts: { clip: 'si', preHp: 80, gainMinDb: 8, gainMaxDb: 44, tone: 'lp', toneLo: 1000, toneHi: 8000, postLp: 7500, levelMaxDb: -2, modes: [{ preEq: [{ type: 'ls', f: 150, q: 0.7, db: 4 }] }, { preHp: 160 }] },
      controls: [t('level', 'LEVEL'), t('gain', 'GAIN', { def: 0.55 }), t('tone', 'TONE'), TOG('mode', 'VOICE', ['FAT', 'TIGHT'])],
      desc: 'Classic rodent-style distortion with a transformer-fed output and a Fat / Tight switch.' }),
    SP({ id: 'bogner.wessex', name: 'Wexford', ref: 'Bogner Wessex', logo: 'WEXFORD', typeName: 'Overdrive', cat: 'Overdrive', color: '#2f4a6b', knob: 'chrome',
      algo: 'drive', opts: { clip: 'asym', bias: 0.15, preHp: 80, gainMinDb: 2, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 9000, levelMaxDb: 6, modes: [{ postEq: [{ type: 'hs', f: 4000, q: 0.7, db: 2 }] }, {}] }, fixed: { mid: 0.5 },
      controls: [t('level', 'LEVEL'), t('gain', 'GAIN', { def: 0.45 }), t('treble', 'TREBLE'), t('bass', 'BASS'), TOG('mode', 'MODE', ['ENHANCE', 'NORMAL'])],
      desc: 'Open, touch-sensitive overdrive with an Enhance mode for extra sparkle.' }),
    SP({ id: 'bogner.harlow', name: 'Harrow Boost', ref: 'Bogner Harlow', logo: 'HARROW', typeName: 'Boost / Compressor', cat: 'Boost', color: '#7a2a2a', knob: 'chrome',
      algo: 'drive', opts: { clip: 'clean', gainMinDb: 0, gainMaxDb: 14, tone: 'lp', toneLo: 2000, toneHi: 14000, postLp: 14000, levelMaxDb: 16 },
      controls: [t('level', 'LEVEL', { def: 0.6 }), t('tone', 'TONE', { def: 0.6 }), t('sag', 'BLOOM', { def: 0.3 })],
      desc: 'Clean boost with gentle compression. Bloom adds a soft swell to each note.' }),
  ]);
}
