// Built-in Tone Zone plugin: Fryette.
// Blocks inspired by Fryette gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    AMPX({ id: 'fryette.amp-d120', name: 'Fryer Deliverer 120', ref: 'Fryette Deliverance 120', tolex: '#111', panel: '#c7cacf', panelText: '#111', grille: 'black', logo: 'FRYER', logoFont: "'Oswald', sans-serif", logoSize: 30, logoColor: '#e9e9e9', knob: 'mxr', piping: '#e2e2e2',
      opts: { models: [
        { base: 'jcm800', stages: [[43, 1.4, 0.3, 10500, 50], [38, 1.25, 0.34, 8000, 110], [28, 1.25, 0.3, 7200, 90]], power: 1, pwrH: 2.6, sag: 0.25, otLp: 6600 },
        { base: 'recto', stages: [[46, 1.35, 0.3, 10000, 60], [43, 1.15, 0.36, 7600, 130], [38, 1.05, 0.4, 6900, 120], [28, 1.2, 0.32, 6500, 90]], tight: 0.3, pwrH: 2.6, sag: 0.2, otLp: 6400 },
      ] },
      controls: [k('g1', 'GAIN I', { def: 0.5, virtual: true }), k('g2', 'GAIN II', { def: 0.6, virtual: true }), k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('depth', 'DEPTH'), k('master', 'MASTER'),
        TOG('ch', 'CHANNEL', ['I', 'II'], { virtual: true, def: 1 }), TOG('voice', 'VOICE', ['FAT', 'NORM', 'TIGHT'], { virtual: true, def: 1 })],
      derive: (u) => ({ channel: u.ch ?? 1, gain: (u.ch ?? 1) ? u.g2 ?? 0.6 : u.g1 ?? 0.5, bass: cl((u.bass ?? 0.5) + [0.12, 0, -0.15][u.voice ?? 1]) }),
      trim: -6, desc: 'Big 120 W American high-gain head with two channels and a Fat / Normal / Tight voice switch.' }),
    CABM({ id: 'fryette.cab-d412', name: '4x12 Fryer Deliverer', ref: 'Fryette Deliverance 4x12 (Celestion V30)', opts: { cab: { hp: 68, hpQ: 1.8, resDb: 6, lp: 5500, peaks: [[105, 1, 3], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 341 } }, cabSize: '4x12', grille: 'black', logo: 'FRYER', logoFont: "'Oswald', sans-serif", logoSize: 16, logoColor: '#e9e9e9', piping: '#e2e2e2' },
      [{ type: 0, spk: 0, pos: 0.25 }, { type: 0, spk: 3, pos: 0.7, dist: 0.1, lvl: -5 }]),
  ]);
}
