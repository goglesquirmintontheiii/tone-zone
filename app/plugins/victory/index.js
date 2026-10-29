// Built-in Tone Zone plugin: Victory.
// Blocks inspired by Victory gear. Names, logos and artwork are Tone Zone originals; control layouts and
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
  // ---- V4 valve preamp pedal: rugged enclosure with a window showing the glowing valve
  tz.addForm('victory-v4', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = 160, h = 236, txt = d.text || '#f0f0f0';
    formKit.body(g, w, h, d.color, { rx: 8, brushed: true });
    const kn = d.controls.filter((c) => c.t === 'knob');
    kn.forEach((c, i) => Object.assign(c, { x: i < 3 ? 30 + i * 50 : 55 + (i - 3) * 50, y: i < 3 ? 30 : 74, r: 11, labelPos: 'below', labelSize: 5.4 }));
    // valve window
    const wy = 104;
    svg('rect', { x: 52, y: wy, width: 56, height: 30, rx: 6, fill: '#0c0c0d', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 56, y: wy + 4, width: 48, height: 22, rx: 4, fill: 'url(#vic-glow)' }, g);
    for (let i = 0; i < 9; i++) svg('line', { x1: 58 + i * 5.5, y1: wy + 4, x2: 58 + i * 5.5, y2: wy + 26, stroke: '#000', 'stroke-width': 1.4, opacity: 0.55 }, g);
    const defs = document.getElementById('globalDefs');
    if (defs && !document.getElementById('vic-glow')) {
      const rg = svg('radialGradient', { id: 'vic-glow', cx: 0.5, cy: 0.6, r: 0.6 }, defs);
      for (const [o, c, a] of [[0, '#ffd27a', 1], [0.35, '#ff8a2a', 0.85], [1, '#3a1206', 0.9]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, rg);
    }
    const tg = d.controls.filter((c) => c.t === 'toggle');
    tg.forEach((t, i) => Object.assign(t, { x: [24, w - 24][i], y: wy + 14, orient: 'v', optSize: 4.2, labelSide: i ? 'left' : undefined }));
    label(g, w / 2, 154, d.logo || d.name, { size: 15, fill: d.logoColor || txt, font: "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    label(g, w / 2, 167, (d.typeName || 'V4 PREAMP').toUpperCase(), { size: 5.2, fill: txt, weight: 700, ls: 1.6, opacity: 0.8 });
    d.controls.forEach((c) => {
      if (c.t === 'led') Object.assign(c, { x: w / 2, y: 180, r: 3 });
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: w / 2, y: 206, r: 13 });
    });
    formKit.tzBadge(g, w - 26, h - 9, txt, 4);
    const theme = { text: txt, knob: d.knob || 'chrome', labelSize: 5.4, toggleTitles: false };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 200, gap: 26, flip: ctx.flip }) };
  });
  const V4 = (o) => def(Object.assign({ form: 'victory-v4', cat: 'Preamp', kind: 'Preamp', algo: 'amp', cost: 1.6, typeName: 'V4 valve preamp', ports: { ins: ['INPUT'], outs: ['PREAMP OUT'] } }, o, {
    opts: { preamp: true, models: o.models },
    controls: [K('level', 'VOLUME', { min: -24, max: 12, def: -4, display: db }), K('gain', 'GAIN', { def: 0.6 }), K('bass', 'BASS'), K('mid', 'MIDDLE'), K('treble', 'TREBLE'), ...o.sw, LED({ color: '#ff8a2a' }), FOOT()],
  }));
  tz.addDefs([
    AMPX({ id: 'victory.amp-v30', name: 'V3O The Marquise', ref: 'Victory V30 The Countess MKII', tolex: '#3a2618', panel: '#b87333', panelText: '#1a1008', grille: 'black', headGrille: false, corners: false, logo: 'VICTOR', logoFont: "'Oswald', sans-serif", logoColor: '#e9c79a', logoPlate: '#1a1008', knob: 'chrome', piping: '#e2a66a',
      opts: { models: [
        { base: 'plexi', stages: [[40, 1.5, 0.26, 12000, 35], [32, 1.45, 0.3, 9500, 80]], pwrH: 2.0, sag: 0.35, otLp: 7200 },
        { base: 'jcm800', stages: [[48, 1.45, 0.3, 10800, 55], [44, 1.1, 0.36, 7800, 150], [34, 1.1, 0.38, 7000, 120]], pwrH: 2.0, sag: 0.35, otLp: 6700, tight: 0.3 },
      ] },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('master', 'VOLUME'), k('bass', 'BASS'), k('mid', 'MIDDLE'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), TOG('channel', 'CHANNEL', ['CLEAN', 'LEAD'], { def: 1 }), TOG('sag', 'POWER', ['HIGH', 'LOW'], { values: [0.35, 0.8] })],
      desc: 'Compact EL34 British head: articulate clean and a smooth, saturated lead.' }),
    V4({ id: 'victory.kraken', name: 'V4 The Leviathan', ref: 'Victory V4 The Kraken Preamp', logo: 'LEVIATHAN', color: '#1f2628', text: '#7fe0d6',
      models: [{ base: '5150', stages: [[46, 1.45, 0.3, 10500, 55], [40, 1.15, 0.35, 7800, 160], [30, 1.15, 0.35, 7000, 120]], tsPos: 3, tight: 0.5 }, { base: '5150', drive: 1.1, tight: 0.75 }],
      sw: [TOG('channel', 'GAIN', ['LO', 'HI'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Real-valve high-gain preamp pedal: tight, modern and aggressive.' }),
    V4({ id: 'victory.sheriff', name: 'V4 The Marshal', ref: 'Victory V4 The Sheriff Preamp', logo: 'THE MARSHAL', color: '#5a3b20', text: '#f0d8a8',
      models: [{ base: 'plexi', stages: [[42, 1.5, 0.28, 11500, 40], [34, 1.35, 0.33, 9000, 90]] }, { base: 'jcm800', drive: 1.05 }],
      sw: [TOG('channel', 'GAIN', ['LO', 'HI'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Real-valve British crunch preamp pedal, from plexi to 800-style lead.' }),
    V4({ id: 'victory.countess', name: 'V4 The Marquise', ref: 'Victory V4 The Countess Preamp', logo: 'THE MARQUISE', color: '#8a5530', text: '#f6e2c4',
      models: [{ base: 'plexi', stages: [[44, 1.45, 0.3, 11500, 45], [38, 1.2, 0.35, 8500, 110], [26, 1.25, 0.3, 7400, 90]], tsPos: 3 }, { base: 'jcm800', stages: [[48, 1.45, 0.3, 10800, 55], [44, 1.1, 0.36, 7800, 150], [34, 1.1, 0.38, 7000, 120]], tight: 0.3 }],
      sw: [TOG('channel', 'GAIN', ['LO', 'HI'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'])],
      desc: 'Real-valve preamp pedal with the V30 head voicing: rich crunch to singing lead.' }),
  ]);
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// V1 valve drive pedals: same rugged box and valve window as the V4 preamps, used as stomp drives.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const V1 = (o) => def(Object.assign({ form: 'victory-v4', algo: 'drive', typeName: 'V1 valve drive', cost: 0.6 }, o, {
    controls: [t('level', 'VOLUME'), t('gain', 'GAIN', { def: 0.55 }), t('tone', 'TONE'), TOG('mode', 'GAIN', ['LO', 'HI'], { def: 1 }), TOG('bright', 'BRIGHT', ['OFF', 'ON'], { values: [0, 0.5] }), LED({ color: '#ff8a2a' }), FOOT()],
  }));
  tz.addDefs([
    V1({ id: 'victory.v1kraken', name: 'V1 The Leviathan', ref: 'Victory V1 The Kraken', logo: 'LEVIATHAN', color: '#1f2628', text: '#7fe0d6',
      opts: { clip: 'tube', stages: 3, stage2Db: 8, preHp: 120, tone: 'lp', toneLo: 1300, toneHi: 9000, postLp: 7200, levelMaxDb: -6, modes: [{ gainMinDb: 8, gainMaxDb: 40 }, { gainMinDb: 12, gainMaxDb: 50 }] },
      desc: 'Real-valve high-gain drive pedal: tight, modern and aggressive.' }),
    V1({ id: 'victory.v1jack', name: 'V1 The Jackal', ref: 'Victory V1 The Jack', logo: 'THE JACKAL', color: '#3a3a3e', text: '#f0d8a8',
      opts: { clip: 'tube', stages: 2, stage2Db: 6, preHp: 90, tone: 'lp', toneLo: 1300, toneHi: 9500, postLp: 8000, levelMaxDb: -2, modes: [{ gainMinDb: 4, gainMaxDb: 34 }, { gainMinDb: 8, gainMaxDb: 44 }] },
      desc: 'Real-valve British rock drive pedal, from crunch to hot-rodded lead.' }),
  ]);
}
