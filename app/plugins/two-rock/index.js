// Built-in Tone Zone plugin: Two-Rock.
// Blocks inspired by Two-Rock gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    AMPX({ id: 'tworock.amp-classicreverb', name: 'Dual-Stone Classic Verb', ref: 'Two-Rock Classic Reverb Signature', tolex: '#151515', panel: '#c4c8cc', panelText: '#121212', grille: 'wheat', logo: 'Dual-Stone', logoColor: '#2a2a2a', knob: 'chicken', piping: '#b9bcc0',
      opts: { models: [
        { base: 'twin', stages: [[36, 1.7, 0.18, 12500, 22], [30, 1.8, 0.2, 9800, 32]], brightHz: 2200, brightDb: 5, pwrH: 2.8, sag: 0.25, otLp: 7600 },
        { base: 'dumble', stages: [[44, 1.45, 0.27, 10800, 35], [36, 1.25, 0.32, 8200, 100], [26, 1.3, 0.3, 7400, 80]], pwrH: 2.6, sag: 0.35, otLp: 7100 },
      ] },
      controls: [k('cv', 'VOLUME', { def: 0.45, virtual: true }), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('lg', 'LEAD GAIN', { def: 0.55, virtual: true }), k('master', 'LEAD MASTER'), k('r.mix', 'REVERB', { def: 0.15 }), k('presence', 'PRESENCE'), TOG('channel', 'CHANNEL', ['CLEAN', 'LEAD']), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      derive: (u) => ({ gain: (u.channel ?? 0) ? u.lg ?? 0.55 : u.cv ?? 0.45 }), desc: 'Big, three-dimensional boutique clean and a smooth, touch-sensitive lead.' }),
    CAB({ id: 'tworock.cab-1x12', name: '1x12 Dual-Stone', ref: 'Two-Rock 1x12 (open back)', opts: { cab: { hp: 90, hpQ: 1.0, resDb: 2.5, lp: 6300, open: true, peaks: [[200, 1, 1.5], [1000, 1, 0.8], [2600, 1.4, 3], [4600, 2, 2]], seed: 101 } }, cabSize: '1x12', grille: 'wheat', logo: 'Dual-Stone', logoColor: '#2a2a2a', piping: '#b9bcc0' }),
  ]);
  tz.addDefs([
    AMPX({ id: 'tworock.amp-studiopro35', name: 'Dual-Stone Studio 35', ref: 'Two-Rock Studio Pro 35', tolex: '#151515', panel: '#c4c8cc', panelText: '#121212', grille: 'wheat', logo: 'Dual-Stone', logoColor: '#2a2a2a', knob: 'chicken', piping: '#b9bcc0',
      opts: { voice: { base: 'twin', stages: [[38, 1.55, 0.2, 12000, 25], [34, 1.45, 0.24, 9500, 40], [24, 1.4, 0.26, 8000, 60]], pwrH: 2.4, sag: 0.3, otLp: 7200, presHz: 3800 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('master', 'MASTER'), k('treble', 'TREBLE', { def: 0.55 }), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('ctr', 'CONTOUR', { def: 0.3, virtual: true }), k('r.decay', 'REV SEND', { def: 0.45 }), k('r.mix', 'REV RETURN', { def: 0.15 })],
      derive: (u) => ({ mid: cl((u.mid ?? 0.5) * (1 - 0.5 * (u.ctr ?? 0.3)) + 0.05), presence: 0.45 + 0.2 * (u.ctr ?? 0.3) }),
      trim: -1, desc: 'Single-channel 35 W 6L6 head: sweet, touch-sensitive clean to smooth drive, with spring reverb and a Contour control.' }),
    CABM({ id: 'tworock.cab-2x12', name: '2x12 Dual-Stone', ref: 'Two-Rock 2x12 (closed back)', opts: { cab: { hp: 80, hpQ: 1.4, resDb: 4, lp: 6200, peaks: [[120, 1, 2], [1000, 1, 0.8], [2600, 1.4, 3], [4600, 2, 2]], seed: 102 } }, cabSize: '2x12', grille: 'wheat', logo: 'Dual-Stone', logoColor: '#2a2a2a', piping: '#b9bcc0' },
      [{ type: 0, spk: 0, pos: 0.4 }, { type: 2, spk: 1, pos: 0.3, dist: 0.2, lvl: -4 }]),
  ]);
}
