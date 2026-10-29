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
  registerPedals(tz);
}

// ================================================================ pedals (v0.4)
// Early-90s style drive pedals (and the reissues): black box, gold-trimmed control panel, script badge.
function registerPedals(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;

  tz.addForm('marshall-pedal', (ctx, d) => {
    const g = ctx.g;
    const mine = (c) => c.x === undefined || c._fa;
    const kn = d.controls.filter((c) => c.t === 'knob' && mine(c));
    const tg = d.controls.filter((c) => c.t === 'toggle' && mine(c));
    const perRow = kn.length > 5 ? 3 : kn.length;
    const w = perRow > 3 ? 196 : 150;
    const rows = [];
    for (let i = 0; i < kn.length; i += perRow) rows.push(kn.slice(i, i + perRow));
    const panelH = 14 + rows.length * 44 + (tg.length ? 30 : 0);
    const ly = panelH + 40, h = ly + 120;
    formKit.body(g, w, h, d.color || '#1b1b1c', { rx: 8 });
    const gold = '#c9a45a';
    svg('rect', { x: 8, y: 8, width: w - 16, height: panelH, rx: 4, fill: '#0d0d0e' }, g);
    svg('rect', { x: 10, y: 10, width: w - 20, height: panelH - 4, rx: 3, fill: 'none', stroke: gold, 'stroke-width': 1.1 }, g);
    rows.forEach((r, ri) => {
      const x0 = 30, x1 = w - 30, step = (x1 - x0) / Math.max(1, perRow - 1);
      r.forEach((c, i) => Object.assign(c, { _fa: 1, x: perRow === 1 ? w / 2 : x0 + i * step, y: 40 + ri * 44, r: 11, labelPos: 'above', labelSize: 5.4 }));
    });
    tg.forEach((t, i) => Object.assign(t, { _fa: 1, x: tg.length === 1 ? w / 2 : 36 + (i * (w - 72)) / (tg.length - 1), y: 12 + rows.length * 44 + 10, orient: 'h', optSize: 4.2 }));
    label(g, w / 2, ly - 4, d.logo || d.name, { size: (d.logo || d.name).length > 12 ? 13 : 16, fill: d.accent || gold, font: "'Oswald', sans-serif", weight: 700, ls: 1.2 });
    label(g, w / 2, ly + 9, (d.typeName || d.cat).toUpperCase(), { size: 5.2, fill: '#d8d8d8', weight: 700, ls: 1.8, opacity: 0.75 });
    d.controls.forEach((c) => {
      if (c.t === 'led' && mine(c)) Object.assign(c, { _fa: 1, x: w / 2, y: ly + 24, r: 3 });
      if (c.t === 'foot' && mine(c)) Object.assign(c, { _fa: 1, style: 'stomp', x: w / 2, y: ly + 56, r: 13 });
    });
    // script badge in a gold-edged plate near the bottom
    svg('rect', { x: w / 2 - 42, y: h - 34, width: 84, height: 20, rx: 3, fill: '#0d0d0e', stroke: gold, 'stroke-width': 0.8 }, g);
    label(g, w / 2, h - 20, 'Mayfair', { size: 13, fill: '#f2efe6', font: "'Dancing Script', cursive", weight: 700 });
    formKit.tzBadge(g, w / 2, h - 5, '#8a8a8a', 3.4);
    const theme = { text: '#f0e6cc', knob: d.knob || 'marshall', labelSize: 5.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: panelH + 30, gap: 26, flip: ctx.flip }) };
  });

  const MP = (o) => def(Object.assign({ form: 'marshall-pedal', color: '#1d1d1f' }, o, { controls: [...o.controls, FOOT(), LED({ color: '#ff2a1a' })] }));
  const t = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    MP({ id: 'marshall.shredmaster', name: 'Shredder Master', ref: 'Marshall ShredMaster', logo: 'SHREDDER', typeName: 'Distortion', cat: 'Distortion', accent: '#e04a3a',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 6, preHp: 80, gainMinDb: 10, gainMaxDb: 46, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 650, midQ: 0.7, trebleF: 3000, postLp: 7200, levelMaxDb: -3 },
      controls: [t('gain', 'GAIN', { def: 0.6 }), t('bass', 'BASS'), t('mid', 'CONTOUR', { def: 0.4 }), t('treble', 'TREBLE'), t('level', 'VOLUME')],
      desc: 'The early-90s British shred box: thick, scooped distortion with a Contour mid control.' }),
    MP({ id: 'marshall.bluesbreaker', name: 'Blues Buster', ref: 'Marshall BluesBreaker (pedal)', logo: 'BLUES BUSTER', typeName: 'Overdrive', cat: 'Overdrive', accent: '#5a8fd6',
      algo: 'drive', opts: { clip: 'si', bias: 0.05, preHp: 70, gainMinDb: 2, gainMaxDb: 30, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 9500, cleanSum: true, cleanMix: 0.15, levelMaxDb: 8 },
      controls: [t('gain', 'GAIN', { def: 0.45 }), t('tone', 'TONE'), t('level', 'VOLUME')],
      desc: 'Transparent, open low-gain overdrive in the spirit of a cranked combo.' }),
    MP({ id: 'marshall.guvnor', name: 'The Governor', ref: "Marshall Guv'nor", logo: 'GOVERNOR', typeName: 'Distortion', cat: 'Distortion', accent: '#d9b25a',
      algo: 'drive', opts: { clip: 'diode', preHp: 70, gainMinDb: 6, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 100, midF: 800, trebleF: 3000, postLp: 8000, levelMaxDb: 2, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 2 }] },
      controls: [t('gain', 'GAIN', { def: 0.55 }), t('bass', 'BASS'), t('mid', 'MIDDLE'), t('treble', 'TREBLE'), t('level', 'VOLUME')],
      desc: 'Amp-in-a-box British crunch with a full 3-band EQ.' }),
    MP({ id: 'marshall.drivemaster', name: 'Drive Major', ref: 'Marshall DriveMaster', logo: 'DRIVE MAJOR', typeName: 'Overdrive', cat: 'Overdrive', accent: '#6fbf5a',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 70, gainMinDb: 4, gainMaxDb: 38, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 8500, levelMaxDb: 4 },
      controls: [t('gain', 'GAIN', { def: 0.5 }), t('bass', 'BASS'), t('mid', 'MIDDLE'), t('treble', 'TREBLE'), t('level', 'LEVEL')],
      desc: 'Plexi-flavoured overdrive, from edge of breakup to fat rock crunch.' }),
    MP({ id: 'marshall.jackhammer', name: 'Pneumatic JH', ref: 'Marshall Jackhammer JH-1', logo: 'PNEUMATIC', typeName: 'Overdrive / Distortion', cat: 'Distortion', accent: '#e8892a',
      algo: 'drive', opts: { preHp: 80, tone: 'eq3', eqRangeDb: 12, bassF: 110, midMin: 300, midMax: 3000, trebleF: 3200, postLp: 7800, levelMaxDb: -4,
        modes: [{ clip: 'asym', bias: 0.2, gainMinDb: 4, gainMaxDb: 36 }, { clip: 'diode', stages: 2, stage2Db: 6, gainMinDb: 10, gainMaxDb: 46 }] },
      controls: [t('gain', 'GAIN', { def: 0.55 }), t('bass', 'BASS'), t('mid', 'CONTOUR'), t('midfreq', 'FREQ'), t('treble', 'TREBLE'), t('level', 'LEVEL'), TOG('mode', 'MODE', ['OD', 'DIST'], { def: 1 })],
      desc: 'Overdrive or distortion with a sweepable Contour mid control.' }),
    MP({ id: 'marshall.edward', name: 'Edwin the Comp', ref: 'Marshall ED-1 Edward The Compressor', logo: 'EDWIN', typeName: 'Compressor', cat: 'Dynamics', accent: '#c9c9c9',
      algo: 'comp', opts: { type: 'vca' },
      controls: [t('level', 'VOLUME', { def: 0.36 }), t('tone', 'EMPHASIS'), t('attack', 'ATTACK', { def: 0.3 }), t('release', 'RELEASE', { def: 0.4 }), t('sustain', 'COMP', { def: 0.5 })],
      desc: 'Studio-style compressor with an Emphasis control to keep the attack bright.' }),
  ]);
}
