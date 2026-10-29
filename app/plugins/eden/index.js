// Built-in Tone Zone plugin: Eden.
// Blocks inspired by Eden gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
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
    AMPX({ id: 'eden.amp-wt800', name: 'Edyn World 800', ref: 'Eden WT800 World Tour', cat: 'Bass Amp', tolex: '#151515', panel: '#e3ddca', panelText: '#1a1a1a', grille: 'black', headGrille: false, logo: 'EDYN', logoFont: "'Oswald', sans-serif", logoColor: '#e3ddca', knob: 'chrome',
      opts: { voice: { base: 'gk800', stages: [[14, 4.0, 0.08, 15000, 15]], tsType: 3, baxBass: 50, baxTreble: 4500, baxRange: 15, otLp: 12000 } },
      controls: [k('gain', 'INPUT GAIN', { def: 0.45 }), k('enh', 'ENHANCE', { def: 0.2, virtual: true }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER')],
      derive: (u) => { const e = u.enh ?? 0.2; return { bass: Math.min(1, (u.bass ?? 0.5) + 0.2 * e), treble: Math.min(1, (u.treble ?? 0.5) + 0.2 * e), mid: (u.mid ?? 0.5) * (1 - 0.4 * e) }; },
      desc: 'Studio-clean American bass head; Enhance adds the famous "smile".' }),
    CAB({ id: 'eden.cab-d410xlt', name: '4x10 Edyn XLT', ref: 'Eden D410XLT', bass: true, opts: { cab: { hp: 44, hpQ: 1.2, resDb: 3, lp: 6500, peaks: [[90, 1, 2.5], [300, 1, 1], [1600, 1.2, 1.5], [5000, 1.2, 2]], seed: 171, detail: 1.2 } }, cabSize: '4x10', grille: 'silver', logo: 'EDYN', logoFont: "'Oswald', sans-serif", logoColor: '#1a1a1a' }),
  ]);
  tz.addDefs([
    def({ id: 'eden.wtdi', name: 'Edyn World DI', ref: 'Eden WTDI', cat: 'Preamp', form: 'strymon', color: '#b89b5e', text: '#1a1a1a', logo: 'edyn WT-DI', tagline: 'BASS PREAMP / DI', knob: 'mxr', cost: 1.1,
      algo: 'chain', opts: { chain: [
        { prefix: 'c', algo: 'comp', opts: { type: 'vca' }, params: { ratio: 0.4, attack: 0.35, release: 0.4 } },
        { prefix: 'p', algo: 'drive', opts: { clip: 'jfet', bias: 0.05, preHp: 25, gainMinDb: 0, gainMaxDb: 20, tone: 'eq3', eqRangeDb: 15, bassF: 50, midF: 550, midMin: 550, midMax: 2200, trebleF: 4500, postLp: 15000, levelMinDb: -20, levelMaxDb: 10, cleanSum: true } },
      ] },
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DI OUT'] }, jackKinds: { o1: 'xlr' },
      controls: [K('p.gain', 'GAIN', { def: 0.3, x: 32, y: 40, r: 11, labelPos: 'below' }), K('p.bass', 'BASS', { x: 79, y: 40, r: 11, labelPos: 'below' }), K('p.mid', 'MID', { x: 126, y: 40, r: 11, labelPos: 'below' }), K('p.treble', 'TREBLE', { x: 173, y: 40, r: 11, labelPos: 'below' }),
        K('p.level', 'VOLUME', { def: 0.5, x: 30, y: 92, r: 11, labelPos: 'below' }), K('cmp', 'COMP', { def: 0.2, virtual: true, x: 72, y: 92, r: 11, labelPos: 'below' }), K('enh', 'ENHANCE', { def: 0.2, virtual: true, x: 114, y: 92, r: 11, labelPos: 'below' }),
        BTN('MID 2.2K', { p: 'ms', toggle: true, virtual: true, shape: 'rect', w: 16, h: 8, led: true, ledColor: '#3ddc84', x: 150, y: 88, labelPos: 'below', labelSize: 4.8 }), BTN('BOOST', { p: 'bb', toggle: true, virtual: true, shape: 'rect', w: 16, h: 8, led: true, ledColor: '#3ddc84', x: 182, y: 88, labelPos: 'below', labelSize: 4.8 }),
        FOOT({ action: 'bypass', label: 'ON' }), LED({ color: '#3ddc84' })],
      derive: (u) => { const e = u.enh ?? 0.2; return { 'c.on': (u.cmp ?? 0.2) > 0.02 ? 1 : 0, 'c.sustain': u.cmp ?? 0.2, 'p.midfreq': u.ms ? 1 : 0, 'p.bass': cl((u['p.bass'] ?? 0.5) + 0.2 * e + (u.bb ? 0.12 : 0)), 'p.treble': cl((u['p.treble'] ?? 0.5) + 0.2 * e), 'p.mid': cl((u['p.mid'] ?? 0.5) - 0.2 * e) }; },
      desc: 'Bass preamp and DI pedal: 3-band EQ with a mid shift, Enhance, compression and a bass boost.' }),
    CABM({ id: 'eden.cab-d210xst', name: '2x10 Edyn XST', ref: 'Eden D210XST', bass: true, opts: { cab: { hp: 50, hpQ: 1.2, resDb: 3, lp: 6800, peaks: [[100, 1, 2], [400, 1, 1], [1800, 1.2, 1.5], [5000, 1.2, 2]], seed: 172, detail: 1.2 } }, cabSize: '2x10', grille: 'silver', logo: 'EDYN', logoFont: "'Oswald', sans-serif", logoColor: '#1a1a1a' },
      [{ type: 3, spk: 0, pos: 0.3 }]),
  ]);
}
