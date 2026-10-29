// Built-in Tone Zone plugin: Randall.
// Blocks inspired by Randall gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  // RG100ES: separate EQ per channel, two cascaded lead gains and a Shape (mid scoop) control
  tz.addDefs([
    AMPX({ id: 'randall.amp-rg100es', name: 'Randle RG 100', ref: 'Randall RG100ES', tolex: '#111', panel: '#151515', panelText: '#eeeeee', grille: 'black', logo: 'RANDLE', logoFont: "'Oswald', sans-serif", logoSize: 30, logoColor: '#f2f2f2', knob: 'mxr', piping: '#d8d8d8',
      opts: { models: [
        { base: 'jc120', stages: [[24, 2.4, 0.1, 12000, 35], [20, 2.6, 0.1, 10000, 40]], power: 3, pwrH: 4, sag: 0.05, otLp: 9000 },
        { base: 'jcm800', stages: [[44, 1.3, 0.32, 9500, 60], [42, 1.15, 0.36, 7500, 120], [38, 1.05, 0.4, 6800, 110]], power: 3, tight: 0.35, pwrH: 3.5, sag: 0.05, otLp: 7200 },
      ] },
      controls: [k('cl', 'LEVEL', { def: 0.45, virtual: true }), k('cb', 'BASS', { virtual: true }), k('cm', 'MID', { virtual: true }), k('ct', 'TREBLE', { virtual: true }),
        k('g1', 'GAIN 1', { def: 0.6, virtual: true }), k('g2', 'GAIN 2', { def: 0.5, virtual: true }), k('lb', 'BASS', { def: 0.55, virtual: true }), k('lm', 'MID', { virtual: true }), k('lt', 'TREBLE', { def: 0.55, virtual: true }), k('shape', 'SHAPE', { def: 0.3, virtual: true }),
        k('cmv', 'CLEAN VOL', { virtual: true }), k('lmv', 'LEAD VOL', { virtual: true }), k('r.mix', 'REVERB', { def: 0.12 }), TOG('ch', 'CHANNEL', ['CLEAN', 'LEAD'], { virtual: true, def: 1 })],
      derive: (u) => ((u.ch ?? 1)
        ? { channel: 1, gain: cl(0.45 * (u.g1 ?? 0.6) + 0.45 * (u.g2 ?? 0.5) + 0.1), bass: u.lb ?? 0.55, mid: cl((u.lm ?? 0.5) - 0.4 * (u.shape ?? 0.3) + 0.1), treble: u.lt ?? 0.55, master: u.lmv ?? 0.5 }
        : { channel: 0, gain: u.cl ?? 0.45, bass: u.cb ?? 0.5, mid: u.cm ?? 0.5, treble: u.ct ?? 0.5, master: u.cmv ?? 0.5 }),
      trim: -4, desc: 'Solid-state metal head: glassy clean, two cascaded lead gains and a Shape knob for the scooped 90s sound.' }),
    CABM({ id: 'randall.cab-ra412', name: '4x12 Randle RA', ref: 'Randall RA412 4x12 (slant)', opts: { cab: { hp: 70, hpQ: 1.8, resDb: 5.5, lp: 5300, peaks: [[110, 1, 2.5], [450, 1, -1.5], [2500, 1.4, 4], [4200, 2, 2.5]], seed: 311 } }, cabSize: '4x12', grille: 'black', logo: 'RANDLE', logoFont: "'Oswald', sans-serif", logoSize: 16, logoColor: '#f2f2f2', piping: '#d8d8d8' },
      [{ type: 0, spk: 0, pos: 0.2, dist: 0.08 }]),
  ]);
}
