// Built-in Tone Zone plugin: JHS.
// Blocks inspired by JHS Pedals gear. Names, logos and artwork are Tone Zone originals; control layouts,
// enclosure shapes and colours follow the real units (see each block's `ref`).
//
// One custom form ("jhs") paints the whole family: gloss-painted boxes (`box`: std, wide, three; `bw` / `bh`
// override the size) with hand-inked artwork. Per-block art: `art` = { kind, ink, fill, fill2, accent };
// hand-lettered logo: `logo`, `logoFont`, `logoSize`, `logoColor`, `logoStroke`, `banner` (ribbon colour);
// knob look: `kstyle` = jhs | cream | gold | chicken.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, def, ten, db, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern, shade } = tz.gfx;

  function ensureDefs() {
    if (document.getElementById('jhs-gloss')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const grad = (id, stops, o = {}) => {
      const gr = svg(o.radial ? 'radialGradient' : 'linearGradient', Object.assign({ id }, o.radial ? { cx: o.cx ?? 0.38, cy: o.cy ?? 0.3, r: o.r ?? 0.75 } : { x1: o.x1 ?? 0, y1: o.y1 ?? 0, x2: o.x2 ?? 0, y2: o.y2 ?? 1 }), d);
      for (const [off, col, op] of stops) svg('stop', { offset: off, 'stop-color': col, 'stop-opacity': op ?? 1 }, gr);
    };
    grad('jhs-gloss', [[0, '#fff', 0.26], [0.08, '#fff', 0.08], [0.45, '#fff', 0], [0.9, '#000', 0.08], [1, '#000', 0.3]]);
    grad('jhs-edge', [[0, '#000', 0.22], [0.04, '#000', 0], [0.96, '#000', 0], [1, '#000', 0.28]], { x2: 1, y2: 0 });
    grad('jhs-streak', [[0, '#fff', 0], [0.5, '#fff', 0.16], [1, '#fff', 0]], { x2: 1, y2: 1 });
    grad('jhs-knob', [[0, '#55565a'], [0.5, '#1b1b1d'], [1, '#050506']], { radial: true });
    grad('jhs-cream', [[0, '#fffaf0'], [0.6, '#e8dcc0'], [1, '#b9a985']], { radial: true });
    grad('jhs-gold', [[0, '#fff1c2'], [0.5, '#d4a83e'], [1, '#7a5a16']], { radial: true });
    grad('jhs-tea', [[0, '#e0902c', 0.95], [1, '#8a4a12', 0.95]]);
    noisePattern(d, 'jhs-paint', 36, 64, [0, 0, 0], 0, 0.1, 1);
  }

  // ------------------------------------------------------------------ hand-drawn helpers
  const f1 = (v) => (+v).toFixed(1);
  let rs = 1;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const poly = (pts, close) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join(' L') + (close ? ' Z' : '');
  function smooth(pts, close) {
    const n = pts.length;
    const P = (i) => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < (close ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d + (close ? ' Z' : '');
  }
  const wob = (pts, amt = 0.8) => pts.map(([x, y]) => [x + rnd() * amt, y + rnd() * amt]);
  const circ = (cx, cy, r, n = 14, amt = 0.6) => smooth(wob([...Array(n)].map((_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]), amt), true);
  // ink line: a confident stroke plus a faint offset "second pass" like a felt-tip sketch
  function ink(g, d, a, o = {}) {
    const p = svg('path', { d, fill: o.fill || 'none', stroke: o.stroke || a.ink, 'stroke-width': o.w ?? 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o.op }, g);
    if (o.fill && o.fill !== 'none') svg('path', { d, fill: 'url(#jhs-streak)', opacity: 0.6 }, g);
    if (!o.single) svg('path', { d, fill: 'none', stroke: o.stroke || a.ink, 'stroke-width': 0.6, opacity: 0.4, transform: 'translate(0.9,0.7)' }, g);
    return p;
  }
  function star(cx, cy, R, r, n = 5) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const t = -Math.PI / 2 + (i * Math.PI) / n; pts.push([cx + Math.cos(t) * (i % 2 ? r : R), cy + Math.sin(t) * (i % 2 ? r : R)]); }
    return poly(pts, true);
  }
  const heart = (cx, cy, s, rot = 0) => `M${cx} ${cy + s} C${cx - s * 1.4} ${cy + s * 0.1} ${cx - s * 0.9} ${cy - s * 1.1} ${cx} ${cy - s * 0.35} C${cx + s * 0.9} ${cy - s * 1.1} ${cx + s * 1.4} ${cy + s * 0.1} ${cx} ${cy + s} Z`;
  const rotG = (g, deg, cx, cy) => svg('g', { transform: `rotate(${deg} ${f1(cx)} ${f1(cy)})` }, g);

  // ------------------------------------------------------------------ the art (one per pedal family)
  const ART = {
    flower(g, b, a) {
      const cx = b.cx + 6, cy = b.y + b.h * 0.36, R = Math.min(22, b.h * 0.24);
      ink(g, smooth(wob([[b.x + 4, b.y + b.h * 0.7], [b.x + 22, b.y + b.h * 0.55], [cx - 18, cy + 18], [cx - 8, cy + 8]], 0.4)), a, { w: 2, stroke: a.fill2 });
      for (const [lx, ly, rot] of [[b.x + 20, b.y + b.h * 0.6, -40], [cx - 22, cy + 22, 30]]) ink(rotG(g, rot, lx, ly), heart(lx, ly, 6), a, { fill: a.fill2, w: 1.1 });
      const pts = [];
      for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([cx + Math.cos(t) * (i % 2 ? R * 0.78 : R), cy + Math.sin(t) * (i % 2 ? R * 0.78 : R)]); }
      ink(g, smooth(wob(pts, 0.7), true), a, { fill: a.fill, w: 1.6 });
      for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5; ink(g, `M${f1(cx)} ${f1(cy)} L${f1(cx + Math.cos(t) * R * 0.85)} ${f1(cy + Math.sin(t) * R * 0.85)}`, a, { w: 0.8, single: true, stroke: '#fff', op: 0.7 }); }
      ink(g, circ(cx, cy, R * 0.28, 10, 0.3), a, { fill: a.accent, w: 1.2 });
      ink(g, smooth(wob([[cx + R * 0.7, cy - R * 0.9], [cx + R * 1.2, cy - R * 1.3], [cx + R * 1.5, cy - R * 0.9], [cx + R * 1.25, cy - R * 0.6]], 0.3)), a, { w: 1.1, stroke: a.fill2 });
      return { logoY: b.y + b.h * 0.8 };
    },
    bonsai(g, b, a) {
      const cx = b.cx, base = b.y + b.h * 0.64;
      ink(g, poly(wob([[cx - 22, base], [cx + 22, base], [cx + 16, base + 12], [cx - 16, base + 12]], 0.5), true), a, { fill: a.accent, w: 1.4 });
      ink(g, `M${cx - 24} ${base} H${cx + 24}`, a, { w: 2 });
      ink(g, smooth(wob([[cx - 3, base], [cx - 6, base - 10], [cx + 4, base - 20], [cx - 2, base - 30], [cx + 6, base - 40]], 0.4)), a, { w: 4.2, stroke: a.fill2 });
      ink(g, smooth([[cx + 1, base - 22], [cx - 12, base - 26], [cx - 20, base - 24]]), a, { w: 2.4, stroke: a.fill2 });
      ink(g, smooth([[cx + 2, base - 32], [cx + 14, base - 34], [cx + 20, base - 30]]), a, { w: 2.2, stroke: a.fill2 });
      for (const [px, py, rx, ry] of [[cx - 22, base - 28, 13, 6.5], [cx + 22, base - 34, 12, 6], [cx + 5, base - 46, 15, 7.5]]) {
        const pts = [];
        for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; pts.push([px + Math.cos(t) * rx * (1 + 0.12 * Math.sin(i * 2.3)), py + Math.sin(t) * ry * (1 + 0.15 * Math.cos(i * 1.7))]); }
        ink(g, smooth(pts, true), a, { fill: a.fill, w: 1.2 });
      }
      return { logoY: base + 21 };
    },
    charlie(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.36, R = Math.min(20, b.h * 0.22);
      for (let i = 0; i < 7; i++) { const t = Math.PI * 1.08 + (i / 6) * Math.PI * 0.84; ink(g, poly([[cx + Math.cos(t - 0.12) * R * 0.9, cy + Math.sin(t - 0.12) * R * 0.9], [cx + Math.cos(t) * R * 1.45, cy + Math.sin(t) * R * 1.45], [cx + Math.cos(t + 0.12) * R * 0.9, cy + Math.sin(t + 0.12) * R * 0.9]]), a, { fill: a.ink, w: 1 }); }
      ink(g, circ(cx, cy, R, 16, 0.5), a, { fill: a.fill, w: 1.8 });
      ink(g, `M${cx - R * 0.7} ${cy - R * 0.38} L${cx - R * 0.12} ${cy - R * 0.12} M${cx + R * 0.7} ${cy - R * 0.38} L${cx + R * 0.12} ${cy - R * 0.12}`, a, { w: 2.6 });
      svg('circle', { cx: cx - R * 0.36, cy: cy + R * 0.06, r: R * 0.11, fill: a.ink }, g);
      svg('circle', { cx: cx + R * 0.36, cy: cy + R * 0.06, r: R * 0.11, fill: a.ink }, g);
      ink(g, `M${cx - R * 0.5} ${cy + R * 0.36} H${cx + R * 0.5} V${cy + R * 0.62} H${cx - R * 0.5} Z`, a, { fill: '#fff', w: 1.2 });
      for (let i = 1; i < 5; i++) ink(g, `M${cx - R * 0.5 + i * R * 0.2} ${cy + R * 0.36} V${cy + R * 0.62}`, a, { w: 0.7, single: true });
      ink(g, `M${cx - R * 0.5} ${cy + R * 0.49} H${cx + R * 0.5}`, a, { w: 0.7, single: true });
      for (const s of [-1, 1]) ink(g, `M${cx + s * R * 1.3} ${cy - R * 0.2} l${s * 5} -3 M${cx + s * R * 1.32} ${cy + R * 0.1} l${s * 6} 0 M${cx + s * R * 1.3} ${cy + R * 0.4} l${s * 5} 3`, a, { w: 1.2, single: true, stroke: a.accent });
      return { logoY: b.y + b.h * 0.8 };
    },
    bolt(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.36, R = Math.min(22, b.h * 0.25);
      ink(g, circ(cx, cy, R, 18, 0.4), a, { fill: a.fill, w: 1.8 });
      ink(g, circ(cx, cy, R - 4, 18, 0.4), a, { w: 0.8, single: true });
      ink(g, poly(wob([[cx + 4, cy - R * 0.95], [cx - 10, cy + 2], [cx - 1, cy + 2], [cx - 6, cy + R * 0.95], [cx + 10, cy - 4], [cx + 1, cy - 4]], 0.4), true), a, { fill: a.accent, w: 1.4 });
      return { logoY: b.y + b.h * 0.8 };
    },
    tartan(g, b, a) {
      const y0 = b.y + 2, h = b.h * 0.56;
      const cols = [[a.fill, 10, 0.55], [a.fill2, 4, 0.7], [a.accent, 1.4, 0.9], [a.fill, 10, 0.55], [a.ink, 2, 0.5]];
      let x = b.x - 4;
      while (x < b.x + b.w + 4) for (const [c, wd, op] of cols) { svg('rect', { x: f1(x), y: y0, width: wd, height: h, fill: c, opacity: op * 0.7 }, g); x += wd + 3; }
      let y = y0;
      while (y < y0 + h) for (const [c, hd, op] of cols) { if (y < y0 + h) svg('rect', { x: b.x, y: f1(y), width: b.w, height: Math.min(hd, y0 + h - y), fill: c, opacity: op * 0.55 }, g); y += hd + 3; }
      ink(g, poly(wob([[b.x + 2, y0], [b.x + b.w - 2, y0], [b.x + b.w - 2, y0 + h], [b.x + 2, y0 + h]], 0.5), true), a, { w: 1.4 });
      return { logoY: y0 + h + 15, banner: true };
    },
    rat(g, b, a) {
      const cx = b.cx - 4, cy = b.y + b.h * 0.4;
      ink(g, smooth(wob([[cx + 22, cy + 6], [cx + 34, cy + 4], [cx + 40, cy - 6], [cx + 36, cy - 16], [cx + 44, cy - 20]], 0.4)), a, { w: 1.6 });
      ink(g, smooth([[cx - 26, cy + 2], [cx - 12, cy - 13], [cx + 8, cy - 14], [cx + 24, cy - 4], [cx + 22, cy + 8], [cx - 4, cy + 10], [cx - 20, cy + 7]], true), a, { fill: a.fill, w: 1.7 });
      ink(g, circ(cx - 14, cy - 12, 5, 10, 0.3), a, { fill: a.accent, w: 1.2 });
      svg('circle', { cx: cx - 19, cy: cy - 2, r: 1.5, fill: a.ink }, g);
      svg('circle', { cx: cx - 27, cy: cy + 2, r: 1.6, fill: a.accent }, g);
      for (const s of [-1, 1]) ink(g, `M${cx - 26} ${cy + 2} l-8 ${s * 3}`, a, { w: 0.7, single: true });
      for (const lx of [cx - 10, cx + 4, cx + 14]) ink(g, `M${lx} ${cy + 9} l-2 6 h3`, a, { w: 1.3, single: true });
      return { logoY: b.y + b.h * 0.78 };
    },
    sandwich(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.36, w = Math.min(b.w * 0.36, 40);
      ink(g, `M${cx - w} ${cy + 12} Q${cx} ${cy + 22} ${cx + w} ${cy + 12} Z`, a, { fill: a.fill, w: 1.4 });
      ink(g, `M${cx - w - 2} ${cy + 6} H${cx + w + 2} V${cy + 11} H${cx - w - 2} Z`, a, { fill: a.accent, w: 1.2 });
      const lt = [];
      for (let i = 0; i <= 12; i++) lt.push([cx - w - 3 + i * ((2 * w + 6) / 12), cy + 3 + (i % 2 ? -3 : 1)]);
      ink(g, smooth(lt), a, { w: 2.6, stroke: a.fill2 });
      for (let i = 0; i < 6; i++) ink(g, circ(cx - w * 0.75 + i * w * 0.3, cy - 2, 3, 8, 0.2), a, { fill: '#2d3a1d', w: 0.8 });
      ink(g, `M${cx - w} ${cy - 3} Q${cx} ${cy - 30} ${cx + w} ${cy - 3} Z`, a, { fill: a.fill, w: 1.6 });
      for (let i = 0; i < 9; i++) svg('ellipse', { cx: f1(cx - w * 0.6 + (i % 5) * w * 0.3 + (i > 4 ? w * 0.15 : 0)), cy: f1(cy - 10 - (i > 4 ? 6 : 0)), rx: 1.4, ry: 0.8, fill: '#fff6dc', opacity: 0.9 }, g);
      return { logoY: b.y + b.h * 0.8 };
    },
    citrus(g, b, a) {
      const cx = b.cx - 12, cy = b.y + b.h * 0.34, R = Math.min(20, b.h * 0.27);
      ink(g, circ(cx, cy, R, 18, 0.4), a, { fill: a.fill, w: 1.8 });
      ink(g, circ(cx, cy, R * 0.82, 16, 0.3), a, { fill: a.fill2, w: 0.8, single: true });
      for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; ink(g, `M${f1(cx)} ${f1(cy)} L${f1(cx + Math.cos(t) * R * 0.8)} ${f1(cy + Math.sin(t) * R * 0.8)}`, a, { w: 1.2, single: true, stroke: a.fill }); }
      svg('circle', { cx, cy, r: 2.2, fill: a.fill }, g);
      ink(g, smooth(wob([[cx + R + 2, cy - 4], [cx + R + 12, cy - 12], [cx + R + 22, cy - 6], [cx + R + 18, cy + 4], [cx + R + 28, cy + 6]], 0.4)), a, { w: 4, stroke: a.fill });
      return { logoY: b.y + b.h * 0.8 };
    },
    spring(g, b, a) {
      const cy = b.y + b.h * 0.34, x0 = b.x + 14, x1 = b.x + b.w - 14, n = 11, step = (x1 - x0) / n;
      ink(g, `M${x0 - 8} ${cy} H${x0}`, a, { w: 1.8 });
      ink(g, `M${x1} ${cy} H${x1 + 8}`, a, { w: 1.8 });
      for (let i = 0; i < n; i++) svg('ellipse', { cx: f1(x0 + step * (i + 0.5)), cy, rx: f1(step * 0.62), ry: 12, fill: 'none', stroke: i % 2 ? a.fill : a.ink, 'stroke-width': 1.5 }, g);
      ink(g, poly(wob([[b.x + 6, cy - 20], [b.x + b.w - 6, cy - 20], [b.x + b.w - 6, cy + 20], [b.x + 6, cy + 20]], 0.6), true), a, { w: 1.2 });
      return { logoY: cy + 38 };
    },
    cat(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.4, R = Math.min(19, b.h * 0.2);
      ink(g, `M${cx - R * 1.4} ${cy - R * 0.2} L${cx - R * 1.6} ${cy - R * 1.6} Q${cx - R * 1.9} ${cy - R * 2} ${cx - R * 1.5} ${cy - R * 2.1} Q${cx - R * 1.1} ${cy - R * 2} ${cx - R * 1.1} ${cy - R * 1.6} L${cx - R * 0.9} ${cy - R * 0.3} Z`, a, { fill: a.fill, w: 1.4 });
      ink(g, poly([[cx - R * 0.95, cy - R * 0.6], [cx - R * 0.75, cy - R * 1.35], [cx - R * 0.2, cy - R * 0.9]], true), a, { fill: a.fill, w: 1.4 });
      ink(g, poly([[cx + R * 0.95, cy - R * 0.6], [cx + R * 0.75, cy - R * 1.35], [cx + R * 0.2, cy - R * 0.9]], true), a, { fill: a.fill, w: 1.4 });
      ink(g, circ(cx, cy, R, 16, 0.4), a, { fill: a.fill, w: 1.8 });
      ink(g, `M${cx - R * 0.55} ${cy - R * 0.1} q${R * 0.2} -${R * 0.22} ${R * 0.4} 0 M${cx + R * 0.15} ${cy - R * 0.1} q${R * 0.2} -${R * 0.22} ${R * 0.4} 0`, a, { w: 1.4, single: true });
      ink(g, `M${cx - R * 0.12} ${cy + R * 0.22} l${R * 0.12} ${R * 0.1} l${R * 0.12} -${R * 0.1}`, a, { w: 1.2, single: true, stroke: a.accent });
      for (const s of [-1, 1]) ink(g, `M${cx + s * R * 0.4} ${cy + R * 0.3} l${s * R * 0.7} -${R * 0.1} M${cx + s * R * 0.4} ${cy + R * 0.42} l${s * R * 0.7} ${R * 0.08}`, a, { w: 0.6, single: true });
      ink(g, `M${cx - R * 0.8} ${cy + R * 0.72} Q${cx} ${cy + R * 1.05} ${cx + R * 0.8} ${cy + R * 0.72}`, a, { w: 2.4, stroke: a.accent });
      ink(g, circ(cx, cy + R * 0.98, R * 0.17, 8, 0.1), a, { fill: '#f2c94c', w: 0.9 });
      for (const [sx, sy] of [[cx + R * 1.6, cy - R * 1.2], [cx + R * 2.0, cy - R * 0.3], [cx - R * 2.1, cy + R * 0.4]]) ink(g, star(sx, sy, 3.6, 1.4), a, { fill: a.accent, w: 0.7, single: true });
      return { logoY: b.y + b.h * 0.84 };
    },
    panther(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.38, R = Math.min(20, b.h * 0.22);
      for (const s of [-1, 1]) ink(g, poly([[cx + s * R * 0.45, cy - R * 0.85], [cx + s * R * 0.95, cy - R * 1.25], [cx + s * R * 0.95, cy - R * 0.45]], true), a, { fill: a.fill, w: 1.4 });
      ink(g, smooth(wob([[cx, cy - R], [cx + R * 0.95, cy - R * 0.55], [cx + R, cy + R * 0.2], [cx + R * 0.45, cy + R * 0.9], [cx, cy + R], [cx - R * 0.45, cy + R * 0.9], [cx - R, cy + R * 0.2], [cx - R * 0.95, cy - R * 0.55]], 0.4), true), a, { fill: a.fill, w: 1.6 });
      for (const s of [-1, 1]) {
        ink(g, `M${cx + s * R * 0.62} ${cy - R * 0.12} Q${cx + s * R * 0.38} ${cy - R * 0.38} ${cx + s * R * 0.12} ${cy - R * 0.12} Q${cx + s * R * 0.38} ${cy + R * 0.05} ${cx + s * R * 0.62} ${cy - R * 0.12} Z`, a, { fill: a.accent, w: 0.9, single: true });
        svg('ellipse', { cx: f1(cx + s * R * 0.37), cy: f1(cy - R * 0.14), rx: 0.9, ry: 2.6, fill: '#111' }, g);
      }
      ink(g, poly([[cx - R * 0.17, cy + R * 0.3], [cx + R * 0.17, cy + R * 0.3], [cx, cy + R * 0.48]], true), a, { fill: a.fill2, w: 0.9, single: true });
      ink(g, `M${cx} ${cy + R * 0.48} v${R * 0.14} M${cx} ${cy + R * 0.62} q-${R * 0.2} ${R * 0.12} -${R * 0.32} 0 M${cx} ${cy + R * 0.62} q${R * 0.2} ${R * 0.12} ${R * 0.32} 0`, a, { w: 0.9, single: true, stroke: a.fill2 });
      return { logoY: b.y + b.h * 0.82 };
    },
    ghost(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.36, R = Math.min(18, b.h * 0.2);
      const pts = [[cx - R, cy + R * 1.1], [cx - R, cy - R * 0.1]];
      const top = `M${cx - R} ${cy + R * 1.1} V${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy} V${cy + R * 1.1} Q${cx + R * 0.83} ${cy + R * 0.8} ${cx + R * 0.66} ${cy + R * 1.1} Q${cx + R * 0.5} ${cy + R * 1.4} ${cx + R * 0.33} ${cy + R * 1.1} Q${cx + R * 0.16} ${cy + R * 0.8} ${cx} ${cy + R * 1.1} Q${cx - R * 0.16} ${cy + R * 1.4} ${cx - R * 0.33} ${cy + R * 1.1} Q${cx - R * 0.5} ${cy + R * 0.8} ${cx - R * 0.66} ${cy + R * 1.1} Q${cx - R * 0.83} ${cy + R * 1.4} ${cx - R} ${cy + R * 1.1} Z`;
      void pts;
      ink(g, top, a, { fill: a.fill, w: 1.7 });
      svg('ellipse', { cx: cx - R * 0.35, cy: cy - R * 0.05, rx: R * 0.16, ry: R * 0.26, fill: a.ink }, g);
      svg('ellipse', { cx: cx + R * 0.35, cy: cy - R * 0.05, rx: R * 0.16, ry: R * 0.26, fill: a.ink }, g);
      svg('ellipse', { cx, cy: cy + R * 0.45, rx: R * 0.16, ry: R * 0.22, fill: a.ink }, g);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) ink(g, `M${cx + s * (R + 5 + i * 4)} ${cy - R * 0.6 + i * 2} q${s * 3} ${R * 0.5} 0 ${R}`, a, { w: 1, single: true, stroke: a.accent, op: 1 - i * 0.25 });
      return { logoY: b.y + b.h * 0.84 };
    },
    clover(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.34, s = Math.min(9, b.h * 0.1);
      ink(g, smooth([[cx, cy], [cx + 3, cy + s * 2], [cx + 10, cy + s * 3.4]]), a, { w: 2.2, stroke: a.fill2 });
      for (let i = 0; i < 4; i++) ink(rotG(g, i * 90 + 45, cx, cy), heart(cx, cy - s * 1.15, s, 0), a, { fill: a.fill, w: 1.3 });
      for (let i = 0; i < 4; i++) { const t = (i * Math.PI) / 2 + Math.PI / 4; ink(g, `M${f1(cx)} ${f1(cy)} L${f1(cx + Math.cos(t - Math.PI / 2) * s * 1.4)} ${f1(cy + Math.sin(t - Math.PI / 2) * s * 1.4)}`, a, { w: 0.7, single: true, stroke: a.fill2 }); }
      return { logoY: b.y + b.h * 0.8 };
    },
    starburst(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.36, R = Math.min(22, b.h * 0.24);
      for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; ink(g, `M${f1(cx + Math.cos(t) * R * 1.05)} ${f1(cy + Math.sin(t) * R * 1.05)} L${f1(cx + Math.cos(t) * R * (i % 2 ? 1.3 : 1.55))} ${f1(cy + Math.sin(t) * R * (i % 2 ? 1.3 : 1.55))}`, a, { w: 1.2, single: true, stroke: a.fill2 }); }
      ink(g, star(cx, cy, R, R * 0.45), a, { fill: a.fill, w: 1.6 });
      ink(g, star(cx, cy, R * 0.45, R * 0.2), a, { fill: a.accent, w: 0.8, single: true });
      return { logoY: b.y + b.h * 0.82 };
    },
    barrels(g, b, a) {
      const cy = b.y + b.h * 0.36, R = Math.min(15, b.h * 0.17);
      for (const s of [-1, 1]) {
        const cx = b.cx + s * (R + 4);
        ink(g, circ(cx, cy, R, 16, 0.4), a, { fill: a.fill, w: 1.8 });
        ink(g, circ(cx, cy, R * 0.66, 14, 0.3), a, { fill: a.fill2, w: 1.1, single: true });
        ink(g, circ(cx, cy, R * 0.3, 10, 0.2), a, { fill: a.ink, w: 0.8, single: true });
      }
      ink(g, `M${b.cx - R * 2.4} ${cy + R + 6} H${b.cx + R * 2.4}`, a, { w: 1.6 });
      return { logoY: b.y + b.h * 0.8 };
    },
    tea(g, b, a) {
      const cx = b.cx, top = b.y + 6, h = Math.min(46, b.h * 0.56), w = 30;
      ink(g, `M${cx + 4} ${top + 2} L${cx + 14} ${top - 10}`, a, { w: 3, stroke: a.accent });
      ink(g, `M${cx - w / 2} ${top + 6} Q${cx - w / 2 - 2} ${top + h} ${cx - w / 2 + 4} ${top + h} H${cx + w / 2 - 4} Q${cx + w / 2 + 2} ${top + h} ${cx + w / 2} ${top + 6} Z`, a, { fill: 'url(#jhs-tea)', w: 1.6 });
      for (const [x, y, r] of [[-6, 14, 0], [5, 20, 18], [-3, 28, -12]]) ink(rotG(g, r, cx + x, top + y), `M${cx + x - 4} ${top + y - 4} h8 v8 h-8 Z`, a, { fill: '#e8f6fb', w: 0.8, single: true, op: 0.85 });
      ink(g, `M${cx - w / 2 - 2} ${top + 4} H${cx + w / 2 + 2} V${top + 8} H${cx - w / 2 - 2} Z`, a, { fill: a.fill2, w: 1 });
      ink(g, circ(cx + w / 2 + 2, top + 8, 7, 12, 0.2), a, { fill: '#f6e05e', w: 1.1 });
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; ink(g, `M${cx + w / 2 + 2} ${top + 8} l${f1(Math.cos(t) * 5.5)} ${f1(Math.sin(t) * 5.5)}`, a, { w: 0.6, single: true }); }
      return { logoY: top + h + 18 };
    },
    unicorn(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.42;
      const cols = ['#e84a5f', '#f6a33b', '#f6e05e', '#5ec27a', '#4a9fe8', '#8a5ad6'];
      cols.forEach((c, i) => svg('path', { d: `M${cx - 40 + i * 3} ${cy + 10} A${40 - i * 3} ${30 - i * 3} 0 0 1 ${cx + 40 - i * 3} ${cy + 10}`, fill: 'none', stroke: c, 'stroke-width': 3, opacity: 0.85 }, g));
      ink(rotG(g, 18, cx, cy), `M${cx - 6} ${cy + 8} L${cx} ${cy - 34} L${cx + 6} ${cy + 8} Z`, a, { fill: a.fill, w: 1.5 });
      for (let i = 0; i < 6; i++) ink(rotG(g, 18, cx, cy), `M${cx - 5 + i * 0.7} ${cy + 4 - i * 6} L${cx + 5 - i * 0.8} ${cy - i * 6}`, a, { w: 0.9, single: true, stroke: a.accent });
      return { logoY: cy + 26 };
    },
    crown(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.42, w = Math.min(28, b.h * 0.36), h = w * 0.8;
      ink(g, poly(wob([[cx - w, cy + h / 2], [cx - w - 4, cy - h / 2], [cx - w / 2, cy], [cx, cy - h * 0.85], [cx + w / 2, cy], [cx + w + 4, cy - h / 2], [cx + w, cy + h / 2]], 0.4), true), a, { fill: a.fill, w: 1.7 });
      ink(g, `M${cx - w} ${cy + h / 2 + 1} H${cx + w} V${cy + h / 2 + 7} H${cx - w} Z`, a, { fill: a.fill2, w: 1.4 });
      for (const [x, y, c] of [[cx - w - 4, cy - h / 2, a.accent], [cx, cy - h * 0.85, a.accent], [cx + w + 4, cy - h / 2, a.accent]]) ink(g, circ(x, y - 3, 3, 8, 0.1), a, { fill: c, w: 0.9 });
      for (const x of [-w * 0.6, 0, w * 0.6]) ink(g, circ(cx + x, cy + h / 2 + 4, 2.2, 8, 0.1), a, { fill: x ? '#2e8b57' : a.accent, w: 0.7, single: true });
      return { logoY: b.y + b.h * 0.82 };
    },
    tide(g, b, a) {
      const cy = b.y + b.h * 0.42;
      ink(g, `M${b.cx + 14} ${cy - 34} A14 14 0 1 0 ${b.cx + 26} ${cy - 12} A11 11 0 1 1 ${b.cx + 14} ${cy - 34} Z`, a, { fill: a.accent, w: 1.2 });
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let x = b.x + 2; x <= b.x + b.w - 2; x += 4) pts.push([x, cy + k * 8 + Math.sin((x - b.x) / 9 + k) * 3]);
        ink(g, smooth(pts), a, { w: 2, stroke: k === 1 ? a.fill2 : a.fill });
      }
      return { logoY: cy + 36 };
    },
    smiley(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.38, R = Math.min(22, b.h * 0.25);
      ink(g, circ(cx, cy, R, 18, 0.5), a, { fill: a.fill, w: 2 });
      svg('ellipse', { cx: cx - R * 0.33, cy: cy - R * 0.22, rx: R * 0.1, ry: R * 0.2, fill: a.ink }, g);
      svg('ellipse', { cx: cx + R * 0.33, cy: cy - R * 0.22, rx: R * 0.1, ry: R * 0.2, fill: a.ink }, g);
      ink(g, `M${cx - R * 0.58} ${cy + R * 0.18} Q${cx} ${cy + R * 0.85} ${cx + R * 0.58} ${cy + R * 0.18}`, a, { w: 2.2 });
      return { logoY: b.y + b.h * 0.82 };
    },
    bars(g, b, a) {
      const cols = ['#d9d9d6', '#e8d24a', '#4ac6d1', '#4cb050', '#c94bc2', '#d9393a', '#2b4bb8'];
      const x0 = b.x + 10, w = b.w - 20, y0 = b.y + 4, h = b.h * 0.42, bw = w / cols.length;
      cols.forEach((c, i) => svg('rect', { x: f1(x0 + i * bw), y: y0, width: f1(bw + 0.3), height: h, fill: c }, g));
      ['#2b4bb8', '#141414', '#c94bc2', '#141414', '#4ac6d1', '#141414', '#d9d9d6'].forEach((c, i) => svg('rect', { x: f1(x0 + i * bw), y: y0 + h, width: f1(bw + 0.3), height: h * 0.2, fill: c }, g));
      ink(g, poly(wob([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h * 1.2], [x0, y0 + h * 1.2]], 0.5), true), a, { w: 1.4 });
      return { logoY: y0 + h * 1.2 + 16 };
    },
    // zig-zag shirt stripe
    zigzag(g, b, a) {
      const y = b.y + b.h * 0.3, amp = Math.min(9, b.h * 0.12), n = 5, step = (b.w + 12) / n;
      const top = [], bot = [];
      for (let i = 0; i <= n * 2; i++) { const x = b.x - 6 + (i * step) / 2; top.push([x, y + (i % 2 ? amp : -amp)]); bot.push([x, y + (i % 2 ? amp : -amp) + amp * 1.6]); }
      ink(g, poly(wob([...top, ...bot.reverse()], 0.4), true), a, { fill: a.fill, w: 1.6 });
      return { logoY: b.y + b.h * 0.78 };
    },
    // moonshine jug under a crescent moon
    jug(g, b, a) {
      const cx = b.cx - 8, base = b.y + b.h * 0.64, s = Math.min(1, b.h / 70);
      ink(g, smooth(wob([[cx - 15 * s, base], [cx - 18 * s, base - 14 * s], [cx - 12 * s, base - 26 * s], [cx - 5 * s, base - 30 * s], [cx - 5 * s, base - 36 * s], [cx + 5 * s, base - 36 * s], [cx + 5 * s, base - 30 * s], [cx + 12 * s, base - 26 * s], [cx + 18 * s, base - 14 * s], [cx + 15 * s, base]], 0.4), true), a, { fill: a.fill, w: 1.6 });
      ink(g, smooth(wob([[cx + 10 * s, base - 27 * s], [cx + 22 * s, base - 26 * s], [cx + 21 * s, base - 14 * s], [cx + 16 * s, base - 12 * s]], 0.3)), a, { w: 1.6 });
      ink(g, `M${f1(cx - 10 * s)} ${f1(base - 15 * s)} H${f1(cx + 10 * s)} M${f1(cx - 9 * s)} ${f1(base - 10 * s)} H${f1(cx + 9 * s)}`, a, { w: 1.2, single: true });
      const mx = b.cx + 26 * s, my = b.y + b.h * 0.2, mr = 9 * s;
      ink(g, `M${f1(mx)} ${f1(my - mr)} A${f1(mr)} ${f1(mr)} 0 1 0 ${f1(mx)} ${f1(my + mr)} A${f1(mr * 0.7)} ${f1(mr * 0.8)} 0 1 1 ${f1(mx)} ${f1(my - mr)} Z`, a, { fill: a.accent, w: 1.2 });
      return { logoY: b.y + b.h * 0.86 };
    },
    // Trio Series: a big outlined "3" and a stripe
    three(g, b, a) {
      const t = label(g, b.x + b.w - 13, b.y - 8, '3', { size: 44, fill: 'none', font: "'Inter', sans-serif", weight: 900 });
      t.setAttribute('stroke', a.ink); t.setAttribute('stroke-width', 1.1); t.setAttribute('opacity', 0.3);
      svg('rect', { x: b.x - 6, y: b.y + b.h - 6, width: b.w + 12, height: 4, fill: a.ink, opacity: 0.85 }, g);
      return { logoY: b.y + b.h - 22 };
    },
  };

  // ------------------------------------------------------------------ knob styles
  const KNOB = {
    jhs(rot, r) {
      svg('circle', { r, fill: '#0e0e0f' }, rot);
      svg('circle', { r: r - 0.9, fill: 'none', stroke: '#2a2a2d', 'stroke-width': 1.8, 'stroke-dasharray': '1.2 1.3' }, rot);
      svg('circle', { r: r * 0.66, fill: 'url(#jhs-knob)' }, rot);
      svg('circle', { r: r * 0.66, fill: 'none', stroke: '#000', 'stroke-width': 0.7 }, rot);
      svg('line', { x1: 0, y1: -r * 0.1, x2: 0, y2: -r * 0.98, stroke: '#fafafa', 'stroke-width': 1.7, 'stroke-linecap': 'round' }, rot);
    },
    cream(rot, r) {
      svg('circle', { r, fill: 'url(#jhs-cream)' }, rot);
      svg('circle', { r: r - 0.8, fill: 'none', stroke: '#6b5a3a', 'stroke-width': 1.5, 'stroke-dasharray': '0.9 1.2', opacity: 0.5 }, rot);
      svg('circle', { r: r * 0.6, fill: 'none', stroke: '#8a7650', 'stroke-width': 0.6, opacity: 0.6 }, rot);
      svg('line', { x1: 0, y1: -r * 0.1, x2: 0, y2: -r * 0.95, stroke: '#1a1a1a', 'stroke-width': 1.7, 'stroke-linecap': 'round' }, rot);
    },
    gold(rot, r) {
      svg('circle', { r, fill: '#121212' }, rot);
      svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-dasharray': '0.8 1', opacity: 0.8 }, rot);
      svg('circle', { r: r * 0.62, fill: 'url(#jhs-gold)' }, rot);
      svg('line', { x1: 0, y1: -r * 0.68, x2: 0, y2: -r * 0.98, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, rot);
      svg('line', { x1: 0, y1: -r * 0.05, x2: 0, y2: -r * 0.55, stroke: '#4a3408', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, rot);
    },
    chicken(rot, r) {
      svg('circle', { r: r * 0.9, fill: '#151515' }, rot);
      svg('path', { d: `M0 ${-r * 1.3} L${r * 0.4} ${-r * 0.2} Q${r * 0.5} ${r * 0.75} 0 ${r * 0.8} Q${-r * 0.5} ${r * 0.75} ${-r * 0.4} ${-r * 0.2} Z`, fill: 'url(#jhs-cream)', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.6 }, rot);
      svg('line', { x1: 0, y1: -r * 1.2, x2: 0, y2: -r * 0.35, stroke: '#2a2018', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, rot);
    },
  };
  function restyleKnobs(ctx, d) {
    for (const [, { ctl, view }] of ctx.views) {
      if (ctl.t !== 'knob' && ctl.t !== 'sel') continue;
      const fn = KNOB[ctl.kstyle || d.kstyle || 'jhs'];
      const rot = view.g && view.g.querySelector('.knob-rot');
      if (!fn || !rot) continue;
      while (rot.firstChild) rot.removeChild(rot.firstChild);
      fn(rot, ctl.r || 12);
    }
  }

  // ------------------------------------------------------------------ enclosure
  const BOX = { std: { w: 132, h: 248, rx: 8 }, wide: { w: 236, h: 240, rx: 9 }, three: { w: 128, h: 226, rx: 7 } };
  let seq = 0;
  function paint(g, w, h, col, rx) {
    softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { width: w, height: h, rx, fill: col }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#jhs-paint)', opacity: 0.7 }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#jhs-gloss)' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#jhs-edge)' }, g);
    svg('path', { d: `M${rx + 2} 3 H${w - rx - 2}`, stroke: '#fff', 'stroke-width': 1.4, opacity: 0.35, 'stroke-linecap': 'round' }, g);
    svg('rect', { x: 0.7, y: 0.7, width: w - 1.4, height: h - 1.4, rx: rx - 0.4, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.16 }, g);
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 }, g);
  }
  function autoRow(list, x0, x1, y) {
    const n = list.length;
    list.forEach((c, i) => { if (c.x === undefined) c.x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1); if (c.y === undefined) c.y = y; });
  }
  function layout(d, w, h, box) {
    const C = d.controls;
    C.forEach((c) => { if ((c.t === 'knob' || c.t === 'sel') && !c.labelPos) c.labelPos = c.t === 'sel' ? 'none' : 'above'; });
    C.forEach((c) => { if (c.t === 'toggle' && !c.orient) c.orient = 'h'; });
    const knobs = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
    const n = knobs.length;
    const rows = d.rows || (n <= 3 ? [n] : n === 4 ? [2, 2] : [3, n - 3]);
    const ys = box === 'three' ? [42, 90] : [44, 92];
    let k = 0;
    rows.forEach((cnt, ri) => {
      const row = knobs.slice(k, k + cnt);
      k += cnt;
      const m = cnt === 1 ? w / 2 : cnt === 2 ? w * 0.28 : 26;
      autoRow(row, m, cnt === 1 ? w / 2 : w - m, ys[ri] ?? 44 + ri * 48);
      row.forEach((c) => (c.r = c.r || d.kr || (n === 1 ? 15 : rows[0] >= 3 ? 11.5 : 13)));
    });
    let bottom = 20;
    for (const c of C) if ((c.t === 'knob' || c.t === 'sel') && c.y !== undefined) bottom = Math.max(bottom, c.y + (c.r || 12) + (c.labelPos === 'below' ? 15 : 4));
    const tg = C.filter((c) => (c.t === 'toggle' || c.t === 'button') && c.x === undefined);
    tg.forEach((t, i) => {
      t.x = tg.length === 1 ? w / 2 : w * (0.5 + (i - (tg.length - 1) / 2) * (0.62 / tg.length));
      t.y = bottom + 20;
      if (t.t === 'toggle') t.orient = t.orient || 'h';
    });
    for (const c of C) {
      if (c.t === 'toggle' && c.y !== undefined) bottom = Math.max(bottom, c.y + 15);
      if (c.t === 'button' && c.y !== undefined) bottom = Math.max(bottom, c.y + 13);
    }
    const foots = C.filter((c) => c.t === 'foot' && c.x === undefined);
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 12, y: h - 26, x: foots.length === 1 ? w / 2 : [w * 0.27, w * 0.73][i] }));
    const leds = C.filter((c) => c.t === 'led' && c.x === undefined);
    leds.forEach((l, i) => Object.assign(l, leds.length === 1 ? { r: 2.7, x: w / 2, y: 13 } : { r: 2.8, y: h - 52, x: [w * 0.27, w * 0.73][i] }));
    const top = d.artTop ?? bottom + 3;
    const bot = d.artBottom ?? h - (box === 'wide' ? 56 : 54);
    return { x: 8, y: top, w: w - 16, h: bot - top, cx: w / 2, cy: (top + bot) / 2 };
  }
  function banner(g, cx, cy, w, col, ink) {
    const h = 22, x0 = cx - w / 2, x1 = cx + w / 2;
    const tail = (s, x) => `M${x} ${cy - h / 2 + 4} h${s * 12} l${-s * 4} ${h / 2 - 2} l${s * 4} ${h / 2 - 2} h${-s * 12} Z`;
    for (const [s, x] of [[-1, x0 + 2], [1, x1 - 2]]) svg('path', { d: tail(s, x), fill: shade(col, -0.3), stroke: ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
    svg('path', { d: `M${x0} ${cy - h / 2} Q${cx} ${cy - h / 2 - 3} ${x1} ${cy - h / 2} V${cy + h / 2} Q${cx} ${cy + h / 2 - 3} ${x0} ${cy + h / 2} Z`, fill: col, stroke: ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
  }

  tz.addForm('jhs', (ctx, d) => {
    ensureDefs();
    rs = 7 + (d.id || '').length * 31 + (d.id || '').charCodeAt(4); // deterministic "hand" per pedal
    const box = d.box || 'std', B = BOX[box];
    const w = d.bw || B.w, h = d.bh || B.h, g = ctx.g;
    const txt = d.text || '#151515';
    paint(g, w, h, d.color, B.rx);
    if (d.panels) for (const p of d.panels) svg(p.tag || 'rect', Object.assign({ rx: 2 }, p, { tag: undefined }), g);
    const band = layout(d, w, h, box);
    const clipId = 'jhsclip' + ++seq;
    const cp = svg('clipPath', { id: clipId }, g);
    svg('rect', { x: 2, y: 2, width: w - 4, height: h - 4, rx: B.rx }, cp);
    const art = svg('g', { 'clip-path': `url(#${clipId})` }, g);
    const a = Object.assign({ ink: txt, fill: '#fff', fill2: '#888', accent: '#e84a5f' }, d.art || {});
    const hint = (d.art && ART[d.art.kind] && ART[d.art.kind](art, band, a, d)) || {};
    // hand-lettered logo (optionally on a ribbon banner)
    const lines = String(d.logo || '').split('\n').filter(Boolean);
    const size = d.logoSize || 18, lh = size * 0.95;
    const ly = d.logoY ?? hint.logoY ?? band.cy;
    const y0 = ly - ((lines.length - 1) * lh) / 2;
    if (d.banner) banner(g, w / 2, ly, Math.min(w - 40, d.bannerW || w - 44), d.banner, a.ink);
    lines.forEach((ln, i) => {
      const t = label(g, w / 2, y0 + i * lh, ln, { size, fill: d.logoColor || txt, font: d.logoFont || "'Oswald', sans-serif", weight: d.logoWeight || 700, ls: d.logoLs ?? 0.6 });
      if (d.logoStroke) { t.setAttribute('stroke', d.logoStroke); t.setAttribute('stroke-width', d.logoStrokeW || 2.6); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke-linejoin', 'round'); }
      if (d.logoRot) t.setAttribute('transform', `rotate(${d.logoRot} ${w / 2} ${y0 + i * lh})`);
    });
    if (d.sub) label(g, w / 2, d.subY ?? y0 + (lines.length - 1) * lh + size * 0.66 + 5, d.sub, { size: d.subSize || 6, fill: d.subColor || txt, weight: 700, ls: 1.4, font: "'Barlow Condensed', sans-serif" });
    formKit.tzBadge(g, 12, h - 11, txt, 4.2).setAttribute('text-anchor', 'start');
    const theme = { text: txt, labelFont: "'Barlow Condensed', sans-serif", labelSize: d.labelSize || 7, labelLs: 0.7, knob: 'mxr', jackText: txt };
    formKit.placeControls(ctx, d.controls, theme);
    restyleKnobs(ctx, d);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ blocks
  const J = (o) => def(Object.assign({ form: 'jhs', brand: 'JHS' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const T3 = (o) => J(Object.assign({ box: 'three', logoFont: "'Inter', sans-serif", logoWeight: 800, logoLs: -0.6, logoSize: 19, art: Object.assign({ kind: 'three' }, o.art || {}) }, o, { art: Object.assign({ kind: 'three' }, o.art || {}) }));
  const vk = (p, l, o = {}) => K(p, l, Object.assign({ display: ten }, o));
  const tsV = (o = {}) => Object.assign({ clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 700, postLp: 5000, levelMaxDb: 6 }, o);
  const mgV = { clip: 'diode', bias: 0.06, preHp: 90, gainMinDb: 2, gainMaxDb: 30, tone: 'lp', toneLo: 1800, toneHi: 9500, postLp: 10000, levelMaxDb: 9 };
  const acV = { clip: 'asym', bias: 0.2, stages: 2, stage2Db: 12, preHp: 90, gainMinDb: 8, gainMaxDb: 48, tone: 'eq3', eqRangeDb: 13, bassF: 110, midF: 650, trebleF: 2800, postLp: 7500, levelMaxDb: 0 };
  const ratV = { clip: 'si', preHp: 60, gainMinDb: 6, gainMaxDb: 56, tone: 'rat', postLp: 9000, levelMaxDb: 0, slew: 0.35 };
  const muffV = { clip: 'muff', stages: 2, stage2Db: 18, preHp: 80, gainMinDb: 20, gainMaxDb: 52, tone: 'blend', blendLp: 450, blendHp: 1100, postLp: 9000, levelMaxDb: -3 };
  // 9-voice blocks: the engine's drive offers 8 `modes`, so voice 9 lives in a second (alternate) drive
  const nineWay = (base, voices, p = 'voice') => ({
    algo: 'chain',
    opts: { chain: [{ prefix: 'a', algo: 'drive', opts: Object.assign({}, base, { modes: voices.slice(0, 8) }) }, { prefix: 'b', algo: 'drive', on: false, opts: Object.assign({}, base, voices[8]) }] },
    derive: (u) => {
      const v = u[p] ?? 0, o = { 'a.on': v < 8 ? 1 : 0, 'b.on': v >= 8 ? 1 : 0, 'a.mode': Math.min(v, 7) };
      for (const k of ['gain', 'tone', 'level']) o['a.' + k] = o['b.' + k] = u[k] ?? 0.5;
      return o;
    },
  });

  tz.addDefs([
    J({
      id: 'jhs.morningglory', name: 'Daybreak Bloom', ref: 'JHS Morning Glory V4', cat: 'Overdrive', typeName: 'Transparent overdrive',
      color: '#2f6fb5', text: '#f6f1e4', kstyle: 'cream', art: { kind: 'flower', ink: '#13243f', fill: '#9b6fe0', fill2: '#5fbf6a', accent: '#fff3a8' },
      logo: 'Daybreak Bloom', logoFont: "'Dancing Script', cursive", logoSize: 18, logoColor: '#fff6e0', logoStroke: '#13243f', logoStrokeW: 2.4,
      algo: 'drive', opts: Object.assign({}, mgV, { modes: [{}, { postLp: 4200 }] }),
      controls: [vk('level', 'VOLUME'), vk('gain', 'DRIVE', { def: 0.45 }), vk('tone', 'TONE', { def: 0.55 }), TOG('mode', 'HI-CUT', ['OFF', 'ON'])],
    }),
    J({
      id: 'jhs.bonsai', name: 'Tiny Tree', ref: 'JHS Bonsai', cat: 'Overdrive', typeName: '9-way screamer',
      color: '#c9d9b6', text: '#24321c', kstyle: 'jhs', art: { kind: 'bonsai', ink: '#24321c', fill: '#5d9b48', fill2: '#6b4a2b', accent: '#c4632f' },
      logo: 'TINY TREE', logoSize: 20, logoLs: 2.4,
      ...nineWay(tsV(), [
        { clip: 'asym', bias: 0.3, cleanSum: false, gainMaxDb: 36, postLp: 5600 }, { postLp: 4600, levelMaxDb: 4 }, { postLp: 5200 }, { gainMaxDb: 50, clipHp: 600 },
        { postLp: 5800, clipHp: 800 }, { bias: 0.12, gainMaxDb: 44 }, { clipHp: 480, postLp: 7200 }, { clip: 'led', gainMaxDb: 46, clipHp: 400, postLp: 6500 }, { clipHp: 650, postLp: 6000, bias: 0.05 },
      ]),
      controls: [vk('level', 'VOLUME'), vk('gain', 'DRIVE', { def: 0.45 }), vk('tone', 'TONE'), SEL('voice', '', ['OD-1', '808', 'TS9', 'MSL', 'TS10', 'EXAR', 'MOD', 'STRONG', '30TH'], { x: 66, y: 98, r: 13, def: 1, sweep: 270, optSize: 4.3, labelRadius: 9, virtual: true })],
      artTop: 126,
      desc: 'Nine classic screamer variants on the rotary: OD-1, 808, TS9, MSL, TS10, EXAR, keeley-style MOD, STRONG and 30TH.',
    }),
    J({
      id: 'jhs.angrycharlie', name: 'Grumpy Chuck', ref: 'JHS Angry Charlie V3', cat: 'Distortion', typeName: 'Channel drive',
      color: '#b41f24', text: '#fbeee0', kstyle: 'jhs', art: { kind: 'charlie', ink: '#1a0d0a', fill: '#f4d7b4', accent: '#ffd23f' },
      logo: 'GRUMPY CHUCK', logoSize: 17, logoLs: 1, logoColor: '#fbeee0', logoStroke: '#1a0d0a',
      algo: 'drive', opts: acV,
      controls: [vk('level', 'VOLUME'), vk('gain', 'DRIVE', { def: 0.55 }), vk('treble', 'TREBLE'), vk('bass', 'BASS'), vk('mid', 'MIDDLE')],
    }),
    J({
      id: 'jhs.superbolt', name: 'Super Jolt', ref: 'JHS Superbolt V2', cat: 'Overdrive', typeName: 'Small-amp overdrive',
      color: '#ede3c9', text: '#1d2a44', kstyle: 'jhs', art: { kind: 'bolt', ink: '#1d2a44', fill: '#2c4f8e', accent: '#ffd23f' },
      logo: 'SUPER JOLT', logoSize: 20, logoLs: 1.6,
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 8, bias: 0.3, preHp: 70, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1800, toneHi: 8000, postLp: 7500, levelMaxDb: 3, modes: [{}, { gainMaxDb: 48, stage2Db: 14 }] },
      controls: [vk('level', 'VOLUME'), vk('gain', 'DRIVE', { def: 0.5 }), vk('tone', 'TONE'), TOG('mode', 'GAIN', ['LO', 'HI'])],
    }),
    J({
      id: 'jhs.kilt', name: 'Tartan', ref: 'JHS Kilt V2', cat: 'Fuzz', typeName: 'Overdrive / fuzz',
      color: '#2e5a3a', text: '#f3ecd8', kstyle: 'cream', art: { kind: 'tartan', ink: '#14140f', fill: '#1f3f70', fill2: '#b4232a', accent: '#f2d04a' },
      logo: 'TARTAN', logoSize: 19, logoLs: 3, logoColor: '#14140f', banner: '#f3ecd8', bannerW: 92,
      algo: 'drive', opts: { clip: 'si', bias: 0.15, preHp: 70, gainMinDb: 4, gainMaxDb: 34, tone: 'lp', toneLo: 1200, toneHi: 7000, postLp: 7000, levelMaxDb: 4, modes: [{}, { gainMaxDb: 46 }, { clip: 'ge', stages: 2, stage2Db: 14, gainMinDb: 16, gainMaxDb: 50, bias: 0.35 }] },
      controls: [vk('level', 'VOLUME'), vk('gain', 'GAIN', { def: 0.5 }), vk('tone', 'TONE'), TOG('mode', 'MODE', ['LO', 'HI', 'FUZZ'])],
    }),
    J({
      id: 'jhs.packrat', name: 'Hoard Rat', ref: 'JHS PackRat', cat: 'Distortion', typeName: '9-way rodent distortion',
      color: '#9a9ea3', text: '#151515', kstyle: 'jhs', art: { kind: 'rat', ink: '#151515', fill: '#5a5450', accent: '#e8a0a8' },
      logo: 'HOARD RAT', logoSize: 20, logoLs: 2,
      ...nineWay(ratV, [
        {}, { bias: 0.1 }, { postLp: 6500, gainMaxDb: 52 }, { clip: 'led', gainMaxDb: 52 }, { clip: 'ge', bias: 0.2 }, { clip: 'mosfet' },
        { clip: 'diode', gainMaxDb: 50, postLp: 7000 }, { clip: 'led', gainMaxDb: 48, preHp: 120 }, { clip: 'asym', bias: 0.25, gainMaxDb: 50 },
      ]),
      controls: [vk('level', 'VOLUME'), vk('tone', 'FILTER', { def: 0.4 }), vk('gain', 'DISTORTION', { def: 0.5 }), SEL('voice', '', ['ORIG', 'RE', 'WHITE', 'TURBO', 'DIRTY', 'GHOST', 'R2DU', 'BRAT', 'LIL'], { x: 66, y: 98, r: 13, sweep: 270, optSize: 4.3, labelRadius: 9, virtual: true })],
      artTop: 126,
    }),
    J({
      id: 'jhs.muffuletta', name: 'Sandwich Fuzz', ref: 'JHS Muffuletta', cat: 'Fuzz', typeName: '6-way sustaining fuzz',
      color: '#e7d3a7', text: '#3a1e0e', kstyle: 'jhs', art: { kind: 'sandwich', ink: '#3a1e0e', fill: '#d79a4a', fill2: '#5fae4a', accent: '#b8323a' },
      logo: 'SANDWICH', logoSize: 21, logoLs: 2, logoColor: '#3a1e0e',
      algo: 'drive', opts: Object.assign({}, muffV, { modes: [{}, { stages: 2, blendLp: 400, blendHp: 1250, postLp: 10000 }, { blendLp: 520, blendHp: 1350, stage2Db: 16 }, { blendLp: 380, blendHp: 950, postLp: 7200 }, { stage2Db: 20, gainMaxDb: 54 }, { clip: 'diode', slew: 0.3, blendLp: 620, blendHp: 1350 }] }),
      controls: [vk('level', 'VOLUME'), vk('gain', 'SUSTAIN', { def: 0.6 }), vk('tone', 'TONE'), SEL('mode', '', ['MOD', 'TRI', 'RAM', 'RUSS', 'PI', 'OP'], { x: 66, y: 98, r: 12, sweep: 200, optSize: 4.6, labelRadius: 9 })],
      artTop: 124,
    }),
    J({
      id: 'jhs.colourbox', name: 'Paint Box', ref: 'JHS Colour Box V2', cat: 'Preamp', kind: 'Pedal', typeName: 'Console preamp',
      box: 'wide', color: '#e9e4d6', text: '#1b1b1b', kstyle: 'chicken', cost: 0.9, art: { kind: 'bars', ink: '#1b1b1b' },
      logo: 'PAINT BOX', logoSize: 22, logoLs: 4, artTop: 108, artBottom: 196,
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 6, bias: 0.12, gainMinDb: -4, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 15, bassF: 110, midF: 1000, trebleF: 4500, postLp: 16000, levelMaxDb: 10, modes: [{ preHp: 20 }, { preHp: 90 }, { preHp: 180 }] },
      controls: [
        K('level', 'MASTER', { x: 30, y: 40, r: 12, def: 0.45 }), K('pre', 'PRE VOL', { x: 74, y: 40, r: 12, def: 0.5, virtual: true }), SEL('step', 'STEP', ['1', '2', '3', '4', '5'], { x: 118, y: 40, r: 12, def: 1, sweep: 160, optSize: 5, virtual: true, labelPos: 'below' }),
        K('treble', 'TREBLE', { x: 162, y: 40, r: 12 }), K('mid', 'MIDDLE', { x: 206, y: 40, r: 12 }),
        K('bass', 'BASS', { x: 162, y: 88, r: 12 }), TOG('mode', 'HI-PASS', ['OFF', '90', '180'], { x: 52, y: 86 }),
      ],
      derive: (p) => ({ gain: Math.min(1, ((p.step ?? 1) / 4) * 0.75 + (p.pre ?? 0.5) * 0.25) }),
      desc: 'STEP sets the console-style gain stage, PRE VOL trims into it, MASTER sets the output.',
    }),
    J({
      id: 'jhs.pulpnpeel', name: 'Zest & Peel', ref: "JHS Pulp 'N Peel V4", cat: 'Dynamics', typeName: 'Compressor / preamp',
      color: '#ef8a2a', text: '#1d1205', kstyle: 'cream', art: { kind: 'citrus', ink: '#1d1205', fill: '#f6b23c', fill2: '#ffe1a3', accent: '#3a7d2a' },
      logo: 'ZEST & PEEL', logoSize: 18, logoLs: 1.2,
      algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'comp', opts: { type: 'opto' } }, { prefix: 'd', algo: 'drive', on: false, opts: { clip: 'jfet', gainMinDb: 0, gainMaxDb: 18, tone: 'none', postLp: 12000, levelMaxDb: 0 }, params: { gain: 0.5, level: 0.5 } }] },
      controls: [vk('c.level', 'VOLUME', { def: 0.42 }), vk('c.sustain', 'COMP', { def: 0.5 }), vk('c.tone', 'EQ'), vk('c.blend', 'BLEND', { def: 0.8 }), TOG('d.on', 'DIRT', ['OFF', 'ON'])],
    }),
    J({
      id: 'jhs.springtank', name: 'Coil Tank', ref: 'JHS Spring Tank', cat: 'Reverb', typeName: 'Spring reverb',
      color: '#2b2f36', text: '#ece6d6', kstyle: 'cream', cost: 1.1, art: { kind: 'spring', ink: '#ece6d6', fill: '#c9a24a' },
      logo: 'COIL TANK', logoSize: 21, logoLs: 3,
      algo: 'reverb', opts: { fixedMode: 3 }, fixed: { mode: 3 },
      controls: [vk('mix', 'MIX', { def: 0.35 }), vk('tone', 'TONE', { def: 0.55 }), vk('decay', 'DWELL', { def: 0.5 }), TOG('tank', 'TANK', ['S', 'M', 'L'], { def: 1, virtual: true })],
      derive: (p) => ({ size: [0.3, 0.55, 0.85][p.tank ?? 1], predelay: [8, 18, 30][p.tank ?? 1] }),
    }),
    J({
      id: 'jhs.luckycat', name: 'Fortune Cat', ref: 'JHS Lucky Cat', cat: 'Delay', typeName: 'Tape / BBD delay',
      box: 'wide', color: '#d9312b', text: '#fff4e6', kstyle: 'jhs', cost: 0.8, noStd: true, art: { kind: 'cat', ink: '#2a0c08', fill: '#fff4e6', accent: '#d9312b' },
      logo: 'FORTUNE CAT', logoSize: 21, logoLs: 2, logoColor: '#fff4e6', logoStroke: '#2a0c08', artTop: 100,
      algo: 'delay', opts: { maxMs: 1000 },
      controls: [
        K('mix', 'MIX', { x: 34, y: 42, r: 12, def: 0.4 }), K('time', 'TIME', { x: 76, y: 42, r: 12, min: 40, max: 1000, def: 380, display: ms }), K('feedback', 'REPEATS', { x: 118, y: 42, r: 12, def: 0.4, max: 1.08 }),
        K('moddepth', 'DEPTH', { x: 160, y: 42, r: 12, def: 0.25 }), K('modrate', 'RATE', { x: 202, y: 42, r: 12, def: 0.3 }),
        TOG('mode', 'TYPE', ['BBD', 'TAPE'], { x: 118, y: 86, values: [1, 2] }),
        FOOT({ action: 'tap', label: 'TAP', x: 64, y: 214, r: 12, labelDy: -22 }), FOOT({ x: 172, y: 214, r: 12, label: 'ON', labelDy: -22 }),
        LED({ x: 90, y: 214, bind: 'tap:time' }), LED({ x: 198, y: 214 }),
      ],
      derive: (p) => ({ age: p.mode ? 0.45 : 0.25, tone: p.mode ? 0.5 : 0.38, heads: 4 }),
    }),
    J({
      id: 'jhs.panthercub', name: 'Cougar Cub', ref: 'JHS Panther Cub V2', cat: 'Delay', typeName: 'Analog delay',
      box: 'wide', color: '#1c1c1f', text: '#f1e7c6', kstyle: 'gold', cost: 0.8, noStd: true, art: { kind: 'panther', ink: '#f1e7c6', fill: '#2c2c31', fill2: '#f1e7c6', accent: '#e8c23a' },
      logo: 'COUGAR CUB', logoSize: 21, logoLs: 2.4, logoColor: '#e8c23a', artTop: 104,
      algo: 'delay', opts: { maxMs: 1200, fixedMode: 1 },
      controls: [
        K('mix', 'MIX', { x: 34, y: 42, r: 12, def: 0.4 }), K('feedback', 'REPEATS', { x: 76, y: 42, r: 12, def: 0.4, max: 1.08 }), K('time', 'TIME', { x: 118, y: 42, r: 12, min: 40, max: 1100, def: 400, display: ms }),
        K('tone', 'EQ', { x: 160, y: 42, r: 12, def: 0.45 }), K('moddepth', 'DEPTH', { x: 202, y: 42, r: 12, def: 0.2 }),
        K('modrate', 'RATE', { x: 202, y: 92, r: 10, def: 0.3 }), TOG('subdiv', 'RATIO', ['1/4', '1/8.', '1/8T'], { x: 76, y: 92, values: [0, 1, 3] }),
        FOOT({ action: 'tap', label: 'TAP', x: 64, y: 214, r: 12, labelDy: -22 }), FOOT({ x: 172, y: 214, r: 12, label: 'ON', labelDy: -22 }),
        LED({ x: 90, y: 214, bind: 'tap:time' }), LED({ x: 198, y: 214 }),
      ],
    }),
    J({
      id: 'jhs.hauntingmids', name: 'Spooky Mids', ref: 'JHS Haunting Mids', cat: 'EQ', typeName: 'Mid-range EQ',
      color: '#5d3b7d', text: '#efe8f8', kstyle: 'cream', art: { kind: 'ghost', ink: '#1a0f26', fill: '#f4f1fa', accent: '#b8e04a' },
      logo: 'SPOOKY MIDS', logoSize: 18, logoLs: 1.4, logoColor: '#efe8f8', logoStroke: '#1a0f26',
      algo: 'peq', fixed: { mid2gain: 0, lowgain: 0, highgain: 0 },
      controls: [K('level', 'VOLUME', { min: -12, max: 12, def: 0, display: db }), K('mid1gain', 'MIDS', { min: -15, max: 15, def: 4, display: db }), K('mid1freq', 'SWEEP', { min: 200, max: 3000, def: 800, curve: 'log', unit: 'Hz' }),
        TOG('mid1q', 'Q', ['WIDE', 'NARROW'], { values: [0.7, 2.2] })],
    }),
    J({
      id: 'jhs.clover', name: 'Shamrock Preamp', ref: 'JHS Clover', cat: 'Acoustic', kind: 'Pedal', typeName: 'Acoustic preamp',
      color: '#2f8a4a', text: '#f2f6ee', kstyle: 'cream', art: { kind: 'clover', ink: '#0e2414', fill: '#7fd36a', fill2: '#cfe9b8' },
      logo: 'SHAMROCK', logoSize: 19, logoLs: 2, logoColor: '#f2f6ee', logoStroke: '#0e2414', sub: 'PREAMP', subSize: 6,
      algo: 'acoustic', opts: { mode: 2 }, fixed: { mode: 2, mix: 1, body: 0.4 },
      controls: [K('level', 'VOLUME', { min: -24, max: 12, def: 0, display: db }), vk('bass', 'BASS'), vk('mid', 'MIDDLE'), vk('treble', 'TREBLE'), TOG('fet', 'MODE', ['CLEAN', 'FET'], { virtual: true }), TOG('hpf', 'HPF', ['OFF', 'ON'], { virtual: true })],
      derive: (p) => ({ saturate: p.fet ? 0.35 : 0, bass: (p.bass ?? 0.5) * (p.hpf ? 0.55 : 1) }),
    }),
    J({
      id: 'jhs.atplus', name: 'Lead Plus', ref: 'JHS AT+ (Andy Timmons)', cat: 'Distortion', typeName: 'Channel drive',
      color: '#f2f0ea', text: '#151515', kstyle: 'jhs', art: { kind: 'starburst', ink: '#151515', fill: '#e8c23a', fill2: '#151515', accent: '#d9312b' },
      logo: 'LEAD PLUS', logoSize: 20, logoLs: 2,
      algo: 'drive', opts: Object.assign({}, acV, { gainMaxDb: 42, levelMaxDb: 1, modes: [{ gainMaxDb: 34 }, {}, { gainMaxDb: 52, stage2Db: 16 }] }),
      controls: [vk('level', 'VOLUME'), vk('gain', 'GAIN', { def: 0.5 }), vk('bass', 'BASS'), vk('treble', 'TREBLE'), TOG('mode', 'GAIN', ['LO', 'MID', 'HI'], { def: 1 })],
    }),
    J({
      id: 'jhs.doublebarrel', name: 'Twin Barrel', ref: 'JHS Double Barrel V4', cat: 'Overdrive', typeName: 'Dual overdrive',
      box: 'wide', color: '#4a6d3c', text: '#f4ead4', kstyle: 'cream', cost: 1.1, noStd: true, art: { kind: 'barrels', ink: '#1a2414', fill: '#b9b4a8', fill2: '#6a665e' },
      logo: 'TWIN BARREL', logoSize: 20, logoLs: 2.4, logoColor: '#f4ead4', logoStroke: '#1a2414', artTop: 100,
      panels: [{ x: 117.5, y: 62, width: 1.2, height: 40, fill: '#1a2414', opacity: 0.5 }],
      algo: 'chain',
      opts: { chain: [
        { prefix: 'm', algo: 'drive', opts: tsV({ clipHp: 620, postLp: 6000, modes: [{}, { preEq: [{ type: 'ls', f: 160, q: 0.7, db: 4 }] }] }) },
        { prefix: 'g', algo: 'drive', opts: Object.assign({}, mgV, { modes: [{}, { postLp: 4200 }] }) },
        { prefix: 'n', algo: 'drive', on: false, opts: tsV({ clipHp: 620, postLp: 6000, modes: [{}, { preEq: [{ type: 'ls', f: 160, q: 0.7, db: 4 }] }] }) },
      ] },
      controls: [
        K('m.level', 'VOLUME', { x: 28, y: 42, r: 11 }), K('m.gain', 'GAIN', { x: 66, y: 42, r: 11, def: 0.45 }), K('m.tone', 'TONE', { x: 47, y: 86, r: 11 }), TOG('m.mode', 'BASS', ['OFF', 'ON'], { x: 94, y: 86 }),
        K('g.level', 'VOLUME', { x: 170, y: 42, r: 11 }), K('g.gain', 'DRIVE', { x: 208, y: 42, r: 11, def: 0.45 }), K('g.tone', 'TONE', { x: 189, y: 86, r: 11 }), TOG('g.mode', 'HI-CUT', ['OFF', 'ON'], { x: 142, y: 86 }),
        TOG('order', 'ORDER', ['A>B', 'B>A'], { x: 118, y: 46, virtual: true }),
        FOOT({ action: 'param', p: 'mon', toggle: true, label: 'A', x: 60, y: 214, r: 12, labelDy: -22, def: 1 }), FOOT({ action: 'param', p: 'g.on', toggle: true, label: 'B', x: 176, y: 214, r: 12, labelDy: -22 }),
        LED({ x: 86, y: 214, bind: 'param:mon' }), LED({ x: 202, y: 214, bind: 'param:g.on' }),
      ],
      derive: (p) => {
        const on = p.mon ?? 1, rev = p.order === 1, o = { 'm.on': rev ? 0 : on, 'n.on': rev ? on : 0 };
        for (const k of ['level', 'gain', 'tone', 'mode']) o['n.' + k] = p['m.' + k] ?? (k === 'mode' ? 0 : 0.5);
        return o;
      },
      alwaysOn: true, initParams: { mon: 1, 'g.on': 0 },
      desc: 'A: screamer-style drive with BASS boost. B: transparent drive with HI-CUT. ORDER swaps which side comes first.',
    }),
    J({
      id: 'jhs.sweettea', name: 'Iced Tea', ref: 'JHS Sweet Tea V3', cat: 'Overdrive', typeName: 'Dual drive',
      box: 'wide', color: '#e4c27a', text: '#2a1806', kstyle: 'jhs', cost: 1.1, noStd: true, art: { kind: 'tea', ink: '#2a1806', fill2: '#c9c3b0' },
      logo: 'ICED TEA', logoSize: 21, logoLs: 3, artTop: 102,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'm', algo: 'drive', opts: tsV({ cleanMix: 0.5, clipHp: 600, postLp: 6000 }) },
        { prefix: 'c', algo: 'drive', opts: acV },
        { prefix: 'n', algo: 'drive', on: false, opts: tsV({ cleanMix: 0.5, clipHp: 600, postLp: 6000 }) },
      ] },
      controls: [
        K('m.level', 'VOLUME', { x: 26, y: 42, r: 10.5 }), K('m.gain', 'GAIN', { x: 62, y: 42, r: 10.5, def: 0.45 }), K('m.tone', 'TONE', { x: 26, y: 88, r: 10.5 }), K('m.blend', 'CLEAN', { x: 62, y: 88, r: 10.5, def: 0.25, invert: true }),
        K('c.level', 'VOLUME', { x: 136, y: 42, r: 10.5 }), K('c.gain', 'DRIVE', { x: 172, y: 42, r: 10.5, def: 0.5 }), K('c.treble', 'TREBLE', { x: 208, y: 42, r: 10.5 }),
        K('c.bass', 'BASS', { x: 154, y: 88, r: 10.5 }), K('c.mid', 'MIDDLE', { x: 190, y: 88, r: 10.5 }),
        TOG('order', 'ORDER', ['A>B', 'B>A'], { x: 99, y: 66, virtual: true }),
        FOOT({ action: 'param', p: 'mon', toggle: true, label: 'A', x: 60, y: 214, r: 12, labelDy: -22, def: 1 }), FOOT({ action: 'param', p: 'c.on', toggle: true, label: 'B', x: 176, y: 214, r: 12, labelDy: -22 }),
        LED({ x: 86, y: 214, bind: 'param:mon' }), LED({ x: 202, y: 214, bind: 'param:c.on' }),
      ],
      artTop: 108,
      derive: (p) => {
        const on = p.mon ?? 1, rev = p.order === 1, o = { 'm.on': rev ? 0 : on, 'n.on': rev ? on : 0, 'm.blend': 1 - (p['m.blend'] ?? 0.75) };
        for (const k of ['level', 'gain', 'tone']) o['n.' + k] = p['m.' + k] ?? 0.5;
        o['n.blend'] = o['m.blend'];
        return o;
      },
      alwaysOn: true, initParams: { mon: 1, 'c.on': 0, 'm.blend': 0.75 },
      desc: 'A: screamer drive with CLEAN blend. B: channel-style drive with 3-band EQ. ORDER swaps the sides.',
    }),
    J({
      id: 'jhs.unicorn', name: 'Mythic Vibe', ref: 'JHS Unicorn V2', cat: 'Modulation', typeName: 'Uni-vibe',
      color: '#f0e9f6', text: '#2a1d3a', kstyle: 'jhs', art: { kind: 'unicorn', ink: '#2a1d3a', fill: '#f6e9b8', accent: '#c9a24a' },
      logo: 'MYTHIC VIBE', logoSize: 18, logoLs: 1.4,
      algo: 'vibe',
      controls: [vk('level', 'VOLUME'), vk('speed', 'SPEED', { def: 0.4 }), vk('intensity', 'INTENSITY', { def: 0.7 }), TOG('mode', 'MODE', ['CHORUS', 'VIBRATO'])],
    }),
    J({
      id: 'jhs.emperor', name: 'Kaiser Chorus', ref: 'JHS Emperor V2', cat: 'Modulation', typeName: 'Analog chorus / vibrato',
      color: '#6b2a86', text: '#f6eefb', kstyle: 'gold', stereo: 'both', art: { kind: 'crown', ink: '#1d0a26', fill: '#e8c23a', fill2: '#b38a1f', accent: '#d9312b' },
      logo: 'KAISER', logoSize: 22, logoLs: 4, logoColor: '#f6eefb', logoStroke: '#1d0a26',
      algo: 'chorus',
      controls: [vk('level', 'VOLUME'), vk('depth', 'DEPTH', { def: 0.5 }), vk('rate', 'RATE', { def: 0.35 }), vk('tone', 'EQ'), TOG('mode', 'MODE', ['CHORUS', 'VIBRATO'], { virtual: true })],
      derive: (p) => (p.mode ? { mode: 1, mix: 1 } : { mode: 0, mix: 0.5 }),
    }),
    J({
      id: 'jhs.tidewater', name: 'Tidal', ref: 'JHS Tidewater', cat: 'Modulation', typeName: 'Tremolo',
      color: '#1f6f8b', text: '#eef8fb', kstyle: 'cream', stereo: 'both', art: { kind: 'tide', ink: '#0b2833', fill: '#bfe6f2', fill2: '#ffffff', accent: '#f6e9b8' },
      logo: 'TIDAL', logoSize: 24, logoLs: 5, logoColor: '#eef8fb', logoStroke: '#0b2833',
      algo: 'tremolo',
      controls: [vk('level', 'VOLUME'), vk('rate', 'RATE', { def: 0.4 }), vk('depth', 'DEPTH', { def: 0.6 }), TOG('wave', 'WAVE', ['SINE', 'TRI', 'SQR'], { values: [0, 0.4, 1] })],
    }),
    J({
      id: 'jhs.smiley', name: 'Grinner Fuzz', ref: 'JHS Smiley', cat: 'Fuzz', typeName: 'Round fuzz',
      color: '#f4c722', text: '#1c1608', kstyle: 'jhs', art: { kind: 'smiley', ink: '#1c1608', fill: '#fff2a0' },
      logo: 'GRINNER', logoSize: 22, logoLs: 3,
      algo: 'drive', opts: { clip: 'ge', stages: 2, stage2Db: 12, bias: 0.4, preHp: 40, gainMinDb: 12, gainMaxDb: 46, tone: 'none', postLp: 6500, levelMaxDb: -2, modes: [{}, { clip: 'si', bias: 0.25, postLp: 8000 }] },
      controls: [vk('level', 'VOLUME'), vk('gain', 'FUZZ', { def: 0.65 }), TOG('mode', 'TRANSISTOR', ['GE', 'SI'])],
    }),

    // ---------------------------------------------------------------- the Trio Series (minimal 3-knob boxes)
    T3({ id: 'jhs.3od', name: 'Trio Overdrive', ref: 'JHS 3 Series Overdrive', cat: 'Overdrive', typeName: 'Overdrive', color: '#2f8f5b', text: '#f4f7f2', logo: 'overdrive',
      algo: 'drive', opts: tsV({ modes: [{}, { gainMaxDb: 48 }] }), controls: [vk('level', 'VOLUME'), vk('gain', 'GAIN', { def: 0.45 }), vk('tone', 'TONE'), TOG('mode', 'GAIN', ['LO', 'HI'])] }),
    T3({ id: 'jhs.3dist', name: 'Trio Distortion', ref: 'JHS 3 Series Distortion', cat: 'Distortion', typeName: 'Distortion', color: '#d4552a', text: '#fff4ec', logo: 'distortion', logoSize: 17,
      algo: 'drive', opts: Object.assign({}, ratV, { modes: [{}, { clip: 'led', gainMaxDb: 52 }] }), controls: [vk('level', 'VOLUME'), vk('gain', 'DIST', { def: 0.5 }), vk('tone', 'TONE', { def: 0.45 }), TOG('mode', 'CLIP', ['SI', 'LED'])] }),
    T3({ id: 'jhs.3fuzz', name: 'Trio Fuzz', ref: 'JHS 3 Series Fuzz', cat: 'Fuzz', typeName: 'Fuzz', color: '#6d3fa0', text: '#f7f0ff', logo: 'fuzz', logoSize: 24,
      algo: 'drive', opts: { clip: 'ge', stages: 2, stage2Db: 14, bias: 0.35, preHp: 60, gainMinDb: 14, gainMaxDb: 50, tone: 'lp', toneLo: 900, toneHi: 7000, postLp: 7500, levelMaxDb: -2, modes: [{}, { clip: 'si', bias: 0.6 }] },
      controls: [vk('level', 'VOLUME'), vk('gain', 'FUZZ', { def: 0.6 }), vk('tone', 'TONE'), TOG('mode', 'BIAS', ['FAT', 'GATED'])] }),
    T3({ id: 'jhs.3delay', name: 'Trio Delay', ref: 'JHS 3 Series Delay', cat: 'Delay', typeName: 'Delay', color: '#2a5fa8', text: '#eef4fc', logo: 'delay', logoSize: 23,
      algo: 'delay', opts: { maxMs: 1000 }, fixed: { tone: 0.5 }, controls: [vk('mix', 'MIX', { def: 0.4 }), K('time', 'TIME', { min: 40, max: 1000, def: 380, display: ms }), vk('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), TOG('mod', 'MOD', ['OFF', 'ON'], { virtual: true })],
      derive: (p) => ({ mode: p.mod ? 4 : 0, moddepth: p.mod ? 0.35 : 0 }) }),
    T3({ id: 'jhs.3reverb', name: 'Trio Reverb', ref: 'JHS 3 Series Reverb', cat: 'Reverb', typeName: 'Reverb', color: '#1f8a8a', text: '#eefafa', logo: 'reverb', logoSize: 22, cost: 1.1,
      algo: 'reverb', controls: [vk('mix', 'MIX', { def: 0.35 }), vk('decay', 'DECAY', { def: 0.5 }), vk('tone', 'TONE', { def: 0.55 }), TOG('mode', 'ROOM', ['ROOM', 'HALL'], { values: [0, 1], def: 1 })] }),
    T3({ id: 'jhs.3chorus', name: 'Trio Chorus', ref: 'JHS 3 Series Chorus', cat: 'Modulation', typeName: 'Chorus', color: '#e06aa4', text: '#1e0c16', logo: 'chorus', logoSize: 22, stereo: 'both',
      algo: 'chorus', controls: [vk('level', 'VOLUME'), vk('rate', 'RATE', { def: 0.35 }), vk('depth', 'DEPTH', { def: 0.5 }), TOG('vib', 'MODE', ['CHORUS', 'VIBRATO'], { virtual: true })],
      derive: (p) => (p.vib ? { mode: 1, mix: 1 } : { mode: 0, mix: 0.5 }) }),
    T3({ id: 'jhs.3comp', name: 'Trio Compressor', ref: 'JHS 3 Series Compressor', cat: 'Dynamics', typeName: 'Compressor', color: '#e8c23a', text: '#1d1806', logo: 'compressor', logoSize: 16,
      algo: 'comp', opts: { type: 'vca' }, fixed: { ratio: 0.55 }, controls: [vk('level', 'VOLUME', { def: 0.4 }), vk('sustain', 'SUSTAIN', { def: 0.5 }), vk('attack', 'ATTACK', { def: 0.35 }), TOG('tone', 'EQ', ['FLAT', 'BRIGHT'], { values: [0.5, 0.75] })] }),
    T3({ id: 'jhs.3phaser', name: 'Trio Phaser', ref: 'JHS 3 Series Phaser', cat: 'Modulation', typeName: 'Phaser', color: '#c42b3a', text: '#fff0f0', logo: 'phaser', logoSize: 22,
      algo: 'phaser', fixed: { mix: 0.5 }, controls: [vk('rate', 'RATE', { def: 0.35 }), vk('depth', 'DEPTH', { def: 0.8 }), vk('feedback', 'COLOR', { def: 0.35 }), TOG('stages', 'STAGES', ['4', '8'], { values: [4, 8] })] }),
    // PHERB: reverb -> 4-stage phaser, recombined with the dry; BREAK = asymmetric bitcrusher + clipping in front
    T3({ id: 'jhs.3pherb', name: 'Trio Phaze-Verb', ref: 'JHS 3 Series PHERB', cat: 'Reverb', typeName: 'Phaser / reverb', color: '#8e78c4', text: '#17112a', logo: 'phazeverb', logoSize: 16, cost: 1.5,
      algo: 'chain',
      opts: { mix: true, mixDef: 0.4, chain: [
        { prefix: 'k', algo: 'crusher', on: false, params: { bits: 0.35, rate: 0.35, mix: 1 } },
        { prefix: 'b', algo: 'drive', on: false, opts: { clip: 'asym', bias: 0.35, gainMinDb: 10, gainMaxDb: 24, tone: 'none', postLp: 6500, levelMinDb: -20, levelMaxDb: -6 }, params: { gain: 0.5, level: 1 } },
        { prefix: 'r', algo: 'reverb', opts: { mode: 1 }, params: { mix: 1, mode: 1, tone: 0.6, mod: 0.3 } },
        { prefix: 'p', algo: 'phaser', opts: { stages: 4 }, params: { stages: 4, depth: 0.8, feedback: 0.35, mix: 0.5 } },
      ] },
      controls: [vk('mix', 'MIX', { def: 0.4 }), vk('speed', 'SPEED', { def: 0.35, virtual: true }), vk('length', 'LENGTH', { def: 0.45, virtual: true }), TOG('brk', 'BREAK', ['OFF', 'ON'], { virtual: true })],
      derive: (p) => {
        const sp = p.speed ?? 0.35, len = p.length ?? 0.45, brk = p.brk ? 1 : 0;
        return { 'p.on': sp > 0.02 ? 1 : 0, 'p.rate': sp, 'r.decay': 0.1 + len * 0.9, 'r.size': 0.25 + len * 0.75, 'r.predelay': 5 + len * 120, 'k.on': brk, 'b.on': brk };
      },
      desc: 'Reverb into a vintage 4-stage phaser, blended with your dry signal by MIX. SPEED sets the phaser rate (fully down = reverb only), LENGTH sets the decay and pre-delay together. BREAK puts an asymmetric bitcrusher with analog-style clipping in front for broken, fuzzy washes.' }),
    J({
      id: 'jhs.charliebrown', name: 'Good Grief', ref: 'JHS Charlie Brown V4', cat: 'Overdrive', typeName: 'British crunch',
      color: '#7a4a2a', text: '#f6eccf', kstyle: 'cream', art: { kind: 'zigzag', ink: '#1d120a', fill: '#f2c230' },
      logo: 'GOOD GRIEF', logoSize: 19, logoLs: 1.6, logoColor: '#f6eccf', logoStroke: '#1d120a',
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 8, bias: 0.25, preHp: 90, gainMinDb: 6, gainMaxDb: 42, tone: 'lp', toneLo: 1500, toneHi: 8000, postLp: 7500, levelMaxDb: 4, modes: [{}, { preEq: [{ type: 'ls', f: 150, q: 0.7, db: 4 }] }] },
      controls: [vk('level', 'VOLUME'), vk('gain', 'GAIN', { def: 0.5 }), vk('tone', 'TONE'), TOG('mode', 'BASS', ['OFF', 'ON'])],
      desc: 'Plexi-style crunch in a box. The BASS switch fattens the low end.',
    }),
    J({
      id: 'jhs.moonshine', name: 'Hooch', ref: 'JHS Moonshine V2', cat: 'Overdrive', typeName: 'Screamer-style overdrive',
      color: '#1d2a3c', text: '#efe6cc', kstyle: 'cream', art: { kind: 'jug', ink: '#efe6cc', fill: '#b9844a', accent: '#f4e7a0' },
      logo: 'HOOCH', logoSize: 24, logoLs: 4, logoColor: '#f4e7a0',
      algo: 'drive', opts: tsV({ gainMaxDb: 44, modes: [{}, { clipHp: 480, postLp: 6200 }] }),
      controls: [vk('level', 'VOLUME'), vk('gain', 'GAIN', { def: 0.45 }), vk('tone', 'TONE'), TOG('mode', 'VOICE', ['TIGHT', 'FULL'])],
      desc: 'Smooth screamer drive with more gain and a fuller low end on the VOICE switch.',
    }),
    // newer Trio boxes come in the white enclosure
    T3({ id: 'jhs.3flanger', name: 'Trio Flanger', ref: 'JHS 3 Series Flanger', cat: 'Modulation', typeName: 'Flanger', color: '#f1f0eb', text: '#151515', logo: 'flanger', logoSize: 20,
      algo: 'flanger', fixed: { mix: 0.5, manual: 0.5 }, controls: [vk('speed', 'RATE', { def: 0.3 }), vk('width', 'DEPTH', { def: 0.6 }), vk('regen', 'FEEDBACK', { def: 0.55 }), TOG('mode', 'MODE', ['NORM', 'JET'], { values: [0, 1] })] }),
    T3({ id: 'jhs.3hall', name: 'Trio Hall Verb', ref: 'JHS 3 Series Hall Reverb', cat: 'Reverb', typeName: 'Hall reverb', color: '#f1f0eb', text: '#151515', logo: 'hall verb', logoSize: 18, cost: 1.1,
      algo: 'reverb', opts: { fixedMode: 1 }, fixed: { mode: 1 }, controls: [vk('mix', 'VERB', { def: 0.35 }), vk('decay', 'DECAY', { def: 0.6 }), vk('tone', 'TONE', { def: 0.55 }), TOG('mod', 'MOD', ['OFF', 'ON'], { values: [0.05, 0.5] })] }),
    T3({ id: 'jhs.3octverb', name: 'Trio Octave Verb', ref: 'JHS 3 Series Octave Reverb', cat: 'Reverb', typeName: 'Octave reverb', color: '#f1f0eb', text: '#151515', logo: 'octave verb', logoSize: 16, cost: 1.6,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'p', algo: 'pitch', on: false, params: { semis1: -12, level1: 0.5, level2: 0, level3: 0, dry: 1, quality: 1 } },
        { prefix: 'r', algo: 'reverb', opts: { mode: 4 }, params: { mode: 4, tone: 0.55, mod: 0.3 } },
      ] },
      controls: [vk('r.mix', 'VERB', { def: 0.35 }), vk('oct', 'OCTAVE', { def: 0.5, virtual: true }), vk('r.decay', 'DECAY', { def: 0.6 }), TOG('dir', 'MODE', ['UP', 'DOWN'], { virtual: true })],
      derive: (p) => { const o = p.oct ?? 0.5, dn = p.dir === 1; return { 'r.mode': dn ? 1 : 4, 'r.shimmer': dn ? 0 : o, 'p.on': dn ? 1 : 0, 'p.level1': o * 0.7 }; },
      desc: 'Reverb with an octave in the tail. UP is a shimmer, DOWN blends an octave below into the reverb.' }),
    T3({ id: 'jhs.3harmtrem', name: 'Trio Harmonic Trem', ref: 'JHS 3 Series Harmonic Trem', cat: 'Modulation', typeName: 'Harmonic tremolo', color: '#f1f0eb', text: '#151515', logo: 'harm trem', logoSize: 18,
      algo: 'tremolo', controls: [vk('level', 'VOLUME'), vk('rate', 'RATE', { def: 0.4 }), vk('depth', 'DEPTH', { def: 0.6 }), TOG('mode', 'MODE', ['HARM', 'STD'], { values: [1, 0] })] }),
    T3({ id: 'jhs.3rotary', name: 'Trio Rotary Chorus', ref: 'JHS 3 Series Rotary Chorus', cat: 'Modulation', typeName: 'Rotary chorus', color: '#f1f0eb', text: '#151515', logo: 'rotary', logoSize: 21, cost: 1.4,
      algo: 'chain',
      opts: { chain: [{ prefix: 'r', algo: 'rotary', params: { drive: 0.1, accel: 0.4 } }, { prefix: 'v', algo: 'reverb', on: false, opts: { mode: 0 }, params: { mode: 0, mix: 0.22, decay: 0.3, size: 0.3 } }] },
      controls: [vk('r.level', 'VOLUME'), vk('r.speed', 'SPEED', { def: 0.3 }), vk('r.mix', 'INTENSITY', { def: 0.8 }), TOG('v.on', 'AMBIENCE', ['OFF', 'ROOM'])],
      desc: 'Rotating speaker chorus. AMBIENCE adds a small room around it.' }),
    T3({ id: 'jhs.3tape', name: 'Trio Tape Delay', ref: 'JHS 3 Series Tape Delay', cat: 'Delay', typeName: 'Tape delay', color: '#f1f0eb', text: '#151515', logo: 'tape delay', logoSize: 17,
      algo: 'delay', opts: { maxMs: 1000, fixedMode: 2 }, fixed: { mode: 2, heads: 4, tone: 0.45, age: 0.4 },
      controls: [vk('mix', 'MIX', { def: 0.35 }), K('time', 'TAPE SPD', { min: 60, max: 1000, def: 360, display: ms, curve: 'log' }), vk('feedback', 'REPEATS', { def: 0.4, max: 1.05 }), TOG('moddepth', 'FLUTTER', ['OFF', 'ON'], { values: [0.05, 0.35] })] }),
    T3({ id: 'jhs.3oilcan', name: 'Trio Oil Drum Delay', ref: 'JHS 3 Series Oil Can Delay', cat: 'Delay', typeName: 'Oil can delay', color: '#f1f0eb', text: '#151515', logo: 'oil drum', logoSize: 19,
      algo: 'delay', opts: { maxMs: 600, fixedMode: 4 }, fixed: { mode: 4, tone: 0.4, modrate: 0.55, age: 0.5 },
      controls: [vk('mix', 'MIX', { def: 0.4 }), K('time', 'SPEED', { min: 40, max: 600, def: 240, display: ms }), vk('feedback', 'FEEDBACK', { def: 0.45, max: 1.05 }), TOG('moddepth', 'MOD', ['LIGHT', 'HEAVY'], { values: [0.3, 0.7] })] }),
    T3({ id: 'jhs.3bitcrush', name: 'Trio Bit Smasher', ref: 'JHS 3 Series Bit Crusher', cat: 'Synth', kind: 'Pedal', typeName: 'Bit crusher', color: '#f1f0eb', text: '#151515', logo: 'bit smash', logoSize: 18,
      algo: 'crusher', controls: [vk('mix', 'MIX', { def: 0.8 }), vk('bits', 'BITS', { def: 0.45 }), vk('rate', 'SAMPLE', { def: 0.35 }), TOG('hard', 'MODE', ['SOFT', 'HARD'], { virtual: true })],
      derive: (p) => (p.hard ? { bits: (p.bits ?? 0.45) * 0.6 } : {}) }),
    T3({ id: 'jhs.3ringmod', name: 'Trio Ring Mod', ref: 'JHS 3 Series Ring Modulator', cat: 'Synth', kind: 'Pedal', typeName: 'Ring modulator', color: '#f1f0eb', text: '#151515', logo: 'ring mod', logoSize: 20,
      algo: 'ringmod', controls: [vk('mix', 'MIX', { def: 0.3 }), vk('freq', 'FREQ', { def: 0.4 }), vk('fine', 'FINE', { def: 0.5 }), TOG('range', 'RANGE', ['LO', 'HI'], { virtual: true })],
      derive: (p) => ({ freq: (p.range ? 0.5 : 0) + (p.freq ?? 0.4) * 0.5 }) }),
  ]);
}
