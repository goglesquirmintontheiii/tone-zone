// Built-in Tone Zone plugin: DigiTech.
// Blocks inspired by DigiTech gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.

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
  tz.addForm('dt-stomp', (ctx, d) => {
    const g = ctx.g, mini = d.mini;
    const w = mini ? 100 : 132, h = mini ? 184 : 236;
    const col = d.color, txt = d.text || '#f2f2f2';
    formKit.body(g, w, h, col, { rx: 7 });
    svg('rect', { x: 0, y: 0, width: w, height: mini ? 6 : 8, rx: 3, fill: d.accent || shade(col, -0.3), opacity: 0.9 }, g);
    const theme = { text: txt, knob: d.knob || 'boss', labelSize: 6 };
    const knobs = d.controls.filter((c) => c.t === 'knob' && c.x === undefined);
    const per = knobs.length > 4 ? Math.ceil(knobs.length / 2) : 4;
    for (let r = 0; r * per < knobs.length; r++) {
      const row = knobs.slice(r * per, r * per + per);
      row.forEach((k, i) => Object.assign(k, { x: row.length === 1 ? w / 2 : 22 + ((w - 44) * i) / (row.length - 1), y: 34 + r * 42, r: k.r || (mini ? 10 : 10.5), labelPos: 'above' }));
      knobs.forEach((k) => (k.labelPos = 'below'));
    }
    const rowsUsed = Math.ceil(knobs.length / per);
    const sel = d.controls.find((c) => c.t === 'sel' && c.x === undefined);
    const selY = 34 + rowsUsed * 42 + 6;
    if (sel) Object.assign(sel, { x: w / 2, y: selY, r: sel.r || 11, labelPos: 'none', optSize: sel.optSize || 4.3, labelRadius: sel.labelRadius || 6.5 });
    d.controls.filter((c) => c.t === 'toggle' && c.x === undefined).forEach((t, i) => Object.assign(t, { x: i ? w - 20 : 20, y: selY + 4, orient: 'v', optSize: 4.4, labelSide: i ? 'left' : 'right' }));
    const by = mini ? 90 : sel ? selY + 30 : 34 + rowsUsed * 42 + 6;
    const bh = mini ? 30 : 38;
    svg('rect', { x: 8, y: by, width: w - 16, height: bh, rx: 3, fill: d.band || '#0f0f10', opacity: 0.92 }, g);
    svg('rect', { x: 8, y: by, width: w - 16, height: bh * 0.45, rx: 3, fill: '#fff', opacity: 0.06 }, g);
    label(g, w / 2, by + bh * 0.42, d.logo, { size: d.logoSize || (mini ? 14 : 19), fill: d.logoColor || '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, by + bh - 7, (d.typeName || d.cat).toUpperCase(), { size: mini ? 4.4 : 5, fill: '#d0d0d0', weight: 700, ls: 1.4 });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    d.controls.forEach((c) => {
      if (c.t === 'foot' && c.x === undefined) Object.assign(c, { style: 'stomp', x: w / 2, y: h - (mini ? 34 : 40), r: mini ? 11 : 12.5 });
      if (c.t === 'led' && c.x === undefined) Object.assign(c, { x: w / 2, y: h - (mini ? 62 : 70), r: 2.8 });
    });
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: mini ? 44 : 52, gap: 26, flip: ctx.flip }) };
  });
  const DT = (o) => def(Object.assign({ form: 'dt-stomp', brand: 'DigiTech' }, o, { controls: [...o.controls, ...(o.noStd ? [] : STD(o.led || '#ff2a1a'))] }));

  // Whammy-style modes: [name, heel semis, toe semis, kind] — kind w = whammy (wet only), d = detune, h = harmony (dry + voice)
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
      desc: 'Polyphonic drop tune 1–7 semitones, octave, octave+dry. MOMENTARY ON = active only while the footswitch is held.',
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
      desc: '21 modes: Whammy (treadle sweeps from dry pitch to the interval), Detune (shallow / deep doubling) and Harmony (dry + a voice that moves between two intervals). CLASSIC = fastest tracking for single notes, CHORDS = polyphonic. Click the treadle to bypass.',
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
      controls: [K('level', 'LEVEL', { def: 0.45 }), K('bass', 'LOW'), K('treble', 'HIGH'), K('gain', 'GRUNGE', { def: 0.6 })],
    }),
    DT({
      id: 'dt.deathmetal', name: 'Doom Metal', ref: 'DigiTech Death Metal', code: 'DOOM METAL', logo: 'DOOM METAL', logoSize: 16, typeName: 'Distortion', cat: 'Distortion', color: '#1c1c1c', accent: '#b3141b', band: '#7a0d10',
      algo: 'drive', opts: { clip: 'si', stages: 3, stage2Db: 16, preHp: 110, gainMinDb: 20, gainMaxDb: 60, tone: 'eq3', eqRangeDb: 15, bassF: 100, midF: 750, trebleF: 3500, postLp: 7000, levelMaxDb: 0 },
      controls: [K('level', 'LEVEL', { def: 0.45 }), K('bass', 'LOW', { def: 0.6 }), K('mid', 'MID', { def: 0.35 }), K('treble', 'HIGH', { def: 0.6 }), K('gain', 'DISTORTION', { def: 0.7 })],
    }),
  ]);
}
