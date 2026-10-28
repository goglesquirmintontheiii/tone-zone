// Built-in Tone Zone plugin: Peavey.
// Blocks inspired by Peavey gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.5150', name: 'PV 5051', ref: 'Peavey 5150 / EVH', opts: { model: '5150' }, tolex: '#141414', panel: '#141414', panelText: '#e0e0e0', grille: 'black', logo: '5051', logoFont: "'Oswald', sans-serif", logoColor: '#d33', knob: 'chrome',
      controls: [k('gain', 'PRE GAIN'), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'POST GAIN'), k('depth', 'RESONANCE'), k('presence', 'PRESENCE')] })),

    // ---------------- v0.2
    AMPX({ id: 'peavey.amp-6505plus', name: 'PV 6556 Plus', ref: 'Peavey 6505+', tolex: '#141414', panel: '#141414', panelText: '#e0e0e0', grille: 'black', logo: '6556+', logoFont: "'Oswald', sans-serif", logoColor: '#d33', knob: 'chrome',
      opts: { models: [
        { base: '5150', stages: [[44, 1.5, 0.28, 11000, 40], [38, 1.25, 0.33, 8200, 120], [26, 1.25, 0.3, 7200, 90]], tsPos: 3, tight: 0.3, otLp: 6600 },
        { base: '5150', drive: 1.05, tight: 0.65, otLp: 6300 },
      ] },
      controls: [k('gain', 'PRE GAIN', { def: 0.55 }), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'POST GAIN'), k('depth', 'RESONANCE'), k('presence', 'PRESENCE'), TOG('channel', 'CHANNEL', ['RHYTHM', 'LEAD'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'The metal staple: crunchy rhythm channel and a crushing, tight lead.' }),
    AMPX({ id: 'peavey.amp-invective', name: 'PV Invidious 120', ref: 'Peavey Invective.120', tolex: '#141414', panel: '#1d1e20', panelText: '#d8d8d8', grille: 'black', logo: 'INVIDIOUS', logoFont: "'Oswald', sans-serif", logoColor: '#c9ced4', knob: 'chrome', piping: '#55595e',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.18, 12500, 25], [28, 1.8, 0.2, 10000, 35]], stack: 'peavey', pwrH: 2.8, sag: 0.2, otLp: 7400 },
        { base: '5150', stages: [[50, 1.4, 0.3, 10500, 60], [46, 1.05, 0.36, 7800, 180], [40, 1.0, 0.4, 7200, 160], [28, 1.1, 0.33, 6600, 110]], tight: 0.8, sag: 0.2, otLp: 6600, presHz: 3800 },
      ] },
      controls: [k('gain', 'PRE', { def: 0.55 }), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('master', 'POST'), k('depth', 'RESONANCE'), k('presence', 'PRESENCE'), TOG('channel', 'CHANNEL', ['CLEAN', 'LEAD'], { def: 1 })],
      desc: 'Modern djent-ready head: very tight lows, clear top end.' }),
  ]);
}
