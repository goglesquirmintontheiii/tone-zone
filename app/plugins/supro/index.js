// Built-in Tone Zone plugin: Supro.
// Blocks inspired by Supro gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    AMPX({ id: 'supro.amp-blackmagick', name: 'Supremo Dark Magic', ref: 'Supro 1695T Black Magick', combo: true, speakers: 1, tolex: '#1b1b1d', panel: '#1a1a1a', panelText: '#e6e6e6', grille: 'silver', logo: 'Supremo', logoColor: '#e9e9e9', knob: 'chicken', piping: '#cfcfcf',
      opts: { voice: { base: 'deluxe', stages: [[44, 1.2, 0.32, 8500, 30], [36, 1.15, 0.36, 7000, 60]], stack: 'fender', tsPos: 2, power: 2, pwrH: 1.0, sag: 0.6, nfb: 0, otLp: 6000, otHp: 80, presHz: 0 } },
      controls: [k('gain', 'VOLUME', { def: 0.6 }), k('treble', 'TREBLE'), k('bass', 'BASS'), k('t.rate', 'SPEED', { def: 0.45 }), k('t.depth', 'DEPTH', { def: 0 })],
      fixed: { master: 0.55 }, trem: { mode: 2 }, desc: 'Single-channel class-A combo: raw, gritty and huge when cranked, with bias tremolo.' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Supro's pedal line: navy boxes, cream knobs.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, SLIDER, def, ten, db, ms } = tz.helpers;
  // plain stomp box for this brand: knob rows (optionally on a dark plate), toggles, logo, LED, footswitch.
  // Jacks sit below the controls so their labels never cover a knob.
  tz.addForm('supro-stomp', (ctx, d) => {
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

  const SP = (o) => def(Object.assign({ form: 'supro-stomp' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    SP({ id: 'supro.drive', name: 'Super Drive', ref: 'Supro Drive', logo: 'SUPER DRIVE', typeName: 'Analog Overdrive', cat: 'Overdrive', color: '#1f2d4d', text: '#f1e9d8', knob: 'cream', accent: '#c9b37a',
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 70, gainMinDb: 4, gainMaxDb: 38, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 8000, levelMaxDb: 4, modes: [{}, { gainMinDb: 10, gainMaxDb: 44 }] },
      controls: [t('level', 'LEVEL'), t('tone', 'TONE'), t('gain', 'DRIVE', { def: 0.5 }), TOG('mode', 'BOOST', ['OFF', 'ON'])],
      desc: 'The raw, gritty voice of a cranked small class-A combo.' }),
    SP({ id: 'supro.fuzz', name: 'Super Fuzz', ref: 'Supro Fuzz', logo: 'SUPER FUZZ', typeName: 'Fuzz', cat: 'Fuzz', color: '#1f2d4d', text: '#f1e9d8', knob: 'cream', accent: '#c9b37a',
      algo: 'drive', opts: { clip: 'ge', bias: 0.25, preHp: 80, gainMinDb: 18, gainMaxDb: 46, tone: 'lp', toneLo: 900, toneHi: 7000, postLp: 6500, levelMaxDb: -3 },
      controls: [t('level', 'LEVEL'), t('tone', 'TONE'), t('gain', 'FUZZ', { def: 0.65 })],
      desc: 'Thick germanium-style fuzz that cleans up with your guitar volume.' }),
    SP({ id: 'supro.tremolo', name: 'Super Trem', ref: 'Supro Tremolo', logo: 'SUPER TREM', typeName: 'Tremolo', cat: 'Modulation', color: '#1f2d4d', text: '#f1e9d8', knob: 'cream', accent: '#c9b37a',
      algo: 'tremolo', fixed: { wave: 0.3 },
      controls: [t('rate', 'SPEED', { def: 0.45 }), t('depth', 'DEPTH', { def: 0.6 }), t('level', 'LEVEL', { def: 0.56 }), TOG('mode', 'MODE', ['BIAS', 'HARMONIC'], { values: [2, 1] })],
      desc: 'Amp-style tremolo: throbbing bias trem or swirling harmonic trem.' }),
    SP({ id: 'supro.delay', name: 'Super Echo', ref: 'Supro Analog Delay', logo: 'SUPER ECHO', typeName: 'Analog Delay', cat: 'Delay', color: '#1f2d4d', text: '#f1e9d8', knob: 'cream', accent: '#c9b37a',
      algo: 'delay', opts: { maxMs: 600 }, fixed: { mode: 1 }, cost: 0.8,
      controls: [K('time', 'TIME', { min: 40, max: 600, def: 340, curve: 'log', display: ms }), t('feedback', 'REPEATS', { def: 0.35 }), t('mix', 'MIX', { def: 0.35 })],
      desc: 'Warm, dark BBD echo up to 600 ms.' }),
    SP({ id: 'supro.flanger', name: 'Super Flange', ref: 'Supro Flanger', logo: 'SUPER FLANGE', typeName: 'Analog Flanger', cat: 'Modulation', color: '#1f2d4d', text: '#f1e9d8', knob: 'cream', accent: '#c9b37a',
      algo: 'flanger',
      controls: [t('manual', 'MANUAL'), t('speed', 'RATE', { def: 0.3 }), t('width', 'DEPTH', { def: 0.6 }), t('regen', 'REGEN', { def: 0.55 }), TOG('mode', 'DIMENSION', ['1', '2'], { values: [0, 1] })],
      desc: 'Analog flanger with a Dimension switch for a doubled, deeper sweep.' }),
  ]);
}
