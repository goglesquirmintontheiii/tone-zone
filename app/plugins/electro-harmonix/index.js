// Built-in Tone Zone plugin: Electro-Harmonix.
// Blocks inspired by Electro-Harmonix gear. Names, logos and artwork are Tone Zone originals; control layouts,
// enclosure shapes and colours follow the real units (see each block's `ref`).
//
// One custom form ("ehx") draws the whole family: folded-steel boxes in several sizes (`box`: nano, xo, big,
// nine, wide; `bw` / `bh` override the size) with big printed graphics. Per-block art lives in `art`
// ({ kind, ink, accent, paper, ... }), the printed logo in `logo` / `logoFont` / `logoSize` / `logoColor` /
// `logoStroke` / `logoSkew`, the sub-line in `sub`. Knob looks: `kstyle` = ehx | muff | nine | dot | chrome.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, def, ten, db, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern } = tz.gfx;

  // ------------------------------------------------------------------ shared SVG defs
  function ensureDefs() {
    if (document.getElementById('ehx-cap')) return;
    const d = document.getElementById('globalDefs');
    if (!d) return;
    const grad = (id, stops, o = {}) => {
      const gr = svg(o.radial ? 'radialGradient' : 'linearGradient', Object.assign({ id }, o.radial ? { cx: o.cx ?? 0.38, cy: o.cy ?? 0.32, r: o.r ?? 0.7 } : { x1: 0, y1: 0, x2: o.h ? 1 : 0, y2: o.h ? 0 : 1 }), d);
      for (const [off, col, op] of stops) svg('stop', { offset: off, 'stop-color': col, 'stop-opacity': op ?? 1 }, gr);
    };
    grad('ehx-cap', [[0, '#4a4a4e'], [0.55, '#1a1a1c'], [1, '#060607']], { radial: true });
    grad('ehx-foldV', [[0, '#fff', 0.34], [0.03, '#fff', 0.06], [0.5, '#fff', 0], [0.965, '#000', 0.05], [1, '#000', 0.38]]);
    grad('ehx-foldH', [[0, '#fff', 0.18], [0.035, '#fff', 0], [0.965, '#000', 0], [1, '#000', 0.26]], { h: true });
    grad('ehx-sheen', [[0, '#fff', 0.16], [0.4, '#fff', 0.02], [1, '#000', 0.12]]);
    grad('ehx-chromeKnob', [[0, '#fafbfc'], [0.45, '#a9aeb5'], [0.7, '#e4e7ea'], [1, '#6e737a']], { radial: true, cx: 0.4, cy: 0.3, r: 0.8 });
    noisePattern(d, 'ehx-speck', 40, 64, [0, 0, 0], 0, 0.16, 0);
  }

  // ------------------------------------------------------------------ geometry helpers
  const f1 = (v) => (+v).toFixed(1);
  const poly = (pts, close) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join(' L') + (close ? ' Z' : '');
  function smooth(pts, close) {
    // Catmull-Rom through the points → cubic béziers
    const n = pts.length;
    const P = (i) => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    const segs = close ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d + (close ? ' Z' : '');
  }
  function star(cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n, rr = i % 2 ? r : R;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return poly(pts, true);
  }
  function spiral(cx, cy, R, turns, dir = 1, a0 = 0) {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = a0 + dir * t * turns * Math.PI * 2, rr = R * (1 - t * 0.82);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return smooth(pts);
  }
  const wavePath = (x0, x1, y, amp, per, ph = 0) => {
    const pts = [];
    for (let x = x0; x <= x1 + 0.01; x += 2) pts.push([x, y + Math.sin(((x - x0) / per) * Math.PI * 2 + ph) * amp]);
    return poly(pts);
  };
  const L = (g, x1, y1, x2, y2, stroke, w = 1, op = 1) => svg('line', { x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2), stroke, 'stroke-width': w, 'stroke-linecap': 'round', opacity: op }, g);
  const outline = (t, col, w) => { t.setAttribute('stroke', col); t.setAttribute('stroke-width', w); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke-linejoin', 'round'); return t; };

  // ------------------------------------------------------------------ printed artwork (one per family member)
  const ART = {
    // NYC / nano style: banner behind the logo and a π medallion
    muff(g, b, a) {
      const cy = b.y + b.h * (a.noPi ? 0.42 : 0.33);
      const bh = Math.min(34, b.h * 0.3);
      svg('rect', { x: b.x + 4, y: cy - bh / 2, width: b.w - 8, height: bh, rx: 3, fill: a.accent }, g);
      svg('rect', { x: b.x + 4, y: cy - bh / 2, width: b.w - 8, height: bh, rx: 3, fill: 'url(#ehx-sheen)' }, g);
      svg('rect', { x: b.x + 4, y: cy - bh / 2 - 4.5, width: b.w - 8, height: 1.8, fill: a.ink }, g);
      svg('rect', { x: b.x + 4, y: cy + bh / 2 + 2.7, width: b.w - 8, height: 1.8, fill: a.ink }, g);
      const subY = cy + bh / 2 + 12;
      if (a.noPi) return { logoY: cy, subY };
      const R = Math.max(8, Math.min(19, (b.y + b.h - subY - 26) / 2)), pc = subY + 15 + R;
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        L(g, b.cx + Math.cos(t) * (R + 5), pc + Math.sin(t) * (R + 5), b.cx + Math.cos(t) * (R + 9), pc + Math.sin(t) * (R + 9), a.ink, 1, 0.55);
      }
      svg('circle', { cx: b.cx, cy: pc, r: R + 2.4, fill: 'none', stroke: a.ink, 'stroke-width': 1 }, g);
      svg('circle', { cx: b.cx, cy: pc, r: R, fill: a.ink }, g);
      label(g, b.cx, pc + 0.5, 'π', { size: R * 1.55, fill: a.pi || a.accent, font: "'Inter', sans-serif", weight: 800 });
      return { logoY: cy, subY };
    },
    // green Russian: big Soviet-era star behind cream stencil letters
    russian(g, b, a) {
      const R = Math.min(b.w * 0.36, b.h * 0.5);
      svg('path', { d: star(b.cx, b.cy, R, R * 0.4), fill: a.accent, stroke: a.ink, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
      svg('path', { d: star(b.cx, b.cy, R * 0.8, R * 0.32), fill: 'none', stroke: a.paper, 'stroke-width': 0.8, opacity: 0.6 }, g);
      for (const y of [b.y + 4, b.y + b.h - 4]) for (let i = 0; i < 3; i++) svg('rect', { x: b.x + 6, y: y + (y < b.cy ? i * 3 : -i * 3) - 0.6, width: b.w - 12, height: 1.2, fill: a.paper, opacity: 0.55 - i * 0.15 }, g);
      return { logoY: b.cy - 6, subY: b.cy + 20 };
    },
    // 1978 op-amp: black box, red double frame with corner hatching
    opamp(g, b, a) {
      const x = b.x + 8, y = b.y + 6, w = b.w - 16, h = b.h - 12;
      svg('rect', { x, y, width: w, height: h, rx: 2, fill: 'none', stroke: a.accent, 'stroke-width': 2 }, g);
      svg('rect', { x: x + 4, y: y + 4, width: w - 8, height: h - 8, rx: 1, fill: 'none', stroke: a.accent, 'stroke-width': 0.7 }, g);
      for (let i = 0; i < 5; i++) {
        L(g, x + 6 + i * 4, y + 6, x + 6, y + 6 + i * 4, a.accent, 0.8, 0.8);
        L(g, x + w - 6 - i * 4, y + h - 6, x + w - 6, y + h - 6 - i * 4, a.accent, 0.8, 0.8);
      }
      return { logoY: b.cy - 8, subY: b.cy + 20 };
    },
    // bass: staff lines and a bass clef
    bass(g, b, a) {
      const cy = b.y + b.h * 0.58;
      for (let i = -2; i <= 2; i++) svg('rect', { x: b.x + 4, y: cy + i * 7 - 0.5, width: b.w - 8, height: 1, fill: a.ink, opacity: 0.35 }, g);
      const x = b.cx - 10, y = b.y + 14;
      svg('circle', { cx: x, cy: y, r: 3.6, fill: a.accent }, g);
      svg('path', { d: `M${x} ${y} C${x - 1} ${y - 12} ${x + 20} ${y - 14} ${x + 21} ${y + 1} C${x + 22} ${y + 13} ${x + 9} ${y + 22} ${x - 5} ${y + 26}`, fill: 'none', stroke: a.accent, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g);
      svg('circle', { cx: x + 28, cy: y - 4, r: 2, fill: a.accent }, g);
      svg('circle', { cx: x + 28, cy: y + 5, r: 2, fill: a.accent }, g);
      return { logoY: cy - 1, subY: cy + 23 };
    },
    // Ram's head: curled horns and a long snout
    ram(g, b, a) {
      const cy = b.y + b.h * 0.33, R = Math.min(17, b.h * 0.22);
      for (const s of [-1, 1]) {
        svg('path', { d: spiral(b.cx + s * (R + 6), cy, R, 1.35, s, s < 0 ? 0 : Math.PI), fill: 'none', stroke: a.ink, 'stroke-width': 4.4, 'stroke-linecap': 'round' }, g);
        svg('path', { d: spiral(b.cx + s * (R + 6), cy, R, 1.35, s, s < 0 ? 0 : Math.PI), fill: 'none', stroke: a.accent, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      }
      svg('path', { d: `M${b.cx - 10} ${cy - 9} Q${b.cx} ${cy - 15} ${b.cx + 10} ${cy - 9} L${b.cx + 6} ${cy + 18} Q${b.cx} ${cy + 24} ${b.cx - 6} ${cy + 18} Z`, fill: a.ink }, g);
      svg('circle', { cx: b.cx - 4.5, cy: cy - 2, r: 1.5, fill: a.accent }, g);
      svg('circle', { cx: b.cx + 4.5, cy: cy - 2, r: 1.5, fill: a.accent }, g);
      return { logoY: b.y + b.h * 0.74, subY: b.y + b.h * 0.74 + 15 };
    },
    // Small Stone: a pebble dropped into still water
    stone(g, b, a) {
      const cy = b.y + b.h * 0.33;
      for (let i = 5; i >= 1; i--) svg('ellipse', { cx: b.cx, cy, rx: i * 11, ry: i * 3.6, fill: 'none', stroke: a.ink, 'stroke-width': 1.2, opacity: 0.85 - i * 0.12 }, g);
      svg('ellipse', { cx: b.cx, cy: cy - 1, rx: 6, ry: 3.6, fill: a.accent }, g);
      svg('ellipse', { cx: b.cx - 1.6, cy: cy - 2.2, rx: 2.4, ry: 1.1, fill: '#fff', opacity: 0.5 }, g);
      return { logoY: b.y + b.h * 0.7, subY: b.y + b.h * 0.7 + 16 };
    },
    // memory delays: fading echoes
    echo(g, b, a) {
      const cy = b.y + (a.top ? b.h * 0.3 : b.h * 0.5);
      let x = b.x + 14;
      const n = a.n || 6;
      for (let i = 0; i < n; i++) {
        const r = Math.max(3, (a.r || 12) * Math.pow(0.8, i));
        svg('circle', { cx: x + r, cy, r, fill: i === 0 ? a.accent : 'none', stroke: a.accent, 'stroke-width': 1.6, opacity: 1 - i * 0.14 }, g);
        x += r * 2 + 3;
      }
      return a.top ? { logoY: b.y + b.h * 0.68, subY: b.y + b.h * 0.68 + 15 } : { logoY: b.y + 14, subY: b.y + b.h - 10 };
    },
    // octave generator: stepped octave bars
    pog(g, b, a) {
      const hs = [0.35, 0.6, 1, 0.6, 0.35], bw = 9, gap = 5, tot = hs.length * bw + (hs.length - 1) * gap;
      const base = b.y + b.h * (a.mid ?? 0.42);
      hs.forEach((h, i) => svg('rect', { x: b.cx - tot / 2 + i * (bw + gap), y: base - h * 26, width: bw, height: h * 26, rx: 1.5, fill: i === 2 ? a.ink : a.accent }, g));
      svg('rect', { x: b.cx - tot / 2 - 4, y: base + 2, width: tot + 8, height: 1.6, fill: a.ink }, g);
      return { logoY: base + 18, subY: base + 34 };
    },
    // Holy Chalice: a gilded cup with rays
    grail(g, b, a) {
      const top = b.y + 6, cx = b.cx, s = Math.min(1, b.h / 100);
      for (let i = 0; i < 15; i++) {
        const t = Math.PI + (i / 14) * Math.PI;
        L(g, cx + Math.cos(t) * 26 * s, top + 20 * s + Math.sin(t) * 26 * s, cx + Math.cos(t) * 40 * s, top + 20 * s + Math.sin(t) * 40 * s, a.accent, 1.2, 0.7);
      }
      const y0 = top + 8 * s;
      const cup = `M${cx - 18 * s} ${y0} Q${cx - 18 * s} ${y0 + 20 * s} ${cx - 3 * s} ${y0 + 25 * s} L${cx - 2.5 * s} ${y0 + 33 * s} Q${cx - 12 * s} ${y0 + 36 * s} ${cx - 13 * s} ${y0 + 40 * s} L${cx + 13 * s} ${y0 + 40 * s} Q${cx + 12 * s} ${y0 + 36 * s} ${cx + 2.5 * s} ${y0 + 33 * s} L${cx + 3 * s} ${y0 + 25 * s} Q${cx + 18 * s} ${y0 + 20 * s} ${cx + 18 * s} ${y0} Z`;
      svg('path', { d: cup, fill: a.accent, stroke: a.ink, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
      svg('path', { d: `M${cx - 14 * s} ${y0 + 3 * s} Q${cx - 13 * s} ${y0 + 15 * s} ${cx - 4 * s} ${y0 + 19 * s}`, fill: 'none', stroke: '#fff', 'stroke-width': 1.4, opacity: 0.55 }, g);
      svg('path', { d: star(cx, y0 + 11 * s, 4.5 * s, 2 * s, 4), fill: a.ink, opacity: 0.8 }, g);
      return { logoY: y0 + 40 * s + 12 };
    },
    // soul food: rising sun of rays
    food(g, b, a) {
      const cy = b.y + b.h * 0.46;
      for (let i = 0; i < 19; i++) {
        const t = Math.PI + (i / 18) * Math.PI;
        svg('path', { d: poly([[b.cx, cy], [b.cx + Math.cos(t - 0.05) * 70, cy + Math.sin(t - 0.05) * 70], [b.cx + Math.cos(t + 0.05) * 70, cy + Math.sin(t + 0.05) * 70]], true), fill: a.accent, opacity: i % 2 ? 0.35 : 0.7 }, g);
      }
      svg('path', { d: `M${b.cx - 13} ${cy} A13 13 0 0 1 ${b.cx + 13} ${cy} Z`, fill: a.ink }, g);
      svg('rect', { x: b.x + 6, y: cy, width: b.w - 12, height: 1.6, fill: a.ink }, g);
      return { logoY: cy + 17, subY: cy + 33 };
    },
    // flanger comb: crossing sine waves
    comb(g, b, a) {
      const cy = b.y + b.h * 0.3;
      for (let i = 0; i < 4; i++) svg('path', { d: wavePath(b.x + 6, b.x + b.w - 6, cy, 9 - i * 1.4, 34 + i * 6, i * 0.9), fill: 'none', stroke: i % 2 ? a.ink : a.accent, 'stroke-width': 1.6, opacity: 0.9 - i * 0.15 }, g);
      return { logoY: b.y + b.h * 0.68, subY: b.y + b.h * 0.68 + 16 };
    },
    // freeze: snowflake
    snow(g, b, a) {
      const cy = b.y + b.h * 0.32, R = Math.min(24, b.h * 0.27);
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2 - Math.PI / 2, c = Math.cos(t), s = Math.sin(t);
        L(g, b.cx, cy, b.cx + c * R, cy + s * R, a.accent, 2.2);
        for (const f of [0.45, 0.72]) {
          const bx = b.cx + c * R * f, by = cy + s * R * f, l = R * (0.42 - f * 0.25);
          for (const d of [-0.9, 0.9]) L(g, bx, by, bx + Math.cos(t + d) * l, by + Math.sin(t + d) * l, a.accent, 1.6);
        }
      }
      svg('circle', { cx: b.cx, cy, r: 3, fill: a.ink }, g);
      return { logoY: b.y + b.h * 0.74, subY: b.y + b.h * 0.74 + 15 };
    },
    // superego: orbiting sparkles
    cosmos(g, b, a) {
      const cy = b.y + b.h * 0.34;
      svg('ellipse', { cx: b.cx, cy, rx: b.w * 0.36, ry: 11, fill: 'none', stroke: a.accent, 'stroke-width': 1.2, opacity: 0.8, transform: `rotate(-12 ${b.cx} ${cy})` }, g);
      svg('circle', { cx: b.cx, cy, r: 10, fill: a.accent }, g);
      svg('circle', { cx: b.cx - 3, cy: cy - 3, r: 3.5, fill: '#fff', opacity: 0.35 }, g);
      [[-0.38, -0.5, 6], [0.4, -0.3, 4.5], [0.3, 0.55, 3.5], [-0.25, 0.6, 3], [0.05, -0.85, 3]].forEach(([dx, dy, r]) => svg('path', { d: star(b.cx + dx * b.w, cy + dy * 24, r, r * 0.25, 4), fill: a.ink }, g));
      return { logoY: b.y + b.h * 0.74, subY: b.y + b.h * 0.74 + 15 };
    },
    // canyon: layered mesas under a sun
    canyon(g, b, a) {
      const base = b.y + b.h * 0.45;
      svg('circle', { cx: b.cx + 22, cy: base - 26, r: 9, fill: a.sun || '#f4d06b' }, g);
      const layers = [
        [[0, 18], [0.18, 4], [0.32, 4], [0.4, 12], [0.62, 12], [0.7, 0], [0.86, 0], [1, 14]],
        [[0, 24], [0.12, 14], [0.3, 14], [0.42, 22], [0.58, 22], [0.66, 8], [0.8, 8], [0.92, 20], [1, 20]],
      ];
      layers.forEach((pts, i) => svg('path', { d: poly([[b.x - 8, base + 2], ...pts.map(([fx, fy]) => [b.x + fx * b.w, base - 26 + fy + i * 6]), [b.x + b.w + 8, base + 2]], true), fill: i ? a.ink : a.accent, opacity: i ? 0.9 : 1 }, g));
      svg('rect', { x: b.x + 4, y: base + 2, width: b.w - 8, height: 1.4, fill: a.ink }, g);
      return { logoY: base + 18, subY: base + 33 };
    },
    // tuning fork with vibration arcs
    fork(g, b, a) {
      const cy = b.y + b.h * 0.3, cx = b.cx;
      svg('path', { d: `M${cx - 9} ${cy - 22} L${cx - 9} ${cy + 2} Q${cx - 9} ${cy + 10} ${cx} ${cy + 10} Q${cx + 9} ${cy + 10} ${cx + 9} ${cy + 2} L${cx + 9} ${cy - 22}`, fill: 'none', stroke: a.ink, 'stroke-width': 4.2, 'stroke-linecap': 'round' }, g);
      L(g, cx, cy + 10, cx, cy + 26, a.ink, 4.2);
      for (const s of [-1, 1]) for (let i = 1; i <= 3; i++) svg('path', { d: `M${cx + s * (14 + i * 6)} ${cy - 18} Q${cx + s * (19 + i * 6)} ${cy - 8} ${cx + s * (14 + i * 6)} ${cy + 2}`, fill: 'none', stroke: a.accent, 'stroke-width': 1.5, opacity: 1 - i * 0.22 }, g);
      return { logoY: b.y + b.h * 0.76, subY: b.y + b.h * 0.76 + 14 };
    },
    // chorus clone: twin offset sines
    clone(g, b, a) {
      const cy = b.y + b.h * 0.3;
      svg('path', { d: wavePath(b.x + 8, b.x + b.w - 8, cy, 8, 30), fill: 'none', stroke: a.ink, 'stroke-width': 2.6 }, g);
      svg('path', { d: wavePath(b.x + 8, b.x + b.w - 8, cy + 3, 8, 30, 0.9), fill: 'none', stroke: a.accent, 'stroke-width': 2.6, opacity: 0.85 }, g);
      return { logoY: b.y + b.h * 0.68, subY: b.y + b.h * 0.68 + 15 };
    },
    // hot wax: dripping candles
    wax(g, b, a) {
      const base = b.y + b.h * 0.56;
      (a.candles || [0]).forEach((dx, i) => {
        const cx = b.cx + dx, w = 14, h = 30 - i * 6;
        svg('path', { d: `M${cx - w / 2} ${base} V${base - h} H${cx + w / 2} V${base} Z`, fill: a.paper2 || '#f7efe1', stroke: a.ink, 'stroke-width': 0.9 }, g);
        svg('path', { d: `M${cx - w / 2} ${base - h} H${cx + w / 2} V${base - h + 6} Q${cx + 4} ${base - h + 6} ${cx + 4} ${base - h + 13} Q${cx + 2} ${base - h + 15} ${cx + 1} ${base - h + 6} Q${cx - 2} ${base - h + 6} ${cx - 3} ${base - h + 9} Q${cx - 5} ${base - h + 10} ${cx - w / 2} ${base - h + 6} Z`, fill: a.accent }, g);
        L(g, cx, base - h, cx, base - h - 4, a.ink, 1);
        svg('path', { d: `M${cx} ${base - h - 17} Q${cx + 5} ${base - h - 9} ${cx} ${base - h - 4} Q${cx - 5} ${base - h - 9} ${cx} ${base - h - 17} Z`, fill: '#ffb21a', stroke: '#e0471b', 'stroke-width': 0.8 }, g);
      });
      svg('rect', { x: b.x + 10, y: base, width: b.w - 20, height: 2, rx: 1, fill: a.ink }, g);
      return { logoY: base + 16, subY: base + 31 };
    },
    // crayon scribbles
    crayon(g, b, a) {
      const cols = a.cols || ['#e8462c', '#f2a516', '#2f8fd8', '#7a3fb0'];
      cols.forEach((c, i) => {
        const y = b.y + 10 + i * 7, pts = [];
        for (let k = 0; k <= 9; k++) pts.push([b.x + 10 + k * ((b.w - 20) / 9), y + (k % 2 ? 6 : -2) + Math.sin(k * 1.7 + i) * 1.5]);
        svg('path', { d: smooth(pts), fill: 'none', stroke: c, 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 }, g);
      });
      return { logoY: b.y + b.h * 0.72, subY: b.y + b.h * 0.72 + 15 };
    },
    // oceans: rolling waves
    ocean(g, b, a) {
      const base = b.y + b.h * 0.42;
      for (let i = 0; i < 4; i++) {
        const y = base - 18 + i * 7, pts = [[b.x - 8, base + 8]];
        for (let x = b.x; x <= b.x + b.w + 0.1; x += 3) pts.push([x, y + Math.sin((x - b.x) / 11 + i * 1.3) * 2.6]);
        pts.push([b.x + b.w + 8, base + 8]);
        svg('path', { d: poly(pts, true), fill: i % 2 ? a.ink : a.accent, opacity: 0.35 + i * 0.16 }, g);
      }
      return { logoY: base + 21, subY: base + 35 };
    },
    // 9-series keyboard strip
    keys(g, b, a) {
      const n = 14, kw = (b.w - 12) / n, y = b.y + 2, h = a.kh || 18;
      for (let i = 0; i < n; i++) svg('rect', { x: b.x + 6 + i * kw, y, width: kw - 0.8, height: h, rx: 0.8, fill: a.paper2 || '#f4f1e8' }, g);
      for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) svg('rect', { x: b.x + 6 + (i + 1) * kw - kw * 0.3, y, width: kw * 0.6, height: h * 0.6, rx: 0.6, fill: a.ink }, g);
      return { logoY: y + h + 16, subY: y + h + 31 };
    },
    // synth waveform strip
    synthwave(g, b, a) {
      const y = b.y + 12, x0 = b.x + 8, x1 = b.x + b.w - 8, seg = (x1 - x0) / 4;
      const pts = [[x0, y + 8], [x0 + seg * 0.9, y - 8], [x0 + seg, y + 8], [x0 + seg * 1.5, y + 8], [x0 + seg * 1.5, y - 8], [x0 + seg * 2, y - 8], [x0 + seg * 2, y + 8]];
      svg('path', { d: poly(pts), fill: 'none', stroke: a.accent, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      svg('path', { d: wavePath(x0 + seg * 2, x1, y, 8, seg, Math.PI / 2), fill: 'none', stroke: a.ink2 || a.accent, 'stroke-width': 2 }, g);
      return { logoY: y + 30, subY: y + 45 };
    },
    // envelope filter: picking envelopes
    env(g, b, a) {
      const y = b.y + b.h * 0.36, x0 = b.x + 10, x1 = b.x + b.w - 10, n = 3, sw = (x1 - x0) / n, pts = [];
      for (let i = 0; i < n; i++) for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([x0 + i * sw + t * sw, y + 12 - 26 * (t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 4.5))]); }
      svg('path', { d: poly([[x0, y + 12], ...pts, [x1, y + 12]], true), fill: a.accent, opacity: 0.85 }, g);
      svg('path', { d: poly(pts), fill: 'none', stroke: a.ink, 'stroke-width': 1.4 }, g);
      L(g, x0 - 2, y + 12.5, x1 + 2, y + 12.5, a.ink, 1.4);
      return { logoY: y + 27, subY: y + 42 };
    },
    // booster: rising bars
    rise(g, b, a) {
      const base = b.y + b.h * 0.42;
      for (let i = 0; i < 7; i++) svg('rect', { x: b.cx - 34 + i * 10, y: base - 6 - i * 4, width: 7, height: 6 + i * 4, rx: 1, fill: i === 6 ? a.accent : a.ink, opacity: 0.4 + i * 0.1 }, g);
      return { logoY: base + 20, subY: base + 36 };
    },
    // cock fight: rooster head
    rooster(g, b, a) {
      const cx = b.cx - 4, cy = b.y + b.h * 0.34;
      svg('path', { d: `M${cx - 10} ${cy - 10} Q${cx - 14} ${cy - 22} ${cx - 6} ${cy - 21} Q${cx - 4} ${cy - 30} ${cx + 3} ${cy - 24} Q${cx + 9} ${cy - 30} ${cx + 11} ${cy - 20} Q${cx + 17} ${cy - 20} ${cx + 13} ${cy - 10} Z`, fill: a.accent }, g);
      svg('path', { d: `M${cx - 12} ${cy + 22} Q${cx - 16} ${cy - 4} ${cx} ${cy - 12} Q${cx + 14} ${cy - 12} ${cx + 15} ${cy} L${cx + 26} ${cy + 3} L${cx + 15} ${cy + 7} Q${cx + 12} ${cy + 16} ${cx + 4} ${cy + 22} Z`, fill: a.ink }, g);
      svg('path', { d: `M${cx + 12} ${cy + 8} Q${cx + 16} ${cy + 18} ${cx + 9} ${cy + 20} Q${cx + 6} ${cy + 14} ${cx + 9} ${cy + 8} Z`, fill: a.accent }, g);
      svg('circle', { cx: cx + 7, cy: cy - 3, r: 2.2, fill: a.paper }, g);
      svg('circle', { cx: cx + 7.6, cy: cy - 3, r: 1, fill: a.ink }, g);
      for (let i = 0; i < 4; i++) L(g, cx - 22 - i * 3, cy - 10 + i * 9, cx - 14, cy - 6 + i * 7, a.accent, 1.4, 0.7);
      return { logoY: b.y + b.h * 0.76, subY: b.y + b.h * 0.76 + 14 };
    },
    // rotary: drum + spinning horn
    rotor(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.38;
      svg('circle', { cx, cy, r: 20, fill: 'none', stroke: a.ink, 'stroke-width': 1.4 }, g);
      for (let i = 0; i < 3; i++) svg('path', { d: `M${cx + 24 + i * 5} ${cy - 12 + i} A ${26 + i * 5} ${26 + i * 5} 0 0 1 ${cx + 24 + i * 5} ${cy + 12 - i}`, fill: 'none', stroke: a.accent, 'stroke-width': 1.3, opacity: 1 - i * 0.25 }, g);
      const hg = svg('g', { transform: `rotate(-24 ${cx} ${cy})` }, g);
      svg('path', { d: `M${cx - 30} ${cy - 3} L${cx - 4} ${cy - 1.5} L${cx - 4} ${cy + 1.5} L${cx - 30} ${cy + 3} L${cx - 34} ${cy + 8} L${cx - 34} ${cy - 8} Z`, fill: a.accent }, hg);
      svg('path', { d: `M${cx + 30} ${cy - 3} L${cx + 4} ${cy - 1.5} L${cx + 4} ${cy + 1.5} L${cx + 30} ${cy + 3} L${cx + 34} ${cy + 8} L${cx + 34} ${cy - 8} Z`, fill: a.accent }, hg);
      svg('circle', { cx, cy, r: 5, fill: a.ink }, g);
      return { logoY: cy + 34, subY: cy + 49 };
    },
    // graphic EQ grid backdrop
    grid(g, b, a) {
      for (let i = 0; i <= 6; i++) svg('rect', { x: b.x + 6, y: b.y + i * (b.h / 6.5), width: b.w - 12, height: 0.7, fill: a.ink, opacity: 0.22 }, g);
      return { logoY: b.cy, subY: b.cy + 16 };
    },
    // platform: stacked plinth
    platform(g, b, a) {
      const cy = b.y + b.h * 0.34;
      [[0.7, 8], [0.52, 7], [0.34, 6]].forEach(([fw, h], i) => svg('rect', { x: b.cx - (b.w * fw) / 2, y: cy + 8 - i * 9, width: b.w * fw, height: h, rx: 2, fill: i === 2 ? a.accent : a.ink, opacity: 1 - i * 0.12 }, g));
      return { logoY: b.y + b.h * 0.72, subY: b.y + b.h * 0.72 + 15 };
    },
    // triangle frame (the knobs of the 1970s Triangle sit inside it)
    tri(g, b, a) {
      const top = a.ty ?? 14, bot = a.by ?? 104;
      svg('path', { d: poly([[b.cx, top], [b.x + b.w - 8, bot], [b.x + 8, bot]], true), fill: 'none', stroke: a.accent, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
      return { logoY: b.y + b.h * 0.5, subY: b.y + b.h * 0.5 + 16 };
    },
    // bird in flight with a sound burst
    bird(g, b, a) {
      const cx = b.cx, cy = b.y + b.h * 0.3;
      svg('path', { d: `M${cx - 30} ${cy} Q${cx - 16} ${cy - 16} ${cx} ${cy + 2} Q${cx + 16} ${cy - 16} ${cx + 30} ${cy} Q${cx + 14} ${cy - 6} ${cx} ${cy + 8} Q${cx - 14} ${cy - 6} ${cx - 30} ${cy} Z`, fill: a.accent }, g);
      for (let i = 0; i < 3; i++) svg('path', { d: `M${cx - 8 - i * 5} ${cy + 14 + i * 4} Q${cx} ${cy + 18 + i * 5} ${cx + 8 + i * 5} ${cy + 14 + i * 4}`, fill: 'none', stroke: a.ink, 'stroke-width': 1.3, opacity: 0.9 - i * 0.25 }, g);
      return { logoY: b.y + b.h * 0.72, subY: b.y + b.h * 0.72 + 15 };
    },
    // tape reels joined by the tape
    reels(g, b, a) {
      const cy = b.y + b.h * 0.3, d = Math.min(26, b.w * 0.22), R = Math.min(15, b.h * 0.2);
      for (const s of [-1, 1]) {
        svg('circle', { cx: b.cx + s * d, cy, r: R, fill: a.accent, stroke: a.ink, 'stroke-width': 1.2 }, g);
        svg('circle', { cx: b.cx + s * d, cy, r: R * 0.28, fill: a.ink }, g);
        for (let i = 0; i < 3; i++) { const t = (i / 3) * Math.PI * 2; svg('circle', { cx: b.cx + s * d + Math.cos(t) * R * 0.6, cy: cy + Math.sin(t) * R * 0.6, r: R * 0.17, fill: a.ink }, g); }
      }
      L(g, b.cx - d, cy + R, b.cx + d, cy + R, a.ink, 1.4);
      return { logoY: b.y + b.h * 0.74, subY: b.y + b.h * 0.74 + 14 };
    },
    // suspension bridge
    bridge(g, b, a) {
      const base = b.y + b.h * 0.42, x0 = b.x + 6, x1 = b.x + b.w - 6, t1 = x0 + (x1 - x0) * 0.25, t2 = x0 + (x1 - x0) * 0.75;
      svg('rect', { x: x0, y: base, width: x1 - x0, height: 2.2, fill: a.ink }, g);
      for (const t of [t1, t2]) svg('rect', { x: t - 2, y: base - 26, width: 4, height: 28, fill: a.ink }, g);
      svg('path', { d: `M${x0} ${base - 14} Q${(x0 + t1) / 2} ${base - 4} ${t1} ${base - 26} Q${b.cx} ${base} ${t2} ${base - 26} Q${(t2 + x1) / 2} ${base - 4} ${x1} ${base - 14}`, fill: 'none', stroke: a.accent, 'stroke-width': 1.8 }, g);
      return { logoY: base + 17, subY: base + 31 };
    },
    // square and triangle waves
    pulse(g, b, a) {
      const y = b.y + b.h * 0.3, x0 = b.x + 10, x1 = b.x + b.w - 10, s = (x1 - x0) / 4;
      svg('path', { d: poly([[x0, y + 8], [x0, y - 8], [x0 + s, y - 8], [x0 + s, y + 8], [x0 + 2 * s, y + 8], [x0 + 2 * s, y - 8]]), fill: 'none', stroke: a.accent, 'stroke-width': 2 }, g);
      svg('path', { d: poly([[x0 + 2 * s, y - 8], [x0 + 2.5 * s, y + 8], [x0 + 3 * s, y - 8], [x0 + 3.5 * s, y + 8], [x1, y - 8]]), fill: 'none', stroke: a.ink, 'stroke-width': 2 }, g);
      return { logoY: b.y + b.h * 0.7, subY: b.y + b.h * 0.7 + 15 };
    },
    // gothic window
    arch(g, b, a) {
      const cx = b.cx, top = b.y + 4, w2 = Math.min(26, b.w * 0.2), base = b.y + b.h * 0.56;
      svg('path', { d: `M${cx - w2} ${base} V${top + w2} Q${cx - w2} ${top} ${cx} ${top - 2} Q${cx + w2} ${top} ${cx + w2} ${top + w2} V${base} Z`, fill: a.accent, stroke: a.ink, 'stroke-width': 1.4 }, g);
      L(g, cx, top + 6, cx, base, a.ink, 1.2);
      L(g, cx - w2, top + w2 + 8, cx + w2, top + w2 + 8, a.ink, 1.2);
      svg('circle', { cx, cy: top + w2 * 0.6, r: w2 * 0.35, fill: 'none', stroke: a.ink, 'stroke-width': 1.2 }, g);
      return { logoY: base + 16, subY: base + 31 };
    },
    // swirl for vibes
    swirl(g, b, a) {
      const cy = b.y + b.h * 0.32, R = Math.min(22, b.h * 0.26);
      svg('path', { d: spiral(b.cx, cy, R, 2.2, 1), fill: 'none', stroke: a.accent, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      svg('path', { d: spiral(b.cx, cy, R * 0.86, 2.2, 1, Math.PI), fill: 'none', stroke: a.ink, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
      return { logoY: b.y + b.h * 0.74, subY: b.y + b.h * 0.74 + 15 };
    },
  };

  // ------------------------------------------------------------------ knob styles (drawn into the rotating group)
  const KNOB = {
    ehx(rot, r) {
      svg('circle', { r, fill: '#121213' }, rot);
      svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': 1.5, 'stroke-dasharray': '0.8 1.1', opacity: 0.8 }, rot);
      svg('circle', { r: r * 0.74, fill: 'url(#ehx-cap)' }, rot);
      svg('line', { x1: 0, y1: -r * 0.18, x2: 0, y2: -r * 0.96, stroke: '#f6f6f6', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, rot);
    },
    muff(rot, r) {
      svg('circle', { r, fill: '#0f0f10' }, rot);
      svg('circle', { r: r - 0.6, fill: 'none', stroke: '#2b2b2e', 'stroke-width': 1.8, 'stroke-dasharray': '1 1.2' }, rot);
      svg('circle', { r: r * 0.7, fill: 'url(#ehx-chromeKnob)' }, rot);
      svg('circle', { r: r * 0.7, fill: 'none', stroke: '#000', 'stroke-width': 0.6, opacity: 0.6 }, rot);
      svg('line', { x1: 0, y1: -r * 0.12, x2: 0, y2: -r * 0.66, stroke: '#111', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, rot);
      svg('line', { x1: 0, y1: -r * 0.74, x2: 0, y2: -r * 0.97, stroke: '#f2f2f2', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, rot);
    },
    nine(rot, r) {
      svg('circle', { r, fill: 'url(#ehx-chromeKnob)' }, rot);
      svg('circle', { r: r - 0.6, fill: 'none', stroke: '#000', 'stroke-width': 1.4, 'stroke-dasharray': '0.7 1', opacity: 0.45 }, rot);
      svg('circle', { r: r * 0.7, fill: '#141416' }, rot);
      svg('circle', { r: r * 0.7, fill: 'url(#ehx-cap)', opacity: 0.7 }, rot);
      svg('line', { x1: 0, y1: -r * 0.1, x2: 0, y2: -r * 0.66, stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, rot);
      svg('line', { x1: 0, y1: -r * 0.72, x2: 0, y2: -r, stroke: '#111', 'stroke-width': 1.4 }, rot);
    },
    dot(rot, r) {
      svg('circle', { r, fill: '#141415' }, rot);
      svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-dasharray': '0.9 1', opacity: 0.8 }, rot);
      svg('circle', { r: r * 0.78, fill: 'url(#ehx-cap)' }, rot);
      svg('circle', { cy: -r * 0.58, r: Math.max(1.2, r * 0.13), fill: '#f4f4f4' }, rot);
    },
    chrome(rot, r) {
      svg('circle', { r, fill: 'url(#ehx-chromeKnob)' }, rot);
      svg('circle', { r: r - 0.7, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-dasharray': '0.6 0.9', opacity: 0.4 }, rot);
      svg('circle', { r: r * 0.62, fill: 'url(#ehx-chromeKnob)' }, rot);
      svg('line', { x1: 0, y1: -r * 0.2, x2: 0, y2: -r * 0.94, stroke: '#151515', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, rot);
    },
  };
  function restyleKnobs(ctx, d) {
    for (const [, { ctl, view }] of ctx.views) {
      if (ctl.t !== 'knob' && ctl.t !== 'sel') continue;
      const fn = KNOB[ctl.kstyle || d.kstyle || 'ehx'];
      const rot = view.g && view.g.querySelector('.knob-rot');
      if (!fn || !rot) continue;
      while (rot.firstChild) rot.removeChild(rot.firstChild);
      fn(rot, ctl.r || 12);
    }
  }

  // ------------------------------------------------------------------ the enclosure
  const BOX = {
    nano: { w: 140, h: 236, rx: 5 },
    xo: { w: 176, h: 236, rx: 6 },
    big: { w: 236, h: 320, rx: 7 },
    nine: { w: 192, h: 256, rx: 6 },
    wide: { w: 290, h: 236, rx: 7 },
    pico: { w: 112, h: 258, rx: 5 },
  };
  let seq = 0;
  function steel(g, w, h, col, rx) {
    softShadow(g, { w, h, rx, dy: 14, blur: 9, opacity: 0.6 });
    svg('rect', { width: w, height: h, rx, fill: col }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#p-grain)' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#ehx-speck)', opacity: 0.5 }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#ehx-foldV)' }, g);
    svg('rect', { width: w, height: h, rx, fill: 'url(#ehx-foldH)' }, g);
    svg('rect', { x: 0.7, y: 0.7, width: w - 1.4, height: h - 1.4, rx: rx - 0.4, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.2, 'stroke-width': 1.1 }, g);
    svg('rect', { width: w, height: h, rx, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 0.8 }, g);
  }
  function autoRow(list, x0, x1, y) {
    const n = list.length;
    list.forEach((c, i) => {
      if (c.x === undefined) c.x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
      if (c.y === undefined) c.y = y;
    });
  }
  // auto layout: rows of knobs (labels below, EHX style), a toggle row, LED + stomp at the bottom
  function layout(d, w, h, box) {
    const C = d.controls;
    C.forEach((c) => { if ((c.t === 'knob' || c.t === 'sel') && !c.labelPos) c.labelPos = 'below'; });
    const knobs = C.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
    const n = knobs.length;
    const big = box === 'big';
    const rows = d.rows || (box === 'pico' ? (n <= 2 ? [n] : [2, n - 2]) : n <= (box === 'nano' ? 3 : 4) ? [n] : n === 4 ? [2, 2] : [Math.ceil(n / 2), Math.floor(n / 2)]);
    const pico = box === 'pico';
    const r0 = d.kr || (big ? 17 : pico ? 9.5 : n === 1 ? 14 : rows[0] >= 4 ? 10.5 : rows[0] === 3 ? 11.5 : 13);
    const ys = big ? [52, 104] : pico ? [40, 80] : [30, 76];
    let k = 0, bottom = 8;
    rows.forEach((cnt, ri) => {
      const row = knobs.slice(k, k + cnt);
      k += cnt;
      const m = cnt === 1 ? w / 2 : cnt === 2 ? w * 0.27 : big ? 46 : 26;
      autoRow(row, m, cnt === 1 ? w / 2 : w - m, ys[ri] ?? ys[0] + ri * 46);
      row.forEach((c) => (c.r = c.r || r0));
    });
    for (const c of C) if ((c.t === 'knob' || c.t === 'sel') && c.y !== undefined) bottom = Math.max(bottom, c.y + (c.r || 12) + 15);
    const tg = C.filter((c) => (c.t === 'toggle' || c.t === 'button') && c.x === undefined);
    if (tg.length) {
      const ty = bottom + 19;
      tg.forEach((t, i) => {
        t.x = tg.length === 1 ? w / 2 : w * (0.5 + (i - (tg.length - 1) / 2) * (0.6 / tg.length));
        t.y = ty;
        if (t.t === 'toggle') t.orient = t.orient || 'h';
      });
    }
    for (const c of C) {
      if ((c.t === 'toggle') && c.y !== undefined) bottom = Math.max(bottom, c.y + 16);
      if ((c.t === 'button') && c.y !== undefined) bottom = Math.max(bottom, c.y + 14);
      if (c.t === 'slider' && c.y !== undefined) bottom = Math.max(bottom, c.y + (c.h || 44) / 2 + 12);
    }
    const foots = C.filter((c) => c.t === 'foot' && c.x === undefined);
    const fy = big ? h - 32 : h - 24;
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', r: big ? 14 : 12, y: fy, x: foots.length === 1 ? w / 2 : [w * 0.27, w * 0.73][i] }));
    const leds = C.filter((c) => c.t === 'led' && c.x === undefined);
    leds.forEach((l, i) => Object.assign(l, { r: big ? 3.4 : 3, y: big ? h - 62 : h - 50, x: leds.length === 1 ? w / 2 : [w * 0.27, w * 0.73][i] }));
    const top = d.artTop ?? bottom + 2;
    const bot = d.artBottom ?? (big ? h - 74 : box === 'pico' ? h - 66 : h - 58);
    return { x: 6, y: top, w: w - 12, h: bot - top, cx: w / 2, cy: (top + bot) / 2 };
  }
  function drawLogo(g, d, w, band, hint, txt) {
    const lines = String(d.logo || '').split('\n').filter(Boolean);
    const size = d.logoSize || 22, lh = size * (d.logoLh || 0.92);
    const cx = d.logoX ?? w / 2;
    const ly = d.logoY ?? hint.logoY ?? band.cy;
    const y0 = ly - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      const y = y0 + i * lh;
      const t = label(g, cx, y, ln, { size: i && d.logoSize2 ? d.logoSize2 : size, fill: d.logoColor || txt, font: d.logoFont || "'Oswald', sans-serif", weight: d.logoWeight || 700, ls: d.logoLs ?? 0.4, italic: d.logoItalic });
      if (d.logoStroke) outline(t, d.logoStroke, d.logoStrokeW || 2.6);
      if (d.logoSkew) t.setAttribute('transform', `translate(${cx},${y}) skewX(${d.logoSkew}) translate(${-cx},${-y})`);
    });
    const last = y0 + (lines.length - 1) * lh;
    const sy = d.subY ?? Math.max(hint.subY ?? 0, last + size * (d.logoFont && d.logoFont.includes('Dancing') ? 0.72 : 0.62) + 4);
    if (d.sub) {
      const t = label(g, cx, sy, d.sub, { size: d.subSize || 6.4, fill: d.subColor || txt, font: d.subFont || "'Barlow Condensed', sans-serif", weight: 700, ls: d.subLs ?? 1.4, italic: d.subItalic });
      if (d.subStroke) outline(t, d.subStroke, 1.6);
    }
    return sy;
  }

  tz.addForm('ehx', (ctx, d) => {
    ensureDefs();
    const box = d.box || 'nano', B = BOX[box];
    const w = d.bw || B.w, h = d.bh || B.h, g = ctx.g;
    const txt = d.text || '#151515';
    steel(g, w, h, d.color, B.rx);
    if (d.panels) for (const p of d.panels) svg('rect', Object.assign({ rx: 2 }, p), g);
    const band = layout(d, w, h, box);
    const clipId = 'ehxclip' + ++seq;
    const cp = svg('clipPath', { id: clipId }, g);
    svg('rect', { x: 2, y: 2, width: w - 4, height: h - 4, rx: B.rx }, cp);
    const art = svg('g', { 'clip-path': `url(#${clipId})` }, g);
    const a = Object.assign({ ink: txt, accent: '#d6262c', paper: d.color }, d.art || {});
    const hint = (d.art && ART[d.art.kind] && ART[d.art.kind](art, band, a, d)) || {};
    const sy = drawLogo(g, d, w, band, hint, txt);
    void sy;
    if (box === 'wide') formKit.tzBadge(g, w / 2, h - 9, d.badgeColor || txt, 4.4);
    else formKit.tzBadge(g, 12, h - 11, d.badgeColor || txt, 4.2).setAttribute('text-anchor', 'start');
    const theme = { text: txt, labelFont: d.labelFont || "'Barlow Condensed', sans-serif", labelSize: d.labelSize || 7, labelLs: 0.7, knob: 'mxr', jackText: txt };
    formKit.placeControls(ctx, d.controls, theme);
    restyleKnobs(ctx, d);
    const jacks = d.jacksTop || box === 'nine' || box === 'pico' ?formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: d.jackY ?? (box === 'big' ? 130 : 112), gap: 30 });
    return { w, h, theme, jacks };
  });

  // ------------------------------------------------------------------ freeze footswitch behaviour (momentary / latch)
  const send = (b, type) => tz.engine.send({ cmd: 'event', id: b.id, type, value: type === 1 ? 1 : 0, arg: 0 });
  tz.blockHooks('ehx.freeze', {
    foot(view, ctl, down) {
      if (ctl.t !== 'foot') return false;
      const m = view.block.params.fmode ?? 2; // 0 fast, 1 slow (momentary), 2 latch
      if (m === 2) { if (down) send(view.block, 1); }
      else send(view.block, down ? 1 : 2);
      return true;
    },
  });
  const egoHook = {
    foot(view, ctl, down) {
      if (ctl.t !== 'foot') return false;
      const m = view.block.params.smode ?? 0; // 0 latch, 1 momentary, 2 auto (switch = bypass)
      if (m === 2 || view.block.bypass) return false;
      if (m === 0) { if (down) send(view.block, 1); }
      else send(view.block, down ? 1 : 2);
      return true;
    },
  };
  tz.blockHooks('ehx.superego', egoHook);
  tz.blockHooks('ehx.picofreeze', egoHook);

  // ------------------------------------------------------------------ blocks
  const E = (o) => def(Object.assign({ form: 'ehx', brand: 'Electro-Harmonix' }, o, { controls: [...(o.controls || []), ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])] }));
  const muffV = (o = {}) => Object.assign({ clip: 'muff', stages: 2, stage2Db: 18, preHp: 80, gainMinDb: 20, gainMaxDb: 52, tone: 'blend', blendLp: 450, blendHp: 1100, postLp: 9000, levelMaxDb: -1 }, o);
  const muffKnobs = (vol = 'VOLUME', tn = 'TONE', sus = 'SUSTAIN') => [K('level', vol, { display: ten, def: 0.5 }), K('tone', tn, { display: ten }), K('gain', sus, { display: ten, def: 0.6 })];
  const st = (v) => (v > 0 ? '+' : '') + Math.round(v) + ' st';

  tz.addDefs([
    // ---------------------------------------------------------------- the Murk π family
    E({
      id: 'ehx.bigmuff', name: 'Big Murk π', ref: 'Electro-Harmonix Big Muff Pi (NYC)', cat: 'Fuzz', typeName: 'Distortion / sustainer',
      box: 'big', color: '#dcdcd7', text: '#141414', kstyle: 'muff',
      art: { kind: 'muff', accent: '#c8161d', ink: '#141414', pi: '#f2f2ee' },
      logo: 'BIG MURK', logoSize: 36, logoColor: '#f6f4ee', logoStroke: '#141414', logoStrokeW: 3.2, logoFont: "'Oswald', sans-serif", logoLs: 1.4,
      sub: 'DISTORTION / SUSTAINER', subSize: 8, subLs: 2.4,
      algo: 'drive', opts: muffV({ modes: [{}, { tone: 'none', postLp: 7000, levelMaxDb: 2 }] }),
      controls: [...muffKnobs(), TOG('mode', '', ['TONE', 'BYPASS'], { x: 118, y: 100, orient: 'h' })],
      desc: 'Classic three-knob sustainer. TONE BYPASS takes the tone stack out for a fatter, mid-heavy roar.',
    }),
    E({
      id: 'ehx.greenmuff', name: 'Tundra Murk π', ref: 'Electro-Harmonix Green Russian Big Muff', cat: 'Fuzz', typeName: 'Sustaining fuzz',
      box: 'big', color: '#3d5f3c', text: '#ece3c4', kstyle: 'ehx',
      art: { kind: 'russian', accent: '#9b2a1f', ink: '#1d2a1a', paper: '#ece3c4' },
      logo: 'TUNDRA\nMURK π', logoSize: 30, logoColor: '#ece3c4', logoStroke: '#1d2a1a', logoStrokeW: 3, logoFont: "'Oswald', sans-serif", logoLs: 3,
      sub: 'СУСТЕЙН · SUSTAINER', subColor: '#ece3c4', subStroke: '#1d2a1a', subSize: 7.4, subY: 214,
      algo: 'drive', opts: muffV({ blendLp: 380, blendHp: 950, gainMaxDb: 50, postLp: 7200, preHp: 60, levelMaxDb: 0 }),
      controls: muffKnobs(),
    }),
    E({
      id: 'ehx.opamp', name: 'Op-Amp Murk π', ref: 'Electro-Harmonix Op-Amp Big Muff Pi', cat: 'Fuzz', typeName: 'Op-amp fuzz',
      box: 'big', color: '#181818', text: '#e8302a', kstyle: 'ehx',
      art: { kind: 'opamp', accent: '#e8302a' },
      logo: 'OP-AMP\nMURK π', logoSize: 31, logoLh: 1, logoColor: '#e8302a', logoFont: "'Oswald', sans-serif", logoLs: 2, logoSkew: -8,
      sub: 'DISTORTION / SUSTAINER', subSize: 7.6, subLs: 2.2, subY: 218,
      algo: 'drive', opts: muffV({ clip: 'diode', slew: 0.3, stages: 2, stage2Db: 14, gainMinDb: 18, gainMaxDb: 50, blendLp: 620, blendHp: 1350, postLp: 8000, modes: [{}, { tone: 'none', postLp: 6500, levelMaxDb: 2 }] }),
      controls: [...muffKnobs(), TOG('mode', '', ['TONE', 'BYPASS'], { x: 118, y: 100, orient: 'h' })],
    }),
    E({
      id: 'ehx.bassmuff', name: 'Bass Murk π', ref: 'Electro-Harmonix Bass Big Muff Pi (nano)', cat: 'Fuzz', typeName: 'Bass distortion / sustainer',
      box: 'nano', color: '#22242c', text: '#e9e9ee', kstyle: 'ehx',
      art: { kind: 'bass', accent: '#4aa3e8', ink: '#e9e9ee' },
      logo: 'BASS MURK π', logoSize: 19, logoColor: '#f2f2f6', logoStroke: '#22242c', logoStrokeW: 3,
      sub: 'DISTORTION / SUSTAINER', subSize: 6,
      algo: 'drive', opts: muffV({ preHp: 30, blendLp: 300, blendHp: 900, postLp: 6500, gainMaxDb: 48, modes: [{}, { postEq: [{ type: 'ls', f: 110, q: 0.7, db: 6 }] }, { cleanSum: true, cleanMix: 0.55 }] }),
      controls: [...muffKnobs(), TOG('mode', 'MODE', ['NORM', 'BASS+', 'DRY'], { orient: 'h', optSize: 4.4 })],
      desc: 'NORMAL, BASS BOOST (low-shelf lift) or DRY (clean bass blended under the fuzz).',
    }),
    E({
      id: 'ehx.littlemuff', name: 'Little Murk π', ref: 'Electro-Harmonix Little Big Muff Pi', cat: 'Fuzz', typeName: 'Distortion / sustainer',
      box: 'nano', color: '#2c2c2e', text: '#ececec',
      art: { kind: 'muff', noPi: true, accent: '#c8161d', ink: '#ececec' },
      logo: 'LITTLE MURK', logoSize: 17, logoColor: '#f4f4f4', logoLs: 1, sub: 'π · SUSTAINER', subSize: 6.4, jackY: 150,
      algo: 'drive', opts: muffV({ stages: 1, gainMinDb: 18, gainMaxDb: 46, blendLp: 500, blendHp: 1200, levelMaxDb: 1 }),
      controls: muffKnobs(),
    }),
    E({
      id: 'ehx.ramshead', name: "Ram's Horn Murk", ref: "Electro-Harmonix Ram's Head Big Muff Pi", cat: 'Fuzz', typeName: 'Violet sustainer',
      box: 'nano', color: '#6a3c93', text: '#f6eefe',
      art: { kind: 'ram', ink: '#20112e', accent: '#f6eefe' },
      logo: "RAM'S HORN", logoSize: 18, logoColor: '#f6eefe', logoStroke: '#20112e', logoStrokeW: 2.6, sub: 'MURK π', subSize: 7.4, subLs: 3,
      algo: 'drive', opts: muffV({ blendLp: 520, blendHp: 1350, postLp: 9800, gainMaxDb: 50, stage2Db: 16 }),
      controls: muffKnobs(),
    }),
    E({
      id: 'ehx.nanomuff', name: 'Nano Murk π', ref: 'Electro-Harmonix Nano Big Muff Pi', cat: 'Fuzz', typeName: 'Distortion / sustainer',
      box: 'nano', color: '#efede6', text: '#141414', kstyle: 'muff',
      art: { kind: 'muff', accent: '#d21f26', ink: '#141414', pi: '#efede6' },
      logo: 'BIG MURK', logoSize: 22, logoColor: '#f7f5ef', logoStroke: '#141414', logoStrokeW: 2.6, logoLs: 1, jackY: 150,
      algo: 'drive', opts: muffV(),
      controls: muffKnobs(),
    }),

    // ---------------------------------------------------------------- modulation
    E({
      id: 'ehx.smallstone', name: 'Small Pebble', ref: 'Electro-Harmonix Small Stone', cat: 'Modulation', typeName: 'Phase shifter',
      box: 'nano', color: '#c3c6ca', text: '#141414',
      art: { kind: 'stone', ink: '#26303a', accent: '#d08a2a' },
      logo: 'small pebble', logoSize: 21, logoFont: "'Inter', sans-serif", logoWeight: 800, logoLs: -0.6, sub: 'PHASE SHIFTER', subSize: 6.4,
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.9, mix: 0.5 },
      controls: [K('rate', 'RATE', { def: 0.35, r: 14 }), TOG('color', 'COLOR', ['OFF', 'ON'], { orient: 'h' })],
      derive: (p) => ({ feedback: p.color ? 0.72 : 0.18, center: p.color ? 0.42 : 0.5 }),
    }),
    E({
      id: 'ehx.mistress', name: 'Electric Madame', ref: 'Electro-Harmonix Deluxe Electric Mistress', cat: 'Modulation', typeName: 'Flanger / filter matrix',
      box: 'xo', color: '#c4c7cb', text: '#1a1a1c',
      art: { kind: 'comb', accent: '#b8336a', ink: '#2c3e70' },
      logo: 'Electric Madame', logoSize: 24, logoFont: "'Dancing Script', cursive", logoColor: '#a52a5e', sub: 'FLANGER', subSize: 6.6,
      algo: 'flanger', fixed: { mix: 0.5 },
      controls: [K('speed', 'RATE', { def: 0.3 }), K('width', 'RANGE', { def: 0.6 }), K('regen', 'COLOR', { def: 0.55 }), TOG('matrix', 'FILTER MATRIX', ['OFF', 'ON'], { orient: 'h' })],
      derive: (p) => (p.matrix ? { width: 0, manual: p.width ?? 0.6 } : { manual: 0.45 }),
      desc: 'FILTER MATRIX stops the sweep – RANGE then sets the comb-filter position by hand.',
    }),
    E({
      id: 'ehx.nanoclone', name: 'Nano Twin', ref: 'Electro-Harmonix Nano Clone', cat: 'Modulation', typeName: 'Chorus',
      box: 'nano', color: '#5aa59c', text: '#0f1d1b',
      art: { kind: 'clone', ink: '#0f1d1b', accent: '#f2f7f6' },
      logo: 'nano twin', logoSize: 22, logoFont: "'Inter', sans-serif", logoWeight: 800, logoLs: -0.4, sub: 'CHORUS', subSize: 6.6,
      algo: 'chorus', fixed: { mix: 0.5, mode: 0 },
      controls: [K('depth', 'DEPTH', { def: 0.55 }), K('rate', 'RATE', { def: 0.35 })],
    }),
    E({
      id: 'ehx.lester', name: 'Spinster Rotary', ref: 'Electro-Harmonix Lester G', cat: 'Modulation', typeName: 'Deluxe rotary speaker',
      box: 'wide', bw: 270, color: '#2d2421', text: '#efe2c8', stereo: 'both', cost: 1,
      art: { kind: 'rotor', accent: '#d9a441', ink: '#efe2c8' },
      logo: 'SPINSTER', logoSize: 26, logoColor: '#efe2c8', logoLs: 4, sub: 'ROTARY SPEAKER', subSize: 6.6, artTop: 76, artBottom: 172,
      algo: 'rotary', noStd: true,
      controls: [
        K('level', 'VOLUME', { x: 38, y: 34, r: 12, def: 0.5 }), K('drive', 'DRIVE', { x: 86, y: 34, r: 12, def: 0.25 }), K('balance', 'BALANCE', { x: 135, y: 34, r: 12, def: 0.5 }),
        K('accel', 'ACCEL', { x: 184, y: 34, r: 12, def: 0.5 }), K('mix', 'DEPTH', { x: 232, y: 34, r: 12, def: 1 }),
        FOOT({ x: 70, y: 210, r: 12 }), FOOT({ action: 'param', p: 'speed', toggle: true, label: 'SLOW / FAST', x: 200, y: 210, r: 12, labelDy: -26 }),
        LED({ x: 70, y: 186, color: '#ff2a1a' }), LED({ x: 236, y: 210, bind: 'rate:on:speedlex', color: '#ffb000' }),
      ],
    }),

    // ---------------------------------------------------------------- delays
    E({
      id: 'ehx.dmm', name: 'Deluxe Recall Man', ref: 'Electro-Harmonix Deluxe Memory Man', cat: 'Delay', typeName: 'Analog echo / chorus / vibrato',
      box: 'wide', bw: 286, color: '#c9cbce', text: '#18191b', kstyle: 'ehx', cost: 0.8,
      art: { kind: 'echo', accent: '#1d4c8c', r: 9, n: 8, top: true },
      logo: 'DELUXE RECALL MAN', logoSize: 19, logoFont: "'Oswald', sans-serif", logoLs: 1.6, logoY: 156, sub: 'ANALOG DELAY WITH CHORUS / VIBRATO', subSize: 6.2, subY: 172, artTop: 104, artBottom: 184,
      algo: 'delay', opts: { maxMs: 600, fixedMode: 1 }, fixed: { tone: 0.38, modrate: 0.35, age: 0.35 },
      controls: [
        K('level', 'LEVEL', { x: 40, y: 42, r: 14, def: 0.5 }), K('mix', 'BLEND', { x: 91, y: 42, r: 14, def: 0.45 }), K('feedback', 'FEEDBACK', { x: 143, y: 42, r: 14, def: 0.4, max: 1.08 }),
        K('moddepth', 'CHORUS-VIBRATO', { x: 195, y: 42, r: 14, def: 0.2 }), K('time', 'DELAY', { x: 246, y: 42, r: 14, min: 35, max: 550, def: 320, display: ms }),
        TOG('vib', '', ['CHORUS', 'VIBRATO'], { x: 195, y: 92, orient: 'h' }),
      ],
      derive: (p) => (p.vib ? { modrate: 0.55, mix: Math.max(p.mix ?? 0.45, 0.85) } : {}),
    }),
    E({
      id: 'ehx.memorytoy', name: 'Recall Toy', ref: 'Electro-Harmonix Memory Toy', cat: 'Delay', typeName: 'Analog echo with modulation',
      box: 'nano', color: '#c8372f', text: '#fbf3ea',
      art: { kind: 'echo', accent: '#fbf3ea', r: 10, n: 6, top: true },
      logo: 'RECALL TOY', logoSize: 20, logoColor: '#fbf3ea', logoLs: 1.2, sub: 'ANALOG ECHO', subSize: 6.4,
      algo: 'delay', opts: { maxMs: 600, fixedMode: 1 }, fixed: { tone: 0.35, modrate: 0.3, age: 0.4 },
      controls: [K('mix', 'BLEND', { def: 0.45 }), K('feedback', 'FEEDBACK', { def: 0.4, max: 1.05 }), K('time', 'DELAY', { min: 30, max: 550, def: 300, display: ms }), TOG('mod', 'MOD', ['OFF', 'ON'], { orient: 'h' })],
      derive: (p) => ({ moddepth: p.mod ? 0.35 : 0 }),
    }),
    E({
      id: 'ehx.canyon', name: 'Gorge', ref: 'Electro-Harmonix Canyon', cat: 'Delay', typeName: 'Delay & looper',
      box: 'nano', bh: 256, color: '#c97a3c', text: '#2a1608', jacksTop: true, kstyle: 'ehx', cost: 1.2,
      art: { kind: 'canyon', accent: '#8d3f17', ink: '#4a1f0b', paper: '#c97a3c', sun: '#f5d27a' },
      logo: 'GORGE', logoSize: 22, logoLs: 5, sub: 'DELAY & LOOPER', subSize: 6.2, artTop: 124,
      algo: 'delay', opts: { maxMs: 3000 },
      controls: [
        K('mix', 'FX LVL', { x: 28, y: 30, r: 10.5, def: 0.4 }), K('feedback', 'FB', { x: 70, y: 30, r: 10.5, def: 0.35, max: 1.05 }), K('time', 'DELAY', { x: 112, y: 30, r: 10.5, min: 20, max: 3000, def: 450, curve: 'log', display: ms }),
        SEL('cmode', 'MODE', ['ECHO', 'MOD', 'MULTI', 'REV', 'DMM', 'TAPE', 'VERB', 'OCT', 'S/H', 'SHIM', 'LOOP'], { x: 64, y: 92, r: 13, sweep: 300, optSize: 4.1, labelRadius: 9, labelPos: 'none', virtual: true }),
        BTN('TAP DIV', { p: 'subdiv', toggle: true, x: 120, y: 96, r: 4.5, led: true, ledDy: -9, ledColor: '#ff2a1a' }),
      ],
      derive: (p) => {
        const m = p.cmode ?? 0;
        const T = [{ mode: 0 }, { mode: 4, moddepth: 0.4, modrate: 0.3 }, { mode: 2, heads: 7 }, { mode: 5 }, { mode: 1, moddepth: 0.2, modrate: 0.35 }, { mode: 2, heads: 4, age: 0.55, moddepth: 0.25 }, { mode: 10 }, { mode: 6 }, { mode: 4, moddepth: 0.85, modrate: 0.75 }, { mode: 6 }, { mode: 0, time: 3000, feedback: 1.0 }][m];
        return Object.assign({ moddepth: 0, heads: 4, age: 0.2 }, T);
      },
      tapFoot: true, desc: 'Hold the footswitch for TEMPO (tap) mode. LOOP is approximated as a 3 s sound-on-sound delay (FB = 100 %).',
    }),

    // ---------------------------------------------------------------- pitch
    E({
      id: 'ehx.pog2', name: 'Poly Octaver II', ref: 'Electro-Harmonix POG2', cat: 'Pitch', typeName: 'Polyphonic octave generator',
      box: 'wide', bw: 300, color: '#d4d6d8', text: '#151617', cost: 1.1, noStd: true,
      art: { kind: 'pog', accent: '#2e6fb5', ink: '#151617', mid: 0.36 },
      logo: 'POLY OCTAVER II', logoSize: 18, logoLs: 1.4, sub: 'POLYPHONIC OCTAVE GENERATOR', subSize: 6, artTop: 106, artBottom: 182,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { quality: 1 } },
        { prefix: 'f', algo: 'peq', params: { mid1q: 2.5 } },
        { prefix: 's', algo: 'swell', on: false },
      ] },
      controls: [
        ...[['sub2', 'SUB OCT', 0], ['sub', 'OCT DOWN', 0.5], ['dry', 'DRY', 1], ['up', 'OCT UP', 0.4], ['up2', '2 OCT UP', 0], ['att', 'ATTACK', 0], ['lpf', 'LPF', 1]].map(([p, l, dv], i) =>
          SLIDER(p, l, { x: 34 + i * 32, y: 62, h: 58, def: dv, virtual: true })),
        BTN('Q', { p: 'q', toggle: true, x: 262, y: 44, r: 5, led: true, ledDy: -9, ledColor: '#ff2a1a' }),
        BTN('DETUNE', { p: 'detune', toggle: true, x: 262, y: 84, r: 5, led: true, ledDy: -9, ledColor: '#ff2a1a' }),
        FOOT({ label: 'EFFECT', x: 80, y: 210, r: 12, labelDy: -22 }), FOOT({ action: 'favorite', label: 'PRESET', x: 220, y: 210, r: 12, labelDy: -22 }),
        LED({ x: 104, y: 210, color: '#ff2a1a' }), LED({ x: 244, y: 210, bind: 'fav', color: '#3ddc84' }),
      ],
      derive: (p) => {
        const down = Math.max(p.sub ?? 0.5, p.sub2 ?? 0), up = Math.max(p.up ?? 0.4, p.up2 ?? 0), lpf = p.lpf ?? 1, att = p.att ?? 0;
        return {
          'p.semis1': (p.up2 ?? 0) > (p.up ?? 0.4) ? 24 : 12, 'p.level1': up, 'p.semis2': (p.sub2 ?? 0) > (p.sub ?? 0.5) ? -24 : -12, 'p.level2': down,
          'p.dry': p.dry ?? 1, 'p.tone': 0.15 + 0.85 * lpf, 'p.cents': p.detune ? 9 : 0,
          'f.mid1freq': 300 + 3500 * lpf * lpf, 'f.mid1gain': p.q ? 9 : 0, 'f.level': p.q ? -3 : 0,
          's.on': att > 0.03 ? 1 : 0, 's.attack': att, 's.sens': 0.5,
        };
      },
      desc: 'Two pitch voices: the stronger of SUB OCT / OCT DOWN and of OCT UP / 2 OCT UP sound (engine limit). PRESET recalls the stored setting (hold to save).',
    }),
    E({
      id: 'ehx.micropog', name: 'Micro Poly Octaver', ref: 'Electro-Harmonix Micro POG', cat: 'Pitch', typeName: 'Polyphonic octave generator',
      box: 'xo', bw: 160, color: '#d2d4d6', text: '#151617',
      art: { kind: 'pog', accent: '#c8161d', ink: '#151617' },
      logo: 'MICRO POLY OCTAVER', logoSize: 14, logoLs: 1, sub: 'POLYPHONIC OCTAVE GENERATOR', subSize: 5.4,
      algo: 'pitch', fixed: { semis1: 12, semis2: -12, quality: 1 },
      controls: [K('level2', 'SUB OCTAVE', { def: 0.5 }), K('level1', 'OCTAVE UP', { def: 0.4 }), K('dry', 'DRY OUT', { def: 0.9 })],
    }),
    E({
      id: 'ehx.pitchfork', name: 'Tuning Prong', ref: 'Electro-Harmonix Pitch Fork', cat: 'Pitch', typeName: 'Polyphonic pitch shifter',
      box: 'nano', color: '#d7d9dc', text: '#14213d', cost: 0.8,
      art: { kind: 'fork', ink: '#14213d', accent: '#2f6fd0' },
      logo: 'TUNING PRONG', logoSize: 16.5, logoLs: 0.8, sub: 'PITCH SHIFTER', subSize: 6, artTop: 110,
      algo: 'pitch', fixed: { quality: 1 },
      ctrl: { ins: [{ label: 'EXP', param: 'expr', min: 0, max: 1 }] },
      controls: [
        K('blend', 'BLEND', { x: 34, y: 34, r: 12, def: 0.5, virtual: true }),
        SEL('shift', 'SHIFT', ['1', '2', '3', '4', '5', '6', '7', 'OCT', '2OCT', '3OCT', 'DET'], { x: 100, y: 36, r: 11.5, def: 7, sweep: 300, optSize: 3.9, labelRadius: 8, labelPos: 'none', virtual: true }),
        TOG('dir', 'SHIFT', ['UP', 'DOWN', 'DUAL'], { x: 36, y: 92, orient: 'h', virtual: true }),
        TOG('latch', 'MODE', ['LATCH', 'MOM'], { x: 104, y: 92, orient: 'h', virtual: true }),
      ],
      derive: (p) => {
        const s = p.shift ?? 7, iv = [1, 2, 3, 4, 5, 6, 7, 12, 24, 24, 0][s], b = p.blend ?? 0.5, wet = Math.min(1, 2 * b), dry = Math.min(1, 2 * (1 - b));
        const dir = p.dir ?? 0;
        if (s === 10) return { semis1: 0, semis2: 0, cents: 14, level1: wet, level2: 0, dry };
        return { semis1: dir === 1 ? -iv : iv, semis2: -iv, level1: wet, level2: dir === 2 ? wet : 0, dry, cents: 0 };
      },
      momentaryWhen: (ui) => (ui.latch ?? 0) === 1,
      desc: 'MOM: the shift only sounds while the footswitch is held. EXP jack sweeps into the shift. 3OCT is capped at two octaves.',
    }),

    // ---------------------------------------------------------------- reverbs
    E({
      id: 'ehx.holygrail', name: 'Holy Chalice', ref: 'Electro-Harmonix Holy Grail', cat: 'Reverb', typeName: 'Digital reverb',
      box: 'xo', color: '#cfd1d3', text: '#1b1b1d', cost: 1.1,
      art: { kind: 'grail', accent: '#d4a93c', ink: '#3a2a0e' },
      logo: 'Holy Chalice', logoSize: 26, logoFont: "'Dancing Script', cursive", logoColor: '#4a2f0c', sub: 'DIGITAL REVERB', subSize: 6.6,
      algo: 'reverb', fixed: { lowcut: 0.15 },
      controls: [K('mix', 'REVERB', { def: 0.35, r: 16 }), TOG('gmode', '', ['SPRING', 'HALL', 'FLERB'], { orient: 'h', def: 1 })],
      derive: (p) => [{ mode: 3, decay: 0.5, mod: 0.1 }, { mode: 1, decay: 0.6, mod: 0.2 }, { mode: 6, decay: 0.65, mod: 0.95 }][p.gmode ?? 1],
    }),
    E({
      id: 'ehx.holygrailnano', name: 'Holy Chalice Nano', ref: 'Electro-Harmonix Holy Grail Nano', cat: 'Reverb', typeName: 'Reverb',
      box: 'nano', color: '#d5d6d8', text: '#1b1b1d', cost: 1.1,
      art: { kind: 'grail', accent: '#d4a93c', ink: '#3a2a0e' },
      logo: 'Holy Chalice', logoSize: 22, logoFont: "'Dancing Script', cursive", logoColor: '#4a2f0c', sub: 'REVERB', subSize: 6.4,
      algo: 'reverb', fixed: { lowcut: 0.15 },
      controls: [K('mix', 'REVERB', { def: 0.35 }), TOG('gmode', '', ['SPRING', 'HALL', 'FLERB'], { orient: 'h', def: 1 })],
      derive: (p) => [{ mode: 3, decay: 0.5, mod: 0.1 }, { mode: 1, decay: 0.6, mod: 0.2 }, { mode: 6, decay: 0.65, mod: 0.95 }][p.gmode ?? 1],
    }),
    E({
      id: 'ehx.oceans11', name: 'Seas Eleven', ref: 'Electro-Harmonix Oceans 11', cat: 'Reverb', typeName: 'Multifunction reverb',
      box: 'nano', bh: 256, color: '#1e5a86', text: '#eef6fb', jacksTop: true, cost: 1.4,
      art: { kind: 'ocean', accent: '#7fc4e8', ink: '#eef6fb', paper: '#1e5a86' },
      logo: 'SEAS 11', logoSize: 22, logoLs: 3, sub: 'MULTIFUNCTION REVERB', subSize: 6, artTop: 120,
      algo: 'chain',
      opts: { chain: [{ prefix: 'r', algo: 'reverb', params: { lowcut: 0.15 } }, { prefix: 't', algo: 'tremolo', on: false, params: { depth: 0.6, rate: 0.45 } }] },
      controls: [
        K('r.mix', 'FX LVL', { x: 28, y: 30, r: 10.5, def: 0.4 }), K('r.decay', 'TIME', { x: 70, y: 30, r: 10.5, def: 0.5 }), K('r.tone', 'TONE', { x: 112, y: 30, r: 10.5, def: 0.55 }),
        SEL('omode', 'MODE', ['HALL', 'SPRG', 'PLATE', 'REFL', 'MOD', 'DYNA', 'A-INF', 'SHIM', 'POLY', 'TREM', 'ECHO'], { x: 70, y: 90, r: 13, sweep: 300, optSize: 4.1, labelRadius: 9, labelPos: 'none', virtual: true }),
      ],
      derive: (p) => {
        const m = p.omode ?? 0;
        const T = [{ 'r.mode': 1 }, { 'r.mode': 3 }, { 'r.mode': 2 }, { 'r.mode': 8, 'r.predelay': 140 }, { 'r.mode': 6, 'r.mod': 0.8 }, { 'r.mode': 7 }, { 'r.mode': 1, 'r.decay': 0.985 }, { 'r.mode': 4, 'r.shimmer': 0.55 }, { 'r.mode': 4, 'r.shimmer': 1 }, { 'r.mode': 1 }, { 'r.mode': 8, 'r.predelay': 320 }][m];
        return Object.assign({ 't.on': m === 9 ? 1 : 0, 'r.predelay': 20, 'r.mod': 0.3 }, T);
      },
    }),

    // ---------------------------------------------------------------- freeze / sustain
    E({
      id: 'ehx.freeze', name: 'Ice Hold', ref: 'Electro-Harmonix Freeze', cat: 'Synth', typeName: 'Sound retainer',
      box: 'nano', color: '#e9eff4', text: '#1b4a85', cost: 1, noStd: true, alwaysOn: true,
      art: { kind: 'snow', accent: '#3f86d6', ink: '#1b4a85' },
      logo: 'ICE HOLD', logoSize: 22, logoLs: 2.4, sub: 'SOUND RETAINER', subSize: 6.4,
      algo: 'freeze', fixed: { dry: 1, decay: 1 },
      controls: [K('mix', 'EFFECT', { def: 0.7 }), TOG('fmode', 'MODE', ['FAST', 'SLOW', 'LATCH'], { orient: 'h', def: 2, virtual: true }),
        FOOT({ action: 'event', event: { type: 1, value: 1 } }), LED({ color: '#3f86d6' })],
      derive: (p) => [{ mode: 1, speed: 0.08 }, { mode: 1, speed: 0.7 }, { mode: 0, speed: 0.3 }][p.fmode ?? 2],
      desc: 'FAST / SLOW: the note is held while the footswitch is down (fast or slow fade). LATCH: press to freeze, press again to release.',
    }),
    E({
      id: 'ehx.superego', name: 'Super Id', ref: 'Electro-Harmonix Superego', cat: 'Synth', typeName: 'Synth engine / sustainer',
      box: 'xo', color: '#1f2142', text: '#f0e6ff', cost: 1,
      art: { kind: 'cosmos', accent: '#e05ab8', ink: '#f0e6ff' },
      logo: 'super id', logoSize: 28, logoFont: "'Inter', sans-serif", logoWeight: 800, logoLs: -0.8, logoColor: '#f0e6ff', sub: 'SYNTH ENGINE', subSize: 6.6,
      algo: 'freeze', fixed: { decay: 1 },
      controls: [K('speed', 'SPEED', { def: 0.35 }), K('layer', 'GLISS', { def: 0.2 }), K('dry', 'DRY', { def: 1 }), K('mix', 'EFFECT', { def: 0.7 }),
        TOG('smode', '', ['LATCH', 'MOM', 'AUTO'], { orient: 'h', virtual: true })],
      derive: (p) => ({ mode: [0, 1, 2][p.smode ?? 0] }),
      desc: 'LATCH: press to freeze / layer, MOMENTARY: hold to sustain, AUTO: every new note is captured (footswitch = bypass). GLISS is approximated by the layering crossfade.',
    }),

    // ---------------------------------------------------------------- overdrives / boosts
    E({
      id: 'ehx.soulfood', name: 'Spirit Food', ref: 'Electro-Harmonix Soul Food', cat: 'Overdrive', typeName: 'Transparent overdrive',
      box: 'nano', color: '#cfd0d3', text: '#2a1638',
      art: { kind: 'food', accent: '#8a4fa8', ink: '#2a1638', paper: '#cfd0d3' },
      logo: 'Spirit Food', logoSize: 22, logoFont: "'Dancing Script', cursive", logoColor: '#5a2d6e', sub: 'DISTORTION · FUZZ · OVERDRIVE', subSize: 5.4, subLs: 0.8,
      algo: 'drive', opts: { clip: 'ge', bias: 0.1, cleanSum: true, cleanMix: 0.6, clipHp: 400, gainMinDb: 0, gainMaxDb: 34, tone: 'tilt', trebleF: 1600, eqRangeDb: 8, postLp: 9500, levelMaxDb: 10 },
      controls: [K('level', 'VOLUME', { display: ten }), K('gain', 'DRIVE', { display: ten, def: 0.45 }), K('tone', 'TREBLE', { display: ten })],
    }),
    E({
      id: 'ehx.crayon', name: 'Wax Crayon', ref: 'Electro-Harmonix Crayon', cat: 'Overdrive', typeName: 'Full-range overdrive',
      box: 'nano', color: '#f1ece2', text: '#1d1d1f',
      art: { kind: 'crayon' },
      logo: 'WAX CRAYON', logoSize: 19, logoLs: 1.2, sub: 'FULL RANGE OVERDRIVE', subSize: 5.8,
      algo: 'drive', opts: { clip: 'opamp', bias: 0.12, preHp: 30, gainMinDb: 0, gainMaxDb: 36, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 11000, levelMaxDb: 8 },
      controls: [K('level', 'VOLUME', { display: ten }), K('gain', 'GAIN', { display: ten, def: 0.4 }), K('bass', 'BASS', { display: ten }), K('treble', 'TREBLE', { display: ten })],
    }),
    E({
      id: 'ehx.hotwax', name: 'Hot Paraffin', ref: 'Electro-Harmonix Hot Wax', cat: 'Overdrive', typeName: 'Dual overdrive',
      box: 'xo', bw: 210, bh: 240, color: '#e9a63a', text: '#2a1404', noStd: true, cost: 1,
      panels: [{ x: 104.5, y: 10, width: 1.2, height: 96, fill: '#2a1404', opacity: 0.5 }],
      art: { kind: 'wax', accent: '#c8261d', ink: '#2a1404', candles: [-12, 12] },
      logo: 'HOT PARAFFIN', logoSize: 19, logoLs: 1.4, sub: 'CRAYON · HOT TUBES', subSize: 6, artTop: 108, artBottom: 180,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'c', algo: 'drive', opts: { clip: 'opamp', bias: 0.12, preHp: 30, gainMinDb: 0, gainMaxDb: 36, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 11000, levelMaxDb: 8 } },
        { prefix: 'h', algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 10, bias: 0.25, preHp: 60, gainMinDb: 4, gainMaxDb: 42, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 8000, levelMaxDb: 6 } },
      ] },
      controls: [
        K('c.level', 'VOLUME', { x: 32, y: 32, r: 11 }), K('c.gain', 'GAIN', { x: 76, y: 32, r: 11, def: 0.4 }), K('c.bass', 'BASS', { x: 32, y: 78, r: 11 }), K('c.treble', 'TREBLE', { x: 76, y: 78, r: 11 }),
        K('h.level', 'VOLUME', { x: 134, y: 32, r: 11 }), K('h.gain', 'DRIVE', { x: 178, y: 32, r: 11, def: 0.45 }), K('h.tone', 'TONE', { x: 156, y: 78, r: 11 }),
        FOOT({ action: 'param', p: 'c.on', toggle: true, x: 54, y: 214, r: 12, def: 1 }), FOOT({ action: 'param', p: 'h.on', toggle: true, x: 156, y: 214, r: 12 }),
        LED({ x: 54, y: 190, bind: 'param:c.on' }), LED({ x: 156, y: 190, bind: 'param:h.on' }),
      ],
      alwaysOn: true, initParams: { 'c.on': 1, 'h.on': 0 },
      desc: 'Left: full-range CRAYON overdrive. Right: HOT TUBES tube-style drive, after the Crayon.',
    }),
    E({
      id: 'ehx.lpb1', name: 'Linear Boost', ref: 'Electro-Harmonix LPB-1', cat: 'Boost', typeName: 'Linear power booster',
      box: 'nano', color: '#c9cbce', text: '#141414',
      art: { kind: 'rise', ink: '#141414', accent: '#d6262c' },
      logo: 'LB-1', logoSize: 30, logoLs: 3, sub: 'LINEAR POWER BOOSTER', subSize: 6,
      algo: 'boost', opts: { gainMaxDb: 20 }, fixed: { mode: 0, level: 1 },
      controls: [K('gain', 'VOLUME', { def: 0.25, display: ten })],
    }),
    E({
      id: 'ehx.cockfight', name: 'Rooster Brawl', ref: 'Electro-Harmonix Cock Fight', cat: 'Wah', typeName: 'Cocked talking wah / fuzz',
      box: 'nano', color: '#e1d8c4', text: '#1b120d', cost: 0.9,
      art: { kind: 'rooster', accent: '#c8261d', ink: '#1b120d', paper: '#e1d8c4' },
      logo: 'ROOSTER BRAWL', logoSize: 16, logoLs: 0.6, sub: 'COCKED WAH / FUZZ', subSize: 6,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'w', algo: 'wah', opts: { mode: 0, fLo: 350, fHi: 2400, q: 5 }, params: { mode: 0 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'si', bias: 0.3, preHp: 80, gainMinDb: 4, gainMaxDb: 46, tone: 'none', postLp: 7000, levelMaxDb: -1 } },
      ] },
      ctrl: { ins: [{ label: 'EXP', param: 'w.pos', min: 0, max: 1 }] },
      controls: [K('d.gain', 'FUZZ', { def: 0.35 }), K('d.level', 'VOLUME', { def: 0.5 }), K('w.pos', 'FREQ', { def: 0.55 }), TOG('talk', '', ['CRY', 'TALK'], { orient: 'h', virtual: true })],
      derive: (p) => (p.talk ? { 'w.q': 0.85, 'w.range': 0.75 } : { 'w.q': 0.5, 'w.range': 0.5 }),
      desc: 'Fixed ("cocked") wah into fuzz. FREQ sets the wah position – or plug an expression pedal into EXP.',
    }),

    // ---------------------------------------------------------------- filters / dynamics / EQ
    E({
      id: 'ehx.qtron', name: 'Q-Tronix', ref: 'Electro-Harmonix Q-Tron', cat: 'Filter', typeName: 'Envelope controlled filter',
      box: 'xo', bw: 204, bh: 256, color: '#1f2b52', text: '#f3e9cf', kstyle: 'dot',
      art: { kind: 'env', accent: '#e6b63f', ink: '#f3e9cf' },
      logo: 'Q-TRONIX', logoSize: 26, logoLs: 3, logoSkew: -10, logoColor: '#e6b63f', sub: 'ENVELOPE CONTROLLED FILTER', subSize: 6.2, artTop: 124,
      algo: 'wah', opts: { mode: 2, fLo: 220, fHi: 3200, q: 5 }, fixed: { mode: 2 },
      controls: [
        K('sens', 'GAIN', { x: 62, y: 42, r: 15, def: 0.55 }), K('q', 'PEAK', { x: 142, y: 42, r: 15, def: 0.55 }),
        TOG('filter', 'MODE', ['LP', 'BP', 'HP'], { x: 38, y: 100, orient: 'h', def: 1 }), TOG('qrange', 'RANGE', ['LO', 'HI'], { x: 84, y: 100, orient: 'h', def: 1, virtual: true }),
        TOG('direction', 'DRIVE', ['UP', 'DN'], { x: 126, y: 100, orient: 'h' }), TOG('boost', 'BOOST', ['OFF', 'ON'], { x: 168, y: 100, orient: 'h', virtual: true }),
      ],
      derive: (p) => ({ range: p.qrange ? 0.72 : 0.32, level: p.boost ? 0.68 : 0.5 }),
    }),
    E({
      id: 'ehx.microqtron', name: 'Micro Q-Tronix', ref: 'Electro-Harmonix Micro Q-Tron', cat: 'Filter', typeName: 'Envelope filter',
      box: 'nano', color: '#2a3768', text: '#f3e9cf', kstyle: 'dot',
      art: { kind: 'env', accent: '#e6b63f', ink: '#f3e9cf' },
      logo: 'MICRO Q-TRONIX', logoSize: 15.5, logoSkew: -10, logoColor: '#e6b63f', logoLs: 1, sub: 'ENVELOPE FILTER', subSize: 6,
      algo: 'wah', opts: { mode: 2, fLo: 220, fHi: 3000, q: 5 }, fixed: { mode: 2, range: 0.55 },
      controls: [K('q', 'Q', { def: 0.55 }), K('sens', 'DRIVE', { def: 0.55 }), TOG('filter', 'MODE', ['LP', 'BP', 'HP'], { orient: 'h', def: 1 })],
    }),
    E({
      id: 'ehx.graphicfuzz', name: 'Graph Fuzz', ref: 'Electro-Harmonix Graphic Fuzz', cat: 'Fuzz', typeName: 'EQ / distortion / sustainer',
      box: 'xo', bw: 204, bh: 252, color: '#141518', text: '#e8eaee', cost: 0.9,
      art: { kind: 'grid', ink: '#e8eaee' },
      logo: 'GRAPH FUZZ', logoSize: 20, logoLs: 3, logoColor: '#ff6a2a', sub: 'EQ · DISTORTION · SUSTAINER', subSize: 6, artTop: 160, artBottom: 196,
      panels: [{ x: 14, y: 66, width: 176, height: 88, rx: 4, fill: '#000', opacity: 0.35 }],
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'drive', opts: { modes: [{ clip: 'muff', stages: 2, stage2Db: 14, gainMinDb: 14, gainMaxDb: 50 }, { clip: 'diode', gainMinDb: 4, gainMaxDb: 40 }], preHp: 60, tone: 'none', postLp: 8500, levelMaxDb: -3 } },
        { prefix: 'e', algo: 'geq', opts: { freqs: [100, 200, 400, 800, 1600, 3200], q: 1.3 } },
      ] },
      controls: [
        K('d.level', 'VOLUME', { x: 40, y: 32, r: 12 }), K('d.gain', 'SUSTAIN', { x: 164, y: 32, r: 12, def: 0.5 }),
        TOG('d.mode', 'MODE', ['SUSTAIN', 'DIST'], { x: 102, y: 34, orient: 'h' }),
        ...['100', '200', '400', '800', '1.6K', '3.2K'].map((l, i) => SLIDER('e.b' + i, l, { x: 34 + i * 27, y: 106, h: 60, min: -15, max: 15, def: 0, display: db, capColor: '#e8eaee', lineColor: '#ff6a2a' })),
      ],
    }),
    E({
      id: 'ehx.pico', name: 'Pico Plateau', ref: 'Electro-Harmonix Pico Platform', cat: 'Dynamics', typeName: 'Stereo compressor / limiter',
      box: 'nano', color: '#3b3f46', text: '#eef0f3', stereo: 'both',
      art: { kind: 'platform', ink: '#eef0f3', accent: '#47b4e6' },
      logo: 'PICO PLATEAU', logoSize: 16, logoLs: 1, sub: 'COMPRESSOR / LIMITER', subSize: 6,
      algo: 'comp', opts: { type: 'vca' }, fixed: { ratio: 0.55, release: 0.4 },
      controls: [K('level', 'VOLUME', { def: 0.4 }), K('sustain', 'SUSTAIN', { def: 0.5 }), K('attack', 'ATTACK', { def: 0.3 }), K('blend', 'BLEND', { def: 1 })],
    }),

    // ---------------------------------------------------------------- the 9-series machines
    ...nineSeries(),
  ]);

  // ---------------------------------------------------------------- v0.4 additions
  const semiOpts = ['-24', '-12', '-7', '-5', '-3', '0', '+3', '+4', '+5', '+7', '+12', '+24'];
  const semiVals = [-24, -12, -7, -5, -3, 0, 3, 4, 5, 7, 12, 24];
  const P = (o) => E(Object.assign({ box: 'pico', kstyle: 'dot', labelSize: 6.2 }, o));
  tz.addDefs([
    // ---- pitch
    E({
      id: 'ehx.pitchforkplus', name: 'Tuning Prong+', ref: 'Electro-Harmonix Pitch Fork+', cat: 'Pitch', typeName: 'Dual polyphonic pitch shifter',
      box: 'xo', bh: 270, color: '#dfe2e6', text: '#14213d', cost: 1,
      art: { kind: 'fork', ink: '#14213d', accent: '#2f6fd0' },
      logo: 'TUNING PRONG+', logoSize: 18, logoLs: 1, sub: 'POLYPHONIC PITCH SHIFTER', subSize: 6, artTop: 128,
      algo: 'pitch', fixed: { quality: 1 },
      ctrl: { ins: [{ label: 'EXP', param: 'expr', min: 0, max: 1 }] },
      controls: [
        K('blend', 'BLEND', { x: 34, y: 34, r: 12, def: 0.5, virtual: true }),
        SEL('s1', 'SHIFT 1', semiOpts, { x: 88, y: 36, r: 11, def: 10, sweep: 300, optSize: 3.8, labelRadius: 8, labelPos: 'below', values: semiVals, virtual: true }),
        SEL('s2', 'SHIFT 2', semiOpts, { x: 142, y: 36, r: 11, def: 1, sweep: 300, optSize: 3.8, labelRadius: 8, labelPos: 'below', values: semiVals, virtual: true }),
        TOG('pmode', 'VOICES', ['1', '2', '1+2'], { x: 56, y: 104, orient: 'h', def: 0, virtual: true }),
        TOG('latch', 'MODE', ['LATCH', 'MOM'], { x: 124, y: 104, orient: 'h', virtual: true }),
      ],
      derive: (p) => {
        const b = p.blend ?? 0.5, wet = Math.sin(b * Math.PI / 2), m = p.pmode ?? 0;
        return { semis1: semiVals[p.s1 ?? 10] ?? 12, semis2: semiVals[p.s2 ?? 1] ?? -12, level1: m === 1 ? 0 : wet, level2: m === 0 ? 0 : wet, dry: Math.cos(b * Math.PI / 2), cents: 0 };
      },
      momentaryWhen: (ui) => (ui.latch ?? 0) === 1,
      desc: 'Two pitch voices, each set from two octaves down to two octaves up. Play one voice or both. EXP sweeps into the shift.',
    }),
    E({
      id: 'ehx.ihm', name: 'Smart Harmony Box', ref: 'Electro-Harmonix Pico Intelligent Harmony Machine', cat: 'Pitch', typeName: 'Intelligent harmony',
      box: 'pico', color: '#5a3d8a', text: '#f1e9ff', kstyle: 'dot', labelSize: 6.2, cost: 0.9,
      art: { kind: 'pog', accent: '#c7a8ff', ink: '#f1e9ff' },
      logo: 'HARMONY', logoSize: 17, logoLs: 1.4, sub: 'SMART HARMONY', subSize: 5.6,
      algo: 'pitch', fixed: { quality: 1 },
      controls: [
        SEL('key', 'KEY', ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], { def: 9, sweep: 300, optSize: 3.6, labelRadius: 7, labelPos: 'none' }),
        SEL('harm', 'HARMONY', ['-8', '-6', '-5', '-4', '-3', '+3', '+4', '+5', '+6', '+8'], { def: 5, sweep: 300, optSize: 3.6, labelRadius: 7, labelPos: 'none', virtual: true }),
        K('blend', 'BLEND', { def: 0.5, virtual: true }), TOG('minor', '', ['MAJ', 'MIN'], { virtual: true }),
      ],
      derive: (p) => { const b = p.blend ?? 0.5; return { scale: p.minor ? 2 : 1, deg1: [-7, -5, -4, -3, -2, 2, 3, 4, 5, 7][p.harm ?? 5], level1: Math.sin(b * Math.PI / 2), dry: Math.cos(b * Math.PI / 2), level2: 0 }; },
      desc: 'Adds a harmony that stays in key. Pick the key, the interval and major or minor.',
    }),
    // ---- delays / reverbs
    E({
      id: 'ehx.grandcanyon', name: 'Grand Gorge', ref: 'Electro-Harmonix Grand Canyon', cat: 'Delay', typeName: 'Delay & looper',
      box: 'xo', bw: 200, bh: 256, color: '#c86f32', text: '#2a1608', cost: 1.3, noStd: true, stereo: 'both', jacksTop: true,
      monoPorts: MONO, stereoPorts: STEREO,
      art: { kind: 'canyon', accent: '#8d3f17', ink: '#4a1f0b', sun: '#f5d27a' },
      logo: 'GRAND GORGE', logoSize: 19, logoLs: 3, sub: 'DELAY & LOOPER', subSize: 6, artTop: 120, artBottom: 194,
      algo: 'delay', opts: { maxMs: 3000 }, tapTarget: 'time',
      controls: [
        K('mix', 'FX LVL', { x: 30, y: 32, r: 11, def: 0.4 }), K('feedback', 'FEEDBACK', { x: 77, y: 32, r: 11, def: 0.35, max: 1.05 }), K('time', 'DELAY', { x: 124, y: 32, r: 11, min: 20, max: 3000, def: 450, curve: 'log', display: ms }),
        K('moddepth', 'DEPTH', { x: 171, y: 32, r: 11, def: 0.2 }),
        SEL('gmode', 'MODE', ['ECHO', 'MOD', 'MULTI', 'REV', 'DMM', 'TAPE', 'VERB', 'OCT', 'S/H', 'SHIM', 'LOFI', 'SOS'], { x: 70, y: 94, r: 13, sweep: 300, optSize: 4, labelRadius: 9, labelPos: 'none', virtual: true }),
        K('modrate', 'RATE', { x: 150, y: 92, r: 10, def: 0.3 }),
        FOOT({ x: 50, y: 226, r: 12 }), LED({ x: 50, y: 204, color: '#ff2a1a' }), FOOT({ action: 'tap', label: 'TAP', x: 150, y: 226, r: 12, labelDy: -24 }), LED({ x: 176, y: 226, bind: 'tap:time', color: '#3ddc84' }),
      ],
      derive: (p) => {
        const m = p.gmode ?? 0;
        const T = [{ mode: 0 }, { mode: 4 }, { mode: 2, heads: 7 }, { mode: 5 }, { mode: 1 }, { mode: 2, heads: 4, age: 0.55 }, { mode: 10 }, { mode: 6 }, { mode: 4, moddepth: 0.85, modrate: 0.75 }, { mode: 6 }, { mode: 3 }, { mode: 0, feedback: 1.0 }][m];
        return Object.assign({ heads: 4, age: 0.2 }, T);
      },
      desc: 'Twelve delay modes with tap tempo. SOS (the looper) is approximated as a 3 s sound-on-sound delay.',
    }),
    E({
      id: 'ehx.oceans12', name: 'Seas Twelve', ref: 'Electro-Harmonix Oceans 12', cat: 'Reverb', typeName: 'Dual stereo reverb',
      box: 'wide', bw: 280, bh: 250, color: '#153d63', text: '#eef6fb', cost: 2.2, noStd: true, stereo: 'both', jacksTop: true, alwaysOn: true,
      monoPorts: MONO, stereoPorts: STEREO,
      art: { kind: 'ocean', accent: '#7fc4e8', ink: '#eef6fb' },
      logo: 'SEAS 12', logoSize: 22, logoLs: 4, sub: 'DUAL STEREO REVERB', subSize: 6, artTop: 120, artBottom: 186,
      panels: [{ x: 139.4, y: 12, width: 1.2, height: 98, fill: '#eef6fb', opacity: 0.35 }],
      algo: 'chain',
      opts: { chain: [{ prefix: 'a', algo: 'reverb', params: { lowcut: 0.15 } }, { prefix: 'b', algo: 'reverb', params: { lowcut: 0.15 } }] },
      controls: [
        K('a.mix', 'FX LVL', { x: 28, y: 32, r: 10.5, def: 0.35 }), K('a.decay', 'TIME', { x: 70, y: 32, r: 10.5, def: 0.5 }), K('a.tone', 'TONE', { x: 112, y: 32, r: 10.5, def: 0.55 }),
        K('b.mix', 'FX LVL', { x: 168, y: 32, r: 10.5, def: 0.3 }), K('b.decay', 'TIME', { x: 210, y: 32, r: 10.5, def: 0.65 }), K('b.tone', 'TONE', { x: 252, y: 32, r: 10.5, def: 0.5 }),
        SEL('am', 'MODE A', ['HALL', 'SPRING', 'PLATE', 'ROOM', 'MOD', 'SHIM'], { x: 70, y: 88, r: 11, sweep: 220, optSize: 4, labelRadius: 8, labelPos: 'none', virtual: true }),
        SEL('bm', 'MODE B', ['HALL', 'SPRING', 'PLATE', 'ROOM', 'MOD', 'SHIM'], { x: 210, y: 88, r: 11, def: 1, sweep: 220, optSize: 4, labelRadius: 8, labelPos: 'none', virtual: true }),
        FOOT({ action: 'param', p: 'a.on', label: 'A', x: 70, y: 220, r: 12, labelDy: -24 }), FOOT({ action: 'param', p: 'b.on', label: 'B', x: 210, y: 220, r: 12, labelDy: -24 }),
        LED({ x: 100, y: 220, bind: 'param:a.on', color: '#3fa9ff' }), LED({ x: 240, y: 220, bind: 'param:b.on', color: '#3fa9ff' }),
      ],
      initParams: { 'a.on': 1, 'b.on': 0 },
      derive: (p) => {
        const M = [1, 3, 2, 0, 6, 4];
        return { 'a.mode': M[p.am ?? 0], 'b.mode': M[p.bm ?? 1] };
      },
      desc: 'Two reverbs in series, each with its own footswitch and six modes.',
    }),
    E({
      id: 'ehx.cathedral', name: 'Minster', ref: 'Electro-Harmonix Cathedral', cat: 'Reverb', typeName: 'Stereo reverb',
      box: 'xo', bw: 196, bh: 250, color: '#cbcdd0', text: '#1b1b1d', cost: 1.3, noStd: true, stereo: 'both', monoPorts: MONO, stereoPorts: STEREO,
      art: { kind: 'arch', accent: '#b8342a', ink: '#1b1b1d' },
      logo: 'MINSTER', logoSize: 22, logoLs: 4, sub: 'STEREO REVERB', subSize: 6, artTop: 120, artBottom: 196,
      algo: 'reverb', fixed: { lowcut: 0.15 },
      controls: [
        K('mix', 'BLEND', { x: 30, y: 34, r: 11, def: 0.35 }), K('decay', 'TIME', { x: 76, y: 34, r: 11, def: 0.55 }), K('predelay', 'PRE-DLY', { x: 122, y: 34, r: 11, min: 0, max: 300, def: 20, display: ms }), K('tone', 'DAMP', { x: 166, y: 34, r: 11, def: 0.55 }),
        SEL('cmode', 'MODE', ['HALL', 'ROOM', 'PLATE', 'SPRING', 'SHIM', 'ECHO', 'REV', 'MOD'], { x: 98, y: 94, r: 13, sweep: 280, optSize: 4, labelRadius: 9, labelPos: 'none', virtual: true }),
        FOOT({ x: 52, y: 222, r: 12 }), LED({ x: 52, y: 200, color: '#ff2a1a' }), FOOT({ action: 'param', p: 'inf', label: 'INFINITE', x: 144, y: 222, r: 12, labelDy: -24 }), LED({ x: 170, y: 222, bind: 'param:inf', color: '#3ddc84' }),
      ],
      derive: (p) => {
        const T = [{ mode: 1 }, { mode: 0 }, { mode: 2 }, { mode: 3 }, { mode: 4 }, { mode: 8, predelay: Math.max(p.predelay ?? 20, 180) }, { mode: 9 }, { mode: 6, mod: 0.8 }][p.cmode ?? 0];
        return Object.assign({ mod: 0.3 }, T, p.inf ? { decay: 0.99 } : {});
      },
      desc: 'Eight reverbs. The INFINITE switch holds the tail. REVERSE is approximated with the swell reverb.',
    }),
    E({
      id: 'ehx.memoryboy', name: 'Recall Boy', ref: 'Electro-Harmonix Memory Boy', cat: 'Delay', typeName: 'Analog delay with chorus / vibrato',
      box: 'xo', bh: 270, color: '#c4c6c9', text: '#3a1414',
      art: { kind: 'echo', accent: '#a5241f', r: 9, n: 7, top: true },
      logo: 'RECALL BOY', logoSize: 19, logoLs: 1.4, sub: 'ANALOG DELAY', subSize: 6,
      algo: 'delay', opts: { maxMs: 600, fixedMode: 1 }, fixed: { tone: 0.38, age: 0.35 },
      controls: [K('mix', 'BLEND', { def: 0.45 }), K('feedback', 'FEEDBACK', { def: 0.4, max: 1.05 }), K('time', 'DELAY', { min: 30, max: 550, def: 300, display: ms }),
        K('moddepth', 'DEPTH', { def: 0.15 }), K('modrate', 'RATE', { def: 0.3 }), TOG('vib', '', ['CHORUS', 'VIB'], { orient: 'h', virtual: true })],
      rows: [3, 2],
      derive: (p) => (p.vib ? { mix: Math.max(p.mix ?? 0.45, 0.85) } : {}),
      desc: 'Compact analog delay with chorus or vibrato on the repeats.',
    }),
    P({
      id: 'ehx.picocanyon', name: 'Pico Gorge Echo', ref: 'Electro-Harmonix Pico Canyon Echo', cat: 'Delay', typeName: 'Digital delay',
      color: '#d07a36', text: '#2a1608', art: { kind: 'canyon', accent: '#8d3f17', ink: '#4a1f0b', sun: '#f5d27a' },
      logo: 'GORGE ECHO', logoSize: 15, logoLs: 1.4, sub: 'DIGITAL DELAY', subSize: 5.6,
      algo: 'delay', opts: { maxMs: 3000 }, fixed: { mode: 0 }, tapFoot: true,
      controls: [K('mix', 'FX LVL', { def: 0.4 }), K('feedback', 'FDBK', { def: 0.35, max: 1.05 }), K('time', 'DELAY', { min: 20, max: 3000, def: 420, curve: 'log', display: ms }), K('tone', 'FILTER', { def: 0.6 })],
      desc: 'Simple digital delay with a filter knob. Hold the footswitch to tap the tempo.',
    }),
    P({
      id: 'ehx.picorerun', name: 'Pico Replay Tape', ref: 'Electro-Harmonix Pico Rerun Tape Delay', cat: 'Delay', typeName: 'Tape delay',
      color: '#6b4a32', text: '#f3e6d2', art: { kind: 'reels', accent: '#d9b98a', ink: '#2a1a0e' },
      logo: 'REPLAY', logoSize: 17, logoLs: 2, sub: 'TAPE DELAY', subSize: 5.6,
      algo: 'delay', opts: { maxMs: 1200 }, fixed: { mode: 2, heads: 4, tone: 0.45, modrate: 0.35 },
      controls: [K('mix', 'MIX', { def: 0.4 }), K('feedback', 'FDBK', { def: 0.4, max: 1.05 }), K('time', 'DELAY', { min: 40, max: 1200, def: 360, display: ms }), K('sat', 'SAT', { def: 0.35 }),
        TOG('flutter', 'FLUTTER', ['1', '2', '3'], { orient: 'h', virtual: true })],
      derive: (p) => { const f = p.flutter ?? 0; return { moddepth: [0.1, 0.3, 0.55][f], age: [0.3, 0.5, 0.7][f] }; },
    }),
    P({
      id: 'ehx.picooceans', name: 'Pico Seas 3-Verb', ref: 'Electro-Harmonix Pico Oceans 3-Verb', cat: 'Reverb', typeName: 'Reverb', cost: 1.1,
      color: '#5b9fd0', text: '#0f2436', art: { kind: 'ocean', accent: '#d8eefa', ink: '#0f2436' },
      logo: 'SEAS 3', logoSize: 17, logoLs: 2, sub: 'REVERB', subSize: 5.6,
      algo: 'reverb', fixed: { lowcut: 0.15 },
      controls: [K('mix', 'FX LVL', { def: 0.35 }), K('decay', 'TIME', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('predelay', 'PRE-DLY', { min: 0, max: 250, def: 20, display: ms }),
        TOG('omode', '', ['SPRING', 'PLATE', 'HALL'], { orient: 'h', def: 2, virtual: true })],
      derive: (p) => ({ mode: [3, 2, 1][p.omode ?? 2] }),
    }),
    P({
      id: 'ehx.picoshimmer', name: 'Pico Glimmer', ref: 'Electro-Harmonix Pico Shimmer', cat: 'Reverb', typeName: 'Shimmer reverb', cost: 1.2,
      color: '#ece7da', text: '#3a2c0e', art: { kind: 'cosmos', accent: '#d6a83a', ink: '#3a2c0e' },
      logo: 'GLIMMER', logoSize: 17, logoLs: 2, sub: 'SHIMMER REVERB', subSize: 5.6,
      algo: 'reverb', fixed: { mode: 4, lowcut: 0.2 },
      controls: [K('mix', 'FX LVL', { def: 0.35 }), K('decay', 'TIME', { def: 0.6 }), K('tone', 'TONE', { def: 0.55 }), K('shimmer', 'SHIMMER', { def: 0.5 })],
    }),
    // ---- modulation
    E({
      id: 'ehx.smallclone', name: 'Small Twin', ref: 'Electro-Harmonix Small Clone', cat: 'Modulation', typeName: 'Analog chorus',
      box: 'nano', color: '#c6c8cb', text: '#121a2c',
      art: { kind: 'clone', ink: '#121a2c', accent: '#2c64b4' },
      logo: 'small twin', logoSize: 22, logoFont: "'Inter', sans-serif", logoWeight: 800, logoLs: -0.4, sub: 'CHORUS', subSize: 6.4,
      algo: 'chorus', fixed: { mix: 0.5, mode: 0 },
      controls: [K('rate', 'RATE', { def: 0.35, r: 14 }), TOG('deep', 'DEPTH', ['LO', 'HI'], { orient: 'h', virtual: true })],
      derive: (p) => ({ depth: p.deep ? 0.8 : 0.4 }),
      desc: 'The classic grunge chorus: one RATE knob and a DEPTH switch.',
    }),
    E({
      id: 'ehx.goodvibes', name: 'Groovy Vibes', ref: 'Electro-Harmonix Good Vibes', cat: 'Modulation', typeName: 'Analog modulator',
      box: 'xo', color: '#5c3a86', text: '#f4ecff',
      art: { kind: 'swirl', accent: '#f2b84b', ink: '#f4ecff' },
      logo: 'GROOVY VIBES', logoSize: 18, logoLs: 1.4, sub: 'ANALOG MODULATOR', subSize: 6,
      algo: 'vibe', ctrl: { ins: [{ label: 'EXP', param: 'speed', min: 0, max: 1 }] },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('intensity', 'DEPTH', { def: 0.7 }), K('speed', 'RATE', { def: 0.4 }), K('tone', 'TONE', { def: 0.6 }), TOG('mode', '', ['CHORUS', 'VIBRATO'], { orient: 'h' })],
      desc: 'Photocell vibe in chorus or vibrato mode. An expression pedal can control the speed.',
    }),
    E({
      id: 'ehx.pulsar', name: 'Nano Pulse', ref: 'Electro-Harmonix Nano Pulsar', cat: 'Modulation', typeName: 'Tremolo',
      box: 'nano', color: '#c9cbce', text: '#141414',
      art: { kind: 'pulse', accent: '#c8161d', ink: '#141414' },
      logo: 'NANO PULSE', logoSize: 18, logoLs: 1.2, sub: 'TREMOLO', subSize: 6.4,
      algo: 'tremolo', fixed: { mode: 0 },
      controls: [K('rate', 'RATE', { def: 0.4 }), K('depth', 'DEPTH', { def: 0.6 }), K('shape', 'SHAPE', { def: 0.5, virtual: true }), TOG('sq', 'WAVE', ['TRI', 'SQR'], { orient: 'h', virtual: true })],
      derive: (p) => ({ wave: p.sq ? 0.7 + 0.3 * (p.shape ?? 0.5) : 0.4 * (p.shape ?? 0.5) }),
    }),
    // ---- drives / fuzz / boost
    E({
      id: 'ehx.satisfaction', name: 'Content Fuzz', ref: 'Electro-Harmonix Satisfaction Fuzz', cat: 'Fuzz', typeName: 'Vintage fuzz',
      box: 'nano', color: '#e8dfc6', text: '#2a1608',
      art: { kind: 'rise', ink: '#2a1608', accent: '#e06a1a' },
      logo: 'CONTENT', logoSize: 21, logoLs: 2, logoColor: '#d0561a', sub: 'FUZZ', subSize: 7, subLs: 3,
      algo: 'drive', opts: { clip: 'ge', bias: 0.45, preHp: 150, gainMinDb: 20, gainMaxDb: 46, tone: 'none', postLp: 4200, levelMaxDb: 0, outTrim: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.55, display: ten }), K('gain', 'ATTACK', { def: 0.7, display: ten })],
      desc: 'Buzzy 1960s fuzz-tone sound with VOLUME and ATTACK.',
    }),
    E({
      id: 'ehx.trianglemuff', name: 'Nano Triangle Murk', ref: 'Electro-Harmonix Nano Triangle Big Muff Pi', cat: 'Fuzz', typeName: 'Distortion / sustainer',
      box: 'nano', color: '#dadad5', text: '#141414', kstyle: 'muff',
      art: { kind: 'tri', accent: '#c8161d', ty: 12, by: 120 },
      logo: 'TRIANGLE', logoSize: 18, logoLs: 2, logoColor: '#141414', sub: 'MURK π', subSize: 8, subLs: 3,
      algo: 'drive', opts: muffV({ blendLp: 480, blendHp: 1250, gainMaxDb: 50, postLp: 9500 }),
      controls: [K('level', 'VOLUME', { display: ten, x: 36, y: 86, r: 11.5 }), K('tone', 'TONE', { display: ten, x: 70, y: 40, r: 11.5 }), K('gain', 'SUSTAIN', { display: ten, def: 0.6, x: 104, y: 86, r: 11.5 })],
      artTop: 124,
      desc: 'Early-70s Big Muff voice with the knobs in a triangle. Scooped, smooth and loud.',
    }),
    E({
      id: 'ehx.deluxemuff', name: 'Deluxe Murk π', ref: 'Electro-Harmonix Deluxe Big Muff Pi', cat: 'Fuzz', typeName: 'Distortion / sustainer',
      box: 'wide', bw: 270, bh: 250, color: '#d4d4cf', text: '#141414', kstyle: 'muff', cost: 1, noStd: true,
      art: { kind: 'muff', noPi: true, accent: '#c8161d', ink: '#141414' },
      logo: 'DELUXE MURK π', logoSize: 22, logoColor: '#f7f5ef', logoStroke: '#141414', logoStrokeW: 3, logoLs: 1.4, artTop: 122, artBottom: 182,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'g', algo: 'gate', on: true, params: { threshold: 0.2, decay: 0.3 } },
        { prefix: 'd', algo: 'drive', opts: muffV({ modes: [{}, { preHp: 160, gainMaxDb: 46 }] }) },
        { prefix: 'e', algo: 'peq', on: false, params: { mid1q: 1 } },
      ] },
      controls: [
        K('d.level', 'VOLUME', { x: 34, y: 36, r: 12, display: ten }), K('d.tone', 'TONE', { x: 84, y: 36, r: 12, display: ten }), K('d.gain', 'SUSTAIN', { x: 134, y: 36, r: 12, def: 0.6, display: ten }),
        K('g.threshold', 'GATE', { x: 184, y: 36, r: 12, def: 0.2 }), K('e.mid1gain', 'MIDS', { x: 236, y: 36, r: 12, min: -15, max: 15, def: 6, display: db }),
        K('e.mid1freq', 'FREQ', { x: 184, y: 92, r: 10, min: 200, max: 3000, def: 800, curve: 'log' }), K('e.mid1q', 'Q', { x: 236, y: 92, r: 10, min: 0.4, max: 4, def: 1 }),
        TOG('d.mode', 'ATTACK', ['NORM', 'HI'], { x: 70, y: 96, orient: 'h' }),
        FOOT({ x: 70, y: 216, r: 12 }), LED({ x: 70, y: 194, color: '#ff2a1a' }), FOOT({ action: 'param', p: 'e.on', label: 'MIDS', x: 200, y: 216, r: 12, labelDy: -24 }), LED({ x: 226, y: 216, bind: 'param:e.on', color: '#3ddc84' }),
      ],
      ctrl: { ins: [{ label: 'EXP', param: 'd.gain', min: 0, max: 1 }] },
      desc: 'Big Muff with a noise gate, an attack switch and a footswitchable mid EQ.',
    }),
    E({
      id: 'ehx.eastriver', name: 'East Bank Drive', ref: 'Electro-Harmonix East River Drive', cat: 'Overdrive', typeName: 'Classic overdrive',
      box: 'nano', color: '#3a8a4e', text: '#f2f7ef',
      art: { kind: 'bridge', accent: '#bfe3c4', ink: '#f2f7ef' },
      logo: 'EAST BANK', logoSize: 19, logoLs: 1.6, sub: 'OVERDRIVE', subSize: 6.4,
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 0, gainMaxDb: 41, tone: 'ts', toneLo: 720, postLp: 5000, levelMaxDb: 5 },
      controls: [K('level', 'VOLUME', { display: ten, def: 0.6 }), K('tone', 'TONE', { display: ten }), K('gain', 'DRIVE', { display: ten, def: 0.45 })],
      desc: 'Green-box style overdrive: mid push, smooth clipping.',
    }),
    E({
      id: 'ehx.screamingbird', name: 'Shrieking Bird', ref: 'Electro-Harmonix Screaming Bird', cat: 'Boost', typeName: 'Treble booster',
      box: 'nano', color: '#c9cbce', text: '#141414',
      art: { kind: 'bird', accent: '#c8161d', ink: '#141414' },
      logo: 'SHRIEKING BIRD', logoSize: 15.5, logoLs: 0.8, sub: 'TREBLE BOOSTER', subSize: 6,
      algo: 'boost', opts: { gainMaxDb: 22 }, fixed: { mode: 1, level: 1 },
      controls: [K('gain', 'VOLUME', { def: 0.18, display: ten })],
    }),
    E({
      id: 'ehx.hottubes', name: 'Nano Warm Tubes', ref: 'Electro-Harmonix Nano Hot Tubes', cat: 'Overdrive', typeName: 'Tube-style overdrive',
      box: 'nano', color: '#c9cbce', text: '#2a1404',
      art: { kind: 'wax', accent: '#e06a1a', ink: '#2a1404', candles: [0] },
      logo: 'WARM TUBES', logoSize: 18, logoLs: 1.2, sub: 'OVERDRIVE', subSize: 6.4,
      algo: 'drive', opts: { clip: 'tube', stages: 2, stage2Db: 10, bias: 0.25, preHp: 60, gainMinDb: 4, gainMaxDb: 42, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 8000, levelMaxDb: 6 },
      controls: [K('level', 'VOLUME', { display: ten }), K('tone', 'TONE', { display: ten }), K('gain', 'TUBES', { display: ten, def: 0.45 })],
    }),
    E({
      id: 'ehx.octavix', name: 'Octavox', ref: 'Electro-Harmonix Octavix', cat: 'Fuzz', typeName: 'Octave fuzz',
      box: 'nano', color: '#c9cbce', text: '#0f2a3c', cost: 1,
      art: { kind: 'pog', accent: '#1f8fc4', ink: '#0f2a3c' },
      logo: 'OCTAVOX', logoSize: 21, logoLs: 2, sub: 'OCTAVE FUZZ', subSize: 6.4,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', preHp: 120, gainMinDb: 14, gainMaxDb: 40, tone: 'none', postLp: 6500, levelMaxDb: 0, outTrim: 0.7 } },
        { prefix: 'o', algo: 'pitch', params: { semis1: 12, level1: 0.6, dry: 0.85, quality: 0, tone: 0.8 } },
      ] },
      fixed: { 'o.semis1': 12, 'o.quality': 0 },
      controls: [K('f.level', 'VOLUME', { def: 0.5 }), K('o.level1', 'OCTAVE', { def: 0.6 }), K('f.gain', 'BOOST', { def: 0.6 }), TOG('v24', '', ['9V', '24V'], { orient: 'h', virtual: true })],
      derive: (p) => ({ 'f.sag': p.v24 ? 0 : 0.35 }),
      desc: 'Octave-up fuzz. The 24V setting gives more headroom and a cleaner octave.',
    }),
    // ---- filters / dynamics
    E({
      id: 'ehx.doctorq', name: 'Professor Q', ref: 'Electro-Harmonix Doctor Q', cat: 'Filter', typeName: 'Envelope follower',
      box: 'nano', color: '#c9cbce', text: '#141414',
      art: { kind: 'env', accent: '#2a2a2a', ink: '#141414' },
      logo: 'PROFESSOR Q', logoSize: 17, logoLs: 1, sub: 'ENVELOPE FOLLOWER', subSize: 6,
      algo: 'wah', opts: { mode: 2, fLo: 250, fHi: 2600, q: 4.5 }, fixed: { mode: 2, filter: 1, q: 0.55, level: 0.36 },
      controls: [K('sens', 'RANGE', { def: 0.55, r: 14 }), TOG('bass', '', ['NORM', 'BASS'], { orient: 'h', virtual: true })],
      derive: (p) => ({ range: p.bass ? 0.25 : 0.5 }),
      desc: 'Funky envelope filter. BASS shifts the sweep lower.',
    }),
    E({
      id: 'ehx.bassballs', name: 'Nano Bass Orbs', ref: 'Electro-Harmonix Nano Bassballs', cat: 'Filter', typeName: 'Twin envelope filter',
      box: 'nano', color: '#c9cbce', text: '#2a0f0f',
      art: { kind: 'env', accent: '#c8161d', ink: '#2a0f0f' },
      logo: 'BASS ORBS', logoSize: 19, logoLs: 1.4, sub: 'TWIN ENVELOPE FILTER', subSize: 5.8,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'd', algo: 'drive', on: false, opts: { clip: 'si', preHp: 40, gainMinDb: 12, gainMaxDb: 30, tone: 'none', postLp: 5000, levelMaxDb: -2 } },
        { prefix: 'w', algo: 'wah', opts: { mode: 2, fLo: 150, fHi: 1800, q: 5 }, params: { mode: 2, filter: 1 } },
      ] },
      fixed: { 'w.level': 0.38 },
      controls: [K('w.sens', 'SENS', { def: 0.55 }), K('w.q', 'RESPONSE', { def: 0.5 }), TOG('d.on', 'DIST', ['OFF', 'ON'], { orient: 'h' })],
      desc: 'Twin resonant envelope filter for bass, with an optional fuzz before it.',
    }),
    E({
      id: 'ehx.soulpreacher', name: 'Nano Spirit Preacher', ref: 'Electro-Harmonix Nano Soul Preacher', cat: 'Dynamics', typeName: 'Compressor / sustainer',
      box: 'nano', color: '#c9cbce', text: '#13213f',
      art: { kind: 'platform', ink: '#13213f', accent: '#2f6fd0' },
      logo: 'SPIRIT PREACHER', logoSize: 14.5, logoLs: 0.6, sub: 'COMPRESSOR / SUSTAINER', subSize: 5.6,
      algo: 'comp', opts: { type: 'ota' },
      controls: [K('level', 'VOLUME', { def: 0.4 }), K('sustain', 'SUSTAIN', { def: 0.55 }), TOG('att', 'ATTACK', ['FAST', 'SLOW'], { orient: 'h', virtual: true })],
      derive: (p) => ({ attack: p.att ? 0.6 : 0.15 }),
    }),
    E({
      id: 'ehx.tonecorset', name: 'Tone Bodice', ref: 'Electro-Harmonix Tone Corset', cat: 'Dynamics', typeName: 'Analog compressor',
      box: 'nano', bh: 262, color: '#d8b39f', text: '#2a1410',
      art: { kind: 'platform', ink: '#2a1410', accent: '#8a2f4a' },
      logo: 'TONE BODICE', logoSize: 17, logoLs: 1, sub: 'ANALOG COMPRESSOR', subSize: 6,
      algo: 'comp', opts: { type: 'vca' }, fixed: { release: 0.4 },
      controls: [K('level', 'VOLUME', { def: 0.36 }), K('blend', 'BLEND', { def: 0.8 }), K('sustain', 'SUSTAIN', { def: 0.5 }), K('attack', 'ATTACK', { def: 0.3 }), TOG('ratio', 'RATIO', ['LO', 'HI'], { orient: 'h', values: [0.35, 0.75] })],
    }),
    E({
      id: 'ehx.mole', name: 'Nano Burrow', ref: 'Electro-Harmonix Nano Mole', cat: 'Boost', typeName: 'Bass booster',
      box: 'nano', color: '#c9cbce', text: '#141414',
      art: { kind: 'rise', ink: '#141414', accent: '#5a3a1a' },
      logo: 'BURROW', logoSize: 22, logoLs: 3, sub: 'BASS BOOSTER', subSize: 6.4,
      algo: 'boost', opts: { gainMaxDb: 18 }, fixed: { mode: 3, level: 1, treble: 0.4 },
      controls: [K('gain', 'VOLUME', { def: 0.18, display: ten }), K('bass', 'BASS', { def: 0.6, display: ten })],
      desc: 'Low-end booster that adds weight under the guitar or bass.',
    }),
    // ---- pico line
    P({
      id: 'ehx.picopitchfork', name: 'Pico Tuning Prong', ref: 'Electro-Harmonix Pico Pitch Fork', cat: 'Pitch', typeName: 'Pitch shifter', cost: 0.8,
      color: '#d7d9dc', text: '#14213d', art: { kind: 'fork', ink: '#14213d', accent: '#2f6fd0' },
      logo: 'PRONG', logoSize: 18, logoLs: 2, sub: 'PITCH SHIFTER', subSize: 5.6,
      algo: 'pitch', fixed: { quality: 1 },
      controls: [K('blend', 'BLEND', { def: 0.5, virtual: true }), SEL('shift', 'SHIFT', ['1', '2', '3', '4', '5', '7', 'OCT', '2OCT'], { def: 6, sweep: 280, optSize: 3.6, labelRadius: 7, labelPos: 'none', virtual: true }),
        TOG('dir', '', ['UP', 'DOWN', 'DUAL'], { orient: 'h', virtual: true })],
      derive: (p) => {
        const iv = [1, 2, 3, 4, 5, 7, 12, 24][p.shift ?? 6], b = p.blend ?? 0.5, wet = Math.sin(b * Math.PI / 2), dir = p.dir ?? 0;
        return { semis1: dir === 1 ? -iv : iv, semis2: -iv, level1: wet, level2: dir === 2 ? wet : 0, dry: Math.cos(b * Math.PI / 2), cents: 0 };
      },
    }),
    P({
      id: 'ehx.picopog', name: 'Pico Poly Octaver', ref: 'Electro-Harmonix Pico POG', cat: 'Pitch', typeName: 'Polyphonic octave', cost: 0.8,
      color: '#d2d4d6', text: '#151617', art: { kind: 'pog', accent: '#c8161d', ink: '#151617' },
      logo: 'POLY OCT', logoSize: 17, logoLs: 1.6, sub: 'OCTAVE GENERATOR', subSize: 5.4,
      algo: 'pitch', fixed: { semis1: 12, semis2: -12, quality: 1 },
      controls: [K('dry', 'DRY', { def: 0.9 }), K('level2', 'SUB', { def: 0.5 }), K('level1', 'OCT UP', { def: 0.4 }), TOG('filt', 'TONE', ['1', '2', '3'], { orient: 'h', values: [1, 0.6, 0.3] })],
      derive: (p) => ({ tone: p.filt ?? 1 }),
    }),
    P({
      id: 'ehx.picofreeze', name: 'Pico Deep Ice', ref: 'Electro-Harmonix Pico Deep Freeze', cat: 'Synth', typeName: 'Sound retainer', cost: 1,
      color: '#e6eef5', text: '#1b4a85', art: { kind: 'snow', accent: '#3f86d6', ink: '#1b4a85' },
      logo: 'DEEP ICE', logoSize: 17, logoLs: 2, sub: 'SOUND RETAINER', subSize: 5.6,
      algo: 'freeze', fixed: { decay: 1 },
      controls: [K('mix', 'EFFECT', { def: 0.7 }), K('dry', 'DRY', { def: 1 }), K('speed', 'SPEED', { def: 0.35 }), K('layer', 'GLISS', { def: 0.2 }),
        TOG('smode', '', ['LATCH', 'MOM', 'AUTO'], { orient: 'h', virtual: true })],
      derive: (p) => ({ mode: [0, 1, 2][p.smode ?? 0] }),
      desc: 'LATCH: press to freeze. MOM: hold to sustain. AUTO: every new note is held (footswitch = bypass).',
    }),
    P({
      id: 'ehx.picotriboro', name: 'Pico Three Borough', ref: 'Electro-Harmonix Pico Triboro Bridge', cat: 'Overdrive', typeName: 'Overdrive / distortion / fuzz',
      color: '#e2b43a', text: '#1d1606', art: { kind: 'bridge', accent: '#7a4a10', ink: '#1d1606' },
      logo: '3 BOROUGH', logoSize: 15, logoLs: 1.2, sub: 'DRIVE', subSize: 5.6,
      algo: 'drive', opts: { preHp: 80, tone: 'tilt', eqRangeDb: 9, levelMaxDb: 6,
        modes: [{ clip: 'ts', gainMinDb: 2, gainMaxDb: 36 }, { clip: 'diode', gainMinDb: 8, gainMaxDb: 46, levelMaxDb: 3 }, { clip: 'si', bias: 0.3, gainMinDb: 16, gainMaxDb: 48, postLp: 5500, levelMaxDb: 0 }] },
      controls: [K('level', 'VOL', { def: 0.5 }), K('gain', 'GAIN', { def: 0.45 }), K('tone', 'EQ', { def: 0.5 }), TOG('mode', '', ['OD', 'DIST', 'FUZZ'], { orient: 'h' })],
    }),
  ]);

  function nineSeries() {
    const N = (o) => E(Object.assign({ box: 'nine', kstyle: 'nine', cost: 1.2, cat: 'Synth' }, o));
    const small = (p, l, x, o = {}) => K(p, l, Object.assign({ x, y: 30, r: 9.5, kstyle: 'ehx', labelSize: 6.2 }, o));
    const nineSel = (p, opts) => SEL(p, '', opts, { x: 96, y: 98, r: 17, sweep: 300, optSize: 5, labelRadius: 11, labelPos: 'none', virtual: true });
    const nineOpts = { artTop: 130, artBottom: 198, badgeY: 191, logoY: 162, subY: 180 };
    const melTab = [
      { mode: 3, octave: 0, filter: 0.55, reso: 0.2, mod: 0.25 }, { mode: 3, octave: -1, filter: 0.45, reso: 0.2, mod: 0.3 }, { mode: 3, octave: 0, filter: 0.72, reso: 0.25, mod: 0.45 },
      { mode: 0, octave: 0, filter: 0.3, reso: 0.1, mod: 0.35 }, { mode: 0, octave: 0, filter: 0.5, reso: 0.25, mod: 0.15 }, { mode: 6, octave: -1, filter: 0.45, reso: 0.15, mod: 0.4 },
      { mode: 4, octave: 0, filter: 0.6, reso: 0.3, mod: 0.15 }, { mode: 1, octave: 0, filter: 0.5, reso: 0.35, mod: 0.2 }, { mode: 3, octave: 1, filter: 0.65, reso: 0.2, mod: 0.35 },
    ];
    const synTab = [
      { mode: 6, octave: 0 }, { mode: 4, octave: 0 }, { mode: 5, octave: -1 }, { mode: 1, octave: 0 }, { mode: 0, octave: 0 },
      { mode: 1, octave: -1 }, { mode: 6, octave: 1 }, { mode: 7, octave: 0 }, { mode: 3, octave: 0 },
    ];
    const orgTab = (rows) => rows.map(([octave, filter, decay, rot]) => ({ 's.octave': octave, 's.filter': filter, 's.decay': decay, rot }));
    const organ = (o, tab) => N(Object.assign({
      algo: 'chain',
      opts: { chain: [{ prefix: 's', algo: 'synth', params: { mode: 2, sens: 0.5, reso: 0.1 } }, { prefix: 'r', algo: 'rotary', params: { drive: 0.15, balance: 0.5 } }] },
      controls: [
        small('s.dry', 'DRY', 32, { def: 0.6 }), small('s.wet', 'ORGAN', 74, { def: 0.8 }), small('omod', 'MOD', 118, { def: 0.3, virtual: true }), small('click', 'CLICK', 160, { def: 0.4, virtual: true }),
        nineSel('voice', o.voices),
      ],
      derive: (p) => {
        const { rot, ...t } = tab[p.voice ?? 0], m = p.omod ?? 0.3, c = p.click ?? 0.4;
        return Object.assign({}, t, { 's.mode': 2, 's.attack': 0.22 * (1 - c), 's.mod': 0.15 + 0.5 * c, 'r.on': m > 0.04 || rot ? 1 : 0, 'r.mix': Math.max(m, rot ? 0.6 : 0), 'r.speed': m > 0.62 ? 1 : 0 });
      },
    }, nineOpts, o));
    return [
      N(Object.assign({
        id: 'ehx.mel9', name: 'Melo-9 Tape Replay', ref: 'Electro-Harmonix MEL9', typeName: 'Tape replay machine',
        color: '#c9ccd2', text: '#1a2440', art: { kind: 'keys', ink: '#1a2440', kh: 14 },
        logo: 'MELO·9', logoSize: 28, logoLs: 3, logoColor: '#2c4f9e', sub: 'TAPE REPLAY MACHINE', subSize: 6.6,
        algo: 'synth', fixed: { sens: 0.5 },
        controls: [
          small('dry', 'DRY', 32, { def: 0.6 }), small('wet', 'EFFECT', 74, { def: 0.75 }), small('attack', 'ATTACK', 118, { def: 0.35 }), small('decay', 'SUSTAIN', 160, { def: 0.7 }),
          nineSel('voice', ['ORCH', 'CELLO', 'VIOLIN', 'FLUTE', 'CLARNT', 'CHOIR', 'BRASS', 'SAX', 'STR II']),
        ],
        derive: (p) => melTab[p.voice ?? 0],
      }, nineOpts)),
      N(Object.assign({
        id: 'ehx.synth9', name: 'Synth-9 Machine', ref: 'Electro-Harmonix SYNTH9', typeName: 'Synthesizer machine',
        color: '#18191d', text: '#e9edf3', art: { kind: 'synthwave', accent: '#38c6e8', ink2: '#e05ab8' },
        logo: 'SYNTH·9', logoSize: 28, logoLs: 3, logoColor: '#38c6e8', sub: 'SYNTHESIZER MACHINE', subSize: 6.6,
        algo: 'synth', fixed: { sens: 0.5, attack: 0.08, decay: 0.7, mod: 0.3 },
        controls: [
          small('dry', 'DRY', 32, { def: 0.5 }), small('wet', 'SYNTH', 74, { def: 0.8 }), small('filter', 'CTRL 1', 118, { def: 0.5 }), small('reso', 'CTRL 2', 160, { def: 0.4 }),
          nineSel('voice', ['POLY', 'BRASS', 'BASS', 'LEAD', 'SQUARE', 'SAW SUB', 'PAD+', 'SWEEP', 'STRINGS']),
        ],
        derive: (p) => synTab[p.voice ?? 0],
      }, nineOpts)),
      organ({
        id: 'ehx.b9', name: 'Organ-9 B', ref: 'Electro-Harmonix B9 Organ Machine', typeName: 'Organ machine',
        color: '#1c1c1e', text: '#f2e6d0', art: { kind: 'keys', ink: '#1c1c1e', paper2: '#f2e6d0', kh: 14 },
        logo: 'ORGAN·9B', logoSize: 26, logoLs: 2.4, logoColor: '#ec8a2a', sub: 'ORGAN MACHINE', subSize: 6.6,
        voices: ['FAT', 'JAZZ', 'GOSPEL', 'CL ROCK', 'BELL', 'CATHDRL', 'CONTI', 'BASS+', 'SHIMMER'],
      }, orgTab([[0, 0.55, 0.9, 0], [0, 0.4, 0.8, 0], [0, 0.65, 0.9, 1], [0, 0.7, 0.9, 1], [1, 0.8, 0.45, 0], [-1, 0.6, 1, 0], [1, 0.75, 0.85, 0], [-1, 0.35, 0.9, 0], [1, 0.85, 0.95, 1]])),
      organ({
        id: 'ehx.c9', name: 'Organ-9 C', ref: 'Electro-Harmonix C9 Organ Machine', typeName: 'Organ machine',
        color: '#5b6067', text: '#f4f4f2', art: { kind: 'keys', ink: '#22252a', paper2: '#f4f4f2', kh: 14 },
        logo: 'ORGAN·9C', logoSize: 26, logoLs: 2.4, logoColor: '#ffd23f', sub: 'ORGAN MACHINE', subSize: 6.6,
        voices: ['BLUES', 'PROG', 'SOUL', 'TONEWHL', 'BELLS', 'SYMPH', 'PIPE', 'BASS', 'D-BAR'],
      }, orgTab([[0, 0.5, 0.9, 1], [0, 0.75, 0.9, 0], [0, 0.6, 0.85, 1], [0, 0.55, 0.9, 0], [1, 0.85, 0.4, 0], [0, 0.65, 1, 0], [-1, 0.7, 1, 0], [-1, 0.35, 0.85, 0], [0, 0.6, 0.9, 1]])),
    ];
  }
}
