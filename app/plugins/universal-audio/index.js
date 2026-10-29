// Built-in Tone Zone plugin: Universal Audio.
// Blocks inspired by Universal Audio gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, preampPair, stomp } = tz.builders;
  // ---- amp helpers (same pattern in every amp-brand plugin)
  // ampFit: fixed panel layout so mini toggles don't overlap the knob row or power LED.
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
  // UAFX-style amp pedal: amp (3 mods) -> [vibrato] -> [spring reverb] -> speaker cab (3 speakers or off) in one stompbox
  const UA = (o) => {
    const chain = [{ prefix: 'a', algo: 'amp', opts: { models: o.models } }];
    if (o.vib) chain.push({ prefix: 't', algo: 'tremolo', params: { mode: 1, rate: 0.5, depth: 0.45, wave: 0.2 }, on: false });
    if (o.verb) chain.push({ prefix: 'r', algo: 'reverb', params: { mode: 3, decay: 0.45, tone: 0.55, lowcut: 0.2 } });
    chain.push({ prefix: 'c', algo: 'cab', opts: { cabs: o.cabs } });
    // explicit layout: switches on top, two rows of knobs below (as on the real pedals)
    const kn = o.controls.filter((c) => c.t === 'knob'), tg = o.controls.filter((c) => c.t === 'toggle');
    kn.forEach((c, i) => Object.assign(c, { x: [40, 102, 164][i % 3], y: i < 3 ? 62 : 106, r: 12, labelPos: 'below' }));
    tg.forEach((t, i) => Object.assign(t, { x: tg.length === 2 ? [70, 134][i] : [40, 102, 164][i], y: 24, orient: 'h', optSize: 4.4 }));
    const d = def(Object.assign({ form: 'strymon', cat: 'Preamp', kind: 'Preamp', algo: 'chain', cost: 4.2, stereo: 'both', ports: MONO }, o, { opts: { chain } }));
    d.fixed = Object.assign({ 'a.master': 0.6 }, o.fixed || {});
    const dv = o.derive;
    d.derive = (u) => {
      const sp = u.spk ?? 0, boost = u.bst ? (u.boost ?? 0.5) : 0;
      const out = { 'c.on': sp < 3 ? 1 : 0, 'c.model': Math.min(2, sp), 'a.gain': Math.min(1, (u['a.gain'] ?? 0.5) + 0.35 * boost) };
      if (o.vib) out['t.on'] = u.vib ? 1 : 0;
      if (o.verb) out['r.on'] = (u['r.mix'] ?? 0) > 0.004 ? 1 : 0;
      return Object.assign(out, dv ? dv(u) : {});
    };
    return d;
  };
  const feet = () => [FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'param', p: 'bst', toggle: true, virtual: true, label: 'BOOST' }), LED({ color: '#ff2a1a' }), LED({ bind: 'param:bst', color: '#ff2a1a' })];
  const outK = () => K('a.level', 'OUTPUT', { min: -24, max: 12, def: -2, display: db });
  tz.addDefs([
    UA({ id: 'uafx.dream65', name: 'Dreamy 65 Reverb Amp', ref: "UAFX Dream '65 Reverb Amplifier", logo: "dreamy '65", tagline: 'REVERB AMPLIFIER', color: '#1b1b1d', text: '#e9e9e9', vib: true, verb: true,
      models: [
        { base: 'deluxe', drive: 1.2, stages: [[38, 1.4, 0.24, 11000, 25], [34, 1.35, 0.28, 8500, 40], [24, 1.4, 0.26, 7500, 60]], tsPos: 1 },
        'deluxe',
        { base: 'deluxe', brightDb: 3, pwrH: 1.8, sag: 0.35 },
      ],
      cabs: [
        { hp: 78, hpQ: 1.6, resDb: 4.5, lp: 5100, peaks: [[800, 0.9, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 211 },
        { hp: 100, hpQ: 0.9, resDb: 2, lp: 6000, open: true, peaks: [[180, 1, 1], [1200, 1.2, -2], [2600, 1.5, 4], [4300, 2, 2]], seed: 212 },
        { hp: 80, hpQ: 1.0, resDb: 2, lp: 7500, open: true, peaks: [[400, 1, -1], [3000, 1.3, 3], [5500, 2, 2]], seed: 213 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.45 }), K('r.mix', 'REVERB', { def: 0.2 }), outK(), K('a.bass', 'BASS', { def: 0.45 }), K('a.treble', 'TREBLE', { def: 0.6 }), K('boost', 'BOOST', { def: 0.5, virtual: true }),
        TOG('spk', 'SPEAKER', ['GB', 'OX', 'EV', 'OFF'], { virtual: true, def: 1 }), TOG('vib', 'VIBRATO', ['OFF', 'ON'], { virtual: true }), TOG('a.channel', 'MOD', ['LEAD', 'STOCK', 'D-TEX'], { def: 1 }), ...feet()],
      desc: "Blackface reverb combo in a pedal: amp, spring reverb, vibrato and three speakers. The right footswitch adds the BOOST amount." }),
    UA({ id: 'uafx.ruby63', name: 'Garnet 63 Top Boost', ref: "UAFX Ruby '63 Top Boost Amplifier", logo: "garnet '63", tagline: 'TOP BOOST AMPLIFIER', color: '#7a1f22', text: '#f2e6d8',
      models: [
        { base: 'ac30', tsType: 0, stack: 'vox' },
        'ac30',
        { base: 'ac30', drive: 1.25, stages: [[44, 1.35, 0.24, 11000, 30], [36, 1.25, 0.28, 9000, 70], [24, 1.3, 0.26, 7600, 80]] },
      ],
      cabs: [
        { hp: 100, hpQ: 1.1, resDb: 3, lp: 6500, open: true, peaks: [[900, 1, 1], [2500, 1.2, 5], [4500, 2, 3]], seed: 221 },
        { hp: 90, hpQ: 1.2, resDb: 3, lp: 5600, open: true, peaks: [[850, 1, 1.5], [2200, 1.3, 3.5], [3800, 2, 2]], seed: 222 },
        { hp: 95, hpQ: 1.0, resDb: 2, lp: 6200, open: true, peaks: [[700, 1, 1], [2400, 1.4, 3], [4500, 2, 2]], seed: 223 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.5 }), K('a.presence', 'CUT', { def: 0.5, invert: true }), outK(), K('a.bass', 'BASS'), K('a.treble', 'TREBLE', { def: 0.55 }), K('boost', 'BOOST', { def: 0.5, virtual: true }),
        TOG('spk', 'SPEAKER', ['BL', 'GR', 'JN', 'OFF'], { virtual: true }), TOG('a.channel', 'MOD', ['NORMAL', 'TB', 'CUSTOM'], { def: 1 }), ...feet()],
      desc: 'Class-A Top Boost combo in a pedal with three speaker choices and a boost footswitch.' }),
    UA({ id: 'uafx.lion68', name: 'Leo 68 Super Lead', ref: "UAFX Lion '68 Super Lead Amplifier", logo: "leo '68", tagline: 'SUPER LEAD AMPLIFIER', color: '#c9a64e', text: '#151515',
      models: [
        'plexi',
        { base: 'plexi', drive: 1.25, stages: [[44, 1.4, 0.3, 11500, 45], [36, 1.25, 0.34, 8500, 100], [24, 1.3, 0.3, 7400, 90]], tsPos: 3 },
        { base: 'jcm800', drive: 1.1, tight: 0.2 },
      ],
      cabs: [
        { hp: 75, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2], [800, 0.9, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 231 },
        { hp: 70, hpQ: 1.8, resDb: 5.5, lp: 5600, peaks: [[110, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 232 },
        { hp: 70, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2.5], [450, 1, 1.5], [1800, 1.3, 2.5], [3200, 1.8, 1.5]], seed: 233 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.55 }), K('a.presence', 'PRESENCE'), outK(), K('a.bass', 'BASS'), K('a.mid', 'MIDDLE'), K('a.treble', 'TREBLE'),
        TOG('spk', 'SPEAKER', ['GB', 'V3', '65', 'OFF'], { virtual: true }), TOG('a.channel', 'MOD', ['STOCK', 'PLEXI', 'BROWN'], { def: 0 }), ...feet()],
      derive: (u) => ({ 'a.gain': Math.min(1, (u['a.gain'] ?? 0.55) + (u.bst ? 0.25 : 0)) }),
      desc: 'Plexi Super Lead stack in a pedal: three amp mods, three 4x12 speaker voicings and a boost footswitch.' }),
  ]);
  tz.addDefs([
    UA({ id: 'uafx.woodrow55', name: 'Woody 55 Tweed Amp', ref: "UAFX Woodrow '55 Instrument Amplifier", logo: "woody '55", tagline: 'INSTRUMENT AMPLIFIER', color: '#c8ad74', text: '#2a1d10',
      models: [
        { base: 'deluxe', stages: [[40, 1.25, 0.3, 7600, 25], [32, 1.15, 0.36, 6200, 40]], stack: 'fender', tsPos: 1, brightHz: 1600, brightDb: 0, pwrH: 0.9, sag: 0.75, nfb: 0, otLp: 5200, otHp: 80, presHz: 0 },
        { base: 'deluxe', stages: [[40, 1.25, 0.3, 8400, 25], [32, 1.15, 0.36, 6800, 40]], stack: 'fender', tsPos: 1, brightHz: 1600, brightDb: 4, pwrH: 0.9, sag: 0.75, nfb: 0, otLp: 5600, otHp: 80, presHz: 0 },
        { base: 'deluxe', drive: 1.2, stages: [[42, 1.2, 0.32, 8000, 25], [34, 1.1, 0.38, 6500, 40], [22, 1.3, 0.3, 6000, 60]], stack: 'fender', tsPos: 1, brightHz: 1600, brightDb: 2, pwrH: 0.9, sag: 0.8, nfb: 0, otLp: 5200, otHp: 80, presHz: 0 },
      ],
      cabs: [
        { hp: 85, hpQ: 1.4, resDb: 4, lp: 5000, peaks: [[130, 1, 1.5], [800, 1, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 241 },
        { hp: 100, hpQ: 0.9, resDb: 2, lp: 6400, open: true, peaks: [[900, 1, 1.5], [2400, 1.3, 3.5], [4800, 2, 2]], seed: 242 },
        { hp: 95, hpQ: 1.0, resDb: 2.5, lp: 5600, open: true, peaks: [[250, 1, 1], [1200, 1.2, -1.5], [2600, 1.6, 4], [4200, 2, 2]], seed: 243 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.5 }), K('a.treble', 'TONE', { def: 0.55 }), outK(), K('boost', 'BOOST', { def: 0.5, virtual: true }),
        TOG('spk', 'SPEAKER', ['GB', 'BL', 'JN', 'OFF'], { virtual: true, def: 2 }), TOG('a.channel', 'MOD', ['NORMAL', 'BRIGHT', 'JUMPED'], { def: 0 }), ...feet()],
      fixed: { 'a.bass': 0.5, 'a.mid': 0.55 }, desc: 'Tweed 5E3 combo in a pedal: one volume, one tone, three channel mods and three speakers.' }),
    UA({ id: 'uafx.enigmatic82', name: 'Riddle 82 Overdrive Special', ref: "UAFX Enigmatic '82 Overdrive Special Amplifier", logo: "riddle '82", tagline: 'OVERDRIVE SPECIAL AMPLIFIER', color: '#1f1f22', text: '#e6e1d3',
      models: [
        { base: 'dumble', stages: [[44, 1.45, 0.27, 10800, 35], [36, 1.25, 0.32, 8200, 100], [26, 1.3, 0.3, 7400, 80]], pwrH: 2.6, sag: 0.35, otLp: 7100 },
        { base: 'dumble', stages: [[40, 1.5, 0.25, 11500, 30], [34, 1.35, 0.3, 9000, 80], [24, 1.35, 0.28, 8000, 70]], pwrH: 2.8, sag: 0.3, otLp: 7600 },
        { base: 'dumble', drive: 1.15, stages: [[46, 1.4, 0.28, 10200, 40], [38, 1.2, 0.34, 7800, 110], [28, 1.25, 0.3, 7000, 90]], pwrH: 2.4, sag: 0.4, otLp: 6800 },
      ],
      cabs: [
        { hp: 90, hpQ: 1.3, resDb: 3.5, lp: 5200, peaks: [[140, 1, 1.5], [800, 1, 1.5], [2000, 1.3, 3], [3400, 1.8, 2]], seed: 251 },
        { hp: 80, hpQ: 1.1, resDb: 3, lp: 6400, open: true, peaks: [[150, 1, 1.5], [1000, 1, -0.5], [2800, 1.3, 3], [5000, 2, 1.5]], seed: 252 },
        { hp: 75, hpQ: 1.0, resDb: 2.5, lp: 7200, open: true, peaks: [[160, 1, 1.5], [1100, 1, -1], [3000, 1.3, 2.5], [5500, 2, 1.5]], seed: 253 },
      ],
      controls: [K('vol', 'VOLUME', { def: 0.45, virtual: true }), K('od', 'OVERDRIVE', { def: 0.6, virtual: true }), K('a.level', 'OUTPUT', { min: -24, max: 12, def: -4, display: db }), K('a.bass', 'BASS'), K('a.mid', 'MIDDLE'), K('a.treble', 'TREBLE', { def: 0.55 }),
        TOG('a.channel', 'TONE', ['ROCK', 'JAZZ', 'CUSTOM'], { def: 0 }), TOG('spk', 'CAB', ['GB', 'D65', 'EV', 'OFF'], { virtual: true }),
        FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'param', p: 'bst', toggle: true, virtual: true, label: 'OVERDRIVE' }), LED({ color: '#ff2a1a' }), LED({ bind: 'param:bst', color: '#ff2a1a' })],
      derive: (u) => ({ 'a.gain': u.bst ? 0.35 + 0.65 * (u.od ?? 0.6) : 0.2 + 0.5 * (u.vol ?? 0.45) }),
      desc: 'Overdrive Special in a pedal: clean channel, footswitchable overdrive, Rock / Jazz / Custom voicing and three cabs.' }),
    UA({ id: 'uafx.anti1992', name: 'Contra 1992 High Gain', ref: 'UAFX ANTI 1992 High Gain Amp', logo: 'contra 1992', tagline: 'HIGH GAIN AMPLIFIER', color: '#3b3d42', text: '#ececec',
      models: [
        { base: 'slo', drive: 0.45 },
        { base: 'slo', drive: 0.75 },
        'slo',
      ],
      cabs: [
        { hp: 70, hpQ: 1.8, resDb: 5.5, lp: 5600, peaks: [[110, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 261 },
        { hp: 70, hpQ: 1.8, resDb: 5.5, lp: 5300, peaks: [[110, 1, 2.5], [450, 1, -1.5], [2500, 1.4, 4], [4200, 2, 2.5]], seed: 262 },
        { hp: 70, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2.5], [450, 1, 1.5], [1800, 1.3, 2.5], [3200, 1.8, 1.5]], seed: 263 },
      ],
      controls: [K('a.gain', 'GAIN', { def: 0.6 }), K('a.presence', 'PRESENCE'), K('a.level', 'OUTPUT', { min: -24, max: 12, def: -7, display: db }), K('a.bass', 'BASS'), K('a.mid', 'MIDDLE'), K('a.treble', 'TREBLE'),
        TOG('a.channel', 'CHANNEL', ['CLEAN', 'CRUNCH', 'OD'], { def: 2 }), TOG('spk', 'SPEAKER', ['V30', 'T75', '65', 'OFF'], { virtual: true }), ...feet()],
      desc: 'Hot-rodded 100 W high-gain head in a pedal: clean, crunch and overdrive, three 4x12 voicings and a boost.' }),
    UA({ id: 'uafx.knuckles92', name: 'Brass Knucks 92', ref: "UAFX Knuckles '92 Rev F Dual Rec Amplifier", logo: "knucks '92", tagline: 'DUAL RECTIFIED AMPLIFIER', color: '#161617', text: '#e8e8e8',
      models: [
        { base: 'recto', drive: 0.4 },
        { base: 'recto', drive: 0.75 },
        'recto',
      ],
      cabs: [
        { hp: 68, hpQ: 1.8, resDb: 6, lp: 5500, peaks: [[105, 1, 3], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 271 },
        { hp: 70, hpQ: 1.7, resDb: 5, lp: 5800, peaks: [[110, 1, 2.5], [1500, 1.2, 2], [3000, 1.6, 4.5], [5000, 2.5, 2.5]], seed: 272 },
        { hp: 75, hpQ: 1.5, resDb: 4.5, lp: 5600, peaks: [[120, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 273 },
      ],
      controls: [K('a.gain', 'GAIN', { def: 0.6 }), K('a.presence', 'PRESENCE'), K('a.level', 'OUTPUT', { min: -24, max: 12, def: -8, display: db }), K('a.bass', 'BASS'), K('a.mid', 'MIDDLE', { def: 0.45 }), K('a.treble', 'TREBLE'),
        TOG('a.channel', 'CHANNEL', ['GRN', 'ORG', 'RED'], { def: 2 }), TOG('rect', 'RECT', ['DIODE', 'TUBE'], { virtual: true }), TOG('spk', 'SPEAKER', ['V30', 'OS', '2X12', 'OFF'], { virtual: true }), ...feet()],
      derive: (u) => ({ 'a.sag': u.rect ? 0.75 : 0.3 }),
      desc: 'Three-channel rectified high-gain head in a pedal: clean, vintage and modern red, diode or tube rectifier, three cabs.' }),
  ]);

}
