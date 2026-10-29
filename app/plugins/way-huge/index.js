// Built-in Tone Zone plugin: Way Huge.
// Blocks inspired by Way Huge pedals. Names and artwork are Tone Zone originals; control sets follow the real
// units (see each block's `ref`). One form ("wh") draws the family: painted box, knob rows, a round badge with
// a cartoon animal (`art`), a bold logo and the footswitch. `small: true` gives the narrow "Smalls" box.
export default function register(tz) {
  const { K, TOG, BTN, FOOT, LED, def, ten, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, formKit, shade } = tz.gfx;

  // badge animals, drawn around (cx, cy) with radius R
  const ANIMAL = {
    pickle(g, cx, cy, R, ink, acc) {
      svg('path', { d: `M${cx - R * 0.75} ${cy + R * 0.35} Q${cx - R * 0.9} ${cy - R * 0.5} ${cx - R * 0.2} ${cy - R * 0.6} Q${cx + R * 0.7} ${cy - R * 0.7} ${cx + R * 0.75} ${cy - R * 0.1} Q${cx + R * 0.8} ${cy + R * 0.6} ${cx} ${cy + R * 0.55} Q${cx - R * 0.6} ${cy + R * 0.6} ${cx - R * 0.75} ${cy + R * 0.35} Z`, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      for (const [dx, dy] of [[-0.4, -0.1], [0, -0.3], [0.35, 0], [-0.1, 0.25], [0.4, -0.35]]) svg('circle', { cx: cx + dx * R, cy: cy + dy * R, r: R * 0.07, fill: ink, opacity: 0.6 }, g);
      svg('circle', { cx: cx - R * 0.3, cy: cy - R * 0.25, r: R * 0.12, fill: '#fff', stroke: ink, 'stroke-width': 0.8 }, g);
      svg('circle', { cx: cx - R * 0.28, cy: cy - R * 0.25, r: R * 0.05, fill: ink }, g);
    },
    llama(g, cx, cy, R, ink, acc) {
      svg('path', { d: `M${cx - R * 0.25} ${cy + R * 0.75} L${cx - R * 0.25} ${cy - R * 0.1} Q${cx - R * 0.3} ${cy - R * 0.55} ${cx} ${cy - R * 0.55} Q${cx + R * 0.3} ${cy - R * 0.55} ${cx + R * 0.25} ${cy - R * 0.1} L${cx + R * 0.25} ${cy + R * 0.75} Z`, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      for (const s of [-1, 1]) svg('path', { d: `M${cx + s * R * 0.15} ${cy - R * 0.5} L${cx + s * R * 0.28} ${cy - R * 0.82} L${cx + s * R * 0.3} ${cy - R * 0.45} Z`, fill: acc, stroke: ink, 'stroke-width': 1 }, g);
      svg('ellipse', { cx, cy: cy - R * 0.05, rx: R * 0.18, ry: R * 0.12, fill: '#f6e6d6', stroke: ink, 'stroke-width': 0.8 }, g);
      for (const s of [-1, 1]) svg('circle', { cx: cx + s * R * 0.12, cy: cy - R * 0.32, r: R * 0.05, fill: ink }, g);
    },
    rhino(g, cx, cy, R, ink, acc) {
      svg('path', { d: `M${cx - R * 0.7} ${cy + R * 0.45} Q${cx - R * 0.75} ${cy - R * 0.35} ${cx - R * 0.1} ${cy - R * 0.4} L${cx + R * 0.35} ${cy - R * 0.3} L${cx + R * 0.55} ${cy - R * 0.75} L${cx + R * 0.62} ${cy - R * 0.2} Q${cx + R * 0.8} ${cy + R * 0.1} ${cx + R * 0.6} ${cy + R * 0.45} Z`, fill: acc, stroke: ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
      svg('circle', { cx: cx + R * 0.1, cy: cy - R * 0.12, r: R * 0.06, fill: ink }, g);
      svg('path', { d: `M${cx - R * 0.5} ${cy - R * 0.38} L${cx - R * 0.55} ${cy - R * 0.65} L${cx - R * 0.35} ${cy - R * 0.42}`, fill: acc, stroke: ink, 'stroke-width': 1 }, g);
    },
    hippo(g, cx, cy, R, ink, acc) {
      svg('ellipse', { cx, cy: cy - R * 0.1, rx: R * 0.5, ry: R * 0.42, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      svg('ellipse', { cx, cy: cy + R * 0.3, rx: R * 0.6, ry: R * 0.32, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      for (const s of [-1, 1]) {
        svg('circle', { cx: cx + s * R * 0.2, cy: cy + R * 0.25, r: R * 0.06, fill: ink }, g);
        svg('circle', { cx: cx + s * R * 0.22, cy: cy - R * 0.25, r: R * 0.07, fill: ink }, g);
        svg('circle', { cx: cx + s * R * 0.38, cy: cy - R * 0.5, r: R * 0.1, fill: acc, stroke: ink, 'stroke-width': 1 }, g);
      }
    },
    pig(g, cx, cy, R, ink, acc) {
      svg('circle', { cx, cy, r: R * 0.6, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      for (const s of [-1, 1]) svg('path', { d: `M${cx + s * R * 0.3} ${cy - R * 0.48} L${cx + s * R * 0.55} ${cy - R * 0.75} L${cx + s * R * 0.58} ${cy - R * 0.35} Z`, fill: acc, stroke: ink, 'stroke-width': 1, 'stroke-linejoin': 'round' }, g);
      svg('ellipse', { cx, cy: cy + R * 0.12, rx: R * 0.24, ry: R * 0.16, fill: shade(acc, -0.15), stroke: ink, 'stroke-width': 1 }, g);
      for (const s of [-1, 1]) {
        svg('circle', { cx: cx + s * R * 0.08, cy: cy + R * 0.12, r: R * 0.05, fill: ink }, g);
        svg('circle', { cx: cx + s * R * 0.24, cy: cy - R * 0.2, r: R * 0.06, fill: ink }, g);
      }
    },
    cat(g, cx, cy, R, ink, acc) {
      svg('path', { d: `M${cx - R * 0.55} ${cy + R * 0.45} L${cx - R * 0.6} ${cy - R * 0.7} L${cx - R * 0.2} ${cy - R * 0.38} L${cx + R * 0.2} ${cy - R * 0.38} L${cx + R * 0.6} ${cy - R * 0.7} L${cx + R * 0.55} ${cy + R * 0.45} Q${cx} ${cy + R * 0.75} ${cx - R * 0.55} ${cy + R * 0.45} Z`, fill: acc, stroke: ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
      for (const s of [-1, 1]) {
        svg('ellipse', { cx: cx + s * R * 0.22, cy: cy - R * 0.05, rx: R * 0.1, ry: R * 0.14, fill: '#f4e04a', stroke: ink, 'stroke-width': 0.8 }, g);
        svg('rect', { x: cx + s * R * 0.22 - R * 0.025, y: cy - R * 0.17, width: R * 0.05, height: R * 0.24, fill: ink }, g);
        svg('path', { d: `M${cx + s * R * 0.15} ${cy + R * 0.25} L${cx + s * R * 0.62} ${cy + R * 0.18}`, stroke: ink, 'stroke-width': 0.8 }, g);
      }
      svg('path', { d: `M${cx - R * 0.07} ${cy + R * 0.15} L${cx + R * 0.07} ${cy + R * 0.15} L${cx} ${cy + R * 0.24} Z`, fill: ink }, g);
    },
    helmet(g, cx, cy, R, ink, acc) {
      svg('path', { d: `M${cx - R * 0.75} ${cy + R * 0.2} Q${cx - R * 0.5} ${cy + R * 0.05} ${cx - R * 0.45} ${cy - R * 0.2} Q${cx - R * 0.3} ${cy - R * 0.7} ${cx} ${cy - R * 0.72} Q${cx + R * 0.3} ${cy - R * 0.7} ${cx + R * 0.45} ${cy - R * 0.2} Q${cx + R * 0.5} ${cy + R * 0.05} ${cx + R * 0.75} ${cy + R * 0.2} Q${cx} ${cy + R * 0.4} ${cx - R * 0.75} ${cy + R * 0.2} Z`, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      svg('path', { d: `M${cx} ${cy - R * 0.72} L${cx} ${cy + R * 0.3}`, stroke: ink, 'stroke-width': 1.2 }, g);
      svg('path', { d: `M${cx - R * 0.45} ${cy - R * 0.1} L${cx + R * 0.45} ${cy - R * 0.1}`, stroke: ink, 'stroke-width': 1 }, g);
    },
    lemon(g, cx, cy, R, ink, acc) {
      svg('ellipse', { cx, cy, rx: R * 0.6, ry: R * 0.42, fill: acc, stroke: ink, 'stroke-width': 1.2 }, g);
      for (const s of [-1, 1]) svg('path', { d: `M${cx + s * R * 0.58} ${cy - R * 0.06} L${cx + s * R * 0.72} ${cy} L${cx + s * R * 0.58} ${cy + R * 0.06}`, fill: acc, stroke: ink, 'stroke-width': 1 }, g);
      for (let i = -2; i <= 2; i++) svg('path', { d: `M${cx + i * R * 0.18} ${cy - R * 0.62} L${cx + i * R * 0.24} ${cy - R * 0.78}`, stroke: ink, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
    },
  };

  const owned = new WeakSet();
  tz.addForm('wh', (ctx, d) => {
    const g = ctx.g, small = !!d.small;
    const w = small ? 100 : 150, h = small ? 196 : 240;
    const col = d.color, txt = d.text || '#151515', ink = d.ink || txt;
    formKit.body(g, w, h, col, { rx: 8 });
    // painted border line
    svg('rect', { x: 5, y: 5, width: w - 10, height: h - 10, rx: 5, fill: 'none', stroke: ink, 'stroke-width': 0.9, 'stroke-opacity': 0.45 }, g);
    d.controls.forEach((c) => { if (c.x === undefined) owned.add(c); });
    const mine = d.controls.filter((c) => owned.has(c));
    const knobs = mine.filter((c) => c.t === 'knob' || c.t === 'sel');
    const n = knobs.length;
    const rows = d.rows || (n <= 3 ? [n] : [3, n - 3]);
    let k = 0, y = 32, bottom = 20;
    rows.forEach((cnt, ri) => {
      const row = knobs.slice(k, k + cnt);
      k += cnt;
      const r = ri ? (small ? 9 : 10) : small ? (cnt > 2 ? 10 : 11) : cnt > 3 ? 11 : 13;
      const m = small ? 24 : cnt > 3 ? 24 : 30;
      row.forEach((c, i) => Object.assign(c, { x: cnt === 1 ? w / 2 : m + ((w - 2 * m) * i) / (cnt - 1), y, r, labelPos: 'below' }));
      bottom = y + r + 14;
      y = bottom + r + 6;
    });
    const sw = mine.filter((c) => c.t === 'toggle' || c.t === 'button');
    if (sw.length) {
      const ty = bottom + (sw.some((c) => c.t === 'toggle' && c.label) ? 20 : 12);
      sw.forEach((c, i) => {
        Object.assign(c, { x: sw.length === 1 ? w / 2 : 34 + (i * (w - 68)) / (sw.length - 1), y: ty });
        if (c.t === 'toggle') c.orient = c.orient || 'h';
        if (c.t === 'button') Object.assign(c, { r: 5, led: c.led ?? true, ledDy: -9 });
      });
      bottom = ty + 16;
    }
    const feet = mine.filter((c) => c.t === 'foot'), leds = mine.filter((c) => c.t === 'led');
    const fx = feet.length > 1 ? [w * 0.28, w * 0.72] : [w / 2];
    feet.forEach((f, i) => Object.assign(f, { style: 'stomp', x: fx[i], y: h - 30, r: small ? 11 : 12 }));
    leds.forEach((l, i) => Object.assign(l, { x: feet.length > 1 ? fx[i] : w / 2, y: feet.length > 1 ? h - 62 : h - 56, r: 2.6 }));
    if (feet.length > 1) feet.forEach((f) => { if (f.label) f.labelDy = -19; });
    // logo above the LED, badge in the space left over
    const ls = d.logoSize || (small ? 14 : 18);
    const subY = h - (feet.length > 1 ? 76 : 70), logoY = subY - (d.sub ? 10 : 2) - ls * 0.35;
    const top = bottom + 4, bot = logoY - ls * 0.62 - 4;
    const R = Math.min(small ? 22 : 28, (bot - top) / 2);
    if (R > 9 && d.art) {
      const cy = (top + bot) / 2;
      svg('circle', { cx: w / 2, cy, r: R, fill: d.badge || '#f4ecd8', stroke: ink, 'stroke-width': 1.4 }, g);
      (ANIMAL[d.art] || ANIMAL.pickle)(g, w / 2, cy + R * 0.05, R * 0.95, ink, d.accent || col);
    }
    label(g, w / 2, logoY, d.logo, { size: ls, fill: d.logoColor || txt, font: "'Oswald', sans-serif", weight: 700, ls: 1 });
    if (d.sub) label(g, w / 2, subY, d.sub, { size: small ? 4.6 : 5.4, fill: txt, weight: 700, ls: 1.4, opacity: 0.85 });
    formKit.tzBadge(g, w / 2, h - 8, txt, small ? 3.4 : 4);
    const theme = { text: txt, knob: d.knob || 'mxr', labelSize: small ? 5.6 : 6.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: d.jacksTop ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: 50, gap: 28 }) };
  });

  const WH = (o) => def(Object.assign({ form: 'wh', brand: 'Way Huge' }, o, { controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const muff = (o = {}) => Object.assign({ clip: 'muff', stages: 2, stage2Db: 18, preHp: 60, gainMinDb: 20, gainMaxDb: 54, tone: 'blend', blendLp: 400, blendHp: 1000, postLp: 8000, levelMaxDb: -1 }, o);

  tz.addDefs([
    WH({
      id: 'wh.swollenpickle', name: 'Swollen Gherkin', ref: 'Way Huge Swollen Pickle MkIIS', cat: 'Fuzz', typeName: 'Jumbo fuzz',
      color: '#86b25f', text: '#14240c', art: 'pickle', accent: '#4f8a2e', logo: 'SWOLLEN GHERKIN', logoSize: 15, sub: 'JUMBO FUZZ',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: muff() },
        { prefix: 'e', algo: 'peq', params: { mid1freq: 700, mid1q: 0.8 } },
      ] },
      controls: [K('d.level', 'LOUDNESS', { def: 0.5, display: ten }), K('d.gain', 'SUSTAIN', { def: 0.65, display: ten }), K('d.tone', 'FILTER', { def: 0.5, display: ten }),
        K('e.mid1gain', 'SCOOP', { min: -12, max: 4, def: -4 }), K('crunch', 'CRUNCH', { def: 0.4, virtual: true })],
      derive: (p) => ({ 'd.sag': 0.6 * (p.crunch ?? 0.4) }),
      desc: 'Huge, thick fuzz. SCOOP sets how much midrange is cut and CRUNCH adds a ragged, gated edge.',
    }),
    WH({
      id: 'wh.redllama', name: 'Crimson Alpaca', ref: 'Way Huge Red Llama MkIII', cat: 'Overdrive', typeName: 'Overdrive',
      color: '#b8261f', text: '#fbeee0', ink: '#2a0a08', art: 'llama', accent: '#e9c49a', logo: 'CRIMSON ALPACA', logoSize: 15, sub: 'OVERDRIVE',
      algo: 'drive', opts: { clip: 'asym', bias: 0.3, preHp: 90, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1200, toneHi: 8000, postLp: 7500, levelMaxDb: 6 },
      controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('tone', 'TONE', { def: 0.55, display: ten }), K('gain', 'DRIVE', { def: 0.45, display: ten })],
      desc: 'Amp-like overdrive with a gritty, open sound.',
    }),
    WH({
      id: 'wh.greenrhino', name: 'Jade Rhino', ref: 'Way Huge Green Rhino MkV', cat: 'Overdrive', typeName: 'Overdrive',
      color: '#2f7a3a', text: '#eef6ea', ink: '#0d220f', art: 'rhino', accent: '#9bbf8a', logo: 'JADE RHINO', logoSize: 17, sub: 'OVERDRIVE',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 650, gainMinDb: 0, gainMaxDb: 42, tone: 'ts', toneLo: 720, postLp: 5200, levelMaxDb: 6 } },
        { prefix: 'e', algo: 'peq', params: { lowfreq: 100 } },
      ] },
      fixed: { 'e.lowfreq': 100 },
      controls: [K('d.level', 'VOLUME', { def: 0.5, display: ten }), K('d.gain', 'DRIVE', { def: 0.45, display: ten }), K('d.tone', 'TONE', { def: 0.5, display: ten }),
        K('e.lowgain', '100 HZ', { min: -12, max: 12, def: 0 }), K('curve', 'CURVE', { def: 0.5, virtual: true, display: ten })],
      derive: (p) => ({ 'd.bright': 0.6 * (p.curve ?? 0.5) }),
      desc: 'Green-box style drive with more range: 100 HZ adds or cuts low end and CURVE shapes the clipping response.',
    }),
    WH({
      id: 'wh.porkloin', name: 'Bacon Strip', ref: 'Way Huge Pork Loin', cat: 'Overdrive', typeName: 'Overdrive with clean blend',
      color: '#e6a0a6', text: '#2a0c10', art: 'pig', accent: '#f4c2c6', logo: 'BACON STRIP', logoSize: 17, sub: 'OVERDRIVE',
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 80, gainMinDb: 4, gainMaxDb: 42, tone: 'tilt', eqRangeDb: 9, postLp: 8000, cleanSum: true, levelMaxDb: 6 },
      controls: [K('level', 'VOLUME', { def: 0.5, display: ten }), K('gain', 'DRIVE', { def: 0.5, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), K('blend', 'MIX', { def: 0.7 })],
      rows: [2, 2],
      desc: 'Overdrive with a clean mix so your pick attack and low end stay intact.',
    }),
    WH({
      id: 'wh.supapuss', name: 'Super Kitty', ref: 'Way Huge Supa-Puss', cat: 'Delay', typeName: 'Analog delay', noStd: true,
      color: '#1f1f24', text: '#f2d27a', ink: '#f2d27a', badge: '#2c2c32', art: 'cat', accent: '#d9a63a', logo: 'SUPER KITTY', logoSize: 17, sub: 'ANALOG DELAY',
      algo: 'delay', opts: { maxMs: 900 }, fixed: { mode: 1, tone: 0.35 }, tapTarget: 'time',
      ctrl: { ins: [{ label: 'EXP', param: 'feedback', min: 0, max: 1.05 }] },
      controls: [K('time', 'TIME', { min: 40, max: 900, def: 350, display: ms }), K('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), K('mix', 'MIX', { def: 0.4 }),
        K('moddepth', 'DEPTH', { def: 0.2 }), K('modrate', 'SPEED', { def: 0.3 }),
        FOOT(), LED({ color: '#ff2a1a' }), FOOT({ action: 'tap', label: 'TAP' }), LED({ bind: 'tap:time', color: '#3ddc84' })],
      desc: 'Analog-voiced delay with tap tempo and modulation on the repeats.',
    }),
    WH({
      id: 'wh.aquapuss', name: 'Aqua Kitty', ref: 'Way Huge Aqua-Puss MkIII', cat: 'Delay', typeName: 'Analog delay',
      color: '#2c8fa3', text: '#f1fafc', ink: '#0c2a31', art: 'cat', accent: '#9fd6e0', logo: 'AQUA KITTY', logoSize: 17, sub: 'ANALOG DELAY',
      algo: 'delay', opts: { maxMs: 300 }, fixed: { mode: 1, tone: 0.32, modrate: 0.25, moddepth: 0.05 },
      controls: [K('time', 'DELAY', { min: 20, max: 300, def: 180, display: ms }), K('feedback', 'FEEDBACK', { def: 0.35, max: 1.05 }), K('mix', 'BLEND', { def: 0.4 })],
      desc: 'Dark, short analog echo for slapback and warm repeats.',
    }),
    WH({
      id: 'wh.bluehippo', name: 'Azure Hippo', ref: 'Way Huge Blue Hippo MkIII', cat: 'Modulation', typeName: 'Analog chorus',
      color: '#2d5fae', text: '#eef3fb', ink: '#0b1a33', art: 'hippo', accent: '#9db8e4', logo: 'AZURE HIPPO', logoSize: 17, sub: 'ANALOG CHORUS',
      algo: 'chorus', fixed: { mode: 0 },
      ctrl: { ins: [{ label: 'EXP', param: 'rate', min: 0, max: 1 }] },
      controls: [K('rate', 'SPEED', { def: 0.3 }), K('depth', 'DEPTH', { def: 0.5 }), K('mix', 'MIX', { def: 0.5 }), TOG('vib', '', ['CHORUS', 'VIBRATO'], { virtual: true })],
      derive: (p) => (p.vib ? { mode: 1, mix: 1 } : { mode: 0 }),
      desc: 'Lush analog chorus that also does vibrato. An expression pedal can control the speed.',
    }),
    WH({
      id: 'wh.saffronsqueeze', name: 'Saffron Press', ref: 'Way Huge Saffron Squeeze', cat: 'Dynamics', typeName: 'Compressor',
      color: '#e09a2a', text: '#2a1604', art: 'lemon', accent: '#f6d34a', logo: 'SAFFRON PRESS', logoSize: 15, sub: 'COMPRESSOR',
      algo: 'comp', opts: { type: 'ota' },
      controls: [K('level', 'VOLUME', { def: 0.42 }), K('sustain', 'SQUEEZE', { def: 0.5 }), K('attack', 'ATTACK', { def: 0.3 }), K('tone', 'TONE', { def: 0.55 }), TOG('dmp', 'DAMP', ['OFF', 'ON'], { virtual: true })],
      rows: [2, 2],
      derive: (p) => ({ release: p.dmp ? 0.65 : 0.4 }),
      desc: 'Compressor with attack and tone controls. DAMP smooths out the release.',
    }),
    WH({
      id: 'wh.conquistador', name: 'Conqueror Fuzz', ref: 'Way Huge Conquistador', cat: 'Fuzz', typeName: 'Fuzz',
      color: '#c99a3a', text: '#22160a', art: 'helmet', accent: '#d8d8d8', logo: 'CONQUEROR', logoSize: 17, sub: 'FUZZ',
      algo: 'drive', opts: { clip: 'si', bias: 0.35, preHp: 90, gainMinDb: 18, gainMaxDb: 50, tone: 'lp', toneLo: 900, toneHi: 7000, postLp: 6500, levelMaxDb: -2,
        modes: [{}, { clip: 'ge', bias: 0.45, postLp: 5000 }] },
      controls: [K('level', 'VOLUME', { def: 0.38, display: ten }), K('gain', 'FUZZ', { def: 0.6, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), TOG('mode', '', ['MODERN', 'VINTAGE'])],
      desc: 'Searing fuzz with a vintage switch for a softer, older voice.',
    }),
    WH({
      id: 'wh.russianpickle', name: 'Soviet Gherkin', ref: 'Way Huge Russian Pickle (Smalls)', cat: 'Fuzz', typeName: 'Fuzz', small: true,
      color: '#5a7a3a', text: '#f1f4e6', ink: '#16200c', art: 'pickle', accent: '#9bc06a', logo: 'SOVIET GHERKIN', logoSize: 11.5, sub: 'FUZZ',
      algo: 'drive', opts: muff({ blendLp: 380, blendHp: 950, postLp: 7200, gainMaxDb: 52, modes: [{}, { blendLp: 650, blendHp: 900 }] }),
      controls: [K('level', 'VOLUME', { def: 0.44, display: ten }), K('gain', 'SUSTAIN', { def: 0.6, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), TOG('mode', '', ['NORM', 'MIDS'])],
      desc: 'Russian-style big fuzz in a small box. MIDS fills in the scoop.',
    }),
  ]);
}
