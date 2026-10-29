// Built-in Tone Zone plugin: Two Notes.
// Blocks inspired by Two Notes gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, preampPair, stomp } = tz.builders;
  // ---- amp helpers (same pattern in every amp-brand plugin)
  // ampFit: fixed panel layout so mini toggles don't overlap the knob row or power LED.
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
    // trim: output level offset (dB) for voicings that come out hot
    if (o.trim !== undefined) a.fixed = Object.assign({}, a.fixed, { level: o.trim });
    const pre = preampOf(Object.assign({}, a, { controls: a.controls.filter((c) => !isFx(c)) }));
    const sw = a.controls.filter((c) => (c.t === 'toggle' || c.t === 'sel') && !isFx(c)).map((c) => SEL(c.p, c.label, c.options, { values: c.values, def: c.def ?? 0, virtual: c.virtual, sweep: c.options.length > 2 ? 90 : 60, optSize: 4.2 }));
    const pc = pre.controls.filter((c) => !(c.t === 'knob' && !c.p));
    const li = pc.findIndex((c) => c.p === 'level');
    pc.splice(li, 0, ...sw);
    pre.controls = pc;
    if (o.trim !== undefined) pc.forEach((c) => { if (c.p === 'level') c.def = o.trim; });
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
  // cab with a preset mic setup. mics: [{ type, spk, pos, dist, lvl }], pos = fraction of the cone radius from the dust cap
  const { cabGeom } = tz.gfx.cabgeom;
  function CABM(o, mics = [{ type: 0, pos: 0.3 }]) {
    const d = CAB(o), g = cabGeom(d.cabSize || '4x12'), ip = {};
    mics.forEach((m, i) => {
      const n = i + 1, [cx, cy] = g.centers[Math.min(g.centers.length - 1, m.spk || 0)];
      Object.assign(ip, { [`m${n}on`]: 1, [`m${n}type`]: m.type ?? 0, [`m${n}dist`]: m.dist ?? 0.15, [`m${n}lvl`]: m.lvl ?? 0,
        [`_m${n}x`]: (cx + (m.pos ?? 0.3) * g.sr - g.gx) / g.gw, [`_m${n}y`]: (cy - g.gy) / g.gh });
    });
    d.initParams = Object.assign({}, d.initParams, ip);
    return d;
  }
  const cl = (v) => Math.max(0, Math.min(1, v));
  // Le series: channel A and B preamps run as parallel lanes. Footswitches pick A or B; the FUSION button
  // blends both (cold) or drives B harder from A (hot, approximated with extra B gain).
  const radio = (id) => tz.blockHooks(id, { foot(view, ctl, down) { if (ctl.chan === undefined) return false; if (down) tz.app.setParam(view.block.id, 'chsel', ctl.chan); return true; } });
  tz.addForm('twonotes-le', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = 330, h = 240, acc = d.accent || '#d8352e', txt = d.text || '#f2f2f2';
    formKit.body(g, w, h, d.color || '#1b1c1f', { rx: 10, brushed: true });
    svg('rect', { x: 8, y: 20, width: w - 16, height: 112, rx: 6, fill: acc }, g);
    svg('rect', { x: 8, y: 20, width: w - 16, height: 112, rx: 6, fill: 'url(#g-shadeV)', 'fill-opacity': 0.35 }, g);
    for (const x of [112, 268]) svg('path', { d: `M${x} 28 V124`, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 1.2 }, g);
    const dt = d.deckText || '#111';
    label(g, 60, 32, 'CHANNEL A', { size: 5.6, fill: dt, weight: 800, ls: 1.6 });
    label(g, 190, 32, 'CHANNEL B', { size: 5.6, fill: dt, weight: 800, ls: 1.6 });
    label(g, 290, 32, 'FUSION', { size: 5.6, fill: dt, weight: 800, ls: 1.6 });
    // small preset display
    svg('rect', { x: 26, y: 142, width: 44, height: 20, rx: 3, fill: '#050607', stroke: '#444' }, g);
    label(g, 48, 156, d.screenText || '01', { size: 10, fill: acc, font: "'Share Tech Mono', monospace", weight: 700 });
    label(g, w / 2, 154, d.logo || d.name, { size: 17, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
    label(g, w / 2, 166, (d.typeName || '').toUpperCase(), { size: 5, fill: txt, weight: 700, ls: 1.6, opacity: 0.7 });
    // labels on the dark lower half are printed here so they stay readable with any deck colour
    label(g, 90, 230, 'A', { size: 7, fill: txt, weight: 800 });
    label(g, 240, 230, 'B', { size: 7, fill: txt, weight: 800 });
    label(g, 284, 166, 'FUSION', { size: 5, fill: txt, weight: 700, ls: 1.2 });
    formKit.tzBadge(g, w - 40, h - 10, txt, 4);
    const theme = { text: dt, knob: d.knob || 'mxr', labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });
  const kn = (p, l, x, y, o = {}) => K(p, l, Object.assign({ x, y, r: 11, labelPos: 'below' }, o));
  const LE = (o) => {
    const d = def(Object.assign({ cat: 'Preamp', form: 'twonotes-le', algo: 'chain', cost: 3.4, color: '#1b1c1f', typeName: 'dual-channel tube preamp' }, o, {
      opts: { chain: [
        { prefix: 'a', algo: 'amp', group: 1, opts: { preamp: true, voice: o.voiceA } },
        { prefix: 'b', algo: 'amp', group: 1, opts: { preamp: true, voice: o.voiceB } },
      ] },
      ports: o.ports || { ins: ['INPUT'], outs: ['OUTPUT', 'XLR OUT'] }, jackKinds: o.jackKinds || { o1: 'xlr' },
      controls: [kn('a.gain', 'GAIN', 36, 56, { def: o.gA ?? 0.45 }), kn('va', 'VOLUME', 82, 56, { virtual: true }), kn('a.bass', 'BASS', 36, 102), kn('a.treble', 'TREBLE', 82, 102),
        kn('b.gain', 'GAIN', 144, 56, { def: o.gB ?? 0.6 }), kn('vb', 'VOLUME', 190, 56, { virtual: true }), kn('b.bass', 'BASS', 236, 56), kn('b.mid', 'MID', 144, 102), kn('b.midfreq', 'SWEEP', 190, 102), kn('b.treble', 'TREBLE', 236, 102),
        kn('fus', 'FUSION', 290, 56, { def: 0.5, virtual: true }), TOG('hot', 'MODE', ['COLD', 'HOT'], { virtual: true, x: 290, y: 106, orient: 'h', optSize: 4.4 }),
        BTN('', { p: 'fon', toggle: true, virtual: true, shape: 'rect', w: 18, h: 8, led: true, ledColor: '#ffb000', x: 284, y: 152, labelPos: 'none' }),
        { t: 'knob', p: 'chsel', label: 'CHANNEL', hidden: true, virtual: true, min: 0, max: 1, step: 1, def: 1 },
        LED({ bind: 'param:chsel:=0', color: '#3ddc84', x: 90, y: 182, r: 3 }), LED({ bind: 'param:chsel:=1', color: '#ff2a1a', x: 240, y: 182, r: 3 }),
        FOOT({ action: 'param', chan: 0, label: '', x: 90, y: 208, r: 13, style: 'stomp' }), FOOT({ action: 'param', chan: 1, label: '', x: 240, y: 208, r: 13, style: 'stomp' })],
      derive: (u) => {
        const b = Math.round(u.chsel ?? 1), f = u.fus ?? 0.5, fon = !!u.fon, hot = !!u.hot, t = o.trim ?? -2;
        const la = ((u.va ?? 0.5) - 0.5) * 24 + t, lb = ((u.vb ?? 0.5) - 0.5) * 24 + t;
        let al = b ? 0 : 1, bl = b ? 1 : 0, bg = u['b.gain'] ?? o.gB ?? 0.6;
        if (fon && !hot) { al = 1 - f * 0.5; bl = 0.5 + f * 0.5; al *= 0.75; bl *= 0.75; }
        if (fon && hot) { al = 0.15; bl = 1; bg = cl(bg + 0.4 * (u['a.gain'] ?? 0.45) * (0.5 + f)); }
        return { 'a.lvl': al, 'b.lvl': bl, 'b.gain': bg, 'a.level': la, 'b.level': lb, 'a.on': al > 0 ? 1 : 0, 'b.on': bl > 0 ? 1 : 0, 'a.mid': 0.5 };
      },
    }));
    radio(o.id);
    return d;
  };
  tz.addDefs([
    LE({ id: 'twonotes.leclean', name: 'La Clean', ref: 'Two Notes Le Clean', logo: 'LA CLEAN', accent: '#86c6e0', screenText: 'CL', knob: 'mxr',
      voiceA: { base: 'twin', stages: [[32, 1.7, 0.18, 12000, 30], [28, 1.8, 0.2, 9500, 40]] }, voiceB: { base: 'ac30', drive: 1.05 }, gB: 0.55,
      desc: 'Dual-channel tube preamp: vintage clean on A, 60s garage overdrive on B, with cold and hot Fusion.' }),
    LE({ id: 'twonotes.lecrunch', name: 'La Crunch', ref: 'Two Notes Le Crunch', logo: 'LA CRUNCH', accent: '#e8913f', screenText: 'CR', knob: 'mxr', trim: -4,
      voiceA: { base: 'plexi', stages: [[38, 1.5, 0.26, 11500, 40], [32, 1.4, 0.3, 9000, 80]] }, voiceB: { base: 'plexi', drive: 1.2, stages: [[44, 1.4, 0.3, 11000, 45], [36, 1.25, 0.34, 8400, 100], [26, 1.3, 0.3, 7400, 90]] },
      desc: 'Late-60s British tones: throaty clean on A, crunch on B, Fusion for stacked gain.' }),
    LE({ id: 'twonotes.lelead', name: 'La Lead', ref: 'Two Notes Le Lead', logo: 'LA LEAD', accent: '#d8352e', deckText: '#f2f2f2', screenText: 'LD', knob: 'mxr',
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'XLR OUT', 'PHONES'] }, jackKinds: { o1: 'xlr', o2: 'phones' }, trim: -3,
      voiceA: { base: 'twin', drive: 1.2, stages: [[36, 1.5, 0.22, 11500, 35], [32, 1.4, 0.26, 9000, 50]] }, voiceB: { base: 'jcm800', drive: 1.1, tight: 0.35 },
      desc: 'High-gain dual-channel tube preamp: melodic clean on A, tight overdrive with mid sweep on B.' }),
    LE({ id: 'twonotes.lebass', name: 'La Bass', ref: 'Two Notes Le Bass', logo: 'LA BASS', accent: '#5fb874', screenText: 'BS', knob: 'mxr',
      voiceA: { base: 'gk800', stages: [[14, 4.0, 0.08, 15000, 20]], tsType: 3, baxBass: 50, baxTreble: 4500, baxRange: 15 }, voiceB: { base: 'svt', drive: 1.2, stages: [[34, 1.5, 0.28, 8500, 20], [28, 1.4, 0.3, 7000, 25]] },
      desc: 'Bass tube preamp: modern clean on A, punchy overdrive on B, Fusion for heavy blends.' }),
  ]);
}
