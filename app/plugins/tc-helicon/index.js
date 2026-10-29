// Built-in Tone Zone plugin: TC-Helicon.
// Vocal processors inspired by TC-Helicon gear. Names and logos are Tone Zone originals; layouts, colours and
// jacks follow the real units (see each block's `ref`).
// One form (`tch-unit`) draws every enclosure; each family builder below places its controls.
// Engine mapping: harmony = diatonic pitch voices, doubling = doubletracker, correction = pitch at 0 semitones
// with glide, tone = compressor + EQ. Units with a guitar input run the voice on channel 1 and the guitar on
// channel 2, then mix both to the XLR outs.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, def, ten, ms } = tz.helpers;
  const { svg, label, setText, formKit } = tz.gfx;
  const BRAND = 'TC-Helicon';
  const k = (p, lab, o = {}) => K(p, lab, Object.assign({ display: ten }, o));
  const at = (c, x, y, o = {}) => Object.assign(c, { x, y }, o);
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // ------------------------------------------------------------------ screen
  tz.addScreen('tch-lcd', {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, rx: 2, fill: '#0a1626' }, g);
      s.l1 = label(g, w / 2, h * 0.42, '', { size: Math.min(10, h * 0.4), fill: '#bfe6ff', font: "'Share Tech Mono', monospace", weight: 700 });
      s.l2 = label(g, w / 2, h * 0.8, s.ctl.sub || '', { size: Math.min(5.6, h * 0.22), fill: '#bfe6ff', font: "'Share Tech Mono', monospace", opacity: 0.7 });
      s.last = null;
    },
    update(s, st, nv) {
      const ui = s.ui || tz.app.ui(nv.block);
      const txt = (s.ctl.names || [])[Math.round(ui[s.ctl.p] ?? 0)] || '';
      if (txt !== s.last) { setText(s.l1, txt); s.last = txt; }
    },
  });

  // ------------------------------------------------------------------ enclosure
  tz.addForm('tch-unit', (ctx, d) => {
    const g = ctx.g, w = d.fw, h = d.fh;
    const txt = d.text || '#e9e9ec';
    formKit.body(g, w, h, d.color, { rx: d.rx ?? 10, brushed: d.brushed });
    if (d.band) svg('rect', { x: 6, y: d.bandY, width: w - 12, height: d.bandH, rx: 4, fill: d.band }, g);
    if (d.badge) {
      label(g, d.badgeX ?? w / 2, d.badgeY, d.badge, { size: d.badgeSize || 22, fill: d.badgeColor || '#fff', font: "'Oswald', sans-serif", weight: 700, ls: 0.5 });
    }
    if (d.panels) for (const p of d.panels) svg('rect', { x: p[0], y: p[1], width: p[2], height: p[3], rx: 4, fill: '#000', 'fill-opacity': 0.25, stroke: '#fff', 'stroke-opacity': 0.06 }, g);
    const anchor = d.logoX !== undefined ? 'start' : 'middle';
    const lx = d.logoX ?? w / 2;
    label(g, lx, d.logoY, d.logo || d.name, { size: d.logoSize || 12, fill: d.logoColor || txt, font: "'Inter', sans-serif", weight: 800, anchor, ls: 0.2 });
    if (d.tagline) label(g, lx, d.logoY + (d.logoSize || 12) * 0.5 + 6, d.tagline, { size: 5.4, fill: txt, font: "'Inter', sans-serif", weight: 600, anchor, ls: 1, opacity: 0.75 });
    formKit.tzBadge(g, w / 2, h - 6, txt, 3.8);
    const theme = { text: txt, knob: d.knob || 'mxr', labelSize: 5.6, labelLs: 0.4, toggleTitles: false };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ DSP pieces
  const S = {
    tone: (o = {}) => [
      { prefix: 'cp', algo: 'comp', opts: { type: 'vca' }, params: { sustain: 0.35, attack: 0.25, release: 0.35, level: 0.31, ratio: 0.45, knee: 0.7 }, ...o.cp },
      { prefix: 'eq', algo: 'peq', params: { lowcut: 90, mid1freq: 300, mid1gain: -2, mid2freq: 3200, mid2gain: 2, highfreq: 9000, highgain: 1.5 }, ...o.eq },
    ],
    harm: (o = {}) => ({ prefix: 'h', algo: 'pitch', params: { quality: 2, scale: 1, key: 9, deg1: 2, deg2: 4, level1: 0.45, level2: 0, level3: 0, dry: 0.85, semis1: 0, glide: 0.15 }, ...o }),
    dbl: (o = {}) => ({ prefix: 'db', algo: 'deco', params: { satOn: 0, dtOn: 1, saturation: 0, tone: 0.55, volume: 0.5, blend: 0.4, lag: 0.2, wobble: 0.25, type: 1 }, ...o }),
    corr: (o = {}) => ({ prefix: 'pc', algo: 'pitch', params: { quality: 2, scale: 0, semis1: 0, level1: 1, level2: 0, level3: 0, dry: 0, glide: 0.3 }, ...o }),
    dly: (o = {}) => ({ prefix: 'dl', algo: 'delay', opts: { maxMs: 1500 }, params: { time: 360, feedback: 0.28, mix: 0.18, tone: 0.6, mode: 0 }, ...o }),
    rev: (o = {}) => ({ prefix: 'rv', algo: 'reverb', params: { mode: 1, decay: 0.45, mix: 0.2, tone: 0.55, predelay: 25, size: 0.5 }, ...o }),
    sum: () => ({ prefix: 'mx', algo: 'stereo', params: { mode: 4, level: 6 } }),
  };
  const ch0 = (list) => list.map((s) => Object.assign({ ch: 0 }, s));
  // harmony voice choices: diatonic steps for voice 1 / voice 2
  const HV = [['HIGH', 2, null], ['HIGHER', 4, null], ['LOW', -3, null], ['LOWER', -5, null], ['HI+LO', 2, -3], ['HI+HIGHER', 2, 4], ['LO+LOWER', -3, -5], ['OCTAVE', 7, null]];
  function harmP(pre, v, mix, key, scale = 1) {
    const [, d1, d2] = HV[Math.max(0, Math.min(HV.length - 1, Math.round(v ?? 0)))];
    const m = mix ?? 0.5;
    const two = d2 !== null;
    return { [pre + '.deg1']: d1, [pre + '.deg2']: two ? d2 : 0, [pre + '.level1']: m * (two ? 0.5 : 0.7), [pre + '.level2']: two ? m * 0.5 : 0, [pre + '.dry']: 0.9 - m * 0.25, [pre + '.key']: key ?? 9, [pre + '.scale']: scale };
  }
  const tags = (...t) => ['vocal', ...t];
  const MIC1 = { ins: ['MIC IN'], outs: ['XLR OUT'] };
  const XLR1 = { i0: 'xlr', o0: 'xlr' };

  // ------------------------------------------------------------------ family builders
  // single-effect vocal stomp: knobs on top, code in a coloured band, switch at the bottom
  const SINGLE = (o) => {
    const w = 112, h = 186;
    const top = o.top;
    const xs = top.length === 3 ? [26, 56, 86] : top.length === 2 ? [34, 78] : [56];
    top.forEach((c, i) => at(c, xs[i], 40, c.t === 'button' ? { r: 5.5, labelPos: 'below' } : { r: 10, labelPos: 'below' }));
    return def(Object.assign({
      brand: BRAND, form: 'tch-unit', fw: w, fh: h, rx: 9, color: '#1a1b1e', text: '#e9e9ec', bandY: 70, bandH: 42, badgeY: 92, badgeSize: 21, logoY: 126, logoSize: 9.5,
      ports: MIC1, jackKinds: XLR1, algo: 'chain', cost: 1.2,
    }, o, {
      tags: tags(...(o.tags || [])),
      controls: [...top, ...(o.extra || []), at(LED({ color: '#ff2a1a' }), 56, 144, { r: 2.6 }), at(FOOT({ style: 'stomp' }), 56, 164, { r: 11.5 })],
    }));
  };
  // mini vocal pedal: coloured top band with the name, knobs, a button row, switch
  const MINI = (o) => {
    const w = o.fw || 106, h = 190;
    const xs = (n, y) => (n === 3 ? [26, w / 2, w - 26] : n === 2 ? [32, w - 32] : [w / 2]);
    (o.top || []).forEach((c, i, a) => at(c, xs(a.length)[i], 58, c.t === 'button' ? { r: 5.5, labelPos: 'below' } : { r: c.r || 10.5, labelPos: 'below' }));
    (o.row2 || []).forEach((c, i, a) => at(c, xs(a.length)[i], 100, c.t === 'button' ? { r: 5, labelPos: 'below' } : c.t === 'toggle' ? { orient: 'h' } : { r: 8, labelPos: 'below' }));
    return def(Object.assign({
      brand: BRAND, form: 'tch-unit', fw: w, fh: h, rx: 10, color: '#18191c', text: '#ececec', bandY: 8, bandH: 26, logoY: 21, logoSize: 10.5, badgeY: 124, badgeSize: 13,
      ports: MIC1, jackKinds: XLR1, algo: 'chain', cost: 1.4,
    }, o, {
      tags: tags(...(o.tags || [])),
      controls: [...(o.top || []), ...(o.row2 || []), ...(o.extra || []), ...(o.noStd ? [] : [at(LED({ color: '#ff2a1a' }), w / 2, 144, { r: 2.6 }), at(FOOT({ style: 'stomp' }), w / 2, 166, { r: 12 })])],
    }));
  };
  // two-switch vocal pedal with a small display
  const XT = (o) => {
    const w = 200, h = 216;
    const kx = (n, i) => (n === 1 ? w / 2 : 34 + ((w - 68) * i) / (n - 1));
    o.knobs.forEach((c, i, a) => at(c, kx(a.length, i), 76, { r: 11, labelPos: 'below' }));
    (o.buttons || []).forEach((c, i, a) => at(c, a.length === 1 ? w / 2 : 70 + (60 * i) / (a.length - 1), 114, { r: 5, labelPos: 'below' }));
    const fx = [58, 142];
    return def(Object.assign({
      brand: BRAND, form: 'tch-unit', fw: w, fh: h, rx: 12, color: '#1b1c20', text: '#e9e9ec', logoY: 144, logoSize: 13,
      stereo: 'stereo', ports: { ins: ['MIC IN'], outs: ['XLR OUT L', 'XLR OUT R'] }, jackKinds: { i0: 'xlr', o0: 'xlr', o1: 'xlr' }, algo: 'chain', cost: 2.2, kind: 'Multi-FX', cat: 'Multi-FX',
    }, o, {
      tags: tags(...(o.tags || [])),
      controls: [at(SCREEN('tch-lcd', { p: o.lcd.p, names: o.lcd.names, sub: o.lcd.sub }), w / 2, 34, { w: 104, h: 28 }), ...o.knobs, ...(o.buttons || []),
        ...o.feet.map((f, i) => at(f, fx[i], 188, { r: 12, style: 'stomp' })), ...o.leds.map((l, i) => at(l, fx[i], 166, { r: 2.6 }))],
    }));
  };
  // floor vocal / guitar processor: display, knobs either side, buttons, three switches
  const FLOOR = (o) => {
    const w = 270, h = 214;
    (o.knobs || []).forEach((c, i) => at(c, [36, w - 36, 36, w - 36][i], [42, 42, 84, 84][i], { r: 11, labelPos: 'below' }));
    (o.buttons || []).forEach((c, i, a) => at(c, 76 + ((w - 152) * i) / Math.max(1, a.length - 1), 88, { r: 5, labelPos: 'below', shape: 'rect', w: 16, h: 8 }));
    const fx = [52, w / 2, w - 52];
    return def(Object.assign({
      brand: BRAND, form: 'tch-unit', fw: w, fh: h, rx: 12, color: '#1b1c20', text: '#e9e9ec', logoY: 118, logoSize: 14,
      stereo: 'stereo', jackKinds: { i0: 'xlr', o0: 'xlr', o1: 'xlr' }, algo: 'chain', cost: 3.4, kind: 'Multi-FX', cat: 'Multi-FX',
    }, o, {
      tags: tags(...(o.tags || [])),
      controls: [at(SCREEN('tch-lcd', { p: 'preset', names: o.presetNames, sub: o.lcdSub || 'preset' }), w / 2, 42, { w: 120, h: 36 }), ...(o.knobs || []), ...(o.buttons || []),
        ...o.feet.map((f, i) => at(f, fx[i], 178, { r: 12.5, style: 'stomp' })), ...o.leds.map((l, i) => at(l, fx[i], 152, { r: 2.6 })), ...(o.extra || [])],
    }));
  };
  // mic-stand unit: big level knob, button grid, small power button
  const STAND = (o) => {
    const w = o.fw || 190, h = 156;
    const bs = o.buttons || [];
    const cols = bs.length > 6 ? 3 : 2;
    bs.forEach((c, i) => at(c, 100 + (i % cols) * (cols === 3 ? 30 : 40) + (cols === 3 ? 0 : 6), 30 + Math.floor(i / cols) * 30, { r: 5.5, labelPos: 'below' }));
    return def(Object.assign({
      brand: BRAND, form: 'tch-unit', fw: w, fh: h, rx: 14, color: '#1d1e22', text: '#ececec', logoX: 14, logoY: 132, logoSize: 12,
      jackKinds: { i0: 'xlr', o0: 'xlr' }, algo: 'chain', cost: 2.6, kind: 'Multi-FX', cat: 'Multi-FX',
    }, o, {
      tags: tags(...(o.tags || [])),
      controls: [at(o.big, 48, 58, { r: 22, labelPos: 'below' }), ...(o.small ? [at(o.small, w - 70, 130, { r: 7, labelPos: 'none' })] : []), ...bs,
        at(LED({ color: '#3d8bff' }), w - 38, 132, { r: 2.6 }), at(FOOT({ style: 'soft', label: '' }), w - 18, 132, { r: 7 }), ...(o.extra || [])],
    }));
  };

  // floor unit footswitches: preset down / up (hook below) and HIT
  const STEP = (dir) => FOOT({ action: 'step', step: dir, label: dir < 0 ? '<' : '>' });
  const STEPLED = () => LED({ color: '#3d8bff', bind: 'on' });

  // ------------------------------------------------------------------ voice presets for the floor units
  // each: [name, harmony voice (-1 off), double, delay, reverb, hard tune]
  const PRESETS = [['CLEAN VOX', -1, 0, 0, 0.18, 0], ['HIGH HARMONY', 0, 0, 0, 0.22, 0], ['DUET LOW', 2, 0, 0, 0.2, 0], ['THICK DOUBLE', -1, 1, 0, 0.2, 0],
    ['SLAP ECHO', -1, 0, 0.22, 0.15, 0], ['BIG CHOIR', 4, 1, 0, 0.3, 0], ['HARD TUNE', -1, 0, 0, 0.12, 1], ['BALLAD HALL', 0, 0, 0.12, 0.35, 0]];
  const PN = PRESETS.map((p) => p[0]);
  function floorDerive(u, extra = {}) {
    const p = PRESETS[Math.round(u.preset ?? 0)] || PRESETS[0];
    const hit = (u.hit ?? 0) > 0.5;
    const hv = p[1] >= 0 ? p[1] : hit ? 4 : -1;
    const fxOn = (u.fx ?? 1) > 0.5;
    const out = Object.assign({
      'h.on': hv >= 0 ? 1 : 0, 'db.on': p[2] || hit ? 1 : 0, 'dl.on': fxOn && p[3] > 0 ? 1 : 0, 'rv.on': fxOn ? 1 : 0, 'pc.on': p[5] ? 1 : 0,
      'dl.mix': p[3], 'rv.mix': p[4] * (u.fxlvl ?? 1) * 1.4, 'cp.on': (u.tone ?? 1) > 0.5 ? 1 : 0, 'eq.on': (u.tone ?? 1) > 0.5 ? 1 : 0,
    }, hv >= 0 ? harmP('h', hv, u.hlvl ?? 0.5, u.key ?? 9) : {});
    if (p[5]) out['pc.glide'] = 0;
    return Object.assign(out, extra);
  }
  const voiceChain = () => ch0([...S.tone(), S.corr({ on: false }), S.harm({ on: false }), S.dbl({ on: false }), S.dly({ on: false }), S.rev()]);

  const defs = [
    // ================================================================ single-effect stomps
    SINGLE({ id: 'tch.c1', name: 'VoxTint CT-1 Correct', ref: 'TC-Helicon VoiceTone C1', code: 'CT-1', badge: 'CT-1', logo: 'voxtint', tagline: 'pitch correct', cat: 'Pitch', band: '#2f9d58',
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT'] },
      opts: { chain: ch0([S.corr(), { prefix: 'eq', algo: 'peq', params: { lowcut: 80 } }]) },
      top: [SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.4, labelRadius: 7, virtual: true }), k('amt', 'CORRECT', { def: 0.5, virtual: true }), k('gender', 'GENDER', { def: 0.5, virtual: true })],
      derive: (u) => { const g = (u.gender ?? 0.5) - 0.5; return { 'pc.glide': 0.4 * (1 - (u.amt ?? 0.5)), 'pc.scale': 1, 'pc.deg1': 0, 'pc.key': u.key ?? 9, 'eq.lowfreq': 180, 'eq.lowgain': -g * 10, 'eq.highfreq': 3500, 'eq.highgain': g * 10 }; },
      desc: 'Pitch correction from subtle to robotic, plus a gender knob (tone shift from deep to bright). The guitar input sets the key on the real unit; here you pick it with KEY.' }),
    SINGLE({ id: 'tch.d1', name: 'VoxTint DB-1 Double', ref: 'TC-Helicon VoiceTone D1', code: 'DB-1', badge: 'DB-1', logo: 'voxtint', tagline: 'double · detune', cat: 'Modulation', band: '#2f6fd6',
      opts: { chain: [S.dbl()] },
      top: [k('db.blend', 'DOUBLE', { def: 0.45 }), k('tight', 'STYLE', { def: 0.5, virtual: true }), k('db.wobble', 'DETUNE', { def: 0.25 })],
      derive: (u) => ({ 'db.lag': 0.08 + 0.4 * (1 - (u.tight ?? 0.5)) }),
      desc: 'Vocal doubling and detune. STYLE goes from loose to tight.' }),
    SINGLE({ id: 'tch.e1', name: 'VoxTint EC-1 Echo', ref: 'TC-Helicon VoiceTone E1', code: 'EC-1', badge: 'EC-1', logo: 'voxtint', tagline: 'echo · delay', cat: 'Delay', band: '#7a4fb0',
      opts: { chain: [S.dly({ params: { time: 300, feedback: 0.3, mix: 0.25, tone: 0.55, mode: 0 } })] },
      top: [SEL('style', 'STYLE', ['SLAP', 'ECHO', 'TAPE', 'ANA', 'PING'], { sweep: 220, optSize: 3.6, labelRadius: 7.5, virtual: true }), K('dl.time', 'TIME', { min: 60, max: 1200, def: 320, curve: 'log', display: ms }), k('dl.mix', 'MIX', { def: 0.25 })],
      derive: (u) => { const s = Math.round(u.style ?? 1); return { 'dl.mode': [0, 0, 2, 1, 7][s], 'dl.feedback': s === 0 ? 0.05 : 0.32, 'dl.tone': [0.7, 0.6, 0.5, 0.4, 0.6][s] }; },
      desc: 'Vocal echo: slapback, echo, tape, analog and ping-pong styles.' }),
    SINGLE({ id: 'tch.h1', name: 'VoxTint HM-1 Harmony', ref: 'TC-Helicon VoiceTone H1', code: 'HM-1', badge: 'HM-1', logo: 'voxtint', tagline: 'vocal harmony', cat: 'Pitch', band: '#e2342b',
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT'] },
      opts: { chain: ch0([S.harm()]) },
      top: [SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.4, labelRadius: 7, virtual: true }), SEL('voice', 'VOICE', HV.map((_, i) => String(i + 1)), { def: 0, sweep: 260, optSize: 3.4, labelRadius: 7, virtual: true }), k('mix', 'MIX', { def: 0.5, virtual: true })],
      derive: (u) => harmP('h', u.voice, u.mix, u.key),
      desc: 'One or two harmony voices above or below you, in the key you set (major scale).' }),
    SINGLE({ id: 'tch.r1', name: 'VoxTint RV-1 Reverb', ref: 'TC-Helicon VoiceTone R1', code: 'RV-1', badge: 'RV-1', logo: 'voxtint', tagline: 'vocal reverb', cat: 'Reverb', band: '#1f8a9e',
      opts: { chain: [S.rev({ params: { mode: 1, decay: 0.5, mix: 0.25, tone: 0.55, predelay: 25, size: 0.6 } })] },
      top: [SEL('style', 'STYLE', ['HALL', 'PLATE', 'THTR', 'CLUB', 'ROOM', 'STDO', 'AMB', 'ARENA'], { sweep: 280, optSize: 3.2, labelRadius: 7.5, virtual: true }), k('rv.mix', 'MIX', { def: 0.25 })],
      derive: (u) => { const s = Math.round(u.style ?? 0); return { 'rv.mode': [1, 2, 1, 0, 0, 0, 0, 1][s], 'rv.size': [0.6, 0.5, 0.75, 0.4, 0.3, 0.35, 0.2, 0.95][s], 'rv.decay': [0.55, 0.5, 0.6, 0.4, 0.35, 0.4, 0.25, 0.75][s] }; },
      desc: 'Eight vocal reverbs: hall, plate, theater, club, room, studio, ambience and arena.' }),
    SINGLE({ id: 'tch.t1', name: 'VoxTint TN-1 Tone', ref: 'TC-Helicon VoiceTone T1', code: 'TN-1', badge: 'TN-1', logo: 'voxtint', tagline: 'adaptive tone', cat: 'Dynamics', band: '#e2832b',
      opts: { chain: S.tone() },
      top: [k('shape', 'SHAPE', { def: 0.5, virtual: true }), k('cp.sustain', 'COMP', { def: 0.4 }), BTN('WARMTH', { p: 'warm', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8, virtual: true })],
      derive: (u) => { const s = u.shape ?? 0.5; return { 'eq.mid1gain': -1 - s * 4, 'eq.mid2gain': s * 4, 'eq.highgain': s * 3, 'eq.lowfreq': 140, 'eq.lowgain': u.warm ? 3 : 0, 'cp.level': 0.32 + (u['cp.sustain'] ?? 0.4) * 0.05 }; },
      desc: 'Vocal EQ, compression and de-essing in one. SHAPE cleans up mud and adds air, WARMTH adds low-end body.' }),
    SINGLE({ id: 'tch.x1', name: 'VoxTint FX-1 Extreme', ref: 'TC-Helicon VoiceTone X1', code: 'FX-1', badge: 'FX-1', logo: 'voxtint', tagline: 'extreme vocal fx', cat: 'Distortion', band: '#c22a6e',
      opts: { chain: [
        { prefix: 'ds', algo: 'drive', opts: { clip: 'opamp', preHp: 200, gainMinDb: 6, gainMaxDb: 30, tone: 'lp', toneLo: 1500, toneHi: 7000, postLp: 7000, levelMaxDb: 2 }, params: { gain: 0.5, tone: 0.5, level: 0.5 } },
        { prefix: 'lf', algo: 'lofi', params: { mode: 3, mix: 1, noise: 0.05, wow: 0, flutter: 0 } },
      ] },
      top: [SEL('style', 'STYLE', ['MEGA', 'DIST', 'RADIO', 'PHONE', 'CRUSH'], { sweep: 220, optSize: 3.4, labelRadius: 7.5, virtual: true }), k('amt', 'AMOUNT', { def: 0.5, virtual: true }), k('mix', 'MIX', { def: 0.8, virtual: true })],
      derive: (u) => {
        const s = Math.round(u.style ?? 0), a = u.amt ?? 0.5, m = u.mix ?? 0.8;
        return { 'ds.on': s === 0 || s === 1 ? 1 : 0, 'ds.gain': s === 1 ? 0.4 + a * 0.6 : a * 0.5, 'lf.on': s === 1 ? 0 : 1, 'lf.mode': [3, 3, 2, 3, 4][s], 'lf.mix': m, 'lf.bits': s === 4 ? 0.6 - a * 0.4 : 0.8, 'lf.age': a, 'lf.level': s === 1 ? 0 : 3 };
      },
      desc: 'Megaphone, distortion, radio, telephone and bit-crush voices for the extreme parts.' }),

    // ================================================================ two-switch pedals
    XT({ id: 'tch.creatext', name: 'VoxTint Build XL', ref: 'TC-Helicon VoiceTone Create XT', code: 'BUILD XL', logo: 'build xl', tagline: 'reverb · delay · double · tone', color: '#1b2a44',
      lcd: { p: 'style', names: ['HALL+SLAP', 'PLATE', 'ROOM ECHO', 'DOUBLE HALL', 'TAPE ECHO', 'BIG ROOM'], sub: 'style' },
      opts: { chain: [...S.tone(), S.dbl({ on: false }), S.dly({ on: false }), S.rev()] },
      knobs: [SEL('style', 'STYLE', ['1', '2', '3', '4', '5', '6'], { sweep: 240, optSize: 3.8, labelRadius: 7, virtual: true }), k('rv.mix', 'REVERB', { def: 0.22 }), k('dl.mix', 'DELAY', { def: 0.2 }), k('db.blend', 'DOUBLE', { def: 0.4 })],
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true })],
      feet: [FOOT({ action: 'toggle', p: 'fx1', def: 1, virtual: true, label: 'REVERB' }), FOOT({ action: 'toggle', p: 'fx2', def: 0, virtual: true, label: 'DELAY / DBL' })],
      leds: [LED({ bind: 'param:fx1', color: '#ff2a1a' }), LED({ bind: 'param:fx2', color: '#ff2a1a' })],
      initParams: { tone: 1 },
      derive: (u) => { const s = Math.round(u.style ?? 0); return { 'rv.on': u.fx1 ?? 1, 'dl.on': (u.fx2 ?? 0) && [1, 0, 1, 0, 1, 0][s] ? 1 : 0, 'db.on': (u.fx2 ?? 0) && [0, 0, 0, 1, 0, 1][s] ? 1 : 0, 'rv.mode': [1, 2, 0, 1, 0, 0][s], 'rv.size': [0.6, 0.5, 0.35, 0.6, 0.3, 0.6][s], 'dl.mode': s === 4 ? 2 : 0, 'dl.time': [120, 0, 380, 0, 330, 0][s] || 360, 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }; },
      desc: 'Vocal reverb, delay and doubling with adaptive tone. Left switch: reverb. Right switch: delay or double, depending on the style.' }),
    XT({ id: 'tch.correctxt', name: 'VoxTint Tune XL', ref: 'TC-Helicon VoiceTone Correct XT', code: 'TUNE XL', logo: 'tune xl', tagline: 'pitch correct · tone', color: '#1c3a2a',
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT L', 'XLR OUT R'] }, stereo: 'mono',
      lcd: { p: 'key', names: NOTES.map((n) => 'KEY ' + n), sub: 'correction key' },
      opts: { chain: [...ch0([...S.tone(), S.corr(), S.rev({ params: { mode: 2, mix: 0.15, decay: 0.4 } })]), S.sum()] },
      knobs: [SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.4, labelRadius: 7, virtual: true }), k('amt', 'CORRECT', { def: 0.5, virtual: true }), k('rv.mix', 'REVERB', { def: 0.15 })],
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('HARD', { p: 'hard', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8, virtual: true })],
      feet: [FOOT({ action: 'toggle', p: 'pc.on', def: 1, label: 'CORRECT' }), FOOT({ action: 'toggle', p: 'rv.on', def: 1, label: 'REVERB' })],
      leds: [LED({ bind: 'param:pc.on', color: '#ff2a1a' }), LED({ bind: 'param:rv.on', color: '#ff2a1a' })],
      initParams: { tone: 1 },
      derive: (u) => ({ 'pc.glide': u.hard ? 0 : 0.4 * (1 - (u.amt ?? 0.5)), 'pc.scale': 1, 'pc.deg1': 0, 'pc.key': u.key ?? 9, 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Pitch correction (HARD for the robot effect), tone and reverb. The guitar input feeds the mix.' }),
    XT({ id: 'tch.harmonygxt', name: 'VoxTint Harmony-Gtr XL', ref: 'TC-Helicon VoiceTone Harmony-G XT', code: 'HARM XL', logo: 'harmony-gtr xl', tagline: 'harmony · reverb · tone', color: '#3a1d24',
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT L', 'XLR OUT R', 'GUITAR THRU'] }, stereo: 'mono', jackKinds: { i0: 'xlr', o0: 'xlr', o1: 'xlr' },
      lcd: { p: 'voice', names: HV.map((v) => v[0]), sub: 'harmony voice' },
      opts: { chain: [...ch0([...S.tone(), S.harm(), S.dbl({ on: false }), S.rev()]), S.sum()] },
      knobs: [SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.4, labelRadius: 7, virtual: true }), SEL('voice', 'VOICE', HV.map((_, i) => String(i + 1)), { sweep: 260, optSize: 3.6, labelRadius: 7, virtual: true }),
        k('hmix', 'HARMONY', { def: 0.5, virtual: true }), k('rv.mix', 'REVERB', { def: 0.2 })],
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('DOUBLE', { p: 'db.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 })],
      feet: [FOOT({ action: 'toggle', p: 'h.on', def: 1, label: 'HARMONY' }), FOOT({ action: 'toggle', p: 'rv.on', def: 1, label: 'REVERB' })],
      leds: [LED({ bind: 'param:h.on', color: '#ff2a1a' }), LED({ bind: 'param:rv.on', color: '#ff2a1a' })],
      initParams: { tone: 1 },
      derive: (u) => Object.assign(harmP('h', u.voice, u.hmix, u.key), { 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Guitar-style harmony pedal: harmonies, doubling, reverb and tone. Set KEY to match the song (the real unit reads your chords).' }),
    XT({ id: 'tch.double', name: 'VoxTint Twin', ref: 'TC-Helicon VoiceTone Double', code: 'TWIN', logo: 'twin', tagline: 'vocal doubling', color: '#1f2b3a', cat: 'Modulation', kind: 'Pedal',
      lcd: { p: 'bank', names: ['TIGHT 2', 'LOOSE 2', 'OCT UP', 'OCT DOWN', 'WIDE 3', 'SHOUT'], sub: 'double bank' },
      opts: { chain: [S.dbl(), { prefix: 'oc', algo: 'pitch', on: false, params: { quality: 1, semis1: 12, level1: 0.3, dry: 0.9, level2: 0, level3: 0 } }] },
      knobs: [SEL('bank', 'BANK', ['1', '2', '3', '4', '5', '6'], { sweep: 240, optSize: 3.8, labelRadius: 7, virtual: true }), k('db.blend', 'LEVEL', { def: 0.45 }), k('db.wobble', 'DETUNE', { def: 0.25 })],
      feet: [FOOT({ action: 'toggle', p: 'partb', def: 0, virtual: true, label: 'PART A/B' }), FOOT({ label: 'ON' })],
      leds: [LED({ bind: 'param:partb', color: '#ffb000' }), LED({ color: '#ff2a1a' })],
      derive: (u) => { const b = Math.round(u.bank ?? 0), pb = (u.partb ?? 0) > 0.5; return { 'db.lag': [0.1, 0.4, 0.2, 0.2, 0.3, 0.15][b] + (pb ? 0.1 : 0), 'db.type': b === 4 ? 2 : 1, 'oc.on': b === 2 || b === 3 ? 1 : 0, 'oc.semis1': b === 3 ? -12 : 12, 'db.volume': b === 5 ? 0.6 : 0.5 }; },
      desc: 'Vocal doubling with six banks (tight, loose, octave up / down, wide, shout). PART A/B switches between two variations.' }),
    XT({ id: 'tch.synth', name: 'VoxTint SynthVox', ref: 'TC-Helicon VoiceTone Synth', code: 'SYNTHVOX', logo: 'synthvox', tagline: 'vocal synth', color: '#2a1b3e', cat: 'Synth',
      lcd: { p: 'sy.mode', names: ['SQUARE', 'SAW LEAD', 'ORGAN', 'STRINGS', 'BRASS', 'SUB BASS', 'PAD', 'SWEEP'], sub: 'synth voice' },
      opts: { chain: [{ prefix: 'sy', algo: 'synth', params: { dry: 0.55, wet: 0.35, sens: 0.6, attack: 0.15 } }, S.rev({ params: { mode: 1, mix: 0.18 } })] },
      knobs: [SEL('sy.mode', 'VOICE', ['1', '2', '3', '4', '5', '6', '7', '8'], { sweep: 260, optSize: 3.6, labelRadius: 7 }), k('sy.filter', 'FILTER', { def: 0.5 }), k('sy.wet', 'SYNTH', { def: 0.35 }), k('sy.dry', 'VOICE LVL', { def: 0.55 })],
      buttons: [TOG('sy.octave', 'OCTAVE', ['-1', '0', '+1'], { values: [-1, 0, 1], def: 1 })],
      feet: [FOOT({ label: 'ON' }), FOOT({ action: 'toggle', p: 'rv.on', def: 1, label: 'REVERB' })],
      leds: [LED({ color: '#ff2a1a' }), LED({ bind: 'param:rv.on', color: '#ff2a1a' })],
      desc: 'A synth voice that follows the pitch of your singing (vocoder-style lead), blended with your dry voice.' }),

    // ================================================================ mini vocal pedals
    MINI({ id: 'tch.harmonysinger', name: 'Harmony Crooner', ref: 'TC-Helicon Harmony Singer', code: 'CROON', logo: 'harmony crooner', logoSize: 9.5, badge: 'harmony · reverb', badgeSize: 6, band: '#6a2a8a', cat: 'Pitch', fw: 112,
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT', 'GUITAR THRU'] },
      opts: { chain: ch0([...S.tone(), S.harm(), S.rev()]) },
      top: [SEL('voice', 'HARMONY', ['HI', 'HI2', 'LO', 'LO2', 'HI+LO', 'HI+HI2', 'LO+LO2', 'OCT'], { sweep: 260, optSize: 3, labelRadius: 7.5, virtual: true }), k('rv.mix', 'REVERB', { def: 0.2 })],
      row2: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.2, labelRadius: 6.5, virtual: true })],
      initParams: { tone: 1 },
      derive: (u) => Object.assign(harmP('h', u.voice, 0.5, u.key), { 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Guitar-driven vocal harmony with reverb and tone. Set the KEY to your song.' }),
    MINI({ id: 'tch.harmonysinger2', name: 'Harmony Crooner 2', ref: 'TC-Helicon Harmony Singer 2', code: 'CROON 2', logo: 'harmony crooner 2', logoSize: 9, badge: 'harmony · reverb', badgeSize: 6, band: '#b23a8a', cat: 'Pitch', fw: 112,
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT', 'GUITAR THRU'] },
      opts: { chain: ch0([...S.tone(), S.harm(), S.rev()]) },
      top: [SEL('voice', 'HARMONY', ['HI', 'HI2', 'LO', 'LO2', 'HI+LO', 'HI+HI2', 'LO+LO2', 'OCT'], { sweep: 260, optSize: 3, labelRadius: 7.5, virtual: true }), k('hmix', 'LEVEL', { def: 0.5, virtual: true }), k('rv.mix', 'REVERB', { def: 0.2 })],
      row2: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.2, labelRadius: 6.5, virtual: true })],
      initParams: { tone: 1 },
      derive: (u) => Object.assign(harmP('h', u.voice, u.hmix, u.key), { 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Second-gen harmony pedal: eight harmony styles with a level knob, reverb and tone.' }),
    MINI({ id: 'tch.micmechanic', name: 'Mic Machinist', ref: 'TC-Helicon Mic Mechanic', code: 'MACH', logo: 'mic machinist', badge: 'reverb · echo · pitch', badgeSize: 6, band: '#2a7fb0', cat: 'Multi-FX', kind: 'Multi-FX', fw: 112,
      opts: { chain: [...S.tone(), S.corr({ on: false }), S.dly(), S.rev()] },
      top: [k('rv.mix', 'REVERB', { def: 0.22 }), k('dl.mix', 'ECHO', { def: 0.15 })],
      row2: [BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 })],
      desc: 'Vocal reverb, echo, light pitch correction and adaptive tone in one small pedal.' }),
    MINI({ id: 'tch.micmechanic2', name: 'Mic Machinist 2', ref: 'TC-Helicon Mic Mechanic 2', code: 'MACH 2', logo: 'mic machinist 2', badge: 'reverb · echo · pitch', badgeSize: 6, band: '#3fb0e8', cat: 'Multi-FX', kind: 'Multi-FX', fw: 112,
      opts: { chain: [...S.tone(), S.corr({ on: false }), S.dly(), S.rev()] },
      top: [SEL('rstyle', 'REVERB', ['HALL', 'ROOM', 'PLATE', 'CLUB'], { sweep: 200, optSize: 3.2, labelRadius: 7.5, virtual: true }), k('rv.mix', 'LEVEL', { def: 0.22 }), K('dl.time', 'ECHO', { min: 60, max: 900, def: 300, curve: 'log', display: ms })],
      row2: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 })],
      initParams: { tone: 1 },
      derive: (u) => { const s = Math.round(u.rstyle ?? 0); return { 'rv.mode': [1, 0, 2, 0][s], 'rv.size': [0.6, 0.3, 0.5, 0.45][s], 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }; },
      desc: 'Reverb styles, echo with time, pitch correction and adaptive tone. Runs on a 9 V battery on the real unit.' }),
    MINI({ id: 'tch.duplicator', name: 'Replicator', ref: 'TC-Helicon Duplicator', code: 'REPL', logo: 'replicator', badge: 'double · reverb', badgeSize: 6, band: '#3a9a4a', cat: 'Modulation', fw: 112,
      opts: { chain: [...S.tone(), S.corr({ on: false }), S.dbl(), S.rev()] },
      top: [SEL('dstyle', 'DOUBLE', ['TIGHT', 'LOOSE', 'OCT', 'WIDE'], { sweep: 200, optSize: 3.2, labelRadius: 7.5, virtual: true }), k('db.blend', 'LEVEL', { def: 0.45 }), k('rv.mix', 'REVERB', { def: 0.18 })],
      row2: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 })],
      initParams: { tone: 1 },
      derive: (u) => { const s = Math.round(u.dstyle ?? 0); return { 'db.lag': [0.1, 0.4, 0.2, 0.3][s], 'db.wobble': [0.15, 0.35, 0.1, 0.3][s], 'db.type': s === 3 ? 2 : 1, 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }; },
      desc: 'Vocal doubling with reverb, pitch correction and tone.' }),
    MINI({ id: 'tch.criticalmass', name: 'Choir Mass', ref: 'TC-Helicon Critical Mass', code: 'MASS', logo: 'choir mass', badge: 'group vocals', badgeSize: 6, band: '#d4511f', cat: 'Pitch', fw: 112,
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT', 'GUITAR THRU'] },
      opts: { chain: ch0([S.harm({ params: { quality: 2, scale: 1, key: 9, deg1: 2, deg2: -3, deg3: 4, level1: 0.35, level2: 0.35, level3: 0, dry: 0.75, glide: 0.2 } }), S.dbl({ params: { satOn: 0, dtOn: 1, saturation: 0, tone: 0.55, volume: 0.5, blend: 0.35, lag: 0.3, wobble: 0.35, type: 2 } }), S.rev({ params: { mode: 1, mix: 0.22, decay: 0.5, size: 0.7 } })]) },
      top: [SEL('size', 'SIZE', ['DUO', 'TRIO', 'QUAD', 'CHOIR'], { sweep: 200, optSize: 3.2, labelRadius: 7.5, virtual: true }), k('hmix', 'LEVEL', { def: 0.5, virtual: true }), k('rv.mix', 'REVERB', { def: 0.22 })],
      row2: [SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.2, labelRadius: 6.5, virtual: true })],
      derive: (u) => { const s = Math.round(u.size ?? 1), m = u.hmix ?? 0.5; return { 'h.key': u.key ?? 9, 'h.level1': m * 0.6, 'h.level2': s >= 1 ? m * 0.5 : 0, 'h.level3': s >= 2 ? m * 0.45 : 0, 'h.dry': 0.85 - m * 0.2, 'db.on': s === 3 ? 1 : 0 }; },
      desc: 'Group vocal sound: from a duo to a full choir of harmonies around your voice.' }),
    MINI({ id: 'tch.dittomic', name: 'Likewise Mic Looper', ref: 'TC-Helicon Ditto Mic Looper', code: 'LIKE MIC', logo: 'likewise mic', badge: 'mic looper', badgeSize: 6, band: '#9aa0a8', color: '#c3c7cc', text: '#17191c', cat: 'Looper', noStd: true,
      opts: { chain: [{ prefix: 'lp', algo: 'looper', opts: { tracks: 1, maxSec: 300 } }] },
      top: [k('lp.level1', 'LOOP LEVEL', { def: 0.8, r: 13 })],
      row2: [TOG('phantom', '', ['OFF', '48V'], { virtual: true })],
      extra: [at(LED({ bind: 'looper:track:0', sub: 'lp' }), 53, 144, { r: 2.6 }),
        at(FOOT({ style: 'stomp', action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 900, event: { type: 2, arg: 0 } }, doubleHold: { event: { type: 3, arg: 0 } } }), 53, 166, { r: 12 })],
      alwaysOn: true, loopTracks: 1, cost: 0.3,
      desc: 'Looper for your mic: record, play, overdub; hold to stop, hold again to clear. 48V phantom power for condenser mics.' }),
    MINI({ id: 'tch.talkboxsynth', name: 'Mouthbox Synth', ref: 'TC-Helicon Talkbox Synth', code: 'MOUTH', logo: 'mouthbox', badge: 'talkbox synth', badgeSize: 6, band: '#c22a2a', cat: 'Synth', fw: 112,
      ports: { ins: ['MIC IN', 'INSTRUMENT IN'], outs: ['XLR OUT', 'INSTRUMENT OUT'] },
      opts: { chain: [{ prefix: 'tb', algo: 'vocal', ch: 0, params: { mode: 0, mix: 1, dry: 0.3, sens: 0.6, tone: 0.6, level: -16 } }, { prefix: 'gt', algo: 'talkbox', ch: 1, params: { mode: 1, sens: 0.6, tone: 0.5, volume: 0.5 } }] },
      top: [SEL('tb.vowel', 'VOWEL', ['A', 'E', 'I', 'O', 'U'], { sweep: 200, optSize: 3.6, labelRadius: 7.5 }), k('tb.mix', 'TALK', { def: 1 }), k('tb.dry', 'VOICE', { def: 0.3 })],
      row2: [k('tb.shift', 'SHIFT', { def: 0.5 }), k('gt.tone', 'TONE', { def: 0.5 })],
      desc: 'Talkbox effect without the tube: your voice shapes the sound. The instrument path gets a talkbox voice that follows your picking.' }),

    // ================================================================ floor units
    FLOOR({ id: 'tch.voicelive-play', name: 'LiveVox Play', ref: 'TC-Helicon VoiceLive Play', code: 'LV PLAY', logo: 'livevox play', tagline: 'vocal harmony & effects', color: '#1b1c20', presetNames: PN,
      ports: { ins: ['MIC IN', 'GUITAR IN', 'AUX IN'], outs: ['XLR OUT L', 'XLR OUT R', 'PHONES'] }, jackKinds: { i0: 'xlr', i2: 'mini', o0: 'xlr', o1: 'xlr', o2: 'mini' },
      opts: { chain: [...voiceChain(), S.sum()] },
      knobs: [SEL('preset', 'PRESET', PN.map((_, i) => String(i + 1)), { sweep: 260, optSize: 3.6, labelRadius: 7, virtual: true }), k('hlvl', 'HARMONY', { def: 0.5, virtual: true }), SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.2, labelRadius: 7, virtual: true }), k('fxlvl', 'FX LEVEL', { def: 0.7, virtual: true })],
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('FX', { p: 'fx', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8, virtual: true }), TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true })],
      feet: [STEP(-1), FOOT({ action: 'toggle', p: 'hit', def: 0, virtual: true, label: 'HIT' }), STEP(1)], leds: [STEPLED(), LED({ bind: 'param:hit', color: '#ff2a1a' }), STEPLED()],
      initParams: { tone: 1, fx: 1 }, derive: (u) => floorDerive(u),
      desc: 'Vocal harmony and effects with presets. Left / right switches step presets, HIT adds harmony and doubling. The guitar input is mixed to the outs.' }),
    FLOOR({ id: 'tch.play-acoustic', name: 'VoxPlay Acoustic', ref: 'TC-Helicon Play Acoustic', code: 'PLAY AC', logo: 'voxplay acoustic', tagline: 'vocal & acoustic guitar', color: '#2a1f17', presetNames: PN,
      ports: { ins: ['MIC IN', 'GUITAR IN', 'AUX IN'], outs: ['XLR OUT L', 'XLR OUT R', 'GUITAR OUT', 'PHONES'] }, jackKinds: { i0: 'xlr', i2: 'mini', o0: 'xlr', o1: 'xlr', o3: 'mini' },
      opts: { chain: [...voiceChain(), { prefix: 'ag', algo: 'acoustic', ch: 1, opts: { mode: 1, type: 0 }, params: { mode: 1, body: 0.55, antifb: 0.5, comp: 0.3 } }, S.sum()] },
      knobs: [SEL('preset', 'PRESET', PN.map((_, i) => String(i + 1)), { sweep: 260, optSize: 3.6, labelRadius: 7, virtual: true }), k('hlvl', 'HARMONY', { def: 0.5, virtual: true }), k('ag.body', 'BODY', { def: 0.55 }), k('fxlvl', 'FX LEVEL', { def: 0.7, virtual: true })],
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('FX', { p: 'fx', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8, virtual: true }), BTN('GTR FX', { p: 'ag.on', toggle: true, led: true, ledColor: '#ffb000', ledDy: -8 }), TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true })],
      feet: [STEP(-1), FOOT({ action: 'toggle', p: 'hit', def: 0, virtual: true, label: 'HIT' }), STEP(1)], leds: [STEPLED(), LED({ bind: 'param:hit', color: '#ff2a1a' }), STEPLED()],
      initParams: { tone: 1, fx: 1 }, derive: (u) => floorDerive(u),
      desc: 'Vocal effects plus an acoustic guitar path (body, anti-feedback, compression). Outs carry the voice and guitar mix.' }),
    FLOOR({ id: 'tch.play-electric', name: 'VoxPlay Electric', ref: 'TC-Helicon Play Electric', code: 'PLAY EL', logo: 'voxplay electric', tagline: 'vocal & electric guitar', color: '#1a1d26', presetNames: PN,
      ports: { ins: ['MIC IN', 'GUITAR IN', 'AUX IN'], outs: ['XLR OUT L', 'XLR OUT R', 'GUITAR OUT', 'PHONES'] }, jackKinds: { i0: 'xlr', i2: 'mini', o0: 'xlr', o1: 'xlr', o3: 'mini' },
      opts: { chain: [...voiceChain(),
        { prefix: 'gd', algo: 'drive', ch: 1, on: false, opts: { clip: 'asym', preHp: 70, gainMinDb: 2, gainMaxDb: 30, tone: 'lp', toneLo: 1500, toneHi: 8000, postLp: 8000, levelMaxDb: 4 }, params: { gain: 0.4, tone: 0.55, level: 0.45 } },
        { prefix: 'gc', algo: 'chorus', ch: 1, on: false, params: { mix: 0.4 } }, S.sum()] },
      knobs: [SEL('preset', 'PRESET', PN.map((_, i) => String(i + 1)), { sweep: 260, optSize: 3.6, labelRadius: 7, virtual: true }), k('hlvl', 'HARMONY', { def: 0.5, virtual: true }), k('gd.gain', 'GTR DRIVE', { def: 0.4 }), k('fxlvl', 'FX LEVEL', { def: 0.7, virtual: true })],
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('FX', { p: 'fx', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8, virtual: true }), BTN('DRIVE', { p: 'gd.on', toggle: true, led: true, ledColor: '#ffb000', ledDy: -8 }), BTN('CHORUS', { p: 'gc.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 })],
      feet: [STEP(-1), FOOT({ action: 'toggle', p: 'hit', def: 0, virtual: true, label: 'HIT' }), STEP(1)], leds: [STEPLED(), LED({ bind: 'param:hit', color: '#ff2a1a' }), STEPLED()],
      initParams: { tone: 1, fx: 1 }, derive: (u) => floorDerive(u),
      desc: 'Vocal effects plus electric guitar drive and chorus. The outs carry the voice and guitar mix.' }),
    // big floor unit
    (() => {
      const w = 430, h = 240;
      const fx = [48, 115, 182, 249, 316, 383];
      const feet = [STEP(-1), STEP(1), FOOT({ action: 'toggle', p: 'h.on', def: 1, label: 'HARMONY' }), FOOT({ action: 'toggle', p: 'db.on', def: 0, label: 'DOUBLE' }),
        FOOT({ action: 'toggle', p: 'dl.on', def: 0, label: 'DELAY' }), FOOT({ action: 'toggle', p: 'gfx', def: 0, virtual: true, label: 'GTR FX' })];
      const leds = [STEPLED(), STEPLED(), LED({ bind: 'param:h.on', color: '#ff2a1a' }), LED({ bind: 'param:db.on', color: '#ff2a1a' }), LED({ bind: 'param:dl.on', color: '#ff2a1a' }), LED({ bind: 'param:gfx', color: '#ffb000' })];
      return def({
        id: 'tch.voicelive3x', name: 'LiveVox 3 Xtra', ref: 'TC-Helicon VoiceLive 3 Extreme', brand: BRAND, code: 'LV3 X', logo: 'livevox 3 xtra', tagline: 'vocal & guitar processor', cat: 'Multi-FX', kind: 'Multi-FX', tags: tags('looper', 'guitar'),
        form: 'tch-unit', fw: w, fh: h, rx: 14, color: '#17181c', text: '#e9e9ec', logoX: 22, logoY: 122, logoSize: 15, panels: [[290, 20, 124, 90]],
        stereo: 'stereo', algo: 'chain', cost: 4.2,
        ports: { ins: ['MIC IN', 'GUITAR IN', 'AUX IN'], outs: ['XLR OUT L', 'XLR OUT R', 'GUITAR OUT L', 'GUITAR OUT R', 'PHONES'] }, jackKinds: { i0: 'xlr', i2: 'mini', o0: 'xlr', o1: 'xlr', o4: 'phones' },
        opts: { chain: [...ch0([...S.tone(), S.corr({ on: false }), S.harm(), S.dbl({ on: false }), S.dly({ on: false }), S.rev()]),
          { prefix: 'ga', algo: 'amp', ch: 1, on: false, opts: { model: 'deluxe' }, params: { gain: 0.45, master: 0.5, level: -6 } },
          { prefix: 'gr', algo: 'reverb', ch: 1, lvl: true, params: { mode: 1, mix: 0.15 } }, S.sum()] },
        controls: [
          at(SCREEN('tch-lcd', { p: 'preset', names: PN, sub: 'preset' }), 215, 46, { w: 150, h: 44 }),
          at(SEL('preset', 'PRESET', PN.map((_, i) => String(i + 1)), { sweep: 260, optSize: 3.6, labelRadius: 7, virtual: true }), 40, 44, { r: 12, labelPos: 'below' }),
          at(SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.2, labelRadius: 7, virtual: true }), 90, 44, { r: 12, labelPos: 'below' }),
          at(k('hlvl', 'HARMONY', { def: 0.5, virtual: true }), 316, 44, { r: 10, labelPos: 'below' }), at(k('fxlvl', 'FX LEVEL', { def: 0.7, virtual: true }), 352, 44, { r: 10, labelPos: 'below' }),
          at(k('glvl', 'GUITAR', { def: 0.7, virtual: true }), 388, 44, { r: 10, labelPos: 'below' }),
          at(BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), 316, 90, { r: 5, labelPos: 'below' }),
          at(BTN('HARD', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }), 352, 90, { r: 5, labelPos: 'below' }),
          at(TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true }), 388, 90),
          ...feet.map((f, i) => at(f, fx[i], 200, { r: 13, style: 'stomp' })), ...leds.map((l, i) => at(l, fx[i], 170, { r: 2.6 })),
        ],
        initParams: { tone: 1 },
        derive: (u) => {
          const p = PRESETS[Math.round(u.preset ?? 0)] || PRESETS[0];
          return Object.assign(floorDerive(Object.assign({}, u, { hit: 0 })), harmP('h', p[1] >= 0 ? p[1] : 0, u.hlvl ?? 0.5, u.key ?? 9), {
            'h.on': u['h.on'] ?? 1, 'db.on': u['db.on'] ?? 0, 'dl.on': u['dl.on'] ?? 0, 'pc.on': u['pc.on'] ?? 0, 'ga.on': u.gfx ? 1 : 0, 'gr.lvl': u.glvl ?? 0.7,
          });
        },
        desc: 'Big vocal and guitar processor: harmony, doubling, delay, reverb, hard tune and a guitar amp path. Switches turn each effect on or off; the outs carry the mix.',
      });
    })(),
    // tabletop touch unit
    def({
      id: 'tch.voicelive-touch2', name: 'LiveVox Tap 2', ref: 'TC-Helicon VoiceLive Touch 2', brand: BRAND, code: 'LV TAP 2', logo: 'livevox tap 2', tagline: 'touch vocal processor', cat: 'Multi-FX', kind: 'Multi-FX', tags: tags('looper'),
      form: 'tch-unit', fw: 270, fh: 176, rx: 16, color: '#1c1d21', text: '#e9e9ec', logoX: 18, logoY: 150, logoSize: 12, panels: [[14, 62, 242, 64]],
      stereo: 'stereo', algo: 'chain', cost: 3.2,
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT L', 'XLR OUT R', 'GUITAR THRU', 'PHONES'] }, jackKinds: { i0: 'xlr', o0: 'xlr', o1: 'xlr', o3: 'mini' },
      opts: { chain: [...voiceChain(), S.sum()] },
      controls: [
        at(SCREEN('tch-lcd', { p: 'preset', names: PN, sub: 'preset' }), 135, 32, { w: 120, h: 30 }),
        at(SEL('preset', '', PN.map((_, i) => String(i + 1)), { sweep: 260, optSize: 3.4, labelRadius: 7, virtual: true }), 30, 32, { r: 11 }),
        at(SEL('key', '', NOTES, { def: 9, sweep: 300, optSize: 3.2, labelRadius: 7, virtual: true }), 240, 32, { r: 11 }),
        ...[['HARM', 'h2'], ['DOUBLE', 'db2'], ['TONE', 'tone'], ['FX', 'fx'], ['HIT', 'hit']].map(([l, p], i) => at(BTN(l, { p, toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8, virtual: true, shape: 'rect', w: 22, h: 10 }), 42 + i * 46, 80, { labelPos: 'below' })),
        at(SLIDER('hlvl', 'HARMONY LEVEL', { orient: 'h', h: 200, w: 8, def: 0.5, virtual: true }), 135, 108),
        at(LED({ color: '#3d8bff' }), 226, 150, { r: 2.6 }), at(FOOT({ style: 'soft', label: '' }), 248, 150, { r: 7 }),
      ],
      initParams: { tone: 1, fx: 1, h2: 1 },
      derive: (u) => Object.assign(floorDerive(u), u.h2 ? harmP('h', (PRESETS[Math.round(u.preset ?? 0)][1] >= 0 ? PRESETS[Math.round(u.preset ?? 0)][1] : 0), u.hlvl ?? 0.5, u.key ?? 9) : {}, { 'h.on': u.h2 || u.hit ? 1 : 0, 'db.on': u.db2 || u.hit ? 1 : 0 }),
      desc: 'Tabletop vocal processor with touch buttons for harmony, doubling, tone and effects, and a level strip. Mounts on a mic stand.',
    }),

    // ================================================================ mic-stand units
    STAND({ id: 'tch.perform-v', name: 'Showtime-V', ref: 'TC-Helicon Perform-V', code: 'SHOW-V', logo: 'showtime-v', tagline: 'vocal processor',
      ports: { ins: ['MIC IN', 'AUX IN'], outs: ['XLR OUT', 'PHONES'] }, jackKinds: { i0: 'xlr', i1: 'mini', o0: 'xlr', o1: 'mini' },
      opts: { chain: [...S.tone(), S.corr({ on: false }), S.dbl({ on: false }), S.dly({ on: false }), S.rev()] },
      big: k('fxlvl', 'FX LEVEL', { def: 0.6, virtual: true }),
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }),
        BTN('REVERB', { p: 'rv.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('ECHO', { p: 'dl.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }),
        BTN('DOUBLE', { p: 'db.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true })],
      initParams: { tone: 1 },
      derive: (u) => ({ 'rv.mix': 0.3 * (u.fxlvl ?? 0.6), 'dl.mix': 0.3 * (u.fxlvl ?? 0.6), 'db.blend': 0.6 * (u.fxlvl ?? 0.6), 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Mic-stand vocal processor: adaptive tone, pitch correction, reverb, echo and doubling.' }),
    STAND({ id: 'tch.perform-ve', name: 'Showtime-VE', ref: 'TC-Helicon Perform-VE', code: 'SHOW-VE', logo: 'showtime-ve', tagline: 'vocal effects', fw: 200,
      ports: { ins: ['MIC IN', 'AUX IN'], outs: ['XLR OUT', 'PHONES'] }, jackKinds: { i0: 'xlr', i1: 'mini', o0: 'xlr', o1: 'mini' },
      opts: { chain: [...S.tone(), S.corr({ on: false }), S.dbl({ on: false }), { prefix: 'mg', algo: 'lofi', on: false, params: { mode: 3, mix: 1, level: 3, wow: 0, flutter: 0, noise: 0.05 } }, S.dly({ on: false }), S.rev()] },
      big: k('fxlvl', 'FX LEVEL', { def: 0.6, virtual: true }),
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }), BTN('HARD', { p: 'hard', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8, virtual: true }),
        BTN('REVERB', { p: 'rv.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('ECHO', { p: 'dl.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('DOUBLE', { p: 'db.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }),
        BTN('MEGA', { p: 'mg.on', toggle: true, led: true, ledColor: '#ffb000', ledDy: -8 }), TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true })],
      initParams: { tone: 1 },
      derive: (u) => ({ 'rv.mix': 0.3 * (u.fxlvl ?? 0.6), 'dl.mix': 0.3 * (u.fxlvl ?? 0.6), 'db.blend': 0.6 * (u.fxlvl ?? 0.6), 'pc.on': u.hard ? 1 : u['pc.on'] ?? 0, 'pc.glide': u.hard ? 0 : 0.3, 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Mic-stand vocal processor with extra effects: hard tune and megaphone on top of reverb, echo and doubling.' }),
    STAND({ id: 'tch.perform-vg', name: 'Showtime-VG', ref: 'TC-Helicon Perform-VG', code: 'SHOW-VG', logo: 'showtime-vg', tagline: 'vocal & guitar', fw: 200, stereo: 'mono',
      ports: { ins: ['MIC IN', 'GUITAR IN'], outs: ['XLR OUT', 'GUITAR OUT', 'PHONES'] }, jackKinds: { i0: 'xlr', o0: 'xlr', o2: 'mini' },
      opts: { chain: [...ch0([...S.tone(), S.corr({ on: false }), S.harm({ on: false }), S.dbl({ on: false }), S.dly({ on: false }), S.rev()]), { prefix: 'ag', algo: 'acoustic', ch: 1, opts: { mode: 1 }, params: { mode: 1, body: 0.5, antifb: 0.5 } }, S.sum()] },
      big: k('fxlvl', 'FX LEVEL', { def: 0.6, virtual: true }), small: SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3, labelRadius: 6, virtual: true }),
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }), BTN('HARMONY', { p: 'h.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }),
        BTN('REVERB', { p: 'rv.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('ECHO', { p: 'dl.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('DOUBLE', { p: 'db.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }),
        BTN('GTR FX', { p: 'ag.on', toggle: true, led: true, ledColor: '#ffb000', ledDy: -8 }), TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true })],
      initParams: { tone: 1 },
      derive: (u) => Object.assign(harmP('h', 0, 0.5, u.key), { 'rv.mix': 0.3 * (u.fxlvl ?? 0.6), 'dl.mix': 0.3 * (u.fxlvl ?? 0.6), 'db.blend': 0.6 * (u.fxlvl ?? 0.6), 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Mic-stand processor for singer-guitarists: harmony in your KEY, reverb, echo, doubling and an acoustic guitar path.' }),
    STAND({ id: 'tch.perform-vk', name: 'Showtime-VK', ref: 'TC-Helicon Perform-VK', code: 'SHOW-VK', logo: 'showtime-vk', tagline: 'vocal & keys', fw: 200, stereo: 'mono',
      ports: { ins: ['MIC IN', 'KEYS IN L', 'KEYS IN R'], outs: ['XLR OUT', 'KEYS OUT L', 'KEYS OUT R', 'PHONES'] }, jackKinds: { i0: 'xlr', o0: 'xlr', o3: 'mini' },
      opts: { chain: [...ch0([...S.tone(), S.corr({ on: false }), S.harm({ on: false }), S.dbl({ on: false }), S.dly({ on: false }), S.rev()]), S.sum()] },
      big: k('fxlvl', 'FX LEVEL', { def: 0.6, virtual: true }), small: SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3, labelRadius: 6, virtual: true }),
      buttons: [BTN('TONE', { p: 'tone', toggle: true, led: true, ledColor: '#3ddc84', ledDy: -8, virtual: true }), BTN('PITCH', { p: 'pc.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }), BTN('HARMONY', { p: 'h.on', toggle: true, led: true, ledColor: '#ff2a1a', ledDy: -8 }),
        BTN('REVERB', { p: 'rv.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('ECHO', { p: 'dl.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }), BTN('DOUBLE', { p: 'db.on', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -8 }),
        TOG('phantom', '48V', ['OFF', 'ON'], { virtual: true })],
      initParams: { tone: 1 },
      derive: (u) => Object.assign(harmP('h', 0, 0.5, u.key), { 'rv.mix': 0.3 * (u.fxlvl ?? 0.6), 'dl.mix': 0.3 * (u.fxlvl ?? 0.6), 'db.blend': 0.6 * (u.fxlvl ?? 0.6), 'cp.on': u.tone ?? 1, 'eq.on': u.tone ?? 1 }),
      desc: 'Mic-stand processor for singers who play keys: harmony, reverb, echo and doubling. The keyboard input is mixed in.' }),
  ];



  // Units with a voice / guitar split: the engine feeds a free guitar jack with the mic signal, so the guitar lane
  // starts with a gain stage that stays muted until a cable is plugged into the guitar input (port 1).
  const split = defs.filter((d) => d.algo === 'chain' && d.opts.chain.some((s) => s.ch === 0 || s.ch === 1));
  for (const d of split) {
    d.opts.chain.unshift({ prefix: 'gin', algo: 'utility', ch: 1, opts: { kind: 'gain' }, params: { level: -60 } });
    const base = d.derive;
    d.derive = (u) => Object.assign(base ? base(u) : {}, { 'gin.level': (u.gconn ?? 0) > 0.5 ? 0 : -60 });
    tz.blockHooks(d.id, {
      status(view) {
        const id = view.block.id;
        const on = tz.app.state.preset.cables.some((c) => c.to && c.to.node === id && c.to.port === 1) ? 1 : 0;
        if ((view.block.params.gconn ?? 0) !== on) tz.app.setParam(id, 'gconn', on);
      },
    });
  }

  tz.addDefs(defs);

  // preset step footswitches on the floor units
  for (const id of ['tch.voicelive-play', 'tch.play-acoustic', 'tch.play-electric', 'tch.voicelive3x']) {
    tz.blockHooks(id, {
      foot(v, c, down) {
        if (c.action !== 'step') return false;
        if (down) {
          const ui = tz.app.ui(v.block);
          const n = PRESETS.length;
          tz.app.setParam(v.block.id, 'preset', (Math.round(ui.preset ?? 0) + c.step + n) % n);
        }
        return true;
      },
    });
  }
}
