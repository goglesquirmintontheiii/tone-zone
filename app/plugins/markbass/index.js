// Built-in Tone Zone plugin: Markbass.
// Blocks inspired by Markbass gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.markbass', name: 'Bassmark Little', ref: 'Markbass Little Mark', cat: 'Bass Amp', opts: { model: 'markbass' }, tolex: '#1a1a1a', panel: '#1a1a1a', panelText: '#f5d000', grille: 'black', headGrille: false, logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', knob: 'mxr',
      controls: [k('gain', 'GAIN'), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'MASTER')] })),
    CAB({ id: 'cab.2x10horn', name: '2x10 Neo + Horn', ref: 'Markbass-style 2x10 neo', opts: { model: '2x10horn' }, cabSize: '2x10', grille: 'black', logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', bass: true }),

    // ---------------- v0.2
    CAB({ id: 'markbass.cab-104hf', name: '4x10 Bassmark Std', ref: 'Markbass Standard 104HF', bass: true, opts: { cab: { hp: 42, hpQ: 1.1, resDb: 2.5, lp: 8500, peaks: [[90, 1, 2], [700, 1, 0.5], [4500, 1, 3.5]], seed: 121, detail: 1.0 } }, cabSize: '4x10', grille: 'black', logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', piping: '#f5d000' }),
  ]);
  // VPF: preset mid scoop, VLE: vintage speaker roll-off
  tz.addDefs([
    AMPX({ id: 'markbass.amp-bigbang', name: 'Bassmark Big Boom', ref: 'Markbass Big Bang', cat: 'Bass Amp', tolex: '#1a1a1a', panel: '#1a1a1a', panelText: '#f5d000', grille: 'black', headGrille: false, corners: false, logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', knob: 'mxr',
      opts: { voice: { base: 'markbass', tsType: 3, baxBass: 40, baxTreble: 6000, baxRange: 15 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('vpf', 'VPF', { def: 0, virtual: true }), k('vle', 'VLE', { def: 0, virtual: true }), k('bass', 'LOW'), k('ml', 'MID LOW', { virtual: true }), k('mh', 'MID HIGH', { virtual: true }), k('treble', 'HIGH'), k('master', 'MASTER')],
      derive: (u) => { const v = u.vpf ?? 0, e = u.vle ?? 0, lo = u.ml ?? 0.5, hi = u.mh ?? 0.5; return { mid: cl((lo + hi) / 2 - 0.35 * v), midfreq: cl(0.5 + (hi - lo) * 0.6), bass: cl((u.bass ?? 0.5) + 0.15 * v), treble: cl((u.treble ?? 0.5) + 0.1 * v - 0.45 * e) }; },
      desc: 'Tiny 500 W bass head with a 4-band EQ plus the VPF scoop and VLE vintage filters.' }),
    CABM({ id: 'markbass.cab-102hf', name: '2x10 Bassmark Std', ref: 'Markbass Standard 102HF', bass: true, opts: { cab: { hp: 48, hpQ: 1.1, resDb: 2.5, lp: 8500, peaks: [[100, 1, 2], [700, 1, 0.5], [4500, 1, 3]], seed: 122, detail: 1.0 } }, cabSize: '2x10', grille: 'black', logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', piping: '#f5d000' },
      [{ type: 3, spk: 0, pos: 0.3 }]),
    CABM({ id: 'markbass.cab-151hf', name: '1x15 Bassmark Std', ref: 'Markbass Standard 151HF', bass: true, opts: { cab: { hp: 38, hpQ: 1.2, resDb: 3, lp: 7500, peaks: [[70, 1, 2.5], [400, 1, 0.5], [4200, 1, 3]], seed: 123, detail: 1.1 } }, cabSize: '1x15', grille: 'black', logo: 'bassmark', logoFont: "'Inter', sans-serif", logoColor: '#f5d000', piping: '#f5d000' },
      [{ type: 5, pos: 0.3 }]),
  ]);
}
