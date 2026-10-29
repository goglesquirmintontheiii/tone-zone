// Built-in Tone Zone plugin: Hartke.
// Blocks inspired by Hartke gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    AMPX({ id: 'hartke.amp-lh500', name: 'Heartley LH 500', ref: 'Hartke LH500', cat: 'Bass Amp', tolex: '#151515', panel: '#141414', panelText: '#e2e2e2', grille: 'black', headGrille: false, logo: 'HEARTLEY', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', knob: 'chrome', piping: '#7a7d82',
      opts: { voice: { base: 'svt', stages: [[30, 1.8, 0.2, 10000, 15], [22, 1.8, 0.24, 8000, 20]], power: 3, pwrH: 4, sag: 0.05, otLp: 9000, otHp: 30 } },
      controls: [k('gain', 'VOLUME', { def: 0.5 }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'LOW BOOST', ['OFF', 'ON']), TOG('ultrahi', 'HIGH BOOST', ['OFF', 'ON'])],
      desc: 'Tube preamp into a 500 W solid-state power amp: punchy, modern bass.' }),
    CAB({ id: 'hartke.cab-410xl', name: '4x10 Heartley XL', ref: 'Hartke 410XL (aluminium cones)', bass: true, opts: { cab: { hp: 45, hpQ: 1.2, resDb: 3, lp: 7000, peaks: [[90, 1, 2], [900, 1, 1.5], [2600, 1.4, 4], [5000, 2, 2]], seed: 151, detail: 1.6 } }, cabSize: '4x10', grille: 'black', logo: 'HEARTLEY', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', piping: '#9a9da2' }),
  ]);
  // HA3500: tube and solid-state preamps blended in parallel, compressor, contour knobs, 10-band graphic EQ
  const HA_BANDS = [30, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const haChain = (pre) => [
    { prefix: 'c', algo: 'comp', opts: { type: 'vca' }, params: { ratio: 0.45, attack: 0.3, release: 0.4 } },
    { prefix: 't', algo: 'amp', group: 1, opts: { preamp: pre, voice: { base: 'svt', stages: [[30, 1.8, 0.22, 9000, 20], [24, 1.7, 0.25, 7500, 25]], power: 3, pwrH: 4, sag: 0.05, otLp: 9000, otHp: 30 } } },
    { prefix: 's', algo: 'amp', group: 1, opts: { preamp: pre, voice: { base: 'gk800', stages: [[12, 4.5, 0.05, 15000, 20]], tsType: 3, power: 3, baxBass: 50, baxTreble: 4000, baxRange: 15, otLp: 12000 } } },
    ...(pre ? [] : [{ prefix: 'e', algo: 'geq', opts: { freqs: HA_BANDS, q: 1.8 } }]),
  ];
  const haDerive = (u) => {
    const o = { 'c.on': (u.comp ?? 0.2) > 0.02 ? 1 : 0, 'c.sustain': u.comp ?? 0.2, 't.lvl': u.tube ?? 0.5, 's.lvl': u.ss ?? 0.5 };
    for (const p of ['t', 's']) Object.assign(o, { [p + '.bass']: u.lo ?? 0.5, [p + '.treble']: u.hi ?? 0.5, [p + '.mid']: 0.5, [p + '.gain']: u.pas ? 0.55 : 0.4, [p + '.master']: u.vol ?? 0.5, [p + '.level']: u.lvl ?? 0 });
    return o;
  };
  const haKnobs = () => [k('tube', 'TUBE', { virtual: true }), k('ss', 'SOLID ST.', { virtual: true }), k('comp', 'COMP', { def: 0.2, virtual: true }), k('lo', 'LO CONT', { virtual: true }), k('hi', 'HI CONT', { virtual: true })];
  const haAmp = AMP({ id: 'hartke.amp-ha3500', name: 'Heartley HA 3500', ref: 'Hartke HA3500', cat: 'Bass Amp', tolex: '#151515', panel: '#c3c6ca', panelText: '#111', grille: 'black', headGrille: false, logo: 'HEARTLEY', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', knob: 'mxr', piping: '#7a7d82',
    algo: 'chain', cost: 6, opts: { chain: haChain(false) },
    controls: [...haKnobs().map((c, i) => Object.assign(c, { x: 84 + i * 42, y: 147 })),
      ...HA_BANDS.map((f, i) => SLIDER('e.b' + i, f >= 1000 ? f / 1000 + 'K' : String(f), { min: -15, max: 15, def: 0, h: 38, labelSize: 4, x: 300 + i * 16, y: 142 })),
      k('vol', 'VOLUME', { virtual: true, x: 482, y: 147 }), TOG('pas', 'INPUT', ['ACTIVE', 'PASSIVE'], { virtual: true, def: 1, x: 526, y: 148, orient: 'v', optSize: 4.4 }),
      ...[0, 1, 2, 3].map(() => ({ t: 'knob', hidden: true }))],
    derive: haDerive, desc: '350 W bass head: blend the tube and solid-state preamps, add compression and shape it with the 10-band graphic EQ.' });
  tz.addDefs([
    haAmp,
    def({ id: 'hartke.pre-ha3500', name: 'Heartley HA 3500 Pre', ref: 'Hartke HA3500 (preamp)', cat: 'Preamp', form: 'rack', algo: 'chain', cost: 3.5, color: '#26282c', logo: 'HEARTLEY', typeName: 'Bass tube / solid-state preamp',
      opts: { chain: haChain(true) }, ports: { ins: ['INPUT'], outs: ['PREAMP OUT'] },
      controls: [...haKnobs(), K('lvl', 'OUTPUT', { min: -30, max: 12, def: 0, virtual: true, display: db }), SEL('pas', 'INPUT', ['ACTIVE', 'PASSIVE'], { virtual: true, def: 1, sweep: 60, optSize: 4.2 }), LED({ color: '#3ddc84' }), FOOT()],
      derive: haDerive, desc: 'The HA3500 preamp section: tube and solid-state blend, compressor and contour knobs.' }),
    CABM({ id: 'hartke.cab-115xl', name: '1x15 Heartley XL', ref: 'Hartke 115XL (paper cone)', bass: true, opts: { cab: { hp: 38, hpQ: 1.3, resDb: 4, lp: 3800, peaks: [[70, 1, 3], [300, 1, 1.5], [1200, 1.2, 1], [2600, 1.5, -2]], seed: 152, detail: 1.4 } }, cabSize: '1x15', grille: 'black', logo: 'HEARTLEY', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8', piping: '#9a9da2' },
      [{ type: 5, pos: 0.3 }]),
    def({ id: 'hartke.bassattack2', name: 'Heartley Bass Strike 2', ref: 'Hartke Bass Attack 2', cat: 'Preamp', form: 'strymon', color: '#2a2b2e', text: '#ececec', logo: 'bass strike 2', tagline: 'PREAMP / DI / OVERDRIVE', knob: 'mxr', cost: 1.2,
      algo: 'chain', opts: { chain: [
        { prefix: 'e', algo: 'drive', opts: { clip: 'clean', gainMinDb: 0, gainMaxDb: 6, tone: 'eq3', eqRangeDb: 15, bassF: 60, midF: 500, midMin: 150, midMax: 3000, trebleF: 5000, postLp: 16000, levelMinDb: -12, levelMaxDb: 12 }, params: { gain: 0.3, level: 0.5 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'mosfet', bias: 0.15, preHp: 40, gainMinDb: 6, gainMaxDb: 38, tone: 'lp', toneLo: 900, toneHi: 7000, postLp: 9000, levelMinDb: -12, levelMaxDb: 6 }, params: { level: 0.5 } },
      ] },
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'PARALLEL OUT', 'DI OUT'] }, jackKinds: { o2: 'xlr' },
      controls: [K('e.bass', 'BASS', { x: 32, y: 40, r: 11, labelPos: 'below' }), K('e.treble', 'TREBLE', { x: 79, y: 40, r: 11, labelPos: 'below' }), K('e.midfreq', 'FREQ', { x: 126, y: 40, r: 11, labelPos: 'below' }), K('amt', 'AMOUNT', { def: 0.4, virtual: true, x: 173, y: 40, r: 11, labelPos: 'below' }),
        K('d.gain', 'DRIVE', { def: 0.5, x: 32, y: 92, r: 11, labelPos: 'below' }), K('d.tone', 'TONE', { x: 79, y: 92, r: 11, labelPos: 'below' }), K('d.blend', 'MIX', { def: 0.6, x: 126, y: 92, r: 11, labelPos: 'below' }),
        BTN('CONTOUR', { p: 'ctr', toggle: true, virtual: true, shape: 'rect', w: 18, h: 8, led: true, ledColor: '#3d8bff', x: 173, y: 88, labelPos: 'below', labelSize: 5 }),
        FOOT({ action: 'bypass', label: 'ON', x: 38, y: 186, r: 12 }), FOOT({ action: 'param', p: 'shp', toggle: true, virtual: true, label: 'SHAPE', x: 102, y: 186, r: 12 }), FOOT({ action: 'param', p: 'od', toggle: true, virtual: true, label: 'DRIVE', x: 166, y: 186, r: 12 }),
        LED({ color: '#ff2a1a', x: 38, y: 164, r: 2.8 }), LED({ bind: 'param:shp', color: '#3d8bff', x: 102, y: 164, r: 2.8 }), LED({ bind: 'param:od', color: '#ffb000', x: 166, y: 164, r: 2.8 })],
      derive: (u) => ({ 'e.mid': cl(0.5 - (u.shp ? 0.5 * (u.amt ?? 0.4) : 0) - (u.ctr ? 0.12 : 0)), 'e.bass': cl((u['e.bass'] ?? 0.5) + (u.ctr ? 0.08 : 0)), 'd.on': u.od ? 1 : 0 }),
      desc: 'Bass preamp and DI with a sweepable Shape filter and a blendable overdrive, each on its own footswitch.' }),
  ]);
}
