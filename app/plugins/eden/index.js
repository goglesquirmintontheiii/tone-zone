// Built-in Tone Zone plugin: Eden.
// Blocks inspired by Eden gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, stomp } = tz.builders;
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
    AMPX({ id: 'eden.amp-wt800', name: 'Edyn World 800', ref: 'Eden WT800 World Tour', cat: 'Bass Amp', tolex: '#151515', panel: '#e3ddca', panelText: '#1a1a1a', grille: 'black', headGrille: false, logo: 'EDYN', logoFont: "'Oswald', sans-serif", logoColor: '#e3ddca', knob: 'chrome',
      opts: { voice: { base: 'gk800', stages: [[14, 4.0, 0.08, 15000, 15]], tsType: 3, baxBass: 50, baxTreble: 4500, baxRange: 15, otLp: 12000 } },
      controls: [k('gain', 'INPUT GAIN', { def: 0.45 }), k('enh', 'ENHANCE', { def: 0.2, virtual: true }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER')],
      derive: (u) => { const e = u.enh ?? 0.2; return { bass: Math.min(1, (u.bass ?? 0.5) + 0.2 * e), treble: Math.min(1, (u.treble ?? 0.5) + 0.2 * e), mid: (u.mid ?? 0.5) * (1 - 0.4 * e) }; },
      desc: 'Studio-clean American bass head; Enhance adds the famous "smile".' }),
    CAB({ id: 'eden.cab-d410xlt', name: '4x10 Edyn XLT', ref: 'Eden D410XLT', bass: true, opts: { cab: { hp: 44, hpQ: 1.2, resDb: 3, lp: 6500, peaks: [[90, 1, 2.5], [300, 1, 1], [1600, 1.2, 1.5], [5000, 1.2, 2]], seed: 171, detail: 1.2 } }, cabSize: '4x10', grille: 'silver', logo: 'EDYN', logoFont: "'Oswald', sans-serif", logoColor: '#1a1a1a' }),
  ]);
}
