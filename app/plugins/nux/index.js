// Built-in Tone Zone plugin: NUX.
// Core / Mini / Verdugo / Reissue style pedals, acoustic floor units, amp modelers and multi-effects inspired
// by NUX gear. Names, logos and artwork are Tone Zone originals; layouts follow the real units (see `ref`).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SCREEN, def, db, ms } = tz.helpers;
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const row = (list, x0, x1, y, o = {}) => list.map((c, i) => at(c, list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1), y, o));
  const dB = (lo, hi, d = 0) => ({ min: lo, max: hi, def: d, display: db });
  const ensure = (id, make) => {
    if (document.getElementById(id)) return;
    const holder = document.getElementById('p-grain')?.parentNode;
    if (holder) make(holder);
  };

  // ---------------------------------------------------------------- looper status inside a chain (sub-block "lp")
  const STN = ['EMPTY', 'REC', 'PLAY', 'DUB', 'STOP'], STC = ['#5a6a80', '#ff3b30', '#3ddc84', '#ffd21f', '#e8e8e8'];
  tz.addScreen('nux-loop', {
    build(s, g, w, h) {
      const { svg, label } = tz.gfx;
      svg('rect', { width: w, height: h, fill: '#071018' }, g);
      s.title = label(g, 6, 8, 'LOOP', { size: 6, fill: '#7fd3ff', anchor: 'start', weight: 800, ls: 1 });
      s.st = label(g, w - 6, 8, 'EMPTY', { size: 6, fill: '#bfe', anchor: 'end', weight: 800 });
      s.bar = svg('rect', { x: 6, y: h - 14, width: w - 12, height: 6, rx: 2, fill: '#ffffff18' }, g);
      s.fill = svg('rect', { x: 6, y: h - 14, width: 0, height: 6, rx: 2, fill: '#3ddc84' }, g);
      s.len = label(g, w / 2, h / 2 - 1, '0.0 s', { size: 8, fill: '#e8f6ff', weight: 700, font: "'Share Tech Mono', monospace" });
    },
    update(s, st, view, now) {
      const { setA, setText } = tz.gfx;
      const tr = st?.lp?.looper?.tracks?.[0];
      if (!tr) return;
      setA(s.fill, 'width', (tr.state === 1 ? (now % 1000) / 1000 : tr.pos || 0) * (s.bar.getAttribute('width') | 0));
      setA(s.fill, 'fill', STC[tr.state] || '#3ddc84');
      setText(s.st, STN[tr.state] || '');
      setText(s.len, (tr.len || 0).toFixed(1) + ' s');
    },
  });

  // ---------------------------------------------------------------- enclosures
  // core: anodised box with a darker header band; mini: narrow mini pedal; verdugo: dark textured box with a
  // script title and desert line art; reissue: two-tone vintage box with chrome divider and badge; floor: wide
  // floor unit with a metal top plate.
  tz.addForm('nux-box', (ctx, d) => {
    const { svg, label, formKit, noisePattern, shade } = tz.gfx;
    ensure('nux-tex', (defs) => noisePattern(defs, 'nux-tex', 30, 64, [255, 255, 255], 0, 0.12, 0));
    const g = ctx.g, st = d.style || 'core';
    const w = d.fw || (st === 'mini' ? 76 : 150), h = d.fh || (st === 'mini' ? 156 : 230);
    const txt = d.text || '#f2f2f2', acc = d.accent || '#e2231a';
    const rx = st === 'mini' ? 6 : st === 'floor' ? 10 : 7;
    formKit.body(g, w, h, d.color, { rx, brushed: st === 'core' || st === 'mini' });
    const logoY = d.logoY ?? (st === 'mini' ? 96 : 150);
    if (st === 'core' || st === 'mini') {
      const hb = st === 'mini' ? 12 : 16;
      svg('path', { d: `M${rx} 0 H${w - rx} Q${w} 0 ${w} ${rx} V${hb} H0 V${rx} Q0 0 ${rx} 0 Z`, fill: shade(d.color, -0.45) }, g);
      svg('rect', { x: 0, y: hb, width: w, height: 1.4, fill: acc }, g);
      if (d.header) label(g, w / 2, hb / 2 + 0.5, d.header, { size: st === 'mini' ? 4.6 : 5.6, fill: acc, weight: 800, ls: 2 });
      label(g, w / 2, logoY, d.logo, { size: d.logoSize || (st === 'mini' ? 10 : 15), fill: txt, weight: 800, ls: 1, font: "'Oswald', sans-serif" });
      label(g, w / 2, logoY + (st === 'mini' ? 10 : 13), d.tagline || '', { size: st === 'mini' ? 4.2 : 5.2, fill: acc, weight: 800, ls: 1.4 });
    } else if (st === 'verdugo') {
      svg('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'url(#nux-tex)' }, g);
      const cy = logoY - 30;
      // desert sun + mesas + rays
      svg('circle', { cx: w / 2, cy, r: 13, fill: 'none', stroke: acc, 'stroke-width': 1.2, opacity: 0.9 }, g);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        svg('line', { x1: w / 2 + Math.cos(a) * 16, y1: cy + Math.sin(a) * 16, x2: w / 2 + Math.cos(a) * 21, y2: cy + Math.sin(a) * 21, stroke: acc, 'stroke-width': 1, opacity: 0.8 }, g);
      }
      svg('path', { d: `M14 ${cy + 13} H${w / 2 - 34} l6 -8 h14 l5 8 H${w / 2 + 18} l7 -11 h12 l6 11 H${w - 14}`, fill: 'none', stroke: acc, 'stroke-width': 1.1, opacity: 0.9 }, g);
      label(g, w / 2, logoY, d.logo, { size: d.logoSize || 22, fill: txt, weight: 700, font: "'Dancing Script', cursive" });
      label(g, w / 2, logoY + 14, d.tagline || '', { size: 5.2, fill: acc, weight: 800, ls: 1.6 });
    } else if (st === 'reissue') {
      const split = d.split ?? 124;
      svg('path', { d: `M0 ${split} H${w} V${h - rx} Q${w} ${h} ${w - rx} ${h} H${rx} Q0 ${h} 0 ${h - rx} Z`, fill: d.lower || '#e9e1cc' }, g);
      svg('path', { d: `M0 ${split} H${w} V${h - rx} Q${w} ${h} ${w - rx} ${h} H${rx} Q0 ${h} 0 ${h - rx} Z`, fill: 'url(#g-shadeV)', opacity: 0.5 }, g);
      svg('rect', { x: 0, y: split - 2, width: w, height: 4, fill: 'url(#g-chrome)' }, g);
      svg('rect', { x: 18, y: split - 15, width: w - 36, height: 26, rx: 13, fill: shade(d.color, -0.5), stroke: 'url(#g-chrome)', 'stroke-width': 1.6 }, g);
      label(g, w / 2, split - 2, d.logo, { size: d.logoSize || 13, fill: txt, weight: 800, ls: 1, font: "'Oswald', sans-serif" });
      label(g, w / 2, split + 19, d.tagline || '', { size: 5, fill: d.lowerText || '#3a2a1a', weight: 800, ls: 1.6 });
    } else if (st === 'floor') {
      svg('rect', { x: 8, y: 8, width: w - 16, height: d.plateH ?? 132, rx: 6, fill: d.plate || '#2c2e33' }, g);
      svg('rect', { x: 8, y: 8, width: w - 16, height: d.plateH ?? 132, rx: 6, fill: 'url(#p-brushed)', opacity: 0.6 }, g);
      svg('rect', { x: 8, y: 8, width: w - 16, height: d.plateH ?? 132, rx: 6, fill: 'none', stroke: acc, 'stroke-opacity': 0.7 }, g);
      label(g, d.logoX ?? w - 20, d.logoY ?? 26, d.logo, { size: d.logoSize || 15, fill: txt, weight: 800, ls: 1.2, anchor: 'end', font: "'Oswald', sans-serif" });
      label(g, d.logoX ?? w - 20, (d.logoY ?? 26) + 11, d.tagline || '', { size: 5.2, fill: acc, weight: 800, ls: 1.4, anchor: 'end' });
    }
    for (const f of d.frames || []) {
      svg('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 4, fill: 'none', stroke: txt, 'stroke-opacity': 0.3, 'stroke-width': 0.8 }, g);
      if (f.label) label(g, f.x + f.w / 2, f.y + 6, f.label, { size: 5, fill: acc, weight: 800, ls: 1.4 });
    }
    formKit.tzBadge(g, w / 2, h - (st === 'mini' ? 6 : 8), st === 'reissue' ? d.lowerText || '#3a2a1a' : txt, st === 'mini' ? 3.4 : 4.2);
    const theme = { text: txt, knob: d.knob || 'boss', labelSize: d.labelSize || (st === 'mini' ? 5.2 : 6), labelLs: 0.4 };
    if (st === 'reissue') {
      const split = d.split ?? 124;
      formKit.placeControls(ctx, d.controls.filter((c) => c.y < split), theme);
      formKit.placeControls(ctx, d.controls.filter((c) => c.y >= split), Object.assign({}, theme, { text: d.lowerText || '#3a2a1a' }));
    } else formKit.placeControls(ctx, d.controls, theme);
    const jacks = d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: d.jy0 ?? (st === 'mini' ? 40 : 56), gap: d.jgap ?? (st === 'mini' ? 22 : 26) });
    return { w, h, theme, jacks };
  });

  const N = (o) => def(Object.assign({ form: 'nux-box', brand: 'NUX' }, o));
  const STD2 = (x = 75, yf = 196, yl = 170, color = '#ff2a1a') => [at(FOOT({ style: 'stomp', r: 12 }), x, yf), at(LED({ color, r: 2.8 }), x, yl)];

  // ---------------------------------------------------------------- drive voicings
  const V = {
    horseman: { clip: 'ge', cleanSum: true, cleanMix: 0.35, preHp: 60, gainMinDb: 2, gainMaxDb: 34, tone: 'tilt', trebleF: 1600, bassF: 200, eqRangeDb: 9, postLp: 9000, levelMaxDb: 10 },
    morning: { clip: 'si', preHp: 90, gainMinDb: 0, gainMaxDb: 30, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 9500, levelMaxDb: 8, modes: [{}, { clip: 'led', gainMaxDb: 26 }, { clip: 'asym', gainMaxDb: 36, bias: 0.2 }] },
    steel: { clip: 'tube', bias: 0.15, preHp: 50, gainMinDb: 2, gainMaxDb: 38, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 700, trebleF: 3000, postLp: 8500, levelMaxDb: 8, modes: [{}, { preEq: [{ type: 'ls', f: 120, q: 0.7, db: 5 }] }] },
    brownie: { outTrim: 0.24, clip: 'asym', bias: 0.2, stages: 2, stage2Db: 12, preHp: 100, gainMinDb: 10, gainMaxDb: 50, tone: 'lp', toneLo: 1400, toneHi: 9000, postLp: 8000, levelMaxDb: 6, modes: [{}, { preEq: [{ type: 'peak', f: 900, q: 0.8, db: 4 }] }, { stages: 3, gainMaxDb: 56 }] },
    fireman: { outTrim: 0.25, clip: 'asym', bias: 0.25, stages: 2, stage2Db: 14, preHp: 90, gainMinDb: 8, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 2800, postLp: 7800, levelMaxDb: 6 },
    lacerate: { outTrim: 0.22, clip: 'diode', stages: 2, stage2Db: 18, gainMinDb: 14, gainMaxDb: 58, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 650, trebleF: 3000, postLp: 7000, levelMaxDb: 6, modes: [{ preHp: 160 }, { preHp: 100 }, { preHp: 50 }] },
    plexi: { outTrim: 0.39, clip: 'tube', bias: 0.2, stages: 2, stage2Db: 10, preHp: 80, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1500, toneHi: 10000, postLp: 8500, levelMaxDb: 6 },
  };
  const ampModels = ['deluxe', 'ac30', 'plexi', 'jcm800', 'dumble', 'friedman', 'recto', '5150'];
  const ampNames = ['US DLX CLEAN', 'UK 30 CHIME', 'BRIT PLEXI', 'BRIT 800', 'ODS SMOOTH', 'BE CRUNCH', 'DUAL RECT', '5150 LEAD'];
  const cabModels = ['1x12us', '2x12blue', '4x12gb', '4x12t75', '2x12cream', '4x12gb', '4x12v30', '4x12v30'];

  // modulation engine shared by the Mod Core style pedal: one of 8 models on
  const MODS = ['CHORUS', 'PHASER', 'FLANGER', 'U-VIBE', 'TREMOLO', 'VIBRATO', 'ROTARY', 'PAN'];
  const modDerive = (p) => {
    const m = p.model ?? 0, r = p.rate ?? 0.4, dp = p.depth ?? 0.5, mx = p.mix ?? 0.5, tn = p.tone ?? 0.5;
    const o = { 'c.on': 0, 'p.on': 0, 'f.on': 0, 'v.on': 0, 't.on': 0, 'r.on': 0 };
    if (m === 0 || m === 5) Object.assign(o, { 'c.on': 1, 'c.mode': m === 5 ? 1 : 0, 'c.rate': r, 'c.depth': dp, 'c.mix': m === 5 ? 1 : mx, 'c.tone': tn });
    if (m === 1) Object.assign(o, { 'p.on': 1, 'p.rate': r, 'p.depth': dp, 'p.mix': 0.3 + 0.4 * mx, 'p.feedback': 0.2 + 0.6 * tn });
    if (m === 2) Object.assign(o, { 'f.on': 1, 'f.speed': r, 'f.width': dp, 'f.mix': 0.3 + 0.4 * mx, 'f.regen': 0.2 + 0.7 * tn });
    if (m === 3) Object.assign(o, { 'v.on': 1, 'v.speed': r, 'v.intensity': dp, 'v.tone': tn, 'v.mode': mx > 0.75 ? 1 : 0 });
    if (m === 4 || m === 7) Object.assign(o, { 't.on': 1, 't.rate': r, 't.depth': dp, 't.wave': tn, 't.stereo': m === 7 ? 1 : 0 });
    if (m === 6) Object.assign(o, { 'r.on': 1, 'r.speed': r, 'r.balance': dp, 'r.drive': tn * 0.6, 'r.mix': 0.5 + 0.5 * mx });
    return o;
  };
  const delayModes = (v) => [1, 2, 0][v ?? 0];

  const withDefaults = (list) => list.map((d) => {
    // footswitch / button params default to their initParams value (fresh blocks and presets without the param)
    for (const c of d.controls) if (c.p && d.initParams && d.initParams[c.p] !== undefined && c.def === undefined) c.def = d.initParams[c.p];
    return d;
  });
  tz.addDefs(withDefaults([
    // ================================================================ acoustic
    N({
      id: 'nux.stageman', name: 'Stage Hand Floor', ref: 'NUX Stageman Floor', style: 'floor', cat: 'Acoustic', kind: 'Multi-FX', logo: 'STAGE HAND', tagline: 'ACOUSTIC FLOOR · LOOPER', typeName: 'Acoustic multi-FX with looper',
      color: '#17181b', accent: '#d4a64a', fw: 440, fh: 246, plateH: 140, knob: 'chrome', stereo: 'stereo', cost: 3.2, alwaysOn: true,
      ports: { ins: ['INPUT'], outs: ['OUT L (MONO)', 'OUT R', 'XLR DI OUT'] }, jackKinds: { o2: 'xlr' }, jacksTop: true,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'acoustic', opts: { mode: 1 }, params: { mode: 1, body: 0.6 } },
        { prefix: 'ch', algo: 'chorus', on: false, params: { mix: 0.4, rate: 0.3, depth: 0.45, tone: 0.65 } },
        { prefix: 'dl', algo: 'delay', on: false, opts: { maxMs: 1200 }, params: { mode: 0, mix: 0.25, time: 380, feedback: 0.3, tone: 0.55 } },
        { prefix: 'rv', algo: 'reverb', params: { mode: 1, mix: 0.22, decay: 0.45, size: 0.5 } },
        { prefix: 'lp', algo: 'looper', opts: { tracks: 1, maxSec: 60 } },
      ] },
      frames: [{ x: 160, y: 28, w: 140, h: 48, label: 'PREAMP' }],
      controls: [
        at(SCREEN('nux-loop', { w: 110, h: 40 }), 78, 50),
        at(SEL('a.mode', 'MODE', ['SIM', 'PIEZO', 'PRE'], { sweep: 120 }), 196, 56, { r: 10, labelPos: 'below' }),
        at(SEL('a.type', 'BODY', ['DRD', 'JMB', 'PRL', 'NYL', '12S'], { sweep: 160, optSize: 4.2 }), 262, 56, { r: 10, labelPos: 'below' }),
        at(BTN('PHASE', { p: 'a.phase', toggle: true, led: true, ledColor: '#d4a64a', ledDy: -9 }), 330, 60),
        ...row([
          K('a.level', 'VOLUME', dB(-24, 6, 0)), K('a.bass', 'BASS'), K('a.mid', 'MID'), K('a.treble', 'TREBLE'), K('a.body', 'BODY', { def: 0.6 }), K('a.notch', 'NOTCH', { def: 0 }),
          K('ch.mix', 'CHORUS', { def: 0.4 }), K('dl.mix', 'DELAY', { def: 0.25 }), K('dl.time', 'TIME', { min: 60, max: 1200, def: 380, display: ms }), K('rv.mix', 'REVERB', { def: 0.22 }), K('lp.level1', 'LOOP', { def: 0.8 }),
        ], 34, 406, 114, { r: 10 }),
        at(FOOT({ action: 'param', p: 'a.on', label: 'ACOUSTIC', style: 'stomp', r: 12 }), 58, 206),
        at(FOOT({ action: 'param', p: 'ch.on', label: 'CHORUS', style: 'stomp', r: 12 }), 136, 206),
        at(FOOT({ action: 'param', p: 'dl.on', label: 'DELAY', style: 'stomp', r: 12 }), 214, 206),
        at(FOOT({ action: 'param', p: 'rv.on', label: 'REVERB', style: 'stomp', r: 12 }), 292, 206),
        at(FOOT({ action: 'event', event: { type: 1, arg: 400 }, hold: { ms: 900, event: { type: 2, arg: 400 } }, doubleHold: { event: { type: 3, arg: 400 } }, label: 'LOOP', style: 'stomp', r: 12 }), 380, 206),
        at(LED({ bind: 'param:a.on', color: '#d4a64a', r: 2.8 }), 58, 180), at(LED({ bind: 'param:ch.on', color: '#4aa8ff', r: 2.8 }), 136, 180),
        at(LED({ bind: 'param:dl.on', color: '#3ddc84', r: 2.8 }), 214, 180), at(LED({ bind: 'param:rv.on', color: '#b98cff', r: 2.8 }), 292, 180),
      ],
      initParams: { 'a.on': 1, 'ch.on': 0, 'dl.on': 0, 'rv.on': 1 },
      desc: 'Acoustic floor processor: acoustic SIM (electric → acoustic), PIEZO enhancer or plain PREamp with body types, EQ, notch; chorus, delay, reverb and a 60 s looper (LOOP: press = rec / play / overdub, hold = stop, hold again = clear).',
    }),
    N({
      id: 'nux.optimaair', name: 'Optima Breeze', ref: 'NUX Optima Air', style: 'core', cat: 'Acoustic', logo: 'OPTIMA', logoSize: 14, header: 'BREEZE', tagline: 'ACOUSTIC IR · PREAMP', typeName: 'Acoustic simulator / IR',
      color: '#d9d4c7', text: '#222', accent: '#b07b2a', fw: 130, fh: 222, knob: 'boss', cost: 0.9,
      algo: 'acoustic', opts: { mode: 0 },
      controls: [
        at(K('level', 'VOLUME', dB(-24, 6, 0)), 34, 44, { r: 11 }), at(K('mix', 'BLEND', { def: 0.85 }), 96, 44, { r: 11 }),
        at(K('top', 'TONE', { def: 0.5 }), 34, 92, { r: 11 }),
        at(SEL('type', 'BODY', ['DRD', 'JMB', 'PRL', 'NYL', '12S'], { sweep: 160, optSize: 4.2 }), 96, 100, { r: 10, labelPos: 'below' }),
        at(TOG('mode', '', ['SIM', 'PIEZO'], { values: [0, 1] }), 65, 62, { orient: 'h' }),
        ...STD2(65, 192, 170, '#ffb347'),
      ],
      logoY: 142,
      desc: 'Turns an electric (SIM) or piezo-equipped acoustic (PIEZO) into a miked acoustic: five body models, BLEND with the dry signal, TONE adjusts the air / top.',
    }),
    // ================================================================ modulation / delay
    N({
      id: 'nux.minischorus', name: 'Mini Swirl CF', ref: 'NUX Mini Core Series SCF Chorus', style: 'mini', cat: 'Modulation', logo: 'SWIRL CF', header: 'MINI', tagline: 'CHORUS · FLANGER · PM', typeName: 'Chorus / flanger',
      color: '#2a8c9a', accent: '#bff3ff', stereo: 'both', cost: 0.6, knob: 'boss', labelSize: 5,
      algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'chorus', params: { tone: 0.6, level: 0.45 } }, { prefix: 'f', algo: 'flanger', on: false }] },
      controls: [
        at(K('rate', 'SPEED', { def: 0.35, virtual: true }), 20, 34, { r: 8 }), at(K('depth', 'WIDTH', { def: 0.5, virtual: true }), 56, 34, { r: 8 }),
        at(K('inten', 'INTENSITY', { def: 0.5, virtual: true }), 24, 68, { r: 8 }),
        at(TOG('mode', '', ['C', 'F', 'PM']), 56, 68, { orient: 'v', optSize: 4.6 }),
        at(FOOT({ style: 'stomp', r: 10 }), 38, 130), at(LED({ color: '#3ddc84', r: 2.4 }), 38, 112),
      ],
      derive: (p) => {
        const m = p.mode ?? 0, r = p.rate ?? 0.35, dp = p.depth ?? 0.5, it = p.inten ?? 0.5;
        if (m === 1) return { 'c.on': 0, 'f.on': 1, 'f.speed': r, 'f.width': dp, 'f.regen': 0.2 + 0.7 * it, 'f.mix': 0.5 };
        return { 'c.on': 1, 'f.on': 0, 'c.mode': m === 2 ? 1 : 0, 'c.rate': r, 'c.depth': dp, 'c.mix': m === 2 ? 0.5 : 0.25 + 0.5 * it };
      },
      desc: 'Mini chorus / flanger / pitch-modulation (P.M. = chorus blended with vibrato). INTENSITY = mix (chorus) or regeneration (flanger).',
    }),
    N({
      id: 'nux.modcore', name: 'Mod Hub Deluxe II', ref: 'NUX Mod Core Deluxe MKII', style: 'core', cat: 'Modulation', logo: 'MOD HUB DLX', logoSize: 14, header: 'MULTI MOD · MKII', tagline: 'MULTI MODULATION', typeName: '8-model modulation',
      color: '#3b4b9a', accent: '#9fd0ff', fw: 176, fh: 232, knob: 'boss', stereo: 'both', cost: 1.0, logoY: 150,
      algo: 'chain', opts: { chain: [
        { prefix: 'c', algo: 'chorus', on: false }, { prefix: 'p', algo: 'phaser', on: false, opts: { stages: 6 } }, { prefix: 'f', algo: 'flanger', on: false },
        { prefix: 'v', algo: 'vibe', on: false }, { prefix: 't', algo: 'tremolo', on: false }, { prefix: 'r', algo: 'rotary', on: false },
      ] },
      controls: [
        at(SCREEN('modelName', { names: MODS }), 88, 32, { w: 96, h: 14 }),
        at(SEL('model', 'TYPE', MODS.map((m) => m.slice(0, 3)), { sweep: 270, optSize: 4, labelRadius: 8 }), 88, 82, { r: 13, labelPos: 'none' }),
        at(K('rate', 'RATE', { def: 0.4, virtual: true }), 28, 64, { r: 10 }), at(K('depth', 'DEPTH', { def: 0.5, virtual: true }), 148, 64, { r: 10 }),
        at(K('mix', 'MIX', { def: 0.5, virtual: true }), 28, 112, { r: 10 }), at(K('tone', 'TONE', { def: 0.5, virtual: true }), 148, 112, { r: 10 }),
        ...STD2(88, 198, 176, '#4aa8ff'),
      ],
      derive: modDerive,
      desc: 'Eight modulation models (chorus, phaser, flanger, U-vibe, tremolo, vibrato, rotary, auto-pan) with RATE / DEPTH / MIX / TONE; TONE is the colour / feedback / waveform control of the selected model.',
    }),
    N({
      id: 'nux.atlantic', name: 'Pacific Echo & Verb', ref: 'NUX Atlantic Delay & Reverb', style: 'verdugo', cat: 'Delay', logo: 'Pacific', tagline: 'DELAY & REVERB', typeName: 'Delay + reverb',
      color: '#1d3f5e', accent: '#6fc3e8', fw: 190, fh: 236, knob: 'chrome', stereo: 'both', cost: 1.6, alwaysOn: true, logoY: 156,
      algo: 'chain', opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 1500 }, params: { mode: 1, tone: 0.55 } }, { prefix: 'r', algo: 'reverb', params: { mode: 3, size: 0.5 } }] },
      frames: [{ x: 8, y: 14, w: 84, h: 98, label: 'DELAY' }, { x: 98, y: 14, w: 84, h: 98, label: 'REVERB' }],
      controls: [
        at(K('d.time', 'TIME', { min: 40, max: 1500, def: 400, display: ms }), 30, 42, { r: 10 }), at(K('d.feedback', 'REPEAT', { def: 0.35 }), 70, 42, { r: 10 }),
        at(K('d.mix', 'LEVEL', { def: 0.3 }), 30, 88, { r: 10 }), at(TOG('dmode', '', ['ANA', 'TAPE', 'DIG']), 70, 86, { orient: 'v', optSize: 4.6 }),
        at(K('r.decay', 'DECAY', { def: 0.5 }), 120, 42, { r: 10 }), at(K('r.tone', 'TONE', { def: 0.55 }), 160, 42, { r: 10 }),
        at(K('r.mix', 'LEVEL', { def: 0.25 }), 120, 88, { r: 10 }), at(TOG('rmode', '', ['SPR', 'PLT', 'SHM']), 160, 86, { orient: 'v', optSize: 4.6 }),
        at(FOOT({ action: 'param', p: 'd.on', label: 'DELAY', style: 'stomp', r: 12 }), 48, 196), at(FOOT({ action: 'param', p: 'r.on', label: 'REVERB', style: 'stomp', r: 12 }), 142, 196),
        at(LED({ bind: 'param:d.on', color: '#6fc3e8', r: 2.8 }), 48, 172), at(LED({ bind: 'param:r.on', color: '#6fc3e8', r: 2.8 }), 142, 172),
      ],
      initParams: { 'd.on': 1, 'r.on': 1 },
      derive: (p) => ({ 'd.mode': delayModes(p.dmode), 'r.mode': [3, 2, 4][p.rmode ?? 0], 'r.shimmer': 0.5 }),
      desc: 'Dual pedal: analog / tape / digital delay into spring / plate / shimmer reverb, each with its own footswitch.',
    }),
    N({
      id: 'nux.tapecore', name: 'Tape Hub Deluxe', ref: 'NUX Tape Core Deluxe', style: 'core', cat: 'Delay', logo: 'TAPE HUB DLX', logoSize: 14, header: 'DELUXE TAPE ECHO', tagline: 'TAPE ECHO', typeName: 'Multi-head tape echo',
      color: '#6b4a2b', accent: '#f0c27a', fw: 176, fh: 232, knob: 'chicken', stereo: 'both', cost: 1.0, logoY: 150,
      algo: 'chain', opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 1200, fixedMode: 2 }, params: { mode: 2, tone: 0.5, modrate: 0.3, moddepth: 0.15 } }] },
      controls: [
        at(K('d.time', 'TIME', { min: 60, max: 1200, def: 380, display: ms }), 30, 46, { r: 11 }),
        at(K('d.feedback', 'REPEAT', { def: 0.4 }), 88, 46, { r: 11 }),
        at(K('d.mix', 'MIX', { def: 0.35 }), 146, 46, { r: 11 }),
        at(K('d.age', 'AGE', { def: 0.35 }), 30, 100, { r: 10 }),
        at(SEL('d.heads', 'HEADS', ['1', '2', '3', '1+2', '1+3', '2+3', 'ALL'], { values: [1, 2, 4, 3, 5, 6, 7], def: 2, sweep: 210, optSize: 4.2 }), 88, 104, { r: 11, labelPos: 'below' }),
        at(K('d.moddepth', 'WOW', { def: 0.15 }), 146, 100, { r: 10 }),
        at(FOOT({ style: 'stomp', label: 'ON', r: 12 }), 50, 198), at(FOOT({ action: 'tap', tapTarget: 'd.time', label: 'TAP', style: 'stomp', r: 12 }), 126, 198),
        at(LED({ color: '#ff2a1a', r: 2.8 }), 50, 176), at(LED({ bind: 'tap:d.time', color: '#f0c27a', r: 2.8 }), 126, 176),
      ],
      desc: 'Space-echo style tape delay: head combinations, tape AGE, wow, tap tempo.',
    }),
    N({
      id: 'nux.duotime', name: 'Twin Time Delay', ref: 'NUX Duotime', style: 'verdugo', cat: 'Delay', logo: 'Twin Time', tagline: 'DUAL DELAY', typeName: 'Dual delay',
      color: '#2b2b30', accent: '#e6a04a', fw: 190, fh: 236, knob: 'chrome', stereo: 'both', cost: 1.4, alwaysOn: true, logoY: 156,
      algo: 'chain', opts: { chain: [{ prefix: 'a', algo: 'delay', opts: { maxMs: 1500 }, params: { mode: 1, tone: 0.5 } }, { prefix: 'b', algo: 'delay', opts: { maxMs: 1500 }, params: { mode: 0, tone: 0.6 } }] },
      frames: [{ x: 8, y: 14, w: 84, h: 98, label: 'DELAY A' }, { x: 98, y: 14, w: 84, h: 98, label: 'DELAY B' }],
      controls: [
        at(K('a.time', 'TIME', { min: 40, max: 1500, def: 300, display: ms }), 30, 42, { r: 10 }), at(K('a.feedback', 'REPEAT', { def: 0.3 }), 70, 42, { r: 10 }),
        at(K('a.mix', 'LEVEL', { def: 0.25 }), 30, 88, { r: 10 }), at(TOG('amode', '', ['ANA', 'TAPE', 'DIG']), 70, 86, { orient: 'v', optSize: 4.6 }),
        at(K('b.time', 'TIME', { min: 40, max: 1500, def: 600, display: ms }), 120, 42, { r: 10 }), at(K('b.feedback', 'REPEAT', { def: 0.3 }), 160, 42, { r: 10 }),
        at(K('b.mix', 'LEVEL', { def: 0.25 }), 120, 88, { r: 10 }), at(TOG('bmode', '', ['ANA', 'TAPE', 'DIG']), 160, 86, { orient: 'v', optSize: 4.6, def: 2 }),
        at(FOOT({ action: 'param', p: 'a.on', label: 'A', style: 'stomp', r: 12 }), 48, 196), at(FOOT({ action: 'param', p: 'b.on', label: 'B', style: 'stomp', r: 12 }), 142, 196),
        at(LED({ bind: 'param:a.on', color: '#e6a04a', r: 2.8 }), 48, 172), at(LED({ bind: 'param:b.on', color: '#e6a04a', r: 2.8 }), 142, 172),
      ],
      initParams: { 'a.on': 1, 'b.on': 0 },
      derive: (p) => ({ 'a.mode': delayModes(p.amode), 'b.mode': delayModes(p.bmode ?? 2) }),
      desc: 'Two delays in series, each analog / tape / digital with its own footswitch (stack them for rhythmic multi-taps).',
    }),
    // ================================================================ drives (Verdugo / Reissue)
    N({
      id: 'nux.queenoftone', name: 'Royal Tone Dual OD', ref: 'NUX Queen of Tone', style: 'verdugo', cat: 'Overdrive', logo: 'Royal Tone', tagline: 'DUAL OVERDRIVE', typeName: 'Dual overdrive',
      color: '#5a1f3a', accent: '#f0c0d8', fw: 190, fh: 236, knob: 'chrome', cost: 1.0, alwaysOn: true, logoY: 156,
      algo: 'chain', opts: { chain: [{ prefix: 'h', algo: 'drive', opts: V.horseman, on: false }, { prefix: 'm', algo: 'drive', opts: V.morning }] },
      frames: [{ x: 8, y: 14, w: 84, h: 98, label: 'RIDER' }, { x: 98, y: 14, w: 84, h: 98, label: 'DAWN STAR' }],
      controls: [
        at(K('h.level', 'OUTPUT', { def: 0.5 }), 30, 42, { r: 10 }), at(K('h.gain', 'GAIN', { def: 0.35 }), 70, 42, { r: 10 }),
        at(K('h.tone', 'TREBLE', { def: 0.5 }), 50, 88, { r: 10 }),
        at(K('m.level', 'VOLUME', { def: 0.5 }), 120, 42, { r: 10 }), at(K('m.gain', 'GAIN', { def: 0.4 }), 160, 42, { r: 10 }),
        at(K('m.tone', 'TONE', { def: 0.5 }), 120, 88, { r: 10 }), at(TOG('m.mode', '', ['SI', 'LED', 'OD']), 160, 86, { orient: 'v', optSize: 4.6 }),
        at(FOOT({ action: 'param', p: 'h.on', label: 'RIDER', style: 'stomp', r: 12 }), 48, 196), at(FOOT({ action: 'param', p: 'm.on', label: 'DAWN STAR', style: 'stomp', r: 12 }), 142, 196),
        at(LED({ bind: 'param:h.on', color: '#ff2a1a', r: 2.8 }), 48, 172), at(LED({ bind: 'param:m.on', color: '#ff2a1a', r: 2.8 }), 142, 172),
      ],
      initParams: { 'h.on': 0, 'm.on': 1 },
      desc: 'Klon-style transparent drive into a Bluesbreaker-style overdrive (three clipping modes), each switchable.',
    }),
    N({
      id: 'nux.morningstar', name: 'Dawn Star OD', ref: 'NUX Morning Star', style: 'verdugo', cat: 'Overdrive', logo: 'Dawn Star', tagline: 'BLUES OVERDRIVE', typeName: 'Bluesbreaker-style overdrive',
      color: '#2f4f7a', accent: '#ffd27a', fw: 130, fh: 224, knob: 'chrome', logoY: 150,
      algo: 'drive', opts: V.morning,
      controls: [
        ...row([K('level', 'VOLUME'), K('tone', 'TONE'), K('gain', 'GAIN', { def: 0.4 })], 26, 104, 42, { r: 11 }),
        at(TOG('mode', 'MODE', ['SI', 'LED', 'OD']), 65, 84, { orient: 'h' }),
        ...STD2(65, 192, 172),
      ],
    }),
    N({
      id: 'nux.horseman', name: 'Rider OD', ref: 'NUX Horseman', style: 'verdugo', cat: 'Overdrive', logo: 'Rider', tagline: 'TRANSPARENT DRIVE', typeName: 'Klon-style overdrive',
      color: '#8a6a2a', accent: '#f4e2b0', fw: 130, fh: 224, knob: 'chrome', logoY: 150,
      algo: 'drive', opts: V.horseman,
      controls: [...row([K('gain', 'GAIN', { def: 0.35 }), K('tone', 'TREBLE'), K('level', 'OUTPUT')], 26, 104, 46, { r: 11 }), ...STD2(65, 192, 172)],
    }),
    N({
      id: 'nux.steelsinger', name: 'Steel Crooner Drive', ref: 'NUX Steel Singer Drive', style: 'verdugo', cat: 'Overdrive', logo: 'Steel Crooner', logoSize: 19, tagline: 'SSS-STYLE DRIVE', typeName: 'Dumble-style overdrive',
      color: '#3a3d42', accent: '#9fd8c8', fw: 150, fh: 230, knob: 'chrome', logoY: 156,
      algo: 'drive', opts: V.steel,
      controls: [
        ...row([K('level', 'VOLUME'), K('gain', 'GAIN', { def: 0.4 })], 40, 110, 40, { r: 11 }),
        ...row([K('treble', 'TREBLE'), K('mid', 'MIDDLE'), K('bass', 'BASS')], 30, 120, 86, { r: 10 }),
        at(TOG('mode', 'DEEP', ['OFF', 'ON']), 75, 40, { orient: 'h' }),
        ...STD2(75, 198, 178),
      ],
    }),
    N({
      id: 'nux.brownie', name: 'Brown Bear Dist', ref: 'NUX Brownie', style: 'reissue', cat: 'Distortion', logo: 'BROWN BEAR', tagline: 'BRIT DISTORTION', typeName: 'Brown-sound distortion',
      color: '#5a3a24', lower: '#e9dcc2', fw: 130, fh: 224, knob: 'chicken', split: 120,
      algo: 'drive', opts: V.brownie,
      controls: [...row([K('level', 'VOLUME'), K('tone', 'TONE'), K('gain', 'GAIN')], 26, 104, 42, { r: 11 }), at(TOG('mode', 'MODE', ['I', 'II', 'III']), 65, 86, { orient: 'h' }), ...STD2(65, 190, 160)],
    }),
    N({
      id: 'nux.fireman', name: 'Fire Chief Dist', ref: 'NUX Fireman', style: 'reissue', cat: 'Distortion', logo: 'FIRE CHIEF', tagline: 'BROWN SOUND · BOOST', typeName: 'High-gain distortion with boost',
      color: '#a3241c', lower: '#efe4cc', fw: 160, fh: 250, knob: 'chicken', split: 142,
      algo: 'drive', opts: V.fireman,
      controls: [
        ...row([K('level', 'VOLUME'), K('gain', 'GAIN', { virtual: true })], 40, 120, 40, { r: 11 }),
        ...row([K('bass', 'BASS'), K('mid', 'MIDDLE'), K('treble', 'TREBLE')], 32, 128, 88, { r: 10 }),
        at(FOOT({ style: 'stomp', label: 'ON', r: 12 }), 46, 214), at(FOOT({ action: 'param', p: 'boost', label: 'BOOST', style: 'stomp', r: 12 }), 114, 214),
        at(LED({ color: '#ff2a1a', r: 2.8 }), 46, 184), at(LED({ bind: 'param:boost', color: '#ffb000', r: 2.8 }), 114, 184),
      ],
      initParams: { boost: 0 },
      derive: (p) => ({ gain: Math.min(1, (p.gain ?? 0.5) + (p.boost ? 0.25 : 0)) }),
      desc: 'Hot-rodded brown-sound distortion with a footswitchable gain BOOST.',
    }),
    N({
      id: 'nux.lacerate', name: 'Lacerator', ref: 'NUX Lacerate', style: 'reissue', cat: 'Distortion', logo: 'LACERATOR', tagline: 'METAL DISTORTION', typeName: 'Rectifier-style metal distortion',
      color: '#202225', lower: '#c9ccd0', lowerText: '#151515', text: '#e9e9e9', fw: 160, fh: 250, knob: 'chicken', split: 142,
      algo: 'drive', opts: V.lacerate,
      controls: [
        ...row([K('level', 'VOLUME'), K('gain', 'GAIN')], 40, 120, 40, { r: 11 }), at(TOG('mode', 'TIGHT', ['T', 'N', 'L'], { def: 1 }), 80, 40, { orient: 'h' }),
        ...row([K('bass', 'BASS'), K('mid', 'MIDDLE'), K('treble', 'TREBLE')], 32, 128, 88, { r: 10 }),
        ...STD2(80, 214, 184),
      ],
    }),
    N({
      id: 'nux.plexicrunch', name: 'Plexy Crunch', ref: 'NUX Plexi Crunch', style: 'reissue', cat: 'Distortion', logo: 'PLEXY', tagline: 'BRIT CRUNCH', typeName: 'Plexi-style crunch',
      color: '#c9a64e', text: '#1a1a1a', lower: '#1d1d1d', lowerText: '#e9e2cc', fw: 130, fh: 224, knob: 'marshall', split: 120,
      algo: 'drive', opts: V.plexi,
      controls: [...row([K('level', 'VOLUME'), K('tone', 'TONE'), K('gain', 'GAIN')], 26, 104, 42, { r: 11 }), at(TOG('bright', 'BRIGHT', ['OFF', 'ON'], { values: [0, 0.8] }), 65, 86, { orient: 'h' }), ...STD2(65, 190, 160)],
    }),
    N({
      id: 'nux.sculpture', name: 'Mini Sculptor Comp', ref: 'NUX Sculpture', style: 'mini', cat: 'Dynamics', logo: 'SCULPTOR', header: 'MINI', tagline: 'COMPRESSOR', typeName: 'Compressor',
      color: '#c8c3b6', text: '#1b1b1b', accent: '#7a3a9a', cost: 0.3, knob: 'boss', labelSize: 5,
      algo: 'comp', opts: { type: 'vca' },
      controls: [
        at(K('level', 'LEVEL', { def: 0.4 }), 20, 34, { r: 8 }), at(K('sustain', 'SUSTAIN', { def: 0.5 }), 56, 34, { r: 8 }),
        at(K('blend', 'BLEND', { def: 0.8 }), 24, 68, { r: 8 }), at(TOG('attack', '', ['FAST', 'SLOW'], { values: [0.12, 0.6] }), 56, 68, { orient: 'v', optSize: 4.4 }),
        at(FOOT({ style: 'stomp', r: 10 }), 38, 130), at(LED({ color: '#3ddc84', r: 2.4 }), 38, 112),
      ],
      desc: 'Mini VCA compressor with parallel BLEND and fast / slow attack.',
    }),
    // ================================================================ amp modelers / multi-FX
    N({
      id: 'nux.ampacademy', name: 'Amp School', ref: 'NUX Amp Academy', style: 'floor', cat: 'Preamp', kind: 'Multi-FX', logo: 'AMP SCHOOL', tagline: 'AMP MODELER · IR', typeName: 'Amp modeler stomp',
      color: '#1a1b1e', accent: '#ff5a3a', plate: '#26282d', fw: 236, fh: 236, plateH: 128, knob: 'boss', cost: 3.4, logoY: 24, jacksTop: true,
      algo: 'chain', opts: { chain: [{ prefix: 'a', algo: 'amp', opts: { models: ampModels } }, { prefix: 'c', algo: 'cab', opts: { models: cabModels } }] },
      controls: [
        at(SCREEN('modelName', { names: ampNames }), 76, 56, { w: 110, h: 16 }),
        at(SEL('model', 'AMP', ampModels.map((_, i) => String(i + 1)), { sweep: 240, def: 3, optSize: 4.6 }), 186, 66, { r: 11, labelPos: 'below' }),
        ...row([K('a.gain', 'GAIN'), K('a.bass', 'BASS'), K('a.mid', 'MID'), K('a.treble', 'TREBLE'), K('a.master', 'MASTER'), K('a.level', 'LEVEL', dB(-30, 12, -5))], 30, 206, 108, { r: 10 }),
        at(FOOT({ style: 'stomp', label: 'ON', r: 12 }), 60, 196), at(FOOT({ action: 'param', p: 'c.on', label: 'IR / CAB', style: 'stomp', r: 12 }), 176, 196),
        at(LED({ color: '#ff3020', r: 2.8 }), 60, 168), at(LED({ bind: 'param:c.on', color: '#3ddc84', r: 2.8 }), 176, 168),
      ],
      initParams: { 'c.on': 1 },
      derive: (p) => ({ 'a.channel': p.model ?? 3, 'c.model': p.model ?? 3 }),
      desc: 'Eight amp models with matched cabinet IRs (IR / CAB footswitch turns the cab off for use into a real amp).',
    }),
    N({
      id: 'nux.mg30', name: 'MG-3X Multi', ref: 'NUX MG-30', style: 'floor', cat: 'Multi-FX', logo: 'MG-3X', tagline: 'VERSATILE MODELER', typeName: 'Amp modeler multi-FX',
      color: '#121315', accent: '#37a3ff', fw: 440, fh: 246, plateH: 140, knob: 'boss', stereo: 'stereo', cost: 5.5, logoX: 420, fixed: { 'a.level': -5 },
      ports: { ins: ['INPUT'], outs: ['OUT L (MONO)', 'OUT R'] }, jacksTop: true,
      algo: 'chain', opts: { chain: [
        { prefix: 'g', algo: 'gate', params: { threshold: 0.25 } },
        { prefix: 'd', algo: 'drive', on: false, opts: { clip: 'asym', cleanSum: true, cleanMix: 0.2, gainMaxDb: 36, tone: 'tilt', levelMaxDb: 6 } },
        { prefix: 'a', algo: 'amp', opts: { models: ampModels } }, { prefix: 'c', algo: 'cab', opts: { models: cabModels } },
        { prefix: 'm', algo: 'chorus', on: false, params: { mix: 0.4 } },
        { prefix: 'dl', algo: 'delay', on: false, opts: { maxMs: 2000 }, params: { mode: 1, mix: 0.25 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 2, mix: 0.2 } },
      ] },
      controls: [
        at(SCREEN('modelName', { names: ampNames }), 110, 44, { w: 170, h: 26 }),
        at(SEL('model', 'AMP', ampModels.map((_, i) => String(i + 1)), { sweep: 240, def: 3, optSize: 4.6 }), 240, 52, { r: 12, labelPos: 'below' }),
        ...row([K('a.gain', 'GAIN'), K('a.bass', 'BASS'), K('a.mid', 'MID'), K('a.treble', 'TREBLE'), K('a.master', 'MASTER'), K('d.gain', 'DRIVE', { def: 0.4 }), K('m.mix', 'MOD', { def: 0.4 }), K('dl.mix', 'DELAY', { def: 0.25 }), K('dl.time', 'TIME', { min: 60, max: 2000, def: 420, display: ms }), K('r.mix', 'REVERB', { def: 0.2 })], 36, 404, 112, { r: 10 }),
        at(FOOT({ action: 'param', p: 'd.on', label: 'DRIVE', style: 'stomp', r: 12 }), 58, 206), at(FOOT({ action: 'param', p: 'm.on', label: 'MOD', style: 'stomp', r: 12 }), 136, 206),
        at(FOOT({ action: 'param', p: 'dl.on', label: 'DELAY', style: 'stomp', r: 12 }), 214, 206), at(FOOT({ action: 'param', p: 'r.on', label: 'REVERB', style: 'stomp', r: 12 }), 292, 206),
        at(FOOT({ action: 'tap', tapTarget: 'dl.time', label: 'TAP', style: 'stomp', r: 12 }), 380, 206),
        at(LED({ bind: 'param:d.on', color: '#ff3020', r: 2.8 }), 58, 180), at(LED({ bind: 'param:m.on', color: '#37a3ff', r: 2.8 }), 136, 180),
        at(LED({ bind: 'param:dl.on', color: '#3ddc84', r: 2.8 }), 214, 180), at(LED({ bind: 'param:r.on', color: '#b98cff', r: 2.8 }), 292, 180), at(LED({ bind: 'tap:dl.time', color: '#ffffff', r: 2.8 }), 380, 180),
      ],
      initParams: { 'd.on': 0, 'm.on': 0, 'dl.on': 0, 'r.on': 1 },
      derive: (p) => ({ 'a.channel': p.model ?? 3, 'c.model': p.model ?? 3 }),
      desc: 'Floor modeler: gate, drive, 8 amps with matched cabs, chorus, delay (tap) and reverb.',
    }),
    N({
      id: 'nux.cerberus', name: 'Tri-Head Multi', ref: 'NUX Cerberus', style: 'floor', cat: 'Multi-FX', logo: 'TRI-HEAD', tagline: 'ANALOG DRIVES · MULTI FX', typeName: 'Analog drive multi-FX',
      color: '#1d1d20', accent: '#e2231a', fw: 420, fh: 246, plateH: 140, knob: 'boss', cost: 3.0, logoX: 400, logoY: 132, alwaysOn: true, jacksTop: true,
      algo: 'chain', opts: { chain: [
        { prefix: 'od', algo: 'drive', on: false, opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6000, levelMaxDb: 6 } },
        { prefix: 'ds', algo: 'drive', on: false, opts: { clip: 'diode', stages: 2, stage2Db: 14, gainMinDb: 10, gainMaxDb: 50, tone: 'lp', toneLo: 1200, toneHi: 8000, postLp: 7500, levelMaxDb: 6 } },
        { prefix: 'm', algo: 'chorus', on: false, params: { mix: 0.45 } },
        { prefix: 'dl', algo: 'delay', on: false, opts: { maxMs: 1500 }, params: { mode: 1 } },
        { prefix: 'r', algo: 'reverb', on: false, params: { mode: 1 } },
      ] },
      frames: [{ x: 14, y: 14, w: 94, h: 104, label: 'OVERDRIVE' }, { x: 112, y: 14, w: 94, h: 104, label: 'DISTORTION' }, { x: 210, y: 14, w: 60, h: 104, label: 'MOD' }, { x: 274, y: 14, w: 132, h: 54, label: 'DELAY · REVERB' }],
      controls: [
        at(K('od.level', 'LEVEL'), 36, 46, { r: 9 }), at(K('od.gain', 'GAIN', { def: 0.4 }), 86, 46, { r: 9 }), at(K('od.tone', 'TONE'), 61, 92, { r: 9 }),
        at(K('ds.level', 'LEVEL'), 134, 46, { r: 9 }), at(K('ds.gain', 'GAIN'), 184, 46, { r: 9 }), at(K('ds.tone', 'TONE'), 159, 92, { r: 9 }),
        at(K('m.rate', 'RATE', { def: 0.35 }), 240, 46, { r: 9 }), at(K('m.depth', 'DEPTH'), 240, 92, { r: 9 }),
        ...row([K('dl.time', 'TIME', { min: 40, max: 1500, def: 380, display: ms }), K('dl.feedback', 'FDBK', { def: 0.3 }), K('dl.mix', 'D.MIX', { def: 0.25 }), K('r.mix', 'R.MIX', { def: 0.25 })], 290, 390, 46, { r: 8 }),
        at(K('r.decay', 'DECAY', { def: 0.5 }), 290, 96, { r: 8 }),
        at(FOOT({ action: 'param', p: 'od.on', label: 'OD', style: 'stomp', r: 12 }), 50, 206), at(FOOT({ action: 'param', p: 'ds.on', label: 'DIST', style: 'stomp', r: 12 }), 130, 206),
        at(FOOT({ action: 'param', p: 'm.on', label: 'MOD', style: 'stomp', r: 12 }), 210, 206), at(FOOT({ action: 'param', p: 'dl.on', label: 'DELAY', style: 'stomp', r: 12 }), 290, 206),
        at(FOOT({ action: 'param', p: 'r.on', label: 'REVERB', style: 'stomp', r: 12 }), 370, 206),
        at(LED({ bind: 'param:od.on', color: '#3ddc84', r: 2.8 }), 50, 180), at(LED({ bind: 'param:ds.on', color: '#ff3020', r: 2.8 }), 130, 180),
        at(LED({ bind: 'param:m.on', color: '#37a3ff', r: 2.8 }), 210, 180), at(LED({ bind: 'param:dl.on', color: '#ffb000', r: 2.8 }), 290, 180), at(LED({ bind: 'param:r.on', color: '#b98cff', r: 2.8 }), 370, 180),
      ],
      initParams: { 'od.on': 0, 'ds.on': 0, 'm.on': 0, 'dl.on': 0, 'r.on': 0 },
      desc: 'Pedalboard-in-a-box: overdrive, distortion, chorus, delay and reverb, each on its own footswitch.',
    }),
  ]));
}
