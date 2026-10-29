// Built-in Tone Zone plugin: Hughes & Kettner.
// Blocks inspired by Hughes & Kettner gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, preampPair, stomp } = tz.builders;
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
  // three radio footswitches set one channel param
  const radio = (id, p = 'chsel') => tz.blockHooks(id, { foot(view, ctl, down) { if (ctl.chan === undefined) return false; if (down) tz.app.setParam(view.block.id, p, ctl.chan); return true; } });
  // Tubeman-style floor preamp: black chassis, tube window, three channel switches
  tz.addForm('hk-floor', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = 300, h = 214, txt = d.text || '#e8e8e8';
    formKit.body(g, w, h, d.color || '#1a1a1c', { rx: 10, brushed: true });
    svg('rect', { x: 8, y: 8, width: w - 16, height: 118, rx: 6, fill: '#0b0b0c', 'fill-opacity': 0.75, stroke: '#000' }, g);
    // tube window
    svg('rect', { x: 214, y: 72, width: 66, height: 46, rx: 5, fill: '#120a06', stroke: '#555', 'stroke-width': 1.5 }, g);
    svg('ellipse', { cx: 247, cy: 95, rx: 26, ry: 11, fill: '#ff7a1a', 'fill-opacity': 0.28 }, g);
    svg('rect', { x: 226, y: 88, width: 42, height: 14, rx: 7, fill: '#d9d9d9', 'fill-opacity': 0.25, stroke: '#bbb', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 238, y: 92, width: 18, height: 6, rx: 2, fill: '#ff9a3a', 'fill-opacity': 0.85 }, g);
    label(g, 247, 113, 'TUBE', { size: 4.6, fill: '#aaa', weight: 700, ls: 1.4 });
    label(g, w / 2, 142, d.logo || d.name, { size: 15, fill: d.logoColor || txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.6 });
    label(g, w / 2, 153, (d.typeName || '').toUpperCase(), { size: 5, fill: txt, weight: 700, ls: 1.6, opacity: 0.7 });
    formKit.tzBadge(g, w - 30, h - 9, txt, 4);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: 5.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y, r: 11, labelPos: 'above' }, o);
  tz.addDefs([
    AMPX({ id: 'hk.amp-triamp3', name: 'Tri-Volt Mk 3', ref: 'Hughes & Kettner TriAmp Mark 3', tolex: '#101010', panel: '#123a7a', panelText: '#e3eeff', grille: 'black', logo: 'TRI-VOLT', logoFont: "'Oswald', sans-serif", logoSize: 26, logoColor: '#8fc1ff', knob: 'chrome', piping: '#4d8fe8',
      opts: { models: [
        { base: 'twin', stages: [[34, 1.6, 0.2, 11500, 30], [30, 1.7, 0.2, 9000, 40]], pwrH: 2.4, sag: 0.25, otLp: 7200 },
        { base: 'plexi', stages: [[42, 1.4, 0.3, 11000, 45], [36, 1.25, 0.34, 8400, 100], [28, 1.25, 0.3, 7400, 90]], pwrH: 2, sag: 0.35, otLp: 6600 },
        { base: 'jcm800', stages: [[45, 1.35, 0.3, 10000, 60], [42, 1.15, 0.36, 7600, 130], [38, 1.05, 0.4, 6900, 120], [26, 1.2, 0.3, 6500, 90]], tight: 0.35, pwrH: 2.2, sag: 0.25, otLp: 6400 },
      ] },
      controls: [SEL('channel', 'AMP', ['1', '2', '3'], { def: 1, sweep: 70, labelPos: 'below' }), k('gain', 'GAIN', { def: 0.55 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME'), k('presence', 'PRESENCE'), k('depth', 'RESONANCE'), TOG('boost', 'BOOST', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ gain: cl((u.gain ?? 0.55) + 0.2 * (u.boost ?? 0)) }),
      trim: -4, desc: 'Three amps in one blue-lit head: clean, British crunch and modern lead, with a stomp boost.' }),
    CABM({ id: 'hk.cab-tc412', name: '4x12 Tri-Volt TC', ref: 'Hughes & Kettner TC412 A60 (Celestion Vintage 30)', opts: { cab: { hp: 70, hpQ: 1.8, resDb: 5.5, lp: 5600, peaks: [[110, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 321 } }, cabSize: '4x12', grille: 'black', logo: 'TRI-VOLT', logoFont: "'Oswald', sans-serif", logoSize: 15, logoColor: '#8fc1ff', piping: '#4d8fe8' },
      [{ type: 0, spk: 0, pos: 0.3 }, { type: 2, spk: 1, pos: 0.5, dist: 0.25, lvl: -4 }]),
    def({ id: 'hk.tubeman', name: 'Tube Fella', ref: 'Hughes & Kettner Tubeman', cat: 'Preamp', form: 'hk-floor', color: '#1b1b1e', text: '#e6e6e6', logo: 'TUBE FELLA', logoColor: '#8fc1ff', typeName: '3-channel tube preamp', knob: 'chrome', cost: 1.8,
      algo: 'amp', opts: { preamp: true, models: [
        { base: 'twin', stages: [[32, 1.7, 0.18, 11500, 35], [28, 1.8, 0.2, 9000, 40]] },
        { base: 'plexi', stages: [[42, 1.4, 0.3, 10500, 50], [36, 1.25, 0.34, 8200, 100]] },
        { base: 'jcm800', stages: [[45, 1.35, 0.3, 10000, 60], [42, 1.15, 0.36, 7600, 120], [36, 1.1, 0.38, 6900, 110]], tight: 0.25 },
      ] },
      ports: { ins: ['INPUT'], outs: ['TO POWER AMP', 'TO MIXER'] },
      controls: [at(k('cv', 'CLEAN VOL', { virtual: true }), 34, 42), at(k('cg', 'CR GAIN', { def: 0.55, virtual: true }), 80, 42), at(k('crv', 'CR VOL', { virtual: true }), 126, 42),
        at(k('lg', 'LEAD GAIN', { def: 0.6, virtual: true }), 172, 42), at(k('voc', 'VOICING', { virtual: true }), 218, 42), at(k('lv', 'LEAD VOL', { virtual: true }), 264, 42),
        at(k('bass', 'BASS'), 34, 98), at(k('mid', 'MID'), 80, 98), at(k('treble', 'TREBLE'), 126, 98), at(k('mv', 'MASTER', { virtual: true }), 172, 98),
        { t: 'knob', p: 'chsel', label: 'CHANNEL', hidden: true, virtual: true, min: 0, max: 2, step: 1, def: 1 },
        LED({ bind: 'param:chsel:=0', color: '#3ddc84', x: 60, y: 166, r: 3 }), LED({ bind: 'param:chsel:=1', color: '#ffb000', x: 150, y: 166, r: 3 }), LED({ bind: 'param:chsel:=2', color: '#ff2a1a', x: 240, y: 166, r: 3 }),
        FOOT({ action: 'param', chan: 0, label: 'CLEAN', x: 60, y: 188, r: 12, style: 'stomp' }), FOOT({ action: 'param', chan: 1, label: 'CRUNCH', x: 150, y: 188, r: 12, style: 'stomp' }), FOOT({ action: 'param', chan: 2, label: 'LEAD', x: 240, y: 188, r: 12, style: 'stomp' })],
      derive: (u) => {
        const c = Math.round(u.chsel ?? 1), m = ((u.mv ?? 0.5) - 0.5) * 12;
        const g = [0.3, u.cg ?? 0.55, u.lg ?? 0.6][c], v = [u.cv ?? 0.5, u.crv ?? 0.5, u.lv ?? 0.5][c];
        const o = { channel: c, gain: g, level: Math.max(-30, Math.min(12, (v - 0.5) * 24 + m - 3)) };
        if (c === 2) { o.mid = cl((u.mid ?? 0.5) + ((u.voc ?? 0.5) - 0.5) * 0.4); o.treble = cl((u.treble ?? 0.5) + ((u.voc ?? 0.5) - 0.5) * 0.2); }
        return o;
      },
      desc: 'Three-channel tube preamp pedal (clean, crunch, lead) with a shared EQ and a speaker-simulated mixer out.' }),
  ]);
  radio('hk.tubeman');
}
