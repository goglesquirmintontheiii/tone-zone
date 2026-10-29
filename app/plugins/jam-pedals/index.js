// Built-in Tone Zone plugin: JAM Pedals.
// Blocks inspired by JAM Pedals gear. Names, logos and artwork are Tone Zone originals; control layouts,
// enclosure shapes and colours follow the real units (see each block's `ref`).
//
// "jam" form: hand-painted boxes with a brush-textured illustration. `shell: 'tub'` wraps the box in the
// 3D-printed bathtub exoskeleton (claw feet, rim, rubber ducks and a life-ring around the footswitch).
export default function register(tz) {
  const { K, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('jam-gloss')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const lg = (id, stops, o = {}) => {
      const gr = svg(o.radial ? 'radialGradient' : 'linearGradient', Object.assign({ id }, o.radial ? { cx: o.cx ?? 0.4, cy: o.cy ?? 0.35, r: o.r ?? 0.7 } : { x1: o.x1 ?? 0, y1: o.y1 ?? 0, x2: o.x2 ?? 0, y2: o.y2 ?? 1 }), d);
      for (const [off, col, op] of stops) svg('stop', { offset: off, 'stop-color': col, 'stop-opacity': op ?? 1 }, gr);
    };
    lg('jam-gloss', [[0, '#fff', 0.3], [0.1, '#fff', 0.06], [0.5, '#fff', 0], [1, '#000', 0.25]]);
    lg('jam-tub', [[0, '#ffffff'], [0.55, '#eef1f3'], [1, '#b9c2c9']]);
    lg('jam-duck', [[0, '#fff3a0'], [0.6, '#ffd21f'], [1, '#d99a00']], { radial: true });
    lg('jam-water', [[0, '#bfe9ff', 0.95], [1, '#5fb6e6', 0.95]]);
    lg('jam-bulb', [[0, '#fffbe0'], [0.6, '#ffe46b'], [1, '#f2b600']], { radial: true });
    noisePattern(d, 'jam-brush', 40, 80, [0, 0, 0], 0, 0.12, 2);
  }
  const f1 = (v) => (+v).toFixed(1);

  // rubber duck facing left (s = scale)
  function duck(g, x, y, s, flip = false) {
    const k = flip ? -1 : 1;
    const t = svg('g', { transform: `translate(${f1(x)},${f1(y)}) scale(${k * s},${s})` }, g);
    svg('path', { d: 'M-9 2 C-10 9 6 11 11 5 C14 2 12 -3 8 -2 C4 -1 1 0 -2 -1 C-6 -2 -8 -1 -9 2 Z', fill: 'url(#jam-duck)', stroke: '#8a5a00', 'stroke-width': 0.6 }, t);
    svg('circle', { cx: -5, cy: -5, r: 5, fill: 'url(#jam-duck)', stroke: '#8a5a00', 'stroke-width': 0.6 }, t);
    svg('path', { d: 'M-9.5 -4.6 Q-14 -4 -13.5 -2.4 Q-11 -1.8 -9 -3', fill: '#ff7a1a', stroke: '#9a3f00', 'stroke-width': 0.4 }, t);
    svg('circle', { cx: -6.4, cy: -6.4, r: 0.9, fill: '#141414' }, t);
    svg('path', { d: 'M1 2 Q5 0 7 3', fill: 'none', stroke: '#c48600', 'stroke-width': 0.7 }, t);
  }
  function bubbles(g, pts) {
    for (const [x, y, r] of pts) {
      svg('circle', { cx: x, cy: y, r, fill: '#fff', 'fill-opacity': 0.35, stroke: '#ffffff', 'stroke-width': 0.6, 'stroke-opacity': 0.9 }, g);
      svg('circle', { cx: x - r * 0.35, cy: y - r * 0.35, r: r * 0.25, fill: '#fff', 'fill-opacity': 0.9 }, g);
    }
  }
  // the painted scene: a bather in a clawfoot tub, splash, and the light-bulb moment
  function scene(g, cx, cy, a) {
    const ink = a.ink;
    // light bulb + rays
    for (let i = 0; i < 9; i++) {
      const t = Math.PI * (1.05 + i * 0.11);
      svg('line', { x1: f1(cx + 34 + Math.cos(t) * 13), y1: f1(cy - 40 + Math.sin(t) * 13), x2: f1(cx + 34 + Math.cos(t) * 19), y2: f1(cy - 40 + Math.sin(t) * 19), stroke: a.accent, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
    }
    svg('path', { d: `M${cx + 34} ${cy - 49} c-6 0 -9 4 -9 8 c0 4 3 5 4 8 h10 c1 -3 4 -4 4 -8 c0 -4 -3 -8 -9 -8 Z`, fill: 'url(#jam-bulb)', stroke: ink, 'stroke-width': 1 }, g);
    svg('path', { d: `M${cx + 30} ${cy - 32} h8 M${cx + 30.5} ${cy - 30} h7 M${cx + 31.5} ${cy - 28} h5`, stroke: ink, 'stroke-width': 1 }, g);
    // bather: head, beard, arms up
    svg('path', { d: `M${cx - 12} ${cy - 12} q-10 -10 -8 -22 M${cx + 8} ${cy - 12} q8 -8 6 -20`, fill: 'none', stroke: '#f0c39a', 'stroke-width': 4.2, 'stroke-linecap': 'round' }, g);
    svg('path', { d: `M${cx - 12} ${cy - 12} q-10 -10 -8 -22 M${cx + 8} ${cy - 12} q8 -8 6 -20`, fill: 'none', stroke: ink, 'stroke-width': 0.7, 'stroke-opacity': 0.6 }, g);
    svg('circle', { cx: cx - 2, cy: cy - 20, r: 8, fill: '#f0c39a', stroke: ink, 'stroke-width': 1 }, g);
    svg('path', { d: `M${cx - 9} ${cy - 18} q7 12 14 0 q-2 8 -7 9 q-5 -1 -7 -9 Z`, fill: '#f4f1ea', stroke: ink, 'stroke-width': 0.8 }, g);
    svg('path', { d: `M${cx - 9} ${cy - 23} q7 -9 14 0`, fill: 'none', stroke: '#f4f1ea', 'stroke-width': 2.4 }, g);
    svg('circle', { cx: cx - 5, cy: cy - 21, r: 0.9, fill: ink }, g);
    svg('circle', { cx: cx + 1, cy: cy - 21, r: 0.9, fill: ink }, g);
    svg('ellipse', { cx: cx - 2, cy: cy - 16.5, rx: 1.8, ry: 1.4, fill: ink }, g);
    // tub with water + splash
    svg('path', { d: `M${cx - 36} ${cy - 8} H${cx + 36} Q${cx + 36} ${cy + 16} ${cx + 18} ${cy + 18} H${cx - 18} Q${cx - 36} ${cy + 16} ${cx - 36} ${cy - 8} Z`, fill: a.fill, stroke: ink, 'stroke-width': 1.4 }, g);
    svg('rect', { x: cx - 39, y: cy - 11, width: 78, height: 4.5, rx: 2.2, fill: a.fill, stroke: ink, 'stroke-width': 1.2 }, g);
    svg('path', { d: `M${cx - 38} ${cy - 11} q6 -7 12 -2 q5 -8 11 -1 q6 -7 13 0 q6 -8 12 -1 q6 -6 14 0 q4 -5 6 2`, fill: 'url(#jam-water)', stroke: ink, 'stroke-width': 0.8 }, g);
    for (const s of [-1, 1]) svg('path', { d: `M${cx + s * 24} ${cy + 17} q${s * 2} 5 ${s * 6} 6 q${-s * 1} -3 ${s * 1} -4`, fill: a.accent2 || '#c9a24a', stroke: ink, 'stroke-width': 0.8 }, g);
    for (const [dx, dy] of [[-42, -16], [-46, -6], [42, -18], [47, -9], [-30, -24], [34, -27]]) svg('path', { d: `M${cx + dx} ${cy + dy} q1.6 -3 3 0 a1.5 1.5 0 0 1 -3 0`, fill: '#bfe9ff', stroke: ink, 'stroke-width': 0.5 }, g);
  }

  const BOX = { std: { w: 128, h: 238, rx: 7 }, tub: { w: 164, h: 262, rx: 7 } };
  tz.addForm('jam', (ctx, d) => {
    ensureDefs();
    const g = ctx.g, tub = d.shell === 'tub';
    const B = tub ? BOX.tub : BOX.std, w = B.w, h = B.h;
    const a = Object.assign({ ink: '#1b1b22', fill: '#f4f1ea', accent: '#ffd21f' }, d.art || {});
    const txt = d.text || '#1b1b22';
    // box origin (inside the tub shell the metal box sits in the middle)
    const ox = tub ? (w - 128) / 2 : 0, oy = tub ? 14 : 0, bw = 128, bh = tub ? 226 : h;
    if (tub) {
      // 3D-printed bathtub shell: rounded tub body with a rolled rim and four claw feet
      softShadow(g, { w, h, rx: 40, dy: 14, blur: 9, opacity: 0.55 });
      for (const [fx, fy, s] of [[16, h - 26, -1], [w - 16, h - 26, 1], [14, 34, -1], [w - 14, 34, 1]]) {
        svg('path', { d: `M${fx} ${fy - 10} q${s * 10} 4 ${s * 9} 14 q${-s * 2} 6 ${-s * 6} 4 q${s * 1} -6 ${-s * 3} -9 Z`, fill: '#c9a24a', stroke: '#6b4a10', 'stroke-width': 0.8 }, g);
      }
      svg('rect', { x: 4, y: 0, width: w - 8, height: h, rx: 44, fill: 'url(#jam-tub)', stroke: '#8e98a0', 'stroke-width': 1 }, g);
      svg('rect', { x: 8, y: 4, width: w - 16, height: h - 8, rx: 40, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.4 }, g);
      svg('rect', { x: 4, y: 0, width: w - 8, height: h, rx: 44, fill: 'url(#jam-brush)', 'fill-opacity': 0.4 }, g);
    } else softShadow(g, { w, h, rx: B.rx, dy: 14, blur: 9, opacity: 0.6 });
    const box = svg('g', { transform: `translate(${ox},${oy})` }, g);
    svg('rect', { width: bw, height: bh, rx: B.rx, fill: d.color }, box);
    svg('rect', { width: bw, height: bh, rx: B.rx, fill: 'url(#jam-brush)' }, box);
    // painted art band
    const artY = d.artY ?? (tub ? 128 : 134);
    scene(box, bw / 2, artY, a);
    svg('rect', { width: bw, height: bh, rx: B.rx, fill: 'url(#jam-gloss)', 'pointer-events': 'none' }, box);
    svg('rect', { width: bw, height: bh, rx: B.rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, box);
    // hand-lettered logo
    const ly = d.logoY ?? artY + (tub ? 33 : 31);
    const lt = label(box, bw / 2, ly, d.logo || '', { size: d.logoSize || 24, fill: d.logoColor || txt, font: "'Dancing Script', cursive", weight: 700, ls: 0.4 });
    lt.setAttribute('stroke', d.logoStroke || '#fff'); lt.setAttribute('stroke-width', 2.6); lt.setAttribute('paint-order', 'stroke');
    if (d.sub && !tub) label(box, bw / 2, ly + 18, d.sub, { size: 5.4, fill: txt, weight: 800, ls: 1.6 });
    label(tub ? g : box, tub ? w / 2 : bw / 2, tub ? h - 5 : bh - 8, 'TONE ZONE', { size: 4.2, fill: tub ? '#6b7680' : txt, weight: 800, ls: 1.2, opacity: 0.7 });
    if (tub) {
      // rubber ducks perched on the rim + bubbles
      // kept inside the tub's rounded corners
      duck(g, 34, 30, 1.2);
      duck(g, w - 32, h - 30, 1.05, true);
      duck(g, 28, h - 48, 0.9);
      bubbles(g, [[w - 22, 26, 4], [w - 32, 18, 2.6], [w - 14, 44, 2.2], [30, h - 16, 3], [12, 60, 2]]);
    }
    // controls: three knobs across the top, the 3-way under the middle, footswitch at the bottom
    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      c._auto = true;
      if (c.t === 'knob') { const i = d.controls.filter((k) => k.t === 'knob').indexOf(c); Object.assign(c, { x: ox + [26, 64, 102][i], y: oy + 40, r: 12.5, labelPos: 'above' }); }
      else if (c.t === 'toggle') Object.assign(c, { x: ox + 64, y: oy + 76, orient: 'h' });
      else if (c.t === 'foot') Object.assign(c, { x: ox + 64, y: oy + bh - 34, r: 13 });
      else if (c.t === 'led') Object.assign(c, { x: ox + (tub ? 18 : 30), y: oy + bh - 34, r: 2.8 });
    }
    if (tub) {
      // life-ring around the footswitch
      const fx = ox + 64, fy = oy + bh - 34;
      svg('circle', { cx: fx, cy: fy, r: 23, fill: 'none', stroke: '#ffffff', 'stroke-width': 9 }, g);
      svg('circle', { cx: fx, cy: fy, r: 23, fill: 'none', stroke: '#e2322b', 'stroke-width': 9, 'stroke-dasharray': `${f1(Math.PI * 23 / 4)} ${f1(Math.PI * 23 / 4)}` }, g);
      svg('circle', { cx: fx, cy: fy, r: 27.5, fill: 'none', stroke: '#8a1d17', 'stroke-width': 0.6 }, g);
      svg('circle', { cx: fx, cy: fy, r: 18.5, fill: 'none', stroke: '#8a1d17', 'stroke-width': 0.6 }, g);
    }
    const theme = { text: txt, knob: d.knob || 'cream', labelSize: 6.6, labelFont: "'Barlow Condensed', sans-serif" };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: tub ? 70 : 56, gap: 28 }) };
  });

  // Eureka!: a Fuzz Face-style transistor fuzz into a Big Muff-style tone stack, 3-way bass boost (+1 / 0 / +2)
  const eurekaV = {
    clip: 'si', stages: 2, stage2Db: 10, bias: 0.25, preHp: 60, gainMinDb: 16, gainMaxDb: 46, tone: 'blend', blendLp: 520, blendHp: 1250,
    postLp: 8500, levelMinDb: -33, levelMaxDb: -3,
    modes: [{}, { preEq: [{ type: 'ls', f: 130, q: 0.7, db: 4 }] }, { preEq: [{ type: 'ls', f: 160, q: 0.7, db: 8 }], postEq: [{ type: 'ls', f: 110, q: 0.7, db: 2 }] }],
  };
  const ctl = () => [
    K('level', 'LEVEL', { def: 0.55, display: ten }), K('tone', 'TONE', { def: 0.5, display: ten }), K('gain', 'GAIN', { def: 0.6, display: ten }),
    TOG('mode', 'BASS', ['+1', '0', '+2'], { def: 1, values: [1, 0, 2] }),
    FOOT(), LED({ color: '#ff2a1a' }),
  ];
  tz.addDefs([
    def({
      id: 'jam.eureka', name: 'Aha! Fuzz', code: 'AHA!', logo: 'Aha!', ref: 'JAM Pedals Eureka! Fuzz', brand: 'JAM Pedals', cat: 'Fuzz', typeName: 'Silicon fuzz',
      form: 'jam', color: '#7cc0e0', text: '#16233a', art: { ink: '#16233a', fill: '#f4f1ea', accent: '#ffd21f', accent2: '#c9a24a' }, sub: 'SILICON FUZZ',
      algo: 'drive', opts: eurekaV, controls: ctl(),
      desc: 'All-rounder silicon fuzz: a Fuzz Face-style front end into a Big Muff-style tone control. The 3-way BASS switch adds a little (+1) or a lot (+2) of low end.',
    }),
    def({
      id: 'jam.eurequack', name: 'Aha-Quack Fuzz', code: 'AHA-QUACK', logo: 'Aha-Quack!', ref: 'JAM Pedals EureQuack (Eureka! Fuzz bathtub edition)', brand: 'JAM Pedals', cat: 'Fuzz', typeName: 'Silicon fuzz · bath edition',
      form: 'jam', shell: 'tub', color: '#ffe36b', text: '#2a1d06', logoSize: 21, art: { ink: '#2a1d06', fill: '#ffffff', accent: '#ff7a1a', accent2: '#c9a24a' }, sub: 'BATH-TIME FUZZ',
      algo: 'drive', opts: eurekaV, controls: ctl(),
      desc: 'Same circuit as the Aha! Fuzz, wrapped in a hand-painted 3D-printed bathtub with rubber ducks and a life-ring footswitch surround. Level, Tone, Gain and the 3-way BASS boost (+1 / 0 / +2).',
    }),
  ]);
}
