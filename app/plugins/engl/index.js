// Built-in Tone Zone plugin: ENGL.
// Blocks inspired by ENGL gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  const engl = { tolex: '#131313', panel: '#161617', panelText: '#e2e2e2', grille: 'black', logoFont: "'Oswald', sans-serif", logoPlate: '#c9cdd2', knob: 'chrome' };
  tz.addDefs([
    AMPX({ id: 'engl.amp-fireball', name: 'Fireorb 100', ref: 'ENGL Fireball 100 (E625)', ...engl, logo: 'ENGEL', logoColor: '#c8202a', panelText: '#e85a3a',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.2, 12000, 25], [28, 1.7, 0.22, 9500, 40]], stack: 'peavey', pwrH: 2.6, sag: 0.25, otLp: 7200 },
        { base: '5150', stages: [[50, 1.45, 0.3, 10000, 55], [46, 1.05, 0.36, 7600, 170], [40, 1.0, 0.4, 7000, 150], [28, 1.1, 0.33, 6400, 100]], stack: 'marshall', tight: 0.7, sag: 0.25, otLp: 6300, presHz: 3700 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CHANNEL', ['CLEAN', 'LEAD'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Brutal, compressed German metal lead with a tight low end.' }),
    AMPX({ id: 'engl.amp-powerball', name: 'Powerorb II', ref: 'ENGL Powerball II (E645/2)', ...engl, logo: 'ENGEL', logoColor: '#2b6fd6', panelText: '#cfd8e6',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.2, 12500, 25], [28, 1.8, 0.2, 10000, 35]], stack: 'mesa', pwrH: 2.8, sag: 0.25, otLp: 7400 },
        { base: 'jcm800', stages: [[44, 1.5, 0.28, 11000, 45], [38, 1.2, 0.33, 8200, 120], [28, 1.2, 0.3, 7200, 100]], stack: 'mesa', pwrH: 2.4, sag: 0.3, otLp: 6900 },
        { base: 'vh4', stages: [[48, 1.45, 0.3, 10500, 50], [44, 1.1, 0.36, 7800, 150], [36, 1.05, 0.38, 7200, 130]], tsPos: 3, tight: 0.5, otLp: 6600 },
        { base: 'vh4', drive: 1.1, tight: 0.75, otLp: 6300 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('depth', 'DEPTH'), k('master', 'MASTER'), SEL('channel', 'CHANNEL', ['CLEAN', 'CRUNCH', 'LEAD', 'ULTRA'], { def: 2, sweep: 120, optSize: 4 })],
      desc: 'Four channels of 6L6 power: from glassy clean to a crushing, hi-fi ultra lead.' }),
    AMPX({ id: 'engl.amp-savage', name: 'Ravage 120', ref: 'ENGL Savage 120 Mark II', ...engl, panel: '#c4c8cd', panelText: '#121212', logo: 'RAVAGE', logoColor: '#141414', logoPlate: '#c4c8cd',
      opts: { models: [
        { base: 'plexi', stages: [[38, 1.6, 0.22, 12000, 30], [30, 1.6, 0.25, 9500, 60]], pwrH: 2.8, sag: 0.25, otLp: 7300 },
        { base: 'jcm800', stages: [[46, 1.45, 0.3, 10500, 55], [42, 1.15, 0.35, 7800, 150], [32, 1.15, 0.35, 7000, 120]], tight: 0.4, otLp: 6700 },
        { base: 'uber', drive: 1.05, tight: 0.55, otLp: 6200, presHz: 3600 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'MASTER'), SEL('channel', 'CHANNEL', ['1', '2', '3'], { def: 2, sweep: 90, optSize: 4.4 }), TOG('depth', 'CONTOUR', ['OFF', 'ON'], { values: [0.5, 0.8] })],
      desc: 'Aggressive yet organic 120 W head: modern rock and metal rhythm machine.' }),
    CAB({ id: 'engl.cab-pro4x12', name: '4x12 Engel Pro', ref: 'ENGL Pro 4x12 (E412VS, V30)', opts: { cab: { hp: 68, hpQ: 1.8, resDb: 5.5, lp: 5500, peaks: [[105, 1, 2.5], [1500, 1.2, 2], [2900, 1.6, 4.5], [4500, 2.5, 2.5]], seed: 91 } }, cabSize: '4x12', grille: 'black', logo: 'ENGEL', logoFont: "'Oswald', sans-serif", logoColor: '#c8202a', logoPlate: '#c9cdd2' }),
  ]);
}
