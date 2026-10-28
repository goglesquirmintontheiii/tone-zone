// Built-in Tone Zone plugin: Beetronics FX.
// Blocks inspired by Beetronics FX pedals. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`). One custom "beehive" enclosure serves the whole family:
// domed die-cast body, metallic powder coat with an embossed honeycomb, honey dripping from the top, a hexagonal
// gold-on-black name plate and a per-pedal emblem (bee, wasp, queen, fish, devil …).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, shade, softShadow, noisePattern } = tz.gfx;

  const INK = '#17110a';
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---- emblems
  function bee(g, x, y, s, o = {}) {
    const body = o.body || '#f5c400';
    for (const [wx, wy, a] of [[-2.6, -5, -28], [2.4, -5.4, 24]]) svg('ellipse', { cx: x + wx * s, cy: y + wy * s, rx: 2.8 * s, ry: 5.2 * s, fill: '#ffffff', opacity: 0.78, stroke: INK, 'stroke-width': 0.5, transform: `rotate(${a} ${x + wx * s} ${y + wy * s})` }, g);
    svg('ellipse', { cx: x + 1 * s, cy: y, rx: (o.long ? 9 : 7) * s, ry: (o.long ? 3.6 : 4.6) * s, fill: body, stroke: INK, 'stroke-width': 0.7 }, g);
    const stripes = o.long ? [-2.5, 0.8, 4.1] : [-1.4, 2.6];
    stripes.forEach((dx) => svg('line', { x1: x + dx * s, x2: x + dx * s, y1: y - (o.long ? 3.3 : 4.2) * s, y2: y + (o.long ? 3.3 : 4.2) * s, stroke: INK, 'stroke-width': 1.7 * s, 'stroke-linecap': 'round' }, g));
    const hx = x - (o.long ? 9 : 7.4) * s;
    svg('circle', { cx: hx, cy: y, r: 3 * s, fill: INK }, g);
    svg('path', { d: `M${hx - 1 * s} ${y - 2.4 * s} q -2 ${-4 * s} ${-4.5 * s} ${-4.5 * s} M${hx + 0.6 * s} ${y - 2.6 * s} q 0 ${-4 * s} ${-2 * s} ${-5.4 * s}`, fill: 'none', stroke: INK, 'stroke-width': 0.6 }, g);
    svg('path', { d: `M${x + (o.long ? 10 : 8) * s} ${y - 1 * s} l ${2.6 * s} ${1 * s} l ${-2.6 * s} ${1 * s} z`, fill: INK }, g);
    if (o.crown) svg('path', { d: `M${hx - 3.4 * s} ${y - 4 * s} l ${1 * s} ${-4 * s} l ${1.4 * s} ${2.2 * s} l ${1 * s} ${-3 * s} l ${1 * s} ${3 * s} l ${1.4 * s} ${-2.2 * s} l ${1 * s} ${4 * s} z`, fill: '#ffd84a', stroke: INK, 'stroke-width': 0.5 }, g);
    if (o.horns) svg('path', { d: `M${hx - 2.4 * s} ${y - 2 * s} q ${-2 * s} ${-3 * s} ${-0.6 * s} ${-5.6 * s} q ${0.6 * s} ${2.6 * s} ${1.8 * s} ${3.6 * s} M${hx + 1.4 * s} ${y - 2.4 * s} q ${0.6 * s} ${-3.4 * s} ${2.6 * s} ${-4.6 * s} q ${-0.6 * s} ${2.4 * s} ${-1 * s} ${4 * s}`, fill: '#d81e10', stroke: INK, 'stroke-width': 0.5 }, g);
  }
  const EMBLEM = {
    bee: (g, x, y) => bee(g, x, y, 1.15),
    wasp: (g, x, y) => bee(g, x, y, 1.1, { long: true, body: '#ffd400' }),
    queen: (g, x, y) => bee(g, x, y + 2, 1.15, { crown: true, body: '#f2b400' }),
    devil: (g, x, y) => bee(g, x, y + 1, 1.15, { horns: true, body: '#e8452c' }),
    swarm: (g, x, y) => { bee(g, x - 16, y + 3, 0.7); bee(g, x + 2, y - 3, 0.85); bee(g, x + 18, y + 4, 0.65); },
    hex: (g, x, y) => {
      const p = (r) => [...Array(6)].map((_, i) => `${(x + Math.cos((Math.PI / 3) * i) * r).toFixed(1)},${(y + Math.sin((Math.PI / 3) * i) * r).toFixed(1)}`).join(' ');
      svg('polygon', { points: p(13), fill: 'none', stroke: INK, 'stroke-width': 1.2 }, g);
      bee(g, x, y, 0.85);
    },
    fish: (g, x, y) => {
      svg('path', { d: `M${x - 14} ${y} Q ${x - 2} ${y - 10} ${x + 10} ${y} Q ${x - 2} ${y + 10} ${x - 14} ${y} Z`, fill: '#9fd6ff', stroke: INK, 'stroke-width': 0.8 }, g);
      svg('path', { d: `M${x + 9} ${y} l 7 -6 l -1.5 6 l 1.5 6 z`, fill: '#5fb0e0', stroke: INK, 'stroke-width': 0.8 }, g);
      svg('circle', { cx: x - 8, cy: y - 1.5, r: 1.3, fill: INK }, g);
      for (const dx of [-3, 1, 5]) svg('path', { d: `M${x + dx} ${y - 5} q 2 5 0 10`, fill: 'none', stroke: INK, 'stroke-width': 0.5, opacity: 0.7 }, g);
      bee(g, x + 2, y - 13, 0.55);
    },
    wave: (g, x, y) => {
      for (const dy of [7, 11]) svg('path', { d: `M${x - 20} ${y + dy} q 5 -4 10 0 t 10 0 t 10 0 t 10 0`, fill: 'none', stroke: INK, 'stroke-width': 1 }, g);
      bee(g, x, y - 3, 0.95, { body: '#7fe0d0' });
    },
  };

  // dome-topped body outline
  const shapePath = (w, h) => `M0 62 C0 18 ${w * 0.22} 0 ${w / 2} 0 C${w * 0.78} 0 ${w} 18 ${w} 62 V${h - 16} Q${w} ${h} ${w - 16} ${h} H16 Q0 ${h} 0 ${h - 16} Z`;

  let seq = 0;
  tz.addForm('beehive', (ctx, def) => {
    const g = ctx.g, w = 152;
    const free = (c) => c.x === undefined || c._auto;
    def.controls.forEach((c) => { if (c.x === undefined) c._auto = true; });
    const knobs = def.controls.filter((c) => c.t === 'knob' && free(c));
    const two = knobs.length > 3;
    const h = two ? 268 : 236;
    const pal = Object.assign({ base: '#d9a21f', dark: '#6e4507', light: '#ffe48a', honey: '#f0a10c', plate: '#14100b', gold: '#f3c64a' }, def.palette || {});
    const id = 'bee' + ++seq;
    const defs = svg('defs', {}, g);
    const shape = shapePath(w, h);
    softShadow(g, { w, h, path: shape, dy: 14, blur: 9, opacity: 0.6 });
    // metallic powder coat
    const lg = svg('linearGradient', { id: id + 'm', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    [[0, pal.light], [0.32, pal.base], [0.68, shade(pal.base, -0.18)], [1, pal.dark]].forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, lg));
    const rg = svg('radialGradient', { id: id + 'r', cx: 0.3, cy: 0.22, r: 0.7 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.35 }, rg);
    svg('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, rg);
    noisePattern(defs, id + 'n', 32, 64, [0, 0, 0], 0, 0.14, 0);
    const cp = svg('clipPath', { id: id + 'c' }, defs);
    svg('path', { d: shape }, cp);
    svg('path', { d: shape, fill: `url(#${id}m)` }, g);
    const inside = svg('g', { 'clip-path': `url(#${id}c)` }, g);
    // embossed honeycomb (one path: dark edge + offset light edge)
    const R = 8.5, dx = R * Math.sqrt(3), dy = R * 1.5;
    let hp = '';
    for (let row = -1; row * dy < h + R; row++)
      for (let col = -1; col * dx < w + dx; col++) {
        const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
        hp += 'M' + [...Array(6)].map((_, i) => `${(cx + Math.cos(Math.PI / 6 + (Math.PI / 3) * i) * (R - 0.8)).toFixed(1)} ${(cy + Math.sin(Math.PI / 6 + (Math.PI / 3) * i) * (R - 0.8)).toFixed(1)}`).join(' L') + 'Z';
      }
    svg('path', { d: hp, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 0.7, transform: 'translate(0.6 0.6)' }, inside);
    svg('path', { d: hp, fill: 'none', stroke: pal.dark, 'stroke-opacity': 0.45, 'stroke-width': 0.8 }, inside);
    svg('rect', { width: w, height: h, fill: `url(#${id}n)` }, inside);
    svg('rect', { width: w, height: h, fill: `url(#${id}r)` }, inside);
    // honey dripping over the dome
    const hg = svg('linearGradient', { id: id + 'h', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, '#ffd760'], [0.45, pal.honey], [1, shade(pal.honey, -0.35)]].forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, hg));
    const r = rng(def.seed || 5);
    const base = (x) => 30 + 4 * Math.sin(x / 15 + 1);
    const drips = [[16, 6, 14], [40, 7, 24], [63, 5, 9], [88, 8, 20], [112, 6, 13], [136, 7, 22]].map(([x, wd, L]) => [x + (r() - 0.5) * 6, wd, L * (0.75 + r() * 0.4)]);
    let d = `M-4 -4 H${w + 4} V${base(w).toFixed(1)}`;
    const hl = [];
    for (let i = drips.length - 1; i >= 0; i--) {
      const [x, wd, L] = drips[i];
      const b = base(x);
      d += ` L${(x + wd / 2).toFixed(1)} ${b.toFixed(1)} C${(x + wd / 2).toFixed(1)} ${(b + L * 0.55).toFixed(1)} ${(x + wd * 0.95).toFixed(1)} ${(b + L).toFixed(1)} ${x.toFixed(1)} ${(b + L).toFixed(1)} C${(x - wd * 0.95).toFixed(1)} ${(b + L).toFixed(1)} ${(x - wd / 2).toFixed(1)} ${(b + L * 0.55).toFixed(1)} ${(x - wd / 2).toFixed(1)} ${b.toFixed(1)}`;
      hl.push([x - wd * 0.22, b + L - wd * 0.45, wd]);
    }
    d += ` L-4 ${base(0).toFixed(1)} Z`;
    svg('path', { d, fill: '#000', opacity: 0.25, transform: 'translate(0 2)' }, inside);
    svg('path', { d, fill: `url(#${id}h)` }, inside);
    svg('path', { d, fill: 'none', stroke: '#fff3c2', 'stroke-opacity': 0.55, 'stroke-width': 0.7 }, inside);
    hl.forEach(([x, y, wd]) => svg('ellipse', { cx: x, cy: y, rx: wd * 0.14, ry: wd * 0.24, fill: '#fff', opacity: 0.7 }, inside));
    svg('path', { d: `M18 22 Q ${w / 2} -2 ${w - 18} 22`, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.45, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, inside);
    // rim
    svg('path', { d: shape, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.25, 'stroke-width': 1.2, transform: `translate(0.6 0.6) scale(${(w - 1.2) / w} ${(h - 1.2) / h})` }, g);
    svg('path', { d: shape, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.9 }, g);
    (EMBLEM[def.emblem] || EMBLEM.bee)(g, w / 2, 20);
    // layout
    const txt = def.text || '#1b1206';
    const theme = { text: txt, knob: def.knob || 'cream', labelSize: 6.2, labelLs: 0.6, labelWeight: 800, toggleTitles: false };
    if (!two) knobs.forEach((k, i) => Object.assign(k, { x: knobs.length === 1 ? w / 2 : 32 + (i * (w - 64)) / (knobs.length - 1), y: 86, r: k.r || 13.5, labelPos: 'below' }));
    else {
      const top = knobs.slice(0, Math.ceil(knobs.length / 2)), bot = knobs.slice(Math.ceil(knobs.length / 2));
      top.forEach((k, i) => Object.assign(k, { x: top.length === 1 ? w / 2 : 34 + (i * (w - 68)) / (top.length - 1), y: 75, r: 12, labelPos: 'below' }));
      bot.forEach((k, i) => Object.assign(k, { x: bot.length === 1 ? w / 2 : 34 + (i * (w - 68)) / (bot.length - 1), y: 118, r: 12, labelPos: 'below' }));
    }
    const tog = def.controls.filter((c) => c.t === 'toggle' && free(c));
    const ty = two ? 158 : 124;
    tog.forEach((t, i) => Object.assign(t, { x: tog.length === 1 ? w / 2 : 44 + (i * (w - 88)) / (tog.length - 1), y: ty, orient: 'h' }));
    // hexagonal name plate
    const py = (tog.length ? ty : ty - 16) + 31;
    const plate = `M14 ${py} L28 ${py - 16} H${w - 28} L${w - 14} ${py} L${w - 28} ${py + 16} H28 Z`;
    svg('path', { d: plate, fill: '#000', opacity: 0.35, transform: 'translate(0 2)' }, g);
    svg('path', { d: plate, fill: pal.plate, stroke: pal.gold, 'stroke-width': 1.3 }, g);
    svg('path', { d: `M19 ${py} L30.5 ${py - 13} H${w - 30.5} L${w - 19} ${py} L${w - 30.5} ${py + 13} H30.5 Z`, fill: 'none', stroke: pal.gold, 'stroke-opacity': 0.45, 'stroke-width': 0.5 }, g);
    label(g, w / 2, py - 2.5, def.logo, { size: def.logoSize || 17, fill: pal.gold, font: "'Dancing Script', cursive", weight: 700, ls: 0.3 });
    label(g, w / 2, py + 9.5, (def.typeName || '').toUpperCase(), { size: 4.3, fill: pal.gold, weight: 700, ls: 1.5, opacity: 0.85 });
    const ly = py + 25, fy = ly + 25;
    def.controls.filter((c) => c.t === 'led' && free(c)).forEach((l) => Object.assign(l, { r: 2.8, x: w / 2, y: ly, bezel: pal.gold }));
    def.controls.filter((c) => c.t === 'foot' && free(c)).forEach((f) => Object.assign(f, { style: 'stomp', r: 12.5, x: w / 2, y: fy }));
    formKit.tzBadge(g, w / 2, h - 6.5, txt, 3.8);
    formKit.placeControls(ctx, def.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { jackText: txt }), jacks: formKit.jacksSide(def, w, { flip: ctx.flip, y0: ly, gap: 26 }) };
  });

  const B = (o) => def(Object.assign({ form: 'beehive', brand: 'Beetronics FX', cost: 0.7 }, o, { controls: [...(o.controls || []), FOOT(), LED({ color: o.led || '#ffb21a' })] }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));

  tz.addDefs([
    B({
      id: 'bee.tuna', name: 'Tunabee Filter', ref: 'Beetronics FX Tuna', code: 'TUNABEE', logo: 'Tunabee', typeName: 'Envelope filter', cat: 'Filter', emblem: 'fish', seed: 3,
      palette: { base: '#2f8fb8', dark: '#0d3a55', light: '#a8e6ff' }, text: '#06202e', led: '#5fd0ff',
      algo: 'wah', opts: { fLo: 280, fHi: 2600 }, fixed: { mode: 2 },
      controls: [k('sens', 'SENS', { def: 0.55 }), k('q', 'RESO', { def: 0.6 }), k('range', 'RANGE', { def: 0.6 }), k('level', 'VOLUME', { def: 0.36 }),
        TOG('filter', 'FILTER', ['LP', 'BP', 'HP'], { def: 1 }), TOG('direction', 'SWEEP', ['up', 'down'])],
      desc: 'Envelope filter (auto-wah): SENS sets how hard you must pick, RESO the peak, RANGE the sweep width; LP / BP / HP and up / down sweep.',
    }),
    B({
      id: 'bee.octahive', name: 'Octacomb Fuzz', ref: 'Beetronics FX Octahive', code: 'OCTACOMB', logo: 'Octacomb', typeName: 'Octave fuzz', cat: 'Fuzz', emblem: 'hex', seed: 9, cost: 1.4,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'o', algo: 'pitch', params: { semis1: 12, level1: 0.6, dry: 1, level2: 0 } },
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', bias: 0.2, stages: 2, stage2Db: 8, gainMinDb: 14, gainMaxDb: 50, tone: 'lp', toneLo: 1200, toneHi: 8000, levelMaxDb: 4, outTrim: 0.26 } },
      ] },
      controls: [k('f.level', 'VOLUME'), k('f.gain', 'FUZZ', { def: 0.6 }), k('f.tone', 'TONE'), TOG('oct', 'OCTAVE', ['off', 'on'], { def: 1, virtual: true }), TOG('range', 'RANGE', ['lo', 'hi'], { virtual: true })],
      derive: (p) => ({ 'o.on': p.oct ? 1 : 0, 'o.level1': p.range ? 0.85 : 0.55 }),
    }),
    B({
      id: 'bee.swarm', name: 'Horde Harmonic Fuzz', ref: 'Beetronics FX Swarm', code: 'HORDE', logo: 'Horde', typeName: 'Harmonic fuzz', cat: 'Fuzz', emblem: 'swarm', seed: 13,
      palette: { base: '#3b3a37', dark: '#0f0e0c', light: '#8e8b84' }, text: '#f3c64a', knob: 'chrome',
      algo: 'drive', opts: { clip: 'muff', stages: 3, stage2Db: 10, gainMinDb: 16, gainMaxDb: 54, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 900, trebleF: 3000, levelMaxDb: 4, outTrim: 0.4,
        modes: [{ preEq: [{ type: 'peak', f: 1400, q: 1.2, db: 5 }] }, { preEq: [{ type: 'peak', f: 2600, q: 1.5, db: 8 }, { type: 'hp', f: 180, q: 0.7, db: 0 }] }] },
      controls: [k('level', 'VOLUME'), k('gain', 'FUZZ', { def: 0.6 }), k('bass', 'BASS'), k('treble', 'TREBLE'), TOG('mode', 'HARMONICS', ['low', 'high'])],
    }),
    B({
      id: 'bee.royaljelly', name: 'Queen Jelly Blender', ref: 'Beetronics FX Royal Jelly', code: 'QUEEN JELLY', logo: 'Queen Jelly', logoSize: 15, typeName: 'Overdrive / fuzz blender', cat: 'Overdrive', emblem: 'queen', seed: 21, cost: 1,
      palette: { base: '#6b3fa0', dark: '#24113f', light: '#cdb0ff' }, text: '#f3e0ff', knob: 'chrome',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'od', algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 650, tone: 'lp', toneLo: 1600, toneHi: 9000, gainMaxDb: 34, levelMaxDb: 6 } },
        { prefix: 'fz', algo: 'drive', opts: { clip: 'muff', stages: 2, gainMinDb: 10, gainMaxDb: 44, tone: 'none', levelMaxDb: 4, outTrim: 0.5 } },
      ] },
      controls: [k('od.gain', 'DRIVE'), k('fz.gain', 'FUZZ', { def: 0.55 }), k('fz.blend', 'BLEND', { def: 0.45 }), k('od.tone', 'TONE'), k('fz.level', 'VOLUME'), TOG('bass', 'BASS', ['thin', 'full'], { def: 1, virtual: true })],
      fixed: { 'od.level': 0.5 },
      derive: (p) => ({ 'od.bass': p.bass ? 0.6 : 0.35 }),
      desc: 'Overdrive and fuzz side by side: BLEND fades from the overdrive alone to the fuzz.',
    }),
    B({
      id: 'bee.vezzpa', name: 'Yellowjacket Stutter', ref: 'Beetronics FX Vezzpa', code: 'YELLOWJACKET', logo: 'Yellowjacket', logoSize: 14, typeName: 'Octave stutter', cat: 'Pitch', emblem: 'wasp', seed: 17, cost: 1.3,
      palette: { base: '#f0c000', dark: '#6a4e00', light: '#fff1a0' },
      algo: 'chain',
      opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { semis1: 12, level1: 0.6, dry: 1, level2: 0 } },
        { prefix: 's', algo: 'slicer', params: { pattern: 0 } },
      ] },
      controls: [K('s.time', 'RATE', { min: 60, max: 600, def: 160, display: (v) => Math.round(v) + ' ms', invert: true }), k('s.depth', 'DEPTH', { def: 0.8 }), k('p.level1', 'OCTAVE', { def: 0.6 }), K('s.level', 'VOLUME', { min: -12, max: 12, def: 0, display: (v) => v.toFixed(1) + ' dB' }),
        TOG('oct', 'OCT', ['down', 'up'], { def: 1, virtual: true }), TOG('s.smooth', 'SHAPE', ['sqr', 'soft'], { values: [0.1, 0.6] })],
      derive: (p) => ({ 'p.semis1': p.oct ? 12 : -12 }),
      desc: 'Octave up / down mixed with the dry signal and chopped by a rhythmic stutter.',
    }),
    B({
      id: 'bee.fuzzhive', name: 'Fuzzcomb', ref: 'Beetronics FX Fuzzhive', code: 'FUZZCOMB', logo: 'Fuzzcomb', typeName: 'Germanium fuzz', cat: 'Fuzz', emblem: 'bee', seed: 29,
      palette: { base: '#c46a2a', dark: '#4e2208', light: '#ffc08a' },
      algo: 'drive', opts: { clip: 'ge', bias: 0.3, stages: 2, stage2Db: 8, gainMinDb: 14, gainMaxDb: 50, tone: 'lp', toneLo: 1200, toneHi: 8000, levelMaxDb: 4, outTrim: 0.45, modes: [{ preEq: [{ type: 'peak', f: 700, q: 0.8, db: -5 }] }, {}] },
      controls: [k('level', 'VOLUME'), k('gain', 'FUZZ', { def: 0.6 }), k('tone', 'TONE'), TOG('mode', 'MID', ['scoop', 'flat'], { def: 1 })],
    }),
    B({
      id: 'bee.overhive', name: 'Overcomb Drive', ref: 'Beetronics FX Overhive', code: 'OVERCOMB', logo: 'Overcomb', typeName: 'Overdrive', cat: 'Overdrive', emblem: 'bee', seed: 33,
      palette: { base: '#6f9a2a', dark: '#22370a', light: '#d6f28a' },
      algo: 'drive', opts: { clip: 'asym', cleanSum: true, tone: 'eq3', eqRangeDb: 12, bassF: 120, trebleF: 2800, gainMaxDb: 36, levelMaxDb: 8, modes: [{}, { gainMaxDb: 44, preEq: [{ type: 'peak', f: 800, q: 0.8, db: 4 }] }] },
      controls: [k('gain', 'GAIN'), k('level', 'VOLUME'), k('bass', 'BASS'), k('treble', 'TREBLE'), TOG('mode', 'MODE', ['blues', 'hot'])],
    }),
    B({
      id: 'bee.seabee', name: 'Reefbee Harmonizer', ref: 'Beetronics FX Seabee', code: 'REEFBEE', logo: 'Reefbee', typeName: 'Harmonizer modulation', cat: 'Modulation', emblem: 'wave', seed: 37, cost: 1.6,
      palette: { base: '#1f9a8f', dark: '#08403c', light: '#9ff2e4' }, text: '#04211e', led: '#5fffe0',
      stereo: 'both',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { dry: 1, level2: 0, semis1: 7 } },
        { prefix: 'c', algo: 'chorus', params: { mix: 0.4 } },
      ] },
      controls: [K('p.semis1', 'INTERVAL', { min: -12, max: 12, step: 1, def: 7, display: (v) => (v > 0 ? '+' : '') + Math.round(v) + ' st' }), k('p.cents', 'DETUNE', { min: -50, max: 50, def: 8, display: (v) => Math.round(v) + ' ct' }), k('p.level1', 'MIX', { def: 0.45 }),
        k('c.rate', 'RATE', { def: 0.3 }), k('c.depth', 'DEPTH', { def: 0.5 }), k('c.mix', 'MOD', { def: 0.4 }),
        TOG('pmode', 'MODE', ['harm', 'detune'], { virtual: true })],
      derive: (p) => (p.pmode ? { 'p.semis1': 0, 'p.cents': Math.max(6, Math.abs(p['p.cents'] ?? 8)) } : {}),
      desc: 'A pitch-shifted voice (any interval, or a detuned unison in MODE detune) washed in chorus modulation.',
    }),
    B({
      id: 'bee.whoctahell', name: 'Hellcomb Bass Octave', ref: 'Beetronics FX Whoctahell', code: 'HELLCOMB', logo: 'Hellcomb', typeName: 'Bass octave fuzz', cat: 'Fuzz', emblem: 'devil', seed: 41, cost: 1.4,
      palette: { base: '#b3201a', dark: '#3e0604', light: '#ff9a8a', honey: '#f0a10c' }, text: '#fff0e8', knob: 'chrome', led: '#ff3b2f',
      algo: 'chain',
      opts: { chain: [
        { prefix: 'o', algo: 'pitch', params: { semis1: -12, level1: 0.7, dry: 1, level2: 0 } },
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 8, gainMinDb: 12, gainMaxDb: 48, tone: 'lp', toneLo: 900, toneHi: 6000, levelMaxDb: 4, outTrim: 0.45 } },
      ] },
      controls: [k('f.level', 'VOLUME'), k('f.gain', 'FUZZ', { def: 0.55 }), k('o.level1', 'OCTAVE', { def: 0.7 }), k('f.blend', 'BLEND', { def: 0.6 }), TOG('oct', 'OCT', ['sub', 'up'], { virtual: true })],
      derive: (p) => ({ 'o.semis1': p.oct ? 12 : -12 }),
      desc: 'Octave (sub or up) into a fuzz with a clean BLEND that keeps the low end of a bass intact.',
    }),
  ]);
}
