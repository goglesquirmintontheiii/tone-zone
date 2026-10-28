// Built-in Tone Zone plugin: Marshall.
// Blocks inspired by Marshall gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  const brit = { tolex: '#161616', panel: '#c9a64e', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall' };
  tz.addDefs([
    preampPair(AMP({ id: 'amp.plexi', name: 'Brit Plexi 100', ref: 'Marshall 1959 Super Lead', opts: { model: 'plexi' }, tolex: '#161616', panel: '#c9a64e', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall',
      controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'VOLUME I'), k('master', 'VOLUME II', { def: 0.65 }), TOG('bright', 'BRIGHT', ['HI', 'LO'], { values: [1, 0] })] })),
    preampPair(AMP({ id: 'amp.jcm800', name: 'Brit 800', ref: 'Marshall JCM800 2203', opts: { model: 'jcm800' }, tolex: '#161616', panel: '#c9a64e', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall', controls: marshallKnobs() })),
    preampPair(AMP({ id: 'amp.jubilee', name: 'Silver Jubilant', ref: 'Marshall Silver Jubilee 2555', opts: { model: 'jubilee' }, tolex: '#cfd2d6', panel: '#c6c9cd', panelText: '#121212', grille: 'black', logo: 'Marsh', logoColor: '#f4f4f4', logoPlate: '#121212', knob: 'chrome', controls: marshallKnobs('INPUT GAIN', 'OUTPUT') })),
    CAB({ id: 'cab.4x12gb', name: '4x12 Brit Greenback', ref: 'Marshall 1960B G12M Greenback', opts: { model: '4x12gb' }, cabSize: '4x12', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212' }),
    CAB({ id: 'cab.4x12t75', name: '4x12 Brit T75', ref: 'Marshall 1960A G12T-75', opts: { model: '4x12t75' }, cabSize: '4x12', grille: 'black', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212' }),

    // ---------------- v0.2
    AMPX({ id: 'marshall.amp-jcm900', name: 'Brit 900 Dual', ref: 'Marshall JCM900 4100 Dual Reverb', ...brit,
      opts: { models: [
        { base: 'jcm800', stages: [[40, 1.6, 0.25, 12000, 40], [30, 1.5, 0.3, 9000, 80]], tsPos: 2, pwrH: 2.2, sag: 0.3, otLp: 7200, presHz: 3500 },
        { base: 'slo', stages: [[48, 1.4, 0.32, 10000, 50], [44, 1.1, 0.36, 7600, 140], [38, 1.0, 0.42, 7000, 120], [26, 1.15, 0.3, 6500, 90]], stack: 'marshall', tsPos: 4, pwrH: 2.0, sag: 0.3, otLp: 6600, presHz: 3500, tight: 0.25 },
      ] },
      controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('ga', 'GAIN A', { def: 0.45, virtual: true }), k('gb', 'GAIN B', { def: 0.55, virtual: true }), k('master', 'MASTER'), TOG('channel', 'CHANNEL', ['A', 'B'], { def: 1 })],
      derive: (u) => ({ gain: (u.channel ?? 1) ? u.gb ?? 0.55 : u.ga ?? 0.45 }), desc: '90s dual-channel Marshall: clean / crunch A, hot diode-fed lead B.' }),
    AMPX({ id: 'marshall.amp-jvm', name: 'Brit JV4', ref: 'Marshall JVM410H', ...brit,
      opts: { models: [
        { base: 'plexi', stages: [[36, 1.8, 0.2, 13000, 30], [28, 1.8, 0.22, 10000, 60]], brightDb: 4, pwrH: 2.6, sag: 0.25, otLp: 7500 },
        { base: 'plexi', stages: [[42, 1.5, 0.3, 12000, 40], [34, 1.3, 0.35, 9000, 90]], pwrH: 2.2, sag: 0.35, otLp: 7000 },
        { base: 'jcm800', stages: [[46, 1.5, 0.3, 11000, 60], [42, 1.2, 0.35, 8000, 150], [28, 1.25, 0.32, 7000, 120]], pwrH: 2.2, sag: 0.3, otLp: 6800, tight: 0.2 },
        { base: 'slo', stages: [[50, 1.4, 0.32, 10000, 60], [46, 1.05, 0.38, 7500, 160], [40, 1.0, 0.42, 7000, 130], [28, 1.1, 0.3, 6400, 90]], stack: 'marshall', pwrH: 2.2, sag: 0.3, otLp: 6400, presHz: 3500, tight: 0.4 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('master', 'VOLUME'), k('presence', 'PRESENCE'), k('depth', 'RESONANCE'), SEL('channel', 'CHANNEL', ['CLEAN', 'CRUNCH', 'OD1', 'OD2'], { def: 2, sweep: 120, optSize: 4.2 })],
      desc: 'Four channels from sparkling clean to a modern Marshall lead.' }),
    AMPX({ id: 'marshall.amp-dsl', name: 'Brit DSL 100', ref: 'Marshall DSL100H', ...brit,
      opts: { models: [
        { base: 'plexi', stages: [[42, 1.5, 0.3, 12000, 40], [34, 1.35, 0.35, 9000, 90]], pwrH: 2.2, sag: 0.35, otLp: 7000 },
        { base: 'jcm800', stages: [[48, 1.45, 0.3, 10500, 60], [44, 1.1, 0.36, 7800, 150], [34, 1.1, 0.38, 7000, 120]], pwrH: 2.1, sag: 0.3, otLp: 6600, tight: 0.3 },
      ] },
      controls: [k('cg', 'CLASSIC GAIN', { def: 0.55, virtual: true }), k('ug', 'ULTRA GAIN', { def: 0.6, virtual: true }), k('treble', 'TREBLE'), k('mid', 'MIDDLE', { virtual: true }), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('depth', 'RESONANCE'), k('master', 'MASTER'),
        TOG('channel', 'CHANNEL', ['CLASSIC', 'ULTRA'], { def: 1 }), TOG('shift', 'TONE SHIFT', ['OFF', 'ON'], { virtual: true })],
      derive: (u) => ({ gain: (u.channel ?? 1) ? u.ug ?? 0.6 : u.cg ?? 0.55, mid: (u.mid ?? 0.5) * (u.shift ? 0.45 : 1) }), desc: 'Classic Gain and Ultra Gain channels; Tone Shift scoops the mids.' }),
    AMPX({ id: 'marshall.amp-bluesbreaker', name: 'Brit Blues Breaker', ref: 'Marshall 1962 Bluesbreaker', combo: true, speakers: 2, tolex: '#161616', panel: '#c9a64e', grille: 'wheat', logo: 'Marsh', logoColor: '#f6f2e6', logoPlate: '#121212', knob: 'marshall', piping: '#e8e2d2',
      opts: { voice: { base: 'plexi', stages: [[38, 1.45, 0.3, 11000, 35], [30, 1.3, 0.35, 8500, 80]], brightHz: 2000, brightDb: 5, pwrH: 1.5, sag: 0.5, otLp: 6600, otHp: 65, presHz: 3000 } },
      controls: [k('presence', 'PRESENCE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('gain', 'LOUDNESS 1', { def: 0.55 }), k('master', 'LOUDNESS 2', { def: 0.55 }), k('t.rate', 'SPEED', { def: 0.45 }), k('t.depth', 'INTENSITY', { def: 0 })],
      desc: 'KT66 2x12 combo with bias tremolo: the Beano tone.' }),
  ]);
}
