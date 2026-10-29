// Built-in Tone Zone plugin: Gallien-Krueger.
// Blocks inspired by Gallien-Krueger gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  tz.addDefs([
    preampPair(AMP({ id: 'amp.gk800', name: 'GK 800 Bass', ref: 'Gallien-Krueger 800RB', cat: 'Bass Amp', opts: { model: 'gk800' }, tolex: '#151515', panel: '#151515', panelText: '#e8e8e8', grille: 'black', headGrille: false, logo: 'GK 800', logoFont: "'Oswald', sans-serif", logoColor: '#e0e0e0', knob: 'mxr',
      controls: [k('gain', 'VOLUME'), k('presence', 'CONTOUR'), k('treble', 'TREBLE'), k('mid', 'HI MID'), k('midfreq', 'LO MID'), k('bass', 'BASS'), k('master', 'MASTER')] }))
  ]);
  // MB800: 4-band EQ. The engine amp has one sweepable mid, so LO MID / HI MID share it (level and centre)
  const mids = (u) => { const lo = u.lm ?? 0.5, hi = u.hm ?? 0.5; return { mid: (lo + hi) / 2, midfreq: cl(0.5 + (hi - lo) * 0.6) }; };
  tz.addDefs([
    AMPX({ id: 'gk.amp-mb800', name: 'GeeKay MB 800', ref: 'Gallien-Krueger MB800', cat: 'Bass Amp', tolex: '#151515', panel: '#b9bdc2', panelText: '#111', grille: 'black', headGrille: false, corners: false, logo: 'GEEKAY', logoFont: "'Oswald', sans-serif", logoColor: '#e0e0e0', knob: 'mxr',
      opts: { voice: { base: 'gk800', stages: [[16, 3.5, 0.08, 14000, 25]], tsType: 3, power: 3, baxBass: 60, baxTreble: 5000, baxRange: 15, otLp: 12000 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('presence', 'CONTOUR', { def: 0.3 }), k('bass', 'BASS'), k('lm', 'LO MID', { virtual: true }), k('hm', 'HI MID', { virtual: true }), k('treble', 'TREBLE'), k('master', 'MASTER'),
        TOG('pad', '-10 dB', ['OFF', 'ON'], { virtual: true }), TOG('lim', 'LIMITER', ['OFF', 'ON'], { virtual: true, def: 1 })],
      derive: (u) => Object.assign({ gain: cl((u.gain ?? 0.45) - (u.pad ? 0.2 : 0)), sag: u.lim ? 0.35 : 0 }, mids(u)),
      desc: 'Ultra-light 800 W class-D bass head with the classic GK contour, a 4-band EQ and a limiter.' }),
    CABM({ id: 'gk.cab-neo410', name: '4x10 GeeKay Neo', ref: 'Gallien-Krueger Neo 410 (with tweeter)', bass: true, opts: { cab: { hp: 42, hpQ: 1.2, resDb: 3, lp: 7800, peaks: [[85, 1, 2.5], [600, 1, 0.5], [2400, 1.3, 2], [6000, 1.2, 2]], seed: 411, detail: 1.1 } }, cabSize: '4x10', grille: 'black', logo: 'GEEKAY', logoFont: "'Oswald', sans-serif", logoColor: '#e0e0e0' },
      [{ type: 3, spk: 0, pos: 0.3 }]),
    CABM({ id: 'gk.cab-cx115', name: '1x15 GeeKay CX', ref: 'Gallien-Krueger CX 115', bass: true, opts: { cab: { hp: 38, hpQ: 1.3, resDb: 4, lp: 4200, peaks: [[75, 1, 3], [350, 1, 1.5], [1500, 1.2, 1], [3000, 1.5, -1.5]], seed: 412, detail: 1.3 } }, cabSize: '1x15', grille: 'black', logo: 'GEEKAY', logoFont: "'Oswald', sans-serif", logoColor: '#e0e0e0' },
      [{ type: 5, pos: 0.35 }]),
  ]);
}
