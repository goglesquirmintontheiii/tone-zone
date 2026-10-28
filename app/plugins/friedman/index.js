// Built-in Tone Zone plugin: Friedman.
// Blocks inspired by Friedman gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.friedman', name: 'Freed BE-100', ref: 'Friedman BE-100', opts: { model: 'friedman' }, tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'black', logo: 'Freed', logoColor: '#e0e0e0', knob: 'chrome', controls: [...marshallKnobs('GAIN', 'MASTER'), TOG('bright', 'BRIGHT', ['OFF', 'ON'])] })),

    // ---------------- v0.2
    AMPX({ id: 'friedman.amp-dirtyshirley', name: 'Dusty Shirl', ref: 'Friedman Dirty Shirley', tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'black', logo: 'Freed', logoColor: '#e0e0e0', knob: 'chrome', piping: '#d8d8d8',
      opts: { voice: { base: 'plexi', stages: [[44, 1.45, 0.3, 11500, 45], [38, 1.2, 0.35, 8500, 110], [26, 1.25, 0.3, 7400, 90]], tsPos: 3, brightHz: 2400, brightDb: 4, pwrH: 1.8, sag: 0.4, otLp: 6900, presHz: 3400 } },
      controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'MASTER'), k('gain', 'GAIN', { def: 0.6 }), TOG('bright', 'BRIGHT', ['OFF', 'ON']), TOG('depth', 'FAT', ['OFF', 'ON'], { values: [0.5, 0.85] })],
      desc: 'Plexi-style crunch with a bit more gain on tap: classic rock, made easy.' }),
    AMPX({ id: 'friedman.amp-jjjunior', name: 'Freed JJ Jr', ref: 'Friedman JJ Junior (Jerry Cantrell)', tolex: '#141414', panel: '#151515', panelText: '#e0e0e0', grille: 'salt', logo: 'Freed JJ', logoColor: '#e0e0e0', knob: 'chrome',
      opts: { models: [
        { base: 'plexi', stages: [[38, 1.6, 0.22, 12000, 30], [30, 1.6, 0.25, 9500, 60]], power: 2, pwrH: 1.4, sag: 0.4, otLp: 7300, nfb: 0 },
        { base: 'friedman', stages: [[46, 1.45, 0.3, 10500, 55], [40, 1.2, 0.35, 8000, 140], [32, 1.1, 0.38, 7000, 115]], power: 2, pwrH: 1.5, sag: 0.4, otLp: 6800, nfb: 0 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'MASTER'), k('presence', 'PRESENCE'), TOG('channel', 'CHANNEL', ['CLEAN', 'DIRTY'], { def: 1 })],
      desc: 'Compact 20 W EL84 head voiced for thick, grinding rhythm tones.' }),
  ]);
}
