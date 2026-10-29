// Built-in Tone Zone plugin: Laney.
// Blocks inspired by Laney gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, stomp } = tz.builders;
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
    AMPX({ id: 'laney.amp-lionheart', name: 'Lionhart L20', ref: 'Laney Lionheart L20H', tolex: '#e3d8be', panel: '#c8a95a', panelText: '#1e1608', grille: 'brown', logo: 'Lanie', logoColor: '#efe3c3', logoPlate: '#3a2a16', knob: 'cream', piping: '#6b4a24',
      opts: { models: [
        { base: 'ac30', stages: [[40, 1.45, 0.22, 11500, 30], [32, 1.35, 0.26, 9500, 65]], tsType: 0, stack: 'marshall', pwrH: 1.2, sag: 0.4, otLp: 7800 },
        { base: 'plexi', stages: [[46, 1.4, 0.3, 11000, 45], [40, 1.15, 0.35, 8200, 120], [28, 1.2, 0.32, 7200, 100]], tsPos: 3, power: 2, pwrH: 1.3, sag: 0.45, otLp: 7000, nfb: 0 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('presence', 'TONE'), k('r.mix', 'REVERB', { def: 0.12 }), k('master', 'VOLUME'), TOG('channel', 'CHANNEL', ['CLEAN', 'DRIVE'], { def: 1 })],
      desc: 'Class-A EL84 head: chimey clean and a rich, British drive channel.' }),
    AMPX({ id: 'laney.amp-ironheart', name: 'Ironhart 120', ref: 'Laney Ironheart IRT120H', tolex: '#141414', panel: '#2a2b2e', panelText: '#e2e2e2', grille: 'black', logo: 'LANIE', logoFont: "'Oswald', sans-serif", logoColor: '#d0262e', knob: 'chrome',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.2, 12000, 25], [28, 1.7, 0.22, 9500, 40]], stack: 'marshall', pwrH: 2.6, sag: 0.25, otLp: 7300 },
        { base: 'jcm800', stages: [[46, 1.45, 0.3, 10800, 55], [42, 1.15, 0.35, 8000, 140], [30, 1.2, 0.33, 7000, 110]], tight: 0.35, otLp: 6700 },
        { base: 'uber', drive: 1.05, tight: 0.6, otLp: 6300 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('depth', 'DYNAMICS'), k('master', 'VOLUME'), SEL('channel', 'CHANNEL', ['CLEAN', 'RHYTHM', 'LEAD'], { def: 2, sweep: 90, optSize: 4.2 })],
      desc: 'Three-channel British high gain with a tight, heavy lead.' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Black Country Customs pedals: dark boxes with copper trim.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, SLIDER, def, ten, db, ms } = tz.helpers;
  // plain stomp box for this brand: knob rows (optionally on a dark plate), toggles, logo, LED, footswitch.
  // Jacks sit below the controls so their labels never cover a knob.
  tz.addForm('laney-stomp', (ctx, d) => {
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

  const SP = (o) => def(Object.assign({ form: 'laney-stomp' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    SP({ id: 'laney.steelpark', name: 'Ironpark Boost', ref: 'Laney Black Country Customs SteelPark', logo: 'IRONPARK', typeName: 'Boost', cat: 'Boost', color: '#2a2c30', accent: '#b87333', knob: 'chrome', led: '#3ddc84',
      algo: 'boost',
      controls: [t('gain', 'BOOST', { def: 0.15 }), t('bass', 'BASS'), t('treble', 'TREBLE'), t('level', 'LEVEL', { def: 0.85 }), TOG('mode', 'MODE', ['CLEAN', 'TREBLE', 'MID'], { values: [0, 1, 2] })],
      desc: 'Up to +30 dB of boost with clean, treble-booster and mid-push modes.' }),
    SP({ id: 'laney.monolith', name: 'Megalith OD', ref: 'Laney Black Country Customs Monolith', logo: 'MEGALITH', typeName: 'Overdrive', cat: 'Overdrive', color: '#2a2c30', accent: '#b87333', knob: 'chrome', led: '#3ddc84',
      algo: 'drive', opts: { preHp: 80, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 8500, levelMaxDb: 2,
        modes: [{ clip: 'jfet', gainMinDb: 0, gainMaxDb: 26, levelMaxDb: 8 }, { clip: 'asym', bias: 0.2, gainMinDb: 4, gainMaxDb: 36 }, { clip: 'diode', gainMinDb: 8, gainMaxDb: 44, levelMaxDb: -2 }] }, fixed: { mid: 0.5 },
      controls: [t('level', 'LEVEL'), t('gain', 'GAIN', { def: 0.5 }), t('bass', 'BASS'), t('treble', 'TREBLE'), TOG('mode', 'MODE', ['JANGLE', 'CRUNCH', 'ROCK'], { values: [0, 1, 2], def: 1 })],
      desc: 'Three-mode overdrive, from light jangle to big classic rock.' }),
    SP({ id: 'laney.secretpath', name: 'Hidden Lane Reverb', ref: 'Laney Black Country Customs SecretPath', logo: 'HIDDEN LANE', typeName: 'Reverb', cat: 'Reverb', color: '#2a2c30', accent: '#b87333', knob: 'chrome', led: '#3ddc84',
      algo: 'reverb', cost: 1.4, ctrl: { ins: [{ label: 'EXP', param: 'mix', min: 0, max: 0.8 }] },
      controls: [K('predelay', 'PRE DELAY', { min: 0, max: 250, def: 20, display: ms }), t('size', 'SIZE', { def: 0.5 }), t('tone', 'TONE', { def: 0.55 }), t('mix', 'VOLUME', { def: 0.3 }), TOG('mode', 'MODE', ['ROOM', 'HALL', 'PLATE'], { values: [0, 1, 2], def: 1 })],
      derive: (u) => ({ decay: 0.25 + 0.6 * (u.size ?? 0.5) }), desc: 'Room, hall and plate reverbs with pre-delay and an expression input.' }),
  ]);
}
