// Built-in Tone Zone plugin: Darkglass.
// Blocks inspired by Darkglass gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    def({ id: 'pre.b7k', name: 'Dark Bass Pre', ref: 'Darkglass Microtubes B7K', cat: 'Preamp', form: 'tz', color: '#5c5f63', text: '#111', logo: 'DARK B7', typeName: 'Bass preamp', knob: 'mxr',
        algo: 'drive', opts: { clip: 'mosfet', bias: 0.15, preHp: 60, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', useHiMid: true, eqRangeDb: 12, bassF: 80, midF: 500, hiMidF: 1500, trebleF: 5000, postLp: 10000, levelMaxDb: 8 },
        controls: [K('level', 'MASTER'), K('blend', 'BLEND', { def: 0.6 }), K('gain', 'DRIVE', { def: 0.5 }), K('bass', 'BASS'), K('mid', 'LO MIDS'), K('himid', 'HI MIDS'), K('treble', 'TREBLE'), FOOT(), LED({ color: '#ff2a1a' })] }),

    // ---------------- v0.2
    def({ id: 'darkglass.alphaomega', name: 'Alpha Zeta Pre', ref: 'Darkglass Alpha·Omega', cat: 'Preamp', form: 'tz', color: '#c9ccd0', text: '#111', logo: 'ALPHA·ZETA', typeName: 'Bass preamp / overdrive', knob: 'mxr',
      algo: 'drive', opts: { tone: 'eq3', useHiMid: true, eqRangeDb: 12, bassF: 100, midF: 500, hiMidF: 1500, trebleF: 5000, postLp: 10000, levelMaxDb: 8, preHp: 60, modes: [{ clip: 'opamp', bias: 0.1, gainMinDb: 4, gainMaxDb: 40 }, { clip: 'diode', bias: 0.25, gainMinDb: 8, gainMaxDb: 46, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 4 }] }] },
      controls: [K('level', 'MASTER'), K('blend', 'BLEND', { def: 0.6 }), K('gain', 'DRIVE', { def: 0.5 }), K('bass', 'BASS'), K('mid', '500 HZ'), K('himid', '1.5 KHZ'), K('treble', 'TREBLE'),
        TOG('mode', 'MOD', ['ALPHA', 'OMEGA']), TOG('grunt', 'GROWL', ['OFF', 'ON'], { virtual: true }), TOG('att', 'ATTACK', ['OFF', 'ON'], { virtual: true }), FOOT(), LED({ color: '#ff2a1a' })],
      derive: (u) => ({ bass: Math.min(1, (u.bass ?? 0.5) + (u.grunt ? 0.12 : 0)), treble: Math.min(1, (u.treble ?? 0.5) + (u.att ? 0.12 : 0)) }), desc: 'Dual-voice bass preamp / overdrive (Alpha smooth, Omega aggressive) with a 4-band active EQ and Growl / Attack switches.' }),
    def({ id: 'darkglass.vintageultra', name: 'Retro Ultra Pre', ref: 'Darkglass Vintage Ultra', cat: 'Preamp', form: 'tz', color: '#d8cfba', text: '#1a1a1a', logo: 'RETRO ULTRA', typeName: 'Bass preamp', knob: 'mxr',
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 40, gainMinDb: 0, gainMaxDb: 32, tone: 'eq3', useHiMid: true, eqRangeDb: 12, bassF: 80, midF: 250, hiMidF: 1500, trebleF: 5000, postLp: 9000, levelMaxDb: 14 },
      controls: [K('level', 'MASTER'), K('blend', 'BLEND', { def: 0.65 }), K('gain', 'DRIVE', { def: 0.4 }), K('era', 'ERA', { virtual: true }), K('bass', 'BASS'), K('mid', 'LO MIDS'), K('himid', 'HI MIDS'), K('treble', 'TREBLE'),
        TOG('grunt', 'GRUNT', ['-', '0', '+'], { virtual: true, def: 1 }), TOG('attack', 'ATTACK', ['-', '0', '+'], { virtual: true, def: 1 }), FOOT(), LED({ color: '#ff2a1a' })],
      derive: (u) => ({ bass: Math.max(0, Math.min(1, (u.bass ?? 0.5) + ((u.grunt ?? 1) - 1) * 0.12)), treble: Math.max(0, Math.min(1, (u.treble ?? 0.5) + ((u.attack ?? 1) - 1) * 0.12 - (u.era ?? 0.5) * 0.1 + 0.05)) }), desc: 'Vintage-voiced bass preamp / overdrive; Era sweeps from modern to old-school tube warmth.' }),
    AMPX({ id: 'darkglass.amp-mt900', name: 'Dark Tubes 900', ref: 'Darkglass Microtubes 900 v2', cat: 'Bass Amp', tolex: '#151515', panel: '#232427', panelText: '#d6d6d6', grille: 'black', headGrille: false, logo: 'DARK 900', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', knob: 'mxr',
      opts: { models: [
        { base: 'markbass', tsType: 3, baxBass: 80, baxTreble: 5000, baxRange: 12 },
        { base: 'markbass', stages: [[30, 1.3, 0.25, 9000, 60], [20, 1.4, 0.2, 7000, 50]], tsType: 3, baxBass: 80, baxTreble: 5000, baxRange: 12 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'MIDS'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('channel', 'MICROTUBES', ['OFF', 'ON']), TOG('ultralo', 'GRUNT', ['OFF', 'ON']), TOG('ultrahi', 'ATTACK', ['OFF', 'ON'])],
      desc: '900 W class-D bass head with the Microtubes overdrive circuit on tap.' }),
    CAB({ id: 'darkglass.cab-dg410', name: '4x10 Dark DG', ref: 'Darkglass DG410N', bass: true, opts: { cab: { hp: 42, hpQ: 1.2, resDb: 3, lp: 7500, peaks: [[85, 1, 2.5], [800, 1, 0.5], [4200, 1.1, 3]], seed: 131, detail: 1.1 } }, cabSize: '4x10', grille: 'black', logo: 'DARK', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', piping: '#6a6d72' }),
  ]);
  tz.addDefs([
    CABM({ id: 'darkglass.cab-dg212', name: '2x12 Dark DG', ref: 'Darkglass DG212N', bass: true, opts: { cab: { hp: 45, hpQ: 1.2, resDb: 3, lp: 7200, peaks: [[90, 1, 2.5], [800, 1, 0.5], [4200, 1.1, 3]], seed: 132, detail: 1.1 } }, cabSize: '2x12', grille: 'black', logo: 'DARK', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', piping: '#6a6d72' },
      [{ type: 3, spk: 0, pos: 0.3 }]),
  ]);
}
