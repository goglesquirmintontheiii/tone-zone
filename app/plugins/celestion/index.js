// Built-in Tone Zone plugin: Celestion.
// Blocks inspired by Celestion gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    CAB({ id: 'cab.2x12cream', name: '2x12 Cream', ref: '2x12 Celestion Creamback', opts: { model: '2x12cream' }, cabSize: '2x12', grille: 'wheat', logo: 'TZ 212', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
    CAB({ id: 'cab.1x12open', name: '1x12 Open Blue', ref: 'Open-back 1x12 Alnico Blue', opts: { model: '1x12open' }, cabSize: '1x12', grille: 'diamond', logo: 'Chime', logoColor: '#eee' }),

    // ---------------- v0.2
    CAB({ id: 'celestion.cab-g12h4x12', name: '4x12 TZ H30', ref: '4x12 Celestion G12H-30', opts: { cab: { hp: 72, hpQ: 1.7, resDb: 5, lp: 5400, peaks: [[110, 1, 2.5], [700, 1, 1.5], [2000, 1.3, 3], [3600, 2, 2.5]], seed: 81 } }, cabSize: '4x12', grille: 'wheat', logo: 'TZ 412 H', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
    CAB({ id: 'celestion.cab-gold1x12', name: '1x12 TZ Gold', ref: '1x12 Celestion Alnico Gold (open back)', opts: { cab: { hp: 100, hpQ: 0.9, resDb: 2, lp: 6400, open: true, peaks: [[900, 1, 1.5], [2400, 1.3, 3], [4800, 2, 2]], seed: 82, detail: 2 } }, cabSize: '1x12', grille: 'wheat', logo: 'TZ Gold', logoFont: "'Oswald', sans-serif", logoColor: '#7a5a12' }),
    CAB({ id: 'celestion.cab-v30-1x12', name: '1x12 TZ V30', ref: '1x12 Celestion Vintage 30 (closed back)', opts: { cab: { hp: 90, hpQ: 1.4, resDb: 4, lp: 5500, peaks: [[140, 1, 1.5], [1500, 1.2, 2], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 83 } }, cabSize: '1x12', grille: 'black', logo: 'TZ V30', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),
    CAB({ id: 'celestion.cab-g12-65', name: '4x12 TZ 65', ref: '4x12 Celestion G12-65', opts: { cab: { hp: 70, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2.5], [450, 1, 1.5], [1800, 1.3, 2.5], [3200, 1.8, 1.5]], seed: 84 } }, cabSize: '4x12', grille: 'black', logo: 'TZ 412 65', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),
  ]);
  tz.addDefs([
    CABM({ id: 'celestion.cab-v30-2x12', name: '2x12 TZ V30', ref: '2x12 Celestion Vintage 30 (closed back)', opts: { cab: { hp: 78, hpQ: 1.6, resDb: 4.5, lp: 5600, peaks: [[120, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 85 } }, cabSize: '2x12', grille: 'black', logo: 'TZ 212 V', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' },
      [{ type: 0, spk: 0, pos: 0.3 }, { type: 2, spk: 0, pos: -0.5, dist: 0.18, lvl: -4 }]),
    CABM({ id: 'celestion.cab-gb1x12', name: '1x12 TZ Green', ref: '1x12 Celestion G12M Greenback (closed back)', opts: { cab: { hp: 90, hpQ: 1.4, resDb: 4, lp: 5000, peaks: [[130, 1, 1.5], [800, 1, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 86 } }, cabSize: '1x12', grille: 'wheat', logo: 'TZ Green', logoFont: "'Oswald', sans-serif", logoColor: '#2a4a2a' }),
    CABM({ id: 'celestion.cab-g10-4x10', name: '4x10 TZ G10', ref: '4x10 Celestion G10 Vintage (open back)', opts: { cab: { hp: 95, hpQ: 1.0, resDb: 2.5, lp: 5800, open: true, peaks: [[200, 1, 1], [1000, 1, 1.5], [2400, 1.4, 3.5], [4200, 2, 2]], seed: 87 } }, cabSize: '4x10', grille: 'wheat', logo: 'TZ 410', logoFont: "'Oswald', sans-serif", logoColor: '#222' }),
    CABM({ id: 'celestion.cab-copper-2x12', name: '2x12 TZ Copper', ref: '2x12 Celestion Neo Copperback (closed back)', opts: { cab: { hp: 80, hpQ: 1.5, resDb: 4, lp: 6000, peaks: [[120, 1, 2], [700, 1, 1], [2200, 1.3, 3.5], [4200, 2, 2.5]], seed: 88 } }, cabSize: '2x12', grille: 'black', logo: 'TZ Copper', logoFont: "'Oswald', sans-serif", logoColor: '#c87533' },
      [{ type: 0, spk: 1, pos: 0.35 }]),
  ]);
}
