// Built-in Tone Zone plugin: Vox.
// Blocks inspired by Vox gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.ac30', name: 'Brit 30 Top Boost', ref: 'Vox AC30 Top Boost', opts: { model: 'ac30' }, combo: true, speakers: 2, tolex: '#1a1a1a', panel: '#7a4a2a', panelText: '#f1e3c8', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', logoPlate: '#1a1a1a', knob: 'vox', piping: '#c9b37a',
      controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('presence', 'CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })] })),
    CAB({ id: 'cab.2x12blue', name: '2x12 Brit Blue', ref: 'Vox AC30 2x12 Alnico Blue', opts: { model: '2x12blue' }, cabSize: '2x12', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", piping: '#c9b37a' }),

    // ---------------- v0.2
    AMPX({ id: 'vox.amp-ac15', name: 'Brit 15 Top Boost', ref: 'Vox AC15C1', combo: true, speakers: 1, tolex: '#1a1a1a', panel: '#7a4a2a', panelText: '#f1e3c8', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', logoPlate: '#1a1a1a', knob: 'vox', piping: '#c9b37a',
      opts: { voice: { base: 'ac30', stages: [[40, 1.35, 0.22, 11500, 30], [30, 1.25, 0.26, 9500, 65]], pwrH: 1.0, sag: 0.45, otLp: 8500, otHp: 85, presHz: 4500 } },
      controls: [k('gain', 'VOLUME', { def: 0.5 }), k('treble', 'TREBLE', { def: 0.55 }), k('bass', 'BASS'), k('r.mix', 'REVERB', { def: 0.15 }), k('t.rate', 'SPEED', { def: 0.4 }), k('t.depth', 'DEPTH', { def: 0 }), k('presence', 'TONE CUT', { invert: true }), k('master', 'MASTER', { def: 0.55 })],
      trem: { mode: 1 }, desc: 'Two-EL84 class-A chime with Top Boost EQ, reverb and tremolo.' }),
    AMPX({ id: 'vox.amp-nighttrain', name: 'Late Express 15', ref: 'Vox Night Train NT15H', tolex: '#aeb3b9', panel: '#1b1b1c', panelText: '#e8e8e8', grille: 'silver', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f4f4f4', logoPlate: '#1b1b1c', knob: 'chrome', corners: false, piping: '#d9dde2',
      opts: { models: [
        { base: 'ac30', stages: [[42, 1.35, 0.24, 11000, 35], [32, 1.25, 0.28, 9000, 70]], tsType: 0, stack: 'vox', pwrH: 1.2, sag: 0.4, otLp: 8000 },
        { base: 'jcm800', stages: [[46, 1.4, 0.3, 10500, 50], [40, 1.15, 0.35, 8000, 130], [30, 1.2, 0.32, 7200, 100]], stack: 'marshall', power: 2, pwrH: 1.3, sag: 0.4, otLp: 7200, presHz: 4200, nfb: 0 },
      ] },
      controls: [k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('gain', 'GAIN', { def: 0.55 }), TOG('channel', 'CHANNEL', ['PURE', 'GIRTH']), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Chrome-caged EL84 lunchbox: Pure chime or the thicker, hotter Girth channel.' }),
    CAB({ id: 'vox.cab-ac15', name: '1x12 Brit 15', ref: 'Vox AC15 1x12 (Greenback)', opts: { cab: { hp: 95, hpQ: 1.0, resDb: 2.5, lp: 5600, open: true, peaks: [[850, 1, 1.5], [2200, 1.3, 3.5], [3800, 2, 2]], seed: 41 } }, cabSize: '1x12', grille: 'diamond', logo: 'VAX', logoFont: "'Oswald', sans-serif", logoColor: '#f1e9d8', piping: '#c9b37a' }),
  ]);
}
