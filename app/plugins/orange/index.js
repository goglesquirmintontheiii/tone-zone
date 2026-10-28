// Built-in Tone Zone plugin: Orange.
// Blocks inspired by Orange gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, preampOf, marshallKnobs, fenderKnobs } = tz.builders;
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
    const pre = preampOf(Object.assign({}, a, { controls: a.controls.filter((c) => !isFx(c)) }));
    const sw = a.controls.filter((c) => (c.t === 'toggle' || c.t === 'sel') && !isFx(c)).map((c) => SEL(c.p, c.label, c.options, { values: c.values, def: c.def ?? 0, virtual: c.virtual, sweep: c.options.length > 2 ? 90 : 60, optSize: 4.2 }));
    const pc = pre.controls.filter((c) => !(c.t === 'knob' && !c.p));
    const li = pc.findIndex((c) => c.p === 'level');
    pc.splice(li, 0, ...sw);
    pre.controls = pc;
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
  tz.addDefs([
    preampPair(AMP({ id: 'amp.orange', name: 'Citrus Rockerbox', ref: 'Orange Rockerverb', opts: { model: 'orange' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', headGrille: true, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] })),
    preampPair(AMP({ id: 'amp.ad200', name: 'Citrus AD Bass', ref: 'Orange AD200', cat: 'Bass Amp', opts: { model: 'ad200' }, tolex: '#e8731c', panel: '#f2f2ee', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME')] })),
    CAB({ id: 'cab.4x12orange', name: '4x12 Citrus', ref: 'Orange PPC412', opts: { model: '4x12orange' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
    CAB({ id: 'cab.4x12bass', name: '4x12 Bass', ref: 'Orange OBC / 4x12 bass', opts: { model: '4x12bass' }, cabSize: '4x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', bass: true }),

    // ---------------- v0.2
    AMPX({ id: 'orange.amp-or50', name: 'Citrus OR 50', ref: 'Orange OR50', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      opts: { voice: { base: 'orange', stages: [[46, 1.45, 0.3, 10000, 45], [42, 1.15, 0.36, 7400, 120], [32, 1.15, 0.36, 6800, 95]], pwrH: 1.8, sag: 0.45, otLp: 6400 } },
      controls: [k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.55 }), TOG('sag', 'POWER', ['FULL', 'HALF'], { values: [0.4, 0.8] })],
      desc: 'Single-channel British high-gain head: thick, gritty mids.' }),
    AMPX({ id: 'orange.amp-tinyterror', name: 'Citrus Tiny Terror', ref: 'Orange Tiny Terror', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', headGrille: false, corners: false, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', logoPlate: '#1a1a1a', knob: 'mxr',
      opts: { voice: { base: 'orange', stages: [[44, 1.4, 0.3, 9500, 40], [36, 1.2, 0.35, 7200, 100]], tsPos: 2, power: 2, pwrH: 1.1, sag: 0.5, otLp: 6200, nfb: 0 } },
      controls: [k('master', 'VOLUME'), k('treble', 'TONE'), k('gain', 'GAIN', { def: 0.55 }), TOG('sag', 'WATTS', ['15', '7'], { values: [0.45, 0.85] })],
      desc: 'EL84 lunchbox head: one Tone knob, loads of British crunch.' }),
    AMPX({ id: 'orange.amp-thunderverb', name: 'Citrus Thunderverb', ref: 'Orange Thunderverb 200', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', knob: 'mxr',
      opts: { models: [
        { base: 'orange', stages: [[40, 1.6, 0.25, 11000, 35], [32, 1.4, 0.3, 8500, 80]], tsPos: 2, pwrH: 2.8, sag: 0.35, otLp: 6800 },
        { base: 'orange', stages: [[48, 1.4, 0.3, 9800, 45], [44, 1.1, 0.36, 7200, 130], [34, 1.1, 0.38, 6800, 100]], pwrH: 2.6, sag: 0.4, otLp: 6300, tight: 0.2 },
      ] },
      controls: [k('r.mix', 'REVERB', { def: 0.12 }), k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.55 }), TOG('channel', 'CHANNEL', ['A', 'B'], { def: 1 })],
      verb: { mode: 3, decay: 0.5 }, desc: 'Two-channel 200 W head with spring reverb: huge, dark and saturated.' }),
    AMPX({ id: 'orange.amp-terrorbass', name: 'Citrus Terror Bass', ref: 'Orange Terror Bass', cat: 'Bass Amp', tolex: '#e8731c', panel: '#f0ede4', panelText: '#1a1a1a', grille: 'black', headGrille: false, corners: false, logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6', logoPlate: '#1a1a1a', knob: 'mxr',
      opts: { models: [
        { base: 'ad200', stages: [[30, 1.8, 0.2, 8000, 20], [24, 1.7, 0.22, 6500, 25]], tsType: 0, stack: 'orange', tsPos: 1, pwrH: 2.2, sag: 0.35, otLp: 5200, otHp: 30 },
        { base: 'ad200', stages: [[44, 1.4, 0.3, 7500, 25], [36, 1.25, 0.35, 6000, 40], [26, 1.3, 0.3, 5500, 40]], tsType: 0, stack: 'orange', tsPos: 1, pwrH: 2.0, sag: 0.45, otLp: 5000, otHp: 30 },
      ] },
      controls: [k('master', 'VOLUME'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'GAIN', { def: 0.45 }), TOG('channel', 'CHANNEL', ['CLEAN', 'DIRTY'])],
      desc: 'Valve-preamp lunchbox bass head with a growling dirty channel.' }),
    CAB({ id: 'orange.cab-ppc212', name: '2x12 Citrus', ref: 'Orange PPC212 (V30)', opts: { cab: { hp: 75, hpQ: 1.6, resDb: 4.5, lp: 5200, peaks: [[220, 1, 2], [1000, 1, 1.5], [2600, 1.5, 3.5], [4300, 2.5, 1.5]], seed: 61 } }, cabSize: '2x12', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
    CAB({ id: 'orange.cab-obc810', name: '8x10 Citrus Bass', ref: 'Orange OBC810', bass: true, opts: { cab: { hp: 42, hpQ: 1.3, resDb: 4, lp: 4300, peaks: [[85, 1, 3], [600, 1, 2], [1700, 1.3, 2], [3200, 2, -2.5]], seed: 62, detail: 1.5 } }, cabSize: '8x10', tolex: '#e8731c', grille: 'black', logo: 'CITRUS', logoFont: "'Oswald', sans-serif", logoColor: '#f6f6f6' }),
  ]);
}
