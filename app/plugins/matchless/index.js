// Built-in Tone Zone plugin: Matchless.
// Blocks inspired by Matchless gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  tz.addDefs([
    preampPair(AMP({ id: 'amp.dc30', name: 'Matchbox 30', ref: 'Matchless DC-30', opts: { model: 'dc30' }, combo: true, speakers: 2, tolex: '#151515', panel: '#2b2b2b', panelText: '#f2f2f2', grille: 'salt', logo: 'Matchbox', logoColor: '#d8d8d8', knob: 'chicken',
      controls: [k('gain', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] }))
  ]);
  tz.addDefs([
    AMPX({ id: 'matchless.amp-chieftain', name: 'Matchbox Chief', ref: 'Matchless Chieftain 212', combo: true, speakers: 2, tolex: '#151515', panel: '#2b2b2b', panelText: '#f2f2f2', grille: 'salt', logo: 'Matchbox', logoColor: '#d8d8d8', knob: 'chicken', piping: '#e6e6e6',
      opts: { voice: { base: 'dc30', stages: [[38, 1.45, 0.24, 11500, 40], [32, 1.35, 0.28, 9000, 60], [22, 1.4, 0.26, 7800, 70]], pwrH: 2.1, sag: 0.35, otLp: 6800 } },
      controls: [k('gain', 'VOLUME', { def: 0.45 }), k('treble', 'TREBLE', { def: 0.55 }), k('bass', 'BASS'), k('presence', 'BRILLIANCE'), k('r.mix', 'REVERB', { def: 0.15 }), k('master', 'MASTER', { def: 0.55 })],
      fixed: { mid: 0.55 }, trim: -2, desc: '40 W class-A EL34 combo with a Brilliance control and spring reverb: big, open chime.' }),
    AMPX({ id: 'matchless.amp-spitfire', name: 'Matchbox Spark 15', ref: 'Matchless Spitfire', combo: true, speakers: 1, tolex: '#151515', panel: '#2b2b2b', panelText: '#f2f2f2', grille: 'salt', logo: 'Matchbox', logoColor: '#d8d8d8', knob: 'chicken', piping: '#e6e6e6',
      opts: { voice: { base: 'dc30', drive: 1.1, stages: [[40, 1.4, 0.26, 11000, 40], [34, 1.3, 0.3, 8600, 70]], pwrH: 1.4, sag: 0.45, otLp: 6600 } },
      controls: [k('gain', 'VOLUME', { def: 0.5 }), k('bass', 'BASS'), k('treble', 'TREBLE', { def: 0.55 }), k('presence', 'TONE')],
      fixed: { master: 0.6, mid: 0.55 }, trim: -3, desc: '15 W EL84 combo with no master: chimey clean that breaks up early.' }),
    CABM({ id: 'matchless.cab-ess212', name: '2x12 Matchbox ESS', ref: 'Matchless ESS 2x12 (Celestion G12H30 + Alnico Blue)', opts: { cab: { hp: 85, hpQ: 1.3, resDb: 3.5, lp: 6000, peaks: [[130, 1, 1.5], [900, 1, 1], [2500, 1.3, 4], [4500, 2, 2.5]], seed: 391 } }, cabSize: '2x12', grille: 'salt', logo: 'Matchbox', logoColor: '#d8d8d8', piping: '#e6e6e6' },
      [{ type: 0, spk: 0, pos: 0.35 }, { type: 2, spk: 1, pos: 0.4, dist: 0.2, lvl: -4 }]),
    def({ id: 'matchless.hotbox', name: 'Matchbox Heat Box', ref: 'Matchless Hot Box', cat: 'Preamp', form: 'strymon', color: '#c9ccd1', text: '#151515', logo: 'heat box', tagline: 'TUBE PREAMP', rows: [3, 2], cost: 1.6,
      algo: 'amp', opts: { preamp: true, models: [
        { base: 'dc30', stages: [[34, 1.6, 0.2, 12000, 40], [28, 1.6, 0.22, 9500, 50]] },
        { base: 'dc30', drive: 1.25, stages: [[44, 1.35, 0.28, 10500, 50], [38, 1.2, 0.32, 8200, 90], [26, 1.3, 0.3, 7400, 80]] },
      ] },
      controls: [K('cv', 'CLEAN VOL', { virtual: true }), K('gain', 'GAIN', { def: 0.55 }), K('gv', 'VOLUME', { virtual: true }), K('bass', 'BASS'), K('treble', 'TREBLE', { def: 0.55 }),
        FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'param', p: 'ch', toggle: true, virtual: true, label: 'GAIN' }), LED({ color: '#ff2a1a' }), LED({ bind: 'param:ch', color: '#ffb000' })],
      derive: (u) => (u.ch ? { channel: 1, level: ((u.gv ?? 0.5) - 0.5) * 24 - 3 } : { channel: 0, gain: 0.35, bass: 0.5, treble: 0.55, level: ((u.cv ?? 0.5) - 0.5) * 24 }),
      desc: 'Stainless steel tube preamp: a clean channel and a footswitchable gain channel with bass and treble.' }),
  ]);
}
