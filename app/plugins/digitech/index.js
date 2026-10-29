// Built-in Tone Zone plugin: DigiTech.
// Blocks inspired by DigiTech gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).

// Treadle enclosure with an optional side pod for knobs / switches (same layout as the Dunlop plugin's).
function treadleForm(tz) {
  const { svg, label, formKit, shade } = tz.gfx;
  return (ctx, def) => {
    const g = ctx.g;
    const w = def.tw || 152, h = def.th || 304;
    const pn = def.panel || null;
    const P = pn ? pn.w || 48 : 0;
    const col = def.color || '#1a1a1c';
    const py = pn ? pn.y ?? 40 : 0, ph = pn ? pn.h ?? h - 80 : 0;
    if (pn) {
      const pg = svg('g', { transform: `translate(${w - 18},${py})` }, g);
      formKit.body(pg, P + 18, ph, pn.color || shade(col, -0.1), { rx: 9 });
      if (pn.title) label(pg, 18 + P / 2, 12, pn.title, { size: 5.2, fill: def.text || '#d8d8d8', weight: 800, ls: 1 });
    }
    formKit.body(g, w, h, col, { rx: def.rx || 14, brushed: !!def.brushed });
    if (def.art) def.art(g, w, h, tz);
    svg('rect', { x: 6, y: h - 34, width: w - 12, height: 26, rx: 6, fill: '#0c0c0d', opacity: 0.6 }, g);
    const theme = { text: def.text || '#d8d8d8', knob: def.knob || 'mxr', labelSize: 5.8 };
    def.controls.forEach((c) => {
      if (c.t === 'treadle' && c.x === undefined)
        Object.assign(c, { x: w / 2, y: h / 2 - 12, w: w - 30, h: h - 66, color: def.treadleColor || '#161618', logo: def.logo, logoColor: def.logoColor, logoFont: def.logoFont, logoSize: def.logoSize });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - 21, r: 2.6 });
    });
    const pc = def.controls.filter((c) => c.panel && c.x === undefined);
    const gap = pn && pn.gap ? pn.gap : pc.length > 1 ? Math.min(52, (ph - 46) / (pc.length - 0.4)) : 0;
    pc.forEach((c, i) => {
      c.x = w + P / 2;
      c.y = py + (pn.top ?? (pn.title ? 50 : 36)) + i * gap;
      if (c.t === 'knob' || c.t === 'sel') { c.r = c.r || 9.5; c.labelPos = c.labelPos || (c.t === 'sel' ? 'below' : 'above'); }
      if (c.t === 'toggle') c.orient = c.orient || 'h';
      if (c.t === 'foot') { c.style = c.style || 'stomp'; c.r = c.r || 10; }
      if (c.t === 'screen') { c.w = c.w || P - 8; c.h = c.h || 14; }
    });
    label(g, 24, h - 21, def.code, { size: 6, fill: theme.text, weight: 800, ls: 1, anchor: 'start' });
    formKit.tzBadge(g, w - 24, h - 21, theme.text, 4.2).setAttribute('text-anchor', 'end');
    formKit.placeControls(ctx, def.controls, theme);
    const W = w + P;
    return { w: W, h, theme, jacks: formKit.jacksSide(def, W, { y0: def.jackY ?? h - 96, gap: 24, flip: ctx.flip }) };
  };
}

