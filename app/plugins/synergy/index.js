// Built-in Tone Zone plugin: Synergy.
// Blocks inspired by Synergy gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  // desktop dock with a two-channel module: CH 1 gain/volume, CH 2 gain/volume, shared EQ, extra module switches
  tz.addForm('synergy-mod', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g;
    const row = d.controls.filter((c) => (c.t === 'knob' || c.t === 'toggle') && !c.hidden && (c.x === undefined || c._sy));
    const step = 38, w = Math.max(300, 46 + row.length * step), h = 172;
    const txt = d.text || '#f0f0f0';
    formKit.body(g, w, h, d.color || '#2a2c30', { rx: 10, brushed: true });
    label(g, 16, 16, 'MODULAR TUBE PREAMP', { anchor: 'start', size: 5.2, fill: '#c4c8ce', weight: 700, ls: 1.8 });
    const px = 12, py = 24, pw = w - 24, ph = 98;
    svg('rect', { x: px - 2.5, y: py - 2.5, width: pw + 5, height: ph + 5, rx: 5, fill: '#08090a' }, g);
    svg('rect', { x: px, y: py, width: pw, height: ph, rx: 4, fill: d.plate || '#151515' }, g);
    svg('rect', { x: px, y: py, width: pw, height: ph, rx: 4, fill: 'url(#g-shadeV)', 'fill-opacity': 0.35 }, g);
    if (d.plateStripe) svg('rect', { x: px, y: py + ph - 7, width: pw, height: 3, fill: d.plateStripe }, g);
    for (const [sx, sy] of [[px + 6, py + 6], [px + pw - 6, py + 6], [px + 6, py + ph - 6], [px + pw - 6, py + ph - 6]]) {
      svg('circle', { cx: sx, cy: sy, r: 2.6, fill: 'url(#g-chromeR)' }, g);
      svg('path', { d: `M${sx - 1.6} ${sy} H${sx + 1.6}`, stroke: '#333', 'stroke-width': 0.7 }, g);
    }
    label(g, px + 14, py + 15, d.logo || d.name, { anchor: 'start', size: 11, fill: d.logoColor || txt, font: d.logoFont || "'Oswald', sans-serif", weight: 700, ls: 1 });
    label(g, px + pw - 12, py + 15, (d.typeName || '').toUpperCase(), { anchor: 'end', size: 4.8, fill: txt, weight: 700, ls: 1.4, opacity: 0.75 });
    const ky = py + 66;
    row.forEach((c, i) => Object.assign(c, c.t === 'knob' ? { _sy: 1, x: 34 + i * step, y: ky, r: 11, labelPos: 'above', labelSize: 5 } : { _sy: 1, x: 32 + i * step, y: ky + 1, orient: 'v', optSize: 4.2 }));
    // section headers over the knob groups
    const sec = (i0, i1, t) => {
      const x0 = 34 + i0 * step - 14, x1 = 34 + i1 * step + 14;
      svg('path', { d: `M${x0} ${py + 32} H${x1}`, stroke: txt, 'stroke-opacity': 0.5, 'stroke-width': 0.8 }, g);
      label(g, (x0 + x1) / 2, py + 29, t, { size: 4.8, fill: txt, weight: 800, ls: 1.4 });
    };
    sec(0, 1, 'CHANNEL 1'); sec(2, 3, 'CHANNEL 2'); sec(4, 6, 'EQ');
    // dock bar: two soft switches with lamps, printed in light text
    const foots = d.controls.filter((c) => c.t === 'foot'), leds = d.controls.filter((c) => c.t === 'led');
    const fx = [w - 40, w - 92];
    foots.forEach((f, i) => Object.assign(f, { x: fx[i], y: 152, r: 8, style: 'soft', label: '' }));
    leds.forEach((l, i) => Object.assign(l, { x: fx[i] - 18, y: 152, r: 3 }));
    label(g, fx[0], 139, 'ON', { size: 5, fill: '#c4c8ce', weight: 700, ls: 1.2 });
    label(g, fx[1], 139, 'CH 2', { size: 5, fill: '#c4c8ce', weight: 700, ls: 1.2 });
    formKit.tzBadge(g, 40, h - 14, '#c4c8ce', 4);
    const theme = { text: txt, knob: d.knob || 'mxr', labelSize: 5 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 52, gap: 30, flip: ctx.flip }) };
  });
  const SYN = (o) => def(Object.assign({ cat: 'Preamp', form: 'synergy-mod', algo: 'amp', cost: 1.6, color: '#2a2c30', typeName: '2-channel module' }, o, {
    opts: { preamp: true, models: o.models },
    controls: [K('g1', 'GAIN', { def: o.g1 ?? 0.5, virtual: true }), K('v1', 'VOLUME', { virtual: true }), K('g2', 'GAIN', { def: o.g2 ?? 0.6, virtual: true }), K('v2', 'VOLUME', { virtual: true }),
      K('bass', 'BASS'), K('mid', 'MIDDLE'), K('treble', 'TREBLE'), ...(o.extra || []),
      FOOT({ action: 'bypass' }), FOOT({ action: 'param', p: 'ch', toggle: true, virtual: true }), LED({ color: '#3ddc84' }), LED({ bind: 'param:ch', color: '#ff2a1a' })],
    derive: (u) => Object.assign({ channel: u.ch ? 1 : 0, gain: u.ch ? u.g2 ?? o.g2 ?? 0.6 : u.g1 ?? o.g1 ?? 0.5,
      level: Math.max(-30, Math.min(12, (((u.ch ? u.v2 : u.v1) ?? 0.5) - 0.5) * 24 + (o.trim ?? -3))) }, o.derive ? o.derive(u) : {}),
  }));
  // shared voices
  const V = {
    plexiLo: { base: 'plexi', stages: [[40, 1.45, 0.28, 11000, 45], [34, 1.3, 0.32, 8600, 90]] },
    plexiHot: { base: 'plexi', drive: 1.25, stages: [[44, 1.4, 0.3, 11500, 45], [36, 1.25, 0.34, 8500, 100], [24, 1.3, 0.3, 7400, 90]], tsPos: 3 },
    cleanUS: { base: 'twin', stages: [[34, 1.6, 0.2, 11500, 30], [30, 1.7, 0.2, 9000, 40]] },
  };
  const cathode = TOG('cath', 'CATHODE', ['1', '2', '3'], { virtual: true, def: 1 });
  const cathD = (u) => ({ bass: cl((u.bass ?? 0.5) + ((u.cath ?? 1) - 1) * 0.1) });
  tz.addDefs([
    SYN({ id: 'synergy.be', name: 'Hazel Eye Module', ref: 'Synergy Friedman BE module', logo: 'HAZEL EYE', plate: '#141414', text: '#e8d9a8', knob: 'chrome', plateStripe: '#b89a4a',
      models: [V.plexiHot, { base: 'friedman' }], extra: [cathode], derive: cathD, desc: 'Brown Eye-style module: hot plexi crunch on channel 1, the full British high-gain voice on channel 2.' }),
    SYN({ id: 'synergy.hbe', name: 'Wild Hazel Module', ref: 'Synergy Friedman HBE module', logo: 'WILD HAZEL', plate: '#141414', text: '#e8d9a8', knob: 'chrome', plateStripe: '#8a2a2a',
      models: [{ base: 'friedman', drive: 0.8 }, { base: 'friedman', drive: 1.15, tight: 0.2 }], extra: [cathode], derive: cathD, trim: -4, desc: 'The hairier, more saturated Brown Eye voice with a tighter low end.' }),
    SYN({ id: 'synergy.ds', name: 'Dusty Shirl Module', ref: 'Synergy Friedman Dirty Shirley module', logo: 'DUSTY SHIRL', plate: '#141414', text: '#e8d9a8', knob: 'chrome', plateStripe: '#d0d0d0',
      models: [V.plexiLo, { base: 'plexi', drive: 1.3, stages: [[44, 1.4, 0.3, 10800, 50], [38, 1.25, 0.34, 8200, 100], [26, 1.3, 0.3, 7200, 90]], tsPos: 3 }], extra: [cathode], derive: cathD, desc: 'Crunch to heavy British grind, with less gain than the Brown Eye modules.' }),
    SYN({ id: 'synergy.slo', name: 'Slow-II Module', ref: 'Synergy Soldano SLO II module', logo: 'SLOW-II', plate: '#c9ccd1', text: '#151515', knob: 'chrome', plateStripe: '#151515',
      models: [{ base: 'slo', drive: 0.5 }, 'slo'], trim: -4, desc: 'SLO-style crunch and the classic smooth, singing overdrive channel.' }),
    SYN({ id: 'synergy.uber', name: 'Overshock Module', ref: 'Synergy Bogner Uberschall module', logo: 'OVERSHOCK', plate: '#1a1a1a', text: '#e2e2e2', knob: 'mxr', plateStripe: '#7a7d82',
      models: [{ base: 'uber', drive: 0.7 }, 'uber'], trim: -4, desc: 'Dark, crushing modern high gain on both channels.' }),
    SYN({ id: 'synergy.ecstasy', name: 'Euphoria Module', ref: 'Synergy Bogner Ecstasy module', logo: 'EUPHORIA', plate: '#b9bdc2', text: '#151515', knob: 'chrome', plateStripe: '#2a4a8a',
      models: [{ base: 'plexi', stages: [[42, 1.4, 0.3, 11500, 45], [36, 1.3, 0.32, 9000, 90], [24, 1.35, 0.3, 7800, 80]], brightDb: 2 }, { base: 'friedman', drive: 0.95, presHz: 3800 }],
      extra: [TOG('ex', 'EXCURSION', ['OFF', 'ON'], { virtual: true })], derive: (u) => ({ bass: cl((u.bass ?? 0.5) + (u.ex ? 0.12 : 0)) }), desc: 'Blue channel crunch and red channel lead from the classic German-American three-channel head.' }),
    SYN({ id: 'synergy.vh4', name: 'DV-4 Module', ref: 'Synergy Diezel VH4 module', logo: 'DV-4', plate: '#1e2228', text: '#d8dde4', knob: 'mxr', plateStripe: '#c9a64e',
      models: [{ base: 'vh4', drive: 0.7 }, 'vh4'], trim: -4, desc: 'Channels 3 and 4 of the famous German four-channel head: thick, tight high gain.' }),
    SYN({ id: 'synergy.herbert', name: 'Herb Module', ref: 'Synergy Diezel Herbert module', logo: 'HERB', plate: '#1e2228', text: '#d8dde4', knob: 'mxr', plateStripe: '#8a2a2a',
      models: [{ base: 'vh4', drive: 0.75, dark: 0.2 }, { base: 'vh4', drive: 1.1, dark: 0.15, tight: 0.25 }], trim: -4,
      extra: [TOG('midx', 'MID CUT', ['OFF', 'ON'], { virtual: true })], derive: (u) => ({ mid: cl((u.mid ?? 0.5) - (u.midx ? 0.2 : 0)) }), desc: 'Darker, heavier German high gain with a mid-cut switch.' }),
    SYN({ id: 'synergy.powerball', name: 'Powerglobe Module', ref: 'Synergy Engl Powerball module', logo: 'POWERGLOBE', plate: '#141414', text: '#e8e8e8', knob: 'mxr', plateStripe: '#c8322a',
      models: [{ base: '5150', drive: 0.65, tight: 0.3 }, { base: '5150', tight: 0.35 }], trim: -4, desc: 'Tight, aggressive German metal voice on two channels.' }),
    SYN({ id: 'synergy.deliverance', name: 'Deliverer Module', ref: 'Synergy Fryette Deliverance module', logo: 'DELIVERER', plate: '#c7cacf', text: '#111', knob: 'mxr', plateStripe: '#c99a2e',
      models: [{ base: 'jcm800', stages: [[43, 1.4, 0.3, 10500, 50], [38, 1.25, 0.34, 8000, 110], [28, 1.25, 0.3, 7200, 90]] }, { base: 'recto', stages: [[46, 1.35, 0.3, 10000, 60], [43, 1.15, 0.36, 7600, 130], [38, 1.05, 0.4, 6900, 120], [28, 1.2, 0.32, 6500, 90]], tight: 0.3 }],
      trim: -4, desc: 'Big American high gain: a crunchy first channel and a huge, tight second channel.' }),
    SYN({ id: 'synergy.morganac', name: 'Morrow AC Module', ref: 'Synergy Morgan AC module', logo: 'MORROW AC', plate: '#e3dccb', text: '#2a1d10', knob: 'cream', plateStripe: '#7a1f22',
      models: [{ base: 'ac30', drive: 0.8, tsType: 0 }, 'ac30'], desc: 'Class-A chime: a normal channel and a Top Boost channel.' }),
    SYN({ id: 'synergy.zwreck', name: 'Zed Wreckage Module', ref: 'Synergy Dr Z Z-Wreck module', logo: 'ZED WRECKAGE', plate: '#cbb98f', text: '#1e150b', knob: 'chicken', plateStripe: '#1e150b',
      models: [{ base: 'dc30', stages: [[38, 1.45, 0.24, 11500, 40], [32, 1.35, 0.28, 9000, 60]] }, { base: 'dc30', drive: 1.2, stages: [[44, 1.35, 0.28, 11000, 45], [38, 1.2, 0.32, 8500, 90], [26, 1.3, 0.3, 7600, 80]] }],
      desc: 'Touch-sensitive boutique crunch with a lot of top-end sparkle.' }),
    SYN({ id: 'synergy.imperial', name: 'Tone Queen Regal Module', ref: 'Synergy Tone King Imperial Mk II module', logo: 'TONE QUEEN', plate: '#e6dfcc', text: '#3a1414', knob: 'cream', plateStripe: '#7a1f22', g1: 0.4, g2: 0.55,
      models: [{ base: 'deluxe', stages: [[34, 1.5, 0.2, 11000, 30], [30, 1.5, 0.22, 8800, 40]], stack: 'fender' }, { base: 'deluxe', stages: [[40, 1.25, 0.3, 7800, 25], [32, 1.15, 0.36, 6400, 40]], stack: 'fender', tsPos: 1 }],
      trim: -1, desc: 'Blackface-style rhythm channel and a tweed-style lead channel.' }),
    SYN({ id: 'synergy.os', name: 'Smooth OS Module', ref: 'Synergy OS module (Dumble Overdrive Special)', logo: 'SMOOTH OS', plate: '#151515', text: '#e8d8a8', knob: 'chrome', plateStripe: '#e8d8a8',
      models: [{ base: 'dumble', drive: 0.55 }, 'dumble'], extra: [TOG('rj', 'VOICE', ['JAZZ', 'ROCK'], { virtual: true, def: 1 })], derive: (u) => ({ mid: cl((u.mid ?? 0.5) + (u.rj ?? 1) * 0.12) }), desc: 'Big clean and the smooth, vocal overdrive of a legendary hand-built amp.' }),
    SYN({ id: 'synergy.iicp', name: 'Boogaloo IIC Module', ref: 'Synergy IICP module (Mesa Mark IIC+)', logo: 'BOOGALOO IIC', plate: '#141414', text: '#e8e8e8', knob: 'mxr', plateStripe: '#e8e8e8',
      models: [{ base: 'markiic', drive: 0.45 }, 'markiic'], trim: -4, desc: 'Fat Californian clean and the famous focused lead channel.' }),
    SYN({ id: 'synergy.drect', name: 'Twin Rectify Module', ref: 'Synergy DRECT module (Mesa Dual Rectifier)', logo: 'TWIN RECTIFY', plate: '#9ea3aa', text: '#111', knob: 'mxr', plateStripe: '#111',
      models: [{ base: 'recto', drive: 0.55 }, 'recto'], trim: -4, desc: 'Loose, saturated modern rectified gain on two channels.' }),
  ]);
}
