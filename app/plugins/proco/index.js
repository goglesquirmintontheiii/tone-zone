// Built-in Tone Zone plugin: ProCo.
// Blocks inspired by ProCo gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  const { svg, label, formKit } = tz.gfx;
  // two RATs side by side in one wedge (Deucetone): the classic 'rat' look, twice as wide, 2 footswitches
  tz.addForm('pc-deuce', (ctx, d) => {
    const g = ctx.g, w = 236, h = 186;
    formKit.body(g, w, h, d.color, { rx: 5 });
    svg('rect', { x: 0, y: 0, width: w, height: 74, rx: 5, fill: '#000', opacity: 0.18 }, g);
    svg('line', { x1: w / 2, y1: 8, x2: w / 2, y2: 128, stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 1 }, g);
    const theme = { text: d.text || '#f0f0f0', knob: 'rat', labelSize: 6.2 };
    const knobs = d.controls.filter((c) => c.t === 'knob');
    knobs.forEach((k, i) => Object.assign(k, { x: (i < 3 ? 26 : w / 2 + 18) + (i % 3) * 37, y: 34, r: 11, style: 'rat', labelPos: 'below' }));
    d.controls.filter((c) => c.t === 'toggle').forEach((t, i) => Object.assign(t, { x: i ? w / 2 + 55 : 63, y: 82, orient: 'h', optSize: 4.6 }));
    label(g, w / 2, 113, d.logo, { size: 23, fill: d.logoColor || '#f2f2f2', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
    label(g, w / 2, 131, d.code, { size: 6.2, fill: theme.text, weight: 700, ls: 2.4 });
    const foots = d.controls.filter((c) => c.t === 'foot'), leds = d.controls.filter((c) => c.t === 'led');
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', x: i ? w - 56 : 56, y: 158, r: 12 }));
    leds.forEach((l, i) => Object.assign(l, { x: i ? w - 92 : 92, y: 158, r: 3 }));
    formKit.tzBadge(g, w / 2, h - 10, theme.text, 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 100, flip: ctx.flip }) };
  });
  const ratOpts = { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 67, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4 };
  const ratDesc = 'FILTER is reverse-acting like the original: clockwise = darker.';
  tz.addDefs([
    def({
      id: 'pc.rat2', name: 'Rodent 2', ref: 'ProCo RAT2', brand: 'ProCo', code: 'DISTORTION', cat: 'Distortion', form: 'rat', color: '#151515', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 67, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4 },
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten, def: 0.4 }), FOOT(), LED()],
      desc: 'FILTER is reverse-acting like the original: clockwise = darker.',
    }),
    def({
      id: 'pc.turborat', name: 'Turbo Rodent', ref: 'ProCo Turbo RAT', brand: 'ProCo', code: 'TURBO DISTORTION', cat: 'Distortion', form: 'rat', color: '#141414', text: '#f2f2f2', logo: 'RODENT',
      algo: 'drive', opts: Object.assign({}, ratOpts, { clip: 'led', gainMaxDb: 64, levelMaxDb: 5 }),
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten, def: 0.32 }), FOOT(), LED()],
      desc: 'LED clipping instead of silicon diodes: louder, more open and less compressed than the RAT2. ' + ratDesc,
    }),
    def({
      id: 'pc.vintagerat', name: "Rodent '85 Whiteface", ref: "ProCo Vintage '85 Whiteface RAT reissue", brand: 'ProCo', code: 'FILTER · DISTORTION', cat: 'Distortion', form: 'rat', color: '#1b1b1b', text: '#f4f4f4', logo: 'RODENT',
      algo: 'drive', opts: Object.assign({}, ratOpts, { slew: 0.45, clipLp: 9000, postLp: 12000 }),
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten, def: 0.4 }), FOOT(), LED()],
      desc: 'The big-box whiteface voicing: LM308 op-amp, slightly smoother top end. ' + ratDesc,
    }),
    def({
      id: 'pc.deucetone', name: 'Deuce Rodent', ref: 'ProCo Deucetone RAT', brand: 'ProCo', code: 'DUAL DISTORTION', cat: 'Distortion', form: 'pc-deuce', color: '#161616', text: '#f2f2f2', logo: 'DEUCE RODENT',
      algo: 'chain', cost: 1.1, alwaysOn: true,
      opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: { modes: [ratOpts, Object.assign({}, ratOpts, { clip: 'led' }), Object.assign({}, ratOpts, { clip: 'clean', gainMaxDb: 30 })] } },
        { prefix: 'b', algo: 'drive', opts: { modes: [ratOpts, Object.assign({}, ratOpts, { clip: 'led' }), Object.assign({}, ratOpts, { clip: 'clean', gainMaxDb: 30 })] } },
      ] },
      controls: [K('a.gain', 'DIST', { display: ten, def: 0.4 }), K('a.tone', 'FILTER', { display: ten }), K('a.level', 'VOLUME', { display: ten, def: 0.42 }),
        K('b.gain', 'DIST', { display: ten, def: 0.7 }), K('b.tone', 'FILTER', { display: ten }), K('b.level', 'VOLUME', { display: ten, def: 0.42 }),
        TOG('a.mode', '', ['RAT', 'TURBO', 'CLEAN'], { def: 0 }), TOG('b.mode', '', ['RAT', 'TURBO', 'CLEAN'], { def: 1 }),
        FOOT({ action: 'param', p: 'a.on', label: 'A' }), FOOT({ action: 'param', p: 'b.on', label: 'B' }), LED({ bind: 'param:a.on' }), LED({ bind: 'param:b.on' })],
      initParams: { 'a.on': 1, 'b.on': 0 },
      desc: 'Two independent RAT circuits in series, each with a RAT / TURBO / CLEAN boost voice and its own footswitch. Both on = stacked. ' + ratDesc,
    })
  ]);

  // ---- v0.4 additions
  // RAT box with room for a switch row (FAT RAT) or the small Lil' RAT box (`small`)
  const placed = new WeakSet();
  tz.addForm('pc-box', (ctx, d) => {
    const g = ctx.g, small = !!d.small, w = small ? 104 : 150, h = small ? 176 : 196;
    formKit.body(g, w, h, d.color, { rx: 5 });
    svg('rect', { x: 0, y: 0, width: w, height: small ? 62 : 70, rx: 5, fill: '#000', opacity: 0.18 }, g);
    const theme = { text: d.text || '#f0f0f0', knob: 'chrome', labelSize: small ? 6 : 7 };
    d.controls.forEach((c) => { if (c.x === undefined) placed.add(c); });
    const mine = d.controls.filter((c) => placed.has(c));
    const knobs = mine.filter((c) => c.t === 'knob');
    knobs.forEach((k, i) => Object.assign(k, { x: small ? 22 + i * 30 : 30 + i * 45, y: small ? 30 : 36, r: small ? 10 : 13, style: 'rat', labelPos: 'below' }));
    const tg = mine.filter((c) => c.t === 'toggle');
    tg.forEach((t) => Object.assign(t, { x: w / 2, y: 86, orient: 'h' }));
    const ly = small ? 92 : tg.length ? 124 : 102;
    label(g, w / 2, ly, d.logo || 'RODENT', { size: small ? 20 : 26, fill: d.logoColor || '#f2f2f2', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
    label(g, w / 2, ly + (small ? 15 : 20), d.code, { size: small ? 5.4 : 6.5, fill: theme.text, weight: 700, ls: 2 });
    mine.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: small ? w / 2 : w / 2 + 30, y: h - (small ? 34 : 28), r: small ? 11 : 12 });
      if (c.t === 'led') Object.assign(c, small ? { x: w / 2, y: h - 60, r: 2.8 } : { x: w / 2 - 30, y: h - 28, r: 3.2 });
    });
    formKit.tzBadge(g, small ? w / 2 : w / 2 - 30, h - (small ? 9 : 12), theme.text, small ? 3.6 : 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: small ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { y0: 40, flip: ctx.flip }) };
  });
  const ratKnobs = () => [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten, def: 0.4 }), FOOT(), LED()];
  tz.addDefs([
    def({
      id: 'pc.youdirtyrat', name: 'You Dirty Rodent', ref: 'ProCo You Dirty RAT', brand: 'ProCo', code: 'DISTORTION', cat: 'Distortion', form: 'rat', color: '#3a1414', text: '#f2e6e6', logo: 'DIRTY', logoColor: '#ff5a4a',
      algo: 'drive', opts: Object.assign({}, ratOpts, { clip: 'ge', gainMaxDb: 62, levelMaxDb: 6 }),
      controls: ratKnobs(),
      desc: 'Germanium diodes and true bypass: a looser, more open RAT. ' + ratDesc,
    }),
    def({
      id: 'pc.lilrat', name: "Li'l Rodent", ref: "ProCo Lil' RAT", brand: 'ProCo', code: 'DISTORTION', cat: 'Distortion', form: 'pc-box', small: true, color: '#151515', text: '#f2f2f2', logo: 'RODENT',
      algo: 'drive', opts: ratOpts,
      controls: ratKnobs(),
      desc: 'The RAT2 circuit in a small box. ' + ratDesc,
    }),
    def({
      id: 'pc.fatrat', name: 'Fat Rodent', ref: 'ProCo FAT RAT', brand: 'ProCo', code: 'FAT DISTORTION', cat: 'Distortion', form: 'pc-box', color: '#161616', text: '#f2f2f2', logo: 'FAT RODENT',
      algo: 'drive', opts: Object.assign({}, ratOpts, { modes: [{}, { clip: 'led', levelMaxDb: 5 }, { clip: 'ge', levelMaxDb: 6 }] }),
      controls: [...ratKnobs().slice(0, 3), TOG('mode', '', ['SI', 'LED', 'GE']), FOOT(), LED()],
      desc: 'RAT with a clipping switch: silicon, LED or germanium diodes. ' + ratDesc,
    }),
  ]);
}
