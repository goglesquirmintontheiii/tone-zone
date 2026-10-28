// Built-in Tone Zone plugin: Bogner.
// Blocks inspired by Bogner gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.uber', name: 'Uber Schall', ref: 'Bogner Überschall', opts: { model: 'uber' }, tolex: '#141414', panel: '#141414', panelText: '#d9d9d9', grille: 'black', logo: 'Bogart', logoColor: '#d9d9d9', knob: 'chrome', controls: marshallKnobs('GAIN', 'VOLUME') })),
    CAB({ id: 'cab.4x12uber', name: '4x12 Uber V30', ref: 'Bogner Überkab 4x12', opts: { model: '4x12uber' }, cabSize: '4x12', grille: 'black', logo: 'Bogart', logoColor: '#ddd' }),

    // ---------------- v0.2
    AMPX({ id: 'bogner.amp-shiva', name: 'Shakti 20th', ref: 'Bogner Shiva', tolex: '#141414', panel: '#151515', panelText: '#e6e6e6', grille: 'salt', logo: 'Bogart', logoColor: '#e6e6e6', knob: 'chrome', piping: '#bdbdbd',
      opts: { models: [
        { base: 'plexi', stages: [[38, 1.6, 0.22, 12000, 30], [30, 1.6, 0.25, 9500, 60]], pwrH: 2.4, sag: 0.3, otLp: 7300, presHz: 3400 },
        { base: 'jcm800', stages: [[46, 1.45, 0.3, 10500, 50], [42, 1.15, 0.35, 7800, 130], [32, 1.15, 0.35, 7000, 110]], pwrH: 2.2, sag: 0.35, otLp: 6700, presHz: 3400, tight: 0.2 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('master', 'VOLUME'), k('presence', 'PRESENCE'), k('r.mix', 'REVERB', { def: 0.12 }), TOG('channel', 'CHANNEL', ['1', '2'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      verb: { mode: 3, decay: 0.45 }, desc: 'Two-channel EL34 head: glassy clean and a creamy, singing lead.' }),
    AMPX({ id: 'bogner.amp-ecstasy', name: 'Rapture 101', ref: 'Bogner Ecstasy 101B', tolex: '#141414', panel: '#c6cacf', panelText: '#121212', grille: 'black', logo: 'Bogart', logoColor: '#e6e6e6', knob: 'chrome',
      opts: { models: [
        { base: 'twin', stages: [[36, 1.7, 0.18, 12500, 25], [30, 1.8, 0.2, 9800, 35]], stack: 'marshall', pwrH: 2.6, sag: 0.3, otLp: 7400, presHz: 3400 },
        { base: 'plexi', stages: [[44, 1.45, 0.3, 11500, 40], [36, 1.3, 0.35, 8800, 90]], pwrH: 2.2, sag: 0.4, otLp: 7000 },
        { base: 'jcm800', stages: [[48, 1.45, 0.3, 10500, 50], [44, 1.1, 0.36, 7600, 140], [36, 1.05, 0.4, 7000, 120]], pwrH: 2.2, sag: 0.4, otLp: 6600, presHz: 3400, tight: 0.25 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('master', 'VOLUME'), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('presence', 'PRESENCE'), SEL('channel', 'CHANNEL', ['CH 1', 'CH 2', 'CH 3'], { def: 1, sweep: 90, optSize: 4.2 }), TOG('sag', 'VARIAC', ['OFF', 'ON'], { values: [0.4, 0.85] })],
      desc: 'Three-channel boutique classic; Variac softens the power section.' }),
    CAB({ id: 'bogner.cab-2x12', name: '2x12 Bogart', ref: 'Bogner 2x12 (V30 / G12M)', opts: { cab: { hp: 80, hpQ: 1.5, resDb: 4, lp: 5400, peaks: [[130, 1, 1.5], [900, 1, 1], [2300, 1.4, 3.5], [3800, 2, 2.5]], seed: 71 } }, cabSize: '2x12', grille: 'salt', logo: 'Bogart', logoColor: '#e6e6e6', piping: '#bdbdbd' }),
  ]);
}
