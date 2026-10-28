// Built-in Tone Zone plugin: Keeley.
// Blocks inspired by Keeley Electronics pedals. Names, logos and artwork are Tone Zone originals; control layouts,
// colours and enclosure shapes follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, formKit, shade, luminance, noisePattern, textColorFor } = tz.gfx;

  // ------------------------------------------------------------------ enclosure: rounded die-cast, powder coat
  let seq = 0;
  tz.addForm('keeley', (ctx, def) => {
    const g = ctx.g, dual = !!def.dual;
    const w = dual ? 200 : 142, h = 238, rx = 17;
    const col = def.color, txt = def.text || textColorFor(col);
    const id = 'kly' + ++seq;
    const defs = svg('defs', {}, g);
    noisePattern(defs, id + 'w', 30, 60, [255, 255, 255], 0, 0.16, 0);
    noisePattern(defs, id + 'b', 22, 44, [0, 0, 0], 0, 0.2, 0);
    const sheen = svg('radialGradient', { id: id + 's', cx: 0.32, cy: 0.18, r: 0.95 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.22 }, sheen);
    svg('stop', { offset: 0.5, 'stop-color': '#fff', 'stop-opacity': 0.03 }, sheen);
    svg('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.22 }, sheen);
    formKit.body(g, w, h, col, { rx, grain: false });
    // powder coat: two speckle layers + a soft dome highlight (die-cast lid is slightly domed)
    svg('rect', { width: w, height: h, rx, fill: `url(#${id}w)` }, g);
    svg('rect', { width: w, height: h, rx, fill: `url(#${id}b)` }, g);
    svg('rect', { width: w, height: h, rx, fill: `url(#${id}s)` }, g);
    svg('rect', { x: 3.5, y: 3.5, width: w - 7, height: h - 7, rx: rx - 3, fill: 'none', stroke: '#000', 'stroke-opacity': 0.18, 'stroke-width': 1.4 }, g);
    // silk-screen frame with a notch for the side label
    const ink = txt;
    svg('path', { d: `M24 10 H${w - 18} Q${w - 10} 10 ${w - 10} 18 V${h - 18} Q${w - 10} ${h - 10} ${w - 18} ${h - 10} H24`, fill: 'none', stroke: ink, 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    // side label (rotated) – the name runs up the left edge, the type down the right edge
    const sideY = h / 2 + 4;
    label(g, 15, sideY, (def.logo || def.name).toUpperCase(), { size: def.logoSize || 11.5, fill: ink, font: "'Oswald', sans-serif", weight: 700, ls: 2.2, transform: `rotate(-90 15 ${sideY})` });
    label(g, w - 5.5, sideY, (def.typeName || def.cat).toUpperCase(), { size: 4.6, fill: ink, weight: 700, ls: 1.6, opacity: 0.75, transform: `rotate(90 ${w - 5.5} ${sideY})` });
    const theme = { text: ink, knob: def.knob || 'mxr', labelSize: 6, labelLs: 0.5, toggleTitles: false };
    const free = (c) => c.x === undefined || c._auto;
    def.controls.forEach((c) => { if (c.x === undefined) c._auto = true; });
    const knobs = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c));
    const tog = def.controls.filter((c) => c.t === 'toggle' && free(c));
    const groups = dual ? [0, 1] : [0];
    const areas = dual ? [[32, 112], [116, 188]] : [[30, 128]];
    let rowsMax = 1;
    groups.forEach((gi) => {
      const ks = knobs.filter((k) => (k.grp || 0) === gi);
      const [x0, x1] = areas[gi];
      const n = ks.length;
      const cols = n <= 2 ? n : n === 3 ? (dual ? 2 : 3) : n === 4 ? 2 : 3;
      const rows = Math.ceil(n / Math.max(1, cols));
      rowsMax = Math.max(rowsMax, rows);
      const r = n === 1 ? 15 : n === 2 ? 13 : n <= 4 ? (dual ? 11.5 : 12.5) : 11;
      for (let ri = 0; ri < rows; ri++) {
        const row = ks.slice(ri * cols, ri * cols + cols);
        const span = (x1 - x0) * (row.length / cols);
        const cx = (x0 + x1) / 2;
        row.forEach((k, i) => Object.assign(k, { x: row.length === 1 ? cx : cx - span / 2 + (span * (i + 0.5)) / row.length, y: (rows === 1 ? 58 : 46) + ri * 50, r: k.r || r, labelPos: 'below' }));
      }
      const ts = tog.filter((t) => (t.grp || 0) === gi);
      ts.forEach((t, i) => Object.assign(t, { x: ts.length === 1 ? (x0 + x1) / 2 : x0 + 14 + (i * (x1 - x0 - 28)) / (ts.length - 1), orient: 'h', grpTog: true }));
    });
    const togY = rowsMax > 1 ? 140 : 108;
    tog.forEach((t) => (t.y = togY));
    if (dual) svg('line', { x1: 114, x2: 114, y1: 22, y2: togY + 16, stroke: ink, 'stroke-opacity': 0.35, 'stroke-width': 0.7, 'stroke-dasharray': '2 2' }, g);
    // model plate
    const plateY = tog.length ? togY + 26 : rowsMax > 1 ? 150 : 124;
    const pw = Math.min(dual ? 96 : 78, 22 + (def.code || '').length * 6.2);
    const px = dual ? 114 : (30 + 128) / 2;
    svg('rect', { x: px - pw / 2, y: plateY - 8, width: pw, height: 16, rx: 8, fill: shade(col, luminance(col) > 0.5 ? -0.55 : -0.45), stroke: ink, 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, g);
    label(g, px, plateY + 0.4, def.code, { size: 7.6, fill: def.plateText || (luminance(col) > 0.5 ? '#f4f4f4' : txt), font: "'Oswald', sans-serif", weight: 600, ls: 1.4 });
    const foots = def.controls.filter((c) => c.t === 'foot' && free(c));
    const fx = dual ? [72, 152] : [px];
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 12, x: fx[i] ?? px, y: 206 }));
    const leds = def.controls.filter((c) => c.t === 'led' && free(c));
    leds.forEach((l, i) => Object.assign(l, { r: 2.8, x: fx[i] ?? px, y: 181 }));
    formKit.tzBadge(g, px, h - 7.5, ink, 3.8);
    formKit.placeControls(ctx, def.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(def, w, { flip: ctx.flip, y0: 192, gap: 24 }) };
  });

  const KY = (o) => def(Object.assign({ form: 'keeley', brand: 'Keeley', cost: 0.6 }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#3d8bff' })])] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const hold = { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } };

  tz.addDefs([
    KY({
      id: 'kly.bubbletron', name: 'Fizz Tron', ref: 'Keeley Bubble Tron', code: 'FIZZ TRON', logo: 'Fizz Tron', typeName: 'Dynamic flanger phaser', cat: 'Modulation', color: '#6c3fc4', cost: 1,
      stereo: 'both', algo: 'chain',
      opts: { chain: [{ prefix: 'fl', algo: 'flanger' }, { prefix: 'ph', algo: 'phaser', opts: { stages: 4 } }] },
      controls: [
        k('rate', 'RATE', { def: 0.3, virtual: true }), k('depth', 'DEPTH', { def: 0.65, virtual: true }), k('reso', 'RESO', { def: 0.45, virtual: true }),
        k('blend', 'FLG · PHS', { def: 0.5, virtual: true }), k('fl.manual', 'MANUAL', { def: 0.5 }), k('mix', 'MIX', { def: 0.65, virtual: true }),
        TOG('mode', 'MODE', ['flng', 'both', 'phase'], { def: 1, virtual: true }), TOG('wave', 'LFO', ['tri', 'env'], { virtual: true }),
      ],
      derive: (p) => {
        const m = p.mode ?? 1, bl = m === 0 ? 0 : m === 2 ? 1 : p.blend ?? 0.5, mix = p.mix ?? 0.5, rate = p.rate ?? 0.3, env = p.wave === 1;
        return {
          'fl.on': bl < 0.97 ? 1 : 0, 'ph.on': bl > 0.03 ? 1 : 0,
          'fl.speed': env ? 0.05 : rate * 0.8, 'fl.width': p.depth ?? 0.65, 'fl.regen': p.reso ?? 0.45, 'fl.mix': mix * Math.min(1, (1 - bl) * 1.6),
          'ph.rate': env ? 0.05 : rate, 'ph.depth': p.depth ?? 0.65, 'ph.feedback': (p.reso ?? 0.45) * 0.85, 'ph.mix': mix * Math.min(1, bl * 1.6),
        };
      },
      desc: 'Flanger and phaser in one: MODE picks flanger, phaser or both (FLG · PHS blends them), RESO sets regeneration, LFO env slows the sweep for a manual, expressive feel.',
    }),
    KY({
      id: 'kly.compplus', name: 'Squeeze Plus', ref: 'Keeley Compressor Plus', code: 'SQUEEZE+', logo: 'Squeeze', typeName: 'Compressor', cat: 'Dynamics', color: '#2f78d6',
      algo: 'comp', opts: { type: 'vca' },
      controls: [k('sustain', 'SUSTAIN', { def: 0.5 }), k('level', 'LEVEL', { def: 0.4 }), k('blend', 'BLEND', { def: 0.7 }), k('tone', 'TONE', { def: 0.55 }), TOG('pickup', 'PICKUP', ['single', 'hum'], { virtual: true })],
      derive: (p) => ({ attack: p.pickup ? 0.35 : 0.2, ratio: 0.5 }),
    }),
    KY({
      id: 'kly.dmdrive', name: 'D&N Twin Drive', ref: 'Keeley D&M Drive', code: 'D&N DRIVE', logo: 'Twin Drive', typeName: 'Boost + overdrive', cat: 'Overdrive', color: '#e9e3d2', text: '#1d1d1d', dual: true, noStd: true, cost: 1,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'b', algo: 'boost' },
        { prefix: 'd', algo: 'drive', opts: { tone: 'lp', toneLo: 1500, toneHi: 9000, levelMaxDb: 8, modes: [{ clip: 'ts', cleanSum: true, clipHp: 600, gainMaxDb: 34 }, { clip: 'si', gainMaxDb: 46, stages: 2, stage2Db: 6 }] } },
      ] },
      controls: [
        k('b.gain', 'BOOST', { def: 0.4, grp: 0 }), k('b.treble', 'TONE', { def: 0.5, grp: 0 }), TOG('beq', 'VOICE', ['flat', 'mid'], { grp: 0, virtual: true }),
        k('d.level', 'LEVEL', { def: 0.5, grp: 1 }), k('d.gain', 'DRIVE', { def: 0.5, grp: 1 }), k('d.tone', 'TONE', { def: 0.5, grp: 1 }), TOG('d.mode', 'CLIP', ['od', 'dist'], { grp: 1 }),
        FOOT({ action: 'param', p: 'b.on', label: 'BOOST' }), FOOT({ action: 'param', p: 'd.on', label: 'DRIVE' }),
        LED({ bind: 'param:b.on', color: '#ff3b2f' }), LED({ bind: 'param:d.on', color: '#3d8bff' }),
      ],
      alwaysOn: true, initParams: { 'b.on': 0, 'd.on': 1 },
      derive: (p) => ({ 'b.mode': p.beq ? 2 : 0, 'b.level': 0.7 }),
      desc: 'Two pedals in one: a clean / mid boost (left) into a TS-style overdrive with an OD / distortion clipping switch (right).',
    }),
    KY({
      id: 'kly.reddirt', name: 'Red Clay Overdrive', ref: 'Keeley Red Dirt Overdrive', code: 'RED CLAY', logo: 'Red Clay', typeName: 'Overdrive', cat: 'Overdrive', color: '#b8231d', led: '#ff3b2f',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, tone: 'ts', levelMaxDb: 10, modes: [{ gainMaxDb: 40 }, { gainMaxDb: 50, stages: 2, stage2Db: 8 }] },
      controls: [k('level', 'LEVEL'), k('gain', 'DRIVE'), k('tone', 'TONE'), k('bright', 'FILTER', { def: 0.3 }), TOG('mode', 'MODE', ['TS', 'HI-GAIN'])],
    }),
    KY({
      id: 'kly.katana', name: 'Blade Boost', ref: 'Keeley Katana Clean Boost', code: 'BLADE', logo: 'Blade', typeName: 'Clean boost', cat: 'Boost', color: '#c4c7cd', text: '#7d1414', led: '#ff3b2f',
      algo: 'boost',
      controls: [k('gain', 'LEVEL', { def: 0.35 }), TOG('mode', 'PUSH / PULL', ['clean', 'mid'], { values: [0, 2] })],
      fixed: { level: 0.48 },
    }),
    KY({
      id: 'kly.phatmagic', name: 'Fat Wizard', ref: 'Keeley Phat Magic Distortion', code: 'FAT WIZARD', logo: 'Fat Wizard', logoSize: 10.5, typeName: 'Distortion', cat: 'Distortion', color: '#5a2a8c',
      algo: 'drive', opts: { clip: 'diode', tone: 'lp', toneLo: 1200, toneHi: 7500, gainMinDb: 10, gainMaxDb: 48, levelMaxDb: 6, outTrim: 0.33, modes: [{}, { preEq: [{ type: 'ls', f: 160, q: 0.7, db: 6 }] }] },
      controls: [k('level', 'LEVEL'), k('gain', 'GAIN'), k('tone', 'TONE'), TOG('mode', 'FAT', ['off', 'on'])],
    }),
    KY({
      id: 'kly.superphatmod', name: 'Super Fat Mod', ref: 'Keeley Super Phat Mod', code: 'FAT MOD', logo: 'Super Fat Mod', logoSize: 10, typeName: 'Overdrive', cat: 'Overdrive', color: '#2f62b0',
      algo: 'drive', opts: { clip: 'asym', tone: 'lp', toneLo: 1500, toneHi: 9000, levelMaxDb: 8, modes: [{ gainMaxDb: 26, preEq: [{ type: 'hs', f: 2500, q: 0.7, db: -3 }] }, { gainMaxDb: 36 }, { gainMaxDb: 44, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 4 }] }] },
      controls: [k('level', 'LEVEL'), k('gain', 'DRIVE'), k('tone', 'TONE'), TOG('mode', 'MODE', ['jazz', 'rock', 'crunch'], { def: 1 })],
    }),
    KY({
      id: 'kly.oxblood', name: 'Bull Blood Overdrive', ref: 'Keeley Oxblood Overdrive', code: 'BULL BLOOD', logo: 'Bull Blood', typeName: 'Overdrive', cat: 'Overdrive', color: '#6b1820', led: '#ff3b2f',
      algo: 'drive', opts: { clip: 'si', tone: 'tilt', eqRangeDb: 9, gainMaxDb: 38, levelMaxDb: 8, outTrim: 0.42, modes: [{}, { preEq: [{ type: 'peak', f: 700, q: 0.8, db: 4 }], gainMaxDb: 44 }] },
      controls: [k('level', 'LEVEL'), k('gain', 'GAIN'), k('tone', 'TONE'), TOG('mode', 'MODE', ['passive', 'active'])],
    }),
    KY({
      id: 'kly.musedriver', name: 'Muse Overdrive', ref: 'Keeley Muse Driver', code: 'MUSE OD', logo: 'Muse', typeName: 'Overdrive & distortion', cat: 'Overdrive', color: '#1f9a96',
      algo: 'drive', opts: { tone: 'lp', toneLo: 1600, toneHi: 9000, levelMaxDb: 8, modes: [{ clip: 'ts', gainMaxDb: 32 }, { clip: 'asym', gainMaxDb: 34 }, { clip: 'diode', gainMaxDb: 46 }, { clip: 'led', gainMaxDb: 46 }] },
      controls: [k('level', 'LEVEL'), k('gain', 'DRIVE'), k('tone', 'TONE'), TOG('md', 'MODE', ['OD', 'DIST'], { virtual: true }), TOG('clip', 'CLIP', ['sym', 'asym'], { virtual: true })],
      derive: (p) => ({ mode: (p.md ?? 0) * 2 + (p.md ? 1 - (p.clip ?? 0) : p.clip ?? 0) }),
    }),
    KY({
      id: 'kly.eccos', name: 'Echoes Tape Delay', ref: 'Keeley Eccos', code: 'ECHOES', logo: 'Echoes', typeName: 'Vintage tape delay & looper', cat: 'Delay', color: '#d8cfa6', text: '#262218', dual: true, noStd: true, stereo: 'both', cost: 1.2,
      algo: 'delay', opts: { maxMs: 1600, fixedMode: 2 },
      controls: [
        K('time', 'TIME', { min: 40, max: 1500, def: 380, display: ms, grp: 0 }), k('feedback', 'REPEATS', { def: 0.4, max: 1.05, grp: 0 }), k('mix', 'LEVEL', { def: 0.38, grp: 0 }),
        k('moddepth', 'WOW', { def: 0.2, grp: 1 }), k('tone', 'FILTER', { def: 0.55, grp: 1 }), k('age', 'TAPE', { def: 0.35, grp: 1 }),
        TOG('heads', 'HEADS', ['1', '1+2'], { values: [4, 6], grp: 1 }),
        FOOT({ action: 'bypass', label: 'DELAY' }), FOOT({ action: 'tap', label: 'TAP · HOLD', hold }),
        LED({ color: '#3d8bff' }), LED({ bind: 'tap:time', color: '#ff3b2f' }),
      ],
      desc: 'Tape-style delay with wow, filter and tape wear. Hold the right switch for infinite repeats (stands in for the looper).',
    }),
    KY({
      id: 'kly.caverns', name: 'Grotto Delay Reverb', ref: 'Keeley Caverns V2', code: 'GROTTO', logo: 'Grotto', typeName: 'Delay & reverb', cat: 'Reverb', color: '#2b7e88', dual: true, noStd: true, stereo: 'both', cost: 1.8,
      algo: 'chain',
      opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 1200 } }, { prefix: 'r', algo: 'reverb' }] },
      controls: [
        K('d.time', 'TIME', { min: 30, max: 1100, def: 360, display: ms, grp: 0 }), k('d.mix', 'MIX', { def: 0.3, grp: 0 }), k('d.feedback', 'REPEATS', { def: 0.35, grp: 0 }),
        TOG('dmode', 'DELAY', ['tape', 'bbd', 'mod'], { grp: 0, virtual: true }),
        k('r.mix', 'LEVEL', { def: 0.3, grp: 1 }), k('r.decay', 'DWELL', { def: 0.5, grp: 1 }), k('r.tone', 'TONE', { def: 0.55, grp: 1 }),
        TOG('rmode', 'REVERB', ['spring', 'shim', 'mod'], { grp: 1, virtual: true }),
        FOOT({ action: 'param', p: 'd.on', label: 'DELAY' }), FOOT({ action: 'param', p: 'r.on', label: 'REVERB' }),
        LED({ bind: 'param:d.on', color: '#3d8bff' }), LED({ bind: 'param:r.on', color: '#3d8bff' }),
      ],
      alwaysOn: true, initParams: { 'd.on': 1, 'r.on': 1 },
      derive: (p) => ({ 'd.mode': [2, 1, 4][p.dmode ?? 0], 'd.moddepth': p.dmode === 2 ? 0.4 : 0.1, 'r.mode': [3, 4, 6][p.rmode ?? 0], 'r.shimmer': 0.55 }),
    }),
    KY({
      id: 'kly.hydra', name: 'Serpent Reverb & Trem', ref: 'Keeley Hydra', code: 'SERPENT', logo: 'Serpent', typeName: 'Stereo reverb & tremolo', cat: 'Reverb', color: '#1c6a51', stereo: 'stereo', ports: { ins: ['IN L', 'IN R'], outs: ['OUT L', 'OUT R'] }, cost: 1.6,
      algo: 'chain',
      opts: { chain: [{ prefix: 't', algo: 'tremolo', on: false }, { prefix: 'r', algo: 'reverb' }] },
      controls: [
        k('r.mix', 'MIX', { def: 0.35 }), k('r.decay', 'DWELL', { def: 0.5 }), k('r.tone', 'TONE', { def: 0.55 }),
        k('t.rate', 'RATE', { def: 0.4 }), k('t.depth', 'DEPTH', { def: 0.5 }),
        TOG('rmode', 'REVERB', ['spring', 'hall', 'plate'], { virtual: true }), TOG('tmode', 'TREM', ['off', 'opto', 'harm'], { virtual: true }),
      ],
      derive: (p) => ({ 'r.mode': [3, 1, 2][p.rmode ?? 0], 't.on': p.tmode ? 1 : 0, 't.mode': p.tmode === 2 ? 1 : 0, 't.stereo': 1 }),
    }),
    KY({
      id: 'kly.fuzzbender', name: 'Fuzz Twister', ref: 'Keeley Fuzz Bender', code: 'TWISTER', logo: 'Fuzz Twister', logoSize: 10.5, typeName: 'Germanium hybrid fuzz', cat: 'Fuzz', color: '#e39a18', text: '#1a1a1a',
      algo: 'drive', opts: { clip: 'ge', bias: 0.35, stages: 2, stage2Db: 10, gainMinDb: 12, gainMaxDb: 52, tone: 'eq3', eqRangeDb: 12, bassF: 120, trebleF: 2600, levelMaxDb: 4, outTrim: 0.4 },
      controls: [k('level', 'LEVEL'), k('gain', 'FUZZ', { def: 0.6 }), k('sag', 'BIAS', { def: 0.2 }), k('bass', 'BASS'), k('treble', 'TREBLE'), k('blend', 'BLEND', { def: 1 })],
    }),
    KY({
      id: 'kly.darkside', name: 'Shadow Side', ref: 'Keeley Dark Side', code: 'SHADOW', logo: 'Shadow Side', logoSize: 10.5, typeName: 'Fuzz & modulation workstation', cat: 'Multi-FX', kind: 'Pedal', color: '#1d1631', dual: true, noStd: true, cost: 1.6,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 10, gainMinDb: 14, gainMaxDb: 50, tone: 'blend', levelMaxDb: 4 } },
        { prefix: 'ph', algo: 'phaser', opts: { stages: 4 }, on: false }, { prefix: 'fl', algo: 'flanger', on: false }, { prefix: 'vb', algo: 'vibe', on: false },
        { prefix: 'd', algo: 'delay', params: { mix: 0.18, time: 380, feedback: 0.3 }, on: false },
      ] },
      controls: [
        k('f.level', 'LEVEL', { grp: 0 }), k('f.gain', 'FUZZ', { def: 0.6, grp: 0 }), k('f.tone', 'FILTER', { grp: 0 }), TOG('dly', 'ECHO', ['off', 'on'], { grp: 0, virtual: true }),
        k('rate', 'RATE', { def: 0.35, grp: 1, virtual: true }), k('depth', 'DEPTH', { def: 0.6, grp: 1, virtual: true }), k('mix', 'BLEND', { def: 0.5, grp: 1, virtual: true }),
        TOG('mod', 'MOD', ['phase', 'flange', 'vibe'], { grp: 1, virtual: true }),
        FOOT({ action: 'param', p: 'f.on', label: 'FUZZ' }), FOOT({ action: 'param', p: 'mod.on', label: 'MOD' }),
        LED({ bind: 'param:f.on', color: '#ff3b2f' }), LED({ bind: 'param:mod.on', color: '#9a7cff' }),
      ],
      alwaysOn: true, initParams: { 'f.on': 1, 'mod.on': 1 },
      derive: (p) => {
        const m = p.mod ?? 0, on = p['mod.on'] > 0.5, r = p.rate ?? 0.35, dp = p.depth ?? 0.6, mx = p.mix ?? 0.5;
        return {
          'ph.on': on && m === 0 ? 1 : 0, 'fl.on': on && m === 1 ? 1 : 0, 'vb.on': on && m === 2 ? 1 : 0, 'd.on': p.dly ? 1 : 0,
          'ph.rate': r, 'ph.depth': dp, 'ph.mix': mx, 'fl.speed': r * 0.7, 'fl.width': dp, 'fl.mix': mx, 'vb.speed': r, 'vb.intensity': dp,
        };
      },
      desc: 'Big-muff-style fuzz into phaser / flanger / uni-vibe modulation, plus an optional echo.',
    }),
    KY({
      id: 'kly.halo', name: 'Aura Dual Echo', ref: 'Keeley Halo Andy Timmons Dual Echo', code: 'AURA', logo: 'Aura', typeName: 'Dual echo', cat: 'Delay', color: '#eef1f4', text: '#1c3a66', dual: true, noStd: true, stereo: 'both', cost: 1,
      algo: 'delay', opts: { maxMs: 1600 },
      controls: [
        K('time', 'TIME', { min: 40, max: 1500, def: 420, display: ms, grp: 0 }), k('feedback', 'REPEATS', { def: 0.35, grp: 0 }), k('mix', 'MIX', { def: 0.32, grp: 0 }),
        TOG('subdiv', 'RHYTHM', ['1/4', 'dot', 'trip'], { values: [0, 1, 3], grp: 0 }),
        k('moddepth', 'MOD', { def: 0.2, grp: 1 }), k('tone', 'FILTER', { def: 0.55, grp: 1 }), k('age', 'DIRT', { def: 0.25, grp: 1 }),
        TOG('echo', 'ECHO', ['single', 'dual'], { grp: 1, virtual: true }),
        FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'tap', label: 'TAP', hold }),
        LED({ color: '#3d8bff' }), LED({ bind: 'tap:time', color: '#3d8bff' }),
      ],
      derive: (p) => ({ mode: p.echo ? 8 : 1, spread: 0.5, modrate: 0.3 }),
    }),
  ]);
}
