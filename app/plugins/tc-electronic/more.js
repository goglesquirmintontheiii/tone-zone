// More TC Electronic blocks: the current lineup that was not in index.js yet
// (X4 / X3 / X1 boards, minis, the newer budget pedals, preamps, bass heads and loopers).
export function registerMore(tz, kit) {
  const { K, SEL, TOG, BTN, FOOT, LED, SCREEN, def, ms } = tz.helpers;
  const { svg, label, setText } = tz.gfx;
  const { TC, TP, k, NOTES } = kit;
  const B = 'TC Electronic';
  const T = (o = {}) => K('time', 'DELAY', Object.assign({ min: 20, max: 2000, curve: 'log', def: 420, display: ms }, o));
  const pin = (c, x, y, o = {}) => Object.assign(c, { x, y, pinned: true }, o);

  // small LCD: shows names[ui[p]], or the value of p in ms
  tz.addScreen('tc-lcd', {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, rx: 2, fill: s.ctl.bg || '#07121c' }, g);
      s.l1 = label(g, w / 2, h * 0.42, '', { size: Math.min(11, h * 0.42), fill: s.ctl.ink || '#7fd0ff', font: "'Share Tech Mono', monospace", weight: 700 });
      s.l2 = label(g, w / 2, h * 0.8, s.ctl.sub || '', { size: Math.min(6, h * 0.24), fill: s.ctl.ink || '#7fd0ff', font: "'Share Tech Mono', monospace", opacity: 0.7 });
      s.last = null;
    },
    update(s, st, nv) {
      const ui = s.ui || tz.app.ui(nv.block);
      const v = ui[s.ctl.p];
      let txt;
      if (s.ctl.fmt === 'ms') txt = Math.round(v ?? 0) + ' ms';
      else txt = (s.ctl.names || [])[Math.round(v ?? 0)] || '';
      if (txt !== s.last) { setText(s.l1, txt); s.last = txt; }
    },
  });

  // preset footswitches (X4 pedals): pressing another preset saves the current knobs and loads that slot,
  // pressing the active preset toggles bypass like the real thing
  function presetFeet(id, keys) {
    const handled = new Map();
    tz.blockHooks(id, {
      foot(v, c, down) {
        if (c.preset === undefined) return false;
        const bid = v.block.id;
        if (down) {
          const ui = tz.app.ui(v.block);
          const cur = Math.round(ui._pre ?? 0);
          if (cur === c.preset) { handled.set(bid, false); return false; }
          for (const key of keys) tz.app.setParam(bid, `_s${cur}_${key}`, ui[key]);
          for (const key of keys) {
            const val = ui[`_s${c.preset}_${key}`];
            if (val !== undefined) tz.app.setParam(bid, key, val);
          }
          tz.app.setParam(bid, '_pre', c.preset);
          handled.set(bid, true);
          return true;
        }
        const h = handled.get(bid);
        handled.delete(bid);
        return !!h;
      },
    });
  }
  const PF = (i) => FOOT({ action: 'bypass', preset: i, label: ['A', 'B', 'C'][i] });
  const PL = (i, color = '#ff2a1a') => LED({ bind: 'fn', color, ledFn: (ui, b) => (!b.bypass && Math.round(ui._pre ?? 0) === i ? color : null) });

  // delay types shared by the Flashback style pedals: [min ms, max ms, mode, tone, mod depth]
  const FB_TYPES = ['2290', 'ANA', 'TAPE', 'LOFI', 'DYN', 'MOD', 'PING', 'SLAP', 'REV', 'CRYS', 'LOOP', 'TP'];
  const FB_T = [[0, 0.82, 0], [1, 0.4, 0.1], [2, 0.55, 0.15], [3, 0.3, 0], [10, 0.72, 0], [4, 0.7, 0.4], [7, 0.75, 0], [0, 0.7, 0], [5, 0.7, 0], [6, 0.75, 0], [8, 0.7, 0], [4, 0.6, 0.25]];
  const HOF_TYPES = ['SPR', 'ROOM', 'HALL', 'CHUR', 'PLATE', 'LOFI', 'MOD', 'TILE', 'SHIM', 'TP'];
  const hofDerive = (t, pre) => ({
    mode: [3, 0, 1, 1, 2, 0, 6, 0, 4, 5][t], size: [0.4, 0.35, 0.6, 0.95, 0.5, 0.3, 0.6, 0.2, 0.7, 0.8][t],
    predelay: [4, 25, 70][pre ?? 1], highdamp: t === 5 ? 0.92 : t === 7 ? 0.15 : 0.5, lowcut: t === 5 ? 0.5 : 0.15,
  });

  // preamp pedal (two channels, cab-sim DI out and phones): chain amp -> [reverb] -> cab on channel 2
  const PRE = (o) => TC(Object.assign({
    cat: 'Preamp', kind: 'Preamp', tcSize: 'pre', noStd: true, cost: 3.4, algo: 'chain', topJacks: true,
    ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DI OUT (CAB SIM)', 'PHONES'] }, jackKinds: { o2: 'mini' },
  }, o, {
    opts: { chain: [
      { prefix: 'a', algo: 'amp', opts: { models: o.models, preamp: true } },
      ...(o.reverb ? [{ prefix: 'r', algo: 'reverb', params: { mode: 3, decay: 0.45, size: 0.4, predelay: 4 } }] : []),
      { prefix: 'c', algo: 'cab', ch: 1, opts: { model: o.cab }, params: { m1pos: 0.35 } },
    ] },
    controls: [...o.controls,
      FOOT({ action: 'toggle', p: 'a.channel', def: 0, label: o.reverb ? 'CHANNEL' : 'CH A / B' }), o.reverb ? FOOT({ action: 'toggle', p: 'r.on', def: 1, label: 'REVERB' }) : FOOT({ label: 'ON' }),
      LED({ bind: 'param:a.channel', color: '#ffb000' }), o.reverb ? LED({ bind: 'param:r.on', color: '#3ddc84' }) : LED({ color: '#ff2a1a' })],
  }));

  // compact class-D bass head (mini metal chassis), drawn by the tc-head form below
  tz.addForm('tc-head', (ctx, d) => {
    const g = ctx.g;
    const knobs = d.controls.filter((c) => c.t === 'knob' || c.t === 'sel');
    const w = d.fw || Math.max(300, 60 + knobs.length * 40), h = d.fh || 120;
    const col = d.color, txt = d.text || '#e8e8e8';
    tz.gfx.formKit.body(g, w, h, col, { rx: 8, brushed: d.brushed });
    // front panel
    svg('rect', { x: 8, y: 30, width: w - 16, height: h - 40, rx: 4, fill: d.panel || '#141518', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    const ptxt = d.panelText || '#e8e8e8';
    const logo = d.logo || d.name;
    label(g, 16, 20, logo, { size: 13, fill: d.logoColor || txt, weight: 800, anchor: 'start', font: "'Inter', sans-serif" });
    label(g, 22 + logo.length * 9, 20.5, (d.typeName || '').toLowerCase(), { size: 6, fill: txt, anchor: 'start', opacity: 0.7, font: "'Inter', sans-serif", weight: 600 });
    const x0 = 56, x1 = w - 46;
    knobs.forEach((c, i) => Object.assign(c, { x: knobs.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (knobs.length - 1), y: 70, r: 10.5, labelPos: 'below', labelSize: 5.4 }));
    for (const c of d.controls) {
      if (c.t === 'led') Object.assign(c, { x: w - 24, y: 52, r: 3.2 });
      if (c.t === 'foot') Object.assign(c, { style: 'soft', x: w - 24, y: 82, r: 6.5, label: '' });
    }
    label(g, 26, 52, 'INPUT', { size: 5, fill: ptxt, weight: 700, ls: 0.8 });
    const theme = { text: ptxt, knob: d.knob || 'mxr', labelSize: 5.4, labelLs: 0.5 };
    tz.gfx.formKit.placeControls(ctx, d.controls, theme);
    // input on the front panel, outputs on the back (top edge, right half)
    const jacks = [{ key: 'i0', dir: 'in', port: 0, label: '', side: 'face', faceX: 26, x: 26, y: 68 }];
    const no = d.ports.outs.length;
    d.ports.outs.forEach((l, i) => jacks.push({ key: `o${i}`, dir: 'out', port: i, label: l.replace(' OUT', ''), side: 'top', x: w - 40 - (no - 1 - i) * 52, y: -2 }));
    return { w, h, theme: Object.assign({}, theme, { jackText: '#ddd' }), jacks };
  });
  const HEAD = (o) => def(Object.assign({
    brand: B, form: 'tc-head', cat: 'Bass Amp', kind: 'Amp', algo: 'amp', cost: 2.6, tags: ['bass'],
    ports: { ins: ['INPUT'], outs: ['SPEAKER OUT', 'XLR DI OUT', 'PHONES'] }, jackKinds: { o1: 'xlr', o2: 'phones' }, fixed: { level: -3 },
  }, o, { controls: [...o.controls, LED({ color: '#3d8bff' }), FOOT({ action: 'bypass' })] }));
  const bassVoice = (o) => Object.assign({ base: 'markbass', power: 3, sag: 0.1 }, o);

  // X1 boards: [prefix, A, B, C params]
  const X1_BOARDS = [['r', 'r.decay', 'r.tone', 'r.mix'], ['d', 'd.time', 'd.feedback', 'd.mix'], ['m', 'm.rate', 'm.depth', 'm.mix'], ['f', 'f.speed', 'f.width', 'f.regen'],
    ['p', 'p.rate', 'p.depth', 'p.feedback'], ['m', 'm.rate', 'm.depth', 'm.tone'], ['c', 'c.sustain', 'c.attack', 'c.level']];
  const X1_NAMES = ['HALL OF FABLE', 'THROWBACK', 'CORONET', 'VERTEX', 'HELICAL', 'SHIVER', 'HYPERMASS'];
  const x1Derive = (u) => {
    const b = Math.round(u.board ?? 0);
    const [pre, pa, pb, pc] = X1_BOARDS[b];
    const out = { 'r.on': 0, 'd.on': 0, 'm.on': 0, 'f.on': 0, 'p.on': 0, 'c.on': 0 };
    out[pre + '.on'] = 1;
    const a = u.ka ?? 0.5, bb = u.kb ?? 0.5, cc = u.kc ?? 0.5;
    out[pa] = pa === 'd.time' ? 60 + 1400 * a * a : a;
    out[pb] = pb === 'd.feedback' ? bb * 0.85 : bb;
    out[pc] = pc === 'c.level' ? 0.2 + cc * 0.35 : pc.endsWith('mix') ? cc * 0.8 : cc;
    out['m.mode'] = b === 5 ? 1 : 0;
    if (b === 5) out['m.mix'] = 1;
    return out;
  };
  const X1 = (o) => TC(Object.assign({
    cat: 'Multi-FX', kind: 'Multi-FX', tcSize: 'budget', stereo: 'both', cost: 2.6, tagline: 'toneprint multi', nameY: 150, noStd: true,
    algo: 'chain', opts: { chain: [
      { prefix: 'c', algo: 'comp', opts: { type: 'vca' }, on: false, params: { ratio: 0.5 } },
      { prefix: 'm', algo: 'chorus', on: false },
      { prefix: 'f', algo: 'flanger', on: false },
      { prefix: 'p', algo: 'phaser', on: false, params: { stages: 4 } },
      { prefix: 'd', algo: 'delay', opts: { maxMs: 1600 }, on: false, params: { tone: 0.78 } },
      { prefix: 'r', algo: 'reverb', params: { mode: 1 } },
    ] },
    controls: [
      pin(SCREEN('tc-lcd', { p: 'board', names: X1_NAMES, sub: 'board / slot A' }), 62, 36, { w: 96, h: 28 }),
      pin(k('ka', 'A', { virtual: true, def: 0.5 }), 30, 80, { r: 10, labelPos: 'below' }), pin(k('kb', 'B', { virtual: true, def: 0.5 }), 62, 80, { r: 10, labelPos: 'below' }),
      pin(k('kc', 'C', { virtual: true, def: 0.4 }), 94, 80, { r: 10, labelPos: 'below' }),
      pin(SEL('board', '', ['1', '2', '3', '4', '5', '6', '7'], { virtual: true, sweep: 220, optSize: 4.2, labelRadius: 7, labelPos: 'none' }), 62, 122, { r: 9 }),
      FOOT(), pin(LED({ color: '#ff2a1a' }), 100, 122, { r: 2.8 }),
    ],
    derive: x1Derive,
    desc: 'Seven boards of TonePrint-style effects (reverb, delay, chorus, flanger, phaser, vibrato, compressor). Knobs A, B and C change with the board.',
  }, o));

  tz.addDefs([
    // ---------------------------------------------------------------- multi
    X1({ id: 'tc.plethorax1', name: 'Plenty X1', ref: 'TC Electronic Plethora X1', code: 'PLX1', logo: 'plenty x1', color: '#17181b', text: '#ececec' }),
    X1({ id: 'tc.plethorax1neo', name: 'Plenty X1 Neon', ref: 'TC Electronic Plethora X1 Neo', code: 'PLX1 N', logo: 'plenty x1', tagline: 'neon multi', color: '#ecedef', text: '#17181b', logoColor: '#13a58a' }),
    def({
      id: 'tc.plethorax3', name: 'Plenty X3', ref: 'TC Electronic Plethora X3', brand: B, code: 'PLX3', logo: 'plenty x3', typeName: 'three-slot pedalboard', cat: 'Multi-FX', kind: 'Multi-FX',
      form: 'tc-x5', color: '#17181b', text: '#ececec', algo: 'chain', stereo: 'both', alwaysOn: true, cost: 2.4,
      slots: [{ name: 'MOJA', sub: 'overdrive', color: '#ff8a6b' }, { name: 'THROWBACK', sub: 'delay 2290', color: '#9cff8f' }, { name: 'HALL', sub: 'reverb', color: '#ffd36b' }],
      opts: { chain: [
        { prefix: 'o', algo: 'drive', on: false, opts: { clip: 'asym', bias: 0.2, preHp: 70, gainMinDb: 2, gainMaxDb: 34, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 9000, levelMaxDb: 8 }, params: { tone: 0.55, level: 0.5 } },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { time: 420, feedback: 0.32, tone: 0.78 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 1, decay: 0.5 } },
      ] },
      controls: [
        k('o.gain', 'DRIVE', { slot: 0, def: 0.45 }), k('d.mix', 'FX LEVEL', { slot: 1, def: 0.3 }), k('r.mix', 'LEVEL', { slot: 2, def: 0.3 }),
        ...['o', 'd', 'r'].flatMap((x, i) => [FOOT({ action: 'toggle', p: x + '.on', slot: i, def: [0, 1, 1][i] }), LED({ bind: 'param:' + x + '.on', slot: i, color: '#ff2a1a' })]),
      ],
      ports: { ins: ['INPUT L', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] },
      desc: 'Three slots on one board: overdrive, delay and reverb. Each footswitch turns its slot on or off.',
    }),

    // ---------------------------------------------------------------- reverbs
    TC({
      id: 'tc.skysurfer', name: 'Skyrider Reverb', ref: 'TC Electronic Skysurfer Reverb', code: 'SKY', logo: 'skyrider', tagline: 'reverb', cat: 'Reverb', tcSize: 'budget',
      color: '#7cc6e8', text: '#0d2230', art: 'wave', artColor: '#ffffff', artOpacity: 0.35, stereo: 'both', algo: 'reverb',
      controls: [k('decay', 'DECAY', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), k('mix', 'MIX', { def: 0.32 }), TOG('mode', '', ['SPRING', 'ROOM', 'HALL'], { values: [3, 0, 1], def: 2 })],
      desc: 'Simple reverb with spring, room and hall modes.',
    }),
    TC({
      id: 'tc.skysurfermini', name: 'Skyrider Mini', ref: 'TC Electronic Skysurfer Mini Reverb', code: 'SKY M', logo: 'skyrider', tagline: 'mini reverb', cat: 'Reverb', tcSize: 'mini',
      color: '#7cc6e8', text: '#0d2230', art: 'wave', artColor: '#ffffff', artOpacity: 0.35, stereo: 'both', algo: 'reverb',
      controls: [k('decay', 'DECAY', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), k('mix', 'MIX', { def: 0.32 }), TOG('mode', '', ['SPR', 'ROOM', 'HALL'], { values: [3, 0, 1], def: 2 })],
    }),
    TC({
      id: 'tc.drip', name: 'Drop Spring Reverb', ref: 'TC Electronic Drip Spring Reverb', code: 'DROP', logo: 'drop', tagline: 'spring reverb', cat: 'Reverb', tcSize: 'budget',
      color: '#3fb7b0', text: '#062220', art: 'drop', artColor: '#ffffff', artOpacity: 0.3, algo: 'reverb', fixed: { mode: 3, size: 0.4, predelay: 4 },
      controls: [k('decay', 'DWELL', { def: 0.5 }), k('tone', 'TONE', { def: 0.6 }), k('mix', 'MIX', { def: 0.35 }), TOG('lowcut', '', ['FULL', 'LIGHT'], { values: [0.1, 0.45] })],
      desc: 'Amp-style spring tank with dwell, tone and mix.',
    }),
    TC({
      id: 'tc.hof', name: 'Hall of Fable', ref: 'TC Electronic Hall of Fame Reverb (legacy)', code: 'HOF', logo: 'hall of fable', typeName: 'Reverb', tagline: 'legacy reverb', cat: 'Reverb',
      color: '#1a1b1f', text: '#d9dde4', art: 'star', artColor: '#c9ccd2', artOpacity: 0.3, stereo: 'both', algo: 'reverb', cost: 1.1,
      controls: [k('decay', 'DECAY', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), k('mix', 'LEVEL', { def: 0.35 }),
        SEL('rtype', 'TYPE', HOF_TYPES, { def: 2, sweep: 300, small: true, r: 9, optSize: 3.9, labelRadius: 8, labelPos: 'none', virtual: true }),
        TOG('pre', '', ['SHORT', 'MED', 'LONG'], { def: 1, virtual: true })],
      derive: (p) => hofDerive(p.rtype ?? 2, p.pre),
      desc: 'The first-generation ten-type reverb. Toggle sets the pre-delay.',
    }),
    TC({
      id: 'tc.hof2x4', name: 'Hall of Fable 2 X4', ref: 'TC Electronic Hall of Fame 2 X4 Reverb', code: 'HOF X4', logo: 'hall of fable 2 x4', typeName: 'Reverb', cat: 'Reverb', tcSize: 'x4', noStd: true,
      color: '#2c2d31', text: '#efe6d2', art: 'star', artColor: '#d8b36a', artOpacity: 0.3, stereo: 'both', algo: 'reverb', cost: 1.2,
      controls: [k('decay', 'DECAY', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), k('mix', 'LEVEL', { def: 0.35 }),
        SEL('rtype', 'TYPE', HOF_TYPES, { def: 2, sweep: 300, small: true, r: 9, optSize: 3.9, labelRadius: 8, labelPos: 'none', virtual: true }),
        TOG('pre', '', ['SHORT', 'MED', 'LONG'], { def: 1, virtual: true }),
        PF(0), PF(1), PF(2), FOOT({ action: 'toggle', p: 'hold', def: 0, label: 'HOLD', virtual: true }),
        PL(0), PL(1), PL(2), LED({ bind: 'param:hold', color: '#3d8bff' })],
      derive: (p) => Object.assign(hofDerive(p.rtype ?? 2, p.pre), p.hold ? { decay: 1, highdamp: 0.3 } : {}),
      desc: 'Hall of Fable 2 with three presets (A, B, C) and a HOLD switch for endless decay. Press the lit preset to bypass.',
    }),

    // ---------------------------------------------------------------- delays
    TC({
      id: 'tc.2290p', name: '2920 Dynamic Delay', ref: 'TC Electronic 2290 P Dynamic Digital Delay', code: '2920', logo: '2920 delay', typeName: 'Digital delay', cat: 'Delay', tcSize: 'x3', noStd: true,
      color: '#c9cbcf', text: '#17191c', stereo: 'both', algo: 'delay', opts: { maxMs: 2400 }, cost: 0.9, knobY: 88, nameY: 140,
      controls: [pin(SCREEN('tc-lcd', { p: 'time', fmt: 'ms', bg: '#1a0303', ink: '#ff4a2a', sub: 'delay time' }), 114, 38, { w: 108, h: 32 }),
        T({ def: 480 }), k('feedback', 'FEEDBACK', { def: 0.3, max: 0.95 }), k('mix', 'LEVEL', { def: 0.35 }), k('moddepth', 'DEPTH', { def: 0.1 }), k('modrate', 'SPEED', { def: 0.3 }),
        pin(TOG('mode', '', ['MONO', 'PING'], { virtual: true, orient: 'v' }), 196, 38),
        FOOT({ label: 'ON' }), FOOT({ action: 'tap', label: 'TAP' }), FOOT({ action: 'event', label: 'HOLD', event: { type: 2, value: 0, arg: 0 }, hold: { ms: 150, event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }),
        LED({ color: '#ff2a1a' }), LED({ bind: 'tap:time', color: '#ffb000' }), LED({ color: '#3d8bff', bind: 'onparam:mix' })],
      fixed: { tone: 0.85 },
      derive: (p) => ({ mode: [0, 7][Math.round(p.mode ?? 0)] ?? 0 }),
      desc: 'Studio-style digital delay with modulation, tap tempo and a hold switch. The display shows the delay time.',
    }),
    TC({
      id: 'tc.bucketbrigade', name: 'Bucket Chain Analog Delay', ref: 'TC Electronic Bucket Brigade Analog Delay', code: 'BKC', logo: 'bucket chain', typeName: 'Analog delay', cat: 'Delay',
      color: '#2f4a3a', text: '#e6f2e8', art: 'bars', artOpacity: 0.2, algo: 'delay', opts: { maxMs: 600 }, fixed: { mode: 1, tone: 0.42 },
      controls: [T({ max: 600, def: 320 }), k('feedback', 'FEEDBACK', { def: 0.35, max: 1.0 }), k('mix', 'LEVEL', { def: 0.4 }), k('moddepth', 'MOD', { small: true, def: 0.1 }), TOG('age', '', ['CLEAN', 'DIRTY'], { values: [0.2, 0.7] })],
      desc: 'Bucket-brigade analog delay, up to 600 ms. MOD adds a slow wobble.',
    }),
    TC({
      id: 'tc.echobrain', name: 'Echomind Analog Delay', ref: 'TC Electronic Echobrain Analog Delay', code: 'ECM', logo: 'echomind', tagline: 'analog delay', cat: 'Delay', tcSize: 'budget',
      color: '#d98aa8', text: '#2a0a18', art: 'brain', artColor: '#5a1030', artOpacity: 0.28, algo: 'delay', opts: { maxMs: 600 }, fixed: { mode: 1, tone: 0.38 },
      controls: [T({ max: 600, def: 300 }), k('feedback', 'REPEATS', { def: 0.35 }), k('mix', 'LEVEL', { def: 0.4 })],
    }),
    TC({
      id: 'tc.gauss', name: 'Tesla Tape Echo', ref: 'TC Electronic Gauss Tape Echo', code: 'TSL', logo: 'tesla', tagline: 'tape echo', cat: 'Delay', tcSize: 'budget',
      color: '#e7dcc0', text: '#2b1f10', art: 'echo', artColor: '#6a4a20', artOpacity: 0.3, algo: 'delay', opts: { maxMs: 1000 }, fixed: { mode: 2, tone: 0.5, sat: 0.4 },
      controls: [T({ max: 1000, def: 360 }), k('feedback', 'REPEATS', { def: 0.38 }), k('mix', 'MIX', { def: 0.4 }), k('age', 'WOBBLE', { small: true, def: 0.35 })],
      desc: 'Tape echo with wow and flutter (WOBBLE).',
    }),
    TC({
      id: 'tc.prophet', name: 'The Oracle Digital Delay', ref: 'TC Electronic The Prophet Digital Delay', code: 'ORC', logo: 'the oracle', tagline: 'digital delay', cat: 'Delay', tcSize: 'budget',
      color: '#1c1c1e', text: '#efefef', art: 'eye', artColor: '#c9a74c', artOpacity: 0.3, stereo: 'both', algo: 'delay', opts: { maxMs: 1500 }, fixed: { mode: 0, tone: 0.75 },
      controls: [T({ max: 1500 }), k('feedback', 'FEEDBACK', { def: 0.32 }), k('mix', 'LEVEL', { def: 0.38 }), TOG('subdiv', '', ['1/4', '1/8.', '1/8'], { values: [0, 1, 2] })],
    }),
    TC({
      id: 'tc.flashback2x4', name: 'Throwback 2 X4', ref: 'TC Electronic Flashback 2 X4 Delay', code: 'TB X4', logo: 'throwback 2 x4', typeName: 'Delay', cat: 'Delay', tcSize: 'x4', noStd: true,
      color: '#e4e5e6', text: '#1a1b1d', art: 'echo', artOpacity: 0.28, stereo: 'both', algo: 'delay', opts: { maxMs: 2200 }, cost: 0.8,
      controls: [T(), k('feedback', 'FEEDBACK', { def: 0.35, max: 0.98 }), k('mix', 'FX LEVEL', { def: 0.4 }),
        SEL('dtype', 'TYPE', FB_TYPES, { def: 0, sweep: 300, small: true, r: 9, optSize: 3.6, labelRadius: 8, labelPos: 'none', virtual: true }),
        TOG('subdiv', '', ['1/4', '1/4.', 'BOTH'], { values: [0, 1, 2] }),
        PF(0), PF(1), PF(2), FOOT({ action: 'tap', label: 'TAP' }), PL(0), PL(1), PL(2), LED({ bind: 'tap:time', color: '#ffb000' })],
      derive: (p) => { const t = FB_T[p.dtype ?? 0]; return { mode: t[0], tone: t[1], moddepth: t[2] }; },
      desc: 'Delay with three presets (A, B, C) and a tap switch. Press the lit preset to bypass.',
    }),
    def({
      id: 'tc.flashbacktriple', name: 'Throwback Triple', ref: 'TC Electronic Flashback Triple Delay', brand: B, code: 'TB3', logo: 'throwback 3', typeName: 'three delays', cat: 'Delay', kind: 'Pedal',
      form: 'tc-x5', color: '#e4e5e6', text: '#1a1b1d', algo: 'chain', stereo: 'both', cost: 2.2,
      slots: [{ name: 'DELAY A', sub: '2290 1/4', color: '#9cff8f' }, { name: 'DELAY B', sub: 'tape 1/8.', color: '#ffd36b' }, { name: 'DELAY C', sub: 'analog 1/2', color: '#8fd3ff' }],
      opts: { chain: [
        { prefix: 'a', algo: 'delay', group: 1, opts: { maxMs: 2000 }, params: { time: 480, feedback: 0.3, tone: 0.8, mode: 0 } },
        { prefix: 'b', algo: 'delay', group: 1, on: false, opts: { maxMs: 2000 }, params: { time: 360, feedback: 0.35, tone: 0.55, mode: 2 } },
        { prefix: 'c', algo: 'delay', group: 1, on: false, opts: { maxMs: 2000 }, params: { time: 960, feedback: 0.25, tone: 0.4, mode: 1 } },
      ] },
      controls: [
        k('a.mix', 'FX LEVEL', { slot: 0, def: 0.35 }), k('b.mix', 'FX LEVEL', { slot: 1, def: 0.35 }), k('c.mix', 'FX LEVEL', { slot: 2, def: 0.3 }),
        ...['a', 'b', 'c'].flatMap((x, i) => [FOOT({ action: 'toggle', p: x + '.on', slot: i, def: i ? 0 : 1 }), LED({ bind: 'param:' + x + '.on', slot: i, color: '#ff2a1a' })]),
      ],
      ports: { ins: ['INPUT L', 'INPUT R'], outs: ['OUTPUT L', 'OUTPUT R'] },
      desc: 'Three delay engines side by side. Each footswitch turns its engine on or off; they run in parallel.',
    }),

    // ---------------------------------------------------------------- modulation
    TC({
      id: 'tc.coronamini', name: 'Coronet Mini', ref: 'TC Electronic Corona Mini Chorus', code: 'CRN M', logo: 'coronet', tagline: 'mini chorus', cat: 'Modulation', tcSize: 'mini',
      color: '#3ea4c8', text: '#0d1d24', art: 'rays', artColor: '#ffffff', artOpacity: 0.3, stereo: 'both', algo: 'chorus', fixed: { tone: 0.55 },
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.5 }), k('mix', 'FX LVL', { def: 0.5 }), TP()],
      derive: (p) => ({ mode: p.tp ? 2 : 0 }),
      desc: 'Mini chorus. The TP switch swaps in a lush tri-chorus.',
    }),
    TC({
      id: 'tc.mimiqmini', name: 'Mimik Mini', ref: 'TC Electronic Mimiq Mini Doubler', code: 'MMK M', logo: 'mimik', tagline: 'mini doubler', cat: 'Modulation', tcSize: 'mini',
      color: '#f0f0ee', text: '#151515', art: 'twin', artOpacity: 0.25, stereo: 'both', algo: 'deco', fixed: { satOn: 0, dtOn: 1, saturation: 0, tone: 0.55, type: 0 }, cost: 0.6,
      controls: [k('volume', 'DRY', { def: 0.5 }), k('blend', 'EFFECT', { def: 0.5 }), k('tight', 'TIGHT', { def: 0.6, virtual: true })],
      derive: (p) => ({ wobble: 0.55 * (1 - (p.tight ?? 0.6)), lag: 0.12 + 0.3 * (1 - (p.tight ?? 0.6)) }),
    }),
    TC({
      id: 'tc.scfgold', name: 'SCX Gold', ref: 'TC Electronic SCF Gold', code: 'SCX', logo: 'scx gold', typeName: 'Stereo chorus flanger', tagline: 'stereo chorus · flanger', cat: 'Modulation',
      color: '#c9a24a', text: '#1c1406', art: 'helix', artColor: '#3a2a08', artOpacity: 0.2, stereo: 'both', algo: 'chain', cost: 1,
      opts: { chain: [{ prefix: 'c', algo: 'chorus', params: { mix: 0.5 } }, { prefix: 'f', algo: 'flanger', on: false, params: { mix: 0.5 } }] },
      controls: [k('speed', 'SPEED', { def: 0.35, virtual: true }), k('width', 'WIDTH', { def: 0.5, virtual: true }), k('inten', 'INTENSITY', { def: 0.5, virtual: true }),
        TOG('mode', '', ['CHORUS', 'PITCH', 'FLANGE'], { virtual: true, orient: 'v' }), TOG('fast', '', ['SLOW', 'FAST'], { virtual: true })],
      derive: (p) => {
        const m = Math.round(p.mode ?? 0), sp = (p.speed ?? 0.35) * (p.fast ? 1 : 0.5) + (p.fast ? 0.4 : 0);
        return { 'c.on': m < 2 ? 1 : 0, 'f.on': m === 2 ? 1 : 0, 'c.rate': sp, 'c.depth': p.width ?? 0.5, 'c.mode': m === 1 ? 1 : 0, 'c.mix': m === 1 ? 1 : 0.5,
          'c.feedback': (p.inten ?? 0.5) * 0.3, 'f.speed': sp * 0.8, 'f.width': p.width ?? 0.5, 'f.regen': 0.3 + (p.inten ?? 0.5) * 0.6 };
      },
      desc: 'Reissue of the classic stereo chorus, pitch modulation and flanger. SLOW / FAST picks the speed range.',
    }),
    TC({
      id: 'tc.scfgoldse', name: 'SCX Gold SE', ref: 'TC Electronic SCF Gold SE', code: 'SCX SE', logo: 'scx gold se', typeName: 'Stereo chorus flanger', tagline: 'special edition', cat: 'Modulation',
      color: '#151515', text: '#d9b860', art: 'helix', artColor: '#d9b860', artOpacity: 0.22, stereo: 'both', algo: 'chain', cost: 1,
      opts: { chain: [{ prefix: 'c', algo: 'chorus', params: { mix: 0.5 } }, { prefix: 'f', algo: 'flanger', on: false, params: { mix: 0.5 } }] },
      controls: [k('speed', 'SPEED', { def: 0.35, virtual: true }), k('width', 'WIDTH', { def: 0.5, virtual: true }), k('inten', 'INTENSITY', { def: 0.5, virtual: true }),
        TOG('mode', '', ['CHORUS', 'PITCH', 'FLANGE'], { virtual: true, orient: 'v' }), TOG('fast', '', ['SLOW', 'FAST'], { virtual: true })],
      derive: (p) => {
        const m = Math.round(p.mode ?? 0), sp = (p.speed ?? 0.35) * (p.fast ? 1 : 0.5) + (p.fast ? 0.4 : 0);
        return { 'c.on': m < 2 ? 1 : 0, 'f.on': m === 2 ? 1 : 0, 'c.rate': sp, 'c.depth': p.width ?? 0.5, 'c.mode': m === 1 ? 1 : 0, 'c.mix': m === 1 ? 1 : 0.5,
          'c.feedback': (p.inten ?? 0.5) * 0.3, 'f.speed': sp * 0.8, 'f.width': p.width ?? 0.5, 'f.regen': 0.3 + (p.inten ?? 0.5) * 0.6 };
      },
      desc: 'Black and gold edition of the stereo chorus flanger.',
    }),
    TC({
      id: 'tc.3rddimension', name: '3rd Plane Chorus', ref: 'TC Electronic 3rd Dimension Chorus', code: '3RD', logo: '3rd plane', tagline: 'chorus', cat: 'Modulation', tcSize: 'budget',
      color: '#b9bcc2', text: '#14161a', art: 'rays', artColor: '#2f6fd6', artOpacity: 0.25, stereo: 'both', algo: 'chorus', fixed: { mode: 3, mix: 0.5, tone: 0.6 },
      controls: [1, 2, 3, 4].map((i) => BTN(String(i), { p: 'b' + i, toggle: true, led: true, ledColor: '#3d8bff', ledDy: -9, r: 5.5, labelPos: 'below', virtual: true })),
      initParams: { b1: 1 },
      derive: (p) => {
        const m = p.b4 ? 4 : p.b3 ? 3 : p.b2 ? 2 : p.b1 ? 1 : 0;
        return { rate: [0.25, 0.25, 0.3, 0.38, 0.45][m], depth: [0.2, 0.25, 0.4, 0.55, 0.75][m] };
      },
      desc: 'Dimension-style chorus: four push buttons from subtle (1) to wide (4).',
    }),
    TC({
      id: 'tc.june60v2', name: 'July-60 V2', ref: 'TC Electronic June-60 V2 Chorus', code: 'J-60 V2', logo: 'july-60 v2', tagline: 'stereo chorus', cat: 'Modulation', tcSize: 'budget',
      color: '#2a2b2e', text: '#ececec', art: 'stripes', artOpacity: 0.16, stereo: 'stereo', algo: 'chorus', opts: { style: 'bbd' }, fixed: { mode: 0, mix: 0.5 },
      controls: [BTN('I', { p: 'b1', toggle: true, led: true, ledColor: '#ff3a2a', ledDy: -9, r: 6, labelPos: 'below', virtual: true }), BTN('II', { p: 'b2', toggle: true, led: true, ledColor: '#ff3a2a', ledDy: -9, r: 6, labelPos: 'below', virtual: true }),
        TOG('tone', '', ['DARK', 'BRIGHT'], { values: [0.45, 0.65], def: 1 })],
      initParams: { b1: 1, b2: 0 },
      derive: (p) => { const m = p.b1 && p.b2 ? 3 : p.b2 ? 2 : 1; return { rate: [0.3, 0.3, 0.42, 0.82][m], depth: [0.5, 0.5, 0.6, 0.22][m] }; },
      desc: 'Synth-style BBD chorus, now stereo, with a voicing switch.',
    }),
    TC({
      id: 'tc.bloodmoon', name: 'Red Moon Phaser', ref: 'TC Electronic Blood Moon Phaser', code: 'RMN', logo: 'red moon', tagline: 'phaser', cat: 'Modulation', tcSize: 'budget',
      color: '#8e1a1a', text: '#ffe6e0', art: 'sun', artColor: '#ffb0a0', artOpacity: 0.28, algo: 'phaser', fixed: { mix: 0.5 },
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.8 }), k('feedback', 'FEEDBACK', { def: 0.3 }), TOG('stages', '', ['VINTAGE', 'MODERN'], { values: [4, 6] })],
    }),
    TC({
      id: 'tc.tailspin', name: 'Spintail Vibrato', ref: 'TC Electronic Tailspin Vibrato', code: 'SPT', logo: 'spintail', tagline: 'vibrato', cat: 'Modulation', tcSize: 'budget',
      color: '#e2832b', text: '#2a1404', art: 'spiral', artColor: '#5a2a00', artOpacity: 0.28, algo: 'chorus', opts: { baseMs: 4, depthMs: 3 }, fixed: { mode: 1, mix: 1, tone: 0.6 },
      controls: [k('rate', 'SPEED', { def: 0.45 }), k('depth', 'DEPTH', { def: 0.5 }), k('delay', 'RISE', { def: 0.3 }), TOG('latch', '', ['LATCH', 'MOM'], { virtual: true })],
      momentaryWhen: (p) => p.latch === 1,
      desc: 'Pitch vibrato. MOM makes the switch momentary, RISE sets how fast it comes in.',
    }),
    TC({
      id: 'tc.vibraclone', name: 'Vibratwin Rotary', ref: 'TC Electronic Vibraclone Rotary', code: 'VTW', logo: 'vibratwin', tagline: 'rotary speaker', cat: 'Modulation', tcSize: 'budget',
      color: '#6e4426', text: '#f6e6d0', art: 'spiral', artColor: '#f6e6d0', artOpacity: 0.2, stereo: 'both', algo: 'rotary', fixed: { mix: 1, level: 0.5 },
      controls: [k('drive', 'DRIVE', { def: 0.2 }), k('balance', 'BALANCE', { def: 0.5 }), k('accel', 'RAMP', { def: 0.5 }), TOG('speed', '', ['SLOW', 'FAST'], { values: [0, 1] })],
      desc: 'Rotary speaker with horn / drum balance and ramp time between slow and fast.',
    }),
    TC({
      id: 'tc.pipeline', name: 'Pipework Tap Tremolo', ref: 'TC Electronic Pipeline Tap Tremolo', code: 'PPW', logo: 'pipework', tagline: 'tap tremolo', cat: 'Modulation', tcSize: 'budget',
      color: '#2f6fb0', text: '#eaf3ff', art: 'pipe', artOpacity: 0.25, stereo: 'both', algo: 'tremolo', fixed: { level: 0.5 },
      controls: [k('rate', 'SPEED', { def: 0.45 }), k('depth', 'DEPTH', { def: 0.6 }), k('wave', 'SHAPE', { def: 0.3 }), TOG('mode', '', ['OPTO', 'HARM', 'BIAS'], { values: [0, 1, 2], orient: 'v' })],
    }),

    // ---------------------------------------------------------------- drives
    TC({
      id: 'tc.fangs', name: 'Teeth Metal Distortion', ref: 'TC Electronic Fangs Metal Distortion', code: 'TTH', logo: 'teeth', tagline: 'metal distortion', cat: 'Distortion', tcSize: 'budget',
      color: '#141414', text: '#e8e8e8', logoColor: '#e02a2a', art: 'flame', artColor: '#e02a2a', artOpacity: 0.25,
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 12, preHp: 110, gainMinDb: 14, gainMaxDb: 52, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 800, trebleF: 3400, postLp: 7400, levelMaxDb: -5 },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('level', 'LEVEL', { small: true })],
    }),
    TC({
      id: 'tc.elcambo', name: 'El Cambio Overdrive', ref: 'TC Electronic El Cambo Overdrive', code: 'ECB', logo: 'el cambio', tagline: 'overdrive', cat: 'Overdrive', tcSize: 'budget',
      color: '#b4572b', text: '#fff0e4', art: 'laurel', artColor: '#2a0f00', artOpacity: 0.25,
      algo: 'drive', opts: { clip: 'tube', bias: 0.15, preHp: 80, gainMinDb: 4, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 3000, postLp: 8000, levelMaxDb: 4 },
      controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('level', 'LEVEL', { small: true })],
      desc: 'British stack crunch in a box.',
    }),
    TC({
      id: 'tc.honeypot', name: 'Honey Jar Fuzz', ref: 'TC Electronic Honey Pot Fuzz', code: 'HJR', logo: 'honey jar', tagline: 'fuzz', cat: 'Fuzz', tcSize: 'budget',
      color: '#e9b52a', text: '#2a1a02', art: 'drop', artColor: '#6a3a00', artOpacity: 0.28,
      algo: 'drive', opts: { clip: 'muff', stages: 2, stage2Db: 10, preHp: 60, gainMinDb: 14, gainMaxDb: 46, tone: 'blend', blendLp: 600, blendHp: 1200, postLp: 7000, levelMaxDb: -2 },
      controls: [k('gain', 'SUSTAIN', { def: 0.6 }), k('tone', 'TONE'), k('level', 'VOLUME')],
    }),
    TC({
      id: 'tc.maguspro', name: 'Mage Pro Distortion', ref: 'TC Electronic Magus Pro', code: 'MGP', logo: 'mage pro', tagline: 'high gain distortion', cat: 'Distortion', tcSize: 'budget',
      color: '#22282c', text: '#e8eef2', logoColor: '#9be26a', art: 'star', artColor: '#9be26a', artOpacity: 0.22,
      algo: 'drive', opts: { clip: 'opamp', stages: 2, stage2Db: 10, preHp: 90, gainMinDb: 10, gainMaxDb: 48, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, postLp: 7600, levelMaxDb: -2 },
      controls: [k('gain', 'GAIN', { def: 0.55 }), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('level', 'LEVEL', { small: true })],
    }),
    TC({
      id: 'tc.grandmagus', name: 'Grand Mage Distortion', ref: 'TC Electronic Grand Magus Distortion', code: 'GMG', logo: 'grand mage', tagline: 'distortion', cat: 'Distortion', tcSize: 'budget',
      color: '#4a2d6b', text: '#f1e8ff', art: 'star', artColor: '#e8d0ff', artOpacity: 0.25,
      algo: 'drive', opts: { clip: 'diode', preHp: 80, gainMinDb: 8, gainMaxDb: 44, tone: 'rat', postLp: 8000, levelMaxDb: 0, modes: [{}, { preEq: [{ type: 'peak', f: 900, q: 0.8, db: 4 }] }] },
      controls: [k('gain', 'GAIN', { def: 0.5 }), k('tone', 'TONE'), k('level', 'LEVEL'), TOG('mode', '', ['CLASSIC', 'MID'])],
    }),
    TC({
      id: 'tc.mojomojopg', name: 'Moja Moja Signature', ref: 'TC Electronic MojoMojo Paul Gilbert Edition', code: 'MOJA S', logo: 'moja moja', typeName: 'Overdrive', tagline: 'signature overdrive', cat: 'Overdrive',
      color: '#ecebe6', text: '#1a1a1a', logoColor: '#d0261f', art: 'flame', artColor: '#d0261f', artOpacity: 0.22,
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 70, gainMinDb: 2, gainMaxDb: 36, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 9000, levelMaxDb: 8,
        modes: [{}, { preEq: [{ type: 'peak', f: 1100, q: 0.7, db: 4 }], gainMaxDb: 40 }] },
      fixed: { mid: 0.5 },
      controls: [k('gain', 'DRIVE'), k('level', 'LEVEL'), k('bass', 'BASS', { small: true }), TOG('mode', '', ['FAT', 'BRIGHT']), k('treble', 'TREBLE', { small: true })],
      desc: 'Signature MojoMojo voicing with a little more gain and mids.',
    }),
    TC({
      id: 'tc.spectradrive', name: 'SpectroDrive Bass', ref: 'TC Electronic SpectraDrive', code: 'SPD', logo: 'spectro drive', typeName: 'Bass preamp', tagline: 'bass preamp · drive', cat: 'Preamp', kind: 'Preamp', tags: ['bass'],
      color: '#151618', text: '#7ec8ff', art: 'spectrum', artOpacity: 0.25, algo: 'chain', cost: 1.2, krows: [4, 3],
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'XLR DI OUT'] }, jackKinds: { o1: 'xlr' },
      opts: { chain: [
        { prefix: 'c', algo: 'comp', opts: { type: 'vca' }, params: { attack: 0.3, release: 0.4, level: 0.36, ratio: 0.5 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'opamp', preHp: 40, gainMinDb: 4, gainMaxDb: 38, tone: 'eq3', eqRangeDb: 15, bassF: 80, midF: 600, trebleF: 3000, postLp: 6500, levelMaxDb: 4, cleanSum: true, cleanMix: 0 } },
      ] },
      controls: [k('d.gain', 'DRIVE', { def: 0.4 }), k('d.blend', 'BLEND', { def: 0.5 }), k('c.sustain', 'COMP', { def: 0.35 }), k('d.level', 'LEVEL', { def: 0.5 }),
        k('d.bass', 'BASS'), k('d.mid', 'MID'), k('d.treble', 'TREBLE')],
      desc: 'Bass preamp: compressor, drive with clean blend, 3-band EQ and an XLR DI out.',
    }),

    // ---------------------------------------------------------------- dynamics
    TC({
      id: 'tc.forcefield', name: 'Force Shield Compressor', ref: 'TC Electronic Forcefield Compressor', code: 'FSC', logo: 'force shield', tagline: 'compressor', cat: 'Dynamics', tcSize: 'budget',
      color: '#22436b', text: '#e3f0ff', art: 'shield', artOpacity: 0.25, algo: 'comp', opts: { type: 'vca' }, fixed: { release: 0.4, ratio: 0.55, knee: 0.6 },
      controls: [k('sustain', 'SUSTAIN', { def: 0.5 }), k('attack', 'ATTACK', { def: 0.3 }), k('level', 'LEVEL', { def: 0.36 }), TOG('blend', '', ['PARALLEL', 'FULL'], { values: [0.6, 1], def: 1 })],
    }),
    TC({
      id: 'tc.hypergravitymini', name: 'HyperMass Mini', ref: 'TC Electronic HyperGravity Mini Compressor', code: 'HPM M', logo: 'hypermass', tagline: 'mini compressor', cat: 'Dynamics', tcSize: 'mini',
      color: '#2c3e66', text: '#e3ecff', art: 'gravity', artOpacity: 0.28, algo: 'comp', opts: { type: 'vca' }, fixed: { release: 0.4 },
      controls: [k('sustain', 'SUSTAIN', { def: 0.5 }), k('level', 'LEVEL', { def: 0.36 }), k('attack', 'ATTACK', { def: 0.3 }), TP()],
      derive: (p) => (p.tp ? { ratio: 0.75, knee: 0.3 } : { ratio: 0.55, knee: 0.7 }),
    }),
    TC({
      id: 'tc.crescendo', name: 'Rise Auto Swell', ref: 'TC Electronic Crescendo Auto Swell', code: 'RSE', logo: 'rise', tagline: 'auto swell', cat: 'Dynamics', tcSize: 'budget',
      color: '#7a4fb0', text: '#f3eaff', art: 'sun', artColor: '#ffffff', artOpacity: 0.22, algo: 'swell', fixed: { level: 3 },
      controls: [k('sens', 'SENS', { def: 0.5 }), k('attack', 'SPEED', { def: 0.4 }), TOG('mode', '', ['SWELL', 'FADE'], { values: [0, 1] })],
      desc: 'Fades every note in, for violin-style swells.',
    }),

    // ---------------------------------------------------------------- pitch / sustain
    TC({
      id: 'tc.subnupmini', name: "Down'n'Up Mini", ref: "TC Electronic Sub'n'Up Mini Octaver", code: 'DNU M', logo: "down'n'up", tagline: 'mini octaver', cat: 'Pitch', tcSize: 'mini',
      color: '#3c7d4a', text: '#eefbe9', art: 'oct', artOpacity: 0.28, algo: 'pitch', fixed: { quality: 1, semis2: 12, tone: 0.7 }, cost: 0.8,
      controls: [k('level1', 'SUB', { def: 0.6 }), k('dry', 'DRY', { def: 0.8 }), k('level2', 'UP', { def: 0 }), TP()],
      derive: (p) => (p.tp ? { semis1: -12, vintage: 1 } : { semis1: -12, vintage: 0 }),
      desc: 'Polyphonic sub and up octaves. TP gives the classic mono tracking.',
    }),
    TC({
      id: 'tc.nether', name: 'Lower Realm Octaver', ref: 'TC Electronic Nether Octaver', code: 'LRM', logo: 'lower realm', tagline: 'octaver', cat: 'Pitch', tcSize: 'budget',
      color: '#3b2550', text: '#eee2ff', art: 'oct', artColor: '#c9a2ff', artOpacity: 0.3, algo: 'pitch', fixed: { quality: 1, semis1: -12, semis2: -24, vintage: 1 }, cost: 0.8,
      controls: [k('dry', 'DRY', { def: 0.8 }), k('level1', 'SUB 1', { def: 0.6 }), k('level2', 'SUB 2', { def: 0.2 }), k('tone', 'TONE', { small: true, def: 0.6 })],
      desc: 'Analog-style octave down: one and two octaves below with a tone control.',
    }),
    TC({
      id: 'tc.infinitemini', name: 'Endless Mini', ref: 'TC Electronic Infinite Mini Sample Sustainer', code: 'END M', logo: 'endless', tagline: 'mini sustainer', cat: 'Synth', tcSize: 'mini',
      color: '#e9e9ec', text: '#1b1c22', art: 'infinity', artOpacity: 0.3, noStd: true, stereo: 'both', algo: 'freeze', fixed: { mode: 0 }, cost: 0.7,
      controls: [k('mix', 'LEVEL', { def: 0.7 }), k('speed', 'ATTACK', { def: 0.3 }), k('decay', 'DECAY', { def: 1 }),
        FOOT({ action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 350, event: { type: 1, arg: 0 }, release: { type: 2, arg: 0 } } }), LED({ color: '#7ec8ff' })],
      desc: 'Tap to freeze / release, hold for a momentary freeze.',
    }),

    // ---------------------------------------------------------------- loopers
    TC({
      id: 'tc.ditto2', name: 'Likewise 2 Looper', ref: 'TC Electronic Ditto 2 Looper', code: 'LIKE 2', logo: 'likewise 2', tagline: 'looper', cat: 'Looper', tcSize: 'mini',
      color: '#c3c7cc', text: '#17191c', art: 'loop', artOpacity: 0.3, noStd: true, algo: 'looper', opts: { tracks: 1, maxSec: 300 }, stereo: 'both', alwaysOn: true, loopTracks: 1, cost: 0.2,
      controls: [k('level1', 'LOOP LEVEL', { def: 0.8 }),
        FOOT({ action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 900, event: { type: 2, arg: 0 } }, doubleHold: { event: { type: 3, arg: 0 } } }), LED({ bind: 'looper:track:0' })],
      desc: 'Press: record, play, overdub. Hold: stop. Hold again: clear.',
    }),
    TC({
      id: 'tc.dittostereo', name: 'Likewise Stereo Looper', ref: 'TC Electronic Ditto Stereo Looper', code: 'LIKE ST', logo: 'likewise stereo', tagline: 'stereo looper', cat: 'Looper', tcSize: 'budget',
      color: '#c3c7cc', text: '#17191c', art: 'loop', artOpacity: 0.3, noStd: true, algo: 'looper', opts: { tracks: 1, maxSec: 300 }, stereo: 'stereo', alwaysOn: true, loopTracks: 1, cost: 0.2,
      controls: [k('level1', 'LOOP LEVEL', { def: 0.8 }),
        FOOT({ action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 900, event: { type: 2, arg: 0 } }, doubleHold: { event: { type: 3, arg: 0 } } }), LED({ bind: 'looper:track:0' })],
      desc: 'Stereo looper: record, play, overdub; hold to stop, hold again to clear.',
    }),
    TC({
      id: 'tc.dittox4', name: 'Likewise X4 Looper', ref: 'TC Electronic Ditto X4 Looper', code: 'LIKE X4', logo: 'likewise x4', tagline: 'dual looper', cat: 'Looper', tcSize: 'x4', noStd: true,
      color: '#c3c7cc', text: '#17191c', art: 'loop', artOpacity: 0.3, algo: 'looper', opts: { tracks: 2, maxSec: 300 }, stereo: 'both', alwaysOn: true, loopTracks: 2, cost: 0.3,
      controls: [k('level1', 'LOOP 1', { def: 0.8 }), k('level2', 'LOOP 2', { def: 0.8 }), k('dubLevel', 'DECAY', { def: 1 }), TOG('sync', '', ['SERIAL', 'SYNC'], { values: [0, 1], def: 1 }),
        FOOT({ label: 'LOOP 1', action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 1200, event: { type: 4, arg: 0 } } }),
        FOOT({ label: 'STOP', action: 'event', event: { type: 2, arg: 0 }, hold: { ms: 1200, event: { type: 3, arg: 0 } } }),
        FOOT({ label: 'LOOP 2', action: 'event', event: { type: 1, arg: 1 }, hold: { ms: 1200, event: { type: 4, arg: 1 } } }),
        FOOT({ label: 'STOP 2', action: 'event', event: { type: 2, arg: 1 }, hold: { ms: 1200, event: { type: 3, arg: 1 } } }),
        LED({ bind: 'looper:track:0' }), LED({ bind: 'looper:stop' }), LED({ bind: 'looper:track:1' }), LED({ bind: 'looper:stop' })],
      desc: 'Two loops. LOOP switches record / play / overdub (hold = undo). STOP stops (hold = clear). DECAY fades older layers.',
    }),

    // ---------------------------------------------------------------- preamps
    PRE({ id: 'tc.combodeluxe65', name: "Combo Luxe '65 Preamp", ref: "TC Electronic Combo Deluxe 65' Preamp", code: 'CL65', logo: "combo luxe '65", typeName: 'Preamp', tagline: 'preamp · spring reverb',
      color: '#1f2024', text: '#d9e4ee', nameY: 158, models: ['deluxe', 'deluxe'], cab: '1x12us', reverb: true, krows: [4, 3],
      controls: [k('a.master', 'LEVEL', { def: 0.5 }), k('a.gain', 'GAIN', { def: 0.4 }), k('r.mix', 'REVERB', { def: 0.25 }), k('r.tone', 'REV TONE', { def: 0.5 }),
        k('a.bass', 'BASS'), k('a.mid', 'MIDDLE'), k('a.treble', 'TREBLE'), TOG('a.bright', 'BRIGHT', ['NORM', 'BRIGHT'])],
      derive: (p) => ({ 'a.gain': Math.min(1, (p['a.gain'] ?? 0.4) + (p['a.channel'] ? 0.35 : 0)) }),
      desc: 'Two-channel blackface-style preamp with spring reverb. DI and phones carry the cab sim.' }),
    PRE({ id: 'tc.dualwreck', name: 'Twin Ruin Preamp', ref: 'TC Electronic Dual Wreck Preamp', code: 'TRN', logo: 'twin ruin', typeName: 'Preamp', tagline: 'high gain preamp',
      color: '#2a2a2a', text: '#d6d6d6', art: 'bars', artOpacity: 0.18, models: ['recto', 'recto'], cab: '4x12v30', krows: [4, 4],
      controls: [k('a.gain', 'GAIN', { def: 0.5 }), k('a.master', 'MASTER', { def: 0.5 }), k('a.presence', 'PRESENCE'), k('level', 'LEVEL', { virtual: true, def: 0.5 }),
        k('a.bass', 'BASS'), k('a.mid', 'MID'), k('a.treble', 'TREBLE'), k('a.depth', 'DEPTH')],
      derive: (p) => ({ 'a.gain': p['a.channel'] ? 0.5 + (p['a.gain'] ?? 0.5) * 0.5 : (p['a.gain'] ?? 0.5) * 0.45, 'a.level': ((p.level ?? 0.5) - 0.5) * 24 }),
      desc: 'Modern high-gain two-channel preamp. Channel A is cleaner, B is the full rectifier roar.' }),
    PRE({ id: 'tc.dc30', name: 'Class-30 Preamp', ref: 'TC Electronic DC30 Preamp', code: 'C30', logo: 'class-30', typeName: 'Preamp', tagline: 'class a preamp',
      color: '#e8dfc8', text: '#3a1a14', art: 'tube', artColor: '#7a2a1a', artOpacity: 0.25, models: ['dc30', 'ac30'], cab: '2x12blue', krows: [3, 3],
      controls: [k('a.gain', 'VOLUME', { def: 0.45 }), k('a.master', 'MASTER', { def: 0.5 }), k('a.presence', 'CUT', { def: 0.5 }), k('a.bass', 'BASS'), k('a.mid', 'MID'), k('a.treble', 'TREBLE')],
      desc: 'Class-A boutique chime with two channels.' }),
    PRE({ id: 'tc.v550', name: 'V-655 Preamp', ref: 'TC Electronic V550 Preamp', code: 'V655', logo: 'v-655', typeName: 'Preamp', tagline: 'high gain preamp',
      color: '#161616', text: '#e84a3a', art: 'flame', artColor: '#e84a3a', artOpacity: 0.22, models: ['5150', '5150'], cab: '4x12t75', krows: [4, 4],
      controls: [k('a.gain', 'PRE GAIN', { def: 0.5 }), k('a.master', 'POST GAIN', { def: 0.5 }), k('a.presence', 'PRESENCE'), k('a.depth', 'RESONANCE'),
        k('a.bass', 'LOW'), k('a.mid', 'MID'), k('a.treble', 'HIGH'), k('level', 'LEVEL', { virtual: true, def: 0.5 })],
      derive: (p) => ({ 'a.gain': p['a.channel'] ? 0.5 + (p['a.gain'] ?? 0.5) * 0.5 : (p['a.gain'] ?? 0.5) * 0.4, 'a.level': ((p.level ?? 0.5) - 0.5) * 24 }),
      desc: 'Two-channel metal preamp: rhythm and lead.' }),
    PRE({ id: 'tc.jims45', name: "Jam's 45 Preamp", ref: 'TC Electronic Jims 45 Preamp', code: 'J45', logo: "jam's 45", typeName: 'Preamp', tagline: 'vintage plexi preamp',
      color: '#c9a64e', text: '#1a1406', art: 'laurel', artColor: '#3a2a08', artOpacity: 0.22, models: ['plexi', 'plexi'], cab: '4x12gb', krows: [3, 3],
      controls: [k('a.gain', 'VOLUME', { def: 0.5 }), k('a.master', 'MASTER', { def: 0.5 }), k('a.presence', 'PRESENCE'), k('a.bass', 'BASS'), k('a.mid', 'MIDDLE'), k('a.treble', 'TREBLE')],
      derive: (p) => ({ 'a.bright': p['a.channel'] ? 1 : 0 }),
      desc: 'Early 60s British plexi tone. Channel B is the bright input.' }),
    PRE({ id: 'tc.jims800', name: "Jam's 800 Preamp", ref: 'TC Electronic Jims 800 Preamp', code: 'J800', logo: "jam's 800", typeName: 'Preamp', tagline: 'british preamp',
      color: '#1a1a1a', text: '#d8b25a', art: 'laurel', artColor: '#d8b25a', artOpacity: 0.2, models: ['jcm800', 'jcm800'], cab: '4x12gb', krows: [3, 3],
      controls: [k('a.gain', 'PRE AMP', { def: 0.55 }), k('a.master', 'MASTER', { def: 0.5 }), k('a.presence', 'PRESENCE'), k('a.bass', 'BASS'), k('a.mid', 'MIDDLE'), k('a.treble', 'TREBLE')],
      derive: (p) => ({ 'a.gain': p['a.channel'] ? Math.min(1, (p['a.gain'] ?? 0.55) + 0.3) : p['a.gain'] ?? 0.55 }),
      desc: '80s British crunch. Channel B adds a gain boost.' }),

    // ---------------------------------------------------------------- utilities
    TC({
      id: 'tc.impulse', name: 'Impact IR Loader', ref: 'TC Electronic Impulse IR Loader', code: 'IMP', logo: 'impact', tagline: 'ir loader', cat: 'Cab', kind: 'Utility', tcSize: 'budget',
      color: '#2a2c30', text: '#e6e9ee', art: 'spectrum', artOpacity: 0.2, algo: 'cab', opts: { models: ['4x12v30', '2x12blue', '1x12us', '4x12gb', '8x10svt', '4x10bass'] }, cost: 0.9,
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'PHONES'] }, jackKinds: { o1: 'mini' },
      controls: [SEL('model', 'IR', ['V30', 'BLUE', 'US', 'GB', '8X10', '4X10'], { sweep: 240, optSize: 3.8, labelRadius: 7.5 }), k('level', 'LEVEL', { min: -12, max: 12, def: 0 }), k('highcut', 'HI CUT', { min: 4000, max: 20000, def: 12000, curve: 'log' })],
      desc: 'Speaker-cab loader for amp-less rigs, with level and high cut. Uses the built-in cabinets.',
    }),

    // ---------------------------------------------------------------- bass heads / combo
    HEAD({ id: 'tc.amp-bh250', name: 'TBH-250 Bass Head', ref: 'TC Electronic BH250', code: 'TBH250', logo: 'tbh-250', typeName: 'bass head', color: '#c9ccd0', text: '#17191c', panel: '#1b1c1f', panelText: '#e8e8e8', logoColor: '#17191c', brushed: true,
      opts: { voice: bassVoice({}) }, controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('midfreq', 'LO MID'), k('mid', 'HI MID'), k('treble', 'TREBLE'), k('master', 'MASTER')] }),
    HEAD({ id: 'tc.amp-bh550', name: 'TBH-550 Bass Head', ref: 'TC Electronic BH550', code: 'TBH550', logo: 'tbh-550', typeName: 'bass head', color: '#c9ccd0', text: '#17191c', panel: '#1b1c1f', panelText: '#e8e8e8', logoColor: '#17191c', brushed: true,
      opts: { voice: bassVoice({}) }, controls: [k('gain', 'GAIN'), k('presence', 'SPECTRA'), k('bass', 'BASS'), k('midfreq', 'LO MID'), k('mid', 'HI MID'), k('treble', 'TREBLE'), k('master', 'MASTER')] }),
    HEAD({ id: 'tc.amp-bh800', name: 'TBH-800 Bass Head', ref: 'TC Electronic BH800', code: 'TBH800', logo: 'tbh-800', typeName: 'bass head', color: '#c9ccd0', text: '#17191c', panel: '#1b1c1f', panelText: '#e8e8e8', logoColor: '#17191c', brushed: true,
      opts: { voice: bassVoice({ base: 'svt', power: 1, sag: 0.3 }) }, controls: [k('gain', 'GAIN'), k('presence', 'SPECTRA'), k('sag', 'TUBETONE', { def: 0.3 }), k('bass', 'BASS'), k('midfreq', 'LO MID'), k('mid', 'HI MID'), k('treble', 'TREBLE'), k('master', 'MASTER')] }),
    HEAD({ id: 'tc.amp-bq250', name: 'BX250 Bass Head', ref: 'TC Electronic BQ250', code: 'BX250', logo: 'bx250', typeName: 'bass head', color: '#1a1b1e', text: '#e8e8e8', panel: '#101114',
      opts: { voice: bassVoice({ base: 'gk800' }) }, controls: [k('gain', 'GAIN'), k('presence', 'THRUST'), k('bass', 'BASS'), k('midfreq', 'LO MID'), k('mid', 'HI MID'), k('treble', 'TREBLE'), k('master', 'MASTER')] }),
    HEAD({ id: 'tc.amp-bq500', name: 'BX500 Bass Head', ref: 'TC Electronic BQ500', code: 'BX500', logo: 'bx500', typeName: 'bass head', color: '#1a1b1e', text: '#e8e8e8', panel: '#101114',
      opts: { voice: bassVoice({ base: 'gk800' }) }, controls: [k('gain', 'GAIN'), k('presence', 'THRUST'), k('bass', 'BASS'), k('midfreq', 'LO MID'), k('mid', 'HI MID'), k('treble', 'TREBLE'), k('master', 'MASTER')] }),
    HEAD({ id: 'tc.amp-bam200', name: 'BMA200 Micro Bass', ref: 'TC Electronic BAM200', code: 'BMA200', logo: 'bma200', typeName: 'micro bass amp', color: '#1a1b1e', text: '#e8e8e8', panel: '#101114', fw: 260,
      opts: { voice: bassVoice({ base: 'ad200' }) }, controls: [k('gain', 'GAIN'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('master', 'MASTER')] }),
    def({
      id: 'tc.amp-bc208', name: 'BCX 2x8 Bass Combo', ref: 'TC Electronic BC208', brand: B, code: 'BCX208', cat: 'Bass Amp', kind: 'Amp', form: 'amp', combo: true, speakers: 2, tags: ['bass'],
      tolex: '#141414', panel: '#1a1b1e', panelText: '#e8e8e8', grille: 'black', logo: 'bcx 208', logoFont: "'Inter', sans-serif", logoColor: '#e8e8e8', knob: 'mxr', panelBrushed: false,
      algo: 'chain', cost: 3.2,
      opts: { chain: [{ prefix: 'a', algo: 'amp', opts: { voice: bassVoice({ base: 'gk800' }) }, params: { level: -3 } }, { prefix: 'c', algo: 'cab', opts: { model: '4x10bass' }, params: { m1pos: 0.3 } }] },
      ports: { ins: ['INPUT'], outs: ['LINE OUT', 'PHONES'] }, jackKinds: { o1: 'phones' },
      controls: [k('a.gain', 'GAIN'), k('a.presence', 'TONEPRINT'), k('a.bass', 'BASS'), k('a.mid', 'MID'), k('a.treble', 'TREBLE'), k('a.master', 'MASTER'), LED({ color: '#3d8bff', r: 4.5 }), FOOT({ action: 'bypass' })],
      desc: '200 W combo with two 8" speakers. The line and phones outs carry the speaker sound.',
    }),
  ]);

  presetFeet('tc.flashback2x4', ['time', 'feedback', 'mix', 'dtype', 'subdiv']);
  presetFeet('tc.hof2x4', ['decay', 'tone', 'mix', 'rtype', 'pre']);
}
