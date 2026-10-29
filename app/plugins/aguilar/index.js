// Built-in Tone Zone plugin: Aguilar.
// Blocks inspired by Aguilar gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    AMPX({ id: 'aguilar.amp-tonehammer', name: 'Eagle Hammer 500', ref: 'Aguilar Tone Hammer 500', cat: 'Bass Amp', tolex: '#151515', panel: '#bfc3c8', panelText: '#121212', grille: 'black', headGrille: false, logo: 'aquila', logoFont: "'Inter', sans-serif", logoColor: '#e0e0e0', knob: 'mxr',
      opts: { voice: { base: 'markbass', stages: [[14, 3.5, 0.1, 15000, 20]], tsType: 3, baxBass: 40, baxTreble: 4000, baxRange: 15 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('drive', 'DRIVE', { def: 0, virtual: true }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER')],
      derive: (u) => ({ gain: Math.min(1, (u.gain ?? 0.45) + 0.4 * (u.drive ?? 0)) }), desc: 'Compact bass head with the Tone Hammer preamp: deep bass, focused mids, optional drive.' }),
    AMPX({ id: 'aguilar.amp-ag700', name: 'Eagle AG 700', ref: 'Aguilar AG 700', cat: 'Bass Amp', tolex: '#151515', panel: '#151515', panelText: '#e0e0e0', grille: 'black', headGrille: false, logo: 'aquila', logoFont: "'Inter', sans-serif", logoColor: '#e0e0e0', knob: 'chrome',
      opts: { voice: { base: 'gk800', stages: [[10, 5.0, 0.02, 16000, 15]], tsType: 3, baxBass: 40, baxTreble: 4000, baxRange: 15, otLp: 13000 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'LO MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'DEEP', ['OFF', 'ON']), TOG('ultrahi', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Clean, hi-fi 700 W bass head with Deep and Bright voicings.' }),
    def({ id: 'aguilar.tonehammer', name: 'Eagle Hammer Pre', ref: 'Aguilar Tone Hammer preamp / DI', cat: 'Preamp', form: 'tz', color: '#b8bcc1', text: '#111', logo: 'EAGLE HAMMER', typeName: 'Bass preamp / DI', knob: 'mxr',
      algo: 'drive', opts: { clip: 'jfet', bias: 0.1, preHp: 30, gainMinDb: 0, gainMaxDb: 26, tone: 'eq3', eqRangeDb: 15, bassF: 40, midF: 400, midMin: 180, midMax: 1000, trebleF: 4000, postLp: 14000, levelMaxDb: 16, cleanSum: true },
      controls: [K('level', 'GAIN'), K('treble', 'TREBLE'), K('mid', 'MID'), K('midfreq', 'MID FREQ'), K('bass', 'BASS'), K('gain', 'DRIVE', { def: 0.15 }), FOOT(), LED({ color: '#3d8bff' })],
      desc: 'Bass preamp pedal: deep bass shelf, sweepable mid and a gentle drive.' }),
    CAB({ id: 'aguilar.cab-db410', name: '4x10 Eagle DB', ref: 'Aguilar DB 410', bass: true, opts: { cab: { hp: 42, hpQ: 1.2, resDb: 3.5, lp: 5600, peaks: [[80, 1, 3], [400, 1, 1.5], [1500, 1.2, 1.5], [4500, 1.2, 2]], seed: 141, detail: 1.3 } }, cabSize: '4x10', grille: 'silver', logo: 'aquila', logoFont: "'Inter', sans-serif", logoColor: '#111' }),
    CAB({ id: 'aguilar.cab-db112', name: '1x12 Eagle DB', ref: 'Aguilar DB 112', bass: true, opts: { cab: { hp: 48, hpQ: 1.1, resDb: 3, lp: 5200, peaks: [[90, 1, 2.5], [600, 1, 1], [4500, 1.2, 2]], seed: 142, detail: 1.2 } }, cabSize: '1x12', grille: 'silver', logo: 'aquila', logoFont: "'Inter', sans-serif", logoColor: '#111' }),
  ]);
  tz.addDefs([
    AMPX({ id: 'aguilar.amp-db751', name: 'Eagle DB 751', ref: 'Aguilar DB 751', cat: 'Bass Amp', tolex: '#151515', panel: '#bfc3c8', panelText: '#121212', grille: 'black', headGrille: false, logo: 'aquila', logoFont: "'Inter', sans-serif", logoColor: '#e0e0e0', knob: 'chrome',
      opts: { voice: { base: 'svt', stages: [[30, 1.6, 0.24, 9000, 20], [24, 1.5, 0.28, 7500, 25]], tsType: 3, baxBass: 40, baxTreble: 4000, baxRange: 15, power: 3, pwrH: 4, sag: 0.05, otLp: 10000, otHp: 30 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('drive', 'DRIVE', { def: 0, virtual: true }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'DEEP', ['OFF', 'ON']), TOG('ultrahi', 'BRIGHT', ['OFF', 'ON'])],
      derive: (u) => ({ gain: cl((u.gain ?? 0.45) + 0.45 * (u.drive ?? 0)) }), desc: 'Hybrid bass head: all-tube preamp with a drive control into a 975 W power amp.' }),
    def({ id: 'aguilar.db680', name: 'Eagle DB 680', ref: 'Aguilar DB 680', cat: 'Preamp', form: 'rack', algo: 'amp', cost: 1.6, color: '#bfc3c8', text: '#121212', logo: 'AQUILA DB 680', typeName: 'Bass tube preamp', knob: 'chrome',
      opts: { preamp: true, voice: { base: 'svt', stages: [[28, 1.7, 0.22, 9500, 20], [22, 1.6, 0.25, 8000, 25]], tsType: 3, baxBass: 40, baxTreble: 4000, baxRange: 15 } },
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DI OUT'] }, jackKinds: { o1: 'xlr' },
      controls: [K('gain', 'GAIN', { def: 0.45 }), K('bass', 'BASS'), K('lm', 'LO MID', { virtual: true }), K('hm', 'HI MID', { virtual: true }), K('treble', 'TREBLE'), K('level', 'OUTPUT', { min: -30, max: 12, def: 0, display: db }),
        SEL('ultralo', 'DEEP', ['OFF', 'ON'], { sweep: 60, optSize: 4.2 }), SEL('ultrahi', 'BRIGHT', ['OFF', 'ON'], { sweep: 60, optSize: 4.2 }), LED({ color: '#3ddc84' }), FOOT()],
      derive: (u) => { const lo = u.lm ?? 0.5, hi = u.hm ?? 0.5; return { mid: (lo + hi) / 2, midfreq: cl(0.5 + (hi - lo) * 0.6) }; },
      desc: 'Two-channel-style tube bass preamp with a 4-band EQ, Deep and Bright switches and an XLR DI out.' }),
    CABM({ id: 'aguilar.cab-sl112', name: '1x12 Eagle SL', ref: 'Aguilar SL 112', bass: true, opts: { cab: { hp: 50, hpQ: 1.1, resDb: 2.5, lp: 6000, peaks: [[95, 1, 2], [500, 1, 1], [4500, 1.2, 2.5]], seed: 143, detail: 1.1 } }, cabSize: '1x12', grille: 'silver', logo: 'aquila', logoFont: "'Inter', sans-serif", logoColor: '#111' },
      [{ type: 3, pos: 0.3 }]),
  ]);
}
