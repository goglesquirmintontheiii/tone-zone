// Built-in Tone Zone plugin: Diezel.
// Blocks inspired by Diezel gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.vh4', name: 'Teutonic V4', ref: 'Diezel VH4', opts: { model: 'vh4' }, tolex: '#141414', panel: '#202020', panelText: '#e0e0e0', grille: 'black', logo: 'DIESL', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', knob: 'chrome', controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME'), k('depth', 'DEEP'), k('presence', 'PRESENCE')] })),

    // ---------------- v0.2
    AMPX({ id: 'diezel.amp-herbert', name: 'Teutonic Herb', ref: 'Diezel Herbert', tolex: '#141414', panel: '#1b1b1c', panelText: '#e0e0e0', grille: 'black', logo: 'DIESL', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', logoPlate: '#2a2b2d', knob: 'chrome',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.2, 12000, 25], [28, 1.7, 0.22, 9500, 40]], stack: 'mesa', pwrH: 2.6, sag: 0.25, otLp: 7200 },
        { base: 'vh4', stages: [[46, 1.45, 0.3, 10500, 50], [42, 1.15, 0.35, 8000, 150], [32, 1.15, 0.36, 7200, 120]], tsPos: 3, otLp: 6700, tight: 0.5 },
        { base: 'vh4', drive: 1.08, tight: 0.75, otLp: 6400, depthHz: 80 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME'), k('depth', 'DEEP'), k('presence', 'PRESENCE'), SEL('channel', 'CHANNEL', ['1', '2', '3'], { def: 2, sweep: 90, optSize: 4.4 })],
      desc: 'Three-channel German monster: huge low end, articulate saturation.' }),
  ]);
}
