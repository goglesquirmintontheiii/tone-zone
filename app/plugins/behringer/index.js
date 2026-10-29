// Built-in Tone Zone plugin: Behringer.
// Blocks inspired by Behringer gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
//
// Custom form `bh-stomp`: the shiny moulded-plastic compact: narrow knob deck, a pedal flap with a rounded lower
// edge, the printed model code, a glossy highlight streak and the ridged battery door at the toe. One or two knob
// rows (V-Tone units), optional toggle row, screen (tuner) and a custom A/B LED screen.
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, SCREEN, SLIDER, TREADLE, def, ten, db, ms, MONO, STEREO, MONO_TO_ST } = tz.helpers;
  const { svg, label, formKit, softShadow, luminance, textColorFor, haloFill, shade } = tz.gfx;

  const spread = (list, x0, x1, y) => list.forEach((c, i) => {
    c.x = list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1);
    c.y = y;
  });

  tz.addForm('bh-stomp', (ctx, d) => {
    const w = 140, h = 252, py = 110;
    const g = ctx.g;
    const col = d.color, txt = d.text || textColorFor(col);
    const dark = luminance(col) < 0.45;
    const shape = `M11 0 H${w - 11} Q${w} 0 ${w} 11 V${h - 30} Q${w} ${h} ${w - 30} ${h} H30 Q0 ${h} 0 ${h - 30} V11 Q0 0 11 0 Z`;
    softShadow(g, { w, h, path: shape, dy: 14, blur: 9, opacity: 0.6 });
    svg('path', { d: shape, fill: col }, g);
    svg('path', { d: shape, fill: 'url(#p-grain)', opacity: 0.6 }, g);
    svg('path', { d: shape, fill: 'url(#g-shadeV)' }, g);
    svg('path', { d: shape, fill: 'url(#g-shadeH)', opacity: 0.8 }, g);
    svg('path', { d: shape, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, g);
    // moulded knob deck (slightly recessed) and the hinge gap of the pedal flap
    svg('rect', { x: 7, y: 7, width: w - 14, height: py - 14, rx: 6, fill: '#000', opacity: 0.07 }, g);
    svg('rect', { x: 7.5, y: 7.5, width: w - 15, height: py - 15, rx: 5.5, fill: 'none', stroke: '#000', 'stroke-opacity': 0.18 }, g);
    svg('path', { d: `M5 ${py - 2} H${w - 5}`, stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 2.4 }, g);
    const flap = `M8 ${py + 1} H${w - 8} V${h - 32} Q${w - 8} ${h - 7} ${w - 32} ${h - 7} H32 Q8 ${h - 7} 8 ${h - 32} Z`;
    svg('path', { d: flap, fill: col }, g);
    svg('path', { d: flap, fill: 'url(#g-shadeV)', opacity: 0.9 }, g);
    svg('path', { d: flap, fill: 'none', stroke: '#fff', 'stroke-opacity': dark ? 0.16 : 0.35, 'stroke-width': 1 }, g);
    // glossy plastic streak
    svg('path', { d: `M${w * 0.58} ${py + 3} L${w * 0.78} ${py + 3} L${w * 0.36} ${h - 10} L${w * 0.16} ${h - 10} Z`, fill: '#fff', opacity: dark ? 0.05 : 0.13 }, g);
    svg('path', { d: `M14 4.5 H${w - 14}`, stroke: '#fff', 'stroke-opacity': dark ? 0.2 : 0.55, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
    // model code + name printed on the flap
    const ink = d.labelText || txt;
    label(g, w / 2, py + 26, d.code, { size: 21, fill: d.codeColor || ink, weight: 800, italic: true, font: "'Barlow Condensed', sans-serif", ls: 1 });
    svg('rect', { x: 24, y: py + 39, width: w - 48, height: 1, fill: ink, opacity: 0.55 }, g);
    label(g, w / 2, py + 48, (d.typeName || d.name).toUpperCase(), { size: (d.typeName || '').length > 22 ? 5.6 : 6.6, fill: ink, weight: 700, font: "'Barlow Condensed', sans-serif", ls: 1 });
    formKit.tzBadge(g, w / 2, py + 62, ink, 4.4);
    // ridged battery door at the toe
    const by = h - 58;
    svg('path', { d: `M30 ${by} H${w - 30} Q${w - 22} ${by} ${w - 22} ${by + 8} V${by + 30} Q${w - 22} ${by + 40} ${w - 34} ${by + 40} H34 Q22 ${by + 40} 22 ${by + 30} V${by + 8} Q22 ${by} 30 ${by} Z`, fill: '#000', opacity: 0.1, stroke: '#000', 'stroke-opacity': 0.3, 'stroke-width': 0.7 }, g);
    for (let i = 0; i < 7; i++) {
      const y = by + 6 + i * 4.4;
      svg('line', { x1: 32, x2: w - 32, y1: y, y2: y, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 1.1 }, g);
      svg('line', { x1: 32, x2: w - 32, y1: y + 1.2, y2: y + 1.2, stroke: '#fff', 'stroke-opacity': dark ? 0.1 : 0.3, 'stroke-width': 0.7 }, g);
    }
    // controls
    const theme = { text: txt, knob: d.knob || 'mxr', labelFont: "'Barlow Condensed', sans-serif", labelSize: 6.8, labelLs: 0.4, toggleTitles: true };
    const knobs = d.controls.filter((c) => c.t === 'knob' || c.t === 'sel');
    const toggles = d.controls.filter((c) => c.t === 'toggle');
    const n = knobs.length;
    const two = n > 4 || (n && toggles.length >= 2);
    if (two) {
      const all = [...knobs, ...toggles];
      const a = all.slice(0, Math.ceil(all.length / 2)), b = all.slice(Math.ceil(all.length / 2));
      spread(a, a.length >= 4 ? 22 : 30, w - (a.length >= 4 ? 22 : 30), 30);
      spread(b, b.length >= 4 ? 22 : 30, w - (b.length >= 4 ? 22 : 30), 74);
      knobs.forEach((k) => { k.r = a.length >= 4 ? 9.5 : 10; k.labelPos = 'below'; k.labelSize = 6.2; });
      toggles.forEach((t) => { if (b.includes(t)) t.y = 78; });
    } else {
      const y = toggles.length ? 46 : 54;
      const lastSel = n && knobs[n - 1].t === 'sel' && knobs[n - 1].options.length > 4;
      spread(knobs, (n >= 4 ? 22 : 30) - (lastSel ? 2 : 0), w - (n >= 4 ? 22 : 30) - (lastSel ? 8 : 0), y);
      knobs.forEach((k) => { k.r = n >= 4 ? 11 : 12.5; k.labelPos = 'above'; });
      if (lastSel) { const s = knobs[n - 1]; s.labelRadius = s.labelRadius ?? 7.5; s.optSize = Math.min(s.optSize || 5, s.options.length > 7 ? 3.8 : 4.3); }
      if (toggles.length) spread(toggles, toggles.length === 1 ? w / 2 : 30, toggles.length === 1 ? w / 2 : w - 30, 88);
    }
    toggles.forEach((t) => (t.orient = 'h'));
    d.controls.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, { style: 'plate', x: w / 2, y: (py + h) / 2, w: w - 16, h: h - py - 10 });
      if (c.t === 'led') Object.assign(c, two ? { x: w - 15, y: 13, r: 2.6 } : { x: w / 2, y: 14, r: 2.8 });
      if (c.t === 'screen') Object.assign(c, { x: w / 2, y: c.kind === 'bh-ab' ? 60 : 56, w: c.kind === 'bh-ab' ? 96 : w - 30, h: c.kind === 'bh-ab' ? 40 : 52 });
    });
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: two ? 122 : d.controls.some((c) => c.t === 'screen' && c.kind === 'tu3') ? 94 : 80, gap: 20 }) };
  });

  // two status LEDs (A / B) for the A/B switch, following the `select` param
  tz.addScreen('bh-ab', {
    build(s, g, w, h) {
      s.leds = [0, 1].map((i) => {
        const x = w * (i ? 0.72 : 0.28), y = h / 2 - 4;
        svg('circle', { cx: x, cy: y, r: 4.6, fill: 'url(#g-chrome)' }, g);
        const halo = svg('circle', { cx: x, cy: y, r: 11, fill: haloFill(i ? '#3ddc84' : '#ff2a1a'), 'fill-opacity': 0 }, g);
        const lens = svg('circle', { cx: x, cy: y, r: 3.4, fill: '#300' }, g);
        svg('circle', { cx: x, cy: y, r: 3.2, fill: 'url(#g-ledLens)' }, g);
        label(g, x, y + 12, i ? 'B' : 'A', { size: 8, fill: s.ctl.textColor || '#111', weight: 800 });
        return { lens, halo, on: i ? '#3ddc84' : '#ff2a1a', off: i ? '#0c2a18' : '#2a0a0a' };
      });
    },
    update(s, st, nv) {
      const sel = Math.round(nv.block.params.select ?? 0);
      s.leds.forEach((l, i) => {
        const on = sel === i || sel === 2;
        l.lens.setAttribute('fill', on ? l.on : l.off);
        l.halo.setAttribute('fill-opacity', on ? 0.9 : 0);
      });
    },
  });

  const BH = (o) => def(Object.assign({ form: 'bh-stomp', brand: 'Behringer' }, o, {
    controls: [...(o.controls || []), ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
  const lvl = () => k('level', 'LEVEL');

  tz.addDefs([
    // ---------------------------------------------------------------- drives
    BH({
      id: 'bh.to800', name: 'TD800 Vintage Tube Drive', ref: 'Behringer TO800 Vintage Tube Overdrive', code: 'TD800', typeName: 'Vintage Tube Drive', cat: 'Overdrive', color: '#4f9d3a', text: '#0e1a0a',
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 42, tone: 'ts', toneLo: 723, postLp: 6000, levelMaxDb: 6 },
      controls: [lvl(), k('tone', 'TONE'), k('gain', 'DRIVE')],
    }),
    BH({
      id: 'bh.bo100', name: 'BL100 Blues Drive', ref: 'Behringer BO100 Blues Overdrive', code: 'BL100', typeName: 'Blues Drive', cat: 'Overdrive', color: '#2367b8', text: '#08121f',
      algo: 'drive', opts: { clip: 'jfet', bias: 0.2, preHp: 50, gainMinDb: 0, gainMaxDb: 40, tone: 'tilt', trebleF: 1800, bassF: 160, eqRangeDb: 9, postLp: 9500, levelMaxDb: 8, cleanSum: true, cleanMix: 0.25 },
      controls: [lvl(), k('tone', 'TONE'), k('gain', 'GAIN')],
    }),
    BH({
      id: 'bh.sd300', name: 'SX300 Super Distortion', ref: 'Behringer SD300 Distortion', code: 'SX300', typeName: 'Super Distortion', cat: 'Distortion', color: '#f07a1e', text: '#1f0d02',
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 44, clipLp: 9000, tone: 'blend', blendLp: 650, blendHp: 1150, postLp: 7500, levelMaxDb: 6 },
      controls: [lvl(), k('tone', 'TONE'), k('gain', 'DIST')],
    }),
    BH({
      id: 'bh.vd1', name: 'VX1 Vintage Distortion', ref: 'Behringer VD1 Vintage Distortion', code: 'VX1', typeName: 'Vintage Distortion', cat: 'Distortion', color: '#1f1f21', text: '#efefef',
      algo: 'drive', opts: { clip: 'diode', preHp: 60, gainMinDb: 10, gainMaxDb: 50, tone: 'rat', postLp: 9000, levelMaxDb: -1 },
      controls: [k('gain', 'DISTORTION'), k('tone', 'FILTER'), k('level', 'VOLUME')],
      desc: 'Op-amp + hard-clipping distortion with the reversed FILTER control of the classic rodent.',
    }),
    BH({
      id: 'bh.hm300', name: 'MH300 Heavy Metal', ref: 'Behringer HM300 Heavy Metal', code: 'MH300', typeName: 'Heavy Metal', cat: 'Distortion', color: '#19191b', text: '#f28c28', codeColor: '#f28c28',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 10, preHp: 60, gainMinDb: 14, gainMaxDb: 50, tone: 'hm2', postLp: 8000, levelMaxDb: -3 },
      fixed: { mid: 0.85 },
      controls: [lvl(), k('bass', 'LOW'), k('treble', 'HIGH'), k('gain', 'DIST')],
      desc: 'Max LOW and HIGH for the chainsaw tone.',
    }),
    BH({
      id: 'bh.sf300', name: 'SZ300 Super Fuzz', ref: 'Behringer SF300 Super Fuzz', code: 'SZ300', typeName: 'Super Fuzz', cat: 'Fuzz', color: '#f2b01c', text: '#1f1502',
      algo: 'drive', opts: { clip: 'si', bias: 0.3, preHp: 70, gainMinDb: 14, gainMaxDb: 48, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 7000, levelMaxDb: -4,
        modes: [{ clip: 'si', gainMinDb: 0, gainMaxDb: 22, bias: 0.1 }, { clip: 'si' }, { clip: 'ge', bias: 0.4, preEq: [{ type: 'peak', f: 800, q: 0.7, db: -5 }] }] },
      fixed: { mid: 0.5 },
      controls: [lvl(), k('bass', 'LOW'), k('treble', 'HIGH'), k('gain', 'GAIN', { def: 0.6 }), TOG('mode', 'MODE', ['BOOST', 'FUZZ1', 'FUZZ2'], { def: 1 })],
    }),

    // ---------------------------------------------------------------- dynamics
    BH({
      id: 'bh.cs400', name: 'CP400 Compressor', ref: 'Behringer CS400 Compressor/Sustainer', code: 'CP400', typeName: 'Compressor / Sustainer', cat: 'Dynamics', color: '#1f9ad6', text: '#04151f',
      algo: 'comp', opts: { type: 'vca' }, fixed: { ratio: 0.6 },
      controls: [k('level', 'LEVEL', { def: 0.42 }), k('tone', 'TONE'), k('attack', 'ATTACK', { def: 0.35 }), k('sustain', 'SUSTAIN', { def: 0.55 })],
    }),
    BH({
      id: 'bh.nr300', name: 'NQ300 Noise Reducer', ref: 'Behringer NR300 Noise Reducer', code: 'NQ300', typeName: 'Noise Reducer', cat: 'Dynamics', color: '#d6d8da', text: '#151515',
      algo: 'gate', ports: { ins: ['INPUT', 'RETURN'], outs: ['OUTPUT', 'SEND'] },
      controls: [k('threshold', 'THRESHOLD', { def: 0.4 }), k('decay', 'DECAY', { def: 0.4 }), SEL('mode', 'MODE', ['REDUCTION', 'MUTE'], { sweep: 70, optSize: 4.4 })],
      desc: 'Patch other pedals into SEND / RETURN, detection stays on INPUT.',
    }),

    // ---------------------------------------------------------------- modulation
    BH({
      id: 'bh.uc200', name: 'UH200 Ultra Chorus', ref: 'Behringer UC200 Ultra Chorus', code: 'UH200', typeName: 'Ultra Chorus', cat: 'Modulation', color: '#58b6e0', text: '#04141c',
      algo: 'chorus', opts: { style: 'bbd', invertR: true }, ports: { ins: ['INPUT'], outs: ['OUT A', 'OUT B'] }, stereo: 'fixed',
      controls: [k('mix', 'LEVEL', { def: 0.55 }), k('tone', 'EQ'), k('rate', 'RATE', { def: 0.3 }), k('depth', 'DEPTH', { def: 0.5 })],
    }),
    BH({
      id: 'bh.uf300', name: 'UL300 Ultra Flanger', ref: 'Behringer UF300 Ultra Flanger', code: 'UL300', typeName: 'Ultra Flanger', cat: 'Modulation', color: '#6b4ea0', text: '#f2ecff',
      algo: 'flanger', stereo: 'both',
      controls: [k('manual', 'MANUAL', { def: 0.5 }), k('width', 'DEPTH', { def: 0.6 }), k('speed', 'RATE', { def: 0.3 }), k('regen', 'RES', { def: 0.55 })],
    }),
    BH({
      id: 'bh.vp1', name: 'VF1 Vintage Phaser', ref: 'Behringer VP1 Vintage Phaser', code: 'VF1', typeName: 'Vintage Phaser', cat: 'Modulation', color: '#f26a1b', text: '#1f0b02',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.85, mix: 0.5 },
      controls: [k('rate', 'SPEED', { def: 0.35 }), TOG('vmode', 'MODE', ['VINTAGE', 'MODERN'])],
      derive: (p) => ({ feedback: p.vmode ? 0.55 : 0.2 }),
      desc: 'Four-stage phaser: VINTAGE is the smooth early script voicing, MODERN adds resonance.',
    }),
    BH({
      id: 'bh.ut300', name: 'UM300 Ultra Tremolo', ref: 'Behringer UT300 Ultra Tremolo', code: 'UM300', typeName: 'Ultra Tremolo', cat: 'Modulation', color: '#2f8f4e', text: '#06180c',
      algo: 'tremolo', stereo: 'both',
      controls: [k('rate', 'RATE', { def: 0.45 }), k('wave', 'WAVE', { def: 0.25 }), k('depth', 'DEPTH', { def: 0.65 })],
    }),
    BH({
      id: 'bh.uv300', name: 'UB300 Ultra Vibrato', ref: 'Behringer UV300 Ultra Vibrato', code: 'UB300', typeName: 'Ultra Vibrato', cat: 'Modulation', color: '#3b5cc0', text: '#eef2ff',
      algo: 'chorus', opts: { style: 'bbd', baseMs: 4, depthMs: 3 }, fixed: { mode: 1 },
      controls: [k('rate', 'RATE', { def: 0.45 }), k('depth', 'DEPTH', { def: 0.5 }), k('delay', 'RISE TIME', { def: 0.3 }), TOG('latch', 'MODE', ['LATCH', 'UNLATCH'])],
      momentaryWhen: (p) => p.latch === 1,
      desc: 'Pitch vibrato. UNLATCH makes the pedal momentary (vibrato rises in with RISE TIME).',
    }),

    // ---------------------------------------------------------------- delays / reverb
    BH({
      id: 'bh.vd400', name: 'AE400 Vintage Analog Delay', ref: 'Behringer VD400 Vintage Analog Delay', code: 'AE400', typeName: 'Vintage Analog Delay', cat: 'Delay', color: '#c8262b', text: '#1a0405',
      algo: 'delay', opts: { maxMs: 400 }, fixed: { mode: 1, tone: 0.35 },
      controls: [k('dtime', 'REPEAT RATE', { def: 0.45, virtual: true }), k('mix', 'ECHO', { def: 0.45 }), k('feedback', 'INTENSITY', { def: 0.4, max: 1.05 })],
      derive: (p) => ({ time: 20 + 280 * (p.dtime ?? 0.45) }),
    }),
    BH({
      id: 'bh.dd400', name: 'DG400 Digital Delay', ref: 'Behringer DD400 Digital Delay', code: 'DG400', typeName: 'Digital Delay', cat: 'Delay', color: '#ececea', text: '#111',
      algo: 'delay', opts: { maxMs: 1300 }, fixed: { mode: 0, tone: 0.75 },
      controls: [k('mix', 'E.LEVEL', { def: 0.45 }), k('feedback', 'F.BACK', { def: 0.35, max: 0.98 }), k('dtime', 'D.TIME', { def: 0.6, virtual: true }), SEL('range', 'MODE', ['S', 'M', 'L', 'HOLD'], { def: 2, sweep: 120 })],
      derive: (p) => { const r = [[12.5, 50], [50, 200], [200, 1300], [200, 1300]][p.range ?? 2]; return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.6) }; },
      holdWhen: (p) => p.range === 3,
    }),
    BH({
      id: 'bh.em600', name: 'EK600 Echo Machine', ref: 'Behringer EM600 Echo Machine', code: 'EK600', typeName: 'Echo Machine', cat: 'Delay', color: '#6e6658', text: '#f4efe4',
      algo: 'delay', opts: { maxMs: 1200 }, fixed: { mode: 2, tone: 0.5, age: 0.35, sat: 0.4 }, stereo: 'both',
      controls: [k('mix', 'LEVEL', { def: 0.4 }), k('feedback', 'FEEDBACK', { def: 0.4, max: 1.05 }), K('time', 'TIME', { min: 60, max: 1000, def: 330, display: ms }),
        SEL('heads', 'MODE', ['1', '2', '3', '1+2', '2+3', '1+3', 'ALL'], { values: [1, 2, 4, 3, 6, 5, 7], def: 0, sweep: 240 })],
      desc: 'Tape-echo simulation with a three-head mode selector (single heads or combinations).',
    }),
    BH({
      id: 'bh.rv600', name: 'RB600 Reverb Machine', ref: 'Behringer RV600 Reverb Machine', code: 'RB600', typeName: 'Reverb Machine', cat: 'Reverb', color: '#25407a', text: '#e9eef7',
      algo: 'reverb', stereo: 'stereo', ports: { ins: ['IN L', 'IN R'], outs: ['OUT L', 'OUT R'] },
      controls: [k('mix', 'LEVEL', { def: 0.38 }), k('tone', 'TONE', { def: 0.55 }), k('decay', 'TIME', { def: 0.5 }),
        SEL('mode', 'MODE', ['SPRING', 'PLATE', 'HALL', 'ROOM', 'GATE', 'MOD', 'SHIMMER'], { values: [3, 2, 1, 0, 7, 6, 4], def: 2, sweep: 240 })],
      desc: 'Seven reverbs. GATE uses the dynamic (ducking) engine as an approximation of a gated reverb.',
    }),

    // ---------------------------------------------------------------- V-Tone DI preamps / acoustic
    BH({
      id: 'bh.gdi21', name: 'GX21 Tube Amp Modeler', ref: 'Behringer V-Tone GDI21', code: 'GX21', typeName: 'Guitar Driver DI', cat: 'Preamp', color: '#232325', text: '#e6e6e6', codeColor: '#d9d9d9',
      algo: 'chain', cost: 2.4,
      opts: { chain: [
        { prefix: 'a', algo: 'amp', opts: { preamp: true, models: ['deluxe', 'plexi', 'recto'] } },
        { prefix: 'c', algo: 'cab', opts: { models: ['1x12us', '4x12gb', '4x12v30'] } },
      ] },
      controls: [K('a.level', 'LEVEL', { min: -30, max: 12, def: 0, display: db }), k('a.treble', 'HIGH'), k('a.bass', 'LOW'), k('drv', 'DRIVE', { def: 0.5, virtual: true }),
        TOG('a.channel', 'AMP', ['TW', 'BR', 'CA'], { values: [0, 1, 2], def: 1, optSize: 4.6 }), TOG('mod', 'MOD', ['CLN', 'HI', 'HOT'], { def: 1, optSize: 4.6 }), TOG('mic', 'MIC', ['CL', 'CTR', 'OFF'], { optSize: 4.6 })],
      derive: (p) => {
        const r = [[0.05, 0.45], [0.2, 0.8], [0.4, 1]][p.mod ?? 1];
        const m = p.mic ?? 0;
        return { 'a.gain': r[0] + (r[1] - r[0]) * (p.drv ?? 0.5), 'a.mid': 0.5, 'a.bright': p.mod === 2 ? 0.6 : 0, 'c.model': p['a.channel'] ?? 1, 'c.m1pos': [0.45, 0.1, 0.7][m], 'c.m1axis': m === 2 ? 1 : 0 };
      },
      desc: 'Analog-style amp + speaker simulator DI: three amp voicings (TW tweed, BR british, CA californian), three gain modes and three mic positions (classic, centre, off-axis).',
    }),
    BH({
      id: 'bh.bdi21', name: 'BX21 Bass Driver DI', ref: 'Behringer V-Tone BDI21', code: 'BX21', typeName: 'Bass Driver DI', cat: 'Preamp', color: '#8a8f96', text: '#0f1114', tags: ['bass'],
      algo: 'chain', cost: 1.3,
      opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'tube', bias: 0.15, preHp: 30, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 15, bassF: 80, midF: 500, trebleF: 2500, postLp: 9000, levelMaxDb: 14, cleanSum: false } },
        { prefix: 'c', algo: 'cab', opts: { model: '4x10bass' } },
      ] },
      controls: [k('d.level', 'LEVEL'), k('d.blend', 'BLEND', { def: 0.7 }), k('d.treble', 'TREBLE'), k('d.bass', 'BASS'), k('d.bright', 'PRESENCE', { def: 0.3 }), k('d.gain', 'DRIVE', { def: 0.4 })],
      initParams: { 'd.mid': 0.5 },
      desc: 'Tube-style bass preamp with speaker simulation and BLEND between clean and driven tone.',
    }),
    BH({
      id: 'bh.adi21', name: 'AX21 Acoustic Driver DI', ref: 'Behringer V-Tone ADI21', code: 'AX21', typeName: 'Acoustic Driver DI', cat: 'Acoustic', color: '#b98a52', text: '#1e1308',
      algo: 'acoustic', opts: { mode: 2, type: 0 }, fixed: { mode: 2 },
      controls: [K('level', 'LEVEL', { min: -24, max: 12, def: 0, display: db }), k('mix', 'BLEND', { def: 0.85 }), k('saturate', 'DRIVE', { def: 0.15 }),
        k('treble', 'TREBLE'), k('mid', 'MIDDLE'), k('bass', 'BASS'), TOG('midfreq', 'MID SHIFT', ['LO', 'HI'], { values: [0.3, 0.7] })],
      desc: 'Acoustic preamp / DI with tube-style drive, three-band EQ with mid shift and dry blend.',
    }),

    // ---------------------------------------------------------------- multi
    BH({
      id: 'bh.fx600', name: 'MF600 Digital Multi-FX', ref: 'Behringer FX600 Digital Multi-FX', code: 'MF600', typeName: 'Digital Multi-FX', cat: 'Multi-FX', kind: 'Multi-FX', color: '#3a3f9a', text: '#eef0ff',
      algo: 'chain', stereo: 'both', cost: 1.6,
      opts: { chain: [
        { prefix: 'ch', algo: 'chorus' }, { prefix: 'fl', algo: 'flanger', on: false }, { prefix: 'ph', algo: 'phaser', on: false },
        { prefix: 'tr', algo: 'tremolo', on: false }, { prefix: 'dl', algo: 'delay', on: false, opts: { maxMs: 1000 } }, { prefix: 'ps', algo: 'pitch', on: false, params: { quality: 1 } },
      ] },
      controls: [k('lv', 'LEVEL', { def: 0.5, virtual: true }), k('rt', 'RATE', { def: 0.4, virtual: true }), k('dp', 'DEPTH', { def: 0.5, virtual: true }),
        SEL('fx', 'MODE', ['CHO', 'FLG', 'PHA', 'TRM', 'DLY', 'PIT'], { def: 0, sweep: 220 })],
      derive: (p) => {
        const fx = p.fx ?? 0, lv = p.lv ?? 0.5, rt = p.rt ?? 0.4, dp = p.dp ?? 0.5;
        const o = {};
        ['ch', 'fl', 'ph', 'tr', 'dl', 'ps'].forEach((x, i) => (o[x + '.on'] = fx === i ? 1 : 0));
        Object.assign(o, { 'ch.mix': lv, 'ch.rate': rt, 'ch.depth': dp, 'fl.mix': lv, 'fl.speed': rt, 'fl.width': dp, 'fl.regen': 0.5, 'ph.mix': lv, 'ph.rate': rt, 'ph.depth': dp,
          'tr.level': 0.5, 'tr.rate': rt, 'tr.depth': Math.min(1, dp * 0.6 + lv * 0.5), 'dl.mix': lv * 0.8, 'dl.time': 40 + 960 * rt, 'dl.feedback': dp * 0.9,
          'ps.level1': lv, 'ps.dry': 0.85, 'ps.semis1': Math.round(-12 + 24 * dp), 'ps.cents': (rt - 0.5) * 30 });
        return o;
      },
      desc: 'Six effects on one knob: chorus, flanger, phaser, tremolo, delay and pitch shifter (DEPTH sets the interval, RATE fine-detunes).',
    }),

    // ---------------------------------------------------------------- more drives / bass
    BH({
      id: 'bh.od300', name: 'DO300 Overdrive/Distortion', ref: 'Behringer OD300 Overdrive/Distortion', code: 'DO300', typeName: 'Overdrive / Distortion', cat: 'Overdrive', color: '#f2c21b', text: '#1f1802',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, cleanSum: true, clipHp: 700, gainMinDb: 2, gainMaxDb: 38, tone: 'ts', toneLo: 700, postLp: 5600, levelMaxDb: 6,
        modes: [{}, { clip: 'diode', cleanSum: false, preHp: 90, gainMinDb: 8, gainMaxDb: 46, tone: 'blend', blendLp: 650, blendHp: 1150, postLp: 7500, levelMaxDb: 4, outTrim: 0.5 }] },
      controls: [lvl(), k('tone', 'TONE'), k('gain', 'DRIVE'), SEL('mode', 'MODE', ['OD', 'DS'], { sweep: 70, optSize: 5 })],
      desc: 'Two pedals in one: OD is a smooth overdrive, DS a crunchy distortion.',
    }),
    BH({
      id: 'bh.bod400', name: 'BDO400 Bass Overdrive', ref: 'Behringer BOD400 Bass Overdrive', code: 'BDO400', typeName: 'Bass Overdrive', cat: 'Overdrive', color: '#a8c43a', text: '#141c03', tags: ['bass'],
      algo: 'drive', opts: { clip: 'asym', bias: 0.15, preHp: 30, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 90, midF: 600, trebleF: 2500, postLp: 7000, levelMaxDb: 8 },
      fixed: { mid: 0.5 },
      controls: [lvl(), k('blend', 'BALANCE', { def: 0.6 }), k('bass', 'BASS'), k('treble', 'TREBLE'), k('gain', 'GAIN', { def: 0.45 })],
      desc: 'Bass overdrive. BALANCE mixes the clean low end back in.',
    }),

    // ---------------------------------------------------------------- more modulation / pitch
    BH({
      id: 'bh.co600', name: 'OC600 Chorus Orchestra', ref: 'Behringer CO600 Chorus Orchestra', code: 'OC600', typeName: 'Chorus Orchestra', cat: 'Modulation', color: '#6cc3e6', text: '#03161f',
      algo: 'chorus', opts: { style: 'bbd' }, ports: { ins: ['INPUT'], outs: ['OUT A', 'OUT B'] }, stereo: 'fixed',
      controls: [k('mix', 'LEVEL', { def: 0.5 }), k('tone', 'EQ'), k('rate', 'RATE', { def: 0.3 }), k('depth', 'DEPTH', { def: 0.5 })],
      desc: 'Wide stereo chorus in the style of the classic blue compact.',
    }),
    BH({
      id: 'bh.uo300', name: 'OU300 Ultra Octaver', ref: 'Behringer UO300 Ultra Octaver', code: 'OU300', typeName: 'Ultra Octaver', cat: 'Pitch', color: '#3f5fb8', text: '#eef2ff',
      algo: 'pitch', cost: 1, fixed: { semis1: -12, semis2: -24, level3: 0, quality: 0, tone: 0.6 },
      controls: [k('level2', 'OCT 2', { def: 0.3 }), k('level1', 'OCT 1', { def: 0.6 }), k('dry', 'DIRECT', { def: 0.8 }), TOG('octup', 'MODE', ['DOWN', 'UP'])],
      derive: (p) => ({ semis1: p.octup ? 12 : -12, semis2: p.octup ? -12 : -24 }),
      desc: 'Analog-style octave divider: one and two octaves down. UP swaps OCT 1 for an octave up.',
    }),
    BH({
      id: 'bh.us600', name: 'SU600 Ultra Shifter/Harmonist', ref: 'Behringer US600 Ultra Shifter/Harmonist', code: 'SU600', typeName: 'Ultra Shifter / Harmonist', cat: 'Pitch', color: '#8b72c6', text: '#f4f0ff',
      algo: 'pitch', cost: 1, fixed: { level2: 0, level3: 0, quality: 1, tone: 0.9 },
      controls: [k('mix', 'BALANCE', { def: 0.5, virtual: true }), K('semis1', 'SHIFT', { min: -12, max: 12, step: 1, def: 7, display: (v) => (v > 0 ? '+' : '') + Math.round(v) }),
        K('cents', 'FINE', { min: -50, max: 50, def: 0, display: (v) => Math.round(v) + ' ct' }), SEL('mode', 'MODE', ['SHIFT', 'DETUNE'], { sweep: 70, optSize: 4.6 })],
      derive: (p) => { const m = p.mix ?? 0.5; return { level1: Math.min(1, m * 2) * 0.75, dry: Math.min(1, (1 - m) * 2) * 0.75, semis1: p.mode === 1 ? 0 : p.semis1 ?? 7, cents: p.mode === 1 ? (p.cents ?? 0) || 12 : p.cents ?? 0 }; },
      desc: 'Pitch shifter: SHIFT up to an octave either way, FINE for detune. DETUNE mode adds a thickening voice.',
    }),
    BH({
      id: 'bh.tp300', name: 'PT300 Tremolo/Pan', ref: 'Behringer TP300 Tremolo/Panner', code: 'PT300', typeName: 'Tremolo / Panner', cat: 'Modulation', color: '#1f7fa6', text: '#eaf7ff',
      algo: 'tremolo', stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUT A', 'OUT B'] },
      controls: [k('rate', 'RATE', { def: 0.45 }), k('depth', 'DEPTH', { def: 0.65 }), k('wave', 'WAVE', { def: 0.3 }), SEL('stereo', 'MODE', ['TREM', 'PAN'], { sweep: 70, optSize: 4.6 })],
      desc: 'Tremolo, or an auto-panner across the two outputs.',
    }),
    BH({
      id: 'bh.vm1', name: 'TM1 Vintage Time Machine', ref: 'Behringer VM1 Vintage Time Machine', code: 'TM1', typeName: 'Analog Delay / Chorus', cat: 'Delay', color: '#b9bcc1', text: '#121315',
      algo: 'delay', opts: { maxMs: 550 }, fixed: { mode: 1, tone: 0.33, modrate: 0.35 }, ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DIRECT'] }, stereo: 'fixed',
      controls: [k('level', 'LEVEL', { def: 0.5 }), k('mix', 'BLEND', { def: 0.45 }), k('feedback', 'FEEDBACK', { def: 0.4, max: 1.05 }), K('time', 'DELAY', { min: 30, max: 550, def: 300, display: ms }), TOG('mod', 'MOD', ['CHO', 'VIB'])],
      derive: (p) => ({ moddepth: p.mod ? 0.55 : 0.25, modrate: p.mod ? 0.55 : 0.3 }),
      desc: 'Analog delay with a built-in chorus / vibrato on the repeats, in the style of the famous memory echo.',
    }),
    BH({
      id: 'bh.sm200', name: 'SW200 Slow Motion', ref: 'Behringer SM200 Slow Motion', code: 'SW200', typeName: 'Slow Motion', cat: 'Volume', color: '#54a6d6', text: '#04131c',
      algo: 'swell', fixed: { level: 3.5 },
      controls: [k('sens', 'SENS', { def: 0.5 }), k('attack', 'ATTACK', { def: 0.45 })],
      desc: 'Fades every note in like a volume swell.',
    }),

    // ---------------------------------------------------------------- graphic EQs (7 sliders + level)
    ...[['bh.eq700', 'QE700 Graphic Equalizer', 'Behringer EQ700 Graphic Equalizer', 'QE700', 'Graphic Equalizer', '#e9e9e7', '#151515', [100, 200, 400, 800, 1600, 3200, 6400], ['100', '200', '400', '800', '1.6k', '3.2k', '6.4k'], []],
      ['bh.beq700', 'QB700 Bass Graphic EQ', 'Behringer BEQ700 Bass Graphic Equalizer', 'QB700', 'Bass Graphic EQ', '#252528', '#e9e9e9', [50, 120, 400, 500, 800, 4500, 10000], ['50', '120', '400', '500', '800', '4.5k', '10k'], ['bass']]]
      .map(([id, name, ref, code, typeName, color, text, freqs, labs, tags]) => BH({
        id, name, ref, code, typeName, cat: 'EQ', color, text, tags,
        algo: 'geq', opts: { freqs, q: 1.1 },
        controls: [...labs.map((l, i) => SLIDER('b' + i, l, { min: -15, max: 15, def: 0, x: 24 + i * 13.2, y: 54, h: 56, w: 6, marks: false, labelSize: 4.4, display: db })),
          SLIDER('level', 'LVL', { min: -15, max: 15, def: 0, x: 124, y: 54, h: 56, w: 6, marks: false, labelSize: 4.4, display: db, capColor: '#c8262b' })],
        desc: 'Seven-band graphic EQ with +/-15 dB per band and a level slider.',
      })),

    // ---------------------------------------------------------------- wah
    def({
      id: 'bh.hb01', name: 'HL01 Hell Child Wah', ref: 'Behringer HB01 Hellbabe', brand: 'Behringer', code: 'HL01', cat: 'Wah', form: 'treadle', color: '#151517', treadleColor: '#2a2a2d', text: '#f28c28',
      algo: 'wah', opts: { fLo: 380, fHi: 2400, q: 4.5, mode: 0 },
      controls: [TREADLE('pos', { def: 0.5 }), LED({ color: '#ff2a1a', r: 2.2 })],
      logo: 'Hell Child', logoColor: '#f28c28', logoFont: "'Oswald', sans-serif", toeSwitch: true,
      desc: 'Optical wah. Drag the treadle (heel to toe); click it without dragging to switch it on or off.',
    }),

    // ---------------------------------------------------------------- utilities
    BH({
      id: 'bh.tm300', name: 'TN300 Chromatic Tuner', ref: 'Behringer TM300 Chromatic Tuner', code: 'TN300', typeName: 'Chromatic Tuner', cat: 'Utility', kind: 'Utility', color: '#262628', text: '#efefef', noStd: true,
      algo: 'tuner', opts: { mute: 1 }, ports: { ins: ['INPUT'], outs: ['OUTPUT', 'BYPASS'] },
      controls: [SCREEN('tu3'), FOOT(), LED({ bind: 'tunerOk', color: '#3ddc84' })],
      defaultBypass: true, tunerBlock: true,
      desc: 'Pedal engages the tuner (OUTPUT muted). BYPASS jack always passes the signal.',
    }),
    BH({
      id: 'bh.ab100', name: 'SW100 A/B Switch', ref: 'Behringer AB100 A/B Switch', code: 'SW100', typeName: 'A/B Switch', cat: 'Utility', kind: 'Utility', color: '#a7acb2', text: '#121315', noStd: true,
      algo: 'utility', opts: { kind: 'split' }, ports: { ins: ['INPUT'], outs: ['OUT A', 'OUT B'] }, alwaysOn: true, cost: 0.02,
      controls: [SCREEN('bh-ab', { bg: 'transparent', bezel: 'transparent', textColor: '#121315' }), FOOT({ action: 'toggle', p: 'select', def: 0 })],
      initParams: { select: 0 },
      desc: 'Press the pedal to send the signal to amp A or amp B.',
    }),
  ]);
}