export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { svg, label, formKit, shade } = tz.gfx;

  tz.addForm('dt-treadle', treadleForm(tz));

  // DigiTech-style stompbox: knob row(s) on top, optional centre selector, dark name band, footswitch.
  // controls this form positions (forms run more than once, so the layout is redone on every call)
  const owned = new WeakSet();
  tz.addForm('dt-stomp', (ctx, d) => {
    const g = ctx.g, mini = d.mini;
    d.controls.forEach((c) => { if (c.x === undefined) owned.add(c); });
    const mine = (c) => owned.has(c);
    const w = mini ? 100 : 132;
    let h = mini ? 184 : 236;
    const col = d.color, txt = d.text || '#f2f2f2';
    const bodyG = svg('g', {}, g); // body is drawn once the height is known
    const theme = { text: txt, knob: d.knob || 'boss', labelSize: 6 };
    const knobs = d.controls.filter((c) => c.t === 'knob' && mine(c));
    const per = knobs.length > 4 ? Math.ceil(knobs.length / 2) : 4;
    for (let r = 0; r * per < knobs.length; r++) {
      const row = knobs.slice(r * per, r * per + per);
      row.forEach((k, i) => Object.assign(k, { x: row.length === 1 ? w / 2 : 22 + ((w - 44) * i) / (row.length - 1), y: 34 + r * 42, r: k.r || (mini ? 10 : 10.5), labelPos: 'above' }));
      knobs.forEach((k) => (k.labelPos = 'below'));
    }
    const rowsUsed = Math.ceil(knobs.length / per);
    const sel = d.controls.find((c) => c.t === 'sel' && mine(c));
    const selY = 34 + rowsUsed * 42 + 6;
    if (sel) Object.assign(sel, { x: w / 2, y: selY, r: sel.r || 11, labelPos: 'none', optSize: sel.optSize || 4.3, labelRadius: sel.labelRadius || 6.5 });
    const togs = d.controls.filter((c) => c.t === 'toggle' && mine(c));
    // toggles flank the selector, or sit centred when there is none
    if (sel) togs.forEach((t, i) => Object.assign(t, { x: i ? w - 20 : 20, y: selY + 4, orient: 'v', optSize: 4.4, labelSide: i ? 'left' : 'right' }));
    else togs.forEach((t, i) => Object.assign(t, { x: togs.length === 1 ? w / 2 : 36 + i * (w - 72), y: selY, orient: 'h', optSize: 4.6 }));
    const by = mini ? 90 : sel || togs.length ? selY + (sel ? 30 : 20) : 34 + rowsUsed * 42 + 6;
    const bh = mini ? 30 : 38;
    if (!mini) h = Math.max(h, by + bh + 84);
    formKit.body(bodyG, w, h, col, { rx: 7 });
    svg('rect', { x: 0, y: 0, width: w, height: mini ? 6 : 8, rx: 3, fill: d.accent || shade(col, -0.3), opacity: 0.9 }, bodyG);
    svg('rect', { x: 8, y: by, width: w - 16, height: bh, rx: 3, fill: d.band || '#0f0f10', opacity: 0.92 }, g);
    svg('rect', { x: 8, y: by, width: w - 16, height: bh * 0.45, rx: 3, fill: '#fff', opacity: 0.06 }, g);
    label(g, w / 2, by + bh * 0.42, d.logo, { size: d.logoSize || (mini ? 14 : 19), fill: d.logoColor || '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, by + bh - 7, (d.typeName || d.cat).toUpperCase(), { size: mini ? 4.4 : 5, fill: '#d0d0d0', weight: 700, ls: 1.4 });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    d.controls.forEach((c) => {
      if (c.t === 'foot' && mine(c)) Object.assign(c, { style: 'stomp', x: w / 2, y: h - (mini ? 34 : 40), r: mini ? 11 : 12.5 });
      if (c.t === 'led' && mine(c)) Object.assign(c, { x: w / 2, y: mini ? h - 62 : Math.max(h - 70, by + bh + 9), r: 2.8 });
    });
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: mini ? 44 : 52, gap: 26, flip: ctx.flip }) };
  });
  const DT = (o) => def(Object.assign({ form: 'dt-stomp', brand: 'DigiTech' }, o, { controls: [...o.controls, ...(o.noStd ? [] : STD(o.led || '#ff2a1a'))] }));

  // Whammy-style modes: [name, heel semis, toe semis, kind]. kind: w = whammy (wet only), d = detune, h = harmony (dry + voice)
  const WMODES = [
    ['2 OCT UP', 0, 24, 'w'], ['OCT UP', 0, 12, 'w'], ['5TH UP', 0, 7, 'w'], ['4TH UP', 0, 5, 'w'], ['2ND DN', 0, -2, 'w'], ['4TH DN', 0, -5, 'w'], ['5TH DN', 0, -7, 'w'],
    ['OCT DN', 0, -12, 'w'], ['2 OCT DN', 0, -24, 'w'], ['DIVE BOMB', 0, -24, 'w'], ['DETUNE SHAL', 0, 0, 'd'], ['DETUNE DEEP', 0, 0, 'd'],
    ['OCT DN/UP', -12, 12, 'h'], ['5DN/4UP', -7, 5, 'h'], ['4DN/3UP', -5, 4, 'h'], ['5UP/7UP', 7, 11, 'h'], ['5UP/6UP', 7, 9, 'h'], ['4UP/5UP', 5, 7, 'h'], ['3UP/4UP', 4, 5, 'h'], ['b3/3 UP', 3, 4, 'h'], ['2ND/3RD UP', 2, 4, 'h'],
  ];
  const whammyDerive = (p) => {
    const m = WMODES[p.model ?? 1] || WMODES[1];
    const pos = p.expr ?? 0;
    if (m[3] === 'd') return { semis1: 0, cents: m[0].includes('DEEP') ? 22 : 9, dry: 1, level1: 0.25 + 0.75 * pos, expr: 1, glide: 0.1 };
    if (m[3] === 'h') return { semis1: m[2], expr: (m[1] + (m[2] - m[1]) * pos) / m[2], dry: 1, level1: 0.85, cents: 0, glide: 0.1 };
    return { semis1: m[2], expr: pos, dry: 0, level1: 1, cents: 0, glide: m[0] === 'DIVE BOMB' ? 0.35 : 0.1 };
  };

  tz.addDefs([
    def({
      id: 'dt.drop', name: 'Dropper', ref: 'DigiTech Drop', brand: 'DigiTech', code: 'DROP', cat: 'Pitch', form: 'drop', color: '#c4161c',
      algo: 'pitch', fixed: { level1: 1, quality: 1 }, cost: 0.6,
      controls: [
        SEL('dsel', '', ['1', '2', '3', '4', '5', '6', '7', 'OCT', 'OCT+DRY'], { x: 73, y: 64, r: 20, sweep: 270, def: 1, style: 'chrome', labelRadius: 13, optSize: 5.6 }),
        TOG('momentary', 'MOMENTARY', ['OFF', 'ON'], { x: 26, y: 26, orient: 'h' }),
        FOOT({ style: 'stomp', x: 73, y: 196, r: 13 }), LED({ x: 73, y: 168, r: 3 }),
      ],
      derive: (p) => {
        const i = p.dsel ?? 1;
        if (i < 7) return { semis1: -(i + 1), dry: 0, level1: 1 };
        return { semis1: -12, dry: i === 8 ? 0.8 : 0, level1: 1 };
      },
      momentaryWhen: (p) => p.momentary === 1,
      dropLeds: true,
      desc: 'Polyphonic drop tune 1 to 7 semitones, octave, octave+dry. MOMENTARY ON = active only while the footswitch is held.',
    }),
    def({
      id: 'dt.whammy5', name: 'Wham-O-Matic 5', ref: 'DigiTech Whammy 5', brand: 'DigiTech', code: 'WOM-5', cat: 'Pitch', form: 'dt-treadle', color: '#c0141b', text: '#ffffff',
      treadleColor: '#161616', logo: 'WHAM-O-MATIC', logoFont: "'Oswald', sans-serif", logoColor: '#ffffff', logoSize: 16, cost: 0.8, toeSwitch: true,
      algo: 'pitch', fixed: { quality: 1 },
      panel: { w: 58, y: 30, h: 240, gap: 44, title: 'MODE' },
      controls: [TREADLE('expr', { def: 0 }), LED({ color: '#ff2a1a', r: 2.2 }),
        SCREEN('modelName', { panel: true, names: WMODES.map((m) => m[0]), w: 52, h: 14 }),
        SEL('model', 'WHAMMY · DETUNE · HARMONY', WMODES.map((m) => m[0]), { panel: true, def: 1, sweep: 300, printLabels: false, ring: true, virtual: true, r: 12, labelPos: 'none' }),
        TOG('chords', '', ['CLASSIC', 'CHORDS'], { panel: true, def: 1, values: [1, 2] })],
      derive: (p) => Object.assign(whammyDerive(p), { quality: p.chords === 0 ? 1 : 2 }),
      desc: '21 modes of Whammy pitch bends, Detune doubling and Harmony. CLASSIC tracks single notes fastest, CHORDS handles chords. Click the treadle to bypass.',
    }),
    DT({
      id: 'dt.ricochet', name: 'Ricoshift', ref: 'DigiTech Whammy Ricochet', code: 'RICO', logo: 'RICOSHIFT', typeName: 'Pitch shift glide', cat: 'Pitch', color: '#c0141b', mini: true, noStd: true,
      algo: 'pitch', fixed: { level1: 1, quality: 1, semis2: 0, level2: 0 }, alwaysOn: true, cost: 0.6,
      controls: [K('glide', 'TIME', { def: 0.35 }), K('dry', 'DRY', { def: 0, r: 8 }),
        SEL('semis1', 'SHIFT', ['-24', '-12', '-7', '-5', '-2', '+2', '+5', '+7', '+12', '+24'], { values: [-24, -12, -7, -5, -2, 2, 5, 7, 12, 24], def: 8, x: 50, y: 66, r: 9, sweep: 280, optSize: 3.8, labelRadius: 5.5, labelPos: 'none' }),
        FOOT({ action: 'param', p: 'shift' }), LED({ bind: 'param:shift' })],
      derive: (p) => ({ expr: p.shift ? 1 : 0 }),
      desc: 'Press the footswitch to glide up (or down) to the SHIFT interval, press again to glide back. TIME sets the rise / fall time.',
    }),
    DT({
      id: 'dt.polara', name: 'Polaris Verb', ref: 'DigiTech Polara', code: 'POLARIS', logo: 'POLARIS', typeName: 'Reverb', cat: 'Reverb', color: '#2b6ea3', stereo: 'both', cost: 1.3,
      algo: 'reverb',
      controls: [K('mix', 'LEVEL', { def: 0.35 }), K('live', 'LIVELINESS', { def: 0.5, virtual: true }), K('decay', 'DECAY', { def: 0.5 }),
        SEL('type', 'TYPE', ['ROOM', 'SPRING', 'PLATE', 'HALL', 'REVERSE', 'MOD', 'HALO'], { def: 3, sweep: 270, virtual: true })],
      derive: (p) => {
        const l = p.live ?? 0.5;
        return { mode: [0, 3, 2, 1, 9, 6, 4][p.type ?? 3], tone: 0.3 + 0.6 * l, diffusion: 0.5 + 0.4 * l, predelay: 5 + 40 * l, shimmer: 0.5 };
      },
      desc: 'Seven Lexicon-flavoured reverbs. LIVELINESS sets brightness, density and pre-delay. (Reverse is approximated with the swell reverb.)',
    }),
    DT({
      id: 'dt.obscura', name: 'Obscurity Delay', ref: 'DigiTech Obscura', code: 'OBSCURITY', logo: 'OBSCURITY', logoSize: 16, typeName: 'Altered delay', cat: 'Delay', color: '#3a3330', stereo: 'both', cost: 1,
      algo: 'delay', opts: { maxMs: 2000 },
      controls: [K('mix', 'LEVEL', { def: 0.35 }), K('time', 'TIME', { min: 20, max: 2000, def: 420, curve: 'log', display: ms }), K('feedback', 'REPEATS', { def: 0.4 }), K('degrade', 'DEGRADE', { def: 0.35, virtual: true }),
        SEL('type', 'TYPE', ['TAPE', 'ANALOG', 'LO-FI', 'REVERSE'], { def: 0, sweep: 150, virtual: true })],
      derive: (p) => { const dg = p.degrade ?? 0.35; return { mode: [2, 1, 3, 5][p.type ?? 0], age: dg, tone: 0.75 - 0.5 * dg, moddepth: 0.1 + 0.5 * dg, modrate: 0.25, heads: 4 }; },
      desc: 'Tape, analog, lo-fi and reverse delays. DEGRADE adds wow & flutter, darkening and grit.',
    }),
    DT({
      id: 'dt.badmonkey', name: 'Mad Monkey', ref: 'DigiTech Bad Monkey', code: 'MAD MONKEY', logo: 'MAD MONKEY', logoSize: 16, typeName: 'Tube overdrive', cat: 'Overdrive', color: '#2f6b2f',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, preHp: 100, clipHp: 600, gainMinDb: 8, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, levelMaxDb: 6 },
      fixed: { mid: 0.5 },
      controls: [K('level', 'LEVEL'), K('gain', 'GAIN'), K('bass', 'LOW'), K('treble', 'HIGH')],
      desc: 'TS-style overdrive with separate LOW and HIGH controls.',
    }),
    DT({
      id: 'dt.grunge', name: 'Grungy', ref: 'DigiTech Grunge', code: 'GRUNGY', logo: 'GRUNGY', typeName: 'Analog distortion', cat: 'Distortion', color: '#c4651d',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 12, preHp: 90, gainMinDb: 14, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 14, bassF: 110, midF: 900, trebleF: 3000, postLp: 6500, levelMaxDb: 2 },
      fixed: { mid: 0.45 },
      controls: [K('level', 'LEVEL', { def: 0.4 }), K('bass', 'LOW'), K('treble', 'HIGH'), K('gain', 'GRUNGE', { def: 0.6 })],
    }),
    DT({
      id: 'dt.deathmetal', name: 'Doom Metal', ref: 'DigiTech Death Metal', code: 'DOOM METAL', logo: 'DOOM METAL', logoSize: 16, typeName: 'Distortion', cat: 'Distortion', color: '#1c1c1c', accent: '#b3141b', band: '#7a0d10',
      algo: 'drive', opts: { clip: 'si', stages: 3, stage2Db: 16, preHp: 110, gainMinDb: 20, gainMaxDb: 60, tone: 'eq3', eqRangeDb: 15, bassF: 100, midF: 750, trebleF: 3500, postLp: 7000, levelMaxDb: 0 },
      controls: [K('level', 'LEVEL', { def: 0.45 }), K('bass', 'LOW', { def: 0.6 }), K('mid', 'MID', { def: 0.35 }), K('treble', 'HIGH', { def: 0.6 }), K('gain', 'DISTORTION', { def: 0.7 })],
    }),
  ]);

  // ---- v0.4 additions
  const DROPS = ['OFF', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-12'];
  const pre = (o, k) => Object.fromEntries(Object.entries(o).map(([a, b]) => [k + a, b]));
  const BASS_MODES = [0, 1, 7, 8, 6, 5, 9, 10, 12];
  const HW = (o) => DT(Object.assign({ color: '#1d1d20', accent: '#8c9299', band: '#2b2c30', knob: 'chrome' }, o));
  tz.addDefs([
    def({
      id: 'dt.whammydt', name: 'Wham-O-Matic DT', ref: 'DigiTech Whammy DT', brand: 'DigiTech', code: 'WOM-DT', cat: 'Pitch', form: 'dt-treadle', color: '#c0141b', text: '#ffffff',
      treadleColor: '#161616', logo: 'WHAM-O-MATIC', logoFont: "'Oswald', sans-serif", logoColor: '#ffffff', logoSize: 16, cost: 1.5, toeSwitch: true,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'pitch', on: false, params: { dry: 0, level1: 1, level2: 0, quality: 2 } },
        { prefix: 'w', algo: 'pitch', params: { quality: 1 } },
      ] },
      panel: { w: 60, y: 24, h: 252, gap: 44, title: 'WHAMMY / DROP' },
      controls: [TREADLE('w.expr', { def: 0 }), LED({ color: '#ff2a1a', r: 2.2 }),
        SCREEN('modelName', { panel: true, names: WMODES.map((m) => m[0]), w: 52, h: 14 }),
        SEL('model', 'WHAMMY', WMODES.map((m) => m[0]), { panel: true, def: 1, sweep: 300, printLabels: false, ring: true, virtual: true, r: 11, labelPos: 'none' }),
        SEL('drop', 'DROP TUNE', DROPS, { panel: true, def: 2, sweep: 260, virtual: true, r: 9.5, optSize: 3.8, labelRadius: 6 }),
        FOOT({ panel: true, action: 'param', p: 'd.on', label: '' }), LED({ x: 182, y: 258, bind: 'param:d.on', color: '#ff2a1a', r: 2.4, label: 'DROP' })],
      derive: (p) => {
        const dv = [0, -1, -2, -3, -4, -5, -6, -7, -12][p.drop ?? 2];
        return Object.assign(pre(whammyDerive({ model: p.model, expr: p['w.expr'] }), 'w.'), { 'd.semis1': dv || -1, 'w.quality': 2 });
      },
      desc: 'Whammy modes on the treadle plus a separate drop tune with its own footswitch (one to seven semitones or an octave down).',
    }),
    def({
      id: 'dt.whammybass', name: 'Wham-O-Matic Bass', ref: 'DigiTech Whammy Bass', brand: 'DigiTech', code: 'WOM-B', cat: 'Pitch', form: 'dt-treadle', color: '#1e3f8a', text: '#ffffff',
      treadleColor: '#161616', logo: 'WHAM-O-MATIC', logoFont: "'Oswald', sans-serif", logoColor: '#ffffff', logoSize: 16, cost: 0.8, toeSwitch: true,
      algo: 'pitch', fixed: { quality: 2 },
      panel: { w: 58, y: 40, h: 220, gap: 48, title: 'BASS MODE' },
      controls: [TREADLE('expr', { def: 0 }), LED({ color: '#ff2a1a', r: 2.2 }),
        SCREEN('modelName', { panel: true, names: BASS_MODES.map((i) => WMODES[i][0]), w: 52, h: 14 }),
        SEL('bmodel', 'MODE', BASS_MODES.map((i) => WMODES[i][0]), { panel: true, def: 2, sweep: 280, printLabels: false, ring: true, virtual: true, r: 12, labelPos: 'none' })],
      derive: (p) => whammyDerive({ model: BASS_MODES[p.bmodel ?? 2], expr: p.expr }),
      desc: 'Whammy voiced for bass, with octave, interval, dive and detune modes.',
    }),
    DT({
      id: 'dt.freqout', name: 'Feedback Maker', ref: 'DigiTech FreqOut', code: 'FBK', logo: 'FEEDBACK', typeName: 'Natural feedback creator', cat: 'Pitch', color: '#d8d9d6', text: '#151515', accent: '#c0141b', band: '#c0141b', cost: 0.7,
      algo: 'pitch', fixed: { dry: 1, quality: 1 },
      controls: [K('level1', 'GAIN', { def: 0.45 }), K('glide', 'ONSET', { def: 0.6 }),
        SEL('fmode', 'MODE', ['SUB', '1ST', 'OCT', '5TH', '2ND'], { def: 2, sweep: 180, virtual: true })],
      derive: (p) => ({ semis1: [-12, 0, 12, 19, 24][p.fmode ?? 2], cents: (p.fmode ?? 2) === 1 ? 6 : 0 }),
      desc: 'Adds a feedback-like harmonic over held notes. ONSET sets how slowly it slides in (approximated with a gliding pitch voice).',
    }),
    DT({
      id: 'dt.luxe', name: 'Lux Detune', ref: 'DigiTech Luxe', code: 'LUX', logo: 'LUX', typeName: 'Polyphonic detune', cat: 'Modulation', color: '#7a2a8c', text: '#f6eefa', cost: 0.7,
      algo: 'pitch', fixed: { semis1: 0, dry: 1, quality: 1 }, stereo: 'both', monoPorts: MONO, stereoPorts: { ins: ['INPUT'], outs: ['OUTPUT L', 'OUTPUT R'] },
      controls: [K('cents', 'DETUNE', { min: 0, max: 30, def: 10 }), K('level1', 'LEVEL', { def: 0.6 }), TOG('dir', '', ['SHARP', 'FLAT'], { virtual: true })],
      derive: (p) => ({ cents: (p.dir ? -1 : 1) * (p.cents ?? 10) }),
      desc: 'Anti-chorus: a steady detuned copy for width without wobble.',
    }),
    DT({
      id: 'dt.venturavibe', name: 'Venture Vibe', ref: 'DigiTech Ventura Vibe', code: 'VV', logo: 'VENTURE', typeName: 'Rotary / vibe', cat: 'Modulation', color: '#2d6a3e', text: '#f1f7ee', stereo: 'both', cost: 0.8,
      algo: 'chain',
      opts: { chain: [{ prefix: 'v', algo: 'vibe' }, { prefix: 'r', algo: 'rotary', on: false, params: { mix: 1 } }] },
      controls: [K('speed', 'SPEED', { def: 0.4, virtual: true }), K('depth', 'DEPTH', { def: 0.7, virtual: true }), K('v.level', 'LEVEL', { def: 0.5 }),
        SEL('vmode', 'MODE', ['VIBE', 'CHORUS', 'ROTARY'], { def: 0, sweep: 140, virtual: true })],
      derive: (p) => {
        const m = p.vmode ?? 0, sp = p.speed ?? 0.4, dp = p.depth ?? 0.7;
        return { 'v.on': m < 2 ? 1 : 0, 'r.on': m === 2 ? 1 : 0, 'v.mode': m === 1 ? 0 : 1, 'v.speed': sp, 'v.intensity': dp, 'r.speed': sp > 0.5 ? 1 : 0, 'r.mix': dp };
      },
      desc: 'Vibe, chorus-vibe or rotary speaker. In ROTARY mode SPEED switches between slow and fast.',
    }),
    DT({
      id: 'dt.nautila', name: 'Nautilus', ref: 'DigiTech Nautila', code: 'NAUT', logo: 'NAUTILUS', logoSize: 17, typeName: 'Chorus / flanger', cat: 'Modulation', color: '#1f6f8b', text: '#effaff', stereo: 'both', cost: 1,
      algo: 'chain',
      opts: { chain: [{ prefix: 'c', algo: 'chorus', opts: { invertR: true }, params: { mix: 0.5 } }, { prefix: 'f', algo: 'flanger', on: false, params: { mix: 0.5 } }] },
      controls: [K('speed', 'SPEED', { def: 0.3, virtual: true }), K('depth', 'DEPTH', { def: 0.5, virtual: true }), K('emph', 'EMPHASIS', { def: 0.3, virtual: true }), K('mix', 'MIX', { def: 0.5, virtual: true }),
        SEL('voices', 'VOICES', ['2', '4', '6', '8'], { def: 1, sweep: 150, virtual: true }), TOG('nmode', '', ['CHO', 'FLG'], { virtual: true })],
      derive: (p) => {
        const fl = p.nmode ? 1 : 0, v = p.voices ?? 1;
        return { 'c.on': fl ? 0 : 1, 'f.on': fl, 'c.rate': p.speed ?? 0.3, 'f.speed': p.speed ?? 0.3, 'c.depth': p.depth ?? 0.5, 'f.width': p.depth ?? 0.5,
          'c.feedback': 0.6 * (p.emph ?? 0.3), 'f.regen': p.emph ?? 0.3, 'c.mix': p.mix ?? 0.5, 'f.mix': p.mix ?? 0.5, 'c.mode': v >= 2 ? 2 : 0 };
      },
      desc: 'Chorus or flanger with up to eight voices. EMPHASIS adds resonance.',
    }),
    DT({
      id: 'dt.mosaic', name: 'Mosaic Twelve', ref: 'DigiTech Mosaic', code: 'MOS-12', logo: 'MOSAIC', typeName: '12-string effect', cat: 'Pitch', color: '#e5dccb', text: '#151515', accent: '#b3141b', cost: 0.8,
      algo: 'pitch', fixed: { semis1: 12, semis2: 0, dry: 1, quality: 1, cents: 4 },
      controls: [K('level1', 'LEVEL', { def: 0.5 }), K('tone', 'TONE', { def: 0.7 }), TOG('mmode', '', ['12-STR', 'OCT'], { virtual: true })],
      derive: (p) => (p.mmode ? { level2: 0, cents: 0 } : { level2: 0.25 * (p.level1 ?? 0.5) }),
      desc: 'Adds the octave strings of a 12-string guitar.',
    }),
    DT({
      id: 'dt.dirtyrobot', name: 'Grimy Robot', ref: 'DigiTech Dirty Robot', code: 'GRIMY', logo: 'GRIMY BOT', logoSize: 16, typeName: 'Stereo mini synth', cat: 'Synth', color: '#9aa1a8', text: '#151515', band: '#1b1b1d', cost: 1, stereo: 'both',
      algo: 'synth', fixed: { sens: 0.5, mode: 7, level: -9 },
      controls: [K('wet', 'MIX', { def: 0.7 }), K('filter', 'START', { def: 0.3 }), K('reso', 'STOP', { def: 0.6 }), K('attack', 'TIME', { def: 0.3 }),
        SEL('voice', 'VOICE', ['V1', 'V2'], { def: 0, sweep: 80, virtual: true })],
      derive: (p) => ({ octave: p.voice ? -1 : 0, dry: 1 - (p.wet ?? 0.7) * 0.6 }),
      desc: 'Filter-sweep synth sounds. START and STOP set where the sweep begins and ends (approximated with filter and resonance).',
    }),
    // ---- Hardwire series
    HW({
      id: 'dt.cm2', name: 'Hardline Tube OD', ref: 'DigiTech Hardwire CM-2 Tube Overdrive', code: 'HL-OD2', logo: 'TUBE OD', typeName: 'Hardline overdrive', cat: 'Overdrive',
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 90, gainMinDb: 2, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 8000, levelMaxDb: 6,
        modes: [{}, { preEq: [{ type: 'hs', f: 2000, q: 0.7, db: 4 }] }] },
      fixed: { mid: 0.5 },
      controls: [K('level', 'LEVEL'), K('bass', 'LOW'), K('treble', 'HIGH'), K('gain', 'DRIVE', { def: 0.45 }), TOG('mode', '', ['WARM', 'BRIGHT'])],
    }),
    HW({
      id: 'dt.sc2', name: 'Hardline Valve Dist', ref: 'DigiTech Hardwire SC-2 Valve Distortion', code: 'HL-SC2', logo: 'VALVE DIST', logoSize: 16, typeName: 'Hardline distortion', cat: 'Distortion',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 12, bias: 0.25, preHp: 100, gainMinDb: 10, gainMaxDb: 48, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3000, postLp: 7500, levelMaxDb: 3,
        modes: [{}, { gainMaxDb: 54, postEq: [{ type: 'peak', f: 700, q: 0.7, db: -4 }] }] },
      fixed: { mid: 0.5 },
      controls: [K('level', 'LEVEL', { def: 0.36 }), K('bass', 'LOW'), K('treble', 'HIGH'), K('gain', 'GAIN', { def: 0.55 }), TOG('mode', '', ['1', '2'])],
    }),
    HW({
      id: 'dt.tl2', name: 'Hardline Metal', ref: 'DigiTech Hardwire TL-2 Metal Distortion', code: 'HL-TL2', logo: 'METAL', typeName: 'Hardline distortion', cat: 'Distortion',
      algo: 'drive', opts: { clip: 'si', stages: 3, stage2Db: 16, preHp: 120, gainMinDb: 18, gainMaxDb: 58, tone: 'eq3', eqRangeDb: 15, bassF: 100, midF: 800, trebleF: 3500, postLp: 7500, levelMaxDb: 0,
        modes: [{}, { postEq: [{ type: 'peak', f: 750, q: 0.7, db: -6 }] }] },
      controls: [K('level', 'LEVEL', { def: 0.33 }), K('bass', 'LOW', { def: 0.6 }), K('mid', 'MID', { def: 0.45 }), K('treble', 'HIGH', { def: 0.6 }), K('gain', 'GAIN', { def: 0.65 }), TOG('mode', '', ['TIGHT', 'SCOOP'])],
    }),
    HW({
      id: 'dt.rv7', name: 'Hardline Verb', ref: 'DigiTech Hardwire RV-7 Reverb', code: 'HL-RV7', logo: 'REVERB', typeName: 'Hardline stereo reverb', cat: 'Reverb', stereo: 'both', cost: 1.3,
      algo: 'reverb',
      controls: [K('mix', 'LEVEL', { def: 0.35 }), K('live', 'LIVELINESS', { def: 0.5, virtual: true }), K('decay', 'DECAY', { def: 0.5 }),
        SEL('type', 'TYPE', ['ROOM', 'SPRING', 'PLATE', 'HALL', 'MOD', 'REVERSE', 'HALO'], { def: 3, sweep: 270, virtual: true })],
      derive: (p) => { const l = p.live ?? 0.5; return { mode: [0, 3, 2, 1, 6, 9, 4][p.type ?? 3], tone: 0.3 + 0.6 * l, diffusion: 0.5 + 0.4 * l, predelay: 5 + 40 * l }; },
    }),
    HW({
      id: 'dt.cr7', name: 'Hardline Chorus', ref: 'DigiTech Hardwire CR-7 Stereo Chorus', code: 'HL-CR7', logo: 'CHORUS', typeName: 'Hardline stereo chorus', cat: 'Modulation', stereo: 'both',
      algo: 'chorus', opts: { invertR: true },
      controls: [K('mix', 'LEVEL', { def: 0.5 }), K('rate', 'SPEED', { def: 0.3 }), K('depth', 'DEPTH', { def: 0.5 }), K('tone', 'TONE', { def: 0.6 }),
        SEL('ctype', 'TYPE', ['CLASSIC', 'TRI', 'DIM', 'VIB'], { def: 0, sweep: 150, virtual: true })],
      derive: (p) => [{ mode: 0 }, { mode: 2 }, { mode: 3 }, { mode: 1, mix: 1 }][p.ctype ?? 0],
    }),
  ]);
}
