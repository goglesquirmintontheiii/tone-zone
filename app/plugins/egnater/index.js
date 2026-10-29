// Built-in Tone Zone plugin: Egnater.
// Blocks inspired by Egnater gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  // Tweaker switches: EQ (USA / AC / BRIT), gain range, vintage / modern feel, tight, bright
  const eq = (u) => {
    const e = u.eq ?? 0, b = u.bass ?? 0.5, m = u.mid ?? 0.5, t = u.treble ?? 0.5;
    const r = e === 0 ? { bass: b + 0.05, mid: m * 0.75, treble: t } : e === 1 ? { bass: b - 0.08, mid: m, treble: t + 0.1 } : { bass: b, mid: m + 0.15, treble: t };
    if (u.tight) r.bass *= 0.75;
    return { bass: cl(r.bass), mid: cl(r.mid), treble: cl(r.treble) };
  };
  tz.addDefs([
    AMPX({ id: 'egnater.amp-tweaker40', name: 'Tinkerer 40', ref: 'Egnater Tweaker 40', tolex: '#111', panel: '#161616', panelText: '#eaeaea', grille: 'black', logo: 'TINKERER', logoFont: "'Oswald', sans-serif", logoSize: 28, logoColor: '#e84a3a', knob: 'mxr', piping: '#9a9a9a',
      opts: { models: [
        { base: 'twin', stages: [[34, 1.6, 0.2, 11500, 30], [30, 1.7, 0.2, 9000, 40]], pwrH: 2.2, sag: 0.3, otLp: 7000 },
        { base: 'deluxe', stages: [[40, 1.4, 0.24, 11000, 35], [34, 1.3, 0.28, 8500, 55], [24, 1.3, 0.28, 7500, 70]], pwrH: 2, sag: 0.35, otLp: 6800 },
        { base: 'plexi', stages: [[42, 1.4, 0.3, 11000, 45], [36, 1.25, 0.34, 8400, 100], [28, 1.25, 0.3, 7400, 90]], pwrH: 2, sag: 0.3, otLp: 6600 },
        { base: 'jcm800', stages: [[45, 1.35, 0.3, 10000, 60], [42, 1.15, 0.36, 7600, 130], [38, 1.05, 0.4, 6900, 120], [26, 1.2, 0.3, 6500, 90]], tight: 0.25, pwrH: 2, sag: 0.25, otLp: 6400 },
      ] },
      controls: [k('cg', 'CLEAN GAIN', { def: 0.45, virtual: true }), k('cv', 'CLEAN VOL', { virtual: true }), k('og', 'OD GAIN', { def: 0.6, virtual: true }), k('ov', 'OD VOL', { virtual: true }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'),
        TOG('ch', 'CHANNEL', ['CLEAN', 'OD'], { virtual: true, def: 1 }), TOG('eq', 'EQ', ['USA', 'AC', 'BRIT'], { virtual: true, def: 2 }), TOG('hot', 'GAIN', ['CLEAN', 'HOT'], { virtual: true, def: 1 }),
        TOG('vm', 'FEEL', ['VINT', 'MOD'], { virtual: true }), TOG('tight', 'TIGHT', ['OFF', 'ON'], { virtual: true }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      derive: (u) => Object.assign({ channel: (u.ch ?? 1) * 2 + (u.hot ?? 1), gain: (u.ch ?? 1) ? u.og ?? 0.6 : u.cg ?? 0.45, master: (u.ch ?? 1) ? u.ov ?? 0.5 : u.cv ?? 0.5, sag: u.vm ? 0.25 : 0.6, presence: u.vm ? 0.62 : 0.45 }, eq(u)),
      trim: -8, desc: 'Two-channel 40 W head with Tweaker switches: USA / AC / Brit EQ, clean or hot gain, vintage or modern feel, tight and bright.' }),
    CABM({ id: 'egnater.cab-212x', name: '2x12 Tinkerer', ref: 'Egnater Tweaker 212X (Celestion Elite-80)', opts: { cab: { hp: 78, hpQ: 1.5, resDb: 4.5, lp: 5800, peaks: [[120, 1, 2], [900, 1, 1], [2600, 1.4, 4], [4500, 2, 2]], seed: 381 } }, cabSize: '2x12', grille: 'black', logo: 'TINKERER', logoFont: "'Oswald', sans-serif", logoSize: 15, logoColor: '#e84a3a', piping: '#9a9a9a' }),
  ]);
}
