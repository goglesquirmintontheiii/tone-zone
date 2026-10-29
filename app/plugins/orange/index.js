// Built-in Tone Zone plugin: Orange.
// Blocks inspired by Orange gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.orange', name: 'Citrus Rockerbox', ref: 'Orange Rockerverb', opts: { model: 'orange' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', headGrille: true, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] })),
    preampPair(AMP({ id: 'amp.ad200', name: 'Citrus AD Bass', ref: 'Orange AD200', cat: 'Bass Amp', opts: { model: 'ad200' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] })),
    CAB({ id: 'cab.4x12orange', name: '4x12 Citrus', ref: 'Orange PPC412', opts: { model: '4x12orange' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
    CAB({ id: 'cab.4x12bass', name: '4x12 Bass', ref: 'Orange OBC / 4x12 bass', opts: { model: '4x12bass' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', bass: true }),

    // ---------------- v0.2
    AMPX({ id: 'orange.amp-or50', name: 'Citrus OR 50', ref: 'Orange OR50', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      opts: { voice: { base: 'orange', stages: [[46, 1.45, 0.3, 10000, 45], [42, 1.15, 0.36, 7400, 120], [32, 1.15, 0.36, 6800, 95]], pwrH: 1.8, sag: 0.45, otLp: 6400 } },
      controls: [k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.55 }), TOG('sag', 'POWER', ['FULL', 'HALF'], { values: [0.4, 0.8] })],
      desc: 'Single-channel British high-gain head: thick, gritty mids.' }),
    AMPX({ id: 'orange.amp-tinyterror', name: 'Citrus Tiny Terror', ref: 'Orange Tiny Terror', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', headGrille: false, corners: false, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', logoPlate: '#1a1a1a', knob: 'mxr',
      opts: { voice: { base: 'orange', stages: [[44, 1.4, 0.3, 9500, 40], [36, 1.2, 0.35, 7200, 100]], tsPos: 2, power: 2, pwrH: 1.1, sag: 0.5, otLp: 6200, nfb: 0 } },
      controls: [k('master', 'VOLUME'), k('treble', 'TONE'), k('gain', 'GAIN', { def: 0.55 }), TOG('sag', 'WATTS', ['15', '7'], { values: [0.45, 0.85] })],
      desc: 'EL84 lunchbox head: one Tone knob, loads of British crunch.' }),
    AMPX({ id: 'orange.amp-thunderverb', name: 'Citrus Thunderverb', ref: 'Orange Thunderverb 200', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      opts: { models: [
        { base: 'orange', stages: [[40, 1.6, 0.25, 11000, 35], [32, 1.4, 0.3, 8500, 80]], tsPos: 2, pwrH: 2.8, sag: 0.35, otLp: 6800 },
        { base: 'orange', stages: [[48, 1.4, 0.3, 9800, 45], [44, 1.1, 0.36, 7200, 130], [34, 1.1, 0.38, 6800, 100]], pwrH: 2.6, sag: 0.4, otLp: 6300, tight: 0.2 },
      ] },
      controls: [k('r.mix', 'REVERB', { def: 0.12 }), k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.55 }), TOG('channel', 'CHANNEL', ['A', 'B'], { def: 1 })],
      verb: { mode: 3, decay: 0.5 }, desc: 'Two-channel 200 W head with spring reverb: huge, dark and saturated.' }),
    AMPX({ id: 'orange.amp-terrorbass', name: 'Citrus Terror Bass', ref: 'Orange Terror Bass', cat: 'Bass Amp', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', headGrille: false, corners: false, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', logoPlate: '#1a1a1a', knob: 'mxr',
      opts: { models: [
        { base: 'ad200', stages: [[30, 1.8, 0.2, 8000, 20], [24, 1.7, 0.22, 6500, 25]], tsType: 0, stack: 'orange', tsPos: 1, pwrH: 2.2, sag: 0.35, otLp: 5200, otHp: 30 },
        { base: 'ad200', stages: [[44, 1.4, 0.3, 7500, 25], [36, 1.25, 0.35, 6000, 40], [26, 1.3, 0.3, 5500, 40]], tsType: 0, stack: 'orange', tsPos: 1, pwrH: 2.0, sag: 0.45, otLp: 5000, otHp: 30 },
      ] },
      controls: [k('master', 'VOLUME'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'GAIN', { def: 0.45 }), TOG('channel', 'CHANNEL', ['CLEAN', 'DIRTY'])],
      desc: 'Valve-preamp lunchbox bass head with a growling dirty channel.' }),
    CAB({ id: 'orange.cab-ppc212', name: '2x12 Citrus', ref: 'Orange PPC212 (V30)', opts: { cab: { hp: 75, hpQ: 1.6, resDb: 4.5, lp: 5200, peaks: [[220, 1, 2], [1000, 1, 1.5], [2600, 1.5, 3.5], [4300, 2.5, 1.5]], seed: 61 } }, cabSize: '2x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
    CAB({ id: 'orange.cab-obc810', name: '8x10 Citrus Bass', ref: 'Orange OBC810', bass: true, opts: { cab: { hp: 42, hpQ: 1.3, resDb: 4, lp: 4300, peaks: [[85, 1, 3], [600, 1, 2], [1700, 1.3, 2], [3200, 2, -2.5]], seed: 62, detail: 1.5 } }, cabSize: '8x10', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Orange-style pedals: orange steel box, white knobs, a framed piece of line art per pedal.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;

  // simple line art, drawn inside a 92x50 frame at (x, y)
  const ART = {
    mirror: (g, x, y, st) => {
      svg('rect', Object.assign({ x: x + 6, y: y + 6, width: 80, height: 38, rx: 12 }, st), g);
      svg('path', Object.assign({ d: `M${x + 18} ${y + 34} l6 -10 h40 l8 10 z M${x + 30} ${y + 24} l4 -6 h22 l4 6` }, st), g);
      svg('circle', { cx: x + 28, cy: y + 35, r: 3, fill: st.stroke }, g);
      svg('circle', { cx: x + 64, cy: y + 35, r: 3, fill: st.stroke }, g);
    },
    fur: (g, x, y, st) => {
      for (let r = 0; r < 4; r++) svg('path', Object.assign({ d: `M${x + 6} ${y + 10 + r * 10} q8 -7 16 0 t16 0 t16 0 t16 0 t16 0` }, st), g);
    },
    squeeze: (g, x, y, st) => {
      svg('path', Object.assign({ d: `M${x + 8} ${y + 25} h22 m-8 -8 l8 8 l-8 8 M${x + 84} ${y + 25} h-22 m8 -8 l-8 8 l8 8` }, st), g);
      svg('rect', Object.assign({ x: x + 38, y: y + 12, width: 16, height: 26, rx: 3 }, st), g);
    },
    piston: (g, x, y, st) => {
      svg('rect', Object.assign({ x: x + 30, y: y + 6, width: 32, height: 22, rx: 2 }, st), g);
      svg('path', Object.assign({ d: `M${x + 30} ${y + 14} h32 M${x + 30} ${y + 20} h32 M${x + 46} ${y + 28} v8 M${x + 46} ${y + 40} m-10 0 a10 4 0 1 0 20 0 a10 4 0 1 0 -20 0` }, st), g);
    },
    bolt: (g, x, y, st) => {
      svg('path', Object.assign({ d: `M${x + 52} ${y + 5} l-16 22 h12 l-8 18 l20 -26 h-12 z` }, st), g);
      svg('path', Object.assign({ d: `M${x + 10} ${y + 25} h18 M${x + 64} ${y + 25} h18` }, st), g);
    },
    cone: (g, x, y, st) => {
      for (const r of [20, 13, 6]) svg('circle', Object.assign({ cx: x + 46, cy: y + 25, r }, st), g);
      svg('path', Object.assign({ d: `M${x + 10} ${y + 10} v30 M${x + 82} ${y + 10} v30` }, st), g);
    },
  };

  tz.addForm('orange-pedal', (ctx, d) => {
    const g = ctx.g;
    const mine = (c) => c.x === undefined || c._fa;
    const kn = d.controls.filter((c) => c.t === 'knob' && mine(c));
    const tg = d.controls.filter((c) => c.t === 'toggle' && mine(c));
    const foots = d.controls.filter((c) => c.t === 'foot' && mine(c));
    const leds = d.controls.filter((c) => c.t === 'led' && mine(c));
    const perRow = kn.length > 4 ? 3 : kn.length;
    const w = foots.length > 1 || perRow > 3 ? 170 : 140;
    const rows = [];
    for (let i = 0; i < kn.length; i += perRow) rows.push(kn.slice(i, i + perRow));
    const top = 22 + rows.length * 42 + (tg.length ? 30 : 0);
    const ay = top + 4, ly = ay + 78, fy = ly + 40, h = fy + 34;
    formKit.body(g, w, h, d.color || '#f07a1a', { rx: 7 });
    const ink = '#141414';
    rows.forEach((r, ri) => {
      const x0 = 28, x1 = w - 28, step = (x1 - x0) / Math.max(1, perRow - 1);
      const off = ((perRow - r.length) * step) / 2;
      r.forEach((c, i) => Object.assign(c, { _fa: 1, x: perRow === 1 ? w / 2 : x0 + off + i * step, y: 36 + ri * 42, r: 11, labelPos: 'above', labelSize: 5.4 }));
    });
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: tg.length === 1 ? w / 2 : 34 + (i * (w - 68)) / (tg.length - 1), y: 22 + rows.length * 42 + 6, orient: 'h', optSize: 4.2 }));
    // art frame
    const ax = w / 2 - 46;
    svg('rect', { x: ax, y: ay, width: 92, height: 50, rx: 3, fill: '#fff', 'fill-opacity': 0.12, stroke: ink, 'stroke-width': 1.4 }, g);
    (ART[d.art] || ART.cone)(g, ax, ay, { fill: 'none', stroke: ink, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    label(g, w / 2, ay + 66, d.logo || d.name, { size: (d.logo || d.name).length > 12 ? 11 : 14, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, ay + 77, (d.typeName || d.cat).toUpperCase(), { size: 5, fill: ink, weight: 700, ls: 1.6, opacity: 0.8 });
    const spots = (n) => (n > 1 ? [w * 0.28, w * 0.72] : [w / 2]);
    const lx = spots(leds.length), fx = spots(foots.length);
    leds.forEach((l, i) => Object.assign(l, { _fa: 1, x: lx[i], y: ly + 14, r: 3 }));
    foots.forEach((f, i) => Object.assign(f, { _fa: 1, style: 'stomp', x: fx[i], y: fy + 8, r: 12.5, labelDy: foots.length > 1 ? -18 : undefined }));
    // guard bar over the knobs (the real boxes have one)
    if (d.guard) svg('rect', { x: 4, y: 12, width: w - 8, height: 5, rx: 2.5, fill: 'url(#g-chromeR)' }, g);
    formKit.tzBadge(g, w / 2, h - 7, ink, 3.8);
    const theme = { text: ink, knob: 'white', labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: ay + 14, gap: 24, flip: ctx.flip }) };
  });

  const OP = (o) => def(Object.assign({ form: 'orange-pedal', color: '#ef7a1c' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: '#3d8bff' })])] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    OP({ id: 'orange.furcoat', name: 'Fur Jacket', ref: 'Orange Fur Coat', logo: 'FUR JACKET', typeName: 'Octave Fuzz', cat: 'Fuzz', art: 'fur', guard: true,
      algo: 'chain', cost: 1.1, noStd: true, opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', preHp: 90, gainMinDb: 16, gainMaxDb: 44, tone: 'lp', toneLo: 900, toneHi: 7500, postLp: 6500, levelMaxDb: -4 } },
        { prefix: 'o', algo: 'pitch', on: false, params: { semis1: 12, level1: 0.5, dry: 0.9, quality: 0, tone: 0.8 } },
      ] },
      controls: [t('f.level', 'VOLUME'), t('f.gain', 'FUZZ', { def: 0.65 }), t('f.tone', 'EQ'), t('o.level1', 'OCTAVE', { def: 0.5 }),
        FOOT({ action: 'bypass', label: 'FUZZ' }), FOOT({ action: 'param', p: 'o.on', toggle: true, label: 'OCTAVE' }), LED({ color: '#3d8bff' }), LED({ bind: 'param:o.on', color: '#3d8bff' })],
      desc: 'Wild 70s-style fuzz with an octave-up on its own footswitch.' }),
    OP({ id: 'orange.getaway', name: 'Escape Driver', ref: 'Orange Getaway Driver', logo: 'ESCAPE DRIVER', typeName: 'Overdrive', cat: 'Overdrive', art: 'mirror', guard: true,
      algo: 'drive', opts: { clip: 'si', bias: 0.1, preHp: 70, gainMinDb: 4, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 9000, levelMaxDb: 6 },
      controls: [t('level', 'VOLUME'), t('gain', 'GAIN', { def: 0.5 }), t('tone', 'BITE')],
      desc: 'Amp-in-a-box drive, from cranked British combo to big stack crunch.' }),
    OP({ id: 'orange.kongpressor', name: 'Ape Squeezer', ref: 'Orange Kongpressor', logo: 'APE SQUEEZER', typeName: 'Compressor', cat: 'Dynamics', art: 'squeeze',
      algo: 'comp', opts: { type: 'opto' },
      controls: [t('attack', 'ATTACK', { def: 0.3 }), t('release', 'RELEASE', { def: 0.4 }), t('level', 'VOLUME', { def: 0.38 }), t('tone', 'CHIME'), t('sustain', 'SQUASH', { def: 0.5 })],
      desc: 'Class-A style compressor: Squash sets the amount, Chime keeps the top end sparkling.' }),
    OP({ id: 'orange.twostroke', name: 'Two Cycle Boost', ref: 'Orange Two Stroke Boost EQ', logo: 'TWO CYCLE', typeName: 'Boost / EQ', cat: 'Boost', art: 'piston',
      algo: 'chain', cost: 0.5, opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'clean', gainMinDb: 0, gainMaxDb: 18, tone: 'none', levelMaxDb: 14 } },
        { prefix: 'p', algo: 'peq', params: { mid1gain: 8 } },
      ] },
      controls: [t('d.level', 'VOLUME', { def: 0.5 }), t('d.gain', 'GAIN', { def: 0.25 }), K('p.mid1freq', 'FREQ', { min: 100, max: 4000, def: 800, curve: 'log', display: (v) => Math.round(v) + ' Hz' }), K('p.mid1q', 'Q', { min: 0.3, max: 6, def: 1, curve: 'log', display: (v) => v.toFixed(1) })],
      desc: 'Clean boost with a sweepable mid peak, to push an amp exactly where you want.' }),
    OP({ id: 'orange.detonator', name: 'Amp Splitter', ref: 'Orange Amp Detonator', logo: 'AMP SPLITTER', typeName: 'A/B/Y Switcher', cat: 'Utility', kind: 'Utility', art: 'bolt', cost: 0.02,
      algo: 'split', alwaysOn: true, noStd: true, ports: { ins: ['INPUT'], outs: ['AMP A', 'AMP B'] },
      controls: [TOG('inv2', 'B PHASE', ['0', '180']), FOOT({ action: 'param', p: 'ab', label: 'A / B' }), FOOT({ action: 'param', p: 'y', label: 'A + B' }), LED({ bind: 'param:ab', color: '#3d8bff' }), LED({ bind: 'param:y', color: '#3d8bff' })],
      initParams: { ab: 0, y: 0 }, derive: (p) => ({ m1: !p.y && p.ab ? 1 : 0, m2: !p.y && !p.ab ? 1 : 0 }),
      desc: 'Send your guitar to amp A, amp B or both at once. Flip B phase if the two amps cancel.' }),
    OP({ id: 'orange.bangeetar', name: 'Bax Bandito', ref: 'Orange Bax Bangeetar Guitar Pre-EQ', logo: 'BAX BANDITO', typeName: 'Guitar Pre-EQ', cat: 'Overdrive', art: 'cone',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 6, preHp: 80, gainMinDb: 6, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 14, bassF: 100, midMin: 250, midMax: 3500, trebleF: 3500, postLp: 8000, levelMaxDb: 2 },
      controls: [t('level', 'VOLUME'), t('gain', 'GAIN', { def: 0.45 }), t('bass', 'BASS'), t('mid', 'MIDDLE'), t('midfreq', 'FREQ'), t('treble', 'TREBLE')],
      desc: 'Valve-style guitar preamp with a sweepable mid, clean edge to thick Orange crunch.' }),
  ]);
}
