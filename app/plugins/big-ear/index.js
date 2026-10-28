// Built-in Tone Zone plugin: Big Ear Pedals.
// Blocks inspired by BIG EAR pedals (Nashville, formerly BIG EAR n.y.c.). Names, printed text and artwork are
// Tone Zone originals; control counts, labels and finishes follow the real units (see each block's `ref`).
// One custom "bigear" form serves the family: a hand-painted Hammond-style box (or mini box, the nine-switch
// board, and a pizza-slice shape) with a big painted name across the face, per-pedal painted art (bread loaf, axe,
// stitches, ribbons, rainbow …) and finishes: solid, sparkle, candy, wrinkle, prismatic and walnut facia.
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, ten } = tz.helpers;
  const { svg, label, formKit, shade, softShadow, noisePattern } = tz.gfx;

  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const f1 = (v) => v.toFixed(1);
  // smooth (Catmull-Rom) path through points, optionally jittered for a hand-painted line
  function brush(pts, o = {}) {
    const r = o.r ? rng(o.seed || 7) : null;
    const P = pts.map(([x, y]) => (r ? [x + (r() - 0.5) * o.r, y + (r() - 0.5) * o.r] : [x, y]));
    if (o.closed) P.push(P[0], P[1], P[2]);
    let d = `M${f1(P[0][0])} ${f1(P[0][1])}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
      if (o.closed && i === P.length - 4) break;
    }
    return o.closed ? d + 'Z' : d;
  }
  const paint = (g, d, stroke, wdt, o = {}) => svg('path', Object.assign({ d, fill: 'none', stroke, 'stroke-width': wdt, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o), g);
  const blob = (g, d, fill, ink, o = {}) => svg('path', Object.assign({ d, fill, stroke: ink, 'stroke-width': o.sw ?? 1.3, 'stroke-linejoin': 'round' }, o.attrs || {}), g);

  // ------------------------------------------------------------------ painted art (cx, cy = centre of the art band)
  const ART = {
    // bread loaf with scoring and crumbs
    loaf(g, cx, cy, pal) {
      const ink = pal.artInk || pal.ink;
      svg('ellipse', { cx, cy: cy + 17, rx: 46, ry: 5, fill: '#000', 'fill-opacity': 0.18 }, g);
      blob(g, brush([[cx - 44, cy + 14], [cx - 46, cy - 2], [cx - 30, cy - 16], [cx, cy - 21], [cx + 30, cy - 16], [cx + 46, cy - 2], [cx + 44, cy + 14], [cx, cy + 17]], { closed: true, r: 1.6, seed: 3 }), pal.art || '#c98a3c', ink);
      paint(g, brush([[cx - 34, cy - 7], [cx - 14, cy - 16], [cx + 12, cy - 17], [cx + 32, cy - 9]], { r: 1.2, seed: 5 }), '#fff', 2.4, { 'stroke-opacity': 0.35 });
      for (let i = 0; i < 4; i++) {
        const x = cx - 27 + i * 18;
        paint(g, brush([[x - 6, cy + 2], [x, cy - 5], [x + 7, cy - 10]], { r: 1, seed: 11 + i }), pal.art2 || '#f3d08d', 3.2);
      }
      const r = rng(19);
      for (let i = 0; i < 6; i++) svg('circle', { cx: cx - 40 + r() * 80, cy: cy + 22 + r() * 5, r: 0.8 + r() * 1.1, fill: pal.art || '#c98a3c', stroke: ink, 'stroke-width': 0.5 }, g);
    },
    // hand-scribbled notes (low-end edition): staff lines, notes and a bass clef-ish curl over the loaf
    notes(g, cx, cy, pal) {
      ART.loaf(g, cx, cy + 8, pal);
      const ink = pal.artInk || pal.ink;
      for (let i = 0; i < 3; i++) paint(g, brush([[cx - 50, cy - 31 + i * 4], [cx, cy - 33 + i * 4], [cx + 50, cy - 30 + i * 4]], { r: 1.2, seed: 40 + i }), ink, 0.6, { 'stroke-opacity': 0.55 });
      [[-34, -27], [-14, -31], [8, -25], [28, -29]].forEach(([dx, dy], i) => {
        svg('ellipse', { cx: cx + dx, cy: cy + dy, rx: 2.6, ry: 1.9, fill: ink, transform: `rotate(-20 ${cx + dx} ${cy + dy})` }, g);
        paint(g, `M${cx + dx + 2.3} ${cy + dy} v-9` + (i % 2 ? ` q3 2 4 5` : ''), ink, 0.8);
      });
    },
    // axe with wood chips (line-art, white on wrinkle black)
    axe(g, cx, cy, pal) {
      const ink = pal.art || '#f2efe6';
      const handle = brush([[cx - 46, cy + 22], [cx - 10, cy + 2], [cx + 22, cy - 16]], { r: 1.2, seed: 4 });
      paint(g, handle, ink, 6);
      paint(g, handle, '#8a5a2e', 3.4);
      // blade: painted steel with a bright edge
      blob(g, brush([[cx + 10, cy - 26], [cx + 28, cy - 34], [cx + 46, cy - 26], [cx + 50, cy - 8], [cx + 40, cy + 2], [cx + 30, cy - 10], [cx + 18, cy - 14]], { closed: true, r: 1, seed: 8 }), '#b9bec4', ink, { sw: 1.8 });
      paint(g, brush([[cx + 47, cy - 25], [cx + 51, cy - 13], [cx + 41, cy + 1]], { r: 0.5 }), '#ffffff', 2.4);
      svg('circle', { cx: cx + 22, cy: cy - 19, r: 3, fill: pal.color, stroke: ink, 'stroke-width': 1 }, g);
      // log end with rings
      svg('ellipse', { cx: cx - 30, cy: cy - 18, rx: 14, ry: 10, fill: '#c9955a', stroke: ink, 'stroke-width': 1.4 }, g);
      for (const r of [9, 5.5, 2.2]) svg('ellipse', { cx: cx - 30, cy: cy - 18, rx: r * 1.3, ry: r, fill: 'none', stroke: '#6b4220', 'stroke-width': 0.8 }, g);
      const rnd = rng(23);
      for (let i = 0; i < 4; i++) {
        const x = cx - 8 + rnd() * 26, y = cy + 10 + rnd() * 12, a = rnd() * 180;
        svg('path', { d: `M${f1(x)} ${f1(y)} l7 -2 l-1 4 z`, fill: '#e0b47a', stroke: ink, 'stroke-width': 0.8, 'stroke-linejoin': 'round', transform: `rotate(${f1(a)} ${f1(x)} ${f1(y)})` }, g);
      }
    },
    // octave burst: eight painted rays around two rings
    burst(g, cx, cy, pal) {
      const ink = pal.art || '#ffd23a';
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i + 0.2;
        paint(g, brush([[cx + Math.cos(a) * 15, cy + Math.sin(a) * 15], [cx + Math.cos(a + 0.08) * 26, cy + Math.sin(a + 0.08) * 26], [cx + Math.cos(a) * 38, cy + Math.sin(a) * 34]], { r: 1.6, seed: 50 + i }), ink, i % 2 ? 2 : 3.4);
      }
      svg('circle', { cx, cy, r: 10.5, fill: 'none', stroke: ink, 'stroke-width': 2.4 }, g);
      svg('circle', { cx, cy, r: 4.8, fill: ink }, g);
    },
    // three flowing ribbons (reverb)
    ribbons(g, cx, cy, pal) {
      const cols = pal.arts || ['#f6e7c8', '#e6b2a6', '#b9d3d8'];
      cols.forEach((c, i) => {
        const y = cy - 18 + i * 13;
        paint(g, brush([[cx - 56, y + 6], [cx - 28, y - 6], [cx, y + 4], [cx + 28, y - 8], [cx + 56, y + 2]], { r: 2, seed: 60 + i }), c, 5 - i);
      });
      const r = rng(9);
      for (let i = 0; i < 7; i++) svg('circle', { cx: cx - 50 + r() * 100, cy: cy - 30 + r() * 52, r: 0.8 + r() * 1.2, fill: '#fff', 'fill-opacity': 0.75 }, g);
    },
    // rainbow arcs (ambient modulator)
    rainbow(g, cx, cy, pal) {
      ['#ff5a5a', '#ffa13a', '#ffe04a', '#5fe08a', '#4ab8ff', '#a678ff'].forEach((c, i) => {
        const R = 44 - i * 5.2;
        paint(g, brush([[cx - R, cy + 14], [cx - R * 0.72, cy + 14 - R * 0.68], [cx, cy + 14 - R], [cx + R * 0.72, cy + 14 - R * 0.68], [cx + R, cy + 14]], { r: 0.8, seed: 70 + i }), c, 4.4, { 'stroke-opacity': 0.9 });
      });
    },
    // stitched scar and neck bolts (Frankenstein)
    stitches(g, cx, cy, pal, w) {
      const ink = pal.art || '#1b1b1b';
      const pts = [[cx - 50, cy + 4], [cx - 25, cy - 4], [cx, cy + 3], [cx + 25, cy - 5], [cx + 50, cy + 2]];
      paint(g, brush(pts, { r: 1.2, seed: 81 }), ink, 2.2);
      for (let i = 0; i < 9; i++) {
        const x = cx - 44 + i * 11, y = cy + (i % 2 ? -3 : 1);
        paint(g, `M${x - 2} ${y - 6} L${x + 2} ${y + 6}`, ink, 1.6);
      }
      for (const s of [-1, 1]) {
        const x = s < 0 ? 6 : w - 6;
        svg('rect', { x: x - 6, y: cy - 4, width: 12, height: 8, rx: 1.5, fill: '#9aa0a6', stroke: '#2a2d31', 'stroke-width': 0.8 }, g);
        svg('rect', { x: x - (s < 0 ? 6 : -2), y: cy - 6, width: 4, height: 12, rx: 1, fill: '#c7ccd2', stroke: '#2a2d31', 'stroke-width': 0.8 }, g);
      }
    },
    // three stacked painted pluses
    plus(g, cx, cy, pal) {
      const ink = pal.art || '#fff';
      [[-34, 10, 8], [0, 0, 12], [36, -10, 16]].forEach(([dx, dy, s], i) => {
        paint(g, brush([[cx + dx - s, cy + dy], [cx + dx, cy + dy + 0.6], [cx + dx + s, cy + dy]], { r: 1, seed: 90 + i }), ink, 4 + i);
        paint(g, brush([[cx + dx, cy + dy - s], [cx + dx + 0.6, cy + dy], [cx + dx, cy + dy + s]], { r: 1, seed: 95 + i }), ink, 4 + i);
      });
    },
    // fading Z echoes
    echoes(g, cx, cy, pal) {
      const ink = pal.art || '#fff';
      for (let i = 0; i < 4; i++) {
        const x = cx - 40 + i * 26, s = 13 - i * 2;
        paint(g, `M${x - s} ${cy - s} H${x + s} L${x - s} ${cy + s} H${x + s}`, ink, 3.2 - i * 0.5, { 'stroke-opacity': 1 - i * 0.24 });
      }
    },
    // polka dots
    dots(g, cx, cy, pal, w) {
      const r = rng(pal.seed || 5);
      for (let i = 0; i < 8; i++) svg('circle', { cx: 8 + r() * (w - 16), cy: cy - 16 + r() * 32, r: 2 + r() * 3, fill: pal.art || '#e8463c', stroke: pal.artInk || pal.ink, 'stroke-width': 0.6 }, g);
    },
    // dumbbell (buffer)
    dumbbell(g, cx, cy, pal) {
      const ink = pal.ink;
      paint(g, `M${cx - 22} ${cy} H${cx + 22}`, '#9aa0a6', 3.4);
      for (const s of [-1, 1]) {
        svg('rect', { x: cx + s * 22 - 4, y: cy - 10, width: 8, height: 20, rx: 2.4, fill: pal.art || '#2f2f33', stroke: ink, 'stroke-width': 1 }, g);
        svg('rect', { x: cx + s * 29 - 2.5, y: cy - 6.5, width: 5, height: 13, rx: 1.6, fill: pal.art || '#2f2f33', stroke: ink, 'stroke-width': 1 }, g);
      }
    },
  };

  // tiny original "ear" doodle used as the family mark (not the real logo)
  function earMark(g, x, y, col, s = 1) {
    paint(g, `M${x - 3 * s} ${y + 5 * s} C${x - 7 * s} ${y + 1 * s} ${x - 6 * s} ${y - 7 * s} ${x} ${y - 7 * s} C${x + 6 * s} ${y - 7 * s} ${x + 7 * s} ${y - 1 * s} ${x + 3 * s} ${y + 3 * s} C${x + 1 * s} ${y + 5 * s} ${x + 1 * s} ${y + 7 * s} ${x - 2 * s} ${y + 7 * s}`, col, 1.2 * s);
    paint(g, `M${x - 1.5 * s} ${y + 1 * s} C${x - 3 * s} ${y - 3 * s} ${x + 2.5 * s} ${y - 4 * s} ${x + 2 * s} ${y}`, col, 0.9 * s);
  }

  // painted name: big heavy letters with a darker paint outline, slightly tilted
  function paintLogo(g, x, y, text, size, pal, o = {}) {
    const lines = String(text).split('\n');
    const lh = size * 0.98;
    lines.forEach((ln, i) => {
      const yy = y + (i - (lines.length - 1) / 2) * lh;
      const t = label(g, x, yy, ln, { size, fill: pal.logo, font: "'Oswald', sans-serif", weight: 700, ls: o.ls ?? 0.5, transform: `rotate(${o.tilt ?? -3} ${x} ${yy})` });
      t.setAttribute('stroke', pal.logoStroke);
      t.setAttribute('stroke-width', o.sw ?? Math.max(1.6, size * 0.075));
      t.setAttribute('stroke-linejoin', 'round');
      t.setAttribute('paint-order', 'stroke');
    });
  }

  // ------------------------------------------------------------------ finishes
  let seq = 0;
  function finish(g, defs, id, d, w, h, shapeD) {
    const base = d.color;
    const lg = svg('linearGradient', { id: id + 'b', x1: 0, y1: 0, x2: 0.4, y2: 1 }, defs);
    const stops = d.finish === 'prism'
      ? [[0, '#9ef0e6'], [0.25, '#b9a6ff'], [0.5, '#7fd8ff'], [0.75, '#ffb6e6'], [1, '#6fe0c2']]
      : d.finish === 'candy'
        ? [[0, shade(base, 0.35)], [0.45, base], [1, shade(base, -0.5)]]
        : [[0, shade(base, 0.12)], [0.5, base], [1, shade(base, -0.22)]];
    stops.forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, lg));
    svg('path', { d: shapeD, fill: `url(#${id}b)` }, g);
    const cp = svg('clipPath', { id: id + 'c' }, defs);
    svg('path', { d: shapeD }, cp);
    const inside = svg('g', { 'clip-path': `url(#${id}c)` }, g);
    if (d.finish === 'sparkle' || d.finish === 'candy' || d.finish === 'prism') {
      noisePattern(defs, id + 'sw', 24, 48, [255, 255, 255], 0, d.finish === 'sparkle' ? 0.55 : 0.32, 0);
      noisePattern(defs, id + 'sd', 30, 60, [0, 0, 0], 0, 0.3, 0);
      svg('rect', { width: w, height: h, fill: `url(#${id}sd)` }, inside);
      svg('rect', { width: w, height: h, fill: `url(#${id}sw)` }, inside);
    } else if (d.finish === 'wrinkle') {
      noisePattern(defs, id + 'wr', 28, 56, [0, 0, 0], 0, 0.55, 2);
      noisePattern(defs, id + 'wl', 22, 44, [255, 255, 255], 0, 0.12, 2);
      svg('rect', { width: w, height: h, fill: `url(#${id}wr)` }, inside);
      svg('rect', { width: w, height: h, fill: `url(#${id}wl)` }, inside);
    } else if (d.finish === 'wood') {
      // walnut facia: grain lines + a couple of knots, plus a fine noise
      const r = rng(d.seed || 17);
      let gp = '';
      for (let y = -4; y < h + 8; y += 3.2 + r() * 2.4) {
        const pts = [];
        for (let x = -10; x <= w + 10; x += 22) pts.push([x, y + Math.sin(x / 31 + y / 17) * 2.4 + (r() - 0.5) * 1.4]);
        gp += brush(pts) + ' ';
      }
      svg('path', { d: gp, fill: 'none', stroke: shade(base, -0.45), 'stroke-opacity': 0.55, 'stroke-width': 0.8 }, inside);
      svg('path', { d: gp, fill: 'none', stroke: shade(base, 0.3), 'stroke-opacity': 0.25, 'stroke-width': 0.6, transform: 'translate(0 1.4)' }, inside);
      for (const [kx, ky] of [[w * 0.84, h * 0.55], [w * 0.16, h * 0.84]]) {
        svg('ellipse', { cx: kx, cy: ky, rx: 6, ry: 2.6, fill: 'none', stroke: shade(base, -0.5), 'stroke-width': 0.9 }, inside);
        svg('ellipse', { cx: kx, cy: ky, rx: 2.4, ry: 1, fill: shade(base, -0.55) }, inside);
      }
      noisePattern(defs, id + 'wn', 30, 60, [0, 0, 0], 0, 0.16, 1);
      svg('rect', { width: w, height: h, fill: `url(#${id}wn)` }, inside);
    } else {
      noisePattern(defs, id + 'n', 32, 64, [0, 0, 0], 0, 0.1, 0);
      svg('rect', { width: w, height: h, fill: `url(#${id}n)` }, inside);
    }
    // brushed hand-paint streaks (gives every box a painted, not printed, surface)
    const r = rng((d.seed || 3) + 101);
    for (let i = 0; i < 5; i++) {
      const y = 10 + r() * (h - 20);
      paint(inside, brush([[-6, y], [w * 0.3, y + (r() - 0.5) * 8], [w * 0.7, y + (r() - 0.5) * 8], [w + 6, y + (r() - 0.5) * 6]]), '#fff', 5 + r() * 6, { 'stroke-opacity': 0.035 });
    }
    // sheen
    const rg = svg('radialGradient', { id: id + 'r', cx: 0.28, cy: 0.18, r: 0.75 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': d.finish === 'wrinkle' ? 0.08 : 0.22 }, rg);
    svg('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, rg);
    svg('rect', { width: w, height: h, fill: `url(#${id}r)` }, inside);
    return inside;
  }
  function rim(g, shapeD) {
    svg('path', { d: shapeD, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 1.4 }, g);
    svg('path', { d: shapeD, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.9 }, g);
  }
  const rr = (w, h, r) => `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`;

  // ------------------------------------------------------------------ the form
  tz.addForm('bigear', (ctx, d) => {
    const g = ctx.g;
    const size = d.size || 'std';
    d.controls.forEach((c) => { if (c.x === undefined) c._auto = true; });
    const free = (c) => c._auto;
    if (size === 'pie') return pieForm(ctx, d, free);
    const W = { std: [136, 244], mini: [84, 152], big: [252, 306] }[size];
    const [w, h] = W;
    const id = 'bge' + ++seq;
    const defs = svg('defs', {}, g);
    const shapeD = rr(w, h, size === 'mini' ? 7 : 9);
    softShadow(g, { w, h, rx: 9, dy: 14, blur: 9, opacity: 0.6 });
    const inside = finish(g, defs, id, d, w, h, shapeD);
    const pal = Object.assign({ ink: d.ink || '#151515', logo: d.logoColor || '#f7f2e6', logoStroke: d.logoStroke || shade(d.color, -0.55), color: d.color, seed: d.seed }, d.palette || {});
    const theme = { text: pal.ink, knob: d.knob || 'chrome', labelSize: size === 'mini' ? 5.6 : 6.4, labelWeight: 800, labelLs: 0.8, labelFont: "'Oswald', sans-serif", jackText: pal.ink, toggleTitles: false };

    const knobs = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c) && !c.trim);
    const trims = d.controls.filter((c) => c.t === 'knob' && free(c) && c.trim);
    const feet = d.controls.filter((c) => c.t === 'foot' && free(c));
    const leds = d.controls.filter((c) => c.t === 'led' && free(c));
    let jacks;

    if (size === 'big') {
      // nine-switch board: name on top, a 3 x 3 grid of mole holes with a footswitch + LED each
      paintLogo(g, w / 2 - 12, 40, d.logo, d.logoSize || 40, pal, { tilt: -2 });
      label(g, w / 2 - 12, 70, (d.typeName || '').toUpperCase(), { size: 5.6, fill: pal.ink, weight: 800, ls: 2, font: "'Oswald', sans-serif" });
      // mallet doodle
      const mx = w - 30, my = 36;
      paint(g, `M${mx - 16} ${my + 18} L${mx + 4} ${my - 4}`, '#c08a4a', 4);
      paint(g, `M${mx - 16} ${my + 18} L${mx + 4} ${my - 4}`, pal.ink, 0.8, { 'stroke-opacity': 0.6 });
      svg('rect', { x: mx - 4, y: my - 16, width: 20, height: 12, rx: 3, fill: '#d9a35b', stroke: pal.ink, 'stroke-width': 1.1, transform: `rotate(42 ${mx + 6} ${my - 10})` }, g);
      const xs = [52, 126, 200], ys = [118, 190, 262];
      feet.forEach((f, i) => {
        const x = xs[i % 3], y = ys[(i / 3) | 0];
        svg('ellipse', { cx: x, cy: y + 4, rx: 30, ry: 15, fill: '#3a2410', stroke: pal.ink, 'stroke-width': 1 }, inside);
        svg('ellipse', { cx: x, cy: y + 6, rx: 25, ry: 10.5, fill: '#120a04' }, inside);
        paint(inside, brush([[x - 31, y + 8], [x - 18, y + 20], [x + 18, y + 20], [x + 31, y + 8]], { r: 1.4, seed: 200 + i }), '#7a5a2a', 2.2);
        Object.assign(f, { x, y, r: 11.5, style: 'stomp' });
      });
      leds.forEach((l, i) => Object.assign(l, { x: xs[i % 3], y: ys[(i / 3) | 0] - 29, r: 2.6, bezel: '#2a2a2a' }));
      formKit.tzBadge(g, w / 2, h - 9, pal.ink, 4.2);
      earMark(g, 16, h - 12, pal.ink, 0.9);
      jacks = formKit.jacksSide(d, w, { flip: ctx.flip, y0: 70, gap: 30 });
    } else if (size === 'mini') {
      knobs.forEach((k) => Object.assign(k, { x: w / 2, y: 30, r: 12, labelPos: 'below' }));
      trims.forEach((k) => Object.assign(k, { x: w - 13, y: 32, r: 4.6, labelPos: 'below', labelSize: 4.6, style: k.style || 'white' }));
      const ly = feet.length ? 106 : 120;
      const art = ART[d.art];
      if (art) art(inside, w / 2, d.artY || (feet.length ? 80 : 100), pal, w, h);
      const n = Math.max(...String(d.logo).split('\n').map((s) => s.length));
      paintLogo(g, w / 2, 78, d.logo, d.logoSize || Math.min(22, (w - 18) / (n * 0.56)), pal);
      leds.forEach((l) => Object.assign(l, { x: w / 2, y: ly, r: 2.6, bezel: '#2a2a2a' }));
      feet.forEach((f) => Object.assign(f, { x: w / 2, y: 128, r: 10, style: 'stomp' }));
      if (!feet.length) label(g, w / 2, 134, (d.typeName || '').toUpperCase(), { size: 5.2, fill: pal.ink, weight: 800, ls: 1.6, font: "'Oswald', sans-serif" });
      formKit.tzBadge(g, w / 2, h - 5.5, pal.ink, 3.2);
      jacks = d.jacksTop === false ? formKit.jacksSide(d, w, { flip: ctx.flip, y0: 40, gap: 26 }) : formKit.jacksTop(d, w, { flip: ctx.flip });
    } else {
      // standard Hammond-style box
      if (d.ledRow) {
        // two knobs + a row of eight stack LEDs (ambient modulator)
        knobs.forEach((k, i) => Object.assign(k, { x: knobs.length === 1 ? w / 2 : 40 + i * 56, y: 40, r: 14, labelPos: 'below' }));
        leds.forEach((l, i) => Object.assign(l, { x: 22 + i * 13.1, y: 84, r: 2.5, bezel: '#2a2a2a' }));
        leds.forEach((l, i) => label(g, l.x, l.y + 8, String(i + 1), { size: 4.6, fill: pal.ink, weight: 800 }));
      } else {
        const n = knobs.length;
        knobs.forEach((k, i) => Object.assign(k, { x: n === 1 ? w / 2 : n === 2 ? 42 + i * 52 : 30 + i * 38, y: 40, r: n > 3 ? 11 : 13.5, labelPos: 'below' }));
      }
      trims.forEach((k) => Object.assign(k, { x: w - 16, y: 74, r: 5, labelPos: 'below', labelSize: 4.8, style: k.style || 'white' }));
      const art = ART[d.art];
      if (art) {
        const ax = w / 2, ay = d.artY || 160, sc = d.artScale || 0.85;
        art(svg('g', { transform: `translate(${ax} ${ay}) scale(${sc}) translate(${-ax} ${-ay})` }, inside), ax, ay, pal, w, h);
      }
      const ln = String(d.logo).split('\n');
      const n = Math.max(...ln.map((s) => s.length));
      const ls = d.logoSize || Math.min(40, (w - 20) / (n * 0.54));
      const logoY = d.logoY || 116;
      paintLogo(g, w / 2, logoY, d.logo, ls, pal);
      if (d.typeName && !d.noType) label(g, w / 2, d.typeY || 76, d.typeName.toUpperCase(), { size: 5, fill: pal.ink, weight: 800, ls: 1.8, font: "'Oswald', sans-serif" });
      const fy = 214, ly = 189;
      const fx = feet.length === 3 ? [28, 68, 108] : feet.length === 2 ? [36, 100] : [w / 2];
      feet.forEach((f, i) => Object.assign(f, { x: fx[i], y: fy, r: 12, style: 'stomp' }));
      if (!d.ledRow) leds.forEach((l, i) => Object.assign(l, { x: fx[i] ?? w / 2, y: ly, r: 2.8, bezel: '#2a2a2a', textColor: pal.ink }));
      formKit.tzBadge(g, w / 2, h - 7.5, pal.ink, 3.8);
      earMark(g, 13, h - 10, pal.ink, 0.75);
      jacks = d.jacksTop === false ? formKit.jacksSide(d, w, { flip: ctx.flip, y0: d.jy0 ?? 158, gap: 28 }) : formKit.jacksTop(d, w, { flip: ctx.flip });
    }
    rim(g, shapeD);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks };
  });

  // pizza slice: point on top, crust at the bottom, toppings painted on melted cheese
  function pieForm(ctx, d, free) {
    const g = ctx.g, w = 172, h = 268, cx = w / 2;
    const id = 'bge' + ++seq;
    const defs = svg('defs', {}, g);
    const shapeD = `M${cx - 4} 6 Q${cx} 1 ${cx + 4} 6 L${w - 4} 222 Q${w + 1} 234 ${w - 6} 246 Q${cx} 274 6 246 Q-1 234 4 222 Z`;
    softShadow(g, { w, h, path: shapeD, dy: 14, blur: 9, opacity: 0.6 });
    const lg = svg('linearGradient', { id: id + 'ch', x1: 0, y1: 0, x2: 0.3, y2: 1 }, defs);
    [[0, '#ffd977'], [0.55, '#f4b73c'], [1, '#e29a26']].forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, lg));
    svg('path', { d: shapeD, fill: `url(#${id}ch)` }, g);
    const cp = svg('clipPath', { id: id + 'c' }, defs);
    svg('path', { d: shapeD }, cp);
    const inside = svg('g', { 'clip-path': `url(#${id}c)` }, g);
    // sauce peeking out along the edges
    svg('path', { d: `M${cx} 6 L${w - 4} 222 M${cx} 6 L4 222`, fill: 'none', stroke: '#c8361c', 'stroke-width': 5, 'stroke-opacity': 0.8 }, inside);
    // melted cheese blobs, browned spots
    const r = rng(d.seed || 12);
    for (let i = 0; i < 9; i++) {
      const y = 30 + r() * 180, half = ((y - 6) / 216) * 80, x = cx + (r() - 0.5) * 2 * half * 0.85;
      svg('path', { d: brush([[x - 9, y], [x - 3, y - 6], [x + 7, y - 4], [x + 10, y + 3], [x + 2, y + 7], [x - 6, y + 5]], { closed: true, r: 3, seed: 300 + i }), fill: '#fff1a8', 'fill-opacity': 0.55 }, inside);
    }
    for (let i = 0; i < 14; i++) {
      const y = 24 + r() * 190, half = ((y - 6) / 216) * 80, x = cx + (r() - 0.5) * 2 * half * 0.9;
      svg('ellipse', { cx: f1(x), cy: f1(y), rx: f1(1.5 + r() * 3), ry: f1(1 + r() * 2), fill: '#b5651d', 'fill-opacity': 0.5 }, inside);
    }
    if (d.topping === 'pepperoni') {
      [[cx, 54, 11], [cx - 16, 92, 12], [cx + 18, 98, 11.5], [cx - 40, 188, 9.5], [cx + 41, 184, 10], [cx + 28, 124, 7]].forEach(([x, y, R], i) => {
        svg('circle', { cx: x, cy: y + 1.5, r: R, fill: '#000', 'fill-opacity': 0.2 }, inside);
        blob(inside, brush([...Array(8)].map((_, k) => [x + Math.cos((k * Math.PI) / 4) * R, y + Math.sin((k * Math.PI) / 4) * R]), { closed: true, r: 1.6, seed: 400 + i }), '#b3261c', '#7a130c', { sw: 1 });
        for (let k = 0; k < 4; k++) svg('circle', { cx: f1(x + (r() - 0.5) * R * 1.1), cy: f1(y + (r() - 0.5) * R * 1.1), r: f1(0.8 + r() * 1.2), fill: '#e8705a', 'fill-opacity': 0.8 }, inside);
        paint(inside, `M${x - R * 0.5} ${y - R * 0.55} q${R * 0.4} ${-R * 0.3} ${R * 0.9} 0`, '#fff', 1.2, { 'stroke-opacity': 0.4 });
      });
    }
    // crust
    const crustD = `M-4 216 Q${cx} 244 ${w + 4} 216 L${w + 4} 280 L-4 280 Z`;
    const cg = svg('linearGradient', { id: id + 'cr', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, '#e7b56c'], [0.4, '#c98a3c'], [1, '#8d5523']].forEach(([o, c]) => svg('stop', { offset: o, 'stop-color': c }, cg));
    svg('path', { d: crustD, fill: `url(#${id}cr)` }, inside);
    paint(inside, `M-4 216 Q${cx} 244 ${w + 4} 216`, '#7a4518', 1.4);
    for (let i = 0; i < 16; i++) svg('ellipse', { cx: f1(8 + r() * (w - 16)), cy: f1(238 + r() * 22), rx: f1(1 + r() * 2.4), ry: f1(0.7 + r() * 1.2), fill: '#6d3c15', 'fill-opacity': 0.55 }, inside);
    noisePattern(defs, id + 'n', 30, 60, [0, 0, 0], 0, 0.12, 0);
    svg('path', { d: shapeD, fill: `url(#${id}n)` }, g);
    rim(g, shapeD);
    const ink = '#3a1a08';
    const pal = { logo: '#fff5df', logoStroke: '#6d3510' };
    paintLogo(g, cx, 243, d.logo, d.logoSize || 15, pal, { tilt: 0, sw: 2.2, ls: 1.2 });
    label(g, cx, 255.5, (d.typeName || '').toUpperCase(), { size: 4.2, fill: '#fff5df', weight: 800, ls: 1.6, font: "'Oswald', sans-serif" });
    const theme = { text: ink, knob: d.knob || 'chrome', labelSize: 5.6, labelWeight: 800, labelLs: 0.6, labelFont: "'Oswald', sans-serif", jackText: ink, toggleTitles: false };
    const knobs = d.controls.filter((c) => c.t === 'knob' && free(c));
    knobs.forEach((k, i) => Object.assign(k, { x: cx - 30 + i * 30, y: 150, r: 9, labelPos: 'below' }));
    d.controls.filter((c) => c.t === 'led' && free(c)).forEach((l) => Object.assign(l, { x: cx, y: 124, r: 2.6, bezel: '#2a2a2a' }));
    d.controls.filter((c) => c.t === 'foot' && free(c)).forEach((f) => Object.assign(f, { x: cx, y: 192, r: 11, style: 'stomp' }));
    formKit.placeControls(ctx, d.controls, theme);
    // jacks on the crust edge (bottom), where the slice is wide enough for their labels
    const ins = d.ports.ins, outs = d.ports.outs, flip = ctx.flip;
    const jacks = [];
    ins.forEach((l, i) => jacks.push({ key: `i${i}`, dir: 'in', port: i, label: 'IN', side: 'bottom', x: flip ? cx - 52 - i * 20 : cx + 52 + i * 20, y: 255 }));
    outs.forEach((l, i) => jacks.push({ key: `o${i}`, dir: 'out', port: i, label: 'OUT', side: 'bottom', x: flip ? cx + 52 + i * 20 : cx - 52 - i * 20, y: 255 }));
    return { w, h, theme, jacks };
  }

  // ------------------------------------------------------------------ Neil-mode footswitch (ambient modulator):
  // tap = on / off, hold = alternate ("Neil") versions while held, hold > 2 s = latch the alternates (or unlatch).
  const holds = new Map();
  tz.blockHooks('be.albie', {
    foot(view, ctl, down) {
      if (ctl.t !== 'foot') return false;
      const b = view.block;
      if (down) {
        const s = { held: false };
        s.t1 = setTimeout(() => { s.held = true; tz.app.setParam(b.id, '_neil', 1); }, 450);
        s.t2 = setTimeout(() => {
          const lat = (tz.app.ui(b)._ultra ?? 0) > 0.5 ? 0 : 1;
          tz.app.setParam(b.id, '_ultra', lat);
          tz.ui.toast && tz.ui.toast(lat ? 'Alternate modes latched' : 'Alternate modes unlatched', 'info', 1400);
        }, 2000);
        holds.set(b.id, s);
        return false;
      }
      const s = holds.get(b.id);
      holds.delete(b.id);
      if (!s) return false;
      clearTimeout(s.t1); clearTimeout(s.t2);
      if (s.held) {
        tz.app.setParam(b.id, '_neil', (tz.app.ui(b)._ultra ?? 0) > 0.5 ? 1 : 0);
        return true;
      }
      return false;
    },
  });

  // ------------------------------------------------------------------ blocks
  const BE = (o) => def(Object.assign({ form: 'bigear', brand: 'Big Ear Pedals', cost: 0.6 }, o, {
    controls: [...(o.controls || []), ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));
  const k = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const loafV = (o = {}) => Object.assign({ clip: 'si', bias: 0.2, stages: 2, stage2Db: 6, preHp: 40, gainMinDb: 8, gainMaxDb: 38, tone: 'lp', toneLo: 800, toneHi: 5200, postLp: 6500,
    preEq: [{ type: 'ls', f: 140, q: 0.7, db: 3 }], levelMaxDb: 4, outTrim: 0.5 }, o);
  const loafKnobs = () => [k('level', 'VOLUME', { def: 0.55 }), k('tone', 'TONE', { def: 0.5 }), k('gain', 'FUZZ', { def: 0.6 })];
  const ratV = { clip: 'opamp', slew: 0.3, preHp: 50, gainMinDb: 0, gainMaxDb: 67, clipLp: 12000, tone: 'rat', toneLo: 475, toneHi: 32000, postLp: 14000, levelMaxDb: 4 };
  const pieV = { clip: 'si', stages: 2, stage2Db: 12, preHp: 70, gainMinDb: 14, gainMaxDb: 48, tone: 'blend', blendLp: 500, blendHp: 1300, postLp: 8000, levelMaxDb: 2, outTrim: 0.5 };
  const bettyV = { clip: 'si', bias: 0.25, preHp: 30, gainMinDb: 30, gainMaxDb: 46, tone: 'eq3', bassF: 120, trebleF: 3200, eqRangeDb: 10, postLp: 5600, levelMaxDb: 2, outTrim: 0.45 };

  // ambient-modulator stacks: [normal, alternate] parameter sets; subs not listed are off
  const ALBIE = [
    [{ ch: { rate: 0.3, depth: 0.45, mix: 0.5, mode: 0 }, dl: { time: 110, feedback: 0.1, mix: 0.3, mode: 1 } }, { ch: { rate: 0.5, depth: 0.8, mix: 0.55, mode: 0 }, dl: { time: 150, feedback: 0.38, mix: 0.4, mode: 1 } }],
    [{ dl: { time: 380, feedback: 0.35, mix: 0.3, mode: 0 }, rv: { mode: 1, decay: 0.5, mix: 0.28, shimmer: 0 } }, { dl: { time: 520, feedback: 0.6, mix: 0.38, mode: 4, moddepth: 0.4 }, rv: { mode: 1, decay: 0.8, mix: 0.35, shimmer: 0 } }],
    [{ ch: { rate: 0.25, depth: 0.5, mix: 0.5, mode: 0 }, rv: { mode: 6, decay: 0.55, mix: 0.32, mod: 0.5, shimmer: 0 } }, { ch: { rate: 0.2, depth: 0.7, mix: 0.5, mode: 3 }, rv: { mode: 6, decay: 0.85, mix: 0.42, mod: 0.85, shimmer: 0 } }],
    [{ ch: { rate: 0.3, depth: 0.4, mix: 0.45, mode: 0 }, rv: { mode: 4, decay: 0.6, mix: 0.32, shimmer: 0.4 } }, { ch: { rate: 0.35, depth: 0.6, mix: 0.5, mode: 0 }, rv: { mode: 4, decay: 0.85, mix: 0.45, shimmer: 0.8 } }],
    [{ ph: { rate: 0.3, depth: 0.7, feedback: 0.4, mix: 0.5 }, dl: { time: 330, feedback: 0.3, mix: 0.24, mode: 0 }, rv: { mode: 4, decay: 0.55, mix: 0.28, shimmer: 0.35 } }, { ph: { rate: 0.6, depth: 0.9, feedback: 0.7, mix: 0.5 }, dl: { time: 420, feedback: 0.5, mix: 0.3, mode: 0 }, rv: { mode: 4, decay: 0.8, mix: 0.36, shimmer: 0.7 } }],
    [{ fl: { speed: 0.25, width: 0.6, regen: 0.5, mix: 0.5, manual: 0.5 }, rv: { mode: 2, decay: 0.5, mix: 0.28, shimmer: 0 } }, { fl: { speed: 0.35, width: 0.9, regen: 0.85, mix: 0.55, manual: 0.4 }, rv: { mode: 2, decay: 0.75, mix: 0.36, shimmer: 0 } }],
    [{ ch: { rate: 0.4, depth: 0.4, mix: 1, mode: 1 }, rv: { mode: 6, decay: 0.5, mix: 0.3, mod: 0.4, shimmer: 0 } }, { ch: { rate: 0.6, depth: 0.75, mix: 1, mode: 1 }, rv: { mode: 6, decay: 0.8, mix: 0.4, mod: 0.8, shimmer: 0 } }],
    [{ ch: { rate: 0.3, depth: 0.45, mix: 0.5, mode: 0 }, tr: { rate: 0.5, depth: 0.5, mode: 0 }, rv: { mode: 0, decay: 0.45, mix: 0.25, shimmer: 0 } }, { ch: { rate: 0.4, depth: 0.6, mix: 0.5, mode: 0 }, tr: { rate: 0.75, depth: 0.85, mode: 0 }, rv: { mode: 1, decay: 0.7, mix: 0.32, shimmer: 0 } }],
  ];
  const ALBIE_NAMES = ['chorus + slapback', 'delay + reverb', 'chorus + mod reverb', 'chorus + shimmer', 'phaser + delay + shimmer', 'flanger + reverb', 'vibrato + mod reverb', 'chorus + tremolo + reverb'];

  const nineBoost = [...Array(9)].map((_, i) => 's' + (i + 1));

  tz.addDefs([
    // ---------------------------------------------------------------- the bread-loaf fuzz family
    BE({
      id: 'be.loaf', name: 'Crumb Fuzz', ref: 'BIG EAR pedals LOAF Fuzz', code: 'CRUMB', logo: 'CRUMB', typeName: 'Silicon fuzz', cat: 'Fuzz',
      color: '#ece4cf', ink: '#1a1712', logoColor: '#1a1712', logoStroke: '#f7f1e2', art: 'loaf', seed: 4, knob: 'chrome',
      algo: 'drive', opts: loafV(), controls: loafKnobs(),
      desc: 'Lower-gain silicon fuzz with a warm, almost sub-octave low end and no fizzy top. Cleans up beautifully with the guitar volume; TONE and VOLUME interact.',
    }),
    BE({
      id: 'be.loafwood', name: 'Crumb Fuzz Walnut', ref: 'BIG EAR pedals LOAF Fuzz (walnut wood facia)', code: 'CRUMB', logo: 'CRUMB', typeName: 'Silicon fuzz · walnut', cat: 'Fuzz',
      color: '#7a4a2a', finish: 'wood', ink: '#f6ead2', logoColor: '#f6ead2', logoStroke: '#3a200c', art: 'loaf', seed: 21, knob: 'chrome',
      palette: { art: '#e0a85a', art2: '#fff0c4', artInk: '#2a1606' },
      algo: 'drive', opts: loafV(), controls: loafKnobs(),
      desc: 'The bread-loaf silicon fuzz with a real-wood (walnut / cedar) facia, same circuit as the cream one.',
    }),
    BE({
      id: 'be.loaflow', name: 'Crumb Fuzz Deep Bake', ref: 'BIG EAR pedals LOAF Fuzz – Matt Hoopes Low-End Enhanced Edition', code: 'CRUMB', logo: 'CRUMB', typeName: 'Low-end enhanced fuzz', cat: 'Fuzz',
      color: '#f1ead8', ink: '#22303d', logoColor: '#22303d', logoStroke: '#fbf7ec', art: 'notes', seed: 9, knob: 'chrome', led: '#3a8bff',
      palette: { ink: '#22303d' },
      algo: 'drive', opts: loafV({ preEq: [{ type: 'ls', f: 110, q: 0.7, db: 6 }, { type: 'hs', f: 3000, q: 0.7, db: -3 }], postLp: 5200, toneHi: 4400, outTrim: 0.42 }),
      controls: loafKnobs(),
      desc: 'Anniversary edition voiced for single coils and bright pickups: more low end, less harsh / brittle top, with the artist’s scribbled notes on the facia.',
    }),
    // ---------------------------------------------------------------- distortion / drive
    BE({
      id: 'be.woodcutter', name: 'Hatchet Distortion', ref: 'BIG EAR pedals WOODCUTTER Distortion', code: 'HATCHET', logo: 'HATCHET', typeName: '308 distortion', cat: 'Distortion',
      color: '#1d1d1f', finish: 'wrinkle', ink: '#f0ede4', logoColor: '#f0ede4', logoStroke: '#000000', art: 'axe', seed: 7,
      algo: 'drive', opts: ratV,
      controls: [k('gain', 'DISTORTION', { def: 0.5, style: 'mxr' }), k('tone', 'FILTER', { def: 0.4, style: 'white' }), k('level', 'VOLUME', { def: 0.4, style: 'mxr' })],
      desc: 'Homage to a 308-loaded late-80s Kalamazoo distortion: gritty, moderately compressed, tight low end. FILTER is reverse-acting like the original (clockwise = darker). Low-gain overdrive to fuzzy distortion.',
    }),
    BE({
      id: 'be.frank', name: 'Igor Overdrive', ref: 'BIG EAR pedals FRANK Overdrive', code: 'IGOR', logo: 'IGOR', typeName: 'Low-gain overdrive', cat: 'Overdrive',
      color: '#6f9a4a', ink: '#141a10', logoColor: '#e9f2d8', logoStroke: '#1f2c14', art: 'stitches', seed: 11, knob: 'chrome', jacksTop: false,
      algo: 'drive', opts: { clip: 'led', slew: 0.15, preHp: 60, gainMinDb: 2, gainMaxDb: 30, tone: 'eq3', eqRangeDb: 10, bassF: 120, midF: 800, trebleF: 2600, postLp: 11000, cleanSum: true, cleanMix: 0.25, levelMaxDb: 8 },
      fixed: { mid: 0.5 },
      controls: [k('level', 'VOLUME', { def: 0.5 }), k('gain', 'GAIN', { def: 0.4 }), k('treble', 'TONE', { def: 0.55 }), k('bass', 'BODY', { def: 0.5, trim: true })],
      desc: 'Transparent low / mid-gain drive (Burr-Brown op-amp, LED clipping): clean boost to natural break-up. BODY is the internal trim that sets the low-end voicing for your amp.',
    }),
    // ---------------------------------------------------------------- fuzzes
    BE({
      id: 'be.chaka', name: 'Okta Octave Fuzz', ref: 'BIG EAR n.y.c. CHAKA Octave Fuzz', code: 'OKTA', logo: 'OKTA', typeName: 'Octave fuzz', cat: 'Fuzz', noStd: true,
      color: '#c3221c', finish: 'candy', ink: '#fff2e2', logoColor: '#fff2e2', logoStroke: '#4a0806', art: 'burst', seed: 13, knob: 'chrome', jacksTop: false, cost: 1.2,
      palette: { art: '#ffd23a' },
      algo: 'chain',
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', stages: 3, stage2Db: 8, preHp: 90, gainMinDb: 16, gainMaxDb: 50, tone: 'lp', toneLo: 1100, toneHi: 7500, postLp: 8000, levelMaxDb: 3, outTrim: 0.4 } },
        { prefix: 'o', on: false, algo: 'pitch', params: { semis1: 12, level1: 0.75, dry: 0.85, level2: 0, level3: 0, quality: 0, tone: 0.8 } },
      ] },
      controls: [k('f.gain', 'FUZZ', { def: 0.65 }), k('f.level', 'VOLUME', { def: 0.5 }), k('f.tone', 'TONE', { def: 0.5 }),
        TOG('oct', 'OCTAVE', ['off', 'on'], { virtual: true, hidden: true }),
        FOOT(), LED({ color: '#ff3a24', label: 'FUZZ' }), FOOT({ action: 'toggle', p: 'oct', virtual: true }), LED({ bind: 'onparam:oct', color: '#ffb020', label: 'OCTAVE' })],
      initParams: { oct: 0 },
      fixed: { 'o.semis1': 12, 'o.quality': 0 },
      derive: (p) => ({ 'o.on': p.oct ? 1 : 0 }),
      desc: 'Harmonically rich three-transistor silicon fuzz (chords and chugs) with an octave-up on its own footswitch for single-note leads – think Tone-Machine-style ring.',
    }),
    BE({
      id: 'be.bettywhite', name: 'Dottie White Fuzz', ref: 'BIG EAR pedals BETTY WHITE Fuzz', code: 'DOTTIE', logo: 'DOTTIE', typeName: 'One-knob fuzz', cat: 'Fuzz', size: 'mini',
      color: '#f2f0ea', ink: '#1a1a1a', logoColor: '#ffffff', logoStroke: '#1a1a1a', art: 'dots', seed: 5, knob: 'chrome', palette: { art: '#e8463c' },
      algo: 'drive', opts: bettyV, fixed: { gain: 0.95, mid: 0.5, treble: 0.55 },
      controls: [k('level', 'VOLUME', { def: 0.5 }), k('bass', 'BASS', { def: 0.55, trim: true })],
      desc: 'Burly one-knob fuzz: a single-knob 60s fuzz circuit with the gain always dimed (Fuzz-Face-at-max feel). The knob is the volume; a side trim sets the bass.',
    }),
    BE({
      id: 'be.blackbetty', name: 'Dottie Black Fuzz', ref: 'BIG EAR pedals BLACK BETTY Fuzz', code: 'DOTTIE', logo: 'DOTTIE', typeName: 'One-knob fuzz', cat: 'Fuzz', size: 'mini',
      color: '#1b1b1d', finish: 'sparkle', ink: '#f2f2f2', logoColor: '#1b1b1d', logoStroke: '#f2f2f2', art: 'dots', seed: 8, knob: 'chrome', palette: { art: '#f2f2f2', artInk: '#000' },
      algo: 'drive', opts: bettyV, fixed: { gain: 0.95, mid: 0.5, treble: 0.55 },
      controls: [k('level', 'VOLUME', { def: 0.5 }), k('bass', 'BASS', { def: 0.55, trim: true })],
      desc: 'The black version of the one-knob dimed fuzz – same PCB, transistors and values as the white one.',
    }),
    BE({
      id: 'be.slicepep', name: 'Deep Dish Fuzz Pepperoni', ref: 'BIG EAR pedals x The Tone Mob SLICE OF PIE Fuzz (pepperoni)', code: 'DEEP DISH', logo: 'DEEP DISH', typeName: 'Pizza fuzz · pepperoni', cat: 'Fuzz',
      size: 'pie', topping: 'pepperoni', seed: 12, knob: 'chrome', color: '#f4b73c',
      algo: 'drive', opts: pieV,
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('tone', 'TONE', { def: 0.5 }), k('level', 'VOLUME', { def: 0.5 })],
      desc: 'A pizza-slice shaped bent-steel fuzz with mini knobs: GAIN, TONE (darker ↔ brighter) and VOLUME. Pepperoni topping.',
    }),
    BE({
      id: 'be.slicecheese', name: 'Deep Dish Fuzz Cheese', ref: 'BIG EAR pedals x The Tone Mob SLICE OF PIE Fuzz (cheese)', code: 'DEEP DISH', logo: 'DEEP DISH', typeName: 'Pizza fuzz · extra cheese', cat: 'Fuzz',
      size: 'pie', topping: 'cheese', seed: 27, knob: 'chrome', color: '#f4b73c',
      algo: 'drive', opts: pieV,
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('tone', 'TONE', { def: 0.5 }), k('level', 'VOLUME', { def: 0.5 })],
      desc: 'The plain cheese slice – same fuzz circuit as the pepperoni one, only the toppings differ.',
    }),
    // ---------------------------------------------------------------- boosts / utility
    BE({
      id: 'be.moremoremore', name: 'Plus Plus Plus Booster', ref: 'BIG EAR n.y.c. MORE MORE MORE Triple Boost', code: 'PLUS×3', logo: 'PLUS\nPLUS\nPLUS', logoSize: 24, logoY: 120, typeName: 'Triple boost', cat: 'Boost', noStd: true,
      color: '#2f62b8', finish: 'sparkle', ink: '#f4f6ff', logoColor: '#f4f6ff', logoStroke: '#0d2046', art: 'plus', artY: 168, seed: 15, knob: 'chrome', jacksTop: false, alwaysOn: true, cost: 0.6,
      palette: { art: '#ffd23a' },
      algo: 'chain',
      opts: { chain: [
        { prefix: 'a', algo: 'boost', opts: { gainMaxDb: 15 }, params: { bass: 0.5, treble: 0.5, level: 1 } },
        { prefix: 'b', on: false, algo: 'boost', opts: { gainMaxDb: 15, trebleF: 2500 }, params: { bass: 0.45, treble: 0.6, level: 1 } },
        { prefix: 'c', on: false, algo: 'boost', opts: { gainMaxDb: 15, colored: true }, params: { bass: 0.58, treble: 0.5, level: 1 } },
        { prefix: 'v', algo: 'utility', opts: { kind: 'gain' } },
      ] },
      controls: [k('a.gain', 'MORE', { def: 0.2 }), k('b.gain', 'MORE', { def: 0.3 }), k('c.gain', 'MORE', { def: 0.4 }), K('drop', 'DROP', { def: 0, virtual: true, trim: true, display: (v) => '−' + (v * 12).toFixed(1) + ' dB' }),
        ...['m1', 'm2', 'm3'].map((p) => TOG(p, p, ['off', 'on'], { virtual: true, hidden: true })),
        ...['m1', 'm2', 'm3'].flatMap((p) => [FOOT({ action: 'toggle', p, virtual: true }), LED({ bind: 'param:' + p, color: '#ff2a1a' })])],
      initParams: { m1: 1, m2: 0, m3: 0 },
      derive: (p) => ({ 'a.on': p.m1 ? 1 : 0, 'b.on': p.m2 ? 1 : 0, 'c.on': p.m3 ? 1 : 0, 'v.level': -12 * (p.drop ?? 0) }),
      desc: 'Three clean boosts in one box (inspired by a famous Texas beard’s rig): use any one alone or stack them like a preamp. Each MORE knob sets its stage; DROP trims the output for volume drops.',
    }),
    BE({
      id: 'be.buffdaddy', name: 'Swole Buffer', ref: 'BIG EAR n.y.c. BUFF DADDY Buffer', code: 'SWOLE', logo: 'SWOLE', typeName: 'Transistor buffer', cat: 'Utility', kind: 'Utility', size: 'mini', noStd: true,
      color: '#d8452b', ink: '#1a0a06', logoColor: '#fff4e8', logoStroke: '#5a1206', art: 'dumbbell', seed: 6, alwaysOn: true, noBypassClick: true, cost: 0.05,
      algo: 'utility', opts: { kind: 'gain' }, fixed: { level: 0 },
      controls: [LED({ color: '#ff2a1a' })],
      desc: 'Transistor buffer for long cable runs and true-bypass boards: unity gain, keeps the top end intact. Always on.',
    }),
    BE({
      id: 'be.whaca', name: 'Thwack-9 Booster', ref: 'BIG EAR pedals x 60 Cycle Hum WHAC-A 9-stage boost', code: 'THWACK-9', logo: 'THWACK', logoSize: 40, typeName: 'Nine cascaded boosts', cat: 'Boost', size: 'big', noStd: true,
      color: '#c9a03a', finish: 'sparkle', ink: '#1c1406', logoColor: '#fff6d6', logoStroke: '#4a3208', seed: 19, alwaysOn: true, cost: 0.5,
      algo: 'drive', opts: { clip: 'asym', bias: 0.1, preHp: 40, gainMinDb: 0, gainMaxDb: 27, tone: 'none', postLp: 15000, levelMinDb: -30, levelMaxDb: 6,
        postEq: [{ type: 'hs', f: 3200, q: 0.7, db: 2.5 }] },
      controls: [...nineBoost.map((p) => TOG(p, p, ['off', 'on'], { virtual: true, hidden: true })),
        ...nineBoost.flatMap((p) => [FOOT({ action: 'toggle', p, virtual: true }), LED({ bind: 'param:' + p, color: '#ff2a1a' })])],
      initParams: Object.fromEntries(nineBoost.map((p, i) => [p, i === 0 ? 1 : 0])),
      derive: (p) => {
        const n = nineBoost.reduce((a, s) => a + (p[s] ? 1 : 0), 0);
        // every engaged stage adds a little gain and sparkle; the clipper only starts to bite past ~6 stages
        const gainDb = n * 3, outDb = n * 1.3 - gainDb;
        return { gain: gainDb / 27, level: (outDb + 30) / 36, bright: Math.min(1, n / 9) };
      },
      desc: 'No knobs, nine footswitches: every switch engages one more cascaded boost. 1–3 add sparkle, four is a clear boost, all nine is a moderate low-gain overdrive. Stomp at random (a mallet is recommended).',
    }),
    // ---------------------------------------------------------------- time / modulation
    BE({
      id: 'be.zdelay', name: 'Q-Echo Delay', ref: 'BIG EAR n.y.c. Z-DELAY', code: 'Q-ECHO', logo: 'Q-ECHO', typeName: 'Analog-voiced delay', cat: 'Delay',
      color: '#2b2b30', finish: 'sparkle', ink: '#e8f3ff', logoColor: '#e8f3ff', logoStroke: '#0a1424', art: 'echoes', seed: 23, knob: 'chrome', jacksTop: false, cost: 0.8, led: '#ff2a1a',
      palette: { art: '#7ad0ff' },
      algo: 'delay', opts: { maxMs: 600, defaultMs: 300 }, fixed: { mode: 1, tone: 0.42, modrate: 0.3, moddepth: 0.14, age: 0.35 },
      controls: [K('time', 'TIME', { min: 50, max: 550, def: 300, curve: 'log', display: (v) => Math.round(v) + ' ms' }), k('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), k('mix', 'MIX', { def: 0.35 })],
      desc: 'Simple 50–550 ms delay with an analog signal path and repeats voiced like a BBD: tape-like decay and a slight modulation.',
    }),
    BE({
      id: 'be.elle', name: 'Nell Reverb', ref: 'BIG EAR pedals ELLE Reverb', code: 'NELL', logo: 'NELL', typeName: 'Modulated reverb', cat: 'Reverb',
      color: '#e2a3a0', ink: '#2a1418', logoColor: '#fff6f2', logoStroke: '#7a3b40', art: 'ribbons', seed: 29, knob: 'cream', cost: 1.2, stereo: 'both',
      palette: { arts: ['#fff3ea', '#8a3b44', '#a8cfd6'] },
      algo: 'reverb', fixed: { mode: 6, mod: 0.28, size: 0.7, predelay: 18, lowcut: 0.15 },
      controls: [k('tone', 'COLOR', { def: 0.55 }), K('decay', 'DWELL', { def: 0.5, display: ten }), K('mix', 'BLEND', { def: 0.32, max: 0.65, display: ten })],
      derive: (p) => ({ decay: (p.decay ?? 0.5) > 0.97 ? 1 : (p.decay ?? 0.5) * 0.97, highdamp: 0.75 - 0.5 * (p.tone ?? 0.55) }),
      desc: 'Ever-so-slightly modulated reverb: COLOR goes from dark to sweet, DWELL from spring-like slap to a huge shimmering hall (fully up rings out forever), BLEND never removes the dry signal.',
    }),
    BE({
      id: 'be.albie', name: 'Ollie Ambient Modulator', ref: 'BIG EAR pedals ALBIE Ambient Modulator', code: 'OLLIE', logo: 'OLLIE', typeName: 'Ambient modulator', cat: 'Modulation', noStd: true, ledRow: true,
      color: '#1f9c98', finish: 'candy', ink: '#05211f', logoColor: '#eafffb', logoStroke: '#063532', art: 'rainbow', artY: 160, logoY: 124, typeY: 188, seed: 31, knob: 'chrome', cost: 3.2,
      algo: 'chain',
      opts: { mix: true, chain: [
        { prefix: 'cp', algo: 'comp', opts: { type: 'opto' }, params: { sustain: 0.3, level: 0.42, blend: 0.7 } },
        { prefix: 'ph', on: false, algo: 'phaser', params: { stages: 4 } },
        { prefix: 'fl', on: false, algo: 'flanger' },
        { prefix: 'ch', algo: 'chorus' },
        { prefix: 'tr', on: false, algo: 'tremolo', params: { wave: 0.4, level: 0.5 } },
        { prefix: 'dl', on: false, algo: 'delay', opts: { maxMs: 800 }, params: { tone: 0.5, level: 0.5 } },
        { prefix: 'rv', algo: 'reverb', params: { level: 0.5 } },
      ] },
      controls: [
        SEL('fx', 'EFFECT', ALBIE_NAMES.map((_, i) => String(i + 1)), { virtual: true, printLabels: false, sweep: 270, def: 2 }),
        K('mix', 'BLEND', { def: 0.6, display: ten }),
        ...ALBIE.map((_, i) => LED({ bind: 'fn', color: '#4ad8ff', ledFn: (ui, b) => (!b.bypass && Math.round(ui.fx ?? 2) === i ? ((ui._neil ?? 0) > 0.5 ? '#ff4fd8' : '#4ad8ff') : null) })),
        FOOT(),
      ],
      initParams: { _neil: 0, _ultra: 0 },
      derive: (p) => {
        const s = ALBIE[Math.max(0, Math.min(7, Math.round(p.fx ?? 2)))][(p._neil ?? 0) > 0.5 ? 1 : 0];
        const out = { 'cp.on': 1 };
        for (const sub of ['ph', 'fl', 'ch', 'tr', 'dl', 'rv']) {
          out[sub + '.on'] = s[sub] ? 1 : 0;
          if (s[sub]) for (const [kk, v] of Object.entries(s[sub])) out[sub + '.' + kk] = v;
        }
        return out;
      },
      desc: 'Eight effect stacks for jangly, shimmering New-Wave / post-punk tones (EFFECT; the LEDs show the stack): ' + ALBIE_NAMES.map((n, i) => `${i + 1} ${n}`).join(', ') + '. BLEND mixes the stack into your clean tone. Tap the footswitch for on / off; HOLD it for the more intense alternate version of each stack (LEDs turn pink); hold for 2 s to latch the alternates.',
    }),
  ]);
}
