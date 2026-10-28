// Built-in Tone Zone plugin: ProCo.
// Blocks inspired by ProCo gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
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
    label(g, w / 2, 108, d.logo, { size: 26, fill: d.logoColor || '#f2f2f2', font: "'Oswald', sans-serif", weight: 700, ls: 1 });
    label(g, w / 2, 127, d.code, { size: 6.2, fill: theme.text, weight: 700, ls: 2.4 });
    const foots = d.controls.filter((c) => c.t === 'foot'), leds = d.controls.filter((c) => c.t === 'led');
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', x: i ? w - 56 : 56, y: 158, r: 12 }));
    leds.forEach((l, i) => Object.assign(l, { x: i ? w - 92 : 92, y: 158, r: 3 }));
    formKit.tzBadge(g, w / 2, h - 10, theme.text, 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 40, flip: ctx.flip }) };
  });
  const ratOpts = { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 67, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4 };
  const ratDesc = 'FILTER is reverse-acting like the original: clockwise = darker.';
  tz.addDefs([
    def({
      id: 'pc.rat2', name: 'Rodent 2', ref: 'ProCo RAT2', brand: 'ProCo', code: 'DISTORTION', cat: 'Distortion', form: 'rat', color: '#151515', text: '#f2f2f2',
      algo: 'drive', opts: { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 67, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4 },
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten }), FOOT(), LED()],
      desc: 'FILTER is reverse-acting like the original: clockwise = darker.',
    }),
    def({
      id: 'pc.turborat', name: 'Turbo Rodent', ref: 'ProCo Turbo RAT', brand: 'ProCo', code: 'TURBO DISTORTION', cat: 'Distortion', form: 'rat', color: '#141414', text: '#f2f2f2', logo: 'RODENT',
      algo: 'drive', opts: Object.assign({}, ratOpts, { clip: 'led', gainMaxDb: 64, levelMaxDb: 5 }),
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten }), FOOT(), LED()],
      desc: 'LED clipping instead of silicon diodes: louder, more open and less compressed than the RAT2. ' + ratDesc,
    }),
    def({
      id: 'pc.vintagerat', name: "Rodent '85 Whiteface", ref: "ProCo Vintage '85 Whiteface RAT reissue", brand: 'ProCo', code: 'FILTER · DISTORTION', cat: 'Distortion', form: 'rat', color: '#1b1b1b', text: '#f4f4f4', logo: 'RODENT',
      algo: 'drive', opts: Object.assign({}, ratOpts, { slew: 0.45, clipLp: 9000, postLp: 12000 }),
      controls: [K('gain', 'DISTORTION', { display: ten }), K('tone', 'FILTER', { display: ten }), K('level', 'VOLUME', { display: ten }), FOOT(), LED()],
      desc: 'The big-box whiteface voicing: LM308 op-amp, slightly smoother top end. ' + ratDesc,
    }),
    def({
      id: 'pc.deucetone', name: 'Deuce Rodent', ref: 'ProCo Deucetone RAT', brand: 'ProCo', code: 'DUAL DISTORTION', cat: 'Distortion', form: 'pc-deuce', color: '#161616', text: '#f2f2f2', logo: 'DEUCE RODENT',
      algo: 'chain', cost: 1.1, alwaysOn: true,
      opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: { modes: [ratOpts, Object.assign({}, ratOpts, { clip: 'led' }), Object.assign({}, ratOpts, { clip: 'clean', gainMaxDb: 30 })] } },
        { prefix: 'b', algo: 'drive', opts: { modes: [ratOpts, Object.assign({}, ratOpts, { clip: 'led' }), Object.assign({}, ratOpts, { clip: 'clean', gainMaxDb: 30 })] } },
      ] },
      controls: [K('a.gain', 'DIST', { display: ten, def: 0.4 }), K('a.tone', 'FILTER', { display: ten }), K('a.level', 'VOLUME', { display: ten }),
        K('b.gain', 'DIST', { display: ten, def: 0.7 }), K('b.tone', 'FILTER', { display: ten }), K('b.level', 'VOLUME', { display: ten }),
        TOG('a.mode', '', ['RAT', 'TURBO', 'CLEAN'], { def: 0 }), TOG('b.mode', '', ['RAT', 'TURBO', 'CLEAN'], { def: 1 }),
        FOOT({ action: 'param', p: 'a.on', label: 'A' }), FOOT({ action: 'param', p: 'b.on', label: 'B' }), LED({ bind: 'param:a.on' }), LED({ bind: 'param:b.on' })],
      initParams: { 'a.on': 1, 'b.on': 0 },
      desc: 'Two independent RAT circuits in series, each with a RAT / TURBO / CLEAN boost voice and its own footswitch. Both on = stacked. ' + ratDesc,
    })
  ]);
}
