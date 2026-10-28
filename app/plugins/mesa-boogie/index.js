// Built-in Tone Zone plugin: Mesa/Boogie.
// Blocks inspired by Mesa/Boogie gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
    preampPair(AMP({ id: 'amp.recto', name: 'Cali Rectifire', ref: 'Mesa/Boogie Dual Rectifier', opts: { models: ['recto_clean', 'recto'] }, tolex: '#151515', panel: '#b9bec5', panelText: '#111', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', knob: 'mesa',
      controls: [k('gain', 'GAIN'), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CH', ['CLEAN', 'MODERN'], { def: 1 })] })),
    preampPair(AMP({ id: 'amp.markiic', name: 'Cali Mark IIC', ref: 'Mesa/Boogie Mark IIC+', opts: { model: 'markiic' }, combo: true, speakers: 1, tolex: '#2a2016', panel: '#151515', panelText: '#e8e8e8', grille: 'black', logo: 'Boogaloo', logoColor: '#e0c890', knob: 'mesa',
      controls: [k('gain', 'VOLUME'), k('treble', 'TREBLE'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('master', 'MASTER'), k('presence', 'PRESENCE')] })),
    CAB({ id: 'cab.4x12v30', name: '4x12 Cali V30', ref: 'Mesa Rectifier 4x12 V30', opts: { model: '4x12v30' }, cabSize: '4x12', grille: 'diamond', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#ddd' }),

    // ---------------- v0.2
    AMPX({ id: 'mesa.amp-markv', name: 'Cali Mark Five', ref: 'Mesa/Boogie Mark V', tolex: '#141414', panel: '#151515', panelText: '#e8e8e8', grille: 'black', logo: 'Boogaloo', logoColor: '#e0c890', knob: 'mesa', piping: '#3a3a3a',
      opts: { models: [
        { base: 'recto_clean', stages: [[36, 1.7, 0.2, 12500, 20], [28, 1.8, 0.2, 10000, 30]], stack: 'mesa', pwrH: 3.2, sag: 0.25, otLp: 7600 },
        { base: 'markiic', stages: [[40, 1.5, 0.25, 11000, 30], [38, 1.25, 0.33, 8500, 110], [30, 1.2, 0.33, 7200, 90]], gainPos: 1, tsPos: 1, pwrH: 2.5, sag: 0.3, otLp: 7000 },
        { base: 'markiic', drive: 1.1, tight: 0.35, otLp: 6600, presHz: 3600 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('master', 'MASTER'), k('treble', 'TREBLE', { def: 0.65 }), k('mid', 'MID', { def: 0.35 }), k('bass', 'BASS', { def: 0.4 }), k('presence', 'PRESENCE'), SEL('channel', 'CHANNEL', ['CH 1', 'CH 2', 'CH 3'], { def: 2, sweep: 90, optSize: 4.2 })],
      desc: 'Three channels with the cascading Mark lead (IIC+ mode on channel 3).' }),
    AMPX({ id: 'mesa.amp-triplecrown', name: 'Cali Triple Throne', ref: 'Mesa/Boogie Triple Crown TC-50', tolex: '#141414', panel: '#121212', panelText: '#d8b65e', grille: 'black', logo: 'Triple Throne', logoFont: "'Oswald', sans-serif", logoSize: 20, logoColor: '#d8b65e', knob: 'mesa', piping: '#8a7340',
      opts: { models: [
        { base: 'recto_clean', stages: [[35, 1.7, 0.2, 12000, 25], [28, 1.8, 0.2, 9500, 35]], stack: 'mesa', pwrH: 2.4, sag: 0.3, otLp: 7300 },
        { base: 'jcm800', stages: [[46, 1.45, 0.3, 10500, 50], [42, 1.15, 0.35, 8000, 140], [32, 1.2, 0.33, 7000, 110]], stack: 'mesa', pwrH: 2.0, sag: 0.35, otLp: 6600, tight: 0.25 },
        { base: 'recto', drive: 1.05, stack: 'mesa', tight: 0.45, sag: 0.35, otLp: 6400, presHz: 3700 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('presence', 'PRESENCE'), k('master', 'MASTER'), SEL('channel', 'CHANNEL', ['1', '2', '3'], { def: 2, sweep: 90, optSize: 4.4 })],
      desc: 'EL34 three-channel head: modern, tight and articulate.' }),
    AMPX({ id: 'mesa.amp-lonestar', name: 'Cali Lone Ranger', ref: 'Mesa/Boogie Lonestar Classic', combo: true, speakers: 1, tolex: '#151515', panel: '#e6decb', panelText: '#1a1a1a', grille: 'wheat', logo: 'Lone Ranger', logoColor: '#2a1d10', knob: 'mesa', piping: '#e6decb',
      opts: { models: [
        { base: 'deluxe', stages: [[35, 1.7, 0.18, 12000, 22], [30, 1.8, 0.2, 9500, 32]], brightDb: 5, pwrH: 2.6, sag: 0.3, otLp: 7200 },
        { base: 'dumble', stages: [[42, 1.5, 0.27, 10500, 35], [36, 1.25, 0.32, 8000, 100], [26, 1.3, 0.3, 7200, 80]], pwrH: 2.4, sag: 0.4, otLp: 6900 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.5 }), k('treble', 'TREBLE'), k('mid', 'MID'), k('bass', 'BASS'), k('r.mix', 'REVERB', { def: 0.18 }), k('presence', 'PRESENCE'), k('master', 'MASTER'), TOG('channel', 'CHANNEL', ['1', '2'])],
      desc: 'American boutique clean and a smooth, vocal drive channel.' }),
    AMPX({ id: 'mesa.amp-subway', name: 'Cali Tube-way 800', ref: 'Mesa/Boogie Subway D-800', cat: 'Bass Amp', tolex: '#151515', panel: '#c4c8cc', panelText: '#111', grille: 'black', headGrille: false, logo: 'Tube-way', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', knob: 'mesa',
      opts: { voice: { base: 'markbass', stages: [[12, 4.0, 0.05, 15000, 15]], tsType: 3, baxBass: 55, baxTreble: 4500, baxRange: 15, otLp: 12000 } },
      controls: [k('gain', 'GAIN', { def: 0.45 }), k('bass', 'BASS'), k('mid', 'MID'), k('midfreq', 'MID FREQ'), k('treble', 'TREBLE'), k('master', 'MASTER'), TOG('ultralo', 'DEEP', ['OFF', 'ON']), TOG('ultrahi', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Lightweight 800 W class-D bass head with a sweepable mid.' }),
    CAB({ id: 'mesa.cab-2x12recto', name: '2x12 Cali V30', ref: 'Mesa Rectifier 2x12 (V30)', opts: { cab: { hp: 78, hpQ: 1.6, resDb: 4.5, lp: 5600, peaks: [[120, 1, 1.5], [1500, 1.2, 2], [2900, 1.6, 5], [4600, 2.5, 2.5]], seed: 51 } }, cabSize: '2x12', grille: 'black', logo: 'Rectifire', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2', piping: '#9ea4ab' }),
    CAB({ id: 'mesa.cab-subway2x10', name: '2x10 Cali Tube-way', ref: 'Mesa/Boogie Subway 2x10', bass: true, opts: { cab: { hp: 48, hpQ: 1.1, resDb: 2.5, lp: 7500, peaks: [[95, 1, 2], [700, 1, 0.8], [4000, 1.2, 3]], seed: 52, detail: 1.2 } }, cabSize: '2x10', grille: 'black', logo: 'Tube-way', logoFont: "'Oswald', sans-serif", logoColor: '#d9dde2' }),
  ]);
}
