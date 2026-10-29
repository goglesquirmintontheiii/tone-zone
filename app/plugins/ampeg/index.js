// Built-in Tone Zone plugin: Ampeg.
// Blocks inspired by Ampeg gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.svt', name: 'Super Valve Bass', ref: 'Ampeg SVT Classic', cat: 'Bass Amp', opts: { model: 'svt' }, tolex: '#151515', panel: '#c7cbd0', panelText: '#121212', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#f0f0f0', logoPlate: '#2a4f9a', knob: 'mesa',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDRANGE'), k('midfreq', 'FREQUENCY'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'ULTRA LO', ['OFF', 'ON']), TOG('ultrahi', 'ULTRA HI', ['OFF', 'ON'])] })),
    preampPair(AMP({ id: 'amp.b15', name: 'Portaflux B15', ref: 'Ampeg B-15 Portaflex', cat: 'Bass Amp', opts: { model: 'b15' }, combo: true, speakers: 1, tolex: '#2c3d5a', panel: '#c7cbd0', panelText: '#121212', grille: 'silver', logo: 'Portaflux', logoColor: '#e8e8e8', knob: 'chicken', controls: [k('gain', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('master', 'MASTER', { def: 0.6 })] })),
    CAB({ id: 'cab.8x10svt', name: '8x10 Fridge', ref: 'Ampeg SVT-810E', opts: { model: '8x10svt' }, cabSize: '8x10', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#eee', logoPlate: '#2a4f9a', bass: true }),
    CAB({ id: 'cab.1x15bass', name: '1x15 Bass', ref: 'Ampeg B-15 / 1x15', opts: { model: '1x15bass' }, cabSize: '1x15', tolex: '#2c3d5a', grille: 'silver', logo: 'Portaflux', logoColor: '#eee', bass: true }),

    // ---------------- v0.2
    AMPX({ id: 'ampeg.amp-svtvr', name: 'Super Valve Bass VR', ref: 'Ampeg SVT-VR', cat: 'Bass Amp', tolex: '#151515', panel: '#c7cbd0', panelText: '#121212', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#f0f0f0', logoPlate: '#2a4f9a', knob: 'mesa', piping: '#d8d8d8',
      opts: { models: [
        { base: 'svt', stages: [[32, 1.7, 0.22, 9500, 15], [24, 1.6, 0.27, 7500, 20]], pwrH: 2.4, sag: 0.4, otLp: 5800 },
        { base: 'svt', stages: [[32, 1.7, 0.22, 9500, 15], [24, 1.6, 0.27, 7500, 20]], brightHz: 2500, brightDb: 6, pwrH: 2.4, sag: 0.4, otLp: 6200 },
      ] },
      controls: [k('gain', 'VOLUME', { def: 0.5 }), k('treble', 'TREBLE'), k('mid', 'MIDRANGE'), SEL('midfreq', 'FREQUENCY', ['220', '450', '800', '1.6K', '3K'], { values: [0, 0.27, 0.5, 0.78, 1], def: 1, sweep: 120, optSize: 3.8 }), k('bass', 'BASS'), k('master', 'MASTER'), TOG('channel', 'INPUT', ['NORMAL', 'BRIGHT']), TOG('ultrahi', 'ULTRA HI', ['OFF', 'ON']), TOG('ultralo', 'ULTRA LO', ['OFF', 'ON'])],
      desc: 'The all-tube 300 W reissue of the original 1969 fridge-head.' }),
    AMPX({ id: 'ampeg.amp-pf500', name: 'Portaflux PF 500', ref: 'Ampeg Portaflex PF-500', cat: 'Bass Amp', tolex: '#151515', panel: '#2b2c2e', panelText: '#e8e8e8', grille: 'black', headGrille: false, logo: 'Portaflux', logoColor: '#e8e8e8', knob: 'mxr',
      opts: { voice: { base: 'gk800', stages: [[14, 4.0, 0.08, 14000, 15]], tsType: 3, baxBass: 50, baxTreble: 4000, baxRange: 15, otLp: 11000 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'MIDRANGE'), k('midfreq', 'FREQUENCY'), k('treble', 'TREBLE'), k('master', 'VOLUME'), TOG('ultralo', 'ULTRA LO', ['OFF', 'ON']), TOG('ultrahi', 'ULTRA HI', ['OFF', 'ON'])],
      desc: 'Compact class-D Portaflex head with classic Ampeg EQ voicing.' }),
    CAB({ id: 'ampeg.cab-410hlf', name: '4x10 SVB HLF', ref: 'Ampeg SVT-410HLF', bass: true, opts: { cab: { hp: 40, hpQ: 1.3, resDb: 4, lp: 4800, peaks: [[75, 1, 3], [500, 1, 1.5], [1700, 1.3, 2.5], [5000, 1.2, 2]], seed: 111, detail: 1.5 } }, cabSize: '4x10', grille: 'silver', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#eee', logoPlate: '#2a4f9a' }),
    CAB({ id: 'ampeg.cab-610hlf', name: '6x10 SVB HLF', ref: 'Ampeg SVT-610HLF', bass: true, opts: { cab: { hp: 38, hpQ: 1.3, resDb: 4.5, lp: 4500, peaks: [[70, 1, 3.5], [500, 1, 2], [1600, 1.3, 2.5], [3200, 2, -2]], seed: 112, detail: 1.5 } }, cabSize: '6x10', grille: 'black', logo: 'SVB', logoFont: "'Oswald', sans-serif", logoColor: '#eee', logoPlate: '#2a4f9a' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Ampeg's bass pedal line: grey bodies with a black control plate, like the amp faceplates.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, def, ten, db } = tz.helpers;
  const { svg, label, formKit, shade } = tz.gfx;

  tz.addForm('ampeg-pedal', (ctx, d) => {
    const g = ctx.g;
    const mine = (c) => c.x === undefined || c._fa;
    const kn = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && mine(c));
    const tg = d.controls.filter((c) => c.t === 'toggle' && mine(c));
    const foots = d.controls.filter((c) => c.t === 'foot' && mine(c));
    const leds = d.controls.filter((c) => c.t === 'led' && mine(c));
    const perRow = d.perRow || (kn.length <= 4 ? kn.length : Math.ceil(kn.length / 2));
    const w = d.fw || (perRow > 3 || foots.length > 1 ? 196 : 140);
    const rows = [];
    for (let i = 0; i < kn.length; i += perRow) rows.push(kn.slice(i, i + perRow));
    const plateH = 26 + rows.length * 44 + (tg.length ? 34 : 0);
    const ly = plateH + 42, fy = ly + 62, h = fy + 34;
    formKit.body(g, w, h, d.color || '#b9bdc2', { rx: 9, brushed: true });
    // black faceplate with a thin bright border, accent stripe under it
    svg('rect', { x: 9, y: 9, width: w - 18, height: plateH, rx: 4, fill: '#121315' }, g);
    svg('rect', { x: 11, y: 11, width: w - 22, height: plateH - 4, rx: 3, fill: 'none', stroke: '#c9ccd1', 'stroke-opacity': 0.7, 'stroke-width': 0.8 }, g);
    svg('rect', { x: 9, y: plateH + 13, width: w - 18, height: 3.2, rx: 1.5, fill: d.accent || '#2a6fd0' }, g);
    rows.forEach((r, ri) => {
      const x0 = 30, x1 = w - 30, step = perRow > 1 ? (x1 - x0) / (perRow - 1) : 0;
      const off = ((perRow - r.length) * step) / 2;
      r.forEach((c, i) => Object.assign(c, { _fa: 1, x: perRow === 1 ? w / 2 : x0 + off + i * step, y: 42 + ri * 44, r: 11, labelPos: 'above', labelSize: 5.4 }));
    });
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: tg.length === 1 ? w / 2 : 32 + (i * (w - 64)) / (tg.length - 1), y: 26 + rows.length * 44 + 12, orient: 'h', optSize: 4.2 }));
    const txt = '#141517';
    label(g, w / 2, plateH + 32, d.brandMark || 'Lowland', { size: 12, fill: txt, font: "'Dancing Script', cursive", weight: 700 });
    label(g, w / 2, ly + 2, d.logo || d.name, { size: (d.logo || d.name).length > 12 ? 10.5 : 13, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, ly + 13, (d.typeName || d.cat).toUpperCase(), { size: 5, fill: txt, weight: 700, ls: 1.6, opacity: 0.75 });
    const spots = (n) => (n > 1 ? [w * 0.27, w * 0.73] : [w / 2]);
    const lx = spots(leds.length), fx = spots(foots.length);
    leds.forEach((l, i) => Object.assign(l, { _fa: 1, x: lx[i], y: ly + 26, r: 3 }));
    foots.forEach((f, i) => Object.assign(f, { _fa: 1, style: 'stomp', x: fx[i], y: fy, r: 12.5, labelDy: foots.length > 1 ? -18 : undefined }));
    formKit.tzBadge(g, w / 2, h - 8, shade(txt, 0.3), 4);
    const theme = { text: '#eceef0', knob: d.knob || 'mxr', labelSize: 5.4 };
    // labels on the grey area need dark text
    const dark = { text: txt, knob: theme.knob, labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls.filter((c) => c.t !== 'foot'), theme);
    formKit.placeControls(ctx, d.controls.filter((c) => c.t === 'foot'), dark);
    const jacks = d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { y0: plateH + 44, gap: 24, flip: ctx.flip });
    return { w, h, theme, jacks };
  });

  const AP = (o) => def(Object.assign({ form: 'ampeg-pedal' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: '#ff2a1a' })])] }));
  const bassDrive = { clip: 'tube', bias: 0.15, preHp: 30, gainMinDb: 6, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 90, midF: 500, trebleF: 2500, postLp: 6500, cleanSum: true, levelMaxDb: 4 };
  const svtPre = { preamp: true, models: ['svt', 'b15'] };
  const DI_OUTS = { ins: ['INPUT'], outs: ['OUTPUT', 'XLR DI OUT'] };

  tz.addDefs([
    AP({ id: 'ampeg.scrambler', name: 'Scrambled Bass OD', ref: 'Ampeg Scrambler Bass Overdrive', logo: 'SCRAMBLED', typeName: 'Bass Overdrive', cat: 'Overdrive', accent: '#c8302a',
      algo: 'drive', opts: bassDrive, fixed: { bass: 0.5, mid: 0.5 },
      controls: [K('treble', 'TREBLE', { display: ten }), K('gain', 'DRIVE', { display: ten, def: 0.5 }), K('blend', 'BLEND', { display: ten, def: 0.6 }), K('level', 'VOLUME', { display: ten, def: 0.45 })],
      desc: 'Tube-style bass grit with a clean blend so the low end stays solid.', tags: ['bass'] }),
    AP({ id: 'ampeg.classicpre', name: 'Classic Low Preamp', ref: 'Ampeg Classic Analog Bass Preamp', logo: 'CLASSIC LOW', typeName: 'Bass Preamp', cat: 'Preamp', kind: 'Pedal', accent: '#2a6fd0', jacksTop: true,
      algo: 'amp', cost: 1.4, opts: { preamp: true, model: 'svt' }, ports: DI_OUTS, jackKinds: { o1: 'xlr' }, fixed: { gain: 0.35 },
      controls: [K('level', 'VOLUME', { min: -24, max: 12, def: 0, display: db }), K('bass', 'BASS', { display: ten }), K('mid', 'MIDRANGE', { display: ten }), K('treble', 'TREBLE', { display: ten }),
        TOG('midfreq', 'FREQ', ['220', '800', '3K'], { values: [0.2, 0.5, 0.85], def: 1 }), TOG('ultralo', 'ULTRA LO', ['OFF', 'ON']), TOG('ultrahi', 'ULTRA HI', ['OFF', 'ON'])],
      desc: 'The classic big-head bass EQ in a pedal, with Ultra Lo / Hi and an XLR DI out.', tags: ['bass', 'di'] }),
    AP({ id: 'ampeg.liquifier', name: 'Liquid Bass Chorus', ref: 'Ampeg Liquifier Analog Chorus', logo: 'LIQUID', typeName: 'Analog Chorus', cat: 'Modulation', accent: '#3fb7c9',
      algo: 'chorus', opts: { style: 'bbd' }, fixed: { tone: 0.55 },
      controls: [K('rate', 'RATE', { display: ten, def: 0.3 }), K('depth', 'DEPTH', { display: ten, def: 0.5 }), K('mix', 'FX LEVEL', { display: ten, def: 0.45 })],
      desc: 'Warm BBD chorus voiced to keep bass lows intact.', tags: ['bass'] }),
    AP({ id: 'ampeg.optocomp', name: 'Opti Squeeze', ref: 'Ampeg Opto Comp', logo: 'OPTI SQUEEZE', typeName: 'Optical Compressor', cat: 'Dynamics', accent: '#e0b02a',
      algo: 'comp', opts: { type: 'opto' }, fixed: { attack: 0.35 },
      controls: [K('sustain', 'COMP', { display: ten, def: 0.5 }), K('release', 'RELEASE', { display: ten, def: 0.4 }), K('level', 'OUTPUT', { display: ten, def: 0.36 })],
      desc: 'Smooth optical compression for even, punchy bass.', tags: ['bass'] }),
    AP({ id: 'ampeg.sgtdi', name: 'SGT-Direct', ref: 'Ampeg SGT-DI', logo: 'SGT-DIRECT', typeName: 'Bass Preamp / DI', cat: 'Preamp', kind: 'Pedal', accent: '#2a6fd0', fw: 220, perRow: 4, jacksTop: true,
      algo: 'chain', cost: 3.2, alwaysOn: true, noStd: true,
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'XLR DI OUT', 'PHONES'] }, jackKinds: { o1: 'xlr', o2: 'phones' },
      opts: { chain: [
        { prefix: 'c', algo: 'comp', opts: { type: 'opto' }, params: { attack: 0.3, release: 0.4, level: 0.4 } },
        { prefix: 'g', algo: 'drive', on: false, opts: Object.assign({}, bassDrive, { tone: 'none', levelMaxDb: 2 }) },
        { prefix: 'a', algo: 'amp', opts: svtPre },
        { prefix: 'k', algo: 'cab', on: false, opts: { model: '8x10svt' } },
      ] },
      controls: [K('a.level', 'VOLUME', { min: -24, max: 12, def: -4, display: db }), K('c.sustain', 'COMP', { display: ten, def: 0.3 }), K('a.bass', 'BASS', { display: ten }), K('a.mid', 'MID', { display: ten }),
        K('a.midfreq', 'FREQ', { display: ten }), K('a.treble', 'TREBLE', { display: ten }), K('g.gain', 'GRIT', { display: ten, def: 0.5 }), K('g.level', 'LEVEL', { display: ten, def: 0.45 }),
        TOG('a.channel', 'VOICE', ['SVT', 'B15'], { values: [0, 1] }), TOG('a.ultrahi', 'ULTRA HI', ['OFF', 'ON']), TOG('a.ultralo', 'ULTRA LO', ['OFF', '1', '2'], { values: [0, 0.5, 1] }), TOG('k.on', 'IR', ['OFF', 'ON']),
        FOOT({ action: 'param', p: 'pre', toggle: true, label: 'PREAMP', virtual: true }), FOOT({ action: 'param', p: 'g.on', toggle: true, label: 'SGT' }), LED({ bind: 'param:pre', color: '#3d8bff' }), LED({ bind: 'param:g.on', color: '#ff2a1a' })],
      initParams: { pre: 1, 'g.on': 0 }, fixed: { 'a.gain': 0.4 },
      derive: (u) => ({ 'c.on': u.pre ? 1 : 0, 'a.on': u.pre ? 1 : 0 }),
      desc: 'Bass preamp and DI with compressor, Super Grit drive, SVT / B15 voices and a cab sim for the XLR out.', tags: ['bass', 'di'] }),
    AP({ id: 'ampeg.scrdi', name: 'SCR-Direct', ref: 'Ampeg SCR-DI', logo: 'SCR-DIRECT', typeName: 'Bass Preamp / DI', cat: 'Preamp', kind: 'Pedal', accent: '#c8302a', fw: 200, perRow: 3, jacksTop: true,
      algo: 'chain', cost: 2, alwaysOn: true, noStd: true,
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'XLR DI OUT', 'PHONES'] }, jackKinds: { o1: 'xlr', o2: 'phones' },
      opts: { chain: [
        { prefix: 's', algo: 'drive', on: false, opts: Object.assign({}, bassDrive, { tone: 'none', levelMaxDb: 2 }) },
        { prefix: 'a', algo: 'amp', opts: { preamp: true, model: 'svt' } },
      ] },
      controls: [K('a.level', 'VOLUME', { min: -24, max: 12, def: 0, display: db }), K('a.bass', 'BASS', { display: ten }), K('a.mid', 'MID', { display: ten }), K('a.treble', 'TREBLE', { display: ten }), K('s.gain', 'DRIVE', { display: ten, def: 0.5 }), K('s.blend', 'BLEND', { display: ten, def: 0.6 }),
        TOG('a.ultrahi', 'ULTRA HI', ['OFF', 'ON']), TOG('a.ultralo', 'ULTRA LO', ['OFF', 'ON']),
        FOOT({ action: 'param', p: 'pre', toggle: true, label: 'PREAMP', virtual: true }), FOOT({ action: 'param', p: 's.on', toggle: true, label: 'SCRAMBLER' }), LED({ bind: 'param:pre', color: '#3d8bff' }), LED({ bind: 'param:s.on', color: '#ff2a1a' })],
      initParams: { pre: 1, 's.on': 0 }, fixed: { 'a.gain': 0.4, 's.level': 0.45 },
      derive: (u) => ({ 'a.on': u.pre ? 1 : 0 }),
      desc: 'Bass preamp and DI with the Scrambler drive on its own switch, Ultra Hi / Lo and a headphone out.', tags: ['bass', 'di'] }),
    AP({ id: 'ampeg.scrambler69', name: 'Scrambler 69', ref: 'Ampeg Scrambler (1969)', logo: 'SCRAMBLER 69', brandMark: 'Lowland', typeName: 'Octave Fuzz', cat: 'Fuzz', color: '#6f8196', accent: '#e8e8e8',
      algo: 'chain', cost: 1.1, opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', preHp: 90, gainMinDb: 14, gainMaxDb: 42, tone: 'none', postLp: 6000, cleanSum: true, levelMaxDb: -4 }, params: { level: 0.5 } },
        { prefix: 'o', algo: 'pitch', params: { semis1: 12, level1: 0.4, dry: 0.9, quality: 0, tone: 0.75 } },
      ] },
      controls: [K('tex', 'TEXTURE', { display: ten, def: 0.6, virtual: true }), K('f.blend', 'BALANCE', { display: ten, def: 0.7 })],
      derive: (u) => ({ 'f.gain': u.tex ?? 0.6, 'o.level1': 0.15 + 0.5 * (u.tex ?? 0.6) }),
      desc: 'Late-60s octave fuzz: Texture adds grit and octave, Balance mixes it with your clean tone.' }),
  ]);
}
