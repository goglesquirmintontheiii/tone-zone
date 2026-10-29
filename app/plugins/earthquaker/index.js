// Built-in Tone Zone plugin: EarthQuaker Devices.
// Blocks inspired by EarthQuaker Devices pedals. Names and artwork are Tone Zone originals; control layouts,
// colours and switch / LED arrangements follow the real units (see each block's `ref`).
//
// One custom enclosure ("eqd-print") serves the family: a screen-printed look with bold two-colour artwork drawn
// with wobbly hand-drawn outlines, halftone dots and chunky cartoon lettering. Per-block art parameters:
// `color` (body), `ink` (line / dark ink), `ink2` (accent ink), `scene` (illustration), `size` (b / n / w / x).
export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, def, db, ms } = tz.helpers;
  const { svg, label, formKit, noisePattern } = tz.gfx;

  let seq = 0;
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = (seed) => { let s = (seed % 2147483646) + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  const SIZES = { b: [104, 200], n: [124, 238], w: [172, 232], x: [208, 258] };
  const KR = { b: 10, n: 11, w: 12, x: 12.5 };

  const placed = new WeakSet(); // controls this form positioned (forms re-run on every redraw)
  function layout(def, W, H, sz) {
    const cs = def.controls;
    cs.forEach((c) => { if (c.x === undefined) placed.add(c); });
    const isFree = (c) => placed.has(c);
    const free = (ts) => cs.filter((c) => ts.includes(c.t) && isFree(c));
    const knobs = free(['knob', 'sel']).filter((c) => !c.togRow), togs = cs.filter((c) => isFree(c) && (c.t === 'toggle' || c.t === 'button' || c.togRow));
    const feet = free(['foot']), leds = free(['led']);
    const rows = [];
    let i = 0;
    for (const n of def.rows || []) { rows.push(knobs.slice(i, i + n)); i += n; }
    while (i < knobs.length) { rows.push(knobs.slice(i, i + 3)); i += 3; }
    let y = 15;
    rows.filter((r) => r.length).forEach((row, ri) => {
      const r = row[0].r || def.knobR || KR[sz];
      const hasSel = row.some((c) => c.t === 'sel');
      y += hasSel ? r + 14 : r + 11;
      const n = row.length;
      const span = (def.rowSpan && def.rowSpan[ri]) || (n === 2 ? 0.8 : n >= 4 ? 0.98 : 0.94);
      row.forEach((c, k) => {
        c.x = W / 2 + (k - (n - 1) / 2) * ((W * span) / n);
        c.y = y;
        c.r = c.r || r;
        if (c.t === 'sel') Object.assign(c, { labelPos: c.labelPos || 'below', optSize: c.optSize || 4.4, labelRadius: c.labelRadius ?? 6.5, labelSize: 5.6 });
        else c.labelPos = c.labelPos || 'above';
      });
      y += (hasSel ? r + 15 : r + 2) + 4;
    });
    if (togs.length) {
      const sel = togs.find((c) => c.t === 'sel');
      if (sel && togs.length === 3) { const o = togs.filter((c) => c !== sel); togs.splice(0, 3, o[0], sel, o[1]); }
      const sr = sel ? sel.r || 11 : 0;
      y += sel ? Math.max(16, sr + 13) : 16;
      const n = togs.length;
      togs.forEach((c, k) => {
        c.x = W / 2 + (k - (n - 1) / 2) * ((W * (n === 2 ? 0.8 : 0.9)) / n);
        c.y = y;
        if (c.t === 'toggle') c.orient = c.orient || 'h';
        if (c.t === 'sel') Object.assign(c, { r: sr, labelPos: c.labelPos || 'below', optSize: c.optSize || 4.4, labelRadius: c.labelRadius ?? 6.5, labelSize: 5.6 });
      });
      y += sel ? sr + 14 : 18;
    }
    const footY = H - 32;
    const fx = feet.length === 1 ? [W / 2] : feet.length === 2 ? [W * 0.27, W * 0.73] : [W * 0.2, W * 0.5, W * 0.8];
    feet.forEach((f, k) => Object.assign(f, { x: fx[k], y: footY, r: f.r || 12, style: f.style || 'stomp' }));
    leds.forEach((l, k) => Object.assign(l, { x: fx[k] ?? W / 2, y: footY - 27, r: l.r || 2.8 }));
    return { y0: y, y1: leds.length ? footY - 37 : footY - 24, footY, nFeet: feet.length };
  }

  // ------------------------------------------------------------------ hand-drawn helpers
  // smooth closed / open curve through points (Catmull-Rom → cubic Bézier), with a little hand jitter
  function curve(pts, closed, rnd, j = 0.6) {
    const p = pts.map(([x, y]) => [x + (rnd() - 0.5) * j, y + (rnd() - 0.5) * j]);
    const n = p.length;
    const at = (i) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return closed ? d + 'Z' : d;
  }
  const circlePts = (cx, cy, rx, ry = rx, n = 10, a0 = 0) => [...Array(n)].map((_, i) => [cx + Math.cos(a0 + (i / n) * Math.PI * 2) * rx, cy + Math.sin(a0 + (i / n) * Math.PI * 2) * ry]);
  const star = (x, y, r, n = 5, inner = 0.45) => 'M' + [...Array(n * 2)].map((_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; return `${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)}`; }).join('L') + 'Z';

  // ------------------------------------------------------------------ screen-printed scenes (100 x 60 box)
  const SCENES = {
    volcano(A) {
      A.dots('M70 4a12 12 0 1 0 0.1 0Z');
      A.f2(curve([[6, 60], [22, 40], [36, 24], [50, 21], [64, 24], [78, 40], [94, 60]], false, A.r) + 'Z');
      A.fi(curve([[38, 24], [50, 28], [62, 24], [50, 21]], true, A.r, 0.3));
      A.o(curve([[44, 26], [45, 36], [42, 44]], false, A.r), 1.4);
      A.o(curve([[56, 26], [57, 34], [60, 40]], false, A.r), 1.4);
      [[50, 15, 6], [42, 9, 5], [53, 5, 4.5], [62, 11, 4.8], [34, 15, 3.6], [28, 8, 2.6]].forEach(([x, y, r]) => A.k(curve(circlePts(x, y, r, r, 8), true, A.r, 0.8)));
    },
    hoof(A) {
      const d = curve([[30, 12], [28, 30], [36, 48], [50, 53], [64, 48], [72, 30], [70, 12]], false, A.r, 0.4);
      A.line(d, 11, A.ink);
      A.line(d, 7.4, A.ink2);
      [[31, 20], [31, 32], [37, 43], [69, 20], [69, 32], [63, 43]].forEach(([x, y]) => A.fi(`M${x - 1.2} ${y - 0.8}h2.4v1.6h-2.4z`));
      [[16, 10, 4], [84, 14, 3], [86, 44, 3.6], [14, 46, 3]].forEach(([x, y, r]) => A.fi(star(x, y, r, 4, 0.3)));
      A.o('M42 20 Q50 14 58 20', 1.2);
    },
    cliffs(A) {
      A.c(64, 20, 14, 'ink2');
      A.dots('M0 0H100V30H0Z');
      A.fi(curve([[0, 34], [14, 26], [26, 30], [40, 22], [52, 30], [70, 26], [86, 32], [100, 28], [100, 60], [0, 60]], true, A.r, 0.4));
      for (let i = 0; i < 12; i++) {
        const x = 4 + i * 8, t = 34 + (i % 3) * 2;
        A[i % 2 ? 'k' : 'f2'](`M${x} 60V${t + 6}L${x + 3} ${t}L${x + 6} ${t + 6}V60Z`);
      }
      A.o('M0 48H100', 1.4);
    },
    radio(A) {
      [12, 20, 28].forEach((r) => A.o(`M${50 - r} ${22 - r * 0.4}A${r} ${r} 0 0 1 ${50 + r} ${22 - r * 0.4}`, 2.4, A.ink2));
      A.o('M40 60 L50 18 L60 60 M43 48 H57 M45.5 38 H54.5 M47.5 28 H52.5 M43 48 L54.5 38 M57 48 L45.5 38 M45.5 38 L52.5 28 M54.5 38 L47.5 28', 1.3);
      A.c(50, 16, 3.4, 'ink2');
      A.k('M66 44 h22 v14 h-22z');
      A.o('M66 44 l11 8 l11 -8', 1.2);
    },
    avalanche(A) {
      A.fi(curve([[0, 60], [20, 34], [36, 8], [44, 4], [56, 20], [76, 40], [100, 60]], false, A.r, 0.3) + 'Z');
      A.k('M30 18 L36 8 L44 4 L54 18 L48 15 L44 20 L39 14 L34 20Z');
      [[62, 36, 4.5], [72, 46, 5.5], [84, 52, 4], [56, 46, 3], [90, 40, 3]].forEach(([x, y, r]) => A.f2(curve(circlePts(x, y, r, r * 0.85, 7), true, A.r, 1.2)));
      A.o('M64 28 L72 30 M76 36 L86 38 M80 26 L88 27', 1.3, A.ink2);
    },
    cave(A) {
      A.fi(curve([[50, 30], [72, 34], [78, 46], [70, 58], [30, 58], [22, 46], [28, 34]], true, A.r, 0.5));
      A.fi('M0 0H100V7L94 22L88 7L80 28L72 7L65 18L58 7L50 24L42 7L35 19L28 7L20 26L12 7L6 16L0 7Z');
      A.fi('M0 60V52L5 44L10 52L18 40L26 60Z M100 60V50L94 42L88 52L80 38L72 60Z');
      [[40, 44], [58, 44]].forEach(([x, y]) => { A.c(x, y, 4, 'ink2'); A.c(x + 0.8, y, 1.6, 'bg', true); });
    },
    rainbow(A) {
      const cols = ['#e8453c', '#f29b38', '#f4d43c', '#5cb85c', '#3f7fd8', '#8a5cc8'];
      cols.forEach((c, i) => {
        const r0 = 44 - i * 5, r1 = r0 - 5;
        A.raw(`M${50 - r0} 54A${r0} ${r0} 0 0 1 ${50 + r0} 54H${50 + r1}A${r1} ${r1} 0 0 0 ${50 - r1} 54Z`, c);
      });
      A.o('M6 54A44 44 0 0 1 94 54 M21 54A29 29 0 0 1 79 54', 1.4);
      [[12, 54], [88, 54]].forEach(([x, y]) => A.k(curve([[x - 12, y + 4], [x - 9, y - 4], [x - 2, y - 7], [x + 6, y - 5], [x + 11, y + 1], [x + 8, y + 6], [x - 6, y + 7]], true, A.r, 0.6)));
    },
    glitch(A) {
      for (let i = 0; i < 46; i++) {
        const x = Math.floor(A.r() * 20) * 5, y = Math.floor(A.r() * 12) * 5, k = A.r();
        A.raw(`M${x} ${y}h${k > 0.7 ? 10 : 5}v5h${k > 0.7 ? -10 : -5}z`, k > 0.55 ? A.ink2 : A.ink, 0.85);
      }
      A.line('M0 32 L10 32 L14 14 L20 50 L26 22 L32 40 L38 30 L46 30 L50 8 L56 56 L60 30 L70 30 L74 20 L80 44 L86 32 L100 32', 4.2, A.bg);
      A.line('M0 32 L10 32 L14 14 L20 50 L26 22 L32 40 L38 30 L46 30 L50 8 L56 56 L60 30 L70 30 L74 20 L80 44 L86 32 L100 32', 1.8, A.ink);
    },
    trees(A) {
      A.c(76, 14, 8, 'bg');
      A.dots('M0 0H100V40H0Z');
      const pine = (x, b, h, fill) => {
        let d = '';
        for (let k = 0; k < 3; k++) { const yb = b - k * h * 0.28, w = h * (0.42 - k * 0.1); d += `M${x - w} ${yb}L${x} ${yb - h * 0.45}L${x + w} ${yb}Z`; }
        A[fill](d);
        A.fi(`M${x - 1.2} ${b}h2.4v4h-2.4z`);
      };
      [[14, 46, 30, 'f2'], [34, 40, 26, 'fi'], [52, 48, 36, 'f2'], [72, 44, 28, 'fi'], [90, 50, 32, 'f2']].forEach(([x, b, h, f]) => pine(x, b, h, f));
      A.fi('M0 52 Q50 46 100 52 V60 H0Z');
    },
    spiral(A) {
      const pts = [];
      for (let t = 0; t < 26; t += 0.5) pts.push([50 + Math.cos(t) * (1.5 + t * 1.05), 30 + Math.sin(t) * (1.5 + t * 1.05)]);
      const d = curve(pts, false, A.r, 0.2);
      A.line(d, 5.2, A.ink);
      A.line(d, 3, A.ink2);
      [[10, 10, 3], [88, 12, 2.4], [84, 50, 3], [14, 50, 2.2], [26, 26, 1.6], [74, 30, 1.4]].forEach(([x, y, r]) => A.fi(star(x, y, r, 4, 0.32)));
    },
    sun(A) {
      for (let i = 0; i < 16; i++) {
        const a0 = Math.PI + (i / 16) * Math.PI, a1 = a0 + Math.PI / 32;
        if (i % 2) A.raw(`M50 58L${50 + Math.cos(a0) * 80} ${58 + Math.sin(a0) * 80}L${50 + Math.cos(a1 + Math.PI / 32) * 80} ${58 + Math.sin(a1 + Math.PI / 32) * 80}Z`, A.ink2, 0.9);
      }
      A.c(50, 58, 20, 'ink2');
      A.fi('M0 56 Q12 52 25 56 T50 56 T75 56 T100 56 V60 H0Z');
    },
    ghost(A) {
      A.o('M14 20 H26 M10 28 H24 M14 36 H26', 1.6, A.ink2);
      A.k(curve([[32, 56], [31, 30], [36, 14], [50, 8], [64, 14], [69, 30], [68, 56], [62, 50], [56, 57], [50, 51], [44, 57], [38, 50]], true, A.r, 0.4));
      A.fi('M42 22a3 4.2 0 1 0 6 0a3 4.2 0 1 0 -6 0Z M52 22a3 4.2 0 1 0 6 0a3 4.2 0 1 0 -6 0Z');
      A.f2('M46.5 33a3.5 4.5 0 1 0 7 0a3.5 4.5 0 1 0 -7 0Z');
      A.fi(star(80, 14, 4, 4, 0.3) + star(86, 40, 3, 4, 0.3));
    },
    arrows(A) {
      [[18, 50, 0], [34, 54, 1], [50, 52, 0]].forEach(([x, y, alt], i) => {
        const dx = 40, dy = -40;
        A.line(`M${x} ${y}L${x + dx} ${y + dy}`, 3.6, A.ink);
        A.line(`M${x} ${y}L${x + dx} ${y + dy}`, 1.8, alt ? A.ink2 : A.bg);
        A.f2(`M${x + dx + 6} ${y + dy - 6}L${x + dx - 6} ${y + dy - 1}L${x + dx + 1} ${y + dy + 6}Z`);
        A.k(`M${x} ${y}l-6 -1l3 -4l5 3z M${x} ${y}l1 6l4 -3l-3 -5z`);
        void i;
      });
    },
    tracks(A) {
      A.f2(star(50, 18, 15, 9, 0.55));
      A.fi(star(50, 18, 7, 7, 0.5));
      A.fi('M0 30 H100 V32 H0Z');
      for (let k = 0; k < 6; k++) { const t = k / 5, y = 32 + 28 * t * t, hw = 4 + 40 * t * t; A.o(`M${50 - hw} ${y}H${50 + hw}`, 1 + 2 * t, A.ink); }
      A.line('M46 31 L12 60 M54 31 L88 60', 2.4, A.ink);
    },
    planets(A) {
      [[10, 10, 2.4], [90, 8, 3], [80, 52, 2], [24, 54, 2.6], [64, 6, 1.6], [6, 36, 1.8]].forEach(([x, y, r]) => A.fi(star(x, y, r, 4, 0.3)));
      A.c(42, 32, 15, 'ink2');
      A.dots('M42 17a15 15 0 0 1 0 30a10 15 0 0 0 0 -30Z');
      A.o('M18 40 C30 24 70 18 68 26 C66 32 30 46 18 40Z', 2.2);
      A.c(78, 24, 6, 'bg');
      A.o('M70 46 L88 34', 1.4, A.ink2);
      A.c(68, 47, 2.6, 'ink2');
    },
    orbit(A) {
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; A.o(`M${50 + Math.cos(a) * 9} ${30 + Math.sin(a) * 9}L${50 + Math.cos(a) * 12} ${30 + Math.sin(a) * 12}`, 1.6, A.ink2); }
      A.c(50, 30, 7, 'ink2');
      [[20, 8], [34, 14], [48, 22]].forEach(([rx, ry], i) => A.o(`M${50 - rx} 30A${rx} ${ry} ${-12} 1 0 ${50 + rx} 30A${rx} ${ry} ${-12} 1 0 ${50 - rx} 30Z`, 1.2));
      [[70, 26, 3], [18, 36, 3.6], [92, 22, 4.4]].forEach(([x, y, r], i) => A.c(x, y, r, i % 2 ? 'ink2' : 'bg'));
    },
    tentacles(A) {
      [[18, 10, 2], [24, 4, 1.4], [82, 8, 2.4], [88, 18, 1.4]].forEach(([x, y, r]) => A.c(x, y, r, 'bg'));
      const tent = [[36, 40, 14, 58, 8, 44], [42, 42, 30, 60, 24, 54], [50, 42, 50, 60, 44, 58], [58, 42, 70, 60, 76, 54], [64, 40, 86, 58, 92, 44]];
      tent.forEach(([x0, y0, x1, y1, x2, y2]) => { const d = `M${x0} ${y0}Q${x1} ${y1} ${x2} ${y2}`; A.line(d, 5.2, A.ink); A.line(d, 3, A.ink2); });
      A.f2(curve([[34, 42], [32, 26], [38, 12], [50, 8], [62, 12], [68, 26], [66, 42], [50, 46]], true, A.r, 0.4));
      [[44, 28], [56, 28]].forEach(([x, y]) => { A.c(x, y, 4, 'bg'); A.c(x, y + 1, 1.8, 'ink', true); });
    },
    pyramids(A) {
      A.c(78, 14, 8, 'ink2');
      A.dots('M0 0H100V44H0Z');
      [[34, 46, 30], [64, 50, 24], [14, 52, 14]].forEach(([x, b, h]) => {
        A.f2(`M${x - h} ${b}L${x} ${b - h}L${x} ${b}Z`);
        A.fi(`M${x} ${b - h}L${x + h} ${b}L${x} ${b}Z`);
      });
      A.fi('M0 50 Q50 46 100 50 V60 H0Z');
    },
    invader(A) {
      const pix = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
      const s = 5.2, x0 = 50 - (11 * s) / 2, y0 = 30 - (8 * s) / 2;
      pix.forEach((row, r) => [...row].forEach((v, c) => { if (v === '1') A.raw(`M${x0 + c * s} ${y0 + r * s}h${s}v${s}h${-s}z`, A.ink2); }));
      A.o(`M${x0 - 3} ${y0 + 8 * s + 4}H${x0 + 11 * s + 3}`, 1.4);
      [[8, 8], [92, 10], [10, 52], [90, 50]].forEach(([x, y]) => A.raw(`M${x - 2} ${y - 2}h4v4h-4z`, A.ink));
    },
    ufo(A) {
      A.dots('M38 30 L62 30 L76 56 L24 56Z');
      A.k('M42 47h16v10h-16z');
      A.o('M42 47l8 4l8 -4 M50 51v6', 1);
      A.k(curve([[38, 22], [40, 12], [50, 8], [60, 12], [62, 22]], false, A.r, 0.3) + 'Z');
      A.f2(curve([[20, 26], [34, 20], [50, 19], [66, 20], [80, 26], [66, 32], [50, 33], [34, 32]], true, A.r, 0.3));
      [[30, 27], [42, 29], [58, 29], [70, 27]].forEach(([x, y]) => A.c(x, y, 1.6, 'bg', true));
      [[10, 8], [88, 12], [84, 46]].forEach(([x, y]) => A.fi(star(x, y, 3, 4, 0.3)));
    },
    lightning(A) {
      A.raw('M78 4a12 12 0 1 0 0 24a9 12 0 0 1 0 -24Z', A.ink2);
      A.o('M8 60V20 M92 60V24 M4 22H12 M88 26H96', 2);
      A.o('M8 22 Q50 40 92 26 M8 26 Q50 44 92 30', 1);
      A.f2('M46 4 L34 30 L45 30 L38 56 L60 24 L48 24 L56 4Z');
    },
    tools(A) {
      [20, 40, 60].forEach((x, i) => { A.fi(`M${x - 1.2} 8h2.4v44h-2.4z`); A.f2(`M${x - 6} ${[16, 34, 24][i]}h12v7h-12z`); });
      A.k('M74 54 L90 20 a7 7 0 1 1 6 3 l-3 -5 l-4 2 l-1 6 l-14 30 Z');
    },
    crank(A) {
      const teeth = 12, R = 18, r = 14;
      let d = '';
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : R;
        d += `${i ? 'L' : 'M'}${(44 + Math.cos(a0) * rr).toFixed(2)} ${(32 + Math.sin(a0) * rr).toFixed(2)}L${(44 + Math.cos(a1) * rr).toFixed(2)} ${(32 + Math.sin(a1) * rr).toFixed(2)}`;
      }
      A.f2(d + 'Z');
      A.c(44, 32, 6, 'bg');
      A.line('M44 32 L78 14', 6, A.ink);
      A.line('M44 32 L78 14', 3, A.bg);
      A.c(80, 13, 5, 'ink2');
      A.fi(star(16, 12, 4, 4, 0.3) + star(84, 46, 3.4, 4, 0.3));
    },
    eyes(A) {
      [[30, 30], [70, 30]].forEach(([x, y], i) => {
        A.k(curve(circlePts(x, y, 17, 13, 10), true, A.r, 0.6));
        A.c(x + (i ? -2 : 2), y + 1, 7.5, 'ink2');
        A.c(x + (i ? -2 : 2), y + 1, 3.2, 'ink', true);
        A.c(x + (i ? -4 : 0), y - 1.5, 1.4, 'bg', true);
        A.o(`M${x - 15} ${y - 18} Q${x} ${y - 25} ${x + 15} ${y - 18}`, 2.4);
      });
    },
    flower(A) {
      A.fi('M0 54 Q50 48 100 54 V60 H0Z');
      A.o(curve([[50, 56], [48, 44], [52, 34]], false, A.r), 2.2);
      A.k(curve([[48, 48], [38, 42], [34, 46], [44, 52]], true, A.r, 0.3));
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2, x = 52 + Math.cos(t) * 11, y = 22 + Math.sin(t) * 11;
        A.f2(curve(circlePts(x, y, 6.5, 6.5, 8), true, A.r, 0.5));
      }
      A.c(52, 22, 6.5, 'ink');
      [[16, 14, 3], [86, 12, 3.4], [82, 40, 2.4], [18, 40, 2.2]].forEach(([x, y, r]) => A.fi(star(x, y, r, 4, 0.35)));
    },
    claws(A) {
      A.dots('M0 0H100V60H0Z');
      for (let i = 0; i < 4; i++) {
        const x = 22 + i * 18;
        A.f2(curve([[x - 5, 4], [x + 4, 8], [x + 8, 26], [x + 3, 50], [x + 1, 52], [x - 1, 30], [x - 6, 10]], true, A.r, 0.4));
      }
    },
    silo(A) {
      A.c(80, 14, 7, 'bg');
      for (const [x, w, h] of [[18, 16, 40], [38, 18, 48], [60, 16, 36]]) {
        A.f2(`M${x} 56V${56 - h}a${w / 2} ${w / 2.6} 0 0 1 ${w} 0V56Z`);
        for (let y = 56 - h + 8; y < 54; y += 7) A.o(`M${x} ${y}H${x + w}`, 1);
      }
      A.fi('M0 55H100V60H0Z');
    },
    arches(A) {
      A.dots('M0 0H100V30H0Z');
      A.f2('M2 18H98V26H2Z');
      A.fi('M0 52 Q50 46 100 52 V60 H0Z');
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 18.5;
        A.f2(`M${x} 26H${x + 16}V54H${x + 13}V40a5 6 0 0 0 -10 0V54H${x}Z`);
      }
      A.o('M2 22H98', 1, A.bg);
    },
    aztec(A) {
      A.c(50, 30, 22, 'ink2');
      A.c(50, 30, 15, 'bg');
      A.c(50, 30, 8, 'ink');
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2, t2 = t + Math.PI / 12;
        A.fi(`M${50 + Math.cos(t) * 23} ${30 + Math.sin(t) * 23}L${50 + Math.cos(t + Math.PI / 24) * 31} ${30 + Math.sin(t + Math.PI / 24) * 31}L${50 + Math.cos(t2) * 23} ${30 + Math.sin(t2) * 23}Z`);
      }
    },
    ledge(A) {
      A.c(22, 14, 7, 'bg');
      A.f2('M100 10H58L52 18H100Z'); A.f2('M100 26H44L38 34H100Z'); A.f2('M100 42H30L22 50H100Z');
      A.o('M0 58 Q20 54 40 58 T80 58 T100 58', 1.4);
    },
    gears(A) {
      const gear = (cx, cy, r, n, fill) => {
        let d = '';
        for (let i = 0; i < n * 2; i++) { const t = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 0.8; d += `${i ? 'L' : 'M'}${(cx + Math.cos(t) * rr).toFixed(2)} ${(cy + Math.sin(t) * rr).toFixed(2)}`; }
        A[fill](d + 'Z');
        A.c(cx, cy, r * 0.3, 'bg');
      };
      gear(36, 30, 20, 10, 'f2'); gear(70, 22, 14, 8, 'fi'); gear(72, 48, 9, 7, 'f2');
    },
    pipes(A) {
      const hs = [20, 28, 36, 44, 50, 44, 36, 28, 20];
      hs.forEach((h, i) => {
        const x = 9 + i * 9.4, b = 56;
        A[i % 2 ? 'fi' : 'f2'](`M${x} ${b}V${b - h}h7V${b}Z`);
        A.k(`M${x + 1.5} ${b - h * 0.25}l2 -3l2 3z`);
      });
      A.fi('M4 56H96V60H4Z');
    },
    cross(A) {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) if ((r + c) % 2 === 0) A.raw(`M${6 + c * 11} ${4 + r * 9}h4v1.4h-4z M${7.3 + c * 11} ${2.7 + r * 9}h1.4v4h-1.4z`, A.ink2, 0.7);
      A.fi(curve([[0, 60], [0, 48], [16, 36], [28, 44], [44, 28], [58, 40], [72, 32], [100, 50], [100, 60]], false, A.r, 0.3) + 'Z');
      A.k('M38 30 h24 v24 h-24z');
      A.f2('M47 34h6v6h6v6h-6v6h-6v-6h-6v-6h6z');
    },
  };

  // chunky cartoon lettering: every letter slightly rotated / bounced, accent fill with a thick ink outline
  function cartoon(g, text, cx, cy, size, fill, ink, rnd, maxW) {
    const chars = [...text];
    const wOf = (ch) => (ch === ' ' ? 0.32 : /[MW]/.test(ch) ? 0.66 : /[I1]/.test(ch) ? 0.3 : 0.52);
    let total = chars.reduce((a, ch) => a + wOf(ch), 0) * size;
    if (total > maxW) { size *= maxW / total; total = maxW; }
    let x = cx - total / 2;
    const grp = svg('g', {}, g);
    for (const ch of chars) {
      const w = wOf(ch) * size;
      if (ch !== ' ') {
        const rot = (rnd() - 0.5) * 12, dy = (rnd() - 0.5) * size * 0.12, xx = x + w / 2;
        const t = { x: xx.toFixed(2), y: (cy + dy).toFixed(2), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': "'Oswald', sans-serif", 'font-weight': 700, 'font-size': size.toFixed(2), transform: `rotate(${rot.toFixed(1)} ${xx.toFixed(2)} ${cy.toFixed(2)})`, 'pointer-events': 'none' };
        svg('text', Object.assign({}, t, { x: (xx + size * 0.06).toFixed(2), y: (cy + dy + size * 0.07).toFixed(2), fill: ink, stroke: ink, 'stroke-width': size * 0.16, 'stroke-linejoin': 'round' }), grp, ch);
        svg('text', Object.assign({}, t, { fill, stroke: ink, 'stroke-width': size * 0.11, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }), grp, ch);
      }
      x += w;
    }
    return size;
  }

  tz.addForm('eqd-print', (ctx, def) => {
    const g = ctx.g;
    const sz = def.size || 'n';
    const [W, H] = SIZES[sz];
    const id = 'eq' + ++seq;
    const bg = def.color, ink = def.ink || '#151515', ink2 = def.ink2 || '#e8e2d0';
    const txt = def.text || ink;
    const r = rng(hash(def.id));
    const defs = svg('defs', {}, g);
    const dp = svg('pattern', { id: id + 'd', width: 2.6, height: 2.6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(30)' }, defs);
    svg('circle', { cx: 1.3, cy: 1.3, r: 0.62, fill: ink }, dp);
    noisePattern(defs, id + 'n', 50, 64, [255, 255, 255], 0, 0.16, 0);
    formKit.body(g, W, H, bg, { rx: 6 });
    svg('rect', { x: 0, y: 0, width: W, height: H, rx: 6, fill: `url(#${id}n)` }, g);
    const L = layout(def, W, H, sz);
    const tagH = def.tagline ? 9 : 3;
    const nameMax = Math.max(12, Math.min(def.logoSize || { b: 17, n: 21, w: 23, x: 26 }[sz], L.y1 - L.y0 - tagH - 3));
    const nameY = L.y1 - tagH - nameMax * 0.5;
    const artBottom = nameY + nameMax * 0.3; // the cartoon name is printed over the lower part of the art
    const big = artBottom - L.y0 >= 30;
    const box = big ? { x: 6, y: L.y0, w: W - 12, h: artBottom - L.y0 } : { x: 6, y: 8, w: W - 12, h: artBottom - 8 };
    const clip = svg('clipPath', { id: id + 'c' }, defs);
    svg('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 3 }, clip);
    const outer = svg('g', { 'clip-path': `url(#${id}c)`, opacity: big ? 1 : def.ghost ?? 0.3 }, g);
    const s = Math.min(box.w / 100, box.h / 60) * (big ? 1 : 1);
    const art = svg('g', { transform: `translate(${(box.x + (box.w - 100 * s) / 2).toFixed(2)},${(box.y + (box.h - 60 * s) * (big ? 0.5 : 0.9)).toFixed(2)}) scale(${s.toFixed(3)})` }, outer);
    const lw = 1.5;
    const A = {
      r, ink, ink2, bg,
      raw: (d, fill, op) => svg('path', { d, fill, opacity: op }, art),
      fi: (d) => svg('path', { d, fill: ink }, art),
      f2: (d) => svg('path', { d, fill: ink2, stroke: ink, 'stroke-width': lw, 'stroke-linejoin': 'round' }, art),
      k: (d) => svg('path', { d, fill: bg, stroke: ink, 'stroke-width': lw, 'stroke-linejoin': 'round' }, art),
      o: (d, w = lw, col = ink) => svg('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, art),
      line: (d, w, col) => svg('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, art),
      dots: (d) => svg('path', { d, fill: `url(#${id}d)`, opacity: 0.55 }, art),
      c: (cx, cy, rr, which, noStroke) => svg('circle', { cx, cy, r: rr, fill: which === 'ink' ? ink : which === 'bg' ? bg : ink2, stroke: noStroke ? 'none' : ink, 'stroke-width': lw }, art),
    };
    (SCENES[def.scene] || SCENES.volcano)(A);
    cartoon(g, (def.logo || def.name).toUpperCase(), W / 2, nameY, nameMax, def.nameFill || ink2, ink, r, W - 18);
    if (def.tagline) label(g, W / 2, nameY + nameMax * 0.62 + 3, def.tagline, { size: 4.8, fill: txt, weight: 800, ls: 1.2 });
    formKit.tzBadge(g, W / 2, L.nFeet >= 2 ? L.footY + 1 : H - 9, txt, 4.2);
    const theme = { text: txt, knob: def.knob || 'mxr', labelSize: sz === 'b' ? 5.8 : 6.2, labelFont: "'Barlow Condensed', sans-serif", labelWeight: 800, labelLs: 0.5 };
    formKit.placeControls(ctx, def.controls, theme);
    return { w: W, h: H, theme, jacks: formKit.jacksTop(def, W, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ blocks
  const EQ = (o) => def(Object.assign({ form: 'eqd-print', brand: 'EarthQuaker Devices', cost: 0.8 }, o, {
    controls: [...o.controls, ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));
  const bypassFoot = () => FOOT({ action: 'bypass', label: 'BYPASS' });
  const semi = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' st';

  tz.addDefs([
    // ---------------- drives / fuzz / boost
    EQ({
      id: 'eqd.plumes', name: 'Plumage Small Signal Shredder', ref: 'EarthQuaker Devices Plumes', logo: 'PLUMAGE', tagline: 'SMALL SIGNAL SHREDDER', cat: 'Overdrive',
      color: '#dcd84c', ink: '#24204a', ink2: '#e9483a', scene: 'volcano', size: 'b',
      algo: 'drive', opts: { tone: 'ts', toneLo: 723, gainMinDb: 6, gainMaxDb: 40, levelMaxDb: 6, preHp: 60, clipHp: 720, postLp: 7500,
        modes: [{ clip: 'led', bias: 0.3 }, { clip: 'clean', cleanSum: true, gainMaxDb: 30 }, { clip: 'si' }] },
      controls: [K('level', 'LEVEL', { def: 0.5 }), K('tone', 'TONE', { def: 0.5 }), K('gain', 'GAIN', { def: 0.5 }), TOG('mode', 'MODE', ['1', '2', '3'], { def: 0 })],
      desc: 'Mode 1: asymmetrical LED clipping. Mode 2: no clipping (op-amp only). Mode 3: symmetrical silicon.',
    }),
    EQ({
      id: 'eqd.hoof', name: 'Hooves Germanium/Silicon Fuzz', ref: 'EarthQuaker Devices Hoof V2', logo: 'HOOVES', tagline: 'HYBRID FUZZ', cat: 'Fuzz',
      color: '#2f6b3d', ink: '#141414', ink2: '#efe1b4', text: '#f4ead0', scene: 'hoof',
      algo: 'drive', opts: { clip: 'muff', bias: 0.2, stages: 2, stage2Db: 10, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 700, trebleF: 2600, midMin: 300, midMax: 1400, gainMinDb: 14, gainMaxDb: 46, levelMinDb: -36, levelMaxDb: 0, preHp: 50, postLp: 7000 },
      controls: [K('gain', 'FUZZ', { def: 0.6 }), K('shift', 'SHIFT', { def: 0.5, virtual: true }), K('tone', 'TONE', { def: 0.5, virtual: true }), K('level', 'LEVEL', { def: 0.5 }), TOG('smooth', 'VOICE', ['smooth', 'rough'], { virtual: true })],
      rows: [2, 2],
      derive: (p) => ({ midfreq: p.shift ?? 0.5, mid: 0.25 + (p.smooth ? 0.15 : 0), treble: 0.2 + 0.7 * (p.tone ?? 0.5), bass: 0.85 - 0.6 * (p.tone ?? 0.5), bright: p.smooth ? 1 : 0 }),
      desc: 'SHIFT moves the mid scoop, TONE tilts from thick lows to cutting highs.',
    }),
    EQ({
      id: 'eqd.palisades', name: 'Stockade Mega Ultimate Overdrive', ref: 'EarthQuaker Devices Palisades V2', logo: 'STOCKADE', tagline: 'MEGA ULTIMATE OVERDRIVE', cat: 'Overdrive',
      color: '#e7dfcb', ink: '#1c1c1c', ink2: '#c9302b', scene: 'cliffs', size: 'x', noStd: true,
      algo: 'drive', opts: { tone: 'eq3', eqRangeDb: 12, bassF: 160, midF: 720, trebleF: 2600, gainMinDb: 4, gainMaxDb: 42, levelMaxDb: 6, preHp: 40, clipHp: 300, postLp: 8000,
        modes: [{ clip: 'ts', cleanSum: true, cleanMix: 0.35 }, { clip: 'diode' }, { clip: 'asym' }, { clip: 'led' }, { clip: 'jfet', bias: 0.25 }] },
      fixed: { mid: 0.58 },
      controls: [
        K('level', 'VOLUME', { def: 0.45 }), K('treble', 'TONE', { def: 0.5 }), K('drv', 'GAIN 1', { def: 0.4, virtual: true }),
        K('bass', 'BANDWIDTH', { def: 0.5 }), K('g2', 'GAIN 2', { def: 0.75, virtual: true }), SEL('mode', 'VOICING', ['1', '2', '3', '4', '5'], { def: 0 }),
        TOG('buf', 'BUFFER', ['norm', 'buff'], { virtual: true }),
        FOOT({ action: 'param', p: 'gsel', toggle: true, label: 'GAIN' }), bypassFoot(), LED({ bind: 'param:gsel', color: '#ff2a1a' }), LED({ bind: 'on', color: '#ff2a1a' }),
      ],
      derive: (p) => ({ gain: p.gsel ? p.g2 ?? 0.75 : p.drv ?? 0.4 }),
      desc: 'Two gain knobs selected by the GAIN switch, five clipping voicings and BANDWIDTH (low end into the clipper).',
    }),
    EQ({
      id: 'eqd.westwood', name: 'Eastwood Translucent Drive', ref: 'EarthQuaker Devices Westwood', logo: 'EASTWOOD', tagline: 'TRANSLUCENT DRIVE MANIPULATOR', cat: 'Overdrive',
      color: '#7fb2d4', ink: '#14213d', ink2: '#f4efe0', scene: 'trees', size: 'b',
      algo: 'drive', opts: { clip: 'opamp', bias: 0.15, tone: 'tilt', eqRangeDb: 12, bassF: 150, trebleF: 2400, gainMinDb: 2, gainMaxDb: 36, levelMaxDb: 8, preHp: 40, postLp: 10000 },
      controls: [K('level', 'LEVEL', { def: 0.5 }), K('gain', 'DRIVE', { def: 0.4 }), K('bass', 'BASS', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.5 })],
      rows: [2, 2],
    }),
    EQ({
      id: 'eqd.hizumitas', name: 'Hizumi Fuzz Sustainar', ref: 'EarthQuaker Devices Hizumitas', logo: 'HIZUMI', tagline: 'FUZZ SUSTAINAR', cat: 'Fuzz',
      color: '#d7d0c0', ink: '#1a1a1a', ink2: '#c8102e', scene: 'sun',
      algo: 'drive', opts: { clip: 'muff', stages: 3, stage2Db: 12, tone: 'blend', blendLp: 420, blendHp: 1100, gainMinDb: 20, gainMaxDb: 52, levelMinDb: -40, levelMaxDb: -4, preHp: 70, postLp: 6500 },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('gain', 'SUSTAIN', { def: 0.6 }), K('tone', 'TONE', { def: 0.45 })],
    }),
    EQ({
      id: 'eqd.arrows', name: 'Quiver Pre-Amp Booster', ref: 'EarthQuaker Devices Arrows V2', logo: 'QUIVER', tagline: 'PRE-AMP BOOSTER', cat: 'Boost',
      color: '#f1c22f', ink: '#1d1d1d', ink2: '#d9472b', scene: 'arrows', size: 'b',
      algo: 'boost', fixed: { gain: 0.6, bass: 0.5 },
      controls: [K('level', 'LEVEL', { def: 0.45 }), TOG('mode', 'SHIFT', ['full', 'trbl'], { values: [0, 1] })],
    }),
    EQ({
      id: 'eqd.specialcranker', name: 'Special Crank Overdrive', ref: 'EarthQuaker Devices Special Cranker', logo: 'CRANK', tagline: 'OVERDRIVE', cat: 'Overdrive',
      color: '#e8e2d2', ink: '#1a1a1a', ink2: '#e06d2a', scene: 'crank', size: 'b',
      algo: 'drive', opts: { tone: 'lp', toneLo: 1400, toneHi: 9000, gainMinDb: 4, gainMaxDb: 50, levelMaxDb: 2, preHp: 60,
        modes: [{ clip: 'si', bias: 0.3 }, { clip: 'clean', gainMaxDb: 34 }, { clip: 'si' }] },
      controls: [K('level', 'LEVEL', { def: 0.45 }), K('tone', 'TONE', { def: 0.5 }), K('gain', 'GAIN', { def: 0.5 }), TOG('mode', 'CLIP', ['asym', 'open', 'sym'], { def: 0 })],
    }),
    EQ({
      id: 'eqd.graychannel', name: 'Grey Path Dual Dynamic Drive', ref: 'EarthQuaker Devices Gray Channel', logo: 'GREY PATH', tagline: 'DUAL DYNAMIC DRIVE', cat: 'Overdrive',
      color: '#8b8f95', ink: '#151515', ink2: '#d84040', scene: 'eyes', size: 'x', noStd: true, cost: 1.1,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'drive', opts: { tone: 'lp', toneLo: 1600, toneHi: 9000, levelMaxDb: 6, preHp: 50, modes: [{ clip: 'si', gainMaxDb: 34 }, { clip: 'opamp', gainMaxDb: 46 }, { clip: 'diode', stages: 2, gainMaxDb: 52 }] } },
        { prefix: 'b', algo: 'drive', opts: { tone: 'lp', toneLo: 1600, toneHi: 9000, levelMaxDb: 6, preHp: 50, modes: [{ clip: 'si', gainMaxDb: 34 }, { clip: 'opamp', gainMaxDb: 46 }, { clip: 'diode', stages: 2, gainMaxDb: 52 }] } },
      ] },
      controls: [
        K('a.level', 'LEVEL', { def: 0.45 }), K('a.gain', 'DRIVE', { def: 0.45 }), K('a.tone', 'TONE', { def: 0.5 }),
        K('b.level', 'LEVEL', { def: 0.4 }), K('b.gain', 'DRIVE', { def: 0.6 }), K('b.tone', 'TONE', { def: 0.5 }),
        TOG('a.mode', 'RED', ['OD', 'DS', 'DS+'], { def: 0 }), TOG('b.mode', 'BLUE', ['OD', 'DS', 'DS+'], { def: 1 }),
        FOOT({ action: 'param', p: 'a.on', toggle: true, label: 'RED' }), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'BLUE' }),
        LED({ bind: 'param:a.on', color: '#ff2a1a' }), LED({ bind: 'param:b.on', color: '#3d8bff' }),
      ],
      alwaysOn: true, initParams: { 'a.on': 1, 'b.on': 0 },
      desc: 'Two independent drive channels in series, each with overdrive / distortion / heavy distortion clipping.',
    }),
    EQ({
      id: 'eqd.tonejob', name: 'Tone Task EQ & Boost', ref: 'EarthQuaker Devices Tone Job V2', logo: 'TONE TASK', tagline: 'EQ & BOOST', cat: 'EQ',
      color: '#c9302c', ink: '#141414', ink2: '#f5efe1', text: '#f8f1e2', scene: 'tools', size: 'b',
      algo: 'peq', fixed: { lowfreq: 120, mid1freq: 800, mid1q: 0.9, highfreq: 3200, mid2gain: 0 },
      controls: [K('level', 'LEVEL', { min: -12, max: 18, def: 0, display: db }), K('highgain', 'TREBLE', { min: -15, max: 15, def: 0, display: db }), K('mid1gain', 'MIDDLE', { min: -15, max: 15, def: 0, display: db }), K('lowgain', 'BASS', { min: -15, max: 15, def: 0, display: db })],
      rows: [2, 2],
    }),
    // ---------------- delay / reverb
    EQ({
      id: 'eqd.dispatch', name: 'Despatch Commander Delay & Reverb', ref: 'EarthQuaker Devices Dispatch Master V3', logo: 'DESPATCH', tagline: 'DIGITAL DELAY & REVERB', cat: 'Delay',
      color: '#2b4a7a', ink: '#0f0f14', ink2: '#f2c43a', text: '#f3ecd8', scene: 'radio', size: 'w', cost: 1.3,
      algo: 'chain', opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { mode: 0 } }, { prefix: 'r', algo: 'reverb', params: { mode: 1 } }] },
      controls: [
        K('d.time', 'TIME', { min: 20, max: 2000, def: 380, display: ms, curve: 'log' }), K('d.feedback', 'REPEATS', { def: 0.35 }), K('d.tone', 'TONE', { def: 0.6 }),
        K('r.decay', 'REFLECTION', { def: 0.5 }), K('mix', 'MIX', { def: 0.35, virtual: true }),
      ],
      derive: (p) => ({ 'd.mix': p.mix ?? 0.35, 'r.mix': (p.mix ?? 0.35) * 0.9, 'r.tone': p['d.tone'] ?? 0.6 }),
    }),
    EQ({
      id: 'eqd.avalanche', name: 'Rockslide Run Stereo Delay & Reverb', ref: 'EarthQuaker Devices Avalanche Run V2', logo: 'ROCKSLIDE', tagline: 'STEREO REVERB & DELAY', cat: 'Delay',
      color: '#efeee6', ink: '#1c2a4a', ink2: '#58a8d6', scene: 'avalanche', size: 'x', stereo: 'both', cost: 1.6, noStd: true,
      algo: 'chain', opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 2000 } }, { prefix: 'r', algo: 'reverb', params: { mode: 1 } }] },
      controls: [
        K('d.time', 'TIME', { min: 20, max: 2000, def: 420, display: ms, curve: 'log' }), K('d.feedback', 'REPEATS', { def: 0.4, max: 1.05 }), K('d.mix', 'MIX', { def: 0.35 }),
        K('d.tone', 'TONE', { def: 0.6 }), K('r.decay', 'DECAY', { def: 0.55 }), K('r.mix', 'REVERB', { def: 0.3 }),
        TOG('dmode', 'MODE', ['norm', 'rev', 'swell'], { virtual: true }), TOG('d.subdiv', 'RATIO', ['1/4', 'dot', 'trip'], { values: [0, 1, 3] }), TOG('tails', 'TAILS', ['off', 'on'], { virtual: true }),
        FOOT({ action: 'tap', label: 'TAP', tapTarget: 'd.time', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), bypassFoot(),
        LED({ bind: 'tap:d.time', color: '#ff2a1a' }), LED({ bind: 'on', color: '#ff2a1a' }),
      ],
      derive: (p) => ({ 'd.mode': p.dmode === 1 ? 5 : 0, 'r.mode': p.dmode === 2 ? 9 : 1 }),
      desc: 'NORMAL, REVERSE or SWELL (auto-swelling reverb). Hold TAP to self-oscillate / freeze the repeats.',
    }),
    EQ({
      id: 'eqd.afterneath', name: 'Underneath Otherworldly Reverberator', ref: 'EarthQuaker Devices Afterneath V3', logo: 'UNDERNEATH', tagline: 'OTHERWORLDLY REVERBERATOR', cat: 'Reverb',
      color: '#3a2f62', ink: '#0e0b16', ink2: '#9be15d', text: '#efe9ff', scene: 'cave', cost: 1.6,
      algo: 'reverb', opts: { fixedMode: 5 }, rows: [3, 3],
      controls: [
        K('decay', 'LENGTH', { def: 0.6 }), K('diffusion', 'DIFFUSE', { def: 0.6 }), K('damp', 'DAMPEN', { def: 0.4, virtual: true }),
        K('drag', 'DRAG', { def: 0.3, virtual: true }), K('size', 'REFLECT', { def: 0.5 }), K('mix', 'MIX', { def: 0.4 }),
      ],
      derive: (p) => ({ mode: 5, tone: 1 - 0.8 * (p.damp ?? 0.4), highdamp: p.damp ?? 0.4, predelay: 10 + 380 * (p.drag ?? 0.3), mod: 0.2 + 0.6 * (p.drag ?? 0.3) }),
      desc: 'A swarm of short delays smeared into a cavernous reverb. DRAG stretches the spacing (pre-delay + pitch wobble).',
    }),
    EQ({
      id: 'eqd.ghostecho', name: 'Phantom Echo Vintage Reverb', ref: 'EarthQuaker Devices Ghost Echo V3', logo: 'PHANTOM', tagline: 'VINTAGE VOICED REVERB', cat: 'Reverb',
      color: '#5d9d8e', ink: '#121212', ink2: '#f4f1e8', scene: 'ghost', size: 'b',
      algo: 'reverb', opts: { fixedMode: 8 }, fixed: { mode: 8, predelay: 60, tone: 0.55 },
      controls: [K('mix', 'BLEND', { def: 0.35 }), K('decay', 'DWELL', { def: 0.45 }), K('level', 'VOLUME', { def: 0.5 })],
    }),
    EQ({
      id: 'eqd.astral', name: 'Celestial Destiny Octal Reverb', ref: 'EarthQuaker Devices Astral Destiny', logo: 'CELESTIAL', tagline: 'OCTAL OCTAVE REVERBERATION MODULATOR', cat: 'Reverb',
      color: '#1b1541', ink: '#0b0920', ink2: '#f4d35e', text: '#f6edc9', scene: 'planets', size: 'x', stereo: 'both', cost: 1.8,
      algo: 'reverb',
      controls: [
        K('decay', 'LENGTH', { def: 0.6 }), K('mod', 'MODULATE', { def: 0.3 }), K('shimmer', 'DEPTH', { def: 0.5 }),
        K('damp', 'DAMPEN', { def: 0.4, virtual: true }), K('mix', 'MIX', { def: 0.4 }), SEL('prog', 'MODE', ['1', '2', '3', '4', '5', '6', '7', '8'], { def: 0, virtual: true }),
      ],
      derive: (p) => ({ mode: [4, 4, 5, 6, 1, 2, 9, 8][p.prog ?? 0], size: (p.prog ?? 0) === 1 ? 1 : 0.75, tone: 1 - 0.75 * (p.damp ?? 0.4), shimmer: (p.prog ?? 0) <= 1 ? p.shimmer ?? 0.5 : p.shimmer ?? 0.5 }),
      desc: 'Eight octave / shimmer / swell / modulated reverb modes.',
    }),
    EQ({
      id: 'eqd.spacespiral', name: 'Star Spiral Modulated Delay', ref: 'EarthQuaker Devices Space Spiral V2', logo: 'STAR SPIRAL', tagline: 'MODULATED DELAY DEVICE', cat: 'Delay',
      color: '#15213d', ink: '#070b16', ink2: '#ff6b35', text: '#f2f2f2', scene: 'spiral',
      algo: 'delay', opts: { maxMs: 1000, fixedMode: 4 }, rows: [3, 2],
      controls: [
        K('time', 'TIME', { min: 30, max: 1000, def: 350, display: ms, curve: 'log' }), K('feedback', 'REPEATS', { def: 0.45, max: 1.05 }), K('mix', 'MIX', { def: 0.4 }),
        K('modrate', 'RATE', { def: 0.3 }), K('moddepth', 'DEPTH', { def: 0.4 }), TOG('tone', 'TONE', ['dark', 'brt'], { values: [0.35, 0.7] }),
      ],
    }),
    EQ({
      id: 'eqd.disaster', name: 'Calamity Transit Dual Delay', ref: 'EarthQuaker Devices Disaster Transport SR', logo: 'CALAMITY', tagline: 'ADVANCED MODULATED DELAY', cat: 'Delay',
      color: '#8a1d1d', ink: '#120606', ink2: '#f0d39a', text: '#f6e7c6', scene: 'tracks', size: 'x', cost: 1.8, noStd: true,
      algo: 'chain', opts: { chain: [
        { prefix: 'a', algo: 'delay', opts: { maxMs: 1000 }, params: { mode: 1 } },
        { prefix: 'b', algo: 'delay', opts: { maxMs: 1000 }, params: { mode: 4 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 5, mix: 0.2 } },
      ] },
      rows: [4, 4],
      controls: [
        K('a.time', 'A TIME', { min: 20, max: 1000, def: 300, display: ms, curve: 'log', r: 11 }), K('a.feedback', 'A REPEAT', { def: 0.35, r: 11 }), K('a.mix', 'A MIX', { def: 0.35, r: 11 }), K('r.mix', 'WASH', { min: 0, max: 0.6, def: 0.15, r: 11 }),
        K('b.time', 'B TIME', { min: 20, max: 1000, def: 520, display: ms, curve: 'log', r: 11 }), K('b.feedback', 'B REPEAT', { def: 0.4, r: 11 }), K('b.modrate', 'RATE', { def: 0.3, r: 11 }), K('b.moddepth', 'DEPTH', { def: 0.35, r: 11 }),
        TOG('route', 'ROUTE', ['A>B', 'B'], { virtual: true }),
        FOOT({ action: 'param', p: 'a.on', toggle: true, label: 'A' }), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'B' }),
        LED({ bind: 'param:a.on', color: '#ff2a1a' }), LED({ bind: 'param:b.on', color: '#ff2a1a' }),
      ],
      derive: (p) => ({ 'b.mix': p.route ? 0.45 : 0.35, 'r.on': (p['a.on'] ?? 1) || (p['b.on'] ?? 1) ? 1 : 0 }),
      alwaysOn: true, initParams: { 'a.on': 1, 'b.on': 1 },
      desc: 'Delay A (warm, bucket-brigade style) into delay B (modulated), plus a reverb WASH smearing the repeats.',
    }),
    // ---------------- modulation
    EQ({
      id: 'eqd.rainbow', name: 'Prism Machine Polyphonic Pitch Mod', ref: 'EarthQuaker Devices Rainbow Machine V2', logo: 'PRISM MACHINE', tagline: 'POLYPHONIC PITCH MESMERIZER', cat: 'Modulation',
      color: '#f3eee2', ink: '#1c1c1c', ink2: '#e8457a', scene: 'rainbow', size: 'w', cost: 1.8, noStd: true,
      algo: 'chain', opts: { chain: [{ prefix: 'p', algo: 'pitch', params: { semis1: 7, level1: 0.6, dry: 1, level2: 0 } }, { prefix: 'c', algo: 'chorus', params: { mode: 0 } }] },
      controls: [
        K('c.rate', 'TRACKING', { def: 0.3 }), K('p.semis1', 'PITCH', { min: -12, max: 12, def: 7, display: semi }), K('p.level1', 'PRIMARY', { def: 0.6 }),
        K('c.mix', 'SECONDARY', { def: 0.4 }), K('p.tone', 'TONE', { def: 0.7 }), K('c.feedback', 'MAGIC', { def: 0.2, max: 0.9 }),
        FOOT({ action: 'param', p: 'magic', toggle: true, label: 'MAGIC' }), bypassFoot(), LED({ bind: 'param:magic', color: '#ff2a1a' }), LED({ bind: 'on', color: '#ff2a1a' }),
      ],
      derive: (p) => (p.magic ? { 'c.feedback': 0.9, 'c.depth': 0.85 } : { 'c.depth': 0.55 }),
      desc: 'Pitch-shifted voice (PRIMARY) plus a modulated, regenerating second voice (SECONDARY / MAGIC). The MAGIC switch pushes it into self-oscillation.',
    }),
    EQ({
      id: 'eqd.grandorbiter', name: 'Grand Orbit Phase Machine', ref: 'EarthQuaker Devices Grand Orbiter V3', logo: 'GRAND ORBIT', tagline: 'PHASE MACHINE', cat: 'Modulation',
      color: '#e0652c', ink: '#1a1a1a', ink2: '#f9e7c6', scene: 'orbit',
      algo: 'phaser', opts: { stages: 6 }, fixed: { mix: 0.5 }, rows: [2, 2],
      controls: [K('rate', 'RATE', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.8 }), K('feedback', 'RESONANCE', { def: 0.45 }), K('center', 'PHASE', { def: 0.5 }), TOG('stages', 'STAGES', ['4', '6'], { values: [4, 6], def: 1 })],
    }),
    EQ({
      id: 'eqd.seamachine', name: 'Ocean Machine Super Chorus', ref: 'EarthQuaker Devices Sea Machine V3', logo: 'OCEAN MACHINE', tagline: 'SUPER CHORUS', cat: 'Modulation',
      color: '#2b8a9e', ink: '#0d1a24', ink2: '#f3d9b1', text: '#f4ede0', scene: 'tentacles', stereo: 'both',
      algo: 'chorus', rows: [3, 3],
      controls: [K('rate', 'RATE', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.5 }), K('delay', 'DIMENSION', { def: 0.5 }), K('feedback', 'REGEN', { def: 0.15, max: 0.85 }), K('mix', 'MIX', { def: 0.5 }), K('level', 'LEVEL', { def: 0.5 })],
    }),
    EQ({
      id: 'eqd.pyramids', name: 'Ziggurats Stereo Flanger', ref: 'EarthQuaker Devices Pyramids', logo: 'ZIGGURATS', tagline: 'STEREO FLANGING DEVICE', cat: 'Modulation',
      color: '#d8b55b', ink: '#1d1d1d', ink2: '#7a2e8e', scene: 'pyramids', size: 'w', stereo: 'both', noStd: true,
      algo: 'flanger',
      controls: [
        K('manual', 'MANUAL', { def: 0.5 }), K('width', 'WIDTH', { def: 0.6 }), K('speed', 'RATE', { def: 0.3 }),
        K('regen', 'FEEDBACK', { def: 0.55 }), K('mix', 'MIX', { def: 0.5 }), SEL('mode', 'MODE', ['CLAS', 'ULTRA', 'GATE', 'TZF'], { def: 0, labelRadius: 12, optSize: 5 }),
        FOOT({ action: 'favorite', label: 'PRESET' }), bypassFoot(), LED({ bind: 'fav', color: '#ff2a1a' }), LED({ bind: 'on', color: '#ff2a1a' }),
      ],
      desc: 'Classic, ultra (extra regeneration), gated and through-zero flanging. The left switch recalls / saves (hold) a preset.',
    }),
    EQ({
      id: 'eqd.nightwire', name: 'Midnight Wire Harmonic Tremolo', ref: 'EarthQuaker Devices Night Wire V2', logo: 'MIDNIGHT WIRE', tagline: 'HARMONIC TREMOLO', cat: 'Modulation',
      color: '#1c2b45', ink: '#0a0f19', ink2: '#f2c230', text: '#ece6d4', scene: 'lightning', stereo: 'both',
      algo: 'tremolo', rows: [2, 2],
      controls: [
        K('rate', 'RATE', { def: 0.45 }), K('depth', 'DEPTH', { def: 0.65 }), K('wave', 'SHAPE', { def: 0.3 }), K('level', 'LEVEL', { def: 0.5 }),
        TOG('mode', 'MODE', ['harm', 'amp'], { values: [1, 0] }),
      ],
      led: '#3d8bff',
    }),
    // ---------------- filter / pitch / synth
    EQ({
      id: 'eqd.spatial', name: 'Spatial Courier Envelope Filter', ref: 'EarthQuaker Devices Spatial Delivery V3', logo: 'COURIER', tagline: 'ENVELOPE FILTER W/ SAMPLE & HOLD', cat: 'Filter',
      color: '#4b2a6b', ink: '#120a1c', ink2: '#e2d34c', text: '#f1ecfa', scene: 'ufo',
      algo: 'wah', opts: { mode: 2, fLo: 220, fHi: 3200, q: 5 }, rows: [3, 2],
      controls: [
        K('range', 'RANGE', { def: 0.6 }), K('q', 'RESONANCE', { def: 0.55 }), K('sens', 'SENS', { def: 0.55 }),
        K('rate', 'S&H RATE', { def: 0.5 }), K('level', 'LEVEL', { def: 0.5 }),
        TOG('sweep', 'SWEEP', ['up', 'dn', 's&h']), TOG('filter', 'FILTER', ['LP', 'BP', 'HP'], { def: 1 }),
      ],
      derive: (p) => ({ mode: p.sweep === 2 ? 1 : 2, direction: p.sweep === 1 ? 1 : 0 }),
      desc: 'Envelope filter sweeping up or down; S&H approximated with a stepped LFO sweep.',
    }),
    EQ({
      id: 'eqd.datacorrupter', name: 'Data Scrambler Harmonizing PLL', ref: 'EarthQuaker Devices Data Corrupter', logo: 'SCRAMBLER', tagline: 'MODULATED MONOPHONIC HARMONIZING PLL', cat: 'Synth',
      color: '#1f9f83', ink: '#0f0f0f', ink2: '#f3e94a', scene: 'glitch', size: 'x', cost: 1.2,
      algo: 'synth', opts: { mode: 0 },
      controls: [
        K('wet', 'MASTER', { def: 0.7 }), K('dry', 'DRY', { def: 0.3 }), K('level', 'VOLUME', { min: -24, max: 12, def: 0, display: db }),
        K('filter', 'FILTER', { def: 0.55 }), K('mod', 'MOD RATE', { def: 0.25 }), K('attack', 'GLIDE', { def: 0.15 }),
        SEL('octave', 'OSC', ['-2', '-1', '0', '+1'], { values: [-2, -1, 0, 1], def: 1, togRow: true }), TOG('mode', 'WAVE', ['sqr', 'sub', 'saw'], { values: [0, 5, 1] }), TOG('glide', 'MOD', ['vib', 'off'], { virtual: true, def: 0 }),
      ],
      rows: [3, 3],
      derive: (p) => ({ mod: p.glide ? 0 : p.mod ?? 0.25 }),
      desc: 'Monophonic square-wave synth that tracks your playing (subharmonic / unison / octave-up oscillator).',
    }),
    EQ({
      id: 'eqd.bitcommander', name: 'Byte Commander Octave Synth', ref: 'EarthQuaker Devices Bit Commander V2', logo: 'BYTE COMMANDER', tagline: 'ANALOG OCTAVE SYNTH', cat: 'Synth',
      color: '#212121', ink: '#0a0a0a', ink2: '#4ad04a', text: '#eeeeee', scene: 'invader', size: 'w', cost: 2.6,
      algo: 'chain', opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { semis1: -12, semis2: -24, quality: 0 } },
        { prefix: 'u', algo: 'pitch', params: { semis1: 12, level2: 0, dry: 1, quality: 0 } },
        { prefix: 'f', algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 14, tone: 'lp', toneLo: 500, toneHi: 7000, gainMinDb: 30, gainMaxDb: 30, levelMinDb: -40, levelMaxDb: -6, preHp: 30 } },
      ] },
      controls: [
        K('sub', 'SUB', { def: 0.5, virtual: true }), K('down', 'OCT DOWN', { def: 0.6, virtual: true }), K('base', 'BASE', { def: 0.5, virtual: true }),
        K('up', 'OCT UP', { def: 0.2, virtual: true }), K('f.tone', 'FILTER', { def: 0.5 }), K('orig', 'ORIGINAL', { def: 0.3, virtual: true }),
      ],
      derive: (p) => ({ 'p.level2': p.sub ?? 0.5, 'p.level1': p.down ?? 0.6, 'p.dry': p.base ?? 0.5, 'u.level1': (p.up ?? 0.2) * 0.8, 'f.blend': 1 - 0.8 * (p.orig ?? 0.3), 'f.level': 0.55, 'f.gain': 0.6 }),
      desc: 'Square-wave octave synth: SUB (-2 oct), OCT DOWN, BASE and OCT UP voices squared up by a fuzz stage; ORIGINAL blends the un-squared signal back in.',
    }),
    EQ({
      id: 'eqd.organizer', name: 'Organism Polyphonic Organ Emulator', ref: 'EarthQuaker Devices Organizer V2', logo: 'ORGANISM', tagline: 'POLYPHONIC ORGAN EMULATOR', cat: 'Synth',
      color: '#6b3a29', ink: '#1b0d07', ink2: '#d9a441', text: '#f2e2c0', scene: 'pipes', cost: 1.2,
      algo: 'synth', opts: { mode: 2 }, rows: [3, 2],
      controls: [
        K('wet', 'ORGAN', { def: 0.7 }), K('dry', 'DIRECT', { def: 0.35 }), K('filter', 'TONE', { def: 0.55 }),
        K('mod', 'CHORUS', { def: 0.3 }), K('attack', 'ATTACK', { def: 0.1 }), TOG('octave', 'OCTAVE', ['-1', '0', '+1'], { values: [-1, 0, 1], def: 1 }),
      ],
    }),
    // ---------------- utility
    EQ({
      id: 'eqd.swissthings', name: 'Alpine Things Pedalboard Reconciler', ref: 'EarthQuaker Devices Swiss Things', logo: 'ALPINE THINGS', tagline: 'PEDALBOARD RECONCILER', cat: 'Utility', kind: 'Utility',
      color: '#cc2529', ink: '#1a1a1a', ink2: '#ffffff', text: '#ffffff', scene: 'cross', size: 'x', noStd: true, cost: 0.05, alwaysOn: true,
      ports: { ins: ['INPUT'], outs: ['A OUT', 'B OUT'] },
      algo: 'utility', opts: { kind: 'split' },
      controls: [
        K('boost', 'VOLUME', { min: 0, max: 15, def: 6, display: db, virtual: true }), K('levelB', 'B LEVEL', { min: -24, max: 12, def: 0, display: db }),
        TOG('aby', 'A/B/Y', ['A/B', 'Y'], { virtual: true }),
        FOOT({ action: 'param', p: 'ab', toggle: true, label: 'A/B' }), FOOT({ action: 'param', p: 'bst', toggle: true, label: 'VOLUME' }),
        LED({ bind: 'param:ab', color: '#3d8bff' }), LED({ bind: 'param:bst', color: '#ff2a1a' }),
      ],
      rows: [2],
      derive: (p) => ({ select: p.aby ? 2 : p.ab ? 1 : 0, level: p.bst ? p.boost ?? 6 : 0, levelB: (p.levelB ?? 0) + (p.bst ? p.boost ?? 6 : 0) }),
      desc: 'A/B or A+B (Y) output switching with an independent clean volume boost. (The real unit\'s effects loop, tuner out and aux switching are not modelled.)',
    }),
    // ---------------- added in v0.4
    EQ({
      id: 'eqd.acapulco', name: 'Aztec Gold Power Amp Distortion', ref: 'EarthQuaker Devices Acapulco Gold V2', logo: 'AZTEC GOLD', tagline: 'POWER AMP DISTORTION', cat: 'Distortion',
      color: '#1d1a17', ink: '#0c0b0a', ink2: '#e2b23c', text: '#e2b23c', scene: 'aztec', size: 'b',
      algo: 'drive', opts: { clip: 'tube', stages: 3, stage2Db: 14, bias: 0.3, preHp: 60, gainMinDb: 30, gainMaxDb: 30, tone: 'none', postLp: 6000, levelMinDb: -40, levelMaxDb: -6, preEq: [{ type: 'peak', f: 500, q: 0.7, db: 4 }] },
      fixed: { gain: 0.5 },
      controls: [K('level', 'VOLUME', { def: 0.55 })],
      desc: 'One knob, loud and fuzzy power amp distortion. VOLUME is the only control: turn your amp down.',
    }),
    EQ({
      id: 'eqd.blumes', name: 'Bloomer Low Signal Shredder', ref: 'EarthQuaker Devices Blumes', logo: 'BLOOMER', tagline: 'LOW SIGNAL SHREDDER', cat: 'Overdrive',
      color: '#e9a7c0', ink: '#2a1630', ink2: '#f6e27a', scene: 'flower',
      algo: 'drive', opts: { tone: 'ts', toneLo: 600, gainMinDb: 6, gainMaxDb: 40, levelMaxDb: 6, preHp: 25, clipHp: 200, postLp: 7000, cleanSum: true, cleanMix: 0,
        modes: [{ clip: 'led', bias: 0.3 }, { clip: 'clean', gainMaxDb: 30 }, { clip: 'si' }] },
      controls: [K('level', 'LEVEL', { def: 0.5 }), K('tone', 'TONE', { def: 0.5 }), K('gain', 'GAIN', { def: 0.5 }), K('blend', 'BLEND', { def: 0.8 }), TOG('mode', 'MODE', ['1', '2', '3'])],
      rows: [4],
      desc: 'Bass-friendly take on the small signal shredder with a clean BLEND to keep the low end.',
    }),
    EQ({
      id: 'eqd.talons', name: 'Talon High Gain Overdrive', ref: 'EarthQuaker Devices Talons', logo: 'TALON', tagline: 'HIGH GAIN OVERDRIVE', cat: 'Distortion',
      color: '#6b2a2a', ink: '#120707', ink2: '#e9e1cf', text: '#f2e7d2', scene: 'claws',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, stages: 2, stage2Db: 10, preHp: 80, gainMinDb: 12, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 700, trebleF: 2800, postLp: 9000, levelMaxDb: -3 },
      controls: [K('level', 'LEVEL', { def: 0.5 }), K('gain', 'GAIN', { def: 0.55 }), K('hicut', 'HI CUT', { def: 0.4, virtual: true }), K('bass', 'BASS', { def: 0.55 }), K('treble', 'TREBLE', { def: 0.5 })],
      rows: [3, 2],
      derive: (p) => ({ mid: 0.5, bright: 0.6 - (p.hicut ?? 0.4) * 0.6 }),
      desc: 'Amp-like high gain drive with bass, treble and a high cut to tame fizz.',
    }),
    EQ({
      id: 'eqd.silos', name: 'Granary Time Reflection', ref: 'EarthQuaker Devices Silos', logo: 'GRANARY', tagline: 'MULTI-GENERATIONAL DELAY', cat: 'Delay',
      color: '#c9b78a', ink: '#1e1a12', ink2: '#e9e2ce', scene: 'silo', stereo: 'both',
      algo: 'delay', opts: { maxMs: 1000 },
      controls: [K('time', 'TIME', { min: 30, max: 1000, def: 380, display: ms, curve: 'log' }), K('feedback', 'REPEATS', { def: 0.4, max: 1.08 }), K('mix', 'MIX', { def: 0.35 }), K('moddepth', 'MOD', { def: 0.15 }),
        TOG('mode', 'MODE', ['digi', 'tape', 'bbd'], { values: [0, 2, 1] })],
      rows: [2, 2],
      desc: 'Digital, tape-style and bucket-brigade delay with modulation.',
    }),
    EQ({
      id: 'eqd.aqueduct', name: 'Viaduct Vibrato', ref: 'EarthQuaker Devices Aqueduct', logo: 'VIADUCT', tagline: 'VIBRATO MODULATOR', cat: 'Modulation',
      color: '#5e93c7', ink: '#0f1d2e', ink2: '#f2ecd8', scene: 'arches',
      algo: 'chorus', fixed: { mix: 1, mode: 1 },
      controls: [K('rate', 'RATE', { def: 0.4 }), K('depth', 'DEPTH', { def: 0.45 }), SEL('shape', 'MODE', ['SIN', 'TRI', 'RMP', 'SQR', 'RND', 'ENV+', 'ENV-', 'ENVR'], { virtual: true, sweep: 270 })],
      derive: (p) => ({ wave: [0, 0.3, 0.6, 1, 0.5, 0.2, 0.8, 0.4][p.shape ?? 0] }),
      desc: 'Pitch vibrato with eight modulation modes. The envelope modes are approximated with fixed shapes.',
    }),
    EQ({
      id: 'eqd.ledges', name: 'Overhang Reverberation Machine', ref: 'EarthQuaker Devices Ledges', logo: 'OVERHANG', tagline: 'TRI-DIMENSIONAL REVERB', cat: 'Reverb',
      color: '#2f8f8a', ink: '#0b1f1e', ink2: '#e8f2e9', text: '#effaf6', scene: 'ledge', stereo: 'both', cost: 1.1,
      algo: 'reverb',
      controls: [K('decay', 'DWELL', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('mix', 'MIX', { def: 0.35 }), TOG('mode', 'MODE', ['room', 'plate', 'hall'], { values: [0, 2, 1] })],
      desc: 'Room, plate and hall reverb with dwell, tone and mix.',
    }),
    EQ({
      id: 'eqd.zoar', name: 'Zoat Dynamic Grinder', ref: 'EarthQuaker Devices Zoar', logo: 'ZOAT', tagline: 'DYNAMIC AUDIO GRINDER', cat: 'Distortion',
      color: '#3a3f46', ink: '#0d0f12', ink2: '#e98a3a', text: '#f0ebe0', scene: 'gears',
      algo: 'drive', opts: { clip: 'si', stages: 2, stage2Db: 10, preHp: 60, gainMinDb: 10, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 14, bassF: 110, midF: 800, trebleF: 3000, postLp: 9000, levelMaxDb: -5, useHiMid: false },
      controls: [K('level', 'LEVEL', { def: 0.5 }), K('gain', 'GAIN', { def: 0.55 }), K('weight', 'WEIGHT', { def: 0.5, virtual: true }), K('bass', 'BASS'), K('mid', 'MIDDLE'), K('treble', 'TREBLE')],
      derive: (p) => ({ sag: (p.weight ?? 0.5) * 0.4 }),
      desc: 'Dynamic distortion with an active 3-band EQ. WEIGHT sets how much the low end swells.',
    }),
  ]);
}
