// Built-in Tone Zone plugin: Soldano.
// Blocks inspired by Soldano gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.slo', name: 'Solo 100', ref: 'Soldano SLO-100', opts: { model: 'slo' }, tolex: '#141414', panel: '#c7ccd2', panelText: '#121212', grille: 'black', logo: 'Solo', logoColor: '#e4e6e8', knob: 'chrome', controls: marshallKnobs('PREAMP', 'MASTER') })),

    // ---------------- v0.2
    AMPX({ id: 'soldano.amp-hr50', name: 'Solo Hot Rod 50', ref: 'Soldano Hot Rod 50+', tolex: '#141414', panel: '#c7ccd2', panelText: '#121212', grille: 'black', logo: 'Solo', logoColor: '#e4e6e8', knob: 'chrome',
      opts: { models: [
        { base: 'plexi', stages: [[42, 1.5, 0.28, 11500, 40], [34, 1.35, 0.33, 9000, 90]], pwrH: 2.2, sag: 0.3, otLp: 7000 },
        { base: 'slo', drive: 1.0, tight: 0.2, otLp: 6700 },
      ] },
      controls: [k('ng', 'NORMAL', { def: 0.5, virtual: true }), k('og', 'OVERDRIVE', { def: 0.6, virtual: true }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'MASTER'), k('presence', 'PRESENCE'), TOG('channel', 'CHANNEL', ['NORMAL', 'OD'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      derive: (u) => ({ gain: (u.channel ?? 1) ? u.og ?? 0.6 : u.ng ?? 0.5 }), desc: 'The SLO lead in a 50 W, two-channel package.' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Soldano drive pedals: black boxes with a chrome control plate.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, SLIDER, def, ten, db, ms } = tz.helpers;
  // plain stomp box for this brand: knob rows (optionally on a dark plate), toggles, logo, LED, footswitch.
  // Jacks sit below the controls so their labels never cover a knob.
  tz.addForm('soldano-stomp', (ctx, d) => {
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

  const SP = (o) => def(Object.assign({ form: 'soldano-stomp' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    SP({ id: 'soldano.slopedal', name: 'SLX Pedal', ref: 'Soldano SLO Pedal', logo: 'SLX', logoSize: 18, typeName: 'Super Lead Overdrive', cat: 'Distortion', color: '#141416', plate: '#2a2b2e', accent: '#c9ccd1', knob: 'chrome', perRow: 3,
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 8, preHp: 90, gainMinDb: 10, gainMaxDb: 48, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 3000, postLp: 7600, levelMaxDb: -4, modes: [{}, { preEq: [{ type: 'hs', f: 2500, q: 0.7, db: 4 }] }] },
      controls: [t('gain', 'PREAMP', { def: 0.55 }), t('bass', 'BASS'), t('mid', 'MIDDLE'), t('treble', 'TREBLE'), t('bright', 'PRESENCE', { def: 0.3 }), t('level', 'MASTER'), TOG('mode', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'The classic super lead tone: creamy, singing, endless sustain.' }),
    SP({ id: 'soldano.supercharger', name: 'Supercharged GT', ref: 'Soldano Super Charger GTO', logo: 'SUPERCHARGED', typeName: 'Overdrive', cat: 'Overdrive', color: '#1c1c1f', plate: '#2a2b2e', accent: '#c9ccd1', knob: 'chrome', perRow: 3,
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 80, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 8200, levelMaxDb: 2, modes: [{}, { preEq: [{ type: 'hs', f: 2500, q: 0.7, db: 3 }] }] },
      controls: [t('gain', 'GAIN', { def: 0.5 }), t('level', 'VOLUME'), t('bass', 'BASS'), t('mid', 'MIDDLE'), t('treble', 'TREBLE'), TOG('mode', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Hot-rod style overdrive, from crunch to sustaining lead.' }),
  ]);
}
